// What a kitchen is made of: every ingredient the recipes ask for (cooking/recipes.js), where
// it keeps in a house (the fridge, the freezer, the cupboards, the spice rack, the fruit bowl),
// what a supermarket sells it in and for how much, and how long it keeps. Then the meat you
// bring in yourself: a fish off your line filleted (its kind of flesh by its species), and
// game you take down butchered into its cuts.
//
// Amounts are kept in one unit an ingredient: grams (g), millilitres (ml) or whole ones
// (each). Prices are credits for a supermarket pack at the Bay's ordinary prices (people/food.js
// DAY_COST is a grown-up's day of good food: 11). Plain data: no three, no DOM.

// keep: where it lives in a house (fridge, freezer, cupboard, spices, counter)
// aisle: where the supermarket shelves it
// pack: how much a pack holds; price: what a pack costs; days: how long it keeps once bought
// (0: it keeps)
export const INGREDIENTS = Object.freeze({
	// ---------- fish and meat (the counter, the freezer, or your own line and hunt) ----------
	'white-fish': { name: 'white fish fillet', unit: 'g', keep: 'fridge', aisle: 'Seafood counter', pack: 450, price: 14, days: 2, meat: true },
	'trout': { name: 'trout fillet', unit: 'g', keep: 'fridge', aisle: 'Seafood counter', pack: 340, price: 12, days: 2, meat: true },
	'salmon': { name: 'salmon fillet', unit: 'g', keep: 'fridge', aisle: 'Seafood counter', pack: 450, price: 17, days: 2, meat: true },
	'crab': { name: 'crab meat', unit: 'g', keep: 'fridge', aisle: 'Seafood counter', pack: 225, price: 19, days: 2, meat: true },
	'venison': { name: 'venison', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 450, price: 18, days: 3, meat: true, wild: true },
	'boar': { name: 'wild boar shoulder', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 900, price: 16, days: 3, meat: true, wild: true },
	'rabbit': { name: 'rabbit, jointed', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 1100, price: 15, days: 2, meat: true, wild: true },
	'duck': { name: 'duck breast', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 400, price: 15, days: 3, meat: true, wild: true },
	'game-bird': { name: 'wild turkey or quail', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 900, price: 12, days: 2, meat: true, wild: true },
	'chicken': { name: 'chicken thighs', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 900, price: 8, days: 2, meat: true },
	'ground-beef': { name: 'ground beef', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 450, price: 7, days: 2, meat: true },
	'bacon': { name: 'bacon', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 340, price: 7, days: 7, meat: true },
	'pork-shoulder': { name: 'pork shoulder', unit: 'g', keep: 'fridge', aisle: 'Butcher', pack: 1400, price: 11, days: 3, meat: true },

	// ---------- the fridge ----------
	'eggs': { name: 'eggs', unit: 'each', keep: 'fridge', aisle: 'Dairy and eggs', pack: 12, price: 5, days: 21 },
	'butter': { name: 'butter', unit: 'g', keep: 'fridge', aisle: 'Dairy and eggs', pack: 450, price: 6, days: 30 },
	'milk': { name: 'whole milk', unit: 'ml', keep: 'fridge', aisle: 'Dairy and eggs', pack: 1900, price: 4, days: 7 },
	'buttermilk': { name: 'buttermilk', unit: 'ml', keep: 'fridge', aisle: 'Dairy and eggs', pack: 950, price: 3, days: 10 },
	'cream': { name: 'heavy cream', unit: 'ml', keep: 'fridge', aisle: 'Dairy and eggs', pack: 470, price: 5, days: 10 },
	'sour-cream': { name: 'sour cream', unit: 'ml', keep: 'fridge', aisle: 'Dairy and eggs', pack: 450, price: 3, days: 14 },
	'parmesan': { name: 'parmesan', unit: 'g', keep: 'fridge', aisle: 'Cheese', pack: 200, price: 8, days: 40 },
	'cheddar': { name: 'sharp cheddar', unit: 'g', keep: 'fridge', aisle: 'Cheese', pack: 225, price: 5, days: 30 },
	'feta': { name: 'feta', unit: 'g', keep: 'fridge', aisle: 'Cheese', pack: 200, price: 5, days: 20 },
	'dijon': { name: 'Dijon mustard', unit: 'g', keep: 'fridge', aisle: 'Condiments', pack: 225, price: 4, days: 0 },
	'miso': { name: 'white miso', unit: 'g', keep: 'fridge', aisle: 'International', pack: 400, price: 7, days: 0 },
	'tortillas': { name: 'corn tortillas', unit: 'each', keep: 'fridge', aisle: 'Bakery', pack: 30, price: 4, days: 14 },
	'lemon': { name: 'lemons', unit: 'each', keep: 'fridge', aisle: 'Produce', pack: 4, price: 3, days: 14 },
	'lime': { name: 'limes', unit: 'each', keep: 'fridge', aisle: 'Produce', pack: 5, price: 3, days: 14 },
	'carrot': { name: 'carrots', unit: 'each', keep: 'fridge', aisle: 'Produce', pack: 8, price: 2, days: 21 },
	'celery': { name: 'celery', unit: 'each', keep: 'fridge', aisle: 'Produce', pack: 8, price: 2, days: 14 },
	'bell-pepper': { name: 'red bell peppers', unit: 'each', keep: 'fridge', aisle: 'Produce', pack: 3, price: 4, days: 10 },
	'cabbage': { name: 'green cabbage', unit: 'g', keep: 'fridge', aisle: 'Produce', pack: 900, price: 3, days: 21 },
	'scallion': { name: 'scallions', unit: 'each', keep: 'fridge', aisle: 'Produce', pack: 8, price: 1, days: 7 },
	'ginger': { name: 'fresh ginger', unit: 'g', keep: 'fridge', aisle: 'Produce', pack: 120, price: 2, days: 21 },
	'parsley': { name: 'flat-leaf parsley', unit: 'g', keep: 'fridge', aisle: 'Produce', pack: 60, price: 2, days: 7 },
	'cilantro': { name: 'cilantro', unit: 'g', keep: 'fridge', aisle: 'Produce', pack: 60, price: 2, days: 7 },
	'dill': { name: 'fresh dill', unit: 'g', keep: 'fridge', aisle: 'Produce', pack: 30, price: 3, days: 7 },
	'thyme': { name: 'fresh thyme', unit: 'g', keep: 'fridge', aisle: 'Produce', pack: 20, price: 3, days: 10 },
	'rosemary': { name: 'fresh rosemary', unit: 'g', keep: 'fridge', aisle: 'Produce', pack: 20, price: 3, days: 10 },
	'peas': { name: 'frozen peas', unit: 'g', keep: 'freezer', aisle: 'Frozen', pack: 450, price: 3, days: 0 },
	'stock': { name: 'chicken stock', unit: 'ml', keep: 'cupboard', aisle: 'Soups and stock', pack: 950, price: 4, days: 0 },
	'beef-stock': { name: 'beef stock', unit: 'ml', keep: 'cupboard', aisle: 'Soups and stock', pack: 950, price: 4, days: 0 },

	// ---------- the counter and the vegetable basket ----------
	'onion': { name: 'yellow onions', unit: 'each', keep: 'counter', aisle: 'Produce', pack: 3, price: 3, days: 30 },
	'garlic': { name: 'garlic cloves', unit: 'each', keep: 'counter', aisle: 'Produce', pack: 12, price: 1, days: 30 },
	'potato': { name: 'Yukon Gold potatoes', unit: 'each', keep: 'counter', aisle: 'Produce', pack: 6, price: 4, days: 30 },
	'tomato': { name: 'ripe tomatoes', unit: 'each', keep: 'counter', aisle: 'Produce', pack: 4, price: 4, days: 7 },
	'orange': { name: 'oranges', unit: 'each', keep: 'counter', aisle: 'Produce', pack: 4, price: 4, days: 14 },
	'fennel': { name: 'fennel bulb', unit: 'each', keep: 'fridge', aisle: 'Produce', pack: 1, price: 3, days: 10 },
	'bread': { name: 'sourdough loaf', unit: 'g', keep: 'counter', aisle: 'Bakery', pack: 680, price: 6, days: 4 },

	// ---------- the cupboards: dry goods, tins, bottles ----------
	'flour': { name: 'all-purpose flour', unit: 'g', keep: 'cupboard', aisle: 'Baking', pack: 2270, price: 4, days: 0 },
	'sugar': { name: 'sugar', unit: 'g', keep: 'cupboard', aisle: 'Baking', pack: 1800, price: 4, days: 0 },
	'brown-sugar': { name: 'brown sugar', unit: 'g', keep: 'cupboard', aisle: 'Baking', pack: 900, price: 3, days: 0 },
	'baking-powder': { name: 'baking powder', unit: 'g', keep: 'cupboard', aisle: 'Baking', pack: 230, price: 3, days: 0 },
	'baking-soda': { name: 'baking soda', unit: 'g', keep: 'cupboard', aisle: 'Baking', pack: 450, price: 1, days: 0 },
	'rice': { name: 'long-grain rice', unit: 'g', keep: 'cupboard', aisle: 'Rice and grains', pack: 900, price: 3, days: 0 },
	'spaghetti': { name: 'spaghetti', unit: 'g', keep: 'cupboard', aisle: 'Pasta', pack: 450, price: 2, days: 0 },
	'lentils': { name: 'red lentils', unit: 'g', keep: 'cupboard', aisle: 'Rice and grains', pack: 450, price: 3, days: 0 },
	'kidney-beans': { name: 'kidney beans (tin)', unit: 'g', keep: 'cupboard', aisle: 'Tins', pack: 425, price: 1, days: 0 },
	'tinned-tomatoes': { name: 'whole peeled tomatoes (tin)', unit: 'g', keep: 'cupboard', aisle: 'Tins', pack: 800, price: 3, days: 0 },
	'tomato-paste': { name: 'tomato paste', unit: 'g', keep: 'cupboard', aisle: 'Tins', pack: 170, price: 1, days: 0 },
	'olive-oil': { name: 'extra-virgin olive oil', unit: 'ml', keep: 'cupboard', aisle: 'Oils and vinegars', pack: 500, price: 9, days: 0 },
	'veg-oil': { name: 'vegetable oil', unit: 'ml', keep: 'cupboard', aisle: 'Oils and vinegars', pack: 1400, price: 5, days: 0 },
	'sesame-oil': { name: 'toasted sesame oil', unit: 'ml', keep: 'cupboard', aisle: 'International', pack: 150, price: 4, days: 0 },
	'soy-sauce': { name: 'soy sauce', unit: 'ml', keep: 'cupboard', aisle: 'International', pack: 450, price: 3, days: 0 },
	'mirin': { name: 'mirin', unit: 'ml', keep: 'cupboard', aisle: 'International', pack: 300, price: 5, days: 0 },
	'rice-vinegar': { name: 'rice vinegar', unit: 'ml', keep: 'cupboard', aisle: 'Oils and vinegars', pack: 350, price: 3, days: 0 },
	'white-wine': { name: 'dry white wine', unit: 'ml', keep: 'cupboard', aisle: 'Wine', pack: 750, price: 10, days: 0 },
	'red-wine': { name: 'dry red wine', unit: 'ml', keep: 'cupboard', aisle: 'Wine', pack: 750, price: 10, days: 0 },
	'honey': { name: 'honey', unit: 'g', keep: 'cupboard', aisle: 'Baking', pack: 340, price: 6, days: 0 },
	'maple': { name: 'maple syrup', unit: 'ml', keep: 'cupboard', aisle: 'Breakfast', pack: 355, price: 9, days: 0 },

	// ---------- the spice rack ----------
	'salt': { name: 'kosher salt', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 1360, price: 3, days: 0, staple: true },
	'pepper': { name: 'black peppercorns', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 100, price: 5, days: 0, staple: true },
	'cumin': { name: 'ground cumin', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 45, price: 4, days: 0 },
	'cumin-seed': { name: 'cumin seeds', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 50, price: 4, days: 0 },
	'paprika': { name: 'sweet paprika', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 60, price: 4, days: 0 },
	'smoked-paprika': { name: 'smoked paprika', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 50, price: 5, days: 0 },
	'chili-powder': { name: 'chili powder', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 70, price: 4, days: 0 },
	'chili-flakes': { name: 'red pepper flakes', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 40, price: 4, days: 0 },
	'oregano': { name: 'dried oregano', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 20, price: 4, days: 0 },
	'bay-leaf': { name: 'bay leaves', unit: 'each', keep: 'spices', aisle: 'Spices', pack: 20, price: 4, days: 0 },
	'turmeric': { name: 'ground turmeric', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 50, price: 4, days: 0 },
	'garam-masala': { name: 'garam masala', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 50, price: 5, days: 0 },
	'juniper': { name: 'juniper berries', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 30, price: 6, days: 0 },
	'cinnamon': { name: 'ground cinnamon', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 60, price: 4, days: 0 },
	'saffron': { name: 'saffron threads', unit: 'g', keep: 'spices', aisle: 'Spices', pack: 1, price: 12, days: 0 },
});
export const INGREDIENT_IDS = Object.freeze(Object.keys(INGREDIENTS));
// where a house keeps things, as the player sees each place
export const KEEPS = Object.freeze({
	fridge: { name: 'Fridge', glyph: '🧊', line: 'Fresh food: dairy, eggs, meat, fish and greens.' },
	freezer: { name: 'Freezer', glyph: '❄', line: 'Frozen peas and whatever they put by.' },
	cupboard: { name: 'Cupboards', glyph: '🗄', line: 'Dry goods: flour, rice, pasta, tins, oils, sauces.' },
	spices: { name: 'Spice rack', glyph: '🧂', line: 'Salt, pepper and the spices.' },
	counter: { name: 'Counter', glyph: '🧺', line: 'Onions, garlic, potatoes, fruit and the bread.' },
});
// (the doors of a kitchen: the fridge holds the freezer drawer, the cupboards the spice rack
// and the counter's basket)
export const STORE_OF = Object.freeze({ fridge: 'fridge', freezer: 'fridge', cupboard: 'cupboard', spices: 'cupboard', counter: 'cupboard' });

// ---------- amounts, as a cook says them ----------
// grams of a spoonful of each spice (a level teaspoon); a tablespoon is three
const TSP_G = { salt: 5, pepper: 2.5, cumin: 2.5, 'cumin-seed': 2.5, paprika: 2.5, 'smoked-paprika': 2.5, 'chili-powder': 2.7, 'chili-flakes': 1.5, oregano: 1, turmeric: 3, 'garam-masala': 2, juniper: 1.5, cinnamon: 2.6, 'baking-powder': 4, 'baking-soda': 5, sugar: 4, 'brown-sugar': 4, honey: 7, 'tomato-paste': 5, dijon: 5, miso: 6, ginger: 2.5, saffron: 0.1 };
// an amount of an ingredient as words: "2 tbsp olive oil", "450 g venison", "3 garlic cloves"
export function amountText(id, n) {
	const I = INGREDIENTS[id];
	if (!I) return `${n} ${id}`;
	const nice = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v < 1 ? ({ 0.25: '¼', 0.5: '½', 0.75: '¾' })[Math.round(v * 4) / 4] || v.toFixed(1) : v.toFixed(1).replace(/\.0$/, ''));
	if (I.unit === 'each') return `${nice(n)} ${I.name}`;
	if (I.unit === 'ml') {
		if (n < 15) return `${nice(n / 5)} tsp ${I.name}`;
		if (n < 60) return `${nice(n / 15)} tbsp ${I.name}`;
		if (n < 1000) return `${nice(n / 240)} cup${n > 240 ? 's' : ''} ${I.name}`;
		return `${nice(n / 1000)} L ${I.name}`;
	}
	const t = TSP_G[id];
	if (t && n < t * 9) { const tsp = n / t; return tsp >= 3 ? `${nice(tsp / 3)} tbsp ${I.name}` : `${nice(tsp)} tsp ${I.name}`; }
	return n >= 1000 ? `${nice(n / 1000)} kg ${I.name}` : `${Math.round(n)} g ${I.name}`;
}
// a teaspoon of a spice (or a dry thing) in grams, for writing the recipes
export const tsp = (id, n = 1) => +(n * (TSP_G[id] || 3)).toFixed(2);
export const tbsp = (id, n = 1) => tsp(id, n * 3);

// ---------- your own catch and kill, as meat ----------
// A fish off the line by its name: the flesh it gives and the share of its weight that comes
// off as fillets (round fish about 40%, flatfish a little more, rays and sharks less)
export function fishMeat(name) {
	const n = String(name || '').toLowerCase();
	if (/salmon/.test(n)) return { id: 'salmon', yield: 0.45 };
	if (/trout/.test(n)) return { id: 'trout', yield: 0.45 };
	if (/crab/.test(n)) return { id: 'crab', yield: 0.25 };
	if (/halibut/.test(n)) return { id: 'white-fish', yield: 0.5 };
	if (/ray|shark/.test(n)) return { id: 'white-fish', yield: 0.3 };
	if (/bluegill|sunfish|perch|smelt|crappie/.test(n)) return { id: 'white-fish', yield: 0.35 };
	return { id: 'white-fish', yield: 0.4 };
}
// grams of fillet off a fish of lb pounds
export const filletGrams = (name, lb) => Math.max(40, Math.round(lb * 453.6 * fishMeat(name).yield));

// Game taken down, by the animal: its meat and a dressed weight in grams (what a field-dressed
// animal of that kind gives a hunter, roughly), so a deer is a freezer's worth and a rabbit is
// one pot. Anything else wild and edible gives what its size suggests.
export const GAME = Object.freeze({
	deer: { id: 'venison', g: 22000, name: 'deer' },
	elk: { id: 'venison', g: 85000, name: 'elk' },
	boar: { id: 'boar', g: 30000, name: 'wild boar' },
	pig: { id: 'boar', g: 30000, name: 'wild pig' },
	rabbit: { id: 'rabbit', g: 1100, name: 'rabbit' },
	hare: { id: 'rabbit', g: 1600, name: 'hare' },
	duck: { id: 'duck', g: 800, name: 'duck' },
	goose: { id: 'duck', g: 2200, name: 'goose' },
	turkey: { id: 'game-bird', g: 4500, name: 'wild turkey' },
	quail: { id: 'game-bird', g: 150, name: 'quail' },
	pheasant: { id: 'game-bird', g: 700, name: 'pheasant' },
});
// what an animal by its kind or name gives: { id, g, name } or null (a pet, a person, a monster)
export function gameMeat(kind) {
	const k = String(kind || '').toLowerCase();
	for (const [key, v] of Object.entries(GAME)) if (k.includes(key)) return v;
	return null;
}
// what you carry home from one animal: a hunter keeps what a pack holds and can carry (the
// rest is shared out with the village where there is one, people/food.js feedVillage)
export const CARRY_G = 6000;
