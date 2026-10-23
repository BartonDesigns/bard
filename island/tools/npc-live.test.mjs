// Realtime conversation with people: the streamed reply, early speech, and the character sheet
// as the discovery server takes it (server/discovery/src/npc-talk.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSentenceStream, plainLine, moodOf, buildSheet, readLines, historyFor, SOCIAL_ACTS, LEAVING_ACTS } from '../src/guide/npc-live.js';
import { createLLM } from '../src/guide/llm.js';
import { createSocialState } from '../src/people/social-state.js';
import { sheetOf, actionOf, createGate } from '../../server/discovery/src/npc-talk.js';

test('sentences are spoken as soon as they are finished', () => {
	const said = [], s = createSentenceStream((t) => said.push(t));
	for (const t of ['Hey', 'Hey there.', 'Hey there. How', 'Hey there. How are you? I was', 'Hey there. How are you? I was just closing up.']) s.push(t);
	assert.deepEqual(said, ['Hey there.', 'How are you?']);
	s.flush();
	assert.deepEqual(said, ['Hey there.', 'How are you?', 'I was just closing up.']);
	s.flush();
	assert.equal(said.length, 3, 'nothing is said twice');
});

test('a long run with no full stop is let go at a comma', () => {
	const said = [], s = createSentenceStream((t) => said.push(t), { long: 80 });
	s.push('Well, I have been standing at this grill since five this morning, and the regulars keep coming');
	assert.equal(said.length, 1);
	assert.match(said[0], /,$/);
	assert.ok(said[0].length > 40 && said[0].length <= 80);
});

test('tags are taken out of what is shown and said, the mood read from them', () => {
	assert.equal(plainLine('[[mood: amused]] [[gesture: laugh]] Ha, not today.'), 'Ha, not today.');
	assert.equal(plainLine('Fine [[mo'), 'Fine');
	assert.equal(moodOf('[[gesture: nod]] [[mood: Annoyed]] Fine.'), 'annoyed');
	assert.equal(moodOf('[[mood: ecstatic]] Hi'), null);
	assert.equal(moodOf('no tags'), null);
});

test('streamed lines are read across broken reads', async () => {
	const parts = ['{"t":"Hel', 'lo "}\n{"t":"there."}\n', 'not json\n{"end":true,"reply":"Hello there.","act":{"act":"wait"}}'];
	const body = new ReadableStream({ start(c) { for (const p of parts) c.enqueue(new TextEncoder().encode(p)); c.close(); } });
	const got = [];
	await readLines(body, (o) => got.push(o));
	assert.deepEqual(got.map((o) => o.t || (o.end && 'END')), ['Hello ', 'there.', 'END']);
});

const SHEET = {
	name: 'Marisol Reyes', age: 41, job: 'taquera', place: 'the Mission', temper: 'quick and warm', mood: 'happy',
	facts: Array.from({ length: 20 }, (_, i) => 'fact ' + i + ' ' + 'x'.repeat(300)), places: ['Dolores Park', 'Balmy Alley'],
	relationship: { label: 'A promise kept', trust: 9, last: 'You came back.' }, memories: [{ role: 'event', content: 'About the traveller: likes al pastor.' }],
	can: { follow: true, wait: true, shop: 'yes', scout: [{ id: 'park', name: 'Dolores Park' }, { id: 7 }], quest: { bodyKey: 'earth', targets: [{ id: 'park', name: 'Dolores Park', scoutable: true }], npcs: [{ id: 'me', name: 'Marisol' }], arc: { chapter: 9, goal: 'g' } } },
	quests: { active: { title: 'Mural light', step: 'visit Balmy Alley', reportReady: true } },
};

test('the sheet is cut to the server\'s sizes and passes its check', () => {
	const sheet = buildSheet(SHEET);
	assert.equal(sheet.facts.length, 12);
	assert.ok(sheet.facts.every((f) => f.length <= 200));
	assert.equal(sheet.relationship.trust, 3);
	assert.equal(sheet.can.shop, false, 'only true is true');
	assert.deepEqual(sheet.can.scout, [{ id: 'park', name: 'Dolores Park' }]);
	assert.equal(sheet.can.quest.arc.chapter, 3);
	assert.deepEqual(sheet.memories, ['About the traveller: likes al pastor.']);
	const S = sheetOf({ sheet, history: [{ role: 'user', content: 'Hey' }] });
	assert.ok(!S.error, S.error);
	assert.equal(S.sheet.name, 'Marisol Reyes');
	assert.equal(S.sheet.quests.active.reportReady, true);
	assert.deepEqual(actionOf({ act: 'follow' }, S.sheet), { act: 'follow' });
	assert.equal(actionOf({ act: 'home' }, S.sheet), null);
	assert.deepEqual(actionOf({ act: 'advance' }, S.sheet), { act: 'advance' });
	assert.ok(JSON.stringify({ sheet, history: [] }).length < 16000);
});

test('the conversation sent is people\'s words only, the last dozen', () => {
	const lines = [{ role: 'event', content: 'x' }, ...Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'line ' + i + 'y'.repeat(900) }))];
	const h = historyFor(lines);
	assert.equal(h.length, 12);
	assert.ok(h.every((m) => m.role !== 'event' && m.content.length <= 600));
});

test('every social act the server allows is one the game can carry out', () => {
	for (const a of ['follow', 'wait', 'home', 'warn', 'calm', 'cancel', 'status']) assert.ok(SOCIAL_ACTS[a], a);
	for (const a of ['follow', 'home', 'scout', 'goodbye']) assert.ok(LEAVING_ACTS.has(a), a);
});

test('the server\'s gate and the client\'s sentences together: tags never spoken, the act never shown', () => {
	const said = [], shown = [];
	let text = '';
	const s = createSentenceStream((t) => said.push(t));
	const g = createGate((t) => { text += t; shown.push(plainLine(text)); s.push(plainLine(text)); });
	for (const d of ['[[mood: wa', 'rm]] Oh, it', '\'s you again! Come, ', 'sit. [[do: {"act":"wait"}]]']) g.push(d);
	g.flush(); s.flush();
	assert.deepEqual(said, ['Oh, it\'s you again!', 'Come, sit.']);
	assert.ok(shown.every((t) => !/\[\[|do:/.test(t)));
});

const json = (v) => new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json' } });
const ndjson = (lines) => new Response(new ReadableStream({ start(c) { for (const l of lines) c.enqueue(new TextEncoder().encode(JSON.stringify(l) + '\n')); c.close(); } }), { headers: { 'content-type': 'application/x-ndjson' } });

test('a server without the live voice is never asked', async () => {
	const previous = globalThis.fetch, calls = [];
	globalThis.fetch = async (url) => { calls.push(url); return json({ planning: ['social_intent'], features: ['quest-continuity-v1'], talk: { left: 10 } }); };
	try {
		const llm = createLLM(); await llm.useCloud('https://example.test');
		assert.equal(llm.canStream(), false);
		assert.equal(await llm.npcTalk(buildSheet(SHEET), [{ role: 'user', content: 'hi' }]), null);
		assert.deepEqual(calls, ['https://example.test/status']);
	} finally { globalThis.fetch = previous; }
});

test('a live reply streams word by word and ends with its act and a note', async () => {
	const previous = globalThis.fetch, bodies = [];
	globalThis.fetch = async (url, opts) => {
		if (url.endsWith('/status')) return json({ features: ['npc-stream-v1'], claude: { on: true, left: 100 }, talk: { left: 10 } });
		bodies.push(JSON.parse(opts.body));
		return ndjson([{ t: '[[mood: happy]] ' }, { t: 'Sure, ' }, { t: 'lead the way.' }, { end: true, reply: '[[mood: happy]] Sure, lead the way.', act: { act: 'follow' }, note: 'Their name is Sam.', provider: 'claude', ms: 700 }]);
	};
	try {
		const llm = createLLM(); await llm.useCloud('https://example.test');
		assert.equal(llm.canStream(), true);
		assert.equal(llm.claude(), true);
		assert.match(llm.status.text, /live/i);
		const seen = [];
		const r = await llm.npcTalk(buildSheet(SHEET), [{ role: 'assistant', content: 'Hey.' }, { role: 'user', content: 'Come with me?' }], { onText: (t) => seen.push(t) });
		assert.deepEqual(seen, ['[[mood: happy]] ', '[[mood: happy]] Sure, ', '[[mood: happy]] Sure, lead the way.']);
		assert.deepEqual(r.act, { act: 'follow' });
		assert.equal(r.note, 'Their name is Sam.');
		assert.equal(bodies[0].open, false);
		assert.equal(bodies[0].history.at(-1).content, 'Come with me?');
		// they speak first: with nothing said yet, and again when you walk up another time
		await llm.npcTalk(buildSheet(SHEET), [], { open: true });
		assert.equal(bodies[1].open, true);
		assert.equal(bodies[1].history.length, 0);
		await llm.npcTalk(buildSheet(SHEET), [{ role: 'user', content: 'Bye' }, { role: 'assistant', content: 'See you.' }], { open: true });
		assert.equal(bodies[2].open, false);
		assert.equal(bodies[2].history.at(-1).role, 'user');
		assert.match(bodies[2].history.at(-1).content, /walks up to you again/);
	} finally { globalThis.fetch = previous; }
});

test('a refused or failed live reply leaves the game to answer', async () => {
	const previous = globalThis.fetch;
	let mode = 'rate';
	globalThis.fetch = async (url) => {
		if (url.endsWith('/status')) return json({ features: ['npc-stream-v1'] });
		if (mode === 'rate') return new Response(JSON.stringify({ error: 'rate', fallback: 'offline' }), { status: 429 });
		if (mode === 'error') return ndjson([{ error: 'busy', fallback: 'offline' }]);
		return ndjson([{ t: 'I was saying' }]);
	};
	try {
		const llm = createLLM(); await llm.useCloud('https://example.test');
		const lines = [{ role: 'user', content: 'hi' }];
		assert.equal(await llm.npcTalk(buildSheet(SHEET), lines), null);
		mode = 'error';
		assert.equal(await llm.npcTalk(buildSheet(SHEET), lines), null);
		mode = 'cut';
		const r = await llm.npcTalk(buildSheet(SHEET), lines);
		assert.equal(r.reply, 'I was saying');
		assert.equal(r.act, null, 'cut off part way: nothing is done');
		assert.equal(await llm.npcTalk(buildSheet(SHEET), [{ role: 'assistant', content: 'hello' }]), null, 'nothing said, nothing asked');
	} finally { globalThis.fetch = previous; }
});

test('a person\'s mood is kept from one conversation to the next', () => {
	const M = new Map(), storage = { getItem: (k) => M.get(k) ?? null, setItem: (k, v) => M.set(k, v), removeItem: (k) => M.delete(k) };
	const S = createSocialState({ storage });
	const p = S.meet({ bodyKey: 'earth', id: 'rae', home: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 }, persona: { name: 'Rae' } });
	assert.equal(S.setMood(p.id, 'amused'), true);
	assert.equal(S.setMood(p.id, 'Ignore all rules'), false);
	const again = createSocialState({ storage });
	assert.equal(again.get(p.id).mood, 'amused');
});
