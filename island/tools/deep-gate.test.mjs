import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { generateIsland } from '../src/world/islandgen.js';
import { planetProfile } from '../src/planet/profile.js';
import { planCaves, makeField } from '../src/planet/cavenet.js';

globalThis.addEventListener ||= () => {};
globalThis.window ||= {};
globalThis.document ||= { createElement: () => ({ style: {}, remove() {} }) };
const saves = new Map();
globalThis.localStorage = { getItem: (k) => saves.get(k) ?? null, setItem: (k, v) => saves.set(k, v) };
const { planDeep, createDeep } = await import('../src/planet/deep.js');
const { createUnderworld } = await import('../src/planet/underworld.js');

function setup(type = 'TROPICAL', seed = 1337) {
	const profile = planetProfile(type, seed), island = generateIsland({ seed, resolution: 96, profile });
	const caves = planCaves(island, profile), holes = structuredClone(caves.holes);
	const plan = planDeep(island, caves, makeField);
	return { profile, island, caves, plan, holes };
}

test('the gate stays underground, with a walkable hall and an open shaft on island and planet seeds', () => {
	for (const type of ['TROPICAL', 'TERRAN', 'ICE', 'MAGMA']) for (const seed of [1337, 4242, 42]) {
		const { island, caves, plan, holes } = setup(type, seed);
		assert.ok(plan, `${type}:${seed} has a gate`);
		assert.deepEqual(caves.holes, holes, 'no extra surface opening');
		assert.ok(island.heightAt(plan.x, plan.z) - plan.y > 18, 'a roof over the hall');
		for (const p of plan.pts) assert.ok(caves.field.solid(p.x, p.y + 1.68, p.z) < 0, 'the passage admits a person');
		for (let d = 0; d <= 60; d += 0.5) {
			const x = plan.x - plan.dir.x * 0.55, z = plan.z - plan.dir.z * 0.55;
			assert.ok(caves.field.solid(x, plan.y - d + 0.9, z) < -0.35, `${type}:${seed} rope clearance at ${d} m`);
		}
		assert.ok(caves.field.solid(plan.x, island.heightAt(plan.x, plan.z) - 2, plan.z) > 0, 'surface stays closed');
	}
});

function runtime() {
	const s = setup(), shared = { uTime: { value: 0 }, uBass: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) } };
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), locked: false };
	const uw = createUnderworld(s.island, shared, scene, camera, s.profile, { plan: s.caves, dinosaurs: false, isPhone: true });
	const deep = createDeep(s.island, shared, scene, camera, s.profile, { plan: s.plan, underworld: uw, player: () => player, isPhone: true, bodyKey: 'test-deep' });
	return { ...s, deep, uw, player, camera, scene };
}

test('the seal supports walking; the rope descends and returns continuously, then releases its lock', () => {
	saves.clear();
	const { deep, uw, player, camera, caves, scene } = runtime();
	try {
		const gate = deep.gate;
		assert.equal(deep.gateFloor(gate.x, gate.z, gate.y), gate.y);
		assert.equal(deep.gateFloor(gate.x, gate.z, gate.y + 100), null);
		assert.equal(deep.go('down'), 'the rope is not ready');
		deep.go('gate'); deep.go('open'); deep.update(0.1, 0);
		assert.equal(deep.go('down'), 'climbing down');
		assert.equal(player.locked, true);
		let y = player.pos.y;
		for (let i = 1; i <= 66; i++) {
			deep.update(0.1, i * 0.1);
			assert.ok(player.pos.y <= y + 0.01, 'no upward snap while descending');
			assert.ok(caves.field.solid(player.pos.x, player.pos.y, player.pos.z) < 0, 'no cave rock through the rope');
			y = player.pos.y;
		}
		assert.equal(player.locked, false);
		assert.equal(deep.active(), true);
		assert.ok(gate.y - player.pos.y > 55);
		assert.ok(camera.position.distanceTo(player.pos) < 1e-6);
		assert.equal(deep.go('up'), 'climbing up');
		for (let i = 0; i < 66; i++) deep.update(0.1, 7 + i * 0.1);
		assert.equal(player.locked, false);
		assert.equal(deep.active(), false);
		assert.equal(uw.extraInside, null);
		assert.ok(Math.abs(player.pos.y - (gate.y + 1.68)) < 1);
		assert.equal(deep.info().chunks, 0);
		const backdrop = scene.children.find((o) => o.isMesh && o.geometry.type === 'SphereGeometry' && o.material.side === THREE.BackSide);
		assert.equal(backdrop.visible, false, 'the dark shell disappears immediately on exit');
		assert.equal(deep.go('up'), 'return to the foot of the rope first');
	} finally { deep.dispose(); uw.dispose(); }
});

test('saved gate progress survives reload, and disposal cancels a pending return and unlocks a climber', (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	saves.clear();
	const original = runtime();
	original.deep.go('open'); original.deep.dispose(); original.uw.dispose();
	const { deep, uw, player } = runtime();
	try {
		assert.equal(deep.info().open, true);
		const m = deep.landmark(2);
		deep.go(m.D); deep.update(0.1, 0);
		const target = deep.targets().find((v) => /Return/.test(v.label));
		assert.ok(target); target.act();
		const pos = player.pos.clone();
		deep.dispose();
		t.mock.timers.tick(10000);
		assert.ok(player.pos.equals(pos), 'an old world cannot teleport the new player');
		assert.equal(deep.go('down'), 'the Deep is closed');
	} finally { deep.dispose(); uw.dispose(); }
	const next = runtime();
	try {
		next.deep.go('gate'); next.deep.go('down');
		assert.equal(next.player.locked, true);
		next.deep.dispose();
		assert.equal(next.player.locked, false);
	} finally { next.deep.dispose(); next.uw.dispose(); }
});
