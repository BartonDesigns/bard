import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGameTime, realSecondsFor, createAppointments, talksOfMeeting, placePhrases, formatClock, MEET_TAG_RE } from '../src/people/appointments.js';

const sun = { rise: 6.5, set: 19.5 };
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('spoken times become game hours from now', () => {
	assert.equal(parseGameTime('meet me at 6pm', 10, sun).hours, 18);
	assert.equal(parseGameTime('see you at 7:30 tonight', 10, sun).hours, 19.5);
	assert.equal(parseGameTime('at 3', 10, sun).hours, 15);
	assert.equal(parseGameTime('at 9 in the morning', 10, sun).delta, 23);
	assert.equal(parseGameTime('at noon tomorrow', 10, sun).delta, 26);
	assert.equal(parseGameTime('at sunset', 10, sun).hours, 19.5);
	assert.equal(parseGameTime('in an hour', 10, sun).delta, 1);
	assert.equal(parseGameTime('in 30 minutes', 23.8, sun).hours.toFixed(2), '0.30');
	assert.equal(parseGameTime('midnight', 22, sun).delta, 2);
	assert.equal(parseGameTime('I have 3 dogs', 10, sun), null);
	assert.equal(parseGameTime('hello there', 10, sun), null);
});

test('real time follows the slow day and quick night', () => {
	const sky = { speed: 1, sun: { rise: 6.5, set: 19.5 } };
	const day = realSecondsFor(1, 10, sky), night = realSecondsFor(1, 1, sky);
	assert.ok(day > 30 && day < 50, String(day)); // ~13.3 h of bright day over 540 s
	assert.ok(night < day / 2, String(night));
	assert.equal(realSecondsFor(1, 10, { ...sky, real: true }), 3600);
	assert.equal(realSecondsFor(1, 10, { ...sky, speed: 0 }), Infinity);
	assert.equal(formatClock(18.5), '6:30 pm');
});

test('a meeting is kept only when the player turns up in the window', () => {
	const book = createAppointments({ storage: mem() });
	const place = { name: 'the pier', pos: { x: 100, z: 0 }, radius: 10 };
	const r = book.make({ bodyKey: 'earth', npcId: 'ana', npcName: 'Ana', place, hours: 10, delta: 2 });
	assert.ok(r.ok);
	assert.deepEqual(book.tick({ hours: 11, bodyKey: 'earth', player: { x: 0, z: 0 } }).map(e => e.type), []);
	assert.deepEqual(book.tick({ hours: 11.5, bodyKey: 'earth', player: { x: 0, z: 0 } }).map(e => e.type), ['go']);
	assert.deepEqual(book.tick({ hours: 11.8, bodyKey: 'earth', player: { x: 0, z: 0 } }).map(e => e.type), ['due']);
	assert.deepEqual(book.tick({ hours: 12.4, bodyKey: 'earth', player: { x: 95, z: 2 } }).map(e => e.type), ['kept']);
	assert.equal(book.list('earth')[0].status, 'kept');
});

test('missing it past the grace period, across midnight', () => {
	const s = mem(), book = createAppointments({ storage: s });
	book.make({ bodyKey: 'earth', npcId: 'bo', place: { name: 'x', pos: { lat: 37, lon: -122 } }, hours: 23, delta: 1 });
	book.tick({ hours: 23.9, bodyKey: 'earth', player: null });
	book.tick({ hours: 0.5, bodyKey: 'earth', player: null });
	assert.equal(createAppointments({ storage: s }).status().day, 1);
	const out = book.tick({ hours: 1.6, bodyKey: 'earth', player: null }).map(e => e.type);
	assert.deepEqual(out, ['missed']);
});

test('a proposal waits for agreement, and a new plan replaces the old', () => {
	const book = createAppointments({ storage: mem() });
	const place = { name: 'p', pos: { x: 0, z: 0 } };
	const a = book.make({ bodyKey: 'b', npcId: 'n', place, hours: 8, delta: 3, by: 'npc' }).appointment;
	assert.equal(a.status, 'proposed');
	assert.equal(book.pendingFrom('n', 'b').id, a.id);
	assert.equal(book.agree(a.id).appointment.status, 'agreed');
	book.make({ bodyKey: 'b', npcId: 'n', place, hours: 8, delta: 5 });
	assert.deepEqual(book.list('b').map(x => x.status), ['cancelled', 'agreed']);
});

test('recognising arrangements', () => {
	assert.ok(talksOfMeeting('Meet me at the pier at six'));
	assert.ok(talksOfMeeting("Sure, I'll be at the café around noon"));
	assert.ok(!talksOfMeeting('Nice to meet you!'));
	assert.ok(!talksOfMeeting('See you later'));
	assert.deepEqual(placePhrases('meet me at the Ferry Building at 6pm'), ['the Ferry Building']);
	assert.deepEqual(placePhrases('come to my place at sunset', 'npc')[0], 'npc-home');
	assert.ok(placePhrases('meet right here at noon').includes('here'));
	const m = [...'Sure. [[meet: Coit Tower @ sunset]]'.matchAll(MEET_TAG_RE)][0];
	assert.equal(m[1], 'Coit Tower'); assert.equal(m[2], 'sunset');
});
