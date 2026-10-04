import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KITS } from '../src/region/kits.js';
import { blockLots, denseStreetDistance, lotGround } from '../src/region/layout.js';
import { createSettlements } from '../src/region/settle.js';
const rng = (seed) => { let a=seed>>>0; return () => { a=(Math.imul(a,1664525)+1013904223)>>>0; return a/4294967296; }; };

test('East Asian dense homes leave non-overlapping corners and shopfront clearance to actual streets', () => {
  let count=0;
  for(let seed=1;seed<=40;seed++) {
    const homes=blockLots(KITS.eastcity,{seed,ax:0,R:500},1,1,rng).filter(l=>l.role==='house');
    assert.ok(homes.length>=4);
    const bounds=homes.map(l=>({x:l.x,z:l.z,hx:(Math.abs(Math.cos(l.rot))*l.w+Math.abs(Math.sin(l.rot))*l.d)/2,hz:(Math.abs(Math.sin(l.rot))*l.w+Math.abs(Math.cos(l.rot))*l.d)/2}));
    for(let i=0;i<bounds.length;i++) {
      const b=bounds[i];
      assert.ok(Math.abs(b.x-52)+b.hx<=19.501 && Math.abs(b.z-52)+b.hz<=19.501);
      for(const c of bounds.slice(i+1)) assert.ok(Math.abs(c.x-b.x)>=c.hx+b.hx || Math.abs(c.z-b.z)>=c.hz+b.hz);
      count++;
    }
  }
  assert.ok(count>200);
});

test('dense streets run between blocks in positive and negative world coordinates', () => {
  for(let n=-5;n<=5;n++) {
    assert.equal(denseStreetDistance(n*52,0,52),26);
    assert.equal(denseStreetDistance((n+.5)*52,0,52),0);
    assert.equal(denseStreetDistance(0,(n+.5)*52,52),0);
  }
});

test('rotated whole footprints reject water/cliffs and keep uphill facades exposed', () => {
  const L={x:0,z:0,w:10,d:7,rot:Math.PI/4};
  const f=lotGround(L,(x)=>20+x*.15);
  assert.ok(f && f.y>f.hi && f.hi-f.lo>1);
  assert.equal(lotGround(L,x=>20+x),null);
  assert.equal(lotGround(L,()=>20,(x,z)=>x>4 && z<0),null);
  assert.equal(lotGround(L,()=>NaN),null);
});

test('streamed Eastern homes retain finite geometry, foundations, lights and wall collisions', () => {
  const scene=new THREE.Scene(), F={epoch:1};
  const S=createSettlements({scene,ground:x=>20+x*.12,wet:()=>false,F,toXZ:()=>({x:0,z:0}),isPhone:true});
  const site=S.add({key:'homes',kind:'village',kit:'eastvillage',opts:{japan:true},lots:[{type:'easthouse',x:10,z:10,w:10,d:7,rot:0,role:'house'}]});
  const cam={position:{x:10,y:30,z:10}};
  for(let i=0;i<120 && ![...site.cells.values()].some(c=>c.mesh);i++) S.update(.1,cam,{budget:4});
  const cell=[...site.cells.values()].find(c=>c.mesh);
  assert.ok(cell?.mesh && cell.solids.length>0);
  for(const mesh of [cell.mesh,cell.glow].filter(Boolean)) for(const attr of ['position','normal','color']) assert.ok(mesh.geometry.getAttribute(attr).array.every(Number.isFinite));
  const box=new THREE.Box3().setFromBufferAttribute(cell.mesh.geometry.attributes.position);
  assert.ok(box.min.y<20.6 && box.max.y>24);
  const p={x:10,z:10};S.push(p,22);
  assert.ok(Math.hypot(p.x-10,p.z-10)>3,'inside-wall collision cannot leave a player at zero sign');
  S.dispose();assert.equal(scene.children.length,0);
});

test('native city streets expose stable atlas road identities and regenerate after floating frame changes', () => {
  let ox=0;
  const scene=new THREE.Scene(),F={epoch:1};
  const S=createSettlements({scene,ground:()=>30,wet:()=>false,F,toXZ:()=>({x:ox,z:0}),isPhone:true});
  const site=S.add({key:'town:kyoto',kind:'town',kit:'eastcity',pop:3,name:'Kyoto'});
  S.update(.1,{position:{x:0,y:32,z:0}},{budget:0});
  const a=S.roadTowns()[0];
  assert.equal(a.id,'kyoto');assert.ok(a.roads.length>20);
  assert.equal(a,S.roadTowns()[0]);
  const P=site.planned,cs=Math.cos(P.ax),sn=Math.sin(P.ax);
  for(const road of a.roads) {
    assert.equal(road.drive,true);assert.ok(road.pts.every(Number.isFinite));
    for(let k=0;k<road.pts.length;k+=2) assert.ok(denseStreetDistance(road.pts[k]*cs-road.pts[k+1]*sn,road.pts[k]*sn+road.pts[k+1]*cs,52)<.001);
  }
  F.epoch++;ox=1000;S.update(.1,{position:{x:ox,y:32,z:0}},{budget:0});
  const b=S.roadTowns()[0];assert.notEqual(a,b);assert.equal(b.x,1000);
  assert.ok(Math.abs(b.roads[0].pts[0]-a.roads[0].pts[0]-1000)<.001);
  S.dispose();
});

test('production driving offers left, straight and right at native East Asian grid junctions', async () => {
  const {createDrive}=await import('../src/drive.js');
  const scene=new THREE.Scene(),F={epoch:1};
  const S=createSettlements({scene,ground:()=>30,wet:()=>false,F,toXZ:()=>({x:0,z:0}),isPhone:true});
  S.add({key:'town:kyoto',kind:'town',kit:'eastcity',pop:3,name:'Kyoto'});
  const cam=new THREE.PerspectiveCamera();cam.position.set(0,32,0);
  S.update(.1,cam,{budget:0});
  const roads=S.roadTowns()[0].roads, ends=new Map();
  for(const road of roads) for(const k of [0,road.pts.length-2]) {
    const key=road.pts[k]+','+road.pts[k+1];
    if(!ends.has(key)) ends.set(key,[]);
    ends.get(key).push({road,k});
  }
  const junction=[...ends.values()].find(v=>v.length===4);
  assert.ok(junction,'four roads share exactly equal Float32 junction endpoints');
  const {road,k}=junction[0],p=road.pts;
  let length=0;for(let n=2;n<p.length;n+=2)length+=Math.hypot(p[n]-p[n-2],p[n+1]-p[n-1]);
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  const element=()=>({style:{},dataset:{},setAttribute(){},appendChild(){},addEventListener(){}});
  globalThis.document={createElement:element};globalThis.window={addEventListener(){}};
  try {
    const drive=createDrive({world:()=>({real:{near:()=>roads}}),camera:cam,mount:element(),hint(){},isPhone:false});
    Object.assign(drive.state,{edge:{pts:p,L:length,real:road,cls:road.cls,name:road.name,w:9},dir:k===0?-1:1});
    const options=drive.debugOptions();
    assert.ok(options.some(o=>o.turn>80 && o.turn<100),JSON.stringify(options));
    assert.ok(options.some(o=>o.turn< -80 && o.turn> -100),JSON.stringify(options));
    assert.ok(options.some(o=>Math.abs(o.turn)<5),JSON.stringify(options));
  } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;S.dispose();}
});

test('planned streets and homes exclude vegetation before meshes build while parks remain available', () => {
  const scene=new THREE.Scene(),F={epoch:1};
  const S=createSettlements({scene,ground:()=>30,wet:()=>false,F,toXZ:()=>({x:0,z:0}),isPhone:true});
  const site=S.add({key:'town:kyoto',kind:'town',kit:'eastcity',pop:3,name:'Kyoto'});
  assert.equal(S.version(),0);
  S.update(.1,{position:{x:0,y:32,z:0}},{budget:0});
  assert.equal(site.cells.size,0);assert.equal(S.version(),1);
  const P=site.planned,cs=Math.cos(P.ax),sn=Math.sin(P.ax);
  assert.equal(S.vegetationBlocked(26*cs,-26*sn,8),true,'clear complete street before streaming');
  assert.equal(S.blocked(26*cs,-26*sn,1),false,'street remains available for NPC navigation');
  const lots=blockLots(KITS.eastcity,P,1,1,rng), home=lots.find(l=>l.role==='house');
  // blockLots uses the seeded rng internally, so query the settlement's own same block;
  // housing coverage should reserve most frontage irrespective of decorative variation.
  assert.ok(home && S.blocked(home.x,home.z,8));
  assert.equal(S.blocked(5000,5000,8),false,'open country remains planted');
  let park=false;
  for(let x=-350;x<=350&&!park;x+=13) for(let z=-350;z<=350&&!park;z+=13) if(Math.hypot(x,z)<P.R-52 && !S.vegetationBlocked(x,z,4))park=true;
  assert.ok(park,'retain unbuilt courtyard and park spaces instead of excluding the whole city');
  S.update(.1,{position:{x:0,y:32,z:0}},{budget:0});assert.equal(S.version(),1);
  S.dispose();
});

test('regional vegetation refreshes once when settlement occupancy changes, not every frame', async () => {
  const {createFlora}=await import('../src/region/flora.js');
  const scene=new THREE.Scene(),F={epoch:1};
  const S=createSettlements({scene,ground:()=>30,wet:()=>false,F,toXZ:()=>({x:0,z:0}),isPhone:true});
  let calls=0;
  const flora=createFlora(scene,{ground:()=>30,wet:()=>false,blocked:(x,z,m)=>{calls++;return S.vegetationBlocked(x,z,m);},toLL:()=>({lat:35.01,lon:135.77}),isPhone:true});
  const cam={position:{x:0,y:32,z:0}}, opts=()=>({kit:KITS.eastcity,climate:{season:'autumn',snow:0,temp:18},epoch:F.epoch+':'+S.version()});
  flora.update(cam,opts());const initial=calls, before=Object.values(flora.info()).reduce((a,b)=>a+b,0);
  assert.ok(initial>0 && before>0);
  S.add({key:'town:kyoto',kind:'town',kit:'eastcity',pop:3,name:'Kyoto'});S.update(.1,cam,{budget:0});
  flora.update(cam,opts());assert.ok(calls>initial);
  const updated=calls, after=Object.values(flora.info()).reduce((a,b)=>a+b,0);
  assert.ok(after<before,`${after} should be less than ${before}`);
  flora.update(cam,opts());assert.equal(calls,updated);
  flora.dispose();S.dispose();
});
