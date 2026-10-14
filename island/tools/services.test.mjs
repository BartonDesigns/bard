import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICES, KINDS, fits, anchorsNear, siteFor, siteServices, dealOf } from '../src/services/siting.js';
import { createWard, priorityOf, careRate, billFor, playerCare, CARE } from '../src/services/patients.js';
import { roadGraph, findRoute, pathLength } from '../src/services/routes.js';
import { createDepot, takeFrom, bringTo, restock, RESTOCK } from '../src/services/depots.js';
import { applyInventoryTransaction, createInventoryState } from '../src/gameplay/arms.js';
import { PLANS, buildWarRoom, buildDepot, buildBarracks } from '../src/services/interiors.js';
import '../src/services/fitout.js';
import { furnish } from '../src/interiors/furnish.js';
import { WORK_ROLES, workplaceActivity } from '../src/people/workplace-life.js';
import '../src/services/roles.js';

// a town's worth of buildings: a grid of mixed blocks, some homes, some big halls
function town(n = 26, seed = 1) {
	const out = [];
	let s = seed;
	const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
		const kind = [0, 5, 6, 9, 8, 5, 6, 9, 0, 7][Math.floor(r() * 10)];
		out.push({ x: i * 70 + r() * 10, z: j * 70 + r() * 10, w: 14 + r() * 40, d: 12 + r() * 30, a: 0, h: 5 + r() * 14, kind, grid: false, rise: r() * 3 });
	}
	return out;
}

test('siting: only civic kinds of a fitting size, low and level, dealt one kind each', () => {
	assert.equal(fits('hospital', { x: 0, z: 0, w: 40, d: 30, h: 9, kind: 0, rise: 0 }), false, 'never a home');
	assert.equal(fits('police', { x: 0, z: 0, w: 40, d: 30, h: 60, kind: 5, rise: 0 }), false, 'never a tower');
	assert.equal(fits('fire', { x: 0, z: 0, w: 20, d: 20, h: 8, kind: 7, rise: 0, grid: false }), false, 'never a school');
	const B = town();
	for (const b of B) {
		const kinds = KINDS.filter((k) => fits(k, b));
		assert.ok(kinds.length <= 1, 'one building, one service at most');
		for (const k of kinds) { const S = SERVICES[k]; assert.ok(b.w >= S.W && b.d >= S.D && b.h <= S.top && b.rise <= 2.4); assert.ok(dealOf(b) >= S.deal[0] && dealOf(b) < S.deal[1]); }
	}
});
test('siting: the same choice whatever order the buildings come in, and every kind in a town', () => {
	const B = town(), cx = 26 * 35, cz = 26 * 35;
	const a = siteServices(B, cx, cz, 1600), b = siteServices([...B].reverse(), cx, cz, 1600);
	assert.deepEqual(a.map((q) => [q.key, q.building.x, q.building.z]), b.map((q) => [q.key, q.building.x, q.building.z]));
	for (const k of ['hospital', 'fire', 'police']) assert.ok(a.some((q) => q.kind === k), `a ${k} in a town of this size`);
	const used = new Set(a.map((q) => q.building));
	assert.equal(used.size, a.length, 'no building serves twice');
	for (const q of a) assert.ok(Math.hypot(q.building.x - q.anchor.x, q.building.z - q.anchor.z) <= SERVICES[q.kind].reach);
	// a hospital's anchors are kilometres apart; a fire station's closer
	assert.ok(anchorsNear('hospital', 0, 0, 3000).length < anchorsNear('fire', 0, 0, 3000).length);
	assert.equal(siteFor('hospital', { x: 1e6, z: 1e6 }, B), null, 'nothing out of reach');
});

test('patients: admitted, treated over time, discharged and billed', () => {
	const events = [], paid = [];
	const W = createWard({ id: 'h', beds: 2, charge: (who, credits) => { paid.push([who, credits]); return true; }, onEvent: (e) => events.push(e.type) });
	const a = W.admit({ who: 'npc:1', name: 'Ana', severity: 0.4, cause: 'a fall', by: 'walk-in' });
	assert.equal(a.state, 'treating', 'a free bed: straight in');
	assert.ok(events.includes('admitted') && events.includes('bed'));
	let t = 0;
	while (W.count() && t < 2000) { W.tick(1, { doctors: 1, nurses: 2 }); t++; }
	assert.equal(W.count(), 0, 'sent home');
	assert.deepEqual(events.filter((e) => ['treated', 'discharged', 'billed'].includes(e)), ['treated', 'discharged', 'billed']);
	assert.equal(paid.length, 1);
	assert.equal(paid[0][1], billFor({ need: a.need, minor: false }));
	assert.ok(t >= a.need * 0.8 + CARE.recover - 2, 'care takes time');
	assert.equal(W.ledger.paid, paid[0][1]);
	// with nobody on, nobody is mended; more staff mend faster
	assert.equal(careRate({ doctors: 0, nurses: 0 }), 0);
	assert.ok(careRate({ doctors: 2, nurses: 4 }, 2) > careRate({ doctors: 1, nurses: 1 }, 2));
});
test('patients: an unpaid bill is owed, not refused; a long wait goes on elsewhere, never untreated in place', () => {
	const W = createWard({ id: 'h', beds: 1, charge: () => false });
	W.admit({ who: 'a', severity: 0.2 });
	const b = W.admit({ who: 'b', severity: 0.1 });
	assert.equal(W.find('b').state, 'waiting');
	for (let i = 0; i < 4000 && W.count(); i++) W.tick(1, { doctors: 1, nurses: 2 });
	assert.equal(W.count(), 0);
	assert.ok(W.ledger.owed > 0 && W.ledger.paid === 0, 'treated though they could not pay');
	assert.ok(b.need > 0);
});
test('minors: seen first, cared for, never billed, never harmed', () => {
	const bills = [], seen = [];
	const W = createWard({ id: 'h', beds: 1, charge: (who, c) => { bills.push([who, c]); return false; }, onEvent: (e) => { if (e.type === 'bed') seen.push(e.patient.who); } });
	W.admit({ who: 'adult-first', severity: 0.5 });       // takes the only bed
	W.admit({ who: 'adult', severity: 0.5 });
	W.admit({ who: 'child', severity: 0.5, minor: true });
	assert.ok(priorityOf({ severity: 0.5, minor: true }) > priorityOf({ severity: 0.5 }));
	const care = [];
	for (let i = 0; i < 6000 && W.count(); i++) {
		const before = W.find('child');
		W.tick(1, { doctors: 1, nurses: 2 });
		const after = W.find('child');
		if (before && after) { assert.ok(after.care >= before.care, 'care only ever goes up'); assert.ok(after.severity <= before.severity); care.push(after.care); }
	}
	assert.deepEqual(seen.slice(0, 3), ['adult-first', 'child', 'adult'], 'the child takes the next bed before the adult who came first');
	assert.ok(!bills.some(([who]) => who === 'child'), 'a child is never billed');
	assert.equal(billFor({ need: 200, minor: true }), 0);
	assert.ok(W.ledger.waived > 0);
	// and at the desk: a child mended free, an urgent case never turned away
	assert.equal(playerCare({ missing: 0.8, minor: true, credits: 0 }).price, 0);
	assert.ok(playerCare({ down: true, credits: 0 }).ok);
	assert.equal(playerCare({ missing: 0.3, credits: 0 }).ok, false);
});

test('routes: the shortest way along the streets, and none where they do not join', () => {
	const roads = [{ pts: [0, 0, 100, 0, 200, 0], cls: 'residential' }, { pts: [200, 0, 200, 100], cls: 'residential' }, { pts: [0, 0, 0, 300, 200, 300, 200, 100], cls: 'residential' }, { pts: [500, 500, 600, 500], cls: 'residential' }, { pts: [100, 0, 100, 50], cls: 'footway' }];
	const G = roadGraph(roads);
	const p = findRoute(G, { x: 1, z: 1 }, { x: 199, z: 99 });
	assert.ok(p && Math.abs(pathLength(p) - 300) < 1, 'along the short side');
	assert.equal(findRoute(G, { x: 1, z: 1 }, { x: 600, z: 500 }), null, 'the far street is not joined');
});

test('depots: taking and bringing are inventory transactions on real items', () => {
	let inv = createInventoryState('player', { credits: 100 });
	let D = createDepot('armory:1', 'weapons');
	const t = takeFrom(D, 'spark-cell-pack', 'n1');
	assert.ok(t.ok && t.looted);
	const r1 = applyInventoryTransaction(inv, t.tx);
	assert.ok(r1.ok, r1.receipt?.message);
	inv = r1.state; D = t.next;
	assert.equal(inv.items['spark-cell-pack'], 1);
	assert.equal(D.stock['spark-cell-pack'], 7);
	const inst = Object.values(inv.instances)[0];
	const b = bringTo(D, inst, 'n2');
	const r2 = applyInventoryTransaction(inv, b.tx);
	assert.ok(r2.ok);
	assert.equal(r2.state.credits, 100 + b.pay);
	assert.equal(b.next.stock['spark-cell-pack'], 8);
	assert.equal(takeFrom(createDepot('x', 'medical'), 'warden-spark-carbine').ok, false, 'a hospital keeps no carbines');
	const empty = { ...D, stock: { ...D.stock, 'trail-rifle-box': 0 } };
	assert.ok(restock(empty, RESTOCK * 3).stock['trail-rifle-box'] >= 1, 'the quartermaster brings it back');
});

test('interiors: every plan is furnished with its posts, and every role has something to do', () => {
	const all = { ...PLANS, warRoom: buildWarRoom, depot: buildDepot, barracks: buildBarracks };
	for (const [k, f] of Object.entries(all)) {
		const P = f({ W: 30, D: 22 });
		for (let i = 0; i < P.levels.length; i++) furnish(P, i);
		assert.ok(P.rooms.length >= 3, k);
		const roles = new Set(P.seats.filter((s) => s.work).map((s) => s.work.role));
		assert.ok(roles.size >= 2, `${k} has its people`);
		for (const r of roles) { const a = workplaceActivity({ role: r, group: 'g:1', side: 0 }, 10, true); assert.ok(WORK_ROLES[r] || a.activity !== 'taking a break', `${r} has a routine`); assert.ok(a.activity && a.pose, r); }
		for (const it of P.items) assert.ok(Number.isFinite(it.x + it.z + it.y), `${k} ${it.type} placed`);
	}
	const H = PLANS.hospital({ W: 30, D: 22 });
	furnish(H, 0); furnish(H, 1);
	assert.ok(H.seats.some((s) => s.work?.role === 'patient' && s.k !== 1), 'beds for patients');
	assert.ok(H.rooms.some((r) => r.type === 'theatre') && H.rooms.some((r) => r.type === 'pharmacy' && r.cache === 'medical'));
	const Fs = PLANS.fire({ W: 26, D: 20 });
	assert.ok(Fs.pole && Fs.levels[1].holes.some((h) => Fs.pole.x > h[0] && Fs.pole.x < h[2]), 'the pole drops through the bunk room floor');
	const A = PLANS.armory({ W: 30, D: 22 });
	furnish(A, 0);
	assert.ok(A.rooms.find((r) => r.type === 'warRoom').mapTable, 'the war room has its map table');
});
