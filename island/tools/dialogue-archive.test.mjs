import assert from 'node:assert/strict';
import { createDialogueArchive } from '../src/guide/dialogue-archive.js';
const KEY = 'crysis-dialogue-archive-v1';
function memory() { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
const alice = { id: 'earth:alice', name: 'Alice', bodyKey: 'earth' };
const bob = { id: 'earth:bob', name: 'Bob', bodyKey: 'earth' };
test('NPC threads and guide are isolated through reload', () => {
	const storage = memory(), archive = createDialogueArchive({ storage, now: () => 100 });
	archive.append(alice, 'user', 'Restore the garden'); archive.append(bob, 'assistant', 'I remember the bridge');
	archive.append({ id: 'guide', kind: 'guide', name: 'Guide' }, 'assistant', 'World map');
	const restored = createDialogueArchive({ storage });
	assert.deepEqual(restored.thread(alice.id).turns.map(x => x.content), ['Restore the garden']);
	assert.equal(restored.thread(bob.id).turns.length, 1); assert.equal(restored.thread('guide').kind, 'guide');
});
test('full turns survive beyond model context and are searchable with pagination', () => {
	const archive = createDialogueArchive({ storage: memory() });
	for (let i = 0; i < 100; i++) archive.append(alice, 'user', 'garden ' + i);
	archive.append(bob, 'user', 'garden other');
	assert.equal(archive.thread(alice.id).turns.length, 100);
	assert.equal(archive.search('GARDEN', { limit: 200 }).length, 101);
	assert.equal(archive.search('alice', { limit: 200 }).length, 100);
	assert.equal(archive.search('garden', { threadId: bob.id }).length, 1);
	assert.equal(archive.search('', { threadId: alice.id, limit: 10, offset: 95 }).length, 5);
});
test('old history imports once, preserves events and timestamps', () => {
	const storage = memory(), archive = createDialogueArchive({ storage });
	const turns = [{ role: 'user', content: 'Hello', at: 12 }, { role: 'event', content: 'Garden restored', at: 13 }];
	assert.equal(archive.importHistory(alice, turns), 2);
	archive.append(alice, 'assistant', 'Welcome back');
	assert.equal(createDialogueArchive({ storage }).importHistory(alice, turns), 0);
	assert.equal(archive.thread(alice.id).turns[0].at, 12);
	assert.equal(archive.thread(alice.id).turns.length, 3);
});
test('quota failure retains saved bytes and all unsaved turns for export', () => {
	const storage = memory(), archive = createDialogueArchive({ storage });
	archive.append(alice, 'user', 'Saved'); const previous = storage.getItem(KEY);
	storage.setItem = () => { throw Error('Quota exceeded'); };
	archive.append(alice, 'user', 'Unsaved');
	assert.equal(storage.getItem(KEY), previous); assert.equal(archive.status().dirty, true);
	assert.match(archive.status().error, /No turns were deleted/);
	assert.equal(JSON.parse(archive.exportJSON()).threads[alice.id].turns.length, 2);
});
test('corrupt primary recovers backup; unrecoverable data is never overwritten', () => {
	const storage = memory(), archive = createDialogueArchive({ storage });
	archive.append(alice, 'user', 'First'); archive.append(alice, 'user', 'Second');
	storage.values.set(KEY, '{broken');
	const restored = createDialogueArchive({ storage }); assert.equal(restored.status().recovered, true);
	assert.equal(restored.thread(alice.id).turns[0].content, 'First');
	storage.values.set(KEY + '-backup', '{also broken');
	const blocked = createDialogueArchive({ storage }); blocked.append(bob, 'user', 'Still here');
	assert.equal(storage.getItem(KEY), '{broken'); assert.equal(storage.getItem(KEY + '-backup'), '{also broken');
	assert.equal(blocked.thread(bob.id).turns.length, 1); assert.match(blocked.status().error, /preserved/);
});
test('snapshots cannot mutate stored threads, special ids are safe and text is not truncated', () => {
	const archive = createDialogueArchive({ storage: memory() });
	archive.append({ id: '__proto__', name: 'Strange' }, 'user', 'x'.repeat(10000));
	const snapshot = archive.thread('__proto__'); snapshot.turns.pop();
	assert.equal(archive.thread('__proto__').turns[0].content.length, 10000);
	assert.equal(archive.thread('toString'), null);
	assert.throws(() => archive.append(alice, 'invalid', 'No'));
	assert.equal(archive.thread(alice.id), null);
});
console.log(`${passed} dialogue archive tests passed`);
