# Charred Ground — Engineering Roadmap

This document tracks the planned engineering roadmap across gameplay modes, visual themes, camera & HUD ergonomics, localization, security, infrastructure, and CI/CD test automation (**~78 hours of planned work**).

---

## Phase 1: Team Battles & Cooperative Alliances (~12 hours)

Allow players to form teams where human commanders can play together against other humans or alongside/against computer-controlled teammates (`index.html`, `scripts/api.cjs`):

- [ ] **Team Assignment & Pre-Match Lobby UI:** Add Team selectors (`Free-For-All` vs `Teams A / B / C`) for each of the 2–6 commander slots (supporting human + human vs computer, human + computer vs human, or multi-team skirmishes) across local hotseat and PeerJS online rooms.
- [ ] **Shared Victory Conditions & Friendly-Fire Rules:** Update round-end resolution so a team wins when all opposing teams are eliminated; support configurable friendly-fire rules (`Full Damage`, `50% Reduced`, or `Shields Only`) and shared team radar/wind intel.
- [ ] **Teammate-Aware Computer Opponents & Defenses:** Update computer target acquisition (`chooseAiAction` in `index.html`) so computer teammates never target allied tanks, prioritize enemies threatening low-HP allies, and ensure autonomous defense structures (Net Launchers, Flak Shotguns, ASAT Silos) ignore allied drones and satellites.
- [ ] **Ranked Match Co-Attestation for Teams (`scripts/api.cjs`):** Update `validateAndCanonicalizeAttestation` (`scripts/api.cjs:209`) to validate team rosters, team victory outcomes, and friendly-fire damage accounting.

---

## Phase 2: Single-Player Campaign Mode & Authored Encounters (~12 hours)

Build a structured single-player campaign on top of the team and custom map systems:

- [ ] **Multi-Mission Campaign Progression:** Create an authored 10-mission single-player campaign with escalating tactical scenarios (coastal amphibious crossings, high-wind artillery duels, fortified boss batteries, drone swarm defense, and allied escort missions).
- [ ] **Campaign Persistence & Unlocks:** Track mission completion, star ratings, turn efficiency, and persistent commander credits/loadouts in `localStorage` and synced `/api/profile` player records.

---

## Phase 3: Visual Themes (Cyberpunk Neon Vector Wireframe & Retro VGA Pixel Art) (~10 hours)

Add selectable and unlockable visual rendering themes in `index.html` (Three.js scene, shaders, and HUD):

- [ ] **Cyberpunk Neon Vector Wireframe Theme:** High-contrast glowing cyan/magenta wireframe terrain grid, vector tank meshes, synth-grid skybox, neon particle trails, and terminal-styled HUD typography.
- [ ] **Retro VGA Pixel Art Theme:** Low-resolution pixelated framebuffer pass (`320x200` / `640x400` nearest-neighbor scaling), 256-color VGA palette quantization, classic stepped contour sky gradients, and bitmap HUD styling evoking early-1990s DOS artillery classics using 100% original assets.

---

## Phase 4: Unobstructed Map View & On-Screen Camera Controls (Pan, Tilt, Zoom, Rotate) (~8 hours)

Declutter the combat viewport so HUD panels never obscure the battlefield, and provide intuitive on-screen controls for exploring the 3D terrain:

- [ ] **HUD Repositioning & Collapsible Panels:** Move overlapping weapon cards, wind/previous-shot telemetry, and status banners out of the central line of sight; auto-collapse non-essential HUD chrome during aiming, camera exploration, and projectile flight.
- [ ] **On-Screen Camera Control Widget:** Add a dedicated, touch- and mouse-friendly on-screen camera gimbal pad in `index.html` supporting continuous and stepped **Pan** (`X/Z` translation), **Tilt** (pitch angle), **Zoom** (dolly in/out), and **Rotate** (orbit yaw), alongside quick-snap buttons (`Focus Tank`, `Overhead Tactical`, `Gunner View`, `Reset Full Map`).

---

## Phase 5: 2D Localized Terrain Destruction (~10 hours)

- [ ] **2D Heightfield Grid (`X × Z`):** Replace the current 1D `X`-only heightfield (extruded across the full map depth) with a true 2D heightfield grid so craters, dirt weapons, rollers, and diggers deform terrain locally around `(impactX, impactZ)` rather than carving a strip across the entire 160m depth.

---

## Phase 6: Supporter Donations & Cosmetic Patron Tiers (~6 hours)

- [ ] **Supporter Donations & Patron Perks:** Add a non-pay-to-win supporter donation flow (Stripe Checkout + webhook verification in `scripts/api.cjs`) allowing players to support server hosting costs and unlock supporter profile badges, custom commander callsign colours, and bonus visual themes.

---

## Phase 7: Multilingual Support (i18n Localization) (~6 hours)

- [ ] **UI, Arsenal & Campaign Localization (`en`, `es`, `fr`, `de`, `pt`, `ja`):** Extract all HUD labels, 43 arsenal item names/descriptions, shop tooltips, and campaign briefings into structured locale dictionaries with a language selector in the main menu and account settings.

---

## Phase 8: Security, Infrastructure & GitHub Actions / Automated Testing Review (~14 hours)

- [ ] **Security Review (`scripts/api.cjs`, `scripts/auth.cjs`, `index.html`):**
  - Add Subresource Integrity (`integrity` and `crossorigin="anonymous"`) hashes to all CDN `<script>` tags in `index.html` (Three.js, PeerJS, Tailwind).
  - Persist auth rate-limiting counters (`checkRateLimit`, `checkResendCodeLimit`) in SQLite/Postgres rather than volatile process memory, and complete the password-reset / account-recovery email flow.
- [ ] **Infrastructure Review:**
  - Audit WebSocket / PeerJS TURN relay fallback configuration, SQLite WAL concurrency tuning, and memory lifecycle of Three.js geometries/textures across multi-round sessions.
- [ ] **GitHub Actions & Automated Testing Review (`.github/workflows/`):**
  - Create the missing `scripts/gate-check.sh` script referenced in `docs/TESTING.md`.
  - Add GitHub Actions workflows with `concurrency: cancel-in-progress: true`, running unit/API suites (`npm test`) and headless Playwright browser smoke tests (`npm run test:browser`) covering team battles, camera controls, and theme switching.
