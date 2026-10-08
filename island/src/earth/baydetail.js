// The engine's own relief on the Bay's real ground. The survey holds the land to 10-120 m;
// finer than that it is smooth. This adds what it can't see, the way globeheight.js does
// out in the world: rills and knolls from 96 m down to 12 m, deeper on the steeper hills
// (as the survey's own slope says), none in the towns, at the water or down on the flats by
// the bay, and less where a fine survey (10-16 m) already holds the ground. The Bay's frame
// never floats while you are over the survey, so the noise runs on the Bay's own metres.
//
// None where anything is built: not in the towns of the town map (uUrban), and not where the
// real city has a roof or a street (uBuilt: tools/bake-built.py, loaded with the survey, so
// every device has the same ground before a building stands on it).
//
// The CPU's copy is bay/terrain.js's groundAt (rills() here and its masks there); the GPU's
// is BAY_DETAIL_GLSL in the Bay ground's vertex shader. It reads the survey (uB0 and the
// three fine slots) and the town map (uUrban), both already bound there, and uBuilt.

import * as THREE from 'three';

// the built mask's corner (x, z) and cell, as tools/bake-built.py printed them
export const BUILT_R = [-14640, -43392, 48];
const blank = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RedFormat, THREE.UnsignedByteType); t.needsUpdate = true; return t; };
export const BAY_DETAIL_U = { uBDAmp: { value: 0 }, uBuilt: { value: blank() }, uBuR: { value: new THREE.Vector4(BUILT_R[0], BUILT_R[1], BUILT_R[2], 0) } };
const BT = { data: null, W: 0, H: 0 };
// the mask arrived (one byte a cell, 0..255): the CPU's copy and the GPU's
export function setBuilt(data, W, H) {
	BT.data = data; BT.W = W; BT.H = H;
	const t = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
	t.needsUpdate = true;
	BAY_DETAIL_U.uBuilt.value.dispose();
	BAY_DETAIL_U.uBuilt.value = t;
	BAY_DETAIL_U.uBuR.value.w = 1;
}
// how built up a point is, 0..1 (bilinear, as the GPU's bdBuilt)
export function builtAt(x, z) {
	if (!BT.data) return 0;
	const fx = (x - BUILT_R[0]) / BUILT_R[2] - 0.5, fz = (z - BUILT_R[1]) / BUILT_R[2] - 0.5;
	if (fx < 0 || fz < 0 || fx >= BT.W - 1 || fz >= BT.H - 1) return 0;
	const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * BT.W + i, D = BT.data, R = BT.W;
	return ((D[k] * (1 - u) + D[k + 1] * u) * (1 - v) + (D[k + R] * (1 - u) + D[k + R + 1] * u) * v) / 255;
}
export const BAY_DETAIL_AMP = 1.6;            // m of rill on gentle ground (up to about 3x on steep)

const h2 = (x, y, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ s; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 8) / 16777216; };
// the rills: ridged value noise turned into gullies, about -0.5..0.5
export function rills(x, z) {
	let s = 0, amp = 1;
	for (let o = 0; o < 4; o++) {
		const m = (1 << o) / 96, qx = x * m, qz = z * m, i = Math.floor(qx), j = Math.floor(qz);
		let u = qx - i, v = qz - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
		const sd = Math.imul(o + 3, -1640531535);
		const a = h2(i, j, sd), b = h2(i + 1, j, sd), c = h2(i, j + 1, sd), d = h2(i + 1, j + 1, sd);
		const n = (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v, r = 1 - Math.abs(2 * n - 1);
		s += (0.5 - r * r) * amp; amp *= 0.5;
	}
	return s;
}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the amplitude from its masks: inS in the survey (0..1), sl the survey's slope, base the
// ground, urban how built up it is, fine a fine survey's share. (Not the creeks' carving:
// that comes and goes as you do, and the ground must not; it sets its own heights anyway.)
export function detailAmp(inS, sl, base, urban, fine) {
	return BAY_DETAIL_U.uBDAmp.value * (0.25 + 1.6 * Math.min(sl, 0.6)) * inS * sst(3, 25, base) * (1 - sst(0.03, 0.2, urban)) * (1 - fine * 0.75);
}

export const BAY_DETAIL_GLSL = /* glsl */`
uniform float uBDAmp; uniform sampler2D uUrban, uBuilt; uniform vec4 uUR, uBuR;
float bdH(ivec2 p, uint s){ uint h = (uint(p.x) * 374761393u) ^ (uint(p.y) * 668265263u) ^ s; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h >> 8u) / 16777216.0; }
float bdRills(vec2 w){
	float s = 0.0, amp = 1.0;
	for (int o = 0; o < 4; o++) {
		vec2 q = w * (float(1 << o) / 96.0), fq = floor(q), f = q - fq, u = f * f * (3.0 - 2.0 * f);
		ivec2 i = ivec2(fq); uint sd = uint(o + 3) * 2654435761u;
		float n = mix(mix(bdH(i, sd), bdH(i + ivec2(1, 0), sd), u.x), mix(bdH(i + ivec2(0, 1), sd), bdH(i + ivec2(1, 1), sd), u.x), u.y), r = 1.0 - abs(2.0 * n - 1.0);
		s += (0.5 - r * r) * amp; amp *= 0.5;
	}
	return s;
}
// (a mask read bilinear by hand, exactly as the CPU reads it)
float bdMask(sampler2D t, vec4 r, vec2 w){
	vec2 S = vec2(textureSize(t, 0)), f = (w - r.xy) / r.z - 0.5;
	if (f.x < 0.0 || f.y < 0.0 || f.x >= S.x - 1.0 || f.y >= S.y - 1.0) return 0.0;
	ivec2 i = ivec2(floor(f)); vec2 u = f - floor(f);
	return mix(mix(texelFetch(t, i, 0).r, texelFetch(t, i + ivec2(1, 0), 0).r, u.x), mix(texelFetch(t, i + ivec2(0, 1), 0).r, texelFetch(t, i + ivec2(1, 1), 0).r, u.x), u.y);
}
// the towns' map and the real city's built mask
float bdUrban(vec2 w){ return max(uUR.z < 2.0 ? 0.0 : bdMask(uUrban, uUR, w), uBuR.w < 0.5 ? 0.0 : bdMask(uBuilt, uBuR, w)); }
float bdFine(vec2 w){
	float k = 0.0;
	if (uRa.w > 0.0 && uRa.z <= 16.0) k = max(k, bIn(uBa, uRa, w, uRa.w));
	if (uRb.w > 0.0 && uRb.z <= 16.0) k = max(k, bIn(uBb, uRb, w, uRb.w));
	if (uRc.w > 0.0 && uRc.z <= 16.0) k = max(k, bIn(uBc, uRc, w, uRc.w));
	return k;
}
float bayDetail(vec2 w, float base){
	if (uBDAmp <= 0.0 || base < 3.0) return 0.0;
	float inS = bIn(uB0, uR0, w, 3000.0);
	if (inS <= 0.0) return 0.0;
	float g0 = bLevel(uB0, uR0, w), sl = length(vec2(bLevel(uB0, uR0, w + vec2(40.0, 0.0)) - g0, bLevel(uB0, uR0, w + vec2(0.0, 40.0)) - g0)) / 40.0;
	float a = uBDAmp * (0.25 + 1.6 * min(sl, 0.6)) * inS * smoothstep(3.0, 25.0, base) * (1.0 - smoothstep(0.03, 0.2, bdUrban(w))) * (1.0 - bdFine(w) * 0.75);
	return a > 0.0 ? bdRills(w) * a : 0.0;
}
`;
