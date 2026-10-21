// Each spell's own look (magic/caster.js does what a spell does; this, how it shows). The rule is
// that no two spells read alike at a glance: each has its own colours (a hot core and an edge),
// its own shape of mote (fx.js SHAPE), its own motion, and, where it touches the ground, its own
// mark laid flat there (fx.decal), after the spell craft of Diablo IV, Guild Wars 2 and World of
// Warcraft:
//
//   Radiance      white-gold stars; three spears out of the sun (or silver, the moon); Solar Flare a
//                 small sun with rays; Judgement a sigil, then a falling sword of sky
//   Restoration   rising crosses, drifting petals, a hallowed green sigil, a phoenix's wings
//   Warding       pale blue hexagons; Radiant Aura a turning crown of flame; Banish a white gale
//   Dawn          rose and peach: a small sun, wind streaks at your feet, ripples on the water
//   Shadow        black smoke round violet hearts; Night Terror red eyes in the dark; Eclipse a
//                 black sun with a corona
//   Void          indigo crystal shards, warped rings, an accretion disc round a black heart
//   Blight        green poison and its fog, falling ash, rising souls, spores
//   Umbral        spectres (the shade a violet wraith, the host pale green ghosts), a blood sigil
//   Storm         forked lightning: blue-white, a plasma orb, a thunderhead with its rain
//   Chrono        clock-face sigils and turning gear rings in gold, cyan and lavender
//   Primal        fire with embers and smoke; ice shards and frost on the ground; rain and ripples
//
// Dark smoke (the ink pool) only reads over light ground, so each dark spell keeps a glowing rim
// of its own colour round its smoke. Every function here only draws (fx.js), never touches the
// fight. A spell without its own entry for a moment falls back on its school's colour as a soft orb.

import { SHAPE, GLOW } from './fx.js';

const O = (shape, extra = {}) => Object.freeze({ shape: SHAPE[shape], ...extra });
const ORB = null, STAR = O('star', { spin: 2 }), RING = O('ring'), SHARD = O('shard', { spin: 1.5 }), FLAME = O('flame'), STREAK = O('streak'),
	RUNE = O('rune', { spin: 0.8 }), RUNE_STILL = O('rune'), SMOKE = O('smoke', { ink: true, spin: 0.4 }), EYES = O('eyes'), CROSS = O('cross'),
	HEX = O('hex', { spin: 0.3 }), LEAF = O('leaf', { spin: 2.5 }), GLOWSMOKE = O('smoke', { spin: 0.4 }), DARK_ORB = O('orb', { ink: true }), DRIP = O('flame', { rot: Math.PI }),
	// (Gargantua's debris: dark shards and puffs of the ground torn up, and lit grit)
	DEBRIS = O('shard', { ink: true, spin: 3 }), DEBRIS_PUFF = O('smoke', { ink: true, spin: 0.6 }), GRIT = O('shard', { spin: 4 });
const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
const ang = (dx, dz) => Math.atan2(dx, dz);

// ---------- shared motions ----------
// the hard parts (fx.spark, fx.seg): a missile's body as a spear of light (a white core inside its
// colour, len long behind its head), and an impact's force: a hot flash, a ring snapping out,
// rays thrown through along the blow, debris falling, a scorch left on the ground
function spear(fx, p, d, len, w, core, edge, life = 0.05) {
	const t = { x: p.x - d.x * len, y: p.y - d.y * len, z: p.z - d.z * len };
	fx.seg(t, p, edge, w, life, 0.9);
	fx.seg({ x: p.x - d.x * len * 0.55, y: p.y - d.y * len * 0.55, z: p.z - d.z * len * 0.55 }, p, core, w * 0.45, life);
}
function slam(fx, at, d, core, edge, k = 1, ground = true) {
	fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.08, 0.6 * k, 1.8 * k, C.white, 1, 0, 0, ORB);
	fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.2, 0.3 * k, 3.2 * k, edge, 1, 0, 0, RING);
	const dx = d?.x || 0, dy = d?.y || 0, dz = d?.z || 0;
	for (let n = Math.round(14 * k); n > 0; n--) {
		const a = Math.random() * 6.283, e = (Math.random() - 0.35) * 1.5, sp = (12 + Math.random() * 16) * Math.sqrt(k);
		// (thrown on through, along the blow, more than back at you)
		fx.spark(at.x, at.y, at.z, Math.cos(a) * Math.cos(e) * sp + dx * sp * 0.8, Math.sin(e) * sp + dy * sp * 0.5, Math.sin(a) * Math.cos(e) * sp + dz * sp * 0.8, 0.14 + Math.random() * 0.14, 0.035, 0.05 + 0.04 * k, n % 3 ? core : C.white, 1, 4, 5);
	}
	for (let n = Math.round(8 * k); n > 0; n--) fx.spark(at.x, at.y, at.z, rnd(5 * k), 3 + Math.random() * 5 * k, rnd(5 * k), 0.5 + Math.random() * 0.5, 0.05, 0.04, edge, 1, 16, 0.6);
	if (ground) fx.decal({ x: at.x, y: at.y - 1, z: at.z }, 0.3 * k, 1.2 * k, 0.35, edge, 0.9, RING);
}
function trailOf(fx, pos, d, step, core, edge, s, o = ORB, n = 3) {
	spear(fx, pos, d, Math.max(1.6, step * 2), s * 0.32, C.white, core);
	if (Math.random() < 0.6) fx.spark(pos.x, pos.y, pos.z, -d.x * 6 + rnd(2), -d.y * 6 + rnd(2), -d.z * 6 + rnd(2), 0.18, 0.04, s * 0.08, edge, 1, 3, 3);
	for (let k = 0; k < n; k++) fx.emit(pos.x - d.x * step * k / n, pos.y - d.y * step * k / n, pos.z - d.z * step * k / n, rnd(0.3), rnd(0.3), rnd(0.3), 0.35, k ? s * 0.7 : s, s * 0.1, k ? edge : core, 1, 0, 0, o);
}
// smoke behind a bolt, with a glow of its colour round it so it shows on dark ground too
function smokeTrail(fx, pos, d, step, ink, rim, s = 0.5, n = 2) {
	for (let k = 0; k < n; k++) {
		const x = pos.x - d.x * step * k / n + rnd(0.1), y = pos.y - d.y * step * k / n + rnd(0.1), z = pos.z - d.z * step * k / n + rnd(0.1);
		fx.emit(x, y, z, rnd(0.3), 0.3 + Math.random() * 0.3, rnd(0.3), 0.9, s * 0.6, s * 1.6, ink, 0.6, 0, 0.5, SMOKE);
		if (rim) fx.emit(x, y, z, rnd(0.3), 0.3, rnd(0.3), 0.7, s * 0.8, s * 1.8, rim, 0.18, 0, 0.5, GLOWSMOKE);
	}
}
function embers(fx, at, c, n, v = 2, life = 1.2, s = 0.1, g = 3) {
	for (let k = 0; k < n; k++) if (k % 2) fx.spark(at.x + rnd(0.3), at.y + rnd(0.3), at.z + rnd(0.3), rnd(v * 1.5), Math.random() * v * 2, rnd(v * 1.5), life * 0.6, 0.05, s * 0.4, c, 1, g * 2, 1);
	else fx.emit(at.x + rnd(0.3), at.y + rnd(0.3), at.z + rnd(0.3), rnd(v), Math.random() * v * 1.5, rnd(v), life * (0.5 + Math.random()), s, s * 0.3, c, 1, g, 0.6, STAR);
}
// (cracks torn in the ground out from at: n jagged strokes to r)
function cracks(fx, at, r, n, c, life = 0.5, w = 0.07) {
	for (let k = 0; k < n; k++) {
		const a = k / n * 6.283 + rnd(0.3), l = r * (0.5 + Math.random() * 0.5);
		fx.line({ x: at.x, y: at.y + 0.05, z: at.z }, { x: at.x + Math.sin(a) * l, y: at.y + 0.05, z: at.z + Math.cos(a) * l }, c, 0.5, life, w, 0.35);
	}
}
// (n hard spikes driven up out of the ground in a ring of radius r round g, h tall, leaning in)
function spikes(fx, g, r, n, h, c, edge, life = 0.7, w = 0.14) {
	for (let k = 0; k < n; k++) {
		const a = k / n * 6.283 + rnd(0.2), rr = r * (0.85 + Math.random() * 0.3), hh = h * (0.7 + Math.random() * 0.5);
		fx.seg({ x: g.x + Math.cos(a) * rr, y: g.y, z: g.z + Math.sin(a) * rr }, { x: g.x + Math.cos(a) * rr * 0.7, y: g.y + hh, z: g.z + Math.sin(a) * rr * 0.7 }, k % 3 ? c : edge, w, life, 1, 1);
	}
}
function inkPuff(fx, at, ink, n = 8, r = 1, s = 1, life = 1.2, a = 0.6, rim = null) {
	for (let k = 0; k < n; k++) {
		const x = at.x + rnd(r), y = at.y + rnd(r * 0.5), z = at.z + rnd(r), vx = rnd(0.8), vy = 0.4 + Math.random() * 0.6, vz = rnd(0.8), l = life * (0.6 + Math.random() * 0.6);
		fx.emit(x, y, z, vx, vy, vz, l, s * 0.6, s * 1.5, ink, a, 0, 0.8, SMOKE);
		if (rim && k % 2 === 0) fx.emit(x, y, z, vx, vy, vz, l * 0.8, s * 0.8, s * 1.8, rim, 0.16, 0, 0.8, GLOWSMOKE);
	}
}
// a sigil on the ground: a rune circle laid flat, its rim and spokes of light standing on it
function sigil(fx, at, r, core, edge, life = 0.6, spin = 0, spokes = 6, stand = true) {
	fx.decal(at, r * 1.15, r * 1.2, life, edge, 0.95, O('rune', { rot: spin, spin: 0.6 }));
	fx.decal(at, r * 0.9, r * 1.25, life * 0.8, core, 0.7, O('ring'));
	if (stand) for (let k = 0; k < spokes; k++) { const a = spin * 1.5 + k / spokes * 6.283; fx.emit(at.x + Math.cos(a) * r * 0.62, at.y + 0.2, at.z + Math.sin(a) * r * 0.62, 0, 0.4, 0, life * 0.7, 0.35, 0.2, core, 0.9, 0, 0, STAR); }
}
// a shockwave along the ground
function wave(fx, at, r, c, life = 0.45, a = 0.9) {
	fx.decal(at, r * 0.2, r * 1.25, life, c, a, RING);
	// (its front: hard dashes racing out across the ground)
	for (let k = 0; k < 20; k++) { const g = k / 20 * 6.283 + rnd(0.1), v = r * 1.25 / life; fx.spark(at.x + Math.cos(g) * r * 0.2, at.y + 0.15, at.z + Math.sin(g) * r * 0.2, Math.cos(g) * v, 0.3, Math.sin(g) * v, life * 0.85, 0.06, 0.07, c, a, 0, 1.5); }
}
// a wraith: a head with eyes, a body thinning down to a tail of smoke
function wraith(fx, p, core, edge, ink, t, s = 1) {
	fx.emit(p.x, p.y + 0.35 * s, p.z, 0, 0, 0, 0.08, 0.42 * s, 0.42 * s, core, 1, 0, 0, ORB);
	fx.emit(p.x, p.y + 0.38 * s, p.z, 0, 0, 0, 0.08, 0.3 * s, 0.3 * s, [1, 1, 1], 0.8, 0, 0, EYES);
	for (let k = 0; k < 5; k++) fx.emit(p.x + Math.sin(t * 5 + k) * 0.08, p.y + 0.1 * s - k * 0.22 * s, p.z, 0, 0, 0, 0.08, (0.55 - k * 0.09) * s, (0.55 - k * 0.09) * s, edge, 0.8, 0, 0, ORB);
	if (ink && Math.random() < 0.5) fx.emit(p.x + rnd(0.15), p.y - 0.7 * s, p.z + rnd(0.15), rnd(0.2), -0.3, rnd(0.2), 0.7, 0.35 * s, 0.7 * s, ink, 0.5, 0, 0, SMOKE);
}

// ---------- palettes ----------
const C = {
	white: [1, 1, 1], gold: [1, 0.72, 0.22], sun: [1, 0.92, 0.6], amber: [1, 0.55, 0.12], moon: [0.62, 0.78, 1],
	leafG: [0.3, 1, 0.45], mint: [0.65, 1, 0.75], petal: [1, 0.62, 0.8], phoenix: [1, 0.45, 0.12],
	ice: [0.78, 0.95, 1], sky: [0.4, 0.68, 1], ward: [0.55, 0.8, 1],
	rose: [1, 0.6, 0.6], peach: [1, 0.78, 0.55], wind: [0.75, 1, 0.95], water: [0.35, 0.65, 1],
	violet: [0.62, 0.35, 1], lilac: [0.82, 0.62, 1], blood: [1, 0.08, 0.1], redEye: [1, 0.12, 0.05], corona: [1, 0.6, 0.25], accrete: [1, 0.66, 0.32], ember: [1, 0.38, 0.08], debris: [0.07, 0.05, 0.04], grit: [0.8, 0.62, 0.5],
	indigo: [0.32, 0.25, 1], azure: [0.4, 0.8, 1],
	poison: [0.55, 0.95, 0.15], acid: [0.85, 1, 0.2], ash: [0.85, 0.62, 0.35], soul: [0.75, 1, 0.9],
	ghost: [0.55, 0.95, 0.8], ghostEdge: [0.25, 0.7, 0.55],
	volt: [0.82, 0.92, 1], arc: [0.42, 0.62, 1], plasma: [0.72, 0.5, 1],
	clock: [1, 0.85, 0.45], gear: [0.55, 0.95, 1], crystal: [0.85, 0.75, 1], rewind: [0.95, 0.5, 1],
	fire: [1, 0.5, 0.12], flameCore: [1, 0.85, 0.4], frost: [0.7, 0.92, 1], rain: [0.55, 0.72, 0.95],
	// (the ink's colours: dark smoke laid over the scene)
	inkShadow: [0.05, 0.02, 0.09], inkVoid: [0.02, 0.01, 0.06], inkBlight: [0.05, 0.1, 0.02], inkStorm: [0.08, 0.09, 0.12], inkSmoke: [0.09, 0.07, 0.06], inkBlood: [0.12, 0.0, 0.01], inkAsh: [0.15, 0.12, 0.1],
};

export const LOOK = {
	// ===== Radiance: holy light, stars and spears =====
	sunspark: {
		cast: (fx, h) => fx.burst(h, C.sun, 8, 1.6, 0.25, 0.2, 0.2, STAR),
		trail: (fx, p, d, s) => { trailOf(fx, p, d, s, C.white, C.gold, 0.85, STAR, 3); if (Math.random() < 0.7) embers(fx, p, C.gold, 1, 0.8, 0.6, 0.12, 1); },
		hit: (fx, at, d) => { slam(fx, at, d, C.sun, C.gold, 0.9); fx.burst(at, C.sun, 12, 5, 0.4, 0.4, 0.6, STAR); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.22, 0.8, 3.4, C.white, 1, 0, 0, STAR); },
	},
	'lance-of-dawn': {
		// (three spears out of the sun, point first; by night out of the moon, in silver)
		cast: (fx, h) => fx.emit(h.x, h.y, h.z, 0, 0, 0, 0.25, 0.2, 0.9, C.white, 1, 0, 0, STAR),
		tell: (fx, at, r, u, night) => fx.decal(at, r * 0.3, r * 0.75, 0.5, night ? C.moon : C.gold, 0.8, RING),
		fall: (fx, p, d, night) => {
			const edge = night ? C.moon : C.gold, len = 7;
			// the point, then the shaft trailing back up toward the sky it came from
			fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.06, 0.9, 0.9, C.white, 1, 0, 0, O('shard', { rot: Math.atan2(d.x, d.y) }));
			spear(fx, p, { x: -d.x, y: -d.y, z: -d.z }, len, 0.32, C.white, edge, 0.06);
			fx.seg(p, { x: p.x + d.x * len * 2.2, y: p.y + d.y * len * 2.2, z: p.z + d.z * len * 2.2 }, edge, 0.12, 0.12, 0.5);
			for (let k = 1; k <= 4; k++) { const u = k / 4; fx.emit(p.x + d.x * len * u, p.y + d.y * len * u, p.z + d.z * len * u, 0, 0, 0, 0.07 + u * 0.12, 0.5 - u * 0.3, 0.08, edge, 0.5 - u * 0.3, 0, 0, ORB); }
			if (Math.random() < 0.7) fx.emit(p.x + d.x * len * Math.random(), p.y + d.y * len * Math.random(), p.z + d.z * len * Math.random(), rnd(0.5), rnd(0.5), rnd(0.5), 0.5, 0.16, 0.03, edge, 1, 0, 0.5, STAR);
		},
		blast: (fx, at, r, night) => {
			const edge = night ? C.moon : C.gold;
			// (the spear stands where it struck, for a moment)
			const top = { x: at.x + rnd(0.3), y: at.y + 3.2, z: at.z + rnd(0.3) };
			fx.seg(at, top, edge, 0.3, 1.1, 0.9); fx.seg(at, top, C.white, 0.12, 1.1);
			fx.emit(at.x, at.y + 0.5, at.z, 0, 0, 0, 0.25, 0.8, 3, C.white, 1, 0, 0, STAR);
			slam(fx, { x: at.x, y: at.y + 0.4, z: at.z }, { x: 0, y: -1, z: 0 }, C.white, edge, 1.3);
			wave(fx, at, r * 1.2, edge, 0.5);
			fx.decal(at, r * 0.5, r * 0.6, 1.2, edge, 0.7, O('star', { spin: 0.5 }));
			fx.burst(at, edge, 18, r * 1.8, 0.45, 0.28, 2, STAR);
		},
	},
	'solar-flare': {
		// (a column of light out of the sun's place in the sky, narrowing onto its mark as it charges;
		// by night out of the moon, in silver)
		tell: (fx, at, r, u, night) => { if (u < 0.12) fx.decal(at, r, r * 0.9, 0.6, night ? C.moon : C.amber, 0.8, O('rune', { spin: 2 })); if (Math.random() < 0.5) { const a = Math.random() * 6.283; fx.emit(at.x + Math.cos(a) * r, at.y + 0.2, at.z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0.5, -Math.sin(a) * r * 2, 0.45, 0.3, 0.1, night ? C.moon : C.gold, 1, 0, 0, STREAK); } },
		beam: (fx, from, to, u, night) => {
			const w = 2.4 - (u || 0) * 1.2, c = night ? C.moon : C.amber;
			fx.line(from, to, c, w * 0.5, 0.13, w, 0, ORB);
			fx.line(from, to, night ? C.white : C.sun, w * 0.6, 0.13, w * 0.45, 0, ORB);
			fx.emit(to.x, to.y + 0.3, to.z, 0, 0, 0, 0.13, w * 2, w * 2.4, c, 0.9, 0, 0, ORB);
		},
		blast: (fx, at, r, night) => {
			const c = night ? C.moon : C.amber, g = night ? C.ice : C.gold;
			fx.emit(at.x, at.y + 1, at.z, 0, 0, 0, 0.35, 1, r * 1.6, C.white, 1, 0, 0, ORB);
			fx.emit(at.x, at.y + 1, at.z, 0, 0, 0, 0.5, r * 0.6, r * 2.2, c, 1, 0, 0, RING);
			// (rays, as from a sun)
			for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; fx.line({ x: at.x, y: at.y + 1, z: at.z }, { x: at.x + Math.cos(a) * r * 1.4, y: at.y + 1 + rnd(0.6), z: at.z + Math.sin(a) * r * 1.4 }, g, 0.5, 0.3, 0.25, 0, STAR); }
			fx.burst(at, night ? C.moon : C.sun, 40, r * 1.6, 0.7, 0.35, 1.2, STAR);
			fx.decal(at, r * 0.8, r * 1.3, 0.9, c, 0.8, O('star', { spin: 1 }));
		},
	},
	judgement: {
		tell: (fx, at, r, u) => { if (u < 0.08) sigil(fx, at, r, C.gold, C.sun, 1.6, 0, 8); fx.pillar(at, 40, C.sun, 2, 0.2, 0.12, false, STREAK); },
		blast: (fx, at, r) => {
			// (a sword of light falls from the sky)
			const hilt = { x: at.x, y: at.y + 9, z: at.z }, sky = { x: at.x, y: at.y + 40, z: at.z };
			fx.seg(sky, at, C.gold, 1.6, 0.45, 0.8); fx.seg(sky, at, C.white, 0.6, 0.45);
			fx.seg({ x: hilt.x - 2.6, y: hilt.y, z: hilt.z }, { x: hilt.x + 2.6, y: hilt.y, z: hilt.z }, C.gold, 0.7, 0.6); fx.seg({ x: hilt.x, y: hilt.y, z: hilt.z - 2.6 }, { x: hilt.x, y: hilt.y, z: hilt.z + 2.6 }, C.gold, 0.7, 0.6);
			slam(fx, { x: at.x, y: at.y + 0.5, z: at.z }, { x: 0, y: -1, z: 0 }, C.white, C.gold, 2.2);
			for (let k = 0; k < 12; k++) fx.emit(at.x + rnd(0.25), at.y + 40 - k * 3, at.z + rnd(0.25), 0, -60, 0, 0.35, 0.8, 0.35, k % 3 ? C.white : C.gold, 1, 0, 0, STREAK);
			for (let k = 0; k < 6; k++) fx.emit(at.x, at.y + 1 + k * 2.5, at.z, 0, -3, 0, 0.6, 1.4, 3, C.sun, 0.8, 0, 0, RING);
			wave(fx, at, r * 1.4, C.white, 0.5);
			fx.burst(at, C.gold, 60, 9, 1, 0.5, 2, STAR);
			fx.decal(at, r * 1.1, r * 1.2, 1.4, C.gold, 1, O('rune', { spin: 0.3 }));
		},
	},
	// ===== Restoration: crosses, petals, a green sigil, a phoenix =====
	mend: {
		// (a hard cross of light stands up through you, mint spikes driven up round your feet)
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; fx.emit(at.x + Math.cos(a) * 0.6, at.y - 0.9, at.z + Math.sin(a) * 0.6, -Math.sin(a) * 1.2, 2 + Math.random(), Math.cos(a) * 1.2, 1, 0.4, 0.15, k % 2 ? C.leafG : C.mint, 1, 0, 1.2, CROSS); } fx.seg({ x: at.x, y: at.y - 1.6, z: at.z }, { x: at.x, y: at.y + 0.9, z: at.z }, C.white, 0.07, 0.45); fx.seg({ x: at.x - 0.75, y: at.y + 0.1, z: at.z }, { x: at.x + 0.75, y: at.y + 0.1, z: at.z }, C.white, 0.07, 0.45); fx.seg({ x: at.x, y: at.y + 0.1, z: at.z - 0.75 }, { x: at.x, y: at.y + 0.1, z: at.z + 0.75 }, C.mint, 0.05, 0.45); spikes(fx, g, 0.8, 8, 0.7, C.leafG, C.white, 0.5, 0.08); fx.flash?.({ x: at.x, y: at.y - 0.4, z: at.z }, C.mint, 0.18); fx.decal(g, 0.4, 1.2, 0.8, C.leafG, 0.7, CROSS); },
	},
	renewal: {
		// (life runs up through you: hard green threads spiralling up your body, petals thrown out)
		self: (fx, at) => { fx.burst({ x: at.x, y: at.y - 0.6, z: at.z }, C.petal, 18, 2, 1.4, 0.35, 1, LEAF); for (const s of [0, Math.PI]) { let p0 = null; for (let k = 0; k <= 16; k++) { const u = k / 16, a = s + u * 9, r = 0.7 - u * 0.25, p = { x: at.x + Math.cos(a) * r, y: at.y - 1.6 + u * 2.2, z: at.z + Math.sin(a) * r }; if (p0) fx.seg(p0, p, k % 4 ? C.leafG : C.white, 0.04, 0.45 + u * 0.3); p0 = p; } } for (let k = 0; k < 10; k++) fx.spark(at.x + rnd(0.6), at.y - 1.6, at.z + rnd(0.6), 0, 4 + Math.random() * 3, 0, 0.45, 0.05, 0.04, C.mint, 1, 0, 1); },
		on: (fx, at) => { if (Math.random() < 0.5) { const a = Math.random() * 6.283; fx.emit(at.x + Math.cos(a) * 0.7, at.y - 1.4, at.z + Math.sin(a) * 0.7, -Math.sin(a) * 0.5, 0.9, Math.cos(a) * 0.5, 1.8, 0.32, 0.18, Math.random() < 0.5 ? C.petal : C.leafG, 0.95, 0, 0.3, LEAF); } },
	},
	sanctuary: { tick: (fx, at, r, t) => { sigil(fx, at, r, C.leafG, C.mint, 0.35, t * 0.5, 6); for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283; fx.emit(at.x + Math.cos(a) * r, at.y + 0.2, at.z + Math.sin(a) * r, 0, 2.5, 0, 0.8, 0.35, 0.15, C.mint, 0.9, 0, 0, STREAK); } } },
	resurgence: {
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; for (const s of [-1, 1]) for (let k = 0; k < 20; k++) { const u = k / 20; fx.emit(at.x, at.y - 0.4, at.z, s * (0.6 + u * 2.6), 1 + Math.sin(u * 3.1) * 2.2, rnd(0.3), 1.3, 0.9 - u * 0.35, 0.15, k % 2 ? C.phoenix : C.gold, 1, -0.5, 1.6, FLAME); } for (const s of [-1, 1]) { let p0 = null; for (let k = 0; k <= 10; k++) { const u = k / 10, p = { x: at.x + s * u * 3, y: at.y - 0.4 + Math.sin(u * 3.1) * 1.3, z: at.z }; if (p0) fx.seg(p0, p, k % 3 ? C.gold : C.white, 0.05, 0.4 + u * 0.3); p0 = p; } } spikes(fx, g, 1.1, 12, 1.2, C.phoenix, C.gold, 0.6, 0.1); cracks(fx, g, 2.4, 9, C.gold, 0.6); fx.flash?.({ x: at.x, y: at.y - 0.4, z: at.z }, C.phoenix, 0.25); fx.decal(g, 0.6, 2.4, 1, C.phoenix, 0.8, O('star')); },
		on: (fx, at, t) => { for (let k = 0; k < 2; k++) { const a = t * 2 + k * 3.14; fx.emit(at.x + Math.cos(a) * 0.45, at.y + 0.45, at.z + Math.sin(a) * 0.45, 0, 0.3, 0, 0.35, 0.22, 0.06, C.phoenix, 0.9, 0, 0, FLAME); } },
	},
	// ===== Warding: hexagons, a crown of flame, a white gale =====
	aegis: {
		// (the ward slams shut round you: plates of light, their edges struck hard as they lock)
		self: (fx, at) => { for (let k = 0; k < 30; k++) { const a = k / 10 * 6.283 / 3, e = (Math.floor(k / 10) - 1) * 0.6; fx.emit(at.x + Math.cos(a) * Math.cos(e) * 1.1, at.y - 0.6 + Math.sin(e) * 1.1, at.z + Math.sin(a) * Math.cos(e) * 1.1, 0, 0, 0, 1, 0.7, 0.75, C.ward, 0.9, 0, 0, HEX); } for (const e of [-0.6, 0, 0.6]) { let p0 = null; for (let k = 0; k <= 12; k++) { const a = k / 12 * 6.283, p = { x: at.x + Math.cos(a) * Math.cos(e) * 1.15, y: at.y - 0.6 + Math.sin(e) * 1.15, z: at.z + Math.sin(a) * Math.cos(e) * 1.15 }; if (p0) fx.seg(p0, p, k % 2 ? C.ward : C.white, 0.03, 0.35); p0 = p; } } fx.flash?.({ x: at.x, y: at.y - 0.6, z: at.z }, C.ward, 0.2); },
		on: (fx, at, t) => { if (Math.random() < 0.6) { const a = t * 1.2 + Math.random() * 6.283, e = rnd(0.8); fx.emit(at.x + Math.cos(a) * Math.cos(e) * 1.1, at.y - 0.6 + Math.sin(e) * 1.1, at.z + Math.sin(a) * Math.cos(e) * 1.1, 0, 0, 0, 0.6, 0.55, 0.6, C.ward, 0.5, 0, 0, HEX); } },
	},
	'radiant-aura': { tick: (fx, at, r, t) => { for (let k = 0; k < 16; k++) { const a = t * 2.2 + k / 16 * 6.283; fx.emit(at.x + Math.cos(a) * r, at.y + 0.1, at.z + Math.sin(a) * r, 0, 1.8, 0, 0.5, 0.85, 0.2, k % 2 ? C.amber : C.gold, 1, 0, 0, FLAME); } for (let k = 0; k < 6; k++) { const a = -t * 1.6 + k / 6 * 6.283 + rnd(0.2), h = 0.5 + Math.random() * 0.6; fx.seg({ x: at.x + Math.cos(a) * r, y: at.y + 0.05, z: at.z + Math.sin(a) * r }, { x: at.x + Math.cos(a) * r * 0.96, y: at.y + h, z: at.z + Math.sin(a) * r * 0.96 }, k % 3 ? C.gold : C.white, 0.08, 0.45); } fx.decal(at, r * 0.95, r * 1.05, 0.3, C.amber, 0.5, RING); } },
	bulwark: {
		self: (fx, at) => { for (let i = 0; i < 5; i++) for (let k = 0; k < 14 - i * 2; k++) { const a = k / (14 - i * 2) * 6.283, e = i / 5 * 1.4, r = 1.6; fx.emit(at.x + Math.cos(a) * Math.cos(e) * r, at.y - 1.5 + Math.sin(e) * r, at.z + Math.sin(a) * Math.cos(e) * r, 0, 0, 0, 1.4, 0.75, 0.8, i % 2 ? C.white : C.sky, 0.9, 0, 0, HEX); } for (let m = 0; m < 8; m++) { const a = m / 8 * 6.283; let p0 = null; for (let k = 0; k <= 6; k++) { const e = k / 6 * 1.5708, p = { x: at.x + Math.cos(a) * Math.cos(e) * 1.65, y: at.y - 1.5 + Math.sin(e) * 1.65, z: at.z + Math.sin(a) * Math.cos(e) * 1.65 }; if (p0) fx.seg(p0, p, m % 2 ? C.sky : C.white, 0.06, 0.6); p0 = p; } } const g = { x: at.x, y: at.y - 1.68, z: at.z }; cracks(fx, g, 2.6, 8, C.sky, 0.5); fx.flash?.({ x: at.x, y: at.y - 0.8, z: at.z }, C.sky, 0.2); fx.decal(g, 1.8, 2, 3.5, C.sky, 0.7, O('hex', { spin: 0.4 })); },
		on: (fx, at, t) => { if (Math.random() < 0.7) { const a = t * 0.8 + Math.random() * 6.283, e = Math.random() * 1.3; fx.emit(at.x + Math.cos(a) * Math.cos(e) * 1.6, at.y - 1.5 + Math.sin(e) * 1.6, at.z + Math.sin(a) * Math.cos(e) * 1.6, 0, 0, 0, 0.5, 0.7, 0.7, C.sky, 0.55, 0, 0, HEX); } },
	},
	banish: { blast: (fx, at, r) => { for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283 + rnd(0.05), v = r / 0.35 * (0.6 + Math.random() * 0.4); fx.emit(at.x + Math.cos(a) * 0.6, at.y + 0.3 + Math.random() * 1.4, at.z + Math.sin(a) * 0.6, Math.cos(a) * v, 0.4, Math.sin(a) * v, 0.45, 0.4, 1.1, k % 3 ? C.white : C.ward, 0.9, 0, 1, O('streak', { rot: 1.5708 })); } wave(fx, at, r * 0.8, C.white, 0.45, 0.5); fx.decal(at, r * 0.3, r * 0.65, 0.6, C.ward, 0.55, HEX); } },
	// ===== Dawn: rose and peach, a small sun, wind, water =====
	lumen: {
		// (a small hard sun at your shoulder, four rays turning round it)
		on: (fx, at, t, d) => { const x = at.x - d.z * 0.5, y = at.y + 0.35, z = at.z + d.x * 0.5; fx.emit(x, y, z, 0, 0, 0, 0.12, 0.42, 0.36, C.sun, 1, 0, 0, ORB); for (let k = 0; k < 4; k++) { const a = t * 2.4 + k * 1.5708, r = k % 2 ? 0.32 : 0.42; fx.seg({ x: x + Math.cos(a) * 0.12, y: y + Math.sin(a) * 0.12, z }, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z }, k % 2 ? C.peach : C.white, 0.025, 0.05); } if (Math.random() < 0.15) fx.emit(x, y, z, 0, 0, 0, 0.3, 0.3, 0.9, C.peach, 0.5, 0, 0, O('star', { rot: t })); },
	},
	dawnsight: { self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; fx.ring({ x: at.x, y: at.y - 1.5, z: at.z }, 30, C.rose, 70, 1.2, 0.45, STAR); wave(fx, g, 14, C.peach, 1.4, 0.35); fx.decal(g, 1.2, 1.4, 1.2, C.rose, 0.8, O('rune', { spin: 1 })); } },
	swiftstride: {
		// (hard wind lines cut back from your heels as you run)
		on: (fx, at, t, d, moving) => { if (!moving) return; for (const s of [-1, 1]) { const x = at.x - d.z * 0.3 * s - d.x * 0.3, y = at.y - 1.4 + Math.random() * 0.6, z = at.z + d.x * 0.3 * s - d.z * 0.3, l = 0.6 + Math.random() * 0.6; if (Math.random() < 0.7) fx.seg({ x, y, z }, { x: x - d.x * l, y, z: z - d.z * l }, Math.random() < 0.3 ? C.white : C.wind, 0.025, 0.16); } if (Math.random() < 0.4) fx.emit(at.x - d.x * 0.3, at.y - 1.2, at.z - d.z * 0.3, -d.x * 4, 0.2, -d.z * 4, 0.3, 0.45, 0.08, C.wind, 0.7, 0, 0.5, O('streak', { rot: 1.5708 })); },
	},
	waterstride: {
		// (each step on the water throws up a crown of hard droplet lines and a ring)
		on: (fx, at, t, d, moving) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; if (Math.random() < (moving ? 0.25 : 0.05)) { fx.decal(g, 0.2, 1.6, 1, C.water, 0.9, RING); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + rnd(0.3), r = 0.35 + Math.random() * 0.15; fx.seg({ x: g.x + Math.cos(a) * 0.15, y: g.y + 0.02, z: g.z + Math.sin(a) * 0.15 }, { x: g.x + Math.cos(a) * r, y: g.y + 0.3 + Math.random() * 0.25, z: g.z + Math.sin(a) * r }, k % 3 ? C.water : C.white, 0.025, 0.25); } } if (Math.random() < 0.2) fx.emit(at.x + rnd(0.3), at.y - 1.6, at.z + rnd(0.3), rnd(0.8), 1.2, rnd(0.8), 0.5, 0.12, 0.05, C.water, 1, 5, 0, ORB); },
	},
	daybreak: { self: (fx, at) => { for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; fx.line({ x: at.x, y: at.y + 2, z: at.z }, { x: at.x + Math.cos(a) * 9, y: at.y + 2 + Math.abs(Math.sin(a)) * 6, z: at.z + Math.sin(a) * 9 }, k % 2 ? C.rose : C.peach, 0.6, 1.2, 0.3, 0, STAR); } fx.emit(at.x, at.y + 3, at.z, 0, 1, 0, 1.6, 1, 6, C.sun, 0.8, 0, 0, ORB); } },
	'sunwell-gate': { self: (fx, at) => { for (let k = 0; k < 36; k++) { const a = k / 36 * 6.283; fx.emit(at.x + Math.cos(a) * 1.4, at.y - 0.3 + Math.sin(a) * 1.8, at.z, 0, 0, 0, 1, 0.45, 0.1, k % 2 ? C.gold : C.sun, 1, 0, 0, STAR); } fx.pillar({ x: at.x, y: at.y - 1.6, z: at.z }, 6, C.sun, 60, 1, 0.45, true, STREAK); let p0 = null; for (let k = 0; k <= 24; k++) { const a = k / 24 * 6.283, p = { x: at.x + Math.cos(a) * 1.4, y: at.y - 0.3 + Math.sin(a) * 1.8, z: at.z }; if (p0) fx.seg(p0, p, k % 3 ? C.gold : C.white, 0.06, 0.8); if (k % 2 === 0) fx.seg(p, { x: at.x + Math.cos(a) * 2.1, y: at.y - 0.3 + Math.sin(a) * 2.6, z: at.z }, C.sun, 0.035, 0.35); p0 = p; } const g = { x: at.x, y: at.y - 1.68, z: at.z }; cracks(fx, g, 3, 10, C.gold, 0.7); fx.flash?.({ x: at.x, y: at.y - 0.3, z: at.z }, C.sun, 0.25); fx.decal(g, 1.6, 1.8, 1.4, C.gold, 0.9, O('rune', { spin: 1.5 })); } },
	// ===== Shadow: black smoke round violet hearts, red eyes, a black sun =====
	shadowbolt: {
		cast: (fx, h) => inkPuff(fx, h, C.inkShadow, 3, 0.1, 0.4, 0.6, 0.6, C.violet),
		trail: (fx, p, d, s) => { spear(fx, p, d, Math.max(1.8, s * 2.2), 0.3, C.lilac, C.violet); smokeTrail(fx, p, d, s, C.inkShadow, C.violet, 0.7, 2); fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.08, 0.5, 0.45, C.violet, 1, 0, 0, ORB); if (Math.random() < 0.6) fx.emit(p.x, p.y, p.z, rnd(1), rnd(1), rnd(1), 0.35, 0.18, 0.03, C.lilac, 1, 0, 1, ORB); },
		hit: (fx, at, d) => { slam(fx, at, d, C.lilac, C.violet, 1); inkPuff(fx, at, C.inkShadow, 10, 0.6, 1.2, 1.2, 0.75, C.violet); fx.burst(at, C.violet, 10, 3.5, 0.45, 0.35, 0.3); },
	},
	// (a tear in the air where you stood, its edges jagged, the dark sucked into it and sparks thrown off)
	shadowstep: { self: (fx, at) => { const g = { x: at.x, y: at.y - 0.8, z: at.z }; for (let k = 0; k < 3; k++) fx.line({ x: at.x + rnd(0.15), y: at.y - 1.68, z: at.z + rnd(0.15) }, { x: at.x + rnd(0.15), y: at.y + 0.5, z: at.z + rnd(0.15) }, k ? C.violet : C.white, 0.4, 0.35, 0.09, 0.4); inkPuff(fx, g, C.inkShadow, 10, 0.6, 1.2, 1.2, 0.8, C.violet); for (let k = 0; k < 16; k++) { const a = Math.random() * 6.283, v = 6 + Math.random() * 6; fx.spark(at.x, at.y - 0.8 + rnd(0.8), at.z, Math.cos(a) * v, rnd(2), Math.sin(a) * v, 0.25, 0.05, 0.06, k % 3 ? C.violet : C.lilac, 1, 0, 4); } fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 0.3, 1.4, 0.9, C.violet, 0.8, RING); } },
	'umbral-cloak': {
		// (the dark wraps you: shards of it spiral up round you and a hard violet ring snaps shut)
		self: (fx, at) => { inkPuff(fx, { x: at.x, y: at.y - 0.8, z: at.z }, C.inkShadow, 12, 0.8, 1.4, 1.6, 0.75, C.lilac); for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283, r = 1.2; fx.spark(at.x + Math.cos(a) * r, at.y - 1.6, at.z + Math.sin(a) * r, -Math.sin(a) * 4 - Math.cos(a) * 1.5, 5 + Math.random() * 3, Math.cos(a) * 4 - Math.sin(a) * 1.5, 0.45, 0.06, 0.06, k % 3 ? C.violet : C.lilac, 1, 0, 1); } fx.emit(at.x, at.y - 1.6, at.z, 0, 0, 0, 0.25, 2.8, 0.4, C.lilac, 1, 0, 0, RING); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 1.4, 0.6, 1.4, C.violet, 0.6, O('smoke', { spin: 1 })); },
		on: (fx, at) => { if (Math.random() < 0.5) { const x = at.x + rnd(0.5), y = at.y - 1.2 + Math.random() * 0.8, z = at.z + rnd(0.5); fx.emit(x, y, z, 0, 0.6, 0, 1, 0.35, 0.9, C.inkShadow, 0.4, 0, 0, SMOKE); fx.emit(x, y, z, 0, 0.6, 0, 0.8, 0.3, 0.8, C.violet, 0.12, 0, 0, GLOWSMOKE); } },
	},
	'night-terror': {
		// (a dark that lunges: smoke torn forward, red eyes in it, and great claws raking the whole cone)
		cone: (fx, o, d, range, angle) => {
			for (let k = 0; k < 14; k++) { const a = ang(d.x, d.z) + rnd(angle), v = range / 0.6 * (0.4 + Math.random() * 0.6); fx.emit(o.x, o.y - 0.4, o.z, Math.sin(a) * v, rnd(0.6), Math.cos(a) * v, 0.7, 0.5, 2.0, C.inkShadow, 0.75, 0, 1.4, SMOKE); }
			for (let k = 0; k < 8; k++) { const a = ang(d.x, d.z) + rnd(angle), v = range / 0.6 * (0.4 + Math.random() * 0.6); fx.emit(o.x, o.y - 0.3, o.z, Math.sin(a) * v, rnd(0.4), Math.cos(a) * v, 0.8, 0.5, 0.5, C.redEye, 1, 0, 1.2, EYES); }
			// (the claws: three sets of four, each a curved stroke laid across the cone at its reach)
			for (let c = 0; c < 3; c++) {
				const a0 = ang(d.x, d.z) + rnd(angle * 0.6), dist = range * (0.35 + c * 0.22), cx = o.x + Math.sin(a0) * dist, cz = o.z + Math.cos(a0) * dist, tilt = rnd(0.6), sx = Math.cos(a0), sz = -Math.sin(a0), half = 1.6 + c * 0.5;
				for (let j = -1.5; j <= 1.5; j++) {
					const off = j * 0.38, y0 = o.y - 0.4 + half * 0.45 + tilt, y1 = o.y - 1.2 - half * 0.25 - tilt;
					fx.seg({ x: cx + sx * (half + off), y: y0 + off * 0.3, z: cz + sz * (half + off) }, { x: cx - sx * (half - off), y: y1 + off * 0.3, z: cz - sz * (half - off) }, j === -0.5 ? C.white : C.redEye, 0.22, 0.45 + c * 0.08, 1, 1);
				}
				for (let k = 0; k < 6; k++) fx.spark(cx, o.y - 0.4, cz, rnd(8), rnd(4), rnd(8), 0.2, 0.04, 0.06, C.blood, 1, 6, 3);
			}
		},
		mark: (fx, T) => { if (Math.random() < 0.25) fx.emit(T.bound.x + rnd(0.3), T.bound.y + 0.6, T.bound.z + rnd(0.3), 0, 0.5, 0, 0.5, 0.3, 0.3, C.redEye, 1, 0, 0, EYES); },
	},
	eclipse: {
		tell: (fx, at, r, u) => {
			const c = { x: at.x, y: at.y + 2.2, z: at.z };
			fx.emit(c.x, c.y, c.z, 0, 0, 0, 0.12, r * 0.5 * (0.4 + u), r * 0.5 * (0.4 + u), C.inkVoid, 0.95, 0, 0, DARK_ORB);
			fx.emit(c.x, c.y, c.z, 0, 0, 0, 0.12, r * 0.55 * (0.4 + u), r * 0.55 * (0.4 + u), C.corona, 0.9, 0, 0, RING);
			// (the corona: hard rays licking out round the black disc, longer as it gathers)
			for (let k = 0; k < 4; k++) { const a = Math.random() * 6.283, r0 = r * 0.27 * (0.4 + u), l = r0 * (1.3 + Math.random() * 1.4 * u); fx.seg({ x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0, z: c.z }, { x: c.x + Math.cos(a) * l, y: c.y + Math.sin(a) * l, z: c.z }, k % 2 ? C.corona : C.white, 0.06, 0.08, 1, 1); }
			if (u < 0.2) fx.decal(at, r * 0.8, r * 0.7, 1, C.corona, 0.4, RING);
		},
		blast: (fx, at, r) => {
			const c = { x: at.x, y: at.y + 2.2, z: at.z };
			slam(fx, { x: at.x, y: at.y + 1, z: at.z }, null, C.corona, C.violet, 1.6);
			// (the disc bursts: its corona flung out as a ring of spears, the ground split under it)
			for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283 + rnd(0.1), v = r * 6; fx.spark(c.x, c.y, c.z, Math.cos(a) * v, Math.sin(a) * v * 0.6, Math.sin(a) * v * 0.4 + rnd(4), 0.3, 0.06, 0.12, k % 3 ? C.corona : C.white, 1, 0, 2); }
			fx.emit(c.x, c.y, c.z, 0, 0, 0, 0.5, r * 0.5, r * 1.6, C.corona, 0.85, 0, 0, RING);
			fx.emit(c.x, c.y, c.z, 0, 0, 0, 0.3, r * 0.2, r * 0.9, C.white, 1, 0, 0, RING);
			cracks(fx, at, r * 1.1, 9, C.corona, 0.6, 0.09);
			inkPuff(fx, at, C.inkShadow, 12, r * 0.5, 1.6, 1.2, 0.7, C.violet);
			wave(fx, at, r * 0.9, C.corona, 0.6, 0.45);
		},
		mark: (fx, T) => { if (Math.random() < 0.3) fx.emit(T.bound.x, T.bound.y + 0.9, T.bound.z, 0, 0, 0, 0.25, 0.6, 0.6, C.corona, 0.7, 0, 0, RING); },
	},
	// ===== Void: crystal shards, warped rings, a black heart =====
	'void-shard': {
		cast: (fx, h) => fx.burst(h, C.azure, 8, 1.6, 0.3, 0.22, 0, SHARD),
		trail: (fx, p, d, s) => { spear(fx, p, d, 1.2, 0.4, C.white, C.azure); fx.seg({ x: p.x - d.x * 2.6, y: p.y - d.y * 2.6, z: p.z - d.z * 2.6 }, p, C.indigo, 0.12, 0.08); fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.07, 0.9, 0.9, C.azure, 1, 0, 0, O('shard', { rot: Math.atan2(-d.x, d.y || 1e-3) })); for (let k = 0; k < 3; k++) fx.emit(p.x - d.x * s * k / 3, p.y - d.y * s * k / 3, p.z - d.z * s * k / 3, rnd(0.6), rnd(0.6), rnd(0.6), 0.6, 0.26, 0.05, C.indigo, 1, 0, 0.5, SHARD); },
		hit: (fx, at, d) => { slam(fx, at, d, C.azure, C.indigo, 1); fx.burst(at, C.azure, 16, 7, 0.5, 0.35, 0.3, SHARD); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.3, 0.4, 2.2, C.indigo, 1, 0, 0, RING); },
	},
	repulse: { cone: (fx, o, d, range) => { for (let k = 0; k < 26; k++) { const a = ang(d.x, d.z) + rnd(0.8), v = range / 0.25 * (0.7 + Math.random() * 0.3); fx.spark(o.x, o.y - 0.3 + rnd(0.6), o.z, Math.sin(a) * v, rnd(2), Math.cos(a) * v, 0.3, 0.05, 0.08, k % 3 ? C.azure : C.white, 1, 0, 3); } for (let k = 0; k < 4; k++) fx.emit(o.x + d.x * 1.5, o.y - 0.3, o.z + d.z * 1.5, d.x * range * (1 + k * 0.3), d.y * 2, d.z * range * (1 + k * 0.3), 0.5, 0.6, 3.5 + k, k % 2 ? C.indigo : C.azure, 0.8, 0, 1, RING); for (let k = 0; k < 24; k++) { const a = ang(d.x, d.z) + rnd(0.7), v = range * 2 * (0.5 + Math.random() * 0.5); fx.emit(o.x, o.y - 0.3, o.z, Math.sin(a) * v, rnd(1), Math.cos(a) * v, 0.45, 0.35, 0.08, C.azure, 1, 0, 1, SHARD); } } },
	'gravity-well': {
		tick: (fx, at, r, t) => { fx.spiral(at, r, C.indigo, 12, 0.5, 0.35, 3, true); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.3, r * 0.28, C.inkVoid, 0.9, 0, 0, DARK_ORB); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.36, r * 0.34, C.azure, 0.7, 0, 0, RING); if (Math.random() < 0.25) fx.decal({ x: at.x, y: at.y - 1, z: at.z }, r * 1.1, r * 0.2, 0.7, C.indigo, 0.7, O('rune', { rot: t, spin: -3 })); },
		blast: (fx, at, r) => { slam(fx, at, null, C.azure, C.indigo, 1.5, false); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.35, r * 0.2, r * 2.4, C.azure, 1, 0, 0, RING); fx.burst(at, C.indigo, 50, r * 1.6, 0.6, 0.4, 0, SHARD); wave(fx, { x: at.x, y: at.y - 1, z: at.z }, r * 1.4, C.azure, 0.5); },
	},
	'event-horizon': {
		tick: (fx, at, r, t) => { fx.spiral(at, r, C.violet, 16, 0.6, 0.4, 4, true); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.45, r * 0.42, C.inkVoid, 1, 0, 0, DARK_ORB); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.5, r * 0.5, C.white, 0.85, 0, 0, RING); fx.circle(at, r * 0.7, C.azure, 16, 0.14, 0.22, t * 3, ORB, 0); if (Math.random() < 0.25) fx.decal({ x: at.x, y: at.y - 1, z: at.z }, r * 0.9, r * 0.8, 0.7, C.violet, 0.4, O('ring')); },
		blast: (fx, at, r) => { slam(fx, at, null, C.white, C.violet, 1.8, false); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.5, r * 0.3, r * 2, C.white, 0.85, 0, 0, RING); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.6, r * 0.4, r * 1.6, C.violet, 1, 0, 0, RING); fx.burst(at, C.azure, 70, r * 2, 0.7, 0.4, 0, SHARD); wave(fx, { x: at.x, y: at.y - 1, z: at.z }, r * 1.0, C.violet, 0.6, 0.5); },
		mark: (fx, T) => { if (Math.random() < 0.25) fx.line(T.bound, { x: T.bound.x, y: T.bound.y + 1.2, z: T.bound.z }, C.violet, 0.3, 0.12, 0.14); },
	},
	gargantua: {
		// (a black hole on the horizon, after Interstellar (fx.js blackHole paints it; lens.js bends
		// the sky round it): it rises with u, then feeds: light winds into its disc, the ground round
		// you is torn up, debris lifting in long curves and dust threads racing up into it, each foe it
		// holds frays toward it and is drawn out into a thread when taken; it closes in a white flash,
		// and when the world comes back, embers rain)
		tell: (fx, at, r, u, eye) => { fx.hole(at, r, u, eye); for (let k = 0; k < 6; k++) { const a = Math.random() * 6.283, rr = r * (1.4 + Math.random() * 1.6); fx.spark(at.x + Math.cos(a) * rr, at.y + rnd(r * 0.05), at.z + Math.sin(a) * rr, -Math.sin(a) * rr * 0.8 - Math.cos(a) * rr * 0.5, 0, Math.cos(a) * rr * 0.8 - Math.sin(a) * rr * 0.5, 0.9, 0.5, r * 0.03, k % 2 ? C.accrete : C.ember, 0.9 * u, 0, 0); } },
		tick: (fx, at, r, t, eye, u = 0.5) => {
			fx.hole(at, r, 1, eye);
			// (the disc fed: hard sparks swept round it in the flat of its plane, tipped toward you so its
			// near side passes under the shadow, spiralling in)
			// (the plane of the disc holds the eye, so it is seen edge-on, dipping a little more in front)
			const ex0 = eye ? eye.x - at.x : 0, ez0 = eye ? eye.z - at.z : 1, el = Math.hypot(ex0, ez0) || 1, ex = ex0 / el, ez = ez0 / el, tilt = eye ? (eye.y - at.y) / el : 0;
			for (let k = 0; k < 5; k++) {
				const a = t * 0.8 + k / 5 * 6.283 + rnd(0.3), rr = r * (1.3 + Math.random() * 1.6), sp = rr * 1.1, cx = Math.cos(a), cz = Math.sin(a), near = cx * ex + cz * ez;
				fx.spark(at.x + cx * rr, at.y + near * (rr * tilt - r * 0.25) + rnd(r * 0.03), at.z + cz * rr, -cz * sp - cx * sp * 0.6, 0, cx * sp - cz * sp * 0.6, 1.0, 0.3, r * 0.008, k % 2 ? C.accrete : C.ember, 0.55, 0, 0);
			}
			if (!eye) return;
			// (the pull on the ground round you: dark debris and lit grit torn up and lifting in long
			// curves toward it, faster as it feeds; dust threads of light racing up into it)
			const dx = at.x - eye.x, dz = at.z - eye.z, L = Math.hypot(dx, dz) || 1, fx0 = dx / L, fz0 = dz / L, gy = eye.y - 1.5, pull = 0.6 + u;
			for (let k = 0; k < 8; k++) {
				const a = Math.random() * 6.283, rr = 6 + Math.random() * 44, px = eye.x + Math.cos(a) * rr + fx0 * 14, pz = eye.z + Math.sin(a) * rr + fz0 * 14;
				const dark = k % 2 === 0, s = dark ? 0.5 + Math.random() * 0.6 : 0.25 + Math.random() * 0.3;
				fx.emit(px, gy + Math.random() * 0.8, pz, fx0 * (2 + Math.random() * 4) * pull + rnd(1.2), 1.5 + Math.random() * 3, fz0 * (2 + Math.random() * 4) * pull + rnd(1.2), 3.4 + Math.random() * 1.4, s, s * 0.5, dark ? C.debris : C.grit, dark ? 0.95 : 0.55, -(4 + Math.random() * 5) * pull, 0.15, dark ? (k % 4 ? DEBRIS : DEBRIS_PUFF) : GRIT);
			}
			for (let k = 0; k < 2; k++) {
				const a = Math.random() * 6.283, rr = 16 + Math.random() * 44, px = eye.x + Math.cos(a) * rr + fx0 * 16, pz = eye.z + Math.sin(a) * rr + fz0 * 16;
				const tx = at.x - px, ty = at.y - gy, tz = at.z - pz, l = Math.hypot(tx, ty, tz) || 1, v = (22 + Math.random() * 22) * pull;
				fx.spark(px, gy + 0.3, pz, tx / l * v, ty / l * v * 0.6 + 4, tz / l * v, 1.3, 0.35, 0.03 + Math.random() * 0.02, k ? C.ember : C.accrete, 0.6, -4, 0);
			}
		},
		// (a foe held in its pull: dust and threads of its own torn off and streaming up toward it)
		held: (fx, from, to) => {
			const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, l = Math.hypot(dx, dy, dz) || 1;
			fx.emit(from.x + rnd(0.4), from.y + rnd(0.7), from.z + rnd(0.4), dx / l * 7, dy / l * 7 + 2, dz / l * 7, 0.9, 0.16, 0.05, C.debris, 0.9, -3, 0.2, DEBRIS);
			fx.spark(from.x + rnd(0.3), from.y + rnd(0.6), from.z + rnd(0.3), dx / l * 16, dy / l * 16 + 2, dz / l * 16, 0.5, 0.3, 0.05, C.accrete, 0.8, 0, 0);
		},
		arc: (fx, from, to, r = 10) => {
			// (a foe torn away: drawn out into one long thread of light up into the hole, thin toward it,
			// its dust pulled along the thread, its heart flaring where it stood)
			const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
			fx.seg(to, from, C.accrete, Math.max(0.45, r * 0.02), 0.8, 1, 1);
			fx.seg({ x: from.x + dx * 0.85, y: from.y + dy * 0.85, z: from.z + dz * 0.85 }, from, C.white, Math.max(0.2, r * 0.008), 0.6, 1, 1);
			for (let k = 0; k < 30; k++) { const f = 0.3 + Math.random() * 0.55; fx.emit(from.x + rnd(0.4), from.y + rnd(0.6), from.z + rnd(0.4), dx * f, dy * f, dz * f, 1.6, 0.5, 0.12, k % 2 ? C.accrete : C.white, 1, 0, 0, STREAK); }
			for (let k = 0; k < 10; k++) { const f = 0.15 + Math.random() * 0.35; fx.emit(from.x + rnd(0.5), from.y + rnd(0.8), from.z + rnd(0.5), dx * f, dy * f, dz * f, 1.4, 0.3, 0.08, C.debris, 0.9, 0, 0, DEBRIS); }
			inkPuff(fx, from, C.inkVoid, 6, 0.5, 1.1, 0.9, 0.7, C.accrete);
			fx.emit(from.x, from.y, from.z, 0, 0, 0, 0.12, 0.6, 2.0, C.white, 1, 0, 0, ORB);
			fx.emit(from.x, from.y, from.z, 0, 0, 0, 0.35, 0.4, 2.6, C.accrete, 1, 0, 0, RING);
		},
		blast: (fx, at, r) => { fx.hole(at, r, 0); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.9, r * 1.2, r * 7, C.white, 1, 0, 0, RING); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.6, r * 4, r * 0.5, C.accrete, 1, 0, 0, STAR); for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, v = r * (2 + Math.random() * 3); fx.emit(at.x, at.y, at.z, Math.cos(a) * v, rnd(r * 0.4), Math.sin(a) * v, 1.4, r * 0.2, r * 0.05, k % 2 ? C.accrete : C.white, 1, 0, 0.3, STREAK); } },
		// (the world bursting back after the black: a white flare ahead, and embers raining down
		// through the view, slow and bright, each a little spark of the disc's fire)
		back: (fx, eye, d) => {
			fx.emit(eye.x + d.x * 12, eye.y + d.y * 12 + 2, eye.z + d.z * 12, 0, 0, 0, 0.5, 6, 22, C.white, 0.9, 0, 0, ORB);
			for (let k = 0; k < 70; k++) {
				const f = 4 + Math.random() * 30, a = rnd(1.2), px = eye.x + d.x * f + rnd(f * 0.7) + a, py = eye.y + 3 + Math.random() * 18, pz = eye.z + d.z * f + rnd(f * 0.7);
				fx.spark(px, py, pz, rnd(1.5), -(0.5 + Math.random() * 2), rnd(1.5), 2.5 + Math.random() * 2, 0.25, 0.04 + Math.random() * 0.05, k % 3 ? C.ember : C.accrete, 0.9, 1.2, 0.3);
				if (k % 2 === 0) fx.emit(px, py, pz, rnd(1), -(0.3 + Math.random()), rnd(1), 3 + Math.random() * 2, 0.08, 0.02, C.accrete, 0.8, 0.6, 0.2, ORB);
			}
		},
	},
	// ===== Blight: poison and its fog, ash, souls, spores =====
	'hex-of-decay': {
		trail: (fx, p, d, s) => { trailOf(fx, p, d, s, C.acid, C.poison, 0.5, ORB, 2); smokeTrail(fx, p, d, s, C.inkBlight, C.poison, 0.45, 1); },
		// (the hex bites: thorns of rot punched up out of the ground round them, the rune burnt over them)
		hit: (fx, at, d) => {
			slam(fx, at, d, C.acid, C.poison, 0.9);
			const g = { x: at.x, y: at.y - 1, z: at.z };
			for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + rnd(0.3), r0 = 0.6 + Math.random() * 0.6, h = 1.2 + Math.random() * 1.2; fx.seg({ x: g.x + Math.sin(a) * r0 * 1.6, y: g.y, z: g.z + Math.cos(a) * r0 * 1.6 }, { x: g.x + Math.sin(a) * r0 * 0.5, y: g.y + h, z: g.z + Math.cos(a) * r0 * 0.5 }, k % 2 ? C.poison : C.acid, 0.2, 1.1, 1, 1); }
			inkPuff(fx, at, C.inkBlight, 5, 0.4, 0.9, 1, 0.6, C.poison);
			fx.emit(at.x, at.y + 0.8, at.z, 0, 0.3, 0, 1.2, 1.4, 1.6, C.poison, 0.95, 0, 0, RUNE_STILL);
		},
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.25), T.bound.y + 0.3, T.bound.z + rnd(0.25), 0, -0.2, 0, 0.8, 0.22, 0.1, C.poison, 1, 4, 0.2, DRIP); if (Math.random() < 0.06) fx.emit(T.bound.x, T.bound.y + 1.1, T.bound.z, 0, 0.2, 0, 0.6, 0.6, 0.7, C.poison, 0.8, 0, 0, RUNE_STILL); },
	},
	withering: {
		trail: (fx, p, d, s) => { trailOf(fx, p, d, s, C.amber, C.ash, 0.45, ORB, 2); if (Math.random() < 0.8) fx.emit(p.x, p.y, p.z, rnd(0.4), -0.3, rnd(0.4), 1.2, 0.22, 0.08, C.ash, 1, 1.5, 0.4, LEAF); },
		// (it lands like a drought: the ground cracks dry round them, and they shed a burst of ash
		// and brittle shards)
		hit: (fx, at, d) => { slam(fx, at, d, C.amber, C.ash, 1); cracks(fx, { x: at.x, y: at.y - 1, z: at.z }, 2.6, 7, C.amber, 1.1, 0.08); for (let k = 0; k < 14; k++) fx.spark(at.x, at.y + 0.3, at.z, rnd(6), 1 + Math.random() * 4, rnd(6), 0.45, 0.05, 0.06, k % 2 ? C.ash : C.amber, 1, 12, 1.5); for (let k = 0; k < 12; k++) fx.emit(at.x + rnd(0.5), at.y + 0.8 + rnd(0.4), at.z + rnd(0.5), rnd(0.6), 0.2, rnd(0.6), 1.6, 0.25, 0.1, k % 2 ? C.ash : C.amber, 1, 1.2, 0.5, LEAF); inkPuff(fx, at, C.inkAsh, 4, 0.3, 0.8, 1.2, 0.5, C.ash); },
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.3), T.bound.y + 0.7, T.bound.z + rnd(0.3), rnd(0.2), 0, rnd(0.2), 1.3, 0.2, 0.08, C.ash, 1, 1, 0.4, LEAF); },
	},
	'plague-cloud': {
		// (a sick fog low on the ground, the earth under it cracking green, bubbles bursting and acid
		// needles spitting up out of it)
		tick: (fx, at, r) => {
			for (let k = 0; k < 5; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 0.3 + Math.random() * 0.8, at.z + Math.sin(a) * rr, rnd(0.2), 0.1, rnd(0.2), 2, 1.4, 2.6, C.inkBlight, 0.45, 0, 0.3, SMOKE); }
			for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 0.2 + Math.random() * 0.6, at.z + Math.sin(a) * rr, 0, 0.5, 0, 0.5, 0.12, 0.5, C.acid, 1, 0, 0, RING); }
			for (let k = 0; k < 4; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 0.4 + Math.random() * 0.8, at.z + Math.sin(a) * rr, rnd(0.2), 0.12, rnd(0.2), 1.8, 1.6, 3, C.poison, 0.12, 0, 0.3, GLOWSMOKE); }
			for (let k = 0; k < 12; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.spark(at.x + Math.cos(a) * rr, at.y + 0.1, at.z + Math.sin(a) * rr, rnd(0.8), 6 + Math.random() * 6, rnd(0.8), 0.5, 0.07, 0.08, k % 3 ? C.poison : C.acid, 1, 14, 0.5); }
			if (Math.random() < 0.35) cracks(fx, { x: at.x + rnd(r * 0.5), y: at.y, z: at.z + rnd(r * 0.5) }, r * 0.45, 4, C.poison, 0.9, 0.05);
			fx.decal(at, r * 0.9, r, 0.6, C.poison, 0.35, RING);
		},
	},
	'soul-siphon': {
		beam: (fx, a, b) => {
			// (a hard green core with a strand wound round it, and souls torn out of them streaking
			// back along it to you)
			fx.seg(a, b, C.white, 0.05, 0.06, 1, 0.6);
			fx.seg(a, b, C.poison, 0.14, 0.06, 0.8, 0.3);
			const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz) || 1, t = performance.now() / 120;
			// (the strand: a helix of short strokes, turning)
			const ux = -dz / L, uz = dx / L;
			let px = a.x, py = a.y, pz = a.z;
			for (let k = 1; k <= 14; k++) { const u = k / 14, w = Math.sin(u * Math.PI) * 0.35, q = u * 12 + t; const nx = a.x + dx * u + ux * Math.cos(q) * w, ny = a.y + dy * u + Math.sin(q) * w, nz = a.z + dz * u + uz * Math.cos(q) * w; fx.seg({ x: px, y: py, z: pz }, { x: nx, y: ny, z: nz }, C.soul, 0.05, 0.06); px = nx; py = ny; pz = nz; }
			const v = 30;
			for (let k = 0; k < 3; k++) fx.spark(b.x + rnd(0.3), b.y + rnd(0.3), b.z + rnd(0.3), -dx / L * v + rnd(2), -dy / L * v + rnd(2), -dz / L * v + rnd(2), L / v * 0.9, 0.06, 0.08, k ? C.soul : C.white, 1, 0, 0);
			if (Math.random() < 0.5) { for (let k = 0; k < 4; k++) fx.spark(b.x, b.y, b.z, rnd(6), 2 + Math.random() * 5, rnd(6), 0.25, 0.04, 0.05, C.poison, 1, 10, 2); fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.1, 0.3, 1.1, C.soul, 0.8, 0, 0, RING); }
		},
	},
	contagion: {
		trail: (fx, p, d, s) => { trailOf(fx, p, d, s, C.acid, C.poison, 0.45, ORB, 2); if (Math.random() < 0.7) fx.spark(p.x, p.y, p.z, rnd(3), rnd(3), rnd(3), 0.3, 0.05, 0.05, C.acid, 1, 8, 1); },
		// (it bursts on them: a splash of acid flung out in hard droplets that fall and spatter)
		hit: (fx, at, d) => { slam(fx, at, d, C.acid, C.poison, 1); for (let k = 0; k < 22; k++) fx.spark(at.x, at.y, at.z, rnd(7), 2 + Math.random() * 6, rnd(7), 0.5 + Math.random() * 0.3, 0.06, 0.07, k % 2 ? C.acid : C.poison, 1, 18, 0.8); fx.decal({ x: at.x, y: at.y - 1, z: at.z }, 0.4, 1.6, 1.2, C.poison, 0.8, RING); inkPuff(fx, at, C.inkBlight, 4, 0.3, 0.8, 1, 0.5, C.acid); },
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.3), T.bound.y + 0.4 + Math.random() * 0.6, T.bound.z + rnd(0.3), 0, 0.4, 0, 0.7, 0.14, 0.32, C.acid, 1, 0, 0, RING); },
		// (passing on: a hard green arc leaping to the next)
		spread: (fx, a, b) => { let px = a.x, py = a.y, pz = a.z; for (let k = 1; k <= 10; k++) { const u = k / 10, nx = a.x + (b.x - a.x) * u, ny = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 1.4, nz = a.z + (b.z - a.z) * u; fx.seg({ x: px, y: py, z: pz }, { x: nx, y: ny, z: nz }, k % 3 ? C.acid : C.white, 0.08, 0.4); px = nx; py = ny; pz = nz; } slam(fx, b, null, C.acid, C.poison, 0.5, false); },
	},
	// ===== Umbral: spectres and a blood sigil =====
	nightsight: {
		// (an eye of hard violet lines opens round your head and the dark cracks open round you)
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; wave(fx, g, 22, C.lilac, 1.2, 0.6); fx.burst({ x: at.x, y: at.y - 0.2, z: at.z }, C.violet, 14, 1, 0.7, 0.4, 0, EYES); for (const s of [0, 1]) { let p0 = null; for (let k = 0; k <= 16; k++) { const a = k / 16 * 6.283, p = { x: at.x + Math.cos(a) * (s ? 0.45 : 1.1), y: at.y + 0.1, z: at.z + Math.sin(a) * (s ? 1.1 : 0.45) }; if (p0) fx.seg(p0, p, k % 4 ? C.violet : C.white, 0.035, 0.6); p0 = p; } } cracks(fx, g, 3, 10, C.lilac, 0.7); fx.flash?.({ x: at.x, y: at.y, z: at.z }, C.violet, 0.2); fx.decal(g, 1, 1.1, 1, C.lilac, 0.7, EYES); },
	},
	shade: {
		// (it tears up out of the ground: a ring of dark spikes, the earth split, then the shade)
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; spikes(fx, g, 1, 7, 1.6, C.violet, C.white, 0.6, 0.12); cracks(fx, g, 2.2, 6, C.violet, 0.8, 0.06); inkPuff(fx, { x: at.x, y: at.y - 1.4, z: at.z }, C.inkShadow, 8, 0.6, 1, 1.2, 0.6, C.violet); fx.decal(g, 0.4, 1.3, 1, C.violet, 0.7, RUNE_STILL); },
		body: (fx, p, t) => wraith(fx, p, C.lilac, C.violet, C.inkShadow, t, 1),
	},
	'grave-host': {
		// (the dead rise: grave dust from the ground, pale green ghosts)
		self: (fx, at) => { for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; const g = { x: at.x + Math.cos(a) * 1.6, y: at.y - 1.68, z: at.z + Math.sin(a) * 1.6 }; inkPuff(fx, g, C.inkAsh, 5, 0.4, 0.8, 1.2, 0.5, C.ghost); spikes(fx, g, 0.5, 5, 1.4, C.ghost, C.white, 0.7, 0.1); cracks(fx, g, 1.4, 4, C.ghost, 0.9, 0.05); fx.pillar(g, 2.4, C.ghost, 12, 0.7, 0.4, true, STREAK); fx.decal(g, 0.3, 0.9, 1.2, C.ghost, 0.8, O('cross')); } },
		body: (fx, p, t) => wraith(fx, p, C.ghost, C.ghostEdge, C.inkAsh, t, 0.9),
	},
	'dark-pact': {
		// (the pact is cut: a cage of blood spikes round you, a spray of it, and the sigil burnt under you)
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; spikes(fx, g, 1.9, 10, 2.2, C.blood, C.redEye, 0.9, 0.14); for (let k = 0; k < 14; k++) fx.spark(at.x, at.y - 0.6, at.z, rnd(6), 2 + Math.random() * 5, rnd(6), 0.6, 0.06, 0.06, C.blood, 1, 16, 0.6); fx.decal(g, 1.9, 2, 1.6, C.blood, 1, O('rune', { spin: -0.6 })); fx.decal(g, 0.8, 0.9, 1.6, C.blood, 0.8, O('star', { spin: 0.6 })); for (let k = 0; k < 24; k++) fx.emit(at.x + rnd(0.4), at.y - 0.5, at.z + rnd(0.4), rnd(1.5), 1 + Math.random() * 2, rnd(1.5), 1, 0.2, 0.08, C.blood, 1, 9, 0.2, DRIP); inkPuff(fx, g, C.inkBlood, 8, 1, 1, 1.4, 0.6, C.blood); },
		on: (fx, at) => { if (Math.random() < 0.35) fx.emit(at.x + rnd(0.5), at.y - 0.6, at.z + rnd(0.5), 0, -0.4, 0, 0.8, 0.16, 0.08, C.blood, 1, 6, 0.2, DRIP); },
	},
	// ===== Storm: forked lightning =====
	thunderclap: { blast: (fx, at, r) => { slam(fx, { x: at.x, y: at.y + 0.6, z: at.z }, null, C.white, C.volt, 1.4, false); wave(fx, at, r * 0.75, C.volt, 0.4, 0.55); fx.emit(at.x, at.y + 0.4, at.z, 0, 0, 0, 0.18, 0.5, r * 0.8, C.white, 0.8, 0, 0, ORB); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + rnd(0.3); fx.bolt({ x: at.x, y: at.y + 0.3, z: at.z }, { x: at.x + Math.cos(a) * r, y: at.y + 0.2, z: at.z + Math.sin(a) * r }, C.volt, 0.3, 0.2, 5, 0.6, 1); } fx.decal(at, r * 0.5, r * 0.7, 1, C.arc, 0.8, O('star')); } },
	'chain-lightning': {
		arc: (fx, a, b) => { fx.bolt(a, b, C.white, 0.3, 0.16, 9, 1.4, 2); fx.bolt(a, b, C.arc, 0.22, 0.3, 7, 1.8, 1); slam(fx, b, null, C.white, C.arc, 0.7, false); fx.burst(b, C.volt, 8, 4, 0.3, 0.25, 0.5, STAR); },
	},
	'ball-lightning': {
		// (a white-hot heart in a cage of lightning, the cage lashing out at all sides and snapping back)
		orb: (fx, p, t) => {
			fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.08, 0.9, 0.9, C.white, 1, 0, 0, STAR);
			fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.1, 1.3 + Math.sin(t * 30) * 0.2, 1.2, C.plasma, 0.6, 0, 0, ORB);
			for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, e = rnd(1.2), l = 1.4 + Math.random() * 1.6; fx.line(p, { x: p.x + Math.cos(a) * Math.cos(e) * l, y: p.y + Math.sin(e) * l, z: p.z + Math.sin(a) * Math.cos(e) * l }, k ? C.plasma : C.white, 0.5, 0.06, 0.08, 0.5); }
			for (let k = 0; k < 2; k++) fx.spark(p.x, p.y, p.z, rnd(14), rnd(14), rnd(14), 0.12, 0.03, 0.05, C.volt, 1, 0, 4);
		},
		arc: (fx, a, b) => { fx.line(a, b, C.white, 0.6, 0.1, 0.1, 0.9); fx.line(a, b, C.plasma, 0.6, 0.14, 0.16, 1.4); slam(fx, b, null, C.white, C.plasma, 0.55, false); },
	},
	tempest: {
		cloud: (fx, at, r) => { if (Math.random() < 0.4) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 12 + rnd(1.5), at.z + Math.sin(a) * rr, rnd(0.5), 0, rnd(0.5), 2.5, 3, 5, C.inkStorm, 0.55, 0, 0.2, SMOKE); } },
		strike: (fx, from, to) => { slam(fx, { x: to.x, y: to.y + 0.4, z: to.z }, { x: 0, y: -1, z: 0 }, C.white, C.volt, 1.2); fx.bolt(from, to, C.white, 0.25, 0.35, 10, 3, 2); fx.bolt(from, to, C.arc, 0.2, 0.55, 7, 3.5, 1); fx.burst(to, C.volt, 18, 6, 0.4, 0.3, 1, STAR); wave(fx, to, 3, C.volt, 0.35); },
		rain: (fx, at, r) => { for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 12, at.z + Math.sin(a) * rr, 0, -16, 0, 0.75, 0.16, 0.12, C.rain, 0.6, 0, 0, STREAK); } },
	},
	// ===== Chrono: clock faces, gear rings, crystal =====
	'mark-and-recall': { self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; fx.decal(g, 1.4, 1.5, 1.8, C.clock, 1, O('rune', { spin: -0.5 })); fx.decal(g, 0.9, 0.9, 1.8, C.clock, 0.9, O('streak', { rot: 0, spin: 6 })); fx.decal(g, 0.6, 0.6, 1.8, C.white, 0.9, O('streak', { rot: 1, spin: 0.5 })); fx.pillar(g, 4, C.clock, 40, 0.8, 0.35, true, STREAK); } },
	quicken: {
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; for (let i = 0; i < 3; i++) { const y = at.y - 1.5 + i * 0.6, r = 1 + i * 0.15; fx.circle({ x: at.x, y, z: at.z }, r, C.gear, 18, 0.8, 0.4, i, STAR, 0); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283 + i * 0.26; fx.seg({ x: at.x + Math.cos(a) * r, y, z: at.z + Math.sin(a) * r }, { x: at.x + Math.cos(a) * (r + 0.18), y, z: at.z + Math.sin(a) * (r + 0.18) }, k % 3 ? C.gear : C.white, 0.05, 0.45); } } for (const [a, l] of [[0.4, 1.0], [2.3, 0.65]]) fx.seg({ x: at.x, y: g.y + 0.05, z: at.z }, { x: at.x + Math.cos(a) * l, y: g.y + 0.05, z: at.z + Math.sin(a) * l }, C.white, 0.06, 0.6); fx.flash?.({ x: at.x, y: at.y - 0.6, z: at.z }, C.gear, 0.15); fx.decal(g, 1.1, 1.2, 1.2, C.gear, 0.8, O('rune', { spin: 5 })); },
		on: (fx, at, t) => { const r = 0.95; for (let k = 0; k < 3; k++) { const a = t * (k % 2 ? -5 : 7) + k * 2; fx.emit(at.x + Math.cos(a) * r, at.y - 1.3 + k * 0.5, at.z + Math.sin(a) * r, 0, 0, 0, 0.35, 0.26, 0.08, C.gear, 0.95, 0, 0, STAR); } },
	},
	stasis: {
		mark: (fx, T) => { if (Math.random() < 0.6) { const a = Math.random() * 6.283, e = rnd(1.2); fx.emit(T.bound.x + Math.cos(a) * Math.cos(e) * 0.75, T.bound.y + Math.sin(e) * 1.1, T.bound.z + Math.sin(a) * Math.cos(e) * 0.75, 0, 0, 0, 0.7, 0.85, 0.85, C.crystal, 0.9, 0, 0, SHARD); } if (Math.random() < 0.08) fx.emit(T.bound.x, T.bound.y, T.bound.z, 0, 0, 0, 0.6, 2, 2, C.clock, 0.6, 0, 0, RUNE); if (Math.random() < 0.25) { const a = Math.random() * 6.283, e = rnd(1.2), b = a + 0.5 + Math.random() * 0.6, f = e + rnd(0.6), P = (u, v) => ({ x: T.bound.x + Math.cos(u) * Math.cos(v) * 0.8, y: T.bound.y + Math.sin(v) * 1.15, z: T.bound.z + Math.sin(u) * Math.cos(v) * 0.8 }); fx.seg(P(a, e), P(b, f), Math.random() < 0.3 ? C.white : C.crystal, 0.03, 0.4); } if (Math.random() < 0.05) fx.decal({ x: T.bound.x, y: T.bound.y - 1.2, z: T.bound.z }, 0.9, 1, 0.8, C.crystal, 0.7, O('rune', { spin: 0.2 })); },
	},
	rewind: {
		// (the path you came by drawn back in hard lines, clock hands spun backwards under you)
		self: (fx, at, path) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }, n = path?.length || 0; for (let k = 0; k < n; k++) { const q = path[k]; fx.emit(q.x, q.y - 0.6, q.z, 0, 0, 0, 0.4 + k / n * 0.8, 0.6, 0.25, k % 2 ? C.rewind : C.clock, 0.9, 0, 0, RING); if (k) { const o = path[k - 1]; fx.seg({ x: o.x, y: o.y - 0.6, z: o.z }, { x: q.x, y: q.y - 0.6, z: q.z }, k % 2 ? C.rewind : C.white, 0.05, 0.4 + k / n * 0.6); } } fx.spiral({ x: at.x, y: at.y - 0.8, z: at.z }, 1.4, C.rewind, 28, 0.6, 0.3, 2, true, STAR); for (let k = 0; k < 3; k++) { const a = -k * 0.9, l = 1.2 - k * 0.25; fx.seg({ x: at.x, y: g.y + 0.05, z: at.z }, { x: at.x + Math.cos(a) * l, y: g.y + 0.05, z: at.z + Math.sin(a) * l }, k ? C.rewind : C.white, 0.06, 0.35 + k * 0.15); } fx.flash?.({ x: at.x, y: at.y - 0.6, z: at.z }, C.rewind, 0.15); fx.decal(g, 1.3, 0.3, 0.8, C.rewind, 0.8, O('rune', { spin: -6 })); },
	},
	// ===== Primal: fire, ice, rain =====
	cinder: {
		trail: (fx, p, d, s) => { spear(fx, p, d, Math.max(1.4, s * 1.8), 0.42, C.flameCore, C.fire); for (let k = 0; k < 3; k++) fx.emit(p.x - d.x * s * k / 3 + rnd(0.08), p.y - d.y * s * k / 3, p.z - d.z * s * k / 3 + rnd(0.08), rnd(0.3), 0.8, rnd(0.3), 0.35, k ? 0.6 : 0.8, 0.12, k ? C.fire : C.flameCore, 1, 0, 0, FLAME); if (Math.random() < 0.7) embers(fx, p, C.amber, 1, 0.6, 0.7, 0.1, -1); if (Math.random() < 0.4) smokeTrail(fx, p, d, s, C.inkSmoke, null, 0.35, 1); },
		hit: (fx, at, d) => { slam(fx, at, d, C.flameCore, C.fire, 1.2); for (let k = 0; k < 18; k++) fx.emit(at.x + rnd(0.4), at.y + rnd(0.2), at.z + rnd(0.4), rnd(1), 2 + Math.random() * 2, rnd(1), 0.7, 0.8, 0.15, k % 3 ? C.fire : C.flameCore, 1, 0, 1, FLAME); embers(fx, at, C.amber, 12, 3, 1.2, 0.1, 4); inkPuff(fx, at, C.inkSmoke, 5, 0.4, 0.9, 1.6, 0.45); fx.decal({ x: at.x, y: at.y - 1, z: at.z }, 0.5, 1.4, 1.2, C.fire, 0.6, O('flame')); },
	},
	'frost-nova': {
		blast: (fx, at, r) => { for (let k = 0; k < 36; k++) { const a = k / 36 * 6.283, v = r / 0.35; fx.emit(at.x, at.y + 0.3, at.z, Math.cos(a) * v, 0.5, Math.sin(a) * v, 0.4, 0.6, 0.35, k % 2 ? C.ice : C.frost, 1, 0, 5, O('shard', { rot: -a + 1.5708 })); } for (let k = 0; k < 28; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 0.1, at.z + Math.sin(a) * rr, 0, 0, 0, 2.2, 0.45, 0.4, C.frost, 0.75, 0, 0, STAR); } wave(fx, at, r * 0.85, C.white, 0.4, 0.5); fx.decal(at, r * 0.9, r, 2.2, C.ice, 0.45, RING);
			// (the ground cracks white, and ice spikes up along the cracks)
			for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283 + rnd(0.2), L = r * (0.7 + Math.random() * 0.4); fx.line({ x: at.x, y: at.y + 0.08, z: at.z }, { x: at.x + Math.cos(a) * L, y: at.y + 0.08, z: at.z + Math.sin(a) * L }, k % 2 ? C.ice : C.white, 1.5, 1.6, 0.14, 0.7); for (let j = 1; j <= 3; j++) { const u = j / 4 * L, x = at.x + Math.cos(a) * u, z = at.z + Math.sin(a) * u; fx.seg({ x: x + Math.cos(a) * 0.25, y: at.y + 0.6 + Math.random() * 0.7, z: z + Math.sin(a) * 0.25 }, { x, y: at.y, z }, j % 2 ? C.white : C.frost, 0.2, 2, 1, 1); } } },
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.35), T.bound.y + rnd(0.7), T.bound.z + rnd(0.35), 0, 0, 0, 0.8, 0.35, 0.35, C.ice, 0.9, 0, 0, SHARD); },
	},
	// (hard silver rain, each drop a falling stroke, splashing up off the ground)
	'call-rain': { rain: (fx, at, r) => { for (let n = 0; n < 10; n++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.spark(at.x + Math.cos(a) * rr, at.y + 10, at.z + Math.sin(a) * rr, 0.6, -24, 0, 0.5, 0.05, 0.035, C.rain, 0.8, 0, 0); } for (let n = 0; n < 4; n++) { const a = Math.random() * 6.283, rr = 8 * Math.sqrt(Math.random()), x = at.x + Math.cos(a) * rr, z = at.z + Math.sin(a) * rr; for (let k = 0; k < 3; k++) fx.spark(x, at.y - 1.6, z, rnd(1.5), 1.5 + Math.random() * 1.5, rnd(1.5), 0.25, 0.04, 0.03, C.rain, 0.9, 12, 0.5); } if (Math.random() < 0.5) { const a = Math.random() * 6.283, rr = 8 * Math.sqrt(Math.random()); fx.decal({ x: at.x + Math.cos(a) * rr, y: at.y - 1.68, z: at.z + Math.sin(a) * rr }, 0.05, 0.8, 0.8, C.rain, 0.8, RING); } } },
};

// the look of a spell, with its school's soft orb for whatever it does not draw itself
export function lookOf(spell) { return LOOK[spell?.id] || {}; }
export const schoolGlow = (spell) => GLOW[spell?.type === 'frost' ? 'frost' : spell?.school] || GLOW.light;
// (for the tests: the spells that have a look of their own)
export const LOOK_IDS = Object.keys(LOOK);
