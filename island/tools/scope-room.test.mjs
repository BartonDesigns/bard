// The room seen through a scope (interiors/scope-room.js): which window, which room, and a shot
// on into it.
//   node island/tools/scope-room.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { rayLot, aimedLot, roomBehind, seeInto } from '../src/interiors/scope-room.js';

// a lot 10 m wide, 12 deep, 9 high, its front facing +z, centred at (0, 0)
const lot = (x = 0, z = 0, a = 0) => ({ x, z, a, w: 10, d: 12, h: 9, y: 0 });
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; };

test('a ray meets a lot on the face it looks at, in the lot\'s own frame', () => {
	const o = lot();
	const front = rayLot(o, { x: 1, y: 4, z: 200 }, unit(0, 0, -1));
	assert.equal(front.face, 0);
	assert.ok(Math.abs(front.t - 194) < 1e-6 && Math.abs(front.lx - 1) < 1e-6 && Math.abs(front.ly - 4) < 1e-6);
	assert.ok(Math.abs(front.exit - 206) < 1e-6, 'and leaves by the back');
	assert.equal(rayLot(o, { x: 0, y: 4, z: -200 }, unit(0, 0, 1)).face, 1);
	assert.equal(rayLot(o, { x: 200, y: 4, z: 0 }, unit(-1, 0, 0)).face, 2);
	assert.equal(rayLot(o, { x: -200, y: 4, z: 0 }, unit(1, 0, 0)).face, 3);
	assert.equal(rayLot(o, { x: 0, y: 40, z: 0 }, unit(0, -1, 0)), null, 'its roof is no window');
	assert.equal(rayLot(o, { x: 0, y: 4, z: 0 }, unit(0, 0, 1)), null, 'nor is a look out from inside');
	assert.equal(rayLot(o, { x: 30, y: 4, z: 200 }, unit(0, 0, -1)), null);
});

test('a turned lot: its front is its own +z, wherever that points', () => {
	const o = lot(0, 0, Math.PI / 2);
	// (turned a quarter: its local +z is the world's -x)
	const h = rayLot(o, { x: -200, y: 3, z: 0 }, unit(1, 0, 0));
	assert.equal(h.face, 0);
	assert.ok(Math.abs(h.t - 194) < 1e-6);
});

test('the first lot along the ray, and none behind a hill', () => {
	const near = lot(0, 0), far = { ...lot(0, -60), w: 30 };
	const all = [near, far];
	const lotsNear = (x, z, r) => all.filter((o) => Math.hypot(o.x - x, o.z - z) < r + 20);
	const e = { x: 0, y: 4, z: 150 }, d = unit(0, 0, -1);
	assert.equal(aimedLot(lotsNear, e, d, 400).o, near);
	assert.equal(aimedLot(lotsNear, { x: 12, y: 4, z: 150 }, d, 400).o, far, 'past the near one\'s side');
	assert.equal(aimedLot(lotsNear, e, d, 100), null, 'out of reach');
	assert.equal(aimedLot(lotsNear, e, d, 400, (x, z) => (z > 60 && z < 80 ? 12 : 0)), null, 'a hill between');
	assert.equal(aimedLot(lotsNear, e, d, 400, () => 0).o, near);
});

test('the room behind the window: its span, the front room before the one behind it', () => {
	const rooms = [
		{ id: 0, k: 0, x0: -5, x1: 0, z0: 0, z1: 6, type: 'living' },
		{ id: 1, k: 0, x0: 0, x1: 5, z0: 0, z1: 6, type: 'kitchen' },
		{ id: 2, k: 0, x0: -5, x1: 5, z0: -6, z1: 0, type: 'bed' },
		{ id: 3, k: 1, x0: -5, x1: 5, z0: -6, z1: 6, type: 'office' },
	];
	assert.equal(roomBehind(rooms, 0, 0, -2).room.type, 'living');
	assert.deepEqual([roomBehind(rooms, 0, 0, 3).u0, roomBehind(rooms, 0, 0, 3).u1], [0, 5]);
	assert.equal(roomBehind(rooms, 0, 1, 2).room.type, 'bed', 'from the back');
	assert.equal(roomBehind(rooms, 1, 0, 2).room.type, 'office', 'the level looked at');
	assert.equal(roomBehind(rooms, 0, 2, 3).room.type, 'kitchen', 'from the +x side: across z');
	assert.equal(roomBehind(rooms, 2, 0, 0), null, 'no such level');
});

test('a shot through the open window goes on to the far wall; beside it, it stops', () => {
	const o = lot(), open = { o, face: 0, u0: -4, u1: 0, y0: 3.3, y1: 6.3 };
	const d = unit(0, 0, -1);
	assert.ok(Math.abs(seeInto(open, o, { x: -2, y: 4.5, z: 150 }, d) - 156) < 1e-6);
	assert.equal(seeInto(open, o, { x: 3, y: 4.5, z: 150 }, d), -1, 'another room\'s window');
	assert.equal(seeInto(open, o, { x: -2, y: 1.5, z: 150 }, d), -1, 'the floor below');
	assert.equal(seeInto(open, o, { x: 2, y: 4.5, z: -150 }, unit(0, 0, 1)), -1, 'the back');
	assert.equal(seeInto(null, o, { x: -2, y: 4.5, z: 150 }, d), -1);
	assert.equal(seeInto(open, lot(40, 0), { x: 38, y: 4.5, z: 150 }, d), -1, 'another building');
	// (combat's own boxes for a surveyed building: the box the lot stands for)
	const box = { x: 0, z: 0, w: 10, d: 12 };
	assert.ok(seeInto({ ...open, o: { ...o, src: box } }, box, { x: -2, y: 4.5, z: 150 }, d) > 0);
});
