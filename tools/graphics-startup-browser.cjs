// Exercise real Three initialization from the shipped bundle with a driver fault.
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
 const root = path.resolve(__dirname, '..');
 const server = http.createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><script src="/loading-screen.js"></script>'); }
  try {
   const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
   if (!file.startsWith(root + path.sep)) throw Error('path');
   res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'); res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
 });
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 let browser;
 try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE,
   args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
   env: { ...process.env, ...(process.env.CHROME_EXECUTABLE ? { LD_LIBRARY_PATH: path.dirname(process.env.CHROME_EXECUTABLE) } : {}) } });
  for (const failures of [1, 2]) {
   const page = await browser.newPage({ viewport: { width: 640, height: 420 } }), errors = [];
   page.on('pageerror', e => errors.push(e.message));
   await page.goto('http://127.0.0.1:' + server.address().port);
   const result = await page.evaluate(async failures => {
    localStorage.clear();
    const original = HTMLCanvasElement.prototype.getContext, seen = new WeakSet(); let attempts = 0;
    HTMLCanvasElement.prototype.getContext = function (type, opts) {
     const gl = original.call(this, type, opts);
     if (type === 'webgl2' && gl && !seen.has(this)) {
      seen.add(this); attempts++;
      if (attempts <= failures) gl.getShaderPrecisionFormat = () => null;
     }
     return gl;
    };
    const engine = await import('/island/dist/island.js');
    let message = '', game;
    try { game = engine.island(); } catch (e) { message = e.message; }
    const firstMounts = document.querySelectorAll('#l99-island-mount').length, firstAttempts = attempts;
    HTMLCanvasElement.prototype.getContext = original;
    if (!game) game = engine.island();
    return { message, firstMounts, firstAttempts, mounts: document.querySelectorAll('#l99-island-mount').length,
     lost: game.renderer().getContext().isContextLost(), antialias: game.renderer().getContext().getContextAttributes().antialias };
   }, failures);
   assert.equal(result.firstAttempts, 2); assert.equal(result.mounts, 1);
   assert.equal(result.lost, false); assert.equal(result.antialias, false);
   assert.equal(result.firstMounts, failures === 1 ? 1 : 0);
   if (failures === 2) assert.match(result.message, /even with lighter settings/); else assert.equal(result.message, '');
   assert.deepEqual(errors, []);
   console.log('PASS', failures === 1 ? 'invalid first context recovers on one fresh canvas' : 'two failed contexts leave no HUD; a later retry succeeds with one HUD');
   await page.close();
  }
 } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
