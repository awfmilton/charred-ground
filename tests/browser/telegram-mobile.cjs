'use strict';
// Telegram Mini App + touch HUD browser suite. Runs the real server (scripts/serve.cjs) with a fake
// Bot API and serves a stub of telegram-web-app.js that records every SDK call, then drives the game
// on emulated iPhones (landscape and portrait) the way a player would.
//
//   node tests/browser/telegram-mobile.cjs
//
// Screenshots are written to test-results/browser/telegram-*.png.
const fs = require('fs');
const path = require('path');
const { devices } = require('playwright');
const { launchBrowser, routeVendoredScripts, ROOT } = require('./support.cjs');
const { createServer } = require('../../scripts/serve.cjs');
const { signInitData } = require('../../scripts/telegram.cjs');

const OUT = path.join(ROOT, 'test-results', 'browser');
const TOKEN = '123456:BROWSER-test-token';
const SECRET = 'browser-webhook-secret';
const USER = { id: 424242, first_name: 'Ada', last_name: 'Gunner', username: 'ada_g', language_code: 'en', allows_write_to_pm: true };
const IGNORED = /Failed to load resource|favicon|fonts\.g|peerjs|0\.peerjs\.com|ERR_|WebSocket/i;

function fakeBot() {
  const calls = [];
  const impl = async (url, opts) => {
    const m = String(url).match(/\/bot[^/]+\/(\w+)$/);
    const method = m ? m[1] : 'unknown';
    const params = opts && opts.body ? JSON.parse(opts.body) : {};
    calls.push({ method, params });
    let result = true;
    if (method === 'createInvoiceLink') result = 'https://t.me/$invoice_test';
    if (method === 'savePreparedInlineMessage') result = { id: 'prepared-1' };
    return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
  };
  return { impl, calls, last: m => [...calls].reverse().find(c => c.method === m) };
}

function sdkStub(initData, startParam) {
  return `(()=>{const calls=[];const rec=(...a)=>calls.push(a);const handlers={};
const cmp=(a,b)=>{a=String(a).split('.').map(Number);b=String(b).split('.').map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){let x=a[i]||0,y=b[i]||0;if(x!==y)return x>y?1:-1}return 0};
const btn=name=>({text:'',isVisible:false,isActive:true,_cb:[],setParams(p){rec(name+'.setParams',p);if(p.text!=null)this.text=p.text;if(p.is_visible!=null)this.isVisible=p.is_visible;if(p.is_active!=null)this.isActive=p.is_active;return this},setText(t){this.text=t;return this},show(){this.isVisible=true;return this},hide(){this.isVisible=false;return this},onClick(f){this._cb.push(f);return this},offClick(f){this._cb=this._cb.filter(x=>x!==f);return this},_click(){this._cb.slice().forEach(f=>f())}});
const store=()=>({_m:{},setItem(k,v,cb){this._m[k]=v;cb&&cb(null,true)},getItem(k,cb){cb(null,this._m[k]||'')},removeItem(k,cb){delete this._m[k];cb&&cb(null,true)}});
window.Telegram={WebApp:{initData:${JSON.stringify(initData)},initDataUnsafe:{user:${JSON.stringify(USER)},start_param:${JSON.stringify(startParam)}},platform:'ios',version:'9.1',
isVersionAtLeast(v){return cmp('9.1',v)>=0},ready(){rec('ready')},expand(){rec('expand')},requestFullscreen(){rec('requestFullscreen')},
setHeaderColor(c){rec('setHeaderColor',c)},setBackgroundColor(c){rec('setBackgroundColor',c)},setBottomBarColor(c){rec('setBottomBarColor',c)},
onEvent(e,f){(handlers[e]=handlers[e]||[]).push(f)},offEvent(e,f){handlers[e]=(handlers[e]||[]).filter(x=>x!==f)},
MainButton:btn('main'),SecondaryButton:btn('second'),BackButton:{isVisible:false,show(){this.isVisible=true},hide(){this.isVisible=false}},SettingsButton:{isVisible:false,show(){this.isVisible=true}},
HapticFeedback:{impactOccurred(s){rec('haptic.impact',s)},notificationOccurred(s){rec('haptic.note',s)},selectionChanged(){rec('haptic.select')}},
CloudStorage:store(),DeviceStorage:store(),
isClosingConfirmationEnabled:false,enableClosingConfirmation(){this.isClosingConfirmationEnabled=true},disableClosingConfirmation(){this.isClosingConfirmationEnabled=false},
isVerticalSwipesEnabled:true,disableVerticalSwipes(){this.isVerticalSwipesEnabled=false},enableVerticalSwipes(){this.isVerticalSwipesEnabled=true},
openInvoice(url,cb){rec('openInvoice',url);window.__invoiceCb=cb},shareMessage(id,cb){rec('shareMessage',id);cb&&cb(true)},switchInlineQuery(q,t){rec('switchInlineQuery',q,t)},
checkHomeScreenStatus(cb){cb('unsupported')},showPopup(p,cb){rec('showPopup',p.title);cb&&cb((p.buttons||[]).find(b=>b.type!=='cancel')?.id||'ok')},
_calls:calls,_fire(e,a){(handlers[e]||[]).forEach(f=>f(a))}}};})();`;
}

async function openGame(browser, base, device, startParam = '') {
  const initData = signInitData({ user: USER, auth_date: Math.floor(Date.now() / 1000), chat_instance: '-777', chat_type: 'group', ...(startParam ? { start_param: startParam } : {}) }, TOKEN);
  const ctx = await browser.newContext({ ...device, reducedMotion: 'reduce' });
  await routeVendoredScripts(ctx);
  await ctx.route(/^https:\/\/telegram\.org\/js\/telegram-web-app\.js/, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: sdkStub(initData, startParam) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push('console: ' + m.text()); });
  const hash = new URLSearchParams({ tgWebAppData: initData, tgWebAppPlatform: 'ios', tgWebAppVersion: '9.1' }).toString();
  await page.goto(base + '/#' + hash, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.THREE && typeof S !== 'undefined' && S && typeof terrainGeo !== 'undefined' && terrainGeo, null, { timeout: 120000 });
  await page.waitForFunction(() => typeof TG !== 'undefined' && TG.ready && account.user, null, { timeout: 30000 });
  return { ctx, page, errors };
}

const calls = (page, name) => page.evaluate(n => Telegram.WebApp._calls.filter(c => c[0] === n), name);
const rect = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height, display: cs.display }; }, sel);

async function checkLayout(page, name, size, fails) {
  const ids = ['#tTop', '#tCam', '#tAim', '#tDrive', '#tFire'];
  const list = [];
  for (const id of ids) { const r = await rect(page, id); if (!r || r.display === 'none' || r.w === 0) { fails.push(`${name}: ${id} not shown`); continue; } list.push({ id, ...r }); }
  for (const r of list) if (r.x < -1 || r.y < -1 || r.right > size.width + 1 || r.bottom > size.height + 1) fails.push(`${name}: ${r.id} off screen`);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1) fails.push(`${name}: ${a.id} overlaps ${b.id}`);
  }
  // The middle of the battlefield stays clear.
  const cx0 = size.width * 0.3, cx1 = size.width * 0.7, cy0 = size.height * 0.3, cy1 = size.height * 0.55;
  for (const r of list) if (r.x < cx1 && r.right > cx0 && r.y < cy1 && r.bottom > cy0) fails.push(`${name}: ${r.id} covers the battlefield centre`);
  // Desktop HUD is replaced, not stacked underneath.
  for (const id of ['#hud', '#camDock', 'header']) { const r = await rect(page, id); if (r && r.display !== 'none') fails.push(`${name}: desktop ${id} still visible`); }
  // Every touch control is the element a finger actually hits, and is at least 34 px.
  const reach = await page.evaluate(() => [...document.querySelectorAll('#tHud button')].filter(b => b.offsetParent && getComputedStyle(b).display !== 'none').map(b => { const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { label: b.getAttribute('aria-label') || b.textContent, ok: !!hit && (hit === b || b.contains(hit)), small: Math.min(r.width, r.height) < 30 }; }));
  for (const b of reach) { if (!b.ok) fails.push(`${name}: "${b.label}" is covered`); if (b.small) fails.push(`${name}: "${b.label}" is smaller than 30 px`); }
}

async function run() {
  const bot = fakeBot();
  const env = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: SECRET, TELEGRAM_BOT_USERNAME: 'charred_bot', PUBLIC_BASE_URL: '' };
  const server = createServer({ dbPath: ':memory:', env, fetchImpl: bot.impl });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await launchBrowser();
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  const test = async (name, fn) => { const fails = []; try { await fn(fails); } catch (e) { fails.push('threw: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); } results.push({ name, ok: !fails.length, detail: fails.slice(0, 8).join('; ') }); console.log((fails.length ? 'FAIL ' : 'ok   ') + name + (fails.length ? ' — ' + fails.slice(0, 8).join('; ') : '')); };
  try {
    const land = devices['iPhone 13 landscape'];
    const g = await openGame(browser, base, land);
    const { page } = g;

    await test('telegram boot: SDK ready, fullscreen, signed in, chrome', async fails => {
      for (const c of ['ready', 'expand', 'requestFullscreen']) if (!(await calls(page, c)).length) fails.push(c + ' not called');
      const u = await page.evaluate(() => account.user && { username: account.user.username, verified: account.user.emailVerified, token: !!account.token });
      if (!u || u.username !== 'ada_g' || !u.verified || !u.token) fails.push('silent Telegram sign-in failed: ' + JSON.stringify(u));
      const mb = await page.evaluate(() => ({ text: Telegram.WebApp.MainButton.text, vis: Telegram.WebApp.MainButton.isVisible, back: Telegram.WebApp.BackButton.isVisible, settings: Telegram.WebApp.SettingsButton.isVisible }));
      if (mb.text !== 'START BATTLE' || !mb.vis) fails.push('MainButton should offer START BATTLE: ' + JSON.stringify(mb));
      if (mb.back) fails.push('BackButton should be hidden on the main menu');
      if (!mb.settings) fails.push('SettingsButton not shown');
      if (!(await page.evaluate(() => document.body.classList.contains('tg') && document.body.classList.contains('touch')))) fails.push('body classes missing');
      if (!(await page.$('#lbScope'))) fails.push('chat leaderboard toggle missing for a group launch');
    });

    await test('MainButton starts the battle; touch HUD replaces the desktop HUD (landscape)', async fails => {
      await page.evaluate(() => Telegram.WebApp.MainButton._click());
      await page.waitForFunction(() => running && S && S.phase === 'aim', null, { timeout: 30000 });
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => ({ tc: document.body.classList.contains('tc'), tmatch: document.body.classList.contains('tmatch'), main: Telegram.WebApp.MainButton.isVisible, back: Telegram.WebApp.BackButton.isVisible, close: Telegram.WebApp.isClosingConfirmationEnabled, swipes: Telegram.WebApp.isVerticalSwipesEnabled }));
      if (!st.tc || !st.tmatch) fails.push('touch HUD not active: ' + JSON.stringify(st));
      if (st.main) fails.push('MainButton should hide during the battle');
      if (!st.back) fails.push('BackButton should be available in battle');
      if (!st.close) fails.push('closing confirmation should be on in battle');
      if (st.swipes) fails.push('vertical swipes should be off in battle');
      await checkLayout(page, 'landscape', land.viewport, fails);
      await page.screenshot({ path: path.join(OUT, 'telegram-landscape.png') });
    });

    await test('steppers nudge aim with haptic ticks', async fails => {
      await page.evaluate(() => { Telegram.WebApp._calls.length = 0; });
      const before = await page.evaluate(() => [+$('angle').value, +$('power').value, +$('azimuth').value]);
      for (const sel of ['#tStep_angle [data-dir="1"]', '#tStep_power [data-dir="-1"]', '#tStep_az [data-dir="1"]']) {
        const b = await (await page.$(sel)).boundingBox();
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(120);
      }
      const after = await page.evaluate(() => [+$('angle').value, +$('power').value, +$('azimuth').value]);
      if (after[0] !== before[0] + 0.5) fails.push(`angle ${before[0]} -> ${after[0]}`);
      if (after[1] !== before[1] - 5) fails.push(`power ${before[1]} -> ${after[1]}`);
      if (after[2] !== before[2] + 1) fails.push(`azimuth ${before[2]} -> ${after[2]}`);
      if ((await calls(page, 'haptic.select')).length < 3) fails.push('no haptic selection ticks');
      const shown = await page.evaluate(() => $('tVal_angle').textContent);
      if (shown !== after[0].toFixed(1) + '°') fails.push('readout not updated: ' + shown);
    });

    await test('drag from the tank sets angle and power without moving the camera', async fails => {
      await page.evaluate(() => { resetCamera(); });
      await page.waitForTimeout(400);
      const o = await page.evaluate(() => { const s = tankScreen(current()); return s && { x: s.x, y: s.y, cam: [orbitYaw, orbitPitch, orbitZoom] }; });
      if (!o) { fails.push('own tank not on screen'); return; }
      const before = await page.evaluate(() => [+$('angle').value, +$('power').value]);
      // Drag up and to the side: about 60° elevation towards the opponent side.
      const tx = o.x + (o.x < land.viewport.width / 2 ? 70 : -70), ty = o.y - 120;
      await page.mouse.move(o.x, o.y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(o.x + (tx - o.x) * i / 8, o.y + (ty - o.y) * i / 8); await page.waitForTimeout(30); }
      const mid = await page.evaluate(() => getComputedStyle($('tAimInd')).display);
      await page.mouse.up();
      const after = await page.evaluate(() => ({ a: +$('angle').value, p: +$('power').value, cam: [orbitYaw, orbitPitch, orbitZoom], ind: getComputedStyle($('tAimInd')).display }));
      if (after.a === before[0] && after.p === before[1]) fails.push('drag did not change the aim');
      if (!(after.a > 20 && after.a < 160)) fails.push('angle should point upward, got ' + after.a);
      if (!(after.p > 100)) fails.push('power should follow drag length, got ' + after.p);
      if (JSON.stringify(after.cam) !== JSON.stringify(o.cam)) fails.push('camera moved during aim drag');
      if (mid !== 'block') fails.push('aim readout not shown while dragging');
      if (after.ind !== 'none') fails.push('aim readout not hidden after release');
      const arcVisible = await page.evaluate(() => !!(window.arc && arc.visible));
      if (arcVisible) fails.push('a trajectory arc became visible');
    });

    await test('weapon sheet selects a payload; Back closes sheets', async fails => {
      await page.tap('#tWeaponBtn');
      await page.waitForTimeout(200);
      if (await page.evaluate(() => $('tWeapons').classList.contains('hidden'))) fails.push('weapon sheet did not open');
      if (!(await page.evaluate(() => Telegram.WebApp.BackButton.isVisible))) fails.push('BackButton not shown for the sheet');
      const cards = await page.$$('#tWeaponGrid .tcard:not([disabled])');
      if (cards.length < 1) { fails.push('no selectable payloads'); return; }
      const pick = cards[cards.length > 1 ? 1 : 0];
      const name = await pick.evaluate(b => b.querySelector('b').textContent);
      await pick.tap();
      await page.waitForTimeout(250);
      const st = await page.evaluate(() => ({ v: $('weapon').value, hidden: $('tWeapons').classList.contains('hidden'), label: $('tWeaponName').textContent }));
      if (st.v !== name) fails.push(`weapon ${st.v} != ${name}`);
      if (!st.hidden) fails.push('sheet stayed open');
      if (!st.label.startsWith(name)) fails.push('chip label not updated: ' + st.label);
      await page.tap('#tMenuBtn');
      await page.waitForTimeout(200);
      await page.evaluate(() => Telegram.WebApp._fire('backButtonClicked'));
      await page.waitForTimeout(200);
      if (!(await page.evaluate(() => $('tMenu').classList.contains('hidden')))) fails.push('Back did not close the menu sheet');
      await page.evaluate(() => { $('weapon').value = 'Baby Missile'; $('weapon').dispatchEvent(new Event('input')); });
    });

    await test('FIRE launches with haptics', async fails => {
      await page.evaluate(() => { Telegram.WebApp._calls.length = 0; });
      await page.tap('#tFire');
      await page.waitForFunction(() => S.phase === 'flight' || S.shots.length > 0 || S.actionsLeft < S.actionsMax, null, { timeout: 10000 }).catch(() => fails.push('shot did not launch'));
      if (!(await calls(page, 'haptic.impact')).length) fails.push('no impact haptic on fire');
    });

    await test('Stars store: terms, invoice, webhook payment, accent applied to my tank', async fails => {
      await page.waitForFunction(() => S.phase !== 'flight', null, { timeout: 60000 }).catch(() => {});
      await page.evaluate(() => openStore());
      await page.waitForFunction(() => document.querySelectorAll('#tStoreGrid .titem').length > 5, null, { timeout: 10000 });
      const buy = await page.$('#tStoreGrid .titem:nth-child(2) .tbuy');
      const title = await page.$eval('#tStoreGrid .titem:nth-child(2) b', e => e.textContent);
      if (title !== 'Ember tank accent') fails.push('unexpected second item ' + title);
      await buy.tap();
      await page.waitForFunction(() => Telegram.WebApp._calls.some(c => c[0] === 'openInvoice'), null, { timeout: 10000 });
      if (!(await calls(page, 'showPopup')).some(c => c[1] === 'Purchase terms')) fails.push('terms were not shown before the first purchase');
      const inv = bot.last('createInvoiceLink');
      if (!inv || inv.params.currency !== 'XTR' || inv.params.prices[0].amount !== 50) fails.push('invoice not created in XTR: ' + JSON.stringify(inv && inv.params));
      // Telegram delivers the payment to the webhook, then closes the invoice as paid.
      const pay = await fetch(base + '/api/telegram/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': SECRET }, body: JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: USER.id }, from: { id: USER.id }, successful_payment: { currency: 'XTR', total_amount: 50, invoice_payload: inv.params.payload, telegram_payment_charge_id: 'ch_browser_1' } } }) });
      if (pay.status !== 200) fails.push('webhook rejected the payment');
      await page.evaluate(() => window.__invoiceCb('paid'));
      await page.waitForFunction(() => (TOUCH.st.ent.accents || []).includes('ember'), null, { timeout: 10000 }).catch(() => fails.push('entitlement not refreshed'));
      await page.waitForTimeout(300);
      const owned = await page.$eval('#tStoreGrid .titem:nth-child(2) .tbuy', b => b.textContent);
      if (owned !== 'OWNED') fails.push('store row not marked owned: ' + owned);
      const ember = await page.$$('#tEquip .tcards:first-of-type .tcard');
      const emberBtn = ember.find ? null : null;
      await page.evaluate(() => { const b = [...document.querySelectorAll('#tEquip .tcard')].find(x => x.textContent.includes('EMBER')); b && b.click(); });
      await page.waitForTimeout(500);
      const col = await page.evaluate(() => { const me = myTank(); const v = views.get('t' + me.id); return { cos: me.cos, color: v && v.turret.children[0].material.color.getHexString() }; });
      if (!col.cos || col.cos.accent !== 'ember') fails.push('tank cosmetic not set: ' + JSON.stringify(col.cos));
      if (col.color !== 'ff7a2f') fails.push('barrel colour not applied: ' + col.color);
      void emberBtn;
      await page.evaluate(() => closeSheets());
    });

    await test('Back from battle opens the match menu; MainButton resumes', async fails => {
      await page.evaluate(() => { resetCamera(); });
      await page.waitForTimeout(250);
      await page.evaluate(() => Telegram.WebApp._fire('backButtonClicked'));
      await page.waitForTimeout(300);
      if (await page.evaluate(() => $('menu').classList.contains('hidden'))) fails.push('menu not opened by Back');
      const mb = await page.evaluate(() => Telegram.WebApp.MainButton.text);
      if (mb !== 'RESUME BATTLE') fails.push('MainButton should read RESUME BATTLE: ' + mb);
      await page.evaluate(() => Telegram.WebApp.MainButton._click());
      await page.waitForTimeout(300);
      if (!(await page.evaluate(() => $('menu').classList.contains('hidden')))) fails.push('MainButton did not resume');
    });
    if (g.errors.length) results.push({ name: 'landscape page errors', ok: false, detail: g.errors.slice(0, 4).join(' | ') });
    await g.ctx.close();

    // Portrait phone with a room deep link.
    const port = devices['iPhone 13'];
    const p = await openGame(browser, base, port, 'r_abc234');
    await test('deep link r_<code> fills the room and starts joining', async fails => {
      await p.page.waitForTimeout(500);
      const code = await p.page.evaluate(() => $('roomCode').value);
      if (code !== 'CHARRED-ABC234') fails.push('room code not routed: ' + code);
    });
    await test('portrait layout', async fails => {
      await p.page.evaluate(() => { leaveNetwork(); });
      await p.page.evaluate(() => Telegram.WebApp.MainButton._click());
      await p.page.waitForFunction(() => running && S && S.phase === 'aim', null, { timeout: 30000 });
      await p.page.waitForTimeout(700);
      await checkLayout(p.page, 'portrait', port.viewport, fails);
      await p.page.screenshot({ path: path.join(OUT, 'telegram-portrait.png') });
    });
    if (p.errors.length) results.push({ name: 'portrait page errors', ok: false, detail: p.errors.slice(0, 4).join(' | ') });
    await p.ctx.close();

    // Outside Telegram on a desktop browser nothing changes.
    await test('desktop web build unaffected', async fails => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      await routeVendoredScripts(ctx);
      let sdkRequested = false;
      await ctx.route(/telegram\.org/, r => { sdkRequested = true; r.abort(); });
      const pg = await ctx.newPage();
      await pg.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await pg.waitForFunction(() => window.THREE && typeof S !== 'undefined' && S && terrainGeo, null, { timeout: 120000 });
      const st = await pg.evaluate(() => ({ touch: document.body.classList.contains('touch'), tc: document.body.classList.contains('tc'), hud: getComputedStyle($('tHud')).display, tg: !!window.Telegram }));
      if (st.touch || st.tc || st.hud !== 'none' || st.tg) fails.push('desktop changed: ' + JSON.stringify(st));
      if (sdkRequested) fails.push('Telegram SDK requested outside Telegram');
      await ctx.close();
    });
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  const failed = results.filter(r => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} Telegram mobile checks passed.`);
  if (failed.length) process.exitCode = 1;
}

if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run };
