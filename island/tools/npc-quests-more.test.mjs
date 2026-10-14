import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCommons } from '../src/combat/morality.js';
import { createMoney } from '../src/people/npc-money.js';
import { pickSpot, restOn, spotWords, createPlaces, commercialEstablishments, SPOT_KINDS } from '../src/people/bag-spots.js';
import { bagQuest, farQuest } from '../src/people/npc-quests-core.js';

const memStore = () => { const m = new Map(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };
const minor = (p) => !!(p?.P?.dna?.child || p?.P?.dna?.teen || p?.P?.dna?.minor);

// ---- stand-in bodies and a stand-in world ----
function stage({ furniture = {} } = {}) {
	globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) };
	globalThis.localStorage ??= { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
	globalThis.performance ??= { now: () => Date.now() };
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
	camera.position.set(0, 1.7, 0);
	const P = { pos: new THREE.Vector3(0, 1.7, 0), flying: false };
	const body = (x, z, seed, extra = {}, dna = {}) => ({ active: true, role: 'walk', route: { kind: 'street' }, P: { dna: { seed, gait: { pace: 1.3 }, ...dna }, root: { visible: true } }, M: { S: { pos: new THREE.Vector3(x, 0, z), heading: 0, remark: null, look: {}, feel: {}, speed: { v: 1 } }, want: {}, setPose() {}, sit() {}, stand() {}, gesture() {}, place(x2, y2, z2) { this.S.pos.set(x2, y2, z2); } }, ...extra });
	const said = [];
	const world = () => ({ player: { state: P, floorAt: (x, z, h) => h }, island: { heightAt: () => 2, half: 10 }, body: { key: 'earth' }, sky: { state: { hours: 9 } }, ...furniture });
	const walk = (pool, dt) => { for (const p of pool) { if (!p.override) continue; p.override(p, dt, camera.position); const S = p.M.S, v = p.M.want.speed || 0, h = p.M.want.heading || 0; S.heading = h; S.pos.x += Math.sin(h) * v * dt; S.pos.z += Math.cos(h) * v * dt; } };
	return { scene, camera, P, body, said, world, walk };
}
async function quests(T, pool, extra = {}) {
	const { createNpcQuests } = await import('../src/people/npc-quests.js');
	const commons = createCommons({ store: memStore() }), money = createMoney();
	const Q = createNpcQuests({ scene: T.scene, camera: T.camera, world: T.world, people: { pool }, chatter: { say: (p, l) => T.said.push([p, l.text]) }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), commons, money, worldKey: () => 'earth', ...extra });
	return { Q, commons, money };
}

test('bags are left in believable places: benches, shelters, cafe tables, doorsteps, parks', () => {
	const spots = [{ kind: 'bench', x: 20, z: 0, y: 1, heading: 0 }, { kind: 'shelter', x: 0, z: 25, y: 1, heading: Math.PI / 2 }, { kind: 'doorstep', x: -30, z: 0, y: 1, heading: 0, venue: 'restaurant' }, { kind: 'park', x: 0, z: -40, y: 1, heading: 0, place: 'Central Park' }, { kind: 'bench', x: 500, z: 0, y: 1 }];
	const kinds = new Set();
	for (let i = 0; i < 100; i++) { const s = pickSpot(spots, { x: 0, z: 0, roll: i / 100 }); assert.ok(s && s.x < 100, 'only those within reach'); kinds.add(s.kind); }
	assert.deepEqual([...kinds].sort(), ['bench', 'doorstep', 'park', 'shelter']);
	assert.equal(pickSpot(spots, { x: 1000, z: 1000 }), null, 'nothing about: the sidewalk it is');
	// on the seat of a bench, at the back of a shelter, on a table's chair, beside a door
	const b = restOn({ kind: 'bench', x: 10, y: 1, z: 10, heading: 0 });
	assert.ok(Math.abs(b.y - 1.48) < 1e-6 && Math.abs(b.z - 10) < 0.1 && Math.abs(Math.abs(b.x - 10) - 0.5) < 1e-6);
	assert.equal(restOn({ kind: 'shelter', x: 0, y: 1, z: 0, heading: 0 }).y, 1);
	assert.ok(Math.abs(restOn({ kind: 'table', x: 0, y: 2, z: 0, h: 0.46 }).y - 2.46) < 1e-6);
	assert.ok(Math.abs(restOn({ kind: 'picnic', x: 0, y: 0, z: 0 }).y - 0.76) < 1e-6);
	// the words, for a title and for what people say later
	assert.equal(spotWords({ kind: 'park', place: 'Central Park' }).left, 'on a bench in Central Park');
	assert.equal(spotWords({ kind: 'table', venue: 'restaurant' }).off, 'off a restaurant table');
	assert.match(bagQuest({ owner: { name: 'Ana' }, at: { x: 0, z: 0 }, where: { kind: 'shelter' } }).title, /Ana's bag, left at the bus shelter/);
	for (const k of SPOT_KINDS) for (const w of Object.values(spotWords({ kind: k }))) assert.doesNotMatch(w, /—/);
	// a table inside: walked to through the door and back out, then handed over
	const q = bagQuest({ owner: { id: 'npc:1', name: 'Ana' }, at: { x: 5, z: 5 }, where: { kind: 'table', venue: 'cafe' }, via: [{ x: 0, z: 0 }, { x: 1, z: 1 }] });
	assert.deepEqual(q.steps.map((s) => s.do), ['go', 'go', 'pickup', 'go', 'go', 'deliver']);
	// the far tick names places of every kind
	const named = new Set(); for (let i = 0; i < 400; i++) { const f = farQuest('bay.sf', i, 0.1); if (f.kind === 'bag') named.add(f.spot.kind); }
	assert.ok(named.size >= 5, [...named].join());
});

test('the places come from the street, the parks and an establishment provider that can be swapped', () => {
	const furniture = {
		street: { seatsNear: () => [{ kind: 'bench', x: 20, y: 0, z: 0, heading: 0 }, { kind: 'shelter', x: 0, y: 0, z: 22, heading: 0 }] },
		parks: { seatsNear: () => [{ kind: 'park', x: -25, y: 0, z: 0, heading: 0, place: 'Mission Park' }, { kind: 'picnic', x: -28, y: 0, z: 4, heading: 0, place: 'Mission Park' }] },
		commercial: { doorsNear: () => [{ x: 0, z: -30, y: 0, heading: 0, use: 'cafe', inside: { x: 0, z: -31.6 }, outside: { x: 0, z: -28.4, y: 0 }, B: { spots: [{ x: 1, z: -34, y: 0, h: 0.46, table: true, heading: 0 }, { x: 2, z: -35, y: 0, h: 0, table: false }] } }, { x: 9, z: -30, use: 'office', inside: {}, outside: {} }] },
	};
	const world = () => furniture, P = createPlaces({ world });
	const kinds = P.near(0, 0, 60).map((s) => s.kind).sort();
	assert.deepEqual(kinds, ['bench', 'doorstep', 'park', 'picnic', 'shelter', 'table']);
	const table = P.near(0, 0, 60).find((s) => s.kind === 'table');
	assert.equal(table.venue, 'cafe'); assert.ok(table.door.inside && table.door.outside, 'reached through its door');
	assert.equal(commercialEstablishments(furniture.commercial)(0, 0, 60).length, 1, 'offices are not cafes');
	// the economy's registry plugged in: its restaurants are where bags are left now
	P.use(() => [{ id: 'est:7', kind: 'restaurant', name: 'Lucky Noodle', door: { x: 10, y: 0, z: 10, heading: 1 }, tables: [] }]);
	const door = P.near(0, 0, 60).find((s) => s.kind === 'doorstep');
	assert.equal(door.venue, 'restaurant'); assert.equal(door.id, 'est:7');
});

test('the owner walks to a bench, sets the bag down on it and walks on; a passer-by deals with it', async () => {
	const furniture = { street: { seatsNear: () => [{ kind: 'bench', x: 18, y: 0, z: 0, heading: Math.PI }] } };
	const T = stage({ furniture });
	const owner = T.body(24, 6, 31), other = T.body(40, 30, 32), kid = T.body(19, 1, 33, {}, { child: true }), teen = T.body(17, -1, 34, {}, { teen: true, minor: true });
	const pool = [owner, other, kid, teen];
	const { Q } = await quests(T, pool);
	Q.update(0.1);
	const orig = Math.random; Math.random = () => 0.5;
	const title = Q.bag('auto');
	Math.random = orig;
	// (the console's bag is set down at once; let a real one walk instead)
	assert.match(title, /left on a bench/);
	assert.equal(Q.info().bag.where, 'bench');
	assert.ok(Math.abs(Q.info().bag.at[0] - 18) < 1, 'on the bench');
	assert.ok(!minor(pool.find((p) => 'N' + p.P.dna.seed === Q.info().bag.owner)), 'a grown-up left it');
	Q.dispose();
	// walked to it: in hand on the way, down on the seat, then on their way without it
	const T2 = stage({ furniture }), o2 = T2.body(30, 4, 41), pool2 = [o2];
	const { Q: Q2 } = await quests(T2, pool2);
	Q2.update(0.1);
	assert.equal(Q2.info().bag, null);
	// a natural one: the timer runs out and the owner walks over
	for (let k = 0; k < 2000 && !(Q2.info().bag?.phase === 'left'); k++) { T2.walk(pool2, 0.1); Q2.update(0.1); }
	const B = Q2.info().bag;
	assert.ok(B, 'a bag was left');
	assert.equal(B.where, 'bench');
	assert.equal(B.phase, 'left');
	assert.ok(Math.hypot(o2.M.S.pos.x - 18, o2.M.S.pos.z) < 3, 'they walked to the bench to leave it');
	assert.ok(!o2.override, 'and walk on unaware');
	Q2.dispose();
});

test('a theft out of sight leaves a lead: the words, the book, the limits', async () => {
	const { createLeads, leadFrom, leadLine, leadNote, leadFact, whenOf } = await import('../src/people/npc-leads.js');
	const { settle } = await import('../src/people/npc-quests-core.js');
	const q = bagQuest({ owner: { id: 'npc:5', name: 'Ana' }, at: { x: 0, z: 0 }, where: { kind: 'bench' }, region: 'bay.east' });
	const W = createMoney(), C = createCommons({ store: memStore() });
	const bad = { taker: 'npc:9', ...settle(q, 'betray', { actorId: 'npc:9', money: W, commons: C }) };
	const good = { taker: 'npc:9', ...settle(q, 'done', { actorId: 'npc:9', money: W, commons: C }) };
	assert.equal(leadFrom(q, good), null, 'a bag handed back leaves nothing to follow');
	const L = leadFrom(q, bad, { region: 'bay.east', regionName: 'the East Bay', town: 'Oakland', hours: 9 });
	assert.equal(L.owner.name, 'Ana'); assert.equal(L.thief.id, 'npc:9'); assert.equal(L.when, 'this morning');
	assert.match(leadLine(L, 0), /^Someone grabbed a bag off a bench on the corner this morning\.$/);
	assert.match(leadNote(L), /Ana's bag off a bench on the corner this morning in Oakland/);
	assert.match(leadFact(L), /^Heard that someone took Ana's bag/);
	for (let n = 0; n < 8; n++) assert.doesNotMatch(leadLine(L, n) + leadNote(L) + leadFact(L), /—/);
	assert.deepEqual([3, 10, 14, 19, 23].map(whenOf), ['last night', 'this morning', 'this afternoon', 'this evening', 'tonight']);
	// a book: a few open at a time, not two at once in a region, kept across a reload
	let t = 1e6;
	const st = memStore(), B = createLeads({ store: st, now: () => t });
	assert.ok(B.add({ ...L, id: 'a', t }));
	assert.equal(B.add({ ...L, id: 'b', t }), null, 'one at a time in a region');
	for (const r of ['r1', 'r2', 'r3', 'r4', 'r5']) B.add({ ...L, id: r, region: r, t });
	assert.equal(B.open().length, 5, 'five open at most');
	B.close('a', 'returned');
	assert.equal(createLeads({ store: st, now: () => t }).get('a').state, 'returned');
	t += 46 * 60 * 1000;
	assert.equal(B.open().length, 0, 'gone cold after a while');
});

test('a lead in your region: talked about, marked, and the thief found and answered', async () => {
	const { createErrands } = await import('../src/people/errands.js');
	const T = stage();
	const a = T.body(30, 10, 51), b = T.body(-25, 20, 52), kid = T.body(20, 2, 53, {}, { child: true }), teen = T.body(22, -3, 54, {}, { teen: true, minor: true });
	const pool = [a, b, kid, teen];
	const deeds = [], hints = [];
	const errands = createErrands({ scene: T.scene, camera: T.camera, world: T.world, people: { pool, sidewalk: () => null }, chatter: { say: (p, l) => T.said.push([p, l.text]) }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), arms: () => ({ apply: () => ({ ok: true }) }), morality: () => ({ record: (d) => deeds.push(d.kind) }), hint: (t) => hints.push(t), driving: () => false, isPhone: false });
	const { Q } = await quests(T, pool, { errands: () => errands, hint: (t) => hints.push(t), store: memStore() });
	Q.update(0.1);
	assert.match(Q.lead('bag'), /^Someone took \w+'s bag/);
	const [L] = Q.leads();
	assert.ok(L.here && /thief may still be about/.test(L.note));
	// people round here mention it (some of them)
	const lines = Array.from({ length: 60 }, (_, i) => Q.leadLine(1000 + i)).filter(Boolean);
	assert.ok(lines.length > 5 && lines.every((t) => /bag/.test(t)), lines[0]);
	// the marker, near where it happened
	const m = Q.mark();
	assert.ok(m && m.radius >= 20 && /was taken/.test(m.title));
	// go there: a grown-up about is carrying it (never one of the children)
	T.camera.position.set(m.x, 1.7, m.z); T.P.pos.set(m.x, 1.7, m.z);
	a.M.S.pos.set(m.x + 30, 0, m.z); b.M.S.pos.set(m.x - 40, 0, m.z + 10); kid.M.S.pos.set(m.x + 20, 0, m.z); teen.M.S.pos.set(m.x + 22, 0, m.z);
	const orig = Math.random; Math.random = () => 0.1;
	for (let k = 0; k < 120 && !/The one who took/.test(Q.mark()?.title || ''); k++) Q.update(0.1);
	Math.random = orig;
	const spotted = Q.mark();
	assert.match(spotted.title, /The one who took/);
	const thief = pool.find((p) => Math.hypot(p.M.S.pos.x - spotted.x, p.M.S.pos.z - spotted.z) < 0.01);
	assert.ok(thief && !minor(thief), 'a grown-up carries it');
	assert.ok(hints.some((h) => /could be the one who took it/.test(h)));
	// walk up: they walk off with it, and it is yours to answer like any theft
	T.camera.position.set(thief.M.S.pos.x + 5, 1.7, thief.M.S.pos.z); T.P.pos.copy(T.camera.position);
	for (let k = 0; k < 15 && !errands.busy(); k++) Q.update(0.1);
	assert.equal(errands.info().errand?.stage, 'thief');
	assert.ok(hints.some((h) => /That looks like the one who took .* this \w+\. Catch them and take it, or let them go\./.test(h)));
	// take it off them (neutral), give it back where it was taken (the boost)
	T.P.pos.set(thief.M.S.pos.x, 1.7, thief.M.S.pos.z + 1); errands.update(0.1);
	assert.equal(deeds.at(-1), 'take-from-thief');
	const d = errands.info().errand.drop; T.P.pos.set(d[0], d[1] + 1.7, d[2]); errands.update(0.1);
	const back = errands.mark(); T.P.pos.set(back.x, 1.7, back.z); errands.update(0.1);
	assert.deepEqual(deeds, ['take-from-thief', 'return-stolen']);
	assert.equal(Q.leads().length, 0, 'the lead is closed');
	Q.dispose();
});

test('far away, thefts now and then leave leads', async () => {
	const T = stage(), pool = [T.body(10, 10, 61)];
	const { Q } = await quests(T, pool, { store: memStore() });
	Q.update(0.1);
	Q.farTick(80);
	assert.ok(Q.leads().length >= 1, 'a lead from the far tick');
	assert.ok(Q.info().leads.length >= 1);
	Q.dispose();
});
