// The globe's ground, drawn: two rings round you like the Bay's (a fine one out to 6 km, a
// coarse one out to 250 km with a hole where the fine one is), their heights made on the GPU
// from globeheight.js, and a third, flat, for the big lakes' water. Its own material, so the
// Bay's full sampler budget is never touched: 6 textures in the vertex stage, 4 plus the
// shadow map in the fragment.
//
// Near the Bay, in the Bay's frame, it draws only past the survey (3 km out from its edge,
// where the Bay's rings stop) and there blends the Bay's own carried-out ground (beyondH)
// into the globe's over the next 22 km, as bay/terrain.js's groundAt does on the CPU.
//
// The colours are the place's: its two ground colours from the atlas, tree cover and its
// kind by warmth, rock on the steep, snow where the air at that height is cold enough the
// year round, sand at the shore, fields where it is wet enough to farm and flat enough, and
// the towns and cities (grey by day, lit by night) round the atlas's cities near you.

import * as THREE from 'three';
import { radialGrid, NOISE_GLSL } from '../world/terrain.js';
import { BAY_GLSL } from '../bay/terrain.js';
import { WC_U, WC_GLSL } from '../bay/watercarve.js';
import { BERM_U, BERM_GLSL } from '../bay/berms.js';
import { GLOBE_GLSL, OCT } from './globeheight.js';
import { photoUniform } from '../world/photomats.js';
import { RAD } from './globeframe.js';

export const SEAM_A = 3000, SEAM_B = 25000;     // m past the Bay's survey: the Bay's ground stops, the globe's is whole
const CITIES = 12;
// the photographed ground close by (the Bay's loam, as bay/terrain.js reads it)
const PH = [photoUniform('loam', { colour: true, mean: 0.5, contrast: 1.1 }), photoUniform('moss', { mean: 0.5 }), photoUniform('granite', { mean: 0.5 }), photoUniform('sand', { mean: 0.5 })];

const FRAG_GLSL = /* glsl */`
uniform highp sampler2D uGT2, uGT3, uGT4; uniform vec4 uGWin; uniform ivec3 uGI0; uniform vec3 uGF0; uniform vec2 uGSeam; uniform float uGBay, uGNight;
uniform vec4 uGHole; uniform vec4 uGCity[${CITIES}]; uniform float uGIsl, uGDebug, uGSeason;
varying vec3 vGW; varying vec3 vGN; varying vec3 vGP; varying vec4 vGC; varying vec2 vGCC; varying float vGE;
float gfH(ivec3 p, uint s){ uint h = (uint(p.x) * 374761393u) ^ (uint(p.y) * 668265263u) ^ (uint(p.z) * 2246822519u) ^ s; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h >> 8u) / 16777216.0; }
// value noise on the sphere at 8192 / 2^k metres (the same lattice as the relief)
float gfN(int k, uint s){
	float m = float(1 << k); vec3 t = uGF0 * m + vGP * m, ft = floor(t), f = t - ft, u = f * f * (3.0 - 2.0 * f);
	ivec3 i = uGI0 * (1 << k) + ivec3(ft);
	float a = gfH(i, s), b = gfH(i + ivec3(1, 0, 0), s), c = gfH(i + ivec3(0, 1, 0), s), d = gfH(i + ivec3(1, 1, 0), s);
	float e = gfH(i + ivec3(0, 0, 1), s), g = gfH(i + ivec3(1, 0, 1), s), h = gfH(i + ivec3(0, 1, 1), s), q = gfH(i + ivec3(1, 1, 1), s);
	return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, q, u.x), u.y), u.z);
}
vec3 gLin(vec3 c){ return pow(c, vec3(2.2)); }
uniform sampler2D uGLoam, uGMoss, uGRock, uGSand; uniform vec4 uGPhK, uGFd; uniform ivec2 uGFdI; uniform int uGN2, uGN3;
float gDetL = 0.5;
// the fields' survey lattice under this fragment: its 25 m unit, whole and part (fixed to the
// globe whatever the frame: globeterrain.js's update sets where the anchor falls in it)
ivec2 gQI; vec2 gQF;
// value noise on that lattice, 2^k units a cell
float gq(int k, uint s){
	ivec2 c = gQI >> k; vec2 f = (vec2(gQI - (c << k)) + gQF) / float(1 << k); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(gfH(ivec3(c, 0), s), gfH(ivec3(c.x + 1, c.y, 0), s), f.x), mix(gfH(ivec3(c.x, c.y + 1, 0), s), gfH(ivec3(c + 1, 0), s), f.x), f.y);
}
// the lattice's metres, k finer (cells 25 / 2^k m), wrapped so the noise and photos read on them
// repeat seamlessly (every 4096 cells)
vec2 gM(int k){ return (vec2(gQI & (4095 >> k)) + gQF) * float(1 << k); }
// a line's share of a pixel: d from its middle, w its half-width, fw the pixel's size (m)
float gLine(float d, float w, float fw){ return (1.0 - smoothstep(w - fw, w + fw, d)) * min(1.0, w / max(fw, 1e-3)); }
float gLum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
// a photo's light and shade about 0.5, read twice (the second larger and turned a quarter,
// mirrored) so its repeat doesn't show; once on a phone
float gPh(sampler2D t, vec2 p){
	float s = 0.0, ws = 0.0;
	for (int i = 0; i < uGN2; i++) { float w = i == 0 ? 0.6 : 0.4; s += gLum(texture(t, i == 0 ? p : p.yx * 0.3125 + 0.37).rgb) * w; ws += w; }
	return s / ws;
}
// the same on the three planes, for the rock faces (the top one only on a phone)
float gTri(sampler2D t, vec3 p, vec3 n){
	vec3 w = pow(abs(n), vec3(4.0));
	float s = 0.0, ws = 0.0;
	for (int i = 0; i < uGN3; i++) { float wi = i == 0 ? w.y : i == 1 ? w.x : w.z; s += gLum(texture(t, i == 0 ? p.xz : i == 1 ? p.zy : p.xy).rgb) * wi; ws += wi; }
	return s / max(ws, 1e-4);
}
// The farms: the survey's blocks (800 m, a quarter section) each cut into a few fields, every
// field its own crop with its rows one way, a verge round it, and along some of the blocks'
// edges a hedge or a track. soil and grass: the place's own; ripe: how far the grain has
// turned (spring 0, summer 1); dorm: the winter's bare ground; orch: the share of orchards.
// fk: the share farmed (whole fields left wild where farming thins out); bare: open soil
vec3 gFarm(float farmP, float orch, vec3 soil, vec3 grass, float ripe, float dorm, float hedgeP, float px, vec2 fq, out float fk, out float bare){
	// (the lines wander a few metres: no survey is ruled quite straight)
	vec2 w = gQF + (vec2(gq(2, 81u), gq(2, 83u)) - 0.5) * 0.6;
	ivec2 wi = gQI + ivec2(floor(w)), B = wi >> 5;
	vec2 b = (vec2(wi - (B << 5)) + fract(w)) / 32.0;
	float r0 = gfH(ivec3(B, 1), 91u), r1 = gfH(ivec3(B, 1), 93u);
	vec2 a = r0 < 0.5 ? b : b.yx;                     // a.x across the strips, a.y along them
	float n = 1.0 + floor(r1 * r1 * 4.99), t = a.x * n, si = floor(t), ts = t - si;
	float rc = gfH(ivec3(B, int(si) + 2), 97u), cutK = step(0.45, rc), cut = 0.25 + 0.5 * fract(rc * 7.31);
	int fi = int(si) * 2 + int(cutK * step(cut, a.y)) + 8;
	float id = gfH(ivec3(B, fi), 101u), id2 = gfH(ivec3(B, fi), 103u), id3 = gfH(ivec3(B, fi), 105u);
	fk = smoothstep(-0.08, 0.08, farmP - gfH(ivec3(B, fi), 107u));
	// how far to the field's edge, and to the block's (m)
	vec2 eb = min(b, 1.0 - b);
	float dB = min(eb.x, eb.y) * 800.0, dE = min(min(min(ts, 1.0 - ts) / n * 800.0, mix(1e4, abs(a.y - cut) * 800.0, cutK)), dB);
	// the rows: mostly down the field's length
	float along = (id3 < 0.75 ? a.y : a.x) * 800.0, across = (id3 < 0.75 ? a.x : a.y) * 800.0;
	// (a pixel's size along each, from the caller's derivatives: none taken in here)
	bool east = (r0 < 0.5) == (id3 < 0.75);
	float fw = max(east ? fq.x : fq.y, 1e-3), fa = max(east ? fq.y : fq.x, 1e-3);
	// through the field: wetter and drier ground, and the streaks the machines leave
	float vary = gq(0, 111u) * 0.45 + gq(2, 113u) * 0.35 + mix(0.5, vn(vec2(across / 14.0, along / 160.0) + id * 97.0), 1.0 - smoothstep(0.3, 0.6, fw / 14.0)) * 0.2;
	vec3 col; float rowA = 0.0, rowP = 1.0;
	bare = 0.0;
	if (id2 < orch) {
		// an orchard: rows of trees over bare or grassed ground
		vec2 g = vec2(across / 6.5, along / 5.5), gc = fract(g) - 0.5;
		float crown = mix(0.3, 1.0 - smoothstep(0.24, 0.36, length(gc * vec2(1.0, 1.15))), 1.0 - smoothstep(0.2, 0.45, max(fw / 6.5, fa / 5.5)));
		col = mix(mix(soil, grass, id3 * 0.8), vec3(0.035, 0.065, 0.022), crown);
		bare = 0.6 - id3 * 0.5;
	} else if (id < 0.32) {
		// row crops, the soil showing between the rows; bare till they're planted
		col = mix(mix(vec3(0.045, 0.095, 0.022), vec3(0.09, 0.14, 0.035), id3), soil, dorm * 0.85);
		rowA = 0.55; rowP = 0.76; bare = 0.35 + dorm * 0.5;
	} else if (id < 0.6) {
		// grain: green in the spring, gold by summer, some already cut to stubble; the combine's swaths
		col = mix(vec3(0.085, 0.13, 0.035), vec3(0.36, 0.27, 0.1), ripe);
		col = mix(mix(col, vec3(0.3, 0.25, 0.15), step(id3, ripe - 0.5) * 0.9), soil * 1.1, dorm * 0.6);
		rowA = 0.22; rowP = 4.5; bare = 0.15 + dorm * 0.5;
		col *= 1.0 - 0.35 * gLine(abs(fract(across / 24.0) - 0.5) * 24.0, 0.25, fw);       // the sprayer's tramlines
	} else if (id < 0.76) {
		// turned soil, in furrows
		col = soil * (0.7 + 0.25 * id3); rowA = 0.6; rowP = 0.9; bare = 1.0;
	} else {
		// grass for hay and grazing, mown in stripes
		col = grass * (0.85 + 0.35 * id3); rowA = 0.16; rowP = 9.0;
	}
	// the rows and furrows, gone to their average where a pixel holds several
	col *= 1.0 + rowA * (abs(fract(across / rowP) - 0.5) * 2.0 - 0.5) * (1.0 - smoothstep(0.2, 0.45, fw / rowP));
	col *= 0.8 + 0.4 * vary;
	// round the field a verge of rough grass; along some blocks' edges a hedge, along others a track
	col = mix(col, grass * (0.95 + 0.3 * id2), gLine(dE, 1.5 + 2.0 * id2, px) * 0.85);
	bool ex = eb.x < eb.y;
	ivec3 eid = ex ? ivec3(B.x + int(b.x > 0.5), B.y, 3) : ivec3(B.x, B.y + int(b.y > 0.5), 5);
	float ea = (ex ? b.y : b.x) * 800.0, er = gfH(eid, 121u);
	if (er < hedgeP) {
		float gap = smoothstep(0.28, 0.38, vn(vec2(ea / 40.0, er * 300.0)));
		col = mix(col, vec3(0.03, 0.055, 0.02) * (0.7 + 0.6 * mix(0.5, vn(vec2(ea / 3.0, 5.0)), 1.0 - smoothstep(1.0, 3.0, px))), gLine(dB, 1.5 + 1.5 * vn(vec2(ea / 30.0, 9.0)), px) * gap);
	} else if (er < hedgeP + 0.3) {
		float tk = gLine(abs(dB - 4.5), 1.6, px) * (1.0 - 0.6 * gLine(abs(dB - 4.5), 0.35, px));
		col = mix(col, soil * 1.5 + 0.02, tk); bare = mix(bare, 1.0, tk);
	}
	// far off: the patchwork's average, calm
	float far = smoothstep(30.0, 110.0, px);
	col = mix(col, mix(mix(vec3(0.07, 0.11, 0.03), vec3(0.22, 0.18, 0.085), ripe * 0.6 + dorm * 0.4), soil, 0.25) * (0.8 + 0.4 * gq(5, 115u)), far);
	fk = mix(fk, farmP, far);
	return col;
}
`;

export function createGlobeTerrain({ scene, data, BU, isPhone }) {
	const group = new THREE.Group();
	group.name = 'globe';
	scene.add(group);
	const U = data.U;
	const common = {
		uGSeam: U.uGSeam, uGBay: U.uGBay, uGF: U.uGF,
		uGIsl: { value: 1400 }, uGNight: { value: 0 }, uGDebug: { value: 0 }, uGCity: { value: Array.from({ length: CITIES }, () => new THREE.Vector4(0, 0, 0, 0)) },
		uGLoam: PH[0][0], uGMoss: PH[1][0], uGRock: PH[2][0], uGSand: PH[3][0], uGPhK: { value: new THREE.Vector4() },
		uGFd: { value: new THREE.Vector4() }, uGFdI: { value: new THREE.Vector2() },
		// (the photos' reads, in loops the compiler can't unroll: twice and on three planes, once on a phone)
		uGN2: { value: isPhone ? 1 : 2 }, uGN3: { value: isPhone ? 1 : 3 },
	};
	function material(grid, oct, hole) {
		const m = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
		const own = { uGGrid: { value: new THREE.Vector3(grid[1], grid[2], grid[0]) }, uGOct: { value: oct }, uGHole: { value: new THREE.Vector4(0, 0, hole ? 1 : 0, 0) }, uGOff: { value: new THREE.Vector2() } };
		m.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, BU, WC_U, BERM_U, U, common, own);
			sh.vertexShader = 'uniform vec2 uGSeam, uGF; uniform float uGBay, uGOct; uniform vec3 uGGrid;\nvarying vec3 vGW; varying vec3 vGN; varying vec3 vGP; varying vec4 vGC; varying vec2 vGCC; varying float vGE;\n' + BAY_GLSL + WC_GLSL + BERM_GLSL + GLOBE_GLSL + `
				vec3 gDP;
				float gOut(vec2 w){ if (uGBay < 0.5) return 1e9; vec2 S0 = vec2(textureSize(uB0, 0)), q0 = (w - uR0.xy) / uR0.z; return length(max(vec2(0.0), max(-q0, q0 - (S0 - 1.0)))) * uR0.z; }
				float gGround(vec2 d, float oct){
					float g = globeHeight(d, oct);
					if (uGBay > 0.5) { float o = gOut(d), k = smoothstep(uGSeam.x, uGSeam.y, o); if (k < 1.0) g = mix(beyondH(d, bLevel(uB0, uR0, d), o), g, k); }
					return g;
				}
			` + sh.vertexShader
				.replace('#include <beginnormal_vertex>', `
					vec2 gd = position.xz + uGOff;
					float gr = max(abs(position.x), abs(position.z));
					float gsp = max(0.3, 2.0 * uGGrid.y * uGGrid.x * pow(max(1e-4, pow(gr / uGGrid.x, 1.0 / uGGrid.y)), uGGrid.y - 1.0) / uGGrid.z);
					float goct = clamp(log2(${8192}.0 / (4.0 * gsp)) + 1.0, 1.0, uGOct);
					// (the normal from the height itself, across the grid's own spacing either side: the
					// relief finer than the grid is left out of it, so far ridges don't break into facets)
					float ge = max(2.0, gsp);
					float gx = gGround(gd + vec2(ge, 0.0), goct) - gGround(gd - vec2(ge, 0.0), goct), gz = gGround(gd + vec2(0.0, ge), goct) - gGround(gd - vec2(0.0, ge), goct);
					float gh = gGround(gd, goct);
					vGC = vec4(gCoast, gLake, gLevel, gOut(gd));
					vGE = gE;
					vGP = ${'vec3(0.0)'};
					{
						// (the sphere's metres again, for the fragment's patches: cheap, the angles only)
						float dph = -gd.y * uGDeg.y * ${Math.PI / 180}, dla = gd.x * uGDeg.x * ${Math.PI / 180};
						float hp = sin(dph * 0.5), hl = sin(dla * 0.5), sp = sin(dph), sl = sin(dla);
						float dcp = -2.0 * hp * hp * uGAnc.y - sp * uGAnc.x, dsp = -2.0 * hp * hp * uGAnc.x + sp * uGAnc.y;
						float dcl = -2.0 * hl * hl * uGAnc.w - sl * uGAnc.z, dsl = -2.0 * hl * hl * uGAnc.z + sl * uGAnc.w;
						vGP = ${6371000}.0 * vec3(dcp * (uGAnc.w + dcl) + uGAnc.y * dcl, dcp * (uGAnc.z + dsl) + uGAnc.y * dsl, dsp) / ${8192}.0;
					}
					vec2 gw = gd + uGF;
					// the creeks' channels (water.js) and the roads' grading (berms.js), as the ground is walked
					float gwc = wcAt(gw).r * wcK(gw) + bermDelta(gw);
					gh += gwc;
					vec3 objectNormal = normalize(vec3(-gx, 2.0 * ge, -gz));
					if (any(isnan(objectNormal))) objectNormal = vec3(0.0, 1.0, 0.0);
					if (gh != gh) gh = 0.0;
					vGN = objectNormal;
					vGCC = uGWin.xy + gd * uGWin.zw;
				`)
				.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, gh, position.z); vGW = vec3(gd.x, gh, gd.y);');
			sh.fragmentShader = NOISE_GLSL + '\n' + FRAG_GLSL + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
					if (uGBay > 0.5 && (vGC.w < uGSeam.x || max(abs(vGW.x), abs(vGW.z)) < uGIsl)) discard;          // the Bay's own ground is there
					if (uGHole.z > 0.5 && max(abs(vGW.x - uGHole.x), abs(vGW.z - uGHole.y)) < uGHole.w) discard;    // the fine ring draws here`)
				.replace('#include <color_fragment>', `#include <color_fragment>
				{
					vec3 n = normalize(vGN); float slope = 1.0 - n.y, h = vGW.y;
					float dist = length(vViewPosition), px = max(1e-3, length(fwidth(vGW.xz)));
					// patches on the sphere: 2 km, 512 m and 128 m (the finest fades out far off)
					float pB = gfN(2, 11u), pM = gfN(4, 23u), pS = mix(0.5, gfN(6, 37u), 1.0 - smoothstep(1500.0, 5000.0, dist));
					// the atlas's cells read smoothly, their edges wandering with the patches (no 11 km
					// squares; globetrees.js reads them the same way)
					vec2 uv = (vGCC + 0.5 + (vec2(pB, pM) - 0.5) * vec2(0.8, 0.15)) / vec2(textureSize(uGT3, 0));
					vec4 t2 = texture(uGT2, uv), t3 = texture(uGT3, uv), t4 = texture(uGT4, uv);
					float temp = t3.a * 255.0 / 4.0 - 30.0, rainS = t4.a * 255.0 / 4.0, rain = rainS * rainS, trees = t2.a;
					vec3 gA = gLin(t3.rgb), gB = gLin(t4.rgb);
					// the survey's lattice here, and its mottles of 25 m and 100 m
					{ vec2 q = uGFd.xy + vec2(vGW.x, -vGW.z) * uGFd.zw, f = floor(q); gQI = uGFdI + ivec2(f); gQF = q - f; }
					float m1 = gq(0, 41u), m2 = gq(2, 43u);
					// (the fine noises settle to their mean where they are finer than a pixel)
					float nk3 = 1.0 - smoothstep(0.6, 1.8, px), nk1 = 1.0 - smoothstep(0.15, 0.5, px);
					float tus = mix(0.5, vn(gM(3)), nk3) * 0.5 + m1 * 0.3 + mix(0.5, vn(gM(5) + 3.0), nk1) * 0.2;
					vec3 c = mix(gA, gB, smoothstep(0.3, 0.7, pB * 0.5 + pM * 0.3 + m2 * 0.2));
					// the grass greener where it rains; straw in a dry summer, dull in a cold winter
					float gold = (1.0 - smoothstep(350.0, 900.0, rain)) * smoothstep(-3.0, 4.0, uGSeason + (pM - 0.5) * 4.0);
					float dorm = 1.0 - smoothstep(-3.0, 6.0, temp + uGSeason + (pM - 0.5) * 2.0);
					c = mix(c, c * vec3(0.8, 1.02, 0.7), smoothstep(500.0, 1300.0, rain) * 0.5);
					c = mix(c, vec3(0.34, 0.25, 0.1) * (0.85 + 0.3 * pS), gold * 0.5);
					c = mix(c, vec3(0.2, 0.17, 0.11), dorm * 0.45);
					vec3 grass = c;
					// tussocks: clumps of a few metres in patches of tens
					c *= 0.72 + 0.56 * tus;
					// the earth showing where it is steeper or drier, between the tussocks
					vec3 soil = mix(vec3(0.15, 0.105, 0.065), gB * 0.5, 0.3) * (0.85 + 0.3 * m2);
					float bare = smoothstep(0.5, 0.8, (1.0 - smoothstep(150.0, 700.0, rain)) * 0.45 + slope * 1.6 + (tus - 0.5) * 0.7 + (m2 - 0.5) * 0.4);
					c = mix(c, soil, bare * 0.8);
					// the desert: pale ground with scrub dotted over it, crests where the atlas has dunes
					float arid = 1.0 - smoothstep(180.0, 420.0, rain);
					vec3 dsr = mix(gA, vec3(0.5, 0.42, 0.3), 0.3) * (0.88 + 0.24 * m1) * mix(1.0, 0.8 + 0.35 * smoothstep(0.6, 0.95, 1.0 - abs(2.0 * gq(1, 45u) - 1.0)), t2.r);
					float scrub = mix(0.25, smoothstep(0.62, 0.74, vn(gM(3) + 7.0)), nk3) * (1.0 - t2.r) * (0.5 + m2);
					c = mix(c, mix(dsr, vec3(0.06, 0.065, 0.045), scrub * 0.6), arid * (1.0 - bare * 0.3));
					// the air up here: the atlas's warmth is the place's lived-in ground, taken as halfway up
					// the region's mean height (plus 400 m), cooled 6.5 C a km above it (Tuolumne near 0,
					// Denver near 10)
					float air = temp - 6.5 * max(0.0, h - 400.0 - 0.5 * vGE) / 1000.0;
					// farmland: rain-fed where it is wet and warm enough, watered in the warm dry valleys; on
					// gentle ground below the high country. Trees up to the tree line, not on cliffs, and
					// thinner where the land is farmed (as globetrees.js grows them)
					float farmable = max(smoothstep(350.0, 550.0, rain) * smoothstep(3.0, 9.0, temp), smoothstep(150.0, 260.0, rain) * (1.0 - smoothstep(300.0, 600.0, h)) * smoothstep(12.0, 16.0, temp) * 0.75)
						* (1.0 - smoothstep(0.06, 0.16, slope)) * (1.0 - smoothstep(1200.0, 2200.0, h));
					float forest = smoothstep(0.44, 0.56, trees + (pM - 0.5) * 0.7 + (pS - 0.5) * 0.35 - farmable * 0.12) * smoothstep(-4.5, -2.0, air) * (1.0 - smoothstep(0.55, 0.85, slope));
					float farmP = farmable * (1.0 - forest) * (1.0 - smoothstep(0.55, 0.8, trees)) * smoothstep(0.15, 0.45, pB * 0.7 + m2 * 0.3 + 0.1);
					vec2 fq = fwidth(vec2(vGW.x, -vGW.z) * uGFd.zw) * 25.0;
					if (farmP > 0.002) {
						float fk, fb;
						vec3 fc = gFarm(farmP, smoothstep(13.0, 17.0, temp) * (1.0 - smoothstep(500.0, 900.0, rain)) * 0.45, soil, grass, smoothstep(-1.0, 5.0, uGSeason + (temp - 12.0) * 0.3), dorm,
							0.08 + 0.4 * smoothstep(0.25, 0.5, trees) * smoothstep(550.0, 800.0, rain), px, fq, fk, fb);
						c = mix(c, fc, fk); bare = mix(bare, fb, fk);
					}
					// the woods: from afar their crowns and the shade between them, close by the dark floor
					// under them, litter and moss
					vec3 wood = mix(vec3(0.028, 0.05, 0.03), vec3(0.045, 0.075, 0.025), smoothstep(4.0, 14.0, temp));
					wood = mix(wood, vec3(0.035, 0.085, 0.02), smoothstep(20.0, 26.0, temp));
					float ck = 1.0 - smoothstep(2.5, 7.0, px);
					wood *= (0.75 + 0.5 * mix(0.5, vn(gM(1)), ck)) * (1.0 - 0.45 * mix(0.3, smoothstep(0.6, 0.8, vn(gM(2) + 4.0)), ck)) * (0.85 + 0.3 * m1);
					float floorK = 1.0 - smoothstep(150.0, 450.0, dist);
					wood = mix(wood, mix(vec3(0.05, 0.035, 0.02), vec3(0.03, 0.045, 0.018), m1) * (0.75 + 0.5 * tus), floorK);
					c = mix(c, wood, forest);
					bare = mix(bare, 0.7, forest * floorK);
					// and the shade of the scattered trees in open woodland
					c *= 1.0 - 0.35 * smoothstep(0.15, 0.45, trees) * (1.0 - forest) * smoothstep(0.55, 0.7, gq(1, 47u) * 0.6 + pS * 0.4);
					// rock on the steep ground, and above the plants, banded
					float rockK = max(smoothstep(0.42, 0.7, slope + (pS - 0.5) * 0.15 + (m1 - 0.5) * 0.1), (1.0 - smoothstep(-5.0, -3.0, air)) * 0.7);
					vec3 rock = mix(vec3(0.3, 0.29, 0.27), gA * 0.8, 0.35) * (0.75 + 0.25 * m1 + 0.25 * mix(0.5, vn(vec2(gM(1).x, h * 0.25)), ck));
					c = mix(c, rock, rockK);
					// snow: the high fields' that lasts the summer, and the winter's wherever this month's
					// air is below freezing, patchier as it thaws; off the cliffs either way
					float keep = 1.0 - smoothstep(-12.0, -8.0, air + (pM - 0.5) * 3.0 + (pS - 0.5) * 2.5);
					float lying = 1.0 - smoothstep(-3.0, 0.5, air + uGSeason + (pM - 0.5) * 2.5 + (pS - 0.5) * 2.0);
					float snowK = max(keep, lying) * (1.0 - smoothstep(0.4, 0.65, slope));
					c = mix(c, vec3(0.86, 0.88, 0.92), snowK);
					// the shore: sand on the gentle ground just above the water
					float shore = (1.0 - smoothstep(0.0, 0.035, vGC.x)) * (1.0 - smoothstep(vGC.z + 2.0, vGC.z + 6.0, h)) * (1.0 - smoothstep(0.12, 0.3, slope));
					c = mix(c, mix(vec3(0.62, 0.56, 0.42), gA, 0.3), shore * step(0.0, vGC.x - 0.0));
					// under water: the bed darkens
					c = mix(c, c * vec3(0.5, 0.6, 0.6), (1.0 - smoothstep(vGC.z - 6.0, vGC.z, h)));
					// the towns and cities round you: built ground, and their lights after dark
					float urb = 0.0;
					for (int i = 0; i < ${CITIES}; i++) {
						vec4 C = uGCity[i];
						if (C.z <= 0.0) continue;
						float dd = length(vGW.xz - C.xy) / C.z;
						urb = max(urb, exp(-dd * dd * dd * 1.2) * C.w);
					}
					urb *= (1.0 - smoothstep(0.25, 0.45, slope)) * step(0.0, vGC.x);
					if (urb > 0.01) {
						// blocks of the survey's 100 m: a street round each, and in it lots of lawn, trees and
						// roofs, more paved and roofed the denser the town
						vec2 sb = fract(gM(0) * 0.25), se = min(sb, 1.0 - sb);
						float blk = gfH(ivec3(gQI >> 2, 7), 71u), street = gLine(min(se.x, se.y) * 100.0, 5.0, px);
						float dense = smoothstep(0.3, 0.9, urb + (blk - 0.5) * 0.3), nkB = 1.0 - smoothstep(2.0, 6.0, px);
						float roof = mix(0.25 + 0.35 * dense, smoothstep(0.5, 0.58, vn(gM(2)) + dense * 0.25), nkB);
						vec3 yard = mix(mix(grass, vec3(0.03, 0.05, 0.025), mix(0.3, smoothstep(0.6, 0.72, vn(gM(1) + 2.0)), nkB) * (1.0 - dense) * 0.8), vec3(0.24, 0.23, 0.22), dense * 0.6);
						vec3 built = mix(mix(yard, mix(vec3(0.2, 0.19, 0.18), vec3(0.3, 0.17, 0.11), blk), roof), vec3(0.07, 0.07, 0.075), street);
						// A city's broad footprint is only a distant land-use hint. Keep the actual
						// forest floor and snow: Manaus's 18 km footprint must not pave the jungle.
						// Constructed streets and buildings draw their own surfaces above this ground.
						float builtK = smoothstep(0.08, 0.5, urb) * (1.0 - forest) * (1.0 - snowK);
						c = mix(c, built, builtK * (1.0 - smoothstep(20000.0, 60000.0, dist) * 0.5));
						gCityGlow = vec3(1.0, 0.72, 0.4) * uGNight * smoothstep(0.1, 0.6, urb) * (0.25 + 0.75 * step(0.55, blk + street)) * 0.35;
					}
					// close by: the photographs' grain (loam on the soil, moss in the grass, sand, the rock on
					// the three planes), on the survey's lattice so it stays put when the frame moves
					vec2 pm = gM(3);
					float lL = mix(0.5, gPh(uGLoam, pm * 1.25), uGPhK.x), mL = mix(0.5, gPh(uGMoss, pm * 1.5625), uGPhK.y);
					float rL = mix(0.5, gTri(uGRock, vec3(pm.x, h * 0.32, pm.y) * 0.5, n), uGPhK.z), sL = mix(0.5, gPh(uGSand, pm * 1.25), uGPhK.w);
					float dL = mix(mix(mL, lL, bare), sL, max(arid * 0.7, shore));
					gDetL = mix(mix(dL, rL, rockK), 0.5, snowK * 0.7);
					c *= mix(1.0, 0.55 + 0.9 * gDetL, 1.0 - smoothstep(0.08, 0.5, px));
					if (any(isnan(c)) || any(isinf(c))) c = vec3(0.3);
					diffuseColor.rgb = c;
					if (uGDebug > 0.5) diffuseColor.rgb = uGDebug < 1.5 ? t3.rgb : uGDebug < 2.5 ? vec3(t3.a, t4.a, t2.a) : uGDebug < 3.5 ? vec3(fract(h / 500.0), snowK, forest) : uGDebug < 4.5 ? vec3(farmP, urb, rockK) : vec3(0.35);
				}`)
				.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				{
					// the relief finer than the grid round you, as a bump (as the Bay's ground has it)
					float d2 = length(vViewPosition), bh = 0.0;
					if (d2 < 5000.0) {
						float px = length(fwidth(vGW.xz));
						bh = fbm3(vGW.xz * 0.06) * 2.5 * (1.0 - smoothstep(4.0, 9.0, px)) + fbm3(vGW.xz * 0.3) * 0.5 * (1.0 - smoothstep(0.9, 2.2, px));
						bh *= 1.0 - smoothstep(1500.0, 5000.0, d2);
						// and the photographs' own relief, a few centimetres, close by
						bh += (gDetL - 0.5) * 0.12 * (1.0 - smoothstep(0.04, 0.25, px));
					}
					vec3 sp = -vViewPosition, vSx = dFdx(sp), vSy = dFdy(sp);
					vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
					float fDet = dot(vSx, R1);
					vec2 dH = vec2(dFdx(bh), dFdy(bh));
					vec3 nb = abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2);
					if (d2 < 5000.0 && dot(nb, nb) > 1e-20) normal = normalize(nb);
				}`)
				.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gCityGlow;');
			sh.fragmentShader = 'vec3 gCityGlow = vec3(0.0);\n' + sh.fragmentShader;
		};
		m.customProgramCacheKey = () => 'globeground2';
		m.userData.own = own;
		return m;
	}
	// the rings: n segments, the reach, how fast the spacing grows
	// (a middle ring between them, out to 40 km, so the mountains a few km off are drawn every
	// 250-500 m and not in the far ring's kilometre-wide facets; a phone makes do without it)
	const NEAR = isPhone ? [160, 6000, 2.2] : [256, 6000, 2.2], MID = [224, 40000, 2.2], FARG = isPhone ? [128, 250000, 2.8] : [192, 250000, 2.7];
	const nearMat = material(NEAR, isPhone ? 8 : OCT, false), midMat = material(MID, 8, true), farMat = material(FARG, isPhone ? 7 : 8, true);
	const near = new THREE.Mesh(radialGrid(...NEAR), nearMat), mid = new THREE.Mesh(radialGrid(...MID), midMat), far = new THREE.Mesh(radialGrid(...FARG), farMat);
	for (const m of [near, mid, far]) { m.frustumCulled = false; m.receiveShadow = true; m.userData.material175 = 'stone'; group.add(m); }
	near.visible = mid.visible = far.visible = false;

	// the big lakes' water: flat at each lake's level, only where the lake is
	const lakeMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5c, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 });
	const lakeOff = { value: new THREE.Vector2() };
	lakeMat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U, common, { uGOff: lakeOff });
		sh.vertexShader = 'uniform float uGBay; varying float vLk; varying vec2 vLd;\n' + GLOBE_GLSL + sh.vertexShader
			.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
			.replace('#include <begin_vertex>', `vec2 gd = position.xz + uGOff; float gh = globeHeight(gd, 5.0); vLk = gLake * step(gh, gLevel - 0.3) * step(1.0, gLevel); vLd = gd;
				vec3 transformed = vec3(position.x, gLevel, position.z);`);
		sh.fragmentShader = 'varying float vLk; varying vec2 vLd; uniform float uGIsl;\n' + sh.fragmentShader
			.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vLk < 0.5) discard;');
	};
	lakeMat.customProgramCacheKey = () => 'globelake1';
	const lakes = new THREE.Mesh(radialGrid(isPhone ? 96 : 160, 60000, 2.4), lakeMat);
	lakes.frustumCulled = false; lakes.visible = false; lakes.renderOrder = 1;
	group.add(lakes);

	// place the rings round the camera; bayOut: how far past the Bay's survey the camera is (m)
	function update(cam, F, { bay, bayOut, night, cities, on: may = true }) {
		const on = data.win.ready && may;
		U.uGOn.value = data.win.ready ? 1 : 0;            // (the sea reads the coasts from here too)
		const x = cam.position.x, z = cam.position.z;
		// (in the Bay's frame the fine ring is only wanted near the survey's edge and past it)
		near.visible = on && (!bay || bayOut > SEAM_A - 7000);
		far.visible = lakes.visible = on;
		mid.visible = on && !isPhone;
		if (!on) return;
		common.uGBay.value = bay ? 1 : 0;
		common.uGF.value.set(F.fx, F.fz);
		common.uGNight.value = night;
		common.uGPhK.value.set(PH[0][1].value, PH[1][1].value, PH[2][1].value, PH[3][1].value);
		// the fields' survey lattice: 25 m units east and north of (-180, -90), the east ones
		// measured at the middle of a 4-degree band of latitude (so it holds still as the frame
		// moves); where the anchor falls in it, and its scale per metre of the frame
		const band = 111320 * Math.cos(Math.round(F.lat / 4) * 4 * RAD), fu = (F.lon + 180) * band / 25, fv = (F.lat + 90) * 111320 / 25;
		common.uGFdI.value.set(Math.floor(fu), Math.floor(fv));
		common.uGFd.value.set(fu - Math.floor(fu), fv - Math.floor(fv), band / (25 * F.kx), 111320 / (25 * F.kz));
		const nx = Math.round(x / 32) * 32, nz = Math.round(z / 32) * 32, fx = Math.round(x / 512) * 512, fz = Math.round(z / 512) * 512;
		const mx = Math.round(x / 128) * 128, mz = Math.round(z / 128) * 128;
		near.position.set(nx, 0, nz); mid.position.set(mx, 0, mz); far.position.set(fx, 0, fz); lakes.position.set(fx, 0, fz);
		midMat.userData.own.uGOff.value.set(mx - F.fx, mz - F.fz);
		midMat.userData.own.uGHole.value.set(nx - F.fx, nz - F.fz, near.visible ? 1 : 0, NEAR[1] * 0.97);
		// each ring's offset from the anchor (the GPU adds its own few km to it)
		nearMat.userData.own.uGOff.value.set(nx - F.fx, nz - F.fz); farMat.userData.own.uGOff.value.set(fx - F.fx, fz - F.fz); lakeOff.value.set(fx - F.fx, fz - F.fz);
		if (mid.visible) farMat.userData.own.uGHole.value.set(mx - F.fx, mz - F.fz, 1, MID[1] * 0.97);
		else farMat.userData.own.uGHole.value.set(nx - F.fx, nz - F.fz, near.visible ? 1 : 0, NEAR[1] * 0.97);
		// the cities round you (anchor-relative: x, z, reach, how built up)
		for (let i = 0; i < CITIES; i++) { const c = cities[i]; if (c) common.uGCity.value[i].set(c.x - F.fx, c.z - F.fz, c.r, c.k); else common.uGCity.value[i].set(0, 0, 0, 0); }
	}
	return { group, update, near, mid, far, lakes, materials: [nearMat, midMat, farMat, lakeMat], debug: (v) => { common.uGDebug.value = v; } };
}
