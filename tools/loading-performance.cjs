// Production desktop loading and frame samples; software WebGL is not a hardware FPS claim.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'), report={errors:[],graphicsWarnings:[]}, out=process.env.BARD_PERF_OUT||'/tmp/bard-loading-performance.json';
 const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream');res.end(await fs.readFile(f));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser,page;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],env:{...process.env,...(process.env.CHROME_EXECUTABLE?{LD_LIBRARY_PATH:path.dirname(process.env.CHROME_EXECUTABLE)}:{})}});
  page=await browser.newPage({viewport:{width:640,height:420},deviceScaleFactor:2});page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(/vertexAlphas|already non-indexed|\[shader failed\]|program not valid|\[shaders\]/.test(m.text()))report.graphicsWarnings.push(m.text());});
  await page.addInitScript(()=>{window.longTasks=[];new PerformanceObserver(l=>{for(const e of l.getEntries())longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?offline',{waitUntil:'domcontentloaded'});console.log('BOOT');
  report.loading=await page.evaluate(async earth=>{localStorage.setItem('crysis-guide-model',JSON.stringify({kind:'none'}));const t=performance.now(),a=await L99IslandDoor.engine(),engine=performance.now()-t;await a.open({seed:1337,earth});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;Crysis.combat.ambient(false);return{engineMs:engine,worldMs:performance.now()-t-engine,readyMs:performance.now()-t};},process.env.BARD_TEST_EARTH==='1');console.log('READY',JSON.stringify(report.loading));
  await page.getByRole('button',{name:'Enter world',exact:true}).click();
  report.play=await page.evaluate(async()=>{const samples=[];let last=performance.now();for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;}const r=L99Island.renderer(),gl=r.getContext();return{frames:samples,governor:Crysis.governor(),draw:r.info.render,programs:r.info.programs.length,buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],antialias:gl.getContextAttributes().antialias,lost:gl.isContextLost(),maxLongTask:Math.max(0,...longTasks),frameErrors:Crysis.frameErrors()};});
  assert.equal(report.play.lost,false);assert.deepEqual(report.play.frameErrors,[]);assert.deepEqual(report.errors,[]);console.log('PLAY',JSON.stringify(report.play));
  if(process.env.BARD_TEST_RESTORE==='1'){
   await page.evaluate(()=>{window.restoreDone=false;const r=L99Island.renderer();r.domElement.addEventListener('webglcontextrestored',()=>restoreDone=true,{once:true});const ext=r.getContext().getExtension('WEBGL_lose_context');ext.loseContext();setTimeout(()=>ext.restoreContext(),500);});
   await page.waitForFunction(()=>restoreDone&&!L99Island.renderer().getContext().isContextLost());
   const f=await page.evaluate(()=>L99Island.renderer().info.render.frame);await page.waitForFunction(n=>L99Island.renderer().info.render.frame>n+2,f);
   report.restored=await page.evaluate(()=>({quality:Crysis.governor(),errors:Crysis.frameErrors(),world:!!L99Island.world()}));assert.deepEqual(report.restored.errors,[]);assert.equal(report.restored.world,true);console.log('RESTORED');
  }
  for(const icon of ['/favicon.ico','/favicon.svg'])assert.equal((await page.request.get('http://127.0.0.1:'+server.address().port+icon)).status(),200);
  assert.deepEqual(report.graphicsWarnings,[]);assert.deepEqual(report.errors,[]);
  report.passed=true;
 }catch(e){report.failure=String(e.stack||e);throw e;}finally{await fs.writeFile(out,JSON.stringify(report,null,2));await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
