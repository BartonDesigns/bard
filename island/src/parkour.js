// Climbing and running as a body does: up onto a ledge you can reach, over a fence, and a few
// strides along a wall.
//
// - A ledge a little above your head: jump at it and you catch the lip with both hands (you see
//   them there), sag a moment, pull until your chest is over it, get a knee up and stand on top.
//   One about waist or chest high you put your hands on and mantle straight up onto.
// - A fence, a rail, a wall with nowhere to stand on top: hands on the top and a hop over,
//   landing on the far side and carrying on; a taller one, up, over and drop down the far side.
// - Sprinting, jump into a wall at a slant and you run along it a few strides, held up a while
//   and leaning away from it, before you drop (jump again to kick off it); straight at it, a
//   kick up it that can reach a ledge above.
//
// Nothing here knows what anything is: it feels for it with the same tests your walking uses
// (player.js floorAt and pushOut), so a garden wall, a car, a container, a rock or a balcony all
// climb the same. structures/vault.js still owns the windows and the city's low walls.
//
// player.js asks: leap(dx, dz, how) when you jump on the ground (true if a climb began instead),
// air(dt, o) each frame in the air (the wall runs, and the grabs, which begin a climb; it
// returns gravity's share), step(dt) each frame (true while a climb carries you).
//
// Any other body (the fighters, the people) climbs the same way with the parts below the player:
// feelFor({ floorAt, pushOut, eye }).scan(...) finds what is ahead, climbFor(found, feet, how)
// says what to do about it, climbPath(...) lays out the climb and pathAt(path, t) says where the
// body is along it (its feet are eye below the eye y given).

import * as THREE from 'three';
import { soundBus, noise as noiseBuf } from './world/soundbus.js';
import { handGeometry } from './structures/vault.js';
import { lerp, clamp } from './noise.js';

const EYE = 1.68;
const ease = (t) => t * t * (3 - 2 * t);

// ---------- for any body (the player here; the people and the fighters too) ----------
// The feel for what is ahead, with a body's own two tests: floorAt(x, z, footY) (the surface
// under feet at footY) and pushOut(p) (moves an eye-height point p off walls); eye is how far
// its eye is above its feet.
export function feelFor({ floorAt, pushOut, eye = EYE }) {
	const P = new THREE.Vector3();
// can a body stand at x, z with its feet at f? 0 if so; 1 a wall in the way, 2 the ground
// (or something's top) above the feet
function freeAt(x, z, f) {
	P.set(x, f + EYE, z);
	pushOut(P);
	if ((P.x - x) ** 2 + (P.z - z) ** 2 > 4e-4) return 1;
	return floorAt(x, z, f) > f + 0.12 ? 2 : 0;
}
// what is ahead (dx, dz) of a body at px, pz with its feet at f, within reach: null (open
// ground), { kind: 'wall' } (nothing to get on within upTo), or { kind: 'ledge' | 'fence',
// face (how far on its side is), top (world y of the lip), far (how far on you stand, or
// land), y (the floor there) }
function scan(px, pz, f, dx, dz, reach, upTo) {
	let d = -1, why = 0;
	for (let k = 0.05; k <= reach; k += 0.1) { why = freeAt(px + dx * k, pz + dz * k, f + 0.02); if (why) { d = k; break; } }
	if (d < 0) return null;
	// (bodies are kept 0.3 m off a wall, so its side is that far on from where the push begins;
	// a rise of the ground starts where it is met)
	const face = why === 1 ? d + 0.25 : Math.max(0.05, d - 0.05);
	const qx = px + dx * (face + 0.1), qz = pz + dz * (face + 0.1);
	// how high the feet must be to be clear of it, to a couple of centimetres
	let lo = -1;
	for (let u = 0.3; u <= upTo + 0.15; u += 0.15) if (!freeAt(qx, qz, f + u)) { lo = u; break; }
	if (lo < 0) return { kind: 'wall', face };
	let a = lo - 0.15, b = lo;
	for (let i = 0; i < 3; i++) { const m = (a + b) / 2; if (freeAt(qx, qz, f + m)) a = m; else b = m; }
	let top = f + b;
	// a top you could stand on is exact; a wall's or a fence's is a little above where it lets go
	const g = floorAt(qx, qz, top + 0.3);
	top = Number.isFinite(g) && g > top - 0.45 && g < top + 0.35 ? g : top + 0.2;
	// beyond it: somewhere to stand on top (a ledge), or the ground on the far side (a fence)
	for (let k = face + 0.35; k <= face + 2.1; k += 0.15) {
		const x = px + dx * k, z = pz + dz * k, y = floorAt(x, z, top + 0.4);
		if (!Number.isFinite(y) || y > top + 0.4) return { kind: 'wall', face, top };
		if (y > top - 0.4) { if (!freeAt(x, z, y + 0.03)) return { kind: 'ledge', face, top, far: k, y }; continue; }
		if (y > top - 4.5 && !freeAt(x, z, y + 0.03)) return { kind: 'fence', face, top, far: k + 0.1, y };
	}
	return { kind: 'wall', face, top };
}
	return { freeAt, scan };
}

// what a body does about what scan found, feet at f: 'pull' | 'mantle' | 'hop' | 'over', or null
// (an ordinary jump, or nothing). how: 'air' (reaching for it in a jump), 'key' (jumping at it
// from the ground), 'auto' (sprinting into it)
export function climbFor(A, f, how = 'key') {
	if (!A || A.kind === 'wall') return null;
	const rel = A.top - f, auto = how === 'auto';
	if (how === 'air') {
		if (A.kind === 'ledge' && rel >= 0.45 && rel <= 1.95) return rel > 1.1 ? 'pull' : 'mantle';
		if (A.kind === 'fence' && rel >= 0.25 && rel <= 1.95) return rel > 1.15 ? 'over' : 'hop';
		return null;
	}
	if (A.kind === 'ledge' && rel >= 0.5 && rel <= (auto ? 1.0 : 1.5)) return 'mantle';
	if (A.kind === 'fence' && rel >= 0.4 && rel <= (auto ? 1.2 : 1.65)) return 'hop';
	return null;
}

// the climb's path, from a body at at { x, z, eye (its eye's y) } going (dx, dz) at pace sp:
// keys [t, w (along, from the obstacle's side), eye y], eased key to key over dur seconds; grip
// [t0, t1] the hands on it; ox, oz the side's point; exit the pace it carries on at
export function climbPath(kind, A, at, dx, dz, sp = 0, eye = EYE) {
	const eye0 = at.eye, top = A.top, w0 = -A.face, far = A.far - A.face, land = A.y;
	let keys, dur, grip;
	if (kind === 'pull') {
		// catch the lip, sag onto the arms, pull the chest over, a knee up, stand
		const hang = Math.max(top - 0.32, eye0 - 0.18);
		keys = [[0, w0, eye0], [0.16, -0.3, hang], [0.55, -0.24, top + 0.42], [0.8, Math.min(far, 0.4), top + 0.95], [1, far, land + eye]];
		dur = 0.85 + clamp(top - hang, 0, 0.8) * 0.3; grip = [0.04, 0.78];
	} else if (kind === 'mantle') {
		// hands on it, up onto them, a foot up, stand
		keys = [[0, w0, eye0], [0.32, -0.26, Math.max(eye0, top + 0.72)], [0.7, Math.min(far, 0.42), top + 1.02], [1, far, land + eye]];
		dur = 0.5 + clamp(top - (eye0 - eye), 0, 1.6) * 0.12; grip = [0.14, 0.66];
	} else if (kind === 'hop') {
		// hands on the top and over it, landing beyond in the knees
		keys = [[0, w0, eye0], [0.3, -0.24, Math.max(eye0, top + 0.88)], [0.6, far * 0.55, top + 1.0], [0.84, far, land + eye - 0.26], [1, far, land + eye]];
		dur = (sp > 7 ? 0.54 : 0.62) + clamp(top - land - 1.2, 0, 3) * 0.12; grip = [0.18, 0.56];
	} else {
		// 'over': too tall to hop, so up onto the top, swing over and drop
		keys = [[0, w0, eye0], [0.15, -0.3, Math.max(top - 0.3, eye0 - 0.18)], [0.45, -0.22, top + 0.5], [0.66, far * 0.5, top + 0.72], [0.86, far, land + eye - 0.3], [1, far, land + eye]];
		dur = 1.1 + clamp(top - land - 1.5, 0, 3) * 0.12; grip = [0.04, 0.6];
	}
	return {
		kind, keys, dur, grip, dx, dz, ox: at.x + dx * A.face, oz: at.z + dz * A.face, top, far, land,
		exit: kind === 'hop' ? clamp(sp, 3.5, 7) : kind === 'over' ? 2 : 0, drop: Math.max(2, (top + 0.7 - land) * 3),
	};
}
// where the path has the body at t (0..1 of its time): { x, z, eye, w }
export function pathAt(C, t) {
	const K = C.keys;
	t = clamp(t, 0, 1);
	let i = 0;
	while (i < K.length - 2 && t > K[i + 1][0]) i++;
	const a = K[i], b = K[i + 1], k = ease(clamp((t - a[0]) / (b[0] - a[0]), 0, 1)), w = lerp(a[1], b[1], k);
	return { x: C.ox + C.dx * w, z: C.oz + C.dz * w, eye: lerp(a[2], b[2], k), w };
}

export function createParkour({ s, camera, floorAt, pushOut }) {
	// C: the climb under way; R: the wall run under way
	let C = null, R = null, hands = null, clock = 0, scanAt = -1, upUsed = false, runs = 0, lastN = null, coolRun = 0, last = null;
	// the hands on the lip, once there is a scene to put them in (main.js)
	function attach(scene) {
		if (hands || !scene) return;
		const geo = handGeometry(), mat = new THREE.MeshStandardMaterial({ color: 0xb08068, roughness: 0.7 });
		hands = [0, 1].map(() => { const m = new THREE.Mesh(geo, mat); m.visible = false; m.frustumCulled = false; m.name = 'climb-hand'; scene.add(m); return m; });
	}

	const { freeAt, scan } = feelFor({ floorAt, pushOut });

	// ---------- the climbs ----------
	// each a path through keys [t, w (along, from its side), eye y], eased key to key
	function begin(kind, A, dx, dz, sp = 0) {
		C = { ...climbPath(kind, A, { x: s.pos.x, z: s.pos.z, eye: s.pos.y }, dx, dz, sp), t: 0, side: Math.random() < 0.5 ? -1 : 1, at: s.pos.clone(), gripped: false, scuffed: false };
		const top = C.top;
		if (R) stopRun();
		s.grounded = false; s.climbing = kind;
		if (hands) hands.forEach((h, i) => {
			const k = i ? 0.22 : -0.22, rx = -dz, rz = dx;
			h.position.set(C.ox + rx * k + dx * 0.02, top + 0.005, C.oz + rz * k + dz * 0.02);
			h.rotation.set(0, Math.atan2(dx, dz) + (i ? -0.2 : 0.2), 0);
			h.scale.setScalar(0.001);
		});
		return true;
	}
	function step(dt) {
		clock += dt;
		coolRun = Math.max(0, coolRun - dt);
		if (!C) { if (s.climbK) s.climbK = Math.max(0, s.climbK - dt * 4); return false; }
		// (taken away mid-climb: a teleport, the boat, flight)
		if (s.flying || s.locked || s.swimming || s.pos.distanceTo(C.at) > 0.75) { end(false); return false; }
		C.t += dt / C.dur;
		const t = Math.min(1, C.t), Q = pathAt(C, t), w = Q.w;
		s.pos.set(Q.x, Q.eye, Q.z);
		s.vel.set(0, 0, 0);
		s.grounded = false;
		C.at.copy(s.pos);
		s.climbK = Math.min(1, (s.climbK || 0) + dt * 7);
		const [g0, g1] = C.grip;
		if (!C.gripped && t >= g0) { C.gripped = true; sfx(C.kind === 'pull' || C.kind === 'over' ? 'catch' : 'plant'); }
		if (!C.scuffed && t >= (g0 + g1) / 2) { C.scuffed = true; sfx('scuff'); }
		// the look: drawn to the hands while they hold on (up at the lip as you catch it, down at
		// them as you come over), and a roll into the effort, side to side as the arms pull in turn
		const hk = t < g0 ? 0 : t < g0 + 0.06 ? (t - g0) / 0.06 : t < g1 ? 1 : t < g1 + 0.07 ? 1 - (t - g1) / 0.07 : 0;
		const lk = t < g0 ? 0 : t < g0 + 0.1 ? ease((t - g0) / 0.1) : t < g1 ? 1 : t < g1 + 0.2 ? 1 - ease((t - g1) / 0.2) : 0;
		const toHands = Math.atan2(C.top - s.pos.y, Math.max(0.2, 0.05 - w)) + 0.4;
		const look = lk * clamp(toHands - s.pitch, -0.55, 0.3) * 0.8;
		const hang = C.kind === 'pull' || C.kind === 'over';
		const roll = (hang ? 0.035 * Math.sin(Math.PI * 2 * clamp(t / 0.8, 0, 1)) : 0.055 * Math.sin(Math.PI * clamp(t / 0.8, 0, 1))) * C.side;
		camera.position.copy(s.pos);
		camera.rotation.set(clamp(s.pitch + look, -1.35, 1.35), s.yaw, roll, 'YXZ');
		if (hands) for (const h of hands) { h.scale.setScalar(Math.max(0.001, hk)); h.visible = hk > 0.01; }
		if (t >= 1) end(true);
		return true;
	}
	function end(done) {
		if (done) {
			s.pos.set(C.ox + C.dx * C.far, C.land + EYE, C.oz + C.dz * C.far);
			s.vel.set(C.dx * C.exit, 0, C.dz * C.exit);
			s.grounded = true;
			pushOut(s.pos);
			// (the feet coming down: audio/footsteps.js plays the landing)
			const G = s.gait;
			if (G) { G.lands++; G.impact = C.drop; }
			last = { kind: C.kind, top: +C.top.toFixed(2), at: [+s.pos.x.toFixed(1), +s.pos.z.toFixed(1)] };
		}
		if (hands) for (const h of hands) h.visible = false;
		C = null; s.climbing = null;
	}

	// on the ground, jumping (or sprinting into it: 'auto'): something to get onto or over ahead
	// (dx, dz)? A ledge too high for this waits for the jump to bring it in reach (air)
	function leap(dx, dz, how = 'key') {
		if (C || s.flying || s.swimming || !s.grounded) return false;
		const f = s.pos.y - EYE;
		const A = scan(s.pos.x, s.pos.z, f, dx, dz, how === 'auto' ? 1.15 : 1.25, 1.75);
		const kind = climbFor(A, f, how);
		return kind ? begin(kind, A, dx, dz, Math.hypot(s.vel.x, s.vel.z)) : false;
	}

	// ---------- in the air ----------
	// o: { run, wish (flat, at most 1), contact ({ nx, nz, kind: 1 a wall, 2 a rise of the ground }
	// of what you met this frame, or null), jump (pressed this frame) }
	function air(dt, o) {
		if (C) return 1;
		if (R) return running(dt, o);
		const n = o.contact;
		if (!n) return 1;
		const f = s.pos.y - EYE;
		// reaching for it: a grab, if there is a top within reach (looked for a few times a second)
		const into = -(o.wish.x * n.nx + o.wish.z * n.nz);
		if (into > 0.35 && clock - scanAt > 0.06) {
			scanAt = clock;
			const A = scan(s.pos.x, s.pos.z, f, -n.nx, -n.nz, 0.75, 1.95);
			const kind = climbFor(A, f, 'air');
			if (kind) { begin(kind, A, -n.nx, -n.nz, Math.hypot(s.vel.x, s.vel.z)); return 1; }
			// (something low: the step takes it, or the jump lands on it)
			if (A && A.kind !== 'wall') return 1;
		}
		// sprinting into a wall taller than you
		const v = Math.hypot(s.vel.x, s.vel.z);
		if (!o.run || n.kind !== 1 || v < 5.5 || s.vel.y < -3.5 || coolRun > 0) return 1;
		if (!freeAt(s.pos.x - n.nx * 0.45, s.pos.z - n.nz * 0.45, f + 1.5)) return 1;
		const c = -(s.vel.x * n.nx + s.vel.z * n.nz) / v;
		// straight at it: a kick up it (once a jump)
		if (c > 0.9) {
			if (!upUsed) { upUsed = true; s.vel.y = Math.max(s.vel.y + 1.6, 4.4); sfx('kick'); footfall(); }
			return 1;
		}
		// at a slant: along it, a wall you have not just run
		if (c < 0.06 || runs >= 3 || (lastN && lastN.nx * n.nx + lastN.nz * n.nz > 0.5)) return 1;
		let tx = s.vel.x + n.nx * c * v, tz = s.vel.z + n.nz * c * v;
		const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
		// (a wall, not a trunk or a post: there a stride either way along it too)
		for (const k of [-0.7, 0.7]) if (!freeAt(s.pos.x - n.nx * 0.45 + tx * k, s.pos.z - n.nz * 0.45 + tz * k, f + 1.0)) return 1;
		// (which side the wall is: the view leans away from it)
		const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw), onRight = -(n.nx * rx + n.nz * rz) > 0 ? 1 : -1;
		R = { nx: n.nx, nz: n.nz, tx, tz, sp: Math.max(7, tl * 1.05), t: 0, lost: 0, foot: 0.05, lean: 0.085 * onRight };
		upUsed = true;
		s.vel.y = clamp(s.vel.y, 0.8, 2.2);
		s.wallRun = true;
		sfx('kick');
		return 0.25;
	}
	function running(dt, o) {
		R.t += dt;
		R.lost = o.contact ? 0 : R.lost + dt;
		if (o.jump) {
			// a kick off it, away and on
			s.vel.set(R.nx * 4.8 + R.tx * R.sp * 0.8, 5.4, R.nz * 4.8 + R.tz * R.sp * 0.8);
			stopRun(); coolRun = 0.15; sfx('kick');
			return 1;
		}
		const away = o.wish.x * R.nx + o.wish.z * R.nz;
		if (R.t > 1.15 || R.lost > 0.12 || !o.run || away > 0.55 || s.grounded) { stopRun(); return 1; }
		R.sp = Math.max(6.2, R.sp - dt * 1.5);
		// along it, leaning on it a little (which keeps you against it)
		s.vel.x = R.tx * R.sp - R.nx * 0.9; s.vel.z = R.tz * R.sp - R.nz * 0.9;
		R.foot -= dt;
		if (R.foot <= 0) { R.foot = 0.24; footfall(); }
		// held up at first, then gravity takes you back
		return R.t < 0.4 ? 0.25 : Math.min(1, 0.25 + (R.t - 0.4) * 1.0);
	}
	// a stride on the wall (audio/footsteps.js plays it, on stone)
	function footfall() { const G = s.gait; if (G) { G.count++; G.foot ^= 1; G.run = true; } }
	function stopRun() { lastN = { nx: R.nx, nz: R.nz }; runs++; R = null; s.wallRun = false; }
	// back on the ground: the kick and the wall runs are yours again
	function grounded() { if (R) stopRun(); upUsed = false; runs = 0; lastN = null; coolRun = 0; }
	// the view's lean on a wall run
	const lean = () => R ? R.lean * clamp(R.t / 0.15, 0, 1) * clamp((1.15 - R.t) / 0.2, 0, 1) : 0;

	// ---------- the sounds: hands slapping onto a lip, the scrape of the pull, a foot's kick ----------
	function sfx(kind) {
		try {
			const B = soundBus(); if (!B) return;
			const ctx = B.ctx, t = ctx.currentTime;
			const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, kind === 'scuff' ? 'pink' : 'white');
			const bq = ctx.createBiquadFilter(), g = ctx.createGain();
			const len = kind === 'scuff' ? 0.32 : kind === 'kick' ? 0.07 : 0.05, peak = kind === 'scuff' ? 0.07 : kind === 'kick' ? 0.12 : 0.2;
			bq.type = 'bandpass'; bq.frequency.value = kind === 'scuff' ? 900 : kind === 'kick' ? 600 : 2300; bq.Q.value = kind === 'scuff' ? 0.8 : 1.2;
			if (kind === 'scuff') bq.frequency.linearRampToValueAtTime(1600, t + len);
			g.gain.setValueAtTime(0.0001, t);
			g.gain.linearRampToValueAtTime(peak, t + (kind === 'scuff' ? 0.08 : 0.004));
			g.gain.exponentialRampToValueAtTime(0.0001, t + len);
			src.connect(bq); bq.connect(g); g.connect(B.out);
			src.start(t, Math.random() * 1.5); src.stop(t + len + 0.02);
			const parts = [src, bq, g];
			// (the weight behind it: a low thump as the hands take you, or a foot meets the wall)
			if (kind !== 'scuff') {
				const o = ctx.createOscillator(), og = ctx.createGain();
				o.type = 'sine'; o.frequency.setValueAtTime(kind === 'kick' ? 120 : 150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
				og.gain.setValueAtTime(kind === 'catch' ? 0.3 : 0.18, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
				o.connect(og); og.connect(B.out); o.start(t); o.stop(t + 0.16);
				parts.push(o, og);
			}
			src.onended = () => setTimeout(() => { for (const p of parts) p.disconnect(); }, 200);
		} catch { /* no audio */ }
	}

	function cancel() { if (C) end(false); if (R) stopRun(); }
	function dispose() { cancel(); if (hands) { hands[0].geometry.dispose(); hands[0].material.dispose(); for (const h of hands) h.removeFromParent(); hands = null; } }
	return {
		attach, step, leap, air, grounded, lean, cancel, dispose, scan,
		active: () => !!C, running: () => !!R,
		info: () => ({ climb: C ? { kind: C.kind, t: +C.t.toFixed(2), top: +C.top.toFixed(2) } : null, run: R ? { t: +R.t.toFixed(2), sp: +R.sp.toFixed(1) } : null, last }),
	};
}
