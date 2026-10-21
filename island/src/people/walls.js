// Keeping people out of walls. Everyone who walks, runs or is chased about (the townsfolk, a
// crowd running from a fight, the fighters and the beasts, your guild at your back, an owner
// walking out to their car) is kept out of the world's solid things by the same pushes that keep
// you out: player.js pushOut (the houses' and shops' walls and closed doors, the city's blocks,
// fences, parked cars, rocks, a cave's walls). A step is swept from where the body stood to where
// it would be in short pieces, so a runner on a slow frame (a phone at 15 fps carries a sprinter
// 0.4 m a frame) can never cross a thin wall in one go: no piece is long enough to reach past a
// wall's middle, where the push would put it out on the far side. Nothing here is per-frame work
// against the whole world: each push looks only at what its own grids hold near the body.
import * as THREE from 'three';

export const EYE = 1.68;
// (a wall 0.1 m thick pushes 0.3 m either side of it: 0.7 m in all, so a piece must stay well
// under half of that)
export const PIECE = 0.2;
// a move longer than this is a body set down somewhere (a catch-up, a respawn), not a step
export const LEAP = 4;
// (enough pieces for the longest step: none of them longer than PIECE)
const MAX_PIECES = Math.ceil(LEAP / PIECE);

const _q = new THREE.Vector3();
// one push, and again while it still moves (at most 3 in all): where two blocks meet, the
// second one's push can leave the point inside the first one's clearance
function pushHard(push, q) {
	for (let k = 0; k < 3; k++) {
		const x = q.x, z = q.z;
		push(q);
		if (Math.abs(q.x - x) + Math.abs(q.z - z) < 1e-4) break;
	}
}
// sweep (pos: where the body would be, moved in place; from: where it stood; footY: its feet;
// push(p): moves an eye-height point p off walls). Returns how far the walls held it back.
export function sweepOut(push, from, pos, footY, { piece = PIECE, leap = LEAP, most = MAX_PIECES } = {}) {
	if (!push || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return 0;
	const tx = pos.x, tz = pos.z, y = Number.isFinite(footY) ? footY + EYE : (pos.y || 0) + EYE;
	const ok = from && Number.isFinite(from.x) && Number.isFinite(from.z);
	const dx = ok ? tx - from.x : 0, dz = ok ? tz - from.z : 0, L = Math.hypot(dx, dz);
	let x = tx, z = tz;
	if (!ok || L > leap || L < piece) {
		// one push where it is (standing, a short step, or set down)
		_q.set(tx, y, tz); pushHard(push, _q);
		x = _q.x; z = _q.z;
	} else {
		const n = Math.min(most, Math.ceil(L / piece)), sx = dx / n, sz = dz / n;
		x = from.x; z = from.z;
		for (let i = 0; i < n; i++) {
			_q.set(x + sx, y, z + sz); pushHard(push, _q);
			x = _q.x; z = _q.z;
		}
	}
	if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
	pos.x = x; pos.z = z;
	return Math.hypot(x - tx, z - tz);
}

// the world's push for a body: the player's own (every solid thing you are kept off), or the
// world's extra pushes where there is no player yet
export function worldPush(W) {
	const P = W?.player;
	if (P?.pushOut) return P.pushOut;
	const I = W?.island;
	if (!I?.extraPush) return null;
	return (p) => { const fy = p.y - EYE; if (I.underFloor?.(p.x, p.z, fy) != null) I.underPush?.(p, fy); else I.extraPush(p, fy); };
}

// a body kept out of walls: keep(pos, from, footY) for a motion's constrain (people/motion.js)
export function wallKeeper(world) {
	const W = () => (typeof world === 'function' ? world() : world);
	return (pos, from, footY = pos.y) => sweepOut(worldPush(W()), from, pos, footY);
}

// where a body set down near a point can stand: from a spot known to be clear (you, a door) out
// toward the one wanted, as far as the walls allow
export function clearSpot(push, clear, want, footY) {
	const p = { x: want.x, z: want.z };
	sweepOut(push, clear, p, footY, { leap: Infinity, most: 400 });
	return p;
}
