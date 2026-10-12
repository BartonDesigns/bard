import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { hairMotion, guideUniform } from '../src/people/hair-motion.js';

function fixture() {
 const head=new T.Object3D(), U={uHairGuides:guideUniform(),uHairMotion:{value:new T.Vector3()},uHairTime:{value:0}};
 const P={bones:[head],map:{head:0}}, update=hairMotion(P,null,U);
 return {head,U,update};
}
test('head turns move free guides differently; repeated render passes do not advance physics',()=>{
 const f=fixture();f.update(0);
 for(let i=1;i<=30;i++){f.head.rotation.y=i*.025;f.update(i/60);}
 const before=f.U.uHairGuides.value.map(v=>v.toArray());
 assert.ok(before.some(v=>Math.hypot(...v)>.001));
 assert.ok(new Set(before.map(JSON.stringify)).size>1);
 f.update(.5);assert.deepEqual(f.U.uHairGuides.value.map(v=>v.toArray()),before);
 for(let i=31;i<300;i++)f.update(i/60);
 assert.ok(f.U.uHairGuides.value.every(v=>v.length()<.00001));
});
test('teleports and resumed animation reset guide momentum without a stale jump',()=>{
 const f=fixture();f.update(0);
 for(let i=1;i<=30;i++){f.head.position.x=i/60;f.update(i/60);}
 assert.ok(f.U.uHairMotion.value.length()>0);
 f.head.position.x=500;f.update(.52);
 assert.ok(f.U.uHairGuides.value.every(v=>v.length()===0));
 assert.equal(f.U.uHairTime.value,.52);
 f.head.position.x+=.01;f.update(2);
 assert.ok(f.U.uHairGuides.value.every(v=>v.length()===0));
});
test('bounded response at 30, 60 and 120 Hz under translation and head rotation',()=>{
 const final=[];
 for(const hz of [30,60,120]) {
  const f=fixture();f.update(0);
  for(let i=1;i<=hz*2;i++){
   const t=i/hz;f.head.position.set(t*2,Math.sin(t*8)*.012,0);f.head.rotation.y=Math.sin(t*4)*.5;f.update(t);
   assert.ok(f.U.uHairGuides.value.every(v=>Number.isFinite(v.length()) && v.length()<=.030001));
  }
  final.push(f.U.uHairMotion.value.clone());
 }
 assert.ok(final[0].distanceTo(final[2])<.003);
});
