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

test('the page no longer rewrites the flight engine as it loads it', () => {
	assert.equal(page.split('patchFlight').length - 1, 0);
	assert.doesNotMatch(page, /flight-179/);
	const boot = page.slice(page.indexOf('async function flight(){'), page.indexOf('function openFlight(){'));
	// the vendor imports still point at blob addresses; nothing else changes the text
	assert.match(boot, /rewrite\(files\[1\],resolved\)/);
	assert.doesNotMatch(boot, /cachedPatch|\.patch\(/);
});

test('the page no longer rewrites the V1 caves document, or keeps patched copies on the device', () => {
	assert.equal(page.split('patchCaves').length - 1, 0);
	assert.doesNotMatch(page, /caves-179|cachedPatch/);
	assert.match(page, /S\.source = function\(\)\{return window\.L99Boot176\.packed\('caves-235\.html\.gz\?v=[0-9a-f]+'\);\};/);
});
