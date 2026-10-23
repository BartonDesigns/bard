// The country's homes up close. bay/houses.js builds a home of the regional settlements
// (settle.js, structures.js home()) for real as you come near, as it does the Bay's: its walls,
// windows and doors, its rooms and furniture, its family. What a Bay house keeps from the city
// (its roof, drawn from afar and kept), a country home has from here, out of its own
// description: its look outside (ruralLook: the walls' finish and colour, the trim, the door)
// and the rest of its shell (ruralShell): the roof over the walls (a gable, a hip, or a flat
// roof behind its parapet; slate or shingle, clay tile, corrugated iron, thatch), its chimney,
// a porch or a verandah, a balcony, the timbers of a half-timbered or a post-and-beam wall,
// shutters, and a floor up on posts or stilts. All in the house's own frame (houseplan.js: x
// across the front, the front toward +z, y up from the ground floor), which is the lot's
// turned half round: what structures.js drew at (x, z) is here at (-(x - the house's x), -z).

import * as THREE from 'three';
import { col, shade, mixc } from './geo.js';
import { SIDING, DOOR, roll } from '../bay/decor.js';
import { HT } from '../bay/houseplan.js';

// the walls' finishes (housekit.js sidings; a render is the stucco) and the roofs'
const SKIN = { lap: SIDING.lap, board: SIDING.batten, shingle: SIDING.shingle, brick: SIDING.brick, stone: SIDING.stone, log: SIDING.log, render: null, mud: SIDING.mud };
const ROOF = { shingle: 'roof0', tile: 'roof1', tin: 'roof2', thatch: 'roof3' };
const SNOW = [0.93, 0.95, 0.98];
// (the settlements' colours are linear; a house's look is given in sRGB, as decor.js's are)
const srgb = (c) => { const v = col(c), k = new THREE.Color(v[0], v[1], v[2]), o = {}; k.getRGB(o, THREE.SRGBColorSpace); return [o.r, o.g, o.b]; };
const skinKey = (s) => (SKIN[s] == null ? 'stucco' : 'siding' + SKIN[s]);

// how a country home looks outside, as bay/houses.js takes a house's look (decor.js
// exteriorLook): its own walls and trim, a door of its kind, and the household inside an old
// house's (prewar: papered rooms, dark woodwork) or a plainer one's (ranch)
export function ruralLook(H, seed) {
	const r = (k) => roll(seed, k), plain = H.skin === 'render' || H.skin === 'mud';
	const trim = srgb(H.trim || shade(col(H.wall), 0.8));
	return {
		era: r(1) < 0.65 ? 'prewar' : 'ranch', wall: srgb(H.wall), siding: SKIN[H.skin] ?? null, trim, frame: trim, garage: trim,
		door: srgb(H.doorCol || [0.4, 0.28, 0.18]),
		doorStyle: H.skin === 'log' || H.skin === 'board' ? (r(3) < 0.5 ? DOOR.five : DOOR.craftsman) : plain ? (r(3) < 0.6 ? DOOR.slab : DOOR.carved) : r(3) < 0.5 ? DOOR.six : DOOR.craftsman,
		// (boards round the windows on a boarded house; stone, logs and render show their own edges)
		surround: plain || H.skin === 'stone' || H.skin === 'log' ? 'none' : 'trim', grilles: !plain && r(2) < 0.55,
	};
}

// the ground floor's outside walls in their own finish (a chalet's stone or render under its
// boards, a half-timbered house's stone), as [key, linear colour]; null: the house's own
export const lowerSkin = (H) => (H.lower ? [skinKey(H.lower.skin), col(H.lower.col)] : null);

// the rest of the shell, into the house's builder g (housekit.js Builder). Returns what you walk
// on (stoop: [x0, z0, x1, z1, y]), what holds you out (col: [x0, z0, x1, z1, y0, y1]) and where
// the steps down from the door start (deck: the front edge of a porch or verandah, z)
export function ruralShell(g, plan, H, { base, gl, ext, wall }) {
	const R = plan.rects.find((q) => q.main) || plan.rects[0];
	const x0 = R.x0, x1 = R.x1, z0 = R.z0, z1 = R.z1, top = R.top, W = x1 - x0, D = z1 - z0;
	const out = { stoop: [], col: [], deck: null, stepKey: 'concrete', stepCol: [0.6, 0.59, 0.56] };
	const hx = H.x || 0, at = (px, pz) => [-(px - hx), -pz];
	const rf = H.roof || { kind: 'gable', rise: D * 0.4, o: 0.4, skin: 'shingle' };
	const rcol = col(rf.col || [0.4, 0.3, 0.25]), rc = mixc(rcol, SNOW, Math.min(0.9, rf.snow || 0)), rk = ROOF[rf.skin] || 'roof0';
	const trim = col(H.trim || shade(col(H.wall), 0.8)), soffit = rf.skin === 'thatch' ? shade(rcol, 0.5) : rf.skin === 'tin' ? shade(rcol, 0.6) : shade(trim, 0.8);
	const o = rf.o ?? 0.4, t = rf.skin === 'thatch' ? 0.32 : 0.16;

	// a sloped slab: its top (k, c) over the four points (p0, p1 the low edge), its underside and
	// edges (the soffit's colour), the pattern's rows along the low edge
	function slab(k, p0, p1, p2, p3, c, th = t, under = soffit) {
		const e = norm(sub(p1, p0)), up = sub(p3, p0), sv = norm(sub(up, mul(e, dot(up, e))));
		const n0 = cross(sub(p1, p0), sub(p3, p0)), n = norm(n0[1] < 0 ? mul(n0, -1) : n0);
		const P = [p0, p1, p2, p3], uv = P.map((p) => [dot(sub(p, p0), e), dot(sub(p, p0), sv)]);
		g.quad(k, ...P, n, c, uv);
		const B = P.map((p) => [p[0], p[1] - th, p[2]]), nd = mul(n, -1);
		g.quad(k === 'roof3' ? k : 'trim', ...B, nd, under, uv);
		for (let i = 0; i < 4; i++) {
			const a = P[i], b = P[(i + 1) % 4], a2 = B[i], b2 = B[(i + 1) % 4];
			if (Math.hypot(...sub(b, a)) < 1e-4) continue;
			const m = norm(cross(sub(b, a), [0, -1, 0])), mid = mul(add(a, b), 0.5), cen = mul(add(add(P[0], P[1]), add(P[2], P[3])), 0.25);
			const nn = dot(m, sub(mid, cen)) < 0 ? mul(m, -1) : m;
			g.quad(k === 'roof3' ? k : 'trim', a, b, b2, a2, nn, k === 'roof3' ? shade(c, 0.8) : under, [[0, 0], [Math.hypot(...sub(b, a)), 0], [Math.hypot(...sub(b, a)), th], [0, th]]);
		}
	}
	// a wall's triangle under a gable (its face toward n)
	const tri = (a, b, c, n) => g.quad(ext, a, b, c, c, n, wall, [a, b, c, c].map((p) => (n[0] ? [p[2], p[1]] : [p[0], p[1]])));
	// the height of the roof's top over a point (for a chimney to clear it)
	let roofAt = () => top;

	// ---- the roof
	if (rf.kind === 'flat') {
		// the deck, the parapet round it on the walls (their finish outside, a coping on top)
		const p = rf.parapet ?? 0.4, tp = 0.22, deck = col(rf.deck || shade(col(rf.col || H.wall), 0.85)), cope = shade(col(rf.col || H.wall), 1.08);
		g.box('concrete', x0, top - 0.18, z0, x1, top + 0.04, z1, deck);
		for (const [a, b, c, d] of [[x0, z0, x1, z0 + tp], [x0, z1 - tp, x1, z1], [x0, z0 + tp, x0 + tp, z1 - tp], [x1 - tp, z0 + tp, x1, z1 - tp]]) {
			g.box((f) => (f === 2 ? null : ext), a, top - 0.02, b, c, top + p, d, wall);
			g.box('concrete', a - 0.03, top + p, b - 0.03, c + 0.03, top + p + 0.06, d + 0.03, cope);
		}
		roofAt = () => top + 0.04;
		// the beams' ends through the front wall (an adobe's vigas)
		if (rf.vigas) for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.9) g.box('grain', x - 0.08, top - 0.48, z1, x + 0.08, top - 0.32, z1 + 0.5, [0.32, 0.22, 0.14]);
		// a water tank on its stand
		if (rf.tank) { const [lx, lz] = at(rf.tank[0], rf.tank[1]); g.cyl('matte', lx, top + 0.04, lz, 0.6, 1.1, [0.06, 0.06, 0.07], 12); }
	} else if (rf.kind === 'hip') {
		const rise = rf.rise ?? Math.min(W, D) * 0.3, s = rise / (Math.min(W, D) / 2), ye = top - o * s, yr = top + rise;
		const X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
		if (W >= D) {
			const rx = Math.max(0, W / 2 - D / 2);
			slab(rk, [X0, ye, Z1], [X1, ye, Z1], [xc + rx, yr, zc], [xc - rx, yr, zc], rc);
			slab(rk, [X1, ye, Z0], [X0, ye, Z0], [xc - rx, yr, zc], [xc + rx, yr, zc], rc);
			slab(rk, [X1, ye, Z1], [X1, ye, Z0], [xc + rx, yr, zc], [xc + rx, yr, zc], rc);
			slab(rk, [X0, ye, Z0], [X0, ye, Z1], [xc - rx, yr, zc], [xc - rx, yr, zc], rc);
		} else {
			const rz = Math.max(0, D / 2 - W / 2);
			slab(rk, [X1, ye, Z1], [X1, ye, Z0], [xc, yr, zc - rz], [xc, yr, zc + rz], rc);
			slab(rk, [X0, ye, Z0], [X0, ye, Z1], [xc, yr, zc + rz], [xc, yr, zc - rz], rc);
			slab(rk, [X0, ye, Z1], [X1, ye, Z1], [xc, yr, zc + rz], [xc, yr, zc + rz], rc);
			slab(rk, [X1, ye, Z0], [X0, ye, Z0], [xc, yr, zc - rz], [xc, yr, zc - rz], rc);
		}
		const hs = Math.min(W, D) / 2;
		roofAt = (x, z) => top + rise * Math.max(0, Math.min(1, (D / 2 - Math.abs(z - zc)) / hs, (W / 2 - Math.abs(x - xc)) / hs));
	} else {
		// a gable: the ridge along the front (or, a chalet's, front to back: its gable the front)
		const alongZ = rf.ridge === 'z', half = alongZ ? W / 2 : D / 2, rise = rf.rise ?? half * 0.8, s = rise / half, ye = top - o * s, yr = top + rise;
		if (!alongZ) {
			const zc = (z0 + z1) / 2, X0 = x0 - o * 0.7, X1 = x1 + o * 0.7;
			slab(rk, [X0, ye, z1 + o], [X1, ye, z1 + o], [X1, yr, zc], [X0, yr, zc], rc);
			slab(rk, [X1, ye, z0 - o], [X0, ye, z0 - o], [X0, yr, zc], [X1, yr, zc], rc);
			tri([x0, top, z1], [x0, top, z0], [x0, yr - 0.05, zc], [-1, 0, 0]);
			tri([x1, top, z0], [x1, top, z1], [x1, yr - 0.05, zc], [1, 0, 0]);
			roofAt = (x, z) => top + rise * Math.max(0, 1 - Math.abs(z - zc) / half);
		} else {
			const xc = (x0 + x1) / 2, Z0 = z0 - o * 0.9, Z1 = z1 + o * 0.9;
			slab(rk, [x1 + o, ye, Z1], [x1 + o, ye, Z0], [xc, yr, Z0], [xc, yr, Z1], rc);
			slab(rk, [x0 - o, ye, Z0], [x0 - o, ye, Z1], [xc, yr, Z1], [xc, yr, Z0], rc);
			tri([x0, top, z1], [x1, top, z1], [xc, yr - 0.05, z1], [0, 0, 1]);
			tri([x1, top, z0], [x0, top, z0], [xc, yr - 0.05, z0], [0, 0, -1]);
			roofAt = (x) => top + rise * Math.max(0, 1 - Math.abs(x - xc) / half);
		}
	}
	// a room on a flat roof (a Greek island's, an adobe's upper room)
	if (H.roofBox) {
		const q = H.roofBox, [cx, cz] = at(q.x, q.z), y0 = top + 0.04, h = q.h || 2.4;
		const a0 = cx - q.w / 2, a1 = cx + q.w / 2, b0 = cz - q.d / 2, b1 = cz + q.d / 2;
		g.box((f) => (f === 3 ? null : f === 2 ? 'concrete' : ext), a0, y0, b0, a1, y0 + h, b1, (f) => (f === 2 ? shade(wall, 0.95) : wall));
		// its door, on the side to the front
		g.at(cx - 0.42, y0, b1 + 0.01, 0); g.box('door2', 0, 0, 0, 0.84, 2.0, 0.03, col(q.door || H.doorCol || [0.3, 0.3, 0.32])); g.at(0, 0, 0, 0);
	}

	// ---- the chimney, up through the roof
	if (H.chimney) {
		const [px, pz, topG, c] = H.chimney, [cx, cz] = at(px, pz), cc = col(c), y1 = Math.max(topG - H.y0, roofAt(cx, cz) + 0.9);
		const k = cc[0] > cc[2] * 1.5 && cc[0] > 0.3 ? 'siding3' : 'siding4';
		g.box(k, cx - 0.32, top - 0.3, cz - 0.32, cx + 0.32, y1, cz + 0.32, cc);
		g.box('concrete', cx - 0.4, y1, cz - 0.4, cx + 0.4, y1 + 0.08, cz + 0.4, [0.5, 0.49, 0.47]);
		g.box('matte', cx - 0.12, y1 + 0.08, cz - 0.12, cx + 0.12, y1 + 0.3, cz + 0.12, [0.12, 0.11, 0.1]);
	}

	// ---- the timbers: posts at the corners and beside every opening, beams at the floor and
	// the top, braces across the wider panels (a half-timbered house's upper storey; a
	// post-and-beam house's whole wall)
	if (H.timber) {
		const tc = col(H.timber);
		for (const w of plan.walls) {
			if (w.kind !== 'ext' || (H.lower && w.level === 0)) continue;
			const face = w.pos, sg = -w.inSide, f0 = face + sg * 0.005, f1 = face + sg * 0.06;
			const yb = w.level === 0 ? 0.05 : w.yb, yt = w.yt;
			const bx = (u0, u1, y0, y1) => (w.axis === 'x' ? g.box('grain', u0, y0, Math.min(f0, f1), u1, y1, Math.max(f0, f1), tc) : g.box('grain', Math.min(f0, f1), y0, u0, Math.max(f0, f1), y1, u1, tc));
			bx(w.s, w.e, yt - 0.18, yt);
			// (the sill beam, broken by a doorway)
			let ub = w.s;
			for (const op of [...w.open.filter((q) => q.y0 < yb + 0.3).sort((a, b) => a.s0 - b.s0), { s0: w.e, s1: w.e }]) { if (op.s0 > ub + 0.05) bx(ub, op.s0, yb, yb + 0.16); ub = Math.max(ub, op.s1); }
			const us = [w.s, w.e - 0.16];
			for (const op of w.open) us.push(op.s0 - 0.16, op.s1);
			us.sort((a, b) => a - b);
			for (const u of us) bx(u, u + 0.16, yb, yt);
			// (a brace across a panel with no opening in it)
			for (let i = 0; i + 1 < us.length; i++) {
				const a = us[i] + 0.16, b = us[i + 1];
				if (b - a < 1.1 || w.open.some((op) => op.s1 > a && op.s0 < b)) continue;
				const m = (f0 + f1) / 2, p0 = w.axis === 'x' ? [a, yb + 0.16, m] : [m, yb + 0.16, a], p1 = w.axis === 'x' ? [b, yt - 0.18, m] : [m, yt - 0.18, b];
				g.beam('grain', p0, p1, 0.14, 0.055, tc);
			}
		}
	}
	// ---- shutters beside the windows
	if (H.shutter) {
		const sc = col(H.shutter);
		for (const w of plan.walls) {
			if (w.kind !== 'ext') continue;
			const sg = -w.inSide, f0 = w.pos + sg * 0.01, f1 = w.pos + sg * 0.05;
			for (const op of w.open) {
				if (op.type !== 'window' || op.s1 - op.s0 > 1.7) continue;
				const sw = Math.min(0.55, (op.s1 - op.s0) / 2 + 0.05);
				for (const [u0, u1] of [[op.s0 - 0.12 - sw, op.s0 - 0.12], [op.s1 + 0.12, op.s1 + 0.12 + sw]]) {
					if (u0 < w.s + 0.05 || u1 > w.e - 0.05) continue;
					if (w.axis === 'x') g.box('siding1', u0, op.y0, Math.min(f0, f1), u1, op.y1, Math.max(f0, f1), sc); else g.box('siding1', Math.min(f0, f1), op.y0, u0, Math.max(f0, f1), op.y1, u1, sc);
				}
			}
		}
	}

	// ---- a porch across the front: its deck at the floor, posts, a beam, its own roof
	if (H.porch) {
		const P = H.porch, pd = P.d || 2.4, py = Math.max(2.3, (P.y || 3) - H.y0), pc = col(P.col || [0.92, 0.92, 0.9]), dc = col(P.deck || [0.55, 0.5, 0.45]), n = Math.max(2, P.posts || 4);
		const ze = z1 + pd;
		g.box('wood', x0, -0.14, z1, x1, 0, ze, dc);
		g.box('trim', x0, base, ze - 0.08, x1, -0.14, ze, shade(dc, 0.7));
		for (const x of [x0, x1 - 0.08]) g.box('trim', x, base, z1, x + 0.08, -0.14, ze, shade(dc, 0.7));
		for (let i = 0; i < n; i++) {
			const x = x0 + 0.2 + i * (W - 0.4) / (n - 1);
			g.box('trim', x - 0.08, 0, ze - 0.26, x + 0.08, py, ze - 0.1, pc);
			out.col.push([x - 0.1, ze - 0.28, x + 0.1, ze - 0.08, 0, py]);
		}
		g.box('trim', x0, py, ze - 0.3, x1, py + 0.22, ze - 0.06, pc);
		const pr = col(P.roof || rf.col || [0.4, 0.3, 0.25]);
		slab(ROOF[rf.skin] || 'roof0', [x0 - 0.15, py + 0.2, ze + 0.3], [x1 + 0.15, py + 0.2, ze + 0.3], [x1 + 0.15, py + 0.2 + (pd + 0.3) * 0.28, z1], [x0 - 0.15, py + 0.2 + (pd + 0.3) * 0.28, z1], mixc(pr, SNOW, Math.min(0.9, rf.snow || 0)), 0.12, shade(pc, 0.92));
		out.stoop.push([x0, z1, x1, ze, 0]);
		out.deck = ze;
	}
	// ---- a verandah all round, under the roof's deep eaves
	if (H.verandah) {
		const V = H.verandah, vo = V.o || 2, pc = col(V.posts || [0.9, 0.9, 0.88]), dc = col(V.deck || [0.55, 0.5, 0.45]);
		const s = (rf.rise ?? 2.6) / (Math.min(W, D) / 2), py = top - (vo - 0.15) * s - t - 0.02;
		const X0 = x0 - vo, X1 = x1 + vo, Z0 = z0 - vo, Z1 = z1 + vo;
		for (const [a, b, c, d] of [[X0, z1, X1, Z1], [X0, Z0, X1, z0], [X0, z0, x0, z1], [x1, z0, X1, z1]]) { g.box('wood', a, -0.14, b, c, 0, d, dc); out.stoop.push([a, b, c, d, 0]); }
		for (const [a, b, c, d] of [[X0, Z1 - 0.08, X1, Z1], [X0, Z0, X1, Z0 + 0.08], [X0, Z0, X0 + 0.08, Z1], [X1 - 0.08, Z0, X1, Z1]]) g.box('trim', a, base - 0.4, b, c, -0.14, d, shade(dc, 0.7));
		const ring = [];
		const nx = Math.max(2, Math.round((X1 - X0) / 3)), nz = Math.max(2, Math.round((Z1 - Z0) / 3));
		for (let i = 0; i <= nx; i++) { const x = X0 + 0.15 + i * (X1 - X0 - 0.3) / nx; ring.push([x, Z1 - 0.15], [x, Z0 + 0.15]); }
		for (let j = 1; j < nz; j++) { const z = Z0 + 0.15 + j * (Z1 - Z0 - 0.3) / nz; ring.push([X0 + 0.15, z], [X1 - 0.15, z]); }
		for (const [x, z] of ring) { g.box('trim', x - 0.06, 0, z - 0.06, x + 0.06, py, z + 0.06, pc); out.col.push([x - 0.09, z - 0.09, x + 0.09, z + 0.09, 0, py]); }
		out.deck = Z1;
	}
	// ---- a balcony across the front at the upper floor (a chalet's, its flower boxes)
	if (H.balcony) {
		const Bc = H.balcony, bd = Bc.d || 1.2, bc = col(Bc.col || [0.4, 0.28, 0.18]), y = HT.floor1, xa = x0 + 0.2, xb = x1 - 0.2, ze = z1 + bd;
		g.box('wood', xa, y - 0.12, z1, xb, y, ze, bc);
		g.box('grain', xa, y, ze - 0.07, xb, y + 1.0, ze, shade(bc, 0.88));
		for (const x of [xa, xb - 0.07]) g.box('grain', x, y, z1, x + 0.07, y + 1.0, ze, shade(bc, 0.88));
		for (const x of [xa + 0.3, (xa + xb) / 2, xb - 0.3]) g.beam('grain', [x, y - 0.12, ze - 0.15], [x, y - 0.9, z1 + 0.02], 0.1, 0.1, shade(bc, 0.8));
		if (Bc.flowers) for (let x = xa + 0.5; x < xb - 0.6; x += 1.2) {
			g.box('grain', x, y + 0.86, ze, x + 0.7, y + 1.06, ze + 0.2, shade(bc, 0.7));
			for (let k = 0; k < 4; k++) g.sphere('matte', x + 0.1 + k * 0.17, y + 1.1, ze + 0.1, 0.1, 0.08, 0.09, [[0.8, 0.1, 0.12], [0.85, 0.25, 0.45], [0.9, 0.85, 0.85], [0.2, 0.42, 0.15]][(((k + Math.round(x * 3)) % 4) + 4) % 4], 6);
		}
	}
	// ---- a floor up on posts or stilts: its underside, the posts down to the ground; too low to
	// walk under, it is closed to you
	if (H.posts) {
		const pc = col(H.posts), dk = H.deck ? col(H.deck.col) : shade(pc, 0.9), wood = H.round || (pc[0] > pc[2] * 1.25);
		const ex = H.deck ? Math.max(0, (H.deck.w - W) / 2) : 0.06, ez = H.deck ? Math.max(0, (H.deck.d - D) / 2) : 0.06;
		g.box(wood ? 'grain' : 'concrete', x0 - ex, -0.22, z0 - ez, x1 + ex, -0.005, z1 + ez, dk);
		if (H.deck) out.stoop.push([x0 - ex, z0 - ez, x1 + ex, z1 + ez, 0]);
		const n = Math.max(2, Math.round(W / 2.6) + 1), m = D > 4.5 ? 3 : 2;
		let lo = 0;
		for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
			const x = x0 + 0.25 + i * (W - 0.5) / (n - 1), z = z0 + 0.25 + j * (D - 0.5) / (m - 1), y0 = gl(x, z) - 0.3;
			lo = Math.min(lo, y0);
			if (H.round) g.cyl('grain', x, y0, z, 0.12, -0.22 - y0, pc, 7, 'y', false);
			else if (wood) g.box('grain', x - 0.1, y0, z - 0.1, x + 0.1, -0.22, z + 0.1, pc);
			else if (pc[0] < 0.36) g.box('metal', x - 0.08, y0, z - 0.08, x + 0.08, -0.22, z + 0.08, pc);
			else g.box('concrete', x - 0.16, y0, z - 0.16, x + 0.16, -0.22, z + 0.16, pc);
			out.col.push([x - 0.17, z - 0.17, x + 0.17, z + 0.17, y0, -0.2]);
		}
		if (H.y0 < 2.1) out.col.push([x0 - ex, z0 - ez, x1 + ex, z1 + ez, lo - 0.5, -0.2]);
	}
	if (H.steps) { const sc = col(H.steps); out.stepCol = sc; out.stepKey = sc[0] > sc[2] * 1.25 ? 'grain' : 'concrete'; }
	return out;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
