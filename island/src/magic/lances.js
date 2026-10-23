// Lance of Dawn's fall, worked out (pure: no three, no DOM; island/tools/lances.test.mjs). The
// caster (magic/caster.js) throws the volley and deals its harm; the look (magic/looks.js) draws
// each spear on its way and where it strikes; the spell gallery (tools/spell-looks-browser.cjs)
// plays the same volley.
//
// Each lance is called up far out along the line to the sun (the moon by night), hangs there a
// breath as it gathers, then dives on its mark at a slant, slowly at first and ever faster, like
// a missile, and strikes with a boom. Its mastery (I to V) makes it more: bigger spears that grow
// wings, more of them, a wider and more forgiving reach, and at V a great fifth lance at the
// heart of the ring. What the perks and gear add shows too: reach (range) calls them from
// further off, a wider area throws a wider splash, more power burns them hotter and thicker.

// by mastery level (I..V): how many fall; each one's reach (x the spell's r, area perks already in
// it); how far round the aim the ring lies (x the spell's spread); the spear's size; its wings
// (0 none); how much less it strikes at the rim of its reach (falloff); a sunburst of rays on
// the ground where it lands; and at V the fifth at the heart
export const LANCE_MASTERY = Object.freeze([
	Object.freeze({ n: 3, r: 1, spread: 0.78, size: 1, wing: 0, falloff: 0.5, burst: false, heart: false }),
	Object.freeze({ n: 3, r: 1.12, spread: 0.74, size: 1.22, wing: 0.65, falloff: 0.5, burst: false, heart: false }),
	Object.freeze({ n: 4, r: 1.25, spread: 0.7, size: 1.45, wing: 0.85, falloff: 0.45, burst: false, heart: false }),
	Object.freeze({ n: 4, r: 1.38, spread: 0.66, size: 1.7, wing: 1, falloff: 0.4, burst: true, heart: false }),
	Object.freeze({ n: 5, r: 1.65, spread: 0.6, size: 2.05, wing: 1.3, falloff: 0.3, burst: true, heart: true }),
]);
// a further lance of the same fall on one already struck strikes them for this share: more lances
// make the volley surer to catch you, not a heavier blow on one spot
export const LANCE_OVERLAP = 0.3;
// the spear itself (m, at mastery I), the great one at the heart, and its timing (s): called up,
// then the dive, the next one after, and the heart after the ring
export const LANCE_LEN = 7, HEART_K = 1.35;
export const SUMMON = 0.16, FLIGHT = 0.85, STAGGER = 0.11, HEART_AFTER = 0.16;
// how high the line to the sky may stand (radians over the ground): never straight down, never
// skimming the ground
export const LANCE_LOW = 0.56, LANCE_STEEP = 1.05;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the volley's shape for a spell (its numbers already shaped by the perks and gear: r, spread,
// range) at a mastery level (1..5) and power k (magic/spells.js spellPower: affinity, the time of
// day, mastery and the perks): { level, n, r, spread, size, wing, falloff, burst, heart, heat
// (0..1, how much hotter than plain), reach (its range over the spell's own) }
export function lanceShape(spell, level = 1, k = 1, baseRange = spell?.range || 80) {
	const L = clamp(Math.round(+level || 1), 1, LANCE_MASTERY.length), M = LANCE_MASTERY[L - 1];
	return {
		level: L, n: M.n, r: (spell.r || 2.6) * M.r, spread: (spell.spread || 3.2) * M.spread, size: M.size, wing: M.wing,
		falloff: M.falloff, burst: M.burst, heart: M.heart,
		heat: clamp(((+k || 1) - 1) / 0.9, 0, 1), reach: clamp((spell.range || baseRange) / (baseRange || 1), 0.5, 3),
	};
}

// where they come from: the line from the ground toward the sun while it is up, else the moon,
// held between LANCE_LOW and LANCE_STEEP over the ground. A sun nearly overhead gives no side to
// slant from: then they come over your shoulder (back: the way behind you, x and z).
// Returns { dir: unit vector up the line, night }
export function lanceSky(sun, moon, back = { x: 0, z: 1 }) {
	const up = (q) => !!q && q.y > 0.05;
	const night = !up(sun) && up(moon), src = up(sun) ? sun : night ? moon : null;
	let hx = src ? src.x : back.x, hz = src ? src.z : back.z, h = Math.hypot(hx, hz);
	if (h < 0.08) { hx = back.x; hz = back.z; h = Math.hypot(hx, hz) || 1; if (!Math.hypot(back.x, back.z)) { hx = 0; hz = 1; h = 1; } }
	const el = clamp(src ? Math.asin(clamp(src.y / (Math.hypot(src.x, src.y, src.z) || 1), -1, 1)) : 0.85, LANCE_LOW, LANCE_STEEP);
	const c = Math.cos(el);
	return { dir: { x: hx / h * c, y: Math.sin(el), z: hz / h * c }, night };
}

// the volley at at (x, z) for a shape and a sky: one entry a lance, in the order they strike:
// { x, z, dir (unit, up toward where it comes from), wait (s before it is called up), len (m),
// thick, wing, r, heart, from (m: how far out along dir it is called up) }. rnd: Math.random
export function lanceVolley(at, S, sky, rnd = Math.random) {
	const out = [], ring = S.heart ? S.n - 1 : S.n, a0 = rnd() * Math.PI * 2;
	const from = 70 + 40 * (S.reach || 1);
	const thick = 1 + 0.05 * (S.level - 1) + 0.15 * (S.heat || 0), len = LANCE_LEN * S.size * (1 + 0.12 * (S.heat || 0));
	// (each turned a little off the line, so they converge on the mark rather than fall in step)
	const turn = (d, da, de) => {
		const az = Math.atan2(d.z, d.x) + da, el = clamp(Math.asin(clamp(d.y, -1, 1)) + de, LANCE_LOW - 0.05, LANCE_STEEP + 0.05);
		return { x: Math.cos(az) * Math.cos(el), y: Math.sin(el), z: Math.sin(az) * Math.cos(el) };
	};
	for (let i = 0; i < ring; i++) {
		const a = a0 + i / ring * Math.PI * 2, s = S.spread * (0.88 + 0.24 * rnd());
		out.push({ x: at.x + Math.cos(a) * s, z: at.z + Math.sin(a) * s, dir: turn(sky.dir, (rnd() - 0.5) * 0.26, (rnd() - 0.5) * 0.1), wait: i * STAGGER, len, thick, wing: S.wing, r: S.r, heart: false, from });
	}
	if (S.heart) out.push({ x: at.x, z: at.z, dir: { ...sky.dir }, wait: (ring - 1) * STAGGER + HEART_AFTER, len: len * HEART_K, thick: thick * 1.15, wing: S.wing * 1.15, r: S.r * 1.2, heart: true, from: from * 1.1 });
	return out;
}

// where a lance is, t s after the volley was cast: { stage: 'wait' | 'summon' | 'dive' | 'struck',
// d (m: its point's distance from where it strikes, out along dir), u (0..1 through the dive),
// a (0..1: how far it has come into being), v (m/s: its speed) }. The dive eases in, slow out
// there and ever faster, so the last stretch is a blur and the blow lands hard.
export const EASE = 1.9;
export function lanceFlight(L, t) {
	const s = t - L.wait;
	if (s < 0) return { stage: 'wait', d: L.from, u: 0, a: 0, v: 0 };
	if (s < SUMMON) return { stage: 'summon', d: L.from, u: 0, a: s / SUMMON, v: 0 };
	const u = (s - SUMMON) / FLIGHT;
	if (u >= 1) return { stage: 'struck', d: 0, u: 1, a: 1, v: L.from * EASE / FLIGHT };
	return { stage: 'dive', d: L.from * (1 - Math.pow(u, EASE)), u, a: 1, v: L.from * EASE * Math.pow(u, EASE - 1) / FLIGHT };
}
// when it strikes (s after the cast)
export const lanceStrikes = (L) => L.wait + SUMMON + FLIGHT;

// what a lance does to one it reaches, d m from where it struck, already struck by `before` of
// the same volley: the share of the spell's harm (the rim takes less, by the shape's falloff; a
// second lance less again)
export function lanceShare(S, L, d, before = 0) {
	if (d > L.r) return 0;
	return (1 - (S.falloff ?? 0.5) * d / L.r) * (before ? LANCE_OVERLAP : 1) * (L.heart ? 1.2 : 1);
}
