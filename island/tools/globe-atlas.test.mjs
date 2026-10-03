import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import * as DATA from '../src/earth/data/index.js';
import { useAtlasData, regionAt } from '../src/earth/atlas.js';
import { refreshTile } from './refresh-globe-atlas.mjs';
import { characterOf, surfaceOf, treesOf, enc } from './globe-atlas-fields.mjs';
import { globeRoot, preservedBytes, writeAssetManifest } from './globe-assets-manifest.mjs';

useAtlasData(DATA);
const plane = 300 * 300 * 4;
const readTile = (row, col) => PNG.sync.read(fs.readFileSync(new URL(`g${row}-${col}.png`, globeRoot)));

test('atlas refresh retains every elevation, land, lake and survey-amplitude byte', () => {
	const tile = readTile(0, 6), before = preservedBytes(tile);
	const sample = regionAt(-3.15, -60.05);
	const changed = refreshTile(tile, 0, 6, () => sample);
	assert.ok(changed.bytes > 0);
	assert.deepEqual(preservedBytes(tile), before);
	assert.deepEqual(refreshTile(tile, 0, 6, () => sample), { cells: 0, bytes: 0 });
});

test('deep sea keeps neutral defaults without querying land character', () => {
	const tile = readTile(0, 6);
	for (let k = 0; k < 300 * 300; k++) {
		const q = k * 4, elevation = 20000; // -1000 m
		tile.data[q] = elevation >> 8; tile.data[q + 1] = elevation & 255;
		tile.data[q + 2] = 0; tile.data[q + plane * 3 + 1] = 0;
	}
	refreshTile(tile, 0, 6, () => assert.fail('Deep sea must not sample the atlas'));
	assert.deepEqual([...tile.data.subarray(plane * 4, plane * 4 + 3)], [70, 90, 110]);
	assert.deepEqual([...tile.data.subarray(plane * 6, plane * 6 + 3)], [180, enc(Math.sqrt(800) * 4), 0]);
});

test('tundra and permanent ice are treeless while forest/tundra transitions retain trees', () => {
	for (const biome of ['tundra', 'tundra and ice sheet', 'ice', 'polar desert']) assert.equal(treesOf({ biome }), 0);
	assert.ok(treesOf({ biome: 'boreal forest and tundra', climate: { rain: 600 } }) > 0);
	assert.ok(treesOf({ biome: 'rainforest', climate: { rain: 3000 } }) > .5);
});

test('baked regional checkpoints match current atlas colours, climate, shape and trees', () => {
	const sites = [
		['Svalbard', 78.25, 15.65], ['Manaus', -3.15, -60.05], ['Ulaanbaatar', 47.95, 106.95],
		['Iqaluit', 63.75, -68.55], ['Kyoto', 35.05, 135.75], ['Antarctic interior', -80.05, 40.05],
	];
	for (const [name, lat, lon] of sites) {
		const i = Math.floor((lon + 180) * 10), j = Math.floor((90 - lat) * 10);
		const tile = readTile(Math.floor(j / 300), Math.floor(i / 300)), q = ((j % 300) * 300 + i % 300) * 4;
		const at = regionAt(90 - (j + .5) / 10, -180 + (i + .5) / 10), surface = surfaceOf(at), c = characterOf(at);
		for (let p = 4; p <= 6; p++) assert.deepEqual([...tile.data.subarray(q + p * plane, q + p * plane + 3)], p === 6 ? surface.climate : surface.ground[p - 4], `${name}: plane ${p}`);
		assert.equal(tile.data[q + plane + 1], enc(c.ridge * 255), `${name}: ridge`);
		assert.equal(tile.data[q + plane * 3 + 2], enc(c.trees * 255), `${name}: trees`);
		if (name === 'Svalbard') {
			assert.equal(tile.data[q + plane * 6] / 4 - 30, -4);
			assert.deepEqual(surface.ground[0], [74, 74, 70]);
			assert.equal(tile.data[q + plane * 3 + 2], 0);
		}
	}
});

test('manifest and cache version match all 72 packed RGB assets', () => {
	const manifest = writeAssetManifest(true);
	assert.equal(manifest.tiles.length, 72);
	assert.ok(manifest.totalBytes > 0);
	assert.match(manifest.version, /^[0-9a-f]{16}$/);
});
