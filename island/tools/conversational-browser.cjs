// Actual game integration with deterministic model responses. This does not measure
// a live model's language quality: it tests proposals, validation and game evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const out = process.env.BARD_CONVERSATION_OUT || '/tmp/bard-conversational-qa';
(async () => {
 fs.mkdirSync(out, { recursive: true });
 const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 try {
 const page = await browser.newPage({viewport:{width:480,height:320},hasTouch:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'});
 page.setDefaultTimeout(300000);
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 const boot=async()=>{await page.evaluate(async()=>{
  const api=await L99IslandDoor.engine(); await api.open({seed:1337,earth:false,biome:'TROPICAL'}); Crysis.music.auto(false); window._KEYS_PLAY_ON=false;
  const W=api.world(),v=W.island.village,p=W.player.state; p.pos.set(v.x,W.island.heightAt(v.x,v.z)+1.7,v.z+7);p.vel.set(0,0,0);p.flying=true;api.camera().position.copy(p.pos);W.sky.state.speed=0;W.sky.state.hours=13;
 });};
 await page.goto((process.env.BARD_URL||'http://127.0.0.1:8766')+'/?offline&safe',{waitUntil:'domcontentloaded'});await boot();
 await page.waitForFunction(()=>L99Island.people.pool.filter(p=>p.active&&!p.P.dna.child&&p.detachForSocial).length>=2);
 await page.evaluate(()=>{
  const api=L99Island;api.close();api.dom.mount.style.display='block';
  const actor=api.people.pool.find(p=>p.active&&!p.P.dna.child&&p.detachForSocial);api.camera().position.copy(actor.M.S.pos);api.camera().position.y+=1.7;api.guide.talkTo(actor);
  window.qa={actor,id:actor.residentId,calls:[],intent:{intent:'none',confidence:1,targetId:null,question:null}};
  const llm=api.guide.llm;llm.kind=()=> 'ollama';llm.status.ready=true;llm.supportsPlanning=()=>true;
  llm.chat=async(messages,onToken,signal,opts={})=>{
   qa.calls.push(opts.planning?.kind||'dialogue');
   if(qa.defer&&opts.planning){return new Promise(resolve=>{qa.release=resolve;});}
   const raw=opts.planning?.kind==='story_quest'?JSON.stringify(qa.plan):opts.planning?typeof qa.intent==='string'?qa.intent:JSON.stringify(qa.intent):qa.dialogue||'I am listening.';
   onToken(raw);return raw;
  };
 });
 const command=async(text,intent)=>page.evaluate(async({text,intent})=>{qa.intent=intent;await L99Island.guide.ask(text);return {mode:Crysis.social().state.get(qa.id).mode,calls:qa.calls.slice(),alarm:Crysis.social().state.alarmFor(Crysis.social().bodyKey(),Crysis.social().state.get(qa.id).position).level};},{text,intent});
 const proposal=(intent,question=null)=>({intent,confidence:1,targetId:null,question});
 const follow=await command('Would you keep me company as I head down the trail?',proposal('follow'));assert.equal(follow.mode,'follow');assert.ok(follow.calls.includes('social_intent'));
 const scout=await command('Would you find out what lies around this bend and bring back a report?',{...proposal('scout'),targetId:'nearby'});assert.equal(scout.mode,'scout');
 await command('wait here',proposal('wait'));
 const warn=await command('Could you spread word of trouble to everyone close by?',proposal('warn'));assert.ok(warn.alarm>0);await command('calm the villagers',proposal('calm'));
 const clarification=await command('Would you handle that for me?',proposal('clarify','Do you mean wait here or explore nearby?'));assert.equal(clarification.mode,'wait');
 for(const raw of ['{broken',proposal('teleport'),{...proposal('follow'),execute:'arbitrary'}]){const r=await command('Please accompany this traveler along the shore.',raw);assert.equal(r.mode,'wait');}
 const before=await page.evaluate(()=>L99Island.guide.quests().length);
 await page.evaluate(()=>{qa.dialogue='Certainly. [[quest: the island peak]]';});await command('Tell me a tale about this island.',proposal('none'));assert.equal(await page.evaluate(()=>L99Island.guide.quests().length),before);
 const interrupted=await page.evaluate(async()=>{
  qa.defer=true;qa.pending=L99Island.guide.ask('Please accompany this traveler along the shore.');await Promise.resolve();return !!qa.release;
 });assert.equal(interrupted,true);
 await page.evaluate(async()=>{L99Island.guide.endTalk();qa.release(JSON.stringify({intent:'follow',confidence:1,targetId:null,question:null}));await qa.pending;qa.defer=false;L99Island.guide.talkTo(qa.actor);});
 assert.equal(await page.evaluate(()=>Crysis.social().state.get(qa.id).mode),'wait');
 // Change the actual current world's body identity while a model answer is pending;
 // this isolates the guard without reconstructing unrelated renderer resources.
 await page.evaluate(async()=>{
  qa.defer=true;qa.release=null;qa.pending=L99Island.guide.ask('Please accompany this traveler along the shore.');await Promise.resolve();
  if(!qa.release)throw Error('Deferred planning request missing');
  const W=L99Island.world(),original=W.body;W.body={...original,key:original.key+':different-body'};
  qa.release(JSON.stringify({intent:'follow',confidence:1,targetId:null,question:null}));await qa.pending;W.body=original;qa.defer=false;
 });
 assert.equal(await page.evaluate(()=>Crysis.social().state.get(qa.id).mode),'wait');
 const offered=await page.evaluate(async()=>{
  const g=L99Island.guide,r=Crysis.social().state.get(qa.id),ctx=g.storyContext(r),home=ctx.targets.find(t=>t.id.startsWith('home'));
  const target=ctx.targets.find(t=>!t.id.startsWith('home')&&Math.hypot(t.x-home.x,t.z-home.z)>t.radius+home.radius+5);
  if(!target)throw Error('No distinct real quest destination');
  qa.target=target;qa.home=home;qa.plan={title:'The view beyond home',premise:`Compare the view at ${target.name} with the meeting place, then tell ${r.persona.name} what caught your attention.`,steps:[{type:'visit',targetId:target.id},{type:'return',targetId:home.id},{type:'talk',npcId:ctx.speaker}]};
  qa.intent={intent:'quest_request',confidence:1,targetId:null,question:null};await g.ask('Is there something meaningful I could explore for you?');
  qa.quest=g.stories.list(ctx.bodyKey).at(-1);if(qa.quest.offeredBy!==ctx.speaker)throw Error('Offer not bound to its actual speaker');return qa.quest;
 });assert.equal(offered.status,'offered');assert.equal(offered.cursor,0);
 await command('That sounds like a plan, count me in',proposal('quest_accept'));
 assert.equal(await page.evaluate(()=>L99Island.guide.stories.list().find(q=>q.id===qa.quest.id).status),'active');
 const evidence=await page.evaluate(async()=>{
  const api=L99Island,g=api.guide,find=()=>g.stories.list().find(q=>q.id===qa.quest.id),stages=[];stages.push(find());
  g.talkTo(qa.actor);qa.intent={intent:'none',confidence:1,targetId:null,question:null};await g.ask('I already went there and returned.');stages.push(find());g.endTalk();
  api.camera().position.set(qa.target.x,qa.target.y+100,qa.target.z);g.update(1.1);stages.push(find());
  api.camera().position.set(qa.target.x,qa.target.y+1.7,qa.target.z);g.update(1.1);stages.push(find());
  g.talkTo(qa.actor);stages.push(find());g.endTalk();
  api.camera().position.set(qa.home.x,qa.home.y+1.7,qa.home.z);g.update(1.1);stages.push(find());
  g.talkTo(qa.actor);stages.push(find());return stages;
 });assert.deepEqual(evidence.map(q=>q.cursor),[0,0,0,1,1,2,3]);assert.equal(evidence.at(-1).status,'complete');
 const completionMemory=await page.evaluate(()=>{const g=L99Island.guide;g.update(1.1);g.update(1.1);return Crysis.social().state.get(qa.id).memories.filter(m=>m.content.includes('completed')&&m.content.includes(qa.quest.title));});assert.equal(completionMemory.length,1);
 const residentId=await page.evaluate(()=>qa.id);
 await page.evaluate(()=>L99Island.guide.showQuests());
 await page.screenshot({path:`${out}/quests.png`});
 const bounds=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(e=>(e.textContent.trim()==='Quests'||e.getAttribute('aria-label')==='Close the guide')&&e.getBoundingClientRect().width).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()})));
 for(const b of bounds)assert.ok(b.rect.x>=0&&b.rect.y>=0&&b.rect.right<=480.5&&b.rect.bottom<=320.5,JSON.stringify(b));
 await page.reload({waitUntil:'domcontentloaded'});await boot();
 const restored=await page.evaluate(id=>L99Island.guide.stories.list().find(q=>q.id===id),offered.id);assert.equal(restored.status,'complete');assert.equal(restored.evidence.length,3);
 const restoredMemory=await page.evaluate(({id,title})=>{const g=L99Island.guide;g.update(1.1);g.update(1.1);return Crysis.social().state.get(id).memories.filter(m=>m.content.includes('completed')&&m.content.includes(title));},{id:residentId,title:offered.title});assert.equal(restoredMemory.length,1);assert.deepEqual(restoredMemory,completionMemory);
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({transport:'deterministic model-response mock; real game integration',follow,scout,warn,clarification,interrupted,offered,evidence,bounds,restored,completionMemory,restoredMemory,errors},null,2));
 console.log('Conversational model-response integration and real quest evidence passed',JSON.stringify({out,quest:offered.id,cursors:evidence.map(q=>q.cursor),restored:restored.status,bounds}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
