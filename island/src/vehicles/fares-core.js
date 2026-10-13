// Fares: someone on the pavement hails you while you drive, you pull up, they get in, you take
// them where they are going. Pure: the fare, the tip, the stages and what passengers say.
// The scene and the people are in vehicles/fares.js.

const pick = (xs, n) => xs[Math.abs(Math.trunc(n)) % xs.length];

// the fare quoted at pickup: a flag fall and a rate by the metre, rounded to five
export function quote(metres) {
	return Math.round((18 + Math.max(0, metres) * 0.075) / 5) * 5;
}
// the time a fair driver needs (about 11 m/s through town, a margin for the lights)
export const expected = (metres) => 25 + metres / 9;

// paid at the kerb: the fare, and a tip for being quick and smooth (bumps and scrapes cost it)
export function settle({ metres, seconds, hits = 0, scares = 0 }) {
	const fare = quote(metres), par = expected(metres);
	const quick = seconds <= par ? 1 : Math.max(0, 1 - (seconds - par) / par);
	const smooth = Math.max(0, 1 - hits * 0.35 - scares * 0.12);
	const tip = Math.round(fare * 0.3 * quick * smooth / 5) * 5;
	const stars = Math.max(1, Math.min(5, Math.round(1 + 4 * (0.45 * smooth + 0.35 * quick + 0.2 * (hits ? 0 : 1)))));
	return { fare, tip, total: fare + tip, stars, quick: +quick.toFixed(2), smooth: +smooth.toFixed(2) };
}

// stages: hailing -> riding -> done; or lapsed (you drove off, or stopped driving)
export function step(F, ev) {
	if (!F || F.stage === 'done' || F.stage === 'lapsed') return { F, out: null };
	const to = (stage, out) => ({ F: { ...F, stage }, out });
	if (ev === 'board' && F.stage === 'hailing') return to('riding', { say: 'board' });
	if (ev === 'arrive' && F.stage === 'riding') return to('done', { done: true, say: 'thanks' });
	if (ev === 'leave') return to('lapsed', { lapsed: true, say: F.stage === 'riding' ? 'out' : null });
	return { F, out: null };
}

// what passengers say
export function line(kind, { n = 0, place = '', stars = 3 } = {}) {
	const L = {
		hail: ['Taxi! Over here!', 'Hey! Are you free?', 'Excuse me! Could you give me a ride?'],
		board: place ? [`Thanks for stopping. Could you take me to ${place}?`, `Oh, great. ${place}, please.`, `Perfect timing. I need to get to ${place}.`] : ['Thanks for stopping. Just follow the pin, please.', 'Oh, great. I will show you, it is where the pin is.'],
		fast: ['Whoa. Maybe a little slower?', 'We are not in that much of a hurry!', 'Is this a race now?'],
		hit: ['Ow! Careful!', 'Hey! Watch the road!', 'Was that a curb?', 'I felt that one.'],
		chat: ['Nice day for it.', 'I am running a little late, so thank you.', 'Have you been driving long?', 'Good music in here.', 'I usually take the bus, but today, no chance.'],
		near: ['This is me, just up here.', 'Anywhere along here is fine.', 'Here is great.'],
		thanks: stars >= 4 ? ['Thanks, that was quick! Have a good one.', 'Smooth ride. Thank you!', 'Five stars, honestly.'] : stars >= 3 ? ['Thanks for the ride.', 'Thanks. Take care.'] : ['I think I will walk next time.', 'Well, I am here. Thanks, I guess.'],
		out: ['Actually, I will get out here.', 'Never mind, I will walk from here.'],
	}[kind] || [''];
	return pick(L, n);
}
