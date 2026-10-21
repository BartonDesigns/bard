// The shore's sums (src/world/shore.js): the swash's timing (a quick rush, a stall, a drain
// that gathers pace), its reach and its broken front, the sheet it makes over the sand, how the
// water's cover thins to nothing at the edge, where waves break, and the shore's quality by
// tier. The GLSL the sea and the wet sand share carries the same sums. A planet's lakes and
// streams are mapped for the ground's wet banks and to keep the grass out of the water.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SWASH_GLSL, WATERMAP_GLSL, h21, vn, swashUp, swashTrain, swashState, swashStateK, swashBay, swashBayOn, swashLevel, swashRunMax, swashSheet, waterBody, edgeAlpha, breakOn, shoreQuality, waterMapTexture } from '../src/world/shore.js';
import { generateIsland } from '../src/world/islandgen.js';
import { planetProfile } from '../src/planet/profile.js';
import { planWaters } from '../src/planet/waters.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('the hash and value noise stay in 0..1', () => {
	for (let i = 0; i < 500; i++) {
		const x = (i * 37.13) % 5000 - 2500, z = (i * 91.7) % 7000 - 3500;
		const h = h21(x, z), v = vn(x * 0.3, z * 0.3);
		assert.ok(h >= 0 && h < 1, 'h21 ' + h);
		assert.ok(v >= 0 && v <= 1, 'vn ' + v);
	}
});

test('a wave rushes up quickly, stalls, then drains, gathering pace', () => {
	assert.ok(near(swashUp(0), 0));
	assert.ok(near(swashUp(0.2 - 1e-9), 1, 1e-6));
	// the rush: rising all the way, and decelerating (each step smaller than the last)
	let prev = -1, prevStep = Infinity;
	for (let s = 0; s <= 0.2; s += 0.01) {
		const u = swashUp(s);
		assert.ok(u >= prev, 'rising at ' + s);
		const st = u - prev;
		if (prev >= 0) assert.ok(st <= prevStep + 1e-9, 'slowing as it climbs at ' + s.toFixed(2));
		prevStep = prev >= 0 ? st : Infinity; prev = u;
	}
	// the stall: it barely moves
	for (let s = 0.2; s <= 0.3; s += 0.01) assert.ok(swashUp(s) >= 0.969 && swashUp(s) <= 1, 'stalled at ' + s);
	// the drain: falling all the way, quicker toward the end
	prev = 2;
	for (let s = 0.3; s <= 1; s += 0.01) { const u = swashUp(s); assert.ok(u <= prev + 1e-12, 'draining at ' + s); prev = u; }
	assert.ok(swashUp(0.999) < 0.01);
	const early = swashUp(0.3) - swashUp(0.4), late = swashUp(0.89) - swashUp(0.99);
	assert.ok(late > early * 2, `the drain gathers pace (${early.toFixed(3)} then ${late.toFixed(3)})`);
	// the rush is over in a fifth of the wave, the drain takes most of it
	const t90up = [...Array(1000).keys()].map((i) => i / 1000).find((s) => swashUp(s) >= 0.9);
	const t90dn = [...Array(1000).keys()].map((i) => i / 1000).find((s) => s > 0.3 && swashUp(s) <= 0.1);
	assert.ok(t90up < 0.15 && t90dn - 0.3 > 0.5, `rush ${t90up}, drain ${t90dn}`);
});

test('the swash reaches no higher than its top, runs below the waterline between waves, and never jumps', () => {
	for (let i = 0; i < 40; i++) {
		const x = 800 + i * 3.7, z = -40 + i * 2.1, rm = swashRunMax(x, z, 1);
		let prev = null;
		for (let t = 100; t < 130; t += 0.01) {
			const S = swashState(x, z, t, 1);
			assert.ok(S.level <= S.top + 1e-9, 'level under its top');
			assert.ok(S.level >= -0.3 - 1e-9, 'level above the backwash foot');
			assert.ok(S.top < rm + 0.06 && S.top > -0.05, 'top within the run');
			// (a step of 10 ms moves the front a few millimetres of height, never a jump)
			if (prev != null) assert.ok(Math.abs(S.level - prev) < 0.03, `no jump at t=${t.toFixed(2)} (${prev} to ${S.level})`);
			prev = S.level;
			assert.ok(S.since < 0 ? S.phase < 0.2 : S.phase >= 0.2, 'since the stall matches the phase');
		}
	}
});

test('the front is broken along the shore, not a line, and differs from wave to wave', () => {
	const t = 412.3, tops = [];
	for (let k = 0; k < 60; k++) tops.push(swashTrain(800, k * 0.25, t, 8.3, 1.7, 0.6).top);
	const span = Math.max(...tops) - Math.min(...tops);
	assert.ok(span > 0.01, 'the reach wanders along 15 m of beach: ' + span.toFixed(3));
	const a = swashTrain(800, 0, 10, 8.3, 1.7, 0.6).top, b = swashTrain(800, 0, 10 + 8.3, 8.3, 1.7, 0.6).top;
	assert.notEqual(a, b, 'the next wave runs to a different place');
});

test('the sheet over the sand thins to nothing at the swash front', () => {
	const y = 0.05;
	assert.equal(swashSheet(y, -0.1, 0.2), -0.1, 'below the ground: no water');
	// film (sheet - ground) grows smoothly from zero as the reach passes the ground
	let prev = 0;
	for (let s = 0.2; s < 0.6; s += 0.01) {
		const film = swashSheet(y, s, 0.2) - 0.2;
		assert.ok(film >= -1e-12 && film >= prev - 1e-12, 'growing');
		prev = film;
	}
	assert.ok(near(swashSheet(y, 0.2 + 1e-6, 0.2) - 0.2, 0, 1e-5), 'zero at the front');
	assert.ok(near(swashSheet(y, 0.5, 0.2) - 0.2, 0.105, 1e-9), 'a third of the climb');
	// under the open sea's own level, the open sea holds
	assert.equal(swashSheet(0.3, 0.2, -0.4), 0.2);
});

test('the water covers nothing at the edge and closes over with depth, sooner when murky', () => {
	assert.equal(waterBody(0), 0);
	assert.equal(edgeAlpha(0, 1), 0, 'no cover at the line, whatever the sheen');
	assert.equal(edgeAlpha(-0.1, 1), 0);
	let prev = 0;
	for (let d = 0.001; d < 4; d += 0.01) { const a = waterBody(d); assert.ok(a > prev); prev = a; }
	assert.ok(waterBody(0.1) < 0.06, 'a hand of water is clear');
	assert.ok(waterBody(3) > 0.5 && waterBody(3) < 0.85, 'three metres of clear water still shows its bed');
	assert.ok(waterBody(12) > 0.97, 'twelve metres is the sea');
	assert.ok(waterBody(0.5, 0.34, 1) > waterBody(0.5, 0.34, 0), 'murky water closes over sooner');
	assert.ok(waterBody(1, 0.55) > waterBody(1, 0.34), 'the cold green Pacific takes its red sooner');
	// continuous from the line: small steps make small changes
	for (let f = 0; f < 0.1; f += 0.0005) assert.ok(Math.abs(edgeAlpha(f + 0.0005, 0.6) - edgeAlpha(f, 0.6)) < 0.03, 'no step at ' + f.toFixed(4));
	assert.ok(edgeAlpha(0.05, 0.5) >= 0.5, 'the sheen is all there by a few centimetres');
});

test('waves break on gentle open beaches only', () => {
	assert.ok(breakOn(0.03) > 0.95, 'a 3 % beach breaks');
	assert.equal(breakOn(0.001), 0, 'a dead flat shelf does not (it is all shallows)');
	assert.equal(breakOn(0.3), 0, 'a steep shore surges instead');
	assert.equal(breakOn(0.03, 1), 0, 'a sheltered bay is calm');
	assert.ok(breakOn(0.03, 0.5) < breakOn(0.03, 0));
});

test('the shore asks less of a phone and of the lower tiers, and makes nothing new each frame', () => {
	const out = {};
	const hi = { ...shoreQuality({ name: 'high' }, false) }, ph = { ...shoreQuality({ name: 'high' }, true) }, mn = { ...shoreQuality({ name: 'minimal' }, true) };
	assert.ok(ph.reach < hi.reach / 2, 'a phone reads the ground per pixel over a shorter reach');
	assert.ok(mn.reach < ph.reach && mn.detail === 0);
	assert.equal(shoreQuality({ name: 'medium' }, false, out), out, 'fills the object it is given');
	assert.ok(out.detail < 1 && out.detail > 0);
});

test('the sea and the wet sand share the one swash', () => {
	for (const fn of ['swashRunMax', 'swashUp', 'swashTrainS', 'swashState', 'swashLevel', 'swashSheet', 'waterBody', 'breakOn']) assert.ok(SWASH_GLSL.includes(fn + '('), fn);
	for (const k of ['8.3', '11.9', '0.35', '7.853982', '0.97', '0.014', '0.031']) assert.ok(SWASH_GLSL.includes(k), k);
	const terrain = fs.readFileSync(new URL('../src/world/terrain.js', import.meta.url), 'utf8');
	const ocean = fs.readFileSync(new URL('../src/world/ocean.js', import.meta.url), 'utf8');
	assert.ok(/import \{ SWASH_GLSL[^}]*\} from '\.\/shore\.js'/.test(terrain) && terrain.includes('swashState(vW.xz, uTime, uWave)'), 'the ground reads the shore');
	assert.ok(/SWASH_GLSL[^\n]*from '\.\/shore\.js'/.test(ocean) && ocean.includes('swashStateK(vW.xz, uTime, uWave, vSwK)'), 'the sea reads the same, per pixel');
	const bay = fs.readFileSync(new URL('../src/bay/terrain.js', import.meta.url), 'utf8');
	assert.ok(/import \{ SWASH_GLSL \} from '\.\.\/world\/shore\.js'/.test(bay) && bay.includes('swashStateK(vBW, uTime, uWave, swK)') && bay.includes('swashBayOn(sl, '), 'the Bay\'s sand reads it too, by the same slope');
	assert.ok(ocean.includes('swashBayOn(sl, ') && ocean.includes('swashBay(p)'), 'and the sea runs it up the Bay\'s beaches');
	assert.ok(!/float swashLevel\(/.test(terrain), 'no second copy left in the ground');
	assert.equal(swashLevel(810, 3, 50), swashState(810, 3, 50).level);
});

test('the island keeps its own beaches: the survey only eases in where its floor is already deep', () => {
	const ocean = fs.readFileSync(new URL('../src/world/ocean.js', import.meta.url), 'utf8');
	// (the band that blended in the Bay Area survey began 100 m inside the island's centre and
	// drew every beach 5 to 8 m deep)
	assert.ok(/k \*= max\(smoothstep\(-3\.0, -9\.0, hi\), smoothstep\(uHalf - 120\.0, uHalf - 20\.0, edge\)\)/.test(ocean), 'the blend is held off the island\'s shallows');
	// every pixel near you reads the ground under it, and the water fades to nothing at the edge
	assert.ok(ocean.includes('g = mix(vGround, groundAt(vW.xz), pk)'), 'the ground per pixel');
	assert.ok(ocean.includes('waterBody(de * 2.0, sig.r, murk)'), 'the cover by the light\'s path');
	assert.ok(/float Fe = F \* [0-9.]+ \* smoothstep\(0\.0, 0\.02, film\)/.test(ocean), 'the sheen grows in over the first centimetres');
	assert.ok(!/vFilm|vDepth/.test(ocean), 'no depth or film interpolated from the vertices');
});

test('a planet\'s lakes and streams are mapped: the water, then banks that fade a few metres out', async () => {
	const seed = 77, profile = planetProfile('TERRAN', seed);
	const island = generateIsland({ seed, profile, resolution: 512 });
	const water = await planWaters(island, profile, {});
	assert.ok(water && water.lakes.length + water.lines.length > 0, 'a green world has water');
	const N = island.N, M = island.waterMap;
	assert.equal(M.length, N * N * 2);
	let wet = 0, bank = 0, mismatch = 0;
	for (let q = 0; q < N * N; q++) {
		if (M[q * 2] === 255) { wet++; if (M[q * 2 + 1] !== 255) mismatch++; }
		else if (M[q * 2 + 1] > 0) { bank++; assert.ok(M[q * 2 + 1] <= 141, 'a bank is never as wet as the water'); }
	}
	assert.ok(wet > 0 && bank > wet * 0.2, `water ${wet} cells, banks ${bank}`);
	assert.equal(mismatch, 0);
	// (the map agrees with the water the game walks in)
	const half = island.half, cell = island.cell;
	for (let q = 0; q < N * N; q += 97) { const x = -half + (q % N) * cell, z = -half + Math.floor(q / N) * cell; assert.equal(M[q * 2] === 255, !!water.inWater(x, z)); }
	const tex = waterMapTexture(island);
	assert.equal(tex.image.width, N);
	assert.equal(waterMapTexture({}).image.width, 1, 'a blank map where there is none (Earth)');
	assert.ok(WATERMAP_GLSL.includes('waterMapAt('));
	const grass = fs.readFileSync(new URL('../src/world/grass.js', import.meta.url), 'utf8');
	assert.ok(grass.includes('uWaterMap'), 'the grass keeps out of the water');
});

test('the Bay Area\'s beaches: the swash runs up sand, laps short and quick inside the Golden Gate', () => {
	// the island's swash is the open coast's, unchanged
	for (let t = 0; t < 30; t += 0.7) assert.deepEqual(swashStateK(812, -40, t, 1, 1, 1), swashState(812, -40, t, 1));
	const [ko, po] = swashBay(-2000), [ki, pi] = swashBay(13000);
	assert.equal(ko, 1); assert.equal(po, 1);
	assert.ok(ki < 0.5 && pi < 0.5, 'sheltered: a lower reach, a shorter period');
	// inside, the chop runs a little way up and drains only a little way below the line
	let top = -9, low = 9;
	for (let t = 0; t < 60; t += 0.05) { const S = swashStateK(13000, -5200, t, 1, ki, pi); top = Math.max(top, S.level); low = Math.min(low, S.level); }
	assert.ok(top > 0.08 && top < 0.35, 'reach ' + top);
	assert.ok(low >= -0.3 * ki - 1e-9, 'backwash ' + low);
	// sand beaches only: not the flat mud, not a seawall, and only near you
	assert.equal(swashBayOn(0.005, 10), 0);
	assert.equal(swashBayOn(0.08, 10), 1);
	assert.equal(swashBayOn(0.3, 10), 0);
	assert.equal(swashBayOn(0.08, 150), 0);
});
