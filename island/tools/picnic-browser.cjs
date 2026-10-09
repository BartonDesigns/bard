// Real WebGL bodies, held models, sound and encounter lifecycle in the review clearing.
// First bundle picnic-preview-entry.mjs to dist/picnic-preview.js. Requires Playwright.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const server=http.createServer(async(req,res)=>{try{
  const name=new URL(req.url,'http://local').pathname;
  if(name==='/'){res.setHeader('Content-Type','text/html');res.end('<html></html>');return;}
  const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('path');
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:process.env.CHROMIUM_ARGS?JSON.parse(process.env.CHROMIUM_ARGS):['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.setContent('<script type="module" src="/island/dist/picnic-preview.js"></script>');
  await page.waitForFunction(()=>window.PICNIC_READY,{},{timeout:120000});
  await page.click('body',{position:{x:12,y:12}});
  await page.evaluate(()=>{for(let i=0;i<120;i++)preview.frame(1/30,false);});
const checks=await page.evaluate(async()=>{
 const assert=(k,b)=>{if(!b)throw new Error(k);return k;},passed=[];
 const p=preview.picnic;passed.push(assert('Cancelled asynchronous load cannot add actors',await preview.checkCancellation()));
 let s=p.inspect();passed.push(assert('Eight adult performers, two distinct armaments',s.ready&&s.actors.length===8&&s.actors.every(a=>a.age>=18)&&new Set(s.actors.filter(a=>a.item).map(a=>a.item)).size===2));
 passed.push(assert('Both shooters fired; muzzles point upward',s.actors.filter(a=>a.role==='sky-shot').every(a=>a.shots>0&&a.muzzleY>.9)));
 preview.view(-3,4,5);preview.frame(.1,false);
 const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('rhythm'));button.click();
 passed.push(assert('Nearby rhythm interaction toggles',p.inspect().joined));
 for(let i=0;i<5;i++)preview.frame(.1,false);
 passed.push(assert('Original music reaches the world sound bus',p.inspect().voices>0));
 p.pause();passed.push(assert('Pause silences music and interaction',p.inspect().voices===0&&!p.inspect().joined&&button.hidden));
 const at=p.inspect().at,q={x:at.x+Math.SQRT1_2*2.4,z:at.z+Math.SQRT1_2*2.4};p.push(q,at.y);
 passed.push(assert('Seated bodies block walking',Math.hypot(q.x-at.x-Math.SQRT1_2*2.4,q.z-at.z-Math.SQRT1_2*2.4)>.5));
 passed.push(assert('All eight begin on the rug with varied floor poses',s.actors.every(a=>a.hipY>.08&&a.hipY<.25)&&new Set(s.actors.map(a=>a.pose)).size>=5));
 const home=s.actors[0].position;let furthest=0,highest=0,previous=home,largestStep=0,feetAbove=true;
 while(p.inspect().elapsed<25.5){
  preview.frame(1/30,false);const people=p.inspect().actors,a=people[0];
  furthest=Math.max(furthest,Math.hypot(a.position[0]-home[0],a.position[2]-home[2]));highest=Math.max(highest,a.hipY);
  largestStep=Math.max(largestStep,Math.hypot(a.position[0]-previous[0],a.position[2]-previous[2]));previous=a.position;
  feetAbove&&=people.every(v=>v.feet.every(h=>Number.isFinite(h)&&h>.025));
 }
 let returned=p.inspect().actors[0];
 passed.push(assert('A friend stands, takes real steps and returns without teleporting',highest>.65&&furthest>.3&&largestStep<.04));
 passed.push(assert('Feet remain above the rug and the friend settles back on the floor',feetAbove&&returned.hipY<.25&&returned.seated>.98&&Math.hypot(returned.position[0]-home[0],returned.position[2]-home[2])<.1));
 while(p.inspect().elapsed<40.1)preview.frame(1/30,false);
 const beforeMove=p.inspect().actors[2].shots;
 while(p.inspect().elapsed<44.3)preview.frame(1/30,false);
 passed.push(assert('A shooter pauses firing while rising and shuffling',p.inspect().actors[2].shots===beforeMove));
 preview.world().globe.frame.epoch++;preview.frame(.1,false);passed.push(assert('Origin shift clears scene and sound',!p.inspect().active&&p.inspect().voices===0));
 passed.push(assert('Can summon again after cleanup',await p.summon({x:0,z:0})));
 preview.replaceWorld();preview.frame(.1,false);passed.push(assert('Changing worlds clears the encounter',!p.inspect().active));
 await p.summon({x:0,z:0});preview.view(120,4,0);preview.frame(.1,false);passed.push(assert('Distance teardown removes the encounter',!p.inspect().active));
 p.dispose();passed.push(assert('Dispose removes its contextual button',!button.isConnected));
 return passed;
});

  assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
