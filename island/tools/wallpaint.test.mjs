// Paint that belongs to its wall (signage/wallpaint.js): the host each paint decal carries, its
// style and gloss in one flag, and the wall's history in the placement (painted over, half
// buffed, buffed with a ghost). node --test tools/wallpaint.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SURFACE, STYLE, paintExtra, packColour, unpackColour, cityWallType, host, lotHost, freewayHost, binHost, paintAge, FREEWAY_WALL } from '../src/signage/wallpaint.js';
import { graffitiFor, MAT } from '../src/signage/placement.js';
import { rng } from '../src/signage/rand.js';

test('wallpaint: a colour packs into one float and comes back', () => {
	for (const c of [[0, 0, 0], [1, 1, 1], [0.74, 0.7, 0.62], [0.13, 0.5, 0.99]]) {
		const v = packColour(c);
		assert.ok(v >= 1 && v < 2 ** 24 + 1 && Number.isInteger(v));
		// (a float holds it exactly: what the GPU reads is what went in)
		assert.equal(Math.fround(v), v);
		unpackColour(v).forEach((q, i) => assert.ok(Math.abs(q - c[i]) <= 0.5 / 255 + 1e-9));
	}
	assert.equal(packColour(null), 0);
	assert.equal(unpackColour(0), null);
	// (the freeway's linear concrete as sRGB bytes)
	assert.ok(unpackColour(packColour(FREEWAY_WALL, true))[0] > 0.75);
});

test('wallpaint: the host by what the wall is', () => {
	assert.equal(cityWallType(5), SURFACE.warehouse);
	assert.equal(cityWallType(1), SURFACE.wall);
	assert.equal(cityWallType(2), SURFACE.office);
	assert.equal(cityWallType(6), SURFACE.retail);
	assert.equal(cityWallType(9), SURFACE.small);
	assert.equal(cityWallType(4), SURFACE.unknown);
	const h = lotHost({ x: 0, z: 0, y: 3, h: 9, kind: 5, age: 0.75, col: [0.74, 0.7, 0.62] });
	assert.equal(h[0], 3); assert.equal(h[1], 9);
	assert.equal(Math.floor(h[2] + 1e-3), SURFACE.warehouse);
	assert.ok(Math.abs((h[2] % 1) - 0.75 * 0.99) < 1e-9);
	assert.equal(lotHost({ h: 9, kind: 5 }), null, 'no foot, no host');
	assert.equal(host(0, 4, SURFACE.unknown, 0.4), null);
	const f = freewayHost(0, 4.3, 120, -400);
	assert.equal(Math.floor(f[2] + 1e-3), SURFACE.freeway);
	assert.deepEqual(freewayHost(0, 4.3, 120, -400), f, 'the same stretch the same age');
	assert.equal(Math.floor(binHost(0, 1)[2] + 1e-3), SURFACE.bin);
	// (the age never reaches the next type)
	assert.equal(Math.floor(host(0, 1, SURFACE.freeway, 1)[2] + 1e-3), SURFACE.freeway);
});

test('wallpaint: style and gloss share the flag, read back whole', () => {
	for (const style of Object.values(STYLE)) for (const gloss of [false, true]) {
		const e = paintExtra(style, gloss);
		// (as the shader reads it, a hair off the whole number)
		for (const v of [e - 1e-4, e, e + 1e-4]) {
			assert.equal(Math.floor(Math.floor(v + 0.5) * 0.5), style);
			assert.equal(Math.floor(v + 0.5) % 2 === 1, gloss);
		}
	}
	// (a spray piece with no gloss is 0, as before)
	assert.equal(paintExtra(STYLE.spray, false), 0);
});

test('wallpaint: most paint is a season or two old, a few fresh, some years', () => {
	const r = rng(7), ages = Array.from({ length: 2000 }, () => paintAge(r));
	const fresh = ages.filter((a) => a < 0.12).length / ages.length, old = ages.filter((a) => a > 0.6).length / ages.length;
	assert.ok(fresh > 0.08 && fresh < 0.3, 'fresh ' + fresh);
	assert.ok(old > 0.15 && old < 0.45, 'old ' + old);
	assert.ok(ages.every((a) => a >= 0 && a <= 1));
	// (the crews come oftener where there is money: younger there)
	const r2 = rng(7), rich = Array.from({ length: 2000 }, () => paintAge(r2, { means: 1 }));
	assert.ok(rich.reduce((s, a) => s + a, 0) < ages.reduce((s, a) => s + a, 0));
});

test('wallpaint: the walls keep their history, and the paint knows its wall', () => {
	const paintHost = freewayHost(0, 4.3, 0, 0), walls = [];
	for (let i = 0; i < 120; i++) walls.push({ kind: 'soundwall', x: i * 12, z: 0, y: 0, nx: 0, nz: 1, w: 12, h: 4.3, lu: 1, paintHost });
	const all = graffitiFor(walls, { morality: { trouble: 0.9, means: 0.3 }, seed: 3, day: 70 });
	const paint = all.filter((d) => d.mat === MAT.paint);
	assert.ok(paint.every((d) => d.host === paintHost), 'every paint decal carries its wall');
	assert.ok(all.filter((d) => d.mat !== MAT.paint).every((d) => !d.host));
	// buffed with the ghost of what it covers; half buffed (no ghost: what it covers is still there)
	const buffs = paint.filter((d) => d.face.k === 'buff');
	assert.ok(buffs.some((d) => d.face.ghost >= 0 && /tag|throwup/.test(d.face.gk)));
	assert.ok(buffs.some((d) => d.face.ghost === undefined));
	// (a few ghosts at most, so the buffs share the sheet)
	assert.ok(new Set(buffs.map((d) => JSON.stringify(d.face))).size <= 16);
	// painted over: an old piece with a younger one drawn after it, overlapping
	let over = 0;
	for (let i = 1; i < paint.length; i++) {
		const a = paint[i - 1], b = paint[i];
		if (a.face.k === 'buff' || b.face.k === 'buff' || a.wear < 0.7 || b.wear > a.wear - 0.29) continue;
		if (Math.abs(a.x - b.x) < (a.w + b.w) / 2) over++;
	}
	assert.ok(over > 0, 'some paint went up over older paint');
	assert.ok(all.every((d) => d.hy + d.h / 2 <= 4.3 + 1e-6), 'never over the top of the wall');
});
