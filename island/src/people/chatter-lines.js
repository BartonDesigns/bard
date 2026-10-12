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
const DRIVER = ['Hey! Slow down!', 'Whoa! This is a sidewalk!', 'Are you kidding me? Slow down!'];
const HURT = ['Oh my gosh, are you okay? You’re bleeding.', 'Hey, you need a doctor.', 'You look hurt. Do you need help?'];
const WORK = ['Back to it.', 'Busy, busy.', 'One more hour.', 'Hey. Don’t mind me.'];
const VENDOR = ['Take a look, no pressure!', 'Hi! Let me know if you need anything.'];
const KID = ['Hi!', 'Hello!', 'Bye!'];

// fear: the same order of facts as contextualOpening
function afraid(c, n) {
	if (c.aimedAt) return { text: pick(['Whoa, whoa! Please, don’t shoot!', 'Put that down! Please!', 'Oh my god. Please, I don’t want any trouble.'], n), gesture: 'shake', feel: { surprise: 1 } };
	if (c.harmful) return { text: pick(['Stay away from me!', 'That’s them! Don’t come any closer!', 'Please, just keep walking.'], n), gesture: 'shake', feel: { surprise: 0.8, sad: 0.3 } };
	if (c.reported) return { text: pick(['Is that the one they’re talking about?', 'Keep walking. Don’t look at them.', 'I heard what you did.'], n), gesture: 'shake', feel: { surprise: 0.4 } };
	if (c.wanted >= 2) return { text: pick(['The police are looking for you, you know.', 'I don’t want any trouble.', 'Somebody call the cops.'], n), gesture: 'shake', feel: { surprise: 0.5 } };
	if (c.danger || c.reportedDanger) return { text: pick(['Did you hear that? We should go.', 'Get off the street, something’s going on.', 'Is everyone okay over there?'], n), gesture: 'point', feel: { surprise: 0.7 } };
	return null;
}

// ctx: { seed, n, self:{ child, outgoing, warmth, mood, role, phone, work, vendor }, you:{ speed, vehicle,
//   aware (awarenessContext) }, scene:{ hour, rain, storm } }. Returns null for a passer-by who
// keeps to themselves, or { text, gesture, feel }; text may be '' for a nod alone.
export function remarkFor(ctx = {}) {
	const n = (ctx.seed | 0) + (ctx.n | 0), S = ctx.self || {}, Y = ctx.you || {}, E = ctx.scene || {}, c = Y.aware || {};
	const fear = afraid(c, n);
	if (fear) return fear;
	if (S.child) return (S.outgoing ?? 0.5) > 0.45 ? { text: pick(KID, n), gesture: 'wave', feel: { joy: 0.6 } } : null;
	if (Y.vehicle && Y.speed > 6) return { text: pick(DRIVER, n), gesture: 'shake', feel: { surprise: 1, anger: 0.5 } };
	if (c.injured || Y.injured) return { text: pick(HURT, n), gesture: 'open', feel: { surprise: 0.5, sad: 0.5 } };
	if (Y.speed > 7.5 && !Y.vehicle) return { text: pick(STARTLED, n), gesture: 'shrug', feel: { surprise: 1 } };
	if (S.role === 'jog') return { text: pick(JOGGER, n), gesture: null, feel: { joy: 0.2 } };
	if (S.phone) return { text: pick(ON_PHONE, n), gesture: 'explain', feel: {} };
	if (E.storm > 0.5) return { text: pick(STORM, n), gesture: 'point', feel: { surprise: 0.6 } };
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
export function exchangeFor({ seed = 0, n = 0, hour = 12, rain = 0 } = {}) {
	const pool = rain > 0.3 ? RAIN_PAIRS : partOfDay(hour) === 'late' || partOfDay(hour) === 'evening' ? [...NIGHT_PAIRS, ...PAIRS] : PAIRS;
	return pick(pool, (seed | 0) + (n | 0));
}

// how a voice is played for a body: a touch higher for the young, lower for the old, and
// a little of each person's own so two people on one voice do not sound like twins
export function voiceShape({ seed = 0, age = 35, male = true, teen = false } = {}) {
	const own = (((Math.abs(seed | 0) * 40503) % 1000) / 1000 - 0.5) * 0.06;
	const age1 = teen || age < 19 ? 0.05 : age > 65 ? -0.04 : age > 50 ? -0.02 : 0;
	return { pitch: Math.max(0.9, Math.min(1.12, 1 + age1 + own + (male ? 0 : 0.01))), rate: age > 68 ? 0.92 : teen ? 1.06 : 1 };
}
