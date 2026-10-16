// Browser event wiring and phone/desktop layout for the production combat controls.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = process.env.BARD_TARGET_QA || '/tmp/bard-target-controls';
const bundle = require('../node_modules/esbuild').buildSync({ stdin: { contents: "export * from './src/combat/target-focus.js'; export * from './src/combat/melee-touch.js'; export * from './src/combat/melee-rules.js'; export * from './src/ui/touch-skin.js'; export * from 'three';", resolveDir: root }, bundle: true, format: 'iife', globalName: 'Game', write: false }).outputFiles[0].text;
(async () => {
 fs.mkdirSync(out, { recursive: true });
 const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox'] });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent('<div id="l99-island-mount" class="l99-touch" style="position:fixed;inset:0;background:linear-gradient(#26393e,#152529);--sl:0px;--sr:0px;--st:0px;--sb:0px"><canvas></canvas></div>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
   const mount = document.querySelector('#l99-island-mount');
   window.camera = new Game.PerspectiveCamera(65, innerWidth / innerHeight, .1, 100); camera.position.set(0, 1.7, 0); camera.updateMatrixWorld();
   const a = { id: 'a', kind: 'hostile', name: 'Flanker', bound: { x: 0, y: 1.2, z: -8 } }, b = { id: 'b', kind: 'hostile', name: 'Marksman', bound: { x: 3, y: 1.2, z: -12 } };
   window.map = new Map([['a', a], ['b', b]]); window.allowed = true; window.occluded = false;
   window.focus = Game.createTargetFocus({ layer: { map, get: id => map.get(id) }, camera, mount, active: () => allowed, blocked: () => occluded, hostile: () => true, vector: () => new Game.Vector3() });
   window.striker = Game.createStriker();
   window.pad = Game.createMeleeTouch({ mount, on: { strike: d => d ? striker.press() : striker.release(), heavy: d => d ? striker.press({ heavy: true }) : striker.release(), block: () => {}, dodge: () => {}, grab: () => {}, cancel: () => striker.cancel() } });
   pad.update(true, true, false, false, null); window.skin = Game.skinTouch(mount); focus.update(.16);
   window.cameraBefore = camera.quaternion.toArray();
  });
  await page.keyboard.press('l'); assert.equal(await page.evaluate(() => focus.info().id), 'a');
  await page.keyboard.press('Shift+L'); assert.equal(await page.evaluate(() => focus.info().id), 'b');
  assert.deepEqual(await page.evaluate(() => camera.quaternion.toArray()), await page.evaluate(() => cameraBefore), 'locking never steers the camera');
  await page.evaluate(() => focus.update(.016));
  for (const [width, height, name] of [[390,844,'portrait'], [844,390,'landscape']]) {
   await page.setViewportSize({ width, height }); await page.evaluate(() => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); focus.update(.16); });
   const boxes = await page.evaluate(() => [...document.querySelectorAll('.mc-btn,.combat-focus-controls button')].filter(b => getComputedStyle(b).display !== 'none').map(b => ({ name: b.getAttribute('aria-label'), ...b.getBoundingClientRect().toJSON() })));
   for (const b of boxes) { assert.ok(b.width >= 44 && b.height >= 44, b.name); assert.ok(b.x >= 0 && b.right <= width && b.y >= 0 && b.bottom <= height, b.name); }
   for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) { const a=boxes[i],b=boxes[j]; assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top, `${name}: ${a.name} overlaps ${b.name}`); }
   await page.screenshot({ path: path.join(out, name+'.png') });
  }
  const result = await page.evaluate(() => {
   const fire = (b, type, id) => b.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, bubbles: true, cancelable: true }));
   fire(pad.buttons.strike, 'pointerdown', 1); const instant = striker.state.move === 'jab';
   fire(pad.buttons.strike, 'pointerup', 2); const otherFingerIgnored = striker.state.press;
   fire(pad.buttons.strike, 'pointerup', 1); let hits=0; for(let i=0;i<30;i++) hits+=striker.tick(1/60).length;
   fire(pad.buttons.heavy, 'pointerdown', 3); const charging = striker.state.charging;
   for(let i=0;i<30;i++) striker.tick(1/60); fire(pad.buttons.heavy, 'pointercancel', 3); const cancelled = !striker.state.move && !striker.state.charging;
   for(let i=0;i<30;i++) hits+=striker.tick(1/60).length;
   occluded = true; focus.update(.16); const hidden = document.querySelector('.combat-focus-marker').style.display === 'none'; focus.update(.65); const unlocked = !focus.info().id;
   return { instant, otherFingerIgnored, hits, charging, cancelled, hidden, unlocked };
  });
  assert.deepEqual(result, { instant:true, otherFingerIgnored:true, hits:1, charging:true, cancelled:true, hidden:true, unlocked:true });
  await page.evaluate(() => { occluded=false; focus.update(.16); });
  await page.getByRole('button', { name: 'Lock target (L or middle mouse); press again to release', exact: true }).tap();
  assert.equal(await page.evaluate(() => focus.info().id), 'a');
  await page.evaluate(() => { allowed=false; focus.update(.16); });
  assert.equal(await page.evaluate(() => focus.info().id), null);
  assert.deepEqual(errors, []); console.log('PASS target cycling, no camera steering, touch press/cancel, line-of-sight and portrait/landscape controls', JSON.stringify(result));
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
