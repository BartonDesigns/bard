import test from 'node:test';
import assert from 'node:assert/strict';
import { beyondH } from '../src/bay/terrain.js';

// past the survey's edge: the sea deepens, the land goes on
test('a sea edge deepens past the survey', () => {
	assert.ok(beyondH(-200000, 0, -40, 3000) < -100);
});

test('past the east or north edge the edge is carried on level, for the globe to take over', () => {
	for (const d of [0, 1000, 3000, 8000]) assert.equal(beyondH(120000, -60000, -3, d, true), -3);
	// and meets the edge where it starts, either way
	assert.equal(beyondH(120000, -60000, -3, 0, false), -3);
});
