# Browser QA

Charred Ground has three layers of testing. They catch different problems, so a release should pass all three.

| Layer | Command | What it is | Time | Repeatable |
|---|---|---|---|---|
| Unit and simulation tests | `npm test` | The game logic runs in Node: physics, weapons, network sync, map format, plus the server API and the server AI. | about 1 min | yes |
| Browser smoke suite | `npm run test:browser` | The real game runs in headless Chromium and is driven by real mouse and keyboard input. Game state is read only to check results. | about 3 min | yes |
| Exploratory sweep | `npm run qa:sweep` | An AI agent with a browser plays the game like a person, one brief at a time, and logs WORKS, BROKEN or UNTESTED for each item. | about 25–30 min per brief, 12 briefs | **no** |

## Browser smoke suite (`tests/browser/run.cjs`)

The suite is deterministic: it uses fixed seeds, one browser and runs its checks one after another. It covers:

- **load:** the 2-D world and terrain mesh build without page errors.
- **editor:** the editor opens from the menu, the RAISE brush changes the ground only where you drag, the brush slider label updates, a platform is placed, a spawn lands on the clicked dry point, a spawn too close to another is refused with a notice, and SAVE, EXPORT (v2) and PLAY MAP all work.
- **keyboardDrive:** W drives, A turns and the HDG readout follows, Escape stops, fuel drops, and Shift+Arrow changes the azimuth.
- **regressions:** three checks, each of which fails on the build before its fix:
  - `driveButtonsKeepKeyboard`: leaving a drive button no longer cancels a keyboard drive.
  - `audioAfterBeforeunload`: sound no longer fails after a cancelled reload.
  - `findPublicMatch`: FIND PUBLIC MATCH no longer throws when PeerJS has no connection.
- **spawnSweep:** across 36 generated rounds, every start is dry, mutually reachable and at least 20 m from the others.
- **netSync:** opt-in with `CG_BROWSER_NET=1`. Two real browsers connect over the public PeerJS broker, and the guest's terrain must equal the host's after a crater.

Options:

```bash
npm run test:browser -- path/to/other-build.html   # e.g. prove a new check fails on the old code
CG_BROWSER_ONLY=editor,keyboardDrive npm run test:browser
CG_BROWSER_NET=1 npm run test:browser
```

The suite needs internet access, because `index.html` loads three.js and PeerJS from CDNs. Headless software rendering can run at 1–2 fps, so checks wait for the game state they expect rather than sleeping a fixed time.

## Exploratory sweep (`scripts/qa-sweep.cjs`, `docs/qa/briefs/`)

The sweep is for finding *new* bugs before a release. In the first sweep it found three real defects the unit tests could not see: the FIND PUBLIC MATCH crash, the closed AudioContext error and the drive-button bug. Its results vary from run to run, because the agent decides what to click and how hard to look. Treat a WORKS as evidence and a BROKEN as a lead, then turn every confirmed bug into a check in the smoke suite.

```bash
npm run qa:sweep                      # all 12 briefs against ./index.html
npm run qa:sweep -- --only 03,04      # selected briefs
npm run qa:sweep -- --build old.html  # another build
QA_MODEL=gemini-4-argon-high QA_TIMEOUT=40m npm run qa:sweep
```

- **What it needs:** the `agy` CLI (Antigravity), signed in. The default model is `gemini-3.8-flash-high`; the Argon models draw on a separate credit pool.
- **How it runs:** it serves the build on its own port, so later edits cannot change what is under test. Runs go **one at a time**: running browsers in parallel on a 16 GB PC caused a crash.
- **Where results go:** reports land in `qa-reports/<timestamp>/` (git-ignored), one `*.report.md` per brief plus `summary.json`.
- **Why reports are incremental:** each brief makes the agent append one line per item as it goes. `agy -p` prints only its final answer, so a broad brief that times out otherwise loses everything.
- **Editing briefs:** keep scopes small, around 8 items. Keep the `{{URL}}` and `{{REPORT}}` placeholders and the "HOW A TURN WORKS" section, without which the weapon briefs stall.

## Other agents

The sweep is agent-agnostic. Any agent that can drive a browser can follow a brief: Claude Code with Playwright, Chrome DevTools or Claude in Chrome, or Antigravity's browser subagent. Expect different coverage from each agent and each run.
