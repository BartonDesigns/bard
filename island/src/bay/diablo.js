// Mt Diablo's landmarks, at their real places:
//   Rock City: honey-coloured sandstone domes by South Gate Road, weathered into
//     wind caves you can walk into, honeycombed with tafoni, ledged by old bedding
//   Castle Rock: the sandstone crags over Pine Canyon
//   the summit: the stone visitor centre on the peak with its tower and the beacon
// Each rock is carved from a signed-distance field (blobs, bedding ledges, caves hollowed
// out of it) with marching cubes, built when you come near. The same field makes the
// rock solid: you are pushed off its walls and can step up on its ledges, and the
// caves are open to walk in.

import * as THREE from 'three';
import { photoUniform, TRI_GLSL } from '../world/photomats.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { toWorld } from './geo.js';

// ---------- noise ----------
const hh = (i, j, k) => { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vn3(x, y, z) {
	const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k;
	const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), sw = w * w * (3 - 2 * w);
	const l = (a, b, t) => a + (b - a) * t;
	return l(l(l(hh(i, j, k), hh(i + 1, j, k), su), l(hh(i, j + 1, k), hh(i + 1, j + 1, k), su), sv), l(l(hh(i, j, k + 1), hh(i + 1, j, k + 1), su), l(hh(i, j + 1, k + 1), hh(i + 1, j + 1, k + 1), su), sv), sw);
}
const fbm = (x, y, z) => vn3(x, y, z) * 0.6 + vn3(x * 2.03 + 5.1, y * 2.03, z * 2.03 - 3.3) * 0.28 + vn3(x * 4.1 - 7, y * 4.1 + 2, z * 4.1) * 0.12;
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const ell = (x, y, z, rx, ry, rz) => { const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 > 1e-6 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); };

// ---------- the landmarks ----------
// size: half the formation's extent; blobs: how many masses; caves: hollows; tall: spires
const ROCKS = [
	// Rock City, by South Gate Road
	{ lat: 37.8455, lon: -121.9387, size: 14, blobs: 4, caves: 2, seed: 11 },
	{ lat: 37.8449, lon: -121.9378, size: 11, blobs: 3, caves: 1, seed: 12 },
	{ lat: 37.8461, lon: -121.9373, size: 9, blobs: 3, caves: 1, seed: 13 },
	{ lat: 37.8443, lon: -121.9393, size: 8, blobs: 2, caves: 0, seed: 14 },
	{ lat: 37.8466, lon: -121.9397, size: 12, blobs: 2, caves: 0, seed: 15, tall: 1.8 },     // Sentinel Rock
	{ lat: 37.8452, lon: -121.9403, size: 7, blobs: 2, caves: 1, seed: 16 },
	{ lat: 37.8438, lon: -121.9372, size: 9, blobs: 3, caves: 1, seed: 17 },
	// Castle Rock, over Pine Canyon
	{ lat: 37.8942, lon: -121.9918, size: 22, blobs: 4, caves: 1, seed: 21, tall: 1.6 },
	{ lat: 37.8930, lon: -121.9904, size: 18, blobs: 3, caves: 0, seed: 22, tall: 1.9 },
	{ lat: 37.8951, lon: -121.9899, size: 15, blobs: 3, caves: 1, seed: 23, tall: 1.4 },
];
const SUMMIT = { lat: 37.88175, lon: -121.91415 };

// ground(x, z): the land's height in the rock's own frame, so the masses sit on it and the
// caves open at its level on the downhill side
function sdfOf(spec, ground = () => 0) {
	const r = mulberry(spec.seed), S = spec.size, T = (spec.tall || 1) * 1.35;
	const blobs = [];
	for (let k = 0; k < spec.blobs; k++) {
		const a = r() * Math.PI * 2, d = k ? S * (0.25 + r() * 0.3) : 0;
		const rx = S * (0.35 + r() * 0.25) * (k ? 0.85 : 1), rz = S * (0.3 + r() * 0.25), ry = S * (0.3 + r() * 0.2) * T;
		const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
		blobs.push([bx, ground(bx, bz) + ry * (0.6 + r() * 0.25), bz, rx, ry, rz]);
	}
	const caves = [];
	for (let k = 0; k < spec.caves; k++) {
		const b = blobs[k % blobs.length];
		// the mouth faces downhill
		const gx = ground(b[0] + 3, b[2]) - ground(b[0] - 3, b[2]), gz = ground(b[0], b[2] + 3) - ground(b[0], b[2] - 3);
		const a = Math.hypot(gx, gz) > 0.3 ? Math.atan2(-gz, -gx) + (r() - 0.5) * 0.6 : r() * Math.PI * 2;
		const cr = Math.min(b[3], b[5]) * (0.45 + r() * 0.15), ry = 1.9 + r() * 0.6;
		const cx = b[0] + Math.cos(a) * cr * 0.8, cz = b[2] + Math.sin(a) * cr * 0.8;
		// a sandstone floor just above the ground, the hollow rising from it
		const floorY = Math.max(ground(cx, cz), ground(b[0], b[2]) - 1) + 0.25;
		caves.push([cx, floorY + ry * 0.75, cz, cr, ry, cr * 0.85]);
		// a window high in the wall, as the wind carves them
		caves.push([b[0] - Math.cos(a) * cr * 0.4, floorY + 3 + r() * 1.5, b[2] - Math.sin(a) * cr * 0.4, cr * 0.4, 1.1, cr * 1.6]);
	}
	const f = (x, y, z) => {
		let d = 1e9;
		for (const b of blobs) d = smin(d, ell(x - b[0], y - b[1], z - b[2], b[3], b[4], b[5]), 3);
		// weathering: lumps, then ledges along the old bedding planes
		d += (fbm(x * 0.09, y * 0.09, z * 0.09) - 0.5) * S * 0.28 + (fbm(x * 0.3, y * 0.3, z * 0.3) - 0.5) * 0.45;
		d += Math.sin(y * 1.25 + fbm(x * 0.06, y * 0.2, z * 0.06) * 5) * 0.22;
		for (const c of caves) d = smax(d, -ell(x - c[0], y - c[1], z - c[2], c[3], c[4], c[5]), 0.9);
		// tafoni: shallow hollows eaten into the lower walls
		d += Math.max(0, fbm(x * 0.35 + 3, y * 0.35, z * 0.35) - 0.6) * 2.4 * (y < S * T * 0.8 ? 1 : 0.3);
		return Math.max(d, -(y - ground(x, z) + S * 0.4));                                 // closed well under the ground
	};
	return { f, S, T, caves };
}

function rockMaterial() {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
	// the photographed sandstone (build 191) laid over the painted bedding, at hand's reach
	const [uStone, uStoneK] = photoUniform('sandstone', { mean: 0.9, contrast: 0.9 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uStone = uStone; sh.uniforms.uStoneK = uStoneK;
		sh.vertexShader = 'varying vec3 vRW; varying vec3 vRN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);');
		sh.fragmentShader = 'varying vec3 vRW; varying vec3 vRN; uniform sampler2D uStone; uniform float uStoneK;\n' + TRI_GLSL + `
float rh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float rn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(rh(i), rh(i + vec3(1,0,0)), f.x), mix(rh(i + vec3(0,1,0)), rh(i + vec3(1,1,0)), f.x), f.y), mix(mix(rh(i + vec3(0,0,1)), rh(i + vec3(1,0,1)), f.x), mix(rh(i + vec3(0,1,1)), rh(i + vec3(1,1,1)), f.x), f.y), f.z); }
// honeycomb: distance to the nearest and second-nearest cell centres, on a plane
float rh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cell2(vec2 p){ vec2 i = floor(p); float d1 = 9.0, d2 = 9.0;
	for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) { vec2 g = i + vec2(a, b); vec2 o = g + vec2(rh2(g), rh2(g + 7.1)) * 0.8; float d = length(p - o); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
	return vec2(d1, d2); }
float rockH = 0.0;
` + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 n = normalize(vRN);
				float up = n.y;
				// the sandstone: warm ochre and cream in bands along the bedding, iron-stained
				float band = rn(vec3(vRW.x * 0.05, vRW.y * 0.9, vRW.z * 0.05)), big = rn(vRW * 0.08), fine = rn(vRW * 2.3);
				vec3 c = mix(vec3(0.72, 0.47, 0.18), vec3(0.86, 0.64, 0.3), band);
				c = mix(c, vec3(0.66, 0.38, 0.2), smoothstep(0.55, 0.85, big) * 0.6);
				// honeycomb tafoni on the walls: pits with pale sharp rims
				float wall = 1.0 - smoothstep(0.35, 0.75, abs(up));
				// on the plane the face mostly looks along; only close by, where it can be seen
				vec2 fp = abs(n.x) > abs(n.z) ? vRW.zy : vRW.xy;
				float nearK = 1.0 - smoothstep(50.0, 80.0, length(cameraPosition - vRW));
				vec2 v = nearK > 0.0 ? cell2(fp * (1.1 + 1.2 * rn(vRW * 0.1))) : vec2(0.0, 1.0);
				wall *= nearK;
				float pit = smoothstep(0.04, 0.3, v.y - v.x) * wall;
				float patchT = smoothstep(0.5, 0.72, rn(vRW * 0.18));
				c *= mix(1.0, 0.5 + 0.5 * smoothstep(0.0, 0.5, v.x), pit * patchT);
				rockH = (v.y - v.x) * wall * 0.25 * patchT;
				// lichen on the tops: grey-green and a little orange; dark streaks down the faces
				float lich = smoothstep(0.55, 0.75, rn(vRW * 0.9)) * smoothstep(0.4, 0.9, up);
				c = mix(c, mix(vec3(0.55, 0.58, 0.48), vec3(0.8, 0.55, 0.2), step(0.85, rn(vRW * 3.0))), lich * 0.7);
				c *= 1.0 - smoothstep(0.6, 0.9, rn(vec3(vRW.x * 0.6, vRW.y * 0.08, vRW.z * 0.6))) * wall * 0.35;
				// soot and shade deep in the hollows (faces looking down)
				c *= mix(1.0, 0.7, smoothstep(0.0, -0.8, up));
				// the grain, layering and weathering of real sandstone, strongest close by
				float pk = uStoneK * (1.0 - smoothstep(60.0, 160.0, length(cameraPosition - vRW)));
				// (two scales: its bedding a few metres across, its grain up close)
				float phL = dot(triPhoto(uStone, vRW, n, 0.13), vec3(0.3, 0.59, 0.11)) * 0.65 + dot(triPhoto(uStone, vRW + 3.7, n, 0.6), vec3(0.3, 0.59, 0.11)) * 0.35;
				float pkF = pk * (1.0 - smoothstep(8.0, 30.0, length(cameraPosition - vRW)) * 0.5);
				c = mix(c, c * mix(1.0, phL / 0.79, 0.6), pkF);
				rockH += (phL - 0.79) * 0.035 * pkF;
				diffuseColor.rgb = c * (0.9 + 0.2 * fine);
			}`)
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
			{
				vec3 sp = -vViewPosition, vSx = dFdx(sp), vSy = dFdy(sp);
				vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
				float fDet = dot(vSx, R1);
				vec2 dH = vec2(dFdx(rockH), dFdy(rockH));
				normal = normalize(abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2));
			}`);
	};
	m.customProgramCacheKey = () => 'sandstone4';
	return m;
}

export function createDiablo(scene, bay) {
	const group = new THREE.Group();
	group.name = 'mt-diablo';
	scene.add(group);
	const rockMat = rockMaterial();
	const rocks = ROCKS.map((spec) => { const w = toWorld(spec.lat, spec.lon); return { spec, x: w.x, z: w.z, built: false, mesh: null, sdf: null, y: 0, yaw: hh(spec.seed, 3, 5) * 6.28 }; });

	// carving a rock is spread over frames: a few slices of its field each frame, then the
	// surface, so walking up to Rock City never stalls
	let job = null;
	function start(R) {
		// between its middle and its lowest edge, so it stands clear of the slope's downhill side
		const s0 = R.spec.size;
		let gmin = bay.heightAt(R.x, R.z);
		const g0 = gmin;
		for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) gmin = Math.min(gmin, bay.heightAt(R.x + a * s0 * 0.6, R.z + b * s0 * 0.6));
		R.y = (g0 + gmin) / 2 - 0.6;
		const c = Math.cos(R.yaw), sn = Math.sin(R.yaw);
		const ground = (lx, lz) => bay.heightAt(R.x + lx * c + lz * sn, R.z - lx * sn + lz * c) - R.y;
		const sdf = sdfOf(R.spec, ground), S = sdf.S * Math.max(1, sdf.T) * 1.1, N = Math.min(80, Math.round(S * 2 * 2.2));
		job = { R, sdf, S, N, k: 0, field: new Float32Array(N * N * N), half: N / 2, yc: S * 0.75 - sdf.S * 0.5 };
	}
	function step() {
		const J = job, { sdf, S, N, half, yc } = J, t0 = performance.now();
		while (J.k < N && performance.now() - t0 < 6) {
			const k = J.k++;
			for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) J.field[k * N * N + j * N + i] = -sdf.f((i - half) / half * S, (j - half) / half * S + yc, (k - half) / half * S);
		}
		if (J.k >= N) { job = null; build(J); }
	}
	function build(J) {
		const { R, sdf, S, N, yc } = J;
		const mc = new MarchingCubes(N, rockMat, false, false, 120000);
		mc.isolation = 0;
		mc.field.set(J.field);
		mc.update();
		const n = mc.count, P = mc.geometry.attributes.position.array.slice(0, n * 3), Nr = mc.geometry.attributes.normal.array.slice(0, n * 3);
		for (let i = 0; i < n; i++) { P[i * 3] *= S; P[i * 3 + 1] = P[i * 3 + 1] * S + yc; P[i * 3 + 2] *= S; }
		mc.geometry.dispose();
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(P, 3));
		g.setAttribute('normal', new THREE.BufferAttribute(Nr, 3));
		g.computeBoundingSphere();
		const mesh = new THREE.Mesh(g, rockMat);
		mesh.castShadow = mesh.receiveShadow = true;
		// sit on the lowest ground under it, so no edge floats
		mesh.position.set(R.x, R.y, R.z); mesh.rotation.y = R.yaw;
		group.add(mesh);
		R.mesh = mesh; R.sdf = sdf;
	}

	// ---------- the summit: the stone visitor centre, its tower and the beacon ----------
	const sw = toWorld(SUMMIT.lat, SUMMIT.lon);
	const summit = new THREE.Group();
	summit.name = 'diablo-summit';
	group.add(summit);
	const stone = new THREE.MeshStandardMaterial({ color: 0x9c8466, roughness: 0.95 });
	const [uBlock, uBlockK] = photoUniform('sandstone', { mean: 0.9, contrast: 1.1 });
	stone.onBeforeCompile = (sh) => {
		sh.uniforms.uBlock = uBlock; sh.uniforms.uBlockK = uBlockK;
		sh.vertexShader = 'varying vec3 vSW; varying vec3 vSN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSN = normalize(mat3(modelMatrix) * objectNormal);');
		sh.fragmentShader = 'varying vec3 vSW; varying vec3 vSN; uniform sampler2D uBlock; uniform float uBlockK;\n' + TRI_GLSL + 'float sh1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				// coursed sandstone blocks with dark mortar
				vec2 q = vec2(vSW.x + vSW.z, vSW.y) / vec2(0.9, 0.42);
				q.x += step(1.0, mod(floor(q.y), 2.0)) * 0.5;
				vec2 f = fract(q), id = floor(q);
				float mortar = step(f.x, 0.05) + step(f.y, 0.08);
				diffuseColor.rgb *= (0.8 + 0.4 * sh1(id)) * mix(1.0, 0.45, clamp(mortar, 0.0, 1.0));
				// each block cut from real sandstone
				diffuseColor.rgb *= mix(1.0, dot(triPhoto(uBlock, vSW + vec3(id.x * 0.37, 0.0, id.y * 0.61), vSN, 0.9), vec3(0.3, 0.59, 0.11)) / 0.79, uBlockK);
			}`);
	};
	stone.customProgramCacheKey = () => 'summitstone2';
	const glassM = new THREE.MeshStandardMaterial({ color: 0x1c252c, roughness: 0.1, metalness: 0.3 });
	const box = (w, h, d, x, y, z, m = stone) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); b.castShadow = b.receiveShadow = true; summit.add(b); return b; };
	box(16, 6.5, 11, 0, -1.5, 0);
	box(16.6, 0.6, 11.6, 0, 5, 0);                                                            // the parapet course
	for (let k = -3; k <= 3; k++) box(1.2, 1.6, 0.1, k * 2.1, 1.6, 5.52, glassM);            // windows
	box(5.5, 11, 5.5, -4.5, -1.5, -1.5);                                                      // the tower
	box(4.2, 2.4, 4.2, -4.5, 9.5, -1.5, glassM);                                             // the observation lantern
	box(5, 0.4, 5, -4.5, 11.9, -1.5);
	const beaconPos = new THREE.Vector3(-4.5, 13.2, -1.5);
	const glow = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,230,190,0.6)'); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
	const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe2b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
	beacon.position.copy(beaconPos); beacon.scale.setScalar(30);
	summit.add(beacon);
	let summitPlaced = false;

	function update(dt, t, cam, nightK) {
		if (!bay.loaded()) return;
		const x = cam.position.x, z = cam.position.z;
		// build the rocks you come near, one a frame
		if (job) step();
		else for (const R of rocks) if (!R.built && Math.hypot(R.x - x, R.z - z) < 3500) { R.built = true; start(R); break; }
		for (const R of rocks) if (R.mesh) R.mesh.visible = Math.hypot(R.x - x, R.z - z) < 9000;
		if (!summitPlaced) {
			// the building sits just below the summit rocks, the tower on the top
			const gy = Math.min(bay.heightAt(sw.x, sw.z), bay.heightAt(sw.x + 6, sw.z + 4), bay.heightAt(sw.x - 6, sw.z - 4));
			summit.position.set(sw.x, gy, sw.z); summit.rotation.y = 0.35;
			summitPlaced = true;
		}
		// the beacon turns: a flash each time its beam sweeps past you
		const bw = beaconPos.clone().applyMatrix4(summit.matrixWorld), a = t * 1.9;
		const to = new THREE.Vector2(cam.position.x - bw.x, cam.position.z - bw.z).normalize();
		const flash = Math.pow(Math.max(0, Math.cos(a) * to.x + Math.sin(a) * to.y), 24);
		beacon.material.opacity = nightK * (0.25 + 0.9 * flash);
		beacon.scale.setScalar(20 + 60 * flash);
	}

	// ---------- the rock is solid ----------
	const local = (R, x, y, z) => { const c = Math.cos(-R.yaw), s = Math.sin(-R.yaw), dx = x - R.x, dz = z - R.z; return [dx * c - dz * s, y - R.y, dx * s + dz * c]; };
	// push a body (feet at footY) off the rock walls
	function push(p, footY) {
		for (const R of rocks) {
			if (!R.sdf || Math.abs(p.x - R.x) > R.sdf.S * 2 || Math.abs(p.z - R.z) > R.sdf.S * 2) continue;
			const [lx, ly, lz] = local(R, p.x, footY + 0.6, p.z), f = R.sdf.f;
			const d = f(lx, ly, lz);
			if (d > 0.4) continue;
			const e = 0.15, gx = f(lx + e, ly, lz) - f(lx - e, ly, lz), gz = f(lx, ly, lz + e) - f(lx, ly, lz - e), gl = Math.hypot(gx, gz) || 1;
			const m = 0.4 - d, c = Math.cos(R.yaw), s = Math.sin(R.yaw), wx = gx / gl * m, wz = gz / gl * m;
			p.x += wx * c - wz * s; p.z += wx * s + wz * c;
		}
	}
	// a ledge to step up on (never a whole cliff at once)
	function floor(x, z, footY) {
		let best = -1e9;
		for (const R of rocks) {
			if (!R.sdf || Math.abs(x - R.x) > R.sdf.S * 2 || Math.abs(z - R.z) > R.sdf.S * 2) continue;
			for (let y = footY + 0.55; y > footY - 1.5; y -= 0.12) {
				const [lx, ly, lz] = local(R, x, y, z);
				if (R.sdf.f(lx, ly, lz) < 0) { best = Math.max(best, y); break; }
			}
		}
		return best;
	}
	return { update, push, floor, group, rocks };
}
