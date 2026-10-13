import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { remarkFor, exchangeFor, voiceShape } from '../src/people/chatter-lines.js';
import { awarenessContext } from '../src/people/world-awareness.js';

const many = (ctx, k = 60) => Array.from({ length: k }, (_, n) => remarkFor({ ...ctx, n }));

test('a witness is afraid, never friendly, and aiming outranks everything', () => {
	const harm = awarenessContext({ events: [{ id: 'x', at: 100, bodyKey: 'earth', actorId: 'player', kind: 'assault', line: 'hurt someone' }], bodyKey: 'earth', now: 200 });
	for (const r of many({ self: { warmth: 1, outgoing: 1 }, you: { aware: harm } })) assert.match(r.text, /away|closer|walking/);
	for (const r of many({ self: { child: true }, you: { aware: awarenessContext({ aimedAt: true }) } })) assert.match(r.text, /shoot|down|trouble/);
});

test('fast drivers, sprinters and joggers get their own lines', () => {
	assert.match(remarkFor({ you: { vehicle: true, speed: 12 } }).text, /slow|sidewalk/i);
	assert.match(remarkFor({ you: { speed: 10 } }).text, /watch|careful|fire|slow|easy/i);
	assert.match(remarkFor({ self: { role: 'jog' } }).text, /left|through|morning|excuse/i);
});

test('most passers-by are quiet; outgoing people speak more and all lines are clean', () => {
	const said = (outgoing) => many({ self: { outgoing, warmth: 0.5 }, scene: { hour: 10 } }, 400).filter((r) => r?.text).length;
	assert.ok(said(0.1) < said(0.9));
	assert.ok(said(0.1) < 200);
	const texts = new Set();
	for (const hour of [7, 14, 19, 2]) for (const mood of ['tired', 'busy', 'happy', null]) for (const r of many({ self: { outgoing: 0.9, warmth: 0.8, mood }, scene: { hour } }, 50)) if (r?.text) texts.add(r.text);
	assert.ok(texts.size >= 15, `only ${texts.size} distinct lines`);
	for (const t of texts) assert.doesNotMatch(t, /—/);
});

test('children wave and say a word; morning greetings stay in the morning', () => {
	const kid = remarkFor({ self: { child: true, outgoing: 0.9 } });
	assert.equal(kid.gesture, 'wave');
	for (const r of many({ self: { outgoing: 0.4, warmth: 0.4 }, scene: { hour: 20 } }, 200)) if (r?.text) assert.doesNotMatch(r.text, /[Mm]orning/);
});

test('overheard exchanges are two lines and follow the weather', () => {
	const [a, b] = exchangeFor({ seed: 3 });
	assert.ok(a && b && a !== b);
	assert.match(exchangeFor({ seed: 1, rain: 0.8 }).join(' '), /umbrella|coming down|wait it out/);
});

test('voices are shaped by age within a natural range, the same for the same person', () => {
	const old = voiceShape({ seed: 5, age: 80 }), teen = voiceShape({ seed: 5, age: 16, teen: true });
	assert.ok(teen.pitch > old.pitch);
	for (let seed = 0; seed < 200; seed++) { const v = voiceShape({ seed, age: 20 + seed % 60, male: seed % 2 === 0 }); assert.ok(v.pitch >= 0.9 && v.pitch <= 1.12); }
	assert.deepEqual(voiceShape({ seed: 9, age: 40 }), voiceShape({ seed: 9, age: 40 }));
});

// ---- the chatter loop itself, on stand-in bodies, a stand-in voice and a bare page ----
function stage() {
	const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, textContent: '' });
	globalThis.document = { createElement: el };
	globalThis.performance ??= { now: () => Date.now() };
	const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
	camera.position.set(0, 1.6, 0); camera.updateMatrixWorld();
	const body = (x, z, heading, speed, extra = {}) => ({
		active: true, role: 'walk', P: { dna: { seed: Math.round(x * 7 + z), male: true, age: 40, temper: { outgoing: 1, warmth: 1 } }, height: 1.75, root: { visible: true } },
		M: { S: { pos: new THREE.Vector3(x, 0, z), heading, speed: { v: speed }, feel: {}, pose: 'rest', look: { target: null } }, gesture() {} }, ...extra,
	});
	const said = [];
	const voice = { on: () => true, mode: () => 'local', talking: () => false, warm() {}, place() {},
		remark: (text, dna, place) => { said.push({ text, seed: dna.seed }); place.started(1); setTimeout(() => place.done(true), 5); return true; } };
	const pool = [];
	const world = () => ({ player: { state: { flying: false } }, sky: { state: { hours: 10 } }, weather: { state: { rainHere: 0, storm: 0 } } });
	return { camera, body, said, voice, pool, world, mount: { appendChild() {}, clientWidth: 400, clientHeight: 800 } };
}
const tick = (C, cam, dt, k) => { for (let i = 0; i < k; i++) C.update(dt); };

test('someone walking toward you speaks before you meet, once, and is looking at you', async () => {
	const { createChatter } = await import('../src/people/chatter.js');
	const T = stage();
	const p = T.body(0, -9, 0, 1.4);
	T.pool.push(p);
	const C = createChatter({ mount: T.mount, camera: T.camera, world: T.world, people: { pool: T.pool }, talkers: () => [], voice: T.voice, combat: () => null, driving: () => false });
	tick(C, T.camera, 0.25, 4);
	assert.equal(T.said.length, 1, 'a walker 9 m ahead coming your way is noticed');
	assert.equal(p.M.S.remark?.look, T.camera.position);
	await new Promise(r => setTimeout(r, 20));
	p.M.S.remark = null;
	tick(C, T.camera, 0.25, 8);
	assert.equal(T.said.length, 1, 'the same person does not speak again soon');
});

test('someone walking away, far off, or another person while one is talking is left alone', async () => {
	const { createChatter } = await import('../src/people/chatter.js');
	const T = stage();
	T.pool.push(T.body(0, -9, Math.PI, 1.4), T.body(30, 0, 0, 1.4));
	const C = createChatter({ mount: T.mount, camera: T.camera, world: T.world, people: { pool: T.pool }, talkers: () => [], voice: { ...T.voice, talking: () => true }, combat: () => null, driving: () => false });
	tick(C, T.camera, 0.25, 8);
	assert.equal(T.said.length, 0);
});

test('a pair mid-conversation: you overhear one line each, in two voices', async () => {
	const { createChatter } = await import('../src/people/chatter.js');
	const T = stage();
	const a = T.body(1.5, -2, 0, 0, { role: 'chat' }), b = T.body(2.5, -2, 0, 0, { role: 'chat' });
	a.partner = b; b.partner = a;
	T.pool.push(a, b);
	const C = createChatter({ mount: T.mount, camera: T.camera, world: T.world, people: { pool: T.pool }, talkers: () => [], voice: T.voice, combat: () => null, driving: () => false });
	tick(C, T.camera, 0.25, 2);
	await new Promise(r => setTimeout(r, 30));
	assert.equal(T.said.length, 2);
	assert.notEqual(T.said[0].seed, T.said[1].seed);
	assert.notEqual(a.M.S.remark?.look, T.camera.position, 'they look at each other, not at you');
});

test('people at work and at a table talk about their own business', () => {
	const work = new Set(), table = new Set();
	for (let n = 0; n < 12; n++) { work.add(exchangeFor({ n, work: 'office worker' })[0]); table.add(exchangeFor({ n, seated: true })[0]); }
	assert.ok([...work].some((t) => /email|meeting|numbers|printer/i.test(t)));
	assert.ok([...table].some((t) => /dessert|check|menu|trip/i.test(t)));
	assert.match(exchangeFor({ n: 0, work: 'vendor' }).join(' '), /size|price|warranty|check/i);
});

test('two people at neighbouring desks are overheard as a pair', async () => {
	const { createChatter } = await import('../src/people/chatter.js');
	const T = stage();
	const a = T.body(1.5, -2, 0, 0, { route: { kind: 'seat' }, workContext: { role: 'office worker' } }), b = T.body(2.7, -2, 0, 0, { route: { kind: 'seat' }, workContext: { role: 'office worker' } });
	T.pool.push(a, b);
	const C = createChatter({ mount: T.mount, camera: T.camera, world: T.world, people: { pool: T.pool }, talkers: () => [], voice: T.voice, combat: () => null, driving: () => false });
	tick(C, T.camera, 0.25, 2);
	await new Promise(r => setTimeout(r, 30));
	assert.equal(T.said.length, 2);
	assert.match(T.said.map((x) => x.text).join(' '), /email|meeting|look at this|numbers|blue ones|printer|morning/i);
});
