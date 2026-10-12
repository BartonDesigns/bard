// The field arms as game rules: what each one does when its trigger is pulled. Magazines and
// the reserve (boxes from the shops, gameplay/arms.js), fire modes and rate, spread that opens
// as you fire and move and closes when you aim, recoil handed to the view, reloads timed by the
// view's own animation. Everything is a game number scaled by the item's level and quality
// (gameplay/gear-levels.js); nothing here describes a real mechanism. Pure: no three, no DOM.

import { statScale } from '../gameplay/gear-levels.js';

export const FIRE_MODES = ['semi', 'burst', 'auto'];
export const BOW_ID = 'reedline-hunting-bow';
export const BOW_DRAW_SECONDS = 0.85;
export const BOW_MIN_DRAW = 0.2;
export const isBow = (W) => W?.S?.id === BOW_ID;
export const bowPower = (q) => { q = Math.max(0, Math.min(1, q)); return { damage: 0.35 + 0.65 * q * q, speed: 0.45 + 0.55 * q }; };

// the arms at level 1, Common. rpm: shots a minute; spread and recoil in radians; range in
// metres; reload in seconds; a projectile flies (speed m/s, drop m/s², splash radius)
export const WEAPONS = Object.freeze({
	'aurora-trail-rifle': { name: 'Aurora Trail Rifle', modes: ['semi'], rpm: 96, burst: 1, mag: 8, box: 'trail-rifle-box', perBox: 24, dmg: 58, type: 'ballistic', spread: 0.004, ads: 0.2, move: 0.022, bloom: 0.006, kick: [0.024, 0.006], range: 320, falloff: 160, reload: 2.3, tracer: 0 },
	'mossback-scout-rifle': { name: 'Mossback Scout Rifle', modes: ['semi'], rpm: 66, burst: 1, mag: 5, box: 'scout-rifle-box', perBox: 20, dmg: 82, type: 'ballistic', spread: 0.003, ads: 0.15, move: 0.025, bloom: 0.008, kick: [0.026, 0.008], range: 360, falloff: 200, reload: 2.0, tracer: 1 },
	'warden-spark-carbine': { name: 'Warden Spark Carbine', modes: ['auto', 'burst', 'semi'], rpm: 360, burst: 3, mag: 24, box: 'spark-cell-pack', perBox: 48, dmg: 17, type: 'energy', spread: 0.009, ads: 0.4, move: 0.018, bloom: 0.003, kick: [0.008, 0.004], range: 200, falloff: 110, reload: 1.7, tracer: 2, projectile: { speed: 150, drop: 0, splash: 1.2, life: 1.6 } },
	'reedline-hunting-bow': { name: 'Reedline Hunting Bow', modes: ['semi'], rpm: 48, burst: 1, mag: 1, box: 'reed-arrow-quiver', perBox: 12, dmg: 90, type: 'pierce', spread: 0.003, ads: 0.4, move: 0.012, bloom: 0, kick: [0.006, 0.002], range: 150, falloff: 120, reload: 0.9, tracer: 3, projectile: { speed: 75, drop: 9.8, splash: 0, life: 4 } },
});
export const isWeapon = (id) => !!WEAPONS[id];
export const boxOf = (id) => WEAPONS[id]?.box || null;

// an instance's numbers: damage, accuracy, range, magazine and reload all grow with it. view:
// the weapon's look's own rate (shots a second), magazine and reload time, which win when given
// (the view will not show shots faster than its rate)
export function weaponStats(inst, view = null) {
	const W0 = WEAPONS[inst?.i];
	if (!W0) return null;
	const W = { ...W0 };
	if (view?.rate > 0) W.rpm = view.rate * 60;
	if (view?.mag > 0) W.mag = view.mag;
	if (view?.reload > 0) W.reload = view.reload;
	const k = statScale(inst);
	return {
		...W, id: inst.i, k,
		dmg: Math.round(W.dmg * k * 10) / 10,
		spread: W.spread / (0.6 + 0.4 * k),
		range: Math.round(W.range * (0.75 + 0.25 * k)),
		falloff: Math.round(W.falloff * (0.75 + 0.25 * k)),
		mag: inst.i === BOW_ID ? 1 : Math.max(1, Math.round(W.mag * (1 + (k - 1) * 0.3))),
		reload: inst.i === BOW_ID ? 0.9 : Math.round(W.reload / (0.8 + 0.2 * k) * 100) / 100,
		interval: 60 / W.rpm,
	};
}

// damage at a distance: full to the falloff, then easing down to 55% at the range
export function damageAt(S, d) {
	if (d <= S.falloff) return S.dmg;
	const u = Math.min(1, (d - S.falloff) / Math.max(1, S.range - S.falloff));
	return S.dmg * (1 - 0.45 * u);
}

// a weapon in your hands: its magazine, mode and what it is doing
export function createWeaponState(inst, loaded = null, view = null) {
	const S = weaponStats(inst, view);
	if (!S) return null;
	return { S, uid: inst.u, mag: loaded == null ? S.mag : Math.max(0, Math.min(S.mag, loaded | 0)), mode: 0, cool: 0, burstLeft: 0, held: false, pulled: false, reloading: 0, reloadDur: 0, reloadSerial: 0, bloom: 0, shots: 0, draw: 0, drawing: false, released: 0 };
}
export const modeOf = (W) => W.S.modes[W.mode % W.S.modes.length];
export function nextMode(W) { W.mode = (W.mode + 1) % W.S.modes.length; W.burstLeft = 0; return modeOf(W); }

// the trigger: pressed (true) or let go (false); a press is remembered until it is spent
export function trigger(W, down) {
	if (isBow(W)) {
		if (down && !W.held) {
			W.pulled = true;
			W.drawing = W.mag > 0 && W.reloading <= 0 && W.cool <= 0;
			W.draw = 0;
		} else if (!down && W.held) {
			W.released = W.drawing ? W.draw : 0;
			W.drawing = false;
		}
		W.held = !!down;
		return;
	}
	if (down && !W.held) W.pulled = true;
	W.held = !!down;
	if (!down && modeOf(W) !== 'burst') W.burstLeft = 0;
}
// Cancelling a gesture is not releasing an arrow. Use this for menus, blur and travel.
export function cancelTrigger(W) { W.held = W.pulled = W.drawing = false; W.burstLeft = 0; W.draw = W.released = 0; }

// a reload: only with rounds to load and room for them; dur from the view's animation, if any
export function startReload(W, reserve, dur = null) {
	if (W.reloading > 0 || W.mag >= W.S.mag || reserve <= 0) return false;
	W.reloadDur = W.reloading = Math.max(0.2, Number.isFinite(dur) && dur > 0 ? dur : W.S.reload);
	W.reloadSerial++;
	if (isBow(W)) cancelTrigger(W);
	W.burstLeft = 0;
	return true;
}
export const cancelReload = (W) => { W.reloading = 0; W.reloadSerial++; };
export const completeReload = (W, serial) => { if (W.reloadSerial !== serial || W.reloading <= 0) return false; W.reloading = 1e-6; return true; };

// how wide the shots go now: the weapon's own, opened by moving and by firing (bloom), closed
// by aiming down the sights (ads 0..1)
export function spreadNow(W, ads = 0, moving = 0) {
	const S = W.S;
	return (S.spread + S.move * Math.min(1, moving) + W.bloom) * (1 - (1 - S.ads) * Math.min(1, ads));
}

// one step: { fired: shots this step, kick: [pitch, yaw] for the view, loaded: rounds moved
// from the reserve into the magazine (the caller takes them off the reserve), empty: tried to
// fire with nothing in the magazine }
export function stepWeapon(W, dt, { reserve = 0, ads = 0, rand = Math.random, accept = () => true } = {}) {
	const S = W.S, out = { fired: 0, kick: [0, 0], loaded: 0, empty: false, reloaded: false, charge: 1 };
	dt = Math.max(0, Number.isFinite(dt) ? dt : 0);
	W.cool = Math.max(0, W.cool - dt);
	W.bloom = Math.max(0, W.bloom - dt * (0.006 + W.bloom * 2.5));
	if (W.reloading > 0) {
		W.reloading -= dt;
		if (W.reloading <= 0) {
			W.reloading = 0;
			const n = Math.min(S.mag - W.mag, Math.max(0, reserve));
			W.mag += n; out.loaded = n; out.reloaded = true;
		}
		W.pulled = false;
		return out;
	}
	if (isBow(W)) {
		if (W.drawing && W.held) W.draw = Math.min(1, W.draw + dt / BOW_DRAW_SECONDS);
		out.empty = W.pulled && W.mag <= 0;
		W.pulled = false;
		const charge = W.released;
		W.released = 0;
		if (!W.drawing && !W.held) W.draw = 0;
		if (charge < BOW_MIN_DRAW || W.mag <= 0 || W.cool > 1e-9) return out;
		// An unavailable/throwing renderer must never consume an arrow or advance cooldown.
		try { if (accept(charge) === false) return out; } catch { return out; }
		// The bow's firing cycle is draw + nock, with only a short release recovery.
		W.mag--; W.shots++; W.cool = Math.min(S.interval, 0.12);
		out.fired = 1; out.charge = charge;
		out.kick[0] = S.kick[0] * charge / Math.sqrt(S.k);
		out.kick[1] = S.kick[1] * charge * (rand() * 2 - 1);
		return out;
	}
	const mode = modeOf(W);
	// (several shots can fall in one long frame; never more than four)
	for (let guard = 0; guard < 4 && W.cool <= 1e-9; guard++) {
		let want = false;
		if (W.burstLeft > 0) want = true;
		else if (W.pulled) { want = true; if (mode === 'burst') W.burstLeft = S.burst; }
		else if (W.held && mode === 'auto') want = true;
		W.pulled = false;
		if (!want) break;
		if (W.mag <= 0) { out.empty = true; W.burstLeft = 0; break; }
		try { if (accept(1) === false) break; } catch { break; }
		W.mag--; W.shots++; out.fired++;
		if (W.burstLeft > 0) W.burstLeft--;
		const burstGap = mode === 'burst' && W.burstLeft === 0 ? S.interval * 2.5 : 0;
		W.cool += S.interval + burstGap;
		W.bloom = Math.min(S.spread * 4 + 0.02, W.bloom + S.bloom);
		const steady = 1 - 0.45 * Math.min(1, ads);
		out.kick[0] += S.kick[0] * steady / Math.sqrt(S.k);
		out.kick[1] += S.kick[1] * steady * (rand() * 2 - 1);
	}
	return out;
}

// a direction within a cone about d (unit [x, y, z]): uniform over the cone's disc
export function spreadDir(d, cone, rand = Math.random) {
	if (cone <= 0) return d.slice();
	const r = Math.sqrt(rand()) * Math.tan(cone), a = rand() * Math.PI * 2;
	// two axes across d
	const up = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
	let ux = up[1] * d[2] - up[2] * d[1], uy = up[2] * d[0] - up[0] * d[2], uz = up[0] * d[1] - up[1] * d[0];
	const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
	const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
	const c = Math.cos(a) * r, s = Math.sin(a) * r;
	const x = d[0] + ux * c + vx * s, y = d[1] + uy * c + vy * s, z = d[2] + uz * c + vz * s, l = Math.hypot(x, y, z);
	return [x / l, y / l, z / l];
}

// the reserve for a weapon: loose rounds plus every box carried
export const reserveOf = (loose, boxes, S) => Math.max(0, loose | 0) + Math.max(0, boxes | 0) * S.perBox;
// after a reload took n rounds: how many boxes to open (consumed) and the loose rounds left
export function drawRounds(loose, boxes, n, S) {
	let open = 0, l = Math.max(0, loose | 0);
	while (l < n && open < boxes) { l += S.perBox; open++; }
	return { open, loose: Math.max(0, l - n) };
}
