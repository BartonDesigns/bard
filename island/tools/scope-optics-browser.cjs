const path=require('node:path'), fs=require('node:fs/promises'),http=require('node:http'),assert=require('node:assert/strict');
const runtime=process.env.BARD_RENDER_RUNTIME || '/workspace/scratch/5c8900291977/arms-render-runtime/node_modules';
const {chromium}=require(path.join(runtime,'playwright-core'));const Chrome=require(path.join(runtime,'@sparticuz/chromium/build/index.js')).default;
(async()=>{
 const root=path.resolve(__dirname,'../..'),out=process.env.BARD_OPTICS_OUT||path.join(root,'docs/verification/armament-optics');await fs.mkdir(out,{recursive:true});
 const bundle=process.env.BARD_OPTICS_BUNDLE||'/tmp/bard-optics-preview.js';
 const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/rig.js"></script>');}else if(req.url==='/rig.js'){res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(bundle));}else{res.statusCode=404;res.end();}}catch(e){res.statusCode=500;res.end(String(e));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || "/tmp/chromium",args:Chrome.args,headless:true});const page=await browser.newPage({viewport:{width:900,height:650}}), errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.OPTICS_READY,{}, {timeout:120000});
 const states=[];
 for(const phone of [false,true])for(const id of ['aurora-trail-rifle','mossback-scout-rifle','warden-spark-carbine']){
 const report=await page.evaluate(([id,phone])=>opticReview.select(id,phone),[id,phone]);assert.equal(report.restored,true);assert.equal(report.glError,0);assert.ok(report.rearFrames>0);assert.equal(report.forwardFrames,id.includes('warden')?0:1);states.push({id,phone,...report});await page.screenshot({path:path.join(out,id+(phone?'-phone':'-desktop')+'.png')});
 }
 await page.evaluate(()=>opticReview.select('aurora-trail-rifle',false));const red=await page.evaluate(()=>opticReview.behind(0xff0022));await page.screenshot({path:path.join(out,'scope-red-behind.png')});const blue=await page.evaluate(()=>opticReview.behind(0x0044ff));await page.screenshot({path:path.join(out,'scope-blue-behind.png')});assert.notDeepEqual(red.pixels,blue.pixels,'rear scene must change glass');
 const reset=await page.evaluate(()=>opticReview.reset());assert.equal(reset.targets,0);assert.equal(reset.lenses,0);assert.deepEqual(errors,[]);const report={states,reflection:{red,blue},reset,errors};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
