// How a creature moves: its bones turned by hand each frame, as the dinosaurs and the people are
// (no baked clips). A creature model (creatures/models.js) comes with its rig's joints in model
// space (meta.joints, from tools/monsters/build.py), so every motion here is written in the
// model's own axes (x to its left, y up, z forward) and turned into each bone's frame as it goes.
//
// A rig kind (meta.rig) picks the body plan: 'biped' (two legs, two arms) for now; more come with
// their creatures. Each plan answers the same calls: a gait at a speed, an idle, a strike, a hit
// from a side, a death. They blend: the gait's weight follows the speed, a strike or a hit is laid
// over whatever the body is doing, and death takes it over.

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
	const state = { phase: 0, speed: 0, gait: 0, strike: -1, strikeSide: 1, hit: -1, hitDir: new THREE.Vector3(0, 0, -1), death: -1, t: 0, look: 0, lunge: 0 };

	function clear() { for (const x of bones) x.rot.set(0, 0, 0); }
	const R = (n) => B[n]?.rot;
	const add = (n, x, y, z) => { const r = R(n); if (r) { r.x += x; r.y += y; r.z += z; } };

	// ---------- biped: two legs, two arms, a spine ----------
	function biped(dt) {
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

	const PLANS = { biped };
	const plan = PLANS[meta.rig] || biped;

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
		update(dt, { speed = 0, look = 0 } = {}) {
			const s = state;
			s.t += dt;
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
			apply();
		},
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
			clear();
			plan(0);
			apply();
		},
	};
}
