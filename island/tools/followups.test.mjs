// The follow-ups pass: small engine-wide fixes (see HANDOFF.md, October 15, 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommercial } from '../src/bay/commercial.js';
import { gridHoleAt, h21, createPotholes } from '../src/bay/potholes.js';
import { BLOCKS, fromGrid } from '../src/bay/styles.js';
import * as THREE from 'three';
import { setTier, peopleCap } from '../src/world/governor.js';
import { createEconomyLayer } from '../src/economy/layer.js';
import { coastScan, coastClass } from '../src/economy/frontage.js';

// bay/commercial.js: a wrecked shop is let go and not built whole again until it is put right
test('commercial builder skips and drops wrecked shops', () => {
	const grp = [], b = { x: 12, z: 0, w: 14, d: 12, a: 0, wallH: 4.5, kind: 5, h: 4.5 };
	grp.push(b); b.grp = grp; grp.biz = true;
	const C = createCommercial({ add() {} }, { heightAt: () => 0 }, null, { procBiz: () => [b], setNear() {} }, {});
	const cam = { position: { x: 0, y: 2, z: 0 } };
	for (let i = 0; i < 3; i++) C.update(cam, 1, 12, 0);
	assert.equal(C.group.children.length, 1, 'built whole near you');
	grp.wrecked = true;
	for (let i = 0; i < 3; i++) C.update(cam, 1, 12, 0);
	assert.equal(C.group.children.length, 0, 'let go once wrecked, and not built again');
	grp.wrecked = false;
	for (let i = 0; i < 3; i++) C.update(cam, 1, 12, 0);
	assert.equal(C.group.children.length, 1, 'built again once put right');
});

// bay/potholes.js: the procedural grid's holes, the same sums as the ground shader's
test('grid holes: the shader hash, in the wheel paths, about one chance in each 5 m of lane', () => {
	for (const [x, y] of [[0, 0], [12.5, 3], [4095.5, 7], [-3, 900.25]]) { const v = h21(x, y); assert.ok(v >= 0 && v < 1); }
	assert.equal(h21(1, 2), h21(1 + 4096, 2), 'wrapped at 4096 like mod()');
	const a = 0.3, sty = 2, [BX, BZ, ST] = BLOCKS[sty];
	let holes = 0, lane = 0;
	const seen = new Set();
	// down each wheel path of 20 streets, 2 km each
	for (let j = 0; j < 20; j++) for (const off of [-2.65, -0.95, 0.95, 2.65]) {
		lane += 2000;
		for (let s = 0; s < 2000; s += 0.25) {
			const [x, z] = fromGrid(10 + s, ST * 0.5 + off + (40 + j) * BZ, a, sty), h = gridHoleAt(x, z, a, sty);
			if (h && !seen.has(h.id)) { seen.add(h.id); holes++; assert.ok(h.r >= 0.2 && h.r <= 0.45 && h.d > 0.03 && h.d < 0.08); }
		}
	}
	const per5 = holes / (lane / 5);
	assert.ok(per5 > 0.02 && per5 < 0.2, `holes per 5 m of lane ${per5}`);
	// none in the middle of a block
	for (let k = 0; k < 200; k++) { const [x, z] = fromGrid(ST + 5 + k * 0.4, ST + 20, a, sty); assert.equal(gridHoleAt(x, z, a, sty), null); }
	assert.ok(BX > ST);
});

test('grid holes bump the car, and only where the grid is', () => {
	const a = 0.3, sty = 2, ST = BLOCKS[sty][2];
	// a hole in the near wheel path
	let at = null;
	for (let s = 0; s < 5000 && at == null; s += 0.1) { const [x, z] = fromGrid(s, ST * 0.5 - 0.95, a, sty), h = gridHoleAt(x, z, a, sty); if (h && h.gap < -0.15) at = s; }
	assert.ok(at != null, 'a hole on the street');
	const car = { x: 0, z: 0, speed: 12 };
	const drive = (P) => {
		// along grid +x, the wheels 0.78 m either side of the centre: one side or the other runs through it
		for (const side of [0.78, -0.78]) for (let s = at - 8; s < at + 8; s += 0.2) {
			const [x, z] = fromGrid(s, ST * 0.5 - 0.95 + side, a, sty);
			car.x = x; car.z = z;
			P.update(0.016);
		}
		return P.info();
	};
	const base = { real: { near: () => [] }, eraOf: () => null, carAt: () => car, physics: () => null, camera: { position: { y: 0 } } };
	const I = drive(createPotholes({ ...base, grid: () => ({ a, s: sty }) }));
	assert.ok(I.gridHits >= 1, `hits ${JSON.stringify(I)}`);
	assert.equal(drive(createPotholes({ ...base, grid: () => null })).gridHits, 0);
});

// world/governor.js peopleCap: the tier's people share
test('people caps keep the whole crowd on every quality tier', () => {
	for (let t = 0; t < 4; t++) { setTier(t); assert.equal(peopleCap(14, 3), 14); }
	assert.equal(peopleCap(2, 3), 2, 'nor more than asked');
	setTier(0);
});

// economy/layer.js: the globe's own sea test (setSea) finds a coast town's harbour trades where
// the globe's relief stands its waterfront up as a bluff (Eureka: 200 m up, the sea 0.5 to 2 km off)
test('the coast on the globe: read through its own sea test and land mask', () => {
	// a bluff town: the sea west of x = 0, the ground at 200 m from x = 300 on
	const H = (x) => (x < 0 ? -5 : x < 300 ? x * 0.66 : 200);
	assert.equal(coastScan(H, 800, 0, 0.5).dist, Infinity, 'high ground is never by the water, as before');
	const S = coastScan(H, 800, 0, 0.5, [150, 300, 500, 800, 1200, 1750, 2500, 4000], Infinity);
	assert.equal(S.dist, 800);
	assert.equal(coastClass(S, 2.5), 2, 'by the harbour, read generously');
	assert.equal(coastClass(S), 1);
	const KIND = { row: 3, house: 1, houseGarageL: 12, houseGarageR: 13, shop: 4, retail: 6, office: 5, tower: 11, industry: 9, apt: 8 };
	const build = (sea) => {
		const E = createEconomyLayer({ group: new THREE.Group(), bay: { heightAt: (x) => H(x), loaded: () => false, urbanAt: () => ({ u: 0.5, d: 0 }) }, KIND });
		if (sea) E.setSea(sea);
		const list = [];
		for (let i = 0; i < 30; i++) for (let j = 0; j < 12; j++) { const x = 450 + i * 40, z = j * 40 - 240; list.push({ x, z, w: 10, d: 12, a: 0, h: 6, src: { kind: 0, gen: true, core: 0.7, street: 'residential', x, z, w: 10, d: 12, wallH: 6 } }); }
		E.apply(list, 900, 0);
		return E.info(900, 0, 2000, list);
	};
	const before = build(null), after = build({ at: (x) => x < 0, coast: (x) => Math.min(0.5, Math.max(0, x / 8000)) });
	assert.equal(before.harbour, 0);
	assert.ok(after.harbour >= 3, `harbour trades by the bluff: ${after.harbour} (${JSON.stringify(after.types)})`);
});
