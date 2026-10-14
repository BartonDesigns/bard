import test from 'node:test';
import assert from 'node:assert/strict';
import { goalsFor, createDaily, dayKey } from '../src/gameplay/daily.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('three goals a day, different kinds, the same for the same day', () => {
	const a = goalsFor('2026-10-13'), b = goalsFor('2026-10-13'), c = goalsFor('2026-10-14');
	assert.equal(a.length, 3); assert.deepEqual(a.map((g) => g.id), b.map((g) => g.id));
	assert.equal(new Set(a.map((g) => g.kind)).size, 3);
	const days = new Set(); for (let d = 1; d <= 28; d++) days.add(goalsFor(`2026-11-${String(d).padStart(2, '0')}`).map((g) => g.id).join());
	assert.ok(days.size > 10, 'days vary');
	assert.ok(c);
});

test('goals count the right things, pay once each, a bonus for all three, and reset next day', () => {
	let t = new Date(2026, 9, 13, 12).getTime();
	const paid = [], storage = mem();
	const D = createDaily({ arms: () => ({ apply: (tx) => (paid.push(tx), { ok: true }) }), now: () => t, storage });
	const goals = D.list().goals;
	assert.equal(D.list().day, dayKey(t));
	// feed each kind of event until everything is done
	const feed = { favour: [{ kind: 'lost' }, { kind: 'catch' }, { kind: 'pass' }, { kind: 'lost' }, { kind: 'repair' }], thief: [{}], fare: [{ stars: 5, metres: 1200, onTime: true }, { stars: 5, metres: 1200 }, { stars: 5, metres: 1200 }], tend: [{}], street: [{ kind: 'crosswalk' }, { kind: 'crosswalk' }, { kind: 'crosswalk' }] };
	for (const [kind, list] of Object.entries(feed)) for (const d of list) D.note(kind, d);
	const L = D.list();
	assert.ok(L.goals.every((g) => g.done), JSON.stringify(L));
	assert.ok(L.bonus);
	assert.equal(paid.length, goals.length + 1);
	assert.equal(new Set(paid.map((p) => p.id)).size, paid.length);
	D.note('favour', { kind: 'lost' }); assert.equal(paid.length, goals.length + 1, 'nothing paid twice');
	// kept across a reload
	assert.ok(createDaily({ arms: () => null, now: () => t, storage }).list().bonus);
	t += 86400000;
	assert.ok(D.list().goals.every((g) => !g.done));
});
