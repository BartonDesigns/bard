// The quality governor's rules (src/world/governor.js): stepping down when frames are slow or
// memory climbs, back up only after a long easy run, and the ceiling a crash or graphics loss
// leaves behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, LOWEST, RULES, governorState, govern, readRecord, ceilingNow, bootRecord, lossRecord, setTier, tierNow, qualityNow, onQuality, createGovernor, memoryNow } from '../src/world/governor.js';

const run = (s, seconds, sample, dt = 0.1) => { const out = []; for (let t = 0; t < seconds; t += dt) { const c = govern(s, { dt, ...sample }); if (c) out.push(c); } return out; };

test('tiers run from best to lightest and ask less each step', () => {
	assert.equal(TIERS[0].name, 'high');
	assert.equal(LOWEST, TIERS.length - 1);
	for (let i = 1; i < TIERS.length; i++) {
		assert.ok(TIERS[i].ratio < TIERS[i - 1].ratio);
		assert.ok(TIERS[i].people <= TIERS[i - 1].people);
		assert.ok(TIERS[i].far <= TIERS[i - 1].far);
	}
});

test('smooth frames hold the tier', () => {
	const s = governorState();
	assert.deepEqual(run(s, 60, { frameMs: 20 }), []);
	assert.equal(s.tier, 0);
});

test('slow frames step down one tier at a time, with room between steps', () => {
	const s = governorState();
	const changes = run(s, RULES.slowFor + 0.5, { frameMs: 40 });
	assert.deepEqual(changes, ['down']);
	assert.equal(s.tier, 1);
	// not again within the settle time, however slow
	assert.deepEqual(run(s, RULES.settle - 1.5, { frameMs: 40 }), []);
	run(s, 60, { frameMs: 40 });
	assert.equal(s.tier, LOWEST);
	// and never below the lightest
	run(s, 30, { frameMs: 80 });
	assert.equal(s.tier, LOWEST);
});

test('a single hitch does not step down', () => {
	const s = governorState();
	assert.deepEqual(run(s, 1, { frameMs: 120 }), []);
	assert.deepEqual(run(s, 20, { frameMs: 16 }), []);
	assert.equal(s.tier, 0);
});

test('memory past its budget steps down at once; it must fall well back before going up', () => {
	const s = governorState();
	assert.deepEqual(run(s, 1, { frameMs: 10, mem: 0.9 }), ['down']);
	assert.equal(s.tier, 1);
	// fast frames, but memory still above the comfortable share: no step up
	run(s, 120, { frameMs: 10, mem: 0.7 });
	assert.equal(s.tier, 1);
	run(s, RULES.fastFor + RULES.upAfterDown, { frameMs: 10, mem: 0.3 });
	assert.equal(s.tier, 0);
});

test('a long easy run steps back up, only after a while and not past the ceiling', () => {
	const s = governorState({ tier: 3, ceiling: 1 });
	run(s, RULES.fastFor - 1, { frameMs: 10 });
	assert.equal(s.tier, 3);
	run(s, 400, { frameMs: 10 });
	assert.equal(s.tier, 1);
});

test('a ceiling lowered from outside takes effect on the next step', () => {
	const s = governorState();
	s.ceiling = 2;
	assert.equal(govern(s, { dt: 0.016, frameMs: 10 }), 'down');
	assert.equal(s.tier, 2);
});

test('records: unreadable storage reads as a clean device', () => {
	assert.deepEqual(readRecord('not json'), { ceiling: 0, at: 0, crashes: [], live: 0 });
	assert.deepEqual(readRecord(null), { ceiling: 0, at: 0, crashes: [], live: 0 });
	assert.equal(readRecord(JSON.stringify({ ceiling: 9 })).ceiling, LOWEST);
});

test('the ceiling comes back a tier a day', () => {
	const now = Date.UTC(2026, 9, 14);
	const rec = { ceiling: 3, at: now, crashes: [], live: 0 };
	assert.equal(ceilingNow(rec, now + 3600000), 3);
	assert.equal(ceilingNow(rec, now + 86400000 + 1), 2);
	assert.equal(ceilingNow(rec, now + 5 * 86400000), 0);
});

test('a page that went without saying goodbye lowers the ceiling; two in ten minutes start at the lightest', () => {
	const now = Date.UTC(2026, 9, 14, 12);
	let { rec, crashed } = bootRecord({ ceiling: 0, at: 0, crashes: [], live: now - 60000 }, now);
	assert.equal(crashed, true);
	assert.equal(rec.ceiling, 1);
	assert.equal(rec.live, 0);
	({ rec, crashed } = bootRecord({ ...rec, live: now + 1000 }, now + 120000));
	assert.equal(crashed, true);
	assert.equal(rec.ceiling, LOWEST);
	// a clean goodbye: nothing changes
	({ rec, crashed } = bootRecord({ ceiling: 0, at: 0, crashes: [], live: 0 }, now));
	assert.equal(crashed, false);
	assert.equal(rec.ceiling, 0);
});

test('a graphics loss lowers the ceiling below the tier it happened at', () => {
	const now = Date.UTC(2026, 9, 14);
	assert.equal(lossRecord({ ceiling: 0, at: 0, crashes: [], live: 0 }, now, 0).ceiling, 1);
	assert.equal(lossRecord({ ceiling: 0, at: 0, crashes: [], live: 0 }, now, 2).ceiling, 3);
	assert.equal(lossRecord({ ceiling: 3, at: now, crashes: [], live: 0 }, now, 3).ceiling, LOWEST);
});

test('the tier now is shared with every system and listeners are told of changes', () => {
	const seen = [];
	const off = onQuality((q, n) => seen.push([q.name, n]));
	setTier(2);
	assert.equal(tierNow(), 2);
	assert.equal(qualityNow().name, 'low');
	assert.equal(setTier(2), false);
	setTier(0);
	off();
	setTier(1);
	assert.deepEqual(seen, [['low', 2], ['high', 0]]);
	setTier(0);
});

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('the governor at work: a phone starts a tier down, a page gone without goodbye lowers the next start', () => {
	const storage = memStore();
	let t = Date.UTC(2026, 9, 14, 12);
	const g1 = createGovernor({ phone: true, storage, now: () => t });
	assert.equal(g1.info().tier, 'medium');
	assert.equal(g1.crashedLastTime, false);
	g1.live(true);
	// the page goes (no live(false)); the next load knows
	t += 60000;
	const g2 = createGovernor({ phone: true, storage, now: () => t });
	assert.equal(g2.crashedLastTime, true);
	assert.equal(g2.info().ceiling, 'medium');
	g2.live(true);
	t += 60000;
	const g3 = createGovernor({ phone: true, storage, now: () => t });
	assert.equal(g3.info().tier, 'minimal');
	// a clean goodbye leaves the next start as it was
	g3.live(true); g3.live(false);
	const g4 = createGovernor({ phone: true, storage, now: () => t + 1000 });
	assert.equal(g4.crashedLastTime, false);
	setTier(0);
});

test('the governor at work: chosen modes hold, a loss caps them, slow frames step auto down', () => {
	const storage = memStore();
	let mode = 'high';
	const g = createGovernor({ phone: false, storage, mode: () => mode, now: () => Date.UTC(2026, 9, 14) });
	g.update(0.1, 50);
	assert.equal(g.info().tier, 'high');
	g.lost();
	assert.equal(g.info().tier, 'medium');
	mode = 'low'; g.apply();
	assert.equal(g.info().tier, 'low');
	mode = 'auto';
	for (let i = 0; i < 200; i++) g.update(0.1, 60);
	assert.equal(g.info().tier, 'minimal');
	assert.equal(tierNow(), LOWEST);
	setTier(0);
});

test('the governor at work: each Try again on a load that never finished is a tier lower, for this visit only', () => {
	const storage = memStore();
	let mode = 'high';
	const g = createGovernor({ phone: false, storage, mode: () => mode, now: () => Date.UTC(2026, 9, 22) });
	assert.equal(g.info().tier, 'high');
	g.retry();
	assert.equal(g.info().tier, 'medium');
	g.update(0.1, 10);
	assert.equal(g.info().tier, 'medium', 'High holds the lighter tier for the visit');
	g.retry(); g.retry(); g.retry();
	assert.equal(g.info().tier, 'minimal', 'and never below the lowest');
	assert.equal(g.info().crashes, 0, 'nothing is counted against the device');
	// the next visit starts where it would have anyway
	const g2 = createGovernor({ phone: false, storage, mode: () => 'high', now: () => Date.UTC(2026, 9, 22, 1) });
	assert.equal(g2.info().tier, 'high');
	setTier(0);
});

test('the governor at work: memory past its budget steps down even with quick frames', () => {
	const bytes = { n: 0 };
	const g = createGovernor({ phone: true, storage: memStore(), meter: { bytes: () => bytes.n }, budgetMB: 100 });
	g.update(0.1, 10);
	assert.equal(g.info().tier, 'medium');
	bytes.n = 45 * 1048576;     // 90% of the budget (graphics standing for the heap too)
	for (let i = 0; i < 30; i++) g.update(0.1, 10);
	assert.equal(g.info().tier, 'low');
	assert.ok(memoryNow() > 0.8, 'the share in use is readable by what else would load');
	setTier(0);
});
