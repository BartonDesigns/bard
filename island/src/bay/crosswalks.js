// The crosswalks underfoot (realcity.js paints them): downtown and on the arterials the
// accessible signal at the curb, a slow locator tick while it says wait and a rapid tick for
// the walk, on a 40 s cycle of its own; and a crossing made properly, curb to curb inside the
// stripes, counts toward today's goal (gameplay/daily.js: note('street', { kind: 'crosswalk' })).

import { soundBus } from '../world/soundbus.js';

const CYCLE = 40, WALK = 9, HEAR = 16;

export function createCrosswalks({ world, note, driving }) {
	let tick = null, tickCtx = null, nextTick = 0, clock = 0, on = null, side = 0;
	// the tick: a click and a short ring at 880 Hz
	function sound(ctx) {
		if (tick && tickCtx === ctx) return tick;
		const sr = ctx.sampleRate, n = Math.floor(sr * 0.06), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
		for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 70) * 0.7 + (i < sr * 0.002 ? Math.random() * 2 - 1 : 0) * 0.6; }
		tick = b; tickCtx = ctx;
		return b;
	}
	function play(gain) {
		const S = soundBus();
		if (!S) return;
		const src = S.ctx.createBufferSource(), g = S.ctx.createGain();
		src.buffer = sound(S.ctx); g.gain.value = gain;
		src.connect(g).connect(S.out);
		src.start();
	}
	// where (x, z) is against a crosswalk: a along the leg from its middle, b across the street
	const frame = (c, x, z) => [(x - c.x) * c.ux + (z - c.z) * c.uz, (x - c.x) * -c.uz + (z - c.z) * c.ux];
	function update(dt) {
		clock += dt;
		const W = world(), P = W?.player?.state, list = W?.real?.crossings?.();
		if (!P || !list?.length || driving?.()) { on = null; return; }
		const x = P.pos.x, z = P.pos.z;
		let best = null, bd = HEAR;
		for (const c of list) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
		// the signal at the curb
		if (best?.city && clock >= nextTick) {
			const ph = (clock + (best.x * 0.37 + best.z * 0.11)) % CYCLE, walk = ph < WALK;
			play(0.22 * (1 - bd / HEAR) * (walk ? 1 : 0.7));
			nextTick = clock + (walk ? 0.1 : 1);
		}
		// a crossing: in the stripes from one curb to past the other
		if (best && bd < best.hw + 4) {
			const [a, b] = frame(best, x, z);
			if (Math.abs(a) > 2.6) { on = null; return; }
			if (on !== best) { on = best; side = Math.abs(b) > best.hw - 0.5 ? Math.sign(b) : 0; return; }
			if (side && Math.sign(b) === -side && Math.abs(b) > best.hw - 0.5) { note?.('street', { kind: 'crosswalk' }); side = Math.sign(b); }
		} else on = null;
	}
	return { update };
}
