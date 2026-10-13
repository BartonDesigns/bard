import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { offerFor, lineFor, rewardFor, step, milestone, relativeDir } from '../src/people/errands-core.js';
import { score } from '../src/combat/morality.js';

test('offers need a friend for catch and pass, and point by direction only', () => {
	assert.equal(offerFor({ who: { first: 'Ana' }, kinds: ['catch'] }), null);
	const o = offerFor({ who: { first: 'Ana', seed: 3 }, kinds: ['catch'], friend: { first: 'Sam' }, dir: 'off to your left' });
	assert.equal(o.kind, 'catch'); assert.match(o.ask, /Sam/); assert.match(o.ask, /off to your left/);
	const seen = new Set();
	for (let n = 0; n < 60; n++) { const x = offerFor({ who: { first: 'Ana', seed: 1 }, n, friend: { first: 'Sam' } }); seen.add(x.kind); assert.doesNotMatch(x.ask, /—/); assert.doesNotMatch(x.ask, /\b(?:wearing|in the (?:red|blue|green|black) |tall|hair|skin)\b/i); }
	assert.deepEqual([...seen].sort(), ['catch', 'lost', 'pass']);
	assert.equal(relativeDir(0, -10, 0, -1), 'up ahead of you');
	assert.equal(relativeDir(0, 10, 0, -1), 'behind you');
	assert.equal(relativeDir(10, 0, 0, -1), 'off to your right');
	assert.equal(relativeDir(-10, 0, 0, -1), 'off to your left');
});

test('a lost item is searched, found, brought back; a wallet can be kept instead', () => {
	let E = { ...offerFor({ who: { first: 'Ana' }, kinds: ['lost'] }), stage: 'offered' };
	let r = step(E, 'pickup'); assert.equal(r.out, null);            // nothing found before saying yes
	r = step(E, 'accept'); E = r.E; assert.equal(E.stage, 'search'); assert.equal(r.out.say, 'accept');
	r = step(E, 'reach'); assert.equal(r.out, null);                 // reaching her empty-handed does nothing
	r = step(E, 'pickup'); E = r.E; assert.equal(E.stage, 'bring');
	assert.equal(step(E, 'reach').out.done, true);
	const W = { kind: 'lost', item: { id: 'wallet', cash: 60 }, stage: 'bring' };
	const k = step(W, 'away'); assert.equal(k.E.stage, 'kept'); assert.equal(k.out.cash, 60);
	const K = { kind: 'lost', item: { id: 'keys' }, stage: 'bring' };
	assert.equal(step(K, 'away').E.stage, 'failed');
	assert.equal(step(k.E, 'reach').out, null);                       // over is over
});

test('catch and pass end on reaching the friend; declining and timing out end quietly', () => {
	for (const kind of ['catch', 'pass']) {
		let E = { kind, stage: 'offered' };
		E = step(E, 'accept').E; assert.equal(E.stage, kind === 'catch' ? 'chase' : 'carry');
		const r = step(E, 'reach'); assert.equal(r.out.done, true); assert.equal(r.out.say, kind === 'catch' ? 'caught' : 'passed');
	}
	assert.equal(step({ kind: 'lost', stage: 'offered' }, 'decline').out.declined, true);
	assert.equal(step({ kind: 'lost', stage: 'search' }, 'timeout').out.say, 'gaveUp');
});

test('rewards are modest and grow with the distance; deeds are on the compass', () => {
	assert.ok(rewardFor('lost', 0) >= 40 && rewardFor('lost', 0) <= 50);
	assert.ok(rewardFor('catch', 80) > rewardFor('catch', 10));
	assert.ok(rewardFor('pass', 1e6) <= 140);
	const f = score('favour'), k = score('kept-wallet');
	assert.ok(f.honest > 0 && f.protect > 0);
	assert.ok(k.honest < 0 && k.law < 0);
	assert.ok(milestone(1) && milestone(5) && !milestone(6));
	for (const ev of ['accept', 'returned', 'caught', 'passed', 'gaveUp']) assert.ok(lineFor(ev, { kind: 'lost', item: { the: 'the keys', name: 'keys', id: 'keys' }, friend: 'Sam' }).length > 3);
});

// ---- the runtime on stand-in bodies ----
function stage() {
	globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) };
	globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
	globalThis.performance ??= { now: () => Date.now() };
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
	camera.position.set(0, 1.7, 0); camera.lookAt(0, 1.7, -1); camera.updateMatrixWorld();
	const P = { pos: new THREE.Vector3(0, 1.7, 0), flying: false };
	const body = (x, z, extra = {}) => ({ active: true, role: 'walk', route: { kind: 'street' }, P: { dna: { seed: Math.round(x * 3 + z) }, root: { visible: true } }, M: { S: { pos: new THREE.Vector3(x, 0, z), remark: null, look: {}, feel: {}, speed: { v: 1 } }, want: {}, gesture() {}, setPose() {}, place(x2, y2, z2) { this.S.pos.set(x2, y2, z2); } }, ...extra });
	const said = [], hints = [], paid = [], deeds = [];
	const world = () => ({ player: { state: P, floorAt: (x, z, h) => h }, island: { heightAt: () => 2 }, body: { key: 'earth' } });
	return { scene, camera, P, body, said, hints, paid, deeds, world, mk: (pool, o = {}) => ({ scene, camera, world, people: { pool, sidewalk: () => null }, chatter: { say: (p, l) => said.push([p, l.text]) }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), arms: () => ({ apply: (tx) => (paid.push(tx), { ok: true }) }), morality: () => ({ record: (d) => deeds.push(d.kind) }), hint: (t) => hints.push(t), driving: () => false, isPhone: false, ...o }) };
}
const run = (R, dt, k) => { for (let i = 0; i < k; i++) R.update(dt); };

test('a lost-item favour from asking to reward, people held and let go', async () => {
	const { createErrands } = await import('../src/people/errands.js');
	const T = stage(), giver = T.body(2, -2);
	const R = createErrands(T.mk([giver]));
	run(R, 1, 41);                                                    // the first ask waits a little after arrival
	const orig = Math.random; Math.random = () => 0.01;
	const ask = R.maybeAsk(giver); Math.random = orig;
	assert.ok(ask?.text?.length > 10);
	assert.ok(giver.held && giver.override, 'the person asking waits');
	assert.ok(R.asking(giver));
	R.accept(); R.update(0.1);
	assert.equal(R.info().errand.stage, 'search');
	const m = R.mark(); assert.equal(m.radius, 9);
	// walk to where it fell
	const drop = T.scene.children.find((o) => o.isGroup).position;
	T.P.pos.set(drop.x, drop.y + 1.7, drop.z); R.update(0.1);
	assert.equal(R.info().errand.stage, 'bring');
	T.P.pos.set(2, 1.7, -1); R.update(0.1);
	assert.equal(R.info().errand, null);
	assert.equal(T.paid.length, 1); assert.ok(T.paid[0].get.credits >= 45);
	assert.deepEqual(T.deeds, ['favour']);
	assert.ok(T.hints.some((h) => /credits/.test(h)));
	run(R, 1, 8);
	assert.ok(!giver.held && !giver.override, 'let go afterwards');
	assert.equal(R.info().done, 1);
});

test('a catch favour follows the friend; walking off ends it; fear and children never ask', async () => {
	const { createErrands } = await import('../src/people/errands.js');
	const T = stage(), giver = T.body(1, -2), friend = T.body(30, -30);
	const R = createErrands(T.mk([giver, friend]));
	run(R, 1, 41);
	const orig = Math.random; Math.random = () => 0.01;
	assert.equal(R.maybeAsk(T.body(0, -3, { P: { dna: { child: true, seed: 9 }, root: { visible: true } } })), null);
	assert.equal(R.maybeAsk(giver, { afraid: true }), null);
	let kinds = new Set();
	for (let k = 0; k < 6 && !kinds.has('catch'); k++) { R.cancel(); run(R, 1, 61); const a = R.maybeAsk(giver); if (a) kinds.add(R.info().errand?.kind); }
	Math.random = orig;
	assert.ok(kinds.has('catch'));
	assert.ok(friend.held, 'the friend is kept in the world');
	R.accept(); R.update(0.1);
	assert.equal(R.mark().title.includes('Catch'), true);
	T.P.pos.set(30, 1.7, -29); R.update(0.1);
	assert.equal(R.info().errand, null);
	assert.ok(T.said.some(([p]) => p === friend), 'the friend says thanks');
	// another, then walking far away: it lapses, nothing paid
	const paid = T.paid.length;
	run(R, 1, 61); Math.random = () => 0.01; R.maybeAsk(giver); Math.random = orig; R.accept(); R.update(0.1);
	T.P.pos.set(800, 1.7, 0); R.update(0.1);
	assert.equal(R.info().errand, null); assert.equal(T.paid.length, paid);
});

test('a bag snatched: chase the thief, they drop it, give it back; or they get away', async () => {
	const { createErrands } = await import('../src/people/errands.js');
	const T = stage(), victim = T.body(5, -12), thief = T.body(8, -15);
	const R = createErrands(T.mk([victim, thief]));
	const got = R.snatch(); assert.equal(got, "Get N3's bag back", got);
	assert.ok(victim.held && thief.held);
	assert.ok(victim.awarenessEvents?.length === 1 && !thief.awarenessEvents?.length, 'the people who saw it remember it, not the thief');
	assert.match(R.mark().title, /thief/);
	// the thief runs: their override steers them away
	thief.override(thief, 0.1, T.camera.position); assert.ok(thief.M.want.speed > 5 && thief.M.want.run === 1);
	T.P.pos.set(thief.M.S.pos.x, 1.7, thief.M.S.pos.z + 1); R.update(0.1);
	assert.equal(R.info().errand.stage, 'search');
	assert.ok(T.deeds.includes('stop-thief'));
	assert.match(R.mark().title, /Pick up/);
	const d = R.info().errand.drop; T.P.pos.set(d[0], d[1] + 1.7, d[2]); R.update(0.1);
	assert.equal(R.info().errand.stage, 'bring');
	T.P.pos.set(5, 1.7, -11); R.update(0.1);
	assert.equal(R.info().errand, null);
	assert.ok(T.paid.at(-1).get.credits >= 80);
	// another, and the thief gets away
	const R2 = createErrands(T.mk([T.body(5, -12), T.body(8, -15)]));
	T.P.pos.set(0, 1.7, 0); assert.match(R2.snatch(), /bag back/); for (let k = 0; k < 520; k++) R2.update(0.1);
	assert.equal(R2.info().errand, null); assert.match(R2.info().last, /escaped/);
});

test('asked in a conversation, someone can offer a favour and waits longer for an answer', async () => {
	const { createErrands } = await import('../src/people/errands.js');
	const T = stage(), giver = T.body(1, -1.5, { engaged: true });
	const R = createErrands(T.mk([giver]));
	const o = R.offerTo(giver);
	assert.ok(o?.text && o.title);
	assert.ok(R.asking(giver));
	for (let k = 0; k < 40; k++) R.update(0.5);                     // twenty seconds of talking it over
	assert.ok(R.asking(giver), 'still on offer');
	R.accept(); R.update(0.1);
	assert.notEqual(R.info().errand.stage, 'offered');
});

test('a car that will not start: fixed with a repair roll used beside it', async () => {
	const { createErrands } = await import('../src/people/errands.js');
	const { createItemUse } = await import('../src/gameplay/item-use.js');
	const T = stage(), giver = T.body(2, -2);
	let hand = null;
	const inv = { instances: { r1: { u: 'r1', i: 'repair-roll', l: 1, t: 0, x: 0 } } };
	const arms = { state: () => inv, held: () => (hand ? inv.instances[hand] : null), hold: (u) => { hand = u; }, apply: (tx) => { if (tx.kind === 'use') delete inv.instances[tx.uid]; else T.paid.push(tx); return { ok: true }; }, catalog: () => [{ id: 'repair-roll', activities: ['home-defense'] }], train() {} };
	const o = T.mk([giver]);
	const W0 = o.world(); o.world = () => ({ ...W0, street: { parkedNear: () => [{ id: 'p7', kind: 'sedan', x: 12, y: 0, z: -4, yaw: 0 }] } });
	o.arms = () => arms;
	const R = createErrands(o);
	let kinds = new Set();
	for (let k = 0; k < 12 && !kinds.has('repair'); k++) { R.cancel(); run(R, 1, 61); R.offerTo(giver); kinds.add(R.info().errand?.kind); }
	assert.ok(kinds.has('repair'));
	R.accept(); R.update(0.1);
	assert.equal(R.mark().detail, 'use a Repair Roll beside it');
	T.P.pos.set(12, 1.7, -2); R.update(0.1);
	assert.equal(hand, 'r1', 'the roll comes to hand beside the car');
	const U = createItemUse({ arms, combat: () => ({ woundedNear: () => [], hurt0: () => 0 }), people: {}, persona: () => ({ first: 'N' }), camera: { position: T.P.pos }, hint() {}, chatter: null, morality: () => null, errands: () => R });
	assert.ok(U.use());
	assert.equal(R.info().errand, null);
	assert.ok(T.paid.at(-1).get.credits >= 70);
	assert.equal(inv.instances.r1, undefined, 'the roll is spent');
});
