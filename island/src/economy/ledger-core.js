// The ledger's arithmetic, shared by the game (bank.js) and the ledger Worker (server/ledger):
// what a household earns and spends, as a pure function of who lives there and the day. Wages
// on payday, a pension, rent and bills once a month, food every day, a child's allowance, lunch
// money on school days and clothes now and then; whatever is left goes on living, and what is
// left after that is what the house saves (or loses: some houses are going under, some are
// comfortable, as their work and their size decide, never who they are).
//
// Nothing is rolled at run time: the same household on the same day has the same balance on
// every device and on the server. Only what actually happened on top of that (a quest paid, a
// wallet stolen, a hospital bill) is kept, as a delta (bank.js).
//
//   profileOf(h, member?)   a household (people/households.js) or one roommate -> its plan
//   baseline(P, day)        its balance at the end of a day (days from EPOCH)
//   dayOf(ms), weekdayOf(day), nextDay(P, 'rent' | 'pay', day)

export const EPOCH = Date.UTC(2026, 0, 1);             // a Thursday
export const DAY_MS = 86400000;
export const dayOf = (ms = Date.now()) => Math.floor((ms - EPOCH) / DAY_MS);
export const weekdayOf = (day) => (((day + 4) % 7) + 7) % 7;      // 0 Sunday .. 6 Saturday
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// what a transaction was, as a small number (kept in the rings and sent to the server)
export const KIND = { wage: 1, bonus: 2, sale: 3, request: 4, allowance: 5, lunch: 6, clothes: 7, food: 8, rent: 9, bills: 10, gift: 11, theft: 12, robbed: 13, returned: 14, hospital: 15, purchase: 16, tip: 17, transfer: 18, fine: 19, pension: 20, betrayed: 21, found: 22, other: 23 };
export const KIND_NAME = Object.fromEntries(Object.entries(KIND).map(([k, v]) => [v, k]));
export const kindCode = (k) => (typeof k === 'number' ? k : KIND[k] ?? KIND.other);

// a seed and a salt to 0..1
function roll(seed, salt) {
	let n = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
	n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
	n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
	return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const PORTION = { baby: 0.35, little: 0.5, child: 0.75, teen: 1.15, adult: 1, elder: 0.85 };
const stage = (age) => age < 1 ? 'baby' : age < 5 ? 'little' : age < 13 ? 'child' : age < 18 ? 'teen' : age < 67 ? 'adult' : 'elder';
const r0 = (v) => Math.round(v);

// a household's money plan (weekly pay and pension, monthly rent and bills, daily food and
// living, the children's allowance, lunches and clothes, and what it started the year with).
// member: one roommate's own share of a shared house (roommates and single adults keep their own)
export function profileOf(h, member = null, { price = 1 } = {}) {
	const people = member ? [member] : h.members, n = member ? h.members.length : 1;
	const seed = (member ? member.seed : h.seed) >>> 0;
	const pay = people.reduce((a, m) => a + (m.job?.pay || 0), 0);
	const pension = people.filter((m) => m.age >= 67).length * 420 + (!member && people.every((m) => m.age < 18 || !m.job) ? 260 * Math.max(1, people.filter((m) => m.age >= 18 && m.age < 67).length) : 0);
	const minors = people.filter((m) => m.age < 18), school = minors.filter((m) => m.age >= 5).length;
	// (a house on little pay with children gets help with them)
	const help = pay + pension < 1000 ? 70 * minors.length : 0;
	const income = pay + pension + help;
	const mouths = people.reduce((a, m) => a + (PORTION[m.stage || stage(m.age)] || 1), 0);
	// rent by the size of the place, a share of a shared one; none in an encampment
	// (a house lives where it can afford: rent at most about two fifths of what comes in)
	const month = income * 52 / 12;
	const rent = h.unhoused ? 0 : r0(Math.max(220 / n, Math.min((560 + 260 * Math.min(4, h.members.length)) * (0.8 + roll(seed, 3) * 0.5) * price / n, month * (0.32 + roll(seed, 10) * 0.1))));
	const bills = h.unhoused ? 0 : r0(Math.min((90 + 30 * people.length) * (0.85 + roll(seed, 4) * 0.3) * price, Math.max(60, month * 0.1)));
	const food = r0(mouths * 11 * price * 10) / 10;
	const allowance = minors.filter((m) => m.age >= 6).reduce((a, m) => a + 4 + Math.floor(m.age), 0);
	const lunch = school * 4, clothes = minors.length * 25;
	// what the house means to put by each week, from its own circumstance: more mouths and less
	// work leave less; a few are behind and falling further
	const save = income > 0 ? (roll(seed, 5) * 0.22 - 0.06 - 0.02 * minors.length) : -0.02;
	const fixedW = rent * 12 / 52 + bills * 12 / 52 + food * 7 + allowance + lunch * 5 + clothes * 12 / 52;
	const living = Math.max(0, r0((income - fixedW - save * income) / 7 * 10) / 10);
	const start = r0(Math.max(-income * 0.5, income * (roll(seed, 6) * 4.2 - 0.3)));
	return { id: h.id + (member ? '.' + h.members.indexOf(member) : ''), start, pay, pension: pension + help, payday: 5, rent, rentDay: 1 + Math.floor(roll(seed, 7) * 27), bills, billDay: 1 + Math.floor(roll(seed, 8) * 27), food, living, allowance, lunch, clothes, clothesDay: Math.floor(roll(seed, 9) * 30), people: people.length, minors: minors.length, earners: people.filter((m) => m.job).length };
}

// how many times a weekday has come round in days 0..d
function weekdays(d, wd) {
	if (d < 0) return 0;
	const first = ((wd - weekdayOf(0)) % 7 + 7) % 7;
	return d < first ? 0 : Math.floor((d - first) / 7) + 1;
}
// how many times a day of a 30-day month has come round in days 0..d
const monthly = (d, at) => (d < at ? 0 : Math.floor((d - at) / 30) + 1);

// the balance at the end of day d (the start before day 0)
export function baseline(P, d) {
	if (!P) return 0;
	if (d < 0) return P.start;
	const pays = weekdays(d, P.payday), sats = weekdays(d, 6);
	let school = 0;
	for (let wd = 1; wd <= 5; wd++) school += weekdays(d, wd);
	const v = P.start + (P.pay + P.pension) * pays - P.rent * monthly(d, P.rentDay) - P.bills * monthly(d, P.billDay)
		- (P.food + P.living) * (d + 1) - P.allowance * sats - P.lunch * school - P.clothes * monthly(d, P.clothesDay);
	return Math.round(v);
}
// the next day (from day d, today included) a payment falls: 'rent', 'bills' or 'pay'
export function nextDay(P, what, d) {
	if (what === 'pay') return d + (((P.payday - weekdayOf(d)) % 7) + 7) % 7;
	const at = what === 'rent' ? P.rentDay : P.billDay;
	if (d <= at) return at;
	return d + ((at - d) % 30 + 30) % 30;
}
// what a house spends in a week, for judging how it is doing
export const weeklyCosts = (P) => P.rent * 12 / 52 + P.bills * 12 / 52 + (P.food + P.living) * 7 + P.allowance + P.lunch * 5 + P.clothes * 12 / 52;

// an account's stored state as the server settles it: events [day, amount, kind, counterparty, base]
// applied in order onto { dd (the delta over the baseline), sn (delta at the end of each day it
// changed, the last 90), tx (the last 20) }
export const RING = 20, SNAPS = 90;
export function applyEvents(S, events) {
	S = S || { dd: 0, sn: {}, tx: [] };
	// (an event marked base is already in the baseline, a regular wage seen being paid: it is
	// listed, but the balance does not move twice)
	for (const [day, amount, kind, cp, base] of [...events].sort((a, b) => a[0] - b[0])) {
		const a = Math.round(amount);
		if (!Number.isFinite(a) || !Number.isFinite(day)) continue;
		if (!base) { S.dd += a; S.sn[day] = S.dd; }
		const t = [day, a, kindCode(kind), cp ? String(cp).slice(0, 40) : ''];
		if (base) t.push(1);
		S.tx.push(t);
	}
	if (S.tx.length > RING) S.tx = S.tx.slice(-RING);
	const days = Object.keys(S.sn).map(Number).sort((a, b) => a - b);
	for (const d of days.slice(0, Math.max(0, days.length - SNAPS))) delete S.sn[d];
	return S;
}
// the delta as it stood at the end of day d (0 before anything happened)
export function deltaAt(S, d) {
	if (!S) return 0;
	let best = -Infinity, v = 0;
	for (const k in S.sn) { const day = +k; if (day <= d && day > best) { best = day; v = S.sn[k]; } }
	return v;
}
