// Life in the bay. Schools of small reef fish that move as one (cohesion, alignment,
// separation), wander between the kelp and the rim, scatter when you swim at them and
// tighten on the music's low end. And the reef: brain coral, sea fans, anemones that
// sway in the swell, sea urchins on the basalt, on the crater rim and in the shallows.

import * as THREE from 'three';
import { mulberry32, makeNoise } from './noise.js';

function fishGeometry() {
	// a slim body with a forked tail, nose at -z; the tail is marked for the swim wave
	const g = new THREE.BufferGeometry(), P = [], T = [], I = [];
	const ring = (z, rx, ry, t) => { const b = P.length / 3; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.push(Math.cos(a) * rx, Math.sin(a) * ry, z); T.push(t); } return b; };
	const rings = [ring(-0.5, 0.0, 0.0, 0), ring(-0.3, 0.07, 0.12, 0.1), ring(0.0, 0.08, 0.15, 0.35), ring(0.28, 0.04, 0.07, 0.75), ring(0.4, 0.015, 0.03, 1)];
	for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < 6; i++) {
		const a = rings[r] + i, b = rings[r] + (i + 1) % 6, c = rings[r + 1] + i, d = rings[r + 1] + (i + 1) % 6;
		I.push(a, c, b, b, c, d);
	}
	const tb = P.length / 3;
	P.push(0, 0, 0.38, 0, 0.16, 0.62, 0, -0.16, 0.62, 0, 0, 0.52); T.push(1, 1.4, 1.4, 1.2);
	I.push(tb, tb + 1, tb + 3, tb, tb + 3, tb + 2, tb, tb + 3, tb + 1, tb, tb + 2, tb + 3);
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('aTail', new THREE.Float32BufferAttribute(T, 1));
	g.setIndex(I);
	g.computeVertexNormals();
	return g;
}

export function createSealife(island, shared, scene, camera) {
	const bay = island.village.bay;
	if (!bay) return { update() {} };
	const r = mulberry32(island.seed ^ 0xf15a);
	const nz = makeNoise(island.seed + 31);
	const group = new THREE.Group();
	group.name = 'sealife';
	scene.add(group);

	// ---------- fish ----------
	const SPECIES = [
		{ n: 110, size: 0.16, a: [1.0, 0.82, 0.18], b: [0.2, 0.35, 0.8] },    // yellow tang / blue
		{ n: 90, size: 0.12, a: [0.95, 0.5, 0.15], b: [1.0, 1.0, 0.95] },     // clownish orange and white
		{ n: 120, size: 0.1, a: [0.72, 0.84, 0.92], b: [0.35, 0.5, 0.62] },   // silver baitfish
		{ n: 260, size: 0.09, a: [0.62, 0.72, 0.8], b: [0.3, 0.38, 0.45], vent: true },   // a swarm over the vent
	];
	const N = SPECIES.reduce((s, x) => s + x.n, 0);
	const fishMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.25 });
	const uni = { uTime: shared.uTime };
	fishMat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uni);
		sh.vertexShader = 'attribute float aTail; attribute vec3 aColA; attribute vec3 aColB; attribute float aPhase; uniform float uTime; varying vec3 vFishCol;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
			#include <begin_vertex>
			// the swim: a wave down the body, bigger toward the tail
			transformed.x += sin(uTime * 14.0 + aPhase - position.z * 6.0) * 0.06 * aTail * aTail;
			// counter-shaded, with a band of the second colour
			vFishCol = mix(aColA, aColB, smoothstep(0.02, -0.06, position.y) * 0.7 + step(0.1, abs(position.z + 0.05)) * step(abs(position.z + 0.05), 0.16) * 0.8);`);
		sh.fragmentShader = 'varying vec3 vFishCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vFishCol;');
	};
	fishMat.customProgramCacheKey = () => 'fish230';
	const fishGeo = new THREE.InstancedBufferGeometry().copy(fishGeometry());
	const colA = new Float32Array(N * 3), colB = new Float32Array(N * 3), phase = new Float32Array(N);
	const fish = new THREE.InstancedMesh(fishGeo, fishMat, N);
	fish.frustumCulled = false;
	const schools = [], boids = [];
	let k = 0;
	for (const sp of SPECIES) {
		const a = r() * 6.28, t = sp.vent ? 0.04 : 0.25 + r() * 0.3;
		const home = new THREE.Vector3(bay.x + Math.cos(a) * t * bay.r, 0, bay.z + Math.sin(a) * t * bay.r);
		home.y = Math.min(-2, island.heightAt(home.x, home.z) * 0.5);
		const school = { home, goal: home.clone(), timer: 0, center: new THREE.Vector3(), vel: new THREE.Vector3(), sp };
		schools.push(school);
		for (let i = 0; i < sp.n; i++, k++) {
			const p = home.clone().add(new THREE.Vector3((r() - 0.5) * 6, (r() - 0.5) * 3, (r() - 0.5) * 6));
			boids.push({ p, v: new THREE.Vector3(r() - 0.5, 0, r() - 0.5), school, size: sp.size * (0.8 + r() * 0.4) });
			const tone = 0.85 + r() * 0.3;
			colA.set(sp.a.map((c) => c * tone), k * 3); colB.set(sp.b.map((c) => c * tone), k * 3);
			phase[k] = r() * 6.28;
		}
	}
	fishGeo.setAttribute('aColA', new THREE.InstancedBufferAttribute(colA, 3));
	fishGeo.setAttribute('aColB', new THREE.InstancedBufferAttribute(colB, 3));
	fishGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
	group.add(fish);

	// ---------- reef ----------
	const reefSpots = [];
	for (let i = 0; i < 3000 && reefSpots.length < 460; i++) {
		const a = r() * 6.28, t = 0.3 + r() * 0.75;
		const x = bay.x + Math.cos(a) * t * bay.r, z = bay.z + Math.sin(a) * t * bay.r, h = island.heightAt(x, z);
		if (h > -0.9 || h < -9) continue;
		// thickest along the crater rim, in clumps
		const rim = Math.exp(-Math.pow((t - 0.5) / 0.08, 2));
		const clump = nz.fbm(x * 0.05 + 3, z * 0.05, 3);
		if (r() > rim * 0.9 + 0.15 * clump) continue;
		reefSpots.push({ x, z, h });
	}
	const place = (im, list, fn) => {
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
		list.forEach((o, i) => { e.set(o.tx || 0, o.rot, o.tz || 0); q.setFromEuler(e); s.setScalar(o.s); if (o.sy) s.y = o.sy; p.set(o.x, o.h, o.z); im.setMatrixAt(i, m4.compose(p, q, s)); if (im.instanceColor) im.setColorAt(i, o.c); });
		im.instanceMatrix.needsUpdate = true;
	};
	const pick = (f) => reefSpots.filter(f);
	// brain coral: a wrinkled dome
	const brainGeo = (() => {
		const g = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position;
		for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const w = 1 + 0.06 * Math.sin(x * 14 + Math.sin(z * 9) * 2.5) * Math.cos(z * 13); p.setXYZ(i, x * w, y * 0.7 * w, z * w); }
		g.computeVertexNormals(); return g;
	})();
	const brains = pick((_, i) => i % 3 === 0).map((o) => ({ ...o, rot: r() * 6.28, s: 0.3 + r() * 0.7, c: new THREE.Color().setHSL([0.08, 0.95, 0.12, 0.55][Math.floor(r() * 4)], 0.55, 0.45) }));
	const brainIM = new THREE.InstancedMesh(brainGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), brains.length);
	brainIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(brains.length * 3), 3);
	place(brainIM, brains); group.add(brainIM);
	// sea fans: a flat lattice fan standing on a short stalk
	const fanTex = (() => {
		const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), rr = mulberry32(5);
		g.strokeStyle = '#fff'; g.lineWidth = 1.4;
		const branch = (x, y, a, len, d) => { if (d > 6 || len < 3) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); for (let k = 0; k < 2; k++) branch(x2, y2, a + (k ? 0.45 : -0.45) + (rr() - 0.5) * 0.3, len * 0.78, d + 1); };
		branch(S / 2, S, -Math.PI / 2, 26, 0);
		for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(rr() * S, rr() * S * 0.85, 1, 1); }
		const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
	})();
	const fans = pick((_, i) => i % 3 === 1).map((o) => ({ ...o, rot: r() * 6.28, s: 0.6 + r() * 0.9, c: new THREE.Color().setHSL([0.8, 0.9, 0.02][Math.floor(r() * 3)], 0.6, 0.45) }));
	const fanGeo = new THREE.PlaneGeometry(1.2, 1.2).translate(0, 0.6, 0);
	const fanMat = new THREE.MeshStandardMaterial({ map: fanTex, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 });
	fanMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 ip = vec3(instanceMatrix[3]);\ntransformed.z += sin(uTime * 1.1 + ip.x * 0.4 + ip.z * 0.3) * 0.12 * position.y;'); };
	fanMat.customProgramCacheKey = () => 'fan230';
	const fanIM = new THREE.InstancedMesh(fanGeo, fanMat, fans.length);
	fanIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(fans.length * 3), 3);
	place(fanIM, fans); group.add(fanIM);
	// anemones: a clump of tentacles swaying together
	const aneGeo = (() => {
		const P = [], A = [], I = [];
		for (let t = 0; t < 26; t++) {
			const a = t / 26 * 6.28 + (t % 3) * 0.3, rad = 0.12 + (t % 4) * 0.05, len = 0.35 + (t % 5) * 0.05;
			const b = P.length / 3;
			for (let s = 0; s <= 4; s++) { const f = s / 4; const x = Math.cos(a) * (rad + f * 0.12), z = Math.sin(a) * (rad + f * 0.12); P.push(x - 0.012 * (1 - f), f * len, z, x + 0.012 * (1 - f), f * len, z); A.push(f, f); }
			for (let s = 0; s < 4; s++) { const q = b + s * 2; I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aUp', new THREE.Float32BufferAttribute(A, 1)); g.setIndex(I); g.computeVertexNormals(); return g;
	})();
	const anes = pick((_, i) => i % 3 === 2).map((o) => ({ ...o, rot: r() * 6.28, s: 0.8 + r() * 0.8, c: new THREE.Color().setHSL([0.95, 0.35, 0.08][Math.floor(r() * 3)], 0.7, 0.55) }));
	const aneMat = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide, emissive: 0x000000 });
	aneMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = shared.uTime; sh.uniforms.uBass = shared.uBass; sh.vertexShader = 'attribute float aUp; uniform float uTime, uBass;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 ip = vec3(instanceMatrix[3]);\nfloat sw = sin(uTime * 1.3 + ip.x * 0.5 + ip.z * 0.3);\ntransformed.x += sw * 0.1 * aUp * aUp; transformed.z += cos(uTime * 1.1 + ip.z) * 0.06 * aUp * aUp;\ntransformed.xz *= 1.0 + uBass * 0.25 * aUp;'); };
	aneMat.customProgramCacheKey = () => 'ane230';
	const aneIM = new THREE.InstancedMesh(aneGeo, aneMat, anes.length);
	aneIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(anes.length * 3), 3);
	place(aneIM, anes); group.add(aneIM);
	// urchins: black spiny balls on the rock
	const urchinGeo = (() => { const g = new THREE.IcosahedronGeometry(0.1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); if (i % 3 === 0) v.multiplyScalar(3.2); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })();
	const urchins = [];
	for (const o of reefSpots) for (let j = 0; j < 2; j++) if (r() < 0.35) urchins.push({ x: o.x + (r() - 0.5) * 1.5, z: o.z + (r() - 0.5) * 1.5, h: island.heightAt(o.x, o.z) + 0.05, rot: r() * 6.28, s: 0.7 + r() * 0.6 });
	const urchinIM = new THREE.InstancedMesh(urchinGeo, new THREE.MeshStandardMaterial({ color: 0x14101a, roughness: 0.5 }), urchins.length);
	place(urchinIM, urchins); group.add(urchinIM);
	for (const im of [brainIM, fanIM, aneIM, urchinIM]) { im.userData.material175 = 'crystal'; im.receiveShadow = true; }

	// ---------- the schools move ----------
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3();
	const look = new THREE.Matrix4();
	let lastBass = 0;
	function update(dt, t, active) {
		group.visible = active;
		if (!active) return;
		dt = Math.min(dt, 0.05);
		const bass = shared.uBass.value, beat = bass > 0.55 && lastBass <= 0.55;
		lastBass = bass;
		for (const s of schools) {
			s.timer -= dt;
			if (s.timer <= 0) {
				// wander to a new spot in the crater, at a depth between floor and surface
				s.timer = 8 + Math.random() * 10;
				const a = Math.random() * 6.28, rr = (s.sp.vent ? 0.14 + Math.random() * 0.08 : 0.15 + Math.random() * 0.45) * bay.r;
				s.goal.set(bay.x + Math.cos(a) * rr, 0, bay.z + Math.sin(a) * rr);
				const fl = island.heightAt(s.goal.x, s.goal.z);
				s.goal.y = s.sp.vent ? Math.min(-2, fl + 5 + Math.random() * 3) : fl + 1.2 + Math.random() * Math.max(0.5, -fl - 2.2);
			}
			s.center.set(0, 0, 0); s.vel.set(0, 0, 0);
		}
		const count = new Map();
		for (const b of boids) { b.school.center.add(b.p); b.school.vel.add(b.v); count.set(b.school, (count.get(b.school) || 0) + 1); }
		for (const s of schools) { const n = count.get(s); s.center.divideScalar(n); s.vel.divideScalar(n); }
		const cam = camera.position;
		for (let i = 0; i < boids.length; i++) {
			const b = boids[i], s = b.school;
			const acc = tmp.set(0, 0, 0);
			// cohesion (tighter on the beat), alignment, a pull toward the school's goal
			acc.addScaledVector(dir.copy(s.center).sub(b.p), beat ? 1.8 : 0.35);
			acc.addScaledVector(dir.copy(s.vel).sub(b.v), 0.9);
			acc.addScaledVector(dir.copy(s.goal).sub(s.center).setLength(1), 0.9);
			// separation from a few neighbours
			for (let j = 1; j <= 3; j++) {
				const o = boids[(i + j * 7) % boids.length];
				if (o.school !== s) continue;
				dir.copy(b.p).sub(o.p); const d = dir.length();
				if (d < 0.5 && d > 1e-3) acc.addScaledVector(dir, (0.5 - d) * 8 / d);
			}
			// flee the swimmer
			dir.copy(b.p).sub(cam); const dc = dir.length();
			if (dc < 4) acc.addScaledVector(dir, (4 - dc) * 5 / Math.max(dc, 0.3));
			// stay in the water, off the floor
			const fl = island.heightAt(b.p.x, b.p.z);
			if (b.p.y < fl + 0.6) acc.y += (fl + 0.6 - b.p.y) * 6;
			if (b.p.y > -1.3) acc.y -= (b.p.y + 1.3) * 6;
			b.v.addScaledVector(acc, dt);
			const sp = b.v.length(), max = dc < 4 ? 4.5 : 1.6, min = 0.4;
			if (sp > max) b.v.multiplyScalar(max / sp); else if (sp < min) b.v.multiplyScalar(min / Math.max(sp, 1e-3));
			b.p.addScaledVector(b.v, dt);
			// face along the motion (nose is -z)
			look.lookAt(b.p, dir.copy(b.p).add(b.v), up);
			q.setFromRotationMatrix(look);
			sc.setScalar(b.size / 0.16 * 0.9);
			fish.setMatrixAt(i, m4.compose(b.p, q, sc));
		}
		fish.instanceMatrix.needsUpdate = true;
	}
	return { update, group, fishCount: N, reefCount: reefSpots.length };
}
