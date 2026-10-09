// Production bundle + trusted mouse/touch input. Run under /tmp/bard-browser.lock.
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const runtime = process.env.BARD_RENDER_RUNTIME || '/workspace/scratch/5c8900291977/arms-render-runtime/node_modules';
const { chromium } = require(path.join(runtime, 'playwright-core'));
const Chrome = require(path.join(runtime, '@sparticuz/chromium/build/index.js')).default;
const root = path.resolve(__dirname, '..'), out = process.env.BARD_INPUT_OUT || path.join(root, 'docs/verification/armament-input');
const report = { checks: [], errors: [], method: 'Production bundle, Playwright mouse/keyboard and trusted CDP touch events; mobile-tier Chromium software WebGL' };
const mark = (name, data) => { report.checks.push({ name, data }); console.log('PASS', name, JSON.stringify(data || {})); };
(async () => {
  await fs.mkdir(out, { recursive: true });
  report.bundleSha256 = crypto.createHash('sha256').update(await fs.readFile(path.join(root, 'island/dist/island.js'))).digest('hex');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
      const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' })[path.extname(file)] || 'application/octet-stream');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, page;
  const deadline = setTimeout(() => { console.error('Input gate exceeded 12 minute budget'); process.exit(2); }, 12 * 60 * 1000);
  try {
    const chromeRuntime = process.env.CHROMIUM_RUNTIME || '/workspace/scratch/5c8900291977/armament-chromium-runtime';
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || path.join(chromeRuntime, 'chromium'), args: Chrome.args, env: { ...process.env, LD_LIBRARY_PATH: chromeRuntime, FONTCONFIG_PATH: path.join(chromeRuntime, 'fonts') } });
    const context = await browser.newContext({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1' });
    page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', e => { report.errors.push(e.message); console.log('PAGEERROR', e.message); });
    page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_/.test(m.text())) report.errors.push(m.text()); });
    await page.goto('http://127.0.0.1:' + server.address().port + '/?offline&safe&lite', { waitUntil: 'domcontentloaded' });
    console.log('BOOT game');
    await page.evaluate(async () => {
      const a = await L99IslandDoor.engine(); await a.open({ seed: 1337, earth: false });
      Crysis.music.auto(false); window._KEYS_PLAY_ON = false; Crysis.combat.ambient(false);
      Crysis.combat.arm('reedline-hunting-bow', 1, 0);
      window.inputProof = [];
      for (const type of ['pointerdown', 'pointerup', 'pointercancel']) addEventListener(type, e => inputProof.push({ type, trusted: e.isTrusted, pointer: e.pointerType }), true);
    });
    const wait = (fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 250 });
    const state = () => page.evaluate(() => Crysis.combat.info().weapon);
    const frames = async (n = 2) => { const f = await page.evaluate(() => L99Island.renderer().info.render.frame); await wait(([f, n]) => L99Island.renderer().info.render.frame >= f + n, [f, n]); };
    await wait(() => Crysis.weapon.state().ready && Crysis.viewmodel().arms && Crysis.combat.info().weapon?.mag === 1 && Crysis.viewmodel().equip > .95);
    const initial = await state(); assert.equal(initial.mag + initial.reserve, 3); mark('game boot and actual bow rig ready', initial);
    const canvas = await page.locator('#l99-island-mount canvas').first().boundingBox(); assert.ok(canvas);
    const mouseAt = async () => page.mouse.move(canvas.x + canvas.width * .5, canvas.y + canvas.height * .5);
    const fullMouseDraw = async () => { await mouseAt(); await page.mouse.down(); await wait(() => Crysis.combat.info().weapon.draw >= .99); };
    await mouseAt(); await page.mouse.down(); await page.mouse.up(); await frames();
    assert.equal((await state()).shots, 0); assert.equal((await state()).mag, 1); mark('short mouse tap lets down without spending');
    await fullMouseDraw(); const holding = await state(); assert.equal(holding.mag, 1); assert.equal(holding.shots, 0); mark('mouse hold draws fully without firing', holding);
    await page.screenshot({ path: path.join(out, 'bow-full-draw.png') });
    await page.mouse.up(); await wait(() => Crysis.combat.info().weapon.shots === 1);
    await wait(() => !Crysis.combat.info().weapon.reloading && Crysis.combat.info().weapon.mag === 1 && !Crysis.weapon.state().reloading);
    const nocked = await state(); assert.equal(nocked.mag + nocked.reserve, 2); assert.equal(nocked.shots, 1); mark('release fires once and auto-nocks exactly one reserve arrow', nocked);
    await fullMouseDraw(); await page.keyboard.press('i'); await wait(() => Crysis.gear().open && !Crysis.combat.info().weapon.drawing); await page.mouse.up();
    let after = await state(); assert.equal(after.shots, 1); assert.equal(after.mag + after.reserve, 2); mark('opening gear cancels a drawn arrow', after);
    await page.keyboard.press('i'); await wait(() => !Crysis.gear().open && Crysis.weapon.state().ready);
    await fullMouseDraw(); await page.evaluate(() => dispatchEvent(new Event('blur'))); await page.mouse.up(); await frames();
    after = await state(); assert.equal(after.shots, 1); assert.equal(after.draw, 0); mark('blur cancellation preserves the loaded arrow', after);
    const cdp = await context.newCDPSession(page);
    const buttonPoint = async () => { const b = await page.locator('.cb-btn[aria-label="Draw"]').boundingBox(); assert.ok(b); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const touchStart = async () => { const p = await buttonPoint(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1, radiusX: 5, radiusY: 5, force: 1 }] }); await wait(() => Crysis.combat.info().weapon.draw >= .99); };
    await touchStart(); after = await state(); assert.equal(after.shots, 1); assert.equal(after.mag, 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await frames();
    after = await state(); assert.equal(after.shots, 1); assert.equal(after.draw, 0); assert.equal(after.mag, 1); mark('trusted touch cancellation lets down without firing', after);
    await touchStart(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(() => Crysis.combat.info().weapon.shots === 2);
    await wait(() => Crysis.combat.info().weapon.mag === 1 && !Crysis.combat.info().weapon.reloading && !Crysis.weapon.state().reloading);
    after = await state(); assert.equal(after.reserve, 0); assert.equal(after.mag + after.reserve, 1); mark('trusted touch release fires once and nocks the final reserve arrow', after);
    const proof = await page.evaluate(() => inputProof); assert.ok(proof.some(e => e.trusted && e.pointer === 'mouse' && e.type === 'pointerdown')); assert.ok(proof.some(e => e.trusted && e.pointer === 'touch' && e.type === 'pointercancel')); report.trustedEvents = proof;
    await page.evaluate(() => Crysis.combat.arm('warden-spark-carbine', 1, 0)); await wait(() => Crysis.combat.info().weapon?.id === 'warden-spark-carbine' && Crysis.weapon.state().ready && Crysis.viewmodel().equip > .95);
    const gunBefore = await state(); await mouseAt(); await page.mouse.down(); await wait(() => Crysis.combat.info().weapon.shots >= 2); await page.mouse.up();
    const gunFired = await state(); assert.ok(gunFired.mag <= gunBefore.mag - 2); const total = gunFired.mag + gunFired.reserve;
    await page.keyboard.press('r'); await wait(() => Crysis.combat.info().weapon.reloading); await page.keyboard.press('i'); await wait(() => Crysis.gear().open && !Crysis.combat.info().weapon.reloading);
    after = await state(); assert.equal(after.mag + after.reserve, total); mark('gun auto-fire works and interrupted reload preserves ammunition', after);
    await page.keyboard.press('i'); await wait(() => !Crysis.gear().open && Crysis.weapon.state().ready); await page.keyboard.press('r');
    await wait(() => Crysis.combat.info().weapon.reloading); await wait(() => !Crysis.combat.info().weapon.reloading && Crysis.combat.info().weapon.mag === 24);
    after = await state(); assert.equal(after.mag + after.reserve, total); mark('gun reload fills the magazine without duplicating reserve', after);
    await page.evaluate(() => Crysis.combat.arm('aurora-trail-rifle', 1, 0)); await wait(() => Crysis.combat.info().weapon?.id === 'aurora-trail-rifle' && Crysis.weapon.state().ready && Crysis.viewmodel().equip > .95);
    await mouseAt(); await page.mouse.down({ button: 'right' }); await wait(() => Crysis.viewmodel().optics?.forwardFrames > 0 && Crysis.viewmodel().optics?.rearFrames > 0 && Crysis.viewmodel().optics?.aiming);
    const optic = await page.evaluate(() => Crysis.viewmodel().optics); assert.equal(optic.sizes.rear, 64); assert.equal(optic.sizes.forward, 256); mark('real world scoped view renders forward image and rear reflection at phone budget', optic);
    await page.screenshot({ path: path.join(out, 'scope-world-aim.png') }); await page.mouse.up({ button: 'right' });
    const render = await page.evaluate(() => ({ lost: L99Island.renderer().getContext().isContextLost(), programs: L99Island.renderer().info.programs.every(p => p.diagnostics?.runnable !== false) }));
    assert.equal(render.lost, false); assert.equal(render.programs, true); assert.deepEqual(report.errors, []); report.passed = true;
  } catch (e) { report.failure = String(e.stack || e); if (page) { try { report.lastState = await page.evaluate(() => ({ combat: Crysis.combat.info().weapon, view: Crysis.viewmodel(), weapon: Crysis.weapon.state() })); await page.screenshot({ path: path.join(out, 'failure.png') }); } catch {} } throw e;
  } finally { clearTimeout(deadline); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
