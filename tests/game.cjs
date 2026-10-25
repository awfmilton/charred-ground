const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(source);
source=source.slice(0,source.indexOf('for(let i=0;i<6;i++){let d=document.createElement'));
const store=new Map(),localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const elements=new Map();function element(){const cl=new Set(['hidden']);return {value:'',checked:true,classList:{contains:c=>cl.has(c),add:c=>cl.add(c),remove:c=>cl.delete(c),toggle:(c,f)=>f===undefined?(cl.has(c)?cl.delete(c):cl.add(c)):(f?cl.add(c):cl.delete(c))},style:{},replaceChildren(){},appendChild(){},append(){},textContent:'',remove(){},setAttribute(){}}}
const document={body:element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll:()=>[],hidden:false};
const context={console,innerWidth:1280,innerHeight:720,THREE:require('three'),document,window:{localStorage},localStorage,setTimeout,clearTimeout,performance,crypto:require('crypto').webcrypto,requestAnimationFrame(){}};
vm.createContext(context);vm.runInContext(source,context);
const test=`
let checks=0;function ok(value,message){if(!value)throw Error(message);checks++}
emit=()=>{};flash=()=>{};sound=()=>{};refreshWeapons=()=>{};updateUI=()=>{};showShop=()=>{};clearViews=()=>{};broadcastState=()=>{};notice=()=>{};laserLine=()=>{};
function setup(){seed=1729;S={cfg:{terrain:'Rolling Hills',wall:'Concrete',difficulty:'Cyborg',market:'fixed'},round:1,turn:0,heights:new Float32Array(481).fill(20),tanks:[0,1].map(id=>({id,name:'P'+id,x:40+id*100,y:20,hp:100,shield:0,mag:false,inv:Object.fromEntries(Object.keys(WEAPONS_CONFIG).map(n=>[n,10])),fuel:100,power:650,angle:id?135:45,az:0,vy:0,chuting:0,buried:0,cash:10000,score:0})),platforms:[],customMap:null,buildings:[],drones:[],shots:[],fires:[],phase:'aim',wind:0,wall:'Concrete',time:0,uid:0,prices:{},ready:[]};running=true;host=true;online=false;shotClock=0;return S.tanks[0]}
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
// --- Custom Terrain Editor & Floating Platform Verification ---
setup();
S.heights.fill(6);
for(let x=20;x<=38;x++)S.heights[x]=13;
S.platforms=[{id:1,x:52,y:13,width:28,hp:120,maxHp:120}];
t=current();t.x=36;t.y=supportHeight(36);t.fuel=100;
ok(t.y===13,'Tank starts on coastal ramp at platform elevation');
ok(action({action:'move',dx:4},0)&&t.x===40&&t.y===13,'Tank drives from land onto floating platform over deep water');
ok(action({action:'move',dx:4},0)&&t.x===44&&t.y===13,'Tank drives along floating platform over deep water');
t.x=65;t.y=supportHeight(65);
ok(!action({action:'move',dx:4},0)&&t.x===65,'Tank blocked from driving off platform into unbridged deep water');

S.platforms=[{id:1,x:46,y:13,width:12,hp:120,maxHp:120},{id:2,x:62,y:13,width:12,hp:120,maxHp:120}];
t.x=51;t.y=supportHeight(51);t.fuel=100;
ok(!action({action:'move',dx:4},0)&&t.x===51,'Intermediate water gap between separated platforms blocks movement');

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
setup();S.platforms=[{id:1,x:65,y:40,width:30,hp:120,maxHp:120}];arcGeo=new THREE.BufferGeometry();arcGeo.setAttribute('position',new THREE.BufferAttribute(arcPositions,3));arc=new THREE.Line(arcGeo,new THREE.LineDashedMaterial());$('angle').value=45;$('power').value=650;$('azimuth').value=0;predict();let withDeck=arcGeo.drawRange.count;S.platforms=[];predict();ok(withDeck<arcGeo.drawRange.count,'Aim prediction stops at platform deck');
setup();openEditor();sculptTerrain(180,'raise',20,8);S.heights.fill(5);ok(closeEditor(true)===false&&editorOpen,'Invalid all-water map stays open on Apply');closeEditor(false);

console.log(checks+' simulation checks passed across '+Object.keys(WEAPONS_CONFIG).length+' items.');
`;
vm.runInContext(test,context,{timeout:30000});
