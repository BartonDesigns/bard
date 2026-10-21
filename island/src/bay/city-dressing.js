// What stands round the city's buildings, moved out of bay/city.js's createCity: their grounds
// (plinths, planters, trees), the details on them, and pulling apart boxes that overlap.
// What it uses from city.js's createCity comes from cc: what is set up before it can run, once at
// the top of each call; the rest as cc.name at each use. A name not yet there needs a getter in
// createCity's cc.

import { ROOF } from './roofs.js';

export function cityGrounds(cc, list, trees, x, z, w, d, a, g, y0, kind, seed) {
	const { hash, jit, KIND, PAL, pick } = cc;
	const big = kind === KIND.tower, pad = big ? 5 : kind === KIND.office ? 3.2 : 2;
	const ca = Math.cos(a), sa = Math.sin(a);
	const P = (lx, lz) => [x + ca * lx - sa * lz, z + sa * lx + ca * lz];
	const h1 = hash(seed, 3.7), h2 = hash(seed + 1.3, 9.1);
	// the apron, a hand's breadth above the ground, and its kerb
	list.push({ x, y: y0, z, w: w + 2 * pad, d: d + 2 * pad, h: g + 0.13 + h1 * 0.05 - y0, a, col: jit([0.66, 0.64, 0.6], h1), kind: KIND.plain, roof: null });
	list.push({ x, y: y0, z, w: w + 2 * pad + 0.5, d: d + 2 * pad + 0.5, h: g + 0.1 - y0, a, col: [0.5, 0.49, 0.47], kind: KIND.plain, roof: null });
	if (kind === KIND.industry) return;
	// planters either side of the entrance (the +d face): most planted with yellow lantana and
	// flax lily (bay/lantana.js), the rest with shrubs
	for (const s of [-1, 1]) {
		const cx = s * Math.min(w / 2 - 1.5, 4 + w * 0.15), cz = d / 2 + pad * 0.55, pw = big ? 4.2 : 2.8;
		const [px, pz] = P(cx, cz);
		list.push({ x: px, y: g - 0.2, z: pz, w: pw, d: 1.3, h: 0.75, a, col: jit([0.55, 0.52, 0.48], h2), kind: KIND.plain, roof: null });
		// (its beds are laid out from the planter itself once the buildings are settled: city.js
		// plantedBeds, so a planter moved or taken out takes its planting with it)
		if (hash(px * 0.9 + 1.7, pz * 1.3 - 4.1) < 0.75) list[list.length - 1].planted = { kerb: g + 0.13 + h1 * 0.05 };
		else for (const o of [-0.8, 0, 0.8]) { const [sx, sz] = P(cx + o * (big ? 1.4 : 0.9), cz); trees.push({ x: sx, y: g + 0.5, z: sz, h: 0.9 + hash(sx, sz) * 0.5, shrub: true, col: jit(pick(PAL.crown, hash(sz, sx)), h1) }); }
	}
	// trees along the sides, at the apron's edge
	const every = big ? 9 : 12, sides = big ? [[w, d, 1], [w, d, -1], [d, w, 2], [d, w, -2]] : kind === KIND.office ? [[w, d, 1], [w, d, -1]] : [[w, d, 1]];
	for (const [len, dep, sd] of sides) for (let t = -len / 2 + 3; t <= len / 2 - 3; t += every) {
		if (Math.abs(sd) === 1 && sd > 0 && Math.abs(t) < Math.min(w / 2 - 1.5, 4 + w * 0.15) + 3) continue;     // the entrance kept clear
		// (out where its crown clears the wall; one that lands on the street is taken out later)
		const off = dep / 2 + Math.max(pad + 0.6, 4), [tx, tz] = Math.abs(sd) === 1 ? P(t, Math.sign(sd) * off) : P(Math.sign(sd) * off, t);
		const r = hash(tx * 0.7, tz * 1.3);
		trees.push({ x: tx, y: g - 0.3, z: tz, h: 7 + r * 4, cone: false, col: jit(pick(PAL.crown, r), r) });
	}
}

export function cityDecorate(cc, list, cx, cz, R) {
	const { bay, BRICK, CANVAS, COND, FLAT, hash, HOUSE, KIND, kitPut, pick, ROOF_R, roofAt, ROOFED
		} = cc;
	const put = [[], [], []], n0 = list.length;
	put.props = list.props || (list.props = {});
	for (let i = 0; i < n0; i++) {
		const o = list[i];
		if (Math.abs(o.x - cx) > R || Math.abs(o.z - cz) > R || (o.h < 3 && o.kind !== KIND.pool)) continue;
		const ca = Math.cos(o.a), sa = Math.sin(o.a), W = (lx, lz) => [o.x + ca * lx - sa * lz, o.z + sa * lx + ca * lz];
		const r = hash(o.x * 0.73 + 3.1, o.z * 0.61 - 1.7), area = o.w * o.d, top = o.y + o.h;
		if (!o.roof && FLAT.has(o.kind) && area > 110 && o.src?.kind !== 12 && Math.min(o.w, o.d) > 7 && o.h < 70 && !o.src?.grp) {
			// a parapet round the flat roof, capped with its coping
			const ph = 0.7 + r * 0.5, pc = o.col.map((v) => v * 0.97);
			for (const [lx, lz, w2, d2] of [[0, o.d / 2 - 0.13, o.w, 0.26], [0, -o.d / 2 + 0.13, o.w, 0.26], [o.w / 2 - 0.13, 0, 0.26, o.d - 0.5], [-o.w / 2 + 0.13, 0, 0.26, o.d - 0.5]]) { const [x, z] = W(lx, lz); list.push({ x, y: top - 0.05, z, w: w2, d: d2, h: ph + 0.05, a: o.a, col: pc, kind: KIND.parapet, roof: null, age: o.age }); }
		}
		// (rooftop units on the shops, offices, warehouses and flats, not on the row houses: San
		// Francisco's homes rarely have one, and they were most of a phone's units)
		if (!o.roof && FLAT.has(o.kind) && area > 110 && o.src?.kind !== 12 && Math.min(o.w, o.d) > 7 && o.kind >= 0.5) {
			const n = Math.max(1, Math.min(area > 4000 ? 18 : o.kind === KIND.retail || o.kind === KIND.shop ? 10 : 6, Math.round(area / (o.kind === KIND.industry ? 700 : 280) * (0.6 + r * 0.8))));
			const along = o.w > o.d, L = along ? o.w : o.d, S = along ? o.d : o.w, big = area > 1500 ? 1.6 : area > 600 ? 1.25 : 1;
			for (let k = 0; k < n; k++) {
				const u = ((k + 0.5) / n - 0.5) * (L - 5) + (hash(o.x * 0.9 + k * 7, o.z * 1.1) - 0.5) * 2, v = (hash(o.z * 0.8 + k * 5, o.x * 1.2) - 0.5) * (S - 5);
				const [x, z] = along ? W(u, v) : W(v, u);
				put[0].push([x, top, z, o.a + (along ? 0 : Math.PI / 2) + (hash(o.x * 2 + k * 13, o.z * 2) < 0.2 ? Math.PI / 2 : 0), big * (0.9 + hash(o.x + k * 11, o.z - k * 3) * 0.3)]);
			}
			// the ducts: a run from the units along the roof and down into it
			if (area > 800) {
				const [x, z] = along ? W(0, S * 0.18) : W(S * 0.18, 0);
				list.push({ x, y: top - 0.05, z, w: along ? L * 0.6 : 0.7, d: along ? 0.7 : L * 0.6, h: 0.75, a: o.a, col: [0.72, 0.73, 0.74], kind: KIND.plain, roof: null });
			}
		}
		// on the pitched roofs close by: a chimney (brick on the old houses, stucco on the
		// tile ones) or a metal flue, the plumbing vents and box vents, now and then a
		// skylight, a solar array on the sunny side, a dish; dormers on some old ones; the
		// downspouts down the corners
		const dd = (o.x - cx) * (o.x - cx) + (o.z - cz) * (o.z - cz);
		if (o.roof && ROOFED.has(Math.floor(o.kind)) && area > 30 && dd < ROOF_R * ROOF_R && o.roof.h > 0.4) {
			const R = o.roof, ov = R.ov ?? 0.4, rot = !!R.rot, t = R.t ?? 0;
			const LA = (rot ? o.d : o.w) / 2, LC = (rot ? o.w : o.d) / 2;
			const P2 = (ua, uc) => (rot ? W(uc, ua) : W(ua, uc)), Lp = (ua, uc) => (rot ? [uc, ua] : [ua, uc]);
			const slope = Math.atan2(R.h, LC + ov), yawR = rot ? o.a - Math.PI / 2 : o.a;
			const hr = (n) => hash(o.x * 1.37 + n * 7.1, o.z * 0.91 - n * 3.3);
			const burnt = o.cond === COND.burnt;
			if (hr(1) < (t === ROOF.shingle || t === ROOF.shake ? 0.5 : 0.28) && LA > 3) {
				const ua = (hr(2) < 0.5 ? -1 : 1) * (LA - 1.1), uc = (hr(3) - 0.5) * 1.2, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc);
				const base = roofAt(o, lx, lz) - 0.4, H = o.y + o.h + R.h + 0.8 - base;
				const brick = t === ROOF.shingle || t === ROOF.shake || hr(4) < 0.3;
				kitPut(put, 'chimney', [x, base, z, o.a, 0.75, H, 1.15, 0, ...(brick ? pick(BRICK, hr(5)) : o.col)]);
			} else if (hr(1) < 0.75 && !burnt) {
				const ua = (hr(2) - 0.5) * LA, uc = -(0.3 + hr(3) * 0.4) * LC, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc);
				kitPut(put, 'flue', [x, roofAt(o, lx, lz) - 0.1, z, 0, 1, 0.9 + hr(4) * 0.5, 1, 0]);
			}
			if (dd < 260 * 260 && !burnt) {
				for (let n = 0, m = 1 + Math.floor(hr(6) * 3); n < m; n++) { const ua = (hr(7 + n) - 0.5) * LA * 1.4, uc = -(0.2 + hr(9 + n) * 0.5) * LC, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'pipe', [x, roofAt(o, lx, lz) - 0.05, z, 0, 1, 1, 1, 0]); }
				for (let n = 0, m = Math.floor(hr(12) * 3); n < m; n++) { const ua = (n - (m - 1) / 2) * 1.6, uc = -(0.12 + hr(13) * 0.15) * LC, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'boxvent', [x, roofAt(o, lx, lz) - 0.05, z, yawR, 1, 1, 1, -slope]); }
			}
			if (!burnt && hr(14) < 0.12 && LC > 3) { const ua = (hr(15) - 0.5) * LA, uc = -LC * 0.45, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'skylight', [x, roofAt(o, lx, lz), z, yawR, 1, 1, 1, -slope]); }
			// solar on the slope that faces most nearly south (world +z)
			const sd = rot ? Math.sin(o.a) : Math.cos(o.a), s = sd >= 0 ? 1 : -1;
			if (!burnt && !o.cond && hr(16) < (t === ROOF.barrel || t === ROOF.flatTile ? 0.3 : 0.18) && LA > 4 && LC > 3 && Math.abs(sd) > 0.3) {
				const run = (LC + ov) / Math.cos(slope), rows = Math.max(1, Math.min(3, Math.floor((run - 1.2) / 1.72))), cols = Math.max(2, Math.floor((LA * 2 - (R.hip ? LC : 0) * 1.2 - 1.5) / 1.03));
				const uc = s * (LC + ov) * 0.5, ua = (hr(17) - 0.5) * 0.8, [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc);
				kitPut(put, 'solar', [x, roofAt(o, lx, lz) + 0.1, z, yawR, cols * 1.03, 0.05, rows * 1.72, s * slope]);
			}
			if (!burnt && hr(18) < 0.07) { const ua = (hr(19) < 0.5 ? -1 : 1) * (LA - 0.8), uc = -(LC * 0.6), [lx, lz] = Lp(ua, uc), [x, z] = P2(ua, uc); kitPut(put, 'dish', [x, roofAt(o, lx, lz) - 0.05, z, o.a + hr(20) * 2, 1, 1, 1, 0]); }
			// dormers across the front of a steep old roof
			if (!rot && !R.hip && Math.floor(o.kind) === KIND.house && R.h / (LC + ov) > 0.62 && hr(21) < 0.3 && LA > 3.5) {
				for (let n = 0, m = LA > 6 ? 2 : 1; n < m; n++) {
					const ua = m === 1 ? 0 : (n ? 1 : -1) * LA * 0.45, uc = LC * 0.25, [x, z] = W(ua, uc), y = roofAt(o, ua, uc + 1) - 0.15;
					kitPut(put, 'dormer', [x, y, z, o.a, 1, 1, 1, 0, ...o.col]);
					kitPut(put, 'dormerRoof', [x, y, z, o.a, 1, 1, 1, 0, ...R.col]);
				}
			}
			// the downspouts, at the corners under the eaves
			if (dd < 220 * 220 && Math.floor(o.kind) !== KIND.office) {
				const sp = R.trim === 3 ? o.col : [0.92, 0.91, 0.88];
				const eaves = rot ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
				for (const [ex, ez] of eaves) { const lx = ex ? ex * (o.w / 2 + 0.06) : (hr(22) < 0.5 ? -1 : 1) * (o.w / 2 - 0.15), lz = ez ? ez * (o.d / 2 + 0.06) : (hr(23) < 0.5 ? -1 : 1) * (o.d / 2 - 0.15), [x, z] = W(lx, lz); kitPut(put, 'spout', [x, o.y + 1.0, z, o.a, 1, o.h - 1.05, 1, 0, ...sp]); }
			}
		}
		// round a big pool (a complex's, a club's): loungers down its sides, umbrellas between
		if (o.kind === KIND.pool && area > 60 && !o.dec) {
			const along = o.w > o.d, L = along ? o.w : o.d, S = along ? o.d : o.w;
			for (const sd2 of [-1, 1]) for (let n = 0; n < Math.floor(L / 1.7); n++) {
				const u = -L / 2 + 0.85 + n * 1.7, v = sd2 * (S / 2 + 1.7), [x, z] = along ? W(u, v) : W(v, u), g = bay.heightAt(x, z);
				if (n % 3 === 2) kitPut(put, 'umbrella', [x, g, z, o.a, 1, 1, 1, 0, ...pick(CANVAS, hash(x, z))]);
				else kitPut(put, 'lounger', [x, g, z, o.a + (along ? 0 : Math.PI / 2) + (sd2 > 0 ? Math.PI : 0), 1, 1, 1, 0]);
			}
		}
		if (o.roof && HOUSE.has(o.kind) && area > 55 && o.w > 6.5) {
			const [bx, bz] = W(0, -o.d / 2 - 7), g = bay.heightAt(bx, bz), g0 = bay.heightAt(o.x, o.z);
			if (r < 0.085 && Math.abs(g - g0) < 1.5) {
				const w = Math.min(4.8, o.w * 0.45), d = 3.2, [x, z] = W((hash(o.x * 1.3, o.z * 0.9) < 0.5 ? -1 : 1) * (o.w / 2 - w / 2 - 0.6), -o.d / 2 - d / 2 + 0.05);
				put[1].push([x, g0 + 0.25, z, o.a, w, 2.6, d]);
			} else if (r > 0.3 && r < 0.43 && Math.abs(g - g0) < 1.2 && g > 0.8) put[2].push([bx, g, bz, o.a + (hash(o.z * 1.1, o.x * 0.7) - 0.5) * 0.5, 1]);
		}
	}
	list.kit = put;
}

export function cityApart(cc, list, cx = 0, cz = 0, R = 1e9) {
	// (numbers in flat arrays, no objects made per pair: this runs over thousands of boxes
	// each time the city round you is rebuilt, and a phone feels every allocation)
	const boxes = [];
	for (const o of list) { if (o.fit) o.fit = null; if (o.ovFit !== undefined) o.ovFit = undefined; if (o.w > 0.5 && o.d > 0.5 && o.h > 1.5 && Math.abs(o.x - cx) < R && Math.abs(o.z - cz) < R) boxes.push(o); }
	const N = boxes.length;
	const X = new Float64Array(N), Z = new Float64Array(N), Wd = new Float64Array(N), Dp = new Float64Array(N), C = new Float64Array(N), S = new Float64Array(N);
	// a grid of small cells; a box goes in every cell its outline can reach, so a tower
	// and the shop beside it meet however far apart their middles are
	const G = new Map(), cell = 24, key = (i, j) => i * 73856093 ^ j * 19349663, seen = new Int32Array(N).fill(-1);
	const span = (k, pad, f) => {
		const r = (Wd[k] + Dp[k]) / 2 + pad, i0 = Math.floor((X[k] - r) / cell), i1 = Math.floor((X[k] + r) / cell), j0 = Math.floor((Z[k] - r) / cell), j1 = Math.floor((Z[k] + r) / cell);
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(key(i, j));
	};
	for (let k = 0; k < N; k++) {
		const o = boxes[k]; o.fit = null; o.ovFit = undefined;
		X[k] = o.x; Z[k] = o.z; Wd[k] = o.w; Dp[k] = o.d; C[k] = Math.cos(o.a); S[k] = Math.sin(o.a);
		span(k, 0, (g) => { let l = G.get(g); if (!l) G.set(g, l = []); l.push(k); });
	}
	// each other box near box a, once
	let mark = 0;
	const near = (a, pad, f) => { const m = ++mark; span(a, pad, (g) => { const l = G.get(g); if (l) for (const b of l) if (b !== a && seen[b] !== m) { seen[b] = m; f(b); } }); };
	// half the width of box k seen along the direction (ax, az)
	const half = (k, ax, az) => (Math.abs(ax * C[k] + az * S[k]) * Wd[k] + Math.abs(-ax * S[k] + az * C[k]) * Dp[k]) / 2;
	const setFit = (k, x, z, w, d) => { X[k] = x; Z[k] = z; Wd[k] = w; Dp[k] = d; boxes[k].fit = [x, z, w, d]; };
	const AX = [0, 0, 0, 0], AZ = [0, 0, 0, 0];
	for (let a = 0; a < N; a++) {
		const A = boxes[a];
		near(a, 0, (b) => {
			{
				const B = boxes[b];
				if (A.w * A.d > B.w * B.d || (A.w * A.d === B.w * B.d && A.x < B.x)) return;     // A is the smaller of the pair
				if (A.y >= B.y + B.h || B.y >= A.y + A.h) return;
				if (A.src?.grp && A.src.grp === B.src?.grp) { flush(a, b); return; }
				const dx = X[b] - X[a], dz = Z[b] - Z[a], reach = (Wd[a] + Dp[a] + Wd[b] + Dp[b]) / 2;
				if (dx * dx + dz * dz > reach * reach) return;
				// overlap along each of A's two axes, and along B's (no overlap on any: apart)
				AX[0] = C[a]; AZ[0] = S[a]; AX[1] = -S[a]; AZ[1] = C[a]; AX[2] = C[b]; AZ[2] = S[b]; AX[3] = -S[b]; AZ[3] = C[b];
				let bestPen = 1e9, bestW = -1, bestSide = 1, clear = false;
				for (let w = 0; w < 4; w++) {
					const ax = AX[w], az = AZ[w], ha = w === 0 ? Wd[a] / 2 : w === 1 ? Dp[a] / 2 : half(a, ax, az);
					const c = dx * ax + dz * az, pen = ha + half(b, ax, az) - Math.abs(c);
					if (pen <= 0) { clear = true; break; }
					if (w < 2 && pen < bestPen) { bestPen = pen; bestW = w; bestSide = Math.sign(c) || 1; }
				}
				if (clear || bestW < 0) return;
				// trim A's side facing B by the overlap; leave it be if that would take too much
				const size = bestW === 0 ? Wd[a] : Dp[a], cut = bestPen + 0.005;
				if (cut > size * 0.45) return;
				setFit(a, X[a] - AX[bestW] * bestSide * cut / 2, Z[a] - AZ[bestW] * bestSide * cut / 2, bestW === 0 ? Wd[a] - cut : Wd[a], bestW === 1 ? Dp[a] - cut : Dp[a]);
			}
		});
	}
	// two parts of one building (a house and its wing) overlap on purpose, but where a front
	// of the smaller lies within a hand's width of the larger's own front, the two run
	// through each other: that front is set back to make a clear step
	function flush(a, b) {
		const turn = ((boxes[a].a - boxes[b].a) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2);
		if (Math.min(turn, Math.PI / 2 - turn) > 0.02) return;
		for (let w = 0; w < 2; w++) for (let side = -1; side <= 1; side += 2) {
			const ax = w === 0 ? C[a] : -S[a], az = w === 0 ? S[a] : C[a], h = (w === 0 ? Wd[a] : Dp[a]) / 2;
			const faceA = X[a] * ax + Z[a] * az + side * h, faceB = X[b] * ax + Z[b] * az + side * half(b, ax, az);
			const off = (faceB - faceA) * side;
			if (Math.abs(off) > 0.25) continue;
			// (and the two fronts must share some width, or they only stand in line)
			const px = w === 0 ? -S[a] : C[a], pz = w === 0 ? C[a] : S[a], hp = (w === 0 ? Dp[a] : Wd[a]) / 2;
			if (Math.abs((X[b] - X[a]) * px + (Z[b] - Z[a]) * pz) > hp + half(b, px, pz) - 0.05) continue;
			const cut = 0.3 - off;
			if (cut > h) continue;
			setFit(a, X[a] - ax * side * cut / 2, Z[a] - az * side * cut / 2, w === 0 ? Wd[a] - cut : Wd[a], w === 1 ? Dp[a] - cut : Dp[a]);
		}
	}
	// A roof's eaves reach out past its walls; beside a taller wall (a house's two-storey
	// wing, the shop next door) they ran into it and flickered along it. The overhang is
	// kept short of the nearest taller wall.
	for (let a = 0; a < N; a++) {
		const A = boxes[a];
		if (!A.roof) continue;
		const eave = A.y + A.h, ov = A.roof.ov ?? 0.4;
		let room = ov;
		near(a, ov + 0.1, (b) => {
			{
				const B = boxes[b];
				if (B.y + B.h < eave + 0.05 || B.y > eave + (A.roof.h || 1)) return;
				const dx = X[b] - X[a], dz = Z[b] - Z[a], reach = (Wd[a] + Dp[a] + Wd[b] + Dp[b]) / 2 + room + 0.1;
				if (dx * dx + dz * dz > reach * reach) return;
				// the clear distance between the two outlines (the largest gap along any side)
				let gap = -1e9;
				for (let q = 0; q < 2; q++) for (let w = 0; w < 2; w++) {
					const k = q ? b : a;
					const ax = w === 0 ? C[k] : -S[k], az = w === 0 ? S[k] : C[k];
					gap = Math.max(gap, Math.abs(dx * ax + dz * az) - half(a, ax, az) - half(b, ax, az));
				}
				if (gap < room + 0.06) room = Math.max(0, gap - 0.06);
			}
		});
		if (room < ov) A.ovFit = room;
	}
}
