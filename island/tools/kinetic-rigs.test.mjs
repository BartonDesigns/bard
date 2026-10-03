import test from 'node:test';
import assert from 'node:assert/strict';
import { createKineticModel, RIG_KINDS, RIG_LIMITS } from '../src/music/kinetic-model.js';

function run(model, seconds, fn = () => {}) {
	for (let i = 0; i < Math.ceil(seconds * 120); i++) model.update(1 / 120, (b, velocity) => fn({ ...b, velocity, time: (i + 1) / 120 }));
}
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('all ten rigs have bounded pools, finite poses, silent construction and frozen stop state', () => {
	assert.equal(RIG_KINDS.length, 10);
	for (const kind of RIG_KINDS) {
		const model = createKineticModel({ kind, count: 1e9, seed: 42 });
		assert.equal(model.count, RIG_LIMITS[kind].maxCount, kind);
		model.update(5, () => assert.fail(`untriggered ${kind}`)); assert.equal(model.running, false);
		model.replay(); let notes = 0; run(model, 12, () => notes++); assert.ok(notes > 0, `${kind} must produce its authored events`);
		for (const b of model.bodies) for (const coordinate of ['x', 'y', 'z']) assert.ok(Number.isFinite(b[coordinate]), `${kind} ${coordinate}`);
		model.silence(); model.silence(); const frozen = JSON.stringify(model.bodies);
		model.update(1000, () => assert.fail(`stopped ${kind}`)); assert.equal(JSON.stringify(model.bodies), frozen);
		model.trigger(); assert.equal(model.running, true);
		assert.equal(createKineticModel({ kind, count: -1 }).count, RIG_LIMITS[kind].minCount);
	}
});

test('dominoes topple once in ordered BPM sixteenths, settle, and replay from standing', () => {
	const m = createKineticModel({ kind: 'dominoes', count: 12, bpm: 120 }); m.replay(); const events = [];
	run(m, 3, event => events.push(event));
	assert.equal(events.length, 12); assert.deepEqual(events.map(e => e.ring), m.bodies.map(b => b.ring));
	for (let i = 1; i < events.length; i++) near(events[i].time - events[i - 1].time, 0.125, 1 / 120 + 1e-8);
	assert.equal(m.running, false); assert.ok(m.bodies.every(b => b.state === 2 && b.rest));
	for (const b of m.bodies) near(b.y - 0.5 * Math.cos(b.angle) - 0.07 * Math.sin(b.angle), 0);
	m.configure({ bpm: 60 }); m.replay(); assert.ok(m.bodies.every(b => b.state === 0 && b.angle === 0));
	const slow = []; run(m, 0.8, event => slow.push(event)); assert.equal(slow.length, 4);
});

test('chime trigger sends seven ordered gust notes and preserves ambient sway after the gust', () => {
	const m = createKineticModel({ kind: 'chimes', seed: 3 }); m.replay(); const gust = [], ambient = [];
	run(m, 40, e => (e.velocity === 2.2 ? gust : ambient).push(e));
	assert.equal(gust.length, 7); assert.deepEqual(gust.map(e => e.ring), [0, 4, 8, 12, 15, 19, 23]);
	for (let i = 1; i < gust.length; i++) near(gust[i].time - gust[i - 1].time, 0.12, 1 / 120 + 1e-8);
	assert.ok(ambient.some(e => e.time > 2)); assert.equal(m.running, true);
	const before = m.bodies[0].angle; m.trigger(); near(m.bodies[0].angle, before);
	const next = []; run(m, 1, e => { if (e.velocity === 2.2) next.push(e); }); assert.equal(next.length, 7);
});

test('cradle exchanges only end balls and clicks alternating authored degrees at center crossings', () => {
	const m = createKineticModel({ kind: 'cradle' }); m.replay(); run(m, 0.5);
	assert.ok(m.bodies[4].x > m.bodies[4].anchorX); assert.equal(m.bodies[0].x, m.bodies[0].anchorX);
	for (const b of m.bodies.slice(1, 4)) { near(b.x, b.anchorX); near(b.y, 0.65); }
	m.replay(); const notes = []; run(m, 6, e => notes.push(e));
	assert.deepEqual(notes.map(e => e.ring), [12, 7, 12, 7]);
	const halfPeriod = Math.PI * Math.sqrt(1.9 / 9.8);
	for (let i = 1; i < notes.length; i++) near(notes[i].time - notes[i - 1].time, halfPeriod, 1 / 120);
});

test('droplets fall into the pool, produce bounded ripples and seeded notes; rain changes cadence', () => {
	const m = createKineticModel({ kind: 'droplets', seed: 9 }); m.replay(); const a = [];
	run(m, 12, e => { near(e.y, 0.36); assert.ok(Math.hypot(e.x, e.z) <= 1.8); assert.ok(e.ring >= 0 && e.ring <= 23); a.push(e); });
	assert.ok(a[0].time > 0.7 && a[0].time < 0.9); assert.equal(m.bodies.length, 10); assert.equal(m.ripples.length, 6);
	for (const r of m.ripples) assert.ok(r.opacity >= 0 && r.opacity <= 0.5);
	m.replay(); const b = []; run(m, 12, e => b.push(e)); assert.deepEqual(b, a);
	const fast = createKineticModel({ kind: 'droplets', seed: 9, rain: 3 }); fast.replay(); let hits = 0; run(fast, 12, () => hits++);
	assert.ok(hits > a.length * 1.5); assert.equal(fast.bodies.length, 10);
});

test('gravity harp plucks at each periapsis without an initial fake impact', () => {
	const m = createKineticModel({ kind: 'harp' }); m.replay(); m.update(0.1, () => assert.fail('not yet at periapsis'));
	const heard = new Set(); run(m, 15, e => {
		near(Math.hypot(e.x, e.z), e.semiMajor * (1 - e.eccentricity), 0.001);
		heard.add(e.ring);
	});
	assert.deepEqual([...heard].sort((a, b) => a - b), [4, 11, 18]);
});

test('staircase notes coincide with exact step contacts and the descending scale repeats after return', () => {
	const m = createKineticModel({ kind: 'stairs' }); m.replay(); const notes = [];
	run(m, 16, e => {
		const target = m.steps.find(s => Math.abs(s.y - e.y) < 1e-8);
		assert.ok(target); near(e.x, target.x); near(e.z, target.z); near(e.y - target.surfaceY, 0.17); notes.push(e.ring);
	});
	const expected = Array.from({ length: 16 }, (_, i) => 23 - Math.round(((i + 1) % 16) / 16 * 23));
	assert.deepEqual(notes.slice(0, 16), expected); assert.deepEqual(notes.slice(16, 32), expected);
	assert.ok(m.steps.every(s => s.surfaceY > 0)); assert.equal(m.running, true);
});

test('fountain lands shots on every tuned pad in order and reuses its six-particle pool', () => {
	const m = createKineticModel({ kind: 'fountain' }); m.replay(); const notes = [];
	run(m, 7, e => {
		const p = m.pads[e.pad]; near(e.x, p.x); near(e.y, p.y); near(e.z, p.z); near(e.y - p.surfaceY, 0.11); notes.push(e);
	});
	assert.equal(m.bodies.length, 6); assert.equal(m.count, 8);
	assert.deepEqual(notes.slice(0, 10).map(e => e.pad), [0, 1, 2, 3, 4, 5, 6, 7, 0, 1]);
	near(notes[0].time, 1.15, 1 / 120 + 1e-8);
	for (const e of notes) assert.equal(e.ring, Math.round(e.pad / 7 * 23));
});

test('wave bars keep their bases on ground and ring at traveling crests', () => {
	const m = createKineticModel({ kind: 'wavebars' }); m.replay(); const heard = new Set();
	run(m, 5, e => { assert.ok(e.height >= 2.288); near(e.y, e.height / 2); heard.add(e.ring); });
	assert.equal(heard.size, 20); assert.equal(m.running, true);
	for (const b of m.bodies) { assert.ok(b.height >= 0.7 && b.height <= 2.3); near(b.y - b.height / 2, 0); }
});

test('all rigs bound stalled-frame work and reject invalid timesteps/settings', () => {
	for (const kind of RIG_KINDS) {
		const a = createKineticModel({ kind, seed: 4 }), b = createKineticModel({ kind, seed: 4 }); a.replay(); b.replay();
		a.update(3600); b.update(0.1); assert.deepEqual(a.bodies, b.bodies, kind);
		const saved = JSON.stringify(a.bodies); for (const dt of [NaN, Infinity, -1, 0]) a.update(dt, () => assert.fail(kind)); assert.equal(JSON.stringify(a.bodies), saved);
		a.configure({ gravity: NaN, restitution: Infinity, bpm: NaN, drop: Infinity, rain: NaN });
		assert.deepEqual(a.settings, { gravity: 3.5, restitution: 0.88, bpm: 100, drop: 1.6, rain: 1 });
	}
});
