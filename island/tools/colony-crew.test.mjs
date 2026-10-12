import test from 'node:test';
import assert from 'node:assert/strict';
import { CAST, byId, QUESTS, ITEMS, placeFor, activity, personaOf, colonyOffline, step, stateOf, stepOf, errandFor, offerable, holds, inWindow } from '../src/planet/colony/crew.js';
import { ARMS_CATALOG } from '../src/gameplay/arms.js';
import { makeGathering, validGathering, crowdLayout } from '../src/people/gatherings.js';

test('a named adult crew with the roles the colony needs', () => {
	assert.ok(CAST.length >= 10 && CAST.length <= 16);
	for (const role of ['director', 'traffic', 'hydro', 'medic', 'foreman', 'mechanic', 'relay', 'astronomer', 'cook', 'historian']) assert.ok(byId[role], role);
	for (const c of CAST) {
		assert.ok(c.age >= 18, c.id);
		assert.ok(/^\S+ \S+/.test(c.name), c.id);
		assert.ok(c.lines.length >= 3 && c.bio && c.style && c.hobby, c.id);
	}
	assert.equal(new Set(CAST.map((c) => c.name)).size, CAST.length);
});

test('the day: meals, shifts, the lounge, quarters at night', () => {
	const d = byId.medic;
	assert.equal(placeFor(d, 6.5), 'mess');
	assert.equal(placeFor(d, 9), 'work');
	assert.equal(placeFor(d, 12.5), 'mess');
	assert.equal(placeFor(d, 20), 'lounge');
	assert.equal(placeFor(d, 23), 'quarters');
	assert.equal(placeFor(d, 3), 'quarters');
	assert.equal(placeFor(d, 3, true), 'work');
	// the astronomer works the night, the cook the mess
	assert.equal(placeFor(byId.astronomer, 22), 'work');
	assert.equal(placeFor(byId.astronomer, 8), 'quarters');
	assert.equal(placeFor(byId.cook, 12.5), 'work');
	assert.match(activity(byId.cook, 'work'), /mess/);
});

test('a persona for the model and the shared voice, and lines without one', () => {
	const p = personaOf(byId.relay, { colony: 'Tranquility Colony', now: 'out at Far Side Relay', quest: 'asked the player for a part', news: ['news: the relay is back'] });
	assert.equal(p.first, 'Anika');
	assert.equal(p.colony, 'relay');
	assert.ok(p.facts.length <= 8 && p.facts.every((f) => typeof f === 'string' && f.length <= 400));
	assert.ok(p.facts.some((f) => /Moon/.test(f)));
	assert.match(colonyOffline(p, 'hello'), /Anika/);
	assert.match(colonyOffline(p, 'what do you do?'), /relay/i);
	assert.match(colonyOffline(p, 'where can I eat?'), /mess/i);
	assert.match(colonyOffline(p, 'something else', 0), /\[\[mood/);
	assert.equal(colonyOffline({ colony: 'nobody' }, 'hi'), null);
});

test('the main line runs in order, and side errands stand alone', () => {
	const S = {};
	assert.equal(errandFor(S, 'director').kind, 'offer');
	assert.equal(offerable(S, 'kestrel'), false);
	assert.equal(errandFor(S, 'relay'), null);
	step(S, 'relay', 'accept');
	assert.equal(stepOf(S, 'relay').id, 'fetch');
	assert.equal(holds(S, 'relay'), true, 'Anika waits at the relay');
	step(S, 'relay', 'next'); step(S, 'relay', 'next');
	assert.equal(errandFor(S, 'relay').kind, 'step');
	step(S, 'relay', 'next');
	assert.equal(stateOf(S, 'relay').s, 'done');
	assert.equal(holds(S, 'relay'), false);
	assert.equal(errandFor(S, 'relay').kind, 'offer', 'then the Kestrel');
	step(S, 'kestrel', 'accept'); step(S, 'kestrel', 'next');
	assert.equal(errandFor(S, 'historian').kind, 'step');
	step(S, 'kestrel', 'next');
	assert.equal(errandFor(S, 'historian').kind, 'offer', 'then the earthrise');
	// the core: Ruth hands it over, then the medic hears of it
	step(S, 'core', 'accept');
	assert.equal(errandFor(S, 'foreman').kind, 'hand');
	step(S, 'core', 'next');
	assert.equal(errandFor(S, 'medic').kind, 'step');
	// accepting twice does nothing
	step(S, 'core', 'accept');
	assert.equal(stepOf(S, 'core').id, 'bring');
});

test('the dish only aligns in its window, wrapping midnight too', () => {
	assert.equal(inWindow([21, 23], 22), true);
	assert.equal(inWindow([21, 23], 20.9), false);
	assert.equal(inWindow([23, 1], 0.5), true);
	assert.equal(inWindow(null, 3), true);
});

test('every errand thing is in the inventory catalog and can be traded', () => {
	for (const [id, it] of Object.entries(ITEMS)) {
		assert.ok(ARMS_CATALOG[id], id);
		assert.equal(ARMS_CATALOG[id].marketTradable, true);
		assert.ok(QUESTS[it.quest].steps.some((s) => s.id === it.taken), id);
	}
});

test('the earthrise watch is a small valid gathering, close round its spot', () => {
	const g = makeGathering({ kind: 'watch', placeName: 'the observation lounge', seed: 7 });
	assert.equal(g.title, 'Earthrise watch');
	assert.ok(validGathering(g));
	const L = crowdLayout('watch', g.size, g.seed);
	for (let i = 0; i < g.size; i++) assert.ok(Math.hypot(L[i * 3], L[i * 3 + 1]) < 1.8);
});

test('the maglev eases up to about 300 km/h, cruises, and brakes into the station', async () => {
	const { speedAt } = await import('../src/planet/colony/maglev.js');
	const len = 11000;
	assert.ok(speedAt(0, len) < 5);
	assert.ok(Math.abs(speedAt(len / 2, len) * 3.6 - 299) < 2);
	assert.ok(speedAt(len - 1, len) < 5);
	let s = 0, t = 0;
	while (s < len && t < 1000) { s += speedAt(s, len) * 0.25; t += 0.25; }
	assert.ok(t > 120 && t < 200, `ride takes ${t} s`);
});
