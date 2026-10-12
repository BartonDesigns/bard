// Exact production-model review. Bundle weapon-hand-preview.mjs as ESM first.
// Run with: flock /tmp/bard-browser.lock node island/tools/armament-art-browser.cjs
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/workspace/scratch/5c8900291977/arms-render-runtime/node_modules/playwright-core');
const ROOT = path.resolve(__dirname, '../..');
const BUNDLE = process.env.ARMAMENT_RIG_BUNDLE || path.join(ROOT, 'island/dist/workplace-review.js');
const OUT = process.env.ARMAMENT_ART_OUT || path.resolve(ROOT, '../Bard-armament-pass-2026-10-09');
const MIME = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gz': 'application/octet-stream' };
(async () => {
 await fs.mkdir(OUT, { recursive: true });
 const server = http.createServer(async (req, res) => {
  try {
   const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
   if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
   if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden}</style><script type="module" src="/island/dist/workplace-review.js"></script>'); return; }
   const file = pathname === '/island/dist/workplace-review.js' ? BUNDLE : path.join(ROOT, pathname);
   if (!file.startsWith(ROOT + path.sep) && file !== BUNDLE) { res.writeHead(403).end(); return; }
   const data = await fs.readFile(file); res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404).end(); }
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = server.address().port;
 const runtime = process.env.CHROMIUM_RUNTIME || '/tmp/bard-browser-runtime';
 const chromeArgs = process.env.SPARTICUZ_MODULE ? (await import(process.env.SPARTICUZ_MODULE)).default.args : ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || path.join(runtime, 'chromium'), args: chromeArgs, env: { ...process.env, LD_LIBRARY_PATH: runtime, FONTCONFIG_PATH: path.join(runtime, 'fonts') } });

 const report={cases:[],errors:[]};
 try {
  const p=await browser.newPage({viewport:process.env.CHARACTER_DEVICE==='phone'?{width:390,height:664}:{width:1400,height:900}});
  p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await p.goto(`http://127.0.0.1:${port}/`);await p.waitForFunction(()=>window.WORKPLACE_READY,null,{timeout:60000});
  await p.waitForFunction(()=>window.CITY_LIFE_READY);
  report.office=await p.evaluate(()=>cityLifeReview.populate('office'));
  report.typing=await p.evaluate(()=>cityLifeReview.state('typing at a workstation'));
  await p.screenshot({path:path.join(OUT,'working-office.png')});
  report.dispute=await p.evaluate(()=>cityLifeReview.state('dispute'));
  await p.screenshot({path:path.join(OUT,'project-disagreement.png')});
  report.mall=await p.evaluate(()=>cityLifeReview.populate('mall'));
  report.negotiation=await p.evaluate(()=>cityLifeReview.state('negotiating a price'));
  await p.screenshot({path:path.join(OUT,'negotiating.png')});
  report.purchase=await p.evaluate(()=>cityLifeReview.state('buying'));
  await p.screenshot({path:path.join(OUT,'purchase.png')});
  assert.ok(report.typing.some(p=>p.pose==='type'));
  assert.ok(report.dispute.some(p=>p.role.activity==='dispute'));
  assert.ok(report.purchase.some(p=>p.bag));
  assert.ok(report.purchase.every(p=>p.sales===1 && p.stock===23));
  assert.ok(report.office.targets.length>3);assert.equal(report.mall.venue,'retail');
  assert.equal(await p.evaluate(()=>workplaceReview.failed()),0);assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify({office:report.office.roles.length,mall:report.mall.roles.length,sales:report.purchase.map(p=>p.sales),errors:report.errors}));
 }finally{await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
