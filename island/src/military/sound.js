// The military's and the police's sounds, synthesised and played into the world's bus
// (world/soundbus.js, never straight to the speakers): a tank's diesel and the clatter of its
// tracks, a truck's or jeep's engine, a jet's roar and whine (the afterburner's crackle on
// top), a helicopter's blade thump and turbine, a cannon's report, and the police siren's
// two-tone wail. Each running sound is a few nodes, set each frame by how hard it works and how
// far away it is, and torn down when it stops.

import { soundBus, noise } from './../world/soundbus.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a running engine of a kind: set(rpm 0..1, load 0..1, gain 0..1), stop()
export function engineSound(kind) {
	const B = soundBus();
	if (!B) return { set() {}, stop() {}, live: false };
	const c = B.ctx, out = c.createGain();
	out.gain.value = 0; out.connect(B.out);
	const nodes = [out];
	const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); nodes.push(o); return o; };
	const gain = (v) => { const g = c.createGain(); g.gain.value = v; nodes.push(g); return g; };
	const filt = (type, f, q = 1) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; nodes.push(b); return b; };
	const src = (colour) => { const s = c.createBufferSource(); s.buffer = noise(c, colour); s.loop = true; s.start(0, Math.random() * 3); nodes.push(s); return s; };
	let set;
	if (kind === 'jet') {
		// the roar: brown and pink noise through a band that opens with the throttle; a whine
		const roar = src('pink'), bp = filt('bandpass', 400, 0.6), rg = gain(0.6); roar.connect(bp).connect(rg).connect(out);
		const rum = src('brown'), lp = filt('lowpass', 160), ug = gain(0.8); rum.connect(lp).connect(ug).connect(out);
		const wh = osc('sawtooth', 900), wf = filt('bandpass', 2400, 4), wg = gain(0.04); wh.connect(wf).connect(wg).connect(out);
		set = (rpm, load, k) => { const t = c.currentTime; bp.frequency.setTargetAtTime(300 + rpm * 1400, t, 0.2); rg.gain.setTargetAtTime(0.3 + load * 0.7, t, 0.2); wh.frequency.setTargetAtTime(700 + rpm * 1800, t, 0.3); out.gain.setTargetAtTime(0.32 * k, t, 0.15); };
	} else if (kind === 'heli') {
		// the blades: noise chopped by a slow pulse (the rotor's rate), a turbine above it
		const n = src('brown'), lp = filt('lowpass', 420), am = gain(0); n.connect(lp).connect(am).connect(out);
		const lfo = osc('square', 4.5), depth = gain(0.5); lfo.connect(depth).connect(am.gain);
		const bias = c.createConstantSource(); bias.offset.value = 0.5; bias.start(); bias.connect(am.gain); nodes.push(bias);
		const tb = osc('sawtooth', 1400), tf = filt('bandpass', 3000, 6), tg = gain(0.025); tb.connect(tf).connect(tg).connect(out);
		set = (rpm, load, k) => { const t = c.currentTime; lfo.frequency.setTargetAtTime(1 + rpm * 4.5, t, 0.4); lp.frequency.setTargetAtTime(280 + load * 400, t, 0.2); tb.frequency.setTargetAtTime(600 + rpm * 1200, t, 0.5); out.gain.setTargetAtTime(0.5 * k * clamp(rpm * 1.4, 0, 1), t, 0.2); };
	} else {
		// a diesel: a low buzz at the firing rate, its harmonics, a rumble; tracks clatter on a tank
		const tank = kind === 'tank', base = tank ? 28 : kind === 'jeep' ? 42 : 34;
		const o1 = osc('sawtooth', base), o2 = osc('square', base * 2), lp = filt('lowpass', 300, 2), og = gain(0.35);
		o1.connect(lp); o2.connect(gain(0.3)).connect(lp); lp.connect(og).connect(out);
		const rum = src('brown'), rl = filt('lowpass', 200), rg = gain(0.7); rum.connect(rl).connect(rg).connect(out);
		const cl = src('white'), cf = filt('bandpass', 1800, 2), cg = gain(0); cl.connect(cf).connect(cg).connect(out);
		set = (rpm, load, k, speed = 0) => { const t = c.currentTime, f = base * (1 + rpm * 1.8); o1.frequency.setTargetAtTime(f, t, 0.12); o2.frequency.setTargetAtTime(f * 2, t, 0.12); lp.frequency.setTargetAtTime(220 + load * 900, t, 0.1); og.gain.setTargetAtTime(0.18 + load * 0.25, t, 0.1); cg.gain.setTargetAtTime(tank ? clamp(speed / 12, 0, 1) * 0.12 : 0, t, 0.1); out.gain.setTargetAtTime(0.42 * k, t, 0.12); };
	}
	let live = true;
	return {
		live: true,
		set: (rpm, load, k = 1, speed = 0) => { if (live) set(clamp(rpm, 0, 1), clamp(load, 0, 1), clamp(k, 0, 1), speed); },
		stop() {
			if (!live) return; live = false;
			const t = c.currentTime; out.gain.setTargetAtTime(0, t, 0.2);
			setTimeout(() => { for (const n of nodes) { try { n.stop?.(); } catch { /* already stopped */ } try { n.disconnect(); } catch { /* gone */ } } }, 800);
		},
	};
}

// a one-off: 'cannon', 'gun' (a burst's round), 'rocket', 'crash'
export function oneShot(kind, k = 1) {
	const B = soundBus();
	if (!B || k <= 0.01) return;
	const c = B.ctx, t = c.currentTime, g = c.createGain(), n = c.createBufferSource(), f = c.createBiquadFilter();
	n.buffer = noise(c, kind === 'gun' ? 'white' : 'brown');
	f.type = 'lowpass'; f.frequency.value = kind === 'gun' ? 3000 : kind === 'cannon' ? 900 : 500;
	const dur = kind === 'gun' ? 0.09 : kind === 'cannon' ? 1.4 : 1.8;
	g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((kind === 'gun' ? 0.35 : 0.9) * k, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	n.connect(f).connect(g).connect(B.out); n.start(t, Math.random() * 2); n.stop(t + dur + 0.1);
	const o = c.createOscillator(), og = c.createGain();
	o.frequency.setValueAtTime(kind === 'gun' ? 180 : 70, t); o.frequency.exponentialRampToValueAtTime(kind === 'gun' ? 60 : 24, t + dur * 0.6);
	og.gain.setValueAtTime((kind === 'gun' ? 0.2 : 0.7) * k, t); og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
	o.connect(og).connect(B.out); o.start(t); o.stop(t + dur);
	n.onended = () => { for (const x of [n, f, g, o, og]) try { x.disconnect(); } catch { /* gone */ } };
}

// the police siren: a two-tone wail (or a yelp up close); set(k) its loudness, stop()
export function sirenSound() {
	const B = soundBus();
	if (!B) return { set() {}, stop() {} };
	const c = B.ctx, out = c.createGain(), o = c.createOscillator(), lfo = c.createOscillator(), depth = c.createGain(), f = c.createBiquadFilter();
	out.gain.value = 0; o.type = 'sawtooth'; o.frequency.value = 700; lfo.type = 'triangle'; lfo.frequency.value = 0.35; depth.gain.value = 260;
	f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.8;
	lfo.connect(depth).connect(o.frequency); o.connect(f).connect(out).connect(B.out); o.start(); lfo.start();
	let live = true;
	return {
		set(k, yelp = false) { if (!live) return; const t = c.currentTime; lfo.frequency.setTargetAtTime(yelp ? 3.2 : 0.35, t, 0.1); out.gain.setTargetAtTime(0.16 * clamp(k, 0, 1), t, 0.1); },
		stop() { if (!live) return; live = false; out.gain.setTargetAtTime(0, c.currentTime, 0.1); setTimeout(() => { for (const x of [o, lfo]) try { x.stop(); } catch { /* stopped */ } for (const x of [o, lfo, depth, f, out]) try { x.disconnect(); } catch { /* gone */ } }, 500); },
	};
}
