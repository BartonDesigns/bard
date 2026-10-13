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
