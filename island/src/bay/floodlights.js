// The landmarks, the bridges and the skyline at night: the floodlights on the towers and
// domes (the Ferry Building's clock tower, City Hall's dome, Coit Tower, the Transamerica
// spire, the Campanile, Hoover Tower, the Oakland Temple, the Golden Gate's towers...), the
// lamps along the bridges' decks and their pools on the roadway, the Bay Lights shimmering on
// the west span's cables, the high masts over the Port of Oakland's terminals, the lighthouses'
// flashes, and the red obstruction lights on everything tall (the downtown towers in step,
// thirty flashes a minute on the tallest, steady on the rest; Sutro Tower; the cranes).
//
// Cheap by design: two draws (every lamp, beacon and LED a point; every pool a quad), built
// once when the Bay is loaded (the skyline's beacons again when its towers are known) and
// switched in the shader by the night and the clock. The floodlights themselves light the
// landmarks' and the bridges' own materials through the landmark list (world/nightfield.js
// LF): the few that matter most from where you are (the strongest and nearest within a few
// kilometres), chosen twice a second, so a tower is lit from below, brightest low, its far
// side dark, its spire fading into the night, by its real geometry.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { FIELDS, LF_N } from '../world/nightfield.js';
import { qualityNow } from '../world/governor.js';
import { smoothstep as smooth } from '../noise.js';

const D2R = Math.PI / 180;
// colours (linear): floodlight warm, neutral white, amber; sodium; white LED; the obstruction red
const WARM = [1, 0.84, 0.64], NEUTRAL = [1, 0.93, 0.84], AMBER = [1, 0.7, 0.42], SODIUM = [1, 0.46, 0.12], LED = [0.8, 0.86, 1], RED = [1, 0.06, 0.02];

// The red lights on a tall building's roof (FAA obstruction lighting): from 90 m up a steady
// red at the top (two at opposite corners of a broad roof), from 150 m a flashing one, every
// flashing light in the city in step. towers: [{ x, y, z, w, d, h, a }]. Returns
// [{ x, y, z, flash }] (plain numbers, for the tests).
export function beaconsFor(towers, minH = 90) {
	const out = [];
	for (const t of towers) {
		if (!(t.h >= minH)) continue;
		const top = t.y + t.h + 0.6, flash = t.h >= 150, broad = Math.max(t.w || 0, t.d || 0) > 30;
		if (!broad) { out.push({ x: t.x, y: top, z: t.z, flash }); continue; }
		const ca = Math.cos(t.a || 0), sa = Math.sin(t.a || 0), hx = (t.w || 0) * 0.45, hz = (t.d || 0) * 0.45;
		for (const s of [-1, 1]) out.push({ x: t.x + ca * hx * s + sa * hz * s, y: top, z: t.z - sa * hx * s + ca * hz * s, flash });
	}
	return out;
}
// The obstruction lights' flash, all in step: thirty a minute, each a soft half second (0..1)
export function flashAt(t) {
	const c = ((t / 2) % 1 + 1) % 1;
	return smooth(0, 0.06, c) * (1 - smooth(0.3, 0.45, c));
}
// Which floodlights light the landmarks' materials now: the n best by distance over the root of
// their strength, within reach. F: Float32Array, stride 13 ([x, y, z, reach, r, g, b, cosO,
// dx, dy, dz, cosI, weight]); out: Int32Array of indices; returns how many.
export function pickFloods(F, count, cx, cy, cz, n, out, score, far = 6000) {
	for (let i = 0; i < count; i++) {
		const o = i * 13, d = Math.hypot(F[o] - cx, F[o + 1] - cy, F[o + 2] - cz);
		score[i] = d < far + F[o + 3] ? d / F[o + 12] : 1e9;
	}
	let k = 0;
	for (; k < n; k++) {
		let best = -1, bd = 1e8;
		for (let i = 0; i < count; i++) if (score[i] < bd) { bd = score[i]; best = i; }
		if (best < 0) break;
		score[best] = 1e9; out[k] = best;
	}
	return k;
}

const POINT_VS = /* glsl */`
	attribute vec3 aCol; attribute vec4 aK; attribute float aSize;
	uniform float uScale, uNight, uT;
	varying vec3 vCol;
	float lev(vec4 k) {
		float on = smoothstep(0.12, 0.35, uNight);
		if (k.x < 0.5) return on;
		if (k.x < 1.5) { float c = fract(uT * 0.5); return on * smoothstep(0.0, 0.06, c) * (1.0 - smoothstep(0.3, 0.45, c)); }
		if (k.x < 2.5) { float c = fract((uT + k.z) / k.y); return on * (0.04 + 0.96 * (1.0 - smoothstep(0.0, 0.05, abs(c - 0.05)))); }
		// the Bay Lights: slow bands of light running along the span, a glint here and there
		float w = 0.5 + 0.5 * sin(k.y * 0.022 - uT * 0.6 + sin(k.z * 0.09 + uT * 0.23) * 2.2);
		float sp = step(0.94, fract(sin(dot(vec2(k.y, k.z), vec2(12.9898, 78.233)) + floor(uT * 2.5)) * 43758.5453));
		return on * (0.1 + 0.9 * w * w * w + sp * 0.5);
	}
	void main() {
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		float d = -mv.z, L = lev(aK);
		float px = aSize * uScale / max(d, 0.1);
		float a = L * (1.0 - smoothstep(aK.w * 0.7, aK.w, d));
		vCol = aCol * a * clamp(px / 1.6, 0.35, 1.0);
		gl_PointSize = max(1.6, px);
		gl_Position = a > 0.002 && d > 0.05 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
	}`;
const POINT_FS = /* glsl */`
	uniform float uExpo;
	varying vec3 vCol;
	void main() {
		vec2 q = gl_PointCoord - 0.5;
		float r2 = dot(q, q) * 4.0;
		if (r2 > 1.0) discard;
		float a = exp(-r2 * 9.0) * 1.3 + exp(-r2 * 2.5) * 0.2;
		gl_FragColor = vec4(vCol * a * uExpo, 1.0);
		#include <colorspace_fragment>
	}`;
const POOL_VS = /* glsl */`
	attribute vec2 aUV; attribute vec3 aCol;
	uniform float uNight, uFar;
	varying vec2 vUV; varying vec3 vCol;
	void main() {
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		float a = smoothstep(0.12, 0.35, uNight) * (1.0 - smoothstep(uFar * 0.6, uFar, -mv.z));
		vUV = aUV; vCol = aCol * a;
		gl_Position = a > 0.002 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
	}`;
const POOL_FS = /* glsl */`
	uniform float uExpo;
	varying vec2 vUV; varying vec3 vCol;
	void main() {
		float r = length(vUV);
		float e = pow(1.0 + 6.25 * r * r, -1.5) * (1.0 - smoothstep(0.72, 1.0, r));
		if (e < 0.003) discard;
		gl_FragColor = vec4(vCol * e * uExpo, 1.0);
		#include <colorspace_fragment>
	}`;

export function createFloodlights(scene, { isPhone = false, ground = () => 0, world = () => null } = {}) {
	const CAP_P = isPhone ? 2500 : 7000, CAP_Q = isPhone ? 800 : 2400, CAP_F = 160;
	const pPos = new Float32Array(CAP_P * 3), pCol = new Float32Array(CAP_P * 3), pK = new Float32Array(CAP_P * 4), pSize = new Float32Array(CAP_P);
	const pGeo = new THREE.BufferGeometry();
	pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
	pGeo.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3));
	pGeo.setAttribute('aK', new THREE.BufferAttribute(pK, 4));
	pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
	pGeo.setDrawRange(0, 0);
	const U = { uScale: { value: 400 }, uNight: { value: 0 }, uT: { value: 0 }, uExpo: { value: 1 }, uFar: { value: isPhone ? 1800 : 3200 } };
	const pMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
	const points = new THREE.Points(pGeo, pMat);
	points.frustumCulled = false; points.visible = false; points.name = 'flood-lights'; points.renderOrder = 6;
	const qPos = new Float32Array(CAP_Q * 12), qUV = new Float32Array(CAP_Q * 8), qCol = new Float32Array(CAP_Q * 12), qIdx = new Uint32Array(CAP_Q * 6);
	for (let i = 0; i < CAP_Q; i++) qIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
	const qGeo = new THREE.BufferGeometry();
	qGeo.setAttribute('position', new THREE.BufferAttribute(qPos, 3));
	qGeo.setAttribute('aUV', new THREE.BufferAttribute(qUV, 2));
	qGeo.setAttribute('aCol', new THREE.BufferAttribute(qCol, 3));
	qGeo.setIndex(new THREE.BufferAttribute(qIdx, 1));
	qGeo.setDrawRange(0, 0);
	const qMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: POOL_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
	const pools = new THREE.Mesh(qGeo, qMat);
	pools.frustumCulled = false; pools.visible = false; pools.name = 'flood-pools'; pools.renderOrder = 3;
	scene.add(pools, points);
	const tmpV = new THREE.Vector2();
	points.onBeforeRender = (r, sc, cam) => { U.uScale.value = r.getSize(tmpV).y * r.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360)); U.uExpo.value = r.toneMappingExposure * 0.85; };

	// the floodlights for the landmark list: stride 13 (see pickFloods)
	const F = new Float32Array(CAP_F * 13), chosen = new Int32Array(LF_N), score = new Float32Array(CAP_F);
	let np = 0, nq = 0, nfl = 0, nStatic = 0, qStatic = 0, built = false, skyN = -1, clock = 0, lastPick = -1;
	const stats = { floods: 0, beacons: 0, bayLights: 0, deck: 0, masts: 0 };

	function point(x, y, z, c, k, kind, a, b, far, size) {
		if (np >= CAP_P) return;
		pPos[np * 3] = x; pPos[np * 3 + 1] = y; pPos[np * 3 + 2] = z;
		pCol[np * 3] = c[0] * k; pCol[np * 3 + 1] = c[1] * k; pCol[np * 3 + 2] = c[2] * k;
		pK[np * 4] = kind; pK[np * 4 + 1] = a; pK[np * 4 + 2] = b; pK[np * 4 + 3] = far;
		pSize[np] = size;
		np++;
	}
	// a pool of light on a deck or the ground: centred at (x, y, z), r across, from a lamp h above
	function pool(x, y, z, r, h, I, c) {
		if (nq >= CAP_Q) return;
		const o = nq * 12, k = I / (h * h) * 0.08;
		qPos.set([x - r, y, z - r, x + r, y, z - r, x + r, y, z + r, x - r, y, z + r], o);
		qUV.set([-1, -1, 1, -1, 1, 1, -1, 1], nq * 8);
		for (let j = 0; j < 4; j++) { qCol[o + j * 3] = c[0] * k; qCol[o + j * 3 + 1] = c[1] * k; qCol[o + j * 3 + 2] = c[2] * k; }
		nq++;
	}
	// a local frame at a real place (as landmarks.js at(): heading the bearing of local +z)
	const frame = (lat, lon, heading = 0, base = null) => {
		const w = toWorld(lat, lon), g = base ?? Math.max(0, ground(w.x, w.z)), t = -heading * D2R + Math.PI, c = Math.cos(t), s = Math.sin(t);
		return (lx, ly, lz) => [w.x + c * lx + s * lz, g + ly, w.z - s * lx + c * lz];
	};
	// a floodlight at l (local) aimed at t (local): cone outer and inner half-angles (degrees),
	// strength I (as the evening's lamps), its colour, how far its light is worth working out
	function flood(Fr, l, t, outer, inner, I, c, reach, glow = true) {
		if (nfl >= CAP_F) return;
		const p = Fr(...l), q = Fr(...t);
		let dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
		const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
		F.set([p[0], p[1], p[2], reach, c[0] * I, c[1] * I, c[2] * I, Math.cos(outer * D2R), dx, dy, dz, Math.cos(inner * D2R), Math.sqrt(I)], nfl * 13);
		nfl++; stats.floods++;
		if (glow) point(p[0], p[1] + 0.2, p[2], c, 2.2, 0, 0, 0, 1600, 0.5);
	}
	// n floodlights round a point at radius r, height y, all aimed at the same spot up the tower
	function ring(Fr, n, r, y, aim, outer, inner, I, c, reach, a0 = Math.PI / 4) {
		for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; flood(Fr, [Math.cos(a) * r + aim[0], y, Math.sin(a) * r + aim[2]], aim, outer, inner, I, c, reach); }
	}
	const beacon = (x, y, z, flash) => { point(x, y, z, RED, flash ? 7 : 4, flash ? 1 : 0, 0, 0, 14000, 1.3); stats.beacons++; };

	function buildStatic() {
		np = 0; nq = 0; nfl = 0;
		for (const k in stats) stats[k] = 0;
		// ---- San Francisco
		{ // the Ferry Building: its clock tower lit from the roof round it, its long front washed
			const Fr = frame(37.7955, -122.3937, 150);
			ring(Fr, 4, 8.5, 16.2, [-6, 50, 0], 24, 10, 420, WARM, 90);
			for (const z of [-60, -20, 20, 60]) for (const s of [-1, 1]) flood(Fr, [s * 19, 0.4, z], [s * 13, 10, z], 40, 18, 70, WARM, 30);
		}
		{ // City Hall: the dome lit from its roof, the plaza front from below
			const Fr = frame(37.7793, -122.4193, 0);
			ring(Fr, 6, 27, 32.4, [0, 64, 0], 24, 10, 520, NEUTRAL, 95);
			for (const z of [-34, -12, 12, 34]) flood(Fr, [70, 0.4, z], [62, 16, z], 40, 18, 110, WARM, 40);
		}
		{ // Coit Tower on Telegraph Hill
			const Fr = frame(37.80239, -122.40582, 0);
			ring(Fr, 4, 13, 0.4, [0, 40, 0], 18, 8, 380, WARM, 80);
		}
		{ // the Transamerica Pyramid: the spire's top floors lit from its wings, its red light at the tip
			const Fr = frame(37.79519, -122.40279, 0);
			ring(Fr, 4, 11, 196, [0, 238, 0], 20, 8, 260, NEUTRAL, 70);
			const p = Fr(0, 260.6, 0); beacon(p[0], p[1], p[2], true);
		}
		{ // Salesforce Tower: the red lights at its crown (the crown's own light is city.js's)
			const Fr = frame(37.78975, -122.39687, 0);
			for (const s of [-1, 1]) { const p = Fr(s * 10.6, 326.6, s * 10.6); beacon(p[0], p[1], p[2], true); }
		}
		{ // Sutro Tower: flashing at the mast's top, steady on the legs at the two decks
			const Fr = frame(37.75523, -122.45278, 0);
			let p = Fr(0, 298.5, 0); beacon(p[0], p[1], p[2], true);
			for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; for (const [y, r] of [[120, 17], [181, 14]]) { p = Fr(Math.cos(a) * r, y + 2, Math.sin(a) * r); beacon(p[0], p[1], p[2], false); } }
		}
		{ // the Palace of Fine Arts: the rotunda glowing amber over its lagoon
			const Fr = frame(37.8029, -122.4484, 30);
			ring(Fr, 6, 30, 0.4, [0, 30, 0], 26, 12, 460, AMBER, 70, 0.3);
		}
		{ // Alcatraz's light: a white flash every five seconds; Point Bonita's, every four
			let Fr = frame(37.82644, -122.42176, 0), p = Fr(0, 27, 0);
			point(p[0], p[1], p[2], [1, 0.97, 0.9], 9, 2, 5, 0, 16000, 1.6);
			Fr = frame(37.8157, -122.5298, 0); p = Fr(0, 11.4, 0);
			point(p[0], p[1], p[2], [1, 0.97, 0.9], 9, 2, 4, 1.3, 16000, 1.4);
			// (Fort Point's little light on its barbette)
			Fr = frame(37.8106, -122.4771, 60); p = Fr(28, 24.8, 16);
			point(p[0], p[1], p[2], [1, 0.9, 0.7], 3, 0, 0, 0, 5000, 0.6);
		}
		// ---- the East Bay, the Peninsula and San Ramon
		{ // Oakland City Hall, the Tribune Tower's copper crown, the Temple white on its hill
			let Fr = frame(37.8053, -122.2724, 20);
			ring(Fr, 4, 19, 30.4, [0, 72, 0], 22, 10, 500, NEUTRAL, 85);
			Fr = frame(37.8043, -122.2708, 20);
			ring(Fr, 4, 9.5, 76.4, [0, 88, 0], 34, 14, 120, WARM, 30);
			ring(Fr, 4, 13, 0.4, [0, 45, 0], 16, 7, 260, WARM, 70);
			Fr = frame(37.8078, -122.1978, 0);
			ring(Fr, 4, 46, 0.4, [0, 38, 0], 28, 13, 900, [1, 0.97, 0.92], 110);
		}
		{ // the Campanile and Hoover Tower
			ring(frame(37.8721, -122.2578, 0), 4, 15, 0.4, [0, 56, 0], 18, 8, 450, WARM, 90);
			ring(frame(37.4275, -122.1668, 0), 4, 17, 0.4, [0, 56, 0], 18, 8, 450, WARM, 90);
		}
		{ // San Ramon: City Hall's front and the library's washed from the lawn, the canopy at
			// Bishop Ranch lit from under it
			let Fr = frame(37.7657, -121.9552, 70);
			for (const x of [-27, -9, 9, 27]) flood(Fr, [x, 0.4, 19.5], [x, 8, 15], 40, 18, 80, WARM, 30);
			Fr = frame(37.7648, -121.9522, 40);
			for (const x of [-14, 0, 14]) flood(Fr, [x, 0.4, 21], [x, 6, 17.5], 40, 18, 60, WARM, 25);
			Fr = frame(37.7672, -121.96, 70);
			for (let i = -3; i <= 3; i++) for (const z of [-14, 14]) { const p = Fr(i * 21, 16.2, z); point(p[0], p[1], p[2], [1, 0.86, 0.66], 2.2, 0, 0, 0, 1600, 0.45); pool(p[0], ground(p[0], p[2]) + 0.4, p[2], 14, 16, 160, [1, 0.86, 0.66]); }
		}
		// ---- the Golden Gate: its towers lit from the deck, its lamps' pools on the roadway
		{
			const c = toWorld(37.81992, -122.47829), b = -10.8 * D2R, ax = [Math.sin(b), -Math.cos(b)], lt = [Math.cos(b), Math.sin(b)];
			const END = 983, deckY = (s) => 64 + 5.5 * Math.max(0, 1 - (s / END) * (s / END));
			const Wb = (s, t, y) => [c.x + ax[0] * s + lt[0] * t, y, c.z + ax[1] * s + lt[1] * t];
			for (const s0 of [-640, 640]) for (const sd of [-1, 1]) for (const e of [-1, 1]) {
				const dy = deckY(s0) + 1;
				// (the floodlights by the legs, both faces of each, aimed up the leg)
				const pl = Wb(s0 + e * 9, sd * 17, dy), pt = Wb(s0, sd * 14.6, 165);
				if (nfl < CAP_F) {
					let dx = pt[0] - pl[0], dyy = pt[1] - pl[1], dz = pt[2] - pl[2]; const L = Math.hypot(dx, dyy, dz); dx /= L; dyy /= L; dz /= L;
					F.set([pl[0], pl[1], pl[2], 230, 2600 * 1, 2600 * 0.78, 2600 * 0.58, Math.cos(13 * D2R), dx, dyy, dz, Math.cos(5 * D2R), Math.sqrt(2600)], nfl * 13); nfl++; stats.floods++;
				}
			}
			for (let s = -END; s <= END; s += 30.5) for (const sd of [-1, 1]) { const p = Wb(s, sd * 9.6, deckY(s) + 0.66); pool(p[0], p[1], p[2], 21, 8.4, 30, SODIUM); stats.deck++; }
		}
		// ---- the Bay Bridge: the deck lamps, the Bay Lights on the west span, the red lights on its towers
		{
			const P = (lat, lon, y) => { const w = toWorld(lat, lon); return [w.x, y, w.z]; };
			const A = P(37.78796, -122.39035, 58), Bm = P(37.79967, -122.37735, 62), C = P(37.8103, -122.3655, 58);
			const D = P(37.814, -122.3585, 50), E = P(37.8176, -122.349, 45), Fp = P(37.8252, -122.317, 22), G = P(37.8262, -122.2985, 8);
			const dir = [C[0] - A[0], C[2] - A[2]], dl = Math.hypot(dir[0], dir[1]), side = [-dir[1] / dl, dir[0] / dl];
			const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
			const deckAt = (u) => (u < 0.5 ? lerp(A, Bm, u * 2) : lerp(Bm, C, (u - 0.5) * 2));
			// the west span's towers: red at the top of each leg, flashing
			for (const t of [0.16, 0.36, 0.64, 0.84]) for (const sd of [-1, 1]) { const q = lerp(A, C, t); beacon(q[0] + side[0] * sd * 11, 161, q[2] + side[1] * sd * 11, true); }
			// the self-anchored span's white tower
			{ const T = lerp(D, E, 0.35); beacon(T[0], 161, T[2], true); }
			// the deck lamps: sodium on the west span, white LED on the new east span
			const deck = (a, b, offs, col) => {
				const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.floor(L / 45));
				for (let i = 0; i <= n; i++) {
					const q = lerp(a, b, i / n);
					for (const o of offs) { const x = q[0] + side[0] * o, z = q[2] + side[1] * o, y = q[1] + 1.5; point(x, y + 8, z, col, 2.4, 0, 0, 0, 7000, 0.6); pool(x - side[0] * Math.sign(o) * 2.5, y + 0.05, z - side[1] * Math.sign(o) * 2.5, 19, 8, 30, col); stats.deck++; }
				}
			};
			deck(A, Bm, [-9, 9], SODIUM); deck(Bm, C, [-9, 9], SODIUM);
			for (const [a, b] of [[C, D], [D, E], [E, Fp], [Fp, G]]) deck(a, b, [-21, -3, 3, 21], LED);
			// the Bay Lights: LEDs down the suspender cables of the west span's north face, every
			// 15 m along it (30 on a phone), every 4 m down each (8), from the cable to the deck
			const knots = [0, 0.16, 0.36, 0.5, 0.64, 0.84, 1], tops = [62, 158, 158, 70, 158, 158, 62], sags = [20, 88, 6, 6, 88, 20];
			const cableY = (u) => { let k = 0; while (k < 5 && u > knots[k + 1]) k++; const v = (u - knots[k]) / (knots[k + 1] - knots[k]); return tops[k] + (tops[k + 1] - tops[k]) * v - sags[k] * 4 * v * (1 - v); };
			const stepA = isPhone ? 30 : 15, stepV = isPhone ? 8 : 4;
			for (let s = stepA; s < dl - stepA * 0.5; s += stepA) {
				const u = s / dl, q = deckAt(u), top = cableY(u), x = q[0] - side[0] * 11, z = q[2] - side[1] * 11;
				for (let y = q[1] + 3; y < top - 1; y += stepV) { point(x, y, z, [0.9, 0.93, 1], 1.5, 3, s, y, 9000, 0.32); stats.bayLights++; }
			}
		}
		// ---- the Port of Oakland: a red light on each crane, sodium high masts over the terminals
		{
			const rows = [[[37.8105, -122.33], [37.801, -122.3205]], [[37.7975, -122.319], [37.794, -122.3025]]];
			for (const [a, b] of rows) for (let k = 0; k <= 11; k++) {
				const u = k / 11, lat = a[0] + (b[0] - a[0]) * u, lon = a[1] + (b[1] - a[1]) * u, w = toWorld(lat, lon);
				beacon(w.x, 2 + 70, w.z, false);
			}
			for (const [lat, lon] of [[37.802, -122.323], [37.799, -122.317], [37.8035, -122.315], [37.7975, -122.3245], [37.8005, -122.329], [37.796, -122.312]]) {
				const w = toWorld(lat, lon), g = Math.max(2, ground(w.x, w.z));
				point(w.x, g + 35, w.z, SODIUM, 3, 0, 0, 0, 9000, 1.6);
				pool(w.x, g + 0.1, w.z, 85, 35, 700, SODIUM); stats.masts++;
			}
		}
		nStatic = np; qStatic = nq;
		built = true;
	}
	// the skyline's red lights (city.js: every downtown's tall towers, kept for far views)
	function buildSkyline() {
		const sky = world()?.city?.skyline?.();
		if (!sky || sky.length === skyN) return;
		skyN = sky.length;
		np = nStatic;
		const B = beaconsFor(sky);
		for (const q of B) beacon(q.x, q.y, q.z, q.flash);
		upload();
	}
	function upload() {
		pGeo.setDrawRange(0, np);
		for (const k of ['position', 'aCol', 'aK', 'aSize']) { const A = pGeo.attributes[k]; A.clearUpdateRanges(); A.addUpdateRange(0, Math.max(1, np) * A.itemSize); A.needsUpdate = true; }
		qGeo.setDrawRange(0, nq * 6);
		for (const k of ['position', 'aUV', 'aCol']) { const A = qGeo.attributes[k]; A.clearUpdateRanges(); A.addUpdateRange(0, Math.max(1, nq) * 4 * A.itemSize); A.needsUpdate = true; }
	}
	// the landmark list, twice a second (no allocation)
	function pick(cam, on) {
		const L = FIELDS.LF, P = L.P.value, C = L.C.value, D = L.D.value;
		const far = qualityNow()?.far ?? 1;
		U.uFar.value = (isPhone ? 1800 : 3200) * far;
		const n = pickFloods(F, nfl, cam.position.x, cam.position.y, cam.position.z, LF_N, chosen, score, (isPhone ? 3500 : 6000) * far);
		for (let k = 0; k < n; k++) {
			const o = chosen[k] * 13;
			P[k * 4] = F[o]; P[k * 4 + 1] = F[o + 1]; P[k * 4 + 2] = F[o + 2]; P[k * 4 + 3] = F[o + 3];
			C[k * 4] = F[o + 4] * on; C[k * 4 + 1] = F[o + 5] * on; C[k * 4 + 2] = F[o + 6] * on; C[k * 4 + 3] = F[o + 7];
			D[k * 4] = F[o + 8]; D[k * 4 + 1] = F[o + 9]; D[k * 4 + 2] = F[o + 10]; D[k * 4 + 3] = F[o + 11];
		}
		L.n.value = on > 0.003 ? n : 0;
	}
	function update(dt, cam, night) {
		clock += dt;
		U.uNight.value = night; U.uT.value = clock;
		const show = night > 0.1;
		points.visible = pools.visible = show && built;
		if (!show) { FIELDS.LF.n.value = 0; return; }
		if (!built) { if (!world()?.landmarks) return; buildStatic(); upload(); }
		if (clock - lastPick > 0.5 || lastPick < 0) { lastPick = clock; pick(cam, smooth(0.12, 0.35, night)); if (skyN < 0 || (clock % 4) < 0.6) buildSkyline(); }
	}
	function dispose() {
		scene.remove(pools, points);
		pGeo.dispose(); qGeo.dispose(); pMat.dispose(); qMat.dispose();
		FIELDS.LF.n.value = 0;
	}
	const info = () => ({ ...stats, points: np, pools: nq, lit: FIELDS.LF.n.value, built, static: [nStatic, qStatic] });
	return { update, info, dispose, points, pools, rebuild: () => { built = false; skyN = -1; } };
}
