// Night lighting, part two: the Moon where it really is and as lit as it is (src/world/solar.js),
// the street lamps by era and their pools (src/bay/streetlamps.js), the skyline's obstruction
// lights and the landmarks' floodlights (src/bay/floodlights.js), the cars' brake lights and
// low beams (src/bay/carlights.js), the three lists of lamps the shaders read
// (src/world/nightfield.js), the evening's lights let go with the streets (nightlights.js
// dispose), and the landmarks' meshes with no NaN normals (src/bay/landmarks.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lunarPosition, moonlightShare, solarDate } from '../src/world/solar.js';
import { LAMP, LAMP_COL, lampLook, poolAt, poolPeak } from '../src/bay/streetlamps.js';
import { beaconsFor, flashAt, pickFloods } from '../src/bay/floodlights.js';
import { brakeLevel, beamAt } from '../src/bay/carlights.js';

globalThis.navigator ??= { userAgent: 'node' };

const moonAt = (y, m, d, h) => { const date = new Date(y, m - 1, d), sd = solarDate(date); return lunarPosition(date, h, sd.noon); };
const sep = (a, b) => {
	// angle between two (ra hours, dec radians) places, degrees
	const ra1 = a.ra / 12 * Math.PI, ra2 = b.ra / 12 * Math.PI;
	return Math.acos(Math.sin(a.dec) * Math.sin(b.dec) + Math.cos(a.dec) * Math.cos(b.dec) * Math.cos(ra1 - ra2)) * 180 / Math.PI;
};

test('the Moon is where it really is, and as lit as it is', () => {
	// the total solar eclipse of 8 April 2024 (about 11:20 on the Bay's clock): new, beside the sun
	const e = moonAt(2024, 4, 8, 11.3), sun = solarDate(new Date(2024, 3, 8));
	assert.ok(e.lit < 0.01, 'new at the eclipse: ' + e.lit);
	assert.ok(sep(e, { ra: sun.ra, dec: 7.6 * Math.PI / 180 }) < 2, 'beside the sun');
	// the total lunar eclipse of 3 March 2026 (about 03:30): full, opposite the sun
	const f = moonAt(2026, 3, 3, 3.5);
	assert.ok(f.lit > 0.99, 'full at the lunar eclipse: ' + f.lit);
	assert.ok(f.age > 14 && f.age < 15.5);
	// a week after new it is near half, waxing; a week after full, near half, waning
	const w = moonAt(2026, 10, 17, 21);
	assert.ok(w.waxing && w.lit > 0.3 && w.lit < 0.7, 'first quarter-ish: ' + w.lit);
	const n = moonAt(2026, 11, 1, 21);
	assert.ok(!n.waxing && n.lit > 0.3 && n.lit < 0.85, 'waning: ' + n.lit);
	// it moves about 13 degrees a day among the stars
	const a = moonAt(2026, 5, 10, 22), b = moonAt(2026, 5, 11, 22);
	const d = sep(a, b);
	assert.ok(d > 11 && d < 15.5, 'a day of the Moon: ' + d);
	// a half moon gives about a tenth of the full moon's light (not half), a crescent next to none
	assert.equal(moonlightShare(1), 1);
	assert.ok(moonlightShare(0.5) > 0.12 && moonlightShare(0.5) < 0.25);
	assert.ok(moonlightShare(0.1) < 0.01);
	assert.ok(moonlightShare(0) === 0);
});

test('the street lamps burn by era: sodium on the old arterials, LED on the new', () => {
	assert.equal(lampLook('led', 'new').col, 'led');
	assert.equal(lampLook('cobra', 'prewar', 1, 0.9).col, 'sodium');
	assert.equal(lampLook('cobra', 'prewar', 1, 0.05).col, 'led', 'a refitted street');
	assert.ok(['acorn', 'warmLed'].includes(lampLook('acorn', 'historic').col), 'acorns warm');
	// the share refitted: more on freeways and newer tracts than on old residential streets
	const share = (era, rank) => Array.from({ length: 1000 }, (_, i) => lampLook('cobra', era, rank, (i + 0.5) / 1000)).filter((q) => q.col === 'led').length / 1000;
	assert.ok(share('prewar', 1) < share('prewar', 3) && share('prewar', 3) < share('prewar', 6));
	assert.ok(share('tract', 1) > share('prewar', 1));
	// sodium is orange, LED cool: red over blue
	assert.ok(LAMP_COL.sodium[0] / LAMP_COL.sodium[2] > 5);
	assert.ok(LAMP_COL.led[2] >= LAMP_COL.led[0]);
	// the pool: brightest under the head, the inverse cube of the slant distance, to nothing far out
	assert.equal(poolAt(0, 8), 1);
	assert.ok(Math.abs(poolAt(8, 8) - Math.pow(2, -1.5)) < 1e-9, 'at a head height out, the cosine cubed');
	assert.ok(poolAt(20, 8) < 0.06);
	// the acorns are lower and dimmer, their pools tighter; a cobra's is the evening's scale
	assert.ok(LAMP.acorn.h < LAMP.cobra.h && LAMP.acorn.I < LAMP.cobra.I);
	assert.ok(poolPeak(LAMP.cobra) > 0.02 && poolPeak(LAMP.cobra) < 0.08);
});

test('the towers carry red lights by height, every flashing one in step', () => {
	const B = beaconsFor([
		{ x: 0, y: 0, z: 0, w: 20, d: 20, h: 60 },             // too low
		{ x: 100, y: 5, z: 0, w: 20, d: 20, h: 120 },          // steady, one
		{ x: 200, y: 0, z: 0, w: 40, d: 40, h: 200, a: 0 },    // flashing, two corners
	]);
	assert.equal(B.length, 3);
	assert.deepEqual([B[0].flash, B[0].y], [false, 125.6]);
	assert.ok(B[1].flash && B[2].flash);
	assert.ok(Math.hypot(B[1].x - B[2].x, B[1].z - B[2].z) > 40, 'at opposite corners');
	// thirty flashes a minute, a soft half second each, the same at the same moment everywhere
	assert.equal(flashAt(0.4), flashAt(2.4));
	assert.ok(flashAt(0.4) > 0.9 && flashAt(1.4) === 0);
	const lit = Array.from({ length: 2000 }, (_, i) => flashAt(i / 1000) > 0.5).filter(Boolean).length / 2000;
	assert.ok(lit > 0.2 && lit < 0.4, 'on about a third of the time: ' + lit);
});

test('the landmarks take the floodlights that matter most from where you are', () => {
	// stride 13: x, y, z, reach, rgb, cosO, dir, cosI, weight
	const F = new Float32Array(13 * 4);
	const put = (i, x, I) => F.set([x, 0, 0, 100, 1, 1, 1, 0.9, 0, 1, 0, 0.95, Math.sqrt(I)], i * 13);
	put(0, 100, 100); put(1, 300, 2500); put(2, 50, 4); put(3, 9000, 2500);
	const out = new Int32Array(3), score = new Float32Array(4);
	const n = pickFloods(F, 4, 0, 0, 0, 3, out, score, 6000);
	assert.equal(n, 3, 'the one 9 km off is out of reach');
	assert.deepEqual([...out], [1, 0, 2], 'the strong tower lights first, the little one last');
});

test('the cars brake and light the road ahead', () => {
	// slowing hard, or standing at a corner: the brake lights come on; cruising, off
	let k = 0;
	for (let i = 0; i < 30; i++) k = brakeLevel(12, 12.02, 1 / 30, k);
	assert.ok(k < 0.05, 'cruising: ' + k);
	for (let i = 0; i < 30; i++) k = brakeLevel(10, 9.85, 1 / 30, k);
	assert.ok(k > 0.9, 'braking: ' + k);
	k = 0;
	for (let i = 0; i < 30; i++) k = brakeLevel(0, 0, 1 / 30, k);
	assert.ok(k > 0.9, 'waiting: ' + k);
	// the low beam: nothing behind, little right at the bumper, brightest some metres on, fading by thirty
	assert.equal(beamAt(-1, 0), 0);
	assert.ok(beamAt(1, 0) < 0.05);
	const peak = Math.max(...Array.from({ length: 40 }, (_, i) => beamAt(i, 0)));
	assert.ok(beamAt(8, 0) > 0.6 * peak);
	assert.ok(beamAt(30, 0) < 0.3 * peak);
	// wider further out, narrow close in
	assert.ok(beamAt(20, 4) / beamAt(20, 0) > beamAt(5, 1.5) / beamAt(5, 0));
});

test('three lists of lamps, each for its own materials', async () => {
	const THREE = await import('three');
	const { addNightField, FIELDS, NF_N, SF_N, LF_N } = await import('../src/world/nightfield.js');
	assert.equal(FIELDS.NF.P.value.length, NF_N * 4);
	assert.equal(FIELDS.SF.P.value.length, SF_N * 4);
	assert.equal(FIELDS.LF.P.value.length, LF_N * 4);
	const m = addNightField(new THREE.MeshStandardMaterial(), { field: 'LF' });
	const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
	m.onBeforeCompile(sh, null);
	assert.equal(sh.uniforms.uLFP, FIELDS.LF.P);
	assert.match(sh.fragmentShader, /fieldLF\(vLFW/);
	assert.doesNotMatch(sh.fragmentShader, /uNFP/, 'one list a material');
	assert.match(m.customProgramCacheKey(), /LF\d+w0\.00/);
	// the city's buildings read the street lamps' list
	assert.match(fs.readFileSync(new URL('../src/bay/city.js', import.meta.url), 'utf8'), /addNightField\(withRise\(buildingMaterial[^;]*field: 'SF'/);
});

test('the evening lets go of what it drew, with the streets', async () => {
	const THREE = await import('three');
	const { createNightLights } = await import('../src/bay/nightlights.js');
	const scene = new THREE.Scene();
	const E = createNightLights(scene, { nearList: () => [], treesAt: () => [] }, { isPhone: true });
	assert.equal(scene.children.length, 2);
	let disposed = 0;
	for (const o of scene.children) { o.geometry.addEventListener('dispose', () => disposed++); o.material.addEventListener('dispose', () => disposed++); }
	E.dispose();
	assert.equal(scene.children.length, 0);
	assert.equal(disposed, 4);
	const src = fs.readFileSync(new URL('../src/bay/streets.js', import.meta.url), 'utf8');
	assert.match(src, /function dispose\(\) \{[^}]*evening\.dispose\(\)/);
	assert.match(src, /flood\.dispose\(\)/);
	assert.match(src, /carLights\.dispose\(\)/);
});

test('the landmarks have no NaN normals', async () => {
	const noop = new Proxy(function () {}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), set: () => true, apply: () => noop });
	const doc = globalThis.document;
	globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop, style: {} }) };
	try {
		const THREE = await import('three');
		const { createLandmarks } = await import('../src/bay/landmarks.js');
		const L = createLandmarks(new THREE.Scene(), { heightAt: () => 0, loaded: () => true });
		const bad = [];
		L.group.traverse((m) => {
			if (!m.isMesh || !m.geometry.attributes.normal) return;
			const a = m.geometry.attributes.normal.array;
			let n = 0;
			for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) n++;
			if (n) bad.push('#' + m.material.color?.getHexString() + ' ' + n + '/' + a.length);
		});
		assert.deepEqual(bad, []);
	} finally { globalThis.document = doc; }
});
