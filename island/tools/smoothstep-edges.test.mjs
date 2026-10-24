// three's smoothstep(x, min, max) is not GLSL's: with its edges turned round it is 0 below min
// and 1 everywhere above it, never easing the other way. island-frame.js asked it for the
// clear coast south of Half Moon Bay that way round and got the whole East Bay instead, its
// air thinned to 0.45 (Mt Diablo from San Ramon, 2026-10-24). A fall is 1 - smoothstep(x, lo, hi).
//   node --test island/tools/smoothstep-edges.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);

test('every MathUtils.smoothstep with written edges has them low then high', () => {
	const bad = [];
	for (const f of files(src)) {
		const text = fs.readFileSync(f, 'utf8');
		for (const m of text.matchAll(/MathUtils\.smoothstep\(([^()]|\([^()]*\))*?,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)) {
			if (+m[2] >= +m[3]) bad.push(`${path.relative(src, f)}: ${m[0]}`);
		}
	}
	assert.deepEqual(bad, []);
});

test('the clear coast is south of Half Moon Bay and west of -122.3 only', () => {
	const frame = fs.readFileSync(path.join(src, 'island-frame.js'), 'utf8');
	const line = frame.split('\n').find((l) => /const clearK =/.test(l));
	assert.ok(line, 'clearK found');
	const at = (lat, lon) => {
		const S = (x, a, b) => (x <= a ? 0 : x >= b ? 1 : ((x - a) / (b - a)) ** 2 * (3 - 2 * (x - a) / (b - a)));
		const expr = line.replace(/^.*const clearK =/, '').replace(/;\s*$/, '').replaceAll('THREE.MathUtils.smoothstep', 'S');
		return new Function('S', 'lat', 'lon', `return ${expr};`)(S, lat, lon);
	};
	assert.equal(at(37.25, -122.4), 1, 'the coast below Half Moon Bay is clear');
	assert.equal(at(37.765, -122.0), 0, 'San Ramon is not');
	assert.equal(at(37.88, -122.27), 0, 'Berkeley is not');
	assert.equal(at(37.6, -122.5), 0, 'Pacifica is not');
});
