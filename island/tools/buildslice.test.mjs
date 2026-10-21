// The builders' share of a frame (world/buildslice.js).
//   node island/tools/buildslice.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlice, viewDistance } from '../src/world/buildslice.js';

test('quick frames keep the builder\'s own slice, slow ones give it a share, capped', () => {
	assert.equal(buildSlice(1 / 60, 3), 3);
	assert.ok(Math.abs(buildSlice(0.068, 3) - 8.16) < 1e-9);
	assert.equal(buildSlice(0.5, 3), 9);
	assert.equal(buildSlice(undefined, 4), 4);
});

test('of buildings near alike, the one in front of you comes first', () => {
	const cam = { x: 0, z: 0 }, fwd = { x: 0, z: -1 };
	assert.equal(viewDistance(20, 0, -25, cam, fwd), 20);
	assert.ok(viewDistance(20, 0, 25, cam, fwd) > viewDistance(30, 0, -35, cam, fwd));
	assert.equal(viewDistance(0, 0, 0, cam, fwd), 0, 'the one you are in');
	assert.equal(viewDistance(12, 3, 4, cam, null), 12);
});
