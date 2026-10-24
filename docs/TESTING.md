# Verification record

## Automated regression suite

`npm test` runs 154 assertions against the inline application logic in a Node VM with a small DOM fixture and the same Three.js version used by the browser. It exercises all 34 inventory items, offensive-action completion, finite terrain/health, shields, batteries, parachutes, boundary rules, CIWS charges, purchasing, rewards and power caps. Camera checks cover focus, exploration panning, launch-to-tactical transitions, post-flight control recovery, trail construction/expiry, tree pooling, water setup, and all four enlarged terrain generators.

The fixture does not render WebGL, exercise the real DOM, emulate WebRTC, or call Gemini. It is not a substitute for browser tests.

## Browser checks completed

- Original release: local and hosted deployment; six-human hotseat; invalid player-count and room-code validation; movement/fuel; aiming and keyboard controls; low/balanced/high selection; shield activation; battery health/power recovery; help; nuclear craters; parachute consumption; FPV targeting; elimination; round awards and compound interest; all shop categories and sequential ready handoff. Every item category was purchased through the UI, but not every item effect was individually inspected in the browser.
- Private multiplayer: two local browser tabs joined a real PeerJS room, started with matching state, transferred turns and accepted remote firing.
- Charred Ground update: visible 480-meter battlefield, trees, rocks, animated water and shores; tank focus; exploration; orbit/tilt/zoom controls; exploration keyboard input; 3D launch view; automatic tactical return with visible trajectory; controls re-enabled after impact.

## Remaining verification

Live Gemini requests with a valid key, public matchmaking at scale, cross-network TURN behavior, long-session memory stability, mobile layouts and sustained 60 FPS are not certified. Individual weapon visuals and defensive interactions still need a complete browser matrix. Water/trees are scenery and do not add collision rules. The 1D terrain cannot represent overhangs or caves.

Browser inspection found a parachute that could remain drawn after landing; the landing path now clears that flag. Camera testing found controls could stay disabled after flight; phase transitions now resynchronize them. High shots now increase tactical framing distance to keep the trajectory in view.
