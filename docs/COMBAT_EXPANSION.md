# Charred Ground — Combat Expansion Guide

## 1. Player Guide
- **No Predicted Arcs**: Aim and remaining-flight prediction arcs (`TRAJECTORY [T]`) have been removed. Use wind readouts, elevation/azimuth controls, and the live 3D projectile trail history (`trailGeo`) to walk shots onto targets.
- **Shared Action Economy**:
  - **Personal Turns 1–3 of each round (Setup Phase)**: Each commander receives **2 actions** per turn.
  - **Personal Turn 4+ (Combat Phase)**: Each commander receives **1 action** per turn.
  - **Costs**: Driving (`←`/`→`), firing a tank weapon, activating a shield/battery/fuel/magnet, launching a drone sortie, deploying a structure or satellite, calling a Satellite Laser Strike, or launching an ASAT Silo interceptor each costs **1 action**. Aiming is free; invalid actions cost **0 actions**. Flight and drone sorties resolve completely before the next action or turn transition.
- **3D Piloted Drones**:
  - **FPV Kamikaze Drone ($400)**: Launches into an onboard 3D chase camera (`7.5s` battery, `65` blast damage). Steer with `W/S` or `↑/↓` (pitch), `A/D` or `←/→` (yaw/bank), `Q/E` (throttle), and `Space` (detonate). Wind accelerates the drone laterally and requires counter-steering.
  - **Strike Attack Drone ($550)**: Piloted 3D sortie (`8.0s` battery) armed with **3 anti-tank rounds** (`22` damage each). Press `Space` (or Fire) up to 3 times during the single-action sortie.
- **Orbital Satellites & ASAT Silos**:
  - **Orbital Laser Satellite ($750)**: Deploys a visibly orbiting satellite (approximately `190m` altitude, `60 HP`). Once deployed, select **Satellite Laser Strike** (`1 action`, `55` damage) to fire a downward beam at `Target X`. Beams are blocked by **Blast Canopy Domes**, structures, and floating platforms, and are absorbed by tank energy shields.
  - **Anti-Satellite Silo ($550)**: Deploys a ground silo (`1 action`, `85 HP`). On any subsequent action when a hostile satellite is in orbit, select **ASAT Silo Launch** (`1 action`) to launch a homing interceptor that destroys the satellite.
- **Anti-Drone Defenses**:
  - **Anti-Drone Net Launcher ($480)**: Automatically engages hostile drones within `65m` (`2` nets, `1.2s` cooldown), tangling rotors, cutting horizontal speed, disabling Attack Drone weapon fire, and forcing descent.
  - **Anti-Drone Flak Shotgun ($520)**: Automatically engages hostile drones within `55m` (`3` bursts, `0.7s` cooldown, `20` damage/burst).

## 2. Balance Choices & Verification Limits
- **Setup vs. Tempo**: Granting 2 actions for the first 3 personal turns lets commanders fortify (canopy/shield/net/silo/satellite) or cross bridges early without sacrificing offensive pressure, then tightens to 1 action from turn 4 onward so late-game turns remain fast.
- **Counterplay Triangle**: Satellites punish exposed tanks (`55` dmg) but are countered by Blast Canopies (`100 HP`), Energy Shields, and ASAT Silos (`1 action` setup + `1 action` launch). Piloted drones bypass ridgelines but are countered by wind drift, `7.5–8.0s` batteries, CIWS, Net Launchers, and Flak Shotguns.
- **Tested Limitations**:
  - Multiplayer drone steering is host-authoritative (`steerDrone` validates `actor === S.turn && d.owner === actor`); guests receive authoritative snapshots at 10 Hz; no client prediction or interpolation is implemented, so latency affects piloting.
  - Terrain remains a 1D heightfield extruded across depth (`Z`) plus discrete 3D floating platforms and structures.

- Maximum two satellites and six structures per commander. Satellites and structures reset each round. Net and shotgun ammunition lasts for that structure’s lifetime; silos reload a single interceptor each personal turn, and satellites allow one strike per personal turn.
- A surviving structure between a blast and a tank reduces that blast damage to 20%; normal shield absorption then applies.
- 316 isolated simulation checks pass. Browser visual QA and live two-peer drone control remain unverified because embedded browser tabs crashed and a fresh preview timed out. These are implementation checks, not a certification of network latency or visual performance.

## Collaboration
Argon supplied the main implementation and test patches through the authorized Session Bus. Codex reviewed, integrated and corrected them, extended regression coverage and published the result. A request/reply health check succeeded; a separate long-running delegate request later timed out while forwarded patches continued to arrive. Only the coherent COMBAT EXPANSION 1/6–6B/6 series was integrated. No relay credentials or transcripts are included.
