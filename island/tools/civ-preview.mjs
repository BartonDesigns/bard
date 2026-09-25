// Grow a town with the Crysis civilization engine (src/crysis/civgen.js) on made-up hills,
// time it, compare its street network with the learned statistics, and draw its map.
//   node tools/civ-preview.mjs [radius] [seed] [style suburb|older] [out.png]
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { generateTown } from '../src/crysis/civgen.js';
import STATS from '../src/crysis/civstats.json' with { type: 'json' };

const radius = +(process.argv[2] || 1800), seed = +(process.argv[3] || 7), style = process.argv[4] || 'suburb';
const out = process.argv[5] || 'civ-preview.png';
// rolling hills, a ridge and a lake: enough to make the streets bend
const h01 = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y); let u = x - i, v = y - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); return (h01(i, j) * (1 - u) + h01(i + 1, j) * u) * (1 - v) + (h01(i, j + 1) * (1 - u) + h01(i + 1, j + 1) * u) * v; };
const heightAt = (x, z) => 40 + vn(x / 1800, z / 1800) * 90 + vn(x / 600 + 5, z / 600) * 25 + Math.max(0, x - radius * 0.6) * 0.25 - Math.max(0, 1 - Math.hypot(x + radius * 0.5, z - radius * 0.4) / 350) * 90;

const t0 = performance.now();
const R = generateTown({ seed, cx: 0, cz: 0, radius, heightAt, style, name: 'Preview', ang: 0.3 });
const ms = performance.now() - t0;
console.log(`${style} r=${radius}: ${ms.toFixed(0)} ms; roads ${R.roads.length}, boxes ${R.boxes.length}, paths ${R.paths.length}, pools ${R.pools.length}, trees ${R.trees.length}`, R.info);

// the network against what was learned
const key = (x, z) => Math.round(x * 2) + ',' + Math.round(z * 2);
const deg = new Map();
const streets = R.roads.filter((q) => q.cls !== 'footway' && q.cls !== 'service');   // as learned: service drives left out
for (const q of streets) for (const k of [key(q.pts[0], q.pts[1]), key(q.pts[q.pts.length - 2], q.pts[q.pts.length - 1])]) deg.set(k, (deg.get(k) || 0) + 1);
const dh = {}; for (const v of deg.values()) dh[Math.min(v, 5)] = (dh[Math.min(v, 5)] || 0) + 1;
const tot = Object.entries(dh).filter(([k]) => k !== '2').reduce((a, [, v]) => a + v, 0);
const len = (p) => { let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return L; };
const res = streets.filter((q) => q.cls === 'residential'), L = res.map((q) => len(q.pts)).sort((a, b) => a - b);
const pc = (a, q) => a[Math.floor(q * (a.length - 1))];
const cul = res.filter((q) => q.end0 || q.end1);
const km = L.reduce((a, b) => a + b, 0) / 1000;
console.log('segLen p10..p90', [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => pc(L, q).toFixed(0)).join(' '), ' learned', STATS.street.segLen.join(' '));
console.log('junction degree', Object.fromEntries(Object.entries(dh).filter(([k]) => k !== '2').map(([k, v]) => [k, (v / tot).toFixed(3)])), ' learned', STATS.street.junctionDeg);
console.log('cul-de-sacs per km', (cul.length / km).toFixed(2), 'share', (cul.length / res.length).toFixed(3), ' learned', STATS.street.culPerKm, STATS.street.culShare);
const houses = R.boxes.filter((b) => b.kind <= 2).length, lu1 = R.map.px.reduce((a, v, i) => a + (i % 4 === 1 && v === 16 ? 1 : 0), 0) * R.map.step * R.map.step / 1e4;
console.log('houses', houses, 'per ha of residential', (houses / lu1).toFixed(2), ' learned', STATS.housesPerHa, '; pools/house', (R.pools.length / houses).toFixed(2), 'trees/ha', (R.trees.length / lu1).toFixed(1));

// the map, one pixel per cell, with the buildings drawn over it at 2 px a cell
const M = R.map, S = 2, png = new PNG({ width: M.w * S, height: M.h * S });
const LUC = [[150, 140, 100], [110, 150, 80], [70, 150, 60], [60, 160, 60], [90, 180, 70], [200, 160, 110], [180, 170, 140], [120, 120, 125], [150, 150, 150]];
for (let j = 0; j < M.h * S; j++) for (let i = 0; i < M.w * S; i++) {
	const k = (Math.floor(j / S) * M.w + Math.floor(i / S)) * 4, o = (j * M.w * S + i) * 4;
	const x = M.x0 + (i / S + 0.5) * M.step, z = M.z0 + (j / S + 0.5) * M.step, h = heightAt(x, z);
	let c = h < 1.5 ? [60, 90, 140] : LUC[Math.round(M.px[k + 1] / 16)] || [150, 140, 100];
	if (M.px[k + 1] === 0) { const s = Math.min(1, Math.max(0, h / 250)); c = [c[0] * (0.8 + s * 0.3), c[1] * (0.8 + s * 0.3), c[2]]; }
	if (M.px[k + 2]) c = [200, 110, 90];
	if (M.px[k]) c = [40, 40, 45];
	png.data.set([c[0], c[1], c[2], 255], o);
}
fs.writeFileSync(out, PNG.sync.write(png));
console.log('wrote', out);
