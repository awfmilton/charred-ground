# Making maps

Open **MAP EDITOR** from the menu or **EDITOR [M]** during a settled offline turn. Gameplay pauses while editing. Editing cannot start during flight, falling, a shop phase, or an active AI decision. Guests and active online matches cannot edit.

- **Raise / Lower / Smooth:** click or drag anywhere on the 2-D `(x, z)` terrain grid to shape a circular region around the cursor. **Brush** (`#brushSize`, `4–50 m`) sets the radius and updates its live meter readout.
- **Flat:** locks the terrain height at the `(x, z)` point where the pointer stroke begins (`height(x, z)`), leveling cells under the circular brush toward that target height.
- **Water:** carves a circular basin below the water surface (`12 m`) at the cursor's `(x, z)` position.
- **+ Platform / - Platform:** click to place or remove a floating deck (`depth: 12 m`) at `(x, z)`. **Plat W** (`12–64 m`) sets its span and **Lift** (`#platElev`, `0–40 m`) raises the deck above the local water or ground height at `(x, z)`. Overlapping placements reposition an existing nearby deck.
- **Set Spawn:** choose slot **P1–P6**, then click dry ground or a platform at `(x, z)`. All six spawn flags render at their `(x, z)` coordinates and must sit on supported ground or decks at least `10 m` apart in ground-plane distance. Invalid placements (on water, within `10 m` of another spawn, or outside the world) are rejected with an explanatory toast notice.

Connect platform edges to shore and to each other. Tanks cannot climb steps exceeding `7 m`. Platforms are fixed floating decks (`width × 12 m`) that block projectiles and take blast/laser damage; destroying one drops its supported tanks.

**Save / Load** store and restore format v2 maps in `localStorage` on the current site origin. **Export JSON** serializes the current v2 map into the text box; **Import JSON** validates and loads v2 JSON (and automatically migrates legacy v1 JSON by extruding the 1-D height profile across `z` and setting spawn and platform `z` coordinates to `0`).

**Apply** validates and keeps the edited 2-D map and returns to the previous screen. **Cancel** restores the full prior snapshot (terrain grid, platforms, and all six `(x, z)` spawns). **Play Map** applies the map and starts a fresh match with commanders deployed at the authored `(x, z)` spawn coordinates.

Format **version 2** (`version: 2`) contains `name`, world dimensions `w` (`100–1200`), `d` (`50–300`), `cell` (`1` or `2`), base64-encoded 16-bit height ticks (`heights: { enc: "i16t", data }` covering `(w/cell + 1) × (2d/cell + 1)` grid cells in `1–140 m`), six canonical spawn objects `[{ x, z }, ...]`, and up to 16 platform records `{ id, x, z, y, width, depth, hp, maxHp }`. Legacy **version 1** maps (`481` heights and numeric `x` spawns) remain importable via migration to `{ x, z: 0 }`. The import text limit is `600 KB`.

Terrain is a 2-D heightfield over `[0, W] × [-D, D]`; the editor does not create overhangs or caves.
