// Who dances, and how: the music reaches the people round you (music/beat.js), and the
// closer they are the more they move to it. Everyone in earshot grooves (motion.js: the dip,
// the nod, the shoulders); someone standing about with nothing in hand gets up and dances
// (actions.js DANCES), their feet and hands on the counts, for a while, then goes on their
// way. The young and the outgoing move most; a child bounces; past seventy it is a sway.

import { ACTIONS, DANCE_NAMES } from './actions.js';

// metres: the music fills the near ring, and fades out by HEAR
export const NEAR = 12, HEAR = 38;
// the dance actions lead the beat a little: the action's own easing lags about this much
const LEAD = 0.07;
export const hearing = (d) => d < NEAR ? 1 : d > HEAR ? 0 : 1 - (d - NEAR) / (HEAR - NEAR);
const r01 = (seed, k) => { const x = Math.sin((seed + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
// how big a person moves to music (about 1)
export function moveSize(dna) {
	const T = dna.temper || { outgoing: 0.5, fidget: 0.5 }, age = dna.age || 30;
	let s = 0.55 + T.outgoing * 0.6 + (T.fidget || 0.5) * 0.25;
	if (age < 14) s += 0.35; else if (age < 25) s += 0.15; else if (age > 70) s *= 0.5; else if (age > 55) s *= 0.75;
	// (a few hardly move to music at all)
	if (r01(dna.seed || 0, 3) < 0.12) s *= 0.3;
	return Math.max(0.15, Math.min(1.6, s));
}
// whether this person is one who gets up and dances when they can
export const dancer = (dna) => r01(dna.seed || 0, 5) < ((dna.age || 30) > 70 ? 0.45 : 0.78);
// which dance: the outgoing throw their hands up or two-step, most bounce, elders sway
export function pickDance(dna, n = 0) {
	const T = dna.temper || { outgoing: 0.5 }, age = dna.age || 30, x = r01(dna.seed || 0, 11 + n * 7);
	let name;
	if (age > 70) name = x < 0.8 ? 'sway' : 'bounce';
	else if (age < 14) name = x < 0.5 ? 'bounce' : x < 0.8 ? 'handsup' : 'twostep';
	else if (T.outgoing > 0.65) name = x < 0.4 ? 'handsup' : x < 0.75 ? 'twostep' : 'bounce';
	else if (T.outgoing < 0.35) name = x < 0.55 ? 'sway' : x < 0.85 ? 'bounce' : 'twostep';
	else name = x < 0.45 ? 'bounce' : x < 0.75 ? 'twostep' : x < 0.9 ? 'sway' : 'handsup';
	const key = 'dance-' + name + (r01(dna.seed || 0, 13 + n) < 0.5 ? 'M' : '');
	return DANCE_NAMES.includes(key) ? key : DANCE_NAMES[0];
}
// how long a dance goes on (seconds)
export const danceFor = (dna, n = 0) => 18 + r01(dna.seed || 0, 17 + n) * 30 + ((dna.temper?.outgoing || 0.5) * 25);
// hold a dance on the beat: u runs over the dance's own count of beats
export function driveDance(M, name, B) {
	const A = ACTIONS[name];
	if (!A) return;
	const beats = A.beats || 4, u = (B.beat + LEAD) / beats;
	M.act(name, u - Math.floor(u));
}
// a person of the street (people.js): the groove for everyone in earshot, and a dance for
// whoever is standing about free. Returns true while they dance (they stay put for it).
export function moveToMusic(p, d, B, dt) {
	const M = p.M, S = M.S, k = B.on * hearing(d);
	if (p.size === undefined) p.size = moveSize(p.P.dna);
	M.groove(k, p.size);
	const free = p.role === 'wait' && !p.workSpot && !p.engaged && !p.override && !p.held && !p.partner && p.route?.kind !== 'seat' && p.route?.kind !== 'follow' && S.sitK.v < 0.1 && !p.P.ragdoll && !p.rod?.visible;
	if (p.dance) {
		p.dance.t += dt;
		if (k < 0.35 || !free || p.dance.t > p.dance.dur) { M.act(null); p.dance = null; p.danced = (p.danced || 0) + 1; p.danceRest = 20 + Math.random() * 40; return false; }
		driveDance(M, p.dance.name, B);
		if (p.dance.t < 0.5) M.feel('joy', 0.5);
		return true;
	}
	if (p.danceRest > 0) { p.danceRest -= dt; return false; }
	if (k > 0.6 && free && !S.act.name && S.gestures.length === 0 && (p.wantsDance ?? (p.wantsDance = dancer(p.P.dna)))) {
		const n = p.danced || 0;
		p.dance = { name: pickDance(p.P.dna, n), t: 0, dur: danceFor(p.P.dna, n) };
		return true;
	}
	return false;
}
