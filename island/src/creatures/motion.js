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

import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const sanitize = (n) => n.replace(/[\s.\[\]:/]/g, '');

const _ax = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _e = new THREE.Euler();

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
	const state = { phase: 0, speed: 0, gait: 0, strike: -1, strikeSide: 1, hit: -1, hitDir: new THREE.Vector3(0, 0, -1), death: -1, t: 0, look: 0, lunge: 0,
		// the little things it does when it is not going anywhere (a beat: a twitch, a paw scraping
		// the ground, a growl), how much it means you harm (menace 0..1: low and trembling), and how
		// still it stands (dormant 0..1: the Burnt Giant a tree among the trees); events for the
		// world to hear and see (a growl, a scuff of dirt), taken by drain()
		beat: null, beatT: 1 + Math.random() * 3, menace: 0, dormant: 0, seed: Math.random() * 100, events: [] };

	function clear() { for (const x of bones) x.rot.set(0, 0, 0); }
	const R = (n) => B[n]?.rot;
	const add = (n, x, y, z) => { const r = R(n); if (r) { r.x += x; r.y += y; r.z += z; } };

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
	// the rattle of a growl, felt through the body
	const rattle = (t) => Math.sin(t * 41) * 0.6 + Math.sin(t * 57 + 1) * 0.4;
	const BEATS = {
		quad: [['twitch', 3, 0.9], ['scrape', 2, 1.6], ['growl', 2, 2.2], ['sniff', 2, 1.7], ['shake', 1, 0.9]],
		biped: [['twitch', 3, 1.0], ['tilt', 2, 2.3], ['crack', 1, 1.3]],
		flyer: [['twitch', 1, 0.8]],
		spider: [['twitch', 3, 0.7], ['tap', 2, 1.1]],
	};
	function startBeat(kind) {
		const list = BEATS[meta.rig] || BEATS.biped;
		const b = list.find((x) => x[0] === kind) || list[0];
		state.beat = { kind: b[0], k: 0, dur: b[2], side: Math.random() < 0.5 ? 1 : -1, salt: Math.random() * 50, at: [] };
		state.events.push(b[0]);
	}
	// each one at a moment of its beat: an event once (a scuff as the claws drag)
	function once(b, k, name) { if (b.k >= k && !b.at.includes(k)) { b.at.push(k); state.events.push(name); } }

	// ---------- biped: two legs, two arms, a spine ----------
	function biped(_dt) {
		const s = state;
		const g = s.gait;
		const ph = s.phase;
		const stalk = meta.stalk ?? 0.35; // how hunched the gait is
		// legs: swing, knee lift, foot roll
		for (const side of ['L', 'R']) {
			const o = side === 'L' ? 0 : Math.PI;
			const sw = Math.sin(ph + o);
			const lift = Math.max(0, Math.sin(ph + o + Math.PI / 2));
			const amp = 0.42 * g;
			add('thigh_' + side, -sw * amp - 0.12 * g * stalk, 0, 0);
			add('shin_' + side, lift * 0.85 * g + 0.08 * g * stalk, 0, 0);
			add('foot_' + side, -lift * 0.35 * g + sw * 0.15 * g, 0, 0);
			// arms against the legs, hanging forward with the hunch
			const arm = -Math.sin(ph + o + Math.PI) * 0.32 * g;
			add('upperarm_' + side, arm - 0.1 * stalk * g, 0, 0);
			add('forearm_' + side, -0.18 * g - Math.max(0, -arm) * 0.6, 0, 0);
			// a second pair of arms (the Burnt Giant's) swings out of step with the first
			add('arm2_' + side, -arm * 0.7, 0, 0);
			add('arm2b_' + side, -0.15 * g - Math.max(0, arm) * 0.4, 0, 0);
		}
		// spine: the hunch, the twist against the hips, the breath
		const br = Math.sin(s.t * 1.7) * 0.025;
		add('spine', 0.1 * stalk * g + br, -Math.sin(ph) * 0.08 * g, 0);
		add('chest', 0.08 * stalk * g - br * 0.5, Math.sin(ph) * 0.12 * g, Math.sin(ph) * 0.04 * g);
		add('hips', 0, Math.sin(ph) * 0.1 * g, Math.sin(ph) * 0.05 * g);
		add('neck', -0.1 * stalk * g, 0, 0);
		add('head', Math.sin(s.t * 0.7) * 0.05 * (1 - g), s.look * 0.8, Math.sin(s.t * 0.43) * 0.06 * (1 - g));
		// a robe or a skirt: it swings a little with the stride and settles at rest
		add('robe', -Math.abs(Math.sin(ph)) * 0.05 * g, Math.sin(ph) * 0.05 * g, Math.sin(ph) * 0.04 * g + Math.sin(s.t * 0.8) * 0.01);
		// idle: weight on one leg, arms hang loose and sway
		const idle = 1 - g;
		add('upperarm_L', Math.sin(s.t * 0.9) * 0.04 * idle, 0, 0.04 * idle);
		add('upperarm_R', Math.sin(s.t * 0.9 + 1) * 0.04 * idle, 0, -0.04 * idle);
		add('forearm_L', -0.12 * idle, 0, 0);
		add('forearm_R', -0.12 * idle, 0, 0);
		// a strike: the arm drawn up and back, then torn down across the body
		if (s.strike >= 0) {
			const k = s.strike;
			const side = s.strikeSide > 0 ? 'L' : 'R';
			const wind = smooth(k / 0.35) * (1 - smooth((k - 0.35) / 0.15));
			const cut = smooth((k - 0.35) / 0.15) * (1 - smooth((k - 0.6) / 0.4));
			const sg = s.strikeSide;
			add('upperarm_' + side, -2.5 * wind - 0.9 * cut, 0, sg * (0.5 * wind - 0.4 * cut));
			add('forearm_' + side, -0.9 * wind - 0.2 * cut, 0, 0);
			add('chest', 0.15 * cut - 0.1 * wind, sg * (0.35 * wind - 0.5 * cut), 0);
			add('spine', 0.2 * cut, 0, 0);
			add('head', -0.2 * wind + 0.15 * cut, 0, 0);
		}
		// a hit: the body thrown the way the blow went
		if (s.hit >= 0) {
			const k = Math.sin(clamp(s.hit / 0.45, 0, 1) * Math.PI) * (1 - s.hit);
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

	// ---------- quad: four legs, a long back, a neck and a tail ----------
	// front legs upperarm / forearm / hand, hind legs thigh / shin / foot / toe (the hock), as the
	// Ridge Hound's sheet is boned (tools/monsters/specs)
	function quad(_dt) {
		const s = state;
		const g = s.gait;
		const ph = s.phase;
		// a trot (the diagonal pairs together) that opens into a bounding run with the speed: the
		// back flexes and stretches with each bound
		const run = clamp((s.speed - 2.5) / 4, 0, 1) * g;
		const legs = [['L', 'F', 0], ['R', 'H', 0], ['R', 'F', Math.PI], ['L', 'H', Math.PI]];
		for (const [side, end, o0] of legs) {
			// the bound brings the two front feet nearly together, and the two hind ones
			const o = o0 + run * (end === 'H' ? 1.3 : 0) + run * (side === 'R' ? 0.35 : 0) * (end === 'F' ? 1 : -1);
			const sw = Math.sin(ph + o);
			const lift = Math.max(0, Math.sin(ph + o + Math.PI / 2));
			const amp = (0.38 + 0.3 * run) * g;
			if (end === 'F') {
				add('upperarm_' + side, -sw * amp, 0, 0);
				add('forearm_' + side, -lift * 0.35 * g, 0, 0);
				// the wrist folds back as the paw comes up
				add('hand_' + side, lift * 1.1 * g, 0, 0);
			} else {
				add('thigh_' + side, -sw * amp * 0.9, 0, 0);
				add('shin_' + side, -lift * 0.45 * g, 0, 0);
				add('foot_' + side, lift * 0.7 * g, 0, 0);
				add('toe_' + side, -lift * 0.5 * g, 0, 0);
			}
		}
		const fl = Math.sin(ph * 2) * 0.05 * g + Math.sin(ph) * 0.14 * run;
		add('spine', fl + Math.sin(s.t * 1.9) * 0.015, Math.sin(ph) * 0.05 * g, 0);
		add('chest', -fl * 0.6, -Math.sin(ph) * 0.05 * g, Math.sin(ph) * 0.03 * g);
		add('hips', 0, Math.sin(ph) * 0.06 * g, -Math.sin(ph) * 0.04 * g);
		// head low and level on the move (a hunting carriage), nodding with the stride
		const stalk = meta.stalk ?? 0.35;
		add('neck', 0.18 * stalk * g + Math.sin(ph * 2) * 0.05 * g, 0, 0);
		add('head', -0.12 * stalk * g + Math.sin(s.t * 0.6) * 0.06 * (1 - g), s.look * 0.8 + Math.sin(s.t * 0.37) * 0.2 * (1 - g), 0);
		// the tail: carried low, swinging with the hips
		for (const [i, n] of ['tail1', 'tail2', 'tail3'].entries()) add(n, -0.05 * g * i, Math.sin(ph - i * 0.8) * (0.12 + 0.1 * i) * g + Math.sin(s.t * 1.1 - i) * 0.08 * (1 - g), 0);
		// a rider (the Hound Rider's goblin): riding the stride, leaning back into a run, looking about
		add('rider_spine', -0.12 * run + Math.cos(ph * 2) * 0.04 * g, Math.sin(ph) * 0.06 * g, 0);
		add('rider_head', -Math.cos(ph * 2) * 0.05 * g, s.look * 0.6 + Math.sin(s.t * 0.5) * 0.4 * (1 - g), 0);
		add('rider_upperarm_R', -0.2 * run, 0, 0);
				// ears turning to sounds
		add('ear_L', 0, Math.max(0, Math.sin(s.t * 0.9)) * 0.3, 0);
		add('ear_R', 0, -Math.max(0, Math.sin(s.t * 0.7 + 2)) * 0.3, 0);
		// a strike: crouched on the forelegs, then the head thrown forward and the jaws snapped
		if (s.strike >= 0) {
			const k = s.strike;
			const crouch = smooth(k / 0.35) * (1 - smooth((k - 0.35) / 0.15));
			const bite = smooth((k - 0.35) / 0.12) * (1 - smooth((k - 0.6) / 0.4));
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
			// (its rider swings down at you as it bites)
			add('rider_upperarm_R', -1.6 * crouch + 1.2 * bite, 0, -0.4 * crouch);
			add('rider_forearm_R', -0.6 * crouch, 0, 0);
			add('rider_spine', 0.15 * bite, -0.2 * bite, 0);
		}
		// a hit: the body thrown the way the blow went, the head snapped round
		if (s.hit >= 0) {
			const k = Math.sin(clamp(s.hit / 0.45, 0, 1) * Math.PI) * (1 - s.hit);
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

	// ---------- flyer: two pairs of wings beating, six legs hanging (the Lampeater) ----------
	function flyer(_dt) {
		const s = state;
		const alive = s.death < 0 ? 1 : 0;
		// a slow beat hovering, quicker on the move; the hind wings a little behind the fore
		const ph = s.t * (7 + 3 * s.gait);
		const w = Math.sin(ph), w2 = Math.sin(ph - 0.45);
		for (const side of ['L', 'R']) {
			const sg = side === 'L' ? 1 : -1;
			add('wing_' + side, 0, sg * 0.08 * s.gait, sg * (w * 0.75 + 0.1) * alive);
			add('wing2_' + side, 0, 0, sg * (w2 * 0.6 + 0.05) * alive);
			// the legs hang, swept back on the move, stirring
			for (const [k, n] of ['leg1', 'leg2', 'leg3'].entries()) {
				add(`${n}a_${side}`, 0.3 * s.gait + Math.sin(s.t * 1.3 + k + sg) * 0.08, 0, 0);
				add(`${n}b_${side}`, Math.sin(s.t * 1.1 + k) * 0.1, 0, 0);
			}
		}
		// the body rides the beat, nose down on the move
		add('hips', 0.15 * s.gait - w * 0.04 * alive, 0, 0);
		add('abdomen', Math.sin(s.t * 2) * 0.06 + w * 0.05 * alive, Math.sin(s.t * 1.3) * 0.08, 0);
		add('abdomen2', Math.sin(s.t * 2 - 0.5) * 0.08, Math.sin(s.t * 1.3 - 0.4) * 0.1, 0);
		add('head', 0, s.look * 0.6, 0);
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
			const k = Math.sin(clamp(s.hit / 0.45, 0, 1) * Math.PI) * (1 - s.hit);
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
		const s = state;
		const g = s.gait, ph = s.phase;
		for (const [side, n, o] of SPIDER) {
			const sg = side === 'L' ? 1 : -1;
			const p = ph + o;
			// (forward is a turn about y one way on the left and the other on the right)
			const fwd = Math.sin(p) * 0.32 * g + Math.sin(s.t * 0.9 + n * 1.7 + sg) * 0.03 * (1 - g);
			const lift = Math.max(0, Math.cos(p)) * 0.38 * g;
			add(`leg${n}a_${side}`, 0, -sg * fwd, sg * lift);
			add(`leg${n}b_${side}`, 0, 0, -sg * lift * 0.6);
		}
		// the body rides low and level, rocking a little with each set of four
		add('hips', Math.sin(s.t * 2.1) * 0.02 + Math.sin(ph * 2) * 0.03 * g, Math.sin(ph) * 0.05 * g, 0);
		add('chest', 0, Math.sin(ph) * -0.04 * g, Math.sin(ph) * 0.03 * g);
		add('head', Math.sin(s.t * 0.8) * 0.05 * (1 - g), s.look * 0.6 + Math.sin(s.t * 0.47) * 0.15 * (1 - g), 0);
		// a strike: it rears, the front pair raised and spread, and drives them down into you
		if (s.strike >= 0) {
			const k = s.strike;
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
		if (s.hit >= 0) {
			const k = Math.sin(clamp(s.hit / 0.35, 0, 1) * Math.PI) * (1 - s.hit);
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
		}
	}
	function bipedBeats() {
		const s = state, m = s.menace * (1 - s.gait * 0.5);
		if (m > 0.01) {
			const r = rattle(s.t) * 0.01 * m;
			add('head', 0.08 * m + r, 0, r);
			add('chest', 0.05 * m, 0, 0);
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
		const k = b.k, e = env(k), sd = b.side > 0 ? 'L' : 'R';
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
		}
	}
	function flyerBeats() {
		const b = state.beat;
		if (!b) return;
		const k = b.k, e = env(k);
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
		}
	}
	const BEAT_PLANS = { biped: bipedBeats, quad: quadBeats, flyer: flyerBeats, spider: spiderBeats };

	const PLANS = { biped, quad, flyer, spider };
	const plan = PLANS[meta.rig] || biped;
	const beats = BEAT_PLANS[meta.rig] || bipedBeats;

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
			const Rp = _qp.clone().invert().multiply(_q).multiply(_qp);
			b.quaternion.copy(Rp.multiply(x.rest));
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
		// the hips ride the gait (bob) and sink in death
		const hips = B.hips;
		if (hips) {
			const s = state;
			const bob = Math.abs(Math.cos(s.phase)) * 0.035 * hipH * s.gait;
			const sink = s.death >= 0 ? smooth(s.death / 1.1) * hipH * 0.62 : 0;
			const crouch = (meta.stalk ?? 0.35) * 0.04 * hipH * s.gait;
			_q.copy(hips.b.parent ? hips.b.parent.getWorldQuaternion(_qp).premultiply(_qi) : _qp.identity()).invert();
			const v = new THREE.Vector3(0, bob - sink - crouch, 0).applyQuaternion(_q);
			hips.b.position.add(v);
			hips.b.updateMatrixWorld(true);
		}
	}

	return {
		state,
		// speed in m/s; the stride follows the legs' length
		update(dt, { speed = 0, look = 0, menace = 0, dormant = 0 } = {}) {
			const s = state;
			s.t += dt;
			s.menace += (menace - s.menace) * Math.min(1, dt * 2.5);
			s.dormant = dormant;
			// a beat now and then while it stands (more often the more it means you harm)
			if (s.beat) { s.beat.k += dt / s.beat.dur; if (s.beat.k >= 1 || s.death >= 0) s.beat = null; }
			else if (s.death < 0 && s.strike < 0 && s.gait < 0.35 && dormant <= 0) {
				s.beatT -= dt * (1 + s.menace * 1.5);
				if (s.beatT <= 0) {
					s.beatT = 1.5 + Math.random() * 4;
					// (at you, it growls and twitches; it noses the ground and shakes itself only at ease)
					const list = (BEATS[meta.rig] || BEATS.biped).filter((x) => (x[0] === 'growl' ? s.menace > 0.2 : s.menace < 0.5 || x[0] === 'twitch' || x[0] === 'scrape' || x[0] === 'tap'));
					let w = Math.random() * list.reduce((a, x) => a + x[1], 0);
					for (const x of list) { w -= x[1]; if (w < 0) { startBeat(x[0]); break; } }
				}
			}
			s.speed = speed;
			const tg = clamp(speed / 1.2, 0, 1);
			s.gait += (tg - s.gait) * Math.min(1, dt * 6);
			const stride = hipH * 1.35;
			s.phase = (s.phase + (speed / stride) * Math.PI * dt + (1 - s.gait) * 0) % TAU;
			s.look += (look - s.look) * Math.min(1, dt * 4);
			if (s.strike >= 0) { s.strike += dt / (meta.strikeTime || 0.9); if (s.strike >= 1) s.strike = -1; }
			if (s.hit >= 0) { s.hit += dt / 0.5; if (s.hit >= 1) s.hit = -1; }
			if (s.death >= 0) s.death += dt;
			clear();
			plan(dt);
			if (s.death < 0) beats();
			apply();
		},
		// a beat by name, now (a growl as it sees you)
		beat(kind) { if (state.death < 0) { startBeat(kind); state.beatT = 2 + Math.random() * 3; } },
		// what happened since last asked: 'growl', 'scuff', 'twitch' ...
		drain() { const e = state.events; state.events = []; return e; },
		// where a bone is in the world, into out
		at(name, out) { const x = B[name]; return x ? x.b.getWorldPosition(out) : null; },
		strike(side = meta.strikeSide ?? 1) { state.strike = 0; state.strikeSide = side; },
		hit(dir) { state.hit = 0; if (dir) state.hitDir.copy(dir).setY(0).normalize(); },
		die() { if (state.death < 0) state.death = 0; },
		dead: () => state.death >= 0,
		// a fixed pose for previews: name in rest | walk | run | strike | hit | death, t its time
		pose(name, t = 0) {
			const s = state;
			Object.assign(s, { strike: -1, hit: -1, death: -1, gait: 0, phase: 0, t: 1.3 });
			if (name === 'walk' || name === 'run') { s.gait = 1; s.phase = t * TAU; }
			if (name === 'strike') { s.strike = t; s.strikeSide = meta.strikeSide ?? 1; }
			if (name === 'hit') { s.hit = t; s.hitDir.set(0, 0, -1); }
			if (name === 'death') s.death = t * 1.2;
			s.beat = null; s.dormant = name === 'dormant' ? 1 : 0; s.menace = name === 'menace' ? 1 : 0;
			if ((BEATS[meta.rig] || []).some((x) => x[0] === name)) { startBeat(name); s.beat.k = t; s.events = []; }
			clear();
			plan(0);
			beats();
			apply();
		},
	};
}
