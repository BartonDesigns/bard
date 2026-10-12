import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayer } from '../src/player.js';
import { shoreVegetation } from '../src/earth/shore.js';

function swimmer({ ground = -8, level = 0, cave = false } = {}) {
	const oldAdd = globalThis.addEventListener, oldRemove = globalThis.removeEventListener;
	globalThis.addEventListener = globalThis.removeEventListener = () => {};
	const node = { addEventListener() {}, removeEventListener() {}, classList: { remove() {} }, style: {} };
	let P;
	try {
		P = createPlayer({ spawn: { x: 0, z: 0, yaw: 0 }, heightAt: () => ground,
			waterAt: () => level, underFloor: () => cave ? ground : null }, { footprints: [] },
		{ obstacles: () => [] }, new THREE.PerspectiveCamera(), { canvas: node, joy: node, knob: node }, { uWave: { value: 0 } });
	} finally { globalThis.addEventListener = oldAdd; globalThis.removeEventListener = oldRemove; }
	P.state.pos.y = level + .35; P.state.swimming = !cave;
	const step = seconds => { for (let n = 0; n < seconds * 60; n++) P.update(1 / 60, n / 60); };
	return { P, S: P.state, step };
}

test('looking down and moving forward dives from sea and raised lake surfaces', () => {
	for (const level of [0, 900]) {
		const { S, step } = swimmer({ level, ground: level - 8 });
		S.pitch = -.6; S.auto = { z: -1 };
		step(1);
		assert.equal(S.diving, true);
		assert.ok(S.pos.y < level - .25, 'crosses the surface instead of cancelling the first frame');
		assert.ok(S.pos.z < -1);
		S.pitch = .8; step(3);
		assert.equal(S.diving, false); assert.ok(S.pos.y > level + .2);
	}
});

test('idle, reversing and shallow looks keep the swimmer at the surface', () => {
	for (const [pitch, z] of [[-.9, 0], [-.9, 1], [-.2, -1]]) {
		const { S, step } = swimmer(); S.pitch = pitch; S.auto = { z }; step(1);
		assert.equal(S.diving, false); assert.ok(Math.abs(S.pos.y - .35) < .001);
	}
});

test('diving respects the bottom and does not turn cave walking into swimming', () => {
	const { S, step } = swimmer({ ground: -2 }); S.pitch = -1.2; S.auto = { z: -1 }; step(8);
	assert.ok(S.pos.y >= -1.5);
	const cave = swimmer({ cave: true }); cave.S.pitch = -.9; cave.S.auto = { z: -1 }; cave.step(1);
	assert.equal(cave.S.swimming, false); assert.equal(cave.S.diving, false);
});

test('inland water excludes submerged roots and keeps shrubs and occasional dry-bank trees', () => {
	for (const level of [0, 10, 900]) {
		for (const depth of [-20, -1, -.3, 0, .2]) assert.equal(shoreVegetation(level + depth, level, .1), 'none');
		assert.equal(shoreVegetation(level + 1, level, .5), 'bush');
		assert.equal(shoreVegetation(level + 2, level, .05), 'normal');
		assert.equal(shoreVegetation(level + 5, level, .99), 'normal');
	}
	assert.equal(shoreVegetation(900, null, .99), 'normal');
});
