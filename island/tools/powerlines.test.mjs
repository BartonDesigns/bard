import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPowerlines, pylonGeometry } from '../src/world/powerlines.js';

const island = { seed: 77, half: 1300, heightAt: (x, z) => 20 + Math.sin(x / 200) * 10 };

test('a lattice pylon stays light and stands 36.5 m tall', () => {
	for (const d of [1, 0]) {
		const g = pylonGeometry(d);
		g.computeBoundingBox();
		assert.ok(g.attributes.position.count / 3 < 800, 'triangles');
		assert.ok(Math.abs(g.boundingBox.max.y - 36.5) < 0.3);
		assert.ok(g.boundingBox.min.y > -0.5);
	}
});

test('settled worlds get two lines across their land, wild and airless ones none', () => {
	const P = createPowerlines(new THREE.Scene(), {});
	const t = P.plan({ island, profile: { type: 'TERRAN' } });
	assert.equal(t.lines, 2);
	assert.ok(t.pylons > 6 && t.wireSegments > 0);
	assert.equal(P.plan({ island, profile: { type: 'MEDIEVAL' } }).pylons, 0);
	assert.equal(P.plan({ island, profile: { type: 'ARID', airless: true } }).pylons, 0);
	P.dispose();
});

test('Earth lines break over water and fill the draw with the pylons in reach', () => {
	const P = createPowerlines(new THREE.Scene(), {});
	const all = P.plan({ earth: true, island, heightAt: () => 50 }).pylons;
	const dry = P.plan({ earth: true, island, heightAt: (x) => (x > 40000 ? 50 : -5) }).pylons;
	assert.ok(all > 300 && dry < all && dry > 0);
	const cam = new THREE.PerspectiveCamera();
	cam.position.set(60000, 100, 0);
	P.update(cam, 1);
	assert.ok(P.info().drawn > 0 && P.info().drawn <= 900);
	P.dispose();
});
