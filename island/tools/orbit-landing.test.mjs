import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOrbitFrame, ORBIT } from '../src/space/frame.js';
import { geoBasis, kmBetween, regionNote, citiesAround, kmLabel } from '../src/space/landing.js';
import { loadAtlas, POP } from '../src/earth/atlas.js';

const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const player = () => ({ pos: new THREE.Vector3(1832.4, ORBIT.start, -5491.2), vel: new THREE.Vector3(12, -1400, -35), yaw: .6, pitch: -.3, roll: 0 });
const ray = (f, P, body) => body.clone().applyQuaternion(f.rotation).add(f.center).sub(P.pos)
	.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(P.pitch, P.yaw, P.roll, 'YXZ')).invert()).normalize();

test('the point under the ship is the departure until it moves, then the real place it is over', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P, { lat: 37.77, lon: -121.94 });
	const at = f.below(P.pos); near(at.lat, 37.77); near(at.lon, -121.94);
	P.pos.y = 400000; near(f.below(P.pos).lat, 37.77);
	for (const [lat, lon] of [[48.85, 2.35], [-33.9, 151.2], [64.1, -21.9], [-3, -60], [35.7, 139.7]]) {
		P.pos.copy(f.center).addScaledVector(f.dirOf(lat, lon), ORBIT.radius + 400000);
		const b = f.below(P.pos); near(b.lat, lat, 1e-6); near(b.lon, lon, 1e-6);
	}
	// the globe frame's own axes: +x east, -z north
	assert.ok(Math.abs(geoBasis(37.7, -122.5).determinant()) > .999);
});

test('landing elsewhere keeps every view ray and momentum, and lays the place under the ship', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P, { lat: 37.77, lon: -121.94 });
	P.pos.y = 200000; f.update(P);
	P.pos.copy(f.center).addScaledVector(f.dirOf(48.85, 2.35), ORBIT.radius + 94000);
	const body = new THREE.Vector3(2e8, -3e8, 4e8), before = ray(f, P, body), speed = P.vel.length();
	const at = f.below(P.pos);
	assert.equal(f.land(P, { ...at, x: -400000, z: 120 }), true);
	near(P.pos.x, -400000); near(P.pos.z, 120); near(f.altitude(P.pos), 94000, 1e-3);
	assert.ok(before.distanceTo(ray(f, P, body)) < 1e-9);
	near(P.vel.length(), speed, 1e-6);
	const b = f.below(P.pos); near(b.lat, 48.85, 1e-6); near(b.lon, 2.35, 1e-6);
	// east and north on the ground are east and north on the globe
	const e = f.below(P.pos.clone().add(new THREE.Vector3(20000, 0, 0))), n = f.below(P.pos.clone().add(new THREE.Vector3(0, 0, -20000)));
	assert.ok(e.lon > 2.35 && Math.abs(e.lat - 48.85) < .01);
	assert.ok(n.lat > 48.85 && Math.abs(n.lon - 2.35) < .01);
	// the climb's start is kept, the anchor is the new place, and no second rebase follows
	assert.deepEqual(f.home, { lat: 37.77, lon: -121.94 });
	near(f.anchor.lat, 48.85, 1e-6); assert.equal(f.returning, false); assert.equal(f.update(P), false);
});

test('flying round the planet keeps a level course level', () => {
	const P = player(), f = createOrbitFrame(); f.capture(P, { lat: 0, lon: 0 });
	P.pos.y = 400000; P.yaw = -Math.PI / 2; P.pitch = 0; P.roll = 0; P.vel.set(200000, 0, 0);
	const r0 = f.altitude(P.pos);
	for (let i = 0; i < 2000; i++) {
		const from = P.pos.clone();
		P.pos.addScaledVector(P.vel, 1 / 60);
		f.transport(P, from);
	}
	// a quarter of the way round a circle, the height is held within a few kilometres
	assert.ok(Math.abs(f.altitude(P.pos) - r0) < 5000, `${f.altitude(P.pos)}`);
	const up = P.pos.clone().sub(f.center).normalize();
	assert.ok(Math.abs(P.vel.clone().normalize().dot(up)) < .01);
	assert.ok(f.below(P.pos).lon > 40);
});

test('the region note says where you will land and what is built there', async () => {
	await loadAtlas();
	const paris = regionNote(48.85, 2.35);
	assert.equal(paris.kind, 'land'); assert.match(paris.title, /Paris/); assert.match(paris.sub, /France/); assert.match(paris.sub, /generated/);
	const bay = regionNote(37.77, -121.94);
	assert.equal(bay.kind, 'bay'); assert.match(bay.sub, /hand-built/);
	const sea = regionNote(0, -30);
	assert.equal(sea.kind, 'sea'); assert.match(sea.title, /Atlantic/);
	assert.match(regionNote(88, 0).sub, /83\.5/);
	near(kmBetween({ lat: 48.85, lon: 2.35 }, { lat: 51.5, lon: -0.12 }), 343, 3);
});

test('the cities to head for: the nearest first, then the biggest round it, no suburbs twice', async () => {
	await loadAtlas();
	const loire = citiesAround(47.3, 1.0, 6);
	assert.ok(loire.length >= 4, JSON.stringify(loire));
	assert.ok(loire.slice(1).every((c) => c.km >= loire[0].km));
	assert.ok(loire.some((c) => c.pop >= 3), 'a big city in reach');
	for (let i = 0; i < loire.length; i++) for (let j = i + 1; j < loire.length; j++) assert.ok(kmBetween(loire[i], loire[j]) > 25, `${loire[i].name} / ${loire[j].name}`);
	const paris = citiesAround(48.856, 2.352, 4);
	assert.match(paris[0].name, /Paris/); assert.ok(paris[0].km < 3); assert.equal(paris[0].size, POP[paris[0].pop]);
	// far out at sea: still the nearest, wherever it is
	const sea = citiesAround(35, -35, 3);
	assert.equal(sea.length, 1); assert.ok(sea[0].km > 350);
	assert.equal(kmLabel(.42), '420 m'); assert.equal(kmLabel(7.25), '7.3 km'); assert.equal(kmLabel(1240.4), '1,240 km');
});
