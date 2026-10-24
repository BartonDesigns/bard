// The hills' shade (world/hillsun.js): the sweep along the sun's bearing gives the same height
// the light comes down to as marching from each point toward the sun, the Earth's curve and all;
// a low sun leaves a valley behind a ridge in shade and the ridge's top lit; the light chunk is
// patched once, on the sun only.
//   node island/tools/hill-sun.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sweepHills, marchHills, marchAt, half, installHillSun, HILL_SUN, R_LIGHT } from '../src/world/hillsun.js';

const N = 64, CELL = 150;
// a ridge running north-south 2 km east of the grid's west edge, 600 m high, and a valley east of it
const ground = (x, z) => 50 + 550 * Math.exp(-(((x - 2000) / 700) ** 2)) + 30 * Math.sin(z / 900) + 200 * Math.exp(-(((x - 7500) / 900) ** 2));
function grid() {
	const H = new Float32Array(N * N);
	for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = ground((i + 0.5) * CELL, (j + 0.5) * CELL);
	return H;
}
// the light's height over a point, the slow way: every caster along the bearing, to the grid's
// sunward edge (a march that leaves by a side is not compared: there the sweep carries the edge
// row on, and the map fades the shade out toward its sides anyway)
function brute(x, z, dx, dz, tanE) {
	let s = -1e9;
	for (let t = CELL; t < 40000; t += 10) {
		const px = x + dx * t, pz = z + dz * t;
		if (pz < 0 || pz > N * CELL) return -2e9;
		if (px < 0 || px > N * CELL) break;
		s = Math.max(s, ground(px, pz) - t * tanE - t * t / (2 * R_LIGHT));
	}
	return s;
}
function run(dx, dz, tanE) {
	const H = grid(), S = new Float32Array(N * N), T = new Float32Array(N * N), eS = new Float32Array(N).fill(-1e9), eT = new Float32Array(N);
	sweepHills(H, N, CELL, dx, dz, tanE, eS, eT, S, T);
	return { H, S, T };
}

test('a low sun in the west-south-west: the sweep matches a march from each point', () => {
	const a = Math.atan2(0.31, -0.95), dx = Math.cos(a), dz = Math.sin(a), tanE = 0.04;
	const { H, S } = run(dx, dz, tanE);
	let worst = 0, lit = 0, n = 0;
	for (let j = 8; j < N - 8; j += 3) for (let i = 4; i < N; i += 3) {
		const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL, b = brute(x, z, dx, dz, tanE);
		if (b < -1e8) continue;
		const k = j * N + i;
		// (the sweep reads its upstream neighbours bilinearly, so it runs a little soft)
		worst = Math.max(worst, Math.abs(S[k] - b));
		n++; if (H[k] + 8 > S[k]) lit++;
	}
	assert.ok(worst < 12, `sweep strays ${worst.toFixed(1)} m from the march`);
	assert.ok(lit > n * 0.2 && lit < n * 0.95, `some lit, some shaded (${lit} of ${n})`);
});

test('behind the ridge the valley is in shade and the ridge top lit', () => {
	const { H, S } = run(-1, 0, 0.03);
	const at = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL), k = j * N + i; return H[k] + 8 - S[k]; };
	assert.ok(at(2000, 4800) > 0, 'the ridge top has the sun');
	assert.ok(at(4200, 4800) < -50, 'the valley floor east of it is deep in its shade');
	// (the next hill east, 200 m, catches the light again over the shade's slope: 3.5 km at 3%)
	assert.ok(at(7500, 4800) > at(5500, 4800), 'farther east the shade thins toward the next hill');
});

test('a sun at the horizon leaves only the heights lit; under it, the curve of the Earth', () => {
	const { H, S } = run(-1, 0, -0.004);
	const k = (x, z) => Math.floor(z / CELL) * N + Math.floor(x / CELL);
	assert.ok(H[k(2000, 4800)] + 8 > S[k(2000, 4800)], 'the ridge top still lit');
	assert.ok(H[k(3500, 4800)] + 8 < S[k(3500, 4800)], 'its foot is not');
	// a march over a flat sea: the light 1 degree below the horizon still reaches a summit 1200 m up
	const hs = new Float32Array(44);
	const [s] = marchHills(hs, Math.tan(-1 * Math.PI / 180));
	assert.ok(s < 1200 && s > 800, `the sea's horizon shades up to ${s.toFixed(0)} m`);
	assert.ok(marchAt(43) > 80000, 'the march reaches 80 km out');
});

test('the shade carried on between sweeps: S moves by its caster\'s distance', () => {
	const { S, T } = run(-1, 0, 0.03), { S: S2 } = run(-1, 0, 0.032);
	const k = 32 * N + 30;
	assert.ok(Math.abs((S[k] - T[k] * 0.002) - S2[k]) < 2, 'carried on to within 2 m');
});

test('half floats as the map is sent', () => {
	const f = new Float32Array([0, 1, -1, 123.5, 1175, -3000, 52000, 1e-6]), u = new Uint32Array(f.buffer);
	for (let i = 0; i < f.length; i++) {
		const back = THREE.DataUtils.fromHalfFloat(half(u[i]));
		assert.ok(Math.abs(back - f[i]) <= Math.max(1e-4, Math.abs(f[i]) * 1e-3), `${f[i]} -> ${back}`);
	}
});

test('the light chunk: the sun alone takes the hills\' shade, and every lit material has the uniforms', () => {
	assert.equal(installHillSun(), true);
	assert.equal(installHillSun(), true, 'a second install changes nothing');
	const chunk = THREE.ShaderChunk.lights_fragment_begin;
	assert.equal(chunk.split('hillSun( geometryPosition )').length - 1, 1, 'patched once, in the directional lights');
	assert.ok(chunk.indexOf('hillSun(') > chunk.indexOf('NUM_DIR_LIGHTS > 0'), 'after the directional lights begin');
	assert.ok(chunk.indexOf('hillSun(') < chunk.indexOf('NUM_RECT_AREA_LIGHTS'), 'not on the area lights');
	assert.ok(THREE.ShaderChunk.lights_pars_begin.includes('float hillSun('));
	for (const k of ['standard', 'physical', 'lambert', 'phong', 'toon']) assert.ok(THREE.ShaderLib[k].uniforms.hillSunRect?.value === HILL_SUN.rect, k);
	// (shared by reference: a material's copy of its uniforms keeps the same object)
	const u = THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms);
	assert.equal(u.hillSunRect.value, HILL_SUN.rect);
	assert.equal(u.hillSunMap.value.source, HILL_SUN.map.source, 'the copied map shares its pixels');
});
