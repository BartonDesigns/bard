import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSocialActors, safeSocialStep, positionFor, worldPosition } from '../src/people/social-actors.js';
import { bayFrame, setFrame } from '../src/earth/globeframe.js';

test('resident movement rejects water, abrupt cliffs, and wall push',()=>{
 const p={x:0,y:2,z:0}, q={x:.05,z:0};
 assert.equal(safeSocialStep({heightAt:()=>0},p,q),null);
 assert.equal(safeSocialStep({heightAt:()=>4},p,q),null);
 assert.equal(safeSocialStep({heightAt:()=>2,extraPush:v=>{v.x+=.2;}},p,q),null);
 assert.deepEqual(safeSocialStep({heightAt:()=>2},p,q),{x:.05,y:2,z:0});
});
test('resident floor follows supported indoor and below sea-level floors',()=>{
 assert.deepEqual(safeSocialStep({heightAt:()=>-20,extraFloor:()=>-4},{x:0,y:-4,z:0},{x:.03,z:0}),{x:.03,y:-4,z:0});
 assert.equal(safeSocialStep({heightAt:()=>0,extraFloor:()=>6},{x:0,y:2,z:0},{x:.03,z:0}),null);
});
test('Earth resident positions survive rebasing and other planets remain local',()=>{
 bayFrame(); const saved=positionFor({globe:{}},{x:100,y:2,z:80});
 setFrame(48,8); const moved=worldPosition({globe:{}},saved);
 const restored=positionFor({globe:{}},moved);
 assert.ok(Math.abs(restored.lat-saved.lat)<1e-9); assert.ok(Math.abs(restored.lon-saved.lon)<1e-9);
 assert.deepEqual(positionFor({}, {x:3,y:5,z:7}),{x:3,y:5,z:7});
 bayFrame();
});

test('promotion keeps the exact body, bounds live actors and unregisters on disposal',()=>{
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera();
 const saved=[], state={setPosition:(id,p)=>saved.push([id,p]),flush:()=>{}};
 const rt=createSocialActors({scene,camera,world:()=>({island:{heightAt:()=>2}}),state,bodyKey:()=> 'test',isPhone:true});
 let freed=0;
 const make=(i)=>{const root=new THREE.Group(); return {P:{root,dna:{seed:i},skeleton:{dispose:()=>freed++}},M:{S:{pos:new THREE.Vector3(i,2,0),sitK:{v:0}},want:{},stand(){},setPose(){}},detachForSocial:()=>true};};
 const first=make(1); assert.equal(rt.adopt(first,{id:'1',persona:{name:'One'}}),first);
 assert.equal(first.residentId,'1');
 for(let i=2;i<=8;i++) rt.adopt(make(i),{id:String(i),persona:{}});
 assert.equal(rt.all().length,4); assert.equal(freed,4);
 rt.flush(); assert.equal(rt.all().length,4); assert.equal(freed,4); assert.equal(saved.length,8);
 rt.update(.1,0,false); assert.equal(scene.children[0].visible,false);
 rt.reset(); assert.equal(rt.all().length,0); assert.equal(freed,8); assert.equal(saved.length,12);
 rt.dispose(); assert.equal(scene.children.length,0);
});

test('dungeon floor overrides surface and uses dungeon walls only',()=>{
 let surfacePush=0, underPush=0;
 const island={heightAt:()=>50,underFloor:()=>-12,extraPush:()=>surfacePush++,underPush:q=>{underPush++;if(q.x>.1)q.x=.1;}};
 assert.deepEqual(safeSocialStep(island,{x:0,y:-12,z:0},{x:.02,z:0}),{x:.02,y:-12,z:0});
 assert.equal(safeSocialStep(island,{x:0,y:-12,z:0},{x:.2,z:0}),null);
 assert.equal(surfacePush,0); assert.equal(underPush,2);
 const player={floorAt:()=>3,pushOut:q=>{q.x+=1;}};
 assert.equal(safeSocialStep({heightAt:()=>3},{x:0,y:3,z:0},{x:.02,z:0},player),null);
});

test('blocked followers stop after eight seconds and actor group survives scene clear',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(); camera.position.set(10,3.68,0);
 const record={id:'blocked',mode:'follow',position:{x:0,y:2,z:0},dna:{seed:1},persona:{name:'A'}};
 const state={get:()=>record,list:()=>[record],alarmFor:()=>({level:0}),setMode:(id,mode,task)=>{record.mode=mode;record.task=task;},setPosition:(id,q)=>{record.position=q;},flush(){}};
 const S={pos:new THREE.Vector3(0,2,0),sitK:{v:0},speed:{v:0},heading:Math.PI/2,look:{}};
 const want={};
 const M={S,want,stand(){},setPose(){},update(dt){S.pos.x+=want.speed*dt;},place(x,y,z){S.pos.set(x,y,z);}};
 const p={P:{root:new THREE.Group(),dna:{seed:1}},M,detachForSocial:()=>true};
 const world={island:{heightAt:()=>2,extraPush:q=>{if(q.x>.1)q.x=.1;}}};
 const rt=createSocialActors({scene,camera,state,world,bodyKey:'test'});rt.adopt(p,record);
 scene.clear();rt.update(.05,0,false);assert.equal(scene.children.length,1);assert.equal(scene.children[0].visible,false);
 for(let i=0;i<190;i++)rt.update(.05,i*.05,true);
 assert.equal(record.mode,'wait');assert.ok(S.pos.x<=.14);rt.dispose();
});

test('flush after Earth rebase preserves movement newer than the save interval',()=>{
 bayFrame();
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(10,3.68,0);
 const record={id:'moving',mode:'follow',position:positionFor({globe:{}},{x:0,y:2,z:0}),dna:{seed:2},persona:{}};
 const state={get:()=>record,list:()=>[record],alarmFor:()=>({level:0}),setPosition:(id,q)=>{record.position=q;},flush(){}};
 const S={pos:new THREE.Vector3(0,2,0),sitK:{v:0},speed:{v:0},heading:Math.PI/2,look:{}},want={};
 const M={S,want,stand(){},setPose(){},update(dt){S.pos.x+=want.speed*dt;},place(x,y,z){S.pos.set(x,y,z);}};
 const p={P:{root:new THREE.Group(),dna:{seed:2}},M,detachForSocial:()=>true};
 const world={globe:{},island:{heightAt:()=>2}};
 const rt=createSocialActors({scene,camera,state,world,bodyKey:'earth'});rt.adopt(p,record);rt.update(.05,0,true);
 const latest=positionFor(world,S.pos);assert.notEqual(latest.lon,record.position.lon);
 setFrame(48,8);rt.flush();assert.ok(Math.abs(record.position.lon-latest.lon)<1e-9);assert.ok(Math.abs(record.position.lat-latest.lat)<1e-9);
 rt.dispose();bayFrame();
});
