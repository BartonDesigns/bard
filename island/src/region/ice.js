// The polar sea: the pack ice, its floes and pressure ridges, the icebergs, and the aurora.
//
// How far the ice reaches follows the month: in the Arctic the pack is widest in March (out
// to about 68 degrees in this simple reckoning) and smallest in September (back to about
// 77); round Antarctica widest in September, smallest in February. Inside the edge the floes
// crowd closer until they are one field cracked into plates, ridged where they pushed into
// each other. Icebergs calve from Greenland's glaciers and the Antarctic shelves and drift
// in the seas off them, summer and winter. The floes are firm to walk on.
//
// The aurora: curtains of green fading to red above, rippling and drifting, on clear dark
// nights in the auroral oval (overhead round 65 to 72 degrees, low toward the pole further
// south), stronger some nights than others.

import * as THREE from 'three';
import { Geo } from './geo.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (a, b, k) => { let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(k, 83492791)) >>> 0; return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// The pack is laid on a lattice of the latitude and longitude alone (a cell 40 m each way: 2775
// rows to the degree, the columns of each degree's band of rows a whole number of sixteenths of a
// row's height wide, as wide as that latitude makes them, so the sea's float GPU finds the same
// columns without a cosine's rounding), so a floe has one place on the Earth wherever you come from. The 3D floes stand round you; the sea's own surface (world/ocean.js,
// ICE_GLSL) draws the same floes, from the same hashes, out to the horizon, so the pack never
// ends in a ring round you, and the swell under it is damped.
export const FLOE_S = 40, FLOE_ROWS = 2775;
const DL = 1 / FLOE_ROWS;
// the band of a row (whole degrees of latitude, by integer division), and its columns' width (deg)
export const floeBand = (i) => Math.floor(i / FLOE_ROWS);
export const floeBandM = (band) => Math.round(16 / Math.max(0.05, Math.cos((band + 0.5) * Math.PI / 180)));
export const floeRowDn = (i) => DL * floeBandM(floeBand(i)) / 16;
// a column of a row's band, round the back of the world at 180 degrees (as ICE_GLSL)
export function floeWrapJ(j, m) {
	const N = FLOE_ROWS * 16 * 180, jmax = Math.trunc((N - 1) / m), jmin = -Math.trunc((N + m - 1) / m);
	return j > jmax ? jmin + (j - jmax - 1) : j < jmin ? jmax - (jmin - j - 1) : j;
}
// the uniforms the sea reads: on (Earth's own seas), the month, and the frame (lat = x - z / z', lon = y + x / w')
// and the 3D floes' circle (x, z, radius less a floe: inside it the sea need not draw them)
export const ICE_U = { uIceOn: { value: 0 }, uIceMonth: { value: 0 }, uIceLL: { value: new THREE.Vector4(0, 0, 111000, 111000) }, uIceNear: { value: new THREE.Vector3() } };

// how much of the sea is ice at a latitude this month (0..1)
export function iceCover(lat, lon, month) {
	if (lat > 0) {
		const wk = 0.5 + 0.5 * Math.cos(2 * Math.PI * (month - 2.5) / 12), edge = 77 - 9 * wk;
		// (Hudson Bay and Baffin Bay freeze right over in winter)
		const bay = lon > -95 && lon < -55 && lat > 55 ? smooth(0.4, 0.8, wk) : 0;
		return Math.max(smooth(edge - 1.5, edge + 2.5, lat), bay);
	}
	const wk = 0.5 + 0.5 * Math.cos(2 * Math.PI * (month - 8.5) / 12), edge = 70 - 8 * wk;
	return smooth(edge - 1.5, edge + 2.5, -lat);
}
// the same in GLSL (iceCover, the hash, the floes' outline: keep them in step)
export const ICE_GLSL = /* glsl */`
uniform float uIceOn, uIceMonth; uniform vec4 uIceLL; uniform vec3 uIceNear;
float iceCoverG(float lat, float lon, float month){
	if (lat > 0.0) {
		float wk = 0.5 + 0.5 * cos(6.2831853 * (month - 2.5) / 12.0), edge = 77.0 - 9.0 * wk;
		float bay = lon > -95.0 && lon < -55.0 && lat > 55.0 ? smoothstep(0.4, 0.8, wk) : 0.0;
		return max(smoothstep(edge - 1.5, edge + 2.5, lat), bay);
	}
	float wk = 0.5 + 0.5 * cos(6.2831853 * (month - 8.5) / 12.0), edge = 70.0 - 8.0 * wk;
	return smoothstep(edge - 1.5, edge + 2.5, -lat);
}
// the latitude and longitude of a point of the engine's ground
vec2 iceLL(vec2 p){ return vec2(uIceLL.x - p.y / uIceLL.z, mod(uIceLL.y + p.x / uIceLL.w + 180.0, 360.0) - 180.0); }
float iceRnd(inout uint h){ h += 0x6D2B79F5u; uint t = (h ^ (h >> 15u)) * (1u | h); t = (t + (t ^ (t >> 7u)) * (61u | t)) ^ t; return float(t ^ (t >> 14u)) / 4294967296.0; }
float floeRim(float i){ return 0.78 + 0.22 * sin(i * 2.7 + 1.3) * cos(i * 1.9); }
// how much of this point is floe (x), how near its rim (y), and the cover here (z); aa: the pixel's size (m)
vec3 packIce(vec2 p, float aa){
	vec2 ll = iceLL(p);
	float cov = iceCoverG(ll.x, ll.y, uIceMonth);
	if (cov < 0.004) return vec3(0.0);
	if (aa > 12.0) return vec3(0.0, 0.0, cov);        // (finer than the pixel: the sea takes their share, packMean)
	if (distance(p, uIceNear.xy) < uIceNear.z) return vec3(0.0, 0.0, cov);   // (the 3D floes stand here)
	const float DL = 1.0 / ${FLOE_ROWS.toFixed(1)};
	int i0 = int(floor(ll.x * ${FLOE_ROWS.toFixed(1)}));
	float best = 0.0, rim = 0.0;
	for (int a = -1; a <= 1; a++) {
		int i = i0 + a;
		int band = i >= 0 ? i / ${FLOE_ROWS} : -((-i - 1) / ${FLOE_ROWS}) - 1;
		int m = int(floor(16.0 / max(0.05, cos(radians(float(band) + 0.5))) + 0.5));
		float rowLat = (float(i) + 0.5) * DL, dn = DL * float(m) / 16.0;
		// (the band's first and last columns, in whole numbers: 180 degrees is ${FLOE_ROWS * 16 * 180} / m of them)
		int jmax = (${FLOE_ROWS * 16 * 180} - 1) / m, jmin = -((${FLOE_ROWS * 16 * 180} + m - 1) / m), j0 = int(floor(ll.y / dn));
		for (int b = -1; b <= 1; b++) {
			// (the columns either side, round the back of the world at 180 degrees)
			int j = j0 + b;
			if (j > jmax) j = jmin + (j - jmax - 1); else if (j < jmin) j = jmax - (jmin - j - 1);
			float cc = iceCoverG(rowLat, (float(j) + 0.5) * dn, uIceMonth);
			uint h = (uint(i) * 73856093u) ^ (uint(j) * 19349663u) ^ (7u * 83492791u);
			if (iceRnd(h) > cc * 1.05) continue;
			float fl = (float(i) + iceRnd(h)) * DL, fn = (float(j) + iceRnd(h)) * dn;
			float rad = (8.0 + iceRnd(h) * 14.0) * (0.7 + cc * 0.8); iceRnd(h);
			vec2 d = vec2((mod(ll.y - fn + 180.0, 360.0) - 180.0) * uIceLL.w, -(ll.x - fl) * uIceLL.z);
			if (dot(d, d) > rad * rad * 1.5 + aa * aa) continue;      // (well clear of it)
			float ang = iceRnd(h) * 6.2831853, sx = rad * (0.8 + iceRnd(h) * 0.4); iceRnd(h); float sz = rad * (0.8 + iceRnd(h) * 0.4);
			float c = cos(ang), s = sin(ang);
			vec2 u = vec2((c * d.x - s * d.y) / sx, (s * d.x + c * d.y) / sz);
			// (inside the floe's outline: the edge of its sector, a straight side between two corners)
			float k0 = floor(fract(atan(u.y, u.x) / 6.2831853) * 11.0), a0 = k0 / 11.0 * 6.2831853, a1 = (k0 + 1.0) / 11.0 * 6.2831853;
			vec2 A = floeRim(k0) * vec2(cos(a0), sin(a0)), B = floeRim(mod(k0 + 1.0, 11.0)) * vec2(cos(a1), sin(a1)), E = B - A;
			float side = (E.x * (u.y - A.y) - E.y * (u.x - A.x)) / length(E), e = aa / min(sx, sz);
			float inF = smoothstep(-e, e, side);
			if (inF > best) { best = inF; rim = 1.0 - smoothstep(0.0, 2.5 / min(sx, sz), side); }
		}
	}
	return vec3(best, rim, cov);
}
// the share of the sea the floes cover where they are too small to draw, at a cover
float packMean(float cov){ float m = 0.7 + 0.8 * cov; return 1.0 - exp(-min(1.0, cov * 1.05) * 477.6 * m * m / (S2_FLOE)); }
`.replace('S2_FLOE', (FLOE_S * FLOE_S).toFixed(1));

// how likely icebergs are here (off Greenland, Baffin Bay, Svalbard, and all round Antarctica)
export function bergChance(lat, lon) {
	if (lat < -55) return 0.22 * smooth(-55, -62, lat);
	const green = lat > 58 && lat < 80 && lon > -75 && lon < -10 ? 0.3 : 0;
	const sval = lat > 74 && lat < 82 && lon > 5 && lon < 35 ? 0.1 : 0;
	return Math.max(green, sval, lat > 70 ? 0.04 : 0);
}

function floeGeometry() {
	// an irregular plate: a snow top, a blue-white rim, an underside under the water
	const g = new Geo(), n = 11, pts = [];
	for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 0.78 + 0.22 * Math.sin(i * 2.7 + 1.3) * Math.cos(i * 1.9); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
	g.jit = 0.03;
	for (let i = 0; i < n; i++) {
		const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % n];
		g.face([[0, 0.55, 0], [bx, 0.5, bz], [ax, 0.5, az]], [0.93, 0.95, 0.97]);
		g.face([[ax, 0.5, az], [bx, 0.5, bz], [bx * 1.02, -0.9, bz * 1.02], [ax * 1.02, -0.9, az * 1.02]], [0.7, 0.82, 0.88]);
	}
	return g.geometry();
}
function rubbleGeometry() { const g = new Geo(); g.box(0, -0.3, 0, 1, 1, 1, [0.88, 0.93, 0.96], { r: 0.4 }); g.box(0.3, 0.2, 0.2, 0.7, 0.6, 0.5, [0.82, 0.9, 0.95], { r: 1.1 }); return g.geometry(); }
function bergGeometry(kind) {
	const g = new Geo(), W = [0.95, 0.97, 0.99], B = [0.68, 0.84, 0.92], n = 9;
	const ring = (y, k, j) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = k * (0.8 + 0.2 * Math.sin(i * 3.1 + j)); return [Math.cos(a) * r, y, Math.sin(a) * r]; });
	const rings = kind === 0 ? [ring(-0.6, 1, 0), ring(0, 1, 0.3), ring(0.55, 0.97, 0.5), ring(0.6, 0.9, 0.5)] : kind === 1 ? [ring(-0.6, 1, 0), ring(0, 1, 1), ring(0.45, 0.75, 2), ring(0.8, 0.35, 3), ring(0.95, 0.05, 3)] : [ring(-0.6, 0.9, 0), ring(0, 0.9, 2), ring(0.5, 0.5, 1), ring(1.1, 0.25, 4), ring(1.5, 0.02, 4)];
	for (let k = 0; k + 1 < rings.length; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; g.face([rings[k][j], rings[k][i], rings[k + 1][i], rings[k + 1][j]], k === 0 ? B : rings[k + 1][i][1] > 0.4 ? W : [0.82, 0.9, 0.95]); }
	const top = rings[rings.length - 1]; for (let i = 0; i < n; i++) g.face([top[(i + 1) % n], top[i], [0, top[0][1], 0]], W);
	return g.geometry();
}

const AURORA_VS = /* glsl */`
	varying vec2 vUv;
	void main() { vUv = uv; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); p.z = p.w * 0.99997; gl_Position = p; }`;
const AURORA_FS = /* glsl */`
	uniform float uTime, uK; varying vec2 vUv;
	float h1(float x) { return fract(sin(x * 127.1) * 43758.5); }
	float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
	void main() {
		float x = vUv.x * 60.0, t = uTime;
		float rays = 0.45 + 0.55 * n1(x * 3.0 + t * 0.4) * n1(x * 0.7 - t * 0.15 + 3.0);
		float fold = 0.6 + 0.4 * sin(vUv.x * 18.0 + t * 0.2 + n1(x * 0.3) * 4.0);
		float y = vUv.y;
		float base = smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.35, 1.0, y));
		vec3 green = vec3(0.25, 1.0, 0.55), red = vec3(0.75, 0.2, 0.45);
		vec3 c = mix(green, red, smoothstep(0.3, 0.85, y));
		float a = base * rays * fold * uK * smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
		gl_FragColor = vec4(c * a * 1.2, 1.0);
	}`;

// Bounded artistic visibility, not a geomagnetic forecast. Keep the same three
// curtains and fade out in daylight/cloud: brightness needs no new GPU passes.
export function auroraStrength(lat, night, cloud, activity = 0.5) {
	const alat = Math.abs(lat), band = smooth(54, 62, alat) * (1 - smooth(78, 84, alat));
	return band * smooth(0.55, 0.9, night) * (1 - smooth(0.45, 0.85, cloud)) * (0.55 + 0.45 * Math.max(0, Math.min(1, activity)));
}

export function createIce(scene, { height, toXZ, toLL, isPhone = false }) {
	const group = new THREE.Group();
	group.name = 'regional ice';
	scene.add(group);
	const iceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
	const CAP = isPhone ? 900 : 2200, BCAP = isPhone ? 30 : 70, RCAP = isPhone ? 800 : 2000;
	const floes = new THREE.InstancedMesh(floeGeometry(), iceMat, CAP);
	const rubble = new THREE.InstancedMesh(rubbleGeometry(), iceMat, RCAP);
	const bergs = [0, 1, 2].map((k) => new THREE.InstancedMesh(bergGeometry(k), iceMat, BCAP));
	for (const m of [floes, rubble, ...bergs]) { m.count = 0; m.frustumCulled = false; m.castShadow = !isPhone; m.receiveShadow = true; group.add(m); }
	const list = [];                 // the floes for standing on: [x, z, r]
	const solid = [];                // the bergs: [x, z, r, h]
	let at = null, cover = 0;
	const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

	// the aurora: three curtains in the sky round you
	const auroraU = { uTime: { value: 0 }, uK: { value: 0 } };
	const auroraMat = new THREE.ShaderMaterial({ uniforms: auroraU, vertexShader: AURORA_VS, fragmentShader: AURORA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
	const aurora = new THREE.Group();
	for (let k = 0; k < 3; k++) {
		const n = 64, pos = [], uv = [], idx = [];
		for (let i = 0; i <= n; i++) {
			const t = i / n, a = -1.2 + t * 2.4 + k * 0.35, R = 7000 + k * 900, x = Math.sin(a) * R, z = -Math.cos(a) * R * (0.55 + 0.15 * k) - 1500 + Math.sin(t * 9 + k) * 500;
			pos.push(x, 1800 + k * 300, z, x, 5200 + k * 500, z); uv.push(t, 0, t, 1);
			if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
		const m = new THREE.Mesh(g, auroraMat); m.frustumCulled = false; m.renderOrder = -1;
		aurora.add(m);
	}
	aurora.visible = false;
	scene.add(aurora);

	// lay the ice out round a point (engine metres), from the cells of the latitude and longitude
	function layout(cx, cz, month) {
		const ll = toLL(cx, cz), cov = iceCover(ll.lat, ll.lon, month), bc = bergChance(ll.lat, ll.lon);
		cover = cov;
		list.length = 0; solid.length = 0;
		let nf = 0, nr = 0;
		const nb = [0, 0, 0];
		const seaAt = (x, z) => height.at(x, z) < -1.5 && height.out.land <= 0.02;
		if (Math.max(cov, iceCover(ll.lat - 0.02, ll.lon, month), iceCover(ll.lat + 0.02, ll.lon, month)) > 0.004) {
			// (the lattice and the draws are ICE_GLSL's: the sea draws these same floes past them)
			const Rm = isPhone ? 650 : 950, i0 = Math.floor(ll.lat / DL), K = Math.ceil(Rm / FLOE_S);
			for (let a = -K; a <= K && nf < CAP; a++) {
				const i = i0 + a, m = floeBandM(floeBand(i)), dn = floeRowDn(i), rowLat = (i + 0.5) * DL, j0 = Math.floor(ll.lon / dn);
				for (let b = -K; b <= K && nf < CAP; b++) {
					const j = floeWrapJ(j0 + b, m), cc = iceCover(rowLat, (j + 0.5) * dn, month), r = hash(i, j, 7);
					if (r() > cc * 1.05) continue;
					const p = toXZ((i + r()) * DL, (j + r()) * dn);
					if (Math.hypot(p.x - cx, p.z - cz) > Rm || !seaAt(p.x, p.z)) continue;
					const rad = (8 + r() * 14) * (0.7 + cc * 0.8), y = 0.05 + r() * 0.2;
					Q.setFromAxisAngle(UP, r() * Math.PI * 2); SC.set(rad * (0.8 + r() * 0.4), 0.8 + r() * 0.5, rad * (0.8 + r() * 0.4));
					M4.compose(V.set(p.x, y, p.z), Q, SC); floes.setMatrixAt(nf++, M4);
					list.push([p.x, p.z, rad * 0.8, y + 0.5 * SC.y]);
					// a pressure ridge where floes pushed together
					if (cc > 0.6 && r() < 0.08 && nr < RCAP - 30) {
						const ang = r() * Math.PI;
						for (let k = 0; k < 24; k++) { const t = (k / 24 - 0.5) * rad * 2.2; Q.setFromAxisAngle(V.set(r() - 0.5, 1, r() - 0.5).normalize(), r() * 3); SC.setScalar(0.8 + r() * 1.8); M4.compose(V.set(p.x + Math.cos(ang) * t + (r() - 0.5) * 1.5, y + 0.6 + r() * 0.8, p.z + Math.sin(ang) * t + (r() - 0.5) * 1.5), Q, SC); rubble.setMatrixAt(nr++, M4); }
					}
					}
			}
		}
		if (bc > 0.01) {
			// (on a lattice of their own of the latitude and longitude, as the floes)
			const S = 420, dl = S / 111000, K = isPhone ? 6 : 9, i0 = Math.floor(ll.lat / dl);
			for (let a = -K; a <= K; a++) for (let b = -K; b <= K; b++) {
				const i = i0 + a, dn = S / (111000 * Math.max(0.05, Math.cos((i + 0.5) * dl * Math.PI / 180))), j = Math.floor(ll.lon / dn) + b;
				const r = hash(i, j, 9);
				if (r() > bergChance((i + 0.5) * dl, (j + 0.5) * dn)) continue;
				const p = toXZ((i + r()) * dl, (j + r()) * dn);
				if (!seaAt(p.x, p.z) || height.at(p.x, p.z) > -8) continue;
				const k = Math.floor(r() * 3);
				if (nb[k] >= BCAP) continue;
				const w = 15 + Math.pow(r(), 2) * 90, h = w * (k === 0 ? 0.35 : k === 1 ? 0.55 : 0.75) * (0.7 + r() * 0.6);
				Q.setFromAxisAngle(UP, r() * Math.PI * 2); SC.set(w, h, w * (0.6 + r() * 0.5));
				M4.compose(V.set(p.x, 0, p.z), Q, SC); bergs[k].setMatrixAt(nb[k]++, M4);
				solid.push([p.x, p.z, w * 0.8, h]);
			}
		}
		floes.count = nf; rubble.count = nr;
		ICE_U.uIceNear.value.set(cx, cz, nf && nf < CAP ? (isPhone ? 650 : 950) - 45 : 0);
		bergs.forEach((m, k) => { m.count = nb[k]; m.instanceMatrix.needsUpdate = true; });
		floes.instanceMatrix.needsUpdate = true; rubble.instanceMatrix.needsUpdate = true;
	}

	function update(dt, cam, { month, night = 0, cover: cloud = 0.4, lat = 0, on = true, epoch = 0 } = {}) {
		const x = cam.position.x, z = cam.position.z;
		group.visible = on;
		// (the sea draws the pack past the floes: the frame's latitude and longitude for it)
		const o = toLL(0, 0), oz = toLL(0, 1000), ox = toLL(1000, 0), dLon = ((ox.lon - o.lon + 540) % 360) - 180;
		ICE_U.uIceOn.value = on ? 1 : 0; ICE_U.uIceMonth.value = month;
		if (!on) ICE_U.uIceNear.value.z = 0;
		ICE_U.uIceLL.value.set(o.lat, o.lon, 1000 / (o.lat - oz.lat), 1000 / dLon);
		if (on && (!at || Math.hypot(x - at[0], z - at[1]) > 180 || at[2] !== epoch || Math.abs(at[3] - month) > 0.25)) { at = [x, z, epoch, month]; layout(x, z, month); }
		// the aurora on clear dark nights in the oval (some nights brighter: the night's own number)
		const alat = Math.abs(lat), d = new Date();
		const nightly = hash(d.getFullYear(), d.getMonth() * 31 + d.getDate(), 5)();
		const k = on ? auroraStrength(lat, night, cloud, nightly) : 0;
		auroraU.uK.value += (k - auroraU.uK.value) * Math.min(1, dt * 0.5);
		auroraU.uTime.value += dt;
		aurora.visible = auroraU.uK.value > 0.01;
		if (aurora.visible) {
			aurora.position.copy(cam.position);
			// overhead in the oval; low toward the pole south of it (north in the south)
			const toward = lat > 0 ? 0 : Math.PI, low = smooth(66, 58, alat);
			aurora.rotation.set(0, toward, 0);
			aurora.position.z += (lat > 0 ? -1 : 1) * low * 4000;
			aurora.position.y += -low * 1400;
		}
	}
	// standing on a floe
	function floor(x, z) {
		if (!group.visible || !list.length) return -1e9;
		let best = -1e9;
		for (const [fx, fz, r, top] of list) if (Math.abs(fx - x) < r && Math.abs(fz - z) < r && Math.hypot(fx - x, fz - z) < r) best = Math.max(best, top);
		return best;
	}
	function push(p, footY) {
		if (!group.visible) return;
		for (const [bx, bz, r, h] of solid) { const dx = p.x - bx, dz = p.z - bz, d = Math.hypot(dx, dz); if (d < r && footY < h * 0.9 && d > 1e-3) { p.x = bx + dx / d * r; p.z = bz + dz / d * r; } }
	}
	function dispose() { scene.remove(group); scene.remove(aurora); iceMat.dispose(); auroraMat.dispose(); for (const m of [floes, rubble, ...bergs]) { m.geometry.dispose(); m.dispose(); } for (const m of aurora.children) m.geometry.dispose(); }
	return { update, floor, push, dispose, info: () => ({ cover: Math.round(cover * 100) / 100, floes: floes.count, bergs: bergs.reduce((a, m) => a + m.count, 0), ridges: rubble.count, aurora: Math.round(auroraU.uK.value * 100) / 100 }) };
}
