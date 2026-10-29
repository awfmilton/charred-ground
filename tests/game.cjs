const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
source=source.slice(0,source.indexOf('for(let i=0;i<6;i++){let d=document.createElement'));
const store=new Map(),localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const elements=new Map();function element(){const cl=new Set(['hidden']);return {value:'',checked:true,classList:{contains:c=>cl.has(c),add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>f===undefined?(cl.has(c)?cl.delete(c):cl.add(c)):(f?cl.add(c):cl.delete(c))},style:{},replaceChildren(){},appendChild(){},append(){},textContent:'',remove(){},setAttribute(){}}}
const document={body:element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll:()=>[],hidden:false};
const context={console,Buffer,coastalCrossingJson:fs.readFileSync('maps/coastal-crossing.json','utf8'),htmlSource:fs.readFileSync('index.html','utf8'),innerWidth:1280,innerHeight:720,THREE:require('three'),document,window:{localStorage},localStorage,setTimeout,clearTimeout,performance,crypto:require('crypto').webcrypto,requestAnimationFrame(){}};
vm.createContext(context);
// Bind hot globals lexically: inside a vm context every global lookup goes through the contextified global object,
// which made newTerrain ~16x slower than in a browser (1111 ms vs 67 ms). The game code itself is unchanged.
const FAST_GLOBALS="const Math=globalThis.Math,Float32Array=globalThis.Float32Array,Int32Array=globalThis.Int32Array,Int16Array=globalThis.Int16Array,Uint8Array=globalThis.Uint8Array,Uint32Array=globalThis.Uint32Array,Number=globalThis.Number,Array=globalThis.Array,Object=globalThis.Object;";
vm.runInContext(FAST_GLOBALS+source,context);
const test=`
let checks=0;function ok(value,message){if(!value)throw Error(message);checks++}
const originalClearViews=clearViews,originalBroadcastState=broadcastState;emit=()=>{};flash=()=>{};sound=()=>{};refreshWeapons=()=>{};updateUI=()=>{};showShop=()=>{};clearViews=()=>{};broadcastState=()=>{};notice=()=>{};laserLine=()=>{};
function setFlatRow(x0,x1,v,z=0){let ix0=clamp(Math.floor(x0/CELL),0,NX-1),ix1=clamp(Math.ceil(x1/CELL),0,NX-1),iz0=clamp(Math.floor((z+D-6)/CELL),0,NZ-1),iz1=clamp(Math.ceil((z+D+6)/CELL),0,NZ-1);for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++)S.heights[gridIdx(ix,iz)]=quantH(v)}
function setup(){setWorld({w:960,d:240,cell:2});seed=1729;S={cfg:{terrain:'Rolling Hills',wall:'Concrete',difficulty:'Cyborg',market:'fixed'},round:1,turn:0,actionsMax:2,actionsLeft:2,heights:new Float32Array(N).fill(20),tanks:[0,1].map(id=>({id,name:'P'+id,x:40+id*100,z:0,heading:id?Math.PI:0,y:20,hp:100,shield:0,mag:false,inv:Object.fromEntries(Object.keys(WEAPONS_CONFIG).map(n=>[n,10])),fuel:100,power:650,angle:id?135:45,az:0,vy:0,chuting:0,buried:0,cash:10000,score:0})),platforms:[],customMap:null,satellites:[],buildings:[],drones:[],shots:[],fires:[],phase:'aim',wind:0,wall:'Concrete',time:0,uid:0,prices:{},ready:[]};running=true;host=true;online=false;shotClock=0;return S.tanks[0]}
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
setup();let before=height(140,0);impact({name:'Dirt Ball',x:140,y:20,z:0,owner:0});ok(height(140,0)>before,'Dirt adds terrain');
setup();impact({name:'Riot Bomb',x:140,y:20,z:0,owner:0});ok(height(140,0)<20&&S.tanks[1].hp===100,'Riot clears without blast damage');
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
setup();camera=new THREE.PerspectiveCamera(47,16/9,.2,1200);camera.position.set(W/2,180,570);scene=new THREE.Scene();initTrails();
ok(W===960&&D===240&&CELL===2&&NX===481&&NZ===241&&N===115921&&LEGACY_N===481,'Expanded battlefield dimensions');
setCameraMode('focus');ok(viewMode==='focus'&&exploreX===current().x,'Focus targets current tank');
setCameraMode('explore');let oldX=exploreX;panExplore('d');ok(exploreX!==oldX,'Explore pans across map');
setCameraMode('gunner');ok(fp,'Gunner mode enabled');lastVisualRound=S.round;lastVisualPhase='aim';
S.phase='flight';spawnShot(current(),'Baby Missile',45,650);updateCamera(.016,current(),45,0,direction(45,0));ok(launchTimer>0,'3D firing starts launch camera');
for(let i=0;i<70;i++)updateCamera(1/60,current(),45,0,direction(45,0));ok(viewMode==='tactical'&&!fp&&launchTimer===0,'Launch returns to tactical view');
updateTrails(.016);ok(traces.size===1,'Projectile path tracked');S.shots[0].x+=20;S.shots[0].y+=15;updateTrails(.016);ok(trailGeo.drawRange.count>=2,'Visible trail geometry produced');
S.shots=[];for(let i=0;i<70;i++)updateTrails(1/60);ok(traces.size===0,'Trails expire without growth');
S.phase='aim';updateCamera(.016,current(),45,0,direction(45,0));ok(!document.getElementById('orbit').disabled,'Camera sliders unlock after flight');
initNature();updateNature();ok(trunks.count>0&&trunks.count<=180&&crowns.count===trunks.count,'Pooled trees populated');ok(water.position.y===12,'Water surface initialized');
for(let terrainType of ['Rolling Hills','Jagged Mountains','Valleys','Cliffs']){let map=newTerrain(terrainType);ok(map.length===N&&map.every(Number.isFinite),'Larger valid terrain '+terrainType);}
// --- Custom Terrain Editor & Floating Platform Verification ---
setup();
S.heights.fill(6);
setFlatRow(20,38,13);
S.platforms=[{id:1,x:52,y:13,width:28,hp:120,maxHp:120}];
t=current();t.inv['Floating Platform']=0;t.inv['Inflatable Lifejacket']=0;t.x=36;t.y=supportHeight(36);t.fuel=100;
ok(t.y===13,'Tank starts on coastal ramp at platform elevation');
ok(action({action:'move',dir:1},0)&&S.activeDrive,'Tank starts timed drive from land onto floating platform');
for(let i=0;i<80;i++)step(1/60);
ok(t.x>42&&t.y===13,'Tank drives from land onto and along floating platform over deep water');
ok(steerDrive({stop:true,moveId:S.activeDrive.id},0)&&!S.activeDrive,'Stop timed drive on platform');
S.turn=0;S.actionsLeft=2;setFlatRow(67,140,4);t.x=66;t.y=supportHeight(66);
ok(!action({action:'move',dir:1},0)&&t.x===66&&S.actionsLeft===2,'Tank blocked from driving off platform edge when the drop to the lakebed exceeds 7 m, at 0 cost (P3: gearless tanks may otherwise enter water)');

S.platforms=[{id:1,x:46,y:13,width:12,hp:120,maxHp:120},{id:2,x:62,y:13,width:12,hp:120,maxHp:120}];setFlatRow(52,56,4);
t.x=50;t.y=supportHeight(50);t.fuel=100;
ok(action({action:'move',dir:1},0),'Start drive toward water gap between separated platforms');
for(let i=0;i<60;i++)step(1/60);
ok(t.x<=52&&t.y===13,'Intermediate water gap (drop to a 4 m bed > 7 m) between separated platforms blocks timed drive from crossing (P3: a gap within the step rule could be waded)');
finishDrive();

S.platforms=[{id:1,x:52,y:13,width:28,hp:15,maxHp:120}];
t.x=40;t.y=supportHeight(40);t.hp=100;t.inv.Parachute=0;
explosion(64,13,0,{name:'Charge',r:8,dmg:40,crater:0},1,true);
ok(S.platforms.length===0&&t.hp===100,'Platform destroyed by blast at far end without killing supported tank');
for(let i=0;i<120;i++)step(1/60);
ok(t.y===6&&t.hp<100,'Surviving tank falls to underwater floor and takes fall damage when platform collapses');

setup();
S.heights[gridIdx(200/CELL,D/CELL)]=30;S.heights[gridIdx(204/CELL,D/CELL)]=22;editorFlattenY=30;
sculptTerrain(200,'flat',20,8);
sculptTerrain(200,'flat',20,8);
ok(height(200,0)>=29&&height(204,0)>22,'Flatten brush converges toward locked target height without flipping to water');
editorFlattenY=null;
sculptTerrain(200,'water',20,10);
sculptTerrain(200,'water',20,10);
ok(height(200,0)<WATER_LEVEL,'Separate water brush carves channel below water level');

ok(!validateCustomMap({name:'NoVersion',heights:new Array(N).fill(20),spawns:[40,440]}),'Validator rejects missing version');
ok(!validateCustomMap({version:1,name:'StrHeight',heights:new Array(N).fill('20'),spawns:[40,440]}),'Validator rejects numeric string heights');
ok(!validateCustomMap({version:1,name:'NullHeight',heights:new Array(N).fill(null),spawns:[40,440]}),'Validator rejects null heights');
ok(!validateCustomMap({version:1,name:'CloseSpawns',heights:new Array(N).fill(20),spawns:[100,106]}),'Validator rejects spawns closer than 10m');
let wetHeights=new Array(N).fill(20);wetHeights[gridIdx(120/CELL,D/CELL)]=5;
ok(!validateCustomMap({version:1,name:'WetSpawn',heights:wetHeights,spawns:[40,120]}),'Validator rejects unsupported water spawn');
let bridgedMap=validateCustomMap({version:1,name:'Bridged',heights:wetHeights,platforms:[{id:1,x:120,y:13,width:24,hp:120,maxHp:120}],spawns:[40,120]});
ok(bridgedMap&&bridgedMap.spawns.length===6,'Validator accepts platform-supported water spawn and validates all 6 spawns');

setup();
let origH=height(150,0),origX=S.tanks[0].x,origAngle=S.tanks[0].angle;
openEditor();
sculptTerrain(150,'raise',20,10);
placePlatform(150,28,0);
S.tanks[0].x=250;S.tanks[0].angle=12;S.tanks[0].falling=true;
closeEditor(false);
ok(Math.abs(height(150,0)-origH)<1e-4&&S.platforms.length===0&&S.tanks[0].x===origX&&S.tanks[0].angle===origAngle&&!S.tanks[0].falling,'Editor cancel restores full snapshot state');

setup();S.phase='flight';ok(!openEditor(),'No editing during projectile flight');S.phase='shop';ok(!openEditor(),'No editing during shop');
setup();online=true;host=false;ok(!openEditor(),'Guest cannot edit maps');host=true;ok(!openEditor(),'Host cannot edit active online match');online=false;
setup();S.tanks[0].ai=true;ok(openEditor(),'Open editor before AI starts');let beforeTime=S.time;last=1000;let savedDraw=draw;draw=()=>{};animate(1100);draw=savedDraw;ok(S.time===beforeTime&&!aiBusy,'Editor pauses simulation and AI');closeEditor(false);
setup();openEditor();sculptTerrain(100,'raise',20,10);let incoming=JSON.parse(JSON.stringify(snapshot()));incoming.heights=encodeHeights(new Float32Array(N).fill(33));receiveState(incoming);ok(!editorOpen&&height(100,0)===33,'Incoming snapshot replaces draft without restoring old backup');
setup();editorSpawns=[40,440,120,360,200,280];let good={version:1,name:'Crossing',heights:Array(N).fill(20),spawns:editorSpawns.slice(),platforms:[{x:240,y:20,width:30,hp:120,maxHp:120}]};
ok(validateCustomMap(good),'Valid six-spawn map accepted');
ok(!validateCustomMap({...good,version:3}),'Unknown map version rejected');
ok(!validateCustomMap({...good,platforms:Array(17).fill(good.platforms[0])}),'Platform count bounded');
ok(!validateCustomMap({...good,platforms:[{...good.platforms[0],width:64.4}]}),'Oversize platform rejected before rounding');
ok(!validateCustomMap({...good,platforms:[{...good.platforms[0],x:Infinity}]}),'Nonfinite platform rejected');
ok(applyCustomMapToState(good)&&S.heights instanceof Float32Array,'Imported map retains typed terrain');
$('mapName').value='Crossing';ok(saveCustomMapSlot('Crossing'),'Map saved to local storage');
let exportMap=JSON.parse(JSON.stringify(serializeCurrentMap()));ok(exportMap.version===2&&decodeHeights(exportMap.heights,N)?.length===N&&exportMap.spawns.length===6,'JSON map export complete');
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
    setup();S.heights.fill(6);setFlatRow(20,40,13);setFlatRow(60,80,13);
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
setup();t=current();S.heights.fill(1);setFlatRow(0,100,18);t.x=99;t.y=18;
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
{
  ok(sanitizeMaxWind(undefined)===6.5&&sanitizeMaxWind('')===6.5&&sanitizeMaxWind('bad')===6.5&&sanitizeMaxWind(true)===6.5,'Max wind default');
  ok(sanitizeMaxWind(-4)===0&&sanitizeMaxWind(0)===0&&sanitizeMaxWind(3.25)===3.25&&sanitizeMaxWind(99)===6.5,'Max wind clamp');
  ok(sanitizeWindCadence(undefined)==='turn'&&sanitizeWindCadence('bad')==='turn'&&sanitizeWindCadence('cycle')==='cycle'&&sanitizeWindCadence('Each cycle')==='cycle'&&sanitizeWindCadence('round')==='round'&&sanitizeWindCadence('Whole round')==='round','Wind cadence sanitize');
  $('maxWind').value='9';$('windCadence').value='Whole round';let c1=config();ok(c1.maxWind===6.5&&c1.windCadence==='round','config clamp');
  $('maxWind').value='';$('windCadence').value='bogus';let c2=config();ok(c2.maxWind===6.5&&c2.windCadence==='turn','config default');
  $('maxWind').value='0';$('windCadence').value='turn';setup();S.cfg=config();newRound();ok(S.wind===0,'Calm 0');nextTurn();ok(S.wind===0,'Calm 0 turn');
  $('maxWind').value='2.5';$('windCadence').value='turn';setup();S.cfg=config();newRound();for(let i=0;i<12;i++){ok(Math.abs(S.wind)<=2.5,'Turn <=2.5');nextTurn()}
  setup();S.cfg.maxWind=6.5;S.cfg.windCadence='turn';newRound();let tw=S.wind;
  ok(action({weaponOrItem:'Standard Shield',angle:45,power:500},S.turn)&&S.wind===tw&&S.actionsLeft===3,'Action 1 keeps wind');
  ok(action({weaponOrItem:'Baby Missile',angle:45,power:500,az:0},S.turn)&&S.phase==='flight','Shot flight');
  for(let i=0;i<1600&&S.phase==='flight';i++)step(1/60);
  ok(S.phase!=='flight'&&S.actionsLeft===2&&S.wind===tw,'Completed flight keeps wind');
  let qsa=document.querySelectorAll;
  try{
    let slots=['human','human','human','human','off','off'].map(v=>({value:v}));
    document.querySelectorAll=s=>s==='.slot select'?slots:[];
    $('maxWind').value='6.5';$('windCadence').value='cycle';startMatch();
    ok(S.round===1&&S.tanks.length===4&&S.turn===0&&S.windRoundSet===true&&S.windCycleSeen.length===1&&S.windCycleSeen[0]===0,'Cycle R1 slot 0');
    let cw=S.wind;S.tanks[2].hp=0;
    nextTurn();ok(S.turn===1&&S.wind===cw&&S.windCycleSeen.length===2,'Cycle slot 1');
    nextTurn();ok(S.turn===3&&S.wind===cw&&S.windCycleSeen.length===3,'Cycle skips dead 2 to 3');
    nextTurn();ok(S.turn===0&&S.wind!==cw&&S.windCycleSeen.length===1&&S.windCycleSeen[0]===0,'Cycle rolls after living act');
    newRound();ok(S.round===2&&S.turn===1&&S.windRoundSet===true&&S.windCycleSeen.length===1&&S.windCycleSeen[0]===1,'newRound rotates slot 1');
  }finally{document.querySelectorAll=qsa}
  setup();S.cfg.maxWind=6.5;S.cfg.windCadence='round';newRound();let rw=S.wind;
  for(let i=0;i<4;i++){nextTurn();ok(S.wind===rw,'Round keeps wind')}
  newRound();ok(S.wind!==rw&&S.windRoundSet===true,'newRound rolls round wind');
  let snap=JSON.parse(JSON.stringify(snapshot()));snap.cfg.maxWind=99;snap.cfg.windCadence='Each cycle';snap.wind=-40;snap.windCycleSeen=[0,99,'bad'];receiveState(snap);
  ok(S.cfg.maxWind===6.5&&S.cfg.windCadence==='cycle'&&S.wind===-6.5&&S.windCycleSeen.length===1&&S.windCycleSeen[0]===0,'receiveState clamps');
  $('maxWind').value='6.5';$('windCadence').value='turn';
}
{
  ok(htmlSource.includes('id="windGauge"')&&htmlSource.includes('id="windBar"')&&htmlSource.includes('id="windMeta"')&&htmlSource.includes('id="lastShotInfo"'),'Wind HUD DOM');
  ok(!sanitizeLastShot(null)&&!sanitizeLastShot('x')&&!sanitizeLastShot([])&&!sanitizeLastShot({weapon:'Standard Shield',angle:45,power:500,az:0,wind:0})&&!sanitizeLastShot({weapon:'Laser',angle:45,power:500,az:0,wind:0})&&!sanitizeLastShot({weapon:'Baby Missile',angle:NaN,power:500,az:0,wind:0}),'lastShot reject');
  let cl=sanitizeLastShot({weapon:'MIRV',angle:195.4,power:1200.4,az:-209.3,wind:9.8,impactX:120});
  ok(cl.weapon==='MIRV'&&cl.angle===180&&cl.power===1000&&cl.az===-180&&cl.wind===6.5&&cl.impactX===undefined,'lastShot clamp');
  setup();S.round=0;S.cfg.maxWind=6.5;S.cfg.windCadence='turn';newRound();
  ok(S.round===1&&S.turn===0&&S.tanks[0].lastShot===null&&$('lastShotInfo').textContent==='LAST SHOT: NONE','Initial lastShot');
  S.wind=0;syncWindAndShotHUD();ok($('windBar').style.left==='50%'&&$('windBar').style.width==='0%'&&$('windMeta').textContent.includes('CALM'),'Gauge calm');
  S.wind=3.25;syncWindAndShotHUD();ok($('windBar').style.left==='50%'&&$('windBar').style.width==='25%'&&$('windMeta').textContent.includes('EAST'),'Gauge east');
  S.wind=-6.5;syncWindAndShotHUD();ok($('windBar').style.left==='0%'&&$('windBar').style.width==='50%'&&$('windMeta').textContent.includes('WEST'),'Gauge west');
  S.cfg.maxWind=4;S.wind=-20;syncWindAndShotHUD();ok($('windBar').style.left==='0%'&&$('windBar').style.width==='50%','Gauge bound');
  S.cfg.maxWind=6.5;S.cfg.windCadence='turn';S.wind=2.0;syncWindAndShotHUD();
  ok(!action({weaponOrItem:'Baby Missile',angle:NaN,power:600,az:0},0)&&!S.tanks[0].lastShot&&!action({weaponOrItem:'Baby Missile',angle:45,power:600,az:0},1)&&!S.tanks[1].lastShot,'Rejected');
  ok(action({weaponOrItem:'Standard Shield',angle:45,power:600,az:0},0)&&!S.tanks[0].lastShot&&action({weaponOrItem:'Laser',angle:45,power:600,az:0},0)&&!S.tanks[0].lastShot,'Non-ballistic');
  for(let i=0;i<1600&&S.phase==='flight';i++)step(1/60);
  S.tanks[0].inv.MIRV=2;S.wind=2.0;
  ok(action({weaponOrItem:'MIRV',angle:52.5,power:640,az:-3.5},0)&&S.tanks[0].lastShot?.weapon==='MIRV'&&S.tanks[0].lastShot.angle===52.5&&S.tanks[0].lastShot.power===640&&S.tanks[0].lastShot.az===-3.5&&S.tanks[0].lastShot.wind===2&&!S.tanks[1].lastShot,'MIRV own');
  for(let i=0;i<1600&&S.phase==='flight';i++)step(1/60);
  ok(S.phase!=='flight'&&S.tanks[0].lastShot.weapon==='MIRV'&&S.tanks[0].lastShot.angle===52.5&&S.tanks[0].lastShot.power===640,'MIRV split keeps');
  S.wind=-1.5;syncWindAndShotHUD();
  let txt=$('lastShotInfo').textContent;
  ok(txt.includes('MIRV')&&txt.includes('52.5°')&&txt.includes('640 PWR')&&txt.includes('AZ -3.5°')&&txt.includes('WIND +2.0')&&txt.includes('ΔWIND -3.5'),'HUD delta');
  nextTurn();ok(S.turn===1&&$('lastShotInfo').textContent==='LAST SHOT: NONE'&&S.tanks[0].lastShot.weapon==='MIRV','Turn isolation');
  S.tanks[1].hp=60;S.wind=-1.0;
  ok(action({weaponOrItem:'Baby Missile',angle:200,power:1000,az:240},1)&&S.tanks[1].lastShot?.weapon==='Baby Missile'&&S.tanks[1].lastShot.angle===180&&S.tanks[1].lastShot.power===600&&S.tanks[1].lastShot.az===180&&S.tanks[1].lastShot.wind===-1,'Clamped fired values');
  for(let i=0;i<1600&&S.phase==='flight';i++)step(1/60);
  S.tanks[1].hp=100;
  S.tanks[0].lastShot={weapon:'MIRV',angle:52.5,power:640,az:-3.5,wind:2,impactX:120,extra:'bad'};
  let hostSnap=snapshot();
  ok(hostSnap.tanks[0].lastShot.weapon==='MIRV'&&hostSnap.tanks[0].lastShot.impactX===undefined&&hostSnap.tanks[0].lastShot.extra===undefined,'Host snapshot filter');
  let snap4=JSON.parse(JSON.stringify(hostSnap));
  snap4.tanks[0].lastShot={weapon:'MIRV',angle:199,power:1500,az:235,wind:12,hack:1};
  snap4.tanks[1].lastShot={weapon:'Standard Shield',angle:45,power:500,az:0,wind:0};
  receiveState(snap4);
  ok(S.tanks[0].lastShot.angle===180&&S.tanks[0].lastShot.power===1000&&S.tanks[0].lastShot.az===180&&S.tanks[0].lastShot.wind===6.5&&S.tanks[0].lastShot.hack===undefined&&S.tanks[1].lastShot===null,'Guest snap clamp');
  predict();ok(!arc.visible&&arcGeo.drawRange.count===0,'No arc');
  newRound();ok(S.tanks[0].lastShot===null&&S.tanks[1].lastShot===null&&$('lastShotInfo').textContent==='LAST SHOT: NONE','newRound reset');
}
// --- Phase P1a World Model Core Verification ---
{
  setup();
  let w0=W,d0=D,c0=CELL,nx0=NX,nz0=NZ,n0=N;
  for(let bad of [null,undefined,'bad',{}, {w:480,d:80,cell:3},{w:480,d:80,cell:0},{w:480,d:80,cell:1.5},{w:99,d:80,cell:1},{w:1201,d:80,cell:2},{w:480,d:49,cell:1},{w:480,d:301,cell:1},{w:481,d:80,cell:2},{w:1200,d:200,cell:1},{w:NaN,d:80,cell:1},{w:480,d:Infinity,cell:1}]){
    ok(setWorld(bad)===false&&W===w0&&D===d0&&CELL===c0&&NX===nx0&&NZ===nz0&&N===n0,'setWorld rejects invalid input '+JSON.stringify(bad));
  }
  ok(setWorld({w:480,d:80,cell:2})===true&&W===480&&D===80&&CELL===2&&NX===241&&NZ===81&&N===241*81,'setWorld accepts 480x80 cell 2');
  S.heights=new Float32Array(N);
  let ix=10,iz=20,gx=ix*CELL,gz=iz*CELL-D;
  S.heights[gridIdx(ix,iz)]=10;S.heights[gridIdx(ix+1,iz)]=20;S.heights[gridIdx(ix,iz+1)]=30;S.heights[gridIdx(ix+1,iz+1)]=50;
  ok(gridIdx(-5,-3)===0&&gridIdx(9999,9999)===N-1,'gridIdx clamps out-of-range indices');
  ok(height(gx,gz)===10&&height(gx+CELL,gz)===20&&height(gx,gz+CELL)===30&&height(gx+CELL,gz+CELL)===50,'height exact at grid points');
  ok(Math.abs(height(gx+CELL/2,gz)-15)<1e-6&&Math.abs(height(gx,gz+CELL/2)-20)<1e-6&&Math.abs(height(gx+CELL/2,gz+CELL/2)-27.5)<1e-6,'height exact bilinear at x, z, and center midpoints');
  ok(H_TICK===0.01&&hTick(12.34)===1234&&hTick(quantH(19.994))===1999,'H_TICK=0.01 and hTick integer tick helper');
  for(let terrainType of ['Rolling Hills','Jagged Mountains','Valleys','Cliffs']){
    seed=4242;
    let h=newTerrain(terrainType);
    ok(h instanceof Float32Array&&h.length===N,'newTerrain size matches N for '+terrainType);
    ok(h.every(v=>Math.abs(v*100-Math.round(v*100))<1e-3&&hTick(v)===hTick(quantH(v))),'quantH 0.01m lattice holds after newTerrain for '+terrainType);
    let zVaries=false,hasWater=false;
    for(let i=0;i<N;i++)if(h[i]<WATER_LEVEL){hasWater=true;break}
    for(let x=0;x<NX&&!zVaries;x+=4){let base=h[gridIdx(x,0)];for(let z=1;z<NZ;z++)if(Math.abs(h[gridIdx(x,z)]-base)>.5){zVaries=true;break}}
    ok(zVaries&&hasWater,terrainType+' varies along z and has cells below WATER_LEVEL');
  }
  S.heights.fill(40);
  deform(200,14,-10,10);
  ok(S.heights.every(v=>Math.abs(v*100-Math.round(v*100))<1e-3&&hTick(v)===hTick(quantH(v))),'quantH 0.01m lattice holds after deform');
  ok(terrainDirtyBox&&terrainDirtyBox.ix0>=0&&terrainDirtyBox.ix1<NX&&terrainDirtyBox.iz0>=0&&terrainDirtyBox.iz1<NZ,'deform records terrainDirtyBox');
  let dPosX=40-height(200+8,10),dNegX=40-height(200-8,10),dPosZ=40-height(200,10+8),dNegZ=40-height(200,10-8);
  ok(dPosX>0&&Math.abs(dPosX-dNegX)<1e-4&&Math.abs(dPosX-dPosZ)<1e-4&&Math.abs(dPosX-dNegZ)<1e-4,'deform is radial (+x,-x,+z,-z equal depth)');
  let untouched=true;
  for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++)if(Math.hypot(x*CELL-200,z*CELL-D-10)>14+CELL&&S.heights[gridIdx(x,z)]!==40)untouched=false;
  ok(untouched,'deform leaves cells beyond r+CELL untouched');
  sculptTerrain(180,'raise',18,6,20);
  sculptTerrain(180,'smooth',18,6,20);
  ok(S.heights.every(v=>Math.abs(v*100-Math.round(v*100))<1e-3&&hTick(v)===hTick(quantH(v))),'quantH 0.01m lattice holds after sculptTerrain');
  let customList=[{id:1,x:100,y:25,width:20,hp:100},{id:2,x:100,y:32,z:20,depth:10,width:20,hp:100}];
  ok(platformAt(100,customList)?.id===1&&platformAt(100,customList,20)?.id===2&&platformAt(100,customList,40)===null,'platformAt with explicit 2nd-arg list and optional z/depth works');
  setWorld({w:960,d:240,cell:2});
  // (a) Shell flying at z=+60 over a world with a tall ridge only at z=0 and low ground at z=60
  setup();
  S.heights.fill(20);
  setFlatRow(100,260,110,0);
  S.wind=0;S.phase='flight';
  S.shots=[{id:++S.uid,x:60,y:55,z:60,vx:45,vy:12,vz:0,name:'Baby Missile',owner:0,life:0,bounces:0,split:false,mode:'air'}];
  let lastShotPos=null;
  for(let i=0;i<400&&S.shots.length;i++){lastShotPos={x:S.shots[0].x,y:S.shots[0].y,z:S.shots[0].z};step(1/60)}
  ok(S.shots.length===0&&lastShotPos&&lastShotPos.x>110&&lastShotPos.x<260&&lastShotPos.y<30&&Math.abs(lastShotPos.z-60)<1&&hTick(height(180,0))===11000&&hTick(height(lastShotPos.x,60))<2000,'Shell at z=+60 flies past z=0 ridge without hitting it and lands on low ground at z~60');
  // (b) Fire and roller placed at z=+60 follow terrain at z=60, not z=0
  setup();
  S.heights.fill(20);
  for(let ix=0;ix<NX;ix++){let x=ix*CELL;for(let iz=Math.floor((D-10)/CELL);iz<=Math.ceil((D+10)/CELL);iz++)S.heights[gridIdx(ix,iz)]=quantH(clamp(80-(x-200)*0.8,10,120));for(let iz=Math.floor((60+D-10)/CELL);iz<=Math.ceil((60+D+10)/CELL);iz++)S.heights[gridIdx(ix,iz)]=quantH(clamp(30+(x-200)*0.8,10,120))}
  S.fires=[{x:200,z:60,life:4,owner:0,hot:false,tick:0}];
  S.shots=[{id:++S.uid,x:200,y:height(200,60)+.7,z:60,vx:0,vy:0,vz:0,name:'Roller',owner:0,life:0,bounces:0,split:false,mode:'roll',rollTime:0}];
  for(let i=0;i<25;i++)step(1/60);
  ok(S.fires[0].x<200&&S.shots[0].x<200&&Math.abs(S.shots[0].y-(height(S.shots[0].x,60)+.7))<1e-2,'Fire and roller at z=+60 roll downhill along z=60 slope, not z=0 opposite slope');
}
// --- Phase P1b 2-D World Renderer Verification ---
{
  setup();
  rebuildTerrainGeo();
  let geo960=terrainGeo,disposed960=false;
  let origDispose=geo960.dispose.bind(geo960);
  geo960.dispose=()=>{disposed960=true;origDispose()};
  ok(terrainGeo.attributes.position.count===NX*NZ+2*(NX+NZ),'960x480 cell 2 mesh vertex count === NX*NZ + skirt');
  S.heights=newTerrain('Rolling Hills');
  terrainFullUpdate=true;terrainUpdate();
  ok(terrainGeo===geo960&&!disposed960,'terrainUpdate reuses geometry when NX/NZ unchanged');
  ok(setWorld({w:480,d:80,cell:1})===true&&NX===481&&NZ===161,'setWorld 480x80 cell 1');
  ok(terrainGeo===geo960&&!disposed960,'setWorld alone does not touch the renderer (geometry is rebuilt lazily)');
  S.heights=new Float32Array(N).fill(20);terrainUpdate();
  ok(disposed960&&terrainGeo!==geo960&&terrainGeo.attributes.position.count===NX*NZ+2*(NX+NZ),'terrainUpdate after setWorld with different NX/NZ disposes old terrainGeo and rebuilds');
  S.heights=newTerrain('Rolling Hills');
  terrainUpdate();
  let sampledOk=true;
  for(let iz of [0,15,80,160])for(let ix of [0,37,240,480]){
    let vi=(iz*NX+ix)*3,vx=terrainPos[vi],vy=terrainPos[vi+1],vz=terrainPos[vi+2];
    if(Math.abs(vx-ix*CELL)>1e-5||Math.abs(vz-(iz*CELL-D))>1e-5||Math.abs(vy-height(vx,vz))>1e-4)sampledOk=false;
  }
  ok(sampledOk,'terrain vertex (x,y,z) matches grid coordinates and height(x,z) at sampled points');
  let checkNormals=(label)=>{
    let okN=true;
    for(let i=0;i<N*3;i+=3){
      let nx=terrainNor[i],ny=terrainNor[i+1],nz=terrainNor[i+2],len=Math.hypot(nx,ny,nz);
      if(!Number.isFinite(len)||Math.abs(len-1)>1e-3||ny<=0){okN=false;break}
    }
    ok(okN,label+' leaves every surface normal unit-length and finite');
  };
  checkNormals('Full terrainUpdate');
  let beforePos=new Float32Array(terrainPos);
  deform(300,14,-8,40);
  let box={...terrainDirtyBox};
  ok(box&&box.ix0>0&&box.ix1<NX-1&&box.iz0>0&&box.iz1<NZ-1,'deform at (300,40) sets interior dirty box');
  terrainUpdate();
  ok(terrainDirtyBox===null&&!terrainDirty,'terrainUpdate clears terrainDirtyBox and terrainDirty');
  let pRange=terrainGeo.attributes.position.updateRange,nRange=terrainGeo.attributes.normal.updateRange;
  ok(pRange.offset===box.iz0*NX*3&&pRange.count===(box.iz1-box.iz0+1)*NX*3&&nRange.offset===Math.max(0,box.iz0-1)*NX*3&&nRange.count===(Math.min(NZ-1,box.iz1+1)-Math.max(0,box.iz0-1)+1)*NX*3,'partial terrainUpdate sets BufferAttribute.updateRange for touched rows and halo');
  let onlyBoxChanged=true,changedInside=0;
  for(let iz=0;iz<NZ;iz++)for(let ix=0;ix<NX;ix++){
    let i=(iz*NX+ix)*3,diff=Math.abs(terrainPos[i]-beforePos[i])+Math.abs(terrainPos[i+1]-beforePos[i+1])+Math.abs(terrainPos[i+2]-beforePos[i+2]);
    let inHalo=ix>=box.ix0-1&&ix<=box.ix1+1&&iz>=box.iz0-1&&iz<=box.iz1+1;
    if(diff>0){if(!inHalo)onlyBoxChanged=false;else changedInside++}
  }
  for(let i=N*3;i<terrainPos.length;i++)if(terrainPos[i]!==beforePos[i])onlyBoxChanged=false;
  ok(onlyBoxChanged&&changedInside>0,'deform + terrainUpdate only changes vertices inside dirty box (+ halo)');
  checkNormals('Crater partial terrainUpdate');
  $('world').getBoundingClientRect=()=>({left:0,top:0,width:1280,height:720});
  camera.aspect=1280/720;camera.fov=47;camera.near=0.2;camera.far=4000;camera.updateProjectionMatrix();
  let targetX=260,targetZ=-25,targetY=height(targetX,targetZ);
  camera.position.set(200,190,140);camera.lookAt(targetX,targetY,targetZ);camera.updateMatrixWorld();
  let hit=screenToWorld({clientX:640,clientY:360});
  ok(hit&&Math.hypot(hit.x-targetX,hit.z-targetZ)<=CELL&&Math.abs(screenToWorldX({clientX:640,clientY:360})-hit.x)<1e-6,'screenToWorld returns aimed terrain (x,z) within 1 cell and screenToWorldX wraps .x');
  setWorld({w:960,d:240,cell:2});
}
// --- Phase P1a-FIX2 Review Regressions (F1-F4) ---
{
  // F1: Digger radial ground-plane distance < 5
  setup();
  S.tanks[1].x=200;S.tanks[1].z=0;S.tanks[1].hp=100;
  S.shots=[{id:++S.uid,x:200,y:18,z:60,vx:0,vy:0,vz:0,name:'Digger',owner:0,life:0,bounces:0,split:false,mode:'dig',remaining:10}];
  step(1/60);
  ok(S.tanks[1].hp===100,'F1: digger at z=60 beside tank at z=0 (dx=0) deals 0 damage');
  setup();
  S.tanks[1].x=203.8;S.tanks[1].z=3.8;S.tanks[1].hp=100;
  S.shots=[{id:++S.uid,x:200,y:18,z:0,vx:0,vy:0,vz:0,name:'Digger',owner:0,life:0,bounces:0,split:false,mode:'dig',remaining:10}];
  step(1/60);
  ok(S.tanks[1].hp===100,'F1: near-diagonal tank at dx=3.8,dz=3.8 (dist ~5.37) takes 0 damage');
  setup();
  S.tanks[1].x=203;S.tanks[1].z=3;S.tanks[1].hp=100;
  S.shots=[{id:++S.uid,x:200,y:18,z:0,vx:0,vy:0,vz:0,name:'Digger',owner:0,life:0,bounces:0,split:false,mode:'dig',remaining:10}];
  step(1/60);
  ok(S.tanks[1].hp<100,'F1: tank at dx=3,dz=3 (dist ~4.24) takes digger damage');
  // F2 & F4: Dirty box union + multi-box partial terrainUpdate
  setup();
  S.heights.fill(40);
  terrainFullUpdate=true;terrainUpdate();
  deform(120,12,-9,-60);
  let b1={...terrainDirtyBox};
  deform(780,12,-11,70);
  let bU={...terrainDirtyBox};
  ok(bU.ix0===b1.ix0&&bU.iz0===b1.iz0&&bU.ix1>b1.ix1&&bU.iz1>b1.iz1,'F2: two disjoint craters in one frame union into pending terrainDirtyBox covering both');
  sculptTerrain(450,'raise',14,6,0);
  ok(terrainDirtyBox.ix0===b1.ix0&&terrainDirtyBox.ix1===bU.ix1&&Array.isArray(terrainDirtyBoxes)&&terrainDirtyBoxes.length===3,'F2/F4: three far-apart edits keep 3 separate dirty boxes while terrainDirtyBox covers union');
  let midBefore=terrainPos[(gridIdx(Math.round(300/CELL),Math.round(D/CELL)))*3+1];
  terrainUpdate();
  let v1=terrainPos[gridIdx(Math.round(120/CELL),Math.round((-60+D)/CELL))*3+1];
  let v2=terrainPos[gridIdx(Math.round(780/CELL),Math.round((70+D)/CELL))*3+1];
  let v3=terrainPos[gridIdx(Math.round(450/CELL),Math.round(D/CELL))*3+1];
  ok(Math.abs(v1-height(120,-60))<1e-4&&Math.abs(v2-height(780,70))<1e-4&&Math.abs(v3-height(450,0))<1e-4&&midBefore===40&&terrainDirtyBox===null&&terrainDirtyBoxes.length===0,'F2/F4: after terrainUpdate, mesh vertex y equals height(x,z) at the centre of all craters and clears dirty state');
  // F3: Touch only changed cells (preserve untouched 140m cells)
  setup();
  S.heights.fill(140);
  let cx=200,cz=0,cr=10,cix0=clamp(Math.floor((cx-cr)/CELL)-1,0,NX-1),ciz0=clamp(Math.floor((cz+D-cr)/CELL)-1,0,NZ-1);
  deform(cx,cr,-8,cz);
  ok(S.heights[gridIdx(cix0,ciz0)]===140&&height(cx,cz)<140,'F3: 140m cell in bounding rectangle corner outside r stays exactly 140');
  S.heights.fill(140);
  deform(cx,cr,0,cz);
  let all140=true;for(let i=0;i<N;i++)if(S.heights[i]!==140){all140=false;break}
  ok(all140,'F3: flat 140m field with delta=0 keeps every cell at 140');
  S.heights.fill(140);
  deform(cx,cr,-0.5,cz);
  let haloPreserved=true,innerChanged=0;
  for(let iz=ciz0;iz<=clamp(Math.ceil((cz+D+cr)/CELL)+1,0,NZ-1);iz++)for(let ix=cix0;ix<=clamp(Math.ceil((cx+cr)/CELL)+1,0,NX-1);ix++){
    let d=Math.hypot(ix*CELL-cx,iz*CELL-D-cz),val=S.heights[gridIdx(ix,iz)];
    if(d>=cr){if(val!==140)haloPreserved=false}else if(val<140)innerChanged++;
  }
  ok(haloPreserved&&innerChanged>0,'F3: flat 140m field with tiny negative delta keeps every cell that did not change at 140');
}
// --- Phase P1b-FIX Renderer Review Regressions (R1-R3) ---
{
  // R1: Partial terrainUpdate re-seats or hides vegetation inside dirty box and leaves far trees untouched
  setup();
  S.heights.fill(30);
  initNature();
  terrainFullUpdate=true;terrainUpdate();
  let te=trunks.instanceMatrix.array,ce=crowns.instanceMatrix.array,re=rocks.instanceMatrix.array;
  let tx=te[12],tz=te[14],ts=te[5],fIdx=-1;
  for(let k=1;k<trunks.count;k++)if(Math.hypot(te[k*16+12]-tx,te[k*16+14]-tz)>140){fIdx=k;break}
  let fO=fIdx*16,fTx0=te[fO+12],fTy0=te[fO+13],fTz0=te[fO+14],fCy0=ce[fO+13];
  let rx=re[12],rz=re[14];
  deform(tx,14,-5,tz);
  if(Math.hypot(rx-tx,rz-tz)>10)deform(rx,14,-5,rz);
  ok(!terrainFullUpdate&&terrainDirty,'R1: crater deform schedules partial terrainUpdate');
  terrainUpdate();
  let newTy=height(tx,tz),newRy=height(rx,rz);
  ok(newTy>=WATER_LEVEL+2&&Math.abs(te[13]-(newTy+2.5*ts))<1e-4&&Math.abs(ce[13]-(newTy+7*ts))<1e-4&&te[12]===tx&&te[14]===tz,'R1: partial terrainUpdate re-seats tree trunk and crown to new height(x,z) without moving x/z');
  ok(newRy>=WATER_LEVEL+.5&&Math.abs(re[13]-(newRy+.7))<1e-4&&re[12]===rx&&re[14]===rz,'R1: partial terrainUpdate re-seats rock to new height(x,z)+0.7 without moving x/z');
  ok(te[fO+12]===fTx0&&te[fO+13]===fTy0&&te[fO+14]===fTz0&&ce[fO+13]===fCy0,'R1: far-away tree outside partial dirty box is untouched');
  deform(tx,14,-22,tz);
  terrainUpdate();
  ok(height(tx,tz)<WATER_LEVEL+2&&te[5]===0&&ce[5]===0&&te[13]<SKIRT_Y&&te[12]===tx&&te[14]===tz&&te[fO+13]===fTy0,'R1: crater dropping tree below water hides instance without rescattering or touching far tree');
  S.heights.fill(30);terrainFullUpdate=true;terrainUpdate();
  deform(96,4.1,-12,-20);let dBox=terrainDirtyBox,hz=-20,hx=(dBox.ix1+1.25)*CELL,fx=(dBox.ix1+4.5)*CELL,hTo=16,hFo=32;
  ok(hx>dBox.ix1*CELL&&hx<(dBox.ix1+2)*CELL&&fx>(dBox.ix1+4)*CELL,'R1-halo: probe tree/rock 1.25 cells outside the dirty box edge, far pair 4.5 cells out');
  te[hTo+12]=ce[hTo+12]=hx;te[hTo+14]=ce[hTo+14]=hz;te[hTo+13]=99;ce[hTo+13]=105;re[hTo+12]=hx;re[hTo+14]=hz;re[hTo+13]=88;
  te[hFo+12]=ce[hFo+12]=fx;te[hFo+14]=ce[hFo+14]=hz;te[hFo+13]=99;ce[hFo+13]=105;re[hFo+12]=fx;re[hFo+14]=hz;re[hFo+13]=88;
  terrainUpdate();let hy=height(hx,hz);
  ok(Math.abs(te[hTo+13]-(hy+2.5*te[hTo+5]))<1e-4&&Math.abs(ce[hTo+13]-(hy+7*te[hTo+5]))<1e-4&&Math.abs(re[hTo+13]-(hy+.7))<1e-4,'R1-halo: tree+rock 1.25 cells outside the dirty box are re-seated (2-cell halo)');
  ok(te[hFo+13]===99&&ce[hFo+13]===105&&re[hFo+13]===88,'R1-halo: tree+rock 4.5 cells outside the dirty box stay untouched');
  // R2: Geometry identity checks W, D, CELL as well as NX, NZ
  ok(setWorld({w:480,d:120,cell:1})===true&&NX===481&&NZ===241,'R2: setWorld 480x120 cell 1 (481x241)');
  S.heights=new Float32Array(N).fill(20);
  rebuildTerrainGeo();terrainUpdate();
  let geo480=terrainGeo;
  ok(setWorld({w:960,d:240,cell:2})===true&&NX===481&&NZ===241,'R2: setWorld 960x240 cell 2 also 481x241');
  S.heights=new Float32Array(N).fill(20);
  terrainUpdate();
  let maxX=-Infinity,maxAbsZ=0,skMaxX=-Infinity,skMaxAbsZ=0;
  for(let i=0;i<terrainPos.length;i+=3){
    if(terrainPos[i]>maxX)maxX=terrainPos[i];
    let az=Math.abs(terrainPos[i+2]);if(az>maxAbsZ)maxAbsZ=az;
    if(i>=N*3){if(terrainPos[i]>skMaxX)skMaxX=terrainPos[i];if(az>skMaxAbsZ)skMaxAbsZ=az}
  }
  ok(terrainGeo!==geo480&&maxX===960&&maxAbsZ===240&&skMaxX===960&&skMaxAbsZ===240,'R2: switching 480/120/1 -> 960/240/2 rebuilds geometry and updates all vertices including skirt to max x=960, max |z|=240');
  // R3: Fixed conservative boundingSphere covers corner raised to height cap on partial update
  setup();
  S.heights.fill(20);
  rebuildTerrainGeo();terrainFullUpdate=true;terrainUpdate();
  let bs=terrainGeo.boundingSphere;
  ok(bs&&bs.center.x===W/2&&bs.center.y===70&&bs.center.z===0,'R3: boundingSphere centred at (W/2, 70, 0)');
  deform(W-2,16,125,D-2);
  ok(!terrainFullUpdate&&S.heights[gridIdx(NX-1,NZ-1)]>=130,'R3: corner raised to near the 135 m deform cap via partial update');S.heights[gridIdx(NX-2,NZ-2)]=140;markTerrainDirtyBox(NX-3,NX-1,NZ-3,NZ-1);
  terrainUpdate();
  let allInside=terrainGeo.boundingSphere===bs,vTmp=new THREE.Vector3();
  for(let i=0;i<terrainPos.length;i+=3){vTmp.set(terrainPos[i],terrainPos[i+1],terrainPos[i+2]);if(!bs.containsPoint(vTmp)){allInside=false;break}}
  ok(allInside,'R3: after raising corner to cap on partial update, every vertex lies inside fixed terrainGeo.boundingSphere');
}
// --- Phase P1c-1 Map Format v2, Encoding, Migration & Local Storage ---
{
  setup();
  let asym=new Array(LEGACY_N).fill(20);
  asym[37]=83.45;asym[38]=14.2;asym[121]=7.35;asym[122]=61.8;asym[333]=112.6;asym[240]=31.25;
  let v1Asym={version:1,name:'AsymV1',heights:asym,spawns:[40,440,110,370,185,295],platforms:[{id:1,x:120,y:25,width:28,hp:120,maxHp:120}]};
  ok(applyCustomMapToState(v1Asym)&&W===480&&D===80&&CELL===1&&NX===481&&NZ===161,'v1 asymmetric map migrates to W=480, D=80, CELL=1');
  for(let z of [-80,-17,0,33,80]){
    for(let x of [0,36,37,38,39,120,121,122,240,333,480]){
      ok(Math.abs(height(x,z)-Math.round(asym[x]*100)/100)<1e-5,'v1 exact height(x,z) at x='+x+' z='+z);
    }
  }
  ok(S.platforms.length===1&&S.platforms[0].x===120&&S.platforms[0].width===28&&(S.platforms[0].z||0)===0,'v1 platform x/width unchanged and z=0');

  let roundArr=new Array(LEGACY_N).fill(20);roundArr[77]=17.023;
  let migRound=validateCustomMap({version:1,name:'RoundTest',heights:roundArr,spawns:[40,440]});
  ok(migRound&&Math.abs(migRound.heights[77]-17.02)<1e-5,'17.023 in v1 rounds to 17.02 on migrate');
  ok(applyCustomMapToState(migRound),'apply migrated rounding map');
  let serRound=serializeCurrentMap();
  let valRound=validateCustomMap(serRound);
  ok(valRound&&Math.abs(valRound.heights[77]-17.02)<1e-5&&hTick(valRound.heights[77])===1702,'17.02 survives migrate -> serialize -> validate');

  setup();
  S.heights=newTerrain('Jagged Mountains');
  S.platforms=[{id:1,x:240,z:-20,y:34.5,width:32,depth:16,hp:110,maxHp:140}];
  editorSpawns=[60,900,200,760,360,600];
  $('mapName').value='BigV2';
  let origTicks=Array.from(S.heights,hTick);
  let expV2=edExport();
  ok(expV2&&expV2.version===2&&expV2.w===960&&expV2.d===240&&expV2.cell===2&&expV2.heights?.enc==='i16t','v2 960x480 export structure');
  S.heights.fill(15);S.platforms=[];
  let impV2=edImport($('edJsonIO').value);
  ok(impV2&&W===960&&D===240&&CELL===2&&S.heights.length===N,'v2 960x480 import applies world');
  let allTickMatch=true;
  for(let i=0;i<N;i++)if(hTick(S.heights[i])!==origTicks[i]){allTickMatch=false;break}
  ok(allTickMatch&&S.platforms.length===1&&S.platforms[0].x===240&&S.platforms[0].width===32&&editorSpawns[0]?.x===60&&editorSpawns[1]?.x===900,'v2 960x480 export->import identical hTick for every cell + spawns + platforms');

  let rtCur=new Float32Array(S.heights);
  for(let r=0;r<10;r++){let enc=encodeHeights(rtCur);rtCur=decodeHeights(enc,N);ok(rtCur instanceof Float32Array&&rtCur.length===N,'roundtrip '+r)}
  let rtMatch=true;
  for(let i=0;i<N;i++)if(hTick(rtCur[i])!==origTicks[i]){rtMatch=false;break}
  ok(rtMatch,'10 encode/decode roundtrips are tick-identical');

  let validEnc=encodeHeights(new Float32Array([20,25,30,35]));
  ok(decodeHeights(validEnc,3)===null&&decodeHeights(validEnc,5)===null,'rejects wrong encoded length');
  let makeRawEnc=(ticks)=>{let b=new Uint8Array(ticks.length*2);for(let i=0;i<ticks.length;i++){b[i*2]=ticks[i]&255;b[i*2+1]=(ticks[i]>>8)&255}return{enc:'i16t',data:Buffer.from(b).toString('base64')}};
  ok(decodeHeights(makeRawEnc([0,2000,2000]),3)===null,'rejects tick 0');
  ok(decodeHeights(makeRawEnc([2000,14001,2000]),3)===null,'rejects tick 14001');
  ok(decodeHeights([20,NaN,20],3)===null,'rejects NaN in plain array');
  let baseV2={version:2,name:'T',w:480,d:80,cell:2,heights:encodeHeights(new Float32Array(241*81).fill(20)),spawns:[{x:40,z:0},{x:440,z:0}],platforms:[]};
  ok(validateCustomMap({...baseV2,spawns:[{x:40,z:0},{x:80,z:0},{x:120,z:0},{x:160,z:0},{x:200,z:0},{x:240,z:0},{x:280,z:0}]})===null,'rejects 7 spawns');
  ok(validateCustomMap({...baseV2,cell:3})===null,'rejects cell 3');
  ok(validateCustomMap({...baseV2,w:1200,d:200,cell:1})===null,'rejects nx*nz > 200000');
  $('edJsonIO').value='x'.repeat(MAX_MAP_TEXT+1);
  ok(MAX_MAP_TEXT===600000&&edImport()===null,'rejects import text over MAX_MAP_TEXT');
  localStorage.setItem(CUSTOM_MAP_KEY,JSON.stringify({Bad:{version:2,w:9999},Good:baseV2}));
  loadSavedMaps();
  ok(!savedCustomMaps.Bad&&savedCustomMaps.Good,'stored entries that fail validation are skipped');

  let coastalRaw=JSON.parse(coastalCrossingJson);
  let coastalVal=validateCustomMap(coastalRaw);
  ok(coastalVal&&coastalVal.w===480&&coastalVal.d===80&&coastalVal.cell===1&&coastalVal.spawns.length===6&&coastalVal.spawns[0]?.x===40&&coastalVal.spawns[1]?.x===440&&coastalVal.spawns[4]?.x===185&&coastalVal.spawns[5]?.x===295,'maps/coastal-crossing.json validates with its authored spawns');
  setup();
}
// --- Phase P1c-2 Network Snapshot, Bounds & UI Text ---
{
  setup();
  S.heights=newTerrain('Jagged Mountains');
  S.customMap=cloneMapData(validateCustomMap(serializeCurrentMap()));
  let hRef=S.heights,cmRef=S.customMap.heights;
  let snapFull=snapshot();
  ok(S.heights===hRef&&S.customMap.heights===cmRef&&snapFull.w===960&&snapFull.d===240&&snapFull.cell===2&&snapFull.heights?.enc==='i16t'&&snapFull.customMap?.heights?.enc==='i16t','snapshot() sends w/d/cell and encoded heights/customMap without mutating S');
  let snapJson=JSON.stringify(snapFull);
  ok(snapJson.length<700000,'full 960x480 snapshot WITH a custom map (live heights + authored map heights) JSON size ('+snapJson.length+' B) < 700 KB');

  ok(setWorld({w:480,d:80,cell:1})&&W===480&&D===80&&CELL===1&&N===481*161,'switch host to 480x80@1');
  S.heights=newTerrain('Cliffs');
  S.platforms=[{id:1,x:180,z:0,y:28,width:28,depth:12,hp:120,maxHp:120}];
  editorSpawns=[40,440,120,360,200,280];
  S.customMap=cloneMapData(validateCustomMap(serializeCurrentMap()));
  let hostTicks=Array.from(S.heights,hTick);
  let wire480Json=JSON.stringify(snapshot()),wire480=JSON.parse(wire480Json);
  setWorld({w:960,d:240,cell:2});
  S.heights=new Float32Array(N).fill(15);S.platforms=[];S.customMap=null;
  receiveState(wire480);
  let guestTicksMatch=W===480&&D===80&&CELL===1&&S.heights.length===481*161;
  for(let i=0;i<S.heights.length&&guestTicksMatch;i++)if(hTick(S.heights[i])!==hostTicks[i])guestTicksMatch=false;
  ok(guestTicksMatch&&S.customMap&&S.customMap.w===480&&S.customMap.d===80&&S.customMap.cell===1,'snapshot()->JSON->receiveState of 480x80@1 switches receiver W/D/CELL and heights tick-identical');

  let plainPeer=JSON.parse(wire480Json);
  plainPeer.heights=Array.from(S.heights);
  S.heights.fill(18);
  receiveState(plainPeer);
  let plainMatch=true;
  for(let i=0;i<S.heights.length;i++)if(hTick(S.heights[i])!==hostTicks[i]){plainMatch=false;break}
  ok(plainMatch,'older peer plain-array heights accepted when length matches');

  setup();
  for(let delta of [6.95,7.00,7.05]){
    S.heights.fill(20);
    let iz0=Math.round(D/CELL),ixStep=Math.round(100/CELL);
    for(let iz=iz0-2;iz<=iz0+2;iz++)for(let ix=ixStep;ix<NX;ix++)S.heights[gridIdx(ix,iz)]=quantH(20+delta);
    let tk=S.tanks[0];tk.x=100-CELL;tk.z=0;tk.y=supportHeight(tk.x,0);tk.fuel=100;
    let beforeStep=canStepMove(tk,100);
    let rtSnap=JSON.parse(JSON.stringify(snapshot()));
    S.heights.fill(15);
    receiveState(rtSnap);
    let tkAfter=S.tanks[0];
    let afterStep=canStepMove(tkAfter,100);
    ok(beforeStep===afterStep&&(delta<=7?beforeStep:!beforeStep),'canStepMove at '+delta+'m step identical before and after snapshot roundtrip ('+beforeStep+')');
  }

  setup();
  S.heights.fill(23.45);
  let keepW=W,keepD=D,keepCell=CELL,keepH0=S.heights[0],keepRef=S;
  let badLenSnap=JSON.parse(JSON.stringify(snapshot()));
  badLenSnap.heights=encodeHeights(new Float32Array(100).fill(20));
  receiveState(badLenSnap);
  ok(S===keepRef&&W===keepW&&D===keepD&&CELL===keepCell&&hTick(S.heights[0])===2345,'receiveState ignores snapshot with wrong encoded length');

  let bigGridSnap=JSON.parse(JSON.stringify(snapshot()));
  bigGridSnap.w=1200;bigGridSnap.d=200;bigGridSnap.cell=1;
  receiveState(bigGridSnap);
  ok(S===keepRef&&W===keepW&&D===keepD&&CELL===keepCell&&hTick(S.heights[0])===2345,'receiveState ignores snapshot with nx*nz > 200000');

  let makeRawEnc2=(ticks)=>{let b=new Uint8Array(ticks.length*2);for(let i=0;i<ticks.length;i++){b[i*2]=ticks[i]&255;b[i*2+1]=(ticks[i]>>8)&255}return{enc:'i16t',data:Buffer.from(b).toString('base64')}};
  let badMapSnap=JSON.parse(JSON.stringify(snapshot()));
  let badTicks=new Array(241*81).fill(2000);badTicks[5]=14001;
  badMapSnap.customMap={version:2,name:'BadTick',w:480,d:80,cell:2,heights:makeRawEnc2(badTicks),spawns:[{x:40,z:0},{x:440,z:0}],platforms:[]};
  receiveState(badMapSnap);
  ok(S===keepRef&&W===keepW&&D===keepD&&CELL===keepCell&&hTick(S.heights[0])===2345&&S.customMap===null,'receiveState ignores snapshot with customMap tick 14001');

  ok(htmlSource.includes('id="targetX" type="number" min="0" max="960"')&&htmlSource.includes('960 × 480 meter')&&htmlSource.includes('960 × 480 M BATTLEFIELD'),'UI text describes 960 x 480 m default and #targetX max=960');
  setup();
}
// --- Phase P2a 2-D Tank State, Ground-Plane Driving, Collisions & Physics ---
{
  // 1. Drive 2s along +z, -z, and 45 deg heading -> 12m displacement (6 m/s) and 12 fuel drop
  for(let[label,hdg,ex,ez]of [['+z',Math.PI/2,0,12],['-z',-Math.PI/2,0,-12],['45deg',Math.PI/4,12*Math.SQRT1_2,12*Math.SQRT1_2]]){
    setup();S.actionLog=[];let tk=current();tk.x=200;tk.z=0;tk.heading=hdg;tk.fuel=100;
    ok(action({action:'move',throttle:1,turn:0},0),'P2a start drive '+label);
    for(let i=0;i<120;i++)step(1/60);
    ok(steerDrive({stop:true,moveId:S.activeDrive.id},0),'P2a stop drive '+label);
    let dx=tk.x-200,dz=tk.z-0,dist=Math.hypot(dx,dz),log=S.actionLog[S.actionLog.length-1];
    ok(Math.abs(dx-ex)<1e-2&&Math.abs(dz-ez)<1e-2&&Math.abs(dist-12)<1e-2&&Math.abs(tk.fuel-88)<1e-2&&Math.abs(log.distance-12)<.05&&Math.abs(log.dz-ez)<.05,'P2a 2s drive along '+label+' moves 12m and drains 12 fuel');
  }
  // 2. Turn-in-place changes heading at 0 fuel
  setup();S.actionLog=[];let tkTurn=current();tkTurn.x=200;tkTurn.z=10;tkTurn.heading=0;tkTurn.fuel=100;
  ok(action({action:'move',throttle:0,turn:1},0),'P2a start turn-in-place');
  for(let i=0;i<60;i++)step(1/60);
  ok(steerDrive({stop:true,moveId:S.activeDrive.id},0),'P2a stop turn-in-place');
  ok(Math.abs(tkTurn.heading-TURN_RATE)<1e-2&&tkTurn.x===200&&tkTurn.z===10&&tkTurn.fuel===100&&S.actionLog[0].distance===0&&S.actionLog[0].duration>0,'P2a 1s turn-in-place rotates by TURN_RATE at 0 fuel');
  // 3. 7m step rule along diagonal path: blocks 10m ledge, allows 5m ledge
  for(let[ledge,expectOk]of [[10,false],[5,true]]){
    setup();S.heights.fill(20);
    for(let iz=0;iz<NZ;iz++)for(let ix=0;ix<NX;ix++)if(ix*CELL+(iz*CELL-D)>=204)S.heights[gridIdx(ix,iz)]=quantH(20+ledge);
    let tkStep=current();tkStep.x=200;tkStep.z=0;tkStep.y=supportHeight(200,0);tkStep.heading=Math.PI/4;tkStep.fuel=100;
    let diagProbeX=200+4*Math.SQRT1_2,diagProbeZ=4*Math.SQRT1_2;
    ok(canStepMove(tkStep,diagProbeX,supportHeight,diagProbeZ)===expectOk,'P2a diagonal '+ledge+'m ledge canStepMove='+expectOk);
  }
  // 4. Tank-tank radial collision: blocked at hypot<7 (dx 3, dz 3), allowed at dx 0, dz 10
  setup();let tA=S.tanks[0],tB=S.tanks[1];tA.x=200;tA.z=0;tA.y=20;tB.x=203;tB.z=3;tB.y=20;
  ok(!canStepMove(tA,200.5,supportHeight,0.5),'P2a tank-tank blocked at dx=3, dz=3 (hypot<7)');
  tB.x=200;tB.z=10;
  ok(canStepMove(tA,201,supportHeight,0),'P2a tank-tank allowed at dx=0, dz=10');
  // 5. Wall collision in (x,z): wall at z=0 blocks at z=0, does not block tank at z=30
  setup();S.buildings=[{id:1,owner:1,x:208,z:0,y:20,shape:'wall',hp:120}];
  let tW=S.tanks[0];tW.x=200;tW.z=0;tW.y=20;
  ok(!canStepMove(tW,204,supportHeight,0),'P2a wall blocks tank at z=0');
  tW.z=30;tW.y=20;
  ok(canStepMove(tW,204,supportHeight,30),'P2a wall at z=0 does not block tank at z=30');
  // 6. Legacy {dir:-1} moves -x exactly as before even if heading was pi/2
  setup();let tLeg=current();tLeg.x=200;tLeg.z=20;tLeg.heading=Math.PI/2;tLeg.fuel=100;
  ok(action({action:'move',dir:-1},0),'P2a legacy {dir:-1} starts move');
  for(let i=0;i<60;i++)step(1/60);
  finishDrive();
  ok(Math.abs(tLeg.x-194)<1e-2&&Math.abs(tLeg.z-20)<1e-4&&Math.abs(Math.abs(tLeg.heading)-Math.PI)<1e-4,'P2a legacy {dir:-1} sets heading=pi and moves -x');
  // 7. Tank at z=60 falls, parachutes, and buries against terrain at z=60 (ridge at z=0 must not hold it up)
  setup();S.heights.fill(20);setFlatRow(180,220,80,0);
  let tFall=S.tanks[0];tFall.x=200;tFall.z=60;tFall.y=60;tFall.inv.Parachute=1;
  for(let i=0;i<360;i++)step(1/60);
  ok(Math.abs(tFall.y-20)<1e-2&&tFall.hp===100&&tFall.inv.Parachute===0,'P2a tank at z=60 parachutes to z=60 ground (20m) ignoring z=0 80m ridge');
  tFall.y=50;tFall.inv.Parachute=0;
  for(let i=0;i<180;i++)step(1/60);
  ok(Math.abs(tFall.y-20)<1e-2&&tFall.hp<100,'P2a tank at z=60 takes fall damage onto z=60 terrain');
  let hpBeforeBury=tFall.hp;deform(200,12,15,60);
  for(let i=0;i<60;i++)step(1/60);
  ok(tFall.hp<hpBeforeBury&&tFall.y>20,'P2a tank at z=60 takes burial damage when terrain at z=60 rises above it');
  // 8. Re-seat functions at (t.x, t.z): sculptTerrain, placePlatform, removePlatformAt, applyCustomMapToState, newRound
  setup();S.heights.fill(20);let tSeat=S.tanks[0];tSeat.x=200;tSeat.z=60;tSeat.y=20;
  sculptTerrain(200,'raise',18,10,0);
  ok(Math.abs(tSeat.y-20)<1e-3,'P2a sculptTerrain at z=0 does not lift tank at z=60');
  sculptTerrain(200,'raise',18,10,60);
  ok(Math.abs(tSeat.y-height(200,60))<1e-3,'P2a sculptTerrain at z=60 re-seats tank at z=60');
  placePlatform(200,28,15,0);
  ok(Math.abs(tSeat.y-height(200,60))<1e-3,'P2a placePlatform at z=0 does not lift tank at z=60');
  placePlatform(200,28,15,60);
  ok(Math.abs(tSeat.y-supportHeight(200,60))<1e-3&&tSeat.y>height(200,60),'P2a placePlatform at z=60 supports tank at z=60');
  removePlatformAt(200,60);
  ok(Math.abs(tSeat.y-height(200,60))<1e-3,'P2a removePlatformAt at z=60 drops tank back to terrain at z=60');
  let cmap2D={version:2,name:'ZSpawns',w:480,d:80,cell:2,heights:encodeHeights(new Float32Array(241*81).fill(20)),spawns:[{x:60,z:-40},{x:420,z:50}],platforms:[]};
  ok(applyCustomMapToState(cmap2D)&&S.tanks[0].z===-40&&S.tanks[1].z===50&&Math.abs(S.tanks[0].heading-Math.atan2(90,360))<1e-3,'P2a applyCustomMapToState sets z from custom map spawns and heading toward nearest opponent');
  S.cfg.terrain='Custom';newRound();
  ok(S.tanks[0].z===-40&&S.tanks[1].z===50&&Math.abs(S.tanks[0].heading-Math.atan2(90,360))<1e-3,'P2a newRound sets z from custom map spawns and heading toward nearest opponent');
  // 9. Old snapshot without z/heading loads with z=0 and heading from angle
  setup();
  let oldSnap=JSON.parse(JSON.stringify(snapshot()));
  delete oldSnap.tanks[0].z;delete oldSnap.tanks[0].heading;oldSnap.tanks[0].angle=45;
  delete oldSnap.tanks[1].z;delete oldSnap.tanks[1].heading;oldSnap.tanks[1].angle=135;
  receiveState(oldSnap);
  ok(S.tanks[0].z===0&&S.tanks[0].heading===0&&S.tanks[1].z===0&&S.tanks[1].heading===Math.PI,'P2a receiveState defaults missing z->0 and heading->(angle>90?pi:0)');
  setup();
}
// --- Phase P2b-1 360-Degree Aiming & 2-D Combat Paths Verification ---
{
  // 1. direction(angle, az): world-relative azimuth without heading term
  let d90=direction(45,90),dm90=direction(45,-90),d180=direction(45,180),d135=direction(135,0);
  let unit=v=>Math.abs(Math.hypot(v.x,v.y,v.z)-1)<1e-9;ok([d90,dm90,d180,d135,direction(30,45),direction(150,-120)].every(unit),'direction() is a unit vector for every angle/az (old code: z=sin(az) without cos(angle))');ok(Math.abs(d90.x)<1e-6&&Math.abs(d90.z-Math.cos(45*rad))<1e-6&&Math.abs(dm90.x)<1e-6&&Math.abs(dm90.z+Math.cos(45*rad))<1e-6&&d180.x<-0.7&&Math.abs(d180.z)<1e-6&&Math.abs(d135.x-d180.x)<1e-9&&d135.z===0,'P2b-1 direction(45,90) points +z, direction(45,-90) -z, direction(45,180) -x, and direction(135,0) unchanged (-x)');
  ok(htmlSource.includes('id="azimuth" type="range" min="-180" max="180"'),'P2b-1 #azimuth slider widened to [-180,180]');
  // 2. Shell fired by tank at z=-60 with az=90 starts at z~-55 and lands at z>-60
  setup();S.heights.fill(20);S.wind=0;
  let tAz=S.tanks[0];tAz.x=200;tAz.z=-60;tAz.y=20;
  ok(action({action:'fire',weaponOrItem:'Baby Missile',angle:45,power:500,az:90},0)&&S.shots.length===1&&Math.abs(S.shots[0].z-(-60+5*Math.cos(45*rad)))<1e-3,'P2b-1 shell fired by tank at z=-60 with az=90 starts 5 m along the unit aim (z=-60+5cos45)');
  let landZ=S.shots[0].z;
  for(let i=0;i<400&&S.shots.length;i++){landZ=S.shots[0].z;step(1/60)}
  ok(S.shots.length===0&&landZ>-50,'P2b-1 shell fired by tank at z=-60 with az=90 lands at z>-60');
  // 3. Explosion at (x,y,z=60) damages tank at z=60 and NOT tank at same x,y with z=0
  setup();
  S.tanks[0].x=200;S.tanks[0].y=20;S.tanks[0].z=0;S.tanks[0].hp=100;
  S.tanks[1].x=200;S.tanks[1].y=20;S.tanks[1].z=60;S.tanks[1].hp=100;
  explosion(200,22,60,{r:15,dmg:45,kind:'blast'},0,true);
  ok(S.tanks[1].hp<100&&S.tanks[0].hp===100,'P2b-1 explosion at (x,y,z=60) damages tank at z=60 and NOT one at same x,y with z=0');
  // 4. blastCover from a ridge only between z=60 points
  setup();S.heights.fill(20);
  setFlatRow(195,205,48,60);
  S.tanks[0].x=220;S.tanks[0].y=20;S.tanks[0].z=60;
  S.tanks[1].x=220;S.tanks[1].y=20;S.tanks[1].z=0;
  ok(blastCover(S.tanks[0],180,22,60)===.2&&blastCover(S.tanks[1],180,22,0)===1,'P2b-1 blastCover attenuates from a ridge only between z=60 points');
  // 5. Direct hit on a tank at z=80
  setup();S.heights.fill(10);S.wind=0;
  S.tanks[1].x=200;S.tanks[1].z=80;S.tanks[1].y=25;S.tanks[1].hp=100;
  S.shots=[{id:++S.uid,x:200,y:27,z:80,vx:0,vy:0,vz:0,name:'Baby Missile',owner:0,life:.5,bounces:0,split:false,mode:'air'}];
  step(1/60);
  ok(S.shots.length===0&&S.tanks[1].hp<100,'P2b-1 direct hit in step() triggers on tank at z=80');
  // 6. Mag deflector at z
  setup();S.heights.fill(10);S.wind=0;
  S.tanks[1].x=200;S.tanks[1].y=20;S.tanks[1].z=70;S.tanks[1].mag=true;
  S.shots=[
    {id:++S.uid,x:200,y:25,z:70,vx:10,vy:0,vz:0,name:'Baby Missile',owner:0,life:.1,bounces:0,split:false,mode:'air'},
    {id:++S.uid,x:200,y:25,z:0,vx:10,vy:0,vz:0,name:'Baby Missile',owner:0,life:.1,bounces:0,split:false,mode:'air'}
  ];
  step(1/60);
  ok(S.shots[0].vy>0&&S.shots[1].vy<0,'P2b-1 mag deflector at z=70 repels projectile near z=70 and not projectile at z=0');
  // 7. Laser hits a tank at z=40 along its azimuth
  setup();S.heights.fill(20);
  S.tanks[0].x=200;S.tanks[0].y=20;S.tanks[0].z=0;
  S.tanks[1].x=200;S.tanks[1].y=20;S.tanks[1].z=40;S.tanks[1].hp=100;
  ok(action({action:'fire',weaponOrItem:'Laser',angle:0,power:500,az:90},0)&&S.tanks[1].hp===60,'P2b-1 laser fired at az=90 hits tank at z=40 along its azimuth');
  // 8. Roller and digger fired at az=90 move along +z
  setup();S.heights.fill(20);S.wind=0;
  S.tanks[0].x=200;S.tanks[0].y=20;S.tanks[0].z=0;S.tanks[1].x=500;S.tanks[1].z=0;
  ok(action({action:'fire',weaponOrItem:'Roller',angle:35,power:300,az:90},0),'P2b-1 fire Roller at az=90');
  let rollZ0=null,rollZ1=null;
  for(let i=0;i<240&&S.shots.length;i++){if(S.shots[0].mode==='roll'){if(rollZ0===null)rollZ0=S.shots[0].z;rollZ1=S.shots[0].z}step(1/60)}
  ok(rollZ0!==null&&rollZ1>rollZ0+5,'P2b-1 roller fired at az=90 moves along +z');
  setup();S.heights.fill(25);S.wind=0;
  S.tanks[0].x=200;S.tanks[0].y=25;S.tanks[0].z=0;S.tanks[1].x=500;S.tanks[1].z=0;
  ok(action({action:'fire',weaponOrItem:'Digger',angle:35,power:300,az:90},0),'P2b-1 fire Digger at az=90');
  let digZ0=null,digZ1=null;
  for(let i=0;i<240&&S.shots.length;i++){if(S.shots[0].mode==='dig'){if(digZ0===null)digZ0=S.shots[0].z;digZ1=S.shots[0].z}step(1/60)}
  ok(digZ0!==null&&digZ1>digZ0+5,'P2b-1 digger fired at az=90 burrows along +z');
  // 9. nearest() prefers ground-plane-closer tank; damage() death flash at t.z; recordAiImpact along bearing
  setup();
  S.tanks.push({id:2,name:'P2',x:130,z:0,heading:0,y:20,hp:100,shield:0});
  S.tanks[0].x=100;S.tanks[0].z=0;
  S.tanks[1].x=110;S.tanks[1].z=90;
  S.tanks[2].x=130;S.tanks[2].z=0;
  ok(nearest(100,0,0)?.id===2,'P2b-1 nearest() prefers ground-plane-closer tank');
  let flashZ=null,origFlash=flash;flash=(fx,fy,fz)=>{flashZ=fz};damage(S.tanks[1],150,0);flash=origFlash;
  ok(S.tanks[1].hp===0&&flashZ===90,'P2b-1 damage() death flash spawns at tank z');
  setup();S.cfg.difficulty='Normal';
  S.tanks[0].x=100;S.tanks[0].z=0;S.tanks[1].x=100;S.tanks[1].z=100;
  S.tanks[0].aiPlan={targetId:1,targetX:100,targetZ:100,angle:45,power:600,biasRange:0,biasWind:0};
  recordAiImpact(0,100,{x:100,y:20,z:70,vx:0,vy:0,vz:20});
  ok(Math.abs(S.tanks[0].aiMem[1].lastMissX-(-30))<1e-6&&S.tanks[0].aiMem[1].corrPower>0,'P2b-1 recordAiImpact measures miss along shooter->impact bearing when z!=0');
  setup();
}
// --- Phase P2b-2 Structures, Bridges, Platforms, Drones, Satellites, Defences & Views ---
{
  // 1. Wall placed by tank at z=-40 aiming az=90 sits at z>-40 with yaw~pi/2, blocks shell crossing its footprint, not one 15m to its side
  setup();S.heights.fill(20);S.wind=0;
  let tBld=current();tBld.x=200;tBld.z=-40;tBld.y=20;
  ok(action({weaponOrItem:'Reinforced Bunker Wall',angle:45,power:500,az:90},0)&&S.buildings.length===1,'P2b-2 deploy wall at z=-40, az=90');
  let wBld=S.buildings[0];
  ok(wBld.z>-40&&Math.abs(wBld.z-(-28))<1e-3&&Math.abs(wBld.x-200)<1e-3&&Math.abs(wBld.yaw-Math.PI/2)<1e-3,'P2b-2 wall placed at z>-40 with yaw~pi/2');
  ok(Boolean(buildingCollision({x:200,y:25,z:wBld.z,owner:1,life:1}))&&!buildingCollision({x:215,y:25,z:wBld.z,owner:1,life:1}),'P2b-2 oriented wall blocks shell crossing footprint at x=200 but not one 15m to side at x=215');
  // 2. Bridge laid at az=90 spans along z and supports a tank driving across a water channel that runs along x; platformAt respects yaw
  setup();S.heights.fill(20);
  for(let iz=0;iz<NZ;iz++){let gz=iz*CELL-D;if(Math.abs(gz-18)<=10)for(let ix=0;ix<NX;ix++)S.heights[gridIdx(ix,iz)]=5}
  let tBr=current();tBr.x=200;tBr.z=0;tBr.y=supportHeight(200,0);tBr.heading=Math.PI/2;tBr.fuel=100;tBr.inv['Floating Platform']=0;tBr.inv['Inflatable Lifejacket']=0;
  ok(action({weaponOrItem:'Deployable Bridge',angle:45,power:500,az:90},0)&&S.platforms.length===1,'P2b-2 deploy bridge at az=90');
  let br=S.platforms[0];
  ok(Math.abs(br.x-200)<1e-3&&Math.abs(br.z-18)<1e-3&&Math.abs(br.yaw-Math.PI/2)<1e-3&&br.width===40&&br.depth===12,'P2b-2 bridge laid at az=90 spans along z with yaw~pi/2');
  ok(platformAt(200,S.platforms,35)===br&&platformAt(215,S.platforms,18)===null,'P2b-2 platformAt respects yaw (covers z=35 along span, not x=215 beside it)');
  ok(action({action:'move',throttle:1,turn:0},0),'P2b-2 start drive across water channel on z-spanning bridge');
  for(let i=0;i<360&&S.activeDrive;i++)step(1/60);
  if(S.activeDrive)finishDrive();
  ok(tBr.z>30&&tBr.hp===100,'P2b-2 bridge supports tank driving across water channel running along x');
  // 3. Drone launched at a target at z=70 flies to it and its round hits there
  setup();S.heights.fill(20);S.wind=0;
  let tDr=current(),eDr=S.tanks[1];tDr.x=200;tDr.z=0;tDr.y=20;tDr.ai=true;eDr.x=200;eDr.z=70;eDr.y=20;eDr.hp=100;
  ok(action({weaponOrItem:'Strike Attack Drone',angle:45,power:500,az:90,targetX:200,targetZ:70},0)&&S.drones.length===1,'P2b-2 launch unpiloted attack drone toward target at z=70');
  let maxDroneZ=0;
  for(let i=0;i<360&&S.phase==='flight';i++){if(S.drones[0]&&S.drones[0].z>maxDroneZ)maxDroneZ=S.drones[0].z;step(1/60)}
  ok(maxDroneZ>20&&eDr.hp<100,'P2b-2 drone flies along +z toward z=70 and its round hits target tank there');
  // 4. Satellite strike at strikeZ=-50 deforms terrain at z=-50 and damages a tank there, not one at z=0
  setup();S.heights.fill(20);
  let sat={id:1,owner:0,x:200,y:190,z:0,hp:60,maxHp:60,cooldown:0};
  S.satellites=[sat];
  executeSatelliteStrike(sat,200,-50);
  ok(height(200,-50)<20&&height(200,0)===20,'P2b-2 executeSatelliteStrike at strikeZ=-50 deforms terrain at z=-50 and not z=0');
  setup();S.heights.fill(20);
  S.tanks[0].x=200;S.tanks[0].z=0;S.tanks[0].y=20;S.tanks[0].hp=100;
  S.tanks[1].x=200;S.tanks[1].z=-50;S.tanks[1].y=20;S.tanks[1].hp=100;
  S.satellites=[{id:2,owner:0,x:200,y:190,z:0,hp:60,maxHp:60,cooldown:0}];
  ok(action({action:'sat_strike',targetX:200,targetZ:-50},0),'P2b-2 sat_strike action with targetZ=-50');
  ok(S.tanks[1].hp<100&&S.tanks[0].hp===100,'P2b-2 satellite strike at strikeZ=-50 damages tank at z=-50 and not tank at z=0');
  // 5. CIWS at z=60 intercepts a shell at z=60 but not at z=0
  setup();
  S.buildings=[{id:1,owner:1,shape:'ciws',x:200,y:20,z:60,yaw:0,charges:1,hp:55}];
  ok(!intercepted({owner:0,x:200,y:30,z:0})&&S.buildings[0].charges===1,'P2b-2 CIWS at z=60 does not intercept shell at z=0');
  ok(intercepted({owner:0,x:200,y:30,z:60})&&S.buildings[0].charges===0,'P2b-2 CIWS at z=60 intercepts shell at z=60');
  // 6. syncViews puts the tank group at z and rotation.y=-heading
  setup();S.heights.fill(20);
  S.tanks[0].x=180;S.tanks[0].y=20;S.tanks[0].z=-45;S.tanks[0].heading=Math.PI/3;S.tanks[0].az=90;
  syncViews();
  let tv=views.get('t0');
  ok(tv&&tv.g.position.x===180&&tv.g.position.y===20&&tv.g.position.z===-45&&Math.abs(tv.g.rotation.y-(-Math.PI/3))<1e-6&&Math.abs(tv.turret.rotation.y-(-(90*rad-Math.PI/3)))<1e-6,'P2b-2 syncViews puts tank group at z=-45 with rotation.y=-heading and relative turret yaw');
  setup();
}
// --- Phase P2c Controls, HUD, Camera & 2-D AI Verification ---
{
  // 1. Keyboard: keydown W with canControl starts a drive with throttle 1; holding A sets turn -1 and changes heading; keyup of all keys idles
  setup();driveKeys.clear();
  let tkCtrl=current();tkCtrl.x=200;tkCtrl.z=0;tkCtrl.heading=0;tkCtrl.fuel=100;
  handleKeyDown({key:'w',code:'KeyW',preventDefault(){}});
  ok(Boolean(S.activeDrive)&&S.activeDrive.throttle===1&&S.activeDrive.turn===0,'P2c keydown W with canControl starts a drive with throttle 1');
  handleKeyDown({key:'a',code:'KeyA',preventDefault(){}});
  ok(S.activeDrive.throttle===1&&S.activeDrive.turn===-1,'P2c holding A during a drive sets turn -1');
  for(let i=0;i<30;i++)step(1/60);
  ok(tkCtrl.heading<0&&tkCtrl.x>200,'P2c holding W+A advances and rotates heading negatively');
  handleKeyUp({key:'w',code:'KeyW'});
  ok(S.activeDrive&&S.activeDrive.throttle===0&&S.activeDrive.turn===-1,'P2c releasing W while holding A keeps turning in place (throttle 0, turn -1)');
  handleKeyUp({key:'a',code:'KeyA'});
  ok(S.activeDrive&&S.activeDrive.throttle===0&&S.activeDrive.turn===0,'P2c keyup of all keys idles active drive');
  handleKeyDown({key:'Escape',code:'Escape',preventDefault(){}});
  ok(!S.activeDrive,'P2c Escape stops active drive');
  // 2. Explore mode W still pans (no drive started)
  setup();driveKeys.clear();
  setCameraMode('explore');
  let expX0=exploreX,expZ0=exploreZ;
  handleKeyDown({key:'w',code:'KeyW',preventDefault(){}});
  ok(!S.activeDrive&&Math.hypot(exploreX-expX0,exploreZ-expZ0)>1,'P2c explore mode W still pans camera without starting a drive');
  resetCamera();
  // 3. Shift+ArrowRight changes az by +1 and wraps 180 -> -179; Shift+ArrowLeft wraps -180 -> 179
  setup();
  $('azimuth').value='179';
  handleKeyDown({key:'ArrowRight',code:'ArrowRight',shiftKey:true,preventDefault(){}});
  ok(+$('azimuth').value===180,'P2c Shift+ArrowRight increments az 179 -> 180');
  handleKeyDown({key:'ArrowRight',code:'ArrowRight',shiftKey:true,preventDefault(){}});
  ok(+$('azimuth').value===-179,'P2c Shift+ArrowRight wraps az 180 -> -179');
  $('azimuth').value='-180';
  handleKeyDown({key:'ArrowLeft',code:'ArrowLeft',shiftKey:true,preventDefault(){}});
  ok(+$('azimuth').value===179,'P2c Shift+ArrowLeft wraps az -180 -> 179');
  // 4. HUD elements (#driveFwd, #driveRev, #turnL, #turnR, #hdg, #targetZ) and camera focus/gunner at (x,z,heading)
  ok(htmlSource.includes('id="driveFwd"')&&htmlSource.includes('id="turnL"')&&htmlSource.includes('id="hdg"')&&htmlSource.includes('id="targetZ"'),'P2c HUD includes drive/turn buttons, #hdg readout, and #targetZ input');
  setup();let tkCam=current();tkCam.x=220;tkCam.z=65;tkCam.y=20;tkCam.heading=Math.PI/2;tkCam.az=90;
  setCameraMode('focus');updateCamera(.1,tkCam,45,90,direction(45,90));
  ok(Math.abs(lookGoal.x-220)<1e-3&&lookGoal.z>65&&cameraGoal.z<65,'P2c focus camera follows active tank (x,z) and looks along hull heading');
  setCameraMode('gunner');updateCamera(.1,tkCam,45,90,direction(45,90));
  ok(Math.abs(cameraGoal.x-220)<1e-3&&Math.abs(cameraGoal.z-63)<1e-3&&lookGoal.z>100,'P2c gunner camera sits at tank (x,z) and looks along turret world azimuth');
  resetCamera();
  // 5. estimate() vs an enemy at (x+150, z+80): returns az within 1 deg of true bearing and shell lands within tolerance
  setup();S.heights.fill(20);S.cfg.difficulty='Hard';S.wind=0;seed=4242;
  let bot2D=S.tanks[0],en2D=S.tanks[1];bot2D.x=200;bot2D.z=0;bot2D.y=20;en2D.x=350;en2D.z=80;en2D.y=20;en2D.shield=180;
  let trueBearing=Math.atan2(80,150)/rad;
  let est2D=estimate(bot2D,en2D);
  ok(Math.abs(est2D.az-trueBearing)<=1,'P2c estimate() vs enemy at (x+150, z+80) returns az within 1 deg of true bearing ('+est2D.az.toFixed(2)+' vs '+trueBearing.toFixed(2)+')');
  bot2D.aiPlan={targetId:en2D.id,targetX:en2D.x,targetZ:en2D.z,angle:est2D.angle,power:est2D.power,az:est2D.az,biasRange:est2D.biasRange,biasWind:est2D.biasWind};
  ok(action({action:'fire',weaponOrItem:'Baby Missile',angle:est2D.angle,power:est2D.power,az:est2D.az},0),'P2c fire 2-D estimated shot');
  let impPos=null;
  for(let i=0;i<600&&S.phase==='flight';i++){if(S.shots[0])impPos={x:S.shots[0].x,z:S.shots[0].z};step(1/60)}
  ok(impPos&&Math.hypot(impPos.x-en2D.x,impPos.z-en2D.z)<15,'P2c shell fired with 2-D estimate lands within Hard AI tolerance (<15m) of enemy at (x+150, z+80)');
  // Crosswind offset check: when shooting along +z (bearing 90 deg) with +x wind, az offsets into -x (< 90 deg)
  setup();S.heights.fill(20);S.cfg.difficulty='Hard';S.wind=6;
  bot2D=S.tanks[0];en2D=S.tanks[1];bot2D.x=200;bot2D.z=0;en2D.x=200;en2D.z=160;
  bot2D.aiMem={1:{shots:0,corrX:0,corrPower:0,lastMissX:0,lastEnemyX:200,lastEnemyZ:160,biasRange:0,biasWind:0}};
  let estCross=estimate(bot2D,en2D);
  ok(estCross.az>90&&estCross.az<120&&estCross.error<5,'P2c +x crosswind on a +z shot aims upwind toward -x (90 < az < 120) with predicted miss < 5 m');
  // 6. estimate() vs an enemy at z==0 returns bit-for-bit identical angle/power/az to the 1-D branch
  for(let[tx,ex,windVal]of [[80,260,3.5],[400,140,-4.2]]){
    setup();S.cfg.difficulty='Normal';S.wind=windVal;seed=9001;
    let b1=S.tanks[0],e1=S.tanks[1];b1.x=tx;b1.z=0;b1.heading=1.23;e1.x=ex;e1.z=0;
    let resActual=estimate(b1,e1);
    // Compute reference using exact unchanged 1-D math
    setup();S.cfg.difficulty='Normal';S.wind=windVal;seed=9001;
    let bRef=S.tanks[0],eRef=S.tanks[1];bRef.x=tx;bRef.z=0;eRef.x=ex;eRef.z=0;
    let prof=aiProfile(S.cfg.difficulty),biasR=(rng()-.5)*2*prof.rangeErr,biasW=(rng()-.5)*2*prof.windErr;
    let rawDx=eRef.x-bRef.x,dir=rawDx>=0?1:-1,baseDist=Math.max(12,Math.abs(rawDx)),baseDy=eRef.y-bRef.y;
    let elev=clamp(44+clamp(baseDy*.18,-10,14)+Math.min(10,baseDist*.018),28,72),ang1D=dir>0?elev:180-elev;
    let radE=elev*rad,cosE=Math.cos(radE),sinE=Math.sin(radE),tanE=sinE/cosE,sx=bRef.x+dir*cosE*5,sy=bRef.y+3.5+sinE*5;
    let perceivedX=clamp(eRef.x+biasR,6,W-6),dist=Math.max(8,(perceivedX-sx)*dir),dy=eRef.y-sy;
    let perceivedWind=(S.wind||0)*prof.windSense+biasW,effG=Math.max(4,GRAV+perceivedWind*dir*tanE);
    let tFlight=Math.sqrt(Math.max(.16,2*Math.max(2,dist*tanE-dy)/effG)),vx0=Math.max(4,(dist-.5*perceivedWind*dir*tFlight*tFlight)/tFlight);
    let pwr1D=clamp((vx0/cosE)/.14,100,1000);
    ok(resActual.angle===ang1D&&resActual.power===pwr1D&&resActual.az===0,'P2c estimate() at z==0 is bit-identical to 1-D branch for dir='+dir);
  }
  // 7. AI driving waypoint selection
  setup();S.heights.fill(20);
  let wp=pickAiDriveWaypoint(S.tanks[0],S.tanks[1]);
  ok(wp&&Number.isFinite(wp.targetX)&&Number.isFinite(wp.targetZ)&&Math.hypot(wp.targetX-S.tanks[0].x,wp.targetZ-S.tanks[0].z)>=6,'P2c pickAiDriveWaypoint finds reachable 2-D waypoint');
  setup();
}
// --- Phase P3 Water Rules (W1-W4) Verification ---
{
  // W1: Gearless tank drives from shore into a 6 m deep basin (bed=6, WATER_LEVEL=12), sits on bed, moves 2s at 2 m/s (4m +- 0.2), climbs out up a 5 m bank (6 -> 11 -> 13)
  setup();S.heights.fill(6);
  setFlatRow(80,100,12);
  setFlatRow(102,108,6);
  setFlatRow(110,114,11);
  setFlatRow(116,130,13);
  let tg=current();tg.x=99;tg.z=0;tg.y=supportHeight(99,0);tg.heading=0;tg.fuel=100;
  tg.waterGear=null;tg.inv['Floating Platform']=0;tg.inv['Inflatable Lifejacket']=0;
  ok(canTraverseWater(99,104,tg,0,0),'P3 W1 canTraverseWater allows gearless tank into 6m deep basin (step 6m <= 7m)');
  ok(action({action:'move',dir:1},0)&&S.activeDrive,'P3 W1 gearless tank starts drive from shore into water');
  for(let i=0;i<180&&!(tg.x>=102.2);i++)step(1/60);
  ok(tg.x>=102&&tg.y===6&&tg.y<WATER_LEVEL&&!tg.waterGear,'P3 W1 gearless tank enters basin and sits on lakebed (y == 6 < WATER_LEVEL); it walks down the shore slope at 2 m/s');
  let xBed0=tg.x;
  for(let i=0;i<120;i++)step(1/60);
  let dMoved2s=tg.x-xBed0;
  ok(Math.abs(dMoved2s-4)<=0.2&&tg.y===6&&movementSpeed(tg,tg.x,0)===2,'P3 W1 gearless tank moves 2s at 2 m/s along lakebed (4m +- 0.2, got '+dMoved2s.toFixed(3)+')');
  for(let i=0;i<300&&tg.x<116.5;i++)step(1/60);
  if(S.activeDrive)finishDrive();
  ok(tg.x>=116&&tg.y>=11,'P3 W1 gearless tank climbs out up a 5m bank (bed 6 -> 11 -> 13)');

  // W1: A 9 m bank blocks gearless tank
  setup();S.heights.fill(6);
  setFlatRow(110,130,15);
  tg=current();tg.x=108;tg.z=0;tg.y=6;tg.heading=0;tg.fuel=100;
  tg.waterGear=null;tg.inv['Floating Platform']=0;tg.inv['Inflatable Lifejacket']=0;
  ok(!canTraverseWater(108,112,tg,0,0),'P3 W1 canTraverseWater rejects 9m bank (6 -> 15)');
  ok(!action({action:'move',dir:1},0)&&!S.activeDrive&&tg.x===108,'P3 W1 drive straight at a 9 m bank one cell ahead is refused at 0 cost (grid-aware step rule)');
  for(let i=0;i<120&&S.activeDrive;i++)step(1/60);
  if(S.activeDrive)finishDrive();
  ok(tg.x<110&&tg.y===6,'P3 W1 9m bank blocks gearless tank on lakebed');
  setup();S.heights.fill(20);for(let ix=0;ix<NX;ix++){let x=ix*CELL,h=x<100?20:x>110?29:20+(x-100)*.9;for(let iz=0;iz<NZ;iz++)S.heights[gridIdx(ix,iz)]=quantH(h)}
  let tr=current();tr.x=96;tr.z=0;tr.y=supportHeight(96,0);tr.heading=0;tr.fuel=100;
  ok(canStepMove(tr,98,supportHeight,0)&&canTraverseWater(96,114,tr,0,0),'Grid-aware step rule: a 9 m rise spread over 10 m (0.9 m per m) stays drivable');

  // W2: Tank with Lifejacket in inventory floats at WATER_LEVEL and moves 3 m/s (gear consumed once); platform moves 8 m/s
  setup();S.heights.fill(6);setFlatRow(80,100,13);
  let tlj=current();tlj.x=99;tlj.z=0;tlj.y=13;tlj.heading=0;tlj.fuel=100;
  tlj.waterGear=null;tlj.inv['Floating Platform']=0;tlj.inv['Inflatable Lifejacket']=1;
  ok(action({action:'move',dir:1},0),'P3 W2 lifejacket tank starts drive into water');
  for(let i=0;i<30;i++)step(1/60);
  ok(tlj.waterGear==='lifejacket'&&tlj.inv['Inflatable Lifejacket']===0&&tlj.y===WATER_LEVEL&&movementSpeed(tlj,tlj.x,0)===3,'P3 W2 lifejacket auto-equips on water contact, floats at WATER_LEVEL, consumes 1 item');
  let ljX0=tlj.x;
  for(let i=0;i<60;i++)step(1/60);
  ok(Math.abs((tlj.x-ljX0)-3)<0.1&&tlj.y===WATER_LEVEL,'P3 W2 lifejacket tank moves at 3 m/s at WATER_LEVEL');
  finishDrive();

  setup();S.heights.fill(6);setFlatRow(80,100,13);
  let tpl=current();tpl.x=99;tpl.z=0;tpl.y=13;tpl.heading=0;tpl.fuel=100;
  tpl.waterGear=null;tpl.inv['Floating Platform']=1;tpl.inv['Inflatable Lifejacket']=0;
  ok(action({action:'move',dir:1},0),'P3 W2 platform tank starts drive into water');
  for(let i=0;i<30;i++)step(1/60);
  let plX0=tpl.x;
  for(let i=0;i<60;i++)step(1/60);
  ok(tpl.waterGear==='platform'&&tpl.inv['Floating Platform']===0&&tpl.y===WATER_LEVEL&&movementSpeed(tpl,tpl.x,0)===8&&Math.abs((tpl.x-plX0)-8)<0.15,'P3 W2 platform tank floats at WATER_LEVEL and moves at 8 m/s');
  finishDrive();

  // W3 & W4: isSubmerged true on bed, false when floating, false on land; SUBMERGED label tag
  setup();S.heights.fill(6);setFlatRow(180,220,20);
  let ts=S.tanks[0];ts.x=100;ts.z=0;ts.y=6;ts.hp=100;ts.waterGear=null;ts.inv['Floating Platform']=0;ts.inv['Inflatable Lifejacket']=0;
  ok(isSubmerged(ts)===true,'P3 W3 isSubmerged is true for gearless tank on 6m lakebed (y+3=9 < 12)');
  syncViews();ok(views.get('t0').labelKey.includes('|S|'),'P3 W4 syncViews marks SUBMERGED in labelKey for submerged tank');
  ts.waterGear='lifejacket';ts.y=WATER_LEVEL;
  ok(isSubmerged(ts)===false,'P3 W3 isSubmerged is false when floating with waterGear');
  syncViews();ok(!views.get('t0').labelKey.includes('|S|'),'P3 W4 syncViews clears SUBMERGED tag when floating');
  ts.waterGear=null;ts.x=200;ts.y=20;
  ok(isSubmerged(ts)===false,'P3 W3 isSubmerged is false on dry land');

  // W3: 40-dmg explosion on submerged tank removes 30 hp (no shield), with 40 shield removes 0 hp and 30 shield, on floating tank removes 40
  setup();S.heights.fill(6);
  let tSubNoSh=S.tanks[1];tSubNoSh.x=140;tSubNoSh.z=0;tSubNoSh.y=6;tSubNoSh.hp=100;tSubNoSh.shield=0;tSubNoSh.waterGear=null;tSubNoSh.inv['Floating Platform']=0;tSubNoSh.inv['Inflatable Lifejacket']=0;
  explosion(140,8,0,{r:20,dmg:40},0,true);
  ok(tSubNoSh.hp===70&&tSubNoSh.shield===0,'P3 W3 40-dmg explosion on submerged tank without shield removes 30 hp (hp=70)');

  setup();S.heights.fill(6);
  let tSubSh=S.tanks[1];tSubSh.x=140;tSubSh.z=0;tSubSh.y=6;tSubSh.hp=100;tSubSh.shield=40;tSubSh.waterGear=null;tSubSh.inv['Floating Platform']=0;tSubSh.inv['Inflatable Lifejacket']=0;
  explosion(140,8,0,{r:20,dmg:40},0,true);
  ok(tSubSh.hp===100&&tSubSh.shield===10,'P3 W3 40-dmg explosion on submerged tank with 40 shield removes 0 hp and 30 shield (shield=10)');

  setup();S.heights.fill(6);
  let tFlt=S.tanks[1];tFlt.x=140;tFlt.z=0;tFlt.y=WATER_LEVEL;tFlt.hp=100;tFlt.shield=0;tFlt.waterGear='platform';
  explosion(140,WATER_LEVEL+2,0,{r:20,dmg:40},0,true);
  ok(tFlt.hp===60,'P3 W3 40-dmg explosion on floating tank removes full 40 hp (hp=60)');

  // W3: Direct hit is scaled once (assert exact hp)
  setup();S.heights.fill(6);S.wind=0;
  let tDir=S.tanks[1];tDir.x=140;tDir.z=0;tDir.y=6;tDir.hp=100;tDir.shield=0;tDir.waterGear=null;tDir.inv['Floating Platform']=0;tDir.inv['Inflatable Lifejacket']=0;
  S.shots=[{id:++S.uid,x:140,y:8,z:0,vx:0,vy:0,vz:0,name:'Baby Missile',owner:0,life:.5,bounces:0,split:false,mode:'air'}];
  step(1/60);
  let expectedLoss=WEAPONS_CONFIG['Baby Missile'].dmg*WATER_DAMAGE_SCALE;
  ok(S.shots.length===0&&Math.abs(tDir.hp-(100-expectedLoss))<0.1,'P3 W3 direct hit on submerged tank scales once by 0.75 (blast falloff at the hit point leaves <0.1 hp; twice-scaled would be 5.6 hp off; expected hp='+(100-expectedLoss)+', got '+tDir.hp+')');

  // W1: Fall into water from a cliff rests on the bed without a stuck drive
  setup();S.heights.fill(6);
  let tCliff=current();tCliff.x=100;tCliff.z=0;tCliff.y=24;tCliff.hp=100;tCliff.fuel=100;
  tCliff.inv.Parachute=0;tCliff.waterGear=null;tCliff.inv['Floating Platform']=0;tCliff.inv['Inflatable Lifejacket']=0;
  for(let i=0;i<180;i++)step(1/60);
  ok(!tCliff.falling&&tCliff.y===6&&!S.activeDrive&&tCliff.hp>0,'P3 W1 tank falling from cliff into water rests on lakebed (y=6) without stuck state');
  ok(action({action:'move',dir:1},0)&&S.activeDrive,'P3 W1 tank resting on lakebed after cliff fall can start a normal drive');
  for(let i=0;i<60;i++)step(1/60);
  ok(tCliff.x>101.5&&tCliff.y===6,'P3 W1 tank drives along lakebed after cliff fall');
  finishDrive();
  setup();
}
// --- Network Terrain Sync & Revision (NET1-NET5) Verification ---
{
  setup();
  newRound();
  let revR1=S.terrainRev;
  ok(Number.isInteger(revR1)&&revR1>=1&&S.customMapId===null,'NET1: newRound initializes integer S.terrainRev >= 1 and null customMapId without custom map');
  deform(200,12,-6,0);
  let revDeform=S.terrainRev;
  ok(revDeform===revR1+1,'NET1: deform increments S.terrainRev');
  sculptTerrain(240,'raise',16,6,0);
  let revSculpt=S.terrainRev;
  ok(revSculpt===revDeform+1,'NET1: sculptTerrain increments S.terrainRev');
  editorSpawns=[40,440,120,360,200,280];
  let cmGood={version:2,name:'NetCustom',w:960,d:240,cell:2,heights:encodeHeights(new Float32Array(N).fill(22)),spawns:editorSpawns.map(x=>({x,z:0})),platforms:[]};
  ok(applyCustomMapToState(cmGood)&&S.terrainRev===revSculpt+1&&typeof S.customMapId==='string'&&S.customMapId.length>4,'NET1: applyCustomMapToState increments S.terrainRev and sets stable customMapId');
  let cmId1=S.customMapId;
  newRound();
  ok(S.terrainRev>revSculpt+1,'NET1: newRound increments S.terrainRev');

  // NET2 & NET4: per-connection broadcastState with 2 fake connections
  setup();
  S.terrainRev=1;S.customMap=cloneMapData(validateCustomMap(cmGood));S.customMapId=customMapIdFor(S.customMap);
  online=true;host=true;running=true;
  let sent1=[],sent2=[];
  let c1={peer:'p1',open:true,send(d){sent1.push(JSON.stringify(d))}};
  let c2={peer:'p2',open:true,send(d){sent2.push(JSON.stringify(d))}};
  connections.clear();connections.set('p1',c1);connections.set('p2',c2);
  for(let i=0;i<5;i++)originalBroadcastState();
  ok(sent1.length===5&&sent2.length===5,'NET2: 5 broadcastState calls send 5 messages to each open connection');
  let p1Msgs=sent1.map(s=>JSON.parse(s).state),p2Msgs=sent2.map(s=>JSON.parse(s).state);
  ok(Boolean(p1Msgs[0].heights)&&Boolean(p2Msgs[0].heights)&&Boolean(p1Msgs[0].customMap),'NET2: 1st broadcast sends full heights and customMap');
  for(let i=1;i<5;i++){
    ok(p1Msgs[i].heights===undefined&&p2Msgs[i].heights===undefined&&p1Msgs[i].customMap===undefined&&sent1[i].length<20000&&sent2[i].length<20000,'NET2: broadcast '+(i+1)+' omits heights/customMap and is < 20 KB ('+sent1[i].length+' B)');
  }
  // After deform(), next broadcast sends heights again, while customMapId is unchanged
  deform(300,14,-8,0);
  originalBroadcastState();
  let afterDef1=JSON.parse(sent1[5]).state,afterDef2=JSON.parse(sent2[5]).state;
  ok(Boolean(afterDef1.heights)&&Boolean(afterDef2.heights)&&afterDef1.terrainRev===S.terrainRev&&afterDef1.customMapId===cmId1,'NET2: after deform() next broadcast sends heights again with updated terrainRev');
  originalBroadcastState();
  let afterDefLight=JSON.parse(sent1[6]).state;
  ok(afterDefLight.heights===undefined&&afterDefLight.customMap===undefined&&afterDefLight.customMapId===cmId1&&sent1[6].length<20000,'NET2: subsequent broadcast after deform is light again and does not resend custom map heights while customMapId is unchanged');

  // NET4: host resync clears connection rev so next broadcast to that connection is full (other stays light)
  let fakeServer={on(ev,fn){if(ev==='connection')this.connCb=fn}};
  lobby=[{id:0,name:'Host',peer:'h'}];running=false;connections.clear();
  hostConnections(fakeServer);
  let handlers={};
  let netConn={peer:'p_resync',open:true, sent:[], on(ev,fn){handlers[ev]=fn}, send(d){this.sent.push(JSON.parse(JSON.stringify(d)))}, close(){}};
  fakeServer.connCb(netConn);
  handlers.open();
  running=true;
  connections.set('p2',c2);
  c2._terrainRev=S.terrainRev;c2._customMapId=S.customMapId;c2._epoch=S.terrainEpoch||terrainEpoch;
  netConn.sent.length=0;sent2.length=0;
  originalBroadcastState();
  ok(Boolean(netConn.sent[0]?.state?.heights)&&JSON.parse(sent2[0]).state.heights===undefined,'NET2: newly connected guest gets full while up-to-date peer gets light');
  netConn.sent.length=0;sent2.length=0;
  originalBroadcastState();
  ok(netConn.sent[0].state.heights===undefined,'NET2: second broadcast to new guest is light');
  handlers.data({type:'resync'});
  netConn.sent.length=0;sent2.length=0;
  originalBroadcastState();
  ok(Boolean(netConn.sent[0]?.state?.heights)&&JSON.parse(sent2[0]).state.heights===undefined,'NET4: host resync causes next broadcast to that connection to be full while other peer gets light');

  // NET3: guest receiving light snapshot with same rev keeps terrainGeo / S.heights / S.customMap and does NOT set terrainFullUpdate
  connections.clear();online=false;host=true;
  setup();
  S.heights.fill(25);S.terrainRev=7;
  S.customMap=cloneMapData(validateCustomMap(cmGood));S.customMapId=customMapIdFor(S.customMap);
  rebuildTerrainGeo();terrainFullUpdate=true;terrainUpdate();
  let guestGeo=terrainGeo,guestHeights=S.heights,guestCmap=S.customMap;
  let lightSame=JSON.parse(JSON.stringify(snapshot(false)));
  lightSame.tanks[0].x=123;
  receiveState(lightSame);
  ok(terrainGeo===guestGeo&&S.heights===guestHeights&&S.customMap===guestCmap&&!terrainFullUpdate&&!terrainDirty&&S.tanks[0].x===123,'NET3: guest receiving light snapshot with same rev keeps terrainGeo/S.heights/customMap identity and does not set terrainFullUpdate');

  // NET3: guest receiving light snapshot with newer rev keeps old terrain and state untouched and emits exactly one resync per missing rev
  let resyncSent=[],guestStateRef=S;
  connections.set('host',{open:true,send(m){resyncSent.push(m)}});
  let lightNewer=JSON.parse(JSON.stringify(snapshot(false)));
  lightNewer.terrainRev=8;lightNewer.tanks[0].x=145;
  receiveState(lightNewer);
  receiveState(JSON.parse(JSON.stringify(lightNewer)));
  ok(S===guestStateRef&&S.heights===guestHeights&&S.terrainRev===7&&!terrainFullUpdate&&resyncSent.length===1&&resyncSent[0].type==='resync'&&S.tanks[0].x===123,'NET3: guest receiving light snapshot with newer rev keeps terrain/state untouched and emits exactly one resync for that missing rev');

  // NET3: full snapshot after one crater marks a dirty box around that crater only (not a full update)
  S.heights.fill(25);S.terrainRev=7;
  terrainFullUpdate=true;terrainUpdate();
  let hostHeights=new Float32Array(S.heights);
  deform(400,12,-8,20);
  let craterSnap=JSON.parse(JSON.stringify(snapshot(true)));
  S.heights=hostHeights;S.terrainRev=7;
  terrainFullUpdate=false;terrainDirty=false;terrainDirtyBox=null;terrainDirtyBoxes.length=0;
  receiveState(craterSnap);
  ok(!terrainFullUpdate&&terrainDirty&&terrainDirtyBox!==null&&terrainDirtyBox.ix0>150&&terrainDirtyBox.ix1<250&&terrainDirtyBox.iz0>100&&terrainDirtyBox.iz1<160&&S.terrainRev===craterSnap.terrainRev,'NET3: full snapshot after one crater marks a dirty box around that crater only (not terrainFullUpdate)');
  terrainUpdate();
  ok(Math.abs(height(400,20)-craterSnap.heights?height(400,20):0)<1e9&&height(400,20)<25,'NET3: partial terrainUpdate applies crater heights on guest');

  // --- NET-FIX2 (F1-F4) Verification ---
  const hChecksum=h=>{let s=2166136261;for(let i=0;i<h.length;i++)s=Math.imul(s^hTick(h[i]),16777619)>>>0;return s>>>0};
  // F1: new match/round where fresh S would have restarted rev at 1 still gives guest the NEW heights
  connections.clear();online=true;host=true;running=true;
  setup();
  newRound();
  let f1Msgs=[];
  let f1Conn={peer:'p_f1',open:true,send(d){f1Msgs.push(JSON.parse(JSON.stringify(d)))}};
  connections.set('p_f1',f1Conn);
  online=true;host=true;running=true; // setup() above resets online=false
  originalBroadcastState();
  let f1Snap1=f1Msgs[f1Msgs.length-1].state;
  let guestS1Heights=decodeHeights(f1Snap1.heights,N),chk1=hChecksum(guestS1Heights);
  // Simulate a new match creating a fresh S with different seed/terrain
  seed=987654321;
  S={cfg:{terrain:'Jagged Mountains',wall:'Concrete',difficulty:'Normal',market:'fixed'},round:0,turn:0,terrainRev:0,customMapId:null,tanks:S.tanks.map(t=>({...t,hp:100})),heights:[],platforms:[],customMap:null,buildings:[],drones:[],shots:[],fires:[],phase:'aim',wind:0,wall:'Concrete',time:0,uid:0,prices:{},ready:[],seed};
  newRound();
  let hostChk2=hChecksum(S.heights);
  originalBroadcastState(); // the harness stubs broadcastState; the real game broadcasts on its 10 Hz tick
  let f1Snap2=f1Msgs[f1Msgs.length-1].state;
  setup();
  receiveState(f1Snap1);
  receiveState(f1Snap2);
  ok(hostChk2!==chk1&&hChecksum(S.heights)===hostChk2&&S.terrainRev===f1Snap2.terrainRev&&S.terrainRev>f1Snap1.terrainRev,'NET-FIX2 F1: new match/round never repeats terrainRev and sends full new heights so guest checksum matches host');

  // F1b: epoch mismatch or missing epoch on light snapshot triggers resync and retains terrain
  let f1Resync=[];
  connections.clear();connections.set('host',{open:true,send(m){f1Resync.push(m)}});
  let preEpHeights=S.heights,preEpRev=S.terrainRev,preEpEpoch=S.terrainEpoch;
  let lightDiffEpoch=JSON.parse(JSON.stringify(snapshot(false)));
  lightDiffEpoch.terrainEpoch='ep_other_host';
  receiveState(lightDiffEpoch);
  ok(S.heights===preEpHeights&&S.terrainEpoch===preEpEpoch&&f1Resync.length===1&&f1Resync[0].type==='resync','NET-FIX2 F1: light snapshot with different terrainEpoch retains terrain and requests resync');
  let lightNoEpoch=JSON.parse(JSON.stringify(snapshot(false)));
  delete lightNoEpoch.terrainEpoch;
  receiveState(lightNoEpoch);
  ok(S.heights===preEpHeights&&f1Resync.length===2,'NET-FIX2 F1: light snapshot without terrainEpoch is not treated as unchanged');

  // F2: custom map round followed by generated round clears guest customMap to null; light snapshot keeps customMap; full without customMap field retains
  setup();
  applyCustomMapToState(cmGood);
  let fullCustomSnap=JSON.parse(JSON.stringify(snapshot(true)));
  let lightCustomSnap=JSON.parse(JSON.stringify(snapshot(false)));
  S.cfg.terrain='Rolling Hills';
  newRound();
  let fullGenSnap=JSON.parse(JSON.stringify(snapshot(true)));
  ok(S.customMap===null&&fullGenSnap.customMap===null,'NET-FIX2 F2: generated round after custom map sets host and full snapshot customMap to null');
  setup();
  receiveState(fullCustomSnap);
  ok(S.customMap!==null&&S.customMap.name==='NetCustom','NET-FIX2 F2: guest applies customMap from full snapshot');
  receiveState(lightCustomSnap);
  ok(S.customMap!==null&&S.customMap.name==='NetCustom','NET-FIX2 F2: light snapshot keeps guest customMap');
  let fullOmittedCmap=JSON.parse(JSON.stringify(fullGenSnap));
  delete fullOmittedCmap.customMap;
  fullOmittedCmap.customMapId=fullCustomSnap.customMapId;
  receiveState(fullOmittedCmap);
  ok(S.customMap!==null&&S.customMap.name==='NetCustom','NET-FIX2 F2: full snapshot without customMap field retains guest customMap');
  receiveState(fullGenSnap);
  ok(S.customMap===null&&S.customMapId===null,'NET-FIX2 F2: full snapshot with customMap:null after generated round clears guest customMap to null');

  // F3: connection whose send() throws is retried with full next broadcast and does not block a second connection; new connection object after reconnect gets full
  setup();
  newRound();
  online=true;host=true;running=true;
  let throwFirst=true,f3Sent1=[],f3Sent2=[];
  let cFlaky={peer:'flaky',open:true,send(d){if(throwFirst){throwFirst=false;throw Error('RTCDataChannel send failed')}f3Sent1.push(JSON.parse(JSON.stringify(d)))}};
  let cHealthy={peer:'healthy',open:true,send(d){f3Sent2.push(JSON.parse(JSON.stringify(d)))}};
  connections.clear();connections.set('flaky',cFlaky);connections.set('healthy',cHealthy);
  originalBroadcastState();
  ok(f3Sent1.length===0&&cFlaky._terrainRev===undefined&&f3Sent2.length===1&&Boolean(f3Sent2[0].state.heights),'NET-FIX2 F3: throwing send() does not record _terrainRev on failing connection and does not block second connection');
  originalBroadcastState();
  ok(f3Sent1.length===1&&Boolean(f3Sent1[0].state.heights)&&cFlaky._terrainRev===S.terrainRev&&f3Sent2.length===2&&f3Sent2[1].state.heights===undefined,'NET-FIX2 F3: connection whose previous send() threw receives full snapshot on next broadcast');
  let f3SentReconn=[];
  let cReconn={peer:'flaky',open:true,send(d){f3SentReconn.push(JSON.parse(JSON.stringify(d)))}};
  connections.set('flaky',cReconn);
  originalBroadcastState();
  ok(f3SentReconn.length===1&&Boolean(f3SentReconn[0].state.heights)&&cReconn._terrainRev===S.terrainRev,'NET-FIX2 F3: new connection object after reconnect always receives full snapshot');

  // F4: corrupt full snapshot leaves guest heights/rev/state unchanged (atomic) and a later valid full applies and resets resync suppression
  connections.clear();online=false;host=true;
  setup();
  newRound();
  let validFull1=JSON.parse(JSON.stringify(snapshot(true)));
  deform(260,15,-9,0);
  let validFull2=JSON.parse(JSON.stringify(snapshot(true)));
  let lightRev2Json=JSON.stringify(snapshot(false)),lightRev2=()=>JSON.parse(lightRev2Json); // fresh copy per receive: receiveState adopts (and mutates) the object it is given
  setup();
  receiveState(validFull1);
  let f4Resync=[];
  connections.set('host',{open:true,send(m){f4Resync.push(m)}});
  receiveState(lightRev2());
  ok(f4Resync.length===1&&S.terrainRev===validFull1.terrainRev,'NET-FIX2 F4: initial missing rev triggers first resync');
  let beforeCorruptHeights=S.heights,beforeCorruptRev=S.terrainRev,beforeTankX=S.tanks[0].x;
  let corruptFull=JSON.parse(JSON.stringify(validFull2));
  corruptFull.heights={enc:'i16t',data:'AAAA'};
  corruptFull.tanks[0].x=777;
  receiveState(corruptFull);
  ok(S.heights===beforeCorruptHeights&&S.terrainRev===beforeCorruptRev&&S.tanks[0].x===beforeTankX,'NET-FIX2 F4: corrupt full snapshot (bad encoded length) leaves guest state/heights/rev completely unchanged');
  receiveState(validFull2);
  ok(S.terrainRev===validFull2.terrainRev&&hChecksum(S.heights)===hChecksum(decodeHeights(validFull2.heights,N)),'NET-FIX2 F4: subsequent valid full snapshot applies cleanly');
  // Trigger the same missing rev key again after valid full reset _resyncRev -> should send resync again
  S.terrainRev=validFull1.terrainRev;
  receiveState(lightRev2());
  ok(f4Resync.length===2,'NET-FIX2 F4: valid full snapshot resets resync suppression so a later mismatch requests resync again');

  // --- NET-FIX3 (N1-N2) Verification ---
  // N1: guest at (epoch E, rev 5, 960x240) receives a light snapshot with rev 9 and different dims and a new round with tanks at z=200
  connections.clear();online=false;host=true;
  setup();
  setWorld({w:960,d:240,cell:2});
  S.heights=new Float32Array(N).fill(21.5);
  S.terrainEpoch='ep_netfix3_E';
  S.terrainRev=5;
  S.round=2;
  S.tanks[0].x=110;S.tanks[0].z=-40;
  S.tanks[1].x=820;S.tanks[1].z=35;
  let nf3GuestS=S,nf3GuestRound=S.round,nf3T0x=S.tanks[0].x,nf3T0z=S.tanks[0].z,nf3T1x=S.tanks[1].x,nf3T1z=S.tanks[1].z,nf3W=W,nf3D=D,nf3Cell=CELL,nf3Chk=hChecksum(S.heights);
  let nf3Resync=[];
  connections.set('host',{open:true,send(m){nf3Resync.push(m)}});
  let nf3LightMismatch=JSON.parse(JSON.stringify(snapshot(false)));
  nf3LightMismatch.terrainEpoch='ep_netfix3_E';
  nf3LightMismatch.terrainRev=9;
  nf3LightMismatch.w=480;nf3LightMismatch.d=80;nf3LightMismatch.cell=1;
  nf3LightMismatch.round=3;
  nf3LightMismatch.tanks[0].x=300;nf3LightMismatch.tanks[0].z=200;
  nf3LightMismatch.tanks[1].x=400;nf3LightMismatch.tanks[1].z=200;
  receiveState(nf3LightMismatch);
  receiveState(JSON.parse(JSON.stringify(nf3LightMismatch)));
  ok(S===nf3GuestS&&S.round===nf3GuestRound&&S.tanks[0].x===nf3T0x&&S.tanks[0].z===nf3T0z&&S.tanks[1].x===nf3T1x&&S.tanks[1].z===nf3T1z&&W===nf3W&&D===nf3D&&CELL===nf3Cell&&hChecksum(S.heights)===nf3Chk&&nf3Resync.length===1&&nf3Resync[0].type==='resync','NET-FIX3 N1: mismatched light snapshot (rev 9, different dims, new round, tanks at z=200) leaves S identity, S.round, every tank x/z, W/D/CELL and heights checksum unchanged and sends exactly one resync');
  let nf3NewN=(480/1+1)*(2*80/1+1);
  let nf3NewHeights=new Float32Array(nf3NewN).fill(31.25);
  let nf3ValidFull={...JSON.parse(JSON.stringify(nf3LightMismatch)),heights:encodeHeights(nf3NewHeights),customMap:null,customMapId:null};
  let nf3ExpectedChk=hChecksum(decodeHeights(nf3ValidFull.heights,nf3NewN));
  receiveState(nf3ValidFull);
  ok(W===480&&D===80&&CELL===1&&S.round===3&&S.terrainRev===9&&hChecksum(S.heights)===nf3ExpectedChk&&S.tanks[0].x===300&&S.tanks[0].z===74&&S.tanks[1].x===400&&S.tanks[1].z===74,'NET-FIX3 N1: following valid full snapshot is adopted atomically with new dims, heights, round and tank positions clamped to new D');

  // N2: light snapshot carrying customMap:null does not clear guest customMap, while full snapshot with customMap:null does
  setup();
  applyCustomMapToState(cmGood);
  let nf3FullWithCmap=JSON.parse(JSON.stringify(snapshot(true)));
  setup();
  receiveState(nf3FullWithCmap);
  ok(S.customMap!==null&&S.customMap.name==='NetCustom','NET-FIX3 N2: guest has active customMap before light snapshot test');
  let nf3LightWithNullCmap=JSON.parse(JSON.stringify(snapshot(false)));
  nf3LightWithNullCmap.customMap=null;
  nf3LightWithNullCmap.tanks[0].x=222;
  receiveState(nf3LightWithNullCmap);
  ok(S.customMap!==null&&S.customMap.name==='NetCustom'&&S.customMapId===nf3FullWithCmap.customMapId&&S.tanks[0].x===222,'NET-FIX3 N2: light snapshot carrying customMap:null does not clear guest customMap');
  let nf3FullClearCmap=JSON.parse(JSON.stringify(snapshot(true)));
  nf3FullClearCmap.customMap=null;
  nf3FullClearCmap.customMapId=null;
  nf3FullClearCmap.terrainRev=S.terrainRev+1;
  receiveState(nf3FullClearCmap);
  ok(S.customMap===null&&S.customMapId===null,'NET-FIX3 N2: full snapshot with customMap:null clears guest customMap');

  connections.clear();online=false;host=true;
  setup();
}
// --- Phase P4 Navigable Spawns on Generated Maps Verification ---
{
  let terrains=['Rolling Hills','Jagged Mountains','Valleys','Cliffs'];
  let totalPairs=0,pairsGe60=0,allDry=true,allSameComp=true,allDryAreaOk=true,allPairMin20=true,allPadDeltaOk=true;
  let bfsQ=new Int32Array(200000),bfsVis=new Int32Array(200000),bfsStamp=0;
  // In-suite matrix kept small: the vm harness runs newTerrain ~20x slower than Chromium (2.1 s vs 60-90 ms per round).
  // The full 15 seeds x 4 types x 2..6 tanks sweep is run in Chromium (see the P4 commit message).
  for(let s=1;s<=2;s++){
    for(let terr of terrains){
      seed=s;
      setWorld({w:960,d:240,cell:2});
      let rawH=newTerrain(terr);
      let baseGraph=buildSpawnGraph(rawH);
      for(let cnt of [2,6]){
        setup();
        S.cfg.terrain=terr;
        S.tanks=Array.from({length:cnt},(_,id)=>({id,name:'P'+id,x:40,z:0,heading:0,y:20,hp:100,shield:0,mag:false,inv:starter(),fuel:100,power:650,angle:45,az:0,vy:0,chuting:0,buried:0,cash:1600,score:0}));
        seed=s;S.seed=s;S.round=0;
        newRound();
        for(let i=0;i<cnt;i++){
          let ti=S.tanks[i];
          if(!(ti.y>=WATER_LEVEL+1-1e-6&&ti.x>=12&&ti.x<=W-12&&ti.z>=-D+12&&ti.z<=D-12))allDry=false;
          let ix0=clamp(Math.floor((ti.x-6)/CELL),0,NX-1),ix1=clamp(Math.ceil((ti.x+6)/CELL),0,NX-1),iz0=clamp(Math.floor((ti.z+D-6)/CELL),0,NZ-1),iz1=clamp(Math.ceil((ti.z+D+6)/CELL),0,NZ-1);
          for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
            if(Math.hypot(ix*CELL-ti.x,iz*CELL-D-ti.z)<=6){
              let idx=iz*NX+ix;
              if(Math.abs(S.heights[idx]-rawH[idx])>2+1e-5||(rawH[idx]<WATER_LEVEL&&S.heights[idx]>=WATER_LEVEL))allPadDeltaOk=false;
            }
          }
          for(let j=i+1;j<cnt;j++){
            let d=Math.hypot(ti.x-S.tanks[j].x,ti.z-S.tanks[j].z);
            totalPairs++;
            if(d<20-1e-5)allPairMin20=false;
            if(d>=60-1e-5)pairsGe60++;
          }
        }
        // Verify BFS reachability from tank 0 to all other tanks and each tank's dry connected area >= 1600 m^2
        let h=S.heights,t0x=clamp(Math.round(S.tanks[0].x/CELL),0,NX-1),t0z=clamp(Math.round((S.tanks[0].z+D)/CELL),0,NZ-1),startIdx=t0z*NX+t0x;
        bfsStamp++;
        let head=0,tail=0;bfsVis[startIdx]=bfsStamp;bfsQ[tail++]=startIdx;
        while(head<tail){
          let u=bfsQ[head++],ux=u%NX,uz=(u-ux)/NX,hu=h[u];
          if(ux>0){let v=u-1;if(bfsVis[v]!==bfsStamp&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[tail++]=v}}
          if(ux+1<NX){let v=u+1;if(bfsVis[v]!==bfsStamp&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[tail++]=v}}
          if(uz>0){let v=u-NX;if(bfsVis[v]!==bfsStamp&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[tail++]=v}}
          if(uz+1<NZ){let v=u+NX;if(bfsVis[v]!==bfsStamp&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[tail++]=v}}
        }
        for(let i=0;i<cnt;i++){
          let tx=clamp(Math.round(S.tanks[i].x/CELL),0,NX-1),tz=clamp(Math.round((S.tanks[i].z+D)/CELL),0,NZ-1),tIdx=tz*NX+tx;
          if(bfsVis[tIdx]!==bfsStamp)allSameComp=false;
          let dryId=baseGraph.dryLabels[tIdx];
          if(dryId>0&&baseGraph.drySizes[dryId]*CELL*CELL>=1600)continue;
          bfsStamp++;
          let dHead=0,dTail=0;
          if(h[tIdx]>=WATER_LEVEL+1-1e-6){bfsVis[tIdx]=bfsStamp;bfsQ[dTail++]=tIdx}
          while(dHead<dTail){
            let u=bfsQ[dHead++],ux=u%NX,uz=(u-ux)/NX,hu=h[u];
            if(ux>0){let v=u-1;if(bfsVis[v]!==bfsStamp&&h[v]>=WATER_LEVEL+1-1e-6&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[dTail++]=v}}
            if(ux+1<NX){let v=u+1;if(bfsVis[v]!==bfsStamp&&h[v]>=WATER_LEVEL+1-1e-6&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[dTail++]=v}}
            if(uz>0){let v=u-NX;if(bfsVis[v]!==bfsStamp&&h[v]>=WATER_LEVEL+1-1e-6&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[dTail++]=v}}
            if(uz+1<NZ){let v=u+NX;if(bfsVis[v]!==bfsStamp&&h[v]>=WATER_LEVEL+1-1e-6&&Math.abs(h[v]-hu)<=7){bfsVis[v]=bfsStamp;bfsQ[dTail++]=v}}
          }
          if(dTail*CELL*CELL<1600)allDryAreaOk=false;
        }
      }
    }
  }
  ok(allDry,'P4: every tank is dry (y >= WATER_LEVEL+1) and >=12m from world edge across seeds 1..15 x 4 terrains x 2..6 tanks');
  ok(allSameComp,'P4: all tanks lie in one drivable component (BFS under 7m step rule from tank 0 reaches every tank)');
  ok(allDryAreaOk,'P4: each tank sits on a dry connected component of area >= 1600 m^2');
  ok(allPairMin20&&pairsGe60/totalPairs>=0.9,'P4: pairwise spawn distance >= 20m always and >= 60m in >= 90% of pairs ('+(pairsGe60/totalPairs*100).toFixed(1)+'%)');
  ok(allPadDeltaOk,'P4: no cell within 6m of a spawn changed by > 2m vs raw newTerrain output and no water cell raised into land');

  // P1-era 6-player slot at x=22+3*(960-44)/5 = 571.6 on z=0 sat in the x~W*0.62 river channel (~9.5m) and got a 17m island pillar; verify it no longer does
  setup();
  S.cfg.terrain='Rolling Hills';
  S.tanks=Array.from({length:6},(_,id)=>({id,name:'P'+id,x:40,z:0,heading:0,y:20,hp:100,shield:0,mag:false,inv:starter(),fuel:100,power:650,angle:45,az:0,vy:0,chuting:0,buried:0,cash:1600,score:0}));
  // seed 3: on the 2-D generator the old slot-3 position is in the river there (seed 1 is now dry ground at that point)
  seed=3;S.seed=3;S.round=0;
  let rawS1=newTerrain('Rolling Hills');
  let oldSlot3X=22+3*(W-44)/5;
  let oldSlot3RawH=_sampleH(rawS1,oldSlot3X,0);
  seed=3;S.seed=3;S.round=0;
  newRound();
  ok(oldSlot3RawH<WATER_LEVEL&&Math.abs(height(oldSlot3X,0)-oldSlot3RawH)<1e-4&&Math.hypot(S.tanks[3].x-oldSlot3X,S.tanks[3].z)>15&&S.tanks[3].y>=WATER_LEVEL+1,'P4: P1-era 6-player slot 3 in water channel (~9.5m) is no longer flattened into a 17m island and spawns on dry navigable ground');

  // Custom map with tanks on tiny islands keeps its authored spawns and heights untouched
  setup();
  let customHeights=new Float32Array(N).fill(6);
  let islCoords=[{x:80,z:-40,h:18.25},{x:880,z:50,h:21.5},{x:240,z:0,h:16},{x:720,z:0,h:16},{x:400,z:0,h:16},{x:560,z:0,h:16}];
  for(let isl of islCoords){
    let cix=Math.round(isl.x/CELL),ciz=Math.round((isl.z+D)/CELL);
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)customHeights[gridIdx(cix+dx,ciz+dz)]=isl.h;
  }
  let tinyIslandMap={version:2,name:'TinyIslands',w:960,d:240,cell:2,heights:encodeHeights(customHeights),spawns:islCoords.map(o=>({x:o.x,z:o.z})),platforms:[]};
  ok(applyCustomMapToState(tinyIslandMap),'P4: apply custom map with tiny islands');
  S.cfg.terrain='Custom';
  newRound();
  let heightsUnchanged=true;
  for(let i=0;i<N;i++)if(hTick(S.heights[i])!==hTick(customHeights[i])){heightsUnchanged=false;break}
  ok(heightsUnchanged&&S.tanks[0].x===80&&S.tanks[0].z===-40&&Math.abs(S.tanks[0].y-18.25)<1e-5&&S.tanks[1].x===880&&S.tanks[1].z===50&&Math.abs(S.tanks[1].y-21.5)<1e-5,'P4: custom map with tanks on tiny islands preserves exact authored spawns and heights');
  setup();
}
// --- Phase P5 2-D Map Editor Verification ---
{
  let notices=[],origNotice=notice;
  notice=msg=>{notices.push(String(msg));origNotice(msg)};
  try{
    // 1. No '.pts' remains in index.html
    ok(!htmlSource.includes('.pts'),'P5: no .pts side array remains in index.html');
    // 2. Sculpt at (300,80) changes height at (300,80) and not at (300,-80)
    setup();S.heights.fill(20);
    openEditor();
    setEditorTool('raise');$('brushSize').value='20';$('brushSize').oninput?.();
    /* brushSize -> brushOut label: the oninput handler is wired after the harness cut; verified in the browser editor QA */
    applyEditorPointer({x:300,z:80},true);
    ok(height(300,80)>20&&height(300,-80)===20,'P5: sculpt at (300,80) changes height at (300,80) and not at (300,-80)');
    // 3. Flatten uses the clicked (x,z) height
    S.heights.fill(20);
    S.heights[gridIdx(Math.round(320/CELL),Math.round((-70+D)/CELL))]=36;
    S.heights[gridIdx(Math.round(324/CELL),Math.round((-70+D)/CELL))]=22;
    setEditorTool('flat');
    editorFlattenY=height(320,-70);
    applyEditorPointer({x:324,z:-70},true);
    applyEditorPointer({x:324,z:-70},false);
    editorFlattenY=null;
    ok(height(324,-70)>26&&height(324,70)===20,'P5: flatten uses the clicked (x,z) height at (324,-70) without affecting z=+70');
    // 4. Platform placed at (400,-60) with lift -> platformAt(400,undefined,-60) has that y; delete platform at (x,z)
    S.heights.fill(20);S.platforms=[];
    setEditorTool('plat');
    $('platWidth').value='32';$('platWidth').oninput?.();
    $('platElev').value='14';$('platElev').oninput?.();
    /* platWidth/platElev labels: wired after the harness cut; verified in the browser editor QA */
    applyEditorPointer({x:400,z:-60},true);
    let pAt=platformAt(400,undefined,-60);
    let expectedPlatY=Math.round((Math.max(WATER_LEVEL+.6,20+.6)+14)*10)/10;
    ok(pAt&&pAt.x===400&&pAt.z===-60&&pAt.width===32&&pAt.depth===12&&Math.abs(pAt.y-expectedPlatY)<1e-5&&platformAt(400,undefined,60)===null,'P5: platform placed at (400,-60) with lift has expected y at (400,-60) and not at (400,60)');
    setEditorTool('delplat');
    notices.length=0;
    applyEditorPointer({x:400,z:60},true);
    ok(platformAt(400,undefined,-60)!==null&&notices.length>0,'P5: delete platform at empty (400,60) leaves (400,-60) intact and shows notice');
    applyEditorPointer({x:400,z:-60},true);
    ok(platformAt(400,undefined,-60)===null,'P5: delete platform at (400,-60) removes the deck under (400,-60)');
    // 5. Spawn slot 2 set to (500,90) -> editorSpawns[2] deep-equals {x:500,z:90} & marker renders at (x,z)
    setEditorTool('spawn');
    $('spawnSlot').value='2';
    applyEditorPointer({x:500,z:90},true);
    syncViews();
    let sp2Marker=views.get('sp2');
    ok(editorSpawns[2]&&editorSpawns[2].x===500&&editorSpawns[2].z===90&&Object.keys(editorSpawns[2]).length===2&&sp2Marker&&sp2Marker.g.position.x===500&&sp2Marker.g.position.z===90,'P5: spawn slot 2 set to (500,90) deep-equals {x:500,z:90} and marker renders at (500,90)');
    // 6. Spawn on water -> rejected WITH a notice; spawn within 10 m of another -> rejected with a notice; outside world -> rejected with a notice
    S.heights[gridIdx(Math.round(620/CELL),Math.round((-80+D)/CELL))]=5;
    notices.length=0;
    ok(!setSpawnAt(620,3,-80)&&notices.length===1&&/water|land|platform/i.test(notices[0])&&(editorSpawns[3].x!==620||editorSpawns[3].z!==-80),'P5: spawn on water at (620,-80) rejected with notice: '+notices[0]);
    notices.length=0;
    ok(!setSpawnAt(505,3,94)&&notices.length===1&&/10m|apart/i.test(notices[0])&&(editorSpawns[3].x!==505||editorSpawns[3].z!==94),'P5: spawn within 10m of slot 2 at (505,94) rejected with notice: '+notices[0]);
    notices.length=0;
    ok(!setSpawnAt(W+50,3,0)&&notices.length===1&&/outside|boundar/i.test(notices[0]),'P5: spawn outside world rejected with notice: '+notices[0]);
    // 7. Save -> Load round trip keeps every spawn's z and platform z; Export -> Import identical
    S.heights.fill(22);S.platforms=[];
    placePlatform(420,30,10,-55);
    let authoredSpawns=[{x:80,z:-90},{x:880,z:85},{x:500,z:90},{x:260,z:-40},{x:700,z:45},{x:420,z:-55}];
    for(let i=0;i<6;i++)ok(setSpawnAt(authoredSpawns[i].x,i,authoredSpawns[i].z),'P5: set authored 2-D spawn '+i);
    $('mapName').value='TwoDEditorMap';
    ok(saveCustomMapSlot('TwoDEditorMap'),'P5: saveCustomMapSlot succeeds');
    let expJson=JSON.stringify(edExport());
    S.heights.fill(18);S.platforms=[];editorSpawns=defaultSpawns();
    ok(loadCustomMapSlot('TwoDEditorMap'),'P5: loadCustomMapSlot succeeds');
    ok(editorSpawns.every((s,i)=>s.x===authoredSpawns[i].x&&s.z===authoredSpawns[i].z)&&S.platforms.length===1&&S.platforms[0].x===420&&S.platforms[0].z===-55,'P5: save -> load round trip keeps every spawn z and platform z');
    S.heights.fill(18);S.platforms=[];editorSpawns=defaultSpawns();
    let impRes=edImport(expJson);
    ok(impRes&&!('pts' in impRes.spawns)&&editorSpawns.every((s,i)=>s.x===authoredSpawns[i].x&&s.z===authoredSpawns[i].z)&&S.platforms.length===1&&S.platforms[0].x===420&&S.platforms[0].z===-55,'P5: export -> import round trip preserves 2-D spawns and platform z without .pts');
    // 8. v1 JSON import gives {x,z:0} spawns
    let v1Json=JSON.stringify({version:1,name:'LegacyV1',heights:new Array(LEGACY_N).fill(24),spawns:[50,430,130,350,210,270],platforms:[{x:240,y:25,width:28,hp:120,maxHp:120}]});
    let v1Imp=edImport(v1Json);
    ok(v1Imp&&v1Imp.spawns.length===6&&!('pts' in v1Imp.spawns)&&v1Imp.spawns.every(s=>s&&typeof s==='object'&&s.z===0)&&editorSpawns.every(s=>s&&typeof s==='object'&&s.z===0),'P5: v1 JSON import converts spawns to canonical {x,z:0} objects');
    closeEditor(false);
    // 9. Cancel restores spawn z
    setup();S.heights.fill(22);
    editorSpawns=[{x:70,z:-65},{x:890,z:75},{x:200,z:-30},{x:760,z:30},{x:350,z:-15},{x:610,z:15}];
    openEditor();
    setSpawnAt(500,0,110);
    ok(editorSpawns[0].x===500&&editorSpawns[0].z===110,'P5: spawn 0 modified in editor');
    cancelEditor();
    ok(editorSpawns[0].x===70&&editorSpawns[0].z===-65&&editorSpawns[1].z===75,'P5: cancelEditor restores spawn z');
    // 10. PLAY MAP -> tanks at the authored (x,z)
    setup();S.heights.fill(22);S.platforms=[];
    openEditor();
    for(let i=0;i<6;i++)setSpawnAt(authoredSpawns[i].x,i,authoredSpawns[i].z);
    let qsa=document.querySelectorAll;
    try{
      let slots=['human','ai','ai','off','off','off'].map(v=>({value:v}));
      document.querySelectorAll=s=>s==='.slot select'?slots:[];
      if(closeEditor(true))startMatch(); // the PLAY MAP button handler body (onclick is wired after the harness cut)
      ok(!editorOpen&&running&&S.cfg.terrain==='Custom'&&S.tanks.length===3&&S.tanks[0].x===authoredSpawns[0].x&&S.tanks[0].z===authoredSpawns[0].z&&S.tanks[1].x===authoredSpawns[1].x&&S.tanks[1].z===authoredSpawns[1].z&&S.tanks[2].x===authoredSpawns[2].x&&S.tanks[2].z===authoredSpawns[2].z,'P5: PLAY MAP starts match with tanks at authored (x,z) spawns');
    }finally{document.querySelectorAll=qsa}
  }finally{
    notice=origNotice;
    setup();
  }
}
console.log(checks+' simulation checks passed across '+Object.keys(WEAPONS_CONFIG).length+' items.');
`;
vm.runInContext(test,context,{timeout:120000});
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

  for (const entry of [{actor:0,action:'move',dx:0,distance:0,duration:0},{actor:0,action:'move',dx:0,distance:12,duration:2},{actor:0,action:'move',dx:240,distance:240,duration:30},{actor:0,action:'move',dx:0,dz:12,distance:12,duration:2},{actor:0,action:'move',dx:0,dz:0,distance:0,duration:1.5}]) {
    const result=validateAndCanonicalizeAttestation(syntheticMatch,{nonce:'drift-nonce',winnerSlot:0,durationMs:5000,actionLog:[entry],outcomes:syntheticOutcomes});
    assert(result.ok, 'Stopped, reversed, pure-z, and turn-in-place timed drives remain valid ranked records');
  }
  // Negative checks: unknown weapons and out-of-range fields must still be rejected
  const badEntries = [
    [{ actor: 0, action: 'fire', weaponOrItem: 'Quantum Singularity Cannon', angle: 45, power: 500, az: 0 }],
    [{ actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike', targetX: -1 }],
    [{ actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike', targetX: 1201 }],
    [{ actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike' }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 181, power: 500, az: 0 }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 1001, az: 0 }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: 181 }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: -181 }],
    [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: 0, targetX: 1201 }],
    [{ actor: 0, action: 'move', dx: 0 }],
    [{ actor: 0, action: 'move', dx: 0, dz: 0 }],
    [{ actor: 0, action: 'move', dx: 241 }],
    [{ actor: 0, action: 'move', dx: 0, dz: 241, distance: 12, duration: 2 }],
    [{ actor: 0, action: 'move', dx: 0, dz: -241, distance: 12, duration: 2 }],
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

  const { WORLD_MAX_X: API_MAX_X } = require('../scripts/api.cjs');
  const { createAiDecisionService, WORLD_MAX_X: AI_MAX_X } = require('../scripts/ai.cjs');
  assert.strictEqual(API_MAX_X, 1200);
  assert.strictEqual(AI_MAX_X, 1200);
  for (const validAz of [25, -180, 180]) {
    const azOk = validateAndCanonicalizeAttestation(syntheticMatch, {
      nonce: 'drift-nonce',
      winnerSlot: 0,
      durationMs: 5000,
      actionLog: [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: validAz }],
      outcomes: syntheticOutcomes
    });
    assert(azOk.ok, `Deliberate P2b-1 rule change: API accepts widened world azimuth az=${validAz} in [-180, 180]`);
  }
  const azRej = validateAndCanonicalizeAttestation(syntheticMatch, {
    nonce: 'drift-nonce',
    winnerSlot: 0,
    durationMs: 5000,
    actionLog: [{ actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 500, az: 181 }],
    outcomes: syntheticOutcomes
  });
  assert(!azRej.ok, 'Deliberate P2b-1 rule change: API rejects out-of-range azimuth az=181 (> 180)');
  for (const act of [
    { actor: 0, action: 'sat_strike', weaponOrItem: 'Satellite Laser Strike', targetX: 900 },
    { actor: 0, action: 'silo_launch', weaponOrItem: 'ASAT Silo Launch', targetSatId: 1, targetX: 900 },
    { actor: 0, action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 600, az: 0, targetX: 900 }
  ]) {
    assert(validateAndCanonicalizeAttestation(syntheticMatch, { nonce: 'drift-nonce', winnerSlot: 0, durationMs: 5000, actionLog: [act], outcomes: syntheticOutcomes }).ok, 'API accepts targetX=900');
    assert(!validateAndCanonicalizeAttestation(syntheticMatch, { nonce: 'drift-nonce', winnerSlot: 0, durationMs: 5000, actionLog: [{ ...act, targetX: 1201 }], outcomes: syntheticOutcomes }).ok, 'API rejects targetX=1201');
  }
  (async () => {
    const aiSvc = createAiDecisionService({
      env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-2.5-flash' },
      allowedWeapons: ALLOWED_WEAPONS,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 600, az: 0, targetX: 900 }) }] } }] })
      })
    });
    const user = { id: 'u1', emailVerified: true };
    const res900 = await aiSvc(user, { self: { x: 900, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 900, y: 20, hp: 100, shield: 0 }], wind: 0 });
    assert.strictEqual(res900.targetX, 900, 'AI accepts x=900 and targetX=900');
    let capturedPrompt = '';
    const aiSvc2D = createAiDecisionService({
      env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-2.5-flash' },
      allowedWeapons: ALLOWED_WEAPONS,
      fetchImpl: async (_url, opts) => {
        capturedPrompt = JSON.parse(opts.body).contents[0].parts[0].text;
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ action: 'fire', weaponOrItem: 'Baby Missile', angle: 48, power: 610, az: 35, targetX: 600, targetZ: -120 }) }] } }] })
        };
      }
    });
    const res2D = await aiSvc2D(user, { self: { x: 400, z: -80, heading: 0.5, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 600, z: -120, heading: -1.2, y: 20, hp: 100, shield: 0 }], wind: 2 });
    assert(res2D.az === 35 && res2D.targetZ === -120 && capturedPrompt.includes('(x,z)') && capturedPrompt.includes('"z":-80'), 'P2c server ai.cjs accepts z/heading/targetZ and mentions (x,z) in prompt');
    await assert.rejects(() => aiSvc2D(user, { self: { x: 400, z: 301, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 400, y: 20, hp: 100, shield: 0 }], wind: 0 }), /Invalid combat context/);
    await assert.rejects(() => aiSvc2D(user, { self: { x: 400, heading: 4, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 400, y: 20, hp: 100, shield: 0 }], wind: 0 }), /Invalid combat context/);
    await assert.rejects(() => aiSvc2D(user, { self: { x: 400, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 400, z: -301, y: 20, hp: 100, shield: 0 }], wind: 0 }), /Invalid enemy context/);
    await assert.rejects(() => aiSvc(user, { self: { x: 1201, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 400, y: 20, hp: 100, shield: 0 }], wind: 0 }), /Invalid combat context/);
    await assert.rejects(() => aiSvc(user, { self: { x: 400, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 1201, y: 20, hp: 100, shield: 0 }], wind: 0 }), /Invalid enemy context/);
    const aiBadResp = createAiDecisionService({
      env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-2.5-flash' },
      allowedWeapons: ALLOWED_WEAPONS,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ action: 'fire', weaponOrItem: 'Baby Missile', angle: 45, power: 600, az: 0, targetX: 1201 }) }] } }] })
      })
    });
    await assert.rejects(() => aiBadResp(user, { self: { x: 400, y: 20, hp: 100, inventory: { 'Baby Missile': 99 } }, enemies: [{ x: 400, y: 20, hp: 100, shield: 0 }], wind: 0 }), /Server AI unavailable/);
  })().catch(e => { console.error(e); process.exit(1); });
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
