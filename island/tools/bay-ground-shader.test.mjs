import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../src/bay/terrain.js'), 'utf8');
const lite = source.match(/#ifdef GROUND_LITE_F([\s\S]*?)#else/)?.[1] || '';

test('phone-safe Bay ground keeps close-up texture and color treatment', () => {
	assert.ok(lite, 'the phone-safe ground branch must remain present');
	assert.match(lite, /nearK\s*=\s*1\.0\s*-\s*smoothstep\(18\.0,\s*105\.0,\s*dist\)/);
	assert.match(lite, /grainK\s*=\s*nearK/);
	assert.match(lite, /vec3 soil\s*=\s*mix/);
	assert.match(lite, /texture2D\(uLoam/);
	assert.match(lite, /uGroundK\s*>\s*0\.5/);
});

test('close-up treatment fades before the phone shader reaches its distant ground', () => {
	assert.match(lite, /smoothstep\(18\.0,\s*105\.0,\s*dist\)/);
	assert.match(lite, /smoothstep\(0\.12,\s*0\.34,\s*px\)/);
});
