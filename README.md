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

[Play the hosted game](https://charred-ground.niftybuddy25.chatgpt.site) (currently owner-private).

For local development: `npm install`, then `npm start` and open http://127.0.0.1:8187. Run `npm test` for the simulation and camera regression suite. The application itself needs no build step.

Open `index.html` in a modern browser, or serve it from a static web host. The application is one HTML file; it fetches Three.js, PeerJS, and optional display fonts from CDNs, so the first load needs an internet connection. No build step, asset folder, or application backend is required. This README also supplies metadata for a Hugging Face Static Space.

## New in Charred Ground

The map is now 480 meters wide and 160 meters deep, with pooled trees and rocks, animated water, and sandy shores. Press F to focus your tank, E to explore, V for gunner view, or R to reset the full-map camera. Drag to orbit, scroll to zoom, or use the camera sliders. In exploration mode, WASD pans across the map. Firing from a 3D mode shows a short tank-side launch view, then automatically returns to a tactical view that fits the shot. A solid line traces the actual path and the optional dashed line predicts its remaining arc. Trees and water are scenery, not additional collision obstacles.

## Map editor and floating platforms

Open **MAP EDITOR** from the menu, or press **M** during a settled local turn. Raise, lower, smooth or flatten terrain; carve water; place floating decks and six spawn flags. Save maps in this browser, or copy JSON from the editor to share/import a map. **Cancel** restores the previous battlefield; **Apply** keeps the layout; **Play Map** begins a new match. See [the map-making guide](docs/MAP_EDITOR.md) and [Coastal Crossing example](maps/coastal-crossing.json).

Tanks can drive across connected decks over water. Unbridged water and abrupt steps block movement. Weapons can destroy decks, causing supported tanks to fall. Custom layouts and decks synchronize from host to guests and reset each round. Editing is unavailable to guests and during active online matches.

## Play

- Choose a terrain, boundary rule, and two to six human or AI commanders. Press **Deploy to battle**.
- Set elevation and power, choose a payload, then press **Fire** or Space. Left/right arrows adjust elevation; up/down adjust power.
- Press **V** for barrel-mounted first-person aiming and **T** for the trajectory guide.
- Equipment and construction do not consume the offensive action. Parachutes are automatic. Movement costs fuel.
- Drones target the nearest enemy by default. Enter **Target X**, from 0 to 480, to choose a destination.
- Between rounds, purchase supplies and mark each human commander ready. Credits receive round awards and 5% compound interest.

The registry contains 34 individually selectable items spanning all 23 requested arsenal categories: ballistics, nuclear and cluster weapons, rollers, diggers, dirt, napalm, beams, defenses, accessories, four structures, and three drones.

## Online and AI

**Host Private** produces a room code. Other players enter it and join; the host starts the battle. Public matchmaking scans ten deterministic lobby IDs and attempts to host an available slot if it cannot join. Each browser must use this application version. The host simulates combat and broadcasts state, including terrain, inventory, turns, structures, drones, and shop readiness. Disconnected guests become local AI; there is no host migration.

PeerJS relies on its public signaling service. Restricted networks may need a TURN relay; optional URL and credential fields are provided. These settings and the Google key stay in page memory. Reloading clears them.

To use **Gemini 4 Argon Mastermind**, enter a Google AI Studio key. The game sends combat/shop context to the requested `gemini-4-argon` endpoint, requests JSON, validates actionable fields, and falls back to a local ballistic search after a failure or three-second timeout. Local AI requires no key. The key is never included in peer messages or game snapshots.

## Implementation limits and verification

- The battlefield is a 1D heightfield extruded into a 3D mesh. It supports craters, added dirt, settling slopes, and tank falls. It cannot represent overhangs or underground cavities; diggers collapse trenches instead.
- Explosion clouds, shockwaves, smoke and fire use a fixed 400-slot particle buffer. Projectiles use an instanced mesh. Terrain normals update after terrain changes, and removed tank/building/drone resources are disposed.
- Quality modes adjust particle capacity, rendering resolution and antialiasing; Low caps rendering at 30 FPS and other modes at 60. A cap is not a guaranteed frame rate. The embedded test browser displayed roughly 15–30 FPS during two-tab testing; sustained 60 FPS has not been established.
- Camera and tank positions remain centered around the shared terrain strip. Fine azimuth changes projectile depth; the game is not a fully volumetric battlefield.
- 190 isolated simulation assertions passed across all 34 registry items, including completion of each offensive action, finite terrain and health, power limits, shield absorption, safe Riot Bomb terrain removal, fall protection, boundary behavior, CIWS charges, purchasing and round income.
- Browser checks verified menu deployment, rendered terrain, both camera modes, private room creation, two-browser joining, match start, turn transfer and remote firing.
- Live Gemini responses, public matchmaking at scale, remote networks/TURN relaying, long-session memory behavior and mobile performance were not verified. Local tests do not establish those production guarantees.

API references: [Google generateContent](https://ai.google.dev/api/generate-content), [PeerJS networking FAQ](https://peerjs.com/client/faq).

This is an independent browser remake, not an official release of the original game.


## Repository coordination

Managed by kôdex / MCP Config Manager. Session Bus room: `#charred-ground`.

## License

Copyright (c) 2026 tbay.tk LLC. All rights reserved. This is proprietary software: using, copying, modifying, playing, hosting or sharing it requires prior written permission from tbay.tk LLC. See [LICENSE](LICENSE).
