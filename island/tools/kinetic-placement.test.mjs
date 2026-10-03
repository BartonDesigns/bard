import test from 'node:test';
import assert from 'node:assert/strict';
import { findKineticSpot } from '../src/music/kinetic-placement.js';
const player = { pos: { x: 0, y: 2, z: 0 }, yaw: 0 };
test('a rig finds flat land in front of the player without moving the player', () => {
	const spot = findKineticSpot({ player, ground: () => 1 });
	assert.deepEqual(spot, { x: 0, y: 1.02, z: -12, yaw: 0, kind: 'garden' });
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
