# Verification record

## Current verification — 27 October 2026

`npm test` passes on Node 24.19.0: 624 simulation checks across 43 items, 191 API/account checks (815 combined), and the server-AI suite. Earlier counts below describe historical coverage. New checks cover wind strength/cadence, round resets, dead-player cycle handling, snapshot sanitization, the bounded wind gauge, accepted-shot capture after value clamping, player isolation, and host/guest previous-shot filtering. Predictive aiming remains disabled.

Claude Opus 5.5 reviewed the exact Argon patches before integration. Browser/WebGL visual verification has not been repeated for this update. MySQL adapter checks use a fake pool; account integration uses SQLite. No live-host wake or deployment was performed by ChatGPT.

## Automated regression suite

`npm test` runs 316 assertions against the inline application logic in a Node VM with a small DOM fixture and the same Three.js version used by the browser. It exercises all 39 inventory items, offensive-action completion, finite terrain/health, shields, batteries, parachutes, boundary rules, CIWS charges, purchasing, rewards and power caps. Camera checks cover focus, exploration panning, launch-to-tactical transitions, post-flight control recovery, trail construction/expiry, tree pooling, water setup, and all four enlarged terrain generators.

The fixture does not render WebGL, exercise the real DOM, emulate WebRTC, or call Gemini. It is not a substitute for browser tests.

## Player account & backend suite (Node >=22.5)

In addition to the 154 simulation checks, `npm test` runs the 185-check HTTP API and data-layer verification suite (339 assertions total) against `scripts/serve.cjs`, `scripts/api.cjs`, `scripts/auth.cjs`, `scripts/db.cjs`, and `scripts/db-check.cjs`:

- **Runtime requirement**: Node `>=22.5.0` (`node:sqlite` is the sole local/test embedded store; the legacy Node 20 JSON-file fallback has been removed).
- **Proxy-aware rate limiting & bounded map**: Verifies `X-Forwarded-For` is ignored unless `TRUST_PROXY` is set, that `TRUST_PROXY` is treated as the trusted proxy hop count from the right end of `X-Forwarded-For` (falling back to the socket address when the header has fewer entries than `TRUST_PROXY`), that client-supplied left-most `X-Forwarded-For` values cannot change the rate-limit key, and that expired rate-limit entries are pruned on subsequent checks.
- **Brute-force caps**: Verifies that email-verification attempts are counted atomically in the database before comparing the code (`email_verify_invalidated` after 5 attempts, so even 20 parallel wrong guesses followed by the real code are refused), that `/api/auth/resend-code` is rate-limited per account (`resend_rate_limited`, 3 per 15 min), and that TOTP 2FA attempts are capped per account (`totp_rate_limited`, 5 per 15 min) across distinct client IPs.
- **Session cookie security**: Verifies `Set-Cookie` includes `; Secure` on all hosts except `localhost` and `127.0.0.1` (`[::1]`).
- **Async password hashing**: Verifies `hashPassword` and `verifyPassword` use async `bcrypt.hash` / `bcrypt.compare` returning Promises (`hashSync` / `compareSync` are not used).
- **Verified-email requirement for ranked play & unverified login consistency**: Verifies unverified accounts receive a session on registration and on `/api/auth/login` (`emailVerified: false`, still enforcing password and TOTP when enabled) for unranked play, are blocked from `/api/matches/start` and `/api/matches/:id/attest` with `403 { code: 'email_unverified' }`, never appear on `GET /api/leaderboard`, and have unranked vs ranked status surfaced in `index.html`.
- **Single-CAS match finalization**: Verifies `submitAttestation` only updates when `attested = 0` (rejecting duplicates with `409`) and `finalizeMatch` uses a single compare-and-set (`WHERE id = ? AND status = 'pending' AND nonce_used = 0`) inside a transaction so parallel final attestations increment `wins`, `kills`, `losses`, and `matches_played` by exactly 1.
- **MySQL data layer (`mysql2`)**: Selected when `DB_HOST` is set in production (e.g., on DreamHost), while keeping `node:sqlite` via `DB_PATH` when `DB_HOST` is unset. Builds the `mysql2/promise` pool from a plain `{ host, port, user, password, database }` options object (never a connection URL string), with `DB_PORT` defaulting to `3306` and `DB_PASSWORD` taken verbatim without URL encoding or trimming so any character works. Clamps `LIMIT` to an integer `1..100` for `getLeaderboard` and `getMatchHistoryByUser` without a bound `LIMIT ?` placeholder (avoiding MySQL 8.0.22+ `mysqld_stmt_execute` errors). **Note:** Because no live MySQL database is available in CI/local test runs, the main test suite runs on SQLite and exercises the MySQL adapter via unit tests with an injected fake `mysql2/promise` pool, asserting schema creation on start-up, full CRUD/match/leaderboard parity, CAS finalization, and strict `?` parameterized queries with zero user-value interpolation.
- **MySQL start-up validation, post-handshake TLS pinning & password redaction**: When `DB_HOST` is set, start-up synchronously validates that `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are present, failing immediately with an error naming the missing setting(s). By default (`DB_SSL=verify`), `openStore` requires `DB_SSL_CA` (resolving relative paths from the project root and verifying `certs/dreamhost-mysql-ca.pem`'s X.509 sha256 fingerprint) and passes `{ ca, rejectUnauthorized: true }` to `mysql2` (without passing an inert `ssl.checkServerIdentity`, which `mysql2` ignores). Before any pooled connection is used, `wrapMysqlPool` and `verifyConnectionTls` inspect the live socket (`conn.connection.stream`), refuse any non-TLS stream when `DB_SSL` is `verify` or `require`, and when `DB_SSL_FINGERPRINT` is set compare `getPeerCertificate().fingerprint256` case-insensitively to `DB_SSL_FINGERPRINT` — destroying (never releasing) the connection and throwing `ERR_MYSQL_CERT_PIN_MISMATCH` on mismatch, while caching verified connections in a `WeakSet` and routing both `pool.execute` and `pool.query` through `getConnection`. Verified against a real `tls.createServer` / `tls.connect` socket using the throwaway test-only fixtures in `tests/fixtures/tls/`. Also verifies `DB_SSL=require` (`rejectUnauthorized: false` with warning), `DB_SSL=off` (explicit plaintext with warning), never falling back to plaintext silently, and clear TLS/pin error messages naming `DB_SSL_CA` and `DB_SSL_FINGERPRINT`. No log line, error message, stack trace, `sqlMessage`, or test output ever contains the `DB_PASSWORD` value or its URL-encoded form.
- **Database connectivity & TLS pin check (`npm run db:check`)**: `scripts/db-check.cjs` loads `.env`, opens the store, verifies the TLS socket and certificate pin, and prints only five lines (`backend`, `Ssl_version`, `Ssl_cipher`, `pin matched`, and `tables`), never printing `DB_PASSWORD`:
  ```text
  backend: mysql
  Ssl_version: TLSv1.3
  Ssl_cipher: TLS_AES_256_GCM_SHA384
  pin matched: yes
  tables: 5
  ```
- **Automatic `.env` loading on direct server start**: When `scripts/serve.cjs` is run as the main program (`npm start`), `loadProjectEnv` calls `process.loadEnvFile` on the project-root `.env` before reading settings; a missing `.env` is tolerated without error, pre-existing environment variables take precedence over `.env` values, and `require`ing `scripts/serve.cjs` from tests never loads `.env`.

## Browser checks completed

- Original release: local and hosted deployment; six-human hotseat; invalid player-count and room-code validation; movement/fuel; aiming and keyboard controls; low/balanced/high selection; shield activation; battery health/power recovery; help; nuclear craters; parachute consumption; FPV targeting; elimination; round awards and compound interest; all shop categories and sequential ready handoff. Every item category was purchased through the UI, but not every item effect was individually inspected in the browser.
- Private multiplayer: two local browser tabs joined a real PeerJS room, started with matching state, transferred turns and accepted remote firing.
- Charred Ground update: visible 480-meter battlefield, trees, rocks, animated water and shores; tank focus; exploration; orbit/tilt/zoom controls; exploration keyboard input; 3D launch view; automatic tactical return with visible trajectory; controls re-enabled after impact.

## Remaining verification

Live Gemini requests with a valid key, public matchmaking at scale, cross-network TURN behavior, long-session memory stability, mobile layouts and sustained 60 FPS are not certified. Individual weapon visuals and defensive interactions still need a complete browser matrix. Water/trees are scenery and do not add collision rules. The 1D terrain cannot represent overhangs or caves.

Browser inspection found a parachute that could remain drawn after landing; the landing path now clears that flag. Camera testing found controls could stay disabled after flight; phase transitions now resynchronize them. High shots now increase tactical framing distance to keep the trajectory in view.

## Map editor update

190 checks pass, including the original weapons/camera suite and new coastal deck crossing, intermediate water gaps, isolated platform destruction and falling, stable flatten/water brushes, strict map imports, local storage, prototype-like names, full editor cancel restoration, paused simulation/AI, invalid Apply handling, custom-map round resets, host snapshots and (at that release) projectile prediction against decks. The full inline script also receives a syntax check.

The embedded browser repeatedly timed out opening the editor preview during this update. New editor layout, pointer interactions and two-browser platform rendering therefore remain unverified in a real browser; the simulation tests are not visual certification.

Argon drafted the feature and correction patches through the user-authorized #charred-ground session bus. Codex reviewed and integrated the patches, resolved runtime and test mismatches, and ran the checks. Relay credentials and transcripts are excluded from the repository.

## Combat expansion update

316 checks pass across 39 items. New assertions cover both players’ first four personal turns, invalid/zero-cost commands, action retention after flight, piloted 3D steering, wind independent of throttle, stale/non-owner/malformed input rejection, snapshot state, three-shot limits, orbital movement, shield/canopy laser interception, silo destruction, friendly-target rejection, net/shotgun defenses, satellite caps, blast cover, deck-supported structures, and round resets.

The test fixture does not certify real DOM keyboard events, WebGL presentation or live PeerJS steering. The embedded browser showed both existing tabs as crashed; reconnecting could not inspect the crash document, and a fresh local preview timed out. New visual/UI and live network checks remain outstanding.
