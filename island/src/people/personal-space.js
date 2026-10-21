// Personal space: you never walk into someone. Every body the motion rig moves (people/motion.js:
// the street, families at home, the beach groups, workers, fighters, other players) notes itself
// here as it steps, and you are held off them as a person would hold off. In front of someone's
// face you slow and stop at about arm's length, as you would to talk to them; at their side or
// back you can pass at a shoulder's width, so a crowd never feels like a wall. The step is held
// only along the line to them: whatever runs across it is kept, so walking at someone at a slant
// slides you round them. Keep pressing into someone standing in your way and they shuffle aside
// (seated people, and other players, stay put). Nothing here is per-frame work against the whole
// world: one pass over the bodies that stepped this past moment, most of them dismissed by a box.
import { sweepOut } from './walls.js';

// (the middle of you to the middle of them: a shoulder's width at their side, about arm's length
// in front of their face, and never closer than bodies touching)
export const SIDE = 0.55, FRONT = 0.82, TOUCH = 0.42;
// (how far out from the stop the step begins to ease, and how near anyone is looked at)
export const EASE = 0.4, REACH = 1.4;
// (pressing into someone this long and they step aside, at this pace)
export const SHUFFLE_AFTER = 0.45, SHUFFLE = 0.9;
// (a body that has not stepped for this long is gone: pooled, unloaded, or left behind)
const STALE = 600;

const live = [], _from = { x: 0, z: 0 }, _to = { x: 0, y: 0, z: 0 };

// a body stepped (motion.js update): it counts as someone to keep clear of for a moment.
// how: true (solid, and shuffles aside when pressed), 'fixed' (solid, never moved from here)
export function noteBody(P, S, how = true, now = performance.now()) {
	P.spaceAt = now; P.spaceS = S; P.spaceHow = how;
	if (!P.spaceListed) { P.spaceListed = true; live.push(P); }
}
export function bodiesNoted() { return live.length; }

// shown and standing: not limp on the ground, not faded out, not hidden with whatever holds them
function shown(P) {
	if (P.ragdoll || P.down || (P.fadeK !== undefined && P.fadeK < 0.5)) return false;
	for (let o = P.root; o; o = o.parent) if (!o.visible) return false;
	return true;
}

// keep you (pos, at eye height or feet, moved in place) clear of everyone, given where you stood
// before this step (from), your velocity (vel: the part into anyone is taken away), your feet's
// height, and whether you are pushing on (pressing: a hand on the stick or the keys). push(p) is
// the world's push off walls (player.js pushOut), for anyone shuffling aside. Returns how many
// held you back.
export function keepSpace(from, pos, vel, footY, dt, pressing = false, push = null, now = performance.now()) {
	let held = 0;
	for (let i = 0; i < live.length; i++) {
		const P = live[i];
		if (now - P.spaceAt > STALE || !P.root) { P.spaceListed = false; live[i] = live[live.length - 1]; live.pop(); i--; continue; }
		const e = P.root.matrixWorld.elements, bx = e[12], by = e[13], bz = e[14];
		const dx = pos.x - bx, dz = pos.z - bz;
		if (dx > REACH || dx < -REACH || dz > REACH || dz < -REACH || Math.abs(by - footY) > 1.3) { P.spacePress = 0; continue; }
		// (someone in your hands, a grapple or a takedown: combat/melee.js)
		if (!shown(P) || now - (P.spaceHeld || -1e9) < 250) continue;
		const dB = Math.hypot(dx, dz), dA = Math.hypot(from.x - bx, from.z - bz);
		// which way they face (the body's own +z), and how much you are in front of them
		const fl = Math.hypot(e[8], e[10]) || 1, fx = e[8] / fl, fz = e[10] / fl;
		const front = dB > 1e-4 ? Math.max(0, (dx * fx + dz * fz) / dB) : 1;
		// (a child's arm's length is shorter)
		const k = Math.max(0.75, Math.min(1.1, (P.height || 1.7) / 1.7));
		const stop = (SIDE + (FRONT - SIDE) * front * front) * k, touch = TOUCH * k;
		let want = dB;
		// closing in: the step toward them eases out over the last EASE, to nothing at the stop
		if (dB < dA && dB < stop + EASE) {
			const f = Math.max(0, Math.min(1, (dA - stop) / EASE));
			want = Math.max(dB, dA - (dA - dB) * f);
		}
		// nearer than bodies touch (they walked into you): you give way, at a walking pace
		if (want < touch) want = Math.min(touch, Math.max(want, dA) + 1.5 * dt);
		if (want <= dB + 1e-5) { P.spacePress = Math.max(0, (P.spacePress || 0) - dt * 2); continue; }
		held++;
		const nx = dB > 1e-4 ? dx / dB : fx, nz = dB > 1e-4 ? dz / dB : fz;
		pos.x = bx + nx * want; pos.z = bz + nz * want;
		// (the way into them goes from your stride, the way across it stays)
		if (vel) { const into = -(vel.x * nx + vel.z * nz); if (into > 0) { vel.x += nx * into; vel.z += nz * into; } }
		P.spacePress = pressing ? (P.spacePress || 0) + dt : Math.max(0, (P.spacePress || 0) - dt * 2);
		if (P.spacePress > SHUFFLE_AFTER) shuffle(P, bx, bz, nx, nz, vel, dt, push);
	}
	return held;
}

// someone you keep pressing into steps aside: mostly to the side you are already passing them on,
// a little back, kept off the walls. Only someone standing in the world as they are (a seated
// person, another player, or a body carried in something that moves is left be).
function shuffle(P, bx, bz, nx, nz, vel, dt, push) {
	const S = P.spaceS;
	if (P.spaceHow !== true || !S?.pos || (S.sitK?.v ?? 0) > 0.2) return;
	if (Math.abs(S.pos.x - bx) + Math.abs(S.pos.z - bz) > 0.05) return;
	// (across the line between you: the side your own way already leans to, else their left)
	const tx = -nz, tz = nx, side = vel && vel.x * tx + vel.z * tz < 0 ? 1 : -1;
	let mx = -nx * 0.35 + tx * side, mz = -nz * 0.35 + tz * side;
	const ml = Math.hypot(mx, mz) || 1, step = SHUFFLE * dt;
	mx = mx / ml * step; mz = mz / ml * step;
	const from = _from, to = _to;
	from.x = S.pos.x; from.z = S.pos.z; to.x = S.pos.x + mx; to.y = S.pos.y; to.z = S.pos.z + mz;
	if (push) sweepOut(push, from, to, S.pos.y);
	S.pos.x = to.x; S.pos.z = to.z;
}
