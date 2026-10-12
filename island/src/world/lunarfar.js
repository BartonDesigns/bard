// The Moon past the land's edge: rolling mare, highland ridges and craters of every size
// out to the horizon. One function, written twice (JS for the ground you stand on, GLSL
// for the ground drawn) with the same hash, so what is drawn is what you walk on.
// Inside the land it is nothing; past the edge it takes over within FADE metres.

const C1 = 1500, C2 = 420, FADE = 450;
const fract = (v) => v - Math.floor(v);
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// a hash without sine (it stays the same on CPU and GPU)
function hash(x, y) {
	let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
	const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
	a += d; b += d; c += d;
	return fract((a + b) * c);
}
function vn(x, y) {
	const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
	const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
	return (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
}
const bowl = (d, R) => (d < 1 ? -(1 - d * d) * R * 0.2 : 0) + Math.exp(-Math.pow((d - 1) * 4.5, 2)) * R * 0.07;
// the craters of one size class round (x, z): a cell of size C holds at most one
function craters(x, z, C, r0, r1, seed, peaks, out) {
	let h = 0;
	const ci = Math.floor(x / C), cj = Math.floor(z / C);
	for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
		const a = ci + i, b = cj + j;
		if (hash(a + seed, b) < 0.3) continue;
		const R = r0 + hash(a + 17 + seed, b) * (r1 - r0);
		const cx = (a + 0.25 + 0.5 * hash(a, b + 9 + seed)) * C, cz = (b + 0.25 + 0.5 * hash(a + 5, b + 3 + seed)) * C;
		const d = Math.hypot(x - cx, z - cz) / R;
		if (out) out.push({ x: cx, z: cz, r: R });
		if (d > 1.6) continue;
		h += bowl(d, R) + (peaks && R > 330 ? Math.exp(-Math.pow(d / 0.16, 2)) * R * 0.07 : 0);
	}
	return h;
}
export function farRelief(x, z) {
	const r = Math.hypot(x, z);
	let h = 30 + (vn(x / 900, z / 900) - 0.5) * 30 + (vn(x / 320 + 7, z / 320 - 3) - 0.5) * 8;
	const ridge = 1 - Math.abs(2 * vn(x / 2600 + 3, z / 2600) - 1);
	h += ridge * ridge * 150 * sstep(2500, 8000, r);
	return h + craters(x, z, C1, 160, 640, 0, true) + craters(x, z, C2, 20, 130, 31, false);
}
// the big craters near a point (for siting things on their rims)
export function farCraters(x, z) { const out = []; craters(x, z, C1, 160, 640, 0, true, out); return out; }
// the ground at (x, z) given the land's own height there (clamped at its edge)
export function farBlend(land, x, z, half) {
	const b = Math.max(Math.abs(x), Math.abs(z)) - half;
	return b <= 0 ? land : land + (farRelief(x, z) - land) * sstep(0, FADE, b);
}

export const FAR_GLSL = /* glsl */`
float fH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float fVn(vec2 p){ vec2 i = floor(p), u = p - i, s = u * u * (3.0 - 2.0 * u);
	return mix(mix(fH(i), fH(i + vec2(1.0, 0.0)), s.x), mix(fH(i + vec2(0.0, 1.0)), fH(i + vec2(1.0, 1.0)), s.x), s.y); }
float fBowl(float d, float R){ return (d < 1.0 ? -(1.0 - d * d) * R * 0.2 : 0.0) + exp(-pow((d - 1.0) * 4.5, 2.0)) * R * 0.07; }
float fCraters(vec2 w, float C, float r0, float r1, float seed, float peaks){
	float h = 0.0; vec2 c0 = floor(w / C);
	for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
		vec2 c = c0 + vec2(float(i), float(j));
		if (fH(c + vec2(seed, 0.0)) < 0.3) continue;
		float R = r0 + fH(c + vec2(17.0 + seed, 0.0)) * (r1 - r0);
		vec2 o = (c + vec2(0.25 + 0.5 * fH(c + vec2(0.0, 9.0 + seed)), 0.25 + 0.5 * fH(c + vec2(5.0, 3.0 + seed)))) * C;
		float d = length(w - o) / R;
		if (d > 1.6) continue;
		h += fBowl(d, R) + (peaks > 0.5 && R > 330.0 ? exp(-pow(d / 0.16, 2.0)) * R * 0.07 : 0.0);
	}
	return h;
}
float farRelief(vec2 w){
	float r = length(w);
	float h = 30.0 + (fVn(w / 900.0) - 0.5) * 30.0 + (fVn(w / 320.0 + vec2(7.0, -3.0)) - 0.5) * 8.0;
	float ridge = 1.0 - abs(2.0 * fVn(w / 2600.0 + vec2(3.0, 0.0)) - 1.0);
	h += ridge * ridge * 150.0 * smoothstep(2500.0, 8000.0, r);
	return h + fCraters(w, ${C1}.0, 160.0, 640.0, 0.0, 1.0) + fCraters(w, ${C2}.0, 20.0, 130.0, 31.0, 0.0);
}
float farBlend(float land, vec2 w){
	float b = max(abs(w.x), abs(w.y)) - uHalf;
	return b <= 0.0 ? land : mix(land, farRelief(w), smoothstep(0.0, ${FADE}.0, b));
}`;
