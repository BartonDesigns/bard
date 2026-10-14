// The faceplate's own quieter sounds, made again for the world so the instrument and the world
// sound like one thing. Each is the flight route's recipe (index.html's flight engine, played
// through L99Route223's buses there), turned down for under the music:
//   cabinPad:  the flight's ambient loop: a soft smoothed-noise wind and two slow sine pads (a
//              root and its fifth) breathing on their own; the ship's cabin in space
//   subHum:    the hum of the nearest car: two sawtooths a few hertz apart under a low-pass,
//              beating; the traffic you cannot pick out one by one
//   cityHum:   the low hum near the shelters: a triangle and a sine under a low-pass; a
//              downtown's air handling
//   groan:     the abyss's dread: a deep sine whose pitch wanders slowly; a far, heavy burn
//   chord:     the ceremony's warm triad (G, its third, fifth and octave) dying away; an arrival
//   tick:      the metronome's click; a gear lever, a switch
// Each running one returns { g (its level, from 0), stop() }.

import { noise } from '../world/soundbus.js';

function held(ctx, out, nodes, g) {
	return {
		g,
		stop(after = 0.6) {
			g.gain.setTargetAtTime(0, ctx.currentTime, after / 4);
			setTimeout(() => { for (const n of nodes) { try { n.stop?.(); } catch { /* stopped */ } try { n.disconnect(); } catch { /* gone */ } } }, after * 1000 + 100);
		},
	};
}

export function cabinPad(ctx, out) {
	const g = ctx.createGain(); g.gain.value = 0; g.connect(out);
	const s = ctx.createBufferSource(); s.buffer = noise(ctx, 'brown'); s.loop = true;
	const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.8;
	const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
	const ng = ctx.createGain(); ng.gain.value = 0.32;
	s.connect(bp).connect(lp).connect(ng).connect(g); s.start(0, Math.random() * 3);
	const nodes = [s, bp, lp, ng, g];
	[110, 165].forEach((f, i) => {
		const o = ctx.createOscillator(), og = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
		o.frequency.value = f; og.gain.value = 0.06; l.frequency.value = 0.06 + i * 0.03; lg.gain.value = 0.04;
		l.connect(lg).connect(og.gain); o.connect(og).connect(g); o.start(); l.start();
		nodes.push(o, og, l, lg);
	});
	return held(ctx, out, nodes, g);
}

export function subHum(ctx, out) {
	const g = ctx.createGain(); g.gain.value = 0; g.connect(out);
	const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.connect(g);
	const a = ctx.createOscillator(), b = ctx.createOscillator();
	a.type = b.type = 'sawtooth'; a.frequency.value = 52; b.frequency.value = 55.5;
	a.connect(lp); b.connect(lp); a.start(); b.start();
	return held(ctx, out, [a, b, lp, g], g);
}

export function cityHum(ctx, out) {
	const g = ctx.createGain(); g.gain.value = 0; g.connect(out);
	const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 210; lp.connect(g);
	const a = ctx.createOscillator(), b = ctx.createOscillator();
	a.type = 'triangle'; a.frequency.value = 68; b.frequency.value = 91;
	a.connect(lp); b.connect(lp); a.start(); b.start();
	return held(ctx, out, [a, b, lp, g], g);
}

export function groan(ctx, out) {
	const g = ctx.createGain(); g.gain.value = 0; g.connect(out);
	const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain();
	o.frequency.value = 35; l.frequency.value = 0.18; lg.gain.value = 8;
	l.connect(lg).connect(o.frequency); o.connect(g); o.start(); l.start();
	return held(ctx, out, [o, l, lg, g], g);
}

// a one-off: the ceremony's triad at a level (the faceplate's own is 0.16; the world's far less)
export function chord(ctx, out, vol = 0.03, root = 196, dur = 1.3) {
	const t = ctx.currentTime, bus = ctx.createGain(), list = [bus];
	bus.gain.setValueAtTime(0.0001, t); bus.gain.exponentialRampToValueAtTime(vol, t + 0.05); bus.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	bus.connect(out);
	[1, 1.25, 1.5, 2].forEach((m, i) => {
		const o = ctx.createOscillator(), g = ctx.createGain();
		o.type = 'triangle'; o.frequency.value = root * m; g.gain.value = 0.25 * (i ? 0.8 : 1);
		o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
		list.push(o, g);
		if (!i) o.onended = () => { for (const n of list) try { n.disconnect(); } catch { /* gone */ } };
	});
}

// a one-off: the metronome's click, far quieter than the faceplate's (0.1)
export function tick(ctx, out, level = 0.01, hz = 1200) {
	const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
	o.type = 'square'; o.frequency.value = hz; lp.type = 'lowpass'; lp.frequency.value = 2400;
	g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
	o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 0.06);
	o.onended = () => { for (const n of [o, lp, g]) try { n.disconnect(); } catch { /* gone */ } };
}
