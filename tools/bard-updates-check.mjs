import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync(new URL('../loading-screen.js', import.meta.url), 'utf8');
const block = loader.match(/\/\* bard-chronicle:start \*\/ Object\.freeze\((\[[\s\S]*?\])\); \/\* bard-chronicle:end \*\//);
assert.ok(block, 'loading-screen.js has a machine-readable Bard Chronicle block');
const notes = JSON.parse(block[1]);
const checkpoint = loader.match(/const BARD_UPDATE_CHECKPOINT = '([0-9a-f]{40})'/)?.[1];
const updated = loader.match(/const BARD_UPDATES_UPDATED = '(\d{4}-\d{2}-\d{2})'/)?.[1];

assert.match(checkpoint || '', /^[0-9a-f]{40}$/);
assert.match(updated || '', /^\d{4}-\d{2}-\d{2}$/);
assert.ok(notes.length > 0 && notes.length <= 12, 'the Chronicle stays useful and light');
const ids = new Set();
let last = '9999-99-99';
for (const note of notes) {
	assert.match(note.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
	assert.ok(!ids.has(note.id), `duplicate Chronicle entry: ${note.id}`); ids.add(note.id);
	assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(note.date <= last, 'newest Chronicle entries come first'); last = note.date;
	for (const key of ['realm', 'title', 'text']) assert.ok(typeof note[key] === 'string' && note[key].trim(), `${note.id} needs ${key}`);
	assert.ok(note.text.length <= 240, `${note.id} stays easy to read`);
	assert.ok(Array.isArray(note.points) && note.points.length > 0 && note.points.length <= 3, `${note.id} needs one to three short points`);
}
const doc = fs.readFileSync(new URL('../docs/game-improvements.md', import.meta.url), 'utf8');
for (const note of notes) assert.ok(doc.includes(`<!-- ${note.id} -->`) && doc.includes(note.title), `documentation includes ${note.id}`);
assert.ok(doc.includes(`Source checkpoint: \`${checkpoint}\``), 'documentation and loader use the same checkpoint');
console.log(`PASS ${notes.length} Bard Chronicle entries, newest first, documented and ready for the loading screen`);
