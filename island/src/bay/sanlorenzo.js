// The lower San Lorenzo River, from the surf at the east end of Main Beach up past Highway 1
// into the mouth of its valley. At the mouth it is a summer lagoon behind a sand spit, bending south-west
// across the beach into the surf beside the Boardwalk; under the railroad trestle it runs
// north along East Cliff, swings west round the River Lot along San Lorenzo Boulevard,
// turns north again at Laurel Street and goes up through town between its grassy levees
// (the Riverwalk along their tops), under Soquel, Water Street and the Highway 1 bridges,
// and on up the valley floor by Harvey West, willows and sycamores along it. It ends at
// 36.995 N, where the rivers of the rest of the Bay Area take it on up to Henry Cowell and
// Felton; the channel stops square there, not in a rounded cap.
//
// The survey is far too coarse for a river, so the channel is carved on carve.js's finer
// grid: the bed, the wet gravel edge, the bench the willows grow on, the levees and their
// path, the cut up to the land either side. The water is its own ribbon, flowing (pools and
// riffles up the valley, still in the lagoon), bright with the sky; you can wade it, and
// swim the lagoon and the deeper pools. The bridges are where the roads cross.
//
// Worked out once the survey is in (a slice each frame): the centre line, the water's level
// all the way up, then the carving tile by tile; then the water and the bridges.

import * as THREE from 'three';
import { toWorld, toLatLon, H_OFF, H_SCALE } from './geo.js';
import { beginCarve, TILE, setRiverHooks } from './carve.js';
import { toW, merger, bulbs, rng } from './rides/kit.js';

// the cross-sections: depth of the water at the middle, the bench (flat bank past the
// water's edge) and its height over the water, how steeply the land is cut back beyond it,
// the levees (0..1), the ground's colours (gravel at the water, green on the banks)
const ZONES = {
	surf: { D: 0.6, bench: 3, bh: 0.12, k: 0.05, lev: 0, gk: 0, gb: 0 },
	beach: { D: 1.0, bench: 4, bh: 0.25, k: 0.08, lev: 0, gk: 0, gb: 0 },
	lagoon: { D: 2.4, bench: 4, bh: 0.5, k: 0.2, lev: 0, gk: 0.4, gb: 0.35 },
	town: { D: 2.0, bench: 9, bh: 0.9, k: 0.32, lev: 1, gk: 1, gb: 1 },
	valley: { D: 1.4, bench: 7, bh: 0.8, k: 0.6, lev: 0, gk: 1, gb: 0.85 },
};
const LEVEE_TOP = 6.4;
// the mouth in the Boardwalk's frame (u along the beach, v out to sea): out of the surf,
// across the sand behind the spit, the lagoon, up under the trestle [u, v, half-width, zone]
const MOUTH = [[378, 154, 8, 'surf'], [400, 131, 10, 'surf'], [424, 104, 15, 'beach'], [439, 64, 28, 'lagoon'], [446, 22, 36, 'lagoon'], [449, -35, 34, 'lagoon'], [451, -95, 30, 'lagoon'], [450, -158, 29, 'lagoon'], [444, -232, 28, 'town']];
// up East Cliff, round the bend behind the River Lot, along San Lorenzo Boulevard to Laurel
// Street, then north through town between the levees to Highway 1 [lat, lon, half-width]
const TOWN = [[36.9672, -122.0131, 28], [36.9678, -122.0140, 28], [36.9681, -122.0152, 27], [36.9682, -122.0164, 27], [36.9684, -122.0178, 26], [36.9688, -122.0193, 25], [36.9694, -122.0205, 23], [36.9703, -122.0212, 21],
	[36.9720, -122.0214, 16], [36.9745, -122.0213, 14], [36.9768, -122.0217, 12], [36.9787, -122.0222, 11], [36.9808, -122.0228, 10], [36.9828, -122.0234, 10]];
// the valley's mouth: the survey's own valley floor (the lowest way up it), up by Harvey
// West, then over to where the river above comes in at 36.995 N
const VALLEY = [[36.98453, -122.02377], [36.98474, -122.02531], [36.98559, -122.02648], [36.98648, -122.02760], [36.98738, -122.02872], [36.98853, -122.02923], [36.98979, -122.02932], [36.99079, -122.03026], [36.99200, -122.03059], [36.99323, -122.03080], [36.99385, -122.03209], [36.99440, -122.03291], [36.99500, -122.03340]];
// where bay/water.js's San Lorenzo crosses the box's north edge and ours takes over: its
// level there and the width its water is drawn (so the two meet at the same height, edge to
// edge; ours is drawn (w + 1.2) * 1.12 each side of the line)
const JOIN = { lat: 36.99500, lon: -122.03340, level: 7.649, drawn: 20 };
const JOIN_HW = JOIN.drawn / 2.24 - 1.2;
const JOIN_RAMP = 260;
// the bridges where the roads cross [name, lat, lon, kind, deck width, skew]
const BRIDGES = [
	['Riverside Avenue', 36.9684, -122.0176, 'road', 15, 0.1],
	['Laurel Street', 36.9702, -122.0211, 'road', 17, 0.55],
	['Soquel Avenue', 36.9745, -122.0213, 'road', 18, 0.05],
	['Water Street', 36.9786, -122.0222, 'road', 17, 0.1],
	['Highway 1', 36.9827, -122.0234, 'freeway', 15, -0.25],
];
const STEP = 6;                          // metres between the centre line's samples
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- the centre line ----------
function centreLine() {
	const C = [];
	for (const [u, v, w, z] of MOUTH) { const [x, zz] = toW(u, v); C.push({ x, z: zz, w, ...ZONES[z], zone: z }); }
	for (const [la, lo, w] of TOWN) { const p = toWorld(la, lo); C.push({ x: p.x, z: p.z, w, ...ZONES.town, zone: 'town' }); }
	VALLEY.forEach(([la, lo], i) => { const p = toWorld(la, lo), Z = i < 2 ? ZONES.town : ZONES.valley; C.push({ x: p.x, z: p.z, w: i < 2 ? 10 : 8.5 + Math.min(1, i / 20), ...Z, lev: i < 2 ? 1 - i * 0.5 : 0, zone: i < 2 ? 'town' : 'valley' }); });
	// the benches widen up through town (grassy floodplain inside the levees)
	for (let i = MOUTH.length; i < MOUTH.length + TOWN.length; i++) C[i].bench = 7 + Math.min(10, (i - MOUTH.length) * 1.1);
	// a Catmull-Rom curve through them, then even steps along it
	const keys = ['w', 'D', 'bench', 'bh', 'k', 'lev', 'gk', 'gb'];
	const dense = [];
	for (let i = 0; i + 1 < C.length; i++) {
		const p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(C.length - 1, i + 2)];
		const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 2));
		for (let k = 0; k < n; k++) {
			const t = k / n, t2 = t * t, t3 = t2 * t;
			const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
			dense.push({ x: cr(p0.x, p1.x, p2.x, p3.x), z: cr(p0.z, p1.z, p2.z, p3.z), cp: i + t });
		}
	}
	dense.push({ x: C[C.length - 1].x, z: C[C.length - 1].z, cp: C.length - 1 });
	const resample = (pts) => {
		const out = [pts[0]];
		let acc = 0;
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.z - a.z);
			let need = STEP - acc;
			while (l > 0 && need <= l) { const f = need / l; out.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, cp: a.cp + (b.cp - a.cp) * f }); need += STEP; }
			acc = l - (need - STEP);
		}
		return out;
	};
	let P = resample(dense);
	// meanders up the valley, where the survey only gives its line
	const v0 = MOUTH.length + TOWN.length + 2;
	for (let i = 1; i + 1 < P.length; i++) {
		const q = P[i], a = sm(v0, v0 + 3, q.cp);
		if (a <= 0) continue;
		const tx = P[i + 1].x - P[i - 1].x, tz = P[i + 1].z - P[i - 1].z, l = Math.hypot(tx, tz) || 1, s = i * STEP;
		const off = a * 17 * Math.sin(s / 95 + 1.3 * Math.sin(s / 310)) * (1 - sm(P.length - 1 - 110 / STEP, P.length - 1 - 25 / STEP, i));
		q.mx = q.x + tz / l * off; q.mz = q.z - tx / l * off;
	}
	for (const q of P) if (q.mx !== undefined) { q.x = q.mx; q.z = q.mz; }
	P = resample(P);
	// (the last sample right on the join, so ours stops where theirs does)
	const jn = toWorld(JOIN.lat, JOIN.lon), pl = P[P.length - 1];
	if (Math.hypot(jn.x - pl.x, jn.z - pl.z) < STEP * 0.5) P.pop();
	P.push({ x: jn.x, z: jn.z, cp: C.length - 1 });
	const n = P.length, S = { n, x: new Float64Array(n), z: new Float64Array(n), tx: new Float32Array(n), tz: new Float32Array(n), cp: new Float32Array(n) };
	for (const k of keys) S[k] = new Float32Array(n);
	S.zone = [];
	P.forEach((q, i) => {
		S.x[i] = q.x; S.z[i] = q.z; S.cp[i] = q.cp;
		const i0 = Math.min(C.length - 2, Math.floor(q.cp)), f = q.cp - i0;
		for (const k of keys) S[k][i] = C[i0][k] + (C[i0 + 1][k] - C[i0][k]) * f;
		S.zone.push(f < 0.5 ? C[i0].zone : C[i0 + 1].zone);
	});
	for (let i = 0; i < n; i++) {
		const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), tx = S.x[b] - S.x[a], tz = S.z[b] - S.z[a], l = Math.hypot(tx, tz) || 1;
		S.tx[i] = tx / l; S.tz[i] = tz / l;
		// (opening out to the river above's width at the join)
		// (breathing a little wider and narrower up the valley)
		if (S.zone[i] === 'valley') S.w[i] *= 1 + 0.14 * Math.sin(i * STEP / 130 + 0.7) * Math.sin(i * STEP / 47);
		S.w[i] += (JOIN_HW - S.w[i]) * sm((n - 1) * STEP - JOIN_RAMP, (n - 1) * STEP, i * STEP);
	}
	// the control points' places along it (for the levels and the bridges)
	S.sOf = (cp) => { let i = 0; while (i < n - 1 && S.cp[i] < cp) i++; return i * STEP; };
	S.mouthN = MOUTH.length; S.townN = TOWN.length;
	return S;
}

export function createRiver(scene, bay, shared, { isPhone = false, sound = null } = {}) {
	const group = new THREE.Group();
	group.name = 'sanlorenzo';
	group.visible = false;
	scene.add(group);
	const R = { S: null, job: null, ready: false, nat: null, tiles: new Map(), decks: [], trees: [], lamps: null, water: null, foamAt: null };
	const uTime = { value: 0 }, uNight = { value: 0 };

	// ---------- the survey as it was, under the river ----------
	function snapshot(S) {
		const L = bay.levels[0];
		let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
		for (let i = 0; i < S.n; i++) { x0 = Math.min(x0, S.x[i]); x1 = Math.max(x1, S.x[i]); z0 = Math.min(z0, S.z[i]); z1 = Math.max(z1, S.z[i]); }
		const M = 700;
		const i0 = Math.max(0, Math.floor((x0 - M - L.x0) / L.step)), i1 = Math.min(L.W - 1, Math.ceil((x1 + M - L.x0) / L.step));
		const j0 = Math.max(0, Math.floor((z0 - M - L.zN) / L.step)), j1 = Math.min(L.H - 1, Math.ceil((z1 + M - L.zN) / L.step));
		const W = i1 - i0 + 1, H = j1 - j0 + 1, h = new Float32Array(W * H);
		for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) h[j * W + i] = L.v[(j0 + j) * L.W + i0 + i] / H_SCALE - H_OFF;
		const N = { L, i0, j0, W, H, h, orig: h.slice() };
		N.at = (x, z) => {
			let fx = (x - L.x0) / L.step - i0, fz = (z - L.zN) / L.step - j0;
			fx = Math.min(Math.max(fx, 0), W - 1.001); fz = Math.min(Math.max(fz, 0), H - 1.001);
			const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * W + i;
			return (N.orig[k] * (1 - u) + N.orig[k + 1] * u) * (1 - v) + (N.orig[k + W] * (1 - u) + N.orig[k + W + 1] * u) * v;
		};
		return N;
	}

	// ---------- the water's level all the way up ----------
	function levels(S, N) {
		const n = S.n, L = new Float32Array(n), lag = 0.9;
		const sSurf = S.sOf(1), sBeach = S.sOf(2), sLag = S.sOf(3), sLaurel = S.sOf(S.mouthN + 7), sWater = S.sOf(S.mouthN + 11), sHwy = S.sOf(S.mouthN + S.townN - 1);
		// the valley floor under the line (the lowest of a few points across it)
		const floor = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			let f = 1e9;
			for (const d of [-24, -12, 0, 12, 24]) f = Math.min(f, N.at(S.x[i] - S.tz[i] * d, S.z[i] + S.tx[i] * d));
			floor[i] = f;
		}
		// up the valley: never above the floor anywhere upstream, never falling going up
		const env = new Float32Array(n);
		let run = 1e9;
		for (let i = n - 1; i >= 0; i--) { run = Math.min(run, floor[i] - 1.3); env[i] = run; }
		for (let i = 0; i < n; i++) {
			const s = i * STEP;
			let l;
			// (out of the lagoon it runs down over the sand to the sea's level, and just under it in the surf)
			if (s < sLag) l = 0.05 + (lag - 0.05) * sm(sBeach, sLag, s) - 0.35 * (1 - sm(sSurf, sBeach, s));
			else if (s < sLaurel) l = lag;
			else if (s < sWater) l = lag + 0.4 * (s - sLaurel) / (sWater - sLaurel);
			else if (s < sHwy) l = lag + 0.4 + 0.5 * (s - sWater) / (sHwy - sWater);
			else l = Math.max(lag + 0.9, env[i]);
			L[i] = l;
		}
		// up the valley from Highway 1: one gentle grade to the river above's level at the join
		// (slow, glassy water, as the lower river is), kept under the valley floor, never
		// higher anywhere below, then eased so no step shows
		const W = L, sEnd = (n - 1) * STEP, i0 = Math.round(sHwy / STEP), l0 = L[i0];
		const cap = (i) => (i === n - 1 ? JOIN.level : Math.min(floor[i] - 0.3, JOIN.level));
		for (let i = i0; i < n; i++) W[i] = Math.min(l0 + (JOIN.level - l0) * (i * STEP - sHwy) / (sEnd - sHwy), cap(i));
		W[n - 1] = JOIN.level;
		for (let pass = 0; pass < 6; pass++) {
			for (let i = n - 2; i >= i0; i--) W[i] = Math.min(W[i], W[i + 1]);
			for (let i = i0 + 1; i + 1 < n; i++) W[i] = Math.min(cap(i), (W[i - 1] + W[i] * 2 + W[i + 1]) / 4);
		}
		for (let i = n - 2; i >= 0; i--) W[i] = Math.min(W[i], W[i + 1]);
		S.floorEnd = floor[n - 1];
		S.L = W;
		// where it falls faster, a little broken water; the depth follows (deeper where still)
		S.foam = new Float32Array(n);
		for (let i = 1; i + 1 < n; i++) S.foam[i] = Math.min(0.3, Math.max(0, Math.abs(W[i + 1] - W[i - 1]) / (2 * STEP) - 0.006) * 15);
		for (let i = 0; i < n; i++) if (S.zone[i] === 'valley') S.D[i] = 0.55 + 1.35 * (1 - Math.min(1, S.foam[i] * 1.5));
		for (let i = 0; i < n && i * STEP < sLag; i++) S.foam[i] = Math.max(S.foam[i], 0.5 * (1 - i * STEP / sLag));
		S.sHwy = sHwy; S.sLaurel = sLaurel; S.sBeach = sBeach; S.sSurf = sSurf;
	}

	// ---------- the cross-section: the ground at a distance from the middle ----------
	// P: the section's numbers here; returns [ground, gravel, green, path]
	const out4 = [0, 0, 0, 0];
	function section(P, ad, nat) {
		const L = P.L, w = P.w, bt = L + P.bh, b = w + P.bench;
		let m;
		if (ad < w) m = L - 0.15 - (P.D - 0.15) * Math.pow(Math.max(0, 1 - (ad / w) ** 2), 0.7);
		else {
			const e = ad - w, bank = e < 3 ? L - 0.15 + (bt - L + 0.15) * sm(0, 3, e) : bt;
			m = ad <= b ? bank : bt + (ad - b) * P.k;
		}
		m = Math.min(m, nat);
		let path = 0;
		if (P.lev > 0.01) {
			const LT = Math.max(LEVEE_TOP, bt + 2.5), c0 = b + (LT - bt) / 0.45, c1 = c0 + 4.5;
			const lv = LT - Math.max(0, c0 - ad) * 0.45 - Math.max(0, ad - c1) * 0.38;
			if (lv > m) m += (lv - m) * P.lev;
			path = P.lev * sm(c0 + 0.1, c0 + 0.6, ad) * (1 - sm(c1 - 0.6, c1 - 0.1, ad));
		}
		// beyond its reach the land is its own again
		const fade = sm(P.reach - 12, P.reach + 3, ad);
		m += (nat - m) * fade;
		const keep = 1 - sm(P.reach - 22, P.reach, ad);
		out4[0] = m;
		out4[1] = P.gk * (1 - sm(w + 2, w + 4.5, ad)) * keep;
		out4[2] = P.gb * sm(w + 1.5, w + 3.5, ad) * keep;
		out4[3] = path;
		return out4;
	}
	// the section's numbers at a sample, on one side
	const PS = { L: 0, w: 0, D: 0, bench: 0, bh: 0, k: 0, lev: 0, gk: 0, gb: 0, reach: 0 };
	function params(S, i, f, side) {
		const j = Math.min(S.n - 1, i + 1);
		for (const k of ['w', 'D', 'bench', 'bh', 'k', 'lev', 'gk', 'gb']) PS[k] = S[k][i] + (S[k][j] - S[k][i]) * f;
		PS.L = S.L[i] + (S.L[j] - S.L[i]) * f;
		// (the banks not the same all the way: steeper here, a wider bench there, each side its
		// own; less so between the levees, and none at the very ends)
		const s = (i + f) * STEP, vk = (1 - PS.lev * 0.8) * sm(0, 200, s) * (1 - sm((S.n - 1) * STEP - 60, (S.n - 1) * STEP, s));
		PS.k *= 1 + 0.55 * vk * Math.sin(s / 83 + side * 1.9) * Math.sin(s / 211 + side);
		PS.bench = Math.max(1.5, PS.bench * (1 + 0.45 * vk * Math.sin(s / 127 + side * 2.6)));
		const r = side > 0 ? S.reachR : S.reachL;
		PS.reach = r ? r[i] + (r[j] - r[i]) * f : 1e9;
		return PS;
	}
	// how far out each side the channel changes the land
	function* reaches(S, N) {
		const n = S.n, rl = new Float32Array(n), rr = new Float32Array(n);
		for (let i = 0; i < n; i++) for (const side of [-1, 1]) {
			const P = params(S, i, 0, side);
			let last = P.w + P.bench;
			for (let d = P.w; d <= 280; d += 5) {
				const nat = N.at(S.x[i] - S.tz[i] * d * side, S.z[i] + S.tx[i] * d * side);
				const m = section(P, d, nat)[0];
				if (Math.abs(m - nat) > 0.04) last = d;
				else if (d > last + 40) break;
			}
			(side > 0 ? rr : rl)[i] = Math.min(290, last + 10);
			if (side > 0 && i % 250 === 0) yield;
		}
		// (smoothed along, so the banks run on rather than jag)
		for (const r of [rl, rr]) {
			const c = r.slice();
			for (let i = 0; i < n; i++) { let m = 0; for (let k = Math.max(0, i - 6); k <= Math.min(n - 1, i + 6); k++) m = Math.max(m, c[k]); r[i] = m; }
		}
		S.reachL = rl; S.reachR = rr;
	}

	// ---------- carving, a slice a frame ----------
	function* carving() {
		const S = centreLine();
		const N = snapshot(S);
		R.S = S; R.nat = N;
		levels(S, N);
		yield;
		yield* reaches(S, N);
		yield;
		const L = N.L, cell = L.step, ts = cell / TILE;
		// every texel near the line: the nearest point on it (by segments of two samples)
		const tiles = R.tiles, T1 = TILE + 1;
		const tileOf = (ci, cj) => {
			const key = cj * L.W + ci;
			let t = tiles.get(key);
			if (!t) { t = { ci, cj, d2: new Float32Array(T1 * T1).fill(Infinity), seg: new Float32Array(T1 * T1), sd: new Float32Array(T1 * T1) }; tiles.set(key, t); }
			return t;
		};
		const ne = S.n - 1, xe = S.x[ne], ze = S.z[ne];
		for (let i = 0; i + 1 < S.n; i += 2) {
			const j = Math.min(i + 2, S.n - 1), ax = S.x[i], az = S.z[i], bx = S.x[j], bz = S.z[j], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
			const rch = Math.max(S.reachL[i], S.reachR[i], S.reachL[j], S.reachR[j]) + 4;
			const ci0 = Math.floor((Math.min(ax, bx) - rch - L.x0) / cell), ci1 = Math.floor((Math.max(ax, bx) + rch - L.x0) / cell);
			const cj0 = Math.floor((Math.min(az, bz) - rch - L.zN) / cell), cj1 = Math.floor((Math.max(az, bz) + rch - L.zN) / cell);
			for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
				const t = tileOf(ci, cj), X0 = L.x0 + ci * cell, Z0 = L.zN + cj * cell;
				const a0 = Math.max(0, Math.floor((Math.min(ax, bx) - rch - X0) / ts)), a1 = Math.min(TILE, Math.ceil((Math.max(ax, bx) + rch - X0) / ts));
				const b0 = Math.max(0, Math.floor((Math.min(az, bz) - rch - Z0) / ts)), b1 = Math.min(TILE, Math.ceil((Math.max(az, bz) + rch - Z0) / ts));
				for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
					const qx = X0 + a * ts, qz = Z0 + b * ts;
					// (nothing past the upstream end: the channel stops square there)
					if ((qx - xe) * S.tx[ne] + (qz - ze) * S.tz[ne] > 0) continue;
					const u = Math.max(0, Math.min(1, ((qx - ax) * dx + (qz - az) * dz) / l2));
					const ex = qx - ax - dx * u, ez = qz - az - dz * u, d2 = ex * ex + ez * ez, k = b * T1 + a;
					if (d2 < t.d2[k]) { t.d2[k] = d2; t.seg[k] = i + (j - i) * u; t.sd[k] = dx * ez - dz * ex > 0 ? 1 : -1; }
				}
			}
			if (i % 40 === 0) yield;
		}
		// the ground in each: the section where the line reaches, the survey's own beyond
		let c = 0;
		for (const t of tiles.values()) {
			t.m = new Float32Array(T1 * T1); t.g = new Float32Array(T1 * T1 * 3); t.lev = new Float32Array(T1 * T1).fill(-1e9); t.k = new Float32Array(T1 * T1);
			const X0 = L.x0 + t.ci * cell, Z0 = L.zN + t.cj * cell;
			for (let b = 0; b < T1; b++) for (let a = 0; a < T1; a++) {
				const k = b * T1 + a, qx = X0 + a * ts, qz = Z0 + b * ts, nat = N.at(qx, qz);
				if (!(t.d2[k] < 1e9)) { t.m[k] = nat; continue; }
				const sgi = Math.min(S.n - 2, Math.floor(t.seg[k])), ad = Math.sqrt(t.d2[k]);
				const P = params(S, sgi, t.seg[k] - sgi, t.sd[k]);
				if (ad > P.reach + 4) { t.m[k] = nat; continue; }
				const r = section(P, ad, nat);
				t.m[k] = r[0]; t.g[k * 3] = r[1]; t.g[k * 3 + 1] = r[2]; t.g[k * 3 + 2] = r[3];
				t.k[k] = 1 - sm(P.reach - 15, P.reach, ad);
				if (ad < P.w + 1.5 && r[0] < P.L - 0.02) t.lev[k] = P.L;
			}
			t.d2 = t.seg = t.sd = null;
			if (++c % 12 === 0) yield;
		}
		// the survey's own heights under it, eased down toward the carving (so from far off,
		// where the fine carving isn't drawn, the valley is still there)
		const V = L.v, D = shared?.bayU?.uB0?.value?.image?.data, changed = new Set();
		const mAt = (x, z) => {
			const ci = Math.floor((x - L.x0) / cell), cj = Math.floor((z - L.zN) / cell), t = tiles.get(cj * L.W + ci);
			if (!t) return null;
			const a = Math.round((x - L.x0 - ci * cell) / ts), b = Math.round((z - L.zN - cj * cell) / ts);
			return t.m[b * T1 + a];
		};
		const nodes = new Set();
		for (const t of tiles.values()) for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) nodes.add((t.cj + dj) * L.W + t.ci + di);
		let nn = 0;
		for (const key of nodes) {
			if (++nn % 150 === 0) yield;
			const i = key % L.W, j = Math.floor(key / L.W), x = L.x0 + i * cell, z = L.zN + j * cell;
			let sum = 0, cnt = 0;
			for (let b = -60; b <= 60; b += 20) for (let a = -60; a <= 60; a += 20) { const m = mAt(x + a, z + b); if (m !== null) { sum += m; cnt++; } }
			if (!cnt) continue;
			const h0 = V[key] / H_SCALE - H_OFF, h = Math.min(h0, sum / cnt);
			if (h < h0 - 0.1) {
				V[key] = Math.round((h + H_OFF) * H_SCALE);
				if (D) D[key] = THREE.DataUtils.toHalfFloat(h);
				changed.add(key);
			}
		}
		yield;
		// the cells round a changed height need their tiles too (to meet the land exactly)
		for (const key of changed) {
			const i = key % L.W, j = Math.floor(key / L.W);
			for (const [ci, cj] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) {
				if (tiles.has(cj * L.W + ci)) continue;
				const t = { ci, cj, m: new Float32Array(T1 * T1), g: new Float32Array(T1 * T1 * 3), lev: new Float32Array(T1 * T1).fill(-1e9), k: new Float32Array(T1 * T1) };
				const X0 = L.x0 + ci * cell, Z0 = L.zN + cj * cell;
				for (let b = 0; b < T1; b++) for (let a = 0; a < T1; a++) t.m[b * T1 + a] = N.at(X0 + a * ts, Z0 + b * ts);
				tiles.set(cj * L.W + ci, t);
			}
		}
		// each texel: how far the carving moves the ground from the survey as it now stands
		let ci0 = 1e9, cj0 = 1e9, ci1 = -1e9, cj1 = -1e9;
		for (const t of tiles.values()) { ci0 = Math.min(ci0, t.ci); cj0 = Math.min(cj0, t.cj); ci1 = Math.max(ci1, t.ci); cj1 = Math.max(cj1, t.cj); }
		const K = beginCarve(L.x0 + ci0 * cell, L.zN + cj0 * cell, cell, ci1 - ci0 + 1, cj1 - cj0 + 1, tiles.size);
		const hv = (i, j) => V[j * L.W + i] / H_SCALE - H_OFF;
		c = 0;
		for (const t of tiles.values()) {
			const h00 = hv(t.ci, t.cj), h10 = hv(t.ci + 1, t.cj), h01 = hv(t.ci, t.cj + 1), h11 = hv(t.ci + 1, t.cj + 1);
			const data = new Float32Array(T1 * T1 * 4);
			for (let b = 0; b < T1; b++) for (let a = 0; a < T1; a++) {
				const u = a / TILE, v = b / TILE, k = b * T1 + a;
				const base = (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
				data[k * 4] = t.m[k] - base; data[k * 4 + 1] = t.g[k * 3]; data[k * 4 + 2] = t.g[k * 3 + 1]; data[k * 4 + 3] = t.g[k * 3 + 2];
			}
			K.add(t.ci - ci0, t.cj - cj0, data);
			t.g = null;
			if (++c % 40 === 0) yield;
		}
		// (only the rows under the river go up to the GPU again)
		const tex = shared?.bayU?.uB0?.value;
		if (tex && changed.size) {
			// (a range a row; three.js counts them in fours, as if RGBA)
			const rows = new Set([...changed].map((key) => Math.floor(key / L.W)));
			for (const j of rows) tex.addUpdateRange(j * L.W * 4, L.W * 4);
			tex.needsUpdate = true;
		}
		K.commit();
		yield;
		plantTrees(S);
		// (the last 30 m not counted as ours: bay/watersrc.js drops any of its river's points
		// within 22 m of our water, and would lose the one it meets us at)
		const past = (x, z) => (x - S.x[ne]) * S.tx[ne] + (z - S.z[ne]) * S.tz[ne] > -30;
		setRiverHooks({ water: (x, z) => levelAt(x, z) !== null && !past(x, z), trees: treesNear });
		yield;
		buildWater(S);
		yield;
		buildBridges(S);
		yield;
		buildRiverwalk(S);
		R.ready = true;
		group.visible = true;
	}

	// ---------- the water's level at a point (null on dry land) ----------
	function levelAt(x, z) {
		if (!R.nat) return null;
		const L = R.nat.L, cell = L.step, ts = cell / TILE, T1 = TILE + 1;
		const ci = Math.floor((x - L.x0) / cell), cj = Math.floor((z - L.zN) / cell), t = R.tiles.get(cj * L.W + ci);
		if (!t?.lev) return null;
		const a = Math.round((x - L.x0 - ci * cell) / ts), b = Math.round((z - L.zN - cj * cell) / ts), v = t.lev[b * T1 + a];
		return v > -1e8 ? v : null;
	}
	// how much the river has the ground here (0 its own, 1 the channel's)
	function influence(x, z) {
		if (!R.nat) return 0;
		const L = R.nat.L, cell = L.step, ts = cell / TILE, T1 = TILE + 1;
		const ci = Math.floor((x - L.x0) / cell), cj = Math.floor((z - L.zN) / cell), t = R.tiles.get(cj * L.W + ci);
		if (!t?.k) return 0;
		const fx = (x - L.x0 - ci * cell) / ts, fz = (z - L.zN - cj * cell) / ts, a = Math.min(TILE - 1, Math.floor(fx)), b = Math.min(TILE - 1, Math.floor(fz)), u = fx - a, v = fz - b, k = b * T1 + a;
		return (t.k[k] * (1 - u) + t.k[k + 1] * u) * (1 - v) + (t.k[k + T1] * (1 - u) + t.k[k + T1 + 1] * u) * v;
	}
	// the nearest sample of the centre line to a point (coarse, then fine)
	function nearest(x, z) {
		const S = R.S;
		if (!S) return { i: 0, d: 1e9 };
		let bi = 0, bd = 1e18;
		for (let i = 0; i < S.n; i += 8) { const d = (S.x[i] - x) ** 2 + (S.z[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
		for (let i = Math.max(0, bi - 8); i <= Math.min(S.n - 1, bi + 8); i++) { const d = (S.x[i] - x) ** 2 + (S.z[i] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
		return { i: bi, d: Math.sqrt(bd) };
	}
	// which bank a point is on: + the east and north (East Cliff, San Lorenzo Boulevard), - the
	// west and south (the Boardwalk, the River Lot, downtown)
	function side(x, z) {
		const S = R.S, { i } = nearest(x, z);
		return S ? Math.sign((x - S.x[i]) * -S.tz[i] + (z - S.z[i]) * S.tx[i]) : 0;
	}
	// the ground as carved at a point across the line from sample i (for placing things)
	function groundAt(S, i, d) {
		const x = S.x[i] - S.tz[i] * d, z = S.z[i] + S.tx[i] * d;
		return { x, z, y: bay.heightAt(x, z) };
	}

	// ---------- the trees along it: willows and sycamores, alders, redwoods up the canyon ----------
	function plantTrees(S) {
		const r = rng(1797), T = [];
		const vStart = S.sHwy + 300;
		for (let i = 0; i < S.n; i += 2) {
			const s = i * STEP, z = S.zone[i];
			if (z === 'surf' || z === 'beach') continue;
			for (const side of [-1, 1]) {
				const w = S.w[i], bench = S.bench[i], reach = side > 0 ? S.reachR[i] : S.reachL[i];
				const want = z === 'lagoon' ? 0.05 : z === 'town' ? 0.3 : 0.55;
				if (r() > want) continue;
				let d;
				if (z === 'town') d = w + 2 + r() * Math.max(1, bench - 3);
				else d = w + 2.5 + r() * Math.max(4, Math.min(reach - w - 6, 40));
				const p = groundAt(S, i, d * side);
				if (levelAt(p.x, p.z) !== null) continue;
				const up = z === 'valley' ? sm(vStart + 1500, vStart + 4000, s) : 0;
				const q = r();
				// (redwoods up the canyon, away from the water's edge; alder and willow by it)
				if (up > 0.2 && d > w + 8 && q < up * 0.75) T.push({ x: p.x, y: p.y - 0.3, z: p.z, h: 30 + r() * 26, cone: true, sp: 2, col: [0.1 + r() * 0.03, 0.17 + r() * 0.04, 0.08] });
				else if (q < 0.45) T.push({ x: p.x, y: p.y - 0.3, z: p.z, h: 9 + r() * 7, sp: 0, col: [0.3 + r() * 0.06, 0.4 + r() * 0.05, 0.16] });           // willow
				else if (q < 0.75) T.push({ x: p.x, y: p.y - 0.3, z: p.z, h: 14 + r() * 10, sp: 0, col: [0.24 + r() * 0.05, 0.34 + r() * 0.05, 0.13] });       // sycamore
				else T.push({ x: p.x, y: p.y - 0.3, z: p.z, h: 11 + r() * 8, sp: 1, col: [0.18, 0.27 + r() * 0.04, 0.1] });                                   // alder
				// the willows' thickets at the water
				if (z !== 'lagoon' && r() < 0.5) { const b2 = groundAt(S, i, (w + 1.8 + r() * 2) * side); if (levelAt(b2.x, b2.z) === null) T.push({ x: b2.x, y: b2.y - 0.2, z: b2.z, h: 1.6 + r() * 1.8, shrub: true, col: [0.26, 0.36, 0.14] }); }
			}
		}
		R.trees = T;
		// a coarse grid over them, for the city's asking
		R.treeGrid = new Map();
		for (const t of T) { const k = Math.floor(t.x / 400) + ',' + Math.floor(t.z / 400); (R.treeGrid.get(k) || R.treeGrid.set(k, []).get(k)).push(t); }
	}
	function treesNear(x, z, rad) {
		const out = [];
		if (!R.treeGrid) return out;
		const n = Math.ceil(rad / 400);
		for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) for (const t of R.treeGrid.get((Math.floor(x / 400) + i) + ',' + (Math.floor(z / 400) + j)) || []) if (Math.hypot(t.x - x, t.z - z) < rad) out.push(t);
		return out;
	}

	// ---------- the water: a ribbon along the line, flowing ----------
	function buildWater(S) {
		const pos = [], sd = [], fl = [], idx = [], across = [-1.12, -0.7, -0.3, 0, 0.3, 0.7, 1.12];
		let rows = 0;
		for (let i = 0; i < S.n; i++) {
			if (S.zone[i] === 'valley' && i % 2 && i !== S.n - 1) continue;
			// (out in the surf it slips under the sea's own surface: no edge to see)
			if (i * STEP < S.sSurf) continue;
			const w = S.w[i] + 1.2, L = S.L[i];
			const speed = S.zone[i] === 'lagoon' ? 0.06 : S.zone[i] === 'town' ? 0.25 : S.zone[i] === 'valley' ? 0.3 + S.foam[i] * 1.6 : 0.5;
			for (const a of across) {
				pos.push(S.x[i] - S.tz[i] * w * a, L, S.z[i] + S.tx[i] * w * a);
				sd.push(i * STEP, a / 1.12);
				fl.push(-S.tx[i], -S.tz[i], speed, S.foam[i]);
			}
			if (rows) { const b = (rows - 1) * across.length, c2 = rows * across.length; for (let k = 0; k + 1 < across.length; k++) idx.push(b + k, b + k + 1, c2 + k, b + k + 1, c2 + k + 1, c2 + k); }
			rows++;
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('aSD', new THREE.Float32BufferAttribute(sd, 2));
		g.setAttribute('aFl', new THREE.Float32BufferAttribute(fl, 4));
		g.setIndex(idx);
		g.computeBoundingSphere();
		const U = { uFade: { value: new THREE.Vector2(S.sSurf, S.sBeach + 45) }, uTime, uNight, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor };
		const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]), vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true });
		Object.assign(mat.uniforms, U);
		const mesh = new THREE.Mesh(g, mat);
		mesh.name = 'river-water';
		mesh.renderOrder = 1;
		group.add(mesh);
		R.water = mesh;
	}

	// ---------- the bridges ----------
	function buildBridges(S) {
		const Mg = merger(), L = bulbs();
		for (const [name, la, lo, kind, width, skew] of BRIDGES) {
			const p = toWorld(la, lo), { i } = nearest(p.x, p.z);
			// across the river: its normal, turned by the skew
			const nx = -S.tz[i], nz = S.tx[i], ca = Math.cos(skew), sa = Math.sin(skew);
			const ax = nx * ca - nz * sa, az = nx * sa + nz * ca;
			const fw = kind === 'freeway';
			const reach = Math.max(S.reachL[i], S.reachR[i]);
			const half = Math.min(reach, (S.w[i] + S.bench[i]) + (LEVEE_TOP - S.L[i]) / 0.45 + 6) / Math.max(0.5, Math.cos(skew));
			const y = fw ? 12.5 : LEVEE_TOP + 0.65, cx = S.x[i], cz = S.z[i];
			const ry = Math.atan2(ax, az) - Math.PI / 2;
			const decks = fw ? [-width / 2 - 2.5, width / 2 + 2.5] : [0];
			const len = half * 2 + (fw ? 160 : 12);
			for (const off of decks) {
				const ox = cx - az * off, oz = cz + ax * off;
				// the deck, its parapets, the girders under it
				const put = (w, h, d, key, along, up, side) => Mg.box(w, h, d, key, ox + ax * along - az * side, up, oz + az * along + ax * side, 0, ry, 0);
				put(len, 0.9, width, 'concrete', 0, y - 0.45, 0);
				put(len, 0.06, width - 3.4, 'asphalt', 0, y + 0.03, 0);
				for (const sd of [-1, 1]) {
					put(len, 1.0, 0.35, 'concrete', 0, y + 0.5, sd * (width / 2 - 0.2));
					put(len, 0.25, 1.5, 'concrete', 0, y + 0.12, sd * (width / 2 - 1.1));
				}
				// piers in the water and on the benches, abutments at the levees
				const piers = fw ? [-half - 60, -half, -half * 0.5, 0, half * 0.5, half, half + 60] : [-half * 0.55, 0, half * 0.55];
				for (const a of piers) {
					const gx = ox + ax * a, gz = oz + az * a, gy = Math.min(bay.heightAt(gx, gz), S.L[i]);
					if (fw) { for (const sd of [-width / 3, width / 3]) Mg.box(1.6, y - gy, 1.6, 'concrete', gx - az * sd, (y + gy) / 2 - 0.6, gz + ax * sd, 0, ry, 0); put(1.6, 1.4, width, 'concrete', a, y - 1.5, 0); }
					else put(1.2, y - gy - 0.9, width * 0.8, 'concrete', a, (y + gy) / 2 - 0.45, 0);
				}
				// the approaches: a ramp each end down to the ground, and the road on beyond
				for (const e of [-1, 1]) {
					const ex = ox + ax * e * len / 2, ez = oz + az * e * len / 2, gy = bay.heightAt(ex + ax * e * 20, ez + az * e * 20);
					const rl = fw ? Math.max(20, (y - gy) / 0.05) : 20, mid = e * (len / 2 + rl / 2), dy = y - Math.max(gy, 0);
					if (dy > 0.3) {
						const ang = Math.atan2(dy, rl);
						Mg.box(rl / Math.cos(ang), 0.8, width, 'concrete', ox + ax * mid, (y + gy) / 2 - 0.4, oz + az * mid, 0, ry, -e * ang);
						R.decks.push({ x: ox + ax * mid, z: oz + az * mid, ax, az, half: rl / 2, hw: width / 2, y0: e > 0 ? y : gy, y1: e > 0 ? gy : y, slope: true });
					}
				}
				R.decks.push({ x: ox, z: oz, ax, az, half: len / 2, hw: width / 2, y0: y, y1: y });
				// lamps on the parapets
				for (let a = -len / 2 + 6; a < len / 2; a += 22) for (const sd of [-1, 1]) {
					put(0.12, 5, 0.12, 'darksteel', a, y + 3, sd * (width / 2 - 0.2));
					L.add(ox + ax * a - az * sd * (width / 2 - 1.2), y + 5.4, oz + az * a + ax * sd * (width / 2 - 1.2));
				}
			}
			R.names = R.names || [];
			R.names.push({ name, x: cx, z: cz });
		}
		Mg.done(group, { shadow: !isPhone });
		R.lamps = L.done(group, 1.2);
	}

	// ---------- the Riverwalk: lamps and benches along the levee tops through town ----------
	function buildRiverwalk(S) {
		const Mg = merger(), L = bulbs(), r = rng(3);
		for (let i = 0; i < S.n; i += 7) {
			if (S.lev[i] < 0.9) continue;
			const b = S.w[i] + S.bench[i], bt = S.L[i] + S.bh[i], LT = Math.max(LEVEE_TOP, bt + 2.5), c1 = b + (LT - bt) / 0.45 + 4.5;
			for (const side of [-1, 1]) {
				const p = groundAt(S, i, (c1 - 0.3) * side);
				if (R.decks.some((D) => Math.abs((p.x - D.x) * D.ax + (p.z - D.z) * D.az) < D.half + 3 && Math.abs(-(p.x - D.x) * D.az + (p.z - D.z) * D.ax) < D.hw + 3)) continue;
				Mg.cyl(0.06, 0.09, 4, 'black', p.x, p.y + 2, p.z, 6);
				L.add(p.x, p.y + 4.1, p.z);
				if (r() < 0.35) { const q = groundAt(S, i + 3, (c1 - 0.5) * side), a = Math.atan2(S.tx[i], S.tz[i]); Mg.box(1.8, 0.08, 0.5, 'plank', q.x, q.y + 0.46, q.z, 0, a, 0).box(1.8, 0.45, 0.06, 'plank', q.x + S.tz[i] * side * 0.25, q.y + 0.72, q.z - S.tx[i] * side * 0.25, 0, a, 0); }
			}
		}
		Mg.done(group, { shadow: false });
		R.walkLamps = L.done(group, 1.0);
	}

	// ---------- walking: the bridges' decks ----------
	function floor(x, z, y) {
		let best = -1e9;
		for (const D of R.decks) {
			const dx = x - D.x, dz = z - D.z, a = dx * D.ax + dz * D.az, s = -dx * D.az + dz * D.ax;
			if (Math.abs(a) > D.half || Math.abs(s) > D.hw) continue;
			const fy = D.y0 + (D.y1 - D.y0) * (a + D.half) / (2 * D.half);
			if (y > fy - 1.4 && fy > best) best = fy;
		}
		return best;
	}
	// (the parapets keep you on a deck)
	function push(p, footY) {
		for (const D of R.decks) {
			const dx = p.x - D.x, dz = p.z - D.z, a = dx * D.ax + dz * D.az, s = -dx * D.az + dz * D.ax;
			if (Math.abs(a) > D.half - 0.5 || Math.abs(s) > D.hw + 0.3 || Math.abs(s) < D.hw - 0.6) continue;
			const fy = D.y0 + (D.y1 - D.y0) * (a + D.half) / (2 * D.half);
			if (Math.abs(footY - fy) > 0.6) continue;
			const ns = Math.sign(s) * (D.hw - 0.6);
			p.x = D.x + D.ax * a - D.az * ns; p.z = D.z + D.az * a + D.ax * ns;
		}
	}

	// ---------- each frame ----------
	const rush = sound?.loop('bandpass', 1400, 0.35);
	let scanT = 0, near = null;
	function update(dt, t, cam, night) {
		if (!R.job && bay.levels?.[0]) R.job = carving();
		if (!R.ready && !R.failed) {
			const t0 = performance.now();
			try {
				while (performance.now() - t0 < (isPhone ? 5 : 8)) { const t1 = performance.now(), done = R.job.next().done; R.slow = Math.max(R.slow || 0, performance.now() - t1); if (done) break; }
			} catch (e) { R.failed = true; console.warn('[river]', e); }
		}
		if (!R.ready) return;
		uTime.value = t; uNight.value = night;
		group.visible = cam.position.y < 6000;
		// the water's sound: riffles close by, the lagoon's lap
		scanT -= dt;
		if (scanT <= 0) { scanT = 0.4; near = nearest(cam.position.x, cam.position.z); }
		if (rush && near) {
			const S = R.S, f = S.foam[near.i] + (S.zone[near.i] === 'valley' ? 0.25 : 0.05), k = Math.max(0, 1 - Math.max(0, near.d - S.w[near.i]) / 70) * Math.max(0, 1 - Math.max(0, cam.position.y - S.L[near.i] - 20) / 60);
			rush.set(k * f * 0.06, 900 + f * 900);
		}
		if (R.lamps) R.lamps.glow.visible = night > 0.02;
	}
	// where the line crosses a straight one (the railroad): distance along it, and the river there
	function crossing(x0, z0, dx, dz) {
		const S = R.S;
		if (!S) return null;
		for (let i = 0; i + 1 < S.n; i++) {
			const ax = S.x[i], az = S.z[i], bx = S.x[i + 1], bz = S.z[i + 1];
			const den = (bx - ax) * dz - (bz - az) * dx;
			if (Math.abs(den) < 1e-9) continue;
			const u = ((x0 - ax) * dz - (z0 - az) * dx) / den, v = ((x0 - ax) * (bz - az) - (z0 - az) * (bx - ax)) / den;
			if (u >= 0 && u <= 1) return { t: v, w: S.w[i], L: S.L[i], i };
		}
		return null;
	}
	// where it ends upstream (for the rivers beyond to meet it)
	function endInfo() {
		const S = R.S, i = S.n - 1, ll = toLatLon(S.x[i], S.z[i]);
		return { lat: +ll.lat.toFixed(5), lon: +ll.lon.toFixed(5), level: +S.L[i].toFixed(2), width: +(S.w[i] * 2).toFixed(1), drawn: +((S.w[i] + 1.2) * 2.24).toFixed(1), floor: +(S.floorEnd ?? 0).toFixed(2), bed: +(S.L[i] - S.D[i]).toFixed(2), heading: +(Math.atan2(S.tx[i], -S.tz[i]) * 180 / Math.PI).toFixed(0) };
	}
	function destroy() {
		rush?.stop();
		setRiverHooks({});
		group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
		scene.remove(group);
	}
	return { group, update, floor, push, levelAt, influence, side, crossing, destroy, ready: () => R.ready, settled: () => R.ready || !!R.failed, info: () => ({ end: R.S?.L ? endInfo() : null, ready: R.ready, slowestStepMs: Math.round(R.slow || 0), tiles: R.tiles.size, samples: R.S?.n || 0, length: Math.round((R.S?.n || 0) * STEP), trees: R.trees.length, bridges: (R.names || []).map((b) => b.name) }) };
}

const WATER_VERT = /* glsl */`
	attribute vec2 aSD; attribute vec4 aFl;
	uniform vec2 uFade;
	varying vec3 vW; varying vec2 vSD; varying vec4 vFl;
	#include <fog_pars_vertex>
	void main(){
		vec4 w = modelMatrix * vec4(position, 1.0);
		// (far off, lifted a little over its banks, so the coarser ground there can't hide it)
		// (but not out on the sand, where it meets the sea)
		w.y += clamp((length(cameraPosition.xz - w.xz) - 150.0) * 0.003, 0.0, 7.0) * smoothstep(uFade.x, uFade.y + 60.0, aSD.x);
		vW = w.xyz; vSD = aSD; vFl = aFl;
		vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
		#include <fog_vertex>
	}`;
const WATER_FRAG = /* glsl */`
	uniform float uTime, uNight; uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor;
	varying vec3 vW; varying vec2 vSD; varying vec4 vFl;
	#include <fog_pars_fragment>
	float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
	float rip(vec2 p){ return vn(p * 0.45) * 0.55 + vn(p * 1.3 + 3.1) * 0.3 + vn(p * 3.7 - 1.7) * 0.15; }
	// the surface carried downstream: two phases of the same ripples, blended (a flow map)
	float flowH(vec2 p, vec2 v){
		float T = 3.0, a = fract(uTime / T), b = fract(uTime / T + 0.5);
		float wa = 1.0 - abs(2.0 * a - 1.0);
		return mix(rip(p - v * b * T + 17.0), rip(p - v * a * T), wa) + 0.25 * vn(p * 0.2 + uTime * 0.05);
	}
	void main(){
		vec2 v = vFl.xy * vFl.z, p = vW.xz;
		float e = 0.25, h = flowH(p, v);
		float sx = flowH(p + vec2(e, 0.0), v) - h, sz = flowH(p + vec2(0.0, e), v) - h;
		float amp = 0.35 + 0.5 * vFl.w + 0.2 * vFl.z;
		vec3 n = normalize(vec3(-sx * amp / e, 1.0, -sz * amp / e));
		vec3 vv = normalize(cameraPosition - vW);
		vec3 r = reflect(-vv, n);
		// (clamped: a dot a hair over one would make pow() of a negative, NaN, and the bloom
		// would spread it over the whole screen)
		float fres = 0.1 + 0.9 * pow(clamp(1.0 - dot(n, vv), 0.0, 1.0), 4.0);
		vec3 sky = mix(uSkyHor, uSkyZen, pow(max(r.y, 0.0), 0.5)) * vec3(0.72, 0.8, 0.86);
		// low down in it, the dark banks, the willows and the town
		sky = mix(vec3(0.035, 0.06, 0.03) * (1.0 - uNight * 0.8), sky, smoothstep(0.06, 0.26, r.y + (vn(p * 0.04) - 0.5) * 0.12));
		float edge = smoothstep(0.6, 1.0, abs(vSD.y));
		vec3 deep = mix(vec3(0.022, 0.058, 0.066), vec3(0.085, 0.09, 0.062), edge) * (1.0 - uNight * 0.85);
		vec3 col = mix(deep, sky, fres * 0.82);
		col += uSunColor * pow(max(dot(r, uSunDir), 0.0), 400.0) * 4.0 * (1.0 - uNight) + uSunColor * pow(max(dot(r, uSunDir), 0.0), 30.0) * 0.08 * (1.0 - uNight);
		// white water over the riffles, a lace of it along the banks
		float fn = vn((p - v * uTime) * 0.9) * 0.6 + vn((p - v * uTime * 1.3) * 2.6) * 0.4;
		float foam = smoothstep(0.75, 0.95, fn + vFl.w * 0.55) * min(1.0, vFl.w * 1.6 + 0.08) + smoothstep(0.86, 1.0, abs(vSD.y)) * smoothstep(0.45, 0.8, fn) * 0.5;
		col = mix(col, vec3(0.85, 0.88, 0.86) * (1.0 - uNight * 0.85), clamp(foam, 0.0, 0.9));
		gl_FragColor = vec4(col, 1.0);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
		#include <fog_fragment>
	}`;
