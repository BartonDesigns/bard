// Crysis motion: how people move. Everything here is continuous and critically damped,
// so nothing snaps: speed, heading, lean, gaze and every joint angle pass through
// second-order springs.
//
// Gait: one continuous phase drives both legs (half a cycle apart). A stance foot is
// locked to the ground in the world (no sliding), then lifts, swings on a smooth arc
// and lands heel first where the body will be; two-bone IK places it, the knee
// pointing where the foot goes. Stride and cadence follow speed as in real walking;
// past a brisk walk the stance shortens and it becomes a run, with flight, bent arms
// and a forward lean. The pelvis bobs twice a cycle, rolls down on the swing side,
// turns with the stride and shifts over the stance foot; the chest counter-rotates;
// the arms swing opposite the legs from relaxed shoulders with lagging elbows; the head
// stays level and looks where it wants to, the eyes leading. Standing, people breathe,
// shift their weight, glance about, blink, and take a small step when their feet are
// out from under them. Talking adds mouth, nods and hand gestures.

import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// a critically damped spring on a number (or on each component of an array)
class Spring {
	constructor(v = 0, freq = 4) { this.v = v; this.dv = 0; this.w = freq * TAU; }
	to(target, dt) {
		const w = this.w, x = this.v - target, e = Math.exp(-w * dt);
		const v2 = (x + (this.dv + w * x) * dt) * e + target;
		this.dv = (this.dv - (this.dv + w * x) * w * dt) * e;
		this.v = v2;
		return v2;
	}
}
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

export function createMotion(P, groundAt) {
	const { bones, map, rest, dna } = P;
	const B = (n) => bones[map[n]];
	const H = (n) => rest.heads[map[n]];
	const g = dna.gait;
	const S = {
		pos: new THREE.Vector3(), heading: 0, want: { speed: 0, heading: 0, run: 0 },
		speed: new Spring(0, 1.1), yaw: new Spring(0, 1.4), run: new Spring(0, 0.8),
		phase: Math.random(), look: { target: null, yaw: new Spring(0, 2.2), pitch: new Spring(0, 2.2), eyeYaw: new Spring(0, 6), eyePitch: new Spring(0, 6), idleT: 0, idleYaw: 0, idlePitch: 0 },
		lean: new Spring(0, 1.5), turnLean: new Spring(0, 1.5), armL: new Spring(0, 2.5), armR: new Spring(0, 2.5), elbow: new Spring(0.3, 2),
		hipY: new Spring(0, 3), sway: new Spring(0, 1.8), breath: Math.random() * 10, shiftT: Math.random() * 10,
		blink: 0, nextBlink: 1 + Math.random() * 4, talk: 0, talkT: 0, gesture: new Spring(0, 1.5), nod: new Spring(0, 3),
		legs: [0, 1].map((i) => ({ side: i ? -1 : 1, name: i ? 'R' : 'L', planted: true, inSwing: false, lock: new THREE.Vector3(), from: new THREE.Vector3(), phase: 0, init: false })),
		mood: Math.random(),
	};
	const legLen = H('upperleg01.L').y - H('foot.L').y;
	const hipRest = H('upperleg01.L').y;
	const ankleH = H('foot.L').y;
	const hipHalf = Math.abs(H('upperleg01.L').x);
	const footRestDir = rest.dirs[map['foot.L']].clone();
	// each finger curls toward its palm
	const curlAxis = {};
	for (const side of ['L', 'R']) {
		const w = H('wrist.' + side), n = H('finger2-1.' + side).clone().sub(w).cross(H('finger5-1.' + side).clone().sub(w)).normalize();
		if (n.x * (side === 'R' ? -1 : 1) > 0) n.negate();
		for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) { const i = map['finger' + f + '-' + j + '.' + side]; if (i !== undefined) curlAxis[i] = rest.dirs[i].clone().cross(n).normalize(); }
	}

	// world rotations we build top-down; local = inverse(parent world) * world
	const worldQ = bones.map(() => new THREE.Quaternion());
	function setWorld(i, q, parentQ) { worldQ[i].copy(q); bones[i].quaternion.copy(_q2.copy(parentQ).invert().multiply(q)); }
	function setLocal(i, q, parentQ) { bones[i].quaternion.copy(q); worldQ[i].copy(parentQ).multiply(q); }
	const aimQ = (restDir, dir, out) => out.setFromUnitVectors(restDir, _v3.copy(dir).normalize());

	// where a leg's foot should be in the world at leg phase u (0 = heel strike)
	function nominal(leg, u, stride, stanceF, out) {
		const fwd = stanceF > 0 ? (u < stanceF ? 0.5 - u / stanceF : -0.5 + (u - stanceF) / (1 - stanceF)) : 0;
		const c = Math.cos(S.heading), s = Math.sin(S.heading);
		const lx = leg.side * hipHalf * 0.92, lz = fwd * stride * stanceF;
		out.set(S.pos.x + lx * c + lz * s, 0, S.pos.z - lx * s + lz * c);
		out.y = groundAt(out.x, out.z);
		return out;
	}

	function update(dt, t, cam) {
		dt = Math.min(dt, 0.05);
		// ---- smoothed intentions ----
		const speed = Math.max(0, S.speed.to(S.want.speed, dt));
		const dh = wrap(S.want.heading - S.yaw.v);
		const heading = S.yaw.to(S.yaw.v + dh, dt);
		const turnRate = S.yaw.dv;
		S.heading = heading;
		// the body moves at the smoothed speed along the smoothed heading
		S.pos.x += Math.sin(heading) * speed * dt; S.pos.z += Math.cos(heading) * speed * dt;
		const run = clamp(S.run.to(S.want.run, dt), 0, 1);
		// gait from speed: real walking cadence and stride; running shortens stance
		const h = P.height;
		const stride = h * (0.42 + 0.26 * Math.min(speed, 2.2)) * g.stride * (1 + run * 0.35);
		const stanceF = 0.62 - 0.26 * run;
		// standing still: a step only when a foot is out from under the body or mid-air
		let rate = speed / Math.max(0.2, stride);
		if (speed < 0.05) {
			let need = false;
			for (const leg of S.legs) { if (!leg.planted) need = true; else { nominal(leg, stanceF * 0.5, 0, stanceF, _v); if (_v.distanceTo(leg.lock) > 0.14) need = true; } }
			rate = need ? 1.3 : 0;
		}
		S.phase = (S.phase + rate * dt) % 1;
		const amp = smooth(speed / 0.9);

		// ---- feet ----
		const feet = [];
		for (const leg of S.legs) {
			const u = (S.phase + (leg.side < 0 ? 0.5 : 0)) % 1;
			if (!leg.init) { nominal(leg, stanceF * 0.5, stride, stanceF, leg.lock); leg.init = true; }
			const target = new THREE.Vector3();
			let lift = 0, pitch = 0;
			if (u < stanceF || rate === 0) {
				if (leg.inSwing) { leg.inSwing = false; leg.planted = true; nominal(leg, rate === 0 ? stanceF * 0.5 : 0, stride, stanceF, leg.lock); }
				target.copy(leg.lock);
				const su = u / stanceF;
				// roll over the foot: heel strike, flat, heel lifting before toe-off
				pitch = rate ? (su < 0.15 ? -0.25 * (1 - su / 0.15) : su > 0.7 ? 0.5 * smooth((su - 0.7) / 0.3) : 0) * amp : 0;
				// never let a locked foot stay out of reach
				const hipW = _v.set(S.pos.x, S.pos.y + hipRest - ankleH, S.pos.z);
				if (target.distanceTo(hipW) > legLen * 1.02 + 0.05) leg.planted = false;          // it must step
			} else {
				if (!leg.inSwing) { leg.inSwing = true; leg.planted = false; leg.from.copy(leg.lock); }
				const su = (u - stanceF) / (1 - stanceF);
				// land where the body will be: predicted from the current motion
				const land = nominal(leg, 0, stride, stanceF, _v2);
				const k = smooth(su);
				target.lerpVectors(leg.from, land, k);
				target.y = groundAt(target.x, target.z);
				lift = Math.sin(su * Math.PI) * (0.07 + 0.08 * amp + 0.1 * run) * (rate ? 1 : 0.6) + Math.max(0, leg.from.y - target.y) * (1 - k);
				target.y += lift;
				pitch = (su < 0.3 ? 0.5 * (1 - su / 0.3) : su > 0.75 ? -0.3 * smooth((su - 0.75) / 0.25) : 0) * amp;
				leg.lock.copy(target);
			}
			feet.push({ leg, target, pitch, u });
		}

		// ---- the body over the feet ----
		const gy = Math.min(groundAt(S.pos.x, S.pos.z), Math.max(feet[0].target.y, feet[1].target.y));
		const bob = (-Math.cos(S.phase * TAU * 2) * 0.018 * g.bounce * amp) * (1 - run) + run * (Math.abs(Math.sin(S.phase * TAU)) - 0.5) * 0.06;
		const crouch = 0.012 + run * 0.05 + (dna.age > 70 ? 0.02 : 0);
		// the pelvis cannot sit higher than the lower foot allows
		const lowFoot = Math.min(feet[0].target.y, feet[1].target.y);
		S.pos.y = S.hipY.to(Math.min(gy, lowFoot + 0.02), dt);
		const hipY = hipRest - crouch + bob;
		// weight over the stance foot; slow sway standing
		S.shiftT += dt;
		const idleSway = (1 - amp) * Math.sin(S.shiftT * 0.35 + S.mood * 5) * 0.025;
		const sway = S.sway.to(Math.sin(S.phase * TAU) * 0.022 * amp * (1 - run * 0.6) + idleSway, dt);
		const lean = S.lean.to(g.posture + 0.04 * amp + 0.16 * run + (dna.age > 70 ? 0.06 : 0), dt);
		const turnLean = S.turnLean.to(clamp(-turnRate * speed * 0.05, -0.12, 0.12), dt);

		// body space: the person's own frame (+z forward)
		P.root.position.copy(S.pos);
		P.root.rotation.set(0, heading, 0);

		// ---- pelvis ----
		const rootI = map.root, rootB = bones[rootI];
		rootB.position.set(rest.heads[rootI].x + sway, rest.heads[rootI].y - hipRest + hipY, rest.heads[rootI].z);
		const pelvisYaw = Math.sin(S.phase * TAU) * 0.09 * amp * (1 + run);
		const pelvisRoll = Math.cos(S.phase * TAU) * 0.045 * amp + idleSway * 1.2 + turnLean;
		_e.set(lean * 0.35, pelvisYaw, pelvisRoll, 'YXZ');
		const rootQ = _q.setFromEuler(_e).clone();
		setLocal(rootI, rootQ, new THREE.Quaternion());

		// ---- legs: two-bone IK in body space ----
		const inv = new THREE.Matrix4().copy(P.root.matrixWorld).invert();
		P.root.updateMatrixWorld(true);
		inv.copy(P.root.matrixWorld).invert();
		const rootPos = rootB.position;
		for (const f of feet) {
			const s = f.leg.name;
			const iT = map['upperleg01.' + s], iS = map['lowerleg01.' + s], iF = map['foot.' + s];
			const hip = _v.copy(rest.heads[iT]).sub(rest.heads[rootI]).applyQuaternion(rootQ).add(rootPos).clone();
			// the ankle target in body space (the foot's ground contact is below the ankle)
			const A = f.target.clone().applyMatrix4(inv);
			A.y += ankleH * (1 - Math.abs(f.pitch) * 0.2);
			const l1 = rest.heads[iS].distanceTo(rest.heads[iT]), l2 = rest.heads[iF].distanceTo(rest.heads[iS]);
			const toA = A.clone().sub(hip); let dist = toA.length();
			dist = clamp(dist, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.999);
			const dir = toA.normalize();
			// the knee points along the foot, a little out
			const kneeHint = new THREE.Vector3(f.leg.side * 0.12, 0, 1).applyAxisAngle(Y, pelvisYaw * 0.5).normalize();
			const bend = kneeHint.addScaledVector(dir, -kneeHint.dot(dir)).normalize();
			const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
			const knee = hip.clone().addScaledVector(dir, cosA * l1).addScaledVector(bend, Math.sqrt(Math.max(0, 1 - cosA * cosA)) * l1);
			const ankle = hip.clone().addScaledVector(dir, dist);
			const qT = aimQ(rest.dirs[iT], knee.clone().sub(hip), new THREE.Quaternion());
			setWorld(iT, qT, worldQ[rootI]);
			const qS = aimQ(rest.dirs[iS], ankle.clone().sub(knee), new THREE.Quaternion());
			setWorld(iS, qS, worldQ[iT]);
			// the foot: forward, pitched through the roll-over
			const fdir = footRestDir.clone().applyAxisAngle(X, f.pitch);
			fdir.applyAxisAngle(Y, pelvisYaw * 0.3 + f.leg.side * 0.08);
			setWorld(iF, aimQ(footRestDir, fdir, new THREE.Quaternion()), worldQ[iS]);
		}

		// ---- spine: counter-rotation, lean, breath ----
		S.breath += dt * (0.24 + amp * 0.15 + run * 0.3);
		const br = Math.sin(S.breath * TAU);
		const counter = -pelvisYaw * 1.6;
		setLocal(map.spine04, _q.setFromEuler(_e.set(lean * 0.25, counter * 0.3, -pelvisRoll * 0.5)), worldQ[rootI]);
		setLocal(map.spine02, _q.setFromEuler(_e.set(lean * 0.2 + br * 0.01, counter * 0.35, -pelvisRoll * 0.3)), worldQ[map.spine04]);
		setLocal(map.spine01, _q.setFromEuler(_e.set(lean * 0.15 - br * 0.012, counter * 0.35, -pelvisRoll * 0.2)), worldQ[map.spine02]);

		// ---- gaze: head and eyes toward something worth looking at ----
		const L = S.look;
		L.idleT -= dt;
		if (L.idleT <= 0) { L.idleT = 1.5 + Math.random() * 4; L.idleYaw = (Math.random() - 0.5) * (speed > 0.3 ? 0.5 : 1.2); L.idlePitch = (Math.random() - 0.4) * 0.3; }
		let ty = L.idleYaw, tp = L.idlePitch;
		const tgt = L.target || (cam && cam.distanceTo(S.pos) < 7 ? cam : null);
		if (tgt) {
			const dx = tgt.x - S.pos.x, dz = tgt.z - S.pos.z, dy = tgt.y - (S.pos.y + P.height * 0.93);
			const rel = wrap(Math.atan2(dx, dz) - heading);
			if (Math.abs(rel) < 1.8) { ty = clamp(rel, -1.2, 1.2); tp = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.5); }
		}
		// leading into turns
		ty = clamp(ty + turnRate * 0.25, -1.3, 1.3);
		const hy = L.yaw.to(ty, dt), hp = L.pitch.to(tp, dt);
		const chestYaw = counter, chestPitch = lean * 0.6;
		const nod = S.nod.to(S.talk > 0 ? Math.max(0, Math.sin(t * 3.1)) * 0.08 : 0, dt);
		setLocal(map.neck01, _q.setFromEuler(_e.set(hp * 0.4 - chestPitch * 0.5 + nod * 0.4, (hy - chestYaw) * 0.4, pelvisRoll * 0.3, 'YXZ')), worldQ[map.spine01]);
		setLocal(map.head, _q.setFromEuler(_e.set(hp * 0.6 - chestPitch * 0.4 + nod * 0.6 - bob * 0.8, (hy - chestYaw) * 0.6, pelvisRoll * 0.3, 'YXZ')), worldQ[map.neck01]);
		// the eyes lead the head, then settle
		const ey = L.eyeYaw.to(clamp(ty - hy, -0.45, 0.45), dt), ep = L.eyePitch.to(clamp(tp - hp, -0.3, 0.3), dt);
		for (const eye of P.eyes) eye.rotation.set(ep, ey, 0, 'YXZ');

		// ---- arms: relaxed from the shoulders, swinging opposite the legs ----
		const swingA = (0.2 + 0.28 * amp) * g.armSwing * (1 - run * 0.2) + run * 0.35;
		const armL = S.armL.to(-Math.sin(S.phase * TAU) * swingA * amp, dt), armR = S.armR.to(Math.sin(S.phase * TAU) * swingA * amp, dt);
		const elbowBase = S.elbow.to(0.22 + 0.22 * amp + run * 1.1, dt);
		const gesture = S.gesture.to(S.talk > 0 ? 0.5 + 0.4 * Math.sin(t * 1.3 + S.mood * 7) : 0, dt);
		for (const [side, swing] of [['L', armL], ['R', armR]]) {
			const sx = side === 'L' ? 1 : -1;
			const iC = map['clavicle.' + side], iSh = map['shoulder01.' + side], iU = map['upperarm01.' + side], iU2 = map['upperarm02.' + side], iL = map['lowerarm01.' + side], iL2 = map['lowerarm02.' + side], iW = map['wrist.' + side];
			// shoulders ride up a touch as the arm swings forward, and with each breath
			setLocal(iC, _q.setFromEuler(_e.set(0, -swing * 0.08 * sx, (br * 0.01 + Math.max(0, swing) * 0.05) * sx)), worldQ[map.spine01]);
			setLocal(iSh, _q.identity(), worldQ[iC]);
			// the upper arm hangs down and a little out, swinging fore and aft
			const gestureLift = side === (S.mood > 0.5 ? 'R' : 'L') ? gesture : gesture * 0.3;
			const up = new THREE.Vector3(sx * (0.075 + dna.weight * 0.06 + run * 0.08), -1, 0).normalize();
			up.applyAxisAngle(X, -(swing + gestureLift * 0.5));
			// into body-root space: undo the chest's turn so the arm swings along the path
			up.applyAxisAngle(Y, counter * 0.3);
			setWorld(iU, aimQ(rest.dirs[iU], up, new THREE.Quaternion()), worldQ[iSh]);
			setLocal(iU2, _q.identity(), worldQ[iU]);
			// the forearm: the elbow bends forward (more when the arm swings forward)
			const bend = elbowBase + Math.max(0, swing) * 0.4 + gestureLift * 1.1;
			const fore = up.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0).applyAxisAngle(Y, counter * 0.3), -bend);
			fore.x += sx * -0.05 * gestureLift; fore.normalize();
			setWorld(iL, aimQ(rest.dirs[iL], fore, new THREE.Quaternion()), worldQ[iU2]);
			setLocal(iL2, _q.identity(), worldQ[iL]);
			// the hand: continuing the forearm, the palm turned in toward the thigh
			const hand = fore.clone().applyAxisAngle(X, -0.15);
			const qh = aimQ(rest.dirs[iW], hand, new THREE.Quaternion());
			qh.multiply(_q2.setFromAxisAngle(rest.dirs[iW], sx * 0.9));
			setWorld(iW, qh, worldQ[iL2]);
			// relaxed fingers: a gentle curl, the thumb less
			for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) {
				const n = 'finger' + f + '-' + j + '.' + side, i = map[n];
				if (i === undefined) continue;
				const curl = (f === 1 ? 0.15 : 0.28 + j * 0.08 + f * 0.02) * (1 + run * 0.8);
				bones[i].quaternion.setFromAxisAngle(curlAxis[i], curl);
			}
		}

		// ---- the face: blinks, talking ----
		const infl = P.skin.morphTargetInfluences;
		if (infl) {
			S.nextBlink -= dt;
			if (S.nextBlink <= 0) { S.blink = 0.14; S.nextBlink = 1.5 + Math.random() * 5; }
			S.blink = Math.max(0, S.blink - dt);
			infl[0] = S.blink > 0 ? Math.sin((1 - S.blink / 0.14) * Math.PI) : 0;
			if (S.talk > 0) { S.talkT += dt; infl[1] = Math.max(0, Math.sin(S.talkT * 11) * Math.sin(S.talkT * 2.3 + 1)) * 0.35; } else infl[1] *= 0.8;
			infl[2] = 0.15 + S.mood * 0.25 + (S.talk > 0 ? 0.2 : 0);
			infl[3] = S.talk > 0 ? Math.max(0, Math.sin(S.talkT * 1.7)) * 0.4 : 0;
		}
	}
	return { S, update, want: S.want, place(x, y, z, heading) { S.pos.set(x, y, z); S.yaw.v = S.heading = S.want.heading = heading; S.hipY.v = y; for (const l of S.legs) { l.init = false; l.planted = true; l.inSwing = false; } S.speed.v = 0; S.speed.dv = 0; } };
}
