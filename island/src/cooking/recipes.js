// Real dishes, cooked the way the classic home cookbooks teach them: each with its full list of
// ingredients (the spices and the salt included), the amounts for the number it serves, and the
// method, written here in our own words. A meal cooked is a strength that lasts you the day
// (cooking/meals.js): what it gives follows what is in it. Plain data and pure helpers: no three,
// no DOM (island/tools/cooking.test.mjs).
//
// An ingredient line: [id, amount (the ingredient's own unit), optional?]. An id may be a list:
// any one of them will do (a white fish for a trout, a game bird for the chicken), the first
// named the one the dish is known by.

import { INGREDIENTS, tsp, tbsp } from './ingredients.js';

const ANY_FISH = ['white-fish', 'trout', 'salmon'];
const BIRD = ['chicken', 'game-bird'];

// buff: what a plate of it gives you for the rest of the day, as magic/stats.js mods
// (life: points; hpRegen: points a second out of a fight; armor, weapon, weak, speed, jump, xp,
// power, cd: shares; manaMax: points; regen: mana a second)
export const RECIPES = Object.freeze([
	{
		id: 'meuniere', name: 'Trout meunière', from: 'France', serves: 2, minutes: 15,
		line: 'Fillets dredged in flour, browned in butter, finished with lemon and parsley.',
		ing: [[['trout', 'white-fish'], 340], ['flour', 40], ['butter', 60], ['lemon', 1], ['parsley', 10, true], ['salt', tsp('salt', 0.5)], ['pepper', tsp('pepper', 0.25)]],
		steps: ['Pat the fillets dry and season both sides with salt and pepper.', 'Dredge them in flour and shake off the excess.', 'Fry in half the butter over medium-high heat, about 3 minutes a side, until golden.', 'Lift the fish out. Brown the rest of the butter until it smells nutty.', 'Off the heat, squeeze in the lemon, add the chopped parsley, and spoon it over the fish.'],
		buff: { name: 'Steady hand', mods: { weapon: 0.12, weak: 0.15 } },
	},
	{
		id: 'fish-tacos', name: 'Baja fish tacos', from: 'Mexico', serves: 4, minutes: 30,
		line: 'Crisp battered fish in warm corn tortillas with cabbage, lime crema and salsa.',
		ing: [[ANY_FISH, 450], ['flour', 125], ['baking-powder', tsp('baking-powder', 1)], ['eggs', 1], ['veg-oil', 500], ['tortillas', 8], ['cabbage', 200], ['sour-cream', 120], ['lime', 2], ['cilantro', 15, true], ['chili-powder', tsp('chili-powder', 1)], ['cumin', tsp('cumin', 0.5)], ['salt', tsp('salt', 1)]],
		steps: ['Cut the fish into finger-length strips and season with salt, chili powder and cumin.', 'Whisk the flour, baking powder, egg and enough cold water (or beer) into a batter like thin pancake batter.', 'Heat the oil to 180 °C (350 °F). Dip the fish and fry in batches until crisp and golden, 3 to 4 minutes.', 'Stir lime juice and a pinch of salt into the sour cream for the crema. Shred the cabbage thin.', 'Warm the tortillas in a dry pan, two to a taco, and fill with fish, cabbage, crema and cilantro.'],
		buff: { name: 'Fleet foot', mods: { speed: 0.12, jump: 0.1 } },
	},
	{
		id: 'cioppino', name: 'Cioppino', from: 'San Francisco', serves: 4, minutes: 60,
		line: "The Italian fishermen's stew of North Beach: fish and crab in a tomato and wine broth.",
		ing: [[ANY_FISH, 450], ['crab', 225, true], ['olive-oil', 45], ['onion', 1], ['fennel', 1, true], ['garlic', 4], ['tomato-paste', tbsp('tomato-paste', 2)], ['tinned-tomatoes', 800], ['white-wine', 240], ['stock', 480], ['bay-leaf', 2], ['oregano', tsp('oregano', 1)], ['chili-flakes', tsp('chili-flakes', 0.5)], ['parsley', 15, true], ['bread', 300, true], ['salt', tsp('salt', 1)], ['pepper', tsp('pepper', 0.5)]],
		steps: ['Warm the olive oil and soften the chopped onion and fennel for 8 minutes. Add the garlic, chili flakes and oregano for a minute more.', 'Stir in the tomato paste, then pour in the wine and let it bubble down by half.', 'Add the tomatoes (crushed by hand), the stock and the bay leaves. Simmer 25 minutes and season.', 'Lay in the fish in big pieces and the crab. Cover and cook gently 5 to 7 minutes until the fish just flakes.', 'Scatter with parsley and serve with toasted sourdough to mop it up.'],
		buff: { name: 'Bay fortitude', mods: { life: 45, hpRegen: 0.6 } },
	},
	{
		id: 'teriyaki-salmon', name: 'Salmon teriyaki', from: 'Japan', serves: 2, minutes: 20,
		line: 'Seared salmon glazed in a reduction of soy, mirin and sugar, over steamed rice.',
		ing: [[['salmon', 'trout', 'white-fish'], 340], ['soy-sauce', 45], ['mirin', 45], ['sugar', tbsp('sugar', 1)], ['ginger', 5, true], ['veg-oil', 15], ['rice', 180], ['scallion', 2, true], ['salt', tsp('salt', 0.25)]],
		steps: ['Rinse the rice until the water runs clear and cook it: 1¼ cups water a cup of rice, covered, 15 minutes, then rest 10.', 'Stir the soy sauce, mirin, sugar and grated ginger together for the sauce.', 'Pat the salmon dry, salt it lightly and sear skin side down in hot oil for 4 minutes, then turn.', 'Pour in the sauce and let it bubble, spooning it over, until it turns glossy and thick.', 'Serve over the rice with sliced scallions.'],
		buff: { name: 'Deep well', mods: { manaMax: 35, regen: 1.2 } },
	},
	{
		id: 'fish-chowder', name: 'New England fish chowder', from: 'New England', serves: 4, minutes: 45,
		line: 'Bacon, onion and potatoes simmered with fish in milk and cream.',
		ing: [[ANY_FISH, 450], ['bacon', 115], ['butter', 30], ['onion', 1], ['celery', 2, true], ['potato', 3], ['stock', 480], ['milk', 480], ['cream', 120], ['thyme', 3, true], ['bay-leaf', 1], ['salt', tsp('salt', 1)], ['pepper', tsp('pepper', 0.5)]],
		steps: ['Cook the diced bacon slowly until crisp; lift it out and keep the fat.', 'Add the butter and soften the onion and celery in the fat, 6 minutes.', 'Add the diced potatoes, stock, thyme and bay. Simmer until the potatoes are just tender, 12 minutes.', 'Pour in the milk and cream, bring back to a bare simmer (never a boil), and add the fish in chunks.', 'Poach 5 minutes, season, and serve with the bacon crumbled over.'],
		buff: { name: 'Warm through', mods: { hpRegen: 1.2, armor: 0.04 } },
	},
	{
		id: 'venison-stew', name: 'Venison stew', from: 'Scotland', serves: 6, minutes: 150,
		line: 'Venison browned and braised slowly in red wine with roots and juniper.',
		ing: [['venison', 900], ['flour', 30], ['veg-oil', 30], ['bacon', 115, true], ['onion', 2], ['carrot', 3], ['celery', 2, true], ['garlic', 3], ['tomato-paste', tbsp('tomato-paste', 1)], ['red-wine', 360], ['beef-stock', 480], ['potato', 4], ['thyme', 4], ['bay-leaf', 2], ['juniper', 3, true], ['salt', tsp('salt', 1.5)], ['pepper', tsp('pepper', 0.5)]],
		steps: ['Cut the venison into 4 cm cubes, season and toss in the flour.', 'Brown it hard in hot oil in batches (crowding steams it). Set aside; crisp the bacon in the same pot.', 'Soften the onions, carrots, celery and garlic, then stir in the tomato paste for a minute.', 'Deglaze with the wine, scraping up the brown bits. Add the stock, herbs, crushed juniper and the meat.', 'Cover and braise on the lowest heat (or a 150 °C oven) for 1½ hours; add the potatoes for the last 40 minutes.'],
		buff: { name: "Hunter's hide", mods: { life: 35, armor: 0.08 } },
	},
	{
		id: 'venison-poivre', name: 'Venison steak au poivre', from: 'France', serves: 2, minutes: 25,
		line: 'Peppercorn-crusted steaks seared rare, with a brandy-free cream pan sauce.',
		ing: [['venison', 450], ['pepper', 10], ['salt', tsp('salt', 0.75)], ['butter', 30], ['veg-oil', 15], ['beef-stock', 120], ['cream', 120], ['dijon', tsp('dijon', 1), true]],
		steps: ['Crack the peppercorns coarsely and press them into both sides of the salted steaks.', 'Sear in hot oil and butter 3 minutes a side for rare to medium-rare (venison is lean: never past medium).', 'Rest the steaks on a warm plate.', 'Pour off the fat, add the stock and scrape the pan; reduce by half.', 'Stir in the cream and mustard, simmer until it coats a spoon, and pour over the steaks.'],
		buff: { name: 'Predator', mods: { weapon: 0.18, boss: 0.1 } },
	},
	{
		id: 'lapin-moutarde', name: 'Rabbit with mustard', from: 'France', serves: 4, minutes: 75,
		line: 'Lapin à la moutarde: rabbit braised in white wine and Dijon, finished with cream.',
		ing: [['rabbit', 1100], ['dijon', 100], ['butter', 30], ['olive-oil', 15], ['onion', 1], ['garlic', 2], ['white-wine', 240], ['stock', 240], ['thyme', 3], ['bay-leaf', 1], ['cream', 120], ['parsley', 10, true], ['salt', tsp('salt', 1)], ['pepper', tsp('pepper', 0.5)]],
		steps: ['Season the rabbit pieces and brush them all over with half the mustard.', 'Brown them in the butter and oil, a few at a time; set aside.', 'Soften the onion and garlic, pour in the wine and let it reduce by half.', 'Return the rabbit with the stock, thyme and bay. Cover and simmer gently for 45 minutes.', 'Whisk the rest of the mustard into the cream, stir it in, and simmer 5 minutes more. Parsley over.'],
		buff: { name: 'Spring-heeled', mods: { jump: 0.2, speed: 0.06, fall: 0.2 } },
	},
	{
		id: 'carnitas', name: 'Carnitas', from: 'Michoacán, Mexico', serves: 6, minutes: 180,
		line: 'Pork (or wild boar) shoulder simmered with orange and spices until it falls apart, then crisped.',
		ing: [[['pork-shoulder', 'boar'], 1400], ['orange', 1], ['lime', 1], ['onion', 1], ['garlic', 5], ['cumin', tsp('cumin', 1)], ['oregano', tsp('oregano', 1)], ['bay-leaf', 2], ['cinnamon', tsp('cinnamon', 0.25), true], ['salt', tsp('salt', 2)], ['tortillas', 12], ['cilantro', 15, true]],
		steps: ['Cut the shoulder into 5 cm chunks and rub with salt, cumin and oregano.', 'Pack into a heavy pot with the halved onion, smashed garlic, bay, cinnamon and the squeezed orange (rinds too). Add water just to cover.', 'Simmer uncovered for 2½ hours, until the water is gone and the meat is tender in its own fat.', 'Turn up the heat and let the pieces fry in that fat until crisp at the edges, then pull them apart.', 'Serve in warm tortillas with onion, cilantro and lime.'],
		buff: { name: 'Hard hitter', mods: { weapon: 0.15, life: 20 } },
	},
	{
		id: 'arroz-con-pollo', name: 'Arroz con pollo', from: 'Spain and Latin America', serves: 4, minutes: 60,
		line: 'Chicken thighs and rice cooked together in a saffron, pepper and tomato sofrito.',
		ing: [[BIRD, 900], ['rice', 300], ['olive-oil', 30], ['onion', 1], ['bell-pepper', 1], ['garlic', 3], ['tomato', 1], ['stock', 720], ['saffron', 0.1, true], ['turmeric', tsp('turmeric', 0.5)], ['cumin', tsp('cumin', 0.5)], ['paprika', tsp('paprika', 1)], ['peas', 150, true], ['bay-leaf', 1], ['salt', tsp('salt', 1.5)], ['pepper', tsp('pepper', 0.5)]],
		steps: ['Season the chicken with salt, pepper and paprika and brown it skin side down in the oil; set aside.', 'Soften the onion, pepper and garlic in the same pan, then the grated tomato until it darkens.', 'Stir in the rice to coat it, then the cumin, turmeric and saffron crumbled into the hot stock.', 'Nestle in the chicken, add the bay, cover and cook on low for 25 minutes.', 'Scatter the peas over, cover and rest 5 minutes off the heat.'],
		buff: { name: 'Full belly', mods: { life: 40 } },
	},
	{
		id: 'chili', name: 'Chili con carne', from: 'Texas', serves: 6, minutes: 90,
		line: 'Ground beef and beans in a slow, dark chili with cumin and oregano.',
		ing: [['ground-beef', 900], ['veg-oil', 15], ['onion', 2], ['bell-pepper', 1, true], ['garlic', 4], ['chili-powder', tbsp('chili-powder', 3)], ['cumin', tbsp('cumin', 1)], ['oregano', tsp('oregano', 2)], ['smoked-paprika', tsp('smoked-paprika', 1), true], ['tomato-paste', tbsp('tomato-paste', 2)], ['tinned-tomatoes', 800], ['kidney-beans', 850], ['beef-stock', 240], ['salt', tsp('salt', 2)], ['cheddar', 100, true], ['sour-cream', 120, true]],
		steps: ['Brown the beef in the oil in two batches, breaking it up; drain off most of the fat.', 'Soften the onions and pepper, add the garlic, then the spices and tomato paste for 2 minutes.', 'Add the tomatoes, stock and the meat. Simmer gently, half covered, for an hour.', 'Stir in the drained beans and cook 15 minutes more. Taste for salt and heat.', 'Serve topped with cheddar and sour cream.'],
		buff: { name: 'Iron gut', mods: { armor: 0.1, hpRegen: 0.3 } },
	},
	{
		id: 'aglio-olio', name: 'Spaghetti aglio e olio', from: 'Naples', serves: 2, minutes: 15,
		line: 'Spaghetti tossed in olive oil with golden garlic, chili and parsley.',
		ing: [['spaghetti', 225], ['olive-oil', 90], ['garlic', 6], ['chili-flakes', tsp('chili-flakes', 0.5)], ['parsley', 15, true], ['parmesan', 30, true], ['salt', 20]],
		steps: ['Boil the spaghetti in well-salted water until just al dente; keep a cup of the water.', 'Meanwhile warm the oil over low heat with the thinly sliced garlic until pale gold, never brown.', 'Add the chili flakes, then a splash of the pasta water to stop the garlic cooking.', 'Toss the drained spaghetti in the pan, adding pasta water until it turns silky.', 'Off the heat, toss with parsley and grated parmesan.'],
		buff: { name: 'Quick hands', mods: { cd: 0.12 } },
	},
	{
		id: 'shakshuka', name: 'Shakshuka', from: 'North Africa and the Levant', serves: 3, minutes: 30,
		line: 'Eggs poached in a spiced tomato and pepper sauce, with feta and bread.',
		ing: [['eggs', 6], ['olive-oil', 30], ['onion', 1], ['bell-pepper', 1], ['garlic', 3], ['cumin', tsp('cumin', 1)], ['paprika', tsp('paprika', 1)], ['chili-flakes', tsp('chili-flakes', 0.25), true], ['tinned-tomatoes', 800], ['feta', 60, true], ['cilantro', 10, true], ['bread', 200, true], ['salt', tsp('salt', 1)], ['pepper', tsp('pepper', 0.25)]],
		steps: ['Soften the onion and sliced pepper in the oil, 8 minutes. Add the garlic and spices for a minute.', 'Add the tomatoes, crushing them, and simmer until thick, about 10 minutes. Season.', 'Make six hollows and crack an egg into each.', 'Cover and cook on low 5 to 8 minutes, until the whites are set and the yolks still soft.', 'Crumble feta and scatter cilantro over; eat from the pan with bread.'],
		buff: { name: 'Clear mind', mods: { regen: 1.5, power: 0.06 } },
	},
	{
		id: 'dal-tadka', name: 'Dal tadka', from: 'North India', serves: 4, minutes: 40,
		line: 'Red lentils simmered soft, finished with a sizzling tempering of cumin, garlic and chili.',
		ing: [['lentils', 200], ['turmeric', tsp('turmeric', 0.5)], ['salt', tsp('salt', 1)], ['butter', 30], ['cumin-seed', tsp('cumin-seed', 1)], ['onion', 1], ['garlic', 3], ['ginger', 10], ['tomato', 1], ['chili-flakes', tsp('chili-flakes', 0.5)], ['garam-masala', tsp('garam-masala', 0.5)], ['cilantro', 10, true], ['lemon', 1, true], ['rice', 180, true]],
		steps: ['Rinse the lentils and simmer them in 900 ml water with the turmeric until soft and falling apart, 20 minutes. Salt.', 'In a small pan heat the butter (ghee if you have it) and sizzle the cumin seeds until they crackle.', 'Add the onion until golden, then the garlic, ginger and chili, then the chopped tomato until it melts.', 'Pour the sizzling tempering over the dal and stir in the garam masala.', 'Finish with cilantro and a squeeze of lemon; serve with rice.'],
		buff: { name: 'Kindled', mods: { power: 0.15 } },
	},
	{
		id: 'fried-rice', name: 'Egg fried rice', from: 'China', serves: 2, minutes: 15,
		line: "Yesterday's rice stir-fried hot with egg, scallion, peas and soy.",
		ing: [['rice', 180], ['eggs', 2], ['veg-oil', 30], ['garlic', 2], ['scallion', 3], ['peas', 80, true], ['carrot', 1, true], ['soy-sauce', 20], ['sesame-oil', 5, true], ['pepper', tsp('pepper', 0.25)]],
		steps: ['Cook the rice and spread it out to cool (day-old rice fries best).', 'Scramble the eggs in a little oil in a very hot wok and lift them out.', 'Add the rest of the oil, the garlic, diced carrot and scallion whites for a minute.', 'Add the rice and peas and toss over high heat until the grains jump.', 'Return the egg, season with soy, pepper and sesame oil, and toss in the scallion greens.'],
		buff: { name: 'Quick study', mods: { xp: 0.15, speed: 0.05 } },
	},
	{
		id: 'pancakes', name: 'Buttermilk pancakes', from: 'United States', serves: 4, minutes: 25,
		line: 'Tall, tender pancakes with butter and maple syrup.',
		ing: [['flour', 250], ['sugar', tbsp('sugar', 2)], ['baking-powder', tsp('baking-powder', 2)], ['baking-soda', tsp('baking-soda', 0.5)], ['salt', tsp('salt', 0.5)], ['buttermilk', 480], ['eggs', 2], ['butter', 45], ['maple', 120, true]],
		steps: ['Whisk the flour, sugar, baking powder, baking soda and salt in a bowl.', 'Whisk the buttermilk, eggs and melted butter in another.', 'Pour the wet into the dry and fold just until combined: lumps are good.', 'Ladle onto a buttered pan over medium heat; flip when bubbles break on top, about 2 minutes a side.', 'Serve stacked with butter and maple syrup.'],
		buff: { name: 'Bright morning', mods: { xp: 0.2, regen: 0.6 } },
	},
	{
		id: 'roast-bird', name: 'Lemon and rosemary roast bird', from: 'Italy', serves: 4, minutes: 70,
		line: 'Chicken (or wild turkey, or quail) roasted over potatoes with lemon, garlic and rosemary.',
		ing: [[BIRD, 1200], ['potato', 4], ['olive-oil', 45], ['lemon', 1], ['garlic', 6], ['rosemary', 6], ['salt', tsp('salt', 2)], ['pepper', tsp('pepper', 0.5)], ['white-wine', 120, true]],
		steps: ['Heat the oven to 220 °C (425 °F). Cut the potatoes into chunks and toss with half the oil, salt and pepper.', 'Rub the bird all over with oil, salt, pepper and chopped rosemary; tuck the halved lemon and garlic in and round it.', 'Roast on the potatoes for 45 to 60 minutes (quail 15), until the juices run clear (74 °C inside).', 'Splash the wine into the tin for the last 10 minutes.', 'Rest 10 minutes, squeeze the roasted lemon over, and carve.'],
		buff: { name: 'Hale', mods: { life: 30, hpRegen: 0.5 } },
	},
	{
		id: 'duck-orange', name: "Duck à l'orange", from: 'France', serves: 2, minutes: 40,
		line: 'Crisp-skinned duck breast with a bittersweet orange pan sauce.',
		ing: [['duck', 400], ['orange', 2], ['sugar', tbsp('sugar', 1)], ['rice-vinegar', 15], ['stock', 240], ['butter', 15], ['thyme', 2, true], ['salt', tsp('salt', 0.75)], ['pepper', tsp('pepper', 0.25)]],
		steps: ['Score the duck skin in a crosshatch and salt it well.', 'Start skin side down in a cold pan and render over medium heat 10 to 12 minutes until crisp; turn for 3 minutes.', 'Rest the breasts. Pour off most of the fat.', 'Melt the sugar in the pan to a light caramel, add the vinegar, then the juice and zest of the oranges and the stock. Reduce to a syrup.', 'Swirl in the butter and spoon over the sliced duck.'],
		buff: { name: 'Keen eye', mods: { weak: 0.2, weapon: 0.08 } },
	},
	{
		id: 'grilled-cheese', name: 'Grilled cheese and tomato soup', from: 'United States', serves: 2, minutes: 30,
		line: 'A golden cheddar sandwich with a pot of simple tomato soup.',
		ing: [['bread', 200], ['cheddar', 120], ['butter', 45], ['tinned-tomatoes', 800], ['onion', 1], ['garlic', 2], ['stock', 240], ['sugar', tsp('sugar', 1)], ['cream', 60, true], ['salt', tsp('salt', 1)], ['pepper', tsp('pepper', 0.25)]],
		steps: ['Soften the onion and garlic in a knob of butter, 6 minutes.', 'Add the tomatoes, stock and sugar; simmer 15 minutes, then blend smooth and stir in the cream. Season.', 'Butter the outsides of the bread and fill with sliced cheddar.', 'Cook the sandwiches in a pan over medium-low heat, pressing gently, until golden and the cheese melts, 3 to 4 minutes a side.', 'Cut corner to corner and dunk.'],
		buff: { name: 'Comfort', mods: { life: 20, armor: 0.04, regen: 0.4 } },
	},
]);
export const RECIPE = Object.freeze(Object.fromEntries(RECIPES.map((r) => [r.id, r])));

// ---------- what a cook needs, has and lacks ----------
// the ids an ingredient line takes
export const optionsOf = (line) => [].concat(line[0]);
// how much of an ingredient a store has (a store: { id: amount })
const have = (store, id) => Math.max(0, +store?.[id] || 0);
// The ingredient that fills a line from the stores given (in order, the first that has enough
// across them all), or null
export function fills(line, stores) {
	const n = line[1];
	for (const id of optionsOf(line)) if (stores.reduce((a, s) => a + have(s, id), 0) >= n - 1e-6) return id;
	return null;
}
// What a recipe would take from the stores: { ok, lines: [{ line, id (or null), need, optional }],
// missing: [lines], extras (optional lines filled, of how many) }
export function check(recipe, stores) {
	const lines = recipe.ing.map((line) => ({ line, id: fills(line, stores), need: line[1], optional: !!line[2] }));
	const missing = lines.filter((l) => !l.id && !l.optional);
	const opt = lines.filter((l) => l.optional);
	return { ok: !missing.length, lines, missing, extras: opt.filter((l) => l.id).length, of: opt.length };
}
// Take what a recipe needs out of the stores, first store first (your own larder, then the
// house's), each store's amounts changed in place. Returns { taken: [{ id, n, from }], quality }
// or null when it can't be made. quality: 0.85 with only what's needed, up to 1 with every
// optional extra (the herbs, the garnish), and a little more for meat you brought in yourself.
export function cook(recipe, stores, { wild = null } = {}) {
	const C = check(recipe, stores);
	if (!C.ok) return null;
	const taken = [];
	for (const l of C.lines) {
		if (!l.id) continue;
		let left = l.need;
		for (let k = 0; k < stores.length && left > 1e-6; k++) {
			const s = stores[k], n = Math.min(left, have(s, l.id));
			if (n <= 0) continue;
			s[l.id] = +(have(s, l.id) - n).toFixed(3);
			if (s[l.id] <= 1e-6) delete s[l.id];
			left -= n;
			taken.push({ id: l.id, n: +n.toFixed(3), from: k });
		}
	}
	let quality = 0.85 + (C.of ? 0.15 * C.extras / C.of : 0.15);
	if (wild && taken.some((t) => INGREDIENTS[t.id]?.meat && t.from === 0 && wild[t.id])) quality += 0.1;
	return { taken, quality: +Math.min(1.1, quality).toFixed(3) };
}
// the recipes you could make now first, then the nearest misses (fewest missing lines)
export function rank(stores, list = RECIPES) {
	return list.map((r) => ({ r, c: check(r, stores) })).sort((a, b) => (b.c.ok - a.c.ok) || (a.c.missing.length - b.c.missing.length) || a.r.name.localeCompare(b.r.name));
}
// what a buff gives, in words: "+45 life, +0.6 life a second"
export function buffText(mods, k = 1) {
	const pct = (v) => `+${Math.round(v * k * 100)}%`;
	const W = {
		life: (v) => `+${Math.round(v * k)} life`, hpRegen: (v) => `+${(v * k).toFixed(1)} life a second out of a fight`,
		armor: (v) => `${pct(v)} harm turned aside`, weapon: (v) => `${pct(v)} weapon harm`, weak: (v) => `${pct(v)} on heads and weak points`,
		boss: (v) => `${pct(v)} against bosses`, speed: (v) => `${pct(v)} pace`, jump: (v) => `${pct(v)} jump`, fall: (v) => `${pct(v)} less fall harm`,
		xp: (v) => `${pct(v)} experience`, power: (v) => `${pct(v)} spell strength`, cd: (v) => `spells back ${Math.round(v * k * 100)}% sooner`,
		manaMax: (v) => `+${Math.round(v * k)} mana`, regen: (v) => `+${(v * k).toFixed(1)} mana a second`,
	};
	return Object.entries(mods).map(([s, v]) => (W[s] ? W[s](v) : `${s} ${v}`)).join(', ');
}
