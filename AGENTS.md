<!-- DOC_VERSION: 1.0.0 | LAST_UPDATED: 2026-10-24 -->
<!--
CHANGE_LOG (last 10 updates — read only when researching past changes to this document):
  v1.0.0 | 2026-10-24 | (pending) | Initial AGENTS.md — agent roles, routing, critical rules
-->
<!-- BEGIN scaffold:intro -->
# AGENTS.md — Charred Ground
<!-- Author: Alexander Milton | Contact: awfmilton@gmail.com -->

**This file is for AI agents and automated tools.**

---

<!-- END scaffold:intro -->
<!-- BEGIN scaffold:before-you-do -->
## Before You Do Anything

> [!CAUTION]
> **You MUST read `CLAUDE.md` before performing any task in this repository.**
> It is the authoritative source for architecture, security rules, coding conventions, and the triage workflow.
> Skipping it will cause you to violate critical rules and be blocked mid-task by the triage hook.

```
→ CLAUDE.md  (read this first — every task, every session, no exceptions)
```

**Why this is non-negotiable:**
- `CLAUDE.md` opens with the **Triage Hook** block — three-tier rules that govern every edit to `index.html` and any `.js` file. Miss it and the hook will block you mid-task.
- `CLAUDE.md` lists the **Critical Rules** the project enforces (single-file constraint, fixed-step simulation invariants, WebGL disposal, peer-snapshot security, particle budget). Violating these breaks the simulation or the multiplayer security model and will cause PRs to be rejected.
- The triage thresholds are: Tier 1 < 500 chars (fast path), Tier 2 500–3,000 chars (Researcher Assessment), Tier 3 > 3,000 chars (full triage). Full details: `TRIAGE_WORKFLOW.md`.
- Read `TRIAGE_WORKFLOW.md` for role assignments and the full delegation protocol before starting any multi-step task.
- The Orchestrator **must delegate all codebase exploration** to the Researcher to preserve token budget — do not load large sections of `index.html` into the Orchestrator's context when the Researcher can locate the relevant fragment instead.

---

<!-- END scaffold:before-you-do -->
<!-- BEGIN scaffold:quick-ref -->
## Quick Reference

| Question | Answer |
|---|---|
| What is this project? | Single-file (`index.html`) 3D turn-based browser artillery game (Scorched Earth style) |
| Primary language | Vanilla JavaScript (inline in `index.html`), no bundler, no build step |
| Runtime dependencies | Three.js r128 (CDN), PeerJS 1.5.4 (CDN) — no npm runtime deps |
| Dev server | `npm start` → `node scripts/serve.cjs` → http://127.0.0.1:8187 |
| Test command | `npm test` → `node tests/game.cjs` (154 assertions, headless Node VM) |
| Build command | None — `index.html` is the build artifact |
| Deploy target | Hugging Face Static Space / ChatGPT Sites (owner-private hosting) |
| CI | `.github/workflows/test.yml` — `npm ci && npm test` on Node.js 22 |
| Delegate research | `agy --add-dir . -p "<question>"` (Researcher / Antigravity CLI) |
| Check memory before investigating | Call **`memory_search`** or **`recall`** FIRST — a past run may already hold the answer |
| Record a durable lesson | Call **`memory_record`** with one concrete sentence. Full contract: `AGENT_MEMORY.md` |
| Delegate implementation | 1. `gh issue create --repo awfmilton/charred-ground --title "..." --body "..."` 2. `gh issue edit <n> --add-label jules` |
| After delegating to Implementer | Immediately arm the Jules Watch Monitor (see `TRIAGE_WORKFLOW.md`) |
| Jules fix requests | `gh pr review <pr> --comment --body "@jules ..."` — NOT `gh pr comment` (silently ignored) |
| Triage — Tier 1 Fast Path | Diff **< 500 chars**: hook blocks, ask user A (bypass) or B (delegate). See `TRIAGE_WORKFLOW.md` §2.1 |
| Triage — Tier 2 Researcher Assessment | Diff **500–3,000 chars**: hook blocks, ask user A (run Researcher assessment) or B (delegate to Implementer). See `TRIAGE_WORKFLOW.md` §2.2 |
| Triage — Tier 3 Standard | Diff **> 3,000 chars**: full triage mandatory — Researcher → GitHub Issue → Implementer label → Watch Monitor. No bypass. |
| PR merge policy | Orchestrator reviews every changed section of `index.html` before merging — no exceptions, even CI-green PRs |
| Sensitive files (never in PRs) | `vault.js`, `keychain.js`, `schema.sql`, `license.js`, `license-client.js`, `patch-loader.js`, `preload.js`, `main/index.js`, `mcp-server.js` |
| Monitor script | `scripts/jules-monitor.sh` — polls GitHub issues/PRs, Jules CLI sessions, and CI status |

---

<!-- END scaffold:quick-ref -->
<!-- BEGIN scaffold:roles -->
## Agent Roles

| Agent | Tool / CLI | Handles |
|---|---|---|
| **Orchestrator** | Claude Code (`claude`) | Triages tasks; reads CLAUDE.md and TRIAGE_WORKFLOW.md; routes to Researcher or Implementer; reviews PRs; merges after full review; never loads all of `index.html` into context when Researcher can locate the fragment |
| **Researcher** | Antigravity CLI (`agy`) | Locates inline code sections within `index.html`; answers architecture questions (simulation loop, camera modes, weapon registry, peer snapshot format, Gemini AI integration); assesses complexity and economics for Tier 2 triage; never writes code |
| **Implementer** | Jules CLI (`jules`) | Implements GitHub-issue-scoped changes to `index.html`, `tests/game.cjs`, `scripts/`, `docs/`, and CI config; runs `npm test` to verify; opens PRs for Orchestrator review |

---

<!-- END scaffold:roles -->
<!-- BEGIN scaffold:quick-ref -->
## Routing Quick Reference

| Task | Agent |
|---|---|
| "Where is the weapon damage formula in index.html?" | Researcher |
| "How does the host-authoritative snapshot exclude camera state?" | Researcher |
| "Add a new weapon to the 34-item registry and wire up its shop entry" | Implementer (via GitHub Issue + `jules` label) |
| "Fix the terrain vertex normal update that fires every frame instead of only on dirty flag" | Implementer (via GitHub Issue + `jules` label) |
| "Review the PeerJS disconnect-to-AI-fallback PR before merge" | Orchestrator |
| "Explain the fixed-step simulation loop and why it decouples from the render frame rate" | Researcher |

---

<!-- END scaffold:quick-ref -->
<!-- BEGIN scaffold:critical-rules -->
## Critical Rules

1. **The entire runtime lives in `index.html` — keep it that way.** No build step, no bundler, no separate asset folder, no backend. Any change that splits logic into a second file violates the core architecture and will be rejected.

2. **Camera state and API keys must never enter peer snapshots or be broadcast to peers.** The host-authoritative multiplayer model syncs simulation state only. The Gemini API key lives in page memory (the `#apiKey` password input) and must never appear in a `DataChannel` message, a URL, a log, or a console statement.

3. **Dispose every removed Three.js geometry and material.** Leaking GPU resources degrades performance over multi-round sessions. Call `.dispose()` on geometry and material before removing a mesh from the scene.

4. **Respect the 400-slot particle buffer and instanced mesh pooling.** Do not allocate unbounded particle arrays or create new `InstancedMesh` objects per-frame. Reuse slots; update instance matrices in place.

5. **The fixed-step simulation loop (1/60 s in flight, 1/20 s otherwise) must remain decoupled from the variable-rate WebGL render loop.** Never tie physics or ballistic integration to `requestAnimationFrame` timing directly. Terrain vertex/normal updates use a dirty flag — only rebuild when the flag is set.

6. **The test extraction in `tests/game.cjs` is fragile.** It slices the inline `<script>` block out of `index.html` using a hardcoded sentinel string (`for(let i=0;i<6;i++){let d=document.createElement`). Do not reformat or reorder that section of `index.html` without updating the corresponding slice offset in the test runner, or all 154 assertions will break silently.

---

## Project Memory

This project has an encrypted memory store. Before investigating anything non-trivial, call **`memory_search`** or **`recall`** — a previous run may already have recorded the root cause, the gotcha, or the reason a thing is the way it is. When a command or test fails, call **`memory_for_failure`** first to see if this exact error has been solved before.

When you learn something durable — a root cause, a constraint that will bite again, a measured fact — record it with **`memory_record`** (one concrete sentence). The full contract, including tool names, scoping rules, and the query cache (`cache_lookup` / `cache_store`), is in **`AGENT_MEMORY.md`**. That file is the authority; do not invent or restate its rules here.
<!-- END scaffold:critical-rules -->
