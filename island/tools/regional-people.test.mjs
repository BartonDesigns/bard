import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAtlas, regionAt, citiesNear } from '../src/earth/atlas.js';
import { kitAt } from '../src/region/choose.js';
import { climateNow } from '../src/region/climate.js';
import { communityFolk, communityJob, communityKey } from '../src/region/community.js';
import { regionalDress } from '../src/region/dress.js';
import { regionalSheet, weatherLine } from '../src/region/talk.js';
import { personaFor, personaOffline, personaPrompt } from '../src/people/persona.js';
import { here } from '../src/region/here.js';
import { KITS } from '../src/region/kits.js';

const rng = (seed) => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
await loadAtlas();
const cases = [
	['Svalbard', 78.22, 15.65, true], ['Marrakesh', 31.63, -7.98, false],
	['Istanbul', 41.008, 28.978, true], ['Kyoto', 35.012, 135.768, false],
	['Manaus', -3.119, -60.022, false], ['Ulaanbaatar', 47.918, 106.917, false],
	['Zermatt', 46.021, 7.749, false], ['Iqaluit', 63.746, -68.517, true],
];
const contexts = cases.map(([name, lat, lon, coast]) => {
	const at = regionAt(lat, lon), town = citiesNear(lat, lon, 10, 1)[0], K = kitAt(at, { pop: town.pop });
	return { name, on: true, lat, lon, regionId: at.id, regionName: at.profile.name,
		region: at.profile, culture: K.culture, kit: K.kit, town: { name: town.name, pop: town.pop, km: 0 },
		climate: climateNow(at, 9), coast, onward: { name: 'the next settlement', km: 20, dir: 'east' } };
});
for (const H of contexts) test(`${H.name}: authored dialogue reaches offline and model contexts`, () => {
	Object.assign(here, H);
	const p = personaFor({ dna: { seed: 31, age: 35, male: true } }, {});
	const sheet = regionalSheet(H, rng(31));
	assert.equal(p.local.place, H.town.name);
	assert.equal(p.local.lang, sheet.lang);
	assert.deepEqual(p.local.foods, H.region.food.slice(0, 4));
	assert.ok(p.local.greet.text && p.local.weather && p.job && p.errand);
	assert.match(personaOffline(p, 'what is this place?', {}), new RegExp(H.town.name));
	assert.ok(personaOffline(p, 'what food can I eat?', {}).includes(p.local.food));
	assert.ok(personaPrompt(p, {}).includes(`(${sheet.kit})`));
	assert.ok(p.facts.some((f) => f.includes(H.town.name)));
	if (H.town.pop >= 3) assert.equal(sheet.kit, 'city');
	if (!H.coast) {
		assert.doesNotMatch(sheet.travel + sheet.onward.line + p.errand, /harbour|ferry|boats at the shore/);
		assert.ok(communityFolk(H).jobs.every((j) => !/sailor|harbour|ferry|boat builder|fisherman/.test(j)));
	}
	here.on = false;
});

test('community work does not assign Arctic traditions by weather, or camps to cities', () => {
	const svalbard = communityFolk(contexts[0]), iqaluit = communityFolk(contexts[7]);
	assert.doesNotMatch(JSON.stringify(svalbard), /soapstone|throat singing|drum dance|penguin/);
	assert.ok(iqaluit.jobs.includes('a carver in soapstone'));
	assert.ok(iqaluit.hobbies.includes('throat singing'));
	for (const i of [4, 5]) {
		const f = communityFolk(contexts[i]);
		assert.doesNotMatch(f.jobs.join(' '), /village school|between camps|herder|stilt houses/);
		assert.ok(f.jobs.includes('a nurse'));
	}
	assert.notEqual(communityKey(contexts[5]), communityKey({ ...contexts[5], town: { name: 'Camp', pop: -1 } }));
	assert.notEqual(communityKey(contexts[0]), communityKey({ ...contexts[0], town: { name: 'Ny-Ålesund', pop: 0 } }));
});

test('jobs use authored role matches, preserve inland river fishing, and have safe fallback', () => {
	const rural = { ...contexts[5], town: { pop: -1 } };
	for (let seed = 1; seed <= 40; seed++) assert.match(communityJob(rural, 'herd', rng(seed)), /herd|horse/);
	assert.equal(communityJob({ kit: { folk: { jobs: ['keeping the temple'] } } }, 'monk', rng(2)), 'keeping the temple');
	assert.equal(communityJob({ coast: false, kit: { folk: { jobs: ['fishing the river'] } } }, 'fish', rng(2)), 'fishing the river');
	assert.equal(communityJob({ kit: {} }, 'walk', rng(2)), 'working locally');
});

test('steppe herders have working boots and covered legs without forcing everyone into a deel', () => {
	let contemporary = 0;
	for (let seed = 1; seed <= 150; seed++) for (const cold of [0.1, 0.7]) {
		const d = { male: seed % 2 === 0, age: 18 + seed % 55, child: false };
		const { outfit } = regionalDress(rng(seed), d, KITS.steppe, contexts[5].culture, { cold, role: 'herd' });
		assert.equal(outfit.shoes.kind, 'boot');
		assert.equal(outfit.bottom.legs, 'long');
		assert.ok(outfit.acc.every((a) => a.kind !== 'chain'));
		if (outfit.outer?.pat !== 'sash') contemporary++;
	}
	assert.ok(contemporary > 0);
});

 test('polar dialogue describes current daylight without inventing duration or return dates', () => {
	for (const polar of ['sun', 'night', null]) for (let i = 0; i < 20; i++) {
		const line = weatherLine(KITS.station, { polar, south: true, season: 'summer', temp: -10, now: -10 }, {}, () => i / 20);
		assert.doesNotMatch(line, /February|in weeks/);
		if (polar !== 'sun') assert.doesNotMatch(line, /Twenty-four hours/);
	}
});
