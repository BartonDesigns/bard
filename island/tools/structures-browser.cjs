// The buildings in a real browser: into the world, to San Francisco's financial district, a
// building near brought half down (its block set aside and its broken shell drawn in its place,
// whether it is a surveyed building or a gridded one), the crew sent for, a round through a pane.
// Run: PLAYWRIGHT_MODULE=/path/to/playwright SETTLE=30000 node island/tools/structures-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };

(async () => {
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
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [];
	try {
		const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html`, { timeout: 900000, waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Enter world' && b.offsetParent), null, { timeout: 900000 });
		await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enter world').click());
		await page.waitForFunction(() => window.Crysis?.world?.()?.structures && Crysis.world().bayArea?.loaded?.(), null, { timeout: 900000 });
		await page.evaluate(() => { const w = Crysis.world(), P = w.player.state; w.structures.forget(); Crysis.setHome(37.7915, -122.4005, 'fd'); Crysis.goHome(); P.flying = false; P.pos.y = w.island.heightAt(P.pos.x, P.pos.z) + 1.68; });
		await page.waitForTimeout(+(process.env.SETTLE || 30000));
		const out = await page.evaluate(() => {
			// (the frame loop held: the world stepped by hand, the machine may be slow)
			Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
			const w = Crysis.world(), S = w.structures, P = w.player.state;
			const step = (n) => { for (let i = 0; i < n; i++) S.update(1 / 30, 0, w.sky.state.hours); };
			const lots = w.city.lotsNear(P.pos.x, P.pos.z, 250).filter((o) => o.h > 12 && o.w > 12 && o.d > 12 && [2, 3, 5, 6, 9].includes(Math.floor(o.kind)) && o.slot !== undefined);
			// a surveyed one first if there is one near: the question is whether its shell replaces it
			lots.sort((a, b) => (b.mapped ? 1 : 0) - (a.mapped ? 1 : 0) || Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
			const o = lots[0];
			if (!o) return { error: 'no building near' };
			L99Island.camera().position.set(o.x + o.w, o.y + 10, o.z + o.d);
			const d = Crysis.demolish(o.x, o.z, 0.7);
			step(30);
			// the block it stood as: set aside (scaled to nothing) while the shell stands in
			const near = w.city.group.children.find((m) => m.isInstancedMesh && m.geometry.attributes.aKind && m.geometry.attributes.aNear && m.instanceMatrix.count >= 20000);
			const M = new near.matrix.constructor();
			near.getMatrixAt(o.slot, M);
			const blockScale = Math.hypot(M.elements[4], M.elements[5], M.elements[6]);
			const shell = S.info().damage.shells.find((q) => Math.hypot(q.x - o.x, q.z - o.z) < 2);
			S.advance(0.5); step(30);
			const crew = S.info().rebuilds.find((q) => Math.hypot(q.x - o.x, q.z - o.z) < 2);
			// a round through a pane
			const K = Crysis.combat, V3 = P.pos.constructor;
			let pierce = null;
			for (const q of S.glass.panes().filter((p) => !p.plan && !p.gone).slice(0, 60)) {
				const from = new V3(q.x + q.nx * 6, q.y, q.z + q.nz * 6), dir = new V3(-q.nx, 0, -q.nz), h = K.firstHit(from, dir, 40, K.me);
				if (!h || h.glass !== q) continue;
				K.landShot(h, from, dir, K.me, 58, 'ballistic');
				pierce = { through: +(h.through || 0).toFixed(1), end: h.end != null ? +h.end.toFixed(1) : null };
				break;
			}
			return { building: { mapped: !!o.mapped, h: +(o.h - 1.2).toFixed(1), wrecked: !!o.wrecked }, collapse: d.collapse, blockScale, shellVerts: shell?.verts ?? null, crew: crew ? { stage: crew.stage, workers: crew.workers } : null, pierce, debris: S.info().debris };
		});
		console.log(JSON.stringify({ ...out, errors }));
		const ok = out.shellVerts > 0 && out.blockScale === 0 && out.crew && (!out.pierce || out.pierce.through > 0) && errors.length === 0;
		if (!ok) process.exitCode = 1;
	} finally {
		await browser.close();
		server.close();
	}
})().catch((e) => { console.error(e); process.exitCode = 1; });
