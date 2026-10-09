// ARCH_MIST_BUNDLE points to a scratch bundle of arch-mist-preview.mjs.
// Run under flock /tmp/bard-browser.lock; uses software WebGL, not device timing.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'../..'),bundle=process.env.ARCH_MIST_BUNDLE,out=process.env.ARCH_MIST_OUT||'/tmp/bard-arch-mist';assert.ok(bundle,'Provide ARCH_MIST_BUNDLE');await fs.mkdir(out,{recursive:true});
 const report={method:'Full production world, source preview bundle, fixed clock and camera; before substitutes only the previous in-cloud veil opacity/colour. Software WebGL, not physical-device timing.',worlds:[],errors:[],requests:[]};
 const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname,f=p==='/island/dist/island.js'?bundle:path.resolve(root,'.'+(p==='/'?'/index.html':p));if(f!==bundle&&!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',/\.(m?js)$/.test(f)?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
 for(const phone of (process.env.ARCH_MIST_TIERS||'phone').split(',').map(t=>t==='phone')){
  // A fresh process per viewport: single-process serverless Chromium cannot restart after its final page closes.
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]')});
  try{
   const tier=phone?'phone':'desktop',page=await browser.newPage({viewport:phone?{width:640,height:420}:{width:960,height:600},hasTouch:phone,...(phone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}:{})});page.setDefaultTimeout(300000);
   page.on('pageerror',e=>report.errors.push({tier,error:e.message}));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/.test(m.text()))report.errors.push({tier,error:m.text()});});page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:')&&!r.url().endsWith('/favicon.ico'))report.requests.push({tier,url:r.url(),status:r.status()});});
   await page.goto('http://127.0.0.1:'+server.address().port+'/?offline&safe',{waitUntil:'domcontentloaded'});await page.evaluate(()=>L99IslandDoor.engine());
   for(const biome of ['TERRAN','GAS']){
    const meta=await page.evaluate(b=>archMistReview.open(b),biome),entry={tier,biome,meta,checks:[]};report.worlds.push(entry);console.log('OPEN',tier,biome,'layers',meta.arch.mist.layers);
    assert.equal(meta.arch.mist.layers,phone?6:11,'actual production phone tier');
    for(const p of meta.fixtures){
     const pair={name:p.name,fixture:p};
     for(const before of [true,false]){
      const mode=before?'before':'after',r=await page.evaluate(({p,before})=>archMistReview.render(p,before),{p,before});pair[mode]=r;
      assert.equal(r.lost,false);assert.equal(r.glError,0);assert.equal(r.shaderErrors,0);assert.ok(r.lit,`${tier}/${biome}/${p.name} rendered`);assert.equal(r.mesh.segments,phone?30:52);
      const f=`${tier}-${biome.toLowerCase()}-${p.name}-${mode}.png`;await page.screenshot({path:path.join(out,f),timeout:300000});pair[mode].image=f;pair[mode].imageSha256=crypto.createHash('sha256').update(await fs.readFile(path.join(out,f))).digest('hex');
     }
     assert.deepEqual(pair.before.mesh,pair.after.mesh,'mesh and layer budgets preserved');
     if(p.name.endsWith('clear')){assert.equal(pair.after.opacity,0);assert.ok(pair.before.opacity>.2);}
     if(p.name.endsWith('cloud'))assert.ok(pair.after.opacity>.15,'cloud interior remains visible');
     if(p.name==='overview'){assert.equal(pair.before.opacity,0);assert.equal(pair.after.opacity,0);assert.equal(pair.before.imageSha256,pair.after.imageSha256,'outside view unchanged');}
     entry.checks.push(pair);console.log('PAIR',tier,biome,p.name,pair.before.opacity.toFixed(3),'->',pair.after.opacity.toFixed(3));
    }
   }
  }finally{await browser.close();}
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.passed=true;
 }finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}
 console.log('PASS',report.worlds.reduce((n,w)=>n+w.checks.length,0),'before/after pairs');
})().catch(e=>{console.error(e);process.exitCode=1;});
