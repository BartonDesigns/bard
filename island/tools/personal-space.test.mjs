// Personal space (people/personal-space.js): walking straight at someone's face you stop about an
// arm's length off, not 30 cm from their eyes; at their back or side a shoulder's width; a slanting
// approach slides you round them; you pass between two people walking side by side; pressing into
// someone standing in your way and they shuffle aside, kept off the walls, while a seated person
// stays put; someone in your hands is no obstacle; a body that stops stepping is forgotten.
// Run with node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { keepSpace, noteBody, bodiesNoted, FRONT, SIDE, TOUCH } from '../src/people/personal-space.js';

let clock = 0;
const DT = 1 / 15;
// a body standing at (x, z), facing heading (0 = +z), of height h
function body(x, z, heading = 0, { h = 1.7, how = true, sit = 0 } = {}) {
	const S = { pos: { x, y: 0, z }, sitK: { v: sit } };
	const P = { height: h, root: { visible: true, parent: null, matrixWorld: { elements: new Array(16).fill(0) } } };
	P.sync = () => { const e = P.root.matrixWorld.elements, c = Math.cos(heading), s = Math.sin(heading); e[0] = c; e[2] = -s; e[8] = s; e[10] = c; e[5] = 1; e[12] = S.pos.x; e[13] = S.pos.y; e[14] = S.pos.z; e[15] = 1; };
	P.sync();
	P.S = S; P.how = how;
	return P;
}
// a fresh scene: everyone noted before is long gone
function scene(...bodies) { clock += 10000; for (const P of bodies) noteBody(P, P.S, P.how, clock); return bodies; }
// walk from (x, z) toward (wx, wz) at speed for t seconds; returns the path's nearest approach to each body
function walk(bodies, x, z, wx, wz, { speed = 5.2, t = 3, push = null } = {}) {
	const pos = { x, y: 1.68, z }, vel = { x: 0, z: 0 }, from = { x: 0, z: 0 };
	const l = Math.hypot(wx, wz), near = bodies.map(() => Infinity);
	for (let k = 0; k < t / DT; k++) {
		clock += DT * 1000;
		for (const P of bodies) { P.sync(); noteBody(P, P.S, P.how, clock); }
		from.x = pos.x; from.z = pos.z;
		vel.x = wx / l * speed; vel.z = wz / l * speed;
		pos.x += vel.x * DT; pos.z += vel.z * DT;
		keepSpace(from, pos, vel, 0, DT, true, push, clock);
		bodies.forEach((P, i) => { near[i] = Math.min(near[i], Math.hypot(pos.x - P.S.pos.x, pos.z - P.S.pos.z)); });
	}
	return { pos, near };
}

test('walking straight at a face stops about an arm\'s length off', () => {
	// (seated, so they never step aside: the stop itself is measured)
	const [P] = scene(body(0, 0, 0, { sit: 1 }));
	const { pos, near } = walk([P], 0, 4, 0, -1);
	assert.ok(near[0] > FRONT - 0.03, `came to ${near[0].toFixed(3)} m`);
	assert.ok(pos.z < FRONT + 0.1, `stopped short at ${pos.z.toFixed(3)} m`);
});

test('behind or beside someone, a shoulder\'s width', () => {
	const [P] = scene(body(0, 0, 0, { sit: 1 }));
	const back = walk([P], 0, -4, 0, 1);
	assert.ok(back.near[0] > SIDE - 0.03 && back.near[0] < SIDE + 0.12, `at their back: ${back.near[0].toFixed(3)}`);
	assert.ok(back.near[0] < FRONT - 0.15);
});

test('a slanting approach slides round them and on past', () => {
	const [P] = scene(body(0, 0, Math.PI / 2, { sit: 1 }));
	// (they face +x; you come along z, 0.25 m to their front)
	const { pos, near } = walk([P], 0.25, -4, 0, 1, { t: 2 });
	assert.ok(pos.z > 2, `got past: ${pos.z.toFixed(2)}`);
	assert.ok(near[0] > SIDE - 0.05, `brushed to ${near[0].toFixed(3)}`);
});

test('you pass between two people walking side by side', () => {
	const bodies = scene(body(-0.6, 0, 0), body(0.6, 0, 0));
	const { pos } = walk(bodies, 0, -4, 0, 1, { t: 2 });
	assert.ok(pos.z > 3, `held up at ${pos.z.toFixed(2)}`);
});

test('pressing into someone standing in the way, they shuffle aside and you get by', () => {
	const [P] = scene(body(0, 0, Math.PI));
	const { pos } = walk([P], 0, -4, 0, 1, { t: 4 });
	assert.ok(pos.z > 1, `still held at ${pos.z.toFixed(2)}`);
	assert.ok(Math.abs(P.S.pos.x) > 0.05, `they stepped to one side: ${P.S.pos.x.toFixed(2)}`);
	assert.ok(Math.hypot(P.S.pos.x, P.S.pos.z) < 1, 'a step, not a walk away');
});

test('a shuffle never puts them through a wall', () => {
	// a wall along x = 0.3 (they can stand no nearer than 0.3 to it)
	const push = (p) => { if (p.x > 0) p.x = 0; };
	const [P] = scene(body(-0.3, 0, Math.PI));
	walk([P], -0.6, -4, 0, 1, { t: 4, push });
	assert.ok(P.S.pos.x <= 1e-6, `pushed to ${P.S.pos.x.toFixed(3)}`);
});

test('a seated person, or another player, stays put', () => {
	const seated = body(0, 0, Math.PI, { sit: 1 }), other = body(3, 0, Math.PI, { how: 'fixed' });
	scene(seated, other);
	walk([seated], 0, -4, 0, 1, { t: 3 });
	walk([other], 3, -4, 0, 1, { t: 3 });
	assert.equal(seated.S.pos.x, 0); assert.equal(seated.S.pos.z, 0);
	assert.equal(other.S.pos.x, 3); assert.equal(other.S.pos.z, 0);
});

test('someone who walks into you moves you aside gently, never a jump', () => {
	const [P] = scene(body(0, 0, 0, { sit: 1 }));
	const pos = { x: 0.1, y: 1.68, z: 0.05 }, vel = { x: 0, z: 0 }, from = { x: 0.1, z: 0.05 };
	let last = Math.hypot(pos.x, pos.z);
	for (let k = 0; k < 30; k++) {
		clock += DT * 1000; noteBody(P, P.S, P.how, clock);
		from.x = pos.x; from.z = pos.z;
		keepSpace(from, pos, vel, 0, DT, false, null, clock);
		const d = Math.hypot(pos.x, pos.z);
		assert.ok(d - last < 1.5 * DT + 1e-6, 'moved too far in a frame');
		last = d;
	}
	assert.ok(last >= TOUCH - 1e-6, `left at ${last.toFixed(3)}`);
});

test('a child\'s arm\'s length is shorter', () => {
	const [P] = scene(body(0, 0, 0, { h: 1.1, sit: 1 }));
	const { near } = walk([P], 0, 4, 0, -1);
	assert.ok(near[0] < FRONT - 0.1 && near[0] > 0.55, `child: ${near[0].toFixed(3)}`);
});

test('someone in your hands is no obstacle, and a body gone quiet is forgotten', () => {
	const [P] = scene(body(0, 0, 0, { sit: 1 }));
	P.spaceHeld = clock + 1e9;
	const { near } = walk([P], 0, 2, 0, -1, { t: 1 });
	assert.ok(near[0] < 0.2);
	clock += 10000;
	keepSpace({ x: 0, z: 0 }, { x: 0, y: 1.68, z: 0 }, null, 0, DT, false, null, clock);
	assert.equal(bodiesNoted(), 0);
});

test('hidden, faded or limp bodies are passed through', () => {
	for (const set of [(P) => { P.root.visible = false; }, (P) => { P.fadeK = 0.2; }, (P) => { P.ragdoll = {}; }, (P) => { P.root.parent = { visible: false, parent: null }; }]) {
		const [P] = scene(body(0, 0, 0, { sit: 1 }));
		set(P);
		const { near } = walk([P], 0, 2, 0, -1, { t: 1 });
		assert.ok(near[0] < 0.2);
	}
});
