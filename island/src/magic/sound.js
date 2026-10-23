// The sound of magic, all made here (no recordings), the way the creatures' voices are
// (creatures/voice.js): each piece rendered once per audio context into a short buffer, then
// played where it happened through the world's bus (world/soundbus.js), panned to its side of
// where you look and dulled with distance, a little different every time. Every piece is built
// the same way so the schools sound like one craft: a sub-bass weight under it (the thump of
// the air moving), a body that is the school's own (a sun's harmonic swell, a void's tearing,
// thunder's clap, fire's roar, a bell of glass), the air round it, and a light saturation so
// it sits full rather than thin. Three pieces a school: the cast at your hands, a bolt's hit
// and an area blast. Josh: deep, full, lush; nothing tinny or high and thin.

import { soundBus } from '../world/soundbus.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- building blocks (every one a plain array; nothing here touches Web Audio) ----------
const secs = (sr, t) => Math.round(sr * t);
function noise(n, seed = 1) { const r = rnd(seed), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = r() * 2 - 1; return o; }
// a tone whose pitch slides from f0 to f1 (exponentially) over its length, with shape 'sine',
// 'saw' (band-limited enough: a few harmonics) or 'tri'
function tone(n, sr, f0, f1, shape = 'sine', seed = 0) {
	const o = new Float32Array(n), r = f1 / f0;
	let ph = (seed % 7) / 7;
	for (let i = 0; i < n; i++) {
		const f = f0 * Math.pow(r, i / n);
		ph += f / sr; if (ph > 1) ph -= 1;
		const x = ph * TAU;
		o[i] = shape === 'saw' ? Math.sin(x) + Math.sin(2 * x) / 2 + Math.sin(3 * x) / 3 + Math.sin(4 * x) / 4 + Math.sin(5 * x) / 5 : shape === 'tri' ? Math.sin(x) - Math.sin(3 * x) / 9 + Math.sin(5 * x) / 25 : Math.sin(x);
	}
	return o;
}
// an envelope: up over a, flat for h, down over d (seconds), applied in place
function env(d, sr, a, h, r, shape = 2) {
	const A = secs(sr, a), H = secs(sr, h), R = secs(sr, r);
	for (let i = 0; i < d.length; i++) {
		let g = 1;
		if (i < A) g = Math.pow(i / A, 1 / shape);
		else if (i > A + H) g = Math.pow(Math.max(0, 1 - (i - A - H) / R), shape);
		d[i] *= g;
	}
	return d;
}
// an exponential fall from 1 with time constant tau, from t0
function fall(d, sr, tau, t0 = 0) { const a = secs(sr, t0); for (let i = 0; i < d.length; i++) d[i] *= i < a ? 1 : Math.exp(-(i - a) / (tau * sr)); return d; }
// the opposite: a swell that rises to the end (a thing gathering)
function rise(d, sr, pow = 2) { const n = d.length; for (let i = 0; i < n; i++) d[i] *= Math.pow(i / n, pow); return d; }
// one-pole filters, run in place; the cutoff may slide from f0 to f1
function lowpass(d, sr, f0, f1 = f0) { let y = 0; const n = d.length; for (let i = 0; i < n; i++) { const f = f0 * Math.pow(f1 / f0, i / n), a = 1 - Math.exp(-TAU * f / sr); y += (d[i] - y) * a; d[i] = y; } return d; }
function highpass(d, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0, x1 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x1); x1 = x; d[i] = y; } return d; }
// a band round f (two-pole, q its width), the centre sliding f0 to f1
function bandpass(d, sr, f0, f1 = f0, q = 1) {
	const o = new Float32Array(d.length), n = d.length;
	let z1 = 0, z2 = 0;
	for (let i = 0; i < n; i++) {
		const f = f0 * Math.pow(f1 / f0, i / n), w = TAU * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
		const b0 = al / a0, a1 = -2 * cs / a0, a2 = (1 - al) / a0, x = d[i], y = b0 * x + z1;
		z1 = -a1 * y + z2; z2 = -b0 * x - a2 * y;
		o[i] = y;
	}
	return o;
}
// a two-pole resonator ringing at f Hz, its ring dying away over tau seconds, driven by x
function resonate(x, sr, f, tau, gain = 1) {
	const out = new Float32Array(x.length), r = Math.exp(-1 / (tau * sr)), c = 2 * r * Math.cos(TAU * f / sr), r2 = r * r;
	let y1 = 0, y2 = 0;
	for (let i = 0; i < x.length; i++) { const y = x[i] + c * y1 - r2 * y2; y2 = y1; y1 = y; out[i] = y * gain * (1 - r); }
	return out;
}
// a short click to set a resonator ringing
function impulse(n, sr, at = 0, len = 0.002) { const o = new Float32Array(n), a = secs(sr, at), l = Math.max(1, secs(sr, len)); for (let i = 0; i < l && a + i < n; i++) o[a + i] = 1 - i / l; return o; }
// amplitude wobble at hz, depth 0..1 (a flutter, a roar's unevenness), in place
function flutter(d, sr, hz, depth, seed = 3) { const r = rnd(seed); let ph = r(); for (let i = 0; i < d.length; i++) { ph += hz * (0.8 + 0.4 * r()) / sr; d[i] *= 1 - depth * (0.5 + 0.5 * Math.sin(ph * TAU)); } return d; }
function mix(n, ...parts) { const o = new Float32Array(n); for (const [p, g] of parts) if (p) for (let i = 0; i < Math.min(n, p.length); i++) o[i] += p[i] * g; return o; }
// the fullness: a soft clip, so the peaks round off and the body comes forward
function saturate(d, drive = 1.6) { for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * drive) / Math.tanh(drive); return d; }
function fadeOut(d, sr, t = 0.06) { const n = secs(sr, t); for (let i = 0; i < n && i < d.length; i++) d[d.length - 1 - i] *= i / n; return d; }
function normalise(d, peak = 0.9) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; return d; }

// ---------- the common layers ----------
// the weight under everything: a sub that drops in pitch as it dies, with a soft click at its front
function sub(n, sr, f0 = 60, f1 = 34, tau = 0.22, gain = 1) {
	const s = fall(tone(n, sr, f0, f1), sr, tau);
	const k = lowpass(fall(noise(n, 11), sr, 0.006), sr, 900);
	return mix(n, [s, gain], [k, gain * 0.5]);
}
// the air moving: a whoosh, its band sweeping (rising to a cast, falling from a hit)
function air(n, sr, f0, f1, q = 0.8, seed = 5) { return bandpass(noise(n, seed), sr, f0, f1, q); }
// a low rumble that hangs on after (thunder, a blast's tail)
function rumble(n, sr, tau = 0.6, f = 110, seed = 9) { return fall(lowpass(flutter(noise(n, seed), sr, 9, 0.5, seed), sr, f), sr, tau, 0.02); }
// a chord of detuned partials, each a little off the others (a swell, lush rather than pure)
function chord(n, sr, fs, shape = 'sine', detune = 0.004, seed = 2) {
	const r = rnd(seed), parts = [];
	for (const f of fs) for (const k of [-1, 1]) parts.push([tone(n, sr, f * (1 + k * detune * (0.6 + r() * 0.8)), f * (1 + k * detune), shape, seed + parts.length), 1 / (fs.length * 2)]);
	return mix(n, ...parts);
}
// a bell: partials in a glassy ratio, each ringing out at its own rate
function bell(n, sr, f, tau = 0.5, gain = 1) {
	return mix(n, [fall(tone(n, sr, f, f), sr, tau), gain * 0.5], [fall(tone(n, sr, f * 2.01, f * 2.01), sr, tau * 0.6), gain * 0.3], [fall(tone(n, sr, f * 2.76, f * 2.76), sr, tau * 0.4), gain * 0.14], [fall(tone(n, sr, f * 4.13, f * 4.13), sr, tau * 0.25), gain * 0.06]);
}
// a sparse crackle: impulses, their density growing toward the end (lean > 0) or fading (lean < 0), through a band
function crackle(n, sr, rate = 300, f = 1500, lean = 0, seed = 13) { const r = rnd(seed), c = new Float32Array(n); for (let i = 0; i < n; i++) if (r() < rate / sr * (1 + lean * (2 * i / n - 1))) c[i] = (r() * 2 - 1) * 2; return highpass(c, sr, f); }
// the crack of a hit: a hard transient of bright noise, over before the body comes
function crack(n, sr, f = 2500, tau = 0.012, seed = 7) { return fall(highpass(noise(n, seed), sr, f), sr, tau); }

// ---------- each school's body ----------
// cast: ~0.7 s at your hands; hit: ~0.6 s where a bolt lands; blast: ~1.4 s, an area let go
const BODY = {
	// the sun's school: a warm harmonic swell, gold bells over it, bright air
	radiance: {
		cast(n, sr) { return mix(n, [env(lowpass(chord(n, sr, [220, 330, 440, 660], 'saw'), sr, 700, 4500), sr, 0.06, 0.1, 0.5), 0.8], [fall(bell(n, sr, 1319, 0.5), sr, 0.45, 0.04), 0.8], [env(air(n, sr, 500, 2200, 0.7), sr, 0.04, 0.05, 0.4), 0.5]); },
		hit(n, sr) { return mix(n, [crack(n, sr, 2200, 0.015), 1], [fall(lowpass(chord(n, sr, [330, 440, 660], 'saw'), sr, 2800, 500), sr, 0.22), 0.9], [fall(bell(n, sr, 1760, 0.3), sr, 0.3), 0.4]); },
		blast(n, sr) { return mix(n, [crack(n, sr, 1800, 0.03), 1], [fall(lowpass(chord(n, sr, [165, 220, 330, 440], 'saw'), sr, 3200, 300), sr, 0.6), 1], [fall(bell(n, sr, 880, 0.8), sr, 0.7, 0.04), 0.5], [rumble(n, sr, 0.5, 140), 0.8]); },
	},
	// life's school: breath and a soft choir, a low warm bed
	restoration: {
		cast(n, sr) { return mix(n, [env(lowpass(chord(n, sr, [131, 165, 196, 262], 'tri', 0.006), sr, 300, 1000), sr, 0.25, 0.2, 0.3), 1], [env(air(n, sr, 300, 700, 0.4), sr, 0.3, 0.1, 0.35), 0.7], [fall(bell(n, sr, 1047, 0.6), sr, 0.6, 0.25), 0.3]); },
		hit(n, sr) { return mix(n, [env(lowpass(chord(n, sr, [392, 494, 587], 'tri', 0.006), sr, 2000, 500), sr, 0.03, 0.05, 0.4), 1], [fall(bell(n, sr, 1175, 0.4), sr, 0.35), 0.35], [fall(air(n, sr, 1500, 500, 0.6), sr, 0.12), 0.4]); },
		blast(n, sr) { return mix(n, [env(lowpass(chord(n, sr, [196, 262, 330, 392], 'tri', 0.006), sr, 300, 2400), sr, 0.1, 0.3, 0.8), 1], [fall(bell(n, sr, 784, 0.9), sr, 0.9, 0.1), 0.45], [env(air(n, sr, 400, 1800, 0.5), sr, 0.1, 0.2, 0.6), 0.5]); },
	},
	// the ward's school: struck metal and stone, a shield ringing shut
	warding: {
		cast(n, sr) { const k = impulse(n, sr, 0.03, 0.003); return mix(n, [resonate(k, sr, 520, 0.45, 40), 1.2], [resonate(k, sr, 1300, 0.3, 30), 0.8], [resonate(k, sr, 3100, 0.12, 20), 0.4], [env(lowpass(chord(n, sr, [130, 196], 'saw'), sr, 300, 900), sr, 0.03, 0.15, 0.4), 0.4]); },
		hit(n, sr) { const k = impulse(n, sr, 0, 0.003); return mix(n, [crack(n, sr, 3000, 0.01), 0.9], [resonate(k, sr, 780, 0.25, 40), 1], [resonate(k, sr, 2100, 0.12, 25), 0.5], [fall(lowpass(chord(n, sr, [196, 260], 'saw'), sr, 1400, 400), sr, 0.18), 0.7]); },
		blast(n, sr) { const k = impulse(n, sr, 0, 0.004); return mix(n, [crack(n, sr, 2000, 0.03), 1], [resonate(k, sr, 390, 0.7, 40), 1], [resonate(k, sr, 1040, 0.35, 30), 0.5], [fall(lowpass(chord(n, sr, [98, 147, 196], 'saw'), sr, 1600, 250), sr, 0.5), 0.9], [rumble(n, sr, 0.45, 120), 0.6]); },
	},
	// the dawn's school: a shimmer rising like light, a chime
	dawn: {
		cast(n, sr) { return mix(n, [env(mix(n, [tone(n, sr, 294, 440, 'tri'), 0.3], [tone(n, sr, 370, 554, 'tri'), 0.3], [tone(n, sr, 440, 659, 'sine'), 0.3], [tone(n, sr, 587, 880, 'sine'), 0.2]), sr, 0.15, 0.1, 0.4), 1], [fall(bell(n, sr, 2349, 0.35), sr, 0.35, 0.3), 0.3], [env(air(n, sr, 1500, 6000, 0.5), sr, 0.15, 0.05, 0.35), 0.45]); },
		hit(n, sr) { return mix(n, [crack(n, sr, 2600, 0.012), 0.8], [fall(lowpass(chord(n, sr, [440, 554, 659], 'tri', 0.005), sr, 3600, 600), sr, 0.2), 1], [fall(bell(n, sr, 2093, 0.3), sr, 0.3), 0.4]); },
		blast(n, sr) { return mix(n, [crack(n, sr, 2000, 0.025), 0.9], [fall(lowpass(chord(n, sr, [220, 277, 330, 440], 'tri', 0.005), sr, 4000, 400), sr, 0.55), 1], [fall(bell(n, sr, 1047, 0.8), sr, 0.8, 0.03), 0.5], [rumble(n, sr, 0.4, 150), 0.6]); },
	},
	// the shadow's school: a swell drawn in from the dark, a whisper, a low drone
	shadow: {
		cast(n, sr) { return mix(n, [env(bandpass(noise(n, 21), sr, 400, 1600, 0.6), sr, 0.3, 0, 0.2, 3), 0.7], [env(flutter(air(n, sr, 2600, 1800, 1.5), sr, 13, 0.8), sr, 0.3, 0.1, 0.3), 0.8], [env(lowpass(chord(n, sr, [55, 82], 'saw', 0.008), sr, 120, 400), sr, 0.25, 0.15, 0.3), 0.8]); },
		hit(n, sr) { return mix(n, [fall(lowpass(noise(n, 22), sr, 1200, 150), sr, 0.08), 1], [fall(lowpass(chord(n, sr, [73, 110], 'saw', 0.008), sr, 700, 120), sr, 0.25), 1], [fall(flutter(air(n, sr, 3000, 1800, 2), sr, 15, 0.8), sr, 0.2), 0.3]); },
		blast(n, sr) { return mix(n, [rise(lowpass(noise(n, 23), sr, 100, 900).subarray(0, secs(sr, 0.3)), sr, 2), 0.8], [fall(lowpass(noise(n, 24), sr, 1500, 100), sr, 0.35, 0.3), 1], [fall(lowpass(chord(n, sr, [41, 55, 82], 'saw', 0.008), sr, 800, 90), sr, 0.6, 0.3), 1], [rumble(n, sr, 0.7, 90), 0.8]); },
	},
	// the void's school: the deepest, a sub that drops away, the air tearing, an implosion
	void: {
		cast(n, sr) { return mix(n, [rise(tone(n, sr, 30, 52), sr, 1.3), 1.2], [rise(flutter(bandpass(noise(n, 31), sr, 120, 260, 2), sr, 5, 0.95), sr, 1.5), 1], [rise(tone(n, sr, 90, 156, 'saw'), sr, 2), 0.25]); },
		hit(n, sr) { return mix(n, [fall(tone(n, sr, 70, 28), sr, 0.3), 1], [fall(flutter(bandpass(noise(n, 33), sr, 500, 140, 1.2), sr, 8, 0.9), sr, 0.25), 0.8], [fall(lowpass(noise(n, 34), sr, 400, 60), sr, 0.3), 0.9]); },
		blast(n, sr) { const pull = secs(sr, 0.35); const r = rise(lowpass(noise(n, 35), sr, 80, 1200), sr, 3); for (let i = pull; i < n; i++) r[i] = 0; return mix(n, [r, 0.9], [fall(tone(n, sr, 60, 22), sr, 0.6, 0.35), 1], [fall(lowpass(noise(n, 36), sr, 600, 50), sr, 0.4, 0.35), 1], [fall(flutter(bandpass(noise(n, 37), sr, 400, 120, 1.2), sr, 6, 0.9), sr, 0.5, 0.35), 0.6], [rumble(n, sr, 0.9, 70), 0.9]); },
	},
	// the blight's school: a gurgle of rot, bubbles bursting, a sick low drone
	blight: {
		cast(n, sr) { const r = rnd(41), b = new Float32Array(n); for (let k = 0; k < 12; k++) { const at = secs(sr, 0.05 + r() * 0.5), f = 500 + r() * 700, l = secs(sr, 0.06); for (let i = 0; i < l && at + i < n; i++) b[at + i] += Math.sin(TAU * f * Math.pow(0.5, i / l) * i / sr) * (1 - i / l); } return mix(n, [b, 1.1], [env(flutter(bandpass(noise(n, 42), sr, 650, 280, 1.5), sr, 11, 0.9, 42), sr, 0.08, 0.2, 0.4), 0.9], [env(lowpass(chord(n, sr, [65, 98, 139], 'saw', 0.01), sr, 150, 500), sr, 0.1, 0.2, 0.35), 0.9]); },
		hit(n, sr) { return mix(n, [fall(lowpass(noise(n, 43), sr, 2500, 300), sr, 0.05), 1], [fall(flutter(bandpass(noise(n, 44), sr, 500, 150, 1.5), sr, 14, 0.9, 44), sr, 0.25), 0.9], [fall(lowpass(chord(n, sr, [87, 130], 'saw', 0.01), sr, 600, 150), sr, 0.25), 0.8]); },
		blast(n, sr) { return mix(n, [fall(lowpass(noise(n, 45), sr, 2000, 200), sr, 0.1), 1], [fall(flutter(bandpass(noise(n, 46), sr, 400, 120, 1.5), sr, 10, 0.9, 46), sr, 0.6), 1], [fall(lowpass(chord(n, sr, [49, 73, 110], 'saw', 0.01), sr, 500, 100), sr, 0.6), 0.9], [rumble(n, sr, 0.6, 100), 0.7]); },
	},
	// the umbral school: a cold breath drawn in, a snap of frost, the dark's hush
	umbral: {
		cast(n, sr) { return mix(n, [env(bandpass(noise(n, 51), sr, 2400, 1200, 0.7), sr, 0.04, 0.1, 0.5), 0.8], [env(lowpass(chord(n, sr, [98, 147, 196], 'tri', 0.006), sr, 200, 900), sr, 0.15, 0.2, 0.35), 0.9], [fall(bell(n, sr, 1397, 0.4), sr, 0.4, 0.1), 0.5]); },
		hit(n, sr) { const k = impulse(n, sr, 0, 0.002); return mix(n, [crack(n, sr, 4000, 0.008), 0.9], [resonate(k, sr, 940, 0.18, 40), 0.8], [fall(lowpass(chord(n, sr, [110, 165], 'tri', 0.006), sr, 1200, 200), sr, 0.22), 1], [fall(bandpass(noise(n, 52), sr, 2400, 800, 0.7), sr, 0.15), 0.5]); },
		blast(n, sr) { const k = impulse(n, sr, 0, 0.003); return mix(n, [crack(n, sr, 3000, 0.02), 0.9], [resonate(k, sr, 470, 0.5, 40), 0.7], [fall(lowpass(chord(n, sr, [65, 98, 131], 'tri', 0.006), sr, 1400, 150), sr, 0.6), 1], [fall(bandpass(noise(n, 53), sr, 2000, 500, 0.7), sr, 0.5), 0.5], [rumble(n, sr, 0.6, 90), 0.7]); },
	},
	// the storm's school: the crackle of a charge, then thunder
	storm: {
		cast(n, sr) { return mix(n, [env(crackle(n, sr, 500, 1500, 0.8, 61), sr, 0.02, 0.45, 0.2), 1.2], [rise(bandpass(noise(n, 62), sr, 300, 1800, 1.5), sr, 2), 0.4], [env(lowpass(chord(n, sr, [55, 110], 'saw', 0.01), sr, 150, 500), sr, 0.15, 0.3, 0.25), 0.6]); },
		hit(n, sr) { return mix(n, [crack(n, sr, 1200, 0.03), 1], [fall(lowpass(noise(n, 63), sr, 4000, 400), sr, 0.12), 1], [rumble(n, sr, 0.35, 160, 64), 0.9]); },
		blast(n, sr) { return mix(n, [crack(n, sr, 900, 0.05), 1], [fall(lowpass(noise(n, 65), sr, 5000, 300), sr, 0.25), 1], [rumble(n, sr, 0.9, 130, 66), 1], [fall(tone(n, sr, 65, 40), sr, 0.4), 0.6]); },
	},
	// the chrono school: a clock's tick, glass ringing, a held breath of time
	chrono: {
		cast(n, sr) { const ks = [0.02, 0.17, 0.32, 0.47].map((t, i) => resonate(impulse(n, sr, t, 0.0015), sr, i % 2 ? 1900 : 2400, 0.07, 40)); return mix(n, ...ks.map((k) => [k, 0.9]), [env(tone(n, sr, 523, 523, 'sine'), sr, 0.1, 0.3, 0.3), 0.3], [fall(bell(n, sr, 2093, 0.5), sr, 0.5, 0.02), 0.6], [fall(bell(n, sr, 1397, 0.6), sr, 0.6, 0.33), 0.4]); },
		hit(n, sr) { const k = impulse(n, sr, 0, 0.0015); return mix(n, [crack(n, sr, 4500, 0.006), 0.8], [resonate(k, sr, 3100, 0.12, 40), 0.6], [fall(bell(n, sr, 1568, 0.35), sr, 0.35), 0.8], [fall(lowpass(chord(n, sr, [196, 294], 'sine', 0.003), sr, 1200, 300), sr, 0.25), 0.8]); },
		blast(n, sr) { const k = impulse(n, sr, 0, 0.002); return mix(n, [crack(n, sr, 3500, 0.015), 0.8], [resonate(k, sr, 1240, 0.6, 40), 0.6], [fall(bell(n, sr, 784, 1), sr, 1, 0.02), 0.8], [fall(lowpass(chord(n, sr, [131, 196, 262], 'sine', 0.003), sr, 1500, 200), sr, 0.7), 0.9], [rumble(n, sr, 0.5, 110), 0.5]); },
	},
	// the primal school: fire's roar, embers, the earth's thud
	primal: {
		cast(n, sr) { return mix(n, [env(flutter(bandpass(noise(n, 71), sr, 220, 480, 0.8), sr, 14, 0.9, 71), sr, 0.05, 0.25, 0.4), 1.2], [env(crackle(n, sr, 320, 1100, -0.5, 72), sr, 0.05, 0.3, 0.3), 0.6], [env(lowpass(chord(n, sr, [82, 123], 'saw', 0.01), sr, 200, 600), sr, 0.05, 0.25, 0.35), 0.5]); },
		hit(n, sr) { return mix(n, [crack(n, sr, 1600, 0.02), 0.9], [fall(flutter(bandpass(noise(n, 73), sr, 700, 250, 0.6), sr, 12, 0.7, 73), sr, 0.25), 1], [fall(flutter(highpass(noise(n, 74), sr, 3500), sr, 45, 0.95, 74), sr, 0.3), 0.3], [fall(lowpass(chord(n, sr, [98, 147], 'saw', 0.01), sr, 900, 200), sr, 0.25), 0.8]); },
		blast(n, sr) { return mix(n, [crack(n, sr, 1200, 0.04), 1], [fall(flutter(bandpass(noise(n, 75), sr, 600, 200, 0.6), sr, 10, 0.7, 75), sr, 0.7), 1], [fall(flutter(highpass(noise(n, 76), sr, 3000), sr, 40, 0.95, 76), sr, 0.9), 0.3], [rumble(n, sr, 0.8, 100, 77), 1], [fall(tone(n, sr, 58, 36), sr, 0.45), 0.6]); },
	},
};
const SCHOOLS = Object.keys(BODY);
// how heavy each piece's sub is, and its length
const PIECE = { cast: { t: 0.75, sub: 0.4, f0: 58, f1: 40, tau: 0.28, drive: 1.25 }, hit: { t: 0.65, sub: 0.8, f0: 72, f1: 36, tau: 0.2, drive: 1.6 }, blast: { t: 1.5, sub: 1.1, f0: 64, f1: 28, tau: 0.5, drive: 1.8 } };
function piece(school, kind, sr) {
	const P = PIECE[kind], n = secs(sr, P.t), body = BODY[school][kind](n, sr);
	// (a cast's sub comes in as the body swells; a hit's lands at once)
	const s = sub(n, sr, P.f0, P.f1, P.tau, P.sub);
	if (kind === 'cast') env(s, sr, 0.12, 0.1, 0.4);
	return fadeOut(normalise(saturate(mix(n, [body, 1], [s, 1]), P.drive)), sr);
}

// ---------- the rest: gathering, a level, a fizzle, the body's skills, the menu ----------
const SMALL = {
	// fabric gathered: a soft warm pulse, low, with a glint
	gather(n, sr) { return normalise(saturate(mix(n, [env(lowpass(chord(n, sr, [196, 294, 392], 'tri', 0.005), sr, 400, 1600), sr, 0.05, 0.2, 0.4), 1], [fall(bell(n, sr, 1175, 0.4), sr, 0.4, 0.05), 0.3], [sub(n, sr, 55, 40, 0.2, 0.4), 1]), 1.4)); },
	// a level gained: a full rising chord, bells on top, held
	level(n, sr) { return normalise(saturate(mix(n, [env(lowpass(chord(n, sr, [131, 196, 262, 330, 392], 'saw', 0.005), sr, 300, 3000), sr, 0.2, 0.5, 0.7), 1], [fall(bell(n, sr, 1047, 0.9), sr, 0.9, 0.3), 0.4], [fall(bell(n, sr, 1568, 0.7), sr, 0.7, 0.6), 0.3], [sub(n, sr, 65, 45, 0.5, 0.5), 1]), 1.5)); },
	// a fizzle: a damp sputter that falls away
	fizzle(n, sr) { return normalise(saturate(mix(n, [fall(flutter(bandpass(noise(n, 81), sr, 700, 200, 1), sr, 25, 0.9, 81), sr, 0.15), 1], [fall(lowpass(chord(n, sr, [147, 110], 'saw', 0.02), sr, 800, 150), sr, 0.2), 0.8]), 1.3)); },
	// the body's skills (the skills menu): a bow's thrum, a footfall and breath, a shield's knock
	marksman(n, sr) { const k = impulse(n, sr, 0, 0.002); return normalise(saturate(mix(n, [resonate(k, sr, 220, 0.3, 40), 1], [resonate(k, sr, 440, 0.15, 30), 0.5], [fall(air(n, sr, 2000, 600, 0.7), sr, 0.1), 0.5], [sub(n, sr, 55, 40, 0.15, 0.5), 1]), 1.4)); },
	athletics(n, sr) { return normalise(saturate(mix(n, [fall(lowpass(noise(n, 82), sr, 400, 150), sr, 0.1), 1], [env(air(n, sr, 500, 1500, 0.6), sr, 0.1, 0.1, 0.3), 0.6], [sub(n, sr, 60, 42, 0.18, 0.7), 1]), 1.4)); },
	resilience(n, sr) { const k = impulse(n, sr, 0, 0.003); return normalise(saturate(mix(n, [resonate(k, sr, 330, 0.3, 40), 1], [resonate(k, sr, 660, 0.15, 25), 0.4], [fall(lowpass(noise(n, 83), sr, 800, 200), sr, 0.08), 0.8], [sub(n, sr, 60, 38, 0.2, 0.8), 1]), 1.5)); },
};
const SMALL_T = { gather: 0.8, level: 1.8, fizzle: 0.5, marksman: 0.5, athletics: 0.5, resilience: 0.5 };

// every piece there is: 'radiance', 'radiance-hit', 'radiance-blast', ... 'gather', 'level', ...
export const PIECES = [...SCHOOLS.flatMap((s) => [s, `${s}-hit`, `${s}-blast`]), ...Object.keys(SMALL)];
// a piece's name to its school and kind (an unknown name is the sun's cast)
export function pieceOf(name) {
	const m = /^(.+?)(?:-(hit|blast))?$/.exec(name || ''), s = m?.[1], k = m?.[2] || 'cast';
	if (SMALL[s] && k === 'cast') return { small: s };
	return { school: BODY[s] ? s : 'radiance', kind: k };
}
export function renderSpellSound(name, sr = 48000) {
	const p = pieceOf(name);
	if (p.small) return fadeOut(SMALL[p.small](secs(sr, SMALL_T[p.small]), sr), sr);
	return piece(p.school, p.kind, sr);
}

// ---------- playing them ----------
// eye(): where you listen from ({ x, y, z }); yaw(): which way you look (as combat's)
export function createSpellSound({ eye = () => null, yaw = () => 0, isPhone = false } = {}) {
	const cache = new WeakMap();
	const cap = isPhone ? 5 : 12, far = 140;
	let playing = 0;
	function buf(c, name) {
		let m = cache.get(c);
		if (!m) { m = {}; cache.set(c, m); }
		if (!m[name]) {
			// (rendered at 24 kHz, whatever the context runs at: nothing in these lives above 12 kHz, and it
			// is half the work on a phone; the context resamples)
			const sr = Math.min(c.sampleRate, 24000), d = renderSpellSound(name, sr), b = c.createBuffer(1, d.length, sr);
			b.getChannelData(0).set(d);
			m[name] = b;
		}
		return m[name];
	}
	// name at `at` (or at you, when null), this loud, pitched by rate, after `delay` seconds
	function play(name, at = null, gain = 1, rate = 1, delay = 0) {
		if (playing >= cap) return false;
		try {
			const B = soundBus();
			if (!B) return false;
			const c = B.ctx, e = eye();
			let d = 0, pan = 0;
			if (at && e) {
				const dx = at.x - e.x, dz = at.z - e.z;
				d = Math.hypot(dx, dz, (at.y || 0) - (e.y || 0));
				if (d > far) return false;
				const a = yaw(), rx = Math.cos(a), rz = -Math.sin(a);
				pan = d > 0.5 ? clamp((dx * rx + dz * rz) / d, -0.85, 0.85) : 0;
			}
			const src = c.createBufferSource(), g = c.createGain();
			src.buffer = buf(c, name);
			src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
			// (the sound of a thing far off: quieter, and the air takes its highs first)
			g.gain.value = gain * Math.pow(Math.max(0, 1 - d / far), 1.4) * (0.9 + Math.random() * 0.2);
			let tail = g;
			const f = d > 8 ? c.createBiquadFilter() : null;
			if (f) { f.type = 'lowpass'; f.frequency.value = Math.max(500, 11000 - d * 110); src.connect(f).connect(g); } else src.connect(g);
			const p = pan && c.createStereoPanner ? c.createStereoPanner() : null;
			if (p) { p.pan.value = pan; g.connect(p); tail = p; }
			tail.connect(B.out);
			playing++;
			src.onended = () => { playing--; src.disconnect(); g.disconnect(); f?.disconnect(); p?.disconnect(); };
			src.start(c.currentTime + delay);
			return true;
		} catch { return false; }
	}
	// have these ready before they are needed (a school's three pieces when it is bound), one a
	// slice of idle time, so a first cast never stalls a frame on the render
	let warming = null;
	function warm(names) {
		const todo = [];
		for (const name of names) if (name) todo.push(name);
		if (!todo.length) return;
		const later = typeof requestIdleCallback === 'function' ? (f) => requestIdleCallback(f, { timeout: 2000 }) : (f) => setTimeout(f, 120);
		const step = () => {
			warming = null;
			const B = soundBus();
			if (!B) { warming = later(step); return; }
			const m = cache.get(B.ctx), name = todo.find((x) => !m?.[x]);
			if (!name) return;
			try { buf(B.ctx, name); } catch { return; }
			warming = later(step);
		};
		if (!warming) warming = later(step);
	}
	return { play, warm, get playing() { return playing; } };
}

// the one the game plays through (magic/index.js starts it with your eye; fx.js's magicSound
// goes to it): before it is started, pieces play unplaced
let live = createSpellSound();
export const spellSound = () => live;
export function startSpellSound(opts) { live = createSpellSound(opts); return live; }
