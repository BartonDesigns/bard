import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounterPacing, RARE_GAP, familyOf } from '../src/people/encounter-pacing.js';
import { farKind } from '../src/people/npc-quests-core.js';
import { LOCAL_TASKS, localOffer } from '../src/people/local-tasks.js';
import { step } from '../src/people/errands-core.js';
import { createStriker } from '../src/combat/melee-rules.js';
import { createWeaponState, trigger, stepWeapon, cancelTrigger } from '../src/combat/weapons.js';
import { focusScore } from '../src/combat/target-focus.js';
import { contractFor, createFieldContract, advanceContract, contractReward, contractPoint } from '../src/combat/field-contracts.js';

const advance = (p, seconds) => { for (let i = 0; i < seconds; i++) p.tick(1); };
test('bag, snatch and lead sources share a twenty-minute budget that survives reload and travel', () => {
	const memory = new Map(), store = { get: (k) => memory.get(k), set: (k, v) => memory.set(k, v) };
	let p = createEncounterPacing({ store, rand: () => 0 });
	assert.equal(p.ready('bag'), false); advance(p, RARE_GAP); assert.equal(p.ready('snatch'), true);
	p.record('snatch'); advance(p, 500);
	p = createEncounterPacing({ store, rand: () => 0 });
	for (const k of ['bag', 'snatch', 'lead', 'favour.snatch']) assert.equal(p.ready(k), false, k);
	advance(p, RARE_GAP); assert.equal(p.ready('lead'), true);
	p.record('lead'); assert.equal(p.ready('bag'), false);
});
test('ambient offers leave quiet time and avoid the last three kinds and consecutive families', () => {
	const p = createEncounterPacing({ rand: () => 0 }), kinds = ['lost', 'pass', 'courier', 'repair', 'survey', 'escort'];
	assert.equal(p.choose(kinds), null); advance(p, 90);
	const seen = [];
	for (let i = 0; i < 20; i++) {
		const k = p.choose(kinds); assert.ok(k); assert.ok(!seen.slice(-3).includes(k));
		if (seen.length) assert.notEqual(familyOf(k), familyOf(seen.at(-1)));
		p.record(k); seen.push(k); assert.equal(p.choose(kinds), null); advance(p, 240);
	}
	assert.ok(new Set(seen).size >= 5);
});
test('background bag and snatch share is three percent, with healthy non-theft variety', () => {
	const counts = new Map();
	for (let i = 0; i < 10000; i++) { const k = farKind((i + 0.5) / 10000); counts.set(k, (counts.get(k) || 0) + 1); }
	assert.equal(counts.get('bag'), 200); assert.equal(counts.get('snatch'), 100); assert.equal(counts.size, 11);
});
test('a sparse area can offer its only task again after a long quiet gap', () => {
	const p = createEncounterPacing({ rand: () => 0 }); advance(p, 90);
	assert.equal(p.choose(['escort']), 'escort'); p.record('escort');
	advance(p, 240); assert.equal(p.choose(['escort']), null);
	advance(p, 480); assert.equal(p.choose(['escort']), 'escort');
});
test('new errands require their distinct objectives before a single completion', () => {
	for (const kind of Object.keys(LOCAL_TASKS)) {
		let E = { ...localOffer(kind, { first: 'Ana' }, { first: 'Sam' }), stage: 'offered', route: [{}, {}, {}] };
		assert.equal(step(E, 'reach').out, null, kind); E = step(E, 'accept').E;
		if (kind === 'survey' || kind === 'cleanup') {
			assert.equal(step(E, 'reach').out, null);
			for (let i = 0; i < 3; i++) E = step(E, 'checkpoint').E;
			assert.equal(E.stage, 'reportback');
		} else if (kind === 'checkin') { assert.equal(step(E, 'reach').out, null); E = step(E, 'visited').E; assert.equal(E.stage, 'reportback'); }
		const done = step(E, 'reach'); assert.equal(done.out.done, true, kind); assert.equal(step(done.E, 'reach').out, null, kind);
	}
});
test('quick punch begins synchronously on press and lands within 67 ms at 30 and 60 fps', () => {
	for (const dt of [1 / 30, 1 / 60]) {
		const s = createStriker(); s.press(); assert.equal(s.state.move, 'jab');
		let t = 0, hits = 0;
		while (!hits && t < .15) { hits += s.tick(dt).length; t += dt; }
		assert.equal(hits, 1); assert.ok(t <= .067, String(t));
		s.release(); for (let i = 0; i < 40; i++) hits += s.tick(dt).length;
		assert.equal(hits, 1, 'release must not throw a second punch');
	}
});
test('early combo input is buffered once; a heavy can be cancelled without landing', () => {
	const s = createStriker(), hits = [];
	s.press(); s.release(); s.press(); s.release();
	for (let i = 0; i < 90; i++) hits.push(...s.tick(1 / 60).map((e) => e.name));
	assert.deepEqual(hits, ['jab', 'cross']);
	s.press({ heavy: true }); assert.equal(s.state.move, 'heavy'); assert.equal(s.state.charging, true);
	for (let i = 0; i < 60; i++) assert.equal(s.tick(1 / 60).length, 0);
	s.cancel(); s.release(); assert.equal(s.tick(1).length, 0);
	assert.equal(s.state.queued, null);
});
test('gun edges arriving in the same frame retain one shot and cancellation discards it', () => {
	const w = createWeaponState({ i: 'aurora-trail-rifle', u: 'test', l: 1, t: 0 });
	trigger(w, true); trigger(w, false);
	assert.equal(stepWeapon(w, 1 / 60).fired, 1);
	assert.equal(stepWeapon(w, 2).fired, 0);
	trigger(w, true); trigger(w, false); cancelTrigger(w); assert.equal(stepWeapon(w, 1).fired, 0);
});
test('target focus respects visibility cone, range, protected actors and PvP', () => {
	const eye = { x: 0, y: 1.7, z: 0 }, forward = { x: 0, y: 0, z: -1 };
	const T = { id: 'npc', kind: 'person', bound: { x: 0, y: 1, z: -5 } };
	const score = (t, opts = {}) => focusScore(t, eye, forward, opts);
	assert.ok(Number.isFinite(score(T)));
	for (const changes of [{ child: true }, { surrendered: true }, { removed: true }, { P: { ragdoll: true } }, { protected: true }, { bound: { x: 0, y: 1, z: 5 } }, { bound: { x: 0, y: 1, z: -100 } }, { kind: 'remote' }]) assert.equal(score({ ...T, ...changes }), Infinity);
	assert.ok(Number.isFinite(score({ ...T, kind: 'remote' }, { rules: { pvp: true } })));
	assert.equal(score({ ...T, bound: { x: 4, y: 1, z: -5 } }), Infinity, 'a bystander at the edge is not selected');
	assert.ok(Number.isFinite(score({ ...T, bound: { x: 4, y: 1, z: -5 } }, { hostile: true })));
});
test('contracts rotate and enforce surveys and hold time before rewards', () => {
	const names = Array.from({ length: 8 }, (_, i) => contractFor(i + 3).name);
	assert.equal(new Set(names).size, 8);
	for (const completed of [3, 4, 5, 6, 7, 8]) {
		const m = createFieldContract({ id: 'test', completed, site: { x: 0, y: 2, z: 0 }, rally: { x: 40, y: 2, z: 0 } });
		advanceContract(m, 'arrive');
		if (m.def.checkpoints) {
			assert.equal(m.stage, 'survey'); assert.notDeepEqual(contractPoint(m), m.site);
			for (let i = 0; i < m.def.checkpoints; i++) { assert.equal(contractReward(m), null); advanceContract(m, 'inspected'); }
		}
		m.def.waves.forEach(() => advanceContract(m, 'cleared'));
		if (m.def.holdSeconds) { assert.equal(m.stage, 'hold'); assert.equal(advanceContract(m, 'held'), false); m.hold = m.def.holdSeconds; advanceContract(m, 'held'); }
		assert.equal(m.stage, 'recover'); assert.equal(contractReward(m), null);
		advanceContract(m, 'collected'); assert.ok(contractReward(m));
	}
});
