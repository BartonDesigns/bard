import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chooseSource, createLoadGuard, LOADING_KEY, UNABLE_KEY, CALM_SECONDS, localVoice, deviceVoiceFor, phoneLike, clipId, speechChunks, VOICES, FEMALE, MALE } from '../src/guide/local-speech-plan.js';
import { createClipStore, readManifest } from '../src/guide/local-speech-clips.js';
import { voiceMode } from '../src/guide/preferences.js';
import { voiceBank } from './voice-bank.mjs';

const VOICE_DIR = new URL('../assets/voices/', import.meta.url);
const line = (text, clipped) => ({ chunks: speechChunks(text), hasClip: () => clipped });
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

test('a phone without the model hears a clip, else the device voice; never the model', () => {
	const phone = { phone: true, modelReady: false, modelAllowed: true };
	assert.equal(chooseSource(line('Morning.', true), phone), 'clip');
	assert.equal(chooseSource(line('Hello there, Sam.', false), phone), 'device');
	assert.equal(chooseSource(line('Hello there, Sam.', false), { ...phone, talk: true }), 'device', 'a conversation does not start a model load on a phone');
	assert.equal(chooseSource(line('Hello there, Sam.', false), { ...phone, modelReady: true }), 'model', 'once the calm load has finished, the model speaks new lines');
	assert.equal(chooseSource(line('Hello there, Sam.', false), { ...phone, talk: true, mode: 'local' }), 'model', 'local always loads it on a phone too');
	assert.equal(chooseSource(line('Hello there, Sam.', false), { ...phone, modelReady: true, modelAllowed: false }), 'device');
});

test('a computer prefers the clip, then the model; a remark does not wait for the model to load', () => {
	const desk = { phone: false, modelAllowed: true };
	assert.equal(chooseSource(line('Morning.', true), { ...desk, modelReady: true }), 'clip');
	assert.equal(chooseSource(line('New words.', false), { ...desk, modelReady: true }), 'model');
	assert.equal(chooseSource(line('New words.', false), { ...desk, modelReady: false, talk: true }), 'model');
	assert.equal(chooseSource(line('New words.', false), { ...desk, modelReady: false }), 'device');
	assert.equal(chooseSource(line('Morning.', true), { ...desk, mode: 'device' }), 'device');
	assert.equal(chooseSource(line('New words.', false), { ...desk, deviceOk: false }), 'none');
	assert.equal(chooseSource(line('', true), desk), 'none');
});

test('a line is said from one source: one missing piece and none of it comes from clips', () => {
	const text = 'Oh no, Sam just left their bag here! Could you catch them?';
	const have = new Set([speechChunks(text)[1]]);
	assert.equal(chooseSource({ chunks: speechChunks(text), hasClip: (c) => have.has(c) }, { phone: true }), 'device');
});

test('a load that took the page with it marks the phone unable until the player asks again', () => {
	const s = memory();
	const a = createLoadGuard({ storage: s, calmFor: 10 });
	assert.equal(a.tick(5, { settled: true }), false);
	assert.equal(a.tick(4, { settled: true, flying: true }), false, 'flying resets the calm');
	for (let i = 0; i < 9; i++) assert.equal(a.tick(1, { settled: true }), false);
	assert.equal(a.tick(1, { settled: true }), true, 'ten calm seconds and it is time');
	a.begin();
	assert.equal(s.getItem(LOADING_KEY), '1');
	// the page closes here; the next page finds the mark
	const b = createLoadGuard({ storage: s, calmFor: 10 });
	assert.equal(b.unable(), true);
	assert.equal(s.getItem(LOADING_KEY), null);
	assert.equal(b.tick(60, { settled: true }), false, 'an unable phone never tries again by itself');
	b.reset();
	assert.equal(b.unable(), false);
	assert.equal(s.getItem(UNABLE_KEY), null);
});

test('a load that finished and spoke clears the mark; a dropped one waits for calm again', () => {
	const s = memory(), g = createLoadGuard({ storage: s, calmFor: 3 });
	g.tick(3, { settled: true }); g.begin(); g.spoke();
	assert.equal(createLoadGuard({ storage: s }).unable(), false);
	g.begin(); g.dropped();
	assert.equal(s.getItem(LOADING_KEY), null);
	assert.equal(g.calm(), 0);
	assert.equal(g.tick(2, { settled: true, dense: false }), false);
	assert.equal(g.tick(1, { settled: true, hidden: true }), false);
	assert.ok(CALM_SECONDS >= 120, 'a few minutes of calm on a real phone');
});

test('a person keeps one voice across clip, model and device', () => {
	for (let seed = 0; seed < 40; seed++) {
		const f = localVoice({ seed, male: false }), m = localVoice({ seed, male: true });
		assert.ok(FEMALE.includes(f) && MALE.includes(m));
		assert.equal(localVoice({ seed, male: false }), f);
	}
	const voices = [{ name: 'Daniel', lang: 'en-GB' }, { name: 'Samantha', lang: 'en-US' }, { name: 'Karen', lang: 'en-AU' }, { name: 'Thomas', lang: 'fr-FR' }];
	assert.equal(deviceVoiceFor({ seed: 3, male: true }, voices).voice.name, 'Daniel');
	assert.ok(['Samantha', 'Karen'].includes(deviceVoiceFor({ seed: 3, male: false }, voices).voice.name));
	assert.equal(deviceVoiceFor({ seed: 5, male: false }, voices).voice, deviceVoiceFor({ seed: 5, male: false }, voices).voice);
	// no voice of their sex on the device: the pitch carries it
	const one = [{ name: 'Fred', lang: 'en-US' }];
	assert.ok(deviceVoiceFor({ male: false, pitch: 1 }, one).pitch > 1.05);
	assert.equal(deviceVoiceFor({}, []).voice, null);
});

test('phones are recognised by touch, user agent or memory', () => {
	assert.equal(phoneLike({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true);
	assert.equal(phoneLike({ coarse: true }), true);
	assert.equal(phoneLike({ deviceMemory: 4 }), true);
	assert.equal(phoneLike({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', deviceMemory: 8 }), false);
});

test('the voices setting: best by default, the old device choice kept', () => {
	assert.equal(voiceMode(null), 'best');
	assert.equal(voiceMode(null, 'local'), 'best');
	assert.equal(voiceMode(null, 'device'), 'device');
	assert.equal(voiceMode('local'), 'local');
	assert.equal(voiceMode('anything'), 'best');
});

test('the clip bank covers everything said in passing and the favours, with no em dashes', () => {
	const bank = voiceBank();
	const lines = JSON.parse(fs.readFileSync(new URL('lines.json', VOICE_DIR), 'utf8'));
	for (const [id, words] of bank.chunks) assert.equal(lines[id], words, `assets/voices/lines.json is behind the lines: run node tools/build-voice-clips.mjs --lines (${words})`);
	assert.equal(Object.keys(lines).length, bank.chunks.size, 'lines.json has pieces no line says any more');
	assert.ok(bank.lines.length > 300, `${bank.lines.length}`);
	for (const t of bank.lines) assert.doesNotMatch(t, /\u2014/);
	assert.ok(bank.lines.includes('Morning.') && bank.lines.includes('On your left!'));
	assert.ok(bank.lines.some((t) => /repair roll/i.test(t)), 'the favours are in it');
	assert.ok(!bank.lines.some((t) => /Qzxw/.test(t)), 'no line with a name in it');
	for (const [id, words] of bank.chunks) assert.equal(clipId(words), id);
});

test('the manifest names only clips that exist, in the game\'s voices, and covers the bank for each', () => {
	const json = JSON.parse(fs.readFileSync(new URL('manifest.json', VOICE_DIR), 'utf8'));
	const M = readManifest(json), bank = voiceBank();
	assert.equal(M.format, 'mp3');
	for (const [voice, ids] of M.voices) {
		assert.ok(VOICES.includes(voice), voice);
		for (const id of bank.chunks.keys()) assert.ok(ids.has(id), `${voice} is missing ${bank.chunks.get(id)}`);
		for (const id of ids) assert.ok(fs.existsSync(new URL(`${voice}/${id}.mp3`, VOICE_DIR)), `${voice}/${id}.mp3`);
	}
});

test('clips are fetched once, then come from the cache; a missing one refuses the whole line', async () => {
	const files = new Map([['b/manifest.json', JSON.stringify({ version: 1, format: 'mp3', voices: { af_heart: [clipId('Morning.'), clipId('Hi.')] } })]]);
	files.set(`b/af_heart/${clipId('Morning.')}.mp3`, 'aa'); files.set(`b/af_heart/${clipId('Hi.')}.mp3`, 'bb');
	let fetched = 0;
	const fetchFn = async (url) => { fetched++; const body = files.get(url); return body == null ? { ok: false, status: 404 } : { ok: true, json: async () => JSON.parse(body), arrayBuffer: async () => new TextEncoder().encode(body).buffer, headers: { get: () => 'audio/mpeg' } }; };
	const stored = new Map();
	const cache = { match: async (u) => (stored.has(u) ? { arrayBuffer: async () => stored.get(u) } : undefined), put: async (u, r) => { stored.set(u, await r.arrayBuffer()); } };
	const store = createClipStore({ base: 'b/', fetchFn, cacheStorage: () => ({ open: async () => cache }) });
	assert.equal(store.has('af_heart', 'Morning.'), false, 'nothing until the manifest is read');
	await store.load();
	assert.equal(store.has('af_heart', 'Morning.'), true);
	assert.equal(store.has('am_michael', 'Morning.'), false);
	const ctx = { sampleRate: 48000, decodeAudioData: (data) => Promise.resolve({ sampleRate: 48000, duration: 1, bytes: data.byteLength }) };
	const got = await store.line('af_heart', ['Morning.', 'Hi.'], ctx);
	assert.equal(got.length, 2);
	assert.equal(stored.size, 2, 'kept by the browser for next time');
	const before = fetched;
	await createClipStore({ base: 'b/', fetchFn, cacheStorage: () => ({ open: async () => cache }) }).load().then(() => 0);
	assert.equal(fetched, before + 1, 'a new page fetches the manifest only');
	await assert.rejects(store.line('af_heart', ['Morning.', 'Gone.'], ctx));
});

test('a phone never starts the model in passing; it loads after calm, with the mark set first', async () => {
	const s = memory(), workers = [], spoken = [];
	Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile', deviceMemory: 4 }, configurable: true });
	Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true });
	globalThis.Worker = class { constructor() { this.posted = []; workers.push(this); } postMessage(m) { this.posted.push(m); } terminate() { this.dead = true; } };
	globalThis.speechSynthesis = { speaking: false, pending: false, getVoices: () => [], speak: (u) => spoken.push(u.text), cancel() {} };
	globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
	try {
		const { createLocalSpeech } = await import('../src/guide/local-speech.js?phone');
		const fell = [];
		const clips = { load: () => Promise.resolve(), has: () => false, line: () => Promise.reject(new Error('none')) };
		const L = createLocalSpeech({ fallback: (t) => fell.push(t), clips });
		assert.equal(L.phone, true);
		L.warm();
		L.speak('Tell me about the harbour.', { seed: 2, male: true });
		assert.deepEqual(fell, ['Tell me about the harbour.'], 'the device voice says it now');
		assert.equal(L.remark('Hey there, Sam.', { seed: 2, male: false }, { at: () => ({ x: 0, y: 0, z: 0 }), started() {}, done() {} }), true);
		assert.deepEqual(spoken, ['Hey there, Sam.'], 'a remark with no clip is in the device voice');
		assert.equal(workers.length, 0, 'no model for chatter or a conversation on a phone');
		for (let t = 0; t < CALM_SECONDS - 5; t += 1) L.tick(1, { settled: true });
		L.tick(1, { settled: true, fast: true });
		for (let t = 0; t < CALM_SECONDS - 5; t += 1) L.tick(1, { settled: true });
		assert.equal(workers.length, 0, 'racing about restarts the wait');
		for (let t = 0; t < 10; t += 1) L.tick(1, { settled: true });
		assert.equal(workers.length, 1);
		assert.equal(s.getItem(LOADING_KEY), '1', 'the mark is down before the load');
		assert.equal(workers[0].posted[0].type, 'warm');
		assert.equal(workers[0].posted[0].probe, true, 'it makes one line before it counts as ready');
		workers[0].onmessage({ data: { type: 'ready', id: -1 } });
		assert.equal(L.ready(), true);
		assert.equal(s.getItem(LOADING_KEY), null, 'loaded and spoken: the mark is cleared');
		L.unload();
		assert.equal(workers[0].dead, true);
		assert.equal(L.ready(), false);
	} finally {
		delete globalThis.Worker; delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
	}
});
