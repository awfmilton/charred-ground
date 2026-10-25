'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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

function openSqliteStore(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const SqliteDB = getNativeDatabaseSync();
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
    db,
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
      const row = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
      return formatUser(row);
    },

    getUserByEmail(email) {
      if (!email) return null;
      const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
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
        SET email_verify_hash = ?, email_verify_expires_at = ?, updated_at = ?
        WHERE id = ?
      `).run(codeHash, expiresAt, now, userId);
      return this.getUserById(userId);
    },

    verifyEmailCode(userId) {
      const now = nowIso();
      db.prepare(`
        UPDATE users
        SET email_verified = 1, email_verify_hash = NULL, email_verify_expires_at = NULL, updated_at = ?
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
    },

    submitAttestation({ matchId, userId, attestationHash, payload, slotOutcome }) {
      const now = nowIso();
      db.prepare(`
        UPDATE match_participants
        SET attested = 1,
            attestation_hash = ?,
            payload_json = ?,
            kills = ?,
            final_hp = ?,
            won = ?,
            attested_at = ?
        WHERE match_id = ? AND user_id = ? AND is_ai = 0
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
      return this.getMatch(matchId);
    },

    finalizeMatch({ matchId, winnerUserId, canonicalHash, participantOutcomes, isBotMatch = false }) {
      const now = nowIso();
      const status = isBotMatch ? 'bot_match' : 'verified';
      db.prepare(`
        UPDATE matches
        SET status = ?, nonce_used = 1, winner_user_id = ?, canonical_hash = ?, completed_at = ?
        WHERE id = ?
      `).run(status, winnerUserId || null, canonicalHash, now, matchId);

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
            WHERE id = ?
          `).run(won ? 1 : 0, lost ? 1 : 0, Number(p.kills || 0), now, p.userId);
        }
      }

      return this.getMatch(matchId);
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
      const rows = db.prepare(`
        SELECT m.id, m.room_code, m.mode, m.round_number, m.status, m.winner_user_id,
               m.started_at, m.completed_at,
               mp.slot, mp.kills, mp.final_hp, mp.won
        FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = ? AND m.status IN ('verified', 'bot_match')
        ORDER BY COALESCE(m.completed_at, m.started_at) DESC
        LIMIT ?
      `).all(userId, Number(limit));
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
      const rows = db.prepare(`
        SELECT * FROM users
        WHERE email_verified = 1
        ORDER BY wins DESC, kills DESC, matches_played ASC, username ASC
        LIMIT ?
      `).all(Number(limit));
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
    },

    publicProfile
  };
}

function openFileStore(file) {
  const isMemory = !file || file === ':memory:';
  const resolved = isMemory ? null : path.resolve(file);
  if (resolved) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  let state = {
    users: [],
    oauth_accounts: [],
    sessions: [],
    matches: [],
    match_participants: []
  };

  function load() {
    if (!resolved || !fs.existsSync(resolved)) return;
    try {
      const raw = fs.readFileSync(resolved, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          oauth_accounts: Array.isArray(parsed.oauth_accounts) ? parsed.oauth_accounts : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          matches: Array.isArray(parsed.matches) ? parsed.matches : [],
          match_participants: Array.isArray(parsed.match_participants) ? parsed.match_participants : []
        };
      }
    } catch {}
  }

  function flush() {
    if (!resolved) return;
    const tmp = `${resolved}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
    fs.renameSync(tmp, resolved);
  }

  load();

  function migrate() {
    flush();
  }

  return {
    db: state,
    migrate,

    close() {
      flush();
    },

    createUser({ username, email, passwordHash = null, emailVerified = false, displayName = '', avatar = '', bio = '', customFields = [] }) {
      const unameLower = String(username).toLowerCase();
      const emailLower = String(email).toLowerCase();
      if (state.users.some(u => u.username.toLowerCase() === unameLower)) {
        throw new Error('UNIQUE constraint failed: users.username');
      }
      if (state.users.some(u => u.email.toLowerCase() === emailLower)) {
        throw new Error('UNIQUE constraint failed: users.email');
      }
      const id = crypto.randomUUID();
      const now = nowIso();
      const row = {
        id,
        username,
        email,
        password_hash: passwordHash,
        email_verified: emailVerified ? 1 : 0,
        email_verify_hash: null,
        email_verify_expires_at: null,
        totp_secret: null,
        totp_enabled: 0,
        display_name: displayName || username,
        avatar: avatar || '',
        bio: bio || '',
        custom_fields_json: JSON.stringify(customFields || []),
        wins: 0,
        losses: 0,
        kills: 0,
        matches_played: 0,
        created_at: now,
        updated_at: now
      };
      state.users.push(row);
      flush();
      return formatUser(row);
    },

    getUserById(id) {
      if (!id) return null;
      const row = state.users.find(u => u.id === id);
      return formatUser(row);
    },

    getUserByUsername(username) {
      if (!username) return null;
      const target = String(username).toLowerCase();
      const row = state.users.find(u => u.username.toLowerCase() === target);
      return formatUser(row);
    },

    getUserByEmail(email) {
      if (!email) return null;
      const target = String(email).toLowerCase();
      const row = state.users.find(u => u.email.toLowerCase() === target);
      return formatUser(row);
    },

    getUserByOAuth(provider, providerUserId) {
      const pid = String(providerUserId);
      const link = state.oauth_accounts.find(
        o => o.provider === provider && o.provider_user_id === pid
      );
      if (!link) return null;
      return this.getUserById(link.user_id);
    },

    linkOAuthAccount({ userId, provider, providerUserId, email = '' }) {
      const pid = String(providerUserId);
      const existing = state.oauth_accounts.find(
        o => o.provider === provider && o.provider_user_id === pid
      );
      if (existing) return existing;
      const row = {
        id: crypto.randomUUID(),
        user_id: userId,
        provider,
        provider_user_id: pid,
        email: email || '',
        created_at: nowIso()
      };
      state.oauth_accounts.push(row);
      flush();
      return row;
    },

    getOAuthProvidersForUser(userId) {
      return state.oauth_accounts
        .filter(o => o.user_id === userId)
        .map(o => o.provider);
    },

    setEmailVerificationCode(userId, codeHash, expiresAt) {
      const row = state.users.find(u => u.id === userId);
      if (!row) return null;
      row.email_verify_hash = codeHash;
      row.email_verify_expires_at = expiresAt;
      row.updated_at = nowIso();
      flush();
      return formatUser(row);
    },

    verifyEmailCode(userId) {
      const row = state.users.find(u => u.id === userId);
      if (!row) return null;
      row.email_verified = 1;
      row.email_verify_hash = null;
      row.email_verify_expires_at = null;
      row.updated_at = nowIso();
      flush();
      return formatUser(row);
    },

    setTotpSecret(userId, secret) {
      const row = state.users.find(u => u.id === userId);
      if (!row) return null;
      row.totp_secret = secret;
      row.totp_enabled = 0;
      row.updated_at = nowIso();
      flush();
      return formatUser(row);
    },

    enableTotp(userId) {
      const row = state.users.find(u => u.id === userId);
      if (!row) return null;
      row.totp_enabled = 1;
      row.updated_at = nowIso();
      flush();
      return formatUser(row);
    },

    disableTotp(userId) {
      const row = state.users.find(u => u.id === userId);
      if (!row) return null;
      row.totp_enabled = 0;
      row.totp_secret = null;
      row.updated_at = nowIso();
      flush();
      return formatUser(row);
    },

    createSession({ tokenHash, userId, expiresAt }) {
      const now = nowIso();
      state.sessions = state.sessions.filter(s => s.token_hash !== tokenHash);
      state.sessions.push({
        token_hash: tokenHash,
        user_id: userId,
        expires_at: expiresAt,
        created_at: now
      });
      flush();
      return { tokenHash, userId, expiresAt, createdAt: now };
    },

    getSession(tokenHash) {
      if (!tokenHash) return null;
      const row = state.sessions.find(s => s.token_hash === tokenHash);
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
      state.sessions = state.sessions.filter(s => s.token_hash !== tokenHash);
      flush();
    },

    updateProfile(userId, { displayName, avatar, bio, customFields }) {
      const row = state.users.find(u => u.id === userId);
      if (!row) return null;
      if (displayName !== undefined) row.display_name = displayName;
      if (avatar !== undefined) row.avatar = avatar;
      if (bio !== undefined) row.bio = bio;
      if (customFields !== undefined) row.custom_fields_json = JSON.stringify(customFields);
      row.updated_at = nowIso();
      flush();
      return formatUser(row);
    },

    createMatch({ hostUserId, nonce, roomCode = '', mode = 'online', roundNumber = 1, startedAt }) {
      if (state.matches.some(m => m.nonce === nonce)) {
        throw new Error('UNIQUE constraint failed: matches.nonce');
      }
      const id = crypto.randomUUID();
      const start = startedAt || nowIso();
      state.matches.push({
        id,
        nonce,
        nonce_used: 0,
        host_user_id: hostUserId,
        room_code: roomCode || '',
        mode,
        round_number: Number(roundNumber || 1),
        status: 'pending',
        winner_user_id: null,
        canonical_hash: null,
        reject_reason: null,
        started_at: start,
        completed_at: null
      });
      flush();
      return this.getMatch(id);
    },

    addParticipants(matchId, participants) {
      for (const p of participants) {
        state.match_participants.push({
          match_id: matchId,
          slot: Number(p.slot),
          user_id: p.userId || null,
          name: String(p.name || `Commander ${Number(p.slot) + 1}`),
          is_ai: p.ai ? 1 : 0,
          kills: 0,
          final_hp: 0,
          won: 0,
          attested: 0,
          attestation_hash: null,
          payload_json: null,
          attested_at: null
        });
      }
      flush();
      return this.getMatch(matchId);
    },

    getMatch(matchId) {
      if (!matchId) return null;
      const match = state.matches.find(m => m.id === matchId);
      if (!match) return null;
      const participants = state.match_participants
        .filter(p => p.match_id === matchId)
        .sort((a, b) => a.slot - b.slot);
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
    },

    submitAttestation({ matchId, userId, attestationHash, payload, slotOutcome }) {
      const now = nowIso();
      for (const p of state.match_participants) {
        if (p.match_id === matchId && p.user_id === userId && !p.is_ai) {
          p.attested = 1;
          p.attestation_hash = attestationHash;
          p.payload_json = JSON.stringify(payload);
          p.kills = Number(slotOutcome?.kills || 0);
          p.final_hp = Number(slotOutcome?.finalHp || 0);
          p.won = slotOutcome?.won ? 1 : 0;
          p.attested_at = now;
        }
      }
      flush();
      return this.getMatch(matchId);
    },

    finalizeMatch({ matchId, winnerUserId, canonicalHash, participantOutcomes, isBotMatch = false }) {
      const now = nowIso();
      const status = isBotMatch ? 'bot_match' : 'verified';
      const matchRow = state.matches.find(m => m.id === matchId);
      if (matchRow) {
        matchRow.status = status;
        matchRow.nonce_used = 1;
        matchRow.winner_user_id = winnerUserId || null;
        matchRow.canonical_hash = canonicalHash;
        matchRow.completed_at = now;
      }

      for (const o of participantOutcomes) {
        const part = state.match_participants.find(
          p => p.match_id === matchId && p.slot === Number(o.slot)
        );
        if (part) {
          part.kills = Number(o.kills || 0);
          part.final_hp = Number(o.finalHp || 0);
          part.won = o.won ? 1 : 0;
        }
      }

      if (!isBotMatch) {
        const match = this.getMatch(matchId);
        for (const p of match.participants) {
          if (!p.userId || p.ai) continue;
          const won = p.userId === winnerUserId && Boolean(winnerUserId);
          const lost = !won;
          const u = state.users.find(row => row.id === p.userId);
          if (u) {
            u.wins = Number(u.wins || 0) + (won ? 1 : 0);
            u.losses = Number(u.losses || 0) + (lost ? 1 : 0);
            u.kills = Number(u.kills || 0) + Number(p.kills || 0);
            u.matches_played = Number(u.matches_played || 0) + 1;
            u.updated_at = now;
          }
        }
      }

      flush();
      return this.getMatch(matchId);
    },

    rejectMatch(matchId, reason) {
      const now = nowIso();
      const matchRow = state.matches.find(m => m.id === matchId);
      if (matchRow) {
        matchRow.status = 'rejected';
        matchRow.nonce_used = 1;
        matchRow.reject_reason = String(reason || 'Rejected');
        matchRow.completed_at = now;
      }
      flush();
      return this.getMatch(matchId);
    },

    getMatchHistoryByUser(userId, limit = 20) {
      const joined = [];
      for (const mp of state.match_participants) {
        if (mp.user_id !== userId) continue;
        const m = state.matches.find(row => row.id === mp.match_id);
        if (!m || (m.status !== 'verified' && m.status !== 'bot_match')) continue;
        joined.push({ m, mp });
      }
      joined.sort((a, b) => {
        const ta = a.m.completed_at || a.m.started_at || '';
        const tb = b.m.completed_at || b.m.started_at || '';
        return tb.localeCompare(ta);
      });
      return joined.slice(0, Number(limit)).map(({ m, mp }) => ({
        matchId: m.id,
        roomCode: m.room_code,
        mode: m.mode,
        round: Number(m.round_number),
        status: m.status,
        winnerUserId: m.winner_user_id,
        slot: Number(mp.slot),
        kills: Number(mp.kills || 0),
        finalHp: Number(mp.final_hp || 0),
        won: Boolean(mp.won),
        startedAt: m.started_at,
        completedAt: m.completed_at
      }));
    },

    getLeaderboard(limit = 50) {
      const verified = state.users
        .filter(u => Boolean(u.email_verified))
        .slice()
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.kills !== a.kills) return b.kills - a.kills;
          if (a.matches_played !== b.matches_played) return a.matches_played - b.matches_played;
          return a.username.localeCompare(b.username);
        })
        .slice(0, Number(limit));

      return verified.map((row, idx) => {
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
    },

    publicProfile
  };
}

function openStore(options = {}) {
  const file = options.file || ':memory:';
  const forceFallback = options.forceFallback || process.env.FORCE_FILE_STORE === '1';
  if (!forceFallback && getNativeDatabaseSync()) {
    return openSqliteStore(file);
  }
  return openFileStore(file);
}

module.exports = {
  openStore,
  publicProfile
};
