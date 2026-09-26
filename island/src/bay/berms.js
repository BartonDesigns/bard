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

const N = 256, CELL = 2, SIZE = N * CELL, STEP = 5, MAXG = 0.25, BERM = 7;
const SKIP = new Set(['path', 'track', 'footway', 'steps', 'pedestrian', 'cycleway']);

export const BERM_U = {
	uBerm: { value: null },
	uBermR: { value: new THREE.Vector4(0, 0, SIZE, 0) },      // x0, z0, size, on
};
export const BERM_GLSL = /* glsl */`
uniform sampler2D uBerm; uniform vec4 uBermR;
float bermDelta(vec2 w){
	if (uBermR.w < 0.5) return 0.0;
	vec2 u = (w - uBermR.xy) / uBermR.z;
	if (u.x <= 0.0 || u.y <= 0.0 || u.x >= 1.0 || u.y >= 1.0) return 0.0;
	vec2 d = textureLod(uBerm, u, 0.0).rg;
	// (faded out toward the grid's edge, so a new grid never pops)
	float edge = smoothstep(0.0, 0.08, min(min(u.x, u.y), min(1.0 - u.x, 1.0 - u.y)));
	return d.r * edge;
}`;

export function createBerms(real, groundAt) {
	const delta = new Float32Array(N * N), weight = new Float32Array(N * N);
	const half = new Uint16Array(N * N * 2);
	const tex = new THREE.DataTexture(half, N, N, THREE.RGFormat, THREE.HalfFloatType);
	tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
	BERM_U.uBerm.value = tex;
	let cx = 1e9, cz = 1e9;

	// a road's profile: heights every STEP metres along it
	function profile(r) {
		if (r.bermP) return r.bermP;
		const p = r.pts, acc = [0];
		for (let i = 2; i < p.length; i += 2) acc.push(acc[acc.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
		const L = acc[acc.length - 1], n = Math.max(2, Math.ceil(L / STEP) + 1), h = new Float32Array(n);
		let seg = 0;
		for (let k = 0; k < n; k++) {
			const s = Math.min(L, k * STEP);
			while (seg < acc.length - 2 && acc[seg + 1] < s) seg++;
			const t = acc[seg + 1] > acc[seg] ? (s - acc[seg]) / (acc[seg + 1] - acc[seg]) : 0;
			h[k] = groundAt(p[seg * 2] + (p[seg * 2 + 2] - p[seg * 2]) * t, p[seg * 2 + 1] + (p[seg * 2 + 3] - p[seg * 2 + 1]) * t);
		}
		for (let pass = 0; pass < 3; pass++) {
			const c = h.slice();
			for (let i = 0; i < n; i++) { let a = 0, m = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { a += c[j]; m++; } h[i] = a / m; }
		}
		for (let i = 1; i < n; i++) h[i] = Math.max(h[i - 1] - MAXG * STEP, Math.min(h[i - 1] + MAXG * STEP, h[i]));
		for (let i = n - 2; i >= 0; i--) h[i] = Math.max(h[i + 1] - MAXG * STEP, Math.min(h[i + 1] + MAXG * STEP, h[i]));
		r.bermP = { h, acc };
		return r.bermP;
	}
	const hAt = (P, s) => { const f = Math.max(0, Math.min(P.h.length - 1, s / STEP)), i = Math.min(P.h.length - 2, Math.floor(f)), t = f - i; return P.h[i] * (1 - t) + P.h[i + 1] * t; };

	function rebuild(x, z) {
		cx = x; cz = z;
		const x0 = Math.floor((x - SIZE / 2) / CELL) * CELL, z0 = Math.floor((z - SIZE / 2) / CELL) * CELL;
		delta.fill(0); weight.fill(0);
		for (const r of real.near('roads', x, z, SIZE * 0.75)) {
			if (!r.drive || SKIP.has(r.cls) || r.bridge || r.pts.length < 4) continue;
			const P = profile(r), p = r.pts, hw = r.w / 2, reach = hw + BERM;
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
					// level across the road, eased into the ground over the berm
					const u = Math.max(0, (d - hw) / BERM), w = 1 - u * u * (3 - 2 * u);
					const k = j * N + ii;
					if (w <= weight[k]) continue;
					weight[k] = w;
					delta[k] = hAt(P, s0 + t * sl) - groundAt(qx, qz);
				}
			}
		}
		for (let k = 0; k < N * N; k++) { half[k * 2] = THREE.DataUtils.toHalfFloat(delta[k] * weight[k]); half[k * 2 + 1] = THREE.DataUtils.toHalfFloat(weight[k]); }
		tex.needsUpdate = true;
		BERM_U.uBermR.value.set(x0, z0, SIZE, 1);
	}

	// the ground as graded (the same as the GPU draws it)
	function apply(x, z, h) {
		const R = BERM_U.uBermR.value;
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
		if (!real?.loaded()) return;
		const x = camera.position.x, z = camera.position.z;
		if (camera.position.y > 3000 || !real.inside(x, z)) { BERM_U.uBermR.value.w = 0; cx = 1e9; return; }
		if (Math.hypot(x - cx, z - cz) > 100) rebuild(x, z);
	}
	return { update, apply, profile };
}
