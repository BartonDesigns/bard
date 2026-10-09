import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shotFrame } from '../src/explore-shots.js';
import { createExplore } from '../src/explore.js';

test('crane framing eases in and out, stays bounded and holds the completed reveal', () => {
	const shot = { a: 1.2, d: 8, h: 2, lh: 1.2, ahead: 2, end: { a: .7, d: 16, h: 12, ahead: 6 } };
	let previous = 2;
	for (let ms = 0; ms <= 16000; ms += 16) {
		const f = shotFrame(shot, ms, 12000);
		assert.ok(f.h >= previous && f.h >= 2 && f.h <= 12);
		assert.ok(f.d >= 8 && f.d <= 16); previous = f.h;
	}
	assert.ok(shotFrame(shot, 16, 12000).h - 2 < .00001);
	assert.ok(12 - shotFrame(shot, 11984, 12000).h < .00001);
	assert.equal(shotFrame(shot, 18000, 12000).h, 12);
});

test('actual Explore camera retains clear ground, phrase-length moves and manual takeover', () => {
	const prior = Object.fromEntries(['document', 'window', 'addEventListener', 'performance'].map(k => [k, globalThis[k]])), random = Math.random;
	let now = 0, seed = 42; const handlers = {};
	const node = () => { const classes = new Set(); return { style: {}, append() {}, appendChild() {}, addEventListener() {}, setAttribute() {}, blur() {},
		classList: { add: k => classes.add(k), remove: k => classes.delete(k), contains: k => classes.has(k) } }; };
	globalThis.document = { createElement: node, head: node() }; globalThis.window = {};
	globalThis.addEventListener = (key, fn) => { handlers[key] = fn; };
	Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
	Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	try {
		for (const flying of [false, true]) {
			const S = { pos: new THREE.Vector3(0, flying ? 60 : 1.68, 0), vel: new THREE.Vector3(0, 0, flying ? -20 : -2), yaw: 0, pitch: 0, boost: 1, flying };
			const island = { heightAt: () => 0, half: 50000 }, camera = new THREE.PerspectiveCamera(), mount = node();
			const W = { island, player: { state: S, input: () => ({ mz: 0 }) }, vegetation: { obstacles: () => [] } };
			let musicOn = false;
			const music = { on: () => musicOn, auto: b => { musicOn = b; }, bias() {}, shift() { return 0; },
				pulse: () => ({ playing: true, stepMs: 150, energy: .5, bars: Math.floor(now / 2400), at: Math.floor(now / 2400) * 2400 }) };
			const E = createExplore({ world: () => W, camera, drive: { active: () => false }, music,
				you: { state: {} }, avatar: { me: true }, mount, button: node, hint() {}, busy: () => false, isPhone: false });
			assert.equal(E.start(), true);
			for (let frame = 0; frame < 9000; frame++) {
				now += 100; E.steer(.1); S.pos.addScaledVector(S.vel, .1); E.shoot(.1);
				assert.ok(camera.position.y >= .35); assert.ok(camera.position.toArray().every(Number.isFinite));
			}
			const shots = E.info().shots;
			assert.ok(shots.some(s => s.shot === 'crane')); assert.ok(shots.some(s => s.shot === 'establish'));
			for (let i = 1; i < shots.length; i++) if (['crane', 'establish', 'reveal'].includes(shots[i - 1].shot)) {
				assert.ok(shots[i].bar - shots[i - 1].bar >= 5, 'complete camera move before cutting');
			}
			handlers.keydown({ key: 'w', preventDefault() {} });
			assert.equal(E.on(), false); assert.equal(S.auto, null); assert.equal(musicOn, false);
		}
	} finally {
		Math.random = random;
		for (const [key, value] of Object.entries(prior)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
});
