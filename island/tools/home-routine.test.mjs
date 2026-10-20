// Families at home (people/home-routine.js): the places in a planned house, who is where at an
// hour, and what they say when a fight comes in. Also checks houseplan.js keeps its garage
// (the car doors open into the garage, never into a living room) and lays its dining tables.
//   node --test tools/home-routine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupBoxes, planHouse } from '../src/bay/houseplan.js';
import { spotsOf, arrange, lineFor } from '../src/people/home-routine.js';
import { makeHousehold } from '../src/people/households.js';
import { planDay } from '../src/people/schedules.js';

const house = (k) => {
	const w = 9 + (k * 7) % 10, d = 8 + (k * 5) % 8, h = k % 2 ? 3 : 5.75;
	const boxes = [{ x: 1000 + k * 37.3, z: k * 11.1, w, d, a: 0.12 + k * 0.01, wallH: h, roofH: 2, kind: k % 3, door: 0.5 }];
	groupBoxes(boxes);
	return planHouse(boxes);
};

test('a garage keeps its own floor and most dining rooms get a table', () => {
	let garages = 0, dining = 0, tables = 0;
	for (let k = 0; k < 120; k++) {
		const plan = house(k);
		if (!plan) continue;
		if (plan.garage) {
			garages++;
			const g = plan.garage, c = plan.cellAt((g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2);
			assert.equal(plan.rooms[plan.labels[0][c]]?.type, 'garage', `house ${k}: the garage's middle is the garage`);
		}
		for (const r of plan.rooms) if (r.type === 'dining' && r.cells.length) { dining++; if (plan.items.some((i) => i.type === 'diningTable' && i.room === r.id)) tables++; }
	}
	assert.ok(garages > 20);
	assert.ok(tables / dining > 0.75, `${tables} of ${dining} dining rooms have a table`);
});

test('at night everyone home is in a bed, couples share one, nobody shares a place', () => {
	let checked = 0;
	for (let k = 0; k < 24; k++) {
		const plan = house(k);
		if (!plan) continue;
		const spots = spotsOf(plan);
		for (let seed = 1; seed < 6; seed++) {
			const h = makeHousehold(seed * 7919 + k);
			const day = planDay(h, 2);
			const A = arrange(h, day, spots, 3, { day: 2, sunset: 19.3 });
			const ids = A.map((q) => q.spot.id);
			assert.equal(new Set(ids).size, ids.length, 'one person to a place');
			for (const q of A) if (q.act === 'sleep' || q.act === 'tucked') { assert.ok(q.spot.lie, 'asleep lying down'); checked++; }
			const parents = A.filter((q) => q.act === 'sleep' && q.member.role === 'parent' && h.kind === 'two-parent');
			if (parents.length === 2 && spots.some((s) => s.pair && s.kind === 'bed')) assert.equal(parents[0].spot.item, parents[1].spot.item, 'the parents share a bed');
		}
	}
	assert.ok(checked > 40);
});

test('dinner is eaten together, in one room where it can be', () => {
	let together = 0, meals = 0;
	for (let k = 0; k < 24; k++) {
		const plan = house(k);
		if (!plan) continue;
		const spots = spotsOf(plan);
		for (let seed = 1; seed < 6; seed++) {
			const h = makeHousehold(seed * 7919 + k);
			const A = arrange(h, planDay(h, 2), spots, 18.8, { day: 2, sunset: 19.3 }).filter((q) => q.act === 'eat');
			if (A.length < 2) continue;
			meals++;
			if (new Set(A.map((q) => q.spot.room)).size === 1) together++;
		}
	}
	assert.ok(meals > 5);
	assert.ok(together / meals > 0.8, `${together} of ${meals} dinners in one room`);
});

test('the same hour gives the same places, and people keep their seat from one look to the next', () => {
	const plan = house(4), spots = spotsOf(plan), h = makeHousehold(4242), day = planDay(h, 2);
	const a = arrange(h, day, spots, 20.5, { day: 2, sunset: 19.3 }), b = arrange(h, day, spots, 20.5, { day: 2, sunset: 19.3 });
	assert.deepEqual(a.map((q) => q.spot.id), b.map((q) => q.spot.id));
	const prev = new Map(a.map((q) => [q.member.id, { act: q.act, spot: q.spot.id }]));
	const c = arrange(h, day, spots, 20.6, { day: 2, sunset: 19.3, prev });
	for (const q of c) { const p = prev.get(q.member.id); if (p && p.act === q.act) assert.equal(q.spot.id, p.spot); }
	assert.equal(arrange(h, day, spots, 20.5, { day: 2, sunset: 19.3, max: 1 }).length, Math.min(1, a.length));
	assert.equal(arrange(h, day, spots, 20.5, { day: 2, sunset: 19.3, max: 0 }).length, 0);
});

test('a fight crashing in gets a line about the moment', () => {
	const l = lineFor({ why: 'window', act: 'eat', meal: 'dinner', hour: 18.8, age: 40, seed: 3, n: 0 });
	assert.equal(typeof l, 'string');
	assert.ok(l.length > 3);
	assert.equal(lineFor({ why: 'window', act: 'eat', meal: 'dinner', hour: 18.8, age: 40, seed: 3, n: 0 }), l, 'seeded');
	for (const why of ['window', 'wall', 'shots', 'fight']) for (const act of ['eat', 'tv', 'sleep', 'cook', 'homework']) assert.ok(lineFor({ why, act, hour: 20, age: 30, seed: 7, n: 1 }));
});
