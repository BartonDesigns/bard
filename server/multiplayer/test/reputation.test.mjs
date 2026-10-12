import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/room.js';
import { acceptReputation } from '../src/reputation.js';
import { cleanPose } from '../../../island/src/net/protocol.js';
import { cleanReputation, createReputationMemory, reputationDistance, REPUTATION_FEATURE, REPUTATION_MAX, REPUTATION_ACTOR_MAX } from '../../../island/src/net/reputation.js';
import { awarenessContext, contextualOpening } from '../../../island/src/people/world-awareness.js';
const actor={id:'driver-aaaa',name:'Driver'}, other={id:'friend-bbbb',name:'Friend'};
const point={w:'earth',p:[0,0,0],g:[37.77,-122.42]};
const pose={...point,p:[0,1.68,0],a:'drive',v:'car',h:'aurora-trail-rifle'};
const incident={...point,id:'incident-001',kind:'vehicle-impact'};
const welcome=now=>({features:[REPUTATION_FEATURE],now});
const cache=(id,now)=>{const m=createReputationMemory({me:id,now:()=>now});m.reset(welcome(now));return m;};

test('only bounded public facts cross the wire; server binds identity and clock',()=>{
 const meta={}, result=acceptReputation(meta,{...incident,actor:other.id,at:9999999999999,history:['secret'],line:'injected',credits:100000},actor,pose,10000);
 assert.equal(result.record.actor,actor.id);assert.equal(result.record.at,10000);
 assert.deepEqual(Object.keys(result.record).sort(),['actor','at','g','id','kind','name','p','w']);
 assert.equal(cleanReputation({...incident,p:[NaN,0,0]}),null);
 assert.equal(cleanReputation({...incident,g:[91,0]}),null);
 assert.equal(cleanReputation({...incident,kind:'grant-credits'}),null);
 assert.equal(cleanReputation({...incident,kind:'quest-complete',npc:'<script>'}),null);
});
test('crime guards require the matching world, nearby position and actual driving pose',()=>{
 for(const p of [null,{...pose,w:'moon'},{...pose,a:'walk',v:''},{...pose,g:[35,140]},{...pose,p:[0,40,0]}])assert.equal(acceptReputation({},incident,actor,p,10000).ok,false);
 assert.equal(acceptReputation({},incident,actor,pose,10000).ok,true);
 const meta={};acceptReputation(meta,{...incident,id:'shots-first',kind:'shots'},actor,pose,10000);
 assert.equal(acceptReputation(meta,incident,actor,pose,10100).ok,true,'gunfire does not suppress a subsequent vehicle crime');
 assert.equal(acceptReputation({}, {...point,id:'quest-floor',kind:'quest-complete',npc:'npc-000042'},actor,{...pose,p:[0,5.48,0]},10000).ok,false);
});
test('geographic proximity survives different Earth render frames, excludes other continents',()=>{
 const rebased={...pose,p:[-400000,1.68,0]};
 assert.equal(reputationDistance(rebased,point),0);
 assert.equal(acceptReputation({},incident,actor,rebased,10000).ok,true);
 assert.ok(reputationDistance({...point,g:[35.68,139.69]},point)>1e6);
 assert.deepEqual(cleanPose(pose).g,point.g);
});
test('replays cannot refresh fear and floods cannot grow storage indefinitely',()=>{
 const meta={};acceptReputation(meta,incident,actor,pose,10000);
 assert.equal(acceptReputation(meta,incident,actor,pose,11000).duplicate,true);
 assert.equal(meta.reputation[0].at,10000);
 assert.equal(acceptReputation(meta,{...incident,id:'incident-002'},actor,pose,11000).ok,false);
 for(let i=1;i<140;i++)acceptReputation(meta,{...incident,id:'incident-'+i},actor,pose,10000+i*1600);
 assert.equal(meta.reputation.length,REPUTATION_ACTOR_MAX);
 for(let i=0;i<140;i++)acceptReputation(meta,{...incident,id:'incident-'+i},{id:'actor-000'+i%8,name:'Actor'},pose,300000+i*1600);
 assert.equal(meta.reputation.length,REPUTATION_MAX);
});
test('innocent players hear danger, only the responsible player gets blamed, fear overrides praise',()=>{
 const e=acceptReputation({},incident,actor,pose,10000).record;
 const guilty=cache(actor.id,11000), innocent=cache(other.id,11000);guilty.receive(e);innocent.receive(e);
 const gc=awarenessContext({...guilty.context(point),completed:['A job']});
 const ic=awarenessContext(innocent.context(point));
 assert.ok(gc.reported);assert.equal(ic.reported,undefined);assert.ok(ic.afraid);
 assert.match(contextualOpening(gc),/reports|saying|heard/i);assert.doesNotMatch(contextualOpening(gc),/saw you|thanks/i);
 assert.doesNotMatch(contextualOpening(ic),/about you|you hurt|saw you/i);
});
test('memories are isolated by world, floor and area, and expire on the server clock',()=>{
 const record={...incident,actor:actor.id,name:actor.name,at:10000};
 let now=11000;const m=createReputationMemory({me:actor.id,now:()=>now+3600000});m.reset(welcome(now));m.receive(record);
 assert.equal(m.context(point).reports.length,1);
 for(const at of [{...point,w:'moon'},{...point,p:[0,30,0]},{...point,g:[35,140]}])assert.equal(m.context(at).reports.length,0);
 now=610001;assert.equal(m.context(point).reports.length,0);
});
test('old servers and leaving a room preserve local behavior without retaining shared records',()=>{
 const m=cache(actor.id,11000), e={...incident,actor:actor.id,at:10000};m.receive(e);assert.equal(m.info().records,1);
 m.reset({now:11000});assert.equal(m.supported(),false);assert.equal(m.receive(e),null);assert.equal(m.info().records,0);
 m.reset(welcome(11000));m.receive(e);m.reset();assert.equal(m.context(point).reports.length,0);
});
test('small packet latency differences do not silently discard a newly stamped event',()=>{
 const m=cache(actor.id,10000);
 assert.ok(m.receive({...incident,actor:actor.id,at:10004}));
 assert.equal(m.context(point).reports.length,1);
 assert.equal(m.receive({...incident,id:'future-fake',actor:actor.id,at:90000}),null);
});
test('completed work is attributed per player without sending the quest text or issuing rewards',()=>{
 const e=acceptReputation({}, {...point,id:'quest:story-abc-1',kind:'quest-complete',npc:'npc-000042',title:'private',reward:999999}, actor,pose,10000).record;
 assert.ok(e);assert.equal(e.reward,undefined);assert.equal(e.title,undefined);
 const m=cache(actor.id,12000);m.receive(e);
 const known=awarenessContext(m.context(point,'npc-000042')), stranger=awarenessContext(m.context(point,'npc-000099'));
 assert.equal(known.sharedIssuer,true);assert.equal(stranger.sharedIssuer,false);
 assert.match(contextualOpening(known),/Thanks|together/);assert.match(contextualOpening(stranger),/heard|Word/);
 const innocent=cache(other.id,12000);innocent.receive(e);assert.equal(innocent.context(point).sharedCompleted,0);
});

function state() {
 const data=new Map(), sockets=[];
 return {storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),deleteAll:async()=>data.clear(),setAlarm:async()=>{}},acceptWebSocket:ws=>sockets.push(ws),getWebSockets:()=>sockets.filter(w=>!w.closed)};
}
function socket(){let attachment;return {sent:[],closed:false,send(s){this.sent.push(JSON.parse(s));},close(){this.closed=true;},serializeAttachment(a){attachment=structuredClone(a);},deserializeAttachment(){return structuredClone(attachment);}};}
const say=(room,ws,m)=>room.webSocketMessage(ws,JSON.stringify(m));
test('durable reconstruction and a late join recover facts without replaying a live assault',async()=>{
 const st=state(), R=new Room(st,{});await R.fetch(new Request('https://room/init',{method:'POST',body:JSON.stringify({code:'ABCDEF',owner:actor.id})}));
 const a=socket();await R.connect(a,{...actor,seed:42});await say(R,a,{t:'pose',...pose});await say(R,a,{t:'reputation',e:incident});
 assert.equal(a.sent.find(e=>e.t==='reputation').e.actor,actor.id);
 const woke=new Room(st,{}), b=socket();await woke.connect(b,{...other,seed:44});
 assert.ok(b.sent.find(e=>e.t==='welcome').features.includes(REPUTATION_FEATURE));
 const snapshot=b.sent.filter(e=>e.t==='reputation-snapshot');assert.equal(snapshot.flatMap(e=>e.records).length,1);
 assert.equal(b.sent.filter(e=>e.t==='reputation').length,0);
 assert.ok(snapshot.every(e=>JSON.stringify(e).length<3072));
 // The hibernated object's pose map is empty until the next fresh player pose.
 await say(woke,a,{t:'reputation',e:{...incident,id:'incident-new'}});assert.equal((await st.storage.get('meta')).reputation.length,1);
 await woke.leave(a);assert.equal((await st.storage.get('meta')).host,other.id);
 assert.equal((await st.storage.get('meta')).reputation.length,1);
});
