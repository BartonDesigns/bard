import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { generateIsland } from '../src/world/islandgen.js';
import { planetProfile } from '../src/planet/profile.js';
import { meshChunk } from '../src/planet/cavenet.js';
globalThis.addEventListener ||= () => {};
globalThis.window ||= {};
const { createUnderworld } = await import('../src/planet/underworld.js');
function setup() {
 const profile=planetProfile('ICE',1337), island=generateIsland({seed:1337,resolution:96,profile});
 const shared={uTime:{value:0},uBass:{value:0},uSunDir:{value:new THREE.Vector3(0,1,0)},uSunColor:{value:new THREE.Color(1,1,1)}};
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera();
 return {profile,island,shared,scene,camera};
}
test('null plan remains disabled and does not regenerate underground',()=>{
 const s=setup(), u=createUnderworld(s.island,s.shared,s.scene,s.camera,s.profile,{plan:null,dinosaurs:false});
 assert.equal(u.plan,null); assert.equal(u.entrances.length,0); assert.equal(u.dinosaurs,null);u.dispose();
});
test('streamed mouth rendering and floor admission agree; music targets release on eviction',()=>{
 const s=setup(), u=createUnderworld(s.island,s.shared,s.scene,s.camera,s.profile,{isPhone:true,dinosaurs:false});
 const e=u.entrances[0];assert.ok(e);
 const chamber=u.plan.chambers[0];
 assert.equal(u.clearBody(chamber.x,chamber.fy+1,chamber.z),true);
 assert.equal(u.clearBody(chamber.x,s.island.heightAt(chamber.x,chamber.z)-2,chamber.z),false);
 assert.equal(u.clearBody(NaN,0,0),false);
 s.camera.position.set(e.x,e.y+1.68,e.z);
 assert.equal(u.ready(0),false); assert.equal(u.floor(e.x,e.z,e.y),null);
 const targets=u.pickables;
 let frames=0;
 while(!u.ready(0)&&frames++<2000)u.update(1/60,frames/60);
 assert.ok(u.ready(0),'mouth must open via incremental frames');
 assert.ok(Number.isFinite(u.floor(e.x,e.z,e.y)),'ready mouth admits the real cave floor');
 assert.ok(u.stats().meshes>0); assert.equal(u.pickables,targets);
 const rocks=targets.filter(o=>o.userData.material175==='stone'&&!o.isInstancedMesh&&o.geometry.getAttribute('aInfo'));
 assert.ok(rocks.length,'streamed stone is playable');
 const disposed=new Set();for(const mesh of rocks)mesh.geometry.addEventListener('dispose',()=>disposed.add(mesh));
 // Move beyond the residency radius, leaving the old mouths and interior behind.
 s.camera.position.set(5000,5000,5000);u.update(1,100);
 assert.equal(u.stats().meshes,0);assert.equal(u.stats().generating,0);
 assert.equal(disposed.size,rocks.length);
 assert.ok(rocks.every(mesh=>!targets.includes(mesh)),'no stale music raycast targets');
 assert.equal(u.ready(0),false);u.dispose();assert.equal(targets.length,0);
});
test('mesh generation yields before completing the coarse field pass',()=>{
 let calls=0;
 const field={out:{kind:0},solid(){calls++;return 10;},inHole:()=>false};
 const generator=meshChunk(field,0,0,0,24,1);
 assert.equal(generator.next().done,false);
 assert.ok(calls<200,'first yield must not scan entire coarse cube');
 generator.return();
});
test('Earth, ice and magma keep deterministic per-seed underground topology',async()=>{
 const {planCaves}=await import('../src/planet/cavenet.js');
 const shapes=[];
 for(const type of ['TROPICAL','ICE','MAGMA']){
  const profile=planetProfile(type,1337),island=generateIsland({seed:1337,resolution:96,profile});
  const a=planCaves(island,profile),b=planCaves(island,profile);
  assert.ok(a?.entrances.length,`${type} must have a walkable mouth`);
  assert.deepEqual(a.entrances.map(e=>[e.x,e.y,e.z]),b.entrances.map(e=>[e.x,e.y,e.z]));
  for(const e of a.entrances){const pts=e.tunnel.pts;assert.ok(pts.length>2);for(let i=1;i<pts.length;i++)assert.ok(Math.abs(pts[i].y-pts[i-1].y)/Math.max(.01,Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z))<.5,'walkable ramp grade');}
  shapes.push(JSON.stringify(a.chambers.map(c=>[c.x,c.z,c.fy,c.pools.map(p=>p.kind)])));
 }
 assert.equal(new Set(shapes).size,3,'planet profiles change cave topology and contents');
});
