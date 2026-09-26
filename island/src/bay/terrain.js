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
import { LEVELS, LAT0, LON0, KX, KZ, H_OFF, H_SCALE, toWorld } from './geo.js';
import { PLACES } from './places.js';
import { bearingFor, styleFor, localOverride, WARP_GLSL, STYLE, sfDistrict } from './styles.js';
import { REAL_U, REAL_GLSL } from './realcity.js';

// ---------- the shared GLSL: height from the finest level that covers a point ----------
export const BAY_GLSL = /* glsl */`
uniform highp sampler2D uB0, uB1, uB2, uB3, uB4, uB5, uB6; uniform vec4 uR0, uR1, uR2, uR3, uR4, uR5, uR6; uniform float uBayOn;
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
	float k1 = bIn(uB1, uR1, w, 1500.0); if (k1 > 0.0) h = mix(h, bLevel(uB1, uR1, w), k1);
	float k2 = bIn(uB2, uR2, w, 500.0); if (k2 > 0.0) h = mix(h, bLevel(uB2, uR2, w), k2);
	float k3 = bIn(uB3, uR3, w, 400.0); if (k3 > 0.0) h = mix(h, bLevel(uB3, uR3, w), k3);
	float k4 = bIn(uB4, uR4, w, 400.0); if (k4 > 0.0) h = mix(h, bLevel(uB4, uR4, w), k4);
	float k5 = bIn(uB5, uR5, w, 400.0); if (k5 > 0.0) h = mix(h, bLevel(uB5, uR5, w), k5);
	float k6 = bIn(uB6, uR6, w, 400.0); if (k6 > 0.0) h = mix(h, bLevel(uB6, uR6, w), k6);
	return h;
}
`;

// the colour of each kind of real land use (0: leave the natural ground)
const REAL_LAND = /* glsl */`
vec3 realLand(float lu, vec3 nat, float gn, float gf, vec2 w){
	vec3 lawn = mix(vec3(0.2, 0.34, 0.1), vec3(0.3, 0.41, 0.15), gn);
	vec3 dry = mix(lawn, mix(vec3(0.5, 0.45, 0.28), vec3(0.6, 0.53, 0.34), gn), uSeason);
	if (lu < 0.5 || lu > 10.5) return nat;
	if (lu < 1.5) {
		// yards: lawns (a few browned off), planting beds, shade
		vec3 y = mix(lawn, dry, smoothstep(0.55, 0.8, gf) * 0.6);
		return mix(y, vec3(0.3, 0.24, 0.16), smoothstep(0.62, 0.72, vn(w * 0.35)) * 0.5);
	}
	if (lu < 2.5) return mix(lawn, dry, smoothstep(0.6, 0.85, gf) * 0.4);
	if (lu < 3.5) return mix(vec3(0.24, 0.42, 0.13), vec3(0.3, 0.47, 0.16), step(0.5, fract(dot(w, vec2(0.6, 0.8)) / 14.0)));
	if (lu < 4.5) return mix(vec3(0.26, 0.47, 0.15), vec3(0.3, 0.52, 0.18), step(0.5, fract(w.x / 5.0)));
	if (lu < 5.5) return mix(vec3(0.52, 0.4, 0.28), vec3(0.62, 0.5, 0.36), gn);
	if (lu < 6.5) return mix(lawn, vec3(0.3, 0.3, 0.31), step(0.7, gf));
	// commercial and retail: parking with landscaped islands and borders
	if (lu < 7.5) return mix(mix(vec3(0.25, 0.25, 0.26), vec3(0.31, 0.31, 0.32), gn), lawn * 0.9, smoothstep(0.58, 0.64, vn(w * 0.05) * 0.7 + gf * 0.3));
	if (lu < 8.5) return mix(vec3(0.45, 0.44, 0.42), vec3(0.55, 0.54, 0.5), gn);
	if (lu < 9.5) return vec3(0.84, 0.79, 0.64);
	return vec3(0.1, 0.2, 0.22);
}
`;
const OFF = new THREE.Vector4(1e9, 1e9, 1, 0);
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
	return { uB0: { value: blank() }, uB1: { value: blank() }, uB2: { value: blank() }, uB3: { value: blank() }, uB4: { value: blank() }, uB5: { value: blank() }, uB6: { value: blank() }, uR0: { value: OFF.clone() }, uR1: { value: OFF.clone() }, uR2: { value: OFF.clone() }, uR3: { value: OFF.clone() }, uR4: { value: OFF.clone() }, uR5: { value: OFF.clone() }, uR6: { value: OFF.clone() }, uBayOn: { value: 0 } };
}

// the towns: how far each one's streets reach, their street-grid angle, and the
// downtowns where buildings stand tall
const CBD = [[37.7925, -122.399, 1, 1300], [37.7785, -122.395, 0.55, 900], [37.8044, -122.2712, 0.6, 800], [37.3337, -121.8907, 0.5, 900], [37.87, -122.268, 0.25, 500], [37.901, -122.061, 0.25, 500], [37.8313, -122.2852, 0.3, 450], [37.5630, -122.3255, 0.15, 500], [37.4443, -122.1598, 0.15, 400], [38.4404, -122.7141, 0.2, 500], [37.978, -122.031, 0.2, 500], [37.3861, -122.0839, 0.15, 500], [37.3688, -122.0363, 0.15, 500], [37.4852, -122.2364, 0.15, 400]];
// open land inside the towns: Alcatraz, Angel Island and Yerba Buena Island, San Ramon's Central Park and the Crow Canyon golf course,
// Lake Merritt, and in San Francisco the parks, the Presidio, the hills
const PARKS = [[37.8267, -122.4230, 420, 320, 0], [37.8609, -122.4326, 1500, 1500, 0], [37.8103, -122.3636, 650, 550, 0], [37.7650, -121.9522, 260, 200, 0], [37.7880, -121.9720, 500, 350, 0.15], [37.8290, -122.2600, 600, 450, 0], [37.7690, -122.4830, 2600, 450, 0], [37.7989, -122.4662, 1500, 1100, 0.3], [37.7544, -122.4477, 700, 700, 0], [37.7580, -122.4570, 600, 600, 0], [37.7200, -122.4950, 800, 900, 0], [37.7180, -122.4200, 700, 500, 0.5], [37.7850, -122.5050, 500, 400, 0]];
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
	function heightAt(x, z) {
		if (!levels[0]) return -60;
		const L0 = levels[0], e0 = levelH(L0, x, z);
		const qx = (x - L0.x0) / L0.step, qz = (z - L0.zN) / L0.step;
		const dOut = Math.hypot(Math.max(0, -qx, qx - (L0.W - 1)), Math.max(0, -qz, qz - (L0.H - 1))) * L0.step;
		let h = beyondH(x, z, e0, dOut) + (e0 - beyondH(x, z, e0, dOut)) * levelIn(L0, x, z, 3000);
		if (levels[1]) { const k = levelIn(levels[1], x, z, 1500); if (k > 0) h += (levelH(levels[1], x, z) - h) * k; }
		if (levels[2]) { const k = levelIn(levels[2], x, z, 500); if (k > 0) h += (levelH(levels[2], x, z) - h) * k; }
		for (let i = 3; i < levels.length; i++) if (levels[i]) { const k = levelIn(levels[i], x, z, 400); if (k > 0) h += (levelH(levels[i], x, z) - h) * k; }
		return h;
	}

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
		levels[i] = { x0, zN, step: L.step, W, H, v };
		const tex = new THREE.DataTexture(half, W, H, THREE.RedFormat, THREE.HalfFloatType);
		tex.minFilter = tex.magFilter = THREE.NearestFilter;
		tex.needsUpdate = true;
		BU['uB' + i].value = tex;
		BU['uR' + i].value.set(x0, zN, L.step, 0);
		if (i === 0) { BU.uBayOn.value = 1; buildUrban(); }
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
			Object.assign(sh.uniforms, BU, U2, REAL_U, { uUrban, uUR, uRot, uNightB, uTime: shared.uTime });
			sh.vertexShader = 'uniform vec2 uC;\nvarying vec2 vBW; varying float vBH; varying vec3 vBN;\n' + BAY_GLSL + sh.vertexShader
				.replace('#include <beginnormal_vertex>', `
					vec2 bw = position.xz + uC;
					float bh = bayHeight(bw);
					float be = max(6.0, length(position.xz) * 0.006);
					vec3 objectNormal = normalize(vec3(bayHeight(bw - vec2(be, 0.0)) - bayHeight(bw + vec2(be, 0.0)), 2.0 * be, bayHeight(bw - vec2(0.0, be)) - bayHeight(bw + vec2(0.0, be))));
					vBN = objectNormal;`)
				.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, bh, position.z); vBW = bw; vBH = bh;');
			sh.fragmentShader = 'uniform sampler2D uUrban, uRot; uniform vec4 uUR; uniform float uNightB, uIslHalf, uHole, uTime; uniform vec2 uHoleC;\nvarying vec2 vBW; varying float vBH; varying vec3 vBN;\nvec3 cityGlow = vec3(0.0); float flatK = 0.0;\n' + NOISE_GLSL + '\n' + SPARKS_GLSL + '\n' + WARP_GLSL + '\n' + REAL_GLSL + '\n' + REAL_LAND + '\n' + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
					if (max(abs(vBW.x), abs(vBW.y)) < uIslHalf) discard;                           // the island draws itself
					if (uHole > 0.5 && max(abs(vBW.x - uHoleC.x), abs(vBW.y - uHoleC.y)) < 3900.0) discard;   // the near ring draws here`)
				.replace('#include <color_fragment>', `#include <color_fragment>
				{
					vec3 n = normalize(vBN); float slope = 1.0 - n.y, h = vBH;
					float n1 = fbm3(vBW * 0.0025), n2 = fbm3(vBW * 0.021), n3 = vn(vBW * 0.23);
					// the fog belt: the coast ranges and the west-facing hills stay green and wooded
					float fogbelt = 1.0 - smoothstep(22000.0, 58000.0, vBW.x);
					float north = clamp(-n.z * 2.2, 0.0, 1.0) * smoothstep(0.04, 0.25, slope);
					float south = clamp(n.z * 2.2, 0.0, 1.0) * smoothstep(0.08, 0.3, slope);
					// the grass: green in the rainy season, gold by summer (uSeason 0..1)
					vec3 gold = mix(vec3(0.6, 0.48, 0.27), vec3(0.75, 0.63, 0.37), n2);
					vec3 spring = mix(vec3(0.2, 0.36, 0.07), vec3(0.33, 0.47, 0.1), n2);
					gold = mix(spring, gold, clamp(uSeason + (n1 - 0.5) * 0.3 + slope * 0.4 * uSeason, 0.0, 1.0));
					vec3 c = gold;
					float chap = south * smoothstep(0.2, 0.5, n1 + slope * 0.6) * (1.0 - fogbelt * 0.4);
					c = mix(c, mix(vec3(0.27, 0.28, 0.18), vec3(0.35, 0.34, 0.22), n3), chap * 0.85);
					float oak = smoothstep(0.42, 0.68, n1 + north * 0.4 + fogbelt * 0.12 - south * 0.15 + (n2 - 0.5) * 0.3);
					c = mix(c, mix(vec3(0.12, 0.16, 0.07), vec3(0.19, 0.23, 0.11), n3), oak * 0.88);
					float forest = smoothstep(0.55, 0.78, n1 * 0.55 + north * 0.45 + fogbelt * 0.45) * smoothstep(40.0, 180.0, h);
					c = mix(c, mix(vec3(0.05, 0.1, 0.05), vec3(0.08, 0.14, 0.07), n3), forest * 0.92);
					c = mix(c, mix(vec3(0.4, 0.38, 0.34), vec3(0.52, 0.49, 0.44), n2), smoothstep(0.55, 0.85, slope));
					// sand at the water's edge, mud and sand under water
					float beach = (1.0 - smoothstep(1.2, 5.0, h)) * (1.0 - smoothstep(0.08, 0.25, slope)) * step(-0.5, h);
					c = mix(c, vec3(0.8, 0.74, 0.6), beach);
					c = mix(c, vec3(0.4, 0.38, 0.31), smoothstep(0.3, -1.5, h));
					// the towns: a street grid at the town's own angle, roofs, trees, parks
					vec2 uu = (vBW - uUR.xy) / uUR.z;
					vec2 US = vec2(textureSize(uUrban, 0));
					vec4 T = texture2D(uUrban, uu / US);
					float urban = T.r * (1.0 - smoothstep(0.25, 0.4, slope)) * smoothstep(0.4, 1.5, h);
					float dist = length(cameraPosition - vec3(vBW.x, vBH, vBW.y));
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
						float Y1 = texture2D(uPaintMap, clamp(ru, 0.0, 1.0)).r;
						vec4 f1 = max(fwidth(D1) * 0.75, vec4(0.004)), f2 = max(fwidth(D2) * 0.75, vec4(0.004));
						vec4 C1 = smoothstep(0.5 - f1, 0.5 + f1, D1), C2 = smoothstep(0.5 - f2, 0.5 + f2, D2);
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
						c = mix(c, dirtC, dirt);
						c = mix(c, concC, conc);
						// the gutter: a darker band just inside the asphalt edge; the kerb: a pale lip
						// just outside it (the fine map's distance, 0.5 m ramp: d = (0.5 - v) metres)
						float dK = 0.5 - D1.r;
						float kerb = smoothstep(-0.02, 0.02, dK) * (1.0 - smoothstep(0.14, 0.18, dK)) * step(0.5, D1.g) * e1;
						float gutter = smoothstep(-0.45, -0.3, dK) * (1.0 - smoothstep(-0.02, 0.0, dK)) * step(0.5, D1.g) * e1;
						c = mix(c, asphC, asph);
						c = mix(c, c * 0.7, gutter);
						c = mix(c, vec3(0.76, 0.75, 0.72), kerb);
						c = mix(c, vec3(0.88, 0.88, 0.84), white * 0.92);
						c = mix(c, vec3(0.86, 0.68, 0.16), yellow * 0.92);
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
						float street = 1.0 - step(BK.z, fw.x) * step(BK.z, fw.y);
						float sidewalk = (1.0 - street) * (1.0 - step(BK.z + 2.5, fw.x) * step(BK.z + 2.5, fw.y) * step(fw.x, B.x - 2.5) * step(fw.y, B.y - 2.5));
						float lh = h21(floor(g / 17.0) + cid * 7.0);
						vec3 cityC;
						float down = T.b;
						if (sty < 1.5) {
							// San Francisco: pavement and flat roofs, the odd back garden
							vec3 roofF = mix(vec3(0.62, 0.61, 0.58), vec3(0.78, 0.76, 0.72), lh);
							// back gardens down the middle of each block
							float yard = step(abs(fw.y / B.y - 0.5), 0.12) * step(0.45, h21(floor(g / 8.0)));
							cityC = mix(roofF, vec3(0.22, 0.3, 0.14), yard * (sty > 0.5 ? 0.5 : 0.8));
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
						cityC = mix(cityC, vec3(0.62, 0.61, 0.58), sidewalk * 0.7);
						cityC = mix(cityC, vec3(0.2, 0.2, 0.21), street);
						// far off the grid melts into the town's average colour
						cityC = mix(cityC, vec3(0.45, 0.44, 0.42), smoothstep(1500.0, 6000.0, dist));
						c = mix(c, cityC, smoothstep(0.08, 0.35, urban));
						// night: street lamps along the grid, windows in the blocks; far away,
						// the town is a carpet of light
						float lamps = street * step(0.55, fract((g.x + g.y) / 32.0)) * step(0.9, h21(floor(g / 16.0)));
						float wins = (1.0 - street) * step(0.86, h21(floor(g / 9.0) + 5.0)) * (0.5 + T.b);
						// once a window block is smaller than a couple of pixels it is only its
						// average glow (as a mipmap would), so distant blocks do not crawl
						float mpp = length(fwidth(vBW));
						float lodW = smoothstep(4.5, 2.0, mpp);
						wins = mix(0.14 * (0.5 + T.b) * (1.0 - street), wins, lodW);
						lamps = mix(street * 0.05, lamps, smoothstep(8.0, 3.5, mpp));
						// (close by the real buildings carry their own lit windows: the ground's
						// stand-in windows only begin beyond them)
						float nearL = lamps * 1.2 * (1.0 - smoothstep(900.0, 3500.0, dist)) + wins * smoothstep(1100.0, 2000.0, dist) * (1.0 - smoothstep(2500.0, 5000.0, dist));
						// far off, points of light: streetlights and windows as a scatter of sparks,
						// thicker downtown, fixed to the ground and never smaller than a pixel
						float farL = sparks(vBW, dist, 0.86 - T.b * 0.2, 0.0) * (1.2 + T.b) * smoothstep(600.0, 3500.0, dist);
						cityGlow = mix(vec3(1.0, 0.62, 0.28), vec3(0.95, 0.9, 0.8), h21(floor(vBW / 18.0) + 3.0) * 0.5) * (nearL + farL) * smoothstep(0.08, 0.35, urban) * uNightB * 2.2;
					}
					diffuseColor.rgb = c * (0.88 + 0.24 * n3);
				}`)
				.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				{
					// fine relief the survey cannot see: gullies, knolls and grain, as a bump
					float dist2 = length(cameraPosition - vec3(vBW.x, vBH, vBW.y));
					float bh = (fbm3(vBW * 0.045) * 2.2 + fbm3(vBW * 0.22) * 0.5 + vn(vBW * 1.3) * 0.08) * (1.0 - smoothstep(1500.0, 6000.0, dist2)) * step(0.0, vBH);
					vec3 sp = -vViewPosition, vSx = dFdx(sp), vSy = dFdy(sp);
					vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
					float fDet = dot(vSx, R1);
					// paving is smooth: the relief fades under it (scaling the slope, not the height,
					// so the paving's edge draws no line of its own)
					vec2 dH = vec2(dFdx(bh), dFdy(bh)) * (1.0 - flatK * 0.9);
					normal = normalize(abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2));
				}`)
				.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cityGlow;');
		};
		m.customProgramCacheKey = () => 'bayground2' + (hole ? 'far' : 'near');
		m.userData.U2 = U2;
		return m;
	}
	const nearMat = groundMaterial(false), farMat = groundMaterial(true);
	const near = new THREE.Mesh(radialGrid(300, 4000, 2.0), nearMat), far = new THREE.Mesh(radialGrid(256, 95000, 2.6), farMat);
	for (const m of [near, far]) { m.frustumCulled = false; m.receiveShadow = true; m.userData.material175 = 'stone'; group.add(m); }
	near.visible = far.visible = false;

	function update(cam, night) {
		const on = BU.uBayOn.value > 0.5;
		near.visible = far.visible = on;
		if (!on) return;
		uNightB.value = night;
		const nx = Math.round(cam.position.x / 32) * 32, nz = Math.round(cam.position.z / 32) * 32;
		const fx = Math.round(cam.position.x / 512) * 512, fz = Math.round(cam.position.z / 512) * 512;
		near.position.set(nx, 0, nz); nearMat.userData.U2.uC.value.set(nx, nz);
		far.position.set(fx, 0, fz); farMat.userData.U2.uC.value.set(fx, fz); farMat.userData.U2.uHoleC.value.set(nx, nz);
	}
	return { group, update, heightAt, urbanAt, ready, towns, loaded: () => BU.uBayOn.value > 0.5, levels };
}
