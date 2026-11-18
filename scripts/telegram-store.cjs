'use strict';

// Telegram-specific persistence: Stars purchases and entitlements, purchase intents, per-chat
// membership (for group leaderboards), shared maps/challenges and turn-notification watches.
// It sits beside the core account store (scripts/db.cjs) and reuses its connection, so the
// same SQLite file or MySQL database holds everything. Only new tables are created; the core
// schema is never altered.

const crypto = require('node:crypto');

function nowIso(clock = Date.now) {
  return new Date(clock()).toISOString();
}

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS tg_purchase_intents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    telegram_user_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    stars INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    consumed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS tg_purchases (
    charge_id TEXT PRIMARY KEY,
    intent_id TEXT,
    user_id TEXT NOT NULL,
    telegram_user_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    stars INTEGER NOT NULL,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    refunded_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tg_entitlements (
    user_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    expires_at TEXT,
    charge_id TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, sku)
  );
  CREATE TABLE IF NOT EXISTS tg_chat_members (
    chat_instance TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    PRIMARY KEY (chat_instance, user_id)
  );
  CREATE TABLE IF NOT EXISTS tg_shares (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tg_turn_watches (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    telegram_user_id TEXT NOT NULL,
    room_code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_notified_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tg_purchases_user ON tg_purchases(user_id);
  CREATE INDEX IF NOT EXISTS idx_tg_chat_members_user ON tg_chat_members(user_id);
`;

const MYSQL_DDL = [
  `CREATE TABLE IF NOT EXISTS tg_purchase_intents (
    id VARCHAR(40) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    telegram_user_id VARCHAR(32) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    stars INT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    consumed_at VARCHAR(40)
  )`,
  `CREATE TABLE IF NOT EXISTS tg_purchases (
    charge_id VARCHAR(191) PRIMARY KEY,
    intent_id VARCHAR(40),
    user_id VARCHAR(36) NOT NULL,
    telegram_user_id VARCHAR(32) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    stars INT NOT NULL,
    is_recurring TINYINT(1) NOT NULL DEFAULT 0,
    expires_at VARCHAR(40),
    refunded_at VARCHAR(40),
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_tg_purchases_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tg_entitlements (
    user_id VARCHAR(36) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    expires_at VARCHAR(40),
    charge_id VARCHAR(191),
    updated_at VARCHAR(40) NOT NULL,
    PRIMARY KEY (user_id, sku)
  )`,
  `CREATE TABLE IF NOT EXISTS tg_chat_members (
    chat_instance VARCHAR(64) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    last_seen VARCHAR(40) NOT NULL,
    PRIMARY KEY (chat_instance, user_id),
    INDEX idx_tg_chat_members_user (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tg_shares (
    id VARCHAR(40) PRIMARY KEY,
    kind VARCHAR(16) NOT NULL,
    owner_user_id VARCHAR(36) NOT NULL,
    payload_json MEDIUMTEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tg_turn_watches (
    token VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    telegram_user_id VARCHAR(32) NOT NULL,
    room_code VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    last_notified_at VARCHAR(40)
  )`
];

// A tiny dialect bridge: every method below is written once against run/get/all.
function makeDriver(core) {
  if (core.backend === 'sqlite') {
    const db = core.db;
    return {
      backend: 'sqlite',
      async migrate() { db.exec(SQLITE_DDL); },
      async run(sql, params = []) { const r = db.prepare(sql).run(...params); return { changes: Number(r.changes || 0) }; },
      async get(sql, params = []) { return db.prepare(sql).get(...params) || null; },
      async all(sql, params = []) { return db.prepare(sql).all(...params); },
      insertIgnore: 'INSERT OR IGNORE'
    };
  }
  if (core.backend === 'mysql') {
    const pool = core.db;
    return {
      backend: 'mysql',
      async migrate() { for (const stmt of MYSQL_DDL) await pool.execute(stmt, []); },
      async run(sql, params = []) { const [r] = await pool.execute(sql, params); return { changes: Number(r?.affectedRows || 0) }; },
      async get(sql, params = []) { const [rows] = await pool.execute(sql, params); return (rows && rows[0]) || null; },
      async all(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows || []; },
      insertIgnore: 'INSERT IGNORE'
    };
  }
  throw new Error(`Unsupported store backend for Telegram data: ${core.backend}`);
}

function createTelegramStore(core, { clock = Date.now } = {}) {
  if (!core) throw new Error('createTelegramStore requires the core store');
  const d = makeDriver(core);
  const ready = Promise.resolve(core.ready).then(() => d.migrate());
  const now = () => nowIso(clock);

  const isActive = row => !row.expires_at || Date.parse(row.expires_at) > clock();

  return {
    ready,
    backend: d.backend,

    async telegramIdForUser(userId) {
      const row = await d.get(
        "SELECT provider_user_id FROM oauth_accounts WHERE user_id = ? AND provider = 'telegram'",
        [userId]
      );
      return row ? String(row.provider_user_id) : null;
    },

    async userIdForTelegram(telegramUserId) {
      const row = await d.get(
        "SELECT user_id FROM oauth_accounts WHERE provider = 'telegram' AND provider_user_id = ?",
        [String(telegramUserId)]
      );
      return row ? row.user_id : null;
    },

    async touchChatMember(chatInstance, userId) {
      if (!chatInstance || !userId) return;
      const ts = now();
      const upd = await d.run(
        'UPDATE tg_chat_members SET last_seen = ? WHERE chat_instance = ? AND user_id = ?',
        [ts, String(chatInstance), userId]
      );
      if (!upd.changes) {
        await d.run(
          `${d.insertIgnore} INTO tg_chat_members (chat_instance, user_id, last_seen) VALUES (?, ?, ?)`,
          [String(chatInstance), userId, ts]
        );
      }
    },

    async isChatMember(chatInstance, userId) {
      return Boolean(await d.get(
        'SELECT 1 AS ok FROM tg_chat_members WHERE chat_instance = ? AND user_id = ?',
        [String(chatInstance), userId]
      ));
    },

    // Group leaderboard: everyone who opened the game from this chat, ranked like the global board.
    async chatLeaderboardRows(chatInstance, limit = 50) {
      const lim = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 50)));
      return d.all(
        `SELECT u.* FROM users u
         JOIN tg_chat_members m ON m.user_id = u.id
         WHERE m.chat_instance = ?
         ORDER BY u.wins DESC, u.kills DESC, u.matches_played ASC, u.username ASC
         LIMIT ${lim}`,
        [String(chatInstance)]
      );
    },

    async createIntent({ userId, telegramUserId, sku, stars }) {
      const id = crypto.randomBytes(12).toString('hex');
      await d.run(
        'INSERT INTO tg_purchase_intents (id, user_id, telegram_user_id, sku, stars, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, String(telegramUserId), sku, Number(stars), now()]
      );
      return { id, userId, telegramUserId: String(telegramUserId), sku, stars: Number(stars) };
    },

    async getIntent(id) {
      const row = await d.get('SELECT * FROM tg_purchase_intents WHERE id = ?', [String(id || '')]);
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        telegramUserId: String(row.telegram_user_id),
        sku: row.sku,
        stars: Number(row.stars),
        createdAt: row.created_at,
        consumedAt: row.consumed_at || null
      };
    },

    // Idempotent: the same telegram_payment_charge_id is recorded and granted exactly once.
    async recordPayment({ chargeId, intentId, userId, telegramUserId, sku, stars, isRecurring = false, expiresAt = null }) {
      const ins = await d.run(
        `${d.insertIgnore} INTO tg_purchases (charge_id, intent_id, user_id, telegram_user_id, sku, stars, is_recurring, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(chargeId), intentId || null, userId, String(telegramUserId), sku, Number(stars), isRecurring ? 1 : 0, expiresAt, now()]
      );
      if (!ins.changes) return { granted: false, duplicate: true };
      if (intentId) {
        await d.run('UPDATE tg_purchase_intents SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', [now(), intentId]);
      }
      await this.grantEntitlement({ userId, sku, expiresAt, chargeId });
      return { granted: true, duplicate: false };
    },

    async grantEntitlement({ userId, sku, expiresAt = null, chargeId = null }) {
      const ts = now();
      const upd = await d.run(
        'UPDATE tg_entitlements SET expires_at = ?, charge_id = ?, updated_at = ? WHERE user_id = ? AND sku = ?',
        [expiresAt, chargeId, ts, userId, sku]
      );
      if (!upd.changes) {
        await d.run(
          `${d.insertIgnore} INTO tg_entitlements (user_id, sku, expires_at, charge_id, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [userId, sku, expiresAt, chargeId, ts]
        );
      }
    },

    async getPurchase(chargeId) {
      const row = await d.get('SELECT * FROM tg_purchases WHERE charge_id = ?', [String(chargeId || '')]);
      if (!row) return null;
      return {
        chargeId: row.charge_id,
        intentId: row.intent_id,
        userId: row.user_id,
        telegramUserId: String(row.telegram_user_id),
        sku: row.sku,
        stars: Number(row.stars),
        isRecurring: Boolean(row.is_recurring),
        expiresAt: row.expires_at || null,
        refundedAt: row.refunded_at || null,
        createdAt: row.created_at
      };
    },

    // A refund revokes the entitlement that charge granted (only if no later charge renewed it).
    async markRefunded(chargeId) {
      const p = await this.getPurchase(chargeId);
      if (!p) return { found: false };
      if (!p.refundedAt) {
        await d.run('UPDATE tg_purchases SET refunded_at = ? WHERE charge_id = ?', [now(), p.chargeId]);
      }
      await d.run('DELETE FROM tg_entitlements WHERE user_id = ? AND sku = ? AND charge_id = ?', [p.userId, p.sku, p.chargeId]);
      return { found: true, purchase: p };
    },

    async listEntitlements(userId) {
      const rows = await d.all('SELECT * FROM tg_entitlements WHERE user_id = ?', [userId]);
      return rows.filter(isActive).map(r => ({ sku: r.sku, expiresAt: r.expires_at || null }));
    },

    async hasEntitlement(userId, sku) {
      const row = await d.get('SELECT * FROM tg_entitlements WHERE user_id = ? AND sku = ?', [userId, sku]);
      return Boolean(row && isActive(row));
    },

    async createShare({ kind, ownerUserId, payload }) {
      const id = crypto.randomBytes(6).toString('base64url');
      await d.run(
        'INSERT INTO tg_shares (id, kind, owner_user_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, kind, ownerUserId, JSON.stringify(payload), now()]
      );
      return { id, kind };
    },

    async getShare(id) {
      const row = await d.get('SELECT * FROM tg_shares WHERE id = ?', [String(id || '')]);
      if (!row) return null;
      let payload = null;
      try { payload = JSON.parse(row.payload_json); } catch { payload = null; }
      return { id: row.id, kind: row.kind, ownerUserId: row.owner_user_id, payload, createdAt: row.created_at };
    },

    async createTurnWatch({ userId, telegramUserId, roomCode }) {
      const token = crypto.randomBytes(18).toString('base64url');
      await d.run(
        'INSERT INTO tg_turn_watches (token, user_id, telegram_user_id, room_code, created_at) VALUES (?, ?, ?, ?, ?)',
        [token, userId, String(telegramUserId), String(roomCode), now()]
      );
      return { token };
    },

    async getTurnWatch(token) {
      const row = await d.get('SELECT * FROM tg_turn_watches WHERE token = ?', [String(token || '')]);
      if (!row) return null;
      return {
        token: row.token,
        userId: row.user_id,
        telegramUserId: String(row.telegram_user_id),
        roomCode: row.room_code,
        createdAt: row.created_at,
        lastNotifiedAt: row.last_notified_at || null
      };
    },

    async markTurnNotified(token) {
      await d.run('UPDATE tg_turn_watches SET last_notified_at = ? WHERE token = ?', [now(), String(token)]);
    }
  };
}

module.exports = { createTelegramStore, SQLITE_DDL, MYSQL_DDL };
