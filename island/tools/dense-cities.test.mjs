// The big cities of East Asia, South Asia, the Middle East and North Africa (Tokyo, Delhi, Cairo)
// are real cities: grown by the town generator with their streets, traffic and doors, not built
// as a regional kit's prop quarter (region/index.js kitClaims), and grown in their own manner:
// blocks of flats and shops out to the pavement in the region's colours (region/index.js
// cityLook, earth/globetowns.js, crysis/civgen.js look, bay/decor.js). The low flat land they
// stand on by the sea is dry ground (earth/globeheight.js LAND_FLOOR), and the open country's
// farms and villages keep off a grown city's ground (region/index.js grownCityAt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { loadAtlas, citiesNear } from '../src/earth/atlas.js';
import { kitClaims, cityLook, grownCityAt } from '../src/region/index.js';
import { createGlobeHeight, LAND_FLOOR } from '../src/earth/globeheight.js';
import { globeRoot } from './globe-assets-manifest.mjs';
import { generateTown, LU } from '../src/crysis/civgen.js';
import { houseEra, exteriorLook, householdDecor } from '../src/bay/decor.js';
import { setFrame, toXZ } from '../src/earth/globeframe.js';
import { createGlobeTowns } from '../src/earth/globetowns.js';

const city = (name, lat, lon) => citiesNear(lat, lon, 30, 8).find((c) => c.name === name);
const heightAt = (x, z) => 20 + Math.sin(x / 900) * 3 + Math.cos(z / 700) * 3;
const grown = new Map();
const town = (look, radius = 1700) => {
	const k = look + radius;
	if (!grown.has(k)) grown.set(k, generateTown({ seed: 7, cx: 0, cz: 0, radius, heightAt, style: 'older', name: 'Testopolis', ang: 0.2, look }));
	return grown.get(k);
};
const K = { house: 0, garageL: 1, garageR: 2, garage: 3, retail: 6, apartments: 8, shed: 10, tower: 11 };

test('the big cities of Asia and the Middle East are grown as real cities, in their own manner', async () => {
	await loadAtlas();
	const want = { Tokyo: [35.68, 139.69, 'east'], Bangkok: [13.75, 100.5, 'east'], Delhi: [28.61, 77.21, 'south'], Mumbai: [19.08, 72.88, 'south'], Cairo: [30.04, 31.24, 'arid'], Dubai: [25.2, 55.27, 'arid'] };
	for (const [name, [lat, lon, look]] of Object.entries(want)) {
		const c = city(name, lat, lon);
		assert.ok(c, name + ' is in the atlas');
		assert.equal(kitClaims(c), false, name + ' is not a prop quarter');
		assert.equal(cityLook(c), look, name + "'s look");
	}
	// the old towns of the desert are still the kit's own (their souks and courtyards)
	const khiva = city('Khiva', 41.38, 60.36);
	assert.ok(khiva && kitClaims(khiva), 'Khiva is an old town built by its kit');
	// and the rest of the world's cities are grown as before, in no look of their own
	const paris = city('Paris', 48.86, 2.35);
	assert.equal(kitClaims(paris), false);
	assert.equal(cityLook(paris), null);
});

test('the towns list carries the look to the city and to every district of it', async () => {
	await loadAtlas();
	const TOKYO = [35.68, 139.69];
	setFrame(...TOKYO);
	const c = toXZ(...TOKYO);
	const T = createGlobeTowns({ real: { addRegion: () => ({}), removeRegion() {} }, heightAt: () => 40, water: () => null, director: null, skip: () => false, claim: kitClaims, look: cityLook });
	T.update({ position: { x: c.x + 6000, y: 1.7, z: c.z - 3000 } });
	const tokyo = T.towns.filter((t) => t.city.name === 'Tokyo');
	assert.ok(tokyo.length > 3, 'Tokyo and its districts are grown: ' + tokyo.length);
	assert.ok(tokyo.every((t) => t.look === 'east'));
});

test("a dense city's lots are blocks of flats and shops out to the pavement, no yards, drives or pools", () => {
	for (const look of ['east', 'south', 'arid']) {
		const T = town(look);
		const homes = T.boxes.filter((b) => b.kind === K.house), flats = T.boxes.filter((b) => b.kind === K.apartments), shops = T.boxes.filter((b) => b.kind === K.retail && b.era);
		assert.ok(flats.length > 300, `${look}: blocks of flats (${flats.length})`);
		assert.ok(shops.length > 20, `${look}: shops on the busier streets (${shops.length})`);
		assert.ok(flats.length > homes.length * 2, `${look}: mostly flats (${flats.length} to ${homes.length} houses)`);
		if (look === 'east') assert.ok(homes.length > 10, 'East Asia: small houses between the blocks');
		else assert.equal(homes.length, 0, look + ': no detached houses');
		assert.equal(T.boxes.filter((b) => b.kind === K.garage || b.kind === K.garageL || b.kind === K.garageR || b.kind === K.shed).length, 0, look + ': no garages or sheds');
		assert.equal(T.pools.length, 0, look + ': no pools');
		assert.equal(T.paths.filter((p) => p.w > 4).length, 0, look + ': no drives');
		// every block and house in the look, flats three storeys and up (higher toward the middle)
		for (const b of [...flats, ...homes, ...shops]) assert.equal(b.era, look);
		assert.ok(flats.every((b) => b.roofH === 0 && b.wallH >= 6));
		const mid = flats.filter((b) => Math.hypot(b.x, b.z) < 500), edge = flats.filter((b) => Math.hypot(b.x, b.z) > 1200);
		const avg = (l) => l.reduce((a, b) => a + b.wallH, 0) / Math.max(1, l.length);
		assert.ok(avg(mid) > avg(edge) + 2, `${look}: taller toward the middle (${avg(mid).toFixed(1)} m to ${avg(edge).toFixed(1)} m)`);
		// paved out to the walls: the land round the blocks is the street's, not a lawn
		const M = T.map, at = (x, z) => { const i = Math.floor((x - M.x0) / M.step), j = Math.floor((z - M.z0) / M.step); return Math.round(M.px[(j * M.w + i) * 4 + 1] / 16); };
		const paved = flats.filter((b) => at(b.x, b.z) === LU.plaza).length;
		assert.ok(paved > flats.length * 0.8, `${look}: paved round its blocks (${paved} of ${flats.length})`);
		assert.equal(T.look, look);
	}
});

test("a big dense city's downtown rises as high as any", () => {
	const T = town('east', 3400);
	const towers = T.boxes.filter((b) => b.kind === K.tower);
	assert.ok(towers.length > 10, 'towers: ' + towers.length);
	assert.ok(Math.max(...towers.map((b) => b.wallH)) > 60, 'some of them high');
});

test('a dense city keeps its look in the houses built near you, furnished as the nearest era', () => {
	for (const look of ['east', 'south', 'arid']) {
		assert.equal(houseEra(10, 20, { era: look }), look);
		const L = exteriorLook(look, 1234);
		assert.equal(L.era, look);
		assert.ok(L.wall.length === 3 && L.roof.length === 3 && L.door.length === 3);
		assert.equal(L.siding, null, look + ': rendered, not sided');
		const D = householdDecor(look, 1234);
		assert.ok(['modern', 'tract'].includes(D.era), look + ': furnished as ' + D.era);
		assert.ok(D.floor('kitchen', 0).key);
	}
	// (an unknown era is still a Bay one)
	assert.ok(['prewar', 'ranch', 'split', 'tract', 'modern'].includes(houseEra(10, 20, { era: 'nowhere' })));
});

// a window of the real tiles round (lat, lon), as globedata.js puts it together (as globe-relief.test.mjs)
const NW = 256, PLANES = ['E', 'L', 'WL', 'A', 'RG', 'TR', 'BNR', 'RV', 'DUNE', 'KARST', 'K', 'TREES', 'TEMP', 'RAIN'], tiles = new Map();
function windowAt(lat, lon) {
	const gi0 = Math.floor((lon + 180) * 10) - NW / 2, gj0 = Math.floor((90 - lat) * 10) - NW / 2, PS = 300 * 300 * 4;
	const P = {}; for (const k of PLANES) P[k] = new Float32Array(NW * NW);
	for (let j = 0; j < NW; j++) for (let i = 0; i < NW; i++) {
		const gi = (((gi0 + i) % 3600) + 3600) % 3600, gj = gj0 + j, ti = Math.floor(gi / 300), tj = Math.floor(gj / 300), name = `g${tj}-${ti}.png`;
		if (!tiles.has(name)) tiles.set(name, PNG.sync.read(fs.readFileSync(new URL(name, globeRoot))).data);
		const px = tiles.get(name), q = ((gj - tj * 300) * 300 + gi - ti * 300) * 4, k = j * NW + i;
		P.E[k] = (px[q] * 256 + px[q + 1]) / 2 - 11000; P.L[k] = px[q + 2] / 255; P.A[k] = (px[q + PS] / 8) ** 2; P.RG[k] = px[q + PS + 1] / 255;
	}
	return { N: NW, P, gi0, gj0 };
}

test('the low flat land of the deltas and reclaimed shores is dry ground a town is built on', () => {
	// (most of Mumbai, a third of Shanghai and Amsterdam, Tokyo by its bay lay at the water's own
	// level, where no town lot, building or passer-by is put)
	assert.ok(LAND_FLOOR > 1.5);
	for (const [name, lat, lon] of [['Mumbai', 19.076, 72.8777], ['Shanghai', 31.2304, 121.4737], ['Amsterdam', 52.3676, 4.9041], ['Tokyo Station', 35.6812, 139.7671]]) {
		const H = createGlobeHeight(windowAt(lat, lon)), kLat = 110996, kLon = 111320 * Math.cos(lat * Math.PI / 180);
		let land = 0, low = 0;
		for (let dz = -4000; dz <= 4000; dz += 250) for (let dx = -6000; dx <= 6000; dx += 250) {
			const h = H.atLL(lat - dz / kLat, lon + dx / kLon);
			if (h <= 0) continue;
			land++;
			if (h <= 1.5) low++;
		}
		assert.ok(land > 200, name + ': on land');
		// (only the beach, where the land runs down into the sea)
		assert.ok(low < land * 0.03, `${name}: ${low} of ${land} points of its land at the water's level`);
	}
});

test("a grown city's ground is the city's: the open country's farms and villages keep off it", async () => {
	await loadAtlas();
	assert.equal(grownCityAt(35.6812, 139.7671)?.name, 'Tokyo', 'Tokyo Station, 10 km from the atlas middle of Tokyo');
	assert.equal(grownCityAt(19.076, 72.8777)?.name, 'Mumbai');
	assert.equal(grownCityAt(48.80, 2.20)?.name, 'Paris', 'the edge of Paris');
	// the open country, and a town the kit builds itself
	assert.equal(grownCityAt(45.5, 2.6), null, 'the Auvergne');
	assert.equal(grownCityAt(41.378, 60.364), null, 'Khiva is the kit\'s');
});
