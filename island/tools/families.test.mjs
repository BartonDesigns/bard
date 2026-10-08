import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHousehold, makeHouseholds, KINDS, minorsOf, mouths, describe } from '../src/people/households.js';
import { planDay, coverageGaps, whereAt, N, MINDED } from '../src/people/schedules.js';
import { foodFor, liveDay, helpStock, wellOf, storyOf, questsFor, recordDeed, FOOD_DEEDS, feedVillage, fundGarden, makeGarden, donate, makeFoodBank, ACCESS, COLONY_FOOD } from '../src/people/food.js';
import { makeTeen, isTeen, isTeenAge, growthOf, teenHeight, teenStyle, teenActivity, teensAbout, teenPersona, teenOffline, voiceFor } from '../src/people/teens.js';
import { isMinor } from '../src/combat/targets.js';

const many = (n, f = (i) => makeHousehold(i * 7919 + 3)) => Array.from({ length: n }, (_, i) => f(i));

test('households come in every shape, from their seed', () => {
	const H = many(1500), kinds = new Set(H.map((h) => h.kind));
	for (const k of Object.keys(KINDS)) assert.ok(kinds.has(k), `no ${k}`);
	assert.deepEqual(makeHousehold(42), makeHousehold(42));
	for (const h of H) {
		assert.ok(h.members.length >= 1);
		if (/parent|blended|multigenerational/.test(h.kind)) assert.ok(h.members.some((m) => m.age >= 18) && minorsOf(h).length >= 1, describe(h));
		if (h.kind === 'grandparents-raising') assert.ok(h.members.some((m) => m.role === 'grandparent') && !h.members.some((m) => m.role === 'parent'));
		for (const m of h.members) assert.ok(m.age > 0 && m.age < 100);
	}
	// single parents of either sex, and couples of the same sex now and then
	const singles = H.filter((h) => h.kind === 'single-parent').map((h) => h.members[0].male);
	assert.ok(singles.includes(true) && singles.includes(false));
	assert.ok(H.some((h) => h.kind === 'couple' && h.members[0].male === h.members[1].male));
	const E = makeHouseholds(7, [{ x: 0, z: 0 }], { camps: [{ x: 1, z: 1 }] });
	assert.equal(E.length, 2); assert.ok(E[1].unhoused);
});

test('no child is ever left alone, any household, any day', () => {
	let kids = 0, night = 0;
	for (const h of many(2500)) for (let d = 0; d < 7; d++) {
		const p = planDay(h, d);
		assert.deepEqual(coverageGaps(h, p), [], `${describe(h)} day ${d}`);
		for (const k of minorsOf(h).filter((m) => m.age < 13)) {
			kids++;
			for (let s = 0; s < N; s++) {
				const c = p.carer[k.id][s];
				assert.ok(c && c !== 'self', `${k.id} alone at slot ${s}`);
				if (!MINDED.has(c)) { const m = h.members.find((q) => q.id === c); assert.ok(m && (m.age >= 18 || m.age >= 15 || (m.age >= 13 && p.at[k.id][s] === 'transit')), 'minded by a grown-up or an older sibling'); }
			}
		}
		for (const k of minorsOf(h).filter((m) => m.age >= 13 && m.age < 16)) assert.ok(p.carer[k.id][2] && p.carer[k.id][2] !== 'self', 'a young teen is not alone overnight'), night++;
	}
	assert.ok(kids > 1000 && night > 100);
});

test('the day: school, the school run, work shifts, dinner, bedtime', () => {
	const H = many(800);
	let run = 0, night = 0, dinner = 0, changed = 0;
	for (const h of H) {
		const p = planDay(h, 2);
		for (const m of h.members) {
			if (m.school === 'elementary') assert.equal(whereAt(p, m.id, 11).at, 'school');
			if (m.age < 10) assert.equal(whereAt(p, m.id, 2).act, 'sleep');
		}
		run += p.notes.filter((n) => n.kind === 'school-run' || n.kind === 'pickup').length;
		night += h.members.some((m) => m.job?.night) ? 1 : 0;
		dinner += h.members.some((m) => whereAt(p, m.id, 18.75).act === 'dinner') ? 1 : 0;
		changed += p.notes.filter((n) => /leaves-early|starts-late|night-off|stays-home/.test(n.kind)).length;
	}
	assert.ok(run > 50 && night > 10 && dinner > 400 && changed > 0);
	// at the weekend nobody is in school
	for (const h of H.slice(0, 100)) { const p = planDay(h, 6); for (const m of h.members) assert.notEqual(whereAt(p, m.id, 11).at, 'school'); }
});

test('food: budgets, pantries and well-being; where food is hard to reach, it shows', () => {
	const run = (access) => {
		const H = many(200, (i) => makeHousehold(i * 104729 + 11));
		for (const h of H) foodFor(h, 'oakland', { access });
		for (let w = 0; w < 3; w++) for (let d = 1; d <= 7; d++) for (const h of H) liveDay(h, planDay(h, d % 7), d % 7);
		return H;
	};
	const good = run(ACCESS.oakland), desert = run(ACCESS['food-desert']);
	const avg = (H) => H.reduce((a, h) => a + wellOf(h), 0) / H.length;
	assert.ok(avg(good) > avg(desert) + 0.05, `well ${avg(good)} vs ${avg(desert)}`);
	const q = (H) => H.reduce((a, h) => a + h.food.quality, 0) / H.length;
	assert.ok(q(good) > q(desert));
	// kids' focus follows how the house eats
	const kidsFocus = (H) => { const L = H.flatMap((h) => minorsOf(h).map((m) => h.well[m.id].focus)); return L.reduce((a, b) => a + b, 0) / L.length; };
	assert.ok(kidsFocus(good) > kidsFocus(desert));
	// helping a family stock up helps
	const h = desert.sort((a, b) => wellOf(a) - wellOf(b))[0], w0 = wellOf(h), q0 = h.food.quality;
	assert.ok(helpStock(h, 150) > 0);
	assert.ok(h.food.quality > q0 && wellOf(h) >= w0);
	for (const x of [...good, ...desert]) { assert.ok(x.food.budget >= 0 && Number.isFinite(x.food.need)); assert.ok(typeof storyOf(x) === 'string'); }
	assert.ok(mouths(h) > 0);
});

test('food work for the player, and the compass', () => {
	const H = many(12, (i) => makeHousehold(i * 31 + 5));
	for (const h of H) foodFor(h, 'suburb');
	const bank = makeFoodBank('b'); assert.ok(donate(bank, 88) > 0);
	const g = makeGarden('g'); assert.equal(fundGarden(g, 300, H), 5); assert.ok(H.filter((h) => h.food.garden).length >= 5);
	const p0 = H[0].food.pantry.protein; assert.ok(feedVillage(H, 10) > 0); assert.ok(H[0].food.pantry.protein > p0);
	assert.ok(questsFor(H, 'here').length >= 2);
	const pending = [], rec = [];
	assert.equal(recordDeed(null, 'feed-family', { target: 'a family' }, pending).kind, 'feed-family');
	assert.equal(pending.length, 1);
	const fake = { score: (k) => (k === 'food-bank' ? { mercy: 1 } : null), record: (d) => (rec.push(d), d) };
	recordDeed(fake, 'food-bank', { place: 'x' }, pending); recordDeed(fake, 'feed-village', {}, pending);
	assert.equal(rec.length, 1); assert.equal(pending.length, 2);
	for (const k in FOOD_DEEDS) assert.ok(FOOD_DEEDS[k].mercy >= 0 && FOOD_DEEDS[k].protect > 0);
	assert.ok(COLONY_FOOD.racksFor(12) >= 4);
});

test('teens: their age, their bodies, their clothes, their lives; and the ward', () => {
	for (let i = 0; i < 300; i++) {
		const d = { seed: i * 977 + 1, age: 18, male: i % 2 === 0, height: i % 2 ? 1.63 : 1.76, ancestry: [0.3, 0.3, 0.4], temper: { outgoing: 0.5, confident: 0.5, warmth: 0.5 }, outfit: {}, style: {} };
		makeTeen(d, 13 + (i % 5) + 0.5);
		assert.ok(d.age >= 13 && d.age < 18 && d.teen && d.minor && !d.child);
		assert.ok(isTeen({ dna: d }) && isTeenAge(d.age));
		assert.ok(isMinor({ dna: d }), 'the ward covers every teen');
		assert.ok(d.growth > 0 && d.growth <= 1);
		assert.ok(d.height > 1.4 && d.height < 1.95, `height ${d.height}`);
		assert.ok(d.style.top && d.style.bottom && d.style.shoes);
		assert.ok(!['crop', 'tank'].includes(d.style.top.kind));
	}
	assert.ok(growthOf(13, false) > growthOf(13, true));
	assert.ok(teenHeight(17, true, 1.78) > teenHeight(13, true, 1.78));
	const r = () => 0.3;
	assert.equal(teenStyle(r, { male: true, age: 15 }, { uniform: true }).uniform, true);
	assert.equal(teenStyle(r, { male: false, age: 16 }, { sport: true }).top.kind, 'jersey');
	assert.ok(teenActivity(Math.random, { h: 16, zone: 'park', age: 14 }));
	assert.equal(teenActivity(() => 0.99, { h: 20, age: 13, weekend: true }) === 'job', false);
	assert.ok(teensAbout(11, 'neighbourhood', false, true) > teensAbout(11, 'neighbourhood', false, false));
	assert.ok(teensAbout(19, 'retail') > teensAbout(23, 'retail'));
	const d = { seed: 5, age: 15, male: true, temper: { outgoing: 0.5 } };
	const p = teenPersona({ name: 'A B', first: 'A', years: 9 }, d);
	assert.equal(p.age, 15); assert.ok(p.minor && /grade/.test(p.job));
	assert.match(teenOffline(p, 'want to go on a date'), /get going/);
	assert.ok(voiceFor(d).pitch > 0.9);
});
