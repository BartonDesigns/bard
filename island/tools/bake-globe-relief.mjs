// Re-measures the globe's relief (plane 1 R of assets/globe, the height of the engine's own
// hills, globeheight.js) from the real ground at about 600 m, so the land everywhere has the
// hills and valleys it really has. The tiles' elevation (bake-globe.mjs) is a tenth of a degree
// read from 5 km pixels: within a cell it had next to no variation, so the relief was mostly the
// per-region floors and the plains came out as flat as a table.
//
// For each cell the AWS terrain tiles at zoom 8 (Terrarium; SRTM, GMTED2010 and the rest, see
// assets/globe/CREDITS.md) give what the coarse ground leaves out: the spread of the real heights
// in the cell about its own slope (the cell's tilt, from its neighbours' means, taken out). The
// relief is then set so the engine's hills there spread as much (its noise spreads more for the
// same relief where it is ridged: SPREAD), and never less than the kind of land allows (a floor:
// a delta is nearly flat, but no land is a plane). Only land at zoom 8's reach (85 degrees) is
// changed, and land it cannot measure that has no relief at all gets its kind of land's least;
// everything else keeps its bytes. Re-run after bake-globe.mjs and bake-globe-shelves.mjs.
//
// Run from island/: node tools/bake-globe-relief.mjs   (fetches into /tmp/terrarium8, ~2.5 GB;
// TILE8_CACHE to move it). --check reports what would change and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import * as DATA from '../src/earth/data/index.js';
import { useAtlasData, regionAt } from '../src/earth/atlas.js';
import { characterOf, enc } from './globe-atlas-fields.mjs';
import { globeRoot, tileNames, validateTile, writeAssetManifest } from './globe-assets-manifest.mjs';

const RES = 10, N = 300, W = 360 * RES, H = 180 * RES, PLANE = N * N * 4;
const Z = 8, TW = 1 << Z;
const CACHE = process.env.TILE8_CACHE || '/tmp/terrarium8';
const check = process.argv.includes('--check');
fs.mkdirSync(CACHE, { recursive: true });

// how far the engine's relief spreads (sd about each cell's plane) per metre of relief, by how
// ridged it is (measured on globeheight.js's ground: tools/globe-relief.test.mjs checks it)
export const SPREAD = [[0, 0.188], [0.25, 0.215], [0.5, 0.377], [0.85, 0.762], [1, 0.93]];
export function spreadOf(rg) {
	for (let k = 1; k < SPREAD.length; k++) if (rg <= SPREAD[k][0]) { const [a, sa] = SPREAD[k - 1], [b, sb] = SPREAD[k]; return sa + (sb - sa) * (rg - a) / (b - a); }
	return SPREAD[SPREAD.length - 1][1];
}
// the least spread a kind of land has (m): from its authored floor, so a delta stays nearly
// level, the plains roll a little, and the hills and mountains keep their own
export const floorSpread = (floor) => Math.max(2, 0.3 * floor + 3);
// the relief for a measured spread: plane 1 R holds sqrt(relief) * 8 (globedata.js reads (R / 8)^2)
// (TUNE: the engine's ground over 3 km, measured against the real ground over 3 km at a few hundred
// places, came out half as rugged again (its spikier crests and deeper hollows); a little under
// that, the land leaning to more relief rather than less)
const TUNE = 1.25;
export function reliefFor(sd, c) { return Math.min(1016, Math.max(floorSpread(c.floor), sd) / spreadOf(c.ridge) / TUNE); }

// the spread of the real ground at zoom 8 in each cell about its own slope (m; -1 where unknown)
async function measure(LAND) {
	// ---------- the real ground at zoom 8, counted into the cells ----------
	const n = new Uint32Array(W * H), s = new Float64Array(W * H), s2 = new Float64Array(W * H);
	const latOf = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / TW))) * 180 / Math.PI;
	const jobs = [];
	for (let ty = 0; ty < TW; ty++) {
		const la0 = latOf(ty + 1), la1 = latOf(ty);
		const j0 = Math.max(0, Math.floor((90 - la1) * RES)), j1 = Math.min(H - 1, Math.floor((90 - la0) * RES));
		for (let tx = 0; tx < TW; tx++) {
			const i0 = Math.floor(tx / TW * W), i1 = Math.min(W - 1, Math.floor((tx + 1) / TW * W));
			let land = false;
			for (let j = j0; j <= j1 && !land; j++) for (let i = i0; i <= i1; i++) if (LAND[j * W + i]) { land = true; break; }
			if (land) jobs.push([tx, ty]);
		}
	}
	console.log(`zoom ${Z}: ${jobs.length} tiles over land`);
	async function get(tx, ty) {
		const file = path.join(CACHE, `${Z}-${tx}-${ty}.png`);
		if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
		for (let tries = 0; ; tries++) {
			try {
				const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`);
				if (!r.ok) throw new Error(r.status + ' ' + tx + ',' + ty);
				const b = Buffer.from(await r.arrayBuffer());
				fs.writeFileSync(file, b);
				return b;
			} catch (e) { if (tries > 5) throw e; await new Promise((ok) => setTimeout(ok, 1000 * 2 ** tries)); }
		}
	}
	let done = 0, k = 0;
	const t0 = Date.now();
	const rowCell = new Int32Array(256), colCell = new Int32Array(256);
	async function worker() {
		while (k < jobs.length) {
			const [tx, ty] = jobs[k++];
			const png = PNG.sync.read(await get(tx, ty));
			for (let y = 0; y < 256; y++) rowCell[y] = Math.min(H - 1, Math.floor((90 - latOf(ty + (y + 0.5) / 256)) * RES));
			for (let x = 0; x < 256; x++) colCell[x] = Math.min(W - 1, Math.floor((tx + (x + 0.5) / 256) / TW * W));
			for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
				const q = (y * 256 + x) * 4, e = png.data[q] * 256 + png.data[q + 1] + png.data[q + 2] / 256 - 32768;
				if (e < 0.5) continue;                 // (the sea and the sea's edge: the land's own spread only)
				const c = rowCell[y] * W + colCell[x];
				n[c]++; s[c] += e; s2[c] += e * e;
			}
			if (++done % 1000 === 0) console.log(`${done} / ${jobs.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
		}
	}
	await Promise.all(Array.from({ length: 24 }, worker));

	// ---------- the spread about each cell's own slope ----------
	const M = new Float32Array(W * H), SD = new Float32Array(W * H).fill(-1);
	for (let c = 0; c < W * H; c++) if (n[c]) M[c] = s[c] / n[c];
	const cy = 111000 / RES;
	for (let j = 1; j < H - 1; j++) {
		const cx = Math.max(500, cy * Math.cos((90 - (j + 0.5) / RES) * Math.PI / 180));
		for (let i = 0; i < W; i++) {
			const c = j * W + i;
			if (n[c] < 4) continue;
			const E = j * W + (i + 1) % W, Wc = j * W + (i + W - 1) % W, Nn = c - W, S = c + W;
			const gx = n[E] && n[Wc] ? (M[E] - M[Wc]) / (2 * cx) : 0, gy = n[Nn] && n[S] ? (M[Nn] - M[S]) / (2 * cy) : 0;
			const v = s2[c] / n[c] - M[c] * M[c] - (gx * gx * cx * cx + gy * gy * cy * cy) / 12;
			SD[c] = Math.sqrt(Math.max(0, v));
		}
	}
	// (eased over the neighbours, as the ground reads it between the cells)
	const SM = new Float32Array(W * H).fill(-1);
	for (let j = 1; j < H - 1; j++) for (let i = 0; i < W; i++) {
		const c = j * W + i;
		if (SD[c] < 0) continue;
		let a = 0, w = 0;
		for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) { const q = (j + b) * W + (i + d + W) % W, v = SD[q]; if (v >= 0) { const k2 = b || d ? 1 : 2; a += v * v * k2; w += k2; } }
		SM[c] = Math.sqrt(a / w);
	}

	return SM;
}

async function main() {
	useAtlasData(DATA);
	// ---------- the tiles as they are ----------
	const tiles = new Map();
	for (const name of tileNames) { const t = PNG.sync.read(fs.readFileSync(new URL(name, globeRoot))); validateTile(t); tiles.set(name, t); }
	const at = (i, j) => { const t = tiles.get(`g${Math.floor(j / N)}-${Math.floor(i / N)}.png`); return { t, q: ((j % N) * N + i % N) * 4 }; };
	const LAND = new Uint8Array(W * H);
	for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const { t, q } = at(i, j); LAND[j * W + i] = t.data[q + 2] || t.data[q + PLANE * 3 + 1] ? 1 : 0; }

	// (the measured spread is kept beside the downloads, so the relief can be re-set without them)
	const SPREAD_FILE = path.join(CACHE, 'spread-z8.f32');
	let SM;
	if (fs.existsSync(SPREAD_FILE) && !process.argv.includes('--fresh')) { const b = fs.readFileSync(SPREAD_FILE); SM = new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice(); }
	else { SM = await measure(LAND); fs.writeFileSync(SPREAD_FILE, Buffer.from(SM.buffer)); }

	// ---------- the relief written back ----------
	let cells = 0, changed = 0;
	const hist = {};
	for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
		const c = j * W + i;
		if (!LAND[c]) continue;
		const { t, q } = at(i, j);
		// (land past zoom 8's reach or with no land in its pixels, the poles' ice and the ice shelves,
		// keeps what it has unless it has none: then its kind of land's least, never a plane)
		if (SM[c] < 0 && t.data[q + PLANE]) continue;
		const lat = 90 - (j + 0.5) / RES, lon = -180 + (i + 0.5) / RES;
		const R = regionAt(lat, lon), ch = characterOf(R);
		if (!R?.land) continue;
		const A = reliefFor(Math.max(0, SM[c]), ch), v = enc(Math.round(Math.sqrt(A) * 8));
		cells++;
		if (t.data[q + PLANE] !== v) { t.data[q + PLANE] = v; changed++; }
		const b = SM[c] < 0 ? 'unmeasured' : SM[c] < 5 ? '<5' : SM[c] < 15 ? '5-15' : SM[c] < 40 ? '15-40' : SM[c] < 120 ? '40-120' : '120+';
		hist[b] = (hist[b] || 0) + 1;
	}
	console.log(JSON.stringify({ cells, changed, spread: hist }));
	if (check) return;
	for (const [name, t] of tiles) {
		const rgb = Buffer.alloc(N * N * 7 * 3);
		for (let q = 0; q < N * N * 7; q++) for (let ch = 0; ch < 3; ch++) rgb[q * 3 + ch] = t.data[q * 4 + ch];
		const out = await sharp(rgb, { raw: { width: N, height: N * 7, channels: 3 } }).png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false }).toBuffer();
		const back = PNG.sync.read(out);
		if (!back.data.equals(t.data)) throw new Error(`PNG round-trip changed ${name}`);
		const url = new URL(name, globeRoot), tmp = new URL(name + '.tmp', globeRoot);
		fs.writeFileSync(tmp, out); fs.renameSync(tmp, url);
	}
	const m = writeAssetManifest();
	console.log(`written; version ${m.version}, ${Math.round(m.totalBytes / 1e5) / 10} MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) await main();
