// Roads graded like real roads. Every mapped road near you gets a profile along it: the
// ground on its centre line, smoothed over about 40 m (cut through the humps, filled over
// the dips) and held to a 25% grade at most. The difference from the ground is spread
// across the road, level from side to side, and eased back into the natural ground over
// a berm about 7 m wide either side: fill banks where the road rides over a dip, cuts
// where it passes through a rise.
// Worked out on a 2 m grid round you (512 m across, redone every 100 m of travel), it
// shapes the terrain the GPU draws (BERM_U, read by bay/terrain.js) and the ground the
// game walks and drives on (apply()), so the two always agree.

import * as THREE from 'three';

const N = 256, CELL = 2, SIZE = N * CELL, STEP = 5, MAXG = 0.25, BERM = 7, MAXCUT = 60;
const SKIP = new Set(['path', 'track', 'footway', 'steps', 'pedestrian', 'cycleway']);
// a freeway's shoulders are graded with its lanes (fwyplan.js: 3 m right, 3 m or more left)
const FWY_SHOULDERS = 3.5;

// The footpaths near you get their own finer grid (half a metre): the tread is cut level
// from side to side into the slope and sunk a little, a short cut bank above it and a
// little fill below, rather than the ground's tilt painted over (which reads as a slab)
const TN = 256, TCELL = 0.5, TSIZE = TN * TCELL, TSINK = 0.07, TBANK = 1.2;
const TRAILS = new Set(['path', 'track', 'footway', 'bridleway', 'steps']);

export const BERM_U = {
	uBerm: { value: null },
	uBermR: { value: new THREE.Vector4(0, 0, SIZE, 0) },      // x0, z0, size, on
	uTread: { value: null },
	uTreadR: { value: new THREE.Vector4(0, 0, TSIZE, 0) },
};
export const BERM_GLSL = /* glsl */`
uniform sampler2D uBerm, uTread; uniform vec4 uBermR, uTreadR;
float treadDelta(vec2 w){
	if (uTreadR.w < 0.5) return 0.0;
	vec2 u = (w - uTreadR.xy) / uTreadR.z;
	if (u.x <= 0.0 || u.y <= 0.0 || u.x >= 1.0 || u.y >= 1.0) return 0.0;
	float edge = smoothstep(0.0, 0.15, min(min(u.x, u.y), min(1.0 - u.x, 1.0 - u.y)));
	// the ground's vertices are a metre or two apart a few metres off (terrain.js NEAR_*): read
	// at one point, the cut's edge falls between them unevenly, a saw-tooth; averaged over the
	// spacing round the vertex, it eases in instead
	float d = max(length(w - uTreadR.xy - uTreadR.z * 0.5), 1.0);
	vec2 o = vec2(60.0 * pow(d / 4000.0, 0.6667) / uTreadR.z, 0.0);
	float h = textureLod(uTread, u, 0.0).r * 0.5 + (textureLod(uTread, u + o, 0.0).r + textureLod(uTread, u - o, 0.0).r + textureLod(uTread, u + o.yx, 0.0).r + textureLod(uTread, u - o.yx, 0.0).r) * 0.125;
	return h * edge;
}
float bermDelta(vec2 w){
	if (uBermR.w < 0.5) return 0.0;
	vec2 u = (w - uBermR.xy) / uBermR.z;
	if (u.x <= 0.0 || u.y <= 0.0 || u.x >= 1.0 || u.y >= 1.0) return treadDelta(w);
	vec2 d = textureLod(uBerm, u, 0.0).rg;
	// (faded out toward the grid's edge, so a new grid never pops)
	float edge = smoothstep(0.0, 0.08, min(min(u.x, u.y), min(1.0 - u.x, 1.0 - u.y)));
	return d.r * edge + treadDelta(w);
}`;

// The buildings keep the ground as surveyed: they were stood on it (city.js, houses.js,
// commercial.js), so neither a road's grading nor a creek's carving reaches under one.
// Into out (a grid of n x n points, the first at x0, z0, cell metres apart), how much each
// point lies under the buildings: 1 within pad metres of the walls, easing to 0 over ease more.
export function underBuildings(boxes, x0, z0, cell, n, out, pad = 1, ease = 4) {
	for (const b of boxes) {
		const ca = Math.cos(b.a), sa = Math.sin(b.a), hw = b.w / 2 + pad, hd = b.d / 2 + pad, r = Math.hypot(hw, hd) + ease;
		const i0 = Math.max(0, Math.floor((b.x - r - x0) / cell)), i1 = Math.min(n - 1, Math.ceil((b.x + r - x0) / cell));
		const j0 = Math.max(0, Math.floor((b.z - r - z0) / cell)), j1 = Math.min(n - 1, Math.ceil((b.z + r - z0) / cell));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			const px = x0 + i * cell - b.x, pz = z0 + j * cell - b.z;
			const d = Math.hypot(Math.max(0, Math.abs(px * ca + pz * sa) - hw), Math.max(0, Math.abs(pz * ca - px * sa) - hd));
			if (d >= ease) continue;
			const t = d / ease, k = j * n + i, v = 1 - t * t * (3 - 2 * t);
			if (v > out[k]) out[k] = v;
		}
	}
}

// (groundAt: the ground as it stands; profileAt, what a road's grade is worked out from: the
// ground that stays put, so the grade is the same whenever it is worked out)
export function createBerms(real, groundAt, profileAt = groundAt, { ready = () => true } = {}) {
	// Roads stream independently of the survey. Never cache its temporary -60 m
	// loading height as a permanent road grade. Keep profiles local to this world,
	// including when a road object survives a terrain reload.
	let profiles = new WeakMap();
	BERM_U.uBermR.value.w = BERM_U.uTreadR.value.w = 0;
	const delta = new Float32Array(N * N), weight = new Float32Array(N * N), under = new Float32Array(N * N);
	const half = new Uint16Array(N * N * 2);
	const tex = new THREE.DataTexture(half, N, N, THREE.RGFormat, THREE.HalfFloatType);
	tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
	BERM_U.uBerm.value = tex;
	let cx = 1e9, cz = 1e9, roadVersion = '', version = 0;
	const tread = new Float32Array(TN * TN), treadW = new Float32Array(TN * TN), thalf = new Uint16Array(TN * TN);
	const ttex = new THREE.DataTexture(thalf, TN, TN, THREE.RedFormat, THREE.HalfFloatType);
	ttex.magFilter = ttex.minFilter = THREE.LinearFilter; ttex.generateMipmaps = false;
	BERM_U.uTread.value = ttex;
	let tx = 1e9, tz = 1e9;

	// The network graded together. Junctions: road ends within JTOL of each other (drive.js options() joins at 2.5 m), and a
	// road end that lands on another road's carriageway (a T). Each gets one pad: a plane
	// fitted to the stable ground over the junction, its grade held to PADG, PADR metres beyond
	// the widest road meeting there. Every road meeting there is pinned to the pad's plane.
	const JTOL = 3, PADG = 0.05, PADX = 2, AV = 15, AMAX = 1.5, KMAX = AMAX / (AV * AV);
	let pads = [];
	const lenOf = (p) => { const acc = [0]; for (let i = 2; i < p.length; i += 2) acc.push(acc[acc.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1])); return acc; };
	function findPads(roads) {
		const ends = [];
		for (const r of roads) { const p = r.pts, n = p.length; ends.push({ r, x: p[0], z: p[1] }, { r, x: p[n - 2], z: p[n - 1] }); }
		const out = [];
		for (const e of ends) {
			let q = out.find((o) => Math.hypot(o.x - e.x, o.z - e.z) < JTOL);
			if (!q) out.push(q = { x: e.x, z: e.z, roads: new Set(), hw: 0, n: 0, sx: 0, sz: 0 });
			q.roads.add(e.r); q.hw = Math.max(q.hw, e.r.w / 2); q.n++; q.sx += e.x; q.sz += e.z;
		}
		// a road end on another road's side (a T without a shared node)
		for (const q of out) for (const r of roads) {
			if (q.roads.has(r)) continue;
			const p = r.pts;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / l2));
				if (Math.hypot(ax + dx * t - q.x, az + dz * t - q.z) < r.w / 2 + 0.5) { q.roads.add(r); q.hw = Math.max(q.hw, r.w / 2); break; }
			}
		}
		const P = out.filter((q) => q.roads.size >= 2);
		for (const q of P) {
			q.x = q.sx / q.n; q.z = q.sz / q.n; q.r = q.hw + PADX;
			// the ground's plane over the pad (least squares on a ring of samples), its grade held to PADG
			let h0 = 0, gx = 0, gz = 0, m = 0;
			for (let k = 0; k < 16; k++) for (const f of [0.35, 0.7, 1]) { const a = k / 16 * Math.PI * 2, ox = Math.cos(a) * q.r * f, oz = Math.sin(a) * q.r * f, h = profileAt(q.x + ox, q.z + oz); h0 += h; gx += h * ox; gz += h * oz; m++; }
			h0 = (h0 + profileAt(q.x, q.z) * 4) / (m + 4);
			let sxx = 0; for (let k = 0; k < 16; k++) for (const f of [0.35, 0.7, 1]) { const a = k / 16 * Math.PI * 2; sxx += (Math.cos(a) * q.r * f) ** 2; }
			gx /= sxx; gz /= sxx;
			const g = Math.hypot(gx, gz); if (g > PADG) { gx *= PADG / g; gz *= PADG / g; }
			q.h = h0; q.gx = gx; q.gz = gz;
		}
		return P;
	}
	const padH = (q, x, z) => q.h + q.gx * (x - q.x) + q.gz * (z - q.z);
	// a road's profile: heights every STEP metres along it; the ground smoothed with its ends
	// extended straight on (odd reflection: a plane comes back as itself), pinned to the pads at
	// either end, eased from the pad's grade into the road's own over a vertical curve, and its
	// curvature held under AMAX at AV (a = v^2 h'')
	function profile(r) {
		if (!ready()) return null;
		if (profiles.has(r)) return profiles.get(r);
		const p = r.pts, acc = lenOf(p);
		const L = acc[acc.length - 1], n = Math.max(2, Math.ceil(L / STEP) + 1), h = new Float32Array(n), xs = new Float32Array(n), zs = new Float32Array(n);
		let seg = 0;
		for (let k = 0; k < n; k++) {
			const s = Math.min(L, k * STEP);
			while (seg < acc.length - 2 && acc[seg + 1] < s) seg++;
			const t = acc[seg + 1] > acc[seg] ? (s - acc[seg]) / (acc[seg + 1] - acc[seg]) : 0;
			xs[k] = p[seg * 2] + (p[seg * 2 + 2] - p[seg * 2]) * t; zs[k] = p[seg * 2 + 1] + (p[seg * 2 + 3] - p[seg * 2 + 1]) * t;
			h[k] = profileAt(xs[k], zs[k]);
		}
		const X = 12, ext = new Float32Array(n + 2 * X);
		for (let pass = 0; pass < 3; pass++) {
			for (let i = 0; i < n; i++) ext[i + X] = h[i];
			for (let i = 1; i <= X; i++) { ext[X - i] = 2 * h[0] - h[Math.min(n - 1, i)]; ext[X + n - 1 + i] = 2 * h[n - 1] - h[Math.max(0, n - 1 - i)]; }
			for (let i = 0; i < n; i++) { let a = 0; for (let j = -4; j <= 4; j++) a += ext[i + X + j]; h[i] = a / 9; }
		}
		// pins: the pads at the ends (and any pad this road runs through: a T on its side)
		const fixed = new Uint8Array(n), want = new Float32Array(n), wt = new Float32Array(n);
		for (const q of pads) {
			if (!q.roads.has(r)) continue;
			// the stretch of this road within the pad, and the ease beyond it
			for (let k = 0; k < n; k++) {
				const d = Math.hypot(xs[k] - q.x, zs[k] - q.z);
				if (d <= q.r) { fixed[k] = 1; want[k] = padH(q, xs[k], zs[k]); wt[k] = 1; continue; }
				// the grade break at the pad's edge needs a vertical curve this long
				const g0 = (h[Math.min(n - 1, k + 1)] - h[Math.max(0, k - 1)]) / (2 * STEP), Lvc = Math.max(10, Math.min(40, Math.abs(g0) / KMAX));
				const u = (d - q.r) / Lvc;
				if (u < 1) { const w = 1 - u * u * (3 - 2 * u); if (w > wt[k]) { wt[k] = w; want[k] = padH(q, xs[k], zs[k]); } }
			}
		}
		for (let k = 0; k < n; k++) if (wt[k] > 0) h[k] = h[k] * (1 - wt[k]) + want[k] * wt[k];
		// vertical curves: hold |h''| under KMAX, pads fixed; then the grade limit
		const lim = KMAX * STEP * STEP;
		for (let it = 0; it < 600; it++) {
			let worst = 0;
			for (let i = 1; i < n - 1; i++) {
				if (fixed[i]) continue;
				const d2 = h[i - 1] - 2 * h[i] + h[i + 1], ex = Math.abs(d2) - lim;
				if (ex <= 0) continue;
				worst = Math.max(worst, ex);
				h[i] += Math.sign(d2) * ex * 0.5;           // (toward its neighbours' mean, just enough)
			}
			if (worst < 1e-3) break;
		}
		for (let i = 1; i < n; i++) if (!fixed[i]) h[i] = Math.max(h[i - 1] - MAXG * STEP, Math.min(h[i - 1] + MAXG * STEP, h[i]));
		for (let i = n - 2; i >= 0; i--) if (!fixed[i]) h[i] = Math.max(h[i + 1] - MAXG * STEP, Math.min(h[i + 1] + MAXG * STEP, h[i]));
		const result = { h, acc };
		profiles.set(r, result);
		return result;
	}
	const hAt = (P, s) => { const f = Math.max(0, Math.min(P.h.length - 1, s / STEP)), i = Math.min(P.h.length - 2, Math.floor(f)), t = f - i; return P.h[i] * (1 - t) + P.h[i + 1] * t; };
	const num = new Float32Array(N * N), den = new Float32Array(N * N), mark = new Int32Array(N * N).fill(-1), bestD = new Float32Array(N * N), bestH = new Float32Array(N * N);

	function rebuild(x, z) {
		cx = x; cz = z;
		const x0 = Math.floor((x - SIZE / 2) / CELL) * CELL, z0 = Math.floor((z - SIZE / 2) / CELL) * CELL;
		delta.fill(0); weight.fill(0); num.fill(0); den.fill(0);
		const roads = real.near('roads', x, z, SIZE * 0.75).filter((r) => r.drive && !SKIP.has(r.cls) && !r.bridge && r.pts.length >= 4);
		pads = findPads(roads); profiles = new WeakMap();
		// every road's grade blended where they overlap (weights to the 4th: the nearer road leads),
		// so two roads meeting never leave a step between them
		let ri = 0;
		for (const r of roads) {
			const P = profile(r), p = r.pts, hw = r.w / 2 + (r.cls === 'motorway' && !r.link ? FWY_SHOULDERS : 0), reach = hw + BERM, touched = [];
			ri++;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz;
				if (l2 < 1e-4) continue;
				const i0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - reach - x0) / CELL)), i1 = Math.min(N - 1, Math.ceil((Math.max(ax, ax + dx) + reach - x0) / CELL));
				const j0 = Math.max(0, Math.floor((Math.min(az, az + dz) - reach - z0) / CELL)), j1 = Math.min(N - 1, Math.ceil((Math.max(az, az + dz) + reach - z0) / CELL));
				const s0 = P.acc[i / 2], sl = Math.sqrt(l2);
				for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
					const qx = x0 + (ii + 0.5) * CELL, qz = z0 + (j + 0.5) * CELL;
					const t = Math.max(0, Math.min(1, ((qx - ax) * dx + (qz - az) * dz) / l2));
					const d = Math.hypot(qx - ax - dx * t, qz - az - dz * t);
					if (d > reach) continue;
					const k = j * N + ii;
					// (each road counts once per cell: its nearest piece)
					if (mark[k] !== ri) { mark[k] = ri; bestD[k] = 1e9; touched.push(k); }
					if (d < bestD[k]) { bestD[k] = d; bestH[k] = hAt(P, s0 + t * sl); }
				}
			}
			for (const k of touched) {
				const d = bestD[k], u = Math.max(0, (d - hw) / BERM), w = 1 - u * u * (3 - 2 * u);
				if (w > weight[k]) weight[k] = w;
				const w4 = (w * w * w * w + 1e-6) / (Math.max(0, d - hw * 0.5) + 0.5);
				num[k] += w4 * bestH[k]; den[k] += w4;
			}
		}
		// the pads: level (to PADG) discs, on top of the roads, eased out over the berm
		for (const q of pads) {
			const reach = q.r + BERM;
			const i0 = Math.max(0, Math.floor((q.x - reach - x0) / CELL)), i1 = Math.min(N - 1, Math.ceil((q.x + reach - x0) / CELL));
			const j0 = Math.max(0, Math.floor((q.z - reach - z0) / CELL)), j1 = Math.min(N - 1, Math.ceil((q.z + reach - z0) / CELL));
			for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
				const qx = x0 + (ii + 0.5) * CELL, qz = z0 + (j + 0.5) * CELL, d = Math.hypot(qx - q.x, qz - q.z);
				if (d > reach) continue;
				const u = Math.max(0, (d - q.r) / BERM), w = 1 - u * u * (3 - 2 * u), k = j * N + ii;
				if (w > weight[k]) weight[k] = w;
				const w4 = 50 * w * w * w * w;
				num[k] += w4 * padH(q, qx, qz); den[k] += w4;
			}
		}
		for (let k = 0; k < N * N; k++) if (den[k] > 0) {
			const ii = k % N, j = (k - ii) / N, d = num[k] / den[k] - groundAt(x0 + (ii + 0.5) * CELL, z0 + (j + 0.5) * CELL);
			// (a ground still loading reads as NaN or the -60 m placeholder: never a cut or a bank
			// of that, and never a value the half-float texture would carry as infinity)
			delta[k] = Number.isFinite(d) ? Math.max(-MAXCUT, Math.min(MAXCUT, d)) : 0;
		}
		under.fill(0);
		underBuildings(real.near('boxes', x, z, SIZE * 0.75), x0 + CELL / 2, z0 + CELL / 2, CELL, N, under);
		for (let k = 0; k < N * N; k++) weight[k] *= 1 - under[k];
		for (let k = 0; k < N * N; k++) { half[k * 2] = THREE.DataUtils.toHalfFloat(delta[k] * weight[k]); half[k * 2 + 1] = THREE.DataUtils.toHalfFloat(weight[k]); }
		tex.needsUpdate = true;
		BERM_U.uBermR.value.set(x0, z0, SIZE, 1);
		version++;
	}

	// the footpaths round you: each tread level across at its centre line's height, sunk a
	// little, eased back into the slope over a short bank either side
	function rebuildTread(x, z) {
		tx = x; tz = z;
		const x0 = Math.floor((x - TSIZE / 2) / TCELL) * TCELL, z0 = Math.floor((z - TSIZE / 2) / TCELL) * TCELL;
		tread.fill(0); treadW.fill(0);
		for (const r of real.near('roads', x, z, TSIZE * 0.75)) {
			if (!TRAILS.has(r.cls) || r.bridge || r.pts.length < 4) continue;
			const p = r.pts, hw = Math.min(2, r.w / 2), reach = hw + TBANK;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz;
				if (l2 < 1e-4) continue;
				const i0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - reach - x0) / TCELL)), i1 = Math.min(TN - 1, Math.ceil((Math.max(ax, ax + dx) + reach - x0) / TCELL));
				const j0 = Math.max(0, Math.floor((Math.min(az, az + dz) - reach - z0) / TCELL)), j1 = Math.min(TN - 1, Math.ceil((Math.max(az, az + dz) + reach - z0) / TCELL));
				if (i0 > i1 || j0 > j1) continue;
				for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
					const qx = x0 + (ii + 0.5) * TCELL, qz = z0 + (j + 0.5) * TCELL;
					const t = Math.max(0, Math.min(1, ((qx - ax) * dx + (qz - az) * dz) / l2));
					const cxp = ax + dx * t, czp = az + dz * t, d = Math.hypot(qx - cxp, qz - czp);
					if (d > reach) continue;
					const u = Math.max(0, (d - hw) / TBANK), w = 1 - u * u * (3 - 2 * u);
					const k = j * TN + ii;
					if (w <= treadW[k]) continue;
					treadW[k] = w;
					tread[k] = (groundAt(cxp, czp) - TSINK - groundAt(qx, qz)) * w;
				}
			}
		}
		for (let k = 0; k < TN * TN; k++) thalf[k] = THREE.DataUtils.toHalfFloat(Number.isFinite(tread[k]) ? tread[k] : 0);
		ttex.needsUpdate = true;
		BERM_U.uTreadR.value.set(x0, z0, TSIZE, 1);
	}
	function treadAt(x, z) {
		const R = BERM_U.uTreadR.value;
		if (R.w < 0.5) return 0;
		const u = (x - R.x) / TCELL - 0.5, v = (z - R.y) / TCELL - 0.5;
		if (u < 0 || v < 0 || u >= TN - 1 || v >= TN - 1) return 0;
		const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * TN + i;
		const d = (tread[k] * (1 - fu) + tread[k + 1] * fu) * (1 - fv) + (tread[k + TN] * (1 - fu) + tread[k + TN + 1] * fu) * fv;
		const eu = (x - R.x) / R.z, ev = (z - R.y) / R.z, e = Math.min(eu, ev, 1 - eu, 1 - ev), edge = Math.max(0, Math.min(1, e / 0.15));
		return d * edge * edge * (3 - 2 * edge);
	}

	// how far the roads' grading moved the ground at (x, z), the footpaths' treads left out: what
	// stands beside a road (the trees, city.js) rides on it, and is stood again when it changes
	function roadDelta(x, z) {
		const R = BERM_U.uBermR.value;
		if (R.w < 0.5) return 0;
		const u = (x - R.x) / CELL - 0.5, v = (z - R.y) / CELL - 0.5;
		if (u < 0 || v < 0 || u >= N - 1 || v >= N - 1) return 0;
		const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
		const at = (a, b) => delta[b * N + a] * weight[b * N + a];
		const d = (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv;
		const eu = (x - R.x) / R.z, ev = (z - R.y) / R.z, e = Math.min(eu, ev, 1 - eu, 1 - ev), edge = Math.max(0, Math.min(1, e / 0.08));
		return d * edge * edge * (3 - 2 * edge);
	}
	// the ground as graded (the same as the GPU draws it)
	function apply(x, z, h) {
		const R = BERM_U.uBermR.value;
		h += treadAt(x, z);
		if (R.w < 0.5) return h;
		const u = (x - R.x) / CELL - 0.5, v = (z - R.y) / CELL - 0.5;
		if (u < 0 || v < 0 || u >= N - 1 || v >= N - 1) return h;
		const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
		const at = (a, b) => delta[b * N + a] * weight[b * N + a];
		const d = (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv;
		const eu = (x - R.x) / R.z, ev = (z - R.y) / R.z, e = Math.min(eu, ev, 1 - eu, 1 - ev), edge = Math.max(0, Math.min(1, e / 0.08));
		return h + d * edge * edge * (3 - 2 * edge);
	}

	function update(camera) {
		if (!ready()) {
			if (BERM_U.uBermR.value.w) version++;
			BERM_U.uBermR.value.w = BERM_U.uTreadR.value.w = 0;
			profiles = new WeakMap();
			cx = cz = tx = tz = 1e9; roadVersion = '';
			return;
		}
		// (the globe's highways come from a source of their own: graded too, before any of the
		// Bay's mapped regions has loaded)
		if (!real?.loaded() && !real?.near?.('roads', camera.position.x, camera.position.z, 300).some((r) => r.drive)) return;
		const x = camera.position.x, z = camera.position.z;
		const rv = real.version() + ':' + (real.sourceVersion?.() || '');
		const changed = rv !== roadVersion; roadVersion = rv;
		const hasRoad = real.inside(x, z) || real.near('roads', x, z, SIZE * 0.75).some((r) => r.drive);
		if (camera.position.y - groundAt(x, z) > 3000 || !hasRoad) { if (BERM_U.uBermR.value.w) version++; BERM_U.uBermR.value.w = 0; BERM_U.uTreadR.value.w = 0; cx = tx = 1e9; return; }
		if (changed || Math.hypot(x - cx, z - cz) > 100) rebuild(x, z);
		// (the trails only matter underfoot: off them when flying high)
		if (camera.position.y - groundAt(x, z) > 120) { BERM_U.uTreadR.value.w = 0; tx = 1e9; }
		else if (changed || Math.hypot(x - tx, z - tz) > 24) rebuildTread(x, z);
	}
	// a road's graded height at its nearest point to (x, z) (null until ready, or not graded)
	function along(r, x, z) {
		if (!r.drive || SKIP.has(r.cls) || r.bridge || r.pts.length < 4) return null;
		const P = profile(r);
		if (!P) return null;
		const p = r.pts;
		let best = 1e18, bs = 0;
		for (let i = 0; i + 3 < p.length; i += 2) {
			const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1;
			const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2;
			if (d < best) { best = d; bs = P.acc[i / 2] + Math.sqrt(l2) * t; }
		}
		return hAt(P, bs);
	}
	const api = { update, apply, roadDelta, version: () => version, profile, along, pads: () => pads };
	live = api;
	return api;
}

// The grading in use (one world at a time): roadDelta(x, z) for what stands on the ground beside
// a road, and gradeVersion() to tell when the grid moved and they should be stood again
let live = null;
export const roadDelta = (x, z) => live ? live.roadDelta(x, z) : 0;
export const gradeVersion = () => live ? live.version() : 0;
