import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOrbitFrame, ORBIT, musicThrust } from '../src/space/frame.js';

const player = (x = 1832.4, z = -5491.2) => ({ pos: new THREE.Vector3(x, ORBIT.start, z), vel: new THREE.Vector3(12, -1400, -35), yaw: .6, pitch: -.3, roll: 0 });
const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('ascent and immediate reversal share a continuous altitude band without a mode timer', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P, { lat: 37.7, lon: -122.5 });
	for (const h of [12000, 18000, 25000, 40000, 60000, 40000, 18000, 12000]) {
		P.pos.y = h; f.update(P); near(f.altitude(P.pos), h);
		assert.ok(f.blend(P.pos) >= 0 && f.blend(P.pos) <= 1);
		near(P.pos.x, 1832.4); near(P.pos.z, -5491.2);
	}
	assert.equal(f.info(P.pos).entries, 0);
});

test('entry from another side restores the exit coordinates while preserving view and momentum', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P);
	P.pos.y = 200000; f.update(P);
	const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.2);
	P.pos.copy(new THREE.Vector3(0, ORBIT.radius + 94000, 0).applyQuaternion(tilt).add(f.center));
	const body = new THREE.Vector3(2e8, -3e8, 4e8), center = f.center.clone();
	const cameraBefore = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.pitch, P.yaw, P.roll, 'YXZ'));
	const rayBefore = body.clone().add(center).sub(P.pos).applyQuaternion(cameraBefore.clone().invert()).normalize();
	const speed = P.vel.length();
	assert.equal(f.update(P), true);
	near(P.pos.x, 1832.4); near(P.pos.z, -5491.2); near(P.pos.y, 94000);
	const cameraAfter = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.pitch, P.yaw, P.roll, 'YXZ'));
	const rayAfter = body.clone().applyQuaternion(f.rotation).add(center).sub(P.pos).applyQuaternion(cameraAfter.invert()).normalize();
	assert.ok(rayBefore.distanceTo(rayAfter) < 1e-9);
	near(P.vel.length(), speed); assert.equal(f.info(P.pos).entries, 1);
});

test('repeated departures replace the anchor and do not retain another planet or globe location', () => {
	const P = player(), f = createOrbitFrame();
	for (let i = 0; i < 30; i++) {
		f.reset(); P.pos.set(i * 1234, ORBIT.start, -i * 765); f.capture(P, { lat: 12 + i, lon: -70 });
		P.pos.y = 200000; f.update(P); P.pos.y = 90000; f.update(P);
		near(P.pos.x, i * 1234); near(P.pos.z, -i * 765);
		assert.equal(f.anchor.lat, 12 + i);
	}
});

test('approach speed is bounded and music cannot reverse or generate commanded motion', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P);
	let last = 0;
	for (const h of [1, 100, 12000, 60000, 1e5, 1e6, 1e9, 1e12]) {
		P.pos.y = h; const speed = f.speed(P.pos, true, true);
		assert.ok(speed >= last && speed <= 3e7); last = speed;
	}
	near(musicThrust(0, 0), 1); near(musicThrust(100, 100), 1.12); near(musicThrust(-1, -1), 1);
	const commanded = new THREE.Vector3(); commanded.multiplyScalar(musicThrust(1, 1));
	assert.equal(commanded.length(), 0);
	for (const seam of [ORBIT.start, ORBIT.end]) {
		P.pos.y = seam - .01; const before = f.speed(P.pos, false, false);
		P.pos.y = seam + .01; assert.ok(Math.abs(f.speed(P.pos, false, false) - before) < .01);
	}
});

test('a high speed descent re-enters before the surface, including a large frame step', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P); P.pos.y = 2e6; f.update(P);
	let crossed = false;
	for (let i = 0; i < 5000 && P.pos.y > 500; i++) {
		const h = f.altitude(P.pos);
		P.pos.y -= f.speed(P.pos, true, true) * .05;
		crossed = f.update(P) || crossed;
		assert.ok(f.altitude(P.pos) < h);
	}
	assert.equal(crossed, true); assert.ok(P.pos.y > 0 && P.pos.y < 500);
});
