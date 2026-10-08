// Households: who lives together, in which home. Families of every shape (two parents, a
// single mum or dad, three generations under one roof, grandparents raising their
// grandchildren, blended families), roommates, couples without children, people living
// alone, and the people of an encampment, who have no home but do have each other. Each
// member has an age, a part in the house, work (day, evening or night shifts, at home or
// away, or none), school for the young, and what they do after it. How much a house earns
// comes from the work its people do, never from who they are.
//
// All plain data from a seed: cheap to keep thousands of, the same every visit. Bodies are
// only made for the few you can see (family-life.js).

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function wpick(r, L) { let x = r() * L.reduce((a, b) => a + b[1], 0); for (const [k, w] of L) if ((x -= w) < 0) return k; return L[0][0]; }

// the shapes a household takes, and how common (weights, roughly as the census counts them)
export const KINDS = {
	'two-parent': 20, 'single-parent': 10, multigenerational: 9, 'grandparents-raising': 3, blended: 4,
	couple: 18, roommates: 8, single: 16, 'older-couple': 9, 'elder-alone': 3,
};
// a member's part in the house
export const ROLES = ['parent', 'grandparent', 'child', 'teen', 'adult', 'partner', 'roommate', 'elder', 'neighbour'];

// stage of life by age: for school, care and how much food
export const stageOf = (age) => age < 1 ? 'baby' : age < 5 ? 'little' : age < 13 ? 'child' : age < 18 ? 'teen' : age < 67 ? 'adult' : 'elder';
// a minor never left alone: anyone under thirteen needs someone with them, a teen of 13-15
// may be on their own by day for a few hours, not overnight
export const needsCare = (age) => age < 13;
export const needsNightCare = (age) => age < 16;
export const schoolOf = (age) => age < 3 ? null : age < 5 ? 'preschool' : age < 11 ? 'elementary' : age < 14 ? 'middle' : age < 18 ? 'high' : null;

// work: what kind, the hours (start, end, game hours), the days (0 Sunday .. 6 Saturday),
// and the weekly pay in credits. Night shifts run past midnight (end < start).
export const JOBS = {
	office: { start: 9, end: 17.5, days: [1, 2, 3, 4, 5], pay: 1300 },
	remote: { start: 8.5, end: 17, days: [1, 2, 3, 4, 5], pay: 1350, home: true },
	nurse: { start: 7, end: 19.5, days: [1, 3, 5], pay: 1500 },
	'night-nurse': { start: 19, end: 7.5, days: [0, 2, 4], pay: 1600, night: true },
	teacher: { start: 7.5, end: 16, days: [1, 2, 3, 4, 5], pay: 1100 },
	retail: { start: 10, end: 18.5, days: [2, 3, 4, 6, 0], pay: 650 },
	'evening-retail': { start: 15, end: 22, days: [1, 3, 5, 6], pay: 520 },
	cook: { start: 14, end: 22.5, days: [2, 3, 4, 5, 6], pay: 700 },
	driver: { start: 6, end: 14.5, days: [1, 2, 3, 4, 5], pay: 900 },
	trades: { start: 7, end: 15.5, days: [1, 2, 3, 4, 5], pay: 1150 },
	warehouse: { start: 22, end: 6.5, days: [1, 2, 3, 4, 5], pay: 880, night: true },
	cleaner: { start: 18, end: 23, days: [1, 2, 3, 4, 5], pay: 560 },
	'part-time': { start: 9.5, end: 14, days: [1, 2, 3, 4, 5], pay: 480 },
	fisher: { start: 4.5, end: 12, days: [1, 2, 3, 4, 5, 6], pay: 600 },
	farmer: { start: 6, end: 16, days: [1, 2, 3, 4, 5, 6], pay: 650 },
	'teen-job': { start: 10, end: 15, days: [6, 0], pay: 140 },
};
const DAY_JOBS = ['office', 'remote', 'teacher', 'retail', 'driver', 'trades', 'nurse', 'part-time'];
const ANY_JOBS = [...DAY_JOBS, 'night-nurse', 'cook', 'warehouse', 'cleaner', 'evening-retail'];
// what the young do after school (some days a week)
export const CLUBS = ['soccer', 'basketball', 'swim team', 'robotics', 'band', 'art club', 'drama', 'after-school program', 'chess club', 'track', 'dance', 'homework club', 'garden club'];
// what a house does on a weekend morning, and their community (a faith, volunteering, a
// club, family), all kinds and none
export const WEEKEND = ['park', 'market', 'sports', 'family visit', 'library', 'hike', 'beach', 'home'];
export const COMMUNITY = ['church', 'mosque', 'temple', 'synagogue', 'gurdwara', 'community centre', 'volunteering', 'sports club', null, null, null];

// the mix of a place: { mix: [[ancestry triple, weight]...] } from region/cultures.js, or
// the Bay's own; a household's members mostly share one, sometimes two (families blend)
const BAY = [[[0.05, 0.85, 0.1], 34], [[0.02, 0.06, 0.92], 28], [[0.18, 0.2, 0.62], 20], [[0.85, 0.02, 0.13], 10], [[0.34, 0.33, 0.33], 8]];
function ancestry(r, mix = BAY) { const a = wpick(r, mix.map((m, i) => [i, m[1]])); return mix[a][0].map((v) => v * (0.85 + r() * 0.3)); }

function member(r, h, role, age, sex, anc) {
	const m = { id: `${h.id}.${h.members.length}`, role, age: Math.round(age * 10) / 10, male: sex === undefined ? r() < 0.5 : sex, seed: (r() * 4294967296) >>> 0, ancestry: anc, job: null, school: schoolOf(age), club: null, carer: false };
	m.stage = stageOf(m.age); m.minor = m.age < 18;
	h.members.push(m);
	return m;
}
function work(r, m, list, chance = 0.88) {
	if (r() > chance) return;
	const k = pick(r, list), J = JOBS[k];
	m.job = { kind: k, start: J.start, end: J.end, days: J.days.slice(), pay: Math.round(J.pay * (0.75 + r() * 0.6)), night: !!J.night, home: !!J.home };
}

// one household, for a home: { id, kind, members, home, income, ... }
export function makeHousehold(seed, home = null, opts = {}) {
	const r = rng(seed ^ 0x40053);
	const kind = opts.kind || wpick(r, Object.entries(opts.weights || KINDS));
	const h = { id: opts.id || `h${(seed >>> 0).toString(36)}`, seed, kind, home, members: [], community: pick(r, COMMUNITY), weekend: pick(r, WEEKEND), helpers: [] };
	const mix = opts.mix;
	const anc = ancestry(r, mix), anc2 = r() < 0.25 ? ancestry(r, mix) : anc;
	const blend = (a, b) => a.map((v, i) => (v + b[i]) / 2);
	// children: one to four, their ages spread like siblings'
	const kids = (base, n) => {
		const ages = [];
		let a = base;
		for (let i = 0; i < n; i++) { ages.push(clamp(a, 0.5, 17.8)); a -= 1.5 + r() * 4; }
		return ages.filter((x) => x >= 0.5);
	};
	const nKids = () => wpick(r, [[1, 4], [2, 4], [3, 1.6], [4, 0.5]]);
	const childAnc = blend(anc, anc2);
	const addKids = (oldest, n) => { for (const a of kids(oldest, n)) member(r, h, a >= 13 ? 'teen' : 'child', a, undefined, childAnc); };
	const parentAge = () => 26 + r() * 22;
	if (kind === 'two-parent' || kind === 'blended') {
		const a = member(r, h, 'parent', parentAge(), undefined, anc);
		// partners of either sex (about one family in thirty has two mums or two dads)
		member(r, h, 'parent', clamp(a.age + (r() - 0.5) * 8, 22, 60), r() < 0.035 ? a.male : !a.male, anc2);
		addKids(clamp(a.age - 22 - r() * 6, 1, 17.8), nKids());
		if (kind === 'blended') addKids(clamp(a.age - 20 - r() * 10, 3, 17), 1);
	} else if (kind === 'single-parent') {
		// single mums and single dads alike
		const a = member(r, h, 'parent', parentAge(), r() < 0.35, anc);
		addKids(clamp(a.age - 20 - r() * 8, 1, 17.8), nKids());
	} else if (kind === 'multigenerational') {
		const g = member(r, h, 'grandparent', 60 + r() * 22, undefined, anc);
		if (r() < 0.55) member(r, h, 'grandparent', clamp(g.age + (r() - 0.5) * 8, 58, 90), !g.male, anc);
		const a = member(r, h, 'parent', clamp(g.age - 24 - r() * 8, 24, 55), undefined, anc);
		if (r() < 0.7) member(r, h, 'parent', clamp(a.age + (r() - 0.5) * 6, 22, 58), !a.male, anc2);
		addKids(clamp(a.age - 22 - r() * 6, 1, 17.8), nKids());
	} else if (kind === 'grandparents-raising') {
		const g = member(r, h, 'grandparent', 54 + r() * 20, undefined, anc);
		if (r() < 0.6) member(r, h, 'grandparent', clamp(g.age + (r() - 0.5) * 8, 52, 85), !g.male, anc);
		addKids(4 + r() * 13, wpick(r, [[1, 3], [2, 3], [3, 1]]));
	} else if (kind === 'couple') {
		const a = member(r, h, 'partner', 23 + r() * 40, undefined, anc);
		member(r, h, 'partner', clamp(a.age + (r() - 0.5) * 8, 21, 70), r() < 0.06 ? a.male : !a.male, anc2);
	} else if (kind === 'older-couple') {
		const a = member(r, h, 'partner', 64 + r() * 22, undefined, anc);
		member(r, h, 'partner', clamp(a.age + (r() - 0.5) * 6, 60, 92), r() < 0.04 ? a.male : !a.male, anc2);
	} else if (kind === 'roommates') {
		const n = 2 + Math.floor(r() * 3);
		for (let i = 0; i < n; i++) member(r, h, 'roommate', 20 + r() * 16, undefined, ancestry(r, mix));
	} else if (kind === 'single') member(r, h, 'adult', 22 + r() * 42, undefined, anc);
	else if (kind === 'elder-alone') member(r, h, 'elder', 70 + r() * 22, undefined, anc);
	else if (kind === 'encampment') {
		// neighbours in a camp: grown-ups, sometimes an older couple; their own dignity, their
		// own reasons, and the food bank and the community kitchen are for them too
		const n = 1 + Math.floor(r() * 3);
		for (let i = 0; i < n; i++) member(r, h, 'adult', 24 + r() * 44, undefined, ancestry(r, mix));
		h.unhoused = true;
	}
	// work for the grown-ups of working age; a parent of a baby is sometimes home with them
	const baby = h.members.some((m) => m.age < 1.5);
	for (const m of h.members) {
		if (m.age >= 18 && m.age < 67) {
			const list = opts.rural ? ['farmer', 'fisher', 'trades', 'driver', 'retail', 'teacher', 'part-time'] : ANY_JOBS;
			work(r, m, list, h.unhoused ? 0.35 : m.role === 'parent' && baby && r() < 0.5 ? 0 : 0.9);
		} else if (m.age >= 67 && r() < 0.12) work(r, m, ['part-time', 'retail'], 1);
		// sixteen and seventeen: a weekend job for some
		else if (m.age >= 16 && m.age < 18 && r() < 0.4) { const J = JOBS['teen-job']; m.job = { kind: 'teen-job', start: J.start, end: J.end, days: J.days.slice(), pay: J.pay, night: false, home: false }; }
		if (m.age >= 5 && m.age < 18 && r() < 0.5) m.club = { kind: pick(r, CLUBS), days: r() < 0.5 ? [1, 3] : [2, 4], end: 17 + (r() < 0.4 ? 0.5 : 0) };
	}
	// the people round them who help: a grandparent across town, a neighbour, a friend's
	// family (they can watch the children for a while; family-run households lean on them)
	const hasKids = h.members.some((m) => needsCare(m.age));
	if (hasKids) {
		if (r() < 0.55) h.helpers.push({ kind: 'grandparent', id: `${h.id}.g`, from: 6, to: 23, night: r() < 0.7 });
		if (r() < 0.6) h.helpers.push({ kind: 'neighbour', id: `${h.id}.n`, from: 14.5, to: 19.5, night: false });
		if (r() < 0.3) h.helpers.push({ kind: 'friend', id: `${h.id}.f`, from: 15, to: 18, night: false });
	}
	h.income = h.members.reduce((a, m) => a + (m.job?.pay || 0), 0);
	// a little support for older people and those without work (pensions, benefits)
	h.income += h.members.filter((m) => m.age >= 67).length * 420 + (h.income === 0 ? 260 * Math.max(1, h.members.filter((m) => m.age >= 18).length) : 0);
	h.size = h.members.length;
	return h;
}

// the households of a neighbourhood: one for each home given ({ x, z, kind }), and an
// encampment or two where there is one (opts.camps: [{ x, z }])
export function makeHouseholds(seed, homes = [], opts = {}) {
	const out = [];
	homes.forEach((home, i) => out.push(makeHousehold(((seed >>> 0) + i * 2654435761) >>> 0, home, { ...opts, id: `h${(seed >>> 0).toString(36)}-${i}` })));
	(opts.camps || []).forEach((c, i) => out.push(makeHousehold(((seed ^ 0xca4b) + i * 40503) >>> 0, c, { ...opts, kind: 'encampment', id: `c${(seed >>> 0).toString(36)}-${i}` })));
	return out;
}

// everyone under eighteen in a house
export const minorsOf = (h) => h.members.filter((m) => m.age < 18);
export const adultsOf = (h) => h.members.filter((m) => m.age >= 18);
// how many mouths, in grown-up portions (a toddler eats about half, a teen more than most)
export const PORTION = { baby: 0.35, little: 0.5, child: 0.75, teen: 1.15, adult: 1, elder: 0.85 };
export const mouths = (h) => h.members.reduce((a, m) => a + PORTION[m.stage], 0);
// a sentence for the house, for the persona and the page
export function describe(h) {
	const K = { 'two-parent': 'two parents and their kids', 'single-parent': 'a single parent and their kids', multigenerational: 'three generations under one roof', 'grandparents-raising': 'grandparents raising their grandkids', blended: 'a blended family', couple: 'a couple', roommates: 'roommates sharing a place', single: 'someone living on their own', 'older-couple': 'an older couple', 'elder-alone': 'an older person living alone', encampment: 'neighbours at the encampment' };
	const kids = minorsOf(h).map((m) => Math.floor(m.age));
	return `${K[h.kind] || h.kind}${kids.length ? ` (kids aged ${kids.join(', ')})` : ''}`;
}
