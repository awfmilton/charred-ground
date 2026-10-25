'use strict';

const crypto = require('node:crypto');
const auth = require('./auth.cjs');
const { publicProfile } = require('./db.cjs');

const MAX_BODY_BYTES = 64 * 1024;
const SESSION_COOKIE = 'cg_session';

const ALLOWED_WEAPONS = new Set([
  'Baby Missile', 'Missile', 'Baby Nuke', 'Nuke', 'MIRV', "Death's Head",
  'LeapFrog', 'Funky Bomb', 'Roller', 'Heavy Roller', 'Digger', 'Sandhog',
  'Dirt Ball', 'Ton of Dirt', 'Liquid Dirt', 'Riot Bomb', 'Napalm', 'Hot Napalm',
  'Laser', 'Plasma Blast', 'Standard Shield', 'Force Shield', 'Heavy Shield',
  'Mag Deflector', 'Battery', 'Parachute', 'Fuel Tank', 'Reinforced Bunker Wall',
  'Blast Canopy Dome', 'CIWS Point-Defense Turret', 'Repair Depot',
  'FPV Kamikaze Drone', 'Hunter-Killer Gunship Drone', 'EMP Shield-Breaker Drone'
]);

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        aborted = true;
        const err = new Error('Payload too large');
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      if (total === 0) {
        resolve({});
        return;
      }
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(text));
      } catch {
        const err = new Error('Invalid JSON body');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', err => {
      if (!aborted) reject(err);
    });
  });
}

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function extractSessionToken(req) {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers['cookie']);
  return cookies[SESSION_COOKIE] || null;
}

function isLocalhostRequest(req) {
  const rawHost = String(req?.headers?.host || '').trim().toLowerCase();
  if (!rawHost) return false;
  let host = rawHost;
  if (rawHost.startsWith('[')) {
    const endIdx = rawHost.indexOf(']');
    host = endIdx !== -1 ? rawHost.slice(0, endIdx + 1) : rawHost;
  } else {
    host = rawHost.split(':')[0];
  }
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function makeSessionCookie(token, maxAgeSeconds, req) {
  const secureAttr = isLocalhostRequest(req) ? '' : '; Secure';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureAttr}`;
}

function clearSessionCookie(req) {
  const secureAttr = isLocalhostRequest(req) ? '' : '; Secure';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureAttr}`;
}

function getTrustedProxyHops(env) {
  const raw = env?.TRUST_PROXY;
  if (raw === true) return 1;
  const val = String(raw ?? '').trim().toLowerCase();
  if (!val || val === '0' || val === 'false' || val === 'no' || val === 'off') return 0;
  if (val === 'true' || val === 'yes' || val === 'on') return 1;
  const n = Number(val);
  if (Number.isInteger(n) && n > 0) return n;
  return 0;
}

function getClientIp(req, env) {
  const hops = getTrustedProxyHops(env);
  if (hops > 0) {
    const xff = req?.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      const parts = xff
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (parts.length >= hops) {
        return parts[parts.length - hops];
      }
    }
  }
  return req?.socket?.remoteAddress || '127.0.0.1';
}

function sanitizeUsername(raw) {
  const clean = String(raw || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean.slice(0, 24) || 'commander';
}

function validateCustomFields(customFields) {
  if (customFields === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(customFields)) {
    return { ok: false, error: 'customFields must be an array' };
  }
  if (customFields.length > 2) {
    return { ok: false, error: 'At most 2 custom fields are allowed' };
  }
  const normalized = [];
  for (let i = 0; i < customFields.length; i++) {
    const item = customFields[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `customFields[${i}] must be an object` };
    }
    const name = String(item.name ?? '');
    const value = String(item.value ?? '');
    if (name.length > 80) {
      return { ok: false, error: `Custom field name exceeds 80 characters` };
    }
    if (value.length > 175) {
      return { ok: false, error: `Custom field value exceeds 175 characters` };
    }
    if (name.trim().length === 0 && value.trim().length === 0) continue;
    if (name.trim().length === 0) {
      return { ok: false, error: 'Custom field name cannot be empty when a value is set' };
    }
    normalized.push({ name: name.trim(), value });
  }
  return { ok: true, value: normalized };
}

function validateAndCanonicalizeAttestation(match, body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'Invalid attestation payload' };
  }
  if (!body.nonce || String(body.nonce) !== match.nonce) {
    return { ok: false, reason: 'Invalid or mismatched match nonce' };
  }
  if (match.nonceUsed || match.status !== 'pending') {
    return { ok: false, reason: 'Match nonce already consumed or match finalized' };
  }

  const participants = match.participants || [];
  if (participants.length < 2 || participants.length > 6) {
    return { ok: false, reason: 'Participant count out of bounds (2-6)' };
  }

  const durationMs = Number(body.durationMs ?? 5000);
  if (!Number.isFinite(durationMs) || durationMs < 200 || durationMs > 2 * 3600 * 1000) {
    return { ok: false, reason: 'Elapsed match duration out of bounds' };
  }

  const actionLog = Array.isArray(body.actionLog) ? body.actionLog : [];
  if (actionLog.length === 0 || actionLog.length > 2000) {
    return { ok: false, reason: 'Action log empty or exceeds maximum length' };
  }

  for (let i = 0; i < actionLog.length; i++) {
    const entry = actionLog[i];
    if (!entry || typeof entry !== 'object') {
      return { ok: false, reason: `Action log entry ${i} invalid` };
    }
    const actor = Number(entry.actor ?? entry.slot ?? 0);
    if (!Number.isInteger(actor) || actor < 0 || actor >= participants.length) {
      return { ok: false, reason: `Action log entry ${i} has out-of-range actor` };
    }
    const kind = String(entry.action || 'fire');
    if (kind === 'move') {
      const dx = Number(entry.dx ?? 0);
      if (!Number.isFinite(dx) || Math.abs(dx) > 4) {
        return { ok: false, reason: `Invalid move delta at action ${i}` };
      }
      continue;
    }
    const weapon = String(entry.weaponOrItem || '');
    if (!ALLOWED_WEAPONS.has(weapon)) {
      return { ok: false, reason: `Disallowed weapon or item: ${weapon}` };
    }
    const angle = Number(entry.angle);
    const power = Number(entry.power);
    const az = Number(entry.az ?? 0);
    if (!Number.isFinite(angle) || angle < 0 || angle > 180) {
      return { ok: false, reason: `Invalid firing angle at action ${i}` };
    }
    if (!Number.isFinite(power) || power < 0 || power > 1000) {
      return { ok: false, reason: `Invalid firing power at action ${i}` };
    }
    if (!Number.isFinite(az) || az < -20 || az > 20) {
      return { ok: false, reason: `Invalid azimuth at action ${i}` };
    }
  }

  const outcomes = Array.isArray(body.outcomes) ? body.outcomes : [];
  if (outcomes.length !== participants.length) {
    return { ok: false, reason: 'Outcomes length does not match match participant roster' };
  }

  const normalizedOutcomes = [];
  let totalKills = 0;
  let deadTanks = 0;
  let aliveSlots = [];

  for (let i = 0; i < participants.length; i++) {
    const item = outcomes.find(o => Number(o.slot) === i) || outcomes[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, reason: `Missing outcome for slot ${i}` };
    }
    const slot = Number(item.slot ?? i);
    const kills = Number(item.kills ?? 0);
    const finalHp = Number(item.finalHp ?? 0);
    if (slot !== i || !Number.isInteger(kills) || kills < 0 || kills >= participants.length) {
      return { ok: false, reason: `Invalid kills count for slot ${i}` };
    }
    if (!Number.isFinite(finalHp) || finalHp < 0 || finalHp > 100) {
      return { ok: false, reason: `Invalid finalHp for slot ${i}` };
    }
    totalKills += kills;
    if (finalHp <= 0) deadTanks++;
    else aliveSlots.push(slot);

    normalizedOutcomes.push({
      slot,
      kills,
      finalHp: Math.round(finalHp),
      won: false
    });
  }

  if (aliveSlots.length > 1) {
    return { ok: false, reason: 'Match cannot finish while multiple tanks remain alive' };
  }
  if (totalKills > deadTanks) {
    return { ok: false, reason: 'Kill count conservation violated (kills exceed destroyed tanks)' };
  }

  const declaredWinnerSlot =
    body.winnerSlot === null || body.winnerSlot === undefined ? null : Number(body.winnerSlot);
  const expectedWinnerSlot = aliveSlots.length === 1 ? aliveSlots[0] : null;
  if (declaredWinnerSlot !== expectedWinnerSlot) {
    return { ok: false, reason: 'Declared winnerSlot does not match surviving tank state' };
  }

  for (const o of normalizedOutcomes) {
    o.won = expectedWinnerSlot !== null && o.slot === expectedWinnerSlot;
  }

  const canonicalObj = {
    matchId: match.id,
    nonce: match.nonce,
    round: match.roundNumber,
    winnerSlot: expectedWinnerSlot,
    outcomes: normalizedOutcomes.map(o => ({
      slot: o.slot,
      kills: o.kills,
      alive: o.finalHp > 0,
      won: o.won
    }))
  };
  const canonicalHash = auth.sha256Hex(JSON.stringify(canonicalObj));

  return {
    ok: true,
    canonicalHash,
    winnerSlot: expectedWinnerSlot,
    outcomes: normalizedOutcomes
  };
}

function createApi({ store, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!store) throw new Error('createApi requires a store instance');

  const rateLimitMap = new Map();
  const totpAttemptMap = new Map();
  const resendCodeMap = new Map();
  const oauthStateMap = new Map();

  function pruneRateLimitMap(now = Date.now()) {
    for (const [k, rec] of rateLimitMap.entries()) {
      if (rec.resetAt <= now) {
        rateLimitMap.delete(k);
      }
    }
  }

  function checkRateLimit(req) {
    const now = Date.now();
    pruneRateLimitMap(now);
    const maxPerWindow = Number(env.AUTH_RATE_LIMIT_MAX || 60);
    const windowMs = Number(env.AUTH_RATE_LIMIT_WINDOW_MS || 60000);
    const ip = getClientIp(req, env);
    let rec = rateLimitMap.get(ip);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(ip, rec);
    }
    rec.count++;
    return rec.count <= maxPerWindow;
  }

  function pruneTotpAttemptMap(now = Date.now()) {
    for (const [k, rec] of totpAttemptMap.entries()) {
      if (rec.resetAt <= now) {
        totpAttemptMap.delete(k);
      }
    }
  }

  function isTotpRateLimited(userId, now = Date.now()) {
    pruneTotpAttemptMap(now);
    const maxAttempts = Number(env.TOTP_RATE_LIMIT_MAX || 5);
    const rec = totpAttemptMap.get(userId);
    if (!rec || rec.resetAt <= now) return false;
    return rec.count >= maxAttempts;
  }

  function recordFailedTotpAttempt(userId, now = Date.now()) {
    pruneTotpAttemptMap(now);
    const windowMs = Number(env.TOTP_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
    let rec = totpAttemptMap.get(userId);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      totpAttemptMap.set(userId, rec);
    }
    rec.count++;
    return rec.count;
  }

  function clearTotpAttempts(userId) {
    totpAttemptMap.delete(userId);
  }

  function pruneResendCodeMap(now = Date.now()) {
    for (const [k, rec] of resendCodeMap.entries()) {
      if (rec.resetAt <= now) {
        resendCodeMap.delete(k);
      }
    }
  }

  function checkResendCodeLimit(userId, now = Date.now()) {
    pruneResendCodeMap(now);
    const maxPerWindow = Number(env.RESEND_CODE_RATE_LIMIT_MAX || 3);
    const windowMs = Number(env.RESEND_CODE_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
    let rec = resendCodeMap.get(userId);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      resendCodeMap.set(userId, rec);
    }
    if (rec.count >= maxPerWindow) {
      return false;
    }
    rec.count++;
    return true;
  }

  async function getAuthSession(req) {
    const token = extractSessionToken(req);
    if (!token) return null;
    const tokenHash = auth.sha256Hex(token);
    return await store.getSession(tokenHash);
  }

  async function issueSessionForUser(userId, req) {
    const ttlHours = Number(env.SESSION_TTL_HOURS || 168);
    const { token, tokenHash, expiresAt } = auth.mintSessionToken(ttlHours);
    await store.createSession({ tokenHash, userId, expiresAt });
    const cookie = makeSessionCookie(token, ttlHours * 3600, req);
    return { token, expiresAt, cookie };
  }

  async function formatSelfUser(user) {
    const pub = publicProfile(user);
    return {
      ...pub,
      email: user.email,
      emailVerified: user.emailVerified,
      totpEnabled: user.totpEnabled,
      oauthProviders: await store.getOAuthProvidersForUser(user.id)
    };
  }

  async function handleApi(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    if (!pathname.startsWith('/api/')) {
      return false;
    }

    try {
      if (store.ready) {
        await store.ready;
      }

      // Rate limit auth endpoints
      if (pathname.startsWith('/api/auth/') && method === 'POST') {
        if (!checkRateLimit(req)) {
          json(res, 429, { error: 'Too many requests, please try again shortly.' });
          return true;
        }
      }

      // POST /api/auth/register
      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJsonBody(req);
        const username = String(body.username || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const displayName = String(body.displayName || username).trim().slice(0, 40);

        if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username)) {
          json(res, 400, { error: 'Username must be 3-24 characters (letters, numbers, _ or -).' });
          return true;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          json(res, 400, { error: 'A valid email address is required.' });
          return true;
        }
        if (password.length < 8 || password.length > 128) {
          json(res, 400, { error: 'Password must be between 8 and 128 characters.' });
          return true;
        }
        if (await store.getUserByUsername(username)) {
          json(res, 409, { error: 'Username is already taken.' });
          return true;
        }
        if (await store.getUserByEmail(email)) {
          json(res, 409, { error: 'Email is already registered.' });
          return true;
        }

        const passwordHash = await auth.hashPassword(password);
        const user = await store.createUser({
          username,
          email,
          passwordHash,
          emailVerified: false,
          displayName: displayName || username
        });

        const { code, codeHash, expiresAt } = auth.generateEmailCode();
        await store.setEmailVerificationCode(user.id, codeHash, expiresAt);
        const mail = await auth.sendEmail({
          to: email,
          subject: 'Verify your Charred Ground account',
          code,
          env,
          fetchImpl
        });

        const sess = await issueSessionForUser(user.id, req);
        const payload = {
          ok: true,
          requiresEmailVerification: true,
          username: user.username,
          email: user.email,
          token: sess.token,
          user: await formatSelfUser(user)
        };
        if (mail.devCode) payload.devVerificationCode = mail.devCode;
        json(res, 201, payload, { 'Set-Cookie': sess.cookie });
        return true;
      }

      // POST /api/auth/verify-email
      if (method === 'POST' && pathname === '/api/auth/verify-email') {
        const body = await readJsonBody(req);
        const identifier = String(body.username || body.email || '').trim();
        const code = String(body.code || '').trim();
        const user = (await store.getUserByUsername(identifier)) || (await store.getUserByEmail(identifier));
        if (!user) {
          json(res, 404, { error: 'Account not found.' });
          return true;
        }
        if (user.emailVerified) {
          const sess = await issueSessionForUser(user.id, req);
          json(
            res,
            200,
            { ok: true, token: sess.token, user: await formatSelfUser(user) },
            { 'Set-Cookie': sess.cookie }
          );
          return true;
        }
        if (!user.emailVerifyHash || !user.emailVerifyExpiresAt) {
          json(res, 400, {
            code: 'email_verify_invalidated',
            error: 'Verification code invalidated after too many wrong attempts. Please request a new code.'
          });
          return true;
        }
        // Count the attempt atomically FIRST before comparing the code
        const attempt = await store.countEmailVerifyAttempt(user.id);
        if (!attempt.counted || attempt.attempts > 5) {
          json(res, 400, {
            code: 'email_verify_invalidated',
            error: 'Too many wrong attempts. Your verification code has been invalidated; request a new code.'
          });
          return true;
        }
        const check = auth.verifyEmailCodeHash(code, user.emailVerifyHash, user.emailVerifyExpiresAt);
        if (!check.ok) {
          if (attempt.attempts >= 5) {
            await store.invalidateEmailVerificationCode(user.id);
            json(res, 400, {
              code: 'email_verify_invalidated',
              error: 'Too many wrong attempts. Your verification code has been invalidated; request a new code.'
            });
            return true;
          }
          json(res, 400, { error: check.reason, attemptsRemaining: Math.max(0, 5 - attempt.attempts) });
          return true;
        }
        const updated = await store.verifyEmailCode(user.id);
        const sess = await issueSessionForUser(updated.id, req);
        json(
          res,
          200,
          { ok: true, token: sess.token, user: await formatSelfUser(updated) },
          { 'Set-Cookie': sess.cookie }
        );
        return true;
      }

      // POST /api/auth/resend-code
      if (method === 'POST' && pathname === '/api/auth/resend-code') {
        const body = await readJsonBody(req);
        const identifier = String(body.username || body.email || '').trim();
        const user = (await store.getUserByUsername(identifier)) || (await store.getUserByEmail(identifier));
        if (!user) {
          json(res, 404, { error: 'Account not found.' });
          return true;
        }
        if (user.emailVerified) {
          json(res, 400, { error: 'Email is already verified.' });
          return true;
        }
        if (!checkResendCodeLimit(user.id)) {
          json(res, 429, {
            code: 'resend_rate_limited',
            error: 'Too many verification code requests for this account. Please try again later.'
          });
          return true;
        }
        const { code, codeHash, expiresAt } = auth.generateEmailCode();
        await store.setEmailVerificationCode(user.id, codeHash, expiresAt);
        const mail = await auth.sendEmail({
          to: user.email,
          subject: 'Your Charred Ground verification code',
          code,
          env,
          fetchImpl
        });
        const payload = { ok: true, resent: true };
        if (mail.devCode) payload.devVerificationCode = mail.devCode;
        json(res, 200, payload);
        return true;
      }

      // POST /api/auth/login
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(req);
        const identifier = String(body.username || body.email || '').trim();
        const password = String(body.password || '');
        const totpCode = body.totpCode !== undefined ? String(body.totpCode).trim() : '';

        const user = (await store.getUserByUsername(identifier)) || (await store.getUserByEmail(identifier));
        if (!user || !user.passwordHash || !(await auth.verifyPassword(password, user.passwordHash))) {
          json(res, 401, { error: 'Invalid username or password.' });
          return true;
        }
        if (user.totpEnabled) {
          if (!totpCode) {
            json(res, 401, {
              error: 'Two-factor authentication code required.',
              requiresTotp: true
            });
            return true;
          }
          if (isTotpRateLimited(user.id)) {
            json(res, 429, {
              code: 'totp_rate_limited',
              error: 'Too many two-factor authentication attempts for this account. Try again later.',
              requiresTotp: true
            });
            return true;
          }
          if (!auth.verifyTotpCode(user.totpSecret, totpCode)) {
            recordFailedTotpAttempt(user.id);
            json(res, 401, {
              error: 'Invalid two-factor authentication code.',
              requiresTotp: true
            });
            return true;
          }
          clearTotpAttempts(user.id);
        }

        const sess = await issueSessionForUser(user.id, req);
        const emailVerified = Boolean(user.emailVerified);
        json(
          res,
          200,
          {
            ok: true,
            token: sess.token,
            emailVerified,
            requiresEmailVerification: !emailVerified,
            user: await formatSelfUser(user)
          },
          { 'Set-Cookie': sess.cookie }
        );
        return true;
      }

      // POST /api/auth/logout
      if (method === 'POST' && pathname === '/api/auth/logout') {
        const token = extractSessionToken(req);
        if (token) {
          await store.deleteSession(auth.sha256Hex(token));
        }
        json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
        return true;
      }

      // GET /api/auth/me
      if (method === 'GET' && pathname === '/api/auth/me') {
        const sess = await getAuthSession(req);
        if (!sess) {
          json(res, 401, { authenticated: false, user: null });
          return true;
        }
        json(res, 200, { authenticated: true, user: await formatSelfUser(sess.user) });
        return true;
      }

      // POST /api/auth/totp/setup
      if (method === 'POST' && pathname === '/api/auth/totp/setup') {
        const sess = await getAuthSession(req);
        if (!sess) {
          json(res, 401, { error: 'Authentication required.' });
          return true;
        }
        const secret = auth.generateTotpSecret();
        await store.setTotpSecret(sess.user.id, secret);
        const otpauthUri = auth.buildOtpAuthUri({
          secret,
          accountName: sess.user.username,
          issuer: 'CharredGround'
        });
        json(res, 200, { ok: true, secret, otpauthUri });
        return true;
      }

      // POST /api/auth/totp/enable
      if (method === 'POST' && pathname === '/api/auth/totp/enable') {
        const sess = await getAuthSession(req);
        if (!sess) {
          json(res, 401, { error: 'Authentication required.' });
          return true;
        }
        const body = await readJsonBody(req);
        const code = String(body.code || '').trim();
        const user = await store.getUserById(sess.user.id);
        if (!user.totpSecret) {
          json(res, 400, { error: 'Run TOTP setup before enabling 2FA.' });
          return true;
        }
        if (isTotpRateLimited(user.id)) {
          json(res, 429, {
            code: 'totp_rate_limited',
            error: 'Too many two-factor authentication attempts for this account. Try again later.'
          });
          return true;
        }
        if (!auth.verifyTotpCode(user.totpSecret, code)) {
          recordFailedTotpAttempt(user.id);
          json(res, 400, { error: 'Invalid TOTP code.' });
          return true;
        }
        clearTotpAttempts(user.id);
        const updated = await store.enableTotp(user.id);
        json(res, 200, { ok: true, totpEnabled: updated.totpEnabled, user: await formatSelfUser(updated) });
        return true;
      }

      // POST /api/auth/totp/disable
      if (method === 'POST' && pathname === '/api/auth/totp/disable') {
        const sess = await getAuthSession(req);
        if (!sess) {
          json(res, 401, { error: 'Authentication required.' });
          return true;
        }
        const body = await readJsonBody(req);
        const code = String(body.code || '').trim();
        const user = await store.getUserById(sess.user.id);
        if (user.totpEnabled) {
          if (isTotpRateLimited(user.id)) {
            json(res, 429, {
              code: 'totp_rate_limited',
              error: 'Too many two-factor authentication attempts for this account. Try again later.'
            });
            return true;
          }
          if (!auth.verifyTotpCode(user.totpSecret, code)) {
            recordFailedTotpAttempt(user.id);
            json(res, 400, { error: 'Valid TOTP code required to disable 2FA.' });
            return true;
          }
          clearTotpAttempts(user.id);
        }
        const updated = await store.disableTotp(user.id);
        json(res, 200, { ok: true, totpEnabled: updated.totpEnabled, user: await formatSelfUser(updated) });
        return true;
      }

      // GET /api/auth/oauth/providers
      if (method === 'GET' && pathname === '/api/auth/oauth/providers') {
        json(res, 200, { providers: auth.listOAuthProviders(env) });
        return true;
      }

      // GET /api/auth/oauth/:provider/start
      const oauthStartMatch = pathname.match(/^\/api\/auth\/oauth\/([a-z0-9_-]+)\/start$/i);
      if (method === 'GET' && oauthStartMatch) {
        const providerId = oauthStartMatch[1].toLowerCase();
        const cfg = auth.getOAuthProviderConfig(providerId, env);
        if (!cfg) {
          json(res, 404, { error: `Unknown OAuth provider: ${providerId}` });
          return true;
        }
        if (!cfg.configured) {
          json(res, 503, {
            error: `${cfg.name} OAuth is not configured on this server.`,
            provider: cfg.id,
            configured: false,
            requiredEnv: cfg.requiredEnv
          });
          return true;
        }
        const state = crypto.randomBytes(16).toString('hex');
        oauthStateMap.set(state, { provider: cfg.id, createdAt: Date.now() });
        const authorizeUrl = auth.buildOAuthAuthorizeUrl(cfg, state);
        if (url.searchParams.get('redirect') === '1') {
          res.writeHead(302, { Location: authorizeUrl });
          res.end();
          return true;
        }
        json(res, 200, { ok: true, provider: cfg.id, state, authorizeUrl });
        return true;
      }

      // GET /api/auth/oauth/:provider/callback
      const oauthCallbackMatch = pathname.match(/^\/api\/auth\/oauth\/([a-z0-9_-]+)\/callback$/i);
      if (method === 'GET' && oauthCallbackMatch) {
        const providerId = oauthCallbackMatch[1].toLowerCase();
        const cfg = auth.getOAuthProviderConfig(providerId, env);
        if (!cfg) {
          json(res, 404, { error: `Unknown OAuth provider: ${providerId}` });
          return true;
        }
        if (!cfg.configured) {
          json(res, 503, {
            error: `${cfg.name} OAuth is not configured on this server.`,
            provider: cfg.id,
            configured: false,
            requiredEnv: cfg.requiredEnv
          });
          return true;
        }
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) {
          json(res, 400, { error: 'Missing OAuth code or state parameter.' });
          return true;
        }
        const stateEntry = oauthStateMap.get(state);
        if (!stateEntry || stateEntry.provider !== cfg.id) {
          json(res, 400, { error: 'Invalid or expired OAuth state.' });
          return true;
        }
        oauthStateMap.delete(state);

        const oauthProfile = await auth.exchangeOAuthCode(cfg, code, fetchImpl);
        const providerEmailVerified = oauthProfile.emailVerified === true;
        let user = await store.getUserByOAuth(cfg.id, oauthProfile.providerUserId);
        let linkedByEmail = false;
        if (!user && providerEmailVerified) {
          user = await store.getUserByEmail(oauthProfile.email);
          if (user) linkedByEmail = true;
        }
        if (!user) {
          let baseUsername = sanitizeUsername(oauthProfile.usernameHint);
          if (baseUsername.length < 3) baseUsername = `${cfg.id}_user`;
          let candidate = baseUsername;
          let suffix = 1;
          while (await store.getUserByUsername(candidate)) {
            candidate = `${baseUsername.slice(0, 18)}_${suffix++}`;
          }
          let emailCandidate = oauthProfile.email;
          if (await store.getUserByEmail(emailCandidate)) {
            emailCandidate = `${cfg.id}_${oauthProfile.providerUserId}@oauth.local`;
          }
          user = await store.createUser({
            username: candidate,
            email: emailCandidate,
            passwordHash: null,
            emailVerified: providerEmailVerified,
            displayName: oauthProfile.displayName || candidate,
            avatar: oauthProfile.avatar || ''
          });
        } else if (!user.emailVerified && providerEmailVerified) {
          await store.clearPasswordHash(user.id);
          await store.disableTotp(user.id);
          clearTotpAttempts(user.id);
          await store.deleteSessionsForUser(user.id);
          user = await store.verifyEmailCode(user.id);
        }
        await store.linkOAuthAccount({
          userId: user.id,
          provider: cfg.id,
          providerUserId: oauthProfile.providerUserId,
          email: oauthProfile.email
        });

        const sess = await issueSessionForUser(user.id, req);
        json(
          res,
          200,
          { ok: true, provider: cfg.id, token: sess.token, user: await formatSelfUser(user) },
          { 'Set-Cookie': sess.cookie }
        );
        return true;
      }

      // PUT /api/profile
      if (method === 'PUT' && pathname === '/api/profile') {
        const sess = await getAuthSession(req);
        if (!sess) {
          json(res, 401, { error: 'Authentication required.' });
          return true;
        }
        const body = await readJsonBody(req);
        const updates = {};

        if (body.displayName !== undefined) {
          const dn = String(body.displayName).trim();
          if (dn.length < 1 || dn.length > 40) {
            json(res, 400, { error: 'Display name must be between 1 and 40 characters.' });
            return true;
          }
          updates.displayName = dn;
        }
        if (body.avatar !== undefined) {
          const av = String(body.avatar).trim();
          if (av.length > 300) {
            json(res, 400, { error: 'Avatar URL or identifier must be at most 300 characters.' });
            return true;
          }
          updates.avatar = av;
        }
        if (body.bio !== undefined) {
          const bio = String(body.bio);
          if (bio.length > 500) {
            json(res, 400, { error: 'Bio must be at most 500 characters.' });
            return true;
          }
          updates.bio = bio;
        }
        if (body.customFields !== undefined) {
          const cfCheck = validateCustomFields(body.customFields);
          if (!cfCheck.ok) {
            json(res, 400, { error: cfCheck.error });
            return true;
          }
          updates.customFields = cfCheck.value;
        }

        const updated = await store.updateProfile(sess.user.id, updates);
        json(res, 200, { ok: true, profile: publicProfile(updated), user: await formatSelfUser(updated) });
        return true;
      }

      // GET /api/profile/:username
      const profileMatch = pathname.match(/^\/api\/profile\/([^/]+)$/);
      if (method === 'GET' && profileMatch) {
        const username = decodeURIComponent(profileMatch[1]);
        const user = await store.getUserByUsername(username);
        if (!user) {
          json(res, 404, { error: 'Commander profile not found.' });
          return true;
        }
        const history = await store.getMatchHistoryByUser(user.id, 25);
        json(res, 200, {
          profile: publicProfile(user),
          matchHistory: history
        });
        return true;
      }

      // POST /api/matches/start
      if (method === 'POST' && pathname === '/api/matches/start') {
        const sess = await getAuthSession(req);
        if (!sess) {
          json(res, 401, { error: 'Authentication required to start an attested match.' });
          return true;
        }
        if (!sess.user.emailVerified) {
          json(res, 403, {
            code: 'email_unverified',
            requiresEmailVerification: true,
            error: 'Ranked play requires a verified email address. Verify your email to record ranked matches and appear on the leaderboard; unranked play remains available.'
          });
          return true;
        }
        const body = await readJsonBody(req);
        const rawParticipants = Array.isArray(body.participants) ? body.participants : [];
        if (rawParticipants.length < 2 || rawParticipants.length > 6) {
          json(res, 400, { error: 'Matches require between 2 and 6 participants.' });
          return true;
        }

        const normalizedParticipants = [];
        let hostIncluded = false;
        for (let i = 0; i < rawParticipants.length; i++) {
          const p = rawParticipants[i] || {};
          const isAi = Boolean(p.ai);
          let userId = isAi ? null : (p.userId ? String(p.userId) : null);
          if (!isAi && userId) {
            const u = await store.getUserById(userId);
            if (!u) {
              json(res, 400, { error: `Participant user not found for slot ${i}` });
              return true;
            }
            if (!u.emailVerified) {
              json(res, 403, {
                code: 'email_unverified',
                requiresEmailVerification: true,
                error: `Participant ${u.username} must verify their email before playing a ranked match.`
              });
              return true;
            }
            if (u.id === sess.user.id) hostIncluded = true;
          }
          normalizedParticipants.push({
            slot: i,
            userId,
            name: String(p.name || `Commander ${i + 1}`).slice(0, 40),
            ai: isAi
          });
        }

        if (!hostIncluded) {
          // Ensure the authenticated host is recorded in slot 0 if not explicitly tagged
          if (!normalizedParticipants[0].ai && !normalizedParticipants[0].userId) {
            normalizedParticipants[0].userId = sess.user.id;
            normalizedParticipants[0].name = sess.user.displayName || sess.user.username;
            hostIncluded = true;
          }
        }
        if (!hostIncluded) {
          json(res, 400, { error: 'Authenticated host must be a human participant in the match.' });
          return true;
        }

        const nonce = crypto.randomBytes(24).toString('hex');
        const match = await store.createMatch({
          hostUserId: sess.user.id,
          nonce,
          roomCode: String(body.roomCode || '').slice(0, 40),
          mode: String(body.mode || 'online').slice(0, 20),
          roundNumber: Number(body.round || 1)
        });
        const fullMatch = await store.addParticipants(match.id, normalizedParticipants);
        json(res, 201, {
          ok: true,
          matchId: fullMatch.id,
          nonce: fullMatch.nonce,
          round: fullMatch.roundNumber,
          participants: fullMatch.participants.map(p => ({
            slot: p.slot,
            userId: p.userId,
            name: p.name,
            ai: p.ai
          }))
        });
        return true;
      }

      // POST /api/matches/:id/attest
      const attestMatch = pathname.match(/^\/api\/matches\/([^/]+)\/attest$/);
      if (method === 'POST' && attestMatch) {
        const sess = await getAuthSession(req);
        if (!sess) {
          json(res, 401, { error: 'Authentication required to attest match results.' });
          return true;
        }
        if (!sess.user.emailVerified) {
          json(res, 403, {
            code: 'email_unverified',
            requiresEmailVerification: true,
            error: 'Ranked play requires a verified email address. Verify your email to record ranked match results.'
          });
          return true;
        }
        const matchId = decodeURIComponent(attestMatch[1]);
        const match = await store.getMatch(matchId);
        if (!match) {
          json(res, 404, { error: 'Match ticket not found.' });
          return true;
        }
        if (match.nonceUsed || match.status !== 'pending') {
          json(res, 409, { error: 'Match ticket has already been finalized or rejected.', status: match.status });
          return true;
        }

        const participant = match.participants.find(p => !p.ai && p.userId === sess.user.id);
        if (!participant) {
          json(res, 403, { error: 'You are not a registered human participant in this match.' });
          return true;
        }
        if (participant.attested) {
          json(res, 409, {
            error: 'Participant has already submitted an attestation for this match.',
            status: match.status
          });
          return true;
        }

        const body = await readJsonBody(req);
        const validation = validateAndCanonicalizeAttestation(match, body);
        if (!validation.ok) {
          await store.rejectMatch(match.id, validation.reason);
          json(res, 400, { error: validation.reason, status: 'rejected' });
          return true;
        }

        const mySlotOutcome = validation.outcomes.find(o => o.slot === participant.slot);
        const updatedMatch = await store.submitAttestation({
          matchId: match.id,
          userId: sess.user.id,
          attestationHash: validation.canonicalHash,
          payload: body,
          slotOutcome: mySlotOutcome
        });
        if (!updatedMatch || updatedMatch.attestedUpdated === false) {
          json(res, 409, {
            error: 'Participant has already submitted an attestation for this match.',
            status: updatedMatch?.status || match.status
          });
          return true;
        }

        const humanParticipants = updatedMatch.participants.filter(p => !p.ai && p.userId);
        const attestedHumans = humanParticipants.filter(p => p.attested);

        // Check for conflicting hashes among already-submitted attestations
        const hashes = new Set(attestedHumans.map(p => p.attestationHash));
        if (hashes.size > 1) {
          const rejected = await store.rejectMatch(match.id, 'Conflicting participant outcome attestations');
          json(res, 409, {
            error: 'Participant attestations disagreed on match outcome; match rejected.',
            status: rejected.status
          });
          return true;
        }

        if (attestedHumans.length < humanParticipants.length) {
          json(res, 202, {
            ok: true,
            status: 'pending_co_attestation',
            attestedCount: attestedHumans.length,
            requiredCount: humanParticipants.length
          });
          return true;
        }

        // Verify every human participant has a verified email before recording ranked stats
        for (const hp of humanParticipants) {
          const hu = await store.getUserById(hp.userId);
          if (!hu || !hu.emailVerified) {
            json(res, 403, {
              code: 'email_unverified',
              requiresEmailVerification: true,
              error: 'All human participants must have a verified email to record ranked results.'
            });
            return true;
          }
        }

        // Every human participant has attested with identical canonical hash
        const isBotMatch = humanParticipants.length < 2;
        const winnerPart =
          validation.winnerSlot !== null
            ? updatedMatch.participants.find(p => p.slot === validation.winnerSlot)
            : null;
        const winnerUserId = winnerPart && !winnerPart.ai ? winnerPart.userId : null;

        const finalized = await store.finalizeMatch({
          matchId: match.id,
          winnerUserId,
          canonicalHash: validation.canonicalHash,
          participantOutcomes: validation.outcomes,
          isBotMatch
        });

        if (!finalized || finalized.finalized === false) {
          json(res, 409, {
            error: 'Match ticket has already been finalized or rejected.',
            status: finalized?.status || 'verified'
          });
          return true;
        }

        json(res, 200, {
          ok: true,
          status: finalized.status,
          winnerUserId: finalized.winnerUserId,
          leaderboardUpdated: !isBotMatch
        });
        return true;
      }

      // GET /api/leaderboard
      if (method === 'GET' && pathname === '/api/leaderboard') {
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
        const entries = await store.getLeaderboard(limit);
        json(res, 200, { leaderboard: entries });
        return true;
      }

      json(res, 404, { error: 'API route not found' });
      return true;
    } catch (err) {
      const status = err.status || 500;
      json(res, status, { error: err.message || 'Internal server error' });
      return true;
    }
  }

  Object.defineProperty(handleApi, 'rateLimitMapSize', {
    get: () => rateLimitMap.size
  });
  handleApi.pruneRateLimitMap = pruneRateLimitMap;
  handleApi.rateLimitMap = rateLimitMap;
  handleApi.totpAttemptMap = totpAttemptMap;

  return handleApi;
}

module.exports = {
  createApi,
  getClientIp,
  isLocalhostRequest,
  makeSessionCookie,
  clearSessionCookie,
  ALLOWED_WEAPONS,
  validateCustomFields,
  validateAndCanonicalizeAttestation
};
