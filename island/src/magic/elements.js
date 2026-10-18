// What each element does to the one it strikes, past the blow itself: radiant light sears, fire
// burns, frost chills and then freezes, storm jolts and leaps to the next, shadow leaves dread
// (they take more from you), the void unravels them (the blow echoes), blight rots. Each has a
// look of its own on the body while it lasts (fx.js), and every number is here, for the caster
// and the skills menu alike.
//
// The follow-on damage (a burn's ticks, an echo, a leap) is a share of the blow as it landed, so
// whatever made the blow stronger or weaker (power, perks, armour) carries through once, and the
// follow-on never sets off another. Fighters take everything; anything vast (a boss) takes the
// damage and the dread but cannot be slowed, frozen or jolted.

import { SHAPE } from './fx.js';

// share: of the blow, dealt over t (s) | slow: pace kept, for t | freeze: hits to freeze, held for
// hold (s) | stun: held (s) | leap: share to the nearest other foe within r (m) | vuln: more taken
// from you, for t | echo: share again after delay (s)
export const ELEMENTS = Object.freeze({
	radiant: { name: 'Searing', glyph: '☀', share: 0.25, t: 3, text: 'Sears: burns for a quarter of the blow again over 3 s.' },
	fire: { name: 'Burning', glyph: '🔥', share: 0.4, t: 4, text: 'Burns: 40% of the blow again over 4 s.' },
	frost: { name: 'Chilled', glyph: '❄', slow: 0.6, t: 3, freeze: 3, hold: 1.5, text: 'Chills: slowed to 60% for 3 s; the third chill in a row freezes them solid for 1.5 s.' },
	storm: { name: 'Shocked', glyph: 'ϟ', stun: 0.35, leap: 0.3, r: 7, text: 'Shocks: jolted still for 0.35 s, and 30% of the blow leaps to the nearest other foe.' },
	shadow: { name: 'Dread', glyph: '☾', vuln: 0.15, t: 4, text: 'Dread: they take 15% more from you for 4 s.' },
	void: { name: 'Unravelled', glyph: '◆', echo: 0.3, delay: 0.9, text: 'Unravels: 30% of the blow strikes again a moment later.' },
	blight: { name: 'Rotting', glyph: '☣', share: 0.3, t: 6, text: 'Rots: 30% of the blow again over 6 s.' },
});

const COL = {
	radiant: [1, 0.78, 0.3], radiantCore: [1, 0.96, 0.8], fire: [1, 0.48, 0.1], fireCore: [1, 0.85, 0.4], smoke: [0.09, 0.07, 0.06],
	frost: [0.7, 0.93, 1], ice: [0.88, 0.97, 1], storm: [0.6, 0.85, 1], spark: [0.95, 0.98, 1],
	shadow: [0.55, 0.3, 1], ink: [0.05, 0.02, 0.09], void: [0.42, 0.75, 1], voidDeep: [0.35, 0.25, 1], blight: [0.55, 0.95, 0.15],
};
const O = (shape, extra = {}) => ({ shape: SHAPE[shape], ...extra });
const FLAME = O('flame'), STAR = O('star', { spin: 2 }), SHARD = O('shard', { spin: 1.2 }), SMOKE = O('smoke', { ink: true, spin: 0.4 }), DRIP = O('flame', { rot: Math.PI }), EYES = O('eyes'), RING = O('ring'), HEX = O('hex', { spin: 0.4 });
const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;

// how each shows on a body (b: its bound) while it lasts, drawn a few times a second, and the
// moment it lands or ends
const SHOW = {
	radiant(fx, b) { fx.emit(b.x, b.y, b.z, 0, 0.3, 0, 0.2, 1.5, 1.3, COL.radiant, 0.3, 0, 0); for (let k = 0; k < 3; k++) fx.emit(b.x + rnd(0.3), b.y - 0.4 + Math.random() * 1.2, b.z + rnd(0.3), rnd(0.2), 1.2, rnd(0.2), 0.5, 0.35, 0.08, k ? COL.radiant : COL.radiantCore, 1, 0, 0, FLAME); if (Math.random() < 0.4) fx.emit(b.x + rnd(0.4), b.y + rnd(0.6), b.z + rnd(0.4), 0, 0.6, 0, 0.4, 0.18, 0.05, COL.radiantCore, 1, 0, 0, STAR); },
	fire(fx, b) { fx.emit(b.x, b.y, b.z, 0, 0.5, 0, 0.2, 1.6, 1.4, COL.fire, 0.3, 0, 0); for (let k = 0; k < 4; k++) fx.emit(b.x + rnd(0.3), b.y - 0.6 + Math.random() * 1.3, b.z + rnd(0.3), rnd(0.3), 1.6 + Math.random(), rnd(0.3), 0.55, k ? 0.65 : 0.85, 0.12, k ? COL.fire : COL.fireCore, 1, 0, 0.3, FLAME); if (Math.random() < 0.3) fx.emit(b.x, b.y + 0.9, b.z, rnd(0.3), 1, rnd(0.3), 1.2, 0.4, 1.1, COL.smoke, 0.5, 0, 0.6, SMOKE); },
	frost(fx, b, A) { fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.2, 1.4, 1.4, COL.frost, 0.22, 0, 0); if (Math.random() < 0.8) fx.emit(b.x + rnd(0.35), b.y + rnd(0.7), b.z + rnd(0.35), 0, -0.2, 0, 0.7, 0.3, 0.2, COL.frost, 0.9, 0, 0, SHARD); if (A.frozen > 0) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, e = rnd(1.1); fx.emit(b.x + Math.cos(a) * Math.cos(e) * 0.55, b.y + Math.sin(e) * 0.95, b.z + Math.sin(a) * Math.cos(e) * 0.55, 0, 0, 0, 0.35, 0.7, 0.7, COL.ice, 0.8, 0, 0, SHARD); } },
	storm(fx, b) { for (let k = 0; k < 2; k++) { const a = { x: b.x + rnd(0.4), y: b.y + rnd(0.8), z: b.z + rnd(0.4) }; fx.bolt(a, { x: a.x + rnd(0.9), y: a.y + rnd(0.9), z: a.z + rnd(0.9) }, k ? COL.storm : COL.spark, 0.14, 0.14, 4, 0.3, 0); } fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.12, 1.4, 1.2, COL.storm, 0.35, 0, 0); },
	shadow(fx, b) { fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.2, 1.5, 1.6, COL.shadow, 0.45, 0, 0); if (Math.random() < 0.6) fx.emit(b.x + rnd(0.35), b.y + rnd(0.5), b.z + rnd(0.35), rnd(0.2), 0.5, rnd(0.2), 1, 0.4, 0.9, COL.ink, 0.6, 0, 0.5, SMOKE); if (Math.random() < 0.25) fx.emit(b.x, b.y + 0.4, b.z, rnd(0.3), 0.6, rnd(0.3), 0.8, 0.3, 0.5, COL.shadow, 0.5, 0, 0.5, O('smoke', { spin: 0.4 })); if (Math.random() < 0.06) fx.emit(b.x, b.y + 1.2, b.z, 0, 0.1, 0, 0.7, 0.45, 0.45, COL.shadow, 0.9, 0, 0, EYES); },
	void(fx, b) { fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.2, 1.3, 1.5, COL.voidDeep, 0.3, 0, 0); { const a = Math.random() * 6.283, r = 0.9; fx.emit(b.x + Math.cos(a) * r, b.y + rnd(0.6), b.z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0, -Math.sin(a) * r * 2, 0.45, 0.25, 0.05, COL.void, 1, 0, 0, SHARD); } },
	blight(fx, b) { fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.2, 1.4, 1.3, COL.blight, 0.22, 0, 0); if (Math.random() < 0.8) fx.emit(b.x + rnd(0.3), b.y + 0.2 + rnd(0.4), b.z + rnd(0.3), 0, -0.3, 0, 0.8, 0.3, 0.12, COL.blight, 1, 4, 0.2, DRIP); if (Math.random() < 0.2) fx.emit(b.x, b.y + 0.5, b.z, rnd(0.3), 0.3, rnd(0.3), 1.3, 0.4, 1, [0.05, 0.1, 0.02], 0.5, 0, 0.6, SMOKE); },
};
const LAND = {
	freeze(fx, b) { fx.burst(b, COL.ice, 24, 3, 0.5, 0.35, 0.5, SHARD); fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.4, 0.6, 2.2, COL.frost, 1, 0, 0, HEX); },
	thaw(fx, b) { fx.burst(b, COL.ice, 16, 4, 0.5, 0.3, 4, SHARD); },
	leap(fx, a, b) { fx.bolt(a, b, COL.storm, 0.18, 0.22, 8, 0.7, 1); },
	echo(fx, b) { fx.emit(b.x, b.y, b.z, 0, 0, 0, 0.3, 2.4, 0.3, COL.voidDeep, 1, 0, 0, RING); fx.burst(b, COL.void, 18, -4, 0.3, 0.3, 0, SHARD); },
	dread(fx, b) { fx.emit(b.x, b.y + 1.3, b.z, 0, 0.2, 0, 0.8, 0.5, 0.6, COL.shadow, 1, 0, 0, EYES); },
};

// How a foe your element kills goes down, played over its time (s) where they fell: burned to ash,
// seared to light, shattered, scattered as sparks, dissolved to shadow, folded into nothing, melted
const FALL = {
	radiant: { t: 1.1, step(fx, p, u) { for (let k = 0; k < 4; k++) fx.emit(p.x + rnd(0.35), p.y - 0.8 + Math.random() * 1.6 * (1 - u), p.z + rnd(0.35), rnd(0.2), 2.5 + Math.random() * 2, rnd(0.2), 0.8, 0.3, 0.05, k % 2 ? COL.radiant : COL.radiantCore, 1, 0, 0, STAR); if (u < 0.1) fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.3, 0.8, 3, COL.radiantCore, 1, 0, 0); if (Math.random() < 0.3) fx.emit(p.x + rnd(0.3), p.y + rnd(0.6), p.z + rnd(0.3), rnd(0.4), 0.8, rnd(0.4), 1.6, 0.12, 0.08, [0.25, 0.22, 0.2], 0.9, -0.6, 0.6, O('smoke', { ink: true })); } },
	fire: { t: 1.4, step(fx, p, u) { for (let k = 0; k < 4; k++) fx.emit(p.x + rnd(0.4), p.y - 0.8 + Math.random() * 1.7 * (1 - u * 0.6), p.z + rnd(0.4), rnd(0.4), 2 + Math.random() * 1.5, rnd(0.4), 0.6, 0.8 - u * 0.4, 0.12, k % 2 ? COL.fire : COL.fireCore, 1, 0, 0.3, FLAME); if (Math.random() < 0.5) fx.emit(p.x, p.y + 0.6, p.z, rnd(0.4), 1.4, rnd(0.4), 1.6, 0.5, 1.6, COL.smoke, 0.55, 0, 0.5, SMOKE); if (Math.random() < 0.5) fx.emit(p.x + rnd(0.3), p.y, p.z + rnd(0.3), rnd(1.5), 2 + Math.random() * 2, rnd(1.5), 1.2, 0.1, 0.03, COL.fireCore, 1, 3, 0.5, STAR); } },
	frost: { t: 0.3, step(fx, p, u) { if (u < 0.34) { for (let k = 0; k < 28; k++) fx.emit(p.x + rnd(0.3), p.y + rnd(0.8), p.z + rnd(0.3), rnd(4), 1 + Math.random() * 3, rnd(4), 1.1, 0.35 + Math.random() * 0.3, 0.2, k % 3 ? COL.frost : COL.ice, 1, 9, 0.3, SHARD); fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.35, 0.5, 2.6, COL.ice, 1, 0, 0, HEX); } } },
	storm: { t: 0.8, step(fx, p) { const a = { x: p.x + rnd(0.4), y: p.y + rnd(0.8), z: p.z + rnd(0.4) }; fx.bolt(a, { x: a.x + rnd(1.2), y: a.y + rnd(1), z: a.z + rnd(1.2) }, COL.spark, 0.1, 0.12, 4, 0.35, 0); if (Math.random() < 0.4) fx.emit(p.x, p.y + 0.4, p.z, rnd(0.3), 0.9, rnd(0.3), 1.2, 0.35, 1.2, COL.smoke, 0.5, 0, 0.6, SMOKE); } },
	shadow: { t: 1.2, step(fx, p, u) { for (let k = 0; k < 2; k++) fx.emit(p.x + rnd(0.35), p.y - 0.8 + Math.random() * 1.6 * (1 - u), p.z + rnd(0.35), rnd(0.3), 1 + Math.random(), rnd(0.3), 1.2, 0.5, 1.2, COL.ink, 0.75, 0, 0.5, SMOKE); fx.emit(p.x + rnd(0.3), p.y + rnd(0.6), p.z + rnd(0.3), rnd(0.3), 1.2, rnd(0.3), 0.9, 0.3, 0.7, COL.shadow, 0.45, 0, 0.5, O('smoke', { spin: 0.4 })); if (u < 0.1) fx.emit(p.x, p.y + 1.3, p.z, 0, 0.6, 0, 0.9, 0.5, 0.2, COL.shadow, 1, 0, 0, EYES); } },
	void: { t: 0.6, step(fx, p, u) { for (let k = 0; k < 4; k++) { const a = Math.random() * 6.283, e = rnd(1.2), r = 1.4 * (1 - u); fx.emit(p.x + Math.cos(a) * Math.cos(e) * r, p.y + Math.sin(e) * r, p.z + Math.sin(a) * Math.cos(e) * r, -Math.cos(a) * r * 3, -Math.sin(e) * r * 3, -Math.sin(a) * r * 3, 0.3, 0.3, 0.05, k % 2 ? COL.void : COL.voidDeep, 1, 0, 0, SHARD); } if (u > 0.85) fx.emit(p.x, p.y, p.z, 0, 0, 0, 0.35, 0.3, 2.4, COL.void, 1, 0, 0, RING); } },
	blight: { t: 1.3, step(fx, p, u) { for (let k = 0; k < 3; k++) fx.emit(p.x + rnd(0.35), p.y + 0.6 - u * 1.2 + rnd(0.3), p.z + rnd(0.35), 0, -0.4, 0, 0.9, 0.28, 0.12, COL.blight, 1, 5, 0.2, DRIP); if (Math.random() < 0.4) fx.emit(p.x, p.y - 0.6, p.z, rnd(0.5), 0.5, rnd(0.5), 1.8, 0.5, 1.6, [0.05, 0.1, 0.02], 0.6, 0, 0.5, SMOKE); if (u < 0.1) fx.decal({ x: p.x, y: p.y - 1, z: p.z }, 0.3, 1.4, 3, COL.blight, 0.5, O('smoke')); } },
};

// The afflictions on whoever has been struck. deal(T, amount, type, at): a follow-on blow (it must
// not afflict again); hex(T, status): a status on a fighter (hold, slow); near(T, r): the nearest
// other foe
export function createAfflictions({ fx, deal, hex, near }) {
	const on = new Map(), falls = [];
	const vast = (T) => T.kind === 'boss';
	function of(T) { let A = on.get(T); if (!A) on.set(T, (A = { dot: {}, vuln: 0, vulnT: 0, shockT: 0, chill: 0, chillT: 0, frozen: 0, echoes: [], showT: 0 })); return A; }
	// struck by type for dealt (as it landed)
	function apply(T, type, dealt, at) {
		const E = ELEMENTS[type];
		if (!E || !T?.bound || !(dealt > 0)) return null;
		const A = of(T), b = T.bound;
		if (E.share) { const d = A.dot[type] || (A.dot[type] = { left: 0, t: 0, acc: 0 }); d.left += dealt * E.share; d.t = Math.max(d.t, E.t); }
		if (E.vuln) { if (A.vulnT <= 0) LAND.dread(fx, b); A.vuln = Math.max(A.vuln, E.vuln); A.vulnT = E.t; }
		if (E.echo) A.echoes.push({ t: E.delay, amount: dealt * E.echo, at });
		if (!vast(T)) {
			if (E.slow && A.frozen <= 0) {
				A.chill = A.chillT > 0 ? A.chill + 1 : 1; A.chillT = E.t;
				if (A.chill >= E.freeze) { A.chill = 0; A.frozen = E.hold; hex(T, { hold: E.hold }); LAND.freeze(fx, b); } else hex(T, { slow: E.slow, t: E.t });
			}
			if (E.stun) { hex(T, { hold: E.stun }); for (let k = 0; k < 3; k++) SHOW.storm(fx, b); }
			if (E.stun) A.shockT = 1;
		}
		if (E.leap) { const N = near(T, E.r); if (N) { LAND.leap(fx, { x: b.x, y: b.y + 0.3, z: b.z }, { x: N.bound.x, y: N.bound.y + 0.3, z: N.bound.z }); if (deal(N, dealt * E.leap, type, b)?.killed) fell(N, type); } }
		return E.name;
	}
	// a foe your element has just killed: it goes down in its element's way, where it stood
	function fell(T, type) { const F = FALL[type]; if (!F || !T?.bound) return; falls.push({ F, p: { x: T.bound.x, y: T.bound.y, z: T.bound.z }, t: 0, acc: 1 }); on.delete(T); }
	// how much more they take from you now (dread)
	const vuln = (T) => { const A = on.get(T); return A && A.vulnT > 0 ? A.vuln : 0; };
	function step(dt) {
		for (let i = falls.length - 1; i >= 0; i--) { const f = falls[i]; f.acc += dt; if (f.acc >= 0.1) { f.acc = 0; f.F.step(fx, f.p, Math.min(1, f.t / f.F.t)); } f.t += dt; if (f.t > f.F.t) falls.splice(i, 1); }
		for (const [T, A] of on) {
			if (T.removed || T.ref?.dead || T.dead || !T.bound) { on.delete(T); continue; }
			const b = T.bound;
			let live = false;
			for (const [type, d] of Object.entries(A.dot)) {
				if (d.t <= 0 || d.left <= 0) { delete A.dot[type]; continue; }
				live = true;
				// (what is left of it, dealt evenly over what is left of its time, every half second)
				d.acc += dt;
				if (d.acc >= 0.5 || d.t <= dt) { const n = Math.min(d.left, d.left * Math.min(1, d.acc / Math.max(d.t, 1e-3))); d.left -= n; d.t -= d.acc; d.acc = 0; if (n > 0 && deal(T, n, type, b)?.killed) { fell(T, type); break; } }
			}
			if (A.vulnT > 0) { A.vulnT -= dt; live = true; }
			if (A.shockT > 0) { A.shockT -= dt; live = true; }
			if (A.chillT > 0) { A.chillT -= dt; if (A.chillT <= 0) A.chill = 0; live = true; }
			if (A.frozen > 0) { A.frozen -= dt; live = true; if (A.frozen <= 0) LAND.thaw(fx, b); }
			for (let i = A.echoes.length - 1; i >= 0; i--) { const e = A.echoes[i]; e.t -= dt; live = true; if (e.t <= 0) { LAND.echo(fx, b); A.echoes.splice(i, 1); if (deal(T, e.amount, 'void', e.at)?.killed) { fell(T, 'void'); break; } } }
			// (the look of each that is on them, a few times a second)
			A.showT -= dt;
			if (A.showT <= 0 && live) {
				A.showT = 0.1;
				for (const type of Object.keys(A.dot)) SHOW[type]?.(fx, b, A);
				if (A.vulnT > 0) SHOW.shadow(fx, b, A);
				if (A.chillT > 0 || A.frozen > 0) SHOW.frost(fx, b, A);
				if (A.echoes.length) SHOW.void(fx, b, A);
				if (A.shockT > 0) SHOW.storm(fx, b, A);
			}
			if (!live) on.delete(T);
		}
	}
	return { apply, fell, vuln, step, clear: () => { on.clear(); falls.length = 0; }, info: (T) => { const A = on.get(T); return A ? { dot: Object.fromEntries(Object.entries(A.dot).map(([k, d]) => [k, Math.round(d.left)])), vuln: A.vulnT > 0 ? A.vuln : 0, chill: A.chill, frozen: Math.max(0, A.frozen), echoes: A.echoes.length } : null; }, size: () => on.size };
}
