// The pack ice (region/ice.js): the floes stand on a lattice of the latitude and longitude alone,
// and the sea's surface (ICE_GLSL, in float on the GPU) finds the same floes, so the pack runs to
// the horizon with no ring round you.
//   node island/tools/sea-ice.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { iceCover, floeRowDn, floeBand, floeBandM, floeWrapJ, FLOE_ROWS, ICE_GLSL } from '../src/region/ice.js';

const f = Math.fround, DL = 1 / FLOE_ROWS;
const hash = (a, b, k) => { let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(k, 83492791)) >>> 0; return () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

test('every band\'s column count rounds the same with a float cosine', () => {
	for (let b = -90; b < 90; b++) {
		const v = 16 / Math.max(0.05, Math.cos((b + 0.5) * Math.PI / 180)), d = Math.abs(v - Math.floor(v) - 0.5);
		assert.ok(d > 0.005, `band ${b}: ${v} sits too near a half`);
	}
	assert.equal(floeBand(-1), -1); assert.equal(floeBand(-FLOE_ROWS), -1); assert.equal(floeBand(-FLOE_ROWS - 1), -2); assert.equal(floeBand(FLOE_ROWS - 1), 0);
	assert.match(ICE_GLSL, /i \/ 2775/);
});

test('the floes the sea draws are the floes laid round you, wherever the frame is', () => {
	const month = 9.6;
	for (const [lat0, lon0, fx] of [[-66.4, 140.5, -400000], [-77.6, 179.99, 0], [81.5, 10.2, 120000]]) {
		const kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110996, lonF = lon0 - fx / kx;
		const toXZ = (lat, lon) => ({ x: fx + (((lon - lon0 + 540) % 360) - 180) * kx, z: -(lat - lat0) * kz });
		// (the uniforms the sea gets: the frame's latitude and longitude at the engine's origin)
		const U = { x: f(lat0), y: f(((lonF + 540) % 360) - 180), z: f(kz), w: f(kx) };
		// the floes laid round the point, as ice.js lays them
		const floes = [], i0 = Math.floor(lat0 / DL);
		for (let a = -8; a <= 8; a++) {
			const i = i0 + a, dn = floeRowDn(i), m = floeBandM(floeBand(i)), j0 = Math.floor(lon0 / dn);
			for (let b = -8; b <= 8; b++) {
				const j = floeWrapJ(j0 + b, m), cc = iceCover((i + 0.5) * DL, (j + 0.5) * dn, month), r = hash(i, j, 7);
				if (r() > cc * 1.05) continue;
				floes.push(toXZ((i + r()) * DL, (j + r()) * dn));
			}
		}
		assert.ok(floes.length > 50, 'the pack is laid here this month');
		// and the sea's lookup (in float, as the GPU does it): the floe whose centre is nearest
		let worst = 0;
		for (const p of floes) {
			const lat = f(U.x - f(f(p.z) / U.z)), lon = f(((f(U.y + f(f(p.x) / U.w)) + 180) % 360 + 360) % 360 - 180);
			const ii = Math.floor(lat * FLOE_ROWS);
			let best = Infinity;
			for (let a = -1; a <= 1; a++) {
				const i = ii + a, band = i >= 0 ? Math.trunc(i / FLOE_ROWS) : -Math.trunc((-i - 1) / FLOE_ROWS) - 1;
				const m = Math.floor(f(16 / Math.max(0.05, Math.cos((band + 0.5) * Math.PI / 180))) + 0.5), dn = f(f(DL * m) / 16), jj = Math.floor(lon / dn);
				for (let b = -1; b <= 1; b++) {
					const j = floeWrapJ(jj + b, m), cc = iceCover(f((i + 0.5) * DL), (j + 0.5) * dn, month), r = hash(i, j, 7);
					if (r() > cc * 1.05) continue;
					const fl = f(f(i + r()) * DL), fn = f(f(j + r()) * dn);
					best = Math.min(best, Math.hypot((((lon - fn + 180) % 360 + 360) % 360 - 180) * U.w, (lat - fl) * U.z));
				}
			}
			worst = Math.max(worst, best);
		}
		assert.ok(worst < 2.5, `${lat0}, ${lon0}: a floe the sea puts ${worst.toFixed(2)} m off`);
	}
});
