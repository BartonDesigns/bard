// Hunger: everyone gets hungry. A person eats at their mealtimes (breakfast, lunch, dinner, each a
// little earlier or later for each person) if their house has the food (people/food.js: the
// pantry's quality and security), and between meals hunger climbs again. A hungry person is a
// slower, shorter-tempered, less productive one: at work they get less done (productivity), on
// the street they say so, and a meal put in their hands changes their day. Pure: the hours are
// the sky's (an in-game day), no three, no DOM.

// the mealtimes, sky hours
export const MEALS = Object.freeze([{ id: 'breakfast', h: 7 }, { id: 'lunch', h: 12.5 }, { id: 'dinner', h: 18.75 }]);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const jitter = (seed, i) => ((Math.imul((seed >>> 0) + i * 7919, 2654435761) >>> 0) / 4294967296 - 0.5) * 1.2;

// the meal last eaten before hour h (a person's own times): { meal, h (hours ago) }
export function lastMeal(h, seed = 0) {
	let best = null;
	for (const [i, M] of MEALS.entries()) {
		const at = M.h + jitter(seed, i);
		const ago = ((h - at) % 24 + 24) % 24;
		if (!best || ago < best.ago) best = { meal: M.id, ago };
	}
	return best;
}
// How hungry a person is at hour h (0 fed, 1 starving).
// quality: how well their house eats (people/food.js h.food.quality, 0..1); security: 'secure',
// 'tight' or 'short' (a short house skips meals); fed: hours since a meal someone gave them
// (Infinity when none)
export function hungerAt(h, { seed = 0, quality = 0.6, security = 'secure', fed = Infinity } = {}) {
	const L = lastMeal(h, seed);
	// (overnight hunger builds slower: asleep)
	const ago = L.meal === 'dinner' && (h > 22 || h < 6.5) ? L.ago * 0.45 : L.ago;
	// a thin meal fills you less, and a short house skips one now and then
	const skipped = security === 'short' && ((seed >>> 3) + Math.floor(h / 6)) % 3 === 0 ? 0.35 : 0;
	const base = clamp((1.15 - quality) * 0.3 + skipped);
	const climb = clamp(ago / 6.5) * 0.65;
	const gift = Number.isFinite(fed) ? clamp(1 - fed / 5) * 0.8 : 0;
	return +clamp(base + climb - gift).toFixed(3);
}
// a word for it
export const hungerWord = (x) => (x < 0.25 ? 'fed' : x < 0.5 ? 'peckish' : x < 0.75 ? 'hungry' : 'starving');
// how much a person gets done at work, hungry (1 on a full stomach, about 0.6 starving)
export const productivity = (x) => +(1 - 0.4 * Math.pow(clamp(x), 1.4)).toFixed(3);
// how they carry it: pace and mood shares (people/motion and persona read these)
export const bearing = (x) => ({ pace: +(1 - 0.18 * clamp(x - 0.3) / 0.7).toFixed(3), mood: +(-0.35 * clamp(x - 0.35) / 0.65).toFixed(3) });
// A district's hunger: from its households (people/food.js), at hour h: { mean, short (share of
// houses going short), output (mean productivity of the grown-ups) }
export function districtHunger(households = [], h = 12) {
	let n = 0, sum = 0, short = 0, out = 0;
	for (const H of households) {
		const F = H.food;
		if (!F) continue;
		if (F.security === 'short') short++;
		for (const m of H.members || []) {
			const x = hungerAt(h, { seed: m.seed, quality: F.quality, security: F.security });
			sum += x; n++;
			if (m.age >= 18) out += productivity(x);
		}
	}
	const adults = households.reduce((a, H) => a + (H.members || []).filter((m) => m.age >= 18).length, 0) || 1;
	return { mean: n ? +(sum / n).toFixed(3) : 0, short: households.length ? +(short / households.length).toFixed(3) : 0, output: +(out / adults).toFixed(3) };
}
// a line they might say about it (first person, plain)
const LINES = {
	fed: ['Just ate. I could nap.', 'Full. Dinner was good tonight.', 'I\'m good, thanks, we just ate.'],
	peckish: ['I could eat.', 'Is it nearly dinner time?', 'I\'m starting to think about food.'],
	hungry: ['I\'m starving, honestly.', 'I skipped lunch. Big mistake.', 'I can\'t think straight, I need to eat.'],
	starving: ['There\'s not much in the fridge this week.', 'We\'re making it stretch till payday.', 'I haven\'t eaten since this morning.'],
};
export const hungerLine = (x, seed = 0) => { const L = LINES[hungerWord(x)]; return L[(seed >>> 0) % L.length]; };
