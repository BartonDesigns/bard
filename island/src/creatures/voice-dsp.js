// The pieces the creatures' voices are built from (creatures/voice.js, voice-kit.js): a throat,
// air, a struck thing ringing, water, a room. All of it rendered offline into Float32Arrays at
// the context's sample rate; nothing here touches the audio graph.
//
//   throat(sr, {...})           a voice: pulses at f0 through the mouth's formants
//   whoosh(sr, dur, f0, f1)     a limb, a blade, a wing through the air
//   struck(sr, n, modes)        a tap ringing through modes [[f, tau, gain], ...]
//   bubbles(sr, dur, rate)      water, rising
//   tone(sr, dur, f, env)       a sustained tone with harmonics
//   hiss / thump / reverb / seamless / resonate / lowpass / highpass / normalise / sum

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// a two-pole resonator ringing at f Hz, its ring dying away over tau seconds
export function resonate(x, sr, f, tau, gain = 1) {
	const out = new Float32Array(x.length), r = Math.exp(-1 / (tau * sr)), c = 2 * r * Math.cos(TAU * f / sr), r2 = r * r;
	let y1 = 0, y2 = 0;
	for (let i = 0; i < x.length; i++) { const y = x[i] + c * y1 - r2 * y2; y2 = y1; y1 = y; out[i] = y * gain * (1 - r); }
	return out;
}
export function lowpass(d, sr, f) { const a = 1 - Math.exp(-TAU * f / sr); let y = 0; for (let i = 0; i < d.length; i++) { y += (d[i] - y) * a; d[i] = y; } return d; }
export function highpass(d, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0, x1 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x1); x1 = x; d[i] = y; } return d; }
export function normalise(d, peak = 0.9) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; return d; }
export function sum(n, ...parts) { const o = new Float32Array(n); for (const [p, g] of parts) for (let i = 0; i < n; i++) o[i] += p[i] * g; return o; }
// a shaped by b: every sample of a scaled by env(t)
export function shape(d, env) { const n = d.length; for (let i = 0; i < n; i++) d[i] *= env(i / n); return d; }
// b laid into a from `at` seconds, this loud
export function lay(a, sr, b, at, g = 1) { const i0 = Math.floor(at * sr); for (let i = 0; i < b.length && i0 + i < a.length; i++) a[i0 + i] += b[i] * g; return a; }

// a voice from the throat: a train of pulses at about f0 Hz (jittered, the rattle of a growl)
// with breath under it, shaped by an envelope, through the mouth's formants
export function throat(sr, { dur, f0, jitter, breath, formants, env, seed, glide = null, top = 3200 }) {
	const n = Math.floor(sr * dur), x = new Float32Array(n), R = rnd(seed);
	let next = 0;
	for (let i = 0; i < n; i++) {
		const t = i / n, e = env(t);
		if (i >= next) {
			x[i] += e * (0.7 + R() * 0.6);
			// (the gap to the next pulse wanders: the voice catches and rattles)
			const f = f0 * (glide ? glide(t) : 1) * (1 + Math.sin(i / sr * 5.3) * 0.08) * (1 + (R() * 2 - 1) * jitter);
			next = i + Math.max(2, Math.floor(sr / f));
		}
		x[i] += (R() * 2 - 1) * breath * e;
	}
	const parts = formants.map(([f, tau, g]) => [resonate(x, sr, f, tau), g]);
	return normalise(lowpass(sum(n, ...parts), sr, top));
}
// a room round a sound: a few combs feeding back, as a hall does (mix 0..1 of it, tail of fb)
export function reverb(x, sr, mix = 0.4, fb = 0.78) {
	const n = x.length, wet = new Float32Array(n);
	for (const ms of [29.7, 37.1, 41.1, 43.7]) {
		const D = Math.floor(sr * ms / 1000), buf = new Float32Array(D);
		let w = 0;
		for (let i = 0; i < n; i++) { const y = x[i] + buf[w] * fb; buf[w] = y; wet[i] += y * 0.25; w = (w + 1) % D; }
	}
	for (let i = 0; i < n; i++) x[i] = x[i] * (1 - mix) + wet[i] * mix;
	return x;
}
// noise shaped by an envelope e(t) (0..1 over the sound), coloured between lo and hi Hz
export function hiss(sr, dur, e, lo, hi, seed) {
	const n = Math.floor(sr * dur), d = new Float32Array(n), R = rnd(seed);
	for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * e(i / n);
	return lowpass(highpass(d, sr, lo), sr, hi);
}
// a sine falling from f1 to f0 Hz, dying over tau s: a thump, a thud
export function thump(sr, n, f0, f1, tau, fall = 25) {
	const d = new Float32Array(n);
	for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(TAU * (f0 + (f1 - f0) * Math.exp(-t * fall)) * t) * Math.exp(-t / tau); }
	return d;
}
// a loop's seam taken out: the last `edge` seconds cross-faded into its first, and that cut off
export function seamless(d, sr, edge) {
	const m = Math.floor(sr * edge), n = d.length - m, out = new Float32Array(n);
	out.set(d.subarray(0, n));
	for (let i = 0; i < m; i++) { const k = i / m; out[i] = out[i] * k + d[n + i] * (1 - k); }
	return out;
}
// a swept band of air: something through it, the band sliding from f0 Hz to f1 over dur
export function whoosh(sr, dur, f0, f1, seed = 1, env = (t) => Math.pow(Math.sin(Math.PI * t), 1.5), q = 0.35) {
	const n = Math.floor(sr * dur), d = new Float32Array(n), R = rnd(seed);
	let y1 = 0, y2 = 0;
	for (let i = 0; i < n; i++) {
		const t = i / n, f = f0 * Math.pow(f1 / f0, t), r = Math.exp(-TAU * f * q / sr), c = 2 * r * Math.cos(TAU * f / sr);
		const y = (R() * 2 - 1) + c * y1 - r * r * y2; y2 = y1; y1 = y;
		d[i] = y * (1 - r) * env(t);
	}
	return normalise(d);
}
// a struck thing ringing: a hard tap at `at` s (hard samples long) through modes [[f, tau, g]]
export function struck(sr, n, modes, { at = 0, hard = 40, seed = 1 } = {}) {
	const tap = new Float32Array(n), R = rnd(seed), i0 = Math.floor(at * sr);
	for (let k = 0; k < hard && i0 + k < n; k++) tap[i0 + k] = (R() * 2 - 1) * Math.exp(-k / (hard / 4));
	return sum(n, ...modes.map(([f, tau, g]) => [resonate(tap, sr, f, tau), g]));
}
// water: bubbles rising, each a short chirp upward, about `rate` a second, between lo and hi Hz
export function bubbles(sr, dur, rate, seed, lo = 120, hi = 900) {
	const n = Math.floor(sr * dur), d = new Float32Array(n), R = rnd(seed);
	for (let i = 0; i < n; i++) if (R() < rate / sr) {
		const f = lo + R() * (hi - lo), m = Math.floor(sr * (0.03 + R() * 0.06)), a = 0.3 + R() * 0.7;
		for (let k = 0; k < m && i + k < n; k++) { const u = k / m; d[i + k] += Math.sin(TAU * f * (1 + u * 0.6) * k / sr) * Math.sin(Math.PI * u) * a; }
	}
	return d;
}
// a sustained tone at f(t) Hz with harmonics (their gains), shaped by env(t)
export function tone(sr, dur, f, env, harm = [1]) {
	const n = Math.floor(sr * dur), d = new Float32Array(n);
	let ph = 0;
	for (let i = 0; i < n; i++) { const t = i / n; ph += TAU * f(t) / sr; let s = 0; for (let h = 0; h < harm.length; h++) s += Math.sin(ph * (h + 1)) * harm[h]; d[i] = s * env(t); }
	return d;
}
// an envelope: up over `a` of the sound, flat, down from `r`; and one in pulses
export const adsr = (a, r, p = 1) => (t) => Math.min(1, t / a) * Math.pow(1 - clamp((t - r) / (1 - r), 0, 1), p);
export const pulses = (times, w, env = (u) => Math.sin(Math.PI * u)) => (t) => { let e = 0; for (const t0 of times) { const u = (t - t0) / w; if (u >= 0 && u < 1) e = Math.max(e, env(u)); } return e; };
