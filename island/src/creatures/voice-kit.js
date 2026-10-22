// The rest of the creatures' voices, one set each, all made here from the pieces in voice-dsp.js
// (voice.js folds these into its MAKE table; creatures/catalog.js names them per species under
// `voice`). Every creature's sound is its own: the Fog Wight is cold air and a hollow moan, the
// Sexton a dry rattle and iron, the goblins cackle and squeal, the Signplate Brute is street
// signs clashing, the Hexer whispers, the Drain King roars in a sewer, the Cinderkin grinds
// stone over bubbling magma, the Saltmarsh Mother keens and gurgles, the Moonturned screams as
// it changes and the hounds howl, the Gloomcrawler skitters, the Undertow is the sea, the
// Lampeater beats leather wings, the Facet Wraith chimes like glass, the Hollow King speaks
// through a helm and dies to a bell, and the Leviathan sings the cave apart. Deep and full,
// every one: nothing thin or tinny.

import { TAU, clamp, rnd, resonate, lowpass, highpass, normalise, sum, shape, lay, throat, reverb, hiss, thump, seamless, whoosh, struck, bubbles, tone, adsr, pulses } from './voice-dsp.js';

const N = (sr, dur) => Math.floor(sr * dur);
// a sub under a sound: a low sine swell so even a small thing has weight
const sub = (sr, dur, f, env) => tone(sr, dur, () => f, env);

export const KIT = {
	// ---------- the Fog Wight: a tall thing of cold air ----------
	// a hollow moan, more wind than voice, rising and sinking away
	moan: (sr) => normalise(reverb(throat(sr, {
		dur: 2.8, f0: 68, jitter: 0.08, breath: 1.1, seed: 401, top: 2400,
		formants: [[280, 0.05, 1], [640, 0.04, 0.7], [1300, 0.02, 0.3]],
		glide: (t) => 1.08 - Math.sin(t * Math.PI) * 0.16,
		env: (t) => Math.pow(Math.sin(Math.PI * t), 0.8),
	}), sr, 0.5, 0.8)),
	// its reach: a gust of cold, a whisper in it
	gust(sr) {
		const n = N(sr, 1.2), w = whoosh(sr, 1.2, 420, 90, 403, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 1.2), 0.5);
		const whisper = throat(sr, { dur: 1.2, f0: 90, jitter: 0.2, breath: 1.4, seed: 404, top: 3000, formants: [[500, 0.03, 1], [1500, 0.015, 0.6]], env: adsr(0.2, 0.5, 1.4) });
		return normalise(reverb(sum(n, [w, 1], [whisper, 0.45], [sub(sr, 1.2, 38, adsr(0.1, 0.4, 1.2)), 0.7]), sr, 0.3, 0.7));
	},
	// it comes apart: one long breath out, the moan in it falling to nothing
	fade(sr) {
		const n = N(sr, 4.2);
		const breath = hiss(sr, 4.2, (t) => Math.min(1, t / 0.3) * Math.pow(1 - t, 1.6), 200, 1400, 405);
		const voice = throat(sr, { dur: 4.2, f0: 72, jitter: 0.1, breath: 0.9, seed: 406, top: 2200, formants: [[300, 0.05, 1], [700, 0.04, 0.6]], glide: (t) => 1 - t * 0.45, env: (t) => Math.min(1, t / 0.2) * Math.pow(1 - t, 2.2) });
		return normalise(reverb(sum(n, [breath, 0.8], [voice, 1], [sub(sr, 4.2, 34, (t) => Math.pow(1 - t, 2)), 0.6]), sr, 0.6, 0.86));
	},
	// the cold it carries: a low draught, kept on it
	fogdrift(sr) {
		const edge = 0.5, n = N(sr, 4 + edge), R = rnd(407), d = new Float32Array(n);
		for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (R() * 2 - 1) * (0.5 + 0.5 * Math.sin(TAU * 0.31 * t + Math.sin(TAU * 0.11 * t) * 1.7)); }
		return normalise(seamless(lowpass(highpass(d, sr, 90), sr, 520), sr, edge), 0.7);
	},

	// ---------- the Sexton: a dry thing with a spade and a lantern ----------
	// its breath: a dry rattle, like grit in a pipe
	rasp: (sr) => throat(sr, {
		dur: 1.5, f0: 44, jitter: 0.55, breath: 0.7, seed: 411, top: 3600,
		formants: [[520, 0.02, 1], [1250, 0.014, 0.8], [2700, 0.008, 0.45]],
		env: (t) => Math.min(1, t / 0.1) * Math.pow(1 - t, 1.2) * (0.7 + 0.3 * Math.sin(t * 31)),
	}),
	// the spade swung: iron through air
	spadeswing: (sr) => normalise(sum(N(sr, 0.7), [whoosh(sr, 0.7, 1400, 380, 412, (t) => Math.pow(Math.sin(Math.PI * t), 2), 0.4), 1], [whoosh(sr, 0.7, 260, 120, 413, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 0.5), 0.6])),
	// the spade landing: iron on something, the blade ringing
	spadehit(sr) {
		const n = N(sr, 1.1);
		return normalise(sum(n, [struck(sr, n, [[860, 0.35, 1], [2300, 0.22, 0.7], [4100, 0.12, 0.35]], { hard: 50, seed: 414 }), 10], [thump(sr, n, 60, 200, 0.16, 35), 1], [hiss(sr, 1.1, (t) => Math.exp(-t * 1.1 / 0.05), 1500, 7000, 415), 0.5]));
	},
	// the lantern on its chain, knocking as it walks
	lantern(sr) {
		const n = N(sr, 0.9), out = new Float32Array(n);
		for (const [t0, g] of [[0, 1], [0.13, 0.5], [0.41, 0.8], [0.52, 0.4]]) lay(out, sr, struck(sr, N(sr, 0.4), [[1900, 0.08, 1], [3300, 0.05, 0.5], [5200, 0.03, 0.3]], { hard: 14, seed: 416 + Math.floor(t0 * 100) }), t0, g);
		return normalise(sum(n, [out, 1], [resonate(hiss(sr, 0.9, (t) => 0.3 + 0.2 * Math.sin(t * 40), 300, 1200, 417), sr, 480, 0.02), 0.6]), 0.75);
	},
	// its end: the rattle going out of it, the spade dropped and bouncing
	rattle(sr) {
		const n = N(sr, 2.6);
		const v = throat(sr, { dur: 2.6, f0: 40, jitter: 0.7, breath: 0.8, seed: 418, top: 3000, formants: [[500, 0.02, 1], [1200, 0.014, 0.7]], glide: (t) => 1 - t * 0.5, env: (t) => Math.min(1, t / 0.1) * Math.pow(1 - t, 1.6) });
		const out = sum(n, [v, 1]);
		for (const [t0, g] of [[1.3, 1], [1.62, 0.5], [1.8, 0.3], [1.9, 0.18]]) lay(out, sr, struck(sr, N(sr, 0.8), [[860, 0.3, 1], [2300, 0.2, 0.6]], { hard: 40, seed: 419 }), t0, g * 6);
		lay(out, sr, thump(sr, N(sr, 0.5), 50, 150, 0.15, 30), 1.3, 0.9);
		return normalise(out);
	},

	// ---------- the goblins: Drain Skulker, Flarepot, Hound Rider ----------
	// a cackle: heh heh heh, from a small wet throat
	cackle: (sr) => throat(sr, {
		dur: 1.1, f0: 175, jitter: 0.2, breath: 0.35, seed: 421, top: 4200,
		formants: [[700, 0.02, 1], [1500, 0.014, 0.8], [2900, 0.008, 0.5]],
		glide: (t) => 1.1 - t * 0.2,
		env: pulses([0, 0.17, 0.34, 0.5, 0.68], 0.15, (u) => Math.pow(Math.sin(Math.PI * u), 0.7)),
	}),
	// a bite: the snap of teeth and a quick hiss
	snap(sr) {
		const n = N(sr, 0.32);
		return normalise(sum(n, [struck(sr, n, [[1800, 0.03, 1], [3200, 0.02, 0.6]], { hard: 24, seed: 422 }), 8], [hiss(sr, 0.32, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 1800, 7000, 423), 0.7], [thump(sr, n, 120, 320, 0.05, 40), 0.9]));
	},
	// struck: a yelp, up and down at once
	yelp: (sr) => throat(sr, {
		dur: 0.4, f0: 300, jitter: 0.08, breath: 0.3, seed: 424, top: 5000,
		formants: [[800, 0.02, 1], [1700, 0.012, 0.8], [3200, 0.008, 0.5]],
		glide: (t) => 1 + Math.sin(Math.PI * Math.min(1, t * 1.5)) * 0.5,
		env: (t) => Math.min(1, t / 0.05) * Math.pow(1 - t, 1.3),
	}),
	// its last: a squeal falling away
	squeal: (sr) => throat(sr, {
		dur: 1.3, f0: 380, jitter: 0.1, breath: 0.4, seed: 425, top: 5000,
		formants: [[850, 0.02, 1], [1800, 0.012, 0.8], [3300, 0.008, 0.45]],
		glide: (t) => 1.15 - t * 0.6,
		env: (t) => Math.min(1, t / 0.06) * Math.pow(1 - t, 1.8) * (0.8 + 0.2 * Math.sin(t * 40)),
	}),
	// a fire pot lobbed: the fuse fizzing, then the throw
	lob(sr) {
		const n = N(sr, 0.9);
		const fuse = resonate(hiss(sr, 0.9, (t) => (t < 0.5 ? 0.6 + 0.4 * Math.sin(t * 90) : 0), 2000, 9000, 426), sr, 5000, 0.003, 1);
		return normalise(sum(n, [fuse, 0.8], [whoosh(sr, 0.9, 700, 250, 427, (t) => (t < 0.45 ? 0 : Math.pow(Math.sin(Math.PI * (t - 0.45) / 0.55), 1.5)), 0.4), 1]));
	},
	// a Flarepot's end: the pot breaks, and all of it goes up
	flamepop(sr) {
		const n = N(sr, 1.8), R = rnd(428);
		const clay = struck(sr, n, [[1300, 0.04, 1], [2600, 0.03, 0.6], [4400, 0.02, 0.3]], { hard: 60, seed: 429 });
		const whoomp = sum(n, [thump(sr, n, 45, 180, 0.3, 14), 1], [hiss(sr, 1.8, (t) => Math.min(1, t / 0.04) * Math.exp(-t * 1.8 / 0.35), 150, 1800, 430), 1]);
		const pops = new Float32Array(n);
		for (let i = 0; i < n; i++) if (R() < 12 / sr && i > sr * 0.1) for (let k = 0; k < 50 && i + k < n; k++) pops[i + k] += (R() * 2 - 1) * Math.exp(-k / 8);
		return normalise(sum(n, [clay, 6], [whoomp, 1.2], [resonate(pops, sr, 1800, 0.01), 6]));
	},
	// a rider's war-cry over the hound's growl
	warcry(sr) {
		const n = N(sr, 1.3);
		const yell = throat(sr, { dur: 1.3, f0: 150, jitter: 0.1, breath: 0.3, seed: 431, top: 4200, formants: [[650, 0.02, 1], [1300, 0.014, 0.8], [2600, 0.008, 0.5]], glide: (t) => 0.9 + Math.min(1, t * 2.5) * 0.25, env: (t) => Math.min(1, t / 0.08) * Math.pow(1 - t, 0.9) });
		const growl = throat(sr, { dur: 1.3, f0: 34, jitter: 0.35, breath: 0.25, seed: 432, formants: [[200, 0.035, 1], [500, 0.025, 0.7]], env: adsr(0.15, 0.6, 1.2) });
		return normalise(sum(n, [yell, 1], [growl, 0.8]));
	},
	// hound and rider down together: a yelp, a cry, the weight of both landing
	tumble(sr) {
		const n = N(sr, 1.9), out = new Float32Array(n);
		lay(out, sr, KIT.yelp(sr), 0, 1);
		lay(out, sr, throat(sr, { dur: 0.9, f0: 160, jitter: 0.15, breath: 0.35, seed: 433, top: 4000, formants: [[650, 0.02, 1], [1400, 0.014, 0.7]], glide: (t) => 1 - t * 0.4, env: (t) => Math.min(1, t / 0.05) * Math.pow(1 - t, 1.5) }), 0.25, 0.9);
		lay(out, sr, thump(sr, N(sr, 0.6), 45, 150, 0.2, 30), 0.8, 1.2);
		lay(out, sr, hiss(sr, 0.7, (t) => Math.exp(-t * 0.7 / 0.12), 600, 4000, 434), 0.8, 0.4);
		return normalise(out);
	},

	// ---------- the Signplate Brute: a goblin in street signs ----------
	// a bellow from a thick chest
	bellow: (sr) => throat(sr, {
		dur: 1.7, f0: 54, jitter: 0.2, breath: 0.3, seed: 441, top: 3000,
		formants: [[340, 0.03, 1], [800, 0.025, 0.8], [1700, 0.012, 0.4]],
		glide: (t) => 0.92 + Math.min(1, t * 3) * 0.15,
		env: (t) => Math.min(1, t / 0.1) * Math.pow(1 - t, 1.1) * (0.85 + 0.15 * Math.sin(t * 26)),
	}),
	// the plates knocking as it moves
	plates(sr) {
		const n = N(sr, 0.8), out = new Float32Array(n);
		for (const [t0, f, g] of [[0, 620, 1], [0.09, 1450, 0.5], [0.3, 540, 0.8], [0.36, 2900, 0.3], [0.55, 700, 0.6]]) lay(out, sr, struck(sr, N(sr, 0.35), [[f, 0.12, 1], [f * 2.3, 0.07, 0.5], [f * 4.1, 0.04, 0.25]], { hard: 30, seed: 442 + Math.floor(t0 * 100) }), t0, g);
		return normalise(out, 0.75);
	},
	// a plated arm swung, the signs on it rattling
	plateswing: (sr) => normalise(sum(N(sr, 0.8), [whoosh(sr, 0.8, 520, 150, 443, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 0.5), 1], [KIT.plates(sr).subarray(0, N(sr, 0.8)), 0.5])),
	// the blow landing: metal on flesh, the signs ringing
	plateslam(sr) {
		const n = N(sr, 1.2);
		return normalise(sum(n, [thump(sr, n, 45, 190, 0.2, 30), 1.2], [struck(sr, n, [[310, 0.3, 1], [720, 0.2, 0.7], [1500, 0.1, 0.4]], { hard: 60, seed: 444 }), 8], [hiss(sr, 1.2, (t) => Math.exp(-t * 1.2 / 0.06), 800, 5000, 445), 0.5]));
	},
	// a shot or a blade on a plate: a clang
	clang: (sr) => normalise(sum(N(sr, 0.6), [struck(sr, N(sr, 0.6), [[1750, 0.2, 1], [3400, 0.12, 0.6], [5600, 0.06, 0.3], [420, 0.15, 0.5]], { hard: 30, seed: 446 }), 1], [thump(sr, N(sr, 0.6), 90, 300, 0.05, 40), 0.08])),
	// it comes down in a heap of signs
	heap(sr) {
		const n = N(sr, 2.4), out = new Float32Array(n), R = rnd(447);
		lay(out, sr, throat(sr, { dur: 1.0, f0: 50, jitter: 0.3, breath: 0.4, seed: 448, formants: [[340, 0.03, 1], [800, 0.025, 0.7]], glide: (t) => 1 - t * 0.4, env: (t) => Math.min(1, t / 0.05) * Math.pow(1 - t, 1.5) }), 0, 0.9);
		for (let j = 0; j < 8; j++) { const t0 = 0.5 + Math.pow(R(), 1.3) * 1.3, f = 400 + R() * 1800; lay(out, sr, struck(sr, N(sr, 0.5), [[f, 0.2, 1], [f * 2.2, 0.1, 0.5]], { hard: 40, seed: 449 + j }), t0, (1 - (t0 - 0.5) * 0.5) * 7); }
		lay(out, sr, thump(sr, N(sr, 0.7), 40, 140, 0.25, 25), 0.55, 1.3);
		return normalise(out);
	},

	// ---------- the Spore Hexer and the Sporeborn Miner ----------
	// a whispered chant, three voices not quite together
	chant(sr) {
		const n = N(sr, 2.2), out = new Float32Array(n);
		for (let v = 0; v < 3; v++) {
			const R = rnd(451 + v), times = []; for (let t = R() * 0.08; t < 0.9; t += 0.12 + R() * 0.14) times.push(t);
			lay(out, sr, throat(sr, { dur: 2.2, f0: 115 + v * 22, jitter: 0.12, breath: 0.95, seed: 455 + v, top: 3600, formants: [[450 + v * 90, 0.025, 1], [1400 + v * 200, 0.014, 0.6], [2600, 0.008, 0.35]], env: pulses(times, 0.14, (u) => Math.pow(Math.sin(Math.PI * u), 0.8)) }), 0, 1 / (1 + v * 0.3));
		}
		return normalise(reverb(sum(n, [out, 1], [sub(sr, 2.2, 52, (t) => Math.pow(Math.sin(Math.PI * t), 0.6)), 0.5]), sr, 0.45, 0.8));
	},
	// a curse thrown: a wet pulse, a hum swelling into it, crackle at the edge
	hex(sr) {
		const n = N(sr, 1.0);
		const hum = tone(sr, 1.0, (t) => 140 + t * 90, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.4)), 1.5), [1, 0.5, 0.25, 0.12]);
		const crackle = resonate(hiss(sr, 1.0, (t) => (t > 0.3 ? Math.pow(Math.sin(Math.PI * (t - 0.3) / 0.7), 2) : 0), 2500, 9000, 458), sr, 4200, 0.003, 1);
		return normalise(sum(n, [thump(sr, n, 55, 260, 0.25, 20), 1], [hum, 0.9], [crackle, 0.35], [bubbles(sr, 1.0, 40, 459, 200, 700), 0.3]));
	},
	// a body bursting into spores: soft, a puff, a thousand small pops drifting off
	spores(sr) {
		const n = N(sr, 1.9), R = rnd(461), pops = new Float32Array(n);
		for (let i = 0; i < n; i++) if (R() < 60 * Math.pow(1 - i / n, 2) / sr) for (let k = 0; k < 30 && i + k < n; k++) pops[i + k] += (R() * 2 - 1) * Math.exp(-k / 6);
		return normalise(sum(n, [thump(sr, n, 50, 110, 0.35, 10), 1], [hiss(sr, 1.9, (t) => Math.min(1, t / 0.05) * Math.exp(-t * 1.9 / 0.5), 250, 2200, 462), 1.1], [resonate(pops, sr, 2600, 0.008), 5], [resonate(pops, sr, 1200, 0.01), 4]));
	},
	// the miner's breath: a wet cough, three of them
	wheeze: (sr) => throat(sr, {
		dur: 1.4, f0: 85, jitter: 0.4, breath: 0.95, seed: 463, top: 3400,
		formants: [[420, 0.03, 1], [1100, 0.018, 0.7], [2400, 0.01, 0.4]],
		env: pulses([0, 0.22, 0.5], 0.2, (u) => Math.pow(1 - u, 1.4) * Math.min(1, u * 8)),
	}),
	// a pick swung
	pickswing: (sr) => whoosh(sr, 0.65, 900, 260, 464, (t) => Math.pow(Math.sin(Math.PI * t), 2), 0.4),
	// a pick landing: iron into stone, grit flying
	pickhit(sr) {
		const n = N(sr, 0.9);
		return normalise(sum(n, [struck(sr, n, [[1100, 0.1, 1], [2600, 0.07, 0.6], [5200, 0.04, 0.3], [260, 0.08, 0.7]], { hard: 40, seed: 465 }), 10], [thump(sr, n, 70, 220, 0.1, 40), 0.9], [hiss(sr, 0.9, (t) => Math.exp(-t * 0.9 / 0.12), 1200, 7000, 466), 0.6]));
	},

	// ---------- the Old Drain King ----------
	// a roar in a sewer
	roar: (sr) => normalise(reverb(throat(sr, {
		dur: 2.3, f0: 41, jitter: 0.22, breath: 0.3, seed: 471, top: 3000,
		formants: [[250, 0.04, 1], [620, 0.03, 0.8], [1350, 0.015, 0.4]],
		glide: (t) => 0.9 + Math.min(1, t * 2.5) * 0.2,
		env: (t) => Math.min(1, t / 0.12) * Math.pow(1 - t, 1.0) * (0.85 + 0.15 * Math.sin(t * 22)),
	}), sr, 0.4, 0.8)),
	grunt: (sr) => throat(sr, {
		dur: 0.55, f0: 48, jitter: 0.3, breath: 0.35, seed: 472, formants: [[260, 0.04, 1], [640, 0.03, 0.7]],
		env: (t) => Math.min(1, t / 0.06) * Math.pow(1 - t, 1.3),
	}),
	// a great arm through the air
	heavyswing: (sr) => normalise(sum(N(sr, 0.9), [whoosh(sr, 0.9, 320, 70, 473, (t) => Math.pow(Math.sin(Math.PI * t), 1.4), 0.6), 1], [sub(sr, 0.9, 42, (t) => Math.pow(Math.sin(Math.PI * t), 2)), 0.5])),
	// the blow: a deep wet thud
	kingblow(sr) {
		const n = N(sr, 1.0);
		return normalise(sum(n, [thump(sr, n, 32, 130, 0.3, 18), 1.3], [hiss(sr, 1.0, (t) => Math.exp(-t * 1.0 / 0.07), 300, 2500, 474), 0.6], [bubbles(sr, 1.0, 50, 475, 150, 500), 0.2]));
	},
	// the king down: the roar going out of him, the fall, the water taking him
	kingfall(sr) {
		const n = N(sr, 3.4), out = new Float32Array(n);
		lay(out, sr, throat(sr, { dur: 2.0, f0: 41, jitter: 0.3, breath: 0.4, seed: 476, formants: [[250, 0.04, 1], [620, 0.03, 0.7]], glide: (t) => 1 - t * 0.5, env: (t) => Math.min(1, t / 0.1) * Math.pow(1 - t, 1.6) }), 0, 1);
		lay(out, sr, thump(sr, N(sr, 0.9), 30, 110, 0.35, 15), 1.5, 1.5);
		lay(out, sr, hiss(sr, 1.6, (t) => Math.min(1, t / 0.03) * Math.exp(-t * 1.6 / 0.4), 400, 5000, 477), 1.5, 0.8);
		lay(out, sr, bubbles(sr, 1.8, 30, 478, 100, 400), 1.6, 0.5);
		return normalise(reverb(out, sr, 0.35, 0.8));
	},

	// ---------- the Cinderkin: stone over magma ----------
	// what is under its skin, kept on it: a low churn, the bubbling of it
	magma(sr) {
		const edge = 0.4, n = N(sr, 3 + edge), R = rnd(481), d = new Float32Array(n);
		for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * (0.6 + 0.4 * Math.sin(TAU * 0.45 * i / sr));
		const churn = lowpass(d, sr, 110), blips = lowpass(bubbles(sr, 3 + edge, 9, 482, 60, 220), sr, 400);
		return normalise(seamless(sum(n, [churn, 4], [blips, 1], [resonate(hiss(sr, 3 + edge, () => 1, 100, 600, 483), sr, 180, 0.03), 0.4]), sr, edge), 0.75);
	},
	// stone grinding on stone as it rouses: a roar with grit in it
	rumble(sr) {
		const n = N(sr, 2.2);
		const v = throat(sr, { dur: 2.2, f0: 27, jitter: 0.3, breath: 0.6, seed: 484, top: 2400, formants: [[150, 0.05, 1], [410, 0.035, 0.8], [900, 0.02, 0.4]], env: (t) => Math.min(1, t / 0.2) * Math.pow(1 - t, 0.9) });
		const grit = resonate(hiss(sr, 2.2, (t) => Math.pow(Math.sin(Math.PI * t), 0.8) * (0.6 + 0.4 * Math.sin(t * 50)), 800, 4000, 485), sr, 1500, 0.004, 1);
		return normalise(sum(n, [v, 1], [grit, 0.35], [sub(sr, 2.2, 36, (t) => Math.pow(Math.sin(Math.PI * t), 0.7)), 0.6]));
	},
	// a stone arm swung, grinding at the shoulder
	grind: (sr) => normalise(sum(N(sr, 0.9), [whoosh(sr, 0.9, 260, 80, 486, (t) => Math.pow(Math.sin(Math.PI * t), 1.3), 0.6), 1], [resonate(hiss(sr, 0.9, (t) => Math.pow(Math.sin(Math.PI * t), 1), 600, 3500, 487), sr, 1200, 0.004, 1), 0.4])),
	// the blow: rock on rock, cracks spitting off it
	stonecrush(sr) {
		const n = N(sr, 1.3), R = rnd(488), out = sum(n, [thump(sr, n, 34, 140, 0.28, 22), 1.3], [struck(sr, n, [[380, 0.08, 1], [900, 0.05, 0.6], [2100, 0.03, 0.3]], { hard: 70, seed: 489 }), 7]);
		for (let j = 0; j < 5; j++) lay(out, sr, struck(sr, N(sr, 0.2), [[1500 + R() * 2500, 0.015, 1]], { hard: 12, seed: 490 + j }), 0.02 + R() * 0.25, 3);
		return normalise(sum(n, [out, 1], [hiss(sr, 1.3, (t) => Math.exp(-t * 1.3 / 0.2), 500, 4000, 495), 0.5]));
	},
	// struck: stone cracking
	crack(sr) {
		const n = N(sr, 0.45), R = rnd(496), out = struck(sr, n, [[420, 0.05, 1], [950, 0.04, 0.7], [2300, 0.02, 0.4]], { hard: 30, seed: 497 });
		for (let j = 0; j < 4; j++) lay(out, sr, struck(sr, N(sr, 0.15), [[2000 + R() * 3000, 0.01, 1]], { hard: 8, seed: 498 + j }), R() * 0.2, 0.3);
		return normalise(sum(n, [out, 1], [hiss(sr, 0.45, (t) => Math.exp(-t * 0.45 / 0.08), 1500, 7000, 499), 0.03]));
	},
	// it comes apart: cracks running through it, the fall, gravel settling, the magma hissing out
	rockfall(sr) {
		const n = N(sr, 3.6), R = rnd(501), out = new Float32Array(n);
		for (let j = 0; j < 7; j++) lay(out, sr, KIT.crack(sr), Math.pow(R(), 1.3) * 1.2, 0.8);
		lay(out, sr, thump(sr, N(sr, 1.0), 28, 120, 0.4, 16), 1.3, 1.6);
		lay(out, sr, hiss(sr, 2.2, (t) => Math.min(1, t / 0.05) * Math.exp(-t * 2.2 / 0.6), 300, 3000, 502), 1.3, 0.7);
		const gravel = new Float32Array(n);
		for (let i = Math.floor(sr * 1.4); i < n; i++) if (R() < 25 * (1 - i / n) / sr) for (let k = 0; k < 40 && i + k < n; k++) gravel[i + k] += (R() * 2 - 1) * Math.exp(-k / 7);
		lay(out, sr, resonate(gravel, sr, 1700, 0.01), 0, 6);
		lay(out, sr, hiss(sr, 2.0, (t) => Math.pow(Math.sin(Math.PI * t), 1.2), 1500, 8000, 503), 1.6, 0.35);
		return normalise(out);
	},

	// ---------- the Saltmarsh Mother ----------
	// a keening, wet at the bottom of it
	keen(sr) {
		const n = N(sr, 2.5);
		const v = throat(sr, { dur: 2.5, f0: 215, jitter: 0.06, breath: 0.5, seed: 511, top: 4000, formants: [[520, 0.03, 1], [930, 0.025, 0.8], [2500, 0.012, 0.4]], glide: (t) => 1 + Math.sin(t * 9) * 0.05 + Math.sin(Math.PI * t) * 0.2, env: (t) => Math.min(1, t / 0.2) * Math.pow(1 - t, 1.0) * (0.85 + 0.15 * Math.sin(t * 28)) });
		return normalise(reverb(sum(n, [v, 1], [lowpass(bubbles(sr, 2.5, 25, 512, 90, 400), sr, 700), 0.35], [sub(sr, 2.5, 55, (t) => Math.pow(Math.sin(Math.PI * t), 0.8)), 0.4]), sr, 0.3, 0.75));
	},
	// what she does between: a gurgle from a throat full of water
	gurgle: (sr) => normalise(sum(N(sr, 1.1), [throat(sr, { dur: 1.1, f0: 78, jitter: 0.45, breath: 0.7, seed: 513, top: 2600, formants: [[380, 0.04, 1], [800, 0.03, 0.7]], env: adsr(0.1, 0.5, 1.4) }), 1], [lowpass(bubbles(sr, 1.1, 45, 514, 100, 450), sr, 800), 0.6])),
	// a wet arm swiped through the air, water off it
	wetswipe: (sr) => normalise(sum(N(sr, 0.75), [whoosh(sr, 0.75, 480, 130, 515, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 0.5), 1], [hiss(sr, 0.75, (t) => Math.pow(Math.sin(Math.PI * t), 2), 1500, 7000, 516), 0.4])),
	// the blow: a wet slap
	slap(sr) {
		const n = N(sr, 0.7);
		return normalise(sum(n, [thump(sr, n, 70, 280, 0.08, 40), 1], [hiss(sr, 0.7, (t) => Math.min(1, t / 0.01) * Math.exp(-t * 0.7 / 0.09), 400, 6000, 517), 0.9], [lowpass(bubbles(sr, 0.7, 60, 518, 150, 600), sr, 900), 0.3]));
	},
	// she goes under: the keen falling, the water closing over it
	drown(sr) {
		const n = N(sr, 3.4);
		const v = throat(sr, { dur: 3.4, f0: 215, jitter: 0.08, breath: 0.5, seed: 519, top: 4000, formants: [[520, 0.03, 1], [930, 0.025, 0.7]], glide: (t) => 1.05 - t * 0.5, env: (t) => Math.min(1, t / 0.15) * Math.pow(1 - t, 1.5) });
		// (the top goes as the water closes: the voice sinks under it)
		const under = new Float32Array(n); let y = 0;
		for (let i = 0; i < n; i++) { const t = i / n, a = 1 - Math.exp(-TAU * (3500 * Math.pow(0.05, t)) / sr); y += (v[i] - y) * a; under[i] = y; }
		return normalise(reverb(sum(n, [under, 1], [bubbles(sr, 3.4, 35, 520, 80, 500), 0.6], [hiss(sr, 3.4, (t) => (t < 0.4 ? 0 : Math.pow(Math.sin(Math.PI * (t - 0.4) / 0.6), 1.5)), 200, 1800, 521), 0.5]), sr, 0.3, 0.8));
	},

	// ---------- the Moonturned and the hounds ----------
	// the change: a scream going down into a growl, bones going in it
	turnscream(sr) {
		const n = N(sr, 2.6), R = rnd(531);
		const v = throat(sr, { dur: 2.6, f0: 250, jitter: 0.06, breath: 0.35, seed: 532, top: 4500, formants: [[700, 0.025, 1], [1500, 0.015, 0.8], [2900, 0.008, 0.45]], glide: (t) => 1 - Math.pow(t, 1.5) * 0.72, env: (t) => Math.min(1, t / 0.1) * (0.85 + 0.15 * Math.sin(t * 35)) * (1 - clamp((t - 0.8) / 0.2, 0, 1)) });
		const growl = throat(sr, { dur: 2.6, f0: 36, jitter: 0.35, breath: 0.3, seed: 533, formants: [[200, 0.035, 1], [500, 0.025, 0.7], [1050, 0.015, 0.35]], env: (t) => Math.pow(clamp((t - 0.4) / 0.5, 0, 1), 1.5) * (1 - clamp((t - 0.85) / 0.15, 0, 1)) });
		const out = sum(n, [v, 1], [growl, 1]);
		for (let j = 0; j < 9; j++) lay(out, sr, struck(sr, N(sr, 0.12), [[500 + R() * 900, 0.015, 1], [2200 + R() * 2000, 0.008, 0.5]], { hard: 10, seed: 534 + j }), 0.3 + R() * 1.8, 1.5);
		return normalise(reverb(out, sr, 0.25, 0.7));
	},
	// a howl, the note held and breaking at the end
	howl: (sr) => normalise(reverb(throat(sr, {
		dur: 2.9, f0: 225, jitter: 0.03, breath: 0.2, seed: 535, top: 4200,
		formants: [[600, 0.03, 1], [1200, 0.02, 0.7], [2500, 0.01, 0.35]],
		glide: (t) => 0.78 + Math.min(1, t * 3.5) * 0.3 - Math.pow(clamp((t - 0.8) / 0.2, 0, 1), 2) * 0.2,
		env: (t) => Math.min(1, t / 0.2) * (1 - clamp((t - 0.75) / 0.25, 0, 1)) * (0.9 + 0.1 * Math.sin(t * 40)),
	}), sr, 0.35, 0.8)),
	// hurt, a whine; dead, the whine going out
	whine: (sr) => throat(sr, {
		dur: 1.6, f0: 290, jitter: 0.05, breath: 0.3, seed: 536, top: 4500,
		formants: [[750, 0.025, 1], [1600, 0.015, 0.7], [3000, 0.008, 0.35]],
		glide: (t) => 1 + Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.25 - t * 0.35,
		env: (t) => Math.min(1, t / 0.08) * Math.pow(1 - t, 1.6) * (0.85 + 0.15 * Math.sin(t * 24)),
	}),

	// ---------- the Gloomcrawler ----------
	// a dry skitter: legs ticking, a rasp in its throat
	skitter(sr) {
		const n = N(sr, 0.8), R = rnd(541), d = new Float32Array(n);
		for (let t = 0; t < 0.7; t += 0.04 + R() * 0.05) { const i0 = Math.floor(t * sr); for (let k = 0; k < 40 && i0 + k < n; k++) d[i0 + k] += (R() * 2 - 1) * Math.exp(-k / 7); }
		return normalise(sum(n, [resonate(d, sr, 2400, 0.006), 6], [throat(sr, { dur: 0.8, f0: 60, jitter: 0.5, breath: 0.8, seed: 542, top: 3000, formants: [[500, 0.02, 1], [1300, 0.012, 0.6]], env: adsr(0.1, 0.5, 1.3) }), 0.5]), 0.75);
	},
	// its screech, with its weight under it
	screech: (sr) => normalise(sum(N(sr, 1.0), [throat(sr, {
		dur: 1.0, f0: 290, jitter: 0.18, breath: 0.45, seed: 543, top: 5000,
		formants: [[900, 0.02, 1], [2000, 0.012, 0.8], [3500, 0.008, 0.45]],
		glide: (t) => 1.1 - t * 0.25,
		env: (t) => Math.min(1, t / 0.05) * Math.pow(1 - t, 1.1) * (0.8 + 0.2 * Math.sin(t * 60)),
	}), 1], [throat(sr, { dur: 1.0, f0: 40, jitter: 0.35, breath: 0.3, seed: 544, formants: [[220, 0.035, 1], [520, 0.025, 0.6]], env: adsr(0.08, 0.5, 1.2) }), 0.7])),
	// a gob of the Deep's light spat: a wet pulse and a sizzle
	spit(sr) {
		const n = N(sr, 0.7);
		return normalise(sum(n, [thump(sr, n, 90, 320, 0.08, 35), 1], [hiss(sr, 0.7, (t) => Math.min(1, t / 0.02) * Math.exp(-t * 0.7 / 0.15), 800, 7000, 545), 0.8], [resonate(hiss(sr, 0.7, (t) => Math.pow(Math.sin(Math.PI * t), 2), 3000, 9000, 546), sr, 5000, 0.003, 1), 0.4], [tone(sr, 0.7, (t) => 180 + t * 120, (t) => Math.pow(Math.sin(Math.PI * t), 2), [1, 0.4]), 0.5]));
	},
	// it shrivels: a hiss going out, a crackle, a last click of legs
	shrivel(sr) {
		const n = N(sr, 1.8), R = rnd(547), d = new Float32Array(n);
		for (let i = 0; i < n; i++) if (R() < 40 * (1 - i / n) / sr) for (let k = 0; k < 30 && i + k < n; k++) d[i + k] += (R() * 2 - 1) * Math.exp(-k / 6);
		const out = sum(n, [hiss(sr, 1.8, (t) => Math.min(1, t / 0.03) * Math.exp(-t * 1.8 / 0.45), 500, 5000, 548), 1], [resonate(d, sr, 2800, 0.006), 5], [throat(sr, { dur: 1.8, f0: 280, jitter: 0.2, breath: 0.5, seed: 549, top: 5000, formants: [[900, 0.02, 1], [2000, 0.012, 0.7]], glide: (t) => 1 - t * 0.5, env: (t) => Math.min(1, t / 0.04) * Math.pow(1 - t, 2.5) }), 0.8]);
		return normalise(out);
	},

	// ---------- the Undertow: the sea with teeth ----------
	// it rises: the rush of water, and the bellow under it
	surge(sr) {
		const n = N(sr, 2.3);
		const rush = whoosh(sr, 2.3, 180, 60, 551, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 1.1), 0.8);
		const spray = hiss(sr, 2.3, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 1200, 7000, 552);
		const v = throat(sr, { dur: 2.3, f0: 35, jitter: 0.25, breath: 0.6, seed: 553, top: 2200, formants: [[170, 0.05, 1], [430, 0.035, 0.8], [950, 0.02, 0.35]], env: (t) => Math.pow(Math.sin(Math.PI * t), 0.9) });
		return normalise(sum(n, [rush, 1], [spray, 0.35], [v, 1], [bubbles(sr, 2.3, 30, 554, 80, 400), 0.4]));
	},
	// between: water running off it, dripping
	drip(sr) {
		const n = N(sr, 1.2), R = rnd(555), out = new Float32Array(n);
		for (let j = 0; j < 6; j++) { const f = 700 + R() * 1800; lay(out, sr, tone(sr, 0.09, (t) => f * (1 + t * 0.9), (t) => Math.sin(Math.PI * t) * Math.pow(1 - t, 0.5)), R() * 1.0, 0.6 + R() * 0.4); }
		return normalise(sum(n, [out, 1], [lowpass(bubbles(sr, 1.2, 20, 556, 100, 400), sr, 800), 0.5], [hiss(sr, 1.2, (t) => 0.5 + 0.5 * Math.sin(t * 9), 300, 2000, 557), 0.15]), 0.7);
	},
	// the blow: a wave breaking on you
	wavecrash(sr) {
		const n = N(sr, 1.6);
		return normalise(sum(n, [thump(sr, n, 36, 130, 0.3, 18), 1.2], [hiss(sr, 1.6, (t) => Math.min(1, t / 0.03) * Math.exp(-t * 1.6 / 0.45), 300, 6000, 558), 1.1], [bubbles(sr, 1.6, 60, 559, 100, 600), 0.4], [whoosh(sr, 1.6, 600, 150, 560, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 2)), 2), 0.6), 0.5]));
	},
	// it sinks: the bellow going under, the water boiling over where it was
	sink(sr) {
		const n = N(sr, 3.2);
		const v = throat(sr, { dur: 3.2, f0: 35, jitter: 0.3, breath: 0.6, seed: 561, top: 2200, formants: [[170, 0.05, 1], [430, 0.035, 0.7]], glide: (t) => 1 - t * 0.4, env: (t) => Math.min(1, t / 0.1) * Math.pow(1 - t, 1.8) });
		const under = new Float32Array(n); let y = 0;
		for (let i = 0; i < n; i++) { const t = i / n, a = 1 - Math.exp(-TAU * (2200 * Math.pow(0.08, t)) / sr); y += (v[i] - y) * a; under[i] = y; }
		return normalise(sum(n, [under, 1], [bubbles(sr, 3.2, 50, 562, 70, 450), 0.8], [hiss(sr, 3.2, (t) => Math.pow(Math.sin(Math.PI * t), 1.2), 200, 1500, 563), 0.5]));
	},

	// ---------- the Lampeater ----------
	// leather wings, kept beating over you
	wings(sr) {
		const edge = 0.3, dur = 2.5, n = N(sr, dur + edge), out = new Float32Array(n), R = rnd(571);
		for (let t = 0; t < dur + edge; t += 0.31) {
			lay(out, sr, whoosh(sr, 0.26, 220, 70, 572 + Math.floor(t * 10), (u) => Math.pow(Math.sin(Math.PI * u), 1.3), 0.7), t, 0.8 + R() * 0.2);
			lay(out, sr, hiss(sr, 0.12, (u) => Math.sin(Math.PI * u), 1200, 5000, 573 + Math.floor(t * 10)), t + 0.04, 0.15);
		}
		return normalise(seamless(out, sr, edge), 0.8);
	},
	// its shriek, from a chest that eats light
	shriek: (sr) => normalise(sum(N(sr, 0.95), [throat(sr, {
		dur: 0.95, f0: 400, jitter: 0.1, breath: 0.45, seed: 574, top: 6000,
		formants: [[1100, 0.02, 1], [2300, 0.012, 0.8], [4000, 0.007, 0.45]],
		glide: (t) => 0.85 + Math.min(1, t * 4) * 0.3 - t * 0.15,
		env: (t) => Math.min(1, t / 0.04) * Math.pow(1 - t, 1.2) * (0.85 + 0.15 * Math.sin(t * 70)),
	}), 1], [sub(sr, 0.95, 60, (t) => Math.min(1, t / 0.05) * Math.pow(1 - t, 1.5)), 0.5])),
	// it drops: the shriek cut off, the body landing
	fall(sr) {
		const n = N(sr, 1.6), out = new Float32Array(n);
		lay(out, sr, shape(KIT.shriek(sr), (t) => 1 - clamp((t - 0.5) / 0.1, 0, 1)), 0, 1);
		lay(out, sr, whoosh(sr, 0.6, 400, 120, 575, (t) => Math.pow(t, 2), 0.6), 0.5, 0.5);
		lay(out, sr, thump(sr, N(sr, 0.5), 55, 180, 0.12, 35), 1.05, 1);
		lay(out, sr, hiss(sr, 0.4, (t) => Math.exp(-t * 0.4 / 0.06), 800, 5000, 576), 1.05, 0.4);
		return normalise(out);
	},

	// ---------- the Facet Wraith: a shell of crystal ----------
	// the shell singing to itself, kept on it: glass tones beating slowly against each other
	chime(sr) {
		const edge = 0.5, dur = 4, n = N(sr, dur + edge), out = new Float32Array(n);
		for (const [f, g, w] of [[1046, 1, 0.13], [1318, 0.8, 0.17], [1568, 0.7, 0.11], [2093, 0.5, 0.21], [2637, 0.35, 0.09], [523, 0.6, 0.07]]) lay(out, sr, tone(sr, dur + edge, () => f * (1 + Math.sin(TAU * w * 0.3) * 0.002), (t) => 0.6 + 0.4 * Math.sin(TAU * w * t * (dur + edge) + f)), 0, g);
		return normalise(seamless(out, sr, edge), 0.6);
	},
	// it turns on you: a chord struck in the shell, swelling
	chord(sr) {
		const n = N(sr, 2.6), out = struck(sr, n, [[523, 1.4, 1], [784, 1.2, 0.8], [1046, 1.0, 0.7], [1318, 0.9, 0.5], [2093, 0.6, 0.35], [131, 1.6, 0.5]], { hard: 80, seed: 581 });
		return normalise(reverb(sum(n, [out, 1], [tone(sr, 2.6, () => 131, (t) => Math.pow(Math.sin(Math.PI * t), 1.2), [1, 0.5, 0.3]), 0.03]), sr, 0.45, 0.85));
	},
	// a shard arm swept: air, with a ring in it
	glassswipe: (sr) => normalise(sum(N(sr, 0.8), [whoosh(sr, 0.8, 1600, 500, 582, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 0.4), 1], [struck(sr, N(sr, 0.8), [[2093, 0.3, 1], [3136, 0.2, 0.6]], { at: 0.3, hard: 20, seed: 583 }), 3], [whoosh(sr, 0.8, 300, 120, 584, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 0.5), 0.6])),
	// the shards landing: a ringing blow
	glasshit: (sr) => normalise(sum(N(sr, 1.0), [struck(sr, N(sr, 1.0), [[1046, 0.4, 1], [2093, 0.3, 0.7], [3500, 0.15, 0.4], [262, 0.3, 0.6]], { hard: 40, seed: 585 }), 1], [thump(sr, N(sr, 1.0), 70, 220, 0.1, 40), 0.1])),

	// ---------- the Shard Mite ----------
	// a quick double tick of crystal feet as it strikes
	tick(sr) {
		const n = N(sr, 0.2), out = struck(sr, n, [[4600, 0.04, 1], [7200, 0.03, 0.5]], { hard: 12, seed: 591 });
		return normalise(sum(n, [out, 1], [struck(sr, n, [[5200, 0.04, 1], [8000, 0.02, 0.5]], { at: 0.07, hard: 12, seed: 592 }), 1]), 0.7);
	},

	// ---------- the Hollow King ----------
	// a voice through a great helm: the words gone, the iron of it left
	hollow(sr) {
		const n = N(sr, 2.5);
		const v = throat(sr, { dur: 2.5, f0: 47, jitter: 0.12, breath: 0.3, seed: 601, top: 2800, formants: [[240, 0.04, 1], [560, 0.03, 0.8], [1200, 0.015, 0.4]], glide: (t) => 0.95 + Math.min(1, t * 2) * 0.1, env: (t) => Math.min(1, t / 0.15) * Math.pow(1 - t, 0.9) * (0.9 + 0.1 * Math.sin(t * 17)) });
		const helm = sum(n, [resonate(v, sr, 700, 0.03), 1], [resonate(v, sr, 1300, 0.025), 0.6]);
		return normalise(reverb(sum(n, [v, 1], [helm, 0.4], [sub(sr, 2.5, 47, (t) => Math.pow(Math.sin(Math.PI * t), 0.7)), 0.5]), sr, 0.5, 0.86));
	},
	// its plate shifting as it moves: soft clinks, the creak of what holds them
	armour(sr) {
		const n = N(sr, 0.9), out = new Float32Array(n), R = rnd(602);
		for (let j = 0; j < 5; j++) { const f = 900 + R() * 1600; lay(out, sr, struck(sr, N(sr, 0.3), [[f, 0.08, 1], [f * 2.1, 0.05, 0.5]], { hard: 16, seed: 603 + j }), R() * 0.7, 0.5 + R() * 0.5); }
		const creak = resonate(hiss(sr, 0.9, (t) => Math.pow(Math.sin(Math.PI * t), 2) * (0.5 + 0.5 * Math.sin(t * 90)), 200, 900, 608), sr, 420, 0.02, 1);
		return normalise(sum(n, [out, 1], [creak, 0.5]), 0.7);
	},
	// the great sword swung: the air parting, the edge singing
	bladeswing: (sr) => normalise(sum(N(sr, 1.0), [whoosh(sr, 1.0, 900, 180, 609, (t) => Math.pow(Math.sin(Math.PI * t), 1.6), 0.45), 1], [whoosh(sr, 1.0, 240, 60, 610, (t) => Math.pow(Math.sin(Math.PI * t), 1.4), 0.6), 0.7], [tone(sr, 1.0, (t) => 2600 - t * 400, (t) => Math.pow(Math.sin(Math.PI * t), 3)), 0.06])),
	// the sword landing: steel ringing, the weight of the blow under it
	bladeclang(sr) {
		const n = N(sr, 1.4);
		return normalise(sum(n, [struck(sr, n, [[520, 0.5, 1], [1150, 0.35, 0.8], [2400, 0.2, 0.5], [3900, 0.1, 0.3]], { hard: 50, seed: 611 }), 10], [thump(sr, n, 40, 170, 0.25, 25), 1.2], [hiss(sr, 1.4, (t) => Math.exp(-t * 1.4 / 0.05), 1500, 8000, 612), 0.4]));
	},
	// the king's end: a bell tolling once, and the armour coming down empty
	knell(sr) {
		const n = N(sr, 4.5), out = struck(sr, n, [[110, 2.6, 1], [220, 2.2, 0.7], [331, 1.8, 0.5], [441, 1.5, 0.4], [662, 1.0, 0.25], [883, 0.7, 0.15]], { hard: 120, seed: 613 });
		for (let i = 0; i < n; i++) out[i] *= 12;
		const R = rnd(614);
		for (let j = 0; j < 7; j++) { const f = 500 + R() * 1700; lay(out, sr, struck(sr, N(sr, 0.6), [[f, 0.25, 1], [f * 2.2, 0.12, 0.5]], { hard: 40, seed: 615 + j }), 1.4 + Math.pow(R(), 1.3) * 1.4, 5); }
		lay(out, sr, thump(sr, N(sr, 0.8), 36, 130, 0.3, 20), 1.5, 1.3);
		return normalise(reverb(out, sr, 0.4, 0.86));
	},

	// ---------- the Lumen Leviathan ----------
	// its roar: a throat of crystal, a chord ringing in it
	crystalroar(sr) {
		const n = N(sr, 2.4);
		const v = throat(sr, { dur: 2.4, f0: 50, jitter: 0.18, breath: 0.35, seed: 621, top: 3600, formants: [[260, 0.04, 1], [700, 0.03, 0.8], [1600, 0.015, 0.45]], glide: (t) => 0.9 + Math.min(1, t * 2.5) * 0.2, env: (t) => Math.min(1, t / 0.12) * Math.pow(1 - t, 0.9) * (0.85 + 0.15 * Math.sin(t * 24)) });
		const glass = struck(sr, n, [[784, 1.0, 1], [1175, 0.8, 0.7], [1568, 0.7, 0.5], [2349, 0.5, 0.3]], { hard: 60, seed: 622 });
		return normalise(reverb(sum(n, [v, 1], [glass, 4], [sub(sr, 2.4, 42, (t) => Math.pow(Math.sin(Math.PI * t), 0.7)), 0.6]), sr, 0.45, 0.84));
	},
	// the strike: its length coming at you, scales rushing over stone
	lunge(sr) {
		const n = N(sr, 1.3);
		return normalise(sum(n, [whoosh(sr, 1.3, 300, 90, 623, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.2)), 1.2), 0.6), 1], [resonate(hiss(sr, 1.3, (t) => Math.pow(Math.sin(Math.PI * t), 1), 1500, 8000, 624), sr, 3500, 0.003, 1), 0.4], [sub(sr, 1.3, 38, (t) => Math.pow(Math.sin(Math.PI * t), 1.5)), 0.7]));
	},
	// a burst of it moving: scales over the gallery floor, a few ticks of crystal in it
	slither(sr) {
		const n = N(sr, 0.7), R = rnd(625), d = new Float32Array(n);
		for (let i = 0; i < n; i++) if (R() < 30 / sr) for (let k = 0; k < 20 && i + k < n; k++) d[i + k] += (R() * 2 - 1) * Math.exp(-k / 4);
		return normalise(sum(n, [hiss(sr, 0.7, (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.3)), 1.2), 700, 5000, 626), 1], [resonate(d, sr, 4800, 0.02), 4], [lowpass(hiss(sr, 0.7, (t) => Math.pow(Math.sin(Math.PI * t), 1.2), 40, 200, 627), sr, 150), 2]), 0.8);
	},
	// the cave sung at: a pulse of light that is sound too
	pulse(sr) {
		const n = N(sr, 1.6);
		return normalise(reverb(sum(n, [thump(sr, n, 30, 90, 0.5, 10), 1.3], [struck(sr, n, [[1046, 0.9, 1], [1568, 0.7, 0.7], [2093, 0.5, 0.5], [3136, 0.3, 0.3]], { hard: 40, seed: 628 }), 5], [hiss(sr, 1.6, (t) => Math.min(1, t / 0.02) * Math.exp(-t * 1.6 / 0.3), 1000, 8000, 629), 0.5]), sr, 0.4, 0.84));
	},
	// its breastplate bursting: a great crack, and the shower of it
	burst(sr) {
		const n = N(sr, 2.4), R = rnd(631), out = sum(n, [thump(sr, n, 28, 120, 0.4, 14), 1.4]);
		lay(out, sr, struck(sr, N(sr, 0.5), [[300, 0.12, 1], [800, 0.08, 0.7], [1800, 0.05, 0.4]], { hard: 120, seed: 632 }), 0, 8);
		for (let j = 0; j < 40; j++) { const t0 = Math.pow(R(), 1.5) * 1.6, f = 1800 + R() * 6000; lay(out, sr, struck(sr, N(sr, 0.4), [[f, 0.05 + R() * 0.1, 1]], { hard: 10, seed: 633 + j }), 0.03 + t0, 1.5 * (1 - t0 * 0.5)); }
		return normalise(reverb(out, sr, 0.35, 0.8));
	},
	// crystal cracking open where the mites come out
	cracking(sr) {
		const n = N(sr, 1.2), R = rnd(641), out = new Float32Array(n);
		for (let j = 0; j < 8; j++) lay(out, sr, struck(sr, N(sr, 0.3), [[1200 + R() * 3000, 0.04, 1], [600 + R() * 400, 0.06, 0.6]], { hard: 24, seed: 642 + j }), Math.pow(R(), 1.2) * 0.8, 1);
		return normalise(sum(n, [out, 1], [hiss(sr, 1.2, (t) => Math.pow(Math.sin(Math.PI * t), 1.5), 2000, 9000, 650), 0.15]));
	},
};
