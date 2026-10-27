# Agreed development order

Owner decisions, 26 October 2026. These are planned work, not claims of shipped features.

0. Finish the current community-feedback update: configurable wind, readable wind/previous-shot information without prediction, and optional custom tank quotes.
1. **Team battles and cooperative play.** Formal alliances, shared victory, teammate-aware computer players and defenses, clear friendly-fire behavior, online/hotseat support, and correct match validation. Keep free-for-all available.
2. **Single-player campaign challenges.** Build on the team/co-op rules with authored encounters and progression. Preserve ordinary matches.
3. **Localized terrain destruction.** Damage must affect the area close to the projectile impact across map width and depth. The current one-dimensional heightfield is extruded through the entire map depth, so merely reducing the explosion radius cannot fix the observed strip-wide destruction. Requires a two-dimensional terrain representation and coordinated rendering, collision, movement, editor/import, snapshots, and tests.
4. **Hidden classic-theme Easter egg.** A deliberately discoverable secret activation changes the theme and visual presentation to evoke the original Scorched Earth. Do not expose it as a normal prominent setting. Create original visual assets; do not copy original proprietary art. Gameplay rules remain those of Charred Ground unless separately requested.

Complete and validate each stage before moving to the next. Continue using feature branches and reviewed PRs; do not push changes directly to main.

## Delivery workflow (owner instructions, 27 October 2026)

- Delegate one bounded patch at a time to Argon through the session bus.
- Argon must notify the Claude Opus 5.5 reviewer when each patch is complete. Claude reviews the exact patch and its tests before ChatGPT applies it. Address findings before implementation.
- Run `npm test` (simulation, API, and server-AI suites) before every PR into `main`. Require Node >=22.5 and keep ranked validation aligned with any added weapon, item, or action.
- Post ready work in the room for Claude (orchestrator) to deploy. ChatGPT must not deploy or wake the live host.
