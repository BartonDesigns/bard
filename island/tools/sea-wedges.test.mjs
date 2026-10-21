// The sea's grid drawn in wedges too (world/ocean.js, world/gridwedges.js): its shader centres
// the grid on a uniform of its own and its waves move each vertex sideways and up and down, so a
// wedge is tested grown by that much. A wedge left out never has a point in view however the
// waves move it, and the globe's rings (lifted only) are split the same way.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { radialGrid, ringGrid } from '../src/world/terrain.js';
import { polysApart, hull2, wedgeMeshes } from '../src/world/gridwedges.js';

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function cameraAt(x, y, z, yaw, pitch, aspect = 1170 / 2532) {
	const cam = new THREE.PerspectiveCamera(70, aspect, 0.25, 110000);
	cam.position.set(x, y, z); cam.rotation.order = 'YXZ'; cam.rotation.set(pitch, yaw, 0);
	cam.updateMatrixWorld();
	return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
}
const inside = (P, x, z) => { for (let k = 0; k < P.length; k += 2) { const j = (k + 2) % P.length; if ((P[j] - P[k]) * (z - P[k + 1]) - (P[j + 1] - P[k + 1]) * (x - P[k]) < -1e-9) return false; } return true; };
const blob = (cx, cz, r) => { const p = []; for (let i = 0; i < 9; i++) { const a = rnd() * 6.283, d = rnd() * r; p.push(cx + Math.cos(a) * d, cz + Math.sin(a) * d); } return hull2(p); };

test('two polygons apart with a pad are apart wherever A is moved within the pad', () => {
	let apart = 0;
	for (let n = 0; n < 3000; n++) {
		const A = blob(0, 0, 10), B = blob((rnd() - 0.5) * 50, (rnd() - 0.5) * 50, 10), pad = rnd() * 6;
		if (!polysApart(A, 0, 0, B, pad)) continue;
		apart++;
		assert.ok(polysApart(A, 0, 0, B, 0), 'apart with a pad, so apart without');
		for (let k = 0; k < 60; k++) {
			const i = Math.floor(rnd() * A.length / 2), j = (i + 1) % (A.length / 2), t = rnd();
			const x = A[i * 2] + (A[j * 2] - A[i * 2]) * t + (rnd() * 2 - 1) * pad, z = A[i * 2 + 1] + (A[j * 2 + 1] - A[i * 2 + 1]) * t + (rnd() * 2 - 1) * pad;
			assert.ok(!inside(B, x, z), 'a moved point of A inside B');
		}
	}
	assert.ok(apart > 500, `pairs apart: ${apart}`);
});

test('a sea wedge left out has no point in view, the waves moving it any way they can', () => {
	const g = radialGrid(96, 70000, 3.3), P = g.attributes.position.array, at = new THREE.Vector2();
	const wave = { v: 1 }, reach = () => wave.v;
	const y = () => [-(3 * reach() + 2), 3 * reach() + 4], pad = () => 2.5 * reach() + 1;
	const W = wedgeMeshes(g, null, { mid: 64, y, pad, at });
	let out = 0;
	const q = new THREE.Vector3();
	for (let n = 0; n < 120; n++) {
		wave.v = rnd() * 2;
		const cx = (rnd() - 0.5) * 20000, cz = (rnd() - 0.5) * 20000;
		at.set(Math.round(cx / 8) * 8, Math.round(cz / 8) * 8);
		const F = cameraAt(cx + (rnd() - 0.5) * 8, rnd() < 0.8 ? 0.5 + rnd() * 6 : rnd() * 400, cz + (rnd() - 0.5) * 8, rnd() * 6.283, (rnd() - 0.65) * 2.4);
		const Y = y(), p = pad();
		for (const m of W.meshes) {
			m.updateMatrixWorld();
			if (!m.frustumCulled || m.intersectsFrustum(F)) continue;
			out++;
			const I = m.geometry.index.array;
			for (let t = 0; t < I.length; t += 3 * 11) {
				const a = I[t], b = I[t + 1], c = I[t + 2];
				for (const [wa, wb] of [[1, 0], [0, 1], [0, 0], [1 / 3, 1 / 3]]) {
					const wc = 1 - wa - wb, x = P[a * 3] * wa + P[b * 3] * wb + P[c * 3] * wc + at.x, z = P[a * 3 + 2] * wa + P[b * 3 + 2] * wb + P[c * 3 + 2] * wc + at.y;
					for (const [dx, dz] of [[0, 0], [p, p], [-p, p], [p, -p], [-p, -p], [p, 0], [0, -p]]) for (const yy of [Y[0], 0, Y[1]]) assert.ok(!F.containsPoint(q.set(x + dx, yy, z + dz)), 'a left-out sea wedge had a point in view');
				}
			}
		}
	}
	assert.ok(out > 400, `wedges left out: ${out}`);
});

test('a phone at sea level draws well under half the sea and the globe rings', () => {
	const Yg = [-12000, 12000], at = new THREE.Vector2();
	const grids = {
		sea: wedgeMeshes(radialGrid(300, 70000, 3.3), null, { mid: 64, y: [-5, 7], pad: 3.5, at }),
		near: wedgeMeshes(radialGrid(160, 6000, 2.2), null, { mid: 64, y: Yg }),
		far: wedgeMeshes(ringGrid(160, 5000, 250000), null, { mid: 5000, y: Yg }),
	};
	for (const [k, W] of Object.entries(grids)) {
		const all = W.meshes.reduce((n, m) => n + m.geometry.index.count / 3, 0);
		let drawn = 0, N = 0;
		for (let yaw = 0; yaw < 6.28; yaw += 0.2) {
			const F = cameraAt(3, 2, -7, yaw, -0.1);
			for (const m of W.meshes) { m.updateMatrixWorld(); if (!m.frustumCulled || m.intersectsFrustum(F)) drawn += m.geometry.index.count / 3; }
			N++;
		}
		assert.ok(drawn / N < all * 0.5, `${k}: ${Math.round(drawn / N)} of ${all} drawn`);
	}
});
