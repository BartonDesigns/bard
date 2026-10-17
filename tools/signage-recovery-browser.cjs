const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const esbuild=require('../island/node_modules/esbuild');
(async()=>{
 const root=path.resolve(__dirname,'..'), result={};
 const fixture=await esbuild.build({entryPoints:[path.join(root,'island/tools/signage-recovery-entry.js')],bundle:true,format:'esm',write:false,logLevel:'silent'});
 const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://local');
  if(u.pathname==='/fixture'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><script src="/loading-screen.js"></script>');return;}
  if(u.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(fixture.outputFiles[0].text);return;}
  const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(await fs.readFile(f));
 }catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],env:{...process.env,...(process.env.CHROME_EXECUTABLE?{LD_LIBRARY_PATH:path.dirname(process.env.CHROME_EXECUTABLE)}:{})}});
  const page=await browser.newPage(), errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/shader failed|Shader Error|program not valid/.test(m.text()))errors.push(m.text());});
  const url='http://127.0.0.1:'+server.address().port+'/fixture';await page.goto(url);
  result.shaders=await page.evaluate(async()=>await(await import('/fixture.js')).compileSigns());
  assert.equal(result.shaders.lost,false);assert.equal(result.shaders.compact,8);assert.ok(result.shaders.lite<result.shaders.full*.35);
  const brightness=p=>p.slice(0,3).reduce((a,b)=>a+b,0);assert.ok(brightness(result.shaders.headlit)>brightness(result.shaders.dark)+100);assert.ok(brightness(result.shaders.back)<brightness(result.shaders.headlit)*.5);
  console.log('PASS signage shaders',JSON.stringify(result.shaders));
  await page.goto(url);await page.evaluate(async()=>{localStorage.clear();window.game=(await import('/island/dist/island.js')).island();(await import('/fixture.js')).addSigns(game.scene());game.camera().position.set(55590,174,-940);game.camera().lookAt(55590,174,-945);game.renderer().render(game.scene(),game.camera());});
  const lose=async()=>{
   await page.evaluate(()=>{window.restored=false;const r=game.renderer();r.domElement.addEventListener('webglcontextrestored',()=>restored=true,{once:true});const ext=r.getContext().getExtension('WEBGL_lose_context');ext.loseContext();setTimeout(()=>ext.restoreContext(),100);});
   await page.waitForFunction(()=>restored&&!game.renderer().getContext().isContextLost());
  };
  await lose();result.first=await page.evaluate(()=>{game.renderer().render(game.scene(),game.camera());return{compact:game.scene().children.filter(m=>m.material?.userData.signage?.compact).length,frames:game.renderer().info.render.frame};});assert.equal(result.first.compact,8);assert.ok(result.first.frames>0);
  await page.evaluate(()=>{L99Loading.run(()=>new Promise(r=>window.finishLoading=r));});await page.waitForFunction(()=>typeof finishLoading==='function');
  await lose();await page.getByRole('button',{name:'Reload game',exact:true}).waitFor();
  result.second=await page.evaluate(()=>{let blocked='';try{game.renderer().render(game.scene(),game.camera());}catch(e){blocked=e.code;}L99Loading.stage('Late loading update');finishLoading();return{blocked,frames:game.renderer().info.render.frame,remembered:!!localStorage.getItem('l99-signage-lite')};});
  await page.waitForFunction(()=>!L99Loading.pending);assert.equal(result.second.blocked,'GRAPHICS_RELOAD_REQUIRED');assert.equal(result.second.frames,0);assert.equal(result.second.remembered,true);
  assert.equal(await page.getByRole('button',{name:'Enter world',exact:true}).count(),0);assert.deepEqual(errors,[]);
  await page.getByText('Graphics need a fresh start',{exact:true}).waitFor();
  const reload=page.waitForEvent('framenavigated');await page.getByRole('button',{name:'Reload game',exact:true}).click();await reload;
  console.log('PASS recovery first restoration draws compact signs; second reset blocks rendering and keeps Reload game through late loading completion');
  await page.waitForFunction(()=>!!window.L99Loading);
  await page.evaluate(async()=>{let attempts=0;await L99Loading.run(()=>{if(++attempts===1)throw Error('Test connection failure');return true;});});
  await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('button',{name:'Enter world',exact:true}).click();
  assert.equal(await page.evaluate(()=>L99Loading.active()),false);assert.deepEqual(errors,[]);
  console.log('PASS ordinary loading failure still retries and enters normally');
  result.passed=true;await fs.writeFile('/tmp/bard-signage-recovery.json',JSON.stringify(result,null,2));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
