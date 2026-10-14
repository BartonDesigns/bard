// Controlled UI fixture: real Guide, negotiation runtime/ledger and inventory.
// The board, seller site, NPC body and model responses are deterministic fixtures.
// This is not a production multiplayer or physical-device gameplay playtest.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const {build}=require('../node_modules/esbuild');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=String.raw`
import {createGuide} from './src/guide/guide.js';
import {createNegotiationRuntime} from './src/economy/negotiation-runtime.js';
import {createInventoryState,applyInventoryTransaction} from './src/gameplay/arms.js';
import {parseArmsRequest} from './src/crysis/arms-runtime.js';
localStorage.setItem('crysis-guide-model',JSON.stringify({kind:'none'}));
localStorage.setItem('crysis-guide-voice','false');
localStorage.setItem('crysis-voices',JSON.stringify('device'));
let inventory=createInventoryState('player',{credits:2000});
const at={x:0,y:2,z:0},site={id:'fixture-shop',economyId:'fixture-shop',name:'Coastal supplies',x:0,y:2,z:0};
const item='reedline-hunting-bow',calls=[],actions=[];
const arms={catalog:()=>[{id:item,name:'Reedline hunting bow'}],parse:parseArmsRequest,command:()=>{throw Error('Conversation must never invoke the legacy arms purchase executor');},state:()=>inventory,applied:id=>inventory.journal.some(r=>r.id===id&&r.accepted),apply:tx=>{const r=applyInventoryTransaction(inventory,tx);if(r.ok)inventory=r.state;return {ok:r.ok,persisted:true,message:r.receipt?.message};},shopSheet:()=>({buy:[{itemId:item,price:1000}]}),shops:()=>[site],setPurchasePolicy(){}};
const actor={active:true,workContext:{role:'vendor',program:'Coastal supplies'},P:{dna:{seed:122,age:38,male:false,ancestry:[0,0,1],temper:{outgoing:.5,confident:.5,warmth:.5,fidget:.5}}},M:{S:{pos:at},feel(){},gesture(){}}};
let task={id:'survey-kit',title:'Bring back the missing survey kit',reason:'A neighbour needs to check the coastal path before the next high tide.',state:'open',npcName:'Mara',npcId:'npc:122',place:'Coastal supplies',canJoin:true,canContact:true,canIntervene:true,history:['Mara asked a neighbour to look for the missing kit.','The safer inland route is still being considered.'],choices:[{id:'quiet',label:'Suggest the quiet route'},{id:'coast',label:'Ask about the coastal route'}]};
let completed=false, agreementId=null; const serviceExpires=Date.now()+600000;
const living={snapshot:()=>({activities:[structuredClone(task)],scope:'Local record on this device. Shared simulation unavailable in this controlled fixture.',catchup:{message:'Recorded residents continued their work while you were away.'},history:[]}),factsFor:()=>[task.reason],servicesFor:()=>[{id:task.id,label:task.title,revision:1,beneficiaryId:site.id,worldId:'earth',status:completed?'completed':'open',creditValue:900,expiresAt:serviceExpires}],completionEvidence:()=>completed?{id:'kit-receipt',serviceId:task.id,revision:1,beneficiaryId:site.id,worldId:'earth',actorId:'player',verified:true,status:'completed',rewardMode:'discount',agreementId,completedAt:Date.now()}:null,action:async(id,action,opts={})=>{actions.push({id,action,opts});if(action==='contact')return {ok:true,actor,message:'Mara is here.'};if(action==='join'){agreementId=opts.agreementId||agreementId;task={...task,state:'reserved',canJoin:false,instruction:'Pick up the kit at the lookout, then bring it back.',currentStep:{do:'collect',at:{x:20,y:2,z:0}}};return {ok:true,message:'The task is reserved. Nothing is complete yet.'};}if(action==='intervene')return {ok:true,message:'Your suggestion was recorded for discussion. The path is unchanged.'};return {ok:false,message:'Reach the actual target before reporting progress.'};}};
const world={island:{half:1000,heightAt:()=>2,village:{x:0,z:0,bay:null},peak:{x:100,z:100,h:30}},sky:{state:{hours:13}},player:{state:{pos:at,yaw:0},floorAt:()=>2}};
const negotiation=createNegotiationRuntime({arms,world:()=>world,bodyKey:()=> 'earth',position:()=>at,livingWorld:living,relationship:()=>({trust:7}),now:()=>Date.now(),storage:localStorage,resolveSeller:()=>site});
const api={world:()=>world,camera:{position:{...at}},shared:{planet:{name:'Coastal village'},uWind:{value:0}},hint(){},livingWorld:living,negotiation,arms,social:{bodyKey:()=> 'earth',meet:()=>null,state:{list:()=>[],get:()=>null}},people:{engage(){},release(){}}};
const guide=createGuide(document.getElementById('app'),api);
guide.llm.kind=()=> 'ollama';guide.llm.status.ready=true;guide.llm.supportsPlanning=()=>true;
guide.llm.chat=async(messages,onToken,signal,opts={})=>{calls.push(opts.planning?.kind||'dialogue');const reply=opts.planning?.kind==='negotiation_intent'?JSON.stringify({intent:'service',confidence:.98,itemId:item,amount:null,question:null}):'The path is unchanged until we agree on a real plan.';onToken(reply);return reply;};
window.qa={guide,actor,arms,negotiation,actions,calls,complete:()=>{completed=true;task={...task,state:'completed',instruction:'The survey kit was returned.',currentStep:null};},reset:()=>localStorage.clear()};
guide.showStory();
`;
(async()=>{
 const root=path.resolve(__dirname,'../..'),out=process.env.BARD_LIVING_OUT||path.join(root,'docs/verification/living-world');await fs.mkdir(out,{recursive:true});
 const report={method:'Controlled real Guide, negotiation runtime/ledger and inventory fixture with a deterministic activity facade and model responses. Desktop and touch-emulated mobile Chromium; not full-world gameplay, a human playtest, a real phone, or live cloud simulation.',errors:[],screenshots:[]};
 let browser,server;
 try{
  const bundle=await build({stdin:{contents:fixture,resolveDir:path.join(root,'island'),sourcefile:'living-ui-fixture.js'},bundle:true,format:'esm',write:false,logLevel:'silent'});
  const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bard living-world UI verification</title><style>body{margin:0;background:#14221e;color:#adc6bb;font:14px system-ui}h1{margin:28px;font-size:20px}p{margin:28px;max-width:400px}#app{position:absolute;inset:0}</style><h1>Bard · living-world UI</h1><p>Controlled interface verification. Real Guide and trade ledger; fixture residents and task board.</p><div id="app"></div><script type="module" src="/fixture.js"></script>';
  server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.startsWith('/fixture.js')?'text/javascript':'text/html');res.end(req.url.startsWith('/fixture.js')?bundle.outputFiles[0].text:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{}),args:['--no-sandbox']});
  for(const [label,viewport] of [['desktop',{width:1280,height:900}],['phone',{width:390,height:844}]]){
   const page=await browser.newPage({viewport,hasTouch:label==='phone'});page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/?offline=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.qa);
   const dialog=page.getByRole('dialog',{name:'The Guide'});
   assert.match(await dialog.innerText(),/LIFE AROUND YOU/);assert.match(await dialog.innerText(),/coastal path/);
   await page.screenshot({path:path.join(out,'activity-'+label+'.png')});report.screenshots.push('activity-'+label+'.png');
   await page.getByRole('button',{name:'Suggest the quiet route',exact:true}).click();
   await page.waitForFunction(()=>qa.actions.some(a=>a.action==='intervene'));
   assert.match(await dialog.innerText(),/path is unchanged/);
   await page.getByRole('button',{name:'Find Mara',exact:true}).click();
   await page.evaluate(()=>qa.guide.ask('Could I get a bow?'));
   assert.equal(await page.evaluate(()=>qa.arms.state().credits),2000);
   assert.equal(await page.evaluate(()=>qa.negotiation.contextFor(qa.actor).pendingOffer?.status),'quoted');
   await page.evaluate(()=>qa.guide.ask('Would making your afternoon easier put that bow within reach?'));
   assert.ok(await page.evaluate(()=>qa.calls.includes('negotiation_intent')));
   assert.equal(await page.evaluate(()=>qa.arms.state().credits),2000);
   await page.evaluate(()=>qa.guide.ask('I can only spare $20 for the bow. Is there work I could do to earn a better price?'));
   const quoted=await page.evaluate(()=>({credits:qa.arms.state().credits,offer:qa.negotiation.contextFor(qa.actor).pendingOffer}));
   assert.equal(quoted.credits,2000);assert.equal(quoted.offer.status,'quoted');assert.equal(quoted.offer.kind,'service');
   await page.evaluate(()=>qa.guide.ask('Sounds good'));
   assert.equal(await page.evaluate(()=>qa.negotiation.contextFor(qa.actor).pendingOffer.status),'quoted');
   await page.getByRole('button',{name:'Confirm these terms',exact:true}).first().click();
   assert.match(await dialog.innerText(),/no longer current/);
   assert.equal(await page.evaluate(()=>qa.negotiation.contextFor(qa.actor).pendingOffer.status),'quoted');
   await page.getByRole('button',{name:'Confirm these terms',exact:true}).last().click();
   await page.waitForFunction(()=>qa.negotiation.contextFor(qa.actor).pendingOffer?.status==='accepted');
   assert.equal(await page.evaluate(()=>qa.arms.state().credits),2000);
   await page.getByRole('button',{name:'Complete agreed exchange',exact:true}).last().click();
   assert.equal(await page.evaluate(()=>qa.arms.state().credits),2000);
   assert.match(await dialog.innerText(),/condition|complete|work|verified/i);
   await page.screenshot({path:path.join(out,'agreement-'+label+'.png')});report.screenshots.push('agreement-'+label+'.png');
   await page.evaluate(()=>qa.complete());
   await page.getByRole('button',{name:'Complete agreed exchange',exact:true}).last().click();
   await page.waitForFunction(()=>qa.arms.state().credits<2000);
   assert.equal(await page.evaluate(()=>qa.arms.state().credits),2000-quoted.offer.price);
   assert.equal(await page.evaluate(()=>Object.keys(qa.arms.state().instances).length),1);
   const overflow=await dialog.evaluate(el=>({width:el.getBoundingClientRect().width,viewport:innerWidth,over:el.scrollWidth>el.clientWidth+1}));
   assert.equal(overflow.over,false);assert.ok(overflow.width<=viewport.width);
   report[label]={passed:true,quotedPrice:quoted.offer.price,modelParaphrase:true,staleOfferBlocked:true,explicitConsent:true,unverifiedTaskBlocked:true,verifiedExchangeOnce:true,overflow};
   await page.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=e.message;throw e;}finally{await fs.writeFile(path.join(out,'ui-browser-report.json'),JSON.stringify(report,null,2));await browser?.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
