// The sound of a fight at close quarters, all made here (no recordings), each piece rendered
// once per audio context into a short buffer the way bay/bridgesound.js makes its knock, then
// layered per blow through the world's bus (world/soundbus.js): the swish of the strike, the
// smack where it lands (a slap and crack on the face, a thud in the body, a deep crunch under a
// heavy one), the clack of forearms on a block and the sharp clap of a parry, the thock of a bat
// and the ring of a pipe, a grunt from whoever took it, a body going down, the scuff of a dodge.
// Each one is pitched and levelled a little differently every time so a string never repeats,
// panned to where it happened and dulled with distance. A phone plays fewer layers and fewer at
// once.

import { soundBus } from '../world/soundbus.js';

const TAU = Math.PI * 2;
// a two-pole resonator ringing at f Hz, dying away over tau seconds, driven by x
function resonate(x, sr, f, tau, gain = 1) {
	const out = new Float32Array(x.length), r = Math.exp(-1 / (tau * sr)), c = 2 * r * Math.cos(TAU * f / sr), r2 = r * r;
	let y1 = 0, y2 = 0;
	for (let i = 0; i < x.length; i++) { const y = x[i] + c * y1 - r2 * y2; y2 = y1; y1 = y; out[i] = y * gain * (1 - r); }
	return out;
}
const noiseBurst = (n, sr, decay, seed = 1) => {
	const d = new Float32Array(n);
	let s = seed * 9301 + 49297;
	for (let i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; d[i] = (s / 233280 * 2 - 1) * Math.exp(-i / sr / decay); }
	return d;
};
function mix(n, ...parts) { const o = new Float32Array(n); for (const [p, g] of parts) for (let i = 0; i < Math.min(n, p.length); i++) o[i] += p[i] * g; return o; }
function normalise(d, peak = 0.9) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; return d; }
// a one-pole low pass, in place
function lowpass(d, sr, f) { const a = 1 - Math.exp(-TAU * f / sr); let y = 0; for (let i = 0; i < d.length; i++) { y += (d[i] - y) * a; d[i] = y; } return d; }
function highpass(d, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0, x1 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x1); x1 = x; d[i] = y; } return d; }

// the pieces, by name: each a function of the sample rate returning samples
const MAKE = {
	// the swish of a strike: noise through a band that sweeps up and back as the arm goes by
	swish(sr, heavy = false) {
		const T = heavy ? 0.32 : 0.2, n = Math.floor(sr * T), d = new Float32Array(n);
		let s = 7, lp = 0, bp = 0;
		for (let i = 0; i < n; i++) {
			const t = i / n, env = Math.sin(Math.PI * Math.pow(t, 0.7)) ** 2;
			const f = (heavy ? 500 : 900) + (heavy ? 1400 : 2600) * Math.sin(Math.PI * t);
			const a = 1 - Math.exp(-TAU * f / sr);
			s = (s * 9301 + 49297) % 233280;
			const x = s / 233280 * 2 - 1;
			lp += (x - lp) * a; bp += (lp - bp) * a * 0.5;
			d[i] = (lp - bp) * env;
		}
		return normalise(d, 0.8);
	},
	swishHeavy(sr) { return MAKE.swish(sr, true); },
	// a fist in the body: a low knock falling in pitch, the cloth's dull slap over it
	body(sr) {
		const n = Math.floor(sr * 0.28), d = new Float32Array(n);
		let ph = 0;
		const cloth = lowpass(noiseBurst(n, sr, 0.025, 3), sr, 1400);
		for (let i = 0; i < n; i++) { const t = i / sr, f = 52 + 60 * Math.exp(-t * 38); ph += TAU * f / sr; d[i] = Math.sin(ph) * Math.exp(-t * 16) + cloth[i] * 1.4; }
		return normalise(d);
	},
	// a fist on the face or jaw: a sharp slap, a knock of bone under it
	face(sr) {
		const n = Math.floor(sr * 0.22), ex = noiseBurst(n, sr, 0.004, 5);
		const slap = highpass(noiseBurst(n, sr, 0.012, 11), sr, 1800);
		const knock = resonate(ex, sr, 780, 0.035, 6), low = resonate(ex, sr, 180, 0.05, 4);
		return normalise(mix(n, [slap, 1.1], [knock, 1], [low, 0.8]));
	},
	// under a heavy one: a deep boom and a short crunch, grains of it
	crunch(sr) {
		const n = Math.floor(sr * 0.4), d = new Float32Array(n);
		let ph = 0;
		for (let i = 0; i < n; i++) { const t = i / sr, f = 38 + 50 * Math.exp(-t * 22); ph += TAU * f / sr; d[i] = Math.sin(ph) * Math.exp(-t * 9) * 1.2; }
		const g = noiseBurst(n, sr, 0.06, 17);
		for (let i = 0; i < n; i++) { const t = i / sr; d[i] += g[i] * (Math.sin(t * 420) > 0.2 ? 0.9 : 0.15) * (t < 0.08 ? 1 : 0); }
		return normalise(lowpass(d, sr, 2600));
	},
	// forearms meeting forearms: a muted knock and a brush of sleeves
	block(sr) {
		const n = Math.floor(sr * 0.16), ex = noiseBurst(n, sr, 0.003, 23);
		const k = resonate(ex, sr, 260, 0.03, 8), k2 = resonate(ex, sr, 610, 0.02, 4), cloth = lowpass(noiseBurst(n, sr, 0.03, 29), sr, 2200);
		return normalise(mix(n, [k, 1], [k2, 0.6], [cloth, 0.7]));
	},
	// a parry: a bright clap and a quick ring as the blow is knocked aside
	parry(sr) {
		const n = Math.floor(sr * 0.3), ex = noiseBurst(n, sr, 0.002, 31);
		const clap = highpass(noiseBurst(n, sr, 0.008, 37), sr, 1200);
		const r1 = resonate(ex, sr, 1250, 0.08, 4), r2 = resonate(ex, sr, 2320, 0.06, 3), low = resonate(ex, sr, 300, 0.04, 5);
		return normalise(mix(n, [clap, 1.2], [r1, 0.7], [r2, 0.5], [low, 0.7]));
	},
	// a bat's thock: the wood's few hollow notes over a thud
	wood(sr) {
		const n = Math.floor(sr * 0.3), ex = noiseBurst(n, sr, 0.003, 41);
		const a = resonate(ex, sr, 380, 0.09, 6), b = resonate(ex, sr, 940, 0.06, 4), c = resonate(ex, sr, 1720, 0.04, 3);
		return normalise(mix(n, [a, 1], [b, 0.7], [c, 0.4], [MAKE.body(sr), 0.6]));
	},
	// a pipe's clang: a struck bar's partials, out of tune with each other, ringing on
	metal(sr) {
		const n = Math.floor(sr * 1.1), ex = noiseBurst(n, sr, 0.002, 43);
		const parts = [[523, 0.9, 1], [1427, 0.6, 0.7], [2793, 0.4, 0.5], [4130, 0.25, 0.3], [6020, 0.12, 0.2]];
		const o = new Float32Array(n);
		for (const [f, tau, g] of parts) { const r = resonate(ex, sr, f, tau, 3); for (let i = 0; i < n; i++) o[i] += r[i] * g; }
		const thud = MAKE.body(sr);
		for (let i = 0; i < thud.length; i++) o[i] += thud[i] * 0.5;
		return normalise(o);
	},
	// a body going down: a heavy bump, the scrape after, a smaller second bump
	fall(sr) {
		const n = Math.floor(sr * 0.6), d = new Float32Array(n);
		let ph = 0;
		const grit = lowpass(noiseBurst(n, sr, 0.18, 47), sr, 700);
		for (let i = 0; i < n; i++) {
			const t = i / sr, a = Math.exp(-t * 14), b = t > 0.16 ? Math.exp(-(t - 0.16) * 20) * 0.5 : 0;
			ph += TAU * (44 + 30 * Math.exp(-t * 20)) / sr;
			d[i] = Math.sin(ph) * (a + b) + grit[i] * 0.9;
		}
		return normalise(d);
	},
	// a grunt: a voice's pulse through the formants of a short "uh", with a breath on it
	grunt(sr) {
		const n = Math.floor(sr * 0.24), ex = new Float32Array(n);
		let ph = 0, s = 53;
		for (let i = 0; i < n; i++) {
			const t = i / sr, f0 = 118 - 30 * t / 0.24 + Math.sin(t * 60) * 3;
			ph += f0 / sr;
			const env = Math.min(1, t / 0.015) * Math.exp(-Math.max(0, t - 0.05) * 12);
			s = (s * 9301 + 49297) % 233280;
			ex[i] = ((ph % 1) < 0.08 ? 1 : 0) * env + (s / 233280 - 0.5) * 0.25 * env;
		}
		const f1 = resonate(ex, sr, 620, 0.02, 3), f2 = resonate(ex, sr, 1080, 0.015, 2), f3 = resonate(ex, sr, 2500, 0.01, 1);
		return normalise(lowpass(mix(n, [f1, 1], [f2, 0.7], [f3, 0.35]), sr, 3500), 0.7);
	},
	// your breath behind a strike: a short "hff"
	breath(sr) {
		const n = Math.floor(sr * 0.14), d = noiseBurst(n, sr, 0.05, 59);
		for (let i = 0; i < n; i++) d[i] *= Math.min(1, i / (sr * 0.012));
		return normalise(lowpass(highpass(d, sr, 900), sr, 3200), 0.6);
	},
	// a dodge: shoes scuffing and clothes moving
	scuff(sr) {
		const n = Math.floor(sr * 0.22), d = noiseBurst(n, sr, 0.09, 61);
		for (let i = 0; i < n; i++) { const t = i / sr; d[i] *= (0.6 + 0.4 * Math.sin(t * 90)) * Math.min(1, t / 0.01); }
		return normalise(lowpass(highpass(d, sr, 1500), sr, 6000), 0.6);
	},
	// glass: a bottle breaking, bright shards over a pop
	glass(sr) {
		const n = Math.floor(sr * 0.5), ex = noiseBurst(n, sr, 0.004, 67), o = highpass(noiseBurst(n, sr, 0.09, 71), sr, 3000);
		for (const [f, tau] of [[2900, 0.12], [4300, 0.09], [5600, 0.07], [3600, 0.15]]) { const r = resonate(ex, sr, f, tau, 2); for (let i = 0; i < n; i++) o[i] += r[i] * 0.5; }
		return normalise(o);
	},
};

// (for the tests: each piece rendered at a sample rate)
export const PIECES = Object.keys(MAKE);
export const renderPiece = (name, sr = 48000) => MAKE[name](sr);

export function createMeleeSound({ eye, yaw, isPhone = false }) {
	const cache = new WeakMap();
	const cap = isPhone ? 6 : 14;
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
	// one piece at `at` (or at you), this loud, pitched by rate, after `delay` seconds
	function one(name, at, gain = 1, rate = 1, delay = 0) {
		if (playing >= cap) return;
		try {
			const B = soundBus();
			if (!B) return;
			const c = B.ctx, e = eye();
			let d = 0, pan = 0;
			if (at) {
				const dx = at.x - e.x, dz = at.z - e.z;
				d = Math.hypot(dx, dz);
				if (d > 70) return;
				// (left or right of where you look)
				const a = yaw(), rx = Math.cos(a), rz = -Math.sin(a);
				pan = d > 0.3 ? Math.max(-0.8, Math.min(0.8, (dx * rx + dz * rz) / d)) : 0;
			}
			const src = c.createBufferSource(), g = c.createGain();
			src.buffer = buf(c, name);
			src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
			g.gain.value = gain * Math.max(0.05, 1 - d / 70) * (0.85 + Math.random() * 0.3);
			let tail = g;
			// (further off, duller)
			const f = d > 6 ? c.createBiquadFilter() : null;
			if (f) { f.type = 'lowpass'; f.frequency.value = Math.max(700, 9000 - d * 140); src.connect(f).connect(g); } else src.connect(g);
			const p = pan && c.createStereoPanner ? c.createStereoPanner() : null;
			if (p) { p.pan.value = pan; g.connect(p); tail = p; }
			tail.connect(B.out);
			playing++;
			src.onended = () => { playing--; src.disconnect(); g.disconnect(); f?.disconnect(); p?.disconnect(); };
			src.start(c.currentTime + delay);
		} catch { /* no audio */ }
	}
	const S = {
		// the swing itself, before it lands (yours close by, theirs where they stand)
		swing(heavy, at = null, item = null) {
			one(heavy ? 'swishHeavy' : 'swish', at, (heavy ? 0.5 : 0.32) * (item ? 1.2 : 1), item === 'pipe' ? 0.85 : 1);
			if (!at && !isPhone && Math.random() < (heavy ? 0.9 : 0.35)) one('breath', null, 0.22, heavy ? 0.85 : 1.05);
		},
		// a blow landing: result 'hit' | 'block' | 'break' | 'parry'; move from melee-rules
		land(result, m, at, { head = false, k = 1 } = {}) {
			const heavy = m?.kind === 'heavy', item = m?.item;
			if (result === 'parry') { one('parry', at, 0.75 * k); one('block', at, 0.4 * k, 1.2); return; }
			if (result === 'block') { one('block', at, 0.6 * k); if (item === 'pipe') one('metal', at, 0.25, 1.3); return; }
			if (result === 'break') { one('block', at, 0.8 * k, 0.8); one('body', at, 0.6 * k); return; }
			if (item === 'pipe') { one('metal', at, 0.55 * k); one('body', at, 0.7 * k, 0.9); }
			else if (item === 'bat') { one('wood', at, 0.85 * k); }
			else if (item === 'bottle') { one('face', at, 0.6 * k); }
			else {
				one(head ? 'face' : 'body', at, (heavy ? 0.95 : 0.7) * k, heavy ? 0.85 : 1);
				// (the other layer under it, quieter)
				if (!isPhone) one(head ? 'body' : 'face', at, 0.25 * k, 1.1);
			}
			if (heavy && !isPhone) one('crunch', at, 0.7 * k);
		},
		grunt(at, pitch = 1, hurt = 1) { if (Math.random() < 0.75) one('grunt', at, 0.32 * hurt, pitch, 0.02); },
		fall(at) { one('fall', at, 0.75); },
		glass(at) { one('glass', at, 0.6); },
		dodge() { one('scuff', null, 0.35); one('swish', null, 0.14, 0.7); },
		// a close miss past your ear
		miss(at) { one('swish', at, 0.4, 1.15); },
		prime() { try { const B = soundBus(); if (B) for (const k of ['swish', 'body', 'face', 'block']) buf(B.ctx, k); } catch { /* no audio */ } },
		info: () => ({ playing, cap }),
	};
	return S;
}
