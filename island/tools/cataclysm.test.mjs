// The catastrophes' rules (island/src/cataclysm/schedule.js, front.js): rare, the same for a
// seed, region-scoped, quiet between; quakes that break the weak before the strong; a fire
// that runs downwind and uphill and is held by water.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { envOf, chancesFor, eventFor, upcoming, due, QUIET, DAY, magnitudeOf, quakeRadius, shakeAt, quakeDuration, aftershocks, damageFor, phaseOf, headline, dryness, LATE } from '../src/cataclysm/schedule.js';
import { createFront } from '../src/cataclysm/front.js';

const bay = envOf({ earth: true, bay: true, month: 8, wild: 0.6 });
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

test('the same seed, region and day give the same event', () => {
	for (let d = 0; d < 400; d++) assert.deepEqual(eventFor(1337, 'bay.east', d, bay), eventFor(1337, 'bay.east', d, bay));
	const a = upcoming(1337, 'bay.east', 0, 2000, bay), b = upcoming(1337, 'bay.east', 0, 2000, bay);
	assert.deepEqual(a, b);
	assert.notDeepEqual(a, upcoming(99, 'bay.east', 0, 2000, bay));
	assert.notDeepEqual(a, upcoming(1337, 'bay.south', 0, 2000, bay));
});

test('catastrophes are rare and spaced by the quiet', () => {
	const list = upcoming(1337, 'bay.east', 0, 3650, bay);
	// a few a year of game days at most, and at least some over ten years
	assert.ok(list.length > 5 && list.length < 3650 / 25, `count ${list.length}`);
	for (let i = 1; i < list.length; i++) assert.ok(list[i].start - list[i - 1].start >= QUIET);
	for (const ev of list) { assert.ok(ev.start >= ev.day * DAY && ev.start < (ev.day + 1) * DAY); assert.ok(ev.severity >= 0 && ev.severity <= 1); }
});

test('the land decides the kinds', () => {
	const kinds = (env) => new Set(upcoming(7, 'r', 0, 20000, env).map((e) => e.kind));
	assert.deepEqual([...kinds(envOf({ planet: 'MAGMA' }))].sort(), ['eruption', 'quake']);
	assert.ok(!kinds(bay).has('eruption'));
	assert.ok(kinds(bay).has('quake') && kinds(bay).has('wildfire'));
	assert.deepEqual([...kinds(envOf({ planet: 'TERRAN' }))], ['quake']);
	// no wildfires to speak of in the wet months, many in the dry
	const wet = chancesFor(envOf({ earth: true, bay: true, month: 2 })).find((c) => c.kind === 'wildfire').p;
	const dry = chancesFor(envOf({ earth: true, bay: true, month: 9 })).find((c) => c.kind === 'wildfire').p;
	assert.ok(dry > wet * 5);
	assert.ok(dryness(8) > dryness(1));
});

test('due: met once, in its window, never in the quiet', () => {
	const ev = upcoming(1337, 'bay.east', 0, 3650, bay)[0];
	assert.equal(due(1337, 'bay.east', ev.start - 0.1, bay), null);
	assert.deepEqual(due(1337, 'bay.east', ev.start + 0.1, bay), ev);
	assert.equal(due(1337, 'bay.east', ev.start + LATE + 0.1, bay), null);
	assert.equal(due(1337, 'bay.east', ev.start + 0.1, bay, { seen: new Set([ev.id]) }), null);
	assert.equal(due(1337, 'bay.east', ev.start + 0.1, bay, { lastAt: ev.start - 10 }), null);
	// a rate for the console makes them common
	assert.ok(upcoming(5, 'x', 0, 365, bay, 40).length > upcoming(5, 'x', 0, 365, bay).length);
});

test('quakes: bigger reaches further, shaking falls off, the weak break first', () => {
	assert.ok(magnitudeOf(0) >= 5.3 && magnitudeOf(1) <= 7.7);
	assert.ok(quakeRadius(7) > quakeRadius(6));
	assert.ok(quakeDuration(7) > quakeDuration(5.5));
	assert.ok(shakeAt(7, 0) > shakeAt(7, 500) && shakeAt(7, 500) > shakeAt(7, 3000));
	assert.ok(shakeAt(7.5, 100) > shakeAt(5.5, 100));
	assert.equal(shakeAt(5.4, 5000), 0);
	const tally = (tough) => { let bad = 0; for (let i = 0; i < 1000; i++) { const d = damageFor(0.95, tough, 8, i / 1000); if (d === 'partial' || d === 'collapse') bad++; } return bad; };
	assert.ok(tally(0.75) > tally(1.8), 'a timber house fares worse than a steel tower');
	for (let i = 0; i < 100; i++) assert.equal(damageFor(0.05, 1, 8, i / 100), 'none');
	const as = aftershocks(42, 7.0);
	assert.ok(as.length >= 4);
	for (let i = 1; i < as.length; i++) assert.ok(as[i].t >= as[i - 1].t);
	assert.ok(as.every((a) => a.mag < 7.0 - 1));
});

test('phases run their course', () => {
	const q = { kind: 'quake', magnitude: 6.5, severity: 0.5 };
	assert.equal(phaseOf(q, 1), 'shaking');
	assert.equal(phaseOf(q, quakeDuration(6.5) + 5), 'aftermath');
	assert.equal(phaseOf(q, 5000), 'over');
	const f = { kind: 'wildfire', severity: 0.5 };
	assert.equal(phaseOf(f, 10), 'burning');
	assert.equal(phaseOf(f, 100, 90), 'aftermath');
	assert.equal(phaseOf(f, 90 + 241, 90), 'over');
	assert.equal(phaseOf({ kind: 'eruption', severity: 0.5 }, 10), 'ash');
	assert.match(headline(q, 'the East Bay'), /magnitude 6\.5: the East Bay/);
});

test('a fire front spreads downwind and uphill, and water holds it', () => {
	const run = (wind, heightAt = () => 0) => {
		const F = createFront({ cell: 10, fuelAt: () => 0.9, heightAt, rand: mulberry(3), maxCells: 5000, maxBurning: 5000 });
		F.ignite(5, 5);
		for (let t = 0; t < 60; t++) F.step(0.5, wind);
		let east = 0, west = 0;
		for (const c of F.cells.values()) if (c.s) { if (c.x > 5) east++; else if (c.x < 5) west++; }
		return { F, east, west };
	};
	const w = run({ x: 1, z: 0, speed: 1.2 });
	assert.ok(w.east > w.west * 1.5, `downwind ${w.east} upwind ${w.west}`);
	const hill = run({ x: 0, z: 1, speed: 0 }, (x) => x * 0.4);
	assert.ok(hill.east > hill.west, `uphill ${hill.east} downhill ${hill.west}`);
	// nothing on water or roofs
	const wet = createFront({ fuelAt: () => 0, rand: mulberry(1) });
	assert.equal(wet.ignite(0, 0), null);
	// water puts the cells out, and they stay out
	const F = w.F, before = F.burning.size;
	assert.ok(before > 0);
	const ext = F.extent();
	for (let k = 0; k < 40; k++) F.douse(ext.x, ext.z, ext.r + 20, 0.2);
	assert.equal(F.burning.size, 0);
	assert.ok(F.held());
	const c = [...F.cells.values()].find((q) => q.s === 3);
	assert.ok(c && F.ignite(c.x, c.z) === null);
});

test('a fire is bounded by its cells', () => {
	const F = createFront({ cell: 10, fuelAt: () => 1, rand: mulberry(9), maxCells: 60, maxBurning: 30 });
	F.ignite(0, 0);
	for (let t = 0; t < 400; t++) F.step(0.5, { x: 0.7, z: 0.7, speed: 1.5 });
	assert.ok(F.stats().lit <= 60);
	assert.ok(F.full() || F.held());
});
