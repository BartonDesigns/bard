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
 const Sparticuz = (await import(process.env.SPARTICUZ_MODULE || '/workspace/scratch/5c8900291977/arms-render-runtime/node_modules/@sparticuz/chromium/build/index.js')).default;
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || path.join(runtime, 'chromium'), args: Sparticuz.args, env: { ...process.env, LD_LIBRARY_PATH: runtime, FONTCONFIG_PATH: path.join(runtime, 'fonts') } });
 const keepalive = await browser.newPage();
 const records = [], fits = [], errors = [];
 function validate(info, name) {
  assert.ok(info, name + ': missing model');
  for (const side of ['L', 'R']) if (info['contact' + side + 'mm'] != null) assert.ok(info['contact' + side + 'mm'] <= 3, name + ': ' + side + ' palm loses grip ' + JSON.stringify(info));
  for (const key of ['stringNockErrorMm', 'stringTipErrorMm', 'arrowRestErrorMm']) if (info.bow?.[key] != null) assert.ok(info.bow[key] <= 3, name + ': ' + key);
 }
 try {
  for (const device of (process.env.ARMAMENT_DEVICES || 'desktop,phone').split(',')) {
   const context = await browser.newContext(device === 'phone' ? { viewport: { width: 640, height: 420 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1' } : { viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
   const page = await context.newPage();
   page.on('pageerror', e => errors.push(device + ': ' + String(e)));
   page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(device + ': ' + m.text()); });
   await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'networkidle', timeout: 60000 });
   await page.waitForFunction(() => window.WEAPON_HAND_READY, null, { timeout: 120000 });
   for (const mode of ['first', 'third']) {
    for (const id of (process.env.ARMAMENT_GUNS === '0' ? [] : ['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine'])) {
     for (const pose of ['carry', 'aim']) {
      await page.evaluate(({ id, mode, pose }) => { weaponReview.select(id, mode); if (mode === 'third') weaponReview.close(); weaponReview.aim(pose === 'aim'); for (let i=0;i<70;i++) weaponReview.frame(1/60, false); weaponReview.frame(); }, { id, mode, pose });
      if (mode === 'first') await page.waitForFunction(() => { weaponReview.frame(); return weaponReview.info().arms; }, null, { timeout: 30000 });
      const name = `${device}-${mode}-${id}-${pose}`;
      const info = await page.evaluate(() => weaponReview.info()); validate(info, name);
      await page.screenshot({ path: path.join(OUT, name + '.png') }); records.push({ name, device, mode, id, pose, info }); console.log(name);
     }
    }
    for (const pose of (process.env.ARMAMENT_BOW === '0' ? [] : ['ready', 'half-draw', 'full-draw', 'released'])) {
     await page.evaluate(({ mode, pose }) => {
      weaponReview.select('reedline-hunting-bow', mode); if (mode === 'third') weaponReview.close(); weaponReview.aim(true);
      weaponReview.bow({ draw: pose === 'ready' ? 0 : pose === 'half-draw' ? .5 : 1, loaded: true, nock: 1 });
      for (let i=0;i<70;i++) weaponReview.frame(1/60, false);
      if (pose === 'released') { weaponReview.fire(); weaponReview.bow({ draw: 0, loaded: false, nock: 0 }); for (let i=0;i<6;i++) weaponReview.frame(1/60,false); }
      weaponReview.frame();
     }, { mode, pose });
     const name = `${device}-${mode}-bow-${pose}`, info = await page.evaluate(() => weaponReview.info()); validate(info,name);
     if (mode === 'third' && pose === 'full-draw') { info.rig = await page.evaluate(() => weaponReview.rig()); console.log(JSON.stringify({ name, rig: info.rig })); }
     assert.ok(info.bow, name + ': missing bow diagnostics');
     await page.screenshot({ path: path.join(OUT, name + '.png') }); records.push({ name, device, mode, id: 'reedline-hunting-bow', pose, info }); console.log(name);
    }
   }
   if (device === 'desktop' && process.env.ARMAMENT_BOW !== '0') {
    const measurements = await page.evaluate(() => weaponReview.bowFits()); assert.equal(measurements.length,27);
    for (const row of measurements) validate(row, 'fit ' + JSON.stringify(row)); fits.push(...measurements);
   }
   assert.equal(await page.evaluate(() => weaponReview.failed()), 0, device + ': shader compile failure');
   // Keep contexts alive until browser.close(): single-process Chromium may exit when one closes.
  }
  assert.deepEqual(errors, [], 'Browser errors');
  await fs.writeFile(path.join(OUT, 'armament-review-metrics.json'), JSON.stringify({ generated: new Date().toISOString(), source: 'Production createViewmodel/createHand using real MakeHuman rig', records, fits, errors }, null, 2));
  console.log(JSON.stringify({ output: OUT, states: records.length, bowFits: fits.length, errors }));
 } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exit(1); });
