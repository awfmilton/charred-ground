'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BCRYPT_ROUNDS = 10;
const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;

function hashPassword(password) {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  if (!hash || typeof password !== 'string') return false;
  return bcrypt.compareSync(password, hash);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generateEmailCode() {
  const n = crypto.randomInt(0, 1000000);
  const code = String(n).padStart(6, '0');
  const codeHash = sha256Hex(code);
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString();
  return { code, codeHash, expiresAt };
}

function verifyEmailCodeHash(code, expectedHash, expiresAt) {
  if (!code || !expectedHash || !expiresAt) return { ok: false, reason: 'No active verification code' };
  if (new Date(expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'Verification code expired' };
  }
  const candidate = sha256Hex(String(code).trim());
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Invalid verification code' };
  }
  return { ok: true };
}

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function buildOtpAuthUri({ secret, accountName, issuer = 'CharredGround' }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function computeHotp(secretBase32, counter, digits = 6) {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

function generateTotpCode(secretBase32, timestampMs = Date.now(), stepSec = 30) {
  const counter = Math.floor(timestampMs / 1000 / stepSec);
  return computeHotp(secretBase32, counter, 6);
}

function verifyTotpCode(secretBase32, token, { timestampMs = Date.now(), window = 1, stepSec = 30 } = {}) {
  if (!secretBase32 || !token) return false;
  const clean = String(token).trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const baseCounter = Math.floor(timestampMs / 1000 / stepSec);
  for (let w = -window; w <= window; w++) {
    const expected = computeHotp(secretBase32, baseCounter + w, 6);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

function mintSessionToken(ttlHours = 168) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + Number(ttlHours || 168) * 3600 * 1000).toISOString();
  return { token, tokenHash, expiresAt };
}

const OAUTH_PROVIDERS = {
  google: {
    id: 'google',
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    envPrefix: 'OAUTH_GOOGLE'
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    profileUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
    envPrefix: 'OAUTH_DISCORD'
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    profileUrl: 'https://graph.facebook.com/me?fields=id,name,email',
    scopes: ['email', 'public_profile'],
    envPrefix: 'OAUTH_FACEBOOK'
  },
  twitter: {
    id: 'twitter',
    name: 'Twitter / X',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    profileUrl: 'https://api.twitter.com/2/users/me',
    scopes: ['tweet.read', 'users.read'],
    envPrefix: 'OAUTH_TWITTER'
  }
};

function getOAuthProviderConfig(providerId, env = process.env) {
  const key = String(providerId || '').toLowerCase();
  const meta = OAUTH_PROVIDERS[key];
  if (!meta) return null;
  const requiredEnv = [
    `${meta.envPrefix}_CLIENT_ID`,
    `${meta.envPrefix}_CLIENT_SECRET`,
    `${meta.envPrefix}_REDIRECT_URI`
  ];
  const clientId = (env[requiredEnv[0]] || '').trim();
  const clientSecret = (env[requiredEnv[1]] || '').trim();
  const redirectUri = (env[requiredEnv[2]] || '').trim();
  const configured = Boolean(clientId && clientSecret && redirectUri);
  return {
    ...meta,
    clientId,
    clientSecret,
    redirectUri,
    configured,
    requiredEnv
  };
}

function listOAuthProviders(env = process.env) {
  return Object.keys(OAUTH_PROVIDERS).map(id => {
    const cfg = getOAuthProviderConfig(id, env);
    return {
      id: cfg.id,
      name: cfg.name,
      configured: cfg.configured,
      requiredEnv: cfg.requiredEnv
    };
  });
}

function buildOAuthAuthorizeUrl(providerCfg, state) {
  const url = new URL(providerCfg.authUrl);
  url.searchParams.set('client_id', providerCfg.clientId);
  url.searchParams.set('redirect_uri', providerCfg.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', providerCfg.scopes.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeOAuthCode(providerCfg, code, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available for OAuth');
  }
  const tokenRes = await fetchImpl(providerCfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: providerCfg.clientId,
      client_secret: providerCfg.clientSecret,
      redirect_uri: providerCfg.redirectUri,
      grant_type: 'authorization_code',
      code: String(code)
    }).toString()
  });
  if (!tokenRes.ok) {
    throw new Error(`OAuth token exchange failed (${tokenRes.status})`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error('OAuth token response missing access_token');
  }

  const profileRes = await fetchImpl(providerCfg.profileUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  if (!profileRes.ok) {
    throw new Error(`OAuth profile fetch failed (${profileRes.status})`);
  }
  const rawProfile = await profileRes.json();
  const p = rawProfile.data || rawProfile;
  const providerUserId = String(p.sub || p.id || '');
  if (!providerUserId) {
    throw new Error('OAuth profile missing user id');
  }
  const usernameHint = String(p.username || p.name || p.preferred_username || `${providerCfg.id}_${providerUserId}`);
  const email = String(p.email || `${providerCfg.id}_${providerUserId}@oauth.local`).toLowerCase();
  const displayName = String(p.name || p.global_name || p.username || usernameHint);
  const avatar = String(p.picture || p.avatar_url || '');
  return {
    provider: providerCfg.id,
    providerUserId,
    usernameHint,
    email,
    displayName,
    avatar
  };
}

async function sendEmail({ to, subject, code, env = process.env, fetchImpl = globalThis.fetch }) {
  const smtpUrl = (env.EMAIL_SMTP_URL || '').trim();
  const from = (env.EMAIL_FROM || 'noreply@charred-ground.local').trim();
  const isProd = env.NODE_ENV === 'production';

  if (smtpUrl && typeof fetchImpl === 'function' && /^https?:\/\//i.test(smtpUrl)) {
    await fetchImpl(smtpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: `Your Charred Ground verification code is: ${code}` })
    });
  } else if (!isProd && env.NODE_ENV !== 'test') {
    console.log(`[Charred Ground Email] To=${to} Subject="${subject}" Code=${code}`);
  }

  return {
    sent: Boolean(smtpUrl),
    devCode: isProd ? undefined : code
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  sha256Hex,
  generateEmailCode,
  verifyEmailCodeHash,
  base32Encode,
  base32Decode,
  generateTotpSecret,
  buildOtpAuthUri,
  generateTotpCode,
  verifyTotpCode,
  mintSessionToken,
  OAUTH_PROVIDERS,
  getOAuthProviderConfig,
  listOAuthProviders,
  buildOAuthAuthorizeUrl,
  exchangeOAuthCode,
  sendEmail
};
