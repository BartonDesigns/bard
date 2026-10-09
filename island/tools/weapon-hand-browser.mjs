import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium:pw} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import http from 'node:http';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), out=process.env.BARD_WEAPON_REVIEW_OUT || root+'/docs/verification/weapon-hands';
await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://local').pathname;if(name==='/'){res.setHeader('Content-Type','text/html');res.end('<html></html>');return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(await fs.readFile(root+name));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report=[],errors=[];
try{
browser=await pw.launch({executablePath:process.env.CHROME_EXECUTABLE || undefined,args:process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],headless:true});
const page=await browser.newPage({viewport:{width:960,height:600}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.setContent('<script type="module" src="/island/dist/weapon-hand-preview.js"></script>');
await page.waitForFunction(()=>window.WEAPON_HAND_READY,{},{timeout:120000});
for(const mode of ['first','third'])for(const id of ['aurora-trail-rifle','mossback-scout-rifle','warden-spark-carbine','reedline-hunting-bow']){
await page.evaluate(([id,mode])=>weaponReview.select(id,mode),[id,mode]);
for(const stage of ['carry','aim','fire','reload','ready']){
const info=await page.evaluate(stage=>{const w=weaponReview;let accepted=null;if(stage==='aim'){w.aim(true);for(let i=0;i<80;i++)w.frame(1/60,false);}if(stage==='fire'){accepted=w.fire();w.frame(1/60,false);}if(stage==='reload'){accepted=w.reload();for(let i=0;i<42;i++)w.frame(1/60,false);}if(stage==='ready')for(let i=0;i<180;i++)w.frame(1/60,false);w.frame();return {accepted,reloading:w.reloading(),...w.info(),failed:w.failed()};},stage);
report.push({mode,id,stage,...info});
if((mode==='first'&&stage==='carry')||(mode==='third'&&stage==='aim'))await fs.writeFile(out+'/'+mode+'-'+id+'-'+stage+'.png',Buffer.from((await page.evaluate(()=>weaponReview.png())).split(',')[1],'base64'));
}}
const sizes=await page.evaluate(()=>weaponReview.sizes());
for(const row of [...report,...sizes]){
for(const side of ['L','R'])if(row['contact'+side+'mm']!=null)assert.ok(row['contact'+side+'mm']<3,JSON.stringify(row));
if(row.failed!=null)assert.equal(row.failed,0);
if(row.stage==='fire'||row.stage==='reload')assert.equal(row.accepted,true);
if(row.stage==='ready')assert.equal(row.reloading,false);
if(row.stage==='aim')assert.ok(row.aiming||row.ads>.95);
}
for(const row of sizes)assert.ok(Math.abs(row.muzzle[1]-Math.sin(row.pitch))<.015,JSON.stringify(row));
assert.deepEqual(errors,[]);
await fs.writeFile(out+'/report.json',JSON.stringify({report,sizes,errors},null,2));console.log(JSON.stringify({states:report.length,sizes:sizes.length,maxContactMm:Math.max(...[...report,...sizes].flatMap(r=>[r.contactLmm||0,r.contactRmm||0])),errors}));
}finally{await browser?.close();server.close();}
