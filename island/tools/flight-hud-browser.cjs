const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const page = await browser.newPage({ viewport: { width: 480, height: 320 }, hasTouch: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
		page.setDefaultTimeout(300000);
		const errors = []; page.on('pageerror', e => errors.push(e.message));
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await page.evaluate(async () => { const api = await L99IslandDoor.engine(); await api.open({ seed: 1337, earth: true }); Crysis.music.auto(false); window._KEYS_PLAY_ON = false; });
		await page.waitForFunction(() => !!L99Island.world().bridge);
		assert.equal(await page.locator('[data-location-label]').count(), 1, 'Late bridge initialization must not create another banner');
		await page.evaluate(() => { const P = L99Island.world().player.state; P.flying = true; P.boost = 1; P.vel.set(0,0,0); P.pos.y = 1000; });
		const cycle = await page.evaluate(() => {
			const values = [];
			for (let i = 0; i < 4; i++) { L99Island.dom.boost.click(); values.push([L99Island.world().player.state.boost, L99Island.dom.boost.textContent]); }
			return values;
		});
		assert.deepEqual(cycle, [[3,'×3'],[6,'×6'],[9,'×9'],[1,'×1']]);
		await page.keyboard.press('b'); assert.equal(await page.evaluate(() => L99Island.world().player.state.boost), 3);
		await page.keyboard.down('w');
		const motion = await page.evaluate(() => {
			const W = L99Island.world(), P = W.player.state, origin = P.pos.clone(), orbit = P.orbit, results = [];
			try {
				for (const mode of ['surface','orbit']) {
					if (mode === 'surface') delete P.orbit; else P.orbit = orbit;
					const velocities = [];
					for (const boost of [1,3,6,9]) { P.pos.copy(origin); P.vel.set(0,0,0); P.boost = boost; W.player.update(1/60,0); velocities.push(P.vel.length()); }
					results.push({mode,ratios:velocities.map(v=>v/velocities[0])});
				}
			} finally { P.orbit = orbit; P.pos.copy(origin); P.vel.set(0,0,0); }
			return results;
		});
		await page.keyboard.up('w');
		for (const row of motion) row.ratios.forEach((v,i)=>assert.ok(Math.abs(v-[1,3,6,9][i])<1e-6,JSON.stringify(row)));
		// The real DOM timer fades even without labels.update or a game-time advance.
		const label = await page.evaluate(async () => {
			const { createLabels } = await import('/island/src/bay/labels.js');
			const mount = document.createElement('div'); document.body.appendChild(mount);
			const at = performance.now();
			const labels = createLabels(mount, {loaded:()=>true,farWhere:()=>({name:'Timer test',sub:'Current place'})}, null);
			labels.update({x:0,y:5,z:0},false);
			await new Promise(r=>setTimeout(r,1350)); labels.update({x:0,y:5,z:0},false);
			const box=mount.firstChild, visible=box.style.opacity;
			await new Promise(r=>setTimeout(r,9000));
			const faded=box.style.opacity, elapsed=performance.now()-at;
			labels.dispose();mount.remove();return {visible,faded,elapsed};
		});
		assert.equal(label.visible,'1'); assert.equal(label.faded,'0');
		await page.evaluate(() => L99Island.close());
		assert.equal(await page.locator('[data-location-label]').textContent(), '');
		await page.evaluate(async () => { await L99Island.open({seed:1338,earth:false,biome:'TROPICAL'}); });
		assert.equal(await page.locator('[data-location-label]').count(), 0, 'World replacement must dispose the location banner');
		assert.deepEqual(errors,[]);
		assert.equal(await page.evaluate(()=>L99Island.renderer().info.programs.filter(p=>p.diagnostics?.runnable===false).length),0);
		console.log(JSON.stringify({cycle,motion,label})); console.log('HUD lifecycle, real-clock fade, button/keyboard cycle and actual movement ratios passed');
	} finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
