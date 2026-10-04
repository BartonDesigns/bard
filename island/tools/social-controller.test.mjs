import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNpcSocial } from '../src/people/social.js';
function harness({ fail = false } = {}) {
 const data = new Map();
 globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem(k,v) { if(fail) throw Error('quota'); data.set(k,v); } };
 const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
 const world = { body: { key: 'test-world' }, island: { heightAt: () => 2 } };
 const api = createNpcSocial({ scene, camera, world: () => world, isPhone: true, hint: () => {} });
 function resident(seed=1, active=true, age=30) {
  const record=api.state.meet({bodyKey:'test-world',home:{x:0,y:2,z:0},dna:{seed,age},persona:{name:'Resident',age}});
  if(active) api.actors.adopt({active:true,P:{root:new THREE.Group(),dna:{seed}},M:{S:{pos:new THREE.Vector3(0,2,0),sitK:{v:0}},want:{},stand(){},setPose(){}},detachForSocial:()=>true},record);
  return record;
 }
 return {api,resident,world,dispose(){api.actors.dispose();delete globalThis.localStorage;}};
}
test('unloaded remembered people cannot promise a physical task; live actors accept it', () => {
 const h=harness();try {
  const r=h.resident(1,false); assert.match(h.api.command(r,'follow me'),/need to be here/);assert.equal(r.mode,'idle');
  const live=h.resident(2);assert.match(h.api.command(live,'follow me'),/follow you on foot/);assert.equal(live.mode,'follow');
  assert.match(h.api.command({...r,bodyKey:'other'},'follow me'),/same world/);
 }finally{h.dispose();}
});
test('scouting validates target and terrain before mutating task and mode', () => {
 const h=harness();try{
  const r=h.resident();
  for(const target of [null,{x:NaN,z:10},{x:1000,z:0},{x:10,z:0,under:true}]) { h.api.command(r,'scout nearby',{target});assert.equal(r.mode,'idle'); }
  h.world.island.heightAt=()=>0;h.api.command(r,'scout nearby',{target:{x:10,z:0}});assert.equal(r.mode,'idle');
  h.world.island.heightAt=()=>2; assert.match(h.api.command(r,'scout the village',{target:{x:10,z:0,name:'the village'}}),/scout the village/);
  assert.equal(r.mode,'scout');assert.equal(r.task.target.x,10);assert.equal(r.task.status,'outbound');
 }finally{h.dispose();}
});
test('save failure is disclosed in accepted responses; young residents are not recruited', () => {
 const h=harness({fail:true});try{
  const r=h.resident();assert.match(h.api.command(r,'wait here'),/could not save/);assert.equal(r.mode,'wait');
  const child=h.resident(2,true,9);assert.match(h.api.command(child,'join my quest'),/adults/);assert.equal(child.mode,'idle');
 }finally{h.dispose();}
});
test('party capacity and canceled scout reports cannot claim fresh completion', () => {
 const h=harness();try{
  for(let i=1;i<4;i++)h.api.state.setMode(h.resident(i).id,'follow');
  const r=h.resident(4);assert.match(h.api.command(r,'follow me'),/group is full/);assert.equal(r.mode,'idle');
  h.api.state.setMode(r.id,'scout',{report:'Old report'});h.api.command(r,'cancel');assert.equal(r.task,null);assert.match(h.api.describe(r),/waiting/);
 }finally{h.dispose();}
});
test('warning and all-clear return accepted replies and disclose unsaved local state', () => {
 for(const fail of [false,true]) {
  const h=harness({fail});try {
   const r=h.resident(), warned=h.api.command(r,'warn the other villagers');
   assert.match(warned,/warn the people nearby/);
   assert.equal(/could not save/.test(warned),fail);
   assert.ok(h.api.state.alarmFor(r.bodyKey,r.position).level>0);
   const calmed=h.api.command(r,'calm everyone down');
   assert.match(calmed,/reassure the people nearby/);
   assert.equal(/could not save/.test(calmed),fail);
   assert.equal(h.api.state.alarmFor(r.bodyKey,r.position).level,0);
  }finally{h.dispose();}
 }
});
test('nearby scouting skips a blocked closer route and refuses when all routes are blocked', () => {
 const h=harness();try {
  h.resident();const actor=h.api.actors.all()[0];
  const nearer={x:5,z:0,name:'blocked'},further={x:0,z:10,name:'clear'};
  h.world.island.extraPush=q=>{if(q.x>1)q.x+=1;};
  assert.equal(h.api.scoutNearby(actor,[nearer,further]),further);
  h.world.island.extraPush=q=>{q.x+=1;};
  assert.equal(h.api.scoutNearby(actor,[nearer,further]),null);
 }finally{h.dispose();}
});
