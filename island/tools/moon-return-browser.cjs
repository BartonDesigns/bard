// Out to the Moon and back: fly at the Moon from Earth orbit (the Moon world is built behind the
// veil), then fly at Earth from the Moon's orbit. Earth is reached in orbit over where you left,
// the ship already coming down, and the ground streams in on the way; the page holds through
// touchdown and thirty seconds after. Real index.html, Enter world. Run against the full site:
//   BARD_URL=http://127.0.0.1:8766 node island/tools/moon-return-browser.cjs [desktop|phone]
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

const profile = process.argv[2] || 'desktop';
(async () => {
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const ctx = await browser.newContext(profile === 'phone' ? { ...devices[process.env.PHONE || 'iPhone 14'] } : { viewport: { width: 1280, height: 720 } });
		const page = await ctx.newPage();
		page.setDefaultTimeout(300000);
		const errors = [];
		let navigations = 0;
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
		page.on('crash', () => errors.push('page crashed'));
		page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
		const log = (...a) => console.log(`${profile}:`, ...a);
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/', { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => window.L99IslandDoor);
		await page.evaluate(() => L99IslandDoor.open());
		await page.waitForSelector('.bl-enter', { state: 'visible' });
		await page.locator('.bl-enter').click();
		await page.waitForFunction(() => window.L99Island?.world?.() && !window.L99Loading.active());
		log('in the world');
		// (the climb and the descent are stepped at 60 Hz, as a phone would run them)
		const climb = () => page.evaluate(() => {
			const W = L99Island.world(), P = W.player.state;
			P.flying = true; P.flyUp = true; P.boost = 9;
			let n = 0; for (; n < 30000 && W.orbit.info().altitude < 180000; n++) { W.orbit.before(); W.player.update(1/60, n/60); W.orbit.after(1/60); }
			P.flyUp = false; P.boost = 9; P.vel.set(0, 0, 0);
			return W.orbit.info();
		});
		// fly at the companion (the Moon from Earth, Earth from the Moon): the approach lands you
		const approach = () => page.evaluate(() => {
			const W = L99Island.world(), P = W.player.state, b = W.orbit.bodies().find((q) => q.id === 'companion');
			const dir = P.pos.clone().sub(b.pos).normalize();
			P.pos.copy(b.pos).addScaledVector(dir, b.size + 20000); P.vel.set(0, 0, 0);
			W.orbit.before(); W.orbit.after(1/60);
			return { name: b.name, landing: W.orbit.info().landing };
		});
		const veil = () => page.evaluate(() => { const v = document.querySelector('[data-travel-veil]'); return v ? { up: v.style.opacity === '1', text: v.textContent } : null; });

		// 1. Up from the island, and at the Moon.
		let o = await climb();
		const departure = o.anchor;
		assert.ok(departure && Number.isFinite(departure.lat), JSON.stringify(o));
		let a = await approach();
		assert.equal(a.name, 'The Moon'); assert.ok(a.landing);
		log(`at the Moon from ${departure.lat.toFixed(3)}, ${departure.lon.toFixed(3)}`);
		await page.waitForFunction(() => { const v = document.querySelector('[data-travel-veil]'); return v && v.style.opacity === '1'; }, null, { polling: 100 });
		log('veil up:', JSON.stringify(await veil()));
		await page.waitForFunction(() => { const W = L99Island.world(); return W && W.orbit && W.orbit.info().type === 'MOON' && !W.orbit.active(); }, null, { polling: 250 });
		await page.waitForFunction(() => document.querySelector('[data-travel-veil]').style.opacity === '0', null, { polling: 250 });
		log('on the Moon, veil lifted');
		assert.deepEqual(errors, []);

		// 2. Up from the Moon, and at Earth: in orbit over the departure, coming down.
		o = await climb();
		assert.equal(o.type, 'MOON');
		a = await approach();
		assert.equal(a.name, 'Earth'); assert.ok(a.landing);
		await page.waitForFunction(() => { const v = document.querySelector('[data-travel-veil]'); return v && v.style.opacity === '1' && v.textContent === 'Earth'; }, null, { polling: 100 });
		log('flying at Earth, veil up');
		await page.waitForFunction(() => { const W = L99Island.world(); return W && W.orbit && W.orbit.info().type === 'EARTH' && W.orbit.active() && W.orbit.landing().arriving; }, null, { polling: 250 });
		const arrived = await page.evaluate(() => { const W = L99Island.world(), P = W.player.state; return { alt: W.orbit.info().altitude, down: P.descendAssist, flying: P.flying, home: W.orbit.landing().home, veil: document.querySelector('[data-travel-veil]').style.opacity, hud: document.querySelector('[data-orbit-hud]')?.textContent }; });
		log('Earth reached:', JSON.stringify(arrived));
		assert.ok(arrived.alt > 100000 && arrived.alt < 200000, 'in orbit');
		assert.equal(arrived.down, true, 'coming down');
		assert.ok(Math.abs(arrived.home.lat - departure.lat) < .3 && Math.abs(arrived.home.lon - departure.lon) < .3, `${JSON.stringify(arrived.home)} vs the departure ${departure.lat}, ${departure.lon}`);
		await page.waitForFunction(() => document.querySelector('[data-travel-veil]').style.opacity === '0', null, { polling: 250 });
		log('veil lifted over Earth');

		// 3. Down to the ground, stepped as the player would fly it, nothing pressed.
		for (let k = 0; k < 400; k++) {
			const s = await page.evaluate(() => {
				const W = L99Island.world(), P = W.player.state, O = W.orbit;
				for (let n = 0; n < 240; n++) {
					if (!O.active() && !P.descendAssist) return 'down';
					O.before(); W.player.update(1/60, n/60); O.after(1/60);
				}
				return 'falling';
			});
			if (s === 'down') break;
			await page.waitForTimeout(50);
		}
		const down = await page.evaluate(() => { const W = L99Island.world(), P = W.player.state; return { y: P.pos.y, agl: P.pos.y - Math.max(0, W.island.heightAt(P.pos.x, P.pos.z)), orbit: W.orbit.active(), down: P.descendAssist, at: Crysis.globe().at }; });
		log('touchdown:', JSON.stringify(down));
		assert.equal(down.orbit, false); assert.equal(down.down, false);
		assert.ok(down.agl < 60, 'near the ground');

		// and the world keeps running for a while with nothing wrong
		await page.waitForTimeout(30000);
		const gpu = await page.evaluate(() => ({ failed: L99Island.renderer().info.programs.filter(p => p.diagnostics?.runnable === false).length, lost: L99Island.renderer().getContext().isContextLost() }));
		assert.equal(gpu.failed, 0); assert.equal(gpu.lost, false);
		assert.equal(navigations, 1, 'the page navigated again');
		assert.deepEqual(errors, []);
		log('PASS');
	} finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
