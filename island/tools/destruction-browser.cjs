// Walls you break through, in a real browser (structures/walls/): into the world, to a house built
// near you; inside, punches at an outside wall until the drywall goes and the batts and studs show;
// outside, single rounds into the stucco and then a burst that chews through to the wire lath; a
// round through a partition (in small, out torn); a window shot until it webs, holes and goes, and
// climbed through; a blast through a partition and a walk through the breach. Then, in town, a
// building built inside: brick knocked out along its mortar lines and concrete spalled to its bars.
// Close-up pictures of every stage from both sides are written to OUT (a directory).
//
// Run: OUT=/tmp/destruction SETTLE=30000 node island/tools/destruction-browser.cjs
// (PLAYWRIGHT_MODULE, CHROME_EXECUTABLE as for structures-browser.cjs; ROOT the repository)
// The world's own frame loop is held while the pictures are taken: the machine this runs on may
// draw a frame a second, so the systems are stepped by hand and each picture rendered directly.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = process.env.ROOT || path.resolve(__dirname, '../..');
const OUT = process.env.OUT || '/tmp/destruction';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const ONLY = (process.env.ONLY || 'house,city').split(',');

// installed in the page: helpers to step the world, aim, strike and take pictures
function helpers() {
	const w = Crysis.world(), S = w.structures, P = w.player.state, K = Crysis.combat, V3 = P.pos.constructor;
	const R = L99Island.renderer(), scene = L99Island.scene(), cam = L99Island.camera();
	Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
	const D = {
		w, S, P, K, V3, R, scene, cam, log: [],
		step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { w.houses?.update?.(cam, dt, 0); w.interiors?.update?.(cam, dt, w.sky.state.hours, 0); S.update(dt, 0, w.sky.state.hours); } },
		// stand at (x, z) on the floor y, looking at (tx, ty, tz)
		stand(x, y, z, tx, ty, tz) { P.flying = false; P.vel?.set(0, 0, 0); P.pos.set(x, y + 1.68, z); P.yaw = Math.atan2(-(tx - x), -(tz - z)); P.pitch = Math.atan2(ty - (y + 1.68), Math.hypot(tx - x, tz - z)); cam.position.copy(P.pos); cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); cam.updateMatrixWorld(); },
		shot(name, from, to, fov = 55) {
			cam.position.set(from.x, from.y, from.z); cam.up.set(0, 1, 0); cam.lookAt(to.x, to.y, to.z);
			const f0 = cam.fov; cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
			R.render(scene, cam);
			const url = R.domElement.toDataURL('image/jpeg', 0.88);
			cam.fov = f0; cam.updateProjectionMatrix();
			return { name, url };
		},
		// a punch, a swing (structures.blow, as melee.js's strike does)
		blow(eye, dir, move) { const r = S.blow(eye, dir, (move.reach || 1.45) + 0.35, move); D.step(2); return r; },
		fire(from, to, dmg = 58) { const d = new V3(to.x - from.x, to.y - from.y, to.z - from.z).normalize(), o = new V3(from.x, from.y, from.z); const h = K.firstHit(o, d, 80, K.me); if (!h) return null; const r = K.landShot(h, o, d, K.me, dmg, 'ballistic'); D.step(2); return { t: +h.t.toFixed(2), wall: !!h.wall, glass: !!h.glass, through: +(h.through || 0).toFixed(1), end: h.end ? +h.end.toFixed(2) : null, r: !!r }; },
	};
	return D;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((req, res) => {
		try { const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; } const d = fs.readFileSync(f); res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store'); res.end(d); } catch { res.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [], report = {};
	const save = (shots) => { for (const s of shots || []) { if (!s?.url) continue; fs.writeFileSync(path.join(OUT, s.name + '.jpg'), Buffer.from(s.url.split(',')[1], 'base64')); } };
	try {
		const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html`, { timeout: 900000, waitUntil: 'domcontentloaded' });
		for (let i = 0; i < 1500; i++) { await page.waitForTimeout(1000); const ok = await page.evaluate(() => { if (window.Crysis?.world?.()?.structures && Crysis.world().bayArea?.loaded?.()) return true; const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^Enter world$/.test(x.textContent.trim())); b?.click(); return false; }).catch(() => false); if (ok) break; }
		await page.evaluate(() => { localStorage.removeItem('l99.structures.walls.v1'); Crysis.world().structures.walls.forget(); Crysis.world().sky.state.hours = 11; });
		if (ONLY.includes('house')) {
			const lat = +(process.env.LAT || 37.7799), lon = +(process.env.LON || -121.978);
			await page.evaluate(([la, lo]) => { const w = Crysis.world(), P = w.player.state; Crysis.setHome(la, lo, 'walls'); Crysis.goHome(); P.flying = false; P.pos.y = w.island.heightAt(P.pos.x, P.pos.z) + 1.68; }, [lat, lon]);
			await page.waitForTimeout(+(process.env.SETTLE || 30000));
			// a house built near: go to the nearest house the town has and let it be built
			const found = await page.evaluate(`(() => {
				const D = window.__D = (${helpers.toString()})(), w = D.w, P = D.P;
				const homes = [];
				for (const g of w.city?.procHomes?.(P.pos.x, P.pos.z, 900) || []) homes.push(g[0]);
				for (const b of w.real?.loaded?.() ? w.real.near('boxes', P.pos.x, P.pos.z, 600) : []) if (b.grp && !b.grp.biz) homes.push(b);
				homes.sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
				const target = homes[0];
				if (!target) return { error: 'no house near', pos: P.pos.toArray() };
				const g = w.island.heightAt(target.x + 9, target.z + 9);
				D.stand(target.x + 9, g, target.z + 9, target.x, g + 1, target.z);
				for (let i = 0; i < 900 && ![...(w.houses?.houses?.values?.() || [])].some((h) => h && Math.hypot(h.cx - target.x, h.cz - target.z) < 25); i++) D.step(1, 0.05);
				D.step(20);
				return { target: [target.x, target.z].map(Math.round), houses: w.houses.count(), walls: D.S.walls.info() };
			})()`);
			report.found = found;
			console.log('house', JSON.stringify(found));
			if (!found.error) {
				const out = await page.evaluate(() => {
					const D = window.__D, w = D.w, S = D.S, WL = S.walls, shots = [], res = {};
					const src = [...WL.sources.values()].filter((s) => s.kind === 'house').sort((a, b) => Math.hypot(a.h.cx - D.P.pos.x, a.h.cz - D.P.pos.z) - Math.hypot(b.h.cx - D.P.pos.x, b.h.cz - D.P.pos.z))[0];
					if (!src) return { error: 'no house walls registered', info: WL.info() };
					const h = src.h, y0 = h.floorY;
					// the wall's frame in the world: a point (u, y, a) and its normal on a side
					const at = (Wl, u, y, a) => WL.toWorld(Wl, u, y, a);
					const nrm = (Wl, side) => WL.normalOf(Wl, side);
					const pieceOf = (Wl, minW, minH) => Wl.pieces.find((p) => p.u1 - p.u0 >= minW && p.y1 - p.y0 >= minH && p.y0 <= Wl.floor + 0.05);
					const ext = src.walls.filter((Wl) => Wl.ext && Wl.floor === 0 && pieceOf(Wl, 1.8, 2.3)).sort((a, b) => b.pieces.length - a.pieces.length)[0];
					const part = src.walls.filter((Wl) => !Wl.ext && Wl.floor === 0 && pieceOf(Wl, 1.8, 2.3))[0];
					res.asm = { ext: ext?.asm, part: part?.asm, era: src.era, siding: src.siding };
					if (!ext) return { error: 'no outside wall', res };
					const pe = pieceOf(ext, 1.8, 2.3), inSide = ext.stack.layers[0].lo > (ext.a0 + ext.a1) / 2 - 1e-6 ? 1 : 0;
					// (side 1: the high-a face; which is the room?)
					const roomSide = ext.stack.dir < 0 ? 1 : 0, outSide = 1 - roomSide;
					void inSide;
					const studs = pe.studs, bayU = (studs[1] + studs[2]) / 2, aRoom = roomSide ? ext.a1 : ext.a0, aOut = roomSide ? ext.a0 : ext.a1;
					const nIn = nrm(ext, roomSide), nOut = nrm(ext, outSide);
					// ---- punches from inside, between two studs
					const hit = at(ext, bayU, 1.35, aRoom);
					const eye = new D.V3(hit.x + nIn.x * 0.65, hit.y + 0.15, hit.z + nIn.z * 0.65), dir = new D.V3(hit.x - eye.x, hit.y - eye.y, hit.z - eye.z).normalize();
					const MOV = { jab: { kind: 'light', dmg: 8, reach: 1.4 }, cross: { kind: 'light', dmg: 11, reach: 1.45 }, hook: { kind: 'light', dmg: 14, reach: 1.3 }, heavy: { kind: 'heavy', dmg: 24, reach: 1.5 }, batHeavy: { kind: 'heavy', dmg: 34, reach: 2.0, item: 'bat' } };
					const view = (name, Wl, u, y, side, d = 0.75, du = 0.18, dy = 0.08) => { const p = at(Wl, u, y, side === roomSide ? aRoom : aOut), n = nrm(Wl, side); const t = new D.V3(n.z, 0, -n.x); return D.shot(name, { x: p.x + n.x * d + t.x * du, y: p.y + dy, z: p.z + n.z * d + t.z * du }, p); };
					const punches = [];
					let r = D.blow(eye, dir, MOV.cross); punches.push(r);
					shots.push(view('01-punch-dent', ext, bayU, 1.35, roomSide, 0.55));
					r = D.blow(eye, dir, MOV.hook); punches.push(r);
					shots.push(view('02-punch-cracked', ext, bayU, 1.35, roomSide, 0.55));
					let n = 2;
					while (!r?.holed && n < 14) { r = D.blow(eye, dir, n % 2 ? MOV.heavy : MOV.cross); punches.push(r); n++; }
					res.punchesToHole = n;
					D.step(4);
					shots.push(view('03-punch-through', ext, bayU, 1.35, roomSide, 0.6));
					// widen it: punches round the hole, then up and down the bay
					for (const [du, dy] of [[0.08, 0], [-0.08, 0], [0, 0.12], [0, -0.12], [0.1, 0.2], [-0.1, -0.2], [0.05, 0.3], [-0.05, -0.3], [0, 0.4], [0.12, 0.08], [-0.12, -0.08]]) {
						const p2 = at(ext, bayU + du, 1.35 + dy, aRoom);
						for (let k = 0; k < 3; k++) D.blow(new D.V3(p2.x + nIn.x * 0.6, p2.y + 0.1, p2.z + nIn.z * 0.6), new D.V3(-nIn.x, -0.1, -nIn.z).normalize(), k ? MOV.heavy : MOV.hook);
					}
					// and a stud punched: hard
					const ps = at(ext, studs[2], 1.2, aRoom);
					res.stud = D.blow(new D.V3(ps.x + nIn.x * 0.6, ps.y, ps.z + nIn.z * 0.6), new D.V3(-nIn.x, 0, -nIn.z), MOV.heavy);
					D.step(4);
					shots.push(view('04-punched-hole-insulation-studs', ext, bayU, 1.4, roomSide, 0.85, 0.25, 0.1));
					shots.push(view('05-punched-hole-oblique', ext, bayU, 1.4, roomSide, 0.6, 0.55, 0.25));
					res.punches = punches.map((q) => q && { m: q.material, hard: q.hard, broke: q.broke, holed: q.holed });
					// ---- outside: single rounds into the stucco, then a burst
					const sU = studs.length > 4 ? (studs[3] + studs[4]) / 2 : bayU + 0.4;
					const sp = at(ext, sU, 1.5, aOut), gun = { x: sp.x + nOut.x * 7, y: sp.y + 0.2, z: sp.z + nOut.z * 7 };
					res.single = [];
					for (const [du, dy] of [[0, 0], [0.35, 0.25], [-0.3, -0.3]]) { const q = at(ext, sU + du, 1.5 + dy, aOut); res.single.push(D.fire(gun, q)); }
					shots.push(view('06-stucco-pocks', ext, sU, 1.5, outSide, 1.1, 0.2, 0.1));
					res.burst = [];
					for (let k = 0; k < 9; k++) { const q = at(ext, sU + ((k * 37) % 7 - 3) * 0.012, 1.5 + ((k * 53) % 5 - 2) * 0.014, aOut); res.burst.push(D.fire(gun, q)); }
					D.step(4);
					shots.push(view('07-stucco-burst-lath', ext, sU, 1.5, outSide, 0.55, 0.12, 0.05));
					shots.push(view('08-stucco-burst-wide', ext, sU, 1.5, outSide, 1.3, 0.4, 0.2));
					shots.push(view('09-burst-inside-blowout', ext, sU, 1.5, roomSide, 0.7, 0.15, 0.05));
					// ---- a partition: a round through it (small in, torn out)
					if (part) {
						const pp = pieceOf(part, 1.8, 2.3), pu = (pp.studs[1] + pp.studs[2]) / 2, a0 = part.a0, a1 = part.a1, n0 = nrm(part, 0);
						const q = at(part, pu, 1.4, a0), from = { x: q.x + n0.x * 4, y: q.y, z: q.z + n0.z * 4 };
						res.partition = [D.fire(from, q), D.fire(from, at(part, pu + 0.15, 1.25, a0))];
						shots.push(D.shot('10-partition-entry', { x: q.x + n0.x * 0.6, y: q.y + 0.05, z: q.z + n0.z * 0.6 }, q));
						const q1 = at(part, pu, 1.4, a1), n1 = nrm(part, 1);
						shots.push(D.shot('11-partition-exit', { x: q1.x + n1.x * 0.6, y: q1.y + 0.05, z: q1.z + n1.z * 0.6 }, q1));
						// a blast against it: a way through, and you walk through it
						const bp = at(part, (pp.u0 + pp.u1) / 2, 1.0, a0);
						WL.blast({ x: bp.x + n0.x * 0.5, y: bp.y, z: bp.z + n0.z * 0.5 }, 2.2, 160);
						D.step(6);
						res.breach = WL.breaches(bp.x, bp.z, 6).filter((b) => b.key === part.key);
						shots.push(D.shot('12-breach-side-a', { x: bp.x + n0.x * 1.8, y: bp.y + 0.5, z: bp.z + n0.z * 1.8 }, { x: bp.x, y: bp.y + 0.1, z: bp.z }, 65));
						const bq = at(part, (pp.u0 + pp.u1) / 2, 1.0, a1);
						shots.push(D.shot('13-breach-side-b', { x: bq.x + n1.x * 1.8, y: bq.y + 0.5, z: bq.z + n1.z * 1.8 }, { x: bq.x, y: bq.y + 0.1, z: bq.z }, 65));
						// walk: from 1 m on side A straight through
						const br = res.breach[0];
						if (br) {
							const c = new D.V3(br.x, 0, br.z), start = { x: c.x + n0.x * 1.0, z: c.z + n0.z * 1.0 }, P = D.P;
							D.stand(start.x, y0, start.z, c.x, y0 + 1.6, c.z);
							let crossed = false;
							for (let i = 0; i < 60; i++) {
								P.pos.x -= n0.x * 0.05; P.pos.z -= n0.z * 0.05;
								w.houses.push(P.pos, P.pos.y - 1.68);
								const side = (P.pos.x - c.x) * n0.x + (P.pos.z - c.z) * n0.z;
								if (side < -0.6) { crossed = true; break; }
							}
							res.walkedThrough = crossed;
							// (and the same walk into a whole stretch of the wall is stopped)
							const solid = at(part, pp.u0 + 0.3, 1.0, a0);
							D.stand(solid.x + n0.x * 1, y0, solid.z + n0.z * 1, solid.x, y0 + 1.6, solid.z);
							for (let i = 0; i < 40; i++) { P.pos.x -= n0.x * 0.05; P.pos.z -= n0.z * 0.05; w.houses.push(P.pos, P.pos.y - 1.68); }
							res.solidStops = (P.pos.x - solid.x) * n0.x + (P.pos.z - solid.z) * n0.z > 0;
						}
					}
					// ---- a window shot until it webs, holes and goes; climbed through
					const pane = S.glass.panes().filter((p) => p.plan?.house === h && !p.gone && p.h > 1 && p.w > 0.7).sort((a, b) => a.y - b.y)[0];
					if (pane) {
						const pc = { x: pane.x, y: pane.y, z: pane.z }, from = { x: pane.x + pane.nx * 6, y: pane.y + 0.1, z: pane.z + pane.nz * 6 };
						const look = (name) => D.shot(name, { x: pane.x + pane.nx * 1.6, y: pane.y + 0.15, z: pane.z + pane.nz * 1.6 }, pc, 60);
						res.window = [];
						res.window.push(D.fire(from, { x: pc.x + 0.1 * pane.nz, y: pc.y + 0.1, z: pc.z - 0.1 * pane.nx }));
						shots.push(look('14-window-spiderweb'));
						res.window.push(D.fire(from, { x: pc.x + 0.12 * pane.nz, y: pc.y + 0.08, z: pc.z - 0.12 * pane.nx }));
						shots.push(look('15-window-hole'));
						res.window.push(D.fire(from, { x: pc.x + 0.08 * pane.nz, y: pc.y + 0.12, z: pc.z - 0.08 * pane.nx }));
						shots.push(look('16-window-bigger-hole'));
						res.window.push(D.fire(from, { x: pc.x, y: pc.y, z: pc.z }));
						res.paneGone = !!pane.gone;
						D.step(10);
						shots.push(look('17-window-shattered'));
						// climb through: in front of it, facing it, a jump
						const P = D.P, floor = w.island.heightAt(pane.x + pane.nx * 0.9, pane.z + pane.nz * 0.9);
						D.stand(pane.x + pane.nx * 0.9, floor, pane.z + pane.nz * 0.9, pane.x, floor + 1.6, pane.z);
						res.ahead = S.ahead();
						res.vault = S.vault();
						let mid = null;
						for (let i = 0; i < 40 && P.move; i++) { const go = P.move(1 / 30); D.cam.position.copy(P.pos); D.cam.rotation.set(P.pitch || 0, P.yaw, 0, 'YXZ'); if (i === 9) mid = D.shot('18-climbing-through', P.pos, { x: P.pos.x - Math.sin(P.yaw), y: P.pos.y - 0.25, z: P.pos.z - Math.cos(P.yaw) }, 70); if (!go && i > 2) break; }
						if (mid) shots.push(mid);
						res.climbedInside = !!w.houses.inside(P.pos);
					}
					res.walls = WL.info();
					return { res, shots };
				});
				save(out.shots);
				report.house = out.res || out;
				console.log('house', JSON.stringify(out.res || out));
			}
		}
		if (ONLY.includes('city')) {
			await page.evaluate(() => { const w = Crysis.world(), P = w.player.state; Crysis.setHome(37.7952, -122.4028, 'jackson'); Crysis.goHome(); P.flying = false; P.pos.y = w.island.heightAt(P.pos.x, P.pos.z) + 1.68; });
			await page.waitForTimeout(+(process.env.SETTLE || 30000));
			const out = await page.evaluate(`(() => {
				const D = window.__D || (window.__D = (${helpers.toString()})()), w = D.w, WL = D.S.walls, shots = [], res = {};
				w.interiors.budget?.(40);
				for (let i = 0; i < 400; i++) D.step(1, 0.05);
				const pick = (kinds) => { for (const s of WL.sources.values()) if (s.kind === 'interior') for (const Wl of s.walls) if (kinds.includes(Wl.stack.kind) && Wl.pieces.some((p) => p.u1 - p.u0 > 1.5 && p.y1 - p.y0 > 2.2)) return Wl; return null; };
				res.kinds = [...new Set([...WL.sources.values()].flatMap((s) => s.walls.map((Wl) => Wl.asm)))];
				const shoot = (Wl, name, rounds, blastE) => {
					const p = Wl.pieces.find((q) => q.u1 - q.u0 > 1.5 && q.y1 - q.y0 > 2.2), side = Wl.inSide === undefined ? 0 : Wl.inSide > 0 ? 1 : 0;
					const a = side ? Wl.a1 : Wl.a0, u = (p.u0 + p.u1) / 2, y = p.y0 + 1.4, q = WL.toWorld(Wl, u, y, a), n = WL.normalOf(Wl, side);
					const from = { x: q.x + n.x * 3, y: q.y + 0.1, z: q.z + n.z * 3 };
					for (let k = 0; k < rounds; k++) D.fire(from, WL.toWorld(Wl, u + ((k * 37) % 9 - 4) * 0.02, y + ((k * 53) % 7 - 3) * 0.02, a), 82);
					if (blastE) WL.blast({ x: q.x + n.x * 0.4, y: q.y, z: q.z + n.z * 0.4 }, 1.6, blastE);
					D.step(6);
					shots.push(D.shot(name + '-near', { x: q.x + n.x * 0.9 + n.z * 0.3, y: q.y + 0.15, z: q.z + n.z * 0.9 - n.x * 0.3 }, q));
					shots.push(D.shot(name + '-wide', { x: q.x + n.x * 2.2 + n.z * 0.8, y: q.y + 0.5, z: q.z + n.z * 2.2 - n.x * 0.8 }, q, 60));
					const qb = WL.toWorld(Wl, u, y, side ? Wl.a0 : Wl.a1), nb = WL.normalOf(Wl, 1 - side);
					shots.push(D.shot(name + '-other-side', { x: qb.x + nb.x * 1.5, y: qb.y + 0.3, z: qb.z + nb.z * 1.5 }, qb, 60));
					return { asm: Wl.asm, breach: Wl.breach.filter(Boolean).length };
				};
				const brick = pick(['brick', 'block']);
				if (brick) res.brick = shoot(brick, '20-brick', 14, 260);
				const conc = pick(['concrete']);
				if (conc) res.concrete = shoot(conc, '21-concrete', 24, 300);
				res.walls = WL.info();
				return { res, shots };
			})()`);
			save(out.shots);
			report.city = out.res;
			console.log('city', JSON.stringify(out.res));
		}
		report.errors = errors;
		fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
		console.log(JSON.stringify({ errors }));
		if (errors.length) process.exitCode = 1;
	} finally {
		await browser.close();
		server.close();
	}
})().catch((e) => { console.error(e); process.exitCode = 1; });
