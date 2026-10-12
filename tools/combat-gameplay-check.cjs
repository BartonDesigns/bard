// Production game input and lifecycle checks. Use the shared /tmp/bard-browser.lock.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=process.env.BARD_QA_OUT||'/tmp/bard-combat-gameplay';await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',f.endsWith('.js')||f.endsWith('.mjs')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;const report={checks:[],errors:[],method:'production bundle, real mouse/keyboard, Chromium software WebGL'};
 const passed=(name,data)=>{report.checks.push({name,data});console.log('PASS',name,JSON.stringify(data||{}));};
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')});
  const page=await browser.newPage({viewport:{width:640,height:420}});page.setDefaultTimeout(300000);
  page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGEERROR',e.message);});page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/.test(m.text()))report.errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/?offline&safe&lite',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{const a=await L99IslandDoor.engine();await a.open({seed:1337,earth:false});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;Crysis.combat.ambient(false);Crysis.combat.arm('warden-spark-carbine',1,0);});
  await page.waitForFunction(()=>Crysis.weapon.state().ready&&Crysis.combat.info().weapon?.mag===24);
  const box=await page.locator('#l99-island-mount canvas').first().boundingBox();assert.ok(box);const x=box.x+box.width*.5,y=box.y+box.height*.5;
  const before=await page.evaluate(()=>Crysis.combat.info().weapon);
  await page.mouse.move(x,y);await page.mouse.down();await page.waitForFunction(()=>Crysis.combat.info().weapon.mag<24);await page.mouse.up();
  const fired=await page.evaluate(()=>Crysis.combat.info().weapon);assert.ok(fired.mag<before.mag);passed('real canvas input spends ammunition',fired);
  await page.keyboard.press('r');await page.waitForFunction(()=>Crysis.combat.info().weapon.reloading);await page.waitForFunction(()=>!Crysis.combat.info().weapon.reloading&&Crysis.combat.info().weapon.mag===24);
  const reloaded=await page.evaluate(()=>Crysis.combat.info().weapon);assert.ok(reloaded.reserve<before.reserve);passed('R reload consumes reserve and fills magazine',reloaded);
  await page.mouse.down({button:'right'});await page.waitForFunction(()=>Crysis.weapon.state().aiming);const layout=await page.evaluate(()=>({hp:document.querySelector('.cb-hp').getBoundingClientRect().toJSON(),ammo:document.querySelector('.cb-ammo').getBoundingClientRect().toJSON()}));assert.ok(layout.hp.bottom<=layout.ammo.top,'health and ammo rows do not overlap');passed('health and ammo occupy separate rows',layout);await page.screenshot({path:out+'/first-person-aim.png'});await page.mouse.up({button:'right'});await page.waitForFunction(()=>!Crysis.weapon.state().aiming);passed('right mouse aims and releases sights');
  await page.keyboard.press('p');await page.waitForFunction(()=>Crysis.weapon.state().third&&Crysis.weapon.state().ready);await page.mouse.down({button:'right'});await page.waitForFunction(()=>Crysis.weapon.state().aiming);await page.screenshot({path:out+'/third-person-aim.png'});await page.mouse.up({button:'right'});await page.waitForFunction(()=>!Crysis.weapon.state().aiming);await page.keyboard.press('p');await page.waitForFunction(()=>!Crysis.weapon.state().third&&Crysis.weapon.state().ready);passed('P third-person view supports real right-mouse aiming');
  await page.mouse.down();await page.waitForFunction(()=>Crysis.combat.info().weapon.mag<24);await page.keyboard.press('i');await page.waitForFunction(()=>Crysis.gear().open);
  const paused=await page.evaluate(()=>({mag:Crysis.combat.info().weapon.mag,frame:L99Island.renderer().info.render.frame}));
  await page.waitForFunction(f=>L99Island.renderer().info.render.frame>=f+3,paused.frame);await page.mouse.up();
  const afterMenu=await page.evaluate(()=>Crysis.combat.info().weapon.mag);assert.equal(afterMenu,paused.mag);await page.keyboard.press('r');
  assert.equal(await page.evaluate(()=>Crysis.combat.info().weapon.reloading),false);passed('gear menu suppresses held fire and reload',{mag:afterMenu});
  await page.keyboard.press('i');await page.waitForFunction(()=>!Crysis.gear().open);
  await page.evaluate(()=>{window.combatPending=Crysis.combat.spawn('ashfang',3);L99Island.close();});
  await page.evaluate(()=>window.combatPending);
  const closed=await page.evaluate(()=>({info:Crysis.combat.info(),active:L99Island.active(),combatGroup:L99Island.scene().children.some(c=>c.name==='combat'),hud:[...document.querySelectorAll('[class]')].filter(e=>e.classList.contains('cb-hud')).map(e=>getComputedStyle(e).display)}));
  assert.deepEqual(closed.hud,['none']);assert.equal(closed.active,false);assert.equal(closed.combatGroup,false);assert.equal(closed.info.layer,0);assert.equal(closed.info.squads.alive,0);assert.equal(closed.info.squads.queue,0);passed('close cancels asynchronous squad work and detaches combat',closed);
  await page.evaluate(async()=>{await L99Island.open({seed:1337,earth:false});Crysis.combat.ambient(false);});await page.waitForFunction(()=>Crysis.weapon.state().ready);passed('reopen restores the cached held model');
  await page.evaluate(async()=>{window.combatPending=Crysis.combat.spawn('ashfang',3);await L99Island.open({seed:1338,earth:false});Crysis.combat.ambient(false);await window.combatPending;});
  await page.waitForFunction(()=>Crysis.combat.info().squads.alive===0&&Crysis.combat.info().squads.queue===0);
  const travel=await page.evaluate(()=>({info:Crysis.combat.info(),lost:L99Island.renderer().getContext().isContextLost(),programs:L99Island.renderer().info.programs.map(p=>p.diagnostics?.runnable!==false)}));assert.equal(travel.lost,false);assert.ok(travel.programs.every(Boolean));passed('travel cancels old squad builds without breaking render resources',travel.info.squads);
  await page.screenshot({path:out+'/after-travel.png'});assert.deepEqual(report.errors,[]);report.passed=true;
 } finally {await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
