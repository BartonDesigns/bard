// How the jet and the helicopter fly: pure steps on a little state, so the game and the tests
// fly the same aircraft. Arcade, but with the feel of the real thing: the jet goes where its
// nose points once it has the speed, banks to turn, sinks when slow; the gear and the flaps
// come down on their own low and slow (and go up when it is clean and climbing); a landing
// has to be gentle, wings level, wheels down. The helicopter hovers by itself, leans into
// where it goes, and slows its descent near the ground so a held descend sets it down.
//
//   const S = jetState(x, y, z, yaw); jetStep(S, input, dt, groundAt) -> event or null
//   input: { thr (-1..1, the throttle lever's travel), ab, pitch, roll, yaw (-1..1), brake }
//   events: 'takeoff', 'smooth', 'firm', 'crash'
// The control surfaces (S.surf: pitch, roll, yaw, flap) and the gear (S.gearT, 1 down) move
// at their own pace for the model to show.

import * as THREE from 'three';
import { clamp } from '../noise.js';

export const G = 9.81;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const tF = new THREE.Vector3(), tL = new THREE.Vector3(), tQ = new THREE.Quaternion();
const toward = (v, t, r) => v + clamp(t - v, -r, r);

// the jet's numbers: mass, thrust, the speed it flies at, how it rolls and pitches
export const JET = Object.freeze({ mass: 13000, thrust: 125000, ab: 1.6, drag: 2.2, vFly: 90, vStall: 58, vRotate: 70, pitchRate: 1.1, rollRate: 2.6, yawRate: 0.35, gearUp: 40, gearDown: 140, slowGear: 130 });

export function jetState(x, y, z, yaw) {
	return { pos: new THREE.Vector3(x, y, z), q: new THREE.Quaternion().setFromAxisAngle(Y, yaw), vel: new THREE.Vector3(), spd: 0, throttle: 0, ab: false, ground: true, gear: true, gearT: 1, alt: 0, sink: 0, surf: { pitch: 0, roll: 0, yaw: 0, flap: 1 }, yaw };
}

export function jetStep(S, I, dt, groundAt) {
	const J = JET;
	S.throttle = clamp(S.throttle + (I.thr || 0) * dt * 0.6, 0, 1);
	S.ab = !!I.ab && S.throttle > 0.9;
	const pitchIn = clamp(I.pitch || 0, -1, 1), rollIn = clamp(I.roll || 0, -1, 1), yawIn = clamp(I.yaw || 0, -1, 1), brake = I.brake ? 1 : 0;
	const fwd = tF.copy(Z).applyQuaternion(S.q), left = tL.copy(X).applyQuaternion(S.q);
	const g0 = groundAt(S.pos.x, S.pos.z, S.pos.y + 2);
	S.alt = S.pos.y - g0;
	// thrust against drag (the flaps and the gear add a little), rolling friction and the brakes on the ground
	const flapDrag = 1 + S.surf.flap * 0.25 + S.gearT * 0.2;
	const thrust = S.throttle * J.thrust * (S.ab ? J.ab : 1);
	const drag = J.drag * flapDrag * S.spd * S.spd * (1 + brake * 1.5) + (S.ground ? (0.015 + brake * 0.5) * J.mass * G : 0);
	S.spd = Math.max(0, S.spd + (thrust - drag - J.mass * G * fwd.y) / J.mass * dt);
	// flaps lower the speed it flies at a little
	const vFly = J.vFly - S.surf.flap * 8, vStall = J.vStall - S.surf.flap * 6;
	const lift = clamp((S.spd - vStall) / (vFly - vStall), 0, 1), auth = clamp(S.spd / J.vFly, 0.12, 1);
	let ev = null;
	if (S.ground) {
		// on the wheels: steer with the nose wheel, rotate past rotation speed
		const steer = (rollIn + yawIn) * clamp(S.spd / 8, 0, 1) * 0.45 * (1 - lift * 0.7);
		S.q.premultiply(tQ.setFromAxisAngle(Y, -steer * dt));
		const pitch = Math.asin(clamp(fwd.y, -1, 1)), wantPitch = pitchIn > 0 && S.spd > J.vRotate ? 0.16 : 0;
		S.q.multiply(tQ.setFromAxisAngle(X, -(wantPitch - pitch) * Math.min(1, dt * 2)));
		// (the wings level on the wheels)
		const bank = Math.asin(clamp(left.y, -1, 1));
		S.q.multiply(tQ.setFromAxisAngle(Z, -bank * Math.min(1, dt * 4)));
		fwd.copy(Z).applyQuaternion(S.q);
		S.vel.set(fwd.x, 0, fwd.z).normalize().multiplyScalar(S.spd);
		S.pos.addScaledVector(S.vel, dt); S.pos.y = groundAt(S.pos.x, S.pos.z, S.pos.y + 2);
		S.sink = 0;
		if (lift >= 1 && fwd.y > 0.1) { S.ground = false; S.pos.y += 0.3; ev = 'takeoff'; }
	} else {
		S.q.multiply(tQ.setFromAxisAngle(X, -pitchIn * J.pitchRate * auth * dt));
		S.q.multiply(tQ.setFromAxisAngle(Z, rollIn * J.rollRate * auth * dt));
		S.q.multiply(tQ.setFromAxisAngle(Y, -yawIn * J.yawRate * auth * dt));
		// banked, it turns
		const bank = Math.asin(clamp(left.y, -0.99, 0.99));
		S.q.premultiply(tQ.setFromAxisAngle(Y, -G * Math.tan(clamp(bank, -1.3, 1.3)) / Math.max(45, S.spd) * lift * dt));
		// too slow: the nose drops and it sinks
		if (lift < 1) S.q.multiply(tQ.setFromAxisAngle(X, (1 - lift) * 0.5 * dt));
		fwd.copy(Z).applyQuaternion(S.q);
		// (the sink builds and dies away rather than jumping)
		S.sink = toward(S.sink, (1 - lift) * 22, 30 * dt);
		S.vel.copy(fwd).multiplyScalar(S.spd); S.vel.y -= S.sink;
		S.pos.addScaledVector(S.vel, dt);
		// gear: down low and slow, up when clean and climbing
		S.gear = S.alt < J.gearDown && S.spd < J.slowGear ? true : S.alt > J.gearUp ? false : S.gear;
		const g1 = groundAt(S.pos.x, S.pos.z, S.pos.y + 2);
		if (S.pos.y <= g1 + 0.2) {
			// touchdown: gently, wheels down, wings level, or it is a crash
			const sink = -S.vel.y, bankNow = Math.abs(Math.asin(clamp(left.copy(X).applyQuaternion(S.q).y, -1, 1)));
			S.touch = { sink: +sink.toFixed(2), bank: +bankNow.toFixed(3), gear: S.gearT, pitch: +fwd.y.toFixed(3), spd: +S.spd.toFixed(1) };
			if (sink > 8 || bankNow > 0.4 || S.gearT < 0.9 || fwd.y < -0.2) { S.pos.y = g1; return 'crash'; }
			S.ground = true; S.pos.y = g1; S.sink = 0;
			ev = sink < 3 ? 'smooth' : 'firm';
		}
	}
	S.q.normalize();
	// the gear travels in about four seconds; the flaps follow speed, the surfaces the stick
	S.gearT = toward(S.gearT, S.gear ? 1 : 0, dt / 4);
	S.surf.flap = toward(S.surf.flap, S.spd < 115 && (S.ground || S.gear) ? 1 : 0, dt / 3);
	S.surf.pitch = toward(S.surf.pitch, pitchIn, dt * 4);
	S.surf.roll = toward(S.surf.roll, rollIn, dt * 5);
	S.surf.yaw = toward(S.surf.yaw, yawIn + (S.ground ? rollIn * 0.5 : 0), dt * 4);
	S.yaw = Math.atan2(fwd.x, fwd.z);
	return ev;
}

// ---------- the helicopter ----------
export function heliState(x, y, z, yaw) {
	return { pos: new THREE.Vector3(x, y, z), q: new THREE.Quaternion().setFromAxisAngle(Y, yaw), vel: new THREE.Vector3(), yaw, spin: 0, ground: true, alt: 0, spd: 0 };
}
// input: { coll (-1..1 climb), fwd (-1..1), side (-1..1 left), turn (-1..1 left), fast }
// events: 'lift', 'down', 'crash'
export function heliStep(S, I, dt, groundAt) {
	S.spin = Math.min(1, S.spin + dt / 4);
	const coll = clamp(I.coll || 0, -1, 1), fwdIn = clamp(I.fwd || 0, -1, 1), side = clamp(I.side || 0, -1, 1), yawIn = clamp(I.turn || 0, -1, 1);
	const g0 = groundAt(S.pos.x, S.pos.z, S.pos.y + 2);
	S.alt = S.pos.y - g0;
	const fast = I.fast ? 1.6 : 1;
	let ev = null;
	if (!S.ground || coll > 0) {
		S.yaw += yawIn * 1.1 * dt;
		const c = Math.cos(S.yaw), s = Math.sin(S.yaw);
		const ax = (fwdIn * s + side * c) * 14 * fast, az = (fwdIn * c - side * s) * 14 * fast;
		S.vel.x += (ax - S.vel.x * 0.35) * dt; S.vel.z += (az - S.vel.z * 0.35) * dt;
		// a held descend slows near the ground (it flares onto the skids); spun down it sinks
		const down = coll < 0 ? -Math.max(1.4, Math.min(9, S.alt * 0.7)) * -coll : coll * 9;
		const wantVy = S.spin < 0.85 ? -2 : down;
		S.vel.y += (wantVy - S.vel.y) * Math.min(1, dt * 1.8);
		if (S.ground) S.vel.y = Math.max(0, S.vel.y);
		if (S.spin >= 0.85 && coll > 0 && S.ground) { S.ground = false; S.vel.y = Math.max(S.vel.y, 1); S.pos.y += 0.06; ev = 'lift'; }
	}
	S.pos.addScaledVector(S.vel, dt);
	const g1 = groundAt(S.pos.x, S.pos.z, S.pos.y + 2);
	if (S.pos.y <= g1 + 0.05) {
		if (!S.ground) {
			S.touch = { sink: +(-S.vel.y).toFixed(2), spd: +Math.hypot(S.vel.x, S.vel.z).toFixed(2) };
			if (S.vel.y < -7) return 'crash';
			ev = 'down';
		}
		S.pos.y = g1; S.ground = true; S.vel.multiplyScalar(0.8); S.vel.y = 0;
	}
	// it leans into where it is going
	const c = Math.cos(S.yaw), s = Math.sin(S.yaw), fv = S.vel.x * s + S.vel.z * c, sv = S.vel.x * c - S.vel.z * s;
	S.q.setFromEuler(new THREE.Euler(S.ground ? 0 : clamp(fv * 0.012, -0.35, 0.35), S.yaw, S.ground ? 0 : clamp(-sv * 0.015, -0.4, 0.4), 'YXZ'));
	S.spd = Math.hypot(S.vel.x, S.vel.z);
	S.alt = S.pos.y - g1;
	return ev;
}

// ---------- a helicopter on the scene: how it flies the fight ----------
// Not a hover on a string: a pilot's manoeuvres, picked one after another. It orbits the scene,
// then every so often does something: flanks (a fast, low dash across to the far side, and the
// orbit runs the other way from there), makes an attack run (a dive straight at the target,
// guns going, then a hard break away and climb out), or holds a hover with its nose on the
// target. The police helicopter keeps it tight and never runs in. The state is pure, stepped
// with a goal point and a speed, and the body leans the way a helicopter does: nose down to go,
// nose up to stop, rolled into every turn.
//   const A = heliAirState(x, y, z, yaw); heliTacticStep(A, at, dt, groundAt, opts) -> A.mode
//   at: { x, z } the scene (or what it fights); opts: { tight (the police), i (its place in the
//   flight), rnd, depart: { x, z } (going home: straight off toward it) }
// A.pos, A.yaw, A.pitch (nose down positive), A.roll are for the model; A.log the modes flown.
export const HELI_AIR = Object.freeze({ orbitV: 21, flankV: 34, runV: 31, hoverV: 6, departV: 50, floor: 24, climb: 14, turn: 1.3 });
export function heliAirState(x, y, z, yaw) {
	return { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), yaw, pitch: 0, roll: 0, mode: 'orbit', modeT: 0, dir: 1, ang: 0, goal: new THREE.Vector3(x, y, z), goalAlt: 60, want: 0, log: [], nextIn: 0 };
}
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function heliTacticStep(A, at, dt, groundAt, { tight = false, i = 0, rnd = Math.random, depart = null } = {}) {
	const R = tight ? 65 : 90 + i * 30, ALT = tight ? 55 : 70 + i * 12, V = HELI_AIR;
	const dx = A.pos.x - at.x, dz = A.pos.z - at.z, d = Math.hypot(dx, dz) || 1;
	A.ang = Math.atan2(dz, dx);
	A.modeT += dt;
	let speed = V.orbitV, noseAt = null;
	const enter = (m) => { A.mode = m; A.modeT = 0; A.fix = null; A.log.push(m); };
	if (depart) {
		if (A.mode !== 'depart') enter('depart');
		A.goal.set(depart.x, 0, depart.z); A.goalAlt = Math.min(90, 30 + A.modeT * 3); speed = V.departV;
	} else if (A.mode === 'depart') enter('orbit');
	if (A.mode === 'orbit') {
		// round the scene: the goal a little way ahead on the circle
		const a = A.ang + A.dir * 0.42;
		A.goal.set(at.x + Math.cos(a) * R, 0, at.z + Math.sin(a) * R); A.goalAlt = ALT;
		if (tight) noseAt = at;
		if (A.nextIn <= 0) A.nextIn = 7 + rnd() * 9;
		A.nextIn -= dt;
		if (A.nextIn <= 0 && A.modeT > 4) {
			const r = rnd();
			if (tight) enter(r < 0.6 ? 'flank' : 'hover');
			else enter(r < 0.45 ? 'flank' : r < 0.78 ? 'run' : 'hover');
		}
	} else if (A.mode === 'flank') {
		// across to the far side, passing wide of the scene, low and fast; the orbit then runs the
		// other way (the point it makes for is fixed as it sets out: the scene slides by under it)
		if (!A.fix) { const a = A.ang + Math.PI + A.dir * 0.9; A.fix = { x: at.x + Math.cos(a) * R * 1.05, z: at.z + Math.sin(a) * R * 1.05 }; }
		A.goal.set(A.fix.x, 0, A.fix.z); A.goalAlt = ALT - (tight ? 8 : 16); speed = V.flankV;
		if (Math.hypot(A.goal.x - A.pos.x, A.goal.z - A.pos.z) < 28 || A.modeT > 16) { A.dir = -A.dir; enter('orbit'); }
	} else if (A.mode === 'run') {
		// the dive: straight at the target, down to the deck
		A.goal.set(at.x, 0, at.z); A.goalAlt = 32; speed = V.runV; noseAt = at;
		if (d < 42 || A.modeT > 14) enter('break');
	} else if (A.mode === 'break') {
		// through and away: a hard turn out to the side and the climb back to height
		if (!A.fix) { const a = A.ang + A.dir * 1.25; A.fix = { x: at.x + Math.cos(a) * R * 1.3, z: at.z + Math.sin(a) * R * 1.3 }; }
		A.goal.set(A.fix.x, 0, A.fix.z); A.goalAlt = ALT + 12; speed = V.flankV;
		if (Math.hypot(A.goal.x - A.pos.x, A.goal.z - A.pos.z) < 30 || A.modeT > 12) enter('orbit');
	} else if (A.mode === 'hover') {
		// held where it is, nose on the target, a slow drift sideways
		const a = A.ang + A.dir * 0.08;
		A.goal.set(at.x + Math.cos(a) * d, 0, at.z + Math.sin(a) * d); A.goalAlt = tight ? ALT - 6 : ALT; speed = V.hoverV; noseAt = at;
		if (A.modeT > (tight ? 7 : 5) + rnd() * 2) { A.hold = null; enter('orbit'); }
	}
	// the flight: the velocity eased toward the goal at the mode's speed, the height held off the ground
	const gx = A.goal.x - A.pos.x, gz = A.goal.z - A.pos.z, gl = Math.hypot(gx, gz) || 1;
	const k = Math.min(1, dt * (A.mode === 'hover' ? 1.6 : 0.85)), near = Math.min(1, gl / 30);
	const wx = gx / gl * speed * near, wz = gz / gl * speed * near;
	const ax = (wx - A.vel.x) * k, az = (wz - A.vel.z) * k;
	A.vel.x += ax; A.vel.z += az;
	const g = groundAt(A.pos.x, A.pos.z, A.pos.y + 2);
	const floorY = g + V.floor, wantY = Math.max(floorY, g + A.goalAlt);
	A.vel.y += (clamp((wantY - A.pos.y) * 0.9, -V.climb, V.climb) - A.vel.y) * Math.min(1, dt * 1.4);
	A.pos.addScaledVector(A.vel, dt);
	if (A.pos.y < floorY) { A.pos.y = floorY; A.vel.y = Math.max(0, A.vel.y); }
	// the body: the nose along the way (or on the target), down into speed, rolled into the turn
	const spd = Math.hypot(A.vel.x, A.vel.z);
	const headTo = noseAt ? Math.atan2(noseAt.x - A.pos.x, noseAt.z - A.pos.z) : spd > 2 ? Math.atan2(A.vel.x, A.vel.z) : A.yaw;
	const turn = clamp(wrapA(headTo - A.yaw) * 2.2, -V.turn, V.turn);
	A.yaw = wrapA(A.yaw + turn * dt);
	const fwdA = (ax * Math.sin(A.yaw) + az * Math.cos(A.yaw)) / Math.max(dt, 1e-3);
	const pitchT = clamp(0.012 * (A.vel.x * Math.sin(A.yaw) + A.vel.z * Math.cos(A.yaw)) + 0.02 * fwdA, -0.3, 0.42);
	const rollT = clamp(-turn * 0.42 - (A.vel.x * Math.cos(A.yaw) - A.vel.z * Math.sin(A.yaw)) * 0.012, -0.55, 0.55);
	A.pitch += (pitchT - A.pitch) * Math.min(1, dt * 2.5);
	A.roll += (rollT - A.roll) * Math.min(1, dt * 2.2);
	return A.mode;
}
