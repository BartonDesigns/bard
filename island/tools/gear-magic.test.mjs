// Gear magic and your statistics (src/gameplay/gear-magic.js, src/magic/stats.js): gear to level
// 99 by experience and 100★ by its trial, garments worn on four slots, every weapon and garment
// attuned to a school, its magic waking at 5, 25, 50, 75 and the hundredth, the seven attributes
// and where they come from, everything folded into the spells' own numbers, and the caster doing
// what the altered spells and the weapons' hits ask.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { MAX_LEVEL, LEVEL_CAP, ASCENDED, SOFT_LEVEL, statsOf, statScale, trained, trialStep, levelText, xpNeed, xpToMax, combined, upgradeCost } from '../src/gameplay/gear-levels.js';
import { ARMS_CATALOG, GARMENT_SLOTS, createInventoryState, applyInventoryTransaction, serializeInventory, deserializeInventory, sellPrice, cleanTradeSide, ascendTrialOf } from '../src/gameplay/arms.js';
import { AWAKEN, ascendTrial, attunement, awakenings, awakenedBetween, gearMagic, infuseStrands, attributesOf as itemAttrs, isWeaponId, ALTERATIONS, SPELLSHOT, infusionOf, masteryEvery, schoolGlyph } from '../src/gameplay/gear-magic.js';
import { ATTRS, ATTR_IDS, BASE_CAP, BASE_LIFE, ARMOR_CAP, baseAttributes, attributesOf, composeMods, refreshStats, statSheet } from '../src/magic/stats.js';
import { SCHOOLS, SPELL, createMagicState, spellPower, manaCost, cooldownOf, manaMax, shaped } from '../src/magic/spells.js';
import { sanitizeSkills, addUse, useFor, computeMods } from '../src/magic/skills.js';
import { createCaster } from '../src/magic/caster.js';
import { cleanPose } from '../src/net/protocol.js';

const GARMENTS = Object.values(ARMS_CATALOG).filter((x) => x.kind === 'garment');
// an instance of an item attuned to the school asked for (ids are tried until one is)
function attuned(i, school, l = 1, t = 0) {
	for (let n = 0; n < 5000; n++) { const u = `g${n.toString(36)}xyz`; if (attunement({ u, i }) === school) return { u, i, l, t, x: 0 }; }
	throw new Error(`no ${i} attuned to ${school}`);
}
const fresh = () => sanitizeSkills(createMagicState(null));
const withGear = (gear, s = fresh()) => { s.gear = gear; refreshStats(s); return s; };

test('gear climbs to 99 by experience; the hundredth is earned by its trial', () => {
	assert.equal(LEVEL_CAP, 99); assert.equal(ASCENDED, 100); assert.equal(MAX_LEVEL, 100); assert.equal(SOFT_LEVEL, 10);
	const at = (l, t = 0) => statScale({ l, t });
	assert.ok(Math.abs(at(10) - 1.63) < 1e-9 && Math.abs(at(20) - 2.13) < 1e-9, 'the first twenty grow as they did');
	for (let l = 2; l <= ASCENDED; l++) assert.ok(at(l) > at(l - 1), `level ${l} grows`);
	assert.ok(Math.abs(at(99) - 3) < 1e-9 && Math.abs(at(100) - 3.3) < 1e-9, 'three times at 99, a tenth more at the hundredth');
	assert.ok(at(99) - at(98) < at(21) - at(20), 'ever slower');
	assert.ok(at(99, 4) > at(99, 3));
	const lamp = { u: 'lamp01', i: 'camp-lantern', l: 1, t: 0, x: 0 };
	assert.equal(trained(lamp, 1e9).l, LEVEL_CAP, 'experience carries it to 99 and no further');
	const total = Array.from({ length: LEVEL_CAP - 1 }, (_, k) => xpNeed(k + 1)).reduce((a, b) => a + b);
	assert.equal(xpToMax(lamp), total); assert.ok(total > 80000 && total < 95000, `a long climb (${total})`);
	assert.equal(xpToMax({ ...lamp, l: LEVEL_CAP }), 0);
	assert.deepEqual(trained({ ...lamp, l: LEVEL_CAP, x: 7 }, 5000), { ...lamp, l: LEVEL_CAP, x: 7 }, 'at 99 experience no longer counts: x is its trial');
	// a trial's steps, and the hundredth
	const top = { ...lamp, l: LEVEL_CAP };
	assert.deepEqual(trialStep(top, 120, 300), { ...top, x: 120 });
	assert.deepEqual(trialStep({ ...top, x: 299 }, 5, 300), { ...top, l: ASCENDED, x: 0 });
	assert.equal(trialStep({ ...top, l: 50 }, 5, 300).l, 50, 'only at 99');
	assert.equal(levelText(ASCENDED), '100★'); assert.equal(levelText(99), '99');
	assert.ok(upgradeCost({ l: 98, t: 4 }, 240) > upgradeCost({ l: 10, t: 4 }, 240));
	// the wire carries the hundredth, and nothing past it
	assert.equal(cleanPose({ p: [0, 0, 0], h: 'camp-lantern', hl: MAX_LEVEL, ht: 4 }).hl, MAX_LEVEL);
	assert.ok(!('hl' in cleanPose({ p: [0, 0, 0], h: 'camp-lantern', hl: MAX_LEVEL + 1 })));
	assert.ok(cleanTradeSide({ items: [{ ...lamp, l: MAX_LEVEL }] }) && cleanTradeSide({ items: [{ ...lamp, l: MAX_LEVEL + 1 }] }) === null);
});

test('an outfitter stops at 99; a weapon or garment earns its hundredth by its trial', () => {
	assert.equal(ascendTrialOf('reedline-hunting-bow').n, 1);
	assert.equal(ascendTrialOf('wayfarers-hood').n, 300);
	assert.equal(ascendTrialOf('camp-lantern'), null, 'a tool stops at 99');
	let s = createInventoryState('me', { credits: 1e7 });
	for (const [id, n] of [['wayfarers-hood', 1], ['camp-lantern', 1], ['repair-roll', 3]]) for (let k = 0; k < n; k++) s = applyInventoryTransaction(s, { id: `b-${id}-${k}`, kind: 'purchase', sourceId: 'npc-trader', itemId: id, quantity: 1 }).state;
	const find = (i) => Object.values(s.instances).find((x) => x.i === i);
	const hood = find('wayfarers-hood'), lamp = find('camp-lantern');
	s = { ...s, instances: { ...s.instances, [hood.u]: { ...hood, l: LEVEL_CAP }, [lamp.u]: { ...lamp, l: LEVEL_CAP } } };
	const up = applyInventoryTransaction(s, { id: 'u1', kind: 'upgrade', uid: hood.u, sourceId: 'npc-trader' });
	assert.ok(!up.ok && /trial/.test(up.receipt.message), 'no outfitter makes the hundredth');
	assert.equal(applyInventoryTransaction(s, { id: 't0', kind: 'trial', uid: lamp.u, n: 5 }).receipt.code, 'no-trial');
	let r = applyInventoryTransaction(s, { id: 't1', kind: 'trial', uid: hood.u, n: 299 });
	assert.ok(r.ok && r.state.instances[hood.u].l === LEVEL_CAP && r.state.instances[hood.u].x === 299 && r.state.journal.length === s.journal.length, 'counted, not journaled');
	r = applyInventoryTransaction(r.state, { id: 't2', kind: 'trial', uid: hood.u, n: 1 });
	assert.equal(r.state.instances[hood.u].l, ASCENDED, 'the three hundredth spell: 100★');
	assert.equal(applyInventoryTransaction(r.state, { id: 't3', kind: 'trial', uid: hood.u, n: 1 }).ok, false, 'nothing past it');
	assert.equal(deserializeInventory(serializeInventory(r.state)).instances[hood.u].l, ASCENDED, 'kept between visits');
	// combining keeps the higher one, and its trial's progress
	assert.deepEqual(combined({ u: 'aaaa', i: 'x', l: 99, t: 1, x: 40 }, { u: 'bbbb', i: 'x', l: 60, t: 1, x: 500 }), { u: 'aaaa', i: 'x', l: 99, t: 2, x: 40 });
	assert.equal(combined({ u: 'aaaa', i: 'x', l: 60, t: 1, x: 5 }, { u: 'bbbb', i: 'x', l: 99, t: 1, x: 80 }).x, 80);
});

test('garments: two for each slot, sold at outfitters, worn by their own id, one to a slot', () => {
	assert.equal(GARMENTS.length, 8);
	for (const slot of GARMENT_SLOTS) assert.equal(GARMENTS.filter((g) => g.slot === slot).length, 2, slot);
	for (const g of GARMENTS) {
		assert.ok(statsOf({ u: 'aaaa', i: g.id, l: 1, t: 0 }).every((r) => r.unit === 'pt' && ATTRS[r.label.toLowerCase()]), g.id + ' lends attributes');
		assert.ok(sellPrice(g.id, 'npc-trader') > 0, g.id + ' bought back at an outfitter');
		assert.equal(sellPrice(g.id, 'supermarket'), null);
	}
	let s = createInventoryState('me', { credits: 2000 });
	const buy = (id, n) => { const r = applyInventoryTransaction(s, { id: `buy-${id}-${n}`, kind: 'purchase', sourceId: 'npc-trader', itemId: id, quantity: 1 }); assert.ok(r.ok, id); s = r.state; return Object.values(s.instances).find((x) => x.i === id && !Object.values(s.worn).includes(x.u) && x.u !== s.hand && !x.seen && (x.seen = true)); };
	const hood = buy('wayfarers-hood', 1), circlet = buy('stargazer-circlet', 2), boots = buy('trailstrider-boots', 3);
	let r = applyInventoryTransaction(s, { id: 'w1', kind: 'equip', uid: hood.u });
	assert.ok(r.ok && r.state.worn.head === hood.u && !r.state.hand, 'worn on the head, not held');
	s = r.state;
	r = applyInventoryTransaction(s, { id: 'w2', kind: 'equip', uid: circlet.u });
	assert.ok(r.ok && r.state.worn.head === circlet.u, 'a second on the same slot takes its place');
	s = applyInventoryTransaction(r.state, { id: 'w3', kind: 'equip', uid: boots.u }).state;
	assert.deepEqual(Object.keys(s.worn).sort(), ['feet', 'head']);
	assert.equal(applyInventoryTransaction(s, { id: 'w4', kind: 'equip', uid: boots.u, slot: 'hand' }).ok, false, 'never held');
	assert.equal(applyInventoryTransaction(s, { id: 'w5', kind: 'equip', itemId: 'camp-lantern', slot: 'head' }).ok, false, 'only a garment is worn');
	// kept between visits
	assert.deepEqual(deserializeInventory(serializeInventory(s)).worn, s.worn);
	// off again, and gone when sold
	r = applyInventoryTransaction(s, { id: 'u1', kind: 'unequip', slot: 'feet' });
	assert.ok(r.ok && !r.state.worn.feet);
	r = applyInventoryTransaction(s, { id: 's1', kind: 'sell', sourceId: 'npc-trader', itemId: 'stargazer-circlet', uid: circlet.u, quantity: 1 });
	assert.ok(r.ok && !r.state.worn.head, 'a garment sold is no longer worn');
	// an old save with no garments loads with nothing worn
	assert.deepEqual(deserializeInventory(JSON.stringify({ version: 2, credits: 5, instances: {} })).worn, {});
});

test('every weapon and garment is attuned to a school, the same one always', () => {
	const ws = Object.keys(ARMS_CATALOG).filter(isWeaponId), seen = new Set();
	assert.equal(ws.length, 4);
	for (const id of ws) for (let n = 0; n < 300; n++) seen.add(attunement({ u: `w${n}abc`, i: id }));
	assert.deepEqual([...seen].sort(), Object.keys(SCHOOLS).sort(), 'the weapons between them reach every school');
	const counts = {};
	for (let n = 0; n < 2200; n++) { const k = attunement({ u: `h${n.toString(36)}q`, i: 'wayfarers-hood' }); counts[k] = (counts[k] || 0) + 1; }
	assert.equal(Object.keys(counts).length, 11);
	assert.ok(Math.min(...Object.values(counts)) > 120, 'garments spread over the schools');
	const coat = { u: 'abcd1234', i: 'aetherweave-coat', l: 3, t: 1, x: 0 };
	assert.equal(attunement(coat), attunement({ ...coat, l: ASCENDED, t: 4 }), 'levels and tiers leave it be');
	assert.equal(attunement(combined(coat, { ...coat, u: 'zzzz9999' })), attunement(coat), 'combining keeps the one you open');
	assert.equal(attunement({ u: 'abcd', i: 'camp-lantern' }), null, 'tools carry no magic');
	assert.deepEqual(infuseStrands(attuned('wayfarers-hood', 'radiance')), ['light']);
	assert.deepEqual(infuseStrands(attuned('wayfarers-hood', 'void')), ['dark']);
	assert.deepEqual(infuseStrands(attuned('wayfarers-hood', 'storm')), ['light', 'dark']);
	for (const k of Object.keys(SCHOOLS)) assert.ok(schoolGlyph(k), k + ' glyph');
});

test('the magic wakes at 5, 25, 50, 75 and the hundredth, and the better the tier the stronger', () => {
	assert.deepEqual([...AWAKEN], [5, 25, 50, 75, 100]);
	const hood = attuned('wayfarers-hood', 'shadow', 49, 2);
	const rows = awakenings(hood);
	assert.deepEqual(rows.map((r) => r.on), [true, true, false, false, false]);
	assert.match(rows[0].desc, /Shadow spells are 9% stronger/);
	assert.match(rows[2].desc, /Shadowstep leaves you cloaked/);
	assert.match(rows[4].desc, /10% stronger still, and every third one is free/);
	assert.deepEqual(awakenedBetween(hood, 49, 51).map((a) => a.level), [50]);
	const bow = attuned('reedline-hunting-bow', 'primal', ASCENDED, 4);
	const brow = awakenings(bow);
	assert.ok(brow.every((r) => r.on));
	assert.match(brow[1].desc, /Spellstrike/); assert.match(brow[2].desc, /Searing/); assert.match(brow[3].desc, /Cinder/); assert.match(brow[4].desc, /Spellshot comes every 2 hits/);
	// the trial, in words, at 99 only
	assert.equal(ascendTrial(attuned('wayfarers-hood', 'void', 98)).open, false, 'not open below 99');
	const t99 = ascendTrial({ ...attuned('wayfarers-hood', 'void', LEVEL_CAP), x: 42 });
	assert.deepEqual([t99.n, t99.of, t99.open], [42, 300, true]); assert.match(t99.desc, /Cast 300 Void spells while wearing it/);
	assert.match(ascendTrial(attuned('aurora-trail-rifle', 'storm', LEVEL_CAP)).desc, /great beasts/);
	assert.equal(ascendTrial(bow), null, 'none past the hundredth');
	// every school has its alteration, infusion and spellshot, and they name real spells
	for (const k of Object.keys(SCHOOLS)) {
		assert.ok(SPELL[ALTERATIONS[k].spell]?.school === k, k + ' alters one of its own');
		assert.ok(SPELL[SPELLSHOT[k]], k + ' spellshot');
		assert.ok(infusionOf(k, 0).desc.length > 20 && infusionOf(k, 4).name === infusionOf(k, 0).name);
	}
	assert.ok(masteryEvery(4) < masteryEvery(0));
	// what it all adds up to
	const boots = attuned('duskwalker-boots', 'shadow', 75, 4);
	const G = gearMagic([hood, boots, bow]);
	assert.ok(Math.abs(G.power.shadow - (0.09 + 0.13)) < 1e-9, 'two shadow garments stack');
	assert.ok(G.mana.shadow > 0 && G.cd.shadow > 0);
	assert.equal(G.free.shadow, masteryEvery(4));
	assert.equal(G.alter.shadowstep, ALTERATIONS.shadow);
	assert.ok(G.weapon.uid === bow.u && G.weapon.strike > 0 && G.weapon.infuse.status.dot > 0 && G.weapon.shot.spell === 'cinder');
	assert.equal(G.weapon.shot.every, 2, 'the hundredth: Spellshot one hit sooner');
	assert.equal(G.weapon.harm, 0.1);
	assert.equal(G.attrs.precision, itemAttrs(bow).find((a) => a.attr === 'precision').n);
	const up = gearMagic([{ ...boots, l: ASCENDED }]);
	assert.ok(Math.abs(up.power.shadow - (0.13 + 0.1)) < 1e-9 && up.free.shadow === masteryEvery(4) - 1, 'a garment at the hundredth');
	assert.deepEqual(gearMagic([attuned('wayfarers-hood', 'void', 4)]).lines, [], 'asleep below level 5');
});

test('attributes: your ranks and level lend some, your gear the rest', () => {
	const s = fresh();
	assert.ok(ATTR_IDS.every((k) => attributesOf(s)[k].total === 0), 'a newcomer starts at nothing');
	addUse(s, 'resilience', useFor(40)); addUse(s, 'marksman', useFor(20)); addUse(s, 'chrono', useFor(50));
	for (const k of ['radiance', 'void', 'storm']) addUse(s, k, useFor(36));
	s.level = 21;
	const b = Object.fromEntries(Object.entries(baseAttributes(s)).map(([k, v]) => [k, v[0][1]]));
	// (Chrono is a school too: the best three are 50, 36 and 36)
	assert.deepEqual(b, { vigour: 10, resolve: 6, precision: 5, swiftness: 0, potency: 10, focus: 10, haste: 10 });
	s.level = 999;
	assert.equal(baseAttributes(s).focus[0][1], BASE_CAP, 'your own growth is capped');
	const coat = attuned('aetherweave-coat', 'umbral', 20, 4);
	const A = attributesOf(s, [coat]);
	assert.equal(A.vigour.total, 10 + 11);
	assert.deepEqual(A.vigour.from.map((f) => f.label), ['Resilience rank', 'Aetherweave Coat']);
});

test('your statistics become the spells\' own numbers', () => {
	const s0 = fresh(), sp = SPELL.shadowbolt;
	const p0 = spellPower(s0, sp), m0 = manaCost(s0, sp), c0 = cooldownOf(s0, sp), max0 = manaMax(s0);
	assert.deepEqual({ ...composeMods(s0), alter: null, free: null, gearWeapon: null, life: 0 }, { ...computeMods([]), alter: null, free: null, gearWeapon: null, life: 0 }, 'nothing worn, nothing gained: the perks alone');
	const hood = attuned('wayfarers-hood', 'shadow', 75, 4), gloves = attuned('spellbinder-gloves', 'radiance', 1, 0);
	const s = withGear([hood, gloves]);
	assert.ok(spellPower(s, sp) > p0 * 1.12, 'attuned, and Potency');
	assert.ok(manaCost(s, sp) < m0 && cooldownOf(s, sp) < c0 * 0.9, 'flow and Haste');
	assert.equal(manaMax(s), max0 + Math.round(itemAttrs(hood).find((a) => a.attr === 'focus').n * ATTRS.focus.per.manaMax), 'Focus fills the pool');
	assert.ok(Number.isInteger(manaMax(s)));
	assert.ok(spellPower(s, SPELL.sunspark) / spellPower(s0, SPELL.sunspark) < spellPower(s, sp) / p0, 'the hood is shadow\'s, not radiance\'s');
	// Vigour and Resolve
	const v = withGear([attuned('aetherweave-coat', 'void', 20, 4)]);
	assert.equal(v.mods.life, Math.round(11 * ATTRS.vigour.per.life));
	const tank = fresh(); tank.perks = ['hardy', 'thick-skin', 'iron-will', 'unyielding', 'steadfast']; addUse(tank, 'resilience', useFor(100));
	const jacket = attuned('rangers-jacket', 'warding', 20, 4);
	tank.gear = [jacket]; refreshStats(tank);
	assert.ok(Math.abs(tank.mods.armor - (0.38 + (16 + 11) * ATTRS.resolve.per.armor)) < 1e-9, 'perks, then Resolve from rank and jacket');
	tank.gear = Array.from({ length: 6 }, (_, k) => ({ ...jacket, u: jacket.u + k })); refreshStats(tank);
	assert.equal(tank.mods.armor, ARMOR_CAP, 'never past the cap');
	// the sheet
	const sh = statSheet(s, { light: 0.5 });
	assert.equal(sh.schools.length, 11);
	assert.equal(sh.life, BASE_LIFE);
	assert.ok(sh.schools.find((q) => q.id === 'shadow').free === masteryEvery(4));
	assert.ok(sh.magic.length === 4 && sh.magic.every((m) => m.school === 'shadow'));
});

test('a garment\'s alteration reshapes its spell; the catalog is left alone', () => {
	const mods = (school) => withGear([attuned('wayfarers-hood', school, 50)]).mods;
	assert.equal(shaped(SPELL.sunspark, mods('radiance')).split, 3);
	assert.equal(shaped(SPELL['void-shard'], mods('void')).pierce, 'all');
	assert.equal(shaped(SPELL['hex-of-decay'], mods('blight')).status.spread, 10);
	assert.equal(shaped(SPELL['hex-of-decay'], mods('blight')).status.dot, SPELL['hex-of-decay'].status.dot);
	assert.equal(shaped(SPELL.shade, mods('umbral')).n, 2);
	assert.equal(shaped(SPELL['chain-lightning'], mods('storm')).jumps, 7);
	assert.equal(shaped(SPELL.swiftstride, mods('dawn')).waterWalk, true);
	assert.equal(SPELL['hex-of-decay'].status.spread, undefined, 'the catalog is untouched');
	assert.equal(SPELL.shade.n, 1);
	assert.equal(shaped(SPELL.shadowbolt, mods('radiance')), SPELL.shadowbolt, 'other spells as they were');
});

// ---------- the caster, on a pretend fight ----------
function rig(gear = [], o = {}) {
	const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
	camera.position.set(0, 1.68, 0); camera.lookAt(0, 1.68, -10); camera.updateMatrixWorld();
	const foes = (o.foes || []).map((z, k) => ({ id: 'f' + k, kind: 'hostile', bound: { x: 0, y: 1.6, z, r: 0.6 }, ref: {} }));
	const dealt = [], mends = [];
	let hp = 50;
	const combat = {
		me: { id: 'me' },
		firstHit(org, d, range) {
			let best = null;
			for (const T of foes) { const t = (T.bound.x - org.x) * d.x + (T.bound.y - org.y) * d.y + (T.bound.z - org.z) * d.z; if (t <= 0 || t > range) continue; const px = org.x + d.x * t - T.bound.x, py = org.y + d.y * t - T.bound.y, pz = org.z + d.z * t - T.bound.z; if (Math.hypot(px, py, pz) < T.bound.r && (!best || t < best.t)) best = { t, T }; }
			return best;
		},
		ground: () => 0,
		deal: (T, blow) => { dealt.push({ id: T.id, amount: blow.amount }); return { dealt: blow.amount }; },
		mend: (n) => { mends.push(n); hp = Math.min(100, hp + n); return n; },
		vitals: () => ({ hp, max: 100, ko: false }),
		layer: { within: (c, r) => foes.map((T) => ({ T, d: Math.hypot(T.bound.x - c.x, T.bound.z - c.z) })).filter((x) => x.d <= r), map: new Map() },
		igniteAt: () => null, firesNear: () => [], douse: () => {}, hurtPlayer: () => {}, squads: { alive: () => [] },
	};
	const fx = new Proxy({}, { get: () => () => {} });
	const state = createMagicState(null);
	state.known = Object.keys(SPELL); state.mana = 1000;
	sanitizeSkills(state); state.gear = gear; refreshStats(state);
	const pos = new THREE.Vector3(0, 1.68, 0), vel = new THREE.Vector3();
	const C = createCaster({ camera, combat, player: () => ({ state: { pos, vel, lookMode: 'aim' } }), state, fx, light: () => 0.5, hint: () => {}, sky: {}, worldKey: () => 'here', seed: () => 1 });
	return { C, state, foes, dealt, mends, pos };
}
const run = (R, secs) => { for (let t = 0; t < secs; t += 0.05) R.C.update(0.05); };

test('the caster does what an altered spell asks', () => {
	// three sparks
	let R = rig([attuned('stargazer-circlet', 'radiance', 50)]);
	assert.ok(R.C.cast('sunspark')); assert.equal(R.C.info().bolts, 3);
	assert.equal(rig().C.cast('sunspark') && 1, 1);
	// a shard through everyone in its path
	R = rig([attuned('stargazer-circlet', 'void', 50)], { foes: [-6, -9, -12] });
	R.C.cast('void-shard'); run(R, 0.5);
	assert.deepEqual(R.dealt.map((d) => d.id), ['f0', 'f1', 'f2']);
	const plain = rig([], { foes: [-6, -9, -12] }); plain.C.cast('void-shard'); run(plain, 0.5);
	assert.deepEqual(plain.dealt.map((d) => d.id), ['f0', 'f1'], 'unaltered: through the first only');
	// a step that leaves you cloaked
	R = rig([attuned('stargazer-circlet', 'shadow', 50)]);
	assert.ok(R.C.cast('shadowstep')); assert.equal(R.C.cloaked(), true);
	// a mend that lingers
	R = rig([attuned('stargazer-circlet', 'restoration', 50)]);
	R.C.cast('mend'); const first = R.mends.length; run(R, 2);
	assert.ok(R.mends.length > first + 10, 'it goes on healing');
	// a recall that mends
	R = rig([attuned('stargazer-circlet', 'chrono', 50)]);
	R.C.cast('mark-and-recall'); R.state.cds = {}; R.pos.set(30, 1.68, 0);
	R.C.cast('mark-and-recall');
	assert.ok(R.mends.includes(25) && R.pos.x === 0, 'back at the mark, a quarter mended');
	// burning ground where Cinder lands
	R = rig([attuned('stargazer-circlet', 'primal', 50)], { foes: [-8] });
	R.C.cast('cinder'); run(R, 2);
	assert.ok(R.dealt.length > 3, 'the ground goes on burning the foe in it');
});

test('a garment\'s mastery makes every few spells free; a weapon\'s spellshot casts what you do not know', () => {
	const R = rig([attuned('stargazer-circlet', 'radiance', 75, 4)]);
	const cost = manaCost(R.state, SPELL.sunspark), every = masteryEvery(4);
	for (let n = 1; n < every; n++) { R.state.cds = {}; assert.ok(R.C.cast('sunspark')); }
	assert.equal(R.state.mana, 1000 - cost * (every - 1));
	R.state.cds = {}; R.state.mana = 0;
	assert.ok(R.C.cast('sunspark'), 'the free one needs no mana');
	assert.equal(R.state.cds.sunspark, undefined, 'and starts no cooldown');
	assert.equal(R.C.cast('sunspark'), false, 'then the count starts again');
	const S = rig();
	S.state.known = ['sunspark']; S.state.mana = 3;
	assert.ok(S.C.cast('solar-flare', { free: true, quiet: true }));
	assert.equal(S.state.mana, 3);
});

test('what a weapon\'s hits carry reaches the caster', () => {
	const R = rig([], { foes: [-8, -11] });
	assert.ok(R.C.arc(R.foes[0], 12, 8)); assert.deepEqual(R.dealt.at(-1), { id: 'f1', amount: 12 });
	R.C.ward(30, 40); R.C.ward(30, 40);
	assert.equal(R.C.shieldBlow({ amount: 39 }), null, 'the ward takes it');
	R.C.hexOn(R.foes[0], { hold: 1 }); assert.equal(R.foes[0].hex.hold, 1);
	R.state.cds = { sunspark: performance.now() / 1000 + 5 };
	R.C.strike('radiance', 2);
	assert.ok(R.state.cds.sunspark - performance.now() / 1000 < 3.1);
	R.C.fleet(0.2, 3); run(R, 0.1);
});

test('the runtime and the screens are wired', () => {
	const src = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
	const idx = src('../src/magic/index.js');
	for (const k of ['refreshStats(state)', 'combat.setLifeMax', 'M?.gearWeapon', 'blow.melee', "kind === 'hostile' || T?.kind === 'boss'", 'caster.cast(GW.shot.spell, { free: true, quiet: true })', 'arms.trainMany', 'function infuse(']) assert.ok(idx.includes(k), k);
	const gear = src('../src/ui/gear.js');
	for (const k of ['function drawChar', 'else if (!e.repeat) { if (shown() && view === \'char\') close(); else open(\'char\'); }', 'arms.wear(', 'arms.takeOff(', 'M.infuse(', "label('Magic')", 'roomFeatures.has(GEAR_FEATURE)']) assert.ok(gear.includes(k), k);
	assert.match(src('../src/main.js'), /magic: \(\) => HOOKS\.magic/);
	assert.match(src('../src/combat/combat.js'), /setLifeMax: \(n\) =>/);
	assert.match(src('../src/magic/skills-ui.js'), /composeMods\(state, others\)/);
	assert.match(src('../src/net/protocol.js'), /p\.hl <= MAX_LEVEL/);
	assert.match(src('../src/net/protocol.js'), /GEAR_FEATURE = 'gear-levels-100'/);
});
