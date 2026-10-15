// What breaking and building sound like, made on the spot (no samples): glass going (a
// crack's tick; a pane's crash, its shards ringing down after it), a wall breaking up (a crunch
// and the thuds of what falls), a building coming down (a long rumble under it all), the
// hand plant and landing of a vault, and a site's hammering. Each is placed by where it
// happens: quieter with distance, panned to its side, through the world's bus (soundbus.js).

import { soundBus, noise } from '../world/soundbus.js';

export function createStructureSounds(camera) {
	let last = 0;
	// the bus, the gain for a place (or null if too far or no sound yet), and its pan
	function at(p, reach = 220, k = 1) {
		const B = soundBus();
		if (!B) return null;
		const c = camera.position, dx = p.x - c.x, dy = (p.y ?? c.y) - c.y, dz = p.z - c.z, d = Math.hypot(dx, dy, dz);
		if (d > reach) return null;
		const g = k * Math.min(1, 9 / Math.max(3, d)) * (1 - d / reach * 0.6);
		const yaw = camera.rotation.y, rx = Math.cos(yaw), rz = -Math.sin(yaw);
		const pan = Math.max(-0.9, Math.min(0.9, (dx * rx + dz * rz) / Math.max(1, Math.hypot(dx, dz))));
		const ctx = B.ctx, out = ctx.createGain(), sp = ctx.createStereoPanner();
		out.gain.value = g; sp.pan.value = pan;
		out.connect(sp).connect(B.out);
		return { ctx, out, t: ctx.currentTime + 0.01, d };
	}
	// a burst of noise through a filter, with its envelope
	function burst(S, colour, type, freq, q, t0, attack, decay, gain) {
		const { ctx } = S, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		src.buffer = noise(ctx, colour); src.loop = true;
		f.type = type; f.frequency.value = freq; f.Q.value = q;
		g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
		src.connect(f).connect(g).connect(S.out);
		src.start(t0, Math.random() * 3); src.stop(t0 + attack + decay + 0.05);
		return f;
	}
	function tone(S, type, f0, f1, t0, decay, gain) {
		const { ctx } = S, o = ctx.createOscillator(), g = ctx.createGain();
		o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + decay);
		g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
		o.connect(g).connect(S.out); o.start(t0); o.stop(t0 + decay + 0.05);
	}
	// (a few at once at most: a blast breaks forty panes, and forty crashes would be a wall of noise)
	const room = () => { const now = performance.now(); if (now - last < 45) return false; last = now; return true; };
	return {
		crack(p) {
			const S = at(p, 90, 0.7); if (!S || !room()) return;
			burst(S, 'white', 'bandpass', 3200 + Math.random() * 1500, 4, S.t, 0.002, 0.05, 0.6);
			tone(S, 'triangle', 5200 + Math.random() * 1800, 4000, S.t, 0.08, 0.05);
		},
		glass(p, size = 1) {
			const S = at(p, 260, Math.min(1.4, 0.6 + size * 0.15)); if (!S || !room()) return;
			burst(S, 'white', 'highpass', 2600, 0.7, S.t, 0.003, 0.35 + size * 0.05, 0.9);
			burst(S, 'pink', 'bandpass', 900, 1.2, S.t, 0.004, 0.18, 0.5);
			// the shards ringing down onto the pavement after it
			const n = 8 + Math.min(14, size * 2);
			for (let i = 0; i < n; i++) {
				const t = S.t + 0.06 + Math.pow(Math.random(), 1.6) * (0.5 + size * 0.08);
				tone(S, Math.random() < 0.5 ? 'sine' : 'triangle', 2600 + Math.random() * 5200, 1800 + Math.random() * 2400, t, 0.05 + Math.random() * 0.12, 0.04 + Math.random() * 0.05);
				if (Math.random() < 0.4) burst(S, 'white', 'bandpass', 5000 + Math.random() * 3000, 6, t, 0.001, 0.03, 0.18);
			}
		},
		crumble(p, k = 1) {
			const S = at(p, 400, Math.min(1.6, 0.7 + k * 0.3)); if (!S || !room()) return;
			burst(S, 'brown', 'lowpass', 520, 0.6, S.t, 0.01, 0.9 + k * 0.6, 1.2);
			burst(S, 'pink', 'bandpass', 1400, 0.9, S.t, 0.004, 0.25, 0.5);
			for (let i = 0, n = 4 + Math.round(k * 6); i < n; i++) tone(S, 'sine', 90 + Math.random() * 60, 38, S.t + 0.1 + Math.random() * (0.8 + k * 0.5), 0.22, 0.35);
		},
		collapse(p, k = 1) {
			const S = at(p, 900, 1.6); if (!S) return;
			const f = burst(S, 'brown', 'lowpass', 900, 0.5, S.t, 0.25, 3.5 + k * 2.5, 1.6);
			f.frequency.exponentialRampToValueAtTime(160, S.t + 4 + k * 2);
			burst(S, 'pink', 'lowpass', 2200, 0.5, S.t + 0.2, 0.05, 1.4, 0.6);
			for (let i = 0; i < 18; i++) tone(S, 'sine', 70 + Math.random() * 50, 30, S.t + 0.2 + Math.random() * (3 + k * 2), 0.35, 0.45);
		},
		// a blow on a wall, by what it struck (structures/walls): drywall's papery crunch, stucco's
		// grit, wood's knock and crack, brick's dull thud, concrete's hard knock, a batt's soft
		// whump, a steel stud's ring. k: how hard; broke: something gave; hard: it did not give
		wall(p, m = 'drywall', k = 1, broke = false, hard = false) {
			const S = at(p, 120, Math.min(1.5, 0.45 + k * 0.35)); if (!S) return;
			const t = S.t, j = () => 0.85 + Math.random() * 0.3;
			if (m === 'drywall' || m === 'plaster' || m === 'paper') {
				burst(S, 'pink', 'bandpass', 1500 * j(), 0.9, t, 0.002, 0.07 + k * 0.03, 0.8);
				tone(S, 'sine', 150 * j(), 70, t, 0.09, hard ? 0.55 : 0.3);
				if (broke) for (let i = 0; i < 7; i++) burst(S, 'white', 'bandpass', 2500 + Math.random() * 3500, 3, t + 0.01 + Math.random() * 0.14, 0.001, 0.025, 0.35);
				if (broke) burst(S, 'pink', 'lowpass', 900, 0.7, t + 0.05, 0.02, 0.35, 0.25);
			} else if (m === 'stucco' || m === 'render') {
				burst(S, 'white', 'highpass', 2400 * j(), 0.8, t, 0.001, 0.05, 0.7);
				burst(S, 'pink', 'bandpass', 800 * j(), 1.2, t, 0.002, 0.1, 0.6);
				tone(S, 'sine', 120, 60, t, 0.07, 0.35);
				if (broke) for (let i = 0; i < 5; i++) burst(S, 'white', 'bandpass', 1800 + Math.random() * 2000, 2.5, t + 0.04 + Math.random() * 0.3, 0.002, 0.04, 0.3);
			} else if (m === 'osb' || m === 'plywood' || m === 'boards' || m === 'siding' || m === 'stud') {
				tone(S, 'triangle', 900 * j(), 480, t, 0.03, 0.4);
				tone(S, 'sine', 230 * j(), 150, t, 0.13, 0.55);
				burst(S, 'pink', 'bandpass', 1100, 2, t, 0.001, 0.05, 0.4);
				if (broke) { burst(S, 'white', 'bandpass', 2600, 4, t + 0.01, 0.001, 0.09, 0.6); tone(S, 'sawtooth', 320, 180, t + 0.02, 0.18, 0.08); }
			} else if (m === 'brick' || m === 'block') {
				tone(S, 'sine', 95 * j(), 50, t, 0.16, 0.7);
				burst(S, 'pink', 'bandpass', 650 * j(), 1, t, 0.003, 0.14, 0.6);
				if (broke) for (let i = 0; i < 4; i++) { const t2 = t + 0.12 + Math.random() * 0.5; tone(S, 'sine', 110 + Math.random() * 60, 50, t2, 0.12, 0.4); burst(S, 'pink', 'bandpass', 900, 1.4, t2, 0.002, 0.08, 0.3); }
			} else if (m === 'concrete') {
				tone(S, 'sine', 145 * j(), 80, t, 0.06, 0.6);
				burst(S, 'white', 'highpass', 3000, 0.7, t, 0.001, 0.04, 0.6);
				burst(S, 'pink', 'bandpass', 1200, 1, t, 0.002, 0.08, 0.4);
			} else if (m === 'batt' || m === 'rockwool' || m === 'air') {
				burst(S, 'pink', 'lowpass', 420, 0.6, t, 0.006, 0.12, 0.5);
			} else if (m === 'steel') {
				tone(S, 'triangle', 1350 * j(), 1300, t, 0.35, 0.18);
				tone(S, 'sine', 380, 360, t, 0.25, 0.25);
				burst(S, 'white', 'bandpass', 3000, 3, t, 0.001, 0.03, 0.4);
			} else burst(S, 'pink', 'bandpass', 900, 1, t, 0.002, 0.1, 0.6);
		},
		plant(p) { const S = at(p, 20, 0.6); if (!S) return; burst(S, 'pink', 'bandpass', 1600, 1.4, S.t, 0.01, 0.16, 0.5); tone(S, 'sine', 140, 70, S.t, 0.09, 0.25); },
		land(p, k = 1) { const S = at(p, 20, 0.5 + k * 0.3); if (!S) return; tone(S, 'sine', 110, 45, S.t, 0.16, 0.55); burst(S, 'brown', 'lowpass', 700, 0.7, S.t, 0.004, 0.18, 0.6); },
		hammer(p) { const S = at(p, 120, 0.5); if (!S) return; burst(S, 'white', 'bandpass', 1600 + Math.random() * 900, 9, S.t, 0.001, 0.05, 0.7); tone(S, 'triangle', 900 + Math.random() * 300, 600, S.t, 0.06, 0.12); },
		grind(p) { const S = at(p, 140, 0.35); if (!S) return; const f = burst(S, 'white', 'bandpass', 3000, 5, S.t, 0.08, 1.2, 0.35); f.frequency.linearRampToValueAtTime(4200, S.t + 1); },
		beep(p) { const S = at(p, 120, 0.3); if (!S) return; for (let i = 0; i < 3; i++) tone(S, 'square', 1250, 1240, S.t + i * 0.5, 0.25, 0.12); },
		loop: (kind) => loop(kind),
	};
	// a sound that goes on while something works (a site's own): the mixer's drum (a low churn
	// with the slop of the concrete going round in it), a crane's motor (the diesel under a
	// hydraulic whine that rises as it works), a truck's reversing beeper. set(p, k) each so often
	// with where it is and how hard it works (0 lets it fall silent); stop() lets its nodes go
	function loop(kind) {
		const B = soundBus();
		if (!B) return null;
		const ctx = B.ctx, out = ctx.createGain(), sp = ctx.createStereoPanner(), nodes = [];
		out.gain.value = 0; out.connect(sp).connect(B.out);
		const src = (colour, type, f, q, g) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gn = ctx.createGain(); s.buffer = noise(ctx, colour); s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; gn.gain.value = g; s.connect(fl).connect(gn).connect(out); s.start(ctx.currentTime, Math.random() * 3); nodes.push(s); return { fl, gn }; };
		const osc = (type, f, g, dest = out) => { const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = type; o.frequency.value = f; gn.gain.value = g; o.connect(gn).connect(dest); o.start(); nodes.push(o); return { o, gn }; };
		let reach = 90, work = null;
		if (kind === 'drum') {
			// (the churn, and the slop rising and falling as the drum turns)
			src('brown', 'lowpass', 160, 0.7, 1.6);
			const slop = src('pink', 'bandpass', 420, 1.1, 0.0);
			osc('sine', 0.45, 0.35, slop.gn.gain);
			osc('sawtooth', 42, 0.05);
		} else if (kind === 'crane') {
			src('brown', 'lowpass', 220, 0.8, 1.1);
			const whine = osc('sawtooth', 180, 0.0);
			const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; whine.gn.disconnect(); whine.gn.connect(f).connect(out);
			work = (k) => { whine.o.frequency.setTargetAtTime(150 + 160 * k, ctx.currentTime, 0.4); whine.gn.gain.setTargetAtTime(0.07 * k, ctx.currentTime, 0.3); };
			reach = 140;
		} else if (kind === 'beeper') {
			// (a square tone, on half a second and off half a second)
			const b = osc('square', 1180, 0.0);
			osc('square', 1, 0.5, b.gn.gain);
			b.gn.gain.value = 0.5;
			const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1180; f.Q.value = 3; b.gn.disconnect(); b.gn.connect(f).connect(out);
			reach = 110;
		}
		return {
			set(p, k = 1) {
				const c = camera.position, dx = p.x - c.x, dy = (p.y ?? c.y) - c.y, dz = p.z - c.z, d = Math.hypot(dx, dy, dz);
				const g = d > reach ? 0 : k * Math.min(1, 7 / Math.max(3, d)) * (1 - d / reach) * (kind === 'beeper' ? 0.18 : 0.32);
				const yaw = camera.rotation.y, rx = Math.cos(yaw), rz = -Math.sin(yaw);
				out.gain.setTargetAtTime(g, ctx.currentTime, 0.15);
				sp.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, (dx * rx + dz * rz) / Math.max(1, Math.hypot(dx, dz)))), ctx.currentTime, 0.15);
				if (work) work(k);
			},
			stop() {
				out.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
				const t = ctx.currentTime + 0.5;
				for (const n of nodes) { try { n.stop(t); } catch { /* already stopped */ } }
				setTimeout(() => { try { out.disconnect(); sp.disconnect(); } catch { /* gone */ } }, 800);
			},
		};
	}
}
