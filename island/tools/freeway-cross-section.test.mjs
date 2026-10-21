// The freeway's cross section (bay/fwyplan.js): the median between the two directions is
// found from their centre lines, one wall shared down the middle where they run close, a
// shoulder and a rail each where they part.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carriageways, gapLeft, lanesOf, medianAlong, medianFor, SHARED_MAX, SHOULDER_L } from '../src/bay/fwyplan.js';

const road = (pts, o = {}) => ({ cls: 'motorway', w: 14, drive: true, link: false, bridge: false, pts: Float32Array.from(pts), ...o });

test('the other direction is found on the left, and only the other direction', () => {
	// northbound (z falls) at x = 0, southbound at x = -24: in this world the left of north is west
	const nb = road([0, 1000, 0, -1000]), sb = road([-24, -1000, -24, 1000]);
	const C = carriageways([nb, sb, road([30, 1000, 30, -1000])]);
	assert.ok(Math.abs(gapLeft(C, 0, 0, 0, -1) - 24) < 1e-6);
	assert.ok(Math.abs(gapLeft(C, -24, 0, 0, 1) - 24) < 1e-6);
	// (a road heading the same way is no median, and the other direction 54 m off is too far)
	assert.equal(gapLeft(C, 30, 0, 0, -1), 0);
	assert.equal(gapLeft(C, 0, 0, 0, -1, true).r, sb);
	// ramps are not carriageways; the other direction up on a bridge for a while still is
	assert.equal(carriageways([road([0, 0, 0, 10], { link: true })]).segs.length, 0);
	assert.equal(carriageways([road([0, 0, 0, 10], { bridge: true })]).segs.length, 1);
});

test('close: one wall down the middle, paved to it; apart: a 3 m shoulder and a rail each', () => {
	const hw = 7;
	const near = medianFor(hw, 24);
	assert.equal(near.shared, true);
	assert.equal(near.wall, 12);
	assert.equal(near.pave, 12);
	const far = medianFor(hw, 2 * (hw + SHARED_MAX) + 2);
	assert.equal(far.shared, false);
	assert.ok(far.wall > hw + SHOULDER_L && far.wall < hw + SHOULDER_L + 1);
	assert.equal(medianFor(hw, 0).shared, false);
	// along a road: steady through a short gap in the other direction's map
	const nb = road([0, 1000, 0, -1000]), sb1 = road([-24, -1000, -24, -20]), sb2 = road([-24, -4, -24, 1000]);
	const C = carriageways([nb, sb1, sb2]);
	const pts = [];
	for (let z = 60; z >= -60; z -= 8) pts.push({ x: 0, z, dx: 0, dz: -1 });
	assert.ok(medianAlong(C, nb, pts).every((m) => m.shared && m.wall === 12));
});

test('the lanes are the ones the traffic drives', () => {
	assert.deepEqual(lanesOf({ w: 14 }), { n: 4, lw: 3.5 });
	assert.equal(lanesOf({ w: 5 }).n, 2);
});
