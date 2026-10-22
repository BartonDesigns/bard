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
// stays level and looks where it wants to, the eyes leading and darting (saccades), turned
// in a touch towards what is near. Standing, people breathe (chest and shoulders),
// shift their weight, glance about, blink, and take a small step when their feet are
// out from under them. Talking adds mouth, nods and hand gestures.

import * as THREE from 'three';
import { actionAt, ACTIONS } from './actions.js';
import { gaitSignature, gaitDrift } from './gait.js';
import { clamp } from '../noise.js';
import { noteBody } from './personal-space.js';
import { beatNow, dip } from '../music/beat.js';

const TAU = Math.PI * 2;
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
	// ready: the hero's way of standing (people/hero.js): arms a little off the sides, elbows soft,
	// hands relaxed (the fingers' own cascade, the little finger most, and only a touch more: a
	// curl past that closes them toward a loose fist and leaves the thumb standing out), chest up
	ready: { both: arm({ abd: 0.17, flex: 0.05, roll: 0.12, bend: 0.3, curl: 0.12 }), lean: -0.03 },
	pockets: { both: arm({ abd: 0.12, flex: -0.08, roll: 0.35, bend: 0.55, pro: 0.3, wflex: 0.3, curl: 0.9 }), swing: 0.15 },
	crossed: { lead: arm({ abd: 0.05, flex: 0.6, roll: 1.35, bend: 1.95, pro: 0.3, curl: 0.5 }), off: arm({ abd: 0.08, flex: 0.5, roll: 1.2, bend: 1.8, pro: 0.1, curl: 0.55 }), swing: 0.05, lean: -0.02 },
	behind: { both: arm({ abd: 0.08, flex: -0.45, roll: 1.55, bend: 1.45, pro: -0.6, curl: 0.35 }), swing: 0.05, lean: -0.03 },
	// a ball under the forearm, held against the hip, the hand cupped over it
	tuck: { lead: arm({ abd: 0.62, flex: 0.05, roll: 0.3, bend: 1.2, pro: 0.6, wflex: 0.15, curl: 0.5 }), off: arm({}), swing: 0.2 },
	hip: { lead: arm({ abd: 0.5, flex: -0.3, roll: 1.1, bend: 1.7, pro: 0.6, wflex: -0.3, curl: 0.5 }), off: arm({}), swing: 0.4 },
	phone: { lead: arm({ abd: 0.12, flex: 0.45, roll: 0.45, bend: 1.9, pro: 1.35, wflex: -0.25, curl: 0.45 }), off: arm({}), swing: 0.35, look: 0.45 },
	listen: { both: arm({ abd: 0.08, flex: 0.1, roll: 0.35, bend: 0.5, pro: 0.2, curl: 0.3 }), head: 0.08 },
	// seated: hands in the lap, or forearms on a table
	lap: { both: arm({ abd: 0.12, flex: 0.55, roll: 0.5, bend: 1.05, pro: 0.6, curl: 0.4 }), swing: 0 },
	type: { both: arm({abd:.16,flex:.9,roll:.28,bend:1.42,pro:.9,curl:.25}),swing:0,look:.16 },
	table: { both: arm({ abd: 0.2, flex: 0.85, roll: 0.35, bend: 1.45, pro: 0.9, curl: 0.3 }), swing: 0 },
	// at the wheel: both hands up and forward on the rim, loosely closed
	drive: { both: arm({ abd: 0.24, flex: 1.0, roll: 0.3, bend: 0.95, pro: 0.95, wflex: -0.1, curl: 0.75 }), swing: 0 },
	// a book held up in both hands, the head bent to it; hands held out to a small stove;
	// both hands on a cart's handle, pushing it
	read: { both: arm({ abd: 0.16, flex: 0.62, roll: 0.55, bend: 1.8, pro: 1.0, wflex: -0.2, curl: 0.35 }), swing: 0, look: 0.5 },
	cook: { both: arm({ abd: 0.2, flex: 0.95, roll: 0.3, bend: 0.85, pro: 0.9, curl: 0.25 }), swing: 0, look: 0.35, lean: 0.12 },
	push: { both: arm({ abd: 0.14, flex: 0.8, roll: 0.25, bend: 0.6, pro: 0.15, wflex: -0.1, curl: 0.85 }), swing: 0, lean: 0.08 },
	// a fishing rod held out over the rail in both hands
	fish: { lead: arm({ abd: 0.15, flex: 0.75, roll: 0.35, bend: 0.95, pro: 0.9, curl: 1 }), off: arm({ abd: 0.12, flex: 0.45, roll: 0.6, bend: 1.2, pro: 0.9, curl: 1 }), swing: 0, look: 0.2 },
};
// holding hands: a child's arm reaches up and out to the grown-up's, the grown-up's hangs a
// little out and forward to meet it
const HOLD = { kid: arm({ abd: 0.5, flex: 0.3, roll: -0.1, bend: 0.25, pro: 0.5, wflex: -0.1, curl: 0.5 }), adult: arm({ abd: 0.2, flex: 0.1, bend: 0.22, pro: 0.45, curl: 0.5 }) };
// gestures: functions of progress u (0..1), time s (seconds) and size k (temperament);
// arm.lead / arm.off targets, head motion, beats (small emphatic dips), feelings
const GDUR = { cast: 0.95, cast2: 1.4, beam: 3, explain: 3.2, shrug: 1.6, nod: 1.2, shake: 1.3, point: 1.8, wave: 2.0, laugh: 1.8, think: 2.8, open: 2.2, emphatic: 1.4, bow: 1.6 };
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
	// a spell cast (magic/): the hand thrust out toward the aim, palm first, held a breath and let
	// down; cast2, a great one, with both hands
	cast: (u) => { const e = u < 0.18 ? Math.sin(u / 0.18 * Math.PI / 2) : u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45); return { arm: { lead: arm({ abd: 0.2, flex: 1.35 * e, roll: 0, bend: 0.25 + 0.6 * (1 - e), pro: 1.3, curl: 0.05, wflex: -0.8 * e }) } }; },
	cast2: (u) => { const e = u < 0.25 ? Math.sin(u / 0.25 * Math.PI / 2) : u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4); const a = arm({ abd: 0.3, flex: 1.3 * e, roll: 0, bend: 0.3 + 0.6 * (1 - e), pro: 1.3, curl: 0.05, wflex: -0.8 * e }); return { arm: { lead: a, off: a }, head: { pitch: -0.08 * e } }; },
	// beam: both hands thrust out together, heels touching, shaking with the force pouring from
	// them, for as long as it is held (let go: ungesture)
	beam: (u, t) => { const tr = 0.04 * Math.sin(t * 70) + 0.02 * Math.sin(t * 43); const a = arm({ abd: -0.02, flex: 1.45 + tr, roll: 0.3, bend: 0.12, pro: 1.3, curl: 0.12, wflex: -1.0 }); return { arm: { lead: a, off: a }, head: { pitch: -0.06 } }; },
};
export const GESTURE_NAMES = Object.keys(GESTURES);

const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
// the trigger finger's three joints: straight along the frame, and hooked round the trigger
export const TRIGGER_OFF = [0.12, 0.06, 0.04], TRIGGER_ON = [0.55, 1.05, 0.6];

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _e = new THREE.Euler();
const swingFrom = new THREE.Vector3(), swingTo = new THREE.Vector3();
// (where a body's step began this frame; constrain reads it before the next body's update)
const _from = new THREE.Vector3();
const AX = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

// (space: whether you are kept clear of this body as it walks (people/personal-space.js): true,
// 'fixed' (solid but never shuffled aside), false (you, a ghost, a baked crowd), or a function
// answering one of those)
export function createMotion(P, groundAt, { constrain, sitFrequency = 2.2, space = true } = {}) {
	const { bones, map, rest, dna } = P;
	const H = (n) => rest.heads[map[n]];
	const g = dna.gait, signature = gaitSignature(dna.seed);
	const S = {
		// (want.travel: a way to move other than the way they face, a strafe or a step back, held
		// for want.travelT seconds; the feet step along it while the body stays on its heading)
		pos: new THREE.Vector3(), heading: 0, want: { speed: 0, heading: 0, run: 0, low: 0, travel: null, travelT: 0 }, strafe: new Spring(0, 1.3), travel: 0,
		speed: new Spring(0, 1.1), yaw: new Spring(0, 1.4), run: new Spring(0, 0.8), low: new Spring(0, 1.2),
		phase: signature.phase, signature, look: { target: null, yaw: new Spring(0, 2.2), pitch: new Spring(0, 2.2), eyeYaw: new Spring(0, 6), eyePitch: new Spring(0, 6), idleT: 0, idleYaw: 0, idlePitch: 0 },
		lean: new Spring(0, 1.5), turnLean: new Spring(0, 1.5), armL: new Spring(0, 2.5), armR: new Spring(0, 2.5), elbow: new Spring(0.3, 2),
		hipY: new Spring(0, 3), sway: new Spring(0, 1.8), breath: Math.random() * 10, shiftT: Math.random() * 10, shiftSide: Math.random() < 0.5 ? -1 : 1, shiftNext: 2 + Math.random() * 6,
		// the eyes' own small jumps (saccades), a few times a second
		sacc: { t: Math.random(), y: 0, p: 0 }, saccY: new Spring(0, 14), saccP: new Spring(0, 14),
		blink: 0, nextBlink: 1 + Math.random() * 4, talk: 0, talkT: 0, gesture: new Spring(0, 1.5), nod: new Spring(0, 3),
		legs: [0, 1].map((i) => ({ side: i ? -1 : 1, name: i ? 'R' : 'L', planted: true, inSwing: false, lock: new THREE.Vector3(), from: new THREE.Vector3(), phase: 0, init: false })),
		mood: Math.random(),
		// the pose held now, the lead hand, gestures in play, the face's feeling
		pose: 'rest', hand: Math.random() < 0.88 ? 'R' : 'L', gestures: [], feel: { joy: 0, sad: 0, anger: 0, surprise: 0 },
		arms: { L: armSprings(), R: armSprings() },
		headOv: { yaw: 0, pitch: 0, roll: 0 }, headYawS: new Spring(0, 3), headPitchS: new Spring(0, 3), headRollS: new Spring(0, 2),
		joyS: new Spring(0, 1.2), browS: new Spring(0, 2),
		// sitting: how far down into a seat (0 standing .. 1 seated), and the seat's height.
		// Optional floorPose adds folded feet/knee poles and torso lean only while seated.
		sitK: new Spring(0, sitFrequency), sitWant: 0, seatH: 0.46, floorPose: null,
		// a hand held by someone walking alongside, by side
		hold: { L: false, R: false },
		// a hand closed round something carried (ui/gear.js), by side: 0 open .. 1 a fist; and
		// the strong hand's index on a trigger (0 laid along the frame .. 1 on it)
		grip: { L: 0, R: 0 }, trigger: 0, trigK: 0,
		// a whole-body action over the walk (actions.js): its name, progress, weight, and its
		// channels eased so that one key pose flows into the next
		act: { name: null, u: 0, dur: 1, auto: false, w: 0, v: { sp: [0, 0, 0], hp: [0, 0, 0, 0], fL: [0, 0, 0], fR: [0, 0, 0], rt: [0, 0], hd: [0, 0, 0] }, has: {}, arms: null },
		// a blow taken (combat/melee.js): the chest and head knocked back, aside or round and
		// springing back, the hips pushed off their line; and a beat held still as it lands
		jolt: { p: new Spring(0, 2.6), r: new Spring(0, 2.6), y: new Spring(0, 2.2), x: new Spring(0, 2.4), z: new Spring(0, 2.4) }, freeze: 0,
		// a limp (combat/wounds.js): the bad leg (1 left, -1 right) and how bad (0..1): they hurry
		// off it, sink as it takes the weight and lean forward; and a hand held to a wound
		// (crysis/held-items.js applyClutch)
		limp: { side: 0, k: 0 }, clutch: null,
		// the groove (music/beat.js): how much of the music reaches this body (0..1, eased), how big
		// they move to it, and their own feel, a touch ahead of or behind the beat
		groove: { k: new Spring(0, 1.2), want: 0, size: 1, off: (((dna.seed || 0) % 97) / 97 - 0.5) * 0.08 },
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
	const footX = hipHalf * 0.55 * signature.width;
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
	// the legs' working values, made once: a pose is solved every frame for everyone in view, and
	// fresh vectors for each would keep a phone's garbage collector busy (micro-stalls)
	const ID_Q = new THREE.Quaternion(), legQ = { root: new THREE.Quaternion(), thigh: new THREE.Quaternion(), shin: new THREE.Quaternion() }, legInv = new THREE.Matrix4();
	const legV = { hip: new THREE.Vector3(), A: new THREE.Vector3(), toA: new THREE.Vector3(), hint: new THREE.Vector3(), floor: new THREE.Vector3(), knee: new THREE.Vector3(), ankle: new THREE.Vector3(), seg: new THREE.Vector3() };
	function frameQ(restA, a, f, out) {
		fa.copy(restA); fb.set(0, 0, 1).addScaledVector(fa, -fa.z).normalize(); fc.crossVectors(fa, fb);
		fm1.makeBasis(fa, fb, fc).transpose();
		fa.copy(a).normalize(); fb.copy(f).addScaledVector(fa, -f.dot(fa)).normalize(); fc.crossVectors(fa, fb);
		fm2.makeBasis(fa, fb, fc).multiply(fm1);
		return out.setFromRotationMatrix(fm2);
	}

	// where a leg's foot rests on the ground, lz metres ahead of the body's centre
	function nominal(leg, lz, out) {
		const c = Math.cos(S.heading), s = Math.sin(S.heading), tc = Math.cos(S.travel), ts = Math.sin(S.travel);
		// (standing, the feet a little further apart; stepping sideways, wider still, so the
		// trailing foot does not cross the leading one)
		const lx = leg.side * footX * (1.5 - 0.5 * smooth(S.speed.v / 0.9)) * (1 + 1.8 * Math.abs(Math.sin(S.strafe.v)));
		out.set(S.pos.x + lx * c + lz * ts, 0, S.pos.z - lx * s + lz * tc);
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
	// the action now: advanced, weighed in or out, its channels eased
	function actionNow(dt) {
		const X = S.act;
		if (X.auto && X.name) { X.u += dt / X.dur; if (X.u >= 1 && !ACTIONS[X.name]?.loop) { X.u = 1; if (X.once) X.name = null; } }
		X.w += ((X.name ? 1 : 0) - X.w) * Math.min(1, dt * 10);
		if (X.w < 0.002) { X.w = 0; X.arms = null; return X; }
		const a = X.name ? actionAt(X.name, X.u) : null;
		if (a) {
			const k = Math.min(1, dt * 14);
			for (const c of ['sp', 'hp', 'fL', 'fR', 'rt', 'hd']) { if (a.has[c]) { X.has[c] = true; for (let j = 0; j < X.v[c].length; j++) X.v[c][j] += (a[c][j] - X.v[c][j]) * k; } else if (c === 'fL' || c === 'fR') X.has[c] = false; else { let m = 0; for (let j = 0; j < X.v[c].length; j++) { X.v[c][j] *= 1 - k; m = Math.max(m, Math.abs(X.v[c][j])); } X.has[c] = m > 0.002; } }
			X.arms = { L: a.has.L ? { ...a.L } : null, R: a.has.R ? { ...a.R } : null };
		}
		return X;
	}
	function update(dt, t, cam) {
		P.motionTime = t;
		// (gone limp: the ragdoll moves the bones now, people/ragdoll.js)
		if (P.ragdoll) return;
		const solid = typeof space === 'function' ? space() : space;
		if (solid) noteBody(P, S, solid);
		dt = Math.min(dt, 0.05);
		// (the beat a blow holds still: hit-stop)
		if (S.freeze > 0) { S.freeze -= dt; dt *= 0.06; }
		const J = S.jolt, jp = J.p.to(0, dt), jr = J.r.to(0, dt), jy = J.y.to(0, dt), jx = J.x.to(0, dt), jz = J.z.to(0, dt);
		// a word in passing (people/chatter.js): the mouth moves and the eyes stay on who it was for
		if (S.remark) {
			if (performance.now() < S.remark.until) { S.talk = S.remark.speaking ? 1 : 0; S.look.target = S.remark.look; }
			else { S.remark = null; S.talk = 0; S.look.target = null; }
		}
		const X = actionNow(dt), aw = X.w;
		// ---- smoothed intentions ----
		const speed = Math.max(0, S.speed.to(S.want.speed, dt));
		const dh = wrap(S.want.heading - S.yaw.v);
		const heading = S.yaw.to(S.yaw.v + dh, dt);
		const turnRate = S.yaw.dv;
		S.heading = heading;
		// the body moves at the smoothed speed along the smoothed heading (or, strafing, along
		// its way of travel: no further round than a little past square to the side)
		S.want.travelT -= dt;
		const offWant = S.want.travel != null && S.want.travelT > 0 ? clamp(wrap(S.want.travel - heading), -1.9, 1.9) : 0;
		const travel = S.travel = heading + S.strafe.to(offWant, dt);
		// (constrain(to, from, dt): where the step would end, and where it began, to keep it
		// off walls: people/walls.js)
		_from.copy(S.pos);
		S.pos.x += Math.sin(travel) * speed * dt; S.pos.z += Math.cos(travel) * speed * dt;
		constrain?.(S.pos, _from, dt);
		const run = clamp(S.run.to(S.want.run, dt), 0, 1);
		// low (0..1): moving crouched, as a fighter does between cover: knees well bent, the body
		// folded forward over them, shorter quicker steps that barely leave the ground
		const low = clamp(S.low.to(S.want.low || 0, dt), 0, 1);
		// gait from speed, as people really walk: a stride (two steps) of about 0.83 of the height
		// at an easy 1.3 m/s, lengthening and quickening together as the pace picks up; the feet
		// are down 62% of the cycle walking, much less running
		const h = P.height;
		const drift = gaitDrift(signature, t);
		const stride = h * 0.83 * Math.pow(Math.max(speed, 0.25) / 1.3, 0.42) * g.stride / (signature.cadence * (1 + drift)) * (1 + run * 0.3) * (1 - low * 0.12);
		const stanceF = signature.stance - 0.24 * run;
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
		const Lp = S.limp, lk = Lp.side ? Math.min(1, Lp.k) : 0;
		if (lk > 0 && rate > 0) { const ub = (S.phase + (Lp.side < 0 ? 0.5 + signature.asymmetry : 0)) % 1; rate *= ub < stanceF ? 1 + 0.75 * lk : 1 - 0.3 * lk; }
		S.phase = (S.phase + rate * dt) % 1;
		P.clothMat?.userData.U?.uClothMove?.value.set(t, speed, S.phase, turnRate);
		const amp = smooth(speed / 0.9);
		// ---- the groove: moving to the music's beat, by how much of it reaches here. The body
		// drops into each beat (the knees) and nods with it, a shoulder lifts on each count, the
		// chest turns a little each way, the weight goes from foot to foot over two beats, and
		// the head turns to look about over a bar; walking, only the nod and the shoulders stay
		const Gr = S.groove, gk = Gr.k.to(Gr.want, dt);
		let gBounce = 0, gNod = 0, gLean = 0, gTwist = 0, gRoll = 0, gSway = 0, gShrugL = 0, gShrugR = 0, gArm = 0, gLook = 0;
		if (gk > 0.002) {
			const B = beatNow();
			const b = B.beat + Gr.off, ph = b - Math.floor(b), ea = gk * B.on * (0.7 + 0.6 * B.energy) * Gr.size;
			const hit = dip(ph), hitL = dip(ph + 0.06 - Math.floor(ph + 0.06)), even = ((Math.floor(b) % 2) + 2) % 2 === 0;
			const still = 1 - amp;
			gBounce = ea * h * 0.022 * hit * (1 - 0.8 * amp);
			gNod = ea * (0.05 + 0.06 * still) * hitL;
			gLean = ea * 0.03 * hit * still;
			gTwist = ea * 0.05 * Math.sin(b * Math.PI) * still;
			gRoll = ea * 0.015 * Math.sin(b * Math.PI) * still;
			gSway = -ea * 0.028 * Math.cos(b * Math.PI * 0.5) * still;
			gShrugL = ea * 0.3 * hit * (even ? 1 : 0.25); gShrugR = ea * 0.3 * hit * (even ? 0.25 : 1);
			gArm = ea * 0.12 * hit * still;
			gLook = ea * 0.18 * Math.sin(b * Math.PI * 0.5 + 1.2) * still;
		}
		// how far the foot rolls: toes up at the heel strike, the heel peeling up before toe-off
		const heelP = -0.24 * amp, toeP = (1.1 - 0.3 * run) * amp;

		// ---- feet: where each ankle goes (world) ----
		const feet = [];
		for (const leg of S.legs) {
			const u = (S.phase + (leg.side < 0 ? 0.5 + signature.asymmetry : 0)) % 1;
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
				const lift = h * signature.lift * (0.05 + 0.05 * run) * (1 - low * 0.35) * 6.75 * su * (1 - su) * (1 - su) * (rate && amp > 0.2 ? 1 : 0.5);
				ankle.y = Math.max(ankle.y, gy + ankleH * 0.9) + lift;
				pitch = su < 0.45 ? toeP * (1 - smooth(su / 0.45)) : heelP * smooth((su - 0.45) / 0.55);
				leg.lock.set(ankle.x, gy, ankle.z);
			}
			feet.push({ leg, ankle, pitch, u, gy, stance: !leg.inSwing });
		}

		// seated: the feet set down a little ahead of the seat, flat
		const sitK = clamp(S.sitK.to(S.sitWant, dt), 0, 1), floorPose = S.floorPose;
		if (sitK > 0.001) {
			const c = Math.cos(S.heading), sn = Math.sin(S.heading);
			// (a child on a grown-up's chair: the shins hang straight down, the feet off the floor)
			const hang = S.pos.y + S.seatH + 0.07 - shinLen;
			for (const f of feet) {
				const placed = floorPose?.feet?.[f.leg.name], scale = h / 1.75;
				const lx = placed ? placed[0] * scale : f.leg.side * hipHalf * 1.1;
				let lz = placed ? placed[2] * scale : h * 0.25;
				_v2.set(S.pos.x + lx * c + lz * sn, 0, S.pos.z - lx * sn + lz * c);
				const floor = groundAt(_v2.x, _v2.z), dangle = hang > floor + ankleH;
				if (dangle) { lz = thighLen * 0.92; _v2.set(S.pos.x + lx * c + lz * sn, 0, S.pos.z - lx * sn + lz * c); }
				_v2.y = floor;
				f.gy += (_v2.y - f.gy) * sitK;
				_v2.y = dangle ? hang : floor + ankleH + (placed?.[1] || 0) * scale;
				f.ankle.lerp(_v2, sitK); f.pitch = f.pitch * (1 - sitK) + (dangle ? 0.35 * sitK : 0);
				if (sitK > 0.5) { f.leg.lock.set(_v2.x, f.gy, _v2.z); f.leg.planted = true; f.leg.inSwing = false; }
			}
		}
		// an action's feet: set where it puts them (in the body's frame)
		if (aw > 0) {
			const c = Math.cos(S.heading), sn = Math.sin(S.heading);
			for (const f of feet) {
				const key = f.leg.name === 'L' ? 'fL' : 'fR';
				if (!X.has[key]) continue;
				const [lx, ly, lz] = X.v[key];
				_v2.set(S.pos.x + lx * c + lz * sn, 0, S.pos.z - lx * sn + lz * c);
				const floor = groundAt(_v2.x, _v2.z);
				_v2.y = (sitK > 0.5 ? S.pos.y : floor) + ly + ankleH;
				f.ankle.lerp(_v2, aw); f.pitch *= 1 - aw;
				if (aw > 0.5) { f.leg.lock.set(_v2.x, floor, _v2.z); f.leg.planted = true; f.leg.inSwing = false; f.gy = Math.min(f.gy, floor + Math.max(0, ly)); }
			}
		}
		// ---- the body over the feet ----
		const gy = Math.min(groundAt(S.pos.x, S.pos.z), Math.max(feet[0].gy, feet[1].gy));
		// the pelvis cannot sit higher than the lower foot allows
		const lowFoot = Math.min(feet[0].gy, feet[1].gy);
		S.pos.y = S.hipY.to(Math.min(gy, lowFoot + 0.02), dt);
		// weight over the stance foot; standing, the weight rests on one leg a while, then
		// shifts to the other
		S.shiftT += dt;
		S.shiftNext -= dt;
		if (S.shiftNext <= 0) { S.shiftSide = -S.shiftSide; S.shiftNext = 3 + Math.random() * 9 * (1 - (dna.temper?.fidget ?? 0.5) * 0.6); }
		const idleSway = (1 - amp) * (S.shiftSide * (0.016 + S.mood * 0.012) + Math.sin(S.shiftT * 0.35 + S.mood * 5) * 0.006);
		const sway = S.sway.to((Math.sin(S.phase * TAU) + drift * 2) * 0.02 * signature.sway * amp * (1 - run * 0.6) + idleSway, dt) + gSway * (1 - sitK);
		const lean = S.lean.to(low * 0.95 + lk * 0.1 + (-0.06 + (floorPose?.lean || 0)) * sitK + g.posture + 0.03 * amp + 0.14 * run + (dna.age > 70 ? 0.06 : 0) + (0.5 - (dna.temper?.confident ?? 0.5)) * 0.08 + (POSES[S.pose]?.lean || 0), dt);
		const turnLean = S.turnLean.to(clamp(-turnRate * speed * 0.05, -0.12, 0.12), dt);
		// the pelvis turns the leading hip forward (most at each heel strike) and drops a little
		// on the side of the swinging leg
		const pelvisYaw = -Math.cos(S.phase * TAU + signature.armLag) * 0.07 * signature.twist * amp * (1 + run * 0.4);
		const pelvisRoll = Math.cos(S.phase * TAU) * 0.035 * signature.roll * amp + idleSway * 1.2 + turnLean + gRoll;
		// the hips: standing tall, a touch lower running; then no higher than the planted legs
		// reach with the knee just soft, which makes the walk rise over each stance foot and
		// dip as the weight passes from one to the other; running adds the flight
		const hc = Math.cos(heading), hs = Math.sin(heading), yc = Math.cos(pelvisYaw), ys = Math.sin(pelvisYaw);
		let hipH = hipStand - h * (0.002 + run * 0.035) - (dna.age > 70 ? 0.02 : 0) + run * (Math.abs(Math.sin(S.phase * TAU)) - 0.5) * 0.05;
		// (the beat: the knees give on each one, standing)
		hipH -= gBounce * (1 - sitK);
		for (const f of feet) {
			if (!f.stance || sitK > 0.5) continue;
			const bx = f.leg.side * hipHalf * yc + sway, bz = -f.leg.side * hipHalf * ys;
			const dx = f.ankle.x - (S.pos.x + bx * hc + bz * hs), dz = f.ankle.z - (S.pos.z - bx * hs + bz * hc), R = legFull * 0.999;
			const d2 = Math.min(dx * dx + dz * dz, R * R * 0.9);
			hipH = smin(hipH, f.ankle.y - S.pos.y + Math.sqrt(R * R - d2));
		}
		// (crouched: the hips well down, the knees taking it)
		hipH -= low * 0.16 * (h / 1.75);
		// (the bad leg taking the weight: the hips sink over it)
		if (lk > 0) for (const f of feet) if (f.stance && f.leg.side === Lp.side && rate > 0) hipH -= lk * 0.05 * (h / 1.75) * Math.sin(Math.PI * Math.min(1, f.u / Math.max(0.1, stanceF))) * amp;
		const hipY = hipH * (1 - sitK) + (S.seatH + 0.09) * sitK - (X.has.hp ? X.v.hp[3] * aw : 0);
		const bob = hipH - hipStand;

		// body space: the person's own frame (+z forward)
		P.root.position.copy(S.pos);
		if (X.has.rt && aw > 0) P.root.rotation.set(X.v.rt[0] * aw, heading, X.v.rt[1] * aw, 'YXZ');
		else P.root.rotation.set(0, heading, 0, 'YXZ');

		// ---- pelvis ----
		const rootI = map.root, rootB = bones[rootI];
		rootB.position.set(rest.heads[rootI].x + sway + jx, rest.heads[rootI].y - hipRest + hipY, rest.heads[rootI].z + jz);
		const hpo = X.has.hp ? X.v.hp : null;
		_e.set(lean * 0.35 + (hpo ? hpo[1] * aw : 0), pelvisYaw + (hpo ? hpo[0] * aw : 0), pelvisRoll + (hpo ? hpo[2] * aw : 0), 'YXZ');
		const rootQ = legQ.root.setFromEuler(_e);
		setLocal(rootI, rootQ, ID_Q);

		// ---- legs: two-bone IK in body space ----
		P.root.updateMatrixWorld(true);
		const inv = legInv.copy(P.root.matrixWorld).invert();
		const rootPos = rootB.position;
		for (const f of feet) {
			const s = f.leg.name;
			const iT = map['upperleg01.' + s], iS = map['lowerleg01.' + s], iF = map['foot.' + s];
			const hip = legV.hip.copy(rest.heads[iT]).sub(rest.heads[rootI]).applyQuaternion(rootQ).add(rootPos);
			const A = legV.A.copy(f.ankle).applyMatrix4(inv);
			const l1 = rest.heads[iS].distanceTo(rest.heads[iT]), l2 = rest.heads[iF].distanceTo(rest.heads[iS]);
			const toA = legV.toA.copy(A).sub(hip); let dist = toA.length();
			dist = clamp(dist, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.9995);
			const dir = toA.normalize();
			// the knee points where the foot does, straight ahead but for the slight toe-out
			const toeOut = pelvisYaw * 0.3 + f.leg.side * 0.1 + (hpo ? hpo[0] * aw * 0.8 : 0);
			const kneeHint = legV.hint.set(f.leg.side * 0.02, 0, 1).applyAxisAngle(Y, toeOut * 0.6).normalize();
			if (floorPose?.knees?.[s]) kneeHint.lerp(legV.floor.set(...floorPose.knees[s]).normalize(), sitK).normalize();
			const bend = kneeHint.addScaledVector(dir, -kneeHint.dot(dir)).normalize();
			const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
			const knee = legV.knee.copy(hip).addScaledVector(dir, cosA * l1).addScaledVector(bend, Math.sqrt(Math.max(0, 1 - cosA * cosA)) * l1);
			const ankle = legV.ankle.copy(hip).addScaledVector(dir, dist);
			const [rT, rS] = legRest[s];
			setWorld(iT, frameQ(rT, legV.seg.copy(knee).sub(hip), bend, legQ.thigh), worldQ[rootI]);
			setWorld(iS, frameQ(rS, legV.seg.copy(ankle).sub(knee), bend, legQ.shin), worldQ[iT]);
			// the foot: forward (toes a little out), pitched through the roll-over
			const footYaw = toeOut * (1 - (floorPose ? sitK : 0)) + (floorPose?.feet?.[s]?.[3] || 0) * sitK;
			setWorld(iF, _q.setFromAxisAngle(Y, footYaw).multiply(_q2.setFromAxisAngle(AX, f.pitch)), worldQ[iS]);
		}

		// ---- spine: counter-rotation, lean, breath ----
		S.breath += dt * (0.24 + amp * 0.15 + run * 0.3);
		// breathing: the chest lifts and the shoulders rise a little on each breath in (in
		// quicker than out), most visibly standing still
		const bph = S.breath % 1, br = (bph < 0.4 ? Math.sin(bph / 0.4 * Math.PI / 2) : Math.cos((bph - 0.4) / 0.6 * Math.PI / 2)) * 2 - 1, brA = 1 + (1 - amp) * 0.8;
		const counter = -pelvisYaw * 1.6;
		const sp = X.has.sp ? X.v.sp.map((v) => v * aw) : [0, 0, 0];
		sp[2] += (floorPose?.roll || 0) * sitK;
		sp[0] += gTwist; sp[1] += gLean;
		setLocal(map.spine04, _q.setFromEuler(_e.set(lean * 0.25 + sp[1] * 0.3 + jp * 0.25, counter * 0.3 + sp[0] * 0.3 + jy * 0.3, -pelvisRoll * 0.5 + sp[2] * 0.3 + jr * 0.25)), worldQ[rootI]);
		setLocal(map.spine02, _q.setFromEuler(_e.set(lean * 0.2 + br * 0.014 * brA + sp[1] * 0.35 + jp * 0.35, counter * 0.35 + sp[0] * 0.35 + jy * 0.35, -pelvisRoll * 0.3 + sp[2] * 0.35 + jr * 0.35)), worldQ[map.spine04]);
		setLocal(map.spine01, _q.setFromEuler(_e.set(lean * 0.15 - br * 0.015 * brA + sp[1] * 0.35 + jp * 0.4, counter * 0.35 + sp[0] * 0.35 + jy * 0.35, -pelvisRoll * 0.2 + sp[2] * 0.35 + jr * 0.4)), worldQ[map.spine02]);

		// ---- gaze: head and eyes toward something worth looking at ----
		const L = S.look;
		L.idleT -= dt;
		if (L.idleT <= 0) { L.idleT = 1.5 + Math.random() * 4; L.idleYaw = (Math.random() - 0.5) * (speed > 0.3 ? 0.5 : 1.2); L.idlePitch = (Math.random() - 0.4) * 0.3; }
		let ty = L.idleYaw, tp = L.idlePitch;
		let tgt = L.target || (cam && cam.distanceTo(S.pos) < 7 ? cam : null);
		// you, close by (or whoever is told to look at you: a favour's giver, someone you talk to),
		// are looked at but not stared at: a few seconds of meeting your eyes, then a glance away
		// and back, often with a blink as the eyes move (a held gaze reads as a stare). Someone
		// speaking to you keeps your eyes while the words come.
		if (tgt && tgt === cam) {
			L.meetT = (L.meetT ?? 1 + Math.random() * 2) - dt;
			if (L.meetT <= 0) {
				L.away = !L.away;
				L.meetT = L.away ? 0.7 + Math.random() * 1.6 : 1.6 + Math.random() * 3;
				if (L.away) { L.idleT = L.meetT + 0.5; L.idleYaw = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.45); L.idlePitch = (Math.random() - 0.25) * 0.25; ty = L.idleYaw; tp = L.idlePitch; }
				if (Math.random() < 0.5 && S.nextBlink > 0.3) S.nextBlink = 0.05;
			}
			if (L.away && !(S.talk > 0)) tgt = null;
		} else L.away = false;
		if (tgt) {
			const eyeHeight = P.height * 0.93 - (floorPose ? hipStand - hipY : 0);
			const dx = tgt.x - S.pos.x, dz = tgt.z - S.pos.z, dy = tgt.y - (S.pos.y + eyeHeight);
			const rel = wrap(Math.atan2(dx, dz) - heading);
			if (Math.abs(rel) < 1.8) { ty = clamp(rel, -1.2, 1.2); tp = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.5); }
		}
		// leading into turns
		ty = clamp(ty + turnRate * 0.25, -1.3, 1.3);
		const hy = L.yaw.to(ty, dt), hp = L.pitch.to(tp, dt);
		const chestYaw = counter, chestPitch = lean * 0.6;
		const nod = S.nod.to(S.talk > 0 ? Math.max(0, Math.sin(t * 3.1)) * 0.08 : 0, dt);
		const HO = S.headOv, droop = (0.5 - (dna.temper?.confident ?? 0.5)) * 0.1 + (POSES[S.pose]?.look || 0) + (X.has.hd ? X.v.hd[1] * aw : 0);
		const hdy = (X.has.hd ? X.v.hd[0] * aw - sp[0] : 0) + jy * 1.4 + gLook, hdr = (X.has.hd ? X.v.hd[2] * aw : 0) + jr * 1.2;
		const jh = jp * 1.6 + gNod;
		setLocal(map.neck01, _q.setFromEuler(_e.set(hp * 0.4 - chestPitch * 0.5 + nod * 0.4 + (HO.pitch + droop + jh) * 0.4, (hy - chestYaw) * 0.4 + (HO.yaw + hdy) * 0.4, pelvisRoll * 0.3 + (HO.roll + hdr) * 0.4, 'YXZ')), worldQ[map.spine01]);
		setLocal(map.head, _q.setFromEuler(_e.set(hp * 0.6 - chestPitch * 0.4 + nod * 0.6 - bob * 0.8 + (HO.pitch + droop + jh) * 0.6, (hy - chestYaw) * 0.6 + (HO.yaw + hdy) * 0.6, pelvisRoll * 0.3 + (HO.roll + hdr) * 0.6, 'YXZ')), worldQ[map.neck01]);
		// the eyes lead the head, then settle
		const ey = L.eyeYaw.to(clamp(ty - hy, -0.45, 0.45), dt), ep = L.eyePitch.to(clamp(tp - hp, -0.3, 0.3), dt);
		// saccades: small quick jumps about what they are looking at (wider when nothing holds
		// the gaze), now and then with a blink; and the eyes turned in a touch towards what is near
		const Sc = S.sacc;
		Sc.t -= dt;
		if (Sc.t <= 0) {
			Sc.t = 0.3 + Math.random() * (tgt ? 1.2 : 2.2);
			Sc.y = (Math.random() - 0.5) * (tgt ? 0.07 : 0.16); Sc.p = (Math.random() - 0.5) * (tgt ? 0.04 : 0.08);
			if (Math.random() < 0.12 && S.nextBlink > 0.3) S.nextBlink = 0.04;
		}
		const sy = S.saccY.to(Sc.y, dt), spp = S.saccP.to(Sc.p, dt);
		const verg = tgt ? clamp(0.032 / Math.max(0.4, Math.hypot(tgt.x - S.pos.x, tgt.z - S.pos.z)), 0.004, 0.07) : 0.008;
		for (const eye of P.eyes) eye.rotation.set(ep + spp, ey + sy - Math.sign(eye.position.x) * verg, 0, 'YXZ');
		// far off, the eyes, lashes and brows are not drawn
		if (cam && !(P.fadeK < 0.6)) {
			const dd = Math.hypot(cam.x - S.pos.x, cam.z - S.pos.z);
			if (P.eyes[0] && P.eyes[0].visible !== dd < 30) for (const eye of P.eyes) eye.visible = dd < 30;
			if (P.detail) P.detail.visible = dd < 14;
		}

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
			const actArm = X.arms?.[side];
			if (actArm) for (const k of ARM_KEYS) tgt[k] = tgt[k] * (1 - aw) + actArm[k] * aw;
			// the walk: swing from the shoulder, the elbow bending as the arm comes forward
			const sw = (side === 'L' ? -swingNow : swingNow) * swingA * amp * (S.hold[side] ? 0.25 : 1) * (actArm ? 1 - aw : 1);
			if (!actArm) tgt.bend += run * 1.0;
			// running: forearms up, hands loosely closed
			if (run > 0.01) { tgt.curl = tgt.curl * (1 - run) + 0.65 * run; tgt.pro = tgt.pro * (1 - run) + PALM_SIDE * run; }
			const A = S.arms[side];
			const P2 = {};
			for (const k of ARM_KEYS) A[k].w = actArm ? 7 * TAU : 2.4 * TAU;
			for (const k of ARM_KEYS) P2[k] = A[k].to(tgt[k] + (k === 'flex' && gp ? (ov.beat || 0) * (lead ? 0.12 : 0.05) : 0), dt);
			// (the swing itself goes on after the springs, which would only lag and damp it)
			// (the beat: a shoulder up on each count, the elbows pulsing with it when the hands are free)
			P2.shrug += side === 'L' ? gShrugL : gShrugR;
			if (!actArm && gArm > 0) { const free = POSES[S.pose]?.swing ?? 1; P2.bend += gArm * free; P2.flex += gArm * 0.4 * free; }
			if(S.pose==='type' && !actArm){const tap=Math.sin(t*17+sx*1.7+dna.seed);P2.wflex+=tap*.07;P2.curl+=Math.max(0,tap)*.15;P2.flex+=Math.sin(t*2.1+sx)*.025;}
			P2.flex += sw - 0.05 * amp * (POSES[S.pose]?.swing ?? 1); P2.bend += Math.max(0, sw) * 0.6 + 0.08 * amp;
			const iC = map['clavicle.' + side], iSh = map['shoulder01.' + side], iU = map['upperarm01.' + side], iU2 = map['upperarm02.' + side], iL = map['lowerarm01.' + side], iL2 = map['lowerarm02.' + side], iW = map['wrist.' + side];
			// the shoulder girdle: shrugs, breath, a confident person's shoulders back and down
			const back = (T.confident - 0.5) * 0.08;
			setLocal(iC, _q.setFromEuler(_e.set(0, (-sw * 0.06 - back) * sx, (br * 0.016 * brA + Math.max(0, sw) * 0.04 + P2.shrug * 0.28) * sx)), worldQ[map.spine01]);
			setLocal(iSh, _q.identity(), worldQ[iC]);
			// the upper arm: down, then out to the side, then forward
			const up = _v.set(0, -1, 0).applyAxisAngle(Z, sx * (0.04 + dna.weight * 0.05 + P2.abd)).applyAxisAngle(AX, -P2.flex).applyAxisAngle(Y, counter * 0.3).clone();
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
				// (the thumb never quite straight: at rest it lies a little in toward the palm)
				const relaxed = f === 1 ? 0.22 + j * 0.06 : (0.1 + f * 0.05) * (j === 2 ? 1.2 : j === 3 ? 0.8 : 1);
				let c = relaxed + (1.25 - relaxed) * Math.max(P2.curl, S.grip[side] * 0.85);
				if (f === 2 && gp?.point && lead) c = 0.02;
				// a long arm in both hands: the strong hand's index lies straight along the frame
				// above the guard, or hooks round the trigger when aiming (trigger())
				if (f === 2 && side === 'R' && S.grip.R > 0.95 && S.grip.L > 0.95) {
					if (j === 1) S.trigK += (S.trigger - S.trigK) * (1 - Math.exp(-dt * 12));
					c = TRIGGER_OFF[j - 1] + (TRIGGER_ON[j - 1] - TRIGGER_OFF[j - 1]) * S.trigK;
				}
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
			// talking: syllables in phrases, with pauses between
			if (S.talk > 0) {
				S.talkT += dt;
				const phrase = smooth(Math.sin(S.talkT * 0.9 + S.mood * 4) * 2 + 0.7), syl = Math.max(0, Math.sin(S.talkT * 12.5 + Math.sin(S.talkT * 3.7) * 1.6));
				infl[1] = syl * (0.1 + 0.26 * phrase);
			} else infl[1] *= 0.8;
			// feelings fade back to this person's resting face
			for (const k in S.feel) S.feel[k] *= Math.exp(-dt * 0.25);
			const joy = S.joyS.to(0.12 + (dna.temper?.warmth ?? 0.5) * 0.18 + S.feel.joy * 0.7 - S.feel.sad * 0.3 - S.feel.anger * 0.3 + (S.talk > 0 ? 0.1 + Math.sin(S.talkT * 0.7) * 0.08 : 0), dt);
			infl[2] = clamp(joy, 0, 1);
			const brow = S.browS.to(S.feel.surprise * 0.9 + S.feel.sad * 0.4 + (S.talk > 0 ? Math.max(0, Math.sin(S.talkT * 1.7)) * 0.3 : 0), dt);
			infl[3] = clamp(brow, 0, 1);
		}
	}
	// a gesture now (queued behind any in play), a pose to settle into, a feeling to show
	function gesture(name, dur) { if (!GESTURES[name]) return; if (S.gestures.length >= 3) S.gestures.splice(1, 1); S.gestures.push({ name, t: 0, dur: dur || GDUR[name] || 2 }); }       // the newest wins over stale ones
	// let a gesture in play go: it eases out from where it is
	function ungesture(name) { for (const q of S.gestures) if (q.name === name) q.dur = Math.min(q.dur, q.t + 0.45); }
	function setPose(name) { if (POSES[name]) S.pose = name; }
	function feel(k, v = 1) { if (k in S.feel) S.feel[k] = Math.max(S.feel[k], v); }
	// sit(h): down into a seat h metres up (now: already sitting); stand(): up again
	const sit = (h = 0.46, now = false) => { S.sitWant = 1; S.seatH = h; if (now) { S.sitK.v = 1; S.sitK.dv = 0; } };
	const stand = () => { S.sitWant = 0; };
	// hold(side, on): a hand held (or let go)
	const hold = (side, on = true) => { S.hold[side] = !!on; };
	// act(name, u): hold an action at progress u (the caller drives it); play(name, dur): run it
	// through once (or round and round, for a looping one); act(null): let it go
	const act = (name, u) => { const X = S.act; if (!name) { X.name = null; X.auto = false; return; } if (X.name !== name) X.u = u ?? 0; X.name = name; X.auto = u === undefined; if (u !== undefined) X.u = u; X.once = false; };
	const play = (name, dur = 1, once = false) => { const X = S.act; X.name = name; X.u = 0; X.dur = dur; X.auto = true; X.once = once; };
	// jolt(dx, dz, k, twist): a blow travelling along world (dx, dz) at strength k (about 1 for a
	// punch, 3 for a haymaker); twist turns the head and chest round with it (a hook). hold:
	// seconds of hit-stop before it plays out
	const jolt = (dx, dz, k = 1, twist = 0, hold = 0) => {
		const h = S.heading, f = dx * Math.sin(h) + dz * Math.cos(h), s = dx * Math.cos(h) - dz * Math.sin(h), J = S.jolt;
		J.p.dv += f * k * 9; J.r.dv -= s * k * 7; J.y.dv += twist * k * 8;
		// (the hips go with it, in the body's own frame)
		J.x.dv += s * k * 0.9; J.z.dv += f * k * 0.9;
		if (hold > 0) S.freeze = Math.max(S.freeze, hold);
	};
	// groove(k, size): how much of the music reaches this body (0 none .. 1 right by it), and how
	// big they move to it (about 1; a child or a dancer more, an elder less)
	const groove = (k, size) => { S.groove.want = clamp(+k || 0, 0, 1); if (size !== undefined) S.groove.size = clamp(+size || 0, 0, 2); };
	return { S, update, gesture, ungesture, setPose, feel, sit, stand, hold, act, play, jolt, groove, grip: (side, k) => { S.grip[side] = Math.max(0, Math.min(1, +k || 0)); }, trigger: (side, k) => { if (side === 'R') S.trigger = Math.max(0, Math.min(1, +k || 0)); }, poses: POSES, want: S.want, setGround(fn) { if (typeof fn !== 'function') return; groundAt = fn; for (const l of S.legs) l.init = false; }, place(x, y, z, heading) { S.pos.set(x, y, z); S.yaw.v = S.heading = S.want.heading = heading; S.travel = heading; S.strafe.v = S.strafe.dv = 0; S.want.travel = null; S.hipY.v = y; for (const l of S.legs) { l.init = false; l.planted = true; l.inSwing = false; } S.speed.v = 0; S.speed.dv = 0; } };
}
