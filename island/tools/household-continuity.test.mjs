import test from 'node:test';
import assert from 'node:assert/strict';
import { createHouseholdMemory } from '../src/people/household-memory.js';
import { createBank } from '../src/economy/bank.js';
import { makeHousehold } from '../src/people/households.js';
import { baseline, profileOf, dayOf } from '../src/economy/ledger-core.js';
import { createLivingWorldState, reduceLivingWorld } from '../src/people/living-world-core.js';
import { createLivingWorld } from '../src/people/living-world.js';
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k,v) => m.set(k,v), m }; };
const base = Date.UTC(2026,9,16,10), day = 86400000;
const family = { id:'h-1', memberId:'m-1', kind:'two-parent', role:'parent', members:4, dependants:2, earners:2 };
function citizens() {
 let s=createLivingWorldState({world:'earth',region:'bay',now:base});
 for (const a of [{id:'npc:1',name:'Rosa',household:family,sites:{home:'home:h-1'}},{id:'npc:2',name:'Lee',sites:{home:'home:h-2'}}]) s=reduceLivingWorld(s,{type:'register-actor',actor:{...a,disposition:{helpful:1,reliable:1}},now:base}).state;
 return s;
}
test('family identity survives a new session, reordered residents and world travel; corrupt data is retained',()=>{
 const store=memory(), h=makeHousehold(42,null,{kind:'two-parent'}), member=h.members[0];member.embodied=true;
 const first=createHouseholdMemory(store);assert.equal(first.remember('earth:frame','npc:42',h,member),true);
 const second=createHouseholdMemory(store), restored=second.recall('earth:frame','npc:42');assert.equal(restored.memberId,member.id);assert.equal(restored.household.id,h.id);assert.equal(restored.household.members[0].embodied,undefined);
 assert.equal(second.recall('moon:frame','npc:42'),null);
 second.remember('earth:frame','npc:42',makeHousehold(99),{id:'replacement'});assert.equal(second.recall('earth:frame','npc:42').memberId,member.id);
 const broken=memory();broken.setItem('l99-household-identities-v1','{bad');assert.equal(createHouseholdMemory(broken).remember('earth','npc:42',h,member),false);assert.equal(broken.getItem('l99-household-identities-v1'),'{bad');
});
test('household accounts retain relatives, baseline and once-only earnings across restart and absent days',()=>{
 const storage=memory(), h=makeHousehold(42,null,{kind:'two-parent'}), a=createBank({storage,clock:()=>base});
 const id=a.link('npc:42',h,h.members[0]);a.link('npc:43',h,h.members[1]);
 assert.equal(a.earnOnce('family-work:1','npc:42',80,'request','biz:grocer').ok,true);a.flush();
 const b=createBank({storage,clock:()=>base+7*day});assert.equal(b.household('npc:42'),id);assert.equal(b.household('npc:43'),id);
 assert.equal(b.account('npc:42').balance,baseline(profileOf(h),dayOf(base+7*day))+80);
 assert.equal(b.earnOnce('family-work:1','npc:42',80,'request','biz:grocer').duplicate,true);assert.equal(b.history(id).length,1);
 assert.equal(b.household({P:{dna:{seed:42},home:{household:makeHousehold(99)}}}),id,'a later observer cannot move the account');b.flush();
});
test('known households initiate daily activities without a player; completion gives no assets or player awards',()=>{
 const s=citizens(), result=reduceLivingWorld(s,{type:'advance',now:base+4*3600000});
 const tasks=Object.values(result.state.requests);assert.equal(tasks.length,1);assert.equal(tasks[0].source,'household-life');assert.equal(tasks[0].status,'completed');
 assert.ok(result.events.some(e=>e.type==='social-completed'&&e.simulated));assert.equal(tasks[0].reward,undefined);
 const again=reduceLivingWorld(result.state,{type:'advance',now:base+5*3600000});assert.equal(Object.keys(again.state.requests).length,1);
 const next=reduceLivingWorld(again.state,{type:'advance',now:base+day+4*3600000});assert.equal(Object.keys(next.state.requests).length,2);
});
test('player participation survives absence, and emergencies stop new family visits',()=>{
 let s=reduceLivingWorld(citizens(),{type:'advance',now:base+300000}).state;
 const id=Object.keys(s.requests)[0];s=reduceLivingWorld(s,{type:'join',requestId:id,playerId:'player:1',now:base+300000}).state;
 s=reduceLivingWorld(s,{type:'advance',now:base+4*3600000}).state;assert.notEqual(s.requests[id].status,'completed');assert.deepEqual(s.requests[id].participants,['player:1']);
 const danger=reduceLivingWorld(citizens(),{type:'advance',now:base+3600000,situation:{hazard:1}});assert.equal(Object.keys(danger.state.requests).length,0);
 const old=s.actors['npc:1'].household;
 const change=reduceLivingWorld(s,{type:'register-actor',now:base+4*3600000,actor:{id:'npc:1',household:{...family,id:'new-family'}}});assert.deepEqual(change.state.actors['npc:1'].household,old);
});
test('a generated family request is joinable and completed by talking to the correct nearby resident',async()=>{
 let now=base;const storage=memory(), h=makeHousehold(42,null,{kind:'two-parent'});
 const rosa={P:{dna:{seed:1},home:{household:h,member:h.members[0]}},M:{S:{pos:{x:0,z:0}}},name:'Rosa',active:true};
 const lee={P:{dna:{seed:2}},M:{S:{pos:{x:2,z:0}}},name:'Lee',active:true};
 const life=createLivingWorld({world:()=>({}),worldKey:()=> 'earth',region:()=>({id:'bay'}),actors:()=>[rosa,lee],position:()=>({x:0,z:0}),clock:()=>now,storage,url:'',request:null});
 life.update(0);now+=300000;life.update(0);
 const task=life.snapshot().activities.find(q=>q.source==='household-life');assert.ok(task);
 assert.equal((await life.action(task.id,'join')).ok,true);assert.equal(life.conversationObserved(lee),0);assert.equal(life.conversationObserved(rosa),1);
 assert.equal(life.snapshot().activities.find(q=>q.id===task.id).state,'completed');assert.equal(life.completionEvidence(task.id),null);life.dispose();
});
test('a discovered household reaches the existing ledger even without a new cash transaction',async()=>{
 const storage=memory(), sent=[], h=makeHousehold(42,null,{kind:'two-parent'});
 const bank=createBank({storage,clock:()=>base,server:'https://ledger.example',fetch:async(url,init)=>{sent.push(JSON.parse(init.body));return {ok:true};}});
 bank.link('npc:42',h,h.members[0]);assert.equal(bank.info().pending,0);assert.equal(bank.info().pendingProfiles,1);
 assert.equal((await bank.sync()).ok,true);assert.deepEqual(sent[0].events,[]);assert.equal(Object.keys(sent[0].profiles).length,1);assert.equal(bank.info().pendingProfiles,0);bank.flush();
 const restored=createBank({storage,clock:()=>base});assert.equal(restored.info().pendingProfiles,0);assert.equal(restored.household('npc:42'),bank.household('npc:42'));
});
