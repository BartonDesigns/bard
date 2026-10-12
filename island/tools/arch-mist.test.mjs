import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mistColumn, mistDensity } from '../src/planet/arch/cloud-field.js';
import { createMist } from '../src/planet/arch/clouds.js';

const M = { x: 0, z: 0, rad: 1000, cover: .32, base: 100, top: 160,
	bands: [{ base: 100, top: 160 }, { base: 210, top: 245 }] };
const obs = [{ x: 30, z: 40, r: 18, light: 1, tower: true }];
const grid = segments => ({ x: M.x, z: M.z, rad: M.rad, segments });
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .001, `${message}: ${actual} vs ${expected}`);

test('mist columns follow actual Three plane triangles on phones and desktops', () => {
	// Validate against the mesh's index buffer, not a second copy of the helper's
	// cell/diagonal formula. Shader sine-hash precision is still approximate.
	for (const segments of [30, 52]) {
		const geometry = new THREE.PlaneGeometry(M.rad * 2, M.rad * 2, segments, segments).rotateX(-Math.PI / 2).translate(M.x, 0, M.z);
		const positions = geometry.attributes.position, index = geometry.index;
		const off = { x: 27.5, y: -13.25 };
		for (const [ix, iz] of [[0, 0], [segments / 2 - 1, segments / 2], [segments - 1, segments - 1]]) {
			for (let side = 0; side < 2; side++) {
				const start = (iz * segments + ix) * 6 + side * 3;
				const vertices = [0, 1, 2].map(i => new THREE.Vector3().fromBufferAttribute(positions, index.getX(start + i)));
				for (const weights of [[.2, .3, .5], [.7, .1, .2]]) {
					const point = new THREE.Vector3();
					const expected = { base: 0, top: 0 };
					vertices.forEach((vertex, i) => {
						point.addScaledVector(vertex, weights[i]);
						const column = mistColumn(vertex.x, vertex.z, M.bands[0], obs, off);
						expected.base += column.base * weights[i]; expected.top += column.top * weights[i];
					});
					const actual = mistColumn(point.x, point.z, M.bands[0], obs, off, grid(segments));
					close(actual.base, expected.base, `base ${segments}/${side}`);
					close(actual.top, expected.top, `top ${segments}/${side}`);
				}
			}
		}
		geometry.dispose();
	}
});

test('the veil follows displaced cloud height instead of filling the nominal band', () => {
	const x = 60, z = 40, column = mistColumn(x, z, M.bands[0], obs, undefined, grid(52));
	assert.ok(column.base > M.base + 5 && column.top > M.top + 20);
	assert.equal(mistDensity({ x, y: (M.base + column.base) / 2, z }, M, obs), 0, 'clear below the displaced cloud');
	assert.ok(mistDensity({ x, y: (M.top + column.top) / 2, z }, M, obs) > .01, 'mist extends above its nominal top');
	assert.equal(mistDensity({ x, y: column.top + 1, z }, M, obs), 0, 'clear above the displaced cloud');
});

test('both bands retain real coverage holes with no unconditional veil floor', () => {
	for (const [b, z] of [[0, -350], [1, -300]]) {
		const x = -450, column = mistColumn(x, z, M.bands[b], [], undefined, grid(52));
		const point = { x, y: (column.base + column.top) / 2, z };
		const density = mistDensity(point, M, []);
		assert.ok(density > .9 && density <= 1, `band ${b} has visible dense cloud`);
		assert.equal(mistDensity(point, M, []), density, 'sampling is deterministic');
		assert.equal(mistDensity(point, { ...M, cover: 1.5 }, []), 0, 'zero coverage stays clear');
	}
});

test('rooms, terrain, tower holes and radial limits keep the camera in clear air', () => {
	const point = { x: -450, y: 128.2974374249653, z: -350 };
	assert.ok(mistDensity(point, M, obs) > .9);
	assert.equal(mistDensity(point, M, obs, { indoors: true }), 0);
	assert.equal(mistDensity(point, M, obs, { ground: point.y }), 0);
	assert.equal(mistDensity({ x: M.rad + 1, y: point.y, z: 0 }, M, obs), 0);
	const column = mistColumn(obs[0].x, obs[0].z, M.bands[0], obs, undefined, grid(52));
	assert.equal(mistDensity({ x: obs[0].x, y: (column.base + column.top) / 2, z: obs[0].z }, M, obs), 0);
	const nearGround = mistDensity(point, M, obs, { ground: point.y - 1 });
	assert.ok(nearGround > 0 && nearGround < .05, 'terrain contact fades instead of cutting through the ground');
});

test('production updates clear old opacity after leaving cloud or entering a room', () => {
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	const shared = { uWindDir: { value: new THREE.Vector2(1, 0) }, uTime: { value: 0 },
		uSunColor: { value: new THREE.Color(1, 1, 1) }, uSkyHor: { value: new THREE.Color(.7, .75, .8) } };
	const mist = createMist(scene, shared, M, obs), veil = mist.group.getObjectByName('arch:veil');
	try {
		camera.position.set(-450, 128.2974374249653, -350);
		const density = mist.update(0, camera, 0);
		assert.ok(density > .9 && veil.visible);
		close(veil.material.opacity, density * .85, 'production opacity');
		assert.equal(mist.update(0, camera, 0, true), 0);
		assert.equal(veil.visible, false); assert.equal(veil.material.opacity, 0);
		mist.update(0, camera, 0);
		camera.position.y = 1000;
		assert.equal(mist.update(0, camera, 0), 0);
		assert.equal(veil.visible, false); assert.equal(veil.material.opacity, 0);
	} finally { mist.dispose(); }
	assert.equal(mist.group.parent, null);
});
