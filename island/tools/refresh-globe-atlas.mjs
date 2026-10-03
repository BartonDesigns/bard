// Refresh every recoverable atlas field without fetching or resampling the survey data.
// Elevation, land, lakes and relief amplitude are retained exactly. Amplitude also uses
// the source survey's standard deviation, which is not in these tiles: changing its
// authored floor/gain requires the full bake. Run from any directory; --check is read-only.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import * as DATA from '../src/earth/data/index.js';
import { useAtlasData, regionAt } from '../src/earth/atlas.js';
import { characterOf, surfaceOf, enc } from './globe-atlas-fields.mjs';
import { globeRoot, tileNames, validateTile, preservedBytes, writeAssetManifest } from './globe-assets-manifest.mjs';

export function refreshTile(tile, row, col, sample = regionAt) {
	validateTile(tile);
	const n = 300, plane = n * n * 4, D = tile.data;
	let cells = 0, bytes = 0;
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		const q = (y * n + x) * 4, elevation = (D[q] * 256 + D[q + 1]) / 2 - 11000;
		const lat = 90 - (row * n + y + .5) / 10, lon = -180 + (col * n + x + .5) / 10;
		const at = D[q + 2] || D[q + plane * 3 + 1] || elevation > -60 ? sample(lat, lon) : null;
		const c = characterOf(at), surface = surfaceOf(at);
		let changed = false;
		const put = (p, channel, value) => {
			const i = q + p * plane + channel;
			if (D[i] !== value) { D[i] = value; bytes++; changed = true; }
		};
		put(1, 1, enc(c.ridge * 255)); put(1, 2, enc(c.terrace * 255));
		put(2, 0, enc(c.bnr * 255)); put(2, 1, enc(c.rv * 255)); put(2, 2, enc(c.dune * 255));
		put(3, 0, enc(c.karst * 255)); put(3, 2, enc(c.trees * 255));
		for (let i = 0; i < 3; i++) {
			put(4, i, surface.ground[0][i]); put(5, i, surface.ground[1][i]); put(6, i, surface.climate[i]);
		}
		if (changed) cells++;
	}
	return { cells, bytes };
}

async function main() {
	const args = process.argv.slice(2);
	if (args.some((s) => s !== '--check')) throw new Error('Usage: node island/tools/refresh-globe-atlas.mjs [--check]');
	const check = args.includes('--check');
	useAtlasData(DATA);
	let changedTiles = 0, changedCells = 0, changedBytes = 0;
	for (const name of tileNames) {
		const url = new URL(name, globeRoot), original = PNG.sync.read(fs.readFileSync(url));
		validateTile(original);
		const preserved = preservedBytes(original), [, row, col] = name.match(/^g(\d+)-(\d+)\.png$/);
		const result = refreshTile(original, Number(row), Number(col));
		if (!preserved.equals(preservedBytes(original))) throw new Error(`Survey bytes changed: ${name}`);
		if (!result.bytes) continue;
		changedTiles++; changedCells += result.cells; changedBytes += result.bytes;
		if (!check) {
			const rgb = Buffer.alloc(300 * 2100 * 3);
			for (let k = 0; k < 300 * 2100; k++) for (let c = 0; c < 3; c++) rgb[k * 3 + c] = original.data[k * 4 + c];
			const encoded = await sharp(rgb, { raw: { width: 300, height: 2100, channels: 3 } }).png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false }).toBuffer();
			const decoded = PNG.sync.read(encoded); validateTile(decoded);
			if (!preserved.equals(preservedBytes(decoded)) || !original.data.equals(decoded.data)) throw new Error(`PNG round-trip changed channels: ${name}`);
			const temp = new URL(name + '.tmp', globeRoot);
			fs.writeFileSync(temp, encoded); fs.renameSync(temp, url);
		}
		console.log(`${name}: ${result.cells} cells, ${result.bytes} atlas bytes ${check ? 'stale' : 'refreshed'}`);
	}
	if (check && changedTiles) throw new Error(`${changedTiles} globe tiles have stale atlas fields`);
	const manifest = writeAssetManifest(check);
	console.log(JSON.stringify({ checkedTiles: 72, changedTiles, changedCells, changedBytes, totalBytes: manifest.totalBytes, version: manifest.version }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
