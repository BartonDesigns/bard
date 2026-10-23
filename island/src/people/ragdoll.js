// A person gone limp: struck by a car, hauled out of a driver's seat, or met by anything
// they cannot stand against. The body becomes eleven solid pieces (pelvis, chest, head,
// upper and lower arms, thighs and shins), each weighed as a real body is shared out
// (Dempster's fractions of the whole, the whole from their height and build), joined as a
// body is: elbows and knees are hinges that only bend the way they bend, the hips,
// shoulders, spine and neck turn freely but held by a muscle tone that fades as they go
// slack. Nothing bounces (no restitution, a grippy ground); a blow passes on the momentum
// it carries, shared by weight, so a car takes the legs out and the rest wraps over the
// bonnet. Rapier (vehicles/physics.js loads it), in a world of its own: the ground under
// the fallen as a height field, the buildings as boxes, the cars as moving blocks.
// Few at once (two on a phone); when a body comes to rest it is left lying as it fell.
//
// A creature goes limp the same way (creatures/rig.js reads its pieces off its own rig: the
// hound's legs hinge at the knees, its neck and tail flop; the goblin's arms swing), through
// the same hit(): a rig descriptor { rig: true, root, pieces, mass } stands where a person's
// P does, and its bones follow the pieces until it rests. Knocked down and not killed, it is
// handed back to its own motion (release) from where it lies.

import * as THREE from 'three';
import { specOf } from '../bay/cars.js';
import { loadRapier } from '../vehicles/physics.js';

// the pieces: the bone each one turns, the joints its ends lie at (a bone's head, or a
// bone's tail with '>'), its radius (of the height), its share of the weight, and what it
// hangs from
const SEG = [
	{ n: 'pelvis', bone: 'root', a: 'root', b: 'spine02', r: 0.068, m: 0.142 },
	{ n: 'chest', bone: 'spine02', a: 'spine02', b: 'neck01', r: 0.075, m: 0.355, up: 'pelvis', tone: 1 },
	{ n: 'head', bone: 'neck01', a: 'neck01', b: '>head', r: 0.058, m: 0.081, up: 'chest', tone: 0.7 },
	{ n: 'armL', bone: 'upperarm01.L', a: 'upperarm01.L', b: 'lowerarm01.L', r: 0.026, m: 0.028, up: 'chest', tone: 0.25 },
	{ n: 'armR', bone: 'upperarm01.R', a: 'upperarm01.R', b: 'lowerarm01.R', r: 0.026, m: 0.028, up: 'chest', tone: 0.25 },
	{ n: 'foreL', bone: 'lowerarm01.L', a: 'lowerarm01.L', b: '>wrist.L', r: 0.022, m: 0.022, up: 'armL', hinge: 'elbow' },
	{ n: 'foreR', bone: 'lowerarm01.R', a: 'lowerarm01.R', b: '>wrist.R', r: 0.022, m: 0.022, up: 'armR', hinge: 'elbow' },
	{ n: 'thighL', bone: 'upperleg01.L', a: 'upperleg01.L', b: 'lowerleg01.L', r: 0.042, m: 0.1, up: 'pelvis', tone: 0.5 },
	{ n: 'thighR', bone: 'upperleg01.R', a: 'upperleg01.R', b: 'lowerleg01.R', r: 0.042, m: 0.1, up: 'pelvis', tone: 0.5 },
	{ n: 'shinL', bone: 'lowerleg01.L', a: 'lowerleg01.L', b: 'foot.L', r: 0.032, m: 0.061, up: 'thighL', hinge: 'knee' },
	{ n: 'shinR', bone: 'lowerleg01.R', a: 'lowerleg01.R', b: 'foot.R', r: 0.032, m: 0.061, up: 'thighR', hinge: 'knee' },
];
// (a piece collides with the world, never with the rest of its own body)
const GROUPS = (0x0002 << 16) | 0xfffd, WORLD_GROUPS = (0x0001 << 16) | 0xffff;

// a person's weight from their height and build (dna.weight 0 lean .. 1 heavy)
export function massOf(P) {
	const h = P.height || 1.7, d = P.dna || {};
	const bmi = 19 + (d.weight ?? 0.4) * 11 + (d.muscle ?? 0.4) * 3;
	return Math.max(15, bmi * h * h);
}

export function createRagdolls({ world, isPhone }) {
	// (the pieces are the cost: two people's worth on a phone, a creature a dozen of its own)
	const MAX = isPhone ? 4 : 8, PIECES = isPhone ? 42 : 120;
	let R = null, W3 = null, loading = null;
	const live = [];                                  // { P, parts, joints, t, still, onRest }
	const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
	const UP = new THREE.Vector3(0, 1, 0);

	function ready() {
		if (R) return Promise.resolve(R);
		if (!loading) loading = loadRapier().then((r) => {
			R = r;
			W3 = new R.World({ x: 0, y: -9.81, z: 0 });
			W3.timestep = 1 / 60;
			return R;
		});
		return loading;
	}

	// ---------- the world round the fallen ----------
	const N = 28, CELL = 1;
	let ground = null, gx = 1e9, gz = 1e9;
	// (a car someone is pulled out of is left out for a moment: they start inside it)
	const solids = [], cars = new Map(), ignore = new Map();
	// (the floor a creature fell on, where its own world knows it better: the Deep, the Moon)
	let gridFloor = null;
	function regrid(cx, cz) {
		const Wd = world(), I = Wd.island;
		const floorAt = gridFloor || ((x, z) => Math.max(I.heightAt(x, z), I.extraFloor ? I.extraFloor(x, z, 1e4) : -1e9));
		gx = Math.round(cx / CELL) * CELL; gz = Math.round(cz / CELL) * CELL;
		const H = new Float32Array((N + 1) * (N + 1)), half = N * CELL / 2;
		for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[i + j * (N + 1)] = floorAt(gx - half + j * CELL, gz - half + i * CELL);
		if (ground) W3.removeCollider(ground, false);
		ground = W3.createCollider(R.ColliderDesc.heightfield(N, N, H, { x: N * CELL, y: 1, z: N * CELL }).setTranslation(gx, 0, gz).setFriction(0.9).setRestitution(0).setCollisionGroups(WORLD_GROUPS));
		for (const c of solids) W3.removeCollider(c, false);
		solids.length = 0;
		const boxes = Wd.real?.loaded?.() ? Wd.real.near('boxes', cx, cz, 30) : [];
		for (const b of boxes) {
			if (!(b.w > 1 && b.d > 1)) continue;
			const h = Math.max(3, (b.wallH || 6) + 2), a = b.a || 0, y = I.heightAt(b.x, b.z) - 1;
			solids.push(W3.createCollider(R.ColliderDesc.cuboid(b.w / 2, h / 2, b.d / 2).setTranslation(b.x, y + h / 2, b.z).setRotation({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) }).setFriction(0.5).setRestitution(0).setCollisionGroups(WORLD_GROUPS)));
		}
	}
	// the cars about (the one you drive among them): blocks moved each step
	function syncCars(cx, cz) {
		const Vh = world().vehicles, seen = new Set();
		const list = Vh ? Vh.carsNear(cx, cz, 30) : [];
		const mine = Vh?.mine?.car;
		if (mine && Vh.mine.driving) list.push({ id: 'mine', kind: mine.kind, x: mine.x, y: mine.y, z: mine.z, yaw: mine.yaw });
		for (const c of list) {
			const key = c.id || c.kind + c.x.toFixed(1) + c.z.toFixed(1);
			if (ignore.has(key)) continue;
			seen.add(key);
			const S = specOf(c.kind), h = (S.H - (S.clear ?? 0.3)) / 2;
			const pos = { x: c.x, y: (c.y ?? 0) + (S.clear ?? 0.3) + h, z: c.z }, rot = { x: 0, y: Math.sin(c.yaw / 2), z: 0, w: Math.cos(c.yaw / 2) };
			let rb = cars.get(key);
			if (!rb) {
				rb = W3.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z).setRotation(rot));
				W3.createCollider(R.ColliderDesc.cuboid(S.W / 2 * 0.95, h, S.L / 2 * 0.95).setFriction(0.5).setRestitution(0).setCollisionGroups(WORLD_GROUPS), rb);
				cars.set(key, rb);
			} else { rb.setNextKinematicTranslation(pos); rb.setNextKinematicRotation(rot); }
		}
		for (const [key, rb] of cars) if (!seen.has(key)) { W3.removeRigidBody(rb); cars.delete(key); }
	}

	// ---------- one body going limp ----------
	function build(P) {
		const { bones, map } = P;
		P.root.updateMatrixWorld(true);
		const head = (name) => name[0] === '>' ? tailOf(name.slice(1)) : bones[map[name]].getWorldPosition(new THREE.Vector3());
		function tailOf(name) {
			const i = map[name], b = bones[i], t = P.rest.tails[i];
			if (!t) return b.getWorldPosition(new THREE.Vector3());
			// (the tail in the bone's own frame, from the rest pose)
			return t.clone().sub(P.rest.heads[i]).applyMatrix4(_m.extractRotation(b.matrixWorld)).add(b.getWorldPosition(new THREE.Vector3()));
		}
		const h = P.height || 1.7, mass = massOf(P), build = 0.85 + (P.dna?.weight ?? 0.4) * 0.5;
		// every piece starts in one frame (the body's heading), its capsule turned inside it:
		// the joints' axes and limits then read the same in both pieces they join
		const Qh = P.root.getWorldQuaternion(new THREE.Quaternion());
		const Qhi = Qh.clone().invert();
		const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(Qh);
		const parts = {};
		for (const s of SEG) {
			const a = head(s.a), b = head(s.b), dir = b.clone().sub(a), len = Math.max(0.05, dir.length());
			dir.divideScalar(len);
			const r = s.r * h * (s.n === 'head' ? 1 : build), mid = a.clone().add(b).multiplyScalar(0.5);
			const rb = W3.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(mid.x, mid.y, mid.z).setRotation({ x: Qh.x, y: Qh.y, z: Qh.z, w: Qh.w }).setLinearDamping(0.08).setAngularDamping(1.2).setCcdEnabled(true).setCanSleep(true));
			const cq = Qhi.clone().multiply(_q.setFromUnitVectors(UP, dir));
			W3.createCollider(R.ColliderDesc.capsule(Math.max(0.01, len / 2 - r * 0.6), r).setRotation({ x: cq.x, y: cq.y, z: cq.z, w: cq.w }).setMass(mass * s.m).setFriction(0.85).setRestitution(0).setCollisionGroups(GROUPS), rb);
			const bone = bones[map[s.bone]];
			parts[s.n] = { s, rb, a, b, dir, bone, Bw0: bone.getWorldQuaternion(new THREE.Quaternion()), pos0: mid };
		}
		// the joints, at the near end of each piece
		const joints = [];
		for (const s of SEG) {
			if (!s.up) continue;
			const c = parts[s.n], p = parts[s.up];
			const la = c.a.clone().sub(p.pos0).applyQuaternion(Qhi), lb = c.a.clone().sub(c.pos0).applyQuaternion(Qhi);
			let jd;
			if (s.hinge) {
				// bends only one way: the elbow brings the forearm forward, the knee the shin back
				const bent = p.dir.dot(c.dir) < 0.97;
				const axisW = bent ? new THREE.Vector3().crossVectors(p.dir, c.dir).normalize() : new THREE.Vector3().crossVectors(p.dir, s.hinge === 'elbow' ? fwd : fwd.clone().negate()).normalize();
				const now = Math.acos(THREE.MathUtils.clamp(p.dir.dot(c.dir), -1, 1));
				c.axisW = axisW.clone();
				const ax = axisW.applyQuaternion(Qhi);
				jd = R.JointData.revolute({ x: la.x, y: la.y, z: la.z }, { x: lb.x, y: lb.y, z: lb.z }, { x: ax.x, y: ax.y, z: ax.z });
				const j = W3.createImpulseJoint(jd, p.rb, c.rb, true);
				j.setLimits(-now, (s.hinge === 'elbow' ? 2.5 : 2.3) - now);
				joints.push({ j, tone: 0 });
			} else {
				jd = R.JointData.spherical({ x: la.x, y: la.y, z: la.z }, { x: lb.x, y: lb.y, z: lb.z });
				joints.push({ j: W3.createImpulseJoint(jd, p.rb, c.rb, true), tone: s.tone || 0.3, m: mass * c.s.m, rb: c.rb });
			}
		}
		// (the root's offset from the pelvis piece, in its frame)
		const rootB = bones[map.root], rw = rootB.getWorldPosition(new THREE.Vector3());
		const rootOff = rw.sub(parts.pelvis.pos0).applyQuaternion(Qhi);
		return { parts, joints, Qhi, rootOff, mass, order: SEG.map((s) => s.n), rootName: 'pelvis', n: SEG.length };
	}
	// ---------- a creature going limp: its pieces from its own rig (creatures/rig.js) ----------
	// every piece starts turned as the body's root is, its capsule turned inside it, so a hinge's
	// axis is the model's own (x across the body, z along it) in every piece
	function buildRig(G) {
		G.root.updateMatrixWorld(true);
		const Qh = G.root.getWorldQuaternion(new THREE.Quaternion()), Qhi = Qh.clone().invert();
		const parts = {}, order = [];
		for (const s of G.pieces) {
			const a = s.b.getWorldPosition(new THREE.Vector3());
			const b = s.tail.clone().applyMatrix4(s.b.matrixWorld);
			const dir = b.clone().sub(a), len = Math.max(0.03, dir.length());
			dir.divideScalar(len);
			const mid = a.clone().add(b).multiplyScalar(0.5);
			const rb = W3.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(mid.x, mid.y, mid.z).setRotation({ x: Qh.x, y: Qh.y, z: Qh.z, w: Qh.w }).setLinearDamping(0.12).setAngularDamping(1.6).setCcdEnabled(true).setCanSleep(true));
			const cq = Qhi.clone().multiply(_q.setFromUnitVectors(UP, dir));
			W3.createCollider(R.ColliderDesc.capsule(Math.max(0.01, len / 2 - s.r * 0.5), s.r).setRotation({ x: cq.x, y: cq.y, z: cq.z, w: cq.w }).setMass(G.mass * s.m).setFriction(0.9).setRestitution(0).setCollisionGroups(GROUPS), rb);
			parts[s.n] = { s, rb, a, b, dir, bone: s.b, Bw0: s.b.getWorldQuaternion(new THREE.Quaternion()), pos0: mid, axisW: s.hinge ? (s.hinge === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)).applyQuaternion(Qh) : null };
			order.push(s.n);
		}
		const joints = [];
		for (const s of G.pieces) {
			if (!s.up || !parts[s.up]) continue;
			const c = parts[s.n], p = parts[s.up];
			const la = c.a.clone().sub(p.pos0).applyQuaternion(Qhi), lb = c.a.clone().sub(c.pos0).applyQuaternion(Qhi);
			if (s.hinge) {
				// a knee, an elbow, a wrist: it bends in the body's own plane, so far either way of how it was held
				const ax = s.hinge === 'z' ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
				const j = W3.createImpulseJoint(R.JointData.revolute({ x: la.x, y: la.y, z: la.z }, { x: lb.x, y: lb.y, z: lb.z }, ax), p.rb, c.rb, true);
				j.setLimits(-1.3, 1.3);
				joints.push({ j, tone: 0 });
			} else joints.push({ j: W3.createImpulseJoint(R.JointData.spherical({ x: la.x, y: la.y, z: la.z }, { x: lb.x, y: lb.y, z: lb.z }), p.rb, c.rb, true), tone: s.tone || 0.3, m: G.mass * s.m, rb: c.rb });
		}
		const rootName = order[0];
		const rootB = parts[rootName].bone, rw = rootB.getWorldPosition(new THREE.Vector3());
		const rootOff = rw.sub(parts[rootName].pos0).applyQuaternion(Qhi);
		return { parts, joints, Qhi, rootOff, mass: G.mass, order, rootName, n: order.length, rig: true };
	}
	// the muscle tone: each free joint pulled gently back toward how it was held, fading
	// (where the joints have no motors, the limbs' own turning is damped instead, as stiffly)
	function tone(D, k) {
		for (const J of D.joints) {
			if (!J.tone) continue;
			if (typeof J.j.configureMotorPosition === 'function') {
				const st = J.tone * J.m * 60 * k, dm = J.tone * J.m * 6 * k + 0.05;
				for (const ax of [R.JointAxis.AngX, R.JointAxis.AngY, R.JointAxis.AngZ]) J.j.configureMotorPosition(ax, 0, st, dm);
			} else J.rb.setAngularDamping(1.2 + J.tone * 14 * k);
		}
	}

	// ---------- the bones following the pieces ----------
	function pose(D, P = null) {
		const Qhi = D.Qhi;
		for (const n of D.order) {
			const pc = D.parts[n], r = pc.rb.rotation();
			// its turn since it went limp, laid on the bone as it was then
			_q.set(r.x, r.y, r.z, r.w).multiply(Qhi).multiply(pc.Bw0);
			const parent = pc.bone.parent;
			parent.getWorldQuaternion(_q2);
			pc.bone.quaternion.copy(_q2.invert().multiply(_q));
			if (n === D.rootName) {
				const t = pc.rb.translation();
				_v.copy(D.rootOff).applyQuaternion(_q2.set(r.x, r.y, r.z, r.w)).add(_v2.set(t.x, t.y, t.z));
				// (where the body is now and which way it faces: for the one that gets up again)
				if (P?.rig) { _v2.set(0, 0, 1).applyQuaternion(_q2); P.at = { x: _v.x, y: _v.y, z: _v.z, yaw: Math.atan2(_v2.x, _v2.z) }; }
				parent.worldToLocal(_v);
				pc.bone.position.copy(_v);
			}
			pc.bone.updateMatrixWorld(true);
		}
	}

	// ---------- a blow ----------
	// how: { point: Vector3 where it struck, vel: its velocity (m/s), mass: its weight (kg,
	// Infinity for a wall or a train), lift: how much of it throws upward (a bonnet's edge),
	// ignore: the id of a car to leave out for a moment, limp: 0..1 how far gone they are }
	// limp 0 (knocked down, struck by a car) keeps the muscle tone for a moment, so they go
	// over the way a stunned body does; limp 1 (killed) has none: the knees give, the hips
	// fold and the trunk crumples down on the spot instead of toppling over like a plank
	function hit(P, how, onRest) {
		if (!P || P.ragdoll) return false;
		if (P.rig && !P.pieces?.length) return false;
		// (room made for it: the oldest left lying where they are)
		const want = P.rig ? P.pieces.length : SEG.length;
		while (live.length && (live.length >= MAX || live.reduce((a, L) => a + L.n, 0) + want > PIECES)) finish(live.shift());
		P.ragdoll = true; P.rested = false;
		ready().then(() => start(P, how, onRest)).catch((e) => { lastErr = String(e && e.stack || e).slice(0, 400); P.ragdoll = false; });
		return true;
	}
	function start(P, how, onRest) {
		if (!P.ragdoll) return;
		const c = P.root.getWorldPosition(new THREE.Vector3());
		if (how.floor) gridFloor = how.floor; else if (!live.length) gridFloor = null;
		if (!live.length || Math.hypot(c.x - gx, c.z - gz) > 6 || how.floor) regrid(c.x, c.z);
		if (how.ignore) ignore.set(how.ignore, 1.2);
		const D = P.rig ? buildRig(P) : build(P);
		for (const m of P.meshes || []) m.frustumCulled = false;
		const limp = Math.max(0, Math.min(1, how.limp ?? 0)), tone0 = 1 - 0.92 * limp;
		tone(D, tone0);
		// the momentum passed on: a heavy thing moving fast gives the struck part nearly its
		// own speed, a light one less; the parts near the blow take it, the rest are dragged
		const v = how.vel || new THREE.Vector3(), M = how.mass ?? 1500, share = M === Infinity ? 1 : M / (M + D.mass);
		const pt = how.point || c, lift = how.lift ?? 0;
		const sp = v.length();
		for (const pc of Object.values(D.parts)) {
			const t = pc.rb.translation();
			const dy = t.y - pt.y, w = Math.exp(-(dy * dy) / 0.18);
			const k = share * (0.55 + 0.45 * w);
			pc.rb.setLinvel({ x: v.x * k, y: v.y * k + sp * lift * w, z: v.z * k }, true);
			// (the struck part spins with the blow: a leg swept from under the hips)
			if (w > 0.5 && sp > 2) { const ax = _v.set(v.z, 0, -v.x).normalize().multiplyScalar(sp * 0.9 * w); pc.rb.setAngvel({ x: ax.x, y: 0, z: ax.z }, true); }
		}
		// gone limp: the legs give way under them (each knee folds the way it bends, the thigh
		// swinging out from under the hips), the trunk drops, and a slight lean to one side or
		// the other so no two fall alike
		if (limp > 0 && D.rig) limpRig(D, limp);
		else if (limp > 0) {
			const side = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.8) * limp;
			for (const n of ['shinL', 'shinR']) {
				const shin = D.parts[n], thigh = D.parts[shin.s.up], ax = shin.axisW;
				if (!ax) continue;
				const k = (2.6 + Math.random() * 1.2) * limp;
				_v.copy(ax).multiplyScalar(k); shin.rb.setAngvel({ x: _v.x, y: _v.y, z: _v.z }, true);
				_v.copy(ax).multiplyScalar(-k * 0.45); thigh.rb.setAngvel({ x: _v.x, y: _v.y, z: _v.z }, true);
			}
			for (const n of ['pelvis', 'chest', 'head']) { const t = D.parts[n].rb.linvel(); D.parts[n].rb.setLinvel({ x: t.x, y: t.y - 1.4 * limp, z: t.z }, true); }
			const fwd = _v2.set(0, 0, 1).applyQuaternion(_q.copy(D.Qhi).invert());
			D.parts.chest.rb.setAngvel({ x: fwd.x * side, y: 0, z: fwd.z * side }, true);
		}
		live.push({ P, D, t: 0, still: 0, onRest, tone0, n: D.n });
	}
	// a creature's legs going from under it: each hinged piece (a shin, a forearm, a foot) folds
	// about its hinge, the piece above swinging the other way, the trunk dropping, and the body
	// rolling a little to one side, so no two fall alike
	function limpRig(D, limp) {
		const side = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.9) * limp;
		for (const n of D.order) {
			const pc = D.parts[n];
			if (pc.axisW) {
				const k = (2.4 + Math.random() * 1.6) * limp * (Math.random() < 0.5 ? -1 : 1);
				_v.copy(pc.axisW).multiplyScalar(k); pc.rb.setAngvel({ x: _v.x, y: _v.y, z: _v.z }, true);
				const up = pc.s.up && D.parts[pc.s.up];
				if (up) { _v.copy(pc.axisW).multiplyScalar(-k * 0.4); up.rb.setAngvel({ x: _v.x, y: _v.y, z: _v.z }, true); }
			} else if (pc.s.tone >= 0.7) { const t = pc.rb.linvel(); pc.rb.setLinvel({ x: t.x, y: t.y - 1.6 * limp, z: t.z }, true); }
		}
		const root = D.parts[D.rootName], fwd = _v2.set(0, 0, 1).applyQuaternion(_q.copy(D.Qhi).invert());
		root.rb.setAngvel({ x: fwd.x * side, y: 0, z: fwd.z * side }, true);
	}
	function finish(L) {
		for (const J of L.D.joints) W3.removeImpulseJoint(J.j, false);
		for (const pc of Object.values(L.D.parts)) W3.removeRigidBody(pc.rb);
		L.done = true;
		L.P.rested = true;
	}
	// back on their feet (or taken away): the bones handed back to the walk (a creature's to its
	// own motion, which lays its pose over them again: creatures/motion.js)
	function release(P) {
		const i = live.findIndex((L) => L.P === P);
		if (i >= 0) { finish(live[i]); live.splice(i, 1); }
		P.ragdoll = false; P.rested = false;
		if (P.rig) return;
		for (const b of P.bones) b.quaternion.identity();
		P.bones[P.map.root].position.copy(P.rest.heads[P.map.root]);
	}
	// a blow to one already limp (a round into a fallen beast): the piece nearest it takes the
	// momentum, by weight
	function nudge(P, point, vel, mass = 30) {
		const L = live.find((q) => q.P === P);
		if (!L || !point || !vel) return false;
		let best = null, bd = 1e9;
		for (const n of L.D.order) { const t = L.D.parts[n].rb.translation(); const d = Math.hypot(t.x - point.x, t.y - point.y, t.z - point.z); if (d < bd) { bd = d; best = L.D.parts[n]; } }
		if (!best) return false;
		const share = mass / (mass + L.D.mass), m = best.rb.mass();
		best.rb.applyImpulse({ x: vel.x * share * m * 1.5, y: vel.y * share * m * 1.5, z: vel.z * share * m * 1.5 }, true);
		L.still = 0;
		return true;
	}
	// killed while down: what tone it had goes out of it
	function slacken(P) {
		const L = live.find((q) => q.P === P);
		if (!L) return;
		L.tone0 = 0.08; L.t = Math.max(L.t, 1.6); tone(L.D, 0.08);
		for (const n of L.D.order) { const pc = L.D.parts[n]; if (pc.s.tone >= 0.7 || pc.s.m > 0.15) { const t = pc.rb.linvel(); pc.rb.setLinvel({ x: t.x, y: t.y - 1.2, z: t.z }, true); } }
		L.still = 0;
	}

	let acc = 0, lastErr = null;
	function update(dt) {
		if (down.length) tidy();
		if (!live.length || !W3) return;
		let cx = 0, cz = 0;
		for (const L of live) { const t = L.D.parts[L.D.rootName].rb.translation(); cx += t.x / live.length; cz += t.z / live.length; }
		for (const [k, v] of ignore) if (v - dt <= 0) ignore.delete(k); else ignore.set(k, v - dt);
		if (Math.hypot(cx - gx, cz - gz) > 8) regrid(cx, cz);
		syncCars(cx, cz);
		acc += Math.min(dt, 0.1);
		let n = 0;
		while (acc >= W3.timestep && n < 3) { acc -= W3.timestep; n++; W3.step(); }
		if (n === 3) acc = 0;
		for (let i = live.length - 1; i >= 0; i--) {
			const L = live[i];
			L.t += dt;
			// (the tone goes out of them over the first second and a half)
			if (L.t < 1.6) tone(L.D, Math.max(0.08, (L.tone0 ?? 1) * (1 - L.t / 1.6)));
			pose(L.D, L.P);
			let fast = 0;
			for (const pc of Object.values(L.D.parts)) { const v = pc.rb.linvel(); fast = Math.max(fast, Math.hypot(v.x, v.y, v.z)); }
			L.still = fast < 0.12 ? L.still + dt : 0;
			// at rest (or long enough): left lying as they fell
			if (L.still > 1.2 || L.t > 12) { finish(L); live.splice(i, 1); if (!L.P.rig) down.push(L.P); L.onRest?.(L.P); }
		}
	}
	// the fallen, left where they lie until you are well away: then theirs to walk again
	const down = [];
	function tidy() {
		const me = world()?.player?.state?.pos;
		if (!me) return;
		for (let i = down.length - 1; i >= 0; i--) {
			const P = down[i], at = P.root.getWorldPosition(_v);
			if (!P.ragdoll) { down.splice(i, 1); continue; }
			if (Math.hypot(at.x - me.x, at.z - me.z) > 70) { down.splice(i, 1); release(P); }
		}
	}
	const info = () => {
		const L = live[0], t = L?.D.parts[L.D.rootName].rb.translation(), h = L?.D.parts.head?.rb.translation(), q = L?.D.parts.thighL?.bone.quaternion;
		return { ready: !!R, live: live.length, pieces: live.reduce((a, q2) => a + q2.n, 0), max: MAX, err: lastErr, rigs: live.filter((q2) => q2.P.rig).length, pelvis: t && [t.x, t.y, t.z].map((v) => +v.toFixed(2)), head: h && [h.x, h.y, h.z].map((v) => +v.toFixed(2)), thigh: q && [q.x, q.y, q.z, q.w].map((v) => +v.toFixed(2)) };
	};
	return { hit, update, release, ready, info, massOf, nudge, slacken };
}
