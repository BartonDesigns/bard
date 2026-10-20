// The point lights' count held steady (world/lightpad.js), so lit shaders are not built again.
//   node island/tools/lightpad.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLightPad } from '../src/world/lightpad.js';

const drawn = (scene) => { let n = 0; scene.traverseVisible((o) => { if (o.isPointLight) n++; }); return n; };

test('the point lights drawn stay at keep while lights come and go', () => {
	const scene = new THREE.Scene(), cave = new THREE.Group(), volcano = new THREE.Group();
	cave.add(new THREE.PointLight()); volcano.add(new THREE.PointLight(), new THREE.PointLight());
	scene.add(cave, volcano);
	const pad = createLightPad(scene, { keep: 3 });
	pad.update(0);
	assert.equal(drawn(scene), 3);
	volcano.visible = false; pad.update(16);
	assert.equal(drawn(scene), 3);
	assert.deepEqual(pad.info(), { lit: 1, padded: 2, capped: 0, keep: 3 });
	// lamps added later are found on the next scan
	scene.add(new THREE.PointLight(), new THREE.PointLight());
	pad.update(5000);
	assert.equal(drawn(scene), 3);
	// past keep the count rises: nothing is hidden that should light
	volcano.visible = true; pad.update(5016);
	assert.equal(drawn(scene), 5);
});

test('on a phone (cap) never more than keep: the lit and nearest are the ones drawn', () => {
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	const at = (x, k = 1) => { const l = new THREE.PointLight(0xffffff, k); l.position.set(x, 0, 0); scene.add(l); return l; };
	const far = at(50), near = at(2), dark = at(1, 0), mid = at(10), lamp = at(5);
	const pad = createLightPad(scene, { keep: 3, cap: true });
	pad.update(0, camera);
	assert.equal(drawn(scene), 3);
	assert.ok(near.visible && lamp.visible && mid.visible && !far.visible && !dark.visible);
	// held back lights come back when there is room
	lamp.removeFromParent(); mid.removeFromParent();
	pad.update(5000, camera);
	assert.equal(drawn(scene), 3);
	assert.ok(far.visible && near.visible && dark.visible);
});
