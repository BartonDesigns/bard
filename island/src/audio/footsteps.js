// Footsteps: yours, one for each footfall of the walk (player.js keeps the gait: its count
// goes up as each foot lands, at a cadence that follows your speed), and the people's near
// you (people.js hands their footfalls over). Quiet by default, under the music; each a
// little different in time, pitch and weight, left and right in turn. Nothing when you
// stand, jump, fly, swim, drive or play.

import { mix } from './acoustics.js';
import { STEP_VARIANTS } from './bank.js';

// how much of each surface goes into the room (soft ground hardly reaches the walls)
const SEND = { carpet: 0.3, sand: 0.3, grass: 0.35, snow: 0.5, dirt: 0.5 };

export function createFootsteps() {
	let last = null, landLast = 0, others = 0, v = 0, clock = 0;
	const D = { level: 0.055, steps: 0, interval: 0, lastAt: 0, cadence: 0, speed: 0, others: 0, peers: 0 };

	// one footfall: into the feet bus, panned, and a little into the room
	function play(A, buf, { gain, pan = 0, rate = 1, when = 0, send = 0.6 }) {
		const ctx = A.ctx, t = ctx.currentTime + when;
		const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
		s.buffer = buf; s.playbackRate.value = rate;
		g.gain.value = gain; p.pan.value = pan;
		s.connect(g).connect(p).connect(A.feet);
		if (send > 0) { const sg = ctx.createGain(); sg.gain.value = send; p.connect(sg).connect(A.send); s.onended = () => sg.disconnect(); }
		s.start(t);
	}
	// o: { P: the player's state, surface, busy (driving, a game, the boat), rain, indoor, under }
	function update(dt, o) {
		const A = mix(), P = o.P, G = P?.gait;
		clock += dt;
		if (!G) return D;
		D.speed = +(G.speed || 0).toFixed(2); D.cadence = +(G.rate || 0).toFixed(2);
		const stepNow = last !== null && G.count !== last, landNow = G.lands !== undefined && G.lands !== landLast;
		last = G.count; landLast = G.lands;
		const quiet = o.busy || P.flying || P.swimming || o.under || !A;
		if (quiet) return D;
		const surf = o.surface, wet = !o.indoor && (o.rain || 0) > 0.25 && surf !== 'water' && surf !== 'snow';
		const send = SEND[surf] ?? 0.65;
		if (stepNow && P.grounded) {
			// (the interval in the game's time: a slow frame rate does not stretch it)
			if (D.lastAt) D.interval = +(clock - D.lastAt).toFixed(3);
			D.lastAt = clock;
			D.steps++;
			v = (v + 1 + Math.floor(Math.random() * (STEP_VARIANTS - 1))) % STEP_VARIANTS;
			const run = !!G.run, left = G.foot === 0;
			// a touch louder running; each one a little different
			const gain = D.level * (run ? 1.3 : 1) * (0.82 + Math.random() * 0.3) * (left ? 1 : 0.92) * Math.min(1, 0.45 + G.speed / 3);
			const opts = { gain, pan: (left ? -0.12 : 0.12) + (Math.random() - 0.5) * 0.05, rate: 0.94 + Math.random() * 0.12, when: Math.random() * 0.018, send };
			play(A, A.B.step(surf, v, run), opts);
			// on a wet day the ground squelches a little too
			if (wet) play(A, A.B.step('water', v, run), { ...opts, gain: gain * 0.22, rate: opts.rate * 1.1 });
		}
		if (landNow && P.grounded) play(A, A.B.land(surf), { gain: D.level * 1.2 * Math.min(1.4, 0.5 + (G.impact || 4) / 10), send });
		return D;
	}
	// the people's footfalls near you: { x, z, k } each; a few at most, on the ground you are on
	function people(dt, list, cam, surf, indoor) {
		const A = mix();
		others = Math.max(0, others - dt * 8);
		D.peers = 0;
		if (!A || !list) return;
		const x = cam.position.x, z = cam.position.z, e = cam.matrixWorld.elements, fl = Math.hypot(e[8], e[10]) || 1, fx = -e[8] / fl, fz = -e[10] / fl;
		for (const s of list) {
			const dx = s.x - x, dz = s.z - z, d = Math.hypot(dx, dz);
			if (d > 16 || others > 6) continue;
			others += 1;
			D.peers++;
			const gain = D.level * 0.45 * (s.k || 1) / (1 + (d / 3.5) ** 2);
			if (gain < 0.001) continue;
			const pan = Math.max(-0.8, Math.min(0.8, (fz * dx - fx * dz) / (d + 2) * -1));
			play(A, A.B.step(surf, Math.floor(Math.random() * STEP_VARIANTS), false), { gain, pan, rate: 0.95 + Math.random() * 0.12, when: Math.random() * 0.02, send: indoor ? 0.9 : 0.6 });
		}
		D.others = +others.toFixed(1);
	}
	return { update, people, info: D };
}
