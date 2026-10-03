import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabels } from '../src/bay/labels.js';
import { flightMultiplier, nextFlightSpeed } from '../src/flight-speed.js';
import { createOrbitFrame } from '../src/space/frame.js';
import * as THREE from 'three';

function fixture() {
	class Element {
		constructor() { this.style = {}; this.dataset = {}; this.children = []; this.textContent = ''; }
		append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
		remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); }
	}
	globalThis.document = { createElement: () => new Element() };
	let time = 0, id = 0, place = { name: 'First place', sub: 'First region' };
	const timers = new Map(), mount = new Element();
	const labels = createLabels(mount, { loaded: () => true, farWhere: () => place }, null, {
		clock: () => time,
		schedule: (fn, ms) => { timers.set(++id, { fn, at: time + ms }); return id; },
		cancel: id => timers.delete(id),
	});
	const advance = ms => { time += ms; for (const [i, t] of [...timers]) if (time >= t.at) { timers.delete(i); t.fn(); } };
	return { labels, mount, timers, box: mount.children[0], advance, setPlace: p => { place = p; }, update: () => labels.update({ x: 0, y: 5, z: 0 }, false) };
}
test('location starts fading at ten real seconds from entry without needing another frame', () => {
	const f = fixture(); f.update(); f.advance(1300); f.update(); assert.equal(f.box.style.opacity, '1');
	f.advance(8699); assert.equal(f.box.style.opacity, '1'); f.advance(1); assert.equal(f.box.style.opacity, '0');
	f.advance(20000); f.update(); assert.equal(f.box.style.opacity, '0'); assert.equal(f.timers.size, 0);
});
test('entering another place clears the old title and replaces its timer', () => {
	const f = fixture(); f.update(); f.advance(1300); f.update(); f.advance(4700);
	f.setPlace({ name: 'Second place', sub: 'Second region' }); f.update();
	assert.equal(f.box.children[0].textContent, ''); assert.equal(f.box.children[1].textContent, '');
	f.advance(1300); f.update(); assert.equal(f.box.children[0].textContent, 'Second place');
	f.advance(3000); assert.equal(f.box.style.opacity, '1'); // First place's old deadline passed.
	f.advance(5700); assert.equal(f.box.style.opacity, '0');
});
test('bridge arrival reuses the banner; hide/reentry and teardown cannot leave stale labels', () => {
	const f = fixture(); f.update(); f.advance(1300); f.update();
	f.labels.setBridge({ deckFloor: () => 1 }); assert.equal(f.mount.children.length, 1);
	f.labels.hide(); assert.equal(f.box.children[0].textContent, ''); assert.equal(f.timers.size, 0);
	f.update(); f.advance(1300); f.update(); assert.equal(f.box.style.opacity, '1');
	f.labels.dispose(); f.labels.dispose(); f.advance(20000); f.update();
	assert.equal(f.mount.children.length, 0); assert.equal(f.timers.size, 0);
});
test('speed cycles normal/3/6/9/normal and accepts legacy boolean callers', () => {
	let speed = false; const sequence = [];
	for (let i = 0; i < 8; i++) sequence.push(speed = nextFlightSpeed(speed));
	assert.deepEqual(sequence, [3, 6, 9, 1, 3, 6, 9, 1]);
	assert.equal(flightMultiplier(true), 3); assert.equal(flightMultiplier(false), 1);
	for (const v of [undefined, NaN, Infinity, -3, 12]) assert.equal(flightMultiplier(v), 1);
});
test('all speed steps apply in atmosphere and orbit while retaining the orbital ceiling', () => {
	const frame = createOrbitFrame(), p = new THREE.Vector3(0, 1000, 0);
	for (const altitude of [100, 12000, 180000]) {
		p.y = altitude; const normal = frame.speed(p, false, 1);
		for (const speed of [1, 3, 6, 9]) assert.ok(Math.abs(frame.speed(p, false, speed) / normal - speed) < 1e-9);
	}
	p.y = 1e12; assert.equal(frame.speed(p, true, 9), 3e7);
});
