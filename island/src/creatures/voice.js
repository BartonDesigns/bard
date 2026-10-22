// The creatures' voices, all made here (no recordings), the way combat/melee-sound.js makes the
// sounds of a fist fight: each piece rendered once per audio context into a short buffer, then
// played where the creature is in the world (audio/spatial.js: behind you is behind you, a thing
// in the sky is above, and it falls off with distance), the air taking the top off it as it goes,
// pitched down for a big one and a little different every time. A hound's growl (a rattle deep
// in the chest), its snarl as it springs, its snuffling at the ground and its claws raking the
// dirt; the Burnt Giant's groan of wood waking, the crackle of its embers (a loop, kept on it)
// and the crash of it coming down; the clicking of a thing with too many legs, its crystal feet
// ticking on stone, and the burst of one shattering; the Fog Mother's wail, her fist on the
// deck, and the thousand drowned she calls up screaming out of the strait.
//
//   play(name, at, gain, rate, { ref, far })   once, at a place; ref is where it is at full level
//   loop(name, at, gain, rate, { ref })        kept going at a place: { move(p), level(k, d), stop(fade) }
//   warm(names)                                 render these ahead of need, one a frame

import { soundBus } from '../world/soundbus.js';
import { placed } from '../audio/spatial.js';

import { TAU, clamp, rnd, resonate, lowpass, highpass, normalise, sum, throat, reverb, hiss, thump, seamless } from './voice-dsp.js';
import { KIT } from './voice-kit.js';

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
	// a long wail, an old woman's voice the size of the sky: a moan rising and breaking, and the
	// wind in it
	wail: (sr) => throat(sr, {
		dur: 3.2, f0: 150, jitter: 0.04, breath: 0.6, seed: 61,
		formants: [[420, 0.03, 1], [850, 0.025, 0.8], [2400, 0.012, 0.35]],
		env: (t) => Math.min(1, t / 0.25) * (1 - clamp((t - 0.6) / 0.4, 0, 1)) * (0.8 + 0.2 * Math.sin(t * 23)),
	}),
	// a crystal leg tapping stone: two hard ticks, ringing a moment
	click(sr) {
		const n = Math.floor(sr * 0.3), d = new Float32Array(n), R = rnd(41);
		for (const t0 of [0, 0.11]) {
			const i0 = Math.floor(t0 * sr);
			for (let k = 0; k < 30 && i0 + k < n; k++) d[i0 + k] += (R() * 2 - 1) * Math.exp(-k / 5);
		}
		return normalise(sum(n, [resonate(d, sr, 4200, 0.06), 1], [resonate(d, sr, 6900, 0.04), 0.6], [highpass(d.slice(), sr, 3000), 0.5]), 0.7);
	},
	// a crystal body bursting: a crack, then a shower of glassy pings falling away
	shatter(sr) {
		const n = Math.floor(sr * 1.4), crack = new Float32Array(n), R = rnd(53);
		for (let i = 0; i < sr * 0.05; i++) crack[i] = (R() * 2 - 1) * Math.exp(-i / (sr * 0.012));
		const out = sum(n, [highpass(crack, sr, 700), 1]);
		for (let j = 0; j < 26; j++) {
			const t0 = Math.pow(R(), 1.6) * 1.0, i0 = Math.floor(t0 * sr), f = 2500 + R() * 6000, g = 0.5 * (1 - t0 * 0.7);
			const tap = new Float32Array(n);
			for (let k = 0; k < 20 && i0 + k < n; k++) tap[i0 + k] = (R() * 2 - 1) * Math.exp(-k / 4);
			const ring = resonate(tap, sr, f, 0.05 + R() * 0.08, 1);
			for (let i = i0; i < n; i++) out[i] += ring[i] * g * 6;
		}
		return normalise(out);
	},
	// the Fog Mother's fist on the deck: the pressure of it, the steel of the span ringing
	// under the blow, grit thrown up, and the rumble running off along the bridge
	slam(sr) {
		const n = Math.floor(sr * 2.6), R = rnd(83);
		const blow = thump(sr, n, 26, 110, 0.35, 18);
		for (let i = 0; i < sr * 0.03; i++) blow[i] += (R() * 2 - 1) * Math.exp(-i / (sr * 0.006)) * 1.5;
		const grit = hiss(sr, 2.6, (t) => Math.exp(-t * 2.6 / 0.18), 1500, 7000, 85);
		const tap = new Float32Array(n);
		for (let i = 0; i < 120; i++) tap[i] = (R() * 2 - 1) * Math.exp(-i / 30);
		const steel = sum(n, [resonate(tap, sr, 62, 1.3), 1], [resonate(tap, sr, 97, 1.0), 0.8], [resonate(tap, sr, 143, 0.8), 0.6], [resonate(tap, sr, 218, 0.6), 0.4]);
		const rumble = lowpass(hiss(sr, 2.6, (t) => Math.min(1, t * 2.6 / 0.12) * Math.exp(-(t * 2.6 - 0.12) / 0.9), 20, 90, 87), sr, 90);
		return normalise(sum(n, [blow, 1.3], [grit, 0.3], [steel, 14], [rumble, 3]));
	},
	// a thousand drowned, far off and coming: thin voices one after another, every one its own
	// pitch, all climbing together and breaking up as they near the top; the strait's air round them
	souls(sr) {
		const n = Math.floor(sr * 7), out = new Float32Array(n), R = rnd(97), V = 13;
		for (let v = 0; v < V; v++) {
			const f0 = 150 + R() * 330, on = R() * 3.4, vib = 3.5 + R() * 4.5, jit = 0.05 + R() * 0.14, seed = 200 + v;
			const voice = throat(sr, {
				dur: 7, f0, jitter: jit, breath: 0.45, seed, top: 3600,
				formants: [[600 + R() * 350, 0.022, 1], [1100 + R() * 700, 0.015, 0.7], [2500 + R() * 900, 0.009, 0.5]],
				glide: (t) => 1 + t * t * 0.95,
				env: (t) => { const T = t * 7; return clamp((T - on) / 0.9, 0, 1) * (0.7 + 0.3 * Math.sin(TAU * vib * T)) * (1 - clamp((T - 6.75) / 0.2, 0, 1)); },
			});
			for (let i = 0; i < n; i++) out[i] += voice[i];
		}
		return normalise(reverb(highpass(out, sr, 250), sr, 0.55, 0.82));
	},
	// the drowned let go: a shriek all at once, and the rush of them sweeping out over the deck
	soulburst(sr) {
		const n = Math.floor(sr * 3.2), out = new Float32Array(n), R = rnd(113);
		for (let v = 0; v < 7; v++) {
			const f0 = 380 + R() * 360, seed = 300 + v;
			const voice = throat(sr, {
				dur: 3.2, f0, jitter: 0.12 + R() * 0.1, breath: 0.5, seed, top: 5000,
				formants: [[800 + R() * 300, 0.02, 1], [1700 + R() * 500, 0.012, 0.7], [3200 + R() * 600, 0.008, 0.5]],
				glide: (t) => 1.6 - t * 1.1,
				env: (t) => Math.min(1, t * 3.2 / 0.05) * Math.pow(1 - t, 1.8),
			});
			for (let i = 0; i < n; i++) out[i] += voice[i];
		}
		// (the rush: a band of air sweeping down as it goes out and away)
		const rush = new Float32Array(n);
		let y = 0;
		for (let i = 0; i < n; i++) {
			const t = i / n, f = 2800 * Math.pow(0.07, t), a = 1 - Math.exp(-TAU * f / sr);
			y += ((R() * 2 - 1) - y) * a;
			rush[i] = y * Math.min(1, t / 0.04) * Math.pow(1 - t, 1.2) * 2.5;
		}
		const sub = thump(sr, n, 24, 70, 0.6, 12);
		return normalise(reverb(sum(n, [out, 1], [highpass(rush, sr, 120), 0.9], [sub, 1.6]), sr, 0.35, 0.7));
	},
	// a body all afire, kept going: the hiss and low breathing roar of it, and embers bursting
	ember(sr) {
		const edge = 0.3, n = Math.floor(sr * (3 + edge)), R = rnd(71);
		const fl = (t) => 0.55 + 0.45 * Math.sin(TAU * 0.7 * t + Math.sin(TAU * 0.23 * t) * 2);
		const raw = new Float32Array(n);
		for (let i = 0; i < n; i++) raw[i] = (R() * 2 - 1) * fl(i / sr);
		const air = lowpass(highpass(raw.slice(), sr, 900), sr, 4800), roar = lowpass(raw.slice(), sr, 160);
		const pops = new Float32Array(n);
		for (let i = 0; i < n; i++) if (R() < 9 / sr) { const a = 0.5 + R() * 1.2; for (let k = 0; k < 60 && i + k < n; k++) pops[i + k] += (R() * 2 - 1) * Math.exp(-k / 9) * a; }
		const mix = sum(n, [air, 0.3], [roar, 4], [resonate(pops, sr, 1400, 0.012), 10], [resonate(pops, sr, 2600, 0.008), 7], [resonate(pops, sr, 4100, 0.006), 4]);
		return normalise(seamless(mix, sr, edge), 0.8);
	},
	// a giant's blow landing: the deep thud of wood on ground, dirt thrown up
	thud(sr) {
		const n = Math.floor(sr * 1.1), R = rnd(131);
		const blow = thump(sr, n, 40, 160, 0.22, 30);
		const tap = new Float32Array(n);
		for (let i = 0; i < 80; i++) tap[i] = (R() * 2 - 1) * Math.exp(-i / 20);
		const wood = sum(n, [resonate(tap, sr, 180, 0.12), 1], [resonate(tap, sr, 410, 0.07), 0.6], [resonate(tap, sr, 900, 0.04), 0.3]);
		const dirt = hiss(sr, 1.1, (t) => Math.exp(-t * 1.1 / 0.14), 800, 5000, 133);
		return normalise(sum(n, [blow, 1.2], [wood, 8], [dirt, 0.35]));
	},
	// a giant coming down: boughs splitting one after another, the trunk's crash, embers scattered
	collapse(sr) {
		const n = Math.floor(sr * 3.4), R = rnd(151), out = new Float32Array(n);
		for (let j = 0; j < 9; j++) {
			const t0 = Math.pow(R(), 1.4) * 1.6, i0 = Math.floor(t0 * sr), tap = new Float32Array(n);
			for (let k = 0; k < 400 && i0 + k < n; k++) tap[i0 + k] = (R() * 2 - 1) * Math.exp(-k / 90) * (R() < 0.02 ? 6 : 1);
			const f = 120 + R() * 500;
			const split = sum(n, [resonate(tap, sr, f, 0.05), 1], [resonate(tap, sr, f * 2.7, 0.03), 0.5]);
			for (let i = i0; i < n; i++) out[i] += split[i] * 6;
		}
		const i1 = Math.floor(sr * 1.7), crash = thump(sr, n - i1, 30, 120, 0.5, 15);
		for (let i = 0; i < crash.length; i++) out[i1 + i] += crash[i] * 1.6;
		const settle = hiss(sr, 3.4, (t) => (t < 0.5 ? 0 : Math.exp(-(t - 0.5) * 3.4 / 0.6)), 600, 4500, 153);
		const cinders = new Float32Array(n);
		for (let i = i1; i < n; i++) if (R() < 14 / sr) { for (let k = 0; k < 50 && i + k < n; k++) cinders[i + k] += (R() * 2 - 1) * Math.exp(-k / 8); }
		return normalise(sum(n, [out, 1], [settle, 0.45], [resonate(cinders, sr, 2200, 0.01), 8], [lowpass(settle.slice(), sr, 120), 3]));
	},
	...KIT,
};
// (for the tests)
export const VOICES = Object.keys(MAKE);
export const renderVoice = (name, sr = 48000) => MAKE[name](sr);

export function createCreatureVoice({ eye, isPhone = false }) {
	const cache = new WeakMap();
	const cap = isPhone ? 3 : 6, loopCap = isPhone ? 2 : 5;
	let playing = 0, looping = 0;
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
	// name at `at`, this loud, pitched by rate (lower for a bigger one: its voice then carries
	// further too, unless ref says where it is at its full level); heard to far m
	function play(name, at, gain = 1, rate = 1, { ref = 4 / (rate * rate), far = 80 } = {}) {
		if (playing >= cap || !MAKE[name]) return;
		try {
			const B = soundBus();
			if (!B) return;
			const c = B.ctx, e = eye();
			const d = Math.hypot(at.x - e.x, (at.y || 0) - e.y, at.z - e.z);
			if (d > far) return;
			const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
			src.buffer = buf(c, name);
			src.playbackRate.value = rate * (0.92 + Math.random() * 0.16);
			g.gain.value = gain * (0.85 + Math.random() * 0.3);
			// (the air takes the top off it with distance; the panner takes its level)
			f.type = 'lowpass'; f.frequency.value = Math.max(600, 12000 - d * 100);
			const P = placed(c, B.out, at, { ref });
			src.connect(f).connect(g).connect(P.node);
			playing++;
			src.onended = () => { playing--; src.disconnect(); f.disconnect(); g.disconnect(); P.stop(); };
			src.start();
		} catch { /* no audio: the world goes on without it */ }
	}
	// name kept going at a place (an ember's crackle, a wing's beat): { move(p), level(k, d),
	// stop(fade) }; move answers false once the world's audio has moved to a new context, and
	// the caller starts it again
	function loop(name, at, gain = 1, rate = 1, { ref = 6 } = {}) {
		if (looping >= loopCap || !MAKE[name]) return null;
		try {
			const B = soundBus();
			if (!B) return null;
			const c = B.ctx, src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
			src.buffer = buf(c, name);
			src.loop = true; src.playbackRate.value = rate;
			g.gain.value = 0; g.gain.setTargetAtTime(gain, c.currentTime, 0.3);
			f.type = 'lowpass'; f.frequency.value = 9000;
			const P = placed(c, B.out, at, { ref });
			src.connect(f).connect(g).connect(P.node);
			src.start();
			looping++;
			let done = false;
			const end = () => { if (done) return; done = true; looping--; src.disconnect(); f.disconnect(); g.disconnect(); P.stop(); };
			src.onended = end;
			return {
				move(p) { if (done) return false; if (soundBus()?.ctx !== c) { this.stop(0.2); return false; } P.move(p); return true; },
				level(k, d = 0) { if (done) return; g.gain.setTargetAtTime(k * gain, c.currentTime, 0.25); f.frequency.setTargetAtTime(Math.max(800, 9000 - d * 80), c.currentTime, 0.25); },
				stop(fade = 0.4) { if (done) return; const t = c.currentTime; g.gain.setTargetAtTime(0, t, fade / 3); try { src.stop(t + fade + 0.1); } catch { end(); } },
			};
		} catch { return null; }
	}
	// a creature's set rendered before it is wanted, one buffer a frame, so the first cry costs
	// no hitch in the fight (the long ones take a good part of a second to make)
	let warming = null;
	const queue = [];
	function warm(names) {
		for (const n of names) if (MAKE[n] && !queue.includes(n)) queue.push(n);
		if (warming) return;
		const next = () => {
			warming = null;
			const B = soundBus();
			if (!B) { queue.length = 0; return; }
			const m = cache.get(B.ctx);
			while (queue.length && m?.[queue[0]]) queue.shift();
			if (!queue.length) return;
			try { buf(B.ctx, queue.shift()); } catch { /* no audio */ }
			if (queue.length) warming = setTimeout(next, 40);
		};
		warming = setTimeout(next, 40);
	}
	return { play, loop, warm };
}
