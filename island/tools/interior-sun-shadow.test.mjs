// What stands inside a building (its furniture, the doors between its rooms) throws no shadow of
// the sun's: the shell round it already does (bay/housekit.js inside, sunShell). Each material's
// mesh keeps the shell's vertices first; the sun's shadow pass draws only those, any lamp's
// shadow and the view all of them, and the light bake's finer cut keeps the split
// (interiors/lightbake.js tessellate).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Builder, sunShell } from '../src/bay/housekit.js';
import { tessellate } from '../src/interiors/lightbake.js';
import { GFX_PHONE } from '../src/world/device.js';

const mat = () => new THREE.MeshStandardMaterial();
const M = { paint: mat(), wood: mat(), fabric: mat(), glass: Object.assign(mat(), { transparent: true }) };
function house() {
	const g = new Builder();
	g.box('paint', 0, 0, 0, 4, 2.7, 0.1, [1, 1, 1]); g.box('wood', 0, 0, 0, 4, 0.02, 4, [1, 1, 1]); g.box('glass', 1, 1, 0, 2, 2, 0.01, [1, 1, 1]);
	g.inside();
	g.box('wood', 1, 0, 1, 2, 0.8, 2, [1, 1, 1]); g.box('fabric', 2, 0, 2, 3, 0.5, 3, [1, 1, 1]);
	return Object.fromEntries(g.meshes(M).map((m) => [m.name, m]));
}
const sunCam = new THREE.OrthographicCamera(-55, 55, 55, -55, 1, 400), lampCam = new THREE.PerspectiveCamera(90, 1, 0.1, 14);
function drawn(m, cam) {
	const g = m.geometry;
	m.onBeforeShadow(null, m, null, cam, g, null, null);
	const n = Math.min(g.drawRange.count, g.attributes.position.count - g.drawRange.start);
	m.onAfterShadow(null, m, null, cam, g, null, null);
	assert.equal(g.drawRange.start, 0); assert.equal(g.drawRange.count, Infinity);
	return n;
}

test('the shell throws the sun\'s shadow; what stands inside does not, but a lamp\'s', () => {
	const H = house();
	// the wall: all shell, as before
	assert.equal(H.paint.castShadow, true); assert.equal(H.paint.geometry.userData.sunCast, undefined);
	// the floor and a table of the same wood: the sun draws the floor only
	const wood = H.wood, all = wood.geometry.attributes.position.count;
	assert.equal(wood.castShadow, true);
	assert.equal(drawn(wood, sunCam), 36); assert.equal(drawn(wood, lampCam), all);
	// the sofa: nothing of the shell in it
	if (GFX_PHONE) assert.equal(H.fabric.castShadow, false);
	else { assert.equal(H.fabric.castShadow, true); assert.equal(drawn(H.fabric, sunCam), 0); assert.ok(drawn(H.fabric, lampCam) > 0); }
	// glass throws none, as before
	assert.equal(H.glass.castShadow, false);
	// a builder never told what is inside is all shell
	const b = new Builder(); b.box('wood', 0, 0, 0, 1, 1, 1, [1, 1, 1]);
	const [m] = b.meshes(M);
	assert.equal(m.castShadow, true); assert.equal(m.onBeforeShadow, THREE.Mesh.prototype.onBeforeShadow);
});

test('a geometry put in a mesh\'s place without the split is drawn whole by the sun', () => {
	const m = sunShell(new THREE.Mesh(new THREE.BoxGeometry().toNonIndexed(), mat()));
	assert.equal(drawn(m, sunCam), 36);
});

test('the light bake\'s finer cut keeps the shell first, its split where the shell ends', () => {
	const H = house(), A = H.wood.geometry.attributes, n = A.position.count, mark = H.wood.geometry.userData.sunCast;
	const attrs = (s, e) => Object.fromEntries(Object.entries(A).map(([k, a]) => [k, { size: a.itemSize, array: a.array.slice(s * a.itemSize, e * a.itemSize) }]));
	for (const cell of [0.05, 0.3, 2]) {
		const T = tessellate(attrs(0, n), n, cell, mark), S = tessellate(attrs(0, mark), mark, cell), F = tessellate(attrs(mark, n), n - mark, cell);
		assert.equal(T.mark, S.count);
		assert.equal(T.count, S.count + F.count);
		assert.deepEqual(Array.from(T.attrs.position.array.slice(0, S.count * 3)), Array.from(S.attrs.position.array));
		assert.equal(tessellate(attrs(0, n), n, cell).mark, null);
	}
});
