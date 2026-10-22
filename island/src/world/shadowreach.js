// The sun's shadows drawn only from what can reach the box they are drawn in. The sun draws its
// shadows in a box round you (world/sky.js: 110 m across, 400 m along the light), but an
// instanced mesh is drawn into that pass whole: the city's buildings and roofs went in out to
// kilometres off, every one lifted and then clipped away. Here a mesh's instances are laid out
// in bands of distance from where they were laid out, nearest band first, and the shadow pass
// draws only the bands the shadow camera's box can reach from there (its farthest corner across
// the ground); the view itself still draws them all. Nothing that could cast into the box is
// ever left out, so the shadows are exactly as they were.

import * as THREE from 'three';
import { frustumCorners } from './gridwedges.js';

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

// ---------- merged meshes: their triangles in tiles of the ground ----------
// A mesh merged from pieces spread over kilometres and built once (the landmarks by material, the
// San Mateo Bridge's concrete) went into the shadow pass whole, though its share in the box is a
// few hundred metres at most. (Not the freeways' ring: it is built again every 270 m as you move,
// and laying it out each time would be a new stall.) Its triangles are laid out tile by tile instead (tiles
// of the ground about size m across, in the order of a curve that keeps neighbours near each
// other in the list; each tile's own triangles kept in their order), each tile with its own box.
// A view tests the tiles' boxes: the mesh is drawn whole by any view that has one in it, as
// before, but the shadow pass draws only the run of the list from the first tile in its box to
// the last. Nothing that could cast into the box is ever left out.

// the place of tile (x, y) along a Hilbert curve over n x n tiles (n a power of two)
export function hilbert(n, x, y) {
	let d = 0;
	for (let s = n >> 1; s > 0; s >>= 1) {
		const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
		d += s * s * ((3 * rx) ^ ry);
		if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const t = x; x = y; y = t; }
	}
	return d;
}

let _f32 = new Float32Array(0);
// triangles t0..t1: each one's tile, and that tile's bounds grown round it (kept in hand over a
// run of triangles in one tile, as a sweep along a road is, and written when the run ends)
function tilePass(S, t0, t1) {
	const pa = S.pa, ix = S.ix, inv = S.inv, tx0 = S.tx0, tz0 = S.tz0, W = S.W, H = S.H, tile = S.tile, slot = S.slot;
	let q = -1, lastK = -1, run = 0, lx = 0, ly = 0, lz = 0, hx = 0, hy = 0, hz = 0;
	for (let t = t0; t <= t1; t++) {
		let k = -2, ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, cx = 0, cy = 0, cz = 0;
		if (t < t1) {
			const a = ix ? ix[t * 3] * 3 : t * 9, b = ix ? ix[t * 3 + 1] * 3 : a + 3, c = ix ? ix[t * 3 + 2] * 3 : a + 6;
			ax = pa[a]; ay = pa[a + 1]; az = pa[a + 2]; bx = pa[b]; by = pa[b + 1]; bz = pa[b + 2]; cx = pa[c]; cy = pa[c + 1]; cz = pa[c + 2];
			let kx = Math.floor((ax + bx + cx) * inv) - tx0, kz = Math.floor((az + bz + cz) * inv) - tz0;
			kx = kx < 0 ? 0 : kx >= W ? W - 1 : kx; kz = kz < 0 ? 0 : kz >= H ? H - 1 : kz;
			k = kx + kz * W;
		}
		if (k !== lastK) {
			// (the run before ends: its count and bounds written to its tile)
			if (q >= 0) {
				const B = S.bnd, o = q * 6;
				S.count[q] += run;
				if (lx < B[o]) B[o] = lx; if (ly < B[o + 1]) B[o + 1] = ly; if (lz < B[o + 2]) B[o + 2] = lz;
				if (hx > B[o + 3]) B[o + 3] = hx; if (hy > B[o + 4]) B[o + 4] = hy; if (hz > B[o + 5]) B[o + 5] = hz;
			}
			if (t === t1) break;
			lastK = k; q = slot[k]; run = 0;
			if (q < 0) {
				q = slot[k] = S.cells.length; S.cells.push(k); S.count.push(0);
				if (S.bnd.length < (q + 1) * 6) { const g = new Float64Array(S.bnd.length * 2); g.set(S.bnd); S.bnd = g; }
				const B = S.bnd;
				B[q * 6] = B[q * 6 + 1] = B[q * 6 + 2] = Infinity; B[q * 6 + 3] = B[q * 6 + 4] = B[q * 6 + 5] = -Infinity;
			}
			lx = ly = lz = Infinity; hx = hy = hz = -Infinity;
		}
		tile[t] = q; run++;
		lx = Math.min(lx, ax, bx, cx); ly = Math.min(ly, ay, by, cy); lz = Math.min(lz, az, bz, cz);
		hx = Math.max(hx, ax, bx, cx); hy = Math.max(hy, ay, by, cy); hz = Math.max(hz, az, bz, cz);
	}
}
// Lays geo's triangles out tile by tile (each tile's in the order they were). Returns the tiles
// in list order: { start, count } in drawRange's units (indices, or vertices) and their bounds
// { box }. null (left as it was) if the geometry is split into groups, morphs or shares
// interleaved buffers. An indexed geometry has its index reordered; any other has its vertices
// moved. (One pass to find each triangle's tile and grow that tile's bounds, then a counting
// sort: about 5 ms for 100k triangles here, so it is for meshes built once, not as you move.)
export function tileTriangles(geo, size = 250) {
	if (geo.groups.length || geo.morphAttributes.position) return null;
	if (!geo.index && Object.values(geo.attributes).some((A) => A.isInterleavedBufferAttribute)) return null;
	const P = geo.attributes.position, I = geo.index, n = (I ? I.count : P.count) / 3;
	if (!n || P.isInterleavedBufferAttribute || P.itemSize !== 3 || P.normalized) return null;
	const pa = P.array, ix = I ? I.array : null, inv = 1 / (size * 3), nv = P.count * 3;
	// (the ground's extent in tiles, from every 16th vertex: a tile off its edge is counted in the
	// edge's tile, whose bounds are grown to hold it all the same)
	let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
	for (let v = 0; v < nv; v += 48) { const x = pa[v], z = pa[v + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
	const tx0 = Math.floor(x0 / size), tz0 = Math.floor(z0 / size), W = Math.min(2048, Math.floor(x1 / size) - tx0 + 1), H = Math.min(2048, Math.floor(z1 / size) - tz0 + 1);
	// each triangle's tile (by its middle), the tiles in the order first met, their bounds
	const S = { pa, ix, inv, tx0, tz0, W, H, tile: new Int32Array(n), slot: new Int32Array(W * H).fill(-1), cells: [], count: [], bnd: new Float64Array(64 * 6) };
	tilePass(S, 0, n);
	const { tile, cells, count, bnd } = S;
	// (a counting sort: the tiles in curve order, each tile's triangles as they came)
	let side = 1;
	while (side < Math.max(W, H)) side *= 2;
	const curve = cells.map((k) => hilbert(side, k % W, Math.floor(k / W)));
	const byCurve = cells.map((_, q) => q).sort((p, q) => curve[p] - curve[q]);
	const at = new Int32Array(cells.length), tiles = [];
	let run = 0;
	for (const q of byCurve) {
		at[q] = run;
		const o = q * 6;
		tiles.push({ start: run * 3, count: count[q] * 3, box: new THREE.Box3(new THREE.Vector3(bnd[o], bnd[o + 1], bnd[o + 2]), new THREE.Vector3(bnd[o + 3], bnd[o + 4], bnd[o + 5])) });
		run += count[q];
	}
	const order = new Uint32Array(n);
	for (let t = 0; t < n; t++) order[at[tile[t]]++] = t;
	// (each triangle's index or vertices moved to its place, from a copy)
	const move = (dst, w) => {
		let src;
		if (dst instanceof Float32Array) { if (_f32.length < n * w) _f32 = new Float32Array(n * w); src = _f32; src.set(dst.subarray(0, n * w)); } else src = dst.slice(0, n * w);
		for (let i = 0; i < n; i++) { const s0 = order[i] * w, d0 = i * w; for (let j = 0; j < w; j++) dst[d0 + j] = src[s0 + j]; }
	};
	if (I) { move(ix, 3); I.needsUpdate = true; } else for (const name in geo.attributes) { const A = geo.attributes[name]; move(A.array, A.itemSize * 3); A.needsUpdate = true; }
	return { tiles };
}

// The mesh drawn as before by every view, but in a shadow pass only from the first of its
// tiles in the shadow camera's box to the last (none: not drawn at all). Its geometry is laid
// out by tileTriangles here; the mesh must not be moved off the world's frame afterwards
// without its matrixWorld showing it (a moved mesh's tiles are moved with it).
export function shadowByTiles(mesh, size = 250) {
	const geo = mesh.geometry, T = tileTriangles(geo, size);
	if (!T) return mesh;
	if (!geo.boundingSphere) geo.computeBoundingSphere();
	const world = T.tiles.map((t) => t.box.clone()), seen = new THREE.Matrix4(), _s = new THREE.Sphere(), _b = new THREE.Box3();
	let span = null, kept = null;
	const sync = () => {
		if (seen.equals(mesh.matrixWorld)) return;
		seen.copy(mesh.matrixWorld);
		T.tiles.forEach((t, i) => world[i].copy(t.box).applyMatrix4(seen));
	};
	sync();
	// (any view: the tiles in it, as the run of the list they span; a view more than a few tiles
	// across, the screen's, draws the mesh whole as before, without the sums)
	const wide = size * 8;
	mesh.intersectsFrustum = (f) => {
		span = null;
		if (!f.planes) return f.intersectsObject(mesh);
		_s.copy(geo.boundingSphere).applyMatrix4(mesh.matrixWorld);
		if (!f.intersectsSphere(_s)) return false;
		const C = frustumCorners(f.planes);
		if (!C) return true;
		_b.makeEmpty();
		for (const c of C) _b.expandByPoint(c);
		if (_b.max.x - _b.min.x > wide || _b.max.z - _b.min.z > wide) return true;
		sync();
		let lo = Infinity, hi = -Infinity;
		for (let i = 0; i < world.length; i++) {
			const w = world[i];
			if (!w.intersectsBox(_b) || !f.intersectsBox(w)) continue;
			const t = T.tiles[i];
			if (t.start < lo) lo = t.start;
			if (t.start + t.count > hi) hi = t.start + t.count;
		}
		if (lo > hi) return false;
		span = [lo, hi];
		return true;
	};
	mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry) => {
		if (!span || geometry !== geo) return;
		const R = geo.drawRange, a = Math.max(span[0], R.start), b = Math.min(span[1], R.start + R.count);
		kept = [R.start, R.count];
		R.start = a; R.count = Math.max(0, b - a);
	};
	mesh.onAfterShadow = () => {
		if (kept) { geo.drawRange.start = kept[0]; geo.drawRange.count = kept[1]; kept = null; }
		span = null;
	};
	mesh.userData.shadowTiles = T.tiles.length;
	return mesh;
}

// ---------- instanced meshes: nearest first ----------
// An instanced mesh along kilometres of a bridge (its lamps, the power line's towers) is laid
// out nearest first from a point near you (laid out again when you have moved step m on), each
// instance keyed by its distance across the ground less its own reach; the shadow pass draws only
// the instances whose key is within the shadow box's reach from that point (boxReach). The view
// draws them all as before. (A mesh only moved from the world's frame is allowed for; turned or
// scaled, or moved since it was laid out, it is drawn whole.)
const moved = (e) => e[0] !== 1 || e[5] !== 1 || e[10] !== 1 || e[1] || e[2] || e[4] || e[6] || e[8] || e[9];
export function shadowByNearest(im, step = 100) {
	const n = im.count, src = im.instanceMatrix.array.slice(), col = im.instanceColor ? im.instanceColor.array.slice() : null;
	const geo = im.geometry;
	if (!geo.boundingSphere) geo.computeBoundingSphere();
	const px = new Float64Array(n), pz = new Float64Array(n), pr = new Float64Array(n), M = new THREE.Matrix4(), c = new THREE.Vector3();
	for (let i = 0; i < n; i++) {
		M.fromArray(src, i * 16);
		c.copy(geo.boundingSphere.center).applyMatrix4(M);
		px[i] = c.x; pz[i] = c.z; pr[i] = geo.boundingSphere.radius * M.getMaxScaleOnAxis();
	}
	const ord = Array.from({ length: n }, (_, i) => i), keys = new Float64Array(n), key = new Float64Array(n);
	let cx = Infinity, cz = Infinity, ox = 0, oz = 0, full = -1;
	// (called outside the frame's drawing, so the order and the keys reach the GPU together)
	function order(x, z) {
		if (Math.hypot(x - cx, z - cz) < step) return false;
		im.updateWorldMatrix(true, false);
		const e = im.matrixWorld.elements;
		if (moved(e)) return false;
		cx = x; cz = z; ox = e[12]; oz = e[14];
		for (let i = 0; i < n; i++) key[i] = Math.hypot(px[i] + ox - x, pz[i] + oz - z) - pr[i];
		ord.sort((a, b) => key[a] - key[b]);
		const A = im.instanceMatrix.array, Cc = im.instanceColor?.array;
		for (let k = 0; k < n; k++) {
			const i = ord[k];
			keys[k] = key[i];
			A.set(src.subarray(i * 16, i * 16 + 16), k * 16);
			if (col) Cc.set(col.subarray(i * 3, i * 3 + 3), k * 3);
		}
		im.instanceMatrix.clearUpdateRanges?.(); im.instanceMatrix.needsUpdate = true;
		if (col) { im.instanceColor.clearUpdateRanges?.(); im.instanceColor.needsUpdate = true; }
		return true;
	}
	im.onBeforeShadow = (renderer, object, camera, shadowCamera) => {
		const e = im.matrixWorld.elements;
		if (cx === Infinity || moved(e) || e[12] !== ox || e[14] !== oz) return;
		const r = boxReach(shadowCamera, cx, cz);
		let lo = 0, hi = n;
		while (lo < hi) { const m = (lo + hi) >> 1; if (keys[m] <= r) lo = m + 1; else hi = m; }
		full = im.count;
		im.count = Math.min(im.count, lo);
	};
	im.onAfterShadow = () => { if (full >= 0) { im.count = full; full = -1; } };
	return { order };
}
