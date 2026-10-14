// Who someone is when nobody is asking: a disposition on the compass's four axes (each -1
// bad .. +1 good) and a few traits, grown from their seed so the same person is the same
// every time, then leaned on by where they live and what they have done:
//   region     their region's tally (combat/morality.js createCommons), the strongest pull
//   world      the whole world's tally, a lighter one
//   situation  their town's trouble and means (people/moral-regions.js)
//   standing   their own deeds so far: people become what they do
//   wealth     -1 broke .. +1 well off (the bank's balance, people/npc-money.js): the desperate are tempted more
// Most people are decent most of the time; a few are not. Pure and cheap: a handful of
// numbers per person, worked out when they are needed.

import { AXES } from '../combat/morality.js';

const rng = (seed) => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const r2 = (v) => Math.round(v * 100) / 100;
const lean = (T, a, k) => ((T?.[a] || 0) / 100) * k;

export function disposition(seed, { region = null, world = null, situation = null, standing = null, wealth = 0 } = {}) {
	const r = rng((seed ^ 0xd15b0) >>> 0);
	// one general goodness shared by the axes, and each axis its own (a bell, not flat)
	const g = (r() + r() - 1) * 0.6 + 0.18;
	const trouble = situation?.trouble ?? 0.3, means = situation?.means ?? 0.5, w = clamp(wealth);
	const out = {};
	for (const a of AXES) {
		const own = (r() + r() + r()) / 1.5 - 1;
		let v = 0.55 * own + g + lean(region, a, 0.35) + lean(world, a, 0.2) + lean(standing, a, 0.6);
		if (a === 'law') v += 0.1 - 0.3 * trouble;
		if (a === 'honest') v += -0.2 * (trouble - 0.3) + 0.12 * Math.min(0, w);
		out[a] = r2(clamp(v));
	}
	const good = r2((out.mercy + out.law + out.protect + out.honest) / 4);
	// greed: what a bag left alone or a parcel in the hand says to them
	const greed = r2(clamp(0.32 + (r() - 0.5) * 0.4 - 0.22 * out.honest + 0.2 * (trouble - 0.3) - 0.1 * (means - 0.5) - 0.2 * w, 0, 1));
	const nerve = r2(r());
	const reliable = r2(clamp(0.55 + 0.25 * out.law + 0.2 * (r() - 0.5), 0, 1));
	const pace = r2(0.85 + r() * 0.35);
	return { ...out, good, greed, nerve, reliable, pace };
}

// a word for it, for the debug view and the docs
export function temperOf(d) {
	if (d.good > 0.45) return 'kind';
	if (d.good > 0.15) return 'decent';
	if (d.good > -0.15) return d.greed > 0.5 ? 'tempted' : 'ordinary';
	if (d.good > -0.45) return 'shady';
	return 'crooked';
}

// faced with something to do for someone (tempt 0 .. 1: how easy it would be to keep it):
// 'help' (do it honestly), 'betray' (take it and go) or 'pass' (not their business).
// roll: 0 .. 1, from the caller's own dice so the tests can pin it
export function chooseDeed(d, tempt = 0.5, roll = Math.random()) {
	const pBetray = clamp(tempt * (0.12 + d.greed * 0.9 - d.honest * 0.45 - d.law * 0.25), 0, 0.95);
	const helpful = clamp(0.3 + 0.35 * d.protect + 0.25 * d.mercy + 0.2 * d.honest, 0, 0.95);
	const pHelp = helpful * (1 - pBetray);
	return roll < pBetray ? 'betray' : roll < pBetray + pHelp ? 'help' : 'pass';
}
// once they have said yes: do they see it through? (roll as above)
export function followThrough(d, roll = Math.random()) {
	return roll < 0.6 + d.reliable * 0.38 ? 'done' : 'abandon';
}
