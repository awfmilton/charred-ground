'use strict';
// Browser smoke suite for the HUD layout and on-screen camera controls (issue #14).
// Drives the real game in headless Chromium: real mouse, touch-sized pointers and keyboard input, the same way a player would.
//
//   npm run test:browser                       # runs this suite and the original browser suite
//   CG_BROWSER_ONLY=layout,fade npm run test:browser:hud   # a subset (names listed in `tests` below)
//
// Screenshots of each checked layout are written to test-results/browser/.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { launchBrowser, routeVendoredScripts, ROOT } = require('./support.cjs');
const TARGET = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'test-results', 'browser');
const ONLY = (process.env.CG_BROWSER_ONLY || '').split(',').filter(Boolean);
const IGNORED = /Failed to load resource|favicon|fonts\.g|\/api\//;
const CARDS = ['caption', 'roster', 'weather', 'shotCard', 'camDock', 'hud', 'hudFab'];
// The middle of the battlefield: no HUD card may intersect this box at any tested size.
const CENTRE = { x0: 0.30, x1: 0.70, y0: 0.25, y1: 0.60 };
const SIZES = [
  { name: 'desktop-1280x720', width: 1280, height: 720 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'tablet-820x1180', width: 820, height: 1180 },
  { name: 'phone-390x844', width: 390, height: 844 },
];
function serve() {
  const html = fs.readFileSync(TARGET);
  const srv = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/' || req.url.split('?')[0] === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html); }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` })));
}
async function open(browser, url, viewport) {
  // Reduced motion: the HUD fades switch instantly, so opacity reflects state immediately. With software
  // WebGL a headless frame can take seconds, and CSS transitions only advance on frames.
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, reducedMotion: 'reduce' });
  await routeVendoredScripts(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.THREE && typeof S !== 'undefined' && S && typeof terrainGeo !== 'undefined' && terrainGeo, null, { timeout: 120000 });
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
// Real pointer press on the centre of a visible element.
async function tap(page, sel) {
  const el = await page.$(sel);
  if (!el) throw new Error(`${sel} not found`);
  await el.scrollIntoViewIfNeeded();
  const bb = await el.boundingBox();
  if (!bb) throw new Error(`${sel} not visible`);
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(150);
}
async function startMatch(page) {
  await tap(page, '#startBtn');
  await page.waitForFunction(() => running && S && S.phase === 'aim', null, { timeout: 30000 });
  await page.waitForTimeout(300);
}
// Mouse press on a camera button, held for `ms` (ms=0 is a plain click).
async function press(page, sel, ms = 0) {
  const bb = await (await page.$(sel)).boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  if (ms) await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(120);
}
const view = (page) => page.evaluate(() => ({ viewMode, orbitYaw, orbitPitch, orbitZoom, exploreX, exploreZ, camPanY, phase: S.phase, round: S.round }));
const rects = (page) => page.evaluate((ids) => ids.map((id) => {
  const el = document.getElementById(id);
  if (!el) return { id, missing: true };
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return { id, display: cs.display, x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom, opacity: +cs.opacity };
}), CARDS);
const toast = (page) => page.evaluate(() => document.getElementById('toast').textContent);
const opacityOf = (page, id) => page.evaluate((i) => +getComputedStyle(document.getElementById(i)).opacity, id);
const wait = (page, ms) => page.waitForTimeout(ms);
const tests = {
  // Every panel stays at the edges; the middle of the battlefield is clear; nothing overlaps; the camera buttons are reachable.
  async layout({ browser, url }) {
    const fails = [], notes = [];
    for (const size of SIZES) {
      const g = await open(browser, url, { width: size.width, height: size.height });
      await startMatch(g.page);
      await wait(g.page, 400);
      const list = (await rects(g.page)).filter((r) => r.display !== 'none' && !r.missing);
      const cx0 = size.width * CENTRE.x0, cx1 = size.width * CENTRE.x1, cy0 = size.height * CENTRE.y0, cy1 = size.height * CENTRE.y1;
      for (const r of list) {
        const hit = r.x < cx1 && r.right > cx0 && r.y < cy1 && r.bottom > cy0;
        if (hit) fails.push(`${size.name}: ${r.id} covers the battlefield centre`);
        if (r.x < -1 || r.y < -1 || r.right > size.width + 1 || r.bottom > size.height + 1) fails.push(`${size.name}: ${r.id} is off screen`);
      }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1) fails.push(`${size.name}: ${a.id} overlaps ${b.id}`);
      }
      // Every camera button must be the element a finger or cursor actually hits.
      const reach = await g.page.evaluate(() => [...document.querySelectorAll('#camDock button')].map((b) => {
        const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { label: b.getAttribute('aria-label'), ok: !!hit && (hit === b || b.contains(hit)), visible: r.width > 0 && r.height > 0 && r.bottom <= innerHeight && r.right <= innerWidth };
      }));
      for (const b of reach) if (!b.ok || !b.visible) fails.push(`${size.name}: camera button "${b.label}" is hidden or covered`);
      const collapsedDefault = (await rects(g.page)).filter((r) => r.h < 40 && r.display !== 'none' && r.id !== 'hudFab').map((r) => r.id);
      notes.push(`${size.name}: ${list.length} panels, ${reach.length} camera buttons reachable${collapsedDefault.length ? ', collapsed by default: ' + collapsedDefault.join('/') : ''}`);
      fs.mkdirSync(OUT, { recursive: true });
      await g.page.screenshot({ path: path.join(OUT, size.name + '.png') });
      if (g.errors.length) fails.push(`${size.name}: ${g.errors.join(' | ')}`);
      await g.ctx.close();
    }
    return { ok: !fails.length, detail: fails.length ? fails.slice(0, 6).join('; ') : notes.join('; ') };
  },
  // One click hides a card to its edge tab; one click shows it again.
  async singleClickCollapse({ browser, url }) {
    const g = await open(browser, url, { width: 1280, height: 720 });
    await startMatch(g.page);
    const bar = '#weather .hcard-toggle';
    const h0 = (await rects(g.page)).find((r) => r.id === 'weather').h;
    await tap(g.page, bar);
    const collapsed = await g.page.evaluate(() => document.getElementById('weather').classList.contains('hud-collapsed'));
    const h1 = (await rects(g.page)).find((r) => r.id === 'weather').h;
    const label1 = await g.page.textContent(bar);
    await tap(g.page, bar);
    const restored = await g.page.evaluate(() => !document.getElementById('weather').classList.contains('hud-collapsed'));
    const h2 = (await rects(g.page)).find((r) => r.id === 'weather').h;
    await g.ctx.close();
    const ok = collapsed && h1 < h0 / 2 && label1 === 'SHOW' && restored && Math.abs(h2 - h0) < 2 && !g.errors.length;
    return { ok, detail: `height ${h0.toFixed(0)} -> ${h1.toFixed(0)} -> ${h2.toFixed(0)}, label after hide: ${label1}${g.errors.length ? ' errors: ' + g.errors.join(' / ') : ''}` };
  },
  // Panels fade while the player moves the camera, while aiming, and during a shot; the camera dock and fire control stay usable.
  async fade({ browser, url }) {
    const g = await open(browser, url, { width: 1280, height: 720 });
    const { page } = g;
    await startMatch(page);
    const out = [];
    // 1. camera: hold a rotate button
    const bb = await (await page.$('#camDock [data-cam="rot-right"]')).boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await wait(page, 500);
    const camFade = [await opacityOf(page, 'roster'), await opacityOf(page, 'weather'), await opacityOf(page, 'hud'), await opacityOf(page, 'camDock')];
    await page.mouse.up(); await wait(page, 2000);
    const camBack = await opacityOf(page, 'roster');
    out.push(`camera moving: players ${camFade[0]} wind ${camFade[1]} fire ${camFade[2]} dock ${camFade[3]}`);
    const camOk = camFade[0] < 0.3 && camFade[1] < 0.3 && camFade[2] < 0.3 && camFade[3] > 0.9 && camBack > 0.9;
    // 2. aiming: an arrow key moves the barrel (the same path as the aim sliders)
    await page.keyboard.press('ArrowLeft'); await wait(page, 500);
    const aim = [await opacityOf(page, 'weather'), await opacityOf(page, 'hud'), await opacityOf(page, 'camDock')];
    await wait(page, 2000);
    out.push(`aiming: wind ${aim[0]} fire ${aim[1]} dock ${aim[2]}`);
    const aimOk = aim[0] < 0.3 && aim[1] > 0.9 && aim[2] < 0.3;
    // 3. during a shot: fire from the fire control, watch the flight
    const sh = await page.evaluate(() => S.shots.length);
    await tap(page, '#fireBtn');
    await page.waitForFunction(() => S.phase === 'flight', null, { timeout: 10000 }).catch(() => {});
    await wait(page, 500);
    const flightFade = [await opacityOf(page, 'weather'), await opacityOf(page, 'roster'), await opacityOf(page, 'camDock')];
    out.push(`during shot: wind ${flightFade[0]} players ${flightFade[1]} dock ${flightFade[2]} (phase ${await page.evaluate(() => S.phase)})`);
    const flightOk = flightFade[0] < 0.3 && flightFade[1] < 0.3 && flightFade[2] > 0.9;
    await page.waitForFunction(() => S.phase === 'aim', null, { timeout: 60000 }).catch(() => {});
    await g.ctx.close();
    const ok = camOk && aimOk && flightOk && !g.errors.length && sh >= 0;
    return { ok, detail: out.join('; ') + (g.errors.length ? ' errors: ' + g.errors.join(' / ') : '') };
  },
  // Each shortcut button does exactly what its key does, from the same starting view.
  async shortcuts({ browser, url }) {
    const g = await open(browser, url, { width: 1280, height: 720 });
    const { page } = g;
    await startMatch(page);
    const pairs = [['f', '#camFocus'], ['e', '#camExplore'], ['v', '#camGunner'], ['r', '[data-cam-shortcut="reset"]']];
    const fails = [], seen = [];
    for (const [key, sel] of pairs) {
      await page.keyboard.press('r'); await wait(page, 150);          // start from the overview
      const start = await view(page);
      await page.keyboard.press(key); await wait(page, 150);
      const byKey = await view(page);
      await page.keyboard.press('r'); await wait(page, 150);
      await tap(page, sel);
      const byButton = await view(page);
      const same = JSON.stringify(byKey) === JSON.stringify(byButton);
      if (!same) fails.push(`${key.toUpperCase()} key -> ${JSON.stringify(byKey)} but button -> ${JSON.stringify(byButton)}`);
      if (JSON.stringify(start) === JSON.stringify(byKey) && key !== 'r') fails.push(`${key.toUpperCase()} changed nothing`);
      seen.push(`${key.toUpperCase()}=${byKey.viewMode}`);
    }
    await g.ctx.close();
    return { ok: !fails.length && !g.errors.length, detail: fails.length ? fails.join('; ') : `buttons match keys: ${seen.join(' ')}` };
  },
  // Each camera button: one click = one small step; holding keeps moving; every mode.
  async cameraButtons({ browser, url }) {
    const g = await open(browser, url, { width: 1280, height: 720 });
    const { page } = g;
    await startMatch(page);
    const fails = [], notes = [];
    const check = (name, cond, extra) => { if (!cond) fails.push(`${name} ${extra || ''}`); };
    // rotate
    await page.keyboard.press('r'); await wait(page, 150);
    let v0 = await view(page);
    await press(page, '#camDock [data-cam="rot-right"]');
    let v1 = await view(page);
    const click = v1.orbitYaw - v0.orbitYaw;
    check('rotate click', click > 1 && click < 5, `moved ${click.toFixed(2)}`);
    await press(page, '#camDock [data-cam="rot-left"]', 700);
    let v2 = await view(page);
    check('rotate hold', Math.abs(v2.orbitYaw - v1.orbitYaw) > 15, `moved ${(v2.orbitYaw - v1.orbitYaw).toFixed(1)}`);
    notes.push(`rotate click ${click.toFixed(1)}° hold ${(v2.orbitYaw - v1.orbitYaw).toFixed(0)}°`);
    // tilt
    v0 = await view(page); await press(page, '#camDock [data-cam="tilt-up"]'); v1 = await view(page);
    check('tilt click', Math.abs(v1.orbitPitch - v0.orbitPitch - 2) < 0.1, `moved ${(v1.orbitPitch - v0.orbitPitch).toFixed(2)}`);
    await press(page, '#camDock [data-cam="tilt-down"]', 1500); v2 = await view(page);
    check('tilt hold clamps at 10', v2.orbitPitch >= 10 && v2.orbitPitch < 12, `pitch ${v2.orbitPitch.toFixed(1)}`);
    // zoom
    v0 = await view(page); await press(page, '#camDock [data-cam="zoom-in"]'); v1 = await view(page);
    check('zoom click', Math.abs(v1.orbitZoom / v0.orbitZoom - 1.06) < 0.01, `ratio ${(v1.orbitZoom / v0.orbitZoom).toFixed(3)}`);
    await press(page, '#camDock [data-cam="zoom-out"]', 800); v2 = await view(page);
    check('zoom hold out', v2.orbitZoom < v1.orbitZoom / 1.5, `zoom ${v2.orbitZoom.toFixed(2)}`);
    // pan: left button moves the view left (smaller X); up moves it away (smaller Z at yaw 0)
    await page.keyboard.press('r'); await wait(page, 150);
    v0 = await view(page); await press(page, '#camDock [data-cam="pan-left"]'); v1 = await view(page);
    check('pan left click', v1.exploreX < v0.exploreX - 0.05, `dX ${(v1.exploreX - v0.exploreX).toFixed(2)}`);
    await press(page, '#camDock [data-cam="pan-right"]', 900); v2 = await view(page);
    check('pan right hold', v2.exploreX > v1.exploreX + 5, `dX ${(v2.exploreX - v1.exploreX).toFixed(1)}`);
    v0 = await view(page); await press(page, '#camDock [data-cam="pan-up"]'); v1 = await view(page);
    check('pan up click', v1.exploreZ !== v0.exploreZ, `dZ ${(v1.exploreZ - v0.exploreZ).toFixed(2)}`);
    // centre on my tank
    await press(page, '#camDock [data-cam="center"]');
    const tankX = await page.evaluate(() => current().x);
    const cen = await view(page);
    check('center on tank', Math.abs(cen.exploreX - tankX) < 1, `exploreX ${cen.exploreX.toFixed(1)} tank ${tankX.toFixed(1)}`);
    // gunner view: buttons aim the barrel
    await tap(page, '#camGunner'); await wait(page, 200);
    const aiming = await page.evaluate(() => !current().ai && (!online || myId === S.turn));
    if (aiming) {
      const az0 = await page.evaluate(() => +document.getElementById('azimuth').value);
      const an0 = await page.evaluate(() => +document.getElementById('angle').value);
      await press(page, '#camDock [data-cam="rot-right"]');
      const az1 = await page.evaluate(() => +document.getElementById('azimuth').value);
      check('gunner rotate aims azimuth', Math.abs(az1 - az0 - 1) < 0.01, `az ${az0} -> ${az1}`);
      await press(page, '#camDock [data-cam="tilt-up"]');
      const an1 = await page.evaluate(() => +document.getElementById('angle').value);
      check('gunner tilt aims elevation', an1 - an0 === 1, `angle ${an0} -> ${an1}`);
      const z0 = await view(page); await press(page, '#camDock [data-cam="zoom-in"]'); const z1 = await view(page);
      check('gunner zoom works', z1.orbitZoom > z0.orbitZoom, '');
      notes.push('gunner aim verified');
    } else notes.push('gunner aim skipped (AI turn)');
    // map editor blocks the camera and says why
    await tap(page, '#editBtn'); await wait(page, 200);
    await press(page, '#camDock [data-cam="pan-left"]');
    const why = await toast(page);
    check('blocked explains why', /editor/i.test(why), `toast "${why}"`);
    await tap(page, '#edCancelBtn'); await wait(page, 200);
    await page.keyboard.press('r'); await wait(page, 150);
    await g.ctx.close();
    return { ok: !fails.length && !g.errors.length, detail: (fails.length ? fails.join('; ') + '; ' : '') + notes.join('; ') + (g.errors.length ? ' errors: ' + g.errors.join(' / ') : '') };
  },
  // Left drag rotates (as it always has); right or Shift drag pans.
  async mouseControls({ browser, url }) {
    const g = await open(browser, url, { width: 1280, height: 720 });
    const { page } = g;
    await startMatch(page);
    await page.keyboard.press('r'); await wait(page, 150);
    const cv = await (await page.$('#world')).boundingBox();
    const sx = cv.x + cv.width * 0.5, sy = cv.y + cv.height * 0.45;
    let v0 = await view(page);
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 120, sy + 30, { steps: 8 }); await page.mouse.up(); await wait(page, 100);
    let v1 = await view(page);
    const leftRotates = Math.abs(v1.orbitYaw - v0.orbitYaw) > 20 && Math.abs(v1.exploreX - v0.exploreX) < 0.5;
    await page.mouse.move(sx, sy); await page.mouse.down({ button: 'right' }); await page.mouse.move(sx + 120, sy, { steps: 8 }); await page.mouse.up({ button: 'right' }); await wait(page, 100);
    let v2 = await view(page);
    const rightPans = Math.abs(v2.exploreX - v1.exploreX) > 1 && Math.abs(v2.orbitYaw - v1.orbitYaw) < 0.5;
    await page.keyboard.down('Shift'); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy + 120, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Shift'); await wait(page, 100);
    let v3 = await view(page);
    const shiftPans = Math.abs(v3.exploreZ - v2.exploreZ) > 1 && Math.abs(v3.orbitYaw - v2.orbitYaw) < 0.5;
    await g.ctx.close();
    const ok = leftRotates && rightPans && shiftPans && !g.errors.length;
    return { ok, detail: `left-drag rotates: ${leftRotates}; right-drag pans: ${rightPans}; Shift-drag pans: ${shiftPans}${g.errors.length ? ' errors: ' + g.errors.join(' / ') : ''}` };
  },
  // A shot in the air: the camera buttons still move the view.
  async cameraDuringShot({ browser, url }) {
    const g = await open(browser, url, { width: 1280, height: 720 });
    const { page } = g;
    await startMatch(page);
    await tap(page, '#fireBtn');
    const flying = await page.waitForFunction(() => S.phase === 'flight', null, { timeout: 10000 }).then(() => true, () => false);
    if (!flying) { await g.ctx.close(); return { ok: false, detail: 'no shot entered flight' }; }
    const v0 = await view(page);
    await press(page, '#camDock [data-cam="rot-right"]', 300);
    const v1 = await view(page);
    const moved = Math.abs(v1.orbitYaw - v0.orbitYaw) > 5;
    const toastNow = await toast(page);
    await page.waitForFunction(() => S.phase === 'aim', null, { timeout: 60000 }).catch(() => {});
    await g.ctx.close();
    return { ok: moved && !g.errors.length, detail: `during flight, rotate moved view ${(v1.orbitYaw - v0.orbitYaw).toFixed(1)}°${toastNow ? ' toast: ' + toastNow : ''}${g.errors.length ? ' errors: ' + g.errors.join(' / ') : ''}` };
  },
  // Plays a whole round through the real UI: aim with the sliders, fire, watch the shots resolve.
  async playRound({ browser, url }) {
    const g = await open(browser, url, { width: 1280, height: 720 });
    const { page } = g;
    await startMatch(page);
    const round0 = await page.evaluate(() => S.round);
    const hp0 = await page.evaluate(() => S.tanks.map((t) => t.hp));
    let shots = 0, t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const state = await page.evaluate(() => ({ phase: S.phase, round: S.round, can: canControl(), over: S.tanks.filter((t) => t.hp > 0).length < 2 }));
      if (state.round !== round0 || state.over) break;
      if (state.phase === 'aim' && state.can) {
        await page.evaluate(() => { document.getElementById('angle').value = 35 + Math.round(Math.random() * 90); document.getElementById('power').value = 300 + Math.round(Math.random() * 500); updateUI(); });
        await tap(page, '#fireBtn'); shots++;
        await page.waitForFunction(() => S.phase !== 'flight', null, { timeout: 60000 }).catch(() => {});
      } else await wait(page, 300);
    }
    const hp1 = await page.evaluate(() => S.tanks.map((t) => t.hp));
    // Random aim can miss every time, so damage is reported, not required. What must hold: shots were fired
    // through the real fire control, each one resolved back to aiming, and the last-shot readout recorded it.
    const lastShot = await page.evaluate(() => document.getElementById('lastShotInfo').textContent);
    const resolved = await page.waitForFunction(() => S.phase !== 'flight', null, { timeout: 60000 }).then(() => true, () => false);
    await page.screenshot({ path: path.join(OUT, 'round-played-1280x720.png') });
    await g.ctx.close();
    return { ok: shots > 0 && resolved && !/NONE/.test(lastShot) && !g.errors.length, detail: `${shots} human shots fired, last shot "${lastShot}", HP ${hp0.join('/')} -> ${hp1.join('/')}${g.errors.length ? ' errors: ' + g.errors.join(' / ') : ''}` };
  },
};
(async () => {
  if (!fs.existsSync(TARGET)) { console.error('no such build: ' + TARGET); process.exit(2); }
  const { srv, url } = await serve();
  const browser = await launchBrowser();
  console.log('HUD and camera browser suite against index.html');
  let failed = 0, passed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const t0 = Date.now(); let r;
    // A test that hangs (for example, a browser that died) fails after 5 minutes instead of stalling the whole run.
    const limit = new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after 5 minutes')), 300000));
    try { r = await Promise.race([fn({ browser, url }), limit]); } catch (e) { r = { ok: false, detail: 'threw: ' + e.message.split('\n')[0] }; }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (r.ok) passed++; else failed++;
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${name} (${secs}s) - ${r.detail}`);
  }
  await browser.close(); srv.close();
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
