// The V1 runtimes ship baked: their source is plain text in runtime/src and the page fetches
// the packed copies. These keep the two in step, and keep the page from patching a runtime
// at load again.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { check, RUNTIMES } from '../../tools/pack-runtimes.mjs';

const page = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('every packed runtime holds its source, and the page loads it by its current stamp', () => {
	assert.ok(RUNTIMES.length >= 1);
	assert.deepEqual(check(), []);
});

test('the page no longer rewrites the world core as it loads it', () => {
	assert.equal(page.split('patchCore').length - 1, 0);
	assert.doesNotMatch(page, /world-core-179/);
	const boot = page.slice(page.indexOf('function core(){'), page.indexOf('function ensureWorld(){'));
	assert.match(boot, /execute\(blocks\[coreAt\]\)/);
	assert.doesNotMatch(boot, /\.patch\(|\.replace\(|\.split\(/);
});
