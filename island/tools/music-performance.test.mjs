import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerformance, stepResonance } from '../src/music/performance.js';
import { worldBody, sameBody } from '../src/space/body.js';

test('fractional original seeds keep distinct identities without changing established terrain', () => {
	const make = seed => worldBody({ earth: false, seed: 8, biome: 'MEDIEVAL', origin: { id: 'slot:1', seed, type: 'TERRAN' } });
	const a = make(8.125), b = make(8.875);
	assert.equal(a.terrainSeed, b.terrainSeed); assert.equal(sameBody(a, b), false);
	assert.equal(a.type, 'TERRAN'); assert.equal(a.profile, 'MEDIEVAL');
	assert.ok(sameBody(a, worldBody({ earth: false, seed: 8, biome: 'MEDIEVAL', body: JSON.parse(JSON.stringify(a)) })));
});
test('galaxy/system scopes and profile changes cannot reuse the wrong resident world', () => {
	const p = { earth: false, seed: 99, biome: 'GAS', origin: { id: 'p1', seed: .75, type: 'GAS', galaxy: 'g1', system: 's1' } };
	const a = worldBody(p);
	assert.ok(!sameBody(a, worldBody({ ...p, origin: { ...p.origin, system: 's2' } })));
	assert.ok(!sameBody(a, worldBody({ ...p, biome: 'ICE' })));
	assert.equal(worldBody({ earth: true }).key, 'earth');
});
test('overlapping voices hold until the last release and retriggers emit off/on', () => {
	const p = createPerformance(), note = (id, started = 1) => ({ id, started, frequency: 440, velocity: .8 });
	p.update(.02, { mid: .3 }, { notes: [note('a'), note('b')] });
	assert.equal(p.state.on.length, 2); assert.equal(p.state.held, .8);
	p.update(.02, { mid: .3 }, { notes: [note('b')] });
	assert.equal(p.state.off[0].id, 'a'); assert.equal(p.state.held, .8);
	p.update(.02, { mid: .3 }, { notes: [note('b', 2)] });
	assert.equal(p.state.on.length, 1); assert.equal(p.state.off.length, 1);
	p.update(.02, { mid: .3 }, { notes: [] });
	assert.equal(p.state.held, 0); assert.equal(p.state.off[0].id, 'b');
});
test('silence cannot lift stones and a sustained bass pad does not repeatedly trigger kicks', () => {
	const p = createPerformance();
	p.update(.02, {}, { notes: [{ id: 'a', frequency: 440, velocity: 1 }] });
	assert.equal(p.state.held, 0);
	for (let i = 0; i < 300; i++) p.update(1/60, { bass: .4 });
	assert.equal(p.state.sequence, 1); assert.equal(p.state.held, 0);
	for (let i = 0; i < 60; i++) p.update(1/60, {});
	p.update(1/60, { bass: .5 }); assert.equal(p.state.sequence, 2);
});
test('held motion rises, release falls with a bounce, then settles without drift', () => {
	const b = { y: 0, v: 0 };
	for (let i = 0; i < 240; i++) stepResonance(b, 1/60, 1);
	assert.ok(b.y > 4.9 && b.y <= 6);
	let bounce = false, prior = b.v;
	for (let i = 0; i < 600; i++) { stepResonance(b, 1/60, 0); if (prior < -1 && b.v > .5) bounce = true; prior = b.v; }
	assert.ok(bounce); assert.equal(b.y, 0); assert.equal(b.v, 0);
});
test('bounded substeps agree across 30/60 Hz and recover from a stalled frame', () => {
	const a = { y: 0, v: 0 }, b = { y: 0, v: 0 };
	for (let i = 0; i < 120; i++) stepResonance(a, 1/30, .8);
	for (let i = 0; i < 240; i++) stepResonance(b, 1/60, .8);
	assert.ok(Math.abs(a.y-b.y) < 1e-8);
	stepResonance(a, 1000, 0, 1000); assert.ok(Number.isFinite(a.y) && a.y >= 0 && a.y <= 6);
});

test('authored palette and primal flag survive a saved descriptor', () => {
	const a = worldBody({ earth: false, seed: 9, biome: 'TERRAN', palette: { a: [.2,.5,.1], b: [.5,.1,.2], type: 'TERRAN', primal: true } });
	const b = worldBody({ earth: false, seed: 9, biome: 'TERRAN', body: JSON.parse(JSON.stringify(a)) });
	assert.deepEqual(a, b); assert.equal(b.primal, true);
});

test('share links preserve the descriptor and continue reading older version-one links', async () => {
	const { pack, unpack } = await import('../src/share.js');
	const s = { earth: false, seed: 8, type: 'MEDIEVAL', x: 12.34, y: 56.78, z: -9.1, yaw: .2, pitch: -.1, origin: { id: 'p1', seed: 8.125, type: 'TERRAN', name: 'A world' } };
	s.body = worldBody({ earth: false, seed: s.seed, biome: s.type, origin: s.origin });
	const back = unpack(pack(s));
	assert.deepEqual(back.body, s.body); assert.equal(back.x, s.x); assert.equal(back.origin.seed, 8.125);
	delete s.body;
	const old = unpack(pack(s)); assert.ok(old); assert.equal(old.body, undefined); assert.equal(old.origin.seed, 8.125);
	assert.ok(sameBody(back.body, worldBody({ earth: false, seed: old.seed, biome: old.type, origin: old.origin })));
});
