// The lines people say often enough to be worth making ahead of time in the local voices:
// everything said in passing (people/chatter-lines.js) and the favours' fixed lines
// (people/errands-core.js). A line with a name in it (a friend's, a dog's) is left out: it is
// said whole by the model or the device, never half from a clip.
import { lineBank } from '../src/people/chatter-lines.js';
import { offerFor, lineFor } from '../src/people/errands-core.js';
import { speechChunks, clipId } from '../src/guide/local-speech-plan.js';

// stand-ins for the parts that change: a line that comes out with one in it has a name
const NAME = 'Qzxw', LOOK = 'qzxw look';
const DIRS = ['up ahead of you', 'behind you', 'off to your right', 'off to your left', 'over there'];
const EVENTS = ['accept', 'reunited', 'found', 'returned', 'caught', 'passed', 'gaveUp', 'snatched', 'dropped', 'fixed', 'escaped', 'recovered'];

export function errandLines() {
	const out = new Set();
	const friend = { first: NAME };
	for (const she of [true, false]) {
		const pet = { name: NAME, she, look: LOOK };
		for (const kinds of [['lost'], ['catch'], ['pass'], ['repair'], ['pet']]) {
			for (const dir of DIRS) for (let n = 0; n < 48; n++) {
				const offer = offerFor({ who: { first: NAME, seed: 0 }, n, kinds, friend, dir, car: true, pet });
				if (!offer) continue;
				out.add(offer.ask);
				for (const ev of EVENTS) for (let k = 0; k < 6; k++) out.add(lineFor(ev, { kind: offer.kind, item: offer.item, friend: NAME, n: k }));
			}
		}
	}
	// a bag snatched in the street (errands.js snatch)
	for (const ev of ['snatched', 'dropped', 'escaped', 'recovered']) for (let k = 0; k < 6; k++) out.add(lineFor(ev, { kind: 'snatch', item: { name: 'bag', the: 'the bag' }, n: k }));
	return [...out].filter((t) => t && !t.includes(NAME) && !t.includes(LOOK));
}

// { lines: whole lines, chunks: Map(clip id -> words) } for every line worth a clip
export function voiceBank() {
	const lines = [...new Set([...lineBank(), ...errandLines()])].sort();
	const chunks = new Map();
	for (const line of lines) for (const c of speechChunks(line)) chunks.set(clipId(c), c);
	return { lines, chunks };
}
