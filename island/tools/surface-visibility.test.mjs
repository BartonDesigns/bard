import test from 'node:test';
import assert from 'node:assert/strict';
import { updateIslandReach } from '../src/world/surfacevisibility.js';

const object = (extra = {}) => ({ visible: true, ...extra });
function fixture(far = false) {
	const boat = object(), light = object({ isLight: true });
	return { island: { half: 1300, far }, terrain: object(), grass: object(), turf: object(), litter: { meshes: [object()] }, underwater: { group: object() }, caverns: { group: { children: [object(), light] } }, village: { boat, group: { children: [object(), boat] } } };
}
const camera = (x, z = 0) => ({ position: { x, z } });

test('finite island stays hidden on repeated Pacific, San Francisco and San Jose frames', () => {
	for (const [name, x, z] of [['Pacific', -9000, 0], ['San Francisco', 8700, 0], ['San Jose', 60000, 47000]]) {
		const w = fixture();
		for (let frame = 0; frame < 4; frame++) {
			// Reproduce the previous competing surface owner. Previously islandReach's
			// cached band skipped the second frame and left these carpets enabled.
			w.terrain.visible = w.grass.visible = w.turf.visible = true;
			updateIslandReach(w, camera(x, z), true);
			assert.equal(w.terrain.visible, false, name + ' terrain frame ' + frame);
			assert.equal(w.grass.visible, false, name + ' grass frame ' + frame);
			assert.equal(w.turf.visible, false, name + ' turf frame ' + frame);
		}
	}
});

test('cave descent and return compose with distance without needing a band change', () => {
	for (const x of [0, 2500, 8700]) {
		const w = fixture(), c = camera(x);
		updateIslandReach(w, c, true); const above = w.terrain.visible;
		updateIslandReach(w, c, false); assert.equal(w.terrain.visible, false); assert.equal(w.grass.visible, false);
		updateIslandReach(w, c, true); assert.equal(w.terrain.visible, above); assert.equal(w.grass.visible, x < 1450);
	}
});

test('lunar far terrain survives distance culling but still respects cave visibility', () => {
	const w = fixture(true), c = camera(25000);
	updateIslandReach(w, c, true); assert.equal(w.terrain.visible, true);
	updateIslandReach(w, c, false); assert.equal(w.terrain.visible, false);
	updateIslandReach(w, c, true); assert.equal(w.terrain.visible, true);
});

test('fixed scenery is hidden away from the island while its lights and sailing boat remain', () => {
	const w = fixture();updateIslandReach(w, camera(12000));
	assert.equal(w.underwater.group.visible, false);
	assert.equal(w.caverns.group.children[0].visible, false);assert.equal(w.caverns.group.children[1].visible, true);
	assert.equal(w.village.group.children[0].visible, false);assert.equal(w.village.boat.visible, true);
	updateIslandReach(w, camera(0));assert.equal(w.village.group.children[0].visible, true);assert.equal(w.terrain.visible, true);
});
