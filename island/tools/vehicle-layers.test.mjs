import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { unfight, layerOffset } from '../src/vehicles/layers.js';
import { carGeometry, KINDS } from '../src/bay/cars.js';

function triangles(vertices, indices) {
	const G = new THREE.BufferGeometry();
	G.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
	G.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(vertices.length / 3 * 2).fill(.4), 2));
	G.setIndex(indices); G.computeVertexNormals(); return G;
}

test('duplicate faces are removed even if their vertex order is cyclically rotated', () => {
	const g = triangles([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2, 1, 2, 0, 2, 0, 1]);
	assert.deepEqual(unfight(g), { dropped: 2, lifted: 0 }); assert.equal(g.index.count, 3);
});

test('close trim lifts clear of the body with its attributes and bounds intact', () => {
	const g = triangles([0, 0, 0, 2, 0, 0, 0, 2, 0, .2, .2, .001, .8, .2, .001, .2, .8, .001], [0, 1, 2, 3, 4, 5]);
	assert.deepEqual(unfight(g), { dropped: 0, lifted: 1 });
	const p = g.attributes.position;
	assert.equal(p.getZ(0), 0); assert.ok(p.getZ(g.index.getX(3)) > .0029);
	assert.equal(g.attributes.uv.count, p.count); assert.equal(g.attributes.normal.count, p.count);
	assert.ok(g.boundingBox.max.z > .0029);
});

test('adjacent panels and separated surfaces are never lifted', () => {
	const g = triangles([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, .1, 1, 0, .1, 0, 1, .1], [0, 1, 2, 2, 1, 3, 4, 5, 6]);
	assert.deepEqual(unfight(g), { dropped: 0, lifted: 0 });
});

test('glass, lamps and trim have ordered depth offsets while body paint retains its depth', () => {
	for (const [role, rank] of [['paint', 0], ['solid', 1], ['chrome', 2], ['lamp', 3], ['glass', 4]]) {
		const m = new THREE.MeshBasicMaterial(); layerOffset(m, role, role);
		assert.equal(m.polygonOffset, rank > 0);
		assert.equal(m.polygonOffsetUnits, -rank || 0);
	}
});

test('all procedural car cabins and shells build finite geometry with matching vertex attributes', () => {
	for (const kind of KINDS) for (const opts of [{ cabin: true, glass: true }, { wheels: false, only: 'cabin' }, { wheels: false, only: 'shell' }]) {
		const g = carGeometry(kind, 32, 12, opts), p = g.attributes.position;
		assert.ok(p.count > 0, kind);
		for (const attribute of Object.values(g.attributes)) {
			assert.equal(attribute.count, p.count, kind);
			assert.ok([...attribute.array].every(Number.isFinite), kind);
		}
		g.dispose();
	}
});
