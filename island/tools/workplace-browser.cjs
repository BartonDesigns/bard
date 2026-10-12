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
  for(const [name,expression]of [['office','workplaceReview.show(30)'],['conference','workplaceReview.show(33)'],['top-floor','workplaceReview.show(69)'],['mall','workplaceReview.mall()'],['food-court','workplaceReview.show(4,"atrium")'],['japan','workplaceReview.japan()']]){
   const meta=await p.evaluate(expression);await p.screenshot({path:path.join(OUT,name+'.png')});assert.ok(meta.loaded.length<=3);assert.ok(meta.slabs>=meta.levels.length);report.cases.push({name,...meta});
  }
  await p.evaluate(()=>workplaceReview.visit(1));
  await p.getByRole('button',{name:/^60 ·/}).click();await p.waitForFunction(()=>workplaceReview.T.here(workplaceReview.p.pos)?.n===60);
  const checks=await p.evaluate(()=>{const r=workplaceReview,T=r.T,plan=r.plan(),o=r.lot();let count=0;for(let i=0;i<plan.levels.length;i++){r.visit(i);const L=plan.levels[i];if(Math.abs(T.floor(o.x,o.z,L.y+.1)-L.y)>.0001)throw Error('missing slab '+i);if(T.diagnostics().loaded.length>3)throw Error('unbounded cache');count++;}return {count,geometries:r.renderer.info.memory.geometries,programs:r.failed()};});
  assert.equal(checks.programs,0);assert.ok(checks.geometries<100);report.checks=checks;assert.deepEqual(report.errors,[]);
  console.log(JSON.stringify({cases:report.cases.map(c=>({name:c.name,levels:c.levels.length,loaded:c.loaded})),checks}));
 }finally{await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
