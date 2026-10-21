// The city's instanced kit drawn indexed (bay/roofs.js, bay/lotkit.js): the same triangles, with
// the corners the triangles of a face share lifted and lit once (thousands of each are drawn, and
// a box built three corners a triangle sends each corner through the vertex shader up to three times).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { roofGeometry } from '../src/bay/roofs.js';
import { createProps } from '../src/bay/lotkit.js';

const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

test('the roofs keep their triangles and every part of each corner, with fewer corners', () => {
	for (const [hip, n] of [[true, 66], [false, 42]]) {
		const g = roofGeometry(hip);
		assert.ok(g.isInstancedBufferGeometry && g.index, 'indexed, still instanced');
		assert.equal(tris(g), n);
		assert.ok(g.attributes.position.count <= n * 3 * 0.7, `${g.attributes.position.count} corners`);
		for (const k of ['position', 'normal', 'aVP', 'aO1', 'aO2']) assert.equal(g.attributes[k].count, g.attributes.position.count, k);
		// a mesh of them can still take the city's per-roof attributes
		g.setAttribute('aRoof', new THREE.InstancedBufferAttribute(new Float32Array(8), 4));
		const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial(), 2);
		assert.equal(im.count, 2);
	}
});

test('the lot kit shapes are indexed, every triangle kept', () => {
	const group = new THREE.Group(), P = createProps(group, (m) => m, false);
	assert.ok(group.children.length > 30);
	for (const im of group.children) {
		const g = im.geometry, flat = g.toNonIndexed();
		assert.ok(g.index, 'indexed');
		assert.equal(tris(flat), tris(g));
		assert.ok(g.attributes.position.count < flat.attributes.position.count || flat.attributes.position.count <= 36, 'fewer corners');
	}
	assert.ok(P.has('chimney'));
});
