// The real Bay Area, at true scale, around the island. Three baked height levels
// (coarse over the nine counties, finer over the core bay, finest round the Golden
// Gate) stream in after the island is up. The ground is drawn by two camera-centred
// rings displaced on the GPU and shaded as California: summer-gold grass, dark oak
// woodland on the north-facing slopes, redwood and fir in the fog belt, chaparral
// on the dry south-facing hills, rock, beaches, and the cities: street grids, roofs,
// parks, and at night the lights. The same heights serve the sea (depth, shallows),
// walking, flying and the boat.

import * as THREE from 'three';
import { radialGrid, NOISE_GLSL } from '../world/terrain.js';
import { photoUniform } from '../world/photomats.js';
import { LEVELS, LAT0, LON0, KX, KZ, H_OFF, H_SCALE, toWorld } from './geo.js';
import { PLACES } from './places.js';
import { bearingFor, styleFor, localOverride, WARP_GLSL, STYLE, sfDistrict } from './styles.js';
import { BERM_U, BERM_GLSL } from './berms.js';
import { REAL_U, REAL_GLSL } from './realcity.js';
import { CARVE_U, CARVE_GLSL, carveDelta } from './carve.js';
import { WC_U, WC_GLSL, waterDelta } from './watercarve.js';
import { COAST_U, COAST_VGLSL, COAST_FGLSL, cliffDelta, createCoastside } from './coastside.js';
import { WX_DEFS, WX_GLSL, STREET_GLSL } from './weathering.js';
import { BAY_DETAIL_U, BAY_DETAIL_GLSL, rills, detailAmp } from '../earth/baydetail.js';

// the globe past the survey (earth/globe.js): { ready(), at(x, z), seam: [a, b] (m past the
// survey's edge: the Bay's ground stops at a, the globe's is whole by b), whenReady, hideBay() }.
// Until one is set (or while its data loads) the survey's edge is carried out as before.
let farG = null;
const BSEAM_U = { uBSeam: { value: 1e9 } };
export function setFarGround(g) { farG = g; }

// ---------- the shared GLSL: height from the finest level that covers a point ----------
export const BAY_GLSL = /* glsl */`
uniform highp sampler2D uB0, uBa, uBb, uBc; uniform vec4 uR0, uRa, uRb, uRc; uniform float uBayOn;
float bLevel(highp sampler2D t, vec4 r, vec2 w){
	vec2 S = vec2(textureSize(t, 0));
	vec2 f = clamp((w - r.xy) / r.z, vec2(0.0), S - 1.001);
	ivec2 i = ivec2(floor(f)); vec2 u = fract(f);
	float a = texelFetch(t, i, 0).r, b = texelFetch(t, i + ivec2(1, 0), 0).r;
	float c = texelFetch(t, i + ivec2(0, 1), 0).r, d = texelFetch(t, i + ivec2(1, 1), 0).r;
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float bIn(highp sampler2D t, vec4 r, vec2 w, float m){
	vec2 S = vec2(textureSize(t, 0)); vec2 f = (w - r.xy) / r.z; vec2 d = min(f, S - 1.0 - f) * r.z;
	return smoothstep(0.0, 1.0, clamp(min(d.x, d.y) / m, 0.0, 1.0));
}
// beyond the surveyed land, the land goes on: the edge's own height carried outward,
// turning into valleys and ranges of the generator's own (the sea just deepens). The
// same integer hash runs on the CPU (see beyondH), so walking matches what is drawn.
uint bHash(ivec2 p){ uint h = (uint(p.x) * 374761393u) ^ (uint(p.y) * 668265263u); h = (h ^ (h >> 13u)) * 1274126177u; return h ^ (h >> 16u); }
float bH01(ivec2 p){ return float(bHash(p) >> 8u) / 16777216.0; }
float bVn(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); ivec2 k = ivec2(i);
	return mix(mix(bH01(k), bH01(k + ivec2(1, 0)), f.x), mix(bH01(k + ivec2(0, 1)), bH01(k + ivec2(1, 1)), f.x), f.y); }
float beyondH(vec2 w, float he, float d){
	if (he <= 0.0) return max(-400.0, he - d * 0.03);
	float t = smoothstep(0.0, 22000.0, d);
	float n = bVn(w / 9000.0) * 0.6 + bVn(w / 3700.0 + 17.0) * 0.3 + bVn(w / 1500.0 - 9.0) * 0.1;
	float ridge = 1.0 - abs(2.0 * bVn(w / 5200.0 + 3.0) - 1.0);
	float ranges = smoothstep(0.45, 0.8, bVn(w / 32000.0 + 7.0));
	float gen = 30.0 + n * 170.0 + ridge * ridge * 950.0 * ranges;
	return mix(he, gen, t);
}
float bayHeight(vec2 w){
	if (uBayOn < 0.5) return -60.0;
	vec2 S0 = vec2(textureSize(uB0, 0)), q0 = (w - uR0.xy) / uR0.z;
	float dOut = length(max(vec2(0.0), max(-q0, q0 - (S0 - 1.0)))) * uR0.z;
	float edge0 = bLevel(uB0, uR0, w);
	float h = mix(beyondH(w, edge0, dOut), edge0, bIn(uB0, uR0, w, 3000.0));
	// the finer surveys: the three finest round you, chosen as you move (update() below;
	// a GPU draws at most 16 textures at once, and ten levels were too many). w: the margin
	if (uRa.w > 0.0) { float k = bIn(uBa, uRa, w, uRa.w); if (k > 0.0) h = mix(h, bLevel(uBa, uRa, w), k); }
	if (uRb.w > 0.0) { float k = bIn(uBb, uRb, w, uRb.w); if (k > 0.0) h = mix(h, bLevel(uBb, uRb, w), k); }
	if (uRc.w > 0.0) { float k = bIn(uBc, uRc, w, uRc.w); if (k > 0.0) h = mix(h, bLevel(uBc, uRc, w), k); }
	return h;
}
`;

// the colour of each kind of real land use (0: leave the natural ground)
const REAL_LAND = /* glsl */`
// spring wildflowers in drifts across open grass: California poppies (orange, on the sunny
// side), lupine (blue-violet, in swales), goldfields (yellow sheets)
vec3 wildflowers(vec3 c, vec2 w, float slope){
	if (uBloom < 0.01) return c;
	float drift = smoothstep(0.44, 0.58, fbm3(w * 0.01 + 4.7)) * (1.0 - smoothstep(0.25, 0.5, slope)) * uBloom;
	// (the fine speckle fades where it would alias into stripes at a distance)
	float hiK = 1.0 - smoothstep(0.25, 0.8, length(fwidth(w * 1.7)));
	float kind = fbm3(w * 0.0035 + 13.1), speck = mix(0.5, smoothstep(0.3, 0.7, vn(w * 1.7)), hiK) * 0.5 + smoothstep(0.35, 0.65, vn(w * 0.2 + 3.0)) * 0.5;
	vec3 flower = kind < 0.45 ? vec3(0.9, 0.3, 0.02) : kind < 0.58 ? vec3(0.2, 0.16, 0.55) : vec3(0.85, 0.66, 0.05);
	return mix(c, flower, drift * (0.12 + 0.5 * speck * speck));
}
vec3 realLand(float lu, vec3 nat, float gn, float gf, vec2 w){
	vec3 lawn = mix(vec3(0.2, 0.34, 0.1), vec3(0.3, 0.41, 0.15), gn);
	vec3 dry = mix(lawn, mix(vec3(0.32, 0.22, 0.09), vec3(0.46, 0.33, 0.14), gn), uSeason);
	if (lu < 0.5 || (lu > 10.5 && lu < 12.5) || lu > 13.5) return nat;
	if (lu < 1.5) {
		// yards: lawns (a few browned off), planting beds, shade
		vec3 y = mix(lawn, dry, smoothstep(0.55, 0.8, gf) * 0.6);
		return mix(y, vec3(0.3, 0.24, 0.16), smoothstep(0.62, 0.72, vn(w * 0.35)) * 0.5);
	}
	if (lu < 2.5) return wildflowers(mix(lawn, dry, smoothstep(0.6, 0.85, gf) * 0.4), w, 0.15);
	if (lu < 3.5) return mix(vec3(0.24, 0.42, 0.13), vec3(0.3, 0.47, 0.16), step(0.5, fract(dot(w, vec2(0.6, 0.8)) / 14.0)));
	if (lu < 4.5) return mix(vec3(0.26, 0.47, 0.15), vec3(0.3, 0.52, 0.18), step(0.5, fract(w.x / 5.0)));
	if (lu < 5.5) return mix(vec3(0.52, 0.4, 0.28), vec3(0.62, 0.5, 0.36), gn);
	if (lu < 6.5) return mix(lawn, vec3(0.3, 0.3, 0.31), step(0.7, gf));
	// commercial and retail: parking with landscaped islands and borders
	if (lu < 7.5) return mix(mix(vec3(0.25, 0.25, 0.26), vec3(0.31, 0.31, 0.32), gn), lawn * 0.9, smoothstep(0.58, 0.64, vn(w * 0.05) * 0.7 + gf * 0.3));
	if (lu < 8.5) return mix(vec3(0.45, 0.44, 0.42), vec3(0.55, 0.54, 0.5), gn);
	if (lu < 9.5) return vec3(0.84, 0.79, 0.64);
	if (lu < 10.5) return vec3(0.1, 0.2, 0.22);
	// a downtown plaza: pale pavers in a running bond, a darker band now and then
	vec2 pj = fract(vec2(w.x / 1.2, w.y / 0.6 + 0.5 * step(0.5, fract(w.x / 2.4))));
	vec3 pv = mix(vec3(0.5, 0.48, 0.45), vec3(0.58, 0.56, 0.52), gn) * (0.94 + 0.08 * step(0.5, fract(floor(w.x / 1.2) * 0.37 + floor(w.y / 0.6) * 0.61)));
	pv = mix(pv, pv * 0.82, step(0.9, fract(w.x / 9.6)) * 0.7);
	float jk = (1.0 - smoothstep(0.02, 0.06, length(fwidth(w)) / 1.2)) * step(0.93, max(pj.x, pj.y));
	pv = mix(pv, pv * 0.72, jk);
	// lawns and planting beds set into it, with a stone edge
	float bed = vn(w * 0.035) * 0.75 + vn(w * 0.11 + 7.0) * 0.25;
	vec3 green = mix(lawn, vec3(0.16, 0.24, 0.1), smoothstep(0.5, 0.7, vn(w * 0.4)) * 0.6);
	pv = mix(pv, vec3(0.62, 0.6, 0.56), smoothstep(0.585, 0.6, bed) * (1.0 - smoothstep(0.6, 0.615, bed)));
	return mix(pv, green, smoothstep(0.605, 0.615, bed));
}
`;
const OFF = new THREE.Vector4(1e9, 1e9, 1, 0);
// the photographed trail surfaces (build 191), for the dirt roads and paths close by
const LOAM = photoUniform('loam', { colour: true, mean: 0.5, contrast: 1.1 }), GRAVEL = photoUniform('riverbed', { colour: true, mean: 0.52, contrast: 1.0 });

// Points of city light far off. The old sparks sat in cells whose size followed the
// camera's distance, so every step re-dealt them (static on a dead channel), and at a
// kilometre or more they were smaller than a pixel and flickered. Now the cells are
// fixed to the ground in sizes that double with distance (18 m, 36 m, ...), cross-faded
// between neighbouring sizes, and each light is a soft dot at least about a pixel wide
// whose brightness is spread rather than lost.
const SPARKS_GLSL = /* glsl */`
float sparks(vec2 w, float dist, float thr, float seed){
	float L = log2(max(dist * 0.004, 18.0) / 18.0), l0 = floor(L), t = L - l0;
	float mpp = max(1e-3, length(fwidth(w)));
	float s = 0.0;
	for (int k = 0; k < 2; k++) {
		float cl = 18.0 * exp2(l0 + float(k));
		vec2 p = w / cl;
		float d = length(fract(p) - 0.5);
		float r = max(0.18, 0.9 * mpp / cl);
		float v = step(thr, h21(floor(p) + seed + l0 + float(k))) * (1.0 - smoothstep(r * 0.4, r, d)) * min(1.0, (0.18 * 0.18) / (r * r));
		s += v * (k == 0 ? 1.0 - t : t);
	}
	return s;
}
`;

export function bayUniforms() {
	const blank = () => { const t = new THREE.DataTexture(new Uint16Array([0, 0, 0, 0]), 2, 2, THREE.RedFormat, THREE.HalfFloatType); t.needsUpdate = true; return t; };
	return { uB0: { value: blank() }, uBa: { value: blank() }, uBb: { value: blank() }, uBc: { value: blank() }, uR0: { value: OFF.clone() }, uRa: { value: OFF.clone() }, uRb: { value: OFF.clone() }, uRc: { value: OFF.clone() }, uBayOn: { value: 0 } };
}

// the towns: how far each one's streets reach, their street-grid angle, and the
// downtowns where buildings stand tall
const CBD = [[37.7925, -122.399, 1, 800], [37.7785, -122.395, 0.45, 650], [37.8044, -122.2712, 0.6, 800], [37.3337, -121.8907, 0.5, 900], [37.87, -122.268, 0.25, 500], [37.901, -122.061, 0.25, 500], [37.8313, -122.2852, 0.3, 450], [37.5630, -122.3255, 0.15, 500], [37.4443, -122.1598, 0.15, 400], [38.4404, -122.7141, 0.2, 500], [37.978, -122.031, 0.2, 500], [37.3861, -122.0839, 0.15, 500], [37.3688, -122.0363, 0.15, 500], [37.4852, -122.2364, 0.15, 400]];
// open land inside the towns: Alcatraz, Angel Island and Yerba Buena Island, San Ramon's Central Park and the Crow Canyon golf course,
// Lake Merritt, and in San Francisco the parks, the Presidio, the hills
const PARKS = [[37.8267, -122.4230, 420, 320, 0], [37.8609, -122.4326, 1500, 1500, 0], [37.8103, -122.3636, 650, 550, 0], [37.7650, -121.9522, 260, 200, 0], [37.7880, -121.9720, 500, 350, 0.15], [37.8290, -122.2600, 600, 450, 0], [37.7690, -122.4830, 2600, 450, 0], [37.7989, -122.4662, 1500, 1100, 0.06], [37.7544, -122.4477, 700, 700, 0], [37.7580, -122.4570, 600, 600, 0], [37.7200, -122.4950, 800, 900, 0], [37.7180, -122.4200, 700, 500, 0.5], [37.7850, -122.5050, 500, 400, 0], [37.8320, -122.5050, 2700, 1500, 0], [37.7560, -122.5095, 260, 3200, 0], [37.7683, -122.4410, 240, 190, 0], [37.7433, -122.4146, 330, 240, 0], [37.7385, -122.4545, 270, 230, 0]];      // ... the Marin Headlands, Ocean Beach's sand, Buena Vista, Bernal Heights, Mt Davidson
// San Francisco's planted woods seen from above (Monterey cypress, pine and eucalyptus): the
// groves on Mt Sutro, Mt Davidson and Buena Vista, the Presidio's forest (patchy: over 700 m
// across), Lands End, Glen Canyon. Golden Gate Park and Stern Grove are woods too (realcity.js
// GREENS). [lat, lon, half-width east, half-width north]
const WOODS = [[37.7585, -122.4590, 430, 330], [37.7385, -122.4545, 260, 220], [37.7683, -122.4410, 230, 180], [37.7925, -122.4640, 950, 520], [37.7845, -122.5020, 480, 220], [37.7405, -122.4415, 160, 330]];
// the lawns and meadows in them: the Polo Field, Speedway and Lindley Meadows, Sharon
// Meadow, Big Rec, the Bison Paddock, the golf course and the Beach Chalet fields, Stern
// Grove's concert meadow
const MEADOWS = [[37.7681, -122.4925, 240, 145], [37.7688, -122.4868, 230, 70], [37.7684, -122.4902, 110, 55], [37.7694, -122.4560, 150, 80], [37.7669, -122.4637, 170, 80], [37.7697, -122.4984, 150, 60], [37.7688, -122.5066, 210, 120], [37.7356, -122.4768, 130, 60]];
// and the lakes: Stow Lake (a ring round Strawberry Hill: w < 0), Spreckels, Lloyd, Elk
// Glen, Middle and North Lakes, Metson, Stern Grove's Pine Lake
const LAKES = [[37.7686, -122.4756, 280, 215, -1], [37.7706, -122.4958, 150, 60, 1], [37.7703, -122.4832, 60, 35, 1], [37.7676, -122.4888, 85, 40, 1], [37.7694, -122.5031, 100, 60, 1], [37.7718, -122.5052, 170, 65, 1], [37.7688, -122.4946, 60, 38, 1], [37.7369, -122.4905, 110, 45, 1]];
const ellipses = (L) => L.map(([lat, lon, rx, rz, f]) => { const w = toWorld(lat, lon); return new THREE.Vector4(w.x, w.z, rx, rz * (f || 1)); });
const WOODS_U = { uWoods: { value: ellipses(WOODS) }, uMeadow: { value: ellipses(MEADOWS) }, uLake: { value: ellipses(LAKES) } };

// The wild woods as city.js grows them (wildLand): woodland gathers on the north faces and
// down the draws, in groves, from the same value noise (the integer hash of BAY_GLSL, so the
// ground's canopy is where the trees stand). Its floor is drawn under them.
const WOODS_GLSL = /* glsl */`
uniform vec4 uWoods[6], uMeadow[8], uLake[8]; uniform vec3 uSunDir;
uint wHash(ivec2 p){ uint h = (uint(p.x) * 374761393u) ^ (uint(p.y) * 668265263u); h = (h ^ (h >> 13u)) * 1274126177u; return h ^ (h >> 16u); }
float wH01(ivec2 p){ return float(wHash(p) >> 8u) / 16777216.0; }
float wVn(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); ivec2 k = ivec2(i);
	return mix(mix(wH01(k), wH01(k + ivec2(1, 0)), f.x), mix(wH01(k + ivec2(0, 1)), wH01(k + ivec2(1, 1)), f.x), f.y); }
// how much of the sky the wild trees close over a point (0 open .. 1 closed canopy)
float wildCanopy(vec2 w, vec3 n, float h, float gully){
	float ny = max(n.y, 0.05), slope = length(n.xz) / ny;
	float north = clamp(-n.z / ny * 4.0, -1.0, 1.0), high = clamp((h - 350.0) / 600.0, 0.0, 1.0);
	float grove = wVn(w / 140.0) * 0.7 + wVn(w / 45.0 + vec2(9.0, 3.0)) * 0.3;
	float wood = clamp((0.08 + north * 0.55 + gully * 0.7 + slope * 0.2 - high * 0.15) * (0.25 + grove * 1.5), 0.0, 1.0);
	return smoothstep(0.12, 0.55, wood * 0.8) * smoothstep(2.5, 5.0, h) * (1.0 - smoothstep(0.95, 1.15, slope));
}
// a planted wood seen from above: crowns of cypress and pine near black-green, stands of
// eucalyptus a greyer olive, shadow between the crowns (each fading to its average where it
// is finer than a pixel)
vec3 parkWood(vec2 w){
	float ck = 1.0 - smoothstep(0.3, 1.0, length(fwidth(w * 0.11)));
	float crown = mix(0.5, vn(w * 0.11), ck), gap = mix(0.3, smoothstep(0.62, 0.8, vn(w * 0.23 + 4.0)), ck);
	vec3 cyp = mix(vec3(0.022, 0.045, 0.026), vec3(0.05, 0.085, 0.042), crown);
	vec3 euc = mix(vec3(0.055, 0.07, 0.048), vec3(0.1, 0.11, 0.072), crown);
	vec3 col = mix(cyp, euc, smoothstep(0.42, 0.6, fbm3(w * 0.006 + 5.0)));
	return col * (1.0 - 0.45 * gap) * (0.85 + 0.3 * fbm3(w * 0.02 + 1.7));
}
`;
// A tiling photo read without its repeat showing: a second read, turned and scaled by an
// irrational ratio, is blended in and out by slow noise, with the blend's contrast restored
// about the photo's own mean m.
const TILE2_GLSL = /* glsl */`
// (the ground's grain: the loam photo's own light and shade, about 0.9, so it needs no
// texture of its own; a GPU draws at most 16 at once)
float loamGrain(vec2 uv){ return 0.9 + (dot(texture2D(uLoam, uv).rgb, vec3(0.299, 0.587, 0.114)) - 0.5) * 0.82; }
float tile2(vec2 uv, float m){
	float k = smoothstep(0.25, 0.75, vn(uv * 0.173 + 2.9));
	vec2 uv2 = mat2(0.809, -0.588, 0.588, 0.809) * uv * 0.786 + vec2(0.37, 0.61);
	float v = mix(loamGrain(uv), loamGrain(uv2), k);
	return m + (v - m) / sqrt(k * k + (1.0 - k) * (1.0 - k));
}
`;
const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

// the CPU twin of the GLSL above
function bHash(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
const bH01 = (x, y) => (bHash(x, y) >>> 8) / 16777216;
function bVn(x, y) {
	const i = Math.floor(x), j = Math.floor(y); let u = x - i, v = y - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
	const a = bH01(i, j), b = bH01(i + 1, j), c = bH01(i, j + 1), d = bH01(i + 1, j + 1);
	return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function beyondH(x, z, he, d) {
	if (he <= 0) return Math.max(-400, he - d * 0.03);
	const t = sstep(0, 22000, d);
	const n = bVn(x / 9000, z / 9000) * 0.6 + bVn(x / 3700 + 17, z / 3700 + 17) * 0.3 + bVn(x / 1500 - 9, z / 1500 - 9) * 0.1;
	const r = 1 - Math.abs(2 * bVn(x / 5200 + 3, z / 5200 + 3) - 1);
	const ranges = sstep(0.45, 0.8, bVn(x / 32000 + 7, z / 32000 + 7));
	return he + (30 + n * 170 + r * r * 950 * ranges - he) * t;
}

export function createBayArea(shared, scene, island, BU) {
	const levels = [];                       // CPU copies: { x0, zN, step, W, H, v: Uint16Array }
	const group = new THREE.Group();
	group.name = 'bayarea';
	scene.add(group);

	// ---------- the urban map (250 m cells): R density, G street angle, B downtown, A style ----------
	const U = { x0: 0, zN: 0, cell: 250, W: 0, H: 0, data: null, tex: null };
	const cityPts = PLACES.filter((p) => p[4] > 0).map((p) => { const w = toWorld(p[1], p[2]); return { ...w, r: 380 * Math.pow(p[4], 0.45), ang: bearingFor(p[0], hashStr(p[0])), style: styleFor(p[0], p[3]), name: p[0] }; });
	// the neighbourhoods a town's single point misses: San Ramon's Dougherty Valley, Windemere
	// and Gale Ranch, built out across the valley to the east of the old town
	for (const [lat, lon, r] of [[37.7650, -121.9150, 2300], [37.7520, -121.9120, 1500], [37.7760, -121.9050, 1400], [37.7650, -121.9600, 1900]]) cityPts.push({ ...toWorld(lat, lon), r, ang: bearingFor('San Ramon', 0), style: STYLE.suburb, name: 'San Ramon' });
	const cbds = CBD.map((c) => ({ ...toWorld(c[0], c[1]), s: c[2], r: c[3] }));
	const parks = PARKS.map((c) => ({ ...toWorld(c[0], c[1]), rx: c[2], rz: c[3], keep: c[4] }));

	// ---------- the towns beyond the survey: seeded, named, on the generated land ----------
	const SYL = [['San', 'Santa', 'Los', 'El', 'Port', 'Mount', 'North', 'West', 'Lake', 'Fort', '', '', '', '', '', ''], ['Ro', 'Ma', 'Vale', 'Cor', 'Al', 'Bel', 'Ter', 'Ash', 'Mer', 'Wil', 'Or', 'Sil', 'Ced', 'Lin', 'Mon', 'Pal', 'Riv', 'Hol', 'Kes', 'Bran'], ['ena', 'ton', 'dale', 'wood', 'ville', 'ita', 'mont', 'ford', 'ero', 'ridge', 'burg', 'ada', 'field', 'oro', 'side', 'crest', 'ino', 'brook', 'lan', 'dos']];
	const towns = [];
	function makeTowns(L, M) {
		const G = 7000;
		for (let z = L.zN - M; z < L.zN + (L.H - 1) * L.step + M; z += G) for (let x = L.x0 - M; x < L.x0 + (L.W - 1) * L.step + M; x += G) {
			const gx = Math.round(x / G), gz = Math.round(z / G), r0 = bH01(gx * 7 + 3, gz * 13 + 1);
			if (r0 > 0.26) continue;                                                   // open country between the towns
			const tx = x + (bH01(gx, gz * 5) - 0.5) * G * 0.8, tz = z + (bH01(gx * 3, gz) - 0.5) * G * 0.8;
			// only out beyond the surveyed land
			const qx = (tx - L.x0) / L.step, qz = (tz - L.zN) / L.step;
			const dOut = Math.hypot(Math.max(0, -qx, qx - (L.W - 1)), Math.max(0, -qz, qz - (L.H - 1))) * L.step;
			if (dOut < 4000) continue;
			const h = heightAt(tx, tz), sl = Math.abs(heightAt(tx + 400, tz) - heightAt(tx - 400, tz)) + Math.abs(heightAt(tx, tz + 400) - heightAt(tx, tz - 400));
			if (h < 3 || h > 420 || sl > 90) continue;
			const r1 = bH01(gx * 11, gz * 17 + 5), r2 = bH01(gx + 91, gz - 37);
			const name = (SYL[0][Math.floor(r1 * 16)] + ' ' + SYL[1][Math.floor(r2 * 20)] + SYL[2][Math.floor(bH01(gx - 5, gz + 9) * 20)]).trim();
			const big = r0 < 0.05, r = big ? 2600 + r1 * 1800 : 700 + r1 * r1 * 1800;
			const t = { x: tx, z: tz, r, ang: r2 * Math.PI / 2, style: r2 < 0.62 ? STYLE.suburb : STYLE.older, name, pop: Math.round(r * r / 180), big };
			towns.push(t);
			cityPts.push(t);
			if (big) cbds.push({ x: tx, z: tz, s: 0.18 + r2 * 0.2, r: 500 + r1 * 300 });
		}
	}
	function buildUrban() {
		const L = levels[0];
		// the town map reaches past the survey, for the generated towns out there
		const M = 50000;
		if (!towns.length) makeTowns(L, M);
		U.x0 = L.x0 - M; U.zN = L.zN - M;
		U.W = Math.ceil(((L.W - 1) * L.step + 2 * M) / U.cell); U.H = Math.ceil(((L.H - 1) * L.step + 2 * M) / U.cell);
		const dens = new Float32Array(U.W * U.H), best = new Float32Array(U.W * U.H), ang = new Float32Array(U.W * U.H), sty = new Uint8Array(U.W * U.H).fill(STYLE.suburb);
		for (const c of cityPts) {
			const R = c.r * 1.8, i0 = Math.max(0, Math.floor((c.x - R - U.x0) / U.cell)), i1 = Math.min(U.W - 1, Math.ceil((c.x + R - U.x0) / U.cell));
			const j0 = Math.max(0, Math.floor((c.z - R - U.zN) / U.cell)), j1 = Math.min(U.H - 1, Math.ceil((c.z + R - U.zN) / U.cell));
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const x = U.x0 + (i + 0.5) * U.cell, z = U.zN + (j + 0.5) * U.cell;
				const d = Math.hypot(x - c.x, z - c.z) / c.r, v = Math.exp(-d * d * d * 1.1);          // towns fill out to an edge, not a haze
				const k = j * U.W + i;
				dens[k] = Math.max(dens[k], v) + v * 0.15;
				if (v > best[k]) { best[k] = v; ang[k] = c.ang; sty[k] = c.style; }
			}
		}
		const data = new Uint8Array(U.W * U.H * 4);
		for (let j = 0; j < U.H; j++) for (let i = 0; i < U.W; i++) {
			const x = U.x0 + (i + 0.5) * U.cell, z = U.zN + (j + 0.5) * U.cell, k = j * U.W + i;
			if (dens[k] < 0.004) { data[k * 4 + 3] = STYLE.suburb * 40; continue; }                    // open country
			const h = heightAt(x, z), hx = heightAt(x + 120, z), hz = heightAt(x, z + 120);
			const slope = Math.hypot(hx - h, hz - h) / 120;
			// towns climb gentle ground, not the mountains, cliffs or the water
			let u = Math.min(1, dens[k] * 1.1) * (h > 0.6 ? 1 : 0) * (1 - smooth(0.12, 0.3, slope)) * (1 - smooth(220, 360, h));
			for (const p of parks) { const dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz; if (dx * dx + dz * dz < 1) u *= p.keep; }
			let down = 0;
			for (const c of cbds) { const d = Math.hypot(x - c.x, z - c.z) / c.r; down = Math.max(down, c.s * Math.exp(-d * d)); }
			const lo = localOverride(x, z, sty[k], ang[k]);
			// Chinatown and North Beach stay low beside the towers; Nob Hill is mid-rise
			if (lo.style === STYLE.sf) { const dd = sfDistrict(x, z); if (dd === 'chinatown' || dd === 'northbeach') down = 0; else if (dd === 'nobhill') down *= 0.3; }
			// the zoned districts are built up even where no town centre is near
			if (lo.style >= STYLE.office && h > 0.6 && slope < 0.15) u = Math.max(u, 0.85);
			data[k * 4] = Math.round(u * 255); data[k * 4 + 1] = Math.round(lo.angle / (Math.PI / 2) * 255) % 256; data[k * 4 + 2] = Math.round(Math.min(1, down) * 255 * (u > 0.1 ? 1 : 0)); data[k * 4 + 3] = lo.style * 40;
		}
		U.data = data;
		U.tex = new THREE.DataTexture(data, U.W, U.H, THREE.RGBAFormat, THREE.UnsignedByteType);
		U.tex.magFilter = THREE.LinearFilter; U.tex.minFilter = THREE.LinearFilter;
		U.tex.needsUpdate = true;
		uUrban.value = U.tex;
		uUR.value.set(U.x0, U.zN, U.cell, 0);
	}
	const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
	function urbanAt(x, z) {
		if (!U.data) return { u: 0, a: 0, d: 0, s: STYLE.suburb };
		const i = Math.floor((x - U.x0) / U.cell), j = Math.floor((z - U.zN) / U.cell);
		if (i < 0 || j < 0 || i >= U.W || j >= U.H) return { u: 0, a: 0, d: 0, s: STYLE.suburb };
		const k = (j * U.W + i) * 4;
		return { u: U.data[k] / 255, a: U.data[k + 1] / 255 * Math.PI / 2, d: U.data[k + 2] / 255, s: Math.round(U.data[k + 3] / 40) };
	}

	// the town map's density, bilinear (the GPU's bdUrban twin)
	function urbanBil(x, z) {
		if (!U.data) return 0;
		const fx = (x - U.x0) / U.cell - 0.5, fz = (z - U.zN) / U.cell - 0.5;
		if (fx < 0 || fz < 0 || fx >= U.W - 1 || fz >= U.H - 1) return 0;
		const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = (j * U.W + i) * 4, D = U.data, R = U.W * 4;
		return ((D[k] * (1 - u) + D[k + 4] * u) * (1 - v) + (D[k + R] * (1 - u) + D[k + R + 4] * u) * v) / 255;
	}

	// ---------- heights on the CPU ----------
	function levelH(L, x, z) {
		let fx = (x - L.x0) / L.step, fz = (z - L.zN) / L.step;
		fx = Math.min(Math.max(fx, 0), L.W - 1.001); fz = Math.min(Math.max(fz, 0), L.H - 1.001);
		const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * L.W + i, V = L.v;
		const a = V[k], b = V[k + 1], c = V[k + L.W], d = V[k + L.W + 1];
		return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) / H_SCALE - H_OFF;
	}
	function levelIn(L, x, z, m) {
		const fx = (x - L.x0) / L.step, fz = (z - L.zN) / L.step;
		const d = Math.min(fx, L.W - 1 - fx, fz, L.H - 1 - fz) * L.step;
		return smooth(0, 1, Math.min(1, Math.max(0, d / m)));
	}
	// the ground as surveyed; heightAt adds the cliffs steepened near you (coastside.js)
	function groundAt(x, z) {
		if (!levels[0]) return -60;
		const L0 = levels[0], e0 = levelH(L0, x, z);
		const qx = (x - L0.x0) / L0.step, qz = (z - L0.zN) / L0.step;
		const dOut = Math.hypot(Math.max(0, -qx, qx - (L0.W - 1)), Math.max(0, -qz, qz - (L0.H - 1))) * L0.step;
		const inS = levelIn(L0, x, z, 3000);
		let h = beyondH(x, z, e0, dOut) + (e0 - beyondH(x, z, e0, dOut)) * inS;
		// past the survey the globe's ground takes over (earth/globe.js; the same blend on the GPU)
		if (farG?.ready()) { const k = sstep(farG.seam[0], farG.seam[1], dOut); if (k > 0) h += (farG.at(x, z) - h) * k; }
		if (levels[1]) { const k = levelIn(levels[1], x, z, 1500); if (k > 0) h += (levelH(levels[1], x, z) - h) * k; }
		if (levels[2]) { const k = levelIn(levels[2], x, z, 500); if (k > 0) h += (levelH(levels[2], x, z) - h) * k; }
		let fine = 0;
		for (let i = 3; i < levels.length; i++) if (levels[i]) { const k = levelIn(levels[i], x, z, 400); if (k > 0) { h += (levelH(levels[i], x, z) - h) * k; if (levels[i].step <= 16) fine = Math.max(fine, k); } }
		if (levels[2]?.step <= 16) fine = Math.max(fine, levelIn(levels[2], x, z, 500));
		// the engine's relief finer than the survey (earth/baydetail.js)
		const wet = waterDelta(x, z);
		if (inS > 0 && h >= 3 && BAY_DETAIL_U.uBDAmp.value > 0) {
			const sl = Math.hypot(levelH(L0, x + 40, z) - e0, levelH(L0, x, z + 40) - e0) / 40;
			const a = detailAmp(inS, sl, h, urbanBil(x, z), wet, fine);
			if (a > 0) h += rills(x, z) * a;
		}
		return h + carveDelta(x, z) + wet;
	}
	const heightAt = (x, z) => groundAt(x, z) + cliffDelta(x, z);

	// ---------- loading ----------
	async function loadLevel(i) {
		const L = LEVELS[i];
		const url = new URL(`../assets/bayarea/${L.name}.png`, import.meta.url);
		const blob = await (await fetch(url)).blob();
		const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
		const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
		const cx = cv.getContext('2d', { willReadFrequently: true });
		cx.drawImage(bmp, 0, 0);
		const px = cx.getImageData(0, 0, bmp.width, bmp.height).data;
		const W = bmp.width, H = bmp.height, v = new Uint16Array(W * H), half = new Uint16Array(W * H);
		for (let k = 0; k < W * H; k++) { v[k] = px[k * 4] * 256 + px[k * 4 + 1]; half[k] = THREE.DataUtils.toHalfFloat(v[k] / H_SCALE - H_OFF); }
		const x0 = (L.lon[0] - LON0) * KX, zN = -(L.lat[1] - LAT0) * KZ;
		levels[i] = { x0, zN, step: L.step, W, H, v, tex: null };
		const tex = new THREE.DataTexture(half, W, H, THREE.RedFormat, THREE.HalfFloatType);
		tex.minFilter = tex.magFilter = THREE.NearestFilter;
		tex.needsUpdate = true;
		levels[i].tex = tex;
		if (i === 0) { BU.uB0.value = tex; BU.uR0.value.set(x0, zN, L.step, 0); }
		slotsAt = null;
		if (i === 0) { BU.uBayOn.value = 1; await Promise.race([farG?.whenReady || Promise.resolve(), new Promise((ok) => setTimeout(ok, 8000))]); buildUrban(); }
	}
	// the whole Bay Area coarse first, then the finer levels nearest the island first
	const order = [0, ...LEVELS.map((L, i) => i).slice(1).sort((a, b) => {
		const d = (L) => { const c = toWorld((L.lat[0] + L.lat[1]) / 2, (L.lon[0] + L.lon[1]) / 2); return Math.hypot(c.x, c.z); };
		return d(LEVELS[a]) - d(LEVELS[b]);
	})];
	const ready = (async () => { for (const i of order) { try { await loadLevel(i); } catch (e) { console.warn('bay level', i, e); } } })();

	// ---------- the ground ----------
	const uUrban = { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) }, uUR = { value: new THREE.Vector4(0, 0, 1, 0) };
	// cos and sin of each street angle byte, computed here in double precision: GPU sin() and
	// cos() are only good to a few parts in a million, and times 80 km of coordinate that is metres
	const rotLUT = new Float32Array(256 * 4);
	for (let i = 0; i < 256; i++) { const a = i / 255 * Math.PI / 2; rotLUT[i * 4] = Math.cos(a); rotLUT[i * 4 + 1] = Math.sin(a); }
	const uRot = { value: new THREE.DataTexture(rotLUT, 256, 1, THREE.RGBAFormat, THREE.FloatType) };
	uRot.value.needsUpdate = true;
	uUrban.value.needsUpdate = true;
	const uNightB = { value: 0 };
	function groundMaterial(hole) {
		const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
		const U2 = { uC: { value: new THREE.Vector2() }, uHoleC: { value: new THREE.Vector2() }, uHole: { value: hole ? 1 : 0 }, uIslHalf: { value: island.half - 10 } };
		m.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, BU, U2, REAL_U, BERM_U, CARVE_U, WC_U, WOODS_U, COAST_U, BAY_DETAIL_U, BSEAM_U, { uSunDir: shared.uSunDir, uUrban, uUR, uRot, uNightB, uTime: shared.uTime, uWet: shared.uWet || { value: 0 }, uLoam: LOAM[0], uGravel: GRAVEL[0], uTrailK: LOAM[1], uGroundK: LOAM[1] });
			sh.vertexShader = (hole ? '#define CLIFF(w) 0.0\n' : '#define CLIFF(w) cliffDelta(w)\n') + 'uniform vec2 uC; uniform float uHole;\nvarying vec2 vBW; varying float vBH; varying vec3 vBN; varying vec3 vCurv; varying float vBOut;\n' + BAY_GLSL + BERM_GLSL + CARVE_GLSL + WC_GLSL + COAST_VGLSL + BAY_DETAIL_GLSL + '\nfloat cvK = 1.0, wvK = 1.0, bdK = 1.0;\nfloat gradedHeight(vec2 w){ float b = bayHeight(w); vec2 wc = wcAt(w); return b + (bdK > 0.0 ? bayDetail(w, b, wc.r) * bdK : 0.0) + CLIFF(w) + bermDelta(w) + (cvK > 0.0 ? carveAt(w).r * cvK : 0.0) + (wvK > 0.0 ? wc.r * wvK : 0.0); }\n' + sh.vertexShader
				.replace('#include <beginnormal_vertex>', `
					vec2 bw = position.xz + uC;
					// (the river's channel carved finer than the survey, carve.js: near you, where the
					// grid is fine enough to hold it)
					cvK = 1.0 - smoothstep(1600.0, 3200.0, length(position.xz));
					// (the engine's relief finer than the survey, earth/baydetail.js: the near ring only)
					bdK = uHole > 0.5 ? 0.0 : 1.0 - smoothstep(2400.0, 3600.0, length(position.xz));
					// (and the creeks' channels and the lakes' shores, water.js: near you)
					wvK = wcK(bw);
					// (the ground as graded for the roads near you: berms.js)
					float bh = gradedHeight(bw);
					// (how far past the survey: past the seam the globe's ground draws, earth/globeterrain.js)
					{ vec2 S0 = vec2(textureSize(uB0, 0)), q0 = (bw - uR0.xy) / uR0.z; vBOut = length(max(vec2(0.0), max(-q0, q0 - (S0 - 1.0)))) * uR0.z; }
					float be = max(3.0, length(position.xz) * 0.006);
					vec3 objectNormal = normalize(vec3(gradedHeight(bw - vec2(be, 0.0)) - gradedHeight(bw + vec2(be, 0.0)), 2.0 * be, gradedHeight(bw - vec2(0.0, be)) - gradedHeight(bw + vec2(0.0, be))));
					vBN = objectNormal;
					// the lie of the land about the point, for its colours: how far it sits below the
					// ground round it (a draw, a fold) or above it (a spur), at the scale city.js grows
					// its woods by (18 m, as its gully: x) and at the scale of a hill (y, -1..1); and
					// (near you) whether the open ocean lies just to windward, where the bluffs are
					// wind-scoured (z)
					float bc = bh - bermDelta(bw) - (cvK > 0.0 ? carveAt(bw).r * cvK : 0.0) - (wvK > 0.0 ? wcAt(bw).r * wvK : 0.0), ge = max(18.0, be), fe = max(110.0, be * 4.0);
					float lapG = bayHeight(bw + vec2(ge, 0.0)) + bayHeight(bw - vec2(ge, 0.0)) + bayHeight(bw + vec2(0.0, ge)) + bayHeight(bw - vec2(0.0, ge)) - 4.0 * bc;
					float lapF = (bayHeight(bw + vec2(fe, 0.0)) + bayHeight(bw - vec2(fe, 0.0)) + bayHeight(bw + vec2(0.0, fe)) + bayHeight(bw - vec2(0.0, fe))) * 0.25 - bc;
					float windS = 0.0;
					if (uHole < 0.5 && bw.x < 58000.0) {
						windS = max(step(bayHeight(bw - vec2(900.0, 0.0)), -2.0), step(bayHeight(bw - vec2(2200.0, 0.0)), -2.0));
						if (bw.x < 12000.0) windS = max(windS, step(bayHeight(bw + vec2(0.0, 1500.0)), -2.0));
					}
					vCurv = vec3(lapG * (324.0 / (ge * ge)) / 6.0, clamp(lapF / (0.04 * fe + 2.0), -1.0, 1.0), windS);`)
				.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, bh, position.z); vBW = bw; vBH = bh;');
			sh.fragmentShader = WX_DEFS + 'uniform sampler2D uUrban, uRot; uniform vec4 uUR; uniform float uNightB, uIslHalf, uHole, uTime, uWet, uTrailK, uGroundK; uniform sampler2D uLoam, uGravel; uniform vec2 uHoleC; uniform float uBSeam;\nvarying vec2 vBW; varying float vBH; varying vec3 vBN; varying vec3 vCurv; varying float vBOut;\nvec3 cityGlow = vec3(0.0); float flatK = 0.0;\n' + NOISE_GLSL + '\n' + SPARKS_GLSL + '\n' + WARP_GLSL + '\n' + REAL_GLSL + '\n' + WX_GLSL + STREET_GLSL + '\n' + CARVE_GLSL + '\n' + WC_GLSL + '\n' + REAL_LAND + '\n' + WOODS_GLSL + '\n' + TILE2_GLSL + '\n' + COAST_FGLSL + '\n' + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
					if (max(abs(vBW.x), abs(vBW.y)) < uIslHalf) discard;                           // the island draws itself
					if (uHole > 0.5 && max(abs(vBW.x - uHoleC.x), abs(vBW.y - uHoleC.y)) < 3900.0) discard;   // the near ring draws here
					if (vBOut > uBSeam) discard;                                                            // the globe's ground from here out`)
				.replace('#include <color_fragment>', `#include <color_fragment>
				{
					vec3 n = normalize(vBN); float slope = 1.0 - n.y, h = vBH;
					float n1 = fbm3(vBW * 0.0025), n2 = fbm3(vBW * 0.021);
					// (the 4 m speckle settles to its mean where it is finer than a pixel, so far
					// hills do not shimmer)
					float n3 = mix(0.5, vn(vBW * 0.23), 1.0 - smoothstep(0.35, 0.9, length(fwidth(vBW * 0.23))));
					// the broadest wash of all, kilometres across: some hillsides a little greener or
					// browner, lighter or darker, so no two valleys wear the same coat
					float macro = vn(vBW * 0.00053 + 3.7);
					// the San Mateo coast (coastside.js): how far in from the sea; the terraces by it are
					// open grass and fields, green in the fog, not woods or chaparral
					float csD = csSea(vBW);
					float csOpen = (1.0 - smoothstep(900.0, 2200.0, csD)) * (1.0 - smoothstep(60.0, 150.0, h));
					float csGreen = (1.0 - smoothstep(1500.0, 3400.0, csD)) * (1.0 - smoothstep(160.0, 330.0, h)) * 0.85;
					// the fog belt: the coast ranges and the west-facing hills stay green and wooded
					float fogbelt = 1.0 - smoothstep(22000.0, 58000.0, vBW.x);
					float north = clamp(-n.z * 2.2, 0.0, 1.0) * smoothstep(0.04, 0.25, slope);
					float south = clamp(n.z * 2.2, 0.0, 1.0) * smoothstep(0.08, 0.3, slope);
					// the grass: green in the rainy season, gold by summer (uSeason 0..1)
					// (in linear light: tawny gold, not the pale beige that tone mapping turns to sand)
					vec3 gold = mix(vec3(0.3, 0.19, 0.075), vec3(0.47, 0.31, 0.12), n2) * (0.84 + 0.32 * fbm3(vBW * 0.0011 + 7.3));
					// broad patches: grazed short and browner, ungrazed taller and paler, olive where
					// there is a little more water
					gold = mix(gold, vec3(0.26, 0.22, 0.09), smoothstep(0.52, 0.72, fbm3(vBW * 0.0045 + 3.1)) * 0.55);
					gold = mix(gold, gold * vec3(1.12, 1.05, 0.9), smoothstep(0.55, 0.75, fbm3(vBW * 0.013 + 9.7)) * 0.6);
					gold *= 0.9 + 0.2 * n3;
					gold *= mix(vec3(0.9, 0.93, 1.02), vec3(1.08, 1.02, 0.9), macro);
					vec3 spring = mix(vec3(0.2, 0.36, 0.07), vec3(0.33, 0.47, 0.1), n2 * 0.7 + macro * 0.3) * (0.9 + 0.2 * n3);
					float season = clamp(uSeason - uSeasonLag * fogbelt, 0.0, 1.0);
					gold = mix(spring, gold, clamp(season + (n1 - 0.5) * 0.3 + slope * 0.4 * season, 0.0, 1.0));
					if (uCsRow.w > 0.5 && csGreen > 0.0) gold = mix(gold, csGrass(vBW, n2, n3, macro), csGreen);
					vec3 c = gold;
					// the small watered city parks stay green all summer: lawns, and dark groves of
					// cypress and eucalyptus (the big ones are woods: below)
					for (int i = 2; i < 4; i++) {
						vec2 gq = abs(vBW - uGreen[i].xy) / uGreen[i].zw;
						float gk = 1.0 - smoothstep(0.85, 1.0, max(gq.x, gq.y));
						if (gk > 0.0) c = mix(c, mix(mix(vec3(0.16, 0.3, 0.07), vec3(0.22, 0.36, 0.1), n2), vec3(0.05, 0.1, 0.04), smoothstep(0.5, 0.62, n1 + n3 * 0.1) * 0.85), gk);
					}
					// spring wildflowers in drifts across the open grass: California poppies (orange,
					// on the sunny side), lupine (blue-violet, in swales), goldfields (yellow sheets)
					c = wildflowers(c, vBW, slope);
					float chap = south * smoothstep(0.2, 0.5, n1 + slope * 0.6) * (1.0 - fogbelt * 0.4) * (1.0 - csOpen);
					c = mix(c, mix(vec3(0.085, 0.1, 0.045), vec3(0.14, 0.15, 0.075), n3), chap * 0.85);          // chaparral: dark olive scrub
					float oak = smoothstep(0.42, 0.68, n1 + north * 0.4 + fogbelt * 0.12 - south * 0.15 + (n2 - 0.5) * 0.3) * (1.0 - csOpen);
					c = mix(c, mix(vec3(0.12, 0.16, 0.07), vec3(0.19, 0.23, 0.11), n3), oak * 0.88);
					float forest = smoothstep(0.5, 0.74, n1 * 0.5 + north * 0.45 + fogbelt * 0.55) * smoothstep(12.0, 120.0, h) * (1.0 - csOpen);
					c = mix(c, mix(vec3(0.05, 0.1, 0.05), vec3(0.08, 0.14, 0.07), n3), forest * 0.92);
					// rock where it is steep, in its own region's colour (the naturalist's geology)
					vec3 rockC = mix(vec3(0.27, 0.24, 0.19), vec3(0.4, 0.36, 0.29), n2);
					float rkMax = 0.0;
					for (int i = 0; i < 8; i++) { float rk = 1.0 - smoothstep(uRock[i].z * 0.6, uRock[i].z, distance(vBW, uRock[i].xy)); rockC = mix(rockC, uRockC[i] * (0.75 + 0.5 * n2), rk); rkMax = max(rkMax, rk); }
					// where the rock is its own, it breaks out of the grass on the moderate slopes too
					float outcrop = rkMax * smoothstep(0.6, 0.76, n2 + n3 * 0.15) * smoothstep(0.12, 0.3, slope);
					// the rock's own life: moss on its north faces in the damp, pale crusts of lichen,
					// and near the sea the bright orange Xanthoria on the bird-perch tops
					float lichS = smoothstep(0.62, 0.72, vn(vBW * 1.9)) * (0.4 + 0.6 * fogbelt);
					rockC = mix(rockC, vec3(0.3, 0.32, 0.26), lichS * 0.6);
					rockC = mix(rockC, vec3(0.62, 0.3, 0.04), smoothstep(0.7, 0.78, vn(vBW * 2.7 + 5.0)) * fogbelt * (1.0 - smoothstep(10.0, 60.0, h)) * 0.8);
					rockC = mix(rockC, vec3(0.05, 0.1, 0.02), north * fogbelt * smoothstep(0.4, 0.7, n3) * 0.75);
					c = mix(c, rockC, max(smoothstep(0.5, 0.85, slope), outcrop));
					// the grazed hills' own marks: cattle trails worn along the contours on the 20-35
					// degree grass (thin, faint, gone where they would be finer than a pixel), bands of
					// rock breaking out along the strata on the steeper faces, and dark brush down the
					// gullies
					{
						float openG = (1.0 - chap) * (1.0 - oak) * (1.0 - forest) * (1.0 - smoothstep(0.3, 0.6, slope));
						float ct = h / 1.9 + (vn(vBW * 0.004) - 0.5) * 3.0;
						float ctA = 1.0 - smoothstep(0.15, 0.35, fwidth(ct));
						float cattle = (1.0 - smoothstep(0.0, 0.12, abs(fract(ct) - 0.5) * 2.0 - 0.86)) * smoothstep(0.06, 0.09, slope) * (1.0 - smoothstep(0.18, 0.24, slope));
						c = mix(c, c * vec3(0.8, 0.76, 0.7), cattle * ctA * openG * 0.5 * smoothstep(0.45, 0.6, vn(vBW * 0.006 + 2.0)));
						float st = h / 11.0 + (vn(vBW * 0.0025) - 0.5) * 4.0;
						float band = smoothstep(0.78, 0.9, sin(st * 6.2832) * 0.5 + 0.5) * (1.0 - smoothstep(0.2, 0.4, fwidth(st))) * smoothstep(0.12, 0.22, slope);
						c = mix(c, rockC, band * 0.55 * smoothstep(0.4, 0.6, vn(vBW * 0.01 - 4.0)));
						float gb = smoothstep(0.3, 0.7, clamp(vCurv.x, 0.0, 1.0)) * openG;
						c = mix(c, mix(vec3(0.07, 0.09, 0.04), vec3(0.11, 0.13, 0.06), n3), gb * 0.6);
					}
					// the fog forest's floor: moss and duff, green on the shady side
					c = mix(c, mix(vec3(0.045, 0.09, 0.02), vec3(0.08, 0.05, 0.03), n3), forest * fogbelt * (0.25 + north * 0.5) * (1.0 - smoothstep(0.5, 0.85, slope)));
					// the weather's work on the open ground: rills and gullies down the bare steep
					// slopes (along the fall line: the nearest of four compass lines to it), cut banks
					// in the draws, scree fanned below the rock, the drainages dark and wet, the high
					// ridges scoured pale by the wind
					float pxE = length(fwidth(vBW)), gullyE = clamp(vCurv.x, 0.0, 1.0);
					{
						float bare = (1.0 - chap) * (1.0 - forest) * (1.0 - oak * 0.7);
						vec3 soil = mix(vec3(0.3, 0.2, 0.12), vec3(0.44, 0.31, 0.19), n2) * (0.85 + 0.3 * n3);
						float erK = bare * smoothstep(0.2, 0.38, slope) * (1.0 - smoothstep(0.7, 0.9, slope)) * smoothstep(0.4, 0.65, vn(vBW * 0.006 + 5.0) + slope * 0.3);
						if (erK > 0.01 && pxE < 2.0) {
							vec2 fall = normalize(n.xz + vec2(1e-4, 0.0));
							float th = mod(atan(fall.y, fall.x) / 0.7853982, 4.0), b0 = floor(th), bt = smoothstep(0.25, 0.75, th - b0);
							float rl = 0.0;
							for (int k = 0; k < 2; k++) {
								float a = (b0 + float(k)) * 0.7853982;
								vec2 d = vec2(cos(a), sin(a));
								float al = dot(vBW, d), ac = dot(vBW, vec2(-d.y, d.x));
								float r = max(wxLine(vn(vec2(al * 0.07, ac * 0.75) + float(k) * 7.0), 0.07), wxLine(vn(vec2(al * 0.025, ac * 0.2) + 3.0), 0.05) * 1.3);
								rl += r * (k == 0 ? 1.0 - bt : bt);
							}
							c = mix(c, soil, erK * 0.45);
							c = mix(c, soil * vec3(0.62, 0.55, 0.5), clamp(rl, 0.0, 1.0) * erK);
							wxBump -= clamp(rl, 0.0, 1.0) * erK * 0.12;
						}
						// cut banks: the steep sides of the draws, bare soil
						c = mix(c, soil * 0.8, smoothstep(0.3, 0.7, gullyE) * smoothstep(0.3, 0.5, slope) * (1.0 - smoothstep(0.8, 1.0, slope)) * 0.6);
						// scree: moderately steep ground at the foot of the steeper, where the rock is
						float screeK = smoothstep(0.3, 0.42, slope) * (1.0 - smoothstep(0.6, 0.75, slope)) * smoothstep(0.02, 0.3, vCurv.y) * smoothstep(0.45, 0.65, vn(vBW * 0.02) * 0.6 + rkMax * 0.35 + smoothstep(250.0, 700.0, h) * 0.3) * (1.0 - forest);
						if (screeK > 0.01) {
							vec2 sq = mod(vBW, 1024.0) * 2.5 + (vn(vBW * 1.1) - 0.5) * 0.8;
							vec2 sf = fract(sq); float gap = min(min(sf.x, 1.0 - sf.x), min(sf.y, 1.0 - sf.y));
							float fineS = 1.0 - smoothstep(0.08, 0.25, pxE);
							vec3 screeC = mix(rockC * 1.1, vec3(0.42, 0.4, 0.37), 0.4) * mix(1.0, 0.7 + 0.6 * h21(floor(sq)), fineS);
							screeC *= 1.0 - fineS * 0.45 * (1.0 - smoothstep(0.04, 0.12, gap));
							c = mix(c, screeC, screeK * 0.85);
							wxBump += screeK * fineS * smoothstep(0.0, 0.2, gap) * 0.06;
						}
						// the drainages: dark, wet soil in the bottoms of the draws
						float drain = smoothstep(0.35, 0.8, gullyE) * (1.0 - smoothstep(0.15, 0.35, slope)) * step(2.0, h);
						c *= 1.0 - drain * (0.25 + 0.15 * uWet);
						wxDamp = drain;
						wxPud = drain * smoothstep(0.7 - uWet * 0.3, 0.75 - uWet * 0.3, vn(vBW * 0.3)) * smoothstep(0.1, 0.4, uWet);
						// the wind-scoured ridges: grass cropped pale, gravelly bare patches
						float ridgeK = smoothstep(0.15, 0.5, -vCurv.y) * smoothstep(250.0, 650.0, h) * bare;
						c = mix(c, c * vec3(1.1, 1.06, 0.98) + 0.02, ridgeK * 0.4);
						c = mix(c, mix(rockC, soil, 0.5) * 1.1, ridgeK * smoothstep(0.62, 0.75, vn(vBW * 0.05 + 2.0)) * 0.7);
					}
					// the towns' map (below), and how far off this is
					vec2 uu = (vBW - uUR.xy) / uUR.z;
					vec2 US = vec2(textureSize(uUrban, 0));
					vec4 T = texture2D(uUrban, uu / US);
					float dist = length(cameraPosition - vec3(vBW.x, vBH, vBW.y));
					// San Francisco's planted woods: Golden Gate Park and Stern Grove (with their
					// meadows, lawns and lakes), and the groves on the hills and in the Presidio
					float plantedK = 0.0;
					for (int i = 0; i < 2; i++) { vec2 gq = abs(vBW - uGreen[i].xy) / uGreen[i].zw; plantedK = max(plantedK, 1.0 - smoothstep(0.85, 1.0, max(gq.x, gq.y))); }
					float woodK = plantedK;
					for (int i = 0; i < 6; i++) {
						vec2 wq = (vBW - uWoods[i].xy) / uWoods[i].zw;
						float wk = 1.0 - smoothstep(0.75, 1.0, length(wq) + (fbm3(vBW * 0.012 + float(i) * 7.1) - 0.5) * 0.5);
						if (uWoods[i].z > 700.0) wk *= smoothstep(0.42, 0.56, fbm3(vBW * 0.004 + 3.3));
						woodK = max(woodK, wk);
					}
					if (woodK > 0.0) {
						vec3 wc = parkWood(vBW);
						// close by, where the trees themselves stand (city.js), the ground under them:
						// needles and leaf litter, ivy
						vec3 underC = mix(vec3(0.075, 0.055, 0.035), vec3(0.06, 0.1, 0.035), smoothstep(0.45, 0.62, vn(vBW * 0.15)));
						wc = mix(wc, underC, 1.0 - smoothstep(900.0, 2200.0, dist));
						// open lawn in glades and the meadows; the lakes, dark still water with reeds
						// round the edge (Stow Lake a ring round its hill)
						float mead = smoothstep(0.64, 0.72, fbm3(vBW * 0.007 + 2.3)) * 0.8, lake = 0.0;
						for (int i = 0; i < 8; i++) {
							vec2 mq = (vBW - uMeadow[i].xy) / uMeadow[i].zw;
							mead = max(mead, 1.0 - smoothstep(0.82, 1.0, length(mq) + (vn(vBW * 0.03 + float(i) * 5.0) - 0.5) * 0.2));
							float lr = length((vBW - uLake[i].xy) / abs(uLake[i].zw)) + (vn(vBW * 0.05 + float(i) * 3.0) - 0.5) * 0.12;
							float lk = 1.0 - smoothstep(0.9, 1.0, lr);
							if (uLake[i].w < 0.0) lk *= smoothstep(0.55, 0.65, lr);
							lake = max(lake, lk);
						}
						wc = mix(wc, mix(vec3(0.14, 0.27, 0.065), vec3(0.21, 0.33, 0.095), n2) * (0.9 + 0.2 * vn(vBW * 0.05)), mead);
						wc = mix(wc, mix(vec3(0.03, 0.055, 0.055), vec3(0.1, 0.13, 0.06), 1.0 - smoothstep(0.6, 1.0, lake)), smoothstep(0.0, 0.3, lake));
						c = mix(c, wc, woodK * (1.0 - smoothstep(0.5, 0.85, slope)));
					}
					// the wild woods' floor where their trees stand (far off the ground's own colours
					// stand in for their canopy): under redwood and Douglas-fir in the fog belt, dark
					// red-brown duff of fallen needles with soft patches of redwood sorrel; under the
					// inland oak, bay and buckeye, paler leaf litter. Not in the towns or the mapped
					// yards, and on the wind-scoured bluffs by the sea only down in the draws.
					float wildOK = 1.0 - smoothstep(0.03, 0.08, T.r);
					if (inRealAny(vBW)) {
						wildOK = 1.0;
						if (inReal(vBW)) {
							vec4 M0 = texelFetch(uRealMap, ivec2(clamp((vBW - uRealR.xy) / uRealR.z, vec2(0.0), vec2(textureSize(uRealMap, 0)) - 1.0)), 0);
							float lu0 = floor(M0.g * 255.0 / 16.0 + 0.5);
							wildOK = (lu0 < 0.5 || (lu0 > 10.5 && lu0 < 12.5) ? 1.0 : 0.0) * (1.0 - smoothstep(0.15, 0.25, max(M0.r, M0.b)));
						}
					}
					float gully = clamp(vCurv.x, 0.0, 1.0);
					wildOK *= (1.0 - plantedK) * (1.0 - vCurv.z * step(0.5, fogbelt) * (1.0 - smoothstep(0.4, 0.9, gully)));
					float duffK = wildCanopy(vBW, n, h, gully) * wildOK * (1.0 - smoothstep(1800.0, 2700.0, dist));
					if (duffK > 0.0) {
						float hiK = 1.0 - smoothstep(0.25, 0.8, length(fwidth(vBW * 4.3)));
						vec3 duff = mix(vec3(0.075, 0.042, 0.026), vec3(0.12, 0.068, 0.04), vn(vBW * 0.9)) * (0.8 + 0.4 * mix(0.5, vn(vBW * 4.3), hiK));
						float sorrel = smoothstep(0.56, 0.7, vn(vBW * 0.16) * 0.7 + vn(vBW * 0.9 + 3.0) * 0.3) * (0.5 + 0.5 * north);
						duff = mix(duff, vec3(0.05, 0.1, 0.025), sorrel * 0.75);
						vec3 litter = mix(vec3(0.17, 0.125, 0.07), vec3(0.24, 0.18, 0.1), vn(vBW * 0.7)) * (0.85 + 0.3 * mix(0.5, vn(vBW * 3.1), hiK));
						duff = mix(litter, duff, smoothstep(0.45, 0.7, fogbelt));
						// leaf and needle litter drifted deep in the hollows, fresh and pale on top
						duff = mix(duff, mix(vec3(0.2, 0.12, 0.06), vec3(0.28, 0.2, 0.09), vn(vBW * 1.7)), smoothstep(0.2, 0.6, gullyE) * (1.0 - smoothstep(0.3, 0.5, slope)) * 0.6);
						// roots bared where the slope has washed out from under them
						float rootK = smoothstep(0.28, 0.5, slope) * smoothstep(0.45, 0.65, vn(vBW * 0.07 + 8.0));
						#ifndef WX_LITE
						if (rootK > 0.0 && pxE < 0.2) {
							vec2 rq = mod(vBW, 1024.0);
							float root = max(wxLine(vn(rq * vec2(0.9, 0.35) + 2.0), 0.025), wxLine(vn(rq * vec2(0.35, 0.9) + 6.0), 0.02));
							duff = mix(duff, vec3(0.2, 0.14, 0.09) * (0.8 + 0.4 * vn(rq * 6.0)), root * rootK);
							wxBump += root * rootK * 0.05;
						}
						#endif
						// the crowns' shade: little of the sun reaches the floor of a closed wood
						c = mix(c, duff * (1.0 - 0.3 * duffK), duffK);
					}
					// sand at the water's edge, mud and sand under water
					float beach = (1.0 - smoothstep(1.2, 5.0, h)) * (1.0 - smoothstep(0.08, 0.25, slope)) * step(-0.5, h);
					c = mix(c, vec3(0.8, 0.74, 0.6), beach);
					c = mix(c, vec3(0.4, 0.38, 0.31), smoothstep(0.3, -1.5, h));
					// the coast's cliffs, coves, lip, links and farms
					if (uCsRow.w > 0.5 && csD < 5000.0) c = coastSide(c, vBW, h, slope, csD, smoothstep(0.03, 0.08, T.r), dist, n2, n3);
					// the river's banks (carve.js): wet gravel and sand at the water, the green of the
					// willows' ground and the levees' grass, the paved path along the top
					vec4 cv = carveAt(vBW);
					if (cv.g + cv.b + cv.a > 0.004) {
						float cn = vn(vBW * 0.31), cm = vn(vBW * 0.07);
						vec3 grav = mix(vec3(0.33, 0.3, 0.25), vec3(0.5, 0.46, 0.38), cn) * (0.85 + 0.3 * cm);
						vec3 bankG = mix(vec3(0.12, 0.2, 0.06), vec3(0.2, 0.28, 0.1), cn);
						bankG = mix(bankG, mix(vec3(0.3, 0.26, 0.12), vec3(0.4, 0.34, 0.16), cm), uSeason * 0.35 * smoothstep(0.4, 0.7, cm));
						vec3 pave = mix(vec3(0.34, 0.33, 0.32), vec3(0.42, 0.41, 0.39), vn(vBW * 0.9));
						c = mix(c, bankG, clamp(cv.b, 0.0, 1.0));
						c = mix(c, grav, clamp(cv.g, 0.0, 1.0));
						c = mix(c, pave, clamp(cv.a, 0.0, 1.0));
					}
					// the towns: a street grid at the town's own angle, roofs, trees, parks
					float urban = T.r * (1.0 - smoothstep(0.25, 0.4, slope)) * smoothstep(0.4, 1.5, h) * (1.0 - clamp((cv.g + cv.b + cv.a) * 2.0, 0.0, 1.0));
					if (inRealAny(vBW)) {
						// the real city: land use, then streets and roofs from the maps
						urban = 0.0;
						bool mainR = inReal(vBW);
						vec2 mu = (vBW - uRealR.xy) / uRealR.z;
						vec2 MS = vec2(textureSize(uRealMap, 0));
						vec4 M = mainR ? texture2D(uRealMap, (mu + 0.5) / MS) : vec4(0.0);
						float gn = vn(vBW * 0.09), gf = fbm3(vBW * 0.03);
						float flatten = 1.0 - smoothstep(0.25, 0.45, slope);
						// land use, blended across the four nearest 8 m cells so its edges are soft
						vec2 mf = mu - 0.5, mi = floor(mf), mw = mf - mi;
						vec3 luC = vec3(0.0); float luW = 0.0;
						for (int k = 0; k < 4; k++) {
							vec2 o = vec2(float(k & 1), float(k >> 1));
							float lu = floor(texelFetch(uRealMap, ivec2(clamp(mi + o, vec2(0.0), MS - 1.0)), 0).g * 255.0 / 16.0 + 0.5);
							float wk = smoothstep(0.0, 1.0, (o.x > 0.5 ? mw.x : 1.0 - mw.x) * (o.y > 0.5 ? mw.y : 1.0 - mw.y));
							luC += realLand(lu, c, gn, gf, vBW) * wk; luW += wk;
						}
						if (mainR) c = mix(c, luC / max(luW, 1e-4), flatten);
						// far away: roofs and streets from the 8 m map (up close the buildings stand here)
						float farK = smoothstep(1500.0, 2200.0, dist);
						c = mix(c, mix(vec3(0.5, 0.42, 0.38), vec3(0.42, 0.42, 0.44), gn), M.b * farK * 0.9);
						// the streets: from the fine road map round you, the coarser one beyond it, the
						// 8 m map beyond that. The road maps hold distance to each edge (0.5 on it),
						// so a cut at 0.5 gives crisp, straight edges at any range.
						vec2 ru = (vBW - uRoadR.xy) / uRoadR.z, ru2 = (vBW - uRoadR2.xy) / uRoadR2.z;
						float e1 = uRoadR.w * smoothstep(0.0, 0.08, min(min(ru.x, ru.y), min(1.0 - ru.x, 1.0 - ru.y)));
						float e2 = uRoadR2.w * smoothstep(0.0, 0.05, min(min(ru2.x, ru2.y), min(1.0 - ru2.x, 1.0 - ru2.y)));
						vec4 D1 = texture2D(uRoadMap, clamp(ru, 0.0, 1.0)), D2 = texture2D(uRoadMap2, clamp(ru2, 0.0, 1.0));
						vec4 PM = texture2D(uPaintMap, clamp(ru, 0.0, 1.0));
						float Y1 = PM.r;
						vec4 f1 = max(fwidth(D1) * 0.75, vec4(0.004)), f2 = max(fwidth(D2) * 0.75, vec4(0.004));
						vec4 C1 = smoothstep(0.5 - f1, 0.5 + f1, D1), C2 = smoothstep(0.5 - f2, 0.5 + f2, D2);
						float px = length(fwidth(vBW));
						// a trail's edge is never a clean line: close by it frays into the ground
						C1.b = mix(C1.b, smoothstep(0.3, 0.85, D1.b + (vn(vBW * 1.9) - 0.5) * 0.35), 1.0 - smoothstep(30.0, 60.0, dist));
						float fy = max(fwidth(Y1) * 0.75, 0.004), yellow = smoothstep(0.5 - fy, 0.5 + fy, Y1) * e1;
						vec4 RM = mix(C2 * e2, C1, e1);
						float edge = max(e1, e2);
						float asph = mix(M.r * 0.85, RM.r, edge), conc = RM.g * edge, dirt = RM.b * edge;
						float white = C1.a * e1;
						vec3 asphC = mix(vec3(0.16, 0.16, 0.17), vec3(0.24, 0.24, 0.25), vn(vBW * 0.7)) * (0.9 + 0.2 * gf);
						asphC = mix(asphC, vec3(0.1), step(0.985, vn(vBW * 3.1)) * 0.5);                      // patched cracks
						vec3 concC = mix(vec3(0.6, 0.59, 0.55), vec3(0.7, 0.69, 0.65), vn(vBW * 1.3));
						vec3 dirtC = mix(vec3(0.56, 0.42, 0.3), vec3(0.66, 0.52, 0.38), vn(vBW * 0.8)) * (0.85 + 0.3 * gn);
						dirtC = mix(dirtC, dirtC * 0.8, step(0.7, vn(vBW * 6.0)) * 0.5);                       // stones and ruts
						// close by, the trail is real ground: packed loam, and gravel where it washes
						if (dirt > 0.01 && uTrailK > 0.5 && dist < 90.0) {
							vec3 lo = texture2D(uLoam, vBW * 0.45).rgb, gr = texture2D(uGravel, vBW * 0.6 + 0.37).rgb;
							vec3 ph = mix(lo, gr, smoothstep(0.45, 0.75, vn(vBW * 0.07)) * 0.8);
							dirtC = mix(dirtC, ph * vec3(1.08, 1.0, 0.92), (1.0 - smoothstep(45.0, 90.0, dist)) * 0.85);
						}
						c = mix(c, dirtC, dirt);
						// the trail's edges: roots bared where the feet and the rain have worn it down
						// under the trees, and after rain, water standing in its ruts
						#ifndef WX_LITE
						if (dirt > 0.01 && duffK > 0.05 && dist < 60.0) {
							vec2 rq = mod(vBW, 1024.0);
							float root = wxLine(vn(rq * vec2(0.8, 0.8) + 4.0), 0.03) * (1.0 - smoothstep(0.35, 0.9, dirt)) * smoothstep(0.05, 0.3, dirt + 0.2) * smoothstep(0.45, 0.6, vn(vBW * 0.2));
							c = mix(c, vec3(0.2, 0.14, 0.09) * (0.8 + 0.4 * vn(rq * 5.0)), root * duffK);
						}
						#endif
						wxPud = max(wxPud, dirt * smoothstep(0.78 - uWet * 0.25, 0.82 - uWet * 0.25, vn(vBW * 0.4) * 0.7 + vn(vBW * 1.6) * 0.3) * smoothstep(0.1, 0.4, uWet));
						// a freeway's concrete: the wheel paths worn dark, the slab joints
						float fwyK = smoothstep(0.08, 0.14, PM.g) * e1;
						concC *= mix(1.0, 0.8, fwyK) * (1.0 - 0.2 * smoothstep(0.45, 0.8, PM.g) * e1);
						concC = mix(concC, concC * vec3(1.02, 1.0, 0.95), fwyK);
						c = mix(c, concC, conc);
						// the gutter: a darker band just inside the asphalt edge; the kerb: a pale lip
						// just outside it (the fine map's distance, 0.5 m ramp: d = (0.5 - v) metres)
						float dK = 0.5 - D1.r;
						float kerb = smoothstep(-0.02, 0.02, dK) * (1.0 - smoothstep(0.14, 0.18, dK)) * step(0.5, D1.g) * e1;
						float gutter = smoothstep(-0.45, -0.3, dK) * (1.0 - smoothstep(-0.02, 0.0, dK)) * step(0.5, D1.g) * e1;
						// the streets' years close by (weathering.js), from the paint map's green: each lane
						// a tent (0.07 at its middle to 0 at 1.8 m), patches at 0.2, covers at 0.28
						float lk = 0.0, trk = 0.0;
						if (asph > 0.01 && dist < 400.0) {
							float lg = PM.g * e1, lw = max(fwidth(lg), 1e-4);
							lk = smoothstep(0.003, 0.012, lg) * (1.0 - smoothstep(0.075, 0.09, lg));
							float ld = 1.8 * (1.0 - clamp(lg / 0.07, 0.0, 1.0));
							float noFwy = 1.0 - smoothstep(0.32, 0.34, lg);
							float cov = smoothstep(0.24 - lw, 0.24 + lw, lg) * noFwy;
							float pat = smoothstep(0.1 - lw, 0.1 + lw, lg) * noFwy * (1.0 - cov);
							asphC = asphaltAge(asphC, vBW, ld, lk, pat, cov, px, gutter);
							trk = lk * exp(-(ld - 0.85) * (ld - 0.85) * 10.0);
							wxGloss *= asph; wxPudA *= asph;
						}
						if (conc > 0.01 && dist < 250.0 && fwyK < 0.5) {
							float seam = max(1.0 - smoothstep(0.04, 0.16, abs(D1.g - 0.5)), 1.0 - smoothstep(0.04, 0.16, abs(dK))) * e1;
							c = mix(c, walkAge(concC, vBW, px, seam), conc);
						}
						c = mix(c, asphC, asph);
						c = mix(c, c * 0.7, gutter);
						if (gutter > 0.01 && dist < 200.0) c = gutterAge(c, vBW, gutter * smoothstep(-0.45, 0.0, dK), px);
						// (roots have heaved the kerb here and there, and the weeds come up along it)
						c = mix(c, vec3(0.76, 0.75, 0.72) * (0.8 + 0.2 * vn(vBW * 0.9)), kerb);
						// the paint worn thin and polished off where the tyres cross it
						float paintK = (1.0 - 0.6 * trk) * (0.7 + 0.3 * vn(vBW * 0.6)) * mix(0.85, 0.55 + 0.45 * step(0.35, h21(floor(mod(vBW, 1024.0) * 12.0))), 1.0 - smoothstep(0.02, 0.06, px));
						c = mix(c, vec3(0.88, 0.88, 0.84), white * 0.92 * paintK);
						c = mix(c, vec3(0.86, 0.68, 0.16), yellow * 0.92 * paintK);
						flatK = max(max(asph, conc), dirt * 0.6);
						// night: windows and lamps as sparks far off
						float spark = sparks(vBW, dist, 0.8, 0.0) * max(M.b, M.r);
						cityGlow = vec3(1.0, 0.72, 0.4) * spark * smoothstep(600.0, 3000.0, dist) * uNightB * 2.4;
					}
					if (urban > 0.02){
						vec4 TX = texelFetch(uUrban, ivec2(clamp(uu, vec2(0.0), US - 1.0)), 0);
						float sty = floor(TX.a * 255.0 / 40.0 + 0.5);
						vec2 cs = texelFetch(uRot, ivec2(int(TX.g * 255.0 + 0.5), 0), 0).xy;
						vec2 g = vec2(cs.x * vBW.x + cs.y * vBW.y, cs.x * vBW.y - cs.y * vBW.x) + streetWarp(vBW, sty);
						vec3 BK = blockOf(sty);
						vec2 B = BK.xy, f = fract(g / B), cid = floor(g / B);
						vec2 fw = f * B;
						// (no streets painted at the ragged fringe where no blocks are built: on a hillside
						// at a grazing angle they read as rows of dots)
						float street = (1.0 - step(BK.z, fw.x) * step(BK.z, fw.y)) * smoothstep(0.14, 0.3, urban);
						float sidewalk = (1.0 - street) * (1.0 - step(BK.z + 2.5, fw.x) * step(BK.z + 2.5, fw.y) * step(fw.x, B.x - 2.5) * step(fw.y, B.y - 2.5)) * smoothstep(0.14, 0.3, urban);
						float lh = h21(floor(g / 17.0) + cid * 7.0);
						vec3 cityC;
						float down = T.b;
						if (sty < 1.5) {
							// San Francisco: flat roofs lot by lot, tar-and-gravel grey, white and tan (their
							// average where a lot is finer than a few pixels), the odd back garden, and
							// along the street the shadow of each row's front
							float lotK = 1.0 - smoothstep(0.25, 0.7, length(fwidth(g)) / 7.6);
							float lot = h21(vec2(floor(fw.x / 7.6), step(0.5, f.y)) + cid * 3.0);
							vec3 roofF = lot < 0.4 ? mix(vec3(0.34, 0.34, 0.35), vec3(0.44, 0.43, 0.42), lh) : lot < 0.78 ? mix(vec3(0.58, 0.57, 0.54), vec3(0.7, 0.68, 0.64), lh) : mix(vec3(0.5, 0.43, 0.34), vec3(0.6, 0.51, 0.4), lh);
							roofF = mix(vec3(0.48, 0.47, 0.45), roofF, lotK);
							// back gardens down the middle of each block
							float yard = step(abs(fw.y / B.y - 0.5), 0.12) * step(0.45, h21(floor(g / 8.0)));
							cityC = mix(roofF, vec3(0.22, 0.3, 0.14), yard * (sty > 0.5 ? 0.5 : 0.8));
							float edgeD = min(min(fw.x - BK.z, B.x - fw.x), min(fw.y - BK.z, B.y - fw.y));
							cityC *= mix(0.86, mix(0.7, 1.0, smoothstep(0.0, 5.0, edgeD)), lotK);
						} else if (sty < 2.5) {
							// older towns: dark shingle roofs under a heavy canopy of street trees
							vec3 roofO = mix(vec3(0.33, 0.31, 0.3), vec3(0.5, 0.42, 0.36), lh);
							float canopy = smoothstep(0.45, 0.75, fbm3(g * 0.08) + h21(floor(g / 7.0)) * 0.3);
							cityC = mix(mix(vec3(0.28, 0.36, 0.18), roofO, step(0.55, h21(floor(g / 14.0)))), vec3(0.12, 0.2, 0.09), canopy * 0.8);
						} else if (sty < 3.5) {
							// the suburbs: green lawns, pale driveways, terracotta and grey roofs
							float lot = floor(fw.x / 18.0), row = step(0.5, fw.y / B.y);
							float roofMask = smoothstep(900.0, 1400.0, dist) * step(0.3, fract(fw.x / 18.0)) * step(fract(fw.x / 18.0), 0.9) * step(0.22, abs(fw.y / B.y - 0.5)) * step(abs(fw.y / B.y - 0.5), 0.42);
							vec3 roofS = h21(vec2(lot, row) + cid * 3.0) > 0.45 ? mix(vec3(0.62, 0.34, 0.24), vec3(0.72, 0.44, 0.3), lh) : mix(vec3(0.4, 0.38, 0.36), vec3(0.52, 0.49, 0.45), lh);
							vec3 lawn = mix(vec3(0.3, 0.42, 0.16), vec3(0.42, 0.46, 0.2), vn(g * 0.1));
							cityC = mix(lawn, roofS, roofMask);
							cityC = mix(cityC, vec3(0.13, 0.2, 0.09), step(0.8, h21(floor(g / 6.0) + 11.0)) * (1.0 - roofMask) * 0.8);
						} else if (sty > 4.5 && sty < 5.5) {
							// industry: long pale warehouse roofs, concrete yards, truck lanes
							float bld = step(0.12, f.x) * step(f.x, 0.55) * step(0.15, f.y) * step(f.y, 0.62) + step(0.62, f.x) * step(f.x, 0.9) * step(0.3, f.y) * step(f.y, 0.85);
							vec3 yard = mix(vec3(0.46, 0.45, 0.42), vec3(0.36, 0.35, 0.34), vn(g * 0.05));
							cityC = mix(yard, mix(vec3(0.72, 0.72, 0.7), vec3(0.58, 0.6, 0.62), lh), clamp(bld, 0.0, 1.0));
						} else if (sty > 5.5) {
							// retail: a big box at the back, a sea of parking in front
							float bld = step(0.15, f.x) * step(f.x, 0.85) * step(0.55, f.y) * step(f.y, 0.9);
							float lotL = step(0.9, fract(fw.x / 2.7)) * (1.0 - bld) * step(0.1, f.y);
							cityC = mix(vec3(0.22, 0.22, 0.23) + lotL * 0.45, vec3(0.7, 0.68, 0.64), bld);
						} else {
							// business park: big roofs in wide parking lots, with lines of trees
							float bld = step(0.25, f.x) * step(f.x, 0.62) * step(0.2, f.y) * step(f.y, 0.7);
							float lotL = step(0.9, fract(fw.x / 2.7)) * (1.0 - bld);
							cityC = mix(vec3(0.24, 0.24, 0.25) + lotL * 0.4, vec3(0.66, 0.65, 0.62), bld);
							cityC = mix(cityC, vec3(0.14, 0.22, 0.1), step(0.85, h21(floor(g / 9.0))) * (1.0 - bld));
						}
						// downtown: the ground between the towers is roofs and plazas
						cityC = mix(cityC, mix(vec3(0.55, 0.54, 0.52), vec3(0.72, 0.69, 0.64), lh), smoothstep(0.2, 0.6, down));
						float park = step(0.96, h21(cid + 3.1)) * (1.0 - down);
						cityC = mix(cityC, vec3(0.2, 0.32, 0.13), park);
						// close by, the sidewalk's slabs and the street's years (weathering.js), in the
						// grid's own frame: across and along the street
						vec3 walkC = vec3(0.62, 0.61, 0.58), stC = vec3(0.2, 0.2, 0.21);
						float px = length(fwidth(vBW));
						if (dist < 350.0) {
							float xs = step(fw.x, BK.z);
							float ax = mix(fw.y, fw.x, xs), al = mix(g.x, g.y, xs);
							if (sidewalk > 0.01) {
								float sx = min(fw.x - BK.z, B.x - fw.x), sy = min(fw.y - BK.z, B.y - fw.y);
								float jd = abs(fract((sx < sy ? g.y : g.x) / 1.5) - 0.5) * 1.5;
								float joint = (1.0 - smoothstep(0.015, 0.015 + px, 0.75 - jd)) * (1.0 - smoothstep(0.04, 0.12, px));
								walkC = walkAge(walkC * (1.0 - 0.3 * joint), vBW, px, max(joint, 1.0 - smoothstep(0.0, 0.3, min(sx, sy))));
							}
							if (street > 0.01) {
								float cd = abs(ax - BK.z * 0.5), ld = abs(cd - 1.8), lk = step(cd, 3.6);
								float ph = h21(vec2(floor(al / 9.0), step(BK.z * 0.5, ax)) + cid * 1.7);
								float pat = step(0.85, ph) * step(abs(fract(al / 9.0) - 0.5) * 9.0, 1.0 + ph * 2.0) * step(abs(cd - 1.8), 0.6 + ph * 0.6);
								float cov = 1.0 - smoothstep(0.3, 0.3 + px, length(vec2(mod(al + 20.0, 40.0) - 20.0, cd)));
								float gut = 1.0 - smoothstep(0.0, 0.5, min(ax, BK.z - ax));
								stC = asphaltAge(stC, vBW, ld, lk, pat, cov, px, gut);
								stC = mix(stC, stC * 0.7, gut * 0.6);
								if (gut > 0.01) stC = gutterAge(stC, vBW, gut, px);
								// a faded double yellow down the middle of the wider streets
								float yl = (1.0 - smoothstep(0.05, 0.05 + px, abs(cd - 0.16))) * step(12.5, BK.z) * (1.0 - smoothstep(0.1, 0.3, px));
								stC = mix(stC, vec3(0.8, 0.64, 0.18), yl * (0.45 + 0.4 * vn(vBW * 0.5)) * (1.0 - pat));
								wxGloss *= street; wxPudA *= street;
							}
						}
						cityC = mix(cityC, walkC, sidewalk * 0.7);
						// the streets fade with distance, as they do in an aerial photograph (lines a
						// pixel wide all bending together read as a pattern, not a town)
						cityC = mix(cityC, stC, street * (1.0 - 0.55 * smoothstep(1200.0, 3200.0, dist)));
						// mature trees in clumps over lawns and streets alike, thicker in some
						// neighbourhoods than others
						float canopyF = smoothstep(0.52, 0.8, fbm3(vBW * 0.011) + 0.25 * vn(vBW * 0.05)) * (sty > 1.5 && sty < 3.5 ? 0.6 : 0.0) * (1.0 - down);
						cityC = mix(cityC, mix(vec3(0.13, 0.2, 0.09), vec3(0.2, 0.26, 0.12), vn(vBW * 0.08)), canopyF);
						// far off the grid melts into the town's own average colour, mottled
						// (San Francisco's is darker and warmer than its pale stucco: streets, the shadows of
						// the rows, grey roofs; and block by block it varies, while blocks are still
						// a few pixels across)
						vec3 avgC = sty < 1.5 ? vec3(0.47, 0.45, 0.42) : sty < 2.5 ? vec3(0.27, 0.31, 0.21) : sty < 3.5 ? vec3(0.38, 0.39, 0.26) : (sty > 4.5 && sty < 5.5) ? vec3(0.55, 0.55, 0.53) : vec3(0.4, 0.4, 0.39);
						avgC = mix(avgC, vec3(0.54, 0.52, 0.49), smoothstep(0.2, 0.6, down)) * (0.86 + 0.28 * fbm3(vBW * 0.0035));
						avgC *= 0.9 + 0.2 * mix(0.5, h21(cid + 7.0), 1.0 - smoothstep(0.1, 0.3, length(fwidth(g)) / B.y));
						cityC = mix(cityC, avgC, smoothstep(1500.0, 6000.0, dist));
						c = mix(c, cityC, smoothstep(0.08, 0.35, urban));
						// night: street lamps along the grid, windows in the blocks; far away,
						// the town is a carpet of light
						float lamps = street * step(0.55, fract((g.x + g.y) / 32.0)) * step(0.9, h21(floor(g / 16.0)));
						float wins = (1.0 - street) * step(0.86, h21(floor(g / 9.0) + 5.0)) * (0.5 + T.b);
						// once a window block is smaller than a couple of pixels it is only its
						// average glow (as a mipmap would), so distant blocks do not crawl
						float mpp = length(fwidth(vBW));
						float lodW = smoothstep(4.5, 2.0, mpp);
						wins = mix(0.012 * (0.5 + T.b) * (1.0 - street), wins, lodW);           // (a dim average: the lights far off are the sparks)
						lamps = mix(street * 0.02, lamps, smoothstep(8.0, 3.5, mpp));
						// (close by the real buildings carry their own lit windows: the ground's
						// stand-in windows only begin beyond them)
						float nearL = lamps * 1.2 * (1.0 - smoothstep(900.0, 3500.0, dist)) + wins * smoothstep(1100.0, 2000.0, dist) * (1.0 - smoothstep(2500.0, 5000.0, dist));
						// far off, points of light: streetlights and windows as a scatter of sparks,
						// thicker downtown, fixed to the ground and never smaller than a pixel
						float farL = sparks(vBW, dist, 0.86 - T.b * 0.2, 0.0) * (1.2 + T.b) * smoothstep(600.0, 3500.0, dist);
						cityGlow = mix(vec3(1.0, 0.62, 0.28), vec3(0.95, 0.9, 0.8), h21(floor(vBW / 18.0) + 3.0) * 0.5) * (nearL + farL) * smoothstep(0.08, 0.35, urban) * uNightB * 2.2;
					}
					// the creeks' beds and the lakes' shores (water.js): wet gravel and mud at the water,
					// the pale concrete of a flood channel; over the streets painted across them
					vec2 wv = wcAt(vBW);
					if (wv.y > 0.004) {
						float wn = vn(vBW * 0.37), wm = vn(vBW * 0.09);
						vec3 mud = mix(vec3(0.1, 0.085, 0.06), vec3(0.2, 0.16, 0.11), wn) * (0.8 + 0.35 * wm);
						mud = mix(mud, mix(vec3(0.26, 0.23, 0.18), vec3(0.4, 0.36, 0.29), vn(vBW * 1.3)), smoothstep(0.58, 0.78, wm) * 0.6);
						vec3 conc = mix(vec3(0.5, 0.49, 0.46), vec3(0.6, 0.59, 0.55), wn) * (0.9 + 0.12 * wm);
						conc = mix(conc, conc * 0.72, smoothstep(0.6, 0.8, vn(vBW * vec2(0.08, 2.0))) * 0.4);
						c = mix(c, mud, clamp(wv.y, 0.0, 1.0));
						c = mix(c, conc, clamp(wv.y - 1.0, 0.0, 1.0));
						flatK = max(flatK, clamp(wv.y - 1.0, 0.0, 1.0));
					}
					// the lie of the land, drawn a little stronger than the light alone shows it (the
					// tone mapping flattens a town's gentle hills into one carpet): the folds and
					// hollows darker, the spurs and crowns lighter, the slopes turned to the sun lit
					// and those turned away shaded; most over the towns, whose roofs and streets hide
					// the ground's own colours
					vec3 sunL = normalize(uSunDir);
					float reliefK = (0.35 + 0.65 * smoothstep(0.08, 0.35, urban)) * step(0.0, h);
					c *= 1.0 - (0.3 * max(vCurv.y, 0.0) - 0.1 * max(-vCurv.y, 0.0)) * reliefK;
					c *= 1.0 + clamp((dot(n, sunL) - sunL.y) * 1.3, -0.4, 0.3) * smoothstep(0.0, 0.15, sunL.y) * reliefK;
					// after rain the ground is darker (and glossier, below)
					// close by, the open ground has a real grain: the hill grasses (by season) when
					// they are there, the soil's otherwise; not on the pavement
					if (dist < 120.0 && uGroundK > 0.5) {
						// (faded by how small its grain is on screen, not by distance alone: at a grazing
						// angle a 2 m tile shimmers into rows of dots well inside 120 m; and divided by its
						// own mean, 0.9, so it adds grain without lightening the ground near you)
						float grain = length(fwidth(vBW * 0.5));
						float gk = (1.0 - smoothstep(50.0, 120.0, dist)) * (1.0 - smoothstep(0.12, 0.35, grain)) * (1.0 - flatK);
						// (the photo read twice, the second turned and scaled off the first, so its tile
						// never lines up into a grid)
						float dL = tile2(vBW * 0.35, 0.9);
						// (under the trees the grain is the soil's, unturned)
						if (duffK > 0.0) dL = mix(dL, loamGrain(vBW * 0.35), duffK);
						c *= mix(1.0, dL / 0.9, gk * 0.55);
					}
					// standing water: dark, and glossy as glass (below)
					wxPud = max(wxPud * (1.0 - flatK), wxPudA);
					c *= 1.0 - wxPud * 0.45;
					diffuseColor.rgb = c * (0.88 + 0.24 * n3) * (1.0 - uWet * 0.3);
				}`)
				.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				{
					// fine relief the survey cannot see: gullies, knolls and grain, as a bump
					float dist2 = length(cameraPosition - vec3(vBW.x, vBH, vBW.y));
					// (past 6 km it has faded out entirely: its noise is not computed there)
					float bh = 0.0;
					// (each scale fades as it nears a pixel: finer, it would only alias into ridges)
					if (dist2 < 6000.0) {
						float px = length(fwidth(vBW));
						bh = fbm3(vBW * 0.045) * 2.2 * (1.0 - smoothstep(4.0, 9.0, px)) + fbm3(vBW * 0.22) * 0.5 * (1.0 - smoothstep(0.9, 2.2, px)) + vn(vBW * 1.3) * 0.08 * (1.0 - smoothstep(0.15, 0.4, px));
						bh *= (1.0 - smoothstep(1500.0, 6000.0, dist2)) * step(0.0, vBH);
					}
					vec3 sp = -vViewPosition, vSx = dFdx(sp), vSy = dFdy(sp);
					vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
					float fDet = dot(vSx, R1);
					// paving is smooth: the relief fades under it (scaling the slope, not the height,
					// so the paving's edge draws no line of its own)
					vec2 dH = (vec2(dFdx(bh), dFdy(bh)) * (1.0 - flatK * 0.9) + vec2(dFdx(wxBump), dFdy(wxBump))) * (1.0 - wxPud);
					normal = normalize(abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2));
				}`)
				.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cityGlow;')
				.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, uWet * 0.85);\nroughnessFactor = mix(mix(roughnessFactor, 0.6, max(wxGloss, wxDamp * 0.5)), 0.04, wxPud);');
		};
		m.customProgramCacheKey = () => 'bayground2' + (hole ? 'far' : 'near');
		m.userData.U2 = U2;
		return m;
	}
	const nearMat = groundMaterial(false), farMat = groundMaterial(true);
	const near = new THREE.Mesh(radialGrid(300, 4000, 2.0), nearMat), far = new THREE.Mesh(radialGrid(256, 95000, 2.6), farMat);
	for (const m of [near, far]) { m.frustumCulled = false; m.receiveShadow = true; m.userData.material175 = 'stone'; group.add(m); }
	near.visible = far.visible = false;

	// the San Mateo coast's cliffs, farms, trail and fence
	const coast = createCoastside({ groundAt, urbanAt, group });
	ready.then(() => coast.start());
	// the three finest surveys within reach of you go into the ground's three slots (the
	// coarse whole-Bay level is always bound); chosen again when you have moved half a km
	const MARGIN = [0, 1500, 500, 400, 400, 400, 400, 400, 400, 500], SLOTS = ['a', 'b', 'c'];
	let slotsAt = null;
	function pickSlots(x, z) {
		if (slotsAt && Math.hypot(x - slotsAt[0], z - slotsAt[1]) < 500) return;
		slotsAt = [x, z];
		const near3 = [];
		for (let i = levels.length - 1; i >= 1 && near3.length < 3; i--) {
			const L = levels[i];
			if (!L?.tex) continue;
			const dx = Math.max(L.x0 - x, 0, x - (L.x0 + L.W * L.step)), dz = Math.max(L.zN - z, 0, z - (L.zN + L.H * L.step));
			if (Math.hypot(dx, dz) < 4000) near3.push(i);
		}
		// (coarser first, so the finer one lies over it)
		near3.sort((a, b) => a - b);
		SLOTS.forEach((k, n) => {
			const i = near3[n], L = levels[i];
			if (L) { BU['uB' + k].value = L.tex; BU['uR' + k].value.set(L.x0, L.zN, L.step, MARGIN[i]); } else BU['uR' + k].value.copy(OFF);
		});
	}
	function update(cam, night) {
		const on = BU.uBayOn.value > 0.5 && !farG?.hideBay?.();
		near.visible = far.visible = on;
		BSEAM_U.uBSeam.value = farG?.ready() ? farG.seam[0] + 150 : 1e9;
		if (!on) return;
		pickSlots(cam.position.x, cam.position.z);
		uNightB.value = night;
		const nx = Math.round(cam.position.x / 32) * 32, nz = Math.round(cam.position.z / 32) * 32;
		const fx = Math.round(cam.position.x / 512) * 512, fz = Math.round(cam.position.z / 512) * 512;
		near.position.set(nx, 0, nz); nearMat.userData.U2.uC.value.set(nx, nz);
		far.position.set(fx, 0, fz); farMat.userData.U2.uC.value.set(fx, fz); farMat.userData.U2.uHoleC.value.set(nx, nz);
		coast.update(cam);
	}
	return { group, update, heightAt, baseHeightAt: (x, z) => heightAt(x, z) - carveDelta(x, z), urbanAt, ready, coast, towns, loaded: () => BU.uBayOn.value > 0.5, levels };
}
