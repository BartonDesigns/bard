import test from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS, amountText, filletGrams, fishMeat, gameMeat } from '../src/cooking/ingredients.js';
import { RECIPES, RECIPE, check, cook, rank, buffText } from '../src/cooking/recipes.js';
import { eat, active, dayEnd, mealMods, foldMeals, MAX_MEALS, DAY_ENDS } from '../src/cooking/meals.js';
import { createLarder, stow, take, plate, takePlate, saveLarder, settle } from '../src/cooking/larder.js';
import { kitchenStock, shelves, shopKind, pantryLoss, createKitchenLog, tookFrom, owed, rollDay } from '../src/cooking/kitchens.js';
import { hungerAt, hungerWord, productivity, districtHunger, lastMeal } from '../src/cooking/hunger.js';
import { composeMods } from '../src/magic/stats.js';
import { createMagicState } from '../src/magic/spells.js';
import { sanitizeSkills } from '../src/magic/skills.js';

test('every recipe is whole: known ingredients, steps, a buff in stats terms, salt or seasoning', () => {
	const STATS = new Set(['life', 'hpRegen', 'armor', 'weapon', 'weak', 'boss', 'speed', 'jump', 'fall', 'xp', 'power', 'cd', 'manaMax', 'regen']);
	assert.ok(RECIPES.length >= 15);
	for (const r of RECIPES) {
		assert.ok(r.name && r.from && r.serves > 0 && r.minutes > 0, r.id);
		assert.ok(r.steps.length >= 4, `${r.id} has a method`);
		assert.ok(r.ing.length >= 5, `${r.id} has its full list`);
		for (const [ids, n] of r.ing) for (const id of [].concat(ids)) { assert.ok(INGREDIENTS[id], `${r.id}: ${id}`); assert.ok(n > 0); }
		for (const k of Object.keys(r.buff.mods)) assert.ok(STATS.has(k), `${r.id}: ${k}`);
		assert.ok(buffText(r.buff.mods).length > 4);
		assert.ok(r.ing.some(([id]) => ['salt', 'soy-sauce', 'pepper'].includes(id)), `${r.id} is seasoned`);
	}
	assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
});

test('amounts read like a cookbook', () => {
	assert.equal(amountText('olive-oil', 30), '2 tbsp extra-virgin olive oil');
	assert.equal(amountText('cumin', 2.5), '1 tsp ground cumin');
	assert.equal(amountText('venison', 900), '900 g venison');
	assert.equal(amountText('garlic', 3), '3 garlic cloves');
	assert.match(amountText('milk', 480), /^2 cups/);
});

test('your catch and your kill become meat', () => {
	assert.equal(fishMeat('rainbow trout').id, 'trout');
	assert.equal(fishMeat('king salmon').id, 'salmon');
	assert.equal(fishMeat('striped bass').id, 'white-fish');
	assert.equal(filletGrams('striped bass', 10), Math.round(10 * 453.6 * 0.4));
	assert.equal(gameMeat('deer').id, 'venison');
	assert.equal(gameMeat('wild_turkey').id, 'game-bird');
	assert.equal(gameMeat('person'), null);
});

test('cooking takes from the larder first, then the kitchen, and lacks what is missing', () => {
	const r = RECIPE['venison-stew'];
	const larder = { venison: 2000 }, kit = {};
	assert.equal(check(r, [larder, kit]).ok, false);
	for (const [ids, n, opt] of r.ing) if (!opt) { const id = [].concat(ids)[0]; if (id !== 'venison') kit[id] = n * 2; }
	const C = check(r, [larder, kit]);
	assert.ok(C.ok);
	const res = cook(r, [larder, kit], { wild: { venison: 2000 } });
	assert.ok(res);
	assert.equal(larder.venison, 1100);
	assert.ok(res.taken.every((t) => t.id === 'venison' ? t.from === 0 : t.from === 1));
	// only what's needed: 0.85, plus a little for your own venison
	assert.equal(res.quality, 0.95);
	// any fish will do for the tacos
	assert.ok(check(RECIPE['fish-tacos'], [{ trout: 500 }]).lines[0].id === 'trout');
	// the ones you can make come first
	const R = rank([{ ...kit, venison: 900 }]);
	assert.equal(R[0].c.ok, true);
});

test('meals last until 4 am, stack three, refresh the same dish, and fold into stats', (ctx) => {
	const t = new Date(2026, 9, 20, 19, 30).getTime();
	// composeMods reads the clock too: keep it inside this meal's lifetime.
	ctx.mock.method(Date, 'now', () => t + 5);
	assert.equal(new Date(dayEnd(t)).getHours(), DAY_ENDS);
	assert.equal(new Date(dayEnd(t)).getDate(), 21);
	assert.equal(new Date(dayEnd(new Date(2026, 9, 20, 2).getTime())).getDate(), 20);
	let m = [];
	m = eat(m, 'cioppino', 1, t).meals;
	m = eat(m, 'carnitas', 1, t + 1).meals;
	m = eat(m, 'aglio-olio', 1, t + 2).meals;
	assert.equal(m.length, MAX_MEALS);
	const again = eat(m, 'carnitas', 1, t + 3);
	assert.equal(again.topped, true); assert.equal(again.meals.length, 3);
	const four = eat(again.meals, 'chili', 1, t + 4);
	assert.equal(four.replaced.id, 'cioppino');
	assert.equal(active(four.meals, dayEnd(t) + 1).length, 0, 'gone by 4 am');
	const mods = mealMods(four.meals, t + 5);
	assert.ok(mods.weapon > 0 && mods.armor > 0 && mods.cd > 0);
	// through composeMods: life and armour up, kept with no other change (death never touches s.fed)
	const s = sanitizeSkills(createMagicState(null));
	const base = composeMods(s);
	s.fed = active(four.meals, t + 5);
	const fed = composeMods(s);
	assert.ok(fed.life > base.life, 'life up');
	assert.ok(fed.armor > base.armor, 'armour up');
	assert.ok(fed.cd.all > (base.cd.all || 0), 'spells back sooner');
	const f = foldMeals({ power: {} }, [{ id: 'dal-tadka', q: 1, until: t + 9e9, at: t }], t);
	assert.equal(f.power.all, 0.15);
});

test('the larder keeps a cool box, your own share and plates for the day', () => {
	const L = createLarder();
	assert.equal(stow(L, 'venison', 5000, { wild: true }), 5000);
	assert.equal(stow(L, 'venison', 9000), 7000, 'a cool box holds so much');
	assert.equal(L.wild.venison, 5000);
	take(L, 'venison', 9000);
	assert.equal(L.have.venison, 3000); assert.equal(L.wild.venison, 3000);
	L.have.venison = 1000; settle(L); assert.equal(L.wild.venison, 1000);
	plate(L, 'chili', 1, 3);
	assert.equal(L.plates.length, 3);
	assert.equal(takePlate(L, 'chili').id, 'chili');
	const back = createLarder(JSON.parse(JSON.stringify(saveLarder(L))));
	assert.equal(back.plates.length, 2); assert.equal(back.have.venison, 1000);
});

test('a kitchen holds what the household can afford, the same all day, less what you took', () => {
	const rich = kitchenStock({ seed: 7, pantry: { staples: 8, fresh: 4, protein: 5 }, day: 100 });
	const poor = kitchenStock({ seed: 7, pantry: { staples: 0.6, fresh: 0, protein: 0.2 }, day: 100 });
	const n = (k) => Object.keys(k.fridge).length + Object.keys(k.cupboard).length;
	assert.ok(n(rich) > n(poor) + 5, `${n(rich)} vs ${n(poor)}`);
	assert.deepEqual(kitchenStock({ seed: 7, day: 100 }), kitchenStock({ seed: 7, day: 100 }));
	assert.ok(rich.cupboard.salt > 0);
	const took = kitchenStock({ seed: 7, pantry: { staples: 8, fresh: 4, protein: 5 }, day: 100, taken: { salt: rich.cupboard.salt } });
	assert.equal(took.cupboard.salt, undefined);
	const gave = kitchenStock({ seed: 7, day: 100, taken: { venison: -800 } });
	assert.equal(gave.fridge.venison >= 800, true, 'a gift shows in their fridge');
	const loss = pantryLoss({ venison: 900, flour: 500 }, 3);
	assert.ok(loss.protein > 0 && loss.staples > 0 && loss.fresh === 0);
	const K = createKitchenLog(null, Date.UTC(2026, 9, 20, 12));
	tookFrom(K, 'h:1,2', 'venison', 450);
	assert.ok(owed(K, 'h:1,2') >= 18);
	assert.equal(rollDay(K, Date.UTC(2026, 9, 21, 12)), true);
	assert.equal(owed(K, 'h:1,2'), 0);
});

test('shops: a grocer sells everything at the place\'s prices, a fish market only fish', () => {
	const g = shelves('grocer', { seed: 3, day: 9, place: 'sf' }), s = shelves('grocer', { seed: 3, day: 9, place: 'island' });
	assert.ok(g.length > 60);
	const price = (L, id) => L.find((x) => x.id === id).price;
	assert.ok(price(g, 'olive-oil') > price(s, 'olive-oil'), 'the city is dearer');
	assert.ok(shelves('fishmarket', { seed: 1 }).every((x) => x.aisle === 'Seafood counter'));
	const short = shelves('grocer', { seed: 3, day: 9, short: 1 }).filter((x) => x.out).length, full = shelves('grocer', { seed: 3, day: 9, short: 0 }).filter((x) => x.out).length;
	assert.ok(short > full, 'hungry streets empty the shelves');
	assert.equal(shopKind('grocer'), 'grocer'); assert.equal(shopKind('fishmarket'), 'fishmarket'); assert.equal(shopKind('cafe'), null);
});

test('everyone gets hungry: between meals it climbs, a thin pantry keeps it high, food on the table brings it down', () => {
	assert.equal(lastMeal(12.6, 0).meal, 'lunch');
	const after = hungerAt(13, { seed: 1, quality: 0.8 }), before = hungerAt(18.4, { seed: 1, quality: 0.8 });
	assert.ok(before > after, `${before} > ${after}`);
	const thin = hungerAt(15, { seed: 1, quality: 0.25, security: 'short' }), well = hungerAt(15, { seed: 1, quality: 0.9 });
	assert.ok(thin > well);
	assert.ok(hungerAt(18, { seed: 1, quality: 0.5, fed: 0 }) < hungerAt(18, { seed: 1, quality: 0.5 }));
	assert.equal(hungerWord(0.1), 'fed'); assert.equal(hungerWord(0.9), 'starving');
	assert.ok(productivity(1) < 0.65 && productivity(0) === 1);
	const D = districtHunger([{ food: { quality: 0.3, security: 'short' }, members: [{ seed: 1, age: 40 }, { seed: 2, age: 9 }] }, { food: { quality: 0.9, security: 'secure' }, members: [{ seed: 3, age: 35 }] }], 17);
	assert.equal(D.short, 0.5); assert.ok(D.output < 1 && D.output > 0.5);
});
