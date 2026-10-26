const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
source=source.slice(0,source.indexOf('for(let i=0;i<6;i++){let d=document.createElement'));
const store=new Map(),localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const elements=new Map();function element(){const cl=new Set(['hidden']);return {value:'',checked:true,classList:{contains:c=>cl.has(c),add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>f===undefined?(cl.has(c)?cl.delete(c):cl.add(c)):(f?cl.add(c):cl.delete(c))},style:{},replaceChildren(){},appendChild(){},append(){},textContent:'',remove(){},setAttribute(){}}}
const document={body:element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll:()=>[],hidden:false};
const context={console,htmlSource:fs.readFileSync('index.html','utf8'),innerWidth:1280,innerHeight:720,THREE:require('three'),document,window:{localStorage},localStorage,setTimeout,clearTimeout,performance,crypto:require('crypto').webcrypto,requestAnimationFrame(){}};
vm.createContext(context);vm.runInContext(source,context);
const test=`
let checks=0;function ok(value,message){if(!value)throw Error(message);checks++}
const originalClearViews=clearViews;emit=()=>{};flash=()=>{};sound=()=>{};refreshWeapons=()=>{};updateUI=()=>{};showShop=()=>{};clearViews=()=>{};broadcastState=()=>{};notice=()=>{};laserLine=()=>{};
function setup(){seed=1729;S={cfg:{terrain:'Rolling Hills',wall:'Concrete',difficulty:'Cyborg',market:'fixed'},round:1,turn:0,actionsMax:2,actionsLeft:2,heights:new Float32Array(481).fill(20),tanks:[0,1].map(id=>({id,name:'P'+id,x:40+id*100,y:20,hp:100,shield:0,mag:false,inv:Object.fromEntries(Object.keys(WEAPONS_CONFIG).map(n=>[n,10])),fuel:100,power:650,angle:id?135:45,az:0,vy:0,chuting:0,buried:0,cash:10000,score:0})),platforms:[],customMap:null,satellites:[],buildings:[],drones:[],shots:[],fires:[],phase:'aim',wind:0,wall:'Concrete',time:0,uid:0,prices:{},ready:[]};running=true;host=true;online=false;shotClock=0;return S.tanks[0]}
for(let[name,w]of Object.entries(WEAPONS_CONFIG)){let t=setup();let accepted=action({weaponOrItem:name,angle:35,power:500,az:0,targetX:140},0);if(['chute','floatplat','lifejacket'].includes(w.kind)){ok(!accepted&&S.actionsLeft===2,'Passive parachute rejected without spending action');continue}ok(accepted,'Action rejected '+name);if(w.kind==='actionpack'){ok(S.actionsLeft===4&&current().packUsed,'Action pack adds net two actions');continue}if(['blast','nuke','split','leap','funky','roller','digger','dirt','liquid','riot','napalm','laser','drone'].includes(w.kind)){for(let i=0;i<1600&&S.phase==='flight';i++)step(1/60);ok(S.phase!=='flight','Flight stuck '+name);ok(S.heights.every(Number.isFinite),'Invalid terrain '+name);ok(S.tanks.every(t=>Number.isFinite(t.hp)&&Number.isFinite(t.y)),'Invalid tank '+name);ok(S.actionsLeft===1,'Flight spends one of two configured remaining actions')}else ok(S.phase==='aim'&&S.actionsLeft===1,'Equipment/structure/satellite spends one configured action '+name)}
setup();let t=current();t.hp=60;action({weaponOrItem:'Baby Missile',angle:45,power:1000});ok(t.power===600,'Health caps power');
setup();t=current();t.hp=15;t.power=150;$('power').value=150;action({weaponOrItem:'Battery',angle:45,power:150});ok(t.hp===100&&t.power===1000&&+$('power').value===1000&&+$('power').max===1000,'Battery restores full 100 HP and 1000 firing power');
{
  setup();for(let tank of S.tanks)tank.inv['Standard Shield']=100;beginTurn();
  for(let cycle=1;cycle<=4;cycle++){
    for(let pid of [0,1]){
      let expected=cycle<=3?4:2;
      ok(S.turn===pid&&S.actionsMax===expected&&S.actionsLeft===expected,'Player '+pid+' turn '+cycle+' grants '+expected+' actions (4 setup -> 2 standard)');
      for(let k=0;k<expected;k++)ok(action({weaponOrItem:'Standard Shield',angle:45,power:500},pid),'Spend action '+(k+1)+'/'+expected);
      ok(S.turn!==pid,'Turn advances after '+expected+' actions');
    }
  }
  setup();beginTurn();t=current();
  ok(!starter()['Action Supply Pack']&&WEAPONS_CONFIG['Action Supply Pack']?.cost===3500,'Action Supply Pack costs 3500 and is not in starter kit');
  t.inv['Action Supply Pack']=2;
  let beforeLeft=S.actionsLeft,beforeMax=S.actionsMax;
  ok(action({weaponOrItem:'Action Supply Pack'},0),'First Action Supply Pack activation succeeds');
  ok(S.actionsLeft===beforeLeft+2&&S.actionsMax===beforeMax+2&&t.inv['Action Supply Pack']===1,'Action Supply Pack spends 1 action and grants 3 (net +2)');
  ok(!action({weaponOrItem:'Action Supply Pack'},0)&&S.actionsLeft===beforeLeft+2&&t.inv['Action Supply Pack']===1,'Second Action Supply Pack in same turn rejected at 0 stock and 0 action cost');
  nextTurn();nextTurn();
  ok(S.turn===0&&!t.packUsed&&action({weaponOrItem:'Action Supply Pack'},0),'Action Supply Pack limit resets on next personal turn');
}
setup();t=current();t.shield=40;damage(t,55,1);ok(t.hp===85&&t.shield===0,'Shield absorbs damage');
setup();let before=S.heights[140];impact({name:'Dirt Ball',x:140,y:20,z:0,owner:0});ok(S.heights[140]>before,'Dirt adds terrain');
setup();impact({name:'Riot Bomb',x:140,y:20,z:0,owner:0});ok(S.heights[140]<20&&S.tanks[1].hp===100,'Riot clears without blast damage');
setup();impact({name:'Nuke',x:140,y:20,z:0,owner:0});ok(S.tanks[1].hp===0,'Nuke lethal direct impact');
setup();for(let boundary of ['Concrete','Rubber','Spring','Wrap-Around']){S.wall=boundary;let p={x:-2,z:0,vx:-10};let gone=wall(p);ok(boundary==='Concrete'?gone:!gone,'Wall mode '+boundary);if(boundary==='Spring')ok(p.vx===13,'Spring amplification');if(boundary==='Wrap-Around')ok(p.x>239,'Wrapping');}
setup();t=current();t.y=50;t.inv.Parachute=1;for(let i=0;i<400;i++)step(1/60);ok(t.hp===100&&t.inv.Parachute===0,'Parachute prevents fall damage');
setup();t=current();t.y=50;t.inv.Parachute=0;for(let i=0;i<180;i++)step(1/60);ok(t.hp<100,'Unprotected fall damages');
setup();S.cfg.difficulty='Hard';let estimateResult=estimate(current(),S.tanks[1]);ok(estimateResult.error<15,'Hard heuristic initial estimate within 15m');
{
  const htmlMenu=htmlSource;
  ok(htmlMenu.includes('<option value="Easy">Easy</option><option value="Normal" selected>Normal</option><option value="Hard">Hard</option>'),'Menu difficulty select has Easy/Normal/Hard with Normal selected by default');
  let pEasy=aiProfile('Easy'),pNorm=aiProfile('Normal'),pHard=aiProfile('Hard');
  ok(pEasy.rangeErr>pNorm.rangeErr&&pNorm.rangeErr>pHard.rangeErr&&pEasy.learn<pNorm.learn&&pNorm.learn<pHard.learn,'Difficulty profiles order error and learning rate Easy -> Normal -> Hard');
  let runBracketing=(diff)=>{
    setup();S.cfg.difficulty=diff;S.wind=7.5;seed=1337;
    let bot=S.tanks[0],target=S.tanks[1];bot.ai=true;bot.x=40;target.x=210;
    let misses=[];
    for(let s=0;s<3;s++){
      S.heights.fill(20);bot.x=40;bot.y=20;bot.hp=100;bot.falling=false;bot.vy=0;target.x=210;target.y=20;target.hp=100;target.shield=180;target.falling=false;target.vy=0;
      S.turn=0;S.phase='aim';S.actionsLeft=2;
      let est=estimate(bot,target);
      bot.aiPlan={targetId:target.id,targetX:target.x,angle:est.angle,power:est.power,biasRange:est.biasRange,biasWind:est.biasWind};
      ok(action({action:'fire',weaponOrItem:'Baby Missile',angle:est.angle,power:est.power,az:0},0),'AI shot '+s+' valid action on '+diff);
      for(let i=0;i<600&&S.phase==='flight';i++)step(1/60);
      let mem=bot.aiMem?.[target.id];
      ok(mem&&mem.shots===s+1,'Observed impact recorded in aiMem on shot '+(s+1));
      misses.push(Math.abs(mem.lastMissX));
    }
    return misses;
  };
  let mEasy=runBracketing('Easy'),mNorm=runBracketing('Normal'),mHard=runBracketing('Hard');
  ok(mEasy[2]<mEasy[1]&&mEasy[1]<mEasy[0]&&mNorm[2]<mNorm[1]&&mNorm[1]<mNorm[0]&&mHard[2]<mHard[1]&&mHard[1]<mHard[0],'Controlled unchanged-battlefield calibration converges monotonically per tier');
  ok(mHard[0]<mNorm[0]&&mNorm[0]<mEasy[0]&&mHard[2]<mNorm[2]&&mNorm[2]<mEasy[2],'Hard < Normal < Easy miss distance on initial and calibrated shots');
  setup();let hCalls=0,plCalls=0,origH=height,origPl=platformCollision;height=x=>{hCalls++;return origH(x)};platformCollision=(x,y,z)=>{plCalls++;return origPl(x,y,z)};estimate(current(),S.tanks[1]);height=origH;platformCollision=origPl;ok(hCalls===0&&plCalls===0,'estimate() uses analytical perception without terrain/platform trajectory search');
  setup();S.cfg.difficulty='Normal';let b0=S.tanks[0],t1=S.tanks[1];b0.x=40;t1.x=210;b0.aiPlan={targetId:1,targetX:210,angle:45,power:600,biasRange:0,biasWind:0};recordAiImpact(0,175);ok(b0.aiMem[1].lastMissX===-35&&b0.aiMem[1].corrX>0&&b0.aiMem[1].corrPower>0,'Undershoot produces positive range and power correction');
  let cBefore=b0.aiMem[1].corrX;t1.x=255;estimate(b0,t1);ok(b0.aiMem[1].corrX>0&&b0.aiMem[1].corrX<cBefore,'Target movement decays stored correction');
  setup();S.cfg.difficulty='Normal';b0=S.tanks[0];t1=S.tanks[1];b0.x=40;t1.x=210;b0.aiPlan={targetId:1,targetX:210,angle:45,power:600,biasRange:0,biasWind:0};recordAiImpact(0,245);ok(b0.aiMem[1].lastMissX===35&&b0.aiMem[1].corrX<0&&b0.aiMem[1].corrPower<0,'Overshoot produces negative range and power correction');
  for(let nb of [{weaponOrItem:'Battery',angle:45,power:500},{weaponOrItem:'Standard Shield',angle:45,power:500},{weaponOrItem:'Laser',angle:45,power:500},{weaponOrItem:'FPV Kamikaze Drone',angle:45,power:500,targetX:210},{action:'move',dx:4},{weaponOrItem:'NonExistent',angle:45,power:500}]){setup();S.tanks[0].hp=50;S.tanks[0].aiPlan={targetId:1,targetX:140,angle:45,power:500};action(nb,0);ok(S.tanks[0].aiPlan===null,'Stale aiPlan cleared for non-ballistic or invalid action');}
  let popStats=(diff)=>{
    let prof=aiProfile(diff),s0=0,s1=0,n=12;
    for(let k=1;k<=n;k++){
      setup();S.cfg.difficulty=diff;S.wind=(k%2?1:-1)*(3+(k%5)*1.5);seed=k*997+101;
      let b=S.tanks[0],tg=S.tanks[1];b.ai=true;b.x=40;tg.x=200+(k%4)*15;
      for(let s=0;s<2;s++){
        S.heights.fill(20);b.y=20;tg.y=20;tg.hp=100;tg.shield=180;tg.falling=false;tg.vy=0;S.turn=0;S.phase='aim';S.actionsLeft=2;
        let est=estimate(b,tg),ang=clamp(est.angle+(rng()-.5)*2*prof.angleJitter,5,175),pwr=clamp(est.power+(rng()-.5)*2*prof.powerJitter,100,1000);
        b.aiPlan={targetId:tg.id,targetX:tg.x,angle:ang,power:pwr,biasRange:est.biasRange,biasWind:est.biasWind};
        action({action:'fire',weaponOrItem:'Baby Missile',angle:ang,power:pwr,az:0},0);
        for(let i=0;i<600&&S.phase==='flight';i++)step(1/60);
        if(s===0)s0+=Math.abs(b.aiMem[tg.id].lastMissX);else s1+=Math.abs(b.aiMem[tg.id].lastMissX);
      }
    }
    return{m0:s0/n,m1:s1/n};
  };
  let popE=popStats('Easy'),popN=popStats('Normal'),popH=popStats('Hard');
  ok(popH.m0<popN.m0&&popN.m0<popE.m0&&popH.m1<popN.m1&&popN.m1<popE.m1&&popE.m1<popE.m0&&popN.m1<popN.m0&&popH.m1<popH.m0,'Seeded populations order accuracy Hard > Normal > Easy and improve on shot 2');
}
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
// --- Custom Terrain Editor & Floating Platform Verification ---
setup();
S.heights.fill(6);
for(let x=20;x<=38;x++)S.heights[x]=13;
S.platforms=[{id:1,x:52,y:13,width:28,hp:120,maxHp:120}];
t=current();t.inv['Floating Platform']=0;t.inv['Inflatable Lifejacket']=0;t.x=36;t.y=supportHeight(36);t.fuel=100;
ok(t.y===13,'Tank starts on coastal ramp at platform elevation');
ok(action({action:'move',dir:1},0)&&S.activeDrive,'Tank starts timed drive from land onto floating platform');
for(let i=0;i<80;i++)step(1/60);
ok(t.x>42&&t.y===13,'Tank drives from land onto and along floating platform over deep water');
ok(steerDrive({stop:true,moveId:S.activeDrive.id},0)&&!S.activeDrive,'Stop timed drive on platform');
S.turn=0;S.actionsLeft=2;t.x=66;t.y=supportHeight(66);
ok(!action({action:'move',dir:1},0)&&t.x===66&&S.actionsLeft===2,'Tank blocked from driving off platform edge into unbridged deep water at 0 cost');

S.platforms=[{id:1,x:46,y:13,width:12,hp:120,maxHp:120},{id:2,x:62,y:13,width:12,hp:120,maxHp:120}];
t.x=50;t.y=supportHeight(50);t.fuel=100;
ok(action({action:'move',dir:1},0),'Start drive toward water gap between separated platforms');
for(let i=0;i<60;i++)step(1/60);
ok(t.x<=52&&t.y===13,'Intermediate water gap between separated platforms blocks timed drive from crossing');
finishDrive();

S.platforms=[{id:1,x:52,y:13,width:28,hp:15,maxHp:120}];
t.x=40;t.y=supportHeight(40);t.hp=100;t.inv.Parachute=0;
explosion(64,13,0,{name:'Charge',r:8,dmg:40,crater:0},1,true);
ok(S.platforms.length===0&&t.hp===100,'Platform destroyed by blast at far end without killing supported tank');
for(let i=0;i<120;i++)step(1/60);
ok(t.y===6&&t.hp<100,'Surviving tank falls to underwater floor and takes fall damage when platform collapses');

setup();
S.heights[200]=30;S.heights[204]=22;editorFlattenY=30;
sculptTerrain(200,'flat',20,8);
sculptTerrain(200,'flat',20,8);
ok(S.heights[200]>=29&&S.heights[204]>22,'Flatten brush converges toward locked target height without flipping to water');
editorFlattenY=null;
sculptTerrain(200,'water',20,10);
sculptTerrain(200,'water',20,10);
ok(S.heights[200]<WATER_LEVEL,'Separate water brush carves channel below water level');

ok(!validateCustomMap({name:'NoVersion',heights:new Array(481).fill(20),spawns:[40,440]}),'Validator rejects missing version');
ok(!validateCustomMap({version:1,name:'StrHeight',heights:new Array(481).fill('20'),spawns:[40,440]}),'Validator rejects numeric string heights');
ok(!validateCustomMap({version:1,name:'NullHeight',heights:new Array(481).fill(null),spawns:[40,440]}),'Validator rejects null heights');
ok(!validateCustomMap({version:1,name:'CloseSpawns',heights:new Array(481).fill(20),spawns:[100,106]}),'Validator rejects spawns closer than 10m');
let wetHeights=new Array(481).fill(20);wetHeights[120]=5;
ok(!validateCustomMap({version:1,name:'WetSpawn',heights:wetHeights,spawns:[40,120]}),'Validator rejects unsupported water spawn');
let bridgedMap=validateCustomMap({version:1,name:'Bridged',heights:wetHeights,platforms:[{id:1,x:120,y:13,width:24,hp:120,maxHp:120}],spawns:[40,120]});
ok(bridgedMap&&bridgedMap.spawns.length===6,'Validator accepts platform-supported water spawn and validates all 6 spawns');

setup();
let origH=S.heights[150],origX=S.tanks[0].x,origAngle=S.tanks[0].angle;
openEditor();
sculptTerrain(150,'raise',20,10);
placePlatform(150,28,0);
S.tanks[0].x=250;S.tanks[0].angle=12;S.tanks[0].falling=true;
closeEditor(false);
ok(Math.abs(S.heights[150]-origH)<1e-4&&S.platforms.length===0&&S.tanks[0].x===origX&&S.tanks[0].angle===origAngle&&!S.tanks[0].falling,'Editor cancel restores full snapshot state');

setup();S.phase='flight';ok(!openEditor(),'No editing during projectile flight');S.phase='shop';ok(!openEditor(),'No editing during shop');
setup();online=true;host=false;ok(!openEditor(),'Guest cannot edit maps');host=true;ok(!openEditor(),'Host cannot edit active online match');online=false;
setup();S.tanks[0].ai=true;ok(openEditor(),'Open editor before AI starts');let beforeTime=S.time;last=1000;let savedDraw=draw;draw=()=>{};animate(1100);draw=savedDraw;ok(S.time===beforeTime&&!aiBusy,'Editor pauses simulation and AI');closeEditor(false);
setup();openEditor();sculptTerrain(100,'raise',20,10);let incoming=JSON.parse(JSON.stringify(snapshot()));incoming.heights.fill(33);receiveState(incoming);ok(!editorOpen&&S.heights[100]===33,'Incoming snapshot replaces draft without restoring old backup');
setup();editorSpawns=[40,440,120,360,200,280];let good={version:1,name:'Crossing',heights:Array(481).fill(20),spawns:editorSpawns.slice(),platforms:[{x:240,y:20,width:30,hp:120,maxHp:120}]};
ok(validateCustomMap(good),'Valid six-spawn map accepted');
ok(!validateCustomMap({...good,version:2}),'Unknown map version rejected');
ok(!validateCustomMap({...good,platforms:Array(17).fill(good.platforms[0])}),'Platform count bounded');
ok(!validateCustomMap({...good,platforms:[{...good.platforms[0],width:64.4}]}),'Oversize platform rejected before rounding');
ok(!validateCustomMap({...good,platforms:[{...good.platforms[0],x:Infinity}]}),'Nonfinite platform rejected');
ok(applyCustomMapToState(good)&&S.heights instanceof Float32Array,'Imported map retains typed terrain');
$('mapName').value='Crossing';ok(saveCustomMapSlot('Crossing'),'Map saved to local storage');
let exportMap=JSON.parse(JSON.stringify(serializeCurrentMap()));ok(exportMap.heights.length===481&&exportMap.spawns.length===6,'JSON map export complete');
localStorage.setItem(CUSTOM_MAP_KEY,'{"__proto__":'+JSON.stringify(good)+',"constructor":'+JSON.stringify(good)+',"Crossing":'+JSON.stringify(good)+'}');loadSavedMaps();
ok(Object.getPrototypeOf(savedCustomMaps)===null&&!Object.hasOwn(savedCustomMaps,'__proto__')&&!Object.hasOwn(savedCustomMaps,'constructor')&&savedCustomMaps.Crossing,'Prototype-like saved names handled safely');
S.cfg.terrain='Custom';S.customMap=exportMap;newRound();ok(S.platforms.length===1&&S.tanks[0].x===40&&S.tanks[1].x===440,'Custom layout persists across rounds');
let mapSnap=JSON.parse(JSON.stringify(snapshot()));S.platforms=[];receiveState(mapSnap);ok(S.platforms.length===1&&S.customMap.name==='Crossing','Platforms and custom map synchronize to guest');
setup();S.platforms=[{id:1,x:65,y:40,width:30,hp:120,maxHp:120}];arcGeo=new THREE.BufferGeometry();arcGeo.setAttribute('position',new THREE.BufferAttribute(arcPositions,3));arc=new THREE.Line(arcGeo,new THREE.LineDashedMaterial());$('angle').value=45;$('power').value=650;$('azimuth').value=0;predict();let withDeck=arcGeo.drawRange.count;S.platforms=[];predict();ok(withDeck===0&&arcGeo.drawRange.count===0&&!arc.visible,'Aim prediction stays hidden with and without platform decks');
setup();openEditor();sculptTerrain(180,'raise',20,8);S.heights.fill(5);ok(closeEditor(true)===false&&editorOpen,'Invalid all-water map stays open on Apply');closeEditor(false);

// --- Combat Expansion Verification Suite (Part 2) ---
setup();ok(action({weaponOrItem:'Orbital Laser Satellite',angle:45,power:600,targetX:140},0)&&S.satellites.length===1&&S.actionsLeft===1,'Deploying satellite costs 1 action');
let satX0=S.satellites[0].x;step(1/60);ok(S.satellites[0].x!==satX0,'Satellite moves visibly in orbit');
S.buildings.push({id:++S.uid,owner:1,x:140,y:20,shape:'canopy',hp:100,charges:1});S.tanks[1].shield=50;
ok(action({action:'sat_strike',targetX:140},0),'Callable downward satellite strike executes');
ok(S.buildings[0].hp===45&&S.tanks[1].hp===100&&S.tanks[1].shield===50,'Canopy intercepts downward satellite laser before reaching tank');
for(let i=0;i<120&&S.phase==='flight';i++)step(1/60);
setup();S.satellites.push({id:++S.uid,owner:0,x:140,y:155,z:0,vx:25,hp:60,maxHp:60,cooldown:0});S.tanks[1].shield=40;
ok(action({action:'sat_strike',targetX:140},0),'Satellite strike against shielded tank');
ok(S.tanks[1].shield===0&&S.tanks[1].hp===85,'Energy shield absorbs satellite laser damage without bypass');
for(let i=0;i<120&&S.phase==='flight';i++)step(1/60);
setup();S.satellites.push({id:++S.uid,owner:1,x:120,y:155,z:0,vx:20,hp:60,maxHp:60,cooldown:0});
ok(action({weaponOrItem:'Anti-Satellite Silo',angle:45,power:600},0)&&S.actionsLeft===1,'Silo setup costs 1 action');
ok(action({action:'silo_launch'},0)&&S.phase==='flight','Subsequent ASAT silo launch costs 1 action');
for(let i=0;i<300&&S.phase==='flight';i++)step(1/60);
ok(S.satellites.length===0&&S.phase==='aim'&&S.turn===1,'ASAT missile destroys hostile satellite and finishes 2-action turn');
setup();S.buildings.push({id:++S.uid,owner:1,x:90,y:20,shape:'net',hp:60,ammo:2,cooldown:0});
S.drones.push({id:++S.uid,owner:0,x:85,y:45,z:0,vx:25,vy:0,vz:0,role:'fpv',name:'FPV Kamikaze Drone',hp:35,piloted:true,battery:7});
step(1/60);ok(S.drones[0].netted>0&&S.buildings[0].ammo===1&&S.drones[0].vy<0,'Anti-drone net launcher captures and forces descent of hostile drone');
setup();S.buildings.push({id:++S.uid,owner:1,x:90,y:20,shape:'shotgun',hp:65,ammo:3,cooldown:0});
S.drones.push({id:++S.uid,owner:0,x:85,y:45,z:0,vx:0,vy:0,vz:0,role:'attack',name:'Strike Attack Drone',hp:35,piloted:true,battery:7,shotsLeft:3});
step(1/60);ok(S.drones[0].hp===15&&S.buildings[0].ammo===2,'Shotgun defense damages hostile drone');
for(let i=0;i<60;i++)step(1/60);ok(S.drones.length===0,'Shotgun defense destroys hostile drone after cooldown');
// --- Combat Expansion Verification Suite (Part 1) ---
setup();predict();predictFlight();ok(!arc.visible&&arcGeo.drawRange.count===0,'Predicted aim and remaining-flight arcs removed');
setup();ok(maxActionsForTank({turnsTaken:1})===4&&maxActionsForTank({turnsTaken:3})===4&&maxActionsForTank({turnsTaken:4})===2,'Setup grants four actions, later turns two');
setup();S.wind=10;action({weaponOrItem:'FPV Kamikaze Drone',angle:45,power:600,targetX:140},0);
let fpv=S.drones[0];ok(fpv&&fpv.piloted&&activePilotDrone()===fpv,'Human FPV drone enters 3D piloted mode');
ok(!steerDrone({pitch:.5,yaw:.4},1),'Host rejects steering from non-owner player');
ok(steerDrone({pitch:.4,yaw:-.3,throttle:.5},0),'Host accepts valid owner steering');
let vx0=fpv.vx;step(1/60);ok(fpv.vx>vx0&&fpv.battery<7.5,'Wind accelerates piloted drone and battery drains');
ok(steerDrone({fire:true},0)&&S.drones.length===0,'Pilot manual detonation resolves FPV drone');
setup();action({weaponOrItem:'Strike Attack Drone',angle:45,power:600,targetX:140},0);
let atk=S.drones[0];ok(atk&&atk.role==='attack'&&atk.shotsLeft===3&&S.actionsLeft===1,'Attack drone launches with 3 shots for 1 action');
for(let s=1;s<=3;s++){atk.fireCooldown=0;ok(steerDrone({fire:true},0)&&atk.shotsLeft===3-s,'Attack drone fires round '+s+' of 3')}
atk.fireCooldown=0;ok(!steerDrone({fire:true},0)&&atk.shotsLeft===0,'Attack drone 4th shot rejected (strictly 3 shots/sortie)');
for(let i=0;i<600&&S.phase==='flight';i++)step(1/60);
ok(S.phase==='aim'&&S.turn===0&&S.actionsLeft===1,'Sortie resolves before spending second action');
// Integration edge cases and authority checks.
setup();ensureTurnEconomy();t=current();t.x=6;ok(!action({action:'move',dx:-4})&&S.actionsLeft===2&&t.fuel===100,'Map-edge movement is free when blocked');
ok(!action({weaponOrItem:'Orbital Laser Satellite',targetX:NaN})&&S.actionsLeft===2,'Invalid strike coordinates cost no actions');
S.satellites=[{id:10,owner:0,hp:60},{id:11,owner:0,hp:60}];let stock=t.inv['Orbital Laser Satellite'];ok(!action({weaponOrItem:'Orbital Laser Satellite'})&&t.inv['Orbital Laser Satellite']===stock&&S.actionsLeft===2,'Satellite cap preserves action and inventory');
S.buildings.push({id:12,owner:0,shape:'silo',hp:85,charges:1});ok(!action({action:'silo_launch',targetSatId:10})&&S.actionsLeft===2,'Silo cannot target friendly satellite');
setup();action({weaponOrItem:'Strike Attack Drone'},0);let drone=activePilotDrone();
ok(!steerDrone({yaw:.5,pitch:NaN},0)&&drone.ctrl.yaw===0,'Malformed pilot inputs are rejected atomically');
ok(!steerDrone({droneId:drone.id+1,fire:true},0)&&drone.shotsLeft===3,'Stale sortie command cannot fire new drone');
steerDrone({yaw:.5},0);step(.05);ok(Math.abs(drone.z)>0&&drone.yaw>0,'Steering changes depth in actual 3D');
drone.inputAt=-10;step(.05);ok(drone.ctrl.yaw===0,'Expired steering inputs return to neutral');
drone.netted=1;ok(!fireDroneRound(drone)&&drone.shotsLeft===3,'Netted attack drone cannot fire');
let wire=JSON.parse(JSON.stringify(snapshot()));receiveState(wire);ok(S.actionsLeft===1&&S.tanks[0].turnsTaken===1&&S.drones[0].shotsLeft===3,'Action economy and sortie ammunition survive host snapshot');
setup();action({weaponOrItem:'Strike Attack Drone'},0);S.wind=0;step(.1);let calmVx=S.drones[0].vx;
setup();action({weaponOrItem:'Strike Attack Drone'},0);S.wind=10;step(.1);ok(S.drones[0].vx>calmVx,'Wind changes drone velocity independently of throttle');
setup();S.buildings.push({id:1,owner:0,shape:'net',hp:60,ammo:2,x:40,y:20});action({weaponOrItem:'Strike Attack Drone'},0);step(.05);ok(S.buildings[0].ammo===2&&!S.drones[0].netted,'Net launcher ignores friendly drones');
setup();let exposed=S.tanks[1];explosion(140,38,0,{r:28,dmg:60},0,true);let exposedLoss=100-exposed.hp;
setup();S.buildings.push({id:1,owner:1,shape:'canopy',hp:100,x:140,y:20});explosion(140,38,0,{r:28,dmg:60},0,true);ok(100-S.tanks[1].hp<exposedLoss*.3,'Canopy attenuates overhead blast damage');
setup();S.platforms.push({id:1,x:57,y:30,width:24,hp:100,maxHp:100});action({weaponOrItem:'Anti-Satellite Silo'},0);step(.05);ok(S.buildings[0].y===30,'Structures remain supported on raised floating decks');
setup();S.tanks.forEach(t=>t.turnsTaken=9);S.satellites=[{id:1,owner:0,hp:60}];newRound();ok(current().turnsTaken===1&&S.actionsLeft===4&&S.satellites.length===0,'Round reset grants fresh setup phase and clears satellites');
// --- Chunk 2 Timed Driving Verification ---
{
  ok(sanitizeMoveDuration(undefined)===11&&sanitizeMoveDuration(1)===3&&sanitizeMoveDuration(99)===30&&movementSpeed(S.tanks[0])===6,'Move duration defaults to 11s (clamped 3..30s) and ground speed is 6m/s');
  setup();S.cfg.moveDuration=11;t=current();t.x=100;t.fuel=100;
  ok(action({action:'move',dir:1},0)&&S.actionsLeft===1&&S.activeDrive?.remaining===11,'Timed drive starts with 11s budget and spends 1 action');
  let mid=S.activeDrive.id;
  ok(!action({weaponOrItem:'Baby Missile',angle:45,power:500},0)&&!action({weaponOrItem:'Standard Shield'},0)&&S.actionsLeft===1,'Offensive and deploy actions rejected while drive is active');
  ok(!steerDrive({dir:-1,moveId:mid+99},0)&&!steerDrive({dir:-1,moveId:mid},1),'Stale moveId and wrong actor rejected');
  for(let i=0;i<120;i++)step(1/60);
  ok(Math.abs(t.x-112)<1e-3&&Math.abs(t.fuel-88)<1e-3&&Math.abs(S.activeDrive.remaining-9)<1e-3,'2s of driving at 6m/s moves 12m and drains 12 fuel');
  ok(steerDrive({dir:-1,moveId:mid},0)&&S.actionsLeft===1,'Reversing direction mid-drive costs 0 extra actions');
  for(let i=0;i<60;i++)step(1/60);
  ok(Math.abs(t.x-106)<1e-3&&Math.abs(t.fuel-82)<1e-3,'1s reverse moves 6m left and drains 6 fuel by actual distance');
  ok(steerDrive({stop:true,moveId:mid},0)&&!S.activeDrive&&S.actionsLeft===1,'Stopping early ends drive and preserves remaining setup action');
  ok(!steerDrive({dir:1,moveId:mid},0)&&!action({action:'move',moveId:mid,dir:1},0)&&!action({action:'stop_move'},0)&&S.actionsLeft===1,'Stale steer/stop commands after drive ends rejected at 0 cost');
  S.buildings.push({id:++S.uid,owner:1,x:115,y:20,shape:'wall',hp:120});
  ok(action({action:'move',dir:1},0),'Start second drive toward wall');
  for(let i=0;i<180;i++)step(1/60);
  ok(t.x<=110.05&&t.fuel>=82-(110.05-106)-1e-3,'Wall blocks tank without teleporting and fuel only drains by actual distance moved');
  finishDrive();
  ok(S.turn===1,'Finishing 2nd setup action drive advances turn');
}
// Argon flotation and mesh lifecycle regression.
{
    setup();S.heights.fill(6);for(let x=20;x<=40;x++)S.heights[x]=13;for(let x=60;x<=80;x++)S.heights[x]=13;
    let tk=S.tanks[0];tk.x=38;tk.y=13;tk.fuel=100;tk.inv['Floating Platform']=1;tk.inv['Inflatable Lifejacket']=1;
    ok(!action({weaponOrItem:'Floating Platform'},0)&&!action({weaponOrItem:'Inflatable Lifejacket'},0)&&S.actionsLeft===2&&tk.inv['Floating Platform']===1&&tk.inv['Inflatable Lifejacket']===1,'Water gear automatic (0 manual cost)');
    ok(movementSpeed(tk,38)===6,'Ground speed 6 m/s');
    ok(action({action:'move',dir:1},0)&&S.activeDrive,'Start drive toward water');
    for(let i=0;i<220&&S.activeDrive;i++)step(1/60);
    ok(tk.waterGear==='platform'&&tk.inv['Floating Platform']===0&&tk.inv['Inflatable Lifejacket']===1&&movementSpeed(tk,50)===8&&tk.x>=60&&tk.y===13,'Platform preferred (8m/s), consumed once, crosses water onto shore');
    syncViews();let vw=views.get('t0');ok(vw&&vw.raft&&vw.ring&&!vw.raft.visible&&!vw.ring.visible,'Raft/ring hidden on dry land');
    tk.x=50;tk.y=WATER_LEVEL;syncViews();ok(vw.raft.visible&&!vw.ring.visible,'Raft visible while afloat');
    setup();S.heights.fill(6);let lj=S.tanks[0];lj.x=50;lj.y=36;lj.inv.Parachute=0;lj.inv['Floating Platform']=0;lj.inv['Inflatable Lifejacket']=1;
    for(let i=0;i<180;i++)step(1/60);
    ok(lj.waterGear==='lifejacket'&&lj.inv['Inflatable Lifejacket']===0&&lj.y===WATER_LEVEL&&lj.hp===100&&movementSpeed(lj,50)===3,'Lifejacket auto-deploys on fall into water (3m/s)');
    syncViews();let vw2=views.get('t0');ok(vw2&&vw2.ring.visible&&!vw2.raft.visible,'Ring visible while lifejacket tank afloat');
    let floatDisposals=0;vw2.raft.geometry.addEventListener('dispose',()=>floatDisposals++);vw2.ring.geometry.addEventListener('dispose',()=>floatDisposals++);originalClearViews();ok(views.size===0&&floatDisposals===2,'clearViews disposes raft and ring geometries');
    newRound();ok(!S.tanks[0].waterGear,'waterGear resets on newRound');
    setup();S.heights.fill(6);let unp=S.tanks[0];unp.x=50;unp.y=36;unp.inv.Parachute=0;unp.inv['Floating Platform']=0;unp.inv['Inflatable Lifejacket']=0;
    for(let i=0;i<180;i++)step(1/60);
    ok(!unp.waterGear&&unp.y===6&&unp.hp<100,'Unprotected tank sinks and takes fall damage');
    setup();S.actionLog=[];
}
// Effective shoreline support and no midair drive teleport.
{
setup();t=current();S.heights.fill(1);for(let x=0;x<=99;x++)S.heights[x]=18;t.x=99;t.y=18;
ok(action({action:'move',dir:1},0),'Flotation permits six-meter shore-to-water drop despite deep floor');for(let i=0;i<120;i++)step(1/60);ok(t.x>106&&t.y===12,'Tank crosses steep submerged floor at water surface');finishDrive();
setup();t=current();t.y=50;let oldFuel=t.fuel;ok(!action({action:'move',dir:1},0)&&S.actionsLeft===2&&t.y===50&&t.fuel===oldFuel,'Airborne movement rejected without teleport or cost');
setup();t=current();action({action:'move',dir:1},0);for(let i=0;i<30;i++)step(1/60);let xpos=t.x;S.heights.fill(1);step(1/60);ok(!S.activeDrive&&t.x===xpos&&t.y>12&&t.falling,'Losing ground support ends driving and preserves falling physics');
}
// Independent water safety and movement checks.
{
setup();t=current();S.heights.fill(1);t.x=100;t.y=40;t.inv.Parachute=0;let p=t.inv['Floating Platform'],j=t.inv['Inflatable Lifejacket'];S.turn=1;
for(let i=0;i<180;i++)step(1/60);
ok(t.y===WATER_LEVEL&&t.hp===100&&t.waterGear==='platform','Off-turn fall automatically floats without damage');
ok(t.inv['Floating Platform']===p-1&&t.inv['Inflatable Lifejacket']===j&&S.actionsLeft===2,'Preferred platform consumes exactly one stock and zero actions');
for(let i=0;i<120;i++)step(1/60);ok(t.inv['Floating Platform']===p-1,'Remaining afloat does not consume repeated stock');
setup();t=current();S.heights.fill(1);t.y=1;t.inv['Floating Platform']=0;step(1/60);
ok(t.waterGear==='lifejacket'&&t.y===12&&movementSpeed(t)===3,'Lifejacket rescues submerged tank and uses slow water speed');
setup();t=current();S.heights.fill(1);t.y=1;t.inv['Floating Platform']=0;t.inv['Inflatable Lifejacket']=0;step(1/60);ok(!t.waterGear&&t.y===1,'No free flotation without purchased equipment');
setup();t=current();S.heights.fill(1);t.x=100;t.y=12;t.waterGear='platform';action({action:'move',dir:1},0);for(let i=0;i<60;i++)step(1/60);ok(Math.abs(t.x-108)<.001,'Platform drives 8m in one second');finishDrive();
setup();t=current();S.heights.fill(1);t.x=100;t.y=12;t.waterGear='lifejacket';action({action:'move',dir:1},0);for(let i=0;i<60;i++)step(1/60);ok(Math.abs(t.x-103)<.001,'Lifejacket swims 3m in one second');finishDrive();
}
// Purchasable bridges share deck collision, persistence and destruction rules.
{
setup();t=current();let stock=t.inv['Deployable Bridge'];
ok(action({weaponOrItem:'Deployable Bridge',angle:45},0)&&S.platforms.length===1&&S.actionsLeft===1&&t.inv['Deployable Bridge']===stock-1,'Bridge deployment spends exactly one item and one action');
let deck=S.platforms[0];ok(deck.width===40&&supportHeight(deck.x)===deck.y,'Bridge supports tanks through existing deck system');
ok(!action({weaponOrItem:'Deployable Bridge',angle:45},0)&&S.actionsLeft===1&&t.inv['Deployable Bridge']===stock-1,'Overlapping bridge rejected before spending');
setup();t=current();t.x=6;stock=t.inv['Deployable Bridge'];ok(!action({weaponOrItem:'Deployable Bridge',angle:135},0)&&t.inv['Deployable Bridge']===stock&&S.actionsLeft===2,'Out-of-bounds bridge rejected before spending');
setup();t=current();S.platforms=Array.from({length:MAX_PLATFORMS},(_,i)=>({id:i+1,x:300,y:20,width:12,hp:140}));ok(!action({weaponOrItem:'Deployable Bridge'},0)&&S.actionsLeft===2,'Bridge respects global platform cap');
}
// Stopping before displacement must record an honest zero-distance action.
setup();S.actionLog=[];t=current();t.x=100;
ok(action({action:'move',dir:1},0),'Start drive for immediate-stop logging');
ok(!steerDrive({dir:-1},0),'Steering requires exact active movement identifier');
steerDrive({stop:true,moveId:S.activeDrive.id},0);
ok(S.actionLog.length===1&&S.actionLog[0].dx===0&&S.actionLog[0].distance===0&&S.actionLog[0].duration===0,'Immediate stop logs zero displacement without inventing movement');
// --- Client actionLog hook recording for all action kinds & items ---
setup();S.actionLog=[];
for(let[name,w]of Object.entries(WEAPONS_CONFIG)){
  if(['chute','floatplat','lifejacket'].includes(w.kind))continue;
  S.turn=0;S.phase='aim';S.actionsLeft=2;S.satellites=[];S.buildings=[];S.drones=[];S.shots=[];
  S.tanks[0].inv[name]=5;
  let beforeLen=S.actionLog.length;
  let callArg={action:'fire',weaponOrItem:name};
  if(w.kind!=='building'&&w.kind!=='shield'&&w.kind!=='mag'&&w.kind!=='battery'&&w.kind!=='fuel'){callArg.angle=50;callArg.power=620;callArg.az=5}
  if(w.kind==='drone'||w.kind==='satellite')callArg.targetX=140;
  ok(action(callArg,0),'Client hook test action succeeds for '+name);
  ok(S.actionLog.length===beforeLen+1,'Client hook pushes 1 entry per call for '+name);
  let rec=S.actionLog[S.actionLog.length-1];
  ok(rec.actor===0&&rec.action==='fire'&&rec.weaponOrItem===name,'Client hook records actor/action/weaponOrItem for '+name);
  ok(Number.isFinite(rec.angle)&&rec.angle>0&&Number.isFinite(rec.power)&&rec.power>0,'Client hook records effective non-zero angle/power for '+name);
}
S.turn=0;S.phase='aim';S.actionsLeft=2;S.tanks[0].x=40;S.tanks[0].fuel=100;
ok(action({action:'move',dir:1},0),'Client hook timed move action succeeds');
let moveId=S.activeDrive.id,logLenBeforeSteer=S.actionLog.length;
for(let i=0;i<60;i++)step(1/60);
ok(steerDrive({dir:-1,moveId},0),'Direction change during timed drive succeeds');
for(let i=0;i<18;i++)step(1/60);
ok(steerDrive({stop:true,moveId},0),'Early stop during timed drive succeeds');
ok(S.actionLog.length===logLenBeforeSteer,'Direction change and stop do not add extra actionLog entries');
let moveRec=S.actionLog[S.actionLog.length-1];
ok(moveRec.action==='move'&&moveRec.dx>0&&moveRec.distance>moveRec.dx&&moveRec.duration>0&&moveRec.weaponOrItem===undefined,'Client hook updates move entry with net dx, distance, and duration');
S.turn=0;S.phase='aim';S.actionsLeft=2;S.satellites=[{id:7,owner:0,x:140,y:190,z:0,hp:60,maxHp:60,cooldown:0}];
ok(action({action:'sat_strike',weaponOrItem:'Satellite Laser Strike',targetX:140},0),'Client hook sat_strike succeeds');
let strikeRec=S.actionLog[S.actionLog.length-1];
ok(strikeRec.action==='sat_strike'&&strikeRec.weaponOrItem==='Satellite Laser Strike'&&strikeRec.targetX===140,'Client hook records sat_strike with targetX and Satellite Laser Strike');
S.turn=0;S.phase='aim';S.actionsLeft=2;S.buildings=[{id:8,owner:0,x:52,y:20,shape:'silo',hp:85,charges:1}];S.satellites=[{id:9,owner:1,x:160,y:190,z:0,hp:60,maxHp:60,cooldown:0}];
ok(action({action:'silo_launch',weaponOrItem:'ASAT Silo Launch',targetSatId:9},0),'Client hook silo_launch succeeds');
let siloRec=S.actionLog[S.actionLog.length-1];
ok(siloRec.action==='silo_launch'&&siloRec.weaponOrItem==='ASAT Silo Launch'&&siloRec.targetSatId===9,'Client hook records silo_launch with ASAT Silo Launch and targetSatId');
globalThis.__vmClientRecordedLog=JSON.parse(JSON.stringify(S.actionLog));
// Local computer aim uses estimates and observed misses, not terrain trajectory search.
setup();S.cfg.difficulty='Normal';let oldHeight=height,oldPlatformCollision=platformCollision;
try{height=()=>{throw Error('AI read hidden terrain')};platformCollision=()=>{throw Error('AI traced platform collision')};let guess=estimate(current(),S.tanks[1]);ok(Number.isFinite(guess.angle)&&Number.isFinite(guess.power),'AI estimates without reading terrain/collision geometry')}finally{height=oldHeight;platformCollision=oldPlatformCollision}
let shooter=current();shooter.aiPlan={targetId:1,targetX:140};recordAiImpact(0,100);ok(shooter.aiMem[1].corrX>0,'Observed undershoot corrects aim toward target');
shooter.aiMem={};shooter.aiPlan={targetId:1,targetX:140};recordAiImpact(0,180);ok(shooter.aiMem[1].corrX<0,'Observed overshoot corrects aim back toward target');
shooter.aiPlan={targetId:1,targetX:140};action({weaponOrItem:'Standard Shield',angle:45,power:500});ok(shooter.aiPlan===null,'Equipment never arms ballistic feedback');
let averageMiss={};for(let level of ['Easy','Normal','Hard']){let sum=0;for(let n=1;n<=32;n++){setup();seed=n*8191;S.cfg.difficulty=level;S.wind=(n%13)-6;let bot=current(),target=S.tanks[1];target.x=210;target.shield=180;let guess=estimate(bot,target),profile=aiProfile(level);bot.aiPlan={targetId:1,targetX:target.x,biasRange:guess.biasRange,biasWind:guess.biasWind};action({weaponOrItem:'Baby Missile',angle:clamp(guess.angle+(rng()-.5)*2*profile.angleJitter,5,175),power:clamp(guess.power+(rng()-.5)*2*profile.powerJitter,100,1000)},0);for(let f=0;f<1500&&S.phase==='flight';f++)step(1/60);sum+=Math.abs(bot.aiMem[1]?.lastMissX??480)}averageMiss[level]=sum/32}
ok(averageMiss.Easy>averageMiss.Normal&&averageMiss.Normal>averageMiss.Hard,'Difficulty separates observed average miss distance over 32 seeded shots');
ok(averageMiss.Normal>5,'Normal computer retains meaningful aiming error');
console.log(checks+' simulation checks passed across '+Object.keys(WEAPONS_CONFIG).length+' items.');
`;
vm.runInContext(test,context,{timeout:30000});
const simChecks = vm.runInContext('checks', context);

// --- Catalog Drift & Client<->Server Validator Round-Trip Verification ---
{
  const {
    SHOT_WEAPONS,
    DRONE_WEAPONS,
    SATELLITE_WEAPONS,
    STRUCTURE_WEAPONS,
    EQUIPMENT_WEAPONS,
    SPECIAL_ACTION_WEAPONS,
    ALLOWED_WEAPONS,
    validateAndCanonicalizeAttestation
  } = require('../scripts/api.cjs');

  const htmlText = fs.readFileSync('index.html', 'utf8');
  const weaponsCfgMatch = htmlText.match(/const WEAPONS_CONFIG=\{([\s\S]*?)\r?\n\};/);
  assert(weaponsCfgMatch, 'Could not locate WEAPONS_CONFIG in index.html');
  const parsedConfigNames = [];
  const keyRe = /^\s*(?:'([^']+)'|"([^"]+)")\s*:\s*\{/gm;
  let m;
  while ((m = keyRe.exec(weaponsCfgMatch[1])) !== null) {
    parsedConfigNames.push(m[1] ?? m[2]);
  }
  assert.strictEqual(parsedConfigNames.length, 43, `Expected 43 items in WEAPONS_CONFIG, found ${parsedConfigNames.length}`);

  const refreshMatch = htmlText.match(/function refreshWeapons\(\)\{[^\r\n]*\}/);
  assert(refreshMatch, 'Could not locate refreshWeapons() in index.html');
  const specialOptionNames = [];
  const optRe = /o\.value='([^']+)'/g;
  while ((m = optRe.exec(refreshMatch[0])) !== null) {
    specialOptionNames.push(m[1]);
  }
  assert(
    specialOptionNames.includes('Satellite Laser Strike') && specialOptionNames.includes('ASAT Silo Launch'),
    'Expected refreshWeapons() to offer Satellite Laser Strike and ASAT Silo Launch'
  );

  const allClientNames = [...parsedConfigNames, ...specialOptionNames];
  const categorySets = [
    SHOT_WEAPONS,
    DRONE_WEAPONS,
    SATELLITE_WEAPONS,
    STRUCTURE_WEAPONS,
    EQUIPMENT_WEAPONS,
    SPECIAL_ACTION_WEAPONS
  ];

  const missingFromAllowed = allClientNames.filter(n => !ALLOWED_WEAPONS.has(n));
  assert.strictEqual(
    missingFromAllowed.length,
    0,
    `Catalog drift: client weapons/items missing from ALLOWED_WEAPONS: ${missingFromAllowed.join(', ')}`
  );

  for (const name of allClientNames) {
    const memberships = categorySets.filter(s => s.has(name)).length;
    assert.strictEqual(memberships, 1, `Expected "${name}" to belong to exactly 1 category set, found ${memberships}`);
  }

  const syntheticMatch = {
    id: 'drift-match',
    nonce: 'drift-nonce',
    nonceUsed: false,
    status: 'pending',
    roundNumber: 1,
    participants: [
      { slot: 0, userId: 'u0', name: 'P0', ai: false },
      { slot: 1, userId: 'u1', name: 'P1', ai: false }
    ]
  };
  const syntheticOutcomes = [
    { slot: 0, kills: 1, finalHp: 90 },
    { slot: 1, kills: 0, finalHp: 0 }
  ];

  const rejectedByValidator = [];
  for (const name of allClientNames) {
    let entry;
    if (name === 'Satellite Laser Strike') {
      entry = { actor: 0, action: 'sat_strike', weaponOrItem: name, targetX: 200 };
    } else if (name === 'ASAT Silo Launch') {
      entry = { actor: 0, action: 'silo_launch', weaponOrItem: name, targetSatId: 2 };
    } else if (DRONE_WEAPONS.has(name) || SATELLITE_WEAPONS.has(name)) {
      entry = { actor: 0, action: 'fire', weaponOrItem: name, targetX: 180 };
    } else if (STRUCTURE_WEAPONS.has(name) || EQUIPMENT_WEAPONS.has(name)) {
      entry = { actor: 0, action: 'fire', weaponOrItem: name };
    } else {
      entry = { actor: 0, action: 'fire', weaponOrItem: name, angle: 45, power: 650, az: 0, targetX: 140 };
    }
    const res = validateAndCanonicalizeAttestation(syntheticMatch, {
      nonce: 'drift-nonce',
      winnerSlot: 0,
      durationMs: 5000,
      actionLog: [entry],
      outcomes: syntheticOutcomes
    });
    if (!res.ok) rejectedByValidator.push(`${name} (${res.reason})`);
  }
  assert.strictEqual(
    rejectedByValidator.length,
    0,
    `Validator rejected client catalog items: ${rejectedByValidator.join('; ')}`
  );

  // Verify the entire client-recorded log from the VM round-trips cleanly through the server validator
  const clientLog = context.__vmClientRecordedLog;
  assert(Array.isArray(clientLog) && clientLog.length >= 41, 'Expected VM client actionLog to contain all actionable items + move/sat_strike/silo_launch');
  const rtRes = validateAndCanonicalizeAttestation(syntheticMatch, {
    nonce: 'drift-nonce',
    winnerSlot: 0,
    durationMs: 12000,
    actionLog: clientLog,
    outcomes: syntheticOutcomes
  });
  assert(rtRes.ok, `Client-recorded actionLog failed server validation: ${rtRes.reason}`);

  for (const entry of [{actor:0,action:'move',dx:0,distance:0,duration:0},{actor:0,action:'move',dx:0,distance:12,duration:2},{actor:0,action:'move',dx:240,distance:240,duration:30}]) {
    const result=validateAndCanonicalizeAttestation(syntheticMatch,{nonce:'drift-nonce',winnerSlot:0,durationMs:5000,actionLog:[entry],outcomes:syntheticOutcomes});
    assert(result.ok, 'Stopped and reversed timed drives remain valid ranked records');
  }
  // Negative checks: unknown weapons and out-of-range fields must still be rejected
  const badEntries = [
    [{ actor: 0, action: 'fire', weaponOrItem: 'Quantum Singularity Cannon', angle: 45, power: 500, az: 0 }],
    [{ actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike', targetX: -1 }],
    [{ actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike', targetX: 481 }],
    [{ actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike' }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 181, power: 500, az: 0 }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 1001, az: 0 }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: 25 }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: 0, targetX: 500 }],
    [{ actor: 0, action: 'move', dx: 0 }],
    [{ actor: 0, action: 'move', dx: 241 }],
    [{ actor: 0, action: 'silo_launch', weaponOrItem: 'ASAT Silo Launch', targetSatId: -2 }]
  ];
  for (const badLog of badEntries) {
    const neg = validateAndCanonicalizeAttestation(syntheticMatch, {
      nonce: 'drift-nonce',
      winnerSlot: 0,
      durationMs: 5000,
      actionLog: badLog,
      outcomes: syntheticOutcomes
    });
    assert(!neg.ok, `Expected validator to reject invalid log entry: ${JSON.stringify(badLog[0])}`);
  }
}

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
    google: { sub: 'g-101', name: 'Google Commander', email: 'gcmd@example.com', email_verified: true, picture: 'https://example.com/g.png' },
    discord: { id: 'd-202', username: 'discord_cmd', email: 'dcmd@example.com', verified: true },
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
    apiOk(
      unverifiedLogin.status === 200 &&
        unverifiedLogin.data.token &&
        unverifiedLogin.data.emailVerified === false &&
        unverifiedLogin.data.user.emailVerified === false,
      'Unverified user can login for unranked play and receives emailVerified:false'
    );

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
      const expectedVerified = p === 'google' || p === 'discord';
      apiOk(
        cbRes.status === 200 && cbRes.data.token && cbRes.data.user.emailVerified === expectedVerified,
        `Configured ${p} callback provisions/signs in user (emailVerified=${expectedVerified})`
      );
    }

    // 3b. OAuth pre-account takeover defenses:
    // (i) Verified provider email linking to an unverified squatter account wipes squatter password, TOTP, and sessions
    {
      const origGoogleProfile = { ...mockOAuthProfiles.google };
      try {
        const squatterReg = await req('/api/auth/register', {
          method: 'POST',
          body: { username: 'squatter_victim', email: 'victim@example.com', password: 'SquatterPassword1!' }
        });
        apiOk(squatterReg.status === 201, 'Squatter registers victim@example.com (unverified)');

        const squatterLogin = await req('/api/auth/login', {
          method: 'POST',
          body: { username: 'squatter_victim', password: 'SquatterPassword1!' }
        });
        apiOk(
          squatterLogin.status === 200 && squatterLogin.data.token && squatterLogin.data.user.emailVerified === false,
          'Squatter logs in to unverified victim@example.com account'
        );
        const squatterToken = squatterLogin.data.token;
        const victimAccountId = squatterLogin.data.user.id;

        const sqTotpSetup = await req('/api/auth/totp/setup', { method: 'POST', token: squatterToken });
        const sqTotpEnable = await req('/api/auth/totp/enable', {
          method: 'POST',
          token: squatterToken,
          body: { code: generateTotpCode(sqTotpSetup.data.secret) }
        });
        apiOk(sqTotpEnable.status === 200 && sqTotpEnable.data.totpEnabled === true, 'Squatter enables TOTP on unverified account');

        mockOAuthProfiles.google = {
          sub: 'g-victim-999',
          name: 'Real Victim',
          email: 'victim@example.com',
          email_verified: true,
          picture: 'https://example.com/victim.png'
        };
        const gStart = await req('/api/auth/oauth/google/start');
        const gCb = await req(`/api/auth/oauth/google/callback?code=victimcode&state=${encodeURIComponent(gStart.data.state)}`);
        apiOk(
          gCb.status === 200 &&
            gCb.data.user.id === victimAccountId &&
            gCb.data.user.emailVerified === true &&
            gCb.data.user.totpEnabled === false,
          'Verified Google OAuth links to existing unverified account, marks verified, and disables squatter TOTP'
        );

        const squatterMeAfter = await req('/api/auth/me', { token: squatterToken });
        apiOk(squatterMeAfter.status === 401, 'Squatter pre-existing session is invalidated upon verified OAuth link');

        const squatterPassLoginAfter = await req('/api/auth/login', {
          method: 'POST',
          body: { username: 'squatter_victim', password: 'SquatterPassword1!' }
        });
        apiOk(squatterPassLoginAfter.status === 401, 'Squatter password login is rejected after verified OAuth takeover cleanup');

        const storedVictim = await server.store.getUserById(victimAccountId);
        apiOk(storedVictim.passwordHash === null && storedVictim.totpEnabled === false, 'Squatter passwordHash is cleared in store');
      } finally {
        mockOAuthProfiles.google = origGoogleProfile;
      }
    }

    // (ii) Unverified provider email (e.g. Facebook or Google with email_verified:false) never links to existing account by email
    {
      const origFbProfile = { ...mockOAuthProfiles.facebook };
      try {
        const targetReg = await req('/api/auth/register', {
          method: 'POST',
          body: { username: 'target_owner', email: 'target@example.com', password: 'TargetPassword1!' }
        });
        apiOk(targetReg.status === 201, 'Target user registers target@example.com');
        const targetUser = await server.store.getUserByEmail('target@example.com');

        mockOAuthProfiles.facebook = {
          id: 'fb-unverified-777',
          name: 'FB Attacker',
          email: 'target@example.com'
        };
        const fbStart = await req('/api/auth/oauth/facebook/start');
        const fbCb = await req(`/api/auth/oauth/facebook/callback?code=fbcode&state=${encodeURIComponent(fbStart.data.state)}`);
        apiOk(
          fbCb.status === 200 &&
            fbCb.data.user.id !== targetUser.id &&
            fbCb.data.user.email === 'facebook_fb-unverified-777@oauth.local' &&
            fbCb.data.user.emailVerified === false,
          'Unverified provider email does not link to existing account and creates separate unverified account with fallback email'
        );

        const targetLogin = await req('/api/auth/login', {
          method: 'POST',
          body: { username: 'target_owner', password: 'TargetPassword1!' }
        });
        apiOk(
          targetLogin.status === 200 && targetLogin.data.user.id === targetUser.id,
          'Original target@example.com account remains untouched and can still log in with its password'
        );
      } finally {
        mockOAuthProfiles.facebook = origFbProfile;
      }
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

    // 5e-bis. Concurrent parallel final attestations (CAS prevents double-counted wins/kills/matchesPlayed)
    {
      const beforeLb = await req('/api/leaderboard');
      const alphaBefore = beforeLb.data.leaderboard.find(e => e.username === 'alpha');
      const bravoBefore = beforeLb.data.leaderboard.find(e => e.username === 'bravo');

      const startConcurrent = await req('/api/matches/start', {
        method: 'POST',
        token: alphaToken,
        body: {
          roomCode: 'CHARRED-CAS001',
          mode: 'online',
          round: 1,
          participants: [
            { slot: 0, userId: alphaId, name: 'Alpha Prime', ai: false },
            { slot: 1, userId: bravoId, name: 'Commander Bravo', ai: false }
          ]
        }
      });
      const firstAttest = await req(`/api/matches/${startConcurrent.data.matchId}/attest`, {
        method: 'POST',
        token: alphaToken,
        body: {
          nonce: startConcurrent.data.nonce,
          winnerSlot: 0,
          durationMs: 14000,
          actionLog: validActionLog,
          outcomes: alphaWinsOutcomes
        }
      });
      apiOk(firstAttest.status === 202, 'CAS test: first participant attestation accepted as pending');

      // Duplicate attestation by the same participant before opponent attests must be rejected
      const dupParticipantAttest = await req(`/api/matches/${startConcurrent.data.matchId}/attest`, {
        method: 'POST',
        token: alphaToken,
        body: {
          nonce: startConcurrent.data.nonce,
          winnerSlot: 0,
          durationMs: 14000,
          actionLog: validActionLog,
          outcomes: alphaWinsOutcomes
        }
      });
      apiOk(dupParticipantAttest.status === 409, 'Duplicate attestation from already-attested participant rejected with 409');

      // Fire 6 parallel final attestations (Bravo x4 + Alpha replay x2) with Promise.all
      const parallelAttests = await Promise.all(
        [bravoToken, bravoToken, bravoToken, bravoToken, alphaToken, alphaToken].map(tok =>
          req(`/api/matches/${startConcurrent.data.matchId}/attest`, {
            method: 'POST',
            token: tok,
            body: {
              nonce: startConcurrent.data.nonce,
              winnerSlot: 0,
              durationMs: 14200,
              actionLog: validActionLog,
              outcomes: alphaWinsOutcomes
            }
          })
        )
      );
      const ok200 = parallelAttests.filter(r => r.status === 200 && r.data.status === 'verified');
      const rejected409 = parallelAttests.filter(r => r.status === 409);
      apiOk(
        ok200.length === 1 && rejected409.length === parallelAttests.length - 1,
        'Parallel final attestations finalize match exactly once (1x 200 verified, rest 409)'
      );

      const afterLb = await req('/api/leaderboard');
      const alphaAfter = afterLb.data.leaderboard.find(e => e.username === 'alpha');
      const bravoAfter = afterLb.data.leaderboard.find(e => e.username === 'bravo');
      apiOk(
        alphaAfter.wins === alphaBefore.wins + 1 &&
          alphaAfter.kills === alphaBefore.kills + 1 &&
          alphaAfter.matchesPlayed === alphaBefore.matchesPlayed + 1 &&
          bravoAfter.losses === bravoBefore.losses + 1 &&
          bravoAfter.matchesPlayed === bravoBefore.matchesPlayed + 1,
        'Parallel final attestations increment wins, kills, losses, and matchesPlayed by exactly 1'
      );
    }

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
    apiOk(top.username === 'alpha' && top.wins === 2 && top.kills === 2 && top.rank === 1, 'Leaderboard ranks Alpha #1 with 2 verified wins');
    apiOk(bravoEntry && bravoEntry.wins === 0 && bravoEntry.losses === 2, 'Bravo has 0 multiplayer wins (bot match excluded from leaderboard wins)');

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

      // Wait for window expiry, then enable TRUST_PROXY=1 (1 trusted hop from the right end)
      await new Promise(r => setTimeout(r, 60));
      rlEnv.TRUST_PROXY = '1';
      // Rotating fake left-most XFF entries with the same right-most proxy-appended IP (198.51.100.10) must NOT change the key
      const spoof1 = await callAuth('203.0.113.1, 198.51.100.10');
      const spoof2 = await callAuth('203.0.113.2, 198.51.100.10');
      const spoof3 = await callAuth('203.0.113.3, 198.51.100.10');
      apiOk(
        spoof1 === 401 && spoof2 === 401 && spoof3 === 429,
        'With TRUST_PROXY=1, client-supplied left-most X-Forwarded-For values cannot change the rate-limit key'
      );

      const p1 = await callAuth('198.51.100.20');
      const p2 = await callAuth('198.51.100.30');
      apiOk(p1 === 401 && p2 === 401, 'With TRUST_PROXY=1, distinct right-most forwarded client IPs have independent buckets');
      apiOk(rlApi.rateLimitMapSize >= 3, 'Rate-limit map tracks active client IPs');

      // TRUST_PROXY=2: takes 2nd entry from the right end; falls back to socket IP if list is shorter than 2 hops
      const { getClientIp } = require('../scripts/api.cjs');
      apiOk(
        getClientIp(
          { headers: { 'x-forwarded-for': '203.0.113.99, 198.51.100.77, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.2' } },
          { TRUST_PROXY: '2' }
        ) === '198.51.100.77',
        'With TRUST_PROXY=2, getClientIp selects the entry 2 places from the right end'
      );
      apiOk(
        getClientIp(
          { headers: { 'x-forwarded-for': '198.51.100.77' }, socket: { remoteAddress: '10.0.0.2' } },
          { TRUST_PROXY: '2' }
        ) === '10.0.0.2',
        'When X-Forwarded-For has fewer entries than TRUST_PROXY hops, getClientIp falls back to socket address'
      );

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

      // Parallel wrong-guess race: 20 parallel wrong guesses followed by the real code must be refused
      const regRace = await req('/api/auth/register', {
        method: 'POST',
        body: { username: 'racecapuser', email: 'racecap@example.com', password: 'Password123!' }
      });
      const raceValidCode = regRace.data.devVerificationCode;
      const parallelWrong = await Promise.all(
        Array.from({ length: 20 }, (_, idx) =>
          req('/api/auth/verify-email', {
            method: 'POST',
            body: { username: 'racecapuser', code: String(100000 + idx) }
          })
        )
      );
      apiOk(
        parallelWrong.every(r => r.status === 400),
        'All 20 parallel wrong email verification guesses are rejected with 400'
      );
      const afterRaceValid = await req('/api/auth/verify-email', {
        method: 'POST',
        body: { username: 'racecapuser', code: raceValidCode }
      });
      apiOk(
        afterRaceValid.status === 400 && afterRaceValid.data.code === 'email_verify_invalidated',
        'After 20 parallel wrong guesses, the correct verification code is refused with email_verify_invalidated'
      );

      // Parallel burst of 30 guesses where index 20 carries the CORRECT code (after >= 5 wrong ones):
      // at most 5 comparisons may happen per code, and the account must remain unverified.
      // (Checked on Both SQLite and async MySQL store so requests concurrently enter the route before attempt #5 invalidates.)
      const authMod = require('../scripts/auth.cjs');
      const origVerifyEmailCodeHash = authMod.verifyEmailCodeHash;
      let compareCalls = 0;
      authMod.verifyEmailCodeHash = function (...args) {
        compareCalls++;
        return origVerifyEmailCodeHash.apply(this, args);
      };
      try {
        const regBurst = await req('/api/auth/register', {
          method: 'POST',
          body: { username: 'burstcapuser', email: 'burstcap@example.com', password: 'Password123!' }
        });
        const burstValidCode = regBurst.data.devVerificationCode;
        const origGetByUser = server.store.getUserByUsername.bind(server.store);
        server.store.getUserByUsername = async (u) => {
          const res = await origGetByUser(u);
          if (String(u).toLowerCase() === 'burstcapuser') {
            await new Promise(r => setImmediate(r));
          }
          return res;
        };
        try {
          compareCalls = 0;
          const burstResponses = await Promise.all(
            Array.from({ length: 30 }, (_, idx) => {
              const guess = idx === 20 ? burstValidCode : String((Number(burstValidCode) + idx + 1) % 900000 + 100000).padStart(6, '0');
              return req('/api/auth/verify-email', {
                method: 'POST',
                body: { username: 'burstcapuser', code: guess }
              });
            })
          );
          const burstUserAfter = await origGetByUser('burstcapuser');
          apiOk(
            compareCalls === 5 &&
              burstResponses.every(r => r.status === 400) &&
              burstUserAfter.emailVerified === false,
            `30-request parallel burst with valid code at index 20 performs at most 5 hash comparisons (got ${compareCalls}) and leaves account unverified`
          );
        } finally {
          server.store.getUserByUsername = origGetByUser;
        }
      } finally {
        authMod.verifyEmailCodeHash = origVerifyEmailCodeHash;
      }
      // Resend-code per-account rate limit (max 3 per window)
      const resend1 = await req('/api/auth/resend-code', { method: 'POST', body: { username: 'racecapuser' } });
      const resend2 = await req('/api/auth/resend-code', { method: 'POST', body: { username: 'racecapuser' } });
      const resend3 = await req('/api/auth/resend-code', { method: 'POST', body: { username: 'racecapuser' } });
      const resend4 = await req('/api/auth/resend-code', { method: 'POST', body: { username: 'racecapuser' } });
      apiOk(
        resend1.status === 200 && resend2.status === 200 && resend3.status === 200 &&
          resend4.status === 429 && resend4.data.code === 'resend_rate_limited',
        'POST /api/auth/resend-code is rate-limited per account to 3 requests per window (4th returns 429 resend_rate_limited)'
      );

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

      // Unverified login succeeds for unranked play and returns emailVerified:false
      const loginUnv = await req('/api/auth/login', {
        method: 'POST',
        body: { username: 'unverified_cmd', password: 'Password123!' }
      });
      apiOk(
        loginUnv.status === 200 &&
          loginUnv.data.token &&
          loginUnv.data.emailVerified === false &&
          loginUnv.data.user &&
          loginUnv.data.user.emailVerified === false,
        'Login with unverified account succeeds (200) and returns emailVerified:false'
      );

      // Unverified account with TOTP enabled still enforces TOTP on login and returns emailVerified:false
      const unvTotpSetup = await req('/api/auth/totp/setup', { method: 'POST', token: unvToken });
      const unvTotpEnable = await req('/api/auth/totp/enable', {
        method: 'POST',
        token: unvToken,
        body: { code: generateTotpCode(unvTotpSetup.data.secret) }
      });
      apiOk(unvTotpEnable.status === 200 && unvTotpEnable.data.totpEnabled, 'Unverified account can enable TOTP');

      const loginUnvNoTotp = await req('/api/auth/login', {
        method: 'POST',
        body: { username: 'unverified_cmd', password: 'Password123!' }
      });
      apiOk(
        loginUnvNoTotp.status === 401 && loginUnvNoTotp.data.requiresTotp === true,
        'Unverified account with TOTP enabled requires TOTP code on login'
      );

      const loginUnvWithTotp = await req('/api/auth/login', {
        method: 'POST',
        body: {
          username: 'unverified_cmd',
          password: 'Password123!',
          totpCode: generateTotpCode(unvTotpSetup.data.secret)
        }
      });
      apiOk(
        loginUnvWithTotp.status === 200 &&
          loginUnvWithTotp.data.token &&
          loginUnvWithTotp.data.emailVerified === false,
        'Unverified account with valid TOTP logs in (200) with emailVerified:false'
      );

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

    // (7) MySQL data layer (mysql2) selected when DB_HOST is set — fake-pool unit test (no live MySQL)
    {
      const envExample = fs.readFileSync(require.resolve('../.env.example'), 'utf8');
      const dbSrc = fs.readFileSync(require.resolve('../scripts/db.cjs'), 'utf8');
      const serveSrc = fs.readFileSync(require.resolve('../scripts/serve.cjs'), 'utf8');
      const testingDoc = fs.readFileSync(require.resolve('../docs/TESTING.md'), 'utf8');
      const legacyDbUrlKey = ['DATABASE', 'URL'].join('_');

      apiOk(
        !dbSrc.includes(legacyDbUrlKey) &&
          !serveSrc.includes(legacyDbUrlKey) &&
          !envExample.includes(legacyDbUrlKey) &&
          !testingDoc.includes(legacyDbUrlKey),
        'Legacy connection URL setting is removed from db.cjs, serve.cjs, .env.example, and docs/TESTING.md'
      );
      apiOk(/^DB_HOST=\s*$/m.test(envExample), '.env.example documents DB_HOST= with an empty placeholder');
      apiOk(/^DB_PORT=3306\s*$/m.test(envExample), '.env.example documents DB_PORT=3306 default');
      apiOk(/^DB_USER=\s*$/m.test(envExample), '.env.example documents DB_USER= with an empty placeholder');
      apiOk(/^DB_PASSWORD=''\s*$/m.test(envExample), ".env.example documents DB_PASSWORD='' with an empty quoted placeholder");
      apiOk(/^DB_NAME=\s*$/m.test(envExample), '.env.example documents DB_NAME= with an empty placeholder');
      const expectedDreamhostCaRel = 'certs/dreamhost-mysql-ca.pem';
      const expectedDreamhostCaFp = 'AC:EE:52:21:C1:59:E6:CF:F8:63:AD:EB:C3:B9:20:43:FF:3C:F9:8C:A0:E6:66:F4:01:D5:00:C0:E9:EC:80:BA';
      const expectedDreamhostServerPin = 'D5:6E:77:06:BF:66:B5:A8:76:40:8C:B5:02:06:90:16:25:99:5A:31:DA:32:99:08:BF:CD:DF:30:99:2B:35:0E';
      apiOk(
        /^#[^\n]*\r?\nDB_SSL=verify\s*$/m.test(envExample) &&
          /^#[^\n]*\r?\nDB_SSL_CA=certs\/dreamhost-mysql-ca\.pem\s*$/m.test(envExample) &&
          envExample.includes(`DB_SSL_FINGERPRINT=${expectedDreamhostServerPin}`) &&
          /^#[^\n]*\r?\nDB_SSL_FINGERPRINT=/m.test(envExample),
        '.env.example documents DB_SSL=verify, DB_SSL_CA=certs/dreamhost-mysql-ca.pem, and DB_SSL_FINGERPRINT with one-line comments'
      );
      apiOk(
        /#.*paste it between single quotes, exactly as it is[^\n]*\r?\n#[^\n]*\r?\nDB_PASSWORD=''/i.test(envExample) &&
          require('node:util').parseEnv("DB_PASSWORD='p#ss w0rd'").DB_PASSWORD === 'p#ss w0rd',
        '.env.example DB_PASSWORD says to single-quote the password, and a single-quoted # survives .env parsing'
      );
      apiOk(/^TRUST_PROXY=\s*$/m.test(envExample), '.env.example documents TRUST_PROXY= with an empty placeholder');

      // Real X.509 verification of the committed DreamHost MySQL CA certificate
      const nodeCrypto = require('node:crypto');
      const committedCaPem = fs.readFileSync(require.resolve('../certs/dreamhost-mysql-ca.pem'), 'utf8');
      const committedCaX509 = new nodeCrypto.X509Certificate(committedCaPem);
      apiOk(
        committedCaX509.fingerprint256.toUpperCase() === expectedDreamhostCaFp && committedCaX509.ca === true,
        'Committed certs/dreamhost-mysql-ca.pem parses as a valid X.509 CA with expected sha256 fingerprint AC:EE:...:80:BA'
      );

      const { openStore } = require('../scripts/db.cjs');
      const { loadProjectEnv } = require('../scripts/serve.cjs');

      // Backend selection: SQLite when DB_HOST is unset, MySQL when DB_HOST is set
      const sqliteDefaultStore = openStore({ env: {} });
      apiOk(sqliteDefaultStore.backend === 'sqlite', 'openStore selects sqlite backend when DB_HOST is unset');
      sqliteDefaultStore.close();

      // Pool options object, default TLS verify mode, & verbatim password checks
      const poolCalls = [];
      const noopPool = {
        async execute() { return [[], []]; },
        async end() {}
      };
      const createPoolSpy = opts => {
        poolCalls.push(opts);
        return noopPool;
      };
      const rawPassword = `  p@ss:w/rd#1%? &"'\`\\  `;
      const spyStoreDefaultPort = openStore({
        env: {
          DB_HOST: 'db.example.com',
          DB_USER: 'charred_user',
          DB_PASSWORD: rawPassword,
          DB_NAME: 'charred_db',
          DB_SSL_CA: expectedDreamhostCaRel,
          DB_SSL_FINGERPRINT: expectedDreamhostServerPin.toLowerCase()
        },
        createPool: createPoolSpy
      });
      await spyStoreDefaultPort.ready;
      apiOk(spyStoreDefaultPort.backend === 'mysql', 'openStore selects mysql backend when DB_HOST is set');
      apiOk(
        poolCalls.length === 1 &&
          typeof poolCalls[0] === 'object' &&
          poolCalls[0] !== null &&
          !Array.isArray(poolCalls[0]) &&
          poolCalls[0].host === 'db.example.com' &&
          poolCalls[0].port === 3306 &&
          poolCalls[0].user === 'charred_user' &&
          poolCalls[0].database === 'charred_db',
        'openStore builds mysql2 pool from { host, port: 3306, user, password, database } options object when DB_PORT is unset'
      );
      apiOk(
        poolCalls[0].password === rawPassword,
        'DB_PASSWORD with special characters (@ : / # % " \' \\ and spaces) is passed verbatim without URL encoding or trimming'
      );
      apiOk(
        Boolean(poolCalls[0].ssl) &&
          typeof poolCalls[0].ssl.ca === 'string' &&
          poolCalls[0].ssl.ca.includes('BEGIN CERTIFICATE') &&
          poolCalls[0].ssl.ca === committedCaPem &&
          poolCalls[0].ssl.rejectUnauthorized === true &&
          !('checkServerIdentity' in poolCalls[0].ssl) &&
          Object.keys(poolCalls[0].ssl).sort().join(',') === 'ca,rejectUnauthorized',
        'Default MySQL TLS mode (when DB_HOST is set and DB_SSL is omitted) is verify with ssl: { ca, rejectUnauthorized: true } and no inert checkServerIdentity option'
      );

      const spyStoreCustomPort = openStore({
        env: {
          DB_HOST: 'db.example.com',
          DB_PORT: '3307',
          DB_USER: 'charred_user',
          DB_PASSWORD: 'pw',
          DB_NAME: 'charred_db',
          DB_SSL: 'verify',
          DB_SSL_CA: expectedDreamhostCaRel
        },
        createPool: createPoolSpy
      });
      await spyStoreCustomPort.ready;
      apiOk(
        poolCalls.length === 2 &&
          poolCalls[1].port === 3307 &&
          poolCalls.every(arg => typeof arg !== 'string') &&
          Boolean(poolCalls[1].ssl) &&
          poolCalls[1].ssl.ca === committedCaPem &&
          poolCalls[1].ssl.rejectUnauthorized === true &&
          !('checkServerIdentity' in poolCalls[1].ssl),
        'openStore honours custom DB_PORT, never calls createPool with a URL string, and never passes checkServerIdentity on ssl config'
      );

      // Post-handshake certificate pin & TLS socket enforcement on a REAL TLS socket (tests/fixtures/tls)
      {
        const net = require('node:net');
        const tls = require('node:tls');
        const { buildMysqlSslConfig, verifyConnectionTls, wrapMysqlPool } = require('../scripts/db.cjs');
        const { runDbCheck } = require('../scripts/db-check.cjs');

        const fixtureCaRel = 'tests/fixtures/tls/test-only-ca.pem';
        const fixtureCaPem = fs.readFileSync(require.resolve('../tests/fixtures/tls/test-only-ca.pem'), 'utf8');
        const fixtureServerKeyPem = fs.readFileSync(require.resolve('../tests/fixtures/tls/test-only-server-key.pem'), 'utf8');
        const fixtureServerCertPem = fs.readFileSync(require.resolve('../tests/fixtures/tls/test-only-server-cert.pem'), 'utf8');
        const fixtureCaX509 = new nodeCrypto.X509Certificate(fixtureCaPem);
        const fixtureServerX509 = new nodeCrypto.X509Certificate(fixtureServerCertPem);
        const fixturePinUpper = fixtureServerX509.fingerprint256.toUpperCase();
        const wrongPin = '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';

        apiOk(
          fixtureCaX509.ca === true &&
            fixtureServerX509.verify(fixtureCaX509.publicKey) === true &&
            fixturePinUpper !== wrongPin,
          'Committed test-only TLS fixtures (tests/fixtures/tls/) contain a valid throwaway CA and server certificate'
        );

        const serverSockets = new Set();
        const tlsServer = tls.createServer(
          { key: fixtureServerKeyPem, cert: fixtureServerCertPem },
          sock => {
            serverSockets.add(sock);
            sock.on('error', () => {});
            sock.on('close', () => serverSockets.delete(sock));
          }
        );
        tlsServer.on('tlsClientError', () => {});
        await new Promise((resolve, reject) => {
          tlsServer.once('error', reject);
          tlsServer.listen(0, '127.0.0.1', resolve);
        });
        const tlsPort = tlsServer.address().port;

        const connectRealTls = sslOpts =>
          new Promise((resolve, reject) => {
            const sock = tls.connect({ host: '127.0.0.1', port: tlsPort, ...sslOpts });
            sock.once('secureConnect', () => resolve(sock));
            sock.once('error', reject);
          });

        try {
          // 1. Matching fingerprint on a real TLS socket is accepted (case-insensitive) and cached per core connection in WeakSet
          const matchSslCfg = buildMysqlSslConfig({
            env: {
              DB_SSL: 'verify',
              DB_SSL_CA: fixtureCaRel,
              DB_SSL_FINGERPRINT: fixturePinUpper.toLowerCase()
            }
          });
          const goodTlsSock = await connectRealTls(matchSslCfg.ssl);
          try {
            let getPeerCertCalls = 0;
            const origGetPeerCert = goodTlsSock.getPeerCertificate.bind(goodTlsSock);
            goodTlsSock.getPeerCertificate = (...args) => {
              getPeerCertCalls += 1;
              return origGetPeerCert(...args);
            };
            let goodDestroyed = false;
            let goodReleased = false;
            const coreConn = {
              stream: goodTlsSock,
              destroy() {
                goodDestroyed = true;
                goodTlsSock.destroy();
              }
            };
            const pooledWrapper1 = {
              connection: coreConn,
              destroy: () => coreConn.destroy(),
              release: () => { goodReleased = true; }
            };
            const pooledWrapper2 = {
              connection: coreConn,
              destroy: () => coreConn.destroy(),
              release: () => { goodReleased = true; }
            };
            const verifiedSet = new WeakSet();
            const tlsMetaGood = {
              sslMode: matchSslCfg.mode,
              caPath: matchSslCfg.caPath,
              fingerprint: matchSslCfg.fingerprint
            };
            verifyConnectionTls(pooledWrapper1, tlsMetaGood, verifiedSet);
            verifyConnectionTls(pooledWrapper2, tlsMetaGood, verifiedSet);
            apiOk(
              !goodDestroyed &&
                !goodReleased &&
                goodTlsSock.destroyed === false &&
                verifiedSet.has(coreConn) &&
                getPeerCertCalls === 1,
              'verifyConnectionTls accepts a real TLS socket with matching DB_SSL_FINGERPRINT (case-insensitive), keeps socket alive, and caches verification in WeakSet'
            );
          } finally {
            goodTlsSock.destroy();
          }

          // 2. Wrong fingerprint on a real TLS socket destroys the connection (never releases) and throws ERR_MYSQL_CERT_PIN_MISMATCH
          const mismatchSslCfg = buildMysqlSslConfig({
            env: {
              DB_SSL: 'verify',
              DB_SSL_CA: fixtureCaRel,
              DB_SSL_FINGERPRINT: wrongPin
            }
          });
          const badPinTlsSock = await connectRealTls(mismatchSslCfg.ssl);
          try {
            let badDestroyed = false;
            let badReleased = false;
            const badCoreConn = {
              stream: badPinTlsSock,
              destroy() {
                badDestroyed = true;
                badPinTlsSock.destroy();
              }
            };
            const badPooledWrapper = {
              connection: badCoreConn,
              destroy: () => badCoreConn.destroy(),
              release: () => { badReleased = true; }
            };
            let pinErr = null;
            try {
              verifyConnectionTls(
                badPooledWrapper,
                {
                  sslMode: mismatchSslCfg.mode,
                  caPath: mismatchSslCfg.caPath,
                  fingerprint: mismatchSslCfg.fingerprint
                },
                new WeakSet()
              );
            } catch (err) {
              pinErr = err;
            }
            apiOk(
              Boolean(pinErr) &&
                pinErr.code === 'ERR_MYSQL_CERT_PIN_MISMATCH' &&
                pinErr.message.includes('DB_SSL_FINGERPRINT') &&
                pinErr.message.includes(wrongPin) &&
                pinErr.message.includes(fixturePinUpper) &&
                pinErr.message.includes('DB_SSL_CA') &&
                badDestroyed === true &&
                badReleased === false &&
                badPinTlsSock.destroyed === true,
              'verifyConnectionTls on a real TLS socket with wrong DB_SSL_FINGERPRINT destroys the connection (never releases) and throws ERR_MYSQL_CERT_PIN_MISMATCH'
            );
          } finally {
            badPinTlsSock.destroy();
          }

          // 3. Plaintext net.Socket is refused and destroyed when DB_SSL is verify or require
          const plainServer = net.createServer(sock => {
            sock.on('error', () => {});
          });
          await new Promise((resolve, reject) => {
            plainServer.once('error', reject);
            plainServer.listen(0, '127.0.0.1', resolve);
          });
          const plainPort = plainServer.address().port;
          try {
            for (const modeUnderTest of ['verify', 'require']) {
              const plainSock = await new Promise((resolve, reject) => {
                const s = net.connect({ host: '127.0.0.1', port: plainPort }, () => resolve(s));
                s.once('error', reject);
              });
              let plainDestroyed = false;
              let plainReleased = false;
              const plainConn = {
                connection: {
                  stream: plainSock,
                  destroy() {
                    plainDestroyed = true;
                    plainSock.destroy();
                  }
                },
                destroy() {
                  plainDestroyed = true;
                  plainSock.destroy();
                },
                release() {
                  plainReleased = true;
                }
              };
              let plainErr = null;
              try {
                verifyConnectionTls(
                  plainConn,
                  { sslMode: modeUnderTest, caPath: fixtureCaRel, fingerprint: fixturePinUpper },
                  new WeakSet()
                );
              } catch (err) {
                plainErr = err;
              }
              apiOk(
                Boolean(plainErr) &&
                  plainErr.code === 'ERR_MYSQL_CERT_PIN_MISMATCH' &&
                  /not TLS/i.test(plainErr.message) &&
                  plainDestroyed === true &&
                  plainReleased === false &&
                  plainSock.destroyed === true,
                `verifyConnectionTls refuses a plaintext net.Socket when DB_SSL=${modeUnderTest}, destroys the connection, and throws ERR_MYSQL_CERT_PIN_MISMATCH`
              );
              plainSock.destroy();
            }
          } finally {
            await new Promise(resolve => plainServer.close(resolve));
          }

          // 4. Pool wrapper routes both pool.execute and pool.query through getConnection + pin check
          {
            const badWrapSock1 = await connectRealTls(mismatchSslCfg.ssl);
            const badWrapSock2 = await connectRealTls(mismatchSslCfg.ssl);
            try {
              const socks = [badWrapSock1, badWrapSock2];
              let getConnCount = 0;
              let destroyedCount = 0;
              let releasedCount = 0;
              let directExecuteCalls = 0;
              let directQueryCalls = 0;
              const stubWrongPinPool = wrapMysqlPool(
                {
                  async getConnection() {
                    const sock = socks[getConnCount] || badWrapSock2;
                    getConnCount += 1;
                    return {
                      connection: { stream: sock },
                      destroy() {
                        destroyedCount += 1;
                        sock.destroy();
                      },
                      release() {
                        releasedCount += 1;
                      },
                      async execute() { return [[{ ok: 1 }], []]; },
                      async query() { return [[{ ok: 1 }], []]; }
                    };
                  },
                  async execute() {
                    directExecuteCalls += 1;
                    return [[{ bypassed: 1 }], []];
                  },
                  async query() {
                    directQueryCalls += 1;
                    return [[{ bypassed: 1 }], []];
                  }
                },
                'PinTestSecret#99',
                { sslMode: 'verify', caPath: fixtureCaRel, fingerprint: wrongPin }
              );

              let execPinErr = null;
              try {
                await stubWrongPinPool.execute('SELECT 1', []);
              } catch (err) {
                execPinErr = err;
              }
              let queryPinErr = null;
              try {
                await stubWrongPinPool.query('SELECT 1');
              } catch (err) {
                queryPinErr = err;
              }
              apiOk(
                Boolean(execPinErr) &&
                  execPinErr.code === 'ERR_MYSQL_CERT_PIN_MISMATCH' &&
                  Boolean(queryPinErr) &&
                  queryPinErr.code === 'ERR_MYSQL_CERT_PIN_MISMATCH' &&
                  getConnCount === 2 &&
                  destroyedCount === 2 &&
                  releasedCount === 0 &&
                  directExecuteCalls === 0 &&
                  directQueryCalls === 0 &&
                  badWrapSock1.destroyed === true &&
                  badWrapSock2.destroyed === true,
                'wrapMysqlPool routes both pool.execute and pool.query through getConnection, rejecting wrong DB_SSL_FINGERPRINT and destroying the socket on both paths'
              );
            } finally {
              badWrapSock1.destroy();
              badWrapSock2.destroy();
            }

            const goodWrapSock = await connectRealTls(matchSslCfg.ssl);
            try {
              let getConnCalls = 0;
              let releaseCalls = 0;
              let destroyCalls = 0;
              let peerCertInspections = 0;
              const origPeerCert = goodWrapSock.getPeerCertificate.bind(goodWrapSock);
              goodWrapSock.getPeerCertificate = (...args) => {
                peerCertInspections += 1;
                return origPeerCert(...args);
              };
              const sharedCoreConn = {
                stream: goodWrapSock,
                destroy() {
                  destroyCalls += 1;
                  goodWrapSock.destroy();
                }
              };
              const stubGoodPinPool = wrapMysqlPool(
                {
                  async getConnection() {
                    getConnCalls += 1;
                    return {
                      connection: sharedCoreConn,
                      destroy: () => sharedCoreConn.destroy(),
                      release() {
                        releaseCalls += 1;
                      },
                      async execute(sql) {
                        return [[{ via: 'execute', sql }], []];
                      },
                      async query(sql) {
                        return [[{ via: 'query', sql }], []];
                      }
                    };
                  },
                  async execute() {
                    throw new Error('raw pool.execute should not be called directly when getConnection exists');
                  },
                  async query() {
                    throw new Error('raw pool.query should not be called directly when getConnection exists');
                  }
                },
                'PinTestSecret#99',
                { sslMode: 'verify', caPath: fixtureCaRel, fingerprint: fixturePinUpper }
              );

              const [execRows] = await stubGoodPinPool.execute('SELECT 1', []);
              const [queryRows] = await stubGoodPinPool.query('SELECT 2');
              apiOk(
                execRows[0].via === 'execute' &&
                  queryRows[0].via === 'query' &&
                  getConnCalls === 2 &&
                  releaseCalls === 2 &&
                  destroyCalls === 0 &&
                  peerCertInspections === 1 &&
                  goodWrapSock.destroyed === false,
                'wrapMysqlPool succeeds on pool.execute and pool.query when DB_SSL_FINGERPRINT matches, releasing each connection and checking the cached socket once'
              );
            } finally {
              goodWrapSock.destroy();
            }
          }

          // 5. npm run db:check (scripts/db-check.cjs) verification
          {
            const pkgJson = JSON.parse(fs.readFileSync(require.resolve('../package.json'), 'utf8'));
            apiOk(
              pkgJson.scripts && pkgJson.scripts['db:check'] === 'node scripts/db-check.cjs',
              'package.json defines "db:check": "node scripts/db-check.cjs"'
            );

            const dbCheckSock = await connectRealTls(matchSslCfg.ssl);
            try {
              const checkSecret = 'DbCheckTopSecret!42';
              const sharedCore = {
                stream: dbCheckSock,
                destroy: () => dbCheckSock.destroy()
              };
              const checkLines = [];
              const checkStore = openStore({
                env: {
                  DB_HOST: '127.0.0.1',
                  DB_PORT: String(tlsPort),
                  DB_USER: 'charred_user',
                  DB_PASSWORD: checkSecret,
                  DB_NAME: 'charred_db',
                  DB_SSL: 'verify',
                  DB_SSL_CA: fixtureCaRel,
                  DB_SSL_FINGERPRINT: fixturePinUpper
                },
                createPool() {
                  const runSql = async sql => {
                    const norm = String(sql).replace(/\s+/g, ' ').trim();
                    if (norm.startsWith('SHOW SESSION STATUS')) {
                      return [
                        [
                          { Variable_name: 'Ssl_version', Value: 'TLSv1.3' },
                          { Variable_name: 'Ssl_cipher', Value: 'TLS_AES_256_GCM_SHA384' }
                        ],
                        []
                      ];
                    }
                    if (norm.includes('information_schema.tables')) {
                      return [[{ cnt: 5 }], []];
                    }
                    return [[], []];
                  };
                  return {
                    async getConnection() {
                      return {
                        connection: sharedCore,
                        destroy: () => sharedCore.destroy(),
                        release() {},
                        execute: runSql,
                        query: runSql
                      };
                    },
                    execute: runSql,
                    query: runSql,
                    async end() {}
                  };
                }
              });

              const checkRes = await runDbCheck({
                env: { DB_PASSWORD: checkSecret },
                store: checkStore,
                log: line => checkLines.push(line)
              });
              apiOk(
                checkLines.length === 5 &&
                  checkLines[0] === 'backend: mysql' &&
                  checkLines[1] === 'Ssl_version: TLSv1.3' &&
                  checkLines[2] === 'Ssl_cipher: TLS_AES_256_GCM_SHA384' &&
                  checkLines[3] === 'pin matched: yes' &&
                  checkLines[4] === 'tables: 5' &&
                  checkRes.pinMatched === 'yes' &&
                  checkLines.every(l => !l.includes(checkSecret)),
                'scripts/db-check.cjs prints only backend, Ssl_version, Ssl_cipher, pin matched, and tables, and never prints DB_PASSWORD'
              );
            } finally {
              dbCheckSock.destroy();
            }
          }
        } finally {
          for (const s of serverSockets) {
            try { s.destroy(); } catch {}
          }
          await new Promise(resolve => tlsServer.close(resolve));
        }
      }

      // DB_SSL=require and DB_SSL=off modes and warnings
      const requireWarnings = [];
      const spyStoreRequire = openStore({
        env: {
          DB_HOST: 'db.example.com',
          DB_USER: 'charred_user',
          DB_PASSWORD: 'pw',
          DB_NAME: 'charred_db',
          DB_SSL: 'require'
        },
        warn: msg => requireWarnings.push(msg),
        createPool: createPoolSpy
      });
      await spyStoreRequire.ready;
      apiOk(
        poolCalls.length === 3 &&
          Boolean(poolCalls[2].ssl) &&
          poolCalls[2].ssl.rejectUnauthorized === false &&
          !('ca' in poolCalls[2].ssl) &&
          requireWarnings.length === 1 &&
          requireWarnings[0].includes('DB_SSL=require') &&
          /not verified/i.test(requireWarnings[0]),
        'DB_SSL=require configures encrypted connection with rejectUnauthorized:false and logs a one-line warning that the server is not verified'
      );

      const offWarnings = [];
      const spyStoreOff = openStore({
        env: {
          DB_HOST: 'db.example.com',
          DB_USER: 'charred_user',
          DB_PASSWORD: 'pw',
          DB_NAME: 'charred_db',
          DB_SSL: 'off'
        },
        warn: msg => offWarnings.push(msg),
        createPool: createPoolSpy
      });
      await spyStoreOff.ready;
      apiOk(
        poolCalls.length === 4 &&
          !('ssl' in poolCalls[3]) &&
          offWarnings.length === 1 &&
          offWarnings[0].includes('DB_SSL=off') &&
          /unencrypted|plaintext/i.test(offWarnings[0]),
        'DB_SSL=off omits ssl option for an explicit plaintext connection and logs a one-line warning'
      );

      // Missing-setting start-up validation when DB_HOST is set
      const secretPw = 'SuperSecret!Pw#42';
      let errMissingUser = null;
      try {
        openStore({ env: { DB_HOST: 'db.example.com', DB_PASSWORD: secretPw, DB_NAME: 'charred_db' }, createPool: createPoolSpy });
      } catch (err) {
        errMissingUser = err;
      }
      apiOk(
        Boolean(errMissingUser) &&
          errMissingUser.message.includes('DB_USER') &&
          !errMissingUser.message.includes('DB_PASSWORD') &&
          !errMissingUser.message.includes('DB_NAME') &&
          !errMissingUser.message.includes(secretPw),
        'openStore fails at start-up naming DB_USER when DB_USER is missing and never leaks DB_PASSWORD'
      );

      let errMissingPass = null;
      try {
        openStore({ env: { DB_HOST: 'db.example.com', DB_USER: 'u', DB_NAME: 'charred_db' }, createPool: createPoolSpy });
      } catch (err) {
        errMissingPass = err;
      }
      apiOk(
        Boolean(errMissingPass) &&
          errMissingPass.message.includes('DB_PASSWORD') &&
          !errMissingPass.message.includes('DB_USER') &&
          !errMissingPass.message.includes('DB_NAME'),
        'openStore fails at start-up naming DB_PASSWORD when DB_PASSWORD is missing'
      );

      let errMissingName = null;
      try {
        openStore({ env: { DB_HOST: 'db.example.com', DB_USER: 'u', DB_PASSWORD: secretPw }, createPool: createPoolSpy });
      } catch (err) {
        errMissingName = err;
      }
      apiOk(
        Boolean(errMissingName) &&
          errMissingName.message.includes('DB_NAME') &&
          !errMissingName.message.includes('DB_USER') &&
          !errMissingName.message.includes('DB_PASSWORD') &&
          !errMissingName.message.includes(secretPw),
        'openStore fails at start-up naming DB_NAME when DB_NAME is missing and never leaks DB_PASSWORD'
      );

      let errMissingAll = null;
      try {
        openStore({ env: { DB_HOST: 'db.example.com' }, createPool: createPoolSpy });
      } catch (err) {
        errMissingAll = err;
      }
      apiOk(
        Boolean(errMissingAll) &&
          errMissingAll.message.includes('DB_USER') &&
          errMissingAll.message.includes('DB_PASSWORD') &&
          errMissingAll.message.includes('DB_NAME'),
        'openStore fails at start-up naming all missing settings (DB_USER, DB_PASSWORD, DB_NAME) when all three are omitted'
      );

      // TLS start-up validation errors (missing DB_SSL_CA, unreadable CA file, invalid DB_SSL, invalid DB_SSL_FINGERPRINT)
      let errMissingSslCa = null;
      try {
        openStore({
          env: { DB_HOST: 'db.example.com', DB_USER: 'u', DB_PASSWORD: secretPw, DB_NAME: 'd' },
          createPool: createPoolSpy
        });
      } catch (err) {
        errMissingSslCa = err;
      }
      apiOk(
        Boolean(errMissingSslCa) &&
          errMissingSslCa.message.includes('DB_SSL_CA') &&
          !errMissingSslCa.message.includes(secretPw),
        'DB_SSL=verify (default) without DB_SSL_CA fails at start-up naming DB_SSL_CA and never leaks DB_PASSWORD'
      );

      let errUnreadableSslCa = null;
      try {
        openStore({
          env: {
            DB_HOST: 'db.example.com',
            DB_USER: 'u',
            DB_PASSWORD: secretPw,
            DB_NAME: 'd',
            DB_SSL_CA: 'certs/does-not-exist-ca.pem'
          },
          createPool: createPoolSpy
        });
      } catch (err) {
        errUnreadableSslCa = err;
      }
      apiOk(
        Boolean(errUnreadableSslCa) &&
          errUnreadableSslCa.message.includes('DB_SSL_CA') &&
          errUnreadableSslCa.message.includes('certs/does-not-exist-ca.pem') &&
          !errUnreadableSslCa.message.includes(secretPw),
        'DB_SSL=verify with a nonexistent DB_SSL_CA path fails at start-up naming DB_SSL_CA and the path'
      );

      let errBadSslMode = null;
      try {
        openStore({
          env: {
            DB_HOST: 'db.example.com',
            DB_USER: 'u',
            DB_PASSWORD: secretPw,
            DB_NAME: 'd',
            DB_SSL: 'bogus'
          },
          createPool: createPoolSpy
        });
      } catch (err) {
        errBadSslMode = err;
      }
      apiOk(
        Boolean(errBadSslMode) &&
          errBadSslMode.message.includes('DB_SSL') &&
          !errBadSslMode.message.includes(secretPw),
        'Invalid DB_SSL mode fails at start-up naming DB_SSL'
      );

      let errBadFingerprint = null;
      try {
        openStore({
          env: {
            DB_HOST: 'db.example.com',
            DB_USER: 'u',
            DB_PASSWORD: secretPw,
            DB_NAME: 'd',
            DB_SSL_CA: expectedDreamhostCaRel,
            DB_SSL_FINGERPRINT: 'not-a-valid-sha256-pin'
          },
          createPool: createPoolSpy
        });
      } catch (err) {
        errBadFingerprint = err;
      }
      apiOk(
        Boolean(errBadFingerprint) &&
          errBadFingerprint.message.includes('DB_SSL_FINGERPRINT') &&
          !errBadFingerprint.message.includes(secretPw),
        'Malformed DB_SSL_FINGERPRINT fails at start-up naming DB_SSL_FINGERPRINT'
      );

      // Password redaction on connection / query failure errors (including TLS chain/pin failures)
      let connCreateErr = null;
      try {
        openStore({
          env: {
            DB_HOST: 'db.example.com',
            DB_USER: 'u',
            DB_PASSWORD: secretPw,
            DB_NAME: 'd',
            DB_SSL_CA: expectedDreamhostCaRel,
            DB_SSL_FINGERPRINT: expectedDreamhostServerPin
          },
          createPool() {
            const e = new Error(`Access denied for user 'u' with password '${secretPw}'`);
            e.sqlMessage = `Auth failed (${secretPw})`;
            throw e;
          }
        });
      } catch (err) {
        connCreateErr = err;
      }
      apiOk(
        Boolean(connCreateErr) &&
          connCreateErr.message.includes('***') &&
          !connCreateErr.message.includes(secretPw) &&
          !String(connCreateErr.stack || '').includes(secretPw) &&
          !String(connCreateErr.sqlMessage || '').includes(secretPw),
        'Connection failure during pool creation redacts DB_PASSWORD from error message, stack, and sqlMessage'
      );

      let queryConnErr = null;
      try {
        const failingStore = openStore({
          env: {
            DB_HOST: 'db.example.com',
            DB_USER: 'u',
            DB_PASSWORD: secretPw,
            DB_NAME: 'd',
            DB_SSL_CA: expectedDreamhostCaRel,
            DB_SSL_FINGERPRINT: expectedDreamhostServerPin
          },
          createPool() {
            return {
              async execute() {
                const e = new Error(`ECONNREFUSED connecting with password=${secretPw}`);
                e.code = 'ECONNREFUSED';
                e.sqlMessage = `Connect failed using ${secretPw}`;
                throw e;
              },
              async end() {}
            };
          }
        });
        await failingStore.ready;
      } catch (err) {
        queryConnErr = err;
      }
      apiOk(
        Boolean(queryConnErr) &&
          queryConnErr.code === 'ECONNREFUSED' &&
          queryConnErr.message.includes('***') &&
          !queryConnErr.message.includes(secretPw) &&
          !String(queryConnErr.stack || '').includes(secretPw) &&
          !String(queryConnErr.sqlMessage || '').includes(secretPw),
        'Connection/query failure in pool.execute redacts DB_PASSWORD while preserving error code'
      );

      let tlsChainErr = null;
      let tlsChainExecuteCalls = 0;
      try {
        const tlsFailingStore = openStore({
          env: {
            DB_HOST: 'mysql.tbay.tk',
            DB_USER: 'u',
            DB_PASSWORD: secretPw,
            DB_NAME: 'd',
            DB_SSL_CA: expectedDreamhostCaRel,
            DB_SSL_FINGERPRINT: expectedDreamhostServerPin
          },
          createPool() {
            return {
              async execute() {
                tlsChainExecuteCalls += 1;
                const e = new Error(
                  `unable to verify the first certificate (auth=${secretPw}, url=${encodeURIComponent(secretPw)})`
                );
                e.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
                e.sqlMessage = `SSL handshake failed for ${secretPw}`;
                throw e;
              },
              async end() {}
            };
          }
        });
        await tlsFailingStore.ready;
      } catch (err) {
        tlsChainErr = err;
      }
      apiOk(
        Boolean(tlsChainErr) &&
          tlsChainExecuteCalls === 1 &&
          /certificate changed or could not be verified/i.test(tlsChainErr.message) &&
          tlsChainErr.message.includes('DB_SSL_CA') &&
          tlsChainErr.message.includes('DB_SSL_FINGERPRINT') &&
          !tlsChainErr.message.includes(secretPw) &&
          !tlsChainErr.message.includes(encodeURIComponent(secretPw)) &&
          !String(tlsChainErr.stack || '').includes(secretPw) &&
          !String(tlsChainErr.sqlMessage || '').includes(secretPw),
        'TLS chain/pin failure produces a clear message naming DB_SSL_CA and DB_SSL_FINGERPRINT, never retries in plaintext, and strips DB_PASSWORD'
      );

      // Automatic .env loading helper & test isolation
      const os = require('node:os');
      const path = require('node:path');
      const missingEnvPath = path.join(os.tmpdir(), `charred-nonexistent-${ process.pid }-${ Date.now() }.env`);
      apiOk(
        loadProjectEnv({ envPath: missingEnvPath }) === false,
        'loadProjectEnv returns false and does not throw when .env file does not exist'
      );

      const tmpEnvFile = path.join(os.tmpdir(), `charred-test-${ process.pid }-${ Date.now() }.env`);
      const presetKey = 'CHARRED_TEST_PRESET_VAR';
      const loadedKey = 'CHARRED_TEST_LOADED_VAR';
      fs.writeFileSync(tmpEnvFile, `${presetKey}=from_dotenv\n${loadedKey}=from_dotenv_file\n`, 'utf8');
      try {
        let spyPath = null;
        const spyRes = loadProjectEnv({
          envPath: tmpEnvFile,
          loadEnvFile(p) {
            spyPath = p;
          }
        });
        apiOk(spyRes === true && spyPath === tmpEnvFile, 'loadProjectEnv invokes loadEnvFile with the .env path when the file exists');

        process.env[presetKey] = 'from_real_env';
        delete process.env[loadedKey];
        const realRes = loadProjectEnv({ envPath: tmpEnvFile });
        apiOk(
          realRes === true &&
            process.env[presetKey] === 'from_real_env' &&
            process.env[loadedKey] === 'from_dotenv_file',
          'loadProjectEnv loads variables from .env via process.loadEnvFile while existing environment variables win'
        );
      } finally {
        delete process.env[presetKey];
        delete process.env[loadedKey];
        try { fs.unlinkSync(tmpEnvFile); } catch {}
      }

      const origLoadEnvFile = process.loadEnvFile;
      let loadEnvFileCalledByServer = false;
      process.loadEnvFile = () => {
        loadEnvFileCalledByServer = true;
      };
      try {
        const ephemeralSrv = createServer({ dbPath: ':memory:', env: {} });
        ephemeralSrv.close();
      } finally {
        process.loadEnvFile = origLoadEnvFile;
      }
      apiOk(
        loadEnvFileCalledByServer === false,
        'createServer() in tests does not call process.loadEnvFile (.env is only loaded when serve.cjs is the main program)'
      );

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
        async getConnection() {
          return {
            execute: (sql, params) => fakeMysqlPool.execute(sql, params),
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {}
          };
        },
        async execute(sql, params = []) {
          const norm = sql.replace(/\s+/g, ' ').trim();
          executedQueries.push({ sql: norm, params });
          if (/\bLIMIT\s+\?/i.test(norm)) {
            throw new Error('Incorrect arguments to mysqld_stmt_execute');
          }
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
          if (norm.startsWith('UPDATE users SET email_verify_attempts = email_verify_attempts + 1')) {
            const [now, id, maxAttempts] = params;
            const cap = maxAttempts !== undefined ? Number(maxAttempts) : 5;
            const u = tables.users.find(
              r => r.id === id && r.email_verify_hash !== null && Number(r.email_verify_attempts || 0) < cap
            );
            if (u) {
              u.email_verify_attempts = Number(u.email_verify_attempts || 0) + 1;
              u.updated_at = now;
            }
            return [{ affectedRows: u ? 1 : 0 }, []];
          }
          if (norm.startsWith('UPDATE users SET email_verify_hash = NULL, email_verify_expires_at = NULL')) {
            const [now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) {
              u.email_verify_hash = null;
              u.email_verify_expires_at = null;
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
          if (norm.startsWith('UPDATE users SET password_hash = NULL')) {
            const [now, id] = params;
            const u = tables.users.find(r => r.id === id);
            if (u) { u.password_hash = null; u.updated_at = now; }
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
          if (norm === 'DELETE FROM sessions WHERE user_id = ?') {
            tables.sessions = tables.sessions.filter(s => s.user_id !== params[0]);
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
            let affected = 0;
            for (const mp of tables.match_participants) {
              if (mp.match_id === match_id && mp.user_id === user_id && !mp.is_ai && mp.attested === 0) {
                mp.attested = 1;
                mp.attestation_hash = attestation_hash;
                mp.payload_json = payload_json;
                mp.kills = kills;
                mp.final_hp = final_hp;
                mp.won = won;
                mp.attested_at = attested_at;
                affected = 1;
              }
            }
            return [{ affectedRows: affected }, []];
          }
          if (norm.startsWith('UPDATE matches SET status = ?, nonce_used = 1, winner_user_id = ?')) {
            const [status, winner_user_id, canonical_hash, completed_at, id] = params;
            const m = tables.matches.find(r => r.id === id && r.status === 'pending' && r.nonce_used === 0);
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
          if (norm.startsWith('SELECT m.id, m.room_code, m.mode, m.round_number')) {
            const limitMatch = norm.match(/\bLIMIT\s+(\d+)$/i);
            const limit = limitMatch ? Number(limitMatch[1]) : 20;
            const userId = params[0];
            const rows = tables.match_participants
              .filter(mp => mp.user_id === userId)
              .map(mp => {
                const m = tables.matches.find(r => r.id === mp.match_id);
                if (!m || !['verified', 'bot_match'].includes(m.status)) return null;
                return {
                  id: m.id,
                  room_code: m.room_code,
                  mode: m.mode,
                  round_number: m.round_number,
                  status: m.status,
                  winner_user_id: m.winner_user_id,
                  started_at: m.started_at,
                  completed_at: m.completed_at,
                  slot: mp.slot,
                  kills: mp.kills,
                  final_hp: mp.final_hp,
                  won: mp.won
                };
              })
              .filter(Boolean)
              .slice(0, limit);
            return [rows, []];
          }
          if (norm.startsWith('SELECT * FROM users WHERE email_verified = 1 ORDER BY wins DESC')) {
            const limitMatch = norm.match(/\bLIMIT\s+(\d+)$/i);
            const limit = limitMatch ? Number(limitMatch[1]) : 50;
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
        mysqlPool: fakeMysqlPool
      });
      await mysqlStore.ready;
      apiOk(mysqlStore.backend === 'mysql', 'openStore selects mysql backend when DB_HOST or mysqlPool is provided');
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
        const resAttempt = await mysqlStore.countEmailVerifyAttempt(u1.id);
        apiOk(resAttempt.counted === true && resAttempt.attempts === i, `MySQL adapter countEmailVerifyAttempt counts attempt ${i}`);
      }
      const sixthAttempt = await mysqlStore.countEmailVerifyAttempt(u1.id);
      const invalidatedU1 = await mysqlStore.invalidateEmailVerificationCode(u1.id);
      apiOk(
        sixthAttempt.counted === false && sixthAttempt.attempts === 5 && !invalidatedU1.emailVerifyHash,
        'MySQL adapter refuses 6th attempt (counted=false) and invalidateEmailVerificationCode nulls hash'
      );
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
      const firstSub = await mysqlStore.submitAttestation({
        matchId: m.id,
        userId: u1.id,
        attestationHash: 'chash',
        payload: { ok: true },
        slotOutcome: { slot: 0, kills: 1, finalHp: 90, won: true }
      });
      const dupSub = await mysqlStore.submitAttestation({
        matchId: m.id,
        userId: u1.id,
        attestationHash: 'chash',
        payload: { ok: true },
        slotOutcome: { slot: 0, kills: 1, finalHp: 90, won: true }
      });
      apiOk(
        firstSub.attestedUpdated === true && dupSub.attestedUpdated === false,
        'MySQL adapter submitAttestation only sets attested when attested=0 and rejects duplicate'
      );

      const firstFin = await mysqlStore.finalizeMatch({
        matchId: m.id,
        winnerUserId: u1.id,
        canonicalHash: 'chash',
        participantOutcomes: [
          { slot: 0, kills: 1, finalHp: 90, won: true },
          { slot: 1, kills: 0, finalHp: 0, won: false }
        ],
        isBotMatch: false
      });
      const secondFin = await mysqlStore.finalizeMatch({
        matchId: m.id,
        winnerUserId: u1.id,
        canonicalHash: 'chash',
        participantOutcomes: [
          { slot: 0, kills: 1, finalHp: 90, won: true },
          { slot: 1, kills: 0, finalHp: 0, won: false }
        ],
        isBotMatch: false
      });
      apiOk(
        firstFin.finalized === true && secondFin.finalized === false,
        'MySQL adapter finalizeMatch CAS returns finalized:true once and finalized:false on replay without double-counting stats'
      );

      const lb = await mysqlStore.getLeaderboard(250);
      apiOk(lb.length === 2 && lb[0].username === 'mysql_cmd' && lb[0].wins === 1, 'MySQL adapter finalizeMatch updates stats once and getLeaderboard returns ranked verified users');

      const hist = await mysqlStore.getMatchHistoryByUser(u1.id, 0);
      apiOk(hist.length === 1 && hist[0].matchId === m.id && hist[0].won === true, 'MySQL adapter getMatchHistoryByUser clamps limit and returns match history');

      const lbQueries = executedQueries.filter(q => q.sql.startsWith('SELECT * FROM users WHERE email_verified = 1 ORDER BY wins DESC'));
      const histQueries = executedQueries.filter(q => q.sql.startsWith('SELECT m.id, m.room_code, m.mode, m.round_number'));
      apiOk(
        lbQueries.length === 1 &&
          /\bLIMIT 100$/.test(lbQueries[0].sql) &&
          !/\bLIMIT\s+\?/i.test(lbQueries[0].sql) &&
          lbQueries[0].params.length === 0 &&
          histQueries.length === 1 &&
          /\bLIMIT 1$/.test(histQueries[0].sql) &&
          !/\bLIMIT\s+\?/i.test(histQueries[0].sql) &&
          histQueries[0].params.length === 1,
        'MySQL getLeaderboard and getMatchHistoryByUser clamp limit to 1..100 and send no bound LIMIT ? placeholder'
      );

      // Verify every non-DDL query uses parameterized '?' placeholders for values and never interpolates user strings
      const dmlQueries = executedQueries.filter(q => !q.sql.startsWith('CREATE TABLE'));
      apiOk(
        dmlQueries.length > 15 &&
          dmlQueries.every(
            q =>
              ((q.params.length > 0 && q.sql.includes('?')) || (q.params.length === 0 && !q.sql.includes('?'))) &&
              !q.sql.includes('mysql_cmd') &&
              !q.sql.includes('mysql@example.com')
          ),
        'Every MySQL DML/SELECT query uses ? placeholders for bound parameters and never interpolates user values'
      );

      await mysqlStore.close();
      apiOk(poolClosed === true, 'MySQL adapter close() ends the pool (unit-tested with fake mysql2 pool; no live MySQL server required)');
    }

    // End-to-end ranked 2-human match using combat expansion actions:
    // Turn 1 (Alpha, 2 setup actions): Orbital Laser Satellite deploy + Satellite Laser Strike
    // Turn 1 (Bravo, 2 setup actions): Anti-Satellite Silo deploy + ASAT Silo Launch
    // Turn 2 (Alpha, 2 setup actions): Anti-Drone Net Launcher structure deploy + Strike Attack Drone sortie
    {
      const reLoginAlpha = await req('/api/auth/login', {
        method: 'POST',
        body: { username: 'alpha', password: 'Password123!' }
      });
      apiOk(reLoginAlpha.status === 200 && reLoginAlpha.data.token, 'Re-login Alpha for combat-expansion E2E ranked match');
      const e2eAlphaToken = reLoginAlpha.data.token;

      const lbBefore = await req('/api/leaderboard');
      const alphaBefore = lbBefore.data.leaderboard.find(e => e.username === 'alpha');
      const bravoBefore = lbBefore.data.leaderboard.find(e => e.username === 'bravo');

      const startExpansionMatch = await req('/api/matches/start', {
        method: 'POST',
        token: e2eAlphaToken,
        body: {
          roomCode: 'CHARRED-EXPAND',
          mode: 'online',
          round: 1,
          participants: [
            { slot: 0, userId: alphaId, name: 'Alpha Prime', ai: false },
            { slot: 1, userId: bravoId, name: 'Commander Bravo', ai: false }
          ]
        }
      });
      apiOk(
        startExpansionMatch.status === 201 && startExpansionMatch.data.nonce,
        'Combat-expansion E2E ranked match ticket issued'
      );

      const expansionActionLog = [
        // Alpha turn 1: 2 setup actions in the same turn (satellite deploy + callable Satellite Laser Strike)
        { actor: 0, action: 'fire', weaponOrItem: 'Orbital Laser Satellite', angle: 45, power: 650, az: 0, targetX: 400 },
        { actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike', targetX: 400 },
        // Bravo turn 1: 2 setup actions in the same turn (ASAT silo deploy + ASAT Silo Launch)
        { actor: 1, action: 'fire', weaponOrItem: 'Anti-Satellite Silo', angle: 135, power: 650, az: 0 },
        { actor: 1, action: 'silo_launch', weaponOrItem: 'ASAT Silo Launch', targetSatId: 1 },
        // Alpha turn 2: 2 setup actions (structure deploy + piloted Strike Attack Drone sortie)
        { actor: 0, action: 'fire', weaponOrItem: 'Anti-Drone Net Launcher', angle: 45, power: 650, az: 0 },
        { actor: 0, action: 'fire', weaponOrItem: 'Strike Attack Drone', angle: 45, power: 650, az: 0, targetX: 400 }
      ];
      const expansionOutcomes = [
        { slot: 0, kills: 1, finalHp: 78 },
        { slot: 1, kills: 0, finalHp: 0 }
      ];

      const attestAlpha = await req(`/api/matches/${startExpansionMatch.data.matchId}/attest`, {
        method: 'POST',
        token: e2eAlphaToken,
        body: {
          nonce: startExpansionMatch.data.nonce,
          winnerSlot: 0,
          durationMs: 18500,
          actionLog: expansionActionLog,
          outcomes: expansionOutcomes
        }
      });
      apiOk(
        attestAlpha.status === 202 &&
          attestAlpha.data.status === 'pending_co_attestation' &&
          typeof attestAlpha.data.canonicalHash === 'string',
        'Combat-expansion E2E: Alpha attestation accepted as 202 pending_co_attestation'
      );

      const attestBravo = await req(`/api/matches/${startExpansionMatch.data.matchId}/attest`, {
        method: 'POST',
        token: bravoToken,
        body: {
          nonce: startExpansionMatch.data.nonce,
          winnerSlot: 0,
          durationMs: 18700,
          actionLog: expansionActionLog,
          outcomes: expansionOutcomes
        }
      });
      apiOk(
        attestBravo.status === 200 &&
          attestBravo.data.status === 'verified' &&
          attestBravo.data.leaderboardUpdated === true &&
          attestBravo.data.canonicalHash === attestAlpha.data.canonicalHash,
        'Combat-expansion E2E: Bravo co-attestation produces identical canonicalHash and finalizes as verified'
      );

      const replayExpansion = await req(`/api/matches/${startExpansionMatch.data.matchId}/attest`, {
        method: 'POST',
        token: bravoToken,
        body: {
          nonce: startExpansionMatch.data.nonce,
          winnerSlot: 0,
          durationMs: 18700,
          actionLog: expansionActionLog,
          outcomes: expansionOutcomes
        }
      });
      apiOk(replayExpansion.status === 409, 'Combat-expansion E2E: replay on finalized match rejected with 409');

      const lbAfter = await req('/api/leaderboard');
      const alphaAfter = lbAfter.data.leaderboard.find(e => e.username === 'alpha');
      const bravoAfter = lbAfter.data.leaderboard.find(e => e.username === 'bravo');
      apiOk(
        alphaAfter.wins === alphaBefore.wins + 1 &&
          alphaAfter.kills === alphaBefore.kills + 1 &&
          alphaAfter.matchesPlayed === alphaBefore.matchesPlayed + 1 &&
          bravoAfter.losses === bravoBefore.losses + 1 &&
          bravoAfter.matchesPlayed === bravoBefore.matchesPlayed + 1,
        'Combat-expansion E2E: ranked match counted once in leaderboard and player stats'
      );
    }

    console.log(`${apiChecks} API & account checks passed (${simChecks} simulation + ${apiChecks} API = ${simChecks + apiChecks} total checks; MySQL adapter verified via fake-pool unit tests, main suite runs on SQLite).`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
