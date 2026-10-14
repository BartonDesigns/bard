// Close combat, the rules: the timing of every strike (wind-up, the moment it lands, the
// recovery), light strings and charged heavies, blocking and the parry window, the dodge's
// moment of grace, who may take a turn at you when several square up, the takedown from
// behind, which way a blow knocks someone and how hard, an arrest by the police, and which
// deed a fight counts as. Pure numbers and functions (no three, no DOM): combat/melee.js,
// combat/melee-foes.js and the tests read them, and the feel is tuned here in one place.

// ---------- the strikes ----------
// wind: seconds from the press to the blow (the tell), active: how long it can land, recover:
// how long until the next is free; chain: from this far into the recovery a press is kept for
// the next strike of the string. dmg at full stamina; reach in metres; arc: the cosine of the
// half-angle in front it can land in; knock: how hard it shoves; stagger: how long it rocks a
// fighter whose poise it beats (seconds); part: where it tends to land.
export const MOVES = Object.freeze({
	jab: { kind: 'light', wind: 0.06, active: 0.07, recover: 0.17, chain: 0.05, dmg: 8, reach: 1.4, arc: 0.6, knock: 0.6, stagger: 0.22, part: 'head', anim: 'jab' },
	cross: { kind: 'light', wind: 0.09, active: 0.07, recover: 0.2, chain: 0.06, dmg: 11, reach: 1.45, arc: 0.6, knock: 1.0, stagger: 0.32, part: 'head', anim: 'cross' },
	hook: { kind: 'light', wind: 0.13, active: 0.08, recover: 0.27, chain: 0.08, dmg: 14, reach: 1.3, arc: 0.4, knock: 1.7, stagger: 0.5, part: 'head', anim: 'hook' },
	heavy: { kind: 'heavy', wind: 0.3, active: 0.1, recover: 0.42, chain: 0.12, dmg: 24, reach: 1.5, arc: 0.55, knock: 3.6, stagger: 0.9, part: 'torso', anim: 'haymaker', breaks: true },
	// with something in hand: a level swing, and an overhead with the weight behind it
	bat: { kind: 'light', wind: 0.16, active: 0.1, recover: 0.36, chain: 0.1, dmg: 20, reach: 1.95, arc: 0.3, knock: 2.6, stagger: 0.6, part: 'torso', anim: 'swing', item: 'bat' },
	batHeavy: { kind: 'heavy', wind: 0.38, active: 0.12, recover: 0.5, chain: 0.12, dmg: 34, reach: 2.0, arc: 0.6, knock: 4.2, stagger: 1.0, part: 'head', anim: 'overhead', item: 'bat', breaks: true },
	pipe: { kind: 'light', wind: 0.15, active: 0.1, recover: 0.34, chain: 0.1, dmg: 19, reach: 1.85, arc: 0.3, knock: 2.4, stagger: 0.6, part: 'torso', anim: 'swing', item: 'pipe' },
	pipeHeavy: { kind: 'heavy', wind: 0.36, active: 0.12, recover: 0.48, chain: 0.12, dmg: 32, reach: 1.9, arc: 0.6, knock: 4.0, stagger: 1.0, part: 'head', anim: 'overhead', item: 'pipe', breaks: true },
	bottle: { kind: 'light', wind: 0.12, active: 0.08, recover: 0.28, chain: 0.08, dmg: 15, reach: 1.45, arc: 0.45, knock: 1.4, stagger: 0.45, part: 'head', anim: 'swing', item: 'bottle', shatters: true },
	bottleHeavy: { kind: 'heavy', wind: 0.3, active: 0.1, recover: 0.4, chain: 0.1, dmg: 22, reach: 1.5, arc: 0.55, knock: 2.2, stagger: 0.7, part: 'head', anim: 'overhead', item: 'bottle', shatters: true, breaks: true },
});
export const STRING = ['jab', 'cross', 'hook'];
export const moveTime = (m) => m.wind + m.active + m.recover;

// where a strike is at time t since it began
export function phaseAt(m, t) {
	if (t < m.wind) return 'wind';
	if (t < m.wind + m.active) return 'active';
	if (t < m.wind + m.active + m.recover) return 'recover';
	return 'done';
}
// may a press at time t into m be kept for the next strike (the string's rhythm)?
export function canBuffer(m, t) { return t >= m.wind + m.active - m.chain; }
// may the next strike start now (the buffered one fires as soon as this is true)?
export function canFollow(m, t) { return t >= m.wind + m.active + m.recover * 0.55; }

// the next light strike: the string goes on if the last one was recent, the item's swing with
// something in hand
export function nextLight(last, since, item = null) {
	if (item) return item;
	if (!last || since > 0.75) return 'jab';
	const i = STRING.indexOf(last);
	return i < 0 ? 'jab' : STRING[(i + 1) % STRING.length];
}
export const heavyOf = (item) => (item ? item + 'Heavy' : 'heavy');

// held this long, the press is a heavy rather than a light one
export const HEAVY_HOLD = 0.22;
// how much a heavy has been charged by a hold of `held` seconds (0 just past the threshold,
// 1 at full), and what that does to its damage and knock
export function charge(held) { return Math.max(0, Math.min(1, (held - HEAVY_HOLD) / 0.6)); }
export const chargeK = (c) => 1 + 0.6 * c;

// a strike's damage: by the fighter's stamina (0..100) and charge, a counter after a parry
// hits harder
export function strikeDamage(m, { stamina = 100, chargeLevel = 0, counter = false } = {}) {
	return m.dmg * (0.6 + 0.4 * Math.max(0, Math.min(1, stamina / 100))) * (m.kind === 'heavy' ? chargeK(chargeLevel) : 1) * (counter ? 1.7 : 1);
}

// ---------- defence ----------
// A block raised this recently before a blow lands is a parry: the blow is turned and the
// striker left open. A dodge has a moment of grace in its middle when nothing lands.
export const PARRY_WINDOW = 0.16;
export const BLOCK_K = 0.15;        // what still gets through a block
export const GUARD_BREAK_K = 0.5;   // what a heavy blow puts through one, and the guard breaks
export const DODGE = Object.freeze({ time: 0.34, graceFrom: 0.03, graceTo: 0.24, speed: 8.5, cool: 0.5 });
export const COUNTER_WINDOW = 0.85;

// an incoming strike meets your defence at its landing moment. d: { blocking, blockT (seconds
// since the block went up), dodgeT (seconds since the dodge began, or -1), facing (cosine
// between where you face and toward the striker), heavy }. Returns { result: 'parry' |
// 'block' | 'break' | 'evade' | 'hit', k: the share of the damage that lands, stagger: seconds
// you are rocked, open: seconds the striker is left open }
export function defend(d) {
	if (d.dodgeT >= DODGE.graceFrom && d.dodgeT <= DODGE.graceTo) return { result: 'evade', k: 0, stagger: 0, open: 0 };
	const front = d.facing > 0.2;
	if (d.blocking && front) {
		if (d.blockT <= PARRY_WINDOW) return { result: 'parry', k: 0, stagger: 0, open: 1.0 };
		if (d.heavy) return { result: 'break', k: GUARD_BREAK_K, stagger: 0.55, open: 0 };
		return { result: 'block', k: BLOCK_K, stagger: 0, open: 0 };
	}
	return { result: 'hit', k: 1, stagger: d.heavy ? 0.4 : 0, open: 0 };
}

// ---------- reactions ----------
// a blow from world direction (dx, dz) on someone facing `heading` (radians, +z at 0): which
// side it came from in their own frame
export function sideOf(dx, dz, heading) {
	const f = dx * Math.sin(heading) + dz * Math.cos(heading), s = dx * Math.cos(heading) - dz * Math.sin(heading);
	if (Math.abs(f) >= Math.abs(s)) return f < 0 ? 'front' : 'back';
	return s > 0 ? 'left' : 'right';
}
// how a blow takes someone: a flinch, a stagger, or off their feet. poise: 0 (easily rocked)
// .. 1 (a heavy fighter); hpFrac: what is left of them; open: they were left open (a parry)
export function reaction(m, { poise = 0.4, hpFrac = 1, open = false, blocked = false } = {}) {
	if (blocked) return { kind: 'blocked', t: 0.18 };
	const hit = m.stagger * (open ? 1.6 : 1) * (1.15 - poise * 0.6);
	if (m.knock * (open ? 1.4 : 1) >= 3.4 || (hpFrac < 0.25 && m.knock >= 1.5)) return { kind: 'down', t: 2.2 };
	if (hit >= 0.3) return { kind: 'stagger', t: Math.min(1.2, hit) };
	return { kind: 'flinch', t: Math.max(0.12, hit) };
}
// the moment the world holds still on a landed blow (hit-stop), in seconds
export function hitStop(m, result = 'hit') {
	if (result === 'parry') return 0.11;
	if (result === 'block') return 0.035;
	if (result === 'break') return 0.08;
	return m.kind === 'heavy' ? 0.085 : m.item ? 0.065 : 0.045;
}

// ---------- the takedown ----------
// from behind and unseen: within reach, behind them (more than ~115 degrees off where they
// face) and they are not fighting you
export function canTakedown({ dx, dz, heading, aware = false, reach = 1.7 }) {
	const d = Math.hypot(dx, dz);
	if (aware || d > reach || d < 0.2) return false;
	// (dx, dz) from them to you: behind them when it points against their facing
	const f = (dx * Math.sin(heading) + dz * Math.cos(heading)) / d;
	return f < -0.42;
}
export const TAKEDOWN = Object.freeze({ time: 1.7, choke: 1.2, down: 22 });

// ---------- turns ----------
// Several squaring up to you take their turns: only a few may be striking at once, with a
// breath between, the one who has waited longest goes next, and some only feint. Pure state:
// createTurns({ max, gap: [lo, hi] }); each frame tick(dt); want(id) asks for a turn (true when
// given), done(id) hands it back.
export function createTurns({ max = 1, gap = [0.5, 1.1], rnd = Math.random } = {}) {
	// (plain arrays, so asking each frame makes nothing new)
	const holding = [], ids = [], waits = [];
	let rest = 0;
	const unwait = (id) => { const i = ids.indexOf(id); if (i >= 0) { ids.splice(i, 1); waits.splice(i, 1); } };
	return {
		tick(dt) { rest = Math.max(0, rest - dt); for (let i = 0; i < waits.length; i++) waits[i] += dt; },
		want(id) {
			if (holding.includes(id)) return true;
			if (!ids.includes(id)) { ids.push(id); waits.push(0); }
			if (holding.length >= max || rest > 0) return false;
			// the longest waiting goes first
			let best = -1;
			for (let i = 0; i < ids.length; i++) if (best < 0 || waits[i] > waits[best]) best = i;
			if (ids[best] !== id) return false;
			holding.push(id); unwait(id);
			return true;
		},
		done(id) { const i = holding.indexOf(id); if (i >= 0) { holding.splice(i, 1); rest = gap[0] + rnd() * (gap[1] - gap[0]); } unwait(id); },
		drop(id) { const i = holding.indexOf(id); if (i >= 0) holding.splice(i, 1); unwait(id); },
		setMax(n) { max = n; },
		get busy() { return holding.length; },
		get rest() { return rest; },
		holds: (id) => holding.includes(id),
		clear() { holding.length = 0; ids.length = 0; waits.length = 0; rest = 0; },
	};
}
// how many may strike at once, by how many are squaring up (and the device)
export const turnsFor = (n, phone = false) => (n >= 4 && !phone ? 2 : 1);
// where each of n circling fighters keeps round you: spread evenly, starting from `base`
export function ringAngle(i, n, base = 0) { return base + (i / Math.max(1, n)) * Math.PI * 2; }
// a feint now? the cannier feint more
export const feints = (skill, r = Math.random()) => r < 0.08 + skill * 0.2;
// an NPC's tell before a strike: slower for the green, quicker for the practised, a heavy
// always readable
export function tell(m, skill = 0.5) { return (m.kind === 'heavy' ? 0.62 : 0.34) * (1.25 - skill * 0.5); }

// ---------- the police ----------
// an arrest, step by step. a: { state, t, comply }, s: { dist (to the nearest officer),
// speed (yours), attacking (you struck or swung lately), armed, dt }. States: approach ->
// order -> cuffing -> done, or 'resist' (you struck) or 'fled' (you ran)
export const ARREST = Object.freeze({ near: 3.6, comply: 2.4, cuff: 1.8, flee: 32, still: 1.1 });
export function arrestStep(a, s) {
	const n = { ...a, t: a.t + s.dt };
	if (a.state === 'done' || a.state === 'resist' || a.state === 'fled') return n;
	if (s.attacking) return { ...n, state: 'resist' };
	if (s.dist > ARREST.flee) return { ...n, state: 'fled' };
	if (a.state === 'approach') { if (s.dist < ARREST.near + 1.5) return { ...n, state: 'order', t: 0, comply: 0 }; return n; }
	if (a.state === 'order') {
		const still = s.dist < ARREST.near && s.speed < ARREST.still && !s.armed;
		n.comply = still ? a.comply + s.dt : Math.max(0, a.comply - s.dt * 0.5);
		if (n.comply >= ARREST.comply) return { ...n, state: 'cuffing', t: 0 };
		return n;
	}
	if (a.state === 'cuffing') return n.t >= ARREST.cuff ? { ...n, state: 'done' } : n;
	return n;
}
// the fine for a fight: by how many you hurt, never more than you have
export const fine = (hurt, credits) => Math.max(0, Math.min(credits, 40 + 25 * Math.max(0, hurt)));

// ---------- deeds ----------
// what a blow of yours counts for on the compass: starting a fight (the first blow on someone
// not already fighting you), breaking one up (a blow on one of two townsfolk fighting each
// other), or nothing more than the blow itself
export function fightDeed({ first = false, theyStruck = false, theirBrawl = false, withMe = false, hostile = false }) {
	if (hostile || theyStruck) return null;
	if (theirBrawl && !withMe) return 'break-up-fight';
	if (first && !withMe) return 'start-fight';
	return null;
}
