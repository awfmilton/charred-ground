'use strict';

// Telegram Mini App + bot integration for the Charred Ground server.
//
//  * initData sign-in (HMAC-SHA256, https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
//  * Bot API client (production or test environment)
//  * webhook: bot commands, deep links, inline invites, Stars checkout, refunds
//  * prepared share messages, turn notifications, TURN relay credentials, map/challenge shares,
//    Story images and the per-chat leaderboard
//
// Nothing here is reachable unless TELEGRAM_BOT_TOKEN is set; without it every /api/telegram
// route answers 503 and the web build behaves exactly as before.

const crypto = require('node:crypto');
const { getCatalog, findSku, summarizeEntitlements, SUBSCRIPTION_PERIOD } = require('./telegram-catalog.cjs');

const DEFAULT_INITDATA_MAX_AGE_SEC = 24 * 3600;
const START_PARAM_RE = /^[A-Za-z0-9_-]{0,64}$/;
const ROOM_RE = /^[a-z0-9]{6}$/;
// A custom map's encoded heightfield is ~310 KB of base64, so shares get a larger body limit.
const MAX_SHARE_BYTES = 480 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TTL_MS = 60 * 60 * 1000;
const MAX_IMAGES = 64;
const TURN_NOTIFY_GAP_MS = 45 * 1000;

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

// Returns { ok, reason?, data? }. data holds the parsed, verified fields.
function verifyInitData(raw, botToken, { maxAgeSec = DEFAULT_INITDATA_MAX_AGE_SEC, now = Date.now() } = {}) {
  if (!botToken) return { ok: false, reason: 'Telegram is not configured on this server.' };
  if (typeof raw !== 'string' || !raw || raw.length > 8192) return { ok: false, reason: 'Missing Telegram launch data.' };
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: 'Telegram launch data is not signed.' };
  const pairs = [];
  for (const [k, v] of params) if (k !== 'hash') pairs.push(`${k}=${v}`);
  pairs.sort();
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  if (!timingSafeEqualHex(expected, hash.toLowerCase())) return { ok: false, reason: 'Telegram launch data signature is invalid.' };
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'Telegram launch data has no auth date.' };
  const ageSec = now / 1000 - authDate;
  if (ageSec > maxAgeSec) return { ok: false, reason: 'Telegram launch data has expired. Reopen the game from Telegram.' };
  if (ageSec < -300) return { ok: false, reason: 'Telegram launch data is dated in the future.' };
  let user = null;
  try { user = params.get('user') ? JSON.parse(params.get('user')) : null; } catch { user = null; }
  if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) return { ok: false, reason: 'Telegram launch data has no user.' };
  const startParam = params.get('start_param') || '';
  return {
    ok: true,
    data: {
      user: {
        id: String(user.id),
        firstName: String(user.first_name || '').slice(0, 64),
        lastName: String(user.last_name || '').slice(0, 64),
        username: String(user.username || '').slice(0, 32),
        languageCode: String(user.language_code || '').slice(0, 16),
        isPremium: Boolean(user.is_premium),
        allowsWriteToPm: Boolean(user.allows_write_to_pm),
        photoUrl: /^https:\/\//.test(String(user.photo_url || '')) ? String(user.photo_url).slice(0, 300) : ''
      },
      chatInstance: params.get('chat_instance') ? String(params.get('chat_instance')).slice(0, 64) : null,
      chatType: params.get('chat_type') || null,
      startParam: START_PARAM_RE.test(startParam) ? startParam : '',
      queryId: params.get('query_id') || null,
      authDate
    }
  };
}

// Test helper and fixture generator: produces initData exactly as Telegram signs it.
function signInitData(fields, botToken) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  const pairs = [...params].map(([k, v]) => `${k}=${v}`).sort();
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex'));
  return params.toString();
}

function createBotApi({ token, fetchImpl = globalThis.fetch, testEnv = false } = {}) {
  const base = `https://api.telegram.org/bot${token}${testEnv ? '/test' : ''}`;
  async function call(method, params = {}) {
    if (!token) throw Object.assign(new Error('Telegram bot token is not configured.'), { status: 503 });
    if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation for the Bot API');
    const res = await fetchImpl(`${base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!body || body.ok !== true) {
      const err = new Error(`Bot API ${method} failed: ${body?.description || res.status}`);
      err.status = 502;
      err.telegramCode = body?.error_code;
      throw err;
    }
    return body.result;
  }
  return { call };
}

function readRawBody(req, limit) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      total += chunk.length;
      if (total > limit) {
        aborted = true;
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!aborted) resolve(Buffer.concat(chunks)); });
    req.on('error', err => { if (!aborted) reject(err); });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function telegramConfig(env) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  return {
    token,
    enabled: Boolean(token),
    testEnv: /^(1|true|yes)$/i.test(String(env.TELEGRAM_TEST_ENV || '')),
    webhookSecret: String(env.TELEGRAM_WEBHOOK_SECRET || ''),
    botUsername: String(env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, ''),
    appShortName: String(env.TELEGRAM_APP_SHORT_NAME || ''),
    publicBaseUrl: String(env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    supportContact: String(env.TELEGRAM_SUPPORT_CONTACT || ''),
    termsUrl: String(env.TELEGRAM_TERMS_URL || ''),
    adminIds: new Set(String(env.TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)),
    championEmojiId: /^\d{5,30}$/.test(String(env.TELEGRAM_CHAMPION_EMOJI_ID || '')) ? String(env.TELEGRAM_CHAMPION_EMOJI_ID) : '',
    storeEnabled: Boolean(token) && !/^(0|false|no|off)$/i.test(String(env.TELEGRAM_STORE_ENABLED ?? '1')),
    aiPassRequired: /^(1|true|yes)$/i.test(String(env.TELEGRAM_AI_PASS_REQUIRED || '')),
    maxAgeSec: Math.max(60, Number(env.TELEGRAM_INITDATA_MAX_AGE_SEC) || DEFAULT_INITDATA_MAX_AGE_SEC)
  };
}

// Deep link that opens the Mini App with a start parameter (section 7.2 of docs/TELEGRAM_MINI_APP.md).
function deepLink(cfg, param = '') {
  if (!cfg.botUsername) return '';
  const p = START_PARAM_RE.test(param) ? param : '';
  if (cfg.appShortName) return `https://t.me/${cfg.botUsername}/${cfg.appShortName}${p ? `?startapp=${p}` : ''}`;
  return `https://t.me/${cfg.botUsername}?startapp${p ? `=${p}` : ''}`;
}

const TERMS_TEXT = [
  '<b>Charred Ground — purchase terms</b>',
  '',
  '• Everything sold for Telegram Stars is cosmetic or a convenience pass. Nothing changes weapons, damage, credits or ranked results.',
  '• Permanent items stay on your Telegram-linked account. The Supporter subscription renews every 30 days until you cancel it in Telegram.',
  '• If something you paid for does not arrive, send /paysupport and we refund or deliver it.',
  '• Telegram support and @BotSupport cannot help with purchases made in this bot.'
].join('\n');

function createTelegramService({ core, getTgStore, env = process.env, fetchImpl = globalThis.fetch, clock = () => Date.now(), helpers }) {
  const cfg = telegramConfig(env);
  const bot = createBotApi({ token: cfg.token, fetchImpl, testEnv: cfg.testEnv });
  const { json, readJsonBody, getAuthSession, issueSessionForUser, formatSelfUser, checkRateLimit, sanitizeUsername, formatLeaderboardRows } = helpers;
  const images = new Map(); // id -> { buf, type, expiresAt }
  // The Telegram tables are created on first use, so servers (and tests) that never touch a
  // Telegram route never run its migrations.
  let tg = null;
  async function ensureTg() {
    if (!tg) {
      const t = getTgStore();
      await t.ready;
      tg = t;
    }
    return tg;
  }
  const OWNED = /^\/api\/(telegram\/|auth\/telegram(\/link)?$|shares(\/|$)|media\/|turn$|store\/)/;

  function pruneImages() {
    const now = clock();
    for (const [id, img] of images) if (img.expiresAt <= now) images.delete(id);
    while (images.size > MAX_IMAGES) images.delete(images.keys().next().value);
  }

  function requireEnabled(res) {
    if (cfg.enabled) return true;
    json(res, 503, { error: 'Telegram is not configured on this server.' });
    return false;
  }

  async function requireSession(req, res) {
    if (!/^Bearer /i.test(req.headers.authorization || '')) {
      json(res, 401, { error: 'Authentication required.' });
      return null;
    }
    const sess = await getAuthSession(req);
    if (!sess) json(res, 401, { error: 'Authentication required.' });
    return sess;
  }

  async function uniqueUsername(base) {
    let b = sanitizeUsername(base);
    if (b.length < 3) b = `tg_${b}`.slice(0, 24);
    let candidate = b;
    let n = 1;
    while (await core.getUserByUsername(candidate)) candidate = `${b.slice(0, 18)}_${n++}`;
    return candidate;
  }

  async function findOrCreateUser(tgUser) {
    const existing = await core.getUserByOAuth('telegram', tgUser.id);
    if (existing) return { user: existing, created: false };
    const displayName = [tgUser.firstName, tgUser.lastName].filter(Boolean).join(' ').trim().slice(0, 40) || tgUser.username || `Commander ${tgUser.id.slice(-4)}`;
    const username = await uniqueUsername(tgUser.username || `tg_${tgUser.id}`);
    // Telegram vouches for the identity, so the account is verified the same way an OAuth
    // provider with a verified email is. The placeholder address can never receive mail.
    const user = await core.createUser({
      username,
      email: `tg_${tgUser.id}@telegram.invalid`,
      passwordHash: null,
      emailVerified: true,
      displayName,
      avatar: tgUser.photoUrl || ''
    });
    await core.linkOAuthAccount({ userId: user.id, provider: 'telegram', providerUserId: tgUser.id, email: '' });
    return { user, created: true };
  }

  async function send(chatId, text, extra = {}) {
    return bot.call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });
  }

  function playButton(text, param) {
    const url = deepLink(cfg, param);
    return url ? { reply_markup: { inline_keyboard: [[{ text, url }]] } } : {};
  }

  // ---- webhook update handlers -------------------------------------------------------------

  async function handleCommand(msg) {
    const text = String(msg.text || '').trim();
    const m = text.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+(.*))?$/i);
    if (!m) return;
    const cmd = m[1].toLowerCase();
    const arg = (m[2] || '').trim();
    const chatId = msg.chat.id;
    const fromId = String(msg.from?.id || '');

    if (cmd === 'start') {
      const param = START_PARAM_RE.test(arg) ? arg : '';
      if (param === 'paysupport') return handleCommand({ ...msg, text: '/paysupport' });
      const label = param.startsWith('r_') ? '⚔ Join the battle' : param.startsWith('c_') ? '🎯 Take the challenge' : param.startsWith('m_') ? '🗺 Open the map' : '🎮 Play Charred Ground';
      return send(chatId, '<b>Charred Ground</b> — turn-based 3D artillery for up to six commanders. Aim, trust the wind, leave a crater.', playButton(label, param));
    }
    if (cmd === 'help') {
      return send(chatId, [
        '<b>Commands</b>',
        '/play — open the game',
        '/terms — purchase terms',
        '/support — help with the game',
        '/paysupport — help with a Stars purchase',
        '',
        'Tip: type @' + escapeHtml(cfg.botUsername || 'this_bot') + ' in any chat to invite friends to a battle.'
      ].join('\n'));
    }
    if (cmd === 'play') return send(chatId, 'Ready when you are, commander.', playButton('🎮 Play', ''));
    if (cmd === 'terms') {
      return send(chatId, TERMS_TEXT + (cfg.termsUrl ? `\n\nFull terms: ${escapeHtml(cfg.termsUrl)}` : ''));
    }
    if (cmd === 'support') {
      return send(chatId, 'Something wrong with the game? ' + (cfg.supportContact ? `Contact ${escapeHtml(cfg.supportContact)}.` : 'Reply here describing the problem and we will get back to you.'));
    }
    if (cmd === 'paysupport') {
      return send(chatId, [
        '<b>Payment support</b>',
        'Tell us what you bought and what went wrong. Include the date and, if you have it, the receipt from Telegram.',
        cfg.supportContact ? `You can also reach us at ${escapeHtml(cfg.supportContact)}.` : '',
        'We refund any purchase that was not delivered.',
        'Note: Telegram support cannot help with purchases made in this bot.'
      ].filter(Boolean).join('\n'));
    }
    if (cmd === 'refund' && cfg.adminIds.has(fromId)) {
      const [chargeId] = arg.split(/\s+/);
      const p = chargeId ? await tg.getPurchase(chargeId) : null;
      if (!p) return send(chatId, 'No purchase with that charge id.');
      if (p.refundedAt) return send(chatId, 'Already refunded.');
      await bot.call('refundStarPayment', { user_id: Number(p.telegramUserId), telegram_payment_charge_id: p.chargeId });
      await tg.markRefunded(p.chargeId);
      return send(chatId, `Refunded ${p.stars} ⭐ for ${escapeHtml(p.sku)}.`);
    }
  }

  async function handlePreCheckout(q) {
    const intent = await tg.getIntent(q.invoice_payload);
    const sku = intent ? findSku(intent.sku, env) : null;
    let error = '';
    if (!intent || !sku) error = 'This offer has expired. Open the store again.';
    else if (intent.consumedAt && sku.kind !== 'subscription') error = 'This purchase was already completed.';
    else if (String(q.from?.id) !== intent.telegramUserId) error = 'This invoice belongs to another account.';
    else if (q.currency !== 'XTR' || Number(q.total_amount) !== intent.stars) error = 'The price changed. Open the store again.';
    else if (sku.kind === 'permanent' && await tg.hasEntitlement(intent.userId, sku.sku)) error = 'You already own this item.';
    await bot.call('answerPreCheckoutQuery', error
      ? { pre_checkout_query_id: q.id, ok: false, error_message: error }
      : { pre_checkout_query_id: q.id, ok: true });
  }

  async function handleSuccessfulPayment(msg) {
    const sp = msg.successful_payment;
    const fromId = String(msg.from?.id || '');
    const intent = await tg.getIntent(sp.invoice_payload);
    let userId = intent?.userId || await tg.userIdForTelegram(fromId);
    const skuId = intent?.sku;
    const sku = skuId ? findSku(skuId, env) || { sku: skuId, kind: 'permanent' } : null;
    if (!userId || !sku) {
      // Cannot attribute the payment: refund rather than keep Stars for nothing (TOS 6.2.1).
      try {
        await bot.call('refundStarPayment', { user_id: Number(fromId), telegram_payment_charge_id: sp.telegram_payment_charge_id });
      } catch {}
      return send(msg.chat.id, 'We could not match this payment to an item, so it was refunded automatically.');
    }
    let expiresAt = null;
    if (sp.subscription_expiration_date) expiresAt = new Date(Number(sp.subscription_expiration_date) * 1000).toISOString();
    else if (sku.kind === 'timed') expiresAt = new Date(clock() + (sku.days || 30) * 86400000).toISOString();
    const r = await tg.recordPayment({
      chargeId: sp.telegram_payment_charge_id,
      intentId: intent?.id || null,
      userId,
      telegramUserId: fromId,
      sku: sku.sku,
      stars: Number(sp.total_amount) || 0,
      isRecurring: Boolean(sp.is_recurring),
      expiresAt
    });
    if (r.granted) {
      await send(msg.chat.id, `✅ <b>${escapeHtml(sku.title || sku.sku)}</b> unlocked. Thank you for supporting Charred Ground!`, playButton('🎮 Back to battle', ''));
    }
  }

  async function handleRefunded(msg) {
    const rp = msg.refunded_payment;
    if (rp?.telegram_payment_charge_id) await tg.markRefunded(rp.telegram_payment_charge_id);
  }

  async function handleInlineQuery(q) {
    const query = String(q.query || '').trim().toLowerCase();
    const results = [];
    const room = query.match(/^(?:r_|charred-)?([a-z0-9]{6})$/);
    if (room) {
      results.push(inviteArticle(room[1]));
    }
    results.push({
      type: 'article',
      id: 'play',
      title: 'Challenge this chat to Charred Ground',
      description: 'Turn-based 3D artillery for up to six commanders',
      input_message_content: { message_text: '💥 <b>Charred Ground</b> — who wants to trade shells? Tap to open the battlefield.', parse_mode: 'HTML' },
      reply_markup: deepLink(cfg, '') ? { inline_keyboard: [[{ text: '🎮 Play', url: deepLink(cfg, '') }]] } : undefined
    });
    await bot.call('answerInlineQuery', { inline_query_id: q.id, results, cache_time: 0, is_personal: true });
  }

  function inviteArticle(code) {
    const url = deepLink(cfg, `r_${code}`);
    return {
      type: 'article',
      id: `room_${code}`,
      title: `Invite to room CHARRED-${code.toUpperCase()}`,
      description: 'Friends who tap the button join your battle directly',
      input_message_content: {
        message_text: `⚔ <b>Join my Charred Ground battle!</b>\nRoom <code>CHARRED-${code.toUpperCase()}</code> — up to six commanders.`,
        parse_mode: 'HTML'
      },
      reply_markup: url ? { inline_keyboard: [[{ text: '⚔ Join the battle', url }]] } : undefined
    };
  }

  async function handleUpdate(update) {
    await ensureTg();
    if (update.pre_checkout_query) return handlePreCheckout(update.pre_checkout_query);
    if (update.inline_query) return handleInlineQuery(update.inline_query);
    const msg = update.message;
    if (!msg) return;
    if (msg.successful_payment) return handleSuccessfulPayment(msg);
    if (msg.refunded_payment) return handleRefunded(msg);
    if (typeof msg.text === 'string' && msg.text.startsWith('/')) return handleCommand(msg);
  }

  // ---- HTTP routes ---------------------------------------------------------------------------

  async function handle(req, res, { url, pathname, method }) {
    if (!OWNED.test(pathname)) return false;
    await ensureTg();
    if (method === 'GET' && pathname === '/api/telegram/config') {
      json(res, 200, {
        enabled: cfg.enabled,
        botUsername: cfg.botUsername || null,
        appLink: deepLink(cfg, '') || null,
        storeEnabled: cfg.storeEnabled,
        turnAvailable: Boolean(env.TURN_SECRET && env.TURN_URLS),
        championEmojiId: cfg.championEmojiId || null,
        aiPassRequired: cfg.aiPassRequired
      });
      return true;
    }

    if (method === 'POST' && pathname === '/api/telegram/webhook') {
      if (!requireEnabled(res)) return true;
      const given = String(req.headers['x-telegram-bot-api-secret-token'] || '');
      if (!cfg.webhookSecret || given.length !== cfg.webhookSecret.length ||
          !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(cfg.webhookSecret))) {
        json(res, 401, { error: 'Bad webhook secret.' });
        return true;
      }
      const update = await readJsonBody(req);
      try {
        await handleUpdate(update);
      } catch (err) {
        // Answer 200 anyway: Telegram retries failed deliveries, and a handler bug must not
        // turn into an endless retry loop. Payments are idempotent by charge id regardless.
        console.error('[telegram] update failed:', err.message);
      }
      json(res, 200, { ok: true });
      return true;
    }

    if (method === 'POST' && (pathname === '/api/auth/telegram' || pathname === '/api/auth/telegram/link')) {
      if (!requireEnabled(res)) return true;
      if (!checkRateLimit(req)) {
        json(res, 429, { error: 'Too many requests, please try again shortly.' });
        return true;
      }
      const body = await readJsonBody(req);
      const v = verifyInitData(String(body.initData || ''), cfg.token, { maxAgeSec: cfg.maxAgeSec, now: clock() });
      if (!v.ok) {
        json(res, 401, { error: v.reason });
        return true;
      }
      const tgUser = v.data.user;
      let user;
      let created = false;
      if (pathname.endsWith('/link')) {
        const sess = await requireSession(req, res);
        if (!sess) return true;
        const owner = await core.getUserByOAuth('telegram', tgUser.id);
        if (owner && owner.id !== sess.user.id) {
          json(res, 409, { error: 'This Telegram account is already linked to another commander.' });
          return true;
        }
        const linked = await tg.telegramIdForUser(sess.user.id);
        if (linked && linked !== tgUser.id) {
          json(res, 409, { error: 'This commander is already linked to a different Telegram account.' });
          return true;
        }
        await core.linkOAuthAccount({ userId: sess.user.id, provider: 'telegram', providerUserId: tgUser.id, email: '' });
        user = sess.user;
      } else {
        ({ user, created } = await findOrCreateUser(tgUser));
      }
      if (v.data.chatInstance) await tg.touchChatMember(v.data.chatInstance, user.id);
      const sess = await issueSessionForUser(user.id, req);
      json(res, created ? 201 : 200, {
        ok: true,
        created,
        token: sess.token,
        user: await formatSelfUser(await core.getUserById(user.id)),
        telegram: {
          startParam: v.data.startParam,
          chatInstance: v.data.chatInstance,
          chatType: v.data.chatType,
          allowsWriteToPm: tgUser.allowsWriteToPm
        }
      });
      return true;
    }

    if (method === 'GET' && pathname === '/api/telegram/leaderboard') {
      const sess = await requireSession(req, res);
      if (!sess) return true;
      const chat = String(url.searchParams.get('chatInstance') || '');
      if (!chat || !(await tg.isChatMember(chat, sess.user.id))) {
        json(res, 403, { error: 'Open the game from this chat to see its leaderboard.' });
        return true;
      }
      const rows = await tg.chatLeaderboardRows(chat, url.searchParams.get('limit'));
      json(res, 200, { leaderboard: formatLeaderboardRows(rows) });
      return true;
    }

    if (method === 'POST' && pathname === '/api/telegram/prepared') {
      if (!requireEnabled(res)) return true;
      const sess = await requireSession(req, res);
      if (!sess) return true;
      const tgId = await tg.telegramIdForUser(sess.user.id);
      if (!tgId) {
        json(res, 403, { error: 'Link Telegram to share from the game.' });
        return true;
      }
      const body = await readJsonBody(req);
      let result;
      if (body.kind === 'invite') {
        const code = String(body.roomCode || '').toLowerCase().replace(/^charred-/, '');
        if (!ROOM_RE.test(code)) {
          json(res, 400, { error: 'Invalid room code.' });
          return true;
        }
        result = inviteArticle(code);
      } else if (body.kind === 'result') {
        const winner = String(body.winner || '').slice(0, 40);
        const kills = Math.max(0, Math.min(5, Math.trunc(Number(body.kills) || 0)));
        const round = Math.max(1, Math.min(999, Math.trunc(Number(body.round) || 1)));
        const terrain = String(body.terrain || '').slice(0, 40);
        const won = Boolean(body.won);
        const lines = [
          won ? `🏆 <b>Victory in Charred Ground!</b>` : `💥 <b>Round ${round} of Charred Ground</b>`,
          winner ? `Winner: <b>${escapeHtml(winner)}</b>` : 'Nobody survived the barrage.',
          `My kills: ${kills}${terrain ? ` · ${escapeHtml(terrain)}` : ''}`
        ];
        result = {
          type: 'article',
          id: `result_${crypto.randomBytes(4).toString('hex')}`,
          title: won ? 'Share your victory' : 'Share the round result',
          input_message_content: { message_text: lines.join('\n'), parse_mode: 'HTML' },
          reply_markup: deepLink(cfg, '') ? { inline_keyboard: [[{ text: '🎮 Play Charred Ground', url: deepLink(cfg, '') }]] } : undefined
        };
      } else if (body.kind === 'challenge' || body.kind === 'map') {
        const share = await tg.getShare(String(body.shareId || ''));
        if (!share || share.ownerUserId !== sess.user.id || share.kind !== body.kind) {
          json(res, 404, { error: 'Share not found.' });
          return true;
        }
        const isMap = share.kind === 'map';
        const url2 = deepLink(cfg, `${isMap ? 'm' : 'c'}_${share.id}`);
        const name = String(share.payload?.name || (isMap ? 'Custom map' : 'Challenge')).slice(0, 40);
        result = {
          type: 'article',
          id: `${share.kind}_${share.id}`,
          title: isMap ? `Share map “${name}”` : 'Challenge a friend',
          input_message_content: {
            message_text: isMap
              ? `🗺 <b>${escapeHtml(name)}</b> — a custom Charred Ground battlefield. Tap to play it.`
              : `🎯 <b>Can you beat my battle?</b>\nSame terrain, same wind, same enemies. ${escapeHtml(name)}`,
            parse_mode: 'HTML'
          },
          reply_markup: url2 ? { inline_keyboard: [[{ text: isMap ? '🗺 Play this map' : '🎯 Accept challenge', url: url2 }]] } : undefined
        };
      } else {
        json(res, 400, { error: 'Unknown share kind.' });
        return true;
      }
      const prepared = await bot.call('savePreparedInlineMessage', {
        user_id: Number(tgId),
        result,
        allow_user_chats: true,
        allow_group_chats: true,
        allow_channel_chats: body.kind !== 'invite'
      });
      json(res, 200, { ok: true, id: prepared.id, expiresAt: prepared.expiration_date || null });
      return true;
    }

    if (method === 'POST' && pathname === '/api/telegram/turn-watch') {
      if (!requireEnabled(res)) return true;
      const sess = await requireSession(req, res);
      if (!sess) return true;
      const tgId = await tg.telegramIdForUser(sess.user.id);
      if (!tgId) {
        json(res, 403, { error: 'Link Telegram to get turn notifications.' });
        return true;
      }
      const body = await readJsonBody(req);
      const code = String(body.roomCode || '').toLowerCase().replace(/^charred-/, '');
      if (!ROOM_RE.test(code) && !/^pub-lobby-(10|[1-9])$/.test(code)) {
        json(res, 400, { error: 'Invalid room code.' });
        return true;
      }
      const w = await tg.createTurnWatch({ userId: sess.user.id, telegramUserId: tgId, roomCode: code });
      json(res, 201, { ok: true, token: w.token });
      return true;
    }

    // The host calls this when the turn passes to a commander whose Telegram app is minimised.
    // The token is the capability; the host never learns the guest's Telegram id.
    if (method === 'POST' && pathname === '/api/telegram/notify-turn') {
      if (!requireEnabled(res)) return true;
      if (!checkRateLimit(req)) {
        json(res, 429, { error: 'Too many requests.' });
        return true;
      }
      const body = await readJsonBody(req);
      const w = await tg.getTurnWatch(String(body.token || ''));
      if (!w) {
        json(res, 404, { error: 'Unknown watch.' });
        return true;
      }
      if (w.lastNotifiedAt && clock() - Date.parse(w.lastNotifiedAt) < TURN_NOTIFY_GAP_MS) {
        json(res, 200, { ok: true, sent: false, reason: 'throttled' });
        return true;
      }
      if (clock() - Date.parse(w.createdAt) > 12 * 3600 * 1000) {
        json(res, 410, { error: 'Watch expired.' });
        return true;
      }
      await tg.markTurnNotified(w.token);
      const param = ROOM_RE.test(w.roomCode) ? `r_${w.roomCode}` : '';
      try {
        await send(w.telegramUserId, `🎯 <b>Your turn, commander!</b> Room <code>${escapeHtml(('CHARRED-' + w.roomCode).toUpperCase())}</code> is waiting for your shot.`, playButton('🎯 Take my turn', param));
        json(res, 200, { ok: true, sent: true });
      } catch (err) {
        // 403: the player has not allowed the bot to message them.
        json(res, 200, { ok: true, sent: false, reason: err.telegramCode === 403 ? 'blocked' : 'failed' });
      }
      return true;
    }

    if (method === 'POST' && pathname === '/api/shares') {
      const sess = await requireSession(req, res);
      if (!sess) return true;
      let body;
      try {
        body = JSON.parse((await readRawBody(req, MAX_SHARE_BYTES + 1024)).toString('utf8') || '{}');
      } catch (err) {
        json(res, err.status || 400, { error: err.status === 413 ? 'Share payload too large.' : 'Invalid JSON body' });
        return true;
      }
      if (body.kind !== 'map' && body.kind !== 'challenge') {
        json(res, 400, { error: 'kind must be map or challenge.' });
        return true;
      }
      const payload = body.payload;
      const size = Buffer.byteLength(JSON.stringify(payload ?? null));
      if (!payload || typeof payload !== 'object' || size > MAX_SHARE_BYTES) {
        json(res, 400, { error: 'Share payload missing or too large.' });
        return true;
      }
      const share = await tg.createShare({ kind: body.kind, ownerUserId: sess.user.id, payload });
      json(res, 201, { ok: true, id: share.id, link: deepLink(cfg, `${body.kind === 'map' ? 'm' : 'c'}_${share.id}`) || null });
      return true;
    }

    const shareMatch = pathname.match(/^\/api\/shares\/([A-Za-z0-9_-]{4,24})$/);
    if (method === 'GET' && shareMatch) {
      const share = await tg.getShare(shareMatch[1]);
      if (!share) {
        json(res, 404, { error: 'Share not found.' });
        return true;
      }
      const owner = await core.getUserById(share.ownerUserId);
      json(res, 200, { id: share.id, kind: share.kind, payload: share.payload, owner: owner ? (owner.displayName || owner.username) : null, createdAt: share.createdAt });
      return true;
    }

    if (method === 'POST' && pathname === '/api/telegram/story-image') {
      const sess = await requireSession(req, res);
      if (!sess) return true;
      const type = String(req.headers['content-type'] || '').split(';')[0].trim();
      if (type !== 'image/jpeg' && type !== 'image/png') {
        json(res, 415, { error: 'Send a JPEG or PNG image.' });
        return true;
      }
      const buf = await readRawBody(req, MAX_IMAGE_BYTES);
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
      const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      if (!(isJpeg && type === 'image/jpeg') && !(isPng && type === 'image/png')) {
        json(res, 400, { error: 'Image data does not match its type.' });
        return true;
      }
      pruneImages();
      const id = crypto.randomBytes(12).toString('hex');
      images.set(id, { buf, type, expiresAt: clock() + IMAGE_TTL_MS });
      const ext = type === 'image/png' ? 'png' : 'jpg';
      const rel = `/api/media/${id}.${ext}`;
      json(res, 201, { ok: true, url: cfg.publicBaseUrl ? cfg.publicBaseUrl + rel : rel });
      return true;
    }

    const mediaMatch = pathname.match(/^\/api\/media\/([0-9a-f]{24})\.(jpg|png)$/);
    if (method === 'GET' && mediaMatch) {
      pruneImages();
      const img = images.get(mediaMatch[1]);
      if (!img) {
        json(res, 404, { error: 'Image expired.' });
        return true;
      }
      res.writeHead(200, { 'Content-Type': img.type, 'Cache-Control': 'public, max-age=3600', 'Content-Length': img.buf.length });
      res.end(img.buf);
      return true;
    }

    // Short-lived TURN credentials (coturn "use-auth-secret" / TURN REST API scheme), so phones
    // on carrier-grade NAT can still connect peer to peer.
    if (method === 'GET' && pathname === '/api/turn') {
      const sess = await requireSession(req, res);
      if (!sess) return true;
      const secret = String(env.TURN_SECRET || '');
      const urls = String(env.TURN_URLS || '').split(',').map(s => s.trim()).filter(s => /^turns?:/.test(s));
      if (!secret || !urls.length) {
        json(res, 503, { error: 'No TURN relay is configured.' });
        return true;
      }
      const ttl = Math.min(86400, Math.max(600, Number(env.TURN_TTL_SEC) || 6 * 3600));
      const username = `${Math.floor(clock() / 1000) + ttl}:${sess.user.id}`;
      const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
      json(res, 200, { iceServers: [{ urls, username, credential }], ttl });
      return true;
    }

    // ---- Stars store -------------------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/store/catalog') {
      json(res, 200, {
        enabled: cfg.storeEnabled,
        currency: 'XTR',
        items: getCatalog(env).map(s => ({ sku: s.sku, kind: s.kind, stars: s.stars, title: s.title, description: s.description, grants: s.grants, days: s.days || null }))
      });
      return true;
    }

    if (method === 'GET' && pathname === '/api/store/entitlements') {
      const sess = await requireSession(req, res);
      if (!sess) return true;
      json(res, 200, summarizeEntitlements(await tg.listEntitlements(sess.user.id), env));
      return true;
    }

    if (method === 'POST' && pathname === '/api/store/invoice') {
      if (!requireEnabled(res)) return true;
      if (!cfg.storeEnabled) {
        json(res, 503, { error: 'The store is closed.' });
        return true;
      }
      const sess = await requireSession(req, res);
      if (!sess) return true;
      const tgId = await tg.telegramIdForUser(sess.user.id);
      if (!tgId) {
        json(res, 403, { error: 'Purchases are made with Telegram Stars. Open the game in Telegram to buy.' });
        return true;
      }
      const body = await readJsonBody(req);
      const sku = findSku(String(body.sku || ''), env);
      if (!sku) {
        json(res, 404, { error: 'Unknown item.' });
        return true;
      }
      if (sku.kind === 'permanent' && await tg.hasEntitlement(sess.user.id, sku.sku)) {
        json(res, 409, { error: 'You already own this item.' });
        return true;
      }
      if (sku.kind === 'subscription' && await tg.hasEntitlement(sess.user.id, sku.sku)) {
        json(res, 409, { error: 'Your subscription is already active.' });
        return true;
      }
      const intent = await tg.createIntent({ userId: sess.user.id, telegramUserId: tgId, sku: sku.sku, stars: sku.stars });
      const params = {
        title: sku.title.slice(0, 32),
        description: sku.description.slice(0, 255),
        payload: intent.id,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: sku.title.slice(0, 32), amount: sku.stars }]
      };
      if (sku.kind === 'subscription') params.subscription_period = SUBSCRIPTION_PERIOD;
      const link = await bot.call('createInvoiceLink', params);
      json(res, 201, { ok: true, link, sku: sku.sku, stars: sku.stars });
      return true;
    }

    return false;
  }

  // Server AI gate: when TELEGRAM_AI_PASS_REQUIRED is on, Telegram-linked players need the pass.
  async function aiAllowed(user) {
    if (!cfg.aiPassRequired) return true;
    const t = await ensureTg();
    const tgId = await t.telegramIdForUser(user.id);
    if (!tgId) return true;
    return (await t.hasEntitlement(user.id, 'ai_pass_30d')) || (await t.hasEntitlement(user.id, 'supporter'));
  }

  return { handle, handleUpdate, aiAllowed, bot, cfg, images };
}

module.exports = {
  verifyInitData,
  signInitData,
  createBotApi,
  createTelegramService,
  telegramConfig,
  deepLink,
  TERMS_TEXT
};
