# Verification record

## Automated regression suite

`npm test` runs 154 assertions against the inline application logic in a Node VM with a small DOM fixture and the same Three.js version used by the browser. It exercises all 34 inventory items, offensive-action completion, finite terrain/health, shields, batteries, parachutes, boundary rules, CIWS charges, purchasing, rewards and power caps. Camera checks cover focus, exploration panning, launch-to-tactical transitions, post-flight control recovery, trail construction/expiry, tree pooling, water setup, and all four enlarged terrain generators.

The fixture does not render WebGL, exercise the real DOM, emulate WebRTC, or call Gemini. It is not a substitute for browser tests.

## Player account & backend suite (Node >=22.5)

In addition to the 154 simulation checks, `npm test` runs the full HTTP API and data-layer verification suite against `scripts/serve.cjs`, `scripts/api.cjs`, `scripts/auth.cjs`, and `scripts/db.cjs`:

- **Runtime requirement**: Node `>=22.5.0` (`node:sqlite` is the sole local/test embedded store; the legacy Node 20 JSON-file fallback has been removed).
- **Proxy-aware rate limiting & bounded map**: Verifies `X-Forwarded-For` is ignored unless `TRUST_PROXY` is set (`1`/`true`), and expired rate-limit entries are pruned on subsequent checks.
- **Brute-force caps**: Verifies that 5 wrong email-verification attempts invalidate the code (`email_verify_invalidated`) so even the originally-valid code is rejected on the 6th attempt until a new code is requested, and that TOTP 2FA attempts are capped per account (`totp_rate_limited`, 5 per 15 min) across distinct client IPs.
- **Session cookie security**: Verifies `Set-Cookie` includes `; Secure` on all hosts except `localhost` and `127.0.0.1` (`[::1]`).
- **Async password hashing**: Verifies `hashPassword` and `verifyPassword` use async `bcrypt.hash` / `bcrypt.compare` returning Promises (`hashSync` / `compareSync` are not used).
- **Verified-email requirement for ranked play**: Verifies unverified accounts receive a session on registration for unranked play, are blocked from `/api/matches/start` and `/api/matches/:id/attest` with `403 { code: 'email_unverified' }`, never appear on `GET /api/leaderboard`, and have `email_unverified` surfaced in `index.html`.
- **MySQL data layer (`mysql2`)**: Selected when `DATABASE_URL` (`mysql://...`) is set in production (e.g., on DreamHost), while keeping `node:sqlite` when `DATABASE_URL` is unset. **Note:** Because no live MySQL database is available in CI/local test runs, the main test suite runs on SQLite and exercises the MySQL adapter via unit tests with an injected fake `mysql2/promise` pool, asserting schema creation on start-up, full CRUD/match/leaderboard parity, and strict `?` parameterized queries with zero value interpolation.

## Browser checks completed

- Original release: local and hosted deployment; six-human hotseat; invalid player-count and room-code validation; movement/fuel; aiming and keyboard controls; low/balanced/high selection; shield activation; battery health/power recovery; help; nuclear craters; parachute consumption; FPV targeting; elimination; round awards and compound interest; all shop categories and sequential ready handoff. Every item category was purchased through the UI, but not every item effect was individually inspected in the browser.
- Private multiplayer: two local browser tabs joined a real PeerJS room, started with matching state, transferred turns and accepted remote firing.
- Charred Ground update: visible 480-meter battlefield, trees, rocks, animated water and shores; tank focus; exploration; orbit/tilt/zoom controls; exploration keyboard input; 3D launch view; automatic tactical return with visible trajectory; controls re-enabled after impact.

## Remaining verification

Live Gemini requests with a valid key, public matchmaking at scale, cross-network TURN behavior, long-session memory stability, mobile layouts and sustained 60 FPS are not certified. Individual weapon visuals and defensive interactions still need a complete browser matrix. Water/trees are scenery and do not add collision rules. The 1D terrain cannot represent overhangs or caves.

Browser inspection found a parachute that could remain drawn after landing; the landing path now clears that flag. Camera testing found controls could stay disabled after flight; phase transitions now resynchronize them. High shots now increase tactical framing distance to keep the trajectory in view.
