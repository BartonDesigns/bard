import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGridStreets } from '../src/bay/gridstreets.js';
import { createTownStreets } from '../src/earth/townstreets.js';
import { BLOCKS, STYLE, toGrid } from '../src/bay/styles.js';

// a gridded town of the older style 1.5 km across round (0, 0) on level dry ground
function bayOf({ r = 1500, style = STYLE.older, a = 0 } = {}) {
	return {
		urbanAt: (x, z) => ({ u: Math.hypot(x, z) < r ? 0.8 : 0, s: style, a, d: 0.3 }),
		heightAt: () => 20,
	};
}
const cam = (x = 0, z = 0) => ({ position: new THREE.Vector3(x, 300, z), fov: 60 });

test('a gridded town past the Bay gets a street down every grid line between its blocks', () => {
	const grid = createGridStreets({ bay: bayOf(), inWater: () => false });
	grid.settle(cam());
	const roads = grid.near(0, 0, 3000);
	assert.ok(roads.length > 100, `streets laid out (${roads.length})`);
	const [BX, BZ, ST] = BLOCKS[STYLE.older];
	for (const r of roads) {
		assert.equal(r.w, ST);
		assert.ok(r.walked && r.drive && r.grid);
		// each street runs one block, crossing to crossing, along a grid line (its centre ST/2 past it)
		const n = r.pts.length;
		const [gx0, gz0] = toGrid(r.pts[0], r.pts[1], 0, STYLE.older), [gx1, gz1] = toGrid(r.pts[n - 2], r.pts[n - 1], 0, STYLE.older);
		const along = Math.abs(gx1 - gx0) < 0.01 ? 'z' : 'x';
		if (along === 'z') { assert.ok(Math.abs(((gx0 - ST / 2) % BX + BX) % BX) < 0.01); assert.ok(Math.abs(Math.abs(gz1 - gz0) - BZ) < 0.01); }
		else { assert.ok(Math.abs(((gz0 - ST / 2) % BZ + BZ) % BZ) < 0.01); assert.ok(Math.abs(Math.abs(gx1 - gx0) - BX) < 0.01); }
	}
	// none out in the fields: every street borders a block of the town
	for (const r of roads) assert.ok(Math.hypot(r.pts[0], r.pts[1]) < 1500 + 250);
	// named as the signs name them, some of them boulevards and collectors
	assert.ok(roads.every((r) => r.name && r.cls));
	assert.ok(new Set(roads.map((r) => r.cls)).size >= 2);
});

test('grid streets are left to the ground that paints them, and to the water', () => {
	const all = createGridStreets({ bay: bayOf(), inWater: () => false });
	all.settle(cam());
	const n = all.near(0, 0, 3000).length;
	const half = createGridStreets({ bay: bayOf(), inWater: () => false, painted: (x) => x < 0 });
	half.settle(cam());
	const h = half.near(0, 0, 3000);
	assert.ok(h.length < n * 0.7 && h.length > n * 0.3, `${h.length} of ${n}`);
	assert.ok(h.every((r) => (r.pts[r.pts.length >> 1 & ~1]) >= -1));
	const wet = createGridStreets({ bay: bayOf(), inWater: (x, z) => z > 200 });
	wet.settle(cam());
	assert.ok(wet.near(0, 0, 3000).every((r) => { for (let k = 1; k < r.pts.length; k += 2) if (r.pts[k] > 200) return false; return true; }));
});

test('a town\'s streets for the highways stay the same list till its tiles change', () => {
	const grid = createGridStreets({ bay: bayOf(), inWater: () => false });
	const t = { x: 0, z: 0, r: 1500 };
	assert.equal(grid.townRoads(t, 1800).length, 0, 'nothing before its tiles are laid out');
	grid.settle(cam());
	const a = grid.townRoads(t, 1800), b = grid.townRoads(t, 1800);
	assert.ok(a.length > 50);
	assert.equal(a, b);
	const v = grid.version();
	grid.clear();
	assert.ok(grid.version() > v);
});

test('town streets are drawn as asphalt over sidewalks, skipped where the ground paints them', () => {
	const scene = new THREE.Scene();
	const grid = createGridStreets({ bay: bayOf(), inWater: () => false });
	grid.settle(cam());
	const streets = createTownStreets({ scene, groundAt: () => 20 });
	const sets = grid.sets();
	assert.ok(sets.length > 0);
	streets.settle(sets);
	const I = streets.info();
	assert.equal(I.sets, 0, 'counted on update');
	streets.update(cam(), true, sets);
	assert.equal(streets.info().sets, sets.length);
	assert.ok(streets.info().verts > 1000);
	const meshes = streets.group.children;
	assert.ok(meshes.some((m) => m.renderOrder === 0) && meshes.some((m) => m.renderOrder === 1), 'an under and an over layer');
	// a grown town's set: streets, a cul-de-sac, drives, a forecourt; and a footway
	const town = { key: 'town', x: 0, z: 0, roads: [
		{ cls: 'residential', w: 10, pts: new Float32Array([0, 0, 100, 0]), end1: true },
		{ cls: 'motorway', w: 14, pts: new Float32Array([0, 50, 400, 50]) },
		{ cls: 'footway', w: 2, pts: new Float32Array([0, 80, 60, 80]) },
		{ cls: 'path', w: 2, pts: new Float32Array([0, 90, 60, 90]) },
	], paths: [{ ax: 50, az: 6, bx: 50, bz: 20, w: 3 }], ground: [[10, 30, 40, 30, 8, 1], [10, 30, 40, 30, 4, 0], [10, 30, 40, 30, 0.2, 2]] };
	const before = streets.info().verts;
	streets.update(cam(), true, [...sets, town]);
	streets.settle([...sets, town]);
	streets.update(cam(), true, [...sets, town]);
	assert.ok(streets.info().verts > before);
	// let go: the town's meshes go with it
	streets.update(cam(), true, sets);
	assert.equal(streets.info().verts, before);
	// all painted: nothing drawn
	const s2 = createTownStreets({ scene, groundAt: () => 20, painted: () => true });
	s2.settle([town]);
	s2.update(cam(), true, [town]);
	assert.equal(s2.info().verts, 0);
	streets.dispose(); s2.dispose();
});
