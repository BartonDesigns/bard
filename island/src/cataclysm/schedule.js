// When a catastrophe comes, and how bad it is: pure, with no scene and no clock of its own, so
// the tests can read a year of it. Time is the game's own clock in hours (the sky's hour of the
// day unwrapped, kept by cataclysm/index.js), cut into days. Each day, each region rolls once
// for each kind of trouble its land allows, from the world's seed, the region's id and the day:
// the same world gives every player the same catastrophes on the same days. They are rare (a
// region sees one every couple of months of game days) and never close together.
//
// The kinds:
//   quake      the Bay is quake country (the Hayward and San Andreas faults); elsewhere on
//              Earth less often, and on a magma world the ground shakes with the mountain
//   wildfire   dry hills and brush, mostly in the dry months (June to November in the Bay)
//   eruption   a magma world's great eruption: the vent opens and the ash comes down

export const KINDS = Object.freeze(['quake', 'wildfire', 'eruption']);
export const DAY = 24;
// (after one, nothing more for this many game hours, wherever you are)
export const QUIET = 72;
// (an event is still met if you come into its region within this many hours of its start)
export const LATE = 0.75;

export function hashOf(...parts) {
	let h = 2166136261;
	for (const c of parts.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
	return h >>> 0;
}
export const roll = (...parts) => hashOf(...parts) / 4294967296;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// the land: { earth, bay, magma, month (1..12), wild (0..1, how much open country is about) }
export function envOf({ earth = false, bay = false, planet = '', month = 7, wild = 0.5 } = {}) {
	const type = String(planet || '').toUpperCase();
	return { earth: !!earth, bay: !!bay, magma: type === 'MAGMA' || type === 'VOLCANIC', month: Math.max(1, Math.min(12, month | 0)), wild: clamp(wild), dry: dryness(month, !!earth) };
}
// how dry the brush is by the month (the Bay's: the rains end in spring, the hills are gold by
// July, the fire season runs to the first storms of November)
export function dryness(month, earth = true) {
	if (!earth) return 0.4;
	return [0.1, 0.08, 0.1, 0.18, 0.35, 0.65, 0.85, 1, 1, 0.95, 0.7, 0.25][(Math.max(1, Math.min(12, month | 0)) - 1)];
}
// a day's chance of each kind, by the land
export function chancesFor(env) {
	const out = [];
	if (env.magma) { out.push({ kind: 'eruption', p: 0.03 }); out.push({ kind: 'quake', p: 0.008 }); return out; }
	if (env.earth) {
		out.push({ kind: 'quake', p: env.bay ? 0.012 : 0.005 });
		out.push({ kind: 'wildfire', p: 0.016 * env.dry * (0.3 + 0.7 * env.wild) });
		return out;
	}
	out.push({ kind: 'quake', p: 0.004 });
	return out;
}

// the magnitude of a quake from its severity (0..1): moderate to major, 5.4 to 7.6
export const magnitudeOf = (sev) => Math.round((5.4 + clamp(sev) * 2.2) * 10) / 10;
// how far out a quake can break things, in metres
export const quakeRadius = (mag) => Math.round(120 * Math.pow(2, mag - 5));
// the shaking at a distance d (metres) from the epicentre: 0 felt but harmless .. 1 violent
export const shakeAt = (mag, d) => clamp((mag - 4.6 - 1.7 * Math.log10(1 + Math.max(0, d) / 140)) / 2.8);
// how long the strong shaking lasts, in seconds
export const quakeDuration = (mag) => Math.round(8 + (mag - 5) * 9);
// when the shaking arrives at a distance: the waves cross a kilometre in about a third of a second
export const arrival = (d) => Math.max(0, d) / 3200;

// the aftershocks over the next few minutes (seconds after the main shock, magnitude): the
// largest about 1.2 below the main one (Bath's law), the rest smaller, crowded early and
// thinning out later (Omori)
export function aftershocks(seed, mag, span = 480) {
	const n = Math.max(2, Math.round((mag - 5) * 2.5));
	const out = [];
	for (let k = 0; k < n; k++) {
		const u = roll(seed, 'after', k), t = 20 + span * Math.pow(u, 2.2);
		const m = mag - 1.2 - Math.pow(roll(seed, 'afterM', k), 0.7) * 1.4 * (k ? 1 : 0.2);
		out.push({ t: Math.round(t), mag: Math.round(m * 10) / 10 });
	}
	return out.sort((a, b) => a.t - b.t);
}

// what the shaking does to one building: I the shaking there (0..1), tough its strength (a timber
// house 0.75, a shop 1, a block 1.25, a steel tower 1.8: structures/damage.js), height in
// metres, roll 0..1. 'none', 'glass', 'crack', 'partial' or 'collapse'
export function damageFor(I, tough = 1, height = 8, r = 0.5) {
	const soft = 1 + clamp((height - 10) / 40) * 0.35 - clamp((height - 60) / 80) * 0.3;
	const v = I * (1.1 / Math.max(0.5, tough)) * soft;
	if (r < (v - 0.82) * 1.5) return 'collapse';
	if (r < (v - 0.62) * 1.4) return 'partial';
	if (r < (v - 0.4) * 1.3) return 'crack';
	if (r < (v - 0.15) * 1.6) return 'glass';
	return 'none';
}

// the day's event in a region, or null: { id, kind, region, day, start (game hours), severity,
// magnitude (quakes), bearing and distance of its heart from where you are, seed }
export function eventFor(seed, region, day, env, rate = 1) {
	let acc = 0;
	const u = roll(seed, region, day, 'cataclysm');
	for (const c of chancesFor(env)) {
		acc += c.p * rate;
		if (u >= acc) continue;
		const s = hashOf(seed, region, day, c.kind);
		const sev = clamp(Math.pow(roll(s, 'sev'), 1.6));
		const ev = {
			id: `${c.kind}:${region}:${day}`, kind: c.kind, region, day,
			start: Math.round((day * DAY + 2 + roll(s, 'at') * 20) * 100) / 100,
			severity: Math.round(sev * 100) / 100,
			bearing: Math.round(roll(s, 'brg') * 628) / 100,
			distance: Math.round(c.kind === 'quake' ? 60 + roll(s, 'dist') * 240 : c.kind === 'wildfire' ? 260 + roll(s, 'dist') * 260 : 0),
			seed: s,
		};
		if (c.kind === 'quake') ev.magnitude = magnitudeOf(sev);
		return ev;
	}
	return null;
}
// the events coming in a region over the next days, the quiet after each respected
export function upcoming(seed, region, fromHour, days, env, rate = 1) {
	const out = [];
	let last = -1e9;
	const d0 = Math.floor(fromHour / DAY);
	for (let d = d0; d < d0 + days; d++) {
		const ev = eventFor(seed, region, d, env, rate);
		if (!ev || ev.start < fromHour || ev.start - last < QUIET) continue;
		out.push(ev); last = ev.start;
	}
	return out;
}
// the event due now in a region, if there is one not met yet: started within LATE hours of now,
// and not inside the quiet after the last one (lastAt, game hours)
export function due(seed, region, now, env, { seen = null, lastAt = -1e9, rate = 1 } = {}) {
	if (now - lastAt < QUIET) return null;
	const d = Math.floor(now / DAY);
	for (const day of [d, d - 1]) {
		const ev = eventFor(seed, region, day, env, rate);
		if (!ev || now < ev.start || now > ev.start + LATE) continue;
		if (seen && (seen.has ? seen.has(ev.id) : seen.includes(ev.id))) continue;
		return ev;
	}
	return null;
}

// the stages of an event, by seconds since it began. A quake: the shaking (its length), the
// aftermath (the rescue, the aftershocks), then recovery; a wildfire: burning until it is held
// (the director says when), then aftermath and recovery; an eruption: the ash, then recovery.
// Recovery is counted in game hours by the director (the crews held off until it ends).
export const TIMES = Object.freeze({
	quake: { aftermath: 420 },
	wildfire: { burn: 600, aftermath: 240 },
	eruption: { ash: 240, aftermath: 120 },
});
export const RECOVERY_H = 1.5;
// heldAt: for a wildfire, the second it was held (no flames left), or null while it burns
export function phaseOf(ev, t, heldAt = null) {
	if (ev.kind === 'quake') {
		const D = quakeDuration(ev.magnitude || 6);
		return t < D ? 'shaking' : t < D + TIMES.quake.aftermath ? 'aftermath' : 'over';
	}
	if (ev.kind === 'wildfire') {
		const B = TIMES.wildfire.burn * (0.7 + 0.6 * (ev.severity || 0.5));
		if (heldAt == null && t < B) return 'burning';
		return t < Math.min(B, heldAt ?? B) + TIMES.wildfire.aftermath ? 'aftermath' : 'over';
	}
	const A = TIMES.eruption.ash * (0.7 + 0.6 * (ev.severity || 0.5));
	return t < A ? 'ash' : t < A + TIMES.eruption.aftermath ? 'aftermath' : 'over';
}

// words for the alert
export const NAMES = Object.freeze({ quake: 'Earthquake', wildfire: 'Wildfire', eruption: 'Eruption' });
export function headline(ev, place = '') {
	const where = place ? `: ${place}` : '';
	if (ev.kind === 'quake') return `Earthquake, magnitude ${(ev.magnitude || 6).toFixed(1)}${where}`;
	if (ev.kind === 'wildfire') return `Wildfire${ev.severity > 0.6 ? ', spreading fast' : ''}${where}`;
	return `Major eruption${where}`;
}
