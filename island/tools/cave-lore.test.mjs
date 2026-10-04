import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { CAVE_LORE_SOURCE, DWELLER_LORE, SOUL_LORE, VAULT_LORE, EPOCH_ADJECTIVES, EPOCH_NOUNS, DEPTH_MILESTONES, caveResidentMeta, cavePersona, caveLoreReply } from '../src/planet/cave-lore.js';

const source = gunzipSync(readFileSync(new URL('../../runtime/caves-179.html.gz', import.meta.url))).toString('utf8');
const capture = (pattern, input = source) => { const match = input.match(pattern); assert.ok(match, `Missing legacy source: ${pattern}`); return match[1]; };

// Read only literal string arrays. Never execute the legacy document, even if it
// later contains executable expressions where a lore array used to be.
function literalStrings(input) {
 assert.match(input, /^\[[\s\S]*\]$/);
 const body = input.slice(1, -1), tokens = [], token = /'((?:[^'\\\r\n]|\\['\\])*)'/g;
 let end = 0, match;
 while ((match = token.exec(body))) {
  const between = body.slice(end, match.index);
  assert.match(between, tokens.length ? /^\s*,\s*$/ : /^\s*$/);
  const decoded = match[1].replace(/\\(['\\])/g, '$1');
  tokens.push(JSON.stringify(decoded));
  end = token.lastIndex;
 }
 assert.match(body.slice(end), tokens.length ? /^\s*,?\s*$/ : /^\s*$/);
 return JSON.parse(`[${tokens.join(',')}]`);
}
const array = name => literalStrings(capture(new RegExp(`var ${name} = (\\[[\\s\\S]*?\\]);`)));
const spec = { worldSeed: 1337, chamber: { x: 52.1, z: -17.3 }, index: 2, age: 42, activity: 'keep' };

test('every preserved lore string matches the compressed legacy source exactly', () => {
 assert.equal(CAVE_LORE_SOURCE, 'runtime/caves-179.html.gz');
 const block = capture(/var LORE = (\{\s*elder:[\s\S]*?\n    \});/);
 const roles = Object.fromEntries(['elder', 'trader', 'parent', 'worker', 'child'].map(role => [role, literalStrings(capture(new RegExp(`${role}: (\\[[\\s\\S]*?\\])`), block))]));
 assert.deepEqual(DWELLER_LORE, roles);
 assert.deepEqual(SOUL_LORE, array('SOUL_LORE'));
 assert.deepEqual(VAULT_LORE, array('VAULT_LORE'));
 assert.deepEqual(EPOCH_ADJECTIVES, array('EPOCH_ADJ'));
 assert.deepEqual(EPOCH_NOUNS, array('EPOCH_NOUN'));
 const milestones = capture(/var MILESTONES = (\[[\s\S]*?\n    \]);/);
 const records = [...milestones.matchAll(/\{ d: (\d+), name: ('[^'\n]*'), hit: false \}/g)].map(match => ({ depth: Number(match[1]), name: literalStrings(`[${match[2]}]`)[0] }));
 assert.equal(records.length, 4);
 assert.match(milestones.replace(/\{ d: \d+, name: '[^'\n]*', hit: false \}/g, ''), /^[\s,[\]]+$/);
 assert.deepEqual(DEPTH_MILESTONES, records);
 assert.deepEqual(Object.values(DWELLER_LORE).map(lines => lines.length), [10, 5, 5, 4, 4]);
});

test('legacy parser rejects executable expressions and malformed literals', () => {
 assert.deepEqual(literalStrings("['a', 'b',]"), ['a', 'b']);
 assert.deepEqual(literalStrings("['it\\'s a story']"), ["it's a story"]);
 for (const input of ["['a', run()]", "['a' + 'b']", "[(()=> 'a')()]", "['a'; 'b']", "['a', globalThis.pwned = true]", "['a', `template`]"]) assert.throws(() => literalStrings(input));
});

test('resident identity is deterministic and isolated by world, chamber and resident', () => {
 const a = caveResidentMeta(spec);
 assert.deepEqual(a, caveResidentMeta(JSON.parse(JSON.stringify(spec))));
 for (const changes of [{ worldSeed: 1338 }, { chamber: { x: 53.1, z: -17.3 } }, { index: 3 }]) assert.notEqual(a.id, caveResidentMeta({ ...spec, ...changes }).id);
 assert.notEqual(a.seed, caveResidentMeta({ ...spec, worldSeed: 1338 }).seed);
 assert.equal(a.id, caveResidentMeta({ ...spec, age: 60, activity: 'walk' }).id, 'Identity survives role/age changes');
});

test('resident role, persona and offline lore follow their underground life', () => {
 assert.equal(caveResidentMeta(spec).role, 'trader');
 assert.equal(caveResidentMeta({ ...spec, age: 8 }).role, 'child');
 assert.equal(caveResidentMeta({ ...spec, activity: 'walk', parent: true }).role, 'parent');
 assert.equal(caveResidentMeta({ ...spec, age: 70, activity: 'sit' }).role, 'elder');
 assert.equal(caveResidentMeta({ ...spec, activity: 'walk' }).role, 'worker');
 const meta = caveResidentMeta(spec), base = { name: 'Sam Chen', first: 'Sam', age: 42, local: { place: 'a street' }, region: 'California', lang: 'English', facts: ['surface fact'] };
 const p = cavePersona(base, meta);
 assert.equal(p.name, base.name); assert.equal(p.first, base.first);
 assert.equal(p.kind, 'cave'); assert.equal(p.local, undefined); assert.equal(p.region, undefined);
 assert.equal(base.local.place, 'a street', 'Enrichment must not mutate the original');
 assert.ok(p.facts.includes(DWELLER_LORE.trader[4])); assert.ok(!p.facts.includes('surface fact'));
 assert.equal(caveLoreReply(meta, 'Do you take coin?'), caveLoreReply(caveResidentMeta(spec), 'Do you take coin?'));
 assert.match(caveLoreReply(meta, 'Do you take coin?'), /I do not take coin/);
 for (const text of ['follow me', 'scout nearby', 'hello', 'wait here']) assert.equal(caveLoreReply(meta, text), null);
 assert.equal(caveLoreReply({ role: '__proto__' }, 'cave story'), null);
});

test('preserved source arrays cannot be mutated by runtime consumers', () => {
 for (const array of [...Object.values(DWELLER_LORE), SOUL_LORE, VAULT_LORE, EPOCH_ADJECTIVES, EPOCH_NOUNS, DEPTH_MILESTONES]) {
  assert.ok(Object.isFrozen(array)); assert.throws(() => array.push('changed'), TypeError);
 }
 assert.ok(Object.isFrozen(DEPTH_MILESTONES[0]));
});
