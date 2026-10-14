// Close combat: strike timing, the string, heavies, the parry and dodge windows, reactions,
// turn-taking among those squaring up, the takedown, arrests and the deeds a fight counts as.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVES, STRING, phaseAt, canBuffer, canFollow, moveTime, nextLight, heavyOf, HEAVY_HOLD, charge, strikeDamage, defend, PARRY_WINDOW, DODGE, sideOf, reaction, hitStop, canTakedown, createTurns, turnsFor, ringAngle, tell, arrestStep, ARREST, fine, fightDeed } from '../src/combat/melee-rules.js';
import { RULES, score } from '../src/combat/morality.js';
import { BLOWS, improvised } from '../src/combat/brawl.js';

test('every strike winds up, lands, recovers, in that order and quickly enough', () => {
	for (const [k, m] of Object.entries(MOVES)) {
		assert.ok(m.wind > 0 && m.active > 0 && m.recover > 0, k);
		assert.equal(phaseAt(m, 0), 'wind', k);
		assert.equal(phaseAt(m, m.wind + m.active / 2), 'active', k);
		assert.equal(phaseAt(m, m.wind + m.active + 0.01), 'recover', k);
		assert.equal(phaseAt(m, moveTime(m) + 0.01), 'done', k);
		// lights are snappy, heavies readable
		if (m.kind === 'light' && !m.item) assert.ok(moveTime(m) < 0.5, k);
		if (m.kind === 'heavy') assert.ok(m.wind >= 0.25, k);
		// the next press is kept a little before the blow is over, and follows within the recovery
		assert.ok(!canBuffer(m, 0) && canBuffer(m, m.wind + m.active), k);
		assert.ok(!canFollow(m, m.wind) && canFollow(m, moveTime(m)), k);
	}
	// heavier blows take longer and hit harder
	assert.ok(moveTime(MOVES.hook) > moveTime(MOVES.jab) && MOVES.hook.dmg > MOVES.jab.dmg);
	assert.ok(MOVES.heavy.dmg > MOVES.hook.dmg && MOVES.heavy.knock > MOVES.hook.knock);
});

test('the string runs jab, cross, hook; a pause starts it again; something in hand swings', () => {
	assert.deepEqual([nextLight(null, 0), nextLight('jab', 0.3), nextLight('cross', 0.3), nextLight('hook', 0.3), nextLight('cross', 2)], ['jab', 'cross', 'hook', 'jab', 'jab']);
	assert.deepEqual(STRING, ['jab', 'cross', 'hook']);
	assert.equal(nextLight('jab', 0.1, 'pipe'), 'pipe');
	assert.equal(heavyOf(null), 'heavy');
	assert.equal(heavyOf('bat'), 'batHeavy');
	assert.ok(MOVES[heavyOf('pipe')] && MOVES[heavyOf('bottle')]);
});

test('a hold becomes a heavy, charged by how long it is held; counters hit harder', () => {
	assert.equal(charge(HEAVY_HOLD - 0.05), 0);
	assert.equal(charge(5), 1);
	assert.ok(charge(0.5) > 0 && charge(0.5) < 1);
	const base = strikeDamage(MOVES.heavy), full = strikeDamage(MOVES.heavy, { chargeLevel: 1 });
	assert.ok(full > base * 1.5);
	// charge means nothing to a light strike
	assert.equal(strikeDamage(MOVES.jab, { chargeLevel: 1 }), strikeDamage(MOVES.jab));
	assert.ok(strikeDamage(MOVES.jab, { counter: true }) > strikeDamage(MOVES.jab) * 1.5);
	assert.ok(strikeDamage(MOVES.jab, { stamina: 10 }) < strikeDamage(MOVES.jab));
});

test('a block raised just in time parries; late it blocks; a heavy breaks it; the dodge has grace', () => {
	const base = { blocking: true, blockT: 0.05, dodgeT: -1, facing: 1, heavy: false };
	assert.equal(defend(base).result, 'parry');
	assert.equal(defend({ ...base, blockT: PARRY_WINDOW + 0.01 }).result, 'block');
	assert.ok(defend({ ...base, blockT: 1 }).k < 0.3);
	const br = defend({ ...base, blockT: 1, heavy: true });
	assert.equal(br.result, 'break');
	assert.ok(br.k > 0 && br.k < 1 && br.stagger > 0);
	// a heavy can still be parried
	assert.equal(defend({ ...base, heavy: true }).result, 'parry');
	assert.ok(defend(base).open > 0);
	// from behind the guard does nothing
	assert.equal(defend({ ...base, facing: -0.8 }).result, 'hit');
	assert.equal(defend({ ...base, blocking: false }).result, 'hit');
	assert.equal(defend({ ...base, blocking: false }).k, 1);
	// the dodge: grace in the middle, none at the very start or after
	assert.equal(defend({ blocking: false, dodgeT: (DODGE.graceFrom + DODGE.graceTo) / 2, facing: 1 }).result, 'evade');
	assert.equal(defend({ blocking: false, dodgeT: 0, facing: 1 }).result, 'hit');
	assert.equal(defend({ blocking: false, dodgeT: DODGE.time, facing: 1 }).result, 'hit');
});

test('which side a blow comes from, and how hard it takes someone', () => {
	// facing +z (heading 0): a blow travelling -z hit them in the front
	assert.equal(sideOf(0, -1, 0), 'front');
	assert.equal(sideOf(0, 1, 0), 'back');
	assert.equal(sideOf(1, 0, 0), 'left');
	assert.equal(sideOf(-1, 0, 0), 'right');
	// facing +x (heading pi/2): a blow travelling -x is in front
	assert.equal(sideOf(-1, 0, Math.PI / 2), 'front');
	assert.equal(reaction(MOVES.jab).kind, 'flinch');
	assert.equal(reaction(MOVES.hook, { poise: 0.2 }).kind, 'stagger');
	assert.equal(reaction(MOVES.heavy).kind, 'down');
	// the nearly beaten go down to less
	assert.equal(reaction(MOVES.hook, { hpFrac: 0.2 }).kind, 'down');
	// the open (parried) are rocked harder
	assert.ok(reaction(MOVES.cross, { open: true }).t > reaction(MOVES.cross).t);
	assert.equal(reaction(MOVES.cross, { blocked: true }).kind, 'blocked');
	// the world holds a beat longer on heavy and parried blows
	assert.ok(hitStop(MOVES.heavy) > hitStop(MOVES.jab));
	assert.ok(hitStop(MOVES.jab, 'parry') > hitStop(MOVES.jab));
	for (const m of Object.values(MOVES)) assert.ok(hitStop(m) <= 0.12);
});

test('a takedown only from behind, close and unseen', () => {
	// they face +z; you stand behind them (at -z)
	assert.equal(canTakedown({ dx: 0, dz: -1.2, heading: 0 }), true);
	assert.equal(canTakedown({ dx: 0, dz: 1.2, heading: 0 }), false);
	assert.equal(canTakedown({ dx: 1.2, dz: 0, heading: 0 }), false);
	assert.equal(canTakedown({ dx: 0, dz: -1.2, heading: 0, aware: true }), false);
	assert.equal(canTakedown({ dx: 0, dz: -3, heading: 0 }), false);
	assert.equal(canTakedown({ dx: 0.5, dz: -1.1, heading: 0 }), true);
});

test('those squaring up take turns: few at once, a breath between, the longest waiting first', () => {
	let r = 0;
	const T = createTurns({ max: 1, gap: [0.5, 0.5], rnd: () => r });
	T.want('a'); T.tick(0.1); T.want('b');
	// a has waited longest
	assert.equal(T.want('b'), false);
	assert.equal(T.want('a'), true);
	assert.equal(T.busy, 1);
	assert.equal(T.want('b'), false);
	T.done('a');
	// a breath before the next
	assert.equal(T.want('b'), false);
	T.tick(0.6);
	assert.equal(T.want('b'), true);
	T.done('b');
	T.tick(1);
	// two at once only when told so
	const U = createTurns({ max: 2, gap: [0, 0] });
	U.want('a'); U.want('b'); U.want('c');
	assert.equal(U.want('a'), true);
	assert.equal(U.want('b'), true);
	assert.equal(U.want('c'), false);
	assert.equal(turnsFor(2), 1);
	assert.equal(turnsFor(5), 2);
	assert.equal(turnsFor(5, true), 1);
	// a fighter that leaves gives its turn back without holding the others up
	U.drop('a');
	assert.equal(U.want('c'), true);
	// spread evenly round you
	assert.ok(Math.abs(ringAngle(1, 4) - Math.PI / 2) < 1e-9);
	// a heavy's tell is longer, the practised tell less
	assert.ok(tell(MOVES.heavy) > tell(MOVES.jab));
	assert.ok(tell(MOVES.jab, 0.9) < tell(MOVES.jab, 0.1));
	// asking again and again makes no difference to who is next
	const V = createTurns({ max: 1, gap: [0, 0] });
	for (let i = 0; i < 5; i++) V.want('x');
	assert.equal(V.holds('x'), true);
	void r;
});

test('an arrest: the police close in, order you down, cuff you if you keep still; resist or run and it ends', () => {
	let a = { state: 'approach', t: 0, comply: 0 };
	const s = (o) => ({ dist: 10, speed: 0, attacking: false, armed: false, dt: 0.1, ...o });
	a = arrestStep(a, s({ dist: 12 }));
	assert.equal(a.state, 'approach');
	a = arrestStep(a, s({ dist: 3 }));
	assert.equal(a.state, 'order');
	// moving about: no closer to cuffs
	for (let i = 0; i < 40; i++) a = arrestStep(a, s({ dist: 2.5, speed: 3 }));
	assert.equal(a.state, 'order');
	for (let i = 0; i < Math.ceil(ARREST.comply / 0.1) + 1; i++) a = arrestStep(a, s({ dist: 2.5 }));
	assert.equal(a.state, 'cuffing');
	for (let i = 0; i < Math.ceil(ARREST.cuff / 0.1) + 1; i++) a = arrestStep(a, s({ dist: 1 }));
	assert.equal(a.state, 'done');
	assert.equal(arrestStep({ state: 'order', t: 0, comply: 1 }, s({ dist: 2, attacking: true })).state, 'resist');
	assert.equal(arrestStep({ state: 'order', t: 0, comply: 1 }, s({ dist: 50 })).state, 'fled');
	// a weapon in hand is not keeping still
	let b = { state: 'order', t: 0, comply: 0 };
	for (let i = 0; i < 60; i++) b = arrestStep(b, s({ dist: 2, armed: true }));
	assert.equal(b.state, 'order');
	assert.equal(fine(2, 1000), 90);
	assert.equal(fine(2, 30), 30);
	assert.equal(fine(0, 0), 0);
});

test('a fight on the compass: starting one costs, breaking one up earns, self-defence is neither', () => {
	assert.equal(fightDeed({ first: true }), 'start-fight');
	assert.equal(fightDeed({ first: true, theyStruck: true }), null);
	assert.equal(fightDeed({ theirBrawl: true }), 'break-up-fight');
	assert.equal(fightDeed({ theirBrawl: true, withMe: true }), null);
	assert.equal(fightDeed({ first: true, hostile: true }), null);
	assert.equal(fightDeed({ first: false }), null);
	for (const k of ['start-fight', 'break-up-fight', 'submit-arrest', 'resist-arrest']) assert.ok(RULES[k], k);
	const start = score('start-fight'), stop = score('break-up-fight');
	assert.ok(start.law < 0 && start.protect < 0);
	assert.ok(stop.protect > 0 && stop.mercy > 0);
	assert.ok(score('resist-arrest').law < score('submit-arrest').law);
});

test('weapons of opportunity: a pipe joins the bat and the bottle', () => {
	assert.ok(BLOWS.pipe && BLOWS.pipe.item);
	assert.ok(['bat', 'bottle', 'pipe', null].includes(improvised(null, () => 0.5)));
	assert.equal(improvised('pipe'), 'pipe');
});
