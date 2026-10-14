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
		plant(p) { const S = at(p, 20, 0.6); if (!S) return; burst(S, 'pink', 'bandpass', 1600, 1.4, S.t, 0.01, 0.16, 0.5); tone(S, 'sine', 140, 70, S.t, 0.09, 0.25); },
		land(p, k = 1) { const S = at(p, 20, 0.5 + k * 0.3); if (!S) return; tone(S, 'sine', 110, 45, S.t, 0.16, 0.55); burst(S, 'brown', 'lowpass', 700, 0.7, S.t, 0.004, 0.18, 0.6); },
		hammer(p) { const S = at(p, 120, 0.5); if (!S) return; burst(S, 'white', 'bandpass', 1600 + Math.random() * 900, 9, S.t, 0.001, 0.05, 0.7); tone(S, 'triangle', 900 + Math.random() * 300, 600, S.t, 0.06, 0.12); },
		grind(p) { const S = at(p, 140, 0.35); if (!S) return; const f = burst(S, 'white', 'bandpass', 3000, 5, S.t, 0.08, 1.2, 0.35); f.frequency.linearRampToValueAtTime(4200, S.t + 1); },
		beep(p) { const S = at(p, 120, 0.3); if (!S) return; for (let i = 0; i < 3; i++) tone(S, 'square', 1250, 1240, S.t + i * 0.5, 0.25, 0.12); },
	};
}
