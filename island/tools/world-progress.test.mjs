import assert from 'node:assert/strict';
import test from 'node:test';
import {
	WORLD_PROGRESS_SCHEMA,
	createOfflineWorldProgressProvider,
	createWorldProgressClient,
	createWorldProgressHttpProvider,
	validateWorldProgressEvent,
} from '../src/persistence/world-progress.js';

const base = { worldId: 'earth:1337', actorId: 'player:test', projectId: 'resonance:forest-mouth', kind: 'contribution', payload: { siteId: 'stone-1', amount: 1 } };

test('public event schema has stable identities and rejects private dialogue fields', () => {
	const event = validateWorldProgressEvent({ ...base, eventId: 'e1', clientSequence: 1, clientAt: 10 });
	assert.equal(event.schema, WORLD_PROGRESS_SCHEMA);
	assert.equal(event.worldId, base.worldId);
	assert.throws(() => validateWorldProgressEvent({ ...base, eventId: 'e2', clientSequence: 2, payload: { conversationId: 'npc-1' } }), /Private or invalid/);
	assert.throws(() => validateWorldProgressEvent({ ...base, eventId: 'e3', clientSequence: 3, payload: { transcript: ['hello'] } }), /Private or invalid/);
});

test('offline client queues but never exposes localStorage as authoritative multiplayer state', async () => {
	const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
	const client = createWorldProgressClient({ worldId: base.worldId, actorId: base.actorId, storage });
	const queued = client.queue({ ...base, projectId: 'project-a' });
	assert.equal(queued.ok, true);
	assert.equal(client.status().authoritative, false);
	assert.equal(client.status().mode, 'offline');
	assert.equal((await client.flush()).status, 'offline');
	assert.equal(client.pending().length, 1);
	const reloaded = createWorldProgressClient({ worldId: base.worldId, actorId: base.actorId, storage });
	assert.equal(reloaded.pending().length, 1);
});

test('tampered local cache cannot smuggle private fields into the provider', () => {
	const data = new Map([["crysis-world-progress-v1", JSON.stringify({ schema: 1, nextSequence: 2, cursor: '0', pending: [{ ...base, eventId: 'bad', clientSequence: 1, payload: { transcript: ['private'] } }], received: [], rejected: [] })]]);
	const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
	const client = createWorldProgressClient({ worldId: base.worldId, actorId: base.actorId, storage });
	assert.equal(client.status().storageBlocked, true);
	assert.equal(client.pending().length, 0);
});

test('remote acknowledgements are idempotent and only acknowledged events emit', async () => {
	const sent = [], seen = [];
	const provider = {
		mode: 'remote',
		async append({ worldId, events }) {
			sent.push(events.map(event => event.eventId));
			return { schema: 1, worldId, cursor: '1', accepted: events.map((event, index) => ({ ...event, serverVersion: index + 1, serverAt: 100 })), events: [], rejected: [] };
		},
		async catchUp({ worldId, cursor }) { return { schema: 1, worldId, cursor, accepted: [], events: [], rejected: [] }; },
	};
	const client = createWorldProgressClient({ worldId: base.worldId, actorId: base.actorId, provider, onEvent: event => seen.push(event.eventId) });
	client.queue({ ...base, eventId: 'e1', clientSequence: 1 });
	assert.equal((await client.flush()).accepted, 1);
	assert.deepEqual(sent, [['e1']]);
	assert.deepEqual(seen, ['e1']);
	assert.equal((await client.flush()).accepted, 0);
	assert.deepEqual(seen, ['e1']);
});

test('catch-up applies server events and preserves cursor across reload', async () => {
	const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
	const provider = {
		mode: 'remote',
		async append({ worldId, cursor }) { return { schema: 1, worldId, cursor, accepted: [], events: [], rejected: [] }; },
		async catchUp({ worldId }) { return { schema: 1, worldId, cursor: '42', accepted: [], events: [{ ...base, eventId: 'other-1', actorId: 'player:other', clientSequence: 1, serverVersion: 42, serverAt: 200 }], rejected: [] }; },
	};
	const client = createWorldProgressClient({ worldId: base.worldId, actorId: base.actorId, storage, provider });
	await client.sync();
	assert.equal(client.status().cursor, '42');
	assert.deepEqual(client.received().map(event => event.eventId), ['other-1']);
	const again = createWorldProgressClient({ worldId: base.worldId, actorId: base.actorId, storage, provider });
	assert.equal(again.status().cursor, '42');
	assert.deepEqual(again.received().map(event => event.eventId), ['other-1']);
});

test('HTTP adapter sends the versioned boundary and does not invent auth', async () => {
	const calls = [];
	const provider = createWorldProgressHttpProvider({ baseURL: 'https://example.test', fetch: async (url, init) => {
		calls.push({ url, init });
		return { ok: true, status: 200, async json() { return { schema: 1, worldId: base.worldId, cursor: '0', accepted: [], events: [], rejected: [] }; } };
	} });
	await provider.append({ worldId: base.worldId, cursor: '0', events: [] });
	assert.equal(calls[0].url, 'https://example.test/v1/world-progress/events');
	assert.equal(calls[0].init.headers.authorization, undefined);
	assert.equal(JSON.parse(calls[0].init.body).schema, WORLD_PROGRESS_SCHEMA);
	assert.equal(createOfflineWorldProgressProvider().mode, 'offline');
});

console.log('World progress seam: public event privacy, offline outbox, idempotent acknowledgements, catch-up and HTTP boundary passed.');
