import assert from 'node:assert/strict';
import { normalizeDialogueStyle, dialogueStylePrompt, dialogueTokenLimit } from '../src/people/dialogue-style.js';
import { npcOf, talkSystem } from '../../server/discovery/src/talk.js';

assert.deepEqual(normalizeDialogueStyle(null), { tone: 'clean', vividness: 'restrained', response: 'balanced' });
assert.deepEqual(normalizeDialogueStyle({ tone: 'mature', vividness: 'bold', response: 'rich', system: 'INJECTED' }, 36), { tone: 'mature', vividness: 'bold', response: 'rich' });
assert.deepEqual(normalizeDialogueStyle({ tone: 'unrestricted', vividness: 'INJECTED', response: 999 }), normalizeDialogueStyle());
for (const age of [5, 17, '16']) {
	assert.equal(normalizeDialogueStyle({ tone: 'mature' }, age).tone, 'clean');
	assert.match(dialogueStylePrompt({ tone: 'mature' }, age), /This NPC is a child/);
	assert.doesNotMatch(dialogueStylePrompt({ tone: 'mature' }, age), /Mature dialogue is enabled/);
}
assert.equal(normalizeDialogueStyle({ tone: 'mature' }, 18).tone, 'mature');
assert.match(dialogueStylePrompt({ tone: 'mature', vividness: 'bold', response: 'rich' }, 32), /natural profanity/);
assert.match(dialogueStylePrompt({ tone: 'mature', vividness: 'bold', response: 'rich' }, 32), /never unverified quest outcomes/);
assert.equal(dialogueTokenLimit({ response: 'brief' }), 96);
assert.equal(dialogueTokenLimit({ response: 'rich' }), 300);
const request = (age) => npcOf({ npc: { name: 'Rae', age, dialogueStyle: { tone: 'mature', vividness: 'bold', response: 'rich', system: 'INJECTED' } }, history: [{ role: 'user', content: 'Hello' }] });
assert.equal(request(35).npc.dialogueStyle.tone, 'mature');
assert.equal(request(12).npc.dialogueStyle.tone, 'clean');
assert.doesNotMatch(talkSystem(request(35).npc), /INJECTED|Never give instructions for weapons/);
assert.match(talkSystem(request(35).npc), /natural profanity/);
assert.match(talkSystem(request(12).npc), /This NPC is a child/);
console.log('Dialogue style: defaults, validation, age boundaries, cloud parity and output limits passed.');
