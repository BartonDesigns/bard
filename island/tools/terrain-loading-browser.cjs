// Bundle terrain-height-preview.mjs, then pass TERRAIN_BUNDLE and browser environment paths.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=process.env.TERRAIN_OUT||'/tmp/bard-terrain-loading';
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://local');
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>body{margin:0}</style><script type="module" src="/island/dist/probe.js"></script>');return;}
  if(u.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  const f=u.pathname==='/island/dist/probe.js'?process.env.TERRAIN_BUNDLE:path.resolve(root,'.'+u.pathname);
  if(f!==process.env.TERRAIN_BUNDLE&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(await fs.readFile(f));
 }catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={method:'Real SF/San Jose/San Ramon/Pacific surveys, production vertex displacement and road grading, forced roads-before-survey load order; Chromium software GPU, touch/full and lite variants.',cases:[],errors:[]};
 try{
  for(const phone of [false,true])for(const unsafe of [true,false]){
   const context=await browser.newContext({viewport:{width:640,height:480},hasTouch:phone,isMobile:phone});const p=await context.newPage();
   p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   await p.goto(`http://127.0.0.1:${server.address().port}/?${unsafe?'unsafe&':''}${phone?'lite':'full'}`);await p.waitForFunction(()=>window.probe,null,{timeout:120000});
   const result=await p.evaluate(()=>probe());
   assert.equal(result.lost,false);assert.equal(result.glError,0);assert.equal(result.failedPrograms,0);
   assert.ok(result.surveyHeight>90);
   if(unsafe)assert.ok(result.roadHeight< -59,'previous loading order must reproduce a sunken road');
   else assert.ok(Math.abs(result.roadHeight-result.surveyHeight)<2,'grade follows loaded survey');
   for(const area of result.results)assert.ok(area.maxError<.2,`${area.name}: GPU/CPU height agreement`);
   const name=`${phone?'touch-lite':'desktop-full'}-${unsafe?'before':'after'}`;
   await p.screenshot({path:path.join(out,name+'.png')});report.cases.push({name,...result});await context.close();console.log(name,result.roadHeight);
  }
  assert.deepEqual(report.errors,[]);
 }finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
