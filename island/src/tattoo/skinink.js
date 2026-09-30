// Tattoos in the skin: each design wraps round a part of the body the way a tattooist lays
// it, measured on the body at rest (so it rides every pose): round the limb from its front,
// down the limb from its top. The ink darkens the skin's own colour (a multiply), as ink under
// the skin does, so it reads right on every tone and never floats on it. One texture a person
// (the designs laid out in tiles); the people in the street share one of flash designs.

import * as THREE from 'three';
import { drawDesign } from './ink.js';
import { MOTIFS, motifDesign, inkOf } from './lore.js';

export const MAX = 6;
// where a design can go: the axis from one joint to the next (top first, so a design's top is
// towards the shoulder, the hip, the neck), how far round it reaches before the next part
export const SLOTS = {
	'upperarm.L': { a: 'upperarm01.L', b: 'lowerarm01.L', label: 'Left upper arm', reach: 0.12 },
	'upperarm.R': { a: 'upperarm01.R', b: 'lowerarm01.R', label: 'Right upper arm', reach: 0.12 },
	'forearm.L': { a: 'lowerarm01.L', b: 'wrist.L', label: 'Left forearm', reach: 0.1 },
	'forearm.R': { a: 'lowerarm01.R', b: 'wrist.R', label: 'Right forearm', reach: 0.1 },
	'thigh.L': { a: 'upperleg01.L', b: 'lowerleg01.L', label: 'Left thigh', reach: 0.16 },
	'thigh.R': { a: 'upperleg01.R', b: 'lowerleg01.R', label: 'Right thigh', reach: 0.16 },
	'calf.L': { a: 'lowerleg01.L', b: 'foot.L', label: 'Left calf', reach: 0.12 },
	'calf.R': { a: 'lowerleg01.R', b: 'foot.R', label: 'Right calf', reach: 0.12 },
	torso: { a: 'neck01', b: 'spine04', label: 'Chest and back', reach: 0.3 },
	neck: { a: 'head', b: 'neck01', label: 'Neck', reach: 0.1 },
};

export const INK_GLSL = /* glsl */`
uniform sampler2D uTat;
uniform vec4 uTatA[${MAX}], uTatD[${MAX}], uTatE[${MAX}], uTatP[${MAX}], uTatT[${MAX}];
// the ink at a point of the body at rest: a multiply for the skin's colour (white where none)
vec3 inkAt(vec3 b) {
	vec3 ink = vec3(1.0);
	for (int i = 0; i < ${MAX}; i++) {
		if (uTatE[i].w < 0.5) continue;
		vec3 q = b - uTatA[i].xyz;
		float s = dot(q, uTatD[i].xyz);
		if (s < -0.03 || s > uTatA[i].w + 0.03) continue;
		vec3 rr = q - uTatD[i].xyz * s;
		if (length(rr) > uTatD[i].w * 1.8) continue;
		vec3 e2 = cross(uTatD[i].xyz, uTatE[i].xyz);
		float th = atan(dot(rr, e2), dot(rr, uTatE[i].xyz));
		float dth = mod(th - uTatP[i].x + 3.14159265, 6.2831853) - 3.14159265;
		vec2 p = vec2(dth * uTatD[i].w, s - uTatP[i].y);
		float c = cos(uTatP[i].w), sn = sin(uTatP[i].w);
		p = vec2(c * p.x + sn * p.y, -sn * p.x + c * p.y) / uTatP[i].z;
		if (abs(p.x) > 1.0 || abs(p.y) > 1.0) continue;
		vec4 t = texture2D(uTat, uTatT[i].xy + (p * vec2(0.5, -0.5) + 0.5) * uTatT[i].zw);
		// (w: how fresh; old ink is fainter, and black drifts a little blue-green)
		float f = uTatE[i].w;
		vec3 c = mix(mix(t.rgb, vec3(0.2, 0.3, 0.34), (1.0 - f) * 1.2), t.rgb, step(0.99, f));
		ink *= mix(vec3(1.0), c, t.a * 0.88 * f);
	}
	return ink;
}`;

const blank = (() => { let t = null; return () => { if (!t) { t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1); t.needsUpdate = true; } return t; }; })();
const V4 = () => Array.from({ length: MAX }, () => new THREE.Vector4());
export function inkUniforms() {
	return { uTat: { value: blank() }, uTatA: { value: V4() }, uTatD: { value: V4() }, uTatE: { value: V4() }, uTatP: { value: V4() }, uTatT: { value: V4() } };
}

// each part's axis on this body at rest, and how thick it is there (measured on the skin)
export function inkRig(P) {
	if (P.inkRig) return P.inkRig;
	const H = P.rest.heads, p = P._p, R = {};
	const FRONT = new THREE.Vector3(0, 0, 1), q = new THREE.Vector3();
	for (const [k, S] of Object.entries(SLOTS)) {
		const ia = P.map[S.a], ib = P.map[S.b];
		if (ia === undefined || ib === undefined) continue;
		const a = H[ia].clone(), d = H[ib].clone().sub(a), len = d.length();
		d.divideScalar(len || 1);
		const e1 = FRONT.clone().addScaledVector(d, -FRONT.dot(d)).normalize();
		// the thickness: the nearer skin round the middle of the part
		const ds = [];
		if (p) for (let i = 0; i < p.length; i += 9) {
			q.set(p[i] - a.x, p[i + 1] - a.y, p[i + 2] - a.z);
			const s = q.dot(d);
			if (s < len * 0.25 || s > len * 0.75) continue;
			const r = q.addScaledVector(d, -s).length();
			if (r < S.reach) ds.push(r);
		}
		ds.sort((x, y) => x - y);
		const r = ds.length > 8 ? ds[Math.floor(ds.length * 0.5)] : S.reach * 0.45;
		R[k] = { a, d, len, e1, r };
	}
	P.inkRig = R;
	return R;
}

// lay placements on a skin material: [{ slot, angle (from the front), along (0..1 down the
// part), size (m across), rot, fade (1 new .. 0.5 old), tile: [u0, v0, du, dv] }] over a texture of designs
export function applyInk(mat, P, placements, tex) {
	const U = mat.userData.ink;
	if (!U) return;
	const R = inkRig(P);
	U.uTat.value = tex || blank();
	for (let i = 0; i < MAX; i++) {
		const pl = placements[i], G = pl && R[pl.slot];
		if (!G) { U.uTatE.value[i].w = 0; continue; }
		U.uTatA.value[i].set(G.a.x, G.a.y, G.a.z, G.len);
		U.uTatD.value[i].set(G.d.x, G.d.y, G.d.z, G.r);
		U.uTatE.value[i].set(G.e1.x, G.e1.y, G.e1.z, Math.max(0.5, Math.min(1, pl.fade ?? 1)));
		U.uTatP.value[i].set(pl.angle || 0, (pl.along ?? 0.5) * G.len, (pl.size || 0.1) / 2, pl.rot || 0);
		U.uTatT.value[i].set(...pl.tile);
	}
}

// a texture of designs in tiles (cols x rows of px each), drawn from a list of designs
export function inkAtlas(designs, cols = 4, rows = 2, px = 256) {
	const cv = document.createElement('canvas');
	cv.width = cols * px; cv.height = rows * px;
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.NoColorSpace;          // (the ink's colour is a multiply, kept linear)
	tex.anisotropy = 4;
	const tiles = [];
	for (let i = 0; i < cols * rows; i++) tiles.push([(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows, 1 / cols, 1 / rows]);
	function draw(list) {
		const g = cv.getContext('2d');
		g.clearRect(0, 0, cv.width, cv.height);
		list.forEach((d, i) => { if (d && i < tiles.length) drawDesign(g, d, (i % cols) * px + px * 0.03, Math.floor(i / cols) * px + px * 0.03, px * 0.94); });
		tex.needsUpdate = true;
	}
	draw(designs);
	return { tex, tiles, draw, canvas: cv };
}

// the flash sheet: the motifs people wear (tattoo/lore.js), drawn once; a parlour's walls
// show the same sheet
let FLASH = null;
export function flashAtlas() {
	if (!FLASH) FLASH = inkAtlas(MOTIFS.map((m) => motifDesign(m)), 4, 4, 256);
	return FLASH;
}
// a passer-by's tattoos, as their life gave them (tattoo/lore.js), on the flash sheet
export function inkFor(dna) {
	const F = flashAtlas();
	return inkOf(dna).map((t) => ({ ...t, tile: F.tiles[t.motif] }));
}
