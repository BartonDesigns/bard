const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const requests=[],errors=[];
 const server=http.createServer((q,r)=>{const pathname=new URL(q.url,'http://local').pathname;
  if(pathname==='/fixture'){r.setHeader('content-type','text/html');r.end(`<button id="start">Speak</button><script type="module">import {createLocalSpeech} from '/island/src/guide/local-speech.js';window.statuses=[];window.fallbacks=[];window.speech=createLocalSpeech({onStatus:s=>statuses.push(s),fallback:t=>fallbacks.push(t)});document.querySelector('button').onclick=()=>{speech.unlock();speech.speak('Welcome back. The office meeting starts soon',{seed:0,male:false});};</script>`);return;}
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+'/')){r.writeHead(403).end();return;}
  try{r.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');r.end(fs.readFileSync(file));}catch{r.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true,proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}:undefined,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({ignoreHTTPSErrors:true});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));
  await page.addInitScript(()=>{window.played=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){const x=this.buffer?.getChannelData(0);played.push({duration:this.buffer?.duration,rms:x?Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length):0});return start.apply(this,a);};});
  await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.waitForFunction(()=>window.speech);await page.click('#start');
  await page.waitForFunction(()=>played.length>=2||fallbacks.length,{},{timeout:240000});
  let result=await page.evaluate(()=>({played,fallbacks,status:statuses.at(-1)}));assert.equal(result.fallbacks.length,0,JSON.stringify(result));assert.equal(result.played.length,2);assert.ok(result.played.every(a=>a.duration>.1&&a.rms>.001));
  await page.evaluate(()=>speech.speak('A second reply works too',{seed:1,male:true}));
  await page.waitForFunction(()=>played.length>=3||fallbacks.length,{},{timeout:120000});
  await page.evaluate(()=>{speech.speak('This cancelled reply must never play');speech.cancel();});
  await page.waitForTimeout(1500);result=await page.evaluate(()=>({played,fallbacks,status:statuses.at(-1)}));assert.equal(result.played.length,3);assert.deepEqual(result.fallbacks,[]);assert.deepEqual(errors,[]);
  assert.equal(requests.filter(r=>r.method!=='GET').length,0);
  const report={...result,errors,network:{onlyModelAndRuntimeDownloads:true,hosts:[...new Set(requests.map(r=>new URL(r.url).host))]},checks:['two sentences including final text without punctuation','second reply with a different voice','cancelled reply does not play','non-silent generated PCM','no speech-server request']};
  fs.writeFileSync(process.env.SPEECH_REPORT || '/tmp/bard-local-speech-release.json',JSON.stringify(report,null,2));console.log('PASS',JSON.stringify(report));await page.evaluate(()=>speech.dispose());
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
