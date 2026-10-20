// The creatures' voices, all made here (no recordings), the way combat/melee-sound.js makes the
// sounds of a fist fight: each piece rendered once per audio context into a short buffer, then
// played where the creature is, through the world's bus (world/soundbus.js), panned to its side
// of where you look and dulled with distance, pitched down for a big one and a little different
// every time. A hound's growl (a rattle deep in the chest), its snarl as it springs, its snuffling
// at the ground and its claws raking the dirt; the Burnt Giant's groan of wood waking; the
// clicking of a thing with too many legs.

import { soundBus } from '../world/soundbus.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// a two-pole resonator ringing at f Hz, its ring dying away over tau seconds
function resonate(x, sr, f, tau, gain = 1) {
	const out = new Float32Array(x.length), r = Math.exp(-1 / (tau * sr)), c = 2 * r * Math.cos(TAU * f / sr), r2 = r * r;
	let y1 = 0, y2 = 0;
	for (let i = 0; i < x.length; i++) { const y = x[i] + c * y1 - r2 * y2; y2 = y1; y1 = y; out[i] = y * gain * (1 - r); }
	return out;
}
function lowpass(d, sr, f) { const a = 1 - Math.exp(-TAU * f / sr); let y = 0; for (let i = 0; i < d.length; i++) { y += (d[i] - y) * a; d[i] = y; } return d; }
function highpass(d, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0, x1 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x1); x1 = x; d[i] = y; } return d; }
function normalise(d, peak = 0.9) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; return d; }
function sum(n, ...parts) { const o = new Float32Array(n); for (const [p, g] of parts) for (let i = 0; i < n; i++) o[i] += p[i] * g; return o; }

// a voice from the throat: a train of pulses at about f0 Hz (jittered, the rattle of a growl)
// with breath under it, shaped by an envelope, through the mouth's formants
function throat(sr, { dur, f0, jitter, breath, formants, env, seed }) {
	const n = Math.floor(sr * dur), x = new Float32Array(n), R = rnd(seed);
	let next = 0;
	for (let i = 0; i < n; i++) {
		const t = i / n, e = env(t);
		if (i >= next) {
			x[i] += e * (0.7 + R() * 0.6);
			// (the gap to the next pulse wanders: the voice catches and rattles)
			const f = f0 * (1 + Math.sin(i / sr * 5.3) * 0.08) * (1 + (R() * 2 - 1) * jitter);
			next = i + Math.max(2, Math.floor(sr / f));
		}
		x[i] += (R() * 2 - 1) * breath * e;
	}
	const parts = formants.map(([f, tau, g]) => [resonate(x, sr, f, tau), g]);
	return normalise(lowpass(sum(n, ...parts), sr, 3200));
}

const MAKE = {
	// a low growl, swelling and falling, rattling in the chest
	growl: (sr) => throat(sr, {
		dur: 1.9, f0: 31, jitter: 0.35, breath: 0.25, seed: 11,
		formants: [[190, 0.035, 1], [480, 0.025, 0.7], [1050, 0.015, 0.35]],
		env: (t) => Math.min(1, t / 0.15) * (1 - clamp((t - 0.7) / 0.3, 0, 1)) * (0.75 + 0.25 * Math.sin(t * 19)),
	}),
	// the snarl as it springs: higher, harder, all at once
	snarl: (sr) => throat(sr, {
		dur: 0.65, f0: 58, jitter: 0.25, breath: 0.45, seed: 23,
		formants: [[380, 0.02, 1], [900, 0.016, 0.8], [1900, 0.01, 0.45]],
		env: (t) => Math.min(1, t / 0.04) * Math.pow(1 - t, 1.4),
	}),
	// snuffling at the ground: quick pulls of air through the nose
	sniff(sr) {
		const n = Math.floor(sr * 0.75), d = new Float32Array(n), R = rnd(5);
		for (const t0 of [0, 0.14, 0.27, 0.48, 0.6]) {
			const i0 = Math.floor(t0 * sr), m = Math.floor(0.09 * sr);
			for (let i = 0; i < m && i0 + i < n; i++) d[i0 + i] += (R() * 2 - 1) * Math.sin(Math.PI * i / m);
		}
		return normalise(lowpass(highpass(d, sr, 900), sr, 5000), 0.6);
	},
	// claws raked back through dirt: grit, and the pad's dull thump as it plants
	scrape(sr) {
		const n = Math.floor(sr * 0.42), d = new Float32Array(n), R = rnd(9);
		for (let i = 0; i < n; i++) {
			const t = i / n, e = Math.sin(Math.PI * Math.min(1, t * 1.3)) * (1 - t * 0.5);
			d[i] = (R() * 2 - 1) * e * 0.5 + (R() < 0.004 ? (R() * 2 - 1) * 4 : 0) * e;
		}
		const grit = highpass(d, sr, 1600);
		const thump = new Float32Array(n);
		for (let i = 0; i < Math.min(n, sr * 0.12); i++) { const t = i / sr; thump[i] = Math.sin(TAU * (70 + 50 * Math.exp(-t * 40)) * t) * Math.exp(-t * 30); }
		return normalise(sum(n, [grit, 1], [thump, 0.8]));
	},
	// old wood waking: a slow stick-slip groan, deep, cracking as it goes
	creak(sr) {
		const n = Math.floor(sr * 2.6), x = new Float32Array(n), R = rnd(31);
		let next = 0;
		for (let i = 0; i < n; i++) {
			const t = i / n, e = Math.min(1, t / 0.2) * (1 - clamp((t - 0.75) / 0.25, 0, 1));
			if (i >= next) {
				x[i] += e * (0.5 + R());
				const f = 38 + 55 * (0.5 + 0.5 * Math.sin(t * 7.1 + Math.sin(t * 2.3) * 2));
				next = i + Math.floor(sr / f * (1 + (R() - 0.5) * 0.5));
			}
			if (R() < 0.0006) for (let k = 0; k < 40 && i + k < n; k++) x[i + k] += (R() * 2 - 1) * 2 * Math.exp(-k / 8);
		}
		return normalise(lowpass(sum(n, [resonate(x, sr, 260, 0.06), 1], [resonate(x, sr, 640, 0.04), 0.6], [resonate(x, sr, 1500, 0.02), 0.3]), sr, 2600));
	},
	// clicking: mandibles, too many legs
	chitter(sr) {
		const n = Math.floor(sr * 0.55), d = new Float32Array(n), R = rnd(17);
		for (let t = 0; t < 0.5; t += 0.028 + R() * 0.02) {
			const i0 = Math.floor(t * sr);
			for (let k = 0; k < 90 && i0 + k < n; k++) d[i0 + k] += (R() * 2 - 1) * Math.exp(-k / 14);
		}
		return normalise(resonate(highpass(d, sr, 1200), sr, 3100, 0.004, 1));
	},
};
// (for the tests)
export const VOICES = Object.keys(MAKE);
export const renderVoice = (name, sr = 48000) => MAKE[name](sr);

export function createCreatureVoice({ eye, yaw, isPhone = false }) {
	const cache = new WeakMap();
	const cap = isPhone ? 3 : 6, far = 80;
	let playing = 0;
	function buf(c, name) {
		let m = cache.get(c);
		if (!m) { m = {}; cache.set(c, m); }
		if (!m[name]) {
			const d = MAKE[name](c.sampleRate), b = c.createBuffer(1, d.length, c.sampleRate);
			b.getChannelData(0).set(d);
			m[name] = b;
		}
		return m[name];
	}
	// name at `at`, this loud, pitched by rate (lower for a bigger one)
	function play(name, at, gain = 1, rate = 1) {
		if (playing >= cap || !MAKE[name]) return;
		try {
			const B = soundBus();
			if (!B) return;
			const c = B.ctx, e = eye();
			const dx = at.x - e.x, dz = at.z - e.z, d = Math.hypot(dx, dz);
			if (d > far) return;
			const a = yaw(), pan = d > 0.3 ? clamp((dx * Math.cos(a) - dz * Math.sin(a)) / d, -0.85, 0.85) : 0;
			const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
			src.buffer = buf(c, name);
			src.playbackRate.value = rate * (0.92 + Math.random() * 0.16);
			g.gain.value = gain * Math.pow(Math.max(0, 1 - d / far), 1.6) * (0.85 + Math.random() * 0.3);
			f.type = 'lowpass'; f.frequency.value = Math.max(600, 12000 - d * 160);
			src.connect(f).connect(g);
			let tail = g;
			const p = c.createStereoPanner ? c.createStereoPanner() : null;
			if (p) { p.pan.value = pan; g.connect(p); tail = p; }
			tail.connect(B.out);
			playing++;
			src.onended = () => { playing--; src.disconnect(); f.disconnect(); g.disconnect(); p?.disconnect(); };
			src.start();
		} catch { /* no audio: the world goes on without it */ }
	}
	return { play };
}
