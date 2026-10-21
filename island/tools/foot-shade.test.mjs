// The soft shade under people's feet (world/footshade.js): placed under each shoe at the
// ground under it, faded by how high the foot is off that ground, by distance and by fog, and
// written as one instanced mesh that never needs a second shader.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { liftK, reachK, fogK, personShade, shadeMatrix, createFootShade, FOOT_REACH } from '../src/world/footshade.js';

const quads = () => Array.from({ length: 3 }, () => ({ x: 0, y: 0, z: 0, ux: 1, uy: 0, uz: 0, a: 0, b: 0, k: 0 }));
// a person stood with feet side by side on flat ground at y = g, toes along +z
const stood = (g = 2, lift = 0) => ({ lx: -0.1, ly: g + 0.08 + lift, lz: 0, ldx: 0, ldz: 0.5, lg: g, rx: 0.1, ry: g + 0.08 + lift, rz: 0, rdx: 0, rdz: 0.5, rg: g, ankle: 0.08, h: 1.7 });

test('a foot on the ground leaves all its shade, a raised one less, a jump none', () => {
	assert.equal(liftK(0), 1);
	assert.equal(liftK(0.02), 1);
	assert.ok(liftK(0.1) < 1 && liftK(0.1) > 0.8, 'heel up: most of it');
	assert.ok(liftK(0.25) < liftK(0.1));
	assert.equal(liftK(0.45), 0);
	assert.equal(liftK(1.5), 0);
	// (a little below the ground found is the ground's own coarseness; well below is somewhere else)
	assert.equal(liftK(-0.1), 1);
	assert.equal(liftK(-0.5), 0);
	for (let h = -0.2; h < 0.6; h += 0.01) assert.ok(liftK(h + 0.01) <= liftK(h) + 1e-12, 'never darker higher up');
});

test('the shade fades out by distance and in fog', () => {
	assert.equal(reachK(5), 1);
	assert.equal(reachK(FOOT_REACH), 0);
	assert.equal(reachK(FOOT_REACH + 10), 0);
	assert.ok(reachK(FOOT_REACH - 3) > 0 && reachK(FOOT_REACH - 3) < 1);
	assert.equal(fogK(30, 0), 1);
	assert.ok(fogK(30, 0.00026) > 0.999, 'the Bay\'s clear air: no difference near');
	assert.ok(fogK(30, 0.03) < 0.5, 'thick fog takes it');
	assert.equal(fogK(30, -0.03), fogK(30, 0.03), 'under water the absorption counts the same');
});

test('stood still: a print under each shoe at its ground, and one wide across the body', () => {
	const out = quads(), n = personShade(stood(2), 1, out);
	assert.equal(n, 3);
	const [L, R, B] = out;
	for (const q of out) assert.ok(Math.abs(q.y - 2) < 0.05 && q.y > 2, 'just over the ground');
	assert.ok(L.x < 0 && R.x > 0, 'under each foot');
	assert.ok(L.z > 0 && R.z > 0, 'a little ahead of the ankle');
	assert.ok(Math.abs(L.uz - 1) < 1e-9, 'the print runs along the toes');
	assert.ok(L.a > L.b, 'longer than wide');
	assert.ok(Math.abs(B.ux) > 0.99, 'the body\'s shade runs across the feet');
	assert.ok(B.a > L.a && B.k < L.k, 'wider and fainter than a shoe\'s');
});

test('a jump fades it all; one foot raised keeps the body\'s', () => {
	const out = quads();
	assert.equal(personShade(stood(2, 0.6), 1, out), 0, 'both feet half a metre up: nothing');
	const F = stood(2); F.ry += 0.6;
	const n = personShade(F, 1, out);
	assert.equal(n, 2, 'the planted shoe and the body');
	assert.ok(out[0].x < 0, 'under the planted foot');
	const half = personShade(stood(2, 0.15), 1, quads());
	assert.equal(half, 3);
});

test('on a slope the body\'s shade tilts from one foot\'s ground to the other\'s', () => {
	const F = stood(2); F.rx = 0.5; F.rg = 2.2; F.ry = 2.28;
	const out = quads();
	personShade(F, 1, out);
	const B = out[2];
	assert.ok(B.uy > 0.2, 'rising toward the higher foot');
	assert.ok(Math.abs(B.ux * B.ux + B.uy * B.uy + B.uz * B.uz - 1) < 1e-9, 'a unit axis');
	assert.ok(Math.abs(B.y - 2.1) < 0.05, 'between the two grounds');
});

test('a quad\'s matrix lays the unit square on the ground, along its axis', () => {
	const arr = new Float32Array(32), q = { x: 3, y: 1, z: -2, ux: 0, uy: 0, uz: 1, a: 0.2, b: 0.1, k: 0.4 };
	shadeMatrix(arr, 1, q);
	const m = new THREE.Matrix4().fromArray(arr, 16);
	const tip = new THREE.Vector3(0.5, 0, 0).applyMatrix4(m), side = new THREE.Vector3(0, 0, 0.5).applyMatrix4(m), c = new THREE.Vector3().applyMatrix4(m);
	assert.deepEqual(c.toArray(), [3, 1, -2]);
	assert.ok(Math.abs(tip.z - (-2 + 0.2)) < 1e-6 && Math.abs(tip.x - 3) < 1e-6, 'half a length along the axis');
	assert.ok(Math.abs(Math.abs(side.x - 3) - 0.1) < 1e-6 && Math.abs(side.z + 2) < 1e-6, 'half a width across it');
	assert.ok(m.determinant() > 0, 'not mirrored');
});

// a stand-in body: the two foot bones under a root, as people/body.js builds them
function body(x, z) {
	const root = new THREE.Group(), body = new THREE.Group(), L = new THREE.Bone(), R = new THREE.Bone();
	root.add(body); body.add(L, R);
	L.position.set(-0.1, 0.08, 0); R.position.set(0.1, 0.08, 0);
	root.position.set(x, 2, z);
	const P = { root, body, bones: [L, R], map: { 'foot.L': 0, 'foot.R': 1 }, rest: { heads: [L.position.clone(), R.position.clone()], dirs: [new THREE.Vector3(0, -0.3, 1).normalize(), new THREE.Vector3(0, -0.3, 1).normalize()] }, height: 1.7 };
	return P;
}

test('the mesh: the bodies near and in view, each on its floor, re-read only as they move', () => {
	const scene = new THREE.Scene(), bodies = new Set(), cam = new THREE.PerspectiveCamera(70, 1, 0.25, 1000);
	cam.position.set(0, 3.7, 8); cam.lookAt(0, 2, 0); cam.updateMatrixWorld();
	let reads = 0;
	const S = createFootShade(scene, { bodies, floor: () => { reads++; return 2; } });
	const near = body(0, 0), far = body(0, -80), behind = body(0, 20), hidden = body(1, 0), dropped = body(2, 0);
	for (const P of [near, far, behind, hidden, dropped]) { scene.add(P.root); bodies.add(new WeakRef(P)); }
	hidden.root.visible = false;
	dropped.freed = true;
	scene.updateMatrixWorld();
	S.update(cam);
	assert.equal(S.info().people, 1, 'only the one near, in view and shown');
	assert.equal(S.mesh.count, 3);
	assert.equal(S.info().bodies, 4, 'the freed body is let go');
	assert.equal(reads, 2, 'a ground for each foot');
	S.update(cam);
	assert.equal(reads, 2, 'stood still: not read again');
	near.root.position.x += 0.5; near.root.updateMatrixWorld();
	S.update(cam);
	assert.equal(reads, 4, 'moved: read again');
	const e = S.mesh.instanceMatrix.array;
	assert.ok(Math.abs(e[13] - 2.025) < 1e-4, 'at the floor, just over it');
	// the person fading out takes the shade with them
	near.fadeK = 0;
	S.update(cam);
	assert.equal(S.mesh.count, 0);
	// one material, made once; no lights or fog that could ask for another shader
	assert.equal(S.mesh.material.lights, false);
	assert.equal(S.mesh.material.fog, false);
	assert.ok(S.mesh.instanceColor, 'its colours from the start');
	assert.equal(S.mesh.castShadow, false);
	S.dispose();
	assert.equal(scene.children.includes(S.mesh), false);
});
