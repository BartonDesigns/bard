// A rebuild site in the real world, its crew close up: into the world, to San Francisco's
// financial district, a building near brought half down, the crew sent for, the camera walked
// up to them; who has a real body (structures/crewpeople.js), that they can be talked to, and
// what it looks like (OUT/<name>.png, read back from the canvas right after a render).
// Run: OUT=<dir> SETTLE=30000 node island/tools/crew-site-browser.cjs  (after node build.mjs)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(__dirname, '../..'), OUT = process.env.OUT || path.join(ROOT, 'docs/verification/crew');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		try {
			const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
			if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
			const d = fs.readFileSync(f);
			res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
			res.setHeader('Cache-Control', 'no-store');
			res.end(d);
		} catch { res.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [];
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html`, { timeout: 900000, waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Enter world' && b.offsetParent), null, { timeout: 900000 });
		await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enter world').click());
		await page.waitForFunction(() => window.Crysis?.world?.()?.structures && Crysis.world().bayArea?.loaded?.(), null, { timeout: 900000 });
		await page.evaluate(() => { const w = Crysis.world(), P = w.player.state; w.structures.forget(); Crysis.setHome(37.7915, -122.4005, 'fd'); Crysis.goHome(); P.flying = false; P.pos.y = w.island.heightAt(P.pos.x, P.pos.z) + 1.68; });
		await page.waitForTimeout(+(process.env.SETTLE || 30000));
		// a building down and its crew under way, the world then stepped by hand
		const site = await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
			const w = Crysis.world(), S = w.structures, P = w.player.state;
			const lots = w.city.lotsNear(P.pos.x, P.pos.z, 250).filter((o) => o.h > 12 && o.w > 12 && o.d > 12 && [2, 3, 5, 6, 9].includes(Math.floor(o.kind)) && o.slot !== undefined);
			lots.sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
			const o = lots[0];
			if (!o) return { error: 'no building near' };
			L99Island.camera().position.set(o.x + o.w, o.y + 10, o.z + o.d);
			Crysis.demolish(o.x, o.z, 0.6);
			for (let i = 0; i < 30; i++) S.update(1 / 30, 0, w.sky.state.hours);
			S.advance(0.5);
			for (let i = 0; i < 60; i++) S.update(1 / 30, 0, w.sky.state.hours);
			const R = S.rebuild, s = [...R.sites.values()][0];
			if (!s) return { error: 'no site' };
			window.__site = s;
			return { id: s.id, workers: s.workers.length, at: s.origin };
		});
		console.log('site', JSON.stringify(site));
		if (site.error) throw Error(site.error);
		// the camera walked up to the crew, a few seconds of the work stepped
		const shots = [['site-wide', 14, 5, 0], ['site-near', 6.5, 2.2, 1], ['site-close', 3.2, 1.75, 2], ['site-far', 30, 95, 0, 7, 85], ['site-far-crew-only', 40, 30, 0, 9, 1]];
		const result = {};
		for (const [name, dist, h, k, fov, near] of shots) {
			for (let pass = 0; pass < 8; pass++) {
				await page.evaluate(([dist, h, k, fov, near]) => {
					const w = Crysis.world(), S = w.structures, s = window.__site, cam = L99Island.camera();
					// (from past where the real people take over, zoomed in, the buildings between cut away
					// by the near plane: the far crew)
					window.__fov ??= cam.fov; window.__near ??= cam.near;
					cam.fov = fov || window.__fov; cam.near = near || window.__near; cam.updateProjectionMatrix();
					const wk = s.workers[Math.min(k, s.workers.length - 1)];
					// (stood off the worker toward the street, looking at them)
					const nx = s.G.n[0], nz = s.G.n[1];
					cam.position.set(wk.x + nx * dist + nz * dist * 0.35, wk.y + h, wk.z + nz * dist - nx * dist * 0.35);
					cam.lookAt(wk.x, wk.y + 1.1, wk.z); cam.updateMatrixWorld(true);
					for (let i = 0; i < 20; i++) S.update(1 / 30, 0, w.sky.state.hours);
				}, [dist, h, k, fov, near]);
				await page.waitForTimeout(400);
			}
			const r = await page.evaluate((only) => {
				const I = L99Island, ren = I.renderer();
				// (the crew alone, everything else hidden: how the far crew are lit in the world)
				const hid = [];
				if (only) I.scene().traverse((o) => { if (o.isMesh && o.visible && !/^structures-crew/.test(o.name)) { o.visible = false; hid.push(o); } });
				ren.render(I.scene(), I.camera());
				for (const o of hid) o.visible = true;
				const url = ren.domElement.toDataURL('image/png');
				const F = Crysis.world().structures.rebuild.folk;
				// (anyone near you to talk to: the talk button's own pick)
				const C = Crysis.world().structures.rebuild.crew;
				return { url, folk: F.info(), crewDrawn: C.count(), figures: C.figures?.(), bakes: C.bakes?.() };
			}, name.endsWith('crew-only'));
			fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
			result[name] = { folk: r.folk.map((b) => `${b.pose}/${b.tool || '-'}/${b.fade}`), crewDrawn: r.crewDrawn, figures: r.figures, bakes: r.bakes && { made: r.bakes.made.length, left: r.bakes.left, dead: r.bakes.dead } };
			console.log(name, JSON.stringify(result[name]));
		}
		const talk = await page.evaluate(() => {
			const F = Crysis.world().structures.rebuild.folk, b = [...F.bodies.values()].find((q) => q.fade >= 1);
			if (!b) return null;
			return { job: b.P.job, errand: b.P.errand };
		});
		console.log('talk', JSON.stringify(talk));
		console.log(JSON.stringify({ errors }));
		if (errors.length || !talk) process.exitCode = 1;
	} finally {
		await browser.close();
		server.close();
	}
})().catch((e) => { console.error(e); process.exitCode = 1; });
