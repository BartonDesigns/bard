// Ground shaped finer than the survey. The coarse level's heights are 120 m apart, too far
// to hold a river's channel, its banks and levees; so where a river runs the ground is
// carved on a finer grid: each survey cell it touches gets a tile of 25 x 25 heights
// (5 m apart), packed into one atlas, and an index over the cells says which tile is
// whose. Each texel holds how far the ground drops (or rises) from the survey there, and
// what it is: wet gravel and sand at the water's edge, the green of the banks, a paved path.
// The terrain shader reads it (CARVE_GLSL: heights near you, colours everywhere), the game
// walks on it (carveDelta), so what is drawn and what is walked agree.
//
// The river that carves also says where its water is and which trees stand along it: the
// city asks here (riverTreesNear, inRiverWater) so it plants no oak in the channel.

import * as THREE from 'three';

export const TILE = 24;                  // intervals across a cell (texels are TILE + 1 wide, shared edges)
const T1 = TILE + 1, ROW = 64;           // tiles per atlas row

const blank = (fmt) => { const t = new THREE.DataTexture(new Uint16Array(fmt === THREE.RGBAFormat ? 16 : 4), 2, 2, fmt, THREE.HalfFloatType); t.needsUpdate = true; return t; };
export const CARVE_U = {
	uCvIdx: { value: blank(THREE.RedFormat) }, uCvAt: { value: blank(THREE.RGBAFormat) },
	uCvR: { value: new THREE.Vector4(0, 0, 120, 0) },          // x0, zN, cell, on
};
export const CARVE_GLSL = /* glsl */`
uniform highp sampler2D uCvIdx, uCvAt; uniform vec4 uCvR;
// (delta height, gravel, green bank, path)
vec4 carveAt(vec2 w){
	if (uCvR.w < 0.5) return vec4(0.0);
	vec2 q = (w - uCvR.xy) / uCvR.z;
	ivec2 S = textureSize(uCvIdx, 0);
	if (q.x < 0.0 || q.y < 0.0 || q.x >= float(S.x) || q.y >= float(S.y)) return vec4(0.0);
	ivec2 c = ivec2(q);
	float id = texelFetch(uCvIdx, c, 0).r;
	if (id < 0.5) return vec4(0.0);
	int t = int(id + 0.5) - 1;
	ivec2 base = ivec2(t % ${ROW}, t / ${ROW}) * ${T1};
	vec2 f = (q - vec2(c)) * ${TILE}.0;
	ivec2 i = ivec2(min(floor(f), vec2(${TILE - 1}.0)));
	vec2 u = f - vec2(i);
	ivec2 p = base + i;
	vec4 a = texelFetch(uCvAt, p, 0), b = texelFetch(uCvAt, p + ivec2(1, 0), 0);
	vec4 e = texelFetch(uCvAt, p + ivec2(0, 1), 0), d = texelFetch(uCvAt, p + ivec2(1, 1), 0);
	return mix(mix(a, b, u.x), mix(e, d, u.x), u.y);
}`;

// the CPU's copy: the index and each tile's heights
const C = { on: false, x0: 0, zN: 0, cell: 120, W: 0, H: 0, idx: null, dh: null, version: 0 };

// how far the carving moves the ground at a point (metres; 0 where nothing is carved)
export function carveDelta(x, z) {
	if (!C.on) return 0;
	const qx = (x - C.x0) / C.cell, qz = (z - C.zN) / C.cell;
	if (qx < 0 || qz < 0 || qx >= C.W || qz >= C.H) return 0;
	const ci = Math.floor(qx), cj = Math.floor(qz), id = C.idx[cj * C.W + ci];
	if (!id) return 0;
	const fx = (qx - ci) * TILE, fz = (qz - cj) * TILE, i = Math.min(TILE - 1, Math.floor(fx)), j = Math.min(TILE - 1, Math.floor(fz)), u = fx - i, v = fz - j;
	const D = C.dh, o = (id - 1) * T1 * T1 + j * T1 + i;
	return (D[o] * (1 - u) + D[o + 1] * u) * (1 - v) + (D[o + T1] * (1 - u) + D[o + T1 + 1] * u) * v;
}
export const carveVersion = () => C.version;
// within m metres of anything carved?
export const carveNear = (x, z, m) => C.on && x > C.x0 - m && x < C.x0 + C.W * C.cell + m && z > C.zN - m && z < C.zN + C.H * C.cell + m;

// A carving to fill: the grid of survey cells it may touch and how many tiles it will have;
// tiles are added one cell at a time ([delta, gravel, green, path] at each texel, T1 x T1),
// then committed (the atlas goes up to the GPU in one piece).
export function beginCarve(x0, zN, cell, W, H, n) {
	const rows = Math.ceil(n / ROW), AW = Math.min(n, ROW) * T1, AH = rows * T1;
	const at = new Uint16Array(AW * AH * 4), dh = new Float32Array(n * T1 * T1), idx = new Int32Array(W * H), h = THREE.DataUtils.toHalfFloat;
	let t = 0;
	const K = {
		add(i, j, d) {
			if (t >= n) return;
			const bx = (t % ROW) * T1, by = Math.floor(t / ROW) * T1;
			for (let b = 0; b < T1; b++) for (let a = 0; a < T1; a++) {
				const s = (b * T1 + a) * 4, o = ((by + b) * AW + bx + a) * 4;
				at[o] = h(d[s]); at[o + 1] = h(d[s + 1]); at[o + 2] = h(d[s + 2]); at[o + 3] = h(d[s + 3]);
				dh[t * T1 * T1 + b * T1 + a] = d[s];
			}
			idx[j * W + i] = ++t;
		},
		commit() {
			const ih = new Uint16Array(W * H);
			for (let k = 0; k < W * H; k++) ih[k] = h(idx[k]);
			const ti = new THREE.DataTexture(ih, W, H, THREE.RedFormat, THREE.HalfFloatType);
			const ta = new THREE.DataTexture(at, AW, AH, THREE.RGBAFormat, THREE.HalfFloatType);
			for (const q of [ti, ta]) { q.minFilter = q.magFilter = THREE.NearestFilter; q.generateMipmaps = false; q.needsUpdate = true; }
			CARVE_U.uCvIdx.value.dispose(); CARVE_U.uCvAt.value.dispose();
			CARVE_U.uCvIdx.value = ti; CARVE_U.uCvAt.value = ta;
			CARVE_U.uCvR.value.set(x0, zN, cell, 1);
			// (the version moves when the river's hooks are set, just after: one rebuild, not two)
			Object.assign(C, { on: true, x0, zN, cell, W, H, idx, dh });
		},
	};
	return K;
}

// ---------- the river's say in the rest of the world ----------
const R = { water: null, trees: null };
export function setRiverHooks({ water = null, trees = null } = {}) { R.water = water; R.trees = trees; C.version++; }
// in the river's water (or its wet edge)?
export const inRiverWater = (x, z) => !!R.water?.(x, z);
// the trees that grow along it near a point: { x, y, z, h, cone, sp, col }
export const riverTreesNear = (x, z, r) => (R.trees ? R.trees(x, z, r) : []);
