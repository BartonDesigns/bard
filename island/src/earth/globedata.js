// The coarse Earth, streamed: the baked 30-degree tiles (assets/globe, tools/bake-globe.mjs)
// fetched as you come near them, and a window of 256 x 256 cells (25.6 degrees) round you
// put together from them for the ground: as flat arrays for the CPU (globeheight.js) and as
// five textures for the GPU. The window moves when you are 6 degrees from its middle; the
// tiles it needs load first, so it moves in one go and the ground never changes under you.
// At most six tiles are kept (about 15 MB), the least lately used let go.
//
// The planes of a cell (see the bake): E elevation, L land share, WL the lake's level round a
// lake (0 elsewhere), A the relief's height, RG ridges, TR terraces, BNR / RV the ranges'
// directions, DUNE, KARST, K lake share, TREES tree cover, GA / GB the ground's colours,
// TEMP mean temperature, RAIN.

import * as THREE from 'three';
import { F } from './globeframe.js';
import { RES } from './globeheight.js';

const TILE = 30, TN = TILE * RES, GW = 360 * RES, GH = 180 * RES;
const NW = 256, MOVE = 60, KEEP = 6;
const PLANES = ['E', 'L', 'WL', 'A', 'RG', 'TR', 'BNR', 'RV', 'DUNE', 'KARST', 'K', 'TREES', 'TEMP', 'RAIN'];

export function createGlobeData() {
	const tiles = new Map();                // 'tj-ti' -> { px: Uint8ClampedArray (RGBA of 300 x 2100), used } | Promise
	// two of everything: the window in use, and the next one put together behind it a slice
	// at a time, then swapped in at once (so no frame waits on the whole of it)
	const planes = () => { const o = {}; for (const k of PLANES) o[k] = new Float32Array(NW * NW); return o; };
	const layers = () => [new Float32Array(NW * NW * 4), new Uint8Array(NW * NW * 4), new Uint8Array(NW * NW * 4), new Uint8Array(NW * NW * 4), new Uint8Array(NW * NW * 4)];
	const P = planes(), rgba = layers();
	let backP = planes(), backL = layers();
	const tex = rgba.map((a, i) => {
		const t = new THREE.DataTexture(a, NW, NW, THREE.RGBAFormat, i === 0 ? THREE.FloatType : THREE.UnsignedByteType);
		t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
		return t;
	});
	// (the window: its first cell's global indices, and where the anchor falls in it)
	const win = { N: NW, P, gi0: 0, gj0: 0, cx0: 0, cy0: 0, ready: false, version: 0, moving: null };
	const stats = { tiles: 0, loads: 0, composeMs: 0, decodeMs: 0 };

	const url = (tj, ti) => { try { return new URL(`../assets/globe/g${tj}-${ti}.png`, import.meta.url).href; } catch { return `assets/globe/g${tj}-${ti}.png`; } };
	function tile(tj, ti) {
		const k = tj + '-' + ti;
		let T = tiles.get(k);
		if (T) { if (!(T instanceof Promise)) T.used = performance.now(); return T; }
		T = (async () => {
			const blob = await (await fetch(url(tj, ti))).blob();
			const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
			const t0 = performance.now();
			const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
			const cx = cv.getContext('2d', { willReadFrequently: true });
			cx.drawImage(bmp, 0, 0);
			const px = cx.getImageData(0, 0, bmp.width, bmp.height).data;
			bmp.close?.();
			stats.decodeMs = Math.max(stats.decodeMs, performance.now() - t0);
			const done = { px, used: performance.now() };
			tiles.set(k, done); stats.tiles++; stats.loads++;
			// keep a few
			if (tiles.size > KEEP) {
				const old = [...tiles.entries()].filter(([, v]) => !(v instanceof Promise)).sort((a, b) => a[1].used - b[1].used);
				for (const [kk] of old.slice(0, tiles.size - KEEP)) tiles.delete(kk);
			}
			return done;
		})().catch((e) => { tiles.delete(k); throw e; });
		tiles.set(k, T);
		return T;
	}
	const tileOf = (gi, gj) => [Math.floor(gj / TN), Math.floor((((gi % GW) + GW) % GW) / TN)];

	// the window with its first cell at (gi0, gj0): fetch what it needs, then put it together
	async function place(gi0, gj0) {
		gj0 = Math.max(0, Math.min(GH - NW, gj0));
		const need = new Set();
		for (let j = 0; j < NW; j += TN / 2) for (let i = 0; i < NW; i += TN / 2) need.add(tileOf(gi0 + i, gj0 + j).join('-'));
		for (const c of [[NW - 1, 0], [0, NW - 1], [NW - 1, NW - 1]]) need.add(tileOf(gi0 + c[0], gj0 + c[1]).join('-'));
		const got = new Map();
		await Promise.all([...need].map(async (k) => { const [tj, ti] = k.split('-').map(Number); got.set(k, await tile(tj, ti)); }));
		await compose(gi0, gj0, got);
	}
	const colX = new Int32Array(NW), colT = new Int32Array(NW), bestD = new Uint8Array(NW * NW);
	async function compose(gi0, gj0, got) {
		let t0 = performance.now(), work = 0;
		const [A, B, C, D, G4] = backL, PS = TN * TN * 4;
		const { E: PE, L: PL, A: PA, RG: PRG, TR: PTR, BNR: PBNR, RV: PRV, DUNE: PDU, KARST: PKA, K: PK, TREES: PTREES, TEMP: PTEMP, RAIN: PRAIN } = backP;
		for (let i = 0; i < NW; i++) { const gi = (((gi0 + i) % GW) + GW) % GW, ti = Math.floor(gi / TN); colT[i] = ti; colX[i] = gi - ti * TN; }
		for (let j = 0; j < NW; j++) {
			if ((j & 31) === 31) { work += performance.now() - t0; await new Promise((ok) => setTimeout(ok, 0)); t0 = performance.now(); }
			const gj = Math.min(GH - 1, gj0 + j), tj = Math.floor(gj / TN), y = gj - tj * TN;
			let tiNow = -1, px = null;
			for (let i = 0; i < NW; i++) {
				if (colT[i] !== tiNow) { tiNow = colT[i]; px = got.get(tj + '-' + tiNow).px; }
				const k = j * NW + i, k4 = k * 4, q = (y * TN + colX[i]) * 4, q1 = q + PS, q2 = q1 + PS, q3 = q2 + PS, qa = q3 + PS, qb = qa + PS, qc = qb + PS;
				const E = (px[q] * 256 + px[q + 1]) / 2 - 11000, L = px[q + 2] / 255, Am = (px[q1] / 8) ** 2;
				PE[k] = E; PL[k] = L; PA[k] = Am; PRG[k] = px[q1 + 1] / 255; PTR[k] = px[q1 + 2] / 255; PBNR[k] = px[q2] / 255; PRV[k] = px[q2 + 1] / 255;
				PDU[k] = px[q2 + 2] / 255; PKA[k] = px[q3] / 255; PK[k] = px[q3 + 1] / 255; PTREES[k] = px[q3 + 2] / 255; PTEMP[k] = px[qc] / 4 - 30; PRAIN[k] = (px[qc + 1] / 4) ** 2;
				A[k4] = E; A[k4 + 1] = L; A[k4 + 3] = Am;
				B[k4] = px[q1 + 1]; B[k4 + 1] = px[q1 + 2]; B[k4 + 2] = px[q2]; B[k4 + 3] = px[q2 + 1];
				C[k4] = px[q2 + 2]; C[k4 + 1] = px[q3]; C[k4 + 2] = px[q3 + 1]; C[k4 + 3] = px[q3 + 2];
				D[k4] = px[qa]; D[k4 + 1] = px[qa + 1]; D[k4 + 2] = px[qa + 2]; D[k4 + 3] = px[qc];
				G4[k4] = px[qb]; G4[k4 + 1] = px[qb + 1]; G4[k4 + 2] = px[qb + 2]; G4[k4 + 3] = px[qc + 1];
			}
		}
		// the big lakes' level, carried two cells out round each so it holds to the shore
		const WL = backP.WL;
		WL.fill(0); bestD.fill(99);
		for (let k = 0; k < NW * NW; k++) {
			if (!(PK[k] > 0.02 && PK[k] >= 0.5 * (1 - PL[k]))) continue;
			const i = k % NW, j = (k - i) / NW;
			for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
				const ii = i + a, jj = j + b;
				if (ii < 0 || jj < 0 || ii >= NW || jj >= NW) continue;
				const q = jj * NW + ii, d = a * a + b * b;
				if (d < bestD[q]) { bestD[q] = d; WL[q] = PE[k]; }
			}
		}
		for (let k = 0; k < NW * NW; k++) A[k * 4 + 2] = WL[k];
		// the swap: the planes and the textures' data at once
		const oldP = {}, oldL = rgba.slice();
		for (const k of PLANES) { oldP[k] = P[k]; P[k] = backP[k]; }
		backL.forEach((a, i) => { rgba[i] = a; tex[i].image.data = a; tex[i].needsUpdate = true; });
		backP = oldP; backL = oldL;
		win.gi0 = gi0; win.gj0 = gj0; win.ready = true; win.version++;
		anchor();
		stats.composeMs = Math.round(work + performance.now() - t0);
	}
	// where the frame's anchor falls in the window (after the window or the frame moves)
	function anchor() {
		const lonW0 = -180 + win.gi0 / RES, latW1 = 90 - win.gj0 / RES;
		const dl = (((F.lon - lonW0) % 360) + 360) % 360;
		win.cx0 = dl * RES - 0.5; win.cy0 = (latW1 - F.lat) * RES - 0.5;
	}
	// keep the window round (lat, lon); resolves when it covers it
	function follow(lat, lon) {
		const gi = Math.floor((lon + 180) * RES), gj = Math.floor((90 - lat) * RES);
		const ci = win.gi0 + NW / 2, cj = win.gj0 + NW / 2;
		const di = ((gi - ci) % GW + GW + GW / 2) % GW - GW / 2;
		if (win.ready && Math.abs(di) < MOVE && Math.abs(gj - cj) < MOVE) return null;
		if (win.moving) return win.moving;
		win.moving = place(gi - NW / 2, gj - NW / 2).finally(() => { win.moving = null; });
		return win.moving;
	}
	// a cell's values by latitude and longitude, from the window (for the vegetation and colours)
	function cellAt(lat, lon) {
		const lonW0 = -180 + win.gi0 / RES, latW1 = 90 - win.gj0 / RES;
		const i = Math.max(0, Math.min(NW - 1, Math.floor(((((lon - lonW0) % 360) + 360) % 360) * RES))), j = Math.max(0, Math.min(NW - 1, Math.floor((latW1 - lat) * RES)));
		const k = j * NW + i, o = {};
		for (const p of PLANES) o[p] = P[p][k];
		return o;
	}
	const bytes = () => [...tiles.values()].reduce((a, v) => a + (v.px ? v.px.length : 0), 0) + NW * NW * (4 * PLANES.length + 16 + 16) * 2;
	return { win, tex, follow, anchor, cellAt, stats, bytes, tiles };
}
