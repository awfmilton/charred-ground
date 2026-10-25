# Making maps

Open **MAP EDITOR** from the menu or **EDITOR [M]** during a settled offline turn. Gameplay pauses while editing. Editing cannot start during flight, falling, a shop phase, or an active AI decision. Guests and active online matches cannot edit.

- **Raise / Lower / Smooth:** click or drag to shape the terrain. Brush controls its width.
- **Flat:** holds the height at the start of a drag, so the target does not change during the stroke.
- **Water:** lowers ground below the water surface at 12 meters.
- **+ Platform / - Platform:** click to place or remove a deck. Width sets its span; Deck Lift raises it above the water or ground. Overlapping placements can reposition an existing nearby deck.
- **Set Spawn:** choose P1–P6, then click dry ground or a deck. All six markers need supported positions at least 10 meters apart, even in a two-player game.

Connect platform edges to shore and to each other. Tanks cannot cross unbridged water or steps exceeding 7 meters. Platforms are fixed floating decks, not steerable boats. They block projectiles and take blast/laser damage; destroying one drops its supported tanks. Trees and water remain decorative beyond the water-crossing rule.

**Save / Load** use local browser storage on the current site origin. **Export JSON** writes the map into the text field; copy it to a file or another player. Paste JSON into that field and choose **Import JSON** to load it. The included maps/coastal-crossing.json demonstrates connected decks, a channel, and platform spawn points.

**Apply** keeps the edited map and returns to the previous screen. **Cancel** restores the entire prior game snapshot. **Play Map** begins a fresh match using the selected commander setup. Custom maps repeat each round. To host one, prepare/apply it before hosting, select Custom terrain, then start after guests join. All players need the same game version.

Format version 1 contains a name, 481 finite terrain heights (1–140), two to six supported spawn X coordinates (completed to six when possible), and up to 16 bounded platform records. Imports reject invalid versions, nonnumeric values, unsupported spawns and oversized layouts. The import text limit is 32 KB. Maps contain no executable scripts or credentials.

Terrain remains a one-dimensional profile extruded into 3D; this editor does not create caves, arbitrary terrain meshes, moving boats or full free-roaming vehicle physics.
