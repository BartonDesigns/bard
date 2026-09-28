// Sounds made sample by sample, once, into plain arrays: footfalls on every kind of ground,
// the murmur of people talking, a child's laugh, a call across a beach, cutlery, typing.
// Nothing here touches Web Audio (bank.js turns the arrays into buffers), so it runs in node
// for tests too. Every result is mono; its loudness is set by the caller.

// a small seeded random
export function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// a two-pole filter (the audio cookbook's): lowpass, highpass, bandpass (0 dB peak)
function biquad() {
	let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
	return {
		set(type, f, q, sr) {
			const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
			if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
			else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
			else { b0 = al; b1 = 0; b2 = -al; }
			b0 /= a0; b1 /= a0; b2 /= a0; a1 = -2 * cs / a0; a2 = (1 - al) / a0;
			return this;
		},
		run(x) { const y = b0 * x + z1; z1 = b1 * x - a1 * y + z2; z2 = b2 * x - a2 * y; return y; },
	};
}

// ---------- building blocks, each added into `out` ----------
// a burst of filtered noise: rises over `at`, then dies away with time constant `tau`
function noiseBurst(out, sr, R, t0, { type = 'bp', f = 1000, q = 0.7, amp = 1, at = 0.002, tau = 0.03 }) {
	const bq = biquad().set(type, f, q, sr), i0 = Math.floor(t0 * sr), n = Math.min(out.length - i0, Math.floor((at + tau * 6) * sr));
	for (let i = 0; i < n; i++) {
		const t = i / sr, env = t < at ? t / at : Math.exp(-(t - at) / tau);
		out[i0 + i] += bq.run(R() * 2 - 1) * env * amp;
	}
}
// a struck mode: a sine dying away, its pitch falling a little from the blow
function mode(out, sr, t0, { f, amp, tau, drop = 0, at = 0.0008 }) {
	const i0 = Math.floor(t0 * sr), n = Math.min(out.length - i0, Math.floor(tau * 7 * sr));
	let ph = 0;
	for (let i = 0; i < n; i++) {
		const t = i / sr, ff = f * (1 + drop * Math.exp(-t / 0.012));
		ph += 2 * Math.PI * ff / sr;
		out[i0 + i] += Math.sin(ph) * amp * Math.min(1, t / at) * Math.exp(-t / tau);
	}
}
// many tiny grains (gravel, snow, twigs): each a click of band-passed noise, bunched early
function grains(out, sr, R, t0, { n, span, fLo, fHi, amp, dur = 0.0008, q = 1.4, bunch = 1.6 }) {
	for (let k = 0; k < n; k++) {
		const t = t0 + span * Math.pow(R(), bunch), a = amp * (0.3 + R() * 0.7) * (1 - 0.6 * (t - t0) / span);
		noiseBurst(out, sr, R, t, { type: 'bp', f: fLo * Math.pow(fHi / fLo, R()), q, amp: a, at: 0.0002, tau: dur * (0.5 + R()) });
	}
}
// a short sine chirp (a snow squeak, a water drop)
function chirp(out, sr, t0, { f0, f1, dur, amp }) {
	const i0 = Math.floor(t0 * sr), n = Math.min(out.length - i0, Math.floor(dur * sr));
	let ph = 0;
	for (let i = 0; i < n; i++) {
		const k = i / n, f = f0 * Math.pow(f1 / f0, k);
		ph += 2 * Math.PI * f / sr;
		out[i0 + i] += Math.sin(ph) * amp * Math.sin(Math.PI * k) ** 2;
	}
}

// ---------- footfalls ----------
// one contact of the foot (heel or toe) on each surface, at t with strength a
const CONTACT = {
	road: (o, sr, R, t, a) => {
		mode(o, sr, t, { f: 90 + R() * 15, amp: 0.45 * a, tau: 0.016, drop: 0.4 });
		noiseBurst(o, sr, R, t, { f: 2100 + R() * 500, q: 0.8, amp: 0.9 * a, at: 0.0008, tau: 0.009 });
		grains(o, sr, R, t + 0.002, { n: 6, span: 0.04, fLo: 3000, fHi: 7000, amp: 0.18 * a });
	},
	concrete: (o, sr, R, t, a) => {
		mode(o, sr, t, { f: 105 + R() * 15, amp: 0.4 * a, tau: 0.014, drop: 0.4 });
		noiseBurst(o, sr, R, t, { f: 2800 + R() * 600, q: 0.9, amp: 0.9 * a, at: 0.0006, tau: 0.008 });
		grains(o, sr, R, t + 0.002, { n: 3, span: 0.03, fLo: 3500, fHi: 8000, amp: 0.12 * a });
	},
	stone: (o, sr, R, t, a) => {
		mode(o, sr, t, { f: 120 + R() * 20, amp: 0.35 * a, tau: 0.012, drop: 0.3 });
		noiseBurst(o, sr, R, t, { f: 3400 + R() * 800, q: 1.2, amp: 1 * a, at: 0.0005, tau: 0.007 });
		mode(o, sr, t, { f: 1800 + R() * 400, amp: 0.08 * a, tau: 0.02 });
		grains(o, sr, R, t + 0.003, { n: 4, span: 0.05, fLo: 2500, fHi: 6000, amp: 0.14 * a });
	},
	tile: (o, sr, R, t, a) => {
		mode(o, sr, t, { f: 110 + R() * 15, amp: 0.4 * a, tau: 0.018, drop: 0.3 });
		noiseBurst(o, sr, R, t, { f: 3000 + R() * 500, q: 1.1, amp: 1 * a, at: 0.0005, tau: 0.009 });
		mode(o, sr, t, { f: 2400 + R() * 300, amp: 0.06 * a, tau: 0.03 });
	},
	wood: (o, sr, R, t, a) => {
		// hollow: the boards' own low knock and the air under them
		mode(o, sr, t, { f: 95 + R() * 15, amp: 0.55 * a, tau: 0.03, drop: 0.3 });
		mode(o, sr, t, { f: 185 + R() * 25, amp: 0.45 * a, tau: 0.045 });
		mode(o, sr, t, { f: 410 + R() * 40, amp: 0.28 * a, tau: 0.03 });
		mode(o, sr, t, { f: 760 + R() * 80, amp: 0.12 * a, tau: 0.018 });
		noiseBurst(o, sr, R, t, { f: 1500, q: 1, amp: 0.35 * a, at: 0.0006, tau: 0.006 });
	},
	carpet: (o, sr, R, t, a) => {
		mode(o, sr, t, { f: 80 + R() * 10, amp: 0.5 * a, tau: 0.022, drop: 0.3 });
		noiseBurst(o, sr, R, t, { type: 'lp', f: 520, q: 0.6, amp: 0.45 * a, at: 0.002, tau: 0.025 });
		noiseBurst(o, sr, R, t + 0.01, { type: 'lp', f: 1300, q: 0.5, amp: 0.1 * a, at: 0.01, tau: 0.04 });
	},
	dirt: (o, sr, R, t, a) => {
		mode(o, sr, t, { f: 72 + R() * 10, amp: 0.5 * a, tau: 0.024, drop: 0.3 });
		noiseBurst(o, sr, R, t, { type: 'lp', f: 1400, q: 0.6, amp: 0.55 * a, at: 0.002, tau: 0.028 });
		grains(o, sr, R, t + 0.003, { n: 9, span: 0.06, fLo: 1500, fHi: 4200, amp: 0.14 * a, dur: 0.001 });
	},
	gravel: (o, sr, R, t, a) => {
		// crunchy: dozens of stones shifting against each other
		mode(o, sr, t, { f: 70 + R() * 10, amp: 0.3 * a, tau: 0.02, drop: 0.3 });
		noiseBurst(o, sr, R, t, { f: 2400, q: 0.6, amp: 0.2 * a, at: 0.01, tau: 0.04 });
		grains(o, sr, R, t, { n: 50, span: 0.12, fLo: 1100, fHi: 6500, amp: 0.34 * a, dur: 0.0011, q: 1.8 });
	},
	sand: (o, sr, R, t, a) => {
		// soft, dull: a hiss with no hard edge
		mode(o, sr, t, { f: 60 + R() * 8, amp: 0.25 * a, tau: 0.03, drop: 0.2 });
		noiseBurst(o, sr, R, t, { type: 'lp', f: 900 + R() * 200, q: 0.5, amp: 0.55 * a, at: 0.02, tau: 0.045 });
		grains(o, sr, R, t + 0.01, { n: 22, span: 0.1, fLo: 1800, fHi: 5000, amp: 0.05 * a, dur: 0.0015, bunch: 1 });
	},
	grass: (o, sr, R, t, a) => {
		// a swish of blades, a soft ground beneath
		mode(o, sr, t, { f: 70 + R() * 10, amp: 0.3 * a, tau: 0.022, drop: 0.3 });
		noiseBurst(o, sr, R, t, { type: 'hp', f: 2500 + R() * 600, q: 0.6, amp: 0.35 * a, at: 0.025, tau: 0.04 });
		noiseBurst(o, sr, R, t + 0.01, { f: 5200, q: 0.8, amp: 0.15 * a, at: 0.02, tau: 0.035 });
		grains(o, sr, R, t + 0.01, { n: 4, span: 0.06, fLo: 2000, fHi: 4000, amp: 0.08 * a });
	},
	snow: (o, sr, R, t, a) => {
		// the squeaky crunch of packed snow
		mode(o, sr, t, { f: 62 + R() * 8, amp: 0.3 * a, tau: 0.03, drop: 0.2 });
		noiseBurst(o, sr, R, t, { type: 'lp', f: 1000, q: 0.6, amp: 0.25 * a, at: 0.008, tau: 0.05 });
		grains(o, sr, R, t, { n: 36, span: 0.13, fLo: 380, fHi: 1900, amp: 0.3 * a, dur: 0.0016, q: 2, bunch: 1.2 });
		for (let k = 0; k < 6; k++) { const f = 650 + R() * 700; chirp(o, sr, t + 0.01 + R() * 0.11, { f0: f, f1: f * (1.1 + R() * 0.3), dur: 0.008 + R() * 0.014, amp: 0.13 * a }); }
	},
	water: (o, sr, R, t, a) => {
		// shallow water: the slosh, the spray, the drops falling back
		noiseBurst(o, sr, R, t, { type: 'lp', f: 320, q: 0.7, amp: 0.35 * a, at: 0.01, tau: 0.06 });
		noiseBurst(o, sr, R, t, { f: 1200 + R() * 300, q: 0.5, amp: 0.55 * a, at: 0.01, tau: 0.05 });
		noiseBurst(o, sr, R, t + 0.01, { type: 'hp', f: 3200, q: 0.5, amp: 0.25 * a, at: 0.005, tau: 0.03 });
		for (let k = 0; k < 5; k++) { const f = 700 + R() * 1300; chirp(o, sr, t + 0.03 + R() * 0.17, { f0: f, f1: f * 1.8, dur: 0.015 + R() * 0.025, amp: 0.14 * a }); }
	},
	metal: (o, sr, R, t, a) => {
		// a bridge's grating: a clang with a short inharmonic ring and a rattle
		mode(o, sr, t, { f: 110 + R() * 15, amp: 0.3 * a, tau: 0.02, drop: 0.3 });
		noiseBurst(o, sr, R, t, { f: 3000, q: 1, amp: 0.5 * a, at: 0.0005, tau: 0.006 });
		for (const [f, am, tau] of [[520, 0.25, 0.12], [1350, 0.2, 0.09], [2280, 0.15, 0.07], [3900, 0.1, 0.05]]) mode(o, sr, t, { f: f * (0.95 + R() * 0.1), amp: am * a, tau });
		grains(o, sr, R, t + 0.004, { n: 10, span: 0.06, fLo: 2000, fHi: 5000, amp: 0.15 * a });
	},
};
export const SURFACES = Object.keys(CONTACT);
// how loud each sounds against the others, by ear: soft ground quieter than hard
const LOUD = { road: 1, concrete: 1, stone: 0.95, tile: 0.9, wood: 1, carpet: 0.5, dirt: 0.75, gravel: 1, sand: 0.55, grass: 0.6, snow: 0.85, water: 0.95, metal: 0.9 };
const TAIL = { wood: 0.35, metal: 0.55, water: 0.45, snow: 0.35, gravel: 0.32, sand: 0.35 };

// the loudest 30 ms of a sound (its rms), for levelling
function peakRms(d, sr) {
	const w = Math.floor(sr * 0.03);
	let s = 0, best = 0;
	for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; if (i >= w) s -= d[i - w] * d[i - w]; if (s > best) best = s; }
	return Math.sqrt(best / w);
}
function level(d, sr, rms, fade = 0.02) {
	const r = peakRms(d, sr);
	let k = r > 0 ? rms / r : 1, pk = 0;
	for (const v of d) pk = Math.max(pk, Math.abs(v));
	k = Math.min(k, 0.98 / Math.max(pk, 1e-9));
	const nf = Math.floor(fade * sr);
	for (let i = 0; i < d.length; i++) d[i] *= k * (i > d.length - nf ? (d.length - i) / nf : 1);
	return d;
}

// one footfall: heel then toe (walking), or toe first and harder (running)
export function renderStep(surface, variant, sr, run = false) {
	const fn = CONTACT[surface] || CONTACT.dirt, R = rng(hash(surface) + variant * 7919 + (run ? 104729 : 0));
	const out = new Float32Array(Math.floor((TAIL[surface] || 0.26) * sr));
	const toe = run ? 0.022 + R() * 0.014 : 0.055 + R() * 0.03;
	fn(out, sr, R, 0.004, run ? 0.75 : 1);
	fn(out, sr, R, 0.004 + toe, run ? 1 : 0.5 + R() * 0.15);
	return level(out, sr, 0.22 * (LOUD[surface] || 0.8));
}
// landing from a jump: both feet at once, heavier
export function renderLand(surface, sr) {
	const fn = CONTACT[surface] || CONTACT.dirt, R = rng(hash(surface) + 17);
	const out = new Float32Array(Math.floor(((TAIL[surface] || 0.26) + 0.05) * sr));
	fn(out, sr, R, 0.004, 1); fn(out, sr, R, 0.016, 0.9); mode(out, sr, 0.004, { f: 58, amp: 0.5, tau: 0.04, drop: 0.5 });
	return level(out, sr, 0.3 * (LOUD[surface] || 0.8));
}

// ---------- voices ----------
// vowel formants (an adult man's), F1 F2 F3
const VOWELS = [[270, 2290, 3010], [390, 1990, 2550], [530, 1840, 2480], [660, 1720, 2410], [730, 1090, 2440], [570, 840, 2410], [440, 1020, 2240], [300, 870, 2240], [640, 1190, 2390], [500, 1500, 2500]];
const KIND = { man: { f0: 110, fs: 1 }, woman: { f0: 205, fs: 1.16 }, child: { f0: 290, fs: 1.3 } };

// one talker's plan, as control curves every `blk` samples: loudness, pitch, formants, and the
// hiss of the consonants. A phrase of syllables, a pause, another...
function speak(n, sr, R, { kind = 'man', f0 = null, talk = 0.6, style = 'talk', start = 0 }) {
	const K = KIND[kind], base = (f0 || K.f0) * (0.88 + R() * 0.24), blk = 64, nb = Math.ceil(n / blk);
	const C = { amp: new Float32Array(nb), f0: new Float32Array(nb).fill(base), F1: new Float32Array(nb), F2: new Float32Array(nb), F3: new Float32Array(nb), hiss: new Float32Array(nb), hf: new Float32Array(nb).fill(4000), breath: new Float32Array(nb) };
	const toB = (t) => Math.floor(t * sr / blk);
	let t = start, V = VOWELS[9];
	const fill = (a, b, fn) => { for (let k = Math.max(0, toB(a)); k < Math.min(nb, toB(b)); k++) fn(k, (k - toB(a)) / Math.max(1, toB(b) - toB(a))); };
	while (t < n / sr) {
		const syl = style === 'laugh' ? 4 + Math.floor(R() * 4) : style === 'call' ? 1 + Math.floor(R() * 2) : 3 + Math.floor(R() * 10);
		const q = style === 'talk' && R() < 0.2;
		for (let s = 0; s < syl; s++) {
			const pos = s / syl, stress = R() < 0.3 ? 1 : 0.6 + R() * 0.25;
			let f = base * (1.12 - 0.26 * pos) * (1 + 0.08 * stress) * (q && s === syl - 1 ? 1.3 : 1);
			if (style === 'laugh') f = base * (1.25 - 0.35 * pos) * (0.95 + R() * 0.1);
			if (style === 'call') f = base * 1.5;
			// the consonant: a hiss, a stop, a nasal, or straight in
			const c = style === 'laugh' ? 'h' : R() < 0.35 ? 's' : R() < 0.5 ? 'p' : R() < 0.5 ? 'n' : '-';
			const cd = c === 's' ? 0.05 + R() * 0.04 : c === 'p' ? 0.03 : c === 'n' ? 0.05 : c === 'h' ? 0.04 : 0;
			const hf = [2500, 4500, 6000][Math.floor(R() * 3)];
			if (c === 's' || c === 'h') fill(t, t + cd, (k) => { C.hiss[k] = c === 's' ? 0.35 * talk : 0.5 * talk; C.hf[k] = c === 'h' ? 1600 : hf; });
			if (c === 'p') fill(t + 0.022, t + 0.03, (k) => { C.hiss[k] = 0.6 * talk; C.hf[k] = 2000; });
			if (c === 'n') fill(t, t + cd, (k) => { C.amp[k] = 0.35 * talk * stress; C.F1[k] = 260; C.F2[k] = 1100; C.F3[k] = 2500; C.f0[k] = f; });
			t += cd;
			// the vowel
			const vd = style === 'laugh' ? 0.07 + R() * 0.04 : style === 'call' ? 0.3 + R() * 0.25 : 0.07 + R() * 0.16;
			const nv = style === 'laugh' ? VOWELS[3 + Math.floor(R() * 2)] : VOWELS[Math.floor(R() * VOWELS.length)], pv = V;
			V = nv;
			fill(t, t + vd, (k, u) => {
				const e = Math.min(1, u * 5) * Math.min(1, (1 - u) * 4);
				C.amp[k] = talk * stress * e;
				C.f0[k] = style === 'call' ? f * (1 + 0.15 * Math.sin(u * Math.PI) - 0.2 * u) : f * (1 - 0.05 * u);
				const m = Math.min(1, u * 3.5);
				C.F1[k] = (pv[0] + (nv[0] - pv[0]) * m) * K.fs; C.F2[k] = (pv[1] + (nv[1] - pv[1]) * m) * K.fs; C.F3[k] = (pv[2] + (nv[2] - pv[2]) * m) * K.fs;
				C.breath[k] = style === 'laugh' ? 0.5 : 0.06;
			});
			t += vd + (style === 'laugh' ? 0.05 + R() * 0.03 : R() * 0.03);
		}
		t += style === 'laugh' ? 10 : style === 'call' ? 10 : 0.2 + R() * (style === 'talk' ? 0.8 : 1.5);
	}
	// smooth the curves so nothing clicks
	for (const key of ['amp', 'f0', 'F1', 'F2', 'F3', 'hiss']) { const a = C[key]; for (let k = 1; k < nb; k++) { if (key[0] === 'F' && a[k] === 0) a[k] = a[k - 1]; a[k] = a[k - 1] + (a[k] - a[k - 1]) * (key === 'amp' || key === 'hiss' ? 0.5 : 0.35); } }
	return { C, blk };
}
// a voice from its curves, added into out at gain g (a generator: it pauses now and then so
// a long bake can be spread over frames)
function* voice(out, sr, R, plan, g) {
	const { C, blk } = plan, f1 = biquad(), f2 = biquad(), f3 = biquad(), fh = biquad();
	let ph = 0, lp1 = 0, lp2 = 0, jit = 0;
	for (let k = 0; k * blk < out.length; k++) {
		const a0 = C.amp[k], a1 = C.amp[k + 1] ?? a0, h0 = C.hiss[k], h1 = C.hiss[k + 1] ?? h0;
		if (a0 < 1e-4 && a1 < 1e-4 && h0 < 1e-4 && h1 < 1e-4) { lp1 *= 0.5; lp2 *= 0.5; continue; }
		if (k % 64 === 63) yield;
		const F1 = C.F1[k] || 500, F2 = C.F2[k] || 1500, F3 = C.F3[k] || 2500;
		f1.set('bp', F1, F1 / 80, sr); f2.set('bp', F2, F2 / 110, sr); f3.set('bp', F3, F3 / 160, sr); fh.set('bp', C.hf[k], 1.6, sr);
		for (let i = 0; i < blk && k * blk + i < out.length; i++) {
			const u = i / blk, amp = a0 + (a1 - a0) * u, hs = h0 + (h1 - h0) * u;
			jit += ((R() - 0.5) * 0.02 - jit) * 0.01;
			ph += C.f0[k] * (1 + jit) / sr;
			let src = 0;
			if (ph >= 1) { ph -= 1; src = 1; }
			// the glottis' pulses, tilted down, and a little breath
			lp1 += (src * 6 - lp1) * 0.35; lp2 += (lp1 - lp2) * 0.35;
			const nz = R() * 2 - 1, ex = (lp2 + nz * C.breath[k] * 0.6) * amp;
			out[k * blk + i] += (f1.run(ex) * 1 + f2.run(ex) * 0.7 + f3.run(ex) * 0.35 + fh.run(nz) * hs * 0.5) * g;
		}
	}
}
const pickKind = (R) => { const x = R(); return x < 0.45 ? 'man' : x < 0.9 ? 'woman' : 'child'; };
// loop cross-fade: the overhang is folded into the start so the loop has no seam
function seam(d, len) {
	const n = d.length - len, out = d.slice(0, len);
	for (let i = 0; i < n; i++) { const k = i / n; out[i] = d[i] * Math.sqrt(k) + d[len + i] * Math.sqrt(1 - k); }
	return out;
}
// people talking: `n` voices at their own distances, `secs` long, looping
// (generators, like voice(); finish() runs one to its end at once)
export function finish(gen) { for (;;) { const r = gen.next(); if (r.done) return r.value; } }
export function* renderBabble(sr, n, secs, seed = 1, { talk = 0.6, far = 0 } = {}) {
	const R = rng(seed * 7717 + n), len = Math.floor(secs * sr), d = new Float32Array(len + Math.floor(0.4 * sr));
	for (let v = 0; v < n; v++) yield* voice(d, sr, R, speak(d.length, sr, R, { kind: pickKind(R), talk, start: R() * 1.5 }), 0.4 + R() * 0.6);
	// further off the highs go first
	if (far > 0) { const lp = biquad().set('lp', 3200 - far * 2000, 0.6, sr); for (let i = 0; i < d.length; i++) d[i] = lp.run(d[i]); }
	return level(seam(d, len), sr, 0.2, 0);
}
// one person saying a few words
export function* renderPhrase(sr, seed, kind) {
	const R = rng(seed * 104723 + 5), d = new Float32Array(Math.floor((1.2 + R() * 1.4) * sr)), k = kind || pickKind(R);
	yield* voice(d, sr, R, speak(d.length, sr, R, { kind: k, talk: 0.8, start: 0.02 }), 1);
	return level(d, sr, 0.22);
}
// a child's (or a grown-up's) laugh: ha-ha-ha, breathy, falling
export function* renderLaugh(sr, seed, kind = 'child') {
	const R = rng(seed * 7919 + 3), d = new Float32Array(Math.floor(1.1 * sr));
	yield* voice(d, sr, R, speak(d.length, sr, R, { kind, f0: kind === 'child' ? 360 : null, talk: 0.9, style: 'laugh', start: 0.02 }), 1);
	return level(d, sr, 0.22);
}
// someone calling out across the sand: a long "heyy"
export function* renderCall(sr, seed) {
	const R = rng(seed * 6007 + 11), d = new Float32Array(Math.floor(1.1 * sr));
	yield* voice(d, sr, R, speak(d.length, sr, R, { kind: pickKind(R), talk: 1, style: 'call', start: 0.02 }), 1);
	return level(d, sr, 0.22);
}

// ---------- things ----------
// cutlery and plates: a few bright inharmonic rings close together
export function renderClink(sr, seed) {
	const R = rng(seed * 3571 + 1), d = new Float32Array(Math.floor(0.7 * sr)), n = 1 + Math.floor(R() * 4);
	for (let k = 0; k < n; k++) {
		const t = k === 0 ? 0.005 : R() * 0.35, f = 1900 + R() * 2600, a = 0.6 + R() * 0.4;
		for (const [m, am, tau] of [[1, 1, 0.12], [2.32, 0.5, 0.07], [4.1, 0.3, 0.04], [6.3, 0.15, 0.025]]) mode(d, sr, t, { f: f * m, amp: am * a * 0.3, tau: tau * (0.6 + R() * 0.8) });
		noiseBurst(d, sr, R, t, { type: 'hp', f: 3000, q: 0.7, amp: 0.3 * a, at: 0.0004, tau: 0.004 });
	}
	return level(d, sr, 0.2);
}
// someone typing: runs of keys, a pause, the space bar
export function renderTyping(sr, secs, seed = 1) {
	const R = rng(seed * 811 + 9), len = Math.floor(secs * sr), d = new Float32Array(len + Math.floor(0.3 * sr));
	let t = 0.05;
	while (t < secs) {
		const run = 3 + Math.floor(R() * 14);
		for (let k = 0; k < run && t < secs; k++) {
			const space = R() < 0.15;
			noiseBurst(d, sr, R, t, { f: space ? 1800 : 3200 + R() * 1800, q: 1.2, amp: space ? 0.5 : 0.4 + R() * 0.3, at: 0.0004, tau: 0.004 });
			mode(d, sr, t, { f: space ? 260 : 420 + R() * 200, amp: 0.25, tau: 0.008 });
			noiseBurst(d, sr, R, t + 0.06 + R() * 0.02, { f: 2600, q: 1, amp: 0.12, at: 0.0004, tau: 0.003 });
			t += 0.08 + R() * 0.12;
		}
		t += 0.3 + R() * 1.8;
	}
	return level(seam(d, len), sr, 0.2, 0);
}
// a room's reverberation: two channels of noise dying away, darker as it goes, with a few
// early reflections off the nearest walls (size in metres)
export function* renderRoom(sr, decay, tone, size, seed = 1) {
	const R = rng(seed), len = Math.floor(Math.min(4, decay * 1.1 + 0.05) * sr), ch = [new Float32Array(len), new Float32Array(len)];
	for (const d of ch) {
		let lp = 0;
		for (let i = 0; i < len; i++) {
			const t = i / sr, k = Math.min(1, t / 0.004), cut = tone * Math.exp(-t / (decay * 0.6)) + 400;
			const a = 1 - Math.exp(-2 * Math.PI * cut / sr);
			lp += ((R() * 2 - 1) - lp) * a;
			d[i] = lp * k * Math.exp(-6.9 * t / decay);
			if ((i & 16383) === 16383) yield;
		}
		for (let e = 0; e < 6; e++) { const t = (size * (0.5 + R() * 1.5)) / 343, i = Math.floor(t * sr); if (i < len) d[i] += (R() < 0.5 ? -1 : 1) * (0.9 - e * 0.1); }
	}
	// the same energy in any room: the level is the wet gain's business
	let s = 0;
	for (const d of ch) for (const v of d) s += v * v;
	const k = 1 / Math.sqrt(s / 2 + 1e-9) * 0.5;
	for (const d of ch) for (let i = 0; i < len; i++) d[i] *= k;
	return ch;
}
