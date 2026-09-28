// The composer behind Crysis auto music. Pure: it knows nothing of audio or the world.
// Each call to bar() writes one bar of 16 sixteenth steps for five parts (melody, counter,
// arp, pad, bass) and the drums, as scale degrees turned into semitones over the root.
//
// The shape of it:
//   sections   intro, verse, chorus, bridge, breakdown, build: a Markov walk, pulled
//              toward what the game asks for (energy) and pushed by moments (a climax)
//   harmony    a progression per section, remembered, so a chorus comes back as itself
//   melody     a one-bar motif per section, developed through four-bar phrases (repeat,
//              sequence, inversion, retrograde, displacement, fragment, ornament) and
//              closed with a cadence and a rest
//   answer     the counter voice answers the call in the melody's rests, or quotes what
//              the player just played
//   dynamics   an arc that rises slowly into a chorus and lets go faster; builds swell
//   drums      the faceplate's own selected beat, thinned or filled by energy, varied a
//              little each bar, with fills at phrase ends and a crash on a new section

export function rng(seed) {
	let s = (seed >>> 0) || 1;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the notes of one octave of a scale (the faceplate's arrays run past the octave)
export function pitchSet(intervals) {
	const out = [];
	for (const v of intervals || []) { if (v >= 12) break; if (!out.includes(v)) out.push(v); }
	return out.length ? out.sort((a, b) => a - b) : [0, 2, 4, 5, 7, 9, 11];
}
// a degree (any integer) to semitones over the root
export function semiOf(pcs, d) {
	const n = pcs.length, o = Math.floor(d / n);
	return pcs[((d % n) + n) % n] + 12 * o;
}
// the degree whose pitch is nearest a semitone value
function degNear(pcs, semi) {
	const n = pcs.length;
	let best = 0, bd = 1e9;
	for (let d = Math.floor(semi / 12) * n - n; d <= Math.floor(semi / 12) * n + 2 * n; d++) {
		const e = Math.abs(semiOf(pcs, d) - semi);
		if (e < bd) { bd = e; best = d; }
	}
	return best;
}
// a chord on a degree, stacked in rough thirds whatever the scale (pentatonic, blues,
// whole tone, chromatic all give something sensible)
export function chordDegs(pcs, root, seventh) {
	const base = semiOf(pcs, root), out = [root];
	for (const want of seventh ? [3.5, 7, 10.5] : [3.5, 7]) {
		let best = root + 1, bd = 1e9;
		for (let d = root + 1; d <= root + pcs.length + 1; d++) {
			const e = Math.abs(semiOf(pcs, d) - base - want);
			if (e < bd && !out.includes(d)) { bd = e; best = d; }
		}
		out.push(best);
	}
	return out;
}

// progressions as degrees of the scale; bright ones lean on I IV V, dark ones on vi ii iii
const PROGS = {
	bright: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3], [3, 4, 0, 0], [0, 3, 0, 4], [0, 1, 3, 4], [0, 4, 3, 4]],
	dark: [[0, 5, 3, 4], [5, 3, 0, 4], [0, 6, 5, 6], [0, 2, 5, 4], [5, 5, 3, 4], [0, 3, 6, 4], [0, 5, 1, 4]],
	bridge: [[3, 4, 5, 5], [5, 3, 4, 4], [1, 4, 0, 5], [3, 1, 4, 4], [5, 4, 3, 4]],
	drone: [[0, 0, 0, 0], [0, 0, 6, 0], [0, 1, 0, 0], [0, 0, 5, 0]],
};

// the form: where each section tends to go, what it asks of each part
export const SECTIONS = {
	intro: { energy: 0.32, bars: [4, 8], next: { verse: 3, build: 0.4 }, parts: { mel: 0.35, counter: 0.2, arp: 0.7, pad: 1, bass: 0.5, drums: 0.25 } },
	verse: { energy: 0.52, bars: [8, 16], next: { chorus: 3, bridge: 1.4, verse: 0.6, breakdown: 0.5 }, parts: { mel: 1, counter: 0.5, arp: 0.3, pad: 1, bass: 1, drums: 0.75 } },
	chorus: { energy: 0.84, bars: [8, 8], next: { verse: 2, breakdown: 1.4, bridge: 1, chorus: 0.4 }, parts: { mel: 1, counter: 0.8, arp: 0.5, pad: 1, bass: 1, drums: 1 } },
	bridge: { energy: 0.6, bars: [8, 8], next: { build: 2, chorus: 1.2, breakdown: 0.6 }, parts: { mel: 0.8, counter: 1, arp: 0.4, pad: 1, bass: 0.9, drums: 0.7 } },
	breakdown: { energy: 0.26, bars: [4, 8], next: { build: 2.2, verse: 1.2, intro: 0.3 }, parts: { mel: 0.4, counter: 0.5, arp: 1, pad: 1, bass: 0.4, drums: 0.15 } },
	build: { energy: 0.7, bars: [2, 4], next: { chorus: 4 }, parts: { mel: 0.6, counter: 0.4, arp: 1, pad: 1, bass: 1, drums: 1 } },
};
const ARC = { intro: 0.4, verse: 0.6, chorus: 0.92, bridge: 0.66, breakdown: 0.34, build: 0.7 };

// how each faceplate likes its bass and pads (the flight composer's profiles, extended)
export const STYLES = {
	BARD: { bass: 'root5', pad: 'hold', seventh: false, arp: 'up' },
	MAESTRO: { bass: 'root5', pad: 'hold', seventh: false, arp: 'broken' },
	SYNTHWAVE: { bass: 'octave', pad: 'hold', seventh: true, arp: 'updown' },
	DNB: { bass: 'sub', pad: 'hold', seventh: true, arp: 'broken' },
	SPARKLE: { bass: 'root', pad: 'hold', seventh: true, arp: 'updown' },
	SOUL: { bass: 'walk', pad: 'hold', seventh: true, arp: 'broken' },
	GAS: { bass: 'offbeat', pad: 'stab', seventh: true, arp: 'up' },
	HYPHY: { bass: 'eight08', pad: 'stab', seventh: false, arp: 'broken' },
	DANCEHALL: { bass: 'riddim', pad: 'skank', seventh: false, arp: 'up' },
	GLITCHPOP: { bass: 'octave', pad: 'stab', seventh: false, arp: 'updown' },
	KAWAII: { bass: 'root5', pad: 'hold', seventh: true, arp: 'updown' },
	BREW: { bass: 'walk', pad: 'hold', seventh: true, arp: 'broken' },
};

export function createComposer(seed = 1) {
	const R = rng(seed);
	const pick = (a) => a[Math.floor(R() * a.length) % a.length];
	const chance = (p) => R() < p;
	const S = {
		section: null, secBars: 0, barIn: 0, abs: 0, arc: 0.35, themes: {}, progs: {}, prog: null,
		lastMel: null, pad: null, history: [], queued: null, lastChordRoot: 0, phraseType: 'aaba', userRiff: [],
	};

	function weightedNext(from, M) {
		const opts = SECTIONS[from]?.next || { verse: 1 };
		const want = M.energy;
		let total = 0;
		const w = {};
		for (const [k, v] of Object.entries(opts)) {
			// sections near the game's energy are preferred; moments push harder
			let x = v * (1.25 - Math.min(1, Math.abs(SECTIONS[k].energy - want) * 1.6));
			if (M.tension > 0.4 && k === 'build') x *= 1 + M.tension * 3;
			if (M.climax && (k === 'chorus' || k === 'build')) x *= 4;
			if (M.sparse > 0.5 && (k === 'breakdown' || k === 'intro')) x *= 1 + M.sparse * 2;
			if (M.sparse > 0.5 && k === 'chorus') x *= 0.5;
			if (k === from) x *= 0.5;
			w[k] = Math.max(0.02, x); total += w[k];
		}
		let r = R() * total;
		for (const [k, x] of Object.entries(w)) { r -= x; if (r <= 0) return k; }
		return 'verse';
	}

	function enter(name, M) {
		S.section = name;
		const [a, b] = SECTIONS[name].bars;
		let bars = a === b ? a : pick([a, b, a]);
		if (M.sparse > 0.6 && name !== 'build') bars = Math.max(bars, 8);
		S.secBars = bars; S.barIn = 0;
		// progressions are remembered: a chorus returns as itself, now and then altered
		const kind = M.drone > 0.5 ? 'drone' : name === 'bridge' ? 'bridge' : M.dark > 0.5 ? 'dark' : 'bright';
		const key = name + ':' + kind;
		if (!S.progs[key] || (name !== 'chorus' && chance(0.3))) S.progs[key] = pick(PROGS[kind]).slice();
		else if (chance(0.25)) { const p = S.progs[key].slice(); p[2] = pick([1, 2, 3, 5, 6]); S.progs[key] = p; }
		S.prog = S.progs[key];
		S.phraseType = pick(name === 'chorus' ? ['aaba', 'seq', 'abac'] : name === 'bridge' ? ['call', 'seq'] : ['aaba', 'call', 'abac', 'call']);
		S.history.push({ name, bars, at: S.abs });
		if (S.history.length > 40) S.history.shift();
		S.fresh = true;
	}

	// a one-bar motif: onsets on a sixteenth grid, a contour in scale steps
	function makeMotif(density, energy) {
		const on = [];
		for (let s = 0; s < 16; s += 2) {
			const strong = s % 4 === 0;
			if (chance(clamp(density * (strong ? 0.85 : 0.5), 0.05, 0.95))) on.push(s);
			if (energy > 0.6 && !strong && chance(density * 0.18)) on.push(s + 1);
		}
		if (!on.length || on[0] > 4) on.unshift(pick([0, 0, 2]));
		on.sort((a, b) => a - b);
		while (on.length > 7) on.splice(1 + Math.floor(R() * (on.length - 1)), 1);
		if (on.length < 2) on.push(on[0] + pick([4, 6, 8]));
		const cont = [0];
		let dir = chance(0.6) ? 1 : -1;
		for (let i = 1; i < on.length; i++) {
			const r = R();
			let step = r < 0.68 ? 1 : r < 0.86 ? 2 : pick([3, 4]);
			if (i > on.length / 2 && chance(0.5)) dir = -dir;
			// after a leap, step back the other way
			if (Math.abs(cont[i - 1] - (cont[i - 2] ?? 0)) >= 3) { dir = -Math.sign(cont[i - 1] - cont[i - 2]); step = 1; }
			if (chance(0.12)) step = 0;
			cont.push(cont[i - 1] + dir * step);
		}
		return on.map((s, i) => ({ s, c: cont[i], dur: Math.max(1, Math.min(8, (on[i + 1] ?? 16) - s)) }));
	}
	// development: what a phrase does with its motif, bar by bar
	const OPS = {
		same: (m) => m.map((n) => ({ ...n })),
		invert: (m) => m.map((n) => ({ ...n, c: -n.c })),
		retro: (m) => { const c = m.map((n) => n.c).reverse(); return m.map((n, i) => ({ ...n, c: c[i] })); },
		displace: (m) => m.map((n) => ({ ...n, s: (n.s + 2) % 16 })).sort((a, b) => a.s - b.s),
		fragment: (m) => m.filter((n) => n.s < 8).map((n) => ({ ...n })),
		augment: (m) => m.map((n) => ({ ...n, s: n.s * 2, dur: n.dur * 2 })).filter((n) => n.s < 16),
		ornament: (m) => {
			const out = m.map((n) => ({ ...n }));
			const i = Math.floor(R() * out.length), n = out[i];
			if (n && n.s > 0 && !out.some((o) => o.s === n.s - 1)) out.splice(i, 0, { s: n.s - 1, c: n.c + (chance(0.5) ? 1 : -1), dur: 1, grace: true });
			return out;
		},
	};
	const develop = (m, op) => (OPS[op] || OPS.same)(m);

	// the melody for one bar: the motif placed on the chord, strong beats on chord tones
	function melodyBar(M, pcs, chord, motif, op, shift, cadence) {
		const out = [];
		let notes = develop(motif, op);
		if (cadence) {
			// a few notes of the motif, then a long note on the chord's root or third, then rest
			notes = notes.filter((n) => n.s < 8).slice(0, 3);
			const last = notes.length ? notes[notes.length - 1].s : -2;
			notes.push({ s: Math.min(12, Math.max(last + 2, 8)), c: 0, dur: 6, land: true });
		}
		const lo = M.melLo, hi = M.melHi;
		// start near the last note (voice leading), on a chord tone
		const prev = S.lastMel ?? Math.round((lo + hi) / 2);
		let anchor = nearestChordDeg(chord, prev, pcs.length);
		anchor += shift;
		for (const n of notes) {
			let d = anchor + n.c;
			if (n.land) d = nearestChordDeg([chord[0], chord[1]], S.lastMel ?? d, pcs.length);
			else if (n.s % 8 === 0) d = nearestChordDeg(chord, d, pcs.length);
			// fold into the register
			const n7 = pcs.length;
			while (d > hi) d -= n7;
			while (d < lo) d += n7;
			// a rest where the density says so (never the downbeat or the landing)
			if (!n.land && n.s !== 0 && !chance(clamp(M.density * 1.15, 0.2, 1))) continue;
			out.push({ s: n.s, d, dur: n.land ? n.dur * (1 + M.sparse) : n.dur * (1 + M.sparse * 0.8), vel: (n.s % 4 === 0 ? 1 : 0.84) * (n.grace ? 0.6 : 1) * (n.land ? 0.92 : 1) });
			S.lastMel = d;
		}
		return out;
	}
	function nearestChordDeg(chord, near, n) {
		let best = chord[0], bd = 1e9;
		for (const c of chord) for (let o = -3; o <= 3; o++) {
			const d = c + o * n, e = Math.abs(d - near);
			if (e < bd) { bd = e; best = d; }
		}
		return best;
	}

	// pads: the chord voiced near the last one (smallest total movement)
	function voicePad(pcs, chord, center) {
		const target = S.pad || chord.map((d) => semiOf(pcs, d) + center);
		const out = [];
		for (let i = 0; i < chord.length; i++) {
			const s0 = semiOf(pcs, chord[i]);
			let best = s0, bd = 1e9;
			for (let o = -3; o <= 3; o++) { const s = s0 + o * 12, e = Math.abs(s - (target[i] ?? center)); if (e < bd && s >= center - 7 && s <= center + 14) { bd = e; best = s; } }
			out.push(best);
		}
		S.pad = out.slice();
		return out;
	}

	function bassBar(M, pcs, root, nextRoot, style, cadence, sec) {
		const out = [];
		const fold = (s) => { while (s > M.bassHi) s -= 12; while (s < M.bassHi - 12) s += 12; return s; };
		const r = fold(semiOf(pcs, root)), f = fold(semiOf(pcs, chordDegs(pcs, root)[2])), t = fold(semiOf(pcs, chordDegs(pcs, root)[1]));
		const nr = fold(semiOf(pcs, nextRoot));
		let kind = M.drone > 0.5 ? 'drone' : style.bass;
		// a quiet section keeps the bass simple
		if (M.energy * SECTIONS[sec].energy < 0.18 || sec === 'breakdown') kind = kind === 'drone' ? 'drone' : 'root';
		const add = (s, semi, dur, vel = 1) => out.push({ s, semi, dur, vel });
		switch (kind) {
			case 'drone': if (S.barIn % 2 === 0) add(0, fold(semiOf(pcs, 0)), 30, 0.9); break;
			case 'root': add(0, r, 14); break;
			case 'root5': add(0, r, 6); add(8, chance(0.7) ? f : r, 6, 0.85); break;
			case 'octave': for (let s = 0; s < 16; s += 2) add(s, s % 4 === 2 ? r + 12 : r, 1.6, s % 4 === 0 ? 1 : 0.8); break;
			case 'sub': add(0, r, 9); add(10, chance(0.5) ? r : f, 5, 0.85); break;
			case 'offbeat': for (const s of [2, 6, 10, 14]) add(s, r, 1.8, 0.9); if (chance(0.5)) add(0, r, 1.5, 0.7); break;
			case 'eight08': add(0, r, 10); add(11, chance(0.5) ? r : f, 4, 0.8); break;
			case 'riddim': add(0, r, 2.5); add(3, r, 2, 0.8); add(6, f, 2, 0.8); add(8, r, 2.5); add(11, t, 2, 0.75); add(14, f, 2, 0.8); break;
			case 'walk': {
				const approach = nr + (nr > r ? -1 : 1);
				add(0, r, 3.6); add(4, t, 3.6, 0.8); add(8, f, 3.6, 0.85); add(12, chance(0.6) ? approach : t, 3.6, 0.8);
				break;
			}
			default: add(0, r, 14);
		}
		// the phrase's last bar leads into the next chord
		if (cadence && kind !== 'drone' && kind !== 'walk' && nr !== r && !out.some((n) => n.s >= 14)) add(14, nr + (nr > r ? -1 : 1), 2, 0.7);
		return out;
	}

	const ARPS = { up: [0, 1, 2, 3], updown: [0, 1, 2, 3, 2, 1], broken: [0, 2, 1, 3], down: [3, 2, 1, 0] };
	function arpBar(M, pcs, chord, style) {
		const out = [], seq = ARPS[M.dream > 0.3 ? 'updown' : style.arp] || ARPS.up;
		const rate = M.energy > 0.62 && M.sparse < 0.4 ? 1 : M.sparse > 0.55 ? 4 : 2;
		const tones = [...chord, chord[0] + pcs.length];
		const base = S.arpBase ?? 0;
		for (let s = 0, i = base; s < 16; s += rate, i++) {
			if (M.sparse > 0.5 && chance(0.3)) continue;
			let d = tones[seq[i % seq.length] % tones.length];
			while (d < M.arpLo) d += pcs.length;
			while (d > M.arpLo + pcs.length + 2) d -= pcs.length;
			out.push({ s, d, dur: rate * (M.sparse > 0.5 ? 2.5 : 0.9), vel: s % 4 === 0 ? 0.9 : 0.7 });
		}
		S.arpBase = base + 16 / rate;
		return out;
	}

	// the drums: the faceplate's pattern as the core, thinned or filled by energy
	function drumBar(M, beat, sec, e, lastOfPhrase, lastOfSection) {
		const out = [];
		if (!beat || M.drums <= 0.02) return out;
		const hit = (s, name, vel) => out.push({ s, name, vel });
		const row = (k) => beat[k] || null;
		const tier = e < 0.2 ? 0 : e < 0.4 ? 1 : e < 0.66 ? 2 : 3;
		const half = M.half > 0.5;
		if (sec === 'build') {
			// a snare roll that tightens over the build: quarters, eighths, sixteenths
			const k = S.secBars <= 1 ? 1 : S.barIn / (S.secBars - 1);
			const every = k < 0.34 ? 4 : k < 0.67 ? 2 : 1;
			for (let s = 0; s < 16; s += every) hit(s, 'snare', 0.35 + 0.5 * (k * 0.7 + s / 16 * 0.3));
			hit(0, 'kick', 0.8);
			if (k > 0.5) for (const s of [4, 8, 12]) hit(s, 'kick', 0.6);
			return out;
		}
		if (tier === 0) {
			if (S.barIn % 2 === 0) hit(0, 'kick', 0.5);
			if (row('shaker') || row('hihat')) for (const s of [4, 12]) hit(s, row('shaker') ? 'shaker' : 'hihat', 0.3);
			return out;
		}
		const kick = row('kick') || [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
		const snare = row('snare') || row('clap') || [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
		const hat = row('hihat') || row('shaker');
		for (let s = 0; s < 16; s++) {
			if (kick[s]) {
				if (tier >= 2 || s % 8 === 0) hit(s, 'kick', s === 0 ? 1 : 0.85);
			}
			if (snare[s]) {
				if (half) { if (s === 8 || (tier === 3 && s === 12 && chance(0.2))) hit(s, beat.snare ? 'snare' : 'clap', 0.9); }
				else if (tier >= 2) hit(s, beat.snare ? 'snare' : 'clap', 0.9);
				else if (s === 12) hit(s, 'rim', 0.7);
			}
			if (hat && hat[s]) {
				const every = tier === 1 ? 4 : tier === 2 ? 2 : 1;
				if (s % every === 0) hit(s, row('hihat') ? 'hihat' : 'shaker', (s % 4 === 0 ? 0.75 : 0.5) * (0.9 + R() * 0.2));
			}
		}
		// the faceplate's other rows join when it is lively
		if (tier === 3) for (const k of ['clap', 'cowbell', 'rim', 'shaker', 'perc', 'openhat', 'ride', 'hitom', 'lotom']) {
			const r = row(k);
			if (!r || (k === 'clap' && !beat.snare)) continue;
			for (let s = 0; s < 16; s++) if (r[s] && chance(0.75)) hit(s, k, 0.55);
		}
		// variation: a kick moves or is added, a ghost note, an open hat
		if (tier >= 2 && chance(0.3)) hit(pick([3, 7, 10, 11, 14]), 'kick', 0.6);
		if (tier === 3 && e > 0.8 && chance(0.5)) for (const s of [7, 15]) if (chance(0.5)) hit(s, 'snare', 0.28);
		if (tier >= 2 && chance(0.25)) hit(14, 'openhat', 0.5);
		if (M.climax && S.barIn % 2 === 0) hit(0, 'cymbal', 0.8);
		// fills at the end of a phrase: a snare run, a tom run or a flam
		if (lastOfPhrase && tier >= 2) {
			for (let i = out.length - 1; i >= 0; i--) if (out[i].s >= 12 && out[i].name !== 'kick') out.splice(i, 1);
			const f = pick(lastOfSection ? ['toms', 'snare', 'toms'] : ['snare', 'toms', 'flam', 'none']);
			if (f === 'snare') for (let s = 12; s < 16; s++) hit(s, 'snare', 0.45 + (s - 12) * 0.13);
			if (f === 'toms') for (const [s, n] of [[12, 'hitom'], [13, 'hitom'], [14, 'lotom'], [15, 'lotom']]) hit(s, n, 0.7);
			if (f === 'flam') { hit(14, 'snare', 0.5); hit(15, 'snare', 0.8); }
		}
		if (S.fresh && tier >= 2 && sec !== 'breakdown') hit(0, 'cymbal', 0.7);
		return out;
	}

	// one bar: M is the mood (see context.js), pcs the scale's pitch set, face the style,
	// beat the faceplate's selected drum pattern (or null)
	function bar(mood, pcs, face, beat) {
		const style = STYLES[face] || STYLES.BARD;
		// registers arrive in semitones; the parts think in degrees of this scale
		const M = { ...mood, melLo: degNear(pcs, mood.melLoS), melHi: degNear(pcs, mood.melHiS), cLo: degNear(pcs, mood.cLoS), arpLo: degNear(pcs, mood.arpLoS) };
		// a queued change lands on a phrase boundary (at once if urgent)
		const phraseEnd = S.barIn > 0 && S.barIn % 4 === 0;
		if (!S.section) enter(M.climax ? 'build' : 'intro', M);
		else if (S.queued && (S.queued.urgent || phraseEnd)) { const q = S.queued.to; S.queued = null; enter(q, M); }
		else if (S.barIn >= S.secBars) enter(weightedNext(S.section, M), M);
		const sec = S.section, SP = SECTIONS[sec];
		const barIn = S.barIn, inPhrase = barIn % 4, lastOfPhrase = inPhrase === 3, lastOfSection = barIn === S.secBars - 1;
		// harmony: one chord a bar, or one every two bars when the air is wide
		const hr = M.slowHarmony ? 2 : 1;
		const prog = S.prog;
		const ci = Math.floor(barIn / hr) % prog.length;
		const root = prog[ci], nextRoot = prog[(Math.floor((barIn + 1) / hr)) % prog.length];
		const chord = chordDegs(pcs, root, style.seventh && M.energy > 0.3);
		// dynamics: the arc rises slower than it falls; a build is a crescendo
		const target = sec === 'build' ? 0.5 + 0.45 * (barIn + 1) / S.secBars : ARC[sec];
		const want = clamp(target * (0.7 + 0.45 * M.energy) + (M.climax ? 0.15 : 0), 0.15, 1);
		S.arc += clamp(want - S.arc, -0.12, 0.06);
		// the phrase's own small arch, and the last bar before a breakdown falling away
		const phraseK = 0.92 + 0.08 * Math.sin(Math.PI * (inPhrase + 0.5) / 4);
		const fall = lastOfSection && S.queued?.to === 'breakdown' ? 0.8 : 1;
		const dyn = S.arc * phraseK * fall;
		const e = clamp(SP.energy * 0.55 + M.energy * 0.55, 0, 1) * M.drums;
		const ev = [];
		const P = SP.parts;
		// the melody, developed through the phrase
		if (!S.themes[sec] || S.fresh) {
			const old = S.themes[sec];
			S.themes[sec] = old && chance(0.7) ? develop(old, pick(['same', 'ornament', 'displace', 'same'])) : makeMotif(M.density, M.energy);
		}
		const motif = S.themes[sec];
		let melOn = chance(P.mel * (M.sparse > 0.6 ? 0.6 : 1)) || (P.mel >= 1 && inPhrase === 0);
		let op = 'same', shift = 0, answer = false;
		const T = S.phraseType;
		if (T === 'aaba') { op = ['same', 'ornament', pick(['invert', 'retro', 'displace']), 'same'][inPhrase]; }
		else if (T === 'seq') { op = inPhrase === 2 ? 'fragment' : 'same'; shift = [0, 1, 2, 0][inPhrase]; }
		else if (T === 'abac') { op = ['same', pick(['invert', 'augment']), 'same', pick(['retro', 'fragment'])][inPhrase]; }
		else if (T === 'call') { answer = inPhrase % 2 === 1; op = inPhrase === 2 ? pick(['same', 'displace']) : 'same'; shift = inPhrase === 2 ? 1 : 0; }
		if (answer) melOn = false;
		if (melOn) for (const n of melodyBar(M, pcs, chord, motif, op, shift, lastOfPhrase)) ev.push({ role: 'mel', s: n.s, semi: semiOf(pcs, n.d), dur: n.dur, vel: n.vel * 0.62 * dyn });
		// the answer: the counter voice in the melody's rest, the motif turned about, or the
		// player's own last notes quoted back
		const counterOn = chance(P.counter);
		if (answer && counterOn) {
			const riff = S.userRiff.length >= 3 && chance(0.6) ? S.userRiff.slice(-5) : null;
			if (riff) {
				const base = riff[0].d;
				riff.forEach((n, i) => {
					const d = clamp(M.cLo + 2 + (n.d - base), M.cLo, M.cLo + pcs.length * 2);
					ev.push({ role: 'counter', s: i * 2 + 2, semi: semiOf(pcs, d), dur: 2, vel: 0.5 * dyn, quote: true });
				});
				S.userRiff = [];
			} else {
				const resp = develop(motif, pick(['invert', 'retro', 'fragment']));
				const d0 = nearestChordDeg(chord, M.cLo + 3, pcs.length);
				for (const n of resp) {
					let d = d0 + n.c;
					while (d < M.cLo) d += pcs.length;
					while (d > M.cLo + pcs.length * 2) d -= pcs.length;
					ev.push({ role: 'counter', s: n.s, semi: semiOf(pcs, d), dur: n.dur, vel: 0.5 * dyn });
				}
			}
		} else if (counterOn && !answer) {
			// otherwise a guide tone: the chord's third, held; in a chorus a line in thirds
			if (sec === 'chorus' && melOn && chance(0.5)) {
				for (const n of ev.filter((x) => x.role === 'mel' && x.s % 4 === 0)) {
					const d = degNear(pcs, n.semi) - 2;
					ev.push({ role: 'counter', s: n.s, semi: semiOf(pcs, d), dur: n.dur, vel: n.vel * 0.55 });
				}
			} else if (inPhrase % 2 === 0) {
				let d = chord[1]; while (d < M.cLo) d += pcs.length;
				ev.push({ role: 'counter', s: 0, semi: semiOf(pcs, d), dur: 30, vel: 0.36 * dyn });
			}
		}
		// the arpeggio
		if (chance(P.arp * (0.5 + M.arp))) for (const n of arpBar(M, pcs, chord, style)) ev.push({ role: 'arp', s: n.s, semi: semiOf(pcs, n.d), dur: n.dur, vel: n.vel * 0.38 * dyn });
		// pads
		if (chance(P.pad)) {
			const voices = voicePad(pcs, chord, M.padCenter);
			// a toxic world rubs a semitone against the chord
			if (M.dissonance > 0.4 && chance(M.dissonance)) voices.push(voices[0] + 1);
			const kind = M.energy < 0.3 || M.sparse > 0.5 ? 'hold' : style.pad;
			const onsets = kind === 'stab' ? [2, 6, 10, 14].filter(() => chance(0.8)) : kind === 'skank' ? [4, 12] : (barIn % hr === 0 ? [0] : []);
			const dur = kind === 'hold' ? 16 * hr - 0.5 : 1.4;
			for (const s of onsets) voices.forEach((semi, i) => ev.push({ role: 'pad', s, semi, dur, vel: (i === 0 ? 0.42 : 0.34) * dyn * (kind === 'hold' ? 1 : 0.9) }));
		}
		// bass
		if (chance(P.bass) || (P.bass >= 0.5 && barIn % 2 === 0)) for (const n of bassBar(M, pcs, root, nextRoot, style, lastOfPhrase, sec)) ev.push({ role: 'bass', s: n.s, semi: n.semi, dur: n.dur, vel: n.vel * 0.6 * dyn });
		// tension: a low pedal pulse under everything (a rumbling volcano, a storm)
		if (M.tension > 0.35) for (let s = 0; s < 16; s += M.tension > 0.7 ? 2 : 4) ev.push({ role: 'bass', s, semi: M.bassHi - 12 + semiOf(pcs, 0) % 12, dur: 1.2, vel: (0.3 + 0.4 * M.tension) * (0.6 + s / 40) });
		const drums = drumBar(M, beat, sec, e * (P.drums >= 1 ? 1 : 0.5 + P.drums * 0.5), lastOfPhrase, lastOfSection).map((d) => ({ ...d, vel: d.vel * (0.45 + 0.5 * dyn) * M.drums }));
		const info = { section: sec, bar: barIn, of: S.secBars, abs: S.abs, chord: root, chordDegs: chord, arc: +S.arc.toFixed(3), phrase: T, fresh: S.fresh };
		S.fresh = false;
		S.barIn++; S.abs++;
		S.lastChordRoot = root;
		return { events: ev, drums, info };
	}

	return {
		bar,
		// ask for a section at the next phrase (or at once, urgent)
		queue(to, urgent) { if (SECTIONS[to] && S.section !== to) S.queued = { to, urgent: !!urgent }; },
		// the player's notes (scale degrees), for the answer to quote
		heard(d) { S.userRiff.push({ d, t: performance.now() }); if (S.userRiff.length > 12) S.userRiff.shift(); },
		state: S,
	};
}
