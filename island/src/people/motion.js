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
// (at rest pro is PALM_SIDE: hands hang palm to the thigh, thumb and index finger forward)
const PALM_SIDE = 1.57;
const arm = (o) => Object.assign({ abd: 0.06, flex: 0.02, roll: 0, bend: 0.2, pro: PALM_SIDE, wflex: 0.05, curl: 0, shrug: 0 }, o);
function armSprings() { const o = {}; for (const k of ARM_KEYS) o[k] = new Spring(arm({})[k], 2.4); return o; }
// the rig's hands hang palm-back; PALM0 - pro turns them (pro = PALM_SIDE: palm to thigh)
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
	// seated: hands in the lap, or forearms on a table
	lap: { both: arm({ abd: 0.12, flex: 0.55, roll: 0.5, bend: 1.05, pro: 0.6, curl: 0.4 }), swing: 0 },
	table: { both: arm({ abd: 0.2, flex: 0.85, roll: 0.35, bend: 1.45, pro: 0.9, curl: 0.3 }), swing: 0 },
};
// holding hands: a child's arm reaches up and out to the grown-up's, the grown-up's hangs a
// little out and forward to meet it
const HOLD = { kid: arm({ abd: 0.5, flex: 0.3, roll: -0.1, bend: 0.25, pro: 0.5, wflex: -0.1, curl: 0.5 }), adult: arm({ abd: 0.2, flex: 0.1, bend: 0.22, pro: 0.45, curl: 0.5 }) };
// gestures: functions of progress u (0..1), time s (seconds) and size k (temperament);
// arm.lead / arm.off targets, head motion, beats (small emphatic dips), feelings
const GDUR = { explain: 3.2, shrug: 1.6, nod: 1.2, shake: 1.3, point: 1.8, wave: 2.0, laugh: 1.8, think: 2.8, open: 2.2, emphatic: 1.4, bow: 1.6 };
const GESTURES = {
	explain: (u, s, k) => ({ arm: { lead: arm({ abd: 0.2, flex: 0.45 * k, roll: 0.3, bend: 1.4, pro: 1.1, curl: 0.15 }), off: arm({ abd: 0.15, flex: 0.3 * k, roll: 0.25, bend: 1.2, pro: 0.9, curl: 0.2 }) }, beat: Math.max(0, Math.sin(s * 5.2)) - 0.3, head: { pitch: Math.sin(s * 2.6) * 0.04 } }),
	open: (u, s, k) => ({ arm: { lead: arm({ abd: 0.45 * k, flex: 0.4, roll: -0.2, bend: 1.0, pro: 1.6, curl: 0.05 }), off: arm({ abd: 0.45 * k, flex: 0.4, roll: -0.2, bend: 1.0, pro: 1.6, curl: 0.05 }) }, head: { roll: 0.06 } }),
	emphatic: (u, s) => ({ arm: { lead: arm({ abd: 0.15, flex: 0.55, roll: 0.4, bend: 1.6, pro: 0.4, curl: 0.55 }) }, beat: Math.max(0, Math.sin(s * 7.0)) * 1.2, head: { pitch: Math.max(0, Math.sin(s * 7.0)) * 0.06 } }),
	shrug: (u) => { const e = Math.sin(Math.min(1, u * 1.4) * Math.PI); return { arm: { lead: arm({ abd: 0.3, flex: 0.25, roll: -0.25, bend: 1.25, pro: 1.7, shrug: e, curl: 0.05 }), off: arm({ abd: 0.3, flex: 0.25, roll: -0.25, bend: 1.25, pro: 1.7, shrug: e, curl: 0.05 }) }, head: { roll: 0.14 * e, pitch: -0.04 * e } }; },
	nod: (u, s) => ({ head: { pitch: Math.sin(s * 9) * 0.12 * (1 - u) }, feel: { joy: 0.2 } }),
	shake: (u, s) => ({ head: { yaw: Math.sin(s * 10) * 0.22 * (1 - u) }, feel: { sad: 0.15 } }),
	point: () => ({ arm: { lead: arm({ abd: 0.25, flex: 1.25, roll: 0.1, bend: 0.15, pro: 0.2, curl: 1, wflex: -0.1 }), point: true }, head: { yaw: -0.15 } }),
	wave: (u, s) => ({ arm: { lead: arm({ abd: 0.9, flex: 0.2, roll: -1.6 + Math.sin(s * 9) * 0.35, bend: 1.7, pro: 1.9, curl: 0.05, wflex: -0.2 }) }, feel: { joy: 0.6 }, head: { roll: 0.05 } }),
	laugh: (u, s) => ({ arm: { lead: arm({ abd: 0.1, flex: 0.35, roll: 0.9, bend: 1.3, pro: -0.2, curl: 0.4 }) }, head: { pitch: -0.14 * Math.sin(Math.min(1, u * 2) * Math.PI) + Math.sin(s * 14) * 0.03 }, feel: { joy: 1 } }),
	think: () => ({ arm: { lead: arm({ abd: 0.05, flex: 1.05, roll: 1.0, bend: 2.3, pro: 0.6, curl: 0.55, wflex: 0.2 }), off: arm({ abd: 0.05, flex: 0.55, roll: 1.25, bend: 1.8, pro: 0.2, curl: 0.5 }) }, head: { roll: 0.1, pitch: 0.06, yaw: 0.12 } }),
	bow: (u) => ({ head: { pitch: 0.3 * Math.sin(u * Math.PI) }, feel: { joy: 0.3 } }),
};
export const GESTURE_NAMES = Object.keys(GESTURES);

const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _e = new THREE.Euler();
const swingFrom = new THREE.Vector3(), swingTo = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

export function createMotion(P, groundAt) {
	const { bones, map, rest, dna } = P;
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
		// sitting: how far down into a seat (0 standing .. 1 seated), and the seat's height
		sitK: new Spring(0, 2.2), sitWant: 0, seatH: 0.46,
		// a hand held by someone walking alongside, by side
		hold: { L: false, R: false },
	};
	const hipRest = H('upperleg01.L').y;
	const ankleH = H('foot.L').y;
	const hipHalf = Math.abs(H('upperleg01.L').x);
	// the leg's bones as the joints really lie: hip to knee, knee to ankle (the thigh bone's
	// own axis runs a few degrees off the line to the knee, and the base mesh stands with its
	// feet apart, so the legs are aimed along these, never along the bones' axes)
	const thighRest = H('lowerleg01.L').clone().sub(H('upperleg01.L')), shinRest = H('foot.L').clone().sub(H('lowerleg01.L'));
	const thighLen = thighRest.length(), shinLen = shinRest.length(), legFull = thighLen + shinLen;
	const legRest = { L: [thighRest.clone().normalize(), shinRest.clone().normalize()], R: [H('lowerleg01.R').clone().sub(H('upperleg01.R')).normalize(), H('foot.R').clone().sub(H('lowerleg01.R')).normalize()] };
	// the foot: the heel a little behind the ankle, the toes well ahead of it (the foot rolls
	// off its toes, so that is where it pivots as the heel comes up)
	const heelB = P.height * 0.03, ballF = P.height * 0.1;
	// feet land nearly in line, each a little in from under its hip
	const footX = hipHalf * 0.55;
	// standing tall: the hips as high as the nearly straight legs reach
	const hipStand = ankleH + Math.sqrt((legFull * 0.998) ** 2 - (hipHalf - footX) ** 2);
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
	// a bone turned so its rest axis lies along a, and its rest forward (+z) toward f: no twist
	const fa = new THREE.Vector3(), fb = new THREE.Vector3(), fc = new THREE.Vector3(), fm1 = new THREE.Matrix4(), fm2 = new THREE.Matrix4();
	function frameQ(restA, a, f, out) {
		fa.copy(restA); fb.set(0, 0, 1).addScaledVector(fa, -fa.z).normalize(); fc.crossVectors(fa, fb);
		fm1.makeBasis(fa, fb, fc).transpose();
		fa.copy(a).normalize(); fb.copy(f).addScaledVector(fa, -f.dot(fa)).normalize(); fc.crossVectors(fa, fb);
		fm2.makeBasis(fa, fb, fc).multiply(fm1);
		return out.setFromRotationMatrix(fm2);
	}

	// where a leg's foot rests on the ground, lz metres ahead of the body's centre
	function nominal(leg, lz, out) {
		const c = Math.cos(S.heading), s = Math.sin(S.heading);
		// (standing, the feet a little further apart)
		const lx = leg.side * footX * (1.5 - 0.5 * smooth(S.speed.v / 0.9));
		out.set(S.pos.x + lx * c + lz * s, 0, S.pos.z - lx * s + lz * c);
		out.y = groundAt(out.x, out.z);
		return out;
	}
	// the ankle over a foot whose flat print is at `at`, rolled by pitch p (+: heel up, over
	// the ball; -: toes up, on the heel)
	function ankleAt(at, p, out) {
		const b = p > 0 ? ballF : -heelB, oz = p > 0 ? -ballF : heelB, cp = Math.cos(p), sp = Math.sin(p);
		const dz = b + ankleH * sp + oz * cp;
		out.set(at.x + Math.sin(S.heading) * dz, at.y + ankleH * cp - oz * sp, at.z + Math.cos(S.heading) * dz);
		return out;
	}
	// soft minimum: never above either, with no corner where they cross
	const smin = (a, b, k = 0.006) => { const m = Math.min(a, b); return m - k * Math.log(Math.exp((m - a) / k) + Math.exp((m - b) / k)); };

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
		// gait from speed, as people really walk: a stride (two steps) of about 0.83 of the height
		// at an easy 1.3 m/s, lengthening and quickening together as the pace picks up; the feet
		// are down 62% of the cycle walking, much less running
		const h = P.height;
		const stride = h * 0.83 * Math.pow(Math.max(speed, 0.25) / 1.3, 0.42) * g.stride * (1 + run * 0.3);
		const stanceF = 0.6 - 0.24 * run;
		// a foot touches down a little ahead of the hips and leaves well behind them (a step
		// taken standing still sets it back under the hip)
		const landZ = speed < 0.05 ? 0 : stride * stanceF * (0.36 + run * 0.1);
		// standing still: a step only when a foot is out from under the body or mid-air
		let rate = speed / stride;
		if (speed < 0.05) {
			let need = false;
			for (const leg of S.legs) { if (!leg.planted) need = true; else { nominal(leg, 0, _v); if (_v.distanceTo(leg.lock) > 0.12 * h / 1.7) need = true; } }
			rate = need ? 1.4 : 0;
		}
		S.phase = (S.phase + rate * dt) % 1;
		const amp = smooth(speed / 0.9);
		// how far the foot rolls: toes up at the heel strike, the heel peeling up before toe-off
		const heelP = -0.24 * amp, toeP = (1.1 - 0.3 * run) * amp;

		// ---- feet: where each ankle goes (world) ----
		const feet = [];
		for (const leg of S.legs) {
			const u = (S.phase + (leg.side < 0 ? 0.5 : 0)) % 1;
			if (!leg.init) { nominal(leg, 0, leg.lock); leg.init = true; }
			const ankle = new THREE.Vector3();
			let pitch = 0, gy;
			if (u < stanceF || rate === 0) {
				if (leg.inSwing) { leg.inSwing = false; leg.planted = true; nominal(leg, rate === 0 ? 0 : landZ, leg.lock); S.onStep?.(leg.lock, S.speed.v); }
				const su = u / stanceF;
				// heel strike, the foot slapping flat, flat through midstance, then the heel rising
				pitch = rate ? (su < 0.14 ? heelP * (1 - smooth(su / 0.14)) : su > 0.5 ? toeP * ((su - 0.5) / 0.5) ** 2 : 0) : 0;
				ankleAt(leg.lock, pitch, ankle);
				gy = leg.lock.y;
				// never let a locked foot stay out of reach
				const hipW = _v.set(S.pos.x, S.pos.y + hipStand, S.pos.z);
				if (ankle.distanceTo(hipW) > legFull * 1.02 + 0.05) leg.planted = false;          // it must step
			} else {
				if (!leg.inSwing) { leg.inSwing = true; leg.planted = false; leg.from.copy(leg.lock); }
				const su = (u - stanceF) / (1 - stanceF);
				// from the toe-off to where it lands, which is where the body will be
				const land = nominal(leg, landZ, _v2);
				// (slow off the mark while the knee folds, fastest as it passes the other foot,
				// reaching out ahead early and easing in to land)
				const k = Math.pow(smooth(su), 0.75);
				const a0 = ankleAt(leg.from, toeP, swingFrom), a1 = ankleAt(land, heelP, swingTo);
				ankle.lerpVectors(a0, a1, k);
				gy = groundAt(ankle.x, ankle.z);
				// the swing clears the ground, the ankle highest early as the knee folds
				const lift = h * (0.05 + 0.05 * run) * 6.75 * su * (1 - su) * (1 - su) * (rate && amp > 0.2 ? 1 : 0.5);
				ankle.y = Math.max(ankle.y, gy + ankleH * 0.9) + lift;
				pitch = su < 0.45 ? toeP * (1 - smooth(su / 0.45)) : heelP * smooth((su - 0.45) / 0.55);
				leg.lock.set(ankle.x, gy, ankle.z);
			}
			feet.push({ leg, ankle, pitch, u, gy, stance: !leg.inSwing });
		}

		// seated: the feet set down a little ahead of the seat, flat
		const sitK = clamp(S.sitK.to(S.sitWant, dt), 0, 1);
		if (sitK > 0.001) {
			const c = Math.cos(S.heading), sn = Math.sin(S.heading);
			// (a child on a grown-up's chair: the shins hang straight down, the feet off the floor)
			const hang = S.pos.y + S.seatH + 0.07 - shinLen;
			for (const f of feet) {
				const lx = f.leg.side * hipHalf * 1.1;
				let lz = h * 0.25;
				_v2.set(S.pos.x + lx * c + lz * sn, 0, S.pos.z - lx * sn + lz * c);
				const floor = groundAt(_v2.x, _v2.z), dangle = hang > floor + ankleH;
				if (dangle) { lz = thighLen * 0.92; _v2.set(S.pos.x + lx * c + lz * sn, 0, S.pos.z - lx * sn + lz * c); }
				_v2.y = floor;
				f.gy += (_v2.y - f.gy) * sitK;
				_v2.y = dangle ? hang : floor + ankleH;
				f.ankle.lerp(_v2, sitK); f.pitch = f.pitch * (1 - sitK) + (dangle ? 0.35 * sitK : 0);
				if (sitK > 0.5) { f.leg.lock.set(_v2.x, f.gy, _v2.z); f.leg.planted = true; f.leg.inSwing = false; }
			}
		}
		// ---- the body over the feet ----
		const gy = Math.min(groundAt(S.pos.x, S.pos.z), Math.max(feet[0].gy, feet[1].gy));
		// the pelvis cannot sit higher than the lower foot allows
		const lowFoot = Math.min(feet[0].gy, feet[1].gy);
		S.pos.y = S.hipY.to(Math.min(gy, lowFoot + 0.02), dt);
		// weight over the stance foot; slow sway standing
		S.shiftT += dt;
		const idleSway = (1 - amp) * Math.sin(S.shiftT * 0.35 + S.mood * 5) * 0.025;
		const sway = S.sway.to(Math.sin(S.phase * TAU) * 0.02 * amp * (1 - run * 0.6) + idleSway, dt);
		const lean = S.lean.to(-0.06 * sitK + g.posture + 0.03 * amp + 0.14 * run + (dna.age > 70 ? 0.06 : 0) + (0.5 - (dna.temper?.confident ?? 0.5)) * 0.08 + (POSES[S.pose]?.lean || 0), dt);
		const turnLean = S.turnLean.to(clamp(-turnRate * speed * 0.05, -0.12, 0.12), dt);
		// the pelvis turns the leading hip forward (most at each heel strike) and drops a little
		// on the side of the swinging leg
		const pelvisYaw = -Math.cos(S.phase * TAU) * 0.07 * amp * (1 + run * 0.4);
		const pelvisRoll = Math.cos(S.phase * TAU) * 0.035 * amp + idleSway * 1.2 + turnLean;
		// the hips: standing tall, a touch lower running; then no higher than the planted legs
		// reach with the knee just soft, which makes the walk rise over each stance foot and
		// dip as the weight passes from one to the other; running adds the flight
		const hc = Math.cos(heading), hs = Math.sin(heading), yc = Math.cos(pelvisYaw), ys = Math.sin(pelvisYaw);
		let hipH = hipStand - h * (0.002 + run * 0.035) - (dna.age > 70 ? 0.02 : 0) + run * (Math.abs(Math.sin(S.phase * TAU)) - 0.5) * 0.05;
		for (const f of feet) {
			if (!f.stance || sitK > 0.5) continue;
			const bx = f.leg.side * hipHalf * yc + sway, bz = -f.leg.side * hipHalf * ys;
			const dx = f.ankle.x - (S.pos.x + bx * hc + bz * hs), dz = f.ankle.z - (S.pos.z - bx * hs + bz * hc), R = legFull * 0.999;
			const d2 = Math.min(dx * dx + dz * dz, R * R * 0.9);
			hipH = smin(hipH, f.ankle.y - S.pos.y + Math.sqrt(R * R - d2));
		}
		const hipY = hipH * (1 - sitK) + (S.seatH + 0.09) * sitK;
		const bob = hipH - hipStand;

		// body space: the person's own frame (+z forward)
		P.root.position.copy(S.pos);
		P.root.rotation.set(0, heading, 0);

		// ---- pelvis ----
		const rootI = map.root, rootB = bones[rootI];
		rootB.position.set(rest.heads[rootI].x + sway, rest.heads[rootI].y - hipRest + hipY, rest.heads[rootI].z);
		_e.set(lean * 0.35, pelvisYaw, pelvisRoll, 'YXZ');
		const rootQ = _q.setFromEuler(_e).clone();
		setLocal(rootI, rootQ, new THREE.Quaternion());

		// ---- legs: two-bone IK in body space ----
		P.root.updateMatrixWorld(true);
		const inv = new THREE.Matrix4().copy(P.root.matrixWorld).invert();
		const rootPos = rootB.position;
		for (const f of feet) {
			const s = f.leg.name;
			const iT = map['upperleg01.' + s], iS = map['lowerleg01.' + s], iF = map['foot.' + s];
			const hip = _v.copy(rest.heads[iT]).sub(rest.heads[rootI]).applyQuaternion(rootQ).add(rootPos).clone();
			const A = f.ankle.clone().applyMatrix4(inv);
			const l1 = rest.heads[iS].distanceTo(rest.heads[iT]), l2 = rest.heads[iF].distanceTo(rest.heads[iS]);
			const toA = A.clone().sub(hip); let dist = toA.length();
			dist = clamp(dist, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.9995);
			const dir = toA.normalize();
			// the knee points where the foot does, straight ahead but for the slight toe-out
			const toeOut = pelvisYaw * 0.3 + f.leg.side * 0.1;
			const kneeHint = new THREE.Vector3(f.leg.side * 0.02, 0, 1).applyAxisAngle(Y, toeOut * 0.6).normalize();
			const bend = kneeHint.addScaledVector(dir, -kneeHint.dot(dir)).normalize();
			const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
			const knee = hip.clone().addScaledVector(dir, cosA * l1).addScaledVector(bend, Math.sqrt(Math.max(0, 1 - cosA * cosA)) * l1);
			const ankle = hip.clone().addScaledVector(dir, dist);
			const [rT, rS] = legRest[s];
			setWorld(iT, frameQ(rT, knee.clone().sub(hip), bend, new THREE.Quaternion()), worldQ[rootI]);
			setWorld(iS, frameQ(rS, ankle.clone().sub(knee), bend, new THREE.Quaternion()), worldQ[iT]);
			// the foot: forward (toes a little out), pitched through the roll-over
			setWorld(iF, _q.setFromAxisAngle(Y, toeOut).multiply(_q2.setFromAxisAngle(X, f.pitch)).clone(), worldQ[iS]);
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
		// about 15-20 degrees each way at a normal walk, each arm furthest forward as the other
		// side's heel strikes (so opposite its own leg), a touch more behind than in front
		const swingA = ((0.1 + 0.2 * amp) * g.armSwing * (0.8 + T.outgoing * 0.4) * (1 - run * 0.2) + run * 0.3) * (POSES[S.pose]?.swing ?? 1);
		const swingNow = Math.cos((S.phase - 0.04) * TAU);
		const ov = gestureNow(t, dt);
		for (const side of ['L', 'R']) {
			const sx = side === 'L' ? 1 : -1, lead = side === S.hand;
			const base = POSES[S.pose] || POSES.rest, bp = (lead ? base.lead : base.off) || base.both || POSES.rest.both;
			const gp = ov.arm ? (lead ? ov.arm.lead : ov.arm.off) : null;
			const tgt = {};
			for (const k of ARM_KEYS) tgt[k] = gp && gp[k] !== undefined ? bp[k] * (1 - ov.w) + gp[k] * ov.w : bp[k];
			if (S.hold[side]) Object.assign(tgt, dna.child ? HOLD.kid : HOLD.adult);
			// the walk: swing from the shoulder, the elbow bending as the arm comes forward
			const sw = (side === 'L' ? -swingNow : swingNow) * swingA * amp * (S.hold[side] ? 0.25 : 1);
			tgt.bend += run * 1.0;
			// running: forearms up, hands loosely closed
			if (run > 0.01) { tgt.curl = tgt.curl * (1 - run) + 0.65 * run; tgt.pro = tgt.pro * (1 - run) + PALM_SIDE * run; }
			const A = S.arms[side];
			const P2 = {};
			for (const k of ARM_KEYS) P2[k] = A[k].to(tgt[k] + (k === 'flex' && gp ? (ov.beat || 0) * (lead ? 0.12 : 0.05) : 0), dt);
			// (the swing itself goes on after the springs, which would only lag and damp it)
			P2.flex += sw - 0.05 * amp * (POSES[S.pose]?.swing ?? 1); P2.bend += Math.max(0, sw) * 0.6 + 0.08 * amp;
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
	// sit(h): down into a seat h metres up (now: already sitting); stand(): up again
	const sit = (h = 0.46, now = false) => { S.sitWant = 1; S.seatH = h; if (now) { S.sitK.v = 1; S.sitK.dv = 0; } };
	const stand = () => { S.sitWant = 0; };
	// hold(side, on): a hand held (or let go)
	const hold = (side, on = true) => { S.hold[side] = !!on; };
	return { S, update, gesture, setPose, feel, sit, stand, hold, poses: POSES, want: S.want, place(x, y, z, heading) { S.pos.set(x, y, z); S.yaw.v = S.heading = S.want.heading = heading; S.hipY.v = y; for (const l of S.legs) { l.init = false; l.planted = true; l.inSwing = false; } S.speed.v = 0; S.speed.dv = 0; } };
}
