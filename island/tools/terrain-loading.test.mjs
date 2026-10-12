import test from 'node:test';
import assert from 'node:assert/strict';
import {createBerms, BERM_U} from '../src/bay/berms.js';

function fixture(road) {
 let loaded=false, height=100, samples=0;
 const real={loaded:()=>true,inside:()=>true,version:()=>1,near:(kind)=>kind==='roads'?[road]:[]};
 const ground=()=>{samples++; return loaded?height:-60;};
 const berms=createBerms(real,ground,ground,{ready:()=>loaded});
 const camera={position:{x:0,y:102,z:0}};
 return {berms,camera,ground,set:(on,h=height)=>{loaded=on;height=h;},samples:()=>samples};
}
const road=()=>({drive:true,cls:'residential',w:10,pts:new Float32Array([0,-400,0,400])});

test('roads arriving before the survey cannot cache the loading seabed',()=>{
 const f=fixture(road());
 f.berms.update(f.camera);
 assert.equal(f.samples(),0,'do not even sample incomplete terrain');
 assert.equal(BERM_U.uBermR.value.w,0);
 assert.equal(f.berms.profile(road()),null);
 f.set(true);
 // No camera movement or road revision is needed for the first valid grade.
 f.berms.update(f.camera);
 assert.equal(BERM_U.uBermR.value.w,1);
 assert.ok(Math.abs(f.berms.apply(0,0,100)-100)<.01);
 f.camera.position.z=120;f.berms.update(f.camera);
 assert.ok(Math.abs(f.berms.apply(0,120,100)-100)<.01,'moving cannot resurrect -60 m grade');
});

test('survey reload disables old deltas and rebuilds profiles at the same position',()=>{
 const f=fixture(road());f.set(true,100);f.berms.update(f.camera);
 f.set(false);f.berms.update(f.camera);
 assert.equal(BERM_U.uBermR.value.w,0);assert.equal(BERM_U.uTreadR.value.w,0);
 f.set(true,140);f.berms.update(f.camera);
 assert.ok(Math.abs(f.berms.apply(0,0,140)-140)<.01);
});

test('road objects cannot carry cached grades across world lifetimes',()=>{
 const r=road();r.bermP={h:new Float32Array([-60,-60]),acc:[0,800]};
 const a=fixture(r);a.set(true,50);a.berms.update(a.camera);
 assert.ok(Math.abs(a.berms.apply(0,0,50)-50)<.01);
 const b=fixture(r);assert.equal(BERM_U.uBermR.value.w,0);
 b.set(true,180);b.berms.update(b.camera);
 assert.ok(Math.abs(b.berms.apply(0,0,180)-180)<.01);
});
