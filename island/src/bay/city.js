// The cities standing up out of their street grids. Around you, every block fills
// with buildings on the same grid the ground is painted with: low houses and flats in
// the neighbourhoods, taller as the downtowns come near. The downtowns' towers are kept
// for tens of kilometres so the skylines of San Francisco, Oakland and San Jose rise
// on the horizon. San Francisco's landmarks are modelled at their real heights: the
// Salesforce Tower, the Transamerica Pyramid, Coit Tower on Telegraph Hill and Sutro
// Tower on its hill; and the Bay Bridge runs from Rincon Hill across Yerba Buena Island
// to Oakland. At night the windows light up.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const hash = (x, z) => { let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(z) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function buildingMaterial(shared, night) {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightC = night;
		sh.vertexShader = 'varying vec3 vCW; varying vec3 vCN; varying vec3 vCS;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
			vCW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
			vCS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));`);
		sh.fragmentShader = 'uniform float uNightC; varying vec3 vCW; varying vec3 vCN; varying vec3 vCS;\nvec3 winGlow = vec3(0.0);\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				// facades: floors of windows; roofs plain
				float roof = step(0.7, vCN.y);
				vec2 t = normalize(vec2(-vCN.z, vCN.x) + 1e-5);
				float u = dot(vCW.xz, t), v = vCW.y;
				vec2 cell = vec2(u / 3.2, v / 3.4);
				vec2 f = fract(cell);
				float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8) * (1.0 - roof);
				float tall = smoothstep(25.0, 60.0, vCS.y);
				vec3 glass = mix(vec3(0.22, 0.27, 0.32), vec3(0.42, 0.5, 0.58), tall) * (0.8 + 0.3 * bh(floor(cell)));
				diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * (0.55 + 0.35 * tall));
				diffuseColor.rgb *= mix(1.0, 0.82, roof);
				float lit = step(0.55, bh(floor(cell) + floor(vCW.xz * 0.013)));
				winGlow = vec3(1.0, 0.78, 0.5) * win * lit * uNightC * 1.6;
			}`)
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += winGlow;');
	};
	m.customProgramCacheKey = () => 'baybuilding';
	return m;
}

export function createCity(shared, scene, bay) {
	const group = new THREE.Group();
	group.name = 'bay-city';
	scene.add(group);
	const night = { value: 0 };
	const mat = buildingMaterial(shared, night);
	const CAP = 14000;
	const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
	const near = new THREE.InstancedMesh(box, mat, CAP);
	near.count = 0; near.frustumCulled = false; near.castShadow = true; near.receiveShadow = true;
	const PALETTE = [[0.86, 0.84, 0.8], [0.93, 0.9, 0.84], [0.8, 0.76, 0.7], [0.72, 0.7, 0.68], [0.9, 0.82, 0.72], [0.7, 0.74, 0.78], [0.85, 0.78, 0.66], [0.62, 0.6, 0.58]];
	near.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
	group.add(near);

	// the blocks of one town's grid near a point: buildings on its lots
	const B = [110, 135], ST = 14;
	function fillBlocks(cx, cz, R, list, minH = 0) {
		// the grid angles present round here
		const angles = new Set();
		for (let dz = -R; dz <= R; dz += R / 3) for (let dx = -R; dx <= R; dx += R / 3) { const u = bay.urbanAt(cx + dx, cz + dz); if (u.u > 0.05) angles.add(Math.round(u.a / (Math.PI / 2) * 255)); }
		for (const aq of angles) {
			const a = aq / 255 * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
			// grid space g = R(a) * world (the ground shader's mat2 is column-major)
			const gx0 = c * cx + s * cz, gz0 = -s * cx + c * cz;
			const i0 = Math.floor((gx0 - R) / B[0]), i1 = Math.floor((gx0 + R) / B[0]), j0 = Math.floor((gz0 - R) / B[1]), j1 = Math.floor((gz0 + R) / B[1]);
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const bgx = (i + 0.5) * B[0], bgz = (j + 0.5) * B[1];
				const wx = c * bgx - s * bgz, wz = s * bgx + c * bgz;
				if (Math.hypot(wx - cx, wz - cz) > R) continue;
				const U = bay.urbanAt(wx, wz);
				if (U.u < 0.3 || Math.abs(U.a - a) > 0.01) continue;
				if (hash(i * 3 + 7, j * 5 + 1) > 0.92 && U.d < 0.2) continue;                 // a park or a school yard
				const ground = bay.heightAt(wx, wz);
				if (ground < 0.8) continue;
				// lots round the block's edge, fronting the streets
				const inner = [B[0] - ST, B[1] - ST], lot = U.d > 0.3 ? 28 : 14;
				for (let q = 0; q < 2; q++) for (let k = 0; k * lot < inner[q]; k++) for (const side of [0, 1]) {
					const r = hash(i * 131 + k * 7 + q * 3 + side, j * 17 + k);
					if (r < 0.1) continue;
					const along = ST + k * lot + lot / 2, across = side ? B[1 - q] - (lot * 0.55) : ST + lot * 0.55;
					let lx = q ? across : along, lz = q ? along : across;
					if (lx > B[0] || lz > B[1]) continue;
					const gx = i * B[0] + lx, gz = j * B[1] + lz;
					const x = c * gx - s * gz, z = s * gx + c * gz;
					const g = bay.heightAt(x, z);
					if (g < 0.8 || Math.abs(g - ground) > 12) continue;
					// height: two or three storeys in the neighbourhoods; downtown, towers
					const d = U.d;
					let h = 6 + r * 7 + U.u * 4;
					if (d > 0.08) h += Math.pow(hash(i + k * 11, j + q * 13), 2.2) * d * d * 260 + d * 30;
					if (h < minH) continue;
					const w = lot * (0.8 + r * 0.15), dep = lot * 0.9 + (d > 0.3 ? 8 : 4);
					list.push({ x, y: g - 1.5, z, w, d: dep, h, a, col: PALETTE[Math.floor(r * 97) % PALETTE.length] });
				}
			}
		}
	}

	// the skylines, found once: every downtown cell's tall buildings, kept for far views
	const skyline = [];
	const skyMesh = new THREE.InstancedMesh(box, mat, 6000);
	skyMesh.count = 0; skyMesh.frustumCulled = false; skyMesh.castShadow = true;
	skyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6000 * 3), 3);
	group.add(skyMesh);
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
	const put = (im, k, o) => { q.setFromAxisAngle(Y, -o.a); sc.set(o.w, o.h + 1.5, o.d); p.set(o.x, o.y, o.z); im.setMatrixAt(k, m4.compose(p, q, sc)); im.setColorAt(k, col.setRGB(o.col[0], o.col[1], o.col[2])); };
	function findSkylines() {
		const seen = new Set();
		for (let z = -100000; z < 100000; z += 1000) for (let x = -20000; x < 120000; x += 1000) {
			const U = bay.urbanAt(x, z);
			if (U.d < 0.15) continue;
			const key = Math.floor(x / 3000) + ',' + Math.floor(z / 3000);
			if (seen.has(key)) continue;
			seen.add(key);
			fillBlocks(Math.floor(x / 3000) * 3000 + 1500, Math.floor(z / 3000) * 3000 + 1500, 2200, skyline, 38);
		}
		skyline.forEach((o, k) => { if (k < 6000) put(skyMesh, k, o); });
		skyMesh.count = Math.min(6000, skyline.length);
		skyMesh.instanceMatrix.needsUpdate = true; skyMesh.instanceColor.needsUpdate = true;
		skyMesh.computeBoundingSphere();
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
		near.visible = !high;
		if (Math.hypot(x - lastX, z - lastZ) < 300) return;
		lastX = x; lastZ = z;
		const list = [];
		fillBlocks(x, z, 1700, list);
		near.count = Math.min(CAP, list.length);
		for (let k = 0; k < near.count; k++) put(near, k, list[k]);
		near.instanceMatrix.needsUpdate = true; near.instanceColor.needsUpdate = true;
		near.computeBoundingSphere();
	}
	return { update, group };
}
