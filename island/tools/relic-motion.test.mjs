import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { RELICS, LEGENDARIES, LEGENDARY_ARMOR } from '../src/gameplay/legendary-items.js';
import { createRelicEffect } from '../src/crysis/relic-effects.js';
import { RELIC_MOTION, eyeGaze, eyeOpenness } from '../src/crysis/relic-motion.js';
import { itemModel, spinMotes, disposeItemModel, triangles } from '../src/crysis/held-items.js';
import { armorPickupModel } from '../src/combat/armor-pickup.js';
import { dressInGear, wearCode, wornOfCode } from '../src/people/armor-looks.js';
import { dressArmorEffects, clearArmorEffects, updateArmorEffects, armorEffectsLOD } from '../src/people/relic-armor-effects.js';

function snapshot(fx) {
 const out=[];fx.root.traverse(o=>{out.push([...o.position,...o.scale,o.rotation.x,o.rotation.y,o.rotation.z]);if(o.material?.uniforms)out.push(Object.fromEntries(Object.entries(o.material.uniforms).map(([k,v])=>[k,v.value?.toArray?v.value.toArray():v.value])));});return JSON.stringify(out);
}
function resources(root) {const g=new Set(),m=new Set();let draws=0;root.traverse(o=>{if(o.isMesh){draws++;g.add(o.geometry);m.add(o.material);}assert.ok(!o.isLight);});return {g,m,draws};}

test('every one of 28 relics has a distinct authored, bounded and moving effect in both LODs',()=>{
 assert.equal(Object.keys(RELIC_MOTION).length,28);assert.equal(new Set(Object.values(RELIC_MOTION)).size,28);
 for(const lod of ['low','high'])for(const id of Object.keys(RELICS)){
  const fx=createRelicEffect(id,{lod});assert.ok(fx.channels>0,id);
  const before=snapshot(fx),owned=resources(fx.root);assert.ok(owned.draws<=6,`${id} draws ${owned.draws}`);assert.ok(triangles(fx.root)<=1400,`${id} triangle budget`);
  fx.update(2.31);assert.notEqual(snapshot(fx),before,id);
  for(let i=0;i<180;i++)fx.update(i/30);
  const after=resources(fx.root);assert.deepEqual(after.g,owned.g,'no geometry churn');assert.deepEqual(after.m,owned.m,'no material churn');
  fx.root.traverse(o=>assert.ok([...o.position,...o.scale,o.rotation.x,o.rotation.y,o.rotation.z].every(Number.isFinite),id));
  const box=new THREE.Box3().setFromObject(fx.root),size=box.getSize(new THREE.Vector3());assert.ok(Math.max(...size)<1.5,id);
  fx.dispose();
 }
 assert.equal(createRelicEffect('ordinary-item'),null);
});

test('First Morning fully blinks occasionally, has dwell time, and glances in both directions',()=>{
 assert.equal(eyeOpenness(0),1);assert.equal(eyeOpenness(6.9),0);assert.equal(eyeOpenness(7.1),1);
 assert.ok(eyeGaze(4,new THREE.Vector2()).x<0);assert.ok(eyeGaze(7,new THREE.Vector2()).x>0);
 assert.equal(eyeGaze(4,new THREE.Vector2()).x,eyeGaze(5,new THREE.Vector2()).x);
 for(let t=0;t<100;t+=.01)assert.ok(eyeOpenness(t)>=0 && eyeOpenness(t)<=1);
});

test('reduced motion freezes every effect and private triggers never leak between instances',()=>{
 for(const id of Object.keys(RELICS)){
  const a=createRelicEffect(id),b=createRelicEffect(id);const original=snapshot(b);
  a.trigger();a.update(2);assert.equal(snapshot(b),original);
  a.update(3,{reducedMotion:true});const still=snapshot(a);a.update(22,{reducedMotion:true});assert.equal(snapshot(a),still,id);
  a.update(NaN);assert.equal(snapshot(a),still);a.dispose();b.dispose();
 }
});

test('owned geometries/materials dispose exactly once and release cannot damage another copy',()=>{
 for(const id of Object.keys(RELICS)){
  const a=createRelicEffect(id),b=createRelicEffect(id),r=resources(a.root);let g=0,m=0;
  for(const x of r.g)x.addEventListener('dispose',()=>g++);for(const x of r.m)x.addEventListener('dispose',()=>m++);
  const parent=new THREE.Group();parent.add(a.root);a.dispose();a.dispose();a.update(3);a.trigger();
  assert.equal(parent.children.length,0);assert.equal(g,r.g.size);assert.equal(m,r.m.size);assert.equal(a.disposed,true);
  assert.equal(b.disposed,false);assert.ok(b.channels>0);b.update(4);b.dispose();
 }
});

test('held, inspected and ground-loot models carry their own effect; armor survives equip protocol',()=>{
 for(const def of LEGENDARIES){
  const m=itemModel(def.id,{tier:4,plain:true});const before=snapshot(m.userData.relicFX);spinMotes(m,3);assert.notEqual(snapshot(m.userData.relicFX),before);assert.ok(triangles(m)<20000);disposeItemModel(m);assert.equal(m.userData.relicFX.disposed,true);
 }
 for(const def of LEGENDARY_ARMOR){
  const w=wornOfCode(wearCode({[def.slot]:def.id}));const s=dressInGear({acc:[]},w);assert.deepEqual(s.relics,[def.id]);
  const m=armorPickupModel(def.id);assert.equal(m.userData.relicFX.id,def.id);const before=snapshot(m.userData.relicFX);spinMotes(m,3);assert.notEqual(snapshot(m.userData.relicFX),before);disposeItemModel(m);
  m.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  assert.deepEqual(dressInGear(s,{}).relics,[],'unequip clears relic identity');
 }
});

test('worn armor follows real bone attachments, LOD hides costly detail, redress and release clean up',()=>{
 const names=['head','spine01','lowerleg01.L','lowerleg01.R','wrist.L','wrist.R','foot.L','foot.R'];
 const P={bones:names.map(()=>new THREE.Bone()),map:Object.fromEntries(names.map((n,i)=>[n,i])),height:1.75};
 dressArmorEffects(P,LEGENDARY_ARMOR.map(x=>x.id));assert.equal(P.relicEffects.length,11);
 for(const fx of P.relicEffects)assert.ok(P.bones.includes(fx.root.parent));
 updateArmorEffects(P,2);armorEffectsLOD(P,40);assert.ok(P.relicEffects.every(f=>!f.root.visible));armorEffectsLOD(P,2);assert.ok(P.relicEffects.every(f=>f.root.visible));
 const old=P.relicEffects.slice();dressArmorEffects(P,['lumencrest-circlet']);assert.ok(old.every(f=>f.disposed));assert.equal(P.relicEffects.length,1);clearArmorEffects(P);assert.equal(P.relicEffects.length,0);assert.ok(P.bones.every(b=>b.children.length===0));
});

test('all 24 retained wraparound sheets cover the 20 weapons and four paired armor collections',()=>{
 const doc=JSON.parse(readFileSync(new URL('../../docs/relic-turnaround-prompts-2026-10-24.json',import.meta.url)));
 assert.equal(doc.entries.length,24);assert.equal(new Set(doc.entries.map(x=>x.id)).size,24);
 for(const x of doc.entries){assert.ok(existsSync(new URL('../../'+x.path,import.meta.url)),x.id);assert.ok(x.prompt.length>100);}
 for(const x of LEGENDARIES)assert.ok(doc.entries.some(e=>e.id===x.id));
});
