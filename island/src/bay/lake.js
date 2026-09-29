// Lake Annabel, at Bishop Ranch in San Ramon: the office park's lake, and a favourite
// family fishing spot. Its true outline (Overture Maps / OpenStreetMap), with the
// Roundhouse on its peninsula; the water deep green and still, mirroring the sky and the
// trees round it; a concrete edge with a walk along it, rock riprap and reeds, oaks and
// redwoods close round. Mallards and Canada geese paddle about, an egret stalks the
// shallows, turtles sun on the rocks, and now and then a fish jumps.
// Fish it from the edge (fishing.js): bluegill, largemouth bass, redear sunfish, channel
// catfish and carp, as the lake holds.

import * as THREE from 'three';
import { waterfowl, egret as egretBody, turtle as turtleBody } from '../world/creatures.js';
import { toWorld } from './geo.js';
import { CLOUD_REFLECT_GLSL, cloudReflectU } from '../world/sky.js';

const RING = [[37.7653550, -121.9665241], [37.7652032, -121.9669164], [37.7650471, -121.9670750], [37.7648865, -121.9671251], [37.7646555, -121.9670361], [37.7644905, -121.9668274], [37.7644421, -121.9666242], [37.7645037, -121.9662820], [37.7645939, -121.9657783], [37.7645873, -121.9653248], [37.7644949, -121.9648378], [37.7643651, -121.9645679], [37.7640594, -121.9641755], [37.7635886, -121.9636413], [37.7635336, -121.9634298], [37.7635380, -121.9632100], [37.7636018, -121.9629957], [37.7636898, -121.9628510], [37.7638328, -121.9627647], [37.7640132, -121.9627286], [37.7641737, -121.9627536], [37.7649305, -121.9632684], [37.7647765, -121.9636246], [37.7647391, -121.9637915], [37.7647479, -121.9639529], [37.7647963, -121.9641199], [37.7648755, -121.9642507], [37.7649591, -121.9643341], [37.7651108, -121.9644009], [37.7652560, -121.9644148], [37.7653858, -121.9643731], [37.7654936, -121.9642868], [37.7657554, -121.9636802], [37.7659599, -121.9638082], [37.7649393, -121.9663182], [37.7649613, -121.9663766], [37.7650031, -121.9663849], [37.7650383, -121.9663376]];
export const LAKE = RING.map(([a, b]) => toWorld(a, b));
export const ROUNDHOUSE = { ...toWorld(37.7651393, -121.9638533), r: 43, h: 9.9 };

// inside the water?
export function inLake(x, z) {
	let inside = false;
	for (let i = 0, j = LAKE.length - 1; i < LAKE.length; j = i++) {
		const a = LAKE[i], b = LAKE[j];
		if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
	}
	return inside;
}
const h01 = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// what the lake adds to the mapped city (realcity.js asks at load): trees round it, a walk
// along its edge; and what it takes away: anything mapped standing in the water, and the
// Roundhouse's box (it is modelled here)
export function lakeFeatures() {
	const trees = [], paths = [];
	let s = 0;
	for (let i = 0, j = LAKE.length - 1; i < LAKE.length; j = i++) {
		const a = LAKE[j], b = LAKE[i], L = Math.hypot(b.x - a.x, b.z - a.z);
		if (L < 4) continue;
		const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
		// the walk, 3 m out from the edge (on whichever side is land)
		const out = inLake(a.x + (b.x - a.x) / 2 + nx * 3, a.z + (b.z - a.z) / 2 + nz * 3) ? -1 : 1;
		paths.push({ ax: a.x + nx * 3.2 * out, az: a.z + nz * 3.2 * out, bx: b.x + nx * 3.2 * out, bz: b.z + nz * 3.2 * out, w: 2.6 });
		// trees in a loose band behind the walk: oaks mostly, redwoods in groves
		for (let t = 0; t < L; t += 7) {
			s++;
			if (h01(s) < 0.25) continue;
			const f = t / L, off = 7 + h01(s * 3.1) * 22, x = a.x + (b.x - a.x) * f + nx * off * out, z = a.z + (b.z - a.z) * f + nz * off * out;
			if (inLake(x, z) || Math.hypot(x - ROUNDHOUSE.x, z - ROUNDHOUSE.z) < ROUNDHOUSE.r + 4) continue;
			const grove = Math.sin(x * 0.02) * Math.cos(z * 0.025) > 0.35;
			trees.push({ x, z, h: grove ? 18 + h01(s * 5.7) * 10 : 9 + h01(s * 7.3) * 6, cone: grove ? 1 : 0 });
		}
	}
	const skip = (x, z) => inLake(x, z) || Math.hypot(x - ROUNDHOUSE.x, z - ROUNDHOUSE.z) < ROUNDHOUSE.r - 4;
	return { trees, paths, skip, bounds: [Math.min(...LAKE.map((p) => p.x)) - 60, Math.min(...LAKE.map((p) => p.z)) - 60, Math.max(...LAKE.map((p) => p.x)) + 60, Math.max(...LAKE.map((p) => p.z)) + 60] };
}

const WATER_VERT = /* glsl */`
	varying vec3 vW;
	#include <fog_pars_vertex>
	void main(){
		vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
		vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
		#include <fog_vertex>
	}`;
const WATER_FRAG = /* glsl */`
	${CLOUD_REFLECT_GLSL}
	uniform float uTime; uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor; uniform float uNight;
	uniform vec4 uRings[6];
	varying vec3 vW;
	#include <fog_pars_fragment>
	float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
	float wave(vec2 p){
		float h = vn(p * 0.35 + uTime * vec2(0.05, 0.03)) * 0.6 + vn(p * 1.1 - uTime * vec2(0.04, 0.07)) * 0.3 + vn(p * 3.3 + uTime * vec2(0.11, -0.05)) * 0.1;
		// rings spreading from a jumping fish, a duck, the bobber
		for (int i = 0; i < 6; i++) {
			vec4 R = uRings[i];
			if (R.w <= 0.0) continue;
			float d = length(p - R.xy), r = R.z;
			h += sin((d - r) * 6.0) * exp(-abs(d - r) * 1.6) * R.w * 0.5;
		}
		return h;
	}
	void main(){
		vec2 p = vW.xz; float e = 0.15;
		vec3 n = normalize(vec3(wave(p - vec2(e, 0.0)) - wave(p + vec2(e, 0.0)), 2.0 * e / 0.12, wave(p - vec2(0.0, e)) - wave(p + vec2(0.0, e))));
		vec3 v = normalize(cameraPosition - vW);
		vec3 r = reflect(-v, n);
		float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
		// the sky in it, and low down the dark line of the trees round the shore
		vec3 sky = skyReflect(r, uSkyZen, uSkyHor, uSunColor);
		sky = mix(vec3(0.03, 0.06, 0.03) * (1.0 - uNight * 0.8), sky, smoothstep(0.06, 0.32, r.y + (vn(p * 0.05) - 0.5) * 0.12));
		vec3 deep = vec3(0.01, 0.05, 0.032) * (1.0 - uNight * 0.85);
		// (a green lake: what it mirrors comes back through green water)
		vec3 col = mix(deep, sky * vec3(0.62, 0.86, 0.7), fres);
		col += uSunColor * pow(max(dot(r, uSunDir), 0.0), 600.0) * 6.0 * (1.0 - uNight) + uSunColor * pow(max(dot(r, uSunDir), 0.0), 40.0) * 0.12 * (1.0 - uNight);
		gl_FragColor = vec4(col, 1.0);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
		#include <fog_fragment>
	}`;

// a water body from its outline (world x, z): inside, the nearest shore
function shoreOf(P) {
	const inside = (x, z) => {
		let r = false;
		for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) r = !r; }
		return r;
	};
	const edgeOf = (x, z) => {
		let best = 1e9, bx = 0, bz = 0;
		for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
			const a = P[j], b = P[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
			const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)), px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(x - px, z - pz);
			if (d < best) { best = d; bx = px; bz = pz; }
		}
		return { d: best, x: bx, z: bz };
	};
	const xs = P.map((p) => p.x), zs = P.map((p) => p.z);
	return { P, inside, edgeOf, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), cx: xs.reduce((a, b) => a + b) / xs.length, cz: zs.reduce((a, b) => a + b) / zs.length };
}

// The lakes: Lake Annabel, and the ponds the generated towns grow in their parks (their
// outlines come with the town, crysis/civgen.js). Each is built when you come near.
export function createLake(scene, bay, shared, { isPhone = false, real = null, ponds = true } = {}) {
	const root = new THREE.Group();
	root.name = 'lakes';
	scene.add(root);
	const rings = [...Array(6)].map(() => new THREE.Vector4(0, 0, 0, 0));
	const U = { uTime: { value: 0 }, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor, uNight: { value: 0 }, uRings: { value: rings }, ...cloudReflectU(shared) };
	const ring = (x, z, k = 1) => { const R = rings.reduce((a, b) => (b.w < a.w ? b : a)); R.set(x, z, 0.2, k); };
	const bodies = [];
	const annabel = { S: shoreOf(LAKE), roundhouse: true, birds: isPhone ? 8 : 14, egret: true };
	bodies.push(annabel);

	function build(W) {
		const { S } = W, inLake = S.inside, edge = S.edgeOf, P = S.P, group = new THREE.Group();
		W.group = group; W.built = true; W.birdsL = [];
		root.add(group);
		const { minX, maxX, minZ, maxZ } = S;
		// the water's level: just over the ground inside (the mapped ground is the lake's
		// surface, flattened), the edge a concrete lip standing over it
		let hi = -1e9;
		for (let x = minX; x < maxX; x += 6) for (let z = minZ; z < maxZ; z += 6) if (inLake(x, z)) hi = Math.max(hi, bay.heightAt(x, z));
		for (const q of P) if (hi < -1e8) hi = bay.heightAt(q.x, q.z);
		const level = W.level = hi + 0.06;
		// the water
		const shape = new THREE.Shape(P.map((q) => new THREE.Vector2(q.x, -q.z)));
		const wg = new THREE.ShapeGeometry(shape, 8);
		wg.rotateX(-Math.PI / 2);
		const water = new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]), vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true }));
		Object.assign(water.material.uniforms, U);
		water.position.y = level;
		water.receiveShadow = true;
		group.add(water);
		// the concrete lip all round, and rocks and reeds along parts of the shore
		const lip = [], rocks = [], reeds = [];
		for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
			const a = P[j], b = P[i], L = Math.hypot(b.x - a.x, b.z - a.z);
			if (L < 0.5) continue;
			const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L, out = inLake((a.x + b.x) / 2 + nx * 1.5, (a.z + b.z) / 2 + nz * 1.5) ? -1 : 1;
			lip.push({ a, b, L, nx: nx * out, nz: nz * out });
			for (let t = 0.8; t < L; t += 1.3) {
				const f = t / L, x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f, k = h01(x * 0.37 + z * 1.13);
				if (Math.sin(x * 0.045 + z * 0.03) > 0.1) rocks.push([x - nx * out * (0.4 + k * 1.2), z - nz * out * (0.4 + k * 1.2), 0.35 + k * 0.5, k]);
				else if (k > 0.45) reeds.push([x - nx * out * (0.3 + k * 0.6), z - nz * out * (0.3 + k * 0.6), 0.7 + k * 0.9, k]);
			}
		}
		const conc = new THREE.MeshStandardMaterial({ color: 0xb9b4a9, roughness: 0.85 });
		const lipG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
		const lips = new THREE.InstancedMesh(lipG, conc, Math.max(1, lip.length));
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
		lip.forEach((e, k) => {
			const g = Math.min(bay.heightAt(e.a.x, e.a.z), bay.heightAt(e.b.x, e.b.z)), y0 = Math.min(g, level) - 0.8, top = Math.max(level + 0.3, g + 0.12);
			q.setFromAxisAngle(Y, -Math.atan2(e.b.z - e.a.z, e.b.x - e.a.x));
			lips.setMatrixAt(k, m4.compose(p.set((e.a.x + e.b.x) / 2 + e.nx * 0.3, y0, (e.a.z + e.b.z) / 2 + e.nz * 0.3), q, s.set(e.L + 0.6, top - y0, 0.6)));
		});
		lips.count = lip.length;
		lips.castShadow = lips.receiveShadow = true;
		group.add(lips);
		const rockM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8d8579, roughness: 0.95, flatShading: true }), Math.max(1, rocks.length));
		const col = new THREE.Color();
		rocks.forEach(([x, z, r, k], i) => {
			q.setFromEuler(new THREE.Euler(k * 3, k * 7, k * 5));
			rockM.setMatrixAt(i, m4.compose(p.set(x, level - r * 0.35, z), q, s.set(r * 1.2, r * 0.7, r)));
			rockM.setColorAt(i, col.setRGB(0.55 + k * 0.25, 0.52 + k * 0.22, 0.47 + k * 0.2));
		});
		rockM.count = rocks.length;
		rockM.castShadow = rockM.receiveShadow = true;
		group.add(rockM);
		// reeds and ornamental grasses: a fan of thin blades
		const blades = [];
		for (let b2 = 0; b2 < 9; b2++) { const a = b2 / 9 * Math.PI * 2, g = new THREE.ConeGeometry(0.035, 1, 3).translate(0, 0.5, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35))); blades.push(g); }
		const reedM = new THREE.InstancedMesh(mergeBlades(blades), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), Math.max(1, reeds.length));
		reeds.forEach(([x, z, h, k], i) => {
			q.setFromAxisAngle(Y, k * 6.28);
			reedM.setMatrixAt(i, m4.compose(p.set(x, level - 0.1, z), q, s.set(h * 0.9, h, h * 0.9)));
			reedM.setColorAt(i, col.setRGB(0.25 + k * 0.25, 0.36 + k * 0.1, 0.12 + k * 0.05));
		});
		reedM.count = reeds.length;
		group.add(reedM);
		if (W.roundhouse) {
			// the Roundhouse: a drum of glass under a broad dark roof ring, a lighter drum on top
			const rh = new THREE.Group(), g0 = bay.heightAt(ROUNDHOUSE.x, ROUNDHOUSE.z);
			rh.position.set(ROUNDHOUSE.x, Math.max(g0, level + 0.3), ROUNDHOUSE.z);
			const R = ROUNDHOUSE.r;
			const mk = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; rh.add(m); return m; };
			const white = new THREE.MeshStandardMaterial({ color: 0xe7e3da, roughness: 0.7 });
			const glassM = new THREE.MeshStandardMaterial({ color: 0x33403f, roughness: 0.08, metalness: 0.6, emissive: 0xffd9a0, emissiveIntensity: 0 });
			mk(new THREE.CylinderGeometry(R + 3, R + 3.5, 0.9, 64), white, 0.45);                       // the terrace
			mk(new THREE.CylinderGeometry(R - 5, R - 5, 4.6, 64, 1, true), glassM, 3.2);                 // glass all round
			mk(new THREE.CylinderGeometry(R + 1.5, R - 4, 1.4, 64), new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6 }), 6.2);   // the dark roof ring
			mk(new THREE.CylinderGeometry(R * 0.5, R * 0.52, 2.6, 48), white, 8.1);                      // the drum on top
			mk(new THREE.SphereGeometry(R * 0.35, 32, 10, 0, Math.PI * 2, 0, 0.45), white, 8.8);        // its shallow dome
			// planted terraces stepping down to the water
			mk(new THREE.CylinderGeometry(R + 6, R + 7, 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x4d6b2f, roughness: 0.95 }), 0.1);
			group.add(rh);
			W.glass = glassM;
		}
		// wildlife
		// (sculpted, world/creatures.js; they face +x here, so a quarter turn, and sit a little
		// down in the water)
		const fowl = { duck: waterfowl('mallard'), goose: waterfowl('goose') }, fowlM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75 });
		const mkBird = (kind) => {
			const b = new THREE.Group(), m = new THREE.Mesh(fowl[kind], fowlM);
			m.rotation.y = Math.PI / 2; m.position.y = -0.04; m.castShadow = true;
			b.add(m);
			return b;
		};
		const spots = (n) => { for (let k = 0; k < 40; k++) { const x = minX + h01(n * 13 + k + S.cx) * (maxX - minX), z = minZ + h01(n * 7 + k * 3 + 1 + S.cz) * (maxZ - minZ); if (inLake(x, z) && edge(x, z).d > 4) return [x, z]; } return [S.cx, S.cz]; };
		for (let k = 0; k < W.birds; k++) {
			const kind = k % 3 === 0 ? 'goose' : 'duck', b = mkBird(kind), [x, z] = spots(k);
			b.position.set(x, level, z);
			group.add(b);
			W.birdsL.push({ b, x, z, h: h01(k + S.cx) * 6.28, v: 0.25 + h01(k * 3) * 0.3, turn: 0, ph: h01(k * 5) * 10, kind });
		}
		if (W.egret && rocks.length) {
			// an egret in the shallows (it faces +x here, like the ducks)
			const egret = new THREE.Group(), em = new THREE.Mesh(egretBody(), fowlM);
			em.rotation.y = Math.PI / 2; em.castShadow = true; egret.add(em);
			const es = rocks[Math.floor(rocks.length * 0.37)];
			egret.position.set(es[0], level - 0.2, es[1]);
			group.add(egret);
			W.egretM = egret;
		}
		// turtles sunning on the rocks
		const turtleG = turtleBody();
		for (let k = 0; k < Math.min(4, rocks.length); k++) {
			const rk = rocks[Math.floor(rocks.length * (0.1 + k * 0.23))];
			const t = new THREE.Mesh(turtleG, fowlM);
			t.scale.setScalar(1.3); t.position.set(rk[0], level - rk[2] * 0.35 + rk[2] * 0.7 * 0.95 - 0.02, rk[1]); t.rotation.y = k * 1.7;
			group.add(t);
		}
	}
	function drop(W) {
		if (!W.group) return;
		root.remove(W.group);
		W.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== undefined) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
		W.group = null; W.built = false;
	}

	let jumpT = 3, pondsV = -1;
	function update(dt, t, cam, night) {
		const x = cam.position.x, z = cam.position.z;
		if (!bay.loaded()) return;
		// the generated towns' ponds, as they come and go (unless water.js has them)
		const v = real?.version ? real.version() : 0;
		if (ponds && v !== pondsV) {
			pondsV = v;
			const now = new Set(real?.ponds ? real.ponds() : []);
			for (let i = bodies.length - 1; i >= 1; i--) if (!now.has(bodies[i].src)) { drop(bodies[i]); bodies.splice(i, 1); }
			for (const pts of now) if (!bodies.some((b) => b.src === pts)) bodies.push({ S: shoreOf(pts), src: pts, birds: isPhone ? 3 : 5, egret: h01(pts.length) > 0.5 });
		}
		U.uTime.value = t; U.uNight.value = night;
		for (const R of rings) if (R.w > 0) { R.z += dt * 1.4; R.w -= dt * 0.35; }
		for (const W of bodies) {
			const S = W.S, far = Math.hypot(x - S.cx, z - S.cz);
			if (!W.built) { if (far < 2500) build(W); else continue; }
			W.group.visible = far < 4000 && cam.position.y < 2500;
			if (!W.group.visible) continue;
			if (W.glass) W.glass.emissiveIntensity = night * 1.3;
			// the birds paddle about, steering off the shore, now and then dabbling
			for (const B of W.birdsL) {
				B.ph += dt;
				if (Math.random() < dt * 0.15) B.turn = (Math.random() - 0.5) * 0.8;
				const ax = B.x + Math.cos(B.h) * 4, az = B.z + Math.sin(B.h) * 4;
				if (!S.inside(ax, az) || S.edgeOf(ax, az).d < 2.5) B.h += dt * 1.5;
				else B.h += B.turn * dt;
				B.x += Math.cos(B.h) * B.v * dt; B.z += Math.sin(B.h) * B.v * dt;
				// (keeping clear of you)
				const dc = Math.hypot(B.x - x, B.z - z);
				if (dc < 5) { B.h = Math.atan2(B.z - z, B.x - x); B.v = 0.9; } else B.v += (0.35 - B.v) * dt * 0.3;
				const dab = Math.max(0, Math.sin(B.ph * 0.4) - 0.93) * 12;
				B.b.position.set(B.x, W.level + Math.sin(B.ph * 2) * 0.012, B.z);
				B.b.rotation.set(0, -B.h, dab * 1.2);
				if (dab > 0.5 && Math.random() < dt * 2) ring(B.x, B.z, 0.3);
			}
			if (W.egretM) W.egretM.rotation.y = Math.sin(t * 0.05) * 1.5;
		}
		// a fish jumps in whatever water is near
		jumpT -= dt;
		if (jumpT < 0) {
			jumpT = 4 + Math.random() * 10;
			for (let k = 0; k < 20; k++) { const jx = x + (Math.random() - 0.5) * 160, jz = z + (Math.random() - 0.5) * 160, W = bodyAt(jx, jz); if (W && W.S.edgeOf(jx, jz).d > 3) { ring(jx, jz, 1); break; } }
		}
	}
	const bodyAt = (x, z) => bodies.find((W) => W.built && x > W.S.minX && x < W.S.maxX && z > W.S.minZ && z < W.S.maxZ && W.S.inside(x, z)) || null;
	// the water's level where you are, or null if it is dry land
	const waterAt = (x, z) => { const W = bodyAt(x, z); return W ? W.level : null; };
	// the water is water: you walk round it, not over it
	function push(p, footY, flying) {
		if (flying) return;
		const W = bodyAt(p.x, p.z);
		if (!W || footY > W.level + 3) return;
		const e = W.S.edgeOf(p.x, p.z), dx = e.x - p.x, dz = e.z - p.z, l = Math.hypot(dx, dz) || 1;
		p.x = e.x + dx / l * 0.4; p.z = e.z + dz / l * 0.4;
	}
	return { group: root, update, push, waterAt, inLake: (x, z) => waterAt(x, z) !== null, level: () => annabel.level ?? 0 };
}

// the reed blades merged into one geometry (a small local version, to keep this module
// standalone)
function mergeBlades(geos) {
	const pos = [], idx = [];
	let off = 0;
	for (const g of geos) {
		const n = g.toNonIndexed(), p = n.attributes.position.array;
		for (let i = 0; i < p.length; i++) pos.push(p[i]);
		for (let i = 0; i < p.length / 3; i++) idx.push(off + i);
		off += p.length / 3;
	}
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	out.setIndex(idx);
	out.computeVertexNormals();
	return out;
}
