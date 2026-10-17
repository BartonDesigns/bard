// Your hand casting, through your own eyes: your own hand (combat/anatomical-hand.js, from your
// body once it is known), open, thrust out from below the view toward the crosshair as a spell
// leaves it, held a breath, and let down again, the school's light gathering in the palm. The
// right hand casts; with something in the right hand (a bat, a pipe) the left does. A beam is
// both hands, thrust out together, heels touching, shaking with the force of it (magic/beam.js). With a field arm in your hands the weapon's own hands stay on
// it and only the light shows (magic/caster.js).
//
// Poses are [x, y, z, pitch, yaw, roll] in the view's frame, as the fists' are (combat/melee-view.js):
// a palm turned out (the fist's knuckles-forward pose tipped up a quarter turn, so the fingers
// point up and the palm faces the aim).

import * as THREE from 'three';
import { createAnatomicalHand } from '../combat/anatomical-hand.js';

const REST = { L: [-0.22, -0.5, -0.32, 0.9, -0.1, 1.3], R: [0.22, -0.5, -0.32, 0.9, 0.1, -1.3] };
const OUT = { L: [-0.1, -0.1, -0.46, 1.62, -0.12, 1.45], R: [0.1, -0.1, -0.46, 1.62, 0.12, -1.45] };
const BEAM = { L: [-0.05, -0.17, -0.5, 1.6, -0.3, 1.45], R: [0.05, -0.17, -0.5, 1.6, 0.3, -1.45] };
const RISE = 0.12, DROP = 0.28;
const ease = (u) => u * u * (3 - 2 * u);
const _p = new THREE.Vector3();

export function createCastHands({ camera, fx, isPhone = false }) {
	const root = new THREE.Group();
	root.name = 'cast-hands'; root.visible = false;
	root.scale.setScalar(1.35);
	camera.add(root);
	const S = {};
	for (const side of ['L', 'R']) {
		const grp = new THREE.Group();
		grp.visible = false;
		root.add(grp);
		S[side] = { grp, hand: null, t: -1, hold: 0, c: null, to: OUT, cur: Float32Array.from(REST[side]) };
	}
	let body = null;
	// your own hands, once your body has been made (people/avatar.js)
	function setBody(P) {
		if (!P || body === P) return;
		body = P;
		for (const side of ['L', 'R']) {
			const A = S[side];
			A.hand?.dispose();
			A.hand = createAnatomicalHand(P, side, { phone: isPhone });
			if (A.hand) { A.hand.pose('open'); A.hand.mesh.renderOrder = 2; A.grp.add(A.hand.mesh); }
		}
	}
	// a cast from a side's hand (c: the school's colour; big: a great spell, held longer)
	function cast(side, c, big = false) {
		const A = S[side];
		A.t = 0; A.hold = big ? 0.4 : 0.16; A.c = c; A.to = OUT;
	}
	// beaming: the colour of a beam gathering or pouring from both hands while it lasts
	function update(dt, beaming = null) {
		let any = false;
		for (const side of ['L', 'R']) {
			const A = S[side];
			if (beaming) { if (A.t < 0 || A.t > RISE) A.t = Math.min(A.t < 0 ? 0 : A.t, RISE); A.hold = 1e9; A.c = beaming; A.to = BEAM; }
			else if (A.hold > 1e8) A.hold = 0;
			if (A.t < 0) { A.grp.visible = false; continue; }
			A.t += dt;
			const end = RISE + A.hold + DROP;
			if (A.t >= end) { A.t = -1; A.grp.visible = false; continue; }
			const k = A.t < RISE ? ease(A.t / RISE) : A.t < RISE + A.hold ? 1 : 1 - ease((A.t - RISE - A.hold) / DROP);
			const r = REST[side], o = A.to[side];
			for (let i = 0; i < 6; i++) A.cur[i] = r[i] + (o[i] - r[i]) * k;
			A.grp.position.set(A.cur[0], A.cur[1], A.cur[2]);
			// (shaking with the force of a beam)
			if (beaming && k > 0.9) A.grp.position.add(_p.set((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.005));
			A.grp.rotation.set(A.cur[3], A.cur[4], A.cur[5], 'YXZ');
			A.grp.visible = !!A.hand;
			any = true;
			// (the school's light in the palm)
			if (A.c && k > 0.6) {
				A.grp.updateWorldMatrix(true, false);
				_p.set(0, 0.07, -0.03).applyMatrix4(A.grp.matrixWorld);
				fx.emit(_p.x, _p.y, _p.z, (Math.random() - 0.5) * 0.3, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3, 0.3, 0.12, 0.02, A.c, 1, 0, 1);
			}
		}
		root.visible = any;
		return any;
	}
	const busy = () => S.L.t >= 0 || S.R.t >= 0;
	function dispose() { for (const side of ['L', 'R']) S[side].hand?.dispose(); root.removeFromParent(); }
	return { setBody, cast, update, busy, dispose, root };
}
