// The city's buildings in the sun's shadow pass (world/shadowreach.js): written nearest first in
// bands, and the pass drawing only the bands its box can reach. Nothing that could cast into the
// box is ever left out; the view's own pass keeps them all; the count comes back after.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REACH_BANDS, bandOf, orderByReach, subEnds, boxReach, shadowByReach } from '../src/world/shadowreach.js';

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const half = (o) => Math.hypot(o.w, o.d) / 2 + 2;
const city = (n, R) => Array.from({ length: n }, (_, i) => ({ i, x: (rnd() - 0.5) * 2 * R, z: (rnd() - 0.5) * 2 * R, y: rnd() * 30, w: 4 + rnd() * (rnd() < 0.05 ? 160 : 20), d: 4 + rnd() * 30, h: 3 + rnd() * (rnd() < 0.05 ? 250 : 15), a: rnd() * 6.283, roof: rnd() < 0.4 ? { hip: rnd() < 0.5 } : null }));
// the sun as world/sky.js has it: 200 m back along the light from you, a 110 m box 400 m deep
function sun(px, pz, el, az) {
	const L = new THREE.DirectionalLight(0xffffff, 1), sc = L.shadow.camera;
	sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
	L.target.position.set(px, 0, pz); L.position.set(px + Math.cos(el) * Math.cos(az) * 200, Math.sin(el) * 200, pz + Math.cos(el) * Math.sin(az) * 200);
	L.updateMatrixWorld(); L.target.updateMatrixWorld(); L.shadow.updateMatrices(L);
	return sc;
}

test('bands: a key falls in the first band whose edge it does not pass', () => {
	assert.equal(bandOf(-5), 0); assert.equal(bandOf(REACH_BANDS[0]), 0); assert.equal(bandOf(REACH_BANDS[0] + 0.1), 1);
	assert.equal(bandOf(1e9), REACH_BANDS.length);
});

test('ordering keeps every item, nearest band first, each band in its own order', () => {
	const L = city(3000, 2000), ids = new Set(L.map((o) => o.i)), props = { trees: [1] };
	Object.assign(L, props);
	const R = orderByReach(L, 120, -40, half);
	assert.equal(L.length, 3000); assert.deepEqual(new Set(L.map((o) => o.i)), ids); assert.equal(L.trees, props.trees);
	assert.equal(R.ends.at(-1), 3000);
	let b = 0;
	for (let i = 0; i < L.length; i++) {
		while (i >= R.ends[b]) b++;
		assert.equal(bandOf(Math.hypot(L[i].x - 120, L[i].z + 40) - half(L[i])), b);
		if (i && bandOf(Math.hypot(L[i - 1].x - 120, L[i - 1].z + 40) - half(L[i - 1])) === b) assert.ok(L[i - 1].i < L[i].i, 'stable within a band');
	}
	const H = subEnds(L, R, (o) => o.roof?.hip);
	for (let k = 0; k < R.ends.length; k++) assert.equal(H.ends[k], L.slice(0, R.ends[k]).filter((o) => o.roof?.hip).length);
});

test('nothing that could cast into the sun\'s box is left out of the shadow pass', () => {
	let cut = 0, all = 0;
	for (let run = 0; run < 12; run++) {
		const L = city(1500, 1500), cx = (rnd() - 0.5) * 200, cz = (rnd() - 0.5) * 200, R = orderByReach(L, cx, cz, half);
		const im = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), L.length);
		im.count = L.length; im.updateMatrixWorld();
		shadowByReach(im, () => R);
		for (let s = 0; s < 6; s++) {
			// you anywhere within 320 m of where the city was laid out (it is laid out again at 300)
			const a = rnd() * 6.283, r = rnd() * 320, sc = sun(cx + Math.cos(a) * r, cz + Math.sin(a) * r, 0.08 + rnd() * 1.4, rnd() * 6.283);
			const F = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse));
			im.onBeforeShadow(null, im, null, sc);
			const drawn = im.count;
			im.onAfterShadow();
			assert.equal(im.count, L.length, 'the count comes back');
			cut += L.length - drawn; all += L.length;
			// every point of every building left out lies outside the box
			const q = new THREE.Vector3();
			for (let i = drawn; i < L.length; i++) {
				const o = L[i], c = Math.cos(o.a), sn = Math.sin(o.a);
				for (let u = -1; u <= 1; u += 0.5) for (let v = -1; v <= 1; v += 0.5) for (let t = 0; t <= 1; t += 0.25) {
					const lx = u * (o.w / 2 + 1.5), lz = v * (o.d / 2 + 1.5);
					assert.ok(!F.containsPoint(q.set(o.x + c * lx - sn * lz, o.y + t * (o.h + 6), o.z + sn * lx + c * lz)), `building ${i} of ${L.length} left out but in the box`);
				}
			}
		}
	}
	assert.ok(cut / all > 0.7, `most of a 3 km city stays out of the shadow pass (${(cut / all * 100).toFixed(0)}%)`);
});

test('the box reaches its farthest corner, and a moved mesh is drawn whole', () => {
	const sc = sun(0, 0, Math.PI / 2 - 1e-4, 0);
	assert.ok(Math.abs(boxReach(sc, 0, 0) - Math.hypot(55, 55)) < 0.5, 'straight down: the corner of the 110 m square');
	const low = sun(0, 0, 0.05, 0);
	assert.ok(boxReach(low, 0, 0) > 200 && boxReach(low, 0, 0) < 216);
	const L = city(500, 1500), R = orderByReach(L, 0, 0, half), im = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 500);
	im.count = 500; im.position.x = 10; im.updateMatrixWorld();
	shadowByReach(im, () => R);
	im.onBeforeShadow(null, im, null, sc);
	assert.equal(im.count, 500);
	im.onAfterShadow();
	assert.equal(im.count, 500);
});
