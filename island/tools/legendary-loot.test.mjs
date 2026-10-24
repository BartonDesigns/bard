import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGENDARIES } from '../src/gameplay/legendary-items.js';
import { ARMS_CATALOG, applyInventoryTransaction, createInventoryState, serializeInventory, deserializeInventory } from '../src/gameplay/arms.js';
import { cleanInstance, statsOf } from '../src/gameplay/gear-levels.js';
import { attunement, awakenings } from '../src/gameplay/gear-magic.js';
import { WEAPONS, weaponStats, createWeaponState, trigger, stepWeapon, startReload } from '../src/combat/weapons.js';
import { itemModel, weaponOf, HOLDS, GRIPS, triangles } from '../src/crysis/held-items.js';
import { lootProgress, rollEncounter, legendaryReward, rewardEligible, LEGENDARY_PITY, RARE_PITY } from '../src/combat/encounter-loot.js';
import { createLoot } from '../src/combat/loot.js';

const enemy = () => ({ kind: 'creature', dead: true, T: { kind: 'hostile' }, F: { name: 'Nightborn', kind: 'creatures' }, H: { max: 220 }, pos: { x: 0, y: 0, z: -2 } });
const eye = { x: 0, y: 1.7, z: 0 };
test('20 new legends are named, playable, fixed-school, legendary-quality items with no shop spawning', () => {
	assert.equal(LEGENDARIES.length, 20); assert.equal(new Set(LEGENDARIES.map(x => x.id)).size, 20);
	for (const [n, x] of LEGENDARIES.entries()) {
		const item = legendaryReward('legend123', 15, () => (n + .5) / 20);
		assert.equal(item.i, x.id); assert.equal(item.t, 4); assert.ok(ARMS_CATALOG[x.id]);
		assert.deepEqual(ARMS_CATALOG[x.id].sources, {});
		assert.equal(cleanInstance({ ...item, t: 0 }).t, 4);
		assert.equal(attunement(item), x.school); assert.equal(attunement({ ...item, u: 'different' }), x.school);
		assert.ok(statsOf(item).length); assert.ok(awakenings(item)[2].on);
		const view = weaponOf(x.id), S = weaponStats(item, view), W = createWeaponState(item, null, view);
		assert.equal(S.rpm, x.rpm); assert.ok(ARMS_CATALOG[S.box]); assert.ok(HOLDS[x.id] && GRIPS[x.id]);
		trigger(W, true); assert.equal(stepWeapon(W, .1).fired, 1);
		assert.ok(startReload(W, 100)); assert.equal(stepWeapon(W, 10, { reserve: 100 }).loaded, 1);
	}
});
test('all twenty procedural low-LOD assets build finite geometry within bounded budgets', () => {
	for (const x of LEGENDARIES) {
		const model = itemModel(x.id, { tier: 4, level: 15, lod: 'low', plain: true });
		assert.ok(model); assert.ok(triangles(model) < 20000, x.name);
		model.traverse(o => { if (o.isMesh) assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite)); });
	}
});
test('unlucky streaks get first rare immediately, another within five and legendary within twelve', () => {
	let progress = lootProgress(), sinceRare = 0, sinceLegend = 0;
	for (let n = 0; n < 60; n++) {
		const r = rollEncounter(enemy(), `roll${n}`, progress, () => .99); progress = r.progress;
		sinceRare++; sinceLegend++;
		if (n === 0) assert.equal(r.item.t, 2);
		if (r.item) { assert.ok(sinceRare <= RARE_PITY); sinceRare = 0; }
		if (r.item?.t === 4) { assert.ok(sinceLegend <= LEGENDARY_PITY); sinceLegend = 0; }
		assert.ok(sinceRare < RARE_PITY); assert.ok(sinceLegend < LEGENDARY_PITY);
		progress = lootProgress(JSON.parse(JSON.stringify(progress)));
	}
});
test('all random reward bands work and non-combatants cannot advance pity', () => {
	for (const [r, tier] of [[.01, 4], [.1, 3], [.2, 2], [.8, null]]) assert.equal(rollEncounter(enemy(), 'loot123', { rare: 0, legendary: 0 }, () => r).item?.t ?? null, tier);
	for (const patch of [{ dead: false }, { ally: {} }, { crew: true }, { surrendered: 1 }, { child: true }, { T: { kind: 'person' } }, { F: { kind: 'civilians' } }, { kind: 'person', noGun: true }]) {
		const h = { ...enemy(), ...patch }; assert.equal(rewardEligible(h), false);
		assert.deepEqual(rollEncounter(h, 'loot123', { rare: 2, legendary: 8 }).progress, { rare: 2, legendary: 8 });
	}
});
test('legendary pickup is atomic, saves/restores, equips and never duplicates on repeated death', () => {
	let state = createInventoryState('player'), locked = true, saved;
	const loot = createLoot({ nonce: 'testing', rand: () => .01, saveProgress: p => { saved = p; }, apply: tx => {
		if (locked) return { ok: false }; const r = applyInventoryTransaction(state, tx); if (r.ok) state = r.state; return r;
	} });
	const h = enemy(), drop = loot.addReward(h); assert.ok(drop); assert.equal(loot.addReward(h), null);
	assert.equal(saved.legendary, 0); assert.equal(loot.take(drop.id, eye).ok, false); assert.equal(loot.drops.size, 1);
	locked = false; assert.equal(loot.take(drop.id, eye).ok, true); assert.equal(loot.take(drop.id, eye).ok, false);
	state = deserializeInventory(serializeInventory(state), 'player');
	assert.equal(state.instances[drop.id].t, 4); assert.equal(state.items[WEAPONS[drop.items[0].i].box], 1);
	const equipped = applyInventoryTransaction(state, { id: 'equiplegend', kind: 'equip', uid: drop.id, slot: 'hand' });
	assert.ok(equipped.ok); assert.equal(equipped.state.hand, drop.id);
});
test('no-drop rolls never evict existing loot; world clear preserves persisted luck', () => {
	let saved;
	const loot = createLoot({ max: 1, nonce: 'testing', progress: { rare: 0, legendary: 0 }, rand: () => .9, saveProgress: p => { saved = p; } });
	const d = loot.add({ kind: 'person', dead: true, F: { name: 'Raider', gun: 'aurora-trail-rifle' }, loadout: { i: 'aurora-trail-rifle', l: 2, t: 0 }, pos: { x: 0, y: 0, z: 0 } });
	assert.equal(loot.addReward(enemy()), null); assert.ok(loot.drops.has(d.id));
	loot.clear(); assert.deepEqual(saved, { rare: 1, legendary: 1 });
	assert.equal(loot.addReward(enemy()), null); assert.deepEqual(saved, { rare: 2, legendary: 2 });
});
