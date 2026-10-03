import test from 'node:test';
import assert from 'node:assert/strict';
import { findKineticSpot, RIG_FOOTPRINTS, kineticFootprint } from '../src/music/kinetic-placement.js';
const player = { pos: { x: 0, y: 2, z: 0 }, yaw: 0 };
test('a rig finds flat land in front of the player without moving the player', () => {
	const spot = findKineticSpot({ player, ground: () => 1 });
	assert.deepEqual(spot, { x: 0, y: 1.02, z: -(Math.hypot(18, 18) / 2 + 2), yaw: 0, kind: 'garden' });
	assert.deepEqual(player.pos, { x: 0, y: 2, z: 0 });
});
test('placement rejects water, unknown terrain, cliffs and fully blocked ground', () => {
	assert.equal(findKineticSpot({ player, ground: () => -1 }), null);
	assert.equal(findKineticSpot({ player, ground: () => NaN }), null);
	assert.equal(findKineticSpot({ player, ground: x => x + 100 }), null);
	assert.equal(findKineticSpot({ player, ground: () => 2, blocked: () => true }), null);
	assert.equal(findKineticSpot({ player, ground: () => 2, wet: () => true }), null);
});
test('an obstruction makes the search choose a separate clear footprint', () => {
	const blocked = (x,z) => Math.abs(x)<2 && Math.abs(z+12)<2;
	const spot = findKineticSpot({ player, ground: () => 1, blocked });
	assert.ok(spot); assert.ok(Math.hypot(spot.x,spot.z+12)>10);
});
test('every authored rig samples its entire maximum footprint and keeps it away from the player', () => {
	for (const kind of Object.keys(RIG_FOOTPRINTS)) {
		const [width, depth] = kineticFootprint(kind);
		const samples = [], spot = findKineticSpot({ player, kind, ground: (x,z) => { samples.push([x,z]); return 1; } });
		assert.ok(spot, kind);
		assert.ok(Math.hypot(spot.x, spot.z) >= Math.hypot(width, depth) / 2 + 2, kind);
		assert.equal(Math.max(...samples.map(p=>p[0])) - Math.min(...samples.map(p=>p[0])), width);
		assert.ok(Math.abs(Math.max(...samples.map(p=>p[1])) - Math.min(...samples.map(p=>p[1])) - depth)<1e-9);
		assert.ok(samples.length <= 324, kind);
	}
	assert.equal(findKineticSpot({ player, kind: 'unknown', ground: () => 1 }), null);
});
test('footprints follow validated count and stay within the declared maximum budget', () => {
	for (const [kind, maximum] of Object.entries(RIG_FOOTPRINTS)) {
		const extent = kineticFootprint(kind, 1e6), standard = kineticFootprint(kind);
		assert.ok(extent.every((n, i) => n <= maximum[i]), kind);
		assert.ok(standard.every((n, i) => n <= extent[i]), kind);
	}
	assert.ok(kineticFootprint('dominoes')[0] < RIG_FOOTPRINTS.dominoes[0]);
	assert.ok(kineticFootprint('harp')[0] < RIG_FOOTPRINTS.harp[0]);
});
