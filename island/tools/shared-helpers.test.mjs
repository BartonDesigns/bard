// Two helpers that used to be copied file by file now have one home each: the sRGB-to-linear
// colour (world/srgb.js) and the JSON deep copy of saved state (persistence/json-copy.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { srgbToLinear } from '../src/world/srgb.js';
import { jsonCopy } from '../src/persistence/json-copy.js';

test('an sRGB colour comes back linear, as a new array each time', () => {
	assert.deepEqual(srgbToLinear([1, 0.5, 0.2]), [1, 0.2140411404715882, 0.033104766565152086]);
	assert.deepEqual(srgbToLinear([0, 0, 0]), [0, 0, 0]);
	const c = [0.3, 0.6, 0.9];
	assert.notEqual(srgbToLinear(c), srgbToLinear(c));
});

test('a JSON copy is deep and keeps only what a save would', () => {
	const state = { a: [1, { b: 'x' }], c: null, d: undefined, e: true };
	const copy = jsonCopy(state);
	assert.deepEqual(copy, { a: [1, { b: 'x' }], c: null, e: true });
	copy.a[1].b = 'y';
	assert.equal(state.a[1].b, 'x');
});
