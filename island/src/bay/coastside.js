// The San Mateo coast from El Granada down past Pescadero, as it looks from the bluffs at
// Half Moon Bay: green terraces in the fog belt ending in sheer sandstone cliffs, sandy
// coves and rocks at their foot, ice plant and coyote brush hugging the lip, the dirt
// Coastal Trail along the edge behind a split-rail fence, the golf links on the bluffs
// south of town, and inland of Highway 1 the farms: strawberries under plastic mulch,
// artichokes, row crops and fallow ground, in fields laid along the contours, with farm
// roads between them and a barn here and there.
//
// The survey (12 to 16 m a sample) smooths a 20 m cliff into a ramp, so near you the
// ramp is steepened back into a face: a delta grid round you, the same on the GPU
// (cliffDelta in the ground's vertex shader) and for walking (cliffDelta here).
// The shore's line (where the land begins, every 100 m down the coast) and the fields
// (one texel each) are worked out on the CPU a slice at a time once the heights are in.

import * as THREE from 'three';
import { toWorld } from './geo.js';

// the stretch of coast: [west, south, east, north] in lat/lon
const LAT_S = 37.15, LAT_N = 37.53, LON_W = -122.54, LON_E = -122.30;
const NW = toWorld(LAT_N, LON_W), SE = toWorld(LAT_S, LON_E);
const ROW = 100, NROW = Math.ceil((SE.z - NW.z) / ROW) + 1;
// the fields: a grid turned to the lie of the coast (NNW), each cell a field, its edges
// wandering a little so no two line up
const FA = 0.33, FC = Math.cos(FA), FS = Math.sin(FA), FX = 150, FZ = 240, FWARP = 36;
const FO = toWorld(37.34, -122.40);
// the cliff grid round you
const CN = 320, CCELL = 5, CSIZE = CN * CCELL;
// the Ritz-Carlton's links on the bluffs south of town: centre, half-widths
const RITZ = toWorld(37.4290, -122.4365);
// the Coastal Trail and its fence, from the links north to Poplar Beach
const TRAIL_S = toWorld(37.405, -122.44).z, TRAIL_N = toWorld(37.456, -122.44).z;

export const COAST_U = {
	uCliff: { value: null }, uCliffR: { value: new THREE.Vector4(0, 0, CSIZE, 0) },
	uCsRows: { value: null }, uCsRow: { value: new THREE.Vector4(NW.z, ROW, NROW, 0) }, uCsBox: { value: new THREE.Vector4(NW.x, NW.z, SE.x, SE.z) },
	uCsField: { value: null }, uCsO: { value: new THREE.Vector4(FO.x, FO.z, 0, 0) }, uCsF: { value: new THREE.Vector4(FC, FS, FX, FZ) },
	uCsRitz: { value: new THREE.Vector4(RITZ.x, RITZ.z, 650, 1500) },
};

// the cliffs, steepened (vertex)
export const COAST_VGLSL = /* glsl */`
uniform sampler2D uCliff; uniform vec4 uCliffR;
float cliffDelta(vec2 w){
	if (uCliffR.w < 0.5) return 0.0;
	vec2 u = (w - uCliffR.xy) / uCliffR.z;
	if (u.x <= 0.0 || u.y <= 0.0 || u.x >= 1.0 || u.y >= 1.0) return 0.0;
	float edge = smoothstep(0.0, 0.1, min(min(u.x, u.y), min(1.0 - u.x, 1.0 - u.y)));
	return textureLod(uCliff, u, 0.0).r * edge;
}`;

// the coast's colours (fragment; after WOODS_GLSL, whose wVn it shares)
export const COAST_FGLSL = /* glsl */`
uniform sampler2D uCsRows, uCsField; uniform vec4 uCsRow, uCsBox, uCsO, uCsF, uCsRitz;
// how far inland of the sea a point lies, in metres across the coast (1e5 off this coast)
float csSea(vec2 w){
	if (uCsRow.w < 0.5 || w.x < uCsBox.x || w.x > uCsBox.z || w.y < uCsBox.y || w.y > uCsBox.w) return 1e5;
	float f = clamp((w.y - uCsRow.x) / uCsRow.y, 0.0, uCsRow.z - 1.001); int i = int(f);
	float cx = mix(texelFetch(uCsRows, ivec2(i, 0), 0).r, texelFetch(uCsRows, ivec2(i + 1, 0), 0).r, f - float(i));
	return (w.x - cx) * 0.94;
}
// the fog belt's grass on the terraces: green most of the year, tawny patches by late summer
vec3 csGrass(vec2 w, float n2, float n3, float macro){
	vec3 g = mix(vec3(0.13, 0.27, 0.05), vec3(0.22, 0.36, 0.08), n2 * 0.6 + macro * 0.4) * (0.9 + 0.2 * n3);
	return mix(g, vec3(0.34, 0.28, 0.11), uSeason * 0.45 * smoothstep(0.55, 0.8, wVn(w / 380.0 + 4.0)));
}
vec3 coastSide(vec3 c, vec2 w, float h, float slope, float sea, float urb, float dist, float n2, float n3){
	float px = length(fwidth(w));
	// sheer sandstone where the land drops to the sea: tan and ochre in layers, the layers
	// dipping gently, runnels down the face, dark and wet at its foot
	// (slope here is 1 - n.y: 0.12 is a 1 in 1.5 grade, 0.3 is 45 degrees)
	float cliffK = smoothstep(0.1, 0.18, slope) * (1.0 - smoothstep(350.0, 700.0, sea)) * (1.0 - smoothstep(70.0, 110.0, h)) * step(-1.0, h);
	if (cliffK > 0.0) {
		float st = h + (wVn(w / 70.0) - 0.5) * 5.0 + dot(w, vec2(0.0035, 0.0055));
		float bk = 1.0 - smoothstep(0.2, 0.6, fwidth(st) * 1.9);
		float band = mix(0.5, sin(st * 1.9) * 0.5 + 0.5, bk), fine = mix(0.5, sin(st * 5.3 + 1.0) * 0.5 + 0.5, bk * bk);
		vec3 ss = mix(vec3(0.46, 0.35, 0.21), vec3(0.64, 0.52, 0.34), band * 0.65 + fine * 0.35);
		ss = mix(ss, vec3(0.56, 0.36, 0.15), smoothstep(0.5, 0.75, wVn(w / 45.0 + 9.0)) * 0.5);        // iron-stained ochre
		float run = wVn(vec2(dot(w, vec2(0.34, 0.94)) / 2.5, h / 18.0));
		ss *= 0.84 + 0.3 * mix(0.5, run, 1.0 - smoothstep(0.8, 2.0, px));
		// wet at the foot, black with algae where the surf reaches
		ss = mix(ss, ss * vec3(0.5, 0.48, 0.45), 1.0 - smoothstep(1.5, 4.0, h));
		ss = mix(ss, vec3(0.05, 0.06, 0.04), 1.0 - smoothstep(0.4, 1.4, h));
		c = mix(c, ss, cliffK);
	}
	// the coves' sand: warm tan, from the sandstone it is ground from
	float cove = (1.0 - smoothstep(1.2, 5.0, h)) * (1.0 - smoothstep(0.03, 0.08, slope)) * step(-0.5, h) * (1.0 - smoothstep(300.0, 600.0, sea));
	c = mix(c, mix(vec3(0.5, 0.41, 0.28), vec3(0.6, 0.5, 0.35), n2) * mix(0.72, 1.0, smoothstep(0.3, 1.2, h)), cove);
	// rocks in the coves at the cliff foot, dark and wet
	float lowSand = (1.0 - smoothstep(1.8, 3.5, h)) * step(-0.3, h) * (1.0 - smoothstep(250.0, 450.0, sea)) * (1.0 - cliffK);
	if (lowSand > 0.0) {
		float rk = smoothstep(0.62, 0.7, wVn(w / 14.0 + 3.0) * 0.7 + wVn(w / 3.3) * 0.3);
		c = mix(c, mix(vec3(0.07, 0.065, 0.06), vec3(0.16, 0.14, 0.12), n3), rk * lowSand);
	}
	// the lip: ice plant (green, reddening, magenta in flower in spring) and coyote brush
	float lip = smoothstep(0.035, 0.07, slope) * (1.0 - smoothstep(0.1, 0.16, slope)) * (1.0 - smoothstep(250.0, 500.0, sea)) * smoothstep(3.0, 6.0, h);
	if (lip > 0.0) {
		vec3 ice = mix(vec3(0.16, 0.24, 0.05), vec3(0.34, 0.16, 0.07), smoothstep(0.45, 0.75, wVn(w / 9.0 + 2.0)));
		ice = mix(ice, vec3(0.55, 0.1, 0.32), (1.0 - uSeason) * 0.45 * smoothstep(0.55, 0.7, wVn(w / 2.1 + 6.0)) * (1.0 - smoothstep(0.8, 2.0, px)));
		vec3 brush = mix(vec3(0.07, 0.1, 0.04), vec3(0.12, 0.15, 0.06), n3);
		c = mix(c, mix(ice, brush, smoothstep(0.5, 0.62, wVn(w / 12.0 - 5.0))), lip);
	}
	// the golf links on the bluff top: fairways winding between darker rough, greens, bunkers
	vec2 rq = (w - uCsRitz.xy) / uCsRitz.zw;
	float links = (1.0 - smoothstep(0.8, 1.0, length(rq) + (wVn(w / 90.0) - 0.5) * 0.25)) * smoothstep(5.0, 9.0, h) * (1.0 - smoothstep(0.03, 0.06, slope)) * smoothstep(30.0, 60.0, sea) * (1.0 - urb);
	if (links > 0.0) {
		float fb = abs(wVn(w / 230.0 + 2.1) * 2.0 - 1.0) + (wVn(w / 40.0) - 0.5) * 0.08;
		float fair = 1.0 - smoothstep(0.16, 0.2, fb);
		vec3 lc = mix(vec3(0.13, 0.19, 0.06), vec3(0.18, 0.22, 0.08), n2);          // the rough, a little tawny
		lc = mix(lc, mix(vec3(0.17, 0.36, 0.07), vec3(0.2, 0.41, 0.08), n2), fair);
		vec2 gc = floor(w / 170.0), go = (vec2(wH01(ivec2(gc) + 3), wH01(ivec2(gc) + 11)) * 0.6 + 0.2) * 170.0;
		float gd = length(w - gc * 170.0 - go);
		lc = mix(lc, vec3(0.14, 0.42, 0.09), (1.0 - smoothstep(13.0, 15.0, gd)) * fair);      // the green
		// a bunker or two beside the green, kidney-shaped
		vec2 bo = (vec2(wH01(ivec2(gc) + 5), wH01(ivec2(gc) + 9)) - 0.5) * 50.0;
		float onGreen = step(0.5, 1.0 - smoothstep(0.16, 0.2, abs(wVn((gc * 170.0 + go) / 230.0 + 2.1) * 2.0 - 1.0)));
		float bunker = (1.0 - smoothstep(7.0, 9.0, length((w - gc * 170.0 - go - bo) * vec2(1.0, 1.6)) + (wVn(w / 5.0) - 0.5) * 5.0)) * step(0.35, wH01(ivec2(gc) + 7)) * onGreen;
		lc = mix(lc, vec3(0.72, 0.64, 0.47), bunker);
		c = mix(c, lc, links);
	}
	// the farms on the flats, a field to each cell of the turned grid
	float farmOK = (1.0 - smoothstep(0.02, 0.04, slope)) * smoothstep(4.0, 7.0, h) * smoothstep(60.0, 110.0, sea) * (1.0 - urb) * (1.0 - links);
	if (farmOK > 0.0) {
		vec2 d = w - uCsO.xy;
		vec2 q = vec2(d.x * uCsF.x + d.y * uCsF.y, -d.x * uCsF.y + d.y * uCsF.x) + (vec2(wVn(w / 310.0), wVn(w / 310.0 + vec2(17.0, 5.0))) - 0.5) * ${FWARP.toFixed(1)};
		vec2 S = uCsF.zw, id = floor(q / S), fq = q - id * S;
		ivec2 ti = ivec2(id - uCsO.zw);
		vec2 TS = vec2(textureSize(uCsField, 0));
		vec4 F = (ti.x >= 0 && ti.y >= 0 && float(ti.x) < TS.x && float(ti.y) < TS.y) ? texelFetch(uCsField, ti, 0) : vec4(0.0);
		float crop = floor(F.r * 255.0 / 40.0 + 0.5);
		if (crop > 0.5) {
			// rows along the contour, measured from the field's own middle (small numbers)
			vec2 cq = (id + 0.5) * S, cw = uCsO.xy + vec2(cq.x * uCsF.x - cq.y * uCsF.y, cq.x * uCsF.y + cq.y * uCsF.x);
			float th = F.g * 3.14159;
			float s = dot(w - cw, vec2(-sin(th), cos(th)));
			float flags = floor(F.a * 255.0 + 0.5);
			float sp = crop < 1.5 ? 1.63 : crop < 2.5 ? 3.0 : crop < 3.5 ? 1.0 : 0.9;
			float t = fract(s / sp), fr = fwidth(s / sp), aa = 1.0 - smoothstep(0.2, 0.5, fr);
			vec3 soil = mix(vec3(0.2, 0.1, 0.06), vec3(0.28, 0.15, 0.09), n2) * (0.9 + 0.2 * n3);   // the coast's red-brown loam
			vec3 fc;
			if (crop < 1.5) {
				// strawberries: raised beds under black (or silver) plastic, a plant every foot,
				// red-brown furrows between
				float bed = smoothstep(0.06, 0.12, t) * (1.0 - smoothstep(0.64, 0.7, t));
				bed = mix(0.6, bed, aa);
				vec3 plastic = mod(flags, 8.0) >= 4.0 ? vec3(0.4, 0.41, 0.4) : vec3(0.03, 0.03, 0.035);
				plastic = mix(plastic, vec3(0.08, 0.2, 0.05), 0.3 + 0.1 * n3);
				fc = mix(soil, plastic, bed);
			} else if (crop < 2.5) {
				// artichokes: big silver-green clumps in wide rows
				float pl = smoothstep(0.15, 0.4, t) * (1.0 - smoothstep(0.6, 0.85, t)) * (0.6 + 0.4 * wVn(vec2(dot(w - cw, vec2(cos(th), sin(th))) / 1.3, id.x)));
				pl = mix(0.4, pl, aa);
				fc = mix(soil, vec3(0.19, 0.25, 0.17), pl);
			} else if (crop < 3.5) {
				// row crops (Brussels sprouts, lettuces): green lines on the loam
				float pl = smoothstep(0.1, 0.3, t) * (1.0 - smoothstep(0.7, 0.9, t));
				fc = mix(soil, vec3(0.09, 0.2, 0.05) * (0.9 + 0.2 * n2), mix(0.55, pl, aa));
			} else if (crop < 4.5) {
				// fallow: turned earth, the harrow's lines faint in it
				fc = soil * (1.08 + 0.06 * mix(0.0, sin(t * 6.2832), aa));
			} else {
				// a cover crop, wild mustard yellow through it in spring
				fc = mix(vec3(0.14, 0.26, 0.06), vec3(0.55, 0.47, 0.07), (1.0 - uSeason * 0.7) * smoothstep(0.45, 0.7, wVn(w / 25.0 + id)));
			}
			// the headland round each field, and a dirt farm road down some of its edges
			float e = min(min(fq.x, S.x - fq.x), min(fq.y, S.y - fq.y));
			fc = mix(fc, c, 1.0 - smoothstep(2.0, 3.5, e));
			float road = max(mod(flags, 2.0) > 0.5 ? 1.0 - smoothstep(3.0, 4.0, fq.x) : 0.0, mod(flags, 4.0) >= 2.0 ? 1.0 - smoothstep(3.0, 4.0, fq.y) : 0.0);
			fc = mix(fc, mix(vec3(0.34, 0.25, 0.17), vec3(0.42, 0.32, 0.22), n2), road);
			c = mix(c, fc, farmOK);
		}
	}
	return c;
}`;

// CPU twin of the GLSL cliff delta, for walking
let cliffData = null;
export function cliffDelta(x, z) {
	const R = COAST_U.uCliffR.value;
	if (R.w < 0.5 || !cliffData) return 0;
	const u = (x - R.x) / CCELL - 0.5, v = (z - R.y) / CCELL - 0.5;
	if (u < 0 || v < 0 || u >= CN - 1 || v >= CN - 1) return 0;
	const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, D = cliffData;
	const d = (D[j * CN + i] * (1 - fu) + D[j * CN + i + 1] * fu) * (1 - fv) + (D[(j + 1) * CN + i] * (1 - fu) + D[(j + 1) * CN + i + 1] * fu) * fv;
	const eu = (x - R.x) / R.z, ev = (z - R.y) / R.z, e = Math.min(eu, ev, 1 - eu, 1 - ev), edge = Math.max(0, Math.min(1, e / 0.1));
	return d * edge * edge * (3 - 2 * edge);
}

// the same integer value noise as the ground's wVn
function iHash(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
const h01 = (x, y) => (iHash(x, y) >>> 8) / 16777216;

function vnI(x, y) {
	const i = Math.floor(x), j = Math.floor(y); let u = x - i, v = y - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
	const a = h01(i, j), b = h01(i + 1, j), c = h01(i, j + 1), d = h01(i + 1, j + 1);
	return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
// the fields and the links, for the wild trees and brush to keep off (city.js)
const FIELDS = { data: null, W: 0, H: 0, i0: 0, j0: 0, v: 0 };
export const coastVersion = () => FIELDS.v;
export function inCoastField(x, z) {
	if (!FIELDS.data || x < NW.x || x > SE.x || z < NW.z || z > SE.z) return false;
	if (Math.hypot((x - RITZ.x) / 650, (z - RITZ.z) / 1500) < 0.95) return true;
	const dx = x - FO.x, dz = z - FO.z;
	const qx = dx * FC + dz * FS + (vnI(x / 310, z / 310) - 0.5) * FWARP, qz = -dx * FS + dz * FC + (vnI(x / 310 + 17, z / 310 + 5) - 0.5) * FWARP;
	const i = Math.floor(qx / FX) - FIELDS.i0, j = Math.floor(qz / FZ) - FIELDS.j0;
	if (i < 0 || j < 0 || i >= FIELDS.W || j >= FIELDS.H) return false;
	return FIELDS.data[(j * FIELDS.W + i) * 4] > 0;
}

export function createCoastside({ groundAt, urbanAt, group, isPhone = false }) {
	const rowsX = new Float32Array(NROW);
	const rowsTex = new THREE.DataTexture(rowsX, NROW, 1, THREE.RedFormat, THREE.FloatType);
	rowsTex.magFilter = rowsTex.minFilter = THREE.NearestFilter;
	COAST_U.uCsRows.value = rowsTex;
	const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
	COAST_U.uCsField.value = blank;
	const cliffHalf = new Uint16Array(CN * CN), cliff = new Float32Array(CN * CN);
	const cliffTex = new THREE.DataTexture(cliffHalf, CN, CN, THREE.RedFormat, THREE.HalfFloatType);
	cliffTex.magFilter = cliffTex.minFilter = THREE.LinearFilter; cliffTex.generateMipmaps = false;
	COAST_U.uCliff.value = cliffTex;
	cliffData = cliff;

	const seaX = (z) => { const f = Math.max(0, Math.min(NROW - 1.001, (z - NW.z) / ROW)), i = Math.floor(f); return rowsX[i] + (rowsX[i + 1] - rowsX[i]) * (f - i); };
	const seaDist = (x, z) => (x - seaX(z)) * 0.94;

	// ---------- the work, a slice at a time (a few ms a frame) ----------
	const jobs = [];
	let job = null;
	function work(budget) {
		const t0 = performance.now();
		while (performance.now() - t0 < budget) {
			if (!job) { job = jobs.shift(); if (!job) return; }
			if (job.next()?.done) job = null;
		}
	}

	// the shore: every 100 m down the coast, where the land begins, marching in from the sea
	function* shoreJob() {
		for (let r = 0; r < NROW; r++) {
			const z = NW.z + r * ROW;
			let x = NW.x, found = SE.x;
			for (; x < SE.x; x += 20) {
				if (groundAt(x, z) > 0.8 && groundAt(x + 30, z) > 0.5 && groundAt(x + 60, z) > 0.5) {
					let a = x - 20;
					while (a < x && groundAt(a, z) <= 0.8) a += 2;
					found = a; break;
				}
			}
			rowsX[r] = found;
			yield;
		}
		rowsTex.needsUpdate = true;
		COAST_U.uCsRow.value.w = 1;
		jobs.push(fieldJob(), trailJob());
	}

	// the fields: which crop, rows along which way, which edges have a road, a barn or not
	const fields = { tex: null, list: [] };
	function* fieldJob() {
		// the turned grid's range over the coast's box
		const corners = [[NW.x, NW.z], [SE.x, NW.z], [NW.x, SE.z], [SE.x, SE.z]].map(([x, z]) => { const dx = x - FO.x, dz = z - FO.z; return [(dx * FC + dz * FS) / FX, (-dx * FS + dz * FC) / FZ]; });
		const i0 = Math.floor(Math.min(...corners.map((c) => c[0]))) - 1, i1 = Math.ceil(Math.max(...corners.map((c) => c[0]))) + 1;
		const j0 = Math.floor(Math.min(...corners.map((c) => c[1]))) - 1, j1 = Math.ceil(Math.max(...corners.map((c) => c[1]))) + 1;
		const W = i1 - i0 + 1, H = j1 - j0 + 1, data = new Uint8Array(W * H * 4);
		COAST_U.uCsO.value.z = i0; COAST_U.uCsO.value.w = j0;
		for (let j = j0; j <= j1; j++) {
			for (let i = i0; i <= i1; i++) {
				const qx = (i + 0.5) * FX, qz = (j + 0.5) * FZ, x = FO.x + qx * FC - qz * FS, z = FO.z + qx * FS + qz * FC;
				if (x < NW.x || x > SE.x || z < NW.z || z > SE.z) continue;
				const sd = seaDist(x, z);
				if (sd < 90 || sd > 3600) continue;
				const h = groundAt(x, z);
				if (h < 6 || h > 130) continue;
				const e = 60, gx = (groundAt(x + e, z) - groundAt(x - e, z)) / (2 * e), gz = (groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e);
				if (Math.hypot(gx, gz) > 0.1 || urbanAt(x, z).u > 0.05) continue;
				const dr = Math.hypot((x - RITZ.x) / 650, (z - RITZ.z) / 1500);
				if (dr < 1.1) continue;
				const r = h01(i * 7 + 3, j * 13 + 5);
				if (r > 0.62) continue;                               // pasture and the odd empty field between the farms
				const rr = r / 0.62;
				const crop = rr < 0.42 ? 1 : rr < 0.64 ? 2 : rr < 0.8 ? 3 : rr < 0.9 ? 4 : 5;
				// rows along the contour where there is a fall to follow, else along the field
				let th = Math.hypot(gx, gz) > 0.012 ? Math.atan2(gz, gx) + Math.PI / 2 : FA + Math.PI / 2;
				th = ((th % Math.PI) + Math.PI) % Math.PI;
				const r2 = h01(i + 101, j - 57);
				const flags = (r2 < 0.7 ? 1 : 0) | (r2 > 0.4 ? 2 : 0) | (h01(i - 9, j + 31) < 0.25 ? 4 : 0);
				const k = ((j - j0) * W + (i - i0)) * 4;
				data[k] = crop * 40; data[k + 1] = Math.round(th / Math.PI * 255); data[k + 2] = Math.round(r2 * 255); data[k + 3] = flags;
				// a barn at the corner of a few fields, by the farm road
				if (h01(i * 3 - 11, j * 5 + 2) < 0.02) fields.list.push({ i, j, x, z, qx, qz, th, r2, flags });
			}
			yield;
		}
		const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
		tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
		fields.tex = tex;
		COAST_U.uCsField.value = tex;
		Object.assign(FIELDS, { data, W, H, i0, j0, v: FIELDS.v + 1 });
		buildBarns();
	}

	// ---------- barns ----------
	function buildBarns() {
		const bodyG = [], roofG = [];
		const body = new THREE.Shape([new THREE.Vector2(-6, 0), new THREE.Vector2(6, 0), new THREE.Vector2(6, 5), new THREE.Vector2(0, 9), new THREE.Vector2(-6, 5)]);
		const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 20, bevelEnabled: false });
		bodyGeo.translate(0, 0, -10);
		const roofGeo = new THREE.BoxGeometry(7.6, 0.25, 21);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
		for (const f of fields.list) {
			// in the field's corner, beside its road
			const ox = -FX / 2 + 16, oz = -FZ / 2 + 22, x = f.x + ox * FC - oz * FS, z = f.z + ox * FS + oz * FC;
			let y = 1e9;
			for (const [a, b] of [[-8, -12], [8, -12], [-8, 12], [8, 12]]) y = Math.min(y, groundAt(x + a, z + b));
			const yaw = -FA + (f.r2 > 0.5 ? Math.PI / 2 : 0);
			const b = bodyGeo.clone();
			b.applyMatrix4(m4.compose(new THREE.Vector3(x, y - 0.4, z), q.setFromAxisAngle(Y, yaw), new THREE.Vector3(1, 1, 1)));
			const tone = f.r2 < 0.55 ? [0.36, 0.1, 0.07] : [0.42, 0.39, 0.34];      // barn red, or grey weathered board
			const col = new Float32Array(b.attributes.position.count * 3);
			for (let k = 0; k < col.length; k += 3) col.set(tone, k);
			b.setAttribute('color', new THREE.BufferAttribute(col, 3));
			bodyG.push(b);
			for (const s of [-1, 1]) {
				const r = roofGeo.clone();
				const tilt = new THREE.Quaternion().setFromAxisAngle(Z, -s * Math.atan2(4, 6));
				r.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(s * 3.05, 7.1, 0), tilt, new THREE.Vector3(1, 1, 1)));
				r.applyMatrix4(m4.compose(new THREE.Vector3(x, y - 0.4, z), q.setFromAxisAngle(Y, yaw), new THREE.Vector3(1, 1, 1)));
				roofG.push(r);
			}
		}
		if (!bodyG.length) return;
		const merge = (list) => {
			const out = new THREE.BufferGeometry(), P = [], N = [], C = [];
			for (const g0 of list) {
				const g = g0.index ? g0.toNonIndexed() : g0;
				P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array);
				if (g.attributes.color) C.push(...g.attributes.color.array);
			}
			out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
			if (C.length) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
			return out;
		};
		const barns = new THREE.Mesh(merge(bodyG), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
		const roofs = new THREE.Mesh(merge(roofG), new THREE.MeshStandardMaterial({ color: 0x5f615f, roughness: 0.6, metalness: 0.3 }));
		for (const m of [barns, roofs]) { m.castShadow = !isPhone; m.receiveShadow = true; m.name = 'coast-barns'; group.add(m); }
	}

	// ---------- the Coastal Trail and its split-rail fence, along the lip ----------
	function* trailJob() {
		const STEP = 4, pts = [];
		let n = 0;
		for (let z = TRAIL_S; z >= TRAIL_N; z -= STEP) {
			// march in from the shore: up the face to where the top levels off
			const sx = seaX(z);
			let lip = null;
			for (let x = sx - 40; x < sx + 260; x += 2) {
				const h = groundAt(x, z);
				if (h < 5) continue;
				if ((groundAt(x + 6, z) - h) / 6 < 0.12) { if (h < 45) lip = { x, z, h }; break; }
			}
			pts.push(lip);
			if (++n % 3 === 0) yield;
		}
		// smooth runs of lip into lines, broken where a ravine or a beach cuts the bluff
		const runs = [];
		let run = [];
		for (let k = 0; k < pts.length; k++) {
			const p = pts[k], prev = run[run.length - 1];
			if (!p || (prev && Math.abs(p.x - prev.x) > 9)) { if (run.length > 12) runs.push(run); run = []; if (!p) continue; }
			run.push(p);
		}
		if (run.length > 12) runs.push(run);
		for (const r of runs) {
			const xs = r.map((p) => p.x);
			for (let pass = 0; pass < 3; pass++) for (let k = 1; k < r.length - 1; k++) xs[k] = (xs[k - 1] + xs[k] * 2 + xs[k + 1]) / 4;
			r.forEach((p, k) => { p.x = xs[k]; });
		}
		yield;
		buildTrail(runs);
	}
	function buildTrail(runs) {
		if (!runs.length) return;
		// the trail: a band of packed decomposed-granite, 2 m wide, some 9 m in from the edge
		const P = [], C = [], I = [];
		const posts = [];
		for (const r of runs) {
			const base = P.length / 3;
			for (let k = 0; k < r.length; k++) {
				const a = r[Math.max(0, k - 1)], b = r[Math.min(r.length - 1, k + 1)];
				let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
				// inland is east: the normal pointing that way
				let nx = -tz, nz = tx; if (nx < 0) { nx = -nx; nz = -nz; }
				const cx = r[k].x + nx * 9, cz = r[k].z + nz * 9;
				for (const s of [-1, 1]) {
					const x = cx + nx * s * 1.1, z = cz + nz * s * 1.1;
					P.push(x, groundAt(x, z) + cliffDelta(x, z) + 0.07, z);
					const v = 0.9 + 0.2 * h01(Math.floor(x), Math.floor(z));
					C.push(0.34 * v, 0.26 * v, 0.17 * v);
				}
				if (k > 0) { const o = base + (k - 1) * 2; I.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
				// the fence, between the trail and the edge
				posts.push({ x: r[k].x + nx * 5.5, z: r[k].z + nz * 5.5 });
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		g.setIndex(I);
		g.computeVertexNormals();
		const trail = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
		trail.receiveShadow = true; trail.name = 'coastal-trail';
		group.add(trail);
		// a post at every row (about 4 m apart), two rails between them
		const postGeo = new THREE.BoxGeometry(0.16, 1.2, 0.16), railGeo = new THREE.BoxGeometry(1, 0.1, 0.12);
		const wood = new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.95 });
		const pts = posts;
		const postM = new THREE.InstancedMesh(postGeo, wood, pts.length), railM = new THREE.InstancedMesh(railGeo, wood, pts.length * 2);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3();
		let nr = 0;
		const ys = pts.map((p) => groundAt(p.x, p.z) + cliffDelta(p.x, p.z));
		for (let k = 0; k < pts.length; k++) {
			const p = pts[k];
			postM.setMatrixAt(k, m4.compose(new THREE.Vector3(p.x, ys[k] + 0.5, p.z), q.identity(), S.set(1, 1, 1)));
			const b = pts[k + 1];
			if (!b || Math.hypot(b.x - p.x, b.z - p.z) > 8) continue;
			const L = Math.hypot(b.x - p.x, b.z - p.z), yaw = Math.atan2(-(b.z - p.z), b.x - p.x);
			for (const hh of [0.45, 0.95]) {
				railM.setMatrixAt(nr++, m4.compose(new THREE.Vector3((p.x + b.x) / 2, (ys[k] + ys[k + 1]) / 2 + hh, (p.z + b.z) / 2), q.setFromAxisAngle(Y, yaw), S.set(L + 0.1, 1, 1)));
			}
		}
		railM.count = nr;
		for (const m of [postM, railM]) { m.castShadow = !isPhone; m.receiveShadow = true; m.frustumCulled = false; m.name = 'coastal-fence'; group.add(m); }
	}

	// ---------- the cliffs round you: the survey's ramps steepened into faces ----------
	let ccx = 1e9, ccz = 1e9, busy = false;
	const raw = new Float32Array(CN * CN), lo = new Float32Array(CN * CN), hi = new Float32Array(CN * CN), tmp = new Float32Array(CN * CN), next = new Float32Array(CN * CN);
	function* cliffJob(x, z) {
		busy = true;
		const x0 = Math.floor((x - CSIZE / 2) / CCELL) * CCELL, z0 = Math.floor((z - CSIZE / 2) / CCELL) * CCELL;
		let any = false;
		for (let j = 0; j < CN; j++) {
			const wz = z0 + (j + 0.5) * CCELL, sx = seaX(wz);
			for (let i = 0; i < CN; i++) {
				const wx = x0 + (i + 0.5) * CCELL, d = (wx - sx) * 0.94;
				// only the first couple of hundred metres in from the shore
				raw[j * CN + i] = d > -40 && d < 260 ? groundAt(wx, wz) : NaN;
				if (d > -40 && d < 260) any = true;
			}
			if (j % 2 === 1) yield;
		}
		next.fill(0);
		if (any) {
			// the foot and the top within 20 m (separable min and max over a 9-cell window)
			const R = 4;
			for (const [src, dst, f] of [[raw, lo, Math.min], [raw, hi, Math.max]]) {
				for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
					let m = src[j * CN + i];
					for (let k = Math.max(0, i - R); k <= Math.min(CN - 1, i + R); k++) { const v = src[j * CN + k]; if (v === v) m = m === m ? f(m, v) : v; }
					tmp[j * CN + i] = m;
					if (i === CN - 1 && j % 64 === 63) yield;
				}
				yield;
				for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
					let m = tmp[j * CN + i];
					for (let k = Math.max(0, j - R); k <= Math.min(CN - 1, j + R); k++) { const v = tmp[k * CN + i]; if (v === v) m = m === m ? f(m, v) : v; }
					dst[j * CN + i] = m;
					if (i === CN - 1 && j % 64 === 63) yield;
				}
				yield;
			}
			for (let k = 0; k < CN * CN; k++) {
				const h = raw[k], b = Math.max(0.4, lo[k]), t = hi[k];
				if (!(h === h) || h < 0.5 || t - b < 6 || b > 4 || t > 90) continue;
				// where the ground climbs from a foot near the sea to a top, snap it to one or the other
				const u = Math.max(0, Math.min(1, (h - b) / (t - b)));
				const s = u < 0.4 ? 0 : u > 0.6 ? 1 : (u - 0.4) / 0.2;
				const sharp = s * s * (3 - 2 * s);
				next[k] = (b + (t - b) * sharp - h) * 0.9;
			}
		}
		yield;
		cliff.set(next);
		for (let k = 0; k < CN * CN; k++) cliffHalf[k] = THREE.DataUtils.toHalfFloat(cliff[k]);
		cliffTex.needsUpdate = true;
		COAST_U.uCliffR.value.set(x0, z0, CSIZE, any ? 1 : 0);
		busy = false;
	}

	function update(cam) {
		const x = cam.position.x, z = cam.position.z;
		const inCoast = x > NW.x - 2000 && x < SE.x + 2000 && z > NW.z - 2000 && z < SE.z + 2000;
		if (COAST_U.uCsRow.value.w > 0.5 && inCoast && !busy && cam.position.y < 2500) {
			const sd = seaDist(x, z);
			if (sd < 1800 && Math.hypot(x - ccx, z - ccz) > 350) { ccx = x; ccz = z; jobs.unshift(cliffJob(x, z)); }
		}
		if (!inCoast && COAST_U.uCliffR.value.w > 0.5) { COAST_U.uCliffR.value.w = 0; ccx = 1e9; }
		work(isPhone ? 4 : 6);
	}
	// the shore is found once the heights are in
	function start() { if (!jobs.length && COAST_U.uCsRow.value.w < 0.5) jobs.push(shoreJob()); }
	// (for the tests: the cliff grid, the work still queued, what stands)
	const info = () => ({ cliff: COAST_U.uCliffR.value.toArray().map(Math.round), jobs: jobs.length + (job ? 1 : 0), shore: COAST_U.uCsRow.value.w, barns: fields.list.length, built: group.children.filter((c) => /coast/.test(c.name)).map((c) => c.name + (c.count ?? '')) });
	// (and for the tests, where frames come a second apart: finish the queued work now)
	const flush = () => work(20000);
	return { update, start, seaDist, fields, info, flush };
}
