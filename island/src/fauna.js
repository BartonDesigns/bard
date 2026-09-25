// Life that reads at a glance: gulls wheeling over the bay and fireflies after
// dark that pulse with the music. (Butterflies, birds, crabs and lizards are grown
// by Crysis in crysis/landfauna.js.)

import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { glow } from './world/textures.js';

export function createFauna(island, shared, scene) {
	const r = mulberry32(island.seed ^ 0xb1d);
	// gulls: a body and two wings that beat in the vertex shader
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute([
		0, 0, 0.45, 0.1, 0.03, -0.3, -0.1, 0.03, -0.3,
		0.08, 0, 0.12, 0.95, 0.02, -0.22, 0.08, 0, -0.18,
		-0.08, 0, 0.12, -0.08, 0, -0.18, -0.95, 0.02, -0.22,
	], 3));
	g.setAttribute('aWing', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1], 1));
	g.computeVertexNormals();
	const N = 14;
	const gullMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f2, side: THREE.DoubleSide });
	gullMat.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime;
		sh.vertexShader = 'attribute float aWing; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
			#include <begin_vertex>
			float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
			transformed.y += aWing * sin(uTime * 6.5 + ph) * 0.35 * abs(transformed.x);`);
	};
	const gulls = new THREE.InstancedMesh(g, gullMat, N);
	gulls.frustumCulled = false;
	const birds = [];
	for (let i = 0; i < N; i++) birds.push({ cx: island.village.coast.x + (r() - 0.5) * 160, cz: island.village.coast.z + (r() - 0.5) * 160, rad: 20 + r() * 50, h: 14 + r() * 26, sp: (0.25 + r() * 0.3) * (r() < 0.5 ? 1 : -1), ph: r() * 6.28, s: 1.2 + r() * 0.5 });
	scene.add(gulls);

	// butterflies and fireflies: points that drift near the player
	const P = 90, pos = new Float32Array(P * 3), seeds = [];
	for (let i = 0; i < P; i++) seeds.push({ x: (r() - 0.5) * 60, z: (r() - 0.5) * 60, y: 0.6 + r() * 1.8, ph: r() * 6.28, sp: 0.4 + r() * 0.8 });
	const pg = new THREE.BufferGeometry();
	pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	const fireMat = new THREE.PointsMaterial({ map: glow(), color: 0xd8ff7a, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
	const flies = new THREE.Points(pg, fireMat);
	flies.frustumCulled = false;
	scene.add(flies);
	const butterMat = new THREE.PointsMaterial({ map: glow(), color: 0xf2d479, size: 0.09, transparent: true, depthWrite: false, opacity: 0 });
	const butter = new THREE.Points(pg, butterMat);
	butter.frustumCulled = false;
	scene.add(butter);

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
	function update(t, night, focus) {
		birds.forEach((b, i) => {
			const a = t * b.sp + b.ph;
			p.set(b.cx + Math.cos(a) * b.rad, b.h + Math.sin(t * 0.4 + i) * 2, b.cz + Math.sin(a) * b.rad);
			e.set(Math.sin(t + i) * 0.1, -a + (b.sp > 0 ? Math.PI : 0), (b.sp > 0 ? -1 : 1) * 0.35);
			q.setFromEuler(e);
			sc.setScalar(b.s);
			m4.compose(p, q, sc);
			gulls.setMatrixAt(i, m4);
		});
		gulls.instanceMatrix.needsUpdate = true;
		gulls.visible = night < 0.7;
		const pulse = 0.6 + shared.uHigh.value * 0.8 + shared.uPulse.value * 0.5;
		for (let i = 0; i < P; i++) {
			const s = seeds[i];
			const x = focus.x + ((s.x + Math.sin(t * s.sp + s.ph) * 3 - focus.x * 0) % 60);
			const z = focus.z + ((s.z + Math.cos(t * s.sp * 0.8 + s.ph) * 3) % 60);
			// keep them out of your face: never closer than a couple of paces
			let px = x, pz = z;
			const dx = px - focus.x, dz = pz - focus.z, d = Math.hypot(dx, dz);
			if (d < 2.5) { const k = 2.5 / Math.max(d, 0.01); px = focus.x + dx * k; pz = focus.z + dz * k; }
			const ground = island.heightAt(px, pz);
			pos[i * 3] = px; pos[i * 3 + 1] = Math.max(ground, 0.2) + s.y + Math.sin(t * 2.3 + s.ph) * 0.25; pos[i * 3 + 2] = pz;
		}
		pg.attributes.position.needsUpdate = true;
		fireMat.opacity = night * Math.min(1, pulse);
		fireMat.size = 0.3 + shared.uHigh.value * 0.35;
		butterMat.opacity = 0;          // butterflies are Crysis animals now (crysis/landfauna.js)
	}
	return { update };
}
