// Built game smoke: actual input listeners, weapon view, melee and menu cancellation.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'), out=process.env.BARD_RESPONSE_OUT||'/tmp/bard-combat-response'; await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',f.endsWith('.js')||f.endsWith('.mjs')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser,page;const report={checks:[],errors:[]};const mark=(name,data)=>{report.checks.push({name,data});console.log('PASS',name,JSON.stringify(data||{}));};
 report.bundleSha256=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'island/dist/island.js'))).digest('hex');
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],env:{...process.env,...(process.env.CHROME_EXECUTABLE?{LD_LIBRARY_PATH:path.dirname(process.env.CHROME_EXECUTABLE)}:{})}});
  page=await browser.newPage({viewport:{width:640,height:420},hasTouch:true,isMobile:true});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGEERROR',e.message)});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?offline&safe&lite',{waitUntil:'domcontentloaded'});console.log('BOOT');
  await page.evaluate(async()=>{const a=await L99IslandDoor.engine();await a.open({seed:1337,earth:false});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;Crysis.combat.ambient(false);});
  await page.getByRole('button',{name:'Enter world',exact:true}).tap();
  await page.waitForFunction(()=>Crysis.combat.melee.info().active&&!L99Loading.active());
  const immediate=await page.evaluate(()=>{dispatchEvent(new KeyboardEvent('keydown',{key:'q',bubbles:true}));const s=Crysis.combat.melee.info();dispatchEvent(new KeyboardEvent('keyup',{key:'q',bubbles:true}));return{move:s.move,phase:s.phase};});assert.equal(immediate.move,'jab');mark('Q starts jab synchronously inside keydown',immediate);
  await page.waitForFunction(()=>!Crysis.combat.melee.info().move);
  await page.keyboard.down('Shift');await page.keyboard.down('q');assert.equal(await page.evaluate(()=>Crysis.combat.melee.state.charging),true);await page.keyboard.up('q');await page.keyboard.up('Shift');mark('Shift+Q charges heavy until release');
  await page.evaluate(()=>Crysis.combat.arm('aurora-trail-rifle',1,0));await page.waitForFunction(()=>Crysis.weapon.state().ready&&Crysis.viewmodel().equip>.95&&Crysis.combat.info().weapon?.mag>0);
  const before=await page.evaluate(()=>Crysis.combat.info().weapon.shots);
  await page.evaluate(()=>{const b=document.querySelector('.cb-btn[aria-label="Fire"]');for(const type of ['pointerdown','pointerup'])b.dispatchEvent(new PointerEvent(type,{pointerType:'touch',pointerId:31,bubbles:true,cancelable:true}));});
  await page.waitForFunction(n=>Crysis.combat.info().weapon.shots===n+1,before);mark('touch press and release in one JS task produces exactly one real shot',await page.evaluate(()=>Crysis.combat.info().weapon));
  await page.keyboard.press('i');await page.waitForFunction(()=>Crysis.gear().open);
  const menuShots=await page.evaluate(()=>Crysis.combat.info().weapon.shots);
  await page.evaluate(()=>{const b=document.querySelector('.cb-btn[aria-label="Fire"]');for(const type of ['pointerdown','pointerup'])b.dispatchEvent(new PointerEvent(type,{pointerType:'touch',pointerId:32,bubbles:true,cancelable:true}));});
  assert.equal(await page.evaluate(()=>Crysis.combat.info().weapon.shots),menuShots);mark('open inventory blocks firing');await page.keyboard.press('i');
  const frames=await page.evaluate(()=>Crysis.frameErrors());assert.deepEqual(frames,[]);assert.deepEqual(report.errors,[]);mark('built game runs without frame exceptions');
  await page.screenshot({path:path.join(out,'game.png')});report.passed=true;
 }catch(e){report.failure=String(e.stack||e);if(page){try{report.last=await page.evaluate(()=>({combat:window.Crysis?.combat?.info(),frames:window.Crysis?.frameErrors?.()}));await page.screenshot({path:path.join(out,'failure.png')});}catch{}}throw e;}finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
