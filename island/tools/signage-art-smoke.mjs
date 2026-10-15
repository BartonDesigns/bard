// Review the real Canvas/Three rendering and asset URLs without loading the whole universe.
// Set BARD_PLAYWRIGHT_MODULE and BARD_CHROMIUM_EXECUTABLE if they aren't installed locally.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)), bundle=resolve(root,'island/dist/signage-art-review.js');
const {chromium}=await import(process.env.BARD_PLAYWRIGHT_MODULE || 'playwright');
await build({entryPoints:[fileURLToPath(new URL('./signage-art-review-entry.js',import.meta.url))],bundle:true,format:'esm',outfile:bundle});
const server=createServer(async(req,res)=>{
 try {
  if(req.url.startsWith('/review')) {res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="/island/dist/signage-art-review.js"></script>');return;}
  const path=resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(!path.startsWith(root+sep) && !path.startsWith(root))throw Error('path');
  res.setHeader('content-type',({'.js':'text/javascript','.webp':'image/webp','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
 }catch{res.statusCode=404;res.end();}
});
let browser;
try {
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:process.env.BARD_CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const output=resolve(process.env.BARD_ART_REVIEW_OUT || '/tmp/bard-art-review');await mkdir(output,{recursive:true});
 for(const mode of ['desktop','mobile','offline']) {
  const phone=mode==='mobile',page=await browser.newPage({viewport:phone?{width:390,height:844}:{width:1440,height:1000}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error' && /Shader Error|VALIDATE_STATUS|shader.*error/i.test(m.text()))errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  if(mode==='offline')await page.route('**/assets/signage/**',r=>r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/review${phone?'?phone':''}`);await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(()=>window.__review);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(result.geoErrors,[]);assert.ok(result.campaignDraws>0);assert.ok(result.retail.campaigns>0);assert.equal(result.info.draws,3);assert.equal(result.retail.built,1);assert.ok(result.retail.labels>0);assert.ok(result.retail.labels<=(phone?24:72));assert.equal(result.retail.banners,1);assert.equal(result.retail.labelSides.length,2);assert.equal(result.retail.labelHeights.length,3);assert.ok(result.info.atlas[0]<=(phone?768:1536));
  await page.screenshot({path:resolve(output,mode+'.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>window.__dispose()),false);
  console.log(JSON.stringify({mode,...result,errors,failed,disposed:true}));await page.close();
 }
} finally {await browser?.close();server.close();await rm(bundle,{force:true});}
