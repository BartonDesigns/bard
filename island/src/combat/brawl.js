// Fists, shoves and grapples, and how a quarrel grows into a fight. Pure rules (no three, no
// DOM): combat/melee.js runs them for you and for the townsfolk.
//
// The blows: a jab, a cross, a hook (a three-punch string), a shove that knocks back, a grapple
// that holds and throws, a swing of a bat or a bottle if one is at hand. A quarrel climbs a
// ladder: words, then a shove, then fists, then whatever is to hand, and among the armed
// (gangs) it can end in guns, when the squads take over. Each step depends on temper, on how
// hard the last blow was and on whether friends are near; most quarrels cool off at words or
// a shove. Minors are never part of it: never a target, never a brawler (combat/targets.js).

import { isMinor } from './targets.js';

export const BLOWS = Object.freeze({
	jab: { dmg: 6, reach: 1.3, time: 0.32, knock: 0.6, stamina: 6 },
	cross: { dmg: 9, reach: 1.35, time: 0.42, knock: 1.0, stamina: 9 },
	hook: { dmg: 12, reach: 1.25, time: 0.55, knock: 1.6, stamina: 12 },
	shove: { dmg: 2, reach: 1.4, time: 0.45, knock: 3.4, stamina: 8 },
	grapple: { dmg: 4, reach: 1.1, time: 1.1, knock: 4.5, stamina: 18, hold: true },
	bat: { dmg: 22, reach: 1.9, time: 0.7, knock: 2.6, stamina: 16, item: true },
	bottle: { dmg: 15, reach: 1.4, time: 0.5, knock: 1.4, stamina: 10, item: true, breaks: true },
});
export const COMBO = ['jab', 'cross', 'hook'];
// the next blow of a string: the one after the last, if it came soon enough
export function nextBlow(last, since) { if (!last || since > 0.9) return 'jab'; const i = COMBO.indexOf(last); return i < 0 ? 'jab' : COMBO[(i + 1) % COMBO.length]; }

// ladder of a quarrel
export const STAGES = ['calm', 'words', 'shove', 'fists', 'weapon', 'guns'];
export const stageIndex = (s) => Math.max(0, STAGES.indexOf(s));

// may this one be struck in a brawl, or join one? Never a minor, never someone who has given up
// or is held, never the dead
export function canMelee(T) {
	if (!T) return false;
	if (T.child || isMinor(T) || (T.P && isMinor(T.P))) return false;
	if (T.surrendered || T.restrained || T.dead || T.removed) return false;
	return true;
}
export const canBrawl = (p) => !!p && !isMinor(p.P || p) && !p.P?.restrained && !p.P?.ragdoll;

// one step up the ladder, or down: q { stage, heat (0..1), temper (0..1), armed (gang), friends,
// blow (the last blow's dmg, 0 for none), t (seconds at this stage) }. r: a random 0..1.
// Returns the new stage.
export function escalate(q, r = Math.random) {
	const i = stageIndex(q.stage);
	if (i === 0) return q.heat > 0.3 ? 'words' : 'calm';
	// cooling: words and shoves often fizzle out when nobody pushes it
	if (!q.blow && q.t > 6 && i <= 2 && r() < 0.5 * (1 - q.temper)) return STAGES[i - 1];
	let up = 0.08 + q.temper * 0.3 + q.heat * 0.3 + Math.min(0.3, (q.blow || 0) / 40) + Math.min(0.2, (q.friends || 0) * 0.07);
	// a weapon is drawn only by the angry, guns only among the armed
	if (i === 3) up *= q.temper > 0.45 || (q.blow || 0) > 10 ? 0.7 : 0.15;
	if (i === 4) up = q.armed ? up * 0.45 : 0;
	if (i >= 5) return 'guns';
	return r() < up ? STAGES[i + 1] : STAGES[i];
}
// what a brawler reaches for at the weapon stage: a bat or a bottle if one is at hand
export function improvised(atHand, r = Math.random) {
	if (atHand === 'bat' || atHand === 'bottle') return atHand;
	const x = r();
	return x < 0.35 ? 'bottle' : x < 0.55 ? 'bat' : null;
}
// damage of a blow, by stamina (tired fists hit softer) and a lucky clean one
export function blowDamage(kind, stamina = 100, clean = false) {
	const B = BLOWS[kind];
	if (!B) return 0;
	return B.dmg * (0.55 + 0.45 * Math.max(0, Math.min(1, stamina / 100))) * (clean ? 1.5 : 1);
}
// who answers a fight in the street: the police, and the military if it turns into gunfire
// among gangs (combat/combat.js passes these on to military/)
export function brawlResponse(stage, deaths = 0) {
	const i = stageIndex(stage);
	return { police: i >= 3, military: i >= 5 && deaths >= 2, severity: i >= 5 ? 2 + (deaths >= 4 ? 1 : 0) : 1 };
}
