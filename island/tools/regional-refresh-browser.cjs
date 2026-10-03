// Full faceplate regression: explicit month and frame changes refresh regional
// climate on the very first regional update, before its normal 0.5-second cache.
// Run under flock /tmp/bard-browser.lock; software WebGL is not a phone FPS test.
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
			const api = await L99IslandDoor.engine(); await api.open({ seed: 1337, earth: true });
			Crysis.music.auto(false); await Crysis.atlas(78.2232, 15.6469); api.close();
			// Hiding pauses the automatic update loop. Each fixture below calls precisely
			// one regional update with dt=0, so time cannot expire the old cached profile.
		});
		const results = [];
		for (const spot of [
			{ name: 'Svalbard', lat: 78.2232, lon: 15.6469, month: 1, polar: 'night', season: 'winter' },
			{ name: 'Svalbard', lat: 78.2232, lon: 15.6469, month: 7, polar: 'sun', season: 'summer' },
			// Same selected month across a hemisphere jump isolates the frame invalidation.
			{ name: 'Antarctic', lat: -77.85, lon: 166.67, month: 7, polar: 'night', season: 'winter' },
			{ name: 'Antarctic', lat: -77.85, lon: 166.67, month: 1, polar: 'sun', season: 'summer' },
		]) {
			const result = await page.evaluate(async spot => {
				const api = L99Island, W = api.world(), camera = api.camera();
				const here = W.globe.regional.here;
				// Only move for a different place. Month-only fixtures keep the frame epoch.
				if (Math.abs((here.lat ?? 0) - spot.lat) > 1e-6 || Math.abs((here.lon ?? 0) - spot.lon) > 1e-6) {
					const q = W.globe.place(spot.lat, spot.lon); await q.ready;
					W.player.state.pos.set(q.x, Math.max(0, W.island.heightAt(q.x, q.z)) + 16, q.z);
					W.player.state.vel.set(0, 0, 0); W.player.state.flying = true; camera.position.copy(W.player.state.pos);
				}
				Crysis.month(spot.month); W.sky.state.speed = 0; W.sky.update(0, camera.position);
				const sun = { ...W.sky.state.sun }; W.sky.state.hours = sun.noon; W.sky.update(0, camera.position); const noonY = api.shared.uSunDir.value.y;
				W.sky.state.hours = (sun.noon + 12) % 24; W.sky.update(0, camera.position); const midnightY = api.shared.uSunDir.value.y;
				W.globe.regional.update(0, camera, { night: W.sky.uniforms.uNight.value, out: true, wind: { x: .3, y: 0 } });
				const regional = { lat: here.lat, lon: here.lon, coast: here.coast, climate: { ...here.climate } };
				api.renderer().render(api.scene(), camera); api.renderer().getContext().finish();
				return { name: spot.name, month: spot.month, epoch: W.globe.frame.epoch, sun, noonY, midnightY, regional,
					gpu: { lost: api.renderer().getContext().isContextLost(), failed: api.renderer().info.programs.filter(p => p.diagnostics?.runnable === false).length } };
			}, spot);
			assert.equal(result.sun.polar, spot.polar); assert.equal(result.regional.climate.polar, result.sun.polar);
			assert.equal(result.regional.climate.season, spot.season); assert.equal(result.regional.climate.south, spot.lat < 0);
			assert.ok(Math.abs(result.regional.lat - spot.lat) < 1e-6); assert.ok(Math.abs(result.regional.lon - spot.lon) < 1e-6);
			assert.ok(Math.abs(result.sun.lat - spot.lat) < 1e-6);
			assert.ok(spot.polar === 'sun' ? result.midnightY > 0 : result.noonY < 0);
			assert.equal(result.gpu.failed, 0); assert.equal(result.gpu.lost, false);
			results.push(result); console.log(JSON.stringify(result));
		}
		assert.equal(results[0].epoch, results[1].epoch); assert.notEqual(results[1].epoch, results[2].epoch); assert.equal(results[2].epoch, results[3].epoch);
		assert.deepEqual(errors, []);
		console.log('First-update regional climate, rendered sun, same-month hemisphere teleport, and GPU checks passed');
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
