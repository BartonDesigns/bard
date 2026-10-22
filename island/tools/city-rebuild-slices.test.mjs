// The city's rebuild in slices (bay/city.js update, world/buildslice.js runSteps): a build laid
// out in steps gives the same list under any budget as it does in one go, and no frame runs
// more than one step over its budget. The first set and a jump (a landing, a teleport) run this
// way too now: in one go the Bay's first set held a phone's frame for the best part of a second
// and ran it out of memory as it landed.
//   node island/tools/city-rebuild-slices.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSteps } from '../src/world/buildslice.js';

// a build like the city's: lists filtered and sorted in steps, each step costing a few "ms"
function* build(n, clock) {
	const list = [];
	for (let i = 0; i < n; i++) { if ((i & 63) === 63) { clock.t += 1; yield; } list.push({ x: (i * 37) % 101, z: (i * 53) % 97, h: 3 + (i % 11) }); }
	clock.t += 4; yield;
	const kept = list.filter((o) => o.h > 4);
	clock.t += 2; yield;
	kept.sort((a, b) => a.x - b.x || a.z - b.z);
	clock.t += 3;
	return kept;
}
// the generator's result is kept by the runner's caller: wrap it to catch the return value
const collect = (g) => { let out = null; const it = { next() { const r = g.next(); if (r.done) out = r.value; return r; } }; return { it, result: () => out }; };

test('a budgeted rebuild yields the same list as one done in one go', () => {
	const whole = collect(build(5000, { t: 0 }));
	assert.equal(runSteps(whole.it, Infinity, () => 0), true);
	for (const budget of [1, 4, 10]) {
		const clock = { t: 0 }, sliced = collect(build(5000, clock));
		let frames = 0, worst = 0;
		while (true) { const t0 = clock.t; const done = runSteps(sliced.it, budget, () => clock.t); worst = Math.max(worst, clock.t - t0); frames++; if (done) break; assert.ok(frames < 1e5, 'the build never ends'); }
		assert.deepEqual(sliced.result(), whole.result(), `budget ${budget}: the same buildings in the same order`);
		assert.ok(frames > 1, `budget ${budget}: spread over frames`);
		// (a step runs whole: over by at most the longest step, 4 here)
		assert.ok(worst <= budget + 4, `budget ${budget}: a frame took ${worst}`);
	}
});

test('a frame runs at least one step, and stops once the budget is spent', () => {
	const clock = { t: 0 };
	function* g() { clock.t += 9; yield; clock.t += 9; yield; clock.t += 9; return 1; }
	const it = g();
	assert.equal(runSteps(it, 5, () => clock.t), false); assert.equal(clock.t, 9, 'one step, though it was over the budget');
	assert.equal(runSteps(it, 20, () => clock.t), true); assert.equal(clock.t, 27, 'two steps fit 20 and the build was done');
});
