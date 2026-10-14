import test from 'node:test';
import assert from 'node:assert/strict';
import { LivingRegion, COMMUNITY_FEATURE, PROJECT_CHALLENGE_MS, PROJECT_SURVEY_MS } from '../src/living-region.js';
import { PROJECT_DELAY_MS, PROJECT_WORK_MS } from '../../../island/src/people/community-projects-core.js';
import { handle } from '../src/index.js';
const A = 'a'.repeat(64), B = 'b'.repeat(64), origin = 'https://level99bard.com';
const memory = () => { const map = new Map(); return { map, alarm: null, async get(k) { return structuredClone(map.get(k)); }, async put(k, v) { for (const [key, value] of typeof k === 'object' ? Object.entries(k) : [[k,v]]) map.set(key, structuredClone(value)); }, async setAlarm(at) { this.alarm = at; }, async deleteAlarm() { this.alarm = null; }, async transaction(fn) { const old=structuredClone(map); try { await fn(this); } catch(e) { map.clear(); for(const [k,v] of old) map.set(k,v); throw e; } } }; };
function fixture() {
 const stores=new Map(), instances=new Map();
 const env={ALLOW_LOCALHOST:'false', LIVING:{idFromName:id=>id,get(id) { if(!stores.has(id)) stores.set(id,memory()); if(!instances.has(id)) instances.set(id,new LivingRegion({storage:stores.get(id)})); return instances.get(id); }}};
 const call=(data,{token=A,world='earth',region='coast',headers={}}={})=>handle(new Request(`https://rooms/living/${encodeURIComponent(world)}/${encodeURIComponent(region)}`, {method:data?'POST':'GET',headers:{origin,authorization:`Bearer ${token}`,...headers},...(data?{body:JSON.stringify(data)}:{})}),env);
 return {call,env,instances,store:()=>stores.get(JSON.stringify(['earth','coast'])),object:()=>env.LIVING.get(JSON.stringify(['earth','coast']))};
}
const read=async r=>{assert.equal(r.status,200,await r.clone().text());return r.json();};
const site={id:'coastal-path',name:'Coastal path',source:'place',anchor:{x:10,y:2,z:20}};
const observe=(id='observe-sites',sites=[site])=>({id,op:'register',actors:[{id:'npc:rosa',name:'Rosa',disposition:{helpful:1,reliable:1}},{id:'npc:lee',name:'Lee',skills:['repair'],disposition:{helpful:1,reliable:1}}],requests:[],sites});
const propose=(id='propose-path',siteId=site.id,kind='path')=>({id,op:'project-propose',project:{siteId,kind}});
async function project(f) {await read(await f.call(observe()));return (await read(await f.call(propose()))).projects.projects[0];}
const clock=async fn=>{const actual=Date.now;let now=Date.UTC(2026,9,14,10);Date.now=()=>now;try {await fn({get:()=>now,add:ms=>now+=ms});}finally{Date.now=actual;}};
async function action(f,p,kind,id,c,opts={}) {const start=await read(await f.call({id:`start-${id}`,op:'project-start',projectId:p.id,kind},opts));c.add(kind==='survey'?PROJECT_SURVEY_MS:PROJECT_WORK_MS);return read(await f.call({id:`finish-${id}`,op:'project-complete',projectId:p.id,challengeId:start.receipt.challenge.id},opts));}
function source(id,kind='repair') {return {id,title:`Help the coast ${id}`,kind,giverId:'npc:rosa',siteId:site.id,source:`physical:${id}`,durationMs:300000};}

test('project capabilities require actual binding; scope and canonical source observations are enforced atomically',async()=>{
 const f=fixture();const status=await read(await handle(new Request('https://rooms/status'),f.env));assert.ok(status.features.includes(COMMUNITY_FEATURE));
 assert.ok(!(await read(await handle(new Request('https://rooms/status'),{}))).features.includes(COMMUNITY_FEATURE));
 assert.equal((await f.call(propose())).status,400);
 const observed=await read(await f.call(observe()));assert.equal(observed.sites.length,1);assert.ok(observed.features.includes(COMMUNITY_FEATURE));
 assert.equal((await f.call({id:'site-invalid',op:'register',actors:[],requests:[],sites:[{...site,id:'new-site'}, {...site,anchor:{x:999,y:2,z:20}}]})).status,409);
 assert.equal((await read(await f.call(null))).sites.length,1,'bad final site leaves no earlier sites');
 const p=(await read(await f.call({...propose(),project:{...propose().project,inventory:['sword'],completedAt:1,actorId:'fake'}}))).projects.projects[0];
 assert.equal(p.createdBy,(await read(await f.call(null))).you);assert.equal(p.status,'surveying');assert.equal(p.inventory,undefined);
 assert.equal((await f.call(propose('home-request',site.id,'home'))).status,409);
 assert.equal((await f.call({...propose('moved-site'),project:{siteId:site.id,kind:'path',anchor:{x:999,y:2,z:20}}})).status,409);
 assert.equal((await f.call({id:'bad-scope-work',op:'project-start',projectId:p.id,kind:'survey'},{world:'moon'})).status,404);
 assert.equal((await read(await f.call(null,{world:'moon'}))).projects.projects.length,0);
 assert.equal(JSON.stringify(await read(await f.call(null))).includes(A),false);
});

test('geographic sites retain their canonical anchor when another frame rebases x/z',async()=>{
 const f=fixture(), geo={...site,anchor:{...site.anchor,lat:37.8,lon:-122.4}};
 await read(await f.call(observe('observe-geo',[geo])));
 await read(await f.call(observe('observe-rebase',[{...geo,anchor:{...geo.anchor,x:900,z:-700}}])));
 const result=await read(await f.call({...propose(),project:{siteId:site.id,kind:'path',anchor:{...geo.anchor,x:900,z:-700}}}));
 assert.deepEqual(result.projects.projects[0].anchor,geo.anchor);
 assert.equal((await f.call(observe('observe-move',[{...geo,anchor:{...geo.anchor,lon:0}}]))).status,409);
});

test('server-timed actor-bound challenges resist clock overrides, concurrent retries and expiry',async()=>clock(async c=>{
 const f=fixture(),p=await project(f),begin={id:'survey-start',op:'project-start',projectId:p.id,kind:'survey',now:9999999999999,readyAt:0};
 const first=await read(await f.call(begin));const challenge=first.receipt.challenge;assert.equal(challenge.readyAt,c.get()+PROJECT_SURVEY_MS);
 const finish={id:'survey-finish',op:'project-complete',projectId:p.id,challengeId:challenge.id,now:9999999999999};
 assert.equal((await f.call(finish)).status,409);
 assert.equal((await f.call(finish,{token:B})).status,409);
 c.add(PROJECT_SURVEY_MS);const [one,two]=await Promise.all([f.call(finish).then(read),f.call(finish).then(read)]);assert.equal([one,two].filter(x=>x.receipt.duplicate).length,1);
 assert.equal(one.projects.projects[0].surveyCount,1);
 f.instances.clear();const repeated=await read(await f.call({...finish,id:'same-challenge-new-op'}));assert.equal(repeated.projects.projects[0].contributionCount,1);assert.equal(repeated.receipt.contributionDuplicate,true);
 const work=await read(await f.call({id:'start-work-expiry',op:'project-start',projectId:p.id,kind:'work'}));c.add(PROJECT_CHALLENGE_MS);
 assert.equal((await f.call({id:'finish-expired',op:'project-complete',projectId:p.id,challengeId:work.receipt.challenge.id})).status,409);
 assert.equal((await read(await f.call(null))).projects.projects[0].workCount,0);
}));

test('two travellers contribute once each and publication happens by alarm after a full day away',async()=>clock(async c=>{
 const f=fixture(),p=await project(f);await action(f,p,'survey','survey',c);
 await action(f,p,'work','work-a',c);await action(f,p,'work','work-b',c,{token:B});const built=await action(f,p,'work','work-c',c);
 let next=built.projects.projects[0];assert.equal(next.status,'building');assert.equal(next.readyAt,c.get()+PROJECT_DELAY_MS);assert.equal(next.contributors.length,2);assert.ok(f.store().alarm);
 const deadline=next.readyAt;c.add(PROJECT_DELAY_MS-1);await f.object().alarm();assert.equal((await read(await f.call(null))).projects.projects[0].status,'building');
 c.add(1);f.instances.clear();await f.object().alarm();const done=await read(await f.call(null,{token:B}));next=done.projects.projects[0];assert.equal(next.status,'completed');assert.equal(next.completedAt,deadline);assert.equal(f.store().alarm,null);
 assert.ok(done.history.events.some(e=>e.type==='project-completed'));assert.equal(next.contributionCount,4);
 assert.equal((await f.call({id:'after-finish',op:'project-start',projectId:p.id,kind:'work'})).status,409);
}));

test('emergencies interrupt timed work and block due publication until a fresh safe site observation',async()=>clock(async c=>{
 const f=fixture(),p=await project(f);await action(f,p,'survey','survey-danger',c);
 const start=await read(await f.call({id:'danger-start',op:'project-start',projectId:p.id,kind:'work'}));
 await read(await f.call({id:'observe-danger',op:'register',actors:[],requests:[],situation:{hazard:1,destroyedSites:[site.id]}}));
 c.add(PROJECT_WORK_MS);await read(await f.call({id:'safe-again',op:'register',actors:[],requests:[],situation:{hazard:0}}));
 assert.equal((await f.call({id:'danger-finish',op:'project-complete',projectId:p.id,challengeId:start.receipt.challenge.id})).status,409);
 for(let i=0;i<3;i++) await action(f,p,'work',`restart-${i}`,c);
 await read(await f.call({id:'destroyed-before-due',op:'register',actors:[],requests:[],situation:{hazard:0,destroyedSites:[site.id]}}));
 c.add(PROJECT_DELAY_MS+1000);await f.object().alarm();const paused=await read(await f.call(null));assert.equal(paused.projects.projects[0].status,'building');assert.equal(paused.projects.projects[0].blockedReason,'site-inaccessible');
 await read(await f.call({id:'repaired-source',op:'register',actors:[],requests:[],situation:{hazard:0,destroyedSites:[]}}));assert.equal((await read(await f.call(null))).projects.projects[0].status,'completed');
}));

test('guarded source reports automatically contribute actual NPC work once with honest provenance',async()=>{
 const f=fixture(),p=await project(f),q=source('repair-001');await read(await f.call({id:'source-register',op:'register',actors:[],requests:[q]}));
 const report={id:'source-finish',op:'report-source',requestId:q.id,source:q.source,evidenceId:'engine-repair-receipt',actorId:'npc:lee',outcome:'completed'};
 assert.equal((await f.call(report,{token:B})).status,403);
 const done=await read(await f.call(report));assert.equal(done.projects.projects[0].workCount,1);assert.equal(done.projects.projects[0].contributors[0].actorId,'npc:lee');assert.equal(done.projects.projects[0].history.at(-1).provenance,'npc-observed');
 assert.equal((await f.call({id:'steal-source',op:'project-service',projectId:p.id,requestId:q.id},{token:B})).status,409);
 f.instances.clear();const replay=await read(await f.call({id:'retry-source-credit',op:'project-service',projectId:p.id,requestId:q.id}));assert.equal(replay.projects.projects[0].workCount,1);
 assert.equal((await read(await f.call(report))).receipt.duplicate,true);
 const fake=await f.call({id:'invent-source',op:'project-service',projectId:p.id,requestId:'imaginary',evidence:{kind:'work'},money:100000});assert.equal(fake.status,409);
});

test('archived player receipt can contribute after proposal but simulated social work never can',async()=>clock(async c=>{
 const f=fixture();await read(await f.call(observe()));const q=source('player-repair');await read(await f.call({id:'player-source',op:'register',actors:[],requests:[q]}));
 await read(await f.call({id:'own-source',op:'reserve',requestId:q.id},{token:B}));await read(await f.call({id:'finish-source',op:'report-source',requestId:q.id,source:q.source,evidenceId:'player-evidence',outcome:'completed'},{token:B}));
 const p=(await read(await f.call(propose()))).projects.projects[0];assert.equal(p.workCount,0);
 assert.equal((await f.call({id:'wrong-player-credit',op:'project-service',projectId:p.id,requestId:q.id})).status,409);
 const credited=await read(await f.call({id:'right-player-credit',op:'project-service',projectId:p.id,requestId:q.id},{token:B}));assert.equal(credited.projects.projects[0].workCount,1);
 const social={...source('social-result','checkin'),completionMode:'social'};await read(await f.call({id:'social-register',op:'register',actors:[],requests:[social]}));c.add(7200000);await f.object().alarm();
 assert.equal((await f.call({id:'social-credit',op:'project-service',projectId:p.id,requestId:social.id})).status,409);
 assert.equal((await read(await f.call(null))).projects.projects[0].workCount,1);
}));

test('a failed durable write leaves no project progress, challenge consumption or partial history',async()=>clock(async c=>{
 const f=fixture(),p=await project(f);const start=await read(await f.call({id:'atomic-start',op:'project-start',projectId:p.id,kind:'survey'}));c.add(PROJECT_SURVEY_MS);
 const storage=f.store(),original=storage.put;let fail=true;storage.put=async function(k,v) {await original.call(this,k,v);if(fail)throw Error('disk full');};
 const finish={id:'atomic-finish',op:'project-complete',projectId:p.id,challengeId:start.receipt.challenge.id};await assert.rejects(f.call(finish),/disk full/);fail=false;
 assert.equal((await read(await f.call(null))).projects.projects[0].surveyCount,0);
 const retry=await read(await f.call(finish));assert.equal(retry.projects.projects[0].surveyCount,1);assert.equal(retry.projects.projects[0].contributionCount,1);
}));

test('fresh start invalidates canceled timers and competing surveys cannot both contribute',async()=>clock(async c=>{
 const f=fixture(),p=await project(f);
 const old=await read(await f.call({id:'first-action',op:'project-start',projectId:p.id,kind:'survey'}));c.add(1000);
 const fresh=await read(await f.call({id:'replacement-action',op:'project-start',projectId:p.id,kind:'survey'}));assert.notEqual(old.receipt.challenge.id,fresh.receipt.challenge.id);
 const other=await read(await f.call({id:'other-survey',op:'project-start',projectId:p.id,kind:'survey'},{token:B}));c.add(PROJECT_SURVEY_MS);
 assert.equal((await f.call({id:'finish-replaced',op:'project-complete',projectId:p.id,challengeId:old.receipt.challenge.id})).status,409);
 const results=await Promise.all([f.call({id:'first-wins',op:'project-complete',projectId:p.id,challengeId:fresh.receipt.challenge.id}),f.call({id:'other-wins',op:'project-complete',projectId:p.id,challengeId:other.receipt.challenge.id},{token:B})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await read(await f.call(null))).projects.projects[0].contributionCount,1);
}));

test('distinct observed sites cannot place competing projects in the same footprint',async()=>{
 const f=fixture();await read(await f.call(observe('nearby-sites',[site,{...site,id:'alias-path',anchor:{x:12,y:2,z:21}}])));
 const responses=await Promise.all([f.call(propose('project-first')),f.call(propose('project-second','alias-path','garden'),{token:B})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await read(await f.call(null))).projects.projects.length,1);
 const geo=fixture();await read(await geo.call(observe('geo-nearby',[{...site,anchor:{x:1,y:2,z:1,lat:37.8,lon:-122.4}},{...site,id:'geo-alias',anchor:{x:9000,y:2,z:9000,lat:37.80001,lon:-122.4}}])));
 await read(await geo.call(propose()));assert.equal((await geo.call(propose('project-geo-alias','geo-alias','garden'))).status,409);
});

test('project danger is observer-scoped and a fresh danger at the exact deadline wins over completion',async()=>clock(async c=>{
 const f=fixture(),p=await project(f);await action(f,p,'survey','specific-survey',c);for(let i=0;i<3;i++)await action(f,p,'work',`specific-work-${i}`,c);
 c.add(PROJECT_DELAY_MS);
 const danger={id:'project-danger',op:'register',actors:[],requests:[],projectSituation:{hazard:0,blockedSites:[site.id],observedSites:[site.id]}};
 const paused=await read(await f.call(danger));assert.equal(paused.projects.projects[0].status,'building');assert.equal(paused.projects.projects[0].blockedReason,'site-inaccessible');
 const clear={id:'project-clear',op:'register',actors:[],requests:[],projectSituation:{hazard:0,blockedSites:[],observedSites:[site.id]}};
 const other=await read(await f.call(clear,{token:B}));assert.equal(other.projects.projects[0].status,'building','another observer cannot clear the original blocked observation');
 const unknown={...clear,id:'invented-conditions',projectSituation:{hazard:0,blockedSites:['invented'],observedSites:['invented']}};assert.equal((await f.call(unknown)).status,409);
 await read(await f.call({...clear,id:'unrelated-safe',projectSituation:{hazard:0,blockedSites:[],observedSites:[]}}));assert.equal((await read(await f.call(null))).projects.projects[0].status,'building','omitted sites cannot silently clear earlier blocks');
 const finished=await read(await f.call(clear));assert.equal(finished.projects.projects[0].status,'completed');assert.equal(finished.history,undefined);assert.equal(finished.events.filter(e=>e.type==='project-completed').length,1);
}));
