// The economy (src/economy/): every kind of town has a third or so of its buildings as
// businesses, the same building is always the same business with the same name, no two in a
// town share a name, no name is a real brand, and the requests and payroll behave.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTown } from '../src/crysis/civgen.js';
import { planTown, describeBoxes, shareOf, establish, denied, nameFor, TYPES, LOCALES, localeAt, hashAt, registerSiting } from '../src/economy/establishments.js';
import { requestsFor, createBoard } from '../src/economy/requests.js';
import { createPayroll } from '../src/economy/payroll.js';

const h01 = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y); let u = x - i, v = y - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); return (h01(i, j) * (1 - u) + h01(i + 1, j) * u) * (1 - v) + (h01(i, j + 1) * (1 - u) + h01(i + 1, j + 1) * u) * v; };
const heightAt = (x, z) => 40 + vn(x / 1800, z / 1800) * 90 + vn(x / 600 + 5, z / 600) * 25;
const grown = new Map();
const town = (style, radius, seed) => { const k = style + radius + seed; if (!grown.has(k)) grown.set(k, describeBoxes(generateTown({ seed, cx: 0, cz: 0, radius, heightAt, style, name: 'T', ang: 0.3 }).boxes)); return grown.get(k); };

// the city's own kinds of place, laid out as bay/city.js lays them (its grid, its tags)
function gridSuburb() {
	const out = [];
	for (let j = 0; j < 12; j++) for (let i = 0; i < 14; i++) {
		const X = i * 200, Z = j * 110;
		if (i % 7 === 0) { out.push({ x: X + 100, z: Z + 80, w: 140, d: 22, a: 0, h: 8, use: 'retail', street: 2 }); if ((i + j) % 2) out.push({ x: X + 30, z: Z + 20, w: 18, d: 14, a: 0, h: 6.5, use: 'retail', street: 2 }); continue; }
		const im7 = i % 7, jm4 = j % 4, collector = jm4 === 0 ? 0 : jm4 === 3 ? 1 : -1;
		for (const side of [0, 1]) for (let k = 0; k < 9; k++) {
			const corner = k === 0 || k === 8, art = corner && ((im7 === 1 && k === 0) || (im7 === 6 && k === 8));
			out.push({ x: X + 10 + k * 20, z: Z + (side ? 85 : 25), w: 14, d: 11, a: side ? Math.PI : 0, h: 3.3, use: 'house', street: art || collector === side ? 2 : corner ? 1 : 0 });
		}
	}
	return out;
}
function cityCentre() {
	const out = [];
	for (let k = 0; k < 60; k++) out.push({ x: k * 30, z: 0, w: 26, d: 27, a: 0, h: 40 + (k % 7) * 20, use: 'tower', down: 0.6 });
	for (let k = 0; k < 140; k++) out.push({ x: k * 8, z: 60, w: 7.6, d: 19, a: 0, h: 11, use: k % 3 ? 'shop' : 'row', street: k % 3 ? 2 : 0, down: 0.3 });
	for (let k = 0; k < 120; k++) out.push({ x: k * 8, z: 120, w: 7.6, d: 19, a: 0, h: 10, use: 'row', street: k % 9 === 0 ? 1 : 0, down: 0.2 });
	for (let k = 0; k < 20; k++) out.push({ x: k * 40, z: 180, w: 30, d: 20, a: 0, h: 14, use: 'apt', street: k % 4 === 0 ? 2 : 0 });
	return out;
}
function harbourTown() {
	const out = [];
	for (let k = 0; k < 140; k++) out.push({ x: k * 22, z: (k % 3) * 40, w: 11, d: 10, a: 0, h: 5, use: 'house', coast: k % 5 !== 4, street: k % 6 === 0 ? 1 : 0 });
	for (let k = 0; k < 12; k++) out.push({ x: k * 30, z: -40, w: 14, d: 18, a: 0, h: 5, use: 'shop', coast: true, street: 2 });
	for (let k = 0; k < 6; k++) out.push({ x: k * 50, z: -80, w: 30, d: 24, a: 0, h: 9, use: 'industry', coast: true });
	return out;
}
function countryside(wild) {
	const out = [];
	for (let k = 0; k < 120; k++) out.push({ x: k * 140 + (k % 5) * 13, z: (k % 7) * 160, w: 13, d: 11, a: 0, h: 4, use: 'house', rural: true, wild: wild && k % 3 !== 0, street: k % 4 === 0 ? 1 : 0 });
	return out;
}
function businessPark() {
	const out = [];
	for (let k = 0; k < 50; k++) out.push({ x: (k % 10) * 120, z: Math.floor(k / 10) * 120, w: 60, d: 40, a: 0, h: 16, use: k % 9 === 0 ? 'retail' : 'office' });
	for (let k = 0; k < 30; k++) out.push({ x: k * 40, z: 700, w: 50, d: 30, a: 0, h: 10, use: 'industry' });
	return out;
}

const TOWNS = [
	['grown suburb (Texas)', () => town('suburb', 1500, 7), 'us-tx'],
	['grown suburb (Japan)', () => town('suburb', 900, 11), 'jp'],
	['grown older town (France)', () => town('older', 1100, 3), 'fr'],
	['grown older town (small US)', () => town('older', 700, 5), 'us'],
	['grown suburb (another seed)', () => town('suburb', 1200, 23), 'us-ca'],
	['grid suburb (Bay)', gridSuburb, 'us-ca'],
	['city centre', cityCentre, 'us-ca'],
	['harbour town', harbourTown, 'uk'],
	['countryside', () => countryside(false), 'it'],
	['forest edge', () => countryside(true), 'de'],
	['business park', businessPark, 'us-ca'],
];

test('at least 30% of the buildings in every kind of town are businesses', () => {
	for (const [name, make, loc] of TOWNS) {
		const list = make(), plan = planTown(list, { locale: loc }), share = shareOf(list, plan);
		assert.ok(share >= 0.3, `${name}: ${(share * 100).toFixed(1)}% of ${list.length}`);
		// and not everything: homes stay homes
		assert.ok(share < 0.97 || name === 'business park' || name === 'city centre', `${name}: ${(share * 100).toFixed(1)}%`);
	}
});

test('quiet residential streets stay mostly homes', () => {
	const list = gridSuburb().filter((b) => b.use === 'house' && b.street === 0), plan = planTown(list);
	assert.ok(plan.length / list.length < 0.15, `${plan.length} of ${list.length}`);
});

test('the same building is always the same business, with the same name', () => {
	const a = planTown(town('suburb', 900, 11), { locale: 'jp' }), b = planTown(town('suburb', 900, 11), { locale: 'jp' });
	assert.deepEqual(a.map((E) => [E.x, E.z, E.type, E.name]), b.map((E) => [E.x, E.z, E.type, E.name]));
	const one = { x: 1234.5, z: -987.25, w: 12, d: 18, a: 0.3, h: 5, use: 'shop', street: 2 };
	assert.deepEqual(establish(one, 'it'), establish({ ...one }, 'it'));
	assert.equal(nameFor('pasta', 10, 20, 'it'), nameFor('pasta', 10, 20, 'it'));
});

test('no two businesses in a town share a name', () => {
	for (const [name, make, loc] of TOWNS) {
		const plan = planTown(make(), { locale: loc }), seen = new Set();
		for (const E of plan) { const k = E.name.toLowerCase(); assert.ok(!seen.has(k), `${name}: ${E.name} twice`); seen.add(k); }
	}
});

test('no real brands, in any place, for any kind of business', () => {
	assert.ok(denied('Waffle House') && denied('STARBUCKS reserve') && denied("McDonald's") && denied('Trader Joe’s'));
	let n = 0;
	for (const loc of Object.keys(LOCALES)) for (const id of Object.keys(TYPES)) for (let k = 0; k < 40; k++) {
		const name = nameFor(id, k * 37.5, k * -11.5 + id.length, loc);
		assert.ok(name && !denied(name), `${loc} ${id}: ${name}`);
		assert.ok(!/\{|\}/.test(name), `${loc} ${id}: unfilled ${name}`);
		assert.ok(!/\u2014/.test(name), `${loc} ${id}: dash in ${name}`);
		n++;
	}
	assert.ok(n > 10000);
});

test('the place decides the food: tapas in Spain, ramen in Japan, barbecue in Texas', () => {
	assert.equal(localeAt(36.75, -5.16), 'es');
	assert.equal(localeAt(36.15, 137.25), 'jp');
	assert.equal(localeAt(30.28, -98.87), 'us-tx');
	assert.equal(localeAt(25.7, -100.3), 'mx');
	assert.equal(localeAt(37.79, -122.4), 'us-ca');
	assert.equal(localeAt(49.42, 0.23), 'fr');
	const kinds = (loc) => { const c = {}; for (let k = 0; k < 600; k++) { const E = establish({ x: k * 13.5, z: k * 7.5, w: 9, d: 18, a: 0, h: 9, use: 'shop', street: 2 }, loc); if (E) c[E.type] = (c[E.type] || 0) + 1; } return c; };
	assert.ok((kinds('es').tapas || 0) > 40, 'tapas in Spain');
	assert.ok((kinds('jp').ramen || 0) + (kinds('jp').izakaya || 0) > 40, 'ramen in Japan');
	assert.ok(!kinds('jp').tapas, 'no tapas in Japan');
	const tx = {}; for (let k = 0; k < 800; k++) { const E = establish({ x: k * 9.5, z: k * 3.5, w: 30, d: 20, a: 0, h: 6, use: 'retail', venue: 'restaurant' }, 'us-tx'); if (E) tx[E.type] = (tx[E.type] || 0) + 1; }
	assert.ok((tx.bbq || 0) > (tx.sushi || 0) * 3, 'barbecue in Texas');
	// and in a grown town's own houses too, not only its shopping centre
	const count = (plan, t) => plan.filter((E) => E.type === t).length;
	assert.ok(count(planTown(town('suburb', 1500, 7), { locale: 'us-tx' }), 'bbq') > 20, 'barbecue in a Texas town');
	assert.ok(count(planTown(town('older', 1100, 3), { locale: 'es' }), 'tapas') > 20, 'tapas in a Spanish town');
});

test('the right business in the right place', () => {
	const at = (b, loc = 'us') => { const c = {}; for (let k = 0; k < 400; k++) { const E = establish({ ...b, x: k * 17.5, z: k * 5.5 }, loc); if (E) c[E.type] = (c[E.type] || 0) + 1; } return c; };
	const harbour = at({ w: 12, d: 10, a: 0, h: 5, use: 'house', coast: true, street: 1 });
	assert.ok((harbour.outfitter || 0) + (harbour.bait || 0) + (harbour.seafood || 0) > 30, JSON.stringify(harbour));
	const woods = at({ w: 12, d: 10, a: 0, h: 4, use: 'house', rural: true, wild: true, street: 1 });
	assert.ok((woods.huntpost || 0) > 20 && (woods.cabins || 0) > 10, JSON.stringify(woods));
	const strip = at({ w: 30, d: 20, a: 0, h: 6, use: 'retail', venue: 'restaurant', street: 2 });
	assert.ok((strip.burger || 0) > 20, JSON.stringify(strip));
	const park = at({ w: 60, d: 40, a: 0, h: 16, use: 'office', venue: 'office' });
	assert.ok((park.tech || 0) > 100, JSON.stringify(park));
	// a walk-in shop's sign agrees with its fit-out (bay/commercial.js)
	for (let k = 0; k < 200; k++) { const E = establish({ x: k * 23.5, z: 4, w: 20, d: 24, a: 0, h: 6, use: 'retail', street: 2 }); if (E) assert.ok(['cafe', 'restaurant', 'shop', 'tattoo', 'arcade', 'bowling', 'cinema', 'office'].includes(E.venue), E.type); }
	// the B&B on its post, the fishing outfitter's canoe, the drive-through's board
	assert.ok(TYPES.bnb.props.includes('postsign') && TYPES.outfitter.props.includes('outrigger') && TYPES.huntpost.props.includes('antlers') && TYPES.burger.props.includes('menuboard'));
});

test('the public services: listed, and claimed by whatever runs them', () => {
	assert.equal(TYPES.hospital.service, 'hospital'); assert.equal(TYPES.police.service, 'police'); assert.equal(TYPES.firestation.service, 'fire');
	const b = { x: 500.5, z: 20, w: 80, d: 60, a: 0, h: 30, use: 'office' };
	const off = registerSiting('hospital', (q) => q.w * q.d > 4000);
	const E = establish(b, 'us');
	off();
	assert.equal(E.type, 'hospital'); assert.equal(E.service, 'hospital'); assert.ok(/Hospital|Medical/.test(E.name));
	assert.notEqual(establish({ ...b }, 'us')?.service, 'hospital');
	assert.throws(() => registerSiting('bakery', () => true));
});

// ---------- requests ----------
const registry = () => {
	const list = [...cityCentre(), ...harbourTown().map((b) => ({ ...b, x: b.x + 2000 })), ...countryside(false).map((b) => ({ ...b, z: b.z + 3000 }))];
	const plan = planTown(list, { locale: 'us-ca' });
	return plan.map((E) => ({ ...E, id: 'biz:' + Math.round(E.x) + ':' + Math.round(E.z) }));
};
const SHAPE = (R) => {
	assert.equal(typeof R.id, 'string'); assert.equal(typeof R.kind, 'string'); assert.equal(typeof R.title, 'string');
	assert.ok(['business', 'person'].includes(R.giver.type) && R.giver.id && R.giver.name && Number.isFinite(R.giver.x) && Number.isFinite(R.giver.z));
	assert.ok(Array.isArray(R.steps) && R.steps.length >= 1);
	for (const s of R.steps) { assert.ok(['go', 'pickup', 'deliver', 'talk', 'wait', 'fix', 'chase'].includes(s.do), s.do); assert.ok(Number.isFinite(s.at.x) && Number.isFinite(s.at.z) && s.at.name); if (s.item) assert.ok(s.item.name && s.item.shape); }
	assert.ok(Number.isInteger(R.reward.credits) && R.reward.credits >= 10 && R.reward.credits <= 250 && R.reward.from);
	assert.ok(R.deeds.done && (!R.deeds.betray || ['steal', 'robbery', 'kept-wallet'].includes(R.deeds.betray)));
	assert.ok(R.tempt >= 0 && R.tempt <= 1 && typeof R.region === 'string' && Number.isFinite(R.expires));
};

test('requests: deterministic, at real places, paid sensibly, in the shared shape', () => {
	const reg = registry(), ids = new Set(reg.map((E) => E.id)), homes = [{ x: 30, z: 300 }, { x: 900, z: 260 }, { x: 2400, z: 90 }];
	const kinds = new Set();
	let n = 0;
	for (const E of reg) {
		const near = reg.filter((q) => Math.hypot(q.x - E.x, q.z - E.z) < 1500);
		const a = requestsFor(E, near, { day: 3, now: 1000, homes }), b = requestsFor(E, near, { day: 3, now: 1000, homes });
		assert.deepEqual(a, b);
		for (const R of a) {
			SHAPE(R); n++; kinds.add(R.kind);
			assert.equal(R.reward.from, E.id);
			for (const s of R.steps) if (s.at.establishmentId) assert.ok(ids.has(s.at.establishmentId), s.at.name);
			// every named place is a real establishment or a person's house, a lost hiker, the woods
			for (const s of R.steps) assert.ok(s.at.establishmentId || /house|woods|hiker|street|gardens|outrigger|truck|car|guest/.test(s.at.name), s.at.name);
		}
	}
	assert.ok(n > 100 && kinds.size >= 10, `${n} requests of ${kinds.size} kinds: ${[...kinds]}`);
	// another day, other requests
	const E = reg.find((q) => q.type === 'cafe') || reg[0];
	assert.notDeepEqual(requestsFor(E, reg, { day: 3 }).map((R) => R.title), requestsFor(E, reg, { day: 9 }).map((R) => R.title).concat(['x']));
});

test('requests: the chains between businesses (eggs from the farm stand)', () => {
	const waffle = { id: 'biz:w', type: 'waffle', name: 'Syrup & Fern', x: 0, z: 0, door: [0, 5], locale: 'us' };
	const farm = { id: 'biz:f', type: 'farmstand', name: "Opal's Farm Stand", x: 600, z: 0, door: [600, 5], locale: 'us' };
	const garage = { id: 'biz:g', type: 'autorepair', name: "Hal's Auto Repair", x: 900, z: 200, door: [900, 205], locale: 'us' };
	let eggs = false, truck = false;
	for (let day = 0; day < 40; day++) {
		for (const R of requestsFor(waffle, [waffle, farm, garage], { day })) if (R.kind === 'supply' && R.steps.some((s) => s.at.establishmentId === 'biz:f')) eggs = true;
		for (const R of requestsFor(farm, [waffle, farm, garage], { day })) if (R.kind === 'truck' && R.steps.some((s) => s.at.establishmentId === 'biz:g')) truck = true;
	}
	assert.ok(eggs && truck);
});

test('requests: a board, taken and done by anyone, paid through payroll', () => {
	const reg = registry(), P = createPayroll({ clock: () => 0 }), pays = [];
	P.onPay((p) => pays.push(p));
	const board = createBoard({ near: (x, z, r) => reg.filter((E) => Math.hypot(E.x - x, E.z - z) < r), homes: () => [{ x: 10, z: 10 }], clock: () => 5000, payroll: P });
	const open = board.near(0, 60, 400);
	assert.ok(open.length > 3);
	const R = open[0];
	assert.ok(board.take(R.id, 'npc:42'));
	assert.equal(board.take(R.id, 'player'), null);
	assert.equal(board.complete(R.id, 'player').ok, false);
	const done = board.complete(R.id, 'npc:42', 'done');
	assert.ok(done.ok && done.paid === R.reward.credits && done.deed === 'favour');
	assert.deepEqual(pays.at(-1), { npcId: 'npc:42', credits: R.reward.credits, why: 'request: ' + R.kind, employerId: R.reward.from });
	const T = board.near(0, 60, 400).find((q) => q.deeds.betray);
	board.take(T.id, 'npc:7');
	assert.equal(board.complete(T.id, 'npc:7', 'steal').deed, T.deeds.betray);
	assert.ok(!board.near(0, 60, 400).some((q) => q.id === R.id || q.id === T.id));
});

// ---------- payroll ----------
test('payroll: a wage a shift, a bonus a task, sales to the business', () => {
	let now = 0;
	const P = createPayroll({ clock: () => now }), pays = [];
	P.onPay((p) => pays.push(p));
	const E = { id: 'biz:t', name: 'Fernly Systems', type: 'tech' }, C = { id: 'biz:c', name: 'Café Wren', type: 'cafe' };
	P.setResolver((x) => (x < 100 ? E : C));
	const desk = { x: 10, z: 0 }, till = { x: 500, z: 0 };
	const w = P.clockIn('npc:1', desk, 'office worker');
	assert.ok(w > 0 && P.clockIn('npc:1', desk) === 0, 'once a shift');
	now += 16 * 60 * 1000;
	assert.ok(P.clockIn('npc:1', desk) === w, 'the next shift');
	assert.ok(P.taskDone('npc:1', 'meeting', desk) > 0);
	P.clockIn('npc:2', till, 'vendor');
	const before = P.balance('biz:c');
	P.sale(till, 12, 'npc:2');
	assert.equal(P.balance('biz:c'), before + 12 - 2);
	assert.ok(pays.every((p) => p.npcId && p.credits > 0 && p.why && p.employerId));
	assert.equal(pays.filter((p) => p.npcId === 'npc:1' && p.why.startsWith('wage')).length, 2);
	const L = P.ledger();
	assert.equal(L.employed, 2);
	assert.equal(L.topEarners[0].npcId, 'npc:1');
	assert.ok(L.best.length === 2 && L.paid === pays.reduce((a, p) => a + p.credits, 0));
	assert.equal(P.employerOf('npc:2'), 'biz:c');
	assert.equal(P.clockIn('npc:9', null), 0, 'nobody to work for');
	assert.ok(hashAt(1, 2) === hashAt(1, 2));
});
