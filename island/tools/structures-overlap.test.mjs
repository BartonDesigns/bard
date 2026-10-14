// No building through another, through a street or into a landmark: the overlaps counted on
// the baked regions and a grown town before and after structures/overlap.js settles them, and
// the service alleys laid behind the shops clear of every building.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegion, clip, onLandmark } from './regions-node.mjs';
import { settleBoxes, countOverlaps, penetration, trimmed, resolveLots, routeRoads } from '../src/structures/overlap.js';
import { planAlleys } from '../src/structures/alleys.js';
import { generateTown } from '../src/crysis/civgen.js';

test('two boxes: overlap measured, a trim clears it', () => {
	const A = { x: 0, z: 0, w: 10, d: 10, a: 0 }, B = { x: 8, z: 1, w: 8, d: 6, a: 0.3 };
	assert.ok(penetration(A, B) > 0.5);
	assert.ok(penetration(A, { x: 20, z: 0, w: 4, d: 4, a: 1 }) < 0);
	const boxes = [A, B], res = settleBoxes(boxes, [], null, true);
	assert.equal(res.before.bb, 1);
	assert.equal(res.after.bb, 0);
	assert.equal(boxes.length, 2, 'trimmed, not dropped');
	assert.ok(B.w * B.d < 48 && A.w === 10, 'the smaller gave way');
	const t = trimmed({ x: 0, z: 0, w: 10, d: 4, a: 0 }, 0, 2);
	assert.deepEqual([t.x, t.w], [-1, 8]);
});

test('a building in a carriageway is cleared off it; a service passage is left', () => {
	const road = { cls: 'residential', w: 8, pts: new Float32Array([-50, 0, 50, 0]) };
	const lane = { cls: 'service', w: 4, pts: new Float32Array([0, -50, 0, 50]) };
	const house = { x: 15, z: 7, w: 10, d: 8, a: 0 }, hall = { x: 0, z: 30, w: 40, d: 20, a: 0 };
	const boxes = [house, hall], res = settleBoxes(boxes, [road, lane], null, true);
	assert.equal(res.before.br, 1);
	assert.equal(res.after.br, 0);
	assert.ok(house.z - house.d / 2 >= 4, 'off the street');
	assert.equal(hall.w, 40, 'the hall over its drive-through stands');
});

test('the surveyed regions: overlaps before and after', () => {
	for (const [name, cx, cz, R] of [['sausalito', 0, 0, 0], ['cupertino', 48800, 47700, 900], ['sanjose', 59800, 47600, 900]]) {
		const G0 = loadRegion(name), G = R ? clip(G0, cx, cz, R) : G0;
		const n = G.boxes.length;
		const res = settleBoxes(G.boxes, G.roads, onLandmark, true);
		console.log(`${name}: ${n} buildings; overlaps before ${JSON.stringify(res.before)} after ${JSON.stringify(res.after)}; ${res.trims} trimmed, ${res.drops} left out, ${res.ms} ms`);
		assert.ok(res.before.total > 0, 'the map has overlaps to settle');
		assert.equal(res.after.bb, 0, 'no building through another');
		assert.equal(res.after.br, 0, 'no building in a street');
		assert.equal(res.after.bl, 0, 'none on a landmark');
		assert.ok(res.drops < n * 0.04, 'few left out');
	}
});

test('a grown town has no building through another or a street, and alleys behind its shops', () => {
	const heightAt = (x, z) => 30 + Math.sin(x / 400) * 6 + Math.cos(z / 520) * 5;
	const T = generateTown({ seed: 77, cx: 0, cz: 0, radius: 1400, heightAt, style: 'suburb', name: 'Testville' });
	const c = countOverlaps(T.boxes, { roads: T.roads, min: 0.1 });
	console.log(`grown town: ${T.boxes.length} buildings, ${T.roads.filter((r) => r.alley).length} alleys; overlaps after ${JSON.stringify(c)}`);
	assert.equal(c.bb, 0);
	assert.equal(c.br, 0);
});

test('alleys on a surveyed downtown run clear of the buildings, with bins and back doors', () => {
	const G = clip(loadRegion('sanjose'), 59800, 47600, 1200);
	settleBoxes(G.boxes, G.roads, onLandmark, false);
	const al = planAlleys(G.boxes, G.roads);
	assert.ok(al.length > 0);
	const c = countOverlaps(G.boxes, { roads: al, min: 0.1 });
	assert.equal(c.br, 0, 'no building across an alley');
	for (const r of al) { assert.equal(r.cls, 'service'); assert.ok(r.alley.doors.length > 0); assert.ok(r.alley.open.some(Boolean), 'reaches a street'); }
	assert.ok(al.reduce((s, r) => s + r.alley.bins.length, 0) > 0);
});

test('the grid: lots through a freeway and through each other give way, the surveyed never move', () => {
	const toWorld = (lat, lon) => ({ x: lon * 1000, z: -lat * 1000 });
	const fwy = routeRoads([[[0, 0], [0.2, 0]]], toWorld, () => false, 34);
	const lot = (x, z, w, d, kind = 1, extra = {}) => ({ x, z, w, d, h: 6, a: 0, kind, y: 0, ...extra });
	const mapped = lot(100, 0, 20, 20, 3, { src: { kind: 5 } });
	const list = [lot(5, 0, 12, 10), lot(60, 40, 12, 10), lot(65, 42, 12, 10), lot(105, 3, 10, 10), mapped, lot(60, 60, 30, 30, 2), lot(60, 60, 12, 12, 2, { h: 40 }), { x: 0, z: 0, w: 50, d: 50, h: 0.3, a: 0, kind: 7 }];
	list.trees = [];
	const res = resolveLots(list, { roads: fwy });
	assert.equal(res.after.total, 0);
	assert.ok(list.includes(mapped) && mapped.x === 100, 'the surveyed stays');
	assert.ok(list.some((o) => o.h === 40), 'a crown on its tower stays');
	assert.ok(list.some((o) => o.kind === 7), 'the lawns stay');
	assert.ok(Array.isArray(list.trees), 'the list keeps its trees');
});
