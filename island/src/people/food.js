// Food: what every household eats, where it comes from, what it costs, and what that does
// to them. Each house has a weekly food budget (a share of what it earns, plus food
// assistance where it's tight), a pantry (staples, fresh food, protein, in days of meals
// for the whole house) and a plan for the week's meals. Good food, enough of it, keeps
// people well: their mood, their energy, their health, and the kids' focus at school. When
// money is short the pantry thins, the fresh food goes first, and it shows: tired parents,
// kids who can't settle, worry at the dinner table; and the food bank, the school meals,
// the community kitchen and the gardens are what carry a house through.
//
// The world's food: supermarkets, corner stores (near, dear, little fresh), farmers'
// markets, food banks and community kitchens (free, for anyone, the encampment's people
// too), school breakfast and lunch, gardens, and on the wild worlds fishing and hunting.
// Prices change with the place.
//
// And what the player can do about it: stock a family's kitchen, give to the food bank,
// start or fund a community garden, cook for a gathering, fish or hunt to feed a village,
// take on what parents and community leaders ask. Each is a good deed for the morality
// compass (combat/morality.js), which this reads and never edits.
//
// Plain data and numbers: no three. Credits are the game's community credits.

import { mouths, minorsOf, adultsOf, rng } from './households.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pick = (r, a) => a[Math.floor(r() * a.length)];

// ---------- where food comes from ----------
// price: cost per grown-up's day of good food, against the supermarket's (1); fresh: how
// much fresh food it has (0..1); free: no charge; limit: days a visit gives a house
export const SOURCES = {
	supermarket: { name: 'supermarket', price: 1, fresh: 0.9, protein: 0.9, free: false },
	discount: { name: 'discount grocer', price: 0.82, fresh: 0.7, protein: 0.8, free: false },
	corner: { name: 'corner store', price: 1.45, fresh: 0.25, protein: 0.4, free: false },
	market: { name: "farmers' market", price: 1.08, fresh: 1, protein: 0.6, free: false, days: [3, 6] },
	foodbank: { name: 'food bank', price: 0, fresh: 0.55, protein: 0.6, free: true, limit: 4, days: [2, 4, 6] },
	kitchen: { name: 'community kitchen', price: 0, fresh: 0.6, protein: 0.7, free: true, meal: true },
	school: { name: 'school meals', price: 0, fresh: 0.65, protein: 0.7, free: true, meal: true },
	garden: { name: 'community garden', price: 0.15, fresh: 1, protein: 0.1, free: false, seasonal: true },
	fishing: { name: 'fishing', price: 0, fresh: 1, protein: 1, free: true, wild: true },
	hunting: { name: 'hunting', price: 0, fresh: 1, protein: 1, free: true, wild: true },
	mess: { name: 'the mess hall', price: 0, fresh: 0.5, protein: 0.7, free: true, meal: true },
};
// a grown-up's day of good food at the supermarket, in credits
export const DAY_COST = 11;
// prices by place (the Bay is dear, SF dearest; the island village eats its own fish)
export const PRICE = { sf: 1.35, oakland: 1.08, suburb: 1.12, office: 1.25, beach: 1.15, trail: 1.1, boardwalk: 1.2, island: 0.85, village: 0.85, rural: 0.95, colony: 0, wild: 0.9 };
// what's within reach of a kind of place (the sources a household there can use)
export const ACCESS = {
	sf: ['supermarket', 'corner', 'market', 'foodbank', 'kitchen', 'school', 'garden'],
	oakland: ['supermarket', 'discount', 'corner', 'market', 'foodbank', 'kitchen', 'school', 'garden'],
	suburb: ['supermarket', 'discount', 'market', 'foodbank', 'school', 'garden'],
	// a place without a supermarket near: the corner store, unless someone brings the market
	'food-desert': ['corner', 'foodbank', 'kitchen', 'school'],
	island: ['market', 'fishing', 'garden', 'school'],
	village: ['market', 'fishing', 'hunting', 'garden', 'school'],
	rural: ['discount', 'market', 'garden', 'school', 'foodbank', 'hunting', 'fishing'],
	colony: ['mess'],
	wild: ['fishing', 'hunting', 'garden'],
};
export function priceIndex(place = 'suburb', culturePrice = 1) { return (PRICE[place] ?? 1) * culturePrice; }

// ---------- a household's food life ----------
// set up: the budget (a share of what they earn, more of it the less they have; food
// assistance below a line), the pantry (a few days' food), the week's meal plan
export function foodFor(h, place = 'suburb', opts = {}) {
	const r = rng(h.seed ^ 0xf00d);
	const need = mouths(h) * DAY_COST * 7 * priceIndex(place);          // a week of good food, here
	// they spend what good food needs, if it fits in under a third of what comes in; food
	// assistance where it doesn't
	const assist = h.unhoused || h.income * 0.3 < need ? Math.round(need * 0.3) : 0;
	const budget = Math.round(Math.min(h.income * 0.3, Math.max(need * 1.1, h.income * 0.1)) + assist);
	const access = opts.access || ACCESS[place] || ACCESS.suburb;
	// what good food really costs them: dearer where the corner store is all that's near
	const paid = access.filter((k) => !SOURCES[k].free && SOURCES[k].price > 0.5);
	const reach = paid.length ? Math.min(...paid.map((k) => SOURCES[k].price)) : 1;
	h.food = {
		place, access: access.slice(), price: priceIndex(place), reach, need: Math.round(need), budget, assist,
		// days of meals in the cupboard, the fridge and the freezer
		pantry: h.unhoused ? { staples: 0.5, fresh: 0, protein: 0.3 } : { staples: 3 + r() * 6, fresh: 1 + r() * 3, protein: 1.5 + r() * 4 },
		garden: !h.unhoused && r() < 0.18,
		quality: 0.6, security: 'secure', spent: 0, week: 0, history: [],
		plan: mealPlan(r),
	};
	h.well = Object.fromEntries(h.members.map((m) => [m.id, { mood: 0.65, energy: 0.65, health: 0.7, focus: 0.65 }]));
	assess(h);
	return h.food;
}
// a week of dinners: what they like to make (all kinds of kitchens, no house's cooking
// standing for anyone's), cheaper dishes when money is short
const DISHES = {
	any: ['rice and beans with greens', 'vegetable stir-fry', 'chicken and vegetable soup', 'pasta with tomato sauce and a salad', 'lentil curry and rice', 'tacos with black beans', 'baked fish with potatoes', 'egg fried rice', 'chili', 'roast vegetables and couscous', 'noodle soup', 'jollof rice', 'dal and chapati', 'grilled chicken and corn', 'tofu and bok choy', 'shakshuka', 'stew and bread', 'pupusas and curtido'],
	cheap: ['rice and beans', 'pasta with tomato sauce', 'lentil soup', 'egg fried rice', 'potato and onion hash', 'oatmeal for dinner', 'bean burritos'],
};
function mealPlan(r, tight = false) {
	const out = [];
	for (let d = 0; d < 7; d++) out.push(pick(r, tight && r() < 0.6 ? DISHES.cheap : DISHES.any));
	return out;
}

// how well they're eating, from the pantry: quality (0..1) and food security
export function assess(h) {
	const F = h.food, P = F.pantry;
	// (each kind in days of the whole house's meals: enough food is the staples, good food
	// the fresh and the protein beside them)
	const days = P.staples;
	F.quality = clamp(0.2 + 0.45 * clamp(P.fresh / 2) + 0.25 * clamp(P.protein / 2) + 0.1 * clamp(P.staples / 3));
	const afford = (F.budget + (F.gift || 0)) / (F.need * (F.reach || 1));
	// (a full cupboard is security this week, whatever the budget)
	F.security = days >= 2 && afford >= 0.95 ? 'secure' : (days >= 1 && afford >= 0.7) || days >= 3 ? 'tight' : 'short';
	return F;
}

// a day: they eat (the school feeds the kids breakfast and lunch on school days, the
// community kitchen feeds whoever comes), the fresh food spoils, they shop on shop days
// with what the week's budget leaves, and when it runs low they use the food bank. Then
// how they are: well-being follows how they ate, how they slept and how worried they are.
export function liveDay(h, plan, day = 1) {
	const F = h.food, P = F.pantry, M = mouths(h) || 1;
	if (day === 1) { F.spent = 0; F.gift = 0; F.week++; F.plan = mealPlan(rng((h.seed ^ F.week * 7919) >>> 0), F.security !== 'secure'); }
	const school = day !== 0 && day !== 6 && F.access.includes('school');
	const kids = minorsOf(h).filter((m) => m.school);
	// what the house eats from its own kitchen today, in house-days (school meals take the
	// kids' breakfast and lunch off it; the kitchen's supper takes dinner)
	let eat = 1 - (school ? kids.length / M * 0.55 : 0) - (h.unhoused && F.access.includes('kitchen') ? 0.45 : 0);
	eat = clamp(eat, 0.2, 1);
	const take = (k, v) => { const g = Math.min(P[k], v); P[k] -= g; return g; };
	const got = take('fresh', eat) * 0.4 + take('protein', eat) * 0.3 + take('staples', eat) * 0.3;
	// (what the school or the kitchen gave them is eaten in full)
	const ate = eat * clamp(got / eat) + (1 - eat);
	P.fresh *= 0.9;                       // greens wilt, bread goes stale
	if (F.garden) P.fresh += 0.35;
	// shopping: on the house's shop days, the cheapest good source they can reach
	const shopped = plan?.notes?.some((n) => n.kind === 'groceries');
	if (shopped) buy(h, day);
	// the food bank, when the cupboard is getting bare (anyone can come; nobody is asked why)
	if (F.access.includes('foodbank') && (P.staples + P.fresh + P.protein) / 3 < 1.5 && SOURCES.foodbank.days.includes(day)) give(h, 'foodbank', SOURCES.foodbank.limit);
	assess(h);
	feel(h, plan, ate);
	F.history.push({ day, quality: +F.quality.toFixed(2), security: F.security });
	if (F.history.length > 28) F.history.shift();
	return { ate: +ate.toFixed(2), quality: F.quality, security: F.security };
}
// buy as much good food as the week's budget allows, at the best source in reach
export function buy(h, day = 1, credits = null) {
	const F = h.food;
	const open = F.access.filter((k) => !SOURCES[k].free && SOURCES[k].price > 0 && (!SOURCES[k].days || SOURCES[k].days.includes(day)));
	if (!open.length) return 0;
	// the best value: fresh food per credit, unless only the corner store is near
	const best = open.map((k) => [k, (SOURCES[k].fresh + SOURCES[k].protein) / SOURCES[k].price]).sort((a, b) => b[1] - a[1])[0][0];
	const S = SOURCES[best], left = credits ?? Math.max(0, F.budget - F.spent);
	// enough for half a week, or what's left
	const want = mouths(h) * DAY_COST * F.price * S.price * 3.5, spend = Math.min(want, left);
	if (spend <= 0) return 0;
	const days = spend / (mouths(h) * DAY_COST * F.price * S.price);
	stock(h, days, S);
	if (credits == null) F.spent += spend;
	F.lastSource = best;
	return Math.round(spend);
}
// food arriving: days of meals, split by what the source has
export function stock(h, days, S = SOURCES.supermarket) {
	const P = h.food.pantry;
	P.fresh += days * S.fresh; P.protein += days * S.protein; P.staples += days;
	assess(h);
}
// a free source: the food bank's bags, the kitchen's meals
export function give(h, kind, days) { stock(h, days, SOURCES[kind]); h.food.lastSource = kind; return days; }

// how they are: each member's mood, energy, health and (the young) focus at school, eased
// toward what their food, their sleep and their worries make them
export function feel(h, plan, ate = 1) {
	const F = h.food, q = F.quality, worry = F.security === 'short' ? 0.3 : F.security === 'tight' ? 0.12 : 0;
	for (const m of h.members) {
		const W = h.well[m.id] ||= { mood: 0.65, energy: 0.65, health: 0.7, focus: 0.65 };
		const night = m.job?.night ? 0.08 : 0;
		const adult = m.age >= 18;
		const target = {
			energy: clamp(0.3 + q * 0.5 + ate * 0.2 - night),
			mood: clamp(0.35 + q * 0.35 + ate * 0.2 - worry * (adult ? 1 : 0.6) + (h.helpers.length ? 0.04 : 0)),
			health: clamp(0.35 + q * 0.55 + ate * 0.1 - night * 0.5),
			focus: clamp(0.25 + q * 0.4 + ate * 0.35 - worry * 0.5),
		};
		for (const k in target) W[k] += (target[k] - W[k]) * (k === 'health' ? 0.08 : 0.35);
	}
	return h.well;
}
// the house as a whole (0..1)
export function wellOf(h) {
	const L = Object.values(h.well || {});
	if (!L.length) return 0.6;
	return L.reduce((a, w) => a + (w.mood + w.energy + w.health) / 3, 0) / L.length;
}

// ---------- what it looks like, and what they say ----------
// a person's manner from how they are: slower and quieter when tired and hungry, bright
// when fed and rested (for motion and persona)
export function mannerOf(w) {
	if (!w) return { pace: 1, mood: 'calm', slump: 0 };
	return { pace: 0.85 + w.energy * 0.3, mood: w.mood > 0.7 ? 'happy' : w.mood < 0.42 ? 'tired' : w.energy < 0.45 ? 'tired' : 'calm', slump: clamp(0.55 - w.energy) * 0.12 };
}
// the house's food story, in their own words, with dignity: what's working, what's hard
export function storyOf(h, member = null, seed = 0) {
	const F = h.food, r = rng((h.seed ^ seed ^ (F.week * 131)) >>> 0), kids = minorsOf(h).length > 0, adult = !member || member.age >= 18;
	const src = F.lastSource && SOURCES[F.lastSource]?.name;
	if (h.unhoused) return pick(r, ['The community kitchen on Fifth does a good hot supper. People there know your name.', 'The food bank van comes Tuesdays and Thursdays. Fresh fruit, even.', "We look out for each other here. Whoever gets something, shares it."]);
	if (!adult) {
		if (F.security === 'short') return pick(r, ["We have the school breakfast, so that helps.", "Mom says we're doing pasta again this week. I don't mind."]);
		return pick(r, [`Dinner tonight's ${F.plan[new Date().getDay()]}.`, 'I helped with the groceries. Carried the heavy bag.', 'We grow tomatoes on the balcony now.']);
	}
	if (F.security === 'short') return pick(r, [`Money's really tight this month. ${kids ? 'The school meals carry the kids through the week.' : 'The food bank has been a big help.'}`, `I'm stretching ${F.plan[0]} to three nights. You do what you have to.`, `The ${src || 'food bank'} got us through this week. No shame in it; I've given there before.`]);
	if (F.security === 'tight') return pick(r, [`The farmers' market takes the food card and doubles it, so we eat better than you'd think.`, `We plan every meal now. ${kids ? 'The kids help me cook on Sundays.' : 'It works.'}`, `Prices keep going up. We buy what's in season.`]);
	return pick(r, [`${kids ? 'Family dinner every night we can. That\'s the rule.' : "I cook for the week on Sundays."}`, `Tonight's ${F.plan[(new Date().getDay())]}.`, `We have a plot at the community garden. More zucchini than we know what to do with.`]);
}
// a line of facts for the persona sheet (persona.js) and the cloud voice
export function homeLifeOf(h, m, describeFn) {
	if (!h?.food) return '';
	const W = h.well?.[m?.id], F = h.food;
	const bits = [describeFn ? describeFn(h) : h.kind];
	if (h.cook === m?.id) bits.push('you are cooking dinner tonight');
	if (F.security !== 'secure') bits.push(`money for food is ${F.security} right now (${F.lastSource ? 'lately from the ' + SOURCES[F.lastSource].name : 'careful shopping'}); talk about it with dignity, only if it comes up`);
	if (W && W.energy < 0.45) bits.push('you are tired today');
	return bits.join('; ');
}

// ---------- the player's part ----------
// the good deeds food work earns on the morality compass. These are the rules this asks
// combat/morality.js to know (its RULES): until it does, record() keeps them here.
export const FOOD_DEEDS = Object.freeze({
	'feed-family': { mercy: 6, law: 1, protect: 6, honest: 1, line: 'Stocked the kitchen of {target}' },
	'food-bank': { mercy: 5, law: 1, protect: 4, honest: 1, line: 'Gave to the food bank at {place}' },
	'community-garden': { mercy: 3, law: 2, protect: 4, honest: 1, line: 'Planted a community garden at {place}' },
	'cook-gathering': { mercy: 4, law: 0, protect: 2, honest: 1, line: 'Cooked for everyone at {place}' },
	'feed-village': { mercy: 6, law: 0, protect: 8, honest: 1, line: 'Brought in food for {place}' },
	'protect-school-run': { mercy: 3, law: 3, protect: 10, honest: 0, line: 'Kept the school run safe at {place}' },
	'help-parent': { mercy: 4, law: 1, protect: 5, honest: 1, line: 'Helped {target}' },
});
// a deed onto the compass: its own rule if it has one, else held here for when it does
export function recordDeed(morality, kind, d = {}, pending = null) {
	if (!FOOD_DEEDS[kind]) return null;
	if (morality?.score?.(kind)) return morality.record({ kind, ...d });
	const e = { kind, t: Date.now(), line: FOOD_DEEDS[kind].line.replace('{target}', d.target || 'a family').replace('{place}', d.place || 'here'), delta: { ...FOOD_DEEDS[kind] }, place: d.place || '', target: d.target || '' };
	delete e.delta.line;
	pending?.push(e);
	return e;
}

// the player stocks a family's kitchen with `credits`: a week's good food at most
export function helpStock(h, credits) {
	const F = h.food, per = mouths(h) * DAY_COST * F.price;
	const days = Math.min(7, credits / per);
	if (days <= 0) return 0;
	stock(h, days, SOURCES.supermarket);
	F.gift = (F.gift || 0) + credits;
	// they eat better from today; the worry eases
	feel(h, null, 1);
	return Math.round(days * per);
}
// a food bank's stock (days of a family's food it can give out), and what a gift adds
export function makeFoodBank(id, at = null) { return { id, at, kind: 'foodbank', stock: 40, served: 0 }; }
export function donate(bank, credits, price = 1) { const days = credits / (4 * DAY_COST * price); bank.stock += days; return +days.toFixed(1); }
// a community garden: funded, it feeds the houses round it fresh food every day
export function makeGarden(id, at = null) { return { id, at, kind: 'garden', funded: 0, plots: 0 }; }
export function fundGarden(g, credits, households = []) {
	g.funded += credits;
	g.plots = Math.min(24, Math.floor(g.funded / 60));
	// the nearest houses get a plot each
	let n = 0;
	for (const h of households) { if (n >= g.plots) break; if (h.food && !h.unhoused) { if (!h.food.access.includes('garden')) h.food.access.push('garden'); h.food.garden = true; n++; } }
	return g.plots;
}
// fish or game brought in for a village: kilograms to days of protein, shared out
export function feedVillage(households, kg) {
	const days = kg / 0.25;                                 // a quarter kilo a person a day
	const M = households.reduce((a, h) => a + mouths(h), 0) || 1;
	// (each house its share: the same days of meals for every house, whatever its size)
	for (const h of households) if (h.food) { h.food.pantry.protein += days / M; h.food.pantry.fresh += days / M * 0.3; assess(h); }
	return Math.round(days);
}
// cook for a gathering (people/gatherings.js): a plain record on it, what was made and for
// how many, and a good evening for everyone who comes
export function cookFor(gathering, credits, price = 1) {
	const n = gathering?.size || 8;
	const dish = credits >= n * DAY_COST * 0.6 * price ? 'a proper spread' : credits >= n * DAY_COST * 0.3 * price ? 'a big pot of something good' : 'snacks';
	if (gathering) gathering.food = { dish, for: n, credits };
	return dish;
}

// what parents and community leaders ask of the player (a few at a time, from how the
// houses are doing)
export function questsFor(households, place = 'here') {
	const out = [];
	const short = households.filter((h) => h.food && h.food.security !== 'secure' && !h.unhoused);
	const camp = households.filter((h) => h.unhoused);
	const kids = households.filter((h) => minorsOf(h).some((m) => m.age < 13));
	if (short.length) {
		const h = short[0], cost = Math.round(mouths(h) * DAY_COST * h.food.price * 5);
		out.push({ id: `stock-${h.id}`, giver: 'parent', household: h.id, kind: 'feed-family', text: `A parent down the street could use a hand with this week's groceries (about ${cost} credits would fill the kitchen).`, cost });
	}
	out.push({ id: `bank-${place}`, giver: 'leader', kind: 'food-bank', text: `The food bank at ${place} is low on fresh food before the weekend. Any gift helps.`, cost: 50 });
	if (camp.length) out.push({ id: `kitchen-${place}`, giver: 'leader', kind: 'food-bank', text: 'The community kitchen needs help with tonight\'s supper for the encampment.', cost: 40 });
	if (households.length > 6) out.push({ id: `garden-${place}`, giver: 'leader', kind: 'community-garden', text: 'The neighbourhood wants a community garden on the empty lot. Seeds, soil and a water line: about 300 credits.', cost: 300 });
	if (kids.length) out.push({ id: `crossing-${place}`, giver: 'parent', kind: 'protect-school-run', text: 'The crossing by the school is busy at drop-off. Could you help the crossing guard in the morning?', cost: 0 });
	return out;
}

// ---------- the Moon colony (planet/colony/, another's): the hydroponics and the mess ----------
// data only: what the greenhouse grows a day and what the mess serves; colony code can
// read it if it likes
export const COLONY_FOOD = Object.freeze({
	hydroponics: { crops: ['lettuce', 'kale', 'tomatoes', 'peppers', 'strawberries', 'herbs', 'dwarf wheat', 'soy'], kgPerDayPerRack: 0.9 },
	mess: { meals: ['soy noodles and greens', 'tomato and herb flatbread', 'kale and bean stew', 'strawberry oats'], servings: [7, 12.5, 18.5] },
	// racks needed to give each crew member their fresh food (a third of a kilo a day)
	racksFor: (crew) => Math.ceil(crew * 0.33 / 0.9),
});

// ---------- a neighbourhood's food at a glance (for the page and the console) ----------
export function summary(households) {
	const n = households.length || 1;
	const by = { secure: 0, tight: 0, short: 0 };
	for (const h of households) if (h.food) by[h.food.security]++;
	return { households: households.length, ...by, well: +(households.reduce((a, h) => a + wellOf(h), 0) / n).toFixed(2), adults: households.reduce((a, h) => a + adultsOf(h).length, 0), minors: households.reduce((a, h) => a + minorsOf(h).length, 0) };
}
