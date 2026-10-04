// Real player collision traversal; initial placement outside the mouth only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const out=process.env.BARD_CAVE_OUT||'/tmp/bard-cave-qa';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 try{
 const page=await browser.newPage({viewport:process.env.BARD_CAVE_PHONE?{width:390,height:844}:{width:900,height:600},hasTouch:!!process.env.BARD_CAVE_PHONE});page.setDefaultTimeout(300000);
 const errors=[],shaderErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(m.text()))shaderErrors.push(m.text());});
 await page.goto((process.env.BARD_URL||'http://127.0.0.1:8766')+'/?offline&safe',{waitUntil:'domcontentloaded'});
 const entryURL=page.url();
 const entryBounds=await page.locator('#caves-btn').boundingBox();
 assert.ok(entryBounds&&entryBounds.width>0&&entryBounds.x>=0&&entryBounds.x+entryBounds.width<=page.viewportSize().width,'cave door must fit the viewport');
 await page.locator('#caves-btn').click({timeout:60000});
 console.log('Clicked faceplate caves door');
 await page.waitForFunction(()=>!!window.L99Island?.world()?.underworld,{},{timeout:90000});
 await page.getByRole('button',{name:/Look toward/}).first().waitFor({timeout:30000});
 console.log('Native cave guidance opened');
 assert.equal(page.url(),entryURL,'faceplate cave door must keep the same URL');
 await page.evaluate(async()=>{const a=await L99IslandDoor.engine();await a.open({seed:1337,earth:true});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;a.close();a.dom.mount.style.display='block';});
 const report=await page.evaluate(async()=>{
 const a=L99Island,W=a.world(),u=W.underworld,p=W.player.state,camera=a.camera(),scene=a.scene(),url=location.href,ctx=window.audioCtx||window.ctx||window._masterClip?.context;
 if(!u?.plan?.entrances.length)throw Error('Earth has no procedural cave entrances');
 const e=u.plan.entrances[0],pts=e.tunnel.pts;
 const start={x:pts[0].x-e.dir.x*6,z:pts[0].z-e.dir.z*6};
 p.pos.set(start.x,W.island.heightAt(start.x,start.z)+1.68,start.z);p.vel.set(0,0,0);p.flying=false;p.locked=false;p.swimming=false;camera.position.copy(p.pos);
 let time=0,steps=0,maxStep=0,maxDepth=0;
 const tick=()=>{const old=p.pos.clone();W.player.update(1/60,time+=1/60);u.update(1/60,time);maxStep=Math.max(maxStep,p.pos.distanceTo(old));maxDepth=Math.max(maxDepth,W.island.heightAt(p.pos.x,p.pos.z)-p.pos.y);steps++;};
 for(let i=0;i<2000&&!u.ready(0);i++)u.update(1/60,time+=1/60);
 if(!u.ready(0))throw Error('Entrance never became ready');
 async function walk(target){
  let frames=0;
  while(Math.hypot(target.x-p.pos.x,target.z-p.pos.z)>0.65){
   p.yaw=Math.atan2(-(target.x-p.pos.x),-(target.z-p.pos.z));p.auto={x:0,z:-1,run:false};tick();
   if(++frames>900)throw Error('Blocked walking at '+JSON.stringify({target,pos:p.pos.toArray(),floor:W.player.floorAt(p.pos.x,p.pos.z,p.pos.y-1.68)}));
   if(frames%120===0)await new Promise(r=>setTimeout(r,0));
  }
 }
 for(const q of pts)await walk(q);
 p.auto=null;u.settle();u.update(1/60,time);a.renderer().render(scene,camera);
 window.caveQA={a,W,u,p,camera,scene};
 const deep={position:p.pos.toArray(),inside:u.inside(),depth:maxDepth,stats:u.stats()};
 window.caveQA.deep=deep;
 // Preserve this frame for a screenshot before walking back.
 window.caveQA.returnTrip=async()=>{for(const q of [...pts].reverse())await walk(q);await walk(start);p.auto=null;for(let i=0;i<180;i++)tick();a.renderer().render(scene,camera);return{deep,steps,maxStep,returned:p.pos.toArray(),surface:W.island.heightAt(p.pos.x,p.pos.z),inside:u.inside(),sameWorld:a.world()===W,sameScene:a.scene()===scene,sameURL:location.href===url,audioPresent:!!ctx,sameAudio:(window.audioCtx||window.ctx||window._masterClip?.context)===ctx,loading:a.dom.loading.style.display,stats:u.stats()};};
 return deep;
 });
 assert.ok(report.depth>8);await page.screenshot({path:out+'/underground.png'});
 const result=await page.evaluate(()=>caveQA.returnTrip());
 const door=await page.evaluate(async()=>{const a=L99Island,W=a.world(),s=a.scene(),p=W.player.state.pos.clone(),iframes=document.querySelectorAll('iframe').length;await a.exploreCaves();const result={sameWorld:a.world()===W,sameScene:a.scene()===s,samePosition:p.distanceTo(W.player.state.pos)<.1,sameFrames:iframes===document.querySelectorAll('iframe').length,dialog:document.querySelector('[role=dialog][aria-label=\"The Guide\"]')?.innerText};a.close();a.dom.mount.style.display='block';return result;});assert.ok(door.sameWorld&&door.sameScene&&door.samePosition&&door.sameFrames);
 result.cavesDoor=door;
 assert.ok(result.sameWorld&&result.sameScene&&result.sameURL&&result.sameAudio);assert.ok(result.inside<0.1);assert.ok(Math.abs(result.returned[1]-result.surface-1.68)<1);assert.ok(result.maxStep<1);assert.equal(result.loading,'none');
 await page.screenshot({path:out+'/surface-return.png'});assert.deepEqual(errors,[]);assert.deepEqual(shaderErrors,[]);
 fs.writeFileSync(out+'/report.json',JSON.stringify({mode:'real player.update walking along seeded tunnel path, no cave teleport',entryBounds,result,errors,shaderErrors},null,2));console.log('Cave continuous Earth traversal passed',out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
