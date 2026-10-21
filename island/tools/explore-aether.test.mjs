// Explore goes after the aether showing near by: it turns aside to each mote, gathers it on foot or
// in a swoop when flying gently, leaves alone what lies across water, and carries on afterwards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createExplore } from '../src/explore.js';
import { GATHER_R } from '../src/magic/aether.js';

const G = 5;
function harness(fn) {
	const prior = Object.fromEntries(['document', 'window', 'addEventListener', 'performance'].map(k => [k, globalThis[k]])), random = Math.random;
	let seed = 7;
	const clock = { now: 0 };
	const node = () => { const classes = new Set(); return { style: {}, append() {}, appendChild() {}, addEventListener() {}, setAttribute() {}, blur() {},
		classList: { add: k => classes.add(k), remove: k => classes.delete(k), contains: k => classes.has(k) } }; };
	globalThis.document = { createElement: node, head: node() }; globalThis.window = {};
	globalThis.addEventListener = () => {};
	Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock.now } });
	Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
	try { return fn(clock, node); } finally {
		Math.random = random;
		for (const [key, value] of Object.entries(prior)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
}

// a world flat at 5 m (sea where wet(x, z)), the player moved by s.auto as player.js moves it, and
// the aether gathered as magic/aether.js gathers it: within reach of where you are
function run({ clock, node, flying = false, boost = 1, motes, wet = () => false, boxes = [], seconds = 120 }) {
	const S = { pos: new THREE.Vector3(0, G + (flying ? 30 : 1.68), 0), vel: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, boost, flying };
	const island = { heightAt: (x, z) => (wet(x, z) ? -3 : G), half: 50000 };
	const real = { loaded: () => true, near: (kind) => (kind === 'boxes' ? boxes : []) };
	const W = { island, real, player: { state: S, input: () => ({ mz: 0 }) }, vegetation: { obstacles: () => [] } };
	const music = { on: () => true, auto() {}, bias() {}, shift() { return 0; }, queue() {},
		pulse: () => ({ playing: true, stepMs: 150, energy: .5, bars: Math.floor(clock.now / 2400), at: Math.floor(clock.now / 2400) * 2400 }) };
	const shown = motes.map(m => ({ ...m })), got = [];
	const E = createExplore({ world: () => W, camera: new THREE.PerspectiveCamera(), drive: { active: () => false }, music,
		you: { state: {} }, avatar: { me: true }, mount: node(), button: node, hint() {}, busy: () => false, isPhone: false, motes: () => shown });
	assert.equal(E.start(), true);
	const dt = 0.05;
	let minY = Infinity;
	for (let f = 0; f < seconds / dt; f++) {
		clock.now += dt * 1000;
		E.steer(dt);
		const A = S.auto || { z: 0 };
		if (flying) {
			const fs = 16 * Math.abs(A.z), cp = Math.cos(S.pitch);
			const k = Math.min(1, dt * 3);
			S.vel.x += (-Math.sin(S.yaw) * cp * fs - S.vel.x) * k; S.vel.y += (Math.sin(S.pitch) * fs - S.vel.y) * k; S.vel.z += (-Math.cos(S.yaw) * cp * fs - S.vel.z) * k;
			S.pos.addScaledVector(S.vel, dt);
			S.pos.y = Math.max(S.pos.y, Math.max(0, island.heightAt(S.pos.x, S.pos.z)) + 1.2);
		} else {
			const v = (A.run ? 10 : 5.2) * Math.abs(A.z);
			S.vel.set(-Math.sin(S.yaw) * v, 0, -Math.cos(S.yaw) * v);
			S.pos.addScaledVector(S.vel, dt);
		}
		minY = Math.min(minY, S.pos.y);
		for (let i = shown.length - 1; i >= 0; i--) {
			const m = shown[i];
			if (Math.hypot(m.x - S.pos.x, m.z - S.pos.z) <= (m.well ? GATHER_R + 1.2 : GATHER_R) && Math.abs(m.y - (S.pos.y - 0.9)) <= 3) got.push(shown.splice(i, 1)[0].key);
		}
		E.shoot(dt);
	}
	const info = E.info();
	E.stop('quiet');
	return { got, info, S, minY };
}

test('on foot, Explore turns aside to the motes near by and gathers them', () => harness((clock, node) => {
	const motes = [
		{ key: 'a', x: 22, y: G + 1.1, z: -35, strand: 'light', well: false },
		{ key: 'b', x: -25, y: G + 1.1, z: -20, strand: 'light', well: false },
		{ key: 'w', x: 30, y: G + 0.4, z: -80, strand: 'dark', well: true },
	];
	const { got, info } = run({ clock, node, motes });
	assert.deepEqual([...got].sort(), ['a', 'b', 'w']);
	assert.equal(info.aether.gathered, 3);
	assert.equal(info.aether.seeking, null);
}));

test('on foot, a mote across water is left alone', () => harness((clock, node) => {
	const motes = [{ key: 'isle', x: 0, y: G + 1.1, z: -45, strand: 'light', well: false }];
	// (a channel between you and it; the mote itself on dry land)
	const { got, info } = run({ clock, node, motes, wet: (x, z) => z < -15 && z > -35, seconds: 20 });
	assert.deepEqual(got, []);
	assert.equal(info.aether.sought, 0);
}));

test('a mote standing in a building is left alone, on foot and flying', () => harness((clock, node) => {
	const motes = [{ key: 'indoors', x: 10, y: G + 1.1, z: -40, strand: 'light', well: false }];
	const boxes = [{ x: 12, z: -42, w: 14, d: 10, wallH: 9 }];
	for (const flying of [false, true]) {
		const { got, info } = run({ clock, node, motes, boxes, flying, seconds: 20 });
		assert.deepEqual(got, []);
		assert.equal(info.aether.sought, 0);
	}
}));

test('flying gently, Explore swoops down through a mote ahead and climbs away again', () => harness((clock, node) => {
	const motes = [{ key: 'far', x: 20, y: G + 1.1, z: -110, strand: 'light', well: false }];
	const { got, info, S } = run({ clock, node, motes, flying: true, seconds: 40 });
	assert.deepEqual(got, ['far']);
	assert.equal(info.aether.gathered, 1);
	assert.ok(S.pos.y > G + 10, `climbed back to a cruising height (${(S.pos.y - G).toFixed(1)} m)`);
}));

test('flying fast, Explore cruises on past the aether', () => harness((clock, node) => {
	const motes = [{ key: 'far', x: 0, y: G + 1.1, z: -110, strand: 'light', well: false }];
	const { got, info } = run({ clock, node, motes, flying: true, boost: 6, seconds: 15 });
	assert.deepEqual(got, []);
	assert.equal(info.aether.sought, 0);
}));
