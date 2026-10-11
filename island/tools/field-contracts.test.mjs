import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFieldContract, contractFor, advanceContract, contractReward, FIELD_ROLES } from '../src/combat/field-contracts.js';
import { createLoot } from '../src/combat/loot.js';
import { createInventoryState, applyInventoryTransaction } from '../src/gameplay/arms.js';
const make = (completed = 0) => createFieldContract({ id: 'mc00000', completed, site: { x: 30, y: 1, z: 0 }, rally: { x: 0, y: 1, z: 0 } });
test('starter contract guarantees an uncontested first weapon; later contracts add roles, waves and ranks', () => {
	assert.equal(contractFor(0).waves.length, 0); assert.equal(contractFor(1).waves.length, 1); assert.equal(contractFor(2).waves.length, 2);
	assert.equal(contractFor(5).tier, 3); assert.ok(contractFor(1000).level <= 8); assert.ok(contractFor(1000).credits <= 720);
});
test('travel, every wave, cache collection and return are mandatory before a reward', () => {
	const m = make(2); assert.equal(contractReward(m), null);
	assert.equal(advanceContract(m, 'collected'), false); advanceContract(m, 'arrive'); assert.equal(m.stage, 'secure');
	advanceContract(m, 'cleared'); assert.equal(m.stage, 'secure'); assert.equal(m.wave, 1);
	advanceContract(m, 'cleared'); assert.equal(m.stage, 'recover'); assert.equal(contractReward(m), null);
	advanceContract(m, 'collected'); assert.equal(m.stage, 'return'); assert.ok(contractReward(m));
	advanceContract(m, 'paid'); assert.equal(m.stage, 'complete'); assert.equal(contractReward(m), null);
});
test('completion transaction retries cannot multiply credits or repair supplies', () => {
	const m = make(); advanceContract(m, 'arrive'); advanceContract(m, 'collected'); const tx = contractReward(m);
	const first = applyInventoryTransaction(createInventoryState('player'), tx), retry = applyInventoryTransaction(first.state, tx);
	assert.equal(first.ok, true); assert.equal(retry.duplicate, true); assert.equal(retry.state.credits, 120); assert.equal(retry.state.items['repair-roll'], 1);
});
test('abandonment does not pay and cannot continue progression', () => {
	const m = make(); advanceContract(m, 'abandon'); assert.equal(contractReward(m), null); assert.equal(advanceContract(m, 'arrive'), false);
});
test('cache transactions keep stable IDs across reacceptance and cannot grant two kits', () => {
	let state = createInventoryState('player');
	const apply = (tx) => { const r = applyInventoryTransaction(state, tx); if (r.ok) state = r.state; return r; };
	const data = { id: 'mc00000c', source: 'mc00000', name: 'First light', pos: { x: 0, y: 1, z: -2 }, weapon: { i: 'aurora-trail-rifle', l: 2, t: 0 } };
	for (let i = 0; i < 2; i++) { const loot = createLoot({ apply }); loot.addCache(data); assert.equal(loot.addCache(data), null); assert.equal(loot.take(data.id, { x: 0, y: 2.68, z: 0 }).ok, true); }
	assert.equal(state.items['aurora-trail-rifle'], 1); assert.equal(state.items['trail-rifle-box'], 1);
});
test('roles have distinct real combat budgets and preferred distances', () => {
	const { flanker: f, marksman: m, suppressor: s } = FIELD_ROLES;
	assert.ok(f.speed > m.speed); assert.ok(m.distance[0] > s.distance[1]); assert.equal(m.burst[1], 1);
	assert.ok(s.armour > f.armour); assert.ok(s.burst[0] > m.burst[1]); assert.equal(new Set([f.gun, m.gun, s.gun]).size, 3);
});
test('ordinary drop pressure cannot evict an active contract cache', () => {
	const loot = createLoot({ max: 2, apply: () => ({ ok: true }) });
	loot.addCache({ id: 'cache001', name: 'Supply', pos: { x: 0, y: 1, z: 0 }, weapon: { i: 'aurora-trail-rifle', l: 1, t: 0 } });
	for (let i = 0; i < 5; i++) loot.add({ kind: 'person', dead: true, F: { gun: 'aurora-trail-rifle' }, loadout: { i: 'aurora-trail-rifle', l: 1, t: 0 }, pos: { x: 1, y: 1, z: 0 } });
	assert.equal(loot.drops.size, 2); assert.ok(loot.drops.has('cache001')); loot.update(1000, { x: 100, y: 0, z: 100 }); assert.ok(loot.drops.has('cache001'));
});
