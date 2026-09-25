// Bakes the real Bay Area terrain for Crysis from the public AWS terrain tiles
// (Terrarium encoding; sources incl. USGS 3DEP, NOAA bathymetry, ETOPO1 - see
// https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
// Run from island/: node tools/bake-bayarea.mjs   (needs pngjs: npm i --no-save pngjs)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { LEVELS, LAT0, LON0, KX, KZ, H_OFF, H_SCALE } from '../src/bay/geo.js';

const CACHE = process.env.TILE_CACHE || '/tmp/terrarium';
fs.mkdirSync(CACHE, { recursive: true });
const tileX = (lon, z) => (lon + 180) / 360 * 2 ** z;
const tileY = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };

async function tile(z, x, y) {
	const f = path.join(CACHE, `${z}-${x}-${y}.png`);
	if (!fs.existsSync(f)) {
		for (let tries = 0; ; tries++) {
			try {
				const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
				if (!r.ok) throw new Error(r.status);
				fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
				break;
			} catch (e) { if (tries > 4) throw e; await new Promise((ok) => setTimeout(ok, 1000 * 2 ** tries)); }
		}
	}
	const png = PNG.sync.read(fs.readFileSync(f));
	const h = new Float32Array(256 * 256);
	for (let i = 0; i < h.length; i++) h[i] = png.data[i * 4] * 256 + png.data[i * 4 + 1] + png.data[i * 4 + 2] / 256 - 32768;
	return h;
}

const only = process.argv[2];             // bake just one level: node tools/bake-bayarea.mjs h3
for (const L of LEVELS) {
	if (only && L.name !== only) continue;
	const z = L.zoom;
	const x0 = (L.lon[0] - LON0) * KX, x1 = (L.lon[1] - LON0) * KX;
	const zN = -(L.lat[1] - LAT0) * KZ, zS = -(L.lat[0] - LAT0) * KZ;
	const W = Math.round((x1 - x0) / L.step) + 1, Hh = Math.round((zS - zN) / L.step) + 1;
	const tx0 = Math.floor(tileX(L.lon[0], z)), tx1 = Math.floor(tileX(L.lon[1], z));
	const ty0 = Math.floor(tileY(L.lat[1], z)), ty1 = Math.floor(tileY(L.lat[0], z));
	const tiles = new Map();
	for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) tiles.set(tx + ',' + ty, await tile(z, tx, ty));
	console.log(L.name, W, 'x', Hh, 'tiles', tiles.size);
	const px = (fx, fy) => {
		const tx = Math.floor(fx / 256), ty = Math.floor(fy / 256), t = tiles.get(tx + ',' + ty);
		if (!t) return -50;
		return t[(Math.floor(fy) - ty * 256) * 256 + (Math.floor(fx) - tx * 256)];
	};
	const out = new Float32Array(W * Hh);
	for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
		const lon = LON0 + (x0 + i * L.step) / KX, lat = LAT0 - (zN + j * L.step) / KZ;
		const fx = tileX(lon, z) * 256 - 0.5, fy = tileY(lat, z) * 256 - 0.5;
		const ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
		out[j * W + i] = (px(ix, iy) * (1 - u) + px(ix + 1, iy) * u) * (1 - v) + (px(ix, iy + 1) * (1 - u) + px(ix + 1, iy + 1) * u) * v;
	}
	// below-sea-level ground that the sea cannot reach (behind levees) stays land
	const sea = new Uint8Array(W * Hh), q = [];
	for (let i = 0; i < W; i++) for (const j of [0, Hh - 1]) if (out[j * W + i] <= 0) { sea[j * W + i] = 1; q.push(j * W + i); }
	for (let j = 0; j < Hh; j++) for (const i of [0, W - 1]) if (out[j * W + i] <= 0 && !sea[j * W + i]) { sea[j * W + i] = 1; q.push(j * W + i); }
	while (q.length) {
		const k = q.pop(), i = k % W, j = (k - i) / W;
		for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= Hh) continue;
			const n = b * W + a; if (!sea[n] && out[n] <= 0) { sea[n] = 1; q.push(n); }
		}
	}
	let raised = 0;
	for (let k = 0; k < out.length; k++) if (out[k] <= 0 && !sea[k]) { out[k] = 0.4; raised++; }
	const png = new PNG({ width: W, height: Hh });
	for (let k = 0; k < out.length; k++) {
		const v = Math.max(0, Math.min(65535, Math.round((out[k] + H_OFF) * H_SCALE)));
		png.data[k * 4] = v >> 8; png.data[k * 4 + 1] = v & 255; png.data[k * 4 + 2] = 0; png.data[k * 4 + 3] = 255;
	}
	const file = `assets/bayarea/${L.name}.png`;
	fs.writeFileSync(file, PNG.sync.write(png, { deflateLevel: 9 }));
	let mn = 1e9, mx = -1e9; for (const v of out) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
	console.log(' ', file, (fs.statSync(file).size / 1e6).toFixed(2), 'MB, range', mn.toFixed(0), mx.toFixed(0), 'raised', raised);
}
