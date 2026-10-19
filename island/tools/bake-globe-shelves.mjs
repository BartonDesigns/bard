// Lays the Antarctic ice shelves on the globe (assets/globe) as the ice they are. The terrain
// tiles under a shelf give the sea bed (the Ross Ice Shelf read 600 m under the sea) and Natural
// Earth's land stops at the grounding line, so the shelves were open sea: the pack ice was laid
// on them round you and the sea showed past it. Here the shelves' cells (Natural Earth 1:10m
// Antarctic ice shelves, drawn at a sixtieth of a degree) become land: their share of the cell
// is added to its land share, their surface stands 30 m over the sea at the ice front (the ice
// cliff) rising to 80 m some 100 km in, their hills are the shelf's long low swells, and their
// character, ground and climate come from the atlas (refresh-globe-atlas.mjs's refreshTile).
//
// Run from island/ after bake-globe.mjs and before bake-globe-relief.mjs, then
// bake-orbit-earth.mjs. --check reports what would change and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import * as DATA from '../src/earth/data/index.js';
import { useAtlasData } from '../src/earth/atlas.js';
import { enc } from './globe-atlas-fields.mjs';
import { globeRoot, tileNames, validateTile, writeAssetManifest } from './globe-assets-manifest.mjs';
import { refreshTile } from './refresh-globe-atlas.mjs';

const RES = 10, N = 300, W = 360 * RES, H = 180 * RES, PLANE = N * N * 4, SUB = 6, PER = RES * SUB;
const NCACHE = process.env.GLOBE_CACHE || '/tmp/globe-cache', NAME = 'ne_10m_antarctic_ice_shelves_polys.geojson';
const check = process.argv.includes('--check');
// the shelf's surface over the sea (m) by how far in from its front (cells), and its relief (m)
export const shelfTop = (cells) => 30 + 50 * Math.min(1, cells / 9);
export const SHELF_RELIEF = 4;

async function shelves() {
	const file = path.join(NCACHE, NAME);
	if (!fs.existsSync(file) || !fs.statSync(file).size) {
		fs.mkdirSync(NCACHE, { recursive: true });
		const r = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/' + NAME);
		if (!r.ok) throw new Error(r.status + ' ' + NAME);
		fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
	}
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// the share of each cell under a shelf (0..36 sixtieths of a degree squared)
function rasterise(J) {
	const share = new Uint8Array(W * H), seen = new Uint8Array(W * SUB * 90 * SUB);   // (the southern half only)
	const y0all = 90 * PER;
	for (const ft of J.features) {
		const g = ft.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
		for (const rings of polys) {
			let y0 = H * SUB, y1 = 0;
			for (const r of rings) for (const [, la] of r) { const y = (90 - la) * PER; y0 = Math.min(y0, Math.floor(y)); y1 = Math.max(y1, Math.ceil(y)); }
			y0 = Math.max(y0all, y0); y1 = Math.min(H * SUB - 1, y1);
			const rows = Array.from({ length: Math.max(0, y1 - y0 + 1) }, () => []);
			for (const r of rings) for (let k = 0; k < r.length - 1; k++) {
				const xa = (r[k][0] + 180) * PER, ya = (90 - r[k][1]) * PER, xb = (r[k + 1][0] + 180) * PER, yb = (90 - r[k + 1][1]) * PER;
				if (ya === yb) continue;
				const lo = Math.max(y0, Math.ceil(Math.min(ya, yb) - 0.5)), hi = Math.min(y1, Math.floor(Math.max(ya, yb) - 0.5));
				for (let y = lo; y <= hi; y++) { const yc = y + 0.5; if ((yc >= ya) === (yc >= yb)) continue; rows[y - y0].push(xa + (xb - xa) * (yc - ya) / (yb - ya)); }
			}
			for (let q = 0; q < rows.length; q++) {
				const xs = rows[q].sort((a, b) => a - b), y = y0 + q;
				for (let k = 0; k + 1 < xs.length; k += 2) {
					const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(W * SUB - 1, Math.floor(xs[k + 1] - 0.5));
					for (let x = a; x <= b; x++) {
						const s = (y - y0all) * W * SUB + x;
						if (seen[s]) continue;
						seen[s] = 1; share[Math.floor(y / SUB) * W + Math.floor(x / SUB)]++;
					}
				}
			}
		}
	}
	return share;
}

async function main() {
	useAtlasData(DATA);
	const tiles = new Map();
	for (const name of tileNames) { const t = PNG.sync.read(fs.readFileSync(new URL(name, globeRoot))); validateTile(t); tiles.set(name, t); }
	const at = (i, j) => { const name = `g${Math.floor(j / N)}-${Math.floor(i / N)}.png`; return { name, t: tiles.get(name), q: ((j % N) * N + i % N) * 4 }; };
	const share = rasterise(await shelves());

	// the shelf's cells, and how far each is from its front (cells, through the shelf)
	const SH = new Uint8Array(W * H), dist = new Float32Array(W * H).fill(Infinity), queue = [];
	for (let c = 0; c < W * H; c++) if (share[c] >= 18) SH[c] = 1;
	for (let j = H / 2; j < H; j++) for (let i = 0; i < W; i++) {
		const c = j * W + i;
		if (!SH[c]) continue;
		for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const jj = j + dj, ii = (i + di + W) % W;
			if (jj < 0 || jj >= H) continue;
			const n = jj * W + ii, { t, q } = at(ii, jj);
			if (!SH[n] && !t.data[q + 2] && (t.data[q] * 256 + t.data[q + 1]) / 2 - 11000 < 0) { dist[c] = 0; queue.push(c); break; }
		}
	}
	for (let k = 0; k < queue.length; k++) {
		const c = queue[k], j = Math.floor(c / W), i = c % W;
		for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const jj = j + dj, n = jj * W + (i + di + W) % W;
			if (jj < 0 || jj >= H || !SH[n] || dist[n] <= dist[c] + 1) continue;
			dist[n] = dist[c] + 1; queue.push(n);
		}
	}

	let cells = 0, raised = 0;
	const touched = new Set();
	for (let j = H / 2; j < H; j++) for (let i = 0; i < W; i++) {
		const c = j * W + i;
		if (!share[c]) continue;
		const { name, t, q } = at(i, j), D = t.data;
		const land0 = D[q + 2], land = enc(Math.min(255, land0 + share[c] / 36 * 255));
		if (land === land0) continue;
		cells++; touched.add(name);
		D[q + 2] = land;
		if (land >= 128) {
			// (the ice's top over the sea, never under the land it reaches)
			const e = (D[q] * 256 + D[q + 1]) / 2 - 11000, top = shelfTop(Number.isFinite(dist[c]) ? dist[c] : 9);
			if (e < top) { const v = Math.round((top + 11000) * 2); D[q] = v >> 8; D[q + 1] = v & 255; raised++; }
			if (e < top) D[q + PLANE] = enc(Math.sqrt(SHELF_RELIEF) * 8);
			D[q + PLANE * 3 + 1] = 0;
		}
	}
	let refreshed = 0;
	for (const name of touched) { const [, row, col] = name.match(/g(\d+)-(\d+)/).map(Number); refreshed += refreshTile(tiles.get(name), row, col).cells; }
	console.log(JSON.stringify({ shelfCells: cells, raised, tiles: touched.size, refreshed }));
	if (check) return;
	for (const name of touched) {
		const t = tiles.get(name), rgb = Buffer.alloc(N * N * 7 * 3);
		for (let q = 0; q < N * N * 7; q++) for (let ch = 0; ch < 3; ch++) rgb[q * 3 + ch] = t.data[q * 4 + ch];
		const out = await sharp(rgb, { raw: { width: N, height: N * 7, channels: 3 } }).png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false }).toBuffer();
		if (!PNG.sync.read(out).data.equals(t.data)) throw new Error(`PNG round-trip changed ${name}`);
		const url = new URL(name, globeRoot), tmp = new URL(name + '.tmp', globeRoot);
		fs.writeFileSync(tmp, out); fs.renameSync(tmp, url);
	}
	const m = writeAssetManifest();
	console.log(`written; version ${m.version}, ${Math.round(m.totalBytes / 1e5) / 10} MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) await main();
