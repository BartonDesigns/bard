import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoot, recoveryItems } from '../src/combat/loot.js';
import { applyInventoryTransaction, createInventoryState, serializeInventory, deserializeInventory } from '../src/gameplay/arms.js';
import { WEAPONS } from '../src/combat/weapons.js';

const eye = { x: 0, y: 1.7, z: 0 }, forward = { x: 0, y: 0, z: -1 };
const soldier = (id = 'aurora-trail-rifle', tier = 3) => ({ kind: 'person', dead: true, F: { gun: id, name: 'Ashfang Raiders' }, loadout: { i: id, l: 7, t: tier }, pos: { x: 0, y: 0, z: -2 } });
function setup(options = {}) {
	let state = createInventoryState('player');
	const loot = createLoot({ nonce: 'testing', apply: (tx) => { const r = applyInventoryTransaction(state, tx); if (r.ok) state = r.state; return r; }, ...options });
	return { loot, state: () => state };
}

test('every armament rank recovers exact level, quality and matching ammunition', () => {
	for (const id of ['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine', 'reedline-hunting-bow']) for (let tier = 0; tier < 5; tier++) {
		const { loot, state } = setup(); const drop = loot.add(soldier(id, tier));
		const picked = loot.take(drop.id, eye);
		assert.equal(picked.ok, true); assert.equal(state().instances[drop.id].i, id);
		assert.equal(state().instances[drop.id].t, tier); assert.equal(state().instances[drop.id].l, 7);
		assert.equal(state().items[WEAPONS[id].box], 1);
		const reloaded = deserializeInventory(serializeInventory(state()), 'player');
		assert.deepEqual(reloaded.instances[drop.id], state().instances[drop.id]);
	}
});
test('a death can produce only one drop and a drop can be collected only once', () => {
	const { loot, state } = setup(), h = soldier(), drop = loot.add(h);
	assert.equal(loot.add(h), null); assert.equal(loot.take(drop.id, eye).ok, true);
	assert.equal(loot.take(drop.id, eye).ok, false); assert.equal(Object.keys(state().instances).length, 2);
});
test('failed inventory transaction retains both weapon and ammunition for retry', () => {
	let locked = true, calls = 0;
	const { loot } = setup({ apply: () => { calls++; return { ok: !locked, message: 'Finish trade' }; } });
	const d = loot.add(soldier()); assert.equal(loot.take(d.id, eye).ok, false);
	assert.equal(loot.drops.size, 1); locked = false;
	assert.equal(loot.take(d.id, eye).ok, true); assert.equal(calls, 2); assert.equal(loot.drops.size, 0);
});
test('walls, distance and facing prevent selection; taking rechecks walls and distance', () => {
	let wall = false; const { loot } = setup({ visible: () => !wall });
	const d = loot.add(soldier()); assert.equal(loot.nearest(eye, forward).id, d.id);
	assert.equal(loot.nearest(eye, { x: 0, z: 1 }), null);
	wall = true; assert.equal(loot.nearest(eye, forward), null); assert.equal(loot.take(d.id, eye).ok, false);
	wall = false; assert.equal(loot.take(d.id, { x: 10, y: 1.7, z: 0 }).ok, false);
	assert.equal(loot.take(d.id, { x: 0, y: 8, z: -2 }).ok, false); assert.equal(loot.drops.size, 1);
});
test('no weapon drops for living, unarmed, surrendered, crew, drones or animals', () => {
	for (const patch of [{ dead: false }, { loadout: null }, { noGun: true }, { crew: true }, { kind: 'drone' }, { kind: 'crawler' }, { F: { gun: 'unknown' } }]) assert.equal(recoveryItems({ ...soldier(), ...patch }, 'loot123'), null);
});
test('loot survives body removal, is bounded, and nearby drops do not expire during inspection', () => {
	const { loot } = setup({ max: 2 }); const h = soldier(), first = loot.add(h);
	h.pos.z = -100; h.loadout.t = 0;
	assert.equal(first.pos.z, -2); assert.equal(first.items[0].t, 3);
	loot.update(601, eye); assert.equal(loot.drops.size, 1);
	const second = loot.add(soldier()); loot.add(soldier());
	assert.equal(loot.drops.size, 2); assert.equal(loot.drops.has(first.id), false);
	assert.ok(loot.drops.has(second.id)); loot.update(601, { x: 100, y: 0, z: 100 });
	assert.equal(loot.drops.size, 0); loot.add(soldier()); loot.clear(); assert.equal(loot.drops.size, 0);
});
