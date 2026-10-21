// The street lamps in two levels (world/nearfirst.js, bay/streetlife.js): the full copy written
// nearest first, the view drawing only those that can be inside the dissolve band of its camera,
// the sun's pass only those its box can reach, and the count coming back after each.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { copyNearestFirst, upTo, nearFirst } from '../src/world/nearfirst.js';

let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function lampsAround(n, R) {
	const far = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), n), m = new THREE.Matrix4();
	for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R; far.setMatrixAt(i, m.makeRotationY(rnd() * 6).setPosition(Math.cos(a) * r, rnd() * 20, Math.sin(a) * r)); }
	far.count = n;
	return far;
}
function sun(px, pz, el, az) {
	const L = new THREE.DirectionalLight(0xffffff, 1), sc = L.shadow.camera;
	sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
	L.target.position.set(px, 0, pz); L.position.set(px + Math.cos(el) * Math.cos(az) * 200, Math.sin(el) * 200, pz + Math.cos(el) * Math.sin(az) * 200);
	L.updateMatrixWorld(); L.target.updateMatrixWorld(); L.shadow.updateMatrices(L);
	return sc;
}

test('copied nearest first, with their distances in order', () => {
	const far = lampsAround(500, 380), dst = new Float32Array(500 * 16), dist = new Float32Array(500);
	assert.equal(copyNearestFirst(far.instanceMatrix.array, 500, dst, dist, 30, -20), 500);
	const was = new Set(), now = new Set();
	for (let i = 0; i < 500; i++) { was.add(far.instanceMatrix.array.slice(i * 16, i * 16 + 16).join()); now.add(dst.slice(i * 16, i * 16 + 16).join()); }
	assert.deepEqual(now, was);
	for (let k = 0; k < 500; k++) {
		assert.ok(Math.abs(Math.hypot(dst[k * 16 + 12] - 30, dst[k * 16 + 14] + 20) - dist[k]) < 1e-3);
		if (k) assert.ok(dist[k] >= dist[k - 1]);
	}
	assert.equal(upTo(dist, 500, -1), 0); assert.equal(upTo(dist, 500, 1e9), 500);
	assert.equal(upTo(dist, 500, dist[100]), 101 + [...dist.slice(101)].filter((d) => d === dist[100]).length);
});

test('the view draws every full lamp inside the band, the sun every one in its box, and the count comes back', () => {
	const band = [70, 90], half = 2.1, far = lampsAround(900, 380);
	const near = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 900);
	const L = nearFirst(near, far, { band, half });
	L.place(12, 7);
	assert.equal(near.count, 900);
	near.updateMatrixWorld();
	const A = near.instanceMatrix.array, p = new THREE.Vector3();
	let drawnV = 0, drawnS = 0;
	for (let run = 0; run < 40; run++) {
		// you moved up to 15 m since the copy was made
		const cam = new THREE.PerspectiveCamera();
		cam.position.set(12 + (rnd() - 0.5) * 30, 2, 7 + (rnd() - 0.5) * 30); cam.updateMatrixWorld();
		near.onBeforeRender(null, null, cam);
		const k = near.count;
		near.onAfterRender();
		assert.equal(near.count, 900);
		drawnV += k;
		for (let i = k; i < 900; i++) assert.ok(Math.hypot(A[i * 16 + 12] - cam.position.x, A[i * 16 + 14] - cam.position.z) > band[1], 'a lamp inside the band left out');
		const sc = sun(cam.position.x, cam.position.z, 0.08 + rnd() * 1.4, rnd() * 6.283);
		const F = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse));
		near.onBeforeShadow(null, near, null, sc);
		const s = near.count;
		near.onAfterShadow();
		assert.equal(near.count, 900);
		drawnS += s;
		// (any point within the lamp's reach of its post, up its height, is outside the box)
		for (let i = s; i < 900; i++) for (let a = 0; a < 6.283; a += 0.785) for (let y = 0; y <= 9; y += 3) {
			assert.ok(!F.containsPoint(p.set(A[i * 16 + 12] + Math.cos(a) * half, A[i * 16 + 13] + y, A[i * 16 + 14] + Math.sin(a) * half)), 'a lamp left out of the shadow pass, but in the box');
		}
	}
	assert.ok(drawnV / 40 < 900 * 0.15, `few full lamps in the view (${(drawnV / 40).toFixed(0)} of 900)`);
	assert.ok(drawnS / 40 < 900 * 0.6, `fewer in the shadow pass (${(drawnS / 40).toFixed(0)} of 900)`);
});
