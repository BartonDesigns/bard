// A set of instances in two levels of detail: a plainer one of all of them that dissolves in with
// distance (world/lodfade.js), and the full one, a copy of the same instances written nearest
// first round where you were, that dissolves out across the same band. The full copy draws only
// as many as can be within the band of whatever camera is drawing (the rest would be dissolved
// away whole), and in the sun's shadow pass only as many as its box can reach
// (world/shadowreach.js), so the shadows are the full ones, exactly as before. Used for the
// street lamps (bay/streetlife.js): hundreds round you, each a few hundred triangles, drawn in
// both passes out to the edge of the street furniture.

import { shadowByReach } from './shadowreach.js';

// Copies the n matrices of src into dst, nearest first to (x, z), and their distances (sorted)
// into dist. Returns n.
export function copyNearestFirst(src, n, dst, dist, x, z) {
	const ord = new Array(n), d = new Float32Array(n);
	for (let i = 0; i < n; i++) { ord[i] = i; d[i] = Math.hypot(src[i * 16 + 12] - x, src[i * 16 + 14] - z); }
	ord.sort((a, b) => d[a] - d[b]);
	for (let k = 0; k < n; k++) { const i = ord[k]; for (let j = 0; j < 16; j++) dst[k * 16 + j] = src[i * 16 + j]; dist[k] = d[i]; }
	return n;
}

// how many of the first n sorted distances are at most d
export function upTo(dist, n, d) {
	let lo = 0, hi = n;
	while (lo < hi) { const m = (lo + hi) >> 1; if (dist[m] <= d) lo = m + 1; else hi = m; }
	return lo;
}

// the shadow pass's bands for the copy (m): every 10 m out to 400
export const NEAR_BANDS = Array.from({ length: 39 }, (_, k) => 20 + k * 10);

// The full copy (near) of far's instances. band: [start, end] of the dissolve, measured from the
// camera to each instance's origin; half: how far an instance reaches past its origin. place(x, z)
// copies them again round (x, z) (when far is written, and every so often as you go).
export function nearFirst(near, far, { band, half }) {
	const cap = near.instanceMatrix.count, dist = new Float32Array(cap);
	let cx = 0, cz = 0, R = null, full = -1;
	// (the view: those within the band's end of the camera can show; the copy is nearest first
	// round (cx, cz), so they are all among those within that and the camera's own distance from it)
	near.onBeforeRender = (renderer, scene, cam) => {
		const e = cam.matrixWorld.elements;
		full = near.count;
		near.count = upTo(dist, full, Math.hypot(e[12] - cx, e[14] - cz) + band[1] + 0.5);
	};
	near.onAfterRender = () => { if (full >= 0) { near.count = full; full = -1; } };
	shadowByReach(near, () => R);
	return {
		place(x, z) {
			cx = x; cz = z;
			const n = copyNearestFirst(far.instanceMatrix.array, Math.min(far.count, cap), near.instanceMatrix.array, dist, x, z);
			near.count = n;
			// (an instance's key in the bands is its distance less its reach)
			const ends = NEAR_BANDS.map((b) => upTo(dist, n, b + half));
			ends.push(n);
			R = { cx: x, cz: z, bands: NEAR_BANDS, ends };
			const a = near.instanceMatrix;
			a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * 16); a.needsUpdate = true;
			near.visible = n > 0;
			near.computeBoundingSphere();
		},
		get at() { return [cx, cz]; },
	};
}
