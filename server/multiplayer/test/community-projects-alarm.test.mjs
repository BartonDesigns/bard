import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { startLocalRooms } from './local-worker.mjs';
const local=await startLocalRooms({entryPoint:new URL('./fixtures/project-clock-worker.mjs',import.meta.url)});
const keys=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')];const region='clock-region',world='earth';let now=0,checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
async function call(body,key=keys[0]) {const r=await fetch(`${local.url}/living/${world}/${region}`,{method:body?'POST':'GET',headers:{origin:'http://localhost:8768',authorization:`Bearer ${key}`},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
async function clock(at,alarm=false) {now=at;const r=await fetch(`${local.url}/__test_clock?world=${world}&region=${region}&now=${now}${alarm?'&alarm=1':''}`);assert.equal(r.status,200);}
try {
 const observed=await call({id:'observe-fixture',op:'register',actors:[],requests:[],sites:[{id:'grove',name:'Coastal grove',source:'place',anchor:{x:1,y:2,z:3}}]});now=observed.now;
 const p=(await call({id:'propose-fixture',op:'project-propose',project:{siteId:'grove',kind:'garden'}})).projects.projects[0];
 for(let i=0;i<4;i++) {const key=keys[i%2],kind=i?'work':'survey';const start=await call({id:`start-clock-${i}`,op:'project-start',projectId:p.id,kind},key);await clock(start.receipt.challenge.readyAt);await call({id:`finish-clock-${i}`,op:'project-complete',projectId:p.id,challengeId:start.receipt.challenge.id},key);}
 const ready=(await call(null)).projects.projects[0].readyAt;check(ready===now+86400000,'shared deadline starts after last real timed contribution');
 await clock(ready-1,true);check((await call(null,keys[1])).projects.projects[0].status==='building','alarm one millisecond before deadline cannot publish');
 await call({id:'clock-hazard',op:'register',actors:[],requests:[],situation:{destroyedSites:['grove']}});
 await clock(ready+3600000,true);check((await call(null,keys[1])).projects.projects[0].status==='building','day-old destroyed site remains blocked while everyone is away');
 const safe=await call({id:'clock-safe',op:'register',actors:[],requests:[],situation:{hazard:0}});check(safe.projects.projects[0].status==='completed','fresh safe observation publishes overdue work');
 const last=(await call(null,keys[1]));check(last.projects.projects[0].completedAt===now&&last.history.events.filter(e=>e.type==='project-completed').length===1,'second traveller sees one durable completion with server time');
 const garden=last.projects.projects[0];check(garden.contributionCount===4&&garden.contributors.length===2,'away progression never invents extra player contributions');
 await clock(now+86400000,true);check((await call(null)).projects.projects[0].completedAt===garden.completedAt,'later alarm never republished the project');
 console.log(`community project injected-clock SQLite alarms: ${checks} passed, 0 failed`);
} finally {await local.dispose();}
