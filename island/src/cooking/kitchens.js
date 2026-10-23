// What is in a kitchen, and what the shops sell. A house's fridge and cupboards hold what its
// household has bought this week (people/food.js: their pantry, in days of meals, staples, fresh
// food and protein, so a family that is short has a bare fridge and a family that eats well a
// full one), the same each time you look on a day, less what you have taken. A grocer sells
// everything in packs at the place's prices (people/food.js PRICE); a butcher the meat, a fish
// market the fish, a farm stand the produce; on a day a few shelves are bare, more of them where
// the houses round about are going short (they are buying it all up). Pure: no three, no DOM.

import { INGREDIENTS, INGREDIENT_IDS, STORE_OF } from './ingredients.js';
import { RECIPE } from './recipes.js';
import { priceIndex, DAY_COST } from '../people/food.js';

export const KITCHENS_KEY = 'l99-kitchens-v1';
// the most houses whose kitchens you've been into today that are remembered
const HOUSES_MAX = 80;

// a small seeded random (mulberry32)
export function rnd(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashKey = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// today's number (your own calendar: a kitchen is restocked overnight)
export const dayNo = (t = Date.now()) => { const d = new Date(t); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); };
// what kind of food an ingredient is, as a pantry counts it
export const kindOf = (id) => { const I = INGREDIENTS[id]; return I.meat || id === 'eggs' ? 'protein' : I.keep === 'fridge' || I.keep === 'freezer' || I.keep === 'counter' ? 'fresh' : 'staples'; };
const STAPLE = new Set(['salt', 'pepper', 'veg-oil', 'flour', 'sugar']);
const BASIC = new Set(['olive-oil', 'rice', 'spaghetti', 'butter', 'eggs', 'onion', 'garlic', 'milk', 'stock', 'tinned-tomatoes', 'soy-sauce']);

// A kitchen's stock: { fridge: { id: n }, cupboard: { id: n } }.
// pantry: the household's (people/food.js h.food.pantry: days of staples, fresh, protein), or
// null for a house nobody's told us about (an ordinary week's shopping). rural: game in the freezer
// now and then. taken: what you have taken from it today ({ id: n }).
export function kitchenStock({ seed = 1, pantry = null, day = dayNo(), rural = false, taken = null } = {}) {
	const P = pantry || { staples: 5, fresh: 2.2, protein: 2.6 };
	const r = rnd((seed ^ Math.imul(day, 2654435761)) >>> 0);
	const k = { staples: Math.min(1, P.staples / 5), fresh: Math.min(1, P.fresh / 2.5), protein: Math.min(1, P.protein / 3) };
	const out = { fridge: {}, cupboard: {} };
	const meats = [];
	for (const id of INGREDIENT_IDS) {
		const I = INGREDIENTS[id], kind = kindOf(id);
		let p;
		if (I.meat) { meats.push(id); continue; }
		if (STAPLE.has(id)) p = P.staples > 0.4 ? 0.97 : 0.4;
		else if (BASIC.has(id)) p = 0.25 + 0.65 * k[kind];
		else if (I.keep === 'spices') p = 0.15 + 0.45 * k.staples;
		else p = 0.08 + 0.42 * k[kind];
		if (r() >= p) continue;
		// a pack part used, or a spare one
		let n = I.pack * (0.2 + r() * 0.8) * (r() < 0.12 ? 2 : 1);
		if (I.unit === 'each') n = Math.max(1, Math.round(n));
		else n = Math.round(n);
		out[STORE_OF[I.keep]][id] = n;
	}
	// the protein: one to three kinds in the fridge, more in a house that eats well
	const nMeat = Math.round(k.protein * 2.4 + r() * 0.8);
	for (let i = 0; i < nMeat; i++) {
		const pool = meats.filter((id) => !INGREDIENTS[id].wild || (rural && r() < 0.5) || r() < 0.06);
		const id = pool[Math.floor(r() * pool.length)];
		if (!id || out.fridge[id]) continue;
		out.fridge[id] = Math.round(INGREDIENTS[id].pack * (0.6 + r() * 0.8));
	}
	// (less what you took; more what you put in: a gift is a negative take)
	if (taken) for (const [id, n] of Object.entries(taken)) {
		const S = out[STORE_OF[INGREDIENTS[id]?.keep]] || null;
		if (!S || !Number.isFinite(n) || (S[id] == null && n > 0)) continue;
		S[id] = +((S[id] || 0) - n).toFixed(3);
		if (S[id] <= 1e-6) delete S[id];
	}
	return out;
}
// what an amount of an ingredient is worth at the place's prices, credits
export const worth = (id, n, place = 'suburb') => { const I = INGREDIENTS[id]; return I ? I.price * (n / I.pack) * priceIndex(place) : 0; };
// what you took out of a household's kitchen, as their pantry counts it: days of meals of each
// kind the house loses ({ staples, fresh, protein })
export function pantryLoss(taken, mouths = 2, place = 'suburb') {
	const out = { staples: 0, fresh: 0, protein: 0 }, day = Math.max(1, mouths) * DAY_COST * priceIndex(place);
	for (const [id, n] of Object.entries(taken || {})) if (INGREDIENTS[id]) out[kindOf(id)] += worth(id, n, place) / day * 2.5;
	for (const k in out) out[k] = +out[k].toFixed(3);
	return out;
}

// ---------- today's kitchens: what you've taken, house by house ----------
export function createKitchenLog(saved = null, t = Date.now()) {
	const today = dayNo(t);
	const L = saved && saved.day === today && saved.houses && typeof saved.houses === 'object' ? { day: today, houses: saved.houses, paid: saved.paid || {} } : { day: today, houses: {}, paid: {} };
	return L;
}
// a new day: everyone has shopped again
export function rollDay(L, t = Date.now()) { const d = dayNo(t); if (L.day !== d) { L.day = d; L.houses = {}; L.paid = {}; return true; } return false; }
export function tookFrom(L, key, id, n) {
	const H = L.houses[key] ||= {};
	H[id] = +((H[id] || 0) + n).toFixed(3);
	const keys = Object.keys(L.houses);
	if (keys.length > HOUSES_MAX) delete L.houses[keys[0]];
}
// what you owe a house for today's use of their kitchen, less what you left them
export function owed(L, key, place = 'suburb') {
	const used = Object.entries(L.houses[key] || {}).reduce((a, [id, n]) => a + worth(id, n, place), 0);
	return Math.max(0, Math.round(used - (L.paid[key] || 0)));
}

// ---------- the shops ----------
// what each kind of shop sells (an ingredient's aisle), and the kinds that count as food shops
export const SHOPS = Object.freeze({
	grocer: { name: 'Groceries', sells: () => true },
	supermarket: { name: 'Groceries', sells: () => true },
	general: { name: 'General store', sells: (I) => I.keep !== 'fridge' || !I.meat },
	butcher: { name: 'Butcher', sells: (I) => I.aisle === 'Butcher' },
	fishmarket: { name: 'Fish market', sells: (I) => I.aisle === 'Seafood counter' },
	farmstand: { name: 'Farm stand', sells: (I) => I.aisle === 'Produce' || I.id === 'eggs' || I.id === 'honey' },
	// a gas station's food mart, a corner store (bay/storefit.js): the milk and eggs in the
	// coolers, the bread, the tins and the dry goods on the gondolas, the frozen peas, the wine;
	// a few onions and lemons by the counter, no fresh meat
	mart: { name: 'Food mart', sells: (I) => MART.has(I.aisle) || MART_EXTRA.has(I.id) },
	liquor: { name: 'Bottle shop', sells: (I) => I.aisle === 'Wine' || I.id === 'lemon' || I.id === 'lime' },
});
const MART = new Set(['Dairy and eggs', 'Bakery', 'Tins', 'Soups and stock', 'Pasta', 'Rice and grains', 'Condiments', 'Breakfast', 'Frozen', 'Wine']);
const MART_EXTRA = new Set(['onion', 'lemon', 'cheddar', 'sugar', 'flour', 'salt', 'pepper', 'olive-oil', 'honey']);
// A shop's shelves today: [{ id, name, aisle, pack, unit, price, out (sold out today) }].
// short: the share of houses round about going short (0..1): the shelves they empty first.
export function shelves(kind = 'grocer', { seed = 1, day = dayNo(), place = 'suburb', short = 0 } = {}) {
	const S = SHOPS[kind] || SHOPS.grocer, r = rnd((seed ^ Math.imul(day, 40503)) >>> 0), pi = priceIndex(place);
	const out = [];
	for (const id of INGREDIENT_IDS) {
		const I = { id, ...INGREDIENTS[id] };
		if (!S.sells(I)) continue;
		// the game a grocer has is farmed, at the butcher's price; a wild cut is a special order
		const wildK = I.wild ? 1.25 : 1;
		const basic = BASIC.has(id) || STAPLE.has(id);
		const out0 = r() < 0.03 + (basic ? short * 0.25 : short * 0.08) + (I.wild && kind !== 'butcher' ? 0.35 : 0);
		out.push({ id, name: I.name, aisle: I.aisle, pack: I.pack, unit: I.unit, price: Math.max(1, Math.round(I.price * pi * wildK * (0.92 + r() * 0.16))), out: out0 });
	}
	return out.sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));
}
// a shop kind from an economy type or a world site kind, or null if it sells no food
export function shopKind(type) {
	const t = String(type || '');
	if (/grocer|supermarket|market$/.test(t) && !/fishmarket|player|community/.test(t)) return 'grocer';
	if (/butcher/.test(t)) return 'butcher';
	if (/fishmarket/.test(t)) return 'fishmarket';
	if (/farmstand/.test(t)) return 'farmstand';
	if (/general/.test(t)) return 'general';
	return null;
}

// ---------- the cafés' and restaurants' menus ----------
// what each kind of place serves of the dishes a cook can make (cooking/recipes.js), by the
// economy's type (economy/establishments.js); a bubble tea counter and an ice cream parlour
// serve nothing that's a meal
const DISHES = {
	cafe: ['shakshuka', 'pancakes', 'grilled-cheese'], waffle: ['pancakes'], bakery: ['grilled-cheese'], donut: ['pancakes'],
	pasta: ['aglio-olio', 'roast-bird', 'cioppino'], pizza: ['aglio-olio'], diner: ['pancakes', 'grilled-cheese', 'chili'],
	burger: ['grilled-cheese', 'chili'], grill: ['venison-poivre', 'roast-bird', 'chili'], bbq: ['carnitas', 'chili'], taco: ['fish-tacos', 'carnitas'],
	bistro: ['meuniere', 'duck-orange', 'lapin-moutarde', 'venison-poivre'], seafood: ['cioppino', 'meuniere', 'fish-chowder', 'fish-tacos'],
	pub: ['fish-chowder', 'venison-stew', 'grilled-cheese'], tapas: ['arroz-con-pollo', 'shakshuka'], curry: ['dal-tadka'],
	sushi: ['teriyaki-salmon'], ramen: ['fried-rice', 'teriyaki-salmon'], noodles: ['fried-rice'], izakaya: ['teriyaki-salmon', 'fried-rice'],
};
// A place's menu today: [{ id, name, line, from, price, out }]. A plate costs what goes into it
// about three times over (the kitchen, the room, the staff), at the place's prices; now and then
// a dish is off for the day.
export function menuOf(type, { seed = 1, day = dayNo(), place = 'suburb' } = {}) {
	const r = rnd((seed ^ Math.imul(day, 2246822519)) >>> 0), out = [];
	for (const id of DISHES[type] || []) {
		const R = RECIPE[id];
		if (!R) continue;
		const cost = R.ing.reduce((a, l) => a + (l[2] ? 0 : worth([].concat(l[0])[0], l[1], place)), 0) / R.serves;
		out.push({ id, name: R.name, line: R.line, from: R.from, price: Math.max(5, Math.round(cost * 3 * (0.9 + r() * 0.2) + 3)), out: out.length > 0 && r() < 0.08 });
	}
	return out;
}
