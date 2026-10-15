// Drives destruction-rig.mjs in headless Chromium: punches through a house's drywall to its batts
// and studs, single rounds and a burst into its stucco (and the blow-outs inside), a round through
// a partition, a window webbed, holed and broken and climbed through, a blast through a partition
// and a walk through the breach, a prewar wall's plaster and lath, a brick front, an old shop's
// brick and a warehouse's concrete to its bars. Pictures of each stage from both sides go to OUT.
//
// Run: OUT=/tmp/destruction node island/tools/destruction-rig.cjs  (PLAYWRIGHT_MODULE as usual)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const esbuild = require(path.resolve(__dirname, '../node_modules/esbuild'));
const OUT = process.env.OUT || '/tmp/destruction';

// ---- in the page: the stages
function stages() {
	const R = window.rig, { THREE, S, houses, step, shot, fire, blow } = R, WL = S.walls, shots = [], res = {};
	const V = (x, y, z) => new THREE.Vector3(x, y, z);
	const srcOf = (b) => [...WL.sources.values()].find((s) => s.kind === 'house' && Math.abs(s.h.cx - b.x) < 3 && Math.abs(s.h.cz - b.z) < 3);
	const at = (Wl, u, y, a) => WL.toWorld(Wl, u, y, a), nrm = (Wl, side) => WL.normalOf(Wl, side);
	const pieceOf = (Wl, minW, minH) => Wl.pieces.find((p) => p.u1 - p.u0 >= minW && p.y1 - p.y0 >= minH && p.y0 <= Wl.floor + 0.05);
	const roomSideOf = (Wl) => (Wl.stack.dir < 0 ? 1 : 0);
	// the middle of the widest stud bay nearest the middle of a run (or of the n-th bay from it)
	const bayOf = (st, n = 0) => { const bays = st.slice(0, -1).map((s, i) => [i, st[i + 1] - s]).filter((b) => b[1] > 0.3); const m = bays[Math.min(bays.length - 1, Math.floor(bays.length / 2) + n)] || [0]; return (st[m[0]] + st[m[0] + 1]) / 2; };
	const faceA = (Wl, side) => (side ? Wl.a1 : Wl.a0);
	const view = (name, Wl, u, y, side, d = 0.75, du = 0.18, dy = 0.08, fov = 55) => { step(45); const p = at(Wl, u, y, faceA(Wl, side)), n = nrm(Wl, side), t = V(n.z, 0, -n.x); R.room.position.set(p.x + n.x * 1.6, p.y + 0.8, p.z + n.z * 1.6); R.room.intensity = side === roomSideOf(Wl) ? 2.2 : 0; shots.push({ name, url: shot({ x: p.x + n.x * d + t.x * du, y: p.y + dy, z: p.z + n.z * d + t.z * du }, p, fov) }); };
	const MOV = { jab: { kind: 'light', dmg: 8, reach: 1.4 }, cross: { kind: 'light', dmg: 11, reach: 1.45 }, hook: { kind: 'light', dmg: 14, reach: 1.3 }, heavy: { kind: 'heavy', dmg: 24, reach: 1.5 }, batHeavy: { kind: 'heavy', dmg: 34, reach: 2.0, item: 'bat' } };
	const punchAt = (Wl, u, y, side, move) => { const p = at(Wl, u, y, faceA(Wl, side)), n = nrm(Wl, side); return blow(V(p.x + n.x * 0.62, p.y + 0.12, p.z + n.z * 0.62), V(-n.x * 0.62, -0.12, -n.z * 0.62).normalize(), move); };
	const only = (window.ONLY || 'all').split(',');
	const want = (k) => only.includes('all') || only.includes(k);

	// ---- the tract house: punches from inside
	const A = srcOf(R.homes[0]);
	res.sources = WL.info();
	if (!A) return { res: { error: 'house not built', info: WL.info(), houses: houses.count() }, shots };
	const ext = A.walls.filter((Wl) => Wl.ext && Wl.floor === 0 && pieceOf(Wl, 1.8, 2.3)).sort((a, b) => (pieceOf(b, 1.8, 2.3).u1 - pieceOf(b, 1.8, 2.3).u0) - (pieceOf(a, 1.8, 2.3).u1 - pieceOf(a, 1.8, 2.3).u0))[0];
	const part = A.walls.filter((Wl) => !Wl.ext && Wl.floor === 0 && pieceOf(Wl, 1.6, 2.3))[0];
	res.asm = { ext: ext?.asm, part: part?.asm, era: A.era };
	const pe = pieceOf(ext, 1.8, 2.3), rs = roomSideOf(ext), os2 = 1 - rs, st = pe.studs, mid = Math.max(1, Math.floor(st.length / 2) - 1), bayU = bayOf(st, -1);
	if (want('punch')) {
		res.punches = [];
		res.punches.push(punchAt(ext, bayU, 1.35, rs, MOV.cross));
		view('01-punch-dent', ext, bayU, 1.35, rs, 0.5, 0.1, 0.05);
		res.punches.push(punchAt(ext, bayU, 1.35, rs, MOV.hook));
		view('02-punch-cracked', ext, bayU, 1.35, rs, 0.5, 0.1, 0.05);
		let n = 2, r = res.punches[1];
		while (!r?.holed && n < 16) { r = punchAt(ext, bayU, 1.35, rs, n % 2 ? MOV.heavy : MOV.cross); res.punches.push(r); n++; }
		res.punchesToHole = n;
		step(3);
		view('03-punch-through', ext, bayU, 1.35, rs, 0.55, 0.1, 0.05);
		for (const [du, dy] of [[0.08, 0], [-0.08, 0], [0, 0.12], [0, -0.12], [0.1, 0.22], [-0.1, -0.22], [0.05, 0.32], [-0.05, -0.32], [0, 0.42], [0.12, 0.1], [-0.12, -0.1], [0, -0.45]]) for (let k = 0; k < 3; k++) punchAt(ext, bayU + du, 1.35 + dy, rs, k ? MOV.heavy : MOV.hook);
		res.stud = punchAt(ext, st[mid + 2] ?? st[mid], 1.25, rs, MOV.heavy);
		step(3);
		view('04-punched-hole-insulation-studs', ext, bayU, 1.4, rs, 0.85, 0.2, 0.1);
		view('05-punched-hole-oblique', ext, bayU, 1.4, rs, 0.55, 0.5, 0.2);
		view('05b-punched-wall-outside', ext, bayU, 1.4, os2, 1.2, 0.3, 0.1);
		res.punches = res.punches.map((q) => q && { m: q.material, hard: q.hard, holed: q.holed });
	}
	if (want('stucco')) {
		const sU = bayOf(st, 1);
		const sp = at(ext, sU, 1.5, faceA(ext, os2)), nO = nrm(ext, os2), gun = { x: sp.x + nO.x * 7, y: sp.y + 0.2, z: sp.z + nO.z * 7 };
		res.single = [[0, 0], [0.4, 0.3], [-0.35, -0.3]].map(([du, dy]) => fire(gun, at(ext, sU + du, 1.5 + dy, faceA(ext, os2))));
		view('06-stucco-pocks', ext, sU, 1.5, os2, 1.0, 0.15, 0.08);
		res.burst = [];
		for (let k = 0; k < 9; k++) res.burst.push(fire(gun, at(ext, sU + ((k * 37) % 7 - 3) * 0.013, 1.5 + ((k * 53) % 5 - 2) * 0.015, faceA(ext, os2))));
		step(3);
		view('07-stucco-burst-lath', ext, sU, 1.5, os2, 0.5, 0.1, 0.05);
		view('08-stucco-burst-wide', ext, sU, 1.5, os2, 1.3, 0.4, 0.2);
		view('09-burst-inside-blowout', ext, sU, 1.5, rs, 0.6, 0.12, 0.05);
	}
	if (want('partition') && part) {
		const pp = pieceOf(part, 1.6, 2.3), pu = bayOf(pp.studs), n0 = nrm(part, 0), q = at(part, pu, 1.4, part.a0);
		res.partition = [fire({ x: q.x + n0.x * 0.8, y: q.y, z: q.z + n0.z * 0.8 }, q), fire({ x: q.x + n0.x * 0.8, y: q.y, z: q.z + n0.z * 0.8 }, at(part, pu + 0.12, 1.22, part.a0))];
		view('10-partition-entry', part, pu + 0.06, 1.3, 0, 0.5, 0.08, 0.04);
		view('11-partition-exit', part, pu + 0.06, 1.3, 1, 0.5, 0.08, 0.04);
		const bp = at(part, (pp.u0 + pp.u1) / 2, 1.0, part.a0);
		WL.blast({ x: bp.x + n0.x * 0.5, y: bp.y, z: bp.z + n0.z * 0.5 }, 2.2, 160);
		step(4);
		res.breach = WL.breaches(bp.x, bp.z, 6).filter((b) => b.key === part.key);
		view('12-breach-side-a', part, (pp.u0 + pp.u1) / 2, 1.1, 0, 1.9, 0.5, 0.45, 65);
		view('13-breach-side-b', part, (pp.u0 + pp.u1) / 2, 1.1, 1, 1.9, -0.5, 0.45, 65);
		const br = res.breach[0];
		if (br) {
			const c = V(br.x, 0, br.z), pos = V(c.x + n0.x * 1.0, A.h.floorY + 1.68, c.z + n0.z * 1.0);
			let crossed = false;
			for (let i = 0; i < 60; i++) { pos.x -= n0.x * 0.05; pos.z -= n0.z * 0.05; houses.push(pos, pos.y - 1.68); if ((pos.x - c.x) * n0.x + (pos.z - c.z) * n0.z < -0.6) { crossed = true; break; } }
			res.walkedThrough = crossed;
			const other = A.walls.find((Wl) => !Wl.ext && Wl !== part && Wl.floor === 0 && !Wl.cells && pieceOf(Wl, 1.2, 2.3));
			const op2 = pieceOf(other, 1.2, 2.3), nO = nrm(other, 0);
			const sol = at(other, (op2.u0 + op2.u1) / 2, 1.0, other.a0), p2 = V(sol.x + nO.x, A.h.floorY + 1.68, sol.z + nO.z);
			for (let i = 0; i < 40; i++) { p2.x -= nO.x * 0.05; p2.z -= nO.z * 0.05; houses.push(p2, p2.y - 1.68); }
			res.solidStops = (p2.x - sol.x) * nO.x + (p2.z - sol.z) * nO.z > 0;
		}
	}
	if (want('window')) {
		const pane = S.glass.panes().filter((p) => p.plan?.house === A.h && !p.gone && p.plan.op.type === 'window' && p.plan.op.y0 + A.h.floorY > 0.35 && p.plan.op.y0 + A.h.floorY < 1.35 && p.w > 0.6).sort((a, b) => a.y - b.y)[0];
		res.panes = S.glass.panes().length;
		if (pane) {
			const pc = { x: pane.x, y: pane.y, z: pane.z }, from = { x: pane.x + pane.nx * 6, y: pane.y + 0.1, z: pane.z + pane.nz * 6 };
			const look = (name) => shots.push({ name, url: shot({ x: pane.x + pane.nx * 1.5 + pane.nz * 0.3, y: pane.y + 0.15, z: pane.z + pane.nz * 1.5 - pane.nx * 0.3 }, pc, 60) });
			const aim = (du, dv) => ({ x: pc.x + du * pane.nz, y: pc.y + dv, z: pc.z - du * pane.nx });
			res.window = [fire(from, aim(0.1, 0.1))]; look('14-window-spiderweb');
			res.window.push(fire(from, aim(0.12, 0.08))); look('15-window-hole');
			res.window.push(fire(from, aim(0.08, 0.12))); look('16-window-bigger-hole');
			res.window.push(fire(from, aim(0, 0)));
			res.paneGone = !!pane.gone;
			step(20); look('17-window-shattered');
			// climb through: the vault, stepped by hand
			const P = R.P;
			P.pos.set(pane.x + pane.nx * 0.85, 1.68, pane.z + pane.nz * 0.85); P.yaw = Math.atan2(pane.nx, pane.nz); P.pitch = 0; P.flying = false; P.locked = false; P.vel.set(0, 0, 0);
			P.grounded = true;
			res.ahead = S.ahead(); res.vault = S.vault();
			if (!res.ahead) { const h = A.h, dx = P.pos.x - h.cx, dz = P.pos.z - h.cz, px = h.ca * dx + h.sa * dz, pz = -h.sa * dx + h.ca * dz; res.aheadWhy = { foot: +(P.pos.y - 1.68).toFixed(2), floorY: +h.floorY.toFixed(2), pane: [pane.u0, pane.u1, pane.y0, pane.y1].map((v) => +v.toFixed(2)), px: +px.toFixed(2), pz: +pz.toFixed(2), wall: { axis: pane.plan.wall.axis, pos: pane.plan.wall.pos, inSide: pane.plan.wall.inSide }, type: pane.plan.op.type }; }
			for (let i = 0; i < 40 && P.move; i++) { const go = P.move(1 / 30); if (i === 8) shots.push({ name: '18-climbing-through', url: shot(P.pos, { x: P.pos.x - Math.sin(P.yaw), y: P.pos.y - 0.3, z: P.pos.z - Math.cos(P.yaw) }, 70) }); if (!go && i > 2) break; }
			res.climbedInside = !!houses.inside(P.pos);
		}
	}
	// ---- a prewar house: plaster on lath; a new one with a brick front
	if (want('prewar')) {
		const B = srcOf(R.homes[1]);
		const e2 = B?.walls.filter((Wl) => Wl.ext && Wl.floor === 0 && pieceOf(Wl, 1.6, 2.3))[0];
		if (e2) {
			const p2 = pieceOf(e2, 1.6, 2.3), r2 = roomSideOf(e2), u2 = bayOf(p2.studs);
			res.prewarHits = [];
			for (let k = 0; k < 14; k++) res.prewarHits.push(punchAt(e2, u2 + (k % 3 - 1) * 0.06, 1.3 + (k % 4 - 1.5) * 0.08, r2, MOV.batHeavy));
			res.prewarHits = res.prewarHits.map((q) => q && [q.material, q.hard, q.stud, q.holed]);
			res.prewarCells = (() => { const P = e2.cells[e2.pieces.indexOf(p2)]; let m = 0; for (const D of P.dmg) for (const x of D) m = Math.max(m, x); return { max: m, nu: P.nu, studs: p2.studs.map((v) => +v.toFixed(2)), u2: +u2.toFixed(2), rs: r2, layers: e2.stack.layers.map((l) => l.m) }; })();
			step(3);
			res.prewar = e2.asm;
			view('19-plaster-lath', e2, u2, 1.3, r2, 0.75, 0.2, 0.08);
		}
		const C = srcOf(R.homes[2]);
		const e3 = C?.walls.filter((Wl) => Wl.ext && Wl.floor === 0 && pieceOf(Wl, 1.6, 2.3))[0];
		if (e3) {
			const p3 = pieceOf(e3, 1.6, 2.3), o3 = 1 - roomSideOf(e3), u3 = (p3.u0 + p3.u1) / 2, q3 = at(e3, u3, 1.2, faceA(e3, o3)), n3 = nrm(e3, o3);
			WL.blast({ x: q3.x + n3.x * 0.6, y: q3.y, z: q3.z + n3.z * 0.6 }, 1.8, 140);
			step(3);
			res.veneer = e3.asm;
			view('20-brick-veneer-outside', e3, u3, 1.2, o3, 2.6, 0.6, 0.3, 60);
			view('21-brick-veneer-inside', e3, u3, 1.2, 1 - o3, 2.2, 0.5, 0.3, 60);
		}
	}
	// ---- interiors: an old shop's brick, a warehouse's concrete
	if (want('city')) {
		const isrc = [...WL.sources.values()].filter((s) => s.kind === 'interior');
		res.interiors = isrc.map((s) => s.use + ':' + [...new Set(s.walls.map((Wl) => Wl.asm))].join('/'));
		const pick = (kinds) => { for (const s of isrc) for (const Wl of s.walls) if (Wl.ext && kinds.includes(Wl.stack.kind) && pieceOf(Wl, 1.5, 2.2)) return Wl; return null; };
		const hitWall = (Wl, name, rounds, blastE, dmg) => {
			const p = pieceOf(Wl, 1.5, 2.2), side = Wl.inSide > 0 ? 1 : 0, u = (p.u0 + p.u1) / 2, y = p.y0 + 1.4, q = at(Wl, u, y, faceA(Wl, side)), n = nrm(Wl, side);
			const from = { x: q.x + n.x * 3, y: q.y + 0.1, z: q.z + n.z * 3 };
			for (let k = 0; k < rounds; k++) fire(from, at(Wl, u + ((k * 37) % 9 - 4) * 0.025, y + ((k * 53) % 7 - 3) * 0.025, faceA(Wl, side)), dmg);
			if (blastE) WL.blast({ x: q.x + n.x * 0.35, y: q.y, z: q.z + n.z * 0.35 }, 1.4, blastE);
			step(4);
			view(name + '-inside', Wl, u, y, side, 1.0, 0.3, 0.12, 60);
			view(name + '-inside-near', Wl, u, y, side, 0.55, 0.15, 0.05);
			view(name + '-outside', Wl, u, y, 1 - side, 1.4, 0.35, 0.2, 60);
			return { asm: Wl.asm, breach: Wl.breach.filter(Boolean).length };
		};
		const brick = pick(['brick', 'block']);
		if (brick) res.brick = hitWall(brick, '22-brick', 20, 240, 82);
		const conc = pick(['concrete']);
		if (conc) res.concrete = hitWall(conc, '23-concrete', 40, 380, 82);
	}
	res.walls = WL.info();
	return { res, shots };
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-'));
	await esbuild.build({ entryPoints: [path.join(__dirname, 'destruction-rig.mjs')], bundle: true, format: 'esm', outfile: path.join(dir, 'rig.js'), logLevel: 'error' });
	fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body style="margin:0"><script type="module" src="rig.js"></script></body></html>');
	const server = http.createServer((req, res) => { try { const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)); res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : 'text/html'); res.end(fs.readFileSync(f)); } catch { res.writeHead(404).end(); } });
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [];
	try {
		const page = await browser.newPage({ viewport: { width: +(process.env.W || 900), height: +(process.env.H || 600) } });
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 400)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { timeout: 600000 });
		await page.waitForFunction(() => window.RIG_READY || window.__err, null, { timeout: 900000, polling: 2000 });
		await page.evaluate((o) => { window.ONLY = o; }, process.env.ONLY || 'all');
		const out = await page.evaluate(`(${stages.toString()})()`);
		for (const s of out.shots) fs.writeFileSync(path.join(OUT, s.name + '.jpg'), Buffer.from(s.url.split(',')[1], 'base64'));
		fs.writeFileSync(path.join(OUT, 'rig-report.json'), JSON.stringify({ ...out.res, errors }, null, 1));
		console.log(JSON.stringify({ ...out.res, errors }));
	} finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
