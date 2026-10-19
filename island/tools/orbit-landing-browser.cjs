// Orbit Earth, then come down: back to the departure, onto a new place, and back again from a
// new place mid-descent. Real index.html, Enter world, real frames for everything the ground
// streams on. Run against the full site:
//   BARD_URL=http://127.0.0.1:8766 node island/tools/orbit-landing-browser.cjs [desktop|phone] [shots dir]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, devices } = require('playwright');

const profile = process.argv[2] || 'desktop', shots = process.argv[3] || '';
(async () => {
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const ctx = await browser.newContext(profile === 'phone' ? { ...devices[process.env.PHONE || 'iPhone 14'] } : { viewport: { width: 1280, height: 720 } });
		const page = await ctx.newPage();
		page.setDefaultTimeout(240000);
		const errors = [];
		let navigations = 0;
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
		page.on('crash', () => errors.push('page crashed'));
		page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
		const shot = async (name) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/${profile}-${name}.png` }); } };
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/', { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => window.L99IslandDoor);
		await page.evaluate(() => L99IslandDoor.open());
		await page.waitForSelector('.bl-enter', { state: 'visible' });
		await page.locator('.bl-enter').click();
		await page.waitForFunction(() => window.L99Island?.world?.() && !window.L99Loading.active());
		console.log(`${profile}: in the world`);
		const climb = () => page.evaluate(() => {
			const W = L99Island.world(), P = W.player.state;
			P.flying = true; P.flyUp = true; P.boost = 9;
			let n = 0; for (; n < 30000 && W.orbit.info().altitude < 180000; n++) { W.orbit.before(); W.player.update(1/60, n/60); W.orbit.after(1/60); }
			P.flyUp = false; P.boost = 9; P.vel.set(0, 0, 0);
			return W.orbit.info();
		});
		const card = () => page.evaluate(() => Crysis.landing());
		// (the descent itself is stepped at 60 Hz here, as a phone would run it; a charting hold
		// waits on real frames, since the new place's ground streams on the page's own loop)
		const ground = async (h) => {
			for (let k = 0; k < 400; k++) {
				const s = await page.evaluate((h) => {
					const W = L99Island.world(), P = W.player.state, O = W.orbit;
					for (let n = 0; n < 240; n++) {
						if (!O.active() && P.pos.y < h) return 'down';
						if (O.landing().charting) return 'charting';
						O.before(); W.player.update(1/60, n/60); O.after(1/60);
					}
					return 'falling';
				}, h);
				if (s === 'down') return;
				if (s === 'charting') await page.waitForFunction(() => !Crysis.landing().charting, null, { polling: 250 });
				else await page.waitForTimeout(50);
			}
			throw new Error('never reached the ground');
		};

		// 1. Out to orbit over the Bay, across to Paris, and back to the departure.
		let o = await climb();
		const departure = o.anchor;
		assert.ok(o.altitude > 100000 && Number.isFinite(departure.lat));
		await page.waitForFunction(() => document.querySelector('[data-orbit-hud]')?.textContent.includes('SPACE'));
		assert.equal(await page.evaluate(() => Crysis.orbitOver(48.85, 2.35, 400)), true);
		await page.waitForFunction(() => Crysis.landing().card?.includes('Paris'));
		let c = await card();
		assert.match(c.note.sub, /France/); assert.ok(Math.abs(c.below.lat - 48.85) < .05 && Math.abs(c.below.lon - 2.35) < .05);
		// the real imagery: the globe and the sharp tiles round Paris come in
		const sharp = () => page.waitForFunction(() => { const i = Crysis.orbitImagery(); return i.base && i.box.ready && i.loaded >= Math.min(6, i.tiles) && i.tiles > 0; }, null, { polling: 250 });
		await sharp();
		await page.waitForTimeout(1500);
		let im = await page.evaluate(() => Crysis.orbitImagery());
		assert.ok(Math.abs(im.box.lat - 48.85) < im.box.latSpan / 4, JSON.stringify(im.box));
		await shot('orbit-over-paris');
		console.log(`${profile}: over Paris: ${c.note.title}: ${c.note.sub} (imagery level ${im.box.level}, ${im.loaded}/${im.tiles} tiles)`);
		await page.evaluate(() => Crysis.orbitOver(48.85, 2.35, 150));
		await page.waitForFunction(() => Crysis.orbitImagery().box.latSpan < 4, null, { polling: 250 });
		await sharp();
		await page.waitForTimeout(1500);
		im = await page.evaluate(() => Crysis.orbitImagery());
		assert.equal(im.box.level, 2);
		await shot('paris-150km');
		console.log(`${profile}: 150 km over Paris (imagery level ${im.box.level}, ${im.loaded}/${im.tiles} tiles)`);
		await page.locator('[data-land-home]').click();
		await page.waitForFunction(() => Crysis.landing().gliding);
		await shot('gliding-home');
		await page.waitForFunction(() => !Crysis.landing().gliding);
		await page.waitForTimeout(800);
		c = await card();
		assert.ok(Math.abs(c.below.lat - departure.lat) < .05 && Math.abs(c.below.lon - departure.lon) < .05, JSON.stringify(c.below));
		await ground(9000);
		const back = await page.evaluate((a) => { const P = L99Island.world().player.state; return Math.hypot(P.pos.x - a.x, P.pos.z - a.z); }, departure);
		// on the ground the imagery is let go
		assert.equal((await page.evaluate(() => Crysis.orbitImagery())).tiles, 0);
		assert.ok(back < 1, `${back} m from the departure`);
		console.log(`${profile}: back at the departure, ${back.toFixed(4)} m off`);

		// 2. Out again, over Paris, and Land here: charted, held, then down onto Paris's own ground.
		o = await climb();
		await page.evaluate(() => Crysis.orbitOver(48.85, 2.35, 400));
		await page.waitForFunction(() => Crysis.landing().card?.includes('Paris'));
		await page.locator('[data-land-here]').click();
		await page.waitForFunction(() => Crysis.landing().fresh);
		c = await card();
		assert.match(c.place.title, /Paris/);
		await shot('charting-paris');
		await ground(9000);
		await page.waitForTimeout(3000);
		const paris = await page.evaluate(() => ({ at: Crysis.globe().at, region: Crysis.globe().region, y: L99Island.world().player.state.pos.y }));
		const [plat, plon] = paris.at.split(',').map(Number);
		assert.ok(Math.abs(plat - 48.85) < .3 && Math.abs(plon - 2.35) < .3, paris.at);
		await shot('down-on-paris');
		console.log(`${profile}: down over Paris at ${paris.at} (${paris.region})`);

		// 3. Out from Paris, over Tokyo, start down, then turn back mid-descent to Paris.
		o = await climb();
		const home2 = o.anchor;
		await page.evaluate(() => Crysis.orbitOver(35.68, 139.69, 300));
		await page.waitForFunction(() => Crysis.landing().card?.includes('Tokyo'));
		await page.locator('[data-land-here]').click();
		await page.waitForFunction(() => Crysis.landing().fresh);
		await page.locator('[data-land-home]').click();
		await page.waitForFunction(() => !L99Island.world().orbit.active() && document.querySelector('.bl-enter') == null || !L99Island.world().orbit.active(), null, { polling: 250 });
		await page.waitForTimeout(4000);
		const again = await page.evaluate(() => Crysis.globe().at);
		const [alat, alon] = again.split(',').map(Number);
		assert.ok(Math.abs(alat - home2.lat) < .3 && Math.abs(alon - home2.lon) < .3, `${again} vs ${home2.lat}, ${home2.lon}`);
		console.log(`${profile}: turned back from Tokyo to ${again}`);

		// and the world keeps running for a while with nothing wrong
		await page.waitForTimeout(10000);
		const gpu = await page.evaluate(() => ({ failed: L99Island.renderer().info.programs.filter(p => p.diagnostics?.runnable === false).length, lost: L99Island.renderer().getContext().isContextLost() }));
		assert.equal(gpu.failed, 0); assert.equal(gpu.lost, false);
		assert.equal(navigations, 1, 'the page navigated again');
		assert.deepEqual(errors, []);
		console.log(`${profile}: PASS`);
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
