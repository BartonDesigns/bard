// The kit's sounds, made on the spot through the world's sound bus (world/soundbus.js): no
// recordings. Each cue is a few short layers (a sharp transient, a body of filtered noise, a low
// thump, a tail), and distance takes the top off and lets the tail lead.
//
// playCue(name, { distance, gain }): marksman, scout, pulse, bow, dry, cell-out, cell-in, ready,
// charge, equip, holster, aim.

import { noise, soundBus } from '../world/soundbus.js';

export const CUES = ['marksman', 'scout', 'pulse', 'bow', 'dry', 'cell-out', 'cell-in', 'ready', 'charge', 'equip', 'holster', 'aim'];

function voice(ctx, out) {
	// a noise burst through a filter, shaped by an envelope
	const burst = (t, colour, type, f, q, peak, attack, decay, f2 = null) => {
		const s = ctx.createBufferSource(); s.buffer = noise(ctx, colour); s.loop = true;
		const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.setValueAtTime(f, t); bq.Q.value = q;
		if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t + attack + decay);
		const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
		s.connect(bq); bq.connect(g); g.connect(out);
		s.start(t, Math.random() * 3); s.stop(t + attack + decay + 0.05);
	};
	// a tone gliding from f0 to f1
	const tone = (t, type, f0, f1, peak, attack, decay) => {
		const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
		const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
		o.connect(g); g.connect(out); o.start(t); o.stop(t + attack + decay + 0.05);
	};
	const click = (t, f = 3200, peak = 0.3) => burst(t, 'white', 'bandpass', f, 2.5, peak, 0.001, 0.025);
	return { burst, tone, click };
}

const LAYERS = {
	marksman: (v, t, far) => {
		v.burst(t, 'white', 'highpass', 2500, 0.7, 0.9 * (1 - far * 0.8), 0.001, 0.012);
		v.burst(t, 'white', 'bandpass', 950, 0.6, 0.9, 0.002, 0.13, 420);
		v.tone(t, 'sine', 90, 38, 0.9, 0.003, 0.2);
		v.burst(t + 0.02, 'pink', 'lowpass', 1400, 0.5, 0.22 + far * 0.3, 0.03, 0.75, 300);
	},
	scout: (v, t, far) => {
		v.burst(t, 'white', 'highpass', 3000, 0.7, 0.8 * (1 - far * 0.8), 0.001, 0.01);
		v.burst(t, 'white', 'bandpass', 1300, 0.7, 0.75, 0.002, 0.1, 520);
		v.tone(t, 'sine', 110, 45, 0.7, 0.003, 0.16);
		v.burst(t + 0.02, 'pink', 'lowpass', 1700, 0.5, 0.18 + far * 0.3, 0.03, 0.6, 340);
	},
	// the energy kit: a zap, a sub, a crackle, a shimmer
	pulse: (v, t, far) => {
		v.tone(t, 'sawtooth', 1600, 180, 0.28, 0.002, 0.09);
		v.tone(t, 'sine', 95, 60, 0.6, 0.003, 0.09);
		v.burst(t, 'white', 'highpass', 4500, 0.8, 0.35 * (1 - far * 0.7), 0.001, 0.04);
		v.tone(t + 0.01, 'triangle', 2600, 1700, 0.08, 0.005, 0.07);
		v.burst(t + 0.015, 'pink', 'bandpass', 700, 0.8, 0.08 + far * 0.2, 0.02, 0.3, 250);
	},
	bow: (v, t) => { v.tone(t, 'triangle', 190, 140, 0.35, 0.003, 0.28); v.burst(t, 'white', 'bandpass', 2400, 1.5, 0.25, 0.004, 0.07, 900); },
	dry: (v, t) => { v.click(t, 2600, 0.25); },
	'cell-out': (v, t) => { v.click(t, 2200, 0.3); v.burst(t + 0.02, 'white', 'bandpass', 1800, 1.2, 0.12, 0.01, 0.12, 900); v.click(t + 0.16, 1500, 0.2); },
	'cell-in': (v, t) => { v.burst(t, 'white', 'bandpass', 1500, 1, 0.12, 0.01, 0.08); v.click(t + 0.09, 1900, 0.45); v.tone(t + 0.09, 'sine', 180, 120, 0.25, 0.002, 0.06); },
	ready: (v, t) => { v.click(t, 2800, 0.3); v.tone(t + 0.04, 'sine', 420, 900, 0.07, 0.03, 0.12); },
	charge: (v, t) => { v.tone(t, 'sine', 300, 1200, 0.1, 0.06, 0.28); v.tone(t, 'triangle', 600, 2400, 0.04, 0.06, 0.28); },
	equip: (v, t) => { v.burst(t, 'pink', 'bandpass', 2800, 0.8, 0.1, 0.03, 0.16); v.click(t + 0.18, 2400, 0.18); },
	holster: (v, t) => { v.burst(t, 'pink', 'bandpass', 2400, 0.8, 0.09, 0.03, 0.2); },
	aim: (v, t) => { v.burst(t, 'pink', 'bandpass', 3200, 1, 0.05, 0.02, 0.1); },
};

// distance in metres (0: your own hands)
export function playCue(name, { distance = 0, gain = 1 } = {}) {
	const L = LAYERS[name], B = L && soundBus();
	if (!B) return false;
	const { ctx, out } = B, t = ctx.currentTime + 0.005, far = Math.min(1, distance / 150);
	const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000 / (1 + distance / 30);
	const g = ctx.createGain(); g.gain.value = gain * 0.6 * Math.min(1, 8 / (8 + distance));
	lp.connect(g); g.connect(out);
	L(voice(ctx, lp), t, far);
	setTimeout(() => { lp.disconnect(); g.disconnect(); }, 1500);
	return true;
}
