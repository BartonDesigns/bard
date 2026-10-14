// The sound of the overpasses: the ka-thunk of a deck's expansion joint as your car runs on
// or off it (front axle, then rear), and under a deck the muffled thuds of the traffic
// crossing its joints overhead, now and then, from above. Both are a low knock and a slap of
// tyre, made once, played through the world's bus (world/soundbus.js).

import { soundBus } from '../world/soundbus.js';

const WHEELBASE = 2.7;

export function createBridgeSound({ world, carAt }) {
	let buf = null, ctxOf = null, onDeck = false, next = 0, clock = 0;
	// the knock: a sine falling from 70 to 45 Hz over a tenth of a second, and a short burst of
	// filtered noise for the rubber on the steel
	function thump(ctx) {
		if (buf && ctxOf === ctx) return buf;
		const sr = ctx.sampleRate, n = Math.floor(sr * 0.35), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
		let ph = 0, lp = 0;
		for (let i = 0; i < n; i++) {
			const t = i / sr, f = 45 + 25 * Math.exp(-t * 30);
			ph += 2 * Math.PI * f / sr;
			lp += (Math.random() * 2 - 1 - lp) * 0.08;
			d[i] = Math.sin(ph) * Math.exp(-t * 14) * 0.9 + lp * Math.exp(-t * 60) * 1.6;
		}
		buf = b; ctxOf = ctx;
		return b;
	}
	// one knock at `when` seconds from now, this loud, through a low pass this bright
	function play(when, gain, bright) {
		const S = soundBus();
		if (!S) return;
		const src = S.ctx.createBufferSource(), g = S.ctx.createGain(), f = S.ctx.createBiquadFilter();
		src.buffer = thump(S.ctx); f.type = 'lowpass'; f.frequency.value = bright; g.gain.value = gain;
		src.connect(f).connect(g).connect(S.out);
		src.start(S.ctx.currentTime + when);
	}
	function update(dt) {
		clock += dt;
		const W = world(), F = W?.freeways, P = W?.player?.state;
		if (!F || !P) return;
		const car = carAt?.(), x = car ? car.x : P.pos.x, z = car ? car.z : P.pos.z, foot = car ? car.y : P.pos.y - 1.68;
		// on a deck or off it: a joint between, felt at speed
		const deck = F.floor(x, z, foot + 0.6), now = deck > -1e8 && Math.abs(deck - foot) < 0.8;
		if (car && now !== onDeck && car.speed > 4) { const k = Math.min(1, car.speed / 25); play(0, 0.35 * k, 900); play(WHEELBASE / car.speed, 0.3 * k, 800); }
		onDeck = now;
		// under one: the traffic overhead, a knock every second or two, dull through the deck
		const head = foot + 1.7, over = F.floor(x, z, head + 14);
		if (over > head && over < head + 14 && clock > next) {
			next = clock + 0.6 + Math.random() * 1.8;
			play(0, 0.12 + Math.random() * 0.1, 260);
			if (Math.random() < 0.8) play(0.09 + Math.random() * 0.05, 0.1, 240);
		}
	}
	return { update };
}
