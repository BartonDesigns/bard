// The engine's own relief on the Bay's real ground. The survey holds the land to 10-120 m;
// finer than that it is smooth. This adds what it can't see, the way globeheight.js does
// out in the world: rills and knolls from 96 m down to 12 m, deeper on the steeper hills
// (as the survey's own slope says), none in the towns, at the water or down on the flats by
// the bay, and less where a fine survey (10-16 m) already holds the ground. The Bay's frame
// never floats while you are over the survey, so the noise runs on the Bay's own metres.
//
// The CPU's copy is bay/terrain.js's groundAt (rills() here and its masks there); the GPU's
// is BAY_DETAIL_GLSL in the Bay ground's vertex shader. No textures of its own: it reads the
// survey (uB0 and the three fine slots) and the town map (uUrban), all already bound there.

export const BAY_DETAIL_U = { uBDAmp: { value: 0 } };
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
// ground, urban the town map's density, wet the water's carve, fine a fine survey's share
export function detailAmp(inS, sl, base, urban, wet, fine) {
	return BAY_DETAIL_U.uBDAmp.value * (0.25 + 1.6 * Math.min(sl, 0.6)) * inS * sst(3, 25, base) * (1 - sst(0.03, 0.2, urban)) * (1 - sst(0.05, 0.6, Math.abs(wet))) * (1 - fine * 0.75);
}

export const BAY_DETAIL_GLSL = /* glsl */`
uniform float uBDAmp; uniform sampler2D uUrban; uniform vec4 uUR;
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
float bdUrban(vec2 w){
	vec2 S = vec2(textureSize(uUrban, 0)), f = (w - uUR.xy) / uUR.z - 0.5;
	if (uUR.z < 2.0 || f.x < 0.0 || f.y < 0.0 || f.x >= S.x - 1.0 || f.y >= S.y - 1.0) return 0.0;
	ivec2 i = ivec2(floor(f)); vec2 u = f - floor(f);
	return mix(mix(texelFetch(uUrban, i, 0).r, texelFetch(uUrban, i + ivec2(1, 0), 0).r, u.x), mix(texelFetch(uUrban, i + ivec2(0, 1), 0).r, texelFetch(uUrban, i + ivec2(1, 1), 0).r, u.x), u.y);
}
float bdFine(vec2 w){
	float k = 0.0;
	if (uRa.w > 0.0 && uRa.z <= 16.0) k = max(k, bIn(uBa, uRa, w, uRa.w));
	if (uRb.w > 0.0 && uRb.z <= 16.0) k = max(k, bIn(uBb, uRb, w, uRb.w));
	if (uRc.w > 0.0 && uRc.z <= 16.0) k = max(k, bIn(uBc, uRc, w, uRc.w));
	return k;
}
float bayDetail(vec2 w, float base, float wet){
	if (uBDAmp <= 0.0 || base < 3.0) return 0.0;
	float inS = bIn(uB0, uR0, w, 3000.0);
	if (inS <= 0.0) return 0.0;
	float g0 = bLevel(uB0, uR0, w), sl = length(vec2(bLevel(uB0, uR0, w + vec2(40.0, 0.0)) - g0, bLevel(uB0, uR0, w + vec2(0.0, 40.0)) - g0)) / 40.0;
	float a = uBDAmp * (0.25 + 1.6 * min(sl, 0.6)) * inS * smoothstep(3.0, 25.0, base) * (1.0 - smoothstep(0.03, 0.2, bdUrban(w))) * (1.0 - smoothstep(0.05, 0.6, abs(wet))) * (1.0 - bdFine(w) * 0.75);
	return a > 0.0 ? bdRills(w) * a : 0.0;
}
`;
