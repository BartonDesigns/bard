// How a business shows itself on its street and lives through its day: what its ground floor
// is (a glazed shopfront with its goods behind the glass, an office's window, a guest
// house's porch, a workshop's roll-up doors), what can be seen inside, its hours, what it
// does after closing (shutters down, a night light, dark; the bar stays lit), the people
// it puts out front while it is open (a server by the tables, a mechanic at the car, a
// fisher at the boat), how its rooms are fitted out, and the town's working day (the
// morning walk in, lunch, the customers, closing up and the walk home).
//
// Pure: no three, no document. economy/storefront.js draws the fronts, economy/layer.js
// sizes and places them, interiors/estab-fit.js fits the rooms out, people/people.js casts
// the staff and the customers from what is here.
//
//   profileOf(type)                   the type's front, display, hours, night and fit-out
//   hoursOf(E)                        [open, close] in hours (close past 24 runs after midnight)
//   stateAt(E, hours, dow)            { open, lit, shutter, sign, phase } for the shader and the people
//   frontSpec(use, run, wallH, style) the glazing's width and height on that face, or null
//   gapRoom(gap, use)                 how far out from the facade things may stand
//   postsFor(E)                       the staff spots out front (in the face's own frame)
//   shiftOf(E, seed)                  a worker's day: arrive, lunch, leave
//   phaseOf(shift, hours)             'home' | 'arriving' | 'work' | 'lunch' | 'leaving'
//   lifeAt(hours, weekend)            the town's mix of walks: in to work, to lunch, shopping, home
//   coastScan(H, x, z, sea)           how far the water is (and which way) from a few rings of samples

import { hashAt } from './establishments.js';

// ---------- what can be seen through the glass ----------
// the shader's display kinds (economy/storefront.js draws each behind the glass)
export const DISPLAY = { none: 0, cafe: 1, dining: 2, bar: 3, counter: 4, grocer: 5, shelves: 6, books: 7, clothes: 8, flowers: 9, gear: 10, salon: 11, laundry: 12, gym: 13, office: 14, garage: 15, workshop: 16, bakery: 17, deli: 18, lobby: 19, arcade: 20, boats: 21 };

// ---------- the types ----------
// style: glass (a shopfront), office (an office window, blinds), lodging (a porch and its desk),
// bays (roll-up doors), home (it stays a house: a sign and a porch), none (its own building);
// d: the display; h: [open, close]; n: after hours (shutter, night: a dim light left on,
// dark, lit: the sign stays on); wk: closed at weekends; fit: how its rooms are fitted out
// (interiors/estab-fit.js); seat: outdoor seating; post: who stands out front
const P = (style, d, h, n, fit, extra = {}) => ({ style, d: DISPLAY[d], display: d, h, n, fit, ...extra });
export const PROFILES = {
	cafe: P('glass', 'cafe', [6.5, 17], 'dark', 'cafe', { seat: 2, post: 'server' }),
	bakery: P('glass', 'bakery', [6, 15], 'dark', 'bakery', { post: 'baker' }),
	waffle: P('glass', 'cafe', [7, 15], 'dark', 'cafe', { seat: 1 }),
	donut: P('glass', 'counter', [5, 13], 'dark', 'counter'),
	boba: P('glass', 'counter', [11, 21], 'shutter', 'counter'),
	icecream: P('glass', 'counter', [12, 22], 'shutter', 'counter', { seat: 1 }),
	pasta: P('glass', 'dining', [11.5, 22.5], 'dark', 'restaurant', { seat: 2, post: 'server' }),
	pizza: P('glass', 'dining', [11, 23], 'dark', 'pizzeria', { seat: 1 }),
	diner: P('glass', 'dining', [6, 22], 'dark', 'diner', { post: 'server' }),
	burger: P('glass', 'counter', [6, 24], 'night', 'counter'),
	taco: P('glass', 'counter', [10, 22], 'shutter', 'counter', { seat: 1 }),
	sushi: P('glass', 'dining', [11.5, 22], 'dark', 'sushi'),
	ramen: P('glass', 'dining', [11, 23], 'dark', 'sushi'),
	bistro: P('glass', 'dining', [12, 23], 'dark', 'restaurant', { seat: 2, post: 'server' }),
	pub: P('glass', 'bar', [11, 25], 'dark', 'pub', { seat: 1, post: 'smoker' }),
	bbq: P('glass', 'dining', [11, 21], 'dark', 'restaurant', { seat: 2, post: 'pitmaster' }),
	seafood: P('glass', 'dining', [11, 22], 'dark', 'restaurant', { seat: 2, post: 'server' }),
	curry: P('glass', 'dining', [11.5, 23], 'dark', 'restaurant'),
	noodles: P('glass', 'dining', [10.5, 22], 'dark', 'sushi'),
	tapas: P('glass', 'bar', [12, 25], 'dark', 'pub', { seat: 2, post: 'server' }),
	izakaya: P('glass', 'bar', [17, 25], 'dark', 'pub'),
	grill: P('glass', 'counter', [10, 24], 'shutter', 'counter', { seat: 1 }),
	bookshop: P('glass', 'books', [10, 19], 'night', 'books', { post: 'clerk' }),
	florist: P('glass', 'flowers', [8, 18], 'night', 'florist', { post: 'stocker' }),
	hardware: P('glass', 'shelves', [8, 19], 'shutter', 'hardware', { post: 'clerk' }),
	grocer: P('glass', 'grocer', [7, 22], 'shutter', 'grocer', { post: 'stocker' }),
	pharmacy: P('glass', 'shelves', [8, 21], 'night', 'pharmacy'),
	outfitter: P('glass', 'gear', [6, 18], 'shutter', 'gear', { post: 'fisher' }),
	bait: P('glass', 'gear', [5, 17], 'shutter', 'bait', { post: 'fisher' }),
	surf: P('glass', 'gear', [9, 18], 'shutter', 'gear', { post: 'clerk' }),
	huntpost: P('glass', 'gear', [7, 18], 'shutter', 'gear', { post: 'clerk' }),
	general: P('glass', 'shelves', [7, 20], 'dark', 'general', { post: 'clerk' }),
	feed: P('glass', 'shelves', [7, 18], 'dark', 'general', { post: 'stocker' }),
	farmstand: P('home', 'grocer', [8, 18], 'dark', null, { post: 'stocker' }),
	antiques: P('glass', 'shelves', [10, 17], 'night', 'antiques'),
	bike: P('glass', 'gear', [10, 18], 'shutter', 'workshop', { post: 'mechanic' }),
	records: P('glass', 'books', [11, 20], 'shutter', 'records'),
	thrift: P('glass', 'clothes', [10, 18], 'shutter', 'clothes'),
	pet: P('glass', 'shelves', [9, 20], 'shutter', 'pet'),
	liquor: P('glass', 'shelves', [10, 23], 'shutter', 'liquor'),
	phonefix: P('glass', 'counter', [10, 19], 'shutter', 'repair'),
	boutique: P('glass', 'clothes', [10, 19], 'night', 'clothes'),
	gift: P('glass', 'shelves', [9, 19], 'night', 'gift'),
	butcher: P('glass', 'deli', [7, 18], 'shutter', 'butcher'),
	winery: P('glass', 'bar', [11, 18], 'dark', 'tasting', { seat: 2 }),
	salon: P('glass', 'salon', [9, 19], 'night', 'salon', { post: 'smoker' }),
	barber: P('glass', 'salon', [8, 18], 'shutter', 'barber', { post: 'smoker' }),
	laundromat: P('glass', 'laundry', [6, 23], 'lit', 'laundromat'),
	gym: P('glass', 'gym', [5, 23], 'night', 'gym'),
	yoga: P('glass', 'gym', [7, 21], 'dark', 'yoga'),
	daycare: P('home', 'none', [7, 18], 'dark', 'daycare', { wk: true }),
	tutor: P('home', 'none', [15, 20], 'dark', null),
	vet: P('office', 'office', [8, 18], 'night', 'clinic'),
	tailor: P('glass', 'clothes', [9, 18], 'shutter', 'tailor'),
	tattoo: P('glass', 'salon', [12, 22], 'shutter', 'salon'),
	arcade: P('glass', 'arcade', [11, 24], 'lit', null),
	lanes: P('none', 'none', [11, 24], 'lit', null),
	cinema: P('none', 'none', [11, 24], 'lit', null),
	bnb: P('lodging', 'lobby', [0, 24], 'lit', 'bnb', { post: 'host' }),
	motel: P('lodging', 'lobby', [0, 24], 'lit', 'reception'),
	cabins: P('lodging', 'lobby', [7, 21], 'dark', 'reception', { post: 'host' }),
	hotel: P('none', 'lobby', [0, 24], 'lit', null),
	tech: P('none', 'office', [8, 19], 'night', null, { wk: true }),
	law: P('office', 'office', [8.5, 18], 'dark', 'office', { wk: true }),
	design: P('office', 'office', [9, 19], 'dark', 'studio', { wk: true }),
	finance: P('office', 'office', [8.5, 17.5], 'dark', 'office', { wk: true }),
	agency: P('office', 'office', [9, 19], 'dark', 'studio', { wk: true }),
	realtor: P('office', 'office', [9, 18], 'night', 'office'),
	clinic: P('office', 'office', [8, 20], 'night', 'clinic'),
	dental: P('office', 'office', [8, 17], 'dark', 'dental', { wk: true }),
	insurance: P('office', 'office', [9, 17], 'dark', 'office', { wk: true }),
	hospital: P('none', 'none', [0, 24], 'lit', null),
	police: P('none', 'none', [0, 24], 'lit', null),
	firestation: P('none', 'none', [0, 24], 'lit', null),
	armory: P('none', 'none', [8, 18], 'dark', null),
	brewery: P('bays', 'bar', [12, 23], 'dark', 'pub', { seat: 2 }),
	autorepair: P('bays', 'garage', [8, 18], 'dark', 'garage', { post: 'mechanic', wk: true }),
	movers: P('bays', 'workshop', [7, 17], 'dark', null, { wk: true }),
	woodshop: P('bays', 'workshop', [8, 17], 'dark', 'workshop', { post: 'joiner' }),
	boatyard: P('bays', 'boats', [7, 17], 'dark', 'workshop', { post: 'fisher' }),
	roastery: P('bays', 'cafe', [7, 16], 'dark', 'cafe'),
	printshop: P('glass', 'workshop', [8, 18], 'shutter', 'workshop', { wk: true }),
	fishmarket: P('bays', 'deli', [5, 14], 'dark', 'fishmarket', { post: 'fisher' }),
};
const NONE = P('none', 'none', [9, 17], 'dark', null);
export const profileOf = (type) => PROFILES[type] || NONE;

// ---------- the hours ----------
// (a quarter of an hour either way by where it stands, so a street doesn't all open at once)
export function hoursOf(E) {
	const p = profileOf(E.type), [a, b] = p.h;
	if (b - a >= 24) return [0, 24];
	const j = Math.round((hashAt(E.x, E.z, 61) - 0.5) * 2) * 0.25;
	return [a + j, b + Math.round((hashAt(E.x, E.z, 62) - 0.5) * 2) * 0.25];
}
// is an hour within [open, close) (close may be past midnight: 25 is one in the morning)
export function within(h, open, close) {
	if (close - open >= 24) return true;
	const t = ((h % 24) + 24) % 24;
	return close > 24 ? t >= open || t < close - 24 : t >= open && t < close;
}
// how long until an hour comes round, in hours (0 .. 24)
const until = (h, at) => ((((at - h) % 24) + 24) % 24);
// what the front shows at an hour: open, how lit inside (1 open, a little for a night light,
// a while after closing for the clean-up), the shutter (0 up .. 1 down, rolled over twenty
// minutes), the sign lit, and the business's phase
// (out: an object to fill, so a caller looping every frame makes no garbage; E.hours, when the
// caller has kept hoursOf(E) there, is used as it is)
export function stateAt(E, hours, dow = 3, out = {}) {
	const p = profileOf(E.type), hrs = E.hours || hoursOf(E), o = hrs[0], c = hrs[1];
	const weekendShut = p.wk && (dow === 0 || dow === 6);
	const open = !weekendShut && within(hours, o, c);
	const shutterPolicy = p.n === 'shutter' || p.style === 'bays' || (p.n === 'night' && hashAt(E.x, E.z, 63) < 0.35 && (E.setting === 'downtown' || E.setting === 'main'));
	let lit = open ? 1 : 0, shutter = 0, phase = open ? 'open' : 'closed';
	if (!open && !weekendShut) {
		const since = until(c, hours), before = until(hours, o);
		// staff in before opening (half an hour) and clearing up after (forty minutes)
		if (before < 0.5) { lit = 0.7; phase = 'opening'; } else if (since < 0.67) { lit = 0.6; phase = 'closing'; }
	}
	if (!open) {
		if (p.n === 'night') lit = Math.max(lit, 0.18);
		if (p.n === 'lit') lit = Math.max(lit, 0.5);
		if (shutterPolicy) {
			// rolled down over twenty minutes from twenty minutes after closing; up again
			// over the twenty minutes before the last ten before opening
			let s = 1;
			if (!weekendShut) {
				const since = until(c, hours), before = until(hours, o);
				if (since < 0.33) s = 0; else if (since < 0.67) s = (since - 0.33) / 0.34;
				if (before < 0.17) s = 0; else if (before < 0.5) s = Math.min(s, (before - 0.17) / 0.33);
			}
			shutter = s;
		}
	}
	out.open = open; out.lit = lit; out.shutter = Math.max(0, Math.min(1, shutter)); out.sign = open || p.n === 'lit' ? 1 : 0.25; out.phase = phase; out.shutters = shutterPolicy;
	return out;
}

// ---------- the front on the facade ----------
// glazing on a face: w across, from y0 to y1 above the ground at the door (metres), the
// fascia above it to fy; style from the profile. A house gets a shop window under its eaves;
// a shopfront row its glass from the kick plate to the sign band; a big box a wide glazed
// front; a flat block's ground floor a shop in its middle
export function frontSpec(use, run, wallH, style) {
	if (style === 'none' || style === 'home' || !(run > 2.4)) return null;
	const top = Math.max(2.4, wallH || 3);
	if (style === 'lodging') return null;
	if (use === 'house') {
		if (style === 'office') { const w = Math.min(run * 0.42, 3.2); return { w, y0: 0.85, y1: Math.min(2.25, top - 0.55), fascia: Math.min(top - 0.2, 2.75), kind: 'office' }; }
		const y1 = Math.min(2.55, top - 0.75), w = Math.min(run - 1.4, Math.max(3, run * 0.62), style === 'bays' ? 6 : 8.5);
		if (w < 2.2 || y1 < 1.9) return null;
		return { w, y0: style === 'bays' ? 0 : 0.42, y1, fascia: Math.min(top - 0.12, y1 + 0.95), kind: style };
	}
	if (use === 'row' || use === 'shop') return { w: Math.max(2, run - 0.5), y0: 0.45, y1: 3.3, fascia: 4.15, kind: style === 'office' ? 'office' : style, band: true };
	if (use === 'apt') { const w = Math.min(run * 0.55, 9); return w > 2.4 ? { w, y0: 0.45, y1: 3.0, fascia: 3.9, kind: style } : null; }
	if (use === 'retail') { const w = Math.min(run * 0.62, 22); return { w, y0: 0.3, y1: Math.min(3.9, top - 1.4), fascia: Math.min(top - 0.3, 5.6), kind: style, wide: true }; }
	if (use === 'industry') { if (style !== 'bays') return null; const w = Math.min(run * 0.5, 12); return { w, y0: 0, y1: Math.min(4.2, top - 1), fascia: Math.min(top - 0.3, 5.4), kind: 'bays' }; }
	return null;
}
// the fascia board over the glazing: as wide as most of it (a long name on a narrow front
// still legible), about a quarter as high, never taller than there is wall
export function fasciaOf(spec) {
	if (!spec) return null;
	const w = Math.max(1.4, Math.min(spec.w * 0.86, spec.wide ? 9 : 5.2)), room = spec.fascia - spec.y1 - 0.12;
	const h = Math.max(0.36, Math.min(w / 4, room, spec.wide ? 1.6 : 0.95));
	return room < 0.3 ? null : { w: h * 4 < w ? h * 4 : w, h, y: spec.y1 + 0.08 + Math.min(room, h + 0.08) / 2 };
}
// how far out from the facade things may stand, given the gap to the kerb: a front garden
// keeps a path, a pavement keeps 1.8 m clear for walking (an A-frame tucks in by the wall)
export function gapRoom(gap, use) {
	if (!Number.isFinite(gap)) gap = use === 'house' ? 5.5 : 3.2;
	return Math.max(0.7, Math.min(use === 'house' ? 6.5 : 4.5, gap - 1.8));
}

// ---------- the staff out front ----------
// in the face's own frame: along the front from its middle (x), out from the wall (out),
// facing (yaw: 0 to the street, PI back at the building, PI/2 along the front), how they
// stand (pose, sat at h), what they are doing (role)
const POSTS = {
	server: [{ x: 0.35, out: 1.6, yaw: Math.PI * 0.5, pose: 'listen', role: 'server' }],
	baker: [{ x: 0.3, out: 1.0, yaw: 0, pose: 'behind', role: 'baker', break: true }],
	smoker: [{ x: 0.45, out: 0.9, yaw: 0.3, pose: 'phone', role: 'on a break', break: true }],
	pitmaster: [{ x: -0.45, out: 1.3, yaw: Math.PI * 0.5, pose: 'cook', role: 'pitmaster' }],
	clerk: [{ x: -0.3, out: 1.0, yaw: 0.2, pose: 'behind', role: 'shopkeeper' }],
	stocker: [{ x: 0.3, out: 1.2, yaw: Math.PI, pose: 'cook', role: 'stocking up' }],
	fisher: [{ x: 'boat', out: 0, yaw: Math.PI * 0.5, pose: 'push', role: 'fisher' }],
	mechanic: [{ x: 'car', out: 0, yaw: 0, pose: 'cook', sit: 0.32, role: 'mechanic' }],
	joiner: [{ x: 0.2, out: 1.4, yaw: Math.PI, pose: 'cook', role: 'joiner' }],
	host: [{ x: 0.3, out: 1.2, yaw: 0.1, pose: 'rest', role: 'host' }],
};
export function postsFor(E) {
	const p = profileOf(E.type);
	return (POSTS[p.post] || []).map((q) => ({ ...q }));
}

// ---------- the working day ----------
// a worker's shift for the business: in half an hour before it opens (or at eight for the
// all-hours places, some on the late turn), out of the door forty minutes after it shuts
// (never later than ten hours), lunch somewhere in the middle
export function shiftOf(E, seed = 0) {
	const [o, c] = hoursOf(E), u = ((seed >>> 0) % 997) / 997;
	let a = o - 0.5, b = c + 0.67;
	if (c - o >= 24) { a = u < 0.66 ? 7.5 : 15; b = a + 8.5; }
	if (b - a > 10) { if (u < 0.5) b = a + 9; else a = b - 9; }
	const lunch = a + (b - a) * (0.42 + u * 0.16);
	return { start: a, lunch, lunchEnd: lunch + 0.6 + u * 0.3, end: b };
}
// where a worker is in their shift at an hour
export function phaseOf(S, hours) {
	const h = hours < S.start - 4 ? hours + 24 : hours;
	if (h < S.start - 0.6 || h > S.end + 0.6) return 'home';
	if (h < S.start) return 'arriving';
	if (h > S.end) return 'leaving';
	if (h >= S.lunch && h < S.lunchEnd) return 'lunch';
	return 'work';
}
// the town's mix of purposes for the people walking, by the hour: walking in to work in the
// morning, out to lunch at midday, shopping through the day, home in the evening, the
// evening out after dark (each a share of the walkers that take that errand: the rest just walk)
const bump = (h, at, w) => Math.max(0, 1 - Math.abs(h - at) / w);
export function lifeAt(hours, weekend = false) {
	const h = ((hours % 24) + 24) % 24, W = weekend ? 0.35 : 1;
	const commuteIn = W * bump(h, 8.1, 1.4) * 0.55;
	const lunch = bump(h, 12.6, 1.1) * 0.35;
	const commuteOut = W * bump(h, 17.6, 1.5) * 0.5;
	const shop = (h > 9 && h < 20 ? 0.22 : 0.04) * (weekend ? 1.4 : 1);
	const evening = h > 18.5 || h < 1 ? 0.25 : 0;
	return { commuteIn, lunch, commuteOut, shop, evening };
}
// what share of the people walking past an open business stop at its front to work there
// (a cap on how many staff posts are filled at once, by the device)
export const POST_CAP = { phone: 3, desktop: 8 };

// ---------- the sea ----------
// how far the water is from a point: the nearest ring with a sample below the sea, and the
// way to it (unit vector), from rings of eight samples out to 1.6 km; low ground only
// (heights above 30 m are never the waterfront, a cliff top has its own lookout)
export const COAST_RINGS = [60, 120, 200, 320, 480, 700, 1000, 1600];
// (top: ground higher than this is never by the water, as a hilltop a kilometre from the sea is not)
export function coastScan(H, x, z, sea = 0.1, rings = COAST_RINGS, top = 30) {
	const g0 = H(x, z);
	if (!(g0 < top)) return { dist: Infinity, dx: 0, dz: 0, low: false };
	const ring = (k) => {
		let sx = 0, sz = 0, n = 0;
		for (let i = 0; i < 12; i++) {
			const a = i / 12 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
			if (H(x + dx * k, z + dz * k) < sea) { sx += dx; sz += dz; n++; }
		}
		return n ? { n, sx, sz } : null;
	};
	// (inland, the common case: the two widest rings dry and it is done with)
	if (rings.length > 3 && !ring(rings[rings.length - 1]) && !ring(rings[rings.length - 3])) return { dist: Infinity, dx: 0, dz: 0, low: g0 < 15 };
	for (const k of rings) {
		const R = ring(k);
		if (R) { const L = Math.hypot(R.sx, R.sz) || 1; return { dist: k, dx: R.sx / L, dz: R.sz / L, low: g0 < 15, share: R.n / 12 }; }
	}
	return { dist: Infinity, dx: 0, dz: 0, low: g0 < 15 };
}
// a building's place by the water: the waterfront (on the water, the boats and fish there),
// by the harbour (a street or two back), near the coast (the town reaches it); k scales the
// distances (the globe's coast is read more generously, economy/layer.js)
export function coastClass(scan, k = 1) {
	if (!scan || !Number.isFinite(scan.dist)) return 0;
	if (scan.dist <= 200 * k) return 3;
	if (scan.dist <= 480 * k) return 2;
	if (scan.dist <= 1600 * k) return 1;
	return 0;
}
