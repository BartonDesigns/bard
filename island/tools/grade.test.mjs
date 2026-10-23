// The look on AgX (src/world/grade.js): contrast round a pivot with black and white held,
// saturation back in the mid-tones, a little split toning. It must go into three's own AgX
// (a three.js upgrade that moves the hook would silently turn it off), once, before anything
// is compiled, and the CPU copy that tone maps the fog colour (sky.js agx) must take it too.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GRADE, bardLook, installGrade } from '../src/world/grade.js';

const src = (p) => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const NONE = { ...GRADE, contrast: 1, sat: 1, shade: [0, 0, 0], light: [0, 0, 0], exposure: 1 };

test('the look goes into three\'s AgX, right after its curve', () => {
	const before = THREE.ShaderChunk.tonemapping_pars_fragment;
	assert.equal(installGrade(), true);
	const after = THREE.ShaderChunk.tonemapping_pars_fragment;
	assert.notEqual(after, before);
	assert.match(after, /color = agxDefaultContrastApprox\( color \);\n\tcolor = bardLook\( color \);/);
	assert.match(after, /vec3 bardLook\( vec3 v \)[\s\S]*vec3 AgXToneMapping\(/);
	assert.match(after, new RegExp(`color \\*= toneMappingExposure \\* ${GRADE.exposure};`));
	// (the other tone mappings untouched)
	assert.match(after, /color \*= toneMappingExposure \/ 0\.6;/);
	// called again it starts from three's own chunk, not on top of the last look
	installGrade();
	assert.equal(THREE.ShaderChunk.tonemapping_pars_fragment.split('vec3 bardLook(').length, 2);
});

test('black, white and the pivot hold; the mid-tones spread and gain colour', () => {
	const P = GRADE.pivot, same = (a, b) => a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 1e-9, `${a} vs ${b}`));
	same(bardLook([0.3, 0.5, 0.7], NONE), [0.3, 0.5, 0.7]);
	const flat = { ...GRADE, shade: [0, 0, 0], light: [0, 0, 0] };
	same(bardLook([0, 0, 0], flat), [0, 0, 0]);
	same(bardLook([1, 1, 1], flat), [1, 1, 1]);
	same(bardLook([P, P, P], flat), [P, P, P]);
	// grey below the pivot darker, above it lighter, in order
	let last = -1;
	for (let x = 0; x <= 1.0001; x += 0.05) { const y = bardLook([x, x, x], flat)[0]; assert.ok(y >= last); last = y; }
	assert.ok(bardLook([0.3, 0.3, 0.3], flat)[0] < 0.3);
	assert.ok(bardLook([0.7, 0.7, 0.7], flat)[0] > 0.7);
	// a muted colour comes out more colourful
	const c = [0.45, 0.5, 0.6], g = bardLook(c, flat);
	assert.ok(g[2] - g[0] > c[2] - c[0]);
	// and a dark colour, next to none (a tree's shade at dusk kept going neon green)
	const d = [0.12, 0.16, 0.08], gd = bardLook(d, flat), l = (x) => x[0] * 0.2627 + x[1] * 0.678 + x[2] * 0.0593;
	const chroma = (x) => (Math.max(...x) - Math.min(...x)) / Math.max(l(x), 1e-6);
	assert.ok(chroma(gd) < chroma(d) * 1.08, `${chroma(gd)} vs ${chroma(d)}`);
	// skin's orange gains less of it
	const s = [0.6, 0.5, 0.4], spared = bardLook(s, flat), full = bardLook(s, { ...flat, skin: 0 });
	assert.ok(spared[0] - spared[2] < full[0] - full[2]);
});

test('the fog colour is tone mapped with the same look', () => {
	const sky = src('world/sky.js');
	assert.match(sky, /import \{ GRADE, bardLook \} from '\.\/grade\.js';/);
	assert.match(sky, /function agx\(c, exposure, out\) \{\n\texposure \*= GRADE\.exposure;/);
	assert.match(sky, /\tv = bardLook\(v\);\n\tv = mat3x\(AGX_M\[3\]/);
});

test('it is put in once, before the first material, and never by the frame', () => {
	const main = src('main.js');
	assert.match(main, /\ninstallAirFog\(\);\n\/\/ [^\n]*\ninstallGrade\(\);\n/);
	assert.ok(main.indexOf('installGrade();') < main.indexOf('createGraphicsRenderer({'));
	assert.doesNotMatch(src('island-frame.js'), /installGrade|GRADE/);
});
