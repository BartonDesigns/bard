// Controlled interface integration: actual Guide, project runtime and reducer.
// Terrain, people, model output and elapsed time are fixtures, not a live playtest.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const {build}=require('../node_modules/esbuild');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=String.raw`
import {createGuide} from './src/guide/guide.js';
import {createCommunityProjects} from './src/people/community-projects.js';
localStorage.setItem('crysis-guide-model',JSON.stringify({kind:'none'}));
localStorage.setItem('crysis-guide-voice','false');localStorage.setItem('crysis-voices',JSON.stringify('device'));
let clock=1791997200000,body='earth',hazard=0;Date.now=()=>clock;const at={x:0,y:1.7,z:0},actions=[],calls=[],prompts=[];
const candidate={id:'coastal-clearing',siteId:'coastal-clearing',name:'Coastal clearing',anchor:{x:0,y:0,z:0},kinds:['path','garden','gathering','resonance']};
const pathCandidate={id:'coastal-walk',siteId:'coastal-walk',name:'Coastal walk',anchor:{x:2,y:0,z:0},kinds:['path']};
const choices=[{id:'priority',effect:'prioritize',label:'Make this a priority'},{id:'defer',effect:'defer',label:'Wait for a safer moment'},{id:'resume',effect:'resume',label:'Resume the work'}];
const living={snapshot:()=>({mode:'local',scope:{key:body+':coast',world:body,name:'Coastal village'},activities:[{id:'survey-kit',npcId:'npc:122',npcName:'Mara',title:'Recover the survey kit',reason:'The neighbours need a safe path.',state:'active',choices,canIntervene:true}],history:[]}),factsFor:()=>[],action:async(id,action,args)=>{actions.push({id,action,args});return {ok:true,message:'I will make the survey kit my priority.'};}};
const world={island:{half:1000,heightAt:()=>0,village:{x:0,z:0,bay:null},peak:{x:100,z:100,h:30}},sky:{state:{hours:13}},player:{state:{pos:at,yaw:0},floorAt:()=>0}};
const runtime=createCommunityProjects({worldKey:()=>body,region:()=>({id:'coast',name:'Coastal village'}),world:()=>world,position:()=>at,candidates:()=>[candidate,pathCandidate],situation:()=>({hazard,blockedSites:[]}),storage:localStorage,clock:()=>clock,mark:()=>{}});
const actor={active:true,P:{dna:{seed:122,age:38,male:false,ancestry:[0,0,1],temper:{outgoing:.5,confident:.5,warmth:.5,fidget:.5}}},M:{S:{pos:at},feel(){},gesture(){}}};
const other={...actor,P:{dna:{...actor.P.dna,seed:123}}};
const api={world:()=>world,camera:{position:at},shared:{planet:{name:'Coastal village'},uWind:{value:0}},hint(){},livingWorld:living,communityProjects:runtime,soul:{credentials:()=> 'PRIVATE_RECOVERY_KEY_SENTINEL',info:()=>null},social:{bodyKey:()=>body,meet:()=>null,state:{list:()=>[],get:()=>null}},people:{engage(){},release(){}}};
const guide=createGuide(document.getElementById('app'),api);
guide.llm.kind=()=> 'ollama';guide.llm.status.ready=true;guide.llm.supportsPlanning=()=>true;
guide.llm.chat=async(messages,onToken,signal,opts={})=>{calls.push(opts.planning?.kind||'dialogue');prompts.push({messages,npc:opts.npc,planning:opts.planning});const reply=opts.planning?.kind==='community_project_intent'?JSON.stringify({intent:'propose',confidence:.98,candidateId:candidate.id,projectKind:'garden',question:null}):'We still need to do the work at the actual site.';onToken(reply);return reply;};
window.qa={guide,runtime,actor,other,at,actions,calls,prompts,advance:seconds=>{for(let i=0;i<Math.ceil(seconds*4);i++){clock+=250;runtime.update(.25);}guide.update(0);},day:hours=>{clock+=hours*3600000;runtime.update(.25);guide.update(0);},body:value=>{body=value;runtime.update(.25);},danger:value=>{hazard=value;runtime.update(.25);guide.update(0);},clock:()=>clock};
guide.showStory();
`;
(async()=>{
 const root=path.resolve(__dirname,'../..'),out=process.env.BARD_COMMUNITY_OUT||path.join(root,'docs/verification/community-projects');await fs.mkdir(out,{recursive:true});
 const report={method:'Actual Guide, community project runtime and pure reducer, with fixture terrain/NPCs/model replies and controlled time. Desktop and touch-emulated phone Chromium. This is not a real phone, human playtest, deployed Worker check or a 24-hour wall-clock test.',errors:[],screenshots:[]};let browser,server;
 try{
  const bundle=await build({stdin:{contents:fixture,resolveDir:path.join(root,'island'),sourcefile:'community-ui-fixture.js'},bundle:true,format:'esm',write:false,logLevel:'silent'});
  const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bard community project verification</title><style>body{margin:0;background:#14221e;color:#adc6bb;font:14px system-ui}h1,p{margin:28px;max-width:400px}h1{font-size:20px}#app{position:absolute;inset:0}</style><h1>Bard · community projects</h1><p>Controlled interface verification. Real project runtime and save journal; fixture terrain, residents and clock.</p><div id="app"></div><script type="module" src="/fixture.js"></script>';
  server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.startsWith('/fixture.js')?'text/javascript':'text/html');res.end(req.url.startsWith('/fixture.js')?bundle.outputFiles[0].text:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{}),args:['--no-sandbox']});
  for(const [label,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
   const page=await browser.newPage({viewport,hasTouch:label==='phone'});page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/?offline=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.qa);
   const dialog=page.getByRole('dialog',{name:'The Guide'});
   assert.match(await dialog.innerText(),/COMMUNITY PROJECTS/);assert.match(await dialog.innerText(),/Saved on this device/);
   await page.evaluate(()=>{qa.guide.talkTo(qa.actor);return qa.guide.ask('Could we bring this neglected plot back to life?');});
   assert.ok(await page.evaluate(()=>qa.calls.includes('community_project_intent')));assert.equal(await page.evaluate(()=>qa.runtime.snapshot().projects.length),0);
   await page.getByRole('button',{name:'Propose community garden',exact:true}).click();await page.waitForFunction(()=>qa.runtime.snapshot().projects.length===1);
   await page.evaluate(()=>qa.guide.showStory());assert.match(await dialog.innerText(),/Survey 0\/1 · Work 0\/3/);
   await page.getByRole('button',{name:'Survey site · 5 sec',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Record survey',exact:true}).isEnabled(),false);
   await page.evaluate(()=>{qa.advance(2);qa.at.x=20;qa.runtime.update(.25);qa.guide.update(0);});assert.match(await dialog.innerText(),/Work stopped/);
   assert.equal(await page.getByRole('button',{name:'Record survey',exact:true}).isEnabled(),false);
   await page.evaluate(()=>{qa.at.x=0;qa.guide.showStory();});await page.getByRole('button',{name:'Survey site · 5 sec',exact:true}).click();await page.evaluate(()=>qa.advance(5));
   assert.equal(await page.getByRole('button',{name:'Record survey',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'Record survey',exact:true}).click();
   await page.waitForFunction(()=>qa.runtime.snapshot().projects[0].surveyCount===1);
   await page.getByRole('button',{name:'Help build · 30 sec',exact:true}).click();await page.evaluate(()=>qa.advance(12));
   assert.equal(await page.getByRole('button',{name:'Record work',exact:true}).isEnabled(),false);
   await page.getByRole('progressbar',{name:'Work progress'}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'project-work-'+label+'.png')});report.screenshots.push('project-work-'+label+'.png');
   await page.getByRole('button',{name:'Pause work',exact:true}).click();assert.equal(await page.evaluate(()=>qa.runtime.snapshot().active),null);
   for(let i=1;i<=3;i++){await page.getByRole('button',{name:'Help build · 30 sec',exact:true}).click();await page.evaluate(()=>qa.advance(30));await page.getByRole('button',{name:'Record work',exact:true}).click();await page.waitForFunction(n=>qa.runtime.snapshot().projects[0].workCount===n,i);}
   assert.equal(await page.evaluate(()=>qa.runtime.snapshot().projects[0].status),'building');assert.match(await dialog.innerText(),/24 hours/);
   await page.evaluate(()=>qa.day(23));assert.equal(await page.evaluate(()=>qa.runtime.snapshot().projects[0].status),'building');await page.evaluate(()=>{qa.day(1);qa.advance(5);qa.guide.showStory();});
   assert.equal(await page.evaluate(()=>qa.runtime.snapshot().projects[0].status),'completed');assert.match(await dialog.innerText(),/Part of the world/);assert.doesNotMatch(await dialog.innerText(),/Expected in/);
   await page.getByRole('button',{name:'Show project site',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'project-complete-'+label+'.png')});report.screenshots.push('project-complete-'+label+'.png');
   await page.evaluate(()=>{qa.guide.talkTo(qa.other);return qa.guide.ask('PRIVATE_OTHER_THREAD_SENTINEL');});
   await page.evaluate(()=>{qa.guide.talkTo(qa.actor);return qa.guide.ask('How does this place feel to you today?');});
   const npcPrompt=await page.evaluate(()=>qa.prompts.at(-1));
   assert.ok(npcPrompt.npc.facts.some(f=>f.includes('Community garden at Coastal clearing') && f.includes('Completed and present') && f.includes('Local record on this device')));
   assert.match(npcPrompt.messages[0].content,/Community garden at Coastal clearing/);assert.doesNotMatch(JSON.stringify(npcPrompt),/PRIVATE_RECOVERY_KEY_SENTINEL|PRIVATE_OTHER_THREAD_SENTINEL/);
   await page.evaluate(()=>{qa.guide.talkTo(qa.actor);return qa.guide.ask('Could you make this a priority?');});assert.equal(await page.evaluate(()=>qa.actions.length),0);
   await page.evaluate(()=>{window.oldReview=[...document.querySelectorAll('button')].find(b=>b.textContent==='Make this a priority');qa.guide.talkTo(qa.other);oldReview.click();});assert.equal(await page.evaluate(()=>qa.actions.length),0);
   await page.evaluate(()=>{qa.guide.talkTo(qa.actor);return qa.guide.ask('Could you make this a priority?');});await page.getByRole('button',{name:'Make this a priority',exact:true}).click();await page.waitForFunction(()=>qa.actions.length===1);
   assert.equal(await page.evaluate(()=>qa.actions[0].args.choiceId),'priority');
   await page.evaluate(()=>qa.guide.ask('Can we mark a coastal path?'));await page.evaluate(()=>{qa.body('moon');});await page.getByRole('button',{name:'Propose marked path',exact:true}).click();assert.equal(await page.evaluate(()=>qa.runtime.snapshot().projects.length),0);assert.match(await dialog.innerText(),/another area/);
   await page.evaluate(()=>{qa.body('earth');qa.guide.showStory();});assert.equal(await page.evaluate(()=>qa.runtime.snapshot().projects[0].status),'completed');
   await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.qa);assert.equal(await page.evaluate(()=>qa.runtime.snapshot().projects[0].status),'completed');
   const overflow=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,viewport:innerWidth,over:el.scrollWidth>el.clientWidth+1}));assert.equal(overflow.over,false);assert.ok(overflow.width<=viewport.width);
   report[label]={passed:true,modelParaphrase:true,explicitProposal:true,earlyFinishBlocked:true,movementCancelsObservation:true,pauseWorks:true,threeRecordedWorkSessions:true,controlled24HourPropagation:true,npcRecognizesActualProject:true,privateCredentialsExcluded:true,otherNpcConversationExcluded:true,perNpcScheduling:true,staleWorldProposalBlocked:true,reloadPersists:true,overflow};await page.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=e.message;throw e;}finally{await fs.writeFile(path.join(out,'ui-browser-report.json'),JSON.stringify(report,null,2));await browser?.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
