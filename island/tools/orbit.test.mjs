import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOrbitFrame, ORBIT, MOON, SUN, GARGANTUA, musicThrust } from '../src/space/frame.js';
import { nextFlightSpeed } from '../src/flight-speed.js';

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

test('the Moon has a curved collision surface', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P);
	const moon = f.moonCenter(new THREE.Vector3());
	P.pos.copy(moon).add(new THREE.Vector3(0, MOON.radius - 40, 0)); P.vel.set(0, -40, 3);
	assert.ok(f.moonAltitude(P.pos) < 0);
	assert.equal(f.surface(P.pos, P.vel), true);
	near(f.moonAltitude(P.pos), 1.8, 1e-5);
	assert.ok(P.vel.dot(P.pos.clone().sub(moon).normalize()) >= -1e-9);
	assert.equal(f.info(P.pos).moon.landed, true);
});

test('the Sun and Gargantua are fixed world positions that turn with the frame', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P); f.setSun(new THREE.Vector3(0, 1, 0));
	const sun = f.sunCenter(), garg = f.gargCenter();
	near(sun.distanceTo(f.center), SUN.distance, 1); near(garg.distanceTo(f.center), GARGANTUA.distance, 1);
	// moving the ship does not move them
	P.pos.set(5e8, 3e8, -2e8);
	near(f.sunCenter().distanceTo(sun), 0, 1e-3); near(f.gargCenter().distanceTo(garg), 0, 1e-3);
	near(MOON.radius / ORBIT.radius, 0.2726, 1e-3);
});

test('deep-space gears are tenfold but slow exponentially near a surface or the Sun', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P); f.setSun(new THREE.Vector3(0, 1, 0));
	P.pos.y = 5e7;
	const away = new THREE.Vector3(1, 0, 0);
	const nine = f.speed(P.pos, false, 9, 0, away), hundred = f.speed(P.pos, false, 100, 0, away), top = f.speed(P.pos, false, 100000, 0, away);
	assert.ok(hundred > nine * 4 && top > hundred);
	P.pos.y = 200000;
	const down = new THREE.Vector3(0, -1, 0), out = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), .3);
	assert.ok(f.speed(P.pos, false, 100000, 0, down) <= Math.max(f.speed(P.pos, false, 9), 200000 * 3) + 1e-6);
	assert.ok(f.speed(P.pos, false, 100000, 0, out) > 1e8);
	P.pos.copy(f.sunCenter()).add(new THREE.Vector3(SUN.radius * 1.5 + 1e6, 0, 0));
	assert.ok(f.speed(P.pos, false, 100000, 0, new THREE.Vector3(-1, 0, 0)) <= 3e7);
	assert.equal(nextFlightSpeed(9), 1); assert.equal(nextFlightSpeed(9, true), 100); assert.equal(nextFlightSpeed(100000, true), 1);
});

test('stellar entry regions are traversable with finite controlled speed in both directions', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P);
	for (const [at, radius] of [[f.sunCenter(), SUN.radius], [f.gargCenter(), GARGANTUA.rs]]) {
		const inward = new THREE.Vector3(-1, 0, 0);
		P.pos.copy(at).add(new THREE.Vector3(radius * 1.7, 0, 0));
		for (let i = 0; i < 3000 && P.pos.x - at.x > radius * .8; i++) {
			const speed = f.speed(P.pos, false, 100000, 0, inward);
			assert.ok(Number.isFinite(speed) && speed > 1000 && speed < radius * 2);
			P.pos.addScaledVector(inward, speed * .05);
		}
		assert.ok(P.pos.x - at.x < radius, 'the old safety shell no longer prevents entry');
		const outward = inward.clone().negate();
		for (let i = 0; i < 3000 && P.pos.x - at.x < radius * 2.1; i++) P.pos.addScaledVector(outward, f.speed(P.pos, false, 100000, 0, outward) * .05);
		assert.ok(P.pos.x - at.x > radius * 2, 'pilot can leave without a teleport');
	}
});
