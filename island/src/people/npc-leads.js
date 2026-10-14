// A theft out of your sight leaves a lead: people in that region talk about it ("Someone
// grabbed a bag off a bench on the corner this morning"), the guide's story notes it, a
// marker shows roughly where it happened, and the thief may still be about with it. Find
// them and it is the same choice as a theft in front of you (errands.js theft): let them
// go, take it off them (neutral), give it back to its owner (the only boost) or keep it.
// Pure: the words and the book of leads. people/npc-quests.js places them and casts the thief.

import { spotWords } from './bag-spots.js';

const hashOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (xs, n) => xs[Math.abs(Math.trunc(n)) % xs.length];

// a name for one of a region's residents (someone you have never met, talked about)
const FIRST = ['Ana', 'Sam', 'Rosa', 'Lee', 'Maya', 'Omar', 'Grace', 'Theo', 'Nina', 'Raj', 'Lucia', 'Ben', 'Mei', 'Andre', 'Sofia', 'Kenji', 'Hannah', 'Diego', 'Priya', 'Marcus'];
export const residentName = (seed) => FIRST[hashOf(`name:${seed >>> 0}`) % FIRST.length];

// when, as people say it, from the hour it happened
export function whenOf(hours = 12) {
	const h = ((hours % 24) + 24) % 24;
	return h < 5 ? 'last night' : h < 12 ? 'this morning' : h < 17 ? 'this afternoon' : h < 21.5 ? 'this evening' : 'tonight';
}

// what can leave a lead: something taken that can be got back
export const LEAD_KINDS = Object.freeze(['bag', 'favour.snatch', 'favour.fall']);

// a lead from a settled quest (npc-quests-core.js settle): null unless it was a theft.
// ctx: { region, regionName, town, hours, now, at? }
export function leadFrom(q, r, { region = '', regionName = '', town = '', hours = 12, now = Date.now(), at = null } = {}) {
	if (!q || r?.outcome !== 'betray' || !r.followUp || !LEAD_KINDS.includes(q.kind)) return null;
	const thief = r.taker || r.followUp.thief, owner = q.giver?.id || '';
	const seedOf = (id) => +String(id).replace(/^npc:/, '') || hashOf(id);
	return {
		id: `lead:${hashOf(q.id + thief + now)}`, kind: q.kind, region: region || q.region, regionName, town: town || '',
		item: { name: q.item?.name || 'bag', shape: q.item?.shape || 'bag' }, loot: r.credits || q.loot || 0,
		owner: { id: owner, name: q.giver?.name || residentName(seedOf(owner)) },
		thief: { id: thief, name: r.followUp.thiefName || residentName(seedOf(thief)) },
		spot: q.spot || { kind: q.kind === 'bag' ? 'sidewalk' : 'street' }, when: whenOf(hours), t: now, at: at ? { x: at.x, z: at.z } : null, state: 'open',
	};
}

// how it is said: a passer-by in passing, the guide's story, a fact for a conversation
function whereOf(L) { return L.kind === 'bag' ? spotWords(L.spot).off : L.kind === 'favour.fall' ? 'off someone who had fallen' : 'from someone in the street'; }
export function leadLine(L, n = 0) {
	const it = L.item?.name || 'bag', what = it === 'bag' ? 'a bag' : `a ${it}`;
	const core = L.kind === 'bag' ? `Someone grabbed ${what} ${whereOf(L)} ${L.when}.` : L.kind === 'favour.fall' ? `Someone went through the pockets of a person who fell, ${L.when}. Took their ${it}.` : `Someone snatched ${what} from a person in the street ${L.when}.`;
	return pick([core, `Did you hear? ${core}`, `${core} Keep an eye on your things.`, `${core} They say whoever did it is still around.`], n);
}
export function leadNote(L) {
	const it = L.item?.name || 'bag', place = L.town ? ` in ${L.town}` : L.regionName ? ` ${/island/.test(L.regionName) ? 'on' : 'in'} ${L.regionName}` : '';
	const how = L.kind === 'bag' ? `took ${L.owner.name}'s ${it} ${whereOf(L)}` : L.kind === 'favour.fall' ? `went through ${L.owner.name}'s pockets after a fall and took the ${it}` : `snatched ${L.owner.name}'s ${it} in the street`;
	return `Someone ${how} ${L.when}${place}. The thief may still be about.`;
}
export function leadFact(L) { return `Heard that ${leadNote(L).replace(/^Someone/, 'someone').replace(/ The thief may still be about\.$/, '')} People are talking about it.`; }

// the book of leads: a few open at a time, each for a while; kept in store
// ({ get(key), set(key, value) }) so they are there next time
export const LEAD_OPEN = 5, LEAD_LIFE = 45 * 60 * 1000, LEAD_GAP = 4 * 60 * 1000;
export function createLeads({ store = null, now = () => Date.now(), key = 'l99-leads-v1' } = {}) {
	let L = [];
	try { const raw = store?.get(key); const o = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; if (Array.isArray(o)) L = o.filter((x) => x?.id && x.state); } catch { /* a fresh book */ }
	const save = () => { try { store?.set(key, JSON.stringify(L.slice(-20))); } catch { /* private mode */ } };
	const live = (x) => x.state === 'open' && now() - x.t < LEAD_LIFE;
	function add(lead, { force = false } = {}) {
		if (!lead) return null;
		const open = L.filter(live);
		// not too many, and not two at once in one region
		if (!force && (open.length >= LEAD_OPEN || open.some((x) => x.region === lead.region && now() - x.t < LEAD_GAP))) return null;
		L.push(lead);
		if (L.length > 20) L.shift();
		save();
		return lead;
	}
	function close(id, how = 'closed') { const x = L.find((y) => y.id === id); if (x && x.state === 'open') { x.state = how; x.closed = now(); save(); } return x || null; }
	return {
		add, close, save,
		open: (region = null) => L.filter((x) => live(x) && (!region || x.region === region)),
		all: () => L.slice(),
		get: (id) => L.find((x) => x.id === id) || null,
		// where it happened, once you are there to see it
		// (a real bench or doorstep there: the words follow it from now on)
		place(id, at) { const x = L.find((y) => y.id === id); if (x && at) { x.at = { x: at.x, z: at.z }; if (x.kind === 'bag' && at.kind) x.spot = { kind: at.kind, place: at.place, venue: at.venue }; save(); } return x; },
	};
}
