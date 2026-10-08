// The field arms as game rules: what each one does when its trigger is pulled. Magazines and
// the reserve (boxes from the shops, gameplay/arms.js), fire modes and rate, spread that opens
// as you fire and move and closes when you aim, recoil handed to the view, reloads timed by the
// view's own animation. Everything is a game number scaled by the item's level and quality
// (gameplay/gear-levels.js); nothing here describes a real mechanism. Pure: no three, no DOM.

import { statScale } from '../gameplay/gear-levels.js';

export const FIRE_MODES = ['semi', 'burst', 'auto'];

// the arms at level 1, Common. rpm: shots a minute; spread and recoil in radians; range in
// metres; reload in seconds; a projectile flies (speed m/s, drop m/s², splash radius)
export const WEAPONS = Object.freeze({
	'aurora-trail-rifle': { name: 'Aurora Trail Rifle', modes: ['semi', 'burst'], rpm: 420, burst: 3, mag: 20, box: 'trail-rifle-box', perBox: 40, dmg: 34, type: 'ballistic', spread: 0.006, ads: 0.25, move: 0.02, bloom: 0.004, kick: [0.02, 0.006], range: 280, falloff: 140, reload: 2.2, tracer: 0, zoom: 1.6 },
	'mossback-scout-rifle': { name: 'Mossback Scout Rifle', modes: ['auto', 'semi'], rpm: 720, burst: 3, mag: 30, box: 'scout-rifle-box', perBox: 60, dmg: 21, type: 'ballistic', spread: 0.011, ads: 0.35, move: 0.025, bloom: 0.0035, kick: [0.011, 0.007], range: 170, falloff: 70, reload: 1.9, tracer: 1, zoom: 1.3 },
	'warden-spark-carbine': { name: 'Warden Spark Carbine', modes: ['auto', 'burst'], rpm: 360, burst: 3, mag: 24, box: 'spark-cell-pack', perBox: 48, dmg: 26, type: 'energy', spread: 0.009, ads: 0.4, move: 0.018, bloom: 0.003, kick: [0.009, 0.004], range: 200, falloff: 120, reload: 2.4, tracer: 2, zoom: 1.35, projectile: { speed: 150, drop: 0, splash: 1.8, life: 1.6 } },
	'reedline-hunting-bow': { name: 'Reedline Hunting Bow', modes: ['semi'], rpm: 75, burst: 1, mag: 1, box: 'reed-arrow-quiver', perBox: 12, dmg: 72, type: 'pierce', spread: 0.004, ads: 0.4, move: 0.012, bloom: 0, kick: [0.006, 0.002], range: 150, falloff: 120, reload: 0.75, tracer: 3, zoom: 1.25, projectile: { speed: 75, drop: 9.8, splash: 0, life: 4 } },
});
export const isWeapon = (id) => !!WEAPONS[id];
export const boxOf = (id) => WEAPONS[id]?.box || null;

// an instance's numbers: damage, accuracy, range, magazine and reload all grow with it
export function weaponStats(inst) {
	const W = WEAPONS[inst?.i];
	if (!W) return null;
	const k = statScale(inst);
	return {
		...W, id: inst.i, k,
		dmg: Math.round(W.dmg * k * 10) / 10,
		spread: W.spread / (0.6 + 0.4 * k),
		range: Math.round(W.range * (0.75 + 0.25 * k)),
		falloff: Math.round(W.falloff * (0.75 + 0.25 * k)),
		mag: Math.max(1, Math.round(W.mag * (1 + (k - 1) * 0.3))),
		reload: Math.round(W.reload / (0.8 + 0.2 * k) * 100) / 100,
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
export function createWeaponState(inst, loaded = null) {
	const S = weaponStats(inst);
	if (!S) return null;
	return { S, uid: inst.u, mag: loaded == null ? S.mag : Math.max(0, Math.min(S.mag, loaded | 0)), mode: 0, cool: 0, burstLeft: 0, held: false, pulled: false, reloading: 0, reloadDur: 0, bloom: 0, shots: 0 };
}
export const modeOf = (W) => W.S.modes[W.mode % W.S.modes.length];
export function nextMode(W) { W.mode = (W.mode + 1) % W.S.modes.length; W.burstLeft = 0; return modeOf(W); }

// the trigger: pressed (true) or let go (false); a press is remembered until it is spent
export function trigger(W, down) {
	if (down && !W.held) W.pulled = true;
	W.held = !!down;
	if (!down && modeOf(W) !== 'burst') W.burstLeft = 0;
}

// a reload: only with rounds to load and room for them; dur from the view's animation, if any
export function startReload(W, reserve, dur = null) {
	if (W.reloading > 0 || W.mag >= W.S.mag || reserve <= 0) return false;
	W.reloadDur = W.reloading = Math.max(0.2, Number.isFinite(dur) && dur > 0 ? dur : W.S.reload);
	W.burstLeft = 0;
	return true;
}
export const cancelReload = (W) => { W.reloading = 0; };

// how wide the shots go now: the weapon's own, opened by moving and by firing (bloom), closed
// by aiming down the sights (ads 0..1)
export function spreadNow(W, ads = 0, moving = 0) {
	const S = W.S;
	return (S.spread + S.move * Math.min(1, moving) + W.bloom) * (1 - (1 - S.ads) * Math.min(1, ads));
}

// one step: { fired: shots this step, kick: [pitch, yaw] for the view, loaded: rounds moved
// from the reserve into the magazine (the caller takes them off the reserve), empty: tried to
// fire with nothing in the magazine }
export function stepWeapon(W, dt, { reserve = 0, ads = 0, rand = Math.random } = {}) {
	const S = W.S, out = { fired: 0, kick: [0, 0], loaded: 0, empty: false, reloaded: false };
	W.cool = Math.max(0, W.cool - dt);
	W.bloom = Math.max(0, W.bloom - dt * (0.03 + W.bloom * 3));
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
