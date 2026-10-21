// The Bay's ground grids drawn as a middle and wedges, each left out when out of the view
// (world/gridwedges.js): every triangle drawn once, a wedge never left out while any of it could
// be on screen at any height the ground can be lifted to, and a phone's usual view drawing a
// third or less of the grids.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { radialGrid, ringGrid } from '../src/world/terrain.js';
import { splitGrid, hull2, boundHull, hullOut, wedgeMeshes } from '../src/world/gridwedges.js';

const Y = [-1300, 2600];
const grids = () => [[radialGrid(64, 4000, 3), 64], [ringGrid(64, 3500, 95000, 10), 3500]];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function frustumOf(x, y, z, yaw, pitch, aspect = 1170 / 2532) {
	const cam = new THREE.PerspectiveCamera(70, aspect, 0.25, 110000);
	cam.position.set(x, y, z); cam.rotation.order = 'YXZ'; cam.rotation.set(pitch, yaw, 0);
	cam.updateMatrixWorld();
	return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
}

test('the pieces hold every triangle of the grid exactly once', () => {
	for (const [g, mid] of grids()) {
		const parts = splitGrid(g, 8, mid), seen = new Map(), I = g.index.array;
		const key = (a, b, c) => a + ',' + b + ',' + c;
		for (let t = 0; t < I.length; t += 3) seen.set(key(I[t], I[t + 1], I[t + 2]), 0);
		for (const S of parts) for (let t = 0; t < S.index.length; t += 3) { const k = key(S.index[t], S.index[t + 1], S.index[t + 2]); assert.ok(seen.has(k)); seen.set(k, seen.get(k) + 1); }
		for (const v of seen.values()) assert.equal(v, 1);
		assert.equal(parts.filter((S) => S.mid).length, 1);
		assert.equal(parts.length, 9);
	}
});

test('a hull, and the few-cornered polygon round it, hold every vertex of their piece', () => {
	const pts = []; for (let i = 0; i < 400; i++) pts.push(rnd() * 100 - 50, rnd() * 60 - 30);
	const h = hull2(pts), b = boundHull(h, 8);
	const inside = (P, x, z) => { for (let k = 0; k < P.length; k += 2) { const j = (k + 2) % P.length; if ((P[j] - P[k]) * (z - P[k + 1]) - (P[j + 1] - P[k + 1]) * (x - P[k]) < -1e-6) return false; } return true; };
	for (let k = 0; k < pts.length; k += 2) { assert.ok(inside(h, pts[k], pts[k + 1])); assert.ok(inside(b, pts[k], pts[k + 1])); }
	for (const [g, mid] of grids()) {
		const P = g.attributes.position.array;
		for (const S of splitGrid(g, 8, mid)) for (const v of S.index) assert.ok(inside(S.hull, P[v * 3], P[v * 3 + 2]), 'vertex inside its hull');
	}
});

test('a wedge is never left out while any of it could be in view', () => {
	for (const [g, mid] of grids()) {
		const P = g.attributes.position.array, parts = splitGrid(g, 8, mid);
		let out = 0;
		for (let n = 0; n < 300; n++) {
			const ox = (rnd() - 0.5) * 64, oz = (rnd() - 0.5) * 64;
			const F = frustumOf(ox + (rnd() - 0.5) * 40, rnd() < 0.7 ? 1 + rnd() * 30 : rnd() * 2500, oz + (rnd() - 0.5) * 40, rnd() * 6.283, (rnd() - 0.7) * 2.6);
			for (const S of parts) {
				if (S.mid || !hullOut(S.hull, ox, oz, Y[0], Y[1], F.planes)) continue;
				// left out: no point of its triangles, at any height, is in the view
				out++;
				const I = S.index, q = new THREE.Vector3();
				for (let t = 0; t < I.length; t += 3 * 7) {
					const a = I[t], b = I[t + 1], c = I[t + 2];
					for (const [wa, wb] of [[1, 0], [0, 1], [0, 0], [1 / 3, 1 / 3], [0.5, 0.5]]) {
						const wc = 1 - wa - wb, x = P[a * 3] * wa + P[b * 3] * wb + P[c * 3] * wc, z = P[a * 3 + 2] * wa + P[b * 3 + 2] * wb + P[c * 3 + 2] * wc;
						for (const y of [Y[0], Y[0] + 10, 0, 300, 1500, Y[1]]) assert.ok(!F.containsPoint(q.set(x + ox, y, z + oz)), 'a left-out wedge had a point in view');
					}
				}
			}
		}
		assert.ok(out > 600, `wedges left out: ${out}`);
	}
});

test('a phone looking out across the Bay draws a third or less of each grid', () => {
	const near = radialGrid(320, 4000, 3), far = ringGrid(256, 3500, 95000, 10), all = (g) => g.index.count / 3;
	const W = { near: wedgeMeshes(near, null, { mid: 64, y: Y }), far: wedgeMeshes(far, null, { mid: 3500, y: Y }) };
	for (const [h, pitch] of [[2, 0], [2, -0.35], [60, -0.17], [300, -0.35]]) {
		const drawn = { near: 0, far: 0 };
		let N = 0;
		for (let yaw = 0; yaw < 6.28; yaw += 0.2) {
			const F = frustumOf(5, h, -9, yaw, pitch);
			for (const k of ['near', 'far']) for (const m of W[k].meshes) { m.updateMatrixWorld(); if (!m.frustumCulled || m.intersectsFrustum(F)) drawn[k] += m.geometry.index.count / 3; }
			N++;
		}
		assert.ok(drawn.near / N < all(near) / 2.5, `near ring at ${h} m, pitch ${pitch}: ${Math.round(drawn.near / N)} of ${all(near)}`);
		assert.ok(drawn.far / N < all(far) / 3, `far ring at ${h} m, pitch ${pitch}: ${Math.round(drawn.far / N)} of ${all(far)}`);
	}
});

test('a wedge moved, turned or scaled by its parents is drawn rather than wrongly left out', () => {
	const W = wedgeMeshes(radialGrid(32, 4000, 3), null, { mid: 64, y: Y }), root = new THREE.Group();
	root.add(W.root);
	const F = frustumOf(0, 2, 0, 0, 0);
	W.root.position.set(100000, 0, 0); root.updateMatrixWorld(true);
	assert.ok(W.meshes.every((m) => !m.frustumCulled || !m.intersectsFrustum(F)), 'moved far away: all out');
	W.root.position.set(0, 0, 0); W.root.rotation.y = 0.3; root.updateMatrixWorld(true);
	assert.ok(W.meshes.every((m) => !m.frustumCulled || m.intersectsFrustum(F)), 'turned: all drawn');
});
