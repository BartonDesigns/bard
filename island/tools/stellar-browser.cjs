// Native stellar entries, original Gargantua renderer, Held Note realm and lifecycle checks.
// First bundle stellar-preview-entry.mjs to dist/stellar-preview.js. Requires Playwright.
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
  const page=await browser.newPage({viewport:{width:640,height:400}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.setContent('<script type="module" src="/island/dist/stellar-preview.js"></script>');
  const out=process.env.STELLAR_REVIEW_DIR || require('node:os').tmpdir()+'/bard-stellar-review'; await fs.mkdir(out,{recursive:true});
  await page.waitForFunction(()=>window.STELLAR_READY,{},{timeout:120000});
const checks=[];const check=(name,ok)=>{checks.push({name,ok});if(!ok)throw Error(name);};
const save=async(name)=>fs.writeFile(out+'/'+name+'.png',Buffer.from((await page.evaluate(()=>stellar.png())).split(',')[1],'base64'));
let s=await page.evaluate(()=>stellar.go('sun',7));check('Sun old safety shell permits entry',!s.orbit.bouncing);await save('Sun-corona');
s=await page.evaluate(()=>stellar.go('sun',.93));check('Solar interior active with heat and no hard bounce',s.orbit.solarDepth>.8&&s.orbit.heat>.9&&!s.orbit.bouncing&&!s.locked);await save('Sun-interior');
check('Solar return button visible',await page.locator('[data-stellar-exit]').isVisible());await page.locator('[data-stellar-exit]').click();s=await page.evaluate(()=>stellar.advance(4));check('Solar warp returns to home orbit and clears heat',s.orbit.altitude<500000&&!s.orbit.warping&&s.orbit.solarDepth===0&&!s.locked);
await page.evaluate(()=>stellar.reset());s=await page.evaluate(()=>stellar.go('gargantua',7));check('Gargantua old tidal shell permits entry',!s.orbit.bouncing&&!s.orbit.horizon);await save('Gargantua-disk');
s=await page.evaluate(()=>stellar.go('gargantua',1.75));check('Photon ring starts controlled horizon crossing',s.locked&&!!s.orbit.horizon);await page.evaluate(()=>stellar.advance(2.5));await save('Gargantua-photon-ring');
await page.evaluate(()=>stellar.exit());s=await page.evaluate(()=>stellar.advance(4));check('Turning back cancels pending horizon entry',s.visits.length===0&&!s.locked&&s.orbit.altitude<500000);
await page.evaluate(()=>stellar.go('gargantua',1.75));s=await page.evaluate(()=>stellar.advance(5));check('Horizon opens existing Held Note realm',s.visits.length===1&&s.visits[0].beyond&&s.realm?.mode==='in'&&!s.locked);await save('Gargantua-held-note');
await page.getByRole('button',{name:'⟲ Leave the horizon'}).click();s=await page.evaluate(()=>stellar.advance(6));check('Existing realm exit returns to the Event Ring',s.realm.mode==='out'&&!s.locked&&s.position[1]<20);
await page.evaluate(()=>stellar.reset('pending'));await page.evaluate(()=>stellar.go('gargantua',1.75));s=await page.evaluate(()=>stellar.advance(3.4));check('Only one voyage request while loading',s.visits.length===1);s=await page.evaluate(()=>stellar.rejectDisposed());check('Late rejected voyage cannot revive disposed crossing',!s.locked&&s.orbit.horizon===null);check('Disposed orbital buttons removed',await page.locator('[data-stellar-exit]').count()===0);
check('No shader or page errors',errors.length===0&&s.errors===0);console.log(JSON.stringify({checks,errors},null,2));await fs.writeFile(out+'/checks.json',JSON.stringify({checks,errors},null,2));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
