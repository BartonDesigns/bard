// Shells on the beach you can pick up, turn over in your hand, put back or throw
// into the sea. They lie where the tide leaves them (the strand line and the wet
// band), the same ones in the same places every visit to this island.

import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { waveHeight } from './world/ocean.js';

const KINDS = [
	{ name: 'Tiger cowrie', build: cowrie },
	{ name: 'Scallop', build: scallop },
	{ name: 'Spindle conch', build: conch },
	{ name: 'Cockle', build: cockle },
];

function colorize(g, fn) {
	const p = g.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3();
	for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = fn(v); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; }
	g.setAttribute('color', new THREE.BufferAttribute(c, 3));
	return g;
}
function cowrie(r) {
	// a glossy egg, flat underneath with a toothed slit, cream with brown spots
	const g = new THREE.SphereGeometry(1, 24, 16), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		if (y < 0) y *= 0.35;
		const slit = y < 0 ? Math.exp(-x * x * 60) * 0.12 * (0.7 + 0.3 * Math.sin(z * 40)) : 0;
		p.setXYZ(i, x * 0.62, y * 0.5 + slit * 0.5, z);
	}
	g.computeVertexNormals();
	const spots = []; for (let i = 0; i < 38; i++) spots.push([r() * 2 - 1, r(), r() * 2 - 1, 0.1 + r() * 0.12]);
	return colorize(g, (v) => {
		if (v.y < 0) return [0.93, 0.88, 0.8];
		let k = 0; for (const s of spots) { const d = Math.hypot(v.x / 0.62 - s[0], v.z - s[2]); if (d < s[3]) k = 1; }
		const band = 0.5 + 0.5 * Math.sin(v.z * 3);
		return k ? [0.36, 0.22, 0.14] : [0.86 - band * 0.08, 0.74 - band * 0.1, 0.56 - band * 0.1];
	}).scale(0.028, 0.028, 0.028);
}
function scallop(r) {
	// a ribbed fan with ears at the hinge, banded in coral and cream
	const g = new THREE.BufferGeometry(), P = [], I = [], C = [];
	const R = 20, S = 10, hue = r();
	for (let j = 0; j <= S; j++) for (let i = 0; i <= R; i++) {
		const a = (i / R - 0.5) * 1.9, d = j / S;
		const rib = Math.cos(i / R * Math.PI * 18) * 0.05 * d;
		P.push(Math.sin(a) * d, (0.22 * (1 - Math.pow(d - 0.6, 2) * 2) + rib) * d, Math.cos(a) * d);
		const band = 0.5 + 0.5 * Math.sin(d * 16);
		C.push(0.92 - band * 0.12 * hue, 0.62 + band * 0.2, 0.5 + band * 0.25);
	}
	for (let j = 0; j < S; j++) for (let i = 0; i < R; i++) { const a = j * (R + 1) + i, b = a + 1, c = a + R + 1, d = c + 1; I.push(a, c, b, b, c, d); }
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
	g.setIndex(I);
	g.computeVertexNormals();
	return g.scale(0.035, 0.035, 0.035);
}
function conch(r) {
	// a spiral: whorls winding to a point, flared lip, pale outside and pink within
	const g = new THREE.BufferGeometry(), P = [], I = [], C = [];
	const T = 60, S = 10;
	for (let j = 0; j <= T; j++) {
		const t = j / T, ang = t * Math.PI * 2 * 3.2, rad = 0.12 + 0.88 * Math.pow(1 - t, 1.3), y = t * 1.6;
		for (let i = 0; i <= S; i++) {
			const b = i / S * Math.PI * 2, rr = rad * (0.5 + 0.18 * Math.cos(b));
			P.push(Math.cos(ang) * rad * 0.6 + Math.cos(ang) * Math.cos(b) * rr * 0.5, y + Math.sin(b) * rr * 0.4, Math.sin(ang) * rad * 0.6 + Math.sin(ang) * Math.cos(b) * rr * 0.5);
			const inner = Math.cos(b) < -0.3 && t < 0.2;
			C.push(...(inner ? [0.95, 0.66, 0.62] : [0.9 - 0.1 * Math.sin(t * 30), 0.84 - 0.12 * Math.sin(t * 30), 0.7]));
		}
	}
	for (let j = 0; j < T; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1; I.push(a, c, b, b, c, d); }
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
	g.setIndex(I);
	g.computeVertexNormals();
	g.rotateZ(Math.PI / 2 - 0.2);
	return g.scale(0.04, 0.04, 0.04);
}
function cockle(r) {
	const g = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), p = g.attributes.position, tone = 0.7 + r() * 0.3;
	for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), rib = 1 + 0.07 * Math.cos(a * 11); p.setXYZ(i, x * rib, p.getY(i) * 0.5, z * rib * 0.85); }
	g.computeVertexNormals();
	return colorize(g, (v) => { const k = 0.5 + 0.5 * Math.sin(Math.hypot(v.x, v.z) * 20); return [0.9 * tone + k * 0.06, 0.8 * tone, 0.68 * tone]; }).scale(0.025, 0.025, 0.025);
}

export function createShells(island, shared, camera, scene, player, dom, hint) {
	const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
	// a touch larger than life so they read from standing height
	const geos = KINDS.map((k, i) => k.build(mulberry32(island.seed + i * 17)).scale(1.7, 1.7, 1.7));
	const CELL = 3, gone = new Set(), live = new Map(), loose = [];
	const shellAt = (ci, cj) => {
		const r = mulberry32((island.seed * 131 + ci * 73856093) ^ (cj * 19349663));
		if (r() > 0.16) return null;
		const x = (ci + r()) * CELL, z = (cj + r()) * CELL, h = island.heightAt(x, z);
		if (h < 0.12 || h > 1.5) return null;
		const cd = island.coastAt ? island.coastAt(x, z) : 0;
		if (cd > 40) return null;
		return { key: ci + ',' + cj, x, z, h, kind: Math.floor(r() * KINDS.length), rot: r() * 6.283, tilt: (r() - 0.5) * 0.5, flip: r() < 0.25 };
	};
	function spawn(s) {
		const m = new THREE.Mesh(geos[s.kind], mat);
		m.position.set(s.x, s.h + 0.012, s.z);
		m.rotation.set(s.flip ? Math.PI : s.tilt, s.rot, s.tilt * 0.5);
		m.castShadow = true; m.userData.shell = s; m.userData.material175 = 'crystal';
		scene.add(m);
		return m;
	}
	let lastX = 1e9, lastZ = 1e9;
	function stream() {
		const P = camera.position;
		if (Math.hypot(P.x - lastX, P.z - lastZ) < 3) return;
		lastX = P.x; lastZ = P.z;
		const R = 26, ci0 = Math.floor((P.x - R) / CELL), ci1 = Math.floor((P.x + R) / CELL), cj0 = Math.floor((P.z - R) / CELL), cj1 = Math.floor((P.z + R) / CELL);
		const want = new Set();
		for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) {
			const s = shellAt(i, j);
			if (!s || gone.has(s.key)) continue;
			want.add(s.key);
			if (!live.has(s.key)) live.set(s.key, spawn(s));
		}
		for (const [k, m] of live) if (!want.has(k)) { scene.remove(m); live.delete(k); }
	}

	// the shell in view that you could reach
	const fwd = new THREE.Vector3(), to = new THREE.Vector3();
	function target() {
		camera.getWorldDirection(fwd);
		let best = null;
		const all = [...live.values(), ...loose.filter((l) => l.resting).map((l) => l.mesh)];
		for (const m of all) {
			to.copy(m.position).sub(camera.position);
			const d = to.length();
			if (d > 2.6) continue;
			const ang = Math.acos(Math.min(1, to.normalize().dot(fwd)));
			if (ang > 0.32) continue;
			if (!best || ang < best.ang) best = { m, ang };
		}
		return best?.m || null;
	}

	// holding: the shell floats in front of you and turns as you drag
	let held = null, savedView = null, drag = null;
	function pick(m) {
		held = m;
		const s = m.userData.shell;
		if (s && live.get(s.key) === m) { live.delete(s.key); gone.add(s.key); }
		const li = loose.findIndex((l) => l.mesh === m); if (li >= 0) loose.splice(li, 1);
		scene.remove(m);
		camera.add(m);
		if (!camera.parent) scene.add(camera);
		m.position.set(0, -0.03, -0.3);
		m.rotation.set(0.5, 0, 0);
		m.scale.setScalar(1);
		savedView = { yaw: player.state.yaw, pitch: player.state.pitch };
		player.state.locked = true;
		hint(`${KINDS[s ? s.kind : m.userData.kind || 0].name}. Drag to turn it over. ${isTouch() ? 'Throw or put it down below.' : 'T throws it, E puts it down.'}`, 5000);
	}
	function releaseHold() {
		camera.remove(held);
		player.state.locked = false;
		player.state.yaw = savedView.yaw; player.state.pitch = savedView.pitch;
		const m = held; held = null;
		return m;
	}
	function putDown() {
		if (!held) return;
		const m = releaseHold();
		camera.getWorldDirection(fwd);
		const x = camera.position.x + fwd.x * 1.1, z = camera.position.z + fwd.z * 1.1;
		m.position.set(x, island.heightAt(x, z) + 0.012, z);
		m.rotation.set(0, Math.random() * 6.28, 0);
		scene.add(m);
		loose.push({ mesh: m, resting: true, v: new THREE.Vector3() });
	}
	function throwIt() {
		if (!held) return;
		const m = releaseHold();
		camera.getWorldDirection(fwd);
		m.position.copy(camera.position).addScaledVector(fwd, 0.4);
		scene.add(m);
		loose.push({ mesh: m, resting: false, v: fwd.clone().multiplyScalar(13).add(new THREE.Vector3(0, 4.5, 0)), spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12) });
	}
	const isTouch = () => matchMedia('(pointer: coarse)').matches;

	// splash rings and droplets where a shell lands in the sea
	const drops = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(90), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.9, depthWrite: false }));
	drops.frustumCulled = false; scene.add(drops);
	const dropV = Array.from({ length: 30 }, () => ({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), t: 9 }));
	function splash(p) {
		for (const d of dropV) { d.p.copy(p); d.v.set((Math.random() - 0.5) * 2.4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 2.4); d.t = 0; }
		plop();
	}
	function plop() {
		const b = window.leadBus227, c = b && b.context;
		if (!c || c.state !== 'running') return;
		const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
		o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.09);
		g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
		o.connect(g).connect(b); o.start(t); o.stop(t + 0.2);
	}

	// drag to turn the shell in your hand
	const onDown = (e) => { if (!held || e.target !== dom.canvas) return; drag = { x: e.clientX, y: e.clientY }; e.stopImmediatePropagation(); };
	const onMove = (e) => { if (!held || !drag) return; held.rotation.y += (e.clientX - drag.x) * 0.012; held.rotation.x += (e.clientY - drag.y) * 0.012; drag.x = e.clientX; drag.y = e.clientY; };
	const onUp = () => { drag = null; };
	dom.canvas.addEventListener('pointerdown', onDown, true);
	addEventListener('pointermove', onMove);
	addEventListener('pointerup', onUp);
	const onKey = (e) => {
		if (window._KEYS_PLAY_ON || e.repeat || e.target.closest?.('input,textarea')) return;
		const k = e.key.toLowerCase();
		if (k === 'e') { if (held) putDown(); else { const t = target(); if (t) pick(t); } }
		else if (k === 't' && held) throwIt();
	};
	addEventListener('keydown', onKey);

	function update(dt, t) {
		stream();
		for (let i = loose.length - 1; i >= 0; i--) {
			const l = loose[i];
			if (l.resting) continue;
			l.v.y -= 9.8 * dt;
			l.mesh.position.addScaledVector(l.v, dt);
			l.mesh.rotation.x += l.spin.x * dt; l.mesh.rotation.y += l.spin.y * dt; l.mesh.rotation.z += l.spin.z * dt;
			const p = l.mesh.position, ground = island.heightAt(p.x, p.z), sea = waveHeight(island, p.x, p.z, t, shared.uWave.value);
			if (p.y < sea && ground < sea - 0.05) { splash(new THREE.Vector3(p.x, sea, p.z)); scene.remove(l.mesh); loose.splice(i, 1); continue; }
			if (p.y < ground + 0.012) { p.y = ground + 0.012; l.resting = true; l.mesh.rotation.set(0, l.mesh.rotation.y, 0); }
		}
		const pos = drops.geometry.attributes.position;
		for (let i = 0; i < dropV.length; i++) {
			const d = dropV[i];
			if (d.t < 1.2) { d.t += dt; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); }
			pos.setXYZ(i, d.p.x, d.t < 1.2 ? d.p.y : -99, d.p.z);
		}
		pos.needsUpdate = true;
		return held ? 'held' : target() ? 'near' : '';
	}
	function dispose() {
		dom.canvas.removeEventListener('pointerdown', onDown, true);
		removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('keydown', onKey);
	}
	return { update, pick: () => { const t = target(); if (t) pick(t); }, putDown, throwIt, holding: () => !!held, dispose, count: () => live.size };
}
