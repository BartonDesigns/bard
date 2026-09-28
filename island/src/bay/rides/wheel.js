// The Ferris wheel on the midway: twin rims on an A-frame, sixteen tubs hanging free on
// their pins, bulbs along every spoke that chase round after dark. It turns slowly, with a
// stop at the bottom for each tub to load; ridden, it takes you up, holds you at the top
// with Monterey Bay laid out in front, and brings you round twice more.

import * as THREE from 'three';
import { DECK, merger, bulbs } from './kit.js';

const R = 12, N = 16, PIN = 2.3, HUB = DECK + PIN + R;
const COLOURS = ['red', 'yellow', 'blue', 'green', 'orange', 'purple', 'teal', 'pink'];
const V3 = () => new THREE.Vector3();

export function createWheel({ group, sound, isPhone, at: [U, V] }) {
	const root = new THREE.Group();
	root.name = 'ferris-wheel';
	root.position.set(U, 0, V);
	// (turned to face the beach: its axle runs out to sea, the platform on the promenade side)
	root.rotation.y = -Math.PI / 2;
	root.updateMatrix();
	group.add(root);
	// the frame (in its own turn): the axle along x, the wheel in the plane across it
	const Mg = merger();
	for (const sx of [-1, 1]) {
		const x = sx * 2.1;
		// the A-frame legs, splayed along the wheel's plane, braced across
		for (const sz of [-1, 1]) Mg.rod([x * 1.5, DECK, sz * 7.5], [x, HUB, 0], 0.22, 'steel', 8);
		Mg.rod([x * 1.35, DECK + 5, -5.6], [x * 1.35, DECK + 5, 5.6], 0.1, 'steel');
		Mg.rod([x * 1.2, DECK + 9.5, -3.2], [x * 1.2, DECK + 9.5, 3.2], 0.09, 'steel');
		Mg.box(1.2, 0.5, 16.5, 'concrete', x * 1.5, DECK + 0.25, 0);
	}
	Mg.cyl(0.32, 0.32, 5.2, 'darksteel', 0, HUB, 0, 14, 0, 0, Math.PI / 2);
	// the loading platform and its rail, the operator's booth, the fence round the base
	Mg.box(3.2, 0.3, 4.2, 'plank', 2.4, DECK + 0.15, 0);
	Mg.box(0.06, 0.06, 4.2, 'chrome', 4.0, DECK + 1.2, 0);
	Mg.box(1.4, 2.2, 1.4, 'white', 4.5, DECK + 1.1, 3.4).box(1.6, 0.12, 1.6, 'red', 4.5, DECK + 2.26, 3.4);
	for (const [a, b] of [[[-5, -9], [-5, 9]], [[-5, 9], [4, 9]], [[-5, -9], [4, -9]], [[4, 2.2], [4, 9]], [[4, -9], [4, -2.2]]]) {
		Mg.box(Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.05, 0.06, 0.06, 'chrome', (a[0] + b[0]) / 2, DECK + 1.0, (a[1] + b[1]) / 2, 0, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
		for (let t = 0; t <= 1; t += 0.2) Mg.box(0.05, 1.0, 0.05, 'chrome', a[0] + (b[0] - a[0]) * t, DECK + 0.5, a[1] + (b[1] - a[1]) * t);
	}
	Mg.done(root, { shadow: !isPhone });

	// the wheel itself: rims, spokes, the cross-ties and pins, the bulbs, all turning together
	const wheel = new THREE.Group();
	wheel.position.set(0, HUB, 0);
	root.add(wheel);
	const W = merger(), lights = bulbs();
	const rimPts = 64;
	for (const x of [-1.1, 1.1]) {
		for (let i = 0; i < rimPts; i++) {
			const a0 = i / rimPts * Math.PI * 2, a1 = (i + 1) / rimPts * Math.PI * 2;
			W.rod([x, Math.sin(a0) * R, Math.cos(a0) * R], [x, Math.sin(a1) * R, Math.cos(a1) * R], 0.09, 'white');
			W.rod([x, Math.sin(a0) * R * 0.55, Math.cos(a0) * R * 0.55], [x, Math.sin(a1) * R * 0.55, Math.cos(a1) * R * 0.55], 0.05, 'white');
		}
		for (let i = 0; i < N; i++) {
			const a = i / N * Math.PI * 2, b = (i + 0.5) / N * Math.PI * 2;
			W.rod([x * 1.9, 0, 0], [x, Math.sin(a) * R, Math.cos(a) * R], 0.06, 'white');
			// the lattice between the spokes
			W.rod([x, Math.sin(a) * R * 0.55, Math.cos(a) * R * 0.55], [x, Math.sin(b) * R, Math.cos(b) * R], 0.035, 'white');
			W.rod([x, Math.sin(b) * R, Math.cos(b) * R], [x, Math.sin(a + Math.PI * 2 / N) * R * 0.55, Math.cos(a + Math.PI * 2 / N) * R * 0.55], 0.035, 'white');
			for (let k = 1; k <= 12; k++) { const r = k / 12 * R; lights.add(x * (1.9 - k / 12 * 0.8) + x * 0.06, Math.sin(a) * r, Math.cos(a) * r, spokeCol(i, k)); }
		}
		for (let i = 0; i < rimPts; i++) { const a = (i + 0.5) / rimPts * Math.PI * 2; lights.add(x * 1.06, Math.sin(a) * (R + 0.12), Math.cos(a) * (R + 0.12), [1, 0.85, 0.55]); }
	}
	for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; W.rod([-1.25, Math.sin(a) * R, Math.cos(a) * R], [1.25, Math.sin(a) * R, Math.cos(a) * R], 0.07, 'steel'); }
	W.done(wheel, { shadow: !isPhone });
	const lit = lights.done(wheel, 0.8);

	// the seats: a bench for two facing out over the bay, a low front with its bar, a canopy
	// on the hanger, each its own colour
	const tubs = [];
	const tubGeo = (col) => {
		const g = new THREE.Group(), T = merger();
		T.box(1.6, 0.1, 1.3, 'plank', 0, -2.0, 0.05);
		for (const sx of [-1, 1]) T.box(0.06, 0.55, 1.3, col, sx * 0.8, -1.7, 0.05);
		T.box(1.6, 0.45, 0.06, col, 0, -1.75, 0.68).box(1.66, 0.05, 0.08, 'chrome', 0, -1.48, 0.68);
		T.box(1.6, 1.0, 0.08, col, 0, -1.45, -0.6);
		T.box(1.5, 0.12, 0.5, 'seat', 0, -1.55, -0.3).box(1.5, 0.55, 0.08, 'seat', 0, -1.2, -0.52);
		// the safety bar across the riders' laps
		T.rod([-0.72, -1.2, 0.12], [0.72, -1.2, 0.12], 0.025, 'chrome').rod([-0.72, -1.2, 0.12], [-0.76, -1.5, -0.2], 0.02, 'chrome').rod([0.72, -1.2, 0.12], [0.76, -1.5, -0.2], 0.02, 'chrome');
		// the hangers up to the pin, the canopy over
		for (const sx of [-1, 1]) T.rod([sx * 0.78, -1.45, -0.55], [sx * 0.72, 0, 0], 0.04, 'chrome');
		T.cyl(0.95, 1.25, 0.3, col, 0, 0.35, 0, 12);
		T.cyl(0.08, 0.08, 1.4, 'darksteel', 0, 0, 0, 8, 0, 0, Math.PI / 2);
		T.done(g, { shadow: !isPhone });
		return g;
	};
	for (let i = 0; i < N; i++) { const t = tubGeo(COLOURS[i % COLOURS.length]); root.add(t); tubs.push({ g: t, swing: 0, sv: 0 }); }

	// ---------- the turning ----------
	const S = { ang: 0, w: 0, target: 0.12, hold: 0, mode: 'run', rider: -1, plan: [], done: false, lastW: 0, chase: 0 };
	const BOTTOM = -Math.PI / 2, STEP = Math.PI * 2 / N;
	const angOf = (i) => S.ang + i * STEP;
	// which tub is nearest the platform now
	const lowest = () => { let best = 0, bd = 9; for (let i = 0; i < N; i++) { const d = Math.abs(Math.atan2(Math.sin(angOf(i) - BOTTOM), Math.cos(angOf(i) - BOTTOM))); if (d < bd) { bd = d; best = i; } } return best; };
	// idle: round and round, a pause each time a tub comes to the platform
	let nextStop = 0;
	function drive(dt) {
		if (S.mode === 'hold') { S.hold -= dt; S.w *= Math.max(0, 1 - dt * 3); if (S.hold <= 0) S.mode = S.plan.length ? 'goto' : 'run'; }
		else if (S.mode === 'goto') {
			// the ride: to the next mark, slowing into it
			const P = S.plan[0], rem = P.to - S.ang;
			const want = Math.sign(rem) * Math.min(0.13, Math.sqrt(Math.abs(rem) * 0.02) + 0.004);
			S.w += (want - S.w) * Math.min(1, dt * 1.5);
			if (Math.abs(rem) < 0.002) { S.ang = P.to; S.w = 0; S.plan.shift(); S.mode = 'hold'; S.hold = P.hold; if (P.last) S.done = true; }
		} else {
			S.w += (0.11 - S.w) * Math.min(1, dt * 0.8);
			nextStop -= dt;
			if (nextStop <= 0) { const i = lowest(); const rem = BOTTOM - angOf(i); const r = Math.atan2(Math.sin(rem), Math.cos(rem)); if (r > 0.02) { S.plan = [{ to: S.ang + r, hold: 4 + Math.random() * 3 }]; S.mode = 'goto'; nextStop = 14 + Math.random() * 10; } }
		}
		const w0 = S.w;
		S.ang += S.w * dt;
		S.alpha = (w0 - S.lastW) / Math.max(dt, 1e-3); S.lastW = w0;
	}
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
	function place(dt) {
		wheel.rotation.x = -S.ang;
		for (let i = 0; i < N; i++) {
			const a = angOf(i), T = tubs[i];
			// free on its pin: it lags the wheel's starts and stops and swings back
			const acc = -(S.alpha || 0) * R * Math.sin(a) * 0.35;
			T.sv += (-9.81 / 1.6 * T.swing - acc / 1.6 - T.sv * 0.9) * dt;
			T.swing += T.sv * dt;
			T.swing = Math.max(-0.35, Math.min(0.35, T.swing));
			T.g.position.set(0, HUB + Math.sin(a) * R, Math.cos(a) * R);
			T.g.rotation.set(T.swing, 0, 0);
		}
	}
	// the lights at night: a chase out along the spokes
	function chase(dt, night) {
		if (!lit || night < 0.05) return;
		S.chase += dt;
		const col = lit.glow.geometry.attributes.color;
		const c = col.array, n = c.length / 3;
		const ph = Math.floor(S.chase * 6);
		for (let k = 0; k < n; k++) {
			const on = (k + ph) % 5 !== 0;
			const base = k % 2 ? [1, 0.55, 0.35] : [0.5, 0.8, 1];
			c[k * 3] = on ? base[0] : 0.1; c[k * 3 + 1] = on ? base[1] : 0.08; c[k * 3 + 2] = on ? base[2] : 0.05;
		}
		col.needsUpdate = true;
	}

	// ---------- riding: the rear bench of the tub at the platform, looking out to sea ----------
	const eye = V3(), tq = new THREE.Quaternion(), cq = new THREE.Quaternion();
	let camInit = false;
	function begin() {
		const i = lowest();
		const rem = Math.atan2(Math.sin(BOTTOM - angOf(i)), Math.cos(BOTTOM - angOf(i)));
		S.rider = i; S.done = false; camInit = false;
		// bring it round to the platform, board, up to the top and hold, round twice, off
		const a0 = S.ang + rem;
		S.plan = [{ to: a0, hold: 3 }, { to: a0 + Math.PI, hold: 10 }, { to: a0 + Math.PI * 4, hold: 0.5, last: true }];
		S.mode = 'goto';
		return true;
	}
	function pose(dt, t, out) {
		drive(dt); place(dt);
		const T = tubs[S.rider];
		m4.compose(T.g.position, q.setFromEuler(T.g.rotation), new THREE.Vector3(1, 1, 1));
		m4.premultiply(root.matrix);
		eye.set(-0.33, -0.7, -0.26).applyMatrix4(m4);
		out.pos.copy(eye);
		tq.setFromRotationMatrix(m4).multiply(q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI + 0.75)).multiply(new THREE.Quaternion().setFromAxisAngle(X, -0.08));
		if (!camInit) { cq.copy(tq); camInit = true; }
		cq.slerp(tq, Math.min(1, dt * 6));
		out.quat.copy(cq);
		out.fov = 70;
		// the creak of the tub on its pin, now and then
		if (Math.abs(T.sv) > 0.05 && Math.random() < dt * 0.6) sound.click(0.05, 400 + Math.random() * 200, 8, 0.2);
		return !S.done || S.hold > 0;
	}
	function status() {
		const T = tubs[S.rider];
		const h = T ? Math.round((T.g.position.y - DECK) * 3.28) : 0;
		if (S.mode === 'hold' && T && T.g.position.y > HUB + R * 0.9) return `At the top · ${h + 10} ft over the sand · Monterey Bay`;
		return `${h} ft`;
	}
	const riders = {
		count: N * 2,
		at(i, m) {
			const k = Math.floor(i / 2), s = i % 2;
			if (k === S.rider && s === 0) return null;
			// not every seat taken
			if ((k * 7 + s * 3) % 5 === 0) return null;
			const T = tubs[k];
			m.compose(T.g.position, q.setFromEuler(T.g.rotation), new THREE.Vector3(1, 1, 1)).premultiply(root.matrix);
			return m.multiply(m4.makeTranslation(s ? 0.35 : -0.35, -1.95, -0.34));
		},
		sit: 0.43, pose: 'lap',
	};
	return {
		id: 'wheel', name: 'Ferris Wheel', icon: 'wheel', root,
		blurb: 'Up over the midway, a stop at the top with the whole bay in front of you',
		board: { u: U, v: V + 4.6, r: 3.2 }, exit: { u: U - 1.2, v: V + 6.8, yaw: Math.PI },
		lights: lit,
		solid: [[U - 9, V - 5, U + 9, V + 3.9]],
		update(dt, t, info) { if (S.rider < 0) { drive(dt); place(dt); } chase(dt, info.night); },
		begin, pose, status, riders,
		end() { S.rider = -1; S.plan = []; S.mode = 'run'; S.done = false; },
		dispose() { root.traverse((o) => o.geometry?.dispose()); },
	};
}
function spokeCol(i, k) { return (i + k) % 3 === 0 ? [1, 0.4, 0.3] : (i + k) % 3 === 1 ? [1, 0.85, 0.5] : [0.5, 0.8, 1]; }
export const WHEEL_HUB = HUB;
