// What one wall push costs in the real game, and which of the world's pushes it goes to: enters the
// world from the front page, goes to a busy street (SF Mission by default), waits for the
// townsfolk, then times the player's pushOut, the world's extra pushes as a whole, and each
// module's own push, in bulk loops at the townsfolk's places (and round you).
//   PROFILE=desktop|iphone|pixel AT=lat,lon N=4000 ROOT=checkout node tools/push-cost-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), profile = process.env.PROFILE || 'desktop';
const [LAT, LON] = (process.env.AT || '37.7614,-122.4241').split(',').map(Number), N = +(process.env.N || 4000);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ktx2': 'image/ktx2' };
const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://local');
	const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
	if (!file.startsWith(root)) return res.writeHead(403).end();
	fs.readFile(file, (err, buf) => { if (err) return res.writeHead(404).end(); res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(buf); });
});
const PROFILES = {
	desktop: { viewport: { width: 1280, height: 720 } },
	iphone: (({ defaultBrowserType, ...d }) => d)(devices['iPhone 14']),
	pixel: (({ defaultBrowserType, ...d }) => d)(devices['Pixel 7']),
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
	const ctx = await browser.newContext(PROFILES[profile]);
	const page = await ctx.newPage();
	page.setDefaultTimeout(1800000);
	const problems = [];
	page.on('pageerror', (e) => { problems.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
	page.on('crash', () => problems.push('page crashed'));
	try {
		await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
		await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
		await page.evaluate(() => window.L99IslandDoor.open());
		await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 1800000 });
		if (profile === 'desktop') await page.click('#bard-loading .bl-enter', { timeout: 900000 }); else await page.tap('#bard-loading .bl-enter', { timeout: 900000 });
		await page.waitForFunction(() => window.Crysis?.combat && window.L99Island?.world?.()?.player && !window.L99Loading.active(), null, { timeout: 900000 });
		await page.evaluate(([la, lo]) => { Crysis.combat.ambient?.(false); Crysis.goTo(la, lo, 0); }, [LAT, LON]);
		await page.waitForFunction(() => { const W = Crysis.world(), p = W?.player?.state?.pos; return p && W.bayArea?.loaded?.() && (W.city?.lotsNear?.(p.x, p.z, 60) || []).length > 6; }, null, { timeout: 1800000, polling: 3000 });
		for (let k = 0; k < 60; k++) {
			const n = await page.evaluate(() => { const I = window.L99Island, cam = I.camera(), P = I.people; window.__wt = window.__wt || 1000; for (let i = 0; i < 40; i++) { window.__wt += 0.05; P.update(0.05, window.__wt, cam.position, 0, true); } return P.pool.filter((p) => p.active).length; });
			if (n >= 8) break;
			await wait(3000);
		}
		// (a moment for the interiors and houses near to be built, as they are when you stand there)
		await wait(20000);
		const r = await page.evaluate((N) => {
			const W = Crysis.world(), I = W.island, P = window.L99Island.people, e = W.player.state.pos;
			const at = P.pool.filter((p) => p.active).map((p) => ({ x: p.M.S.pos.x, y: p.M.S.pos.y, z: p.M.S.pos.z }));
			for (let i = 0; i < 12; i++) at.push({ x: e.x + Math.cos(i * 0.7) * (4 + i * 2), y: e.y - 1.68, z: e.z + Math.sin(i * 0.7) * (4 + i * 2) });
			const q = { x: 0, y: 0, z: 0 };
			// (the least of three rounds: the machine's other work only ever adds to a round)
			const round = (fn) => { const t0 = performance.now(); for (let i = 0; i < N; i++) { const a = at[i % at.length]; q.x = a.x; q.y = a.y + 1.68; q.z = a.z; fn(q, a.y); } return (performance.now() - t0) / N * 1000; };
			const time = (fn) => +Math.min(round(fn), round(fn), round(fn)).toFixed(2);
			const out = { bodies: at.length, total: time((p) => W.player.pushOut(p)), extra: time((p, fy) => I.extraPush(p, fy)) };
			const mods = { diablo: W.diablo, houses: W.houses, commercial: W.commercial, discovery: W.discovery, towers: W.towers, boardwalk: W.boardwalk, landmarks: W.landmarks, coast: W.bayArea?.coast, lake: W.lake, fields: W.fields, beaches: W.beaches, parks: W.parks, edge: W.edge, interiors: W.interiors, structures: W.structures, services: W.services, vehicles: W.vehicles, volcano: W.volcano };
			for (const [k, m] of Object.entries(mods)) if (m?.push) { try { out[k] = time((p, fy) => m.push(p, fy)); } catch (err) { out[k] = 'err ' + err.message; } }
			if (I.underFloor) out.underFloor = time((p) => I.underFloor(p.x, p.z, p.y - 1.68));
			if (W.vegetation?.obstacles) out.vegetation = time((p) => W.vegetation.obstacles(p.x, p.z, 0.35, p.y));
			if (W.city?.lotsNear) out.lotsNear = time((p) => W.city.lotsNear(p.x, p.z, 1.5));
			out.live = W.interiors?.info?.()?.live ?? null;
			out.footprints = W.village?.footprints?.length ?? null;
			return out;
		}, N);
		console.log('cost', profile, JSON.stringify(r));
	} catch (e) { problems.push('error: ' + e.message.split('\n')[0]); }
	console.log(problems.length ? 'FAIL\n' + problems.join('\n') : 'PASS');
	await browser.close(); server.close();
	process.exit(problems.length ? 1 : 0);
})();
