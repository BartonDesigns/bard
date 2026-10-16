import test from 'node:test';
import assert from 'node:assert/strict';
import { Soul, soulId } from '../src/soul.js';
import { handle } from '../src/index.js';
import { SOUL_SITE } from '../../../island/src/reputation/sanctuary.js';
const mem = () => { const map = new Map(); return { map, async get(k) { return structuredClone(map.get(k)); }, async put(k,v) { if (typeof k === 'object') for(const [key,val] of Object.entries(k)) map.set(key,structuredClone(val)); else map.set(k,structuredClone(v)); }, async delete(k) { map.delete(k); } }; };
const pose = { w: SOUL_SITE.world, type: SOUL_SITE.type, p: [0,7.68,0] };
const send = (s,b) => s.fetch(new Request('https://soul/me',{method:'POST',body:JSON.stringify(b)}));
const sync = (s,deeds=[],epoch=0) => send(s,{op:'sync',epoch,deeds});
const d = (id,kind='robbery') => ({id:'event-'+id,kind,world:'earth',place:'a town',target:'a resident',ctx:{witnessed:true}});
test('standing and every receipt outlive reconstruction, time, log trimming and room expiry', async()=>{
 const storage=mem();let s=new Soul({storage});
 for(let i=0;i<240;i+=20) assert.equal((await sync(s,Array.from({length:20},(_,j)=>d(i+j)))).status,200);
 s=new Soul({storage}); const b=await (await s.fetch(new Request('https://soul/me'))).json();
 assert.equal(b.ledger.me.deeds,240);assert.equal(b.ledger.me.law,-100);assert.equal(b.ledger.log.length,200);assert.equal([...storage.map.keys()].filter(k=>k.startsWith('deed:')).length,240);
 const replay=await (await sync(s,[d(0)])).json();assert.equal(replay.ledger.me.deeds,240);
 assert.equal(typeof s.alarm,'undefined','no expiry alarm');
});
test('migration happens once; untrusted deltas, player ids and dialogue are ignored',async()=>{
 const storage=mem(),s=new Soul({storage});
 let r=await send(s,{op:'sync',epoch:0,legacy:{me:{mercy:-30,law:-20,protect:-15,honest:-10,deeds:8}},deeds:[{...d(1,'favour'),delta:{law:100000},dialogue:'private text',actor:'someone-else'}]});
 const b=await r.json();assert.equal(b.ledger.me.deeds,9);assert.equal(b.ledger.me.law,-18.6);assert.ok(!JSON.stringify([...storage.map]).includes('private text'));
 r=await send(s,{op:'sync',epoch:0,legacy:{me:{law:100,deeds:900}},deeds:[]});assert.equal((await r.json()).ledger.me.deeds,9);
});
test('ritual rejects surface, other worlds, early finish, expired challenge and invented reset',async()=>{
 const storage=mem(),s=new Soul({storage});await sync(s,[d(1)]);
 for(const p of [{...pose,w:'earth'},{...pose,type:'TERRAN'},{...pose,p:[0,150,0]},{...pose,p:[10,7.68,0]},{...pose,flying:true}])assert.equal((await send(s,{op:'begin',epoch:0,pose:p})).status,403);
 assert.equal((await send(s,{op:'reset',epoch:0})).status,400);
 const c=await(await send(s,{op:'begin',epoch:0,pose})).json();
 assert.equal((await send(s,{op:'cleanse',epoch:0,nonce:c.nonce,pose})).status,403);
 storage.map.get('ritual').at-=50000;
 assert.equal((await send(s,{op:'cleanse',epoch:0,nonce:c.nonce,pose})).status,403);
});
test('cleansing is atomic, keeps audit, and stale offline deeds cannot resurrect old standing',async()=>{
 const storage=mem(),s=new Soul({storage});await sync(s,[d(1),d(2,'favour')]);
 const c=await(await send(s,{op:'begin',epoch:0,pose})).json();storage.map.get('ritual').at-=9000;
 const b=await(await send(s,{op:'cleanse',epoch:0,nonce:c.nonce,pose})).json();
 assert.equal(b.ledger.epoch,1);assert.equal(b.ledger.me.deeds,0);assert.equal(b.ledger.lifetime,2);assert.equal(storage.map.has('deed:event-1'),true);assert.equal(b.ledger.log.length,2);
 assert.equal((await sync(s,[d(3)],0)).status,409);assert.equal((await send(s,{op:'cleanse',epoch:0,nonce:c.nonce,pose})).status,409);
 const later=await(await sync(s,[d(4,'favour')],1)).json();assert.equal(later.ledger.me.deeds,1);assert.equal(later.ledger.lifetime,3);
});
test('concurrent duplicate batches count each deed once',async()=>{
 const storage=mem(),s=new Soul({storage});await sync(s);
 await Promise.all([sync(s,[d(1)]),sync(s,[d(1)]),sync(s,[d(2)])]);
 assert.equal((await(await s.fetch(new Request('https://soul/me'))).json()).ledger.me.deeds,2);
});
test('authenticated namespace is independent of room id, with production CORS and no public secret',async()=>{
 const all=new Map(),env={ALLOW_LOCALHOST:'false',SOULS:{idFromName:id=>id,get(id){if(!all.has(id))all.set(id,new Soul({storage:mem()}));return all.get(id);}}};
 const call=(key,method='POST')=>handle(new Request('https://rooms/souls/me',{method,headers:{origin:'https://level99bard.com',authorization:'Bearer '+key},...(method==='POST'?{body:JSON.stringify({op:'sync',epoch:0,deeds:[d(1)]})}:{})}),env);
 assert.equal((await call('bad')).status,401);
 const a='a'.repeat(64),b='b'.repeat(64);const r=await call(a);assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'https://level99bard.com');assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal((await call(b,'GET')).status,404);assert.equal((await (await call(a,'GET')).json()).ledger.me.deeds,1);
 assert.equal(all.has(a),false);assert.equal(all.has(await soulId(a)),true);
 const pub=await(await all.get(await soulId(a)).fetch(new Request('https://soul/public'))).json();assert.equal(pub.deeds,1);assert.equal(pub.log,undefined);assert.equal(pub.token,undefined);
 const pre=await handle(new Request('https://rooms/souls/me',{method:'OPTIONS',headers:{origin:'https://level99bard.com'}}),env);assert.match(pre.headers.get('access-control-allow-headers'),/authorization/);
});

test('large place/world ledgers are split without dropping totals or exceeding a value limit',async()=>{
 const storage=mem(),s=new Soul({storage});
 for(let n=0;n<240;n+=20) { const r=await sync(s,Array.from({length:20},(_,i)=>({...d(n+i,'favour'),world:'world-'+(n+i)+'x'.repeat(80),place:'place-'+(n+i)+'p'.repeat(80),target:'t'.repeat(96)})));assert.equal(r.status,200); }
 assert.ok(storage.map.get('ledger').parts>1);
 for(const[k,v]of storage.map)if(k.startsWith('ledger:'))assert.ok(Buffer.byteLength(v)<128*1024);
 const b=await(await new Soul({storage}).fetch(new Request('https://soul/me'))).json();assert.equal(Object.keys(b.ledger.worlds).length,240);assert.equal(Object.keys(b.ledger.places).length,240);assert.equal(b.ledger.me.deeds,240);
});

test('the per-soul budget rejects new floods atomically and still permits receipt replay',async()=>{
 const storage=mem(),s=new Soul({storage});await sync(s,[d(1)]);
 await storage.put('budget',{minute:Math.floor(Date.now()/60000),deeds:600});
 assert.equal((await sync(s,[d(2)])).status,429);assert.equal(storage.map.has('deed:event-2'),false);
 assert.equal((await sync(s,[d(1)])).status,200);
 assert.equal((await(await s.fetch(new Request('https://soul/me'))).json()).ledger.me.deeds,1);
});

test('reputation preflights allow authorization and JSON only from configured game origins',async()=>{
 for(const origin of ['https://level99bard.com','https://www.level99bard.com'])for(const method of ['GET','POST']){
  const r=await handle(new Request('https://rooms/souls/me',{method:'OPTIONS',headers:{origin,'access-control-request-method':method,'access-control-request-headers':'authorization, content-type'}}),{ALLOW_LOCALHOST:'false'});
  assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
  const headers=r.headers.get('access-control-allow-headers').split(',').map(s=>s.trim());assert.ok(headers.includes('authorization'));assert.ok(headers.includes('content-type'));
  assert.ok(r.headers.get('access-control-allow-methods').includes(method));
 }
 const denied=await handle(new Request('https://rooms/souls/me',{method:'OPTIONS',headers:{origin:'https://untrusted.example'}}),{});
 assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
});

test('an absent soul binding is not advertised and returns a CORS-readable service error',async()=>{
 const st=await handle(new Request('https://rooms/status',{headers:{origin:'https://level99bard.com'}}),{});
 assert.equal((await st.json()).features.includes('persistent-reputation-v1'),false);
 const r=await handle(new Request('https://rooms/souls/me',{headers:{origin:'https://level99bard.com',authorization:'Bearer '+'a'.repeat(64)}}),{});
 assert.equal(r.status,503);assert.equal(r.headers.get('access-control-allow-origin'),'https://level99bard.com');
});
