import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* L99_COHESION_120 /');
const script = html.slice(start, html.indexOf('</script>', start));
function bridge() {
	const saved = new Map();
	const env = { window: { addEventListener() {} }, document: { addEventListener() {} }, localStorage: { getItem: k => saved.get(k), setItem: (k,v) => saved.set(k,v) }, bpm: 120, sequencerRunning: false, activeVoices: {}, ctx: { state: 'running', currentTime: 4 } };
	runInNewContext(script, env); return env;
}
const analyser = (hz, fft = 2048, sampleRate = 48000) => ({ context: { state: 'running', sampleRate }, fftSize: fft, frequencyBinCount: fft/2, getByteFrequencyData(a) { a.fill(0); for (let i = 0; i < a.length; i++) if (Math.abs(i*sampleRate/fft-hz) < 100) a[i] = 220; } });
test('standalone Crysis hears mic/decks before legacy flight loads, honoring mic opt-in', () => {
	const e = bridge(), c = e.window.L99Continuity;
	e.window._micAnalyser = analyser(160, 4096, 44100);
	c.sample(0); assert.equal(c.bands.bass, 0);
	e.window._micActive = true; c.sample(200); assert.ok(c.bands.bass > .4);
	e.window._micActive = false; e.window._djReactiveAnalyser = analyser(900, 1024);
	c.sample(400); assert.ok(c.bands.mid > .05);
});
test('sources with different FFTs merge by frequency and a suspended source contributes nothing', () => {
	const e = bridge(), c = e.window.L99Continuity;
	e.analyser = analyser(160); e.window._djReactiveAnalyser = analyser(900, 8192, 44100);
	c.sample(0); c.sample(200); assert.ok(c.bands.bass > .4); assert.ok(c.bands.mid > .05);
	e.analyser.context.state = 'suspended'; e.window._djReactiveAnalyser.context.state = 'suspended';
	for (let t = 400; t < 4000; t += 200) c.sample(t);
	assert.ok(c.bands.bass < .001 && c.bands.mid < .001);
});
test('scheduled voices wait for the audio clock; released voices disappear; DJ tempo uses audible weight', () => {
	const e = bridge(), c = e.window.L99Continuity;
	e.activeVoices.a = { targetFreq: 440, velocity: .7, audibleAt: 5, _startedAt: 1 };
	assert.equal(c.performance().notes.length, 0);
	e.ctx.currentTime = 5; assert.equal(c.performance().notes[0].frequency, 440);
	delete e.activeVoices.a; assert.equal(c.performance().notes.length, 0);
	e.window._djDominantBpm = () => ({ bpm: 142, gain: .8 }); assert.equal(c.performance().bpm, 142);
	assert.equal(c.musicMode(), false); c.musicMode(true); assert.equal(c.performance().musicMode, true);
});
