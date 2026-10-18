// At the wheel you are your own eye (people/self.js): seen in third person, the body you walked
// in is put away when you take a car or a boat, not left standing at the door with its arms in
// front of the driver's view; a car scene (vehicles/carjack.js) shows and hides it itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createSelf } from '../src/people/self.js';

function rig() {
	const calls = [];
	const me = { M: { want: {}, S: { pos: new THREE.Vector3(), heading: 0, act: {} }, setPose() {}, update() {}, act() {}, place() {} }, P: { root: { visible: false, position: new THREE.Vector3() } } };
	const avatar = { me, show: () => { calls.push('show'); me.P.root.visible = true; }, hide: () => { calls.push('hide'); me.P.root.visible = false; }, ready: () => Promise.resolve() };
	const P = { pos: new THREE.Vector3(0, 1.68, 0), vel: new THREE.Vector3(), yaw: 0, pitch: 0 };
	const W = { player: { state: P }, island: { heightAt: () => 0 }, street: null };
	const flags = { busy: false, driving: false };
	const you = createSelf({ world: () => W, camera: new THREE.PerspectiveCamera(), avatar, ragdolls: {}, people: () => ({ pool: [] }), busy: () => flags.busy, driving: () => flags.driving, hint: () => {} });
	return { you, me, calls, flags };
}

test('seen in third person, taking the wheel puts your body away', () => {
	const { you, me, calls, flags } = rig();
	you.toggle();
	you.update(0.016, 1);
	assert.ok(me.P.root.visible, 'walking: your body, seen');
	flags.busy = flags.driving = true;
	you.update(0.016, 1.1);
	assert.equal(me.P.root.visible, false, 'at the wheel: not left at the door');
	flags.busy = flags.driving = false;
	you.update(0.016, 1.2);
	assert.ok(me.P.root.visible, 'out again: back');
	assert.deepEqual(calls, ['show', 'hide', 'show']);
});

test('a car scene keeps the body it shows', () => {
	const { you, me, calls, flags } = rig();
	you.toggle();
	you.update(0.016, 1);
	flags.busy = true;
	you.update(0.016, 1.1);
	assert.ok(me.P.root.visible, 'carjack: its own to show');
	assert.deepEqual(calls, ['show']);
});

test('the wheel is a car (not its scene) or a boat', () => {
	const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
	assert.match(main, /driving: \(\) => \(drive\.active\(\) && !carjack\.active\(\)\) \|\| !!world\?\.boat\?\.boarded\?\.\(\)/);
});
