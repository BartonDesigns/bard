// People for the games and the set pieces: the pitcher and the fielders, the keeper, the
// holder, the knights, the archers, the surfer, the drum circle. The same real bodies as the
// street (body.js), dressed in a team's kit or whatever the scene wants, moved by motion.js
// and its actions (actions.js).
//
// A cast hands out actors at once: each is a group the game places and turns as it likes
// (facing its -z, as the old stand-ins did); the body is built into it a frame or two later
// (one body a frame, so nothing stutters), and without the body assets the game simply plays
// on with empty groups. Moving the group walks or runs the body in place: its legs keep pace
// with how fast the group goes.

import * as THREE from 'three';
import { loadPeopleAssets, peopleAssetsNow, buildPerson, personDNA, rng } from './body.js';
import { createMotion } from './motion.js';
import { kitFor, hairFor } from './wardrobe.js';

let A = null, loading = null;
function assets() {
	if (!A) A = peopleAssetsNow();
	if (A || loading) return;
	loading = loadPeopleAssets().then((a) => { A = a; }).catch(() => { A = false; });
}

// spec: { seed, age, male, style(d) -> outfit, kit: [sport, team, number, extra], skin, shadow }
export function createCast(parent) {
	const list = [], queue = [];
	const tv = new THREE.Vector3(), tq = new THREE.Quaternion(), fw = new THREE.Vector3();
	function add(spec = {}) {
		const g = new THREE.Group();
		const inner = new THREE.Group();
		inner.rotation.y = Math.PI;
		g.add(inner);
		(spec.parent || parent).add(g);
		const h = {
			g, inner, P: null, M: null, spec, hands: {}, last: null, speed: 0, run: 0,
			act(name, u) { h.want.act = [name, u]; h.want.play = null; h.M?.act(name, u); return h; },
			play(name, dur = 1, once = false) { if (!once && h.want.play?.[0] === name && !h.want.act) return h; h.want.act = null; h.want.play = [name, dur, once]; h.M?.play(name, dur, once); return h; },
			pose(name) { h.want.pose = name; h.M?.setPose(name); return h; },
			sit(y = 0.45) { h.want.sit = y; if (h.M) { if (y === null) h.M.stand(); else h.M.sit(y, true); } return h; },
			look(v) { h.want.look = v; return h; },
			gesture(n) { h.M?.gesture(n); return h; },
			// something held: a group riding the hand (a bat, a bow, a lance)
			hand(side = 'R') { if (!h.hands[side]) { h.hands[side] = new THREE.Group(); if (h.P) attach(h, side); else inner.add(h.hands[side]); } return h.hands[side]; },
			// where one of its joints is now (world), or null before the body is built
			at(bone, out = new THREE.Vector3()) { const i = h.P?.map[bone]; if (i === undefined) return null; h.P.root.updateMatrixWorld(true); return h.P.bones[i].getWorldPosition(out); },
			get height() { return h.P?.height ?? spec.height ?? 1.7; },
			want: { act: null, play: null, pose: null, sit: null, look: null },
		};
		list.push(h); queue.push(h);
		assets();
		return h;
	}
	function attach(h, side) {
		const b = h.P.bones[h.P.map['wrist.' + side]], hd = h.hands[side];
		b.add(hd);
		// the hand's grip: along the hand, a little into the palm
		hd.position.copy(h.P.rest.dirs[h.P.map['wrist.' + side]]).multiplyScalar(0.08);
	}
	function build(h) {
		const s = h.spec, seed = (s.seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
		let d = null;
		for (let k = 0; k < 30; k++) {
			d = personDNA((seed + k * 7919) >>> 0, { age: s.age ?? 20 + (seed % 23), skin: s.skin });
			if (s.male === undefined || d.male === s.male) break;
		}
		const r = rng(seed ^ 0xa11);
		let o = null;
		if (s.kit) o = kitFor(s.kit[0], s.kit[1], s.kit[2], d, s.kit[3] || {});
		else if (s.style) o = s.style(d, r);
		if (o) { o.hair = o.hair || (s.kit ? { ...hairFor(r, d, o), dyed: null, scarf: false } : hairFor(r, d, o)); o.printKind = Math.floor(r() * 9); d.style = o; d.styleSig = JSON.stringify(d.outfit); }
		if (s.height) d.height = s.height;
		const P = buildPerson(A, d);
		if (s.shadow === false) P.root.traverse((q) => { q.castShadow = false; });
		if (P.acc) P.acc.castShadow = false;
		const M = createMotion(P, () => 0);
		M.place(0, 0, 0, 0);
		h.inner.add(P.root);
		h.P = P; h.M = M;
		for (const side of Object.keys(h.hands)) attach(h, side);
		const W = h.want;
		if (W.pose) M.setPose(W.pose);
		if (W.sit !== null && W.sit !== undefined) M.sit(W.sit, true);
		if (W.play) M.play(...W.play);
		if (W.act) M.act(...W.act);
		h.onBuilt?.(h);
	}
	// each frame: build the next body, move every one
	function update(dt, t) {
		if (A && queue.length) build(queue.shift());
		for (const h of list) {
			if (!h.M) continue;
			// how fast the group moves along its facing: the legs walk (or run) to match
			h.g.getWorldPosition(tv);
			if (h.last && dt > 0) {
				const d = tv.clone().sub(h.last);
				h.g.getWorldQuaternion(tq); fw.set(0, 0, -1).applyQuaternion(tq);
				const v = Math.hypot(d.x, d.z) / dt;
				h.speed += (Math.min(9, v) * Math.sign(d.x * fw.x + d.z * fw.z || 1) - h.speed) * Math.min(1, dt * 8);
			}
			h.last = (h.last || new THREE.Vector3()).copy(tv);
			const M = h.M, S = M.S;
			// (one who rides, a board, a horse, a seat, never walks)
			M.want.speed = Math.abs(h.speed) > 0.2 && S.sitWant === 0 && !h.spec.still ? Math.abs(h.speed) : 0;
			M.want.run = Math.abs(h.speed) > 2.4 ? 1 : 0;
			M.want.heading = 0;
			if (h.want.look) { S.look.target = h.inner.worldToLocal(tv.copy(h.want.look)).clone(); } else S.look.target = null;
			M.update(dt, t, null);
			// the body stays where the group is: what the walk moved it is taken back, feet and all
			const dx = S.pos.x, dz = S.pos.z;
			if (dx || dz) { S.pos.x = 0; S.pos.z = 0; for (const l of S.legs) { l.lock.x -= dx; l.lock.z -= dz; l.from.x -= dx; l.from.z -= dz; } }
			const dist = h.P.root.getWorldPosition(tv).distanceTo(camPos);
			h.P.lod(dist);
		}
	}
	const camPos = new THREE.Vector3();
	function camera(c) { camPos.copy(c.position ?? c); }
	// done with them: the bodies' own geometry freed (the shared materials and maps stay)
	function dispose() {
		for (const h of list) {
			if (h.P) h.P.root.traverse((q) => { if (q.isMesh) { q.geometry.dispose(); if (q.material && !q.material.userData?.shared && q.material !== h.P.skinMat) q.material.dispose(); } });
			h.P?.clothMat?.dispose(); h.P?.skinMat?.dispose();
			h.g.removeFromParent();
		}
		list.length = 0; queue.length = 0;
	}
	return { add, update, dispose, camera, list };
}
