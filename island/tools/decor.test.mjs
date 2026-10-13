// The era and household choosers (bay/decor.js): deterministic, every era about, the older
// towns older, the palettes and pattern slots in range, no two office floors alike.
//   node --test island/tools/decor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ERA_KEYS, houseEra, cityEra, exteriorLook, householdDecor, officeScheme, shopScheme, seedAt, roll } from '../src/bay/decor.js';
import { STYLE, ERA } from '../src/bay/styles.js';
import { toWorld } from '../src/bay/geo.js';

// lots over a box of the map, on a 37 m step
function lots(lat0, lon0, lat1, lon1, n = 1600) {
	const a = toWorld(lat0, lon0), b = toWorld(lat1, lon1), out = [], k = Math.ceil(Math.sqrt(n));
	for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) out.push([a.x + (b.x - a.x) * (i + 0.5) / k, a.z + (b.z - a.z) * (j + 0.5) / k]);
	return out;
}
const share = (list, f) => list.filter(f).length / list.length;
const ROOMS = ['living', 'dining', 'family', 'kitchen', 'bed', 'master', 'bath', 'mbath', 'powder', 'laundry', 'entry', 'hall', 'office', 'loft', 'closet', 'garage'];
const colour = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => v >= 0 && v <= 1);
const KEY = /^(paint|wood|carpet|concrete|paper[0-7]|floor[0-7])$/;

test('the same lot always gets the same era, outside and household', () => {
	for (const [x, z] of lots(37.7, -122.1, 37.8, -121.9, 200)) {
		const e = houseEra(x, z), s = seedAt(x, z);
		assert.equal(houseEra(x, z), e);
		assert.deepEqual(exteriorLook(e, s), exteriorLook(e, s));
		const a = householdDecor(e, s), b = householdDecor(e, s);
		for (const [i, t] of ROOMS.entries()) {
			assert.deepEqual(a.wall(t, i), b.wall(t, i));
			assert.deepEqual(a.accent(t, i), b.accent(t, i));
			assert.deepEqual(a.floor(t, i % 2), b.floor(t, i % 2));
		}
		assert.deepEqual(officeScheme('k' + s, 3), officeScheme('k' + s, 3));
		assert.deepEqual(shopScheme('cafe', s), shopScheme('cafe', s));
	}
	assert.equal(roll(5, 7), roll(5, 7));
});

test('every era turns up across the Bay Area, and a given era wins', () => {
	const seen = new Set();
	for (const [x, z] of [...lots(37.68, -122.05, 37.82, -121.82), ...lots(37.33, -122.1, 37.45, -121.95, 400)]) seen.add(houseEra(x, z));
	for (const [x, z] of lots(37.8, -122.3, 37.88, -122.2, 400)) seen.add(houseEra(x, z, { style: STYLE.older }));
	assert.deepEqual([...seen].sort(), [...ERA_KEYS].sort());
	for (const e of ERA_KEYS) assert.equal(houseEra(1000, 2000, { era: e }), e);
	assert.equal(cityEra(ERA.seventies, 0.5), 'split');
	assert.equal(cityEra(ERA.ranch, 0.5), 'ranch');
	assert.equal(cityEra(ERA.eichler, 0.5), 'ranch');
	assert.ok(['tract', 'modern'].includes(cityEra(ERA.modern, 0.9)));
});

test('the older towns are mostly older houses; the newest valley mostly new', () => {
	const old = lots(37.8, -122.3, 37.88, -122.2).map(([x, z]) => houseEra(x, z, { style: STYLE.older }));
	const sub = lots(37.8, -122.3, 37.88, -122.2).map(([x, z]) => houseEra(x, z, { style: STYLE.suburb }));
	const prewarOld = share(old, (e) => e === 'prewar'), prewarSub = share(sub, (e) => e === 'prewar');
	assert.ok(prewarOld > 0.5, 'older towns mostly prewar: ' + prewarOld);
	assert.ok(prewarOld > prewarSub + 0.4, `prewar ${prewarOld} in the older towns vs ${prewarSub} in the suburbs`);
	// Dougherty Valley (built out 1995-2015) against the 1970s west side of San Ramon
	const east = lots(37.74, -121.93, 37.78, -121.87).map(([x, z]) => houseEra(x, z)), west = lots(37.75, -122.0, 37.79, -121.95).map(([x, z]) => houseEra(x, z));
	const newer = (e) => e === 'tract' || e === 'modern';
	assert.ok(share(east, newer) > 0.7, 'east newer: ' + share(east, newer));
	assert.ok(share(west, (e) => e === 'split' || e === 'ranch') > share(east, (e) => e === 'split' || e === 'ranch') + 0.3);
});

test('looks and households stay in range, and the eras differ', () => {
	const byEra = {};
	for (const e of ERA_KEYS) for (let s = 1; s < 400; s++) {
		const L = exteriorLook(e, s * 7919);
		for (const c of [L.wall, L.roof, L.trim, L.door, L.garage, L.frame]) assert.ok(colour(c), e + ' ' + JSON.stringify(L));
		assert.ok(L.siding === null || (L.siding >= 0 && L.siding <= 3));
		assert.ok(L.doorStyle >= 0 && L.doorStyle <= 7 && L.garageStyle >= 0 && L.garageStyle <= 3);
		assert.ok([0, 1, 2, 3, 4, 5].includes(L.roofT));
		const D = householdDecor(e, s * 104729);
		for (const c of [D.trim, D.wood, D.carpet, D.plank, D.cab.col, D.top, D.splash, D.island, D.door.col, D.fanWood]) assert.ok(colour(c), e);
		assert.ok(D.base > 0.05 && D.base < 0.25 && D.door.slot >= 0 && D.door.slot <= 7);
		for (const [i, t] of ROOMS.entries()) {
			const w = D.wall(t, i), a = D.accent(t, i), f = D.floor(t, i % 2);
			assert.ok(KEY.test(w.key) && colour(w.col), JSON.stringify(w));
			assert.ok(a === null || (KEY.test(a.key) && colour(a.col)));
			assert.ok(KEY.test(f.key) && colour(f.col), t + JSON.stringify(f));
			(byEra[e] ||= new Set()).add(w.key + '|' + f.key);
		}
		assert.ok(['fan', 'flush', 'chandelier', 'pendant', 'pendants', 'bar', 'tube'].includes(D.fixture('bed', 'flush')));
	}
	// papers mostly in the older houses, panelled dens in the seventies, plank floors in the new
	const papered = (e) => [...byEra[e]].filter((k) => k.startsWith('paper')).length;
	assert.ok(papered('prewar') > papered('modern'));
	assert.ok([...byEra.split].some((k) => k.startsWith('paper5')));
	assert.ok([...byEra.modern].some((k) => k.includes('floor5')));
	assert.ok([...byEra.prewar].some((k) => k.includes('floor2')));
});

test('no two office floors of a tower look the same, and companies differ', () => {
	const keyOf = (S) => [S.wall, S.brand, S.carpet, S.desk, S.seat, S.ceiling, S.lights, S.carpetTile, S.accentWall, S.shade.toFixed(3)].join('|');
	for (const tower of ['9000:9000', '12000:9000', '-410:2233']) {
		const floors = [...Array(60)].map((_, n) => keyOf(officeScheme(tower, n)));
		assert.equal(new Set(floors).size, floors.length, tower);
		const companies = new Set([...Array(60)].map((_, n) => officeScheme(tower, n).company));
		assert.ok(companies.size >= 15, tower + ' companies ' + companies.size);
	}
	const looks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => keyOf(officeScheme(k, 4))));
	assert.ok(looks.size >= 7);
});
