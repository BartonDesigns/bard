// Real cross-origin preflights, an older rooms deployment, and the production handler.
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const esbuild=require('../island/node_modules/esbuild');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const {handle}=await import('../server/multiplayer/src/index.js'),{Soul}=await import('../server/multiplayer/src/soul.js');
 const souls=new Map(),env={SOULS:{idFromName:id=>id,get(id){if(!souls.has(id)){const m=new Map();souls.set(id,new Soul({storage:{get:async k=>structuredClone(m.get(k)),put:async o=>{for(const[k,v]of Object.entries(o))m.set(k,structuredClone(v));}}}));}return souls.get(id);}}};
 let mode='old',calls=[];
 const backend=http.createServer(async(req,res)=>{try{
  calls.push({path:req.url,method:req.method,authorized:!!req.headers.authorization});
  const body=[];for await(const part of req)body.push(part);
  const request=new Request('http://rooms'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(body)}:{})});
  let response;
  if(mode==='old'&&req.url==='/status')response=Response.json({features:['trade-v2']},{headers:{'access-control-allow-origin':req.headers.origin}});
  else response=await handle(request,env);
  if(mode!=='ready'&&req.method==='OPTIONS')response.headers.set('access-control-allow-headers','content-type');
  if(req.method==='OPTIONS')response.headers.set('access-control-max-age','0'); // Each simulated deployment must get its own policy check.
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500).end(e.message);}});
 await new Promise(r=>backend.listen(0,'127.0.0.1',r));
 const bundle=await esbuild.build({stdin:{contents:"export {createSoul} from './island/src/reputation/soul.js';export {createMorality} from './island/src/combat/morality.js';",resolveDir:root},bundle:true,format:'esm',write:false});
 const site=http.createServer(async(req,res)=>{
  if(req.url==='/client.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
  else if(req.url==='/rapier.mjs.map'){res.setHeader('content-type','application/json');res.end(await fs.readFile(path.join(root,'island/dist/rapier.mjs.map')));}
  else res.end('<!doctype html><title>Soul CORS verification</title>');
 });await new Promise(r=>site.listen(0,'127.0.0.1',r));
 let browser;
 try{
  const executablePath=process.env.CHROME_EXECUTABLE;
  browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,...(executablePath?{LD_LIBRARY_PATH:path.dirname(executablePath)}:{})}});
  const page=await browser.newPage(),errors=[],corsErrors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/CORS|access control/i.test(m.text()))corsErrors.push(m.text());});
  const siteURL='http://127.0.0.1:'+site.address().port,api='http://127.0.0.1:'+backend.address().port;
  const start=async()=>{
   await page.goto(siteURL);
   await page.evaluate(async url=>{
    const {createSoul,createMorality}=await import('/client.js'),m=new Map();window.clock=1000;
    window.morality=createMorality();window.soul=createSoul({morality,url,now:()=>clock,storage:{get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}});
   },api);
  };
  const exercise=()=>page.evaluate(async()=>{for(let i=0;i<20;i++){morality.record({kind:'favour'});soul.update();await soul.sync();clock+=100;}return soul.info();});
  await start();const old=await exercise();assert.equal(old.pending,20);assert.equal(old.cloudAvailable,false);
  assert.deepEqual(calls,[{path:'/status',method:'GET',authorized:false}]);assert.deepEqual(corsErrors,[]);
  mode='ready';const saved=await page.evaluate(async()=>{clock=301000;await soul.sync();return{...soul.info(),deeds:morality.me().deeds};});
  assert.equal(saved.status,'saved');assert.equal(saved.pending,0);assert.equal(saved.deeds,20);
  assert.ok(calls.some(c=>c.method==='OPTIONS'));assert.ok(calls.some(c=>c.method==='POST'&&c.authorized));
  console.log('PASS old deployment receives only public status; after upgrade, queued deeds sync through real CORS and the production handler');
  mode='broken';calls=[];await start();const broken=await exercise();
  assert.equal(broken.pending,20);assert.equal(calls.filter(c=>c.method==='OPTIONS').length,1);assert.equal(calls.filter(c=>c.path==='/souls/me'&&c.method!=='OPTIONS').length,0);assert.ok(corsErrors.length>0);
  mode='ready';const restored=await page.evaluate(async()=>{clock=31000;await soul.sync();return{...soul.info(),deeds:morality.me().deeds};});
  assert.equal(restored.pending,0);assert.equal(restored.deeds,20);assert.deepEqual(errors,[]);
  const map=await page.request.get(siteURL+'/rapier.mjs.map');assert.equal(map.status(),200);assert.equal((await map.json()).version,3);
  console.log('PASS actual CORS failure does not repeat under gameplay events; corrected server resumes saving; Rapier map resolves');
 }finally{await browser?.close();site.close();backend.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
