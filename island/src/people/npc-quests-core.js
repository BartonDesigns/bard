// Quests people do for each other while you are elsewhere: the rules, pure (no scene, no
// clock of its own), so the tests can play one through. people/npc-quests.js runs them in
// the world.
//
// Every quest, whatever it is, is one shared descriptor:
//   { id, kind, title, giver: { type: 'business'|'person', id, name, x, z },
//     steps: [{ do: 'go'|'pickup'|'deliver'|'talk'|'wait'|'fix'|'chase', at: { x, z, name, establishmentId? }, item?: { name, shape } }],
//     reward: { credits, from }, deeds: { done, betray? }, tempt: 0..1, region, expires }
// The favours people ask of you (errands-core.js), a bag left on a bench, and the requests
// businesses post (the economy's requests, through a source) all come as one of these.
//
// Sources: { id, near(x, z, r) -> descriptors, take(id, takerId) -> truthy, complete(id, takerId, outcome) }.
// Who takes one and how it ends is their disposition's (disposition.js): the helpful and
// the greedy say yes; the honest see it through, the tempted run off with it; the unreliable
// drift away. Done pays the taker (from the giver, if the giver is a person) and puts the
// good deed on their compass and their region's; betrayed puts the bad one there, and what
// was taken can be got back (the same rule as a snatched bag: taking it off them is
// neutral, only giving it back to its owner counts).

import { offerFor, rewardFor, DESTS } from './errands-core.js';
import { chooseDeed, followThrough } from './disposition.js';
import { RULES } from '../combat/morality.js';
import { spotWords, SPOT_KINDS } from './bag-spots.js';

export const DOES = Object.freeze(['go', 'pickup', 'deliver', 'talk', 'wait', 'fix', 'chase']);
const hashOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (xs, n) => xs[Math.abs(Math.trunc(n)) % xs.length];

// a descriptor made whole: defaults filled in, steps checked
export function questOf(d = {}) {
	const steps = (d.steps || []).filter((s) => s && DOES.includes(s.do)).map((s) => ({ ...s, at: s.at ? { ...s.at } : null }));
	const deeds = { done: RULES[d.deeds?.done] ? d.deeds.done : 'favour', betray: RULES[d.deeds?.betray] ? d.deeds.betray : null };
	return {
		id: String(d.id || `q:${d.kind || 'job'}:${hashOf(JSON.stringify(steps.map((s) => s.do)) + (d.title || ''))}`),
		kind: d.kind || 'job', title: d.title || 'A job', giver: { type: 'person', id: '', name: '', x: 0, z: 0, ...(d.giver || {}) },
		steps, reward: { credits: Math.max(0, Math.round(d.reward?.credits || 0)), from: d.reward?.from ?? d.giver?.id ?? null },
		deeds, tempt: Math.max(0, Math.min(1, d.tempt ?? 0.2)), region: d.region || '', expires: d.expires ?? null,
		item: d.item || steps.find((s) => s.item)?.item || null, loot: d.loot ?? null, source: d.source || null, spot: d.spot || null, dest: d.dest || null,
	};
}

// ---------- sources ----------
export function createSources() {
	const list = [];
	return {
		add(src) { if (src?.id && typeof src.near === 'function') { list.push(src); return () => { const i = list.indexOf(src); if (i >= 0) list.splice(i, 1); }; } return () => {}; },
		list: () => list.slice(),
		// every open quest near a point, each knowing where it came from
		near(x, z, r) {
			const out = [];
			for (const s of list) { try { for (const d of s.near(x, z, r) || []) out.push(questOf({ ...d, source: s.id })); } catch { /* a source gone */ } }
			return out;
		},
		take(q, takerId) { const s = list.find((x) => x.id === q.source); try { return s ? s.take ? !!s.take(q.id, takerId) : true : false; } catch { return false; } },
		complete(q, takerId, outcome) { const s = list.find((x) => x.id === q.source); try { s?.complete?.(q.id, takerId, outcome); } catch { /* a source gone */ } },
	};
}
// the economy's requests (requestsNear, takeRequest, completeRequest) as a source
export function fromRequests({ requestsNear, takeRequest, completeRequest }, id = 'economy') {
	return { id, near: (x, z, r) => requestsNear?.(x, z, r) || [], take: (q, who) => takeRequest?.(q, who) ?? true, complete: (q, who, outcome) => completeRequest?.(q, who, outcome) };
}

// ---------- the favours people ask, as descriptors ----------
// giver/friend: { id, name, x, z, ref? } (ref: the body, at runtime); drop, car: { x, z }.
// A step marked turn is where a betrayal happens when it is not the pickup: the wrong way
// pointed out, the money taken up front, the pockets of someone who fell gone through.
const TEMPT = { wallet: 0.75, phone: 0.5, keys: 0.15, glasses: 0.1, earbud: 0.2, ticket: 0.4, scarf: 0.25, parcel: 0.45, envelope: 0.4, charger: 0.35, flowers: 0.12, coffee: 0.08, bag: 0.4, 'water bottle': 0.1, umbrella: 0.15, jacket: 0.3, notebook: 0.15 };
const spot = (p, extra = {}) => (p ? { x: p.x, z: p.z, name: p.name || '', who: p.ref || null, ...extra } : null);
export function favourQuest(kind, { giver, friend = null, drop = null, car = null, thief = null, region = '', seed = 0, n = 0, item = null, dest = null, pet = null } = {}) {
	const who = { first: giver?.name || 'someone', seed };
	const base = { kind: `favour.${kind}`, giver: { type: 'person', id: giver?.id || '', name: giver?.name || '', x: giver?.x || 0, z: giver?.z || 0 }, region, reward: { credits: rewardFor(kind, 40), from: giver?.id || null } };
	if (kind === 'lost') {
		const o = item ? { item, title: `Find ${who.first}'s ${item.name}` } : offerFor({ who, n, kinds: ['lost'] });
		const it = { name: o.item.name, shape: o.item.shape || o.item.id || 'keys', cash: o.item.cash || 0 };
		return questOf({ ...base, title: o.title, item: it, loot: it.cash || 20, tempt: TEMPT[it.name] ?? 0.2,
			steps: [{ do: 'go', at: spot(drop || giver) }, { do: 'pickup', at: spot(drop || giver), item: it }, { do: 'deliver', at: spot(giver), item: it }],
			deeds: { done: 'favour', betray: it.cash ? 'kept-wallet' : 'betray-errand' } });
	}
	if (kind === 'catch' || kind === 'pass') {
		const o = offerFor({ who, n, kinds: [kind], friend: { first: friend?.name || 'their friend' } });
		const it = { name: o.item.name, shape: o.item.shape };
		return questOf({ ...base, title: o.title, item: it, loot: 15, tempt: (TEMPT[it.name] ?? 0.2) * (kind === 'catch' ? 0.7 : 1),
			steps: [{ do: 'pickup', at: spot(giver), item: it }, { do: kind === 'catch' ? 'chase' : 'go', at: spot(friend) }, { do: 'deliver', at: spot(friend), item: it }],
			deeds: { done: 'favour', betray: 'betray-errand' } });
	}
	if (kind === 'repair') {
		return questOf({ ...base, title: `Fix ${who.first}'s car`, tempt: 0,
			steps: [{ do: 'go', at: spot(car || giver) }, { do: 'fix', at: spot(car || giver) }, { do: 'talk', at: spot(giver) }], deeds: { done: 'favour' } });
	}
	if (kind === 'pet') {
		return questOf({ ...base, title: `Find ${who.first}'s dog`, tempt: 0.04, item: { name: pet?.name || 'dog', shape: null, pet },
			steps: [{ do: 'go', at: spot(drop || giver) }, { do: 'wait', at: spot(drop || giver) }, { do: 'deliver', at: spot(giver) }], deeds: { done: 'favour' } });
	}
	if (kind === 'groceries') {
		const it = { name: 'groceries', shape: 'bag' };
		return questOf({ ...base, title: `Help ${who.first} carry the groceries`, item: it, loot: 25, tempt: 0.2,
			steps: [{ do: 'pickup', at: spot(giver), item: it }, { do: 'go', at: spot(car || drop || giver, { name: 'their car' }) }, { do: 'deliver', at: spot(giver), item: it }],
			deeds: { done: 'favour', betray: 'betray-errand' } });
	}
	if (kind === 'directions') {
		const to = dest || pick(DESTS, n + seed);
		return questOf({ ...base, title: `Show ${who.first} the way to ${to}`, dest: to, tempt: 0.1, reward: { credits: 0, from: null },
			steps: [{ do: 'go', at: spot(giver) }, { do: 'talk', at: spot(giver), turn: true }], deeds: { done: 'give-directions', betray: 'mislead' } });
	}
	if (kind === 'jumpstart') {
		// (a betrayal: the money up front, and gone)
		return questOf({ ...base, title: `Jump-start ${who.first}'s car`, tempt: 0.18, loot: rewardFor('jumpstart'), reward: { credits: rewardFor('jumpstart'), from: giver?.id || null },
			steps: [{ do: 'go', at: spot(car || giver, { name: 'their car' }) }, { do: 'fix', at: spot(car || giver, { name: 'their car' }), turn: true }, { do: 'talk', at: spot(giver) }], deeds: { done: 'favour', betray: 'pocket-cash' } });
	}
	if (kind === 'fall') {
		const it = { name: 'wallet', shape: 'wallet', cash: 25 + (Math.abs(seed | 0) % 40) };
		return questOf({ ...base, title: `Help ${who.first} up`, item: it, loot: it.cash, tempt: 0.3, reward: { credits: 0, from: null },
			steps: [{ do: 'go', at: spot(giver) }, { do: 'wait', at: spot(giver), turn: true }, { do: 'talk', at: spot(giver) }], deeds: { done: 'help-fallen', betray: 'rob-fallen' } });
	}
	if (kind === 'snatch') {
		const it = { name: 'bag', shape: 'bag' };
		return questOf({ ...base, title: `Get ${who.first}'s bag back`, item: it, loot: 30, tempt: TEMPT.bag, reward: { credits: rewardFor('snatch', 40), from: giver?.id || null },
			steps: [{ do: 'chase', at: spot(thief || giver) }, { do: 'pickup', at: spot(thief || giver), item: it }, { do: 'deliver', at: spot(giver), item: it }],
			deeds: { done: 'return-stolen', betray: 'keep-stolen' } });
	}
	return null;
}
// a bag set down and forgotten: on a bench, at a bus shelter, on a cafe or restaurant table,
// a doorstep, a park bench or a picnic table, or the sidewalk (people/bag-spots.js). where:
// a spot's kind, or the spot itself ({ kind, place?, venue? }); via: the points walked
// through to reach it and back (a cafe's door, for a table inside)
export const BAG_SPOTS = SPOT_KINDS;
export function bagQuest({ owner, at, region = '', where = 'sidewalk', cash = 30, via = [] }) {
	const it = { name: 'bag', shape: 'bag' }, sp = typeof where === 'string' ? { kind: where } : { kind: where?.kind || 'sidewalk', place: where?.place, venue: where?.venue };
	const W = spotWords(sp), go = (p) => ({ do: 'go', at: spot(p) });
	return questOf({ kind: 'bag', title: `${owner?.name || 'Someone'}'s bag, left ${W.left}`, giver: { type: 'person', id: owner?.id || '', name: owner?.name || '', x: owner?.x || 0, z: owner?.z || 0 },
		item: it, loot: cash, tempt: 0.55, region, reward: { credits: 20 + (cash % 4) * 5, from: owner?.id || null }, spot: sp,
		steps: [...via.map(go), { do: 'pickup', at: spot(at, { name: W.name }), item: it }, ...via.slice().reverse().map(go), { do: 'deliver', at: spot(owner), item: it }],
		deeds: { done: 'return-bag', betray: 'steal-bag' } });
}

// ---------- deciding and settling ----------
// does this person take it, and how will it end? rolls: [take, follow through], 0..1
export function decide(d, q, rolls = [Math.random(), Math.random()]) {
	const c = chooseDeed(d, q.tempt, rolls[0]);
	if (c === 'pass') return { take: false };
	// nothing worth keeping: the tempted shrug it off rather than betray nothing
	if (c === 'betray') return q.deeds.betray ? { take: true, outcome: 'betray' } : { take: false };
	return { take: true, outcome: followThrough(d, rolls[1]) };
}
// how long it takes them, in seconds (the steps, at their pace and with their reliability)
export function durationOf(d, q) { return Math.round(q.steps.length * 25 / (d?.pace || 1) * (1.4 - (d?.reliable ?? 0.5) * 0.6)); }

// the end of it: pay, deeds and what happens next.
// ctx: { actorId, name, money (people/npc-money.js), commons, world, place, regionName }
export function settle(q, outcome, { actorId, name = '', money = null, commons = null, world = 'here', place = '', regionName = '' } = {}) {
	const out = { outcome, credits: 0, deed: null, followUp: null };
	const base = { actor: actorId, name, target: q.giver.name || 'a neighbour', place: place || q.steps.at(-1)?.at?.name || '', region: q.region, regionName, world };
	if (outcome === 'done') {
		out.credits = q.reward.credits;
		if (out.credits) {
			// a person pays from their own pocket; a business's source pays its side itself
			if (q.reward.from && String(q.reward.from).startsWith('npc:')) money?.transfer(q.reward.from, actorId, out.credits, 'reward');
			else money?.earn(actorId, out.credits, 'reward', q.reward.from || q.giver.id || null);
		}
		out.deed = commons?.record({ ...base, kind: q.deeds.done }) || { kind: q.deeds.done };
	} else if (outcome === 'betray' && q.deeds.betray) {
		const loot = q.loot ?? q.item?.cash ?? 0;
		// (taken from a person: out of their pocket and into the thief's)
		if (loot) { if (String(q.giver.id).startsWith('npc:')) money?.transfer(q.giver.id, actorId, loot, 'theft'); else money?.earn(actorId, loot, 'theft', q.giver.id || null); }
		out.credits = loot;
		out.deed = commons?.record({ ...base, kind: q.deeds.betray }) || { kind: q.deeds.betray };
		// what was taken can be got back by someone else (you, nearby); a wrong way pointed
		// out or money talked out of someone leaves nothing to carry back
		const owner = q.steps.findLast((s) => s.do === 'deliver')?.at || { x: q.giver.x, z: q.giver.z, name: q.giver.name };
		if (q.item || q.giver.type === 'business') out.followUp = { kind: 'recover', thief: actorId, thiefName: name, owner: { ...q.giver, at: owner }, item: q.item || { name: 'parcel', shape: 'parcel' }, quest: q.id };
	}
	return out;
}

// ---------- far away: a whole quest in one tick ----------
// residents of a region: the same few hundred people, met again and again
export const RESIDENTS = 400;
export function residentSeed(region, k) { return hashOf(`${region}#${((k % RESIDENTS) + RESIDENTS) % RESIDENTS}`); }
const FAR_KINDS = [['bag', 0.3], ['lost', 0.14], ['pass', 0.1], ['catch', 0.08], ['repair', 0.05], ['pet', 0.05], ['snatch', 0.08], ['groceries', 0.06], ['directions', 0.06], ['jumpstart', 0.04], ['fall', 0.04]];
export function farKind(roll) { let a = 0; for (const [k, w] of FAR_KINDS) { a += w; if (roll < a) return k; } return 'bag'; }
// a made-up quest among residents: giver and the passers-by who might take it
export function farQuest(region, n, roll = Math.random(), want = null) {
	const kind = want || farKind(roll), gk = (hashOf(region + ':' + n) % RESIDENTS), gid = `npc:${residentSeed(region, gk)}`;
	const giver = { id: gid, name: '', x: 0, z: 0 };
	if (kind === 'bag') return bagQuest({ owner: giver, at: { x: 0, z: 0 }, region, where: pick(BAG_SPOTS, n * 5 + 1), cash: 15 + (n * 7) % 50 });
	return favourQuest(kind, { giver, friend: { id: `npc:${residentSeed(region, gk + 1)}`, name: '' }, region, seed: gk, n, dest: kind === 'directions' ? pick(DESTS, n) : null });
}
// one far event played out: up to three passers-by consider it; the first who takes it settles
// it. dispoOf(seed) gives a resident's disposition; rand() the dice
export function playFar(q, { dispoOf, rand = Math.random, offset = 0, ...ctx }) {
	const gk = hashOf(q.giver.id);
	for (let i = 1; i <= 3; i++) {
		const seed = residentSeed(q.region, gk + 3 + i * 37 + offset);
		const id = `npc:${seed}`;
		if (id === q.giver.id) continue;
		const d = dispoOf(seed, id), c = decide(d, q, [rand(), rand()]);
		if (!c.take) continue;
		return { taker: id, ...settle(q, c.outcome, { ...ctx, actorId: id }) };
	}
	return { taker: null, outcome: q.kind === 'bag' ? 'owner-back' : 'unanswered', credits: 0, deed: null, followUp: null };
}

// ---------- the words, for the scenes you see ----------
const L = {
	call: ['Hey! Excuse me! You left your bag!', 'Wait! Is this yours?', 'Excuse me! Your bag!'],
	hand: ['Excuse me, I think this is yours.', 'Hey, wait up! You left this.', 'Sorry, is this yours? It was back there.'],
	thank: ['Oh my goodness, my bag! Thank you. Here, take this for your trouble.', 'You are kidding. Thank you, honestly. Let me give you something.', 'I did not even notice I left it. Thank you so much.'],
	cry: ['Hey! That is my bag!', 'Stop! That is mine!', 'Somebody stop them! They took my bag!'],
	gone: ['Where is my bag? It was right here.', 'No, no, no. I left it right here.'],
	back: ['There it is. Phew.', 'Oh thank goodness, still here.'],
	deliver: ['Here you go. All done.', 'This is for you.', 'Delivered, as promised.'],
	fixed: ['Try it now.', 'That should do it.'],
	// the street's small kindnesses (and their betrayals, said just the same way)
	directions: ['Two blocks that way, then left. You cannot miss it.', 'Straight down here, past the lights, and it is on your right.', 'Oh, easy. Follow this street to the end and turn left.'],
	mislead: ['Oh, that is way over the other side. Head back the way you came.', 'Right, go that way for a good while. Keep going, you will see it.'],
	fallen: ['Ow! Oh, my ankle.', 'Ouch. I am fine, I am fine. Just give me a second.', 'Oof. Did anyone see that?'],
	helpUp: ['Here, take my hand. Easy now.', 'Are you alright? Let me help you up.', 'Steady. Up you come.'],
	upfront: ['I can get you going, but it is cash up front.', 'Sure. Pay me first and I will grab my cables.'],
	cheated: ['Hey! Where are you going? You took my money!', 'Unbelievable. They just walked off with it.'],
	cables: ['Okay, try it now.', 'Turn the key. Go on.'],
	carry: ['Here, let me take some of those.', 'I have got these. Lead the way.'],
	// a child or a teen who spots a bag left alone (they say so; they never take it)
	kidSee: ['Look! Somebody forgot their bag!', 'Someone left their bag on there!', 'Whose bag is that?'],
	teenSee: ['Yo, somebody left their bag here.', 'Someone forgot their bag. Should we tell somebody?', 'Is that someone\'s bag? They just left it.'],
	withKids: ['Come on, we are giving this back.', 'Stay close. We need to catch them up.', 'Good spotting. Let us take it back to them.'],
};
export function sceneLine(event, n = 0) { return pick(L[event] || [''], n); }
