---
title: Charred Ground
emoji: 💥
colorFrom: green
colorTo: yellow
sdk: static
app_file: index.html
pinned: false
---

# CHARRED GROUND

[Play the hosted game](https://charred-ground.kodex.tbay.tk).

Node.js 22.5 or newer is required. For local development: `npm install`, copy `.env.example` to `.env` (`cp .env.example .env`), then `npm start` and open http://127.0.0.1:8187. Run `npm test` for the simulation, camera, and player-account API regression suite. The application itself needs no build step.

Open `index.html` through `npm start` (which serves both the single-file client and the `/api/*` player-account backend on the same origin). The application fetches Three.js, PeerJS, and optional display fonts from CDNs, so the first load needs an internet connection. This README also supplies metadata for a Hugging Face Static Space.

## Player accounts, profiles & leaderboard

- **Authentication:** Register with a username, email, and password (salted bcrypt), verify your account with a 6-digit email code, and optionally enable RFC 6238 TOTP two-factor authentication from the **Account** modal. OAuth sign-in buttons for Google, Discord, Facebook, and Twitter/X are built in behind environment variable placeholders (`OAUTH_<PROVIDER>_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`). Until real OAuth app credentials and an email sender (`EMAIL_SMTP_URL` / `EMAIL_FROM`) are configured in `.env`, OAuth endpoints report their placeholder status (`503`) and verification codes are logged to the server console (and returned in non-production responses for local testing).
- **Commander profiles:** Customize your display name, avatar URL, bio, and up to two custom fields with player-chosen field names (max 80 characters) and values (max 175 characters), plus view your personal combat stats and match history.
- **Tamper-proof match results & public leaderboard:** Online matches request a single-use server match ticket (`POST /api/matches/start`) and require every human participant to co-attest the canonical round outcome and action log (`POST /api/matches/:id/attest`). Sanity checks reject impossible weapons, angles, powers, kill counts, nonce replays, or conflicting participant reports. The **Leaderboard** modal is publicly visible and ranks verified commanders by total attested multiplayer wins.

## New in Charred Ground

Before a match, set **Max Wind** from 0 (calm) to 6.5 and choose whether it changes each turn, each cycle of living commanders, or once per round. Defaults preserve the original wind behavior. The wind gauge shows direction and strength. Each commander also sees their previous accepted ballistic shot's weapon, angle, power, azimuth, and wind, plus the change in wind since that shot. This reference resets each round and shows no predicted path or impact point.

The map is now 480 meters wide and 160 meters deep, with pooled trees and rocks, animated water, and sandy shores. Press F to focus your tank, E to explore, V for gunner view, or R to reset the full-map camera. Drag to orbit, scroll to zoom, or use the camera sliders. In exploration mode, WASD pans across the map. Firing from a 3D mode shows a short tank-side launch view, then automatically returns to a tactical view that fits the shot. A solid line traces the actual path. Predictive aim and remaining-flight arcs are disabled. Trees are scenery. Tanks can cross water on decks, float with purchased water gear, or sink and drive along the lakebed.

## Map editor and floating platforms

Open **MAP EDITOR** from the menu, or press **M** during a settled local turn. Raise, lower, smooth or flatten terrain; carve water; place floating decks and six spawn flags. Save maps in this browser, or copy JSON from the editor to share/import a map. **Cancel** restores the previous battlefield; **Apply** keeps the layout; **Play Map** begins a new match. See [the map-making guide](docs/MAP_EDITOR.md) and [Coastal Crossing example](maps/coastal-crossing.json).

Tanks can drive across connected decks over water. Buy a **Floating Platform ($450)** or **Inflatable Lifejacket ($220)** in the Defense shop. They equip automatically on water contact, consume one item for the round, and cost no action to deploy. Platforms travel at 8 m/s on water; lifejackets travel at 3 m/s; both float at `WATER_LEVEL` and can return to a passable shore on the owner’s turn. A platform takes priority if both are owned. Gearless tanks (no water gear equipped or in inventory) can enter water: they sink to the lakebed, drive along the bed at 2 m/s subject to the 7 m step rule, and climb out up any bank whose step is <= 7 m. While submerged (`t.y + 3 < WATER_LEVEL` and not floating), incoming weapon damage is multiplied by 0.75 before shields absorb it. Abrupt steps (> 7 m) block movement. Buy a **Deployable Bridge ($900)** in Structures and deploy a 40m deck ahead of the tank for one action; aim left or right to choose direction. Blocked or overlapping placements consume nothing. Weapons can destroy decks, causing supported tanks to fall. Custom layouts and decks synchronize from host to guests and reset each round. Editing is unavailable to guests and during active online matches.

## Play

- Choose a terrain, boundary rule, and two to six human or AI commanders. Press **Deploy to battle**.
- Set elevation and power, choose a payload, then press **Fire** or Space. Left/right arrows adjust elevation; up/down adjust power.
- Press **V** for barrel-mounted first-person aiming. Judge wind and elevation without a trajectory guide.
- Each player gets **four actions on their first three personal turns of each round**, then **two actions per turn**. Driving, firing, equipment, construction, drone sorties and orbital commands each cost one action. Aiming is free. Parachutes are automatic.
- Pilot FPV kamikaze and Strike Attack drones in 3D: **W/S** pitch, **A/D** turn, **Q/E** throttle, **Space** detonate/fire. Wind pushes the drone. The attack drone gets three moderate-damage rounds per single-action sortie. Other drone types remain autonomous.
- Deploy a satellite, then select **Satellite Laser Strike** and set **Target X**. Protect tanks with canopies and shields. Net launchers and flak shotguns engage nearby enemy drones automatically. Deploy an anti-satellite silo, then select **ASAT Silo Launch** to destroy an enemy satellite. See [combat rules and controls](docs/COMBAT_EXPANSION.md).
- Driving lasts **11 seconds per action** by default; set 3–30 seconds before starting a match. Reverse or stop during that action without spending another action. Fuel follows distance traveled.
- A **Battery** restores full health and firing power. An **Action Supply Pack ($3500)** costs one action to use and grants three (net +2), once per personal turn. Unused actions expire when the turn ends.
- Between rounds, purchase supplies and mark each human commander ready. Credits receive round awards and 5% compound interest.

The registry contains 43 items spanning all 23 requested arsenal categories: ballistics, nuclear and cluster weapons, rollers, diggers, dirt, napalm, beams, defenses, accessories, seven structures, four drones, and orbital satellites.

## Online and AI

**Host Private** produces a room code. Other players enter it and join; the host starts the battle. Public matchmaking scans ten deterministic lobby IDs and attempts to host an available slot if it cannot join. Each browser must use this application version. The host simulates combat and broadcasts state, including terrain, inventory, turns, structures, drones, and shop readiness. Disconnected guests become local AI; there is no host migration.

PeerJS relies on its public signaling service. Restricted networks may need a TURN relay; optional URL and credential fields are provided. These connection settings stay in page memory. Reloading clears them.

Local computer opponents offer **Easy, Normal, and Hard** difficulty. They estimate range and wind, make imperfect shots, and adjust from observed misses rather than searching for an exact terrain impact.

Gemini decisions use the owner-configured backend and require a verified account. No API-key field is shown to players, and credentials never enter the client or peer snapshots. If the backend is unavailable, the game falls back to local AI. See [server AI configuration](docs/SERVER_AI.md).

## Implementation limits and verification

- The battlefield is a 1D heightfield extruded into a 3D mesh. It supports craters, added dirt, settling slopes, and tank falls. It cannot represent overhangs or underground cavities; diggers collapse trenches instead.
- Explosion clouds, shockwaves, smoke and fire use a fixed 400-slot particle buffer. Projectiles use an instanced mesh. Terrain normals update after terrain changes, and removed tank/building/drone resources are disposed.
- Quality modes adjust particle capacity, rendering resolution and antialiasing; Low caps rendering at 30 FPS and other modes at 60. A cap is not a guaranteed frame rate. The embedded test browser displayed roughly 15–30 FPS during two-tab testing; sustained 60 FPS has not been established.
- Camera and tank positions remain centered around the shared terrain strip. Fine azimuth changes projectile depth; the game is not a fully volumetric battlefield.
- Automated checks cover all 43 items, imperfect aiming and correction, timed driving, action packs, flotation, bridge placement, ranked inventory validation, account security, and the server AI boundary. Run `npm test` for the current result.
- The combat update has not passed browser visual or live multiplayer testing: the embedded browser reported crashed tabs and a fresh preview timed out. Earlier browser checks verified menu deployment, rendered terrain, both camera modes, private room creation, two-browser joining, match start, turn transfer and remote firing.
- Live Gemini responses, public matchmaking at scale, remote networks/TURN relaying, long-session memory behavior and mobile performance were not verified. Local tests do not establish those production guarantees.

API references: [Google generateContent](https://ai.google.dev/api/generate-content), [PeerJS networking FAQ](https://peerjs.com/client/faq).

This is an independent browser remake, not an official release of the original game.


## Repository coordination

Managed by kôdex / MCP Config Manager. Session Bus room: `#charred-ground`.

## License

Copyright (c) 2026 tbay.tk LLC. All rights reserved. This is proprietary software: using, copying, modifying, playing, hosting or sharing it requires prior written permission from tbay.tk LLC. See [LICENSE](LICENSE).
