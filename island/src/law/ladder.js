// The escalation ladder: how trouble you make reaches the police, how hard they come, and how
// it ends. Pure rules (no three, no DOM); law/index.js runs them against the fight (combat/),
// the cruisers (military/police.js) and the bases (military/dispatch.js).
//
// Grounded, not arcade: nothing happens until somebody tells. A crime an officer sees counts
// at once; one a passer-by sees is phoned in after a while (longer for a quiet theft than for
// gunfire, sooner when several saw it); one nobody saw is nobody's business. Gunfire only
// heard is reported as shots fired at a place, with no description of you. The wanted level
// (combat/heat.js points and stars) then says who comes:
//
//   1 reported   one patrol car to look into it; officers close in to arrest, guns holstered
//   2 pursuit    two cars; officers draw on you if you are armed or have fired
//   3 backup     more cars, and a roadblock across the road ahead of you
//   4 tactical   the tactical team in its van from the police quarters, a second roadblock
//   5 military   only at the very top: the nearest base sends a convoy and a helicopter
//
// Boss fights and invasions go to the military whatever the level; a gang war goes to the
// police first and to the military only when it is a war (severity 3). De-escalation: out of
// their sight the police head for where you were last seen and search there; after a while
// (longer the hotter it was) the points ebb a star at a time, and at nothing every unit goes
// back to its station or base. Surrender (unarmed, standing still, hands up) or being downed
// with officers near ends it in an arrest: booked at the station and fined.

import { clamp } from '../noise.js';

export const LEVELS = Object.freeze(['calm', 'reported', 'pursuit', 'backup', 'tactical', 'military']);

// what a passer-by calls it, from the fight's offence kinds (combat/heat.js OFFENCE)
export const CALL_KIND = Object.freeze({ shots: 'shots', hitCivilian: 'assault', downCivilian: 'assault', hitPolice: 'officer', downPolice: 'officer', car: 'arson', prop: 'damage', vandalism: 'damage', robbery: 'robbery', gang: 'gang', brawl: 'fight', defence: 'defence' });
// how long the call takes, in seconds (the first witness reaching for a phone, the call taken)
const DELAY = { shots: [5, 12], assault: [9, 20], robbery: [12, 26], arson: [8, 18], damage: [20, 40], gang: [10, 24], fight: [12, 28], defence: [4, 10], officer: [0, 0] };
export function reportDelay(call, witnesses = 1, r = Math.random) {
	const [a, b] = DELAY[call] || [12, 25];
	return (a + r() * (b - a)) / Math.sqrt(clamp(witnesses, 1, 4));
}

export function createLadder() { return { reports: [], seq: 0, due: [] }; }

// a crime seen (or heard): o { kind (an offence kind), at { x, z }, t (seconds now), police
// (an officer saw it, or was its victim), witnesses (passers-by who saw it), heard (gunfire
// heard but not seen) }. Returns 'now' (count it at once), 'later' (a call is on its way) or
// null (nobody saw it). Several witnesses of one crime make one call, sooner.
export function witness(L, o, r = Math.random) {
	const call = CALL_KIND[o.kind] || 'assault';
	if (o.police || call === 'officer') return 'now';
	const n = o.witnesses | 0;
	if (!n && !(o.heard && (call === 'shots' || call === 'gang' || call === 'defence'))) return null;
	for (const q of L.reports) {
		if (q.done || q.call !== call || Math.hypot(q.at.x - o.at.x, q.at.z - o.at.z) > 60) continue;
		q.weight = Math.min(4, q.weight + 1);
		q.due = Math.max(o.t + 0.5, q.due - 2);
		if (n) q.seen = true;
		q.severity = Math.max(q.severity, o.severity || 1);
		if (o.ev) q.ev = o.ev;
		if (o.kind !== q.kind && (OFFENCE_RANK[o.kind] || 0) > (OFFENCE_RANK[q.kind] || 0)) q.kind = o.kind;
		return 'later';
	}
	L.reports.push({ id: ++L.seq, kind: o.kind, call, at: { x: o.at.x, z: o.at.z }, t: o.t, due: o.t + reportDelay(call, n || 1, r), weight: 1, seen: n > 0, severity: o.severity || 1, ev: o.ev || null, done: false });
	return 'later';
}
// (a worse offence folded into a pending call takes its place)
const OFFENCE_RANK = { prop: 1, vandalism: 1.5, shots: 2, robbery: 3, hitCivilian: 4, car: 5, downCivilian: 6, gang: 2 };

// Property: one window broken or a crate knocked over is not a police matter (a stray round, a
// stumble, the wreckage of a fight). Smashing things on purpose is: the third thing of someone
// else's you break within half a minute in one place makes it vandalism, and each one after
// that, while the spree lasts, adds to it.
export const SPREE = Object.freeze({ count: 3, window: 30, r: 40 });
export function createDamageLog() { return { hits: [], spreeT: -999 }; }
// a thing you broke at t, at { x, z }: null (nobody calls that in), 'vandalism' (it has just
// become a spree) or 'prop' (more of the same spree)
export function smashed(D, at, t) {
	D.hits = D.hits.filter((h) => t - h.t < SPREE.window);
	if (D.hits.length >= 16) D.hits.shift();
	D.hits.push({ t, x: at.x, z: at.z });
	let n = 0;
	for (const h of D.hits) if (Math.hypot(h.x - at.x, h.z - at.z) < SPREE.r) n++;
	if (n < SPREE.count) return null;
	const more = t - D.spreeT < SPREE.window;
	D.spreeT = t;
	return more ? 'prop' : 'vandalism';
}

// the calls through by now (the same array each time: copy it to keep it)
export function dueReports(L, t) {
	L.due.length = 0;
	for (const q of L.reports) if (!q.done && q.due <= t) { q.done = true; L.due.push(q); }
	if (L.reports.length > 12 || L.due.length) L.reports = L.reports.filter((q) => !q.done || t - q.due < 30);
	return L.due;
}
export const pending = (L) => L.reports.filter((q) => !q.done).length;

// who comes, at a level. lethal: officers may fire on you; holster: they close in to arrest
export function responsePlan(level, { phone = false, armed = false, fired = false } = {}) {
	const L = clamp(level | 0, 0, 5);
	const P = [
		{ cars: 0, swat: 0, blocks: 0, military: null },
		{ cars: 1, swat: 0, blocks: 0, military: null },
		{ cars: 2, swat: 0, blocks: 0, military: null },
		{ cars: 3, swat: 0, blocks: 1, military: null },
		{ cars: 3, swat: 1, blocks: 2, military: null },
		{ cars: 4, swat: 1, blocks: 2, military: 'convoy' },
	][L];
	const out = { level: L, stage: LEVELS[L], ...P, officers: 2, swatSize: phone ? 3 : 4 };
	if (phone) { out.cars = Math.min(2, out.cars); out.blocks = Math.min(1, out.blocks); }
	out.lethal = L > 0 && (fired || (armed && L >= 2) || L >= 4);
	out.arrest = L > 0 && L < 5;
	return out;
}
// what a reported trouble draws: the police, their tactical team, or the military
export function routeTrouble(e) {
	const sev = e.severity || 1;
	if (e.kind === 'boss' || e.kind === 'invasion' || e.kind === 'riot') return 'military';
	if (e.kind === 'wanted') return sev >= 3 ? 'military' : 'police';
	if (e.kind === 'gang') return sev >= 3 ? 'military' : sev >= 2 ? 'swat' : 'police';
	return 'police';
}

// how long out of their sight before the points start to ebb, by stars (they search first)
export const SEARCH = Object.freeze([0, 18, 25, 35, 50, 75]);

// giving up: unarmed, standing still near an officer for a few seconds, or hands up (H)
export function complying({ armed = false, speed = 0, stillT = 0, officerD = Infinity, handsUp = false } = {}) {
	if (officerD > 30) return false;
	if (handsUp && !armed) return true;
	return !armed && speed < 0.5 && stillT >= 3;
}
// an arrest: given up, or downed, with an officer near and the police after you
export function arrestable({ level = 0, downed = false, complies = false, officerD = Infinity } = {}) {
	return level > 0 && officerD < (downed ? 45 : 30) && (downed || complies);
}
// the fine at booking: by the worst the matter reached and what is left of it
export function fineFor({ points = 0, peak = 0, resisted = false } = {}) {
	const n = 60 * Math.max(1, peak) + points * 3 + (resisted ? 150 : 0);
	return Math.min(5000, Math.round(n / 10) * 10);
}

// a search round where you were last seen: n points on a ring, a little off the line between
export function searchLoop(c, r = 22, n = 4, phase = 0) {
	const out = [];
	for (let i = 0; i < n; i++) { const a = phase + (i / n) * Math.PI * 2; out.push([c.x + Math.cos(a) * r, c.z + Math.sin(a) * r]); }
	return out;
}
