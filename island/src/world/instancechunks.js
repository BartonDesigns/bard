// An instanced mesh drawn in chunks, each its own draw that the renderer leaves out when it is
// out of the view (or out of the sun's shadow box). The city's buildings and roofs were drawn
// all round you in one draw each, and a phone's view takes in a tenth of the circle: the rest
// was lifted, lit and clipped behind you every frame for nothing.
// The instances are written sector by sector round where they were laid out (nearest first in
// each, in shadowreach.js's bands), into chunks of a fixed size: a chunk holds a run of one
// sector, and is tested by a polygon round everything in it, stood up over the heights it
// spans, so nothing that could show is ever left out (the same exact test as the ground's
// wedges, world/gridwedges.js). The mesh written to (the store) keeps every slot as before, so
// the city and structures/damage.js go on writing to it; it is never drawn itself. Each chunk
// draws its own slice of the store's buffers (views of the same memory: a write to the store is
// a write to the chunk), sent to the graphics card again whenever the store's change.

import * as THREE from 'three';
import { footprint } from './gridwedges.js';
import { REACH_BANDS, bandOf, shadowByReach } from './shadowreach.js';

// the headings round the centre a list is cut into (a phone's view spans two or three)
export const SECTORS = 12;
// The middle, everything within MID of the centre (less its half-size), is a sector of its own
// (S, after the headings): it is round you whichever way you look, and the sun's box stands over
// it (cut by heading, the shadow pass drew a piece of every sector there).
export const MID = REACH_BANDS[0];

// which sector an item (at x, z, reaching half past it) is in, round (cx, cz): its heading's,
// or the middle's, S
export function sectorOf(x, z, cx, cz, half = 0, S = SECTORS) {
	if (Math.hypot(x - cx, z - cz) - half <= MID) return S;
	const k = Math.floor((Math.atan2(z - cz, x - cx) + Math.PI) / (2 * Math.PI) * S);
	return k >= S ? S - 1 : k > 0 ? k : 0;
}

// Orders list in place sector by sector, the middle last, and in each sector band by band (each
// item's distance from (cx, cz) less half(item), as shadowreach.js's orderByReach), keeping the
// list's own order within a band. Returns each item's sector and band, in the new order.
export function orderBySector(list, cx, cz, half, S = SECTORS, bands = REACH_BANDS) {
	const nb = bands.length + 1, n = list.length, key = new Uint16Array(n), at = new Int32Array((S + 1) * nb + 1);
	for (let i = 0; i < n; i++) {
		const o = list[i], h = half(o), k = sectorOf(o.x, o.z, cx, cz, h, S) * nb + bandOf(Math.hypot(o.x - cx, o.z - cz) - h, bands);
		key[i] = k; at[k + 1]++;
	}
	for (let k = 1; k <= (S + 1) * nb; k++) at[k] += at[k - 1];
	const was = list.slice(), sec = new Uint8Array(n), band = new Uint8Array(n);
	for (let i = 0; i < n; i++) { const k = key[i], j = at[k]++; list[j] = was[i]; sec[j] = (k / nb) | 0; band[j] = k % nb; }
	return { sec, band };
}

// the slots a store needs for cap instances in chunks of ch round S sectors and the middle (a
// sector's last chunk is part full, at most one a sector)
export const chunkStore = (cap, ch, S = SECTORS) => (Math.ceil(cap / ch) + S + 1) * ch;

// Slots in chunks of ch: the next one for an item of sector s, in a new chunk whenever the sector
// changes or the chunk is full; -1 once every chunk is used
export function chunkSlots(ch, nch) {
	const counts = new Int32Array(nch);
	let cur = -1, sec = -1;
	return {
		counts,
		reset() { counts.fill(0); cur = -1; sec = -1; },
		next(s) {
			if (cur < 0 || s !== sec || counts[cur] >= ch) { if (cur + 1 >= nch) return -1; cur++; sec = s; }
			return cur * ch + counts[cur]++;
		},
	};
}

// the polygon round a set of discs, by its supporting lines in K even directions (s[k]: the
// farthest any disc reaches along direction k): it holds them all, a little larger, never smaller
const K = 16, UX = [], UZ = [];
for (let k = 0; k < K; k++) { UX.push(Math.cos(k / K * Math.PI * 2)); UZ.push(Math.sin(k / K * Math.PI * 2)); }
export function supportPolygon(s, out = new Float64Array(K * 2)) {
	for (let i = 0; i < K; i++) {
		const j = (i + 1) % K, det = UX[i] * UZ[j] - UX[j] * UZ[i];
		out[i * 2] = (s[i] * UZ[j] - s[j] * UZ[i]) / det; out[i * 2 + 1] = (UX[i] * s[j] - UX[j] * s[i]) / det;
	}
	return out;
}

// whether two convex polygons (flat [x, z, ...], A moved by ax, az) are apart: some edge of
// either separates them (as gridwedges.js's polysApart, without making garbage each call)
function spanOf(Q, ox, oz, nx, nz, out) {
	let lo = Infinity, hi = -Infinity;
	for (let k = 0; k < Q.length; k += 2) { const d = (Q[k] + ox) * nx + (Q[k + 1] + oz) * nz; if (d < lo) lo = d; if (d > hi) hi = d; }
	out[0] = lo; out[1] = hi;
}
const _sa = [0, 0], _sb = [0, 0];
export function apart(A, ax, az, B) {
	// (an edge's normal is the same wherever the polygon is moved to)
	for (let pass = 0; pass < 2; pass++) {
		const Q = pass ? B : A, n = Q.length / 2;
		if (n < 2) continue;
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n, nx = Q[j * 2 + 1] - Q[i * 2 + 1], nz = Q[i * 2] - Q[j * 2];
			if (!nx && !nz) continue;
			spanOf(A, ax, az, nx, nz, _sa); spanOf(B, 0, 0, nx, nz, _sb);
			if (_sa[1] < _sb[0] || _sb[1] < _sa[0]) return true;
		}
	}
	return false;
}

// the view's footprint over the heights y0..y1 (gridwedges.js), kept while the frustum and the
// heights are the same: every chunk of a frame's pass is tested against the one footprint
const _fp = { key: new Float64Array(26).fill(NaN), F: null };
function footprintOf(planes, y0, y1) {
	const key = _fp.key;
	let same = key[24] === y0 && key[25] === y1;
	for (let i = 0; i < 6 && same; i++) { const p = planes[i]; same = key[i * 4] === p.normal.x && key[i * 4 + 1] === p.normal.y && key[i * 4 + 2] === p.normal.z && key[i * 4 + 3] === p.constant; }
	if (same) return _fp.F;
	for (let i = 0; i < 6; i++) { const p = planes[i]; key[i * 4] = p.normal.x; key[i * 4 + 1] = p.normal.y; key[i * 4 + 2] = p.normal.z; key[i * 4 + 3] = p.constant; }
	key[24] = y0; key[25] = y1;
	return (_fp.F = footprint(planes, y0, y1));
}

// Whether a chunk (its polygon moved by ox, oz; its heights y0..y1) can show in the frustum.
// Y: the heights one shared footprint is worked out over, for every chunk standing within them
export function chunkInView(hull, ox, oz, y0, y1, planes, Y) {
	const F = y0 >= Y[0] && y1 <= Y[1] ? footprintOf(planes, Y[0], Y[1]) : footprint(planes, y0, y1);
	if (!F) return true;
	if (!F.length) return false;
	return !apart(hull, ox, oz, F);
}

// The store's chunks, under parent. ch: the instances a chunk; Y: the heights most of the
// instances stand within (for the shared footprint). put() an item's slot as it is written (its
// sector and band from orderBySector, the disc round it on the ground and the heights it spans),
// between begin() and end(). gaps: the store's count is made to span every slot written, the
// slots between one chunk's last and the next's first holding nothing (for code that reads the
// store's instances 0..count, as structures/damage.js does the roofs' kit)
const NOTHING = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -1e7, 0).elements;
export function chunkedMesh(store, ch, { parent, Y = [-100, 1600], name = store.name || 'chunk', gaps = false }) {
	const nch = Math.floor(store.instanceMatrix.count / ch), src = store.geometry;
	const root = new THREE.Group();
	root.name = name;
	parent.add(root);
	const view = (a, j) => new THREE.InstancedBufferAttribute(a.array.subarray(j * ch * a.itemSize, (j + 1) * ch * a.itemSize), a.itemSize, a.normalized);
	// what the store has and each chunk's view of it
	const kinds = [['m', store.instanceMatrix], ...(store.instanceColor ? [['c', store.instanceColor]] : [])];
	for (const k in src.attributes) if (src.attributes[k].isInstancedBufferAttribute) kinds.push([k, src.attributes[k]]);
	const seen = kinds.map(([, a]) => a.version);
	const slots = chunkSlots(ch, nch), meshes = [], meta = [];
	let cx = 0, cz = 0;
	for (let j = 0; j < nch; j++) {
		const g = new THREE.InstancedBufferGeometry();
		g.setIndex(src.index);
		for (const k in src.attributes) { const a = src.attributes[k]; g.setAttribute(k, a.isInstancedBufferAttribute ? view(a, j) : a); }
		g.instanceCount = Infinity;
		const im = new THREE.InstancedMesh(g, store.material, 0);
		im.instanceMatrix = view(store.instanceMatrix, j);
		if (store.instanceColor) im.instanceColor = view(store.instanceColor, j);
		im.castShadow = store.castShadow; im.receiveShadow = store.receiveShadow;
		im.customDepthMaterial = store.customDepthMaterial; im.customDistanceMaterial = store.customDistanceMaterial;
		im.visible = false; im.name = name + '#' + j;
		// (a copy of the store's instances: structures/damage.js edits the store, never a chunk)
		im.userData.copyOf = store;
		const M = { s: new Float64Array(K), hull: new Float64Array(K * 2), y0: 0, y1: 0, bc: new Int32Array(REACH_BANDS.length + 1), last: 0, ok: true, R: null };
		const views = kinds.map(([k]) => (k === 'm' ? im.instanceMatrix : k === 'c' ? im.instanceColor : g.attributes[k]));
		M.views = views;
		im.intersectsFrustum = (f) => {
			sync();
			// (only moved, never turned or scaled: anything else is drawn, never wrongly left out)
			const e = im.matrixWorld.elements;
			if (e[0] !== 1 || e[5] !== 1 || e[10] !== 1 || e[1] || e[2] || e[4] || e[6] || e[8] || e[9]) return true;
			return chunkInView(M.hull, e[12], e[14], M.y0 + e[13], M.y1 + e[13], f.planes, Y);
		};
		// the sun's pass: only the bands its box can reach (shadowreach.js), of a chunk in the box
		shadowByReach(im, () => M.R);
		root.add(im); meshes.push(im); meta.push(M);
	}
	// the store's buffers changed (written by the city, damage.js, a house built): the chunks'
	// views go up again, as far as each is filled
	function sync() {
		for (let i = 0; i < kinds.length; i++) {
			const v = kinds[i][1].version;
			if (v === seen[i]) continue;
			seen[i] = v;
			for (let j = 0; j < nch; j++) {
				const n = slots.counts[j];
				if (!n) continue;
				const a = meta[j].views[i];
				a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true;
			}
		}
	}
	return {
		root, meshes, meta, nch, ch,
		begin(x, z) {
			slots.reset(); cx = x; cz = z;
			for (const M of meta) { M.s.fill(-Infinity); M.y0 = Infinity; M.y1 = -Infinity; M.bc.fill(0); M.last = 0; M.ok = true; }
		},
		// a slot for an item: its sector and band, the disc (x, z, r) its footprint lies in, its
		// heights y0..y1; -1 when there is no room
		put(sec, band, x, z, r, y0, y1) {
			const slot = slots.next(sec);
			if (slot < 0) return -1;
			const M = meta[(slot / ch) | 0], s = M.s;
			for (let k = 0; k < K; k++) { const d = x * UX[k] + z * UZ[k] + r; if (d > s[k]) s[k] = d; }
			if (y0 < M.y0) M.y0 = y0;
			if (y1 > M.y1) M.y1 = y1;
			// (written nearest first: else the shadow pass draws the chunk whole)
			if (band < M.last) M.ok = false;
			M.last = band; M.bc[band]++;
			return slot;
		},
		end() {
			if (gaps) {
				let last = -1;
				for (let j = 0; j < nch; j++) if (slots.counts[j]) last = j;
				const A = store.instanceMatrix.array;
				for (let j = 0; j < last; j++) for (let i = j * ch + slots.counts[j]; i < (j + 1) * ch; i++) A.set(NOTHING, i * 16);
				store.count = last < 0 ? 0 : last * ch + slots.counts[last];
			}
			for (let j = 0; j < nch; j++) {
				const im = meshes[j], M = meta[j], n = slots.counts[j];
				im.count = n; im.visible = n > 0; im.boundingSphere = null;
				if (!n) { M.R = null; continue; }
				supportPolygon(M.s, M.hull);
				const ends = [];
				let t = 0;
				for (let b = 0; b < M.bc.length; b++) { t += M.bc[b]; ends.push(t); }
				M.R = M.ok ? { cx, cz, bands: REACH_BANDS, ends } : null;
			}
			sync();
		},
		// whether the chunks throw shadows (a town still rising out of the ground does not)
		setShadow(on) { for (const im of meshes) im.castShadow = on; },
		sync,
	};
}
