// Auto music for Crysis: the flight's generative background score, brought to the ground.
// It plays on the Bard's own instruments (window.playLead / playDrum: the three leads,
// the selected sound presets, the drum kit) in the faceplate's key and scale, at its BPM
// and swing, from its selected beat; score.js writes it bar by bar and context.js says
// how the game should colour it. Everything goes through the faceplate's master, so its
// volume, limiter and recorder own the mix, and the island's visuals hear it as they hear
// any other playing. With no faceplate (the dev page) a small synth of its own stands in.

import { createComposer, pitchSet } from './score.js';
import { sense, adapt } from './context.js';
import { soundBus, noise } from '../world/soundbus.js';

const KEY = 'crysis-automusic';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// which faceplate lead plays each part: the melody on Lead 1, harmony and bass on Lead 2,
// the answer and the arpeggio on Lead 3
const LEAD = { mel: 1, pad: 2, bass: 2, counter: 3, arp: 3 };
const CAP = { mel: 2, pad: 5, bass: 2, counter: 2, arp: 3 };
// the kits hit far harder than a lead note at the same velocity: a balance per drum
// (kept well under the leads: the drums sit behind the music, as in the caves)
const KIT = { kick: 0.32, snare: 0.3, clap: 0.3, hitom: 0.35, lotom: 0.35, cymbal: 0.22, openhat: 0.4, ride: 0.45, hihat: 0.6, shaker: 0.65, rim: 0.55, cowbell: 0.35, perc: 0.45 };
const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/><path d="M3 9.5c1.2-1 2.2-1 3.4 0M2 6.5c2-1.7 3.8-1.7 5.6 0" opacity=".7"/></svg>';

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: not kept */ } }

// the faceplate's live settings, or a plain stand-in
function faceplate() {
	const st = window.autoSynth?.state?.();
	if (st) return st;
	const h = window.L99Continuity?.harmony?.();
	if (h) return { face: h.face, scale: h.name, scaleId: '', intervals: h.scale, root: h.root, octave: h.octave, bpm: h.bpm, faceBpm: h.bpm, swing: 0, beat: null, beatLoopOn: false, sequencerRunning: false, leads: [], trims: [] };
	return { face: 'BARD', scale: 'VILLAGE', scaleId: 'MAJOR', intervals: [0, 2, 4, 5, 7, 9, 11, 12], root: 0, octave: 0, bpm: 100, faceBpm: 100, swing: 0.08, beat: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] }, beatLoopOn: false, sequencerRunning: false, leads: [], trims: [], own: true };
}
const hasBard = () => typeof window.playLead === 'function' && typeof window.stopLead === 'function';

export function createAutoMusic(opts) {
	const saved = load();
	const S = {
		on: !!saved.on, level: Number.isFinite(saved.level) ? clamp(saved.level, 0, 1) : 0.7, log: false,
		playing: false, bpm: 0, stepMs: 125, barAt: 0, step: 16, bar: null, serial: 0, mood: null, game: null, face: null,
		pcs: null, safety: 1, skipped: 0, manualUntil: 0, manualDrumUntil: 0, lastKey: '', counts: [], info: null, sections: [],
	};
	const composer = createComposer((Math.random() * 1e9) >>> 0);
	const live = new Map();          // voice id -> { role, timer }
	const timers = new Set();
	let loopT = 0, senseAt = 0;

	// ---- the player: their notes are heard (the answer may quote them) and the score
	// makes room while they play
	function wireListen() {
		if (!hasBard() || window.playLead.crysisAuto) return;
		const pl = window.playLead, pd = window.playDrum;
		const mine = (id) => /^(auto:|seq:|lg:|rg:|remote:|spf:)/.test(String(id)) || window._spAuto || window._seqAt != null;
		window.playLead = function (id, degree, bank, chromatic) {
			if (!mine(id)) S.userAt = performance.now();
			if (S.playing && !mine(id)) {
				S.manualUntil = performance.now() + 1800;
				if (!chromatic && bank !== 2) composer.heard(degree | 0);
			}
			return pl.apply(this, arguments);
		};
		window.playLead.crysisAuto = true;
		if (typeof pd === 'function') window.playDrum = function () {
			if (!window._spAuto) S.userAt = performance.now();
			if (S.playing && !window._spAuto && window._seqAt == null) S.manualDrumUntil = performance.now() + 1400;
			return pd.apply(this, arguments);
		};
	}

	// ---- voices
	let own = null;                  // the stand-in synth, when there is no faceplate
	function ownSynth() {
		const B = soundBus();
		if (!B) return null;
		if (own && own.ctx === B.ctx) return own;
		const g = B.ctx.createGain(); g.gain.value = 0.22; g.connect(B.out);
		own = { ctx: B.ctx, out: g };
		return own;
	}
	function ownNote(role, semi, durMs, vel) {
		const O = ownSynth();
		if (!O) return;
		const c = O.ctx, t = c.currentTime, d = durMs / 1000;
		const f = 261.63 * Math.pow(2, (semi + (role === 'counter' || role === 'arp' ? 12 : 0)) / 12);
		const o = c.createOscillator(), e = c.createGain(), lp = c.createBiquadFilter();
		o.type = role === 'pad' ? 'sawtooth' : role === 'mel' ? 'triangle' : 'sine';
		o.frequency.value = f;
		lp.type = 'lowpass'; lp.frequency.value = role === 'pad' ? 1100 : 4000;
		const a = role === 'pad' ? 0.25 : 0.01, pk = vel * (role === 'pad' ? 0.18 : 0.5);
		e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(pk, t + a);
		e.gain.setTargetAtTime(0, t + Math.max(a, d), role === 'pad' ? 0.4 : 0.12);
		o.connect(lp).connect(e).connect(O.out);
		o.start(t); o.stop(t + d + 2);
	}
	function ownDrum(name, vel) {
		const O = ownSynth();
		if (!O) return;
		const c = O.ctx, t = c.currentTime, e = c.createGain();
		e.connect(O.out);
		if (name === 'kick' || name === 'hitom' || name === 'lotom') {
			const o = c.createOscillator(), f0 = name === 'kick' ? 120 : name === 'hitom' ? 220 : 150;
			o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.35, t + 0.15);
			e.gain.setValueAtTime(vel * 0.9, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
			o.connect(e); o.start(t); o.stop(t + 0.32);
			return;
		}
		const s = c.createBufferSource(); s.buffer = noise(c, 'white');
		const f = c.createBiquadFilter();
		const long = name === 'cymbal' || name === 'openhat' || name === 'ride';
		f.type = name === 'snare' || name === 'clap' || name === 'rim' ? 'bandpass' : 'highpass';
		f.frequency.value = f.type === 'bandpass' ? 1800 : 7000;
		e.gain.setValueAtTime(vel * (long ? 0.25 : 0.4), t); e.gain.exponentialRampToValueAtTime(0.001, t + (long ? 0.9 : name === 'snare' || name === 'clap' ? 0.18 : 0.06));
		s.connect(f).connect(e); s.start(t, Math.random() * 3); s.stop(t + 1);
	}

	function trims() {
		const T = S.face?.trims || [];
		return [1, 2, 3].map((n) => { const v = T[n - 1]; return typeof v === 'number' && isFinite(v) ? clamp(v, 0, 1.6) : 1; });
	}
	function stopVoice(id) {
		const v = live.get(id);
		if (!v) return;
		clearTimeout(v.timer);
		live.delete(id);
		try { window.stopLead?.(id); } catch { /* the faceplate may be gone */ }
	}
	function noteOn(role, semi, durMs, vel) {
		const duck = performance.now() < S.manualUntil ? (role === 'mel' ? 0.45 : role === 'pad' ? 0.7 : 0.55) : 1;
		let v = vel * 1.35 * S.level * S.safety * duck;
		if (v < 0.035) return;
		count(role);
		if (!hasBard()) { ownNote(role, semi, durMs, v); return; }
		// a lead the player has pulled right down hands its part to the loudest one left
		let lead = LEAD[role];
		const T = trims();
		if (T[lead - 1] < 0.06) { const m = Math.max(...T); if (m < 0.06) return; lead = T.indexOf(m) + 1; }
		v *= 0.6 + 0.4 * Math.min(1, T[lead - 1]);
		// the chromatic path: semitones over the faceplate's root and that lead's octave.
		// Lead 2 is bank 2 at or below +12; Lead 3 is bank 2 marked by +13
		let deg = Math.round(semi), bank = 1;
		if (lead === 2) { bank = 2; while (deg > 12) deg -= 12; }
		else if (lead === 3) { bank = 2; while (deg < 0) deg += 12; while (deg > 26) deg -= 12; deg += 13; }
		// each part keeps to its own few voices
		const mineN = [...live.entries()].filter(([, x]) => x.role === role);
		while (mineN.length >= CAP[role]) stopVoice(mineN.shift()[0]);
		const id = 'auto:crysis:' + role + ':' + (++S.serial);
		// (automatic: kept out of loop recordings; our own softer floor, so quiet is quiet)
		window._spAuto = true; window._autoVelFloor = 0.02;
		try { window.playLead(id, deg, bank, true, clamp(v, 0.03, 0.8)); } catch { /* a voice failed; the next will try */ } finally { window._spAuto = false; window._autoVelFloor = undefined; }
		live.set(id, { role, timer: setTimeout(() => stopVoice(id), Math.max(60, durMs)) });
	}
	function drum(name, vel) {
		if (performance.now() < S.manualDrumUntil) vel *= 0.4;
		const v = vel * (KIT[name] ?? 0.7) * S.level * S.safety;
		if (v < 0.03) return;
		count('drums');
		if (name === 'kick' && opts.shared) opts.shared.uPulse.value = Math.min(1.5, opts.shared.uPulse.value + 0.12 * v);
		if (!hasBard() || typeof window.playDrum !== 'function') { ownDrum(name, v); return; }
		const ac = window._autoComp || (window._autoComp = {});
		ac._selfDrum = true; window._spAuto = true; window._autoVelFloor = 0.04;
		try { window.playDrum(name, clamp(v, 0.04, 0.85)); } catch { /* not in this kit */ } finally { ac._selfDrum = false; window._spAuto = false; window._autoVelFloor = undefined; }
	}
	function later(fn, ms) {
		const t = setTimeout(() => { timers.delete(t); fn(); }, Math.max(0, ms));
		timers.add(t);
	}
	function silence() {
		for (const t of timers) clearTimeout(t);
		timers.clear();
		for (const id of [...live.keys()]) stopVoice(id);
	}

	// notes per part in the last minute (for the log and the tests)
	function count(role) {
		const now = performance.now();
		S.counts.push([now, role]);
		while (S.counts.length && now - S.counts[0][0] > 60000) S.counts.shift();
	}

	// ---- the game, read a couple of times a second
	function listen() {
		const W = opts.world();
		const g = sense(W, opts);
		const M = adapt(g);
		S.game = g; S.mood = M;
		// a big change asks the form for a new section
		const key = g.place + ':' + g.move + ':' + g.volcano + ':' + (g.trip > 0);
		if (key !== S.lastKey && S.lastKey) {
			const [pp, pm, pv, pt] = S.lastKey.split(':');
			if (g.volcano === 'erupting' && pv !== 'erupting') composer.queue('chorus', true);
			else if (g.volcano === 'rumble' && pv !== 'rumble') composer.queue('build', true);
			else if ((g.place === 'cave' || g.place === 'underwater') && pp !== g.place) composer.queue('breakdown', true);
			else if (g.trip > 0 && pt === 'false') composer.queue('breakdown', false);
			else if ((g.move === 'boost' || g.move === 'drive' || g.game) && pm !== g.move) composer.queue('build', false);
			else if (g.move === 'idle' && pm !== 'idle') composer.queue('breakdown', false);
			else if (pp === 'cave' || pp === 'underwater') composer.queue('intro', false);
			if (S.log) console.log('[automusic] now', g.place, g.move, g.volcano, g.trip ? 'trip' : '');
		}
		S.lastKey = key;
	}

	// ---- one bar
	function writeBar(at) {
		const F = faceplate();
		S.face = F;
		const M = S.mood || adapt(sense(null, opts));
		// the faceplate's scale, coloured by the world: a lydian shimmer, a phrygian edge
		let pcs = pitchSet(F.intervals);
		if (pcs.length === 7) {
			pcs = pcs.slice();
			if (M.lydian > 0.5 && pcs[3] === 5) pcs[3] = 6;
			if (M.phrygian > 0.5 && pcs[1] === 2) pcs[1] = 1;
			// a pentatonic: the major's fourth and seventh left out, or the minor's second and sixth
			if (M.penta > 0.5) pcs = pcs[2] === 4 ? pcs.filter((_, i) => i !== 3 && i !== 6) : pcs.filter((_, i) => i !== 1 && i !== 5);
		}
		S.pcs = pcs;
		// the tempo: the faceplate's, bent by the game, eased a little each bar; locked to the
		// faceplate when its own sequencer is running (and then its drums are the drums)
		const locked = F.beatLoopOn || F.sequencerRunning;
		const base = clamp(F.bpm || 100, 50, 190);
		const want = locked ? base : clamp(base * M.tempoK, 50, 190);
		S.bpm = S.bpm ? S.bpm + clamp(want - S.bpm, -base * 0.03, base * 0.03) : want;
		S.stepMs = 60000 / S.bpm / 4;
		// the mix: back off before the limiter has to
		const t = window.getAutoAudioTelemetry?.();
		if (t && (t.peak > 0.82 || t.busReduction < -3 || t.clipActive)) S.safety = Math.max(0.45, S.safety * 0.88);
		else S.safety = Math.min(1, S.safety + 0.03);
		const out = composer.bar(M, pcs, F.face, locked ? null : F.beat);
		S.info = out.info;
		if (out.info.fresh) { S.sections.push({ name: out.info.section, at: Math.round(performance.now()) }); if (S.sections.length > 40) S.sections.shift(); }
		if (S.log) console.log('[automusic]', out.info.section, out.info.bar + 1 + '/' + out.info.of, 'chord', out.info.chord, 'bpm', Math.round(S.bpm), (F.face || '') + ' ' + NAMES[((F.root % 12) + 12) % 12] + ' ' + (F.scaleId || F.scale), 'arc', out.info.arc, S.game ? S.game.place + '/' + S.game.move : '');
		const swing = clamp((F.swing || 0) + M.swingAdd, 0, 0.6);
		const byStep = Array.from({ length: 16 }, () => []);
		for (const e of out.events) byStep[Math.max(0, Math.min(15, Math.floor(e.s)))].push(e);
		for (const d of out.drums) byStep[Math.max(0, Math.min(15, Math.floor(d.s)))].push({ ...d, drum: true });
		S.bar = { at, byStep, swing, echo: M.echo };
	}
	function playStep(i) {
		const B = S.bar, ms = S.stepMs;
		for (const e of B.byStep[i]) {
			if (e.drum) { drum(e.name, e.vel); continue; }
			const dur = e.dur * ms * 0.95;
			noteOn(e.role, e.semi, dur, e.vel);
			// echoes in caves, under water, on a trip: the note again, softer, a dotted eighth on
			if (B.echo > 0.2 && (e.role === 'mel' || e.role === 'counter')) {
				later(() => noteOn(e.role === 'mel' ? 'counter' : e.role, e.semi, dur * 0.8, e.vel * 0.42 * B.echo), ms * 3);
				if (B.echo > 0.5) later(() => noteOn('arp', e.semi + 12, dur * 0.6, e.vel * 0.2 * B.echo), ms * 6);
			}
		}
	}

	// ---- the clock: steps fall due on performance time, swing delays the off sixteenths
	function stepTime(i) { return S.bar.at + i * S.stepMs + (i % 2 ? S.bar.swing * S.stepMs * 0.5 : 0); }
	function loop() {
		loopT = 0;
		if (!S.on) return;
		const now = performance.now();
		const act = opts.active() && !document.hidden;
		if (!act) {
			if (S.playing) { S.playing = false; silence(); }
			loopT = setTimeout(loop, 250);
			return;
		}
		if (now - senseAt > 450) { senseAt = now; try { listen(); } catch (err) { if (S.log) console.warn('[automusic] listen', err); } }
		if (!S.playing) { S.playing = true; S.step = 16; S.bar = null; wireListen(); }
		// a long stall (seconds) starts a fresh bar; a slow frame only skips the steps it
		// missed, so the pulse keeps its place and old notes never come in a burst
		if (S.bar && now - stepTime(Math.min(15, S.step)) > 4000) { S.step = 16; S.bar = null; }
		for (let guard = 0; guard < 80; guard++) {
			if (!S.bar || S.step >= 16) { writeBar(S.bar ? S.bar.at + 16 * S.stepMs : now + 30); S.step = 0; }
			const due = stepTime(S.step);
			if (due > now + 3) break;
			if (now - due < 150) { try { playStep(S.step); } catch (err) { if (S.log) console.warn('[automusic] step', err); } }
			else S.skipped++;
			S.step++;
		}
		const next = S.step >= 16 ? S.bar.at + 16 * S.stepMs : stepTime(S.step);
		loopT = setTimeout(loop, clamp(next - performance.now() - 1, 1, 250));
	}

	function auto(on) {
		S.on = on === undefined ? !S.on : !!on;
		save({ on: S.on, level: S.level });
		clearTimeout(loopT); loopT = 0;
		if (S.on) loop();
		else { S.playing = false; silence(); }
		sync();
		return S.on ? 'Auto music on: ' + describe() : 'Auto music off.';
	}
	function describe() {
		const F = faceplate();
		return (F.face || 'BARD') + ', ' + NAMES[((F.root % 12) + 12) % 12] + ' ' + (F.scale || '') + (F.scaleId ? ' (' + F.scaleId + ')' : '') + ', ' + Math.round(S.bpm || F.bpm) + ' bpm';
	}

	// ---- the controls: a button beside the sun, and a row in its panel
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.title = 'Auto music: a generative score on the faceplate\'s instruments';
	btn.setAttribute('aria-label', btn.title);
	btn.innerHTML = ICON;
	btn.style.cssText = 'position:absolute;right:calc(64px + env(safe-area-inset-right));top:calc(12px + env(safe-area-inset-top));width:44px;min-height:44px;padding:6px 10px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(8,20,26,.55);color:#eafaf6;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:manipulation;cursor:pointer;';
	btn.addEventListener('click', (e) => { e.stopPropagation(); auto(); btn.blur(); });
	for (const ev of ['pointerdown', 'touchstart', 'keydown']) btn.addEventListener(ev, (e) => e.stopPropagation());
	opts.mount?.appendChild(btn);
	let row = null;
	function sync() {
		btn.setAttribute('aria-pressed', S.on ? 'true' : 'false');
		btn.style.background = S.on ? 'rgba(1,169,130,.85)' : 'rgba(8,20,26,.55)';
		if (row?.isConnected) row.refresh();
	}
	function panel(p) {
		const box = document.createElement('div');
		box.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.14);';
		const b = document.createElement('button');
		b.type = 'button';
		b.style.cssText = 'width:100%;min-height:38px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:9px;border:1px solid rgba(255,255,255,.25);color:#fff;font:12px system-ui;cursor:pointer;';
		b.onclick = () => auto();
		const lv = document.createElement('label');
		lv.style.cssText = 'display:block;margin:8px 0 2px;';
		const top = document.createElement('div');
		top.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;opacity:.9';
		const nm = document.createElement('span'); nm.textContent = 'Music level';
		const val = document.createElement('span');
		const input = document.createElement('input');
		input.type = 'range'; input.min = 0; input.max = 1; input.step = 0.01; input.value = S.level;
		input.style.cssText = 'width:100%;accent-color:#01a982;';
		input.addEventListener('input', () => { S.level = +input.value; val.textContent = Math.round(S.level * 100) + '%'; save({ on: S.on, level: S.level }); });
		top.append(nm, val); lv.append(top, input);
		const info = document.createElement('div');
		info.style.cssText = 'font:11px system-ui;opacity:.7;line-height:1.35;margin-top:2px;';
		box.append(b, lv, info);
		p.appendChild(box);
		row = box;
		box.refresh = () => {
			b.innerHTML = ICON + '<span>' + (S.on ? 'AUTO MUSIC: ON' : 'AUTO MUSIC: OFF') + '</span>';
			b.style.background = S.on ? '#01a982' : 'transparent';
			val.textContent = Math.round(S.level * 100) + '%';
			info.textContent = S.on && S.info ? `${S.info.section} · ${describe()} · ${S.game?.place || ''} ${S.game?.move || ''}` : 'Improvises on the faceplate\'s sounds, key and beat, and follows where you are and what you do.';
		};
		box.refresh();
	}
	setInterval(() => { if (row?.isConnected && row.offsetParent) row.refresh(); }, 1000);

	function state() {
		const per = {};
		for (const [, r] of S.counts) per[r] = (per[r] || 0) + 1;
		const F = S.face || faceplate();
		return {
			on: S.on, playing: S.playing, level: S.level, bpm: Math.round(S.bpm), face: F.face, key: NAMES[((F.root % 12) + 12) % 12], scale: F.scale, scaleId: F.scaleId,
			pcs: S.pcs, section: S.info?.section, bar: S.info ? S.info.bar + 1 + '/' + S.info.of : null, chord: S.info?.chord, arc: S.info?.arc,
			game: S.game, mood: S.mood && { energy: +S.mood.energy.toFixed(2), tempoK: +S.mood.tempoK.toFixed(2), drums: +S.mood.drums.toFixed(2), sparse: +S.mood.sparse.toFixed(2), echo: +S.mood.echo.toFixed(2), dark: +S.mood.dark.toFixed(2), tension: S.mood.tension, climax: S.mood.climax, dream: S.mood.dream, lydian: S.mood.lydian, phrygian: S.mood.phrygian },
			perMinute: per, voices: live.size, safety: +S.safety.toFixed(2), skipped: S.skipped, sections: S.sections.map((s) => s.name), bard: hasBard(), leads: F.leads,
		};
	}

	// the music's pulse, for the footsteps (player.js): this score's own while it plays, else the
	// faceplate's tempo for half a minute after you last played it, counted from your last note
	function clock() {
		if (hasBard()) wireListen();
		if (S.playing && S.bar && S.bpm) return { period: 60 / S.bpm, at: S.bar.at };
		if (S.userAt && performance.now() - S.userAt < 30000) { const F = faceplate(); return F.bpm ? { period: 60 / F.bpm, at: S.userAt } : null; }
		return null;
	}

	sync();
	if (S.on) loop();
	return { auto, state, panel, clock, log: (on) => { S.log = on === undefined ? !S.log : !!on; return S.log; }, queue: (to, urgent) => composer.queue(to, urgent), level: (v) => { if (v !== undefined) { S.level = clamp(+v, 0, 1); save({ on: S.on, level: S.level }); } return S.level; } };
}
