// The shore, where the sea meets the land. The swash's timing and reach are shared by the
// sea's sheet of water (world/ocean.js) and the wet sand it leaves (world/terrain.js), so the
// sand darkens exactly where the water ran and dries behind it; how much of the water shows at
// a given depth (the edge thins to nothing over the sand, so there is never a line where the
// surface meets the ground); and where the waves break (gentle open beaches only). The GLSL
// and the plain functions below are the same sums (island/tools/shore.test.mjs checks them).
//
// A wave's run up the beach: a quick rush that slows as it climbs, a stall at the top, then a
// drain that gathers pace as the sheet thins. Two trains with different periods, and a phase
// that wanders along the shore, keep it from ever reading as one sheet breathing up and down.
// The front is never a line: lobes a few metres across and fingers under a metre, drawn anew
// for each wave.

import * as THREE from 'three';
import { smoothstep as smooth } from '../noise.js';

// (the GLSL needs NOISE_GLSL's vn before it)
export const SWASH_GLSL = /* glsl */`
float swashRunMax(vec2 w, float wave){ return (0.42 + 0.32 * vn(w * 0.031 + 4.0)) * (0.55 + 0.45 * wave); }
// the water's run up the sand through one wave, 0 at the foot of the backwash to 1 at the top
float swashUp(float s){
	if (s < 0.2) return sin(s * 7.853982);
	if (s < 0.3) return 1.0 - 0.03 * smoothstep(0.2, 0.3, s);
	float d = (s - 0.3) / 0.7;
	return 0.97 * (1.0 - d * sqrt(d));
}
// one train at w and time t (period T): x the reach (a ground height), y this wave's top,
// z seconds since it stalled (below zero while it rushes up), w its phase
vec4 swashTrainS(vec2 w, float t, float T, float off, float runMax){
	float ph = vn(w * 0.014 + off) * 2.4 + vn(w * 0.06 - off) * 0.35;
	float c = t / T + ph, s = fract(c), n = floor(c);
	float k = 0.55 + 0.45 * vn(vec2(n * 3.7, off));
	vec2 q = w + vec2(n * 7.31, n * -3.17);
	float top = runMax * k + (vn(q * 0.23 + off) - 0.5) * 0.07 + (vn(q * 0.9 - off) - 0.5) * 0.028;
	return vec4(mix(-0.3, top, swashUp(s)), top, (s - 0.2) * T, s);
}
// the swash at w: whichever train reaches further just there
vec4 swashState(vec2 w, float t, float wave){
	float rm = swashRunMax(w, wave);
	vec4 a = swashTrainS(w, t, 8.3, 1.7, rm), b = swashTrainS(w, t, 11.9, 6.1, rm * 0.85);
	return a.x >= b.x ? a : b;
}
float swashLevel(vec2 w, float t, float wave){ return swashState(w, t, wave).x; }
// the beach's sheet of water over ground g, the swash at reach s and the open sea's level y:
// thin where it runs out over the sand (a third of the height it climbs)
float swashSheet(float y, float s, float g){ return s > g ? max(min(y, s), g + (s - g) * 0.35) : s; }
// how much the water covers the ground under it at depth d (m): none at the edge, so the ground
// shows through and no line is drawn where the two meet; by the red light it takes first (sr,
// its absorption per metre; the light scattered in the water veils it too), or sooner where it
// is murky (murk 0..1)
float waterBody(float d, float sr, float murk){ return 1.0 - exp(-max(d, 0.0) * max(max(sr, 0.22), mix(0.2, 1.2, murk))); }
// how much the waves break on a bed of slope sl (rise over run), sheltered 0..1: spilling on
// a gentle open beach, none on a steep shore (the swell surges up it) or in a sheltered bay
float breakOn(float sl, float shelter){ return smoothstep(0.004, 0.012, sl) * (1.0 - smoothstep(0.1, 0.22, sl)) * (1.0 - shelter); }
`;

// ---------- the same sums on the CPU ----------
const fract = (v) => v - Math.floor(v);
const mod = (v, m) => v - m * Math.floor(v / m);
// NOISE_GLSL's h21 and vn (world/terrain.js)
export function h21(x, y) {
	x = mod(x, 4096); y = mod(y, 4096);
	let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
	const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
	a += d; b += d; c += d;
	return fract((a + b) * c);
}
export function vn(x, y) {
	const ix = Math.floor(x), iy = Math.floor(y);
	let fx = x - ix, fy = y - iy;
	fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
	const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
	return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export const swashRunMax = (x, z, wave = 1) => (0.42 + 0.32 * vn(x * 0.031 + 4, z * 0.031 + 4)) * (0.55 + 0.45 * wave);
export function swashUp(s) {
	if (s < 0.2) return Math.sin(s * 7.853982);
	if (s < 0.3) return 1 - 0.03 * smooth(0.2, 0.3, s);
	const d = (s - 0.3) / 0.7;
	return 0.97 * (1 - d * Math.sqrt(d));
}
// one train: { level, top, since, phase } (as swashTrainS)
export function swashTrain(x, z, t, T, off, runMax) {
	const ph = vn(x * 0.014 + off, z * 0.014 + off) * 2.4 + vn(x * 0.06 - off, z * 0.06 - off) * 0.35;
	const c = t / T + ph, s = fract(c), n = Math.floor(c);
	const k = 0.55 + 0.45 * vn(n * 3.7, off);
	const qx = x + n * 7.31, qz = z - n * 3.17;
	const top = runMax * k + (vn(qx * 0.23 + off, qz * 0.23 + off) - 0.5) * 0.07 + (vn(qx * 0.9 - off, qz * 0.9 - off) - 0.5) * 0.028;
	return { level: -0.3 + (top + 0.3) * swashUp(s), top, since: (s - 0.2) * T, phase: s };
}
export function swashState(x, z, t, wave = 1) {
	const rm = swashRunMax(x, z, wave);
	const a = swashTrain(x, z, t, 8.3, 1.7, rm), b = swashTrain(x, z, t, 11.9, 6.1, rm * 0.85);
	return a.level >= b.level ? a : b;
}
export const swashLevel = (x, z, t, wave = 1) => swashState(x, z, t, wave).level;
export const swashSheet = (y, s, g) => (s > g ? Math.max(Math.min(y, s), g + (s - g) * 0.35) : s);
export const waterBody = (d, sr = 0.34, murk = 0) => 1 - Math.exp(-Math.max(d, 0) * Math.max(sr, 0.22, 0.2 + (1.2 - 0.2) * murk));
// the sea's own cover at the edge (world/ocean.js): its colour by depth and the sky's sheen,
// which grows in over the first couple of centimetres, so at the line itself there is nothing
export function edgeAlpha(film, F = 0.02, murk = 0, sr = 0.34) {
	if (film <= 0) return 0;
	const Fe = F * smooth(0, 0.02, film);
	return 1 - (1 - waterBody(film, sr, murk)) * (1 - Fe);
}
export const breakOn = (sl, shelter = 0) => smooth(0.004, 0.012, sl) * (1 - smooth(0.1, 0.22, sl)) * (1 - shelter);

// How the shore is drawn on this device, by the governor's tier: how far out the water reads
// the ground under every pixel (beyond it the ground is read at the sea's vertices), and how
// much fine detail its foam, bubbles and caustics carry (0 none .. 1 all).
// (out: an object to fill, so asking each frame makes nothing new)
const DETAIL = { high: 1, medium: 0.75, low: 0.4, minimal: 0 }, REACH = { high: 1, medium: 0.8, low: 0.55, minimal: 0.35 };
export function shoreQuality(tier, phone = false, out = {}) {
	const name = tier?.name || 'high';
	out.detail = DETAIL[name] ?? 1;
	out.reach = (phone ? 160 : 520) * (REACH[name] ?? 1);
	return out;
}

// A planet's lakes and streams as a map over the island (planet/waters.js island.waterMap): r the
// water's bed, g its banks, wet a few metres round it. The ground darkens its banks to wet mud
// and lays silt on the bed (world/terrain.js); the grass keeps out of the water (world/grass.js).
// One texture shared by all (shared.uWaterMap); a blank one where there is no such map.
export function waterMapTexture(island) {
	const N = island?.N, d = island?.waterMap;
	const tex = d && d.length === N * N * 2 ? new THREE.DataTexture(d, N, N, THREE.RGFormat, THREE.UnsignedByteType) : new THREE.DataTexture(new Uint8Array(2), 1, 1, THREE.RGFormat, THREE.UnsignedByteType);
	tex.magFilter = tex.minFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;
}
export const WATERMAP_GLSL = /* glsl */`
uniform sampler2D uWaterMap;
vec2 waterMapAt(vec2 w){ return texture2D(uWaterMap, (w + uHalf) / (uHalf * 2.0)).rg; }
`;
