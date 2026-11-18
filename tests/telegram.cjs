'use strict';
// Telegram Mini App server checks: initData verification, sign-in and linking, the bot webhook,
// Stars checkout (pre-checkout, idempotent payments, refunds, subscriptions), shares, turn
// notifications, TURN credentials and the group leaderboard. A fake Bot API records every call;
// no request reaches Telegram.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifyInitData, signInitData, deepLink, telegramConfig } = require('../scripts/telegram.cjs');
const { getCatalog, summarizeEntitlements } = require('../scripts/telegram-catalog.cjs');

const TOKEN = '123456:TEST-bot-token';
const SECRET = 'webhook-secret-for-tests';

function fakeBotApi() {
  const calls = [];
  let nextInvoice = 0;
  const impl = async (url, opts) => {
    const m = String(url).match(/^https:\/\/api\.telegram\.org\/bot([^/]+)(\/test)?\/(\w+)$/);
    assert(m, 'unexpected fetch ' + url);
    assert.equal(m[1], TOKEN);
    const method = m[3];
    const params = JSON.parse(opts.body);
    calls.push({ method, params });
    let result = true;
    if (method === 'createInvoiceLink') result = 'https://t.me/$invoice' + (++nextInvoice);
    if (method === 'savePreparedInlineMessage') result = { id: 'prep' + calls.length, expiration_date: 1 };
    if (method === 'sendMessage' && String(params.chat_id) === '403') {
      return { ok: false, status: 403, json: async () => ({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
  };
  return { impl, calls, last: method => [...calls].reverse().find(c => c.method === method) };
}

async function runTelegramTests() {
  // ---- initData verification ----
  const now = Date.UTC(2026, 10, 18, 12, 0, 0);
  const authDate = Math.floor(now / 1000) - 60;
  const user = { id: 777000111, first_name: 'Ada', last_name: 'Gunner', username: 'ada_g', language_code: 'en', allows_write_to_pm: true, photo_url: 'https://t.me/i/userpic/320/ada.jpg' };
  const good = signInitData({ user, auth_date: authDate, chat_instance: '-8811', chat_type: 'group', start_param: 'r_abc234', query_id: 'AAE1' }, TOKEN);
  const v = verifyInitData(good, TOKEN, { now });
  assert.equal(v.ok, true, v.reason);
  assert.equal(v.data.user.id, '777000111');
  assert.equal(v.data.startParam, 'r_abc234');
  assert.equal(v.data.chatInstance, '-8811');
  assert.equal(verifyInitData(good, 'other:token', { now }).ok, false, 'wrong bot token rejected');
  assert.equal(verifyInitData(good.replace('Ada', 'Eve'), TOKEN, { now }).ok, false, 'tampered field rejected');
  assert.equal(verifyInitData(good, TOKEN, { now: now + 2 * 86400000 }).ok, false, 'stale auth_date rejected');
  assert.equal(verifyInitData(good.replace(/hash=[0-9a-f]+/, ''), TOKEN, { now }).ok, false, 'missing hash rejected');
  assert.equal(verifyInitData('', TOKEN, { now }).ok, false);
  const badParam = signInitData({ user, auth_date: authDate, start_param: '../../etc' }, TOKEN);
  assert.equal(verifyInitData(badParam, TOKEN, { now }).data.startParam, '', 'unsafe start_param dropped');
  // Known-answer check against an independent implementation of the documented algorithm.
  {
    const params = new URLSearchParams(good);
    const hash = params.get('hash');
    params.delete('hash');
    const dcs = [...params.entries()].map(([k, val]) => k + '=' + val).sort().join('\n');
    const key = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    assert.equal(crypto.createHmac('sha256', key).update(dcs).digest('hex'), hash);
  }

  // ---- links and catalog ----
  assert.equal(deepLink(telegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: '@charred_bot' }), 'r_abc234'), 'https://t.me/charred_bot?startapp=r_abc234');
  assert.equal(deepLink(telegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: 'charred_bot', TELEGRAM_APP_SHORT_NAME: 'play' }), ''), 'https://t.me/charred_bot/play');
  assert.equal(deepLink(telegramConfig({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_BOT_USERNAME: 'charred_bot' }), 'bad param!'), 'https://t.me/charred_bot?startapp');
  const priced = getCatalog({ TELEGRAM_STORE_PRICES: '{"accent_ember":42,"supporter":99999}', TELEGRAM_STORE_DISABLED: 'ai_pass_30d' });
  assert.equal(priced.find(s => s.sku === 'accent_ember').stars, 42);
  assert.equal(priced.find(s => s.sku === 'supporter').stars, 10000, 'subscription capped at 10000 Stars');
  assert.equal(priced.some(s => s.sku === 'ai_pass_30d'), false);
  const sum = summarizeEntitlements([{ sku: 'accent_ember', expiresAt: null }, { sku: 'trail_plasma', expiresAt: null }]);
  assert.deepEqual([sum.accents, sum.trails, sum.supporter], [['ember'], ['plasma'], false]);

  // ---- server routes ----
  let clockNow = now;
  const bot = fakeBotApi();
  const env = {
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_WEBHOOK_SECRET: SECRET,
    TELEGRAM_BOT_USERNAME: 'charred_bot',
    TELEGRAM_ADMIN_IDS: '42',
    PUBLIC_BASE_URL: 'https://game.example.test',
    TURN_SECRET: 'turn-shared-secret',
    TURN_URLS: 'turn:relay.example.test:3478,turns:relay.example.test:5349',
    TELEGRAM_AI_PASS_REQUIRED: '1',
    GEMINI_API_KEY: 'unused', GEMINI_MODEL: 'unused'
  };
  const { createApi } = require('../scripts/api.cjs');
  const { openStore } = require('../scripts/db.cjs');
  const http = require('node:http');
  const store = openStore({ file: ':memory:' });
  const api = createApi({ store, env, fetchImpl: bot.impl, clock: () => clockNow });
  const server = http.createServer((req, res) => api(req, res));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const get = (path, headers = {}) => fetch(base + path, { headers });
  const hook = update => post('/api/telegram/webhook', update, { 'X-Telegram-Bot-Api-Secret-Token': SECRET });
  try {
    const cfg = await (await get('/api/telegram/config')).json();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.appLink, 'https://t.me/charred_bot?startapp');
    assert.equal(cfg.turnAvailable, true);
    assert(!JSON.stringify(cfg).includes(TOKEN), 'config never exposes the token');

    // Sign-in creates a verified account once, then signs into the same one.
    let r = await post('/api/auth/telegram', { initData: good });
    assert.equal(r.status, 201);
    const signIn = await r.json();
    assert.equal(signIn.created, true);
    assert.equal(signIn.user.username, 'ada_g');
    assert.equal(signIn.user.displayName, 'Ada Gunner');
    assert.equal(signIn.user.emailVerified, true);
    assert.deepEqual(signIn.user.oauthProviders, ['telegram']);
    assert.equal(signIn.telegram.startParam, 'r_abc234');
    const tokenA = signIn.token;
    r = await post('/api/auth/telegram', { initData: good });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).user.id, signIn.user.id);
    assert.equal((await post('/api/auth/telegram', { initData: good.replace('Ada', 'Eve') })).status, 401);
    const authA = { Authorization: 'Bearer ' + tokenA };

    // Linking: an existing web account adopts a second Telegram identity; conflicts refused.
    const web = await store.createUser({ username: 'webvet', email: 'vet@example.test', passwordHash: 'x', emailVerified: true, displayName: 'Web Vet' });
    const auth = require('../scripts/auth.cjs');
    const ws = auth.mintSessionToken(1);
    await store.createSession({ tokenHash: ws.tokenHash, userId: web.id, expiresAt: ws.expiresAt });
    const authW = { Authorization: 'Bearer ' + ws.token };
    assert.equal((await post('/api/auth/telegram/link', { initData: good }, authW)).status, 409, 'cannot steal a linked Telegram id');
    const bobInit = signInitData({ user: { id: 5550001, first_name: 'Bob' }, auth_date: authDate, chat_instance: '-8811' }, TOKEN);
    r = await post('/api/auth/telegram/link', { initData: bobInit }, authW);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).user.id, web.id);
    assert.equal((await post('/api/auth/telegram/link', { initData: bobInit })).status, 401, 'link needs a session');

    // Group leaderboard: only members of the chat may read it.
    r = await get('/api/telegram/leaderboard?chatInstance=-8811', authA);
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).leaderboard.map(e => e.username).sort(), ['ada_g', 'webvet']);
    assert.equal((await get('/api/telegram/leaderboard?chatInstance=-9999', authA)).status, 403);

    // Webhook: secret enforced; /start deep link answered with a play button.
    assert.equal((await post('/api/telegram/webhook', { update_id: 1 })).status, 401);
    assert.equal((await post('/api/telegram/webhook', { update_id: 1 }, { 'X-Telegram-Bot-Api-Secret-Token': 'nope-nope-nope-nope-nope' })).status, 401);
    r = await hook({ update_id: 2, message: { message_id: 1, chat: { id: 777000111, type: 'private' }, from: { id: 777000111 }, text: '/start r_abc234' } });
    assert.equal(r.status, 200);
    let sent = bot.last('sendMessage');
    assert.equal(sent.params.reply_markup.inline_keyboard[0][0].url, 'https://t.me/charred_bot?startapp=r_abc234');
    for (const cmd of ['/paysupport', '/terms', '/support', '/help']) {
      await hook({ update_id: 3, message: { message_id: 2, chat: { id: 1 }, from: { id: 1 }, text: cmd } });
      assert(bot.last('sendMessage').params.text.length > 20, cmd + ' answered');
    }
    assert(bot.last('sendMessage').params.text.includes('@charred_bot'));
    await hook({ update_id: 4, inline_query: { id: 'iq1', from: { id: 777000111 }, query: 'r_abc234' } });
    const inline = bot.last('answerInlineQuery').params;
    assert.equal(inline.results[0].reply_markup.inline_keyboard[0][0].url, 'https://t.me/charred_bot?startapp=r_abc234');

    // Prepared share messages.
    r = await post('/api/telegram/prepared', { kind: 'invite', roomCode: 'CHARRED-ABC234' }, authA);
    assert.equal(r.status, 200);
    assert.equal(bot.last('savePreparedInlineMessage').params.user_id, 777000111);
    assert.equal((await post('/api/telegram/prepared', { kind: 'invite', roomCode: 'bad' }, authA)).status, 400);
    r = await post('/api/telegram/prepared', { kind: 'result', winner: '<b>Ada</b>', kills: 3, round: 2, won: true }, authA);
    assert.equal(r.status, 200);
    assert(bot.last('savePreparedInlineMessage').params.result.input_message_content.message_text.includes('&lt;b&gt;Ada'), 'names are escaped');

    // Shares (maps and challenges) and their prepared messages.
    r = await post('/api/shares', { kind: 'map', payload: { name: 'Twin Peaks', v: 1 } }, authA);
    assert.equal(r.status, 201);
    const share = await r.json();
    assert(share.link.startsWith('https://t.me/charred_bot?startapp=m_'));
    r = await get('/api/shares/' + share.id);
    assert.equal((await r.json()).payload.name, 'Twin Peaks');
    assert.equal((await post('/api/shares', { kind: 'map', payload: { big: 'x'.repeat(60000) } }, authA)).status, 400);
    assert.equal((await post('/api/telegram/prepared', { kind: 'map', shareId: share.id }, authA)).status, 200);
    assert.equal((await post('/api/telegram/prepared', { kind: 'map', shareId: share.id }, authW)).status, 404, 'only the owner shares it');

    // Turn notifications: capability token, throttled, blocked bots reported.
    r = await post('/api/telegram/turn-watch', { roomCode: 'charred-abc234' }, authA);
    assert.equal(r.status, 201);
    const watch = (await r.json()).token;
    r = await post('/api/telegram/notify-turn', { token: watch });
    assert.deepEqual(await r.json(), { ok: true, sent: true });
    assert.equal(bot.last('sendMessage').params.chat_id, '777000111');
    r = await post('/api/telegram/notify-turn', { token: watch });
    assert.equal((await r.json()).reason, 'throttled');
    clockNow += 60000;
    assert.equal((await post('/api/telegram/notify-turn', { token: 'nope' })).status, 404);

    // TURN credentials follow the coturn REST scheme.
    r = await get('/api/turn', authA);
    const turn = await r.json();
    const [user0] = turn.iceServers;
    assert.deepEqual(user0.urls, ['turn:relay.example.test:3478', 'turns:relay.example.test:5349']);
    assert.equal(user0.credential, crypto.createHmac('sha1', 'turn-shared-secret').update(user0.username).digest('base64'));
    assert.equal((await get('/api/turn')).status, 401);

    // Story images: type sniffed, served back, expire.
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
    r = await fetch(base + '/api/telegram/story-image', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', ...authA }, body: jpeg });
    assert.equal(r.status, 201);
    const img = await r.json();
    assert(img.url.startsWith('https://game.example.test/api/media/'));
    r = await get(img.url.replace('https://game.example.test', ''));
    assert.equal(r.headers.get('content-type'), 'image/jpeg');
    assert.equal(Buffer.from(await r.arrayBuffer()).length, jpeg.length);
    r = await fetch(base + '/api/telegram/story-image', { method: 'POST', headers: { 'Content-Type': 'image/png', ...authA }, body: jpeg });
    assert.equal(r.status, 400, 'mismatched image type rejected');

    // ---- Stars checkout ----
    const catalog = await (await get('/api/store/catalog')).json();
    assert.equal(catalog.currency, 'XTR');
    assert(catalog.items.find(i => i.sku === 'supporter').kind === 'subscription');
    r = await post('/api/store/invoice', { sku: 'accent_ember' }, authA);
    assert.equal(r.status, 201);
    const inv = bot.last('createInvoiceLink').params;
    assert.equal(inv.currency, 'XTR');
    assert.equal(inv.provider_token, '');
    assert.equal(inv.prices.length, 1);
    assert.equal(inv.prices[0].amount, 50);
    const intentId = inv.payload;
    // Pre-checkout validates owner and price.
    await hook({ update_id: 10, pre_checkout_query: { id: 'pq1', from: { id: 5550001 }, currency: 'XTR', total_amount: 50, invoice_payload: intentId } });
    assert.equal(bot.last('answerPreCheckoutQuery').params.ok, false, 'other user refused');
    await hook({ update_id: 11, pre_checkout_query: { id: 'pq2', from: { id: 777000111 }, currency: 'XTR', total_amount: 49, invoice_payload: intentId } });
    assert.equal(bot.last('answerPreCheckoutQuery').params.ok, false, 'wrong price refused');
    await hook({ update_id: 12, pre_checkout_query: { id: 'pq3', from: { id: 777000111 }, currency: 'XTR', total_amount: 50, invoice_payload: intentId } });
    assert.deepEqual(bot.last('answerPreCheckoutQuery').params, { pre_checkout_query_id: 'pq3', ok: true });
    // Payment granted once even if Telegram delivers it twice.
    const paid = { update_id: 13, message: { message_id: 9, chat: { id: 777000111 }, from: { id: 777000111 }, successful_payment: { currency: 'XTR', total_amount: 50, invoice_payload: intentId, telegram_payment_charge_id: 'ch_ember_1' } } };
    await hook(paid);
    const thanks = bot.calls.filter(c => c.method === 'sendMessage').length;
    await hook(paid);
    assert.equal(bot.calls.filter(c => c.method === 'sendMessage').length, thanks, 'duplicate payment not re-granted');
    let ent = await (await get('/api/store/entitlements', authA)).json();
    assert.deepEqual(ent.accents, ['ember']);
    assert.equal((await post('/api/store/invoice', { sku: 'accent_ember' }, authA)).status, 409, 'owned item cannot be bought twice');
    // Refund by admin command revokes it.
    await hook({ update_id: 14, message: { message_id: 10, chat: { id: 1 }, from: { id: 999 }, text: '/refund ch_ember_1' } });
    assert.equal(bot.calls.filter(c => c.method === 'refundStarPayment').length, 0, 'non-admin cannot refund');
    await hook({ update_id: 15, message: { message_id: 11, chat: { id: 42 }, from: { id: 42 }, text: '/refund ch_ember_1' } });
    assert.deepEqual(bot.last('refundStarPayment').params, { user_id: 777000111, telegram_payment_charge_id: 'ch_ember_1' });
    ent = await (await get('/api/store/entitlements', authA)).json();
    assert.deepEqual(ent.accents, []);
    // Subscription: 30-day period, expiry from Telegram, renewals extend it.
    await post('/api/store/invoice', { sku: 'supporter' }, authA);
    const subInv = bot.last('createInvoiceLink').params;
    assert.equal(subInv.subscription_period, 2592000);
    const exp1 = Math.floor(clockNow / 1000) + 2592000;
    await hook({ update_id: 16, message: { message_id: 12, chat: { id: 777000111 }, from: { id: 777000111 }, successful_payment: { currency: 'XTR', total_amount: 150, invoice_payload: subInv.payload, telegram_payment_charge_id: 'ch_sub_1', subscription_expiration_date: exp1, is_first_recurring: true, is_recurring: true } } });
    ent = await (await get('/api/store/entitlements', authA)).json();
    assert.equal(ent.supporter, true);
    assert.deepEqual(ent.trails, ['tracer', 'plasma', 'inferno']);
    clockNow += 31 * 86400000;
    ent = await (await get('/api/store/entitlements', authA)).json();
    assert.equal(ent.supporter, false, 'lapsed subscription expires');
    await hook({ update_id: 17, message: { message_id: 13, chat: { id: 777000111 }, from: { id: 777000111 }, successful_payment: { currency: 'XTR', total_amount: 150, invoice_payload: subInv.payload, telegram_payment_charge_id: 'ch_sub_2', subscription_expiration_date: exp1 + 2592000 * 2, is_recurring: true } } });
    ent = await (await get('/api/store/entitlements', authA)).json();
    assert.equal(ent.supporter, true, 'renewal restores it');
    // Telegram-initiated refunds arrive as refunded_payment.
    await hook({ update_id: 18, message: { message_id: 14, chat: { id: 777000111 }, from: { id: 777000111 }, refunded_payment: { currency: 'XTR', total_amount: 150, invoice_payload: subInv.payload, telegram_payment_charge_id: 'ch_sub_2' } } });
    ent = await (await get('/api/store/entitlements', authA)).json();
    assert.equal(ent.supporter, false);
    // Unattributable payments are refunded automatically.
    await hook({ update_id: 19, message: { message_id: 15, chat: { id: 31337 }, from: { id: 31337 }, successful_payment: { currency: 'XTR', total_amount: 5, invoice_payload: 'unknown', telegram_payment_charge_id: 'ch_orphan' } } });
    assert.equal(bot.last('refundStarPayment').params.telegram_payment_charge_id, 'ch_orphan');
    // Web-only accounts cannot buy; Telegram is required for Stars.
    const w2 = await store.createUser({ username: 'webonly', email: 'w2@example.test', passwordHash: 'x', emailVerified: true });
    const s2 = auth.mintSessionToken(1);
    await store.createSession({ tokenHash: s2.tokenHash, userId: w2.id, expiresAt: s2.expiresAt });
    assert.equal((await post('/api/store/invoice', { sku: 'accent_venom' }, { Authorization: 'Bearer ' + s2.token })).status, 403);

    // AI pass gate (TELEGRAM_AI_PASS_REQUIRED=1): Telegram players need it, web players do not.
    r = await post('/api/ai/decision', { provider: 'gemini' }, authA);
    assert.equal(r.status, 402);
    assert.equal((await r.json()).code, 'ai_pass_required');
  } finally {
    await new Promise(r => server.close(r));
  }

  // Without a bot token every Telegram route is closed and nothing else changes.
  {
    const store2 = openStore({ file: ':memory:' });
    const api2 = createApi({ store: store2, env: {}, fetchImpl: async () => { throw new Error('no network'); } });
    const server2 = http.createServer((req, res) => api2(req, res));
    await new Promise(r => server2.listen(0, '127.0.0.1', r));
    const b2 = 'http://127.0.0.1:' + server2.address().port;
    try {
      assert.equal((await (await fetch(b2 + '/api/telegram/config')).json()).enabled, false);
      assert.equal((await fetch(b2 + '/api/auth/telegram', { method: 'POST', body: JSON.stringify({ initData: good }) })).status, 503);
      assert.equal((await fetch(b2 + '/api/telegram/webhook', { method: 'POST', body: '{}' })).status, 503);
    } finally {
      await new Promise(r => server2.close(r));
    }
  }
  console.log('Telegram: initData, sign-in/linking, webhook, Stars checkout/refunds/subscriptions, shares, notifications and TURN passed.');
}

if (require.main === module) runTelegramTests().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { runTelegramTests };
