// Who a passer-by is, when you stop and talk: a name, an age, a job and a neighbourhood that
// fit their body and where you met them, a temperament that sets how they speak and move,
// and a little of their day. The same person is the same persona every time (it grows from
// their seed). The conversational model plays them from this sheet; without a model they
// still answer, simply, from what they know about where they are.
//
// Their body answers too. What they say is read as it streams: the model can tag its mood
// and a gesture ([[mood: happy]] [[gesture: shrug]]), and the text itself is read for
// questions, jokes, agreement, refusal, directions, doubt and emphasis, each turned into a
// gesture, a nod or a shake, a face.

import { inkStory } from '../tattoo/lore.js';
import { regionalNow } from '../region/here.js';
import { regionalSheet } from '../region/talk.js';
import { nameFor } from '../region/cultures.js';

const rng = (seed) => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const pick = (r, a) => a[Math.floor(r() * a.length)];

// given names by the three ancestry targets of the base mesh (African, Asian, European) and
// the Bay Area's Latino families; surnames the same way
const NAMES = {
	f: { af: ['Aaliyah', 'Imani', 'Keisha', 'Nia', 'Tasha', 'Monique', 'Jada', 'Brianna'], as: ['Mei', 'Priya', 'Jenny', 'Linh', 'Grace', 'Ananya', 'Yuki', 'Min-ji', 'Christine', 'Divya'], eu: ['Emily', 'Sarah', 'Hannah', 'Megan', 'Claire', 'Rachel', 'Olivia', 'Laura', 'Kate'], la: ['Maria', 'Sofia', 'Lucia', 'Gabriela', 'Daniela', 'Valeria', 'Rosa'] },
	m: { af: ['Marcus', 'Darnell', 'Jamal', 'Andre', 'Terrence', 'Isaiah', 'Malik'], as: ['Kevin', 'Raj', 'David', 'Vikram', 'Jason', 'Minh', 'Kenji', 'Arjun', 'Eric', 'Wei'], eu: ['Michael', 'Ryan', 'Tom', 'Greg', 'Matt', 'Chris', 'Jake', 'Ben'], la: ['Carlos', 'Luis', 'Diego', 'Javier', 'Miguel', 'Mateo', 'Jose'] },
};
const SURNAMES = { af: ['Johnson', 'Washington', 'Brooks', 'Jackson', 'Coleman', 'Harris'], as: ['Chen', 'Nguyen', 'Patel', 'Wong', 'Kim', 'Tanaka', 'Singh', 'Liu', 'Reddy'], eu: ['Miller', 'Anderson', 'Sullivan', "O'Brien", 'Keller', 'Walsh', 'Carter'], la: ['Garcia', 'Hernandez', 'Lopez', 'Martinez', 'Ramirez', 'Flores'] };
// work that fits the place and the age
const JOBS = {
	young: ['a student at Diablo Valley College', 'a barista', 'a nursing student', 'working retail at the mall', 'a lifeguard in summer', 'studying computer science at Cal'],
	suburb: ['a software engineer at Bishop Ranch', 'a teacher at the high school', 'a nurse at San Ramon Regional', 'a real estate agent', 'a product manager, working from home', 'an accountant', 'a contractor', 'a small business owner', 'a physical therapist', 'a data analyst'],
	city: ['a line cook', 'a UX designer', 'a bike messenger', 'a startup founder', 'a Muni driver', 'a bartender', 'a paralegal', 'a muralist', 'a nurse at SF General'],
	island: ['a fisherman', 'a boat builder', 'running the village shop', 'a dive guide', 'mending nets', 'a marine biologist on a field season'],
	nature: ['a park ranger', 'a trail runner training for a race', 'a birdwatcher', 'a geology professor', 'a retired firefighter who hikes here every week'],
	old: ['retired from the phone company', 'a retired teacher', 'retired, volunteering at the library', 'a retired engineer', 'a grandparent out for their walk'],
};
const MOODS = ['calm', 'happy', 'tired', 'busy', 'curious', 'cheerful', 'thoughtful'];
const ERRANDS = ['on the way to get coffee', 'walking the long way home', 'heading to pick up the kids', 'stretching their legs between calls', 'on a lunch break', 'out to meet a friend', 'getting some air', 'on the way to the farmers market'];

export function personaFor(P, where) {
	// out in the world the regional kit knows who people are here (region/)
	const H = regionalNow();
	if (H?.kit && H.culture) return regionalPersona(P, H);
	const d = P.dna, r = rng(d.seed * 7919 + 17), T = d.temper || { outgoing: 0.5, confident: 0.5, warmth: 0.5, fidget: 0.5 };
	const [af, as, eu] = d.ancestry;
	const group = as > 0.55 ? 'as' : af > 0.55 ? 'af' : eu > 0.6 && r() < 0.35 ? 'la' : eu > 0.55 ? 'eu' : r() < 0.5 ? 'la' : pick(r, ['af', 'as', 'eu']);
	const first = pick(r, NAMES[d.male ? 'm' : 'f'][group]), last = pick(r, SURNAMES[r() < 0.8 ? group : pick(r, ['af', 'as', 'eu', 'la'])]);
	const age = Math.round(d.age);
	const kind = where.kind || 'suburb';
	const job = age < 23 ? pick(r, JOBS.young) : age > 66 ? pick(r, JOBS.old) : pick(r, JOBS[kind] || JOBS.suburb);
	const years = Math.max(1, Math.min(age - 5, Math.round(2 + r() * 30)));
	const style = [
		T.outgoing > 0.65 ? 'chatty and animated' : T.outgoing < 0.3 ? 'quiet, a person of few words' : 'friendly but brief',
		T.warmth > 0.6 ? 'warm' : T.warmth < 0.3 ? 'a little guarded with strangers' : 'polite',
		T.confident > 0.65 ? 'self-assured' : T.confident < 0.3 ? 'a bit shy' : '',
	].filter(Boolean).join(', ');
	return {
		name: `${first} ${last}`, first, age, job, place: where.name, kind, years,
		mood: pick(r, MOODS), errand: pick(r, ERRANDS), style, temper: T,
		// the tattoos they have, and why (the same ones their body wears: tattoo/lore.js)
		tattoos: inkStory(d),
		hobby: pick(r, ['hiking Mount Diablo', 'pickup basketball', 'baking bread', 'a book club', 'surfing at Pacifica', 'gardening', 'birding', 'cycling the Iron Horse Trail', 'photography', 'playing guitar', 'the Warriors', 'cooking for too many people']),
	};
}

// someone met out in the world: a name of their own people, work and a day that fit the
// place, and the regional sheet (region/talk.js): the greeting, the weather, the food, the
// landmark's story, the road on
function regionalPersona(P, H) {
	const d = P.dna, r = rng(d.seed * 7919 + 17), T = d.temper || { outgoing: 0.5, confident: 0.5, warmth: 0.5, fidget: 0.5 };
	const F = H.kit.folk || {}, nm = nameFor(H.culture, d.male, r), age = Math.round(d.age);
	const work = P.job || pick(r, F.jobs || JOBS.suburb);
	const job = age < 20 ? 'still at school, helping out at home' : age > 68 ? `retired now; ${work.replace(/^(a|an) /, 'was a ')} for most of a lifetime` : work;
	const style = [
		T.outgoing > 0.65 ? 'chatty and animated' : T.outgoing < 0.3 ? 'quiet, a person of few words' : 'friendly but brief',
		T.warmth > 0.6 ? 'warm and welcoming' : T.warmth < 0.3 ? 'reserved with strangers at first' : 'polite',
		T.confident > 0.65 ? 'self-assured' : T.confident < 0.3 ? 'a bit shy' : '',
	].filter(Boolean).join(', ');
	const sheet = regionalSheet(H, r);
	return {
		name: nm.name, first: nm.first, age, job, place: sheet.place, kind: H.kit.id, years: Math.max(1, Math.min(age - 3, Math.round(5 + r() * 40))),
		mood: pick(r, MOODS), errand: P.errand || pick(r, F.errands || ERRANDS), style, temper: T,
		tattoos: inkStory(d), hobby: pick(r, F.hobbies || ['walking']), local: sheet,
		// what the cloud voice reads (guide.js npcFor): the region, the language, local facts
		region: sheet.country && !sheet.country.includes(sheet.region) && sheet.region !== sheet.place ? `${sheet.region}, ${sheet.country}` : sheet.country || sheet.region || '', lang: sheet.lang, facts: localFacts(sheet),
	};
}
// short plain facts of the place for the cloud voice
function localFacts(R) {
	const F = [];
	if (R.kit) F.push(`lives in ${R.place}, ${/^[aeiou]/i.test(R.kit) ? 'an' : 'a'} ${R.kit}`);
	F.push(`it is ${R.month}${R.season ? `, the ${R.season} season here` : ''}, about ${R.f ? Math.round(R.temp * 9 / 5 + 32) + '°F' : R.temp + '°C'}: ${R.weather}`);
	F.push(`greets people with "${R.greet.text}"${R.greet.mean ? ` (meaning "${R.greet.mean}")` : ''} and says goodbye with "${R.bye}"; speaks plain English with the player, never an accent`);
	if (R.word) F.push(`a word of the language: "${R.word.word}" means ${R.word.mean}`);
	if (R.foods.length) F.push('local food: ' + R.foods.join(', '));
	if (R.landmark) F.push(`nearby: ${R.landmark.name}, ${R.landmark.km} km ${R.landmark.dir}; ${R.landmark.real ? 'what people say of it' : 'the local legend'}: ${R.landmark.tale}`);
	if (R.onward) F.push(`the road on: ${R.onward.name}, about ${R.onward.km} km ${R.onward.dir}${R.travel ? ', ' + R.travel : ''}`);
	if (R.known) F.push('the town nearby is known for ' + R.known);
	return F;
}
// the regional part of the prompt: where they live, said plainly
function regionPrompt(p) {
	const R = p.local;
	if (!R) return '';
	const unit = R.f ? 'F' : 'C', t = R.f ? Math.round(R.temp * 9 / 5 + 32) : R.temp;
	return `WHERE YOU LIVE: ${R.place}${R.region && R.region !== R.place ? `, ${R.region}` : ''}${R.country ? `, ${R.country}` : ''} (${R.kit}). It is ${R.month}, ${R.season ? `the ${R.season} here` : ''}; about ${t}°${unit} just now. ${R.weather}
YOUR LANGUAGE: ${R.lang ? `${R.lang}. ` : ''}You greet people with "${R.greet.text}"${R.greet.mean ? ` (it means "${R.greet.mean}")` : ''} and say goodbye with "${R.bye}". You talk with the player in plain English, and may use a word of your own language when it is natural, saying what it means${R.word ? ` (for example "${R.word.word}": ${R.word.mean})` : ''}. Never put on an accent.
FOOD HERE: ${R.foods.join(', ')}.
${R.landmark ? `NEARBY: ${R.landmark.name}, ${R.landmark.km} km ${R.landmark.dir}. ${R.landmark.real ? 'What people say of it' : 'The story people here tell of it'}: ${R.landmark.tale}
` : ''}${R.onward ? `THE ROAD ON: ${R.onward.name}, about ${R.onward.km} km ${R.onward.dir}; people go ${R.travel}.
` : ''}${R.known ? `WHAT THE TOWN NEAR YOU IS KNOWN FOR: ${R.known}
` : ''}${R.chatter.length ? `THINGS PEOPLE HERE SAY: ${R.chatter.join(' / ')}
` : ''}You are an ordinary person from here, not a guide and not a type: speak about your home with warmth and dignity, from your own life, and never mock anyone's customs or faith.
`;
}

export function personaPrompt(p, world) {
	return `You are ${p.name}, a real person the player has just stopped on the street in ${p.place}. You are ${p.age}, ${p.job}, and you have lived around here about ${p.years} years. Right now you are ${p.errand}; you feel ${p.mood}. You are ${p.style}. You like ${p.hobby}.
Talk like a normal person, not an assistant: short (usually one or two sentences), casual, in your own voice, with your own opinions and small details of your life. You don't know you are in a game. Never make up facts about real places beyond everyday local knowledge; if unsure, say so. If the player is rude you can end the chat politely.
If the player asks what to do or where to go, you can send them somewhere from the list below, as a favour or a tip, by adding [[quest: PLACE]] with the place's exact name (only places in the list).
Start every reply with your mood in double brackets, one of: happy, calm, surprised, sad, annoyed, amused, thoughtful. You may add one gesture in double brackets when it fits: wave, nod, shake, shrug, point, laugh, think, open, explain, emphatic, bow. Example: [[mood: amused]] [[gesture: laugh]] Ha, not today.
${regionPrompt(p)}${p.tattoos?.length ? `YOUR TATTOOS (you know their stories; talk about them only if asked or it comes up naturally): ${p.tattoos.join('; ')}.\n` : 'You have no tattoos.\n'}WHAT YOU CAN SEE AROUND YOU: ${JSON.stringify(world)}`;
}

// ---------- without a model: simple, in character ----------
export function personaOffline(p, text, world) {
	const q = text.toLowerCase();
	if (p.local) { const a = regionalOffline(p, q); if (a) return a; }
	const near = world?.near?.[0];
	if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(q)) return `[[mood: happy]] [[gesture: wave]] Hey! I'm ${p.first}.`;
	if (/your name|who are you/.test(q)) return `[[mood: calm]] I'm ${p.first}. ${p.first === p.name ? '' : 'Nice to meet you.'}`;
	if (/what do you do|your job|work/.test(q)) return `[[mood: calm]] [[gesture: explain]] I'm ${p.job}.`;
	if (/where am i|where are we|what (town|city|place)/.test(q)) return `[[mood: amused]] [[gesture: open]] This is ${p.place}. Been here about ${p.years} years.`;
	if (/how are you|how's it going|how you doing/.test(q)) return `[[mood: ${p.mood === 'tired' ? 'calm' : 'happy'}]] Pretty good — ${p.mood}, I guess. I'm ${p.errand}.`;
	if (/where.*(go|visit|see)|recommend|what.*(do|should)|bored|any (tips|ideas)/.test(q)) {
		const pickN = world?.near?.[1 + (p.age % 3)] || near;
		return pickN ? `[[mood: happy]] [[gesture: point]] Go see ${pickN.name} — ${pickN.dir}, about ${pickN.dist}. Tell me what you think. [[quest: ${pickN.name}]]` : '[[mood: thoughtful]] [[gesture: shrug]] Honestly? Just walk around. It\'s nice.';
	}
	if (/tattoo|\bink\b|inked/.test(q)) {
		const t = p.tattoos || [];
		return t.length ? `[[mood: ${p.temper.warmth > 0.4 ? 'happy' : 'calm'}]] [[gesture: ${t.length > 1 ? 'explain' : 'open'}]] ${t[0][0].toUpperCase() + t[0].slice(1)}.${t.length > 1 ? ` And ${t.length - 1 === 1 ? 'one more' : `${t.length - 1} more`}; ask me another time.` : ''}` : '[[mood: amused]] [[gesture: shrug]] Not one. Never could decide on anything forever.';
	}
	if (/weather|hot|cold|rain/.test(q)) return '[[mood: calm]] [[gesture: shrug]] Typical — cool mornings, warm afternoons.';
	if (/bye|see you|later|thanks|thank you/.test(q)) return '[[mood: happy]] [[gesture: wave]] Take care!';
	if (/\?$/.test(q.trim())) return `[[mood: thoughtful]] [[gesture: shrug]] Hm, not sure. I mostly know ${p.place}.`;
	return `[[mood: calm]] [[gesture: nod]] Yeah. ${p.hobby ? `Anyway, I should get back to it — I'm ${p.errand}.` : ''}`;
}

// without a model, out in the world: the greeting with its meaning, the weather, the food,
// the landmark's story, the road on, a word of the language
function regionalOffline(p, q) {
	const R = p.local, g = R.greet, r = rng((p.age * 131 + q.length * 7 + (Date.now() / 60000 | 0)) >>> 0);
	if (/^(hi|hey|hello|yo|good (morning|afternoon|evening)|greetings|salaam|salam|namaste|hola|bonjour|ni hao|konnichiwa)\b/.test(q)) return `[[mood: happy]] [[gesture: wave]] ${g.text}${g.mean && !g.english ? ` That's "${g.mean}".` : ''} I'm ${p.first}.`;
	if (/your name|who are you/.test(q)) return `[[mood: calm]] ${p.first}. ${p.name !== p.first ? `${p.name}, in full.` : ''}`.trim();
	if (/what do you do|your job|work|for a living/.test(q)) return `[[mood: calm]] [[gesture: explain]] I'm ${p.job}. ${R.chatter.length ? pick(r, R.chatter) : ''}`.trim();
	if (/where am i|where are we|what (town|city|place|village)|this place/.test(q)) return `[[mood: amused]] [[gesture: open]] This is ${R.place}${R.region && R.region !== R.place ? `, in ${R.region}` : ''}. Been here about ${p.years} years.`;
	if (/weather|cold|hot|rain|snow|warm|season|winter|summer|monsoon|ice|wind/.test(q)) return `[[mood: calm]] [[gesture: shrug]] ${R.weather}`;
	if (/what language|do you speak|speak here/.test(q) && R.lang) return `[[mood: happy]] [[gesture: explain]] ${R.lang[0].toUpperCase() + R.lang.slice(1)}, mostly.${R.word ? ` Here's one: "${R.word.word}", it means ${R.word.mean}.` : ''}`;
	if (/\b(word|language|how do you say|mean|speak)/.test(q) && R.word) return `[[mood: amused]] [[gesture: explain]] Here we say "${R.word.word}": it means ${R.word.mean}.`;
	if (/\b(food|eat|hungry|dish|drink|tea|coffee|cook|dinner|lunch|breakfast)\b/.test(q) && R.food) return `[[mood: happy]] [[gesture: explain]] ${R.food}`;
	if (/story|legend|landmark|history|tower|ruin|shrine|temple|mosque|church|wreck|old|what('s| is) (that|there)|see here|visit/.test(q) && R.landmark) return `[[mood: thoughtful]] [[gesture: point]] ${R.landmark.line}`;
	if (/road|next town|onward|further|travel|leave|direction|where.*(go|head)/.test(q)) return `[[mood: calm]] [[gesture: point]] ${R.onward ? R.onward.line : `Nothing close by road from here. People go ${R.travel || 'the long way round'}.`}`;
	if (/bye|see you|later|thanks|thank you|goodbye/.test(q)) return `[[mood: happy]] [[gesture: wave]] ${R.bye}`;
	if (/how are you|how's it going|how you doing/.test(q)) return `[[mood: happy]] Well, thank you. I'm ${p.errand}.`;
	if (/\?$/.test(q.trim())) return `[[mood: thoughtful]] [[gesture: shrug]] ${pick(r, [R.weather, R.chatter.length ? pick(r, R.chatter) : R.weather, R.landmark ? R.landmark.line : R.weather])}`;
	return null;
}

// ---------- the body, from the words ----------
export const TAG_RE = /\[\[\s*(mood|gesture)\s*:\s*([a-z ]+)\]\]/gi;
const MOOD_FEEL = { happy: ['joy', 0.8], amused: ['joy', 1], calm: ['joy', 0.2], surprised: ['surprise', 1], sad: ['sad', 0.8], annoyed: ['anger', 0.7], thoughtful: ['sad', 0.1] };
// a sentence's body language: the tagged gesture first, else what the words suggest
export function bodyFor(sentence, T = { outgoing: 0.5 }) {
	const s = sentence.toLowerCase(), out = { gestures: [], feel: null };
	let m;
	TAG_RE.lastIndex = 0;
	while ((m = TAG_RE.exec(sentence))) {
		const v = m[2].trim();
		if (m[1].toLowerCase() === 'mood' && MOOD_FEEL[v]) out.feel = MOOD_FEEL[v];
		if (m[1].toLowerCase() === 'gesture') out.gestures.push(v === 'nod' || v === 'shake' ? v : v);
	}
	const plain = s.replace(TAG_RE, '').trim();
	if (!plain) return out;
	if (!out.gestures.length) {
		if (/^(yes|yeah|yep|sure|of course|definitely|totally|absolutely|right)\b/.test(plain)) out.gestures.push('nod');
		else if (/^(no|nope|nah|not really|never)\b/.test(plain)) out.gestures.push('shake');
		else if (/\b(ha(ha)+|lol|funny|joking|kidding)\b/.test(plain)) out.gestures.push('laugh');
		else if (/\b(hi|hello|hey|bye|see you|take care)\b/.test(plain)) out.gestures.push('wave');
		else if (/\b(over there|that way|up (the|that)|down (the|that)|north|south|east|west|behind you|across)\b/.test(plain)) out.gestures.push('point');
		else if (/\b(i think|maybe|hmm|let me think|not sure|i guess|probably)\b/.test(plain)) out.gestures.push('think');
		else if (/\b(who knows|no idea|dunno|don't know|whatever)\b/.test(plain)) out.gestures.push('shrug');
		else if (/!/.test(plain) && T.outgoing > 0.4) out.gestures.push('emphatic');
		else if (/\?$/.test(plain)) out.gestures.push('open');
		else if (plain.length > 50 && T.outgoing > 0.3) out.gestures.push('explain');
	}
	if (!out.feel) {
		if (/\b(love|great|awesome|nice|beautiful|glad|happy|fun)\b/.test(plain)) out.feel = ['joy', 0.7];
		else if (/\b(sad|sorry|unfortunately|miss|lost)\b/.test(plain)) out.feel = ['sad', 0.6];
		else if (/\b(wow|really\?|no way|seriously)\b/.test(plain)) out.feel = ['surprise', 0.8];
	}
	return out;
}
