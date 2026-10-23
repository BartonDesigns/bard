// A town grown out on the globe reads as a town to whatever asks "is this a town?" (the people
// on its sidewalks, its street sound, the music), as the Bay's own towns do: crysis/townmap.js,
// bay/realcity.js townAt, the world's townAt (island-build.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTown, LU } from '../src/crysis/civgen.js';
import { townMapAt, townAtOf } from '../src/crysis/townmap.js';
import { createRealCity } from '../src/bay/realcity.js';
import { zoneOf, ZONE } from '../src/people/flow.js';
import { STYLE } from '../src/bay/styles.js';

const heightAt = (x, z) => 20 + Math.sin(x / 900) * 3 + Math.cos(z / 700) * 3;
const towns = new Map();
const town = (style, radius, ang = 0.3) => {
	const k = style + radius + ':' + ang;
	if (!towns.has(k)) towns.set(k, generateTown({ seed: 42, cx: 1000, cz: -2000, radius, heightAt, style, name: 'Testville', ang }));
	return towns.get(k);
};
const around = (T, f, n = 48) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return townMapAt(T, T.centre[0] + Math.cos(a) * T.radius * f, T.centre[1] + Math.sin(a) * T.radius * f); });

test('a grown town is a town out to its edge, and not past it', () => {
	const T = town('suburb', 1100);
	assert.deepEqual(T.centre, [1000, -2000]);
	assert.equal(T.radius, 1100);
	const mid = townMapAt(T, 1000, -2000);
	assert.ok(mid.u > 0.3, 'the middle of town is built up: ' + mid.u);
	assert.ok(Math.abs(mid.a - 0.3) < 1e-9, 'its streets run at the town\'s angle');
	// (people walk where the town map is 0.2 and more: people.js demand)
	const half = around(T, 0.5);
	assert.ok(half.filter((U) => U.u >= 0.2).length >= half.length * 0.7, 'halfway out, mostly houses');
	assert.ok(around(T, 1.4).every((U) => !U || U.u < 0.2), 'out past the last houses, the country');
	assert.equal(townMapAt(T, 1000 + 1100 * 2, -2000), null);
	assert.equal(townMapAt(null, 0, 0), null);
	assert.equal(townMapAt({ map: T.map }, 0, 0), null, 'a town record without its centre (grown before) says nothing');
});

test('a big town\'s middle is a downtown, an old town\'s a main street, its shops shops', () => {
	assert.equal(zoneOf(townMapAt(town('suburb', 2300), 1000, -2000)), ZONE.downtown);
	const old = townMapAt(town('older', 1100), 1000, -2000);
	assert.equal(old.s, STYLE.older);
	assert.equal(zoneOf(old), ZONE.dining);
	// the middle of a shopping centre's lot (its land use painted commercial)
	const T = town('suburb', 1100), M = T.map;
	let shop = null;
	for (let j = 2; j < M.h - 2 && !shop; j += 2) for (let i = 2; i < M.w - 2 && !shop; i += 2) {
		const ok = [-2, 0, 2].every((a) => [-2, 0, 2].every((b) => Math.round(M.px[((j + b) * M.w + i + a) * 4 + 1] / 16) === LU.commercial));
		if (ok) shop = [M.x0 + (i + 0.5) * M.step, M.z0 + (j + 0.5) * M.step];
	}
	assert.ok(shop, 'the town has a shopping centre');
	assert.ok([ZONE.retail, ZONE.downtown].includes(zoneOf(townMapAt(T, ...shop))), 'shops are a shopping street');
});

test('the world asks the Bay\'s map first, and the town grown there past its edge', () => {
	const none = { u: 0, a: 0, d: 0, s: STYLE.suburb }, bayTown = { u: 0.6, a: 0.2, d: 0.1, s: STYLE.older }, grown = { u: 0.7, a: 0.3, d: 0, s: STYLE.suburb };
	let bayU = none, grownU = grown;
	const at = townAtOf({ urbanAt: () => bayU }, { townAt: () => grownU });
	assert.equal(at(0, 0), grown);
	bayU = bayTown;
	assert.equal(at(0, 0), bayTown, 'the Bay\'s own towns as they were');
	bayU = none; grownU = null;
	assert.equal(at(0, 0), none, 'no town at all');
	assert.equal(townAtOf({ urbanAt: () => none }, null)(0, 0), none, 'no real city');
});

test('a town standing in the real city answers townAt until it is taken down', () => {
	const real = createRealCity({});
	try {
		const T = town('suburb', 1100);
		assert.equal(real.townAt(1000, -2000), null);
		const G = real.addRegion(T);
		const U = real.townAt(1000, -2000);
		assert.ok(U && U.u > 0.3, 'the town grown here');
		assert.equal(real.townAt(1000 + 1100 * 2, -2000), null, 'out in the country');
		real.removeRegion(G);
		assert.equal(real.townAt(1000, -2000), null, 'gone with its town');
	} finally { real.dispose(); }
});
