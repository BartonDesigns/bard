// The far rings of ground (the Bay's, the globe's middle and far ones): every cell about the
// same size on screen, so the hills a few kilometres off are not drawn in big facets, and each
// ring's fine cells start inside the hole the ring within it leaves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { radialGrid, ringGrid, withSpacing } from '../src/world/terrain.js';

const axis = (g) => { const p = g.attributes.position.array, n = Math.round(Math.sqrt(p.length / 3)); return [...Array(n)].map((_, i) => p[i * 3]); };
// the angle a cell spans seen from the middle, out from r0 (radians)
const angles = (xs, r0) => { const out = []; for (let i = 1; i < xs.length; i++) if (xs[i - 1] >= r0) out.push((xs[i] - xs[i - 1]) / xs[i - 1]); return out; };

test('a ring grid keeps its cells the same size on screen from its inner edge out', () => {
	for (const [seg, inner, R, s0] of [[320, 3500, 95000, 10], [256, 3500, 95000, 10], [224, 4200, 40000, 8], [192, 36000, 250000, 8], [160, 5000, 250000, 8]]) {
		const xs = axis(ringGrid(seg, inner, R, s0));
		assert.equal(xs.length, seg + 1);
		assert.ok(Math.abs(xs[0] + R) < 1e-3 * R && Math.abs(xs[seg] - R) < 1e-3 * R, 'reaches the radius');
		for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], 'strictly increasing');
		const a = angles(xs, inner * 0.999);
		const lo = Math.min(...a), hi = Math.max(...a);
		assert.ok(hi / lo < 1.01, `even on screen (${lo.toFixed(4)}..${hi.toFixed(4)})`);
		// the fine cells start at inner (within the ring inside's hole)
		assert.ok(xs.some((x) => Math.abs(x - inner) < 1e-3 * inner));
	}
});

test('the Bay far ring is finer on screen than the power-law ring it replaces, 4 to 40 km out', () => {
	const old = axis(radialGrid(256, 95000, 2.6)), now = axis(ringGrid(320, 3500, 95000, 10)), phone = axis(ringGrid(256, 3500, 95000, 10));
	const cellAt = (xs, d) => { for (let i = 1; i < xs.length; i++) if (xs[i] >= d && xs[i - 1] < d) return xs[i] - xs[i - 1]; return Infinity; };
	for (const d of [4000, 6000, 10000, 20000, 40000]) {
		assert.ok(cellAt(now, d) < cellAt(old, d) * (d <= 20000 ? 0.75 : 0.9), `desktop at ${d} m: ${cellAt(now, d).toFixed(0)} vs ${cellAt(old, d).toFixed(0)}`);
		assert.ok(cellAt(phone, d) < cellAt(old, d) * (d <= 20000 ? 0.8 : 1.01), `phone at ${d} m`);   // (the same past 40 km)
	}
	// and never more than about 1.4 degrees a cell on a desktop
	for (const a of angles(now, 3500)) assert.ok(a < 0.025);
});

test('the grid spacing attribute is the wider cell either side, on either axis', () => {
	const g = withSpacing(radialGrid(8, 100, 2));
	const xs = axis(g), n = xs.length, sp = g.attributes.aGsp.array;
	assert.equal(sp.length, n * n);
	const cell = (i) => Math.max(i > 0 ? xs[i] - xs[i - 1] : 0, i < n - 1 ? xs[i + 1] - xs[i] : 0);
	for (const [i, j] of [[0, 0], [4, 4], [2, 7], [8, 3]]) assert.ok(Math.abs(sp[j * n + i] - Math.max(cell(i), cell(j))) < 1e-4);
	assert.ok(ringGrid(64, 1000, 10000, 4).attributes.aGsp, 'ring grids carry it');
});
