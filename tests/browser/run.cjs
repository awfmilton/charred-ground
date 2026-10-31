'use strict';
// Browser smoke suite: drives the real game in headless Chromium with real mouse/keyboard input where a human
// would act, and reads game state only to check outcomes. Deterministic (fixed seeds), one browser, sequential.
//
//   npm run test:browser                    # tests ./index.html
//   npm run test:browser -- path/to/old.html  # run the same checks against another build (e.g. before a fix)
//   CG_BROWSER_NET=1 npm run test:browser   # also run the two-peer sync check (needs the public PeerJS broker)
//   CG_BROWSER_ONLY=editor,audio npm run test:browser
//
// Needs internet: index.html loads three.js and PeerJS from CDNs.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const target = path.resolve(process.argv[2] || path.join(ROOT, 'index.html'));
const ONLY = (process.env.CG_BROWSER_ONLY || '').split(',').filter(Boolean);
const NET = process.env.CG_BROWSER_NET === '1';
const IGNORED_CONSOLE = /favicon\.ico|\/api\/|ERR_CONNECTION|Failed to load resource/;

function serve(file) {
  const html = fs.readFileSync(file);
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html); }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` })));
}

async function openGame(browser, url, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.THREE && typeof S !== 'undefined' && S && typeof terrainGeo !== 'undefined' && terrainGeo, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  return { page, ctx, errors };
}

// Real pointer input on a visible element's centre.
async function click(page, sel) {
  const el = await page.$(sel);
  if (!el) throw new Error(`${sel} not found`);
  await el.scrollIntoViewIfNeeded(); // a person scrolls a long menu before clicking
  const bb = await el.boundingBox();
  if (!bb) throw new Error(`${sel} not visible`);
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 4 });
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
}

async function startLocalMatch(page) {
  await click(page, '#startBtn'); // the real DEPLOY TO BATTLE button on the visible main menu
  await page.waitForFunction(() => running && S && S.phase === 'aim', null, { timeout: 30000 });
  await page.mouse.click(720, 300); // focus the battlefield, not an input
}

const tests = {
  async load({ browser, url }) {
    const g = await openGame(browser, url);
    const r = await g.page.evaluate(() => ({ W, D, CELL, NX, NZ, verts: terrainGeo.attributes.position.count, heights: S.heights.length }));
    await g.ctx.close();
    const ok = r.W === 960 && r.D === 240 && r.NX * r.NZ === r.heights && r.verts >= r.NX * r.NZ && !g.errors.length;
    return { ok, detail: JSON.stringify(r) + (g.errors.length ? ' errors: ' + g.errors.join(' / ') : '') };
  },

  async editor({ browser, url }) {
    const g = await openGame(browser, url); const p = g.page; const out = {}; const fails = [];
    await p.evaluate(() => { window.__notes = []; const n = notice; notice = (m) => { window.__notes.push(String(m)); return n(m); }; });
    await click(p, '#menuEditBtn');
    if (!(await p.evaluate(() => editorOpen))) fails.push('editor did not open from the menu');
    const w = await (await p.$('#world')).boundingBox();
    const at = (fx, fy) => [w.x + w.width * fx, w.y + w.height * fy];
    const pick = (fx, fy) => p.evaluate(([x, y]) => screenToWorld({ clientX: x, clientY: y }), at(fx, fy));
    // RAISE: drag at a point; the terrain changes there and not 60 m away in depth.
    const pt = await pick(0.5, 0.55);
    const h0 = await p.evaluate(([x, z]) => [height(x, z), height(x, -z - 60)], [pt.x, pt.z]);
    let [cx, cy] = at(0.5, 0.55);
    await p.mouse.move(cx, cy); await p.mouse.down();
    for (let i = 0; i < 8; i++) { await p.mouse.move(cx + i, cy); await p.waitForTimeout(40); }
    await p.mouse.up();
    const h1 = await p.evaluate(([x, z]) => [height(x, z), height(x, -z - 60)], [pt.x, pt.z]);
    out.raise = +(h1[0] - h0[0]).toFixed(2); out.far = +(h1[1] - h0[1]).toFixed(2);
    if (!(out.raise > 0.5 && Math.abs(out.far) < 1e-6)) fails.push(`RAISE changed ${out.raise} m at the point and ${out.far} m far away`);
    // Brush size slider via the keyboard, as a person would after clicking it.
    const before = await p.evaluate(() => document.getElementById('brushOut')?.textContent);
    await click(p, '#brushSize'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
    const after = await p.evaluate(() => document.getElementById('brushOut')?.textContent);
    if (!after || after === before) fails.push(`brush label did not update (${before} -> ${after})`);
    // PLATFORM at a clicked point.
    await click(p, '#toolPlat'); [cx, cy] = at(0.42, 0.5); await p.mouse.click(cx, cy); await p.waitForTimeout(300);
    out.platforms = await p.evaluate(() => (S.platforms || []).length);
    if (out.platforms < 1) fails.push('PLATFORM click placed no deck');
    // SPAWN slot 3 on a clicked dry point away from the other flags.
    await click(p, '#toolSpawn'); await p.selectOption('#spawnSlot', '2');
    let target = null;
    for (let fy = 0.45; fy <= 0.75 && !target; fy += 0.03) for (let fx = 0.3; fx <= 0.75 && !target; fx += 0.03) {
      const q = await pick(fx, fy);
      const okSpot = await p.evaluate(([x, z]) => supportHeight(x, z) >= WATER_LEVEL + 1 && editorSpawns.every((o) => Math.hypot(o.x - x, o.z - z) >= 12), [q.x, q.z]);
      if (okSpot && Math.abs(q.z) > 20) target = { fx, fy, q };
    }
    if (!target) fails.push('no dry clickable spawn point found');
    else {
      [cx, cy] = at(target.fx, target.fy); await p.mouse.click(cx, cy); await p.waitForTimeout(300);
      const s2 = await p.evaluate(() => editorSpawns[2]);
      if (!s2 || Math.hypot(s2.x - target.q.x, s2.z - target.q.z) > 3) fails.push(`spawn slot 3 not at the clicked point (${JSON.stringify(s2)} vs ${JSON.stringify(target.q)})`);
    }
    // A spawn next to another flag is refused WITH a notice (never silently).
    const n0 = await p.evaluate(() => window.__notes.length);
    await p.evaluate(() => { const o = editorSpawns[0]; setSpawnAt(o.x + 2, 2, o.z); });
    const refused = await p.evaluate((n) => window.__notes.slice(n).join(' | '), n0);
    if (!/10m|apart/i.test(refused)) fails.push(`too-close spawn not explained (notices: ${refused || 'none'})`);
    // SAVE, EXPORT, PLAY MAP.
    await click(p, '#edSaveBtn');
    const saved = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem(CUSTOM_MAP_KEY) || '{}')).length);
    if (saved < 1) fails.push('SAVE wrote nothing');
    await click(p, '#edExportBtn');
    const ver = await p.evaluate(() => { try { return JSON.parse(document.getElementById('edJsonIO').value).version; } catch { return null; } });
    if (ver !== 2) fails.push(`EXPORT version ${ver}`);
    await click(p, '#edPlayBtn'); await p.waitForTimeout(800);
    const play = await p.evaluate(() => ({ running, open: editorOpen, terrain: S.cfg.terrain }));
    if (!play.running || play.open || play.terrain !== 'Custom') fails.push('PLAY MAP did not start a Custom match: ' + JSON.stringify(play));
    if (g.errors.length) fails.push('errors: ' + g.errors.join(' / '));
    await g.ctx.close();
    return { ok: !fails.length, detail: fails.length ? fails.join('; ') : JSON.stringify(out) };
  },

  async keyboardDrive({ browser, url }) {
    const g = await openGame(browser, url); const p = g.page; const fails = [];
    await startLocalMatch(p);
    const st = () => p.evaluate(() => { const t = S.tanks[S.turn]; return { x: t.x, z: t.z || 0, h: t.heading || 0, fuel: t.fuel, drive: !!S.activeDrive, hdg: document.getElementById('hdg')?.textContent }; });
    const s0 = await st();
    await p.keyboard.down('w'); await p.waitForTimeout(1200); const s1 = await st();
    await p.keyboard.down('a'); await p.waitForTimeout(1200);
    // The HUD refreshes on rendered frames (headless software GL can run at ~1-2 fps): wait until HDG shows the tank's real heading.
    await p.waitForFunction(() => { const t = S.tanks[S.turn], d = ((Math.round(t.heading / rad) % 360) + 360) % 360; return document.getElementById('hdg').textContent === 'HDG ' + String(d).padStart(3, '0') + '°'; }, null, { timeout: 15000 }).catch(() => {});
    const s2 = await st();
    await p.keyboard.up('a'); await p.keyboard.up('w'); await p.keyboard.press('Escape'); await p.waitForTimeout(600); const s3 = await st();
    if (!s1.drive || Math.hypot(s1.x - s0.x, s1.z - s0.z) < 0.2) fails.push('W did not start moving the tank');
    if (Math.abs(s2.h - s1.h) < 0.05 || s2.hdg === s1.hdg) fails.push(`A did not turn the tank (heading ${s1.h} -> ${s2.h}, ${s1.hdg} -> ${s2.hdg})`);
    if (s3.drive) fails.push('Escape did not stop the drive');
    if (!(s1.fuel < s0.fuel)) fails.push('fuel did not drop while moving');
    const az0 = await p.evaluate(() => +document.getElementById('azimuth').value);
    await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
    const az1 = await p.evaluate(() => +document.getElementById('azimuth').value);
    if (az1 === az0) fails.push('Shift+ArrowRight did not change the azimuth');
    if (g.errors.length) fails.push('errors: ' + g.errors.join(' / '));
    await g.ctx.close();
    return { ok: !fails.length, detail: fails.length ? fails.join('; ') : `heading ${s1.h.toFixed(2)} -> ${s2.h.toFixed(2)}, fuel ${s0.fuel} -> ${s3.fuel.toFixed(1)}, az ${az0} -> ${az1}` };
  },

  async driveButtonsKeepKeyboard({ browser, url }) {
    // Regression (6e96154): leaving an on-screen drive button must not cancel a drive held on the keyboard.
    const g = await openGame(browser, url); const p = g.page;
    await startLocalMatch(p);
    await p.keyboard.down('w'); await p.waitForTimeout(500);
    const bb = await (await p.$('#driveFwd')).boundingBox();
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 5 }); await p.waitForTimeout(200);
    await p.mouse.move(720, 300, { steps: 5 }); await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ drive: !!S.activeDrive, throttle: S.activeDrive && S.activeDrive.throttle }));
    await p.keyboard.up('w'); await g.ctx.close();
    return { ok: r.drive && r.throttle === 1 && !g.errors.length, detail: JSON.stringify(r) + (g.errors.length ? ' errors: ' + g.errors.join(' / ') : '') };
  },

  async audioAfterBeforeunload({ browser, url }) {
    // Regression (0721fe8): sound must not resume an AudioContext that beforeunload closed.
    const g = await openGame(browser, url); const p = g.page;
    const r = await p.evaluate(async () => {
      const unhandled = []; window.addEventListener('unhandledrejection', (e) => unhandled.push(String(e.reason)));
      muted = false; sound('blast'); window.dispatchEvent(new Event('beforeunload'));
      await new Promise((res) => setTimeout(res, 200)); sound('blast'); sound('fire');
      await new Promise((res) => setTimeout(res, 400));
      return { state: audio && audio.state, unhandled };
    });
    await g.ctx.close();
    return { ok: r.state !== 'closed' && !r.unhandled.length && !g.errors.length, detail: JSON.stringify(r) };
  },

  async findPublicMatch({ browser, url }) {
    // Regression (5d0e4e3): FIND PUBLIC MATCH must not throw when PeerJS hands back no connection.
    const g = await openGame(browser, url); const p = g.page;
    await click(p, '#publicBtn');
    await p.waitForTimeout(6000);
    const status = await p.evaluate(() => document.getElementById('netStatus')?.textContent || document.getElementById('menuNote')?.textContent || '');
    await p.evaluate(() => { try { leaveNetwork(); } catch {} });
    await g.ctx.close();
    const uncaught = g.errors.filter((e) => /^pageerror/.test(e));
    return { ok: !uncaught.length, detail: uncaught.length ? uncaught.join(' / ') : `no uncaught errors; status "${status.slice(0, 60)}"` };
  },

  async spawnSweep({ browser, url }) {
    // Generated starts: dry, mutually reachable under the runtime step rule, roomy, spread out.
    const g = await openGame(browser, url); const p = g.page;
    const r = await p.evaluate(() => {
      const out = { rounds: 0, fails: [], minPair: 1e9 }; const base = S.tanks[0];
      for (let sd = 1; sd <= 3; sd++) for (const ty of ['Rolling Hills', 'Jagged Mountains', 'Valleys', 'Cliffs']) for (const n of [2, 4, 6]) {
        S.cfg.terrain = ty; S.tanks = Array.from({ length: n }, (_, id) => ({ ...base, id, name: 'P' + id, inv: starter(), hp: 100, z: 0 }));
        seed = sd; S.seed = sd; S.round = 0; newRound(); out.rounds++;
        const gph = buildSpawnGraph(S.heights);
        const idx = (t) => clamp(Math.round(((t.z || 0) + D) / CELL), 0, NZ - 1) * NX + clamp(Math.round(t.x / CELL), 0, NX - 1);
        const c0 = gph.drvLabels[idx(S.tanks[0])];
        S.tanks.forEach((t, i) => {
          if (t.y < WATER_LEVEL + 1 - 1e-6) out.fails.push(`wet ${ty} s${sd} n${n} #${i}`);
          if (gph.drvLabels[idx(t)] !== c0) out.fails.push(`unreachable ${ty} s${sd} n${n} #${i}`);
          for (let j = i + 1; j < n; j++) out.minPair = Math.min(out.minPair, Math.hypot(t.x - S.tanks[j].x, (t.z || 0) - (S.tanks[j].z || 0)));
        });
      }
      return out;
    });
    await g.ctx.close();
    const ok = !r.fails.length && r.minPair >= 20 && !g.errors.length;
    return { ok, detail: `${r.rounds} rounds, min spawn distance ${r.minPair.toFixed(1)} m` + (r.fails.length ? ' FAILS: ' + r.fails.slice(0, 6).join(', ') : '') };
  },

  async aiBrains({ browser, url }) {
    // Per-slot brains: paid brains are greyed out when signed out or unconfigured; two local AIs play a spectated match.
    const g = await openGame(browser, url); const p = g.page; const fails = [];
    const opts = () => p.evaluate(() => Array.from(document.querySelectorAll('.slot select')[1].options).map((o) => ({ v: o.value, t: o.textContent, d: o.disabled })));
    const o1 = await opts(), by = (o, v) => o.find((x) => x.v === v) || {};
    if (o1.map((x) => x.v).join() !== 'human,ai,gemini,openai,off') fails.push('slot options ' + o1.map((x) => x.v).join());
    if (!by(o1, 'gemini').d || !by(o1, 'openai').d || !/\(sign in\)/.test(by(o1, 'openai').t)) fails.push('signed out: paid brains not greyed out ' + JSON.stringify(o1));
    // Signed in but no server keys, then signed in with a configured provider (state set in-page; no network call is made).
    await p.evaluate(() => { account.user = { id: 1 }; refreshBrainOptions(); });
    const o2 = await opts();
    if (!by(o2, 'openai').d || !/not configured/.test(by(o2, 'openai').t)) fails.push('signed in, unconfigured: ' + JSON.stringify(by(o2, 'openai')));
    await p.evaluate(() => { aiProviders.openai.available = true; refreshBrainOptions(); });
    const o3 = await opts();
    if (by(o3, 'openai').d || by(o3, 'openai').t !== 'ChatGPT') fails.push('signed in, configured: ' + JSON.stringify(by(o3, 'openai')));
    await p.evaluate(() => { account.user = null; aiProviders.openai.available = false; refreshBrainOptions(); });
    // Local AI vs local AI, chosen with the real selects and started with the real button.
    await p.selectOption('.slot:nth-child(1) select', 'ai'); await p.selectOption('.slot:nth-child(2) select', 'ai');
    await click(p, '#startBtn');
    const spect = await p.waitForFunction(() => running && /^SPECTATING/.test(document.getElementById('status').textContent), null, { timeout: 30000 }).then(() => true, () => false);
    if (!spect) fails.push('status never read SPECTATING: ' + await p.evaluate(() => document.getElementById('status').textContent));
    const fired = await p.waitForFunction(() => S.phase === 'flight' || S.tanks.some((t) => t.lastShot), null, { timeout: 60000 }).then(() => true, () => false);
    if (!fired) fails.push('no AI fired within 60 s');
    await g.ctx.close();
    if (g.errors.length) fails.push('errors: ' + g.errors.join(' / '));
    return { ok: !fails.length, detail: fails.length ? fails.join('; ') : 'paid brains gated by sign-in and config; local AI vs local AI spectated and firing' };
  },

  async netSync({ browser, url }) {
    if (!NET) return { skip: true, detail: 'set CG_BROWSER_NET=1 (needs the public PeerJS broker)' };
    const H = await openGame(browser, url, { width: 1280, height: 800 }), G = await openGame(browser, url, { width: 1280, height: 800 });
    const room = 'charred-' + Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, 'a').padEnd(6, 'a');
    await H.page.evaluate((id) => hostRoom(id), room); await H.page.waitForTimeout(4000);
    await G.page.evaluate((id) => joinRoom(id), room); await G.page.waitForTimeout(6000);
    await H.page.evaluate(() => { document.getElementById('menu').classList.add('hidden'); startMatch(); });
    await G.page.waitForTimeout(4000);
    await H.page.evaluate(() => { action({ weaponOrItem: 'Missile', angle: 50, power: 520, az: 10 }, S.turn); broadcastState(); });
    await H.page.waitForFunction(() => !S.shots.length && S.phase !== 'flight', null, { timeout: 60000 }).catch(() => {});
    await G.page.waitForTimeout(4000);
    const sum = '(()=>{let h=S.heights,a=0;for(let i=0;i<h.length;i+=7)a=(a*31+Math.round(h[i]*100))%1000000007;return a})()';
    const hs = await H.page.evaluate(sum), gs = await G.page.evaluate(sum);
    await H.ctx.close(); await G.ctx.close();
    return { ok: hs === gs && !H.errors.length && !G.errors.length, detail: `host ${hs} guest ${gs}` };
  },
};

(async () => {
  if (!fs.existsSync(target)) { console.error('no such build: ' + target); process.exit(2); }
  const { srv, url } = await serve(target);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  console.log(`Browser smoke suite against ${path.relative(process.cwd(), target) || target}`);
  let failed = 0, passed = 0, skipped = 0;
  for (const [name, fn] of Object.entries(tests)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const t0 = Date.now(); let r;
    try { r = await fn({ browser, url }); } catch (e) { r = { ok: false, detail: 'threw: ' + e.message }; }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (r.skip) { skipped++; console.log(`  SKIP ${name} - ${r.detail}`); continue; }
    if (r.ok) passed++; else failed++;
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${name} (${secs}s) - ${r.detail}`);
  }
  await browser.close(); srv.close();
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
})();
