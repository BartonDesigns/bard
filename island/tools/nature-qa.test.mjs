// The nature QA pass (docs/nature-qa-2026-10-16.md): things standing on the ground meet it
// (world/groundsnap.js), trees beside a graded road ride its banks and cuts (bay/berms.js
// roadDelta), the ground's colours blend by slope, height and noise (world/terrain.js), and no
// ground lifted on the graphics card can throw a vertex to infinity (SAFE_GLSL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { baseHeight, baseFromSlope, slopeAt, tiltFromGradient, slopeTilt } from '../src/world/groundsnap.js';
import { SAFE_GLSL, HEIGHT_GLSL, SAFE_H_RANGE } from '../src/world/terrain.js';
import { createBerms, BERM_U, roadDelta, gradeVersion } from '../src/bay/berms.js';

const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const plane = (gx, gz, h0 = 10) => (x, z) => h0 + gx * x + gz * z;

test('a foot on a slope meets the lowest ground under it, a little sunk', () => {
	for (const [gx, gz] of [[0, 0], [0.3, 0], [0, -0.6], [0.4, 0.4], [-0.8, 0.1]]) {
		const g = plane(gx, gz), r = 0.6, sink = 0.07;
		const y = baseHeight(g, 5, -3, r, sink);
		// as low as the lowest of the footprint's samples, and no lower than its true lowest point
		const h = g(5, -3);
		assert.ok(y <= h - Math.max(Math.abs(gx), Math.abs(gz)) * r - sink + 1e-9, `slope ${gx},${gz}`);
		assert.ok(y >= h - Math.hypot(gx, gz) * r - sink - 1e-9, `slope ${gx},${gz}`);
		// on the flat it is just the sink below the centre
		if (!gx && !gz) assert.ok(Math.abs(y - (10 - sink)) < 1e-9);
		// the slope in hand gives the same foot on a plane, without the extra samples
		const s = slopeAt(g, 5, -3, 1);
		assert.ok(Math.abs(s - Math.hypot(gx, gz)) < 1e-9);
		const yb = baseFromSlope(g(5, -3), s, r, sink);
		assert.ok(yb <= y + 1e-9, 'the slope form is never higher than the sampled one');
		assert.ok(yb >= y - Math.hypot(gx, gz) * r * 0.42 - 1e-9, 'and not much lower');
	}
});

test('a foot never sinks out of sight over a cliff, and ignores ground that is not a number', () => {
	const cliff = (x) => (x > 0.3 ? -500 : 20);
	const y = baseHeight(cliff, 0, 0, 0.8, 0.05);
	assert.ok(y > 20 - 0.8 * 1.5 - 0.5 - 0.06 && y < 20, `cliff ${y}`);
	const holey = (x, z) => (x > 0 ? NaN : z > 0 ? Infinity : 4);
	const y2 = baseHeight(holey, 0, 0, 1, 0.1);
	assert.ok(Number.isFinite(y2) && Math.abs(y2 - 3.9) < 1e-9);
	assert.ok(Number.isFinite(baseFromSlope(NaN, NaN, 1, 0.1)));
	assert.equal(baseFromSlope(10, 100, 1, 0), 10 - 2, 'a slope of a wall is held to a stride');
});

test('rocks and low plants lie with the slope; at k = 0 the turn is the yaw alone', () => {
	const q = new THREE.Quaternion(), up = new THREE.Vector3();
	for (const [gx, gz] of [[0.5, 0], [0, 0.5], [-0.3, 0.7], [0, 0]]) for (const k of [0, 0.5, 1]) for (const yaw of [0, 1.3, -2.2]) {
		tiltFromGradient(gx, gz, yaw, k, q);
		assert.ok(Math.abs(q.length() - 1) < 1e-9);
		up.set(0, 1, 0).applyQuaternion(q);
		const n = new THREE.Vector3(-gx * k, 1, -gz * k).normalize();
		assert.ok(up.distanceTo(n) < 1e-9, `up goes to the eased normal (${gx}, ${gz}, k ${k})`);
		// the plant's own forward still turns with yaw (seen from above)
		const f = new THREE.Vector3(1, 0, 0).applyQuaternion(q), f0 = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
		if (k === 0) assert.ok(f.distanceTo(f0) < 1e-9);
		else assert.ok(Math.atan2(-f.z, f.x) - Math.atan2(-f0.z, f0.x) < 0.8);
	}
	slopeTilt(plane(0.2, -0.1), 0, 0, 1, 0.5, 1, q);
	up.set(0, 1, 0).applyQuaternion(q);
	assert.ok(up.distanceTo(new THREE.Vector3(-0.2, 1, 0.1).normalize()) < 1e-9);
	tiltFromGradient(NaN, 1, 0, 1, q);
	assert.ok(Number.isFinite(q.x + q.y + q.z + q.w));
});

test('every ground lifted on the graphics card is guarded against infinity and not-a-number', () => {
	// the guard tests the bits (no compiler folds that away) and holds the range
	assert.match(SAFE_GLSL, /floatBitsToUint\(h\) & 0x7f800000u\) == 0x7f800000u/);
	assert.match(SAFE_GLSL, /#ifndef SAFE_H_GLSL/);
	assert.ok(SAFE_GLSL.includes(`clamp(h, -${SAFE_H_RANGE}.0, ${SAFE_H_RANGE}.0)`));
	// the island and planets' ground (and grass, litter, caves, through HEIGHT_GLSL)
	assert.match(HEIGHT_GLSL, /return safeH\(mix\(/);
	assert.match(HEIGHT_GLSL, /max\(uCell, 1e-3\)/);
	assert.match(src('world/terrain.js'), /safeH\(farBlend\(heightAt\(w\), w\), 0\.0\)/);
	// the Bay's surveyed ground
	assert.match(src('bay/terrain.js'), /float gradedHeight\(vec2 w\)\{ float b = bayHeight\(w\); return safeH\(/);
	assert.match(src('bay/terrain.js'), /SAFE_GLSL \+ BAY_GLSL/);
	// the globe's ground
	assert.match(src('earth/globeterrain.js'), /gh = safeH\(gh, 0\.0\);/);
	assert.match(src('earth/globeterrain.js'), /SAFE_GLSL \+ BAY_GLSL/);
	// a vertex shader compiles with two copies included (the guard is defined once)
	const twice = SAFE_GLSL + SAFE_GLSL;
	assert.equal((twice.match(/float safeH/g) || []).length, 2);
	assert.equal((twice.match(/#ifndef SAFE_H_GLSL/g) || []).length, 2);
});

test('the sunbeams ease into the open sky at the shadow box, never a hard line', () => {
	const s = src('world/sunrays.js');
	assert.match(s, /smoothstep\(0\.0, 0\.12, edge\)/);
	assert.match(s, /mix\(uOpen, texture\(uShadow/);
});

test('trees beside a graded road ride its banks and cuts, and the grade never carries a NaN', () => {
	let available = false, nanAt = null;
	const road = { drive: true, cls: 'primary', w: 8, pts: new Float32Array([0, -200, 0, 200]) };
	const real = { loaded: () => true, inside: () => true, version: () => 1, sourceVersion: () => 1, near: (k) => (available && k === 'roads' ? [road] : []) };
	// a hump the road cuts through (a 12 m rise over 60 m)
	const ground = (x, z) => (nanAt && Math.hypot(x - nanAt[0], z - nanAt[1]) < 3 ? NaN : 100 + 12 * Math.exp(-(z * z) / 900));
	const berms = createBerms(real, ground);
	const cam = { position: new THREE.Vector3(0, 102, 0) };
	berms.update(cam);
	assert.equal(roadDelta(1, 0), 0, 'nothing graded yet');
	const v0 = gradeVersion();
	available = true; real.version = () => 2;
	berms.update(cam);
	assert.equal(BERM_U.uBermR.value.w, 1);
	assert.ok(gradeVersion() > v0, 'the version moves when the grid is redone');
	// on the crown of the hump the road is cut down; a tree on the verge (4.5 m out) rides the cut
	const cut = roadDelta(4.5, 0);
	assert.ok(cut < -1, `cut ${cut}`);
	assert.ok(Math.abs(berms.apply(4.5, 0, ground(4.5, 0)) - (ground(4.5, 0) + cut)) < 1e-6, 'the same as the ground the GPU draws');
	// far off the road the ground is its own
	assert.equal(roadDelta(60, 0), 0);
	// a ground still loading (NaN here) never puts a NaN into the grade
	nanAt = [0, 30]; real.version = () => 3;
	berms.update(cam);
	for (let z = 20; z <= 40; z += 1) assert.ok(Number.isFinite(roadDelta(2, z)) && Number.isFinite(berms.apply(2, z, 100)));
	// the city's trees and the street trees' stakes read it
	assert.match(src('bay/city.js'), /const gy = d < 300 \? t\.y \+ roadDelta\(t\.x, t\.z\) : t\.y;/);
	assert.match(src('bay/city.js'), /gradeVersion\(\) !== treeGV/);
	assert.match(src('bay/streettrees.js'), /const ty = t\.y \+ roadDelta\(t\.x, t\.z\);/);
});

test('the grass glows with the sun only where the sun reaches it, and never stretches across the lens', async () => {
	// (taken from three's chunk when the grass is built, so it has the hills' shade, world/hillsun.js)
	const SUNLIT_BEGIN = (await import('../src/world/grass.js')).sunlitBegin();
	// three's light loop, with the sun's shadow kept for the glow
	assert.ok(SUNLIT_BEGIN.length > THREE.ShaderChunk.lights_fragment_begin.length);
	assert.match(SUNLIT_BEGIN, /vDirectionalShadowCoord\[ i \] \) : 1\.0;\n\t\tgSunLit = min\(gSunLit,/);
	const s = src('world/grass.js');
	assert.match(s, /totalEmissiveRadiance \+= gGlow \* gSunLit \* vShadeK;/);
	assert.ok(!/totalEmissiveRadiance \+= [^;]*uSunColor/.test(s), 'no sun glow added before the lights');
	assert.match(s, /vShadeK = 1\.0 - canopy \* 0\.85;/);
	// a tuft at the eye shrinks away; the parting only for a walker's eye height
	assert.match(s, /tall \*= smoothstep\(0\.25, 0\.9, eyeD\);/);
	assert.match(s, /smoothstep\(1\.1, 1\.45, eyeH\) \* \(1\.0 - smoothstep\(2\.2, 3\.0, eyeH\)\)/);
});

test('trees bow to the same gusts the grass shows, patch by patch, not all at once', async () => {
	const { GUST_GLSL } = await import('../src/world/vegetation.js');
	const { NOISE_GLSL } = await import('../src/world/terrain.js');
	// the same hash as the grass's value noise (terrain.js h21), carried down the wind as fast
	const body = (g, name) => { const a = g.indexOf('float ' + name + '(vec2 p)'); return g.slice(g.indexOf('{', a), g.indexOf('}', a) + 1); };
	assert.equal(body(GUST_GLSL, 'gpH'), body(NOISE_GLSL, 'h21'));
	assert.match(GUST_GLSL, /\(w - wd \* uWindT \* 9\.0\) \* 0\.018 \+ 3\.1/);
	assert.match(src('world/grass.js'), /vec2 gp = w - wd \* uWindT \* 9\.0;\n\t*float patchA = smoothstep\(0\.42, 0\.85, vn\(gp \* 0\.018 \+ 3\.1\)\);/);
	assert.ok(GUST_GLSL.endsWith('\n'), 'ends its line, so the next #include stands at a line start');
	assert.ok(SAFE_GLSL.endsWith('\n'));
	assert.match(src('world/vegetation.js'), /float gustL = uGust \* gustPatch\(ip\.xz\);/);
});

test('nothing of the wild ground stands on asphalt, a car park or a roof', async () => {
	const { onPaving } = await import('../src/nature/wildground.js');
	// a car park on the coarse map at x 0..20, and a drive road along z = 50
	const real = { inside: () => true, landAt: (x) => (x >= 0 && x < 20 ? { lu: 0, road: 1, roof: 0 } : { lu: 0, road: 0.1, roof: 0 }) };
	const drives = [{ drive: true, w: 6, walked: true, pts: new Float32Array([-100, 50, 100, 50]) }];
	assert.equal(onPaving(real, drives, 10, 0), true, 'the car park');
	assert.equal(onPaving(real, drives, 30, 0), false, 'the wild beside it');
	assert.equal(onPaving(real, drives, 30, 50 + 3 + 1.7 + 0.5), true, 'the road, its sidewalk and a margin');
	assert.equal(onPaving(real, drives, 30, 50 + 3 + 1.7 + 0.7), false, 'just past it');
	assert.equal(onPaving(null, [], 0, 0), false, 'no map, nothing paved');
	assert.match(src('nature/wildground.js'), /const put = \(L, x, z, yaw, sx, sy, col, v, sink = 0\.05, lie = false\) => \{\n\t\t\tif \(paved\(x, z\)\) return;/);
	// the hyper-arid deserts are bare but for the washes
	assert.match(src('nature/wildground.js'), /const sparse = sm\(25, 220, rain\)/);
});

test('the globe ground: its photo grain without a speckle, its snow and rock by aspect', () => {
	const s = src('earth/globeterrain.js');
	// the photographs' relief a centimetre or so (12 cm tipped every pixel's normal), their grain a
	// quarter either way, as the Bay's
	assert.match(s, /bh \+= \(gDetL - 0\.5\) \* 0\.015 \* \(1\.0 - smoothstep\(0\.03, 0\.15, px\)\);/);
	assert.match(s, /c \*= mix\(1\.0, 0\.72 \+ 0\.56 \* gDetL, 1\.0 - smoothstep\(0\.08, 0\.5, px\)\);/);
	// and the snow is matte but for the wind-scoured ice
	assert.match(src('world/terrain.js'), /rough = mix\(rough, mix\(0\.74, 0\.34, gSnowIce\), gSnowW\);/);
	// shaded faces keep their snow, the line wanders, scree and moss where they belong
	assert.match(s, /float snowAir = air - shadeSide \* 2\.5 \+ \(m1 - 0\.5\) \* 1\.4;/);
	assert.match(s, /float screeK = /);
	assert.match(s, /uniform vec4 uGAnc;/);
});

test('every wild rock has a damp dark foot where it meets the soil', () => {
	const s = src('nature/rocks.js');
	assert.match(s, /float foot = 1\.0 - smoothstep\(uRkFoot - 0\.04, uRkFoot \+ 0\.2/);
	assert.match(s, /m\.onBeforeCompile = function \(sh\)/);
	assert.match(src('world/lodfade.js'), /prev\.call\(material, sh, r\)/);
	for (const [layer, k] of [['Lrk', '0.35'], ['Lout', '0.45'], ['Lst', '0.3']]) assert.ok(src('nature/wildground.js').includes(`footAt(${layer}, ${k});`));
});
