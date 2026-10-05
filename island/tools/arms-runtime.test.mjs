import test from 'node:test';
import assert from 'node:assert/strict';
import { createArmsRuntime, parseArmsRequest } from '../src/crysis/arms-runtime.js';

test('natural gear requests resolve to the canonical gameplay catalog', () => {
	assert.equal(parseArmsRequest('Could you help me buy a rifle at the supermarket?').kind, 'purchase');
	assert.equal(parseArmsRequest('Could you help me buy a rifle at the supermarket?').item, 'aurora-trail-rifle');
	assert.equal(parseArmsRequest('Can we secure the carbine at the police station?').item, 'warden-spark-carbine');
	assert.equal(parseArmsRequest('Let’s go hunting with the bow near the outfitter').item, 'reedline-hunting-bow');
});

test('negations and ordinary weapon mentions do not mutate state', () => {
	assert.equal(parseArmsRequest("Don't steal a rifle from the police station").kind, 'none');
	assert.equal(parseArmsRequest('I have a rifle at home').kind, 'none');
	assert.equal(parseArmsRequest('What gear is available nearby?').kind, 'describe');
});

test('dynamic world-site functions expose streamed shops and stateful actions', () => {
	const siteRecords = [
		{ id: 'market-1', name: 'Valley supermarket', kind: 'supermarket', x: 40, z: 0, actions: ['purchase'] },
		{ id: 'station-1', name: 'North police station', kind: 'police', x: 8, z: 0, actions: ['secure'] },
		{ id: 'ranger-1', name: 'Ranger outfitter', kind: 'outfitter', x: 20, z: 0, actions: ['purchase', 'hunt'] },
	];
	const arms = createArmsRuntime({ world: () => ({ worldSites: () => siteRecords }), sites: (W) => W.worldSites, radius: 100, startingCredits: 1000, now: () => 42 });
	assert.deepEqual(arms.nearby({ x: 0, z: 0 }).map((s) => s.id), ['station-1', 'ranger-1', 'market-1']);
	const bought = arms.command('Could you get a rifle from the supermarket?', { position: { x: 0, z: 0 } });
	assert.equal(bought.ok, true);
	assert.equal(bought.state.items.find((item) => item.itemId === 'aurora-trail-rifle').quantity, 1);
	const secured = arms.command('Secure a carbine at the police station', { position: { x: 0, z: 0 }, successRoll: 0, detectionRoll: 0.99 });
	assert.equal(secured.ok, true);
	assert.equal(secured.state.items.find((item) => item.itemId === 'warden-spark-carbine').quantity, 1);
	const bowPurchase = arms.command('Buy a bow from the outfitter', { position: { x: 0, z: 0 } });
	assert.equal(bowPurchase.ok, true);
	const hunt = arms.command('I want to hunt with the bow', { position: { x: 0, z: 0 } });
	assert.equal(hunt.ok, true);
	assert.equal(hunt.hunt.activity, 'hunting');
});

test('unsupported source actions fail closed without changing inventory', () => {
	const arms = createArmsRuntime({ sites: () => [{ id: 'home', name: 'Home', kind: 'home', x: 0, z: 0, actions: ['secure'] }], startingCredits: 1000 });
	const before = arms.state();
	const result = arms.command('Buy a rifle at home', { position: { x: 0, z: 0 } });
	assert.equal(result.ok, false);
	assert.deepEqual(arms.state().items, before.items);
});

console.log('Crysis arms runtime: canonical catalog, dynamic source discovery, conversational actions and fail-closed state passed.');
