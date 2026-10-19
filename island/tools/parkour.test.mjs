// Parkour (src/parkour.js): feeling for ledges, fences and walls with the walking's own two tests,
// the climbs that carry you onto and over them, and the wall runs. A small yard of boxes stands in
// for the world: walls push a body 0.3 m off them below their tops, and some tops are floors.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createParkour, feelFor, climbFor, climbPath, pathAt } from '../src/parkour.js';

const EYE = 1.68;
// [x0, z0, x1, z1, top, walk]
const YARD = {
	ledge: [-3, -6, 3, -3, 2.3, true],
	block: [7, -5, 13, -3.5, 1.0, true],
	fence: [17, -4.03, 23, -3.97, 1.2, false],
	wall: [27, -30, 27.4, 0, 6, false],
	tall: [37, -4.03, 43, -3.97, 2.0, false],
};
function world() {
	const B = Object.values(YARD);
	const floorAt = (x, z, y) => {
		let g = 0;
		for (const b of B) if (b[5] && x > b[0] && x < b[2] && z > b[1] && z < b[3] && y > b[4] - 1.4) g = Math.max(g, b[4]);
		return g;
	};
	const pushOut = (p) => {
		const footY = p.y - EYE;
		for (const b of B) {
			if (footY > b[4] - 0.25) continue;
			const qx = Math.max(b[0], Math.min(b[2], p.x)), qz = Math.max(b[1], Math.min(b[3], p.z)), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
			if (d2 >= 0.09) continue;
			if (d2 < 1e-8) { const pen = [p.x - b[0], b[2] - p.x, p.z - b[1], b[3] - p.z], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) p.x = b[0] - 0.3; else if (k === 1) p.x = b[2] + 0.3; else if (k === 2) p.z = b[1] - 0.3; else p.z = b[3] + 0.3; }
			else { const d = Math.sqrt(d2); p.x = qx + dx / d * 0.3; p.z = qz + dz / d * 0.3; }
		}
	};
	const s = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, grounded: true, gait: { count: 0, lands: 0, foot: 0 } };
	const park = createParkour({ s, camera: new THREE.PerspectiveCamera(), floorAt, pushOut });
	const at = (x, z, feet = 0) => { s.pos.set(x, feet + EYE, z); s.vel.set(0, 0, 0); s.grounded = feet === 0; };
	// run the climb under way to its end
	const finish = () => { let n = 0; while (park.step(1 / 60) && n < 600) n++; return n; };
	return { s, park, floorAt, pushOut, at, finish };
}

test('feels a ledge, a fence, a tall wall and open ground for what they are', () => {
	const { park } = world();
	const L = park.scan(0, -2.2, 0, 0, -1, 1.2, 2.5);
	assert.equal(L.kind, 'ledge');
	assert.ok(Math.abs(L.top - 2.3) < 0.02, 'the ledge top is exact: ' + L.top);
	assert.ok(Math.abs(L.face - 0.8) < 0.1, 'its side 0.8 m on: ' + L.face);
	assert.ok(L.far > L.face && L.y === 2.3, 'somewhere to stand on it');
	const F = park.scan(20, -3, 0, 0, -1, 1.2, 2.5);
	assert.equal(F.kind, 'fence');
	assert.ok(Math.abs(F.top - 1.2) < 0.15, 'the fence about 1.2 m: ' + F.top);
	assert.ok(F.far - F.face > 0.3 && F.y === 0, 'the ground on its far side');
	assert.equal(park.scan(24, -10, 0, 1, 0, 3.5, 2).kind, 'wall');
	assert.equal(park.scan(0, 10, 0, 0, -1, 1.2, 2.5), null);
});

test('a jump at a waist-high block mantles onto it; at a fence, hops it', () => {
	const W = world();
	W.at(10, -2.6);
	assert.ok(W.park.leap(0, -1), 'a mantle begins');
	assert.equal(W.park.info().climb.kind, 'mantle');
	W.finish();
	assert.ok(Math.abs(W.s.pos.y - (1 + EYE)) < 1e-6 && W.s.grounded, 'standing on the block');
	assert.ok(W.s.pos.z < -3.6, 'on it, not at its edge: ' + W.s.pos.z);
	W.at(20, -3);
	W.s.vel.set(0, 0, -9);
	assert.ok(W.park.leap(0, -1), 'a hop begins');
	assert.equal(W.park.info().climb.kind, 'hop');
	W.finish();
	assert.ok(W.s.pos.z < -4.3 && Math.abs(W.s.pos.y - EYE) < 1e-6, 'over the fence, on the ground beyond: ' + W.s.pos.z);
	assert.ok(W.s.vel.z < -3, 'carrying on at pace');
	// sprinting at a low fence: over it without a jump
	W.at(40, -2.9);
	assert.equal(W.park.leap(0, -1, 'auto'), false, 'the 2 m fence is not hopped on the run');
	W.at(10, -2.4); W.s.vel.set(0, 0, -9);
	assert.ok(W.park.leap(0, -1, 'auto'), 'the 1 m block is mantled on the run');
	W.finish();
	// too high to climb from the ground: an ordinary jump
	W.at(0, -2.4);
	assert.equal(W.park.leap(0, -1), false);
	// nothing ahead: an ordinary jump
	W.at(0, 10);
	assert.equal(W.park.leap(0, -1), false);
});

test('in the air at a ledge above the head: a grab and a pull-up onto it', () => {
	const W = world();
	W.at(0, -2.7, 0.6);
	W.s.grounded = false;
	const g = W.park.air(1 / 60, { run: false, wish: new THREE.Vector3(0, 0, -1), contact: { nx: 0, nz: 1, kind: 1 }, jump: false });
	assert.ok(g > 0);
	assert.equal(W.park.info().climb?.kind, 'pull');
	// the hands drawn the look toward them partway through
	for (let i = 0; i < 25; i++) W.park.step(1 / 60);
	assert.ok(W.s.climbK > 0.9, 'the held weapon is lowered');
	W.finish();
	assert.ok(Math.abs(W.s.pos.y - (2.3 + EYE)) < 1e-6 && W.s.grounded, 'standing on the ledge');
	assert.equal(W.park.info().last.kind, 'pull');
	assert.equal(W.s.climbK > 0, true);
	// not reaching for it (backing away): no grab
	W.at(0, -2.7, 0.6); W.s.grounded = false;
	W.park.air(1 / 60, { run: false, wish: new THREE.Vector3(0, 0, 1), contact: { nx: 0, nz: 1, kind: 1 }, jump: false });
	assert.equal(W.park.info().climb, null);
});

test('a fence too tall to hop is climbed over and dropped down from', () => {
	const W = world();
	W.at(40, -3.7, 0.5); W.s.grounded = false;
	W.park.air(1 / 60, { run: false, wish: new THREE.Vector3(0, 0, -1), contact: { nx: 0, nz: 1, kind: 1 }, jump: false });
	assert.equal(W.park.info().climb?.kind, 'over');
	W.finish();
	assert.ok(W.s.pos.z < -4.3 && Math.abs(W.s.pos.y - EYE) < 1e-6, 'down on the far side');
});

test('sprinting and jumping into a wall at a slant runs along it; straight at it, a kick up it', () => {
	const W = world();
	W.at(26.7, -10, 0.4); W.s.grounded = false;
	W.s.yaw = -Math.PI / 2 + 0.9;
	W.s.vel.set(6, 1.5, -7.5);
	const wish = new THREE.Vector3(0.6, 0, -0.8);
	const g = W.park.air(1 / 60, { run: true, wish, contact: { nx: -1, nz: 0, kind: 1 }, jump: false });
	assert.ok(W.park.running() && W.s.wallRun, 'a wall run');
	assert.ok(g < 0.5, 'held up: ' + g);
	assert.ok(W.park.lean() >= 0, 'the view leans away from the wall');
	W.park.air(0.2, { run: true, wish, contact: { nx: -1, nz: 0, kind: 1 }, jump: false });
	assert.ok(W.s.vel.z < -6 && W.s.vel.x > 0 && W.s.vel.x < 1.5, 'along it, leaning on it: ' + W.s.vel.toArray());
	assert.ok(W.park.lean() > 0.05, 'leaning');
	// jump: kicked off it, away and on
	W.park.air(1 / 60, { run: true, wish, contact: { nx: -1, nz: 0, kind: 1 }, jump: true });
	assert.ok(!W.park.running() && !W.s.wallRun);
	assert.ok(W.s.vel.x < -3 && W.s.vel.y > 5, 'off the wall: ' + W.s.vel.toArray());
	// the same wall again in this jump: no
	W.park.air(1 / 60, { run: true, wish, contact: { nx: -1, nz: 0, kind: 1 }, jump: false });
	assert.ok(!W.park.running());
	W.park.grounded();
	// straight at it
	W.at(26.7, -10, 0.4); W.s.grounded = false;
	W.s.vel.set(9, 5.2, 0);
	W.park.air(1 / 60, { run: true, wish: new THREE.Vector3(1, 0, 0), contact: { nx: -1, nz: 0, kind: 1 }, jump: false });
	assert.ok(!W.park.running() && W.s.vel.y > 6.5, 'kicked up it, on top of the jump');
	W.s.vel.y = 1;
	W.park.air(1 / 60, { run: true, wish: new THREE.Vector3(1, 0, 0), contact: { nx: -1, nz: 0, kind: 1 }, jump: false });
	assert.equal(W.s.vel.y, 1, 'once a jump');
	// walking, not sprinting: nothing
	W.park.grounded();
	W.at(26.7, -10, 0.4); W.s.grounded = false; W.s.vel.set(3, 1, -4);
	W.park.air(1 / 60, { run: false, wish, contact: { nx: -1, nz: 0, kind: 1 }, jump: false });
	assert.ok(!W.park.running());
});

test('any body (a fighter, a person) can feel for and climb the same, on its own', () => {
	const W = world();
	const F = feelFor({ floorAt: W.floorAt, pushOut: W.pushOut, eye: 1.6 });
	const A = F.scan(20, -3, 0, 0, -1, 1.2, 1.75);
	assert.equal(climbFor(A, 0, 'key'), 'hop');
	assert.equal(climbFor(F.scan(0, -2.2, 0, 0, -1, 1.2, 1.75), 0, 'key'), null, 'the 2.3 m ledge wants a jump first');
	assert.equal(climbFor(F.scan(0, -2.7, 0.6, 0, -1, 0.75, 1.95), 0.6, 'air'), 'pull');
	const C = climbPath('hop', A, { x: 20, z: -3, eye: 1.6 }, 0, -1, 6, 1.6);
	const a = pathAt(C, 0), mid = pathAt(C, 0.45), b = pathAt(C, 1);
	assert.ok(Math.abs(a.z + 3) < 1e-9 && Math.abs(a.eye - 1.6) < 1e-9, 'starts where it stands');
	assert.ok(mid.eye > A.top + 0.8, 'the head well over the fence\'s top as the body goes over it');
	assert.ok(b.z < -4.3 && Math.abs(b.eye - 1.6) < 1e-9, 'ends standing beyond it');
	assert.ok(C.exit >= 3.5 && C.dur > 0.4);
});
