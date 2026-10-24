// Tougher monsters with health bars (Josh 2026-10-23): every monster takes a fight, not a round
// or two (creatures/catalog.js hp); each in a fight shows its life in a bar over it
// (combat/nameplates.js); whoever you target shows at the top with life, armour and a caster's
// mana (combat/target-frame.js), all read through combat/vitals.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_IDS } from '../src/creatures/catalog.js';
import { createHealth, applyDamage, PARTS, CREATURE_HEAD } from '../src/combat/health.js';
import { WEAPONS } from '../src/combat/weapons.js';
import { vitalsOf, lifeText, chipStep, CHIP_HOLD, rankOf, RANK_LABEL, plainName, sortOf, reactionOf } from '../src/combat/vitals.js';
import { plateWanted, plateTop, reachOf, PLATE_REACH } from '../src/combat/nameplates.js';
import { iconOf } from '../src/combat/target-frame.js';
import { cleanPose } from '../src/net/protocol.js';

// rounds of a gun's base damage to the body it takes to bring one down, armour and all
function roundsToKill(S, dmg, type = 'ballistic') {
	const H = createHealth({ max: S.hp, armour: S.armour, soak: 0.5, resist: S.resist });
	let n = 0;
	while (H.state === 'ok' && n < 999) { applyDamage(H, { amount: dmg, type, part: 'body' }); n++; }
	return n;
}

test('no monster drops to a single rifle round any more, and the full-grown ones take a real fight', () => {
	const rifle = WEAPONS['aurora-trail-rifle'].dmg;
	for (const id of SPECIES_IDS) {
		const S = SPECIES[id], n = roundsToKill(S, rifle);
		assert.ok(n >= 2, `${id}: ${n} rifle rounds`);
		if (S.height >= 1.8) assert.ok(n >= 6, `${id} (${S.height} m): only ${n} rifle rounds`);
	}
	// (the small pack ones too: Josh's "not just the main bosses")
	for (const id of ['drain-skulker', 'flarepot', 'ridge-hound', 'gloomcrawler']) assert.ok(roundsToKill(SPECIES[id], rifle) >= 3, id);
});

test('a monster\'s head is a thick skull: a rifle round there drops none of them at once', () => {
	assert.ok(CREATURE_HEAD >= 1.5 && CREATURE_HEAD < PARTS.head);
	const rifle = WEAPONS['aurora-trail-rifle'].dmg;
	for (const id of SPECIES_IDS) assert.ok(roundsToKill(SPECIES[id], rifle * CREATURE_HEAD) >= 2, `${id}: one rifle round to the head`);
});

test('held in the carbine\'s stream, even the smallest lasts a second', () => {
	const C = WEAPONS['warden-spark-carbine'], perS = C.rpm / 60;
	for (const id of SPECIES_IDS) {
		const t = roundsToKill(SPECIES[id], C.dmg, C.type) / perS;
		assert.ok(t >= 1, `${id}: down in ${t.toFixed(2)} s`);
	}
});

test('ranks are known words; an elite is a big one with a weak point, a rare one seldom met', () => {
	let elites = 0;
	for (const id of SPECIES_IDS) {
		const S = SPECIES[id];
		if (!S.rank) continue;
		assert.ok(RANK_LABEL[S.rank], `${id} rank ${S.rank}`);
		assert.ok(S.weak, `${id} is ${S.rank} with no weak point`);
		if (S.rank === 'rare') assert.ok((S.where.odds ?? 1) <= 0.15, `${id} is rare but common`);
		if (S.rank === 'elite') elites++;
	}
	assert.ok(elites >= 4, `${elites} elites`);
	assert.equal(SPECIES['hollow-king'].rank, 'boss');
	assert.equal(SPECIES['drain-skulker'].rank, undefined);
});

test('a caster\'s mana: the Spore Hexer has a few curses in it, then has to come and fight', () => {
	for (const id of SPECIES_IDS) {
		const M = SPECIES[id].mana;
		if (!M) continue;
		assert.ok(SPECIES[id].throw, `${id} has mana and nothing to spend it on`);
		assert.ok(M.max > 0 && M.cost > 0 && M.cost <= M.max && M.regen > 0, id);
		assert.ok(M.max / M.cost >= 2 && M.max / M.cost <= 6, `${id}: ${M.max / M.cost} casts a pool`);
	}
	assert.ok(SPECIES['spore-hexer'].mana);
});

test('vitals read the same from a fighter, a monster, a bystander, a boss and a friend in PvP', () => {
	const H = createHealth({ max: 650, armour: 10 });
	H.hp = 412;
	const fighter = { kind: 'hostile', vitals: () => ({ hp: H.hp, max: H.max, armour: H.armour, armourMax: H.armourMax, mana: 80, manaMax: 120 }) };
	let v = vitalsOf(fighter);
	assert.equal(v.hp, 412); assert.equal(v.max, 650); assert.ok(Math.abs(v.frac - 412 / 650) < 1e-9);
	assert.equal(v.armourMax, 10); assert.equal(v.mana, 80); assert.equal(v.manaMax, 120);
	assert.equal(lifeText(v), '412 / 650');
	// (no mana: none shown)
	v = vitalsOf({ ref: { H } });
	assert.equal(v.mana, null); assert.equal(v.manaMax, 0); assert.equal(v.frac, 412 / 650);
	// (a boss's machine)
	assert.equal(vitalsOf({ kind: 'boss', life: () => ({ hp: 1500, max: 3000 }) }).frac, 0.5);
	// (a friend's shares, over the wire)
	v = vitalsOf({ kind: 'remote', vitals: () => ({ hp: 84, max: 100, mana: 40, manaMax: 100, pct: true }) });
	assert.equal(lifeText(v), '84%'); assert.equal(v.mana, 40);
	// (nothing to show, or nonsense: none)
	assert.equal(vitalsOf({ kind: 'remote', vitals: () => null }), null);
	assert.equal(vitalsOf({ kind: 'prop' }), null);
	assert.equal(vitalsOf({ health: { hp: NaN, max: 100 } }), null);
	// (clamped; a sliver left reads as 1, not 0; thousands spaced)
	assert.equal(vitalsOf({ health: { hp: -5, max: 100 } }).hp, 0);
	assert.equal(lifeText(vitalsOf({ health: { hp: 0.3, max: 4800 } })), '1 / 4,800');
});

test('the pale lag behind a bar holds a moment after each blow, then drains to it; a heal snaps', () => {
	const c = {};
	assert.equal(chipStep(c, 1, 0.016), 1);
	assert.equal(chipStep(c, 0.7, 0.016), 1, 'held where it was');
	let t = 0;
	while (t < CHIP_HOLD - 0.05) { assert.equal(chipStep(c, 0.7, 0.05), 1); t += 0.05; }
	for (let i = 0; i < 60; i++) chipStep(c, 0.7, 0.05);
	assert.ok(Math.abs(c.v - 0.7) < 1e-6, `drained to ${c.v}`);
	// (a second blow while still draining holds again)
	chipStep(c, 0.5, 0.016);
	assert.equal(chipStep(c, 0.5, 0.1), 0.7);
	assert.equal(chipStep(c, 0.9, 0.016), 0.9, 'healed past it: snaps');
});

test('a bar over a monster only when it is in the fight, and never on a tree or a villager not yet turned', () => {
	const mk = (o = {}) => ({ cr: {}, Sp: SPECIES['fog-wight'], H: { hp: 650, max: 650 }, alert: 1, pos: { x: 0, y: 2, z: 0 }, T: {}, ...o });
	assert.equal(plateWanted(mk(), 20), true);
	assert.equal(plateWanted(mk({ alert: 0 }), 20), false, 'unroused and whole');
	assert.equal(plateWanted(mk({ alert: 0, H: { hp: 600, max: 650 } }), 20), true, 'hurt');
	assert.equal(plateWanted(mk(), PLATE_REACH + 1), false, 'too far');
	assert.equal(plateWanted(mk({ alert: 0 }), PLATE_REACH + 10, true), true, 'targeted: from further');
	assert.equal(plateWanted(mk({ dormant: 1, Sp: SPECIES['burnt-giant'] }), 10, true), false, 'a giant asleep as a tree');
	assert.equal(plateWanted(mk({ beast: {}, turn: -1 }), 10, true), false, 'the Moonturned still a villager');
	assert.equal(plateWanted(mk({ beast: {}, turn: 0 }), 10), true, 'turning');
	assert.equal(plateWanted(mk({ ally: { name: 'x' } }), 10), false);
	assert.equal(plateWanted({ ...mk(), cr: null }, 10), false, 'a person: the target frame, not a bar');
	assert.equal(plateWanted(mk({ dead: true, deadT: 0.3 }), 10), true, 'just fallen: it drains away');
	assert.equal(plateWanted(mk({ dead: true, deadT: 2 }), 10), false);
	// (the giant's bar is seen from further, over its head)
	assert.ok(reachOf({ Sp: SPECIES['burnt-giant'] }) > PLATE_REACH * 2.5);
	const top = plateTop(mk({ cr: { size: 1.1 } }));
	assert.ok(Math.abs(top.y - (2 + 3 * 1.1 + 0.35)) < 1e-9);
});

test('names, ranks, sorts and sides on the frame', () => {
	assert.equal(plainName('a Fog Wight'), 'Fog Wight');
	assert.equal(plainName('an Ironvale tank'), 'Ironvale tank');
	assert.equal(plainName('The Hollow King'), 'The Hollow King');
	const wight = { kind: 'hostile', faction: 'nightborn', ref: { cr: {}, Sp: SPECIES['fog-wight'] } };
	const brute = { kind: 'hostile', faction: 'goblins', rank: 'elite', ref: { cr: {} } };
	assert.equal(sortOf(wight), 'Nightborn'); assert.equal(reactionOf(wight), 'hostile'); assert.equal(rankOf(wight), null);
	assert.equal(rankOf(brute), 'elite'); assert.equal(RANK_LABEL[rankOf(brute)], 'Elite');
	assert.equal(iconOf(wight), 'creature');
	const civ = { kind: 'person', faction: 'civ' };
	assert.equal(sortOf(civ), 'Bystander'); assert.equal(reactionOf(civ), 'neutral'); assert.equal(iconOf(civ), 'person');
	assert.equal(reactionOf(civ, () => true), 'hostile', 'one you are brawling with');
	assert.equal(sortOf({ kind: 'person', faction: 'village' }), 'Villager');
	const friend = { kind: 'remote', faction: 'friend:abc' };
	assert.equal(sortOf(friend), 'Player · PvP'); assert.equal(reactionOf(friend), 'hostile'); assert.equal(iconOf(friend), 'remote');
	assert.equal(reactionOf({ kind: 'ally', faction: 'player' }), 'friendly');
	assert.equal(iconOf({ kind: 'car' }), 'vehicle');
});

test('a friend\'s life and mana travel with their pose only with their PvP flag up, as whole percents', () => {
	const base = { p: [1, 2, 3], y: 0, a: 'idle', w: 'earth' };
	assert.deepEqual(cleanPose({ ...base, pk: 1, hv: [84, 40] }).hv, [84, 40]);
	assert.deepEqual(cleanPose({ ...base, pk: 1, hv: [100, -1] }).hv, [100, -1], 'no mana');
	assert.equal(cleanPose({ ...base, hv: [84, 40] }).hv, undefined, 'flag down: not sent on');
	for (const bad of [[101, 0], [50, -2], [50.5, 3], [1], 'x', [1, 2, 3]]) assert.equal(cleanPose({ ...base, pk: 1, hv: bad }).hv, undefined, JSON.stringify(bad));
});
