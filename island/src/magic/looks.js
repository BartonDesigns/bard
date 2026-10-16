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
	HEX = O('hex', { spin: 0.3 }), LEAF = O('leaf', { spin: 2.5 }), GLOWSMOKE = O('smoke', { spin: 0.4 }), DARK_ORB = O('orb', { ink: true }), DRIP = O('flame', { rot: Math.PI });
const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
const ang = (dx, dz) => Math.atan2(dx, dz);

// ---------- shared motions ----------
function trailOf(fx, pos, d, step, core, edge, s, o = ORB, n = 3) {
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
	for (let k = 0; k < n; k++) fx.emit(at.x + rnd(0.3), at.y + rnd(0.3), at.z + rnd(0.3), rnd(v), Math.random() * v * 1.5, rnd(v), life * (0.5 + Math.random()), s, s * 0.3, c, 1, g, 0.6, STAR);
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
const wave = (fx, at, r, c, life = 0.45, a = 0.9) => fx.decal(at, r * 0.2, r * 1.25, life, c, a, RING);
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
	violet: [0.62, 0.35, 1], lilac: [0.82, 0.62, 1], blood: [1, 0.08, 0.1], redEye: [1, 0.12, 0.05], corona: [1, 0.6, 0.25],
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
		hit: (fx, at) => { fx.burst(at, C.sun, 24, 5, 0.5, 0.5, 0.6, STAR); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.3, 0.8, 3, C.white, 1, 0, 0, STAR); },
	},
	'lance-of-dawn': {
		// (three spears out of the sun, point first; by night out of the moon, in silver)
		cast: (fx, h) => fx.emit(h.x, h.y, h.z, 0, 0, 0, 0.25, 0.2, 0.9, C.white, 1, 0, 0, STAR),
		tell: (fx, at, r, u, night) => fx.decal(at, r * 0.3, r * 0.75, 0.5, night ? C.moon : C.gold, 0.8, RING),
		fall: (fx, p, d, night) => {
			const edge = night ? C.moon : C.gold, len = 7;
			// the point, then the shaft trailing back up toward the sky it came from
			fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.06, 0.9, 0.9, C.white, 1, 0, 0, O('shard', { rot: Math.atan2(d.x, d.y) }));
			for (let k = 1; k <= 12; k++) { const u = k / 12; fx.emit(p.x + d.x * len * u, p.y + d.y * len * u, p.z + d.z * len * u, 0, 0, 0, 0.07 + u * 0.12, 0.55 - u * 0.3, 0.08, k < 3 ? C.white : edge, 1 - u * 0.5, 0, 0, ORB); }
			if (Math.random() < 0.7) fx.emit(p.x + d.x * len * Math.random(), p.y + d.y * len * Math.random(), p.z + d.z * len * Math.random(), rnd(0.5), rnd(0.5), rnd(0.5), 0.5, 0.16, 0.03, edge, 1, 0, 0.5, STAR);
		},
		blast: (fx, at, r, night) => {
			const edge = night ? C.moon : C.gold;
			// (the spear stands where it struck, for a moment)
			for (let k = 0; k < 9; k++) fx.emit(at.x, at.y + 0.3 + k * 0.34, at.z, 0, 0, 0, 1, 0.42 - k * 0.03, 0.06, k < 2 ? C.white : edge, 1, 0, 0, ORB);
			fx.emit(at.x, at.y + 0.5, at.z, 0, 0, 0, 0.25, 0.8, 3, C.white, 1, 0, 0, STAR);
			wave(fx, at, r * 1.2, edge, 0.5);
			fx.decal(at, r * 0.5, r * 0.6, 1.2, edge, 0.7, O('star', { spin: 0.5 }));
			fx.burst(at, edge, 18, r * 1.8, 0.45, 0.28, 2, STAR);
		},
	},
	'solar-flare': {
		tell: (fx, at, r, u) => { if (u < 0.2) fx.decal(at, r, r * 0.9, 0.55, C.amber, 0.8, O('rune', { spin: 2 })); },
		blast: (fx, at, r) => {
			fx.emit(at.x, at.y + 1, at.z, 0, 0, 0, 0.35, 1, r * 1.6, C.white, 1, 0, 0, ORB);
			fx.emit(at.x, at.y + 1, at.z, 0, 0, 0, 0.5, r * 0.6, r * 2.2, C.amber, 1, 0, 0, RING);
			// (rays, as from a sun)
			for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; fx.line({ x: at.x, y: at.y + 1, z: at.z }, { x: at.x + Math.cos(a) * r * 1.4, y: at.y + 1 + rnd(0.6), z: at.z + Math.sin(a) * r * 1.4 }, C.gold, 0.5, 0.3, 0.25, 0, STAR); }
			fx.burst(at, C.sun, 40, r * 1.6, 0.7, 0.35, 1.2, STAR);
			fx.decal(at, r * 0.8, r * 1.3, 0.9, C.amber, 0.8, O('star', { spin: 1 }));
		},
	},
	judgement: {
		tell: (fx, at, r, u) => { if (u < 0.08) sigil(fx, at, r, C.gold, C.sun, 1.6, 0, 8); fx.pillar(at, 40, C.sun, 2, 0.2, 0.12, false, STREAK); },
		blast: (fx, at, r) => {
			// (a sword of light falls from the sky)
			for (let k = 0; k < 40; k++) fx.emit(at.x + rnd(0.25), at.y + 40 - k, at.z + rnd(0.25), 0, -60, 0, 0.35, 0.8, 0.35, k % 3 ? C.white : C.gold, 1, 0, 0, STREAK);
			for (let k = 0; k < 6; k++) fx.emit(at.x, at.y + 1 + k * 2.5, at.z, 0, -3, 0, 0.6, 1.4, 3, C.sun, 0.8, 0, 0, RING);
			wave(fx, at, r * 1.4, C.white, 0.5);
			fx.burst(at, C.gold, 60, 9, 1, 0.5, 2, STAR);
			fx.decal(at, r * 1.1, r * 1.2, 1.4, C.gold, 1, O('rune', { spin: 0.3 }));
		},
	},
	// ===== Restoration: crosses, petals, a green sigil, a phoenix =====
	mend: { self: (fx, at) => { for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; fx.emit(at.x + Math.cos(a) * 0.6, at.y - 0.9, at.z + Math.sin(a) * 0.6, -Math.sin(a) * 1.2, 2 + Math.random(), Math.cos(a) * 1.2, 1, 0.4, 0.15, k % 2 ? C.leafG : C.mint, 1, 0, 1.2, CROSS); } fx.emit(at.x, at.y - 0.4, at.z, 0, 0.6, 0, 0.6, 0.5, 1.4, C.mint, 0.8, 0, 0, CROSS); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 0.4, 1.2, 0.8, C.leafG, 0.7, CROSS); } },
	renewal: {
		self: (fx, at) => fx.burst({ x: at.x, y: at.y - 0.6, z: at.z }, C.petal, 24, 2, 1.4, 0.35, 1, LEAF),
		on: (fx, at) => { if (Math.random() < 0.5) { const a = Math.random() * 6.283; fx.emit(at.x + Math.cos(a) * 0.7, at.y - 1.4, at.z + Math.sin(a) * 0.7, -Math.sin(a) * 0.5, 0.9, Math.cos(a) * 0.5, 1.8, 0.32, 0.18, Math.random() < 0.5 ? C.petal : C.leafG, 0.95, 0, 0.3, LEAF); } },
	},
	sanctuary: { tick: (fx, at, r, t) => { sigil(fx, at, r, C.leafG, C.mint, 0.35, t * 0.5, 6); for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283; fx.emit(at.x + Math.cos(a) * r, at.y + 0.2, at.z + Math.sin(a) * r, 0, 2.5, 0, 0.8, 0.35, 0.15, C.mint, 0.9, 0, 0, STREAK); } } },
	resurgence: {
		self: (fx, at) => { for (const s of [-1, 1]) for (let k = 0; k < 20; k++) { const u = k / 20; fx.emit(at.x, at.y - 0.4, at.z, s * (0.6 + u * 2.6), 1 + Math.sin(u * 3.1) * 2.2, rnd(0.3), 1.3, 0.9 - u * 0.35, 0.15, k % 2 ? C.phoenix : C.gold, 1, -0.5, 1.6, FLAME); } fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 0.6, 2.4, 1, C.phoenix, 0.8, O('star')); },
		on: (fx, at, t) => { for (let k = 0; k < 2; k++) { const a = t * 2 + k * 3.14; fx.emit(at.x + Math.cos(a) * 0.45, at.y + 0.45, at.z + Math.sin(a) * 0.45, 0, 0.3, 0, 0.35, 0.22, 0.06, C.phoenix, 0.9, 0, 0, FLAME); } },
	},
	// ===== Warding: hexagons, a crown of flame, a white gale =====
	aegis: {
		self: (fx, at) => { for (let k = 0; k < 30; k++) { const a = k / 10 * 6.283 / 3, e = (Math.floor(k / 10) - 1) * 0.6; fx.emit(at.x + Math.cos(a) * Math.cos(e) * 1.1, at.y - 0.6 + Math.sin(e) * 1.1, at.z + Math.sin(a) * Math.cos(e) * 1.1, 0, 0, 0, 1, 0.7, 0.75, C.ward, 0.9, 0, 0, HEX); } },
		on: (fx, at, t) => { if (Math.random() < 0.6) { const a = t * 1.2 + Math.random() * 6.283, e = rnd(0.8); fx.emit(at.x + Math.cos(a) * Math.cos(e) * 1.1, at.y - 0.6 + Math.sin(e) * 1.1, at.z + Math.sin(a) * Math.cos(e) * 1.1, 0, 0, 0, 0.6, 0.55, 0.6, C.ward, 0.5, 0, 0, HEX); } },
	},
	'radiant-aura': { tick: (fx, at, r, t) => { for (let k = 0; k < 16; k++) { const a = t * 2.2 + k / 16 * 6.283; fx.emit(at.x + Math.cos(a) * r, at.y + 0.1, at.z + Math.sin(a) * r, 0, 1.8, 0, 0.5, 0.85, 0.2, k % 2 ? C.amber : C.gold, 1, 0, 0, FLAME); } fx.decal(at, r * 0.95, r * 1.05, 0.3, C.amber, 0.5, RING); } },
	bulwark: {
		self: (fx, at) => { for (let i = 0; i < 5; i++) for (let k = 0; k < 14 - i * 2; k++) { const a = k / (14 - i * 2) * 6.283, e = i / 5 * 1.4, r = 1.6; fx.emit(at.x + Math.cos(a) * Math.cos(e) * r, at.y - 1.5 + Math.sin(e) * r, at.z + Math.sin(a) * Math.cos(e) * r, 0, 0, 0, 1.4, 0.75, 0.8, i % 2 ? C.white : C.sky, 0.9, 0, 0, HEX); } fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 1.8, 2, 3.5, C.sky, 0.7, O('hex', { spin: 0.4 })); },
		on: (fx, at, t) => { if (Math.random() < 0.7) { const a = t * 0.8 + Math.random() * 6.283, e = Math.random() * 1.3; fx.emit(at.x + Math.cos(a) * Math.cos(e) * 1.6, at.y - 1.5 + Math.sin(e) * 1.6, at.z + Math.sin(a) * Math.cos(e) * 1.6, 0, 0, 0, 0.5, 0.7, 0.7, C.sky, 0.55, 0, 0, HEX); } },
	},
	banish: { blast: (fx, at, r) => { for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283 + rnd(0.05), v = r / 0.35 * (0.6 + Math.random() * 0.4); fx.emit(at.x + Math.cos(a) * 0.6, at.y + 0.3 + Math.random() * 1.4, at.z + Math.sin(a) * 0.6, Math.cos(a) * v, 0.4, Math.sin(a) * v, 0.45, 0.4, 1.1, k % 3 ? C.white : C.ward, 0.9, 0, 1, O('streak', { rot: 1.5708 })); } wave(fx, at, r * 0.8, C.white, 0.45, 0.5); fx.decal(at, r * 0.3, r * 0.65, 0.6, C.ward, 0.55, HEX); } },
	// ===== Dawn: rose and peach, a small sun, wind, water =====
	lumen: { on: (fx, at, t, d) => { const x = at.x - d.z * 0.5, z = at.z + d.x * 0.5; fx.emit(x, at.y + 0.35, z, 0, 0, 0, 0.12, 0.5, 0.42, C.sun, 1, 0, 0, ORB); if (Math.random() < 0.3) fx.emit(x, at.y + 0.35, z, 0, 0, 0, 0.3, 0.3, 0.9, C.peach, 0.5, 0, 0, O('star', { rot: t })); } },
	dawnsight: { self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; fx.ring({ x: at.x, y: at.y - 1.5, z: at.z }, 30, C.rose, 70, 1.2, 0.45, STAR); wave(fx, g, 14, C.peach, 1.4, 0.35); fx.decal(g, 1.2, 1.4, 1.2, C.rose, 0.8, O('rune', { spin: 1 })); } },
	swiftstride: { on: (fx, at, t, d, moving) => { if (moving && Math.random() < 0.9) for (const s of [-1, 1]) fx.emit(at.x - d.z * 0.3 * s - d.x * 0.3, at.y - 1.4 + Math.random() * 0.5, at.z + d.x * 0.3 * s - d.z * 0.3, -d.x * 4, 0.2, -d.z * 4, 0.4, 0.5, 0.08, C.wind, 0.85, 0, 0.5, O('streak', { rot: 1.5708 })); } },
	waterstride: { on: (fx, at, t, d, moving) => { if (Math.random() < (moving ? 0.25 : 0.05)) fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 0.2, 1.6, 1, C.water, 0.9, RING); if (Math.random() < 0.2) fx.emit(at.x + rnd(0.3), at.y - 1.6, at.z + rnd(0.3), rnd(0.8), 1.2, rnd(0.8), 0.5, 0.12, 0.05, C.water, 1, 5, 0, ORB); } },
	daybreak: { self: (fx, at) => { for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; fx.line({ x: at.x, y: at.y + 2, z: at.z }, { x: at.x + Math.cos(a) * 9, y: at.y + 2 + Math.abs(Math.sin(a)) * 6, z: at.z + Math.sin(a) * 9 }, k % 2 ? C.rose : C.peach, 0.6, 1.2, 0.3, 0, STAR); } fx.emit(at.x, at.y + 3, at.z, 0, 1, 0, 1.6, 1, 6, C.sun, 0.8, 0, 0, ORB); } },
	'sunwell-gate': { self: (fx, at) => { for (let k = 0; k < 36; k++) { const a = k / 36 * 6.283; fx.emit(at.x + Math.cos(a) * 1.4, at.y - 0.3 + Math.sin(a) * 1.8, at.z, 0, 0, 0, 1, 0.45, 0.1, k % 2 ? C.gold : C.sun, 1, 0, 0, STAR); } fx.pillar({ x: at.x, y: at.y - 1.6, z: at.z }, 6, C.sun, 60, 1, 0.45, true, STREAK); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 1.6, 1.8, 1.4, C.gold, 0.9, O('rune', { spin: 1.5 })); } },
	// ===== Shadow: black smoke round violet hearts, red eyes, a black sun =====
	shadowbolt: {
		cast: (fx, h) => inkPuff(fx, h, C.inkShadow, 3, 0.1, 0.4, 0.6, 0.6, C.violet),
		trail: (fx, p, d, s) => { smokeTrail(fx, p, d, s, C.inkShadow, C.violet, 0.7, 2); fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.08, 0.5, 0.45, C.violet, 1, 0, 0, ORB); if (Math.random() < 0.6) fx.emit(p.x, p.y, p.z, rnd(1), rnd(1), rnd(1), 0.35, 0.18, 0.03, C.lilac, 1, 0, 1, ORB); },
		hit: (fx, at) => { inkPuff(fx, at, C.inkShadow, 10, 0.6, 1.2, 1.2, 0.75, C.violet); fx.burst(at, C.violet, 16, 3.5, 0.45, 0.35, 0.3); },
	},
	shadowstep: { self: (fx, at) => { const g = { x: at.x, y: at.y - 0.8, z: at.z }; inkPuff(fx, g, C.inkShadow, 14, 0.6, 1.4, 1.4, 0.8, C.violet); fx.burst(g, C.violet, 24, 3, 0.5, 0.3, 0); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 0.3, 1.4, 0.9, C.violet, 0.8, RING); } },
	'umbral-cloak': {
		self: (fx, at) => { inkPuff(fx, { x: at.x, y: at.y - 0.8, z: at.z }, C.inkShadow, 18, 0.8, 1.4, 1.6, 0.75, C.lilac); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 1.4, 0.6, 1.4, C.violet, 0.6, O('smoke', { spin: 1 })); },
		on: (fx, at) => { if (Math.random() < 0.5) { const x = at.x + rnd(0.5), y = at.y - 1.2 + Math.random() * 0.8, z = at.z + rnd(0.5); fx.emit(x, y, z, 0, 0.6, 0, 1, 0.35, 0.9, C.inkShadow, 0.4, 0, 0, SMOKE); fx.emit(x, y, z, 0, 0.6, 0, 0.8, 0.3, 0.8, C.violet, 0.12, 0, 0, GLOWSMOKE); } },
	},
	'night-terror': {
		cone: (fx, o, d, range, angle) => { for (let k = 0; k < 24; k++) { const a = ang(d.x, d.z) + rnd(angle), v = range / 0.6 * (0.4 + Math.random() * 0.6); fx.emit(o.x, o.y - 0.4, o.z, Math.sin(a) * v, rnd(0.6), Math.cos(a) * v, 0.9, 0.6, 2.4, C.inkShadow, 0.7, 0, 1.2, SMOKE); if (k % 2) fx.emit(o.x, o.y - 0.4, o.z, Math.sin(a) * v, rnd(0.6), Math.cos(a) * v, 0.8, 0.6, 2.2, C.violet, 0.15, 0, 1.2, GLOWSMOKE); } for (let k = 0; k < 10; k++) { const a = ang(d.x, d.z) + rnd(angle), v = range / 0.6 * (0.4 + Math.random() * 0.6); fx.emit(o.x, o.y - 0.3, o.z, Math.sin(a) * v, rnd(0.4), Math.cos(a) * v, 0.9, 0.55, 0.55, C.redEye, 1, 0, 1.2, EYES); } },
		mark: (fx, T) => { if (Math.random() < 0.25) fx.emit(T.bound.x + rnd(0.3), T.bound.y + 0.6, T.bound.z + rnd(0.3), 0, 0.5, 0, 0.5, 0.3, 0.3, C.redEye, 1, 0, 0, EYES); },
	},
	eclipse: {
		tell: (fx, at, r, u) => { fx.emit(at.x, at.y + 2.2, at.z, 0, 0, 0, 0.12, r * 0.5 * (0.4 + u), r * 0.5 * (0.4 + u), C.inkVoid, 0.95, 0, 0, DARK_ORB); fx.emit(at.x, at.y + 2.2, at.z, 0, 0, 0, 0.12, r * 0.55 * (0.4 + u), r * 0.55 * (0.4 + u), C.corona, 0.9, 0, 0, RING); if (u < 0.2) fx.decal(at, r * 0.8, r * 0.7, 1, C.corona, 0.4, RING); },
		blast: (fx, at, r) => { fx.emit(at.x, at.y + 2.2, at.z, 0, 0, 0, 0.5, r * 0.5, r * 1.6, C.corona, 0.85, 0, 0, RING); fx.emit(at.x, at.y + 2.2, at.z, 0, 0, 0, 0.4, r * 0.3, r * 1.0, C.white, 1, 0, 0, RING); inkPuff(fx, at, C.inkShadow, 20, r * 0.6, 2, 1.4, 0.75, C.violet); fx.burst(at, C.violet, 40, r * 1.4, 0.6, 0.35, 0.6); wave(fx, at, r * 0.9, C.corona, 0.6, 0.45); },
		mark: (fx, T) => { if (Math.random() < 0.3) fx.emit(T.bound.x, T.bound.y + 0.9, T.bound.z, 0, 0, 0, 0.25, 0.6, 0.6, C.corona, 0.7, 0, 0, RING); },
	},
	// ===== Void: crystal shards, warped rings, a black heart =====
	'void-shard': {
		cast: (fx, h) => fx.burst(h, C.azure, 8, 1.6, 0.3, 0.22, 0, SHARD),
		trail: (fx, p, d, s) => { fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.07, 0.9, 0.9, C.azure, 1, 0, 0, O('shard', { rot: Math.atan2(-d.x, d.y || 1e-3) })); for (let k = 0; k < 3; k++) fx.emit(p.x - d.x * s * k / 3, p.y - d.y * s * k / 3, p.z - d.z * s * k / 3, rnd(0.6), rnd(0.6), rnd(0.6), 0.6, 0.26, 0.05, C.indigo, 1, 0, 0.5, SHARD); },
		hit: (fx, at) => { fx.burst(at, C.azure, 22, 6, 0.5, 0.35, 0.3, SHARD); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.3, 0.4, 2.2, C.indigo, 1, 0, 0, RING); },
	},
	repulse: { cone: (fx, o, d, range) => { for (let k = 0; k < 4; k++) fx.emit(o.x + d.x * 1.5, o.y - 0.3, o.z + d.z * 1.5, d.x * range * (1 + k * 0.3), d.y * 2, d.z * range * (1 + k * 0.3), 0.5, 0.6, 3.5 + k, k % 2 ? C.indigo : C.azure, 0.8, 0, 1, RING); for (let k = 0; k < 24; k++) { const a = ang(d.x, d.z) + rnd(0.7), v = range * 2 * (0.5 + Math.random() * 0.5); fx.emit(o.x, o.y - 0.3, o.z, Math.sin(a) * v, rnd(1), Math.cos(a) * v, 0.45, 0.35, 0.08, C.azure, 1, 0, 1, SHARD); } } },
	'gravity-well': {
		tick: (fx, at, r, t) => { fx.spiral(at, r, C.indigo, 12, 0.5, 0.35, 3, true); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.3, r * 0.28, C.inkVoid, 0.9, 0, 0, DARK_ORB); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.36, r * 0.34, C.azure, 0.7, 0, 0, RING); if (Math.random() < 0.25) fx.decal({ x: at.x, y: at.y - 1, z: at.z }, r * 1.1, r * 0.2, 0.7, C.indigo, 0.7, O('rune', { rot: t, spin: -3 })); },
		blast: (fx, at, r) => { fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.35, r * 0.2, r * 2.4, C.azure, 1, 0, 0, RING); fx.burst(at, C.indigo, 50, r * 1.6, 0.6, 0.4, 0, SHARD); wave(fx, { x: at.x, y: at.y - 1, z: at.z }, r * 1.4, C.azure, 0.5); },
	},
	'event-horizon': {
		tick: (fx, at, r, t) => { fx.spiral(at, r, C.violet, 16, 0.6, 0.4, 4, true); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.45, r * 0.42, C.inkVoid, 1, 0, 0, DARK_ORB); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.14, r * 0.5, r * 0.5, C.white, 0.85, 0, 0, RING); fx.circle(at, r * 0.7, C.azure, 16, 0.14, 0.22, t * 3, ORB, 0); if (Math.random() < 0.25) fx.decal({ x: at.x, y: at.y - 1, z: at.z }, r * 0.9, r * 0.8, 0.7, C.violet, 0.4, O('ring')); },
		blast: (fx, at, r) => { fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.5, r * 0.3, r * 2, C.white, 0.85, 0, 0, RING); fx.emit(at.x, at.y, at.z, 0, 0, 0, 0.6, r * 0.4, r * 1.6, C.violet, 1, 0, 0, RING); fx.burst(at, C.azure, 70, r * 2, 0.7, 0.4, 0, SHARD); wave(fx, { x: at.x, y: at.y - 1, z: at.z }, r * 1.0, C.violet, 0.6, 0.5); },
		mark: (fx, T) => { if (Math.random() < 0.25) fx.line(T.bound, { x: T.bound.x, y: T.bound.y + 1.2, z: T.bound.z }, C.violet, 0.3, 0.12, 0.14); },
	},
	// ===== Blight: poison and its fog, ash, souls, spores =====
	'hex-of-decay': {
		trail: (fx, p, d, s) => { trailOf(fx, p, d, s, C.acid, C.poison, 0.5, ORB, 2); smokeTrail(fx, p, d, s, C.inkBlight, C.poison, 0.45, 1); },
		hit: (fx, at) => { inkPuff(fx, at, C.inkBlight, 6, 0.4, 0.9, 1, 0.6, C.poison); fx.emit(at.x, at.y + 0.8, at.z, 0, 0.3, 0, 1.2, 1.4, 1.6, C.poison, 0.95, 0, 0, RUNE_STILL); },
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.25), T.bound.y + 0.3, T.bound.z + rnd(0.25), 0, -0.2, 0, 0.8, 0.22, 0.1, C.poison, 1, 4, 0.2, DRIP); if (Math.random() < 0.06) fx.emit(T.bound.x, T.bound.y + 1.1, T.bound.z, 0, 0.2, 0, 0.6, 0.6, 0.7, C.poison, 0.8, 0, 0, RUNE_STILL); },
	},
	withering: {
		trail: (fx, p, d, s) => { trailOf(fx, p, d, s, C.amber, C.ash, 0.45, ORB, 2); if (Math.random() < 0.8) fx.emit(p.x, p.y, p.z, rnd(0.4), -0.3, rnd(0.4), 1.2, 0.22, 0.08, C.ash, 1, 1.5, 0.4, LEAF); },
		hit: (fx, at) => { for (let k = 0; k < 20; k++) fx.emit(at.x + rnd(0.5), at.y + 0.8 + rnd(0.4), at.z + rnd(0.5), rnd(0.6), 0.2, rnd(0.6), 1.6, 0.25, 0.1, k % 2 ? C.ash : C.amber, 1, 1.2, 0.5, LEAF); inkPuff(fx, at, C.inkAsh, 4, 0.3, 0.8, 1.2, 0.5, C.ash); },
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.3), T.bound.y + 0.7, T.bound.z + rnd(0.3), rnd(0.2), 0, rnd(0.2), 1.3, 0.2, 0.08, C.ash, 1, 1, 0.4, LEAF); },
	},
	'plague-cloud': { tick: (fx, at, r) => { for (let k = 0; k < 7; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()), x = at.x + Math.cos(a) * rr, y = at.y + 0.4 + Math.random() * 1.2, z = at.z + Math.sin(a) * rr; fx.emit(x, y, z, rnd(0.2), 0.15, rnd(0.2), 2, 1.4, 2.8, C.inkBlight, 0.4, 0, 0.3, SMOKE); fx.emit(x, y, z, rnd(0.2), 0.15, rnd(0.2), 1.8, 1.6, 3, C.poison, 0.16, 0, 0.3, GLOWSMOKE); } for (let k = 0; k < 10; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 0.2 + Math.random(), at.z + Math.sin(a) * rr, 0, 0.6, 0, 0.9, 0.18, 0.4, C.acid, 0.9, 0, 0, RING); } fx.decal(at, r * 0.9, r, 0.6, C.poison, 0.35, O('smoke', { spin: 0.5 })); } },
	'soul-siphon': {
		beam: (fx, a, b) => {
			// (souls flow back along the beam, to you)
			fx.line(a, b, C.poison, 1.1, 0.06, 0.16, 0.08);
			const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1, v = 18;
			for (let k = 0; k < 2; k++) { const u = 0.8 + Math.random() * 0.2; fx.emit(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u, (a.x - b.x) / L * v, (a.y - b.y) / L * v, (a.z - b.z) / L * v, L / v * 0.9, 0.5, 0.3, C.soul, 1, 0, 0, GLOWSMOKE); fx.emit(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u, (a.x - b.x) / L * v, (a.y - b.y) / L * v, (a.z - b.z) / L * v, L / v * 0.9, 0.3, 0.25, C.white, 0.8, 0, 0, EYES); }
			if (Math.random() < 0.6) fx.emit(b.x, b.y, b.z, rnd(1), 1, rnd(1), 0.5, 0.35, 0.05, C.soul, 1, 0, 0.5, ORB);
		},
	},
	contagion: {
		trail: (fx, p, d, s) => { trailOf(fx, p, d, s, C.acid, C.poison, 0.45, ORB, 2); if (Math.random() < 0.7) fx.emit(p.x, p.y, p.z, rnd(0.6), rnd(0.6), rnd(0.6), 0.7, 0.16, 0.32, C.acid, 1, 0, 0.5, RING); },
		hit: (fx, at) => { for (let k = 0; k < 18; k++) fx.emit(at.x, at.y, at.z, rnd(3), Math.random() * 2, rnd(3), 1, 0.2, 0.45, k % 2 ? C.acid : C.poison, 1, 2, 1.5, RING); inkPuff(fx, at, C.inkBlight, 5, 0.3, 0.8, 1, 0.5, C.acid); },
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.3), T.bound.y + 0.4 + Math.random() * 0.6, T.bound.z + rnd(0.3), 0, 0.4, 0, 0.7, 0.14, 0.32, C.acid, 1, 0, 0, RING); },
		spread: (fx, a, b) => { for (let k = 0; k < 12; k++) { const u = k / 12; fx.emit(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 1.2, a.z + (b.z - a.z) * u, 0, 0, 0, 0.5 + u * 0.3, 0.3, 0.15, C.acid, 1, 0, 0, RING); } },
	},
	// ===== Umbral: spectres and a blood sigil =====
	nightsight: { self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; wave(fx, g, 22, C.lilac, 1.2, 0.6); fx.burst({ x: at.x, y: at.y - 0.2, z: at.z }, C.violet, 14, 1, 0.7, 0.4, 0, EYES); fx.decal(g, 1, 1.1, 1, C.lilac, 0.7, EYES); } },
	shade: {
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.4, z: at.z }; inkPuff(fx, g, C.inkShadow, 10, 0.6, 1, 1.2, 0.6, C.violet); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 0.4, 1.3, 1, C.violet, 0.7, RUNE_STILL); },
		body: (fx, p, t) => wraith(fx, p, C.lilac, C.violet, C.inkShadow, t, 1),
	},
	'grave-host': {
		// (the dead rise: grave dust from the ground, pale green ghosts)
		self: (fx, at) => { for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; const g = { x: at.x + Math.cos(a) * 1.6, y: at.y - 1.68, z: at.z + Math.sin(a) * 1.6 }; inkPuff(fx, g, C.inkAsh, 6, 0.4, 0.8, 1.2, 0.5, C.ghost); fx.pillar(g, 2.4, C.ghost, 18, 0.7, 0.4, true, STREAK); fx.decal(g, 0.3, 0.9, 1.2, C.ghost, 0.8, O('cross')); } },
		body: (fx, p, t) => wraith(fx, p, C.ghost, C.ghostEdge, C.inkAsh, t, 0.9),
	},
	'dark-pact': {
		self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; fx.decal(g, 1.9, 2, 1.6, C.blood, 1, O('rune', { spin: -0.6 })); fx.decal(g, 0.8, 0.9, 1.6, C.blood, 0.8, O('star', { spin: 0.6 })); for (let k = 0; k < 24; k++) fx.emit(at.x + rnd(0.4), at.y - 0.5, at.z + rnd(0.4), rnd(1.5), 1 + Math.random() * 2, rnd(1.5), 1, 0.2, 0.08, C.blood, 1, 9, 0.2, DRIP); inkPuff(fx, g, C.inkBlood, 8, 1, 1, 1.4, 0.6, C.blood); },
		on: (fx, at) => { if (Math.random() < 0.35) fx.emit(at.x + rnd(0.5), at.y - 0.6, at.z + rnd(0.5), 0, -0.4, 0, 0.8, 0.16, 0.08, C.blood, 1, 6, 0.2, DRIP); },
	},
	// ===== Storm: forked lightning =====
	thunderclap: { blast: (fx, at, r) => { wave(fx, at, r * 0.75, C.volt, 0.4, 0.55); fx.emit(at.x, at.y + 0.4, at.z, 0, 0, 0, 0.18, 0.5, r * 0.8, C.white, 0.8, 0, 0, ORB); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + rnd(0.3); fx.bolt({ x: at.x, y: at.y + 0.3, z: at.z }, { x: at.x + Math.cos(a) * r, y: at.y + 0.2, z: at.z + Math.sin(a) * r }, C.volt, 0.3, 0.2, 5, 0.6, 1); } fx.decal(at, r * 0.5, r * 0.7, 1, C.arc, 0.8, O('star')); } },
	'chain-lightning': {
		arc: (fx, a, b) => { fx.bolt(a, b, C.white, 0.3, 0.16, 9, 1.4, 2); fx.bolt(a, b, C.arc, 0.22, 0.3, 7, 1.8, 1); fx.burst(b, C.volt, 12, 4, 0.3, 0.25, 0.5, STAR); },
	},
	'ball-lightning': {
		orb: (fx, p, t) => { fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.1, 1.5 + Math.sin(t * 30) * 0.2, 1.4, C.plasma, 1, 0, 0, ORB); fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.1, 0.8, 0.8, C.white, 1, 0, 0, STAR); if (Math.random() < 0.7) { const a = Math.random() * 6.283, e = rnd(1.2); fx.bolt(p, { x: p.x + Math.cos(a) * Math.cos(e) * 1.6, y: p.y + Math.sin(e) * 1.6, z: p.z + Math.sin(a) * Math.cos(e) * 1.6 }, C.plasma, 0.1, 0.12, 3, 0.4, 0); } },
		arc: (fx, a, b) => fx.bolt(a, b, C.plasma, 0.16, 0.18, 5, 0.8, 0),
	},
	tempest: {
		cloud: (fx, at, r) => { if (Math.random() < 0.4) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 12 + rnd(1.5), at.z + Math.sin(a) * rr, rnd(0.5), 0, rnd(0.5), 2.5, 3, 5, C.inkStorm, 0.55, 0, 0.2, SMOKE); } },
		strike: (fx, from, to) => { fx.bolt(from, to, C.white, 0.25, 0.35, 10, 3, 2); fx.bolt(from, to, C.arc, 0.2, 0.55, 7, 3.5, 1); fx.burst(to, C.volt, 18, 6, 0.4, 0.3, 1, STAR); wave(fx, to, 3, C.volt, 0.35); },
		rain: (fx, at, r) => { for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 12, at.z + Math.sin(a) * rr, 0, -16, 0, 0.75, 0.16, 0.12, C.rain, 0.6, 0, 0, STREAK); } },
	},
	// ===== Chrono: clock faces, gear rings, crystal =====
	'mark-and-recall': { self: (fx, at) => { const g = { x: at.x, y: at.y - 1.68, z: at.z }; fx.decal(g, 1.4, 1.5, 1.8, C.clock, 1, O('rune', { spin: -0.5 })); fx.decal(g, 0.9, 0.9, 1.8, C.clock, 0.9, O('streak', { rot: 0, spin: 6 })); fx.decal(g, 0.6, 0.6, 1.8, C.white, 0.9, O('streak', { rot: 1, spin: 0.5 })); fx.pillar(g, 4, C.clock, 40, 0.8, 0.35, true, STREAK); } },
	quicken: {
		self: (fx, at) => { for (let i = 0; i < 3; i++) fx.circle({ x: at.x, y: at.y - 1.5 + i * 0.6, z: at.z }, 1 + i * 0.15, C.gear, 18, 0.8, 0.4, i, STAR, 0); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 1.1, 1.2, 1.2, C.gear, 0.8, O('rune', { spin: 5 })); },
		on: (fx, at, t) => { const r = 0.95; for (let k = 0; k < 3; k++) { const a = t * (k % 2 ? -5 : 7) + k * 2; fx.emit(at.x + Math.cos(a) * r, at.y - 1.3 + k * 0.5, at.z + Math.sin(a) * r, 0, 0, 0, 0.35, 0.26, 0.08, C.gear, 0.95, 0, 0, STAR); } },
	},
	stasis: {
		mark: (fx, T) => { if (Math.random() < 0.6) { const a = Math.random() * 6.283, e = rnd(1.2); fx.emit(T.bound.x + Math.cos(a) * Math.cos(e) * 0.75, T.bound.y + Math.sin(e) * 1.1, T.bound.z + Math.sin(a) * Math.cos(e) * 0.75, 0, 0, 0, 0.7, 0.85, 0.85, C.crystal, 0.9, 0, 0, SHARD); } if (Math.random() < 0.08) fx.emit(T.bound.x, T.bound.y, T.bound.z, 0, 0, 0, 0.6, 2, 2, C.clock, 0.6, 0, 0, RUNE); if (Math.random() < 0.05) fx.decal({ x: T.bound.x, y: T.bound.y - 1.2, z: T.bound.z }, 0.9, 1, 0.8, C.crystal, 0.7, O('rune', { spin: 0.2 })); },
	},
	rewind: { self: (fx, at, path) => { const n = path?.length || 0; for (let k = 0; k < n; k++) { const q = path[k]; fx.emit(q.x, q.y - 0.6, q.z, 0, 0, 0, 0.4 + k / n * 0.8, 0.6, 0.25, k % 2 ? C.rewind : C.clock, 0.9, 0, 0, RING); } fx.spiral({ x: at.x, y: at.y - 0.8, z: at.z }, 1.4, C.rewind, 28, 0.6, 0.3, 2, true, STAR); fx.decal({ x: at.x, y: at.y - 1.68, z: at.z }, 1.3, 0.3, 0.8, C.rewind, 0.8, O('rune', { spin: -6 })); } },
	// ===== Primal: fire, ice, rain =====
	cinder: {
		trail: (fx, p, d, s) => { for (let k = 0; k < 3; k++) fx.emit(p.x - d.x * s * k / 3 + rnd(0.08), p.y - d.y * s * k / 3, p.z - d.z * s * k / 3 + rnd(0.08), rnd(0.3), 0.8, rnd(0.3), 0.35, k ? 0.6 : 0.8, 0.12, k ? C.fire : C.flameCore, 1, 0, 0, FLAME); if (Math.random() < 0.7) embers(fx, p, C.amber, 1, 0.6, 0.7, 0.1, -1); if (Math.random() < 0.4) smokeTrail(fx, p, d, s, C.inkSmoke, null, 0.35, 1); },
		hit: (fx, at) => { for (let k = 0; k < 18; k++) fx.emit(at.x + rnd(0.4), at.y + rnd(0.2), at.z + rnd(0.4), rnd(1), 2 + Math.random() * 2, rnd(1), 0.7, 0.8, 0.15, k % 3 ? C.fire : C.flameCore, 1, 0, 1, FLAME); embers(fx, at, C.amber, 12, 3, 1.2, 0.1, 4); inkPuff(fx, at, C.inkSmoke, 5, 0.4, 0.9, 1.6, 0.45); fx.decal({ x: at.x, y: at.y - 1, z: at.z }, 0.5, 1.4, 1.2, C.fire, 0.6, O('flame')); },
	},
	'frost-nova': {
		blast: (fx, at, r) => { for (let k = 0; k < 36; k++) { const a = k / 36 * 6.283, v = r / 0.35; fx.emit(at.x, at.y + 0.3, at.z, Math.cos(a) * v, 0.5, Math.sin(a) * v, 0.4, 0.6, 0.35, k % 2 ? C.ice : C.frost, 1, 0, 5, O('shard', { rot: -a + 1.5708 })); } for (let k = 0; k < 28; k++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 0.1, at.z + Math.sin(a) * rr, 0, 0, 0, 2.2, 0.45, 0.4, C.frost, 0.75, 0, 0, STAR); } wave(fx, at, r * 0.85, C.white, 0.4, 0.5); fx.decal(at, r * 0.9, r, 2.2, C.ice, 0.45, O('star', { rot: 0.3 })); },
		mark: (fx, T) => { if (Math.random() < 0.4) fx.emit(T.bound.x + rnd(0.35), T.bound.y + rnd(0.7), T.bound.z + rnd(0.35), 0, 0, 0, 0.8, 0.35, 0.35, C.ice, 0.9, 0, 0, SHARD); },
	},
	'call-rain': { rain: (fx, at, r) => { for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, rr = r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * rr, at.y + 12, at.z + Math.sin(a) * rr, 0, -15, 0, 0.85, 0.14, 0.1, C.rain, 0.6, 0, 0, STREAK); } if (Math.random() < 0.5) { const a = Math.random() * 6.283, rr = 8 * Math.sqrt(Math.random()); fx.decal({ x: at.x + Math.cos(a) * rr, y: at.y - 1.68, z: at.z + Math.sin(a) * rr }, 0.05, 0.8, 0.8, C.rain, 0.8, RING); } } },
};

// the look of a spell, with its school's soft orb for whatever it does not draw itself
export function lookOf(spell) { return LOOK[spell?.id] || {}; }
export const schoolGlow = (spell) => GLOW[spell?.type === 'frost' ? 'frost' : spell?.school] || GLOW.light;
// (for the tests: the spells that have a look of their own)
export const LOOK_IDS = Object.keys(LOOK);
