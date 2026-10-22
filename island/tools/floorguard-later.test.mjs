// The floor guard's looks at the ground as drawn, read back a frame or two late (world/
// floorguard.js, world/groundprobe.js probeLater): where the card allows, a look is a promise of
// the height, taken up by the check once it is kept, with the same verdict and the same repair;
// elsewhere, and for the harnesses, the height comes at once as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFloorGuard } from '../src/world/floorguard.js';
import { createGroundProbe, probeLater } from '../src/world/groundprobe.js';
import { generateIsland } from '../src/world/islandgen.js';
import { planetProfile } from '../src/planet/profile.js';

const I = generateIsland({ seed: 77, biome: 'TERRAN', resolution: 256, profile: planetProfile('TERRAN', 77), land: null });
// a world with just what the guard reads, the player standing where the ground is drawn right
function fakeWorld() {
	const center = { x: 0, y: 0 }, tex = { image: { data: I.height }, needsUpdate: false };
	const camera = { position: { x: 0, y: 0, z: 0 } };
	const P = { pos: { x: 0, y: 0, z: 0 }, flying: false, swimming: false, diving: false };
	const terrain = { visible: true, parent: {}, userData: { center, heightTex: () => tex, update: (cam) => { center.x = Math.round(cam.position.x / 4) * 4; center.y = Math.round(cam.position.z / 4) * 4; } } };
	const W = { island: I, terrain, player: { state: P, floorAt: (x, z) => I.heightAt(x, z) } };
	const x = I.spawn.x, z = I.spawn.z, y = I.heightAt(x, z) + 1.68;
	P.pos.x = camera.position.x = x; P.pos.z = camera.position.z = z; P.pos.y = camera.position.y = y;
	terrain.userData.update(camera);
	return { W, camera, tex, walk: I.heightAt(x, z) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('a look that comes back later is taken up as it would have been at once', async () => {
	const F = fakeWorld(), logs = [], asked = [];
	let answer = null;
	const probe = (x, z) => { asked.push([x, z]); return new Promise((ok) => { answer = ok; }); };
	const guard = createFloorGuard({ world: () => F.W, camera: F.camera, probe, every: 0, gpuEvery: 1, log: (...a) => logs.push(a.join(' ')) });
	for (let k = 0; k < 4; k++) assert.equal(guard.check(1, { open: true }).verdict, 'ok');
	assert.equal(asked.length, 1);
	// (still on its way: no other look is asked for, nothing is judged)
	for (let k = 0; k < 4; k++) guard.check(1, { open: true });
	assert.equal(asked.length, 1);
	assert.equal(guard.info().gpu.looks, 0);
	// it comes back 30 m below the floor: a gap, repaired as before (the texture sent again)
	answer(F.walk - 30);
	await tick();
	guard.check(1, { open: true });
	const info = guard.info();
	assert.equal(info.gpu.looks, 1);
	assert.equal(info.gpu.bad, 1);
	assert.equal(info.gpu.last, 'gap');
	assert.equal(F.tex.needsUpdate, true);
	assert.ok(logs.some((l) => /30\.0 m off/.test(l)));
	// and the next look is asked for in a second, to see the repair held
	guard.check(1, { open: true });
	assert.equal(asked.length, 2);
	answer(F.walk + 0.2);
	await tick();
	guard.check(1, { open: true });
	assert.equal(guard.info().gpu.last, 'ok');
	assert.equal(guard.info().gpu.bad, 1);
});

test('a look taken in another world is let go', async () => {
	const F = fakeWorld(), G = fakeWorld();
	let W = F.W, answer = null;
	const guard = createFloorGuard({ world: () => W, camera: F.camera, probe: () => new Promise((ok) => { answer = ok; }), every: 0, gpuEvery: 1, log: () => {} });
	for (let k = 0; k < 3; k++) guard.check(1, { open: true });
	W = G.W;
	answer(F.walk - 30);
	await tick();
	guard.check(1, { open: true });
	assert.equal(guard.info().gpu.looks, 0);
	assert.equal(G.tex.needsUpdate, false);
});

// a renderer with just what the probe draws and reads with: depth 0.25 under the centre
function renderer({ async = true, fail = false } = {}) {
	const R = {
		shadowMap: { autoUpdate: true }, autoClear: true, reads: 0, asyncReads: 0,
		getRenderTarget: () => null, setRenderTarget() {}, clear() {}, render() {},
		readRenderTargetPixels(rt, x, y, w, h, buf) { R.reads++; buf.fill(0.25); },
		getContext: () => (async ? { fenceSync() {} } : {}),
	};
	if (async) R.readRenderTargetPixelsAsync = async (rt, x, y, w, h, buf) => { R.asyncReads++; await tick(); if (fail) throw new Error('lost'); buf.fill(0.25); return buf; };
	return R;
}

test('the probe reads at once, and later only when asked inside probeLater and the card can', async () => {
	const scene = new THREE.Scene(), want = 100 - (0.05 + 0.25 * (200 - 0.05));
	for (const async of [true, false]) {
		const R = renderer({ async }), P = createGroundProbe(R);
		assert.ok(Math.abs(P.probe(scene, 0, 0, { top: 100, span: 200 }) - want) < 1e-9);
		assert.equal(R.reads, 1);
		const later = probeLater(() => P.probe(scene, 0, 0, { top: 100, span: 200 }));
		if (async) {
			assert.equal(typeof later.then, 'function');
			assert.ok(Math.abs(await later - want) < 1e-9);
			assert.equal(R.reads, 1);
		} else assert.ok(Math.abs(later - want) < 1e-9);
		// (and at once again, outside it)
		assert.equal(typeof P.probe(scene, 0, 0, { top: 100, span: 200 }), 'number');
		P.dispose();
	}
});

test('a late read that fails has the guard read at once from then on', async () => {
	const F = fakeWorld(), R = renderer({ fail: true }), P = createGroundProbe(R), scene = new THREE.Scene();
	const guard = createFloorGuard({ world: () => F.W, camera: F.camera, probe: (x, z) => P.probe(scene, x, z, { top: F.walk + 100, span: 200 }), every: 0, gpuEvery: 1, log: () => {} });
	for (let k = 0; k < 4; k++) guard.check(1, { open: true });
	assert.equal(R.asyncReads, 1);
	await tick(); await tick();
	for (let k = 0; k < 3; k++) guard.check(1, { open: true });
	assert.equal(R.asyncReads, 1);
	assert.ok(R.reads >= 1);
	assert.ok(guard.info().gpu.looks >= 1);
});

// the scene's lights as three tallies them for a draw: each kind, with its shadow, seen
function tally(scene) {
	const n = {};
	scene.traverseVisible((o) => { if (o.isLight) { const k = o.type + (o.castShadow ? '+shadow' : ''); n[k] = (n[k] || 0) + 1; } });
	return n;
}

test('the probe draws with the lights the frame has, and leaves a shadow redraw for the frame', () => {
	const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(0xffffff, 3), ground = new THREE.Group(), pad = new THREE.Group(), city = new THREE.Group();
	sun.castShadow = true;
	sun.userData.self = sun;   // (a light's own data is not copied: this one could not be)
	ground.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1)));
	for (let k = 0; k < 4; k++) pad.add(new THREE.PointLight(0xffaa66, 0));
	const off = new THREE.PointLight(); off.visible = false; pad.add(off);
	const lamp = new THREE.SpotLight(); lamp.castShadow = true; city.add(new THREE.Group().add(lamp));
	scene.add(sun, new THREE.HemisphereLight(), ground, pad, city);
	const want = tally(scene), seen = [];
	const R = renderer({ async: false });
	R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = true;
	R.render = (s) => { if (s === scene) seen.push({ lights: tally(s), redraw: R.shadowMap.needsUpdate, drawn: s.children.filter((o) => o.visible && !o.isLight) }); };
	const P = createGroundProbe(R), count = scene.children.length;
	for (let k = 0; k < 2; k++) P.probe(scene, 0, 0, { top: 100, span: 200, keep: (o) => o === ground });
	assert.equal(seen.length, 2);
	for (const S of seen) {
		assert.deepEqual(S.lights, want);
		assert.equal(S.redraw, false);
		assert.deepEqual(S.drawn, [ground]);
	}
	// (and all as it was after)
	assert.equal(scene.children.length, count);
	assert.equal(R.shadowMap.needsUpdate, true);
	assert.equal(R.shadowMap.autoUpdate, false);
	assert.ok(pad.visible && city.visible && sun.visible);
	assert.deepEqual(tally(scene), want);
	P.dispose();
});

test('a player standing still on ground found right is not looked at again until they move', () => {
	const F = fakeWorld(), asked = [];
	const P = F.W.player.state;
	const probe = (x, z) => { asked.push([x, z]); return F.W.player.floorAt(x, z); };
	const guard = createFloorGuard({ world: () => F.W, camera: F.camera, probe, every: 0, gpuEvery: 1, log: () => {} });
	for (let k = 0; k < 20; k++) guard.check(1, { open: true });
	assert.equal(asked.length, 1);
	assert.equal(guard.info().gpu.last, 'ok');
	// (a step or two is still the same ground)
	P.pos.x += 1.5;
	for (let k = 0; k < 5; k++) guard.check(1, { open: true });
	assert.equal(asked.length, 1);
	// off it: looked at again
	P.pos.x += 5; F.camera.position.x = P.pos.x; P.pos.y = F.camera.position.y = I.heightAt(P.pos.x, P.pos.z) + 1.68;
	F.W.terrain.userData.update(F.camera);
	for (let k = 0; k < 3; k++) guard.check(1, { open: true });
	assert.equal(asked.length, 2);
});
