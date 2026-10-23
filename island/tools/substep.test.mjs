import test from 'node:test';
import assert from 'node:assert/strict';
import { moveSteps, CAP, MOST } from '../src/world/substep.js';

const sum = (a) => a.reduce((x, y) => x + y, 0);

test('a quick frame moves once, by its own time', () => {
	assert.deepEqual(moveSteps(1 / 60), [1 / 60]);
	assert.deepEqual(moveSteps(0.05), [0.05]);
});

test('a slow frame is stepped in pieces of at most the cap, adding up to the real time', () => {
	const steps = moveSteps(0.125);
	assert.equal(steps.length, 3);
	assert.ok(steps.every((s) => s <= CAP + 1e-12));
	assert.ok(Math.abs(sum(steps) - 0.125) < 1e-9);
});

test('a stall is let go past the most pieces', () => {
	const steps = moveSteps(2);
	assert.equal(steps.length, MOST);
	assert.ok(Math.abs(sum(steps) - CAP * MOST) < 1e-9);
});

test('a slow frame covers the recording: 8 fps no longer means 40% speed', () => {
	const frame = 1 / 8;
	assert.ok(sum(moveSteps(frame)) / frame > 0.99);
	assert.ok(Math.min(CAP, frame) / frame < 0.41);
});
