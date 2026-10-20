// Your larder: the food you carry (a cool box and a sack: what you caught, what you hunted, what
// you bought), the plates you cooked and kept for later, and what of it came off your own line or
// out of your own hunt (cooking/recipes.js cooks that a little better). Kept in this browser
// (and so in your cloud save: persistence/cloud-save.js takes every progress key).
// Plain data: no three, no DOM.

import { INGREDIENTS } from './ingredients.js';
import { RECIPE } from './recipes.js';
import { dayEnd } from './meals.js';

export const LARDER_KEY = 'l99-larder-v1';
// the most of one ingredient you carry (grams, millilitres or whole ones): a cool box's worth
export const CARRY = Object.freeze({ g: 12000, ml: 6000, each: 60 });
// the most plates you keep
export const PLATES_MAX = 12;

export function createLarder(saved = null) {
	const L = { v: 1, have: {}, wild: {}, plates: [], meals: [], log: [] };
	if (saved && typeof saved === 'object') {
		for (const [id, n] of Object.entries(saved.have || {})) if (INGREDIENTS[id] && Number.isFinite(n) && n > 0) L.have[id] = n;
		for (const [id, n] of Object.entries(saved.wild || {})) if (INGREDIENTS[id] && Number.isFinite(n) && n > 0) L.wild[id] = n;
		if (Array.isArray(saved.plates)) L.plates = saved.plates.filter((p) => p && RECIPE[p.id] && Number.isFinite(p.until)).slice(-PLATES_MAX);
		if (Array.isArray(saved.meals)) L.meals = saved.meals.filter((m) => m && RECIPE[m.id] && Number.isFinite(m.until));
		if (Array.isArray(saved.log)) L.log = saved.log.slice(-40);
	}
	return L;
}
export const saveLarder = (L) => ({ v: 1, have: L.have, wild: L.wild, plates: L.plates, meals: L.meals, log: L.log.slice(-40) });

// put food in: returns what fit (the rest left behind)
export function stow(L, id, n, { wild = false } = {}) {
	const I = INGREDIENTS[id];
	if (!I || !(n > 0)) return 0;
	const room = Math.max(0, CARRY[I.unit] - (L.have[id] || 0)), put = Math.min(room, n);
	if (put <= 0) return 0;
	L.have[id] = +((L.have[id] || 0) + put).toFixed(3);
	if (wild) L.wild[id] = +((L.wild[id] || 0) + put).toFixed(3);
	return put;
}
// take food out (n or all of it): what came out
export function take(L, id, n = Infinity) {
	const had = L.have[id] || 0, out = Math.min(had, n);
	if (out <= 0) return 0;
	const left = +(had - out).toFixed(3);
	if (left <= 1e-6) delete L.have[id]; else L.have[id] = left;
	// (what was your own catch goes first: the wild share follows what is left)
	if (L.wild[id]) { L.wild[id] = Math.min(L.wild[id], left); if (L.wild[id] <= 1e-6) delete L.wild[id]; }
	return out;
}
// after cooking from the larder (its amounts already changed in place): the wild shares kept in step
export function settle(L) {
	for (const id of Object.keys(L.wild)) { L.wild[id] = Math.min(L.wild[id], L.have[id] || 0); if (L.wild[id] <= 1e-6) delete L.wild[id]; }
}
// a cooked dish's portions, kept to eat later (good for the rest of the day)
export function plate(L, id, q, n = 1, t = Date.now()) {
	for (let i = 0; i < n; i++) L.plates.push({ id, q, at: t, until: dayEnd(t) });
	const over = L.plates.length - PLATES_MAX;
	if (over > 0) L.plates.splice(0, over);
	return L.plates.length;
}
// the plates still good at t (the stale ones thrown out)
export function freshPlates(L, t = Date.now()) {
	L.plates = L.plates.filter((p) => p.until > t);
	return L.plates;
}
// a plate taken off the pile to eat or give: the plate, or null
export function takePlate(L, id = null, t = Date.now()) {
	freshPlates(L, t);
	const i = id ? L.plates.findIndex((p) => p.id === id) : L.plates.length - 1;
	return i >= 0 ? L.plates.splice(i, 1)[0] : null;
}
// what you carry as a list for the panel: [{ id, n, name, keep, wild }]
export function contents(L) {
	return Object.entries(L.have).map(([id, n]) => ({ id, n, name: INGREDIENTS[id].name, keep: INGREDIENTS[id].keep, wild: L.wild[id] || 0 })).sort((a, b) => a.keep.localeCompare(b.keep) || a.name.localeCompare(b.name));
}
export function note(L, text, t = Date.now()) { L.log.push({ t, text }); if (L.log.length > 40) L.log.shift(); }
