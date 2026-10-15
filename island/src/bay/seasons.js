// The street's year, from the calendar (calendar.js): lights strung on the houses and the
// downtown trees from the day after Thanksgiving to Twelfth Night, lit after dark;
// sprinklers on the lawns in the early morning through the dry months; the deciduous street
// trees turning in autumn and dropping their leaves in drifts; the lawns nobody waters
// browning off in late summer. Pure: dates in, numbers out (the uniforms at the end are the
// ground shader's, set by apply()).

// the fourth Thursday of November
export function thanksgiving(year) {
	const first = new Date(year, 10, 1).getDay();             // 0 Sunday
	return 1 + ((4 - first + 7) % 7) + 21;
}
// the holiday lights: up from the day after Thanksgiving through 6 January
export function lightsUp(d) {
	const m = d.getMonth(), day = d.getDate();
	if (m === 11) return true;
	if (m === 0) return day <= 6;
	if (m === 10) return day > thanksgiving(d.getFullYear());
	return false;
}
// a house that puts lights up, and which: 0 none, 1 all colours, 2 warm white, 3 cool white
// icicles; seed: the house's own (decor.js seedAt). Most do, the old blocks a little more.
export function houseLights(seed, d, old = false) {
	if (!lightsUp(d)) return 0;
	const r = ((Math.imul(seed | 0, 0x9e3779b1) >>> 0) % 1000) / 1000;
	if (r > (old ? 0.62 : 0.55)) return 0;
	return r < 0.26 ? 1 : r < 0.44 ? 2 : 3;
}
// how lit they are by the light of day (night: 0 day .. 1 night): off till dusk, full after
export const lightsK = (night) => Math.max(0, Math.min(1, (night - 0.25) / 0.35));

// the dry months, May to October, when lawns are watered
export const dryMonth = (m) => m >= 4 && m <= 9;
// a sprinkler's run, on a morning in the dry months: its start (hours) and length, from its
// own roll (0..1); most run between five and half past seven
export function sprinklerRun(r) {
	return { start: 5 + r * 2.1, len: 0.35 + ((r * 7.31) % 1) * 0.3 };
}
// whether a sprinkler with this roll is running at this hour in this month, and how wet its
// patch is (rising while it runs, drying over the next two hours)
export function sprinkling(r, hours, m) {
	if (!dryMonth(m)) return { on: false, wet: 0 };
	const { start, len } = sprinklerRun(r), end = start + len;
	const on = hours >= start && hours < end;
	const wet = hours < start ? 0 : hours < end ? Math.min(1, (hours - start) / 0.15) : Math.max(0, 1 - (hours - end) / 2);
	return { on, wet };
}

// autumn on the deciduous trees, 0 summer green .. 1 full colour (by the month and day; the
// Bay turns late: October into a peak about Thanksgiving, bare-ish by January)
export function autumnK(d) {
	const m = d.getMonth(), t = m + (d.getDate() - 1) / 30;
	if (t < 9) return 0;                                       // before October
	if (t < 10.8) return (t - 9) / 1.8;                       // October into late November
	if (t < 12) return 1;
	return t < 13 ? 1 - (t - 12) : 0;
}
// the dead leaves lying under them (0..1): a little after the colour, lingering into January
export function leafDrift(d) {
	const m = d.getMonth(), t = m + (d.getDate() - 1) / 30;
	if (m === 0) return 0.6 - (d.getDate() - 1) / 50;
	if (t < 9.6) return 0;
	return Math.min(1, (t - 9.6) / 1.4);
}
// a deciduous crown's colour this day: summer's toward its autumn one (sRGB-ish triples)
export function crownColour(summer, fall, k, out = [0, 0, 0]) {
	for (let i = 0; i < 3; i++) out[i] = fall ? summer[i] + (fall[i] - summer[i]) * k : summer[i];
	return out;
}
// lawns nobody waters browning off: late summer into the first rains
export function lawnDry(d) {
	return [0, 0, 0, 0, 0.05, 0.15, 0.4, 0.75, 0.85, 0.55, 0.12, 0][d.getMonth()];
}

// the ground shader's share (bay/terrain.js)
export const SEASON_U = { uLawnDry: { value: 0 } };
export function apply(d) {
	SEASON_U.uLawnDry.value = lawnDry(d);
}
