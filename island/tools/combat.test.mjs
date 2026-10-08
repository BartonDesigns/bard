// Combat rules: weapons, health and damage, the child exclusion in the hit filter, wanted
// levels and the bosses' phase machines. node island/tools/combat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, weaponStats, createWeaponState, trigger, stepWeapon, startReload, nextMode, modeOf, spreadNow, spreadDir, damageAt, drawRounds, reserveOf } from '../src/combat/weapons.js';
import { createHealth, applyDamage, tickHealth, revive, PARTS } from '../src/combat/health.js';
import { createLayer, canHit, isChild, personShapes, rayBox, rayCapsule } from '../src/combat/targets.js';
import { createWanted, offend, tickWanted, clearWanted, STARS } from '../src/combat/heat.js';
import { createBossMachine } from '../src/combat/boss-machine.js';
import { BOSSES } from '../src/combat/boss-defs.js';
import { ARMS_CATALOG } from '../src/gameplay/arms.js';

const inst = (i, l = 1, t = 0) => ({ u: 'test0001', i, l, t, x: 0 });

test('every weapon has a box in the catalogue that the shops sell', () => {
	for (const [id, W] of Object.entries(WEAPONS)) {
		assert.ok(ARMS_CATALOG[id], id);
		const box = ARMS_CATALOG[W.box];
		assert.ok(box && box.kind === 'ammo' && box.consumable && box.stackable, W.box);
		assert.equal(box.sources.supermarket, 'purchase');
	}
});

test('level and tier raise damage, accuracy, range, magazine and reload speed', () => {
	const a = weaponStats(inst('mossback-scout-rifle', 1, 0)), b = weaponStats(inst('mossback-scout-rifle', 10, 4));
	assert.ok(b.dmg > a.dmg * 2);
	assert.ok(b.spread < a.spread);
	assert.ok(b.range > a.range);
	assert.ok(b.mag > a.mag);
	assert.ok(b.reload < a.reload);
	assert.equal(weaponStats(inst('camp-lantern')), null);
	assert.ok(damageAt(a, a.range) < damageAt(a, 1));
});

test('semi fires once a press, auto keeps firing at its rate, burst fires its count', () => {
	const R = createWeaponState(inst('aurora-trail-rifle'));
	assert.equal(modeOf(R), 'semi');
	trigger(R, true);
	let n = 0;
	for (let i = 0; i < 120; i++) n += stepWeapon(R, 1 / 60).fired;
	assert.equal(n, 1);
	const A = createWeaponState(inst('warden-spark-carbine'));
	assert.equal(modeOf(A), 'auto');
	trigger(A, true);
	n = 0;
	for (let i = 0; i < 60; i++) n += stepWeapon(A, 1 / 60).fired;
	assert.ok(n >= 5 && n <= 7, `auto ${n}`);
	trigger(A, false);
	assert.equal(nextMode(A), 'burst');
	for (let i = 0; i < 60; i++) stepWeapon(A, 1 / 60);
	trigger(A, true);
	n = 0;
	for (let i = 0; i < 120; i++) n += stepWeapon(A, 1 / 60).fired;
	assert.equal(n, 3);
	// the view's own numbers win
	const V = createWeaponState(inst('warden-spark-carbine'), null, { rate: 2, mag: 10, reload: 1 });
	assert.equal(V.S.mag, 10);
	assert.equal(V.S.reload, 1);
	assert.ok(Math.abs(V.S.interval - 0.5) < 1e-9);
});

test('an empty magazine fires nothing; reload moves rounds from the reserve on time', () => {
	const W = createWeaponState(inst('warden-spark-carbine'), 0);
	trigger(W, true);
	assert.equal(stepWeapon(W, 0.1).empty, true);
	trigger(W, false);
	assert.equal(startReload(W, 0), false);
	assert.equal(startReload(W, 100, 1.5), true);
	let loaded = 0;
	for (let i = 0; i < 80; i++) loaded += stepWeapon(W, 1 / 60, { reserve: 100 }).loaded;
	assert.equal(loaded, 0, 'still reloading at 1.33 s');
	for (let i = 0; i < 20; i++) loaded += stepWeapon(W, 1 / 60, { reserve: 100 }).loaded;
	assert.equal(loaded, W.S.mag);
	assert.equal(W.mag, W.S.mag);
	assert.equal(startReload(W, 100), false, 'a full magazine does not reload');
	const S = W.S;
	assert.equal(reserveOf(5, 2, S), 5 + 2 * S.perBox);
	const d = drawRounds(5, 2, 30, S);
	assert.equal(d.open, 1);
	assert.equal(d.loose, 5 + S.perBox - 30);
});

test('aiming down the sights tightens the spread; moving and firing open it', () => {
	const W = createWeaponState(inst('warden-spark-carbine'));
	const hip = spreadNow(W, 0, 0), ads = spreadNow(W, 1, 0), run = spreadNow(W, 0, 1);
	assert.ok(ads < hip * 0.5);
	assert.ok(run > hip);
	trigger(W, true);
	for (let i = 0; i < 10; i++) stepWeapon(W, 1 / 60);
	assert.ok(spreadNow(W, 0, 0) > hip);
	const d = spreadDir([0, 0, -1], 0.05, () => 0.999);
	const ang = Math.acos(-d[2]);
	assert.ok(ang <= 0.0501 && ang > 0.04);
});

test('health: armour soaks, the head takes more, regen after quiet, down versus dead', () => {
	const h = createHealth({ max: 100, armour: 50, soak: 0.5 });
	const r = applyDamage(h, { amount: 20, type: 'ballistic', part: 'torso' });
	assert.equal(r.absorbed, 10);
	assert.equal(h.hp, 90);
	const g = createHealth({ max: 100 });
	applyDamage(g, { amount: 10, part: 'head' });
	assert.equal(g.hp, 100 - 10 * PARTS.head);
	const me = createHealth({ max: 100, regen: 10, delay: 2, down: true });
	applyDamage(me, { amount: 50 });
	tickHealth(me, 1); assert.equal(me.hp, 50);
	tickHealth(me, 1.5); assert.ok(me.hp > 50);
	assert.equal(applyDamage(me, { amount: 500 }).downed, true);
	assert.equal(me.state, 'down');
	assert.equal(applyDamage(me, { amount: 5 }).ignored, true);
	revive(me, 0.6); assert.equal(me.state, 'ok'); assert.equal(me.hp, 60);
	const foe = createHealth({ max: 30 });
	assert.equal(applyDamage(foe, { amount: 40 }).killed, true);
});

test('children are never hit: not by shots, blasts, hit reports or anything else', () => {
	const L = createLayer();
	const child = { dna: { child: true, age: 7 } }, adult = { dna: { age: 34 } }, teen = { dna: { age: 15 } };
	assert.equal(isChild(child), true);
	assert.equal(isChild(teen), true);
	assert.equal(isChild(adult), false);
	assert.equal(isChild({ ghost: true, dna: {} }), true);
	// a child standing in front of an adult: the shot passes through the child to the adult
	L.add({ id: 'kid', kind: 'person', P: child, child: true, bound: { x: 0, y: 0.6, z: -5, r: 1 }, shapes: personShapes(0, 0, -5, 1.2) });
	L.add({ id: 'kid2', kind: 'person', P: teen, bound: { x: 0, y: 0.8, z: -7, r: 1.2 }, shapes: personShapes(0, 0, -7, 1.6) });
	L.add({ id: 'ghost', kind: 'person', ghost: true, P: { ghost: true, dna: { age: 7 } }, bound: { x: 0, y: 0.6, z: -8, r: 1 }, shapes: personShapes(0, 0, -8, 1.2) });
	L.add({ id: 'adult', kind: 'person', P: adult, bound: { x: 0, y: 0.9, z: -10, r: 1.2 }, shapes: personShapes(0, 0, -10, 1.75) });
	const hit = L.cast({ x: 0, y: 0.7, z: 0 }, { x: 0, y: 0, z: -1 }, 100, { id: 'me', kind: 'player' });
	assert.equal(hit?.T.id, 'adult');
	// even with the flag missing on the target, the body's own age decides
	assert.equal(canHit({ id: 'x', kind: 'person', P: child }), false);
	assert.equal(canHit({ id: 'x', kind: 'person', P: teen }), false);
	// a blast beside them finds only the adult
	const near = L.within({ x: 0, y: 0.7, z: -8 }, 5).map((h) => h.T.id);
	assert.deepEqual(near, ['adult']);
	// nothing else can switch it off: not PvP, not a faction, not a hostile shooter
	assert.equal(canHit({ id: 'k', kind: 'person', child: true }, { id: 'raider', kind: 'hostile', faction: 'ashfang' }, { pvp: true }), false);
	L.remove('adult');
	assert.equal(L.cast({ x: 0, y: 0.7, z: 0 }, { x: 0, y: 0, z: -1 }, 100), null);
});

test('PvP is off unless the room turns it on; a side never hurts its own; protected people are never targets', () => {
	const friend = { id: 'p2', kind: 'remote' };
	assert.equal(canHit(friend, { id: 'p1', kind: 'player' }, {}), false);
	assert.equal(canHit(friend, { id: 'p1', kind: 'player' }, { pvp: true }), true);
	assert.equal(canHit({ id: 'r2', kind: 'hostile', faction: 'ashfang' }, { id: 'r1', kind: 'hostile', faction: 'ashfang' }), false);
	assert.equal(canHit({ id: 'c1', kind: 'person', protected: true }, { id: 'p1', kind: 'player' }), false);
});

test('ray shapes: boxes turn with their yaw, capsules have caps', () => {
	const h = rayBox({ x: 0, y: 0.5, z: 10 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0.5, z: 0 }, [1, 0.5, 2], 0);
	assert.ok(Math.abs(h.t - 8) < 1e-9);
	assert.ok(h.n.z > 0.99);
	const turned = rayBox({ x: 0, y: 0.5, z: 10 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0.5, z: 0 }, [1, 0.5, 2], Math.PI / 2);
	assert.ok(Math.abs(turned.t - 9) < 1e-9);
	assert.ok(Math.abs(rayCapsule({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, 0.5) - 2.5) < 1e-9);
});

test('wanted: offences make stars, shots alone stop at two, out of sight it ebbs, knocked out it clears', () => {
	const W = createWanted(0);
	for (let i = 0; i < 40; i++) offend(W, 'shots');
	assert.equal(W.stars, 2);
	offend(W, 'downCivilian'); offend(W, 'downCivilian');
	assert.ok(W.stars >= 3);
	tickWanted(W, 5, true);
	assert.ok(W.stars >= 3);
	for (let i = 0; i < 120; i++) tickWanted(W, 1, false);
	assert.equal(W.stars, 0);
	offend(W, 'downPolice'); offend(W, 'downPolice'); offend(W, 'downPolice'); offend(W, 'downPolice');
	assert.ok(W.points >= STARS[3]);
	clearWanted(W); assert.equal(W.stars, 0);
	assert.equal(offend(W, 'hitCivilian', false), 0, 'unwitnessed');
});

test('boss machines: telegraph before every attack, phases by health, untouchable while changing, weak points', () => {
	for (const [id, def] of Object.entries(BOSSES)) {
		let seed = 1;
		const B = createBossMachine(def, () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; });
		assert.ok(def.phases.length >= 3, id + ' phases');
		assert.ok(Object.keys(def.weak).length >= 1, id + ' weak points');
		let lastWarn = null, attacks = 0;
		for (let i = 0; i < 60 * 40; i++) for (const e of B.tick(1 / 60)) {
			if (e.type === 'telegraph') lastWarn = e.attack;
			if (e.type === 'attack') { assert.equal(e.attack, lastWarn, id + ' telegraphed'); attacks++; lastWarn = null; }
		}
		assert.ok(attacks >= 3, id + ' attacks ' + attacks);
		// down to the second phase
		let phased = null;
		while (!phased) { const r = B.damage(def.hp * 0.05, 'body'); phased = r.events.find((e) => e.type === 'phase'); }
		assert.equal(phased.phase, 1);
		assert.equal(B.M.state, 'transition');
		assert.equal(B.damage(1e6).dealt, 0, id + ' invulnerable while changing');
		for (let i = 0; i < 60 * 5; i++) B.tick(1 / 60);
		assert.notEqual(B.M.state, 'transition');
		// a weak point open in this phase takes more than the body
		const open = Object.keys(def.weak).find((w) => B.isOpen(w));
		assert.ok(open, id + ' has an open weak point in phase 2');
		const before = B.M.hp;
		const r = B.damage(10, open);
		assert.ok(r.dealt > 10, id + ' weak multiplier');
		assert.ok(B.M.hp < before);
		// and on to the end, dying once
		let deaths = 0;
		for (let k = 0; k < 2000 && B.M.state !== 'dead'; k++) {
			for (const e of B.damage(def.hp * 0.03, 'body').events) if (e.type === 'dead') deaths++;
			for (let i = 0; i < 30; i++) B.tick(0.1);
		}
		assert.equal(B.M.state, 'dead');
		assert.equal(deaths, 1);
		assert.equal(B.M.phase, def.phases.length - 1, id + ' reached the last phase');
		assert.equal(B.damage(100).dealt, 0);
	}
});

test('a breakable weak point can force the next phase', () => {
	const def = { hp: 1000, gap: 1, transition: 1, phases: [{ at: 1, name: 'a', attacks: ['x'] }, { at: 0.2, name: 'b', attacks: ['x'], broken: ['pod'] }, { at: 0.1, name: 'c', attacks: ['x'] }], attacks: { x: { warn: 1, active: 1, recover: 1 } }, weak: { pod: { mult: 2, hp: 40, open: null } } };
	const B = createBossMachine(def);
	const r = B.damage(25, 'pod');
	assert.ok(r.events.some((e) => e.type === 'broken'));
	assert.ok(r.events.some((e) => e.type === 'phase' && e.phase === 1));
	assert.ok(B.M.hp > 900);
});
