// What a round does to a person beyond the hit points it takes, by where it landed
// (combat/hitzones.js): how they react (one of a few ways for each place, picked at random, on
// the side it struck: hit in the shoulder, they are spun by it, a hand goes to it and they hunch
// over it), how long it puts them off their aim, and what it leaves. A leg wound slows them and
// puts a limp in their walk on that side; enough of it and the leg will not hold them: they go
// down on that knee and stay there. A round to centre mass hits hardest of all short of the head:
// it knocks them back a step or drops them to their knees, and they are slow to fire again.
//
// createWounds() per person; react(W, M, blow, r, opts) lays the reaction on their motion
// (people/motion.js) and returns what the fighting code should do (a stagger to walk, a pause).

import { ACTIONS } from '../people/actions.js';
import { wound } from './hitzones.js';

// how each place reacts: the hurt actions (people/actions.js) and their lengths in seconds
const REACT = {
	head: [['head1', 1.1], ['head2', 1.0]],
	neck: [['head1', 1.2], ['head2', 1.1]],
	chest: [['chest1', 1.0], ['chest2', 1.5], ['chest3', 1.1]],
	gut: [['gut1', 1.3], ['gut2', 1.7]],
	shoulder: [['shoulder1', 1.4], ['shoulder2', 1.3]],
	arm: [['arm1', 0.9], ['shoulder1', 1.2]],
	leg: [['leg1', 1.5], ['leg2', 1.0]],
};
// a leg this hurt (summed over both, in shares of the body's health) limps; this much cripples
export const LIMP_AT = 0.08, CRIPPLE_AT = 0.4;

export function createWounds() { return { legs: { L: 0, R: 0 }, crippled: null, chest: 0, last: null }; }

// how fast they can still move: 1 whole, down to 0.35 on a bad leg, and no running past a limp
export function pace(W) {
	if (!W) return { k: 1, run: true, limp: 0, side: null };
	if (W.crippled) return { k: 0, run: false, limp: 1, side: W.crippled };
	const L = W.legs.L, R = W.legs.R, sum = L + R;
	const limp = Math.min(1, Math.max(0, (sum - LIMP_AT * 0.5) / (CRIPPLE_AT * 0.7)));
	return { k: 1 - 0.65 * limp, run: sum < LIMP_AT * 2, limp, side: sum <= 0 ? null : L >= R ? 'L' : 'R' };
}

const pick = (a, rand) => a[Math.floor(rand() * a.length) % a.length];

// a round taken: blow { part, side, dir, shape, at }, r what it dealt (health.js applyDamage),
// opts { max (their health), armed, heading, rand }. Returns { name, dur, stagger: metres back,
// hold: seconds off their aim, crippled: true the moment the leg gives }
export function react(W, M, P, blow, r, { max = 100, armed = false, clutch = true, rand = Math.random } = {}) {
	if (!W || !M || !r || !(r.dealt > 0) || r.killed || r.downed || blow.melee) return null;
	const part = REACT[blow.part] ? blow.part : blow.part === 'torso' ? 'chest' : blow.part === 'limb' ? 'leg' : null;
	if (!part) return null;
	const k = r.dealt / Math.max(1, max);
	// (which side it struck: the limb's own, or for the body which side of the middle it went in)
	let side = blow.side;
	if (!side) {
		const d = blow.dir, h = M.S.heading;
		side = d ? ((d.x * Math.cos(h) - d.z * Math.sin(h)) > 0 ? 'R' : 'L') : rand() < 0.5 ? 'L' : 'R';
		if (rand() < 0.25) side = side === 'L' ? 'R' : 'L';
	}
	const out = { part, side, name: null, dur: 0, stagger: 0, hold: 0.4 + k * 2, crippled: false };
	if (part === 'leg') {
		W.legs[side] += k;
		if (!W.crippled && W.legs.L + W.legs.R >= CRIPPLE_AT) { W.crippled = side; out.crippled = true; }
	}
	if (part === 'chest') { W.chest += k; out.stagger = Math.min(1.1, 0.35 + k * 3); out.hold += 0.5; }
	if (part === 'head' || part === 'neck') out.stagger = 0.3;
	// a graze reacts small and quick; a hard one, the whole of it
	const light = k < 0.06;
	let [name, dur] = pick(REACT[part], rand);
	if (light) { name = part === 'leg' ? 'leg2' : part === 'chest' || part === 'gut' ? 'gut1' : part === 'head' || part === 'neck' ? 'head2' : 'arm1'; dur = 0.6; out.stagger *= 0.4; }
	if (W.crippled) name = 'crippled';
	dur *= 0.85 + rand() * 0.35;
	const full = `hurt-${name}${side}${armed ? '+' : ''}`;
	if (!ACTIONS[full]) return out;
	out.name = full; out.dur = dur;
	if (name === 'crippled') M.act(full, 0); else M.play(full, dur, true);
	// a hand to it: the support hand if they hold a gun (it can reach all but its own arm), else
	// the other hand, or for the body and the legs either
	const hand = armed ? 'L' : part === 'shoulder' || part === 'arm' ? (side === 'L' ? 'R' : 'L') : part === 'leg' ? side : rand() < 0.5 ? 'L' : 'R';
	const reachable = !(hand === side && (part === 'shoulder' || part === 'arm'));
	const Wd = reachable && blow.shape && blow.at ? wound(P, blow.shape, blow.at) : null;
	if (Wd && !light && clutch) {
		const s = blow.shape;
		M.S.clutch = { side: hand, bone: Wd.bone, local: Wd.local, a: wound(P, s, s.a).local, b: wound(P, s, s.b).local, across: part !== 'arm' && part !== 'leg', t: 0, dur: name === 'crippled' ? 2.4 : Math.max(0.6, dur * (part === 'head' || part === 'neck' ? 0.7 : 0.92)) };
	}
	W.last = out;
	return out;
}
