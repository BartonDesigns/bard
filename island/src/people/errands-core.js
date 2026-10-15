// Favours people ask of you in passing: the words, the choices and the rewards. Pure (no scene,
// no clock of its own), so the tests can play an errand through from start to end.
//
// Three kinds, each a short thing to do right here:
//   lost   something dropped nearby: search the marked patch, pick it up, bring it back
//   catch  a friend just walked off without something: run after them and hand it over
//   pass   someone waiting a little way off should have this: take it to them
//   pet    their dog slipped its lead and is lost nearby: find it, win it over, lead it home
//   groceries   their bags to their car, a little way off; they walk behind you
//   jumpstart   a flat battery: stand by the car while they try it with your help
//   directions  they are lost: point them the right way
//   pothole     a pothole down the street that nearly had their wheel: go and stand by it to
//               report it to the city, which sends a crew to fill it (bay/potholes.js)
// A wallet found can be kept instead of returned, and groceries walked off with; the world
// notices which. (Someone who has fallen is helped up where they are: errands.js helped.)

const pick = (xs, n) => xs[Math.abs(Math.trunc(n)) % xs.length];

export const ITEMS = Object.freeze({
	keys: { name: 'keys', the: 'the keys', mine: 'my keys', shape: 'keys' },
	phone: { name: 'phone', the: 'the phone', mine: 'my phone', shape: 'phone' },
	wallet: { name: 'wallet', the: 'the wallet', mine: 'my wallet', shape: 'wallet', cash: 60 },
	glasses: { name: 'glasses', the: 'the glasses', mine: 'my glasses', shape: 'glasses' },
	earbud: { name: 'earbud', the: 'the earbud', mine: 'one of my earbuds', shape: 'earbud' },
	ticket: { name: 'ticket', the: 'the ticket', mine: 'my concert ticket', shape: 'ticket' },
	scarf: { name: 'scarf', the: 'the scarf', mine: 'my scarf', shape: 'scarf' },
});
const LOST = ['keys', 'phone', 'wallet', 'glasses', 'earbud', 'ticket', 'scarf'];
// where someone lost might be trying to get to (never a business by name)
export const DESTS = ['the library', 'the post office', 'the bus station', 'the park', 'the community centre', 'the hospital', 'the farmers market', 'the high school'];
const CARRY = [
	{ name: 'bag', the: 'the bag', theirs: 'their bag', shape: 'bag' },
	{ name: 'water bottle', the: 'the water bottle', theirs: 'their water bottle', shape: 'bottle' },
	{ name: 'umbrella', the: 'the umbrella', theirs: 'their umbrella', shape: 'umbrella' },
	{ name: 'jacket', the: 'the jacket', theirs: 'their jacket', shape: 'jacket' },
	{ name: 'notebook', the: 'the notebook', theirs: 'their notebook', shape: 'notebook' },
];
const PASS = [
	{ name: 'coffee', the: 'the coffee', shape: 'cup', ask: (f) => `Could you run this coffee over to ${f}? I promised I would, and now I am stuck here.` },
	{ name: 'envelope', the: 'the envelope', shape: 'envelope', ask: (f) => `Would you take this envelope to ${f}? It is important, and I cannot leave right now.` },
	{ name: 'flowers', the: 'the flowers', shape: 'flowers', ask: (f) => `These are for ${f}. Would you bring them over? I am too nervous to do it myself.` },
	{ name: 'charger', the: 'the charger', shape: 'phone', ask: (f) => `${f} needs this charger, and I am about to miss my bus. Could you take it?` },
	{ name: 'parcel', the: 'the parcel', shape: 'parcel', ask: (f) => `This parcel came to me by mistake. It is for ${f}, just over there. Would you take it?` },
];

// how a friend is pointed out: where they are from where you are looking (dx, dz from you to
// them; fx, fz the way you face), never by anything about their body
export function relativeDir(dx, dz, fx, fz) {
	const d = Math.hypot(dx, dz) || 1, ahead = (dx * fx + dz * fz) / d, right = (dx * -fz + dz * fx) / d;
	if (ahead > 0.7) return 'up ahead of you';
	if (ahead < -0.7) return 'behind you';
	return right > 0 ? 'off to your right' : 'off to your left';
}

// what someone asks: kind and words. who: { first, seed }; n: a counter for variety.
// options: { friend: { first } } needed for catch and pass; kinds allowed.
// pet: { name, she, look } for a lost dog (the runtime has found it somewhere to be)
// pothole: { street } for a pothole near (the runtime has found one)
export function offerFor({ who = {}, n = 0, kinds = ['lost', 'catch', 'pass'], friend = null, dir = 'over there', car = false, pet = null, dest = null, pothole = null } = {}) {
	const s = (who.seed | 0) + n;
	const can = kinds.filter((k) => k === 'lost' || k === 'directions' || (k === 'repair' || k === 'jumpstart' || k === 'groceries' ? car : k === 'pet' ? pet : k === 'pothole' ? pothole : friend));
	if (!can.length) return null;
	const kind = pick(can, s * 7 + 3);
	if (kind === 'lost') {
		const id = pick(LOST, s * 13 + 1), it = ITEMS[id];
		const ask = pick([
			`Excuse me! Sorry, could you help me? I dropped ${it.mine} somewhere around here.`,
			`Oh, thank goodness, someone. I lost ${it.mine} just now. Could you help me look?`,
			`Sorry to bother you. Have you seen ${it.the === 'the keys' ? 'any keys' : 'a ' + it.name} on the ground? I just lost ${it.mine}.`,
			`I cannot find ${it.mine} anywhere. I think I dropped ${id === 'keys' || id === 'glasses' ? 'them' : 'it'} back there. Would you mind looking?`,
		], s);
		return { kind, item: { id, ...it }, ask, title: `Find ${who.first || 'their'}${who.first ? "'s" : ''} ${it.name}` };
	}
	if (kind === 'pet') {
		const { She, her } = pron(pet);
		const ask = pick([
			`Have you seen my dog? ${She} slipped ${her} lead and ran off. ${pet.name}, ${pet.look}. ${She} will be so frightened.`,
			`Please, could you help me? My dog ${pet.name} pulled free and bolted, ${dir}. ${She} is ${pet.look}.`,
			`Excuse me, I have lost my dog. ${pet.name}, ${pet.look}. ${She} got away from me just now. Could you help me find ${her}?`,
		], s);
		return { kind, item: { name: pet.name, the: pet.name, shape: null, pet }, ask, title: `Find ${who.first || 'their'}${who.first ? "'s" : ''} dog, ${pet.name}` };
	}
	if (kind === 'repair') {
		const ask = pick([
			`Excuse me, sorry. My car will not start, and I have no tools with me. If you have a repair roll, could you take a look?`,
			`Do you know anything about cars? Mine just died, right there. A repair roll would probably do it, if you have one.`,
			`Ugh, my car again. It will not start. If you have a repair roll, I would be so grateful. The shops sell them.`,
		], s);
		return { kind, item: { name: 'car', the: 'the car', shape: null }, ask, title: `Fix ${who.first || 'their'}${who.first ? "'s" : ''} car` };
	}
	if (kind === 'groceries') {
		const ask = pick([
			`Sorry, could you give me a hand? These bags are heavier than I thought, and my car is just ${dir}.`,
			`Would you mind helping me get these to my car? It is ${dir}. I will be right behind you.`,
			`I bought far too much. Could you carry some of this to my car for me? It is just ${dir}.`,
		], s);
		return { kind, item: { name: 'groceries', the: 'the groceries', shape: 'bag' }, ask, title: `Help ${who.first || 'them'} carry the groceries` };
	}
	if (kind === 'jumpstart') {
		const ask = pick([
			`Excuse me, my battery is dead. I have cables. Could you stand by the car while I try it?`,
			`Sorry to ask, but my car will not start. I think it is the battery. Could you help me jump it? It only takes a minute.`,
			`Do you have a minute? The battery died on me. If you hold the cables steady while I turn the key, I think it will go.`,
		], s);
		return { kind, item: { name: 'car', the: 'the car', shape: null }, ask, title: `Jump-start ${who.first || 'their'}${who.first ? "'s" : ''} car` };
	}
	if (kind === 'pothole') {
		const on = pothole.street ? ` on ${pothole.street}` : ' down the street';
		const ask = pick([
			`There is a pothole${on} that nearly took my wheel off. Could you go and report it? The city only comes if someone does.`,
			`Have you seen that pothole${on}? It is getting worse every week. Would you report it for me? It is just ${dir}.`,
			`Sorry, could you do me a favour? There is a nasty pothole${on}, ${dir}. If someone reports it, the city sends a crew.`,
		], s);
		return { kind, item: { name: 'pothole', the: 'the pothole', shape: null }, ask, title: `Report the pothole${pothole.street ? ' on ' + pothole.street : ''}` };
	}
	if (kind === 'directions') {
		const to = dest || pick(DESTS, s * 5 + 1);
		const ask = pick([
			`Excuse me, sorry. Do you know the way to ${to}? My phone just died.`,
			`Hi, I think I am lost. Which way is ${to}?`,
			`Sorry to bother you. I am looking for ${to}. Am I even close?`,
		], s);
		return { kind, item: { name: to, the: to, shape: null }, dest: to, ask, title: `Show ${who.first || 'them'} the way to ${to}` };
	}
	if (kind === 'catch') {
		const it = pick(CARRY, s * 11 + 5);
		const ask = pick([
			`Oh no, ${friend.first} just left ${it.theirs} here! They went ${dir}. Could you catch them? I cannot run in these shoes.`,
			`Wait, ${friend.first} forgot ${it.the}! They went ${dir}. Could you run after them? Please?`,
			`Hey, sorry, could you do me a favour? ${friend.first} walked off without ${it.the}. They went ${dir}, not far yet.`,
		], s);
		return { kind, item: it, ask, friend: friend.first, title: `Catch ${friend.first} with ${it.the}` };
	}
	const it = pick(PASS, s * 17 + 2);
	return { kind: 'pass', item: it, ask: it.ask(friend.first) + ` They are ${dir}.`, friend: friend.first, title: `Take ${it.the} to ${friend.first}` };
}

// she or he, for a dog
const pron = (pet) => (pet?.she === false ? { She: 'He', her: 'his', him: 'him', girl: 'boy' } : { She: 'She', her: 'her', him: 'her', girl: 'girl' });

// what they say when you say yes, when it is done, and the rest
export function lineFor(event, { kind, item = {}, friend = '', n = 0 } = {}) {
	const { She, him, girl } = pron(item.pet), dog = item.pet?.name || 'my dog';
	const L = {
		accept: kind === 'lost'
			? [`Thank you! It should be somewhere over there.`, `You are a lifesaver. I will wait right here.`, `Thanks so much. I will keep looking on this side.`]
			: kind === 'pet' ? [`Thank you! ${She} is scared, so go gently. Walk, do not run at ${him}.`, `Oh, thank you. ${She} comes to people who are calm with ${him}.`]
				: kind === 'catch' ? [`Thank you! Quick, before they are gone!`, `Go, go! Thank you!`]
					: kind === 'groceries' ? [`Thank you! Lead the way, I will be right behind you.`, `Oh, bless you. It is the car just there.`]
						: kind === 'jumpstart' ? [`Thank you! Just stand by the car while I try it.`, `You are a lifesaver. This will only take a second.`]
							: kind === 'pothole' ? [`Thank you. Mind your step round it.`, `Great. Just stand by it and send it in.`]
							: kind === 'directions' ? [`Oh, thank you.`, `Thanks, I am completely lost.`] : [`Thank you so much. Tell them it is from me.`, `You are the best. They are expecting it.`],
		reunited: [`${dog}! Oh, come here, you silly thing! Thank you, thank you so much.`, `There you are! I was so worried. Thank you for bringing ${him} back to me.`, `${dog}! Good ${girl}! I cannot thank you enough. Please, take this.`],
		found: [`Found ${item.the}.`],
		returned: [`My ${item.name}! Oh, thank you. Here, take this, please.`, `You found ${item.id === 'keys' || item.id === 'glasses' ? 'them' : 'it'}! I owe you one. Here.`, `Thank you, really. Let me at least give you something for your trouble.`],
		caught: [`Oh! ${item.name === 'bag' ? 'My bag' : 'That is mine'}! I did not even notice. Thank you!`, `Wait, ${item.the}? I would have been lost without it. Thanks!`, `Oh my gosh, thank you. You ran all this way?`],
		passed: [`For me? From ${friend}? That is so kind. Thank you!`, `Oh, ${friend} sent this? Thank you for bringing it.`, `${friend} remembered! Thanks for carrying it over.`],
		gaveUp: [`Never mind, I will manage. Thanks anyway.`],
		snatched: item.name && item.name !== 'bag' ? [`Hey! Stop! That is my ${item.name}!`, `Thief! Somebody stop them!`] : [`Hey! Stop! That is my bag!`, `Thief! Somebody stop them!`, `No! My bag! Stop them, please!`],
		dropped: [`Okay, okay! Take it!`, `Fine! Here! Just let me go!`, `Alright! I am dropping it!`],
		fixed: [`It started! You are a genius. Here, please take this.`, `Listen to that engine! Thank you, honestly. Let me give you something.`, `It runs! I was going to be stuck here all day. Thank you.`],
		jumped: [`It started! Oh, thank you. Here, for your trouble.`, `There it goes. You saved my afternoon. Please, take this.`, `Listen to that. Thank you, really. I owe you one.`],
		carried: [`Just here, thanks. You are very kind. Here, take this.`, `Thank you so much. My arms were about to fall off. Let me give you something.`, `That is the car. Thank you, honestly. Here.`],
		reported: [`Reported? Thank you. Maybe this time they will actually fill it.`, `Oh, good. My poor car thanks you. Here, for your trouble.`, `You did it? Thank you. The whole street will be glad.`],
		told: [`Oh, that way? Thank you. I would have walked in circles all day.`, `Thanks! I was completely turned around.`, `That makes sense now. Thank you so much.`],
		helpedUp: [`Thank you. I think I am alright, just embarrassed.`, `Oof. Thanks for stopping. Not many people do.`, `Thank you. My ankle just went. I will be fine.`],
		escaped: [`They are gone. Thank you for trying.`, `Too late. Thanks for running after them, though.`],
		recovered: [`My ${item.name || 'bag'}! Everything is still in it. Thank you, really. Please, take this.`, `You got it back! I cannot believe it. Here, for you.`],
		kept: [],
	}[event] || [''];
	return pick(L, n);
}

// credits for a favour, by kind and how far it took you (never a fortune: these are favours)
export function rewardFor(kind, metres = 0) {
	// (pointing the way and helping someone up are not paid: people do not, for those)
	if (kind === 'directions' || kind === 'fall') return 0;
	const base = kind === 'snatch' ? 80 : kind === 'repair' ? 70 : kind === 'pet' ? 60 : kind === 'jumpstart' ? 50 : kind === 'lost' ? 45 : kind === 'catch' ? 35 : kind === 'groceries' ? 25 : kind === 'pothole' ? 25 : 30;
	return Math.round(Math.min(140, base + Math.max(0, metres) * (kind === 'catch' ? 0.45 : kind === 'pet' ? 0.35 : 0.3)) / 5) * 5;
}

// The errand's own steps. State: { kind, stage, ... }; events move it on:
//   accept, pickup (lost), reach (the giver or the friend), away (too far from it all), timeout;
//   a lost dog: befriend (it follows you now), strayed (it lost you again).
// Returns the next state and what happened ({ done, kept, failed, say }).
export const STAGES = Object.freeze({ offered: 'offered', search: 'search', bring: 'bring', lead: 'lead', chase: 'chase', carry: 'carry', done: 'done', failed: 'failed', kept: 'kept' });
export function step(E, ev) {
	if (!E || E.stage === 'done' || E.stage === 'failed' || E.stage === 'kept') return { E, out: null };
	const at = (stage, out = null) => ({ E: { ...E, stage }, out });
	switch (ev) {
		case 'accept': return E.stage === 'offered' ? at(E.kind === 'lost' || E.kind === 'pet' ? 'search' : E.kind === 'catch' ? 'chase' : E.kind === 'repair' ? 'fix' : E.kind === 'groceries' ? 'haul' : E.kind === 'jumpstart' ? 'jump' : E.kind === 'directions' ? 'tell' : E.kind === 'pothole' ? 'report' : 'carry', { say: 'accept' }) : { E, out: null };
		// a flat battery: you stood by while it turned over; the way pointed out
		case 'jumped': return E.stage === 'jump' ? at('done', { done: true, say: 'jumped' }) : { E, out: null };
		case 'told': return E.stage === 'tell' ? at('done', { done: true, say: 'told' }) : { E, out: null };
		// a pothole: stood by it and sent the report in
		case 'reported': return E.stage === 'report' ? at('done', { done: true, say: 'reported' }) : { E, out: null };
		// a car that would not start: a repair roll used beside it
		case 'fixed': return E.stage === 'fix' ? at('done', { done: true, say: 'fixed' }) : { E, out: null };
		// a bag snatched: catch the thief, they drop it, pick it up, give it back
		case 'catch-thief': return E.stage === 'thief' ? at('search', { say: 'dropped', thief: true }) : { E, out: null };
		case 'escaped': return E.stage === 'thief' ? at('failed', { failed: true, say: 'escaped' }) : { E, out: null };
		case 'decline': return E.stage === 'offered' ? at('failed', { declined: true }) : { E, out: null };
		case 'pickup': return E.stage === 'search' && E.kind !== 'pet' ? at('bring', { say: 'found' }) : { E, out: null };
		// a lost dog won over follows you; lose it and it is lost again
		case 'befriend': return E.stage === 'search' && E.kind === 'pet' ? at('lead', { say: 'befriended' }) : { E, out: null };
		case 'strayed': return E.stage === 'lead' ? at('search', { say: 'strayed' }) : { E, out: null };
		case 'reach':
			if (E.stage === 'bring') return at('done', { done: true, say: E.kind === 'snatch' ? 'recovered' : 'returned' });
			if (E.stage === 'lead') return at('done', { done: true, say: 'reunited' });
			if (E.stage === 'chase') return at('done', { done: true, say: 'caught' });
			if (E.stage === 'carry') return at('done', { done: true, say: 'passed' });
			if (E.stage === 'haul') return at('done', { done: true, say: 'carried' });
			return { E, out: null };
		// walked off: with a found wallet in your pocket, you kept it; otherwise it lapses
		// (a bag got back off a thief and carried away is kept too: stolen goods, not a find)
		// (and groceries carried off down the street, not to the car, are kept too)
		case 'away': return (E.stage === 'bring' && (E.item?.cash || E.kind === 'snatch')) || E.stage === 'haul' ? at('kept', { kept: true, cash: E.item?.cash || 0 }) : at('failed', { failed: true });
		case 'timeout': case 'lost-them': return at('failed', { failed: true, say: E.stage === 'offered' ? null : 'gaveUp' });
		default: return { E, out: null };
	}
}

// a running count of favours done, for the milestones people mention
export function milestone(done) {
	return done === 1 ? 'Your first favour. People notice these things.' : done === 5 ? 'Five favours done. Faces around here are starting to recognise you.' : done === 15 ? 'Fifteen favours. Word gets around: you are the one who helps.' : done === 40 ? 'Forty favours. Ask anyone here who to call: they will say your name.' : null;
}
