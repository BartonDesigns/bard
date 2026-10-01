// The sound of a place, from its kit (sound: day and night beds): the wind off the ice and
// the sled dogs singing together in the north, the ice groaning; bells on the yaks and the
// cows, a stream; the market's murmur and the clink of tea glasses; cicadas in the olive
// groves; insects like saws in the rainforest, its birds by day and its frogs by night; the
// surf on an island; a temple bell at dusk; a church bell telling the hour in a village;
// and, where people pray five times a day, the call to prayer drifting gently from the
// nearest minaret at the hours of prayer, far off, soft, never loud.
//
// Everything is made here (noise and oscillators, a few short buffers), plays through the
// world's ambience (audio/acoustics.js) and its one gate, the World sounds slider, and falls
// away when you fly up or go indoors.

import { mix } from '../audio/acoustics.js';
import { noise } from '../world/soundbus.js';

const MAXV = 5;
const rnd = (a) => (Math.random() * 2 - 1) * a;
// the hours of prayer, roughly by the sun (dawn, midday, afternoon, sunset, night)
const PRAYER = [5.1, 12.6, 15.8, 18.6, 20.1];

// a short loop: crickets, frogs (made once per context)
function loopBuffer(ctx, kind) {
	const sr = 22050, len = sr * (kind === 'frogs' ? 5 : 2), d = new Float32Array(len);
	if (kind === 'crickets') {
		for (let c = 0; c < 3; c++) {
			const f = 4200 + c * 500, rate = 0.3 + c * 0.17, off = c * 0.21;
			for (let t0 = off; t0 < 2; t0 += rate) for (let p = 0; p < 4; p++) { const s = Math.floor((t0 + p * 0.022) * sr); for (let i = 0; i < sr * 0.014 && s + i < len; i++) d[s + i] += Math.sin(2 * Math.PI * f * i / sr) * Math.sin(Math.PI * i / (sr * 0.014)) * 0.25; }
		}
	} else if (kind === 'frogs') {
		for (let k = 0; k < 18; k++) {
			const t0 = Math.random() * 4.6, f = 260 + Math.random() * 380, n = 2 + Math.floor(Math.random() * 4);
			for (let p = 0; p < n; p++) { const s = Math.floor((t0 + p * 0.09) * sr); for (let i = 0; i < sr * 0.06 && s + i < len; i++) { const e = Math.sin(Math.PI * i / (sr * 0.06)); d[s + i] += (Math.sin(2 * Math.PI * f * i / sr) + 0.5 * Math.sin(2 * Math.PI * f * 2.02 * i / sr)) * e * e * 0.2; } }
		}
	}
	const B = ctx.createBuffer(1, len, sr);
	B.getChannelData(0).set(d);
	return B;
}

export function createRegionalSound() {
	const beds = {}, T = {}, D = { beds: {}, events: {} };
	let voices = 0, call = null, lastHour = null, lastStrike = -1;
	const bufs = new WeakMap();
	const buf = (A, k) => { let m = bufs.get(A.ctx); if (!m) bufs.set(A.ctx, m = {}); return m[k] || (m[k] = loopBuffer(A.ctx, k)); };

	// ---------- beds ----------
	// a loop from noise or a buffer through a filter, at a level that eases (and an amplitude wobble)
	function bed(A, name, level, dt, make) {
		let b = beds[name];
		if (!b && level > 1e-4) b = beds[name] = make(A);
		if (!b) return;
		const t = A.ctx.currentTime;
		b.g.gain.setTargetAtTime(level, t, 1.2);
		D.beds[name] = Math.round(level * 1000) / 1000;
		if (level < 1e-4) { b.idle = (b.idle || 0) + dt; if (b.idle > 6) { try { b.s.stop(); b.lfo?.stop(); } catch { /* stopped */ } b.g.disconnect(); delete beds[name]; delete D.beds[name]; } } else b.idle = 0;
	}
	const noiseBed = (colour, type, f, q, am = 0, amDepth = 0) => (A) => {
		const ctx = A.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), m = ctx.createGain();
		s.buffer = noise(ctx, colour); s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; m.gain.value = 1 - amDepth;
		s.connect(fl).connect(m).connect(g).connect(A.amb);
		const sg = ctx.createGain(); sg.gain.value = 0.25; g.connect(sg).connect(A.send);
		let lfo = null;
		if (am) { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = am; lg.gain.value = amDepth; lfo.connect(lg).connect(m.gain); lfo.start(); }
		s.start(0, Math.random() * 3);
		return { s, g, lfo, f: fl };
	};
	const bufBed = (get, lp = 0) => (A) => {
		const b = get(A);
		if (!b) return null;
		const ctx = A.ctx, s = ctx.createBufferSource(), g = ctx.createGain();
		s.buffer = b; s.loop = true; g.gain.value = 0;
		let head = s;
		if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; s.connect(f); head = f; }
		head.connect(g).connect(A.amb);
		s.start(0, Math.random() * b.duration);
		return { s, g };
	};
	const BEDS = {
		wind: [noiseBed('pink', 'bandpass', 520, 0.6, 0.11, 0.6), 0.05],
		flags: [noiseBed('white', 'bandpass', 1400, 1.2, 7, 0.7), 0.012],
		stream: [noiseBed('white', 'lowpass', 1400, 0.4, 0.3, 0.2), 0.03],
		river: [noiseBed('pink', 'lowpass', 700, 0.5, 0.15, 0.3), 0.04],
		surf: [noiseBed('brown', 'lowpass', 600, 0.5, 0.11, 0.8), 0.09],
		insects: [noiseBed('white', 'bandpass', 4600, 6, 31, 0.8), 0.012],
		insectsjungle: [noiseBed('white', 'bandpass', 5200, 5, 43, 0.9), 0.022],
		insectsnight: [bufBed((A) => buf(A, 'crickets')), 0.05],
		crickets: [bufBed((A) => buf(A, 'crickets')), 0.04],
		cicadas: [noiseBed('white', 'bandpass', 6000, 4, 63, 0.85), 0.018],
		frogs: [bufBed((A) => buf(A, 'frogs')), 0.06],
		market: [bufBed((A) => A.B.get('babbleFar'), 2600), 0.07],
		citybed: [noiseBed('brown', 'lowpass', 260, 0.5, 0.05, 0.3), 0.06],
		ice: [noiseBed('brown', 'lowpass', 180, 0.7, 0.07, 0.6), 0.03],
	};

	// ---------- one-shots ----------
	function out(A, gain, pan, send = 0.5, lp = 0) {
		const ctx = A.ctx, g = ctx.createGain(), p = ctx.createStereoPanner();
		g.gain.value = gain; p.pan.value = Math.max(-1, Math.min(1, pan));
		let head = g;
		if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.connect(g); head = f; }
		g.connect(p).connect(A.amb);
		const s = ctx.createGain(); s.gain.value = send; p.connect(s).connect(A.send);
		return head;
	}
	// a struck thing (a bell): partials [ratio, level, decay s]
	function strike(A, f, partials, gain, pan, kind, send = 0.6, lp = 0) {
		if (voices >= MAXV) return;
		const ctx = A.ctx, t = ctx.currentTime, dest = out(A, gain, pan, send, lp);
		let first = true;
		for (const [m, lv, dec] of partials) {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.frequency.value = f * m;
			g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
			o.connect(g).connect(dest); o.start(t); o.stop(t + dec + 0.05);
			if (first) { voices++; o.onended = () => { voices--; }; first = false; }
		}
		D.events[kind] = (D.events[kind] || 0) + 1;
	}
	// a voice or a call: a tone along a pitch path [[at s, Hz]...], shaped by formants
	function sing(A, path, gain, pan, { type = 'sawtooth', formants = [[700, 6], [1150, 8], [2500, 10]], vib = 5, depth = 0.012, lp = 2200, send = 0.9, kind = 'call', attack = 0.25 } = {}) {
		if (voices >= MAXV) return 0;
		const ctx = A.ctx, t = ctx.currentTime, o = ctx.createOscillator(), env = ctx.createGain(), dest = out(A, gain, pan, send, lp);
		o.type = type;
		const dur = path[path.length - 1][0];
		o.frequency.setValueAtTime(path[0][1], t);
		for (const [at, f] of path.slice(1)) o.frequency.linearRampToValueAtTime(f, t + at);
		const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = vib; vg.gain.value = path[0][1] * depth; v.connect(vg).connect(o.frequency);
		env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + attack); env.gain.setValueAtTime(1, t + dur - 0.6); env.gain.linearRampToValueAtTime(0, t + dur);
		o.connect(env);
		for (const [f, q] of formants) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; env.connect(b).connect(dest); }
		o.start(t); v.start(t); o.stop(t + dur + 0.05); v.stop(t + dur + 0.05);
		voices++; o.onended = () => { voices--; };
		D.events[kind] = (D.events[kind] || 0) + 1;
		return dur;
	}
	const every = (k, dt, mean) => { T[k] = (T[k] ?? Math.random() * mean) - dt; if (T[k] <= 0) { T[k] = mean * (0.5 + Math.random()); return true; } return false; };
	const BELL = [[1, 1, 3], [2.76, 0.4, 1.6], [5.4, 0.25, 0.8], [8.9, 0.12, 0.4]];

	// the call to prayer: phrases of a single distant voice, long notes and slow ornaments in a
	// maqam's colour, from the minaret's direction, with pauses between; only at the hours
	function startCall(A, pan, dist) {
		const root = 196 + Math.random() * 20, s = [0, 1, 4, 5, 7, 8, 10, 12].map((x) => root * Math.pow(2, x / 12));
		const phrases = [[[0, s[4]], [1.2, s[4]], [2.2, s[5]], [3.4, s[4]], [4.6, s[3]], [6.2, s[4]], [7.4, s[4]]], [[0, s[5]], [1.5, s[6]], [2.8, s[5]], [4.2, s[4]], [5.8, s[3]], [7.2, s[2]], [8.4, s[3]]], [[0, s[3]], [1.4, s[4]], [2.9, s[4]], [4.3, s[3]], [5.6, s[2]], [7.6, s[3]]]];
		call = { A, pan, gain: 0.03 / (1 + (dist / 900) ** 2), n: 0, wait: 0, phrases };
	}
	function stepCall(dt) {
		if (!call) return;
		call.wait -= dt;
		if (call.wait > 0) return;
		if (call.n >= 7) { call = null; return; }
		const P = call.phrases[call.n % call.phrases.length];
		const dur = sing(call.A, P, call.gain, call.pan, { type: 'sawtooth', formants: [[650, 5], [1080, 7], [2450, 9]], vib: 5.2, depth: 0.01, lp: 1900, send: 1, kind: 'call', attack: 0.4 });
		call.n++;
		call.wait = (dur || 6) + 3 + Math.random() * 2;
	}

	// h: here.js; o: { cam, night, hours, indoor, alt, rain, near: the nearest site { kind, d }, church: d (m) or null }
	function update(dt, h, o) {
		const A = mix();
		if (!A) return D;
		const on = !!h?.on && !!h.kit;
		const hush = on ? Math.max(0, 1 - Math.max(0, (o.alt || 0) - 30) / 120) * (o.indoor ? 0.35 : 1) : 0;
		const night = o.night || 0, want = new Set([...(h?.kit?.sound?.day || []).map((k) => [k, 1 - night]), ...(h?.kit?.sound?.night || []).map((k) => [k, night])].filter(([, w]) => w > 0.05).map(([k]) => k));
		const lvl = (k) => { const d = (h?.kit?.sound?.day || []).includes(k) ? 1 - night : 0, n = (h?.kit?.sound?.night || []).includes(k) ? night : 0; return Math.max(d, n); };
		const inTown = h?.town && h.town.km < 0.6 ? 1 : 0.35;
		for (const [k, [make, base]] of Object.entries(BEDS)) {
			let L = want.has(k) ? base * lvl(k) * hush : 0;
			if (k === 'market' || k === 'citybed') L *= inTown;
			if (k === 'wind') L *= 0.6 + (o.wind || 0.5) * 0.8;
			if ((o.rain || 0) > 0.3 && /insects|cicadas|crickets/.test(k)) L *= 0.3;
			bed(A, k, L, dt, make);
		}
		if (!on || hush < 0.05) { stepCall(dt); return D; }
		const has = (k) => want.has(k);
		// the north: dogs singing together, far off; the ice
		if (has('dogs') && every('dogs', dt, 70)) { const f = 520 + Math.random() * 120, p = rnd(0.9); for (let i = 0; i < 3; i++) sing(A, [[0, f * (1 + i * 0.07)], [0.6, f * 1.25 * (1 + i * 0.05)], [2.4 + i * 0.3, f * 0.9]], 0.006 * hush, p + rnd(0.1), { type: 'triangle', formants: [[800, 3], [1300, 4]], vib: 6, depth: 0.02, lp: 1800, kind: 'dogs', attack: 0.3 }); }
		if (has('ice') && every('icecrack', dt, 25)) strike(A, 70 + Math.random() * 40, [[1, 1, 1.6], [1.5, 0.6, 0.9], [3.1, 0.3, 0.3]], 0.03 * hush, rnd(1), 'ice', 0.9, 900);
		// bells: on the herds (yaks, sheep, llamas, cattle), and a cow's deeper one in the Alps
		if (has('bells') && every('bells', dt, 6)) strike(A, 1200 + Math.random() * 900, [[1, 1, 0.5], [2.4, 0.5, 0.3], [4.1, 0.3, 0.2]], 0.008 * hush, rnd(0.9), 'bells', 0.5);
		if (has('cowbells') && every('cowbells', dt, 4)) strike(A, 520 + Math.random() * 300, [[1, 1, 0.7], [1.83, 0.6, 0.5], [2.9, 0.35, 0.3]], 0.01 * hush, rnd(0.9), 'cowbells', 0.5);
		if ((has('cattle') || has('sheep') || has('goats') || has('horses')) && every('herd', dt, 9)) strike(A, 700 + Math.random() * 500, [[1, 1, 0.45], [2.2, 0.4, 0.25]], 0.006 * hush, rnd(0.9), 'herd', 0.5);
		// the wood being split
		if (has('chop') && every('chop', dt, 14)) strike(A, 160, [[1, 1, 0.12], [2.7, 0.6, 0.06], [6.1, 0.4, 0.04]], 0.02 * hush, rnd(0.7), 'chop', 0.7);
		// birds
		const bird = (k, f0, f1, n, gap, g) => { if (has(k) && every(k, dt, gap)) { let at = 0; const path = []; for (let i = 0; i < n; i++) { path.push([at, f0 + Math.random() * (f1 - f0)]); at += 0.08 + Math.random() * 0.1; } path.push([at + 0.1, f0]); sing(A, path, g * hush, rnd(0.9), { type: 'sine', formants: [[f0 * 1.1, 1]], vib: 0, depth: 0, lp: 0, send: 0.4, kind: k, attack: 0.02 }); } };
		bird('birds', 2800, 5200, 4, 7, 0.012); bird('birdscold', 3200, 4200, 2, 11, 0.012); bird('birdsjungle', 1400, 3600, 6, 5, 0.014); bird('birdsdry', 380, 520, 3, 12, 0.02); bird('nightbirds', 1600, 2600, 3, 15, 0.01);
		if (has('owl') && every('owl', dt, 30)) sing(A, [[0, 380], [0.3, 360], [0.6, 380], [1.1, 340]], 0.012 * hush, rnd(0.9), { type: 'sine', formants: [[400, 1]], vib: 0, lp: 900, kind: 'owl', attack: 0.05 });
		if (has('clinks') && every('clinks', dt, 4)) { const c = A.B.get('clink' + Math.floor(Math.random() * 4)); if (c && voices < MAXV) { const s = A.ctx.createBufferSource(); s.buffer = c; s.connect(out(A, 0.04 * hush, rnd(0.8), 0.5)); voices++; s.onended = () => { voices--; }; s.start(); D.events.clinks = (D.events.clinks || 0) + 1; } }
		// a temple bell at dawn and dusk, far off
		if (has('templebell') && ((o.hours > 5.5 && o.hours < 7) || (o.hours > 17.5 && o.hours < 19)) && every('templebell', dt, 45)) strike(A, 98 + Math.random() * 10, BELL.map(([m, l, d]) => [m, l, d * 3]), 0.03 * hush, rnd(0.6), 'templebell', 1, 1600);
		// the church bell tells the hour in the villages (from eight in the morning to eight at night)
		const hour = Math.floor(o.hours || 0);
		if (o.church != null && o.church < 1500 && hour >= 8 && hour <= 20 && hour !== lastHour && (o.hours % 1) < 0.05) {
			lastHour = hour;
			const n = hour > 12 ? hour - 12 : hour, g = 0.03 * hush / (1 + (o.church / 400) ** 2);
			for (let i = 0; i < n; i++) setTimeout(() => strike(A, 440, BELL, g, 0, 'churchbell', 0.9, 2800), i * 1800);
		}
		// the call to prayer, at the hours, from the nearest minaret
		if (h.minaret && h.culture?.faith === 'mosque') {
			const now = o.hours || 0, idx = PRAYER.findIndex((p) => now >= p && now < p + 0.08);
			if (idx >= 0 && idx !== lastStrike && !call) {
				lastStrike = idx;
				const dx = h.minaret[0] - o.cam.position.x, dz = h.minaret[2] - o.cam.position.z, e = o.cam.matrixWorld.elements;
				const side = Math.max(-1, Math.min(1, (e[0] * dx + e[2] * dz) / (Math.hypot(e[0], e[2]) || 1) / (Math.hypot(dx, dz) || 1)));
				startCall(A, side * 0.6, Math.hypot(dx, dz));
				o.onCall?.();
			}
			if (idx < 0) lastStrike = -1;
		}
		stepCall(dt);
		return D;
	}
	return { update, debug: () => D, callNow: (cam, h) => { const A = mix(); if (A && h?.minaret) { const d = Math.hypot(h.minaret[0] - cam.position.x, h.minaret[2] - cam.position.z); startCall(A, 0, d); } } };
}
