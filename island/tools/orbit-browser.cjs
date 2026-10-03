// Run against the full site: BARD_URL=http://127.0.0.1:8766 node island/tools/orbit-browser.cjs
// Playwright and Chromium are supplied by the development environment.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const page = await browser.newPage({ viewport: { width: 480, height: 320 }, hasTouch: true, deviceScaleFactor: 1,
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15' });
		page.setDefaultTimeout(300000);
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await page.evaluate(async () => {
			const w = await L99IslandDoor.engine(); await w.open({ seed: 1337, earth: true });
			window.orbitCheck = { world: w.world(), context: w.renderer().getContext(), trips: 0, overlays: 0 };
			new MutationObserver(() => { if (w.dom.loading.style.display !== 'none') orbitCheck.overlays++; }).observe(w.dom.loading, { attributes: true });
			window._KEYS_PLAY_ON = false;
		});
		console.log('Full faceplate and Earth ready');
		await page.evaluate(async () => { initAudio(); await ctx.resume(); window._leadLatch = false; playLead('kbd:orbit-hold', 7, 1, false, .7); });
		// Real keyboard input, and cancellation of the launch assist, in the surface controller.
		await page.evaluate(() => { const P = L99Island.world().player.state; P.flying = true; P.climbAssist = true; });
		await page.keyboard.down('c');
		assert.equal(await page.evaluate(() => L99Island.world().player.state.climbAssist), false);
		await page.keyboard.up('c');
		for (let trip = 0; trip < 3; trip++) {
			const ascent = await page.evaluate(trip => {
				const W = L99Island.world(), P = W.player.state;
				P.flying = true; P.flyUp = true; P.boost = [3, 6, 9][trip];
				let n = 0; for (; n < 30000 && P.pos.y < 180000; n++) { W.orbit.before(); W.player.update(1/60, n/60); W.orbit.after(1/60); }
				P.flyUp = P.boost = false; P.vel.set(0, 0, 0); P.pitch = -.8;
				return { ticks: n, info: W.orbit.info(), same: W === orbitCheck.world, context: L99Island.renderer().getContext() === orbitCheck.context };
			}, trip);
			const saved = await page.evaluate(() => { const before = localStorage.getItem('crysis-resume'), held = L99Continuity.performance().notes.some(n => n.id === 'kbd:orbit-hold'); dispatchEvent(new Event('pagehide')); return { before, after: localStorage.getItem('crysis-resume'), held }; });
			assert.ok(saved.before); assert.equal(saved.before, saved.after);
			if (trip === 0) { assert.ok(saved.held); await page.evaluate(() => stopLead('kbd:orbit-hold', true)); }
			assert.ok(ascent.ticks < 30000); assert.ok(ascent.info.altitude > 100000); assert.ok(ascent.same && ascent.context);
			await page.waitForFunction(() => document.querySelector('[data-orbit-hud]')?.textContent.includes('SPACE'));
			// A held key still drives the very same controller above the rendering boundary.
			await page.keyboard.down('w');
			const steer = await page.evaluate(() => { const W = L99Island.world(), P = W.player.state, p = P.pos.clone(); W.player.update(.05, 0); return P.pos.distanceTo(p); });
			assert.ok(steer > 0); await page.keyboard.up('w');
			const descent = await page.evaluate(trip => {
				const W = L99Island.world(), P = W.player.state, a = W.orbit.info().anchor;
				P.vel.set(0, 0, 0); P.flyDown = true; P.boost = [3, 6, 9][trip];
				let n = 0; for (; n < 30000 && P.pos.y > 80; n++) { W.orbit.before(); W.player.update(1/60, n/60); W.orbit.after(1/60); }
				P.flyDown = P.boost = false; P.vel.set(0, 0, 0);
				return { ticks: n, error: Math.hypot(P.pos.x-a.x, P.pos.z-a.z), same: W === orbitCheck.world, entries: W.orbit.info().entries };
			}, trip);
			assert.ok(descent.ticks < 30000 && descent.same); assert.ok(descent.error < .001); assert.equal(descent.entries, trip + 1);
			console.log(`Round trip ${trip+1}: same world/context, exit error ${descent.error} m`);
		}
		const music = await page.evaluate(() => {
			const W = L99Island.world(), sample = L99Continuity.sample;
			L99Continuity.sample = () => ({ bass: 1, mid: .75, high: .5 });
			for (let n=0;n<120;n++) W.music.update(1/60);
			L99Continuity.sample = sample; return W.orbit.info().music;
		});
		assert.ok(music.bass > .99 && music.mid > .74 && music.high > .49 && music.thrust > 1.07 && music.thrust <= 1.12);
		// Losing focus must release keys, touches and assisted thrust.
		const released = await page.evaluate(() => { const P=L99Island.world().player.state; P.flyUp=P.flyDown=P.climbAssist=true; dispatchEvent(new Event('blur')); return !P.flyUp && !P.flyDown && !P.climbAssist; });
		assert.ok(released);
		const touch = await page.evaluate(() => {
			const W = L99Island.world(), P = W.player.state;
			L99Island.dom.down.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, pointerType: 'touch', bubbles: true }));
			const held = P.flyDown;
			L99Island.dom.down.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 42, pointerType: 'touch', bubbles: true }));
			return held && !P.flyDown;
		});
		assert.ok(touch);
		const gpu = await page.evaluate(() => ({ overlays: orbitCheck.overlays, failed: L99Island.renderer().info.programs.filter(p => p.diagnostics?.runnable === false).length, lost: L99Island.renderer().getContext().isContextLost(), memory: L99Island.renderer().info.memory }));
		assert.equal(gpu.overlays, 0); assert.equal(gpu.failed, 0); assert.equal(gpu.lost, false); assert.deepEqual(errors, []);
		console.log('Input, music, loading overlay and GPU checks passed', gpu);
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
