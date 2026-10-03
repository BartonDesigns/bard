import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSky } from '../src/world/sky.js';
import { climateNow } from '../src/region/climate.js';
import { BAY_LATITUDE, solarDeclination, solarDaylight, solarDate, solarTimes, solarDirection, advanceSolarClock } from '../src/world/solar.js';

const RAD = Math.PI / 180;
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const day = (lat, date) => { const sun = solarDate(new Date(`${date}T12:00:00`)); return { ...sun, ...solarTimes(lat, sun.dec, sun.noon) }; };

test('rendered solar geometry and regional polar daylight use the same season', () => {
	for (const lat of [-90, -78.22, -67, 0, 37.8, 67, 78.22, 90]) for (let month = 0; month < 12; month += 0.25) {
		const C = climateNow({ lat }, month), S = solarDaylight(lat, solarDeclination(month));
		assert.equal(S.polar, C.polar);
		near(S.daylight, C.daylight);
		near(S.daylight + solarDaylight(-lat, solarDeclination(month)).daylight, 24);
		assert.ok(Number.isFinite(S.daylight) && S.daylight >= 0 && S.daylight <= 24);
	}
});

test('polar summer remains above the horizon all day and winter below, in both hemispheres', () => {
	for (const lat of [78.22, 90, -78.22, -90]) for (const month of [5.67, 11.67]) {
		const dec = solarDeclination(month), summer = (lat > 0) === (month < 6);
		for (let hours = 0; hours < 24; hours += 0.25) {
			const v = solarDirection(lat, dec, hours, 12);
			assert.equal(v.y > 0, summer, `${lat}, ${month}, ${hours}`);
			near(Math.hypot(v.x, v.y, v.z), 1);
		}
	}
});

test('sunrise is east, sunset west, and southern and northern noon directions are correct', () => {
	near(solarDirection(0, 0, 6, 12).x, 1);
	near(solarDirection(0, 0, 18, 12).x, -1);
	near(solarDirection(0, 0, 12, 12).y, 1);
	assert.ok(solarDirection(45, 0, 12, 12).z > 0);
	assert.ok(solarDirection(-45, 0, 12, 12).z < 0);
	near(solarDaylight(0, solarDeclination(5.67)).daylight, 12);
});

test('the accelerated clock keeps moving forward through polar midnight and polar night', () => {
	for (const [lat, date] of [[78.22, '2026-06-21'], [78.22, '2026-12-21'], [-78.22, '2026-06-21'], [-78.22, '2026-12-21']]) {
		const S = day(lat, date), rate = S.polar === 'sun' ? 24 / 540 : 24 / 150;
		for (let hours = 0; hours < 24; hours += 0.1) {
			const next = advanceSolarClock(hours, 0.1, 1, S);
			assert.ok(next >= 0 && next < 24);
			near((next - hours + 24) % 24, rate * 0.1);
			near(advanceSolarClock(hours, 1, 0, S), hours);
		}
	}
});

test('Bay latitude, noon convention and seasonal sunrise remain within their established range', () => {
	for (const date of ['2026-01-15', '2026-06-21', '2026-10-03']) {
		const S = day(undefined, date), N = S.day;
		assert.equal(S.lat, BAY_LATITUDE);
		const B = 2 * Math.PI * (N - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
		near(S.noon, 12 + (N > 69 && N < 307 ? 1 : 0) + 2.4 / 15 - eot / 60);
		const formerDec = 23.44 * RAD * Math.sin(2 * Math.PI * (284 + N) / 365);
		const formerDaylight = solarDaylight(BAY_LATITUDE, formerDec, -0.833).daylight;
		assert.ok(Math.abs(S.set - S.rise - formerDaylight) < 0.25);
		assert.ok(S.rise > 4 && S.rise < 9 && S.set > 16 && S.set < 22);
	}
});

function makeSky(latitude) {
	const scene = new THREE.Scene(), shared = {
		uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() },
		uSkyZen: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() },
		uTime: { value: 0 }, uHigh: { value: 0 }, uAmbient: { value: new THREE.Color() },
		uWindDir: { value: new THREE.Vector2(1, 0) },
	};
	const renderer = { getPixelRatio: () => 1, toneMapping: THREE.AgXToneMapping };
	const sky = createSky(scene, shared, renderer, latitude ? { latitude } : {});
	return { sky, shared, scene };
}

test('the actual sky updates latitude and selected month without changing the time slider', () => {
	const previousLocation = globalThis.location;
	try {
		globalThis.location = { search: '?date=2026-01-15' };
		let latitude = 78.22;
		const { sky, shared } = makeSky(() => latitude), focus = new THREE.Vector3(10, 5, 20);
		sky.state.hours = 12;
		const winter = sky.update(0, focus);
		assert.ok(shared.uSunDir.value.y < 0);
		assert.equal(sky.state.sun.polar, 'night');
		assert.equal(sky.dark(), false); // Polar night can still have noon twilight.
		assert.ok(winter.night > 0.9);
		sky.state.hours = 0;
		sky.update(0, focus);
		assert.equal(sky.dark(), true);
		globalThis.location = { search: '?date=2026-07-15' };
		sky.state.hours = 0;
		const summer = sky.update(0, focus);
		assert.ok(shared.uSunDir.value.y > 0);
		assert.equal(sky.state.sun.polar, 'sun');
		assert.equal(sky.state.hours, 0);
		assert.equal(sky.dark(), false);
		assert.equal(summer.night, 0);
		latitude = -78.22;
		sky.state.hours = 12;
		sky.update(0, focus);
		assert.ok(shared.uSunDir.value.y < 0);
		assert.equal(sky.state.sun.polar, 'night');
		assert.equal(sky.state.sun.lat, -78.22);
		latitude = NaN;
		sky.update(0, focus);
		assert.equal(sky.state.sun.lat, BAY_LATITUDE);
	} finally { globalThis.location = previousLocation; }
});

test('catalogue stars and planets use the same latitude and noon rotation as the sun', () => {
	const previousLocation = globalThis.location;
	try {
		globalThis.location = { search: '?date=2026-06-21' };
		let latitude = 0;
		const { sky, shared } = makeSky(() => latitude);
		for (latitude of [-90, -78.22, 0, 37.8, 78.22, 90]) for (const hours of [0, 6, 12, 18]) {
			sky.state.hours = hours;
			sky.update(0, new THREE.Vector3());
			const sun = sky.state.sun, catalogue = sky.celestial(sun.ra, sun.dec / RAD);
			near(catalogue.distanceTo(shared.uSunDir.value), 0);
			const pole = sky.celestial(0, 90);
			near(pole.y, Math.sin(latitude * RAD));
			assert.ok(Number.isFinite(sky.uniforms.uW2E.value.determinant()));
		}
	} finally { globalThis.location = previousLocation; }
});

test('a native island without a globe retains Bay latitude and finite light uniforms', () => {
	const { sky, shared } = makeSky();
	for (const hours of [0, 6, 12, 18, 23.99]) {
		sky.state.hours = hours;
		sky.update(0, new THREE.Vector3());
		assert.equal(sky.state.sun.lat, BAY_LATITUDE);
		near(shared.uSunDir.value.length(), 1);
		assert.ok(Number.isFinite(sky.sun.intensity));
		assert.ok(Number.isFinite(sky.hemi.intensity));
	}
});
