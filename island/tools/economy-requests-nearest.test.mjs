// A place's requests reach for the nearest others round it (economy/requests.js): the nearest 8
// past a street's length picked without sorting the whole registry must be the very 8, in the
// very order, that sorting all of it steadily gave, ties and places off at infinity included.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestPast, requestsFor } from '../src/economy/requests.js';

function rng(seed) { let h = seed >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; }
// the old way: every one past far, sorted by distance (a steady sort), the first n
const sorted = (d, far, n) => d.map((v, i) => i).filter((i) => d[i] > far).sort((a, b) => d[a] - d[b]).slice(0, n);

test('the nearest past far are the ones a steady sort of all gave, in its order', () => {
	const r = rng(5);
	for (let k = 0; k < 2000; k++) {
		const N = Math.floor(r() * 60), far = r() < 0.2 ? 0 : 120;
		// (distances on a coarse grid, so they tie; some at infinity, some not numbers)
		const d = Array.from({ length: N }, () => { const u = r(); return u < 0.05 ? Infinity : u < 0.08 ? NaN : Math.round(r() * 40) * 10; });
		for (const n of [1, 4, 8]) assert.deepEqual(nearestPast(d, far, n), sorted(d, far, n), `${d} past ${far}, ${n}`);
	}
});

test('a downtown registry gives the same requests, place by place', () => {
	const r = rng(9), TYPES = ['cafe', 'diner', 'bakery', 'pub', 'tech', 'finance', 'grocer', 'hardware', 'hotel', 'general', 'salon', 'pharmacy', 'brewery', 'laundromat'];
	const places = [];
	for (let i = 0; i < 1500; i++) { const x = Math.round(r() * 30) * 20, z = Math.round(r() * 30) * 20; places.push({ id: 'p' + i, name: 'Place ' + i, type: TYPES[i % TYPES.length], x, z, door: [x + 1, z], locale: 'us-ca' }); }
	const homes = Array.from({ length: 30 }, () => ({ x: r() * 600, z: r() * 600 }));
	let parcels = 0;
	for (let k = 0; k < 200; k++) {
		const E = places[k * 7], day = k % 9;
		const got = requestsFor(E, places, { day, now: 1, homes });
		// (and asked again, the same)
		assert.deepEqual(requestsFor(E, places, { day, now: 1, homes }), got);
		for (const R of got) {
			if (R.kind !== 'parcels' && R.kind !== 'flyers') continue;
			parcels++;
			// whoever it sends you to is among the 8 nearest past 120 m (220 m for a second stop)
			const others = places.filter((p) => p.id !== E.id), d = others.map((p) => Math.hypot(p.x - E.x, p.z - E.z));
			const near8 = new Set(sorted(d, 120, 8).map((i) => others[i].id)), near8b = new Set(sorted(d, 220, 8).map((i) => others[i].id));
			const to = R.steps.filter((s) => s.do === 'deliver' || s.do === 'talk').map((s) => s.at.establishmentId);
			assert.ok(near8.has(to[0]), `${R.kind} to ${to[0]}`);
			if (R.kind === 'flyers') assert.ok(near8b.has(to[1]), `${R.kind} to ${to[1]}`);
		}
	}
	assert.ok(parcels > 5, `${parcels} sent to another`);
});
