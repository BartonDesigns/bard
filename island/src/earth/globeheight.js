// The globe's ground, as a height at any point: the coarse Earth (globedata.js, a tenth of
// a degree) with the engine's own relief on top, shaped by what the place is like. Its CPU
// and GPU copies are written side by side here and must stay twins: the game walks, builds
// and drains water on the one, and draws the other.
//
//   the coarse ground   bicubic through the baked cells, with the coast where the land's share
//                       of a cell crosses a half (wiggled at a few km), a shelf off it, and the
//                       big lakes lying at their own levels
//   the relief          ten octaves from 8 km down to 16 m, as tall as the place's own relief
//                       (measured from the real elevation in the bake): smooth and rolling on
//                       the plains, ridged with the finer octaves riding the crests on the
//                       ranges (the valleys between come out smooth, like eroded ones)
//   the particular      ranges drawn north-south (basin and range), long ridges running
//                       north-east (the Appalachians' ridge and valley), dunes, tower karst,
//                       and the stepped mesas and canyon walls of the plateaus, each only
//                       where the atlas says the land is so
//
// The noise is a function of the latitude and longitude alone (on the sphere, in metres), so
// the frame can float (globeframe.js) without a hill moving. Its lattice is found on the CPU in
// double precision (the anchor's cell and fraction) and the GPU only adds the few km from
// there, so a float holds it to the millimetre anywhere on Earth.

import * as THREE from 'three';
import { F, RAD, EARTH_R, lonRaw } from './globeframe.js';

export const RES = 10;                 // cells a degree
export const S0 = 8192, OCT = 10;      // the relief's octaves: 8 km down to 16 m
// the directed forms, on a plane of the latitude and longitude scaled at a latitude of their
// own: bearing of the long axis (degrees from north), how drawn out along it, the longest wave
const FAM = [
	{ lat: 39, bearing: 0, stretch: 5, s0: 12000, oct: 4 },        // basin and range
	{ lat: 38, bearing: 40, stretch: 7, s0: 6000, oct: 4 },        // ridge and valley
	{ lat: 24, bearing: -25, stretch: 3, s0: 1600, oct: 3 },       // dunes
];
for (const f of FAM) {
	const t = f.bearing * RAD, cu = 111320 * Math.cos(f.lat * RAD), cv = 110996;
	// (across, along / stretch) of (lon * cu, lat * cv), per metre of the longest wave
	f.M = [Math.cos(t) * cu / f.s0, -Math.sin(t) * cv / f.s0, Math.sin(t) * cu / f.stretch / f.s0, Math.cos(t) * cv / f.stretch / f.s0];
}

// ---------- the noise (the GLSL below matches) ----------
const SALT = -1640531535;
function h3(x, y, z, s) {
	let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, -2048144777) ^ s;
	h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
	return (h >>> 8) / 16777216;
}
export function vn3(qx, qy, qz, s) {
	const i = Math.floor(qx), j = Math.floor(qy), k = Math.floor(qz);
	let u = qx - i, v = qy - j, w = qz - k;
	u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
	const a = h3(i, j, k, s), b = h3(i + 1, j, k, s), c = h3(i, j + 1, k, s), d = h3(i + 1, j + 1, k, s);
	const e = h3(i, j, k + 1, s), f = h3(i + 1, j, k + 1, s), g = h3(i, j + 1, k + 1, s), h = h3(i + 1, j + 1, k + 1, s);
	const x0 = (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
	const x1 = (e + (f - e) * u) + ((g + (h - g) * u) - (e + (f - e) * u)) * v;
	return x0 + (x1 - x0) * w;
}
function vn2(qx, qy, s) {
	const i = Math.floor(qx), j = Math.floor(qy);
	let u = qx - i, v = qy - j;
	u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
	const a = h3(i, j, 7, s), b = h3(i + 1, j, 7, s), c = h3(i, j + 1, 7, s), d = h3(i + 1, j + 1, 7, s);
	return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

// the directed forms: ridged, 0..1 (crests at 1)
function famAt(f, k0, U, V) {
	let s = 0, n = 0, amp = 1;
	for (let o = 0; o < f.oct; o++) {
		const m = 2 ** o, qx = (f.M[0] * U + f.M[1] * V) * m, qy = (f.M[2] * U + f.M[3] * V) * m;
		const r = 1 - Math.abs(2 * vn2(qx, qy, Math.imul(k0 + o, SALT)) - 1);
		s += r * r * amp; n += amp; amp *= 0.5;
	}
	return s / n;
}

// ---------- the CPU's copy ----------
// win: the window of cells round the anchor (globedata.js): its planes and where it lies
export function createGlobeHeight(win) {
	const out = { h: 0, land: 0, lake: 0, level: 0, rock: 0 };
	const W = () => win.N;
	// the cell planes at a point, bilinear (and E bicubic, kept inside its four nearest)
	function coarse(cx, cy) {
		const N = W(), P = win.P;
		cx = clamp(cx, 1, N - 2.001); cy = clamp(cy, 1, N - 2.001);
		const i = Math.floor(cx), j = Math.floor(cy), u = cx - i, v = cy - j, k = j * N + i;
		const bl = (A) => (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + N] * (1 - u) + A[k + N + 1] * u) * v;
		// Catmull-Rom through the 4 x 4
		const E = P.E, cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
		const row = (r) => { const q = k + r * N; return cr(E[q - 1], E[q], E[q + 1], E[q + 2], u); };
		let e = cr(row(-1), row(0), row(1), row(2), v);
		const lo = Math.min(E[k], E[k + 1], E[k + N], E[k + N + 1]), hi = Math.max(E[k], E[k + 1], E[k + N], E[k + N + 1]);
		e = clamp(e, lo, hi);
		return { e, L: bl(P.L), WL: bl(P.WL), A: bl(P.A), RG: bl(P.RG), TR: bl(P.TR), BNR: bl(P.BNR), RV: bl(P.RV), DUNE: bl(P.DUNE), KARST: bl(P.KARST), K: bl(P.K) };
	}
	// the height at the engine's (x, z) in the frame now
	const at = (x, z) => atLL(F.lat - (z - F.fz) / F.kz, lonRaw(x));
	// ...and at a latitude and longitude (the same ground whatever the frame)
	function atLL(lat, lon) {
		const lonW0 = -180 + win.gi0 / RES, latW1 = 90 - win.gj0 / RES;
		const cx = ((((lon - lonW0) % 360) + 360) % 360) * RES - 0.5, cy = (latW1 - lat) * RES - 0.5;
		const c = coarse(cx, cy);
		// on the sphere, in metres, for the relief's noise
		const cp = Math.cos(lat * RAD), px = EARTH_R * cp * Math.cos(lon * RAD), py = EARTH_R * cp * Math.sin(lon * RAD), pz = EARTH_R * Math.sin(lat * RAD);
		let sum = 0, w = 1, amp = 1, n2 = 0, n3 = 0, n4 = 0, n5 = 0;
		for (let k = 0; k < OCT; k++) {
			const m = 2 ** k / S0, nn = 2 * vn3(px * m, py * m, pz * m, Math.imul(k + 1, SALT)) - 1;
			if (k === 2) n2 = nn; else if (k === 3) n3 = nn; else if (k === 4) n4 = nn; else if (k === 5) n5 = nn;
			let r = 1 - Math.abs(nn); r = r * r * 3 - 1;
			const v = nn + (r - nn) * c.RG;
			sum += v * amp * w;
			w = 1 + (clamp(0.55 + 0.6 * v, 0.2, 1) - 1) * c.RG;
			amp *= 0.55;
		}
		const U = lon, V = lat;
		return assemble(c, alpine(sum * (0.7 + 0.8 * c.RG), c), n2, n3, n4, n5, (fi) => famAt(FAM[fi], 20 + fi * 8, U, V));
	}
	// the high ranges carved by ice: the valleys widened and floored (U-shaped), the ridges
	// between them sharpened to aretes and the peaks lifted toward their real heights
	function alpine(D, c) {
		const al = sstep(450, 900, c.A) * c.RG;
		if (al <= 0) return D;
		let d = D < -0.3 ? -0.3 + (D + 0.3) * 0.35 : D;
		d = d > 0.4 ? 0.4 + (d - 0.4) * 1.5 : d;
		return (D + (d - D) * al) * (1 + 0.4 * al);
	}
	function assemble(c, D, n2, n3, n4, n5, fam) {
		const coastN = n2 * 0.6 + n3 * 0.4;
		const cs = c.L - 0.5 + coastN * 0.1;
		const lake = sstep(0.4, 0.6, c.K / Math.max(0.02, 1 - c.L)), Ws = c.WL * lake;
		out.land = cs; out.lake = lake; out.level = Ws;
		let h;
		if (cs > 0) {
			// the directed forms take over the relief where the land is so
			let rel = D;
			const fs = Math.min(0.85, c.BNR + c.RV);
			if (fs > 0.01) rel = D * (1 - fs) + (c.BNR > 0.01 ? (fam(0) * 2 - 1) * c.BNR : 0) + (c.RV > 0.01 ? (fam(1) * 2 - 1) * c.RV : 0);
			let hl = Math.max(c.e, Ws + 0.5) + rel * c.A * sstep(0, 0.1, cs);
			if (c.DUNE > 0.01) hl += c.DUNE * (18 + 0.25 * c.A) * (fam(2) * 2 - 1) * sstep(0, 0.1, cs);
			if (c.KARST > 0.01) { const t = sstep(0.05, 0.4, 0.65 * n4 + 0.35 * n5); hl += c.KARST * (60 + 1.0 * c.A) * t * Math.sqrt(t) * sstep(0, 0.1, cs); }
			if (c.TR > 0.01) {
				const st = clamp(c.A * 0.3, 10, 80), q = (hl - Ws) / st, fq = fract(q);
				hl += (Ws + (Math.floor(q) + sstep(0.3, 0.7, fq)) * st - hl) * c.TR * 0.8;
			}
			hl = Math.max(hl, Ws + 0.3);
			h = Ws - 2 + (hl - Ws + 2) * sstep(0, 0.02, cs);
		} else {
			const hs = Math.min(c.e, Ws - 2 - 90 * -cs);
			h = Ws - 2 + (hs - Ws + 2) * sstep(0, 0.02, -cs);
		}
		if (h !== h) h = 0;             // (never a NaN into the game: a guard, it should not happen)
		out.h = h;
		return h;
	}
	return { at, atLL, out, coarse };
}

// ---------- the anchor's share: the lattice cells and fractions the GPU starts from ----------
export function anchorUniforms(U, win) {
	const lat = F.lat, lon = F.lon, cp = Math.cos(lat * RAD);
	const P = [EARTH_R * cp * Math.cos(lon * RAD) / S0, EARTH_R * cp * Math.sin(lon * RAD) / S0, EARTH_R * Math.sin(lat * RAD) / S0];
	U.uGI0.value.set(Math.floor(P[0]), Math.floor(P[1]), Math.floor(P[2]));
	U.uGF0.value.set(P[0] - Math.floor(P[0]), P[1] - Math.floor(P[1]), P[2] - Math.floor(P[2]));
	U.uGAnc.value.set(Math.sin(lat * RAD), Math.cos(lat * RAD), Math.sin(lon * RAD), Math.cos(lon * RAD));
	U.uGDeg.value.set(1 / F.kx, 1 / F.kz);
	U.uGWin.value.set(win.cx0, win.cy0, RES / F.kx, RES / F.kz);
	FAM.forEach((f, i) => {
		const a = f.M[0] * lon + f.M[1] * lat, b = f.M[2] * lon + f.M[3] * lat;
		U.uGFamI.value[i * 2] = Math.floor(a); U.uGFamI.value[i * 2 + 1] = Math.floor(b);
		U.uGFamF.value[i].set(a - Math.floor(a), b - Math.floor(b));
		U.uGFamM.value[i].set(...f.M);
	});
}

// the uniforms the GLSL reads (textures and the window's place: globedata.js sets them); one set
// for the page, so the sea (world/ocean.js) can read the globe's coasts from the start
export const GLOBE_U = globeUniforms();
export function globeUniforms() {
	return {
		uGOn: { value: 0 }, uGF: { value: new THREE.Vector2() }, uGBay: { value: 1 }, uGSeam: { value: new THREE.Vector2(3000, 25000) },
		uGT0: { value: null }, uGT1: { value: null }, uGT2: { value: null }, uGT3: { value: null }, uGT4: { value: null },
		uGWin: { value: new THREE.Vector4() }, uGOff: { value: new THREE.Vector2() }, uGAnc: { value: new THREE.Vector4() }, uGDeg: { value: new THREE.Vector2() },
		uGI0: { value: new THREE.Vector3() }, uGF0: { value: new THREE.Vector3() },
		uGFamI: { value: new Int32Array(FAM.length * 2) }, uGFamF: { value: FAM.map(() => new THREE.Vector2()) }, uGFamM: { value: FAM.map(() => new THREE.Vector4()) },
	};
}

// ---------- the GPU's copy ----------
// globeHeight(d, oct) with d the metres from the anchor (x east, z south); oct the octaves
// to draw (fewer far off, where the grid can't hold them; the last fades in)
export const GLOBE_GLSL = /* glsl */`
uniform highp sampler2D uGT0, uGT1, uGT2;
uniform vec4 uGWin, uGAnc; uniform vec2 uGOff, uGDeg; uniform ivec3 uGI0; uniform vec3 uGF0;
uniform ivec2 uGFamI[${FAM.length}]; uniform vec2 uGFamF[${FAM.length}]; uniform vec4 uGFamM[${FAM.length}];
float gH3(ivec3 p, uint s){ uint h = (uint(p.x) * 374761393u) ^ (uint(p.y) * 668265263u) ^ (uint(p.z) * 2246822519u) ^ s; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h >> 8u) / 16777216.0; }
float gVn3(ivec3 i, vec3 f, uint s){
	vec3 u = f * f * (3.0 - 2.0 * f);
	float a = gH3(i, s), b = gH3(i + ivec3(1, 0, 0), s), c = gH3(i + ivec3(0, 1, 0), s), d = gH3(i + ivec3(1, 1, 0), s);
	float e = gH3(i + ivec3(0, 0, 1), s), g = gH3(i + ivec3(1, 0, 1), s), h = gH3(i + ivec3(0, 1, 1), s), k = gH3(i + ivec3(1, 1, 1), s);
	float x0 = mix(mix(a, b, u.x), mix(c, d, u.x), u.y), x1 = mix(mix(e, g, u.x), mix(h, k, u.x), u.y);
	return mix(x0, x1, u.z);
}
float gVn2(ivec2 i, vec2 f, uint s){
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = gH3(ivec3(i, 7), s), b = gH3(ivec3(i + ivec2(1, 0), 7), s), c = gH3(ivec3(i + ivec2(0, 1), 7), s), d = gH3(ivec3(i + ivec2(1, 1), 7), s);
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const uint G_SALT = 2654435761u;
float gFam(int fi, vec2 dd, int oct, int k0){
	float s = 0.0, n = 0.0, amp = 1.0;
	vec4 M = uGFamM[fi];
	vec2 t0 = vec2(M.x * dd.x + M.y * dd.y, M.z * dd.x + M.w * dd.y);
	for (int o = 0; o < 4; o++) {
		if (o >= oct) break;
		float m = float(1 << o);
		vec2 t = uGFamF[fi] * m + t0 * m, ft = floor(t);
		float r = 1.0 - abs(2.0 * gVn2(uGFamI[fi] * (1 << o) + ivec2(ft), t - ft, uint(k0 + o) * G_SALT) - 1.0);
		s += r * r * amp; n += amp; amp *= 0.5;
	}
	return s / n;
}
vec4 gFetch(highp sampler2D T, ivec2 p){ return texelFetch(T, p, 0); }
vec4 gBil(highp sampler2D T, ivec2 i, vec2 u){ return mix(mix(gFetch(T, i), gFetch(T, i + ivec2(1, 0)), u.x), mix(gFetch(T, i + ivec2(0, 1)), gFetch(T, i + ivec2(1, 1)), u.x), u.y); }
float gCr(float p0, float p1, float p2, float p3, float t){ return p1 + 0.5 * t * (p2 - p0 + t * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + t * (3.0 * (p1 - p2) + p3 - p0))); }
// (what the height found out on the way: the coast's side, the lake, its level, the relief)
float gCoast, gLake, gLevel, gAmp, gRel;
// the coarse cells at d: E (bicubic, kept inside its four nearest), and the planes bilinear
float gE; vec4 gC0, gC1, gC2;
void gCoarse(vec2 d){
	float N = float(textureSize(uGT0, 0).x);
	vec2 cc = clamp(uGWin.xy + d * uGWin.zw, vec2(1.0), vec2(N - 2.001));
	ivec2 i = ivec2(floor(cc)); vec2 u = cc - floor(cc);
	float r0[4];
	for (int b = -1; b <= 2; b++) r0[b + 1] = gCr(gFetch(uGT0, i + ivec2(-1, b)).r, gFetch(uGT0, i + ivec2(0, b)).r, gFetch(uGT0, i + ivec2(1, b)).r, gFetch(uGT0, i + ivec2(2, b)).r, u.x);
	gC0 = gBil(uGT0, i, u); gC1 = gBil(uGT1, i, u); gC2 = gBil(uGT2, i, u);
	float e00 = gFetch(uGT0, i).r, e10 = gFetch(uGT0, i + ivec2(1, 0)).r, e01 = gFetch(uGT0, i + ivec2(0, 1)).r, e11 = gFetch(uGT0, i + ivec2(1, 1)).r;
	gE = clamp(gCr(r0[0], r0[1], r0[2], r0[3], u.y), min(min(e00, e10), min(e01, e11)), max(max(e00, e10), max(e01, e11)));
}
// the metres from the anchor on the sphere (over S0), found from the small angles (never the big numbers)
vec3 gSphere(vec2 d){
	float dph = -d.y * uGDeg.y * ${RAD}, dla = d.x * uGDeg.x * ${RAD};
	float hp = sin(dph * 0.5), hl = sin(dla * 0.5), sp = sin(dph), sl = sin(dla);
	float dcp = -2.0 * hp * hp * uGAnc.y - sp * uGAnc.x, dsp = -2.0 * hp * hp * uGAnc.x + sp * uGAnc.y;
	float dcl = -2.0 * hl * hl * uGAnc.w - sl * uGAnc.z, dsl = -2.0 * hl * hl * uGAnc.z + sl * uGAnc.w;
	return ${EARTH_R}.0 * vec3(dcp * (uGAnc.w + dcl) + uGAnc.y * dcl, dcp * (uGAnc.z + dsl) + uGAnc.y * dsl, dsp) / ${S0}.0;
}
// one octave of the relief's noise, -1..1
float gOct(int k, vec3 dP){
	float m = float(1 << k);
	vec3 t = uGF0 * m + dP * m, ft = floor(t);
	return 2.0 * gVn3(uGI0 * (1 << k) + ivec3(ft), t - ft, uint(k + 1) * G_SALT) - 1.0;
}
// the coast's side, the lake and its level from the coarse cells and the coast's wiggle
float gShore(float n2, float n3){
	float L = gC0.g, WL = gC0.b, K = gC2.b;
	gCoast = L - 0.5 + (n2 * 0.6 + n3 * 0.4) * 0.1;
	gLake = smoothstep(0.4, 0.6, K / max(0.02, 1.0 - L)); gLevel = WL * gLake;
	return gCoast;
}
float gSeaSide(float cs, float Ws){ float hs = min(gE, Ws - 2.0 - 90.0 * -cs); return mix(Ws - 2.0, hs, smoothstep(0.0, 0.02, -cs)); }
float globeHeight(vec2 d, float oct){
	gCoarse(d);
	float A = gC0.a, RG = gC1.r, TR = gC1.g, BNR = gC1.b, RV = gC1.a, DUNE = gC2.r, KARST = gC2.g;
	vec3 dP = gSphere(d);
	float sum = 0.0, w = 1.0, amp = 1.0, n2 = 0.0, n3 = 0.0, n4 = 0.0, n5 = 0.0;
	for (int k = 0; k < ${OCT}; k++) {
		float fk = float(k);
		if (fk >= oct && k > 3) break;
		// (the first four always: the coast's wiggle is theirs, and the sea's surf reads it)
		float fade = clamp(oct - fk, 0.0, 1.0);
		float nn = gOct(k, dP);
		if (k == 2) n2 = nn; else if (k == 3) n3 = nn; else if (k == 4) n4 = nn * fade; else if (k == 5) n5 = nn * fade;
		nn *= fade;
		float r = 1.0 - abs(nn); r = r * r * 3.0 - 1.0;
		float v = mix(nn, r, RG) * fade;
		sum += v * amp * w;
		w = mix(1.0, clamp(0.55 + 0.6 * v, 0.2, 1.0), RG);
		amp *= 0.55;
	}
	float D = sum * (0.7 + 0.8 * RG);
	// the high ranges carved by ice (see alpine() on the CPU)
	float al = smoothstep(450.0, 900.0, A) * RG;
	if (al > 0.0) { float dd = D < -0.3 ? -0.3 + (D + 0.3) * 0.35 : D; dd = dd > 0.4 ? 0.4 + (dd - 0.4) * 1.5 : dd; D = mix(D, dd, al) * (1.0 + 0.4 * al); }
	vec2 dd = vec2(d.x * uGDeg.x, -d.y * uGDeg.y);          // degrees of longitude and latitude from the anchor
	float cs = gShore(n2, n3), Ws = gLevel;
	gAmp = A; gRel = D;
	float h;
	if (cs > 0.0) {
		float rel = D, fs = min(0.85, BNR + RV), ck = smoothstep(0.0, 0.1, cs);
		if (fs > 0.01) rel = D * (1.0 - fs) + (BNR > 0.01 ? (gFam(0, dd, int(min(oct, 4.0)), 20) * 2.0 - 1.0) * BNR : 0.0) + (RV > 0.01 ? (gFam(1, dd, int(min(oct, 4.0)), 28) * 2.0 - 1.0) * RV : 0.0);
		float hl2 = max(gE, Ws + 0.5) + rel * A * ck;
		if (DUNE > 0.01 && oct > 5.0) hl2 += DUNE * (18.0 + 0.25 * A) * (gFam(2, dd, 3, 36) * 2.0 - 1.0) * ck;
		if (KARST > 0.01) { float t = smoothstep(0.05, 0.4, 0.65 * n4 + 0.35 * n5); hl2 += KARST * (60.0 + 1.0 * A) * t * sqrt(t) * ck; }
		if (TR > 0.01) {
			float st = clamp(A * 0.3, 10.0, 80.0), q = (hl2 - Ws) / st, fq = fract(q);
			hl2 += (Ws + (floor(q) + smoothstep(0.3, 0.7, fq)) * st - hl2) * TR * 0.8;
		}
		hl2 = max(hl2, Ws + 0.3);
		h = mix(Ws - 2.0, hl2, smoothstep(0.0, 0.02, cs));
	} else h = gSeaSide(cs, Ws);
	return h;
}
// the sea's view of the ground: the coarse cells and the coast as the ground has it, without the
// land's relief (for the surf, the shallows and the swash, world/ocean.js)
float globeSea(vec2 d){
	gCoarse(d);
	vec3 dP = gSphere(d);
	float cs = gShore(gOct(2, dP), gOct(3, dP)), Ws = gLevel;
	return cs > 0.0 ? mix(Ws - 2.0, max(gE, Ws + 0.5), smoothstep(0.0, 0.02, cs)) : gSeaSide(cs, Ws);
}
`;

// the sea floor as the sea sees it, anywhere: the Bay's survey (its own GLSL, bay/terrain.js)
// eased into the globe's past it, as the ground does (world/ocean.js)
export const GLOBE_SEA_GLSL = /* glsl */`
uniform float uGOn, uGBay; uniform vec2 uGF, uGSeam;
${GLOBE_GLSL}
float seaGround(vec2 p){
	float b = bayHeight(p);
	if (uGOn < 0.5) return b;
	float k = 1.0;
	if (uGBay > 0.5) {
		vec2 S0 = vec2(textureSize(uB0, 0)), q0 = (p - uR0.xy) / uR0.z;
		k = smoothstep(uGSeam.x, uGSeam.y, length(max(vec2(0.0), max(-q0, q0 - (S0 - 1.0)))) * uR0.z);
	}
	return k <= 0.0 ? b : mix(b, globeSea(p - uGF), k);
}
`;
