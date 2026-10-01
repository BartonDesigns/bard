// A planned building (plan.js, furnish.js) made real, a slice at a time: the walls with
// their openings cut (doorways cased, windows glazed, the bay opened out), the floors and
// ceilings round the stair holes, the stairs themselves, rails, the front door on its hinge,
// and the furniture, all merged by material. Alongside the meshes, what it is to walk in:
// the solid boxes, the floors by level, the flights, the doors.
//
// In the building's own frame (x across, z toward the front at +d/2, y up from the ground
// floor); the root is placed and turned in the world by the caller.

import * as THREE from 'three';
import { Builder, lin } from '../bay/housekit.js';
import { carGeometry, carMaterial } from '../bay/cars.js';
import { minusHoles } from './plan.js';
import { drawAny, SOFT } from './kit.js';

const FLOOR = { living: 'wood', dining: 'wood', family: 'wood', office: 'wood', den: 'wood', hall: 'wood', bed: 'wood', master: 'wood', corridor: 'wood', well: 'wood', lobby: 'stone', kitchen: 'tile', bath: 'tile', powder: 'tile', laundry: 'tile', garage: 'concrete', storage: 'concrete', warehouse: 'concrete', parking: 'concrete', shed: 'concrete', garage2: 'concrete', store: 'tile', shop: 'wood', classroom: 'tile', school: 'tile', market: 'stone', rotunda: 'stone', mezzanine: 'stone', exhibition: 'stone', towerLobby: 'stone', cellhouse: 'concrete', messhall: 'concrete', casemate: 'stone', courtyard: 'stone', arcade: 'tile', barn: 'concrete', reading: 'wood', library: 'wood', ballroom: 'wood', chamber: 'wood' };
// the walls' colours by the building's style and the room
const PAINT = {
	victorian: [[0.62, 0.68, 0.55], [0.78, 0.6, 0.58], [0.36, 0.5, 0.5], [0.86, 0.74, 0.5], [0.9, 0.86, 0.76], [0.55, 0.36, 0.34], [0.7, 0.72, 0.8]],
	edwardian: [[0.86, 0.84, 0.74], [0.74, 0.78, 0.7], [0.9, 0.82, 0.7], [0.8, 0.76, 0.8], [0.94, 0.92, 0.86], [0.62, 0.7, 0.72]],
	sunset: [[0.95, 0.94, 0.9], [0.92, 0.9, 0.84], [0.88, 0.9, 0.9], [0.95, 0.9, 0.82], [0.9, 0.92, 0.86]],
	mission: [[0.95, 0.75, 0.45], [0.45, 0.72, 0.7], [0.92, 0.6, 0.6], [0.95, 0.9, 0.6], [0.65, 0.8, 0.9], [0.93, 0.92, 0.88]],
	modern: [[0.95, 0.95, 0.93], [0.9, 0.9, 0.88], [0.86, 0.85, 0.82], [0.93, 0.92, 0.9]],
	plain: [[0.88, 0.88, 0.86], [0.82, 0.84, 0.82], [0.9, 0.88, 0.8]],
};
const WOODS = { victorian: [[0.42, 0.26, 0.16], [0.36, 0.22, 0.14], [0.5, 0.32, 0.2]], edwardian: [[0.55, 0.38, 0.24], [0.62, 0.45, 0.3]], sunset: [[0.72, 0.56, 0.38], [0.78, 0.62, 0.44]], mission: [[0.6, 0.42, 0.26], [0.7, 0.52, 0.34]], modern: [[0.66, 0.6, 0.55], [0.82, 0.74, 0.6]], plain: [[0.6, 0.5, 0.4]] };
const DOORC = [[0.38, 0.14, 0.12], [0.14, 0.2, 0.3], [0.3, 0.2, 0.12], [0.16, 0.28, 0.2], [0.9, 0.88, 0.84], [0.1, 0.1, 0.12]];

const carMats = new Map(), carGeos = {};
// (one car of each shape for every garage: kept, never disposed)
const carGeo = (k) => carGeos[k] || (carGeos[k] = carGeometry(k, 24, 12), carGeos[k].userData.shared = true, carGeos[k]);
function carMat(c, night) {
	const k = c.join(',');
	let m = carMats.get(k);
	if (!m) { m = carMaterial(night); m.color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); carMats.set(k, m); }
	return m;
}
const CAR_PAINT = [[0.92, 0.92, 0.9], [0.08, 0.08, 0.09], [0.45, 0.46, 0.48], [0.2, 0.28, 0.45], [0.55, 0.1, 0.1], [0.7, 0.71, 0.72]];

// what the whole building shares: its colours, which rooms are lit
export function prepare(P, { outside = [0.85, 0.82, 0.76], litShare = 0.6 } = {}) {
	const rnd = P.rnd, style = PAINT[P.style] ? P.style : 'plain', pal = PAINT[style];
	return {
		style, wood: lin(WOODS[style][Math.floor(rnd() * WOODS[style].length)]),
		paint: P.rooms.map((r) => lin(r.type === 'garage' || r.type === 'storage' || r.type === 'warehouse' || r.type === 'parking' ? [0.8, 0.79, 0.76] : r.type === 'bath' || r.type === 'kitchen' || r.type === 'powder' ? [0.93, 0.92, 0.88] : pal[Math.floor(rnd() * pal.length)])),
		lit: P.rooms.map((r) => rnd() < (r.type === 'garage' || r.type === 'storage' ? 0.15 : r.stairs || r.type === 'corridor' || r.type === 'lobby' || r.type === 'shop' ? 0.95 : litShare)),
		OUT: lin(outside), doorC: lin(DOORC[Math.floor(rnd() * DOORC.length)]), seed: Math.floor(rnd() * 1e9),
	};
}
// the level a thing stands on (the levels of a landmark are of any height)
const levelOf = (P, y) => P.levels.reduce((b, L) => (Math.abs(L.y - y) < Math.abs(b.y - y) ? L : b), P.levels[0]).k;

// one level of it (a generator: yields between slices): full, or (full false) only its
// outside walls, floor and ceiling, for the floors of a tall block you are not on, seen
// from the street through their windows
export function* buildLevel(P, M, C, k, full, night = { value: 0 }) {
	const L = P.levels[k], rnd = (() => { let a = (C.seed + k * 7919) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
	const g = new Builder(), col = [], { style, wood, paint, lit, OUT } = C;
	const WHITE = lin([0.94, 0.93, 0.9]), TRIM = lin(style === 'victorian' ? [0.93, 0.9, 0.84] : [0.95, 0.95, 0.93]);
	const FT = { wood, tile: lin([0.88, 0.85, 0.8]), stone: lin([0.82, 0.8, 0.76]), concrete: lin([0.66, 0.65, 0.62]), carpet: lin([0.7, 0.66, 0.6]) };
	const roomAt = (x, z) => { for (const id of L.rooms) { const r = P.rooms[id]; if (x > r.x0 - 0.02 && x < r.x1 + 0.02 && z > r.z0 - 0.02 && z < r.z1 + 0.02) return r; } return null; };
	let step = 0, tY = performance.now();
	// (a slice ends when it has had its few milliseconds)
	const slow = () => { if (performance.now() - tY < 4) return false; tY = performance.now(); return true; };

	const wbox = (w, key, u0, u1, y0, y1, c0, c1, colr) => { if (w.axis === 'x') g.box(key, u0, y0, Math.min(c0, c1), u1, y1, Math.max(c0, c1), colr); else g.box(key, Math.min(c0, c1), y0, u0, Math.max(c0, c1), y1, u1, colr); };
	// ---- the walls, cut round their openings
	for (const w of P.walls) {
		if (w.k !== k || (!full && w.kind !== 'ext')) continue;
		if (++step % 16 === 0 || slow()) { yield; tY = performance.now(); }
		const a0 = w.pos - w.t / 2, a1 = w.pos + w.t / 2;
		const cuts = [w.s, w.e];
		for (const o of w.open) cuts.push(Math.max(w.s, Math.min(w.e, o.s0)), Math.max(w.s, Math.min(w.e, o.s1)));
		cuts.sort((p, q) => p - q);
		for (let i = 0; i < cuts.length - 1; i++) {
			const u0 = cuts[i], u1 = cuts[i + 1];
			if (u1 - u0 < 0.004) continue;
			const um = (u0 + u1) / 2, gaps = w.open.filter((o) => o.s0 < um && o.s1 > um).map((o) => [o.y0, o.y1]).sort((p, q) => p[0] - q[0]);
			let y = w.y0;
			for (const [gy0, gy1] of [...gaps, [w.y1, w.y1]]) {
				if (gy0 > y + 0.004) piece(w, u0, u1, y, Math.min(gy0, w.y1), um);
				y = Math.max(y, gy1);
			}
		}
		for (const o of w.open) dress(w, o, a0, a1);
	}
	function piece(w, u0, u1, y0, y1, um) {
		const a0 = w.pos - w.t / 2, a1 = w.pos + w.t / 2;
		// what each face looks onto: a room (its paint), or the street (the building's colour)
		const at = (sgn) => { if (w.kind === 'ext' && sgn === w.out) return null; const p = w.pos + sgn * (w.t / 2 + 0.06); return w.axis === 'x' ? roomAt(um, p) : roomAt(p, um); };
		const rp = at(1), rm = at(-1);
		const across = w.axis === 'x' ? [4, 5] : [0, 1];
		const keyOf = (r, outside) => (outside ? 'stucco' : r ? (lit[r.id] ? 'paintLit' : 'paint') : 'paint');
		const colOf = (r, outside) => (outside ? OUT : r ? paint[r.id] : WHITE);
		const outP = w.kind === 'ext' && w.out > 0, outM = w.kind === 'ext' && w.out < 0;
		const keyF = (f) => (f === across[0] ? keyOf(rp, outP) : f === across[1] ? keyOf(rm, outM) : f === 3 ? null : 'paint');
		const colF = (f) => (f === across[0] ? colOf(rp, outP) : f === across[1] ? colOf(rm, outM) : WHITE);
		if (w.axis === 'x') g.box(keyF, u0, y0, a0, u1, y1, a1, colF); else g.box(keyF, a0, y0, u0, a1, y1, u1, colF);
		col.push(w.axis === 'x' ? [u0, a0, u1, a1, y0, y1] : [a0, u0, a1, u1, y0, y1]);
		// the baseboard, on the room sides
		const fy = L.y;
		if (y0 <= fy + 0.01) for (const [r, face, sgn] of [[rp, a1, 1], [rm, a0, -1]]) {
			if (!r || r.type === 'garage' || r.type === 'warehouse' || r.type === 'parking') continue;
			const f1 = face + sgn * 0.014;
			if (w.axis === 'x') g.box('trim', u0, fy, Math.min(face, f1), u1, fy + 0.12, Math.max(face, f1), TRIM);
			else g.box('trim', Math.min(face, f1), fy, u0, Math.max(face, f1), fy + 0.12, u1, TRIM);
		}
	}
	function dress(w, o, a0, a1) {
		const fy = L.y;
		if (o.type === 'window' || o.type === 'store') {
			// the glass in the middle of the wall, its frame, a sill inside
			const m = (a0 + a1) / 2, fw = o.type === 'store' ? 0.07 : 0.05;
			wbox(w, 'trim', o.s0, o.s1, o.y0, o.y0 + fw, m - 0.04, m + 0.04, TRIM); wbox(w, 'trim', o.s0, o.s1, o.y1 - fw, o.y1, m - 0.04, m + 0.04, TRIM);
			wbox(w, 'trim', o.s0, o.s0 + fw, o.y0, o.y1, m - 0.04, m + 0.04, TRIM); wbox(w, 'trim', o.s1 - fw, o.s1, o.y0, o.y1, m - 0.04, m + 0.04, TRIM);
			if (o.type === 'store') for (let u = o.s0 + 2.6; u < o.s1 - 0.4; u += 2.6) wbox(w, 'trim', u - 0.04, u + 0.04, o.y0, o.y1, m - 0.05, m + 0.05, lin([0.2, 0.2, 0.2]));
			else if (o.y1 - o.y0 > 1.2) wbox(w, 'trim', o.s0, o.s1, (o.y0 + o.y1) / 2 - 0.02, (o.y0 + o.y1) / 2 + 0.02, m - 0.03, m + 0.03, TRIM);
			wbox(w, 'glass', o.s0 + fw, o.s1 - fw, o.y0 + fw, o.y1 - fw, m - 0.003, m + 0.003, WHITE);
			col.push(w.axis === 'x' ? [o.s0, a0, o.s1, a1, o.y0, o.y1] : [a0, o.s0, a1, o.s1, o.y0, o.y1]);
			const inSide = w.kind === 'ext' ? -w.out : 1, inn = inSide > 0 ? a1 : a0;
			if (o.type === 'window') wbox(w, 'trim', o.s0 - 0.05, o.s1 + 0.05, o.y0 - 0.03, o.y0, inn, inn + inSide * 0.05, TRIM);
			return;
		}
		if (o.type === 'bay') return;
		// doorways: cased both sides, a threshold across
		const cw = 0.07;
		for (const [face, s2] of [[a1, 1], [a0, -1]]) {
			if (w.kind === 'ext' && s2 === w.out) continue;
			const f1 = face + s2 * 0.018;
			wbox(w, 'trim', o.s0 - cw, o.s0, fy, o.y1 + cw, face, f1, TRIM); wbox(w, 'trim', o.s1, o.s1 + cw, fy, o.y1 + cw, face, f1, TRIM);
			wbox(w, 'trim', o.s0 - cw, o.s1 + cw, o.y1, o.y1 + cw, face, f1, TRIM);
		}
		wbox(w, 'wood', o.s0, o.s1, fy, fy + 0.012, a0 - 0.06, a1 + 0.06, wood.map((c) => c * 0.8));
	}

	yield;
	// ---- floors and ceilings, round the holes over the stairs
	{
		const above = P.levels[k + 1];
		for (const id of L.rooms) {
			const r = P.rooms[id], fk = FLOOR[r.type] || 'wood', e = 0.06;
			const R = { x0: r.x0 - e, z0: r.z0 - e, x1: r.x1 + e, z1: r.z1 + e };
			for (const [x0, z0, x1, z1] of minusHoles(R, L.holes)) g.quad(fk, [x0, L.y, z0], [x1, L.y, z0], [x1, L.y, z1], [x0, L.y, z1], [0, 1, 0], FT[fk] || wood, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
			const yc = L.y + L.h;
			if (r.sky) continue;
			for (const [x0, z0, x1, z1] of minusHoles(R, above ? above.holes : P.topHoles || [])) g.quad(lit[id] ? 'ceilingLit' : 'ceiling', [x0, yc, z0], [x1, yc, z0], [x1, yc, z1], [x0, yc, z1], [0, -1, 0], lin([0.95, 0.95, 0.93]), [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
		}
		// the edges of the holes, between the ceiling below and this floor
		for (const [x0, z0, x1, z1] of L.holes) {
			const yb = k ? P.levels[k - 1].y + P.levels[k - 1].h : L.y - 0.3, yt = L.y;
			const q = (a, b, n) => g.quad('paint', [a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], yt, b[1]], [a[0], yt, a[1]], n, WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
			q([x0, z0], [x1, z0], [0, 0, 1]); q([x0, z1], [x1, z1], [0, 0, -1]); q([x0, z0], [x0, z1], [1, 0, 0]); q([x1, z0], [x1, z1], [-1, 0, 0]);
		}
	}
	// the bay alcoves: a floor, a ceiling, and the glass all round them is the far block's
	for (const A of P.alcoves) {
		if (A.k !== k) continue;
		g.quad('wood', [A.x0, A.y, A.z0], [A.x1, A.y, A.z0], [A.x1, A.y, A.z1], [A.x0, A.y, A.z1], [0, 1, 0], wood, [[A.x0, A.z0], [A.x1, A.z0], [A.x1, A.z1], [A.x0, A.z1]]);
		g.quad('ceiling', [A.x0, A.y + 2.64, A.z0], [A.x1, A.y + 2.64, A.z0], [A.x1, A.y + 2.64, A.z1], [A.x0, A.y + 2.64, A.z1], [0, -1, 0], lin([0.95, 0.95, 0.93]), [[0, 0], [1, 0], [1, 1], [0, 1]]);
		col.push([A.x0 - 0.1, A.z1, A.x1 + 0.1, A.z1 + 0.1, A.y, A.y + 2.7], [A.x0 - 0.1, A.z0, A.x0, A.z1, A.y, A.y + 2.7], [A.x1, A.z0, A.x1 + 0.1, A.z1, A.y, A.y + 2.7]);
	}

	// what stands solid through the floors (the stone base of the Summit Building's tower)
	for (const q of P.solid || []) if (q.k === k) col.push(q.box);

	yield;
	const root = new THREE.Group(), doors = [];
	if (!full) { for (const m of g.meshes(M, false)) root.add(m); return { root, col, doors, full }; }
	// ---- the stairs: treads over a closed stringer, a rail on the open side
	const railC = lin(style === 'victorian' ? [0.3, 0.18, 0.1] : [0.35, 0.28, 0.2]);
	for (const f of P.flights) {
		if (f.k !== k) continue;
		const n = f.n, R = (f.y1 - f.y0) / n, T = Math.abs(f.zt - f.zb) / (n - 1), base = L.y;
		for (let i = 0; i < n - 1; i++) {
			const za = f.zb + f.dir * i * T, zb2 = f.zb + f.dir * (i + 1) * T, y = f.y0 + (i + 1) * R;
			g.box((q) => (q === 2 ? 'wood' : q === 3 ? null : 'paint'), f.x0, base, Math.min(za, zb2), f.x1, y, Math.max(za, zb2), (q) => (q === 2 ? wood : WHITE));
			g.box('wood', f.x0, y - 0.025, Math.min(za, za - f.dir * 0.03), f.x1, y, Math.max(za, za - f.dir * 0.03), wood);
		}
		const xr = f.open < 0 ? f.x0 - 0.02 : f.x1 + 0.02;
		for (let i = 0; i < n - 1; i += 1) { const zc = f.zb + f.dir * (i + 0.5) * T, y = f.y0 + (i + 1) * R; g.box('trim', xr - 0.016, y, zc - 0.016, xr + 0.016, y + 0.88, zc + 0.016, WHITE); }
		g.beam('grain', [xr, f.y0 + R + 0.9, f.zb], [xr, f.y1 + 0.9, f.zt], 0.06, 0.06, railC);
		g.box('grain', xr - 0.05, f.y0, f.zb - f.dir * 0.05, xr + 0.05, f.y0 + 1.05, f.zb + f.dir * 0.05, railC);
		col.push([xr - 0.05, Math.min(f.zb, f.zt) + (f.dir < 0 ? 0 : 0.6), xr + 0.05, Math.max(f.zb, f.zt) - (f.dir < 0 ? 0.6 : 0), f.y0 + 0.4, f.y1 + 1]);
	}
	for (const Ld of P.landings) if (Ld.k === k) g.box((q) => (q === 2 ? 'wood' : q === 3 ? null : 'paint'), Ld.x0, P.levels[Ld.k].y, Ld.z0, Ld.x1, Ld.y, Ld.z1, (q) => (q === 2 ? wood : WHITE));
	for (const r of P.rails) {
		if (r.k !== k) continue;
		const thick = Math.min(r.x1 - r.x0, r.z1 - r.z0) > 0.2;
		if (thick) g.box((q) => (q === 3 ? null : 'paint'), r.x0, r.y0, r.z0, r.x1, r.y1, r.z1, WHITE);
		else {
			const along = r.x1 - r.x0 > r.z1 - r.z0, L = along ? r.x1 - r.x0 : r.z1 - r.z0;
			for (let u = 0.06; u < L; u += 0.13) { const x = along ? r.x0 + u : (r.x0 + r.x1) / 2, z = along ? (r.z0 + r.z1) / 2 : r.z0 + u; g.box('trim', x - 0.016, r.y0, z - 0.016, x + 0.016, r.y1 - 0.06, z + 0.016, WHITE); }
			g.box('grain', r.x0, r.y1 - 0.06, r.z0, r.x1, r.y1, r.z1, railC);
		}
		col.push([r.x0, r.z0, r.x1, r.z1, r.y0, r.y1]);
	}

	yield;
	// ---- the front door on its hinge, the garage door seen from inside
	const fw = k === 0 ? P.walls.find((w) => w.k === 0 && w.kind === 'ext' && w.axis === 'x' && w.out > 0) : null;
	const fo = fw?.open.find((o) => o.main);
	if (fo) {
		const width = fo.s1 - fo.s0, h = fo.y1 - fo.y0 - 0.02, t = 0.05, zc = fw.pos - fw.t / 2 + 0.03;
		const pivot = new THREE.Group();
		pivot.position.set(fo.s0 + 0.02, fo.y0, zc);
		const b = new Builder(), dc = C.doorC;
		b.box('door6', 0, 0, -t, width - 0.04, h, 0, dc);
		if (P.use === 'shop' || P.use === 'apt' || width > 1.3) b.box('glass', 0.12, 0.9, -t - 0.001, width - 0.16, h - 0.2, 0.001, WHITE);
		for (const sz of [-1, 1]) b.cyl('metal', width - 0.14, 1.0, -t / 2 + sz * t / 2, 0.028, sz * 0.06, lin([0.72, 0.62, 0.4]), 8, 'z');
		for (const m of b.meshes(M)) pivot.add(m);
		root.add(pivot);
		const D = { pivot, open: 0, target: 0, maxA: Math.PI * 0.5, at: [(fo.s0 + fo.s1) / 2, fo.y0 + 1, fw.pos], box: [fo.s0, zc - t - 0.02, fo.s1, zc + 0.02], y0: fo.y0, auto: true };
		D.apply = () => { pivot.rotation.y = D.open * D.maxA; };
		D.apply();
		doors.push(D);
	}
	if (P.garage && fw) { const G = P.garage; g.box('garage', G[0], 0, fw.pos - fw.t / 2 - 0.015, G[1], 2.25, fw.pos - fw.t / 2 - 0.005, lin([0.9, 0.9, 0.88])); }

	yield;
	// ---- the furniture
	const cars = [];
	for (const it of P.items) {
		if (levelOf(P, it.y) !== k) continue;
		if (++step % 14 === 0 || slow()) { yield; tY = performance.now(); }
		if (it.type === 'car') { cars.push(it); continue; }
		drawAny(g, it, rnd);
		if (!SOFT.has(it.type) && it.box) col.push([it.box[0], it.box[1], it.box[2], it.box[3], it.y, it.y + Math.max(it.h, 0.3)]);
	}
	yield;
	for (const m of g.meshes(M)) root.add(m);
	for (const it of cars) {
		const car = new THREE.Mesh(carGeo(it.v < 0.5 ? 'suv' : 'sedan'), carMat(CAR_PAINT[Math.floor(it.v * CAR_PAINT.length)], night));
		car.position.set(it.x, it.y, it.z); car.rotation.y = it.rot * Math.PI / 2; car.castShadow = true;
		root.add(car);
		col.push([it.box[0], it.box[1], it.box[2], it.box[3], it.y, it.y + 1.4]);
	}
	return { root, col, doors, full };
}
