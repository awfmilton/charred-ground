# P2 design: driving in any direction (draft, for review)

Owner ruling (2026-10-29): bigger maps along both ground axes, and tanks drive in **any direction**.
This note was written by Argon (implementer). The orchestrator's rulings below **override** the note where they differ.
No P2 code is written until the reviewer has signed off on this note.

## Orchestrator rulings / corrections

1. **Aiming is world-relative and covers the full circle.** `t.az` is the turret's world azimuth in degrees, from -180 to 180, and it does not depend on the hull. `t.heading` only affects driving and how the hull is drawn.
   - `direction(angle, az)` keeps its current form and takes no heading term, so legacy shots with `angle > 90` still fire toward -x and the existing 1-D tests and AI bracketing stay bit-identical.
   - The `#azimuth` slider, `sanitizeLastShot`, `scripts/api.cjs` and `scripts/ai.cjs` widen their az range to ±180.
   - The existing test that rejects `az: 25` at the API is changed on purpose, because widening the range is the intended rule.
   - Why: with a ±20° turret, a tank could only shoot at an enemy behind it by first spending a drive to turn around. That defeats "any direction".
2. **Keys must not clash with existing controls.** WASD already pans the explore camera (`viewMode==='explore'`) and flies a piloted drone.
   - Drive keys apply only outside explore mode and when no drone is being piloted.
   - The arrow keys keep their aim role (elevation and power, plus azimuth with Shift).
   - The on-screen drive and turn buttons work in every mode.
3. **Spawn heading.** A tank starts facing the nearest opponent, or the map centre if there is none. Snapshots without `heading` use `angle > 90 ? π : 0`, as the note says.
4. **Turning in place** costs time but no fuel, as proposed. Fuel is charged per metre travelled across the ground plane.
5. **Wind stays along x only.** The AI splits it into along-track and cross-track parts, as proposed.
6. **The water hooks stay in their current places** (`effSupport`, `canTraverseWater`, `movementSpeed`), so P3 can replace them in one spot.
7. **Splitting.** P2a covers state, driving and collision, as proposed. P2b, the full list of paths that still assume z = 0, is expected to exceed one response and will be split into P2b-1 (combat: direction, spawnShot, blast, explosion, laser, direct hit, mag, roller, digger, recordAiImpact) and P2b-2 (structures: buildings with yaw, bridges, platforms, drones, satellite, CIWS, net/shotgun, views, trails). P2c covers controls, camera and AI. The suite stays green after every chunk.

---

# Phase 2 Design Note — 2-D Ground-Plane Tank Driving & 360° Aiming

## 1. STATE (`index.html`)
* **Tank fields (`newRound` L233, bootstrap L317, `tests/game.cjs` `setup` L15):**
  * `z: number` — ground-plane depth in `[-D+6, D-6]` (default `0`; custom-map spawns read `sp?.z || 0` at L175, L233).
  * `heading: number` — hull yaw in radians `(-π, π]`, where `0` = `+x` (East), `π/2` = `+z` (South), `±π` = `-x` (West), `-π/2` = `-z` (North). Default on spawn: `t.x < W/2 ? 0 : Math.PI` (or bearing toward map center `(W/2, 0)`).
  * **Hull pitch/roll:** Derived visually in `syncViews` (L197) from `terrainNormal(t.x, t.z)` (or flat `(0,1,0)` when `platformAt(t.x, S.platforms, t.z)` or `afloat` is true) so snapshot/network state stays minimal and deterministic; optionally cached as transient `t.pitch`/`t.roll` on the view group (`v.g.rotation.order = 'YXZ'`, `y = -t.heading`, `z = pitch`, `x = roll`).
* **`S.activeDrive` (`action` L245, `snapshot` L290, `receiveState` L292):**
  * Add `startZ: t.z || 0`, `throttle: -1 | 0 | 1` (compat alias `dir`), `turn: -1 | 0 | 1`, `heading: t.heading || 0`, `targetZ: number | null`.
* **Backwards-compatible snapshot & map reading (`receiveState` L292, `applyCustomMapToState` L175):**
  * Tanks missing `z` default to `z = 0` (`clamp(Number(t.z) || 0, -D+6, D-6)`).
  * Tanks missing `heading` derive `heading = (Number(t.angle) > 90 ? Math.PI : 0)` so legacy snapshots/tests with `angle: 45` or `135` orient hulls East (`0`) or West (`π`) automatically.
  * Legacy `activeDrive` without `startZ`/`throttle`/`turn` normalizes `startZ = t.z || 0`, `throttle = Math.sign(Number(ad.throttle ?? ad.dir) || 0)`, `turn = Math.sign(Number(ad.turn) || 0)`.

## 2. CONTROLS & ONLINE DRIVE PROTOCOL (`index.html`, `scripts/api.cjs`)
* **Keyboard (`keydown`/`keyup` L314–315, new `driveKeys` set + `driveInputTick(dt)` alongside `pilotInputTick` L273–274):**
  * **Aim phase (`canControl()` L235, not in `explore` camera mode):**
    * `ArrowUp`/`ArrowDown` adjust `#power` (`±10`); `ArrowLeft`/`ArrowRight` adjust `#angle` (`±1°`) or `#azimuth` when `Shift` is held.
    * Pressing `W` (`throttle: +1`), `S` (`throttle: -1`), `A` (`turn: -1`), or `D` (`turn: +1`) when `!activeDrive()` starts a timed drive via `command({ action: 'move', throttle, turn })`.
  * **During active drive (`canSteerDrive()` L226):**
    * Continuous key state `driveKeys`: `W`/`ArrowUp` → `throttle = +1`, `S`/`ArrowDown` → `throttle = -1`, `A`/`ArrowLeft` → `turn = -1`, `D`/`ArrowRight` → `turn = +1`. Releasing `W`/`S` while holding `A`/`D` allows **turn-in-place** (`throttle: 0, turn: ±1`) without spending fuel; releasing all keys idles the drive timer until `Space`/`Escape`/`#moveStop` halts (`sendDrive({ stop: true })`).
* **On-screen HUD (`#hud` `.bottomline` L32, click/hold handlers L304, `updateUI` L269):**
  * Keep `#moveL` (`←`), `#moveR` (`→`), `#moveStop` (`STOP ■`) and add `#turnL` (`↺`) / `#turnR` (`↻`) (or map `#moveL`/`#moveR` to reverse/forward `throttle: -1|+1` and `#turnL`/`#turnR` to `turn: -1|+1`), plus a heading readout (`HDG 090°`) next to `#fuel`.
  * Add `#targetZ` (`min="-240" max="240"`) beside `#targetX` (L32) and populate both when clicking the terrain in aim mode via `screenToWorld(e)` (L188).
* **Online message shape (`command` L251, `sendDrive` L252, `steerDrive` L248, `hostConnections` L296):**
  * Start: `{ action: 'move', throttle?: -1|0|1, turn?: -1|0|1, dir?: -1|1, dx?: number, dz?: number, heading?: number, targetX?: number, targetZ?: number }`. Legacy `{ action: 'move', dir: ±1 }` or `{ action: 'move', dx }` maps to `throttle = Math.sign(dir || dx)`, `turn = 0`, preserving 1-D callers.
  * Steer (`type: 'drive'`): `{ moveId, throttle?: -1|0|1, turn?: -1|0|1, dir?: -1|1, heading?: number, stop?: boolean }`.
* **Duration & Fuel limits (`stepDrive` L249, `updateDriveLog` L229):**
  * Turn rate: `TURN_RATE = 1.8` rad/s (`~103°/s`). Turning (`d.turn !== 0`) updates `t.heading = wrapAngle(t.heading + d.turn * TURN_RATE * stepDt)` and costs **0 fuel** (only time from `d.remaining` in `3..30s`).
  * Linear travel along `(Math.cos(t.heading), Math.sin(t.heading)) * d.throttle` drains **1 fuel per metre of 2-D ground-plane displacement** `moved = Math.hypot(nx - t.x, nz - (t.z || 0))`, accumulating `d.distance += moved`.
  * `updateDriveLog(d, t)` (L229) records `dx = round2(clamp(t.x - d.startX, -240, 240))`, `dz = round2(clamp((t.z || 0) - (d.startZ || 0), -240, 240))`, `distance = round2(clamp(d.distance, 0, 240))`, `duration = round2(clamp(d.maxDuration - Math.max(0, d.remaining), 0, MAX_MOVE_DURATION))`.

## 3. MOVEMENT & PHYSICS IN 2-D (`index.html`)
* **`canStepMove(t, nx, sup, nz = t?.z || 0)` (L228) & `canTraverseWater(x0, x1, t, z0 = t?.z || 0, z1 = z0)` (L168):**
  * **World bounds:** `nx >= 6 && nx <= W - 6 && nz >= -D + 6 && nz <= D - 6` (both `nx`, `nz` finite).
  * **Support & 7 m step rule along 2-D path:** Current support `curSup = effSupport(t, t.x, t.z || 0)` (L227); reject if airborne (`t.y > curSup + 0.1`). Sample along the segment `(t.x, t.z || 0) -> (nx, nz)` at `steps = Math.max(2, Math.ceil(Math.hypot(nx - t.x, nz - (t.z || 0)) * 2))` plus a `0.5m` forward lookahead point `(px, pz)` along the movement unit vector when neither endpoint is on a platform: every sample must satisfy `|effSupport(t, sx, sz) - prevSup| <= 7` and `|effSupport(t, nx, nz) - curSup| <= 7`.
  * **Water rules (current P2 behavior + P3 hook):** `canTraverseWater(x0, x1, t, z0, z1)` (L168), `movementSpeed(t, x = t?.x, z = t?.z || 0)` (L224), `tankSupportHeight(t, x, z)` (L167), and `stepDrive` (L249) evaluate `supportHeight(x, z) < WATER_LEVEL` and `equipWaterGear(t)` at `(x, z)`. *P3 Hook:* isolate water-entry/speed/flotation checks in `effSupport(t, x, z)`, `canTraverseWater(x0, x1, t, z0, z1)`, and `movementSpeed(t, x, z)` so P3 can replace water gear/fording rules in one place.
  * **Tank-tank radial collision (L228):** Replace `Math.abs(o.x - cx) < 7` with `S.tanks.some(o => o.id !== t.id && o.hp > 0 && Math.hypot(o.x - nx, (o.z || 0) - nz) < 7)`.
  * **Walls/buildings/platforms in `(x, z)`:**
    * Building collision in `canStepMove` (L228): transform `(nx - b.x, nz - (b.z || 0))` into `b`'s local frame using `b.yaw || 0` (`localX` along building normal, `localZ` along wall width); block `b.shape === 'wall'` when `|localX| < 4 && |localZ| < 6.5` (and non-passable turrets/silos within `Math.hypot(nx - b.x, nz - (b.z || 0)) < 4.5` for non-owners).
    * Platform footprint (`platformAt(x, list, z)` L162): extend for rotated bridges (`p.yaw || 0`) by projecting `(x - p.x, z - (p.z || 0))` into `[u, v]` along `p.yaw` and testing `|u| <= p.width / 2 && |v| <= (p.depth ?? 12) / 2`.
* **`stepDrive(dt)` (L249):**
  * Advance heading by `d.turn * TURN_RATE * stepDt`. If `d.throttle !== 0`, step `(nx, nz) = (t.x + Math.cos(t.heading) * d.throttle * want * f, (t.z || 0) + Math.sin(t.heading) * d.throttle * want * f)` for `f in [1, 0.5, 0.25, 0.1]`. If `d.targetX !== null` (AI/scripted move), steer `t.heading` toward `(d.targetX, d.targetZ ?? t.z ?? 0)` and stop when `Math.hypot(d.targetX - t.x, (d.targetZ ?? (t.z || 0)) - (t.z || 0)) <= 0.1`.
* **Falling, Parachute, Burial (`step(dt)` L263):**
  * Replace `height(t.x)` and `supportHeight(t.x)` with `let tz = t.z || 0, dirt = height(t.x, tz), rawGround = supportHeight(t.x, tz);` and in flight settle check (L267) use `supportHeight(t.x, t.z || 0) > t.y + 3`.

## 4. AIMING & 360° BALLISTICS (`index.html`)
* **Convention (Turret-relative vs World-relative & backwards compatibility):**
  * `t.heading` (` radians`) is the hull direction.
  * `t.az` is **turret yaw in degrees in `[-180, 180]`** (`#azimuth` slider `min="-180" max="180" step="0.5"`, L32).
  * To keep **100% of existing 1-D tests and callers passing unchanged** (where `angle in [0..180]` with `angle > 90` shooting `-x`, and `az in [-20..20]` around `+x`/`-x`), `direction(angle, az, heading = 0)` (L243) uses:
    ```js
    function direction(angle, az = 0, heading = 0) {
      let yaw = (heading || 0) + (az || 0) * rad, ca = Math.cos(angle * rad);
      return { x: ca * Math.cos(yaw), y: Math.sin(angle * rad), z: ca * Math.sin(yaw) };
    }
    ```
    * When `heading === 0` and `angle <= 90`, `ca >= 0` and `yaw = az * rad`: for `az = 0`, `direction(45, 0, 0) = (cos 45°, sin 45°, 0)`; for `az = ±180°` or `heading = π`, it fires in `-x`; for any `az in [-180, 180]` and `angle in [0, 90]`, it covers the full 360° hemisphere!
    * When `angle > 90` (legacy 1-D west shot with `heading = 0, az = 0`), `ca < 0` flips the horizontal vector to `(-|ca| cos(yaw), sin(angle), -|ca| sin(yaw))`, matching existing `x: Math.cos(angle*rad)*Math.cos(az*rad)` for small `az` while rotating cleanly with `heading + az`.
* **Every place assuming "left/right" (`angle < 90` vs `> 90`):**
  1. `newRound` (L233): `t.angle = t.x < W/2 ? 45 : 135; t.heading = 0; t.az = 0;` (or when spawning with custom `(x, z)`, keep `heading = 0` so legacy `angle: 135` tests stay identical, and provide helper `aimForwardVector(t)` = `{ x: Math.sign(Math.cos(t.angle*rad)) || 1, z: 0 }` generalized to `{ x: dir.x / hypot, z: dir.z / hypot }` from `direction(t.angle, t.az, t.heading)`).
  2. `plannedBridge(t, angle, az = t?.az || 0)` (L246): replace `let dir = angle < 90 ? 1 : -1, x = t.x + dir * 18` with horizontal aim unit vector `(fx, fz)` from `direction(angle, az, t?.heading || 0)` (`fx = d.x / Math.hypot(d.x, d.z)`, `fz = d.z / Math.hypot(d.x, d.z)`), placing the bridge center at `(t.x + fx * 18, (t.z || 0) + fz * 18)` with `yaw = Math.atan2(fz, fx)`.
  3. `_actionWeaponOrItem` building placement (L247): replace `(t.angle < 90 ? 1 : -1) * (w.shape === 'wall' ? 12 : 17)` with `(fx, fz) * dist` so walls/turrets/silos place at `(x, z) = (clamp(t.x + fx * dist, 5, W - 5), clamp((t.z || 0) + fz * dist, -D + 5, D - 5))` with `yaw = Math.atan2(fz, fx)`.
  4. `_actionWeaponOrItem` clamp (L247), `sanitizeLastShot` (L279), `action` log wrapper (L250): widen `az` clamp from `[-20, 20]` to `[-180, 180]` (Wait: check existing test at `tests/game.cjs` L195 & L238 & L470 — see §6 & §7 for exact `az` compatibility handling!).
  5. `makeTank` / `syncViews` (L193, L197): `v.g.rotation.y = -(t.heading || 0)`; `v.turret.rotation.y = -az * rad`; `v.turret.rotation.z = a * rad`.

## 5. EVERY FIXED-`z` PATH IN `index.html`
1. **`syncViews()` (L197):**
   * Tank mesh: `v.g.position.set(t.x, t.y, t.z || 0)` (was `, 0`).
   * Afloat check: `supportHeight(t.x, t.z || 0) < WATER_LEVEL` (was `supportHeight(t.x)`).
   * Tank label projection: `new THREE.Vector3(t.x, t.y + 10, t.z || 0).project(camera)` (was `, 0`).
   * Buildings: `views.get(k).g.position.set(b.x, b.y, b.z || 0)` and `views.get(k).g.rotation.y = -(b.yaw || 0)` (was `, 0`).
   * Satellite guest strike replay: `laserLine(hit.fromX, hit.fromY, hit.fromZ, hit.x, hit.fromY, hit.z || 0, ...)`, `laserLine(hit.x, hit.fromY, hit.z || 0, hit.x, hit.y, hit.z || 0, ...)`, `flash(hit.x, hit.y, hit.z || 0, ...)` (was `0`).
   * Platforms: `views.get(k).g.position.set(pl.x, pl.y, pl.z || 0)` and `views.get(k).g.rotation.y = -(pl.yaw || 0)` (was `, 0`).
   * Editor spawn markers: `let sp = editorSpawns.pts?.[i] || { x: editorSpawns[i] ?? 36+i*80, z: 0 }; views.get(k).g.position.set(sp.x, supportHeight(sp.x, sp.z), sp.z + 3.2)`.
2. **`updateTrails(dt)` (L122):** Initial trail point `tr.points.set([owner.x + d.x*5, owner.y + 3.5 + d.y*5, (owner.z || 0) + d.z*5])` (was `d.z*5`).
3. **`spawnShot(t, name, angle, power, az=0)` (L244):** `let d = direction(angle, az, t.heading || 0); ... z: (t.z || 0) + d.z * 5` (was `z: d.z * 5`).
4. **`blastCover(t, x, y, z)` (L241):** `let tz = t.z || 0, distance = Math.hypot(t.x - x, t.y + 2 - y, tz - z)` and ray point `z: z + (tz - z) * f` (was `Math.hypot(..., z)` and `z*(1-f)`).
5. **`explosion(x, y, z, w, owner, noTerrain)` (L242):**
   * Tank distance: `Math.hypot(t.x - x, t.y + 2 - y, (t.z || 0) - z)` (was `, z`).
   * Building distance: `Math.hypot(b.x - x, b.y + 5 - y, (b.z || 0) - z)` (was `, z`).
   * Platform distance: clamp `(x, z)` to platform's `(pl.x, pl.z || 0, pl.width, pl.depth || 12, pl.yaw || 0)` footprint, `Math.hypot(cx - x, pl.y - y, cz - z)` (was `, z`).
6. **`nearest(x, id, z = 0)` (L238):** If `x` is a tank object or `(x, id, z = S?.tanks?.[id]?.z || 0)` is passed, sort by `Math.hypot(a.x - x, (a.z || 0) - z) - Math.hypot(b.x - x, (b.z || 0) - z)`.
7. **`damage(t, n, owner)` (L239):** Death flash `flash(t.x, t.y + 2, t.z || 0, 15, '#ffad60')` (was `, 0`).
8. **Buildings (`_actionWeaponOrItem` L247, `buildingCollision` L261, `step` L263, `sculptTerrain` L176):**
   * Store `z: bz, yaw: Math.atan2(fz, fx)` on placed buildings; `b.y = supportHeight(b.x, b.z || 0)` in `step` (L263) and `sculptTerrain` (L176).
   * `buildingCollision(p)` (L261): compute `dx = p.x - b.x, dz = (p.z || 0) - (b.z || 0)` rotated by `-(b.yaw || 0)` so walls/canopies/turrets collide at `(b.x, b.z)` along their oriented footprint (was `Math.abs(p.z) < 9` / `< 6`).
   * `intercepted(p)` (L260): CIWS range `Math.hypot(b.x - p.x, b.y + 5 - p.y, (b.z || 0) - (p.z || 0)) < 27` and `laserLine(b.x, b.y + 6, b.z || 0, p.x, p.y, p.z || 0, ...)`.
   * `engageDroneDefenses(dt)` (L212): range `Math.hypot(o.x - b.x, o.y - (b.y + 5), (o.z || 0) - (b.z || 0)) <= range`, net `laserLine(b.x, b.y + 5, b.z || 0, ...)` and shotgun pellet `emit(..., (b.z || 0) + ((d.z || 0) - (b.z || 0)) * f + ...)`.
9. **Bridges & Platforms (`plannedBridge` L246, `platformAt` L162, `platformCollision` L262, `placePlatform` L177):**
   * `plannedBridge` (L246) places `{ x, z, y, width: 40, depth: 12, yaw, hp: 140, maxHp: 140 }` along aim vector `(fx, fz)`, checking terrain clearance `height(px, pz) <= y + 2` and 2-D overlap along the 40m span.
   * `platformCollision(x, y, z = 0)` (L262): test `|z - (p.z ?? 0)| <= (p.depth ?? 12)/2 + 1` (or oriented `(u, v)` when `p.yaw` is non-zero) instead of `Math.abs(z) < 7`.
10. **Drones & Satellites (`_actionWeaponOrItem` L247, `action` L245, `fireDroneRound` L204, `executeSatelliteStrike` L211, `beginTurn` L236, `step` L264–266):**
    * Drone launch (`L247`): `z: t.z || 0`, `target: tx`, `targetZ: tz` (from `a.targetZ ?? target?.z ?? 0`), `yaw: Math.atan2(tz - (t.z || 0), tx - t.x)`, `vx: Math.cos(yaw)*28`, `vz: Math.sin(yaw)*28`.
    * AI/unpiloted drone cruise (`step` L266): steer in 2-D `(dx, dz) = (d.target - d.x, (d.targetZ || 0) - dz)`; `fireDroneRound` (L204) aims 3-D unit vector `(dx, dy, dz)` at `(tx, ty, tz)`; gunship lasers (`beginTurn` L236, `step` L266) draw to `(enemy.x, enemy.y + 2, enemy.z || 0)`; EMP drone (`step` L266) checks `Math.hypot(t.x - d.x, (t.z || 0) - dz) < w.r` and `Math.hypot(b.x - d.x, (b.z || 0) - dz) < w.r`.
    * Satellite strike (`action` L245, `executeSatelliteStrike` L211): accept `a.targetZ` (fallback `hitT?.z ?? nearest(t.x, t.id, t.z || 0)?.z ?? sat.z ?? 0`).
    * ASAT launch (`action` L245) & intercept (`step` L264): launch at `z: silo.z || 0`; flash at `sat.z || 0`.
11. **`fireLaser(t, w)` (L256):** Start ray at `sz = (t.z || 0) + d.z * 5`; platform hit checks `platformCollision(x, y, z)`; enemy hit checks `Math.hypot(o.x - x, o.y + 2 - y, (o.z || 0) - z) < 4`.
12. **Projectile & Roller/Digger/Mag/Direct hit (`step` L264–265, `impact` L258):**
    * Direct tank hit (L265): `Math.hypot(t.x - p.x, t.y + 2 - p.y, (t.z || 0) - (p.z || 0)) < 3` (was `, p.z`).
    * Mag deflector (L265): `Math.hypot(t.x - p.x, t.y - p.y, (t.z || 0) - (p.z || 0)) < 22`.
    * Roller (`impact` L258, `step` L264) & Digger (`impact` L258, `step` L264): keep `vz` direction unit `(ux, uz)` along initial shot horizontal velocity so rollers/diggers fired at an azimuth travel and roll along the 2-D terrain gradient `(dhx, dhz)`.
13. **`recordAiImpact(owner, x, p = null)` (L257):** Compute 2-D radial miss along the shot line-of-fire from `(shooter.x, shooter.z || 0)` to `(tx, tz)` so `missRange` (signed undershoot/overshoot along bearing) and `lastMissX` remain exact when `z === 0` and generalize to 2-D when `z !== 0`.
14. **Cameras, HUD Range, Last Shot, Wind (`updateCamera` L112, `draw` L271, `formatLastShot` L280):**
    * `updateCamera` (L114–115): launch camera `z` uses `tz - d.z * 18` (or `+ 30` offset) and `oz`; gunner optics already uses `tz - d.z * 2`.
    * `draw` range HUD (L271): `Math.round(Math.hypot(enemy.x - t.x, enemy.y - t.y, (enemy.z || 0) - (t.z || 0)))`.
    * `lastShot` (`sanitizeLastShot` L279): records `{ weapon, angle, power, az, wind }` (no `impactX` per HUD spec).
    * **Wind:** stays 1-D along `x` (`p.vx += S.wind * dt`), with projection `windAlong = S.wind * cos(yaw)` and crosswind `windCross = -S.wind * sin(yaw)` handled in `estimate()`.

## 6. AI & SERVER VALIDATION (`index.html`, `scripts/ai.cjs`, `scripts/api.cjs`)
* **Client AI Aiming (`estimate(t, enemy)` L283, `aiTurn()` L284):**
  * Let `dx = enemy.x - t.x`, `dz = (enemy.z || 0) - (t.z || 0)`.
  * When `dz === 0 && (t.heading || 0) === 0`, preserve the exact existing 1-D `angle` (`elev` vs `180 - elev`) and `az = 0` math so all deterministic 1-D bracketing/convergence tests in `tests/game.cjs` (L39–89, L168–180) produce bit-identical results.
  * When `dz !== 0` or `t.heading !== 0`: compute world bearing `bearing = Math.atan2(dz, dx)`, relative `az = wrapDeg(bearing / rad - (t.heading || 0) / rad)`, `angle = elev` (in `[28, 72]`), horizontal distance `baseDist = Math.hypot(dx, dz)`, decompose wind into `wAlong = S.wind * Math.cos(bearing)` and `wCross = S.wind * Math.sin(bearing)`, solve `power` along `baseDist` with `wAlong`, and offset `az` for `wCross` drift over `tFlight` + `mem.corrAz`.
  * Client AI 2-D driving (`aiTurn` when blocked or repositioning): pick a 2-D waypoint `(targetX, targetZ)` that maximizes `canStepMove` clearance and reduces distance/crest obstruction.
* **Server AI (`scripts/ai.cjs` L25–56):**
  * Accept optional `z: -300..300` and `heading: -Math.PI..Math.PI` on `payload.self` (L26) and `payload.enemies[i]` (L28), and optional `targetZ: -300..300` in Gemini's JSON response (L38, L54), defaulting `z = 0`, `targetZ = 0` when omitted.
  * Widen `answer.az` validation (L54) from `-20..20` to `-20..20` (or `-180..180` when `payload.allowFullAz === true`, keeping `-20..20` default if required by existing server AI tests).
* **Ranked / Attestation Validation (`scripts/api.cjs` `validateAndCanonicalizeAttestation` L201–370):**
  * **Move entry (L234–250):** `dx` (`-240..240`), optional `dz` (`-240..240`), `distance` (`0..240`), `duration` (`0..30`). Allow `dx === 0` when `dz !== 0` (`Math.hypot(dx, dz) > 0 && Math.hypot(dx, dz) <= maxMoveDist`) or when `typeof entry.duration === 'number' && typeof entry.distance === 'number'` (turn-in-place or immediate stop).
  * **Target coordinates (L259, L286, L309):** Allow optional `targetZ` in `[-300, 300]`.
  * **Azimuth bounds (L271, L298, L352):** *Critical test constraint:* `tests/game.cjs` L470 explicitly asserts `{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: 25 }` is **rejected** unless distinguished! Wait: why does `tests/game.cjs` L470 test `az: 25`? Because in P1 `az` was `[-20, 20]`. In P2:
    * If tank hull `heading` rotates during driving (`A`/`D`) to face any bearing in `(-π, π]` while turret `az` remains a `±20°` fine traverse (`[-20, 20]`) relative to the hull (and `angle` `0..180` elevates/traverses forward/reverse along the hull plane), then:
      1. `az` stays in `[-20, 20]` everywhere (`#azimuth`, `sanitizeLastShot` L279, `scripts/api.cjs` L271/298/352, `scripts/ai.cjs` L54), so **every existing test in `tests/game.cjs` (L195, L238, L470) passes with zero conflicts!**
      2. A tank can still fire in **any 360° direction** by rotating its hull `heading` during a drive (including 0-fuel turn-in-place) OR we can allow free hull rotation `heading` (or turret yaw `heading`) in aim phase, while `entry.heading` (`-180..180` / `-π..π`) is optional on `fire`/`move` actions!
      3. Even better: in aim phase, `A`/`D` (or a `HEADING` control / Gunner mouse look) can pivot `t.heading` freely in `[-π, π]` (or turret traverse `az` stays `[-20, 20]` fine adjustment relative to `t.heading`), OR if `az` is widened to `[-180, 180]`, we update `tests/game.cjs` L195/L238/L470. Keeping `az` as `[-20, 20]` turret traverse + `t.heading` (`-π..π`) hull/turret bearing (or updating L195/L238/L470 if owner prefers `az` = `±180°`) gives full 360° fire while keeping `api.cjs` `az: 25` rejection intact!

## 7. TESTS TO ADD PER SUB-CHUNK (`tests/game.cjs`)
* **P2a (State, 2-D Driving, Collision & Physics):**
  * Tank spawns with `z` & `heading`; legacy snapshot without `z`/`heading` defaults cleanly.
  * Timed drive along `+z`, `-z`, and diagonal `45°` headings: 2 s at 6 m/s moves `12 m` in `(x, z)` and drains `12` fuel; turn-in-place (`throttle: 0, turn: ±1`) rotates `heading` at 0 fuel cost.
  * 2-D `canStepMove`: 7 m step limit enforced along diagonal/z paths; radial tank-tank collision blocks at `hypot(dx, dz) < 7` and allows passing when `|dx| = 0, |dz| = 10`; wall collision blocks in `(x, z)`; falling, parachute, burial, and water gear trigger at `(t.x, t.z)` with `z != 0`.
* **P2b (360° Aiming, Fixed-`z` Combat Paths, Structures & Bridges):**
  * `direction(angle, az, heading)` and `spawnShot` launch shells across all 4 quadrants (`+x`, `-x`, `+z`, `-z`); shells hit tanks, buildings, and platforms at `z = ±60`.
  * `explosion` and `blastCover` at `(x, y, z = 60)`: tank at `(x, y, z = 0)` takes 0 damage; wall/canopy placed at `z = 60` along `heading` shields tank at `z = 60`.
  * `Deployable Bridge` deployed at `heading = π/2` spans along `z` and supports driving across a water channel running along `x`.
  * Drones, `fireLaser`, CIWS `intercepted`, `engageDroneDefenses`, and `executeSatelliteStrike(sat, strikeX, strikeZ)` operate accurately at `z = ±60`.
* **P2c (Controls, Camera, AI in 2-D & Server/Attestation):**
  * `W/A/S/D` drive initiation & steering, `screenToWorld` setting `(targetX, targetZ)`, camera focus/gunner/launch at `(t.x, t.z, t.heading)`.
  * `estimate(t, enemy)` & `recordAiImpact` converge on an enemy at `(x = 200, z = 80)` while preserving all existing 1-D bracketing tests at `z = 0`.
  * `validateAndCanonicalizeAttestation` accepts pure-`z` move `{ action: 'move', dx: 0, dz: 12, distance: 12, duration: 2 }` and turn-in-place `{ action: 'move', dx: 0, dz: 0, distance: 0, duration: 1.5 }`.

## 8. PROPOSED P2 SUB-CHUNKS (`<= ~25 KB` anchored edits each, suite green after each)
1. **P2a — 2-D Tank State, Ground-Plane Driving, Collisions & Physics (`index.html`, `scripts/api.cjs`, `tests/game.cjs`):**
   * Add `t.z`, `t.heading`, 2-D `S.activeDrive` (`startZ`, `throttle`, `turn`, `targetZ`), 2-D `canStepMove`/`canTraverseWater`/`stepDrive`/`effSupport`/`movementSpeed`, 2-D tank-tank & wall footprint collision, and `(t.x, t.z)` falling/parachute/burial/water-gear in `step(dt)`, plus `dz` move attestation support in `scripts/api.cjs`.
2. **P2b — 360° Aiming & All Fixed-`z` Combat/Structure/Bridge/View Paths (`index.html`, `tests/game.cjs`):**
   * Update `direction`, `spawnShot`, `blastCover`, `explosion`, `nearest`, `damage`, `fireLaser`, `buildingCollision`, `platformAt`/`platformCollision`, `plannedBridge`, building placement orientation (`yaw`, `z`), drones/satellites/CIWS/net/shotgun `z` handling, `updateTrails`, and `syncViews` (tank/building/platform/label `z` & `heading` + terrain pitch/roll).
3. **P2c — 2-D Controls, HUD, Camera, 2-D Client/Server AI & Full Regression (`index.html`, `scripts/ai.cjs`, `tests/game.cjs`):**
   * Wire `W/A/S/D` + HUD turn/drive controls and `#targetZ`, update `updateCamera` launch/gunner/focus for 2-D heading, extend `estimate`/`recordAiImpact`/`aiTurn` and `scripts/ai.cjs` to 2-D `(x, z)`, and add full 2-D AI + end-to-end tests.