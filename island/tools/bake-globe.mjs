// Bakes the coarse whole Earth for the globe (src/earth/globe*.js): a grid of a tenth of a
// degree (about 11 km) over every latitude and longitude, cut into 30-degree tiles, each an
// RGB PNG of seven planes stacked top to bottom (300 x 2100):
//
//   A  elevation (R high byte, G low: (h + 11000) * 2), the share of the cell that is land (B)
//   B  the detail's height (R: sqrt-coded metres), how sharp its ridges (G), how terraced (B)
//   C  ranges drawn north-south (R: basin and range), ridge-and-valley north-east (G), dunes (B)
//   D  tower karst (R), the share of the cell that is lake (G), tree cover (B)
//   E  the ground's first colour (RGB)      F  its second colour (RGB)
//   G  mean temperature (R: (t + 30) * 4), rain (G: sqrt(mm) * 4), snow (B: 0..1)
//
// Elevation: the public AWS terrain tiles (Terrarium encoding, zoom 5; they bring together
// SRTM, GMTED2010, ETOPO1, NOAA and others; see assets/globe/CREDITS.md). The land, islands
// and lakes: Natural Earth 1:10m (public domain), drawn at a sixtieth of a degree and
// counted into each cell. Everything from B down is the place's character: its local relief
// from the elevation itself, and how that relief is shaped, coloured and grown over from the
// atlas (src/earth/atlas.js): basin and range, ridge and valley, mesas, dunes and karst where
// the atlas says the land is so. Re-run it when the atlas's terrain changes.
//
// For atlas colours/climate/shapes only, use tools/refresh-globe-atlas.mjs without downloads.
// Run from island/: node tools/bake-globe.mjs   (fetches into /tmp/terrarium and /tmp/globe-cache)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import * as DATA from '../src/earth/data/index.js';
import { useAtlasData, regionAt } from '../src/earth/atlas.js';
import { characterOf, surfaceOf, enc } from './globe-atlas-fields.mjs';
import { writeAssetManifest } from './globe-assets-manifest.mjs';

const RES = 10, TILE = 30, N = RES * TILE, W = 360 * RES, H = 180 * RES;
const SUB = 6, PER = RES * SUB, SW = W * SUB, SH = H * SUB;          // the land raster: a sixtieth of a degree
const Z = 5, MW = 256 << Z;                           // the Mercator source, 8192 px round the world
const OUT = path.resolve('assets/globe');
const TCACHE = process.env.TILE_CACHE || '/tmp/terrarium', NCACHE = '/tmp/globe-cache';
fs.mkdirSync(TCACHE, { recursive: true }); fs.mkdirSync(NCACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

async function get(url, file) {
	if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
	for (let tries = 0; ; tries++) {
		try {
			const r = await fetch(url);
			if (!r.ok) throw new Error(r.status + ' ' + url);
			const b = Buffer.from(await r.arrayBuffer());
			fs.writeFileSync(file, b);
			return b;
		} catch (e) { if (tries > 4) throw e; await new Promise((ok) => setTimeout(ok, 1000 * 2 ** tries)); }
	}
}

// ---------- the elevation: the Mercator mosaic at zoom 5 ----------
console.log('elevation tiles...');
const merc = new Float32Array(MW * MW);
{
	const jobs = [];
	for (let x = 0; x < 1 << Z; x++) for (let y = 0; y < 1 << Z; y++) jobs.push([x, y]);
	let k = 0;
	const worker = async () => {
		while (k < jobs.length) {
			const [x, y] = jobs[k++];
			const png = PNG.sync.read(await get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`, path.join(TCACHE, `${Z}-${x}-${y}.png`)));
			for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
				const q = (j * 256 + i) * 4;
				merc[(y * 256 + j) * MW + x * 256 + i] = png.data[q] * 256 + png.data[q + 1] + png.data[q + 2] / 256 - 32768;
			}
		}
	};
	await Promise.all(Array.from({ length: 12 }, worker));
}
const mercY = (lat) => { const r = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * MW; };
function elevAt(lat, lon) {
	const fx = ((lon + 180) / 360 * MW - 0.5 + MW) % MW, fy = Math.min(MW - 1.001, Math.max(0, mercY(lat) - 0.5));
	const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, i1 = (i + 1) % MW;
	const a = merc[j * MW + i], b = merc[j * MW + i1], c = merc[(j + 1) * MW + i], d = merc[(j + 1) * MW + i1];
	return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// ---------- the land and the lakes: Natural Earth drawn at a sixtieth of a degree ----------
// 0 sea, 1 land, 2 lake
console.log('coastlines...');
const mask = new Uint8Array(SW * SH);
const lakeOf = new Int32Array(W * H).fill(-1);         // which lake a cell's lake water belongs to
function fill(geom, value, onCell) {
	const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
	for (const rings of polys) {
		let y0 = SH, y1 = 0;
		for (const r of rings) for (const [, la] of r) { const y = (90 - la) * PER; y0 = Math.min(y0, Math.floor(y)); y1 = Math.max(y1, Math.ceil(y)); }
		y0 = Math.max(0, y0); y1 = Math.min(SH - 1, y1);
		const rows = Array.from({ length: y1 - y0 + 1 }, () => []);
		for (const r of rings) for (let k = 0; k < r.length - 1; k++) {
			const [xa, ya] = [(r[k][0] + 180) * PER, (90 - r[k][1]) * PER], [xb, yb] = [(r[k + 1][0] + 180) * PER, (90 - r[k + 1][1]) * PER];
			if (ya === yb) continue;
			const lo = Math.max(y0, Math.ceil(Math.min(ya, yb) - 0.5)), hi = Math.min(y1, Math.floor(Math.max(ya, yb) - 0.5));
			for (let y = lo; y <= hi; y++) { const yc = y + 0.5; if ((yc >= ya) === (yc >= yb)) continue; rows[y - y0].push(xa + (xb - xa) * (yc - ya) / (yb - ya)); }
		}
		for (let q = 0; q < rows.length; q++) {
			const xs = rows[q].sort((a, b) => a - b), y = y0 + q;
			for (let k = 0; k + 1 < xs.length; k += 2) {
				const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(SW - 1, Math.floor(xs[k + 1] - 0.5));
				for (let x = a; x <= b; x++) { mask[y * SW + x] = value; if (onCell) onCell(Math.floor(x / SUB), Math.floor(y / SUB)); }
			}
		}
	}
}
for (const f of ['ne_10m_land', 'ne_10m_minor_islands']) {
	const J = JSON.parse(await get(NE + f + '.geojson', path.join(NCACHE, f + '.geojson')));
	for (const ft of J.features) fill(ft.geometry, 1);
}
// the big lakes only (the small ones are the generator's, crysis/rivers.js)
const lakes = [];
{
	const J = JSON.parse(await get(NE + 'ne_10m_lakes.geojson', path.join(NCACHE, 'ne_10m_lakes.geojson')));
	for (const ft of J.features) {
		const p = ft.properties || {};
		if ((p.scalerank ?? 9) > 3 && !/Tahoe|Titicaca|Geneva|Léman|Leman|Constance|Garda|Como|Balaton|Ohrid|Sevan|Van|Issyk|Dongting|Poyang|Tai/i.test(p.name || '')) continue;
		const id = lakes.length;
		lakes.push({ name: p.name || '', cells: 0 });
		fill(ft.geometry, 2, (i, j) => { lakeOf[j * W + i] = id; });
	}
}
console.log('lakes kept', lakes.length);

// ---------- the atlas: the character of each place ----------
useAtlasData(DATA);
// ---------- the cells ----------
console.log('cells...');
const E = new Float32Array(W * H), LAND = new Uint8Array(W * H), LAKE = new Uint8Array(W * H), STD = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
	let nl = 0, nw = 0, nk = 0, sl = 0, sl2 = 0, sw = 0;
	for (let b = 0; b < SUB; b++) for (let a = 0; a < SUB; a++) {
		const x = i * SUB + a, y = j * SUB + b, m = mask[y * SW + x];
		const e = elevAt(90 - (y + 0.5) / PER, -180 + (x + 0.5) / PER);
		if (m === 1) { nl++; sl += e; sl2 += e * e; } else if (m === 2) nk++; else { nw++; sw += e; }
	}
	const k = j * W + i, n = SUB * SUB;
	LAND[k] = Math.round(nl / n * 255); LAKE[k] = Math.round(nk / n * 255);
	if (nl) { const m = sl / nl; E[k] = m; STD[k] = Math.sqrt(Math.max(0, sl2 / nl - m * m)); } else E[k] = nw ? Math.min(-1, sw / nw) : 0;
	if (nl && E[k] < 1) E[k] = Math.max(E[k], 1);
}
// each big lake's surface: its own shallows (where the elevation is the lake's bed, the
// shallowest of it; where it is the surface, the surface), kept under most of its shore
{
	const shore = lakes.map(() => []), inner = lakes.map(() => []);
	for (let y = 1; y < SH - 1; y++) for (let x = 0; x < SW; x++) {
		if (mask[y * SW + x] !== 2) continue;
		const id = lakeOf[Math.floor(y / SUB) * W + Math.floor(x / SUB)];
		if (id < 0) continue;
		if ((x + y) % 3 === 0 && inner[id].length < 40000) inner[id].push(elevAt(90 - (y + 0.5) / PER, -180 + (x + 0.5) / PER));
		for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const xx = (x + dx + SW) % SW, yy = y + dy;
			if (mask[yy * SW + xx] === 1 && shore[id].length < 20000) shore[id].push(elevAt(90 - (yy + 0.5) / PER, -180 + (xx + 0.5) / PER));
		}
	}
	for (let id = 0; id < lakes.length; id++) {
		const s = shore[id].sort((a, b) => a - b), q = inner[id].sort((a, b) => a - b);
		const top = q.length ? q[Math.floor(q.length * 0.95)] : 0, low = s.length ? s[Math.floor(s.length * 0.3)] : top;
		lakes[id].level = Math.min(top, low);
	}
	// a lake at or under the sea's level is left to the sea (the Caspian, the Dead Sea)
	for (let k = 0; k < W * H; k++) {
		const id = lakeOf[k];
		if (id < 0 || LAKE[k] === 0) continue;
		const L = lakes[id];
		if (L.level <= 1) { LAKE[k] = 0; continue; }
		if (LAKE[k] >= LAND[k]) E[k] = L.level;
	}
	console.log(lakes.filter((L) => L.level > 1).map((L) => L.name + ' ' + Math.round(L.level)).join(', '));
}

// ---------- the small islands: a lone cluster of land cells (under about 4 cells of land in
// all) has its share lifted, so an island like Bermuda stands out of the sea at this grid ----------
{
	const seen = new Uint8Array(W * H);
	let lifted = 0;
	for (let k0 = 0; k0 < W * H; k0++) {
		if (seen[k0] || LAND[k0] < 3) continue;
		const comp = [k0], stack = [k0]; seen[k0] = 1;
		let area = 0;
		while (stack.length && comp.length < 60) {
			const k = stack.pop(); area += LAND[k] / 255;
			const i = k % W, j = (k - i) / W;
			for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
				const jj = j + b; if (jj < 0 || jj >= H) continue;
				const q = jj * W + (i + a + W) % W;
				if (!seen[q] && LAND[q] >= 3) { seen[q] = 1; comp.push(q); stack.push(q); }
			}
		}
		if (comp.length >= 60 || area > 4) continue;
		const peak = Math.max(...comp.map((k) => LAND[k]));
		for (const k of comp) if (LAND[k] === peak || LAND[k] >= 20) { LAND[k] = Math.max(LAND[k], LAND[k] === peak ? 190 : 150); E[k] = Math.max(E[k], 4); }
		lifted++;
	}
	console.log('small islands lifted', lifted);
}

// ---------- kept small: the land to 6 m, the shelf to 10 m, the deep sea smoothed to 200 m ----------
{
	const S = new Float32Array(W * H), T = new Float32Array(W * H);
	for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
		let s = 0, t = 0, n = 0;
		for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) {
			const jj = Math.max(0, Math.min(H - 1, j + b)), ii = (i + a + W) % W, q = jj * W + ii;
			s += E[q]; n++;
			if (Math.abs(a) <= 1 && Math.abs(b) <= 1) t += STD[q];
		}
		S[j * W + i] = s / n; T[j * W + i] = t / 9;
	}
	for (let k = 0; k < W * H; k++) {
		STD[k] = LAND[k] ? T[k] : 0;
		if (LAKE[k] && LAKE[k] >= LAND[k] && lakeOf[k] >= 0 && lakes[lakeOf[k]].level > 1) continue;      // a lake's level as it is
		if (LAND[k]) E[k] = Math.max(1, Math.round(E[k] / 6) * 6);
		else if (E[k] > -200) E[k] = Math.min(-1, Math.round(E[k] / 10) * 10);
		else E[k] = Math.round(Math.min(-200, S[k]) / 200) * 200;
	}
}

// ---------- the tiles ----------
let total = 0;
const t0 = Date.now();
for (let tj = 0; tj < 180 / TILE; tj++) for (let ti = 0; ti < 360 / TILE; ti++) {
	const png = new PNG({ width: N, height: N * 7, colorType: 2, inputHasAlpha: false });
	const D = png.data;
	const put = (plane, x, y, r, g, b) => { const q = ((plane * N + y) * N + x) * 4; D[q] = r; D[q + 1] = g; D[q + 2] = b; D[q + 3] = 255; };
	for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
		const i = ti * N + x, j = tj * N + y, k = j * W + i;
		const lat = 90 - (j + 0.5) / RES, lon = -180 + (i + 0.5) / RES;
		const v = Math.max(0, Math.min(65535, Math.round((E[k] + 11000) * 2)));
		put(0, x, y, v >> 8, v & 255, LAND[k]);
		// the character, only where there is land or lake near
		const at = LAND[k] || LAKE[k] || E[k] > -60 ? regionAt(lat, lon) : null;
		const c = characterOf(at), { ground, climate } = surfaceOf(at);
		const amp = c.floor + c.gain * STD[k] * 1.25;
		put(1, x, y, enc(Math.round(Math.sqrt(amp) * 2) * 4), enc(c.ridge * 255), enc(c.terrace * 255));
		put(2, x, y, enc(c.bnr * 255), enc(c.rv * 255), enc(c.dune * 255));
		put(3, x, y, enc(c.karst * 255), LAKE[k], enc(c.trees * 255));
		put(4, x, y, ...ground[0]);
		put(5, x, y, ...ground[1]);
		put(6, x, y, ...climate);
	}
	const rgb = Buffer.alloc(N * N * 7 * 3);
	for (let q = 0; q < N * N * 7; q++) { rgb[q * 3] = D[q * 4]; rgb[q * 3 + 1] = D[q * 4 + 1]; rgb[q * 3 + 2] = D[q * 4 + 2]; }
	const buf = await sharp(rgb, { raw: { width: N, height: N * 7, channels: 3 } }).png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false }).toBuffer();
	fs.writeFileSync(path.join(OUT, `g${tj}-${ti}.png`), buf);
	total += buf.length;
	process.stdout.write(`\r${tj},${ti} ${(total / 1e6).toFixed(2)} MB ${((Date.now() - t0) / 1000).toFixed(0)}s   `);
}
console.log('\ntotal', (total / 1e6).toFixed(2), 'MB');
writeAssetManifest();
