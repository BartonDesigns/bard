// The buildings' damage, rebuilds and keeping: the shell of a damaged building (holes, collapse,
// rubble, the walls left to stop you), the game clock and the store (and a browser that will not
// store), the crews' schedule (the wait, the work, a cataclysm holding them off), and the grid's
// alleys behind a row of shops facing out from their block's yard.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildShell, rubbleAt } from '../src/structures/shell.js';
import { createStore } from '../src/structures/store.js';
import { createRebuild } from '../src/structures/rebuild.js';
import { planAlleys } from '../src/structures/alleys.js';
import { bid } from '../src/structures/ids.js';

const original = globalThis.localStorage;
afterEach(() => { if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original; });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const lot = (o = {}) => ({ x: 100, z: 50, w: 20, d: 14, h: 13.2, a: 0.3, y: 9, kind: 3, col: [0.7, 0.68, 0.64], roof: null, ...o });

test('a shell: a hole takes wall away, at the foot it is a way in; a collapse brings the top down onto rubble', () => {
	const o = lot();
	const whole = buildShell(o, { m: [], c: 0, s: 3 });
	const holed = buildShell(o, { m: [[0, 0, 1, 2]], c: 0, s: 3 });
	assert.ok(whole.verts > 0 && holed.verts !== whole.verts);
	// (the front's walls that stop you leave a gap where the hole reaches the ground)
	const front = (S) => S.solid.filter((b) => b[3] > o.d / 2 - 0.5);
	const span = (S) => front(S).reduce((s, b) => s + (b[2] - b[0]), 0);
	assert.ok(span(holed) < span(whole) - 1, 'a way in through the hole');
	assert.ok(rubbleAt(o, { m: [[0, 0, 1, 2]], s: 3 }, 0, o.d / 2 + 0.5) > 0, 'rubble under the hole');
	const down = buildShell(o, { m: [], c: 0.93, s: 3 });
	assert.ok(down.standing(0, o.d / 2) < 3.5, 'stubs of wall');
	assert.ok(down.rubble(0, 0) > 0.5, 'a mound where it stood');
	const part = buildShell(o, { m: [], c: 0.45, s: 3 });
	const H = o.h - 1.2, tops = [[-9, 6], [9, 6], [9, -6], [-9, -6]].map(([x, z]) => part.standing(x, z));
	assert.ok(Math.max(...tops) < H && Math.min(...tops) > 0.4, 'the top gone on a slant');
	// the rebuild: the rubble cleared first, the walls back by the end
	const rec = { m: [], c: 0.93, s: 3 };
	assert.equal(buildShell(o, rec, 0.2).rubble(0, 0), 0);
	assert.equal(buildShell(o, rec, 1).standing(0, o.d / 2), H);
	assert.ok(down.geo instanceof THREE.BufferGeometry && down.geo.attributes.color.count === down.verts);
});

test('the store: the clock goes on past midnight, records are kept, and a refusing browser is survived', () => {
	globalThis.localStorage = memory();
	const S = createStore();
	S.tick(23.5, 0.1); S.tick(0.25, 0.1); S.tick(1.0, 0.1);
	assert.ok(Math.abs(S.now() - 1.5) < 1e-6, 'unwrapped across midnight');
	S.tick(9, 0.1);
	assert.ok(Math.abs(S.now() - 1.5) < 1e-6, 'a jump is not time passing');
	S.put('b1:2', { x: 1, z: 2, m: [[0, 0, 1, 1]], c: 0 });
	S.save();
	const again = createStore();
	assert.deepEqual(again.get('b1:2').m, [[0, 0, 1, 1]]);
	assert.ok(Math.abs(again.now() - 1.5) < 1e-6);
	globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
	const blocked = createStore();
	blocked.put('x', { m: [] });
	assert.doesNotThrow(() => blocked.save());
	assert.equal(blocked.get('x').m.length, 0);
});

test('the crews: they come after a wait, take two to five hours, and wait out a cataclysm', () => {
	globalThis.localStorage = memory();
	const store = createStore(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	camera.position.set(1e6, 0, 1e6);
	const done = [];
	const R = createRebuild({ scene, isPhone: false, store, sounds: {}, city: () => null, ground: () => 0, repaired: (id) => done.push(id) });
	store.put('a', { x: 0, z: 0, m: [[0, 0, 1, 2]], c: 0.4, hp: 0.3, t0: 0, g: [] });
	store.put('g', { x: 9, z: 0, m: [], c: 0, hp: 1, t0: 0, g: [[0, 1, 1]] });
	const run = (h) => { store.advance(h); R.update(camera, 1); };
	run(0.1);
	assert.equal(R.progress(store.get('a')), null, 'not yet');
	run(0.3);
	const a = store.get('a');
	assert.ok(a.r0 != null && a.rd >= 2 && a.rd <= 5, `a building's rebuild is 2 to 5 hours (${a.rd})`);
	assert.ok(store.get('g').rd < 1.3, 'a pane is an hour');
	run(0.5);
	const p0 = R.progress(a);
	R.cataclysm(true);
	run(1); run(1);
	assert.ok(Math.abs(R.progress(a) - p0) < 1e-6, 'held while the cataclysm lasts');
	store.put('n', { x: 5, z: 5, m: [[1, 0, 1, 1]], c: 0, hp: 0.9, t0: store.now(), g: [] });
	run(1);
	assert.ok(store.get('n').r0 == null, 'nobody comes during it');
	R.cataclysm(false);
	run(0.1);
	assert.ok(store.get('n').r0 == null, 'a little after it is over');
	run(0.4);
	assert.ok(store.get('n').r0 != null);
	for (let i = 0; i < 12; i++) run(0.5);
	assert.ok(done.includes('a') && done.includes('g') && store.get('a') === null, 'put right and forgotten');
});

test('the grid: an alley behind a row of shops, their backs to the block yard', () => {
	const shops = [], yard = { x: 0, z: 0, w: 140, d: 70, a: 0, h: 0.98, kind: 4 };
	for (let i = 0; i < 6; i++) shops.push({ x: -45 + i * 16, z: -25, w: 15.5, d: 18, a: 0, h: 12, kind: 9 });
	const block = (b) => (Math.abs(b.x - yard.x) < yard.w / 2 && Math.abs(b.z - yard.z) < yard.d / 2 ? [yard.x, yard.z, yard.w / 2, yard.d / 2, 0] : null);
	const al = planAlleys(shops, null, { block });
	assert.equal(al.length, 1);
	const [, z0, , z1] = al[0].pts;
	assert.ok(z0 > -16 && z1 > -16, 'behind them, toward the yard');
	assert.equal(al[0].alley.doors.length, 6);
	assert.ok(al[0].alley.bins.length >= 3);
	assert.equal(bid({ x: 10.24, z: -3.76 }), 'b20:-8');
});
