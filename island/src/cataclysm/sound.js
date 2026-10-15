// What a catastrophe sounds like, made on the spot (no samples), through the world's bus
// (world/soundbus.js): the quake's rumble from under everything with the windows rattling and
// the shelves going, car alarms set off up and down the street (a few voiced, each where its
// car is), the two tones of the emergency alert, a wildfire's roar and crackle growing as you
// near it, and the deep booms of a mountain blowing. The long sounds are held nodes that are let
// go once quiet; the short ones are one-shots, a few at once at most.

import { soundBus, noise } from '../world/soundbus.js';

export function createCataclysmSound(camera, { isPhone = false } = {}) {
	const ALARMS = isPhone ? 1 : 3;
	let rumble = null, roar = null, lastShot = 0;
	const alarms = [];
	const bus = () => soundBus();
	// pan and gain for a place
	function place(p, reach) {
		const c = camera.position, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
		const yaw = camera.rotation.y, rx = Math.cos(yaw), rz = -Math.sin(yaw);
		return { d, g: Math.max(0, Math.min(1, 12 / Math.max(4, d)) * (1 - d / reach)), pan: Math.max(-0.9, Math.min(0.9, (dx * rx + dz * rz) / Math.max(1, d))) };
	}
	function voice(B, gain = 0) {
		const out = B.ctx.createGain(), sp = B.ctx.createStereoPanner();
		out.gain.value = gain;
		out.connect(sp).connect(B.out);
		return { out, sp };
	}
	function src(ctx, colour) { const s = ctx.createBufferSource(); s.buffer = noise(ctx, colour); s.loop = true; s.start(0, Math.random() * 3); return s; }
	const room = (ms = 60) => { const now = performance.now(); if (now - lastShot < ms) return false; lastShot = now; return true; };

	// ---------- the rumble: k 0..1 ----------
	function setRumble(k) {
		const B = bus();
		if (!B) return;
		const ctx = B.ctx, t = ctx.currentTime;
		if (k > 0.01 && !rumble) {
			const v = voice(B), low = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain(), mg = ctx.createGain();
			low.type = 'lowpass'; low.frequency.value = 95; low.Q.value = 0.9;
			mid.type = 'bandpass'; mid.frequency.value = 260; mid.Q.value = 0.7;
			const a = src(ctx, 'brown'), b = src(ctx, 'pink');
			a.connect(low).connect(v.out);
			b.connect(mid).connect(mg).connect(v.out);
			mg.gain.value = 0.25;
			// (the ground heaving: the rumble swells and sags)
			lfo.frequency.value = 0.9; lg.gain.value = 0.35; lfo.connect(lg).connect(v.out.gain); lfo.start();
			rumble = { v, a, b, lfo, k: 0, quiet: 0 };
		}
		if (!rumble) return;
		rumble.k = k;
		rumble.v.out.gain.setTargetAtTime(Math.min(1.6, k * 1.7), t, 0.25);
		if (k < 0.01) { rumble.quiet += 1 / 60; if (rumble.quiet > 4) { try { rumble.a.stop(); rumble.b.stop(); rumble.lfo.stop(); } catch { /* stopped */ } rumble.v.out.disconnect(); rumble = null; } }
		else rumble.quiet = 0;
	}
	// a rattle in the shaking: a window in its frame, crockery, a shelf going over
	function rattle(k = 1) {
		const B = bus();
		if (!B || !room(90)) return;
		const ctx = B.ctx, t = ctx.currentTime + 0.01, v = voice(B, 0.18 * k);
		v.sp.pan.value = (Math.random() - 0.5) * 1.6;
		const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		s.buffer = noise(ctx, 'white'); f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 2600; f.Q.value = 6;
		const n = 5 + Math.floor(Math.random() * 7);
		g.gain.setValueAtTime(0.0001, t);
		for (let i = 0; i < n; i++) { const q = t + i * (0.035 + Math.random() * 0.04); g.gain.setValueAtTime(0.9, q); g.gain.exponentialRampToValueAtTime(0.0001, q + 0.03); }
		s.connect(f).connect(g).connect(v.out); s.start(t); s.stop(t + n * 0.08 + 0.1);
		if (Math.random() < 0.3) for (let i = 0; i < 4; i++) { const o = ctx.createOscillator(), og = ctx.createGain(), q = t + 0.05 + Math.random() * 0.3; o.type = 'triangle'; o.frequency.value = 2200 + Math.random() * 3000; og.gain.setValueAtTime(0.12, q); og.gain.exponentialRampToValueAtTime(0.0001, q + 0.12); o.connect(og).connect(v.out); o.start(q); o.stop(q + 0.15); }
		setTimeout(() => v.out.disconnect(), 1200);
	}

	// ---------- car alarms ----------
	function alarm(p, dur = 22) {
		const B = bus();
		if (!B || alarms.length >= ALARMS) return false;
		const ctx = B.ctx, t = ctx.currentTime + 0.05 + Math.random() * 0.4, v = voice(B, 0);
		const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
		// (the whoop of one kind of alarm, the two-tone yelp of another)
		const kind = Math.floor(Math.random() * 3);
		o.type = 'square'; o.frequency.value = kind === 2 ? 1250 : 1050 + Math.random() * 150;
		lfo.type = kind === 0 ? 'sawtooth' : kind === 1 ? 'square' : 'sine'; lfo.frequency.value = kind === 0 ? 2.2 : kind === 1 ? 3.6 : 7;
		lg.gain.value = kind === 2 ? 180 : 360;
		lfo.connect(lg).connect(o.frequency);
		f.type = 'lowpass'; f.frequency.value = 3600;
		o.connect(f).connect(v.out); o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
		alarms.push({ p: { x: p.x, z: p.z }, v, end: performance.now() + dur * 1000 + 300 });
		return true;
	}

	// ---------- the alert's two tones ----------
	function alert() {
		const B = bus();
		if (!B) return;
		const ctx = B.ctx, t = ctx.currentTime + 0.05, v = voice(B, 0.07);
		for (const f of [853, 960]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(v.out); o.start(t); o.stop(t + 2.2); }
		v.out.gain.setValueAtTime(0.0001, t); v.out.gain.exponentialRampToValueAtTime(0.07, t + 0.05); v.out.gain.setValueAtTime(0.07, t + 2.0); v.out.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
		setTimeout(() => v.out.disconnect(), 2600);
	}

	// ---------- a wildfire's roar: k 0..1, from where ----------
	function setRoar(k, at) {
		const B = bus();
		if (!B) return;
		const ctx = B.ctx, t = ctx.currentTime;
		if (k > 0.01 && !roar) {
			const v = voice(B), lp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
			lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
			hp.type = 'highpass'; hp.frequency.value = 2500;
			const a = src(ctx, 'brown'), b = src(ctx, 'white');
			a.connect(lp).connect(v.out);
			b.connect(hp).connect(cg).connect(v.out);
			cg.gain.value = 0.0;
			roar = { v, a, b, cg, quiet: 0 };
		}
		if (!roar) return;
		roar.v.out.gain.setTargetAtTime(Math.min(1.2, k * 1.3), t, 0.5);
		if (at) roar.v.sp.pan.setTargetAtTime(place(at, 2000).pan * 0.6, t, 0.3);
		// the crackle: the high hiss opened in snaps
		if (k > 0.05 && Math.random() < 0.5) { const q = t + Math.random() * 0.05; roar.cg.gain.setValueAtTime(0.35 * k + 0.05, q); roar.cg.gain.exponentialRampToValueAtTime(0.0001, q + 0.02 + Math.random() * 0.04); }
		if (k < 0.01) { roar.quiet += 1 / 60; if (roar.quiet > 4) { try { roar.a.stop(); roar.b.stop(); } catch { /* stopped */ } roar.v.out.disconnect(); roar = null; } }
		else roar.quiet = 0;
	}

	// ---------- a boom: an eruption's blast, thunder in the ash cloud ----------
	function boom(k = 1, at = null, thunder = false) {
		const B = bus();
		if (!B) return;
		const ctx = B.ctx, t = ctx.currentTime + (at ? Math.min(3, place(at, 1e5).d / 343) : 0.02), v = voice(B, Math.min(1.5, 0.8 * k));
		if (at) v.sp.pan.value = place(at, 1e5).pan;
		const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		s.buffer = noise(ctx, 'brown'); f.type = 'lowpass'; f.frequency.value = thunder ? 700 : 260;
		g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + (thunder ? 0.02 : 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + (thunder ? 3.5 : 5));
		f.frequency.exponentialRampToValueAtTime(60, t + 4);
		s.connect(f).connect(g).connect(v.out); s.start(t); s.stop(t + 5.2);
		setTimeout(() => v.out.disconnect(), 6500 + (t - ctx.currentTime) * 1000);
	}

	// each frame: the alarms placed as you move, the finished ones let go
	function update() {
		const now = performance.now();
		for (let i = alarms.length - 1; i >= 0; i--) {
			const A = alarms[i];
			if (now > A.end) { A.v.out.disconnect(); alarms.splice(i, 1); continue; }
			const q = place(A.p, 260);
			A.v.out.gain.value = q.g * 0.22; A.v.sp.pan.value = q.pan;
		}
	}
	function stop() {
		setRumble(0); setRoar(0);
		for (const A of alarms) A.v.out.disconnect();
		alarms.length = 0;
		if (rumble) { try { rumble.a.stop(); rumble.b.stop(); rumble.lfo.stop(); } catch { /* stopped */ } rumble.v.out.disconnect(); rumble = null; }
		if (roar) { try { roar.a.stop(); roar.b.stop(); } catch { /* stopped */ } roar.v.out.disconnect(); roar = null; }
	}
	return { setRumble, rattle, alarm, alert, setRoar, boom, update, stop, alarms: () => alarms.length };
}
