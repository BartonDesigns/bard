// The generated land's streams and lakes (crysis/hydro.js, crysis/rivers.js): a low sill is cut
// through rather than flooded, a deep closed basin keeps only a pond at its bottom, and on the
// real ground near Gort (where a 12 km lake once lay 85 m up over a village) no lake stands
// over the land or hangs off its shore, and no creek runs above the ground.
//   node island/tools/generated-water.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { hydrology } from '../src/crysis/hydro.js';
import { proceduralWater } from '../src/crysis/rivers.js';
import { createGlobeHeight } from '../src/earth/globeheight.js';
import { setFrame } from '../src/earth/globeframe.js';
import { globeRoot } from './globe-assets-manifest.mjs';

const RIVERS = { sea: 0, minCells: 20, lakeCells: 5, lakeDepth: 1.5, inset: 0.35 };
const BREACH = { breach: 4, breachLen: 48, basin: { deep: 8, cells: 300, share: 0.04, pond: 120, pondDeep: 6 } };
const run = (G, o) => { const it = hydrology(G, o); let r; while (!(r = it.next()).done); return r.value; };
const grid = (N, fn) => { const h = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = fn(i, j); return { W: N, H: N, x0: 0, z0: 0, cell: 64, h }; };

test('a low sill across a valley is cut through: the creek runs on, no lake behind it', () => {
	// (a valley falling to the west edge, 3 m of ground across it half way down)
	const G = grid(64, (i, j) => 40 + i * 0.5 + Math.abs(j - 32) * 2 + (i >= 30 && i <= 31 ? 3 : 0));
	assert.ok(run(G, RIVERS).lakes.length >= 1, 'filled, it holds a lake');
	const R = run(G, { ...RIVERS, ...BREACH });
	assert.equal(R.lakes.length, 0, 'cut through, it holds none');
	const S = R.streams.find((s) => s.pts.some((p) => p[0] === 30 * 64));
	assert.ok(S, 'a stream crosses the sill');
	const p = S.pts.find((q) => q[0] === 30 * 64);
	assert.ok(p[2] < G.h[Math.round(p[1] / 64) * 64 + 30], 'its water runs under the sill\'s ground (the channel dug down)');
	assert.ok(G.h[Math.round(p[1] / 64) * 64 + 30] - p[2] < 4.5, 'no deeper than a breach may cut');
});

test('a deep closed basin keeps only a pond at its bottom, its slopes draining into it', () => {
	// (a bowl 50 m deep to its lowest rim, 4 km across)
	const G = grid(64, (i, j) => 10 + 0.05 * ((i - 32) ** 2 + (j - 32) ** 2));
	const full = run(G, RIVERS);
	assert.equal(full.lakes.length, 1);
	assert.ok(full.lakes[0].cells.length > 2000, 'filled, the whole bowl is a lake');
	const R = run(G, { ...RIVERS, ...BREACH });
	assert.equal(R.lakes.length, 1, 'one pond');
	const P = R.lakes[0];
	assert.ok(P.cells.length <= 130, `a pond, not a lake (${P.cells.length} cells)`);
	assert.ok(P.level <= 10 + 6.01, `at the bottom (${P.level.toFixed(1)} m)`);
	assert.ok(R.streams.length > 0 && R.streams.every((s) => s.end === 'lake' || s.end === 'join'), 'the creeks run down into it');
	for (const s of R.streams) for (const p of s.pts) assert.ok(p[2] <= G.h[Math.round(p[1] / 64) * 64 + Math.round(p[0] / 64)] + 0.01 || p[4] >= 0, 'every creek on the ground');
});

// the real ground round (lat, lon), as globedata.js puts its window together
const PLANES = ['E', 'L', 'WL', 'A', 'RG', 'TR', 'BNR', 'RV', 'DUNE', 'KARST', 'K', 'TREES', 'TEMP', 'RAIN'];
function windowAt(lat, lon) {
	const NW = 256, TN = 300, PS = TN * TN * 4, gi0 = Math.floor((lon + 180) * 10) - NW / 2, gj0 = Math.floor((90 - lat) * 10) - NW / 2, tiles = new Map();
	const P = {}; for (const k of PLANES) P[k] = new Float32Array(NW * NW);
	for (let j = 0; j < NW; j++) for (let i = 0; i < NW; i++) {
		const gi = (((gi0 + i) % 3600) + 3600) % 3600, gj = gj0 + j, ti = Math.floor(gi / TN), tj = Math.floor(gj / TN), name = `g${tj}-${ti}.png`;
		if (!tiles.has(name)) tiles.set(name, PNG.sync.read(fs.readFileSync(new URL(name, globeRoot))).data);
		const px = tiles.get(name), q = ((gj - tj * TN) * TN + gi - ti * TN) * 4, q1 = q + PS, q2 = q1 + PS, q3 = q2 + PS, qc = q3 + PS * 3, k = j * NW + i;
		P.E[k] = (px[q] * 256 + px[q + 1]) / 2 - 11000; P.L[k] = px[q + 2] / 255; P.A[k] = (px[q1] / 8) ** 2; P.RG[k] = px[q1 + 1] / 255; P.TR[k] = px[q1 + 2] / 255;
		P.BNR[k] = px[q2] / 255; P.RV[k] = px[q2 + 1] / 255; P.DUNE[k] = px[q2 + 2] / 255; P.KARST[k] = px[q3] / 255; P.K[k] = px[q3 + 1] / 255; P.TREES[k] = px[q3 + 2] / 255;
		P.TEMP[k] = px[qc] / 4 - 30; P.RAIN[k] = (px[qc + 1] / 4) ** 2;
	}
	// (the big lakes' level, carried two cells out round each)
	const best = new Uint8Array(NW * NW).fill(99);
	for (let k = 0; k < NW * NW; k++) {
		if (!(P.K[k] > 0.02 && P.K[k] >= 0.5 * (1 - P.L[k]))) continue;
		const i = k % NW, j = (k - i) / NW;
		for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= NW || jj >= NW) continue; const q = jj * NW + ii, d = a * a + b * b; if (d < best[q]) { best[q] = d; P.WL[q] = P.E[k]; } }
	}
	return { N: NW, P, gi0, gj0 };
}

test('near Gort: the village is dry, every lake small and held by the ground, every creek on it', () => {
	// (the frame as earth/globe.js lays it down on landing there; the village vil:1060:-108)
	setFrame(53.05, -9.0);
	const Hg = createGlobeHeight(windowAt(53.05, -9.0)), heightAt = (x, z) => Hg.at(x, z);
	const W = proceduralWater({ heightAt, inSurvey: () => false });
	const vx = -398066, vz = 863;
	W.pump(vx, vz, 3000, 1e9);
	assert.ok(W.readyAt(vx, vz, 3000));
	assert.equal(W.inLake(vx, vz), false, 'no lake over the village');
	assert.ok(W.near(vx, vz) > 40, 'nor water at its door');
	assert.ok(W.lakes.length > 0, 'still a few ponds and lakes about');
	for (const L of W.lakes) {
		const span = Math.max(L.bx1 - L.bx0, L.bz1 - L.bz0);
		assert.ok(span < 1600, `${L.name || 'a pond'} at ${L.level.toFixed(1)} m: ${Math.round(span)} m across`);
		// (its shore on the ground: the water meets the land there, it never hangs off it)
		let low = 0, all = 0;
		for (const r of L.rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { all++; if (L.level - heightAt((r[i] + r[j]) / 2, (r[i + 1] + r[j + 1]) / 2) > 1.5) low++; }
		assert.ok(low <= all * 0.08, `${L.name || 'a pond'}: ${low} of ${all} of its shore over lower ground`);
	}
	for (let i = Math.floor((vx - 3000) / 2048); i <= Math.floor((vx + 3000) / 2048); i++) for (let j = Math.floor((vz - 3000) / 2048); j <= Math.floor((vz + 3000) / 2048); j++) {
		const it = W.tile(i, j); let r; while (!(r = it.next()).done);
		for (const line of r.value) for (const p of line.P) if (!W.inLake(p[0], p[1])) assert.ok(p[2] <= heightAt(p[0], p[1]) - 0.3, `${line.name} at ${p[2].toFixed(1)} m over ground at ${heightAt(p[0], p[1]).toFixed(1)}`);
	}
});
