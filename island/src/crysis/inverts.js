// Crysis small life: the animals of the reef floor and the open water, grown from
// their genomes. Sea stars on the sand and the heads, sea cucumbers lying in the
// sand channels, giant clams wedged into the coral with their mantles glowing,
// feather dusters that snap back into their tubes and garden eels that sink into
// the sand when you come close, and moon jellies pulsing slowly through the blue.

import * as THREE from 'three';
import { mulberry32 } from '../noise.js';

const hsl = (c) => new THREE.Color().setHSL(c[0], c[1], c[2]);

function starGeo(arms) {
	const P = [], I = [], N = arms * 2;
	P.push(0, 0.05, 0);
	for (let i = 0; i < N; i++) {
		const a = i / N * Math.PI * 2, r = i % 2 ? 0.13 : 0.5;
		P.push(Math.cos(a) * r, i % 2 ? 0.04 : 0.015, Math.sin(a) * r);
	}
	for (let i = 0; i < N; i++) I.push(0, 1 + (i + 1) % N, 1 + i);
	// underside
	const b = P.length / 3; P.push(0, 0, 0);
	for (let i = 0; i < N; i++) I.push(b, 1 + i, 1 + (i + 1) % N);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setIndex(I); g.computeVertexNormals();
	return g;
}

// a shader hook shared by the things that duck away: uCam is where you are, and each
// instance shrinks toward its base when you are within reach
function ducking(mat, shared, cam, reach, key) {
	mat.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uCam = { value: cam };
		sh.vertexShader = 'uniform float uTime; uniform vec3 uCam;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			{
				vec3 ip = vec3(instanceMatrix[3]);
				float k = smoothstep(${(reach * 0.5).toFixed(2)}, ${reach.toFixed(2)}, distance(ip, uCam));
				transformed.y *= mix(0.08, 1.0, k);
				transformed.xz *= mix(0.5, 1.0, k);
				transformed.x += sin(uTime * 1.3 + ip.x + position.y * 3.0) * 0.06 * position.y * k;
			}`);
	};
	mat.customProgramCacheKey = () => 'duck' + key;
}

export function createInverts(eco, island, shared, scene, camera, bommies = []) {
	const bay = island.village.bay;
	const group = new THREE.Group();
	group.name = 'crysis-inverts';
	scene.add(group);
	if (!bay) return { update() {}, group };
	const r = mulberry32(island.seed ^ 0x1a7e);
	const H = (x, z) => island.heightAt(x, z);
	const onSand = () => {
		for (let i = 0; i < 40; i++) {
			const a = r() * 6.283, t = 0.25 + r() * 0.95, x = bay.x + Math.cos(a) * t * bay.r, z = bay.z + Math.sin(a) * t * bay.r, h = H(x, z);
			if (h < -1.8 && h > -18 && !bommies.some((b) => Math.hypot(b.x - x, b.z - z) < b.R * 0.9)) return { x, z, h };
		}
		return null;
	};
	const nearHead = (pad) => {
		const b = bommies[Math.floor(r() * bommies.length)]; if (!b) return null;
		const a = r() * 6.283, d = b.R * (0.9 + r() * pad), x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, h = H(x, z);
		return h < -1.8 ? { x, z, h } : null;
	};
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
	const inst = (geo, mat, list, fn) => {
		if (!list.length) return null;
		const im = new THREE.InstancedMesh(geo, mat, list.length);
		list.forEach((o, i) => { fn(o, e, sc); q.setFromEuler(e); p.set(o.x, o.h, o.z); im.setMatrixAt(i, m4.compose(p, q, sc)); if (o.c) im.setColorAt(i, o.c); });
		im.computeBoundingSphere();
		im.receiveShadow = true;
		im.userData.material175 = 'crystal';
		group.add(im);
		return im;
	};
	const tint = (c) => hsl(c).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.08);
	const camV = camera.position;
	let jellies = null, jellyState = [];

	for (const g of eco.inverts) {
		if (g.form === 'starfish') {
			const L = [];
			for (let i = 0; i < 70; i++) { const s = r() < 0.6 ? onSand() : nearHead(0.4); if (s) L.push({ ...s, h: s.h + 0.02, s: 0.12 * g.size * (0.7 + r() * 0.6), c: tint(g.colour) }); }
			inst(starGeo(g.arms), new THREE.MeshStandardMaterial({ roughness: 0.8 }), L, (o, e2, s2) => { e2.set((r() - 0.5) * 0.2, r() * 6.28, (r() - 0.5) * 0.2); s2.setScalar(o.s); });
		} else if (g.form === 'cucumber') {
			const geo = new THREE.CapsuleGeometry(0.06, 0.28, 4, 8).rotateZ(Math.PI / 2);
			const L = [];
			for (let i = 0; i < 40; i++) { const s = onSand(); if (s) L.push({ ...s, h: s.h + 0.04, s: g.size * (0.7 + r() * 0.6), c: tint(g.colour) }); }
			const mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
			inst(geo, mat, L, (o, e2, s2) => { e2.set(0, r() * 6.28, (r() - 0.5) * 0.2); s2.set(o.s, o.s * 0.8, o.s); });
		} else if (g.form === 'clam') {
			// two fluted shells slightly open, the mantle between them glowing blue-green
			const shell = new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
			{ const pp = shell.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), a = Math.atan2(z, x); pp.setXYZ(i, x * 1.3, pp.getY(i) * 0.5 * (1 + 0.15 * Math.sin(a * 7)), z * 0.7); } shell.computeVertexNormals(); }
			const mantle = new THREE.PlaneGeometry(0.46, 0.06, 6, 1).rotateX(-Math.PI / 2).translate(0, 0.06, 0);
			const L = [];
			for (let i = 0; i < 26; i++) { const s = nearHead(0.2); if (s) L.push({ ...s, s: g.size * (0.7 + r() * 0.8), c: tint(g.colour) }); }
			const place = (o, e2, s2) => { e2.set(0, (o.x * 7.1) % 6.28, 0); s2.setScalar(o.s); };
			inst(shell, new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.7 }), L.map((o) => ({ ...o, c: null })), place);
			const mm = new THREE.MeshStandardMaterial({ roughness: 0.3, emissive: 0x000000, side: THREE.DoubleSide });
			mm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.35;'); };
			mm.customProgramCacheKey = () => 'clammantle';
			inst(mantle, mm, L, place);
		} else if (g.form === 'duster') {
			// a feathery crown on a short tube: a cone of fine plumes
			const P = [], I = [], N = 14;
			for (let k = 0; k < N; k++) {
				const a = k / N * Math.PI * 2, b = P.length / 3;
				P.push(0, 0.12, 0, Math.cos(a) * 0.13, 0.28, Math.sin(a) * 0.13, Math.cos(a + 0.2) * 0.13, 0.28, Math.sin(a + 0.2) * 0.13);
				I.push(b, b + 1, b + 2);
			}
			const crown = new THREE.BufferGeometry();
			crown.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); crown.setIndex(I); crown.computeVertexNormals();
			const tube = new THREE.CylinderGeometry(0.018, 0.022, 0.14, 6).translate(0, 0.05, 0);
			const L = [];
			for (let i = 0; i < 90; i++) { const s = nearHead(0.3); if (s) L.push({ ...s, s: g.size * (0.7 + r() * 0.6), c: tint(g.colour) }); }
			const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
			ducking(mat, shared, camV, 2.2, 'duster');
			const fr = (v) => v - Math.floor(v);
			const place = (o, e2, s2) => { e2.set((fr(o.x * 13.1) - 0.5) * 0.4, fr(o.z * 7.3) * 6.28, (fr(o.z * 5.7) - 0.5) * 0.4); s2.setScalar(o.s); };
			inst(crown, mat, L, place);
			inst(tube, new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 }), L.map((o) => ({ ...o, c: null })), place);
		} else if (g.form === 'eel') {
			// a colony: dozens of thin bodies standing out of the sand, swaying, all sinking
			// together as you approach
			const geo = new THREE.CylinderGeometry(0.012, 0.016, 0.45, 5, 4).translate(0, 0.2, 0);
			const L = [];
			for (let c = 0; c < 6; c++) {
				const s = onSand(); if (!s) continue;
				for (let i = 0; i < 30; i++) { const x = s.x + (r() - 0.5) * 5, z = s.z + (r() - 0.5) * 5, h = H(x, z); if (h < -1.8) L.push({ x, z, h, s: g.size * (0.8 + r() * 0.5), c: tint(g.colour) }); }
			}
			const mat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
			ducking(mat, shared, camV, 4.5, 'eel');
			inst(geo, mat, L, (o, e2, s2) => { e2.set(0, r() * 6.28, 0); s2.setScalar(o.s); });
		} else if (g.form === 'jelly') {
			// moon jellies: a translucent bell and trailing threads, pulsing
			const bell = new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
			const mat = new THREE.MeshStandardMaterial({ color: hsl(g.colour), transparent: true, opacity: 0.35, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false, emissive: hsl(g.colour), emissiveIntensity: 0.15 });
			mat.onBeforeCompile = (sh) => {
				sh.uniforms.uTime = shared.uTime;
				sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
					{ float ph = instanceMatrix[3].x * 0.7; float pulse = sin(uTime * 1.6 + ph);
					transformed.xz *= 1.0 + pulse * 0.12 * (1.0 - position.y * 2.0); transformed.y *= 1.0 - pulse * 0.1; }`);
			};
			mat.customProgramCacheKey = () => 'jellybell';
			const n = 40;
			jellies = new THREE.InstancedMesh(bell, mat, n);
			jellies.frustumCulled = false;
			jellies.renderOrder = 3;
			for (let i = 0; i < n; i++) {
				const a = r() * 6.283, t = 0.2 + r() * 0.9, x = bay.x + Math.cos(a) * t * bay.r, z = bay.z + Math.sin(a) * t * bay.r;
				const fl = H(x, z);
				jellyState.push({ p: new THREE.Vector3(x, Math.min(-2, fl + 2 + r() * Math.max(1, -fl - 4)), z), ph: r() * 6.28, s: g.size * (0.6 + r() * 0.6), drift: new THREE.Vector3((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2) });
			}
			group.add(jellies);
		}
	}

	function update(dt, t, active) {
		group.visible = active;
		if (!active || !jellies) return;
		dt = Math.min(dt, 0.05);
		for (let i = 0; i < jellyState.length; i++) {
			const j = jellyState[i];
			// rise on each pulse, sink slowly between; drift with the current
			const pulse = Math.max(0, Math.sin(t * 1.6 + j.p.x * 0.7));
			j.p.y += (pulse * 0.25 - 0.08) * dt;
			j.p.addScaledVector(j.drift, dt);
			const fl = H(j.p.x, j.p.z);
			if (j.p.y > -1.5) j.p.y = -1.5;
			if (j.p.y < fl + 1) j.p.y = fl + 1;
			if (Math.hypot(j.p.x - bay.x, j.p.z - bay.z) > bay.r * 1.2) j.drift.multiplyScalar(-1);
			e.set(Math.sin(t * 0.3 + j.ph) * 0.15, j.ph, Math.cos(t * 0.27 + j.ph) * 0.15); q.setFromEuler(e); sc.setScalar(j.s);
			jellies.setMatrixAt(i, m4.compose(j.p, q, sc));
		}
		jellies.instanceMatrix.needsUpdate = true;
	}
	return { update, group };
}
