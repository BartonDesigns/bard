// Nobody through walls, in the real game: enters the world from the front page (as a player
// does), goes to a street of houses (Danville by default), lets the townsfolk gather, starts a
// gunfight between two squads up the street so the crowd runs, and steps the game at a slow
// phone's frame (dt 1/15 s) while it watches every body: townsfolk (walking and fleeing) and the
// fighters. Each step of each body is checked against the world's own walls (the player's
// pushOut, swept from where it was): a body that got somewhere the walls would not have let it
// is counted as through a wall. Also times the wall pushes per frame. Fails on any page error,
// crash or second page load, or (WALLS_STRICT=1) on any body through a wall.
//   PROFILE=desktop|iphone|pixel AT=lat,lon STEPS=600 OUT=dir node tools/walls-game-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), out = process.env.OUT || '/tmp/walls-game', profile = process.env.PROFILE || 'desktop';
const [LAT, LON] = (process.env.AT || '37.815,-121.990').split(',').map(Number), STEPS = +(process.env.STEPS || 600);
fs.mkdirSync(out, { recursive: true });
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
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
	const ctx = await browser.newContext(PROFILES[profile]);
	const page = await ctx.newPage();
	page.setDefaultTimeout(1800000);
	const problems = [];
	let loads = 0;
	page.on('pageerror', (e) => { problems.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
	page.on('crash', () => { problems.push('page crashed'); console.log('CRASH'); });
	page.on('framenavigated', (f) => { if (f === page.mainFrame()) { loads++; if (loads > 1) { problems.push('page reloaded'); console.log('RELOAD', f.url()); } } });
	const R = { profile, at: [LAT, LON] };
	try {
		await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
		await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
		await page.evaluate(() => window.L99IslandDoor.open());
		await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 1800000 });
		if (profile === 'desktop') await page.click('#bard-loading .bl-enter', { timeout: 900000 }); else await page.tap('#bard-loading .bl-enter', { timeout: 900000 });
		await page.waitForFunction(() => window.Crysis?.combat && window.L99Island?.world?.()?.player && !window.L99Loading.active(), null, { timeout: 900000 });
		console.log('in world');
		await page.evaluate(([la, lo]) => { Crysis.combat.ambient?.(false); Crysis.combat.clear?.(); Crysis.goTo(la, lo, 0); }, [LAT, LON]);
		// the street built round you: its blocks in the city's grid
		await page.waitForFunction(() => { const W = Crysis.world(), p = W?.player?.state?.pos; return p && W.bayArea?.loaded?.() && (W.city?.lotsNear?.(p.x, p.z, 60) || []).length > 6; }, null, { timeout: 1800000, polling: 3000 });
		console.log('street built');
		R.lots = await page.evaluate(() => { const W = Crysis.world(), p = W.player.state.pos; return W.city.lotsNear(p.x, p.z, 60).length; });
		// the townsfolk gather (stepped on, one arrival every 0.15 s of game time)
		// (bodies are built a few at a time, their assets loading meanwhile: stepped a little, then
		// time given for that, until enough are about)
		for (let k = 0; k < 80; k++) {
			R.folk = await page.evaluate(() => {
				const I = window.L99Island, cam = I.camera(), P = I.people;
				window.__wt = window.__wt || 1000;
				for (let i = 0; i < 40; i++) { window.__wt += 0.05; P.update(0.05, window.__wt, cam.position, 0, true); }
				return P.pool.filter((p) => p.active).length;
			});
			if (R.folk >= (process.env.FOLK ? +process.env.FOLK : 8)) break;
			await wait(3000);
		}
		console.log('townsfolk', R.folk);
		// what one push costs here: the world's pushOut at the townsfolk's own places, timed in bulk
		R.pushUs = await page.evaluate(() => {
			const W = Crysis.world(), P = window.L99Island.people, at = P.pool.filter((p) => p.active).map((p) => p.M.S.pos);
			const e = W.player.state.pos;
			if (!at.length) for (let i = 0; i < 8; i++) at.push({ x: e.x + Math.cos(i) * 12, y: e.y - 1.68, z: e.z + Math.sin(i) * 12 });
			const q = { x: 0, y: 0, z: 0 }, N = 4000, t0 = performance.now();
			for (let i = 0; i < N; i++) { const a = at[i % at.length]; q.x = a.x; q.y = a.y + 1.68; q.z = a.z; W.player.pushOut(q); }
			return +((performance.now() - t0) / N * 1000).toFixed(1);
		});
		console.log('one push', R.pushUs, 'us');
		// the watch: every body's step against the walls
		await page.evaluate(() => {
			const W = Crysis.world(), push0 = W.player.pushOut, EYE = 1.68;
			const S = window.__walls = { calls: 0, ms: 0, frames: 0, through: 0, folkThrough: 0, fighterThrough: 0, steps: 0, samples: [], last: new Map() };
			// (the pushes counted and timed while the game steps)
			W.player.pushOut = (p) => { const t0 = performance.now(); push0(p); S.ms += performance.now() - t0; S.calls++; };
			S.push = push0;
			S.sweep = (from, to, footY) => {
				const q = { x: to.x, y: footY + EYE, z: to.z }, L = Math.hypot(to.x - from.x, to.z - from.z), n = Math.max(1, Math.ceil(L / 0.1));
				let x = from.x, z = from.z;
				for (let i = 1; i <= n; i++) { q.x = x + (to.x - from.x) / n; q.z = z + (to.z - from.z) / n; q.y = footY + EYE; push0(q); x = q.x; z = q.z; }
				return Math.hypot(x - to.x, z - to.z);
			};
		});
		R.squads = await page.evaluate(() => Crysis.combat.fight('ashfang', 'dunecutters', 3, 22));
		const t0 = Date.now();
		for (let k = 0; k < STEPS; k += 20) {
			const r = await page.evaluate((n) => {
				const I = window.L99Island, W = I.world(), cam = I.camera(), P = I.people, S = window.__walls, C = Crysis.combat;
				for (let i = 0; i < n; i++) {
					const dt = 1 / 15;
					window.__wt += dt;
					const c0 = S.calls, m0 = S.ms;
					P.update(dt, window.__wt, cam.position, 0, true);
					C.update(dt);
					S.frames++;
					S.frameMs = (S.frameMs || 0) + (S.ms - m0); S.frameCalls = (S.frameCalls || 0) + (S.calls - c0);
					const bodies = [];
					for (const p of P.pool) if (p.active && !p.P.ragdoll && p.route?.kind !== 'seat') bodies.push({ k: p, who: 'folk', pos: p.M.S.pos, run: !!p.override });
					for (const h of C.squads.list) if (!h.dead && !h.climb && h.pos) bodies.push({ k: h, who: h.kind === 'creature' ? 'beast' : 'fighter', pos: h.pos });
					for (const b of bodies) {
						const was = S.last.get(b.k), now = { x: b.pos.x, y: b.pos.y, z: b.pos.z };
						S.last.set(b.k, now);
						if (!was) continue;
						const L = Math.hypot(now.x - was.x, now.z - was.z);
						if (L > 4 || L < 1e-4) continue;
						S.steps++;
						const off = S.sweep(was, now, was.y);
						if (off > 0.3) {
							S.through++; if (b.who === 'folk') S.folkThrough++; else S.fighterThrough++;
							if (S.samples.length < 12) S.samples.push({ who: b.who, run: b.run, from: [+was.x.toFixed(2), +was.z.toFixed(2)], to: [+now.x.toFixed(2), +now.z.toFixed(2)], off: +off.toFixed(2) });
						}
					}
				}
				return { frames: S.frames, steps: S.steps, through: S.through, folk: S.folkThrough, fighters: S.fighterThrough, fleeing: P.pool.filter((p) => p.active && p.override).length, fighting: C.squads.list.filter((h) => !h.dead).length, pushMsPerFrame: +(S.frameMs / S.frames).toFixed(3), pushesPerFrame: +(S.frameCalls / S.frames).toFixed(1) };
			}, 20);
			if (k % 100 === 0) console.log('step', k, JSON.stringify(r));
			R.watch = r;
		}
		R.samples = await page.evaluate(() => window.__walls.samples);
		// the owners' cars: the way each parked car near would drive off (and come home), every 2 m
		// of it within 120 m, against the buildings round it (vehicles/life.js way; without it, the
		// straight line a car took before)
		R.cars = await page.evaluate(() => {
			const W = Crysis.world(), L = W.vehicles?.life, St = W.street, p = W.player.state.pos;
			if (!L || !St?.parkedNear) return null;
			const inB = (x, z) => (W.city.lotsNear(x, z, 1) || []).some((o) => {
				if (o.wrecked || !(o.w > 1.5) || !(o.d > 1.5) || !(o.h > 1.5)) return false;
				const c = Math.cos(o.a || 0), s = Math.sin(o.a || 0), dx = x - o.x, dz = z - o.z, lx = c * dx + s * dz, lz = -s * dx + c * dz;
				return Math.abs(lx) < o.w / 2 - 0.3 && Math.abs(lz) < o.d / 2 - 0.3;
			});
			const out = { cars: 0, roadWays: 0, outThrough: 0, inThrough: 0, samples: [] };
			for (const car of St.parkedNear(p.x, p.z, 220, true).filter((c) => !c.drive).slice(0, 40)) {
				out.cars++;
				const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
				const straight = (sg) => { const pts = []; for (let s = 6; s <= 120; s += 2) pts.push([car.x + fx * s * sg, car.z + fz * s * sg]); return pts; };
				const away = L.way ? L.way(car, 'out') : null, home = L.way ? L.way(car, 'in') : null;
				if (away) out.roadWays++;
				const check = (pts, start) => { let run = 0; for (let i = 1; i < pts.length; i++) { run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (run > 120) break; if (i * 2 > start && inB(pts[i][0], pts[i][1])) return pts[i]; } return null; };
				const a = check(away || straight(1), 3), b = check(home ? [...home].reverse() : straight(-1), 3);
				if (a) { out.outThrough++; if (out.samples.length < 8) out.samples.push({ car: [+car.x.toFixed(1), +car.z.toFixed(1)], out: a.map((v) => +v.toFixed(1)), road: !!away }); }
				if (b) { out.inThrough++; if (out.samples.length < 8) out.samples.push({ car: [+car.x.toFixed(1), +car.z.toFixed(1)], in: b.map((v) => +v.toFixed(1)), road: !!home }); }
			}
			return out;
		});
		console.log('cars', JSON.stringify(R.cars));
		R.seconds = Math.round((Date.now() - t0) / 1000);
		console.log('result', JSON.stringify(R));
		if (process.env.WALLS_STRICT && R.watch.through > 0) problems.push(`${R.watch.through} steps through a wall`);
		if (process.env.WALLS_STRICT && R.cars && R.cars.outThrough + R.cars.inThrough > 0) problems.push(`${R.cars.outThrough + R.cars.inThrough} car ways through a building`);
	} catch (e) { problems.push('error: ' + e.message.split('\n')[0]); }
	fs.writeFileSync(`${out}/${profile}-walls.json`, JSON.stringify({ R, problems }, null, 1));
	console.log(problems.length ? 'FAIL\n' + problems.join('\n') : 'PASS');
	await browser.close(); server.close();
	process.exit(problems.length ? 1 : 0);
})();
