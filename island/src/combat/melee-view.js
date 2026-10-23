// Your fists through your own eyes in a fight: two forearms and hands (a closed fist with its
// knuckles and wrapped thumb, the wrist, the forearm and a sleeve running back out of view),
// each a single mesh of skin and one of cloth: once your body is known, its own hands and the
// sleeves, cuffs and gloves of what you wear (people/sleeve.js), folding as the arms move.
//
// They hold a boxer's guard that breathes and bobs with your steps: the lead (left) hand forward
// and a little higher, the rear (right) one back by the chin, elbows in, about shoulder width
// apart, framed to the screen (each fist placed by where it falls in the view, so both show at
// the bottom of a wide desktop and of a narrow phone alike, never crossing the middle). Each
// strike is three key poses (the guard, the end of the wind-up, full extension) eased through
// the strike's own timing (combat/melee-rules.js): a jab or a cross runs straight out along
// its own shoulder's line toward the crosshair, the fist turning over only near full reach, the
// other hand pulled back to the chin, then snaps back to the guard; a held heavy draws the rear
// hand back and down, the body coiled, trembling more the longer it is held; a blow that lands
// holds at full reach through the hit-stop. A block brings the
// forearms up in front of the face; a dodge tucks them and lets them trail; a takedown wraps the
// right arm round a throat; something picked up (a bat, a pipe, a bottle) sits in the right hand
// with the left on it too. Every pose is written into fixed arrays and followed by springs:
// nothing is made per frame.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createAnatomicalHand } from './anatomical-hand.js';
import { MELEE_ITEMS, ONE_HANDED, meleeItem, meleeMaterials } from './melee-items.js';
import { dressArms } from '../people/sleeve.js';

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const out3 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);
// poses: [x, y, z, pitch, yaw, roll] for the left and the right fist, in the camera's frame
// (pitch tips the forearm down from the fist; yaw swings it to the side; roll turns the fist)
const P = (l, r) => ({ L: l, R: r });
// the guard is placed on screen (see frame() below); these are its turns, and where each fist
// sits in the view: [x, y] as a share of the view's half width and half height, and depth
const GUARD = P([-0.125, -0.095, -0.38, 0.62, -0.04, 0.35], [0.145, -0.11, -0.32, 0.7, 0.04, -0.45]);
const SCREEN = { L: [-0.36, -0.5, 0.37], R: [0.5, -0.72, 0.31] };
// (the most a fist strays to the side, in the rig's metres: shoulder width on a wide screen)
const WIDE = { L: 0.15, R: 0.17 };
const POSE = {
	block: P([-0.075, -0.03, -0.29, 1.3, 0.12, 2.85], [0.075, -0.035, -0.29, 1.3, -0.12, -2.85]),
	choke: P([0.12, -0.19, -0.43, 0.3, -1.15, 0.6], [-0.1, -0.2, -0.44, 0.2, 1.3, -0.3]),
	cuffed: P([-0.2, -0.55, -0.2, 0.9, 0.2, 0.4], [0.2, -0.55, -0.2, 0.9, -0.2, -0.4]),
	// with something in hand: both hands on it, low at the right hip, the end up past the shoulder
	item: P([0.1, -0.25, -0.38, 0.6, -0.3, -1.4], [0.17, -0.2, -0.36, 0.6, -0.35, -1.4]),
	// something held in one hand: up at the guard, its end forward of the knuckles
	blade: P(GUARD.L, [0.15, -0.13, -0.38, 0.45, -0.25, -0.75]),
};
// each strike: [wind-up end, full extension] as offsets from the guard ('g' entries are filled
// from the guard each frame: { d: [dx, dy, dz, dpitch, dyaw, droll] }) or as whole poses. At
// full reach the forearm runs back in line with its shoulder, as a straight arm does.
const G = (d) => ({ d });
const MOVE = {
	// the lead hand straight out, the rear one drawn in to the chin
	jab: [P(G([0.005, 0.004, 0.02, -0.05, 0, 0.05]), G([0, 0, 0.01, 0, 0, 0])), P([-0.05, -0.035, -0.74, 0.13, -0.11, 0.15], G([-0.01, 0.006, 0.02, 0, 0, 0]))],
	// the rear hand out across, the shoulder behind it; the lead pulled back to cover
	cross: [P(G([0, 0, 0.01, 0, 0, 0]), G([0.01, -0.004, 0.03, 0.05, -0.03, -0.05])), P(G([0.012, 0.012, 0.05, 0.15, 0.05, 0.1]), [0.02, -0.03, -0.76, 0.135, 0.15, -0.15])],
	hook: [P(G([0, 0, 0.02, 0, 0, 0]), [0.32, -0.1, -0.42, 0.25, -1.0, -1.2]), P(G([0.01, 0.01, 0.04, 0.1, 0, 0]), [-0.06, -0.06, -0.6, 0.15, 0.95, -0.35])],
	// the rear hand drawn back and down past the chin, the body coiled; thrown through with the
	// hips and shoulders, longer and lower than a cross
	heavy: [P(G([0.02, 0.015, 0.05, 0.15, 0.06, 0.1]), G([0.03, 0.035, 0.015, 0.15, -0.35, -0.4])), P(G([0.02, 0.01, 0.07, 0.2, 0.05, 0.15]), [0.035, -0.05, -0.74, 0.16, 0.14, -0.3])],
	// a level swing with both hands, right to left; an overhead brought down
	swing: [P([0.22, -0.17, -0.3, 0.2, -1.0, -3.0], [0.3, -0.13, -0.28, 0.15, -1.25, -3.0]), P([-0.24, -0.13, -0.5, 0.12, 0.95, -0.2], [-0.15, -0.1, -0.52, 0.12, 1.05, -0.2])],
	overhead: [P([0.08, 0.0, -0.26, 0.6, -0.1, -1.5], [0.13, 0.05, -0.24, 0.6, -0.15, -1.5]), P([0.02, -0.26, -0.55, 1.0, -0.05, 1.5], [0.08, -0.2, -0.53, 1.0, -0.1, 1.5])],
};

// one arm: the back of the hand, the ridge of knuckles in front, the fingers folded under them,
// the thumb across them and its mound, wrist and forearm in skin; a sleeve over the forearm.
// The fist's frame: knuckles to -z, the back of the hand to +y, the forearm running back to +z.
function armGeometry(side) {
	const s = side === 'L' ? -1 : 1;
	const g = [];
	const add = (geo) => { geo.deleteAttribute('uv'); g.push(geo.index ? geo.toNonIndexed() : geo); };
	const cap = (r, len, x, y, z) => new THREE.CapsuleGeometry(r, len, 4, 10).rotateZ(Math.PI / 2).translate(x, y, z);
	add(new THREE.SphereGeometry(1, 16, 12).scale(0.044, 0.034, 0.042).translate(0, 0.002, 0.012));
	add(cap(0.0145, 0.056, 0, 0.011, -0.022));
	add(cap(0.0135, 0.054, 0, -0.013, -0.03));
	add(new THREE.CapsuleGeometry(0.0105, 0.036, 4, 8).rotateZ(Math.PI / 2).rotateY(0.25 * s).translate(-0.012 * s, -0.03, -0.018));
	add(new THREE.SphereGeometry(1, 10, 8).scale(0.016, 0.02, 0.026).translate(-0.034 * s, -0.012, 0.012));
	add(new THREE.CylinderGeometry(0.026, 0.03, 0.08, 12).rotateX(Math.PI / 2).translate(0, -0.004, 0.07));
	add(new THREE.CylinderGeometry(0.03, 0.041, 0.3, 14).rotateX(Math.PI / 2).translate(0, -0.004, 0.24));
	const skin = mergeGeometries(g);
	const sleeve = new THREE.CylinderGeometry(0.047, 0.058, 0.42, 16, 1, true).rotateX(Math.PI / 2).translate(0, -0.004, 0.36);
	sleeve.deleteAttribute('uv');
	// a cuff: a slightly thicker ring at the sleeve's end
	const cuff = new THREE.TorusGeometry(0.047, 0.006, 6, 18).translate(0, -0.004, 0.15);
	cuff.deleteAttribute('uv');
	return { skin, sleeve: mergeGeometries([sleeve.toNonIndexed(), cuff.toNonIndexed()]) };
}

export function createFistView({ camera, isPhone = false }) {
	const root = new THREE.Group(); root.name = 'melee-fists'; root.visible = false;
	// (the whole rig a little further out at the same apparent size, clear of the view's near plane)
	root.scale.setScalar(1.35);
	const skinMat = new THREE.MeshStandardMaterial({ color: 0xc08a68, roughness: 0.62, metalness: 0 });
	const clothMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
	const arms = {};
	for (const side of ['L', 'R']) {
		const G = armGeometry(side), grp = new THREE.Group();
		const a = new THREE.Mesh(G.skin, skinMat), b = new THREE.Mesh(G.sleeve, clothMat);
		a.renderOrder = b.renderOrder = 2;
		grp.add(a, b);
		root.add(grp);
		arms[side] = { grp, fallback: a, sleeve: b, anatomical: null, garment: null, cur: new Float32Array(6), vel: new Float32Array(6), want: new Float32Array(6) };
		arms[side].cur.set(GUARD[side]); arms[side].cur[1] -= 0.4;
	}
	// things picked up, in the right hand: the grip across the palm a little toward the knuckles,
	// its surface on the palm, the rest out past the thumb (combat/melee-items.js)
	const mats = meleeMaterials(), items = {};
	for (const k of MELEE_ITEMS) {
		const m = meleeItem(k, mats); items[k] = m;
		m.visible = false; m.traverse((o) => { o.renderOrder = 2; }); m.rotation.set(0, 0, Math.PI / 2); m.position.set(0, -0.013 - m.userData.r, 0); arms.R.grp.add(m);
	}
	camera.add(root);
	let shown = 0, lastItem = null, body = null;

	// your own colours, once your body has been made (people/avatar.js)
	function colours(me) {
		if (!me?.P || body === me.P) return;
		body = me.P;
		for (const side of ['L', 'R']) {
			const a = arms[side]; a.anatomical?.dispose(); a.garment?.dispose(); a.garment = null;
			a.anatomical = createAnatomicalHand(body, side, { phone: isPhone });
			if (a.anatomical) {
				a.anatomical.mesh.renderOrder = 2; a.grp.add(a.anatomical.mesh);
				// the sleeve, cuff and glove over this forearm, cut to it (the skin under them left out)
				// (the upper arm is not posed here, so the sleeve runs straight on past the elbow, out of view)
				a.garment = dressArms(body, a.anatomical.mesh, { sides: [side], isPhone, far: 0.75, upper: false });
				if (a.garment) { a.garment.mesh.renderOrder = 2; a.grp.add(a.garment.mesh); }
			}
			a.fallback.visible = a.sleeve.visible = !a.anatomical;
		}
		const c = me.P.skinMat?.color;
		if (c) skinMat.color.copy(c).multiplyScalar(0.85);
		const st = me.P.dna?.style, col = st?.outer?.col || st?.top?.col;
		if (col) try { clothMat.color.set(col); } catch { /* not a colour */ }
	}

	const W = new Float32Array(6);
	// the view's frame to each forearm's, and down in the view's frame, for the folds
	const toArm = new THREE.Matrix4(), down = new THREE.Vector3(), camQ = new THREE.Quaternion();
	function fold(dt, s) {
		camera.getWorldQuaternion(camQ);
		down.set(0, -1, 0).applyQuaternion(camQ.invert());
		root.updateMatrix();
		for (const side of ['L', 'R']) {
			const A = arms[side];
			if (!A.garment) continue;
			A.grp.updateMatrix();
			toArm.multiplyMatrices(root.matrix, A.grp.matrix).invert();
			A.garment.pose(dt, s.block ? 0.5 : 0, toArm, down);
		}
	}
	function lerpPose(out, a, b, k, kr = k) { for (let i = 0; i < 5; i++) out[i] = a[i] + (b[i] - a[i]) * k; out[5] = a[5] + (b[5] - a[5]) * kr; }
	// the guard framed to the view: each fist where it falls on screen at its depth, no further
	// out than shoulder width
	let lastAspect = 0, lastFov = 0;
	function frame() {
		if (camera.aspect === lastAspect && camera.fov === lastFov) return;
		lastAspect = camera.aspect; lastFov = camera.fov;
		const ty = Math.tan((camera.fov * Math.PI) / 360), tx = ty * camera.aspect;
		// (a narrow screen, a phone held upright, sees little to either side: the fists sit
		// further out from the eye, so smaller, and wider apart on the screen, to stay apart)
		const narrow = Math.max(0, Math.min(1, (1 - camera.aspect) / 0.55));
		for (const side of ['L', 'R']) {
			const sx = SCREEN[side][0] * (1 + 0.4 * narrow), sy = SCREEN[side][1] * (1 + (side === 'L' ? 0.12 : 0) * narrow), d = SCREEN[side][2] * (1 + 0.6 * narrow), g = GUARD[side];
			g[0] = Math.sign(sx) * Math.min(WIDE[side], Math.abs(sx) * tx * d);
			g[1] = sy * ty * d; g[2] = -d;
		}
	}
	// a key pose for a side: whole, or an offset from the guard (into tmp)
	const KA = { L: new Float32Array(6), R: new Float32Array(6) }, KB = { L: new Float32Array(6), R: new Float32Array(6) };
	function key(k, side, guard, out) {
		const v = k[side];
		if (v.d) { for (let i = 0; i < 6; i++) out[i] = guard[i] + v.d[i]; return out; }
		return v;
	}
	// the pose wanted now, written into each arm's want
	function aim(s, t) {
		for (const side of ['L', 'R']) {
			const A = arms[side], w = A.want;
			// (a one-handed thing leaves the other hand up in its guard)
			const solo = s.item && ONE_HANDED.has(s.item) && side === 'L';
			const guard = s.item && !solo ? (ONE_HANDED.has(s.item) ? POSE.blade[side] : POSE.item[side]) : GUARD[side];
			let base = guard;
			if (s.cuffed) base = POSE.cuffed[side];
			else if (s.take) base = POSE.choke[side];
			else if (s.block) base = POSE.block[side];
			w.set(base);
			const K = s.move && !solo && MOVE[s.anim];
			if (K && !s.take && !s.cuffed) {
				const wind = key(K[0], side, guard, KA[side]), hit = key(K[1], side, guard, KB[side]), m = s.m, mt = s.mt;
				if (mt < m.wind) lerpPose(w, guard, wind, ease(mt / m.wind));
				else if (mt < m.wind + m.active) {
					// out along the line fast, the fist turning over only in the last of it
					const u = (mt - m.wind) / m.active;
					lerpPose(w, wind, hit, out3(u), ease((u - 0.35) / 0.65));
				} else {
					// and snapped back: quick off the target, easing into the guard
					const u = (mt - m.wind - m.active) / m.recover;
					lerpPose(W, hit, guard, out3(Math.min(1, u * 1.15))); w.set(W);
				}
				// a heavy held back: drawn further and lower the longer it is held, the hand
				// trembling more and more, the lead hand up to cover
				if (s.charging) {
					const c = s.charge;
					if (side === 'R') { w[2] += 0.012 * c; w[0] += 0.006 * c; w[1] += 0.01 * c; w[4] -= 0.12 * c; w[1] += (Math.sin(t * 57) * 0.0035 + Math.sin(t * 41 + 1) * 0.0025) * (0.3 + c); w[0] += Math.sin(t * 47 + 2) * 0.002 * (0.3 + c); }
					else { w[1] += 0.012 * c; w[2] += 0.02 * c; }
				}
			}
			// breathing and the steps' bob
			w[1] += Math.sin(t * 1.7 + (side === 'L' ? 0 : 0.6)) * 0.004 - Math.abs(Math.sin(s.step * Math.PI)) * 0.012 * s.pace;
			w[0] += Math.sin(s.step * Math.PI * 2) * 0.006 * s.pace;
			// a dodge: tucked in, trailing against the way you go
			if (s.dodge > 0) { w[1] -= 0.05 * s.dodge; w[0] -= s.dodgeSide * 0.05 * s.dodge; }
			// a blow taken: knocked about
			w[1] += s.rock * 0.03; w[2] += s.rock * 0.04;
			// away: down out of view
			if (!s.on) w[1] -= 0.45;
		}
	}
	// follow the wanted pose: quick while striking, softer otherwise
	function follow(dt, quick) {
		const k = quick ? 46 : 20;
		for (const side of ['L', 'R']) {
			const A = arms[side];
			let h = dt;
			while (h > 1e-6) {
				const d = Math.min(h, 1 / 240);
				for (let i = 0; i < 6; i++) { const a = -k * k * (A.cur[i] - A.want[i]) - 2 * k * A.vel[i]; A.vel[i] += a * d; A.cur[i] += A.vel[i] * d; }
				h -= d;
			}
			const c = A.cur;
			A.grp.position.set(c[0], c[1], c[2]);
			A.grp.rotation.set(c[3], c[4], c[5], 'YXZ');
		}
	}
	return {
		root,
		// s: { on, item, move, anim, m, mt, charging, charge, block, take, cuffed, dodge (0..1),
		// dodgeSide, rock (0..1), step (the gait's phase), pace (0..1) }
		update(dt, t, s, me) {
			colours(me);
			shown += ((s.on ? 1 : 0) - shown) * Math.min(1, dt * 8);
			const vis = s.on || shown > 0.02;
			if (root.visible !== vis) root.visible = vis;
			if (!vis) return;
			// the right hand closed on what it holds, the left on a two-handed thing's shaft
			for (const side of ['L', 'R']) {
				const held = s.item && (side === 'R' || !ONE_HANDED.has(s.item));
				arms[side].anatomical?.pose(held ? 'grip' : s.take || s.cuffed ? 'open' : 'fist', held ? (side === 'R' ? items[s.item] : 0.019) : null);
			}
			if (s.item !== lastItem) { for (const k in items) items[k].visible = k === s.item; lastItem = s.item; }
			frame();
			aim(s, t);
			follow(dt, !!s.move);
			fold(dt, s);
		},
		// (for checks: a hand's anatomical rig and its last pose)
		anatomical: (side) => arms[side].anatomical,
		hide() { root.visible = false; shown = 0; },
		dispose() {
			for (const a of Object.values(arms)) { a.anatomical?.dispose(); a.garment?.dispose(); }
			root.traverse(o => o.geometry?.dispose());
			for (const m of [skinMat, clothMat, ...Object.values(mats)]) m.dispose();
			root.removeFromParent();
		},
		isPhone,
	};
}
