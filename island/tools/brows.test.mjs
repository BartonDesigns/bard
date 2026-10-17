// Brows (people/face.js faceDetail, detailMaterial; people/body.js browOf): everyone's are
// brows as brows grow, not a few dark strokes: many fine hairs lying tidily over the brow's own
// soft tone, laid as one strip a brow (pieces laid segment by segment overlapped at every joint
// and showed as dark blocks), and never quite black.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detailMaterial } from '../src/people/face.js';

const face = fs.readFileSync(new URL('../src/people/face.js', import.meta.url), 'utf8');
const body = fs.readFileSync(new URL('../src/people/body.js', import.meta.url), 'utf8');

test('everyone has the brow tone under the hairs, one strip a brow', () => {
	assert.doesNotMatch(face, /if \(P\.dna\.brows\) for \(/, 'the tone is not for the groomed alone');
	assert.match(face, /for \(const L of arches\) \{\n\t\tlet prev = null;[\s\S]{0,1200}if \(prev\) I\.push\(prev\[0\], pair\[0\], pair\[1\], prev\[0\], pair\[1\], prev\[1\]\);/, 'one strip an arch, its points shared');
	const m = detailMaterial('#222222');
	assert.ok(m.userData.U.uFill.value > 1, 'a tone under every brow');
	assert.match(body, /uFill\.value = d\.brows\?\.fill \?\? 1\.6 \+/, 'each their own fullness');
});

test('the hairs are fine, many, tidy and short, as brows grow; set values still win', () => {
	assert.match(face, /dens = G\.dens \?\? dens0 \* 1\.15, thick = G\.thick \?\? thick0 \* 0\.68, blen = G\.len \?\? 0\.72, tidy = G\.tidy \?\? 0\.55, bwid = G\.wid \?\? \(P\.dna\.brows \? 0\.0014 : 0\.0008\)/);
	assert.match(face, /wid = bwid \* S/);
	assert.match(face, /\* 0\.45 \* tidy/);
	assert.match(face, /a = \(1\.0 - smoothstep\(w \* 0\.45, w, abs\(vSt\.x - 0\.5\)\)\) \* 0\.8;/, 'each hair a little see-through');
});

test('brows are never quite black', () => {
	assert.match(body, /if \(lum < 0\.07\) col\.multiplyScalar\(0\.07 \/ Math\.max\(lum, 1e-4\)\);/);
});
