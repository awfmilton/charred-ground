# Charred Ground on Telegram: Mini App research and plan

Research date: 18 November 2026. Telegram facts come from the official pages listed under **Sources** (Bot API up to 10.4, 9 November 2026). Facts about Charred Ground come from this repository at the time of writing. Anything that is a recommendation or an inference is marked as such.

## 0. Implementation status (branch `ccr-bbd78e22-63xcmm`, not merged)

### What was built

| Area | Where | Notes |
|---|---|---|
| Telegram sign-in and linking | `scripts/telegram.cjs`: `POST /api/auth/telegram`, `/api/auth/telegram/link` | HMAC check of `initData` with a 24 h `auth_date` window. New Telegram accounts are verified and use a non-deliverable `tg_<id>@telegram.invalid` address. The client signs in silently on every launch, so no token is stored on the device. |
| Bot webhook | `POST /api/telegram/webhook` | Secret-token header required. Handles `/start <param>`, `/play`, `/help`, `/terms`, `/support`, `/paysupport`, admin-only `/refund <charge_id>`, inline-mode invites, `pre_checkout_query`, `successful_payment`, `refunded_payment`. |
| Stars store | `scripts/telegram-catalog.cjs`, `/api/store/*` | Cosmetic and convenience SKUs only. XTR invoices; pre-checkout checks owner, price and ownership; payments are idempotent by charge id; payments that can't be matched to an item are refunded automatically; 30-day Supporter subscription; optional AI-pass gate. |
| Data | `scripts/telegram-store.cjs` | New tables only, for SQLite and MySQL, created on the first Telegram request. |
| Sharing | `/api/telegram/prepared`, `/api/shares`, `/api/telegram/story-image` | Room invites, round results, challenges (same seed, settings and AI slots) and custom maps go through `savePreparedInlineMessage`, then `shareMessage` in the client. Story images are held in memory for 1 h. |
| Turn notifications | `/api/telegram/turn-watch`, `/api/telegram/notify-turn` | A guest registers an opaque token. The host forwards it when the guest is away; the host never sees a Telegram id. |
| TURN | `GET /api/turn` | Short-lived coturn REST credentials (`TURN_SECRET`, `TURN_URLS`). |
| Group leaderboard | `GET /api/telegram/leaderboard` | Ranks the players who opened the game from that chat (signed `chat_instance`). Only those members can read it. |
| Touch HUD | `index.html`, after the test sentinel | Compact-screen layout for touch-first devices and Telegram. Includes drag-to-aim from your tank (barrel direction and power only, never a trajectory), hold-to-repeat steppers, a weapon sheet, a drive pad, camera snap buttons, a drone joystick and throttle, optional tilt steering and tilt-to-aim in the Gunner scope, a left-handed layout, and haptics. |
| Telegram shell | `index.html` | The SDK loads only when launched from Telegram. Also covers `ready`/`expand`/fullscreen, header and bottom-bar colours, the Back button (closes sheets and modals, leaves 3D views, opens the menu), Main button (START / RESUME / READY), Secondary button (INVITE / SHARE RESULT) and Settings button, closing confirmation and swipe lock during battles, safe areas, CloudStorage settings, a DeviceStorage backup of maps and HUD layout, and `start_param` routing (`r_`, `c_`, `m_`, `lb`, `shop`). It also offers QR scan to join, Story sharing, the home-screen prompt and the champion emoji status. |
| Cosmetics | `index.html` | Tank accent (barrel trim) and shell-trail colour. They are carried on the tank in snapshots, validated against a fixed list, and rendered for everyone. |
| Setup | `npm run telegram:setup` (`scripts/telegram-setup.cjs`) | Sets the webhook, commands, menu button and descriptions; `--dry-run` prints the calls. All variables are documented in `.env.example`. |
| Tests | `tests/telegram.cjs` (in `npm test`), `tests/browser/telegram-mobile.cjs` (in `npm run test:browser`) | The server tests use a fake Bot API. The browser tests use the real server and a stubbed `telegram-web-app.js` on emulated iPhones in landscape and portrait. |

### Going live

1. Deploy the Node server (`npm start`) behind HTTPS on a stable domain. The static Sites deployment cannot run sign-in, payments or the webhook.
2. Create the bot in @BotFather. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME` and `PUBLIC_BASE_URL` in `.env`.
3. Run `npm run telegram:setup`, then follow the four manual @BotFather steps it prints: enable the Main Mini App, set the loading-screen icon and colours, add `/newapp play`, and enable `/setinline`.
4. Optional: set `TURN_SECRET` and `TURN_URLS` for a coturn relay, `TELEGRAM_ADMIN_IDS` for refunds, `TELEGRAM_SUPPORT_CONTACT`, and price overrides.
5. Test in Telegram's test environment first (`TELEGRAM_TEST_ENV=1`, with a test-server bot). Stars there are not real.

### Differences from the plan below, and known gaps

- **FIRE stays an in-game button.** It is not Telegram's MainButton during battles: the bottom bar would take about 15% of a landscape phone's height. The MainButton handles START, RESUME and READY.
- **No stored session token.** The client re-signs in from `initData` on every launch, so SecureStorage is not used.
- **No room QR display.** Scanning a room QR is supported, but generating one would need a QR library. Hosts share an invite link instead.
- **No terrain LOD mesh for low-end Android.** The `LOW` performance class selects the existing Low quality (pixel ratio 1, 30 fps cap). A coarser terrain mesh still needs real-device profiling.
- **Cosmetic ownership is not checked by the host.** Each client only offers cosmetics it owns, but a modified client could send an unowned accent. It is visual only.
- **MySQL tables are untested against a live database.** The DDL exists but has only run on SQLite in tests.
- **Ranked rules for linked accounts are unchanged.** Linking Telegram to an existing web account with an unverified email does not make it ranked-eligible. That is open decision 5.
- **Portrait battlefield is small.** Portrait play works, but the 960 m battlefield is small at that width, so the first-match tip suggests turning sideways. Telegram's `lockOrientation` can only lock the current orientation; it cannot force landscape.
- **Not tested on real devices.** Nothing has been run on an actual phone or against the real Telegram API. Use the device matrix in section 13.

## 1. Summary

Charred Ground can run as a Telegram Mini App with no change to its architecture. The game is already one HTTPS-servable page, and `scripts/serve.cjs` already provides accounts, sessions, leaderboards, match attestation and server-side AI. Telegram adds four things on top:

1. **Identity for free.** Telegram signs the user's identity (`initData`). The server checks the signature and signs the player in. There is no password or email step.
2. **Native chrome.** These include the Back button, Main/Secondary bottom buttons, the Settings button, haptics, fullscreen, orientation lock, safe areas and theme colours.
3. **Stars payments** for digital goods. Inside Telegram, digital goods must be sold in Stars.
4. **Social distribution.** Players can share invite links that open straight into a room, send prepared result messages, share to Stories, add the app to the home screen, and receive turn notifications from the bot.

Porting is mostly not about Telegram. **The mobile game is not yet fun on a phone.** In an iPhone 13 emulation of the current build (Playwright, 18 November 2026), the Fire Control panel covers most of the landscape screen. In portrait, the toolbar takes two rows and the camera dock covers the right third of the battlefield. All of the desktop-only inputs (keyboard shortcuts, right-drag, mouse wheel, WASD drone flight) need touch equivalents. Section 6 is a touch control design. It keeps the owner's existing rules: no predicted aim arc, and aiming is free.

| Today, landscape phone (844×390) | Today, portrait phone (390×844) |
|---|---|
| The toolbar plus Fire Control fill nearly the whole screen; the battlefield shows only at the edges. | The battlefield is a strip between the two-row toolbar, the camera dock (right third) and Fire Control (bottom third). |

**Recommended order** (detail in section 12):

1. Mobile-first HUD and touch controls, which also benefit mobile web.
2. Telegram shell: SDK, fullscreen, buttons, safe areas, haptics.
3. Telegram sign-in.
4. Invite links and room deep links.
5. Bot turn notifications and result sharing.
6. Stars store, cosmetics-only.
7. Multiplayer transport hardening for mobile networks.

## 2. What the game already has that matters here

| Area | Current state (repo) | Telegram relevance |
|---|---|---|
| Runtime | One `index.html`, Three.js r128 and PeerJS 1.5.4 from CDNs. | Serve over HTTPS and register the URL with @BotFather. |
| Server | `scripts/serve.cjs` → `scripts/api.cjs` / `auth.cjs` / `db.cjs` (SQLite or MySQL). | The bot webhook, initData sign-in and Stars handling belong here. A static-only host cannot do them. |
| Accounts | Password + email code, TOTP, OAuth (Google, Discord, Facebook, Twitter) via an `oauth_accounts(provider, provider_user_id)` table. Sessions use a cookie or a bearer token. | Telegram fits as provider `telegram` in the same table. Use bearer tokens, not cookies (see 5.3). |
| Ranked play | `POST /api/matches/start` + per-participant `attest`; a bot match never counts for the public leaderboard. | No change. Telegram identity only replaces how the session is obtained. |
| AI | Local Easy/Normal/Hard; owner-keyed Gemini/OpenAI via `POST /api/ai/decision`, which requires a verified account. | Telegram-authenticated users must count as "verified" for this gate (see 5.2). |
| Multiplayer | PeerJS WebRTC, host-authoritative, private/public rooms. A disconnected guest becomes a bot. There is no host migration. | Phones background apps and switch networks. Section 9 covers this. |
| Mobile UI | Panels have `phoneCollapsed` flags and `@media` breakpoints. Pointer events exist; there are no touch gestures (pinch, two-finger pan). | The basis is there, but section 6 is needed. |
| Local storage | Custom maps and HUD layout in `localStorage`. | Move to `DeviceStorage` and `CloudStorage` inside Telegram (section 7.5). |
| Design rules | No predicted arc; aiming is free; non-pay-to-win supporter perks (ROADMAP Phase 6). | These constrain the touch aim design and the Stars store. |

## 3. How a Telegram Mini App works (facts)

- **Loading.** Include `<script src="https://telegram.org/js/telegram-web-app.js"></script>` in `<head>`. This exposes `window.Telegram.WebApp`. Outside Telegram the object exists, but `initData` is empty. Feature-detect with `Telegram.WebApp.initData !== ''` and `isVersionAtLeast(...)`.
- **Clients.** iOS and Android (native WebViews), Telegram Desktop (an embedded WebView), and Telegram Web (an iframe on `web.telegram.org`). `WebApp.platform` reports which one.
- **Android performance class.** The Android User-Agent ends with `LOW`, `AVERAGE` or `HIGH`. Telegram's guidelines ask apps to reduce effects on `LOW`. This maps directly onto the existing Low/Balanced/High quality selector.
- **Origin hardening (Bot API 10.2, 14 July 2026; on for all apps from 20 July 2026).** Mini App methods only work from the original Mini App domain. Serve the game and its API from that one origin and do not iframe it elsewhere.
- **Launch surfaces.** The full list is in the [docs](https://core.telegram.org/bots/webapps#implementing-mini-apps):

| Surface | How | Gets |
|---|---|---|
| **Main Mini App** (profile "Launch app" button, app store listing) | Enable in @BotFather. Link `https://t.me/<bot>?startapp=<param>`; `&mode=compact` for half height. | `user`, `chat_type`, `chat_instance`, `start_param` |
| **Direct link** to a named app | `https://t.me/<bot>/<app>?startapp=<param>` | `user`, `chat_type`, `chat_instance`, `start_param` |
| **Menu button** next to the chat input | `/setmenubutton` or `setChatMenuButton` | `user`, `query_id` |
| **Inline keyboard button** on a bot message | `web_app` button | `user`, `query_id` |
| **Inline mode** (`@bot` in any chat) | `answerInlineQuery` with `button` | Launches the app; there is no chat access. |
| **Attachment menu** | Needs Telegram Ad Platform for most bots (open to all on the test server). | `user`, `receiver`/`chat` |

`chat_instance` is a stable identifier for "this app opened from this chat". It is the key for per-group lobbies and leaderboards (section 8).

## 4. Hosting and bot setup

1. **Hosting.** The existing Node server must be reachable over HTTPS on a stable domain. A static host (the current ChatGPT Sites deployment) is not enough: sign-in, invoices and the webhook need the server. Keep `index.html` and `/api/*` on the same origin. This satisfies the origin rule and avoids CORS.
2. **Bot.** In @BotFather: `/newbot`, then enable the Main Mini App with the HTTPS URL. Set the loading-screen icon and light/dark colours (Bot Settings → Configure Mini App). Add a `/newapp` short name (for example `play`) so `t.me/<bot>/play?startapp=…` links work. Set the menu button to the game.
3. **Webhook.** Add `POST /api/telegram/webhook` in `scripts/api.cjs`. Register it with `setWebhook(url, secret_token=…)` and reject any request whose `X-Telegram-Bot-Api-Secret-Token` header does not match. This endpoint receives `pre_checkout_query`, `successful_payment`, `/start` deep links, `/paysupport`, inline queries and callback queries.
4. **New server environment variables** (never in the repo): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, and optionally `TELEGRAM_TEST_ENV=1`. Load them the same way `GEMINI_API_KEY` is loaded today.
5. **Content Security Policy.** If a CSP is added later, allow `https://telegram.org` for the SDK script. `downloadFile` responses need `Access-Control-Allow-Origin: https://web.telegram.org` and `Content-Disposition: attachment`.

## 5. User accounts

### 5.1 Sign-in flow (recommended)

```
Mini App start
  └─ Telegram.WebApp.initData (raw query string)
       └─ POST /api/auth/telegram { initData }
            server: verify HMAC (5.4), check auth_date ≤ 24 h old (recommended window),
                    upsert oauth_accounts(provider='telegram', provider_user_id=user.id)
                    → existing user, or create one (username from user.username or "tg<id>",
                      display name from first/last name, avatar from photo_url)
            ← { token, user }   (bearer session token, same sessions table as today)
  └─ store token in SecureStorage (fallback: DeviceStorage), send as Authorization: Bearer
```

- **Never trust `initDataUnsafe`** for anything the server records. It is for display only, before the server replies.
- **Signing in is silent.** There is no login screen inside Telegram. The Account modal becomes a Profile view.
- **Linking an existing web account.** Inside Telegram, a "Link existing account" option signs in with the old password or TOTP once, then attaches `telegram` to that user in `oauth_accounts`. Going the other way, a web user can link Telegram through the [Telegram Login Widget](https://core.telegram.org/widgets/login), which uses the same hash scheme with a different secret derivation. One account then works on both surfaces, and stats and leaderboard history carry over.
- **Display names.** `user.id` is an integer up to 52 bits, so store it as a string or `BIGINT`. `username` is optional and can change; key on `id` only.
- **Bot messages.** Check `allows_write_to_pm`. If it is false, call `WebApp.requestWriteAccess()` the first time a feature needs bot messages (turn notifications), not at launch.

### 5.2 Changes to existing account rules (inference)

- The server AI and ranked endpoints require an email-verified account. A Telegram-authenticated account should satisfy the same gate, because the signature proves control of a Telegram identity. Add an `identity_verified` concept rather than faking `email_verified`.
- Email becomes optional for Telegram users. `requestContact()` can provide a phone number if it is ever needed. It is not needed now, so do not ask.

### 5.3 Why bearer tokens, not cookies

Telegram Web runs the app inside an iframe on `web.telegram.org`. There, the game's cookies are third-party and browsers block them (Safari always; Chrome increasingly). The server AI endpoint already refuses cookie-only requests. Use bearer tokens everywhere in Telegram mode.

### 5.4 initData verification (exact algorithm)

- `data_check_string`: every field except `hash`, sorted by key, as `key=value`, joined with `\n`.
- `secret_key = HMAC_SHA256(key="WebAppData", message=<bot_token>)`
- The data is valid if `hex(HMAC_SHA256(key=secret_key, message=data_check_string)) == hash`. Compare with `crypto.timingSafeEqual`.
- Third-party check (only needed if another service ever validates players without the bot token): an Ed25519 `signature` over `"<bot_id>:WebAppData\n" + sorted fields (excluding hash and signature)`. Telegram's production public key is `e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d`.

Both are about 20 lines with `node:crypto` and need no new dependency.

## 6. Mobile controls: making it as fun as desktop

These are design recommendations. Every desktop action keeps a touch equivalent. Nothing reveals the trajectory.

### 6.1 Layout

- **Fullscreen, landscape-first.** Call `requestFullscreen()` and `lockOrientation()` when a match starts, and unlock in menus and the shop. Portrait stays supported for menus, the shop and spectating.
- **Safe areas.** Pad the HUD with `var(--tg-safe-area-inset-*)` + `var(--tg-content-safe-area-inset-*)`. In fullscreen, Telegram's close/menu pill sits over the top of the page. Size the canvas from `viewportStableHeight`, not `viewportHeight`.
- **Battlefield first.** Target at least 70% of the screen for the battlefield while aiming.
  - Replace the two toolbar rows with one corner menu button plus the Telegram **SettingsButton**.
  - Fold the camera dock into gestures (6.3) and a small snap row: Tank, Explore, Gunner, Reset.
  - Collapse Fire Control to a slim strip on one edge: weapon chip, angle/power readouts, actions left.
  - Move FIRE to Telegram's **MainButton**, or a large thumb button in the right corner.
- **Thumb zones.** Put aim and fire controls on the right thumb and camera and drive controls on the left. Offer a left-handed mirror in settings.

### 6.2 Aiming (keeps the no-predicted-arc rule)

- **Drag-to-aim from the tank.** Touch near your tank and drag. Drag direction sets elevation; drag length sets power, capped at HP × 10 as today. Show only the barrel direction and a power meter, never a flight arc. This is the classic slingshot interaction, but with no trajectory preview.
- **Precision nudges.** Long-press steppers for ±0.5° and ±1 power with acceleration. Desktop has arrow keys for fine aim; phones need this too. Tick `HapticFeedback.selectionChanged()` on each step, a cheap but strong "feel" upgrade.
- **Azimuth** (3D shots). Drag horizontally on a dial, or use gyro tilt in Gunner view (6.4).
- **Previous-shot ghost.** Keep the existing previous-shot telemetry visible during aiming. Phones lack the desktop's spare space, and this is how players learn wind.
- **Weapon picker.** Replace the `<select>` with a horizontally scrolling carousel of item cards (icon, name, count). Long-press shows the shop description.

### 6.3 Camera gestures

| Desktop | Touch |
|---|---|
| Left-drag rotate | One-finger drag on empty battlefield (not near own tank) |
| Right/Shift-drag pan | Two-finger drag |
| Wheel zoom | Pinch |
| F / E / V / R | Snap row buttons; double-tap a tank to focus it |
| WASD explore | Left virtual stick in Explore mode |

Call `disableVerticalSwipes()` during matches. Otherwise a downward drag on the battlefield minimises the Mini App. Swiping the header still closes it.

### 6.4 Driving, drones, gunner view

- **Driving.** Hold-to-drive left/right buttons on the left thumb (FWD/REV/turn in 3D), with a Stop button. Keep the existing 11 s action timer and fuel readout.
- **Drone piloting.** Use a left virtual stick for pitch/yaw, a right throttle slider and a Detonate/Fire button. Offer **tilt-to-steer** via `DeviceOrientation`/`Gyroscope` (`refresh_rate` 20 ms), with calibration when the sortie starts. Fire `HapticFeedback.impactOccurred('heavy')` on detonation.
- **Gunner view.** An optional "look around by moving the phone" mode uses `DeviceOrientation`. Panning a scope by moving the phone is a natural mobile interaction.

### 6.5 Feel

- **Haptics.**
  - `impactOccurred('light')` on fire.
  - `'heavy'` or `'rigid'` on a nearby or nuclear impact.
  - `notificationOccurred('success')` on a kill or round win, `'error'` on an invalid action.
  - `selectionChanged()` on aim steps and weapon swipes.
- **Audio.** Resume the `AudioContext` on the first touch and again on the `activated` event, because mobile WebViews suspend it. Suspend it on `deactivated`.
- **Pause and resume.** On `deactivated`, which fires when the app is minimised, pause local simulation in single-player and hotseat and stop sensors. Online, see section 9.
- **Closing confirmation.** `enableClosingConfirmation()` during a match prevents losing a game to an accidental swipe. Disable it in menus.

### 6.6 Performance budget (inference; needs device testing)

- The terrain mesh has `NX×NZ = 481×241 ≈ 116k` vertices. That is fine on mid/high phones, but low-end Android needs a coarser LOD mesh on **Low**: render every second sample (about 29k vertices). Keep the simulation heightfield unchanged so gameplay stays identical.
- Cap `devicePixelRatio` at 1.5 on Balanced and 1 on Low. Pick the default from the Android performance class, or from a 2-second frame-time probe on iOS.
- Particles (400 slots) and instancing are already mobile-friendly. Turn off water animation and shadows on Low.
- Memory: test multi-round sessions on a 3 GB Android device. iOS WebViews kill pages that hold too much GPU memory, and the dispose discipline in CLAUDE.md matters more here.

### 6.7 Map editor on touch

Brush tools work as one-finger paint, with two-finger pan/zoom of the camera. Brush size becomes a slider in a bottom sheet. Import/export uses `downloadFile` (export JSON) and a file input or the clipboard (import). Platforms and spawns: tap to place, drag to move.

## 7. Telegram-native navigation and UI mapping

### 7.1 Buttons

| Telegram element | Charred Ground use |
|---|---|
| **BackButton** | Mirrors the Escape stack: closes Help, Shop item detail, Account/Leaderboard modals, Editor (with "discard?" via `showConfirm`), and leaves Explore/Gunner back to Tactical. It is hidden on the main menu. |
| **MainButton** | Context primary action: **START** (menu) → **READY** (shop) → **FIRE** (your turn, aiming) → hidden while shells fly or on others' turns. Use `showProgress()` while waiting for the host or a server reply. `iconCustomEmojiId` (9.5) can show a weapon emoji. |
| **SecondaryButton** | Context secondary action: **Invite friends** in a lobby, **Stop** while driving, **Detonate** during a drone sortie, **Buy** in the shop. |
| **SettingsButton** | Opens settings: graphics quality, handedness, haptics, tilt controls, language, account link. |
| `showPopup` / `showConfirm` / `showAlert` | Replace in-page confirm dialogs (leave match, discard map, buy confirmation). They are native, accessible and theme-aware. |
| `setHeaderColor` / `setBackgroundColor` / `setBottomBarColor` | Match the game's dark green palette so the Telegram chrome looks part of the game. |
| Theme params | Use `--tg-theme-*` for menus and the shop only; keep the battlefield art fixed. |

### 7.2 Deep-link routing via `start_param`

Telegram does not document a length or character set for `startapp` in the Mini Apps page. Keep values short and use only URL-safe letters, digits, `_` and `-`.

| `start_param` | Opens |
|---|---|
| *(empty)* | Main menu |
| `r_<ROOMCODE>` | Join the private room directly (the 6-character code is already URL-safe) |
| `c_<challengeId>` | A challenge issued by a friend (server record: map seed, settings, challenger) |
| `m_<mapId>` | Preview and play a shared custom map |
| `lb` | Leaderboard |
| `shop` | Shop/store |

The bot's `/start <param>` handler uses the same table, so the same links work from a plain chat.

### 7.3 Home screen and status

- `addToHomeScreen()`: offer it after the first finished match. `checkHomeScreenStatus` hides the offer once accepted.
- `setEmojiStatus()`: offer a time-limited emoji status (for example 7 days, via `duration`) to a weekly leaderboard champion. This is a user-confirmed native dialog.

### 7.4 Input and text

Chat, room codes and callsigns use normal inputs. Call `hideKeyboard()` (9.1) after submit. Room codes can also be joined with `showScanQrPopup()`: the host shows a QR of the `t.me/…?startapp=r_CODE` link, which is useful for playing in the same room. Pasting with `readTextFromClipboard` only works for attachment-menu launches, so a normal paste is the fallback.

### 7.5 Storage

| Data | Store | Notes |
|---|---|---|
| Session token | `SecureStorage` | iOS Keychain or Android Keystore; 10 items. Fall back to `DeviceStorage` where it is unavailable (Desktop/Web). |
| HUD layout, graphics settings, handedness | `CloudStorage` | Syncs across the user's devices. 1024 keys, 4096 chars per value. |
| Custom maps | `DeviceStorage` (5 MB) + server copy for signed-in users | A map record does not fit CloudStorage's 4 KB values. Share via the server (`m_<mapId>` links). |
| Match snapshot for crash or minimise recovery | `DeviceStorage` | Single-player and hotseat only. |

Wrap these behind one small `store` adapter in `index.html` that uses Telegram storage when `initData` is present and falls back to `localStorage` otherwise.

## 8. Social, multiplayer and growth features

These matter most for Telegram distribution. Turn-based artillery suits chats well because players do not need to be online at the same moment.

1. **Invite to room.** The host taps **Invite** (SecondaryButton). The server calls `savePreparedInlineMessage` with a rich invite card ("⚔ Join my Charred Ground battle"), and the client calls `shareMessage(id)`. This opens Telegram's native share picker. The card's button opens `t.me/<bot>/play?startapp=r_<CODE>`. Fallback: `switchInlineQuery('r_<CODE>', ['users','groups'])`.
2. **Play in a group.** Typing `@<bot>` inline in a group offers "Start a battle here". The posted message has a "Join" web_app button. The `chat_instance` identifies the group, so the lobby and **per-group leaderboard** key on it.
3. **Async turn notifications.** When a turn passes to a player whose app is minimised or closed, the bot sends "Your turn in <room> — 2 min left" with an inline button that opens the room. This needs write access (5.1). It needs either the server to know match state, or the host client to call a small `POST /api/telegram/notify-turn` endpoint (rate limited, roster-checked).
4. **Result sharing.**
   - After a round: `shareMessage` with a prepared result card (winner, kills, map).
   - `shareToStory(imageUrl, { text, widget_link })`: render a victory screenshot with `renderer.domElement.toBlob()`, upload it to the server, and share the HTTPS URL. `widget_link` (a link sticker) is Premium-only.
5. **Challenges.** "Beat my shot." The server stores a seed, map and settings. A friend opening `c_<id>` gets the same battlefield against the same AI. This uses the existing seeded `rng` determinism.
6. **Chat high scores** (optional). The legacy Bot API Games platform (`sendGame`, `setGameScore`, `getGameHighScores`) draws a per-chat high-score table under a game message. It suits a "single-player challenge of the week" posted to groups. It runs alongside the Mini App; it does not replace it.
7. **Bot API 10.4 widgets** (9 November 2026). Bots can now send HTML widget messages (`sendWidget`, `editMessageWidgetData`). In production they only work in private chats and cannot be sent from inline queries, so they are not ready for group play. Revisit them for a live "match card" in chat once group support lands.
8. **Communities and Rich Messages** (10.1–10.3). Rich messages (tables, buttons) are a good format for weekly leaderboard posts from the bot.
9. **Affiliate program** (Stars). Telegram's bot affiliate programs pay referrers a share of Stars revenue. This is a growth lever once the store exists (section 10).

## 9. Online multiplayer on phones

Risks:

- **NAT.** Cellular networks often use carrier-grade or symmetric NAT. STUN-only WebRTC (today's default `stun:stun.l.google.com`) then fails. The game supports a user-supplied TURN server, but Telegram players will not configure one.
- **Backgrounding.** A host who switches to reply to a message (`deactivated`) may have their WebView throttled or their data channel dropped. There is no host migration, so the whole match dies.

Recommendations, in order of effort:

1. **Operate a TURN server** (for example coturn) with short-lived credentials minted by `GET /api/turn` for authenticated users. This is the smallest change and fixes most connection failures.
2. **Prefer a desktop or stable host.** In Telegram mode, show a warning when a phone hosts, and pause the host's turn timer on `deactivated`, resuming on `activated`.
3. **Server relay or server authority** (larger, but the right long-term fix). The Node server already exists. Relaying PeerJS messages over WebSocket through it removes NAT problems. Moving the authoritative simulation to the server (`tests/game.cjs` already runs the sim headlessly in `node:vm`) removes host loss, enables async turns spanning hours, and makes ranked attestation simpler. This keeps the CLAUDE.md invariant: camera state and keys never enter snapshots.

## 10. Telegram Stars monetization

### 10.1 Rules

- Inside Telegram, **digital goods and services must be paid in Telegram Stars** (currency `XTR`). This follows Apple and Google store rules, which Telegram's Bot Developer Terms enforce. ROADMAP Phase 6's Stripe Checkout may remain for the web build, but **must not be offered inside the Mini App** for digital goods.
- Stars invoices: `currency="XTR"`, `provider_token=""` (empty), `prices` with **exactly one** item. In a Mini App, the server calls `createInvoiceLink` and the client calls `WebApp.openInvoice(link, cb)`. The `invoiceClosed` status is `paid` / `cancelled` / `failed` / `pending`.
- **Never grant on the client callback.** Grant only on the server's `successful_payment` update. Key grants by `telegram_payment_charge_id` so that delivering the same update twice grants once.
- **Answer `pre_checkout_query` within 10 seconds.** Validate that the item exists, the price is current, and the user doesn't already own a non-consumable.
- **Refunds:** `refundStarPayment(user_id, telegram_payment_charge_id)`. The bot must support a **`/paysupport`** command and should have **`/terms`**.
- **Subscriptions:** `createInvoiceLink` with `subscription_period=2592000` (30 days, the only allowed value). `BotSubscriptionUpdated` (10.2) reports subscription changes. `editUserStarSubscription` cancels or re-enables a subscription.
- **Reconciliation:** `getStarTransactions` and `getMyStarBalance` (9.1).

- **Invoice field limits:** `title` 1–32 characters, `description` 1–255, `payload` 1–128 bytes. Subscription price is at most 10,000 Stars. No general per-invoice minimum or maximum was found in the pages read.
- **Checklist from Telegram's Stars guide:**
  - Answer **`/terms`**, and have users confirm the terms before buying.
  - Answer **`/support`** or provide another clear channel.
  - State that Telegram support cannot help with bot purchases.
  - Keep backups of payment records.
- **TOS 6.2.1:** unresolved valid disputes can lead to debited Stars, removal, or a SCAM label. Telegram also *expressly discourages* real-time sale of virtual items that cannot be reclaimed after a chargeback. This is another reason to sell revocable entitlements, not consumable advantages.
- **Revenue:**
  - Earned Stars may be held for up to 21 days.
  - Withdrawal goes through Fragment as TON, at a Telegram-set rate (TOS 6.2.4 quotes 0.013 USD per Star).
  - Stars can buy Telegram Ads at a discount (TOS quotes 0.02 USD of ad credit per Star).
  - Unused Stars expire after 3 years.
- **Avoid this fee trap:** under TOS 6.2.6, enabling **topics in private chats** for the bot (Bot API 9.3) adds a 15% non-refundable fee to every later Star purchase. Leave it off.
- **Affiliate programs:** transactions carry `AffiliateInfo` (`commission_per_mille`). Programs are set up through Telegram's referral program tools, not a Bot API method.

### 10.2 What to sell (recommendation: cosmetic and convenience only)

The ROADMAP commits to non-pay-to-win supporter perks, and ranked attestation assumes equal arsenals. Never sell match credits, weapons or actions.

| Product | Type | Notes |
|---|---|---|
| **Supporter** (monthly) | Stars subscription | Supporter badge, callsign colour, the Neon and VGA themes (ROADMAP Phase 3), more saved maps. This is the Telegram equivalent of Phase 6. |
| Tank skins, turret decals, shell trail colours, explosion palettes | One-time | Visible to opponents. Snapshots carry a cosmetic ID only, and the host validates ownership through the server. |
| Victory emotes and taunt quote packs | One-time | Fits the existing custom quote pools. |
| Campaign mission packs (ROADMAP Phase 2) | One-time | Optional premium chapters; the base campaign stays free. |
| AI "Mastermind" opponent passes | Consumable or within Supporter | This covers real Gemini/OpenAI API cost per decision. It is the only product with a marginal cost. |
| Map editor extras (more slots, larger platform budget) | One-time | Must not change ranked rules. |

Do not build entry-fee tournaments with Star or cash prizes. Paid entry with a prize can count as gambling in many jurisdictions and needs legal review.

### 10.3 Server design

- **New tables:**
  - `purchases(charge_id PK, user_id, sku, stars, created_at, refunded_at)`
  - `entitlements(user_id, sku, expires_at)`
  - `skus(sku PK, stars, kind, active)`
- **Endpoints and webhook handling:**
  - `POST /api/stars/invoice {sku}`: the user must be authenticated. Calls `createInvoiceLink`. The payload is an opaque `purchase_intent` ID (not the user ID in clear).
  - Webhook `pre_checkout_query`: validate the intent and answer.
  - Webhook `successful_payment`: insert the purchase idempotently and grant the entitlement.
  - `GET /api/entitlements` returns what the user owns. The client refetches it on `invoiceClosed: paid`.
- **Refunds** revoke the entitlement. Subscription lapse sets `expires_at`.
- **Tests:** a fake Telegram API, like the fake AI provider in `tests/ai.cjs`, covering intent validation, duplicate `successful_payment`, refund revocation and expired `auth_date`.

## 11. Feature parity checklist

| Desktop feature | Mobile / Telegram equivalent | Section |
|---|---|---|
| Angle/power sliders, arrow-key fine aim | Drag-to-aim + nudge steppers + haptic ticks | 6.2 |
| Space / FIRE | MainButton **FIRE** | 7.1 |
| Weapon `<select>` (full arsenal) | Card carousel | 6.2 |
| F / E / V / R cameras | Snap row, double-tap tank, gestures | 6.3 |
| WASD explore | Virtual stick | 6.3 |
| Drive buttons, arrow keys | Hold buttons on left thumb | 6.4 |
| Drone W/S/A/D/Q/E/Space | Virtual stick + throttle + tilt option + SecondaryButton detonate | 6.4 |
| Esc / close modals | BackButton | 7.1 |
| Shop | Portrait-friendly grid; MainButton **READY** | 7.1 |
| Hotseat (2–6 on one device) | Same; MainButton text "Pass to <name>" between turns | 6, 7.1 |
| Private/public online rooms | Invite cards + `r_` deep links + TURN | 8, 9 |
| Server AI (Gemini/OpenAI) | Unchanged; Telegram sign-in satisfies the gate | 5.2 |
| Accounts, TOTP, OAuth | Silent Telegram sign-in; link existing accounts | 5 |
| Leaderboard and dossiers | Global + per-group (`chat_instance`) | 8 |
| Map editor (`M`) | Touch brushes, `downloadFile` export, `m_` share links | 6.7, 7.2 |
| `localStorage` maps/HUD | DeviceStorage / CloudStorage adapter | 7.5 |
| Help / Field Manual | Rewritten for touch; first-run interactive tutorial (recommended) | 12 |
| Supporter donations (Phase 6) | Stars subscription | 10 |

## 12. Phased implementation plan (estimates are rough)

| Phase | Scope | Estimate | Notes |
|---|---|---|---|
| **T1. Mobile HUD and touch controls** | 6.1–6.5. Collapsible edge HUD, drag-to-aim, nudges, carousel, gestures, drive/drone sticks, haptics abstraction (no-op outside Telegram), audio resume, quality defaults. | 16–24 h | Benefits mobile web too. Extend `tests/browser/hud-camera.cjs` with phone-viewport and touch-gesture cases. |
| **T2. Telegram shell** | SDK include, `ready()`, fullscreen + orientation lock, safe areas, BackButton/Main/Secondary/Settings wiring, closing confirmation, vertical-swipe lock, theme colours, storage adapter. | 6–8 h | All feature-detected; the plain web build is unaffected. |
| **T3. Telegram sign-in** | `POST /api/auth/telegram`, `oauth_accounts` provider, bearer tokens in SecureStorage, account linking, verified-identity gate. | 6–8 h | Unit tests for HMAC, stale `auth_date` and tampered fields. |
| **T4. Bot + deep links + invites** | Webhook with secret token, `/start` routing, `start_param` routing, prepared invite messages, inline mode, QR join. | 8–10 h | |
| **T5. Notifications and sharing** | Write-access request, turn notifications, result cards, Story share, home-screen prompt, emoji-status reward. | 6–8 h | |
| **T6. Stars store** | SKUs, invoices, webhook payments, entitlements, refunds, `/paysupport`, `/terms`, cosmetics rendering, Supporter subscription. | 12–16 h | Cosmetic assets are extra work. |
| **T7. Mobile multiplayer hardening** | TURN credentials endpoint; host-backgrounding handling. Optional: server relay / server-authoritative sim. | 6 h (TURN) / 30+ h (server authority) | |
| **T8. Device QA** | Test matrix (13). | 6–8 h | |

The client work in T1, T2 and parts of T3–T6 is inside `index.html`. It is large: well over this repo's 3,000-character triage threshold, so it goes through the Tier 3 workflow. Keep it inside the single file per the cardinal rule. Any new code before the `tests/game.cjs` sentinel must keep `npm test` passing.

## 13. Testing

- **Telegram test environment.** This is a separate account and bot, created on the test server via its own @BotFather. Bot API calls go to `https://api.telegram.org/bot<token>/test/<method>`. The test server allows plain HTTP, and all bots can use the attachment menu there. Stars payments in the test environment do not spend real Stars (verify before relying on it).
- **Inspecting the WebView:**
  - iOS: tap Settings 10× → "Allow Web View Inspection" → Safari Develop menu.
  - Android: hold the version number twice in Settings → "Enable WebView Debug" → `chrome://inspect`.
  - Desktop beta: Advanced → Experimental → "Enable webview inspection".
- **Automated.** Stub `window.Telegram.WebApp` in Playwright (`page.addInitScript`) to test button wiring, deep-link routing and safe-area padding at phone viewports. Add server tests for initData verification and payment idempotency with a fake Bot API.
- **Device matrix** (minimum):
  - iPhone (recent and an older model).
  - Android with a HIGH and a LOW performance class.
  - Telegram Desktop (Windows/macOS).
  - Telegram Web (A and K clients) for the iframe/cookie case.
  - Online match across Wi-Fi and cellular, with one player minimising mid-turn.

## 14. Open decisions for the owner

1. **Hosting.** Which HTTPS host runs the Node server for Telegram, given that the static Sites deployment can't?
2. **Multiplayer transport.** Is TURN enough, or should the project invest in server relay / server authority (section 9)?
3. **Store contents and prices.** Are cosmetics, Supporter and AI passes acceptable? Should the web build keep Stripe?
4. **Orientation.** Should matches be landscape-only on phones, or support portrait play too?
5. **Account policy.** Should a Telegram-only account (no email) be allowed on the public leaderboard?

## Sources

- Telegram Mini Apps documentation: https://core.telegram.org/bots/webapps
- Bot API changelog (8.2 → 10.4): https://core.telegram.org/bots/api-changelog
- Bot API reference, Payments: https://core.telegram.org/bots/api#payments
- Payments in Telegram Stars: https://core.telegram.org/bots/payments-stars
- Bot Developer Terms of Service: https://telegram.org/tos/bot-developers
- HTML5 Gaming Platform: https://core.telegram.org/bots/games
- Telegram Login Widget: https://core.telegram.org/widgets/login
- Secondary summaries used only to locate the above: [dev.to: Telegram bots on localhost and the origin check](https://dev.to/instatunnel/telegram-bots-and-mini-apps-on-localhost-setwebhook-the-secret-token-header-and-the-new-origin-p8g), [Telegram Mini Apps community docs: validating init data](https://docs.telegram-mini-apps.com/packages/tma-js-init-data-node/validating), [Telegram bible: bot payments end to end](https://telegram-bible.pages.dev/guides/bot-payments-end-to-end)
