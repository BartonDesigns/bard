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
	const Q = createNpcQuests({ scene: T.scene, camera: T.camera, world: T.world, people: { pool }, chatter: { say: (p, l) => T.said.push([p, l.text]) }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), commons, money, worldKey: () => 'earth', store: memStore(), ...extra });
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
	for (let k = 0; k < 8000 && !(Q2.info().bag?.phase === 'left'); k++) { T2.walk(pool2, 0.1); Q2.update(0.1); }
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
	// (seeded dice, so the run is the same every time)
	const orig = Math.random;
	let a = 12345; Math.random = () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return a / 4294967296; };
	Q.farTick(200);
	Math.random = orig;
	assert.ok(Q.leads().length >= 1, 'a lead from the far tick');
	assert.ok(Q.info().leads.length >= 1);
	Q.dispose();
});

test('families and teens: a parent walking the kids hands a bag back; teens see one and say so', async () => {
	const furniture = { street: { seatsNear: () => [{ kind: 'bench', x: 20, y: 0, z: 0, heading: 0 }] } };
	const T = stage({ furniture });
	const owner = T.body(26, 4, 71);
	// out with the family (family-life.js): a parent on their way, a child at their side
	const parent = T.body(25, -4, 72, { role: 'parent', route: undefined, path: [[60, 0]], source: 'family' });
	const child = T.body(25, -3.5, 73, { role: 'child', route: undefined, follow: parent, source: 'family' }, { child: true });
	const pool = [owner];
	const { Q, commons } = await quests(T, pool, { others: () => [parent, child] });
	Q.update(0.1);
	const orig = Math.random; Math.random = () => 0.5;
	Q.bag('return');
	Math.random = orig;
	assert.ok(T.said.some(([p, t]) => p === child && /bag/.test(t)), 'the child points it out');
	assert.ok(parent.override && parent.held, 'the parent goes to hand it back');
	assert.ok(!child.held && !child.override, 'the child is never the one who takes it');
	const all = [owner, parent, child];
	for (let k = 0; k < 600 && Q.info().scenes.length; k++) { T.walk(all, 0.1); Q.update(0.1); }
	assert.ok(T.said.some(([p, t]) => p === parent && /giving this back|catch them|take it back/.test(t)), 'a word to the kids');
	assert.equal(commons.actor('npc:72').deeds, 1);
	assert.ok(commons.actor('npc:72').honest > 0, 'a good deed on the parent');
	assert.ok(!commons.known('npc:73'), 'nothing on the child');
	Q.dispose();
	// a knot of teens on a wall beside the bench: they see it, say so, and leave it be
	const T2 = stage({ furniture }), o2 = T2.body(26, 4, 81);
	const teens = [0, 1, 2].map((k) => T2.body(21 + k, 1, 82 + k, { role: 'teen', route: undefined, sit: 0.48, source: 'family' }, { teen: true, minor: true }));
	const { Q: Q2, commons: C2 } = await quests(T2, [o2], { others: () => teens });
	Q2.update(0.1);
	Math.random = () => 0.5;
	Q2.bag('auto');
	Math.random = orig;
	for (let k = 0; k < 30; k++) Q2.update(0.1);
	assert.equal(T2.said.filter(([p]) => teens.includes(p)).length, 1, 'one of them says so');
	assert.equal(Q2.info().scenes.length, 0);
	assert.ok(teens.every((p) => !p.held && !p.override) && teens.every((p) => !C2.known('npc:' + p.P.dna.seed)));
	// forced to steal, the nearest grown-up does it, never a teen
	Q2.dispose();
	const T3 = stage({ furniture }), o3 = T3.body(26, 4, 91), far = T3.body(-8, 10, 92);
	const teens3 = [0, 1].map((k) => T3.body(20 + k, 1, 93 + k, { role: 'teen', route: undefined, source: 'family' }, { teen: true, minor: true }));
	const { Q: Q3, commons: C3 } = await quests(T3, [o3, far], { others: () => teens3 });
	Q3.update(0.1);
	Math.random = () => 0.5;
	Q3.bag('steal');
	Math.random = orig;
	for (let k = 0; k < 300; k++) { T3.walk([o3, far, ...teens3], 0.1); Q3.update(0.1); }
	assert.ok(teens3.every((p) => !C3.known('npc:' + p.P.dna.seed)), 'no teen thief');
	assert.ok(C3.known('npc:92') && C3.actor('npc:92').honest < 0, 'a grown-up stole it');
	Q3.dispose();
});

// ---- the street's small kindnesses: groceries, a lost pet, directions, a flat battery, a fall ----
// (seeds whose people are kind and reliable, or crooked and greedy: disposition.js)
const SAINT = 114, SAINT2 = 115, CROOK = 707;
const errandsFor = async (T, pool, extra = {}) => {
	const { createErrands } = await import('../src/people/errands.js');
	const out = { deeds: [], hints: [], spent: [] };
	out.E = createErrands({ scene: T.scene, camera: T.camera, world: T.world, people: { pool, sidewalk: () => null }, chatter: { say: (p, l) => T.said.push([p, l.text]) }, persona: (p) => ({ first: 'N' + p.P.dna.seed }), arms: () => ({ apply: () => ({ ok: true }) }), morality: () => ({ record: (d) => out.deeds.push(d.kind) }), hint: (t) => out.hints.push(t), driving: () => false, isPhone: false, money: () => ({ spend: (...a) => out.spent.push(a) }), ...extra });
	return out;
};
// run until the scenes are over, deciding with these dice while someone is choosing
async function play(T, Q, pool, kind, roll, k = 900) {
	const orig = Math.random;
	Math.random = () => roll;
	assert.doesNotMatch(Q.favour(kind), /nobody|no favour/);
	for (let i = 0; i < 40 && !Q.info().scenes.length; i++) { T.walk(pool, 0.1); Q.update(0.1); }
	Math.random = orig;
	const started = Q.info().scenes[0];
	for (let i = 0; i < k && Q.info().scenes.length; i++) { T.walk(pool, 0.1); Q.update(0.1); }
	return started;
}

test('new kinds from the people side: each a descriptor with an honest and a betraying end', async () => {
	const { favourQuest, settle, decide, farQuest } = await import('../src/people/npc-quests-core.js');
	const { score, RULES } = await import('../src/combat/morality.js');
	const { leadFrom } = await import('../src/people/npc-leads.js');
	const giver = { id: 'npc:1', name: 'Ana', x: 0, z: 0 }, car = { x: 10, z: 0 }, drop = { x: 20, z: 5 };
	const Q = Object.fromEntries(['groceries', 'pet', 'directions', 'jumpstart', 'fall'].map((k) => [k, favourQuest(k, { giver, car, drop, region: 'bay.sf', seed: 3, dest: 'the library' })]));
	assert.match(Q.groceries.title, /carry the groceries/); assert.match(Q.directions.title, /the way to the library/); assert.match(Q.jumpstart.title, /Jump-start/); assert.match(Q.fall.title, /Help Ana up/);
	for (const q of Object.values(Q)) { assert.ok(RULES[q.deeds.done]); assert.doesNotMatch(q.title, /—/); }
	assert.deepEqual([Q.directions.deeds, Q.fall.deeds, Q.jumpstart.deeds], [{ done: 'give-directions', betray: 'mislead' }, { done: 'help-fallen', betray: 'rob-fallen' }, { done: 'favour', betray: 'pocket-cash' }]);
	assert.ok(score('help-fallen').protect > 0 && score('rob-fallen').protect < 0 && score('mislead').honest < 0 && score('give-directions').honest > 0);
	assert.equal(Q.directions.reward.credits, 0, 'nobody pays for the way');
	// settled through the money adapter: the helper paid by the one helped; the cheat paid by them too
	const W = createMoney(), C = createCommons({ store: memStore() });
	const g0 = W.balance('npc:1'), h0 = W.balance('npc:7');
	settle(Q.groceries, 'done', { actorId: 'npc:7', money: W, commons: C });
	assert.equal(W.balance('npc:7'), h0 + Q.groceries.reward.credits); assert.equal(W.balance('npc:1'), g0 - Q.groceries.reward.credits);
	const g1 = W.balance('npc:1'), cheat = settle(Q.jumpstart, 'betray', { actorId: 'npc:8', money: W, commons: C });
	assert.equal(cheat.deed.kind, 'pocket-cash'); assert.equal(cheat.followUp, null, 'nothing to carry back');
	assert.ok(W.balance('npc:1') < g1, 'the money came out of their pocket');
	const wrong = settle(Q.directions, 'betray', { actorId: 'npc:9', money: W, commons: C });
	assert.equal(wrong.deed.kind, 'mislead'); assert.equal(wrong.credits, 0); assert.equal(wrong.followUp, null);
	const robbed = settle(Q.fall, 'betray', { actorId: 'npc:10', money: W, commons: C });
	assert.equal(robbed.deed.kind, 'rob-fallen'); assert.equal(robbed.followUp.item.name, 'wallet');
	assert.ok(leadFrom(Q.fall, { taker: 'npc:10', ...robbed }), 'a fall robbed out of sight leaves a lead too');
	// by disposition: the kind help, the crooked betray where there is something in it
	const saint = { mercy: 0.9, law: 0.9, protect: 0.9, honest: 0.9, greed: 0, reliable: 1, pace: 1 };
	const crook = { mercy: -0.8, law: -0.9, protect: -0.8, honest: -0.9, greed: 1, reliable: 0.2, pace: 1 };
	for (const q of Object.values(Q)) assert.deepEqual(decide(saint, q, [0.2, 0.2]), { take: true, outcome: 'done' }, q.kind);
	assert.equal(decide(crook, Q.fall, [0.2, 0.2]).outcome, 'betray');
	assert.equal(decide(crook, Q.pet, [0.01, 0.2]).outcome !== 'betray', true, 'nothing to steal in a lost dog');
	// the far tick plays them all out too
	const kinds = new Set(); for (let i = 0; i < 400; i++) kinds.add(farQuest('bay.sf', i, (i % 100) / 100).kind);
	for (const k of ['favour.groceries', 'favour.directions', 'favour.jumpstart', 'favour.fall', 'favour.pet']) assert.ok(kinds.has(k), k);
});

test('near you: directions given, a car jump-started or the money taken, groceries carried', async () => {
	const T = stage({ furniture: { street: { parkedNear: () => [{ id: 'sedan:1', x: 14, z: -10 }] } } });
	const giver = T.body(8, -8, SAINT2), helper = T.body(12, -2, SAINT), kid = T.body(9, -7, 5, {}, { child: true });
	const pool = [giver, helper, kid];
	const { Q, commons, money } = await quests(T, pool);
	Q.update(0.1);
	// the way, pointed out honestly
	const s1 = await play(T, Q, pool, 'directions', 0.3);
	assert.equal(s1.kind, 'favour.directions');
	assert.match(commons.actor('npc:' + SAINT).last, /Showed N115 the way/);
	assert.ok(T.said.some(([p, t]) => p === helper && /left|right|end/.test(t)));
	assert.ok(!giver.held && !helper.held, 'let go');
	// a flat battery: a crook asks for the money up front and walks off
	const crook = T.body(12, -3, CROOK); pool[1] = crook; helper.active = false;
	const g0 = money.balance('npc:' + SAINT2), c0 = money.balance('npc:' + CROOK);
	const s2 = await play(T, Q, pool, 'jumpstart', 0.02);
	assert.equal(s2.kind, 'favour.jumpstart'); assert.equal(s2.outcome, 'betray');
	assert.match(commons.actor('npc:' + CROOK).last, /Pocketed N115's money/);
	assert.ok(money.balance('npc:' + SAINT2) < g0 && money.balance('npc:' + CROOK) > c0, 'the money changed hands');
	assert.equal(Q.memoryOf(SAINT2), 'cheated');
	assert.ok(T.said.some(([p, t]) => p === giver && /money|walked off/.test(t)), 'they say so');
	// groceries: carried to the car, their owner walking alongside, paid by them
	helper.active = true; pool[1] = helper; crook.active = false;
	const h0 = money.balance('npc:' + SAINT);
	const s3 = await play(T, Q, pool, 'groceries', 0.3);
	assert.equal(s3.kind, 'favour.groceries');
	assert.ok(Math.hypot(giver.M.S.pos.x - 14, giver.M.S.pos.z + 10) < 4, 'they walked to the car together');
	assert.ok(money.balance('npc:' + SAINT) > h0, 'paid for it');
	assert.ok(!commons.known('npc:5'), 'the child is never part of it');
	Q.dispose();
});

test('someone falls: helped up by a passer-by or by you, or robbed while they are down', async () => {
	const T = stage();
	const giver = T.body(8, -8, SAINT2), crook = T.body(12, -4, CROOK);
	const pool = [giver, crook];
	const R = await errandsFor(T, pool);
	const { Q, commons } = await quests(T, pool, { errands: () => R.E });
	Q.update(0.1);
	// robbed while down, right in front of you: yours to answer, like any theft
	const s = await play(T, Q, pool, 'fall', 0.02, 0);
	for (let i = 0; i < 200 && !R.E.busy(); i++) { T.walk(pool, 0.1); Q.update(0.1); }
	assert.equal(s.kind, 'favour.fall'); assert.equal(s.outcome, 'betray');
	assert.match(commons.actor('npc:' + CROOK).last, /pockets while they were down/);
	assert.equal(R.E.info().errand?.stage, 'thief');
	assert.match(R.E.info().errand.title, /wallet/);
	R.E.cancel(); for (let i = 0; i < 80; i++) { R.E.update(0.1); Q.update(0.1); }
	Q.dispose();
	// you walk up to someone who fell: you help them up
	const T2 = stage(), g2 = T2.body(10, -6, SAINT2), pool2 = [g2];
	const R2 = await errandsFor(T2, pool2);
	const { Q: Q2 } = await quests(T2, pool2, { errands: () => R2.E, hint: (t) => R2.hints.push(t) });
	Q2.update(0.1);
	assert.match(Q2.favour('fall'), /Help N115 up/);
	assert.ok(g2.fallen && g2.held, 'down on the ground');
	assert.ok(R2.hints.some((h) => /has fallen over/.test(h)));
	const done0 = R2.E.info().done;
	T2.camera.position.set(10, 1.7, -5); T2.P.pos.copy(T2.camera.position);
	for (let i = 0; i < 15; i++) Q2.update(0.1);
	assert.deepEqual(R2.deeds, ['help-fallen']);
	assert.ok(!g2.fallen && !g2.held, 'back on their feet');
	assert.equal(R2.E.info().done, done0 + 1);
	Q2.dispose();
});

test('a lost dog found by a passer-by and brought home', async () => {
	const T = stage();
	const giver = T.body(10, -10, SAINT2), helper = T.body(14, -6, SAINT), pool = [giver, helper];
	const { Q, commons } = await quests(T, pool);
	Q.update(0.1);
	const before = T.scene.children.length;
	const s = await play(T, Q, pool, 'pet', 0.3, 1500);
	assert.equal(s.kind, 'favour.pet');
	assert.ok(T.scene.children.length >= before, 'a dog was out');
	assert.match(commons.actor('npc:' + SAINT).last, /favour/);
	assert.ok(T.said.some(([p, t]) => p === giver && /Thank|come here|There you are|Good/.test(t)), 'their thanks at the reunion');
	Q.dispose();
});

test('you can do them too: groceries to the car, a jump-start, the way; paid from their own pocket', async () => {
	const T = stage({ furniture: { street: { parkedNear: () => [{ id: 'sedan:1', x: 14, y: 0, z: -14 }] } } });
	const giver = T.body(2, -2, 4), pool = [giver];
	const R = await errandsFor(T, pool);
	for (let i = 0; i < 41; i++) R.E.update(1);
	const accept = (want) => { const line = R.E.askNearest(want); assert.doesNotMatch(line, /nobody/); assert.equal(R.E.info().errand.kind, want); R.E.accept(); R.E.update(0.1); };
	// groceries: they walk behind you to the car
	accept('groceries');
	assert.equal(R.E.info().errand.stage, 'haul');
	assert.match(R.E.mark().title, /groceries to the car/);
	T.P.pos.set(14, 1.7, -12); R.E.update(0.1);
	assert.equal(R.E.info().errand, null);
	assert.deepEqual(R.deeds, ['favour']);
	assert.ok(R.spent.length === 1 && R.spent[0][0] === 'npc:4' && R.spent[0][1] >= 25, 'paid out of their own account');
	for (let i = 0; i < 70; i++) R.E.update(1);
	// a jump-start: stand by the car while they try it
	T.P.pos.set(0, 1.7, 0);
	accept('jumpstart');
	T.P.pos.set(13, 1.7, -13);
	for (let i = 0; i < 40 && R.E.info().errand; i++) R.E.update(0.1);
	assert.equal(R.E.info().errand, null);
	assert.equal(R.deeds.at(-1), 'favour');
	for (let i = 0; i < 70; i++) R.E.update(1);
	// the way: said, thanked, no money
	T.P.pos.set(0, 1.7, 0);
	accept('directions');
	for (let i = 0; i < 20 && R.E.info().errand; i++) R.E.update(0.1);
	assert.equal(R.deeds.at(-1), 'give-directions');
	assert.equal(R.spent.length, 2, 'no money for directions');
	for (let i = 0; i < 70; i++) R.E.update(1);
	// groceries carried off down the street: kept, a betrayal
	accept('groceries');
	T.P.pos.set(-80, 1.7, 40); R.E.update(0.1);
	assert.equal(R.deeds.at(-1), 'betray-errand');
	assert.ok(R.hints.some((h) => /walked off with N4's groceries/.test(h)));
});
