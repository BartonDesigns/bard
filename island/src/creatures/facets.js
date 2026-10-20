// The Facet Wraith's look: a dim human figure (a body from the creatures' own models) gone dark
// as a shadow, a magenta light burning in its chest and leaking out at its edges, and round it a
// shell of black obsidian shards turning slowly, close as a cocoon. Now and then (and as it
// strikes) the shell opens, the shards drawn out and apart, and the core shows: the only place a
// blow does it real harm (exposure(), which combat/ai-squads.js weighs every blow by). When it
// strikes, the shards on its near side lash out at you. When it dies they fall.
//
// Made here, not from its sheet: the sheet's shards are loose things, not a skin.

import * as THREE from 'three';
import { GFX_PHONE } from '../world/device.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// one obsidian shard: a long faceted kite, its point at +y, a little crooked
function shardGeometry() {
	const v = [0, 1, 0, 0.42, 0.18, 0.08, -0.08, 0.3, -0.16, -0.38, 0.05, 0.06, 0.05, -0.1, 0.17, 0.04, -1, 0.02];
	const ix = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 5, 2, 1, 5, 3, 2, 5, 4, 3, 5, 1, 4];
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
	g.setIndex(ix);
	return g.toNonIndexed();
}
let kit = null;
function shared() {
	if (kit) return kit;
	const geo = shardGeometry();
	geo.computeVertexNormals();
	const shard = new THREE.MeshStandardMaterial({ color: 0x0c0810, roughness: 0.12, metalness: 0.35, emissive: 0xc0238f, emissiveIntensity: 0.05, flatShading: true });
	kit = { geo, shard };
	return kit;
}

// the core's paint: near black, a rim of magenta light at its edges, the chest burning
function coreMaterial(chest) {
	const m = new THREE.MeshStandardMaterial({ color: 0x120914, roughness: 0.7, metalness: 0 });
	const glow = { value: 1 };
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uChest = { value: new THREE.Vector3(...chest) };
		sh.uniforms.uGlow = glow;
		sh.vertexShader = 'varying vec3 vMP;\n' + sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n\tvMP = transformed;');
		sh.fragmentShader = 'uniform vec3 uChest;\nuniform float uGlow;\nvarying vec3 vMP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		float d = length((vMP - uChest) * vec3(1.0, 1.2, 0.35));
		float heart = exp(-d * d / 0.006) * 5.0 + exp(-d * d / 0.035) * 0.5;
		float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
		totalEmissiveRadiance += vec3(1.0, 0.24, 0.78) * (heart + rim * 0.3) * uGlow;
	}`);
	};
	m.customProgramCacheKey = () => 'facet-core';
	m.userData.glow = glow;
	return m;
}

// dress a creature body (creatures/models.js makeCreature) as a Facet Wraith; returns
// { update(dt, { strike, open, dead }), exposure() }
export function facetLook(c) {
	const K = shared();
	const H = c.meta.height || 1.8;
	const J = c.meta.joints || {};
	const ch = J.chest ? J.chest[1].map((v, i) => (v + J.chest[0][i]) / 2) : [0, H * 0.68, 0];
	const core = coreMaterial(ch);
	c.root.traverse((o) => { if (o.isMesh) { o.material = core; o.castShadow = false; } });
	// (it glows from within: a small light at the heart, not on a phone)
	const light = GFX_PHONE ? null : new THREE.PointLight(0xff3cc8, 2.2, 6, 2);
	if (light) { light.position.set(ch[0], ch[1], ch[2] + 0.1); c.root.add(light); }
	const n = GFX_PHONE ? 40 : 64;
	const mesh = new THREE.InstancedMesh(K.geo, K.shard, n);
	mesh.frustumCulled = false; mesh.castShadow = !GFX_PHONE;
	c.root.add(mesh);
	// each shard's place on the shell (an egg round the body: wider at the shoulders), its turn,
	// its size and how it bobs
	const sh = [];
	for (let i = 0; i < n; i++) {
		// (spread evenly over the shell: a Fibonacci sphere)
		const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996 + Math.random() * 0.3;
		const len = (0.2 + Math.random() * 0.16) * H * (1 - Math.abs(y) * 0.45);
		sh.push({ dir: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), len, roll: Math.random() * TAU, tilt: (Math.random() - 0.5) * 1.2, ph: Math.random() * TAU, sp: 0.5 + Math.random(), lash: 0, fall: null });
	}
	const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _e = new THREE.Euler();
	let t = 0, open = 0, openT = 3 + Math.random() * 3, openK = 0, deadT = -1;
	const rx = H * 0.3, ry = H * 0.55, rz = H * 0.25, cy = H * 0.52;
	function update(dt, { strike = -1, alert = false, dead = false } = {}) {
		t += dt;
		// open now and then on its own while it fights, and as it strikes
		openT -= dt;
		if (openT <= 0) { openK = openK > 0 ? 0 : 1.6; openT = openK > 0 ? openK : (alert ? 3.5 : 6) + Math.random() * 3; }
		const want = Math.max(openK > 0 && openT > 0 ? 1 : 0, strike >= 0 ? Math.sin(Math.PI * clamp(strike / 0.8, 0, 1)) : 0);
		open += (want - open) * Math.min(1, dt * 4);
		if (dead && deadT < 0) deadT = 0;
		if (deadT >= 0) deadT += dt;
		if (core.userData.glow) core.userData.glow.value = deadT >= 0 ? Math.max(0, 1 - deadT / 1.5) : 0.75 + open * 0.6 + Math.sin(t * 3) * 0.1;
		if (light) light.intensity = core.userData.glow.value * 2.2;
		const spin = t * 0.35;
		const lash = strike >= 0 ? smooth((strike - 0.3) / 0.1) * (1 - smooth((strike - 0.55) / 0.3)) : 0;
		for (let i = 0; i < n; i++) {
			const s = sh[i];
			const a = spin * (i % 2 ? 1 : -0.6);
			const ca = Math.cos(a), sa = Math.sin(a);
			const dx = s.dir.x * ca - s.dir.z * sa, dz = s.dir.x * sa + s.dir.z * ca, dy = s.dir.y;
			const k = 1 + open * (0.75 + 0.25 * Math.sin(s.ph)) + Math.sin(t * s.sp + s.ph) * 0.04;
			_p.set(dx * rx * k, cy + dy * ry * (1 + open * 0.35) + Math.sin(t * s.sp * 1.3 + s.ph) * 0.03 * H, dz * rz * k);
			// (the ones in front lash out as it strikes)
			if (lash > 0 && dz > 0.2) _p.z += lash * (0.8 + dz) * H * 0.55;
			if (deadT >= 0) {
				// they fall, tumbling, and lie
				if (!s.fall) s.fall = { y: _p.y, v: 0, sx: (Math.random() - 0.5) * 2, sz: (Math.random() - 0.5) * 2 };
				s.fall.v += 9.8 * dt; s.fall.y = Math.max(0.05, s.fall.y - s.fall.v * dt);
				_p.x += s.fall.sx * Math.min(1, deadT) * 0.5; _p.z += s.fall.sz * Math.min(1, deadT) * 0.5; _p.y = s.fall.y;
			}
			// lying along the shell, pointing round it, each a little crooked
			// lying on the shell, pointing up and over it along its curve, each a little crooked, its
			// flat face outward
			_t.set(dx, 0, dz);
			const yaw = Math.atan2(_t.x, _t.z);
			_q.setFromEuler(_e.set(-dy * 0.9 + s.tilt * 0.5, yaw, s.tilt + Math.sin(t * 0.3 * s.sp + s.ph) * 0.08 + (deadT >= 0 ? Math.min(1, deadT) * 1.4 : 0), 'YXZ'));
			_q2.setFromAxisAngle(_up, s.roll * 0.3);
			_q.multiply(_q2);
			_s.setScalar(s.len * 0.5);
			mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
		}
		mesh.instanceMatrix.needsUpdate = true;
	}
	update(0);
	// how much of a blow reaches it: hardly any through the closed shell, all of it when open
	const exposure = () => 0.12 + 0.88 * smooth(open / 0.7);
	return { update, exposure, reset() { deadT = -1; open = 0; openK = 0; for (const s of sh) s.fall = null; } };
}
