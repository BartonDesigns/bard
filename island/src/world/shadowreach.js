// The sun's shadows drawn only from what can reach the box they are drawn in. The sun draws its
// shadows in a box round you (world/sky.js: 110 m across, 400 m along the light), but an
// instanced mesh is drawn into that pass whole: the city's buildings and roofs went in out to
// kilometres off, every one lifted and then clipped away. Here a mesh's instances are laid out
// in bands of distance from where they were laid out, nearest band first, and the shadow pass
// draws only the bands the shadow camera's box can reach from there (its farthest corner across
// the ground); the view itself still draws them all. Nothing that could cast into the box is
// ever left out, so the shadows are exactly as they were.

import * as THREE from 'three';

// the bands' outer edges (m): an instance's key is its distance from the centre less its own
// half-size, so any part of it within d of the centre has its key within d
export const REACH_BANDS = [200, 300, 450, 700, 1000];

// the band a key (or a reach) falls in: band b holds keys above bands[b - 1], up to bands[b]
export function bandOf(key, bands = REACH_BANDS) {
	let b = 0;
	while (b < bands.length && key > bands[b]) b++;
	return b;
}

// Orders list in place band by band (keeping each band's own order), by each item's distance
// from (cx, cz) less half(item). Returns { cx, cz, bands, ends }: ends[b], how many items lie in
// bands 0..b, the items before it in the list.
export function orderByReach(list, cx, cz, half, bands = REACH_BANDS) {
	const nb = bands.length + 1, of = new Uint8Array(list.length), ends = new Array(nb).fill(0);
	for (let i = 0; i < list.length; i++) { const o = list[i]; of[i] = bandOf(Math.hypot(o.x - cx, o.z - cz) - half(o), bands); ends[of[i]]++; }
	for (let b = 1; b < nb; b++) ends[b] += ends[b - 1];
	const at = ends.map((e, b) => (b ? ends[b - 1] : 0)), was = list.slice();
	for (let i = 0; i < was.length; i++) list[at[of[i]]++] = was[i];
	return { cx, cz, bands, ends };
}

// the same bands counted over a sub-list of the ordered one: ends[b] for the items keep() picks
// (the roofs among the buildings, in the order they were written)
export function subEnds(list, R, keep) {
	const out = [];
	let n = 0, b = 0;
	for (let i = 0; i < list.length; i++) {
		while (b < R.ends.length && i >= R.ends[b]) { out.push(n); b++; }
		if (keep(list[i])) n++;
	}
	while (b < R.ends.length) { out.push(n); b++; }
	return { cx: R.cx, cz: R.cz, bands: R.bands, ends: out };
}

// how far across the ground from (cx, cz) the shadow camera's box reaches: its farthest corner
const _inv = new THREE.Matrix4(), _v = new THREE.Vector3();
export function boxReach(cam, cx, cz) {
	_inv.copy(cam.projectionMatrix).invert();
	let r = 0;
	for (let i = 0; i < 8; i++) {
		_v.set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1).applyMatrix4(_inv).applyMatrix4(cam.matrixWorld);
		r = Math.max(r, Math.hypot(_v.x - cx, _v.z - cz));
	}
	return r;
}

// An instanced mesh whose instances are ordered so (reach() gives its latest { cx, cz, bands,
// ends }, null while it has none): in the shadow pass, only the bands the box can reach. (A mesh
// moved, turned or scaled from the world's frame is drawn whole.)
export function shadowByReach(im, reach) {
	let full = -1;
	im.onBeforeShadow = (renderer, object, camera, shadowCamera) => {
		const R = reach();
		if (!R || !im.matrixWorld.equals(IDENTITY)) return;
		const b = bandOf(boxReach(shadowCamera, R.cx, R.cz), R.bands);
		if (b >= R.bands.length) return;
		full = im.count;
		im.count = Math.min(im.count, R.ends[b]);
	};
	im.onAfterShadow = () => { if (full >= 0) { im.count = full; full = -1; } };
	return im;
}
const IDENTITY = new THREE.Matrix4();
