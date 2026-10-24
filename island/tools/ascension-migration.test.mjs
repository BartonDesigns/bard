import test from 'node:test';
import assert from 'node:assert/strict';
import { createMagicState, saveMagic } from '../src/magic/spells.js';
import { sanitizeSkills, pointsOf, levelOf, addXp } from '../src/magic/skills.js';
import { ascend } from '../src/magic/trials.js';
import { useFor } from '../src/magic/perks.js';
import { ARMS_CATALOG, ascendTrialOf, createInventoryState, serializeInventory, deserializeInventory } from '../src/gameplay/arms.js';
import { awakenings, isWeaponId } from '../src/gameplay/gear-magic.js';
import { statScale, trained } from '../src/gameplay/gear-levels.js';
import { cleanGearLevel, tradeLevelLimit, tradeFitsLevel, GEAR_FEATURE, PREVIOUS_GEAR_FEATURE } from '../src/net/protocol.js';

test('legacy levels, XP, perks, mastery, moonlit spells and honor survive repeated save/load', () => {
	for (const level of [1, 20, 98, 99, 100, 143, 999]) {
		let s = sanitizeSkills(createMagicState({ v: 1, level, xp: 43, perks: ['hardy'], known: ['sunspark', 'solar-flare'], use: { resilience: useFor(100) }, mastery: { sunspark: 500 }, moonlit: ['solar-flare'], honor: { pts: 125, pve: 125, pvp: 0 } }));
		const before = saveMagic(s), pts = pointsOf(s);
		for (let i = 0; i < 3; i++) s = sanitizeSkills(createMagicState(JSON.parse(JSON.stringify(saveMagic(s)))));
		assert.equal(s.level, level);
		assert.equal(levelOf(s), level);
		assert.equal(s.xp, 43);
		assert.equal(pointsOf(s), pts);
		for (const key of ['perks', 'mastery', 'moonlit', 'honor']) assert.deepEqual(s[key], before[key]);
		assert.equal(s.ascended, false, 'legacy level alone never awards the rite');
		if (level >= 99) { addXp(s, 1000); assert.equal(s.level, level); assert.equal(s.xp, 43); }
	}
});

test('legacy players above 99 earn one additional point without losing their level', () => {
	const s = sanitizeSkills(createMagicState({ v: 1, level: 143, known: ['tempest'], use: Object.fromEntries(['radiance', 'void', 'storm'].map(k => [k, useFor(100)])), wells: Array.from({ length: 12 }, (_, i) => ({ key: `w${i}`, x: i, z: 0, seed: 1, strand: 'light' })), deeds: { bosses: 3, spared: 25 } }));
	const points = pointsOf(s);
	assert.equal(ascend(s, { weaponTop: 99, wornTop: 5 }, { well: true, light: 0 }), true);
	assert.equal(levelOf(s), 143);
	assert.equal(pointsOf(s), points + 1);
	const back = sanitizeSkills(createMagicState(saveMagic(s)));
	assert.equal(pointsOf(back), points + 1);
	assert.equal(levelOf(back), 143);
});

test('existing level-20 gear keeps all four unlocks, stats and inventory identity', () => {
	for (const item of Object.values(ARMS_CATALOG).filter(i => i.kind === 'garment' || isWeaponId(i.id))) {
		const inst = { u: 'legacy-0001', i: item.id, l: 20, t: 0, x: 0 };
		assert.equal(awakenings(inst).filter(a => a.on).length, 4, item.id);
		assert.ok(Math.abs(statScale(inst) - 2.13) < 1e-12);
		assert.ok(ascendTrialOf(item.id), `${item.id} has a trial, including newer gear`);
		const state = createInventoryState('player-old', { credits: 321 });
		state.instances[inst.u] = inst;
		state.hand = inst.u;
		const back = deserializeInventory(serializeInventory(state));
		assert.deepEqual(back.instances[inst.u], inst);
		assert.equal(back.credits, 321);
		assert.equal(back.hand, inst.u);
		assert.equal(trained(inst, 1200).l > 20, true);
	}
});

test('trade capability limits preserve old rooms and require an upgraded peer for high gear', () => {
	assert.equal(tradeLevelLimit([]), 10);
	assert.equal(tradeLevelLimit([PREVIOUS_GEAR_FEATURE], 100), 20);
	assert.equal(tradeLevelLimit([GEAR_FEATURE]), 20);
	assert.equal(tradeLevelLimit([GEAR_FEATURE], 20), 20);
	assert.equal(tradeLevelLimit(new Set([GEAR_FEATURE]), 100), 100);
	assert.equal(cleanGearLevel('100'), 100);
	assert.equal(cleanGearLevel(999), 10);
	for (const level of [20, 99, 100]) {
		const side = { credits: 3, items: [{ u: 'gear-0001', i: 'camp-lantern', l: level, t: 1, x: 0 }] };
		for (const message of [{ side }, { sides: { a: side, b: { items: [] } } }, { sides: { a: { items: [] }, b: side } }]) {
			assert.equal(tradeFitsLevel(message, 20), level <= 20);
			assert.equal(tradeFitsLevel(message, 100), true);
		}
	}
});
