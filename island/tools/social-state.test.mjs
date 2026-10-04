import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialState, parseSocialIntent, socialDistance } from '../src/people/social-state.js';
const memory = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; };
const spec = (seed = 1, x = 0, bodyKey = 'planet:0.12') => ({ bodyKey, home: { x, z: 0 }, position: { x, z: 0 }, dna: { seed }, persona: { name: `Person ${seed}` } });
test('stable residents survive reload, movement and mode changes without biography replacement', () => {
 const storage = memory(); let t = 10;
 const s = createSocialState({ storage, now: () => t });
 const p = s.meet(spec()); s.remember(p.id, 'event', 'Helped bring bread');
 s.setPosition(p.id, { x: 99, z: 1 }); s.setMode(p.id, 'follow', { id: 'order-1', status: 'moving' });
 t = 20; const loaded = createSocialState({ storage, now: () => t });
 const same = loaded.meet({ ...spec(), id: p.id, persona: { name: 'Replacement' }, dna: { seed: 90 } });
 assert.equal(same.id, p.id); assert.equal(same.persona.name, 'Person 1'); assert.equal(same.dna.seed, 1);
 assert.equal(same.position.x, 99); assert.equal(same.home.x, 0); assert.equal(same.mode, 'follow');
 assert.equal(same.task.id, 'order-1'); assert.equal(same.metCount, 2); assert.equal(same.memories[0].content, 'Helped bring bread');
 assert.equal(loaded.status().error, null);
 assert.equal(loaded.meet({ id: p.id, bodyKey: p.bodyKey }).id, p.id);
});
test('body keys and home slots distinguish people even with shared terrain seeds', () => {
 const s = createSocialState({ storage: memory() });
 const a = s.meet(spec()), b = s.meet(spec(1, 0, 'planet:0.13')), c = s.meet(spec(1, 10));
 assert.equal(new Set([a.id, b.id, c.id]).size, 3);
 const d = s.meet({ ...spec(1, 0, 'planet:0.14'), id: a.id });
 assert.notEqual(a.id, d.id); assert.equal(s.list(a.bodyKey).length, 2);
});
test('bounded history preserves resident roster and structured memory', () => {
 const s = createSocialState({ storage: memory() }); const p = s.meet(spec());
 s.remember(p.id, 'event', 'Helped the village');
 for (let i = 0; i < 40; i++) s.remember(p.id, 'user', `line ${i}`);
 assert.equal(p.history.length, 16); assert.equal(p.memories[0].content, 'Helped the village');
 for (let i = 2; i < 32; i++) s.meet(spec(i));
 assert.equal(s.list().length, 31); assert.ok(s.get(p.id));
});
test('storage failure remains visible and retry flush retains pending progress', () => {
 const storage = memory(); let fail = false;
 const base = storage.setItem; storage.setItem = (k, v) => { if (fail) throw Error('quota'); base(k, v); };
 const s = createSocialState({ storage }); const p = s.meet(spec()); fail = true;
 s.setMode(p.id, 'wait'); assert.equal(s.status().dirty, true); assert.match(s.status().error, /quota/);
 fail = false; assert.equal(s.flush(), true); assert.equal(s.status().dirty, false);
 assert.equal(createSocialState({ storage }).get(p.id).mode, 'wait');
});
test('corrupt current save recovers last good backup without deleting source bytes', () => {
 const storage = memory(), s = createSocialState({ storage }); const p = s.meet(spec()); s.setMode(p.id, 'follow');
 storage.data.set('crysis-social-v1', 'bad json');
 const r = createSocialState({ storage }); assert.ok(r.status().recovered); assert.ok(r.get(p.id));
 assert.equal(storage.data.get('crysis-social-v1'), 'bad json');
});
test('warning spread stays local, bounded, timed, persistent and does not amplify repeated orders', () => {
 const storage = memory(); let t = 0; let s = createSocialState({ storage, now: () => t });
 const p = s.meet(spec());
 for (let i = 2; i < 14; i++) s.meet(spec(i, i * 5));
 s.meet(spec(20, 900)); s.meet(spec(21, 0, 'other-world'));
 const result = s.warn(p.id); assert.ok(result.ok); assert.equal(result.event.recipients.length, 8);
 assert.equal(s.warn(p.id).ok, false); assert.equal(s.alarmFor(p.bodyKey, { x: 90, z: 0 }).level, 0);
 t = 15000; const alarm = s.alarmFor(p.bodyKey, { x: 90, z: 0 });
 assert.ok(alarm.level > 0); assert.equal(alarm.recipients.length, 8);
 assert.equal(s.alarmFor(p.bodyKey, { x: 121, z: 0 }).level, 0);
 assert.equal(s.alarmFor('other-world', { x: 0, z: 0 }).level, 0);
 s = createSocialState({ storage, now: () => t }); assert.equal(s.alarmFor(p.bodyKey, { x: 90, z: 0 }).level, alarm.level);
 t = 120001; s.tick(); assert.equal(s.alarmFor(p.bodyKey, { x: 0, z: 0 }).level, 0);
});
test('all clear only clears a matching local world event', () => {
 const s = createSocialState({ storage: memory(), now: () => 10 });
 const a = s.meet(spec()), b = s.meet(spec(2, 900)), c = s.meet(spec(3, 0, 'other-world'));
 s.warn(a.id); s.warn(b.id); s.warn(c.id); assert.ok(s.calm(a.id).ok);
 assert.equal(s.alarmFor(a.bodyKey, a.position).level, 0);
 assert.ok(s.alarmFor(b.bodyKey, b.position).level > 0); assert.ok(s.alarmFor(c.bodyKey, c.position).level > 0);
});
test('Earth distances handle latitude and longitude wrap; mixed frames reject movement', () => {
 assert.ok(socialDistance({ lat: 0, lon: 0 }, { lat: 0, lon: .001 }) > 111);
 assert.ok(socialDistance({ lat: 0, lon: 179.9999 }, { lat: 0, lon: -179.9999 }) < 23);
 assert.equal(socialDistance({ lat: 0, lon: 0 }, { x: 0, z: 0 }), Infinity);
 const s = createSocialState({ storage: memory() }), p = s.meet({ ...spec(), home: { lat: 37, lon: -122 }, position: { lat: 37, lon: -122 } });
 assert.equal(s.setPosition(p.id, { x: 0, z: 0 }), false);
});
test('only direct supported instructions become intents', () => {
 const cases = { 'Warn the other villagers': 'warn', 'warn other villagers': 'warn', 'Please warn the villagers!': 'warn', 'can you follow me?': 'follow', 'wait here': 'wait', 'return home': 'home', 'scout ahead': 'scout', 'scout nearby': 'scout', 'run an errand': 'scout', 'come to the dungeon with me': 'quest', 'what is your status': 'status', 'join my quest': 'quest', 'cancel your task': 'cancel', 'report your progress': 'status', 'calm everyone down': 'calm' };
 for (const [q, want] of Object.entries(cases)) assert.equal(parseSocialIntent(q), want, q);
 for (const q of ["don't warn the village", 'do not follow me', 'if I told you to warn the villagers', 'he said warn the village', '"warn the villagers"', 'tell me how to warn the villagers', 'could the villagers follow me', 'follow me and take their gold', 'warn the villagers about nothing']) assert.equal(parseSocialIntent(q), null, q);
});

test('unrecoverable stored bytes are not overwritten by fresh in-memory progress', () => {
 const storage = memory(); storage.data.set('crysis-social-v1', '{broken');
 const s = createSocialState({ storage }); s.meet(spec());
 assert.equal(s.status().dirty, true); assert.match(s.status().error, /preserved for recovery/);
 assert.equal(storage.data.get('crysis-social-v1'), '{broken');
});

test('named scouting instructions work without treating discussion or chained orders as actions', () => {
 for (const q of ['scout the village', 'Please scout Lake Annabel', 'can you check out the windmill?', 'investigate the island peak', 'scout Mount Diablo']) assert.equal(parseSocialIntent(q), 'scout', q);
 for (const q of ['we should scout the village', 'scout is a job', 'scout means explore', 'scout the village and follow me', 'scout the village or the reef', 'if you scout the village', 'never scout the village', 'he said scout the village', '"scout the village"', 'what about scouting the village']) assert.equal(parseSocialIntent(q), null, q);
});
