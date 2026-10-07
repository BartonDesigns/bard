import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointments, placePhrases, parseGameTime } from '../src/people/appointments.js';
import { gatherRequest, defaultGatherTime, makeGathering, crowdSize, gatheringStage, memberWant, memberCome, memberGo, crowdLayout, ARRIVE, HOURS, LEAVE } from '../src/people/gatherings.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('requests are recognised with their kind', () => {
	assert.equal(gatherRequest('gather people for a concert at Golden Gate Park').kind, 'concert');
	assert.equal(gatherRequest('can you round up some folks for a picnic by the lake').kind, 'picnic');
	assert.equal(gatherRequest('throw a party at the plaza at 8pm').kind, 'party');
	assert.equal(gatherRequest('host a meet-up at the pier').kind, 'meetup');
	assert.equal(gatherRequest('bring people together at the village tonight').kind, 'meetup');
	assert.equal(gatherRequest('rally everyone at the square, we need a show').kind, 'concert');
	assert.equal(gatherRequest('meet me at the park at 6pm'), null);
	assert.equal(gatherRequest("don't throw a party"), null);
	assert.equal(gatherRequest('how are you'), null);
	assert.deepEqual(placePhrases('gather people for a concert at Golden Gate Park'), ['Golden Gate Park']);
	assert.equal(parseGameTime('gather people for a concert at Golden Gate Park', 10), null);
	assert.equal(parseGameTime('throw a party at the plaza at 8pm', 10).hours, 20);
});

test('default time: this evening, or an hour on when late', () => {
	assert.deepEqual(defaultGatherTime(10), { delta: 9, hours: 19, tomorrow: false });
	const late = defaultGatherTime(20.2);
	assert.equal(late.hours, 21.5); assert.ok(Math.abs(late.delta - 1.3) < 1e-9);
	assert.equal(defaultGatherTime(23.7).hours, 1);
});

test('crowd sizes respect place and phone caps', () => {
	for (let s = 1; s < 40; s++) {
		const big = crowdSize('concert', 'Golden Gate Park', false, s), phone = crowdSize('concert', 'Golden Gate Park', true, s), small = crowdSize('meetup', 'the corner', true, s);
		assert.ok(big >= 8 && big <= 25, big); assert.ok(phone <= 14 && phone >= 8); assert.ok(small >= 6 && small <= 8);
	}
	const g = makeGathering({ kind: 'picnic', placeName: 'the lake', seed: 5 });
	assert.equal(g.title, 'Picnic'); assert.ok(g.size >= 8 && g.size <= 12);
});

test('timetable: arrivals spread, everyone gone after the end', () => {
	const a = { due: 19, gathering: makeGathering({ kind: 'concert', placeName: 'park', seed: 9 }) };
	assert.equal(gatheringStage(a, 18), 'before'); assert.equal(gatheringStage(a, 18.7), 'arriving');
	assert.equal(gatheringStage(a, 19.5), 'on'); assert.equal(gatheringStage(a, 20.1), 'dispersing'); assert.equal(gatheringStage(a, 21), 'over');
	const comes = [...Array(a.gathering.size).keys()].map(i => memberCome(a, i));
	assert.ok(Math.min(...comes) >= 19 - ARRIVE && Math.max(...comes) <= 19 + ARRIVE * 0.2);
	assert.ok(new Set(comes.map(c => c.toFixed(3))).size === comes.length);
	const here = t => [...Array(a.gathering.size).keys()].filter(i => memberWant(a, i, t) === 1).length;
	assert.ok(here(18.6) > 0 && here(18.6) < a.gathering.size, 'arriving over time');
	assert.equal(here(19.3), a.gathering.size);
	assert.equal(here(19 + HOURS + LEAVE), 0);
	for (let i = 0; i < a.gathering.size; i++) assert.ok(memberGo(a, i) >= 19 + HOURS);
});

test('layout: no two people on top of each other, concert crowd in front of the stage', () => {
	for (const kind of ['concert', 'party', 'picnic', 'meetup']) {
		const n = 20, L = crowdLayout(kind, n, 3);
		for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(L[i * 3] - L[j * 3], L[i * 3 + 1] - L[j * 3 + 1]) > 0.5, kind);
		if (kind === 'concert') for (let i = 0; i < n; i++) { assert.ok(L[i * 3 + 1] > 3); assert.ok(Math.abs(L[i * 3 + 2]) > Math.PI / 2); }
	}
});

test('state machine: go, due, joined, kept; saved and restored', () => {
	const storage = mem();
	const B = createAppointments({ storage });
	const place = { name: 'Golden Gate Park', pos: { x: 100, z: 0, y: 2 }, radius: 14 };
	const gathering = makeGathering({ kind: 'concert', placeName: place.name, seed: 4 });
	const r = B.make({ bodyKey: 'earth', npcId: 'n1', npcName: 'Ana Lee', place, hours: 10, delta: 9, gathering });
	assert.ok(r.ok); assert.equal(r.appointment.gathering.kind, 'concert'); assert.equal(r.appointment.place.radius, 20);
	const away = { x: 0, z: 0 };
	assert.deepEqual(B.tick({ hours: 17, bodyKey: 'earth', player: away }), []);
	assert.deepEqual(B.tick({ hours: 17.95, bodyKey: 'earth', player: away }).map(e => e.type), ['go']);
	assert.deepEqual(B.tick({ hours: 18.45, bodyKey: 'earth', player: away }).map(e => e.type), ['due']);
	// still running while the player stays away; restored from the save
	const B2 = createAppointments({ storage });
	assert.equal(B2.list('earth')[0].gathering.size, gathering.size);
	assert.deepEqual(B2.tick({ hours: 19.2, bodyKey: 'earth', player: { x: 110, z: 0 } }).map(e => e.type), ['joined']);
	assert.deepEqual(B2.tick({ hours: 19.6, bodyKey: 'earth', player: { x: 110, z: 0 } }), []);
	assert.equal(B2.list('earth')[0].status, 'agreed', 'kept going for its hour');
	assert.deepEqual(B2.tick({ hours: 20.1, bodyKey: 'earth', player: away }).map(e => e.type), ['kept']);
	B2.mention(B2.list('earth')[0].id);
	assert.equal(createAppointments({ storage }).list('earth')[0].mentioned, true);
});

test('it happens without the player and is remembered as missed', () => {
	const B = createAppointments({ storage: mem() });
	const place = { name: 'the plaza', pos: { lat: 37.77, lon: -122.45, y: 2 }, radius: 12 };
	B.make({ bodyKey: 'earth', npcId: 'n2', npcName: 'Bo', place, hours: 20, delta: 1, gathering: makeGathering({ kind: 'party', placeName: 'the plaza', seed: 2 }) });
	const types = [];
	for (let h = 20; h <= 22.6; h += 0.1) types.push(...B.tick({ hours: h, bodyKey: 'earth', player: { lat: 37.9, lon: -122.45 } }).map(e => e.type));
	assert.deepEqual(types, ['go', 'due', 'missed']);
	// across midnight too
	const C = createAppointments({ storage: mem() });
	C.make({ bodyKey: 'earth', npcId: 'n3', npcName: 'Cy', place, hours: 23, delta: 1, gathering: makeGathering({ kind: 'meetup', placeName: 'x', seed: 1 }) });
	const t2 = [];
	for (let h = 23; h < 26.5; h += 0.1) t2.push(...C.tick({ hours: h % 24, bodyKey: 'earth', player: null }).map(e => e.type));
	assert.deepEqual(t2, ['go', 'due', 'missed']);
	// a broken gathering record is refused
	assert.equal(C.make({ bodyKey: 'earth', npcId: 'n4', npcName: 'D', place, hours: 1, delta: 1, gathering: { kind: 'rave', size: 5, seed: 1 } }).ok, false);
});
