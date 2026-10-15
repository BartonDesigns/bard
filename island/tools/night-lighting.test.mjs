// The evening's lights (src/bay/nightplan.js, nightlights.js, world/nightfield.js) and the
// interiors after dark (src/interiors/lighting.js, lightbake.js): when a lamp is on, how the
// solar stakes fade and the motion lights wake, the same household the same every time, the
// civic buildings washed all night, the far houses' door where the city draws it, the night
// lights a shut place keeps, and the night lights' share of the baked light.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lampLevel, solarLevel, motionLevel, lateHour, ALL_NIGHT, housePlan, buildingPlan, nightSeed, doorAcross, packHouse, K, NIGHT_I } from '../src/bay/nightplan.js';
import { bake } from '../src/interiors/lightbake.js';

const house = (o = {}) => ({ kind: 1.2, w: 12, d: 11, h: 3.3, cond: 0, ...o });
const plans = (o, n = 600) => Array.from({ length: n }, (_, i) => housePlan(house(o), nightSeed(i * 13.7 + 3, i * -9.1 + 7)));

test('a lamp comes on at dusk by its own point and goes off at its own hour', () => {
	// by day: off, whatever its timer
	assert.equal(lampLevel(0.3, ALL_NIGHT, 13, 0), 0);
	// the evening darkening past its point: on, smoothly
	assert.equal(lampLevel(0.3, 23, 19, 0.25), 0);
	const half = lampLevel(0.3, 23, 19.5, 0.36);
	assert.ok(half > 0.1 && half < 0.9, 'easing on ' + half);
	assert.equal(lampLevel(0.3, 23, 21, 1), 1);
	// off at its hour (a few minutes' fade), and after midnight too
	assert.equal(lampLevel(0.3, 23, 23.2, 1), 0);
	assert.equal(lampLevel(0.3, 25.5, 1, 1), 1, 'on till half past one');
	assert.equal(lampLevel(0.3, 25.5, 2, 1), 0, 'off after it');
	// left on all night: still on at four in the morning, off by daylight
	assert.equal(lampLevel(0.3, ALL_NIGHT, 4, 1), 1);
	assert.equal(lampLevel(0.3, ALL_NIGHT, 7.5, 0), 0);
	// no lamp
	assert.equal(lampLevel(0.3, 0, 22, 1), 0);
	assert.equal(lateHour(1), 25);
	assert.equal(lateHour(20), 20);
});

test('solar stakes light once it is dark and fade as their batteries run down', () => {
	assert.equal(solarLevel(1, 14, 0), 0, 'nothing by day');
	const early = solarLevel(0.8, 20, 1), late = solarLevel(0.8, 2, 1), dawn = solarLevel(0.8, 5.5, 1);
	assert.ok(early > late && late > dawn, `dimmer as the night goes on: ${early} ${late} ${dawn}`);
	assert.ok(early < 1 && early > 0.5);
	// a weak battery is out by midnight; a good one still glows at dawn
	assert.equal(solarLevel(0.1, 0.5, 1), 0);
	assert.ok(solarLevel(1, 5.5, 1) > 0);
	assert.equal(solarLevel(0, 21, 1), 0, 'no stake');
});

test('a motion light wakes as something passes and goes out after its minute', () => {
	assert.equal(motionLevel(0, 1), 1);
	assert.equal(motionLevel(30, 1), 1);
	assert.ok(motionLevel(46, 1) > 0 && motionLevel(46, 1) < 1, 'fading');
	assert.equal(motionLevel(60, 1), 0);
	assert.equal(motionLevel(Infinity, 1), 0, 'nothing seen');
	assert.equal(motionLevel(0, 0.1), 0, 'not by day');
});

test('a household keeps its lights from one visit to the next, and households differ', () => {
	const s = nightSeed(1234.5, -987.25);
	assert.deepEqual(housePlan(house(), s), housePlan(house(), s));
	const all = plans();
	const share = (f) => all.filter(f).length / all.length;
	// most houses light their porch, a share leave it on all night, some never
	assert.ok(share((p) => p.porch) > 0.7 && share((p) => p.porch) < 0.95, 'porch ' + share((p) => p.porch));
	assert.ok(share((p) => p.porch === ALL_NIGHT) > 0.15, 'all night');
	assert.ok(share((p) => p.path) > 0.15 && share((p) => p.path) < 0.6, 'path lights ' + share((p) => p.path));
	assert.ok(share((p) => p.solar) > 0.2 && share((p) => p.solar) < 0.6, 'solar ' + share((p) => p.solar));
	assert.ok(share((p) => p.tree) > 0.05 && share((p) => p.tree) < 0.4, 'trees ' + share((p) => p.tree));
	// different hours off and different points of coming on
	assert.ok(new Set(all.map((p) => Math.round(p.porch))).size >= 5, 'their own hours');
	assert.ok(Math.max(...all.map((p) => p.onK)) - Math.min(...all.map((p) => p.onK)) > 0.2, 'their own dusk');
	// the solar stakes' batteries vary, the path lights number 2 to 6
	assert.ok(all.every((p) => !p.path || (p.path >= 2 && p.path <= 6)));
	assert.ok(all.every((p) => !p.solar || (p.charge > 0.2 && p.charge <= 1)));
});

test('the bigger houses light up more, the run-down less and the boarded not at all', () => {
	const big = plans({ w: 18, d: 14, h: 6.4 }), small = plans();
	const n = (l, k) => l.filter((p) => p[k]).length;
	assert.ok(n(big, 'tree') > n(small, 'tree') * 1.5, 'their trees lit');
	assert.ok(n(big, 'wash') > 0 && n(small, 'wash') === 0, 'walls washed on the nicer houses only');
	assert.ok(n(big, 'path') > n(small, 'path'), 'path lights');
	const rundown = plans({ cond: 3 });
	assert.ok(rundown.every((p) => !p.path && !p.solar && !p.tree && !p.wash), 'a run-down house: a porch light at most');
	assert.ok(n(rundown, 'porch') < n(small, 'porch'));
	for (const cond of [1, 2]) assert.ok(plans({ cond }, 50).every((p) => !p.porch && !p.garage && !p.motion), 'boarded or burnt: dark');
	// a row house opens onto the sidewalk: no walk to light
	assert.ok(plans({ kind: 0.08 }).every((p) => !p.path && !p.solar), 'row houses');
	// garage lights only where there is a garage, some of them motion lights
	assert.ok(plans().every((p) => !p.garage && !p.motion), 'no garage');
	const gar = plans({ kind: 11.3 });
	assert.ok(n(gar, 'garage') > 100 && n(gar, 'motion') > 60, 'garage lights and motion lights');
	const shed = plans({ kind: K.garage, w: 6, d: 7 });
	assert.ok(n(shed, 'garage') + n(shed, 'motion') > 200 && shed.every((p) => !p.porch), 'a garage on its own');
});

test('civic buildings are washed all night; offices and towers some of them; houses not here', () => {
	const civ = buildingPlan({ kind: K.office, w: 24, d: 20, h: 9 }, 77, true);
	assert.ok(civ.wash > 3 && civ.washOff === ALL_NIGHT, 'a station or hospital');
	const towers = Array.from({ length: 400 }, (_, i) => buildingPlan({ kind: K.tower, w: 30, d: 30, h: 80 }, nightSeed(i * 31, i * 7)));
	const lit = towers.filter((p) => p.wash).length;
	assert.ok(lit > 100 && lit < 300, 'some towers ' + lit);
	assert.ok(towers.some((p) => p.sides === 4), 'some all round');
	assert.equal(buildingPlan({ kind: K.house + 0.2, w: 12, d: 11, h: 3 }, 5).wash, 0);
	assert.equal(buildingPlan({ kind: K.office, w: 24, d: 20, h: 12, cond: 2 }, 5, true).wash, 0, 'not a burnt one');
});

test('the far house\'s door is where the city draws it, and its lamps are packed for the shader', () => {
	// city.js: kind = base + 0.01 + door * 0.38; the shader: 1.25 + door * (w - 2.5) from the left
	for (const door of [0, 0.35, 0.5, 1]) {
		const o = house({ kind: 1 + 0.01 + door * 0.38, w: 14 });
		assert.ok(Math.abs(doorAcross(o) - (1.25 + door * 11.5)) < 1e-6);
	}
	assert.equal(doorAcross(house({ kind: 1 })), null, 'no door drawn');
	const P = housePlan(house(), 99);
	const pk = packHouse(P);
	assert.equal(pk[0], P.porch);
	assert.equal(Math.floor(pk[1]), P.porchCol);
	assert.ok(Math.abs((pk[1] % 1) - P.onK) < 1e-9);
	assert.ok(NIGHT_I.porch > NIGHT_I.path && NIGHT_I.path > NIGHT_I.solar, 'a porch light out-shines a path light, a path light a solar stake');
});

test('the city\'s shader switches the porch light as the plan does', () => {
	// the shader's own switch (city.js) reads the same numbers: onK from the fraction, all night above 30.5
	const src = fs.readFileSync(new URL('../src/bay/city.js', import.meta.url), 'utf8');
	assert.match(src, /float onK = fract\(vNL\.y\), up = smoothstep\(onK, onK \+ 0\.12, uNL\.y\);/);
	assert.match(src, /vNL\.x > 30\.5 \? 1\.0 : 1\.0 - smoothstep\(vNL\.x, vNL\.x \+ 0\.08, uNL\.x\)/);
	// and the uniform wall glow after dark is gone
	assert.doesNotMatch(src, /0\.14 \* vec3\(0\.8, 0\.85, 1\.0\)/);
	const lights = fs.readFileSync(new URL('../src/bay/nightlights.js', import.meta.url), 'utf8');
	assert.match(lights, /float up = smoothstep\(s\.y, s\.y \+ 0\.12, uNL\.y\);/);
	assert.match(lights, /life = 2\.5 \+ s\.w \* 9\.0/, 'the solar fade as solarLevel');
});

test('a shut place keeps about one light in every 9 m square on; a home keeps them all', async () => {
	globalThis.navigator ??= { userAgent: 'node' };
	const { nightLights } = await import('../src/interiors/lighting.js');
	const grid = () => { const l = []; for (let x = -12; x <= 12; x += 3.6) for (let z = -9; z <= 9; z += 3.6) l.push({ p: [x, 4.6, z], on: true, rm: 1, I: 10, shape: 'tube' }); return l; };
	const shut = nightLights(grid(), {});
	const kept = shut.filter((f) => f.night).length;
	assert.ok(kept >= shut.length / 6 && kept <= shut.length / 2.5, `${kept} of ${shut.length}`);
	// spread out, not bunched: none of them within 4 m of another
	const K2 = shut.filter((f) => f.night);
	for (const a of K2) for (const b of K2) if (a !== b) assert.ok(Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]) > 3.5);
	assert.ok(nightLights(grid(), { home: true }).every((f) => f.night), 'a home');
	assert.ok(nightLights(grid(), { allNight: true }).every((f) => f.night), 'a hospital');
	const scr = nightLights([{ p: [0, 2, 0], on: true, rm: 2, screen: true }, { p: [0.5, 2, 0], on: true, rm: 2 }, { p: [1, 2.6, 0], on: true, rm: 2 }], {});
	assert.ok(scr[0].night, 'a screen stays on');
	assert.equal(scr.filter((f) => f.night && !f.screen).length, 1, 'one ceiling light in a small room');
	assert.deepEqual(nightLights(grid(), {}).map((f) => f.night), shut.map((f) => f.night), 'the same ones every time');
});

test('the bake gives the night lights\' share: whole under a kept lamp, little under a lamp turned off', () => {
	const xs = [-4, 0, 4], P = new Float32Array(9), N = new Float32Array(9);
	xs.forEach((x, i) => { P.set([x, 0, 0], i * 3); N.set([0, 1, 0], i * 3); });
	let r = bake([{ P, N, C: null, count: 3 }], { fixtures: [{ p: [-4, 3, 0], c: [1, 1, 1], I: 10, shape: 'point', night: true }, { p: [4, 3, 0], c: [1, 1, 1], I: 10, shape: 'point', night: false }], boxes: [], sky: false });
	let v = r.next(); while (!v.done) v = r.next();
	const n = v.value[0].night;
	assert.ok(n[0] > 0.85, 'under the kept lamp ' + n[0]);
	assert.ok(n[2] < 0.15, 'under the one turned off ' + n[2]);
	assert.ok(Math.abs(n[1] - 0.5) < 0.05, 'halfway: half ' + n[1]);
	// every lamp a night light: the share is whole everywhere
	r = bake([{ P, N, C: null, count: 3 }], { fixtures: [{ p: [-4, 3, 0], c: [1, 1, 1], I: 10, shape: 'point' }], boxes: [], sky: false });
	v = r.next(); while (!v.done) v = r.next();
	assert.ok([...v.value[0].night].every((q) => q === 1));
});

test('the lamps light the trees and walls by a short list the shader reads', async () => {
	globalThis.navigator ??= { userAgent: 'node' };
	const THREE = await import('three');
	const { addNightField, NF, NF_N } = await import('../src/world/nightfield.js');
	const m = new THREE.MeshStandardMaterial();
	let before = 0;
	m.onBeforeCompile = () => { before++; };
	addNightField(m, { wrap: 0.5 });
	addNightField(m, { wrap: 0.5 });
	const sh = { uniforms: {}, defines: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
	m.onBeforeCompile(sh, null);
	assert.equal(before, 1, 'its own patch kept, once');
	assert.equal(sh.defines.NF_N, NF_N);
	assert.equal(sh.uniforms.uNFP, NF.uNFP, 'the shared list');
	assert.match(sh.fragmentShader, /nightField\(vNFW/);
	assert.match(sh.vertexShader, /vNFW = \(modelMatrix \* nfW\)\.xyz/);
	assert.match(m.customProgramCacheKey(), /nf\d+w0\.50/);
	assert.equal(NF.uNFP.value.length, NF_N * 4);
});
