// Real production bundle, walking collision, rendered cave and the cleansing controls.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../..'),out=process.env.BARD_SOUL_OUT||path.join(root,'docs/verification/persistent-reputation');await fs.mkdir(out,{recursive:true});
 const {Soul}=await import('../../server/multiplayer/src/soul.js'),{handle}=await import('../../server/multiplayer/src/index.js');
 const souls=new Map(),env={SOULS:{idFromName:id=>id,get(id){if(!souls.has(id)){const m=new Map();souls.set(id,new Soul({storage:{get:async k=>structuredClone(m.get(k)),put:async (o,value)=>{if(typeof o==='string')m.set(o,structuredClone(value));else for(const[k,v]of Object.entries(o))m.set(k,structuredClone(v));}}}));}return souls.get(id);}}};
 const backend=http.createServer(async(req,res)=>{try{const body=[];for await(const b of req)body.push(b);const r=await handle(new Request('http://local'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(body)}:{})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.statusCode=500;res.end(e.message);}});await new Promise(r=>backend.listen(0,'127.0.0.1',r));
 const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',/\.[cm]?js$/.test(f)?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const report={method:'Production bundle in Chromium software WebGL with touch emulation, actual player collision and authenticated local server handler; separate workerd socket test. Not physical Safari.',errors:[]};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/root/.cache/ms-playwright/chromium_headless_shell-1161/chrome-linux/headless_shell',args:['--no-sandbox','--single-process','--no-zygote','--in-process-gpu','--disable-gpu-sandbox','--disable-features=AudioServiceOutOfProcess,AudioServiceSandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:640,height:420},hasTouch:true});page.setDefaultTimeout(300000);
  page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(/THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(m.text()))report.errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/island/dev.html?planet=SINGULARITY&seed=2281969&safe&rooms=http://127.0.0.1:'+backend.address().port,{waitUntil:'domcontentloaded'});
  console.log('Standalone engine page loaded');
  await page.waitForFunction(()=>!!window.L99Island?.world()?.soulWell,null,{timeout:300000});
  await page.evaluate(()=>{Crysis.music.auto(false);window._KEYS_PLAY_ON=false;Crysis.combat.ambient(false);});
  const enter=page.getByRole('button',{name:'Enter world',exact:true});await enter.waitFor({state:'visible'});await enter.click();await page.waitForFunction(()=>!window.L99Loading.active());
  console.log('Gargantua island loaded');
  report.walk=await page.evaluate(async()=>{
   const a=L99Island,W=a.world(),u=W.underworld,P=W.player.state,camera=a.camera(),e=u.plan.soul.entrance,pts=e.tunnel.pts;const start={x:pts[0].x+5,z:0};
   P.pos.set(start.x,W.island.heightAt(start.x,0)+1.68,0);P.vel.set(0,0,0);P.flying=false;P.locked=false;P.swimming=false;camera.position.copy(P.pos);
   let time=0,frames=0,maxStep=0;
   for(let n=0;n<1600&&!u.ready(0);n++)u.update(1/60,time+=1/60);if(!u.ready(0))throw Error('Mouth did not open');
   for(const q of pts.slice(0,-1)){let count=0;while(Math.hypot(q.x-P.pos.x,q.z-P.pos.z)>.7){const old=P.pos.clone();P.yaw=Math.atan2(-(q.x-P.pos.x),-(q.z-P.pos.z));P.auto={x:0,z:-1,run:true};W.player.update(1/60,time+=1/60);u.update(1/60,time);frames++;maxStep=Math.max(maxStep,old.distanceTo(P.pos));if(++count>700)throw Error('Walk blocked '+JSON.stringify({target:q,pos:P.pos.toArray()}));if(frames%180===0)await new Promise(r=>setTimeout(r,0));}}
   for(let i=0;i<12;i++){P.auto={x:0,z:-1,run:false};W.player.update(1/60,time+=1/60);u.update(1/60,time);}
   P.auto=null;P.vel.set(0,0,0);P.yaw=Math.PI/2;P.pitch=-.55;camera.position.copy(P.pos);camera.rotation.set(P.pitch,P.yaw,0,'YXZ');u.settle();u.update(.016,time);W.soulWell.update(.016,time);a.renderer().render(a.scene(),camera);
   return{frames,maxStep,position:P.pos.toArray(),depth:W.island.heightAt(P.pos.x,P.pos.z)-P.pos.y,inside:u.inside(),well:W.soulWell.info(),sameWorld:W===a.world()};
  });
  assert.ok(report.walk.sameWorld&&report.walk.depth>15&&report.walk.maxStep<1);console.log('Walked to the well',JSON.stringify(report.walk));
  // Record through the actual production morality entry point, then use only the public UI.
  await page.evaluate(()=>{Crysis.combat.morality.record({id:'browser-favour',kind:'favour',world:'w2281969',target:'the keeper'});Crysis.combat.morality.record({id:'browser-robbery',kind:'robbery',world:'w2281969',target:'a traveller'});});
  await page.waitForFunction(()=>Crysis.reputation().pending===0&&Crysis.reputation().me.deeds===2);
  report.before=await page.evaluate(()=>Crysis.reputation());assert.notEqual(report.before.me.law,0);
  await page.evaluate(()=>L99Island.guide.showStory());
  report.story=await page.locator('[role=dialog][aria-label="The Guide"]').innerText();
  assert.match(report.story,/does not fade/);
  await page.evaluate(()=>L99Island.guide.show(false));
  await page.screenshot({path:out+'/quiet-well-landscape.png',timeout:300000});
  await page.getByRole('button',{name:'Cleanse your soul',exact:true}).click({timeout:15000});
  await page.getByRole('button',{name:'Reset all standing · begin ritual',exact:true}).click({timeout:15000});
  await page.waitForFunction(()=>Crysis.reputation().epoch===1,null,{timeout:45000});report.cleanse=await page.evaluate(()=>Crysis.reputation());assert.equal(report.cleanse.me.deeds,0);assert.equal(report.cleanse.lifetime,2);console.log('Cleansing committed');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/quiet-well-portrait.png',timeout:300000});
  const bounds=await page.getByRole('button',{name:'Cleanse your soul',exact:true}).boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=390);report.portraitButton=bounds;
  report.render=await page.evaluate(()=>{const r=L99Island.renderer(),gl=r.getContext();return{lost:gl.isContextLost(),programs:r.info.programs.map(p=>({runnable:p.diagnostics?.runnable!==false})),triangles:r.info.render.triangles};});assert.equal(report.render.lost,false);assert.ok(report.render.programs.every(p=>p.runnable));assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=e.message;throw e;}finally{await fs.writeFile(out+'/browser-report.json',JSON.stringify(report,null,2));await browser?.close();server.close();backend.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
