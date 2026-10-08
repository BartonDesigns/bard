// Teenagers, thirteen to seventeen: between the children and the grown-ups in body, dress,
// what they do and how they talk. A teen's body is the base mesh's child shape grown part
// of the way to a young adult's (girls a year or two ahead of boys), at a height between a
// child's and the grown-up they will be, some lanky, some sturdy, some still small. They
// dress like teenagers (hoodies, graphic and band tees, baggy jeans and cargos, track
// pants, a school uniform where the schools wear one, their team's kit on game days, a
// work shirt for the sixteen- and seventeen-year-olds with a weekend job) and carry what
// teens carry: a backpack, a phone, a skateboard, a ball, an instrument case.
//
// Every teen is a minor: their DNA says so (age < 18, minor: true), so the Spark's ward
// (combat/targets.js isMinor) keeps them as safe as the little ones. Their lives here are
// everyday and wholesome: school, friends, sport, music, homework, chores and family.
//
// Pure data and small functions: no three, so the tests run it in node.

import { hairFor, C } from './wardrobe.js';

export const TEEN_MIN = 13, TEEN_MAX = 17;
export const isTeenAge = (age) => Number.isFinite(age) && age >= TEEN_MIN && age < 18;
// a person's age as everyone reads it (their own field, or their DNA's)
export const ageOf = (p) => Number.isFinite(p?.age) ? p.age : Number.isFinite(p?.dna?.age) ? p.dna.age : Number.isFinite(p?.P?.dna?.age) ? p.P.dna.age : NaN;
export const isTeen = (p) => isTeenAge(ageOf(p));

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pick = (r, a) => a[Math.floor(r() * a.length)];
const chance = (r, p) => r() < p;
const col = (k) => C[k] || k;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- the body ----------
// how grown (0 the child shape .. 1 a young adult's): girls through puberty about 10.5 to
// 16, boys about 11.5 to 18
export function growthOf(age, male) {
	return male ? clamp((age - 11.5) / 6.5) : clamp((age - 10.5) / 5.5);
}
// a teen's height: from where childhood leaves off toward the grown-up height they were
// born to, a little early or late (some shoot up at thirteen, some at sixteen)
export function teenHeight(age, male, adult, early = 0) {
	const child = 0.78 + 12 * 0.056;
	const g = clamp(growthOf(age + early, male) * 1.08);
	return child + (adult - child) * Math.pow(g, 0.85);
}
// builds of teens: lanky, average, sturdy, athletic, still small (muscle, weight, how early)
const BUILDS = [['lanky', 0.05, 0.02, 0.6, 2], ['average', 0.12, 0.15, 0, 4], ['sturdy', 0.1, 0.45, 0, 1.6], ['athletic', 0.3, 0.12, 0.3, 1.6], ['small', 0.04, 0.1, -1.1, 1.4]];
function buildOf(r) {
	let x = r() * BUILDS.reduce((a, b) => a + b[4], 0);
	for (const b of BUILDS) if ((x -= b[4]) < 0) return b;
	return BUILDS[1];
}

// a grown-up's DNA (body.js personDNA at eighteen) made into a teenager's: the age, the
// growth between the child and adult shapes (body.js blends them by d.growth), the height,
// the build, the gait, the hair, and teenage clothes. Same seed, same teen.
export function makeTeen(d, age, ctx = {}) {
	const r = rng((d.seed ^ 0x7ee17) >>> 0);
	age = clamp(age ?? (TEEN_MIN + r() * 4.99), TEEN_MIN, 17.99);
	const B = buildOf(r);
	d.age = age; d.teen = true; d.minor = true; d.child = false;
	d.build = B[0];
	const early = B[3] + (r() - 0.5) * 0.8;
	d.growth = growthOf(age + early * 0.5, d.male);
	d.height = teenHeight(age, d.male, d.height, early);
	d.muscle = B[1] * (0.4 + d.growth * 0.6) * (d.male ? 1 : 0.7);
	d.weight = B[2];
	// quick and loose on their feet, a slouch for some, a bounce for others
	d.gait = { stride: 0.97 + r() * 0.1, bounce: 0.9 + r() * 0.6, armSwing: 0.6 + r() * 0.7, posture: (r() - 0.6) * 0.07, pace: 1.22 + r() * 0.3 };
	d.temper.outgoing = clamp(d.temper.outgoing * 0.8 + r() * 0.3);
	const rs = rng((d.seed ^ 0x57a1e) >>> 0);
	d.style = teenStyle(rs, d, ctx);
	d.style.printKind = Math.floor(rs() * 9);
	d.style.hair = hairFor(rs, d, d.style);
	d.styleSig = JSON.stringify(d.outfit);
	d.carry = carryFor(r, d, ctx);
	d.voice = voiceFor(d);
	return d;
}

// a teen's voice: higher than a grown-up's, a boy's dropping through the years
export function voiceFor(d) {
	const a = d.age ?? 15;
	return { pitch: d.male ? clamp(1.25 - (a - 12) * 0.06, 0.95, 1.25) : 1.18 - (a - 12) * 0.01, rate: 1.04 + (d.temper?.outgoing ?? 0.5) * 0.12 };
}

// ---------- what they wear ----------
// the places whose schools mostly wear a uniform (region/cultures.js keys)
export const UNIFORM_CULTURES = new Set(['british', 'japanese', 'korean', 'chinese', 'southasia', 'nepali', 'westafrica', 'akan', 'nigeria', 'hausa', 'swahili', 'southernafrica', 'caribbean', 'aussie', 'maori', 'malay', 'filipino', 'thai', 'vietnamese', 'burmese', 'mexican', 'persian', 'turkish', 'andean', 'polynesian', 'melanesian', 'malagasy', 'congo', 'wolof', 'mande']);
const UNIFORM = [
	{ top: 'white', bottom: 'navy', outer: 'navy', tie: 'cherry' }, { top: 'babyblue', bottom: 'charcoal', outer: 'charcoal', tie: 'navy' },
	{ top: 'white', bottom: 'forest', outer: 'forest', tie: 'mustard' }, { top: 'white', bottom: 'burgundy', outer: 'burgundy', tie: 'navy' },
	{ top: 'white', bottom: 'grey', outer: 'navy', tie: 'kelly' }, { top: 'butter', bottom: 'khaki', outer: null, tie: null },
];
const BAND = ['black', 'charcoal', 'black', 'burgundy', 'white', 'ink'];
const TEEN_POP = ['cobalt', 'kelly', 'cherry', 'butter', 'lilac', 'aqua', 'tangerine', 'mint', 'hotpink', 'skyblue', 'lime'];
// the looks a teen dresses in (weights)
const LOOKS = [['hoodie', 3], ['graphic', 2.4], ['band', 1.2], ['skate', 1.4], ['sporty', 1.8], ['neat', 1.2], ['layers', 1.2]];
// ctx: { uniform, sport, work, cold, place, activity, team }
export function teenStyle(r, d, ctx = {}) {
	const f = !d.male, cold = ctx.cold ?? 0.35;
	const o = { gen: 'z', top: null, outer: null, bottom: null, shoes: null, acc: [], teen: true };
	const pop = col(pick(r, TEEN_POP));
	if (ctx.uniform) {
		// a school uniform: the school's colours, a collared shirt, trousers or a skirt, a
		// blazer or jumper in the cold
		const U = UNIFORM[(ctx.school ?? Math.floor(r() * UNIFORM.length)) % UNIFORM.length];
		o.top = { kind: 'shirt', col: col(U.top), pat: 'plain', fit: 'regular', sleeves: cold > 0.4 ? 'long' : 'short', collar: true, fab: 'canvas' };
		if (U.outer && cold > 0.3) o.outer = chance(r, 0.5) ? { kind: 'blazer', col: col(U.outer), pat: 'plain', fit: 'regular', sleeves: 'long', open: true } : { kind: 'knit', col: col(U.outer), pat: 'rib', fit: 'regular', sleeves: 'long', open: false };
		o.bottom = f && chance(r, 0.6) ? { kind: 'skirt', col: col(U.bottom), pat: chance(r, 0.4) ? 'plaid' : 'plain', legs: 'skirt', len: 'midi' } : { kind: 'trousers', col: col(U.bottom), pat: 'plain', legs: 'long', fit: 'straight' };
		o.shoes = chance(r, 0.6) ? { kind: 'loafer', col: col('black'), sole: col('black') } : { kind: 'runner', col: col(pick(r, ['black', 'white'])), acc: col('grey'), sole: col('white') };
		o.acc.push({ kind: 'backpack', col: col(pick(r, ['black', 'navy', ...TEEN_POP])), acc: col(pick(r, ['black', 'grey'])) });
		o.uniform = true;
		return o;
	}
	if (ctx.sport) {
		// their team's kit: a jersey with a number, shorts or track pants, a kit bag
		const T = ctx.team || { a: col(pick(r, ['cherry', 'cobalt', 'kelly', 'navy', 'tangerine', 'black', 'burgundy'])), b: col('white') };
		o.top = { kind: 'jersey', col: T.a, acc: T.b, acc2: T.b, pat: 'jersey', fit: 'regular', sleeves: 'short', number: 2 + Math.floor(r() * 30) };
		o.bottom = cold > 0.55 ? { kind: 'track', col: col('black'), acc: T.a, pat: 'track', legs: 'long', fit: 'regular' } : { kind: 'shorts', col: col(pick(r, ['black', 'navy', 'white'])), acc: T.a, pat: 'track', legs: 'shorts', fit: 'regular', socks: T.a };
		o.shoes = { kind: 'runner', col: col(pick(r, ['white', 'black', 'grey'])), acc: T.a, sole: col('white') };
		o.acc.push({ kind: 'backpack', col: col('black'), acc: T.a });
		o.sport = true;
		return o;
	}
	if (ctx.work && d.age >= 16) {
		// a weekend job: the café's, the grocer's or the cinema's shirt and a cap
		const W = pick(r, [['kelly', 'black'], ['cherry', 'black'], ['navy', 'khaki'], ['black', 'black'], ['tangerine', 'navy']]);
		o.top = { kind: chance(r, 0.5) ? 'shirt' : 'tee', col: col(W[0]), pat: 'plain', fit: 'regular', sleeves: 'short', collar: true };
		o.bottom = { kind: 'trousers', col: col(W[1]), pat: 'plain', legs: 'long', fit: 'straight' };
		o.shoes = { kind: 'runner', col: col('black'), sole: col('black') };
		if (chance(r, 0.5)) o.acc.push({ kind: 'cap', col: col(W[0]), acc: col('white') });
		o.work = true;
		return o;
	}
	let x = r() * LOOKS.reduce((a, b) => a + b[1], 0), look = 'hoodie';
	for (const [k, w] of LOOKS) if ((x -= w) < 0) { look = k; break; }
	o.look = look;
	const sl = cold > 0.5 ? 'long' : chance(r, 0.6) ? 'short' : 'long';
	const jeans = () => ({ kind: 'jeans', col: col(pick(r, ['rinse', 'indigo', 'midwash', 'lightwash', 'blackdenim', 'bleach'])), pat: 'denim', legs: 'long', fit: pick(r, ['baggy', 'wide', 'wide', 'straight']) });
	if (look === 'hoodie') {
		o.top = { kind: 'hoodie', col: col(pick(r, ['heather', 'black', 'navy', 'cream', 'sage', 'lilac', 'charcoal', 'burgundy', 'skyblue', 'olive'])), acc: pop, acc2: col('white'), pat: pick(r, ['plain', 'plain', 'graphic', 'block']), fit: 'oversized', sleeves: 'long' };
		o.bottom = chance(r, 0.5) ? jeans() : { kind: 'track', col: col(pick(r, ['black', 'grey', 'navy', 'heather'])), acc: col('white'), pat: chance(r, 0.5) ? 'track' : 'plain', legs: 'long', fit: 'wide' };
	} else if (look === 'graphic') {
		o.top = { kind: 'tee', col: col(pick(r, ['white', 'black', 'cream', 'butter', 'skyblue', 'mint', 'lilac', 'heather'])), acc: pop, acc2: col(pick(r, TEEN_POP)), pat: 'graphic', fit: 'oversized', sleeves: sl };
		o.bottom = chance(r, 0.6) ? jeans() : { kind: 'cargo', col: col(pick(r, ['khaki', 'olive', 'black', 'stone', 'grey'])), acc: pop, pat: 'cargo', legs: cold < 0.25 && chance(r, 0.4) ? 'shorts' : 'long', fit: 'baggy' };
	} else if (look === 'band') {
		// a band tee: black or washed-out, the print big, black jeans, a flannel over it
		o.top = { kind: 'tee', col: col(pick(r, BAND)), acc: col(pick(r, ['white', 'cream', 'cherry', 'butter'])), acc2: col(pick(r, ['cherry', 'butter', 'white'])), pat: 'band', fit: 'oversized', sleeves: 'short' };
		if (cold > 0.25) o.outer = { kind: 'flannel', col: col(pick(r, ['cherry', 'forest', 'navy', 'burgundy'])), acc: col('black'), acc2: col('cream'), pat: 'plaid', fit: 'oversized', sleeves: 'long', open: true, collar: true, fab: 'canvas' };
		o.bottom = { kind: 'jeans', col: col(pick(r, ['blackdenim', 'blackdenim', 'greydenim', 'rinse'])), pat: 'denim', legs: 'long', fit: pick(r, ['straight', 'wide', 'baggy']) };
	} else if (look === 'skate') {
		o.top = chance(r, 0.5) ? { kind: 'tee', col: col(pick(r, ['white', 'black', 'tangerine', 'kelly', 'heather'])), acc: pop, pat: pick(r, ['graphic', 'ringer', 'plain']), fit: 'oversized', sleeves: sl } : { kind: 'hoodie', col: col(pick(r, ['black', 'olive', 'chocolate', 'navy', 'tangerine'])), acc: pop, pat: 'graphic', fit: 'oversized', sleeves: 'long' };
		o.bottom = chance(r, 0.6) ? { kind: 'carpenter', col: col(pick(r, ['tan', 'chocolate', 'khaki', 'black', 'cream'])), pat: 'plain', legs: 'long', fit: 'wide', fab: 'canvas' } : jeans();
		if (chance(r, 0.4)) o.acc.push({ kind: chance(r, 0.6) ? 'beanie' : 'cap', col: col(pick(r, ['black', 'rust', 'butter', 'olive', 'cherry'])), acc: col('white') });
	} else if (look === 'sporty') {
		o.top = chance(r, 0.5) ? { kind: 'tee', col: col(pick(r, ['white', 'black', 'heather', 'cobalt', 'cherry'])), acc: pop, pat: pick(r, ['plain', 'block']), fit: 'regular', sleeves: 'short' } : { kind: 'hoodie', col: col(pick(r, ['black', 'heather', 'navy', 'cherry', 'cobalt', 'kelly'])), acc: col('white'), pat: 'block', fit: 'regular', sleeves: 'long' };
		o.bottom = f && chance(r, 0.4) ? { kind: 'leggings', col: col(pick(r, ['black', 'navy', 'charcoal', 'plum'])), pat: 'plain', legs: 'long', fit: 'tight' } : chance(r, 0.5) ? { kind: 'joggers', col: col(pick(r, ['black', 'grey', 'navy', 'heather'])), acc: pop, pat: 'track', legs: 'long', fit: 'regular', cuff: true } : { kind: 'shorts', col: col(pick(r, ['black', 'navy', 'grey', 'cobalt'])), acc: pop, pat: 'track', legs: 'shorts', fit: 'regular' };
	} else if (look === 'neat') {
		o.top = chance(r, 0.5) ? { kind: 'knit', col: col(pick(r, ['cream', 'navy', 'sage', 'oat', 'babyblue', 'forest'])), pat: pick(r, ['plain', 'rib']), fit: 'regular', sleeves: 'long' } : { kind: 'shirt', col: col(pick(r, ['white', 'babyblue', 'oat', 'sage'])), pat: chance(r, 0.3) ? 'stripe' : 'plain', fit: 'regular', sleeves: sl, collar: true };
		o.bottom = f && chance(r, 0.35) ? { kind: 'skirt', col: col(pick(r, ['navy', 'chocolate', 'olive', 'midwash', 'black'])), pat: pick(r, ['plain', 'plaid', 'denim']), legs: 'skirt', len: pick(r, ['midi', 'maxi']) } : { kind: 'trousers', col: col(pick(r, ['stone', 'navy', 'black', 'khaki', 'chocolate'])), pat: 'plain', legs: 'long', fit: 'wide' };
	} else {
		// layers: a long sleeve under a tee, or a fleece, an open denim jacket
		o.top = { kind: 'longsleeve', col: col(pick(r, ['white', 'cream', 'heather', 'black', 'lilac', 'butter'])), acc: pop, pat: pick(r, ['stripe', 'plain', 'rib']), fit: 'regular', sleeves: 'long' };
		o.outer = chance(r, 0.5) ? { kind: 'denim', col: col(pick(r, ['midwash', 'lightwash', 'blackdenim'])), pat: 'denim', fit: 'oversized', sleeves: 'long', open: true } : { kind: 'fleece', col: col(pick(r, ['cream', 'sage', 'navy', 'butter', 'lilac', 'teal'])), acc: col(pick(r, ['rust', 'kelly', 'cobalt', 'chocolate'])), pat: 'fleeceblock', fit: 'regular', sleeves: 'long', open: false, fab: 'fleece' };
		o.bottom = chance(r, 0.6) ? jeans() : { kind: 'cargo', col: col(pick(r, ['olive', 'khaki', 'black', 'stone'])), acc: pop, pat: 'cargo', legs: 'long', fit: 'baggy' };
	}
	o.shoes = chance(r, 0.4) ? { kind: 'chunky', col: col(pick(r, ['white', 'cream', 'grey', 'black'])), acc: col(pick(r, TEEN_POP)), sole: col(pick(r, ['white', 'cream'])) }
		: chance(r, 0.5) ? { kind: 'skate', col: col(pick(r, ['black', 'navy', 'cherry', 'chocolate', 'olive'])), acc: col('white'), sole: col('cream') }
			: { kind: 'runner', col: col(pick(r, ['white', 'grey', 'black', 'heather'])), acc: col(pick(r, TEEN_POP)), sole: col('white') };
	// the weather: a puffer or a shell over it all
	if (cold > 0.62 && !o.outer && chance(r, 0.75)) o.outer = { kind: 'puffer', col: col(pick(r, ['black', 'cream', 'olive', 'cobalt', 'cherry', 'butter', 'navy'])), fit: 'oversized', open: chance(r, 0.4), sleeves: 'long', pat: 'quilt', fab: 'nylon' };
	if (ctx.wet && !o.outer) o.outer = { kind: 'shell', col: col(pick(r, ['black', 'tangerine', 'cobalt', 'kelly', 'teal'])), acc: col('black'), fit: 'oversized', open: false, sleeves: 'long', pat: 'plain', fab: 'nylon' };
	// what they carry on them: a backpack on school days, headphones, a cap or a beanie
	if (chance(r, ctx.school === false ? 0.3 : 0.65)) o.acc.push({ kind: 'backpack', col: col(pick(r, ['black', 'navy', 'grey', 'olive', ...TEEN_POP])), acc: col(pick(r, ['black', 'grey', 'white'])) });
	if (chance(r, 0.3)) o.acc.push({ kind: 'headphones', col: col(pick(r, ['white', 'black', 'cream', 'babyblue', 'sage', 'lilac'])) });
	if (!o.acc.some((q) => q.kind === 'cap' || q.kind === 'beanie') && chance(r, cold > 0.5 ? 0.3 : 0.15)) o.acc.push({ kind: cold > 0.5 ? 'beanie' : 'cap', col: col(pick(r, ['black', 'oat', 'navy', 'cherry', 'olive', 'butter'])), acc: col('white') });
	if (chance(r, 0.12)) o.acc.push({ kind: 'glasses', shape: chance(r, 0.6) ? 'round' : 'rect', wire: chance(r, 0.3), col: col(pick(r, ['black', 'tan', 'navy', 'grey'])) });
	return o;
}

// what's in their hands: a phone most of all, a skateboard, a ball, an instrument case, a
// stack of books
export const CARRY = ['phone', 'skateboard', 'ball', 'guitar', 'violin', 'books'];
export function carryFor(r, d, ctx = {}) {
	if (ctx.activity === 'skate') return 'skateboard';
	if (ctx.activity === 'ball') return 'ball';
	const x = r();
	return x < 0.34 ? 'phone' : x < 0.46 ? 'skateboard' : x < 0.56 ? 'ball' : x < 0.62 ? 'guitar' : x < 0.66 ? 'violin' : x < 0.74 ? 'books' : null;
}

// ---------- where they are, and what they're doing ----------
// how many of the people about are teens, by the hour and the kind of place (0..1 share of
// the crowd): at school by day (so near the schools, few elsewhere), out after school, in
// the parks and the malls in the evening, home by ten on a school night
export function teensAbout(h, zone = 'neighbourhood', weekend = false, nearSchool = false) {
	if (h < 6.8 || h >= 22.5) return 0.01;
	const placeK = { neighbourhood: 1, retail: 1.4, dining: 0.8, downtown: 0.7, office: 0.15, industrial: 0.05, trail: 0.6, beach: 1.2, quiet: 0.4, park: 1.5, island: 0.8 }[zone] ?? 0.6;
	let k;
	if (weekend) k = h < 9.5 ? 0.04 : h < 21 ? 0.14 : 0.07;
	else if (h < 8.5) k = nearSchool ? 0.4 : 0.1;                 // on the way in
	else if (h < 15) k = nearSchool ? 0.25 : 0.015;               // in class
	else if (h < 18.5) k = nearSchool ? 0.35 : 0.16;              // out of school
	else if (h < 21) k = 0.1;
	else k = 0.04;
	return clamp(k * placeK, 0, 0.45);
}
// what a teen out and about is up to (and what goes with it)
export const ACTS = {
	group: { pose: 'rest', walk: true, line: 'walking home with friends' },
	skate: { pose: 'rest', walk: true, carry: 'skateboard', line: 'skating with friends at the park' },
	ball: { pose: 'rest', walk: false, carry: 'ball', line: 'shooting hoops at the courts' },
	wall: { pose: 'phone', sit: true, line: 'hanging out on the wall outside the shops' },
	huddle: { pose: 'phone', walk: false, line: 'showing friends something on a phone' },
	job: { pose: 'rest', walk: true, line: 'on the way to a shift at work', minAge: 16 },
	study: { pose: 'read', sit: true, carry: 'books', line: 'studying at the library' },
	practice: { pose: 'rest', walk: true, line: 'heading to practice' },
	music: { pose: 'rest', walk: true, carry: 'guitar', line: 'on the way to band rehearsal' },
};
export function teenActivity(r, { h = 16, weekend = false, zone = 'neighbourhood', age = 15 } = {}) {
	const L = [];
	const add = (k, w) => { if (w > 0 && !(ACTS[k].minAge > age)) L.push([k, w]); };
	add('group', 3);
	add('skate', zone === 'park' || zone === 'neighbourhood' ? 1.5 : 0.4);
	add('ball', zone === 'park' ? 1.5 : 0.3);
	add('wall', zone === 'retail' || zone === 'dining' ? 2 : 0.7);
	add('huddle', 1.2);
	add('job', weekend || h > 16 ? 0.8 : 0);
	add('study', !weekend && h > 15 && h < 19 ? 0.6 : 0.2);
	add('practice', !weekend && h > 15 && h < 17.5 ? 1 : weekend && h < 13 ? 0.8 : 0);
	add('music', 0.3);
	let x = r() * L.reduce((a, b) => a + b[1], 0);
	for (const [k, w] of L) if ((x -= w) < 0) return k;
	return 'group';
}

// ---------- who they are, when you talk ----------
const GRADE = (age) => Math.max(7, Math.min(12, Math.floor(age) - 5));
const ord = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
const HOBBIES = ['skateboarding', 'drawing comics', 'the school robotics team', 'playing bass in a garage band', 'basketball', 'soccer', 'volleyball', 'track', 'making videos', 'baking', 'chess club', 'swimming', 'the school play', 'coding little games', 'photography', 'dance team', 'the debate club', 'fixing up an old bike', 'learning guitar', 'the school garden club'];
const ERRANDS = ['walking home from school', 'on the way to practice', 'meeting friends at the park', 'getting snacks before homework', 'picking up a little brother from the school up the road', 'heading to the library to study', 'on an errand for the family', 'walking the dog before dinner'];
const WORK_ERRANDS = ['on the way to a shift at the café', 'heading to a weekend job at the grocery', 'off to a shift at the cinema'];
// a teen's persona sheet, from the one every passer-by gets (persona.js): their age, school,
// what they're up to, what they're into; a weekend job at sixteen or seventeen
export function teenPersona(base, d) {
	const r = rng((d.seed * 31 + 7) >>> 0), age = Math.floor(d.age);
	const grade = GRADE(age);
	const job = age >= 16 && r() < 0.45;
	return {
		...base, age, teen: true, minor: true,
		job: `in ${ord(grade)} grade${job ? ', with a weekend job' : ''}`,
		school: grade <= 8 ? 'the middle school' : 'the high school',
		errand: job && r() < 0.4 ? pick(r, WORK_ERRANDS) : pick(r, ERRANDS),
		hobby: pick(r, HOBBIES), mood: pick(r, ['cheerful', 'chill', 'tired', 'curious', 'happy', 'busy']),
		years: Math.max(1, Math.min(age, base.years || age)),
		voice: d.voice || voiceFor(d), tattoos: [],
	};
}
// for the cloud voice: how to play a teenager, safely
export function teenPrompt(p) {
	return `YOU ARE A TEENAGER (${p.age}, ${p.job}, at ${p.school}). Talk like an ordinary, good-natured teen: school, homework, friends, sport, music, games, your family and chores, your plans after school. Keep it everyday and wholesome; if anything turns to romance, dating, violence or anything an adult stranger should not ask a minor, politely change the subject or say you need to get going. Never give out where you live.\n`;
}
// without a model: simple, in character
export function teenOffline(p, q) {
	const r = rng((p.age * 97 + q.length * 13) >>> 0);
	if (/\b(date|dating|girlfriend|boyfriend|kiss|cute|sexy|hot|address|where do you live|alone)\b/.test(q)) return `[[mood: thoughtful]] [[gesture: shake]] Uh, I'm good. I should get going, actually.`;
	if (/^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/.test(q)) return `[[mood: happy]] [[gesture: wave]] ${pick(r, ['Hey.', 'Hi!', 'Oh, hey.', 'Sup.'])} I'm ${p.first}.`;
	if (/how old|your age/.test(q)) return `[[mood: calm]] ${p.age}. ${p.job[0].toUpperCase() + p.job.slice(1)}.`;
	if (/school|class|grade|homework|teacher|study/.test(q)) return `[[mood: ${p.mood === 'tired' ? 'calm' : 'amused'}]] [[gesture: shrug]] ${pick(r, [`${p.school[0].toUpperCase() + p.school.slice(1)}'s okay. Too much homework.`, 'We have a chem test Friday. Not ready.', 'Lunch is the best part, honestly. The school meals got better this year.', 'My math teacher is actually really good.'])}`;
	if (/what do you do|job|work/.test(q)) return `[[mood: calm]] [[gesture: explain]] I'm ${p.job}.${/job/.test(p.job) ? ' Saving up for a car. Or a laptop. Probably a laptop.' : ''}`;
	if (/hobby|fun|free time|like to do|into/.test(q)) return `[[mood: happy]] [[gesture: explain]] Mostly ${p.hobby}.`;
	if (/food|eat|hungry|lunch|dinner|snack/.test(q)) return `[[mood: amused]] ${pick(r, ['I could eat literally anything right now.', 'My mom makes the best rice on Sundays.', 'Free breakfast at school is clutch.', "It's my turn to cook tonight. Pasta. It's always pasta."])}`;
	if (/family|parents|mom|dad|brother|sister|grandma|grandpa/.test(q)) return `[[mood: calm]] ${pick(r, ['I watch my little sister after school till my dad gets home.', 'My grandma lives with us. She runs the house, honestly.', "It's just me and my mom. We're a good team.", 'My brothers are so loud. But yeah, they\'re alright.'])}`;
	if (/how are you|how's it going/.test(q)) return `[[mood: happy]] Good. Just ${p.errand}.`;
	if (/bye|see you|later|thanks/.test(q)) return `[[mood: happy]] [[gesture: wave]] ${pick(r, ['See ya.', 'Later!', 'Bye!'])}`;
	if (/\?$/.test(q.trim())) return `[[mood: thoughtful]] [[gesture: shrug]] I dunno, honestly.`;
	return `[[mood: calm]] [[gesture: nod]] Yeah. Anyway, I'm ${p.errand}.`;
}
