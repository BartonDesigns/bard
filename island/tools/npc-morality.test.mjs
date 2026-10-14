import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { score, createMorality, createCommons, RULES } from '../src/combat/morality.js';
import { disposition, chooseDeed, temperOf } from '../src/people/disposition.js';
import { bayRegionOf, globeRegionOf, situationOf, BAY_REGIONS } from '../src/people/moral-regions.js';
import { createMoney } from '../src/people/npc-money.js';
import { questOf, createSources, fromRequests, favourQuest, bagQuest, decide, settle, farQuest, playFar } from '../src/people/npc-quests-core.js';
import { step } from '../src/people/errands-core.js';

const memStore = () => { const m = new Map(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };

test('personalities are the same every time, spread from good to bad, and lean with where people live', () => {
	assert.deepEqual(disposition(1234), disposition(1234));
	assert.notDeepEqual(disposition(1234), disposition(1235));
	const all = Array.from({ length: 400 }, (_, i) => disposition(i * 7919 + 3));
	const goods = all.map((d) => d.good);
	assert.ok(Math.min(...goods) < -0.2 && Math.max(...goods) > 0.5, 'some bad, some good');
	assert.ok(goods.reduce((a, b) => a + b, 0) / goods.length > 0, 'most people decent');
	for (const d of all) for (const k of ['mercy', 'law', 'protect', 'honest']) assert.ok(d[k] >= -1 && d[k] <= 1);
	// a region gone bad, a troubled town and an empty pocket all pull the same person down
	const plain = disposition(77), bad = disposition(77, { region: { mercy: -60, law: -60, protect: -60, honest: -60 } });
	assert.ok(bad.good < plain.good && bad.honest < plain.honest);
	const rough = disposition(77, { situation: { trouble: 0.9, means: 0.2 } }), calm = disposition(77, { situation: { trouble: 0.05, means: 0.8 } });
	assert.ok(rough.law < calm.law && rough.greed > calm.greed);
	assert.ok(disposition(77, { wealth: -1 }).greed > disposition(77, { wealth: 1 }).greed, 'the desperate are tempted more');
	assert.ok(disposition(77, { standing: { mercy: 50, law: 50, protect: 50, honest: 50 } }).good > plain.good, 'people become what they do');
	assert.ok(['kind', 'decent', 'ordinary', 'tempted', 'shady', 'crooked'].includes(temperOf(plain)));
	// the honest help, the greedy betray (dice pinned)
	const saint = { mercy: 0.9, law: 0.9, protect: 0.9, honest: 0.9, greed: 0, reliable: 1, pace: 1 };
	const crook = { mercy: -0.8, law: -0.9, protect: -0.8, honest: -0.9, greed: 1, reliable: 0.2, pace: 1 };
	assert.equal(chooseDeed(saint, 0.6, 0.3), 'help');
	assert.equal(chooseDeed(crook, 0.6, 0.3), 'betray');
	assert.equal(chooseDeed(crook, 0, 0.3), 'pass', 'nothing to take: they just walk on');
});

test('regions group neighbouring towns like area codes, and globe towns by nearness', () => {
	const at = (lat, lon) => bayRegionOf(lat, lon).id;
	assert.equal(at(37.7749, -122.4194), 'bay.sf');          // San Francisco
	assert.equal(at(37.563, -122.3255), 'bay.sf');           // San Mateo
	assert.equal(at(37.9735, -122.5311), 'bay.marin');       // San Rafael
	assert.equal(at(37.8044, -122.2708), 'bay.east');        // Oakland
	assert.equal(at(37.8716, -122.2727), 'bay.east');        // Berkeley
	assert.equal(at(37.7799, -121.978), 'bay.diablo');       // San Ramon
	assert.equal(at(37.9063, -122.065), 'bay.diablo');       // Walnut Creek
	assert.equal(at(37.6624, -121.8747), 'bay.diablo');      // Pleasanton
	assert.equal(at(37.3394, -121.895), 'bay.south');        // San Jose
	assert.equal(at(38.4405, -122.7144), 'bay.north');       // Santa Rosa
	assert.equal(at(36.9741, -122.0308), 'bay.santacruz');
	assert.equal(bayRegionOf(37.9063, -122.065).town.name, 'Walnut Creek');
	assert.ok(Object.values(BAY_REGIONS).every((r) => r.name && r.code));
	const cities = [{ name: 'Lyon', lat: 45.76, lon: 4.84, pop: 3 }, { name: 'Villeurbanne', lat: 45.77, lon: 4.88, pop: 2 }, { name: 'Marseille', lat: 43.3, lon: 5.37, pop: 3 }];
	const a = globeRegionOf({ regionId: 'eu.fr', regionName: 'France', lat: 45.77, lon: 4.88, cities }), b = globeRegionOf({ regionId: 'eu.fr', lat: 45.75, lon: 4.83, cities }), c = globeRegionOf({ regionId: 'eu.fr', lat: 43.3, lon: 5.37, cities });
	assert.equal(a.id, b.id); assert.notEqual(a.id, c.id);
	assert.equal(a.name, 'the Lyon area');
	// a town's situation is the same every visit and follows its size and street
	assert.deepEqual(situationOf({ name: 'Oakland', pop: 430, zone: 'downtown' }), situationOf({ name: 'Oakland', pop: 430, zone: 'downtown' }));
	assert.ok(situationOf({ name: 'X', pop: 900, zone: 'downtown' }).trouble > situationOf({ name: 'X', pop: 3, zone: 'quiet' }).trouble);
});

test('people and regions keep their own tallies; the player compass scores as before', () => {
	const C = createCommons({ store: memStore() });
	const e = C.record({ actor: 'npc:5', name: 'Rosa', kind: 'return-bag', target: 'Sam', region: 'bay.east', regionName: 'the East Bay', world: 'earth' });
	assert.equal(e.line, "Handed Sam's bag back");
	const A = C.actor('npc:5');
	assert.equal(A.honest, score('return-bag').honest); assert.equal(A.deeds, 1); assert.equal(A.name, 'Rosa');
	assert.ok(C.region('bay.east').honest > 0 && C.region('bay.east').honest < A.honest, 'the region moves, less');
	assert.equal(C.region('bay.east').name, 'the East Bay');
	C.record({ actor: 'npc:6', kind: 'steal-bag', target: 'Sam', region: 'bay.east', world: 'earth' });
	assert.ok(C.actor('npc:6').honest < 0 && C.actor('npc:6').law < 0);
	assert.equal(C.log(5).length, 2);
	assert.ok(C.world('earth').deeds === 2);
	// the player's deeds go on the compass exactly as before, and count in the region too
	const M = createMorality({ store: memStore() });
	C.follow(M, () => ({ id: 'bay.sf', name: 'the City' }));
	const before = C.region('bay.sf').protect;
	M.record({ kind: 'favour', target: 'Ana' });
	assert.deepEqual({ mercy: M.me().mercy, law: M.me().law, protect: M.me().protect, honest: M.me().honest }, { mercy: RULES.favour.mercy, law: RULES.favour.law, protect: RULES.favour.protect, honest: RULES.favour.honest });
	assert.ok(C.region('bay.sf').protect > before);
	// kept across a reload
	const st = memStore(), C2 = createCommons({ store: st });
	C2.record({ actor: 'npc:9', kind: 'return-bag', region: 'r' }); C2.save();
	assert.equal(createCommons({ store: st }).actor('npc:9').deeds, 1);
});

test('taking a bag off a thief is neutral; only giving it back to its owner is a boost', () => {
	const take = score('take-from-thief'), back = score('return-stolen'), keep = score('keep-stolen');
	assert.deepEqual(take, { mercy: 0, law: 0, protect: 0, honest: 0 });
	assert.ok(back.protect > 0 && back.honest > 0);
	assert.ok(keep.honest < 0);
	const M = createMorality({ store: memStore() });
	M.record({ kind: 'take-from-thief', target: 'Sam' });
	assert.deepEqual(M.me(), { mercy: 0, law: 0, protect: 0, honest: 0, deeds: 1 }, 'the deed is logged, nothing moves');
	assert.match(M.log(1)[0].line, /off the thief/);
	// the snatch steps: catch the thief, pick it up, then give it back or walk off with it
	let E = { kind: 'snatch', stage: 'thief', item: { name: 'bag' } };
	E = step(E, 'catch-thief').E; assert.equal(E.stage, 'search');
	E = step(E, 'pickup').E; assert.equal(E.stage, 'bring');
	assert.equal(step(E, 'reach').out.say, 'recovered');
	const k = step(E, 'away'); assert.equal(k.E.stage, 'kept'); assert.equal(k.out.kept, true);
	// and letting them go: nothing for you
	assert.equal(step({ kind: 'snatch', stage: 'thief' }, 'escaped').out.failed, true);
});

test('money goes through the bank adapter: a stand-in until the bank is attached', () => {
	const M = createMoney();
	const b0 = M.balance('npc:1');
	assert.ok(b0 >= 40 && b0 < 300);
	M.earn('npc:1', 500, 'reward', 'npc:2');
	assert.equal(M.balance('npc:1'), b0 + 500);
	M.spend('npc:1', 1e6, 'rent');
	assert.equal(M.balance('npc:1'), 0, 'never below nothing');
	assert.equal(M.wealth('npc:1'), -1, 'broke');
	M.earn('npc:3', 5000, 'bonus');
	assert.ok(M.wealth('npc:3') > 0.9);
	assert.equal(M.talk('npc:3'), null);
	// attached: every call goes to the bank, with its kind and counterparty
	const calls = [], bank = { earn: (...a) => calls.push(['earn', ...a]), spend: (...a) => calls.push(['spend', ...a]), transfer: (...a) => calls.push(['transfer', ...a]), balance: () => 20, moneyTalk: (id) => [`${id} is behind on rent.`] };
	M.use(bank);
	M.earn('npc:5', 30, 'reward', 'npc:6'); M.transfer('npc:6', 'npc:5', 10, 'reward');
	assert.deepEqual(calls, [['earn', 'npc:5', 30, 'reward', 'npc:6'], ['transfer', 'npc:6', 'npc:5', 10, 'reward']]);
	assert.equal(M.balance('npc:5'), 20); assert.ok(M.wealth('npc:5') < 0, 'a thin household reads as hard up');
	assert.deepEqual(M.talk('npc:5'), ['npc:5 is behind on rent.']);
	// the hard-up are tempted more
	assert.ok(disposition(77, { wealth: M.wealth('npc:5') }).greed > disposition(77, { wealth: 1 }).greed);
});

test('one descriptor for every quest: favours, bags and a business source; decided and settled', () => {
	const q = questOf({ kind: 'delivery', title: 'Take the order to 5th', giver: { type: 'business', id: 'cafe:1', name: 'the cafe', x: 0, z: 0 }, steps: [{ do: 'pickup', at: { x: 0, z: 0 } }, { do: 'deliver', at: { x: 40, z: 0, name: '5th' } }, { do: 'fly' }], reward: { credits: 30 }, deeds: { done: 'favour', betray: 'betray-errand' }, tempt: 0.4 });
	assert.equal(q.steps.length, 2, 'unknown steps are dropped');
	assert.equal(q.reward.from, 'cafe:1');
	for (const kind of ['lost', 'catch', 'pass', 'repair', 'pet', 'snatch']) {
		const f = favourQuest(kind, { giver: { id: 'npc:1', name: 'Ana', x: 0, z: 0 }, friend: { id: 'npc:2', name: 'Sam', x: 10, z: 0 }, drop: { x: 5, z: 5 }, car: { x: 3, z: 3 }, region: 'bay.sf' });
		assert.ok(f.steps.length >= 2 && f.title && RULES[f.deeds.done], kind);
		assert.doesNotMatch(f.title, /\u2014/);
	}
	const bagQ = bagQuest({ owner: { id: 'npc:1', name: 'Ana' }, at: { x: 1, z: 1 }, where: 'bench', region: 'bay.sf' });
	assert.equal(bagQ.deeds.done, 'return-bag'); assert.equal(bagQ.deeds.betray, 'steal-bag');
	// a source from the economy's three functions
	const log = [];
	const S = createSources();
	S.add(fromRequests({ requestsNear: () => [{ id: 'r1', kind: 'delivery', steps: [{ do: 'go', at: { x: 1, z: 1 } }] }], takeRequest: (id, who) => (log.push(['take', id, who]), true), completeRequest: (id, who, o) => log.push(['done', id, who, o]) }));
	const [r] = S.near(0, 0, 100);
	assert.equal(r.source, 'economy');
	assert.equal(S.take(r, 'npc:4'), true); S.complete(r, 'npc:4', 'done');
	assert.deepEqual(log, [['take', 'r1', 'npc:4'], ['done', 'r1', 'npc:4', 'done']]);
	// decided by disposition; settled into the wallet and the compass
	const saint = { mercy: 0.9, law: 0.9, protect: 0.9, honest: 0.9, greed: 0, reliable: 1, pace: 1 };
	const crook = { mercy: -0.8, law: -0.9, protect: -0.8, honest: -0.9, greed: 1, reliable: 0.2, pace: 1 };
	assert.deepEqual(decide(saint, bagQ, [0.2, 0.2]), { take: true, outcome: 'done' });
	assert.deepEqual(decide(crook, bagQ, [0.2, 0.2]), { take: true, outcome: 'betray' });
	const C = createCommons({ store: memStore() }), W = createMoney();
	const ownerBefore = W.balance('npc:1'), helperBefore = W.balance('npc:7');
	const done = settle(bagQ, 'done', { actorId: 'npc:7', name: 'Lee', money: W, commons: C });
	assert.equal(W.balance('npc:7'), helperBefore + bagQ.reward.credits, 'the returner is paid');
	assert.equal(W.balance('npc:1'), ownerBefore - bagQ.reward.credits, 'by the owner');
	assert.equal(done.deed.kind, 'return-bag'); assert.ok(C.actor('npc:7').honest > 0); assert.ok(C.region('bay.sf').deeds === 1);
	const thiefBefore = W.balance('npc:8');
	const bad = settle(bagQ, 'betray', { actorId: 'npc:8', money: W, commons: C });
	assert.ok(W.balance('npc:8') > thiefBefore, 'the thief has what was in it');
	assert.equal(bad.deed.kind, 'steal-bag'); assert.ok(C.actor('npc:8').honest < 0);
	assert.equal(bad.followUp.kind, 'recover'); assert.equal(bad.followUp.thief, 'npc:8');
	// far away: a whole quest in one tick, among the region's residents
	let seen = new Set();
	for (let i = 0; i < 80; i++) { const fq = farQuest('bay.east', i, (i % 10) / 10); const out = playFar(fq, { dispoOf: (seed) => disposition(seed), money: W, commons: C }); seen.add(out.outcome); }
	assert.ok(seen.has('done') && seen.has('betray'), [...seen].join());
	assert.ok(C.region('bay.east').deeds > 10);
});

// ---- the runtime on stand-in bodies ----
function stage() {
	globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) };
	globalThis.localStorage ??= { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
	globalThis.performance ??= { now: () => Date.now() };
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
	camera.position.set(0, 1.7, 0);
	const P = { pos: new THREE.Vector3(0, 1.7, 0), flying: false };
	const body = (x, z, seed, extra = {}) => ({ active: true, role: 'walk', route: { kind: 'street' }, P: { dna: { seed, gait: { pace: 1.3 } }, root: { visible: true } }, M: { S: { pos: new THREE.Vector3(x, 0, z), heading: 0, remark: null, look: {}, feel: {}, speed: { v: 1 } }, want: {}, setPose() {}, place(x2, y2, z2) { this.S.pos.set(x2, y2, z2); } }, ...extra });
	const said = [];
	const world = () => ({ player: { state: P, floorAt: (x, z, h) => h }, island: { heightAt: () => 2, half: 10 }, body: { key: 'earth' } });
	// people walk where their override tells them (as people.js does each frame)
	const walk = (pool, dt) => { for (const p of pool) { if (!p.override) continue; p.override(p, dt, camera.position); const S = p.M.S, v = p.M.want.speed || 0, h = p.M.want.heading || 0; S.heading = h; S.pos.x += Math.sin(h) * v * dt; S.pos.z += Math.cos(h) * v * dt; } };
	return { scene, camera, P, body, said, world, walk };
}

test('a bag left on the sidewalk is handed back, or stolen and yours to answer', async () => {
	const { createNpcQuests } = await import('../src/people/npc-quests.js');
	const { createErrands } = await import('../src/people/errands.js');
	const T = stage();
	const owner = T.body(14, -14, 11), helper = T.body(20, -20, 12), kid = T.body(13, -13, 13, { P: { dna: { seed: 13, child: true }, root: { visible: true } } });
	const pool = [owner, helper, kid];
	const deeds = [], hints = [];
	const errands = createErrands({ scene: T.scene, camera: T.camera, world: T.world, people: { pool, sidewalk: () => null }, chatter: { say: (p, l) => T.said.push([p, l.text]) }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), arms: () => ({ apply: () => ({ ok: true }) }), morality: () => ({ record: (d) => deeds.push(d.kind) }), hint: (t) => hints.push(t), driving: () => false, isPhone: false });
	const commons = createCommons({ store: memStore() }), money = createMoney();
	const Q = createNpcQuests({ scene: T.scene, camera: T.camera, world: T.world, people: { pool }, chatter: { say: (p, l) => T.said.push([p, l.text]) }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), errands: () => errands, commons, money, worldKey: () => 'earth' });
	const before = money.balance('npc:11') + money.balance('npc:12');
	Q.update(0.1);
	// returned: the helper picks it up and walks it to the owner, who walks on
	const orig = Math.random; Math.random = () => 0.01;
	assert.match(Q.bag('return'), /bag/); Math.random = orig;
	assert.notEqual(Q.info().bag.owner, 'N13', 'a child never leaves one here');
	const giver = Q.info().bag.owner === 'N11' ? owner : helper, taker = giver === owner ? helper : owner;
	assert.ok(taker.held && taker.override, 'the one who picked it up is walking it over');
	assert.ok(!kid.held, 'children are left out of it');
	for (let k = 0; k < 400 && Q.info().scenes.length; k++) { T.walk(pool, 0.1); Q.update(0.1); }
	assert.equal(Q.info().scenes.length, 0);
	assert.equal(commons.actor('npc:' + taker.P.dna.seed).deeds, 1);
	assert.ok(commons.actor('npc:' + taker.P.dna.seed).honest > 0);
	assert.ok(money.balance('npc:' + taker.P.dna.seed) > 0 && money.balance('npc:11') + money.balance('npc:12') <= before, 'paid for it, by the owner');
	assert.equal(Q.memoryOf(giver.P.dna.seed), 'got-back');
	assert.ok(!taker.held && !taker.override && !giver.held, 'everyone let go');
	assert.ok(T.said.some(([p, t]) => p === giver && /bag|Thank/.test(t)));
	// stolen, near you: the thief walks off, errands takes it from there
	Math.random = () => 0.01;
	Q.bag('steal'); Math.random = orig;
	for (let k = 0; k < 30 && !errands.busy(); k++) { T.walk(pool, 0.1); Q.update(0.1); errands.update(0.1); }
	assert.ok(errands.busy(), 'the theft is yours to answer');
	assert.equal(errands.info().errand.stage, 'thief');
	const thief = pool.find((p) => commons.known('npc:' + p.P.dna.seed) && commons.actor('npc:' + p.P.dna.seed).honest < 0);
	assert.ok(thief && !thief.P.dna.child, 'a grown-up stole it, and it is on their compass');
	assert.ok(hints.some((h) => /Catch them and take it, or let them go/.test(h)));
	// catch them: neutral; bring it back: the boost
	T.P.pos.set(thief.M.S.pos.x, 1.7, thief.M.S.pos.z + 1); errands.update(0.1);
	assert.equal(deeds.at(-1), 'take-from-thief');
	const d = errands.info().errand.drop; T.P.pos.set(d[0], d[1] + 1.7, d[2]); errands.update(0.1);
	assert.equal(errands.info().errand.stage, 'bring');
	const back = errands.mark(); T.P.pos.set(back.x, 1.7, back.z); errands.update(0.1);
	assert.equal(errands.info().errand, null);
	assert.deepEqual(deeds, ['take-from-thief', 'return-stolen']);
	for (let k = 0; k < 40; k++) { T.walk(pool, 0.1); Q.update(0.1); errands.update(0.1); }
	assert.equal(Q.info().bag, null);
	Q.dispose();
});

test('far away the tallies move on their own; a turned-down favour goes to someone else', async () => {
	const { createNpcQuests } = await import('../src/people/npc-quests.js');
	const T = stage(), giver = T.body(4, -4, 21), other = T.body(9, -9, 22), friend = T.body(30, -20, 23);
	const pool = [giver, other, friend];
	const commons = createCommons({ store: memStore() }), money = createMoney();
	const Q = createNpcQuests({ scene: T.scene, camera: T.camera, world: T.world, people: { pool }, chatter: { say: () => {} }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), commons, money, worldKey: () => 'earth' });
	Q.update(0.1);
	const region = Q.regionNow().id;
	Q.farTick(40);
	assert.ok(commons.region(region).deeds > 15, 'deeds done while you were not looking');
	assert.ok(commons.log(50).length > 15);
	// a source of the economy's, registered from outside, is worked far from you
	const done = [];
	Q.addSource({ id: 'economy', near: () => [{ id: 'job1', kind: 'delivery', title: 'Deliver lunch', giver: { type: 'business', id: 'cafe:9', name: 'the cafe', x: 900, z: 900 }, steps: [{ do: 'pickup', at: { x: 900, z: 900 } }, { do: 'deliver', at: { x: 950, z: 900 } }], reward: { credits: 40 }, deeds: { done: 'favour', betray: 'betray-errand' }, tempt: 0.3 }], take: () => true, complete: (id, who, o) => done.push([id, o]) });
	const orig = Math.random; Math.random = () => 0.2;
	Q.farTick(3); Math.random = orig;
	assert.ok(done.length >= 1 && ['done', 'betray', 'abandon'].includes(done[0][1]), JSON.stringify(done));
	// turned down: offered to the people about
	Q.handoff({ kind: 'pass', giver, friendP: friend, item: { name: 'parcel' } });
	for (let k = 0; k < 30; k++) Q.update(0.1);
	assert.ok(Q.info().open.length === 1 || Q.info().scenes.length === 1);
	Q.dispose();
	assert.ok(!giver.held && !giver.override);
	// someone knocked down is told to a hospital's listener, once
	const hurt = [];
	Q.onHurt((e) => hurt.push(e));
	other.P.ragdoll = {};
	for (let k = 0; k < 25; k++) Q.update(0.1);
	assert.equal(hurt.length, 1); assert.equal(hurt[0].npcId, 'npc:22');
});
