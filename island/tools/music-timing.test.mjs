// Music timing (music/automusic.js with index.html's L99Clock stood in): while the faceplate's
// sequencer runs, the world's auto music plays inside its steps, stamped with their audio
// times, and starts its bars on the pattern's bar lines; with the sequencer stopped it keeps
// its own clock; with the audio held it plays nothing.
import test from 'node:test';
import assert from 'node:assert/strict';

const el = () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, append() {}, blur() {}, isConnected: false });
globalThis.window = globalThis;
globalThis.document = { hidden: false, createElement: el };
globalThis.localStorage = { getItem: () => JSON.stringify({ on: false, level: 0.7 }), setItem() {} };

// the faceplate: its audio clock, its stamp and its instruments, recorded
const audio = { t: 10, state: 'running' };
let stamp = null;
const played = [];
window._masterClip = { context: audio };
window.L99Clock = {
	now: () => audio.t, lead: () => 0.1, late() {},
	onAt: () => (stamp !== null ? stamp : typeof window._seqAt === 'number' ? window._seqAt : null),
	at(t, fn) { const was = stamp; stamp = t; try { return fn(); } finally { stamp = was; } },
};
window.playLead = (id) => { played.push({ id, at: window.L99Clock.onAt() }); };
window.stopLead = () => {};
window.playDrum = (name) => { played.push({ id: 'drum:' + name, at: window.L99Clock.onAt() }); };
let seqRunning = true;
window.autoSynth = { state: () => ({ face: 'BARD', scale: 'VILLAGE', scaleId: 'MAJOR', intervals: [0, 2, 4, 5, 7, 9, 11, 12], root: 0, octave: 0, bpm: 120, faceBpm: 120, swing: 0, beat: null, beatLoopOn: false, sequencerRunning: seqRunning, leads: [], trims: [1, 1, 1] }) };

const { createAutoMusic } = await import('../src/music/automusic.js');
const make = () => {
	const si = globalThis.setInterval;
	globalThis.setInterval = () => 0;
	try { return createAutoMusic({ world: () => null, active: () => true, shared: null }); } finally { globalThis.setInterval = si; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// one sequencer step, as index.html's tick runs it
function tick(step, at) {
	window._seqAt = at;
	try { for (const h of window._seqStepHooks || []) h(step % 16, 16, step, at); } finally { window._seqAt = null; }
}

test('locked to the sequencer: every note on a step\'s audio time, bars on its bar lines', async () => {
	const M = make();
	M.auto(true, true);
	try {
		assert.ok(window._seqStepHooks?.size, 'the score listens to the sequencer');
		played.length = 0;
		// two bars of the pattern, starting mid-bar, a sixteenth = 125 ms at 120 bpm
		const T0 = 20, times = new Set();
		for (let s = 6; s < 6 + 32 + 10; s++) { const at = T0 + s * 0.125; times.add(at); tick(s, at); }
		assert.ok(played.length > 10, 'it played (' + played.length + ')');
		for (const p of played) assert.ok(times.has(p.at), p.id + ' on a step: ' + p.at);
		// the score's bar lines are the pattern's: its bars (chord, bass) come in on the pattern's step 0
		const steps = new Set(played.map((p) => Math.round((p.at - T0) / 0.125)));
		assert.ok(steps.has(16) && steps.has(32), 'notes on the bar lines: ' + [...steps].sort((a, b) => a - b).join(' '));
		const P = M.pulse();
		assert.ok(P.playing);
		assert.equal(M.state().bpm, 120, 'the faceplate\'s tempo, at once');
		// its own clock stands aside while the sequencer plays
		const n = played.length;
		await sleep(150);
		assert.equal(played.length, n, 'no notes of its own between the sequencer\'s steps');
	} finally { M.auto(false, true); }
});

test('the sequencer stopped: the score keeps its own clock', async () => {
	window._seqStepHooks?.clear();
	seqRunning = false;
	const M = make();
	played.length = 0;
	M.auto(true, true);
	await sleep(1200);
	M.auto(false, true);
	assert.ok(played.length > 0, 'it played on its own (' + played.length + ')');
	seqRunning = true;
});

test('the audio held (a call, another app): nothing is queued for its return', async () => {
	window._seqStepHooks?.clear();
	seqRunning = false;
	audio.state = 'interrupted';
	const M = make();
	played.length = 0;
	M.auto(true, true);
	await sleep(900);
	M.auto(false, true);
	assert.equal(played.length, 0);
	audio.state = 'running';
	seqRunning = true;
});
