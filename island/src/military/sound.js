// The military's and the police's sounds, synthesised and played into the world's bus
// (world/soundbus.js, never straight to the speakers): the engines (a tank's turbine and the
// clatter of its tracks, a truck's or jeep's diesel, a jet's whine, roar and afterburner, a
// helicopter's blade slap: audio/engines.js), a cannon's report, a gun's rounds, and the police
// siren's two-tone wail. Each running sound is a few nodes, set each frame by how hard it works
// and how far away it is, and torn down when it stops.

import { soundBus, noise } from './../world/soundbus.js';
import { engineVoice, PHONE } from '../audio/engines.js';
import { budgetFor } from '../audio/engine-model.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a running engine of a kind: set(rpm 0..1, load 0..1, gain 0..1, speed m/s, where), stop().
// The engine itself is audio/engines.js's (the gears from the speed, a turbine's spool, the
// tracks, the rotor); given where it is ({ x, y, z, fx, fz (its nose), inside (your seat) }) it
// is placed in the world (distance, the air, Doppler, a building between) and gain only gates it.
export function engineSound(kind) {
	const e = engineVoice(kind, 2);
	let live = true;
	return {
		live: true,
		set(rpm, load, k = 1, speed = 0, where = null) {
			if (!live) return;
			const ab = kind === 'jet' ? clamp((rpm - 0.9) * 10, 0, 1) : 0;
			e.set({ rpm: clamp(rpm, 0, 1), throttle: clamp(load, 0, 1), speed, ab, k: where ? (k > 0 ? 1 : 0) : clamp(k, 0, 1), where });
		},
		stop() { if (live) { live = false; e.stop(); } },
	};
}

// a one-off: 'cannon', 'gun' (a burst's round), 'rocket', 'crash'. Only a few rounds ring at
// once (in a burst the ones still ringing cover the next); each a little different, and the
// farther it is (the lower k) the duller
const ROUNDS = budgetFor(PHONE).oneShots;
let rounds = 0;
export function oneShot(kind, k = 1) {
	const B = soundBus(), gun = kind === 'gun';
	if (!B || k <= 0.01 || (gun && rounds >= ROUNDS)) return;
	const c = B.ctx, t = c.currentTime, g = c.createGain(), n = c.createBufferSource(), f = c.createBiquadFilter();
	const vary = 0.9 + Math.random() * 0.2;
	n.buffer = noise(c, gun ? 'white' : 'brown'); n.playbackRate.value = vary;
	f.type = 'lowpass'; f.frequency.value = (gun ? 3000 : kind === 'cannon' ? 900 : 500) * (0.35 + 0.65 * k);
	const dur = gun ? 0.09 : kind === 'cannon' ? 1.4 : 1.8;
	g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((gun ? 0.35 : 0.9) * k, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	n.connect(f).connect(g).connect(B.out); n.start(t, Math.random() * 2); n.stop(t + dur + 0.1);
	const o = c.createOscillator(), og = c.createGain();
	o.frequency.setValueAtTime((gun ? 180 : 70) * vary, t); o.frequency.exponentialRampToValueAtTime(gun ? 60 : 24, t + dur * 0.6);
	og.gain.setValueAtTime((gun ? 0.2 : 0.7) * k, t); og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
	o.connect(og).connect(B.out); o.start(t); o.stop(t + dur);
	if (gun) rounds++;
	n.onended = () => { if (gun) rounds--; for (const x of [n, f, g, o, og]) try { x.disconnect(); } catch { /* gone */ } };
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
