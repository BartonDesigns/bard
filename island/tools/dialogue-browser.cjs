// Real game integration; deterministic LLM replies isolate context and UI behavior.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const out=process.env.BARD_DIALOGUE_OUT||'/tmp/bard-dialogue-qa';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 try {
 const page=await browser.newPage({viewport:{width:480,height:320},hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'});page.setDefaultTimeout(300000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const boot=async()=>page.evaluate(async()=>{const api=await L99IslandDoor.engine();await api.open({seed:1337,earth:false,biome:'TROPICAL'});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;const W=api.world(),v=W.island.village,p=W.player.state;p.pos.set(v.x,W.island.heightAt(v.x,v.z)+1.7,v.z+7);p.vel.set(0,0,0);p.flying=true;api.camera().position.copy(p.pos);W.sky.state.speed=0;W.sky.state.hours=13;});
 await page.goto((process.env.BARD_URL||'http://127.0.0.1:8766')+'/?offline&safe',{waitUntil:'domcontentloaded'});await boot();
 await page.waitForFunction(()=>L99Island.people.pool.filter(p=>p.active&&!p.P.dna.child&&p.detachForSocial).length>=2);
 await page.evaluate(()=>{const a=L99Island;a.close();a.dom.mount.style.display='block';window.qa={actors:a.people.pool.filter(p=>p.active&&!p.P.dna.child&&p.detachForSocial).slice(0,2),calls:[]};a.guide.llm.kind=()=> 'ollama';a.guide.llm.status.ready=true;a.guide.llm.supportsPlanning=()=>true;a.guide.llm.chat=async(messages,onToken,signal,opts={})=>{qa.calls.push({messages,opts});if(qa.defer)return new Promise(resolve=>{qa.release=raw=>{onToken(raw);resolve(raw);};});const raw=opts.planning?JSON.stringify({intent:'none',confidence:1,targetId:null,question:null}):qa.reply||'A private answer.';onToken(raw);return raw;};a.camera().position.copy(qa.actors[0].M.S.pos);a.guide.talkTo(qa.actors[0]);qa.first=a.guide.partner().id;});
 await page.evaluate(async()=>{for(let i=0;i<20;i++){qa.reply='FIRST_REPLY_'+i;await L99Island.guide.ask('Tell me a tale about FIRST_SECRET_'+i+'.');}});
 const retained=await page.evaluate(()=>({archive:L99Island.guide.archive.thread(qa.first).turns.length,context:Crysis.social().state.get(qa.first).history.length}));assert.ok(retained.archive>=40);assert.ok(retained.context<=16);
 await page.evaluate(async()=>{L99Island.guide.talkTo(qa.actors[1]);qa.second=L99Island.guide.partner().id;qa.reply='SECOND_REPLY';await L99Island.guide.ask('Tell me about SECOND_SECRET.');});
 const separation=await page.evaluate(()=>({first:qa.first,second:qa.second,visible:document.querySelector('[role=dialog][aria-label="The Guide"]').innerText,last:qa.calls.at(-1)}));assert.notEqual(separation.first,separation.second);assert.ok(!separation.visible.includes('FIRST_SECRET'));assert.ok(!JSON.stringify(separation.last.messages).includes('FIRST_SECRET'));assert.ok(separation.visible.includes('SECOND_SECRET'));
 await page.screenshot({path:out+'/npc.png'});
 await page.evaluate(()=>L99Island.guide.showArchive('FIRST_SECRET_0'));
 const archive=await page.evaluate(()=>({hits:L99Island.guide.archive.search('FIRST_SECRET_0'),partner:L99Island.guide.partner(),visible:document.querySelector('[role=dialog][aria-label="The Guide"]').innerText,messageVisible:!!document.querySelector('[aria-label="Message the guide"]').getBoundingClientRect().width}));assert.equal(archive.hits.length,1);assert.equal(archive.partner,null);assert.equal(archive.messageVisible,false);assert.ok(archive.visible.includes('FIRST_SECRET_0'));
 await page.screenshot({path:out+'/archive.png'});
 await page.evaluate(()=>L99Island.guide.showArchive('',qa.first));
 assert.equal(await page.evaluate(()=>L99Island.guide.partner()),null);
 await page.evaluate(()=>L99Island.guide.talkTo(qa.actors[0]));assert.ok((await page.locator('[role=dialog][aria-label="The Guide"]').innerText()).includes('FIRST_SECRET_19'));assert.ok(!(await page.locator('[role=dialog][aria-label="The Guide"]').innerText()).includes('SECOND_SECRET'));
 // A pending guide response must neither paint the new NPC nor execute quest tags.
 const stale=await page.evaluate(async()=>{const g=L99Island.guide;g.endTalk();qa.defer=true;qa.pending=g.ask('Tell me a story about the sea.');await Promise.resolve();if(!qa.release)throw Error('No pending guide request');const before=g.quests().length;g.talkTo(qa.actors[1]);qa.release('STALE_GUIDE_REPLY [[quest: the island peak]]');await qa.pending;qa.defer=false;return {before,after:g.quests().length,visible:document.querySelector('[role=dialog][aria-label="The Guide"]').innerText,archived:g.archive.search('STALE_GUIDE_REPLY')};});assert.equal(stale.before,stale.after);assert.ok(!stale.visible.includes('STALE_GUIDE_REPLY'));assert.equal(stale.archived.length,0);
 await page.getByRole('button',{name:'Model settings',exact:true}).click();
 await page.getByLabel('Language',{exact:true}).selectOption('mature');await page.getByLabel('Personality',{exact:true}).selectOption('bold');await page.getByLabel('Replies',{exact:true}).selectOption('rich');
 await page.screenshot({path:out+'/settings.png'});
 const settingsView=await page.evaluate(()=>{const p=document.querySelector('[role=dialog][aria-label="The Guide"]');return {message:!!p.querySelector('[aria-label="Message the guide"]').getBoundingClientRect().width,log:!!p.querySelector('[aria-live]').getBoundingClientRect().width};});assert.equal(settingsView.message,false);assert.equal(settingsView.log,false);
 const layout=await page.evaluate(()=>{const p=document.querySelector('[role=dialog][aria-label="The Guide"]');return {panel:p.getBoundingClientRect().toJSON(),overflow:p.scrollWidth>p.clientWidth+1,controls:[...p.querySelectorAll('select')].map(e=>({label:e.getAttribute('aria-label'),rect:e.getBoundingClientRect().toJSON()}))};});assert.ok(!layout.overflow);assert.ok(layout.panel.top>=0&&layout.panel.bottom<=320.5);for(const c of layout.controls)assert.ok(c.rect.left>=0&&c.rect.right<=480.5);
 await page.getByRole('button',{name:'Model settings',exact:true}).click();
 assert.ok((await page.locator('[role=dialog][aria-label="The Guide"]').innerText()).includes('SECOND_SECRET'));assert.ok(!(await page.locator('[role=dialog][aria-label="The Guide"]').innerText()).includes('FIRST_SECRET'));
 await page.evaluate(async()=>{qa.reply='Styled reply';await L99Island.guide.ask('Tell me a tale about your hardest winter.');});
 const styled=await page.evaluate(()=>({last:qa.calls.at(-1),saved:JSON.parse(localStorage.getItem('crysis-dialogue-style'))}));assert.deepEqual(styled.saved,{tone:'mature',vividness:'bold',response:'rich'});assert.deepEqual(styled.last.opts.npc.dialogueStyle,styled.saved);assert.match(styled.last.messages[0].content,/profanity/i);
 const ids=await page.evaluate(()=>({first:qa.first,second:qa.second}));await page.reload({waitUntil:'domcontentloaded'});await boot();
 const reload=await page.evaluate(ids=>({first:L99Island.guide.archive.thread(ids.first),second:L99Island.guide.archive.thread(ids.second),style:JSON.parse(localStorage.getItem('crysis-dialogue-style'))}),ids);assert.ok(reload.first.turns.some(t=>t.content.includes('FIRST_SECRET_0')));assert.ok(!reload.second.turns.some(t=>t.content.includes('FIRST_SECRET')));assert.deepEqual(reload.style,styled.saved);assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/report.json',JSON.stringify({transport:'deterministic model replies; real game/UI and localStorage',retained,separation,archive,stale,layout,styled,reload,errors},null,2));console.log('Dialogue isolation, complete searchable archive, stale-response guard, tone controls and true reload passed',out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
