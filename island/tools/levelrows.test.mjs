import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { trackUpload, updateRows } from '../src/bay/levelrows.js';

const level = (W = 5, H = 4) => trackUpload(new THREE.DataTexture(new Uint16Array(W * H), W, H, THREE.RedFormat, THREE.HalfFloatType));

test('rows changed before a survey level has gone up whole send the whole level, not just the rows', () => {
	const tex = level();
	const v0 = tex.version;
	updateRows(tex, new Set([1, 2]), 5);
	// (marked ranges on a texture's first upload were all three.js sent: the rest drew as height 0)
	assert.equal(tex.updateRanges.length, 0);
	assert.ok(tex.version > v0);
});

test('once the level is on the card, only the changed rows go up again', () => {
	const tex = level();
	tex.onUpdate(tex);          // (what three.js calls after an upload)
	updateRows(tex, new Set([3]), 5);
	assert.deepEqual(tex.updateRanges.map((r) => [r.start, r.count]), [[60, 20]]);
	// a disposed level goes up whole again
	tex.dispose();
	assert.equal(tex.userData.sent, false);
	assert.equal(tex.updateRanges.length, 0);
	updateRows(tex, new Set([0]), 5);
	assert.equal(tex.updateRanges.length, 0);
});

test('no changed rows, nothing to send', () => {
	const tex = level(), v0 = tex.version;
	updateRows(tex, new Set(), 5);
	assert.equal(tex.version, v0);
});
