// Real production bundle: leave a submerged world, visit a dry one, return to Earth.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const server = http.createServer((req, res) => {
 const url = new URL(req.url, 'http://local');
 if (url.pathname === '/fixture') { res.setHeader('Content-Type', 'text/html'); return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/loading-screen.js"></script><script type="module">import {island} from '/island/dist/island.js';window.game=island();</script>`); }
 const file = path.resolve(root, '.' + url.pathname);
 if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
 try { res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); } catch { res.writeHead(404).end(); }
});
(async () => {
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
 const errors = [];
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 320 }, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile' });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/fixture?safe');
  await page.waitForFunction(() => window.game, null, { timeout: 60000 });
  for (const biome of ['TROPICAL', 'OCEAN', 'MOON', 'TROPICAL']) {
   console.log('Opening', biome);
   const state = await page.evaluate(async biome => {
    const old = game.world();
    await game.enter({ earth: biome === 'TROPICAL', biome, seed: 1337 });
    // Capture entry before the next animation frame can hide a stale immersion value.
    const w = game.world(), p = w.player.state;
    const entry = { biome, y: p.pos.y, ground: w.island.heightAt(p.pos.x, p.pos.z), swimming: p.swimming, under: game.shared.uUnder.value, hasOcean: w.island.hasOcean, oldWaterReleased: !old?.water || !old.water.ready(), oldWaterDetached: !old?.water || !old.water.group.parent, lost: game.renderer().getContext().isContextLost() };
    game.close();
    return entry;
   }, biome);
   assert.equal(state.swimming, false); assert.equal(state.under, 0); assert.equal(state.lost, false);
   assert.ok(state.y >= state.ground + 1.6); assert.equal(state.oldWaterReleased, true); assert.equal(state.oldWaterDetached, true);
   if (biome === 'MOON') assert.equal(state.hasOcean, false);
   console.log('PASS arrival', JSON.stringify(state));
   if (biome === 'OCEAN') {
    const contact = await page.evaluate(() => {
     const w = game.world(), p = w.player.state;
     const x = w.island.half - 30, z = w.island.half - 30;
     p.pos.set(x, 1000, z); p.flying = p.swimming = p.diving = false; p.vel.set(0, 0, 0);
     w.player.update(.1, 0);
     const airborne = !p.swimming && p.pos.y > 999;
     p.pos.y = -2; p.vel.set(0, 0, 0); w.player.update(.1, 0);
     const submerged = p.swimming && p.diving && p.pos.y < -1.9;
     // Leave while the underwater view is active to exercise the next entry reset.
     game.shared.uUnder.value = 1;
     return { airborne, submerged };
    });
    assert.equal(contact.airborne, true); assert.equal(contact.submerged, true);
    console.log('PASS airborne and underwater arrivals', JSON.stringify(contact));
   }
  }
  assert.deepEqual(errors, []);
  console.log('PASS Earth → submerged ocean planet → Moon → Earth, no runtime errors');
 } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
