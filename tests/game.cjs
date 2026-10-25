const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.slice(0,source.indexOf('for(let i=0;i<6;i++){let d=document.createElement'));
const elements=new Map();function element(){return {value:'',classList:{contains:()=>true,add(){},remove(){},toggle(){}},style:{},replaceChildren(){},appendChild(){},append(){},textContent:'',remove(){},setAttribute(){}}}
const document={body:element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll:()=>[]};
const context={console,THREE:require('three'),document,window:{},setTimeout,clearTimeout,performance,crypto:require('crypto').webcrypto,requestAnimationFrame(){}};
vm.createContext(context);vm.runInContext(source,context);
const test=`
let checks=0;function ok(value,message){if(!value)throw Error(message);checks++}
emit=()=>{};flash=()=>{};sound=()=>{};refreshWeapons=()=>{};updateUI=()=>{};showShop=()=>{};clearViews=()=>{};broadcastState=()=>{};notice=()=>{};laserLine=()=>{};
function setup(){seed=1729;S={cfg:{terrain:'Rolling Hills',wall:'Concrete',difficulty:'Cyborg',market:'fixed'},round:1,turn:0,heights:new Float32Array(481).fill(20),tanks:[0,1].map(id=>({id,name:'P'+id,x:40+id*100,y:20,hp:100,shield:0,mag:false,inv:Object.fromEntries(Object.keys(WEAPONS_CONFIG).map(n=>[n,10])),fuel:100,power:650,angle:id?135:45,az:0,vy:0,chuting:0,buried:0,cash:10000,score:0})),buildings:[],drones:[],shots:[],fires:[],phase:'aim',wind:0,wall:'Concrete',time:0,uid:0,prices:{},ready:[]};running=true;host=true;online=false;shotClock=0;return S.tanks[0]}
for(let[name,w]of Object.entries(WEAPONS_CONFIG)){let t=setup();let accepted=action({weaponOrItem:name,angle:35,power:500,az:0,targetX:140},0);ok(accepted,'Action rejected '+name);if(['blast','nuke','split','leap','funky','roller','digger','dirt','liquid','riot','napalm','laser','drone'].includes(w.kind)){for(let i=0;i<1600&&S.phase==='flight';i++)step(1/60);ok(S.phase!=='flight','Flight stuck '+name);ok(S.heights.every(Number.isFinite),'Invalid terrain '+name);ok(S.tanks.every(t=>Number.isFinite(t.hp)&&Number.isFinite(t.y)),'Invalid tank '+name)}else ok(S.phase==='aim','Equipment consumed turn '+name)}
setup();let t=current();t.hp=60;action({weaponOrItem:'Baby Missile',angle:45,power:1000});ok(t.power===600,'Health caps power');
setup();t=current();t.hp=35;action({weaponOrItem:'Battery',angle:45,power:600});ok(t.hp===80,'Battery restores health');
setup();t=current();t.shield=40;damage(t,55,1);ok(t.hp===85&&t.shield===0,'Shield absorbs damage');
setup();let before=S.heights[140];impact({name:'Dirt Ball',x:140,y:20,z:0,owner:0});ok(S.heights[140]>before,'Dirt adds terrain');
setup();impact({name:'Riot Bomb',x:140,y:20,z:0,owner:0});ok(S.heights[140]<20&&S.tanks[1].hp===100,'Riot clears without blast damage');
setup();impact({name:'Nuke',x:140,y:20,z:0,owner:0});ok(S.tanks[1].hp===0,'Nuke lethal direct impact');
setup();for(let boundary of ['Concrete','Rubber','Spring','Wrap-Around']){S.wall=boundary;let p={x:-2,z:0,vx:-10};let gone=wall(p);ok(boundary==='Concrete'?gone:!gone,'Wall mode '+boundary);if(boundary==='Spring')ok(p.vx===13,'Spring amplification');if(boundary==='Wrap-Around')ok(p.x>239,'Wrapping');}
setup();t=current();t.y=50;t.inv.Parachute=1;for(let i=0;i<400;i++)step(1/60);ok(t.hp===100&&t.inv.Parachute===0,'Parachute prevents fall damage');
setup();t=current();t.y=50;t.inv.Parachute=0;for(let i=0;i<180;i++)step(1/60);ok(t.hp<100,'Unprotected fall damages');
setup();let estimateResult=estimate(current(),S.tanks[1]);ok(estimateResult.error<5,'Heuristic hits within five meters');
setup();S.phase='shop';let cash=current().cash;ok(buy(0,'Missile'),'Shop purchase');ok(current().cash===cash-120,'Shop charges price');S.ready.push(0);ok(!buy(0,'Nuke'),'Ready player cannot shop');
setup();let initial=current().cash;S.tanks[1].hp=0;finishRound();ok(S.phase==='shop','Round ends');ok(current().cash===Math.floor((initial+1400)*1.05),'Winner award and compound interest');
setup();S.buildings.push({shape:'ciws',owner:1,x:100,y:20,charges:1,hp:55});ok(intercepted({owner:0,x:100,y:35,z:0}),'CIWS interception');ok(!intercepted({owner:0,x:100,y:35,z:0}),'CIWS single charge');
setup();ok(!action({weaponOrItem:'Nuke',angle:NaN,power:600}),'Invalid angles rejected');ok(!action({weaponOrItem:'Nuke',angle:45,power:600},1),'Out of turn rejected');
setup();camera=new THREE.PerspectiveCamera(47,16/9,.2,1200);camera.position.set(240,180,570);scene=new THREE.Scene();initTrails();
ok(W===480&&N===481&&D===80,'Expanded battlefield dimensions');
setCameraMode('focus');ok(viewMode==='focus'&&exploreX===current().x,'Focus targets current tank');
setCameraMode('explore');let oldX=exploreX;panExplore('d');ok(exploreX!==oldX,'Explore pans across map');
setCameraMode('gunner');ok(fp,'Gunner mode enabled');lastVisualRound=S.round;lastVisualPhase='aim';
S.phase='flight';spawnShot(current(),'Baby Missile',45,650);updateCamera(.016,current(),45,0,direction(45,0));ok(launchTimer>0,'3D firing starts launch camera');
for(let i=0;i<70;i++)updateCamera(1/60,current(),45,0,direction(45,0));ok(viewMode==='tactical'&&!fp&&launchTimer===0,'Launch returns to tactical view');
updateTrails(.016);ok(traces.size===1,'Projectile path tracked');S.shots[0].x+=20;S.shots[0].y+=15;updateTrails(.016);ok(trailGeo.drawRange.count>=2,'Visible trail geometry produced');
S.shots=[];for(let i=0;i<70;i++)updateTrails(1/60);ok(traces.size===0,'Trails expire without growth');
S.phase='aim';updateCamera(.016,current(),45,0,direction(45,0));ok(!document.getElementById('orbit').disabled,'Camera sliders unlock after flight');
initNature();updateNature();ok(trunks.count>0&&trunks.count<=180&&crowns.count===trunks.count,'Pooled trees populated');ok(water.position.y===12,'Water surface initialized');
for(let terrainType of ['Rolling Hills','Jagged Mountains','Valleys','Cliffs']){let map=newTerrain(terrainType);ok(map.length===481&&map.every(Number.isFinite),'Larger valid terrain '+terrainType);}
console.log(checks+' simulation checks passed across '+Object.keys(WEAPONS_CONFIG).length+' items.');
`;
vm.runInContext(test,context,{timeout:30000});

(async () => {
  const { createServer } = require('../scripts/serve.cjs');
  const { generateTotpCode } = require('../scripts/auth.cjs');

  let apiChecks = 0;
  function apiOk(cond, msg) {
    if (!cond) throw new Error('API test failed: ' + msg);
    apiChecks++;
  }

  const env = {
    NODE_ENV: 'test',
    SESSION_TTL_HOURS: '24',
    AUTH_RATE_LIMIT_MAX: '500'
  };

  const mockOAuthProfiles = {
    google: { sub: 'g-101', name: 'Google Commander', email: 'gcmd@example.com', picture: 'https://example.com/g.png' },
    discord: { id: 'd-202', username: 'discord_cmd', email: 'dcmd@example.com' },
    facebook: { id: 'f-303', name: 'FB Commander', email: 'fbcmd@example.com' },
    twitter: { data: { id: 't-404', username: 'x_cmd', name: 'X Commander' } }
  };

  const fetchStub = async (url) => {
    const u = String(url);
    if (u.includes('token')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'mock-access-token' })
      };
    }
    let payload = mockOAuthProfiles.google;
    if (u.includes('discord')) payload = mockOAuthProfiles.discord;
    else if (u.includes('facebook')) payload = mockOAuthProfiles.facebook;
    else if (u.includes('twitter')) payload = mockOAuthProfiles.twitter;
    return {
      ok: true,
      status: 200,
      json: async () => payload
    };
  };

  const server = createServer({ dbPath: ':memory:', env, fetchImpl: fetchStub });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  async function req(path, { method = 'GET', body, token, cookie } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual'
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { status: res.status, data, headers: res.headers };
  }

  try {
    // Static route check
    const homeRes = await fetch(`${base}/`);
    apiOk(homeRes.status === 200, 'GET / serves index.html');

    // 1. Register, duplicate checks, email verification gating, resend code, login/logout/me
    const reg1 = await req('/api/auth/register', {
      method: 'POST',
      body: { username: 'alpha', email: 'alpha@example.com', password: 'Password123!', displayName: 'Commander Alpha' }
    });
    apiOk(reg1.status === 201 && reg1.data.requiresEmailVerification && reg1.data.devVerificationCode, 'Register alpha succeeds and returns dev code');

    const dupUser = await req('/api/auth/register', {
      method: 'POST',
      body: { username: 'alpha', email: 'other@example.com', password: 'Password123!' }
    });
    apiOk(dupUser.status === 409, 'Duplicate username rejected');

    const dupEmail = await req('/api/auth/register', {
      method: 'POST',
      body: { username: 'alpha2', email: 'alpha@example.com', password: 'Password123!' }
    });
    apiOk(dupEmail.status === 409, 'Duplicate email rejected');

    const unverifiedLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'alpha', password: 'Password123!' }
    });
    apiOk(unverifiedLogin.status === 403 && unverifiedLogin.data.requiresEmailVerification, 'Unverified user cannot login');

    const badVerify = await req('/api/auth/verify-email', {
      method: 'POST',
      body: { username: 'alpha', code: '000000' }
    });
    apiOk(badVerify.status === 400, 'Wrong verification code rejected');

    const resend = await req('/api/auth/resend-code', {
      method: 'POST',
      body: { username: 'alpha' }
    });
    apiOk(resend.status === 200 && resend.data.devVerificationCode, 'Resend verification code works');

    const goodVerify = await req('/api/auth/verify-email', {
      method: 'POST',
      body: { username: 'alpha', code: resend.data.devVerificationCode }
    });
    apiOk(goodVerify.status === 200 && goodVerify.data.token && goodVerify.data.user.emailVerified, 'Valid email verification logs in');
    let alphaToken = goodVerify.data.token;
    const alphaId = goodVerify.data.user.id;

    const me1 = await req('/api/auth/me', { token: alphaToken });
    apiOk(me1.status === 200 && me1.data.authenticated && me1.data.user.username === 'alpha', 'GET /api/auth/me returns user');

    // 2. TOTP setup -> challenge -> accept / reject -> disable
    const totpSetup = await req('/api/auth/totp/setup', { method: 'POST', token: alphaToken });
    apiOk(totpSetup.status === 200 && totpSetup.data.secret && totpSetup.data.otpauthUri.startsWith('otpauth://totp/'), 'TOTP setup returns secret and URI');

    const badEnable = await req('/api/auth/totp/enable', {
      method: 'POST',
      token: alphaToken,
      body: { code: '000000' }
    });
    apiOk(badEnable.status === 400, 'Invalid TOTP code rejected on enable');

    const validTotp = generateTotpCode(totpSetup.data.secret);
    const goodEnable = await req('/api/auth/totp/enable', {
      method: 'POST',
      token: alphaToken,
      body: { code: validTotp }
    });
    apiOk(goodEnable.status === 200 && goodEnable.data.totpEnabled === true, 'Valid TOTP code enables 2FA');

    // Login without TOTP when enabled must fail with requiresTotp
    const loginNoTotp = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'alpha', password: 'Password123!' }
    });
    apiOk(loginNoTotp.status === 401 && loginNoTotp.data.requiresTotp, 'Login without TOTP challenged when 2FA enabled');

    const loginBadTotp = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'alpha', password: 'Password123!', totpCode: '000000' }
    });
    apiOk(loginBadTotp.status === 401 && loginBadTotp.data.requiresTotp, 'Login with wrong TOTP rejected');

    const loginGoodTotp = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'alpha', password: 'Password123!', totpCode: generateTotpCode(totpSetup.data.secret) }
    });
    apiOk(loginGoodTotp.status === 200 && loginGoodTotp.data.token, 'Login with valid TOTP succeeds');
    alphaToken = loginGoodTotp.data.token;

    const disableTotp = await req('/api/auth/totp/disable', {
      method: 'POST',
      token: alphaToken,
      body: { code: generateTotpCode(totpSetup.data.secret) }
    });
    apiOk(disableTotp.status === 200 && disableTotp.data.totpEnabled === false, 'TOTP disable succeeds with valid code');

    // 3. OAuth providers list + start/callback in unconfigured and configured modes for all 4 providers
    const provList1 = await req('/api/auth/oauth/providers');
    apiOk(provList1.status === 200 && provList1.data.providers.length === 4, 'OAuth providers lists all 4 providers');
    apiOk(provList1.data.providers.every(p => p.configured === false), 'All 4 providers unconfigured by default');

    for (const p of ['google', 'discord', 'facebook', 'twitter']) {
      const uncfgStart = await req(`/api/auth/oauth/${p}/start`);
      apiOk(uncfgStart.status === 503 && Array.isArray(uncfgStart.data.requiredEnv) && uncfgStart.data.requiredEnv.length === 3, `Unconfigured ${p} start returns 503 with requiredEnv`);
      const uncfgCb = await req(`/api/auth/oauth/${p}/callback?code=abc&state=xyz`);
      apiOk(uncfgCb.status === 503, `Unconfigured ${p} callback returns 503`);
    }

    // Configure all 4 providers in env and test start + callback
    for (const p of ['GOOGLE', 'DISCORD', 'FACEBOOK', 'TWITTER']) {
      env[`OAUTH_${p}_CLIENT_ID`] = `${p.toLowerCase()}-id`;
      env[`OAUTH_${p}_CLIENT_SECRET`] = `${p.toLowerCase()}-secret`;
      env[`OAUTH_${p}_REDIRECT_URI`] = `http://127.0.0.1:${port}/api/auth/oauth/${p.toLowerCase()}/callback`;
    }

    const provList2 = await req('/api/auth/oauth/providers');
    apiOk(provList2.data.providers.every(p => p.configured === true), 'All 4 providers report configured when env vars set');

    for (const p of ['google', 'discord', 'facebook', 'twitter']) {
      const startRes = await req(`/api/auth/oauth/${p}/start`);
      apiOk(startRes.status === 200 && startRes.data.state && startRes.data.authorizeUrl, `Configured ${p} start returns state and authorizeUrl`);
      const cbRes = await req(`/api/auth/oauth/${p}/callback?code=testcode&state=${encodeURIComponent(startRes.data.state)}`);
      apiOk(cbRes.status === 200 && cbRes.data.token && cbRes.data.user.emailVerified, `Configured ${p} callback provisions/signs in user`);
    }

    // 4. Profile update & custom fields boundary validation (max 2 fields, name <= 80, value <= 175)
    const profGood = await req('/api/profile', {
      method: 'PUT',
      token: alphaToken,
      body: {
        displayName: 'Alpha Prime',
        avatar: 'https://example.com/alpha.png',
        bio: 'Veteran artillery commander.',
        customFields: [
          { name: 'A'.repeat(80), value: 'B'.repeat(175) },
          { name: 'Favorite Map', value: 'Jagged Mountains' }
        ]
      }
    });
    apiOk(profGood.status === 200 && profGood.data.profile.customFields.length === 2, 'Profile update accepts boundary-length 80/175 custom fields');

    const profTooMany = await req('/api/profile', {
      method: 'PUT',
      token: alphaToken,
      body: {
        customFields: [
          { name: 'F1', value: 'V1' },
          { name: 'F2', value: 'V2' },
          { name: 'F3', value: 'V3' }
        ]
      }
    });
    apiOk(profTooMany.status === 400, 'More than 2 custom fields rejected with 400');

    const profLongName = await req('/api/profile', {
      method: 'PUT',
      token: alphaToken,
      body: {
        customFields: [{ name: 'N'.repeat(81), value: 'ok' }]
      }
    });
    apiOk(profLongName.status === 400, 'Custom field name > 80 chars rejected with 400');

    const profLongVal = await req('/api/profile', {
      method: 'PUT',
      token: alphaToken,
      body: {
        customFields: [{ name: 'ok', value: 'V'.repeat(176) }]
      }
    });
    apiOk(profLongVal.status === 400, 'Custom field value > 175 chars rejected with 400');

    const getProf = await req('/api/profile/alpha');
    apiOk(getProf.status === 200 && getProf.data.profile.displayName === 'Alpha Prime', 'GET /api/profile/:username returns public profile');

    // Register second human player Bravo for multiplayer attestation tests
    const regBravo = await req('/api/auth/register', {
      method: 'POST',
      body: { username: 'bravo', email: 'bravo@example.com', password: 'Password123!', displayName: 'Commander Bravo' }
    });
    const verBravo = await req('/api/auth/verify-email', {
      method: 'POST',
      body: { username: 'bravo', code: regBravo.data.devVerificationCode }
    });
    const bravoToken = verBravo.data.token;
    const bravoId = verBravo.data.user.id;

    // 5. Tamper-proof match attestation matrix
    // 5a. Fake match ID
    const fakeMatchRes = await req('/api/matches/non-existent-id/attest', {
      method: 'POST',
      token: alphaToken,
      body: { nonce: 'abc' }
    });
    apiOk(fakeMatchRes.status === 404, 'Attesting fake match ID rejected with 404');

    // 5b. Un-attested solo submit in a 2-human match does not finalize or award win
    const startSoloTest = await req('/api/matches/start', {
      method: 'POST',
      token: alphaToken,
      body: {
        roomCode: 'CHARRED-TEST01',
        mode: 'online',
        round: 1,
        participants: [
          { slot: 0, userId: alphaId, name: 'Alpha Prime', ai: false },
          { slot: 1, userId: bravoId, name: 'Commander Bravo', ai: false }
        ]
      }
    });
    apiOk(startSoloTest.status === 201 && startSoloTest.data.nonce, 'Match ticket issued');

    const validActionLog = [
      { actor: 0, action: 'fire', weaponOrItem: 'Nuke', angle: 45, power: 650, az: 0 }
    ];
    const alphaWinsOutcomes = [
      { slot: 0, kills: 1, finalHp: 85 },
      { slot: 1, kills: 0, finalHp: 0 }
    ];

    const soloSubmit = await req(`/api/matches/${startSoloTest.data.matchId}/attest`, {
      method: 'POST',
      token: alphaToken,
      body: {
        nonce: startSoloTest.data.nonce,
        winnerSlot: 0,
        durationMs: 12000,
        actionLog: validActionLog,
        outcomes: alphaWinsOutcomes
      }
    });
    apiOk(soloSubmit.status === 202 && soloSubmit.data.status === 'pending_co_attestation', 'Single human attestation in 2-player match stays pending');

    const lbBeforeCoAttest = await req('/api/leaderboard');
    const alphaBefore = lbBeforeCoAttest.data.leaderboard.find(e => e.username === 'alpha');
    apiOk(alphaBefore.wins === 0, 'Un-attested solo submit does not increment leaderboard wins');

    // 5c. Mismatched winner / conflicting attestation from Bravo rejects the match
    const conflictingSubmit = await req(`/api/matches/${startSoloTest.data.matchId}/attest`, {
      method: 'POST',
      token: bravoToken,
      body: {
        nonce: startSoloTest.data.nonce,
        winnerSlot: 1,
        durationMs: 12000,
        actionLog: validActionLog,
        outcomes: [
          { slot: 0, kills: 0, finalHp: 0 },
          { slot: 1, kills: 1, finalHp: 90 }
        ]
      }
    });
    apiOk(conflictingSubmit.status === 409 && conflictingSubmit.data.status === 'rejected', 'Conflicting winner attestation rejects match');

    // 5d. Impossible action log (unknown weapon / NaN angle / impossible kills) rejected
    const startImpossible = await req('/api/matches/start', {
      method: 'POST',
      token: alphaToken,
      body: {
        roomCode: 'CHARRED-TEST02',
        mode: 'online',
        round: 1,
        participants: [
          { slot: 0, userId: alphaId, name: 'Alpha Prime', ai: false },
          { slot: 1, userId: bravoId, name: 'Commander Bravo', ai: false }
        ]
      }
    });
    const badLogRes = await req(`/api/matches/${startImpossible.data.matchId}/attest`, {
      method: 'POST',
      token: alphaToken,
      body: {
        nonce: startImpossible.data.nonce,
        winnerSlot: 0,
        durationMs: 10000,
        actionLog: [{ actor: 0, action: 'fire', weaponOrItem: 'Orbital Death Ray', angle: 45, power: 500, az: 0 }],
        outcomes: alphaWinsOutcomes
      }
    });
    apiOk(badLogRes.status === 400 && badLogRes.data.status === 'rejected', 'Impossible weapon in action log rejected');

    // 5e. Valid co-attested happy path + nonce replay rejection
    const startHappy = await req('/api/matches/start', {
      method: 'POST',
      token: alphaToken,
      body: {
        roomCode: 'CHARRED-HAPPY1',
        mode: 'online',
        round: 1,
        participants: [
          { slot: 0, userId: alphaId, name: 'Alpha Prime', ai: false },
          { slot: 1, userId: bravoId, name: 'Commander Bravo', ai: false }
        ]
      }
    });
    const attestA = await req(`/api/matches/${startHappy.data.matchId}/attest`, {
      method: 'POST',
      token: alphaToken,
      body: {
        nonce: startHappy.data.nonce,
        winnerSlot: 0,
        durationMs: 15000,
        actionLog: validActionLog,
        outcomes: alphaWinsOutcomes
      }
    });
    apiOk(attestA.status === 202, 'First participant attestation accepted as pending');

    const attestB = await req(`/api/matches/${startHappy.data.matchId}/attest`, {
      method: 'POST',
      token: bravoToken,
      body: {
        nonce: startHappy.data.nonce,
        winnerSlot: 0,
        durationMs: 15200,
        actionLog: validActionLog,
        outcomes: alphaWinsOutcomes
      }
    });
    apiOk(attestB.status === 200 && attestB.data.status === 'verified' && attestB.data.leaderboardUpdated === true, 'Co-attested match finalized and verified');

    // Nonce replay on finalized match
    const replayRes = await req(`/api/matches/${startHappy.data.matchId}/attest`, {
      method: 'POST',
      token: alphaToken,
      body: {
        nonce: startHappy.data.nonce,
        winnerSlot: 0,
        durationMs: 15000,
        actionLog: validActionLog,
        outcomes: alphaWinsOutcomes
      }
    });
    apiOk(replayRes.status === 409, 'Nonce replay on finalized match rejected with 409');

    // 5f. Single-human vs AI bot match records as bot_match and does not increment leaderboard wins
    const startBotMatch = await req('/api/matches/start', {
      method: 'POST',
      token: bravoToken,
      body: {
        roomCode: 'local',
        mode: 'local',
        round: 1,
        participants: [
          { slot: 0, userId: bravoId, name: 'Commander Bravo', ai: false },
          { slot: 1, userId: null, name: 'Cyborg', ai: true }
        ]
      }
    });
    const attestBot = await req(`/api/matches/${startBotMatch.data.matchId}/attest`, {
      method: 'POST',
      token: bravoToken,
      body: {
        nonce: startBotMatch.data.nonce,
        winnerSlot: 0,
        durationMs: 9000,
        actionLog: validActionLog,
        outcomes: alphaWinsOutcomes
      }
    });
    apiOk(attestBot.status === 200 && attestBot.data.status === 'bot_match' && attestBot.data.leaderboardUpdated === false, 'AI bot match recorded as bot_match without leaderboard increment');

    // 6. Public unauthenticated GET /api/leaderboard ordering
    const lbRes = await req('/api/leaderboard');
    apiOk(lbRes.status === 200 && Array.isArray(lbRes.data.leaderboard), 'Unauthenticated GET /api/leaderboard succeeds');
    const top = lbRes.data.leaderboard[0];
    const bravoEntry = lbRes.data.leaderboard.find(e => e.username === 'bravo');
    apiOk(top.username === 'alpha' && top.wins === 1 && top.kills === 1 && top.rank === 1, 'Leaderboard ranks Alpha #1 with 1 verified win');
    apiOk(bravoEntry && bravoEntry.wins === 0 && bravoEntry.losses === 1, 'Bravo has 0 multiplayer wins (bot match excluded from leaderboard wins)');

    // Logout check
    const logoutRes = await req('/api/auth/logout', { method: 'POST', token: alphaToken });
    apiOk(logoutRes.status === 200, 'Logout succeeds');
    const meAfterLogout = await req('/api/auth/me', { token: alphaToken });
    apiOk(meAfterLogout.status === 401, 'Session invalid after logout');

    console.log(`${apiChecks} API & account checks passed (154 simulation + ${apiChecks} API = ${154 + apiChecks} total checks).`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

