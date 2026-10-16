// Real workerd/SQLite, controlled clock only in the test entry. No production calls.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { startLocalRooms } from './local-worker.mjs';
const local=await startLocalRooms({entryPoint:new URL('./fixtures/project-clock-worker.mjs',import.meta.url)});
const keys=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')],world='earth',region='household-fixture';let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
async function call(data,key=keys[0]){const r=await fetch(`${local.url}/living/${world}/${region}`,{method:data?'POST':'GET',headers:{origin:'http://localhost:8768',authorization:'Bearer '+key},...(data?{body:JSON.stringify(data)}:{})});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;}
async function clock(now){const r=await fetch(`${local.url}/__test_clock?world=${world}&region=${region}&now=${now}&alarm=1`);assert.equal(r.status,200);}
try{
 check((await(await fetch(local.url+'/status')).json()).features.includes('household-life-v1'),'feature advertised with binding');
 const first=await call({id:'family-register',op:'register',actors:[{id:'npc:1',name:'Rosa',household:{id:'home-1',memberId:'mother',kind:'two-parent',role:'parent',members:4,dependants:2,earners:2},sites:{home:'home-1'},disposition:{helpful:1,reliable:1}},{id:'npc:2',name:'Lee',sites:{home:'home-2'},disposition:{helpful:1,reliable:1}}],requests:[]});
 const day=Math.floor(first.now/86400000)*86400000, tomorrow=day+86400000;
 await clock(tomorrow+10*3600000);
 let other=await call(null,keys[1]), task=other.view.requests.find(q=>q.source==='household-life'&&q.createdAt>=tomorrow);
 check(!!task,'alarm generated a new family request without a player request');
 check(other.view.actors.find(a=>a.id==='npc:1').household.dependants===2,'independent visitor sees persisted family');
 // Use the next day at the first active tick to join before completion.
 await clock(tomorrow+86400000+8*3600000);
 other=await call(null,keys[1]);task=other.view.requests.find(q=>q.source==='household-life'&&!['completed','failed'].includes(q.status));check(!!task,'next day brings a fresh opportunity');
 await call({id:'family-join',op:'join',requestId:task.id},keys[1]);
 await clock(tomorrow+86400000+14*3600000);
 const joined=(await call(null)).view.requests.find(q=>q.id===task.id);check(joined.status!=='completed'&&joined.participants.length===1,'absence does not consume joined player opportunity');
 const changed=await call({id:'family-reobserve',op:'register',actors:[{id:'npc:1',name:'Rosa',household:{id:'wrong-home',memberId:'other',members:1,dependants:0},sites:{home:'home-1'}}],requests:[]});
 check(changed.view.actors.find(a=>a.id==='npc:1').household.id==='home-1','later client cannot replace the saved family');
 check(!JSON.stringify(changed).includes(keys[0]),'private soul credential excluded');
 check((await call(null)).history.events.some(e=>e.type==='social-completed'&&e.simulated),'public history records autonomous completion honestly');
 console.log(`household SQLite/absent-player integration: ${checks} passed, 0 failed`);
}finally{await local.dispose();}
