import test from 'node:test';
import assert from 'node:assert/strict';
import { createMorality } from '../src/combat/morality.js';
import { createSoul } from '../src/reputation/soul.js';
import { Soul } from '../../server/multiplayer/src/soul.js';
import { generateIsland } from '../src/world/islandgen.js';
import { planetProfile } from '../src/planet/profile.js';
import { planCaves } from '../src/planet/cavenet.js';
import { awarenessContext, contextualOpening } from '../src/people/world-awareness.js';
const storage=()=>{const m=new Map();return{get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const backing=()=>{const m=new Map();return{get:async k=>structuredClone(m.get(k)),put:async(o)=>{for(const[k,v]of Object.entries(o))m.set(k,structuredClone(v));}};};
const transport=s=>async(url,init={})=>s.fetch(new Request('https://soul/me',init));
const make=(st,s)=>{const morality=createMorality();return{morality,soul:createSoul({morality,storage:st,url:'https://rooms',request:transport(s)})};};
test('offline deeds survive reload, sync exactly once, recover in a new browser and carry across worlds',async()=>{
 const st=storage(),s=new Soul({storage:backing()});let a=make(st,s);
 a.morality.record({kind:'robbery',world:'earth',target:'Resident'});a.morality.record({kind:'favour',world:'w1969'});
 const expected=a.morality.me();a.soul.dispose();a=make(st,s);assert.deepEqual(a.morality.me(),expected);assert.equal(a.soul.info().pending,2);
 await a.soul.sync();assert.equal(a.soul.info().pending,0);await a.soul.sync();assert.deepEqual(a.morality.me(),expected);
 const b=make(storage(),s);await b.soul.recover(a.soul.recoveryKey());assert.deepEqual(b.morality.me(),expected);assert.equal(b.morality.world('w1969').deeds,1);
 a.soul.dispose();b.soul.dispose();
});
test('two tabs merge their independent outbox events without double scoring',async()=>{
 const st=storage(),s=new Soul({storage:backing()}),a=make(st,s),b=make(st,s);
 a.morality.record({kind:'favour'});b.morality.record({kind:'robbery'});
 await Promise.all([a.soul.sync(),b.soul.sync()]);await a.soul.sync();await b.soul.sync();
 assert.equal(a.morality.me().deeds,2);assert.deepEqual(a.morality.me(),b.morality.me());a.soul.dispose();b.soul.dispose();
});
test('failed cloud saves retain local standing and outbox',async()=>{
 const st=storage(),m=createMorality(),soul=createSoul({morality:m,storage:st,url:'https://rooms',request:async()=>{throw Error('offline');}});
 m.record({kind:'robbery'});assert.equal(await soul.sync(),false);assert.equal(soul.info().pending,1);assert.equal(m.me().deeds,1);assert.equal(soul.info().status,'local');soul.dispose();
});
test('an in-flight save cannot replace a recovered soul with the previous identity',async()=>{
 const m=createMorality(),other=createMorality();other.record({kind:'favour'});
 let finishRecovery,finishSave;
 const soul=createSoul({morality:m,storage:storage(),url:'https://rooms',request:async(url,init)=>new Promise(resolve=>{
  if(init.method==='GET')finishRecovery=()=>resolve(Response.json({ledger:other.snapshot(),revision:10}));
  else finishSave=()=>resolve(Response.json({ledger:createMorality().snapshot(),revision:1}));
 })});
 const recovery=soul.recover('b'.repeat(64)),save=soul.sync();
 finishRecovery();await recovery;finishSave();await save;
 assert.equal(soul.recoveryKey(),'b'.repeat(64));assert.equal(m.me().deeds,1);assert.equal(soul.info().revision,10);assert.equal(soul.info().status,'saved');soul.dispose();
});
test('old eyewitness fear clears after cleansing, reputation is lasting without inventing an eyewitness',()=>{
 const event={id:'crime',bodyKey:'earth',kind:'robbery',actorId:'player',at:1000,line:'robbed a resident'};
 const clean=awarenessContext({events:[event],reports:[{...event,age:1}],bodyKey:'earth',now:2000,cleansedAt:1500,standing:{reputation:0}});assert.equal(clean.afraid,false);
 const bad=awarenessContext({standing:{reputation:-50},now:1e12});assert.match(contextualOpening(bad),/reputation|deeds/);assert.doesNotMatch(contextualOpening(bad),/I saw/);
 const innocent=awarenessContext({standing:{reputation:0},nearbyStanding:[{name:'Other',reputation:-50,deeds:5}]});assert.ok(innocent.facts[0].includes('NOT the local'));assert.equal(innocent.afraid,false);
});
test('authored soul tunnel has open headroom, walkable grades and a covered well on both detail levels',()=>{
 for(const resolution of [640,768]) {
  const profile=planetProfile('SINGULARITY',2281969),island=generateIsland({seed:2281969,resolution,profile}),p=planCaves(island,profile);assert.ok(p.soul);
  const pts=p.soul.tunnel.pts;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];assert.ok(Math.abs(a.y-b.y)/Math.hypot(a.x-b.x,a.z-b.z)<.3);assert.ok(p.field.cave(b.x,b.y+1.68,b.z)<0);}
  assert.ok(island.heightAt(0,0)>p.soul.y+15);assert.equal(p.entrances[0].name,'The Quiet Well · soul tunnel');
 }
 const profile=planetProfile('TERRAN',1337),i=generateIsland({seed:1337,resolution:128,profile});assert.equal(planCaves(i,profile)?.soul,undefined);
});
