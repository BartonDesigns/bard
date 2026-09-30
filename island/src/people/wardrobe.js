// What people wear, 2026, chosen the way people really choose: by who they are (their age,
// so their generation), where they are (downtown SF, Oakland, the suburbs, a beach, a trail,
// the office towers, the Boardwalk), the weather and the season, and what they are doing.
// The same person in the same place is dressed the same way every time (it all grows from
// their seed). The body (body.js) cuts the garments from its cloth cage and paints them in
// the shader (garment.js): the kinds, colours and patterns here are what it paints.
//
// The generations: Gen Alpha children in bright athleisure, graphic tees, fun sneakers and
// hoodies a size up; Gen Z in baggy wide-leg jeans and cargos, cropped and boxy tops, big
// jackets and puffer vests, chunky sneakers, beanies, totes, a bit of Y2K and a bit of
// trail gear; millennials in clean athleisure, quilted jackets and fleece vests, neutrals
// with one colour, running shoes and a crossbody bag; Gen X in denim jackets, band tees,
// flannel, pull-on boots and practical outdoor gear; boomers in polos, windbreakers,
// khakis, sun hats and comfortable walking shoes. Hikers in shells and trail runners,
// beachgoers in swimwear and board shorts, office workers in smart casual, players in
// their team's kit with a number. Out at night, darker and sharper: leather, black denim,
// a chain, earrings. Each grown-up has a look of their own (minimal, earthy, workwear,
// gorpcore, preppy, all black, colourful, coastal, soft): one palette their clothes are
// drawn from, whatever they put on today; and their small things: glasses, a watch,
// earrings, a chain. Hair to suit the person and the look (hairFor): fades and crops,
// curls, coils and afros, locs, braids and cornrows, buns, ponytails, bobs and long
// layers, and hair that recedes, thins and greys with the years.

import { toLatLon } from '../bay/geo.js';
import { today } from '../calendar.js';

// ---------- the palette: this year's colours, as people buy them ----------
export const C = {
	// neutrals
	black: '#1b1b1d', charcoal: '#36383c', slate: '#565c63', grey: '#8d9095', heather: '#b4b5b3', white: '#f3f2ee', cream: '#ede4d0', oat: '#d9ccb2', stone: '#bfb49e', sand: '#cdb58f',
	camel: '#b08552', tan: '#a57c52', khaki: '#a89a74', mocha: '#7a5a44', chocolate: '#4e3226', espresso: '#33231c', navy: '#1f2a44', ink: '#15192a',
	// earth
	olive: '#5f6440', moss: '#4f5a36', sage: '#9aa58a', forest: '#2f4a38', rust: '#a4502e', terracotta: '#c0694a', clay: '#b07a5e', burgundy: '#6a2331', plum: '#57304a',
	// this year's colour
	butter: '#f2dc8a', cherry: '#b3162b', tomato: '#d8412f', cobalt: '#2354c7', kelly: '#1f8a4c', tangerine: '#f07a28', aqua: '#3fc2c0', lilac: '#b9a3d6', pink: '#f08fb4',
	hotpink: '#e43b86', babyblue: '#a9cdee', mint: '#a8e0c2', lime: '#b8e04a', teal: '#2a7d7f', mustard: '#d0a126', skyblue: '#5ea9e0', coral: '#f0826a', lavender: '#c9b8e8', red: '#c8322c',
	// denim washes
	rinse: '#1c2640', indigo: '#2b3d63', midwash: '#4a6189', lightwash: '#8ea6c4', bleach: '#b9c9da', blackdenim: '#2a2b30', greydenim: '#6b7079',
};
const NEUTRAL = ['black', 'charcoal', 'grey', 'heather', 'white', 'cream', 'oat', 'stone', 'navy', 'slate'];
const EARTH = ['olive', 'moss', 'sage', 'chocolate', 'mocha', 'camel', 'tan', 'rust', 'terracotta', 'khaki', 'espresso', 'forest', 'burgundy'];
const POP = ['butter', 'cherry', 'cobalt', 'kelly', 'tangerine', 'aqua', 'lilac', 'pink', 'tomato', 'lime', 'hotpink', 'skyblue'];
const KID = ['cherry', 'cobalt', 'lime', 'hotpink', 'butter', 'aqua', 'lilac', 'tangerine', 'kelly', 'skyblue', 'mint', 'coral', 'white', 'lavender'];
const PASTEL = ['babyblue', 'mint', 'lilac', 'butter', 'pink', 'lavender', 'cream'];
const SHELL = ['tangerine', 'cobalt', 'kelly', 'teal', 'cherry', 'mustard', 'black', 'olive', 'skyblue', 'lime'];
const WASH = ['rinse', 'indigo', 'midwash', 'lightwash', 'bleach', 'blackdenim', 'greydenim'];
// metals for jewellery and watches
const GOLD = '#d4af6a', SILVER = '#c9ccd0';

// ---------- a look: the palette a person's clothes come from ----------
// each role: light, mid, dark and a pop of colour; a garment keeps its tone and takes the
// look's colour for it (the same colour always becomes the same colour on one person)
export const LOOKS = {
	minimal: { light: ['white', 'cream', 'oat'], mid: ['stone', 'grey', 'camel'], dark: ['black', 'charcoal', 'ink'], pop: ['camel', 'oat', 'white'] },
	earthy: { light: ['cream', 'oat', 'sand'], mid: ['olive', 'tan', 'clay', 'sage', 'khaki'], dark: ['chocolate', 'espresso', 'moss', 'forest'], pop: ['rust', 'mustard', 'terracotta'] },
	workwear: { light: ['cream', 'oat', 'stone'], mid: ['tan', 'khaki', 'camel', 'rust'], dark: ['chocolate', 'navy', 'charcoal', 'olive'], pop: ['rust', 'tangerine', 'mustard'] },
	gorp: { light: ['cream', 'heather', 'oat'], mid: ['sage', 'teal', 'slate', 'khaki'], dark: ['black', 'forest', 'charcoal'], pop: ['tangerine', 'kelly', 'cobalt', 'butter'] },
	preppy: { light: ['white', 'babyblue', 'cream'], mid: ['khaki', 'stone', 'skyblue'], dark: ['navy', 'burgundy', 'forest'], pop: ['cherry', 'kelly', 'butter'] },
	mono: { light: ['heather', 'grey', 'white'], mid: ['slate', 'charcoal', 'grey'], dark: ['black', 'black', 'charcoal', 'ink'], pop: ['cherry', 'white', 'black'] },
	colour: { light: ['butter', 'lilac', 'babyblue', 'mint', 'pink', 'white'], mid: ['cobalt', 'kelly', 'tangerine', 'aqua', 'lavender'], dark: ['navy', 'plum', 'black'], pop: ['hotpink', 'lime', 'cherry', 'cobalt'] },
	coastal: { light: ['white', 'sand', 'cream', 'babyblue'], mid: ['skyblue', 'stone', 'sage'], dark: ['navy', 'ink'], pop: ['coral', 'aqua', 'butter'] },
	soft: { light: ['cream', 'oat', 'lavender', 'pink'], mid: ['sage', 'lilac', 'mocha', 'camel'], dark: ['mocha', 'chocolate', 'plum'], pop: ['butter', 'coral'] },
};
const LOOK_BY = {
	z: [['colour', 2], ['earthy', 2], ['workwear', 1.5], ['gorp', 1.5], ['mono', 1.5], ['minimal', 1.5]],
	millennial: [['minimal', 2.5], ['earthy', 1.5], ['gorp', 1.5], ['preppy', 1.5], ['workwear', 1.5], ['mono', 1], ['soft', 0.5]],
	x: [['workwear', 2.5], ['earthy', 2], ['preppy', 2], ['gorp', 1.5], ['minimal', 1], ['mono', 1]],
	boomer: [['preppy', 3.5], ['coastal', 3], ['soft', 2], ['earthy', 1.5]],
};
// a person's look: from their own seed, so it is theirs wherever they are
export function lookOf(d) {
	const gen = d.child ? 'alpha' : generation(d.age);
	const L = LOOK_BY[gen];
	if (!L) return null;
	let x = ((Math.imul(d.seed ^ 0x100c, 2654435761) >>> 0) / 4294967296) * L.reduce((a, b) => a + b[1], 0);
	for (const [k, w] of L) { if ((x -= w) < 0) return k; }
	return L[0][0];
}
function toneOf(hex) {
	const c = parseInt(hex.slice(1), 16), R = (c >> 16 & 255) / 255, G = (c >> 8 & 255) / 255, B = (c & 255) / 255;
	const mx = Math.max(R, G, B), mn = Math.min(R, G, B), lum = 0.3 * R + 0.59 * G + 0.11 * B, sat = mx ? (mx - mn) / mx : 0;
	return sat > 0.55 && lum > 0.25 ? 'pop' : lum > 0.62 ? 'light' : lum > 0.3 ? 'mid' : 'dark';
}
function applyLook(r, o, look) {
	const L = LOOKS[look];
	if (!L) return;
	const seen = new Map();
	const re = (hex) => { if (typeof hex !== 'string' || hex[0] !== '#') return hex; if (!seen.has(hex)) seen.set(hex, col(pick(r, L[toneOf(hex)]))); return seen.get(hex); };
	for (const g of [o.top, o.outer, o.bottom]) {
		if (!g || g.pat === 'denim' || g.pat === 'chambray' || g.kind === 'jersey' || g.fab === 'leather') continue;
		g.col = re(g.col); if (g.acc) g.acc = re(g.acc); if (g.acc2) g.acc2 = re(g.acc2);
	}
	if (o.shoes && o.shoes.col !== C.white && chance(r, 0.6)) o.shoes.col = re(o.shoes.col);
	for (const q of o.acc) if (/^(cap|beanie|bucket|tote|crossbody|backpack)$/.test(q.kind)) q.col = re(q.col);
	o.look = look;
}

// who: the generation from the age (in 2026)
export function generation(age) {
	if (age < 14) return 'alpha';
	if (age < 30) return 'z';
	if (age < 46) return 'millennial';
	if (age < 62) return 'x';
	return 'boomer';
}

// where: the kind of place a point is, from the map and what the people system knows of it
// (zone: flow.js's zone, or 'trail', 'beach', 'office', 'boardwalk', 'island')
export function placeAt(x, z, zone) {
	if (zone === 'trail' || zone === 'beach' || zone === 'boardwalk' || zone === 'island' || zone === 'office') return zone;
	const { lat, lon } = toLatLon(x, z);
	const sf = lat > 37.705 && lat < 37.815 && lon < -122.355 && lon > -122.52;
	const east = lon > -122.33 && lon < -122.15 && lat > 37.74 && lat < 37.9;
	if (sf) return zone === 'office' ? 'office' : 'sf';
	if (east && (zone === 'downtown' || zone === 'dining' || zone === 'retail' || zone === 'neighbourhood')) return 'oakland';
	if (zone === 'office' || zone === 'downtown') return 'office';
	return 'suburb';
}

// the weather as it feels: 0 warm .. 1 cold, and wet, from the month, the hour and the place
export function climate({ month = today().getMonth(), hours = 13, place = 'suburb', rain = 0, cover = 0.4 } = {}) {
	// the Bay: inland summers are warm, the coast and SF stay cool (the fog), winters are mild
	const season = 0.5 + 0.5 * Math.cos((month - 0.5) / 12 * Math.PI * 2);          // 1 in January, 0 in July
	const coastal = place === 'sf' || place === 'beach' || place === 'boardwalk' ? 0.28 : place === 'trail' ? 0.12 : 0;
	const hour = hours < 9 || hours > 19 ? 0.22 : hours < 11 || hours > 17 ? 0.1 : 0;
	const cold = Math.max(0, Math.min(1, season * 0.55 + coastal * (1 - season * 0.5) + hour + cover * 0.12 + rain * 0.3 - 0.08));
	return { cold, wet: rain > 0.2 };
}

// ---------- the dressing ----------
// An outfit: { top, outer, bottom, shoes, acc: [...] }. Each garment: { kind, col, acc, acc2,
// pat, fit, ... } with colours as '#rrggbb'. Patterns are painted by garment.js.
const pick = (r, a) => a[Math.floor(r() * a.length)];
const chance = (r, p) => r() < p;
const col = (k) => C[k] || k;
// one to three colours that go: a base, a second and an accent
function scheme(r, base, second, accent) { return { a: col(pick(r, base)), b: col(pick(r, second)), c: col(pick(r, accent || POP)) }; }

// ctx: { place, activity: 'walk'|'jog'|'hike'|'beach'|'work'|'ride'|'sit', cold, wet, child }
export function dressFor(r, d, ctx = {}) {
	const gen = d.child ? 'alpha' : generation(d.age), male = d.male;
	const place = ctx.place || 'suburb', act = ctx.activity || 'walk';
	const cold = ctx.cold ?? 0.35, wet = !!ctx.wet;
	const o = { gen, top: null, outer: null, bottom: null, shoes: null, acc: [] };
	if (act === 'jog') return jogger(r, d, o, cold);
	if (act === 'hike' || (place === 'trail' && act !== 'sit')) return hiker(r, d, o, cold, wet);
	if (place === 'beach' && act !== 'work' && cold < 0.62 && chance(r, 0.7 - cold * 0.6)) return beach(r, d, o);
	const office = place === 'office' && act !== 'ride' && !d.child && d.age > 21 && d.age < 70;
	// a night out in the city: darker and sharper
	if (ctx.night && (place === 'sf' || place === 'oakland' || place === 'boardwalk') && act === 'walk' && !d.child && d.age > 20 && d.age < 58 && chance(r, 0.6)) nightOut(r, d, o, { cold });
	else ({ alpha, z: genz, millennial, x: genx, boomer })[gen](r, d, o, { place, act, cold, wet, office, male });
	// their look: the palette it is all drawn from
	const look = lookOf(d);
	if (look && !o.night && chance(r, 0.85)) applyLook(r, o, office && (look === 'colour' || look === 'gorp') ? 'minimal' : look);
	smallThings(r, d, o, { office });
	// the weather: over it all, a warm layer when it is cold, a shell in the rain
	if (wet && !o.outer && chance(r, 0.7)) o.outer = { kind: 'shell', col: col(pick(r, gen === 'boomer' ? ['navy', 'red', 'teal', 'black'] : SHELL)), acc: col('black'), fit: 'regular', open: false, sleeves: 'long', pat: 'plain', fab: 'nylon' };
	if (cold > 0.72 && !o.outer && chance(r, 0.8)) o.outer = gen === 'z' || gen === 'alpha' ? { kind: 'puffer', col: col(pick(r, gen === 'alpha' ? KID : ['black', 'cream', 'olive', 'chocolate', 'butter', 'cobalt', 'cherry', 'sage'])), fit: 'oversized', open: false, sleeves: 'long', pat: 'quilt', fab: 'nylon' } : { kind: 'quilted', col: col(pick(r, ['navy', 'olive', 'black', 'chocolate', 'camel'])), fit: 'regular', open: true, sleeves: 'long', pat: 'quilt', fab: 'nylon' };
	if (cold > 0.6 && chance(r, gen === 'z' ? 0.45 : gen === 'alpha' ? 0.3 : 0.12) && !o.acc.some((q) => q.kind === 'cap' || q.kind === 'beanie' || q.kind === 'bucket' || q.kind === 'sunhat')) o.acc.push({ kind: 'beanie', col: col(pick(r, gen === 'alpha' ? KID : ['black', 'charcoal', 'oat', 'olive', 'rust', 'butter', 'cherry', 'navy', 'chocolate'])) });
	if (cold < 0.3 && !o.acc.some((q) => q.kind === 'sunglasses' || q.kind === 'glasses') && chance(r, 0.25)) o.acc.push({ kind: 'sunglasses', col: col(pick(r, ['black', 'tan', 'espresso', 'white', 'cherry'])) });
	// the eyes: glasses for about a third of adults, more with the years
	if (!d.child && !o.acc.some((q) => q.kind === 'sunglasses' || q.kind === 'glasses') && chance(r, 0.15 + Math.max(0, d.age - 40) * 0.012)) {
		const wire = chance(r, gen === 'boomer' ? 0.45 : 0.3);
		o.acc.push({ kind: 'glasses', shape: chance(r, gen === 'z' || gen === 'millennial' ? 0.55 : 0.25) ? 'round' : 'rect', wire, col: wire ? pick(r, [GOLD, SILVER, col('black')]) : col(pick(r, ['black', 'tan', 'espresso', 'black', 'grey', 'navy', 'burgundy'])) });
	}
	return finish(o, cold);
}

// out at night: black and dark tones, leather or a sharp jacket, black denim or wide trousers
function nightOut(r, d, o, { cold }) {
	const f = !d.male, gen = o.gen;
	o.night = true;
	const k = r();
	o.top = f && k < 0.3 ? { kind: 'crop', col: col(pick(r, ['black', 'cream', 'burgundy', 'charcoal'])), pat: pick(r, ['plain', 'rib']), fit: 'fitted', sleeves: cold > 0.5 ? 'long' : 'short', crop: gen === 'z' }
		: k < 0.6 ? { kind: 'tee', col: col(pick(r, ['black', 'black', 'white', 'charcoal'])), pat: 'plain', fit: gen === 'z' ? 'oversized' : 'fitted', sleeves: 'short' }
			: { kind: 'shirt', col: col(pick(r, ['black', 'burgundy', 'cream', 'ink', 'olive'])), pat: 'plain', fit: 'regular', sleeves: 'long', collar: true, fab: 'nylon' };
	const w = r();
	if (cold > 0.3 || w < 0.6) o.outer = w < 0.45 ? { kind: 'leather', col: col(pick(r, ['black', 'black', 'espresso', 'chocolate'])), pat: 'plain', fit: 'regular', sleeves: 'long', open: true, crop: chance(r, 0.35), fab: 'leather' }
		: { kind: 'blazer', col: col(pick(r, ['black', 'charcoal', 'ink', 'chocolate'])), pat: 'plain', fit: 'oversized', sleeves: 'long', open: true };
	const b = r();
	o.bottom = f && b < 0.3 ? { kind: 'skirt', col: col(pick(r, ['black', 'espresso', 'burgundy', 'ink'])), pat: 'plain', legs: 'skirt', len: pick(r, ['midi', 'maxi']), fab: 'nylon' }
		: b < 0.6 ? { kind: 'jeans', col: col(pick(r, ['blackdenim', 'rinse', 'blackdenim'])), pat: 'denim', legs: 'long', fit: pick(r, ['straight', 'wide', 'slim']) }
			: { kind: 'trousers', col: col(pick(r, ['black', 'charcoal', 'ink'])), pat: 'plain', legs: 'long', fit: 'wide' };
	o.shoes = chance(r, 0.45) ? { kind: 'boot', col: col('black'), sole: col('black') } : chance(r, 0.5) ? { kind: 'loafer', col: col(pick(r, ['black', 'espresso'])), sole: col('black') } : { kind: 'chunky', col: col(pick(r, ['black', 'white'])), acc: col('black'), sole: col(pick(r, ['black', 'white'])) };
	if (f && chance(r, 0.5)) o.acc.push({ kind: 'crossbody', small: true, col: col(pick(r, ['black', 'burgundy', 'cream'])) });
	if (chance(r, 0.4)) o.acc.push({ kind: 'chain', col: chance(r, 0.6) ? SILVER : GOLD });
}

// the small things people wear every day: a watch, earrings, a chain (none on children)
function smallThings(r, d, o, { office }) {
	if (d.child) return;
	const gen = o.gen, f = !d.male, has = (k) => o.acc.some((q) => q.kind === k);
	const metal = chance(r, 0.5) ? GOLD : SILVER;
	if (!has('watch') && chance(r, (({ z: 0.12, millennial: 0.35, x: 0.5, boomer: 0.55 })[gen] ?? 0.2) + (office ? 0.2 : 0))) o.acc.push({ kind: 'watch', col: col(pick(r, ['black', 'chocolate', 'tan', 'charcoal'])), acc: metal, metal: chance(r, 0.35) });
	if (!has('earrings') && chance(r, f ? 0.6 : gen === 'z' ? 0.18 : 0.05)) o.acc.push({ kind: 'earrings', hoop: f && chance(r, gen === 'z' || gen === 'millennial' ? 0.45 : 0.2), col: metal });
	if (!has('chain') && chance(r, gen === 'z' ? 0.18 : gen === 'millennial' ? 0.08 : 0.03)) o.acc.push({ kind: 'chain', col: metal });
}

// a sleeve length for the day
const sleevesFor = (r, cold) => cold > 0.55 ? 'long' : cold < 0.25 ? (chance(r, 0.85) ? 'short' : 'long') : chance(r, 0.55) ? 'short' : 'long';
function finish(o, cold) {
	if (o.outer && o.outer.sleeves !== 'none' && o.top?.sleeves === 'none' && cold > 0.4) o.top.sleeves = 'short';
	return o;
}

// ---- Gen Alpha: bright, playful, comfortable ----
function alpha(r, d, o, { cold }) {
	const S = scheme(r, KID, KID, KID);
	const k = r();
	o.top = k < 0.4 ? { kind: 'tee', col: S.a, acc: S.b, acc2: S.c, pat: pick(r, ['graphic', 'graphic', 'stripe', 'block', 'dye', 'plain']), fit: 'regular', sleeves: sleevesFor(r, cold) }
		: k < 0.7 ? { kind: 'hoodie', col: S.a, acc: S.b, acc2: S.c, pat: pick(r, ['block', 'plain', 'graphic', 'dye']), fit: 'oversized', sleeves: 'long' }
			: k < 0.85 ? { kind: 'longsleeve', col: S.a, acc: S.b, pat: 'stripe', fit: 'regular', sleeves: 'long' }
				: { kind: 'jersey', col: S.a, acc: S.b, pat: 'jersey', fit: 'regular', sleeves: 'short', number: 1 + Math.floor(r() * 30) };
	const b = r();
	o.bottom = b < 0.3 ? { kind: 'joggers', col: col(pick(r, ['charcoal', 'navy', 'heather', 'black', 'cobalt', 'lilac'])), acc: S.c, pat: chance(r, 0.4) ? 'track' : 'plain', legs: 'long', fit: 'regular', cuff: true }
		: b < 0.55 ? { kind: 'shorts', col: col(pick(r, ['navy', 'black', 'khaki', 'cobalt', 'heather', 'kelly'])), acc: S.b, pat: chance(r, 0.4) ? 'track' : 'plain', legs: 'shorts', fit: 'regular' }
			: b < 0.75 ? { kind: 'jeans', col: col(pick(r, ['midwash', 'lightwash', 'indigo', 'bleach'])), pat: 'denim', legs: cold < 0.25 && chance(r, 0.3) ? 'shorts' : 'long', fit: chance(r, 0.5) ? 'wide' : 'straight' }
				: !d.male && chance(r, 0.6) ? { kind: 'skirt', col: col(pick(r, ['pink', 'lilac', 'midwash', 'navy', 'butter', 'mint'])), acc: S.c, pat: pick(r, ['plain', 'dots', 'plaid']), legs: 'skirt', len: 'mini' }
					: !d.male ? { kind: 'leggings', col: col(pick(r, ['black', 'lilac', 'pink', 'navy', 'aqua'])), acc: S.b, pat: chance(r, 0.3) ? 'dots' : 'plain', legs: 'long', fit: 'tight' }
						: { kind: 'cargo', col: col(pick(r, ['khaki', 'olive', 'navy', 'black'])), acc: S.b, pat: 'cargo', legs: cold < 0.3 ? 'shorts' : 'long', fit: 'baggy' };
	o.shoes = { kind: 'sneaker', col: col(pick(r, ['white', 'cherry', 'cobalt', 'hotpink', 'lime', 'black', 'aqua', 'butter'])), acc: col(pick(r, KID)), sole: col(pick(r, ['white', 'white', 'lime', 'hotpink', 'cobalt'])) };
	if (chance(r, 0.35)) o.acc.push({ kind: 'backpack', col: col(pick(r, KID)), acc: col(pick(r, KID)) });
	if (chance(r, 0.18)) o.acc.push({ kind: chance(r, 0.6) ? 'cap' : 'bucket', col: col(pick(r, KID)), acc: col(pick(r, KID)) });
}

// ---- Gen Z: baggy and boxy, cropped and oversized, layered, a little Y2K and gorpcore ----
function genz(r, d, o, { place, act, cold, office }) {
	const earthy = chance(r, 0.5);
	const S = earthy ? scheme(r, [...EARTH, 'cream', 'black', 'oat'], ['cream', 'white', 'black', 'oat', 'butter'], POP) : scheme(r, [...PASTEL, 'black', 'white', 'cherry', 'cobalt', 'butter'], NEUTRAL, POP);
	const f = !d.male;
	const k = r(), sl = sleevesFor(r, cold);
	if (office) o.top = { kind: chance(r, 0.5) ? 'knit' : 'tee', col: S.a, acc: S.b, pat: pick(r, ['plain', 'rib', 'stripe']), fit: 'oversized', sleeves: 'long' };
	else if (f && k < 0.35) o.top = { kind: 'crop', col: S.a, acc: S.c, acc2: S.b, pat: pick(r, ['plain', 'rib', 'stripe', 'graphic', 'ringer']), fit: 'fitted', sleeves: cold > 0.5 ? 'long' : pick(r, ['short', 'none', 'short']), crop: true };
	else if (k < 0.6) o.top = { kind: 'tee', col: S.a, acc: S.c, acc2: S.b, pat: pick(r, ['graphic', 'graphic', 'plain', 'ringer', 'stripe', 'block']), fit: 'oversized', sleeves: sl };
	else if (k < 0.8) o.top = { kind: 'hoodie', col: S.a, acc: S.b, acc2: S.c, pat: pick(r, ['plain', 'plain', 'block', 'graphic']), fit: 'oversized', sleeves: 'long' };
	else o.top = { kind: 'longsleeve', col: S.a, acc: S.b, pat: pick(r, ['stripe', 'plain', 'rib', 'graphic']), fit: 'regular', sleeves: 'long' };
	// the outer layer: a puffer vest, a big bomber or denim jacket, a colour-blocked fleece
	const w = r();
	if (cold > 0.3 || chance(r, 0.25)) {
		if (w < 0.25) o.outer = { kind: 'pufferVest', col: col(pick(r, ['black', 'olive', 'chocolate', 'cream', 'butter', 'cherry', 'sage', 'cobalt'])), acc: S.b, pat: 'quilt', fit: 'oversized', sleeves: 'none', open: chance(r, 0.4), fab: 'nylon' };
		else if (w < 0.45) o.outer = { kind: 'bomber', col: col(pick(r, ['black', 'olive', 'chocolate', 'burgundy', 'navy', 'cream'])), acc: col('tangerine'), pat: 'plain', fit: 'oversized', sleeves: 'long', open: chance(r, 0.6), fab: 'nylon' };
		else if (w < 0.62) o.outer = { kind: 'denim', col: col(pick(r, ['midwash', 'lightwash', 'blackdenim', 'bleach'])), pat: 'denim', fit: 'oversized', sleeves: 'long', open: true };
		else if (w < 0.8) o.outer = { kind: 'fleece', col: col(pick(r, ['cream', 'sage', 'mocha', 'navy', 'butter', 'lilac', 'teal'])), acc: col(pick(r, ['rust', 'kelly', 'cobalt', 'chocolate', 'tangerine'])), pat: 'fleeceblock', fit: 'regular', sleeves: 'long', open: false, fab: 'fleece' };
		else o.outer = chance(r, 0.5) ? { kind: 'shell', col: col(pick(r, SHELL)), acc: col(pick(r, ['black', 'cream', 'charcoal'])), pat: 'block', fit: 'oversized', sleeves: 'long', open: chance(r, 0.5), fab: 'nylon' }
			// a boxy cropped jacket: canvas, suede-ish or leather
			: { kind: 'jacket', col: col(pick(r, ['chocolate', 'black', 'tan', 'olive', 'cream', 'burgundy'])), pat: 'plain', fit: 'oversized', sleeves: 'long', open: chance(r, 0.6), crop: true, fab: chance(r, 0.3) ? 'leather' : 'canvas' };
	}
	const b = r();
	if (chance(r, 0.16)) o.bottom = chance(r, 0.5) ? { kind: 'carpenter', col: col(pick(r, ['tan', 'chocolate', 'khaki', 'cream', 'black'])), pat: 'plain', legs: 'long', fit: 'wide', fab: 'canvas' }
		: { kind: 'trousers', col: col(pick(r, ['black', 'charcoal', 'chocolate', 'stone', 'olive'])), pat: 'plain', legs: 'long', fit: 'wide' };
	else if (f && b < 0.18 && cold < 0.6) o.bottom = { kind: 'skirt', col: col(pick(r, ['black', 'chocolate', 'olive', 'midwash', 'cream', 'butter', 'plum'])), acc: S.c, pat: pick(r, ['plain', 'plain', 'plaid', 'denim']), legs: 'skirt', len: pick(r, ['mini', 'maxi', 'midi']) };
	else if (b < 0.55) o.bottom = { kind: 'jeans', col: col(pick(r, WASH)), pat: 'denim', legs: cold < 0.2 && chance(r, 0.35) ? 'jorts' : 'long', fit: pick(r, ['wide', 'wide', 'baggy', 'straight']) };
	else if (b < 0.78) o.bottom = { kind: 'cargo', col: col(pick(r, ['olive', 'khaki', 'black', 'stone', 'chocolate', 'grey', 'cream'])), acc: S.b, pat: 'cargo', legs: 'long', fit: pick(r, ['baggy', 'wide']) };
	else if (b < 0.9) o.bottom = { kind: 'track', col: col(pick(r, ['black', 'navy', 'kelly', 'burgundy', 'cobalt', 'grey'])), acc: col(pick(r, ['white', 'cream', 'butter'])), pat: 'track', legs: 'long', fit: 'wide' };
	else o.bottom = { kind: 'shorts', col: col(pick(r, ['black', 'grey', 'olive', 'cream', 'navy'])), acc: S.c, pat: 'plain', legs: 'shorts', fit: 'baggy' };
	o.shoes = chance(r, 0.6) ? { kind: 'chunky', col: col(pick(r, ['white', 'cream', 'grey', 'black', 'oat', 'heather'])), acc: col(pick(r, [...POP, 'grey', 'navy', 'chocolate'])), sole: col(pick(r, ['white', 'cream', 'oat', 'black'])) }
		: chance(r, 0.5) ? { kind: 'runner', col: col(pick(r, ['grey', 'cream', 'black', 'heather', 'butter'])), acc: col(pick(r, POP)), sole: col('white') }
			: { kind: 'skate', col: col(pick(r, ['black', 'chocolate', 'navy', 'cherry', 'olive'])), acc: col('white'), sole: col('cream') };
	if (chance(r, 0.3)) o.acc.push({ kind: 'tote', col: col(pick(r, ['cream', 'oat', 'black', 'butter', 'sage'])), acc: col(pick(r, POP)) });
	else if (chance(r, 0.18)) o.acc.push({ kind: 'crossbody', col: col(pick(r, ['black', 'olive', 'cream', 'lilac'])) });
	if (chance(r, 0.22) && place !== 'office') o.acc.push({ kind: 'headphones', col: col(pick(r, ['white', 'cream', 'black', 'grey', 'babyblue', 'sage'])) });
	if (cold > 0.4 && chance(r, 0.25)) o.acc.push({ kind: 'beanie', col: col(pick(r, ['black', 'oat', 'rust', 'butter', 'cherry', 'olive', 'babyblue'])) });
	else if (chance(r, 0.18)) o.acc.push({ kind: chance(r, 0.7) ? 'cap' : 'bucket', col: col(pick(r, ['black', 'cream', 'chocolate', 'olive', 'navy', 'cherry'])), acc: col('white') });
	if (chance(r, 0.12) && cold < 0.5) o.acc.push({ kind: 'sunglasses', slim: true, col: col(pick(r, ['black', 'cherry', 'white', 'butter'])) });
	if (act === 'ride' && chance(r, 0.3)) o.acc.push({ kind: 'sunglasses', slim: true, col: col('black') });
}

// ---- millennials: clean athleisure, neutrals with one colour, the tech vest ----
function millennial(r, d, o, { place, cold, office }) {
	const neutral = pick(r, ['black', 'charcoal', 'navy', 'oat', 'white', 'stone', 'heather', 'olive', 'cream']);
	const accent = pick(r, ['butter', 'cherry', 'cobalt', 'kelly', 'terracotta', 'sage', 'rust', 'teal']);
	const sl = sleevesFor(r, cold), f = !d.male;
	const k = r();
	if (office) o.top = k < 0.45 ? { kind: 'shirt', col: col(pick(r, ['white', 'babyblue', 'oat', 'white', 'navy'])), acc: col('navy'), pat: pick(r, ['plain', 'plain', 'oxford', 'pinstripe']), fit: 'regular', sleeves: 'long', collar: true }
		: k < 0.75 ? { kind: 'knit', col: col(pick(r, ['oat', 'navy', 'charcoal', 'camel', 'black', 'sage', 'burgundy'])), pat: 'rib', fit: 'regular', sleeves: 'long' }
			: { kind: 'tee', col: col(pick(r, ['white', 'black', 'oat', 'heather'])), pat: 'plain', fit: 'fitted', sleeves: 'short' };
	else if (k < 0.45) o.top = { kind: 'tee', col: col(chance(r, 0.7) ? neutral : accent), pat: 'plain', fit: 'fitted', sleeves: sl };
	else if (k < 0.65) o.top = { kind: 'halfzip', col: col(pick(r, ['navy', 'black', 'heather', 'sage', 'oat', 'charcoal'])), acc: col(accent), pat: 'plain', fit: 'fitted', sleeves: 'long', collar: true };
	else if (k < 0.8) o.top = chance(r, 0.4) && cold > 0.3 ? { kind: 'knit', col: col(pick(r, ['oat', 'cream', 'camel', 'charcoal', 'sage', 'navy'])), pat: 'rib', fit: 'oversized', sleeves: 'long' } : { kind: 'sweat', col: col(pick(r, ['heather', 'oat', 'navy', 'sage', 'cream', 'butter'])), acc: col(neutral), pat: 'rib', fit: 'regular', sleeves: 'long' };
	else o.top = { kind: 'henley', col: col(pick(r, ['white', 'oat', 'olive', 'navy', 'rust', 'charcoal'])), pat: 'plain', fit: 'fitted', sleeves: sl };
	// the outer: the quilted jacket, the fleece vest over a shirt (tech), a chore jacket
	const w = r();
	if (office && chance(r, 0.45)) o.outer = chance(r, 0.55) ? { kind: 'fleeceVest', col: col(pick(r, ['navy', 'charcoal', 'black', 'heather', 'olive'])), pat: 'fleece', fit: 'regular', sleeves: 'none', open: false, fab: 'fleece' }
		: { kind: 'blazer', col: col(pick(r, ['navy', 'charcoal', 'camel', 'black', 'olive', 'oat'])), pat: chance(r, 0.25) ? 'check' : 'plain', acc: col('grey'), fit: 'regular', sleeves: 'long', open: true };
	else if (cold > 0.35 || chance(r, 0.2)) {
		if (w < 0.35) o.outer = { kind: 'quilted', col: col(pick(r, ['olive', 'navy', 'black', 'chocolate', 'sage', 'camel'])), acc: col('chocolate'), pat: 'quilt', fit: 'regular', sleeves: 'long', open: chance(r, 0.5), fab: 'nylon' };
		else if (w < 0.55) o.outer = { kind: 'fleeceVest', col: col(pick(r, ['navy', 'charcoal', 'black', 'heather', 'olive', 'oat'])), pat: 'fleece', fit: 'regular', sleeves: 'none', open: false, fab: 'fleece' };
		else if (w < 0.75) o.outer = { kind: 'chore', col: col(pick(r, ['olive', 'navy', 'tan', 'chocolate', 'stone', 'rust'])), pat: 'plain', fit: 'regular', sleeves: 'long', open: true, fab: 'canvas' };
		else o.outer = { kind: f ? 'trench' : 'shell', col: col(f ? pick(r, ['camel', 'stone', 'oat', 'olive']) : pick(r, ['black', 'navy', 'olive', 'charcoal', accent])), pat: 'plain', fit: 'regular', sleeves: 'long', open: f, long: f, fab: f ? 'canvas' : 'nylon' };
	}
	const b = r();
	if (office) o.bottom = f && chance(r, 0.35) ? { kind: 'skirt', col: col(pick(r, ['black', 'camel', 'navy', 'olive', 'chocolate'])), pat: pick(r, ['plain', 'pleat']), legs: 'skirt', len: 'midi' } : { kind: 'trousers', col: col(pick(r, ['charcoal', 'navy', 'khaki', 'black', 'stone', 'olive'])), pat: 'plain', legs: 'long', fit: f ? pick(r, ['wide', 'straight']) : 'slim' };
	else if (b < 0.35) o.bottom = { kind: 'jeans', col: col(pick(r, ['rinse', 'indigo', 'midwash', 'blackdenim'])), pat: 'denim', legs: 'long', fit: pick(r, ['straight', 'slim', 'straight', f ? 'wide' : 'straight']) };
	else if (f && b < 0.45) o.bottom = { kind: 'trousers', col: col(pick(r, ['black', 'camel', 'stone', 'chocolate', 'oat'])), pat: 'plain', legs: 'long', fit: 'wide' };
	else if (b < 0.55) o.bottom = { kind: 'joggers', col: col(pick(r, ['black', 'charcoal', 'navy', 'heather', 'olive'])), pat: 'plain', legs: 'long', fit: 'slim', cuff: true };
	else if (b < 0.72) o.bottom = { kind: 'chinos', col: col(pick(r, ['khaki', 'stone', 'navy', 'olive', 'oat'])), pat: 'plain', legs: cold < 0.25 && chance(r, 0.5) ? 'shorts' : 'long', fit: 'slim' };
	else if (f && b < 0.9) o.bottom = { kind: 'leggings', col: col(pick(r, ['black', 'charcoal', 'navy', 'olive', 'mocha'])), pat: 'plain', legs: 'long', fit: 'tight' };
	else if (f) o.bottom = { kind: 'skirt', col: col(pick(r, ['olive', 'black', 'rust', 'oat', 'sage'])), pat: pick(r, ['plain', 'pleat']), legs: 'skirt', len: 'midi' };
	else o.bottom = { kind: 'shorts', col: col(pick(r, ['khaki', 'navy', 'olive', 'black'])), pat: 'plain', legs: 'shorts', fit: 'regular' };
	o.shoes = office && chance(r, 0.4) ? { kind: 'loafer', col: col(pick(r, ['chocolate', 'black', 'tan'])), sole: col('espresso') }
		: chance(r, 0.6) ? { kind: 'runner', col: col(pick(r, ['grey', 'navy', 'white', 'black', 'heather'])), acc: col(accent), sole: col('white') }
			: { kind: 'sneaker', col: col('white'), acc: col(pick(r, ['white', 'grey', 'navy', 'kelly'])), sole: col('white') };
	if (chance(r, 0.35)) o.acc.push({ kind: 'crossbody', col: col(pick(r, ['black', 'olive', 'camel', 'navy', 'chocolate'])) });
	else if ((office || place === 'sf') && chance(r, 0.35)) o.acc.push({ kind: 'backpack', col: col(pick(r, ['black', 'charcoal', 'navy', 'olive'])), acc: col('black'), slim: true });
	if (chance(r, 0.12)) o.acc.push({ kind: 'cap', col: col(pick(r, ['navy', 'black', 'olive', 'oat', 'white'])), acc: col(accent) });
}

// ---- Gen X: denim, band tees, flannel, boots, gear that works ----
function genx(r, d, o, { cold, office }) {
	const sl = sleevesFor(r, cold), f = !d.male;
	const k = r();
	if (office) o.top = { kind: 'shirt', col: col(pick(r, ['white', 'babyblue', 'navy', 'oat', 'sage'])), acc: col('navy'), pat: pick(r, ['plain', 'check', 'oxford']), fit: 'regular', sleeves: 'long', collar: true };
	else if (k < 0.35) o.top = { kind: 'tee', col: col(pick(r, ['black', 'charcoal', 'navy', 'burgundy', 'forest', 'heather'])), acc: col(pick(r, ['cream', 'butter', 'rust', 'white', 'lilac'])), acc2: col(pick(r, ['cherry', 'teal', 'mustard'])), pat: 'band', fit: 'regular', sleeves: sl };
	else if (k < 0.6) o.top = { kind: 'flannel', col: col(pick(r, ['cherry', 'forest', 'navy', 'rust', 'mustard', 'charcoal', 'burgundy'])), acc: col(pick(r, ['black', 'navy', 'cream'])), acc2: col(pick(r, ['cream', 'butter', 'white'])), pat: 'plaid', fit: 'regular', sleeves: 'long', collar: true };
	else if (k < 0.8) o.top = { kind: 'henley', col: col(pick(r, ['oat', 'olive', 'charcoal', 'navy', 'rust', 'white'])), pat: 'plain', fit: 'regular', sleeves: sl };
	else o.top = { kind: 'shirt', col: col(pick(r, ['midwash', 'lightwash', 'indigo'])), pat: 'chambray', fit: 'regular', sleeves: 'long', collar: true };
	const w = r();
	if (cold > 0.3 || chance(r, 0.3)) {
		if (w < 0.35) o.outer = { kind: 'denim', col: col(pick(r, ['midwash', 'indigo', 'lightwash', 'blackdenim'])), pat: 'denim', fit: 'regular', sleeves: 'long', open: true };
		else if (w < 0.55) o.outer = { kind: 'flannel', col: col(pick(r, ['cherry', 'forest', 'navy', 'rust', 'mustard'])), acc: col('black'), acc2: col('cream'), pat: 'plaid', fit: 'oversized', sleeves: 'long', open: true, fab: 'canvas' };
		else if (w < 0.75) o.outer = { kind: 'utility', col: col(pick(r, ['olive', 'tan', 'chocolate', 'black', 'khaki'])), pat: 'plain', fit: 'regular', sleeves: 'long', open: chance(r, 0.6), fab: 'canvas' };
		else o.outer = { kind: 'fleece', col: col(pick(r, ['navy', 'forest', 'charcoal', 'rust', 'teal'])), acc: col('black'), pat: 'fleece', fit: 'regular', sleeves: 'long', open: false, fab: 'fleece' };
	}
	const b = r();
	o.bottom = office ? { kind: 'chinos', col: col(pick(r, ['khaki', 'navy', 'charcoal', 'stone'])), pat: 'plain', legs: 'long', fit: 'straight' }
		: b < 0.55 ? { kind: 'jeans', col: col(pick(r, ['midwash', 'indigo', 'lightwash', 'blackdenim', 'rinse'])), pat: 'denim', legs: 'long', fit: 'straight' }
			: b < 0.75 ? { kind: 'cargo', col: col(pick(r, ['khaki', 'olive', 'charcoal', 'stone'])), pat: 'cargo', legs: cold < 0.3 ? 'shorts' : 'long', fit: 'regular' }
				: f && b < 0.9 ? { kind: 'skirt', col: col(pick(r, ['black', 'indigo', 'olive', 'chocolate'])), pat: pick(r, ['plain', 'denim']), legs: 'skirt', len: 'midi' }
					: { kind: 'chinos', col: col(pick(r, ['khaki', 'olive', 'navy', 'stone'])), pat: 'plain', legs: 'long', fit: 'straight' };
	o.shoes = chance(r, 0.4) ? { kind: 'boot', col: col(pick(r, ['chocolate', 'black', 'tan', 'mocha'])), acc: col('charcoal'), sole: col('espresso') }
		: chance(r, 0.5) ? { kind: 'trail', col: col(pick(r, ['charcoal', 'olive', 'tan', 'grey'])), acc: col(pick(r, ['tangerine', 'teal', 'cherry', 'lime'])), sole: col('charcoal') }
			: { kind: 'skate', col: col(pick(r, ['black', 'navy', 'white', 'cherry'])), acc: col('white'), sole: col('white') };
	if (chance(r, 0.18)) o.acc.push({ kind: 'cap', col: col(pick(r, ['navy', 'black', 'olive', 'rust', 'khaki'])), acc: col('cream'), faded: true });
	if (chance(r, 0.2) && cold < 0.55) o.acc.push({ kind: 'sunglasses', col: col(pick(r, ['black', 'espresso', 'tan'])) });
	if (chance(r, 0.15)) o.acc.push({ kind: 'backpack', col: col(pick(r, ['charcoal', 'olive', 'tan', 'black'])), acc: col('black') });
}

// ---- boomers: polos, windbreakers, khakis, a sun hat, good walking shoes ----
function boomer(r, d, o, { cold, office }) {
	const f = !d.male, sl = sleevesFor(r, cold);
	const k = r();
	if (k < 0.4) o.top = { kind: 'polo', col: col(pick(r, ['navy', 'white', 'sage', 'babyblue', 'coral', 'butter', 'heather', 'teal', 'lavender'])), acc: col('white'), pat: chance(r, 0.2) ? 'stripe' : 'plain', fit: 'regular', sleeves: sl, collar: true };
	else if (k < 0.62) o.top = { kind: 'shirt', col: col(pick(r, ['white', 'babyblue', 'oat', 'sage', 'lavender'])), acc: col(pick(r, ['navy', 'cobalt', 'cherry', 'kelly'])), pat: pick(r, ['check', 'plain', 'check', 'oxford']), fit: 'regular', sleeves: sl, collar: true };
	else if (f && k < 0.82) o.top = { kind: 'knit', col: col(pick(r, ['oat', 'cream', 'sage', 'lavender', 'coral', 'navy', 'teal'])), pat: 'rib', fit: 'regular', sleeves: 'long', cardigan: true };
	else o.top = { kind: 'halfzip', col: col(pick(r, ['navy', 'heather', 'forest', 'burgundy', 'oat'])), acc: col('white'), pat: 'plain', fit: 'regular', sleeves: 'long', collar: true };
	if (cold > 0.35 || chance(r, 0.2)) o.outer = chance(r, 0.6) ? { kind: 'windbreaker', col: col(pick(r, ['navy', 'red', 'teal', 'khaki', 'kelly', 'cobalt'])), acc: col('white'), pat: chance(r, 0.4) ? 'block' : 'plain', fit: 'regular', sleeves: 'long', open: chance(r, 0.4), fab: 'nylon' }
		: { kind: 'quiltedVest', col: col(pick(r, ['navy', 'khaki', 'forest', 'black'])), pat: 'quilt', fit: 'regular', sleeves: 'none', open: false, fab: 'nylon' };
	const b = r();
	o.bottom = f && b < 0.2 ? { kind: 'capri', col: col(pick(r, ['white', 'khaki', 'navy', 'stone'])), pat: 'plain', legs: 'capri', fit: 'straight' }
		: cold < 0.3 && b < 0.45 ? { kind: 'shorts', col: col(pick(r, ['khaki', 'navy', 'stone', 'olive'])), pat: 'plain', legs: 'bermuda', fit: 'regular' }
			: b < 0.75 ? { kind: 'khakis', col: col(pick(r, ['khaki', 'stone', 'tan', 'sand'])), pat: 'plain', legs: 'long', fit: 'straight' }
				: { kind: 'slacks', col: col(pick(r, ['navy', 'charcoal', 'grey', 'khaki'])), pat: 'plain', legs: 'long', fit: 'straight' };
	if (office) o.bottom.kind = 'slacks';
	o.shoes = chance(r, 0.65) ? { kind: 'walker', col: col(pick(r, ['white', 'heather', 'oat', 'grey', 'navy'])), acc: col(pick(r, ['grey', 'navy', 'teal'])), sole: col('white') } : { kind: 'loafer', col: col(pick(r, ['chocolate', 'tan', 'black'])), sole: col('espresso') };
	if (chance(r, cold < 0.4 ? 0.45 : 0.15)) o.acc.push(chance(r, 0.6) ? { kind: f ? 'sunhat' : 'bucket', col: col(pick(r, ['oat', 'khaki', 'white', 'sand', 'navy'])), acc: col('navy') } : { kind: 'cap', col: col(pick(r, ['navy', 'white', 'khaki', 'red'])), acc: col('white') });
	if (chance(r, 0.25)) o.acc.push({ kind: 'crossbody', col: col(pick(r, ['camel', 'chocolate', 'black', 'navy'])) });
}

// ---- on the move: runners, hikers, the beach ----
function jogger(r, d, o, cold) {
	const S = scheme(r, ['black', 'navy', 'charcoal', 'white', 'heather'], ['black', 'white'], ['lime', 'tangerine', 'hotpink', 'cobalt', 'aqua', 'cherry', 'butter']);
	o.top = { kind: cold < 0.3 && chance(r, 0.3) ? 'tank' : 'tech', col: chance(r, 0.5) ? S.c : S.a, acc: S.c, pat: chance(r, 0.4) ? 'block' : 'plain', fit: 'fitted', sleeves: cold > 0.55 ? 'long' : chance(r, 0.3) ? 'none' : 'short', fab: 'tech' };
	o.bottom = !d.male && chance(r, 0.6) ? { kind: 'leggings', col: col(pick(r, ['black', 'navy', 'charcoal', 'olive'])), acc: S.c, pat: chance(r, 0.3) ? 'track' : 'plain', legs: cold > 0.6 ? 'long' : pick(r, ['long', 'capri', 'bike']), fit: 'tight' }
		: { kind: 'runshorts', col: col(pick(r, ['black', 'navy', 'charcoal', 'cobalt'])), acc: S.c, pat: 'plain', legs: 'short', fit: 'regular' };
	o.shoes = { kind: 'runner', col: col(pick(r, ['white', 'black', 'lime', 'tangerine', 'cobalt', 'hotpink', 'grey'])), acc: S.c, sole: col(pick(r, ['white', 'lime', 'white'])) };
	if (chance(r, 0.45)) o.acc.push({ kind: chance(r, 0.7) ? 'cap' : 'visor', col: col(pick(r, ['black', 'white', 'navy'])), acc: S.c });
	if (chance(r, 0.35)) o.acc.push({ kind: 'sunglasses', slim: true, col: col('black') });
	return o;
}
function hiker(r, d, o, cold, wet) {
	const gen = o.gen;
	o.top = { kind: 'tech', col: col(pick(r, ['heather', 'sage', 'navy', 'oat', 'teal', 'charcoal', 'butter', 'rust'])), acc: col('black'), pat: chance(r, 0.25) ? 'block' : 'plain', fit: 'regular', sleeves: cold > 0.45 ? 'long' : 'short', fab: 'tech' };
	if (cold > 0.3 || wet || chance(r, 0.35)) o.outer = chance(r, wet ? 0.9 : 0.55) ? { kind: 'shell', col: col(pick(r, SHELL)), acc: col(pick(r, ['black', 'charcoal', 'cream'])), pat: chance(r, 0.5) ? 'block' : 'plain', fit: 'regular', sleeves: 'long', open: chance(r, 0.35), fab: 'nylon' }
		: { kind: 'fleece', col: col(pick(r, ['cream', 'sage', 'navy', 'rust', 'teal', 'mocha', 'butter'])), acc: col(pick(r, ['chocolate', 'navy', 'kelly', 'tangerine'])), pat: 'fleeceblock', fit: 'regular', sleeves: 'long', open: false, fab: 'fleece' };
	o.bottom = cold < 0.35 && chance(r, 0.5) ? { kind: 'hikeshorts', col: col(pick(r, ['khaki', 'olive', 'charcoal', 'stone', 'tan'])), pat: 'cargo', legs: 'shorts', fit: 'regular' }
		: !d.male && chance(r, 0.35) ? { kind: 'leggings', col: col(pick(r, ['black', 'olive', 'mocha', 'navy'])), pat: 'plain', legs: 'long', fit: 'tight' }
			: { kind: 'hikepants', col: col(pick(r, ['khaki', 'olive', 'charcoal', 'stone', 'tan', 'slate'])), pat: 'cargo', legs: 'long', fit: gen === 'z' ? 'wide' : 'straight' };
	o.shoes = { kind: 'trail', col: col(pick(r, ['charcoal', 'olive', 'tan', 'grey', 'black', 'sage'])), acc: col(pick(r, ['tangerine', 'lime', 'cobalt', 'cherry', 'aqua', 'butter'])), sole: col(pick(r, ['charcoal', 'tangerine', 'grey'])) };
	o.acc.push({ kind: 'backpack', col: col(pick(r, ['charcoal', 'olive', 'tangerine', 'cobalt', 'forest', 'rust', 'black'])), acc: col('black') });
	if (chance(r, 0.6)) o.acc.push({ kind: chance(r, 0.55) ? 'cap' : gen === 'boomer' ? 'sunhat' : 'bucket', col: col(pick(r, ['khaki', 'olive', 'navy', 'oat', 'charcoal', 'rust'])), acc: col('cream') });
	if (chance(r, 0.4)) o.acc.push({ kind: 'sunglasses', slim: gen === 'z', col: col(pick(r, ['black', 'tan', 'espresso'])) });
	return o;
}
function beach(r, d, o) {
	const f = !d.male, kid = d.child;
	const S = scheme(r, kid ? KID : [...POP, 'navy', 'black', 'white', 'chocolate', 'olive', 'terracotta'], kid ? KID : ['white', 'cream', 'navy', 'butter'], POP);
	if (f && !kid) {
		o.top = chance(r, 0.55) ? { kind: 'bikini', col: S.a, acc: S.b, pat: pick(r, ['plain', 'plain', 'stripe', 'dots', 'rib']), fit: 'tight', sleeves: 'none' }
			: { kind: 'swim', col: S.a, acc: S.b, pat: pick(r, ['plain', 'block', 'stripe']), fit: 'tight', sleeves: 'none', onepiece: true };
		o.bottom = o.top.onepiece ? { kind: 'swim', col: S.a, acc: S.b, pat: o.top.pat, legs: 'brief', fit: 'tight' } : { kind: 'swim', col: S.a, acc: S.b, pat: o.top.pat, legs: 'brief', fit: 'tight' };
		if (chance(r, 0.35)) o.outer = { kind: 'coverup', col: col(pick(r, ['white', 'cream', 'butter', 'sage', 'pink'])), pat: chance(r, 0.4) ? 'stripe' : 'plain', acc: S.b, fit: 'oversized', sleeves: 'long', open: true, fab: 'linen' };
	} else {
		o.top = kid && chance(r, 0.6) ? { kind: 'rash', col: S.a, acc: S.b, pat: 'block', fit: 'fitted', sleeves: chance(r, 0.5) ? 'long' : 'short' }
			: !kid && chance(r, 0.25) ? { kind: 'shirt', col: col(pick(r, ['white', 'cream', 'butter', 'sage', 'aqua'])), acc: S.b, pat: pick(r, ['plain', 'stripe']), fit: 'oversized', sleeves: 'short', open: true, collar: true }
				: chance(r, 0.5) ? null : { kind: chance(r, 0.4) ? 'tank' : 'tee', col: S.a, acc: S.c, pat: pick(r, ['graphic', 'plain', 'plain']), fit: 'regular', sleeves: 'short' };
		if (kid && !d.male && !o.top) o.top = { kind: 'swim', col: S.a, acc: S.b, pat: 'dots', fit: 'tight', sleeves: 'none', onepiece: true };
		o.bottom = { kind: 'boardshorts', col: S.a, acc: S.b, acc2: S.c, pat: pick(r, ['block', 'stripe', 'plain', 'dye', 'block']), legs: 'board', fit: 'regular' };
		if (o.top?.onepiece) o.bottom = { kind: 'swim', col: o.top.col, acc: S.b, pat: 'dots', legs: 'brief', fit: 'tight' };
	}
	o.shoes = { kind: chance(r, 0.6) ? 'barefoot' : 'sandal', col: col(pick(r, ['black', 'tan', 'white', 'navy', 'cherry'])), sole: col(pick(r, ['black', 'tan', 'white'])) };
	if (chance(r, 0.45)) o.acc.push({ kind: 'sunglasses', slim: chance(r, 0.4), col: col(pick(r, ['black', 'tan', 'white', 'cherry', 'butter'])) });
	if (chance(r, kid ? 0.3 : 0.35)) o.acc.push({ kind: f ? pick(r, ['sunhat', 'bucket', 'cap']) : pick(r, ['cap', 'bucket']), col: col(pick(r, ['oat', 'white', 'sand', 'navy', 'butter'])), acc: col('navy') });
	if (!kid && chance(r, 0.25)) o.acc.push({ kind: 'tote', col: col(pick(r, ['cream', 'sand', 'aqua', 'butter'])), acc: S.c });
	return o;
}

// ---------- kits: a team's colours on a player ----------
// team: { a: shirt, b: second, c: trim, pat: 'plain'|'hoops'|'stripes'|'sash'|'pinstripe', pants, socks }
export function kitFor(sport, team, number, d, extra = {}) {
	const o = { gen: generation(d.age), top: null, outer: null, bottom: null, shoes: null, acc: [], kit: true };
	const a = team.a, b = team.b || '#ffffff', c = team.c || b;
	if (sport === 'baseball') {
		o.top = { kind: 'jersey', col: a, acc: b, acc2: c, pat: team.pat || 'jersey', fit: 'regular', sleeves: 'short', number, collar: false };
		o.bottom = { kind: 'baseball', col: team.pants || '#ece8dc', acc: a, pat: 'track', legs: 'knicker', fit: 'regular', socks: a };
		o.shoes = { kind: 'cleat', col: '#1b1b1d', sole: '#1b1b1d' };
		o.acc.push(extra.helmet ? { kind: 'helmet', col: a } : { kind: 'cap', col: a, acc: b });
		if (extra.glove) o.acc.push({ kind: 'mitt', col: '#8a5a30' });
	} else if (sport === 'soccer') {
		o.top = { kind: 'jersey', col: a, acc: b, acc2: c, pat: team.pat || 'jersey', fit: 'fitted', sleeves: extra.keeper ? 'long' : 'short', number };
		o.bottom = { kind: 'shorts', col: team.pants || b, acc: a, pat: 'track', legs: 'short', fit: 'regular', socks: team.socks || a };
		o.shoes = { kind: 'cleat', col: extra.boots || '#f3f2ee', acc: a, sole: '#1b1b1d' };
		if (extra.keeper) o.acc.push({ kind: 'gloves', col: extra.gloves || '#f3f2ee', acc: a });
	} else if (sport === 'football') {
		o.top = { kind: 'jersey', col: a, acc: b, acc2: c, pat: 'jersey', fit: 'oversized', sleeves: 'short', number, pads: true };
		o.bottom = { kind: 'football', col: team.pants || '#ece8dc', acc: a, pat: 'track', legs: 'knicker', fit: 'tight', socks: a };
		o.shoes = { kind: 'cleat', col: '#1b1b1d', sole: '#1b1b1d' };
		if (extra.helmet) o.acc.push({ kind: 'helmet', col: a, cage: true });
	} else {
		// any other game: a tech tee and shorts in the colours
		o.top = { kind: 'jersey', col: a, acc: b, acc2: c, pat: team.pat || 'jersey', fit: 'regular', sleeves: extra.sleeves || 'short', number };
		o.bottom = { kind: 'shorts', col: team.pants || b, acc: a, pat: 'track', legs: extra.legs || 'short', fit: 'regular', socks: team.socks };
		o.shoes = { kind: 'runner', col: extra.boots || '#1b1b1d', acc: a, sole: '#f3f2ee' };
	}
	return o;
}

// ---------- other worlds: the realm's cloth, and the suits and skins of the far worlds ----------
export function tunicFor(r, d, { body, legs, trim, hood = false } = {}) {
	const o = { gen: 'medieval', top: { kind: 'tunic', col: body, acc: trim || body, pat: trim ? 'hem' : 'plain', fit: 'regular', sleeves: 'long', fab: 'wool' }, outer: null, bottom: { kind: 'hose', col: legs || body, pat: 'plain', legs: 'long', fit: 'tight', fab: 'wool' }, shoes: { kind: 'boot', col: '#3a2a1c', sole: '#2a1c12' }, acc: [] };
	if (hood) o.acc.push({ kind: 'hood', col: trim || body });
	return o;
}
// a suit for one of the far worlds' players: a hazmat suit, a dive skin, a heat suit
export function suitFor(kind, a, b) {
	const o = { gen: 'alien', top: { kind: 'suit', col: a, acc: b, pat: kind === 'hazmat' ? 'hazmat' : kind === 'heat' ? 'heat' : 'block', fit: kind === 'hazmat' ? 'oversized' : 'fitted', sleeves: 'long', fab: kind === 'hazmat' ? 'nylon' : 'tech' }, outer: null, bottom: { kind: 'suit', col: a, acc: b, pat: 'plain', legs: 'long', fit: kind === 'hazmat' ? 'baggy' : 'tight', fab: kind === 'hazmat' ? 'nylon' : 'tech' }, shoes: { kind: 'boot', col: b, sole: '#1b1b1d' }, acc: [] };
	if (kind === 'hazmat') o.acc.push({ kind: 'hazhood', col: a, acc: '#2a3036' });
	if (kind === 'heat') o.acc.push({ kind: 'helmet', col: b, visor: '#ff8a30' });
	if (kind === 'sky') o.acc.push({ kind: 'visor', col: b });
	if (kind === 'ice') o.acc.push({ kind: 'beanie', col: b }, { kind: 'gloves', col: b });
	if (kind === 'dive') o.acc.push({ kind: 'cap', col: b, swim: true });
	return o;
}

// hair to go with the person and the look: the cut (hair.js CUTS) by how their hair grows,
// their generation and what they wear; colours (a few dyed among the young, the roots
// showing on some); hairlines that recede and crowns that thin on some men with the years,
// salt and pepper in middle age
const wpick = (r, L) => { let x = r() * L.reduce((a, b) => a + b[1], 0); for (const [k, w] of L) { if ((x -= w) < 0) return k; } return L[0][0]; };
const CUT_BY = {
	coily: {
		m: [['fade', 3], ['coils', 2], ['shortlocs', 1], ['locs', 1], ['cornrows', 0.7], ['afro', 0.6], ['braids', 0.4], ['crop', 1]],
		f: [['braids', 2.2], ['locs', 1], ['afro', 1], ['coils', 1.2], ['bun', 1.4], ['pony', 1], ['cornrows', 0.6], ['long', 0.8], ['bob', 0.8]],
	},
	z: { m: [['fade', 2.2], ['textured', 2.2], ['quiff', 1], ['short', 1.2], ['crop', 1], ['lob', 0.4], ['bun', 0.4]], f: [['long', 2.2], ['waves', 1.6], ['lob', 1.2], ['pony', 1.4], ['bun', 1.2], ['bob', 1], ['fringe', 0.8], ['pixie', 0.3]] },
	millennial: { m: [['short', 2.5], ['fade', 1.5], ['quiff', 1.2], ['slick', 1.2], ['crop', 1.5], ['bun', 0.5]], f: [['lob', 2], ['long', 1.6], ['waves', 1.2], ['pony', 1.4], ['bun', 1.4], ['bob', 1.2], ['pixie', 0.6], ['fringe', 0.6]] },
	x: { m: [['short', 3.5], ['crop', 2.5], ['slick', 1], ['textured', 0.6]], f: [['bob', 2.5], ['lob', 2.5], ['pixie', 1.5], ['waves', 1.5], ['pony', 1]] },
	boomer: { m: [['short', 3], ['crop', 3], ['slick', 0.6]], f: [['bob', 3], ['pixie', 3], ['curls', 2], ['lob', 1.5]] },
	alpha: { m: [['crop', 3.5], ['short', 2.5], ['fade', 2], ['curls', 1]], f: [['pony', 3.5], ['long', 2.5], ['bun', 1], ['bob', 1]] },
};
export function hairFor(r, d, o) {
	const out = { dyed: null, buzz: false, bun: false, volume: 1, scarf: false, cut: 'short', recede: 0, thin: 0, salt: 0, part: r() < 0.5 ? -1 : 1, fresh: false };
	const g = d.child ? 'alpha' : o?.gen && CUT_BY[o.gen] ? o.gen : generation(d.age), f = !d.male;
	const afr = d.ancestry?.[0] || 0, coily = afr > 0.55 || (afr > 0.3 && chance(r, 0.6)), curly = !coily && chance(r, 0.12 + afr * 0.4);
	out.cut = wpick(r, coily && !d.child ? CUT_BY.coily[f ? 'f' : 'm'] : CUT_BY[g][f ? 'f' : 'm']);
	if (d.child && coily) out.cut = f ? pick(r, ['braids', 'pony', 'coils', 'bun']) : pick(r, ['coils', 'fade', 'crop']);
	// curly hair stays curly
	if (curly && /^(short|crop|textured|lob|long|bob)$/.test(out.cut)) out.cut = /^(lob|long)$/.test(out.cut) ? 'waves' : 'curls';
	// the look: sharper cuts in the office, looser hair on the trail and the beach
	if (o?.look === 'preppy' && /^(textured|shortlocs)$/.test(out.cut)) out.cut = 'short';
	if (d.child) return out;
	if (g === 'z' && chance(r, 0.14)) out.dyed = pick(r, ['#e8a3c4', '#b9a3e0', '#7fb2e8', '#e8dcb8', '#c8643a', '#f0e6d2', '#8fd0b8']);
	else if (g === 'millennial' && chance(r, 0.05)) out.dyed = pick(r, ['#c8643a', '#e8dcb8', '#b9a3e0']);
	else if (!d.male && d.age > 40 && d.age < 70 && chance(r, 0.25)) out.dyed = pick(r, ['#5a3a24', '#8a6a48', '#b89a70', '#3a2a20']);
	out.fresh = chance(r, 0.5);
	if (d.male && d.hair && chance(r, coily ? 0.12 : 0.1)) out.buzz = true;
	// the years: a receding hairline, a thinning crown, grey coming in
	if (d.male && d.age > 26) { out.recede = Math.min(1, (d.age - 26) / 40) * (0.3 + r() * 0.9); if (d.age > 42 && chance(r, 0.35)) { out.thin = 0.5 + r() * 0.5; if (!/^(fade|crop|short|slick)$/.test(out.cut)) out.cut = 'short'; if (out.thin > 0.8) out.cut = 'thinning'; } }
	if (!d.male && d.age > 58 && chance(r, 0.3)) out.thin = 0.3;
	if (d.age > 36 && d.age < 64 && !out.dyed) out.salt = Math.min(1, (d.age - 36) / 28) * r() * 0.8;
	// a headscarf for a few women, in the season's colours
	if (!d.male && d.age > 16 && chance(r, 0.03)) out.scarf = pick(r, ['#2f4a38', '#1f2a44', '#b08552', '#6a2331', '#d9ccb2', '#57304a', '#1b1b1d', '#9aa58a']);
	return out;
}

// a plain outfit from the old flat description (top, bottom, shoes colours, sleeves, jacket,
// legs), for the places that still dress people that way
export function fromFlat(f) {
	const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, Math.pow(v, 1 / 2.2))) * 255).toString(16).padStart(2, '0')).join('');
	const o = { gen: 'flat', top: { kind: f.sleeves === 'long' ? 'longsleeve' : 'tee', col: hex(f.top), pat: 'plain', fit: 'regular', sleeves: f.sleeves || 'short', fab: f.fabricTop || 'knit' }, outer: null, bottom: { kind: f.legs === 'skirt' ? 'skirt' : 'trousers', col: hex(f.bottom), pat: 'plain', legs: f.legs === 'shorts' ? 'shorts' : f.legs === 'skirt' ? 'skirt' : 'long', len: 'midi', fit: 'straight' }, shoes: { kind: 'sneaker', col: hex(f.shoes), sole: hex(f.shoes) }, acc: [] };
	if (f.jacket) o.outer = { kind: 'jacket', col: hex(f.jacket), pat: 'plain', fit: 'regular', sleeves: 'long', open: false, fab: 'canvas' };
	return o;
}
