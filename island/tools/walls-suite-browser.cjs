// NPCs through walls, measured in the real game, scene by scene: enters the world from the front
// page (as a player does) and runs, at a slow phone's frame (dt 1/15 s, the game stepped by hand):
//   suburb  Danville's houses: the townsfolk gathered, a gunfight up the street, blasts (no harm)
//           among the crowd so it runs, every body watched
//   home    the player in a built house of the street, evening: the family at home, then a window
//           broken and the family scattering
//   cars    the parked cars' ways out of and into their spaces (vehicles/life.js way where there is
//           one, else the straight line they took before), and police cruisers sent to a spot in
//           sight, watched as they come
//   city    SF Mission: the suburb scene again in the city's blocks
// Each step of each body is checked against the world's own walls (the player's pushOut, swept
// from where it was in 0.1 m pieces): a body that got where the walls would not let it is a step
// through a wall; a body whose own spot the walls push it out of is standing in a wall. Cars and
// cruisers are checked against the city's blocks (bay/city.js lotsNear), 0.5 m in from the walls.
//   ROOT=checkout PROFILE=desktop|iphone|pixel SCENES=suburb,home,cars,city OUT=dir node tools/walls-suite-browser.cjs
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..'), out = process.env.OUT || '/tmp/walls-suite', profile = process.env.PROFILE || 'desktop';
const SCENES = (process.env.SCENES || 'suburb,home,cars,city').split(','), STEPS = +(process.env.STEPS || 450), TAG = process.env.TAG || path.basename(root);
const SUBURB = [37.815, -121.990], CITY = [37.7614, -122.4241];
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

// ---- in the page: the watch (installed once) ----
function install() {
	const W = Crysis.world(), EYE = 1.68;
	const push0 = W.player.pushOut;
	const S = window.__walls = { push0, last: new Map() };
	S.sweep = (from, to, footY) => {
		const q = { x: to.x, y: footY + EYE, z: to.z }, L = Math.hypot(to.x - from.x, to.z - from.z), n = Math.max(1, Math.ceil(L / 0.1));
		let x = from.x, z = from.z;
		for (let i = 1; i <= n; i++) { q.x = x + (to.x - from.x) / n; q.z = z + (to.z - from.z) / n; q.y = footY + EYE; push0(q); x = q.x; z = q.z; }
		return Math.hypot(x - to.x, z - to.z);
	};
	S.standIn = (p) => { const q = { x: p.x, y: p.y + EYE, z: p.z }; push0(q); return Math.hypot(q.x - p.x, q.z - p.z); };
	// a car's middle or nose in a building (0.5 m in from its walls)
	S.lotAt = (x, z) => (Crysis.world().city?.lotsNear?.(x, z, 1) || []).find((o) => {
		if (o.wrecked || !(o.w > 1.5) || !(o.d > 1.5) || !(o.h > 1.5)) return false;
		const c = Math.cos(o.a || 0), s = Math.sin(o.a || 0), dx = x - o.x, dz = z - o.z, lx = c * dx + s * dz, lz = -s * dx + c * dz;
		return Math.abs(lx) < o.w / 2 - 0.5 && Math.abs(lz) < o.d / 2 - 0.5;
	});
	S.inB = (x, z) => !!S.lotAt(x, z);
	// the street under a point: its class and how far off its middle line
	S.roadAt = (x, z) => {
		const W = Crysis.world();
		if (!W.real?.loaded?.()) return null;
		let best = null;
		for (const r of W.real.near('roads', x, z, 20)) for (let i = 0; i + 3 < r.pts.length; i += 2) {
			const ax = r.pts[i], az = r.pts[i + 1], bx = r.pts[i + 2], bz = r.pts[i + 3], vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
			const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)), d = Math.hypot(x - ax - vx * t, z - az - vz * t);
			if (!best || d < best.d) best = { cls: r.cls, d: +d.toFixed(1) };
		}
		return best;
	};
	S.reset = () => { S.c = { steps: 0, through: 0, crossed: 0, crossedAfterClimb: 0, climbs: 0, standing: 0, frames: 0, by: {}, samples: [] }; S.last = new Map(); S.climbed = new Set(); S.seen = new Map(); };
	// every body about: townsfolk, fighters and beasts, families (out and at home)
	S.bodies = () => {
		const out = [], P = window.L99Island.people, C = Crysis.combat, F = Crysis.families?.();
		for (const p of P?.pool || []) if (p.active && !p.P.ragdoll && p.route?.kind !== 'seat' && !p.leaving) out.push({ k: p, who: p.override ? 'fleeing' : 'folk', pos: p.M.S.pos, sit: p.M.S.sitK?.v > 0.2 });
		for (const h of C?.squads?.list || []) if (!h.dead && h.climb && h.pos) out.push({ k: h, climb: true });
		for (const h of C?.squads?.list || []) if (!h.dead && !h.climb && h.pos) out.push({ k: h, who: h.kind === 'creature' || h.kind === 'crawler' ? 'beast' : h.ally ? 'companion' : 'fighter', pos: h.pos });
		for (const a of F?.actors?.() || []) if (a?.M?.S?.pos && a.active !== false && !a.P?.ragdoll) out.push({ k: a, who: a.source === 'family' ? 'family' : 'home', pos: a.M.S.pos, sit: a.M.S.sitK?.v > 0.2 });
		return out;
	};
	S.watch = () => {
		const c = S.c;
		c.frames++;
		for (const b of S.bodies()) {
			// (a body over a fence or onto a ledge, combat/npc-climb.js: not watched while it climbs,
			// as before; its first step after is marked)
			if (b.climb) { if (!S.climbed.has(b.k)) c.climbs++; S.climbed.add(b.k); continue; }
			const after = S.climbed.delete(b.k);
			// (frames since this body was last watched: more than 1 is a body back from a ragdoll,
			// a seat or a climb, its step spanning the time away)
			const gap = c.frames - (S.seen.get(b.k) ?? c.frames - 1);
			S.seen.set(b.k, c.frames);
			const was = S.last.get(b.k), now = { x: b.pos.x, y: b.pos.y, z: b.pos.z };
			S.last.set(b.k, now);
			const by = c.by[b.who] || (c.by[b.who] = { steps: 0, through: 0, crossed: 0, standing: 0 });
			if (!b.sit && S.standIn(now) > 0.12) { c.standing++; by.standing++; }
			if (!was) continue;
			const L = Math.hypot(now.x - was.x, now.z - was.z);
			if (L > 4 || L < 1e-4 || Math.abs(now.y - was.y) > 1) continue;
			c.steps++; by.steps++;
			const off = S.sweep(was, now, was.y);
			// (through: the walls would not have let it get there; crossed: and it started clear of
			// them, so it went into or through one rather than shuffling about inside one already)
			if (off > 0.3) {
				c.through++; by.through++;
				const clear = S.standIn(was) <= 0.12;
				if (clear) { c.crossed++; by.crossed++; if (after) c.crossedAfterClimb++; }
				if (c.samples.length < 16 || (clear && c.samples.filter((q) => q.clear).length < 12)) c.samples.push({ who: b.who, clear, after, gap, route: b.k.route?.kind || null, L: +L.toFixed(2), from: [+was.x.toFixed(2), +was.y.toFixed(2), +was.z.toFixed(2)], to: [+now.x.toFixed(2), +now.z.toFixed(2)], off: +off.toFixed(2) });
			}
		}
	};
	S.step = (n, extra) => {
		const I = window.L99Island, cam = I.camera(), P = I.people, C = Crysis.combat, F = Crysis.families?.();
		for (let i = 0; i < n; i++) {
			const dt = 1 / 15;
			window.__wt = (window.__wt || 1000) + dt;
			P.update(dt, window.__wt, cam.position, Crysis.world().sky?.state?.night ?? 0, true);
			C.update(dt);
			try { F?.update?.(dt, window.__wt, true); } catch (e) { S.famErr = String(e).slice(0, 200); }
			extra?.(dt);
			S.watch();
		}
		const c = S.c;
		return { frames: c.frames, steps: c.steps, through: c.through, crossed: c.crossed, crossedAfterClimb: c.crossedAfterClimb, climbs: c.climbs, standing: c.standing, by: c.by };
	};
}

(async () => {
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
	const ctx = await browser.newContext(PROFILES[profile]);
	const page = await ctx.newPage();
	page.setDefaultTimeout(2400000);
	const problems = [];
	let loads = 0;
	page.on('pageerror', (e) => { problems.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message); });
	page.on('crash', () => { problems.push('page crashed'); console.log('CRASH'); });
	page.on('framenavigated', (f) => { if (f === page.mainFrame()) { loads++; if (loads > 1) { problems.push('page reloaded'); console.log('RELOAD', f.url()); } } });
	const R = { tag: TAG, profile, scenes: {} };
	const save = () => fs.writeFileSync(`${out}/${TAG}-${profile}.json`, JSON.stringify({ R, problems }, null, 1));
	const go = async ([la, lo]) => {
		await page.evaluate(([a, b]) => { Crysis.combat.clear?.(); Crysis.goTo(a, b, 0); }, [la, lo]);
		await wait(5000);
		await page.waitForFunction(() => { const W = Crysis.world(), p = W?.player?.state?.pos; return p && W.bayArea?.loaded?.() && (W.city?.lotsNear?.(p.x, p.z, 60) || []).length > 6; }, null, { timeout: 1200000, polling: 3000 });
	};
	// townsfolk gathered: stepped a little at a time, time given to build bodies between
	const gather = async (want = 8) => {
		let n = 0;
		for (let k = 0; k < 80; k++) {
			n = await page.evaluate(() => { const I = window.L99Island, cam = I.camera(), P = I.people; for (let i = 0; i < 40; i++) { window.__wt = (window.__wt || 1000) + 0.05; P.update(0.05, window.__wt, cam.position, 0, true); } return P.pool.filter((p) => p.active).length; });
			if (n >= want) break;
			await wait(3000);
		}
		return n;
	};
	// a crowd scene: a fight up the street, blasts among the crowd every 4 s so it runs
	const crowdScene = async (name) => {
		// (midday: the street at its busiest, flow.js)
		await page.evaluate(() => { const sky = Crysis.world().sky?.state; if (sky) { sky.real = false; sky.speed = 0; sky.hours = 12.5; } });
		const sc = { folk: await gather(profile === 'desktop' ? 10 : 7) };
		// the two gangs on either side of the nearest building (a built house, else a city block),
		// so the way to each other is through it unless the walls hold them
		sc.fight = await page.evaluate(() => {
			const W = Crysis.world(), p = W.player.state.pos, C = Crysis.combat, S = window.__walls;
			S.reset();
			const dist = (q) => Math.hypot(q.x - p.x, q.z - p.z);
			let c = null, half = 0, a = 0, what = '';
			const h = [...(W.houses?.houses?.values?.() || [])].filter(Boolean).map((q) => ({ q, x: q.cx, z: q.cz })).sort((u, v) => dist(u) - dist(v))[0];
			if (h && dist(h) < 120) { c = h; half = h.q.r || 6; what = 'house'; }
			else {
				const L = (W.city?.lotsNear?.(p.x, p.z, 80) || []).filter((o) => !o.wrecked && o.w > 8 && o.d > 8 && o.h > 3).sort((u, v) => dist(u) - dist(v))[0];
				if (L) { c = L; half = L.w / 2; a = L.a || 0; what = 'block'; }
			}
			if (!c) { C.fight('ashfang', 'dunecutters', 3, 22); return { what: 'street' }; }
			const ux = Math.cos(a), uz = Math.sin(a), R = half + 6;
			C.squads.squad('ashfang', c.x - ux * R, c.z - uz * R, 3, {});
			C.squads.squad('dunecutters', c.x + ux * R, c.z + uz * R, 3, {});
			S.at = { x: c.x, z: c.z };
			return { what, at: [+c.x.toFixed(1), +c.z.toFixed(1)], half: +half.toFixed(1), from: +dist(c).toFixed(1) };
		});
		let fled = 0;
		for (let k = 0; k < STEPS; k += 15) {
			const r = await page.evaluate((k) => {
				const S = window.__walls, P = window.L99Island.people, act = P.pool.filter((p) => p.active);
				// (a harmless blast among the crowd and one by the building every 4 s: they run)
				if (k % 60 === 0) {
					const W = Crysis.world(), at = [];
					if (act.length) at.push([act.reduce((a, p) => a + p.M.S.pos.x, 0) / act.length, act.reduce((a, p) => a + p.M.S.pos.z, 0) / act.length]);
					if (S.at) at.push([S.at.x, S.at.z]);
					for (const [cx, cz] of at) Crysis.combat.blast({ x: cx, y: W.island.heightAt(cx, cz), z: cz }, 0.4, 0, null);
				}
				const r = S.step(15);
				r.fleeing = P.pool.filter((p) => p.active && p.override).length;
				return r;
			}, k);
			fled = Math.max(fled, r.fleeing);
			sc.watch = r;
			if (k % 150 === 0) console.log(name, k, JSON.stringify(r));
		}
		sc.maxFleeing = fled;
		sc.samples = await page.evaluate(() => window.__walls.c.samples);
		await page.evaluate(() => Crysis.combat.clear?.());
		return sc;
	};
	try {
		const t0 = Date.now();
		await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
		await page.waitForFunction(() => window.L99IslandDoor, null, { timeout: 120000 });
		await page.evaluate(() => window.L99IslandDoor.open());
		await page.waitForSelector('#bard-loading .bl-enter:not([hidden])', { timeout: 2400000 });
		if (profile === 'desktop') await page.click('#bard-loading .bl-enter', { timeout: 900000 }); else await page.tap('#bard-loading .bl-enter', { timeout: 900000 });
		await page.waitForFunction(() => window.Crysis?.combat && window.L99Island?.world?.()?.player && !window.L99Loading.active(), null, { timeout: 1800000 });
		console.log('in world', Math.round((Date.now() - t0) / 1000), 's');
		await page.evaluate(() => { Crysis.combat.ambient?.(false); });
		await page.evaluate(install);
		if (SCENES.some((s) => s !== 'city')) { await go(SUBURB); console.log('suburb built'); }
		if (SCENES.includes('suburb')) { R.scenes.suburb = await crowdScene('suburb'); save(); }
		if (SCENES.includes('home')) {
			// evening, in the nearest built house: the family home, then the window goes
			const sc = R.scenes.home = {};
			sc.house = await page.evaluate(() => {
				const W = Crysis.world(), p = W.player.state.pos, sky = W.sky?.state;
				if (sky) { sky.real = false; sky.speed = 0; sky.hours = 19.4; }
				const hs = [...(W.houses?.houses?.values?.() || [])].filter(Boolean).sort((a, b) => Math.hypot(a.cx - p.x, a.cz - p.z) - Math.hypot(b.cx - p.x, b.cz - p.z));
				const h = hs[0];
				if (!h) return null;
				W.player.state.pos.set(h.cx, h.floorY + 1.68, h.cz);
				return { at: [+h.cx.toFixed(1), +h.cz.toFixed(1)], built: hs.length };
			});
			let shown = 0;
			for (let k = 0; k < 60 && sc.house; k++) {
				shown = await page.evaluate(() => { const S = window.__walls; S.reset(); S.step(20); const H = Crysis.families?.()?.homes?.info?.(); return (H?.houses || []).reduce((a, q) => a + (q.shown || 0), 0); });
				if (shown >= 2) break;
				await wait(4000);
			}
			sc.shown = shown;
			await page.evaluate(() => window.__walls.reset());
			sc.before = await page.evaluate(() => window.__walls.step(90));
			sc.scattered = await page.evaluate(() => Crysis.families?.()?.homes?.scatter?.('window') ?? null);
			for (let k = 0; k < STEPS; k += 15) sc.watch = await page.evaluate(() => window.__walls.step(15));
			sc.samples = await page.evaluate(() => window.__walls.c.samples);
			sc.famErr = await page.evaluate(() => window.__walls.famErr || null);
			console.log('home', JSON.stringify(sc).slice(0, 600));
			save();
		}
		if (SCENES.includes('streets')) {
			// the city's blocks standing on a driven street: which lots, which streets
			await page.waitForFunction(() => Crysis.world().real?.loaded?.(), null, { timeout: 1200000, polling: 3000 });
			await wait(20000);
			R.scenes.streets = await page.evaluate(() => {
				const W = Crysis.world(), p = W.player.state.pos, S = window.__walls, o = { pts: 0, inBlock: 0, byCls: {}, lots: [] }, seen = new Set();
				for (const r of W.real.near('roads', p.x, p.z, 250)) {
					if (r.drive === false) continue;
					for (let i = 0; i + 3 < r.pts.length; i += 2) {
						const ax = r.pts[i], az = r.pts[i + 1], L = Math.hypot(r.pts[i + 2] - ax, r.pts[i + 3] - az);
						for (let s = 0; s < L; s += 2) {
							const x = ax + (r.pts[i + 2] - ax) * s / L, z = az + (r.pts[i + 3] - az) * s / L;
							if (Math.hypot(x - p.x, z - p.z) > 250) continue;
							o.pts++;
							const q = S.lotAt(x, z);
							if (!q) continue;
							o.inBlock++; o.byCls[r.cls] = (o.byCls[r.cls] || 0) + 1;
							if (seen.has(q) || o.lots.length > 30) continue;
							seen.add(q);
							o.lots.push({ at: [+q.x.toFixed(1), +q.z.toFixed(1)], w: +q.w.toFixed(1), d: +q.d.toFixed(1), h: +q.h.toFixed(1), a: +(q.a || 0).toFixed(2), kind: q.kind, keys: Object.keys(q).join(','), src: q.src ? Object.keys(q.src).slice(0, 12).join(',') : null, real: !!q.real || !!q.src?.real || !!q.src?.id, road: { cls: r.cls, w: r.w, drive: r.drive, made: !!r.made, name: r.name || null, keys: Object.keys(r).join(',') }, pt: [+x.toFixed(1), +z.toFixed(1)] });
						}
					}
				}
				return o;
			});
			R.scenes.streets.settle = await page.evaluate(() => { try { const s = Crysis.structures?.(); return JSON.stringify(s?.lots || s?.overlaps || s || null).slice(0, 600); } catch (e) { return String(e); } });
			console.log('streets', JSON.stringify(R.scenes.streets));
			save();
		}
		if (SCENES.includes('cars')) {
			const sc = R.scenes.cars = {};
			// the parked cars' ways out and in, every 2 m, within 120 m
			sc.ways = await page.evaluate(() => {
				const W = Crysis.world(), L = W.vehicles?.life, St = W.street, p = W.player.state.pos, S = window.__walls;
				if (!L || !St?.parkedNear) return null;
				const o = { cars: 0, roadWays: 0, outThrough: 0, inThrough: 0, samples: [] };
				for (const car of St.parkedNear(p.x, p.z, 260, true).filter((c) => !c.drive).slice(0, 60)) {
					o.cars++;
					const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
					const straight = (sg) => { const pts = [[car.x, car.z]]; for (let s = 2; s <= 120; s += 2) pts.push([car.x + fx * s * sg, car.z + fz * s * sg]); return pts; };
					const away = L.way ? L.way(car, 'out') : null, home = L.way ? L.way(car, 'in') : null;
					if (away) o.roadWays++;
					const check = (pts) => { let run = 0; for (let i = 1; i < pts.length; i++) { run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (run > 120) break; if (run > 4 && S.inB(pts[i][0], pts[i][1])) return pts[i]; } return null; };
					const a = check(away || straight(1)), b = check(home ? [...home].reverse() : straight(-1));
					const why = (q) => { const L = S.lotAt(q[0], q[1]); return { lot: L && { w: +L.w.toFixed(1), d: +L.d.toFixed(1), h: +L.h.toFixed(1), kind: L.kind || L.type || L.use || null }, street: S.roadAt(q[0], q[1]), fromCar: +Math.hypot(q[0] - car.x, q[1] - car.z).toFixed(1) }; };
					if (a) { o.outThrough++; if (o.samples.length < 12) o.samples.push({ car: [+car.x.toFixed(1), +car.z.toFixed(1), +car.yaw.toFixed(2)], out: a.map((v) => +v.toFixed(1)), road: !!away, ...why(a) }); }
					if (b) { o.inThrough++; if (o.samples.length < 12) o.samples.push({ car: [+car.x.toFixed(1), +car.z.toFixed(1), +car.yaw.toFixed(2)], in: b.map((v) => +v.toFixed(1)), road: !!home, ...why(b) }); }
				}
				// (control: the mapped streets' own middle lines, every 2 m within 150 m, in a block)
				o.streetPts = 0; o.streetPtsInBlock = 0; o.streetInBlockByCls = {};
				for (const r of W.real?.loaded?.() ? W.real.near('roads', p.x, p.z, 150) : []) for (let i = 0; i + 3 < r.pts.length; i += 2) {
					const ax = r.pts[i], az = r.pts[i + 1], L = Math.hypot(r.pts[i + 2] - ax, r.pts[i + 3] - az);
					for (let s = 0; s < L; s += 2) { const x = ax + (r.pts[i + 2] - ax) * s / L, z = az + (r.pts[i + 3] - az) * s / L; if (Math.hypot(x - p.x, z - p.z) > 150) continue; o.streetPts++; if (S.inB(x, z)) { o.streetPtsInBlock++; o.streetInBlockByCls[r.cls] = (o.streetInBlockByCls[r.cls] || 0) + 1; } }
				}
				return o;
			});
			console.log('ways', JSON.stringify(sc.ways));
			// police: a brawl reported a little way ahead, a couple of times, the cruisers watched
			sc.police = await page.evaluate(() => {
				const W = Crysis.world(), Mi = Crysis.military?.api, Po = Mi?.police, S = window.__walls;
				if (!Po?.event) return null;
				const p = W.player.state.pos, d = window.L99Island.camera().getWorldDirection(new p.constructor());
				const fx = d.x / (Math.hypot(d.x, d.z) || 1), fz = d.z / (Math.hypot(d.x, d.z) || 1);
				const o = { sent: 0, frames: 0, visibleFrames: 0, inBuildingVisible: 0, inBuildingAll: 0, arrived: 0, samples: [] };
				// (ahead of you and over 120 m apart: one cruiser answers each spot)
				const spots = [[40, 0], [170, 0], [100, 130]].map(([a, l]) => [fx * a - fz * l, fz * a + fx * l]);
				for (const [dx, dz] of spots) { if (Po.event({ x: p.x + dx, z: p.z + dz, kind: 'brawl' })) o.sent++; }
				for (let i = 0; i < 1500; i++) {
					Po.update(1 / 15);
					o.frames++;
					for (const c of Po.cruisers) {
						const half = (c.S?.L || 4.8) / 2, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
						const inside = S.inB(c.pos.x, c.pos.z) || S.inB(c.pos.x + fx * half, c.pos.z + fz * half);
						const vis = Po.visible(c.pos.x, c.pos.z, 260);
						if (vis) o.visibleFrames++;
						if (inside) { o.inBuildingAll++; if (vis) { o.inBuildingVisible++; if (o.samples.length < 10) o.samples.push({ id: c.id, state: c.state, at: [+c.pos.x.toFixed(1), +c.pos.z.toFixed(1)], s: +(c.s || 0).toFixed(1) }); } }
					}
					if (Po.cruisers.length && Po.cruisers.every((c) => c.state !== 'responding')) break;
				}
				o.arrived = Po.cruisers.filter((c) => c.state === 'arrived').length;
				o.states = Po.cruisers.map((c) => c.state);
				Po.clear();
				return o;
			});
			console.log('police', JSON.stringify(sc.police));
			save();
		}
		if (SCENES.includes('city')) { await go(CITY); console.log('city built'); R.scenes.city = await crowdScene('city'); save(); }
		R.seconds = Math.round((Date.now() - t0) / 1000);
	} catch (e) { problems.push('error: ' + e.message.split('\n')[0]); console.log('ERROR', e.message.split('\n')[0]); }
	save();
	console.log('result', JSON.stringify(R).slice(0, 3000));
	console.log(problems.length ? 'FAIL\n' + problems.join('\n') : 'PASS');
	await browser.close(); server.close();
	process.exit(problems.length ? 1 : 0);
})();
