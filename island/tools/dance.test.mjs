// Dancing on the beat: the one beat clock (music/beat.js), the dance actions keyed on the
// counts (people/actions.js) and who dances to what (people/dance.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wireBeat, beatNow, dip } from '../src/music/beat.js';
import { ACTIONS, DANCE_NAMES, actionAt } from '../src/people/actions.js';
import { hearing, moveSize, pickDance, danceFor, driveDance, NEAR, HEAR } from '../src/people/dance.js';

globalThis.window = globalThis.window || {};

test('the beat clock counts from the music\'s bar, 0 on the beat, over four-beat bars', () => {
	wireBeat(() => ({ period: 0.5, at: 1000, heard: true }), () => ({ playing: true, energy: 0.8 }));
	let B = beatNow(1000);
	assert.equal(B.playing, true);
	assert.equal(B.bpm, 120);
	assert.ok(Math.abs(B.beat) < 1e-9 && Math.abs(B.phase) < 1e-9);
	B = beatNow(1000 + 1250);
	assert.ok(Math.abs(B.beat - 2.5) < 1e-9, 'two and a half beats on');
	assert.ok(Math.abs(B.phase - 0.5) < 1e-9);
	assert.ok(Math.abs(B.bar - 0.625) < 1e-9);
	// the hold eases in over about a second, never past 1
	for (let t = 2300; t < 6000; t += 16) B = beatNow(t);
	assert.equal(B.on, 1);
	assert.ok(B.energy > 0.7);
});

test('with no music the hold eases off over a couple of seconds and the count goes on', () => {
	wireBeat(() => null, () => null);
	let B = beatNow(10000);
	assert.equal(B.playing, false);
	const was = B.on;
	assert.ok(was > 0.9);
	B = beatNow(11000);
	assert.ok(B.on < was && B.on > 0.3, 'easing off');
	for (let t = 11000; t < 15000; t += 16) B = beatNow(t);
	assert.equal(B.on, 0);
	assert.ok(B.beat > 10, 'still counting');
});

test('a bad or missing clock never throws', () => {
	wireBeat(() => { throw new Error('no faceplate'); });
	assert.doesNotThrow(() => beatNow(20000));
	wireBeat(() => ({ period: NaN, at: 0 }));
	assert.equal(beatNow(20010).playing, false);
});

test('the dip is deepest on the beat and gone between', () => {
	assert.ok(Math.abs(dip(0) - 1) < 1e-9);
	assert.ok(dip(0.5) < 1e-9);
	assert.ok(dip(0.1) > dip(0.3) && dip(0.3) > dip(0.45));
	assert.ok(Math.abs(dip(0.25) - dip(0.75)) < 1e-9);
});

test('four dances, each with its mirror, looping over whole beats with a key on every count', () => {
	assert.deepEqual(DANCE_NAMES, ['dance-twostep', 'dance-twostepM', 'dance-bounce', 'dance-bounceM', 'dance-handsup', 'dance-handsupM', 'dance-sway', 'dance-swayM']);
	for (const name of DANCE_NAMES) {
		const A = ACTIONS[name];
		assert.ok(A.loop, name + ' loops');
		assert.ok(A.beats === 2 || A.beats === 4, name + ' counts whole beats');
		assert.equal(A.keys[0][0], 0); assert.equal(A.keys[A.keys.length - 1][0], 1);
		for (let i = 1; i < A.keys.length; i++) assert.ok(A.keys[i][0] > A.keys[i - 1][0], name + ' keys in order');
		for (let b = 0; b < A.beats; b++) assert.ok(A.keys.some(([u]) => Math.abs(u - b / A.beats) < 1e-9), name + ' has a key on beat ' + (b + 1));
		// first and last keys agree, so the loop never jumps
		assert.deepEqual(A.keys[0][1], A.keys[A.keys.length - 1][1]);
	}
	// the two-step's feet: the right foot out on the one, the left drawn in beside it on the two
	// (actionAt answers one shared object: copied before the next look)
	const feet = (name, u) => { const a = actionAt(name, u); return { L: [...a.fL], R: [...a.fR] }; };
	const one = feet('dance-twostep', 0), two = feet('dance-twostep', 0.25);
	assert.ok(one.R[0] < -0.25 && one.L[0] > 0.25, 'wide on the one');
	assert.ok(Math.abs(two.L[0] - two.R[0]) < 0.3, 'closed on the two');
	// in the air between the counts, down on them
	assert.ok(feet('dance-twostep', 0.125).L[1] > 0.03);
	assert.equal(feet('dance-twostep', 0.25).L[1], 0);
	// the mirror leads with the other foot
	const m = feet('dance-twostepM', 0);
	assert.ok(m.L[0] > 0.25 && m.R[0] < -0.25);
	assert.ok(Math.abs(m.L[0] + one.R[0]) < 1e-9);
});

test('the music reaches people by distance, and the young and outgoing move most', () => {
	assert.equal(hearing(0), 1); assert.equal(hearing(NEAR), 1); assert.equal(hearing(HEAR), 0); assert.equal(hearing(HEAR + 50), 0);
	assert.ok(hearing((NEAR + HEAR) / 2) > 0.45 && hearing((NEAR + HEAR) / 2) < 0.55);
	const kid = moveSize({ seed: 8, age: 9, temper: { outgoing: 0.5, fidget: 0.5 } });
	const elder = moveSize({ seed: 8, age: 78, temper: { outgoing: 0.5, fidget: 0.5 } });
	const shy = moveSize({ seed: 8, age: 30, temper: { outgoing: 0.1, fidget: 0.2 } });
	const loud = moveSize({ seed: 8, age: 30, temper: { outgoing: 0.95, fidget: 0.8 } });
	assert.ok(kid > loud && loud > shy && shy > elder, [kid, loud, shy, elder].join(' '));
	// elders sway, the same person picks the same dance each time
	for (let s = 1; s < 40; s++) {
		const d = pickDance({ seed: s, age: 75 });
		assert.ok(d.startsWith('dance-sway') || d.startsWith('dance-bounce'), d);
		assert.equal(pickDance({ seed: s, age: 30 }), pickDance({ seed: s, age: 30 }));
		assert.ok(DANCE_NAMES.includes(pickDance({ seed: s, age: 20 + s })));
		assert.ok(danceFor({ seed: s }) >= 18 && danceFor({ seed: s }) < 80);
	}
});

test('a dance is held at the bar\'s count on the beat, a touch ahead for the easing', () => {
	wireBeat(() => ({ period: 0.5, at: 0, heard: true }), () => null);
	const got = [];
	const M = { act: (name, u) => got.push([name, u]) };
	driveDance(M, 'dance-twostep', beatNow(2000));   // four beats on: the one again
	assert.equal(got[0][0], 'dance-twostep');
	assert.ok(got[0][1] > 0 && got[0][1] < 0.05, 'just past the one: ' + got[0][1]);
	driveDance(M, 'dance-bounce', beatNow(2250));    // half a beat on, of a two-beat loop
	assert.ok(Math.abs(got[1][1] - (0.5 + 0.07) / 2) < 1e-9);
	driveDance(M, 'not-a-dance', beatNow(2250));
	assert.equal(got.length, 2);
});
