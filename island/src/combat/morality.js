// The morality compass: what you do in a fight, read on four axes, for you and for the world
// you did it in. Every deed is logged with its context (who, why, who saw, where), scored by
// one table below and nowhere else, so the weights can be read and tuned in one place.
//
// Axes, each -100 .. 100: mercy (+) and cruelty (-), lawful (+) and outlaw (-), protector (+)
// and predator (-), honest (+) and deceitful (-).
//
// The world answers from these: greetings and prices, faction standing, bounty hunters, songs
// and graffiti, and places that remember ("The village remembers what you did").

import { FOOD_DEEDS } from '../people/food.js';

export const AXES = ['mercy', 'law', 'protect', 'honest'];
export const AXIS_NAMES = { mercy: ['Cruel', 'Merciful'], law: ['Outlaw', 'Lawful'], protect: ['Predator', 'Protector'], honest: ['Deceitful', 'Honest'] };

// the deeds: points on each axis, and a line for the journal ({target}, {place})
export const RULES = Object.freeze({
	...FOOD_DEEDS,
	kill: { mercy: -4, law: -6, protect: -3, honest: 0, line: 'Killed {target}' },
	hurt: { mercy: -1, law: -2, protect: -1, honest: 0, line: 'Wounded {target}' },
	'kill-surrendered': { mercy: -30, law: -15, protect: -12, honest: -5, line: 'Killed {target}, who had surrendered' },
	spare: { mercy: 12, law: 2, protect: 3, honest: 2, line: 'Spared {target}, who surrendered' },
	'defend-village': { mercy: 4, law: 3, protect: 14, honest: 0, line: 'Defended {place}' },
	'raid-village': { mercy: -10, law: -12, protect: -18, honest: -2, line: 'Raided {place}' },
	arson: { mercy: -4, law: -12, protect: -6, honest: -2, line: 'Set fire to {target}' },
	steal: { mercy: 0, law: -8, protect: -2, honest: -10, line: 'Stole from {target}' },
	robbery: { mercy: -4, law: -12, protect: -6, honest: -8, line: 'Robbed {target}' },
	'help-faction': { mercy: 1, law: 0, protect: 2, honest: 1, line: 'Fought beside {target}' },
	collateral: { mercy: -3, law: -3, protect: -5, honest: 0, line: 'Bystanders hurt in your fight' },
	ward: { mercy: -25, law: -10, protect: -30, honest: 0, line: 'Raised a hand against a warded child' },
	rescue: { mercy: 6, law: 2, protect: 10, honest: 0, line: 'Drove off those hurting {target}' },
	favour: { mercy: 2, law: 1, protect: 2, honest: 2, line: 'Did {target} a favour' },
	tend: { mercy: 5, law: 1, protect: 5, honest: 0, line: 'Patched up {target} after the fighting' },
	'stop-thief': { mercy: 1, law: 6, protect: 6, honest: 1, line: 'Stopped the thief who robbed {target}' },
	'kept-wallet': { mercy: -1, law: -3, protect: -1, honest: -8, line: "Kept {target}'s lost wallet" },
	'boss-slain': { mercy: 0, law: 2, protect: 8, honest: 0, line: 'Brought down {target}' },
	// bags and errands, done by you or by anyone else (people/npc-quests.js)
	'return-bag': { mercy: 2, law: 2, protect: 3, honest: 6, line: "Handed {target}'s bag back" },
	'steal-bag': { mercy: -1, law: -6, protect: -2, honest: -8, line: "Walked off with {target}'s bag" },
	// taking it off the thief is neither good nor bad on its own: what you do next is
	'take-from-thief': { mercy: 0, law: 0, protect: 0, honest: 0, line: "Took {target}'s bag off the thief" },
	'return-stolen': { mercy: 2, law: 5, protect: 8, honest: 6, line: 'Gave {target} back what was stolen' },
	'keep-stolen': { mercy: 0, law: -4, protect: -1, honest: -8, line: 'Kept what was stolen from {target}' },
	'betray-errand': { mercy: -1, law: -5, protect: -2, honest: -9, line: 'Ran off with what {target} trusted them with' },
	'pocket-cash': { mercy: 0, law: -4, protect: -1, honest: -7, line: "Pocketed {target}'s money" },
});
// context: multipliers on the negative (harm) side of a deed, or on all of it, from one table
export const MODIFIERS = Object.freeze({
	selfDefence: { harm: 0.2 },          // they shot first, or were about to
	provoked: { harm: 0.5 },
	hostileTarget: { harm: 0.35 },       // an armed enemy in a fight
	lawTarget: { law: 2.5 },             // police or rangers
	unarmed: { harm: 1.6 },
	fleeing: { harm: 1.6 },
	vulnerable: { harm: 2.2 },           // the people of an encampment, the frail
	villager: { harm: 1.5 },
	occupied: { harm: 2.5 },             // a building with people in it
	empty: { harm: 0.5 },
	rich: { honest: 0.7, protect: 0 },   // taken from those with plenty
	poor: { harm: 2 },                   // taken from those with little
	witnessed: { law: 1.4 },
	unseen: { law: 0.6 },
});

// what a deed with its context is worth, axis by axis (pure, for the tests and the page)
export function score(kind, ctx = {}) {
	const R = RULES[kind];
	if (!R) return null;
	const out = {};
	for (const a of AXES) {
		let v = R[a] || 0;
		for (const [m, on] of Object.entries(ctx)) {
			const M = on && MODIFIERS[m];
			if (!M) continue;
			if (M.harm !== undefined && v < 0) v *= M.harm;
			if (M[a] !== undefined) v *= M[a];
		}
		out[a] = Math.round(v * 10) / 10;
	}
	return out;
}

const clampAxis = (v) => Math.max(-100, Math.min(100, v));
const blank = () => ({ mercy: 0, law: 0, protect: 0, honest: 0, deeds: 0 });
const fill = (t, a) => t.replace('{target}', a.target || 'someone').replace('{place}', a.place || 'this place');

// a ledger: the player's own axes, each world's, the log and the places that remember.
// store: { get(key), set(key, value) }; now() for the times
export function createMorality({ store = null, now = () => Date.now(), key = 'l99-morality' } = {}) {
	let S = { me: blank(), worlds: {}, log: [], places: {}, epoch: 0, cleansedAt: 0, lifetime: 0 };
	try { const raw = store?.get(key); if (raw) { const o = typeof raw === 'string' ? JSON.parse(raw) : raw; if (o?.me) S = { ...S, me: { ...blank(), ...o.me }, worlds: o.worlds || {}, log: Array.isArray(o.log) ? o.log.slice(-200) : [], places: o.places || {}, epoch: o.epoch || 0, cleansedAt: o.cleansedAt || 0, lifetime: o.lifetime || o.me.deeds || 0 }; } } catch { /* a fresh ledger */ }
	const listeners = [];
	const save = () => { try { store?.set(key, JSON.stringify(S)); } catch { /* private mode */ } };

	// a deed: { kind, target, faction, place, world, ctx: { selfDefence, witnessed, ... } }
	function record(d) {
		if (d.id && S.log.some(e => e.id === d.id)) return null;
		const s = score(d.kind, d.ctx || {});
		if (!s) return null;
		const w = (S.worlds[d.world || 'here'] ||= blank());
		for (const a of AXES) { S.me[a] = clampAxis(S.me[a] + s[a]); w[a] = clampAxis(w[a] + s[a] * 0.5); }
		S.me.deeds++; w.deeds++; S.lifetime++;
		const e = { id: d.id || globalThis.crypto?.randomUUID?.() || `${now()}-${Math.random().toString(36).slice(2)}`, epoch: S.epoch, t: now(), kind: d.kind, line: fill(RULES[d.kind].line, d), target: d.target || '', faction: d.faction || '', place: d.place || '', world: d.world || 'here', region: d.region || '', ctx: Object.keys(d.ctx || {}).filter((k) => d.ctx[k]), delta: s };
		S.log.push(e);
		if (S.log.length > 200) S.log.shift();
		if (d.place) { const P = (S.places[d.place] ||= { good: 0, harm: 0, last: '' }); const sum = s.mercy + s.protect; if (sum >= 0) P.good += sum; else P.harm -= sum; P.last = e.line; }
		save();
		for (const f of listeners) { try { f(e); } catch { /* a listener gone */ } }
		return e;
	}
	// what you are known as
	function title(m = S.me) {
		const top = AXES.map((a) => [a, m[a]]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
		if (!top || Math.abs(top[1]) < 12) return 'Unknown';
		const T = { mercy: ['the Merciless', 'the Merciful'], law: ['the Outlaw', 'the Upright'], protect: ['the Predator', 'the Protector'], honest: ['the Liar', 'the True'] };
		return T[top[0]][top[1] > 0 ? 1 : 0];
	}
	// how the world treats you
	function reactions() {
		const m = S.me, rep = (m.protect + m.mercy + m.law * 0.5) / 2.5;
		const bounty = m.law < -60 || m.protect < -60 ? 3 : m.law < -35 || m.protect < -35 ? 2 : m.law < -15 ? 1 : 0;
		const greet = rep > 30 ? ['Good to see you.', 'You are welcome here, always.', 'They say you stood up for the village.'] : rep < -30 ? ['Keep walking.', 'We know what you did.', 'Stay away from my family.'] : ['Morning.', 'Safe travels.', 'Watch yourself out there.'];
		const priceK = Math.max(0.85, Math.min(1.35, 1 - rep / 300 + (bounty ? 0.05 * bounty : 0)));
		const best = S.log.filter(e => (e.epoch || 0) === S.epoch).slice(-40).sort((a, b) => Math.abs(b.delta.protect + b.delta.mercy) - Math.abs(a.delta.protect + a.delta.mercy))[0];
		const song = best ? `They sing of you in the taverns now: "${best.line.toLowerCase()}, and never looked back."` : '';
		const graffiti = m.law < -25 ? `${title()} WAS HERE` : m.protect > 25 ? `THANK YOU, ${title().toUpperCase()}` : '';
		return { title: title(), reputation: Math.round(rep), bounty, greet, priceK: Math.round(priceK * 100) / 100, song, graffiti };
	}
	// a place's memory of you, as a line for the guide or journal
	function remembers(place) {
		const P = S.places[place];
		if (!P) return '';
		if (P.harm > P.good + 10) return `${place} remembers what you did: ${P.last.toLowerCase()}.`;
		if (P.good > P.harm + 10) return `${place} remembers you kindly: ${P.last.toLowerCase()}.`;
		return '';
	}
	return {
		record, score, title, reactions, remembers,
		on: (f) => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },
		me: () => ({ ...S.me }), world: (w = 'here') => ({ ...(S.worlds[w] || blank()) }), log: (n = 20) => S.log.slice(-n),
		info: (w) => ({ me: { ...S.me }, world: { ...(S.worlds[w || 'here'] || blank()) }, title: title(), reactions: reactions(), recent: S.log.slice(-8).map((e) => e.line), places: Object.keys(S.places).length, epoch: S.epoch, cleansedAt: S.cleansedAt, lifetime: S.lifetime }),
		snapshot: () => JSON.parse(JSON.stringify(S)),
		restore(snapshot) { if (!snapshot?.me) return false; S = JSON.parse(JSON.stringify(snapshot)); S.epoch ||= 0; S.cleansedAt ||= 0; S.lifetime ||= S.me.deeds || 0; save(); return true; },
		cleanse(receipt) {
			if (!Number.isSafeInteger(receipt?.epoch) || receipt.epoch !== S.epoch + 1 || !Number.isFinite(receipt.at)) return false;
			S = { ...S, me: blank(), worlds: {}, places: {}, epoch: receipt.epoch, cleansedAt: receipt.at };
			save(); return true;
		},
	};
}

// ---------- everyone else's deeds: people and the regions they live in ----------
// The same table scores them. A person's own standing moves with what they do (and shapes
// who they are, people/disposition.js); their region keeps a tally of all the deeds done in
// it, by them and by you, and so does the world. Tallies settle slowly back towards the
// middle, so a region is what it has done lately, not everything it ever did.
const REGION_K = 0.15, WORLD_K = 0.04, PLAYER_K = 0.5, SETTLE = 0.996, ACTORS = 300, LOG = 120;
export function createCommons({ store = null, now = () => Date.now(), key = 'l99-commons-v1' } = {}) {
	let S = { actors: {}, regions: {}, worlds: {}, log: [], at: now() };
	try { const raw = store?.get(key); if (raw) { const o = typeof raw === 'string' ? JSON.parse(raw) : raw; if (o?.regions) S = { actors: o.actors || {}, regions: o.regions || {}, worlds: o.worlds || {}, log: Array.isArray(o.log) ? o.log.slice(-LOG) : [], at: o.at || now() }; } } catch { /* a fresh ledger */ }
	const listeners = [];
	let dirty = false;
	const save = () => { if (!dirty) return; dirty = false; S.at = now(); try { store?.set(key, JSON.stringify(S)); } catch { /* private mode */ } };
	const settle = (T, k) => { for (const a of AXES) T[a] = Math.round(T[a] * k * 100) / 100; };
	function addTo(T, s, k) { settle(T, SETTLE); for (const a of AXES) T[a] = clampAxis(T[a] + s[a] * k); T.deeds++; }
	// a deed: { actor ('npc:123' or 'player'), name, kind, target, place, region, world, ctx }
	function record(d) {
		const s = score(d.kind, d.ctx || {});
		if (!s) return null;
		const player = !d.actor || d.actor === 'player';
		if (!player) {
			const A = (S.actors[d.actor] ||= { ...blank(), name: d.name || '', region: d.region || '', last: '', t: 0 });
			for (const a of AXES) A[a] = clampAxis(A[a] + s[a]);
			A.deeds++; A.t = now(); A.last = fill(RULES[d.kind].line, d); if (d.name) A.name = d.name; if (d.region) A.region = d.region;
			const ids = Object.keys(S.actors);
			if (ids.length > ACTORS) { ids.sort((x, y) => S.actors[x].t - S.actors[y].t); for (const id of ids.slice(0, ids.length - ACTORS)) delete S.actors[id]; }
		}
		if (d.region) addTo((S.regions[d.region] ||= { ...blank(), name: d.regionName || d.region }), s, player ? PLAYER_K : REGION_K);
		if (d.region && d.regionName) S.regions[d.region].name = d.regionName;
		addTo((S.worlds[d.world || 'here'] ||= blank()), s, player ? WORLD_K * 2 : WORLD_K);
		const e = { t: now(), actor: d.actor || 'player', name: d.name || '', kind: d.kind, line: fill(RULES[d.kind].line, d), place: d.place || '', region: d.region || '', delta: s };
		if (!player) { S.log.push(e); if (S.log.length > LOG) S.log.shift(); }
		dirty = true;
		for (const f of listeners) { try { f(e); } catch { /* a listener gone */ } }
		return e;
	}
	// your own deeds count in the region you did them in (the compass itself is unchanged)
	function follow(morality, regionNow) {
		return morality?.on?.((e) => { const R = regionNow?.(); if (R?.id && e.delta) { addTo((S.regions[R.id] ||= { ...blank(), name: R.name || R.id }), e.delta, PLAYER_K); dirty = true; } });
	}
	const copy = (T) => (T ? { ...T } : null);
	return {
		record, follow, save, score,
		on: (f) => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },
		actor: (id) => copy(S.actors[id]) || blank(),
		known: (id) => !!S.actors[id],
		region: (id) => copy(S.regions[id]) || blank(),
		world: (w = 'here') => copy(S.worlds[w]) || blank(),
		regions: () => Object.keys(S.regions),
		log: (n = 20, f = null) => (f ? S.log.filter(f) : S.log).slice(-n),
		// when the ledger was last written (for the time spent away)
		savedAt: () => S.at,
		reset() { S = { actors: {}, regions: {}, worlds: {}, log: [], at: now() }; dirty = true; save(); },
	};
}
