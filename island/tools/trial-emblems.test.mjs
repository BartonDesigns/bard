import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIALS } from '../src/magic/trials.js';
import { TRIAL_EMBLEM_IDS, trialEmblem } from '../src/ui/trial-emblems.js';

test('each playable ascension trial has a distinct local vector emblem', () => {
	assert.deepEqual(TRIAL_EMBLEM_IDS, TRIALS.map(t => t.id));
	const art = TRIALS.map(t => trialEmblem(t.id));
	assert.equal(new Set(art).size, TRIALS.length);
	for (const svg of art) {
		assert.match(svg, /viewBox="0 0 32 32"/);
		assert.match(svg, /aria-hidden="true"/);
		assert.doesNotMatch(svg, /<image|<filter|<script|href=/);
	}
	assert.match(trialEmblem('wells', true), /#ffd27a/);
	assert.equal(trialEmblem('<script>'), '');
});
