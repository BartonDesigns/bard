// The Double Shot: a 125-foot tower with a ring of seats round its foot. A hiss, and the
// air shoots the ring up the tower at four g; over the top you float off the seat, fall,
// are caught and shot up again, and let down gently to the ground. Shoulder bars hold you;
// the whole Boardwalk and the bay lie below at the top.

import * as THREE from 'three';
import { DECK, merger, bulbs, signBoard } from './kit.js';

const TOP = 38, G = 9.81;

export function createDrop({ group, sound, isPhone, at: [U, V] }) {
	const root = new THREE.Group();
	root.name = 'double-shot';
	root.position.set(U, 0, V);
	group.add(root);
	const Mg = merger(), lights = bulbs();
	// the tower: a square mast, its cap, the base with the fence round it
	Mg.box(1.5, TOP + 2, 1.5, 'white', 0, DECK + (TOP + 2) / 2, 0);
	for (let y = 2; y < TOP; y += 2.5) for (const [x, z, ry] of [[0.76, 0, 0], [-0.76, 0, 0], [0, 0.76, Math.PI / 2], [0, -0.76, Math.PI / 2]]) Mg.box(0.04, 3.2, 0.04, 'steel', x, DECK + y, z, 0.8, ry);
	Mg.box(2.6, 1.6, 2.6, 'red', 0, DECK + TOP + 2.8, 0).geo(new THREE.ConeGeometry(1.9, 1.6, 4), 'yellow', 0, DECK + TOP + 4.4, 0, 0, Math.PI / 4);
	Mg.cyl(4.2, 4.6, 0.5, 'concrete', 0, DECK + 0.25, 0, 24);
	for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.2) continue; Mg.box(0.05, 1.1, 0.05, 'chrome', Math.sin(a) * 6, DECK + 0.55, Math.cos(a) * 6); }
	for (let y = 3; y < TOP + 2; y += 0.8) for (const [x, z] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) lights.add(x, DECK + y, z, [0.55, 0.8, 1]);
	Mg.done(root, { shadow: !isPhone });
	const sign = signBoard('DOUBLE SHOT', 3.2, 0.8, { bg: '#1e3c8c', fg: '#ffe066', border: '#ffffff', glow: 0.3 });
	sign.position.set(0, DECK + TOP + 2.8, 1.32);
	root.add(sign);
	const lit = lights.done(root, 0.8);
	// the ring of seats: four a side, facing out, shoulder bars down
	const ring = new THREE.Group();
	root.add(ring);
	{
		const C = merger();
		C.box(3.2, 0.9, 3.2, 'darksteel', 0, 0.45, 0);
		for (let s = 0; s < 4; s++) {
			const a = s * Math.PI / 2;
			for (let k = 0; k < 4; k++) {
				const off = (k - 1.5) * 0.7, x = Math.sin(a) * 1.9 + Math.cos(a) * off, z = Math.cos(a) * 1.9 - Math.sin(a) * off;
				C.box(0.55, 0.1, 0.45, 'seat', x, 0.05, z, 0, a).box(0.55, 0.9, 0.12, 'seat', x - Math.sin(a) * 0.25, 0.5, z - Math.cos(a) * 0.25, 0, a);
				for (const sd of [-0.2, 0.2]) C.rod([x - Math.sin(a) * 0.2 + Math.cos(a) * sd, 1.0, z - Math.cos(a) * 0.2 - Math.sin(a) * sd], [x + Math.sin(a) * 0.12 + Math.cos(a) * sd, 0.35, z + Math.cos(a) * 0.12 - Math.sin(a) * sd], 0.04, 'black');
			}
		}
		C.done(ring, { shadow: !isPhone });
	}
	// ---------- the shot: a script of launches, falls, catches ----------
	const S = { y: 0, v: 0, phase: 'wait', t: 6, rider: false, done: false, shots: 0, prevA: 0 };
	function step(dt) {
		S.t -= dt;
		const p = S.phase;
		if (p === 'wait') { S.v = 0; S.y = 0; if (S.t <= 0) { S.phase = 'launch'; S.shots = 0; whoosh(); } }
		else if (p === 'launch') {
			// the air: four g up the first eight metres (then less on the second shot)
			const a = (S.shots ? 2.2 : 3.4) * G;
			S.v += a * dt;
			if (S.y > (S.shots ? 5 : 8)) S.phase = 'fly';
		} else if (p === 'fly') {
			S.v -= G * dt;
			if (S.y > TOP - 1) { S.y = TOP - 1; S.v = Math.min(0, S.v); }
			if (S.v < 0 && S.y < (S.shots ? 4 : 12)) S.phase = 'catch';
		} else if (p === 'catch') {
			S.v += (0 - S.v) * Math.min(1, dt * 3.5) + 1.2 * G * dt;
			if (S.v > -0.3) { S.shots++; if (S.shots < 2) { S.phase = 'launch'; whoosh(); } else { S.phase = 'down'; } }
		} else if (p === 'down') {
			S.v = -Math.min(1.2, S.y * 0.5 + 0.1);
			if (S.y <= 0.01) { S.y = 0; S.v = 0; S.phase = 'wait'; S.t = S.rider ? 0 : 20 + Math.random() * 10; if (S.rider) S.done = true; }
		}
		S.y = Math.max(0, S.y + S.v * dt);
		ring.position.y = DECK + 0.6 + S.y;
	}
	let hear = 1;
	function whoosh() {
		const k = hear;
		if (k < 0.02) return;
		for (let i = 0; i < 6; i++) sound.click(0.25 * k, 900 + i * 500, 0.8, 0.35, i * 0.05);
		for (let i = 0; i < 4; i++) setTimeout(() => sound.scream(0.12 * k, 600 + Math.random() * 500, 1.5), 300 + i * 150);
	}
	const eye = new THREE.Vector3(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
	let seatA = 0, gl = 0;
	function pose(dt, t, out) {
		const v0 = S.v;
		step(dt);
		const a = (S.v - v0) / Math.max(dt, 1e-3);
		gl += (a / G - gl) * Math.min(1, dt * 8);
		// your seat: on the side facing the sea, second from the left
		const x = Math.sin(seatA) * 2.0 + Math.cos(seatA) * -0.35, z = Math.cos(seatA) * 2.0 - Math.sin(seatA) * -0.35;
		eye.set(x, ring.position.y + 0.9 - Math.max(-0.08, Math.min(0.08, gl * 0.03)), z).applyMatrix4(root.matrix);
		out.pos.copy(eye);
		const sh = S.phase === 'launch' || S.phase === 'catch' ? 0.012 : 0.002;
		out.pos.x += Math.sin(t * 43) * sh; out.pos.y += Math.sin(t * 57) * sh;
		out.quat.setFromAxisAngle(Y, seatA + Math.PI).multiply(q.setFromAxisAngle(X, -0.25 - (S.phase === 'fly' && S.v < 0 ? 0.25 : 0)));
		out.fov = 78;
		return !S.done;
	}
	const riders = {
		count: 16,
		at(i, m) {
			const s = Math.floor(i / 4), k = i % 4;
			if (S.rider && s === 0 && k === 1) return null;
			if ((i * 7) % 3 === 0) return null;
			const a = s * Math.PI / 2 + seatA, off = (k - 1.5) * 0.7;
			m.makeRotationY(a).setPosition(Math.sin(a) * 1.95 + Math.cos(a) * off, ring.position.y - 0.4, Math.cos(a) * 1.95 - Math.sin(a) * off);
			return m.premultiply(root.matrix);
		},
		sit: 0.45, pose: 'lap',
	};
	return {
		id: 'drop', name: 'Double Shot', icon: 'drop', root,
		blurb: 'Shot 125 feet up the tower, and down again twice',
		board: { u: U, v: V + 6.8, r: 2.6 }, exit: { u: U + 1.2, v: V + 7.5, yaw: 0 },
		lights: lit,
		solid: [], round: [[U, V, 5.9]],
		update(dt, t, info) { hear = Math.max(0, 1 - info.near / 200); if (!S.rider) step(dt); },
		begin() { S.rider = true; S.done = false; S.phase = 'wait'; S.t = 4; S.y = 0; S.v = 0; hear = 1; return true; },
		pose, riders,
		status() { return S.phase === 'wait' ? 'Shoulder bars down…' : `${Math.round(S.y * 3.28)} ft`; },
		end() { S.rider = false; S.done = false; },
		dispose() { root.traverse((o) => o.geometry?.dispose()); },
	};
}
