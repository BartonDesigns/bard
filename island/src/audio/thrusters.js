// Your flight's thrusters, played through the cabin's way into the world's bus (soundbus.js
// cabinOut: under the world's volume, not faded by the air, so they carry on in space):
//   a hiss and a rumble that follow how hard you push (your speed on a log scale, and how fast
//     it is rising), the hiss brighter as you push harder
//   the burn heard after: a deep tail that lingers when you ease off
//   a kick when you step the booster up (a falling thump and a rising whoosh), a softer settle
//     when you step it down
//   in space the faceplate's cabin: its soft wind and two slow pads (palette.js cabinPad), and
//     in the far gears the abyss's deep wandering groan (palette.js groan)
//   a warp's long rising rush, and the faceplate's warm chord on arriving (palette.js chord)
// Everything is made when you take off and let go a few seconds after you land.

import { cabinOut, noise } from '../world/soundbus.js';
import { cabinPad, groan, chord } from './palette.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// how hard the thrusters work (0..1) for a speed (m/s), how fast it rises (m/s²), and the top
// speed it is heading for (log scales: ×1 near the ground to ×100,000 in space)
export function thrustOf(v, accel, top) {
	const lv = clamp(Math.log10(1 + v) / Math.log10(1 + Math.max(10, top)), 0, 1);
	const push = clamp(accel / (5 + v * 0.3), 0, 1);
	return clamp(0.12 + 0.5 * lv + 0.5 * push, 0, 1);
}

export function createThrusters() {
	let N = null, idle = 0, lastV = 0, lastBoost = 1, warping = false, burn = 0, thrust = 0;
	const info = { on: false, thrust: 0, burn: 0, space: false, kicks: 0, live: 0 };

	function make(B) {
		const ctx = B.ctx, nodes = [], out = ctx.createGain();
		out.gain.value = 0; out.connect(B.out); nodes.push(out);
		const loop = (colour, type, f, q) => {
			const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
			s.buffer = noise(ctx, colour); s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
			s.connect(fl).connect(g).connect(out); s.start(0, Math.random() * 3);
			nodes.push(s, fl, g);
			return { s, fl, g };
		};
		N = { ctx, out, nodes, B, hiss: loop('pink', 'highpass', 1200, 0.5), rumble: loop('brown', 'lowpass', 120, 0.7), tail: loop('brown', 'lowpass', 60, 0.5), rush: loop('pink', 'bandpass', 300, 1.2), pad: cabinPad(ctx, out), groan: groan(ctx, out) };
		info.live = nodes.length;
		out.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
	}
	function free() {
		if (!N) return;
		const n = N;
		N = null; info.live = 0;
		n.pad.stop(0.1); n.groan.stop(0.1);
		setTimeout(() => { for (const x of n.nodes) { try { x.stop?.(); } catch { /* stopped */ } try { x.disconnect(); } catch { /* gone */ } } }, 50);
	}
	// up: a falling thump and a rising whoosh; down: a short falling breath
	function kick(up) {
		const { ctx, out } = N, t = ctx.currentTime;
		const o = ctx.createOscillator(), og = ctx.createGain();
		o.frequency.setValueAtTime(up ? 80 : 60, t); o.frequency.exponentialRampToValueAtTime(up ? 32 : 40, t + 0.35);
		og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(up ? 0.14 : 0.07, t + 0.012); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
		o.connect(og).connect(out); o.start(t); o.stop(t + 0.45);
		const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
		s.buffer = noise(ctx, 'pink'); bp.type = 'bandpass'; bp.Q.value = 1.1;
		bp.frequency.setValueAtTime(up ? 300 : 1800, t); bp.frequency.exponentialRampToValueAtTime(up ? 2400 : 250, t + 0.5);
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(up ? 0.12 : 0.06, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.6);
		s.connect(bp).connect(g).connect(out); s.start(t, Math.random() * 3); s.stop(t + 0.65);
		info.kicks++;
		s.onended = () => { for (const x of [o, og, s, bp, g]) try { x.disconnect(); } catch { /* gone */ } };
	}

	// P: the player's state; orbit: space flight's (W.orbit), or null; o: { under, dt }
	function update(dt, P, orbit, o = {}) {
		const flying = !!P?.flying && !P.locked && !o.under;
		const B = cabinOut();
		if (!B) return info;
		if (N && N.B.out !== B.out) free();
		const v = P?.vel ? P.vel.length() : 0, accel = dt > 0 ? (v - lastV) / dt : 0;
		lastV = v;
		if (!flying) {
			if (N) { N.out.gain.setTargetAtTime(0, N.ctx.currentTime, 0.4); idle += dt; if (idle > 3) free(); }
			info.on = false; lastBoost = P?.boost ?? 1;
			return info;
		}
		idle = 0;
		if (!N) make(B);
		const ctx = N.ctx, t = ctx.currentTime;
		N.out.gain.setTargetAtTime(1, t, 0.3);
		const I = orbit?.info?.() || null, space = !!orbit?.space?.(), gear = I?.gear || 1;
		const top = (space ? 3000 : 40) * Math.max(1, gear);
		const want = thrustOf(v, accel, top);
		thrust += (want - thrust) * Math.min(1, dt * 4);
		burn += (thrust - burn) * Math.min(1, dt * (thrust > burn ? 0.8 : 0.15));
		const air = 1 - (orbit?.blend?.() || 0);
		// near the ground the wind is the louder part (environment.js); the thrusters sit under it
		const k = 0.45 + 0.55 * (1 - air);
		N.hiss.fl.frequency.setTargetAtTime(700 + thrust * 1800, t, 0.15);
		N.hiss.g.gain.setTargetAtTime(0.025 * thrust * k, t, 0.12);
		N.rumble.fl.frequency.setTargetAtTime(80 + thrust * 160, t, 0.2);
		N.rumble.g.gain.setTargetAtTime(0.1 * thrust * k, t, 0.15);
		N.tail.g.gain.setTargetAtTime(0.06 * clamp(burn - thrust * 0.6, 0, 1), t, 0.3);
		N.pad.g.gain.setTargetAtTime(space ? 0.06 : 0, t, 1.2);
		N.groan.g.gain.setTargetAtTime(space && gear > 50 ? 0.03 * clamp(Math.log10(gear) / 5, 0, 1) : 0, t, 1.5);
		// the booster stepped up or down
		const boost = P.boost ?? 1;
		if (boost !== lastBoost) kick((typeof boost === 'number' ? boost : 3) > (typeof lastBoost === 'number' ? lastBoost : 3));
		lastBoost = boost;
		// a warp: a long rising rush, and the chord on arrival
		const w = !!I?.warping, wt = I?.warpTime || 0;
		N.rush.fl.frequency.setTargetAtTime(w ? 300 + Math.min(1, wt / 3) * 2800 : 300, t, 0.3);
		N.rush.g.gain.setTargetAtTime(w ? 0.09 * Math.min(1, wt / 0.8) : 0, t, w ? 0.3 : 0.6);
		if (warping && !w) chord(ctx, N.out, 0.03);
		warping = w;
		info.on = true; info.thrust = +thrust.toFixed(2); info.burn = +burn.toFixed(2); info.space = space;
		return info;
	}
	return { update, info };
}
