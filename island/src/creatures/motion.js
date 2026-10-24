// How a creature moves: its bones turned by hand each frame, as the dinosaurs and the people are
// (no baked clips). A creature model (creatures/models.js) comes with its rig's joints in model
// space (meta.joints, from tools/monsters/build.py), so every motion here is written in the
// model's own axes (x to its left, y up, z forward) and turned into each bone's frame as it goes.
//
// A rig kind (meta.rig) picks the body plan: 'biped' (two legs, two arms), 'quad' (four legs, a
// tail), 'flyer' (wings and hanging legs) or 'spider' (eight legs); more come with their
// creatures. Each plan answers the same calls: a gait at a speed, an idle, a strike, a hit from a
// side, a death. They blend: the gait's weight follows the speed, a strike or a hit is laid over
// whatever the body is doing, and death takes it over.
//
// Under all of it is who this one is (character(): drawn afresh each time its body is handed
// out, creatures/models.js vary()): how hunched, how low, how it holds its arms, which way its
// head is cocked, the beat and length of its stride, a limp, a stutter in its going, and a slow
// wobble through every bit of it, so no two of a mob stand or march alike (Josh 2026-10-24:
// "scary posed postures ... the march cadence different even with the same mobs"). The sheets
// were drawn arms out from the body; the stance brings each arm in to hang as this one holds it.

import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const sanitize = (n) => n.replace(/[\s.\[\]:/]/g, '');

const _ax = new THREE.Vector3(), _v = new THREE.Vector3(), _hv = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _e = new THREE.Euler();

// who it is: its own way of standing and going. tame: a person still (the Moonturned before the
// change), who stands as people do. Pure numbers (no three), so it can be checked on its own
export function character(rnd = Math.random, { tame = false } = {}) {
	const u = (a, b) => a + rnd() * (b - a);
	const r2 = () => rnd() + rnd() - 1; // -1..1, most near the middle
	const t = tame ? 0.25 : 1;
	const P = {
		// the stance: the back bowed (hunch), the knees bent (low), the arms out from the sides
		// (spread, rad) and hanging forward (reach), the elbows bent, the hands curled to claws,
		// the head thrust out (jut), glaring from under the brow (glare), cocked over (cock) and
		// turned a little (turn), one shoulder higher (shrug), a lean to one side, one arm more
		// forward than the other (asym)
		hunch: u(0.2, 0.75) * t, low: u(0.08, 0.55) * t, spread: tame ? u(0.1, 0.18) : u(0.08, 0.36), reach: u(0, 0.42) * t,
		elbow: u(0.15, 0.8) * (tame ? 0.4 : 1), claw: u(0, 0.7) * t, jut: u(0, 0.32) * t, glare: u(-0.04, 0.3) * t,
		cock: r2() * 0.38 * t, turn: r2() * 0.2 * t, shrug: r2() * 0.13 * t, lean: r2() * 0.08 * t, asym: r2() * 0.3 * t,
		// how it shows you it means harm: claws up and forward, looming over you (shoulders up,
		// arms bowed out and forward), or down low with the knuckles near the ground
		threat: tame ? null : ['claws', 'loom', 'low'][Math.floor(rnd() * 3)],
		// its going: steps quicker or slower than another's at the same speed (cad), longer or
		// shorter (stride), the bob in it, the arms' swing, the knee lift, a waddle from hip to hip
		cad: tame ? u(0.92, 1.08) : u(0.78, 1.3), stride: u(0.86, 1.14), bounce: u(0.5, 1.8), swing: u(0.4, 1.5), lift: u(0.7, 1.35), waddle: u(0, 1) * t,
		// a bad leg (the stride hurried and shortened on it, the body dipping onto it)
		limp: !tame && rnd() < 0.3 ? u(0.15, 0.55) : 0, limpSide: rnd() < 0.5 ? 1 : -1,
		// at a run, its arms: swinging, held out ahead reaching for you, or swept back behind
		carry: tame ? 'swing' : ['swing', 'fore', 'back'][Math.floor(rnd() * 3)],
		// a stutter in its going (stop, go, stop: the way a thing not quite alive comes on), and
		// a surge with each push
		stutter: !tame && rnd() < 0.25 ? u(0.3, 0.8) : 0, surge: u(0, 0.6) * t,
		// its breath, a tremble in it, how often it does the little things it does
		breath: u(0.7, 1.6), pant: u(0.5, 1.5), tremor: !tame && rnd() < 0.35 ? u(0.3, 1) : 0, fidget: u(0.7, 1.6),
		// the slow wobble through all of it: two waves each, every one its own
		wob: Array.from({ length: 10 }, () => [u(0.13, 0.5), u(0, TAU), u(0.31, 0.9), u(0, TAU)]),
		// (a hound's own: where its head rides, how its tail is carried, how wide it stands)
		carriage: r2() * 0.18 * t, tail: r2() * 0.3, wide: r2() * 0.06,
		phase: rnd() * TAU, seed: rnd() * 100,
	};
	return P;
}

// the little moments between: [kind, weight, length s, when (0 any time, 1 only at ease, 2 only
// at you)]; those in UPPER use only the upper body, and may come on the move as well
const BEATS = {
	quad: [['twitch', 3, 0.9, 0], ['scrape', 2, 1.6, 0], ['growl', 2, 2.2, 2], ['sniff', 2, 1.7, 1], ['shake', 1, 0.9, 1], ['pant', 2, 2.4, 0], ['stretch', 1, 2.2, 1], ['scratch', 1, 1.8, 1], ['snap', 2, 0.8, 2], ['stalk', 2, 2.6, 2], ['look', 1, 1.8, 1]],
	biped: [['twitch', 3, 1.0, 0], ['tilt', 2, 2.3, 0], ['crack', 1, 1.3, 0], ['crouch', 2, 2.0, 0], ['claws', 2, 1.6, 2], ['scratch', 1, 1.8, 1], ['look', 2, 2.0, 1], ['sway', 1, 2.6, 0], ['sniff', 1, 1.6, 1], ['shrug', 1, 1.2, 0], ['feint', 2, 0.9, 2], ['taunt', 1, 1.6, 2], ['hop', 1, 0.9, 0]],
	flyer: [['twitch', 1, 0.8, 0], ['bob', 1, 1.4, 0]],
	spider: [['twitch', 3, 0.7, 0], ['tap', 2, 1.1, 0], ['groom', 1, 1.6, 1], ['rear', 1, 1.4, 2], ['bob', 1, 1.0, 0]],
};
const UPPER = new Set(['twitch', 'tilt', 'look', 'sniff', 'shrug', 'claws', 'crack']);
// its blows: a biped's chop (overhead and down), sweep (round from the side), lunge (both claws
// driven at you), double (one hand then the other), pounce (a small one's leap); a hound's bite,
// a bite and shake, a forepaw's rake; a crawler's stab or lunge
const STRIKES = { biped: ['chop', 'sweep', 'lunge', 'double'], quad: ['bite', 'shake', 'swipe'], spider: ['stab', 'lunge'], flyer: ['stab'] };

export function createCreatureMotion(root, meta) {
	let skel = null;
	root.traverse((o) => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
	if (!skel) return null;
	const byName = new Map();
	for (const b of skel.bones) byName.set(b.name, b);
	const bones = [];
	const J = meta.joints || {};
	for (const name of meta.bones) {
		const b = byName.get(sanitize(name)) || byName.get(name);
		if (!b) continue;
		const j = J[name];
		bones.push({
			name, b, rest: b.quaternion.clone(), restPos: b.position.clone(),
			// which side of the body (from the joint's x in model space), and the rotation to lay on
			side: j ? Math.sign((j[0][0] + j[1][0]) / 2) : 0, rot: new THREE.Euler(0, 0, 0, 'YXZ'),
		});
	}
	const B = Object.fromEntries(bones.map((x) => [x.name, x]));
	// things that hang from a hand (a lantern) keep hanging: their rest turn in model space,
	// whatever the arm does, with a little swing behind it
	root.updateMatrixWorld(true);
	const rootQ0 = root.getWorldQuaternion(new THREE.Quaternion()).invert();
	const hang = (meta.hang || []).map((n) => B[n]).filter(Boolean)
		.map((x) => ({ x, restModel: x.b.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQ0), swing: 0, last: null }));
	// the model's root frame: the armature's parent (glTF scene root) in world space
	const H = meta.height || 2;
	const hipH = J.hips ? J.hips[0][1] : H * 0.5;
	const len = (n) => { const j = J[n]; return j ? Math.hypot(j[1][0] - j[0][0], j[1][1] - j[0][1], j[1][2] - j[0][2]) : 0; };
	// each leg as the sheet drew it, seen from the side (y, z in the model), for a crouch that
	// keeps the foot where it is: the thigh from the hip to the knee, the knee to where the foot's
	// bone turns (its ankle, or its heel on a long foot drawn from the heel: the Burnt Giant's),
	// and hip to foot; each as a length and a way it points (atan2 of z over y: a turn about x)
	const LEG = {};
	for (const sd of ['L', 'R']) {
		const t = J['thigh_' + sd], sh = J['shin_' + sd], f = J['foot_' + sd];
		if (!t || !sh) continue;
		const F = f ? f[0] : sh[1];
		const uy = sh[0][1] - t[0][1], uz = sh[0][2] - t[0][2], vy = F[1] - sh[0][1], vz = F[2] - sh[0][2], wy = F[1] - t[0][1], wz = F[2] - t[0][2];
		const a = Math.hypot(uy, uz), b = Math.hypot(vy, vz), c = Math.hypot(wy, wz);
		if (a < 1e-4 || b < 1e-4 || c < 1e-4) continue;
		// (which way from the hip-to-foot line the thigh turns: the knee kept on the side it is on)
		const cr = Math.sign(wy * uz - wz * uy) || 1;
		LEG[sd] = { a, b, c, wy, wz, fu: Math.atan2(uz, uy), fv: Math.atan2(vz, vy), cr, out: [0, 0, 0] };
	}
	// the arms as the sheet drew them: how far out from straight down each piece points (in the
	// body's x-y plane), and whether a hand holds something (a spade, a maul, a staff: a prop
	// hung from that arm; a sword put in it later, meta.held). The stance brings an empty arm
	// in to hang where this one holds it, a holding arm only a little
	const outOf = (n) => { const j = J[n]; return j ? Math.atan2(Math.abs(j[1][0] - j[0][0]), j[0][1] - j[1][1]) : 0; };
	const ARM = {};
	for (const sd of ['L', 'R']) ARM[sd] = { u: outOf('upperarm_' + sd), f: outOf('forearm_' + sd), h: outOf('hand_' + sd) };
	const holds = { L: false, R: false };
	for (const n of meta.props || []) {
		for (let p = B[n]?.b.parent; p?.isBone; p = p.parent) {
			const m = /^(?:hand|forearm|upperarm)_([LR])$/.exec(p.name);
			if (m) { holds[m[1]] = true; break; }
		}
	}
	const holding = (sd) => holds[sd] || !!meta.held?.includes(sd);
	const small = H < 1.6;
	const state = { phase: 0, speed: 0, gait: 0, strike: -1, strikeSide: 1, strikeKind: null, hit: -1, hitDir: new THREE.Vector3(0, 0, -1), death: -1, t: 0, look: 0, lunge: 0,
		// the little things it does when it is not going anywhere (a beat: a twitch, a paw scraping
		// the ground, a growl), how much it means you harm (menace 0..1: low and trembling), and how
		// still it stands (dormant 0..1: the Burnt Giant a tree among the trees); events for the
		// world to hear and see (a growl, a scuff of dirt), taken by drain()
		beat: null, beatT: 1 + Math.random() * 3, menace: 0, dormant: 0, seed: Math.random() * 100, events: [],
		// a blow's weight (hitK: 1 a round, more a heavy one) and the shove it gives the body: the
		// hips knocked along it and swinging back on a spring, the head and tail lagging behind
		hitK: 1, sway: { x: 0, z: 0, vx: 0, vz: 0 },
		// the pose it is handed back in (from lying as a ragdoll, people/ragdoll.js): each bone's
		// turn in the world then, blended out over dur s
		blend: null,
		// who it is (character()), its going sideways (lat: the share of its steps that go to the
		// side, latSign which way), how hard it is skidding to a stop (skid 0..1), and the moments
		// between going and stopping: settling as it stops, the push as it sets off (each a time
		// 0..1 through it, -1 none, and how hard)
		P: character(), lat: 0, latSign: 1, skid: 0, settle: -1, settleK: 0, launch: -1, peak: 0, low: 0,
		// what the plans ask of the hips this frame: up (m, + up) and forward (m, + ahead)
		hy: 0, hz: 0, crouch: 0, strideK: 1, flap: 0 };
	state.phase = state.flap = state.P.phase;

	function clear() { for (const x of bones) x.rot.set(0, 0, 0); state.hy = 0; state.hz = 0; state.crouch = 0; }
	const R = (n) => B[n]?.rot;
	// (in a beat, an arm with something in it, a staff, a spade, a sword, does only a little of
	// what the beat asks of the arms: armK, set while the beats are laid on)
	let armK = null;
	const HOLDK = {};
	const add = (n, x, y, z) => { const r = R(n); if (r) { const k = armK ? HOLDK[n] ?? 1 : 1; r.x += x * k; r.y += y * k; r.z += z * k; } };
	// its slow wobble, channel i, in -1..1
	const wob = (i) => { const w = state.P.wob[i % 10]; return Math.sin(state.t * w[0] + w[1]) * 0.6 + Math.sin(state.t * w[2] + w[3]) * 0.4; };

	// a jerky value for a beat: held, then snapped to the next in a few hundredths of a second, n
	// times over the beat (the way a thing that is not quite an animal moves), in -1..1
	const hash = (a, i) => { const x = Math.sin(a * 12.9898 + i * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
	function jerk(k, n, salt) {
		const f = k * n, i = Math.floor(f), u = f - i;
		const a = i <= 0 ? 0 : hash(state.seed + salt, i - 1), b = hash(state.seed + salt, i);
		return a + (b - a) * smooth(u / 0.12);
	}
	// a beat's weight: in fast, out at its end
	const env = (k, a = 0.06, b = 0.2) => smooth(k / a) * (1 - smooth((k - 1 + b) / b));
	// a bump: up over a, held, down by b (a shape in a strike's time)
	const bump = (k, a0, a1, b0, b1) => smooth((k - a0) / (a1 - a0)) * (1 - smooth((k - b0) / (b1 - b0)));
	// the rattle of a growl, felt through the body
	const rattle = (t) => Math.sin(t * 41) * 0.6 + Math.sin(t * 57 + 1) * 0.4;
	function startBeat(kind) {
		const list = BEATS[meta.rig] || BEATS.biped;
		const b = list.find((x) => x[0] === kind) || list[0];
		state.beat = { kind: b[0], k: 0, dur: b[2] * (0.85 + Math.random() * 0.3), side: Math.random() < 0.5 ? 1 : -1, salt: Math.random() * 50, at: [] };
		state.events.push(b[0] === 'snap' ? 'growl' : b[0]);
	}
	// each one at a moment of its beat: an event once (a scuff as the claws drag)
	function once(b, k, name) { if (b.k >= k && !b.at.includes(k)) { b.at.push(k); state.events.push(name); } }
	// a crouch of a (how far the thighs would swing forward were thigh and shin alike): the hips sunk
	// by the drop that makes, the thigh turned on the hip and the shin on the knee so the foot stays
	// where it stood, and the foot turned back flat (a knee bent over the shortened leg, whatever
	// the lengths): [thigh, shin, foot] for leg L (x, as the turn about x), and the drop
	const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
	function knees(L, drop) {
		const { a, b, wy, wz, fu, fv, cr, out } = L;
		const ny = wy + drop, nz = wz, c = Math.hypot(ny, nz);
		const al = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1));
		const fu2 = Math.atan2(nz, ny) + cr * al;
		const ky = a * Math.cos(fu2), kz = a * Math.sin(fu2);
		const dt = wrap(fu2 - fu), ds = wrap(Math.atan2(nz - kz, ny - ky) - fv);
		out[0] = dt; out[1] = ds - dt; out[2] = -ds;
		return out;
	}
	// every crouch asked for in a frame (the stance's, a blow's wind-up, a beat's) summed and laid on
	// the legs once (legsDown, before apply), so two together sink the hips as far as they bend the
	// knees and the feet stay on the ground
	function crouchLegs(a) { if (a > 0) state.crouch += a; }
	function legsDown() {
		const a = Math.min(state.crouch, 1.25);
		if (!(a > 0)) return;
		// (the hips sink as far as the shorter leg's crouch takes them; no further than its knee folds)
		let drop = Infinity;
		for (const sd of ['L', 'R']) { const L = LEG[sd]; if (L) drop = Math.min(drop, L.c * (1 - Math.cos(a)), L.c - Math.abs(L.a - L.b) * 1.05 - 0.02 * L.c); }
		if (!Number.isFinite(drop) || drop <= 0) return;
		for (const sd of ['L', 'R']) {
			const L = LEG[sd];
			if (!L) continue;
			const [t, sh, f] = knees(L, drop);
			add('thigh_' + sd, t, 0, 0); add('shin_' + sd, sh, 0, 0); add('foot_' + sd, f, 0, 0);
		}
		state.hy -= drop;
	}

	// ---------- biped: two legs, two arms, a spine ----------
	// how it stands: its own crouch and hunch, the head thrust out to glare, the arms brought in
	// from the sheet's pose to hang where this one holds them, claws curled, a shoulder up; more
	// so when it means you harm, each in its own way (claws up, looming over you, or down low)
	function bipedStance(g, run) {
		const s = state, P = s.P, k = 1 - s.dormant;
		if (k <= 0) return;
		const m = s.menace * (1 - g * 0.6);
		const claws = P.threat === 'claws' ? m : 0, wide = P.threat === 'loom' ? m : 0, down = P.threat === 'low' ? m : 0;
		const br = Math.sin(s.t * 1.7 * P.breath) * (1 + m * P.pant);
		crouchLegs((P.low * (1 - g * 0.55) + down * 0.3 + claws * 0.12 + wob(0) * 0.05 * (1 - g)) * k);
		const hu = (P.hunch * (1 - run * 0.3) + run * 0.25 + down * 0.25 + claws * 0.1 + wide * 0.15 + wob(1) * 0.05) * k;
		add('spine', hu * 0.45 + br * 0.012, 0, (P.lean + wob(2) * 0.03) * k * (1 - g * 0.5));
		add('chest', hu * 0.4 - br * 0.018, wob(3) * 0.05 * k, (P.shrug + wob(9) * 0.03) * k);
		add('neck', (-hu * 0.5 + P.jut) * k, 0, 0);
		const tr = P.tremor ? Math.sin(s.t * 47 + P.seed) * 0.014 * P.tremor * (0.4 + m) : 0;
		add('head', (-hu * 0.35 - P.jut + P.glare + down * 0.1 + wob(4) * 0.06) * k + tr, (P.turn + wob(5) * 0.14) * k * (1 - g * 0.5), (P.cock + wob(6) * 0.09) * k * (1 - g * 0.4) + tr);
		for (const sd of ['L', 'R']) {
			const sg = sd === 'L' ? 1 : -1, A = ARM[sd], hold = holding(sd);
			const kk = (hold ? 0.3 : 1) * k;
			// (out from its sides: its own spread, a little wider to loom, a give with each breath;
			// never out toward the sheet's arms-out pose, whatever it does with them)
			const tU = Math.min(0.48, P.spread + wide * 0.12 + claws * 0.06 + wob(7 + (sg > 0 ? 0 : 1)) * 0.04);
			const tF = Math.max(0.02, tU - 0.12 - P.elbow * 0.15);
			const fw = P.reach + sg * P.asym * 0.5 + claws * 0.5 + down * 0.25 + wide * 0.25;
			add('upperarm_' + sd, -fw * (hold ? 0.3 : 1) * k, sg * wide * 0.12 * k, -sg * (A.u - tU) * kk + sg * br * 0.012 * k);
			add('forearm_' + sd, -(P.elbow + claws * 1.0 + wide * 0.6) * (hold ? 0.3 : 1) * k, 0, -sg * (A.f - A.u + tU - tF) * kk);
			add('hand_' + sd, (-P.claw - claws * 0.45) * (hold ? 0.2 : 1) * k + (hold ? 0 : tr * 2), 0, -sg * (A.h - A.f) * 0.7 * kk);
			add('arm2_' + sd, -fw * 0.5 * k, 0, -sg * 0.15 * kk);
		}
	}
	function biped(_dt) {
		const s = state, P = s.P;
		const g = s.gait * (1 - s.skid);
		const ph = s.phase;
		const stalk = meta.stalk ?? 0.35; // how hunched the gait is
		const run = clamp((Math.abs(s.speed) - 2.2) / 2.5, 0, 1) * g;
		const fwd = 1 - s.lat, lat = s.lat * s.latSign;
		bipedStance(g, run);
		// legs: swing, knee lift, foot roll; a bad leg's stride shorter and stiffer, hurried through
		for (const side of ['L', 'R']) {
			const sg = side === 'L' ? 1 : -1;
			const bad = P.limp && sg === P.limpSide ? P.limp : 0;
			const o = side === 'L' ? 0 : Math.PI;
			const p = ph + o + bad * 0.6 * Math.sin(ph + o);
			const sw = Math.sin(p);
			const lift = Math.max(0, Math.sin(p + Math.PI / 2));
			const amp = 0.42 * g * s.strideK * (1 - bad * 0.45);
			add('thigh_' + side, (-sw * amp - 0.12 * g * stalk) * fwd, 0, sw * amp * 0.55 * lat);
			add('shin_' + side, lift * 0.85 * g * P.lift * (1 - bad * 0.6) + 0.08 * g * stalk, 0, 0);
			add('foot_' + side, -lift * 0.35 * g + sw * 0.15 * g * fwd, 0, -sw * amp * 0.3 * lat);
			// arms against the legs, hanging forward with the hunch; at a run, held as this one
			// holds them (swinging, out ahead reaching for you, or swept back behind it)
			const carry = P.carry === 'swing' ? 0 : run;
			const arm = -Math.sin(p + Math.PI) * 0.32 * g * P.swing * (1 - carry * 0.8);
			add('upperarm_' + side, arm - 0.1 * stalk * g, 0, 0);
			add('forearm_' + side, -0.18 * g - Math.max(0, -arm) * 0.6, 0, 0);
			if (carry > 0 && !holding(side)) {
				if (P.carry === 'fore') { add('upperarm_' + side, -0.9 * carry + Math.sin(p) * 0.1 * carry, 0, sg * 0.12 * carry); add('forearm_' + side, -0.45 * carry, 0, 0); add('hand_' + side, -0.3 * carry, 0, 0); }
				else { add('upperarm_' + side, 0.8 * carry, 0, sg * 0.3 * carry); add('forearm_' + side, -0.25 * carry, 0, 0); }
			}
			// a second pair of arms (the Burnt Giant's) swings out of step with the first
			add('arm2_' + side, -arm * 0.7, 0, 0);
			add('arm2b_' + side, -0.15 * g - Math.max(0, arm) * 0.4, 0, 0);
		}
		// spine: the hunch, the twist against the hips, the breath; a waddle from hip to hip, and on a
		// bad leg the body dipping onto it
		const br = Math.sin(s.t * 1.7 * P.breath) * 0.025;
		const dip = P.limp ? Math.max(0, -Math.sin(ph + (P.limpSide > 0 ? 0 : Math.PI) - Math.PI / 2)) * P.limp * g : 0;
		const wd = Math.sin(ph) * P.waddle * g;
		add('spine', 0.1 * stalk * g + br, -Math.sin(ph) * 0.08 * g, -wd * 0.04);
		add('chest', 0.08 * stalk * g - br * 0.5, Math.sin(ph) * 0.12 * g, Math.sin(ph) * 0.04 * g - wd * 0.05 + P.limpSide * dip * 0.08);
		add('hips', 0, Math.sin(ph) * 0.1 * g, Math.sin(ph) * 0.05 * g + wd * 0.1 - P.limpSide * dip * 0.14);
		add('neck', -0.1 * stalk * g, 0, 0);
		add('head', Math.sin(s.t * 0.7) * 0.05 * (1 - g) + dip * 0.12, s.look * 0.8, Math.sin(s.t * 0.43) * 0.06 * (1 - g));
		s.hy -= dip * 0.05 * hipH;
		// a robe or a skirt: it swings a little with the stride and settles at rest
		add('robe', -Math.abs(Math.sin(ph)) * 0.05 * g, Math.sin(ph) * 0.05 * g, Math.sin(ph) * 0.04 * g + Math.sin(s.t * 0.8) * 0.01);
		// idle: weight on one leg, arms hang loose and sway
		const idle = 1 - g;
		add('upperarm_L', Math.sin(s.t * 0.9) * 0.04 * idle, 0, 0.04 * idle);
		add('upperarm_R', Math.sin(s.t * 0.9 + 1) * 0.04 * idle, 0, -0.04 * idle);
		add('forearm_L', -0.12 * idle, 0, 0);
		add('forearm_R', -0.12 * idle, 0, 0);
		add('hips', 0, 0, Math.sin(s.t * 0.6 * P.fidget + P.seed) * 0.035 * idle * (1 - s.dormant));
		// the moments between: the push as it sets off (low, leaning into it), the settle as it
		// stops (the weight rocking on over the feet and back)
		if (s.launch >= 0) {
			const k = Math.sin(s.launch * Math.PI);
			add('spine', 0.3 * k, 0, 0); add('chest', 0.15 * k, 0, 0); add('head', -0.25 * k, 0, 0);
			crouchLegs(0.3 * k);
			for (const sd of ['L', 'R']) add('upperarm_' + sd, (sd === 'L' ? 0.5 : -0.5) * k, 0, 0);
		}
		if (s.settle >= 0) {
			const k = Math.sin(s.settle * TAU) * (1 - s.settle) * s.settleK;
			add('spine', 0.22 * k, 0, 0); add('chest', 0.1 * k, 0, 0); add('head', -0.15 * k, 0, 0);
			for (const sd of ['L', 'R']) { add('upperarm_' + sd, -0.35 * k, 0, 0); add('forearm_' + sd, -0.3 * k, 0, 0); }
			crouchLegs(Math.max(0, k) * 0.25);
		}
		// a skid: braced back against the slide, the lead leg out ahead with the heel dug in, the
		// other folded under, arms thrown out for balance, eyes on what it was running at
		if (s.skid > 0) {
			const k = s.skid, lead = P.limpSide > 0 ? 'R' : 'L', back = lead === 'L' ? 'R' : 'L';
			add('spine', -0.3 * k, 0, 0); add('chest', -0.15 * k, 0, 0); add('neck', 0.15 * k, 0, 0); add('head', 0.2 * k, 0, 0);
			add('thigh_' + lead, -0.75 * k, 0, 0); add('shin_' + lead, 0.1 * k, 0, 0); add('foot_' + lead, 0.5 * k, 0, 0);
			add('thigh_' + back, 0.15 * k, 0, 0); add('shin_' + back, 1.0 * k, 0, 0); add('foot_' + back, -0.35 * k, 0, 0);
			for (const sd of ['L', 'R']) { const sg = sd === 'L' ? 1 : -1; add('upperarm_' + sd, -0.3 * k, 0, sg * 0.8 * k); add('forearm_' + sd, -0.4 * k, 0, 0); }
			s.hy -= 0.16 * hipH * k; s.hz -= 0.05 * hipH * k;
		}
		bipedStrike();
		// a hit: the body thrown the way the blow went
		if (s.hit >= 0) {
			const k = Math.sin(clamp(s.hit / 0.45, 0, 1) * Math.PI) * (1 - s.hit) * s.hitK;
			const d = s.hitDir;
			add('chest', d.z * 0.45 * k, 0, -d.x * 0.4 * k);
			add('spine', d.z * 0.25 * k, 0, -d.x * 0.2 * k);
			add('head', d.z * 0.5 * k, 0, -d.x * 0.5 * k);
			add('upperarm_L', -0.4 * k, 0, 0.3 * k);
			add('upperarm_R', -0.4 * k, 0, -0.3 * k);
		}
		// death: the knees go, the body folds and goes over
		if (s.death >= 0) {
			const k = smooth(s.death / 1.1);
			for (const side of ['L', 'R']) {
				add('thigh_' + side, -1.2 * k, 0, 0);
				add('shin_' + side, 1.9 * k, 0, 0);
				add('upperarm_' + side, -0.4 * k, 0, (side === 'L' ? 0.5 : -0.5) * k);
			}
			add('spine', 0.5 * k, 0, 0);
			add('chest', 0.3 * k, 0, 0.2 * k);
			add('head', 0.4 * k, 0.3 * k, 0);
		}
	}
	// a biped's blow, its kind drawn as it is struck: every one winds up through the first third
	// (read it and step back) and lands by 0.45-0.5 of its time, when the fight weighs it
	// (combat/ai-squads.js)
	function chop(k, side, sg, w = 1) {
		const wind = smooth(k / 0.35) * (1 - smooth((k - 0.35) / 0.15));
		const cut = smooth((k - 0.35) / 0.15) * (1 - smooth((k - 0.6) / 0.4));
		add('upperarm_' + side, (-2.5 * wind - 0.9 * cut) * w, 0, sg * (0.5 * wind - 0.4 * cut) * w);
		add('forearm_' + side, (-0.9 * wind - 0.2 * cut) * w, 0, 0);
		add('chest', (0.15 * cut - 0.1 * wind) * w, sg * (0.35 * wind - 0.5 * cut) * w, 0);
		add('spine', 0.2 * cut * w, 0, 0);
		add('head', (-0.2 * wind + 0.15 * cut) * w, 0, 0);
	}
	function bipedStrike() {
		const s = state;
		if (s.strike < 0) return;
		const k = s.strike, sg = s.strikeSide, side = sg > 0 ? 'L' : 'R', other = side === 'L' ? 'R' : 'L';
		const kind = s.strikeKind || 'chop';
		if (kind === 'chop') chop(k, side, sg);
		else if (kind === 'double') {
			// one hand, then the other: the first a feint as much as a blow, the second the one that lands
			chop(clamp(k * 1.9, 0, 1), other, -sg, 0.75);
			chop(clamp((k - 0.16) * 1.6, 0, 1), side, sg);
		} else if (kind === 'sweep') {
			// drawn out and back, the body turned away, then swept round flat through you
			const wind = bump(k, 0, 0.33, 0.33, 0.45), cut = bump(k, 0.3, 0.48, 0.55, 0.95);
			add('upperarm_' + side, -0.4 * wind - 1.3 * cut, sg * (0.8 * wind - 1.1 * cut), sg * (1.2 * wind + 0.25 * cut));
			add('forearm_' + side, -0.5 * wind - 0.15 * cut, 0, 0);
			add('chest', 0.05 * cut, sg * (0.55 * wind - 0.75 * cut), 0);
			add('spine', 0.1 * cut, sg * (0.2 * wind - 0.3 * cut), 0);
			add('head', 0, -sg * (0.25 * wind - 0.3 * cut), 0);
			crouchLegs(0.2 * (wind + cut));
		} else if (kind === 'lunge') {
			// down, both claws drawn back, then the whole body driven forward behind them
			const wind = bump(k, 0, 0.33, 0.33, 0.43), out = bump(k, 0.32, 0.47, 0.58, 1);
			for (const sd of ['L', 'R']) {
				const g2 = sd === 'L' ? 1 : -1;
				add('upperarm_' + sd, 0.7 * wind - 1.55 * out, 0, g2 * (0.35 * wind + 0.15 * out));
				add('forearm_' + sd, -1.0 * wind - 0.15 * out, 0, 0);
				add('hand_' + sd, -0.4 * wind + 0.3 * out, 0, 0);
			}
			add('spine', 0.25 * wind + 0.4 * out, 0, 0); add('chest', 0.1 * wind + 0.2 * out, 0, 0); add('head', -0.2 * wind - 0.35 * out, 0, 0);
			crouchLegs(0.5 * wind + 0.15 * out);
			add('thigh_' + other, 0.35 * out, 0, 0); add('shin_' + other, 0.2 * out, 0, 0);
			s.hz += 0.16 * hipH * out;
		} else if (kind === 'pounce') {
			// a small one's leap: right down, then up off the ground at you, both arms out, and down again
			const sq = bump(k, 0, 0.3, 0.3, 0.36), air = bump(k, 0.3, 0.4, 0.5, 0.62), land = bump(k, 0.55, 0.65, 0.75, 1);
			crouchLegs(0.75 * sq + 0.5 * land);
			for (const sd of ['L', 'R']) {
				const g2 = sd === 'L' ? 1 : -1;
				add('thigh_' + sd, -0.7 * air, 0, 0); add('shin_' + sd, 1.1 * air, 0, 0);
				add('upperarm_' + sd, 0.6 * sq - 1.7 * air - 0.4 * land, 0, g2 * (0.3 * air + 0.2 * land));
				add('forearm_' + sd, -0.7 * sq - 0.2 * air, 0, 0);
			}
			add('spine', 0.35 * sq + 0.2 * air + 0.3 * land, 0, 0); add('head', -0.3 * sq - 0.3 * air, 0, 0);
			s.hy += 0.4 * hipH * air;
		}
	}

	// ---------- quad: four legs, a long back, a neck and a tail ----------
	// front legs upperarm / forearm / hand, hind legs thigh / shin / foot / toe (the hock), as the
	// Ridge Hound's sheet is boned (tools/monsters/specs)
	function quad(_dt) {
		const s = state, P = s.P;
		const g = s.gait * (1 - s.skid);
		const ph = s.phase;
		const fwd = 1 - s.lat, lat = s.lat * s.latSign;
		// a trot (the diagonal pairs together) that opens into a bounding run with the speed: the
		// back flexes and stretches with each bound
		const run = clamp((Math.abs(s.speed) - 2.5) / 4, 0, 1) * g;
		const legs = [['L', 'F', 0], ['R', 'H', 0], ['R', 'F', Math.PI], ['L', 'H', Math.PI]];
		for (const [side, end, o0] of legs) {
			const sg = side === 'L' ? 1 : -1;
			// the bound brings the two front feet nearly together, and the two hind ones; a lame
			// leg (its own) touches down short and quick
			const bad = P.limp && sg === P.limpSide && end === 'F' ? P.limp : 0;
			const o = o0 + run * (end === 'H' ? 1.3 : 0) + run * (side === 'R' ? 0.35 : 0) * (end === 'F' ? 1 : -1);
			const p = ph + o + bad * 0.6 * Math.sin(ph + o);
			const sw = Math.sin(p);
			const lift = Math.max(0, Math.sin(p + Math.PI / 2)) * P.lift;
			const amp = (0.38 + 0.3 * run) * g * s.strideK * (1 - bad * 0.5);
			// (how wide it stands, its own)
			const wz = sg * P.wide;
			if (end === 'F') {
				add('upperarm_' + side, -sw * amp * fwd, 0, sw * amp * 0.5 * lat + wz);
				add('forearm_' + side, -lift * 0.35 * g, 0, 0);
				// the wrist folds back as the paw comes up
				add('hand_' + side, lift * 1.1 * g * (1 + bad), 0, 0);
			} else {
				add('thigh_' + side, -sw * amp * 0.9 * fwd, 0, sw * amp * 0.5 * lat + wz);
				add('shin_' + side, -lift * 0.45 * g, 0, 0);
				add('foot_' + side, lift * 0.7 * g, 0, 0);
				add('toe_' + side, -lift * 0.5 * g, 0, 0);
			}
		}
		const fl = Math.sin(ph * 2) * 0.05 * g * P.bounce + Math.sin(ph) * 0.14 * run;
		const br = Math.sin(s.t * 1.9 * P.breath) * 0.015 * (1 + s.menace * P.pant);
		add('spine', fl + br, Math.sin(ph) * 0.05 * g, 0);
		add('chest', -fl * 0.6, -Math.sin(ph) * 0.05 * g + wob(3) * 0.03, Math.sin(ph) * 0.03 * g);
		add('hips', 0, Math.sin(ph) * 0.06 * g, -Math.sin(ph) * 0.04 * g);
		// head low and level on the move (a hunting carriage), nodding with the stride; its own
		// carriage, cocked a little, the head stirring as it watches
		const stalk = meta.stalk ?? 0.35;
		add('neck', 0.18 * stalk * g + Math.sin(ph * 2) * 0.05 * g + P.carriage + wob(4) * 0.05, 0, 0);
		add('head', -0.12 * stalk * g + Math.sin(s.t * 0.6) * 0.06 * (1 - g) - P.carriage * 0.6 + wob(5) * 0.05, s.look * 0.8 + Math.sin(s.t * 0.37) * 0.2 * (1 - g) + P.turn * (1 - g), (P.cock * 0.6 + wob(6) * 0.06) * (1 - g * 0.5));
		// the tail: carried as this one carries it, swinging with the hips
		for (const [i, n] of ['tail1', 'tail2', 'tail3'].entries()) add(n, -0.05 * g * i - (i === 0 ? P.tail : 0) + wob(7 + i) * 0.05, Math.sin(ph - i * 0.8) * (0.12 + 0.1 * i) * g + Math.sin(s.t * 1.1 - i) * 0.08 * (1 - g), 0);
		// a rider (the Hound Rider's goblin): riding the stride, leaning back into a run, looking about
		add('rider_spine', -0.12 * run + Math.cos(ph * 2) * 0.04 * g + P.hunch * 0.3, Math.sin(ph) * 0.06 * g + wob(8) * 0.08, P.lean);
		add('rider_head', -Math.cos(ph * 2) * 0.05 * g + P.glare * 0.5, s.look * 0.6 + Math.sin(s.t * 0.5) * 0.4 * (1 - g), P.cock * 0.6);
		add('rider_upperarm_R', -0.2 * run, 0, 0);
		// ears turning to sounds
		add('ear_L', 0, Math.max(0, Math.sin(s.t * 0.9 + P.seed)) * 0.3, 0);
		add('ear_R', 0, -Math.max(0, Math.sin(s.t * 0.7 + 2 + P.seed)) * 0.3, 0);
		// its own crouch: some go low-slung, belly to the grass
		quadLow(P.low * 0.6 * (1 - g * 0.6));
		// the moments between going and stopping: a push off the hind legs, a rock forward as it stops
		if (s.launch >= 0) {
			const k = Math.sin(s.launch * Math.PI);
			quadLow(0.4 * k, ['thigh', 'shin']);
			add('neck', 0.2 * k, 0, 0); add('head', -0.15 * k, 0, 0);
		}
		if (s.settle >= 0) {
			const k = Math.sin(s.settle * TAU) * (1 - s.settle) * s.settleK;
			add('chest', 0.1 * k, 0, 0); add('neck', 0.25 * k, 0, 0); add('head', -0.2 * k, 0, 0);
			quadLow(Math.max(0, k) * 0.3, ['upperarm', 'forearm']);
		}
		// a skid: the forelegs braced out ahead, the hind ones under it, sitting into the slide, head up
		if (s.skid > 0) {
			const k = s.skid;
			for (const sd of ['L', 'R']) {
				add('upperarm_' + sd, -0.55 * k, 0, 0); add('forearm_' + sd, 0.2 * k, 0, 0); add('hand_' + sd, -0.35 * k, 0, 0);
				add('thigh_' + sd, -0.45 * k, 0, 0); add('shin_' + sd, 0.35 * k, 0, 0); add('foot_' + sd, -0.2 * k, 0, 0);
			}
			add('spine', -0.15 * k, 0, 0); add('neck', -0.3 * k, 0, 0); add('head', 0.2 * k, 0, 0); add('tail1', -0.35 * k, 0, 0);
			s.hy -= 0.12 * hipH * k;
		}
		quadStrike();
		// a hit: the body thrown the way the blow went, the head snapped round
		if (s.hit >= 0) {
			const k = Math.sin(clamp(s.hit / 0.45, 0, 1) * Math.PI) * (1 - s.hit) * s.hitK;
			const d = s.hitDir;
			add('chest', d.z * 0.25 * k, 0, -d.x * 0.3 * k);
			add('spine', -d.z * 0.15 * k, 0, -d.x * 0.2 * k);
			add('neck', d.z * 0.4 * k, -d.x * 0.4 * k, 0);
			add('head', 0.2 * k, -d.x * 0.3 * k, 0);
		}
		// death: the legs go, it drops and rolls onto its side
		if (s.death >= 0) {
			const k = smooth(s.death / 1.0);
			for (const side of ['L', 'R']) {
				add('upperarm_' + side, 0.6 * k, 0, 0);
				add('forearm_' + side, -0.9 * k, 0, 0);
				add('thigh_' + side, 0.6 * k, 0, 0);
				add('shin_' + side, -0.8 * k, 0, 0);
			}
			add('hips', 0, 0, 1.25 * smooth((s.death - 0.3) / 0.8));
			add('neck', -0.3 * k, 0, 0);
			add('head', 0.3 * k, 0, 0.3 * k);
			add('tail1', 0.3 * k, 0, 0);
		}
	}
	// a hound's legs bent under it (the front pair, the hind pair, or both), the body let down
	function quadLow(a, which = ['upperarm', 'forearm', 'thigh', 'shin']) {
		if (a <= 0.001) return;
		for (const sd of ['L', 'R']) {
			if (which.includes('upperarm')) { add('upperarm_' + sd, 0.3 * a, 0, 0); add('forearm_' + sd, -0.5 * a, 0, 0); add('hand_' + sd, 0.2 * a, 0, 0); }
			if (which.includes('thigh')) { add('thigh_' + sd, 0.3 * a, 0, 0); add('shin_' + sd, -0.45 * a, 0, 0); add('foot_' + sd, 0.25 * a, 0, 0); }
		}
		state.hy -= 0.1 * hipH * a * (which.length / 4);
	}
	function quadStrike() {
		const s = state;
		if (s.strike < 0) return;
		const k = s.strike, kind = s.strikeKind || 'bite', sd0 = s.strikeSide > 0 ? 'L' : 'R';
		// crouched on the forelegs, then the head thrown forward and the jaws snapped
		const crouch = smooth(k / 0.35) * (1 - smooth((k - 0.35) / 0.15));
		const bite = smooth((k - 0.35) / 0.12) * (1 - smooth((k - 0.6) / 0.4));
		if (kind === 'swipe') {
			// up off one forepaw, raked down across you, the head turned away from it
			const up = bump(k, 0, 0.33, 0.36, 0.46), rake = bump(k, 0.36, 0.48, 0.58, 0.95);
			add('upperarm_' + sd0, -1.3 * up + 0.4 * rake, 0, s.strikeSide * (0.3 * up - 0.2 * rake));
			add('forearm_' + sd0, -0.6 * up + 0.3 * rake, 0, 0);
			add('hand_' + sd0, 0.6 * up - 0.3 * rake, 0, 0);
			add('chest', -0.2 * up + 0.1 * rake, 0, s.strikeSide * 0.12 * up);
			add('neck', -0.15 * up + 0.2 * rake, -s.strikeSide * 0.2 * up, 0);
			add('ear_L', -0.4 * up, 0, 0); add('ear_R', -0.4 * up, 0, 0);
		} else {
			for (const side of ['L', 'R']) {
				add('upperarm_' + side, 0.35 * crouch - 0.45 * bite, 0, 0);
				add('forearm_' + side, -0.5 * crouch + 0.2 * bite, 0, 0);
				add('thigh_' + side, 0.25 * crouch - 0.2 * bite, 0, 0);
				add('shin_' + side, -0.35 * crouch, 0, 0);
				add('foot_' + side, 0.3 * crouch, 0, 0);
			}
			add('chest', 0.12 * crouch - 0.1 * bite, 0, 0);
			add('neck', 0.35 * crouch - 0.45 * bite, 0, 0);
			add('head', -0.25 * crouch + 0.3 * bite, s.strikeSide * 0.15 * bite, 0);
			add('ear_L', -0.4 * crouch, 0, 0);
			add('ear_R', -0.4 * crouch, 0, 0);
			// a bite and shake: the jaws held and the head thrashed side to side
			if (kind === 'shake') {
				const th = bump(k, 0.45, 0.52, 0.8, 0.95) * Math.sin(k * 55);
				add('neck', 0, th * 0.35, th * 0.2); add('head', 0, th * 0.3, th * 0.35); add('chest', 0, 0, -th * 0.08);
			}
		}
		// (its rider swings down at you as it bites)
		add('rider_upperarm_R', -1.6 * crouch + 1.2 * bite, 0, -0.4 * crouch);
		add('rider_forearm_R', -0.6 * crouch, 0, 0);
		add('rider_spine', 0.15 * bite, -0.2 * bite, 0);
	}

	// ---------- flyer: two pairs of wings beating, six legs hanging (the Lampeater) ----------
	function flyer(_dt) {
		const s = state, P = s.P;
		const alive = s.death < 0 ? 1 : 0;
		// a slow beat hovering, quicker on the move; the hind wings a little behind the fore; each
		// one its own beat
		const ph = s.flap;
		const w = Math.sin(ph), w2 = Math.sin(ph - 0.45);
		for (const side of ['L', 'R']) {
			const sg = side === 'L' ? 1 : -1;
			add('wing_' + side, 0, sg * 0.08 * s.gait, sg * (w * 0.75 + 0.1) * alive);
			add('wing2_' + side, 0, 0, sg * (w2 * 0.6 + 0.05) * alive);
			// the legs hang, swept back on the move, stirring
			for (const [k, n] of ['leg1', 'leg2', 'leg3'].entries()) {
				add(`${n}a_${side}`, 0.3 * s.gait + Math.sin(s.t * 1.3 + k + sg + P.seed) * 0.08, 0, 0);
				add(`${n}b_${side}`, Math.sin(s.t * 1.1 + k) * 0.1 + P.claw * 0.2, 0, 0);
			}
		}
		// the body rides the beat, nose down on the move, rolling into a slide sideways
		add('hips', 0.15 * s.gait - w * 0.04 * alive + wob(1) * 0.05 - s.skid * 0.35, 0, -s.lat * s.latSign * 0.4 + wob(2) * 0.06);
		add('abdomen', Math.sin(s.t * 2) * 0.06 + w * 0.05 * alive, Math.sin(s.t * 1.3) * 0.08, 0);
		add('abdomen2', Math.sin(s.t * 2 - 0.5) * 0.08, Math.sin(s.t * 1.3 - 0.4) * 0.1, 0);
		add('head', 0, s.look * 0.6 + P.turn, P.cock * 0.5);
		add('proboscis', Math.sin(s.t * 0.7) * 0.15, 0, 0);
		// a strike: it drops its head, reaches with its forelegs (the hands) and stabs the proboscis
		if (s.strike >= 0) {
			const k = s.strike;
			const reach = smooth(k / 0.4) * (1 - smooth((k - 0.6) / 0.4));
			const stab = smooth((k - 0.4) / 0.1) * (1 - smooth((k - 0.55) / 0.3));
			add('hips', 0.35 * reach, 0, 0);
			add('leg1a_L', -1.1 * reach, 0, 0.2 * reach);
			add('leg1a_R', -1.1 * reach, 0, -0.2 * reach);
			add('leg1b_L', -0.6 * reach, 0, 0);
			add('leg1b_R', -0.6 * reach, 0, 0);
			add('proboscis', -1.2 * stab, 0, 0);
			add('head', 0.3 * stab, 0, 0);
		}
		// a hit: thrown over in the air
		if (s.hit >= 0) {
			const k = Math.sin(clamp(s.hit / 0.45, 0, 1) * Math.PI) * (1 - s.hit) * s.hitK;
			const d = s.hitDir;
			add('hips', d.z * 0.3 * k, 0, -d.x * 0.5 * k);
		}
		// death: the wings fold up over the back, the legs curl in
		if (s.death >= 0) {
			const k = smooth(s.death / 0.8);
			for (const side of ['L', 'R']) {
				const sg = side === 'L' ? 1 : -1;
				add('wing_' + side, 0, 0, sg * 1.2 * k);
				add('wing2_' + side, 0, 0, sg * 1.0 * k);
				for (const n of ['leg1', 'leg2', 'leg3']) { add(`${n}a_${side}`, 0.6 * k, 0, -sg * 0.3 * k); add(`${n}b_${side}`, 0.9 * k, 0, 0); }
			}
			add('hips', 0, 0, 0.6 * k);
		}
	}

	// ---------- spider: eight legs and a body slung between them (the Shard Mite) ----------
	// legs leg1..4 a (up to the knee) / b (down to the foot), 1 the front; walked four at a time
	// (L1 R2 L3 R4, then the others), each swinging about its root and lifting as it comes forward
	const SPIDER = [1, 2, 3, 4].flatMap((n) => [['L', n, n % 2 ? 0 : Math.PI], ['R', n, n % 2 ? Math.PI : 0]]);
	function spider(_dt) {
		const s = state, P = s.P;
		const g = s.gait * (1 - s.skid), ph = s.phase;
		const fwd = 1 - s.lat, lat = s.lat * s.latSign;
		// (its own height off the ground and spread of legs)
		const hi = (0.5 - P.low) * 0.3;
		for (const [side, n, o] of SPIDER) {
			const sg = side === 'L' ? 1 : -1;
			const p = ph + o;
			// (forward is a turn about y one way on the left and the other on the right)
			const f = Math.sin(p) * 0.32 * g * s.strideK * fwd + Math.sin(s.t * 0.9 + n * 1.7 + sg + P.seed) * 0.03 * (1 - g);
			const lift = Math.max(0, Math.cos(p)) * 0.38 * g * P.lift;
			add(`leg${n}a_${side}`, Math.sin(p) * 0.2 * g * lat * sg, -sg * f, sg * (lift - hi + P.wide));
			add(`leg${n}b_${side}`, 0, 0, -sg * (lift * 0.6 - hi * 0.7));
			// (a skid: every leg spread wide and stiff, the body down between them)
			if (s.skid > 0) { add(`leg${n}a_${side}`, 0, -sg * (n < 3 ? -0.25 : 0.25) * s.skid, -sg * 0.25 * s.skid); add(`leg${n}b_${side}`, 0, 0, sg * 0.3 * s.skid); }
		}
		// the body rides low and level, rocking a little with each set of four
		add('hips', Math.sin(s.t * 2.1) * 0.02 + Math.sin(ph * 2) * 0.03 * g * P.bounce + wob(1) * 0.03, Math.sin(ph) * 0.05 * g, wob(2) * 0.03);
		add('chest', 0, Math.sin(ph) * -0.04 * g, Math.sin(ph) * 0.03 * g);
		add('head', Math.sin(s.t * 0.8) * 0.05 * (1 - g) + P.glare * 0.3, s.look * 0.6 + Math.sin(s.t * 0.47) * 0.15 * (1 - g) + P.turn, P.cock * 0.4);
		// a strike: it rears, the front pair raised and spread, and drives them down into you; or it
		// lunges in low, the front pair out ahead
		if (s.strike >= 0) {
			const k = s.strike;
			if (s.strikeKind === 'lunge') {
				const back = bump(k, 0, 0.33, 0.33, 0.42), go = bump(k, 0.34, 0.46, 0.6, 1);
				add('hips', 0.2 * back - 0.1 * go, 0, 0);
				for (const side of ['L', 'R']) {
					const sg = side === 'L' ? 1 : -1;
					add('leg1a_' + side, -0.4 * back - 0.5 * go, -sg * 0.4 * go, sg * 0.3 * go);
					add('leg4a_' + side, -0.3 * back + 0.4 * go, 0, 0);
				}
				s.hz += 0.25 * hipH * go - 0.1 * hipH * back;
			} else {
				const rear = smooth(k / 0.35) * (1 - smooth((k - 0.45) / 0.15));
				const stab = smooth((k - 0.42) / 0.1) * (1 - smooth((k - 0.65) / 0.35));
				add('hips', -0.45 * rear + 0.15 * stab, 0, 0);
				for (const side of ['L', 'R']) {
					const sg = side === 'L' ? 1 : -1;
					add('leg1a_' + side, -0.9 * rear + 0.6 * stab, -sg * 0.35 * rear, sg * 0.5 * rear);
					add('leg1b_' + side, -0.5 * rear + 0.5 * stab, 0, 0);
					add('leg2a_' + side, -0.3 * rear, 0, sg * 0.2 * rear);
					// (the hind legs dig in as it rears)
					add('leg4a_' + side, 0.35 * rear, 0, 0);
					add('leg3a_' + side, 0.25 * rear, 0, 0);
				}
			}
		}
		if (s.hit >= 0) {
			const k = Math.sin(clamp(s.hit / 0.35, 0, 1) * Math.PI) * (1 - s.hit) * s.hitK;
			add('hips', s.hitDir.z * 0.25 * k, 0, -s.hitDir.x * 0.35 * k);
		}
		// death: the legs snap up and in under it (and then it shatters: combat/ai-squads.js)
		if (s.death >= 0) {
			const k = smooth(s.death / 0.3);
			for (const [side, n] of SPIDER) {
				const sg = side === 'L' ? 1 : -1;
				add(`leg${n}a_${side}`, 0, 0, sg * 0.7 * k);
				add(`leg${n}b_${side}`, 0, 0, sg * 1.1 * k);
			}
		}
	}

	// ---------- the beats, over the gait ----------
	function quadBeats() {
		const s = state, m = s.menace * (1 - s.gait * 0.4);
		// menace: head low and level, ears flat, the forelegs bent to spring, a growl in the chest
		if (m > 0.01) {
			const r = rattle(s.t) * 0.012 * m;
			add('neck', 0.28 * m, 0, r);
			add('head', -0.18 * m + r, 0, 0);
			add('chest', 0.05 * m + r, 0, 0);
			add('ear_L', -0.55 * m, 0, 0); add('ear_R', -0.55 * m, 0, 0);
			add('tail1', 0.2 * m, 0, 0);
			for (const side of ['L', 'R']) { add('upperarm_' + side, 0.1 * m, 0, 0); add('forearm_' + side, -0.16 * m, 0, 0); add('thigh_' + side, 0.08 * m, 0, 0); add('shin_' + side, -0.12 * m, 0, 0); }
		}
		const b = s.beat;
		if (!b) return;
		const k = b.k, e = env(k), sd = b.side > 0 ? 'L' : 'R';
		if (b.kind === 'twitch') {
			// the head snapped this way and that, held, cocked, the ears flicking: not a dog's look round
			add('head', jerk(k, 3, 1) * 0.12 * e, jerk(k, 3, 2) * 0.55 * e, jerk(k, 3, 3) * 0.45 * e);
			add('neck', jerk(k, 3, 4) * 0.15 * e, jerk(k, 3, 5) * 0.2 * e, 0);
			add('ear_L', -Math.abs(jerk(k, 5, 6)) * 0.6 * e, 0, 0);
			add('ear_R', -Math.abs(jerk(k, 5, 7)) * 0.6 * e, 0, 0);
			// (a shiver runs over the shoulders)
			add('chest', 0, 0, Math.sin(s.t * 70) * 0.025 * e * (k < 0.35 ? 1 : 0));
		} else if (b.kind === 'scrape') {
			// a forepaw raked back through the dirt, twice, the head down watching it
			const p = (k * 2) % 1;
			const fwd = p < 0.3 ? smooth(p / 0.3) : p < 0.4 ? 1 : p < 0.85 ? 1 - smooth((p - 0.4) / 0.45) * 1.45 : -0.45 * (1 - smooth((p - 0.85) / 0.15));
			const lift = p < 0.3 ? Math.sin(Math.PI * p / 0.3) : p > 0.85 ? Math.sin(Math.PI * (p - 0.85) / 0.15) * 0.6 : 0;
			const drag = p >= 0.4 && p < 0.85 ? 1 : 0;
			add('upperarm_' + sd, -0.5 * fwd * e, 0, 0);
			add('forearm_' + sd, -0.35 * lift * e, 0, 0);
			add('hand_' + sd, (0.9 * lift - 0.3 * drag) * e, 0, 0);
			add('chest', 0.06 * e, 0, b.side * 0.04 * e);
			add('neck', 0.22 * e, 0, 0);
			add('head', 0.15 * e, b.side * 0.25 * e, 0);
			once(b, 0.22, 'scuff'); once(b, 0.72, 'scuff');
		} else if (b.kind === 'growl') {
			// down on its forelegs, lips back (the head up a little), the growl shaking it
			const r = rattle(s.t) * 0.02 * e;
			add('neck', 0.32 * e, 0, r);
			add('head', -0.22 * e + r, 0, r * 0.5);
			add('chest', 0.1 * e + r, 0, 0);
			add('spine', r * 0.5, 0, 0);
			add('ear_L', -0.7 * e, 0, 0); add('ear_R', -0.7 * e, 0, 0);
			add('tail1', 0.3 * e, 0, 0);
			for (const side of ['L', 'R']) { add('upperarm_' + side, 0.25 * e, 0, 0); add('forearm_' + side, -0.35 * e, 0, 0); add('hand_' + side, 0.12 * e, 0, 0); }
		} else if (b.kind === 'sniff') {
			// nose to the ground, quick snuffling bobs, sweeping across
			add('neck', 0.6 * e, 0, 0);
			add('head', 0.3 * e + Math.sin(s.t * 17) * 0.05 * e, Math.sin(k * TAU) * 0.3 * e, 0);
			add('ear_L', 0.15 * e, 0, 0); add('ear_R', 0.15 * e, 0, 0);
		} else if (b.kind === 'shake') {
			// a shudder from the head down the back
			const w = Math.sin(s.t * 28) * e;
			add('head', 0, w * 0.15, w * 0.3);
			add('neck', 0, 0, w * 0.15);
			add('chest', 0, 0, -w * 0.08);
			add('spine', 0, 0, w * 0.05);
			add('tail1', 0, w * 0.3, 0);
		} else if (b.kind === 'pant') {
			// the sides heaving, the head low and nodding with it
			const p = Math.sin(s.t * 14) * e;
			add('chest', p * 0.03, 0, 0); add('spine', -p * 0.02, 0, 0);
			add('neck', 0.12 * e + p * 0.04, 0, 0); add('head', -0.05 * e + p * 0.05, 0, 0);
		} else if (b.kind === 'stretch') {
			// down on its forelegs, the hind end up, a long stretch through the back, then up again
			const w = env(k, 0.3, 0.3);
			for (const side of ['L', 'R']) { add('upperarm_' + side, -0.55 * w, 0, 0); add('forearm_' + side, 0.15 * w, 0, 0); add('hand_' + side, -0.3 * w, 0, 0); add('thigh_' + side, -0.15 * w, 0, 0); }
			add('chest', 0.3 * w, 0, 0); add('spine', -0.2 * w, 0, 0); add('neck', -0.25 * w, 0, 0); add('head', 0.1 * w, 0, 0); add('tail1', -0.4 * w, 0, 0);
			state.hy -= 0.08 * hipH * w;
		} else if (b.kind === 'scratch') {
			// a hind leg brought up and raked at the neck, quick, the head bent round to it
			const w = env(k, 0.15, 0.2), r = Math.sin(s.t * 26) * w;
			add('thigh_' + sd, -0.9 * w, 0, b.side * 0.4 * w); add('shin_' + sd, -0.4 * w + r * 0.25, 0, 0); add('foot_' + sd, 0.6 * w + r * 0.3, 0, 0);
			add('neck', 0.1 * w, -b.side * 0.4 * w, b.side * 0.25 * w); add('head', 0.15 * w, -b.side * 0.3 * w, r * 0.06);
			add('hips', 0, 0, -b.side * 0.12 * w);
		} else if (b.kind === 'snap') {
			// snaps at the air: the head flung forward and back, twice
			const p = Math.max(0, Math.sin(k * TAU * 2)) * e;
			add('neck', -0.35 * p, 0, 0); add('head', 0.25 * p, 0, 0);
			add('ear_L', -0.5 * e, 0, 0); add('ear_R', -0.5 * e, 0, 0);
		} else if (b.kind === 'stalk') {
			// right down on its legs, belly near the ground, the hind end wiggling to spring
			const w = env(k, 0.2, 0.25);
			quadLow(0.9 * w);
			add('neck', 0.25 * w, 0, 0); add('head', -0.2 * w, 0, 0);
			add('hips', 0, Math.sin(s.t * 16) * 0.06 * w * smooth((k - 0.5) / 0.2), 0);
			add('tail1', 0.1 * w, Math.sin(s.t * 12) * 0.3 * w, 0);
		} else if (b.kind === 'look') {
			// a long look back over its shoulder, and the head snapped round again
			const w = env(k, 0.35, 0.08);
			add('neck', 0, b.side * 0.6 * w, 0); add('head', 0, b.side * 0.5 * w, b.side * 0.15 * w);
			add('chest', 0, b.side * 0.12 * w, 0);
		}
	}
	function bipedBeats() {
		for (const sd of ['L', 'R']) { const k = holding(sd) ? 0.3 : 1; HOLDK['upperarm_' + sd] = HOLDK['forearm_' + sd] = HOLDK['hand_' + sd] = k; }
		armK = HOLDK;
		bipedBeats0();
		armK = null;
	}
	function bipedBeats0() {
		const s = state, P = s.P, m = s.menace * (1 - s.gait * 0.5);
		if (m > 0.01) {
			const r = rattle(s.t) * 0.01 * m;
			add('head', 0.08 * m + r, 0, r);
			add('chest', 0.05 * m, 0, 0);
			// (at you, it rocks from foot to foot, slow, weighing you up)
			const rk = Math.sin(s.t * 1.1 * P.fidget + P.seed) * m * (1 - s.gait);
			add('hips', 0, 0, rk * 0.06); add('chest', 0, rk * 0.06, -rk * 0.05); add('head', 0, -rk * 0.08, 0);
		}
		// dormant: arms up and out like boughs, the head bowed, stirring only as a tree does in the wind
		const dw = s.dormant;
		if (dw > 0) {
			const wind = Math.sin(s.t * 0.55 + s.seed) * 0.035 + Math.sin(s.t * 1.3 + s.seed * 2) * 0.012;
			for (const side of ['L', 'R']) {
				const sg = side === 'L' ? 1 : -1;
				add('upperarm_' + side, -0.5 * dw, 0, sg * (1.9 + wind * 2) * dw);
				add('forearm_' + side, -0.7 * dw, 0, sg * 0.35 * dw);
				add('arm2_' + side, 0.3 * dw, 0, sg * (1.3 - wind * 2) * dw);
				add('arm2b_' + side, -0.5 * dw, 0, sg * 0.3 * dw);
			}
			add('spine', 0.04 * dw, 0, wind * dw);
			add('head', 0.3 * dw, 0, 0);
		}
		const b = s.beat;
		if (!b) return;
		const k = b.k, e = env(k), sd = b.side > 0 ? 'L' : 'R', sg = b.side;
		if (b.kind === 'twitch') {
			// snapped round, cocked too far, a shoulder jumping
			add('head', jerk(k, 4, 1) * 0.15 * e, jerk(k, 4, 2) * 0.5 * e, jerk(k, 4, 3) * 0.5 * e);
			add('neck', jerk(k, 4, 4) * 0.12 * e, 0, 0);
			add('upperarm_' + sd, 0, 0, b.side * Math.max(0, jerk(k, 4, 5)) * 0.35 * e);
			add('chest', 0, jerk(k, 4, 6) * 0.08 * e, 0);
		} else if (b.kind === 'tilt') {
			// the head laid slowly over on one side, watching, too long
			const w = env(k, 0.4, 0.3);
			add('head', -0.1 * w, b.side * 0.15 * w, b.side * 0.6 * w);
			add('neck', 0, 0, b.side * 0.15 * w);
		} else if (b.kind === 'crack') {
			// the neck rolled round, a spasm through the back at the end of it
			const a = k * TAU;
			add('head', Math.cos(a) * 0.25 * e, 0, Math.sin(a) * 0.35 * e);
			const sp = Math.exp(-Math.pow((k - 0.7) / 0.05, 2));
			add('chest', -0.15 * sp, 0, b.side * 0.1 * sp);
			add('upperarm_L', 0, 0, 0.3 * sp); add('upperarm_R', 0, 0, -0.3 * sp);
		} else if (b.kind === 'crouch') {
			// dropped right down on its haunches, a hand to the ground, watching from there, and up
			const w = env(k, 0.18, 0.22);
			crouchLegs(0.85 * w);
			add('spine', 0.35 * w, 0, 0); add('chest', 0.15 * w, 0, 0); add('neck', -0.2 * w, 0, 0); add('head', -0.3 * w, 0, 0);
			add('upperarm_' + sd, -0.6 * w, 0, -sg * 0.1 * w); add('forearm_' + sd, -0.2 * w, 0, 0); add('hand_' + sd, -0.4 * w, 0, 0);
			once(b, 0.25, 'scuff');
		} else if (b.kind === 'claws') {
			// both hands brought up, the fingers opening and closing, the head pushed forward at you
			const w = env(k, 0.2, 0.25), f = Math.sin(s.t * 9) * w;
			for (const s2 of ['L', 'R']) {
				const g2 = s2 === 'L' ? 1 : -1;
				add('upperarm_' + s2, -1.0 * w, 0, g2 * 0.25 * w); add('forearm_' + s2, -1.0 * w, 0, 0); add('hand_' + s2, (-0.3 - 0.35 * f * g2) * w, 0, 0);
			}
			add('neck', 0.2 * w, 0, 0); add('head', -0.15 * w + rattle(s.t) * 0.015 * w, 0, 0); add('chest', 0.1 * w, 0, 0);
		} else if (b.kind === 'scratch') {
			// a hand up to scratch at its head, quick and hard
			const w = env(k, 0.2, 0.2), r = Math.sin(s.t * 24) * w;
			add('upperarm_' + sd, -1.5 * w, 0, -sg * 0.25 * w); add('forearm_' + sd, -1.8 * w + r * 0.15, 0, -sg * 0.3 * w); add('hand_' + sd, -0.4 * w + r * 0.2, 0, 0);
			add('head', 0.1 * w, 0, sg * 0.25 * w);
		} else if (b.kind === 'look') {
			// a slow look back over its shoulder, held, then the head snapped round
			const w = env(k, 0.4, 0.08);
			add('chest', 0, sg * 0.3 * w, 0); add('neck', 0, sg * 0.4 * w, 0); add('head', 0, sg * 0.55 * w, sg * 0.1 * w);
		} else if (b.kind === 'sway') {
			// rocking from foot to foot, the head lolling, the arms hanging dead
			const w = env(k, 0.2, 0.25), r = Math.sin(k * TAU * 2) * w;
			add('hips', 0, 0, r * 0.1); add('spine', 0, 0, -r * 0.08); add('chest', 0, 0, -r * 0.06);
			add('head', 0.15 * w, 0, r * 0.35);
			add('upperarm_L', 0, 0, r * 0.12); add('upperarm_R', 0, 0, r * 0.12);
		} else if (b.kind === 'sniff') {
			// the head up, snuffing at the air
			const w = env(k, 0.2, 0.2);
			add('neck', -0.15 * w, 0, 0); add('head', -0.35 * w + Math.sin(s.t * 15) * 0.05 * w, Math.sin(k * TAU) * 0.2 * w, 0);
		} else if (b.kind === 'shrug') {
			// the shoulders rolled, the neck cracked over
			const w = env(k, 0.2, 0.3), r = Math.sin(k * TAU);
			add('upperarm_L', 0, 0, 0.25 * w * Math.max(0, r)); add('upperarm_R', 0, 0, -0.25 * w * Math.max(0, -r));
			add('chest', -0.1 * w, 0, r * 0.08 * w); add('head', 0, 0, -r * 0.3 * w);
		} else if (b.kind === 'feint') {
			// a start at you, half a blow, and back: to see you flinch
			const w = bump(k, 0, 0.3, 0.45, 0.9);
			add('upperarm_' + sd, -1.4 * w, 0, sg * 0.4 * w); add('forearm_' + sd, -0.7 * w, 0, 0);
			add('spine', 0.3 * w, 0, 0); add('chest', 0.15 * w, sg * 0.25 * w, 0); add('head', -0.25 * w, 0, 0);
			crouchLegs(0.3 * w);
			state.hz += 0.12 * hipH * w;
		} else if (b.kind === 'taunt') {
			// the fists brought up before it, elbows out, pumped at you (come on, then), the chest
			// pushed at you, the head shaking (the arms ahead of it: never held out level in a T)
			const w = env(k, 0.15, 0.25), pm = Math.sin(k * TAU * 3) * 0.18 * w;
			for (const s2 of ['L', 'R']) { const g2 = s2 === 'L' ? 1 : -1; add('upperarm_' + s2, -0.95 * w + pm, 0, g2 * 0.22 * w); add('forearm_' + s2, -1.25 * w - pm, 0, 0); add('hand_' + s2, -0.4 * w, 0, 0); }
			add('chest', -0.2 * w, 0, 0); add('spine', -0.1 * w, 0, 0); add('head', -0.15 * w, Math.sin(s.t * 13) * 0.25 * w, 0);
		} else if (b.kind === 'hop') {
			// a little hop where it stands, and another (a small one, eager)
			const p = Math.max(0, Math.sin(k * TAU * 2));
			const w = small ? e : e * 0.3;
			crouchLegs(0.3 * w * (1 - p));
			state.hy += 0.18 * hipH * p * w;
			for (const s2 of ['L', 'R']) add('upperarm_' + s2, -0.3 * p * w, 0, (s2 === 'L' ? 0.2 : -0.2) * p * w);
		}
	}
	function flyerBeats() {
		const b = state.beat;
		if (!b) return;
		const k = b.k, e = env(k);
		if (b.kind === 'bob') { add('hips', Math.sin(k * TAU * 2) * 0.2 * e, 0, 0); state.hy += Math.sin(k * TAU) * 0.15 * H * e; return; }
		add('head', 0, jerk(k, 3, 1) * 0.4 * e, jerk(k, 3, 2) * 0.3 * e);
		for (const side of ['L', 'R']) add('leg1b_' + side, jerk(k, 4, side === 'L' ? 3 : 4) * 0.5 * e, 0, 0);
	}
	function spiderBeats() {
		const m = state.menace * (1 - state.gait * 0.6);
		// at you: up on its legs, the front pair lifted a little, quivering
		if (m > 0) {
			add('hips', -0.12 * m, 0, 0);
			for (const side of ['L', 'R']) add('leg1a_' + side, -0.3 * m + Math.sin(state.t * 47) * 0.03 * m, 0, 0);
		}
		const b = state.beat;
		if (!b) return;
		const k = b.k, e = env(k, 0.04, 0.15);
		if (b.kind === 'twitch') {
			add('head', jerk(k, 4, 1) * 0.25 * e, jerk(k, 4, 2) * 0.5 * e, 0);
			for (const side of ['L', 'R']) add('leg1a_' + side, jerk(k, 5, side === 'L' ? 3 : 4) * 0.5 * e, 0, 0);
		} else if (b.kind === 'tap') {
			// the front legs tapping at the ground in turn, tick tick tick
			for (const side of ['L', 'R']) {
				const sg = side === 'L' ? 1 : -1, ph = k * 6 * Math.PI + (sg > 0 ? 0 : Math.PI);
				add('leg1a_' + side, -Math.max(0, Math.sin(ph)) * 0.5 * e, 0, sg * Math.max(0, Math.sin(ph)) * 0.25 * e);
			}
			once(b, 0.3, 'click'); once(b, 0.65, 'click');
		} else if (b.kind === 'groom') {
			// the front pair drawn in and rubbed together under the head
			const w = env(k, 0.15, 0.2), r = Math.sin(state.t * 20) * w;
			for (const side of ['L', 'R']) { const sg = side === 'L' ? 1 : -1; add('leg1a_' + side, -0.5 * w, sg * 0.5 * w + r * 0.15 * sg, 0); add('leg1b_' + side, -0.6 * w + r * 0.2, 0, 0); }
			add('head', 0.2 * w, 0, 0);
		} else if (b.kind === 'rear') {
			// up on its hind legs, the front ones spread high and wide: as big as it can make itself
			const w = env(k, 0.15, 0.25);
			add('hips', -0.55 * w, 0, 0);
			for (const side of ['L', 'R']) { const sg = side === 'L' ? 1 : -1; add('leg1a_' + side, -1.0 * w, -sg * 0.4 * w, sg * 0.6 * w); add('leg2a_' + side, -0.5 * w, 0, sg * 0.4 * w); add('leg4a_' + side, 0.4 * w, 0, 0); }
			once(b, 0.2, 'click');
		} else if (b.kind === 'bob') {
			// the body pumped up and down between its legs, quick
			state.hy += Math.sin(k * TAU * 3) * 0.12 * hipH * e;
		}
	}
	const BEAT_PLANS = { biped: bipedBeats, quad: quadBeats, flyer: flyerBeats, spider: spiderBeats };

	const PLANS = { biped, quad, flyer, spider };
	const plan = PLANS[meta.rig] || biped;
	const beats = BEAT_PLANS[meta.rig] || bipedBeats;

	// the shove of a blow: the hips knocked the way it went, on a stiff spring that overshoots
	// once and settles; the body tips into the motion and the head and tail lag it (whiplash)
	function swayStep(dt) {
		const w = state.sway;
		if (Math.abs(w.x) + Math.abs(w.z) + Math.abs(w.vx) + Math.abs(w.vz) < 1e-4) { w.x = w.z = w.vx = w.vz = 0; return; }
		const om = 15, ze = 0.42;
		for (let left = dt; left > 0; left -= 1 / 90) {
			const h = Math.min(left, 1 / 90);
			w.vx += (-om * om * w.x - 2 * ze * om * w.vx) * h; w.vz += (-om * om * w.z - 2 * ze * om * w.vz) * h;
			w.x += w.vx * h; w.z += w.vz * h;
		}
	}
	function swayPose() {
		const w = state.sway;
		if (w.x === 0 && w.z === 0 && w.vx === 0 && w.vz === 0) return;
		const k = 1 / Math.max(0.3, hipH);
		add('hips', -w.vz * 0.05 * k, 0, w.vx * 0.05 * k);
		add('spine', w.vz * 0.04 * k, 0, -w.vx * 0.03 * k);
		add('chest', w.vz * 0.06 * k, 0, -w.vx * 0.05 * k);
		add('neck', w.vz * 0.1 * k, -w.vx * 0.06 * k, 0);
		add('head', w.vz * 0.12 * k, -w.vx * 0.08 * k, 0);
		add('tail1', -w.vz * 0.1 * k, w.vx * 0.2 * k, 0);
		add('tail2', -w.vz * 0.1 * k, w.vx * 0.2 * k, 0);
	}

	// apply: each bone's rotation is in model axes; turn it into the parent's frame, top-down
	const modelQ = new THREE.Quaternion();
	function apply() {
		root.updateMatrixWorld(true);
		root.getWorldQuaternion(modelQ);
		_qi.copy(modelQ).invert();
		for (const x of bones) {
			const b = x.b;
			b.quaternion.copy(x.rest);
			b.position.copy(x.restPos);
		}
		for (const x of bones) {
			const b = x.b;
			const r = x.rot;
			if (r.x === 0 && r.y === 0 && r.z === 0) { b.updateMatrixWorld(true); continue; }
			_q.setFromEuler(_e.set(r.x, r.y, r.z, 'YXZ'));
			// parent's rotation in model space
			b.parent.getWorldQuaternion(_qp);
			_qp.premultiply(_qi);
			// R_parent = Pm^-1 * R * Pm
			_qr.copy(_qp).invert().multiply(_q).multiply(_qp);
			b.quaternion.copy(_qr.multiply(x.rest));
			b.updateMatrixWorld(true);
		}
		for (const h of hang) {
			const b = h.x.b;
			b.parent.getWorldQuaternion(_qp).premultiply(_qi);
			b.quaternion.copy(_qp.invert().multiply(h.restModel));
			// swing a little with the gait
			const sw = Math.sin(state.phase + 0.6) * 0.12 * state.gait;
			b.quaternion.multiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), sw));
			b.updateMatrixWorld(true);
		}
		// the hips ride the gait (bob, as much as this one bounces) and sink in death; and wherever
		// the plans put them (a crouch, a lunge, a leap)
		const hips = B.hips;
		if (hips) {
			const s = state;
			const bob = Math.abs(Math.cos(s.phase)) * 0.035 * hipH * s.gait * s.P.bounce * (1 - s.skid);
			const sink = s.death >= 0 ? smooth(s.death / 1.1) * hipH * 0.62 : 0;
			const crouch = (meta.stalk ?? 0.35) * 0.04 * hipH * s.gait;
			_q.copy(hips.b.parent ? hips.b.parent.getWorldQuaternion(_qp).premultiply(_qi) : _qp.identity()).invert();
			_hv.set(s.sway.x, bob - sink - crouch + s.hy, s.sway.z + s.hz).applyQuaternion(_q);
			hips.b.position.add(_hv);
			hips.b.updateMatrixWorld(true);
		}
		// handed back from lying limp: the pose it lay in held, in the world, and eased into
		// this one, from the hips out (people/ragdoll.js leaves the bones as they fell)
		const bl = state.blend;
		if (bl) {
			const w = 1 - smooth(bl.t / bl.dur);
			if (w <= 0) state.blend = null;
			else {
				if (hips && bl.hipsW) { _v.copy(bl.hipsW); hips.b.parent.worldToLocal(_v); hips.b.position.lerp(_v, w); hips.b.updateMatrixWorld(true); }
				for (const x of bones) {
					const q0 = bl.q.get(x);
					if (!q0) continue;
					x.b.parent.getWorldQuaternion(_qp);
					_q.copy(_qp).invert().multiply(q0);
					x.b.quaternion.slerp(_q, w);
					x.b.updateMatrixWorld(true);
				}
			}
		}
	}

	// which beats may come now: at ease, at you, or either; on the move, only the upper body's
	function beatList() {
		const s = state;
		return (BEATS[meta.rig] || BEATS.biped).filter((x) => {
			if (x[0] === 'hop' && !small) return false;
			if (s.gait >= 0.35 && !UPPER.has(x[0])) return false;
			return x[3] === 1 ? s.menace < 0.5 : x[3] === 2 ? s.menace > 0.2 : true;
		});
	}
	function strikeKind(side) {
		const list = STRIKES[meta.rig] || STRIKES.biped;
		// (a weapon in the striking hand is swung, chopped or swept, never driven like claws)
		if (meta.rig === 'biped' && holding(side > 0 ? 'L' : 'R')) return Math.random() < 0.6 ? 'chop' : 'sweep';
		if (meta.rig === 'biped' && small && Math.random() < 0.3) return 'pounce';
		return list[Math.floor(Math.random() * list.length)];
	}

	return {
		state,
		// speed in m/s (backing away below 0); side: its speed sideways (m/s, + to its left, a
		// slide round you); turn: how fast it is turning (rad/s), the feet stepping round with it;
		// skid: how hard it is skidding to a stop (0..1)
		update(dt, { speed = 0, look = 0, menace = 0, dormant = 0, side = 0, turn = 0, skid = 0 } = {}) {
			const s = state, P = s.P;
			s.t += dt;
			s.menace += (menace - s.menace) * Math.min(1, dt * 2.5);
			s.dormant = dormant;
			s.skid += (clamp(skid, 0, 1) - s.skid) * Math.min(1, dt * 12);
			// a beat now and then while it stands (more often the more it means you harm, and as
			// often as this one fidgets); on the move, now and then, one of the upper body's
			if (s.beat) { s.beat.k += dt / s.beat.dur; if (s.beat.k >= 1 || s.death >= 0 || (s.gait >= 0.5 && !UPPER.has(s.beat.kind))) s.beat = null; }
			else if (s.death < 0 && s.strike < 0 && s.skid < 0.2 && dormant <= 0) {
				s.beatT -= dt * (1 + s.menace * 1.5) * P.fidget * (s.gait < 0.35 ? 1 : 0.35);
				if (s.beatT <= 0) {
					s.beatT = 1.5 + Math.random() * 4;
					// (at you, it growls and twitches; it noses the ground and shakes itself only at ease)
					const list = beatList();
					let w = Math.random() * list.reduce((a, x) => a + x[1], 0);
					for (const x of list) { w -= x[1]; if (w < 0) { startBeat(x[0]); break; } }
				}
			}
			// the moments between going and stopping: from a run to a stand, it settles; from a
			// stand to a run, it pushes off
			const sp = Math.abs(speed);
			s.peak = Math.max(sp, s.peak - dt * 3);
			s.low = Math.min(sp, s.low + dt * 3);
			if (s.settle < 0 && sp < 0.6 && s.peak > 2.4 && s.skid < 0.3) { s.settle = 0; s.settleK = clamp(s.peak / 5, 0.5, 1); s.peak = sp; }
			if (s.launch < 0 && sp > 2.2 && s.low < 0.6) { s.launch = 0; s.low = sp; }
			if (s.settle >= 0) { s.settle += dt / 0.7; if (s.settle >= 1) s.settle = -1; }
			if (s.launch >= 0) { s.launch += dt / 0.35; if (s.launch >= 1) s.launch = -1; }
			s.speed = speed;
			// its steps: forward and to the side, and round as it turns (the feet stepping it round)
			const sideStep = Math.abs(side) + Math.abs(turn) * hipH * 0.5;
			const step = Math.hypot(sp, sideStep);
			s.lat += ((step > 0.05 ? sideStep / step : 0) - s.lat) * Math.min(1, dt * 6);
			if (Math.abs(side) + Math.abs(turn) > 0.05) s.latSign = Math.sign(side || -turn);
			const tg = clamp(step / 1.2, 0, 1);
			s.gait += (tg - s.gait) * Math.min(1, dt * 6);
			// each its own stride: longer or shorter, quicker or slower to the same speed (and a
			// slow drift in it, so two alike drift out of step); backing away, the steps go back;
			// skidding, the feet are planted
			s.strideK = P.stride / Math.sqrt(P.cad);
			const stride = hipH * 1.35 * s.strideK * (1 + wob(9) * 0.04);
			const dir = speed < -0.05 && sideStep < sp ? -1 : 1;
			s.phase = (s.phase + dir * (step / stride) * Math.PI * dt * (1 - s.skid * 0.9) + TAU) % TAU;
			// (a flyer's wings: its own beat, quicker on the move)
			s.flap = (s.flap + dt * (7 + 3 * s.gait) * (0.85 + P.cad * 0.15)) % TAU;
			s.look += (look - s.look) * Math.min(1, dt * 4);
			if (s.strike >= 0) {
				s.strike += dt / (meta.strikeTime || 0.9);
				if (s.strike >= 1) {
					s.strike = -1;
					// (and after it, now and then, a moment: a taunt, a shrug, a snap at the air)
					if (Math.random() < 0.3 && !s.beat) { const after = meta.rig === 'quad' ? 'snap' : meta.rig === 'biped' ? (Math.random() < 0.5 ? 'taunt' : 'shrug') : 'twitch'; startBeat(after); }
				}
			}
			if (s.hit >= 0) { s.hit += dt / 0.5; if (s.hit >= 1) s.hit = -1; }
			if (s.death >= 0) s.death += dt;
			if (s.blend) s.blend.t += dt;
			swayStep(dt);
			clear();
			plan(dt);
			if (s.death < 0) beats();
			legsDown();
			swayPose();
			apply();
		},
		// a new one: who it is drawn afresh (character()), out of step with the last (tame: a person
		// still, the Moonturned before it turns)
		character(rnd = Math.random, opts = {}) {
			state.P = character(rnd, opts);
			state.phase = state.P.phase; state.flap = state.P.phase;
			state.seed = state.P.seed; state.beatT = 0.5 + rnd() * 3;
			state.skid = 0; state.settle = -1; state.launch = -1; state.peak = 0; state.low = 0; state.lat = 0;
			return state.P;
		},
		// its own pace, as a factor on the speed it is given (combat/ai-squads.js): a stutter (stop,
		// go), a surge with each push, a hitch on a bad leg; about 1 on the whole
		pace() {
			const s = state, P = s.P;
			let k = 1 + P.surge * 0.22 * Math.sin(s.phase * 2) + wob(8) * 0.05;
			if (P.limp) k *= 1 - P.limp * 0.3 * Math.max(0, Math.sin(s.phase + (P.limpSide > 0 ? 0 : Math.PI)));
			if (P.stutter) {
				const f = s.t * 1.8 + P.seed, i = Math.floor(f), u = f - i;
				const go = (j) => (hash(P.seed, j) * 0.5 + 0.5 < P.stutter * 0.45 ? 0.12 : 1.18);
				const a = go(i - 1), b = go(i);
				k *= a + (b - a) * smooth(u / 0.18);
			}
			return clamp(k, 0.08, 1.6);
		},
		// a beat by name, now (a growl as it sees you)
		beat(kind) { if (state.death < 0) { startBeat(kind); state.beatT = 2 + Math.random() * 3; } },
		// what happened since last asked: 'growl', 'scuff', 'twitch' ...
		drain() { const e = state.events; state.events = []; return e; },
		// where a bone is in the world, into out
		at(name, out) { const x = B[name]; return x ? x.b.getWorldPosition(out) : null; },
		// a blow from side (1 its left hand, -1 its right; one with a weapon in hand strikes with
		// that hand, one with only claws with either), its kind drawn now (or kind)
		strike(side, kind) {
			const sd = side ?? (holding('L') || holding('R') ? meta.strikeSide ?? 1 : Math.random() < 0.5 ? 1 : -1);
			state.strike = 0; state.strikeSide = sd; state.strikeKind = kind || strikeKind(sd);
			state.beat = null;
		},
		// a blow from dir (the way it travelled, in the model's axes), weighing k (1 a round; a
		// heavy one more): the reel of it, and the shove along it
		hit(dir, k = 1) {
			state.hit = 0; state.hitK = clamp(k, 0.4, 2.4);
			if (dir) {
				state.hitDir.copy(dir).setY(0).normalize();
				const v = 0.9 * state.hitK * hipH;
				state.sway.vx += state.hitDir.x * v; state.sway.vz += state.hitDir.z * v;
			}
		},
		// from now, the bones' pose in the world as it stands (lying as it fell) is held and eased
		// into the motion's over dur s: for one knocked down and up again, wherever root is put
		blendFrom(dur = 0.7) {
			root.updateMatrixWorld(true);
			const q = new Map();
			for (const x of bones) q.set(x, x.b.getWorldQuaternion(new THREE.Quaternion()));
			state.blend = { t: 0, dur, q, hipsW: B.hips ? B.hips.b.getWorldPosition(new THREE.Vector3()) : null };
			state.sway.x = state.sway.z = state.sway.vx = state.sway.vz = 0;
		},
		die() { if (state.death < 0) state.death = 0; },
		dead: () => state.death >= 0,
		// a fixed pose for previews: name in rest | walk | run | strike | hit | death | skid |
		// menace | dormant or a beat's name, t its time (strike: kind, a blow's kind)
		pose(name, t = 0, { kind = null, speed = 0 } = {}) {
			const s = state;
			Object.assign(s, { strike: -1, hit: -1, death: -1, gait: 0, phase: 0, t: 1.3, hitK: 1, blend: null, skid: 0, settle: -1, launch: -1, lat: 0, speed: 0, strideK: s.P.stride / Math.sqrt(s.P.cad) });
			s.sway.x = s.sway.z = s.sway.vx = s.sway.vz = 0;
			if (name === 'walk' || name === 'run') { s.gait = 1; s.phase = t * TAU; s.speed = speed || (name === 'run' ? 5 : 1.2); }
			if (name === 'strike') { s.strike = t; s.strikeSide = meta.strikeSide ?? 1; s.strikeKind = kind || (STRIKES[meta.rig] || STRIKES.biped)[0]; }
			if (name === 'hit') { s.hit = t; s.hitDir.set(0, 0, -1); }
			if (name === 'death') s.death = t * 1.2;
			if (name === 'skid') s.skid = 1;
			s.beat = null; s.dormant = name === 'dormant' ? 1 : 0; s.menace = name === 'menace' ? 1 : 0;
			if ((BEATS[meta.rig] || []).some((x) => x[0] === name)) { startBeat(name); s.beat.k = t; s.events = []; }
			clear();
			plan(0);
			beats();
			legsDown();
			apply();
		},
	};
}
