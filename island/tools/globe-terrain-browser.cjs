// Full-site WebGL regression: BARD_URL=http://127.0.0.1:8766 node island/tools/globe-terrain-browser.cjs
// Run browser checks serially. Playwright/Chromium are provided by the development environment.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	try {
		const page = await browser.newPage({ viewport: { width: 640, height: 400 }, hasTouch: true, deviceScaleFactor: 1,
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15' });
		page.setDefaultTimeout(300000);
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await page.evaluate(async () => {
			const api = await L99IslandDoor.engine(); await api.open({ seed: 1337, earth: true, at: { lat: -3.12, lon: -60.02 } });
			Crysis.music.auto(false); Crysis.month(6);
			const W = api.world(), P = W.player.state, p = W.globe.place(-3.12, -60.02); await p.ready;
			P.pos.set(p.x, Math.max(0, W.island.heightAt(p.x, p.z)) + 80, p.z);
			P.pitch = -.65; P.yaw = 0; P.flying = true; P.vel.set(0, 0, 0); api.camera().position.copy(P.pos);
			W.sky.state.hours = 14; W.sky.state.speed = 0;
		});
		await page.evaluate(() => new Promise(resolve => {
			let n = 0; const step = () => ++n >= 12 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step);
		}));
		if (process.env.BARD_GROUND_SCREENSHOT) await page.screenshot({ path: process.env.BARD_GROUND_SCREENSHOT });
		const result = await page.evaluate(() => {
			const api = L99Island, T = api.T, W = api.world(), G = W.globe, renderer = api.renderer();
			// Render the actual terrain material in a small isolated scene so moving foliage,
			// sky, post-processing and UI cannot hide a material regression in screenshot noise.
			const scene = new T.Scene(), cam = new T.OrthographicCamera(-30, 30, 30, -30, .1, 1000);
			cam.position.set(W.player.state.pos.x, G.height.at(W.player.state.pos.x, W.player.state.pos.z) + 300, W.player.state.pos.z);
			cam.up.set(0, 0, -1); cam.lookAt(cam.position.x, cam.position.y - 300, cam.position.z); cam.updateMatrixWorld();
			scene.add(new T.AmbientLight(0xffffff, 3));
			const ground = new T.Mesh(G.terrain.near.geometry, G.terrain.near.material); ground.frustumCulled = false; scene.add(ground);
			const target = new T.WebGLRenderTarget(64, 64), oldTarget = renderer.getRenderTarget();
			const treeTex = G.data.tex[2], climateTex = G.data.tex[3], treeData = treeTex.image.data.slice(), climateData = climateTex.image.data.slice();
			const cities = [{ x: cam.position.x, z: cam.position.z, r: 18000, k: 1 }];
			const draw = (built) => {
				G.terrain.update(cam, G.frame, { bay: false, bayOut: 1e9, night: 0, cities: built ? cities : [] });
				ground.position.copy(G.terrain.near.position); renderer.setRenderTarget(target); renderer.render(scene, cam);
				const px = new Uint8Array(64 * 64 * 4); renderer.readRenderTargetPixels(target, 0, 0, 64, 64, px); return px;
			};
			const compare = (a, b) => {
				let changed = 0, maximum = 0, sum = 0, green = 0;
				for (let i = 0; i < a.length; i += 4) {
					const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
					if (d > 1) changed++; maximum = Math.max(maximum, d); sum += d;
					if (a[i + 1] > a[i] && a[i + 1] > a[i + 2]) green++;
				}
				return { changed, maximum, mean: sum / 4096, green };
			};
			try {
				const jungle = compare(draw(true), draw(false)), cell = G.data.cellAt(-3.12, -60.02);
				// The urban hint must still appear on open land; the fix cannot disable cities.
				for (let i = 3; i < treeTex.image.data.length; i += 4) treeTex.image.data[i] = 0;
				treeTex.needsUpdate = true;
				const clear = compare(draw(true), draw(false));
				// A cold fixture uses the same GPU climate decoder and snow shader as live land.
				for (let i = 3; i < climateTex.image.data.length; i += 4) climateTex.image.data[i] = 48;
				climateTex.needsUpdate = true;
				const snow = compare(draw(true), draw(false));
				return { cell, jungle, clear, snow, failed: renderer.info.programs.filter(p => p.diagnostics?.runnable === false).length, lost: renderer.getContext().isContextLost() };
			} finally {
				treeTex.image.data.set(treeData); climateTex.image.data.set(climateData); treeTex.needsUpdate = climateTex.needsUpdate = true;
				renderer.setRenderTarget(oldTarget); target.dispose();
			}
		});
		assert.ok(result.cell.TEMP > 15 && result.cell.TREES > .6, 'real Manaus atlas sample must be warm forest');
		assert.ok(result.jungle.green > 4000, 'Manaus terrain must retain green forest ground');
		assert.ok(result.jungle.mean < .5, 'a broad city footprint must not pave dense jungle');
		assert.ok(result.clear.mean > 10 && result.clear.changed > 4000, 'urban tint must remain on open land');
		assert.ok(result.snow.mean < .5, 'city tint must not erase snow cover');
		assert.equal(result.failed, 0); assert.equal(result.lost, false); assert.deepEqual(errors, []);
		console.log('GPU terrain material: warm jungle, open urban land and cold snow passed', result);
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
