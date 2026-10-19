// Brows (people/face.js faceDetail, browLine, frontSkin, detailMaterial; people/body.js
// browOf): everyone's are brows as brows grow, not a few dark strokes. Each follows its own brow
// bone in a brow's own shape (the head a little below the arch, the tail falling; never dipping
// into a tick at the inner end), and lies on the skin, every point of it: its tone a fine grid
// on the skin's own surface, each hair's root and tip on it (laid flat between a few points it
// cut through the ridge and stood off it by turns). Many fine hairs over a soft tone; never
// quite black.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { detailMaterial, browLine, frontSkin } from '../src/people/face.js';

const face = fs.readFileSync(new URL('../src/people/face.js', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../src/people/body.js', import.meta.url), 'utf8');

test('a brow follows its bone in a brow shape, and never dips at the inner end', () => {
	const o = { rise: 0.003, fall: 0.005, peak: 0.62, tilt: 0.004 };
	// (a bone whose frontmost skin rises steeply at the inner end, as the bulge between the brows does)
	const ts = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], ys = [0.0257, 0.0257, 0.0252, 0.0252, 0.02, 0.0189, 0.0179, 0.0168, 0.0158, 0.0137, 0.0147];
	const line = browLine(ts, ys, o), y = (t) => line(t);
	let down = false;
	for (let t = 0.02; t <= 1.0001; t += 0.02) { const d = y(t) - y(t - 0.02); if (d < -1e-7) down = true; else if (d > 1e-7) assert.ok(!down, `no dip: rising again at t ${t.toFixed(2)}`); }
	assert.ok(y(0) < Math.max(y(0.5), y(0.6)) + 1e-9, 'the head is no higher than the arch');
	assert.ok(y(1) < y(0.6), 'the tail falls');
	// (at the bone's own height over the middle)
	assert.ok(Math.abs(y(0.6) - 0.0179) < 0.003, `at the bone: ${y(0.6).toFixed(4)}`);
	// (a level bone: still a brow's shape on it, the head and the tail below the arch)
	const flat = browLine(ts, ts.map(() => 0.02), o), top = Math.max(...ts.map(flat));
	assert.ok(flat(0) < top && flat(1) < top && Math.abs(flat(0.5) - 0.02) < 0.002);
});

test('the skin round the brows is found on its curve: points on it, normals out of it', () => {
	// a ridge: z = 0.1 - 40 (y - 0.02)^2 over a grid, as skin triangles
	const n = 20, p = [], body = [];
	for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = -0.05 + 0.1 * i / n, y = 0.04 * j / n; p.push(x, y, 0.1 - 40 * (y - 0.02) ** 2); }
	const id = (i, j) => j * (n + 1) + i;
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) body.push(id(i, j), 0, id(i + 1, j), 0, id(i + 1, j + 1), 0, id(i, j), 0, id(i + 1, j + 1), 0, id(i, j + 1), 0);
	const at = frontSkin({ body }, Float32Array.from(p), -0.06, 0.06, -0.01, 0.05, 0);
	const out = { p: new THREE.Vector3(), n: new THREE.Vector3(), v: 0 };
	for (const [x, y] of [[0, 0.02], [0.013, 0.007], [-0.031, 0.033]]) {
		assert.ok(at(x, y, out), 'on the skin');
		assert.ok(Math.abs(out.p.z - (0.1 - 40 * (y - 0.02) ** 2)) < 0.0003, `on its curve at ${x}, ${y}`);
		const want = new THREE.Vector3(0, 80 * (y - 0.02), 1).normalize();
		assert.ok(out.n.dot(want) > 0.98, 'its normal, out of it');
	}
	assert.equal(at(0.2, 0.02, out), false, 'off the skin: nothing');
});

test('everyone has the brow tone under the hairs, laid on the skin as a grid; the hairs root on it', () => {
	assert.doesNotMatch(face, /if \(P\.dna\.brows\) for \(/, 'the tone is not for the groomed alone');
	assert.match(face, /const NT = 24, NU = 4, grid = \[\];[\s\S]{0,300}onSkinAt\(xAt\(t\), lowAt\(t\) \+ u \* hAt\(t\), 0\.0003\)/, 'a fine grid, every point on the skin');
	assert.match(face, /const r0 = onSkinAt\(x, y, 0\.00025\);[\s\S]{0,700}const r1 = onSkinAt\(/, 'root and tip on the skin');
	const m = detailMaterial('#222222');
	assert.ok(m.userData.U.uFill.value > 1, 'a tone under every brow');
	assert.match(body, /uFill\.value = d\.brows\?\.fill \?\? 1\.6 \+/, 'each their own fullness');
});

test('the hairs are fine, many, tidy and short, as brows grow; set values still win', () => {
	assert.match(face, /dens = G\.dens \?\? dens0 \* 1\.15, thick = G\.thick \?\? thick0 \* 0\.68, blen = G\.len \?\? 0\.72, tidy = G\.tidy \?\? 0\.55, bwid = G\.wid \?\? 0\.0008;/);
	assert.match(face, /\* 0\.45 \* tidy/);
	assert.match(face, /a = \(1\.0 - smoothstep\(w \* 0\.45, w, abs\(vSt\.x - 0\.5\)\)\) \* 0\.8;/, 'each hair a little see-through');
});

test('brows are never quite black', () => {
	assert.match(body, /if \(lum < 0\.07\) col\.multiplyScalar\(0\.07 \/ Math\.max\(lum, 1e-4\)\);/);
});
