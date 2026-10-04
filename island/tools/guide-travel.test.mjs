import test from 'node:test';
import assert from 'node:assert/strict';
import { travelRequest, resolveTravel } from '../src/guide/travel.js';

const cities = [
	{ id: 'kyoto', name: 'Kyoto', lat: 35.0116, lon: 135.7681, country: 'Japan', regionName: 'Japan', pop: 3 },
	{ id: 'tokyo', name: 'Tokyo', lat: 35.6762, lon: 139.6503, country: 'Japan', regionName: 'Japan', pop: 6 },
	{ id: 'paris', name: 'Paris', lat: 48.8566, lon: 2.3522, country: 'France', regionName: 'France', pop: 6 },
];

test('travel language extracts generalized requests and paraphrases', () => {
	assert.equal(travelRequest('Could you take us over toward the Far East?'), 'the far east');
	assert.equal(travelRequest('Guide me somewhere in Japan, please'), 'japan');
	assert.equal(travelRequest('I feel like heading to Paris'), 'paris');
	assert.equal(travelRequest('Do not take me to Paris yet'), null);
});

test('broad regions resolve to an authored representative city', () => {
	const east = resolveTravel('the Far East', { cities });
	assert.equal(east.kind, 'destination');
	assert.equal(east.broad, true);
	assert.equal(east.place.name, 'Kyoto');
	assert.equal(east.place.lat, 35.0116);
});

test('country and city requests survive atlas loading and exact local places win', () => {
	assert.equal(resolveTravel('Japan', { cities }).place.name, 'Tokyo');
	const local = { name: 'the volcanic vent', x: 10, z: 20, kind: 'island' };
	assert.equal(resolveTravel('the vent', { cities, local: [local] }).kind, 'destination');
	assert.equal(resolveTravel('the volcanic vent', { cities, local: [local] }).place, local);
	assert.equal(resolveTravel('Kyoto', { cities }).place.name, 'Kyoto');
});

test('first-run fallback understands Far East before the lazy atlas arrives', () => {
	const r = resolveTravel('far east');
	assert.equal(r.kind, 'destination');
	assert.equal(r.place.name, 'Kyoto');
	assert.equal(r.place.country, 'Japan');
});

test('ambiguous and vague requests ask for a useful clarification', () => {
	assert.equal(resolveTravel('somewhere', { cities }).kind, 'clarify');
	assert.match(resolveTravel('somewhere', { cities }).message, /Far East/);
});

console.log('Guide travel: generalized language, authored atlas destinations and lazy-load fallback passed.');
