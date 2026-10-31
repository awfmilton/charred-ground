# Charred Ground: human test checklist

This is the full manual test pass for a release. The automated suites (`npm test`, `npm run test:browser`) prove the game logic and a set of known regressions. This list covers what only a person at a keyboard can judge: whether the game looks right, feels right, and does what the screen says it will.

**Live build:** <https://charred-ground.kodex.tbay.tk>. Do a hard refresh (Ctrl+Shift+R) before you start, so you are not testing a cached copy.

## How to use this list

- Work through the sections in order. Sections 1 to 13 need only one browser. Section 15 needs two browsers or two devices. Section 14 needs a signed-in account and, for its second half, the server AI keys.
- Tick each box when the item does exactly what it says. If anything is off, even slightly, leave it unticked and write a bug (template at the end).
- Keep the browser console open (F12, then Console). **Any red error is a bug**, even if the game seems fine. Copy the error text into the report.
- "Expected" describes the intended behaviour. If the game does something different but arguably better, still report it, so the difference is a decision rather than an accident.

Recommended browsers: Chrome or Edge first, then Firefox. Safari if you have a Mac. The game is built for a desktop keyboard and mouse. Test a phone or tablet only for "does it load and can I get back out".

---

## 1. Loading and first impressions

- [ ] The page loads to the main menu in under about 10 seconds, with no console errors.
- [ ] The battlefield is visible behind the menu: hills, trees, blue water.
- [ ] The menu text is readable and nothing overlaps at your normal window size.
- [ ] Shrink the window to about 1000 px wide, then make it full screen again. The layout adapts and nothing is cut off so badly it cannot be used.
- [ ] The footer of the menu describes the battlefield as 960 × 480 m and gives the number of weapons and equipment. Check the count against section 10, which lists 43 entries.

## 2. Match settings (main menu, section 01)

Start a match after each change, or a few changes at once, and confirm the setting took effect.

- [ ] **Terrain:** each of Rolling Hills, Jagged Mountains, Valleys and Cliffs produces a visibly different landscape. The round label in the top bar shows the chosen terrain.
- [ ] **Terrain: Custom** plays the map from the editor (see section 12).
- [ ] **Boundaries: Concrete.** A shell that hits the world edge explodes or stops there.
- [ ] **Boundaries: Rubber.** A shell bounces back off the edge.
- [ ] **Boundaries: Spring.** A shell bounces back harder than with Rubber.
- [ ] **Boundaries: Wrap-Around.** A shell leaving one side re-enters from the opposite side.
- [ ] **Boundaries: Erratic.** The boundary type, shown in the top bar, changes between turns.
- [ ] **AI difficulty:** Easy, Normal and Hard visibly differ. Easy misses a lot, Hard closes in within a few shots. Judge this over a few rounds, not one shot.
- [ ] **Economy: Fixed prices.** Shop prices stay the same between rounds.
- [ ] **Economy: Free market.** Buying an item raises its price, and prices drift between rounds.
- [ ] **Move time (3–30 s):** set 3, start, and drive. The drive ends after about 3 s. Set 30 and confirm a longer drive. Values outside 3–30 are refused or clamped.
- [ ] **Max wind (0–6.5 m/s):** at 0 the wind always reads CALM. At 6.5 the wind sometimes reaches a strong reading.
- [ ] **Wind cadence:** "Each turn" changes the wind every turn. "Each cycle" changes it once every player has had a turn. "Whole round" keeps it fixed for the round. The wind panel names the active cadence.

## 3. Commander slots

- [ ] There are six slots, P1 to P6, each in its own colour.
- [ ] Each slot offers **Human, Local AI, Gemini 4 Argon, ChatGPT, Empty**. Default: P1 Human, P2 Local AI, the rest Empty.
- [ ] Starting with only one commander shows "Choose at least two commanders." and does not start.
- [ ] 2, 3, 4, 5 and 6 commanders all start. Every tank appears on dry land, not in water and not stuck in a pit.
- [ ] **Signed out:** the Gemini 4 Argon and ChatGPT options are greyed out and marked "(sign in)". Section 14 covers the signed-in behaviour.
- [ ] Two or more human slots (hot-seat): each human gets their own turn and their own shop visit.

## 4. In-match top bar and HUD

- [ ] The roster lists every commander with name, health bar, HP, shield and cash. The active commander is highlighted. AI commanders have a ◈ marker. Dead commanders are dimmed.
- [ ] The turn label reads "<NAME>, YOUR MOVE." on your turn and "<NAME> IS THINKING." on an AI turn.
- [ ] The wind panel shows direction (→ or ←), speed, a bar, the maximum and the cadence.
- [ ] The boundaries label and the round label are correct.
- [ ] The FPS readout updates.
- [ ] **Quality select:** switching between the options visibly changes rendering quality and the FPS label.
- [ ] **?** opens the field manual. **BACK TO BATTLE** closes it.
- [ ] **MENU** opens the menu over the match. **RESUME** returns to the same match in the same state.
- [ ] **LEADERBOARD** and **ACCOUNT** open their windows (see section 16).
- [ ] The actions badge shows "ACTIONS n/m · TURN k" and counts down as you act.
- [ ] LAST SHOT shows the weapon, angle, power, azimuth and wind of your previous shot, and how much the wind has changed since.

## 5. Camera

- [ ] Drag on the battlefield: the view orbits. The ORBIT and TILT readouts follow.
- [ ] Scroll wheel: zooms in and out. The ZOOM readout follows.
- [ ] The orbit, tilt and zoom sliders do the same as dragging and scrolling.
- [ ] **RESET [R]** and the R key return to the tactical view.
- [ ] **MY TANK [F]** and F focus your tank.
- [ ] **EXPLORE [E]** and E open free 3-D exploration. W, A, S and D pan the camera, and do **not** drive the tank, while exploring.
- [ ] **GUNNER [V]** and V show the view from your barrel. Firing from gunner view shows a short launch camera, then returns to the shell's flight.
- [ ] While a shell flies, the camera keeps it in view, and the flight trail stays visible afterwards.
- [ ] On an AI turn, the camera shows that AI's tank and shot.

## 6. Aiming and firing

- [ ] **Elevation slider** and ←/→: 0° points right, 90° straight up, 180° left. The barrel visibly moves.
- [ ] **Power slider** and ↑/↓ change power. Power cannot go above HP × 10. A tank on 50 HP is capped at 500.
- [ ] **Azimuth slider** and Shift+←/→ turn the shot sideways, across the depth of the map. The shot visibly leaves the line it would otherwise fly.
- [ ] **TARGET X / Z** inputs accept numbers and are used where the item needs a target point.
- [ ] **Payload list:** open it and scroll to the end. It lists only what you own, with counts. Baby Missile shows ∞.
- [ ] **FIRE** button and Space both fire.
- [ ] Shells curve with the wind. A strong wind makes a visible difference.
- [ ] There is no predicted arc. Only past shot trails are shown.
- [ ] Firing costs exactly one action. Aiming costs nothing.
- [ ] An invalid action costs nothing and shows a notice, for example a third satellite, a seventh structure, or a bridge with no room.
- [ ] Controls do nothing during an AI's turn or while a shell is flying.

## 7. Turns and action economy

- [ ] Each commander gets **4 actions** on each of their first 3 personal turns, then **2 actions** from their 4th turn on.
- [ ] Driving, firing, and deploying a structure, shield, drone or satellite each cost one action.
- [ ] When your actions run out, the turn passes to the next living commander.
- [ ] Dead commanders are skipped.
- [ ] The round ends when one commander (or none) is left, and the result names the winner, or says "MUTUAL DESTRUCTION".

## 8. Driving and movement

Ground speed is 6 m/s. One drive action lasts the move time, 11 s by default.

- [ ] **W** / **FWD ▲** drives forward. **S** / **REV ▼** reverses.
- [ ] **A** / **D** and the **↺ ↻** buttons turn. The HDG readout follows. Turning in place costs no fuel.
- [ ] The tank can drive in **any direction** across the ground, not just left and right.
- [ ] **Escape** / **STOP ■** ends the drive.
- [ ] Holding W and moving the mouse over a drive button and off again does **not** stop the drive.
- [ ] Fuel drops while moving. At 0 fuel the tank stops. A Fuel Tank refills 60.
- [ ] The drive ends on its own when the move time runs out.
- [ ] Gentle slopes are drivable. Steep cliffs block you. You can always back away from the foot of a cliff.
- [ ] Tanks cannot drive through each other or through a Reinforced Bunker Wall.
- [ ] The world edge stops you, and you are never pushed outside the map.
- [ ] Driving off a ledge makes the tank fall. With a Parachute it lands without damage, and the parachute is used up. Without one it takes fall damage.

## 9. Terrain and water

- [ ] Explosions leave craters, and tanks on the crater edge slide or fall into it.
- [ ] Dirt weapons bury a tank. A buried tank takes pressure damage. A Riot Bomb digs it out without hurting it.
- [ ] There are no caves or overhangs. Digging only lowers the ground.
- [ ] **Water without gear:** driving into water sinks the tank to the bottom at about **2 m/s**. It can drive slowly along the bed and climb back out on a shore.
- [ ] **Underwater protection:** a submerged tank takes less damage than one on land (about 25 % less). That is less protection than any shield. The tank's label shows SUBMERGED.
- [ ] **Inflatable Lifejacket:** inflates automatically on reaching water. The tank floats and moves at about **3 m/s**.
- [ ] **Floating Platform:** deploys automatically on water. The tank crosses water at about **8 m/s**.
- [ ] Water gear is used up correctly, and the inventory count drops.
- [ ] Across 10 or more new rounds, on all four terrain types, no commander ever starts on an island they cannot leave, in water, or within a few metres of another tank.

## 10. Weapons and equipment

Buy or use each item at least once. For each one, check that it behaves as its description says, the inventory count drops by one, and there is no console error. Baby Missile is unlimited.

**Ballistics**
- [ ] Baby Missile: a small crater and light damage, always available.
- [ ] Missile: a bigger crater and more damage than Baby Missile.
- [ ] Baby Nuke: a large blast with a mushroom cloud.
- [ ] Nuke: a massive blast. A tank close to its own impact takes damage.
- [ ] MIRV: splits into 5 warheads at the top of its arc.
- [ ] Death's Head: splits into 9 warheads.
- [ ] LeapFrog: three bouncing explosions that follow the slope.
- [ ] Funky Bomb: a colourful burst of submunitions.

**Terrain**
- [ ] Roller: lands and rolls downhill to a valley or a tank, then explodes.
- [ ] Heavy Roller: the same as Roller, with a bigger blast.
- [ ] Digger: burrows forward and leaves a trench.
- [ ] Sandhog: a longer, deeper burrow than Digger.
- [ ] Dirt Ball: adds a mound of earth, and can bury a tank.
- [ ] Ton of Dirt: a much bigger mound.
- [ ] Liquid Dirt: flows into nearby hollows and craters.
- [ ] Riot Bomb: removes earth, does no blast damage, and digs out a buried tank.

**Energy**
- [ ] Napalm: burning fuel flows downhill for about 6 s and damages tanks it reaches.
- [ ] Hot Napalm: more fire and a longer burn than Napalm.
- [ ] Laser: an instant beam that cuts terrain and hits the first target.
- [ ] Plasma Blast: a wider beam that carves more earth.
- [ ] Orbital Laser Satellite: appears in orbit. On a later action it calls a downward laser strike. A Blast Canopy Dome or a structure blocks the strike. You can have at most 2 satellites.

**Defense**
- [ ] Standard Shield (+40), Force Shield (+75), Heavy Shield (+120): the SH value rises by that amount, and incoming damage takes shield before HP.
- [ ] Mag Deflector: enemy shells within about 22 m are pushed upward and away.
- [ ] Battery: restores 100 HP and 1000 firing power.
- [ ] Action Supply Pack: costs 1 action and gives 3, so you gain 2. You can use only one per turn, and a second shows a notice.
- [ ] Parachute: used automatically on a fall, and you cannot fire it manually (a notice says so).
- [ ] Floating Platform and Inflatable Lifejacket: used automatically on water, and you cannot select them manually (a notice says so).
- [ ] Fuel Tank: adds 60 fuel.

**Structures** (placed in the aiming direction; at most 6 per commander)
- [ ] Deployable Bridge: a 40 m deck ahead of the tank. Place it toward water, drive across, and confirm it can be destroyed.
- [ ] Reinforced Bunker Wall: blocks shells and blocks driving.
- [ ] Blast Canopy Dome: intercepts munitions falling from above, including orbital strikes.
- [ ] CIWS Point-Defense Turret: shoots down one enemy shell or drone per turn.
- [ ] Repair Depot: gives its owner +15 HP and +15 shield at the start of each of their turns.
- [ ] Anti-Satellite Silo: placing it costs 1 action. On a later action it launches an interceptor at an enemy satellite.
- [ ] Anti-Drone Net Launcher: automatically nets enemy drones within about 65 m, twice.
- [ ] Anti-Drone Flak Shotgun: automatically fires bursts at enemy drones within about 55 m, three times.

**Drones**
- [ ] FPV Kamikaze Drone: the view switches to the drone's camera. W/S or ↑/↓ pitch, A/D or ←/→ turn, Q/E throttle, and Space detonates it. Wind pushes it, and the battery runs out after about 7.5 s.
- [ ] Strike Attack Drone: the same controls, and Space fires up to 3 anti-tank rounds per flight.
- [ ] Hunter-Killer Gunship Drone: hovers for 3 turns and fires at enemies on its owner's turns.
- [ ] EMP Shield-Breaker Drone: disables shields, Mag Deflectors and CIWS in the target area.
- [ ] Enemy anti-drone structures, CIWS and EMP behave correctly against your own drones.

## 11. Shop and economy

- [ ] After each round the armory opens with the round result.
- [ ] Each round pays $800, the winner gets an extra $600, and then 5 % interest is added. Check the cash before and after.
- [ ] Every category tab works: Ballistics, Terrain, Energy, Defense, Structures, Drones.
- [ ] Buying deducts the price and raises OWNED by 1. The BUY button is disabled when you cannot afford the item.
- [ ] READY passes to the next human (hot-seat), or starts the next round when everyone is ready.
- [ ] AI commanders shop by themselves and never hold up the next round.
- [ ] The new round starts on a fresh map with everyone alive at 100 HP.

## 12. Map editor

Open it from **OPEN TERRAIN & BRIDGE EDITOR** in the menu, or with **EDITOR [M]** / M in a match.

- [ ] **RAISE**, **LOWER**, **SMOOTH** and **FLAT**: click and drag to change the ground only where you drag.
- [ ] **WATER** brush: creates water where you paint. The water level is 12 m.
- [ ] The **BRUSH** size slider changes the brush, and its label updates (18 m by default).
- [ ] **+ PLATFORM** places a deck. **− PLATFORM** removes one. **PLAT W** sets the deck width. **LIFT** raises a deck to match the bank height.
- [ ] **SET SPAWN** with P1–P6: the flag goes where you click. A flag in water, or too close to another flag, is refused with a notice.
- [ ] **SAVE** stores the map under Saved Maps. **LOAD** brings it back exactly.
- [ ] **EXPORT JSON** downloads a file. **IMPORT JSON** of that file restores the same map. An old (v1) map file still imports.
- [ ] **PLAY MAP** starts a match on it with tanks on their flags.
- [ ] **CANCEL** discards your changes. **APPLY** keeps them.
- [ ] The editor works on the whole 960 × 480 m ground, not just a strip.

## 13. Local computer opponents

- [ ] A Local AI takes its turn by itself within a few seconds, every turn, all game, and never freezes the turn.
- [ ] It sometimes drives, uses shields and batteries when hurt, and fires different weapons.
- [ ] It adjusts after misses and gets closer over several shots.
- [ ] An AI's speech bubble appears above its tank as plain text and disappears after a few seconds.
- [ ] **Local AI vs Local AI with no humans** (P1 and P2 both Local AI): the match plays itself. The status line reads "SPECTATING", the shop notice says the AIs are rearming, READY is disabled, and new rounds start on their own. Watch at least 3 rounds.

## 14. ChatGPT and Gemini players

**Part A, works now (no keys needed):**
- [ ] Signed out: the Gemini 4 Argon and ChatGPT options are greyed out and marked "(sign in)".
- [ ] Signed in, before the owner adds the server keys: both options are greyed out and marked "(not configured)".
- [ ] The "Gemini 4 Argon Mastermind" difficulty still starts a match and plays (as Local AI, with a one-time notice, until keys are added).

**Part B, after the owner adds the keys** (`GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL` on the server):
- [ ] Signed in, both options are selectable with their plain names.
- [ ] **Human vs ChatGPT:** the tank is named "ChatGPT". It takes sensible turns, and a taunt sometimes appears in its speech bubble.
- [ ] **Human vs Gemini 4 Argon:** the same, with a tank named "Gemini 4 Argon".
- [ ] **ChatGPT vs Gemini 4 Argon, no humans:** set P1 ChatGPT, P2 Gemini 4 Argon, P3–P6 Empty, and start. The match plays itself in SPECTATING mode with taunts, through several rounds, including their shopping.
- [ ] Two of the same brain (ChatGPT and ChatGPT) are named "ChatGPT" and "ChatGPT 2".
- [ ] A mix of ChatGPT, Gemini, Local AI and a human, all in one match, works.
- [ ] Taunts are always plain text. They are short (80 characters at most), and never show formatting, links or HTML.
- [ ] **Fallback:** if a provider fails or is busy, the game shows one notice ("… unavailable - local AI is playing for it."), the roster marks that tank "(LOCAL)", and play continues without a stuck turn.
- [ ] Sign out mid-match: the ChatGPT and Gemini tanks switch to Local AI with a notice, and the match continues.
- [ ] A long spectated match does not hit "Server AI is busy" constantly. If it does, report how many rounds in, because it means the per-account rate limit needs raising.

## 15. Online multiplayer

Use two browsers, such as Chrome and Firefox, or two devices.

- [ ] **HOST PRIVATE** shows a room code. **JOIN** with that code in the other browser connects. Both lobbies list both commanders.
- [ ] Only the host can start. The guest's start button does nothing.
- [ ] Turns alternate correctly. Each side can act only on its own turn and sees "Observe the battlefield" otherwise.
- [ ] Shots, craters, drives, structures and drones look the same in both browsers. Compare the terrain after a big blast.
- [ ] The shop works for both, and the guest's purchases go through.
- [ ] **FIND PUBLIC MATCH** finds or opens a public room, with no console error.
- [ ] Close the guest's tab mid-match: the host gets "… disconnected. Local AI takes over." and the game continues.
- [ ] **LEAVE ROOM** returns to local play cleanly.
- [ ] Joining a room that is full or has already started is refused with a message.
- [ ] If your network blocks direct connections, the Network & relay settings accept a TURN URL.

## 16. Accounts, ranking and leaderboard

- [ ] **REGISTER:** username (3–24 characters), email, display name and password (at least 8 characters). Invalid input is refused with a clear message.
- [ ] The verification email arrives. **VERIFY EMAIL** with the 6-digit code works. **RESEND CODE** sends a new code.
- [ ] An unverified account can play, but only unranked, and the game says so.
- [ ] **SIGN IN** with username or email works. A wrong password is refused.
- [ ] **OAuth sign-in** buttons either work or clearly show they are not configured.
- [ ] **Profile:** display name, avatar/callsign, bio (500 characters at most) and the two custom fields save, and still show after reloading the page.
- [ ] **2FA:** SETUP 2FA shows a secret. Adding it to an authenticator app and confirming enables 2FA. The next sign-in asks for the code. DISABLE 2FA turns it off.
- [ ] **SIGN OUT** works, and the top bar goes back to ACCOUNT.
- [ ] Recent match history shows your rounds.
- [ ] **LEADERBOARD:** lists commanders by attested wins. Clicking a row opens that commander's public dossier.
- [ ] A verified online win counts toward the leaderboard. A local win against AI does not.

## 17. Sound, performance and robustness

- [ ] Firing, explosions and other events make sound. The first sound plays after your first click, which is normal browser behaviour.
- [ ] Press F5, choose to stay on the page if asked, then keep playing: sound still works.
- [ ] With all 6 commanders and lots of explosions, the frame rate stays playable. Note the FPS reading.
- [ ] Switch to another tab for a minute and back. The match continues correctly.
- [ ] Reload mid-match. The game comes back to the menu cleanly, with no error.
- [ ] Spam clicks and keys during an AI turn and during shell flight. Nothing breaks.

## 18. Full games

Play these to the end, writing down each round's winner and anything odd.

- [ ] You vs 1 Local AI, Normal, Rolling Hills, at least 5 rounds.
- [ ] You vs 2 Local AIs, Hard, Cliffs.
- [ ] 6 commanders (you plus 5 Local AIs), Valleys, Free market, Wrap-Around.
- [ ] A game on a custom map from the editor.
- [ ] An online game against another person, at least 3 rounds.
- [ ] After keys are added: ChatGPT vs Gemini 4 Argon, spectated for at least 5 rounds.

---

## Bug report template

```
Title: <one line: what is wrong>
Section / item: <e.g. 10 Structures - Deployable Bridge>
Build: <date and time you loaded the page>
Browser and OS: <e.g. Chrome 141, Windows 11>
Signed in: <yes/no>
Steps:
  1.
  2.
Expected:
Actual:
Console errors: <paste, or "none">
Screenshot or video: <attach>
```
