import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { useAtlasData } from '../src/earth/atlas.js';
import { setFrame, F, toXZ } from '../src/earth/globeframe.js';
import { createGlobeRoads, localRoadTownId, roadCorridorDistance } from '../src/earth/globeroads.js';
import { createBerms, BERM_U } from '../src/bay/berms.js';

function fixture(cities, water = () => false, extraPlaces = () => []) {
 useAtlasData({ REGIONS: [{id:'test',name:'Test land',box:[-85,-180,85,180]}], CITIES:cities });
 setFrame(35, 135);
 const height = { out:{land:1}, atLL(lat,lon) { this.out.land = water(lat,lon) ? -1 : 1; return this.out.land > 0 ? 100 : -10; } };
 const scene = new THREE.Scene(), data = {win:{gi0:3022,gj0:422,N:256,ready:true,moving:null}};
 const roads = createGlobeRoads({scene,height,data,groundAt:()=>100,isPhone:false,extraPlaces});
 const cam = {position:new THREE.Vector3(F.fx,100,F.fz)};
 return {roads,cam,scene};
}

test('highway midpoint and dateline use corridor distance instead of distance to city',()=> {
 const L={a:{lat:35,lon:131},b:{lat:35,lon:139}};
 assert.equal(roadCorridorDistance({lat:35,lon:135},L),0);
 assert.ok(roadCorridorDistance({lat:36,lon:135},L)>100);
 assert.equal(roadCorridorDistance({lat:0,lon:180},{a:{lat:0,lon:179},b:{lat:0,lon:-179}}),0);
});

test('procedural settlements outside the inner Bay join the same deterministic road graph',()=> {
 const extras = [
  {id:'bay-town:west',name:'Westmere',lat:35.01,lon:134.98,pop:2},
  {id:'bay-town:east',name:'Eastmere',lat:35.01,lon:135.04,pop:2},
 ];
 const {roads,cam}=fixture(['Atlas city|35|135.10|3'],()=>false,()=>extras);
 roads.settle(cam);
 const links=roads.links();
 assert.ok(links.some((L)=>L.a.id==='bay-town:west'||L.b.id==='bay-town:west'),'west procedural town is in the network');
 assert.ok(links.some((L)=>L.a.id==='bay-town:east'||L.b.id==='bay-town:east'),'east procedural town is in the network');
 assert.ok(links.some((L)=>[L.a.id,L.b.id].includes('bay-town:west')&&[L.a.id,L.b.id].includes('bay-town:east')),'nearby procedural towns receive a connecting road');
 const out=[]; roads.near('roads',cam.position.x,cam.position.z,20000,out);
 assert.ok(out.some((r)=>r.name.includes('Westmere')||r.name.includes('Eastmere')));
 roads.dispose();
});

test('generated town road identity survives renaming and catalogue reordering',()=> {
 const town={x:1234.4,z:-5678.6,name:'Old name'};
 const id=localRoadTownId(town);
 town.name='New name';
 assert.equal(localRoadTownId(town),id);
 assert.equal(localRoadTownId(town),localRoadTownId({x:1234.4,z:-5678.6,name:'Another name'}));
});

test('continuous streamed motorway pieces share endpoints and terrain clearance',()=> {
 const {roads,cam}=fixture(['West|35|134.85|3','East|35|135.15|3']);
 roads.settle(cam);
 const out=[]; roads.near('roads',cam.position.x,cam.position.z,20000,out);
 assert.ok(out.length>10);
 for (const road of out) {
  assert.equal(road.drive,true); assert.ok(road.pts.length>=4);
  for (const end of [0,road.pts.length-2]) {
   const x=road.pts[end],z=road.pts[end+1];
   const match=out.some(r=>r!==road && [0,r.pts.length-2].some(k=>Math.hypot(r.pts[k]-x,r.pts[k+1]-z)<.1));
   // The only unconnected endpoints may be the two city centres.
   const a=toXZ(35,134.85),b=toXZ(35,135.15);
   assert.ok(match || Math.min(Math.hypot(x-a.x,z-a.z),Math.hypot(x-b.x,z-b.z))<.1);
  }
 }
 const p=roads.group.children[0].geometry.attributes.position;
 for(let i=0;i<p.count;i++) assert.ok(Math.abs(p.getY(i)-100.12)<.001);
 assert.equal(roads.onRoad(out[0].pts[0],out[0].pts[1]),true);
});

test('native regional streets are joined after arriving asynchronously',()=> {
 const {roads,cam}=fixture(['West|35|134.98|2','East|35|135.02|2']);
 roads.settle(cam);
 const town={id:'west',...toXZ(35,134.98),r:300,roads:[]};
 roads.update(.1,cam,true,[town]); roads.settle(cam);
 const p=toXZ(35,134.98);
 town.roads=[{pts:new Float32Array([p.x+250,p.z-50,p.x+250,p.z+50]),cls:'residential'}];
 roads.update(.1,cam,true,[town]); roads.settle(cam);
 const out=[]; roads.near('roads',p.x,p.z,500,out);
 assert.ok(out.some(r=>r.link),'highway connector present once regional streets exist');
});

test('a place standing inside a gridded town is reached through that town\'s streets',()=> {
 const {roads,cam}=fixture(['West|35|134.98|2','East|35|135.02|2','Westend|35.002|134.982|1']);
 roads.settle(cam);
 const p=toXZ(35,134.98);
 // the gridded town round West (and Westend): its own id, its streets near its edge
 const grid={id:'bay-town:grid',x:p.x,z:p.z,r:600,join:500,around:true,roads:[{pts:new Float32Array([p.x+560,p.z-60,p.x+560,p.z+60]),cls:'residential'}]};
 roads.update(.1,cam,true,[grid]); roads.settle(cam);
 const out=[]; roads.near('roads',p.x,p.z,3000,out);
 assert.ok(out.some(r=>r.link),'the highway goes on into the gridded town\'s streets');
 // nothing of the highway runs on inside the town
 for(const r of out) if(!r.link) for(let k=0;k<r.pts.length;k+=2) assert.ok(Math.hypot(r.pts[k]-p.x,r.pts[k+1]-p.z)>600*0.9-40);
 // (West and Westend, both inside it, are joined by its own streets, not a highway across it)
 assert.ok(!out.some(r=>/Westend/.test(r.name)&&/West –|– West$/.test(r.name)));
});

test('a highway goes on into a big gridded town to the first of its streets worked out round you',()=> {
 const {roads,cam}=fixture(['West|35|134.98|2','East|35|135.02|2']);
 roads.settle(cam);
 const p=toXZ(35,134.98), q=toXZ(35,135.02), ux=(q.x-p.x)/Math.hypot(q.x-p.x,q.z-p.z), uz=(q.z-p.z)/Math.hypot(q.x-p.x,q.z-p.z);
 // streets only near its middle (round you), none near its edge where the highway comes in
 const sx=p.x+ux*200, sz=p.z+uz*200;
 const grid={id:'bay-town:big',x:p.x,z:p.z,r:900,join:100,around:true,roads:[{pts:new Float32Array([sx-uz*40,sz+ux*40,sx+uz*40,sz-ux*40]),cls:'residential'}]};
 roads.update(.1,cam,true,[grid]); roads.settle(cam);
 const out=[]; roads.near('roads',p.x,p.z,3000,out);
 const link=out.find(r=>r.link);
 assert.ok(link,'joined to the first street in');
 const n=link.pts.length, ends=[[link.pts[0],link.pts[1]],[link.pts[n-2],link.pts[n-1]]];
 assert.ok(ends.some(([x,z])=>Math.hypot(x-sx-uz*40,z-sz+ux*40)<1||Math.hypot(x-sx+uz*40,z-sz-ux*40)<1),'the link ends at a street end');
 // the highway itself reaches in past the town's edge to there
 const inner=Math.min(...out.filter(r=>!r.link&&/West/.test(r.name)).flatMap(r=>{const d=[];for(let k=0;k<r.pts.length;k+=2)d.push(Math.hypot(r.pts[k]-p.x,r.pts[k+1]-p.z));return d;}));
 assert.ok(inner<900*0.9-50&&inner>150,`highway reaches ${inner|0} m from the middle`);
});

test('a city\'s district is not the highway\'s end: it leaves the road at the district\'s edge and joins its streets there',()=> {
 const {roads,cam}=fixture(['West|35|134.8|3','East|35|135.1|3']);
 roads.settle(cam);
 const a=toXZ(35,134.8), b=toXZ(35,135.1), L=Math.hypot(b.x-a.x,b.z-a.z), ux=(b.x-a.x)/L, uz=(b.z-a.z)/L, nx=-uz, nz=ux;
 // one of East's districts on the way in, its edge 300 m short of East's middle (as the Strip is
 // of Las Vegas's), sharing the city's id as a district did; a street just in from each edge
 const r=1500, c={x:b.x-ux*(r+300),z:b.z-uz*(r+300)};
 const stub=(t,s)=>{const x=c.x+ux*t+nx*s*40,z=c.z+uz*t+nz*s*40;return {pts:new Float32Array([x,z,x+nx*s*100,z+nz*s*100]),cls:'residential'};};
 const district={id:'east',district:true,around:true,through:true,join:500,x:c.x,z:c.z,r,roads:[stub(-1150,1),stub(1150,-1),stub(0,1)]};
 roads.update(.1,cam,true,[district]); roads.settle(cam);
 const out=[]; roads.near('roads',c.x,c.z,6000,out);
 const hw=out.filter(q=>!q.link&&/West – East/.test(q.name)), links=out.filter(q=>q.link);
 // nothing of the highway runs across the district
 for(const q of hw) for(let k=0;k<q.pts.length;k+=2) assert.ok(Math.hypot(q.pts[k]-c.x,q.pts[k+1]-c.z)>r*0.9-40,'highway over the district');
 // ...it goes on to the city's middle past it
 assert.ok(hw.some(q=>{for(let k=0;k<q.pts.length;k+=2) if(Math.hypot(q.pts[k]-b.x,q.pts[k+1]-b.z)<50) return true; return false;}),'highway reaches East');
 // joined to the district's streets each way, and only by a short way in
 assert.ok(links.length>=2,`${links.length} joins`);
 for(const q of links){const n=q.pts.length; assert.ok(Math.hypot(q.pts[n-2]-q.pts[0],q.pts[n-1]-q.pts[1])<450,'a long join across the district');}
 roads.dispose();
});

test('a grown town a highway only passes through is not cut where it has no street to join',()=> {
 const {roads,cam}=fixture(['West|35|134.8|3','East|35|135.1|3']);
 roads.settle(cam);
 const a=toXZ(35,134.8), b=toXZ(35,135.1), c={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
 const before=[]; roads.near('roads',c.x,c.z,1000,before);
 // its only street far off the highway's line
 const town={id:'mid',through:true,x:c.x,z:c.z,r:1200,roads:[{pts:new Float32Array([c.x,c.z+900,c.x+100,c.z+900]),cls:'residential'}]};
 roads.update(.1,cam,true,[town]); roads.settle(cam);
 const out=[]; roads.near('roads',c.x,c.z,1000,out);
 assert.ok(!out.some(q=>q.link));
 assert.ok(out.some(q=>{for(let k=0;k<q.pts.length;k+=2) if(Math.hypot(q.pts[k]-c.x,q.pts[k+1]-c.z)<100) return true; return false;}),'the highway still runs through');
 roads.dispose();
});

test('open sea is not replaced by a continent-spanning road',()=> {
 const {roads,cam}=fixture(['West|35|134.85|3','East|35|135.15|3'],(_lat,lon)=>lon>134.94&&lon<135.06);
 roads.settle(cam);
 assert.ok(roads.info().failed>0);
 assert.equal(roads.info().pieces,0);
});

test('rural source roads grade outside city regions and refresh without moving',()=> {
 let sourceVersion=0, available=false;
 const r={drive:true,cls:'primary',w:8,pts:new Float32Array([0,-100,0,100])};
 const real={loaded:()=>true,inside:()=>false,version:()=>1,sourceVersion:()=>sourceVersion,near:()=>available?[r]:[]};
 const raw=(x)=>100+x*.2;
 const berms=createBerms(real,raw), cam={position:new THREE.Vector3(0,102,0)};
 berms.update(cam); assert.equal(BERM_U.uBermR.value.w,0);
 available=true; sourceVersion++;
 berms.update(cam); assert.equal(BERM_U.uBermR.value.w,1);
 assert.ok(Math.abs(berms.apply(3,0,raw(3))-100)<.05);
});

test('production drive graph can leave a regional street through a bidirectional highway connector',async()=> {
 const {createDrive}=await import('../src/drive.js');
 const oldDocument=globalThis.document, oldWindow=globalThis.window;
 const element=()=>({style:{},dataset:{},setAttribute(){},appendChild(){},addEventListener(){}});
 globalThis.document={createElement:element}; globalThis.window={addEventListener(){}};
 try {
  const {roads,cam}=fixture(['West|35|134.98|2','East|35|135.02|2']);
  const p=toXZ(35,134.98), local={pts:new Float32Array([p.x+250,p.z-50,p.x+250,p.z+50]),cls:'residential',w:8,name:'Local street'};
  const town={id:'west',...p,r:300,roads:[local]};
  roads.update(.1,cam,true,[town]); roads.settle(cam); roads.update(.1,cam,true,[town]); roads.settle(cam);
  const out=[]; roads.near('roads',p.x,p.z,1000,out);
  const join=out.find(r=>r.link); assert.ok(join);
  const W={real:{near:()=>[local,...out]}};
  const drive=createDrive({world:()=>W,camera:cam,mount:element(),hint(){},isPhone:false});
  const end=join.pts.length-2;
  const dir=Math.hypot(local.pts[0]-join.pts[end],local.pts[1]-join.pts[end+1])<1 ? -1 : 1;
  Object.assign(drive.state,{edge:{pts:local.pts,L:100,real:local,cls:local.cls,name:local.name,w:8},dir});
  assert.ok(drive.debugOptions().some(o=>o.name==='West – East'),'reverse traversal onto highway connector offered');
 } finally { globalThis.document=oldDocument;globalThis.window=oldWindow; }
});

test('landing halfway along a long intercity corridor streams continuous road pieces',()=> {
 const {roads,cam}=fixture(['West|35|131|3','East|35|139|3']);
 roads.settle(cam);
 assert.ok(roads.info().pieces>0);
 assert.ok(roads.links()[0].km>700);
 const out=[]; roads.near('roads',cam.position.x,cam.position.z,5000,out);
 assert.ok(out.length>2);
 const route=roads.routes.values().next().value;
 const before=[route.lat[20],route.lon[20]];
 setFrame(35,135.2); roads.reframe(); cam.position.x=F.fx; cam.position.z=F.fz; roads.settle(cam);
 assert.deepEqual([route.lat[20],route.lon[20]],before,'geographic route remains stable across floating frame');
 assert.ok(roads.info().pieces>0);
 roads.dispose(); assert.equal(roads.routes.size,0); assert.equal(roads.info().cachedPieces,0);
});

test('stationary dense regions stop routing once the bounded nearby cache is complete',()=> {
 const cities=[];
 for(let y=0;y<8;y++) for(let x=0;x<8;x++) cities.push(`Place ${x} ${y}|${34.93+y*.02}|${134.93+x*.02}|2`);
 const {roads,cam}=fixture(cities);
 for(let i=0;i<350;i++) { roads.update(.1,cam,true,[]); assert.ok(roads.info().cachedRoutes<=48); }
 const done=roads.info(); assert.equal(done.queue,0); assert.equal(done.routing,null); assert.equal(done.cachedRoutes,48);
 for(let i=0;i<60;i++) roads.update(.1,cam,true,[]);
 assert.equal(roads.info().routed,done.routed,'no repeated eviction/recomputation while stationary');
 roads.dispose();
});
