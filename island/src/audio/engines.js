// The vehicles' engines, synthesised live and played into the world's bus (world/soundbus.js)
// through a bus of their own, muffled when you are indoors:
//   a car's engine: its firing note (a buzzy wave at the rate its cylinders fire, so a V8
//     burbles and a four-cylinder buzzes), brighter and louder as you press on, the revs
//     rising through each gear and dropping at the change (engine-model.js keeps the gearbox);
//     combustion grit, a diesel's knock (strongest at idle), a turbo's or a gearbox's whine,
//     crackles off the throttle on a sports car, the tyres' roar and a handbrake's squeal
//   a tank's turbine whine over the clatter of its tracks and the roll of its road wheels
//   a jet's spool-up, its whine, its roar (louder behind it) and the afterburner's crackle
//   a helicopter's blade slap and thump, its tail rotor and turbine
// Every engine is a voice placed in the world: its level falls with distance, the air takes
// its highs off, a building between you dulls it, it is panned to where it is and pitched by
// its speed toward or away from you. Only the loudest few sound (a phone holds fewer); the
// rest sleep, their nodes let go, and wake when they matter again. The traffic is a cheaper
// pool (createTraffic): a few voices for the nearest cars, and the faceplate's car hum for the
// rest (palette.js).
// enginesFrame(dt, camera, o) once a frame (audio.js) moves the ears and shares out the voices.

import { soundBus, noise } from '../world/soundbus.js';
import { profileOf, gearbox, firingHz, spool, distanceGain, airCutoff, doppler, budgetFor, pickVoices } from './engine-model.js';
import { subHum, tick } from './palette.js';
import { clamp } from '../noise.js';

export const PHONE = (() => { try { return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900; } catch { return false; } })();
const BUD = budgetFor(PHONE);
const MASTER = 0.22;
// each kind of graph brought to a like loudness (a blade slap is a narrow click, a jet far off)
const TRIM = { combustion: 1.1, tank: 3, jet: 5, rotor: 1.8 };

// the ears: where the camera is, its right hand, how fast it moves; boxes(x, z, r) the buildings
const L = { x: 0, y: 0, z: 0, rx: 1, rz: 0, vx: 0, vy: 0, vz: 0, indoor: false, ok: false, boxes: null };
const info = { live: 0, built: 0, released: 0, awake: 0, voices: 0, traffic: 0, pops: 0, occluded: 0 };
const voices = new Set();
let nextId = 1;
// the clock the engines step by (seconds): the page's, or a rendering's own (useClock)
let clock = () => performance.now() / 1000;
export function useClock(fn) { clock = fn || (() => performance.now() / 1000); }

// ---------- the vehicles' bus ----------
let VB = null;
function vbus() {
	const S = soundBus();
	if (!S) return null;
	if (VB && VB.ctx === S.ctx && VB.dest === S.out) return VB;
	const ctx = S.ctx, inp = ctx.createGain(), lp = ctx.createBiquadFilter();
	inp.gain.value = 0.9; lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
	inp.connect(lp).connect(S.out);
	VB = { ctx, dest: S.out, inp, lp, indoor: false };
	return VB;
}

// ---------- waves, once per context ----------
const waves = new WeakMap();
function wave(ctx, name) {
	let m = waves.get(ctx);
	if (!m) waves.set(ctx, m = {});
	if (m[name]) return m[name];
	const N = 24, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
	// engine: a buzzy pulse, its odd harmonics a little stronger (an exhaust's bark);
	// spike: every harmonic alike in phase, a narrow click each period (a blade's slap)
	for (let n = 1; n <= N; n++) { if (name === 'engine') im[n] = (n % 2 ? 1 : 0.62) / Math.pow(n, 0.8); else re[n] = 1; }
	return (m[name] = ctx.createPeriodicWave(re, im));
}

// a voice's nodes: everything made through here is counted, and let go together
function kit(ctx, nodes) {
	const add = (n) => { nodes.push(n); return n; };
	return {
		osc(type, f) { const o = add(ctx.createOscillator()); if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type); o.frequency.value = f; o.start(); return o; },
		gain(v) { const g = add(ctx.createGain()); g.gain.value = v; return g; },
		filt(type, f, q = 0.7) { const b = add(ctx.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
		src(colour) { const s = add(ctx.createBufferSource()); s.buffer = noise(ctx, colour); s.loop = true; s.start(0, Math.random() * 3); return s; },
		pan() { return add(ctx.createStereoPanner()); },
	};
}
function letGo(nodes) {
	for (const n of nodes) { try { n.stop?.(); } catch { /* stopped */ } try { n.disconnect(); } catch { /* gone */ } }
	info.live -= nodes.length; info.released += nodes.length;
}

// ---------- the ears ----------
// where a source is from you: distance, pan (-1 left .. 1 right), the Doppler factor
function hear(x, y, z, vx, vz) {
	const dx = x - L.x, dy = y - L.y, dz = z - L.z, d = Math.hypot(dx, dy, dz);
	// (never quite hard to one side: the world is heard with both ears)
	const pan = d > 0.5 ? clamp(0.6 * (dx * L.rx + dz * L.rz) / (d + 2), -0.6, 0.6) : 0;
	const vr = d > 0.5 ? ((vx - L.vx) * dx + (vz - L.vz) * dz) / d : 0;
	return { d, pan, dop: doppler(vr), dx, dz };
}
// a building between you and the source (the mapped boxes): a cheap 2D test against the few near
// the line, a few times a second per voice
function blocked(x, z) {
	if (!L.boxes) return false;
	const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
	if (d < 8 || d > 400) return false;
	let list;
	try { list = L.boxes(L.x + dx / 2, L.z + dz / 2, Math.min(80, d / 2 + 6)); } catch { return false; }
	for (const b of list) {
		if ((b.wallH ?? b.h ?? 0) < 3 || !b.w || !b.d) continue;
		const a = b.a || 0, c = Math.cos(a), s = Math.sin(a);
		// into the box's own frame, then a slab test against its half sizes
		const ax = (L.x - b.x) * c + (L.z - b.z) * s, az = -(L.x - b.x) * s + (L.z - b.z) * c;
		const bx = (x - b.x) * c + (z - b.z) * s, bz = -(x - b.x) * s + (z - b.z) * c;
		const hx = b.w / 2 - 0.3, hz = b.d / 2 - 0.3;
		if (Math.abs(ax) < hx && Math.abs(az) < hz) continue;           // you are in it: not a wall between
		let t0 = 0, t1 = 1, ok = true;
		for (const [p, q, h] of [[ax, bx - ax, hx], [az, bz - az, hz]]) {
			if (Math.abs(q) < 1e-6) { if (Math.abs(p) > h) { ok = false; break; } continue; }
			let u = (-h - p) / q, w = (h - p) / q;
			if (u > w) [u, w] = [w, u];
			t0 = Math.max(t0, u); t1 = Math.min(t1, w);
			if (t0 > t1) { ok = false; break; }
		}
		if (ok) return true;
	}
	return false;
}

// ---------- the engines' graphs ----------
// each returns { set(m, sp) }: m the engine's state now, sp { dop } for the pitch
function combustion(ctx, K, p, mix, opts) {
	const lite = PHONE, diesel = p.fuel === 'diesel';
	const pulse = K.osc(wave(ctx, 'engine'), 30), low = K.filt('lowpass', 600, 1.3), pipe = K.filt('peaking', p.pipe || 140, 1.2), body = K.gain(0.5);
	pipe.gain.value = 6;
	pulse.connect(low).connect(pipe).connect(body).connect(mix);
	let sub = null, subG = null;
	if (!lite && p.burble) { sub = K.osc('sine', 15); subG = K.gain(p.burble * 0.45); sub.connect(subG).connect(low); }
	// combustion grit: noise in puffs at the firing rate
	let gritG = null, gritBp = null, gritD = null;
	if (!lite) {
		const n = K.src('pink'); gritBp = K.filt('bandpass', 400, 0.9); gritG = K.gain(0); gritD = K.gain(0);
		n.connect(gritBp).connect(gritG).connect(mix); pulse.connect(gritD).connect(gritG.gain);
	}
	// a diesel's knock: a bright clatter, struck at the firing rate
	let ratG = null, ratD = null, ratO = null;
	if (!lite && diesel && p.rattle) {
		const n = K.src('white'), bp = K.filt('bandpass', 2600, 1.4); ratG = K.gain(0); ratD = K.gain(0); ratO = K.osc('square', 20);
		n.connect(bp).connect(ratG).connect(mix); ratO.connect(ratD).connect(ratG.gain);
	}
	// a turbo's whistle, or a bus's gearbox whine
	let whO = null, whG = null;
	if (!lite && p.whine) { whO = K.osc('sine', 1800); whG = K.gain(0); whO.connect(whG).connect(mix); }
	// the tyres on the road, and a skid (the car you drive)
	let tyG = null, tyBp = null, skG = null;
	if (opts.tyres) {
		const n = K.src('pink'); tyBp = K.filt('bandpass', 500, 0.6); tyG = K.gain(0); n.connect(tyBp).connect(tyG).connect(mix);
		const s = K.src('white'), sb = K.filt('bandpass', 1150, 9); skG = K.gain(0); s.connect(sb).connect(skG).connect(mix);
	}
	return {
		set(m, sp, t) {
			const f = m.f * sp.dop, load = m.load, k = m.k, tc = 0.04;
			pulse.frequency.setTargetAtTime(f, t, tc);
			sub?.frequency.setTargetAtTime(f / 2, t, tc);
			low.frequency.setTargetAtTime(clamp(180 + f * (2.2 + load * 7), 150, 7000), t, 0.06);
			body.gain.setTargetAtTime((0.3 + 0.7 * load) * (0.55 + 0.45 * k), t, 0.06);
			if (gritG) { gritBp.frequency.setTargetAtTime(clamp(f * 3, 120, 4000), t, tc); gritD.gain.setTargetAtTime(0.08 + 0.4 * load * (0.4 + k), t, 0.06); }
			if (ratG) { ratO.frequency.setTargetAtTime(f, t, tc); ratD.gain.setTargetAtTime(p.rattle * (0.07 + 0.12 * (1 - k)) * (0.5 + 0.5 * load), t, 0.08); }
			if (whG) { whO.frequency.setTargetAtTime((diesel ? 1400 + 3200 * k : 1800 + 3600 * k) * sp.dop, t, 0.1); whG.gain.setTargetAtTime(p.whine * 0.012 * load * k, t, 0.15); }
			if (tyG) {
				const v = Math.abs(m.speed);
				tyBp.frequency.setTargetAtTime(380 + v * 22, t, 0.1); tyG.gain.setTargetAtTime(0.35 * Math.pow(clamp(v / 30, 0, 1.4), 1.3) * (m.rough || 1), t, 0.1);
				skG.gain.setTargetAtTime(m.skid ? 0.08 * clamp(v / 12, 0, 1) : 0, t, 0.05);
			}
		},
	};
}

function turbineTank(ctx, K, p, mix) {
	const a = K.osc('sine', 900), b = K.osc('sine', 1370), ag = K.gain(0), bg = K.gain(0);
	a.connect(ag).connect(mix); b.connect(bg).connect(mix);
	const air = K.src('pink'), abp = K.filt('bandpass', 500, 0.7), airG = K.gain(0); air.connect(abp).connect(airG).connect(mix);
	const rum = K.src('brown'), rlp = K.filt('lowpass', 110), rumG = K.gain(0); rum.connect(rlp).connect(rumG).connect(mix);
	// the tracks: a clatter at the rate the links meet the sprocket, a clank at the road wheels'
	const tr = K.src('white'), tbp = K.filt('bandpass', 1300, 1.1), trG = K.gain(0), trO = K.osc('square', 10), trD = K.gain(0);
	tr.connect(tbp).connect(trG).connect(mix); trO.connect(trD).connect(trG.gain);
	let clG = null, clO = null, clD = null;
	if (!PHONE) { const cl = K.src('brown'), cbp = K.filt('bandpass', 260, 2); clG = K.gain(0); clO = K.osc('square', 2); clD = K.gain(0); cl.connect(cbp).connect(clG).connect(mix); clO.connect(clD).connect(clG.gain); }
	return {
		set(m, sp, t) {
			const n = m.n, v = Math.abs(m.speed), roll = clamp(v / 3, 0, 1);
			a.frequency.setTargetAtTime((600 + n * 2600) * sp.dop, t, 0.15); b.frequency.setTargetAtTime((600 + n * 2600) * 1.52 * sp.dop, t, 0.15);
			ag.gain.setTargetAtTime(0.045 * n, t, 0.2); bg.gain.setTargetAtTime(0.018 * n, t, 0.2);
			abp.frequency.setTargetAtTime(300 + n * 700, t, 0.2); airG.gain.setTargetAtTime(0.3 * n * (0.5 + 0.5 * m.load), t, 0.15);
			rumG.gain.setTargetAtTime((0.3 + m.load * 0.5) * (0.3 + n * 0.7), t, 0.15);
			trO.frequency.setTargetAtTime(Math.max(1, v / 0.17), t, 0.08); trD.gain.setTargetAtTime(0.32 * roll, t, 0.1);
			if (clG) { clO.frequency.setTargetAtTime(Math.max(0.5, v / 1.1), t, 0.1); clD.gain.setTargetAtTime(0.4 * roll, t, 0.1); }
		},
	};
}

function jetEngine(ctx, K, p, mix) {
	const w1 = K.osc('sawtooth', 2000), w1f = K.filt('bandpass', 2400, 6), w1g = K.gain(0); w1.connect(w1f).connect(w1g).connect(mix);
	let w2 = null, w2g = null;
	if (!PHONE) { w2 = K.osc('sine', 2800); w2g = K.gain(0); w2.connect(w2g).connect(mix); }
	const roar = K.src('pink'), rbp = K.filt('bandpass', 400, 0.6), roarG = K.gain(0); roar.connect(rbp).connect(roarG).connect(mix);
	const rum = K.src('brown'), rlp = K.filt('lowpass', 130), rumG = K.gain(0); rum.connect(rlp).connect(rumG).connect(mix);
	// the afterburner: a hiss broken up by two square beats out of step (an irregular crackle)
	const ab = K.src('white'), ahp = K.filt('highpass', 700), abG = K.gain(0), l1 = K.osc('square', 11.3), l2 = K.osc('square', 17.9), d1 = K.gain(0), d2 = K.gain(0);
	ab.connect(ahp).connect(abG).connect(mix); l1.connect(d1).connect(abG.gain); l2.connect(d2).connect(abG.gain);
	const noises = [roar, rum, ab];
	return {
		set(m, sp, t) {
			const n = m.n, back = sp.behind ?? 0.5;
			w1.frequency.setTargetAtTime((1500 + n * 3800) * sp.dop, t, 0.2); w1f.frequency.setTargetAtTime((1500 + n * 3800) * 1.1 * sp.dop, t, 0.2);
			w1g.gain.setTargetAtTime(0.03 * (0.3 + n) * (1.3 - back * 0.6), t, 0.2);
			if (w2) { w2.frequency.setTargetAtTime((1500 + n * 3800) * 1.41 * sp.dop, t, 0.2); w2g.gain.setTargetAtTime(0.012 * n * (1.3 - back * 0.6), t, 0.2); }
			rbp.frequency.setTargetAtTime((220 + n * 800) * sp.dop, t, 0.2);
			roarG.gain.setTargetAtTime(0.75 * Math.pow(n, 1.6) * (0.4 + 0.6 * m.load) * (0.55 + back * 0.9), t, 0.2);
			rumG.gain.setTargetAtTime((0.55 * n + 0.5 * m.ab) * (0.6 + back * 0.6), t, 0.2);
			d1.gain.setTargetAtTime(0.16 * m.ab, t, 0.1); d2.gain.setTargetAtTime(0.12 * m.ab, t, 0.1);
			for (const s of noises) s.playbackRate.setTargetAtTime(sp.dop, t, 0.1);
		},
	};
}

function rotor(ctx, K, p, mix) {
	const beat = K.osc(wave(ctx, 'spike'), 18);
	const sl = K.src('pink'), sbp = K.filt('bandpass', 380, 0.9), slG = K.gain(0), slD = K.gain(0);
	sl.connect(sbp).connect(slG).connect(mix); beat.connect(slD).connect(slG.gain);
	const th = K.src('brown'), tlp = K.filt('lowpass', 150), thG = K.gain(0), thD = K.gain(0);
	th.connect(tlp).connect(thG).connect(mix); beat.connect(thD).connect(thG.gain);
	let tl = null, tlO = null, tlD = null;
	if (!PHONE) { const n = K.src('white'), bp = K.filt('bandpass', 1700, 1.5); tl = K.gain(0); tlO = K.osc('sine', 90); tlD = K.gain(0); n.connect(bp).connect(tl).connect(mix); tlO.connect(tlD).connect(tl.gain); }
	const tb = K.osc('sine', 1400), tbG = K.gain(0); tb.connect(tbG).connect(mix);
	return {
		set(m, sp, t) {
			const R = m.n, bpf = Math.max(0.5, (p.blades || 4) * (p.rotorHz || 4.6) * R) * sp.dop;
			beat.frequency.setTargetAtTime(bpf, t, 0.15);
			// the slap sharpens as the blades work harder and as it flies faster
			slD.gain.setTargetAtTime(R * (3 + 4.5 * m.load + 3 * clamp(Math.abs(m.speed) / 40, 0, 1)), t, 0.15);
			thD.gain.setTargetAtTime(6 * R, t, 0.15);
			if (tl) { tlO.frequency.setTargetAtTime(bpf * 5.3, t, 0.15); tlD.gain.setTargetAtTime(0.07 * R, t, 0.15); }
			tb.frequency.setTargetAtTime((1200 + R * 2400) * sp.dop, t, 0.3); tbG.gain.setTargetAtTime(0.02 * R, t, 0.3);
		},
	};
}

// ---------- a voice ----------
// kind: a PROFILES key; prio: how much it matters (yours 3, the military's 2, others 1);
// opts: { tyres } for the car you drive
function makeVoice(kind, prio, opts = {}) {
	const v = { id: nextId++, kind, p: profileOf(kind), prio, opts, nodes: null, ctx: null, eng: null, ch: null, gb: {}, n: 0, m: null, sp: { d: 0, pan: 0, dop: 1, behind: 0.5 }, gain: 0, score: 0, sleepT: 0, stopped: false, stopT: 0, at: null, prev: null, vel: [0, 0], lastT: 0, lastLoad: 0, occl: false, occT: Math.random() * 0.3, inside: false, popsLive: 0 };
	voices.add(v);
	return v;
}
function build(v) {
	const B = vbus();
	if (!B) return false;
	const ctx = B.ctx, nodes = [], K = kit(ctx, nodes);
	const mix = K.gain(1), lp = K.filt('lowpass', 20000, 0.5), pan = K.pan(), out = K.gain(0);
	mix.connect(lp).connect(pan).connect(out).connect(B.inp);
	const f = v.p.fuel;
	v.graph = f === 'turbine' ? (v.p.tracks ? 'tank' : 'jet') : f === 'rotor' ? 'rotor' : 'combustion';
	v.eng = { tank: turbineTank, jet: jetEngine, rotor, combustion }[v.graph](ctx, K, v.p, mix, v.opts);
	v.ch = { mix, lp, pan, out };
	v.nodes = nodes; v.ctx = ctx; v.sleepT = 0;
	info.live += nodes.length; info.built += nodes.length;
	if (v.m) apply(v, true);
	return true;
}
function release(v) {
	if (!v.nodes) return;
	letGo(v.nodes);
	v.nodes = null; v.eng = null; v.ch = null; v.ctx = null;
}
function apply(v, now = false) {
	if (!v.eng || !v.m) return;
	const t = v.ctx.currentTime, sp = v.sp;
	v.eng.set(v.m, sp, t);
	const cut = Math.min(airCutoff(sp.d), v.occl ? 900 : 20000, v.inside ? 1500 : 20000);
	v.ch.lp.frequency.setTargetAtTime(cut, t, 0.12);
	v.ch.pan.pan.setTargetAtTime(v.inside ? 0 : sp.pan, t, 0.06);
	const g = MASTER * TRIM[v.graph] * v.gain * (v.occl ? 0.55 : 1) * (v.inside ? 0.8 : 1);
	if (now) v.ch.out.gain.setValueAtTime(0, t);
	v.ch.out.gain.setTargetAtTime(g, t, now ? 0.15 : 0.06);
	// a sports car crackles off the throttle and at a quick change up
	if (v.p.pops && v.m.k !== undefined) {
		if (v.lastLoad > 0.5 && v.m.load < 0.1 && v.m.k > 0.4) pops(v, 2 + Math.floor(Math.random() * 4));
		else if (v.m.shifted > 0 && v.m.k > 0.55 && Math.random() < 0.6) pops(v, 1);
	}
	if (v.inside && v.m.shifted && v.prio >= 3) tick(v.ctx, v.ch.mix, 0.006, 1200);
	v.lastLoad = v.m.load;
}
// a few short barks of the exhaust, spread over half a second
function pops(v, n) {
	const ctx = v.ctx, max = PHONE ? 2 : 4;
	for (let i = 0; i < n && info.pops < max; i++) {
		const t = ctx.currentTime + 0.05 + Math.random() * 0.45, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
		s.buffer = noise(ctx, 'brown'); bp.type = 'bandpass'; bp.frequency.value = 450 + Math.random() * 800; bp.Q.value = 1.2;
		const lv = 0.5 + Math.random() * 0.6;
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
		s.connect(bp).connect(g).connect(v.ch.mix); s.start(t, Math.random() * 3); s.stop(t + 0.06);
		info.pops++;
		s.onended = () => { info.pops--; for (const x of [s, bp, g]) try { x.disconnect(); } catch { /* gone */ } };
	}
}

// the engine's state for this frame. s: { speed (m/s), throttle (0..1), rpm (0..1, aircraft:
// the throttle or the rotor's spin), ab (afterburner 0..1), skid, rough (the road's roughness),
// k (an extra level 0..1), where: { x, y, z, fx, fz (its nose), inside (you are in its seat) } }
function update(v, s) {
	if (v.stopped) return;
	const now = clock(), dt = v.lastT ? clamp(now - v.lastT, 0.001, 0.25) : 1 / 60;
	v.lastT = now;
	const p = v.p, speed = s.speed || 0, thr = clamp(s.throttle ?? 0, 0, 1);
	if (p.fuel === 'petrol' || p.fuel === 'diesel') {
		const g = gearbox(p, speed, thr, dt, v.gb);
		v.m = { f: firingHz(p, g.rpm), k: g.k, load: g.load, speed, shifted: g.shifted, gear: g.gear, rpm: g.rpm, skid: !!s.skid, rough: s.rough || 1 };
	} else if (p.tracks) {
		const top = p.gears[p.gears.length - 1], want = p.idle + (1 - p.idle) * Math.max(thr * 0.9, Math.abs(speed) / top * 0.8);
		v.n = spool(v.n || p.idle, want, dt, p.spool[0], p.spool[1]);
		v.m = { n: v.n, load: thr, speed };
	} else if (p.fuel === 'turbine') {
		v.n = spool(v.n || p.idle, Math.max(p.idle, clamp(s.rpm ?? thr, 0, 1)), dt, p.spool[0], p.spool[1]);
		v.m = { n: v.n, load: thr, ab: clamp(s.ab || 0, 0, 1), speed };
	} else {
		v.n = clamp(s.rpm ?? 0, 0, 1);
		v.m = { n: v.n, load: thr, speed };
	}
	// where it is, and how it moves (worked out from where it was)
	const w = s.where;
	v.inside = !!w?.inside;
	if (w && Number.isFinite(w.x)) {
		if (v.prev) { const a = Math.min(1, dt * 6); v.vel[0] += ((w.x - v.prev[0]) / dt - v.vel[0]) * a; v.vel[1] += ((w.z - v.prev[1]) / dt - v.vel[1]) * a; }
		v.prev = [w.x, w.z];
		const h = hear(w.x, w.y ?? L.y, w.z, v.vel[0], v.vel[1]);
		v.sp.d = h.d; v.sp.pan = h.pan; v.sp.dop = v.inside ? 1 : h.dop;
		// behind a jet its roar; ahead of it its whine
		v.sp.behind = w.fx !== undefined && h.d > 1 ? clamp((1 - (w.fx * -h.dx + w.fz * -h.dz) / h.d) / 2, 0, 1) : 0.5;
		const ref = p.fuel === 'turbine' && !p.tracks ? 25 : p.fuel === 'rotor' ? 20 : p.tracks ? 10 : 5, far = p.fuel === 'turbine' && !p.tracks ? 3000 : p.fuel === 'rotor' ? 2000 : p.tracks ? 900 : 450;
		v.gain = p.level * distanceGain(v.inside ? 0 : h.d, ref, far) * clamp(s.k ?? 1, 0, 1);
		v.occT -= dt;
		if (v.occT <= 0 && !v.inside) { v.occT = 0.3; v.occl = blocked(w.x, w.z); }
	} else {
		v.sp.d = 0; v.sp.pan = 0; v.sp.dop = 1; v.sp.behind = 0.5;
		v.gain = p.level * clamp(s.k ?? 1, 0, 1);
	}
	// (a helicopter at rest is silent, however close)
	if (p.fuel === 'rotor') v.gain *= clamp(v.n * 1.4, 0, 1);
	// (the one you sit in counts as yours)
	v.score = v.gain * (v.inside ? Math.max(3, v.prio) : v.prio);
	if (v.nodes) apply(v);
}
function stopVoice(v) {
	if (v.stopped) return;
	v.stopped = true; v.stopT = 0;
	if (v.ch) v.ch.out.gain.setTargetAtTime(0, v.ctx.currentTime, 0.15);
}

// ---------- what the rest of the game holds ----------
// the car you drive: drive({ speed, throttle, skid, rough, where }), stop()
export function carEngine(kind) {
	const v = makeVoice(kind, 3, { tyres: true });
	return { kind, drive: (s) => update(v, s), stop: () => stopVoice(v), state: () => v.m };
}
// any other engine: set(state), stop() (the military's, through military/sound.js)
export function engineVoice(kind, prio = 2) {
	const v = makeVoice(kind, prio);
	return { kind, set: (s) => update(v, s), stop: () => stopVoice(v), state: () => v.m };
}

// once a frame: the ears follow the camera; the loudest voices wake, the rest sleep.
// o: { indoor, boxes(x, z, r) }
export function enginesFrame(dt, cam, o = {}) {
	ears(dt, cam);
	L.indoor = !!o.indoor; L.boxes = o.boxes || null;
	const B = vbus();
	if (B && B.indoor !== L.indoor) { B.indoor = L.indoor; B.lp.frequency.setTargetAtTime(L.indoor ? 500 : 20000, B.ctx.currentTime, 0.3); }
	const live = [];
	for (const v of voices) {
		if (v.stopped) {
			v.stopT += dt;
			if (v.stopT > 0.8 || !v.nodes) { release(v); voices.delete(v); }
			continue;
		}
		// a context changed under it (the Bard's audio arrived): made again in the new one
		if (v.nodes && B && v.ctx !== B.ctx) release(v);
		live.push(v);
	}
	const held = new Set(live.filter((v) => v.nodes && v.sleepT === 0).map((v) => v.id));
	const keep = pickVoices(live.map((v) => ({ id: v.id, score: v.score })), held, BUD.engines);
	let awake = 0;
	for (const v of live) {
		if (keep.has(v.id)) {
			if (!v.nodes) build(v);
			else if (v.sleepT > 0) { v.sleepT = 0; apply(v, true); }
			if (v.nodes) awake++;
		} else if (v.nodes) {
			if (v.sleepT === 0) v.ch.out.gain.setTargetAtTime(0, v.ctx.currentTime, 0.2);
			v.sleepT += dt;
			if (v.sleepT > 1.2) release(v);
		}
	}
	info.awake = awake; info.voices = live.length;
	info.occluded = live.filter((v) => v.nodes && v.occl).length;
}
let earsAt = null;
function ears(dt, cam) {
	if (!cam || !Number.isFinite(cam.position.x)) return;
	const p = cam.position, e = cam.matrixWorld.elements, rl = Math.hypot(e[0], e[2]) || 1;
	if (earsAt && dt > 0) { const a = Math.min(1, dt * 5); L.vx += ((p.x - earsAt[0]) / dt - L.vx) * a; L.vy += ((p.y - earsAt[1]) / dt - L.vy) * a; L.vz += ((p.z - earsAt[2]) / dt - L.vz) * a; }
	// (a jump across the map is not a speed)
	if (Math.hypot(L.vx, L.vz) > 400) L.vx = L.vy = L.vz = 0;
	earsAt = [p.x, p.y, p.z];
	L.x = p.x; L.y = p.y; L.z = p.z; L.rx = e[0] / rl; L.rz = e[2] / rl; L.ok = true;
}
// how fast the ears move (m/s), for the air rushing past (environment.js)
export const earSpeed = () => Math.hypot(L.vx, L.vy, L.vz);
// in a vehicle's seat (yours, or one of the military's you took): the rain on its roof
export const inCabin = () => [...voices].some((v) => !v.stopped && v.inside && v.prio >= 2);

// ---------- the traffic ----------
// a pool of a few cheap voices (a firing note and the tyres) for the nearest moving cars, and the
// faceplate's car hum for the many beyond them. update(dt, cars, cam, { on, wet, inside })
export function createTraffic() {
	const slots = [], gbs = new WeakMap();
	let ctx = null, hum = null, idle = 0, nodes = [];
	function make(B) {
		ctx = B.ctx; nodes = [];
		const K = kit(ctx, nodes);
		for (let i = 0; i < BUD.traffic; i++) {
			const o = K.osc(wave(ctx, 'engine'), 30), lp = K.filt('lowpass', 500, 1), eg = K.gain(0);
			const n = K.src('pink'), bp = K.filt('bandpass', 700, 0.5), tg = K.gain(0);
			const alp = K.filt('lowpass', 20000, 0.5), pan = K.pan(), out = K.gain(0);
			o.connect(lp).connect(eg).connect(alp); n.connect(bp).connect(tg).connect(alp); alp.connect(pan).connect(out).connect(B.inp);
			slots.push({ o, lp, eg, bp, tg, alp, pan, out, car: null, fresh: false });
		}
		hum = subHum(ctx, B.inp);
		info.live += nodes.length; info.built += nodes.length;
	}
	function free() {
		if (!nodes.length) return;
		letGo(nodes); nodes = []; slots.length = 0;
		hum?.stop(0.1); hum = null; ctx = null;
	}
	function update(dt, cars, cam, o = {}) {
		const B = vbus();
		if (!B) return;
		if (!L.ok) ears(0, cam);
		const on = clamp(o.on ?? 1, 0, 1), wet = clamp(o.wet || 0, 0, 1);
		const list = [];
		let far = 0;
		if (on > 0.01) for (const c of cars || []) {
			if (c.px === undefined || !(c.v > 0.3)) continue;
			const d = Math.hypot(c.px - L.x, (c.py ?? L.y) - L.y, c.pz - L.z);
			if (d < 160) list.push({ id: c, score: (0.3 + c.v / 12) * distanceGain(d, 5, 160) });
			else if (d < 400) far++;
		}
		if (!list.length && !far) { idle += dt; if (idle > 4) free(); if (!slots.length) return; } else idle = 0;
		if (!slots.length || ctx !== B.ctx) { free(); make(B); }
		const held = new Set(slots.map((s) => s.car).filter(Boolean));
		const keep = pickVoices(list, held, slots.length);
		// let go of the cars no longer kept, then give the free voices to the newcomers
		for (const s of slots) if (s.car && !keep.has(s.car)) s.car = null;
		for (const c of keep) if (!slots.some((s) => s.car === c)) { const s = slots.find((q) => !q.car); if (s) { s.car = c; s.fresh = true; } }
		const t = ctx.currentTime;
		let voiced = 0;
		for (const s of slots) {
			const c = s.car;
			if (!c) { s.out.gain.setTargetAtTime(0, t, 0.2); continue; }
			voiced++;
			const p = profileOf(c.kind), st = gbs.get(c) || {};
			gbs.set(c, st);
			const accel = st.lv === undefined ? 0 : (c.v - st.lv) / Math.max(dt, 1e-3);
			st.lv = c.v;
			const g = gearbox(p, c.v, accel > 0.25 ? 0.7 : c.v > 1 ? 0.25 : 0.05, dt, st);
			const h = hear(c.px, c.py ?? L.y, c.pz, c.vx || 0, c.vz || 0), dg = distanceGain(h.d, 5, 160) * on;
			const f = firingHz(p, g.rpm) * h.dop, set = s.fresh ? (prm, v) => prm.setValueAtTime(v, t) : (prm, v, tc = 0.06) => prm.setTargetAtTime(v, t, tc);
			set(s.o.frequency, f); set(s.lp.frequency, clamp(160 + f * (2 + g.load * 5), 150, 3500));
			s.eg.gain.setTargetAtTime(0.5 * (0.35 + 0.65 * g.load) * p.level, t, 0.08);
			set(s.bp.frequency, (600 + wet * 1500 + c.v * 30) * h.dop);
			s.tg.gain.setTargetAtTime(0.5 * Math.min(1, c.v / 12) * (1 + wet * 1.2), t, 0.08);
			s.alp.frequency.setTargetAtTime(Math.min(airCutoff(h.d), o.inside ? 600 : 20000), t, 0.1);
			s.pan.pan.setTargetAtTime(h.pan, t, 0.06);
			if (s.fresh) s.out.gain.setValueAtTime(0, t);
			s.out.gain.setTargetAtTime(MASTER * 1.4 * dg, t, s.fresh ? 0.25 : 0.08);
			s.fresh = false;
		}
		// the hum of the cars you cannot pick out
		hum?.g.gain.setTargetAtTime(0.03 * on * clamp((far + Math.max(0, list.length - voiced)) / 10, 0, 1), t, 0.8);
		info.traffic = voiced;
	}
	return { update, stop: free };
}

// what they are doing: Crysis.audio().engines
export function engineInfo() {
	const list = [...voices].map((v) => ({ kind: v.kind, prio: v.prio, awake: !!v.nodes && v.sleepT === 0, gain: +v.gain.toFixed(3), d: Math.round(v.sp.d), occluded: v.occl, gear: v.m?.gear, rpm: v.m?.rpm ? Math.round(v.m.rpm) : undefined, spool: v.m?.n !== undefined ? +v.m.n.toFixed(2) : undefined }));
	return { ...info, phone: PHONE, budget: BUD, list };
}
