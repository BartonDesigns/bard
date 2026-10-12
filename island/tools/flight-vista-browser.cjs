// Bundle flight-vista-preview.mjs first. Set BARD_VISTA_BUNDLE, BARD_BROWSER,
// BARD_PLAYWRIGHT and BARD_VISTA_OUT for the local runtime.
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.BARD_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '../..');
const out = process.env.BARD_VISTA_OUT || path.join(root, 'docs/verification/flight-vistas');
(async () => {
 await fs.mkdir(out, { recursive: true });
 const server = http.createServer(async (req, res) => {
  try {
   const url = new URL(req.url, 'http://localhost');
   if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<script type="module" src="/island/dist/vista-review.js"></script>'); return; }
   const file = url.pathname === '/island/dist/vista-review.js' ? process.env.BARD_VISTA_BUNDLE : path.resolve(root, '.' + decodeURIComponent(url.pathname));
   if (url.pathname !== '/island/dist/vista-review.js' && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
   res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream'); res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
 });
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 let browser; const report = { method: 'Isolated production orbital material, Chromium software WebGL; timings are not native-device performance', states: [], errors: [] };
 try {
  browser = await chromium.launch({ executablePath: process.env.BARD_BROWSER, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) report.errors.push(m.text()); });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => !!window.vista);
  const before = process.env.BARD_VISTA_BEFORE ? (await fs.readFile(process.env.BARD_VISTA_BEFORE, 'utf8')).split('export const ORBIT_FRAGMENT = /* glsl */`')[1].split('`;')[0] : null;
  for (const config of [
   { type: 'TERRAN' }, { type: 'TERRAN', near: true }, { type: 'OCEAN' }, { type: 'ARID' }, { type: 'MAGMA' }, { type: 'ICE' }, { type: 'GAS' }, { type: 'TERRAN', airless: true }, { type: 'TERRAN', earth: true }
  ]) for (const phone of [false, true]) {
   const id = [config.earth ? 'earth' : config.airless ? 'airless' : config.type.toLowerCase(), config.near ? 'horizon' : 'orbit', phone ? 'phone' : 'desktop'].join('-');
   if (before && !phone) { await page.evaluate(c => vista.render(c), { ...config, before }); await page.screenshot({ path: path.join(out, id + '-before.png') }); }
   const result = await page.evaluate(c => vista.render(c), { ...config, phone });
   assert.equal(result.glError, 0); assert.equal(result.shaderOK, true); assert.ok(result.bright > 1000);
   if (config.earth) assert.equal(result.mapReady, 1);
   await page.screenshot({ path: path.join(out, id + '.png') });
   report.states.push({ id, ...result }); console.log('PASS', id, Math.round(result.ms) + 'ms');
  }
  assert.deepEqual(report.errors, []); report.passed = true;
  await page.evaluate(() => vista.dispose());
 } finally { await browser?.close(); server.close(); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
})().catch(e => { console.error(e); process.exitCode = 1; });
