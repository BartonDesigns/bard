// Production Worker module, real HTTP and SQLite Durable Objects. No account,
// production time override, model inference or live data is used.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { startLocalRooms } from './local-worker.mjs';
const local=await startLocalRooms(),keys=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')];
const origin='http://localhost:8768',region='coast:#37.7,-122.4';let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
async function call(key,data,{world='earth',area=region,headers={}}={}) {
 const r=await fetch(`${local.url}/living/${encodeURIComponent(world)}/${encodeURIComponent(area)}`,{method:data?'POST':'GET',headers:{origin,authorization:`Bearer ${key}`,'content-type':'application/json',...headers},...(data?{body:JSON.stringify(data)}:{})});
 return {status:r.status,data:await r.json()};
}
try {
 const status=await(await fetch(local.url+'/status')).json();check(status.features.includes('world-projects-v1'),'actual LIVING binding advertises projects');
 const site={id:'coast-path',name:'Coastal path',source:'place',anchor:{x:10,y:2,z:20,lat:37.7,lon:-122.4}};
 const registered=await call(keys[0],{id:'integration-observe',op:'register',actors:[{id:'npc:rosa',name:'Rosa'},{id:'npc:lee',name:'Lee',skills:['repair']}],requests:[],sites:[site]});check(registered.status===200,'source-backed site stored in SQLite');
 const proposed=await call(keys[0],{id:'integration-propose',op:'project-propose',project:{siteId:site.id,kind:'path',readyAt:0,completedAt:0,privateConversation:'never publish'}});
 check(proposed.status===200&&proposed.data.projects.projects[0].status==='surveying','proposal cannot invent elapsed work');
 check(!JSON.stringify(proposed.data).includes('never publish')&&!JSON.stringify(proposed.data).includes(keys[0]),'private extra data and capability absent from public state');
 const project=proposed.data.projects.projects[0],other=await call(keys[1]);check(other.data.projects.projects[0].id===project.id&&other.data.you!==proposed.data.you,'two identities share canonical project');
 check((await call(keys[0],null,{world:'moon'})).data.projects.projects.length===0,'other celestial body isolated');
 check((await call(keys[0],null,{area:'other-region'})).data.projects.projects.length===0,'travel to other region is isolated');
 const start=await call(keys[0],{id:'integration-start',op:'project-start',projectId:project.id,kind:'survey',now:9999999999999,readyAt:0});check(start.status===200,'server issues timed challenge');
 const finish={id:'integration-finish',op:'project-complete',projectId:project.id,challengeId:start.data.receipt.challenge.id,now:9999999999999};
 check((await call(keys[0],finish)).status===409,'client future clock cannot finish action early');
 check((await call(keys[1],finish)).status===409,'other identity cannot consume challenge');
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,start.data.receipt.challenge.readyAt-Date.now()+150)));
 const finishes=await Promise.all([call(keys[0],finish),call(keys[0],finish)]);
 check(finishes.every(r=>r.status===200)&&finishes.filter(r=>r.data.receipt.duplicate).length===1,'concurrent exact completion commits once');
 check(finishes[0].data.projects.projects[0].surveyCount===1,'survey contributes once');
 const work=await call(keys[1],{id:'integration-work-start',op:'project-start',projectId:project.id,kind:'work'});
 check(work.data.receipt.challenge.readyAt-work.data.receipt.challenge.startedAt===30000,'work challenge uses real 30-second server minimum');
 check((await call(keys[1],{id:'integration-work-cheat',op:'project-complete',projectId:project.id,challengeId:work.data.receipt.challenge.id,elapsedMs:30000})).status===409,'claimed work duration ignored');
 for(let i=0;i<3;i++) {
  const q={id:`actual-repair-${i}`,title:`Repair work ${i}`,kind:'repair',giverId:'npc:rosa',siteId:site.id,source:`actual-source-${i}`,requiredSkills:['repair']};
  const seeded=await call(keys[0],{id:`register-source-${i}`,op:'register',actors:[],requests:[q]});assert.equal(seeded.status,200,JSON.stringify(seeded.data));
  const report={id:`report-source-${i}`,op:'report-source',requestId:q.id,source:q.source,evidenceId:`actual-receipt-${i}`,actorId:'npc:lee',outcome:'completed'};
  check((await call(keys[1],report)).status===403,'non-observer cannot manufacture NPC source result');
  const result=await call(keys[0],report);assert.equal(result.status,200,JSON.stringify(result.data));
  check(result.data.projects.projects[0].workCount===i+1,'permitted physical NPC report automatically contributes once');
 }
 const shared=await call(keys[1]);const p=shared.data.projects.projects[0];
 check(p.status==='building'&&p.readyAt-p.updatedAt===86400000,'minimum full day starts only after required contributions');
 check(p.contributors.some(c=>c.actorId==='npc:lee'&&c.serviceCount===3),'shared history attributes actual NPC contributor');
 check(shared.data.history.events.some(e=>e.type==='project-building'),'public persistent history records building stage');
 const replay=await call(keys[0],{id:'integration-service-replay',op:'project-service',projectId:p.id,requestId:'actual-repair-0'});
 check(replay.status===200&&replay.data.projects.projects[0].workCount===3,'archived source receipt cannot double-credit');
 const disaster=await call(keys[0],{id:'integration-disaster',op:'register',actors:[],requests:[],situation:{hazard:1,destroyedSites:[site.id]}});
 check(disaster.data.projects.projects[0].blockedReason==='site-inaccessible','observed disaster blocks shared publication');
 console.log(`community projects real Worker integration: ${checks} passed, 0 failed`);
} finally {await local.dispose();}
