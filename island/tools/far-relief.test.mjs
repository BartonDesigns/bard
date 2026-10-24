// The far ring's relief (bay/farrelief.js) fits a phone's ground shader: Apple's graphics take
// 16 textures in a fragment shader at most, and the Bay's ground was at 14 before the hills'
// shade (world/hillsun.js) took one more. The relief is one map, and the far ring leaves out
// the photographed ground (close by only, never 4 km out) to make room for it.
//   node --test island/tools/far-relief.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAR_RELIEF_GLSL, FAR_RELIEF_U, FAR_RELIEF_SLOPE } from '../src/bay/farrelief.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const terrain = fs.readFileSync(path.join(here, '../src/bay/terrain.js'), 'utf8');

test('the far ring reads its relief from one texture, not the surveys', () => {
	const samplers = FAR_RELIEF_GLSL.match(/sampler2D\s+[^;]+;/g) || [];
	assert.equal(samplers.length, 1, 'one sampler declaration');
	assert.equal(samplers[0].split(',').length, 1, 'one sampler in it');
	assert.ok(!/uB0|uBa|uBb|uBc/.test(FAR_RELIEF_GLSL), 'no survey reads in the far ring\'s pixels');
	assert.deepEqual(Object.keys(FAR_RELIEF_U).sort(), ['uFRel', 'uFRelR']);
	assert.ok(FAR_RELIEF_SLOPE >= 2, 'slopes to 63 degrees and more kept');
});

test('the photographed ground stays out of the far ring', () => {
	// the photo atlas's functions are left out of the far ring's shader...
	assert.match(terrain, /\(hole && !LITE_F \? '' : GROUND_PHOTO_GLSL \+ TILE2_GLSL\)/);
	assert.match(terrain, /\(hole && !LITE_F \? FAR_RELIEF_GLSL :/);
	// ...and every read of it in the full ground (past the light ground's branch) is fenced off
	// there: what is left once the #ifndef BAY_FAR_RELIEF blocks are taken out reads none of it
	const full = terrain.slice(terrain.indexOf('#else\n\t\t\t\t{\n\t\t\t\t\tbCurv = vCurv;'));
	assert.ok(full.length > 1000, 'the full ground found');
	const kept = [], stack = [];
	for (const line of full.split('\n')) {
		const t = line.trim();
		if (/^#if/.test(t)) { stack.push(t === '#ifndef BAY_FAR_RELIEF'); continue; }
		if (t === '#endif') { stack.pop(); continue; }
		if (/^#else/.test(t) && stack.length) { stack[stack.length - 1] = false; continue; }
		if (!stack.includes(true)) kept.push(line);
	}
	assert.ok(!/gpRead\(|gpTap\(|loamGrain\(/.test(kept.join('\n')), 'no photographed ground read in the far ring');
});
