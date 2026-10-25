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

    // =========================================================================
    // Follow-up approved items (1)-(7) verification
    // =========================================================================

    // (1) Rate limiting behind a proxy + bounded map pruning
    {
      const { createApi } = require('../scripts/api.cjs');
      const { openStore } = require('../scripts/db.cjs');
      const rlStore = openStore({ file: ':memory:' });
      const rlEnv = {
        NODE_ENV: 'test',
        AUTH_RATE_LIMIT_MAX: '2',
        AUTH_RATE_LIMIT_WINDOW_MS: '40'
      };
      const rlApi = createApi({ store: rlStore, env: rlEnv });

      async function callAuth(xff, remoteAddress = '10.0.0.1') {
        let status = 0;
        const fakeReq = {
          url: '/api/auth/login',
          method: 'POST',
          headers: xff ? { 'x-forwarded-for': xff, host: '127.0.0.1:8187' } : { host: '127.0.0.1:8187' },
          socket: { remoteAddress },
          on(ev, cb) {
            if (ev === 'end') cb();
          }
        };
        const fakeRes = {
          writeHead(s) { status = s; },
          end() {}
        };
        await rlApi(fakeReq, fakeRes);
        return status;
      }

      // TRUST_PROXY unset: spoofed X-Forwarded-For headers share the socket IP bucket
      const s1 = await callAuth('203.0.113.1');
      const s2 = await callAuth('203.0.113.2');
      const s3 = await callAuth('203.0.113.3');
      apiOk(s1 === 401 && s2 === 401 && s3 === 429, 'Without TRUST_PROXY, X-Forwarded-For is ignored and socket IP shares rate-limit bucket');

      // Wait for window expiry, then enable TRUST_PROXY=1
      await new Promise(r => setTimeout(r, 60));
      rlEnv.TRUST_PROXY = '1';
      const p1 = await callAuth('198.51.100.10, 10.0.0.1');
      const p2 = await callAuth('198.51.100.20, 10.0.0.1');
      const p3 = await callAuth('198.51.100.30, 10.0.0.1');
      apiOk(p1 === 401 && p2 === 401 && p3 === 401, 'With TRUST_PROXY=1, distinct X-Forwarded-For client IPs have independent buckets');
      const pRepeat1 = await callAuth('198.51.100.10');
      const pRepeat2 = await callAuth('198.51.100.10');
      apiOk(pRepeat1 === 401 && pRepeat2 === 429, 'With TRUST_PROXY=1, repeating a single forwarded IP hits 429 at the cap');
      apiOk(rlApi.rateLimitMapSize >= 3, 'Rate-limit map tracks active client IPs');

      // Wait for window expiry and trigger a check to prune expired entries
      await new Promise(r => setTimeout(r, 60));
      await callAuth('198.51.100.99');
      apiOk(rlApi.rateLimitMapSize === 1, 'Expired rate-limit entries are pruned on subsequent checks');
      rlStore.close();
    }

    // (2) Brute-force caps: email verification code invalidated after 5 wrong attempts; per-account TOTP limit
    {
      const regCap = await req('/api/auth/register', {
        method: 'POST',
        body: { username: 'capuser', email: 'capuser@example.com', password: 'Password123!' }
      });
      const originalCode = regCap.data.devVerificationCode;
      apiOk(regCap.status === 201 && originalCode, 'Register capuser for brute-force cap test');

      for (let i = 1; i <= 5; i++) {
        const wrong = await req('/api/auth/verify-email', {
          method: 'POST',
          body: { username: 'capuser', code: '000000' }
        });
        apiOk(wrong.status === 400, `Email verify wrong attempt ${i}/5 rejected with 400`);
        if (i === 5) {
          apiOk(wrong.data.code === 'email_verify_invalidated', '5th wrong email verification attempt returns email_verify_invalidated');
        }
      }

      // 6th attempt using the originally-valid code must fail because the code was invalidated
      const sixthWithValidCode = await req('/api/auth/verify-email', {
        method: 'POST',
        body: { username: 'capuser', code: originalCode }
      });
      apiOk(
        sixthWithValidCode.status === 400 && sixthWithValidCode.data.code === 'email_verify_invalidated',
        'Originally-issued verification code is rejected on 6th attempt after 5 wrong attempts'
      );

      // Requesting a new code resets the counter and allows verification
      const resent = await req('/api/auth/resend-code', {
        method: 'POST',
        body: { username: 'capuser' }
      });
      const verifiedAfterResend = await req('/api/auth/verify-email', {
        method: 'POST',
        body: { username: 'capuser', code: resent.data.devVerificationCode }
      });
      apiOk(verifiedAfterResend.status === 200 && verifiedAfterResend.data.user.emailVerified, 'Resending code after invalidation allows verification');
      const capToken = verifiedAfterResend.data.token;

      // Setup and enable TOTP on capuser, then test per-account TOTP brute-force limit across distinct IPs
      const setupCapTotp = await req('/api/auth/totp/setup', { method: 'POST', token: capToken });
      const enableCapTotp = await req('/api/auth/totp/enable', {
        method: 'POST',
        token: capToken,
        body: { code: generateTotpCode(setupCapTotp.data.secret) }
      });
      apiOk(enableCapTotp.status === 200 && enableCapTotp.data.totpEnabled, 'TOTP enabled for capuser');

      env.TRUST_PROXY = '1';
      for (let i = 1; i <= 5; i++) {
        const resTotp = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `192.0.2.${i}`
          },
          body: JSON.stringify({ username: 'capuser', password: 'Password123!', totpCode: '000000' })
        });
        apiOk(resTotp.status === 401, `Wrong TOTP attempt ${i}/5 from IP 192.0.2.${i} returns 401`);
      }

      // 6th attempt from a brand-new IP with a VALID TOTP code must be blocked by per-account cap
      const sixthTotpRes = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '192.0.2.250'
        },
        body: JSON.stringify({
          username: 'capuser',
          password: 'Password123!',
          totpCode: generateTotpCode(setupCapTotp.data.secret)
        })
      });
      const sixthTotpData = await sixthTotpRes.json();
      apiOk(
        sixthTotpRes.status === 429 && sixthTotpData.code === 'totp_rate_limited',
        '6th TOTP login attempt for same account from new IP is blocked with 429 totp_rate_limited even with valid code'
      );
      delete env.TRUST_PROXY;
    }

    // (3) Session cookie Secure flag: omitted on localhost / 127.0.0.1, set on non-localhost hosts
    {
      const { makeSessionCookie, clearSessionCookie } = require('../scripts/api.cjs');
      const localCookie1 = makeSessionCookie('tok', 3600, { headers: { host: 'localhost:8187' } });
      const localCookie2 = makeSessionCookie('tok', 3600, { headers: { host: '127.0.0.1:8187' } });
      const prodCookie = makeSessionCookie('tok', 3600, { headers: { host: 'charred.example.com' } });
      const prodClear = clearSessionCookie({ headers: { host: 'charred.example.com:8443' } });
      apiOk(!localCookie1.includes('Secure'), 'Session cookie on localhost does not set Secure');
      apiOk(!localCookie2.includes('Secure'), 'Session cookie on 127.0.0.1 does not set Secure');
      apiOk(prodCookie.includes('; Secure'), 'Session cookie on non-localhost host includes Secure');
      apiOk(prodClear.includes('; Secure'), 'Cleared session cookie on non-localhost host includes Secure');

      // Also verify over live HTTP request with custom Host header
      const http = require('node:http');
      const prodLoginCookie = await new Promise((resolve, reject) => {
        const payload = JSON.stringify({ username: 'bravo', password: 'Password123!' });
        const r = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
              Host: 'charred.example.com',
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          },
          res => {
            res.resume();
            res.on('end', () => resolve(String(res.headers['set-cookie'] || '')));
          }
        );
        r.on('error', reject);
        r.write(payload);
        r.end();
      });
      apiOk(prodLoginCookie.includes('Secure'), 'HTTP login with Host: charred.example.com sets Secure on Set-Cookie');
    }

    // (4) Async bcrypt: hashPassword and verifyPassword return Promises; no hashSync/compareSync in scripts/auth.cjs
    {
      const authMod = require('../scripts/auth.cjs');
      const authSrc = fs.readFileSync(require.resolve('../scripts/auth.cjs'), 'utf8');
      apiOk(!authSrc.includes('hashSync') && !authSrc.includes('compareSync'), 'scripts/auth.cjs contains no hashSync or compareSync');
      const hashPromise = authMod.hashPassword('AsyncPass123!');
      apiOk(hashPromise && typeof hashPromise.then === 'function', 'hashPassword returns a Promise');
      const hashed = await hashPromise;
      const verifyPromise = authMod.verifyPassword('AsyncPass123!', hashed);
      apiOk(verifyPromise && typeof verifyPromise.then === 'function', 'verifyPassword returns a Promise');
      apiOk((await verifyPromise) === true, 'Async verifyPassword resolves true for matching password');
      apiOk((await authMod.verifyPassword('WrongPass', hashed)) === false, 'Async verifyPassword resolves false for wrong password');
    }

    // (5) Drop Node 20 JSON fallback; require Node >=22.5; node:sqlite is the dev/test store
    {
      const pkg = JSON.parse(fs.readFileSync(require.resolve('../package.json'), 'utf8'));
      apiOk(pkg.engines && pkg.engines.node === '>=22.5.0', 'package.json engines.node requires >=22.5.0');
      const workflowSrc = fs.readFileSync(require.resolve('../.github/workflows/test.yml'), 'utf8');
      apiOk(/node-version:\s*['"]?22['"]?/.test(workflowSrc), 'CI workflow runs on Node 22');
      const dbSrc = fs.readFileSync(require.resolve('../scripts/db.cjs'), 'utf8');
      apiOk(!dbSrc.includes('openFileStore') && !dbSrc.includes('FORCE_FILE_STORE'), 'scripts/db.cjs has no JSON-file fallback');
      const { openStore } = require('../scripts/db.cjs');
      const s = openStore({ file: ':memory:', forceFallback: true });
      apiOk(s.backend === 'sqlite' && s.db && typeof s.db.prepare === 'function', 'openStore uses node:sqlite even if forceFallback is passed');
      s.close();
    }

    // (6) Ranked play requires a verified email; unverified account can play unranked; clear email_unverified code & UI handling
    {
      const regUnv = await req('/api/auth/register', {
        method: 'POST',
        body: { username: 'unverified_cmd', email: 'unv@example.com', password: 'Password123!', displayName: 'Unverified Cmd' }
      });
      apiOk(
        regUnv.status === 201 && regUnv.data.token && regUnv.data.user && regUnv.data.user.emailVerified === false,
        'Registering an account issues an unverified session for unranked play'
      );
      const unvToken = regUnv.data.token;
      const unvId = regUnv.data.user.id;

      // Unverified login returns email_unverified code
      const loginUnv = await req('/api/auth/login', {
        method: 'POST',
        body: { username: 'unverified_cmd', password: 'Password123!' }
      });
      apiOk(loginUnv.status === 403 && loginUnv.data.code === 'email_unverified', 'Login with unverified account returns code email_unverified');

      // Starting a ranked/attested match as an unverified host is rejected with 403 email_unverified
      const startUnvHost = await req('/api/matches/start', {
        method: 'POST',
        token: unvToken,
        body: {
          roomCode: 'local',
          mode: 'online',
          round: 1,
          participants: [
            { slot: 0, userId: unvId, name: 'Unverified Cmd', ai: false },
            { slot: 1, userId: bravoId, name: 'Commander Bravo', ai: false }
          ]
        }
      });
      apiOk(
        startUnvHost.status === 403 && startUnvHost.data.code === 'email_unverified',
        'POST /api/matches/start rejects unverified host with 403 email_unverified'
      );

      // Starting a match where a verified host includes an unverified human participant is also rejected with 403 email_unverified
      const startUnvPart = await req('/api/matches/start', {
        method: 'POST',
        token: bravoToken,
        body: {
          roomCode: 'CHARRED-UNV',
          mode: 'online',
          round: 1,
          participants: [
            { slot: 0, userId: bravoId, name: 'Commander Bravo', ai: false },
            { slot: 1, userId: unvId, name: 'Unverified Cmd', ai: false }
          ]
        }
      });
      apiOk(
        startUnvPart.status === 403 && startUnvPart.data.code === 'email_unverified',
        'POST /api/matches/start rejects unverified participant with 403 email_unverified'
      );

      // Attesting a match with an unverified account is rejected with 403 email_unverified
      const validMatchForAttestCheck = await req('/api/matches/start', {
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
      const attestUnv = await req(`/api/matches/${validMatchForAttestCheck.data.matchId}/attest`, {
        method: 'POST',
        token: unvToken,
        body: {
          nonce: validMatchForAttestCheck.data.nonce,
          winnerSlot: 0,
          durationMs: 5000,
          actionLog: validActionLog,
          outcomes: alphaWinsOutcomes
        }
      });
      apiOk(
        attestUnv.status === 403 && attestUnv.data.code === 'email_unverified',
        'POST /api/matches/:id/attest rejects unverified account with 403 email_unverified'
      );

      // Unverified account never appears on the leaderboard
      const lbCheck = await req('/api/leaderboard');
      apiOk(
        !lbCheck.data.leaderboard.some(e => e.username === 'unverified_cmd'),
        'Unverified account does not appear on GET /api/leaderboard'
      );

      // UI source check for email_unverified handling
      const htmlSrc = fs.readFileSync(require.resolve('../index.html'), 'utf8');
      apiOk(
        htmlSrc.includes('email_unverified') && htmlSrc.includes('unranked'),
        'index.html surfaces email_unverified and explains unranked vs ranked play'
      );
    }

    // (7) MySQL data layer (mysql2) selected when DATABASE_URL is set — fake-pool unit test (no live MySQL)
    {
      const envExample = fs.readFileSync(require.resolve('../.env.example'), 'utf8');
      apiOk(/^DATABASE_URL=\s*$/m.test(envExample), '.env.example documents DATABASE_URL= with an empty placeholder');
      apiOk(/^TRUST_PROXY=\s*$/m.test(envExample), '.env.example documents TRUST_PROXY= with an empty placeholder');

      const { openStore } = require('../scripts/db.cjs');
      const executedQueries = [];
      const tables = {
        users: [],
        oauth_accounts: [],
        sessions: [],
        matches: [],
        match_participants: []
      };
      let poolClosed = false;

      const fakeMysqlPool = {
        async execute(sql, params = []) {
          const norm = sql.replace(/\s+/g, ' ').trim();
          executedQueries.push({ sql: norm, params });
          const qCount = (norm.match(/\?/g) || []).length;
          if (qCount !== params.length) {
            throw new Error(`Placeholder count mismatch (${qCount} vs ${params.length}) in SQL: ${norm}`);
          }

          if (norm.startsWith('CREATE TABLE IF NOT EXISTS')) {
            return [{ affectedRows: 0 }, []];
          }
          if (norm.startsWith('INSERT INTO users')) {
            const [id, username, email, password_hash, email_verified, display_name, avatar, bio, custom_fields_json, created_at, updated_at] = params;
            tables.users.push({
              id, username, email, password_hash, email_verified,
              email_verify_hash: null, email_verify_expires_at: null, email_verify_attempts: 0,
              totp_secret: null, totp_enabled: 0,
              display_name, avatar, bio, custom_fields_json,
              wins: 0, losses: 0, kills: 0, matches_played: 0,
              created_at, updated_at
            });
            return [{ affectedRows: 1 }, []];
          }
          if (norm === 'SELECT * FROM users WHERE id = ?') {
            return [tables.users.filter(u => u.id === params[0]), []];
          }
          if (norm === 'SELECT * FROM users WHERE LOWER(username) = LOWER(?)') {
            const t = String(params[0]).toLowerCase();
            return [tables.users.filter(u => u.username.toLowerCase() === t), []];
          }
          if (norm === 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)') {
            const t = String(params[0]).toLowerCase();
            return [tables.users.filter(u => u.email.toLowerCase() === t), []];
          }
          if (norm.startsWith('UPDATE users SET email_verify_hash = ?, email_verify_expires_at = ?, email_verify_attempts = 0')) {
            const [hash, exp, now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) {
              u.email_verify_hash = hash;
              u.email_verify_expires_at = exp;
              u.email_verify_attempts = 0;
              u.updated_at = now;
            }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET email_verify_attempts = ?, email_verify_hash = NULL')) {
            const [attempts, now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) {
              u.email_verify_attempts = attempts;
              u.email_verify_hash = null;
              u.email_verify_expires_at = null;
              u.updated_at = now;
            }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET email_verify_attempts = ?, updated_at = ?')) {
            const [attempts, now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) {
              u.email_verify_attempts = attempts;
              u.updated_at = now;
            }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET email_verified = 1')) {
            const [now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) {
              u.email_verified = 1;
              u.email_verify_hash = null;
              u.email_verify_expires_at = null;
              u.email_verify_attempts = 0;
              u.updated_at = now;
            }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET totp_secret = ?')) {
            const [secret, now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) { u.totp_secret = secret; u.totp_enabled = 0; u.updated_at = now; }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET totp_enabled = 1')) {
            const [now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) { u.totp_enabled = 1; u.updated_at = now; }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET totp_enabled = 0, totp_secret = NULL')) {
            const [now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) { u.totp_enabled = 0; u.totp_secret = null; u.updated_at = now; }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('INSERT INTO sessions')) {
            const [token_hash, user_id, expires_at, created_at] = params;
            tables.sessions.push({ token_hash, user_id, expires_at, created_at });
            return [{ affectedRows: 1 }, []];
          }
          if (norm === 'SELECT * FROM sessions WHERE token_hash = ?') {
            return [tables.sessions.filter(s => s.token_hash === params[0]), []];
          }
          if (norm === 'DELETE FROM sessions WHERE token_hash = ?') {
            tables.sessions = tables.sessions.filter(s => s.token_hash !== params[0]);
            return [{ affectedRows: 1 }, []];
          }
          if (norm.startsWith('INSERT INTO matches')) {
            const [id, nonce, host_user_id, room_code, mode, round_number, started_at] = params;
            tables.matches.push({
              id, nonce, nonce_used: 0, host_user_id, room_code, mode, round_number,
              status: 'pending', winner_user_id: null, canonical_hash: null, reject_reason: null,
              started_at, completed_at: null
            });
            return [{ affectedRows: 1 }, []];
          }
          if (norm.startsWith('INSERT INTO match_participants')) {
            const [match_id, slot, user_id, name, is_ai] = params;
            tables.match_participants.push({
              match_id, slot, user_id, name, is_ai,
              kills: 0, final_hp: 0, won: 0, attested: 0, attestation_hash: null, payload_json: null, attested_at: null
            });
            return [{ affectedRows: 1 }, []];
          }
          if (norm === 'SELECT * FROM matches WHERE id = ?') {
            return [tables.matches.filter(m => m.id === params[0]), []];
          }
          if (norm === 'SELECT * FROM match_participants WHERE match_id = ? ORDER BY slot ASC') {
            return [
              tables.match_participants
                .filter(mp => mp.match_id === params[0])
                .sort((a, b) => a.slot - b.slot),
              []
            ];
          }
          if (norm.startsWith('UPDATE match_participants SET attested = 1')) {
            const [attestation_hash, payload_json, kills, final_hp, won, attested_at, match_id, user_id] = params;
            for (const mp of tables.match_participants) {
              if (mp.match_id === match_id && mp.user_id === user_id && !mp.is_ai) {
                mp.attested = 1;
                mp.attestation_hash = attestation_hash;
                mp.payload_json = payload_json;
                mp.kills = kills;
                mp.final_hp = final_hp;
                mp.won = won;
                mp.attested_at = attested_at;
              }
            }
            return [{ affectedRows: 1 }, []];
          }
          if (norm.startsWith('UPDATE matches SET status = ?, nonce_used = 1, winner_user_id = ?')) {
            const [status, winner_user_id, canonical_hash, completed_at, id] = params;
            const m = tables.matches.find(r => r.id === id);
            if (m) {
              m.status = status;
              m.nonce_used = 1;
              m.winner_user_id = winner_user_id;
              m.canonical_hash = canonical_hash;
              m.completed_at = completed_at;
            }
            return [{ affectedRows: m ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE match_participants SET kills = ?, final_hp = ?, won = ?')) {
            const [kills, final_hp, won, match_id, slot] = params;
            const mp = tables.match_participants.find(r => r.match_id === match_id && r.slot === slot);
            if (mp) { mp.kills = kills; mp.final_hp = final_hp; mp.won = won; }
            return [{ affectedRows: mp ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET wins = wins + ?')) {
            const [w, l, k, now, id] = params;
            const u = tables.users.find(r => r.id === id && r.email_verified === 1);
            if (u) {
              u.wins += w;
              u.losses += l;
              u.kills += k;
              u.matches_played += 1;
              u.updated_at = now;
            }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('SELECT * FROM users WHERE email_verified = 1 ORDER BY wins DESC')) {
            const limit = params[0];
            const rows = tables.users
              .filter(u => u.email_verified === 1)
              .sort((a, b) => b.wins - a.wins || b.kills - a.kills)
              .slice(0, limit);
            return [rows, []];
          }
          return [[], []];
        },
        async end() {
          poolClosed = true;
        }
      };

      const mysqlStore = openStore({
        databaseUrl: 'mysql://placeholder:placeholder@localhost:3306/charred_test',
        mysqlPool: fakeMysqlPool
      });
      await mysqlStore.ready;
      apiOk(mysqlStore.backend === 'mysql', 'openStore selects mysql backend when DATABASE_URL is mysql://...');
      apiOk(executedQueries.filter(q => q.sql.startsWith('CREATE TABLE IF NOT EXISTS')).length === 5, 'MySQL adapter creates all 5 schema tables on start-up');

      const u1 = await mysqlStore.createUser({
        username: 'mysql_cmd',
        email: 'mysql@example.com',
        passwordHash: 'hash1',
        emailVerified: false,
        displayName: 'MySQL Commander'
      });
      apiOk(u1 && u1.username === 'mysql_cmd' && !u1.emailVerified, 'MySQL adapter createUser + getUserById works');
      apiOk((await mysqlStore.getUserByUsername('MYSQL_CMD')).id === u1.id, 'MySQL adapter case-insensitive getUserByUsername works');
      apiOk((await mysqlStore.getUserByEmail('MYSQL@EXAMPLE.COM')).id === u1.id, 'MySQL adapter case-insensitive getUserByEmail works');

      await mysqlStore.setEmailVerificationCode(u1.id, 'codehash123', new Date(Date.now() + 60000).toISOString());
      for (let i = 1; i <= 5; i++) {
        const resAttempt = await mysqlStore.recordFailedEmailVerifyAttempt(u1.id);
        if (i === 5) apiOk(resAttempt.invalidated === true && !resAttempt.user.emailVerifyHash, 'MySQL adapter invalidates email code on 5th failed attempt');
      }
      await mysqlStore.setEmailVerificationCode(u1.id, 'codehash456', new Date(Date.now() + 60000).toISOString());
      const verifiedU1 = await mysqlStore.verifyEmailCode(u1.id);
      apiOk(verifiedU1.emailVerified === true, 'MySQL adapter verifyEmailCode marks user verified');

      await mysqlStore.setTotpSecret(u1.id, 'SECRETBASE32');
      apiOk((await mysqlStore.enableTotp(u1.id)).totpEnabled === true, 'MySQL adapter enableTotp works');
      apiOk((await mysqlStore.disableTotp(u1.id)).totpEnabled === false, 'MySQL adapter disableTotp works');

      await mysqlStore.createSession({ tokenHash: 'th1', userId: u1.id, expiresAt: new Date(Date.now() + 60000).toISOString() });
      const sess = await mysqlStore.getSession('th1');
      apiOk(sess && sess.user.id === u1.id, 'MySQL adapter createSession + getSession works');
      await mysqlStore.deleteSession('th1');
      apiOk((await mysqlStore.getSession('th1')) === null, 'MySQL adapter deleteSession works');

      const u2 = await mysqlStore.createUser({
        username: 'mysql_rival',
        email: 'rival@example.com',
        passwordHash: 'hash2',
        emailVerified: true
      });
      const m = await mysqlStore.createMatch({ hostUserId: u1.id, nonce: 'nonce-mysql-1', roomCode: 'RM1', mode: 'online', roundNumber: 1 });
      await mysqlStore.addParticipants(m.id, [
        { slot: 0, userId: u1.id, name: 'MySQL Commander', ai: false },
        { slot: 1, userId: u2.id, name: 'Rival', ai: false }
      ]);
      await mysqlStore.submitAttestation({
        matchId: m.id,
        userId: u1.id,
        attestationHash: 'chash',
        payload: { ok: true },
        slotOutcome: { slot: 0, kills: 1, finalHp: 90, won: true }
      });
      await mysqlStore.finalizeMatch({
        matchId: m.id,
        winnerUserId: u1.id,
        canonicalHash: 'chash',
        participantOutcomes: [
          { slot: 0, kills: 1, finalHp: 90, won: true },
          { slot: 1, kills: 0, finalHp: 0, won: false }
        ],
        isBotMatch: false
      });

      const lb = await mysqlStore.getLeaderboard(10);
      apiOk(lb.length === 2 && lb[0].username === 'mysql_cmd' && lb[0].wins === 1, 'MySQL adapter finalizeMatch updates stats and getLeaderboard returns ranked verified users');

      // Verify every non-DDL query uses parameterized '?' placeholders and never interpolates values
      const dmlQueries = executedQueries.filter(q => !q.sql.startsWith('CREATE TABLE'));
      apiOk(
        dmlQueries.length > 15 && dmlQueries.every(q => q.params.length > 0 && q.sql.includes('?') && !q.sql.includes('mysql_cmd') && !q.sql.includes('mysql@example.com')),
        'Every MySQL DML/SELECT query uses ? placeholders and never interpolates user values'
      );

      await mysqlStore.close();
      apiOk(poolClosed === true, 'MySQL adapter close() ends the pool (unit-tested with fake mysql2 pool; no live MySQL server required)');
    }

    console.log(`${apiChecks} API & account checks passed (154 simulation + ${apiChecks} API = ${154 + apiChecks} total checks; MySQL adapter verified via fake-pool unit tests, main suite runs on SQLite).`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});

