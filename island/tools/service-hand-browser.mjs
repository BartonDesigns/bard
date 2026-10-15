import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import http from 'node:http';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=root+'/docs/verification/hand-service-rendering';
await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://local').pathname;res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':(name==='/'||name.endsWith('.html'))?'text/html':'application/octet-stream');res.end(name==='/'?'<html></html>':await fs.readFile(root+name));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const report=[],errors=[];let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const phone of [false,true]){
  const page=await browser.newPage({viewport:phone?{width:844,height:390}:{width:1100,height:700},...(phone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',isMobile:true,hasTouch:true}:{})});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.setContent('<script type="module" src="/island/dist/service-hand-preview.js"></script>');
  await page.waitForFunction(()=>window.SERVICE_HAND_READY,{},{timeout:120000});
  const save=async name=>fs.writeFile(out+'/'+(phone?'phone-':'desktop-')+name+'.png',Buffer.from((await page.evaluate(()=>weaponReview.png())).split(',')[1],'base64'));
  for(const mode of ['guard','block','jab','grip','open']){
   const row=await page.evaluate(mode=>serviceReview.hand(mode),mode);assert.equal(row.meshes.length,2);assert.equal(row.failed,0);report.push({phone,mode,...row});await save(mode);
  }
  // The independent melee skeleton must not have moved the avatar or invalidated
  // the existing rifle/bow grip solver when switching back to a weapon.
  for(const id of ['aurora-trail-rifle','reedline-hunting-bow']){
   const row=await page.evaluate(id=>{serviceReview.fists.hide();serviceReview.fleet.visible=false;weaponReview.select(id,'first');weaponReview.aim(true);for(let i=0;i<80;i++)weaponReview.frame(1/60,false);weaponReview.frame();return weaponReview.info();},id);
   for(const side of ['L','R'])if(row['contact'+side+'mm']!=null)assert.ok(row['contact'+side+'mm']<3,JSON.stringify(row));report.push({phone,id,...row});await save(id);
  }
  if(!phone){
   for(const kind of ['ambulance','engine','utility','van']){
    const row=await page.evaluate(kind=>serviceReview.vehicle(kind),kind);assert.equal(row.failed,0);assert.equal(row.level,0);report.push({kind,...row});await save(kind);
    if(kind==='ambulance'){await page.evaluate(()=>serviceReview.vehicle('ambulance',true));await save('ambulance-rear');}
    const far=await page.evaluate(kind=>serviceReview.vehicle(kind,false,90),kind);assert.equal(far.level,1);assert.ok(far.tris<row.tris/2);report.push({kind,far:true,...far});
   }
   assert.ok(await page.evaluate(()=>serviceReview.drive())>1);
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile(out+'/report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({states:report.length,errors}));
} finally {await browser?.close();server.close();}
