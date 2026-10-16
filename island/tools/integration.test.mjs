// Where the systems meet (October 15): the procedural grid towns' streets named and signed like
// the mapped city's (signage/gridstreets.js through placement.js streetSigns), the storefronts'
// decals on their own display glass at their own door, a dark van's livery and the military's
// stencils in the faces, the rebuild crews' patch job for walls broken and nothing else, a base
// far off sited when the trouble needs it, and the index laid on the receiver at the carry.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { gridStreets, gridName, ordinal } from '../src/signage/gridstreets.js';
import { streetSigns, storefrontDecals, MAT } from '../src/signage/placement.js';
import { SYSTEMS } from '../src/signage/systems.js';
import { FACE_KINDS } from '../src/signage/faces.js';
import { BLOCKS, toGrid, fromGrid, STYLE } from '../src/bay/styles.js';
import { planDispatch, FORCES, siteScore, baseLayout } from '../src/military/rules.js';

// a town on the grid of the older towns (no warp), bearing 0, everywhere east of x = -2000
const town = (inside = () => false) => ({ urbanAt: (x) => (x > -2000 ? { u: 0.6, a: 0, s: STYLE.older, d: 0.1 } : { u: 0, a: 0, s: 0 }), inside, BLOCKS, toGrid, fromGrid });

test('ordinals and grid names: numbered avenues, named streets, a boulevard every seventh line', () => {
	assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st']);
	assert.equal(gridName('z', 7).cls, 'secondary');
	assert.match(gridName('z', 7).name, / Blvd$/);
	assert.match(gridName('z', 3).name, /^\d+(st|nd|rd|th) Ave$/);
	assert.match(gridName('x', 2).name, / St$/);
	assert.equal(gridName('x', 4).cls, 'tertiary');
	assert.equal(gridName('x', 5).cls, 'residential');
	// (the same line, the same name, every time)
	assert.deepEqual(gridName('x', 9, 123), gridName('x', 9, 123));
});

test('the grid town\'s streets cross at shared points and get stop signs and street-name blades', () => {
	const roads = gridStreets(0, 0, 300, town());
	assert.ok(roads.length > 8, 'streets both ways');
	for (const r of roads) { assert.ok(r.drive && r.name && r.pts.length >= 6); assert.equal(r.w, BLOCKS[STYLE.older][2]); }
	const S = streetSigns(roads, SYSTEMS.us, { seed: 7 });
	assert.ok(S.junctions.length > 6, 'junctions found where the streets cross');
	const kinds = new Set(S.signs.map((r) => r.face.k));
	assert.ok(kinds.has('blade'), 'street-name blades');
	assert.ok(kinds.has('stop'), 'stop signs on the minor legs');
	// (every blade carries one of the grid's own names)
	const names = new Set(roads.map((r) => r.name));
	for (const r of S.signs.filter((q) => q.face.k === 'blade')) assert.ok([...names].some((n) => n.startsWith(r.face.name.replace(/\.$/, '').split(' ')[0])));
	// (nothing where the real map covers the ground)
	assert.equal(gridStreets(0, 0, 300, town(() => true)).length, 0);
	assert.equal(gridStreets(-5000, 0, 300, town()).length, 0);
});

test('a storefront\'s decals sit on its own glass, about its own door', () => {
	const front = { x: 10, z: 5, nx: 0, nz: 1, run: 5.2, g: 1.5, door: -1.1 };
	const recs = storefrontDecals({ name: 'Harbour Grocery', type: 'grocer', use: 'shop', x: 10, z: 0 }, front, SYSTEMS.us, { seed: 3, glass: true });
	assert.ok(recs.length >= 4);
	for (const r of recs) {
		assert.ok(Math.abs((r.x - front.x) * front.nx + (r.z - front.z) * front.nz) < 1e-9, 'on the glass plane');
		assert.ok(Math.abs((r.x - front.x) * front.nz - (r.z - front.z) * front.nx) < front.run / 2 + 0.01, 'within the glazing');
		assert.equal(r.base, front.g);
	}
	const hours = recs.find((r) => r.face.k === 'hours'), push = recs.find((r) => r.face.k === 'pushpull');
	assert.equal(hours.mat, MAT.glass);
	assert.ok(Math.abs((push.x - front.x) * front.nz - (push.z - front.z) * front.nx - front.door) < 0.4, 'push or pull at the door');
});

test('the faces: livery for a dark van and stencils for the military are drawn kinds', () => {
	assert.ok(FACE_KINDS.includes('livery'));
	// (the faces are drawn into a 2D context; a recording one says what each wrote)
	const calls = [];
	const g = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 40 }) : typeof k === 'string' ? (...a) => { calls.push([k, ...a]); return undefined; } : undefined), set: () => true });
	return import('../src/signage/faces.js').then(({ drawFace }) => {
		for (const f of [{ k: 'livery', svc: 'swat', word: 'POLICE', sub: 'TACTICAL UNIT' }, { k: 'livery', svc: 'van' }, { k: 'livery', svc: 'stencil', word: 'A-12' }, { k: 'livery', svc: 'stencil', mark: 'guard' }, { k: 'livery', svc: 'stencil', mark: 'ironvale' }]) {
			calls.length = 0;
			drawFace(g, 0, 0, 240, 50, f);
			assert.ok(calls.some((c) => c[0] === 'fillText' || c[0] === 'fill' || c[0] === 'stroke'), JSON.stringify(f));
		}
		calls.length = 0;
		drawFace(g, 0, 0, 240, 50, { k: 'livery', svc: 'swat' });
		assert.ok(calls.some((c) => c[0] === 'fillText' && c[1] === 'POLICE'));
	});
});

test('a boss far from any sited base: the dispatch answers once the base waiting within reach is sited', () => {
	const e = { kind: 'boss', x: 0, z: 0, severity: 2, t: 0 };
	// (sited only near you: none within reach, no answer)
	assert.equal(planDispatch(e, []), null);
	const base = { id: 'b', name: 'Diablo Flats Depot', x: 18000, z: 6000, units: { tank: 2, apc: 4, jeep: 4, heli: 2, jet: 1 }, busyUntil: 0 };
	assert.ok(Math.hypot(base.x, base.z) < FORCES.boss.reach);
	const plan = planDispatch(e, [base]);
	assert.ok(plan && plan.mode === 'road' && plan.units.includes('tank'));
});

test('the rebuild crews come to patch a wall that is broken and nothing else, then put it right', async () => {
	globalThis.localStorage ||= { getItem: () => null, setItem() {}, removeItem() {} };
	const { createRebuild } = await import('../src/structures/rebuild.js');
	const { createStore } = await import('../src/structures/store.js');
	const store = createStore(), repaired = [];
	let damaged = [{ id: 'h1', walls: ['0:x:1:2:3'], t: 0 }];
	const walls = { damaged: () => damaged, repair: (id) => { repaired.push(id); damaged = damaged.filter((d) => d.id !== id); return 1; }, sources: new Map([['k', { id: 'h1', anchor: { x: 400, z: 400 } }]]) };
	const R = createRebuild({ scene: new THREE.Scene(), isPhone: true, store, sounds: {}, city: () => null, real: () => null, ground: () => 0, walls: () => walls });
	const cam = { position: new THREE.Vector3(0, 2, 0) };
	let hours = 10;
	const tick = (h) => { hours += h; store.tick(hours, 4); R.update(cam, 0.6, 0); };
	tick(0.01);
	assert.equal(R.patches.size, 1, 'a patch job for it');
	const P = R.patches.get('h1');
	assert.ok(P.patch && P.x === 400 && P.r0 == null);
	for (let i = 0; i < 6; i++) tick(0.05);
	assert.ok(P.r0 != null, 'the crew starts within a quarter hour or so');
	assert.ok(P.rd >= 0.5 && P.rd <= 1, 'half an hour to an hour');
	// (you standing in the room: they wait)
	cam.position.set(402, 2, 401);
	for (let i = 0; i < 30; i++) tick(0.05);
	assert.equal(repaired.length, 0);
	cam.position.set(0, 2, 0);
	for (let i = 0; i < 4; i++) tick(0.05);
	assert.deepEqual(repaired, ['h1']);
	assert.equal(R.patches.size, 0);
	// (a building the full crew is coming for gets no patch of its own)
	damaged = [{ id: 'h2', walls: ['k'], t: 0 }];
	walls.sources.set('k2', { id: 'h2', anchor: { x: 10, z: 10 } });
	store.put('h2', { x: 10, z: 10, m: [[1]], c: 0, g: [], t0: store.now() });
	tick(0.01);
	assert.equal(R.patches.size, 0);
});

test('a surveyed base inside a town\'s reach still sites on open ground; homes on it still stop it', () => {
	const L = baseLayout('garrison', 7);
	const flat = { height: () => 12, water: () => false, urban: () => 1, built: () => 0, road: () => 200 };
	assert.equal(siteScore(flat, 0, 0, 0, L.W, L.D).why, 'town');
	assert.ok(siteScore(flat, 0, 0, 0, L.W, L.D, { townMax: 1.01 }).ok);
	assert.equal(siteScore({ ...flat, built: () => 12 }, 0, 0, 0, L.W, L.D, { townMax: 1.01 }).why, 'homes');
});
