import test from 'node:test';
import assert from 'node:assert/strict';
import { rankOf, promoted, LADDERS } from '../src/gameplay/ranks.js';

test('ranks climb with the count and say what is next', () => {
	assert.equal(rankOf('favours', 0).title, 'Stranger');
	assert.equal(rankOf('favours', 1).title, 'Passer-by who helped');
	const r = rankOf('favours', 10); assert.equal(r.title, 'Familiar face'); assert.equal(r.next.title, 'Good neighbour'); assert.ok(r.k > 0.4 && r.k < 0.6);
	assert.equal(rankOf('fares', 1000).next, null); assert.equal(rankOf('fares', 1000).k, 1);
	assert.equal(promoted('fares', 9, 10), 'Regular'); assert.equal(promoted('fares', 10, 11), null);
	for (const L of Object.values(LADDERS)) for (let i = 1; i < L.steps.length; i++) assert.ok(L.steps[i][0] > L.steps[i - 1][0]);
});
