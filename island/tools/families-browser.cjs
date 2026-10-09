// Real MakeHuman family scenes, household aid and lifecycle checks.
// First bundle family-preview-entry.mjs to dist/family-preview.js. Requires Playwright.
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
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.setContent('<script type="module" src="/island/dist/family-preview.js"></script>');
  const out=process.env.FAMILY_REVIEW_DIR || require('node:os').tmpdir()+'/bard-family-review'; await fs.mkdir(out,{recursive:true});
  await page.waitForFunction(()=>window.FAMILY_READY,{},{timeout:120000});
const checks=[];const check=(name,ok)=>{checks.push({name,ok});if(!ok)throw Error(name);};
check('pending stage cancellation',await page.evaluate(()=>preview.cancelCheck()));
const lineup=await page.evaluate(()=>preview.inspect());check('four real actors, child and teens protected',lineup.actors.length===4&&lineup.actors.slice(0,3).every(a=>a.minor)&&!lineup.actors[3].minor);check('household appearance follows requested sex',lineup.actors.every(a=>a.specMale===undefined||a.male===a.specMale));
await page.evaluate(()=>preview.view(2.6,3.8,6,0,2.9,0));await fs.writeFile(out+'/Bard-family-ages.png',Buffer.from((await page.evaluate(()=>preview.png())).split(',')[1],'base64'));
for(const kind of ['teens','school-run','dinner','foodbank']){
const state=await page.evaluate(kind=>preview.stage(kind),kind);check(kind+' actors finite and grounded',state.actors.length>0&&state.actors.every(a=>Number.isFinite(a.y)&&a.y>=1.99));
await page.evaluate(k=>k==='school-run'?preview.view(12,10,22,0,3,2):k==='foodbank'?preview.view(10,7,13,0,3,0):preview.view(5,4.5,7,0,3,0),kind);
await fs.writeFile(out+'/Bard-family-'+kind+'.png',Buffer.from((await page.evaluate(()=>preview.png())).split(',')[1],'base64'));}
await page.evaluate(()=>{preview.view(0,3.7,7);preview.frame();});check('nearby community aid visible',await page.locator('.family-aid').isVisible());
const before=await page.evaluate(()=>preview.inspect());await page.getByRole('button',{name:'Donate food · 50'}).click();const after=await page.evaluate(()=>preview.inspect());check('aid spends shared wallet and records deed',after.credits===before.credits-50&&after.deeds===before.deeds+1);
const persistence=await page.evaluate(async()=>{const f=preview.families(),a=f.areaAt(0,0);f.help('garden',{credits:300});const old=a.garden.plots;await preview.reload();return {old,now:preview.families().areaAt(0,0).garden.plots};});check('community garden persists after recreation',persistence.old>=5&&persistence.old===persistence.now);
await page.evaluate(()=>preview.stage('teens'));await page.evaluate(()=>preview.replaceWorld());check('world change removes stage actors',await page.evaluate(()=>preview.families().actors().length===0));
await page.evaluate(()=>preview.families().group.removeFromParent());await page.evaluate(()=>preview.stage('teens'));check('family group reattaches after world scene cleanup',await page.evaluate(()=>preview.families().group.parent===preview.scene));
await page.evaluate(()=>preview.stage('teens'));await page.evaluate(()=>preview.rebase());check('origin change removes stale stage',await page.evaluate(()=>preview.families().actors().length===0));
const memory=await page.evaluate(async()=>{await preview.stage('teens');preview.families().clear();preview.renderer.render(preview.scene,preview.camera);const before=preview.renderer.info.memory.geometries;for(let i=0;i<3;i++){await preview.stage('foodbank');preview.families().clear();preview.renderer.render(preview.scene,preview.camera);}return {before,after:preview.renderer.info.memory.geometries};});check('stage geometry released between gatherings',memory.after<=memory.before+8);
const realTable = await page.evaluate(async()=>{const W=preview.world(),root=new preview.scene.constructor();root.position.set(3,2,2);root.rotation.y=.7;preview.scene.add(root);W.houses={houses:new Map([['h',{cx:3,cz:2,root,plan:{items:[{type:'diningTable',x:0,y:0,z:0,w:1.8,d:1,rot:1,chairs:4}]}}]])};const before=root.children.length;await preview.stage('dinner');const result={actors:preview.families().actors().length,noDuplicate:root.children.length===before};preview.families().clear();delete W.houses;root.removeFromParent();return result;});check('real house dinner reuses existing chairs without duplicate furniture',realTable.noDuplicate&&realTable.actors>0&&realTable.actors<=4);
await page.evaluate(()=>preview.dispose());check('aid removed on disposal',await page.locator('.family-aid').count()===0);check('no renderer errors',errors.length===0);
console.log(JSON.stringify({checks,errors,memory,lineup},null,2));await fs.writeFile(out+'/checks.json',JSON.stringify({checks,errors,memory,lineup},null,2));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
