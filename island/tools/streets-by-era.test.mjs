import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS, eraOfYear, yearOf, guessEra, gridRegularity, oldTownAt, kitFor, treeFor, treeRow, holeRate, SPECIES, eraMap } from '../src/bay/streetera.js';
import { thanksgiving, lightsUp, houseLights, lightsK, dryMonth, sprinklerRun, sprinkling, autumnK, leafDrift, crownColour, lawnDry } from '../src/bay/seasons.js';
import { holesFor, lanesOf, eraCode, holeId } from '../src/bay/potholes.js';
import { offerFor, lineFor, step, rewardFor } from '../src/people/errands-core.js';
import { toWorld } from '../src/bay/geo.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);

test('start dates make the era when the map has them', () => {
	assert.equal(yearOf('1923'), 1923); assert.equal(yearOf('c. 1910'), 1910); assert.equal(yearOf('1920s'), 1925); assert.equal(yearOf('2014-06-01'), 2014); assert.ok(Number.isNaN(yearOf('')));
	assert.equal(eraOfYear(1890, true), 'historic'); assert.equal(eraOfYear(1890), 'prewar'); assert.equal(eraOfYear(1938), 'prewar');
	assert.equal(eraOfYear(1958), 'postwar'); assert.equal(eraOfYear(1992), 'tract'); assert.equal(eraOfYear(2018), 'new');
	// three or more dates outvote every guess
	assert.equal(guessEra({ years: ['1955', '1961', 1958], prior: 'modern', oldTown: 2 }), 'postwar');
	assert.equal(guessEra({ years: [1905, 1908, 1899], dense: 0.6 }), 'historic');
});

test('without dates: an old core is historic, its streets older, cul-de-sacs and the far suburbs newer', () => {
	assert.equal(guessEra({ prior: 'ranch', dense: 0.6, oldTown: 2, regular: 0.9 }), 'historic');
	assert.equal(guessEra({ prior: 'ranch', oldTown: 1, regular: 0.9 }), 'prewar');
	assert.equal(guessEra({ prior: 'ranch', regular: 0.6 }), 'postwar');
	assert.equal(guessEra({ prior: 'tract', regular: 0.3, culs: 4 }), 'new');
	assert.equal(guessEra({ prior: 'modern', culs: 2 }), 'new');
	assert.equal(guessEra({ prior: 'tract', culs: 0, regular: 0.6 }), 'tract');
	// a grown town by distance from its centre
	assert.equal(guessEra({ prior: 'tract', dense: 0.5, regular: 0.8, coreDist: 200 }), 'historic');
	const near = ERAS.indexOf(guessEra({ prior: 'ranch', coreDist: 400 })), far = ERAS.indexOf(guessEra({ prior: 'ranch', coreDist: 3000 }));
	assert.ok(near < far, `${near} < ${far}`);
	// every answer is an era
	for (const prior of ['prewar', 'ranch', 'split', 'tract', 'modern']) for (const culs of [0, 1, 4]) for (const oldTown of [0, 1, 2]) assert.ok(ERAS.includes(guessEra({ prior, culs, oldTown, regular: 0.5 })));
});

test('a square grid reads as regular, a tangle of curves does not', () => {
	const grid = [];
	for (let i = 0; i < 5; i++) { grid.push([i * 100, 0, i * 100, 400]); grid.push([0, i * 100, 400, i * 100]); }
	assert.ok(gridRegularity(grid) > 0.95);
	// the same grid turned 30 degrees is still a grid
	const c = Math.cos(0.52), s = Math.sin(0.52), turn = grid.map(([a, b, x, y]) => [a * c - b * s, a * s + b * c, x * c - y * s, x * s + y * c]);
	assert.ok(gridRegularity(turn) > 0.95);
	const curvy = [];
	for (let k = 0; k < 40; k++) { const a0 = k * 0.37, a1 = a0 + 0.3; curvy.push([Math.cos(a0) * 200, Math.sin(a0) * 200, Math.cos(a1) * 200, Math.sin(a1) * 200]); }
	assert.ok(gridRegularity(curvy) < 0.5, String(gridRegularity(curvy)));
});

test('the old towns: Old Town Danville is a core, San Ramon\'s new tracts are not old at all', () => {
	const hartz = toWorld(37.8216, -121.999), windemere = toWorld(37.765, -121.905), mission = toWorld(37.76, -122.42);
	assert.equal(oldTownAt(hartz.x, hartz.z), 2);
	assert.equal(oldTownAt(windemere.x, windemere.z), 0);
	assert.ok(oldTownAt(mission.x, mission.z) >= 1);
});

test('each era plants its own street: wells and grates downtown, stakes in the new tracts, big trees on old streets', () => {
	assert.equal(kitFor('historic').walk, 'brick'); assert.equal(kitFor('historic').lamp, 'acorn'); assert.ok(kitFor('historic').well);
	assert.equal(kitFor('new').lamp, 'led'); assert.ok(kitFor('new').stake); assert.equal(kitFor('tract').curb, 'rolled');
	let oldH = 0, newH = 0, palms = 0, fogPalms = 0;
	for (let i = 0; i < 400; i++) {
		const r = (k) => ((i * 7919 + k * 104729) % 1000) / 1000;
		const o = treeFor('prewar', r(1), r(2), 0.9), n = treeFor('new', r(1), r(2), 0.9);
		oldH += o.h; newH += n.h;
		assert.ok(SPECIES[o.species] && SPECIES[n.species]);
		assert.ok(n.stake); assert.ok(!o.stake);
		if (treeFor('tract', r(1), r(2), r(3)).species === 'palm') palms++;
		if (treeFor('tract', r(1), r(2), r(3), 1).species === 'palm') fogPalms++;
	}
	assert.ok(oldH / 400 > 13 && newH / 400 < 5.5, `${oldH / 400} ${newH / 400}`);
	assert.ok(palms > 30 && fogPalms < palms, `${palms} ${fogPalms}`);
	// the new rows are evenly spaced; the old ones gappier
	let h = 1;
	const rnd = () => (h = (h * 16807) % 2147483647) / 2147483647;
	const nw = treeRow('new', 500, rnd), od = treeRow('prewar', 500, rnd);
	const gaps = (a) => a.slice(1).map((s, k) => s - a[k]);
	const spread = (g) => Math.max(...g) / Math.min(...g);
	assert.ok(spread(gaps(nw)) < spread(gaps(od)), 'string-straight new rows');
	assert.ok(nw.length > 40 && od.length < nw.length);
});

test('potholes: more on old let-go streets, none on new ones or freeways, the same every time, in the wheel paths', () => {
	assert.ok(holeRate('prewar', 'residential', 1) > holeRate('new', 'residential', 1) * 10);
	assert.equal(holeRate('postwar', 'motorway', 1), 0);
	const pts = new Float32Array([0, 0, 400, 0, 400, 300]);
	const road = (cls = 'residential') => ({ cls, w: 10.5, drive: true, pts });
	const old = holesFor(road(), { key: 'prewar', neglect: 0.9 }), again = holesFor(road(), { key: 'prewar', neglect: 0.9 });
	assert.ok(old.length >= 6, String(old.length));
	assert.deepEqual(old.map((h) => h.id), again.map((h) => h.id));
	const fresh = holesFor(road(), { key: 'new', neglect: 0.2 });
	assert.ok(fresh.length < old.length / 4);
	assert.equal(holesFor({ ...road('motorway') }, { key: 'prewar', neglect: 1 }).length, 0);
	assert.equal(holesFor({ ...road(), bridge: true }, { key: 'prewar', neglect: 1 }).length, 0);
	const lanes = lanesOf(road());
	for (const h of old) {
		assert.ok(Math.abs(h.o) < 10.5 / 2 - 0.4);
		assert.ok(lanes.some((c) => Math.abs(Math.abs(h.o - c) - 0.85) < 0.6), `in a wheel path: ${h.o}`);
		assert.ok(h.r > 0.1 && h.r < 0.6 && h.d > 0.02 && h.d < 0.11);
		assert.equal(h.id, holeId(h.x, h.z));
	}
	// the era code: era and bearing, half a turn the same
	assert.equal(eraCode(2, 1, 0), 96); assert.equal(eraCode(2, -1, 0), 96); assert.equal(eraCode(0, 0, 1), 24);
	assert.ok(eraCode(4, Math.cos(3), Math.sin(3)) < 240);
});

test('the era map reads a region once per neighbourhood and leans on the street pattern', () => {
	const roads = [];
	for (let i = 0; i < 6; i++) { roads.push({ cls: 'residential', drive: true, w: 10, pts: new Float32Array([i * 60, 0, i * 60, 300]) }); roads.push({ cls: 'residential', drive: true, w: 10, pts: new Float32Array([0, i * 60, 300, i * 60]) }); }
	let asks = 0;
	const real = { near: (k) => (asks++, k === 'roads' ? roads : []), landAt: () => ({ lu: 1, road: 0, roof: 0 }), version: () => 1 };
	const M = eraMap(real);
	const a = M.at(120, 120), n = asks;
	assert.ok(ERAS.includes(a.key));
	assert.equal(M.at(130, 140), a, 'the same cell is kept');
	assert.equal(asks, n);
	assert.equal(M.ofRoad(roads[0]), M.ofRoad(roads[0]));
	assert.equal(eraMap(real), M);
});

test('the holiday lights go up the day after Thanksgiving and come down after Twelfth Night', () => {
	assert.equal(thanksgiving(2026), 26); assert.equal(thanksgiving(2025), 27); assert.equal(thanksgiving(2024), 28);
	assert.equal(lightsUp(D(2026, 11, 26)), false); assert.equal(lightsUp(D(2026, 11, 27)), true);
	assert.equal(lightsUp(D(2026, 12, 15)), true); assert.equal(lightsUp(D(2027, 1, 6)), true); assert.equal(lightsUp(D(2027, 1, 7)), false);
	assert.equal(lightsUp(D(2026, 10, 14)), false); assert.equal(lightsUp(D(2026, 7, 4)), false);
	// most houses, the same ones every night, and none out of season
	let lit = 0;
	for (let s = 0; s < 1000; s++) { const k = houseLights(s * 7919, D(2026, 12, 10)); if (k) lit++; assert.equal(k, houseLights(s * 7919, D(2026, 12, 20))); assert.equal(houseLights(s * 7919, D(2026, 9, 1)), 0); }
	assert.ok(lit > 450 && lit < 650, String(lit));
	assert.equal(lightsK(0), 0); assert.equal(lightsK(1), 1); assert.ok(lightsK(0.4) > 0 && lightsK(0.4) < 1);
});

test('sprinklers run on dry-month mornings and the patch dries after', () => {
	assert.ok(dryMonth(6) && dryMonth(4) && dryMonth(9)); assert.ok(!dryMonth(0) && !dryMonth(11) && !dryMonth(2));
	for (let i = 0; i < 50; i++) { const { start, len } = sprinklerRun(i / 50); assert.ok(start >= 5 && start + len <= 7.8, `${start} ${len}`); }
	const r = 0.3, { start, len } = sprinklerRun(r);
	assert.equal(sprinkling(r, start - 0.1, 6).on, false);
	assert.equal(sprinkling(r, start + len / 2, 6).on, true);
	assert.equal(sprinkling(r, start + len / 2, 0).on, false, 'not in January');
	assert.ok(sprinkling(r, start + len + 0.5, 6).wet > 0.5);
	assert.equal(sprinkling(r, start + len + 2.5, 6).wet, 0);
	assert.equal(sprinkling(r, 13, 6).on, false);
});

test('autumn colours the deciduous trees, the leaves lie under them after, and late summer browns the lawns', () => {
	assert.equal(autumnK(D(2026, 7, 1)), 0); assert.ok(autumnK(D(2026, 10, 20)) > 0.2 && autumnK(D(2026, 10, 20)) < 1);
	assert.equal(autumnK(D(2026, 12, 1)), 1); assert.equal(autumnK(D(2026, 3, 1)), 0);
	assert.ok(leafDrift(D(2026, 11, 25)) > 0.5); assert.equal(leafDrift(D(2026, 8, 1)), 0); assert.ok(leafDrift(D(2027, 1, 3)) > 0.3);
	const c = crownColour([0.3, 0.4, 0.15], [0.9, 0.7, 0.05], 1);
	assert.ok(c.every((v, i) => Math.abs(v - [0.9, 0.7, 0.05][i]) < 1e-9));
	assert.deepEqual(crownColour([0.3, 0.4, 0.15], null, 1), [0.3, 0.4, 0.15]);
	assert.ok(lawnDry(D(2026, 8, 20)) > 0.6 && lawnDry(D(2026, 2, 1)) === 0);
});

test('the pothole favour: asked, accepted, reported where it is, paid', () => {
	assert.equal(offerFor({ who: { first: 'Ana' }, kinds: ['pothole'] }), null, 'only with a pothole found');
	const o = offerFor({ who: { first: 'Ana', seed: 5 }, kinds: ['pothole'], pothole: { street: 'Hartz Avenue' }, dir: 'up ahead of you' });
	assert.equal(o.kind, 'pothole'); assert.match(o.ask, /pothole/); assert.match(o.title, /Hartz Avenue/); assert.doesNotMatch(o.ask, /—/);
	let E = { ...o, stage: 'offered' };
	assert.equal(step(E, 'reported').out, null, 'not before saying yes');
	let r = step(E, 'accept'); E = r.E; assert.equal(E.stage, 'report');
	assert.ok(lineFor('accept', { kind: 'pothole' }).length > 0);
	r = step(E, 'reported'); assert.equal(r.out.done, true); assert.equal(r.out.say, 'reported');
	assert.ok(lineFor('reported', { n: 1 }).length > 10);
	assert.equal(step(E, 'away').E.stage, 'failed');
	assert.ok(rewardFor('pothole', 80) >= 25 && rewardFor('pothole', 80) <= 140);
});

test('the businesses ask it too: a pothole near a shop is on the board, and done it sends the crew', async () => {
	const { requestsFor, createBoard, setPotholeSource } = await import('../src/economy/requests.js');
	const E = { id: 'e1', name: 'Hartz Hardware', type: 'hardware', x: 0, z: 0, locale: 'us' };
	const hole = { id: '10:4', x: 5, z: 2, street: 'Hartz Avenue' };
	let seen = null;
	for (let day = 0; day < 40 && !seen; day++) seen = requestsFor(E, [E], { day, hole }).find((R) => R.kind === 'pothole');
	assert.ok(seen, 'asked on some days');
	assert.match(seen.title, /pothole on Hartz Avenue/); assert.equal(seen.steps[0].at.holeId, '10:4'); assert.equal(seen.hole, hole);
	for (let day = 0; day < 10; day++) assert.equal(requestsFor(E, [E], { day }).filter((R) => R.kind === 'pothole').length, 0, 'none without a hole');
	const reported = [];
	setPotholeSource({ near: () => hole, report: (h) => reported.push(h.id) });
	try {
		let R = null;
		for (let d = 0; d < 40 && !R; d++) {
			const b = createBoard({ near: () => [E], clock: () => d * 86400000 + 1000, payroll: { payFrom: () => 12 } });
			R = b.near(0, 0, 100).find((q) => q.kind === 'pothole');
			if (R) { b.take(R.id, 'player'); assert.equal(b.complete(R.id, 'player', 'done').ok, true); }
		}
		assert.ok(R, 'on the board some day');
		assert.deepEqual(reported, ['10:4']);
	} finally { setPotholeSource(null); }
});
