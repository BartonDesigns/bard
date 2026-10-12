import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colliders } from '../src/planet/alien.js';
import { constrainCrew } from '../src/planet/colony/crew-space.js';

const actor = (j, x, z, y = 0) => ({ j, built: true, dress: 'under', M: { S: { pos: { x, y, z } } } });

test('crew cannot walk through a module wall or furniture', () => {
	const c = colliders();
	c.seg({ x: -2, z: 0 }, { x: 2, z: 0 }, 0.15, 3, 'wall', -1);
	c.box(0, -2, 0, 0.7, 0.9, 2, { floor: false, site: 'table', y0: -1 });
	const a = actor(0, 1.7, -1);
	for (let i = 0; i < 120; i++) { a.M.S.pos.z += 1.15 / 60; constrainCrew(a.M.S.pos, a, [a], c.push, 1 / 60); }
	assert.ok(a.M.S.pos.z <= -0.49);
	a.M.S.pos = { x: -1.2, y: 0, z: -2 };
	for (let i = 0; i < 120; i++) { a.M.S.pos.x += 1.15 / 60; constrainCrew(a.M.S.pos, a, [a], c.push, 1 / 60); }
	assert.ok(a.M.S.pos.x <= -1.04);
});

test('overlapping bodies separate without moving someone through a wall or between decks', () => {
	const c = colliders();
	c.seg({ x: -2, z: 0 }, { x: 2, z: 0 }, 0.15, 3, 'wall', -1);
	const a = actor(0, 0, -0.5), b = actor(1, 0, -0.5), upstairs = actor(2, 0, -0.5, 4);
	const folk = [a, b, upstairs], upperStart = { ...upstairs.M.S.pos };
	for (let i = 0; i < 120; i++) for (const f of folk) constrainCrew(f.M.S.pos, f, folk, c.push, 1 / 60);
	assert.ok(Math.hypot(a.M.S.pos.x - b.M.S.pos.x, a.M.S.pos.z - b.M.S.pos.z) >= 0.719);
	assert.ok(a.M.S.pos.z <= -0.49 && b.M.S.pos.z <= -0.49);
	assert.deepEqual(upstairs.M.S.pos, upperStart);
});

test('doorways admit the crew and EVA suits keep more room', () => {
	const c = colliders();
	c.seg({ x: -2.6, z: 0 }, { x: -0.8, z: 0 }, 0.15, 5.2, 'wall', -1);
	c.seg({ x: 0.8, z: 0 }, { x: 2.6, z: 0 }, 0.15, 5.2, 'wall', -1);
	const a = actor(0, 0, -1), b = actor(1, 0.4, 2);
	for (let i = 0; i < 120; i++) { a.M.S.pos.z += 1.15 / 60; constrainCrew(a.M.S.pos, a, [a], c.push, 1 / 60); }
	assert.ok(a.M.S.pos.z > 1);
	a.M.S.pos = { x: 0, y: 0, z: 2 }; a.dress = 'eva';
	for (let i = 0; i < 120; i++) for (const f of [a, b]) constrainCrew(f.M.S.pos, f, [a, b], c.push, 1 / 60);
	assert.ok(Math.hypot(a.M.S.pos.x - b.M.S.pos.x, a.M.S.pos.z - b.M.S.pos.z) >= 0.859);
});
