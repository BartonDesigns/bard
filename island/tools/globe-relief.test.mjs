// The globe's relief (bake-globe-relief.mjs): the engine's hills spread as the bake assumes,
// and the land past the Bay is never left as flat as a table.
//   node island/tools/globe-relief.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { createGlobeHeight } from '../src/earth/globeheight.js';
import { SPREAD } from './bake-globe-relief.mjs';
import { globeRoot } from './globe-assets-manifest.mjs';

const NW = 256, PLANES = ['E', 'L', 'WL', 'A', 'RG', 'TR', 'BNR', 'RV', 'DUNE', 'KARST', 'K', 'TREES', 'TEMP', 'RAIN'];
// a window of the real tiles round (lat, lon), as globedata.js puts it together
const tiles = new Map();
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
const kLat = 110996;
function range3km(lat, lon) {
	const H = createGlobeHeight(windowAt(lat, lon)), kLon = 111320 * Math.cos(lat * Math.PI / 180);
	let lo = Infinity, hi = -Infinity;
	for (let dz = -1500; dz <= 1500; dz += 100) for (let dx = -1500; dx <= 1500; dx += 100) { const h = H.atLL(lat - dz / kLat, lon + dx / kLon); lo = Math.min(lo, h); hi = Math.max(hi, h); }
	return hi - lo;
}

test('the bake\'s spread table matches the ground the engine draws', () => {
	for (const [RG, k] of SPREAD.slice(0, 4)) {
		const P = {}; for (const p of PLANES) P[p] = new Float32Array(NW * NW);
		// (the relief of a land too flat for the hills to be lifted, hillGain: the noise as the bake reads it)
		P.E.fill(500); P.L.fill(1); P.A.fill(10); P.RG.fill(RG);
		const H = createGlobeHeight({ N: NW, P, gi0: 1800 - 128, gj0: 500 - 128 });
		let acc = 0;
		for (let c = 0; c < 16; c++) {
			const lat0 = 40 + (c % 4) * 0.1, lon0 = (c >> 2) * 0.1, hs = [], xs = [];
			for (let b = 0; b < 20; b++) for (let a = 0; a < 20; a++) { hs.push(H.atLL(lat0 + b / 200, lon0 + a / 200)); xs.push([a, b]); }
			// the spread about the cell's own plane
			const n = hs.length, m = (f) => xs.reduce((s, x, i) => s + f(x, hs[i]), 0) / n;
			const ma = m((x) => x[0]), mb = m((x) => x[1]), mh = m((x, h) => h);
			const ka = (m((x, h) => x[0] * h) - ma * mh) / (m((x) => x[0] * x[0]) - ma * ma), kb = (m((x, h) => x[1] * h) - mb * mh) / (m((x) => x[1] * x[1]) - mb * mb);
			acc += Math.sqrt(m((x, h) => (h - mh - ka * (x[0] - ma) - kb * (x[1] - mb)) ** 2));
		}
		const got = acc / 16 / 10;
		assert.ok(Math.abs(got - k) / k < 0.2, `ridge ${RG}: spread ${got.toFixed(3)} a metre of relief, the bake assumes ${k}`);
	}
});

test('the plains past the Bay rise and fall like the real ones, the mountains stand', () => {
	// (real ranges across 3 km, from the zoom 8 terrain the bake reads: Paris 39 m, Kansas 39,
	// Ohio 32, the Harz edge 164, the Alps 680; before the bake the game had 10, 10, 13, 58; the
	// plains and uplands are drawn taller than measured since, hillGain in globeheight.js)
	const at = { paris: [48.85, 2.35, 25, 120], kansas: [38.5, -98, 12, 80], ohio: [40.2, -82.9, 15, 80], germany: [51, 10, 90, 400], alps: [46.5, 8, 500, 2500] };
	for (const [name, [lat, lon, lo, hi]] of Object.entries(at)) {
		const r = range3km(lat, lon);
		assert.ok(r >= lo && r <= hi, `${name}: ${Math.round(r)} m across 3 km (want ${lo} to ${hi})`);
	}
});
