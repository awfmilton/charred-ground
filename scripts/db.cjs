'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tls = require('node:tls');

let NativeDatabaseSync = undefined;
function getNativeDatabaseSync() {
  if (NativeDatabaseSync !== undefined) return NativeDatabaseSync;
  try {
    ({ DatabaseSync: NativeDatabaseSync } = require('node:sqlite'));
  } catch {
    NativeDatabaseSync = null;
  }
  return NativeDatabaseSync;
}

class EmbeddedSqliteShim {
  constructor(file) {
    this.isMemory = !file || file === ':memory:';
    this.resolved = this.isMemory ? null : path.resolve(file);
    if (this.resolved) {
      fs.mkdirSync(path.dirname(this.resolved), { recursive: true });
    }
    this.state = {
      users: [],
      oauth_accounts: [],
      sessions: [],
      matches: [],
      match_participants: []
    };
    this._txBackup = null;
    this._load();
  }

  _load() {
    if (!this.resolved || !fs.existsSync(this.resolved)) return;
    try {
      const raw = fs.readFileSync(this.resolved, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.state = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          oauth_accounts: Array.isArray(parsed.oauth_accounts) ? parsed.oauth_accounts : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          matches: Array.isArray(parsed.matches) ? parsed.matches : [],
          match_participants: Array.isArray(parsed.match_participants) ? parsed.match_participants : []
        };
      }
    } catch {}
  }

  _flush() {
    if (!this.resolved || this._txBackup !== null) return;
    const tmp = `${this.resolved}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(this.state), 'utf8');
    fs.renameSync(tmp, this.resolved);
  }

  exec(sql) {
    const norm = String(sql || '').replace(/\s+/g, ' ').trim();
    if (/^BEGIN\b/i.test(norm)) {
      this._txBackup = JSON.stringify(this.state);
      return;
    }
    if (/^COMMIT\b/i.test(norm)) {
      this._txBackup = null;
      this._flush();
      return;
    }
    if (/^ROLLBACK\b/i.test(norm)) {
      if (this._txBackup !== null) {
        this.state = JSON.parse(this._txBackup);
        this._txBackup = null;
      }
      return;
    }
    this._flush();
  }

  close() {
    this._txBackup = null;
    this._flush();
  }

  prepare(sql) {
    const norm = String(sql || '').replace(/\s+/g, ' ').trim();
    const self = this;
    const { state } = self;

    return {
      run(...params) {
        if (norm.startsWith('INSERT INTO users')) {
          const [
            id, username, email, password_hash, email_verified,
            display_name, avatar, bio, custom_fields_json, created_at, updated_at
          ] = params;
          const uLower = String(username).toLowerCase();
          const eLower = String(email).toLowerCase();
          if (state.users.some(u => u.username.toLowerCase() === uLower)) {
            throw new Error('UNIQUE constraint failed: users.username');
          }
          if (state.users.some(u => u.email.toLowerCase() === eLower)) {
            throw new Error('UNIQUE constraint failed: users.email');
          }
          state.users.push({
            id, username, email, password_hash, email_verified,
            email_verify_hash: null, email_verify_expires_at: null, email_verify_attempts: 0,
            totp_secret: null, totp_enabled: 0,
            display_name, avatar, bio, custom_fields_json,
            wins: 0, losses: 0, kills: 0, matches_played: 0,
            created_at, updated_at
          });
          self._flush();
          return { changes: 1 };
        }
        if (norm.startsWith('INSERT INTO oauth_accounts')) {
          const [id, user_id, provider, provider_user_id, email, created_at] = params;
          state.oauth_accounts.push({ id, user_id, provider, provider_user_id, email, created_at });
          self._flush();
          return { changes: 1 };
        }
        if (norm.startsWith('UPDATE users SET email_verify_hash = ?, email_verify_expires_at = ?, email_verify_attempts = 0')) {
          const [hash, exp, now, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.email_verify_hash = hash;
            u.email_verify_expires_at = exp;
            u.email_verify_attempts = 0;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET email_verify_attempts = email_verify_attempts + 1')) {
          const [now, id, maxAttempts] = params;
          const cap = Number(maxAttempts);
          const u = state.users.find(
            r => r.id === id && r.email_verify_hash !== null && Number(r.email_verify_attempts || 0) < cap
          );
          if (u) {
            u.email_verify_attempts = Number(u.email_verify_attempts || 0) + 1;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET email_verify_hash = NULL, email_verify_expires_at = NULL')) {
          const [now, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.email_verify_hash = null;
            u.email_verify_expires_at = null;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET email_verified = 1')) {
          const [now, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.email_verified = 1;
            u.email_verify_hash = null;
            u.email_verify_expires_at = null;
            u.email_verify_attempts = 0;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET totp_secret = ?')) {
          const [secret, now, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.totp_secret = secret;
            u.totp_enabled = 0;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET totp_enabled = 1')) {
          const [now, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.totp_enabled = 1;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET totp_enabled = 0, totp_secret = NULL')) {
          const [now, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.totp_enabled = 0;
            u.totp_secret = null;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET password_hash = NULL')) {
          const [now, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.password_hash = null;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm === 'DELETE FROM sessions WHERE user_id = ?') {
          const [userId] = params;
          const before = state.sessions.length;
          state.sessions = state.sessions.filter(s => s.user_id !== userId);
          self._flush();
          return { changes: before - state.sessions.length };
        }
        if (norm.startsWith('INSERT INTO sessions')) {
          const [token_hash, user_id, expires_at, created_at] = params;
          state.sessions = state.sessions.filter(s => s.token_hash !== token_hash);
          state.sessions.push({ token_hash, user_id, expires_at, created_at });
          self._flush();
          return { changes: 1 };
        }
        if (norm === 'DELETE FROM sessions WHERE token_hash = ?') {
          const [tokenHash] = params;
          const before = state.sessions.length;
          state.sessions = state.sessions.filter(s => s.token_hash !== tokenHash);
          self._flush();
          return { changes: before - state.sessions.length };
        }
        if (norm.startsWith('UPDATE users SET display_name = ?')) {
          const [display_name, avatar, bio, custom_fields_json, updated_at, id] = params;
          const u = state.users.find(r => r.id === id);
          if (u) {
            u.display_name = display_name;
            u.avatar = avatar;
            u.bio = bio;
            u.custom_fields_json = custom_fields_json;
            u.updated_at = updated_at;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('INSERT INTO matches')) {
          const [id, nonce, host_user_id, room_code, mode, round_number, started_at] = params;
          if (state.matches.some(m => m.nonce === nonce)) {
            throw new Error('UNIQUE constraint failed: matches.nonce');
          }
          state.matches.push({
            id, nonce, nonce_used: 0, host_user_id, room_code, mode, round_number,
            status: 'pending', winner_user_id: null, canonical_hash: null, reject_reason: null,
            started_at, completed_at: null
          });
          self._flush();
          return { changes: 1 };
        }
        if (norm.startsWith('INSERT INTO match_participants')) {
          const [match_id, slot, user_id, name, is_ai] = params;
          state.match_participants.push({
            match_id, slot, user_id, name, is_ai,
            kills: 0, final_hp: 0, won: 0, attested: 0,
            attestation_hash: null, payload_json: null, attested_at: null
          });
          self._flush();
          return { changes: 1 };
        }
        if (norm.startsWith('UPDATE match_participants SET attested = 1')) {
          const [attestation_hash, payload_json, kills, final_hp, won, attested_at, match_id, user_id] = params;
          let changes = 0;
          for (const mp of state.match_participants) {
            if (mp.match_id === match_id && mp.user_id === user_id && !mp.is_ai && Number(mp.attested || 0) === 0) {
              mp.attested = 1;
              mp.attestation_hash = attestation_hash;
              mp.payload_json = payload_json;
              mp.kills = kills;
              mp.final_hp = final_hp;
              mp.won = won;
              mp.attested_at = attested_at;
              changes = 1;
            }
          }
          self._flush();
          return { changes };
        }
        if (norm.startsWith('UPDATE matches SET status = ?, nonce_used = 1, winner_user_id = ?')) {
          const [status, winner_user_id, canonical_hash, completed_at, id] = params;
          const m = state.matches.find(r => r.id === id && r.status === 'pending' && Number(r.nonce_used || 0) === 0);
          if (m) {
            m.status = status;
            m.nonce_used = 1;
            m.winner_user_id = winner_user_id;
            m.canonical_hash = canonical_hash;
            m.completed_at = completed_at;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE match_participants SET kills = ?, final_hp = ?, won = ?')) {
          const [kills, final_hp, won, match_id, slot] = params;
          const mp = state.match_participants.find(r => r.match_id === match_id && r.slot === slot);
          if (mp) {
            mp.kills = kills;
            mp.final_hp = final_hp;
            mp.won = won;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith('UPDATE users SET wins = wins + ?')) {
          const [w, l, k, now, id] = params;
          const u = state.users.find(r => r.id === id && Number(r.email_verified || 0) === 1);
          if (u) {
            u.wins = Number(u.wins || 0) + Number(w || 0);
            u.losses = Number(u.losses || 0) + Number(l || 0);
            u.kills = Number(u.kills || 0) + Number(k || 0);
            u.matches_played = Number(u.matches_played || 0) + 1;
            u.updated_at = now;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (norm.startsWith("UPDATE matches SET status = 'rejected'")) {
          const [reject_reason, completed_at, id] = params;
          const m = state.matches.find(r => r.id === id);
          if (m) {
            m.status = 'rejected';
            m.nonce_used = 1;
            m.reject_reason = reject_reason;
            m.completed_at = completed_at;
            self._flush();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        return { changes: 0 };
      },

      get(...params) {
        if (norm.startsWith('SELECT COUNT(*) AS cnt FROM sqlite_master')) {
          return { cnt: 5 };
        }
        if (norm === 'SELECT * FROM users WHERE id = ?') {
          return state.users.find(u => u.id === params[0]);
        }
        if (norm === 'SELECT * FROM users WHERE LOWER(username) = LOWER(?)') {
          const t = String(params[0]).toLowerCase();
          return state.users.find(u => u.username.toLowerCase() === t);
        }
        if (norm === 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)') {
          const t = String(params[0]).toLowerCase();
          return state.users.find(u => u.email.toLowerCase() === t);
        }
        if (norm === 'SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?') {
          return state.oauth_accounts.find(
            o => o.provider === params[0] && o.provider_user_id === params[1]
          );
        }
        if (norm === 'SELECT * FROM sessions WHERE token_hash = ?') {
          return state.sessions.find(s => s.token_hash === params[0]);
        }
        if (norm === 'SELECT * FROM matches WHERE id = ?') {
          return state.matches.find(m => m.id === params[0]);
        }
        return undefined;
      },

      all(...params) {
        if (norm === 'SELECT provider FROM oauth_accounts WHERE user_id = ?') {
          return state.oauth_accounts
            .filter(o => o.user_id === params[0])
            .map(o => ({ provider: o.provider }));
        }
        if (norm === 'SELECT * FROM match_participants WHERE match_id = ? ORDER BY slot ASC') {
          return state.match_participants
            .filter(mp => mp.match_id === params[0])
            .slice()
            .sort((a, b) => a.slot - b.slot);
        }
        if (norm.startsWith('SELECT m.id, m.room_code, m.mode, m.round_number')) {
          const [userId, limit] = params;
          const rows = [];
          for (const mp of state.match_participants) {
            if (mp.user_id !== userId) continue;
            const m = state.matches.find(row => row.id === mp.match_id);
            if (!m || (m.status !== 'verified' && m.status !== 'bot_match')) continue;
            rows.push({
              id: m.id,
              room_code: m.room_code,
              mode: m.mode,
              round_number: m.round_number,
              status: m.status,
              winner_user_id: m.winner_user_id,
              started_at: m.started_at,
              completed_at: m.completed_at,
              slot: mp.slot,
              kills: mp.kills,
              final_hp: mp.final_hp,
              won: mp.won
            });
          }
          rows.sort((a, b) => {
            const ta = a.completed_at || a.started_at || '';
            const tb = b.completed_at || b.started_at || '';
            return tb.localeCompare(ta);
          });
          return rows.slice(0, Number(limit));
        }
        if (norm.startsWith('SELECT * FROM users WHERE email_verified = 1 ORDER BY wins DESC')) {
          const [limit] = params;
          return state.users
            .filter(u => Number(u.email_verified || 0) === 1)
            .slice()
            .sort((a, b) => {
              if (b.wins !== a.wins) return b.wins - a.wins;
              if (b.kills !== a.kills) return b.kills - a.kills;
              if (a.matches_played !== b.matches_played) return a.matches_played - b.matches_played;
              return a.username.localeCompare(b.username);
            })
            .slice(0, Number(limit));
        }
        return [];
      }
    };
  }
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAX_EMAIL_VERIFY_ATTEMPTS = 5;

function clampLimit(limit, fallback = 50) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return Math.min(100, Math.max(1, Math.trunc(Number(fallback) || 50)));
  return Math.min(100, Math.max(1, Math.trunc(n)));
}

function nowIso() {
  return new Date().toISOString();
}

function parseJsonSafe(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatUser(row) {
  if (!row) return null;
  const customFields = parseJsonSafe(row.custom_fields_json, []);
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    emailVerifyHash: row.email_verify_hash,
    emailVerifyExpiresAt: row.email_verify_expires_at,
    emailVerifyAttempts: Number(row.email_verify_attempts || 0),
    totpSecret: row.totp_secret,
    totpEnabled: Boolean(row.totp_enabled),
    displayName: row.display_name || row.username,
    avatar: row.avatar || '',
    bio: row.bio || '',
    customFields: Array.isArray(customFields) ? customFields : [],
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    kills: Number(row.kills || 0),
    matchesPlayed: Number(row.matches_played || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicProfile(user) {
  if (!user) return null;
  const wins = Number(user.wins || 0);
  const matchesPlayed = Number(user.matchesPlayed || 0);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar || '',
    bio: user.bio || '',
    customFields: user.customFields || [],
    stats: {
      wins,
      losses: Number(user.losses || 0),
      kills: Number(user.kills || 0),
      matchesPlayed,
      winRate: matchesPlayed > 0 ? Number(((wins / matchesPlayed) * 100).toFixed(1)) : 0
    },
    createdAt: user.createdAt
  };
}

function formatMatchRow(match, participants) {
  return {
    id: match.id,
    nonce: match.nonce,
    nonceUsed: Boolean(match.nonce_used),
    hostUserId: match.host_user_id,
    roomCode: match.room_code,
    mode: match.mode,
    roundNumber: Number(match.round_number),
    status: match.status,
    winnerUserId: match.winner_user_id,
    canonicalHash: match.canonical_hash,
    rejectReason: match.reject_reason,
    startedAt: match.started_at,
    completedAt: match.completed_at,
    participants: participants.map(p => ({
      matchId: p.match_id,
      slot: Number(p.slot),
      userId: p.user_id,
      name: p.name,
      ai: Boolean(p.is_ai),
      kills: Number(p.kills || 0),
      finalHp: Number(p.final_hp || 0),
      won: Boolean(p.won),
      attested: Boolean(p.attested),
      attestationHash: p.attestation_hash,
      payload: parseJsonSafe(p.payload_json, null),
      attestedAt: p.attested_at
    }))
  };
}

function formatLeaderboardRows(rows) {
  return rows.map((row, idx) => {
    const user = formatUser(row);
    const pub = publicProfile(user);
    return {
      rank: idx + 1,
      username: pub.username,
      displayName: pub.displayName,
      avatar: pub.avatar,
      wins: pub.stats.wins,
      losses: pub.stats.losses,
      kills: pub.stats.kills,
      matchesPlayed: pub.stats.matchesPlayed,
      winRate: pub.stats.winRate
    };
  });
}

function openSqliteStore(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const SqliteDB = getNativeDatabaseSync() || EmbeddedSqliteShim;
  const db = new SqliteDB(file);
  db.exec('PRAGMA foreign_keys = ON;');

  function migrate() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        email_verify_hash TEXT,
        email_verify_expires_at TEXT,
        email_verify_attempts INTEGER NOT NULL DEFAULT 0,
        totp_secret TEXT,
        totp_enabled INTEGER NOT NULL DEFAULT 0,
        display_name TEXT NOT NULL DEFAULT '',
        avatar TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        custom_fields_json TEXT NOT NULL DEFAULT '[]',
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        kills INTEGER NOT NULL DEFAULT 0,
        matches_played INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(provider, provider_user_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        nonce TEXT NOT NULL UNIQUE,
        nonce_used INTEGER NOT NULL DEFAULT 0,
        host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        room_code TEXT NOT NULL DEFAULT '',
        mode TEXT NOT NULL DEFAULT 'online',
        round_number INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        winner_user_id TEXT,
        canonical_hash TEXT,
        reject_reason TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS match_participants (
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        slot INTEGER NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        is_ai INTEGER NOT NULL DEFAULT 0,
        kills INTEGER NOT NULL DEFAULT 0,
        final_hp REAL NOT NULL DEFAULT 0,
        won INTEGER NOT NULL DEFAULT 0,
        attested INTEGER NOT NULL DEFAULT 0,
        attestation_hash TEXT,
        payload_json TEXT,
        attested_at TEXT,
        PRIMARY KEY (match_id, slot)
      );

      CREATE INDEX IF NOT EXISTS idx_users_wins ON users(wins DESC, kills DESC, matches_played ASC);
      CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id);
    `);
  }

  migrate();

  return {
    backend: 'sqlite',
    db,
    ready: Promise.resolve(),
    migrate,

    close() {
      db.close();
    },

    createUser({ username, email, passwordHash = null, emailVerified = false, displayName = '', avatar = '', bio = '', customFields = [] }) {
      const id = crypto.randomUUID();
      const now = nowIso();
      const stmt = db.prepare(`
        INSERT INTO users (
          id, username, email, password_hash, email_verified,
          display_name, avatar, bio, custom_fields_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        username,
        email,
        passwordHash,
        emailVerified ? 1 : 0,
        displayName || username,
        avatar || '',
        bio || '',
        JSON.stringify(customFields || []),
        now,
        now
      );
      return this.getUserById(id);
    },

    getUserById(id) {
      if (!id) return null;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return formatUser(row);
    },

    getUserByUsername(username) {
      if (!username) return null;
      const row = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
      return formatUser(row);
    },

    getUserByEmail(email) {
      if (!email) return null;
      const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
      return formatUser(row);
    },

    getUserByOAuth(provider, providerUserId) {
      const link = db.prepare(
        'SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?'
      ).get(provider, String(providerUserId));
      if (!link) return null;
      return this.getUserById(link.user_id);
    },

    linkOAuthAccount({ userId, provider, providerUserId, email = '' }) {
      const existing = db.prepare(
        'SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?'
      ).get(provider, String(providerUserId));
      if (existing) return existing;
      const id = crypto.randomUUID();
      const now = nowIso();
      db.prepare(`
        INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, userId, provider, String(providerUserId), email || '', now);
      return { id, user_id: userId, provider, provider_user_id: String(providerUserId), email };
    },

    getOAuthProvidersForUser(userId) {
      const rows = db.prepare('SELECT provider FROM oauth_accounts WHERE user_id = ?').all(userId);
      return rows.map(r => r.provider);
    },

    setEmailVerificationCode(userId, codeHash, expiresAt) {
      const now = nowIso();
      db.prepare(`
        UPDATE users
        SET email_verify_hash = ?, email_verify_expires_at = ?, email_verify_attempts = 0, updated_at = ?
        WHERE id = ?
      `).run(codeHash, expiresAt, now, userId);
      return this.getUserById(userId);
    },

    countEmailVerifyAttempt(userId) {
      const now = nowIso();
      const inc = db.prepare(`
        UPDATE users
        SET email_verify_attempts = email_verify_attempts + 1, updated_at = ?
        WHERE id = ? AND email_verify_hash IS NOT NULL AND email_verify_attempts < ?
      `).run(now, userId, MAX_EMAIL_VERIFY_ATTEMPTS);
      const user = this.getUserById(userId);
      if (!user) return { counted: false, attempts: 0, user: null };
      const counted = Number(inc.changes || 0) === 1;
      const attempts = Number(user.emailVerifyAttempts || 0);
      return { counted, attempts, user };
    },

    invalidateEmailVerificationCode(userId) {
      const now = nowIso();
      db.prepare(`
        UPDATE users
        SET email_verify_hash = NULL, email_verify_expires_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(now, userId);
      return this.getUserById(userId);
    },

    verifyEmailCode(userId) {
      const now = nowIso();
      db.prepare(`
        UPDATE users
        SET email_verified = 1, email_verify_hash = NULL, email_verify_expires_at = NULL, email_verify_attempts = 0, updated_at = ?
        WHERE id = ?
      `).run(now, userId);
      return this.getUserById(userId);
    },

    setTotpSecret(userId, secret) {
      const now = nowIso();
      db.prepare(`
        UPDATE users SET totp_secret = ?, totp_enabled = 0, updated_at = ? WHERE id = ?
      `).run(secret, now, userId);
      return this.getUserById(userId);
    },

    enableTotp(userId) {
      const now = nowIso();
      db.prepare(`
        UPDATE users SET totp_enabled = 1, updated_at = ? WHERE id = ?
      `).run(now, userId);
      return this.getUserById(userId);
    },

    disableTotp(userId) {
      const now = nowIso();
      db.prepare(`
        UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_at = ? WHERE id = ?
      `).run(now, userId);
      return this.getUserById(userId);
    },

    clearPasswordHash(userId) {
      const now = nowIso();
      db.prepare(`
        UPDATE users SET password_hash = NULL, updated_at = ? WHERE id = ?
      `).run(now, userId);
      return this.getUserById(userId);
    },

    deleteSessionsForUser(userId) {
      if (!userId) return;
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    },

    createSession({ tokenHash, userId, expiresAt }) {
      const now = nowIso();
      db.prepare(`
        INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `).run(tokenHash, userId, expiresAt, now);
      return { tokenHash, userId, expiresAt, createdAt: now };
    },

    getSession(tokenHash) {
      if (!tokenHash) return null;
      const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
      if (!row) return null;
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        this.deleteSession(tokenHash);
        return null;
      }
      const user = this.getUserById(row.user_id);
      if (!user) return null;
      return {
        tokenHash: row.token_hash,
        userId: row.user_id,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        user
      };
    },

    deleteSession(tokenHash) {
      if (!tokenHash) return;
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    },

    updateProfile(userId, { displayName, avatar, bio, customFields }) {
      const user = this.getUserById(userId);
      if (!user) return null;
      const now = nowIso();
      const nextDisplay = displayName !== undefined ? displayName : user.displayName;
      const nextAvatar = avatar !== undefined ? avatar : user.avatar;
      const nextBio = bio !== undefined ? bio : user.bio;
      const nextCustom = customFields !== undefined ? customFields : user.customFields;
      db.prepare(`
        UPDATE users
        SET display_name = ?, avatar = ?, bio = ?, custom_fields_json = ?, updated_at = ?
        WHERE id = ?
      `).run(nextDisplay, nextAvatar, nextBio, JSON.stringify(nextCustom), now, userId);
      return this.getUserById(userId);
    },

    createMatch({ hostUserId, nonce, roomCode = '', mode = 'online', roundNumber = 1, startedAt }) {
      const id = crypto.randomUUID();
      const start = startedAt || nowIso();
      db.prepare(`
        INSERT INTO matches (id, nonce, nonce_used, host_user_id, room_code, mode, round_number, status, started_at)
        VALUES (?, ?, 0, ?, ?, ?, ?, 'pending', ?)
      `).run(id, nonce, hostUserId, roomCode || '', mode, Number(roundNumber || 1), start);
      return this.getMatch(id);
    },

    addParticipants(matchId, participants) {
      const stmt = db.prepare(`
        INSERT INTO match_participants (match_id, slot, user_id, name, is_ai)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const p of participants) {
        stmt.run(
          matchId,
          Number(p.slot),
          p.userId || null,
          String(p.name || `Commander ${Number(p.slot) + 1}`),
          p.ai ? 1 : 0
        );
      }
      return this.getMatch(matchId);
    },

    getMatch(matchId) {
      if (!matchId) return null;
      const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
      if (!match) return null;
      const participants = db.prepare(
        'SELECT * FROM match_participants WHERE match_id = ? ORDER BY slot ASC'
      ).all(matchId);
      return formatMatchRow(match, participants);
    },

    submitAttestation({ matchId, userId, attestationHash, payload, slotOutcome }) {
      const now = nowIso();
      const info = db.prepare(`
        UPDATE match_participants
        SET attested = 1,
            attestation_hash = ?,
            payload_json = ?,
            kills = ?,
            final_hp = ?,
            won = ?,
            attested_at = ?
        WHERE match_id = ? AND user_id = ? AND is_ai = 0 AND attested = 0
      `).run(
        attestationHash,
        JSON.stringify(payload),
        Number(slotOutcome?.kills || 0),
        Number(slotOutcome?.finalHp || 0),
        slotOutcome?.won ? 1 : 0,
        now,
        matchId,
        userId
      );
      const match = this.getMatch(matchId);
      return match ? { ...match, attestedUpdated: Number(info.changes || 0) === 1 } : null;
    },

    finalizeMatch({ matchId, winnerUserId, canonicalHash, participantOutcomes, isBotMatch = false }) {
      const now = nowIso();
      const status = isBotMatch ? 'bot_match' : 'verified';
      db.exec('BEGIN IMMEDIATE');
      let wonCas = false;
      try {
        const cas = db.prepare(`
          UPDATE matches
          SET status = ?, nonce_used = 1, winner_user_id = ?, canonical_hash = ?, completed_at = ?
          WHERE id = ? AND status = 'pending' AND nonce_used = 0
        `).run(status, winnerUserId || null, canonicalHash, now, matchId);
        wonCas = Number(cas.changes || 0) === 1;

        if (wonCas) {
          const updatePart = db.prepare(`
            UPDATE match_participants
            SET kills = ?, final_hp = ?, won = ?
            WHERE match_id = ? AND slot = ?
          `);
          for (const o of participantOutcomes) {
            updatePart.run(
              Number(o.kills || 0),
              Number(o.finalHp || 0),
              o.won ? 1 : 0,
              matchId,
              Number(o.slot)
            );
          }

          if (!isBotMatch) {
            const match = this.getMatch(matchId);
            for (const p of match.participants) {
              if (!p.userId || p.ai) continue;
              const won = p.userId === winnerUserId && Boolean(winnerUserId);
              const lost = !won;
              db.prepare(`
                UPDATE users
                SET wins = wins + ?,
                    losses = losses + ?,
                    kills = kills + ?,
                    matches_played = matches_played + 1,
                    updated_at = ?
                WHERE id = ? AND email_verified = 1
              `).run(won ? 1 : 0, lost ? 1 : 0, Number(p.kills || 0), now, p.userId);
            }
          }
        }
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch {}
        throw err;
      }

      const match = this.getMatch(matchId);
      return match ? { ...match, finalized: wonCas } : null;
    },

    rejectMatch(matchId, reason) {
      const now = nowIso();
      db.prepare(`
        UPDATE matches
        SET status = 'rejected', nonce_used = 1, reject_reason = ?, completed_at = ?
        WHERE id = ?
      `).run(String(reason || 'Rejected'), now, matchId);
      return this.getMatch(matchId);
    },

    getMatchHistoryByUser(userId, limit = 20) {
      const safeLimit = clampLimit(limit, 20);
      const rows = db.prepare(`
        SELECT m.id, m.room_code, m.mode, m.round_number, m.status, m.winner_user_id,
               m.started_at, m.completed_at,
               mp.slot, mp.kills, mp.final_hp, mp.won
        FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = ? AND m.status IN ('verified', 'bot_match')
        ORDER BY COALESCE(m.completed_at, m.started_at) DESC
        LIMIT ?
      `).all(userId, safeLimit);
      return rows.map(r => ({
        matchId: r.id,
        roomCode: r.room_code,
        mode: r.mode,
        round: Number(r.round_number),
        status: r.status,
        winnerUserId: r.winner_user_id,
        slot: Number(r.slot),
        kills: Number(r.kills || 0),
        finalHp: Number(r.final_hp || 0),
        won: Boolean(r.won),
        startedAt: r.started_at,
        completedAt: r.completed_at
      }));
    },

    getLeaderboard(limit = 50) {
      const safeLimit = clampLimit(limit, 50);
      const rows = db.prepare(`
        SELECT * FROM users
        WHERE email_verified = 1
        ORDER BY wins DESC, kills DESC, matches_played ASC, username ASC
        LIMIT ?
      `).all(safeLimit);
      return formatLeaderboardRows(rows);
    },

    publicProfile
  };
}

function redactPassword(err, password) {
  if (!err || typeof password !== 'string' || password.length === 0) return err;
  const encoded = encodeURIComponent(password);
  const needles = encoded && encoded !== password ? [password, encoded] : [password];
  for (const prop of ['message', 'stack', 'sqlMessage']) {
    if (typeof err[prop] === 'string') {
      for (const needle of needles) {
        if (needle.length > 0 && err[prop].includes(needle)) {
          err[prop] = err[prop].split(needle).join('***');
        }
      }
    }
  }
  return err;
}

const TLS_ERROR_CODES = new Set([
  'ERR_MYSQL_CERT_PIN_MISMATCH',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'CERT_UNTRUSTED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'HANDSHAKE_SSL_ERROR'
]);

const TLS_ERROR_PREFIX = 'MySQL TLS verification failed:';

function formatTlsError(err, { caPath, fingerprint } = {}) {
  if (!err || typeof err !== 'object') return err;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  const isTls =
    TLS_ERROR_CODES.has(code) ||
    /certificate|self[- ]signed|checkServerIdentity|SSL|TLS/i.test(msg);
  if (!isTls) return err;
  if (!msg.startsWith(TLS_ERROR_PREFIX)) {
    const caLabel = caPath ? `DB_SSL_CA (${caPath})` : 'DB_SSL_CA';
    const fpLabel = fingerprint ? `DB_SSL_FINGERPRINT (${fingerprint})` : 'DB_SSL_FINGERPRINT';
    err.message = `${TLS_ERROR_PREFIX} the database certificate changed or could not be verified — check ${caLabel} and ${fpLabel}: ${msg}`;
  }
  return err;
}

function buildMysqlSslConfig({ options = {}, env = {} } = {}) {
  const rawMode = String(options.dbSsl ?? env.DB_SSL ?? '').trim();
  const mode = rawMode === '' ? 'verify' : rawMode.toLowerCase();
  if (mode !== 'verify' && mode !== 'require' && mode !== 'off') {
    throw new Error(`Invalid DB_SSL "${rawMode}": expected verify, require, or off`);
  }
  const warnings = [];
  if (mode === 'off') {
    warnings.push('[db] DB_SSL=off: the MySQL connection is UNENCRYPTED (plaintext).');
    return { mode, ssl: null, caPath: null, fingerprint: null, warnings };
  }
  if (mode === 'require') {
    warnings.push('[db] DB_SSL=require: the MySQL connection is encrypted but the server certificate is NOT verified.');
    return { mode, ssl: { rejectUnauthorized: false }, caPath: null, fingerprint: null, warnings };
  }

  const rawCa = String(options.dbSslCa ?? env.DB_SSL_CA ?? '').trim();
  if (!rawCa) {
    throw new Error(
      'DB_SSL=verify requires DB_SSL_CA (path to the MySQL server CA certificate PEM; relative paths resolve from the project root)'
    );
  }
  const caPath = path.isAbsolute(rawCa) ? rawCa : path.resolve(PROJECT_ROOT, rawCa);
  let caPem;
  try {
    caPem = fs.readFileSync(caPath, 'utf8');
  } catch (readErr) {
    throw new Error(`Cannot read the MySQL CA certificate from DB_SSL_CA (${rawCa}): ${readErr.message}`);
  }
  if (!caPem || !caPem.includes('BEGIN CERTIFICATE')) {
    throw new Error(`Cannot read the MySQL CA certificate from DB_SSL_CA (${rawCa}): file does not contain a PEM certificate`);
  }

  const rawFp = String(options.dbSslFingerprint ?? env.DB_SSL_FINGERPRINT ?? '').trim();
  let fingerprint = null;
  if (rawFp !== '') {
    if (!/^([0-9a-f]{2}:){31}[0-9a-f]{2}$/i.test(rawFp)) {
      throw new Error(
        `Invalid DB_SSL_FINGERPRINT "${rawFp}": expected 32 colon-separated hex bytes (sha256 of the server certificate)`
      );
    }
    fingerprint = rawFp.toUpperCase();
  }

  return {
    mode,
    ssl: {
      ca: caPem,
      rejectUnauthorized: true
    },
    caPath: rawCa,
    fingerprint,
    warnings
  };
}

function verifyConnectionTls(conn, tlsMeta = {}, verifiedSet = new WeakSet()) {
  if (!conn || typeof conn !== 'object') return;
  const sslMode = tlsMeta && tlsMeta.sslMode;
  if (sslMode !== 'verify' && sslMode !== 'require') return;

  const coreConn = conn.connection && typeof conn.connection === 'object' ? conn.connection : conn;
  if (verifiedSet && typeof verifiedSet.has === 'function' && verifiedSet.has(coreConn)) {
    return;
  }

  const stream = conn?.connection?.stream ?? conn?.stream ?? null;
  const destroyConn = () => {
    if (typeof conn.destroy === 'function') {
      conn.destroy();
    } else if (conn.connection && typeof conn.connection.destroy === 'function') {
      conn.connection.destroy();
    }
    if (stream && typeof stream.destroy === 'function' && !stream.destroyed) {
      stream.destroy();
    }
  };

  if (!(stream && stream.encrypted === true && typeof stream.getPeerCertificate === 'function')) {
    destroyConn();
    const err = new Error(
      `${TLS_ERROR_PREFIX} expected an encrypted TLS socket for DB_SSL=${sslMode}, but the connection stream is not TLS`
    );
    err.code = 'ERR_MYSQL_CERT_PIN_MISMATCH';
    throw err;
  }

  if (sslMode === 'verify' && tlsMeta.fingerprint) {
    const expectedFp = String(tlsMeta.fingerprint).toUpperCase();
    const peerCert = stream.getPeerCertificate() || {};
    const actualFp = String(peerCert.fingerprint256 || '').toUpperCase();
    if (actualFp !== expectedFp) {
      destroyConn();
      const caLabel = tlsMeta.caPath || 'unset';
      const err = new Error(
        `${TLS_ERROR_PREFIX} the database server certificate changed or could not be verified — expected DB_SSL_FINGERPRINT ${expectedFp}, got ${actualFp || 'none'} (CA from DB_SSL_CA ${caLabel})`
      );
      err.code = 'ERR_MYSQL_CERT_PIN_MISMATCH';
      throw err;
    }
  }

  if (verifiedSet && typeof verifiedSet.add === 'function') {
    verifiedSet.add(coreConn);
  }
}

function wrapMysqlPool(rawPool, password, tlsMeta = {}) {
  if (!rawPool) return rawPool;
  const sanitize = err => redactPassword(formatTlsError(err, tlsMeta), password);
  const verifiedConns = new WeakSet();
  const hasGetConnection = typeof rawPool.getConnection === 'function';

  const wrapConn = conn => {
    if (!conn || conn.__redactedWrapped) return conn;
    return new Proxy(conn, {
      get(target, prop, receiver) {
        if (prop === '__redactedWrapped') return true;
        if (prop === 'execute' || prop === 'query') {
          return async (...args) => {
            try {
              return await target[prop](...args);
            } catch (err) {
              throw sanitize(err);
            }
          };
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? val.bind(target) : val;
      }
    });
  };

  const acquireVerifiedConnection = async (...args) => {
    try {
      const conn = await rawPool.getConnection(...args);
      verifyConnectionTls(conn, tlsMeta, verifiedConns);
      return wrapConn(conn);
    } catch (err) {
      throw sanitize(err);
    }
  };

  return new Proxy(rawPool, {
    get(target, prop, receiver) {
      if (prop === 'getConnection' && hasGetConnection) {
        return acquireVerifiedConnection;
      }
      if (prop === 'execute' || prop === 'query') {
        if (hasGetConnection) {
          return async (...args) => {
            const conn = await acquireVerifiedConnection();
            try {
              const fn = typeof conn[prop] === 'function' ? conn[prop].bind(conn) : target[prop].bind(target);
              return await fn(...args);
            } catch (err) {
              throw sanitize(err);
            } finally {
              if (conn && typeof conn.release === 'function') {
                conn.release();
              }
            }
          };
        }
        return async (...args) => {
          try {
            return await target[prop](...args);
          } catch (err) {
            throw sanitize(err);
          }
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });
}

function openMysqlStore({
  host,
  port = 3306,
  user,
  password,
  database,
  ssl = null,
  sslMode = null,
  sslCaPath = null,
  sslFingerprint = null,
  pool: injectedPool,
  createPool
} = {}) {
  const tlsMeta = { sslMode, caPath: sslCaPath, fingerprint: sslFingerprint };
  let rawPool;
  try {
    rawPool =
      injectedPool ||
      (() => {
        const poolFactory = createPool || require('mysql2/promise').createPool;
        return poolFactory({ host, port, user, password, database, ...(ssl ? { ssl } : {}) });
      })();
  } catch (err) {
    throw redactPassword(formatTlsError(err, tlsMeta), password);
  }
  const pool = wrapMysqlPool(rawPool, password, tlsMeta);

  async function migrate() {
    const ddl = [
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        email_verified TINYINT(1) NOT NULL DEFAULT 0,
        email_verify_hash VARCHAR(128),
        email_verify_expires_at VARCHAR(40),
        email_verify_attempts INT NOT NULL DEFAULT 0,
        totp_secret VARCHAR(128),
        totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
        display_name VARCHAR(80) NOT NULL DEFAULT '',
        avatar VARCHAR(512) NOT NULL DEFAULT '',
        bio TEXT NOT NULL,
        custom_fields_json TEXT NOT NULL,
        wins INT NOT NULL DEFAULT 0,
        losses INT NOT NULL DEFAULT 0,
        kills INT NOT NULL DEFAULT 0,
        matches_played INT NOT NULL DEFAULT 0,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        INDEX idx_users_wins (wins DESC, kills DESC, matches_played ASC)
      )`,
      `CREATE TABLE IF NOT EXISTS oauth_accounts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        provider_user_id VARCHAR(128) NOT NULL,
        email VARCHAR(255),
        created_at VARCHAR(40) NOT NULL,
        UNIQUE KEY uniq_oauth_provider_user (provider, provider_user_id),
        CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        token_hash VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        expires_at VARCHAR(40) NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(36) PRIMARY KEY,
        nonce VARCHAR(128) NOT NULL UNIQUE,
        nonce_used TINYINT(1) NOT NULL DEFAULT 0,
        host_user_id VARCHAR(36) NOT NULL,
        room_code VARCHAR(64) NOT NULL DEFAULT '',
        mode VARCHAR(32) NOT NULL DEFAULT 'online',
        round_number INT NOT NULL DEFAULT 1,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        winner_user_id VARCHAR(36),
        canonical_hash VARCHAR(128),
        reject_reason VARCHAR(255),
        started_at VARCHAR(40) NOT NULL,
        completed_at VARCHAR(40),
        CONSTRAINT fk_matches_host FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS match_participants (
        match_id VARCHAR(36) NOT NULL,
        slot INT NOT NULL,
        user_id VARCHAR(36),
        name VARCHAR(80) NOT NULL,
        is_ai TINYINT(1) NOT NULL DEFAULT 0,
        kills INT NOT NULL DEFAULT 0,
        final_hp DOUBLE NOT NULL DEFAULT 0,
        won TINYINT(1) NOT NULL DEFAULT 0,
        attested TINYINT(1) NOT NULL DEFAULT 0,
        attestation_hash VARCHAR(128),
        payload_json LONGTEXT,
        attested_at VARCHAR(40),
        PRIMARY KEY (match_id, slot),
        INDEX idx_match_participants_user (user_id),
        CONSTRAINT fk_mp_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        CONSTRAINT fk_mp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`
    ];
    for (const stmt of ddl) {
      await pool.execute(stmt, []);
    }
  }

  const ready = migrate();

  return {
    backend: 'mysql',
    db: pool,
    tlsMeta,
    ready,
    migrate,

    async close() {
      await pool.end();
    },

    async createUser({ username, email, passwordHash = null, emailVerified = false, displayName = '', avatar = '', bio = '', customFields = [] }) {
      const id = crypto.randomUUID();
      const now = nowIso();
      await pool.execute(
        `INSERT INTO users (
          id, username, email, password_hash, email_verified,
          display_name, avatar, bio, custom_fields_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          username,
          email,
          passwordHash,
          emailVerified ? 1 : 0,
          displayName || username,
          avatar || '',
          bio || '',
          JSON.stringify(customFields || []),
          now,
          now
        ]
      );
      return this.getUserById(id);
    },

    async getUserById(id) {
      if (!id) return null;
      const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      return formatUser(rows[0]);
    },

    async getUserByUsername(username) {
      if (!username) return null;
      const [rows] = await pool.execute('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
      return formatUser(rows[0]);
    },

    async getUserByEmail(email) {
      if (!email) return null;
      const [rows] = await pool.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
      return formatUser(rows[0]);
    },

    async getUserByOAuth(provider, providerUserId) {
      const [rows] = await pool.execute(
        'SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?',
        [provider, String(providerUserId)]
      );
      const link = rows[0];
      if (!link) return null;
      return this.getUserById(link.user_id);
    },

    async linkOAuthAccount({ userId, provider, providerUserId, email = '' }) {
      const pid = String(providerUserId);
      const [existingRows] = await pool.execute(
        'SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?',
        [provider, pid]
      );
      if (existingRows[0]) return existingRows[0];
      const id = crypto.randomUUID();
      const now = nowIso();
      await pool.execute(
        `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, provider, pid, email || '', now]
      );
      return { id, user_id: userId, provider, provider_user_id: pid, email };
    },

    async getOAuthProvidersForUser(userId) {
      const [rows] = await pool.execute('SELECT provider FROM oauth_accounts WHERE user_id = ?', [userId]);
      return rows.map(r => r.provider);
    },

    async setEmailVerificationCode(userId, codeHash, expiresAt) {
      const now = nowIso();
      await pool.execute(
        `UPDATE users
         SET email_verify_hash = ?, email_verify_expires_at = ?, email_verify_attempts = 0, updated_at = ?
         WHERE id = ?`,
        [codeHash, expiresAt, now, userId]
      );
      return this.getUserById(userId);
    },

    async countEmailVerifyAttempt(userId) {
      const now = nowIso();
      const [incResult] = await pool.execute(
        `UPDATE users
         SET email_verify_attempts = email_verify_attempts + 1, updated_at = ?
         WHERE id = ? AND email_verify_hash IS NOT NULL AND email_verify_attempts < ?`,
        [now, userId, MAX_EMAIL_VERIFY_ATTEMPTS]
      );
      const user = await this.getUserById(userId);
      if (!user) return { counted: false, attempts: 0, user: null };
      const counted = Number(incResult?.affectedRows || 0) === 1;
      const attempts = Number(user.emailVerifyAttempts || 0);
      return { counted, attempts, user };
    },

    async invalidateEmailVerificationCode(userId) {
      const now = nowIso();
      await pool.execute(
        `UPDATE users
         SET email_verify_hash = NULL, email_verify_expires_at = NULL, updated_at = ?
         WHERE id = ?`,
        [now, userId]
      );
      return this.getUserById(userId);
    },

    async verifyEmailCode(userId) {
      const now = nowIso();
      await pool.execute(
        `UPDATE users
         SET email_verified = 1, email_verify_hash = NULL, email_verify_expires_at = NULL, email_verify_attempts = 0, updated_at = ?
         WHERE id = ?`,
        [now, userId]
      );
      return this.getUserById(userId);
    },

    async setTotpSecret(userId, secret) {
      const now = nowIso();
      await pool.execute(
        'UPDATE users SET totp_secret = ?, totp_enabled = 0, updated_at = ? WHERE id = ?',
        [secret, now, userId]
      );
      return this.getUserById(userId);
    },

    async enableTotp(userId) {
      const now = nowIso();
      await pool.execute(
        'UPDATE users SET totp_enabled = 1, updated_at = ? WHERE id = ?',
        [now, userId]
      );
      return this.getUserById(userId);
    },

    async disableTotp(userId) {
      const now = nowIso();
      await pool.execute(
        'UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_at = ? WHERE id = ?',
        [now, userId]
      );
      return this.getUserById(userId);
    },

    async clearPasswordHash(userId) {
      const now = nowIso();
      await pool.execute(
        'UPDATE users SET password_hash = NULL, updated_at = ? WHERE id = ?',
        [now, userId]
      );
      return this.getUserById(userId);
    },

    async deleteSessionsForUser(userId) {
      if (!userId) return;
      await pool.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);
    },

    async createSession({ tokenHash, userId, expiresAt }) {
      const now = nowIso();
      await pool.execute(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
        [tokenHash, userId, expiresAt, now]
      );
      return { tokenHash, userId, expiresAt, createdAt: now };
    },

    async getSession(tokenHash) {
      if (!tokenHash) return null;
      const [rows] = await pool.execute('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);
      const row = rows[0];
      if (!row) return null;
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        await this.deleteSession(tokenHash);
        return null;
      }
      const user = await this.getUserById(row.user_id);
      if (!user) return null;
      return {
        tokenHash: row.token_hash,
        userId: row.user_id,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        user
      };
    },

    async deleteSession(tokenHash) {
      if (!tokenHash) return;
      await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    },

    async updateProfile(userId, { displayName, avatar, bio, customFields }) {
      const user = await this.getUserById(userId);
      if (!user) return null;
      const now = nowIso();
      const nextDisplay = displayName !== undefined ? displayName : user.displayName;
      const nextAvatar = avatar !== undefined ? avatar : user.avatar;
      const nextBio = bio !== undefined ? bio : user.bio;
      const nextCustom = customFields !== undefined ? customFields : user.customFields;
      await pool.execute(
        `UPDATE users
         SET display_name = ?, avatar = ?, bio = ?, custom_fields_json = ?, updated_at = ?
         WHERE id = ?`,
        [nextDisplay, nextAvatar, nextBio, JSON.stringify(nextCustom), now, userId]
      );
      return this.getUserById(userId);
    },

    async createMatch({ hostUserId, nonce, roomCode = '', mode = 'online', roundNumber = 1, startedAt }) {
      const id = crypto.randomUUID();
      const start = startedAt || nowIso();
      await pool.execute(
        `INSERT INTO matches (id, nonce, nonce_used, host_user_id, room_code, mode, round_number, status, started_at)
         VALUES (?, ?, 0, ?, ?, ?, ?, 'pending', ?)`,
        [id, nonce, hostUserId, roomCode || '', mode, Number(roundNumber || 1), start]
      );
      return this.getMatch(id);
    },

    async addParticipants(matchId, participants) {
      for (const p of participants) {
        await pool.execute(
          `INSERT INTO match_participants (match_id, slot, user_id, name, is_ai)
           VALUES (?, ?, ?, ?, ?)`,
          [
            matchId,
            Number(p.slot),
            p.userId || null,
            String(p.name || `Commander ${Number(p.slot) + 1}`),
            p.ai ? 1 : 0
          ]
        );
      }
      return this.getMatch(matchId);
    },

    async getMatch(matchId) {
      if (!matchId) return null;
      const [matchRows] = await pool.execute('SELECT * FROM matches WHERE id = ?', [matchId]);
      const match = matchRows[0];
      if (!match) return null;
      const [participants] = await pool.execute(
        'SELECT * FROM match_participants WHERE match_id = ? ORDER BY slot ASC',
        [matchId]
      );
      return formatMatchRow(match, participants);
    },

    async submitAttestation({ matchId, userId, attestationHash, payload, slotOutcome }) {
      const now = nowIso();
      const [result] = await pool.execute(
        `UPDATE match_participants
         SET attested = 1,
             attestation_hash = ?,
             payload_json = ?,
             kills = ?,
             final_hp = ?,
             won = ?,
             attested_at = ?
         WHERE match_id = ? AND user_id = ? AND is_ai = 0 AND attested = 0`,
        [
          attestationHash,
          JSON.stringify(payload),
          Number(slotOutcome?.kills || 0),
          Number(slotOutcome?.finalHp || 0),
          slotOutcome?.won ? 1 : 0,
          now,
          matchId,
          userId
        ]
      );
      const match = await this.getMatch(matchId);
      return match ? { ...match, attestedUpdated: Number(result?.affectedRows || 0) === 1 } : null;
    },

    async finalizeMatch({ matchId, winnerUserId, canonicalHash, participantOutcomes, isBotMatch = false }) {
      const now = nowIso();
      const status = isBotMatch ? 'bot_match' : 'verified';
      const conn = typeof pool.getConnection === 'function' ? await pool.getConnection() : pool;
      let wonCas = false;
      try {
        if (typeof conn.beginTransaction === 'function') {
          await conn.beginTransaction();
        }
        const [casResult] = await conn.execute(
          `UPDATE matches
           SET status = ?, nonce_used = 1, winner_user_id = ?, canonical_hash = ?, completed_at = ?
           WHERE id = ? AND status = 'pending' AND nonce_used = 0`,
          [status, winnerUserId || null, canonicalHash, now, matchId]
        );
        wonCas = Number(casResult?.affectedRows || 0) === 1;

        if (wonCas) {
          for (const o of participantOutcomes) {
            await conn.execute(
              `UPDATE match_participants
               SET kills = ?, final_hp = ?, won = ?
               WHERE match_id = ? AND slot = ?`,
              [Number(o.kills || 0), Number(o.finalHp || 0), o.won ? 1 : 0, matchId, Number(o.slot)]
            );
          }

          if (!isBotMatch) {
            const [partRows] = await conn.execute(
              'SELECT * FROM match_participants WHERE match_id = ? ORDER BY slot ASC',
              [matchId]
            );
            for (const p of partRows) {
              const userId = p.user_id || null;
              const isAi = Boolean(p.is_ai);
              if (!userId || isAi) continue;
              const won = userId === winnerUserId && Boolean(winnerUserId);
              const lost = !won;
              await conn.execute(
                `UPDATE users
                 SET wins = wins + ?,
                     losses = losses + ?,
                     kills = kills + ?,
                     matches_played = matches_played + 1,
                     updated_at = ?
                 WHERE id = ? AND email_verified = 1`,
                [won ? 1 : 0, lost ? 1 : 0, Number(p.kills || 0), now, userId]
              );
            }
          }
        }

        if (typeof conn.commit === 'function') {
          await conn.commit();
        }
      } catch (err) {
        if (typeof conn.rollback === 'function') {
          try { await conn.rollback(); } catch {}
        }
        throw err;
      } finally {
        if (typeof conn.release === 'function') {
          conn.release();
        }
      }

      const match = await this.getMatch(matchId);
      return match ? { ...match, finalized: wonCas } : null;
    },

    async rejectMatch(matchId, reason) {
      const now = nowIso();
      await pool.execute(
        `UPDATE matches
         SET status = 'rejected', nonce_used = 1, reject_reason = ?, completed_at = ?
         WHERE id = ?`,
        [String(reason || 'Rejected'), now, matchId]
      );
      return this.getMatch(matchId);
    },

    async getMatchHistoryByUser(userId, limit = 20) {
      const safeLimit = clampLimit(limit, 20);
      const [rows] = await pool.execute(
        `SELECT m.id, m.room_code, m.mode, m.round_number, m.status, m.winner_user_id,
                m.started_at, m.completed_at,
                mp.slot, mp.kills, mp.final_hp, mp.won
         FROM match_participants mp
         JOIN matches m ON m.id = mp.match_id
         WHERE mp.user_id = ? AND m.status IN ('verified', 'bot_match')
         ORDER BY COALESCE(m.completed_at, m.started_at) DESC
         LIMIT ${safeLimit}`,
        [userId]
      );
      return rows.map(r => ({
        matchId: r.id,
        roomCode: r.room_code,
        mode: r.mode,
        round: Number(r.round_number),
        status: r.status,
        winnerUserId: r.winner_user_id,
        slot: Number(r.slot),
        kills: Number(r.kills || 0),
        finalHp: Number(r.final_hp || 0),
        won: Boolean(r.won),
        startedAt: r.started_at,
        completedAt: r.completed_at
      }));
    },

    async getLeaderboard(limit = 50) {
      const safeLimit = clampLimit(limit, 50);
      const [rows] = await pool.execute(
        `SELECT * FROM users
         WHERE email_verified = 1
         ORDER BY wins DESC, kills DESC, matches_played ASC, username ASC
         LIMIT ${safeLimit}`,
        []
      );
      return formatLeaderboardRows(rows);
    },

    publicProfile
  };
}

function openStore(options = {}) {
  const env = options.env || process.env;
  const dbHost = String(options.dbHost ?? env.DB_HOST ?? '').trim();
  if (dbHost) {
    const user = String(options.dbUser ?? env.DB_USER ?? '').trim();
    const password = String(options.dbPassword ?? env.DB_PASSWORD ?? '');
    const database = String(options.dbName ?? env.DB_NAME ?? '').trim();
    const missing = [];
    if (!user) missing.push('DB_USER');
    if (!password) missing.push('DB_PASSWORD');
    if (!database) missing.push('DB_NAME');
    if (missing.length > 0) {
      throw new Error(
        `MySQL configuration incomplete: DB_HOST is set but these settings are missing: ${missing.join(', ')}`
      );
    }
    const rawPort = String(options.dbPort ?? env.DB_PORT ?? '').trim();
    let port = 3306;
    if (rawPort !== '') {
      const parsedPort = Number(rawPort);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        throw new Error(`Invalid DB_PORT: "${rawPort}" (expected an integer between 1 and 65535)`);
      }
      port = parsedPort;
    }
    const sslConfig = buildMysqlSslConfig({ options, env });
    const warnFn = typeof options.warn === 'function' ? options.warn : console.warn;
    for (const msg of sslConfig.warnings) {
      warnFn(msg);
    }
    return openMysqlStore({
      host: dbHost,
      port,
      user,
      password,
      database,
      ssl: sslConfig.ssl,
      sslMode: sslConfig.mode,
      sslCaPath: sslConfig.caPath,
      sslFingerprint: sslConfig.fingerprint,
      pool: options.mysqlPool,
      createPool: options.createPool
    });
  }
  if (options.mysqlPool) {
    return openMysqlStore({
      pool: options.mysqlPool,
      password: String(options.dbPassword ?? env.DB_PASSWORD ?? ''),
      createPool: options.createPool
    });
  }
  const file = options.file || env.DB_PATH || ':memory:';
  return openSqliteStore(file);
}

module.exports = {
  openStore,
  openSqliteStore,
  openMysqlStore,
  buildMysqlSslConfig,
  wrapMysqlPool,
  verifyConnectionTls,
  formatTlsError,
  redactPassword,
  publicProfile,
  MAX_EMAIL_VERIFY_ATTEMPTS
};
