// The Bay Area's fresh water: every mapped river, creek, canal and flood channel, every
// lake, reservoir and pond (Overture Maps' base/water, from OpenStreetMap: ODbL), baked by
// tools/bake-water.py with its hydrology worked out against the survey: each stream's
// level runs downhill the way it flows and meets what it joins; each lake sits where the
// survey holds its water.
//
// The lakes lie flat at their level, the ground under them let down (the survey's own
// heights at load, as bay/boardwalk.js regrades its park, and finer round you), their
// shores wet, their water clear in the shallows and dark and sky-bright further out; the
// reservoirs' earth dams rise where the ground falls away below them. The rivers are
// ribbons laid down their channels, the channels carved into the ground round you on a
// 2 m grid (watercarve.js): a bed, gravel at the water, banks cut back to the land; in
// town a flood channel is poured concrete. The water flows the way the stream does,
// quicker and white where it falls. Willows, alders and sycamores line the wild banks
// (redwoods in the fog belt). Where a mapped road crosses, a deck carries it over. The
// small intermittent creeks run low by late summer.
//
// Everything is streamed: 2 km tiles decoded, built and let go as you move, the carving
// done a slice a frame. The lower San Lorenzo (its mouth, the levees through Santa Cruz
// and up the valley to Felton) is bay/sanlorenzo.js's: this river stops where that begins.

import * as THREE from 'three';
import { toLatLon, KX, KZ, LON0, LAT0, H_OFF, H_SCALE } from './geo.js';
import { BAY_GLSL } from './terrain.js';
import { NOISE_GLSL } from '../world/terrain.js';
import { WC_U, WC_GLSL, WT, WN, createCarveAtlas, setWaterHooks, grewTrees, waterDelta } from './watercarve.js';
import { REAL_U } from './realcity.js';
import { inRiverWater } from './carve.js';
import { waterfowl } from '../world/creatures.js';

const W1 = WN + 1;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const h01 = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
async function gunzip(res) {
	const ds = new DecompressionStream('gzip');
	return new Uint8Array(await new Response(res.body.pipeThrough(ds)).arrayBuffer());
}

// ---------- the shapes ----------
// inside a lake's rings (holes are islands)?
function inRings(R, x, z) {
	let c = false;
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const az = r[i + 1], bz = r[j + 1];
		if ((az > z) !== (bz > z) && x < (r[j] - r[i]) * (z - az) / (bz - az) + r[i]) c = !c;
	}
	return c;
}
function edgeDist(R, x, z) {
	let best = 1e18;
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const ax = r[j], az = r[j + 1], dx = r[i] - ax, dz = r[i + 1] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
		if (d < best) best = d;
	}
	return Math.sqrt(best);
}
// how deep a lake goes, and how fast its bed falls from the shore, by kind
// (lake, reservoir, basin, pond, pool)
const DEEP = [[9, 0.1], [22, 0.16], [1.4, 0.08], [2.6, 0.1], [0.7, 0.3]];
const KIND_NAME = ['Lake', 'Reservoir', 'Basin', 'Pond', 'Pool'];
// a stream's depth at the middle, by its width
const depthOf = (w) => (w < 3 ? 0.28 + w * 0.1 : w < 15 ? 0.45 + w * 0.06 : Math.min(5, 1.1 + w * 0.02));

// ---------- the look of the water ----------
const COMMON = /* glsl */`
uniform float uTime, uNight, uSeason; uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor;
varying vec3 vW;
// the ground under the water here, as it is drawn
float groundUnder(vec2 w){ return bayHeight(w) + wcAt(w).r * wcK(w); }
vec3 skyIn(vec3 r, vec2 p){
	vec3 sky = mix(uSkyHor, uSkyZen, pow(max(r.y, 0.0), 0.5));
	// low down, the dark line of the hills and trees round the shore
	return mix(vec3(0.035, 0.05, 0.035) * (1.0 - uNight * 0.8), sky, smoothstep(0.03, 0.22, r.y + (vn(p * 0.02) - 0.5) * 0.1));
}
`;
const RIVER_VERT = /* glsl */`
attribute vec4 aC; attribute vec4 aF; attribute vec2 aT;
uniform float uSeason;
varying vec3 vW; varying vec2 vUv; varying vec4 vF; varying vec2 vT; varying float vDist;
#include <fog_pars_vertex>
void main(){
	vec3 p = position;
	// (the small creeks that dry up run narrow by late summer)
	float low = aF.z * smoothstep(0.55, 0.95, uSeason) * 0.6;
	p.xz = mix(p.xz, aC.xy, low);
	vec4 w = modelMatrix * vec4(p, 1.0);
	// far off it rides up a little over the coarser ground drawn there
	float d = length(cameraPosition.xz - w.xz);
	w.y += 0.03 + clamp(d * 0.0024 - 0.1, 0.0, 5.0);
	vW = w.xyz; vUv = aC.zw; vF = aF; vT = aT; vDist = d;
	vec4 mvPosition = viewMatrix * w;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
const RIVER_FRAG = /* glsl */`
varying vec2 vUv; varying vec4 vF; varying vec2 vT; varying float vDist;
#include <fog_pars_fragment>
float rip(vec2 q){ return vn(q) * 0.55 + vn(q * 2.3 + 5.1) * 0.3 + vn(q * 5.1 - 2.7) * 0.15; }
void main(){
	vec2 T = normalize(vT + vec2(1e-5, 0.0)), N = vec2(-T.y, T.x);
	float along = vUv.y, across = dot(vW.xz, N);
	float speed = vF.x, foamK = vF.y;
	// ripples carried downstream, stretched along the flow
	vec2 q = vec2(along * 0.55 - uTime * speed * 0.55, across * 1.3);
	float e = 0.08;
	float h0 = rip(q), ha = rip(q + vec2(e, 0.0)), hc = rip(q + vec2(0.0, e));
	float k = 0.35 + foamK * 0.9;
	vec2 g = vec2(ha - h0, hc - h0) / e * k * vec2(0.55, 1.3);
	vec3 n = normalize(vec3(-(g.x * T.x + g.y * N.x), 1.0, -(g.x * T.y + g.y * N.y)));
	n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(150.0, 900.0, vDist)));
	vec3 v = normalize(cameraPosition - vW), r = reflect(-v, n);
	float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
	// how deep: clear over the gravel at the edges, dark green-brown in the pools
	float depth = vW.y - groundUnder(vW.xz);
	float nearK = 1.0 - smoothstep(700.0, 1100.0, vDist);
	float deepK = mix(0.8, smoothstep(0.05, 1.4, depth), nearK);
	vec3 deep = mix(vec3(0.025, 0.05, 0.04), vec3(0.05, 0.06, 0.035), foamK) * (1.0 - uNight * 0.85);
	vec3 col = mix(deep, skyIn(r, vW.xz) * vec3(0.8, 0.9, 0.85), fres);
	col += uSunColor * pow(max(dot(r, uSunDir), 0.0), 300.0) * 4.0 * (1.0 - uNight);
	// white water where it falls, streaked downstream; a thin lace along the edges
	float fo = foamK * smoothstep(0.45, 0.8, rip(q * vec2(1.4, 2.2) + 11.0) + foamK * 0.25);
	fo += (1.0 - smoothstep(0.02, 0.12, depth)) * 0.35 * smoothstep(0.5, 0.7, rip(q * 3.0)) * nearK;
	col = mix(col, vec3(0.85, 0.88, 0.86) * (1.0 - uNight * 0.8), clamp(fo, 0.0, 0.9));
	float a = clamp(0.28 + deepK * 0.62 + fres * 0.25 + fo, 0.0, 0.96);
	// (its edges soft where they run up the bank)
	a *= 1.0 - smoothstep(0.82, 1.0, abs(vUv.x));
	gl_FragColor = vec4(col, a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;
const LAKE_VERT = /* glsl */`
varying vec3 vW; varying float vDist;
#include <fog_pars_vertex>
void main(){
	vec4 w = modelMatrix * vec4(position, 1.0);
	vW = w.xyz; vDist = length(cameraPosition.xz - w.xz);
	vec4 mvPosition = viewMatrix * w;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
const LAKE_FRAG = /* glsl */`
uniform vec3 uTint; uniform float uLevel;
varying float vDist;
#include <fog_pars_fragment>
float wave(vec2 p){ return vn(p * 0.35 + uTime * vec2(0.05, 0.03)) * 0.6 + vn(p * 1.1 - uTime * vec2(0.04, 0.07)) * 0.3 + vn(p * 3.3 + uTime * vec2(0.11, -0.05)) * 0.1; }
void main(){
	vec2 p = vW.xz; float e = 0.15;
	// wind on the water: patches of ripple and of calm
	float wind = 0.5 + 0.5 * smoothstep(0.3, 0.7, vn(p * 0.004 + uTime * 0.01));
	vec3 n = normalize(vec3(wave(p - vec2(e, 0.0)) - wave(p + vec2(e, 0.0)), 2.0 * e / (0.08 * wind), wave(p - vec2(0.0, e)) - wave(p + vec2(0.0, e))));
	n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(300.0, 2500.0, vDist)));
	vec3 v = normalize(cameraPosition - vW), r = reflect(-v, n);
	float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
	float depth = uLevel - groundUnder(p);
	float nearK = 1.0 - smoothstep(700.0, 1100.0, vDist);
	float deepK = mix(1.0, smoothstep(0.0, 2.2, depth), nearK);
	vec3 deep = uTint * (1.0 - uNight * 0.85);
	vec3 col = mix(deep, skyIn(r, p) * mix(vec3(0.62, 0.86, 0.7), vec3(0.78, 0.88, 0.92), uTint.b * 4.0), fres);
	col += uSunColor * (pow(max(dot(r, uSunDir), 0.0), 600.0) * 6.0 + pow(max(dot(r, uSunDir), 0.0), 40.0) * 0.12) * (1.0 - uNight);
	// a lace of foam where the water laps the shore
	float lace = (1.0 - smoothstep(0.0, 0.18, depth)) * smoothstep(0.45, 0.75, vn(p * 1.7 + uTime * 0.2)) * nearK * step(0.0, depth);
	col = mix(col, vec3(0.82, 0.84, 0.8) * (1.0 - uNight * 0.8), lace * 0.6);
	float a = clamp(0.3 + deepK * 0.66 + fres * 0.2 + lace * 0.4, 0.0, 0.97);
	gl_FragColor = vec4(col, a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;

export function createWater(scene, bay, shared, { isPhone = false, real = null, ground = null } = {}) {
	const root = new THREE.Group();
	root.name = 'water';
	scene.add(root);
	const RANGE = isPhone ? { data: 4600, near: 1800, far: 6500, carve: 720, slots: 49, budget: 3.5 } : { data: 7200, near: 2600, far: 9500, carve: 1100, slots: 100, budget: 5 };
	const S = { H: null, dv: null, lakes: [], lakeGrid: new Map(), tiles: new Map(), ready: false, err: null, jobs: [], plannedAt: -1e9, px: 1e9, pz: 1e9, stats: { longest: 0, carveMs: 0, tileMs: 0, carved: 0, built: 0 } };
	const atlas = createCarveAtlas(RANGE.slots);
	const BU = shared.bayU;
	const uniforms = () => ({ ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...BU, ...WC_U, uTime: shared.uTime, uNight: { value: 0 }, uSeason: REAL_U.uSeason, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor });
	const uNight = { value: 0 };
	const riverMat = new THREE.ShaderMaterial({ uniforms: { ...uniforms(), uNight }, vertexShader: RIVER_VERT, fragmentShader: 'varying vec3 vW;\n' + BAY_GLSL + WC_GLSL + NOISE_GLSL + COMMON.replace('varying vec3 vW;', '') + RIVER_FRAG, fog: true, transparent: true, depthWrite: false });
	const lakeMats = new Map();
	const TINTS = [[0.012, 0.045, 0.04], [0.01, 0.04, 0.05], [0.03, 0.05, 0.03], [0.02, 0.05, 0.03], [0.02, 0.06, 0.07]];
	function lakeMat(L) {
		const m = new THREE.ShaderMaterial({ uniforms: { ...uniforms(), uNight, uTint: { value: new THREE.Vector3(...TINTS[L.kind]) }, uLevel: { value: L.level } }, vertexShader: LAKE_VERT, fragmentShader: 'varying vec3 vW;\n' + BAY_GLSL + WC_GLSL + NOISE_GLSL + COMMON.replace('varying vec3 vW;', '') + LAKE_FRAG, fog: true, transparent: true, depthWrite: true });
		lakeMats.set(L, m);
		return m;
	}

	// ---------- loading: the index, every lake, the survey let down under them ----------
	const LCELL = 1024, lkey = (i, j) => i * 100003 + j;
	function* loadJob() {
		const base = new URL('../assets/bayarea/water', import.meta.url).href;
		let H = null, bin = null, done = false;
		Promise.all([fetch(base + '.json').then((r) => r.json()), fetch(base + '.bin.gz').then(gunzip)]).then(([h, b]) => { H = h; bin = b; done = true; }).catch((e) => { S.err = e; done = true; console.warn('water', e); });
		while (!done) yield 'wait';
		if (!H) return;
		S.H = H; S.dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
		S.names = H.names;
		const dv = S.dv;
		let o = H.lakes[0];
		for (let n = 0; n < H.lakes[1]; n++) {
			const kind = dv.getUint8(o), fl = dv.getUint8(o + 1), nm = dv.getUint16(o + 2, true), level = dv.getInt16(o + 4, true) / 20, nr = dv.getUint16(o + 6, true);
			const cx = dv.getFloat32(o + 8, true), cz = dv.getFloat32(o + 12, true), u = dv.getUint8(o + 16) / 8, nd = dv.getUint8(o + 17);
			o += 18;
			const rings = [], dams = [];
			let x0 = 1e18, z0 = 1e18, x1 = -1e18, z1 = -1e18;
			for (let k = 0; k < nr + nd; k++) {
				const m = dv.getUint16(o, true); o += 2;
				const r = new Float64Array(m * 2);
				for (let i = 0; i < m; i++, o += 4) {
					r[i * 2] = dv.getInt16(o, true) * u + cx; r[i * 2 + 1] = dv.getInt16(o + 2, true) * u + cz;
					if (k < nr) { x0 = Math.min(x0, r[i * 2]); x1 = Math.max(x1, r[i * 2]); z0 = Math.min(z0, r[i * 2 + 1]); z1 = Math.max(z1, r[i * 2 + 1]); }
				}
				(k < nr ? rings : dams).push(r);
			}
			o = (o + 3) & ~3;
			// the area (shoelace; holes wind the other way)
			let area = 0;
			for (const r of rings) { let a = 0; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1]; area += a / 2; }
			const L = { id: n, kind, int: !!(fl & 1), name: nm ? H.names[nm - 1] : '', level, rings, dams, x0, z0, x1, z1, cx, cz, area: Math.abs(area), mesh: null, birds: null };
			S.lakes.push(L);
			for (let gi = Math.floor(x0 / LCELL); gi <= Math.floor(x1 / LCELL); gi++) for (let gj = Math.floor(z0 / LCELL); gj <= Math.floor(z1 / LCELL); gj++) {
				const k = lkey(gi, gj); let g = S.lakeGrid.get(k); if (!g) S.lakeGrid.set(k, g = []); g.push(L);
			}
			if (n % 200 === 199) yield;
		}
		yield* regrade();
		S.ready = true;
		setWaterHooks({ water: inWater, trees: treesNear });
		// (the city looks again: no trees standing in the lakes)
		grewTrees();
	}
	// the survey's heights under each lake let down to its bed (every level that holds it),
	// so from far off, where nothing finer is drawn, the water isn't pierced by the ground
	function* regrade() {
		let n = 0;
		for (let k = 0; k < bay.levels.length; k++) {
			const Lv = bay.levels[k], tex = BU?.['uB' + k]?.value, D = tex?.image?.data;
			if (!Lv || !D || tex.image.width !== Lv.W) continue;
			const rows = new Set(), st = Lv.step, h = THREE.DataUtils.toHalfFloat;
			const X1 = Lv.x0 + (Lv.W - 1) * st, Z1 = Lv.zN + (Lv.H - 1) * st;
			for (const L of S.lakes) {
				if (L.area < st * st * 0.3 || L.x1 < Lv.x0 || L.x0 > X1 || L.z1 < Lv.zN || L.z0 > Z1) continue;
				const [Dmax, sl] = DEEP[L.kind];
				const j0 = Math.max(0, Math.ceil((L.z0 - Lv.zN) / st)), j1 = Math.min(Lv.H - 1, Math.floor((L.z1 - Lv.zN) / st));
				for (let j = j0; j <= j1; j++) {
					const z = Lv.zN + j * st, xs = crossings(L.rings, z);
					for (let c = 0; c + 1 < xs.length; c += 2) {
						for (let i = Math.max(0, Math.ceil((xs[c] - Lv.x0) / st)); i <= Math.min(Lv.W - 1, Math.floor((xs[c + 1] - Lv.x0) / st)); i++) {
							// (the heights within half a step of the shore barely let down, so the
							// ground drawn between them meets the water near its true edge)
							const x = Lv.x0 + i * st, t = L.level - Math.min(Dmax, 0.3 + Math.max(0, edgeDist(L.rings, x, z) - 0.6 * st) * sl), q = j * Lv.W + i;
							if (t < Lv.v[q] / H_SCALE - H_OFF) { Lv.v[q] = Math.round((t + H_OFF) * H_SCALE); D[q] = h(t); rows.add(j); }
						}
					}
				}
				if (++n % 40 === 0) yield;
			}
			for (const j of rows) tex.addUpdateRange(j * Lv.W * 4, Lv.W * 4);
			if (rows.size) tex.needsUpdate = true;
			yield;
		}
	}
	// where a row crosses a lake's edges, in order (in, out, in, out...)
	function crossings(R, z) {
		const xs = [];
		for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
			const az = r[i + 1], bz = r[j + 1];
			if ((az > z) !== (bz > z)) xs.push(r[i] + (r[j] - r[i]) * (z - az) / (bz - az));
		}
		return xs.sort((a, b) => a - b);
	}
	const lakesNear = (x0, z0, x1, z1) => {
		const out = new Set();
		for (let gi = Math.floor(x0 / LCELL); gi <= Math.floor(x1 / LCELL); gi++) for (let gj = Math.floor(z0 / LCELL); gj <= Math.floor(z1 / LCELL); gj++) for (const L of S.lakeGrid.get(lkey(gi, gj)) || []) if (L.x1 >= x0 && L.x0 <= x1 && L.z1 >= z0 && L.z0 <= z1) out.add(L);
		return out;
	};
	function lakeAt(x, z) {
		for (const L of S.lakeGrid.get(lkey(Math.floor(x / LCELL), Math.floor(z / LCELL))) || []) if (x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1 && inRings(L.rings, x, z)) return L;
		return null;
	}

	// ---------- the rivers, a 2 km tile at a time ----------
	// Santa Cruz's river is bay/sanlorenzo.js's: where its water is (or near it), none of ours
	const SL = { x0: (-122.11 - LON0) * KX, x1: (-121.99 - LON0) * KX, z0: -(37.075 - LAT0) * KZ, z1: -(36.94 - LAT0) * KZ, ref: { x: (-122.0213 - LON0) * KX, z: -(36.9745 - LAT0) * KZ }, t0: performance.now() };
	const inSL = (x, z) => x > SL.x0 && x < SL.x1 && z > SL.z0 && z < SL.z1;
	const slReady = () => inRiverWater(SL.ref.x, SL.ref.z) || performance.now() - SL.t0 > 90000;
	const theirs = (x, z) => { for (let a = 0; a < 8; a++) { const r = a ? 22 : 0; if (inRiverWater(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true; } return false; };
	const skipBox = (x, z) => (S.H?.skip || []).some((b) => x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]);
	// how much a place is town (0 wild .. 1 built up), for concrete channels and the banks' trees
	function townK(x, z) {
		if (real?.inside?.(x, z)) { const L = real.landAt(x, z); if (L) return L.lu === 0 || L.lu === 11 || L.lu === 12 ? 0 : L.lu === 2 || L.lu === 3 || L.lu === 4 ? 0.3 : 1; }
		return Math.min(1, (bay.urbanAt?.(x, z).u || 0) * 2.5);
	}
	const tkey = (i, j) => i + ',' + j;
	function decodeTile(i, j) {
		const H = S.H, e = H.tiles[tkey(i, j)], T = { i, j, lines: [], grid: new Map(), trees: [], mesh: null, wideIdx: 0, allIdx: 0, lakesDone: false };
		if (!e) return T;
		const dv = S.dv, U = H.unit, cx = (i + 0.5) * H.tile, cz = (j + 0.5) * H.tile;
		let o = e[0];
		const sl = inSL(cx, cz) || inSL(cx - 1024, cz - 1024) || inSL(cx + 1024, cz + 1024);
		for (let n = 0; n < e[1]; n++) {
			const c = dv.getUint8(o), fl = dv.getUint8(o + 1), nm = dv.getUint16(o + 2, true), k = dv.getUint16(o + 4, true); o += 6;
			let px = 0, pz = 0, pl = 0;
			const P = [];
			for (let v = 0; v < k; v++, o += 8) {
				px += dv.getInt16(o, true); pz += dv.getInt16(o + 2, true); pl += dv.getInt16(o + 4, true);
				P.push([px * U + cx, pz * U + cz, pl / 20, dv.getUint16(o + 6, true) / 10]);
			}
			// (cut where the San Lorenzo of sanlorenzo.js runs)
			const runs = [];
			let cur = [];
			for (const q of P) { if (sl && (theirs(q[0], q[1]) || skipBox(q[0], q[1]))) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(q); }
			if (cur.length > 1) runs.push(cur);
			for (const R of runs) addLine(T, H.classes[c], !!(fl & 1), nm ? H.names[nm - 1] : '', R);
		}
		return T;
	}
	function addLine(T, cls, int, name, P) {
		const n = P.length, x = new Float64Array(n), z = new Float64Array(n), lv = new Float32Array(n), w = new Float32Array(n), s = new Float32Array(n);
		let x0 = 1e18, z0 = 1e18, x1 = -1e18, z1 = -1e18, wm = 0;
		P.forEach((q, k) => { x[k] = q[0]; z[k] = q[1]; lv[k] = q[2]; w[k] = Math.max(0.8, q[3]); wm = Math.max(wm, w[k]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); if (k) s[k] = s[k - 1] + Math.hypot(q[0] - P[k - 1][0], q[1] - P[k - 1][1]); });
		const mid = P[n >> 1], town = townK(mid[0], mid[1]);
		// a flood channel in town is poured concrete, its water a shallow sheet 2 m below the
		// street; a natural creek in town runs a little deeper between its banks
		const conc = (cls === 'drain' || cls === 'canal') && town > 0.5;
		for (let k = 0; k < n; k++) lv[k] -= conc ? 2.0 : 0.15 + 0.9 * townK(x[k], z[k]) * Math.min(1, w[k] / 4);
		for (let k = 1; k < n; k++) lv[k] = Math.min(lv[k], lv[k - 1]);
		const L = { cls, int, name, n, x, z, lv, w, s, conc, town, x0, z0, x1, z1, reach: wm / 2 + (conc ? 12 : 26) };
		const id = T.lines.push(L) - 1;
		// the segments by 64 m cell, for finding the water at a point
		for (let k = 0; k + 1 < n; k++) {
			const r = w[k] / 2 + 4;
			for (let gi = Math.floor((Math.min(x[k], x[k + 1]) - r) / 64); gi <= Math.floor((Math.max(x[k], x[k + 1]) + r) / 64); gi++) for (let gj = Math.floor((Math.min(z[k], z[k + 1]) - r) / 64); gj <= Math.floor((Math.max(z[k], z[k + 1]) + r) / 64); gj++) {
				const gk = gi * 100003 + gj; let g = T.grid.get(gk); if (!g) T.grid.set(gk, g = []); g.push(id, k);
			}
		}
	}
	// the water's half-width (as it runs now) at a point of a line
	const lowK = (L) => (L.int && L.w[0] < 6 ? sm(0.55, 0.95, REAL_U.uSeason.value) * 0.6 : 0);
	const hwOf = (L, w) => (L.conc ? Math.max(0.7, w * 0.26) : w / 2) * (1 - lowK(L));
	// the nearest stream's water at a point: { L, k, t, d, level, hw } or null
	function riverAt(x, z, pad = 0) {
		const T = S.tiles.get(tkey(Math.floor(x / 2048), Math.floor(z / 2048)));
		if (!T?.lines.length) return null;
		const g = T.grid.get(Math.floor(x / 64) * 100003 + Math.floor(z / 64));
		if (!g) return null;
		let best = null;
		for (let q = 0; q < g.length; q += 2) {
			const L = T.lines[g[q]], k = g[q + 1];
			const ax = L.x[k], az = L.z[k], dx = L.x[k + 1] - ax, dz = L.z[k + 1] - az, l2 = dx * dx + dz * dz || 1;
			const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
			const hw = hwOf(L, L.w[k] + (L.w[k + 1] - L.w[k]) * t);
			if (d < hw + pad && (!best || d - hw < best.d - best.hw)) best = { L, k, t, d, hw, level: L.lv[k] + (L.lv[k + 1] - L.lv[k]) * t };
		}
		return best;
	}
	function waterAt(x, z) {
		if (!S.ready) return null;
		const L = lakeAt(x, z);
		if (L) return L.level;
		const r = riverAt(x, z);
		return r ? r.level : null;
	}
	function inWater(x, z) { return !!lakeAt(x, z) || !!riverAt(x, z, 1.2); }

	// ---------- a tile's ribbons of water, and the trees along its banks ----------
	function* buildTile(T) {
		const cx = (T.i + 0.5) * 2048, cz = (T.j + 0.5) * 2048;
		const lines = [...T.lines.keys()].sort((a, b) => T.lines[b].w[0] - T.lines[a].w[0]);
		const pos = [], aC = [], aF = [], aT = [], idx = [];
		let wide = 0, t0 = performance.now();
		for (const id of lines) {
			const L = T.lines[id], n = L.n, base = pos.length / 3;
			const dry = L.int && L.w[0] < 6 ? 1 : 0;
			for (let k = 0; k < n; k++) {
				const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
				let tx = L.x[b] - L.x[a], tz = L.z[b] - L.z[a]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
				// (the mitre at a bend, not too long)
				let mk = 1;
				if (k > 0 && k < n - 1) { const ux = L.x[k] - L.x[k - 1], uz = L.z[k] - L.z[k - 1], ul = Math.hypot(ux, uz) || 1; mk = 1 / Math.max(0.5, (ux / ul) * tx + (uz / ul) * tz); }
				const w = L.w[k], hw = (L.conc ? Math.max(0.7, w * 0.26) + 0.25 : w / 2 + 0.3 + 0.07 * w) * mk;
				const y = L.lv[k];
				const seg = k < n - 1 ? k : k - 1, sl = Math.max(0, (L.lv[seg] - L.lv[seg + 1]) / Math.max(1, L.s[seg + 1] - L.s[seg]));
				const speed = L.conc ? 0.9 : Math.min(2.4, 0.25 + Math.sqrt(sl) * 9), foam = L.conc ? 0.05 : sm(0.012, 0.06, sl);
				for (const sd of [-1, 0, 1]) {
					pos.push(L.x[k] - tz * hw * sd - cx, y, L.z[k] + tx * hw * sd - cz);
					aC.push(L.x[k] - cx, L.z[k] - cz, sd, L.s[k]);
					aF.push(speed, foam, dry, w);
					aT.push(tx, tz);
				}
			}
			for (let k = 0; k + 1 < n; k++) { const p = base + k * 3, q = p + 3; idx.push(p, q, p + 1, p + 1, q, q + 1, p + 1, q + 1, p + 2, p + 2, q + 1, q + 2); }
			if (L.w[0] >= 5) wide = idx.length;
			if (performance.now() - t0 > 3) { yield; t0 = performance.now(); }
		}
		// (the centre positions ride in aC relative to the tile, as the positions do)
		if (S.tiles.get(tkey(T.i, T.j)) !== T) return;
		if (idx.length) {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
			g.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 4));
			g.setAttribute('aF', new THREE.Float32BufferAttribute(aF, 4));
			g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 2));
			g.setIndex(pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
			g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1500);
			g.boundingSphere.center.y = pos.length ? pos[1] : 0;
			const m = new THREE.Mesh(g, riverMat);
			m.position.set(cx, 0, cz);
			m.frustumCulled = true; m.renderOrder = 2;
			m.userData.material175 = 'water';
			root.add(m);
			T.mesh = m; T.wideIdx = wide; T.allIdx = idx.length;
		}
		yield;
		yield* plantBanks(T);
		T.built = true;
		S.stats.built++;
	}
	// willows and alders at the water, sycamores in the inland valleys, bay laurel, and in the
	// fog belt's canyons redwoods; only on wild banks (not in town, not in a lake)
	function* plantBanks(T) {
		let t0 = performance.now();
		for (const L of T.lines) {
			if (performance.now() - t0 > 3) { yield; t0 = performance.now(); }
			if (L.conc || L.cls === 'ditch' || L.cls === 'tidal' || L.w[0] > 60) continue;
			for (let k = 0; k + 1 < L.n; k++) {
				const ax = L.x[k], az = L.z[k], dx = L.x[k + 1] - ax, dz = L.z[k + 1] - az, len = Math.hypot(dx, dz);
				if (len < 1) continue;
				const nx = -dz / len, nz = dx / len;
				for (let s = h01(ax, az) * 8; s < len; s += 7 + h01(s, ax) * 5) {
					for (const sd of [-1, 1]) {
						const r = h01(ax + s * 1.3 + sd, az - s * 0.7);
						if (r > 0.62) continue;
						const f = s / len, bx = ax + dx * f, bz = az + dz * f, w = L.w[k] + (L.w[k + 1] - L.w[k]) * f, lv = L.lv[k] + (L.lv[k + 1] - L.lv[k]) * f;
						// on the land at the top of the bank (where the channel's cut ends)
						const g0 = bay.heightAt(bx + nx * sd * (w / 2 + 3), bz + nz * sd * (w / 2 + 3));
						const top = Math.min(18, Math.max(0, g0 - lv) / 0.9);
						const off = w / 2 + 1.6 + top + h01(r, s) * 5;
						const x = bx + nx * sd * off, z = bz + nz * sd * off;
						if (townK(x, z) > 0.2 || lakeAt(x, z) || skipBox(x, z)) continue;
						const fog = 1 - sm(22000, 58000, x), hh = h01(x * 0.13, z * 0.17);
						let t;
						if (fog > 0.6 && lv < 450 && hh < 0.5) t = { h: 30 + hh * 40, cone: true, sp: 2, col: [0.12, 0.19, 0.09] };                 // redwood
						else if (off < w / 2 + 4 + top && hh < 0.55) t = { h: 5 + hh * 5, sp: 0, col: [0.34, 0.42, 0.22] };                          // arroyo willow
						else if (hh < 0.8) t = { h: 11 + hh * 9, sp: 0, col: fog > 0.5 ? [0.16, 0.26, 0.1] : [0.2, 0.28, 0.12] };                   // white alder
						else if (fog < 0.5) t = { h: 13 + hh * 9, sp: 0, col: [0.36, 0.4, 0.24] };                                                      // western sycamore
						else t = { h: 9 + hh * 7, sp: 1, col: [0.14, 0.21, 0.09] };                                                                        // California bay
						const j = 0.9 + h01(z, x) * 0.2;
						t.col = t.col.map((c) => c * j);
						T.trees.push({ x, z, ...t });
					}
				}
			}
		}
		if (T.trees.length) grew = true;
	}
	let grew = false, grewAt = 0;
	function treesNear(x, z, r) {
		const out = [];
		for (const T of S.tiles.values()) {
			if (!T.trees.length || Math.abs((T.i + 0.5) * 2048 - x) > r + 1024 || Math.abs((T.j + 0.5) * 2048 - z) > r + 1024) continue;
			for (const t of T.trees) if (Math.abs(t.x - x) < r && Math.abs(t.z - z) < r && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r) out.push({ ...t, y: bay.heightAt(t.x, t.z) - 0.3 });
		}
		return out;
	}

	// ---------- the ground carved round you: a 256 m square at a time ----------
	// the lines that may reach into a square (from the tiles round it)
	function linesNear(x0, z0, x1, z1) {
		const out = [];
		for (let i = Math.floor((x0 - 60) / 2048); i <= Math.floor((x1 + 60) / 2048); i++) for (let j = Math.floor((z0 - 60) / 2048); j <= Math.floor((z1 + 60) / 2048); j++) {
			const T = S.tiles.get(tkey(i, j));
			if (!T) return null;                               // (not decoded yet: wait)
			for (const L of T.lines) if (L.x1 + L.reach >= x0 && L.x0 - L.reach <= x1 && L.z1 + L.reach >= z0 && L.z0 - L.reach <= z1) out.push(L);
		}
		return out;
	}
	const decks = new Map();
	let decksDirty = false;
	function* carveTile(ci, cj, lines, lakes) {
		const X0 = ci * WT, Z0 = cj * WT, ts = WT / WN;
		// the ground as it stands without this carving (on an 8 m grid; the survey is coarser)
		const G = WN / 4 + 1, base = new Float32Array(G * G);
		for (let b = 0; b < G; b++) for (let a = 0; a < G; a++) { const x = X0 + a * 8, z = Z0 + b * 8; base[b * G + a] = bay.heightAt(x, z) - waterDelta(x, z); }
		yield;
		const B = (a, b) => { const fa = a / 4, fb = b / 4, i = Math.min(G - 2, Math.floor(fa)), j = Math.min(G - 2, Math.floor(fb)), u = fa - i, v = fb - j, k = j * G + i; return (base[k] * (1 - u) + base[k + 1] * u) * (1 - v) + (base[k + G] * (1 - u) + base[k + G + 1] * u) * v; };
		const N = W1 * W1, lo = new Float32Array(N), hi = new Float32Array(N), kind = new Float32Array(N), dam = new Float32Array(N).fill(-1e9);
		let t0 = performance.now();
		// the streams: a bed under the water, banks cut back at a slope to the land, or a
		// low lip where the land lies under the water's level; in town a concrete trapezoid
		for (const L of lines) {
			for (let k = 0; k + 1 < L.n; k++) {
				const ax = L.x[k], az = L.z[k], dx = L.x[k + 1] - ax, dz = L.z[k + 1] - az, l2 = dx * dx + dz * dz || 1;
				const R = Math.max(L.w[k], L.w[k + 1]) / 2 + (L.conc ? 12 : 26);
				const a0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - R - X0) / ts)), a1 = Math.min(WN, Math.ceil((Math.max(ax, ax + dx) + R - X0) / ts));
				const b0 = Math.max(0, Math.floor((Math.min(az, az + dz) - R - Z0) / ts)), b1 = Math.min(WN, Math.ceil((Math.max(az, az + dz) + R - Z0) / ts));
				if (a0 > a1 || b0 > b1) continue;
				for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
					const x = X0 + a * ts, z = Z0 + b * ts, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
					const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
					if (d > R) continue;
					const w = L.w[k] + (L.w[k + 1] - L.w[k]) * t, lv = L.lv[k] + (L.lv[k + 1] - L.lv[k]) * t, g = B(a, b), q = b * W1 + a;
					if (L.conc) {
						const bh = Math.max(1, w * 0.32), bed = lv - 0.15, tg = d < bh ? bed : bed + (d - bh) * 1.6;
						if (tg < g) { const v = (tg - g) * (1 - sm(R - 3, R, d)); if (v < lo[q]) lo[q] = v; if (tg < g - 0.05) kind[q] = Math.max(kind[q], 2); }
						continue;
					}
					const hw = w / 2, D = depthOf(w);
					if (d < hw) {
						const tg = lv - 0.06 - D * Math.pow(Math.max(0, 1 - (d / hw) ** 2), 0.6);
						if (tg < g) { const v = tg - g; if (v < lo[q]) lo[q] = v; }
					} else {
						const tg = lv - 0.06 + (d - hw) * (w < 6 ? 0.95 : 0.6);
						if (tg < g) { const v = (tg - g) * (1 - sm(R - 8, R, d)); if (v < lo[q]) lo[q] = v; }
						else { const v = Math.max(0, lv + 0.05 + (d - hw) * 0.5 - g) * (1 - sm(hw + 1.5, hw + 5, d)); if (v > hi[q]) hi[q] = v; }
					}
					kind[q] = Math.max(kind[q], 1 - sm(hw + 0.4, hw + 2.2, d));
				}
				if (performance.now() - t0 > 2.5) { yield; t0 = performance.now(); }
			}
		}
		// the lakes: the bed falling away from the shore, a lip where the land outside lies
		// under the water, the wet band, and the dams
		for (const L of lakes) {
			const [Dmax, sl] = DEEP[L.kind];
			const M = 12, bx0 = X0 - M, bz0 = Z0 - M, bx1 = X0 + WT + M, bz1 = Z0 + WT + M;
			// (only the edges near this square count for the distance to the shore)
			const E = [];
			for (const r of L.rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
				if (Math.max(r[i], r[j]) < bx0 - 60 || Math.min(r[i], r[j]) > bx1 + 60 || Math.max(r[i + 1], r[j + 1]) < bz0 - 60 || Math.min(r[i + 1], r[j + 1]) > bz1 + 60) continue;
				E.push(r[j], r[j + 1], r[i], r[i + 1]);
			}
			const near = (x, z) => { let m = 1e18; for (let e = 0; e < E.length; e += 4) { const ax = E[e], az = E[e + 1], dx = E[e + 2] - ax, dz = E[e + 3] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez; if (d < m) m = d; } return Math.sqrt(m); };
			for (let b = 0; b <= WN; b++) {
				const z = Z0 + b * ts, xs = crossings(L.rings, z);
				let c = 0;
				for (let a = 0; a <= WN; a++) {
					const x = X0 + a * ts;
					while (c < xs.length && xs[c] < x) c++;
					const inside = c % 2 === 1, d = E.length ? near(x, z) : 1e9, q = b * W1 + a, g = B(a, b);
					if (inside) {
						const v = Math.min(0, L.level - Math.min(Dmax, 0.5 + d * sl) - g);
						if (v < lo[q]) lo[q] = v;
						kind[q] = Math.max(kind[q], 1);
					} else if (d < 10) {
						const v = Math.max(0, L.level + 0.12 + d * 0.3 - g) * (1 - sm(4, 10, d));
						if (v > hi[q]) hi[q] = v;
						kind[q] = Math.max(kind[q], 1 - sm(0.5, 3, d));
					}
				}
				if (performance.now() - t0 > 2.5) { yield; t0 = performance.now(); }
			}
			// an earth dam: a crest road 1.5 m over the water, its faces falling at 1 in 2.2
			for (const dm of L.dams) {
				const crest = L.level + 1.5;
				for (let e = 0; e + 3 < dm.length; e += 2) {
					const ax = dm[e], az = dm[e + 1], dx = dm[e + 2] - ax, dz = dm[e + 3] - az, l2 = dx * dx + dz * dz || 1, R = 80;
					const a0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - R - X0) / ts)), a1 = Math.min(WN, Math.ceil((Math.max(ax, ax + dx) + R - X0) / ts));
					const b0 = Math.max(0, Math.floor((Math.min(az, az + dz) - R - Z0) / ts)), b1 = Math.min(WN, Math.ceil((Math.max(az, az + dz) + R - Z0) / ts));
					for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
						const x = X0 + a * ts, z = Z0 + b * ts, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
						// (a crest 7 m across on the shore line, the faces falling either side of it)
						const tg = crest - Math.max(0, d - 3.5) / 2.2;
						const q = b * W1 + a;
						if (tg > dam[q]) dam[q] = tg;
					}
				}
			}
		}
		// the bridges: where a mapped road crosses, the ground as walked and driven stays at the road
		const walkZero = new Uint8Array(N);
		if (real?.near && lines.length) {
			for (const r of real.near('roads', X0 + WT / 2, Z0 + WT / 2, WT * 0.75)) {
				if (r.cls === 'track' || r.cls === 'steps') continue;
				const p = r.pts;
				for (let e = 0; e + 3 < p.length; e += 2) {
					const rx = p[e], rz = p[e + 1], ex = p[e + 2] - rx, ez = p[e + 3] - rz, el = Math.hypot(ex, ez);
					if (el < 0.5) continue;
					for (const L of lines) {
						if (Math.max(rx, rx + ex) < L.x0 - 5 || Math.min(rx, rx + ex) > L.x1 + 5 || Math.max(rz, rz + ez) < L.z0 - 5 || Math.min(rz, rz + ez) > L.z1 + 5) continue;
						for (let k = 0; k + 1 < L.n; k++) {
							const sx = L.x[k], sz = L.z[k], fx = L.x[k + 1] - sx, fz = L.z[k + 1] - sz, den = ex * fz - ez * fx;
							if (Math.abs(den) < 1e-6) continue;
							const u = ((sx - rx) * fz - (sz - rz) * fx) / den, v = ((sx - rx) * ez - (sz - rz) * ex) / den;
							if (u < 0 || u > 1 || v < 0 || v > 1) continue;
							const X = rx + ex * u, Z = rz + ez * u, w = L.w[k] + (L.w[k + 1] - L.w[k]) * v;
							const sin = Math.abs(den) / (el * Math.hypot(fx, fz)), hwR = r.w / 2 + 1.2;
							const span = Math.min(70, (w / 2 + (L.conc ? 4 : 7)) / Math.max(0.35, sin));
							const dk = Math.round(X) + ',' + Math.round(Z);
							const ux = ex / el, uz = ez / el;
							// (the road's own level: the survey there, uncarved)
							if (!decks.has(dk)) { decks.set(dk, { x: X, z: Z, ux, uz, span, hw: hwR, foot: r.cls === 'footway' || r.cls === 'path' || r.cls === 'cycleway' || r.cls === 'pedestrian', own: !r.bridge, y: B(Math.max(0, Math.min(WN, (X - X0) / ts)), Math.max(0, Math.min(WN, (Z - Z0) / ts))), key: ci + ',' + cj }); decksDirty = true; }
							const R = span + hwR + 2;
							const a0 = Math.max(0, Math.floor((X - R - X0) / ts)), a1 = Math.min(WN, Math.ceil((X + R - X0) / ts)), b0 = Math.max(0, Math.floor((Z - R - Z0) / ts)), b1 = Math.min(WN, Math.ceil((Z + R - Z0) / ts));
							for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
								const qx = X0 + a * ts - X, qz = Z0 + b * ts - Z, al = qx * ux + qz * uz, ac = -qx * uz + qz * ux;
								if (Math.abs(al) < span + 1 && Math.abs(ac) < hwR + 1) walkZero[b * W1 + a] = 1;
							}
						}
					}
				}
			}
		}
		const draw = new Float32Array(N * 2), walk = new Float32Array(N);
		let any = false;
		for (let q = 0; q < N; q++) {
			let v = lo[q] < -0.001 ? lo[q] : hi[q];
			if (dam[q] > -1e8) { const b = Math.floor(q / W1), a = q - b * W1, g = B(a, b); if (dam[q] > g + v) v = dam[q] - g; }
			draw[q * 2] = v; draw[q * 2 + 1] = kind[q];
			walk[q] = walkZero[q] && v < 0 ? 0 : v;
			if (v !== 0 || kind[q] > 0) any = true;
		}
		if (!any) return false;
		return { draw, walk };
	}
	// the decks: a concrete slab carrying the road over the channel, rails on both sides
	const deckMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
	let deckMesh = null;
	function buildDecks(cx, cz) {
		decksDirty = false;
		if (deckMesh) { root.remove(deckMesh); deckMesh.geometry.dispose(); deckMesh = null; }
		const pos = [], col = [], idx = [];
		const quad = (p, c) => { const b = pos.length / 3; for (const q of p) pos.push(q[0] - cx, q[1], q[2] - cz); for (let k = 0; k < 4; k++) col.push(...c); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
		const box = (D, a0, a1, c0, c1, y0, y1, top, side) => {
			const P = (al, ac, y) => [D.x + D.ux * al - D.uz * ac, y, D.z + D.uz * al + D.ux * ac];
			quad([P(a0, c0, y1), P(a0, c1, y1), P(a1, c1, y1), P(a1, c0, y1)], top);
			quad([P(a0, c0, y0), P(a1, c0, y0), P(a1, c0, y1), P(a0, c0, y1)], side);
			quad([P(a1, c1, y0), P(a0, c1, y0), P(a0, c1, y1), P(a1, c1, y1)], side);
			quad([P(a0, c1, y0), P(a0, c0, y0), P(a0, c0, y1), P(a0, c1, y1)], side);
			quad([P(a1, c0, y0), P(a1, c1, y0), P(a1, c1, y1), P(a1, c0, y1)], side);
			quad([P(a0, c1, y0), P(a1, c1, y0), P(a1, c0, y0), P(a0, c0, y0)], side);
		};
		for (const D of decks.values()) {
			if (!D.own || Math.hypot(D.x - cx, D.z - cz) > 2500) continue;
			// (the road's own level as walked and driven: graded, berms.js)
			const top = (ground ? ground(D.x, D.z) : D.y) + 0.08, asph = D.foot ? [0.42, 0.36, 0.28] : [0.16, 0.16, 0.17], conc = [0.55, 0.54, 0.5];
			box(D, -D.span, D.span, -D.hw, D.hw, top - (D.foot ? 0.35 : 0.9), top, asph, conc);
			for (const sd of [-1, 1]) box(D, -D.span, D.span, sd > 0 ? D.hw : -D.hw - 0.3, sd > 0 ? D.hw + 0.3 : -D.hw, top - 0.2, top + (D.foot ? 1.05 : 0.85), conc, conc);
		}
		if (!idx.length) return;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(col.map((c) => Math.pow(c, 2.2)), 3));
		g.setIndex(idx); g.computeVertexNormals();
		deckMesh = new THREE.Mesh(g, deckMat);
		deckMesh.position.set(cx, 0, cz); deckMesh.castShadow = deckMesh.receiveShadow = true;
		deckMesh.userData.material175 = 'stone';
		root.add(deckMesh);
	}

	// ---------- a lake's water ----------
	function buildLake(L) {
		const shapes = [];
		const toV = (r) => { const v = []; for (let i = 0; i < r.length; i += 2) v.push(new THREE.Vector2(r[i] - L.cx, -(r[i + 1] - L.cz))); return v; };
		const sh = new THREE.Shape(toV(L.rings[0]));
		for (const r of L.rings.slice(1)) sh.holes.push(new THREE.Path(toV(r)));
		shapes.push(sh);
		const g = new THREE.ShapeGeometry(shapes);
		g.rotateX(-Math.PI / 2);
		const m = new THREE.Mesh(g, lakeMat(L));
		m.position.set(L.cx, L.level, L.cz);
		m.renderOrder = 1;
		m.userData.material175 = 'water';
		root.add(m);
		L.mesh = m;
	}
	function dropLake(L) {
		if (!L.mesh) return;
		root.remove(L.mesh); L.mesh.geometry.dispose(); lakeMats.get(L)?.dispose(); lakeMats.delete(L); L.mesh = null;
	}
	const lakeRange = (L) => (L.area > 1e6 ? 32000 : L.area > 5e4 ? 14000 : L.area > 8000 ? 5000 : 2600) * (isPhone ? 0.65 : 1);

	// ---------- ducks and geese on the lakes near you ----------
	const fowlG = { duck: waterfowl('mallard'), goose: waterfowl('goose') }, fowlM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75 });
	const flock = [];
	function flockFor(L) {
		if (L.birds || L.kind === 4 || L.area < 1500) return;
		L.birds = [];
		const n = Math.min(isPhone ? 4 : 8, 2 + Math.floor(Math.sqrt(L.area) / 40));
		for (let k = 0; k < n && L.birds.length < n; k++) {
			for (let tries = 0; tries < 30; tries++) {
				const x = L.x0 + h01(L.id + k, tries) * (L.x1 - L.x0), z = L.z0 + h01(tries, L.id * 3 + k) * (L.z1 - L.z0);
				if (!inRings(L.rings, x, z)) continue;
				const d = edgeDist(L.rings, x, z);
				if (d < 3 || d > 40) continue;
				const kind = k % 3 === 2 ? 'goose' : 'duck', b = new THREE.Group(), m = new THREE.Mesh(fowlG[kind], fowlM);
				m.rotation.y = Math.PI / 2; m.position.y = -0.04; m.castShadow = true; b.add(m);
				b.position.set(x, L.level, z); root.add(b);
				const B = { b, x, z, h: h01(k, L.id) * 6.28, v: 0.3, turn: 0, ph: k * 2.1, L };
				L.birds.push(B); flock.push(B);
				break;
			}
		}
	}
	function dropFlock(L) {
		if (!L.birds) return;
		for (const B of L.birds) { root.remove(B.b); flock.splice(flock.indexOf(B), 1); }
		L.birds = null;
	}

	// ---------- each frame: plan what is near, then work through it a slice at a time ----------
	const carveQ = new Map();                          // squares being carved
	let job = loadJob(), cur = null, lastDecks = { x: 1e9, z: 1e9 };
	function plan(cx, cz) {
		S.px = cx; S.pz = cz;
		const tasks = [];
		// the tiles to decode and build, nearest first
		const R = RANGE.data, ti0 = Math.floor((cx - R) / 2048), ti1 = Math.floor((cx + R) / 2048), tj0 = Math.floor((cz - R) / 2048), tj1 = Math.floor((cz + R) / 2048);
		const want = new Set();
		for (let i = ti0; i <= ti1; i++) for (let j = tj0; j <= tj1; j++) {
			const d = Math.hypot(Math.max(0, Math.abs((i + 0.5) * 2048 - cx) - 1024), Math.max(0, Math.abs((j + 0.5) * 2048 - cz) - 1024));
			if (d > R) continue;
			want.add(tkey(i, j));
			const T = S.tiles.get(tkey(i, j));
			if (!T) {
				// (round Santa Cruz, wait for sanlorenzo.js to lay its river first)
				const x = (i + 0.5) * 2048, z = (j + 0.5) * 2048;
				if ((inSL(x, z) || inSL(x - 1024, z - 1024) || inSL(x + 1024, z + 1024)) && !slReady()) continue;
				tasks.push({ d, kind: 'tile', i, j });
			}
		}
		// let go of the far ones
		for (const [k, T] of S.tiles) if (!want.has(k) && Math.hypot((T.i + 0.5) * 2048 - cx, (T.j + 0.5) * 2048 - cz) > RANGE.data + 3000) { if (T.mesh) { root.remove(T.mesh); T.mesh.geometry.dispose(); } S.tiles.delete(k); }
		// the squares to carve
		const C = RANGE.carve, ci0 = Math.floor((cx - C) / WT), ci1 = Math.floor((cx + C) / WT), cj0 = Math.floor((cz - C) / WT), cj1 = Math.floor((cz + C) / WT);
		for (const t of [...atlas.tiles()]) if (Math.hypot((t.i + 0.5) * WT - cx, (t.j + 0.5) * WT - cz) > C * 1.35 + WT) atlas.drop(t.i, t.j);
		for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) {
			const d = Math.hypot(Math.max(0, Math.abs((i + 0.5) * WT - cx) - WT / 2), Math.max(0, Math.abs((j + 0.5) * WT - cz) - WT / 2));
			if (d > C || atlas.has(i, j) || carveQ.has(i * 100003 + j) || S.noCarve.has(i * 100003 + j)) continue;
			tasks.push({ d: d * 0.8, kind: 'carve', i, j });
		}
		tasks.sort((a, b) => a.d - b.d);
		S.jobs = tasks;
		// the lakes' water
		for (const L of S.lakes) {
			const d = Math.hypot(Math.max(0, L.x0 - cx, cx - L.x1), Math.max(0, L.z0 - cz, cz - L.z1));
			if (d < lakeRange(L)) { if (!L.mesh) S.jobs.push({ d, kind: 'lake', L }); } else if (d > lakeRange(L) * 1.2) dropLake(L);
			if (d < (isPhone ? 300 : 450)) flockFor(L); else if (d > 900) dropFlock(L);
		}
	}
	S.noCarve = new Set();
	function nextJob() {
		while (S.jobs.length) {
			const t = S.jobs.shift();
			if (t.kind === 'tile') {
				if (S.tiles.has(tkey(t.i, t.j))) continue;
				const T = decodeTile(t.i, t.j);
				S.tiles.set(tkey(t.i, t.j), T);
				return buildTile(T);
			}
			if (t.kind === 'lake') { if (!t.L.mesh) buildLake(t.L); continue; }
			if (t.kind === 'carve') {
				const X0 = t.i * WT, Z0 = t.j * WT, k = t.i * 100003 + t.j;
				if (atlas.has(t.i, t.j) || carveQ.has(k)) continue;
				const lines = linesNear(X0, Z0, X0 + WT, Z0 + WT);
				if (!lines) continue;
				const lakes = [...lakesNear(X0 - 12, Z0 - 12, X0 + WT + 12, Z0 + WT + 12)].filter((L) => L.area > 60);
				if (!lines.length && !lakes.length) { S.noCarve.add(k); continue; }
				if (atlas.full()) continue;
				carveQ.set(k, true);
				return (function* () {
					const t1 = performance.now();
					const r = yield* carveTile(t.i, t.j, lines, lakes);
					carveQ.delete(k);
					if (r) { atlas.put(t.i, t.j, r.draw, r.walk); S.stats.carved++; } else S.noCarve.add(k);
					S.stats.carveMs = Math.max(S.stats.carveMs, performance.now() - t1);
				})();
			}
		}
		return null;
	}

	let realN = 0;
	function update(dt, t, cam, night = 0) {
		const f0 = performance.now();
		uNight.value = night;
		const x = cam.position.x, z = cam.position.z;
		if (job) {
			const t0 = performance.now();
			while (job && performance.now() - t0 < RANGE.budget) { if (job.next().done) job = null; }
			if (job) return;
		}
		if (!S.ready) return;
		if (S.noCarve.size > 5000) S.noCarve.clear();
		// a mapped region came in: its roads cross the creeks, so carve its squares again
		const rn = real?.R?.regions?.length || 0;
		if (rn !== realN) { realN = rn; for (const q of [...atlas.tiles()]) atlas.drop(q.i, q.j); S.noCarve.clear(); decks.clear(); decksDirty = true; S.plannedAt = -1e9; }
		if (Math.hypot(x - S.px, z - S.pz) > 120 || t - S.plannedAt > 1.5) { S.plannedAt = t; plan(x, z); }
		const t0 = performance.now();
		while (performance.now() - t0 < RANGE.budget) {
			if (!cur) cur = nextJob();
			if (!cur) break;
			try { if (cur.next().done) cur = null; } catch (e) { console.warn('water', e); cur = null; }
		}
		atlas.centre(x, z, RANGE.carve);
		// the ribbons: the whole of a near tile, only the wider water further off
		for (const T of S.tiles.values()) {
			if (!T.mesh) continue;
			const d = Math.hypot(Math.max(0, Math.abs((T.i + 0.5) * 2048 - x) - 1024), Math.max(0, Math.abs((T.j + 0.5) * 2048 - z) - 1024));
			T.mesh.visible = d < RANGE.far && cam.position.y < 9000 && (d < RANGE.near || T.wideIdx > 0);
			T.mesh.geometry.setDrawRange(0, d < RANGE.near ? T.allIdx : T.wideIdx);
		}
		if (decksDirty || Math.hypot(x - lastDecks.x, z - lastDecks.z) > 800) { lastDecks = { x, z }; buildDecks(Math.round(x / 64) * 64, Math.round(z / 64) * 64); }
		if (grew && t - grewAt > 4) { grew = false; grewAt = t; grewTrees(); }
		// the birds paddle about, steering off the shore and clear of you
		for (const B of flock) {
			B.ph += dt;
			if (Math.random() < dt * 0.15) B.turn = (Math.random() - 0.5) * 0.8;
			const ax = B.x + Math.cos(B.h) * 4, az = B.z + Math.sin(B.h) * 4;
			if (!inRings(B.L.rings, ax, az) || edgeDist(B.L.rings, ax, az) < 2.5) B.h += dt * 1.5; else B.h += B.turn * dt;
			B.x += Math.cos(B.h) * B.v * dt; B.z += Math.sin(B.h) * B.v * dt;
			const dc = Math.hypot(B.x - x, B.z - z);
			if (dc < 6) { B.h = Math.atan2(B.z - z, B.x - x); B.v = 0.9; } else B.v += (0.3 - B.v) * dt * 0.3;
			const dab = Math.max(0, Math.sin(B.ph * 0.4) - 0.93) * 12;
			B.b.position.set(B.x, B.L.level + Math.sin(B.ph * 2) * 0.012, B.z);
			B.b.rotation.set(0, -B.h, dab * 1.2);
		}
		S.stats.longest = Math.max(S.stats.longest, performance.now() - f0);
	}

	// ---------- what the rest of the world asks ----------
	// the named water at a point: { name, kind } (for the place labels)
	function nameAt(x, z) {
		if (!S.ready) return null;
		const L = lakeAt(x, z);
		if (L) return L.name ? { name: L.name, kind: /lagoon/i.test(L.name) ? 'Lagoon' : KIND_NAME[L.kind] } : null;
		const r = riverAt(x, z, 12);
		if (r?.L.name) return { name: r.L.name, kind: r.L.conc ? 'Flood channel' : r.L.cls === 'river' || /river/i.test(r.L.name) ? 'River' : /slough/i.test(r.L.name) ? 'Slough' : r.L.cls === 'canal' ? 'Canal' : 'Creek' };
		return null;
	}
	// what water is here, for fishing: 'lake', 'river' or null
	function kindAt(x, z) {
		if (!S.ready) return null;
		if (lakeAt(x, z)) return 'lake';
		const r = riverAt(x, z);
		return r && !r.L.conc && r.hw > 0.9 ? 'river' : null;
	}
	// a named lake's shore or a river's bank to stand on: { lat, lon, heading } (for teleports)
	function find(name) {
		const L = S.lakes.find((q) => q.name === name);
		if (!L) return null;
		const r = L.rings[0];
		let best = 0;
		for (let i = 0; i < r.length; i += 2) if (r[i + 1] > r[best + 1]) best = i;
		const ll = toLatLon(r[best], r[best + 1] + 6);
		return { ...ll, heading: 0 };
	}
	function info() {
		return { ready: S.ready, err: S.err ? String(S.err) : null, lakes: S.lakes.length, lakeMeshes: S.lakes.filter((L) => L.mesh).length, tiles: S.tiles.size, built: S.stats.built, carved: atlas.count(), decks: decks.size, birds: flock.length, queue: S.jobs.length, longestMs: Math.round(S.stats.longest * 10) / 10, slowestCarveMs: Math.round(S.stats.carveMs) };
	}
	return { group: root, update, waterAt, inWater, nameAt, kindAt, riverAt: (x, z) => { const r = riverAt(x, z, 2); return r ? { name: r.L.name, level: r.level, width: r.hw * 2 } : null; }, hasRiver: (x, z) => !!riverAt(x, z, 2), lakeAt: (x, z) => { const L = lakeAt(x, z); return L ? { name: L.name, level: L.level, kind: KIND_NAME[L.kind] } : null; }, find, info, ready: () => S.ready, budget: (ms) => { RANGE.budget = ms; }, attribution: () => S.H?.attribution };
}
