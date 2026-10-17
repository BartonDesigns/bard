import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoul } from '../src/reputation/soul.js';
import { createMorality } from '../src/combat/morality.js';
import { Soul } from '../../server/multiplayer/src/soul.js';
const storage = () => { const m=new Map(); return {get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; };
const ready = () => Response.json({features:['persistent-reputation-v1']});
const flush = () => new Promise(setImmediate);
function ledger() { const m=new Map(); return new Soul({storage:{get:async k=>structuredClone(m.get(k)),put:async o=>{for(const[k,v]of Object.entries(o))m.set(k,structuredClone(v));}}}); }

test('an older Worker gets one public probe and no private requests despite new deeds, frames or restore attempts',async()=>{
 let time=1000;const calls=[],morality=createMorality(),st=storage();
 const soul=createSoul({morality,storage:st,url:'https://rooms',now:()=>time,request:async(url,init)=>{calls.push({url,init});return Response.json({features:['trade-v2']});}});
 morality.record({kind:'favour'});assert.equal(await soul.sync(),false);
 for(let i=0;i<100;i++){time+=100;morality.record({kind:'favour'});soul.update();await soul.sync();}
 await assert.rejects(soul.recover('b'.repeat(64)),/not available yet/);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://rooms/status');assert.equal(calls[0].init.headers,undefined);
 assert.equal(JSON.stringify(calls).includes(soul.recoveryKey()),false);
 assert.equal(soul.info().pending,101);assert.equal(soul.info().savedLocally,true);assert.equal(soul.info().cloudAvailable,false);
 soul.dispose();const restored=createSoul({morality:createMorality(),storage:st,url:''});assert.equal(restored.info().pending,101);restored.dispose();
});

test('the same open client resumes and uploads each queued deed once after the Worker is deployed',async()=>{
 let time=1000,deployed=false;const server=ledger(),calls=[],morality=createMorality();
 const soul=createSoul({morality,storage:storage(),url:'https://rooms',now:()=>time,request:async(url,init)=>{calls.push(url);return url.endsWith('/status')?(deployed?ready():Response.json({features:[]})):server.fetch(new Request('https://soul/me',init));}});
 morality.record({kind:'favour'});await soul.sync();deployed=true;time+=299999;await soul.sync();assert.equal(calls.length,1);
 time++;assert.equal(await soul.sync(),true);assert.equal(soul.info().pending,0);await soul.sync();
 assert.equal(morality.me().deeds,1);assert.equal(calls.filter(u=>u.endsWith('/status')).length,2);soul.dispose();
});

test('network/CORS failures back off independently of new events and concurrent saves',async()=>{
 let time=1000,privateCalls=0,probes=0;const morality=createMorality();
 const soul=createSoul({morality,storage:storage(),url:'https://rooms',now:()=>time,request:async url=>{if(url.endsWith('/status')){probes++;return ready();}privateCalls++;throw TypeError('Failed to fetch');}});
 await Promise.all(Array.from({length:20},()=>soul.sync()));assert.equal(privateCalls,1);assert.equal(probes,1);
 for(let i=0;i<20;i++){time+=1000;morality.record({kind:'favour'});soul.update();await soul.sync();}
 assert.equal(privateCalls,1);time=31000;await soul.sync();assert.equal(privateCalls,2);assert.equal(soul.info().retryAt,91000);
 time=61000;morality.record({kind:'favour'});await soul.sync();assert.equal(privateCalls,2);assert.equal(soul.info().pending,21);soul.dispose();
});

test('capability checks are shared by simultaneous sync and recovery, and disposal stops a pending probe',async()=>{
 let finish,probes=0,privateCalls=0;const soul=createSoul({morality:createMorality(),storage:storage(),url:'https://rooms',request:async url=>{if(url.endsWith('/status')){probes++;return new Promise(r=>finish=r);}privateCalls++;return ready();}});
 const sync=soul.sync(),recover=soul.recover('b'.repeat(64));await flush();soul.dispose();finish(ready());
 assert.equal(await sync,false);await assert.rejects(recover,/not available yet/);assert.equal(probes,1);assert.equal(privateCalls,0);
});

test('an outdated advertised endpoint backs off without removing the local outbox',async()=>{
 let time=1000,calls=0;const morality=createMorality();
 const soul=createSoul({morality,storage:storage(),url:'https://rooms',now:()=>time,request:async url=>{calls++;return url.endsWith('/status')?ready():new Response('not found',{status:404});}});
 morality.record({kind:'robbery'});assert.equal(await soul.sync(),false);time+=1000;morality.record({kind:'favour'});await soul.sync();
 assert.equal(calls,2);assert.equal(soul.info().pending,2);assert.equal(soul.info().cloudAvailable,false);soul.dispose();
});
