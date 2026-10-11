// Exact production-model review. Bundle weapon-hand-preview.mjs as ESM first.
// Run with: flock /tmp/bard-browser.lock node island/tools/armament-art-browser.cjs
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/workspace/scratch/5c8900291977/arms-render-runtime/node_modules/playwright-core');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.ARMAMENT_RIG_BUNDLE || path.join(ROOT, 'island/dist/armament-art-review.js');
const OUT = process.env.ARMAMENT_ART_OUT || path.resolve(ROOT, '../Bard-armament-pass-2026-10-09');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
(async () => {
 await fs.mkdir(OUT, { recursive: true });
 const server = http.createServer(async (req, res) => {
  try {
   const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
   if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
   if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden}</style><script type="module" src="/island/dist/armament-art-review.js"></script>'); return; }
   const file = pathname === '/island/dist/armament-art-review.js' ? BUNDLE : path.join(ROOT, pathname);
   if (!file.startsWith(ROOT + path.sep) && file !== BUNDLE) { res.writeHead(403).end(); return; }
   const data = await fs.readFile(file); res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404).end(); }
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = server.address().port;
 const runtime = process.env.CHROMIUM_RUNTIME || '/tmp/bard-browser-runtime';
 const chromeArgs = process.env.SPARTICUZ_MODULE ? (await import(process.env.SPARTICUZ_MODULE)).default.args : ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || path.join(runtime, 'chromium'), args: chromeArgs, env: { ...process.env, LD_LIBRARY_PATH: runtime, FONTCONFIG_PATH: path.join(runtime, 'fonts') } });

 const report={poses:[],characters:[],wardrobe:[],errors:[]};
 try {
  const phone=process.env.CHARACTER_DEVICE==='phone';
  const p=await browser.newPage({viewport:phone?{width:390,height:664}:{width:1100,height:850},isMobile:phone,hasTouch:phone,userAgent:phone?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1':undefined});
  p.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE',e.message)});p.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('CONSOLE',m.text().slice(0,400))}});
  await p.goto(`http://127.0.0.1:${port}/`);await p.waitForFunction(()=>window.WEAPON_HAND_READY,null,{timeout:120000});
  for(const [seed,height,weight,fit,hair] of [[9172,1.5,.3,'regular','coils'],[4217,1.75,.65,'oversized','afro'],[711,2,.85,'straight','waves']]) {
   const meta=await p.evaluate(({seed,height,weight,fit,hair})=>weaponReview.character(seed,{height,weight,hair,outfit:{top:{kind:'tee',col:'#a48459',fit,sleeves:'short'},outer:null,bottom:{kind:'jeans',col:'#345065',fit,legs:'long'},shoes:{kind:'boot',col:'#30231c'}}}),{seed,height,weight,fit,hair});
   await p.waitForFunction(()=>weaponReview.P.hair?.isSkinnedMesh,null,{timeout:30000});
   if(process.env.CHARACTER_WARDROBE_ONLY) break;
   const rows=await p.evaluate(()=>{
    const r=weaponReview, out=[];
    for(const id of ['aurora-trail-rifle','mossback-scout-rifle','warden-spark-carbine'])for(const aiming of [false,true])for(const pitch of [-.45,0,.45]) {
     r.select(id,'third');r.aim(aiming,pitch);
     for(let i=0;i<90;i++)r.frame(1/60,false);
     out.push({id,aiming,pitch,...r.info()});
    }return out;
   });
   for(const row of rows){assert.ok(row.contactLmm<=4&&row.contactRmm<=4,JSON.stringify({seed,height,...row}));assert.equal(row.torsoPenetrationMm,0,JSON.stringify(row));}
   report.poses.push({seed,height,weight,rows});
   await p.evaluate(()=>{const r=weaponReview;r.select('aurora-trail-rifle','third');r.aim(true);for(let i=0;i<90;i++)r.frame(1/60,false);r.camera.position.set(1.8,1.5,-2.6);r.camera.lookAt(0,1.1,0);r.frame();});
   await p.screenshot({path:path.join(OUT,`character-${seed}-rifle.png`)});
   const detail=await p.evaluate(()=>{const r=weaponReview;r.select(null,'third');for(let i=0;i<90;i++)r.frame(1/60,false);r.hand.hide();r.camera.position.set(.55,r.P.height*.84,-1.25);r.camera.lookAt(0,r.P.height*.8,0);r.renderer.render(r.scene,r.camera);return {triangles:r.P.hair.geometry.index.count/3,clothVertices:r.P.cloth.geometry.attributes.position.count,signature:r.M.S.signature,programs:r.failed(),height:r.P.height,hairMotion:r.P.hair.material.userData.U.uHairMotion.value.toArray(),hairTime:r.P.hair.material.userData.U.uHairTime.value};});
   await p.screenshot({path:path.join(OUT,`character-${seed}-hair-clothing.png`)});report.characters.push({seed,...detail,...meta});
   assert.equal(detail.programs,0);assert.ok(typeof detail.hairTime==='number' && Number.isFinite(detail.hairTime));assert.ok(detail.hairMotion.every(Number.isFinite));assert.ok(detail.triangles<60000);console.log('PASS character',seed,'18 rifle fits, groom and clothing render',detail.triangles);
  }
  for(const [label,male,top,outer,hair] of [
   ['cotton',false,{kind:'tee',col:'#c5ac8c',fit:'regular',sleeves:'short'},null,{style:'long01'}],
   ['hoodie',true,{kind:'tee',col:'#8a9992',fit:'regular',sleeves:'short'},{kind:'hoodie',col:'#405b54',fit:'oversized',sleeves:'long',fab:'fleece'}, {style:'short04'}],
   ['jacket',false,{kind:'tee',col:'#b8b4a1',fit:'regular',sleeves:'short'},{kind:'jacket',col:'#555865',fit:'regular',sleeves:'long',open:true}, {style:'island'}],
   ['stretch',true,{kind:'tech',col:'#79625e',fit:'tight',sleeves:'long'},null,{style:'grump'}]
  ]) {
   await p.evaluate(({label,male,top,outer,hair})=>weaponReview.character(male?1278:4217,{male,height:male?1.85:1.68,hair,outfit:{top,outer,bottom:{kind:'jeans',col:'#324657',fit:'straight',legs:'long',pat:'denim'},shoes:{kind:'boot',col:'#302b26'}}}),{label,male,top,outer,hair});
   await p.waitForFunction(()=>weaponReview.P.hair?.isSkinnedMesh,null,{timeout:30000});
   const detail=await p.evaluate(()=>{
    const r=weaponReview;r.select(null,'third');r.hand.hide();r.M.want.speed=0;
    for(let i=0;i<90;i++)r.frame(1/60,false);
    const P=r.P,g=P.cloth.geometry,sw=g.attributes.skinWeight,si=g.attributes.skinIndex;let weightError=0;
    for(let i=0;i<sw.count;i++){
     let sum=0;for(let j=0;j<4;j++){sum+=sw.array[i*4+j];if(si.array[i*4+j]>=P.bones.length)throw Error('Invalid garment bone');}
     weightError=Math.max(weightError,Math.abs(sum-1));
    }
    if(!g.attributes.position.array.every(Number.isFinite))throw Error('Invalid cloth geometry');
    r.camera.position.set(.7,P.height*.81,-1.65);r.camera.lookAt(0,P.height*.70,0);r.frame();
    const U=P.hair.material.userData.U;
    let guidePeak=0,distinct=false;
    for(let i=0;i<30;i++){
     P.bones[P.map.head].rotation.y+=.01;P.root.updateMatrixWorld(true);P.motionTime+=1/60;P.hair.onBeforeRender();
     guidePeak=Math.max(guidePeak,...U.uHairGuides.value.map(v=>v.length()));
     distinct ||= new Set(U.uHairGuides.value.map(v=>v.toArray().map(x=>x.toFixed(5)).join(','))).size>1;
    }
    r.frame();return {cut:P.cut,tailoring:g.userData.tailoring,vertices:sw.count,triangles:g.index.count/3,weightError,guidePeak,distinct,programs:r.failed()};
   });
   assert.ok(detail.weightError<.00001,JSON.stringify(detail));assert.ok(detail.vertices<12000);assert.ok(detail.tailoring.edgeSegments>0);assert.ok(detail.guidePeak>0&&detail.guidePeak<=.03001);assert.ok(detail.distinct);assert.equal(detail.programs,0);
   await p.screenshot({path:path.join(OUT,`wardrobe-${label}.png`)});
   await p.evaluate(()=>{const r=weaponReview;r.M.sit(.46);for(let i=0;i<100;i++)r.frame(1/60,false);r.camera.position.set(1.3,r.P.height*.55,-1.55);r.camera.lookAt(0,r.P.height*.50,0);r.frame();});
   await p.screenshot({path:path.join(OUT,`wardrobe-${label}-seated.png`)});
   report.wardrobe.push({label,male,...detail});console.log('PASS wardrobe',label,detail.vertices,'vertices',detail.tailoring.edgeSegments,'finished edges');
  }
  const walking=await p.evaluate(()=>{
   const r=weaponReview;r.M.stand();r.select('aurora-trail-rifle','third');r.aim(false);r.M.want.speed=1.4;
   let penetration=0,contact=0;
   for(let i=0;i<180;i++){if(i===30)r.fire();if(i===60)r.reload();r.frame(1/60,false);const s=r.info();penetration=Math.max(penetration,s.torsoPenetrationMm);contact=Math.max(contact,s.contactLmm,s.contactRmm);}
   return {penetration,contact,signature:r.M.S.signature};
  });
  assert.equal(walking.penetration,0);assert.ok(walking.contact<=4,JSON.stringify(walking));report.walking=walking;
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{await fs.writeFile(path.join(OUT,'character-report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
