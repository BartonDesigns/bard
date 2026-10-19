// Birds flushed by gunfire: a shot or a blast nearby and a flock bursts out of the trees round
// it, a whirr of wings, scattering up and away from the noise, then gathering into a loose
// flock that climbs off over the land and is gone. A place that has just been emptied stays
// quiet a while (no birds left to flush), so a long firefight sends up a few flocks, not a
// stream.
//
// One instanced mesh for every bird (a body and two wings that beat in the vertex shader, fast
// as they burst out, slower once they are away); the CPU moves each flock as a few dozen points.
// noise(p, loud): something loud at p (loud 0..1: a pistol shot ~0.5, a blast 1).

import * as THREE from 'three';
import { soundBus, noise as noiseBuf } from './soundbus.js';

const CELL = 70, QUIET = 50;

export function createFlush(scene, shared, { isPhone = false, heightAt = () => 0, vegetation = null } = {}) {
	const N = isPhone ? 36 : 72, PER = isPhone ? 14 : 24;
	// a dark bird the size of a crow or a pigeon (the model is starling-sized, drawn ~1.8x): a body wedge and two swept wings (aWing: which side)
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute([
		// the body, flat and on edge (so it reads from the side as well as from below), and the tail
		0, 0, 0.17, 0.04, 0.01, -0.06, -0.04, 0.01, -0.06,
		0, 0.035, 0.1, 0, -0.035, 0.0, 0, 0.02, -0.12,
		0, 0, -0.04, 0.05, 0, -0.2, -0.05, 0, -0.2,
		// the wings: broad at the shoulder, swept back to the tip
		0.03, 0, 0.07, 0.03, 0, -0.07, 0.31, 0.01, -0.12,
		0.03, 0, 0.07, 0.31, 0.01, -0.12, 0.3, 0.01, -0.02,
		-0.03, 0, 0.07, -0.31, 0.01, -0.12, -0.03, 0, -0.07,
		-0.03, 0, 0.07, -0.3, 0.01, -0.02, -0.31, 0.01, -0.12,
	], 3));
	g.setAttribute('aWing', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1], 1));
	g.computeVertexNormals();
	const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x1d1c1f, side: THREE.DoubleSide }), N);
	const aBeat = new Float32Array(N), aPh = new Float32Array(N);
	for (let i = 0; i < N; i++) aPh[i] = Math.random() * 6.28;
	g.setAttribute('aBeat', new THREE.InstancedBufferAttribute(aBeat, 1));
	g.setAttribute('aPh', new THREE.InstancedBufferAttribute(aPh, 1));
	im.material.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime;
		sh.vertexShader = 'attribute float aWing, aBeat, aPh; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
			#include <begin_vertex>
			// (aBeat: how fast and how hard: a frantic beat bursting out, an easy one once away)
			transformed.y += aWing * sin(uTime * (9.0 + aBeat * 14.0) + aPh) * (0.25 + aBeat * 0.35) * abs(transformed.x) * 3.5;`);
	};
	im.material.customProgramCacheKey = () => 'flush-birds';
	im.frustumCulled = false;
	im.name = 'flushed-birds';
	im.count = 0;
	scene.add(im);

	const birds = Array.from({ length: N }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: 0, f: null, s: 1 }));
	const flocks = [];
	const quiet = new Map();
	let clock = 0;
	const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _z = new THREE.Matrix4().makeScale(0, 0, 0);

	// the island's trees, from the vegetation index (cells of 64 m: crysis/landfauna.js reads it the same way)
	const treeSp = (vegetation?.species || []).filter((sp) => sp.tree);
	function trees(x, z, R) {
		const out = [], cells = vegetation?.cells;
		if (!cells || !treeSp.length) return out;
		const ci = Math.floor(x / 64), cj = Math.floor(z / 64), cr = Math.ceil(R / 64);
		for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
			const c = cells.get(i + ',' + j);
			if (!c) continue;
			for (const sp of treeSp) for (const it of c.items?.[sp.key] || []) {
				const d = Math.hypot(it.x - x, it.z - z);
				if (d < R && d > 12) out.push({ x: it.x, z: it.z, top: (it.y ?? heightAt(it.x, it.z)) + (sp.variants?.[it.v]?.height || 10) * (it.scale || 1) * 0.75 });
			}
		}
		return out;
	}
	// where they roost: a crown near the noise if the trees are known, else the land round it
	function roost(p) {
		const t = trees(p.x, p.z, 70);
		if (t.length) { const o = t[(Math.random() * t.length) | 0]; return new THREE.Vector3(o.x, o.top, o.z); }
		for (let k = 0; k < 8; k++) {
			const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 45, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, h = heightAt(x, z);
			if (Number.isFinite(h) && h > 0.8) return new THREE.Vector3(x, h + 7 + Math.random() * 6, z);
		}
		return null;
	}

	function whirr(at, cam, n) {
		try {
			const B = soundBus(); if (!B || !cam) return;
			const d = at.distanceTo(cam); if (d > 160) return;
			const ctx = B.ctx, t = ctx.currentTime + d / 343, len = 0.9 + n * 0.02;
			const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, 'pink'); s.loop = true;
			const bq = ctx.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = 900; bq.Q.value = 0.7;
			const g = ctx.createGain(), peak = 0.22 * Math.min(1, 12 / (12 + d));
			// the wingbeats: a rapid flutter that eases off as they get away
			g.gain.setValueAtTime(0.0001, t);
			for (let k = 0; k < 16; k++) { const tk = t + k * len / 16, a = peak * (1 - k / 18); g.gain.linearRampToValueAtTime(a, tk + 0.012); g.gain.linearRampToValueAtTime(a * 0.25, tk + len / 32); }
			g.gain.linearRampToValueAtTime(0.0001, t + len + 0.05);
			s.connect(bq); bq.connect(g); g.connect(B.out);
			s.start(t, Math.random() * 2); s.stop(t + len + 0.1);
			s.onended = () => { s.disconnect(); bq.disconnect(); g.disconnect(); };
		} catch { /* no audio */ }
	}

	function noise(p, loud = 0.6, cam = null) {
		const key = Math.floor(p.x / CELL) + ',' + Math.floor(p.z / CELL);
		if ((quiet.get(key) ?? -1e9) > clock || flocks.length >= 3) return false;
		// not every shot finds birds near: more likely the louder it is
		if (Math.random() > 0.35 + loud * 0.5) { quiet.set(key, clock + 6); return false; }
		const r = roost(p);
		if (!r) return false;
		quiet.set(key, clock + QUIET);
		const free = birds.filter((b) => !b.on);
		const n = Math.min(free.length, Math.round(PER * (0.5 + Math.random() * 0.5)));
		if (n < 4) return false;
		// away from the noise, and up
		const away = new THREE.Vector3(r.x - p.x, 0, r.z - p.z);
		if (away.lengthSq() < 1) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
		away.normalize();
		const F = { dir: away.clone(), c: r.clone(), age: 0, n };
		flocks.push(F);
		for (let k = 0; k < n; k++) {
			const b = free[k];
			b.on = true; b.f = F; b.age = -Math.random() * 0.35; b.life = 18 + Math.random() * 8; b.s = 1.5 + Math.random() * 0.6;
			b.p.set(r.x + (Math.random() - 0.5) * 6, r.y + (Math.random() - 0.5) * 3, r.z + (Math.random() - 0.5) * 6);
			// the burst: every which way, mostly up and away
			b.v.set((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6).addScaledVector(away, 4);
		}
		whirr(r, cam, n);
		return true;
	}

	function update(dt, camera) {
		dt = Math.min(dt, 0.1);
		clock += dt;
		for (const F of flocks) {
			F.age += dt;
			// the flock's own heading: away, climbing to ~40 m over the land, swinging a little
			F.c.addScaledVector(F.dir, 11 * dt);
			F.dir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.sin(F.age * 0.6) * 0.15 * dt);
			const floor = Math.max(0, heightAt(F.c.x, F.c.z) || 0);
			F.c.y += (Math.max(floor + 40, F.c.y) - F.c.y) * Math.min(1, dt * 0.6) + 1.2 * dt;
		}
		let i = 0;
		for (const b of birds) {
			if (!b.on) continue;
			b.age += dt;
			const F = b.f;
			if (b.age > 0) {
				// first the scatter, then each one falls in with the flock
				const join = Math.min(1, Math.max(0, (b.age - 0.6) / 2.5));
				const want = _s.copy(F.c).sub(b.p).multiplyScalar(0.9).addScaledVector(F.dir, 11);
				b.v.lerp(want, join * Math.min(1, dt * 2.2));
				if (join < 1) b.v.y -= 2.5 * dt * (1 - join);
				b.p.addScaledVector(b.v, dt);
			}
			if (b.age > b.life || (camera && b.p.distanceTo(camera.position) > 260)) { b.on = false; continue; }
			_e.set(-Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z)) * 0.6, Math.atan2(b.v.x, b.v.z), Math.sin(b.age * 3 + aPh[i]) * 0.25);
			_q.setFromEuler(_e);
			_m.compose(b.p, _q, _s.setScalar(b.age > 0 ? b.s : 0));
			im.setMatrixAt(i, _m);
			aBeat[i] = Math.max(0.15, 1 - Math.max(0, b.age) / 4);
			i++;
		}
		for (let k = i; k < im.count; k++) im.setMatrixAt(k, _z);
		im.count = i;
		im.visible = i > 0;
		if (i) { im.instanceMatrix.needsUpdate = true; g.attributes.aBeat.needsUpdate = true; }
		for (let k = flocks.length - 1; k >= 0; k--) if (!birds.some((b) => b.on && b.f === flocks[k])) flocks.splice(k, 1);
		if (quiet.size > 200) for (const [k, t] of quiet) if (t < clock) quiet.delete(k);
	}

	function clear() { for (const b of birds) b.on = false; flocks.length = 0; im.count = 0; im.visible = false; }
	function dispose() { scene.remove(im); g.dispose(); im.material.dispose(); }
	return { mesh: im, noise, update, clear, dispose, info: () => ({ flocks: flocks.length, birds: birds.filter((b) => b.on).length }) };
}
