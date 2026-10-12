import test from 'node:test';
import assert from 'node:assert/strict';
import {PICNIC,CAST,eligiblePicnic,picnicGround,findPicnicSpot,picnicDue,shotOnBeat,picnicSeats,picnicActivity,FLOOR_POSES} from './picnic-plan.js';
test('floor poses vary, and each friend takes a separate turn to stretch their legs',()=>{
 assert.equal(FLOOR_POSES.length,CAST.length);
 assert.ok(FLOOR_POSES.some(p=>p.lean>.2));assert.ok(FLOOR_POSES.some(p=>p.roll<-.2));assert.ok(FLOOR_POSES.some(p=>p.roll>.2));
 for(let t=0;t<256;t+=.25)assert.ok(CAST.filter((_,i)=>picnicActivity(t,i)!=='seated').length<=1);
 for(let i=0;i<CAST.length;i++){
  const states=new Set(Array.from({length:1280},(_,n)=>picnicActivity(n/10,i)));
  for(const s of ['seated','rise','shuffle-out','stand','shuffle-back','settle'])assert.ok(states.has(s));
 }
});
test('eight friends have separate seats with room for their bodies and feet',()=>{
 const seats=picnicSeats();assert.equal(CAST.length,8);assert.equal(seats.length,CAST.length);
 for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++)assert.ok(Math.hypot(seats[i].x-seats[j].x,seats[i].z-seats[j].z)>1.6);
 assert.equal(CAST.filter(c=>c.role==='strings').length,3);
 assert.equal(CAST.filter(c=>c.role==='sky-shot').length,2);
});
test('daytime walking encounter excludes travel and cave modes',()=>{
 const base={type:'EARTH',hours:14};assert.equal(eligiblePicnic(base),true);
 for(const patch of [{type:'MOON'},{hours:19},{hours:9},{flying:true},{submerged:true},{underground:true},{busy:true}])assert.equal(eligiblePicnic({...base,...patch}),false);
 assert.ok(CAST.every(c=>c.age>=18));
});
test('siting rejects water, bad heights, slopes and obstacles across the full footprint',()=>{
 assert.deepEqual(picnicGround(0,0,()=>2),{x:0,y:2,z:0});
 for(const height of [()=>0,()=>NaN,(x)=>2+x*.1])assert.equal(picnicGround(0,0,height),null);
 assert.equal(picnicGround(0,0,()=>2,(x,z)=>x===2.5&&z===2.5),null);
 const behind=findPicnicSpot({x:0,z:0},0,()=>2,()=>false,()=>.5);assert.ok(behind.z>=28);assert.equal(behind.x,0);
});
test('minute scan and saved cooldown both gate a new occurrence',()=>{
 const now=10_000_000;assert.equal(picnicDue(59,0,now,()=>0),false);
 assert.equal(picnicDue(60,now-PICNIC.cooldown*1000+1,now,()=>0),false);
 assert.equal(picnicDue(60,0,now,()=>.1),false);assert.equal(picnicDue(60,0,now,()=>0),true);
});
test('staggered shots leave the music uninterrupted and never bunch up',()=>{
 const beats=Array.from({length:32},(_,i)=>i);
 assert.deepEqual(beats.filter(n=>shotOnBeat(n,2)),[10,26]);assert.deepEqual(beats.filter(n=>shotOnBeat(n,3)),[15,30]);
 assert.ok(beats.every(n=>!shotOnBeat(n,0)&&!shotOnBeat(n,1)));
 assert.ok(beats.every(n=>!(shotOnBeat(n,2)&&shotOnBeat(n,3))));
});
