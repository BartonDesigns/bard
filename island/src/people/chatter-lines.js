// What a passer-by says as you go past them, or what you overhear between two of them.
// Pure: it reads the moment and returns a line, a gesture and a face; it plays nothing.
// The fear lines follow the same facts as a conversation (people/world-awareness.js), so
// a witness never greets you warmly a minute after seeing you hurt someone.

const pick = (xs, n) => xs[Math.abs(Math.trunc(n)) % xs.length];

function partOfDay(hour) {
	if (hour < 4.5 || hour >= 21.5) return 'late';
	if (hour < 12) return 'morning';
	if (hour < 17) return 'afternoon';
	return 'evening';
}

const GREET = {
	morning: ['Morning.', 'Morning!', 'Hey, good morning.', 'Mornin’.'],
	afternoon: ['Hey.', 'Hi there.', 'Afternoon.', 'Hey, how’s it going?'],
	evening: ['Evening.', 'Hey, good evening.', 'Hi.', 'Have a good night.'],
	late: ['Hey.', 'Late one, huh?', 'Night.'],
};
const WARM = ['Beautiful day for it.', 'Hope your day’s going well!', 'Love that jacket, by the way.', 'Hey! You doing alright?', 'Oh, hi! Sorry, I was miles away.'];
const SHY = ['Oh, sorry.', 'Excuse me.', 'Hi.'];
const MOODY = {
	tired: ['Ugh. Long day.', 'I need a coffee. Badly.', 'Is it Friday yet?'],
	busy: ['Sorry, running late.', 'Can’t stop, sorry!', 'Ten minutes late already. Great.'],
	cheerful: ['Isn’t it a great day?', 'Hey there! Lovely out, huh?'],
	happy: ['Hey! Have a good one.', 'Hi! Nice to see someone smiling.'],
	thoughtful: ['Hm. Where did I park.', 'Now what was I supposed to pick up…'],
	curious: ['You’re not from around here, are you?', 'Huh. Haven’t seen you before.'],
	calm: ['Hey.', 'Nice and quiet today.'],
};
const ON_PHONE = ['No, I told you, Thursday. Thursday!', 'Yeah. Yeah. Uh huh. No, totally.', 'Can you hear me now? Hello?', 'Okay, I’m almost there. Two minutes.', 'Wait, say that again? You cut out.'];
const JOGGER = ['On your left!', 'Coming through!', 'Morning! Sorry!', 'Excuse me!'];
const RAIN = ['Of course it rains the one day I leave the umbrella.', 'Ugh, I’m soaked.', 'Did anyone say it would rain today?'];
const STORM = ['Whoa, that was close!', 'You should get inside, it’s getting bad out here.'];
const LATE = ['Bit late to be wandering around, isn’t it?', 'Get home safe.', 'Can’t sleep either, huh?'];
const STARTLED = ['Whoa! Watch it!', 'Hey, careful!', 'Jeez! Where’s the fire?', 'Woah, slow down!', 'Easy there!'];
const BUMPED = ['Oh! Excuse me.', 'Oops, sorry.', 'Hey, careful.', 'Whoa, personal space!', 'Watch where you are going.'];
const DRIVER = ['Hey! Slow down!', 'Whoa! This is a sidewalk!', 'Are you kidding me? Slow down!'];
const HURT = ['Oh my gosh, are you okay? You’re bleeding.', 'Hey, you need a doctor.', 'You look hurt. Do you need help?'];
const WORK = ['Back to it.', 'Busy, busy.', 'One more hour.', 'Hey. Don’t mind me.'];
const VENDOR = ['Take a look, no pressure!', 'Hi! Let me know if you need anything.'];
const KID = ['Hi!', 'Hello!', 'Bye!'];
// what people say once your name has got around (you.standing: { rep, favours, bounty, title })
const KNOWN_GOOD = ['Hey, you are the one who helps people out around here, right?', 'Thanks for everything you do around here.', 'Oh, hi! My neighbour told me about you.', 'Good to see you around.', 'Somebody told me you helped them out. That was kind of you.'];
const KNOWN_HERO = ['Hey! It is you! Everybody here knows your name.', 'Thank you. Seriously. For all of it.', 'Look who it is. Our local legend.'];
const KNOWN_BAD = ['Keep walking.', 'We know what you did.', 'Don\'t start anything here.', 'Stay away from my family.'];
const WANTED = ['Isn\'t that the one the patrol is after?', 'I am not getting involved.'];
// what they did or saw lately, among themselves (self.deed, people/npc-quests.js)
const DEED = {
	'got-back': ['Somebody handed my bag back. Can you believe it?', 'I left my bag on the sidewalk and a total stranger brought it back to me.', 'There are still decent people around. Someone just returned my bag.'],
	returned: ['Someone left their bag back there. I took it back to them.', 'Just ran a bag back to the person who left it. They were so relieved.'],
	helped: ['A stranger just did me a real favour.', 'Somebody helped me out just now, for nothing. Nice, right?'],
	robbed: ['Someone walked off with my bag. Right in front of me.', 'My bag is gone. Somebody just took it.'],
	'saw-theft': ['Did you see that? Somebody just walked off with a bag that was not theirs.', 'Keep an eye on your things. I just saw someone swipe a bag.'],
	'saw-return': ['Did you see that? Someone handed a lost bag right back.', 'That was nice to see. Someone gave a bag back to its owner.'],
	stole: ['What? I am just walking.', 'Mind your own business.'],
	cheated: ['Someone said they would help with my car, took my money and just walked off.', 'Never pay anyone up front. Learned that one today.'],
	'saw-bag': ['Somebody left their bag back there. Hope they get it back.', 'We saw a bag someone forgot. We told a grown-up.'],
};

// fear: the same order of facts as contextualOpening
function afraid(c, n) {
	if (c.aimedAt) return { text: pick(['Whoa, whoa! Please, don’t shoot!', 'Put that down! Please!', 'Oh my god. Please, I don’t want any trouble.'], n), gesture: 'shake', feel: { surprise: 1 } };
	if (c.harmful) return { text: pick(['Stay away from me!', 'That’s them! Don’t come any closer!', 'Please, just keep walking.'], n), gesture: 'shake', feel: { surprise: 0.8, sad: 0.3 } };
	if (c.reported) return { text: pick(['Is that the one they’re talking about?', 'Keep walking. Don’t look at them.', 'I heard what you did.'], n), gesture: 'shake', feel: { surprise: 0.4 } };
	if (c.wanted >= 2) return { text: pick(['The police are looking for you, you know.', 'I don’t want any trouble.', 'Somebody call the cops.'], n), gesture: 'shake', feel: { surprise: 0.5 } };
	if (c.danger || c.reportedDanger) return { text: pick(['Did you hear that? We should go.', 'Get off the street, something’s going on.', 'Is everyone okay over there?'], n), gesture: 'point', feel: { surprise: 0.7 } };
	return null;
}

// ctx: { seed, n, self:{ child, outgoing, warmth, mood, role, phone, work, vendor, deed, money, lead }, you:{ speed, vehicle,
//   aware (awarenessContext) }, scene:{ hour, rain, storm } }. Returns null for a passer-by who
// keeps to themselves, or { text, gesture, feel }; text may be '' for a nod alone.
export function remarkFor(ctx = {}) {
	const n = (ctx.seed | 0) + (ctx.n | 0), S = ctx.self || {}, Y = ctx.you || {}, E = ctx.scene || {}, c = Y.aware || {};
	const fear = afraid(c, n);
	if (fear) return fear;
	if (S.child) return (S.outgoing ?? 0.5) > 0.45 ? { text: pick(KID, n), gesture: 'wave', feel: { joy: 0.6 } } : null;
	if (Y.vehicle && Y.speed > 6) return { text: pick(DRIVER, n), gesture: 'shake', feel: { surprise: 1, anger: 0.5 } };
	if (c.injured || Y.injured) return { text: pick(HURT, n), gesture: 'open', feel: { surprise: 0.5, sad: 0.5 } };
	if (Y.bump && !Y.vehicle) return { text: pick(Y.speed > 7.5 ? STARTLED : BUMPED, n), gesture: 'shrug', feel: { surprise: 0.9, anger: Y.speed > 7.5 ? 0.4 : 0.1 } };
	if (Y.speed > 7.5 && !Y.vehicle) return { text: pick(STARTLED, n), gesture: 'shrug', feel: { surprise: 1 } };
	if (S.role === 'jog') return { text: pick(JOGGER, n), gesture: null, feel: { joy: 0.2 } };
	if (S.phone) return { text: pick(ON_PHONE, n), gesture: 'explain', feel: {} };
	if (E.storm > 0.5) return { text: pick(STORM, n), gesture: 'point', feel: { surprise: 0.6 } };
	if (S.money && ((n * 3266489917) >>> 0) % 100 < 12) return { text: S.money, gesture: 'explain', feel: {} };
	if (S.lead && (Math.imul(n, 668265263) >>> 0) % 100 < 45) return { text: S.lead, gesture: 'explain', feel: { surprise: 0.3 } };
	if (S.deed && DEED[S.deed] && ((n * 2246822519) >>> 0) % 100 < 70) return { text: pick(DEED[S.deed], n), gesture: S.deed === 'stole' ? 'shrug' : S.deed === 'robbed' ? 'shake' : 'explain', feel: S.deed === 'robbed' ? { sad: 0.6, anger: 0.4 } : S.deed === 'stole' ? {} : { joy: 0.5, surprise: 0.3 } };
	// your name, good or bad, has got around: some say so
	const K = Y.standing || {}, rk = ((n * 40503) >>> 0) % 100 / 100;
	if (K.bounty >= 1 && rk < 0.35) return { text: pick(WANTED, n), gesture: 'shake', feel: { surprise: 0.4 } };
	if ((K.rep ?? 0) < -30 && rk < 0.4) return { text: pick(KNOWN_BAD, n), gesture: 'shake', feel: { anger: 0.5 } };
	if (((K.favours ?? 0) >= 40 || (K.rep ?? 0) > 60) && rk < 0.35) return { text: pick(KNOWN_HERO, n), gesture: 'wave', feel: { joy: 1 } };
	if (((K.favours ?? 0) >= 5 || (K.rep ?? 0) > 30) && rk < 0.22) return { text: pick(KNOWN_GOOD, n), gesture: 'wave', feel: { joy: 0.8 } };
	const out = S.outgoing ?? 0.5, warm = S.warmth ?? 0.5;
	// most people just get on with their day: a quiet one nods, or does nothing at all
	const r = ((n * 2654435761) >>> 0) / 4294967296;
	if (r > 0.25 + out * 0.6) return r > 0.85 ? null : { text: '', gesture: 'nod', feel: { joy: 0.15 } };
	if (S.vendor) return { text: pick(VENDOR, n), gesture: 'open', feel: { joy: 0.4 } };
	if (S.work) return { text: pick(WORK, n), gesture: 'nod', feel: {} };
	if (E.rain > 0.3) return { text: pick(RAIN, n), gesture: 'shrug', feel: { sad: 0.3 } };
	const part = partOfDay(E.hour ?? 12);
	if (part === 'late' && r < 0.35) return { text: pick(LATE, n), gesture: 'nod', feel: {} };
	if (S.mood && MOODY[S.mood] && r < 0.3) return { text: pick(MOODY[S.mood], n), gesture: S.mood === 'tired' ? 'shrug' : 'nod', feel: { joy: S.mood === 'tired' || S.mood === 'busy' ? 0 : 0.4 } };
	if (warm > 0.65 && r < 0.45) return { text: pick(WARM, n), gesture: 'wave', feel: { joy: 0.7 } };
	if (out < 0.3) return { text: pick(SHY, n), gesture: 'nod', feel: {} };
	return { text: pick(GREET[part], n), gesture: r < 0.4 ? 'wave' : 'nod', feel: { joy: 0.4 } };
}

// two people talking as you pass: one says a line, the other answers in their own voice
const PAIRS = [
	['So did you end up going?', 'No. I bailed. I was just too tired.'],
	['And then she says, that’s not my dog!', 'No way. Stop it.'],
	['I swear the rent went up again.', 'Tell me about it. Ours too.'],
	['You still doing that class on Tuesdays?', 'Trying to. I missed the last two.'],
	['Wait, which one was the new place?', 'The one on the corner, with the blue door.'],
	['He said he’d call me back.', 'He’s not calling you back.'],
	['I think we took a wrong turn.', 'We definitely took a wrong turn.'],
	['You hungry?', 'Always. Where are we thinking?'],
	['Did you see the game last night?', 'Don’t. I don’t want to talk about it.'],
	['I’m so done with this week.', 'It’s only Tuesday!'],
	['My sister’s visiting this weekend.', 'Oh, that’s nice! Or, is it nice?'],
	['Okay, but hear me out.', 'Every time you say that…'],
	['I finally fixed the sink.', 'You? Fixed something? I need to see this.'],
	['So what did the doctor say?', 'Rest, water, the usual.'],
	['It’s supposed to be warm tomorrow.', 'Good. I’m sick of this jacket.'],
	['Did you lock the car?', 'I… think so?'],
];
const NIGHT_PAIRS = [
	['One more drink?', 'It’s a school night!'],
	['I can’t believe how late it got.', 'Time flies, huh.'],
	['Are we walking or getting a ride?', 'Walking. It’s a nice night.'],
];
const RAIN_PAIRS = [
	['It’s really coming down.', 'Let’s just wait it out under here.'],
	['You brought an umbrella, right?', 'I thought you brought the umbrella.'],
];
// at a table, over a meal or a coffee
const TABLE_PAIRS = [
	['How is yours?', 'Honestly? Better than last time.'],
	['Should we get dessert?', 'We always say no and then we get dessert.'],
	['This place got busy.', 'It always does around now.'],
	['Okay, your turn. How was the trip?', 'Long. Good, but long.'],
	['Do you want to split the check?', 'I got it. You got the last one.'],
	['I think they changed the menu.', 'They took off the good soup. Criminal.'],
];
// at work: a desk, a counter, a meeting
const WORK_PAIRS = [
	['Did you see the email?', 'Which one? There are forty.'],
	['Is the meeting still at three?', 'They moved it. Again.'],
	['Can you look at this before it goes out?', 'Send it over. Give me ten minutes.'],
	['Who has the numbers for this week?', 'I thought you had them.'],
	['We are almost out of the blue ones.', 'I will put in an order today.'],
	['Is the printer working?', 'Define working.'],
	['Busy morning.', 'Tell me about it. No lunch yet.'],
];
const VENDOR_PAIRS = [
	['Do you have this in another size?', 'Let me check in the back for you.'],
	['Is this the final price?', 'For you, I can do a little better.'],
	['Does this come with a warranty?', 'One year, parts and labor.'],
];
export function exchangeFor({ seed = 0, n = 0, hour = 12, rain = 0, work = null, seated = false } = {}) {
	const pool = work ? (work === 'vendor' || work === 'shopper' ? VENDOR_PAIRS : WORK_PAIRS) : seated ? TABLE_PAIRS : rain > 0.3 ? RAIN_PAIRS : partOfDay(hour) === 'late' || partOfDay(hour) === 'evening' ? [...NIGHT_PAIRS, ...PAIRS] : PAIRS;
	return pick(pool, (seed | 0) + (n | 0));
}

// how a voice is played for a body: a touch higher for the young, lower for the old, and
// a little of each person's own so two people on one voice do not sound like twins
export function voiceShape({ seed = 0, age = 35, male = true, teen = false, temper = null } = {}) {
	const own = (((Math.abs(seed | 0) * 40503) % 1000) / 1000 - 0.5) * 0.06;
	const age1 = teen || age < 19 ? 0.05 : age > 65 ? -0.04 : age > 50 ? -0.02 : 0;
	// (the outgoing talk a little quicker, the quiet a little slower)
	const pace = 0.96 + (temper?.outgoing ?? 0.5) * 0.08;
	return { pitch: Math.max(0.9, Math.min(1.12, 1 + age1 + own + (male ? 0 : 0.01))), rate: (age > 68 ? 0.92 : teen ? 1.06 : 1) * pace };
}
