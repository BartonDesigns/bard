// Looking round on a touch screen: the drag's acceleration, the gyro's axes, the pitch's easing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lookGain, screenRates, levelPitch, LEVEL, lookPrefs } from '../src/ui/touch-look.js';

test('a slow drag is fine, an ordinary one as set, a fast swipe turns far', () => {
	assert.ok(Math.abs(lookGain(0) - 0.7) < 1e-9);
	assert.ok(Math.abs(lookGain(0.6) - 1) < 1e-9);
	assert.ok(lookGain(2) > lookGain(1) && lookGain(1) > lookGain(0.3));
	assert.ok(Math.abs(lookGain(50) - 2.6) < 1e-9, 'capped');
	assert.ok(Math.abs(lookGain(-1) - 0.7) < 1e-9);
});

test('the gyro turns about the screen, whichever way it is held', () => {
	const r = { alpha: 0, beta: 10, gamma: 20 };
	assert.deepEqual(screenRates(r, 0), { yaw: 20, pitch: 10 });
	assert.deepEqual(screenRates(r, 90), { yaw: 10, pitch: -20 });
	assert.deepEqual(screenRates(r, -90), { yaw: -10, pitch: 20 });
	assert.deepEqual(screenRates(r, 270), { yaw: -10, pitch: 20 });
	assert.deepEqual(screenRates(r, 180), { yaw: -20, pitch: -10 });
});

test('walking with no look, the pitch drifts back to level, gently', () => {
	let p = -0.6;
	const one = levelPitch(p, 1 / 60);
	assert.ok(one > p && one - p < 0.02, 'a small step a frame');
	for (let i = 0; i < 60 * 6; i++) p = levelPitch(p, 1 / 60);
	assert.ok(Math.abs(p - LEVEL.pitch) < 0.01, 'level after a few seconds');
});

test('invert and gyro start off', () => {
	assert.equal(lookPrefs.invertY, false);
	assert.equal(lookPrefs.gyro, false);
});
