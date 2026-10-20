// A cooked meal's strength: eat a dish you cooked (cooking/recipes.js) and what it gives stays with
// you for the rest of your day, through every fight and every death, until the small hours
// (DAY_ENDS, your own clock: a whole evening of dungeons with your crew on one dinner). Two or
// three different meals stack; a fourth pushes out the oldest, and the same dish twice only tops
// it up. magic/stats.js composeMods folds the meals into state.mods (foldMeals).
//
// Why your real day and not the sky's: the sky's day passes in about eleven minutes, so a meal
// gone at its next dawn would be gone before the dungeon. Pure: no three, no DOM.

import { RECIPE } from './recipes.js';

// the most meals that count at once
export const MAX_MEALS = 3;
// the hour (your own clock) a day's meals wear off
export const DAY_ENDS = 4;

// when a meal eaten at time t wears off: the next DAY_ENDS o'clock, local time
export function dayEnd(t = Date.now()) {
	const d = new Date(t);
	const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAY_ENDS, 0, 0, 0);
	if (end.getTime() <= t) end.setDate(end.getDate() + 1);
	return end.getTime();
}
// a meal: { id (the recipe), q (quality, 0.85..1.1), at, until }
const valid = (m) => !!m && typeof m.id === 'string' && !!RECIPE[m.id] && Number.isFinite(m.until) && Number.isFinite(m.q);
// the meals still on you at t
export const active = (meals = [], t = Date.now()) => (Array.isArray(meals) ? meals : []).filter((m) => valid(m) && m.until > t);
// eat a plate of `id` at quality q: { meals (the new list), replaced (a meal pushed out, or null),
// topped (it was already on you) }
export function eat(meals, id, q = 1, t = Date.now()) {
	if (!RECIPE[id]) return { meals: active(meals, t), replaced: null, topped: false };
	const list = active(meals, t);
	const same = list.find((m) => m.id === id);
	if (same) { same.q = Math.max(same.q, q); same.at = t; same.until = dayEnd(t); return { meals: list, replaced: null, topped: true }; }
	let replaced = null;
	if (list.length >= MAX_MEALS) { list.sort((a, b) => a.at - b.at); replaced = list.shift(); }
	list.push({ id, q: +(+q).toFixed(3), at: t, until: dayEnd(t) });
	return { meals: list, replaced, topped: false };
}
// what the meals give together, as mods: { stat: value } (power and cd as shares of every school)
export function mealMods(meals = [], t = Date.now()) {
	const out = {};
	for (const m of active(meals, t)) for (const [k, v] of Object.entries(RECIPE[m.id].buff.mods)) out[k] = (out[k] || 0) + v * m.q;
	return out;
}
// the meals folded into composeMods' m (in place)
export function foldMeals(m, meals = [], t = Date.now()) {
	const add = mealMods(meals, t);
	for (const [k, v] of Object.entries(add)) {
		if (k === 'power' || k === 'cd' || k === 'mana') { m[k] ||= {}; m[k].all = (m[k].all || 0) + v; }
		else m[k] = (m[k] || 0) + v;
	}
	return m;
}
// a short fingerprint of what is on you (so the stats are made anew when it changes)
export const mealSig = (meals = [], t = Date.now()) => active(meals, t).map((m) => `${m.id}:${m.q}`).sort().join(',');
// how long a meal has left, in words: "until 4 am (9 h 12 min)"
export function leftText(m, t = Date.now()) {
	const ms = Math.max(0, m.until - t), h = Math.floor(ms / 3600000), min = Math.floor(ms / 60000) % 60;
	return `until ${DAY_ENDS} am (${h ? `${h} h ` : ''}${min} min)`;
}
