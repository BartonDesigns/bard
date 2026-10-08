// Combat rules: weapons, health and damage, the child exclusion in the hit filter, wanted
// levels and the bosses' phase machines. node island/tools/combat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, weaponStats, createWeaponState, trigger, stepWeapon, startReload, nextMode, modeOf, spreadNow, spreadDir, damageAt, drawRounds, reserveOf } from '../src/combat/weapons.js';
import { createHealth, applyDamage, tickHealth, revive, PARTS } from '../src/combat/health.js';
import { createLayer, canHit, isMinor, warded, strike, personShapes, rayBox, rayCapsule } from '../src/combat/targets.js';
import { createMorality, score, RULES, MODIFIERS } from '../src/combat/morality.js';
import { createRelations, FACTIONS, PLAYER, shouldSurrender } from '../src/combat/factions.js';
import { createFireField } from '../src/combat/fire.js';
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

test('minors (children and teenagers) carry the Spark: no damage path reaches them', () => {
	const kid = { dna: { child: true, age: 7 } }, teen = { dna: { age: 15 } }, adult = { dna: { age: 34 } }, eighteen = { dna: { age: 18 } };
	assert.equal(isMinor(kid), true);
	assert.equal(isMinor(teen), true);
	assert.equal(isMinor({ age: 17 }), true, 'age on the person');
	assert.equal(isMinor({ dna: { age: 13, teen: true } }), true, 'a teen group from the people system');
	assert.equal(isMinor(adult), false);
	assert.equal(isMinor(eighteen), false);
	assert.equal(isMinor({ ghost: true, dna: {} }), true, 'the ghost child');
	let harmed = 0;
	const onHit = () => { harmed++; return { dealt: 1 }; };
	const L = createLayer();
	// a teen standing in front of an adult: the shot stops at the teen in a shimmer, harmlessly
	L.add({ id: 'teen', kind: 'person', P: teen, bound: { x: 0, y: 0.8, z: -5, r: 1.2 }, shapes: personShapes(0, 0, -5, 1.6), onHit });
	L.add({ id: 'adult', kind: 'person', P: adult, bound: { x: 0, y: 0.9, z: -10, r: 1.2 }, shapes: personShapes(0, 0, -10, 1.75), onHit });
	const shooter = { id: 'me', kind: 'player' };
	const h = L.cast({ x: 0, y: 0.7, z: 0 }, { x: 0, y: 0, z: -1 }, 100, shooter);
	assert.equal(h.T.id, 'teen');
	assert.equal(h.ward, true);
	assert.deepEqual(strike(h.T, { amount: 999, type: 'blast' }, shooter, { pvp: true }), { ward: true, dealt: 0 });
	assert.equal(harmed, 0);
	// the flag missing, the body's age decides; nothing can switch it off
	for (const P of [kid, teen, { ghost: true }]) {
		const T = { id: 'x', kind: 'person', P, onHit };
		assert.equal(warded(T), true);
		assert.equal(canHit(T, shooter, { pvp: true }), false);
		assert.equal(canHit(T, { id: 'r', kind: 'hostile', faction: 'ashfang' }), false);
		assert.equal(strike(T, { amount: 50 }, { id: 'r', kind: 'hostile', faction: 'ashfang' }).ward, true);
	}
	// a blast among them: only the adult is in the blast's list; the minors are its wards
	L.add({ id: 'kid', kind: 'person', P: kid, bound: { x: 0, y: 0.6, z: -8, r: 1 }, shapes: personShapes(0, 0, -8, 1.2), onHit });
	const wards = [];
	const near = L.within({ x: 0, y: 0.7, z: -8 }, 6, null, {}, wards).map((x) => x.T.id);
	assert.deepEqual(near, ['adult']);
	assert.deepEqual(wards.map((T) => T.id).sort(), ['kid', 'teen']);
	for (const x of L.within({ x: 0, y: 0.7, z: -8 }, 6)) strike(x.T, { amount: 10 });
	assert.equal(harmed, 1, 'only the adult was harmed');
	// an adult is struck normally
	assert.equal(strike(L.get('adult'), { amount: 5 }, shooter).dealt, 1);
});

test('the morality table: one place, context weighs it, the ledger keeps both you and the world', () => {
	for (const [k, R] of Object.entries(RULES)) assert.ok(typeof R.line === 'string' && ['mercy', 'law', 'protect', 'honest'].every((a) => Number.isFinite(R[a])), k);
	const plain = score('kill', {}), self = score('kill', { selfDefence: true, hostileTarget: true }), cruel = score('kill', { vulnerable: true, unarmed: true });
	assert.ok(self.mercy > plain.mercy && self.mercy < 0, 'self-defence weighs far less');
	assert.ok(cruel.protect < plain.protect * 2, 'harming the vulnerable and unarmed weighs much more');
	assert.ok(score('kill-surrendered').mercy < score('kill').mercy * 5);
	assert.ok(score('spare').mercy > 0);
	assert.ok(score('arson', { occupied: true }).protect < score('arson', { empty: true }).protect);
	assert.ok(score('steal', { poor: true }).honest < score('steal', { rich: true }).honest);
	assert.ok(score('ward').protect <= -30);
	assert.ok(score('defend-village').protect > 0 && score('raid-village').protect < 0);
	assert.ok(score('kill', { lawTarget: true }).law < plain.law);
	assert.equal(score('nonsense'), null);
	assert.ok(Object.keys(MODIFIERS).includes('vulnerable'));
	const mem = new Map(), store = { get: (k) => mem.get(k), set: (k, v) => mem.set(k, v) };
	const M = createMorality({ store, now: () => 1 });
	const e = M.record({ kind: 'raid-village', place: 'Hollow Creek', world: 'TERRAN:7', ctx: { witnessed: true } });
	assert.ok(e.line.includes('Hollow Creek'));
	assert.ok(M.me().protect < 0 && M.world('TERRAN:7').protect < 0);
	assert.match(M.remembers('Hollow Creek'), /remembers what you did/);
	const again = createMorality({ store });
	assert.equal(again.me().deeds, 1, 'saved');
	for (let i = 0; i < 12; i++) again.record({ kind: 'kill', ctx: { vulnerable: true, unarmed: true } });
	assert.ok(again.reactions().bounty >= 1, 'the world sends bounty hunters');
	assert.ok(again.reactions().priceK > 1, 'and charges more');
});

test('surrender: the badly hurt and outnumbered may yield; machines and creatures never do', () => {
	const yes = () => 0, no = () => 0.99;
	assert.equal(shouldSurrender({ hpFrac: 0.2, allies: 0, enemies: 2, aggression: 0.3, kind: 'gang' }, yes), true);
	assert.equal(shouldSurrender({ hpFrac: 0.8, allies: 0, enemies: 2, kind: 'gang' }, yes), false, 'not while still strong');
	assert.equal(shouldSurrender({ hpFrac: 0.1, allies: 0, enemies: 3, kind: 'machines' }, yes), false);
	assert.equal(shouldSurrender({ hpFrac: 0.1, allies: 0, enemies: 3, kind: 'creatures' }, yes), false);
	assert.equal(shouldSurrender({ hpFrac: 0.2, allies: 4, enemies: 1, aggression: 0.9, kind: 'raiders' }, no), false);
	assert.ok(score('kill-surrendered').mercy < -20 && score('spare').mercy > 10, 'and what you do then is scored');
});

test('faction relations: old feuds, attacks sour, common enemies warm, time eases it back', () => {
	const R = createRelations();
	for (const id of Object.keys(FACTIONS)) assert.ok(FACTIONS[id].name && FACTIONS[id].colors.length === 2, id);
	assert.equal(R.stance('ashfang', 'dunecutters'), 'hostile', 'raider against raider');
	assert.equal(R.stance('copperline', 'glasshouse'), 'hostile', 'gang against gang');
	assert.equal(R.stance('hearthguard', 'village'), 'allied');
	assert.equal(R.stance(PLAYER, 'hearthguard'), 'allied');
	R.attacked(PLAYER, 'village', 1);
	assert.ok(R.get('village', PLAYER) < 40 - 20);
	assert.ok(R.get('hearthguard', PLAYER) < 30, 'the village\'s friends sour too');
	assert.ok(R.get('ashfang', PLAYER) > -60, 'its enemies warm a little');
	R.helped(PLAYER, 'dunecutters', 3);
	assert.ok(R.get(PLAYER, 'dunecutters') > -50);
	const before = R.get('village', PLAYER);
	R.drift(600);
	assert.ok(R.get('village', PLAYER) > before, 'drifting back');
	const S = createRelations(R.save());
	assert.ok(Math.abs(S.get('village', PLAYER) - R.get('village', PLAYER)) < 0.2, 'saved');
});

test('fire spreads to neighbours within limits and never burns twice', () => {
	const F = createFireField({ maxBurning: 3, maxChain: 2, radius: 14, life: 60, spreadRate: 5 });
	// a street of buildings 10 m apart
	const row = Array.from({ length: 12 }, (_, i) => ({ id: 'b' + i, x: i * 10, z: 0, fuel: 1 }));
	const near = (x, z, r) => row.filter((b) => Math.hypot(b.x - x, b.z - z) < r);
	assert.equal(F.ignite('b5', 50, 0), true);
	let maxBurning = 0;
	const touched = new Set(['b5']);
	for (let t = 0; t < 400; t++) {
		for (const e of F.tick(0.5, near, () => 0)) if (e.type === 'spread') touched.add(e.to);
		maxBurning = Math.max(maxBurning, F.fires.size);
	}
	assert.ok(maxBurning <= 3, 'at most 3 at once');
	assert.ok(touched.size > 1, 'it spread');
	for (const id of touched) { const i = +id.slice(1); assert.ok(Math.abs(i - 5) <= 2, 'no further than 2 hops: ' + id); }
	assert.equal(F.fires.size, 0, 'all burnt out');
	assert.equal(F.ignite('b5', 50, 0), false, 'nothing burns twice');
	const G = createFireField({ maxBurning: 2, life: 10 });
	G.ignite('a', 0, 0); G.douse('a', 100);
	G.tick(0.1);
	assert.ok(!G.burning('a'), 'a crew can put it out');
});

test('PvP is off unless the room turns it on; a side never hurts its own; adults are all fair game', () => {
	const friend = { id: 'p2', kind: 'remote' };
	assert.equal(canHit(friend, { id: 'p1', kind: 'player' }, {}), false);
	assert.equal(canHit(friend, { id: 'p1', kind: 'player' }, { pvp: true }), true);
	assert.equal(canHit({ id: 'r2', kind: 'hostile', faction: 'ashfang' }, { id: 'r1', kind: 'hostile', faction: 'ashfang' }), false);
	assert.equal(canHit({ id: 'c1', kind: 'person', P: { dna: { age: 30 } } }, { id: 'p1', kind: 'player' }), true, 'any adult can be struck');
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
