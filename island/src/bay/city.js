// The cities standing up out of their street grids, each built the way it really is:
// San Francisco's attached, pastel Victorians and Edwardians with their bay windows;
// the Sunset's rows of white stucco; the older towns (Oakland, Berkeley, Marin, the
// Peninsula) with detached wood houses under dark pitched roofs; the valley suburbs
// (San Ramon, Danville, Dublin...) with stucco houses under clay-tile hip roofs along
// curving streets; business parks of low office blocks in parking lots; and downtown
// towers in blue, green and bronze glass, white concrete and granite. Around you every
// lot is filled; the downtown towers are kept for tens of kilometres so the skylines
// rise on the horizon. At night the windows light up.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STYLE, BLOCKS, toGrid, fromGrid, ERA, eraFor, sfDistrict } from './styles.js';

const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const KIND = { row: 0, house: 1, tower: 2, office: 3, paved: 4, industry: 5, retail: 6, plain: 7 };

const PAL = {
	sf: [[0.96, 0.9, 0.74], [0.98, 0.86, 0.5], [0.72, 0.86, 0.72], [0.66, 0.8, 0.92], [0.95, 0.7, 0.6], [0.97, 0.96, 0.92], [0.74, 0.74, 0.72], [0.82, 0.72, 0.88], [0.6, 0.72, 0.56], [0.94, 0.8, 0.5], [0.5, 0.62, 0.76], [0.8, 0.5, 0.44], [0.97, 0.96, 0.92], [0.92, 0.9, 0.84], [0.45, 0.55, 0.5], [0.9, 0.62, 0.7]],
	sunset: [[0.95, 0.94, 0.9], [0.93, 0.9, 0.82], [0.88, 0.9, 0.86], [0.9, 0.86, 0.78], [0.82, 0.86, 0.9], [0.94, 0.88, 0.8], [0.86, 0.84, 0.8], [0.9, 0.8, 0.78]],
	older: [[0.93, 0.92, 0.88], [0.86, 0.82, 0.7], [0.62, 0.66, 0.55], [0.55, 0.62, 0.68], [0.5, 0.38, 0.28], [0.9, 0.82, 0.55], [0.66, 0.64, 0.6], [0.35, 0.42, 0.34], [0.6, 0.32, 0.26], [0.8, 0.74, 0.62]],
	olderRoof: [[0.3, 0.3, 0.31], [0.38, 0.34, 0.3], [0.25, 0.24, 0.25], [0.45, 0.4, 0.36]],
	suburb: [[0.91, 0.86, 0.77], [0.85, 0.78, 0.65], [0.94, 0.91, 0.85], [0.79, 0.76, 0.68], [0.8, 0.73, 0.6], [0.72, 0.7, 0.6], [0.89, 0.83, 0.72], [0.84, 0.76, 0.64], [0.94, 0.93, 0.88], [0.84, 0.71, 0.6], [0.7, 0.72, 0.7]],
	tile: [[0.62, 0.32, 0.22], [0.7, 0.4, 0.27], [0.55, 0.3, 0.24], [0.66, 0.46, 0.34], [0.42, 0.4, 0.38], [0.5, 0.46, 0.42], [0.35, 0.33, 0.32]],
	tower: [[0.45, 0.58, 0.7], [0.48, 0.62, 0.6], [0.55, 0.45, 0.35], [0.88, 0.86, 0.82], [0.78, 0.68, 0.62], [0.3, 0.32, 0.35], [0.8, 0.74, 0.62], [0.62, 0.7, 0.78]],
	office: [[0.86, 0.84, 0.8], [0.75, 0.72, 0.66], [0.62, 0.68, 0.72], [0.9, 0.88, 0.82], [0.7, 0.62, 0.52]],
	// suburban tracts by the decade they went up
	ranch: [[0.93, 0.92, 0.86], [0.86, 0.84, 0.66], [0.72, 0.8, 0.74], [0.7, 0.78, 0.84], [0.82, 0.74, 0.62], [0.64, 0.6, 0.52], [0.9, 0.86, 0.78], [0.76, 0.62, 0.52]],
	ranchRoof: [[0.3, 0.3, 0.31], [0.4, 0.37, 0.34], [0.5, 0.46, 0.42], [0.26, 0.25, 0.26]],
	seventies: [[0.55, 0.44, 0.32], [0.72, 0.64, 0.5], [0.5, 0.52, 0.4], [0.66, 0.5, 0.36], [0.82, 0.76, 0.64], [0.6, 0.56, 0.5]],
	shake: [[0.42, 0.38, 0.32], [0.36, 0.33, 0.3], [0.48, 0.43, 0.36]],
	eichler: [[0.35, 0.3, 0.26], [0.5, 0.55, 0.55], [0.3, 0.45, 0.48], [0.8, 0.64, 0.3], [0.9, 0.9, 0.86], [0.42, 0.42, 0.44]],
	flat: [[0.75, 0.74, 0.72], [0.55, 0.55, 0.55]],
	// San Francisco's districts
	chinatown: [[0.78, 0.2, 0.16], [0.2, 0.45, 0.3], [0.93, 0.86, 0.7], [0.85, 0.7, 0.3], [0.9, 0.9, 0.86], [0.6, 0.18, 0.14]],
	northbeach: [[0.93, 0.86, 0.68], [0.86, 0.66, 0.44], [0.8, 0.52, 0.38], [0.95, 0.92, 0.84], [0.78, 0.72, 0.6]],
	nobhill: [[0.9, 0.87, 0.8], [0.82, 0.76, 0.66], [0.7, 0.46, 0.36], [0.95, 0.93, 0.88], [0.62, 0.6, 0.58]],
	mission: [[0.93, 0.66, 0.36], [0.36, 0.62, 0.62], [0.84, 0.42, 0.52], [0.94, 0.84, 0.46], [0.46, 0.56, 0.78], [0.66, 0.78, 0.5], [0.95, 0.94, 0.9], [0.95, 0.94, 0.9], [0.9, 0.88, 0.82], [0.8, 0.46, 0.36]],
	pale: [[0.96, 0.95, 0.92], [0.88, 0.88, 0.86], [0.92, 0.89, 0.82], [0.8, 0.82, 0.84], [0.94, 0.92, 0.88]],
	industry: [[0.8, 0.8, 0.78], [0.7, 0.72, 0.74], [0.78, 0.74, 0.66], [0.62, 0.64, 0.66], [0.85, 0.83, 0.78], [0.66, 0.36, 0.3]],
	retail: [[0.86, 0.8, 0.7], [0.78, 0.72, 0.62], [0.9, 0.88, 0.84], [0.7, 0.66, 0.6], [0.6, 0.5, 0.42]],
	crown: [[0.2, 0.28, 0.12], [0.32, 0.4, 0.18], [0.18, 0.26, 0.14], [0.14, 0.22, 0.12], [0.38, 0.46, 0.22], [0.35, 0.22, 0.24], [0.26, 0.34, 0.16]],
};
const pick = (list, r) => list[Math.floor(r * 9973) % list.length];
const jit = (c, r) => [c[0] * (0.95 + r * 0.1), c[1] * (0.95 + ((r * 7.3) % 1) * 0.1), c[2] * (0.95 + ((r * 3.1) % 1) * 0.1)];

// facades by kind: SF bay windows and cornices, house windows, curtain wall, ribbon glazing
function buildingMaterial(shared, night) {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightC = night;
		sh.vertexShader = 'attribute float aKind; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vKind = aKind;
			vLY = transformed.y * length(instanceMatrix[1].xyz);
			vCW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
			vCS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));`);
		sh.fragmentShader = 'uniform float uNightC; varying float vKind; varying float vLY; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS;\nvec3 winGlow = vec3(0.0); float glassK = 0.0;\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float roof = step(0.7, vCN.y);
				vec2 t = normalize(vec2(-vCN.z, vCN.x) + 1e-5);
				float u = dot(vCW.xz, t), v = vCW.y;
				float win = 0.0; vec2 cell = vec2(0.0);
				vec3 glass = vec3(0.2, 0.24, 0.28);
				if (vKind < 0.5) {
					// San Francisco: tall sash windows in threes, white trim, a cornice at the top
					cell = vec2(u / 2.54, v / 3.3); vec2 f = fract(cell);
					win = step(0.3, f.x) * step(f.x, 0.7) * step(0.25, f.y) * step(f.y, 0.8);
					float trim = (1.0 - roof) * (1.0 - win) * (step(f.x, 0.3) * step(0.14, f.x) + step(0.7, f.x) * step(f.x, 0.86)) * step(0.15, f.y) * step(f.y, 0.87);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.95, 0.92), trim * 0.8);
					glass = vec3(0.24, 0.27, 0.3);
				} else if (vKind < 1.5) {
					// houses: a few windows a floor, a garage door low on one side
					cell = vec2(u / 4.2, v / 2.9); vec2 f = fract(cell);
					win = step(0.3, f.x) * step(f.x, 0.7) * step(0.3, f.y) * step(f.y, 0.78) * step(0.3, bh(floor(cell) + 1.3));
					glass = vec3(0.18, 0.2, 0.22);
				} else if (vKind < 2.5) {
					// towers: curtain wall with mullions and spandrels
					cell = vec2(u / 1.6, v / 3.9); vec2 f = fract(cell);
					win = step(0.07, f.x) * step(f.y, 0.78);
					glass = mix(diffuseColor.rgb * 0.55, vec3(0.5, 0.6, 0.7), 0.35) * (0.85 + 0.25 * bh(floor(cell / 3.0)));
					glassK = win;
				} else if (vKind > 3.5 && vKind < 4.5) {
					// parking: asphalt striped into bays
					float bay = step(0.93, fract(u / 2.7)) * step(0.3, fract(dot(vCW.xz, vec2(-t.y, t.x)) / 11.0));
					diffuseColor.rgb = mix(vec3(0.22, 0.22, 0.23), vec3(0.85), bay * roof);
				} else if (vKind > 4.5 && vKind < 5.5) {
					// warehouses: ribbed metal walls, a row of loading-dock doors
					diffuseColor.rgb *= 0.9 + 0.1 * step(0.5, fract(u / 0.6)) * (1.0 - roof) + 0.1 * roof;
					float dock = step(0.55, fract(u / 5.0)) * step(fract(u / 5.0), 0.95) * step(vLY, 5.4) * (1.0 - roof);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.22, 0.24), dock);
					float band = step(abs(vLY - vCS.y + 1.2), 0.5) * (1.0 - roof);
					diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7, band);
				} else if (vKind > 5.5 && vKind < 6.5) {
					// shops: a glass shopfront, a sign band above it
					float front = (1.0 - roof) * step(1.5, vLY) * step(vLY, 4.8) * step(0.08, fract(u / 4.0));
					float sign = (1.0 - roof) * step(5.4, vLY) * step(vLY, 6.8);
					float sh = bh(vec2(floor(u / 18.0), 7.0));
					vec3 scol = sh > 0.66 ? vec3(0.75, 0.16, 0.12) : sh > 0.33 ? vec3(0.12, 0.3, 0.6) : vec3(0.92, 0.9, 0.86);
					diffuseColor.rgb = mix(diffuseColor.rgb, scol, sign * 0.9);
					cell = vec2(u / 4.0, 0.0); win = front; glass = vec3(0.3, 0.38, 0.44); glassK = front * 0.6;
				} else if (vKind > 6.5) {
					// plain: fields, plazas, yards
					win = 0.0;
				} else {
					// offices: ribbon windows along each floor
					cell = vec2(u / 3.0, v / 4.1); vec2 f = fract(cell);
					win = step(0.35, f.y) * step(f.y, 0.85) * step(0.04, fract(u / 1.5));
					glass = vec3(0.28, 0.36, 0.42);
					glassK = win * 0.7;
				}
				win *= (1.0 - roof) * step(0.8, vLY);
				diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
				diffuseColor.rgb *= mix(1.0, 0.8, roof);
				float lit = step(vKind > 1.5 ? 0.62 : 0.66, bh(floor(cell) + floor(vCW.xz * 0.013)));
				winGlow = mix(vec3(1.0, 0.7, 0.4), vec3(1.0, 0.86, 0.66), step(1.5, vKind) * 0.6) * win * lit * uNightC * (0.6 + 0.4 * bh(floor(cell) + 3.3)) * 1.1;
			}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, glassK);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += winGlow;');
	};
	m.customProgramCacheKey = () => 'baybuilding2';
	return m;
}

// hip and gable roofs: a unit block with a ridge; scaled per house
function roofGeometry(hip) {
	const r = hip ? 0.28 : 0.0;
	const P = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5 + r, 1, 0, 0.5 - r, 1, 0];
	const I = [0, 4, 5, 0, 5, 1, 2, 5, 4, 2, 4, 3, 1, 5, 2, 3, 4, 0];
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setIndex(I);
	const n = g.toNonIndexed();
	n.computeVertexNormals();
	return n;
}

export function createCity(shared, scene, bay) {
	const group = new THREE.Group();
	group.name = 'bay-city';
	scene.add(group);
	const night = { value: 0 };
	const mat = buildingMaterial(shared, night);
	const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
	const CAP = 32000;
	const boxGeo = () => { const g = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)); return g; };
	const mk = (geo, material, cap, kinds) => {
		if (kinds) geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
		const im = new THREE.InstancedMesh(geo, material, cap);
		im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
		im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
		group.add(im);
		return im;
	};
	const near = mk(boxGeo(), mat, CAP, true);
	const hipG = roofGeometry(true), gableG = roofGeometry(false);
	const hips = mk(hipG, roofMat, CAP, false), gables = mk(gableG, roofMat, CAP, false);
	// trees: trunks, round crowns (oaks, sycamores, street trees), cones (pines, redwoods)
	const TCAP = 24000;
	const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 1, 5).translate(0, 0.5, 0);
	const crownGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.85 + 0.3 * Math.abs(Math.sin(p.getX(i) * 5.1 + p.getZ(i) * 3.7 + p.getY(i) * 2.3)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
	const coneGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
	const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
	const trunks = mk(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95 }), TCAP, false);
	trunks.instanceColor = null;
	const crowns = mk(crownGeo, leafMat, TCAP, false), cones = mk(coneGeo, leafMat, TCAP, false);

	// one lot's building (and roof) in grid space: centre (gx, gz), size along grid x/z
	function lot(list, a, style, gx, gz, w, d, h, kind, col, roof, flat) {
		const [x, z] = fromGrid(gx, gz, a, style);
		const g = bay.heightAt(x, z);
		if (g < 0.8) return;
		// the local heading of the (possibly warped) grid
		const [x2, z2] = fromGrid(gx + 5, gz, a, style);
		const ang = Math.atan2(z2 - z, x2 - x);
		list.push(flat ? { x, y: g - 0.9, z, w, d, h: 1.15, a: ang, col, kind, roof: null } : { x, y: g - 1.2, z, w, d, h: h + 1.2, a: ang, col, kind, roof });
	}

	function fillBlocks(cx, cz, R, list, minH = 0) {
		// the (angle, style) grids present round here
		const grids = new Map();
		for (let dz = -R; dz <= R; dz += R / 4) for (let dx = -R; dx <= R; dx += R / 4) {
			const u = bay.urbanAt(cx + dx, cz + dz);
			if (u.u > 0.05) grids.set(Math.round(u.a / (Math.PI / 2) * 255) + ':' + u.s, [Math.round(u.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2, u.s]);
		}
		for (const [a, style] of grids.values()) {
			const [BX, BZ, ST] = BLOCKS[style];
			const [gcx, gcz] = toGrid(cx, cz, a, style);
			const i0 = Math.floor((gcx - R) / BX), i1 = Math.floor((gcx + R) / BX), j0 = Math.floor((gcz - R) / BZ), j1 = Math.floor((gcz + R) / BZ);
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const [wx, wz] = fromGrid((i + 0.5) * BX, (j + 0.5) * BZ, a, style);
				if (Math.hypot(wx - cx, wz - cz) > R) continue;
				const U = bay.urbanAt(wx, wz);
				if (U.u < 0.15 || U.s !== style || Math.abs(U.a - a) > 0.01) continue;
				const parkBlock = hash(i * 3 + 7, j * 5 + 1) > 0.975 && U.d < 0.2;              // a park or a playground
				const ground = bay.heightAt(wx, wz);
				if (ground < 0.8) continue;
				const X0 = i * BX + ST + 2.5, Z0 = j * BZ + ST + 2.5, IX = BX - ST - 5, IZ = BZ - ST - 5;   // the block inside its pavements
				const r0 = hash(i * 17 + 3, j * 29 + 1);
				if (parkBlock) {
					if (minH > 0) continue;
					lot(list, a, style, X0 + IX / 2, Z0 + IZ / 2, IX * 0.96, IZ * 0.96, 0, KIND.plain, [0.28, 0.42, 0.18], null, 0.9);
					const T = list.trees || (list.trees = []);
					for (let k = 0; k < 10; k++) { const [x, z] = fromGrid(X0 + IX * hash(k, i), Z0 + IZ * hash(j, k), a, style), g = bay.heightAt(x, z); if (g > 0.8) T.push({ x, y: g - 0.3, z, h: 8 + hash(k, k) * 8, cone: hash(k, 3) > 0.8, col: [0.2, 0.3, 0.13] }); }
					continue;
				}
				if (U.d > 0.22) {
					// downtown: towers on bigger lots, some with a setback crown
					const L = 26;
					for (let k = 0; k * L < IX; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						let h = 12 + Math.pow(r, 2.4) * U.d * U.d * 300 + U.d * 40;
						if (h < minH) continue;
						const col = jit(pick(PAL.tower, hash(i * 7 + k, j * 3 + side)), r);
						const gx = X0 + k * L + L / 2, gz = side ? Z0 + IZ - L * 0.55 : Z0 + L * 0.55;
						lot(list, a, style, gx, gz, L * 0.9, L * 1.05, h, KIND.tower, col, null);
						if (h > 90 && r > 0.4) lot(list, a, style, gx, gz, L * 0.62, L * 0.7, h + 8 + r * 20, KIND.tower, col, null);
					}
					continue;
				}
				if (minH > 0) continue;
				const trees = list.trees || (list.trees = []);
				// a tree in grid space: height, round or conical, crown colour
				const tree = (gx, gz, h, cone, r) => { const [x, z] = fromGrid(gx, gz, a, style), g = bay.heightAt(x, z); if (g > 0.8) trees.push({ x, y: g - 0.3, z, h, cone, col: cone ? jit([0.13, 0.21, 0.11], r) : jit(pick(PAL.crown, r), r) }); };
				// paved ground: parking lots, yards, plazas
				const pave = (gx, gz, w, d, kind = KIND.paved, col = [0.25, 0.25, 0.26]) => lot(list, a, style, gx, gz, w, d, 0.25 - 1.2 + 1.35, kind, col, null, 0.9);
				const arterial = (style === STYLE.suburb || style === STYLE.older) && (((i % 7) + 7) % 7 === 0);
				const civic = hash(i * 11 + 5, j * 13 + 7);
				if ((style === STYLE.suburb || style === STYLE.older) && civic < 0.035) {
					// a school: low classroom wings, a field and a car park
					lot(list, a, style, X0 + IX * 0.3, Z0 + IZ * 0.3, IX * 0.45, 14, 4.5, KIND.office, [0.86, 0.8, 0.68], { hip: false, h: 1.5, col: [0.5, 0.47, 0.44] });
					lot(list, a, style, X0 + IX * 0.3, Z0 + IZ * 0.62, IX * 0.35, 12, 4.5, KIND.office, [0.86, 0.8, 0.68], { hip: false, h: 1.5, col: [0.5, 0.47, 0.44] });
					pave(X0 + IX * 0.76, Z0 + IZ * 0.5, IX * 0.4, IZ * 0.8, KIND.plain, [0.3, 0.44, 0.2]);
					continue;
				}
				if (arterial) {
					// a commercial strip on the arterial: shops at the back, parking in front, a pad or two
					const r = hash(i * 17 + 1, j * 19 + 3);
					pave(X0 + IX * 0.5, Z0 + IZ * 0.36, IX * 0.95, IZ * 0.62);
					lot(list, a, style, X0 + IX * 0.5, Z0 + IZ * 0.84, IX * (0.7 + r * 0.2), 22, 7.4 + r * 2, KIND.retail, jit(pick(PAL.retail, r), r), null);
					if (r > 0.4) lot(list, a, style, X0 + IX * 0.18, Z0 + IZ * 0.18, 18, 14, 6.5, KIND.retail, jit(pick(PAL.retail, r * 3.7), r), null);
					for (let k = 0; k < 5; k++) tree(X0 + IX * (0.1 + k * 0.2), Z0 + 3, 7, false, hash(i + k, j));
					continue;
				}
				if (style === STYLE.sf || style === STYLE.sunset) {
					const dist = style === STYLE.sunset ? 'sunset' : sfDistrict(wx, wz);
					const wide = dist === 'nobhill' || dist === 'pacheights';
					const L = wide ? 15.24 : 7.62, deep = style === STYLE.sf ? (wide ? 24 : 19) : 21;
					const pal = { chinatown: PAL.chinatown, northbeach: PAL.northbeach, nobhill: PAL.nobhill, mission: PAL.mission, pacheights: PAL.pale, marina: PAL.sf, victorian: PAL.sf, sunset: PAL.sunset }[dist] || PAL.sf;
					for (let k = 0; k * L < IX - 0.1; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						if (r < 0.03) continue;
						let h = { chinatown: 11 + r * 7, northbeach: 9 + r * 5, nobhill: 16 + Math.pow(r, 1.5) * 26, mission: 8.5 + Math.floor(r * 3) * 2.8, pacheights: 11 + r * 4, marina: 8 + r * 3, sunset: 7 + r * 1.5 }[dist] ?? 8.5 + Math.floor(r * 3) * 2.8 + (r > 0.93 ? 6 : 0);
						const col = jit(pick(pal, hash(i + k * 13, j * 7 + side)), r);
						let roof = null;
						if (dist === 'victorian' && r > 0.3) roof = { hip: false, rot: true, h: 3.4, col: [0.3, 0.3, 0.32] };                      // the gable faces the street
						else if (dist === 'marina' && r > 0.55) roof = { hip: true, h: 2, col: pick(PAL.tile, r) };
						else if (dist === 'pacheights' && r > 0.5) roof = { hip: true, h: 4, col: [0.3, 0.32, 0.35] };
						else if (dist === 'chinatown' && r > 0.78) roof = { hip: true, h: 2.6, col: r > 0.9 ? [0.18, 0.42, 0.3] : [0.62, 0.16, 0.12] };
						const gz = side ? Z0 + IZ - deep / 2 : Z0 + deep / 2;
						lot(list, a, style, X0 + k * L + L / 2, gz, L + 0.02, deep, h, KIND.row, col, roof);
						// bay windows stacked up the front
						if (style === STYLE.sf && r > 0.35 && dist !== 'nobhill' && dist !== 'chinatown') lot(list, a, style, X0 + k * L + L / 2, side ? Z0 + IZ + 0.5 : Z0 - 0.5, Math.min(3.6, L * 0.47), 1.4, h - 3.2, KIND.row, col.map((c) => Math.min(1, c * 1.05)), null);
						// a street tree now and then (more in the Sunset and the Mission)
						if (hash(k * 3 + side, i * 5 + j) < (dist === 'sunset' || dist === 'mission' ? 0.2 : 0.1)) tree(X0 + k * L + L / 2, side ? Z0 + IZ + 2.0 : Z0 - 2.0, 6 + r * 3, false, r);
					}
					// the short ends of the block are built up too, houses facing the cross streets
					for (let k = 0; deep + (k + 1) * L < IZ - deep + 0.1; k++) for (const side of [0, 1]) {
						const r = hash(i * 71 + k * 5 + side, j * 23 + k + 9);
						const h = { chinatown: 11 + r * 7, northbeach: 9 + r * 5, nobhill: 16 + Math.pow(r, 1.5) * 26, pacheights: 11 + r * 4, marina: 8 + r * 3, sunset: 7 + r * 1.5 }[dist] ?? 8.5 + Math.floor(r * 3) * 2.8;
						const col = jit(pick(pal, hash(i * 3 + k * 11, j * 5 + side)), r);
						lot(list, a, style, side ? X0 + IX - deep / 2 : X0 + deep / 2, Z0 + deep + k * L + L / 2, deep, L + 0.02, h, KIND.row, col, null);
					}
				} else if (style === STYLE.older) {
					const L = 12;
					for (let k = 0; k * L < IX - 2; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						if (r < 0.08) continue;
						const w = 8 + r * 2.5, d = 10 + ((r * 7.7) % 1) * 4, h = r > 0.55 ? 6.4 : 3.6;
						const col = jit(pick(PAL.older, hash(i + k * 13, j * 7 + side)), r);
						const rc = pick(PAL.olderRoof, hash(i * 3 + k, j + side * 5));
						const gz = side ? Z0 + IZ - 6 - d / 2 : Z0 + 6 + d / 2;
						lot(list, a, style, X0 + k * L + L / 2, gz, w, d, h, KIND.house, col, { hip: r > 0.8, rot: r < 0.3, h: Math.min(w, d) * 0.42, col: rc });
						// old neighbourhoods are leafy: street trees and big backyard trees
						if (k % 2 === 0) tree(X0 + k * L + L / 2, side ? Z0 + IZ + 1.9 : Z0 - 1.9, 9 + r * 6, false, r);
						if (r > 0.4) tree(X0 + k * L + L / 2 + 3, side ? Z0 + IZ - 30 : Z0 + 30, 10 + r * 8, r > 0.85, r * 1.7 % 1);
					}
				} else if (style === STYLE.suburb) {
					// the tract: one builder, one decade, one look
					const ti = Math.floor(((i * BX) + 1e6) / 520), tj = Math.floor(((j * BZ) + 1e6) / 400);
					const tr = hash(ti * 7 + 3, tj * 13 + 5), era = eraFor(wx, wz, tr);
					const wallsAll = [PAL.ranch, PAL.seventies, PAL.suburb, PAL.eichler][era], roofsAll = [PAL.ranchRoof, PAL.shake, PAL.tile, PAL.flat][era];
					const walls = [0, 1, 2, 3].map((n) => pick(wallsAll, hash(ti + n * 17, tj + n * 31)));
					const roofs = [0, 1].map((n) => pick(roofsAll, hash(ti * 3 + n, tj * 5 + n)));
					const L = era === ERA.modern ? 15.5 : era === ERA.eichler ? 19 : 20;
					const setback = era === ERA.modern ? 6 : 8;
					const treeK = [0.9, 0.7, 0.3, 0.9][era], treeH = [11, 9, 5, 10][era];
					for (let k = 0; k * L < IX - 4; k++) for (const side of [0, 1]) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k);
						if (r < 0.04) continue;
						const two = era === ERA.modern ? r > 0.12 : era === ERA.seventies ? r > 0.5 : era === ERA.ranch ? r > 0.9 : false;
						const w = era === ERA.modern ? 11 + r * 2.5 : 14 + r * 3.5, d = era === ERA.modern ? 13 + ((r * 5.3) % 1) * 3 : 10 + ((r * 5.3) % 1) * 3;
						const h = two ? 6.4 : 3.3;
						const col = jit(walls[Math.floor(r * 4)], r), rc = roofs[r > 0.8 ? 1 : 0];
						const roofH = era === ERA.eichler ? 0.9 : Math.min(w, d) * (era === ERA.modern ? 0.3 : era === ERA.ranch ? 0.2 : 0.26);
						const gz = side ? Z0 + IZ - setback - d / 2 : Z0 + setback + d / 2;
						const cx = X0 + k * L + L / 2 + (r - 0.5) * 1.5;
						lot(list, a, style, cx, gz, w, d, h, KIND.house, col, { hip: era === ERA.modern || (era === ERA.ranch && r > 0.4), h: roofH, col: rc });
						// the garage: two bays on older tracts, three on new ones, facing the street
						const gw = era === ERA.modern && r > 0.5 ? 9.5 : 6.4, gs = r > 0.5 ? 1 : -1;
						lot(list, a, style, cx + (w / 2 + gw / 2 - 1) * gs * 0.85, gz + (side ? 2 : -2), gw, 7, 3.1, KIND.house, col, { hip: era === ERA.modern, h: era === ERA.eichler ? 0.5 : 1.6, col: rc });
						// the driveway
						pave(cx + (w / 2 + gw / 2 - 1) * gs * 0.85, side ? Z0 + IZ - setback / 2 + 1 : Z0 + setback / 2 - 1, gw - 1, setback, KIND.plain, [0.62, 0.61, 0.58]);
						// yard trees: a front tree and one out back, bigger in older tracts
						if (hash(k + 1, side + i * 3) < treeK * 0.6) tree(cx - gs * (w * 0.35), side ? Z0 + IZ - 2.5 : Z0 + 2.5, treeH * (0.7 + r * 0.6), false, r * 3.1 % 1);
						if (hash(k + 5, side + j * 7) < treeK) tree(cx + (r - 0.5) * 6, side ? Z0 + IZ - setback - d - 8 : Z0 + setback + d + 8, treeH * (0.8 + r * 0.7), r > 0.82, r * 5.7 % 1);
					}
				} else if (style === STYLE.industry) {
					// warehouses and plants in concrete yards, trailers at the docks
					const n = r0 > 0.6 ? 2 : r0 > 0.25 ? 1 : 3;
					pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.96, IZ * 0.96, KIND.plain, [0.48, 0.47, 0.45]);
					for (let k = 0; k < n; k++) {
						const r = hash(i * 31 + k, j * 11 + k);
						const w = IX * (n === 1 ? 0.7 : n === 2 ? 0.42 : 0.28), d = IZ * (0.35 + r * 0.3), h = 8 + r * 6;
						const gx = X0 + IX * (n === 1 ? 0.5 : (k + 0.5) / n), gz = Z0 + IZ * 0.45;
						lot(list, a, style, gx, gz, w, d, h, KIND.industry, jit(pick(PAL.industry, r), r), null);
						for (let t = 0; t < 4; t++) if (hash(k * 5 + t, i + j) > 0.4) lot(list, a, style, gx - w * 0.4 + t * w * 0.25, gz + d / 2 + 9, 2.6, 13, 4, KIND.plain, [0.9, 0.9, 0.88], null);
					}
				} else if (style === STYLE.retail) {
					// a mall or big-box centre: the anchor at the back, parking all round
					const r = r0;
					pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.97, IZ * 0.97);
					lot(list, a, style, X0 + IX / 2, Z0 + IZ * 0.72, IX * (0.55 + r * 0.3), IZ * 0.36, 9 + r * 5, KIND.retail, jit(pick(PAL.retail, r), r), null);
					if (r > 0.3) lot(list, a, style, X0 + IX * 0.2, Z0 + IZ * 0.18, 26, 18, 7, KIND.retail, jit(pick(PAL.retail, r * 2.3), r), null);
					for (let k = 0; k < 6; k++) tree(X0 + IX * (0.1 + k * 0.16), Z0 + IZ * 0.45, 6, false, hash(k, i + j));
				} else {
					// business park and campus: office blocks in parking and lawns
					const n = r0 > 0.5 ? 2 : 1;
					pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.95, IZ * 0.95);
					for (let k = 0; k < n; k++) {
						const r = hash(i * 31 + k, j * 11 + k);
						const w = n === 2 ? IX * 0.36 : IX * 0.55, d = IZ * (0.45 + r * 0.15), h = 12 + Math.floor(r * 4) * 4.1;
						lot(list, a, style, X0 + IX * (n === 2 ? 0.27 + k * 0.46 : 0.5), Z0 + IZ * 0.5, w, d, h, KIND.office, jit(pick(PAL.office, r), r), null);
					}
					for (let k = 0; k < 8; k++) tree(X0 + IX * (0.06 + k * 0.125), Z0 + 4, 8, k % 3 === 0, hash(k, i * 3 + j));
				}
			}
		}
	}

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
	function upload(list, body, roofs) {
		let n = 0, nh = 0, ng = 0;
		const kinds = body.geometry.attributes.aKind;
		for (const o of list) {
			if (n >= body.instanceMatrix.count) break;
			q.setFromAxisAngle(Y, -o.a); sc.set(o.w, o.h, o.d); p.set(o.x, o.y, o.z);
			body.setMatrixAt(n, m4.compose(p, q, sc)); body.setColorAt(n, col.setRGB(o.col[0], o.col[1], o.col[2])); kinds.array[n] = o.kind; n++;
			if (o.roof && roofs) {
				const im = o.roof.hip ? roofs[0] : roofs[1], k = o.roof.hip ? nh++ : ng++;
				if (k >= im.instanceMatrix.count) continue;
				p.set(o.x, o.y + o.h, o.z);
				if (o.roof.rot) { q.setFromAxisAngle(Y, -o.a + Math.PI / 2); sc.set(o.d + 0.8, o.roof.h, o.w + 0.8); } else sc.set(o.w + 0.8, o.roof.h, o.d + 0.8);
				im.setMatrixAt(k, m4.compose(p, q, sc)); im.setColorAt(k, col.setRGB(o.roof.col[0], o.roof.col[1], o.roof.col[2]));
			}
		}
		body.count = n; kinds.needsUpdate = true;
		for (const im of [body, ...(roofs || [])]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
		if (roofs) { roofs[0].count = Math.min(nh, roofs[0].instanceMatrix.count); roofs[1].count = Math.min(ng, roofs[1].instanceMatrix.count); }
		if (roofs && list.trees) {
			// trees: a trunk and a round or conical crown each
			let nt = 0, nr = 0, nc = 0;
			for (const t of list.trees) {
				if (nt >= trunks.instanceMatrix.count) break;
				q.identity();
				trunks.setMatrixAt(nt++, m4.compose(p.set(t.x, t.y, t.z), q, sc.set(t.h * 0.05 + 0.15, t.h * 0.45, t.h * 0.05 + 0.15)));
				const im = t.cone ? cones : crowns, k = t.cone ? nc++ : nr++;
				if (t.cone) im.setMatrixAt(k, m4.compose(p.set(t.x, t.y + t.h * 0.2, t.z), q, sc.set(t.h * 0.28, t.h * 0.85, t.h * 0.28)));
				else im.setMatrixAt(k, m4.compose(p.set(t.x, t.y + t.h * 0.62, t.z), q, sc.set(t.h * 0.36, t.h * 0.3, t.h * 0.36)));
				im.setColorAt(k, col.setRGB(t.col[0], t.col[1], t.col[2]));
			}
			trunks.count = nt; crowns.count = nr; cones.count = nc;
			for (const im of [trunks, crowns, cones]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
		}
	}

	// the skylines, found once: every downtown's tall buildings, kept for far views
	const skyline = [];
	const skyMesh = mk(boxGeo(), mat, 6000, true);
	function findSkylines() {
		const seen = new Set();
		for (let z = -100000; z < 100000; z += 1000) for (let x = -20000; x < 120000; x += 1000) {
			const U = bay.urbanAt(x, z);
			if (U.d < 0.22) continue;
			const key = Math.floor(x / 3000) + ',' + Math.floor(z / 3000);
			if (seen.has(key)) continue;
			seen.add(key);
			fillBlocks(Math.floor(x / 3000) * 3000 + 1500, Math.floor(z / 3000) * 3000 + 1500, 2200, skyline, 38);
		}
		upload(skyline, skyMesh, null);
	}

	// ---------- landmarks ----------
	const white = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 });
	const glassM = new THREE.MeshStandardMaterial({ color: 0xb8c4cc, roughness: 0.25, metalness: 0.5 });
	const redwhite = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.6, metalness: 0.2 });
	const steelGrey = new THREE.MeshStandardMaterial({ color: 0x8e9498, roughness: 0.5, metalness: 0.4 });
	function landmarks() {
		const at = (lat, lon) => { const w = toWorld(lat, lon); return { ...w, g: Math.max(0, bay.heightAt(w.x, w.z)) }; };
		// Salesforce Tower: 326 m, a rounded square shaft tapering to a lattice crown
		{ const w = at(37.78975, -122.39687); const shaft = new THREE.CylinderGeometry(20, 27, 300, 4, 8).rotateY(Math.PI / 4).translate(0, 150, 0); const crown = new THREE.CylinderGeometry(15, 20, 26, 4, 1, true).rotateY(Math.PI / 4).translate(0, 313, 0);
			const m = new THREE.Mesh(mergeGeometries([shaft, crown]), glassM); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
		// Transamerica Pyramid: 260 m, a four-sided spire
		{ const w = at(37.79519, -122.40279); const g = new THREE.ConeGeometry(38, 260, 4, 1).rotateY(Math.PI / 4).translate(0, 130, 0);
			const m = new THREE.Mesh(g, white); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
		// Coit Tower: a 64 m fluted column on Telegraph Hill
		{ const w = at(37.80239, -122.40582); const g = new THREE.CylinderGeometry(5.5, 6, 64, 16).translate(0, 32, 0);
			const m = new THREE.Mesh(g, white); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
		// Sutro Tower: a 298 m three-legged mast on its hill, red and white
		{ const w = at(37.75523, -122.45278); const parts = [];
			for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const leg = new THREE.CylinderGeometry(1.2, 2.2, 230, 6); const pos = new THREE.Vector3(Math.cos(a) * 18, 115, Math.sin(a) * 18); leg.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.sin(a) * -0.07, 0, Math.cos(a) * 0.07))); leg.translate(pos.x * 0.6, pos.y, pos.z * 0.6); parts.push(leg); }
			for (const y of [120, 180]) parts.push(new THREE.CylinderGeometry(34, 34, 3, 3).translate(0, y, 0));
			parts.push(new THREE.CylinderGeometry(1.5, 2, 70, 6).translate(0, 263, 0));
			const m = new THREE.Mesh(mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g)), redwhite); m.position.set(w.x, w.g, w.z); m.castShadow = true; group.add(m); }
	}

	// ---------- the Bay Bridge ----------
	function bayBridge() {
		const parts = [], sas = [];
		const boxAt = (a, b, width, depth, list) => {
			const d = new THREE.Vector3().subVectors(b, a), L = d.length();
			const g = new THREE.BoxGeometry(width, depth, L);
			const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
			g.applyMatrix4(m); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
			list.push(g);
		};
		const P = (lat, lon, y) => { const w = toWorld(lat, lon); return new THREE.Vector3(w.x, y, w.z); };
		// the west span: two suspension bridges end to end, from Rincon Hill to Yerba Buena Island
		const A = P(37.78796, -122.39035, 58), Bm = P(37.79967, -122.37735, 62), C = P(37.8103, -122.3655, 58);
		const towers = [0.16, 0.36, 0.64, 0.84];
		for (const [s, e] of [[A, Bm], [Bm, C]]) boxAt(s, e, 20, 3, parts);
		// deck approach down onto Rincon Hill
		boxAt(P(37.78572, -122.39292, 30), A, 20, 3, parts);
		const dir = new THREE.Vector3().subVectors(C, A), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
		for (const t of towers) {
			const base = A.clone().lerp(C, t);
			for (const sd of [-1, 1]) { const f = base.clone().addScaledVector(side, sd * 11); boxAt(new THREE.Vector3(f.x, -5, f.z), new THREE.Vector3(f.x, 160, f.z), 6, 8, parts); }
			for (const y of [75, 115, 155]) boxAt(base.clone().addScaledVector(side, -11).setY(y), base.clone().addScaledVector(side, 11).setY(y), 4, 4, parts);
		}
		// the centre anchorage
		boxAt(new THREE.Vector3(Bm.x, -5, Bm.z), new THREE.Vector3(Bm.x, 75, Bm.z), 30, 40, parts);
		// cables: tower tops sagging to near the deck between each pair
		const cableSeg = (p0, p1, sag) => { const pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16; const v = p0.clone().lerp(p1, u); v.y -= sag * 4 * u * (1 - u); pts.push(v); } for (let k = 0; k < 16; k++) boxAt(pts[k], pts[k + 1], 0.9, 0.9, parts); };
		const knots = [0, ...towers, 1];
		for (const sd of [-1, 1]) for (let k = 0; k < knots.length - 1; k++) {
			const a0 = A.clone().lerp(C, knots[k]).addScaledVector(side, sd * 11), a1 = A.clone().lerp(C, knots[k + 1]).addScaledVector(side, sd * 11);
			a0.y = knots[k] === 0 || knots[k] === 1 || Math.abs(knots[k] - 0.5) < 0.2 && false ? 62 : 158; a1.y = knots[k + 1] === 0 || knots[k + 1] === 1 ? 62 : 158;
			if ((knots[k] === 0.36 && knots[k + 1] === 0.64)) { const mid = A.clone().lerp(C, 0.5).addScaledVector(side, sd * 11).setY(70); cableSeg(a0, mid, 6); cableSeg(mid, a1, 6); continue; }
			cableSeg(a0, a1, knots[k] === 0 || knots[k + 1] === 1 ? 20 : 88);
		}
		// the east span: the white self-anchored tower off Yerba Buena, then the skyway to Oakland
		const D = P(37.8140, -122.3585, 50), E = P(37.8176, -122.3490, 45), F = P(37.8252, -122.3170, 22), G = P(37.8262, -122.2985, 8);
		for (const [s, e] of [[C, D], [D, E], [E, F], [F, G]]) { const l = s.clone(), r = e.clone(); for (const sd of [-1, 1]) boxAt(l.clone().addScaledVector(side, sd * 12), r.clone().addScaledVector(side, sd * 12), 22, 3, parts); }
		const T = D.clone().lerp(E, 0.35);
		boxAt(new THREE.Vector3(T.x, 0, T.z), new THREE.Vector3(T.x, 160, T.z), 8, 8, sas);
		for (let k = 0; k <= 10; k++) { const u = k / 10; const q2 = D.clone().lerp(E, u); boxAt(new THREE.Vector3(T.x, 150, T.z), q2.clone().setY(q2.y + 2), 0.6, 0.6, sas); }
		// skyway piers
		for (let k = 0; k <= 14; k++) { const q2 = E.clone().lerp(F, k / 14); boxAt(new THREE.Vector3(q2.x, -5, q2.z), q2.clone(), 7, 4, parts); }
		const m1 = new THREE.Mesh(mergeGeometries(parts), steelGrey), m2 = new THREE.Mesh(mergeGeometries(sas), white);
		for (const m of [m1, m2]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
	}

	let lastX = 1e9, lastZ = 1e9, started = false;
	function update(cam, nightK) {
		if (!bay.loaded()) return;
		night.value = nightK;
		if (!started) { started = true; findSkylines(); landmarks(); bayBridge(); }
		const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y > 4000;
		near.visible = hips.visible = gables.visible = trunks.visible = crowns.visible = cones.visible = !high;
		if (Math.hypot(x - lastX, z - lastZ) < 300) return;
		lastX = x; lastZ = z;
		const list = [];
		fillBlocks(x, z, 1200, list);
		// if there is more than fits, keep the nearest
		const d2 = (o) => (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z);
		if (list.length > CAP) { const t = list.trees; list.sort((m, n) => d2(m) - d2(n)); list.length = CAP; list.trees = t; }
		if (list.trees && list.trees.length > TCAP) list.trees.sort((m, n) => d2(m) - d2(n));
		upload(list, near, [hips, gables]);
	}
	return { update, group, fill: fillBlocks };
}
