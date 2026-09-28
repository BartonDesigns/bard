// The ground under the rivers and lakes, shaped finer than the survey. The survey's heights
// are 10 to 120 m apart, far too coarse for a creek's channel or a lake's shore, so round
// you the ground is carved on a 2 m grid: each 256 m square that holds water gets a tile
// of 129 x 129 values (the drop or rise from the survey there, and what the ground is: wet
// gravel and mud at the water, concrete in a flood channel), kept in slots of one atlas,
// with a small index over the squares round you saying which slot is whose. The terrain
// shader reads it (WC_GLSL), the game walks on it (waterDelta), so what is drawn and what
// is walked agree. water.js fills the tiles; this module only holds them.
//
// A bridge deck is the one place the two differ: the channel is carved under it on the
// GPU, while the ground the game walks and drives on stays at the road's level there.

import * as THREE from 'three';

export const WT = 256;                   // metres a tile
export const WN = 128;                   // intervals across a tile (texels are WN + 1 wide, shared edges)
const W1 = WN + 1, IDX = 16;             // the index: IDX x IDX tiles round you

const blankRG = () => { const t = new THREE.DataTexture(new Uint16Array(8), 2, 2, THREE.RGFormat, THREE.HalfFloatType); t.needsUpdate = true; return t; };
const blankR = () => { const t = new THREE.DataTexture(new Uint8Array(4), 2, 2, THREE.RedFormat, THREE.UnsignedByteType); t.needsUpdate = true; return t; };
export const WC_U = {
	uWcIdx: { value: blankR() }, uWcAt: { value: blankRG() },
	uWcR: { value: new THREE.Vector4(0, 0, WT, 0) },           // the index's corner x, z, tile size, reach (0: off)
	uWcS: { value: new THREE.Vector4(1, 1, 0, 0) },            // atlas columns, rows; camera x, z
};
export const WC_GLSL = /* glsl */`
uniform highp sampler2D uWcIdx, uWcAt; uniform vec4 uWcR, uWcS;
// (drop or rise of the ground from the survey, the ground's kind: 0..1 wet gravel and mud,
// 1..2 concrete)
vec2 wcAt(vec2 w){
	if (uWcR.w < 0.5) return vec2(0.0);
	vec2 q = (w - uWcR.xy) / uWcR.z;
	if (q.x < 0.0 || q.y < 0.0 || q.x >= ${IDX}.0 || q.y >= ${IDX}.0) return vec2(0.0);
	ivec2 c = ivec2(q);
	float id = texelFetch(uWcIdx, c, 0).r * 255.0;
	if (id < 0.5) return vec2(0.0);
	int s = int(id + 0.5) - 1, cols = int(uWcS.x);
	vec2 base = vec2(float(s % cols), float(s / cols)) * ${W1}.0;
	vec2 f = (q - vec2(c)) * ${WN}.0;
	return textureLod(uWcAt, (base + f + 0.5) / vec2(textureSize(uWcAt, 0)), 0.0).rg;
}
// the carving as the ground is drawn: faded out toward the edge of what is carved round you
float wcK(vec2 w){ return 1.0 - smoothstep(uWcR.w * 0.7, uWcR.w, length(w - uWcS.zw)); }
`;

// the CPU's copy: each resident tile's drop (as walked: bridge decks left level)
const C = { tiles: new Map(), version: 0, trees: null, water: null, grow: 0 };
const tkey = (i, j) => i * 100003 + j;
export function waterDelta(x, z) {
	if (!C.tiles.size) return 0;
	const qx = x / WT, qz = z / WT, i = Math.floor(qx), j = Math.floor(qz), t = C.tiles.get(tkey(i, j));
	if (!t) return 0;
	const fx = (qx - i) * WN, fz = (qz - j) * WN, a = Math.min(WN - 1, Math.floor(fx)), b = Math.min(WN - 1, Math.floor(fz)), u = fx - a, v = fz - b, D = t.walk, o = b * W1 + a;
	return (D[o] * (1 - u) + D[o + 1] * u) * (1 - v) + (D[o + W1] * (1 - u) + D[o + W1 + 1] * u) * v;
}
export const waterVersion = () => C.grow;

// The atlas: slots for tiles, and the index round you. water.js adds a tile
// (put: its drop as drawn, as walked, and its kinds, W1 x W1 each), drops one (drop),
// and moves the index with you (centre).
export function createCarveAtlas(slots) {
	const cols = Math.ceil(Math.sqrt(slots)), rows = Math.ceil(slots / cols), AW = cols * W1, AH = rows * W1;
	const at = new Uint16Array(AW * AH * 2), tex = new THREE.DataTexture(at, AW, AH, THREE.RGFormat, THREE.HalfFloatType);
	tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
	const idx = new Uint8Array(IDX * IDX), itex = new THREE.DataTexture(idx, IDX, IDX, THREE.RedFormat, THREE.UnsignedByteType);
	itex.minFilter = itex.magFilter = THREE.NearestFilter; itex.generateMipmaps = false; itex.needsUpdate = true;
	WC_U.uWcAt.value.dispose(); WC_U.uWcIdx.value.dispose();
	WC_U.uWcAt.value = tex; WC_U.uWcIdx.value = itex;
	WC_U.uWcS.value.set(cols, rows, 0, 0);
	const free = [...Array(slots).keys()].reverse(), h = THREE.DataUtils.toHalfFloat;
	C.tiles.clear(); C.version++;
	let ci = -1e9, cj = -1e9, dirty = false;
	function reindex() {
		idx.fill(0);
		const i0 = ci - IDX / 2, j0 = cj - IDX / 2;
		for (const t of C.tiles.values()) { const a = t.i - i0, b = t.j - j0; if (a >= 0 && b >= 0 && a < IDX && b < IDX) idx[b * IDX + a] = t.slot + 1; }
		itex.needsUpdate = true;
		WC_U.uWcR.value.x = i0 * WT; WC_U.uWcR.value.y = j0 * WT;
		dirty = false;
	}
	return {
		has: (i, j) => C.tiles.has(tkey(i, j)),
		full: () => !free.length,
		count: () => C.tiles.size,
		// draw: [drop, kind] interleaved; walk: drop as walked
		put(i, j, draw, walk) {
			let t = C.tiles.get(tkey(i, j));
			if (!t) { if (!free.length) return false; t = { i, j, slot: free.pop(), walk }; C.tiles.set(tkey(i, j), t); }
			t.walk = walk;
			const bx = (t.slot % cols) * W1, by = Math.floor(t.slot / cols) * W1;
			for (let b = 0; b < W1; b++) {
				const o = ((by + b) * AW + bx) * 2, s = b * W1 * 2;
				for (let a = 0; a < W1 * 2; a++) at[o + a] = h(draw[s + a]);
				tex.addUpdateRange((by + b) * AW * 4 + bx * 4, W1 * 4);
			}
			tex.needsUpdate = true;
			dirty = true; C.version++;
			return true;
		},
		drop(i, j) {
			const t = C.tiles.get(tkey(i, j));
			if (!t) return;
			C.tiles.delete(tkey(i, j)); free.push(t.slot); dirty = true; C.version++;
		},
		tiles: () => C.tiles.values(),
		// the index follows you; the carving fades out at reach metres
		centre(x, z, reach) {
			const i = Math.floor(x / WT), j = Math.floor(z / WT);
			if (Math.abs(i - ci) > 2 || Math.abs(j - cj) > 2) { ci = i; cj = j; dirty = true; }
			if (dirty) reindex();
			WC_U.uWcR.value.w = reach; WC_U.uWcS.value.z = x; WC_U.uWcS.value.w = z;
		},
		window: () => ({ i0: ci - IDX / 2, j0: cj - IDX / 2, n: IDX }),
	};
}

// ---------- the water's say in the rest of the world ----------
export function setWaterHooks({ water = null, trees = null } = {}) { C.water = water; C.trees = trees; }
// in a lake or a river (or at its very edge)?
export const inWater = (x, z) => !!C.water?.(x, z);
// the trees along the banks near a point: { x, y, z, h, cone, sp, col }
export const waterTreesNear = (x, z, r) => (C.trees ? C.trees(x, z, r) : []);
// new trees stood up along the banks (the city gathers them on its next rebuild)
export function grewTrees() { C.grow++; }
