import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, profileOf, gearbox, firingHz, spool, distanceGain, airCutoff, doppler, budgetFor, pickVoices } from '../src/audio/engine-model.js';
import { thrustOf } from '../src/audio/thrusters.js';

// a pretend audio context: every node it makes is kept, so a test can see what is still wired
function fakeAudio() {
	const nodes = [], ctx = { currentTime: 1, sampleRate: 8000, state: 'running' };
	const param = (v = 0) => ({ value: v, setValueAtTime(x) { this.value = x; }, setTargetAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; }, exponentialRampToValueAtTime(x) { this.value = x; }, cancelScheduledValues() {} });
	const node = (kind) => {
		const n = { kind, context: ctx, gain: param(1), frequency: param(), Q: param(), pan: param(), detune: param(), playbackRate: param(1), offset: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), edges: [], wired: false,
			connect(to) { this.edges.push(to); this.wired = true; return to; }, disconnect() { this.edges = []; this.wired = false; this.gone = true; },
			start() { this.started = true; }, stop() { this.stopped = true; }, setPeriodicWave() {} };
		nodes.push(n); return n;
	};
	for (const [m, k] of [['createGain', 'gain'], ['createOscillator', 'osc'], ['createBufferSource', 'src'], ['createBiquadFilter', 'filter'], ['createStereoPanner', 'pan'], ['createDynamicsCompressor', 'comp'], ['createConstantSource', 'const']]) ctx[m] = () => node(k);
	ctx.createPeriodicWave = () => ({});
	ctx.createBuffer = (ch, len, rate) => { const d = new Float32Array(len); return { duration: len / rate, length: len, getChannelData: () => d }; };
	return { ctx, nodes };
}
// the world's bus wants a window with the Bard's master in it; its ducking timer must not hold the test open
async function loadEngines(ctx) {
	const realSet = globalThis.setInterval;
	globalThis.setInterval = (f, ms) => { const h = realSet(f, ms); h.unref?.(); return h; };
	globalThis.window = { _masterClip: { context: ctx } };
	globalThis.localStorage = { getItem: () => null, setItem() {} };
	return import('../src/audio/engines.js');
}
const camAt = (x = 0, y = 1.7, z = 0) => ({ position: { x, y, z }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1] } });

test('rpm rises with speed in a gear, and each change up drops it', () => {
	const p = PROFILES.sedan, st = {};
	let last = 0, gear = 0, drops = 0;
	for (let i = 0; i <= 400; i++) {
		const g = gearbox(p, i * 0.12, 1, 1 / 60, st);
		assert.ok(g.rpm >= p.idle * 0.9 && g.rpm <= p.red * 1.02, `rpm ${g.rpm} in range`);
		if (g.gear > gear) { drops++; gear = g.gear; } else if (i > 30 && g.gear === gear && g.load > 0) assert.ok(g.rpm >= last - 60, 'no fall within a gear');
		last = g.rpm;
	}
	assert.ok(gear >= 3, `reached gear ${gear + 1} by 48 m/s`);
	assert.ok(drops >= 3);
});

test('a gentle throttle changes up sooner than full throttle', () => {
	const run = (thr) => { const st = {}; for (let v = 0; v < 20; v += 0.05) { const g = gearbox(PROFILES.hatch, v, thr, 1 / 60, st); if (g.gear > 0) return v; } return 99; };
	assert.ok(run(0.3) < run(1), 'part throttle shifts at a lower speed');
});

test('pulling away the clutch slips: revs above idle before the car moves; no load during a change', () => {
	const p = PROFILES.sports, st = {};
	let g;
	for (let i = 0; i < 30; i++) g = gearbox(p, 0, 1, 1 / 60, st);
	assert.ok(g.rpm > p.idle * 1.5, `revs ${g.rpm}`);
	const s2 = { gear: 0, rpm: p.red * 0.95 };
	const up = gearbox(p, p.gears[0] * 0.97, 1, 1 / 60, s2);
	assert.equal(up.shifted, 1); assert.equal(up.load, 0, 'the throttle is off through the change');
	assert.equal(gearbox(p, -3, 0.5, 1 / 60, { gear: 3 }).gear, 0, 'reverse is the first gear');
});

test('firing note by cylinders; trucks and buses idle low, sports cars rev high', () => {
	assert.equal(firingHz(PROFILES.pickup, 3000), 200);
	assert.equal(firingHz(PROFILES.sedan, 3000), 100);
	assert.ok(PROFILES.truck.red < 2600 && PROFILES.bus.idle <= 600 && PROFILES.sports.red >= 7500);
	assert.equal(profileOf('unknown'), PROFILES.sedan);
	for (const k of ['sedan', 'hatch', 'crossover', 'suv', 'pickup', 'van', 'delivery', 'sports', 'truck', 'bus', 'tank', 'apc', 'jeep', 'jet', 'heli']) assert.ok(PROFILES[k], k);
});

test('a jet spools up over seconds and winds down slower', () => {
	const [up, down] = PROFILES.jet.spool;
	let n = PROFILES.jet.idle, t = 0;
	while (n < 0.99 && t < 20) { n = spool(n, 1, 0.05, up, down); t += 0.05; }
	assert.ok(t > 2 && t < 4, `spool-up ${t.toFixed(2)} s`);
	let u = 1, s = 0;
	while (u > PROFILES.jet.idle + 0.01) { u = spool(u, PROFILES.jet.idle, 0.05, up, down); s += 0.05; }
	assert.ok(s > t * 0.9);
});

test('distance, air and Doppler', () => {
	assert.equal(distanceGain(2, 6), 1);
	assert.ok(distanceGain(60, 6) < distanceGain(20, 6));
	assert.equal(distanceGain(1000, 6, 900), 0);
	assert.ok(distanceGain(800, 6, 900) < distanceGain(700, 6, 900) * 0.9);
	assert.ok(airCutoff(10) > 15000 && airCutoff(1000) < 2500 && airCutoff(1e6) === 500);
	assert.ok(doppler(-30) > 1 && doppler(30) < 1 && doppler(0) === 1);
	assert.ok(doppler(-1e4) <= 1.45 && doppler(1e4) >= 0.7);
});

test('voice picking: the loudest few, without flicker, and fewer on a phone', () => {
	assert.ok(budgetFor(true).engines < budgetFor(false).engines && budgetFor(true).traffic < budgetFor(false).traffic);
	const list = Array.from({ length: 10 }, (_, i) => ({ id: i, score: i / 10 }));
	const a = pickVoices(list, new Set(), 3);
	assert.deepEqual([...a].sort(), [7, 8, 9]);
	// one already sounding keeps its voice against a slightly louder newcomer
	const b = pickVoices([{ id: 'old', score: 0.5 }, { id: 'new', score: 0.6 }], new Set(['old']), 1);
	assert.ok(b.has('old'));
	assert.ok(pickVoices([{ id: 'old', score: 0.3 }, { id: 'new', score: 0.6 }], new Set(['old']), 1).has('new'));
	assert.equal(pickVoices([{ id: 1, score: 0 }], new Set(), 3).size, 0, 'silent sources get none');
});

test('thrust follows speed on a log scale and the push of acceleration', () => {
	assert.ok(thrustOf(0, 0, 40) < 0.2);
	assert.ok(thrustOf(40, 0, 40) > thrustOf(10, 0, 40));
	assert.ok(thrustOf(10, 20, 40) > thrustOf(10, 0, 40));
	assert.ok(thrustOf(1e5, 0, 3e5) > 0.5 && thrustOf(1e5, 0, 3e5) <= 1);
});

test('engines: at most the budget sound, the rest sleep and let go; a stopped engine releases every node', async () => {
	const { ctx, nodes } = fakeAudio();
	const E = await loadEngines(ctx);
	const cam = camAt();
	E.enginesFrame(1 / 60, cam, {});
	const list = Array.from({ length: 10 }, (_, i) => E.engineVoice(i % 2 ? 'truck' : 'sedan', 2));
	const frame = (dt = 0.1) => { list.forEach((e, i) => e.set({ speed: 10, throttle: 0.5, where: { x: 10 + i * 8, y: 1.7, z: 0 } })); E.enginesFrame(dt, cam, {}); };
	for (let i = 0; i < 5; i++) frame();
	let I = E.engineInfo();
	assert.equal(I.awake, I.budget.engines, 'only the budget is awake');
	assert.ok(I.list.filter((v) => v.awake).every((v) => v.d <= 10 + 8 * I.budget.engines), 'the nearest are the ones heard');
	// the far ones never made nodes; their states still follow
	assert.ok(I.list.every((v) => v.rpm > 0));
	// the car you drive outranks the rest
	const mine = E.carEngine('sports');
	mine.drive({ speed: 20, throttle: 1, where: { x: 200, y: 1.7, z: 0, inside: true } });
	frame();
	assert.ok(E.engineInfo().list.find((v) => v.prio === 3).awake);
	for (const e of list) e.stop();
	mine.stop();
	for (let i = 0; i < 20; i++) E.enginesFrame(0.1, cam, {});
	I = E.engineInfo();
	assert.equal(I.voices, 0); assert.equal(I.live, 0, 'every voice node let go');
	const voiceNodes = nodes.filter((n) => n.started && !n.gone && !n.stopped);
	assert.equal(voiceNodes.length, 0, `still running: ${voiceNodes.map((n) => n.kind).join(',')}`);
});

test('traffic: a few voices for the nearest cars, the hum for the rest, all let go when the street is empty', async () => {
	const { ctx } = fakeAudio();
	const E = await loadEngines(ctx);
	const cam = camAt();
	E.enginesFrame(1 / 60, cam, {});
	const T = E.createTraffic();
	const cars = Array.from({ length: 12 }, (_, i) => ({ kind: i % 3 ? 'sedan' : 'bus', px: 5 + i * 6, py: 1, pz: 3, vx: 10, vz: 0, v: 10 }));
	for (let i = 0; i < 5; i++) T.update(0.1, cars, cam, { on: 1 });
	const I = E.engineInfo();
	assert.equal(I.traffic, I.budget.traffic);
	const live = I.live;
	assert.ok(live > 0);
	for (let i = 0; i < 50; i++) T.update(0.1, [], cam, { on: 1 });
	assert.equal(E.engineInfo().live, 0, 'the pool let go of its nodes');
});
