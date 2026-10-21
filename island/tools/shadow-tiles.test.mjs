// Merged meshes spread over kilometres (the landmarks, the San Mateo Bridge) in the
// sun's shadow pass only by their tiles in the box, and the bridge's lamps and towers only as far
// as the box reaches (world/shadowreach.js shadowByTiles, shadowByNearest). Every triangle and
// instance with any point in the shadow camera's box is drawn; the view's own pass is as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hilbert, tileTriangles, shadowByTiles, shadowByNearest } from '../src/world/shadowreach.js';

let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// the sun as world/sky.js has it: 200 m back along the light from you, a 110 m box 400 m deep
function sun(px, pz, el, az) {
	const L = new THREE.DirectionalLight(0xffffff, 1), sc = L.shadow.camera;
	sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
	L.target.position.set(px, 0, pz); L.position.set(px + Math.cos(el) * Math.cos(az) * 200, Math.sin(el) * 200, pz + Math.cos(el) * Math.sin(az) * 200);
	L.updateMatrixWorld(); L.target.updateMatrixWorld(); L.shadow.updateMatrices(L);
	return { sc, f: L.shadow.getFrustum() };
}
// pieces along a line some km long (a bridge, a freeway) and scattered round it (landmarks)
function pieces(n, indexed) {
	// (some far off the rest: tiles past the grid's edge are counted at its edge)
	const list = [];
	for (let i = 0; i < n; i++) {
		const along = rnd() < 0.6, t = rnd();
		const far = rnd() < 0.01 ? 20000 : 0, x = (along ? -4000 + t * 9000 : (rnd() - 0.5) * 9000) + far, z = along ? -1500 + t * 3000 + (rnd() - 0.5) * 30 : (rnd() - 0.5) * 6000;
		const g = new THREE.BoxGeometry(1 + rnd() * (rnd() < 0.05 ? 120 : 12), 1 + rnd() * 40, 1 + rnd() * 12).rotateY(rnd() * 6.283).translate(x, rnd() * 20, z);
		list.push(indexed ? g : g.toNonIndexed());
	}
	return mergeGeometries(list);
}
const triOf = (geo, t) => { const I = geo.index, P = geo.attributes.position; return [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(P, I ? I.getX(t * 3 + k) : t * 3 + k)); };
const key = (T) => T.map((p) => p.toArray().map((c) => c.toFixed(3)).join(',')).join('|');
// a few points of a triangle: its corners, the middles of its edges, its middle
const samples = (T) => [T[0], T[1], T[2], T[0].clone().add(T[1]).multiplyScalar(0.5), T[1].clone().add(T[2]).multiplyScalar(0.5), T[0].clone().add(T[2]).multiplyScalar(0.5), T[0].clone().add(T[1]).add(T[2]).multiplyScalar(1 / 3)];

test('the Hilbert curve visits every tile once', () => {
	for (const n of [1, 2, 8, 32]) {
		const seen = new Set();
		for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) seen.add(hilbert(n, x, y));
		assert.equal(seen.size, n * n);
		assert.ok([...seen].every((d) => d >= 0 && d < n * n));
	}
});

test('tiling keeps every triangle once, each inside its tile box, each tile in its own order', () => {
	for (const indexed of [false, true]) {
		const geo = pieces(400, indexed), n = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
		const before = [];
		for (let t = 0; t < n; t++) before.push(key(triOf(geo, t)));
		const R = tileTriangles(geo, 250);
		const after = [];
		for (let t = 0; t < n; t++) after.push(key(triOf(geo, t)));
		assert.deepEqual([...after].sort(), [...before].sort());
		let covered = 0;
		const pos = new Map(before.map((k, i) => [k, i]));
		for (const T of R.tiles) {
			let last = -1;
			for (let i = T.start; i < T.start + T.count; i += 3) {
				const tri = triOf(geo, i / 3);
				for (const p of tri) assert.ok(T.box.containsPoint(p));
				const was = pos.get(key(tri));
				assert.ok(was > last, 'a tile keeps its triangles in their order');
				last = was; covered++;
			}
		}
		assert.equal(covered, n);
		assert.ok(R.tiles.length > 50, `tiles: ${R.tiles.length}`);
	}
});

test('the shadow pass draws every triangle with a point in its box, the view all of them', () => {
	let drawn = 0, total = 0, empty = 0;
	for (const indexed of [false, true]) {
		const geo = pieces(1500, indexed), mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
		mesh.position.set(indexed ? 37 : 0, 0, indexed ? -12 : 0); mesh.updateMatrixWorld();
		shadowByTiles(mesh);
		const n = (geo.index ? geo.index.count : geo.attributes.position.count) / 3, q = new THREE.Vector3();
		const tris = Array.from({ length: n }, (_, t) => samples(triOf(geo, t)).map((p) => p.applyMatrix4(mesh.matrixWorld)));
		for (let k = 0; k < 60; k++) {
			// near the line or anywhere round it, the sun anywhere above the horizon
			const t = rnd(), near = rnd() < 0.7;
			const px = near ? -4000 + t * 9000 : (rnd() - 0.5) * 9000, pz = near ? -1500 + t * 3000 : (rnd() - 0.5) * 6000;
			const { sc, f } = sun(px, pz, 0.15 + rnd() * 1.4, rnd() * 6.283);
			const inView = mesh.intersectsFrustum(f);
			if (inView) mesh.onBeforeShadow(null, mesh, null, sc, geo, null, null);
			const R = geo.drawRange, s = inView ? R.start : 0, e = inView ? R.start + R.count : 0;
			for (let i = 0; i < n; i++) {
				if (tris[i].some((p) => f.containsPoint(q.copy(p)))) assert.ok(i * 3 >= s && i * 3 < e, 'a triangle in the box left out');
			}
			if (inView) mesh.onAfterShadow(null, mesh, null, sc, geo, null, null);
			assert.equal(geo.drawRange.start, 0); assert.equal(geo.drawRange.count, Infinity);
			drawn += (e - s) / 3; total += n; if (e === s) empty++;
		}
		// the screen: a wide view sees it whole
		const cam = new THREE.PerspectiveCamera(70, 0.46, 0.25, 60000);
		cam.position.set(0, 2, 0); cam.lookAt(1, 2, 0); cam.updateMatrixWorld();
		const F = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
		assert.ok(mesh.intersectsFrustum(F));
	}
	assert.ok(drawn < total * 0.25, `shadow draws ${Math.round(drawn)} of ${total} triangles`);
	assert.ok(empty > 0);
});

test('a bridge\'s lamps: the shadow pass draws every one its box can reach, nearest first', () => {
	const n = 480, geo = new THREE.BoxGeometry(0.4, 9, 0.4).translate(0, 4.5, 0), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial(), n);
	const M = new THREE.Matrix4(), O = { x: 2500, z: -800 };
	const where = [];
	for (let i = 0; i < n; i++) { const s = (i >> 1) * 44, x = -5000 + s * 0.94 + (i & 1) * 30, z = s * 0.34; M.makeTranslation(x, 0, z); im.setMatrixAt(i, M); where.push([x, z]); }
	const grp = new THREE.Group(); grp.position.set(O.x, 0, O.z); grp.add(im); grp.updateMatrixWorld(true);
	const N = shadowByNearest(im);
	const corners = [new THREE.Vector3(-0.2, 0, -0.2), new THREE.Vector3(0.2, 9, 0.2), new THREE.Vector3(0, 4.5, 0), new THREE.Vector3(-0.2, 9, 0.2), new THREE.Vector3(0.2, 0, -0.2)];
	let drawn = 0, runs = 0;
	for (let k = 0; k < 80; k++) {
		const s = rnd() * 10000, px = O.x - 5000 + s * 0.94 + (rnd() - 0.5) * 60, pz = O.z + s * 0.34 + (rnd() - 0.5) * 60;
		assert.ok(N.order(px + (rnd() - 0.5) * 80, pz + (rnd() - 0.5) * 80) || k > 0);
		const { sc, f } = sun(px, pz, 0.12 + rnd() * 1.4, rnd() * 6.283);
		im.onBeforeShadow(null, im, null, sc);
		const count = im.count, A = im.instanceMatrix.array, q = new THREE.Vector3();
		for (let j = 0; j < n; j++) {
			M.fromArray(A, j * 16).premultiply(grp.matrixWorld);
			if (corners.some((c) => f.containsPoint(q.copy(c).applyMatrix4(M)))) assert.ok(j < count, 'a lamp in the box left out');
		}
		im.onAfterShadow(null, im, null, sc);
		assert.equal(im.count, n);
		drawn += count; runs++;
	}
	// every lamp is still there, once
	const seen = new Set();
	for (let j = 0; j < n; j++) { M.fromArray(im.instanceMatrix.array, j * 16); seen.add(M.elements[12].toFixed(2) + ',' + M.elements[14].toFixed(2)); }
	assert.equal(seen.size, new Set(where.map(([x, z]) => x.toFixed(2) + ',' + z.toFixed(2))).size);
	assert.ok(drawn / runs < n * 0.1, `lamps drawn: ${(drawn / runs).toFixed(1)} of ${n}`);
});
