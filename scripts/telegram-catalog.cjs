'use strict';

// Stars catalog. Cosmetic and convenience items only: nothing here changes damage, actions,
// credits or the arsenal, so ranked attestation and fairness are untouched (ROADMAP Phase 6).
// Prices are defaults for the owner to tune with TELEGRAM_STORE_PRICES (JSON {sku: stars});
// TELEGRAM_STORE_DISABLED (comma list) hides SKUs.

const ACCENTS = ['ember', 'glacier', 'venom', 'royal', 'chrome'];
const TRAILS = ['tracer', 'plasma', 'inferno'];
const SUBSCRIPTION_PERIOD = 2592000; // Telegram allows exactly 30 days.
const MAX_SUBSCRIPTION_STARS = 10000;

const BASE_SKUS = [
  {
    sku: 'supporter',
    kind: 'subscription',
    stars: 150,
    title: 'Supporter (monthly)',
    description: 'Supporter badge, gold callsign, every tank accent and shell trail while active. Cosmetic only. Renews every 30 days; cancel any time in Telegram.',
    grants: { supporter: true, accents: ACCENTS, trails: TRAILS }
  },
  { sku: 'accent_ember', kind: 'permanent', stars: 50, title: 'Ember tank accent', description: 'Molten orange turret and barrel trim. Cosmetic only.', grants: { accents: ['ember'] } },
  { sku: 'accent_glacier', kind: 'permanent', stars: 50, title: 'Glacier tank accent', description: 'Ice-blue turret and barrel trim. Cosmetic only.', grants: { accents: ['glacier'] } },
  { sku: 'accent_venom', kind: 'permanent', stars: 50, title: 'Venom tank accent', description: 'Toxic green turret and barrel trim. Cosmetic only.', grants: { accents: ['venom'] } },
  { sku: 'accent_royal', kind: 'permanent', stars: 50, title: 'Royal tank accent', description: 'Deep violet turret and barrel trim. Cosmetic only.', grants: { accents: ['royal'] } },
  { sku: 'accent_chrome', kind: 'permanent', stars: 75, title: 'Chrome tank accent', description: 'Polished metal turret and barrel trim. Cosmetic only.', grants: { accents: ['chrome'] } },
  { sku: 'trail_tracer', kind: 'permanent', stars: 75, title: 'Tracer shell trail', description: 'Gold tracer trails for your shots. Cosmetic only.', grants: { trails: ['tracer'] } },
  { sku: 'trail_plasma', kind: 'permanent', stars: 75, title: 'Plasma shell trail', description: 'Violet plasma trails for your shots. Cosmetic only.', grants: { trails: ['plasma'] } },
  { sku: 'trail_inferno', kind: 'permanent', stars: 75, title: 'Inferno shell trail', description: 'Red-hot trails for your shots. Cosmetic only.', grants: { trails: ['inferno'] } },
  {
    sku: 'cosmetics_bundle',
    kind: 'permanent',
    stars: 300,
    title: 'Armory cosmetics bundle',
    description: 'Every tank accent and shell trail, forever. Cosmetic only.',
    grants: { accents: ACCENTS, trails: TRAILS }
  },
  {
    sku: 'ai_pass_30d',
    kind: 'timed',
    days: 30,
    stars: 100,
    title: 'Mastermind AI pass (30 days)',
    description: 'Play against the server-hosted Gemini and ChatGPT commanders for 30 days. Covers the AI provider cost.',
    grants: { aiPass: true }
  }
];

function parseJsonEnv(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getCatalog(env = process.env) {
  const prices = parseJsonEnv(env.TELEGRAM_STORE_PRICES) || {};
  const disabled = new Set(String(env.TELEGRAM_STORE_DISABLED || '').split(',').map(s => s.trim()).filter(Boolean));
  return BASE_SKUS.filter(s => !disabled.has(s.sku)).map(s => {
    let stars = s.stars;
    const override = Number(prices[s.sku]);
    if (Number.isInteger(override) && override >= 1) stars = override;
    if (s.kind === 'subscription') stars = Math.min(stars, MAX_SUBSCRIPTION_STARS);
    return { ...s, stars };
  });
}

function findSku(sku, env = process.env) {
  return getCatalog(env).find(s => s.sku === sku) || null;
}

// Folds active entitlements into what the client may render.
function summarizeEntitlements(entitlements, env = process.env) {
  const all = new Map(BASE_SKUS.map(s => [s.sku, s]));
  const accents = new Set();
  const trails = new Set();
  let supporter = false;
  let aiPass = false;
  let supporterExpiresAt = null;
  for (const e of entitlements) {
    const s = all.get(e.sku);
    if (!s) continue;
    for (const a of s.grants.accents || []) accents.add(a);
    for (const t of s.grants.trails || []) trails.add(t);
    if (s.grants.supporter) { supporter = true; supporterExpiresAt = e.expiresAt; }
    if (s.grants.aiPass) aiPass = true;
  }
  return {
    owned: entitlements.map(e => ({ sku: e.sku, expiresAt: e.expiresAt })),
    accents: ACCENTS.filter(a => accents.has(a)),
    trails: TRAILS.filter(t => trails.has(t)),
    supporter,
    supporterExpiresAt,
    aiPass
  };
}

module.exports = { getCatalog, findSku, summarizeEntitlements, ACCENTS, TRAILS, SUBSCRIPTION_PERIOD, MAX_SUBSCRIPTION_STARS };
