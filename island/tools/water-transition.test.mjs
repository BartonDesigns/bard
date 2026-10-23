import test from 'node:test';
import assert from 'node:assert/strict';
import { waterContact } from '../src/world/water-contact.js';
import { createCarveAtlas, waterDelta, WC_U, WN, inWater, setWaterHooks } from '../src/bay/watercarve.js';

test('water effects follow local liquid and exclude dry ground, caves and airless terrain', () => {
	const island = { heightAt: () => -10, waterAt: () => null };
	const at = (y, ground = -10) => waterContact(island, { x: 0, y, z: 0 }, ground, 0, 0);
	assert.equal(at(1000).under, false);
	assert.equal(at(-2).under, true);
	assert.equal(at(-2, 2).under, false);
	island.underFloor = () => -10;
	assert.equal(at(-2).under, false);
	delete island.underFloor; island.hasOcean = false;
	assert.equal(at(-2).under, false);
	island.waterAt = () => 900;
	assert.equal(at(898, 890).under, true, 'raised lake uses its own level');
	assert.equal(at(1000, 890).under, false);
});

const draw = new Float32Array((WN + 1) ** 2 * 2);
const bed = value => new Float32Array((WN + 1) ** 2).fill(value);
test('leaving a world removes its water heights, terrain carving and vegetation hooks', () => {
	const old = createCarveAtlas(1);
	old.put(0, 0, draw, bed(-75)); old.centre(10, 10, 720);
	setWaterHooks({ water: () => true });
	assert.equal(waterDelta(10, 10), -75); assert.equal(inWater(10, 10), true);
	old.dispose();
	assert.equal(waterDelta(10, 10), 0); assert.equal(inWater(10, 10), false);
	assert.equal(WC_U.uWcR.value.w, 0);
	assert.equal(old.put(0, 0, draw, bed(1000)), false);
});

test('late cleanup or work from the previous world cannot overwrite the new water atlas', () => {
	const old = createCarveAtlas(1), next = createCarveAtlas(1);
	next.put(0, 0, draw, bed(-2)); next.centre(10, 10, 720);
	old.dispose(); old.centre(9000, 9000, 10000);
	assert.equal(waterDelta(10, 10), -2); assert.equal(WC_U.uWcR.value.w, 720);
	next.dispose();
});

test('a jump of the globe frame lets go of the water worked out for the old ground', async () => {
	const THREE = await import('three');
	const { createWater } = await import('../src/bay/water.js');
	const { proceduralWater } = await import('../src/crysis/rivers.js');
	const U = () => ({ value: new THREE.Vector3() });
	const shared = new Proxy({ planet: {}, bayU: {} }, { get: (t, k) => (k in t ? t[k] : (t[k] = U())) });
	// (the same engine metres, two places: the old one 250 m higher)
	let lift = 250;
	const ground = (x, z) => lift + 60 + 0.004 * x - 0.002 * z + 25 * Math.sin(x / 700) * Math.cos(z / 900) - 30 * Math.exp(-((x - 2000) ** 2 + (z - 1500) ** 2) / 4e5);
	const gen = proceduralWater({ heightAt: ground, inSurvey: () => false });
	const W = createWater(new THREE.Scene(), shared, { sources: [gen], mode: 'bay', heightAt: ground });
	const cam = { position: new THREE.Vector3(2000, 400, 1500) };
	let t = 0;
	const run = () => { for (let k = 0; k < 4000 && !(W.info().carved > 3 && W.info().queue === 0); k++) { gen.pump(2000, 1500, 3000, 50); W.update(0.1, t += 0.1, cam); } };
	const most = () => { let m = 0; for (let x = 1000; x < 3000; x += 16) for (let z = 500; z < 2500; z += 16) m = Math.max(m, Math.abs(waterDelta(x, z))); return m; };
	run();
	assert.ok(W.info().carved > 0 && gen.lakes.length > 0, 'the old place has its water');
	lift = 0;
	W.reframe();
	assert.equal(most(), 0, 'no carving of the old ground is left');
	assert.equal(W.info().tiles, 0);
	assert.equal(gen.lakes.length, 0);
	run();
	assert.ok(W.info().carved > 0, 'the water is worked out again here');
	assert.ok(most() < 40, 'from this ground: ' + most());
	assert.ok(W.info().lakes > 0, 'its lakes come back');
	W.dispose();
});
