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
// ---------- poses and gestures ----------
// an arm: abd (out from the side), flex (forward), roll (forearm across the body +),
// bend (elbow), pro (palm: 0 to the thigh, + turned up/open), wflex (wrist), curl (0 loose,
// 1 fist), shrug (shoulder up)
const ARM_KEYS = ['abd', 'flex', 'roll', 'bend', 'pro', 'wflex', 'curl', 'shrug'];
const arm = (o) => Object.assign({ abd: 0.06, flex: 0.02, roll: 0, bend: 0.2, pro: 0, wflex: 0.05, curl: 0, shrug: 0 }, o);
function armSprings() { const o = {}; for (const k of ARM_KEYS) o[k] = new Spring(arm({})[k], 2.4); return o; }
// the rig's hands hang palm-back; this turns them palm to thigh (see update)
const PALM0 = 1.45;
// held poses: 'both' for either arm, or 'lead' and 'off' for the leading and other hand;
// swing scales the walk's arm swing, lean the chest, look the head's droop, head its tilt
export const POSES = {
	rest: { both: arm({}) },
	pockets: { both: arm({ abd: 0.12, flex: -0.08, roll: 0.35, bend: 0.55, pro: 0.3, wflex: 0.3, curl: 0.9 }), swing: 0.15 },
	crossed: { lead: arm({ abd: 0.05, flex: 0.6, roll: 1.35, bend: 1.95, pro: 0.3, curl: 0.5 }), off: arm({ abd: 0.08, flex: 0.5, roll: 1.2, bend: 1.8, pro: 0.1, curl: 0.55 }), swing: 0.05, lean: -0.02 },
	behind: { both: arm({ abd: 0.08, flex: -0.45, roll: 1.55, bend: 1.45, pro: -0.6, curl: 0.35 }), swing: 0.05, lean: -0.03 },
	hip: { lead: arm({ abd: 0.5, flex: -0.3, roll: 1.1, bend: 1.7, pro: 0.6, wflex: -0.3, curl: 0.5 }), off: arm({}), swing: 0.4 },
	phone: { lead: arm({ abd: 0.12, flex: 0.45, roll: 0.45, bend: 1.9, pro: 1.35, wflex: -0.25, curl: 0.45 }), off: arm({}), swing: 0.35, look: 0.45 },
	listen: { both: arm({ abd: 0.08, flex: 0.1, roll: 0.35, bend: 0.5, pro: 0.2, curl: 0.3 }), head: 0.08 },
};
// gestures: functions of progress u (0..1), time s (seconds) and size k (temperament);
// arm.lead / arm.off targets, head motion, beats (small emphatic dips), feelings
const GDUR = { explain: 3.2, shrug: 1.6, nod: 1.2, shake: 1.3, point: 1.8, wave: 2.0, laugh: 1.8, think: 2.8, open: 2.2, emphatic: 1.4, bow: 1.6 };
const GESTURES = {
	explain: (u, s, k) => ({ arm: { lead: arm({ abd: 0.2, flex: 0.45 * k, roll: 0.3, bend: 1.4, pro: 1.1, curl: 0.15 }), off: arm({ abd: 0.15, flex: 0.3 * k, roll: 0.25, bend: 1.2, pro: 0.9, curl: 0.2 }) }, beat: Math.max(0, Math.sin(s * 5.2)) - 0.3, head: { pitch: Math.sin(s * 2.6) * 0.04 } }),
	open: (u, s, k) => ({ arm: { lead: arm({ abd: 0.45 * k, flex: 0.4, roll: -0.2, bend: 1.0, pro: 1.6, curl: 0.05 }), off: arm({ abd: 0.45 * k, flex: 0.4, roll: -0.2, bend: 1.0, pro: 1.6, curl: 0.05 }) }, head: { roll: 0.06 } }),
	emphatic: (u, s, k) => ({ arm: { lead: arm({ abd: 0.15, flex: 0.55, roll: 0.4, bend: 1.6, pro: 0.4, curl: 0.55 }) }, beat: Math.max(0, Math.sin(s * 7.0)) * 1.2, head: { pitch: Math.max(0, Math.sin(s * 7.0)) * 0.06 } }),
	shrug: (u) => { const e = Math.sin(Math.min(1, u * 1.4) * Math.PI); return { arm: { lead: arm({ abd: 0.3, flex: 0.25, roll: -0.25, bend: 1.25, pro: 1.7, shrug: e, curl: 0.05 }), off: arm({ abd: 0.3, flex: 0.25, roll: -0.25, bend: 1.25, pro: 1.7, shrug: e, curl: 0.05 }) }, head: { roll: 0.14 * e, pitch: -0.04 * e } }; },
	nod: (u, s) => ({ head: { pitch: Math.sin(s * 9) * 0.12 * (1 - u) }, feel: { joy: 0.2 } }),
	shake: (u, s) => ({ head: { yaw: Math.sin(s * 10) * 0.22 * (1 - u) }, feel: { sad: 0.15 } }),
	point: (u, s, k) => ({ arm: { lead: arm({ abd: 0.25, flex: 1.25, roll: 0.1, bend: 0.15, pro: 0.2, curl: 1, wflex: -0.1 }), point: true }, head: { yaw: -0.15 } }),
	wave: (u, s) => ({ arm: { lead: arm({ abd: 0.9, flex: 0.2, roll: -1.6 + Math.sin(s * 9) * 0.35, bend: 1.7, pro: 1.9, curl: 0.05, wflex: -0.2 }) }, feel: { joy: 0.6 }, head: { roll: 0.05 } }),
	laugh: (u, s) => ({ arm: { lead: arm({ abd: 0.1, flex: 0.35, roll: 0.9, bend: 1.3, pro: -0.2, curl: 0.4 }) }, head: { pitch: -0.14 * Math.sin(Math.min(1, u * 2) * Math.PI) + Math.sin(s * 14) * 0.03 }, feel: { joy: 1 } }),
	think: (u) => ({ arm: { lead: arm({ abd: 0.05, flex: 1.05, roll: 1.0, bend: 2.3, pro: 0.6, curl: 0.55, wflex: 0.2 }), off: arm({ abd: 0.05, flex: 0.55, roll: 1.25, bend: 1.8, pro: 0.2, curl: 0.5 }) }, head: { roll: 0.1, pitch: 0.06, yaw: 0.12 } }),
	bow: (u) => ({ head: { pitch: 0.3 * Math.sin(u * Math.PI) }, feel: { joy: 0.3 } }),
};
export const GESTURE_NAMES = Object.keys(GESTURES);

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
		// the pose held now, the lead hand, gestures in play, the face's feeling
		pose: 'rest', hand: Math.random() < 0.88 ? 'R' : 'L', gestures: [], feel: { joy: 0, sad: 0, anger: 0, surprise: 0 },
		arms: { L: armSprings(), R: armSprings() },
		headOv: { yaw: 0, pitch: 0, roll: 0 }, headYawS: new Spring(0, 3), headPitchS: new Spring(0, 3), headRollS: new Spring(0, 2),
		joyS: new Spring(0, 1.2), browS: new Spring(0, 2),
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

	// the gestures in play, blended: returns the arm targets, the head's part and a weight
	function gestureNow(t, dt) {
		const out = { w: 0, arm: null, head: null, beat: 0 };
		S.gestures = S.gestures.filter((q) => (q.t += dt) < q.dur);
		const q = S.gestures[0];
		if (!q) return out;
		const G = GESTURES[q.name];
		if (!G) return out;
		const u = q.t / q.dur, env = Math.min(1, q.t / 0.35) * Math.min(1, (q.dur - q.t) / 0.45);
		const T2 = dna.temper || { outgoing: 0.5 };
		const f = G(u, q.t, 0.6 + T2.outgoing * 0.7);
		out.w = env; out.arm = f.arm; out.beat = (f.beat || 0) * env;
		if (f.head) out.head = { yaw: (f.head.yaw || 0) * env, pitch: (f.head.pitch || 0) * env, roll: (f.head.roll || 0) * env };
		if (f.feel) for (const k in f.feel) S.feel[k] = Math.max(S.feel[k], f.feel[k] * env);
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
				if (leg.inSwing) { leg.inSwing = false; leg.planted = true; nominal(leg, rate === 0 ? stanceF * 0.5 : 0, stride, stanceF, leg.lock); S.onStep?.(leg.lock, S.speed.v); }
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
		const lean = S.lean.to(g.posture + 0.04 * amp + 0.16 * run + (dna.age > 70 ? 0.06 : 0) + (0.5 - (dna.temper?.confident ?? 0.5)) * 0.08 + (POSES[S.pose]?.lean || 0), dt);
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
		const HO = S.headOv, droop = (0.5 - (dna.temper?.confident ?? 0.5)) * 0.1 + (POSES[S.pose]?.look || 0);
		setLocal(map.neck01, _q.setFromEuler(_e.set(hp * 0.4 - chestPitch * 0.5 + nod * 0.4 + (HO.pitch + droop) * 0.4, (hy - chestYaw) * 0.4 + HO.yaw * 0.4, pelvisRoll * 0.3 + HO.roll * 0.4, 'YXZ')), worldQ[map.spine01]);
		setLocal(map.head, _q.setFromEuler(_e.set(hp * 0.6 - chestPitch * 0.4 + nod * 0.6 - bob * 0.8 + (HO.pitch + droop) * 0.6, (hy - chestYaw) * 0.6 + HO.yaw * 0.6, pelvisRoll * 0.3 + HO.roll * 0.6, 'YXZ')), worldQ[map.neck01]);
		// the eyes lead the head, then settle
		const ey = L.eyeYaw.to(clamp(ty - hy, -0.45, 0.45), dt), ep = L.eyePitch.to(clamp(tp - hp, -0.3, 0.3), dt);
		for (const eye of P.eyes) eye.rotation.set(ep, ey, 0, 'YXZ');

		// ---- arms: a pose (how this person holds themselves right now), gestures over it,
		// and the walk's swing through it; every joint parameter rides its own spring ----
		const T = dna.temper || { outgoing: 0.5, confident: 0.5, warmth: 0.5, fidget: 0.5 };
		const swingA = ((0.16 + 0.26 * amp) * g.armSwing * (0.75 + T.outgoing * 0.5) * (1 - run * 0.2) + run * 0.35) * (POSES[S.pose]?.swing ?? 1);
		const swingNow = Math.sin(S.phase * TAU);
		const ov = gestureNow(t, dt);
		for (const side of ['L', 'R']) {
			const sx = side === 'L' ? 1 : -1, lead = side === S.hand;
			const base = POSES[S.pose] || POSES.rest, bp = (lead ? base.lead : base.off) || base.both || POSES.rest.both;
			const gp = ov.arm ? (lead ? ov.arm.lead : ov.arm.off) : null;
			const tgt = {};
			for (const k of ARM_KEYS) tgt[k] = gp && gp[k] !== undefined ? bp[k] * (1 - ov.w) + gp[k] * ov.w : bp[k];
			// the walk: swing from the shoulder, the elbow bending as the arm comes forward
			const sw = (side === 'L' ? -swingNow : swingNow) * swingA * amp;
			tgt.flex += sw; tgt.bend += Math.max(0, sw) * 0.35 + run * 1.0;
			// running: forearms up, hands loosely closed
			if (run > 0.01) { tgt.curl = tgt.curl * (1 - run) + 0.65 * run; tgt.pro = tgt.pro * (1 - run) + 0.25 * run; }
			const A = S.arms[side];
			const P2 = {};
			for (const k of ARM_KEYS) P2[k] = A[k].to(tgt[k] + (k === 'flex' && gp ? (ov.beat || 0) * (lead ? 0.12 : 0.05) : 0), dt);
			const iC = map['clavicle.' + side], iSh = map['shoulder01.' + side], iU = map['upperarm01.' + side], iU2 = map['upperarm02.' + side], iL = map['lowerarm01.' + side], iL2 = map['lowerarm02.' + side], iW = map['wrist.' + side];
			// the shoulder girdle: shrugs, breath, a confident person's shoulders back and down
			const back = (T.confident - 0.5) * 0.08;
			setLocal(iC, _q.setFromEuler(_e.set(0, (-sw * 0.06 - back) * sx, (br * 0.01 + Math.max(0, sw) * 0.04 + P2.shrug * 0.28) * sx)), worldQ[map.spine01]);
			setLocal(iSh, _q.identity(), worldQ[iC]);
			// the upper arm: down, then out to the side, then forward
			const up = _v.set(0, -1, 0).applyAxisAngle(Z, sx * (0.04 + dna.weight * 0.05 + P2.abd)).applyAxisAngle(X, -P2.flex).applyAxisAngle(Y, counter * 0.3).clone();
			setWorld(iU, aimQ(rest.dirs[iU], up, new THREE.Quaternion()), worldQ[iSh]);
			setLocal(iU2, _q.identity(), worldQ[iU]);
			// the forearm bends about the elbow's hinge, rolled in across the body or out
			// the elbow's hinge lies across the upper arm (forward x upper arm), whatever way
			// the arm is raised; then the forearm rolls about the upper arm
			const fwdC = _v2.set(0, 0, 1).applyAxisAngle(Y, counter * 0.3);
			const hinge = new THREE.Vector3().crossVectors(fwdC, up);
			if (hinge.lengthSq() < 0.04) hinge.set(1, 0, 0).applyAxisAngle(Y, counter * 0.3);
			hinge.normalize().applyAxisAngle(up, sx * P2.roll);
			const fore = up.clone().applyAxisAngle(hinge, -P2.bend).normalize();
			setWorld(iL, aimQ(rest.dirs[iL], fore, new THREE.Quaternion()), worldQ[iU2]);
			setLocal(iL2, _q.identity(), worldQ[iL]);
			// the hand: continues the forearm, bent at the wrist, the palm turned by pro
			// (0: palm to the thigh, thumb forward; +: palm up / open; -: palm back)
			const hand = fore.clone().applyAxisAngle(hinge, -P2.wflex);
			const qh = aimQ(rest.dirs[iW], hand, new THREE.Quaternion());
			qh.multiply(_q2.setFromAxisAngle(rest.dirs[iW], sx * (PALM0 - P2.pro)));
			setWorld(iW, qh, worldQ[iL2]);
			// the fingers: relaxed hands are loosely cupped, the little finger most; a fist
			// closes them all; pointing leaves the index straight
			for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) {
				const i = map['finger' + f + '-' + j + '.' + side];
				if (i === undefined) continue;
				const relaxed = f === 1 ? 0.08 + j * 0.04 : (0.1 + f * 0.05) * (j === 2 ? 1.2 : j === 3 ? 0.8 : 1);
				let c = relaxed + (1.25 - relaxed) * P2.curl;
				if (f === 2 && gp?.point && lead) c = 0.02;
				if (f === 1) c *= 0.6;
				bones[i].quaternion.setFromAxisAngle(curlAxis[i], c);
			}
		}
		// the head's part in a gesture: nods, shakes, tilts, a laugh thrown back
		S.headOv.yaw = S.headYawS.to(ov.head?.yaw || 0, dt); S.headOv.pitch = S.headPitchS.to(ov.head?.pitch || 0, dt); S.headOv.roll = S.headRollS.to((ov.head?.roll || 0) + (POSES[S.pose]?.head || 0), dt);

		// ---- the face: blinks, talking ----
		const infl = P.skin.morphTargetInfluences;
		if (infl) {
			S.nextBlink -= dt;
			if (S.nextBlink <= 0) { S.blink = 0.14; S.nextBlink = 1.5 + Math.random() * 5; }
			S.blink = Math.max(0, S.blink - dt);
			infl[0] = S.blink > 0 ? Math.sin((1 - S.blink / 0.14) * Math.PI) : 0;
			if (S.talk > 0) { S.talkT += dt; infl[1] = Math.max(0, Math.sin(S.talkT * 11) * Math.sin(S.talkT * 2.3 + 1)) * 0.35; } else infl[1] *= 0.8;
			// feelings fade back to this person's resting face
			for (const k in S.feel) S.feel[k] *= Math.exp(-dt * 0.25);
			const joy = S.joyS.to(0.12 + (dna.temper?.warmth ?? 0.5) * 0.18 + S.feel.joy * 0.7 - S.feel.sad * 0.3 - S.feel.anger * 0.3 + (S.talk > 0 ? 0.1 : 0), dt);
			infl[2] = clamp(joy, 0, 1);
			const brow = S.browS.to(S.feel.surprise * 0.9 + S.feel.sad * 0.4 + (S.talk > 0 ? Math.max(0, Math.sin(S.talkT * 1.7)) * 0.3 : 0), dt);
			infl[3] = clamp(brow, 0, 1);
		}
	}
	// a gesture now (queued behind any in play), a pose to settle into, a feeling to show
	function gesture(name, dur) { if (!GESTURES[name]) return; if (S.gestures.length >= 3) S.gestures.splice(1, 1); S.gestures.push({ name, t: 0, dur: dur || GDUR[name] || 2 }); }       // the newest wins over stale ones
	function setPose(name) { if (POSES[name]) S.pose = name; }
	function feel(k, v = 1) { if (k in S.feel) S.feel[k] = Math.max(S.feel[k], v); }
	return { S, update, gesture, setPose, feel, poses: POSES, want: S.want, place(x, y, z, heading) { S.pos.set(x, y, z); S.yaw.v = S.heading = S.want.heading = heading; S.hipY.v = y; for (const l of S.legs) { l.init = false; l.planted = true; l.inSwing = false; } S.speed.v = 0; S.speed.dv = 0; } };
}
