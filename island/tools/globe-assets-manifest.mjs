import fs from 'node:fs';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

export const globeRoot = new URL('../assets/globe/', import.meta.url);
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
export const tileNames = Array.from({ length: 72 }, (_, k) => `g${Math.floor(k / 12)}-${k % 12}.png`);

export function validateTile(tile) {
	if (tile.width !== 300 || tile.height !== 2100 || tile.colorType !== 2 || tile.data.length !== 300 * 2100 * 4) {
		throw new Error('Expected a 300 × 2100 RGB globe tile with seven stacked planes');
	}
}

// Survey-derived bytes that an atlas-only refresh must never change.
export function preservedBytes(tile) {
	const n = 300 * 300, plane = n * 4, out = Buffer.alloc(n * 5);
	for (let k = 0; k < n; k++) {
		const q = k * 4, j = k * 5;
		out[j] = tile.data[q]; out[j + 1] = tile.data[q + 1]; out[j + 2] = tile.data[q + 2];
		out[j + 3] = tile.data[q + plane]; out[j + 4] = tile.data[q + plane * 3 + 1];
	}
	return out;
}

export function assetManifest() {
	const dataRoot = new URL('../src/earth/data/', import.meta.url);
	const sources = [new URL('../src/earth/atlas.js', import.meta.url), new URL('globe-atlas-fields.mjs', import.meta.url),
		...fs.readdirSync(dataRoot).filter((s) => s.endsWith('.js')).sort().map((s) => new URL(s, dataRoot))];
	const tiles = tileNames.map((name) => {
		const bytes = fs.readFileSync(new URL(name, globeRoot)), tile = PNG.sync.read(bytes);
		validateTile(tile);
		return { name, bytes: bytes.length, sha256: sha(bytes), preservedSha256: sha(preservedBytes(tile)) };
	});
	return {
		format: 1, width: 300, height: 2100, cellsPerDegree: 10,
		preserved: 'Plane 0 RGB: elevation/land; plane 1 R: survey-derived relief amplitude; plane 3 G: lakes',
		refreshed: 'Plane 1 GB, plane 2 RGB, plane 3 RB: atlas shapes/trees; planes 4–5 RGB: ground; plane 6 RGB: mean temperature/rain/snow',
		sourceSha256: sha(Buffer.concat(sources.map((url) => fs.readFileSync(url)))),
		version: sha(tiles.map((t) => t.sha256).join('\n')).slice(0, 16),
		totalBytes: tiles.reduce((sum, tile) => sum + tile.bytes, 0), tiles,
	};
}

export function writeAssetManifest(check = false) {
	const manifest = assetManifest();
	const files = [
		[new URL('atlas-refresh.json', globeRoot), JSON.stringify(manifest, null, 2) + '\n'],
		[new URL('../src/earth/globe-assets.js', import.meta.url), `// Generated from the packed globe tiles by tools/refresh-globe-atlas.mjs.\nexport const GLOBE_ASSET_VERSION = '${manifest.version}';\n`],
	];
	for (const [url, content] of files) {
		if (check) {
			if (!fs.existsSync(url) || fs.readFileSync(url, 'utf8') !== content) throw new Error(`Stale globe manifest: ${url.pathname}`);
		} else fs.writeFileSync(url, content);
	}
	return manifest;
}
