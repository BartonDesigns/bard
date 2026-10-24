// New York is a city profile layered over the world atlas: recognisable borough names, its
// Manhattan grid and Central Park, a denser vertical fabric, and a handful of true landmarks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityAbsorbed, cityDistrict, cityProfile, citySites } from '../src/earth/cityprofiles.js';
import { exteriorLook, houseEra, householdDecor, SIDING } from '../src/bay/decor.js';
import { generateTown } from '../src/crysis/civgen.js';
import { REAL, REAL_BUILD } from '../src/region/landmarks.js';
import { Geo } from '../src/region/geo.js';

const K = { house: 0, garageL: 1, garageR: 2, garage: 3, retail: 6, apartments: 8, shed: 10, tower: 11, parking: 12 };
const H = (x, z) => 18 + Math.sin(x / 1200) + Math.cos(z / 900);

test('New York owns Brooklyn as one continuous profiled city', () => {
	const ny = { id: 'new-york', name: 'New York' }, brooklyn = { id: 'brooklyn', name: 'Brooklyn' };
	const P = cityProfile(ny);
	assert.equal(P?.id, 'nyc');
	assert.equal(P.look, 'nyc');
	assert.equal(cityProfile(brooklyn), P);
	assert.equal(cityAbsorbed(brooklyn, [ny, brooklyn]), true);
	assert.equal(cityAbsorbed(brooklyn, [brooklyn]), false);
});

test('the profile names boroughs and Manhattan neighbourhoods by position', () => {
	const P = cityProfile({ name: 'New York' });
	assert.equal(cityDistrict(P, 40.708, -74.01), 'Lower Manhattan');
	assert.equal(cityDistrict(P, 40.748, -73.985), 'Midtown Manhattan');
	assert.equal(cityDistrict(P, 40.775, -73.98), 'Upper Manhattan');
	assert.equal(cityDistrict(P, 40.84, -73.91), 'The Bronx');
	assert.equal(cityDistrict(P, 40.68, -73.95), 'Brooklyn');
	assert.equal(cityDistrict(P, 40.74, -73.82), 'Queens');
});

test('Central Park is carried into only the streamed districts it reaches', () => {
	const P = cityProfile({ name: 'New York' });
	const xy = (lat, lon) => ({ x: (lon + 73.9654) * 85000, z: (lat - 40.7829) * 111000 });
	const near = citySites(P, xy, 0, 0, 1600), far = citySites(P, xy, 30000, 30000, 1600);
	assert.equal(near.length, 1);
	assert.deepEqual({ name: near[0].name, hw: near[0].hw, hd: near[0].hd, noPond: near[0].noPond }, { name: 'Central Park', hw: 410, hd: 2050, noPond: true });
	assert.equal(far.length, 0);
});

test('New York grows as dense mixed-use blocks with a tall core and few parking gaps', () => {
	const T = generateTown({ seed: 917, cx: 0, cz: 0, radius: 1700, heightAt: H, style: 'older', name: 'Midtown Manhattan', ang: 29 * Math.PI / 180, look: 'nyc' });
	const flats = T.boxes.filter((b) => b.kind === K.apartments), shops = T.boxes.filter((b) => b.kind === K.retail && b.era === 'nyc');
	const houses = T.boxes.filter((b) => b.kind === K.house), parking = T.boxes.filter((b) => b.kind === K.parking);
	assert.ok(flats.length > 300, `apartment blocks: ${flats.length}`);
	assert.ok(shops.length > 50, `street shops: ${shops.length}`);
	assert.equal(houses.length, 0, 'no detached-house fabric in the profiled core');
	assert.ok(parking.length < flats.length * 0.08, `few parking structures: ${parking.length}`);
	assert.equal(T.pools.length, 0);
	assert.equal(T.paths.filter((p) => p.w > 4).length, 0, 'no suburban drives');
	assert.equal(T.boxes.filter((b) => [K.garageL, K.garageR, K.garage, K.shed].includes(b.kind)).length, 0);
	assert.ok(Math.max(...flats.map((b) => b.wallH)) > 28, 'a visibly vertical residential core');
	assert.equal(T.look, 'nyc');
});

test('real city sites remain reserved public ground inside the generated street fabric', () => {
	const site = { kind: 'park', name: 'Test Square', x: 70, z: -40, ux: 1, uz: 0, hw: 90, hd: 150, noPond: true };
	const T = generateTown({ seed: 23, cx: 0, cz: 0, radius: 650, heightAt: H, style: 'older', name: 'New York City', ang: 0.2, look: 'nyc', citySites: [site] });
	const park = T.parks.find((p) => p.name === 'Test Square');
	assert.ok(park?.fixed, 'the real park reaches the park renderer');
	assert.ok(!park.pond, 'its real shape does not grow an invented lake');
	const inside = T.boxes.filter((b) => Math.abs(b.x - site.x) < site.hw && Math.abs(b.z - site.z) < site.hd);
	assert.equal(inside.length, 0, 'buildings keep out of the reserved public space');
});

test('New York building skins are brownstone and brick outside, prewar inside', () => {
	assert.equal(houseEra(10, 20, { era: 'nyc' }), 'nyc');
	for (let seed = 0; seed < 12; seed++) {
		const L = exteriorLook('nyc', seed);
		assert.equal(L.siding, SIDING.brick);
		assert.equal(L.roofT, 5);
		assert.equal(L.grilles, true);
		assert.equal(L.frame.length, 3);
	}
	assert.equal(householdDecor('nyc', 27).era, 'prewar');
});

test('New York skyline anchors are registered and buildable', () => {
	const wanted = new Map([
		['the Empire State Building', 'empire'],
		['the Chrysler Building', 'chrysler'],
		['Grand Central Terminal', 'grandcentral'],
		['the Brooklyn Bridge', 'brooklynbridge'],
		['the Statue of Liberty', 'statue'],
	]);
	for (const [name, kind] of wanted) {
		const row = REAL.find((r) => r[0] === name);
		assert.equal(row?.[3], kind, `${name} has its real site`);
		assert.equal(typeof REAL_BUILD[kind], 'function', `${kind} has a builder`);
		if (kind !== 'statue') {
			const B = { G: new Geo(), glow: new Geo(), solid: [] };
			REAL_BUILD[kind](B, 0.25);
			assert.ok(B.G.count() > 30, `${kind} produces a visible mesh`);
			assert.ok(B.solid.length, `${kind} has collision ground`);
		}
	}
});
