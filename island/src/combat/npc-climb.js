// Fighters over what is in their way, the way you go over it (parkour.js): a fence, a low wall or
// a rail they hop with a hand planted on the top and the legs swung over to the side; a ledge
// they can reach they put both hands on and mantle up onto. The same feel for what is ahead and
// the same path as yours, with the whole body drawn along it (people/actions.js 'vault-hop',
// 'vault-mantle') and the hand set where it lands on the top (crysis/held-items.js applyClutch).
//
// createClimber({ floorAt, pushOut }) -> look(x, z, feet, dx, dz, speed) a climb to begin, or
// null; step(C, dt) where the body is now ({ x, z, feet, done }). climbBody(M, C, at, armed) lays
// that on a body's motion each frame before M.update (its ground must read at.feet meanwhile).

import { feelFor, climbFor, climbPath, pathAt } from '../parkour.js';

const EYE = 1.68;
// the poses over each climb's time, and how long a hand is on the top (of the climb's time)
const POSE = { hop: 'vault-hop', mantle: 'vault-mantle' };

export function createClimber({ floorAt, pushOut }) {
	const F = feelFor({ floorAt, pushOut });
	// a body at x, z, feet at feet, going (dx, dz) at speed: what is ahead, close enough to go over now
	function look(x, z, feet, dx, dz, speed) {
		const A = F.scan(x, z, feet, dx, dz, 0.55 + Math.min(speed, 6) * 0.12, 1.8);
		if (!A || A.kind === 'wall') return null;
		const kind = climbFor(A, feet, 'key');
		if (!POSE[kind]) return null;
		const C = climbPath(kind, A, { x, z, eye: feet + EYE }, dx, dz, speed);
		// (the hand: on the top, just past its near side, a little to the left of the line)
		const hx = C.ox + dx * 0.05 + dz * 0.18, hz = C.oz + dz * 0.05 - dx * 0.18;
		return { ...C, t: 0, feet0: feet, pose: POSE[kind], hand: { x: hx, y: A.top, z: hz }, both: kind === 'mantle' };
	}
	// on along it by dt: where the body is ({ feet: the floor under it now })
	function step(C, dt) {
		C.t = Math.min(1, C.t + dt / C.dur);
		const Q = pathAt(C, C.t);
		// (no lower than the ground it set off from or lands on: a landing's dip is the pose's own)
		const feet = C.t >= 1 ? C.land : Math.max(Q.eye - EYE, Math.min(C.feet0, C.land) - 0.02);
		return { x: Q.x, z: Q.z, feet, done: C.t >= 1 };
	}
	return { look, step, scan: F.scan };
}

// a climb's moment on a body (people/motion.js), each frame before its update: where it is, its
// hips on the climb's floor at once (no spring lag), the pose at the climb's progress, the left
// hand on the top while the climb has it there. Done: let go, carrying on at the climb's pace.
export function climbBody(M, C, at, armed) {
	const S = M.S, heading = Math.atan2(C.dx, C.dz);
	if (!C.begun) {
		C.begun = true;
		// (on a little before the path's own grip and off a little after, so it reads)
		S.clutch = { side: 'L', at: C.hand, t: -Math.max(0, C.grip[0] - 0.08) * C.dur, dur: (C.grip[1] - C.grip[0] + 0.18) * C.dur };
	}
	S.pos.x = at.x; S.pos.z = at.z;
	S.hipY.v = at.feet; S.hipY.dv = 0;
	S.yaw.v += Math.atan2(Math.sin(heading - S.yaw.v), Math.cos(heading - S.yaw.v)) * 0.5; S.yaw.dv = 0;
	M.want.heading = heading;
	if (at.done) {
		M.act(null);
		S.speed.v = C.exit; M.want.speed = C.exit;
		if (S.clutch?.at) S.clutch = null;
		return false;
	}
	S.speed.v = 0; S.speed.dv = 0; M.want.speed = 0; M.want.travelT = 0;
	M.act(C.pose + (armed ? '+' : ''), C.t);
	return true;
}
