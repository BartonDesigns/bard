// When a house was built and who lives in it, and so how it looks, outside and in. Every
// house has an era, from where it stands (the city's tracts know theirs; the mapped
// suburbs are read from the valley's history, styles.js eraFor), and a household: the
// paint, the paper, the floors and the kitchen the owners chose or kept. Pure: colours are
// sRGB triples, materials are housekit.js keys (with their pattern slots: 'paper3',
// 'floor5', 'siding1'...), and the same lot always gets the same answer.
//
//   prewar  1900-1940 bungalows, Victorians, Spanish revival: wood siding or shingle, deep
//           trim colours, divided windows; wallpaper, dark-stained or white woodwork, fir
//           and oak floors, hex tile in the bath, checkerboard in the kitchen
//   ranch   1950s-60s: low and long, board-and-batten or stucco, pastel; knotty pine,
//           terrazzo entries, wool carpet, pastel tile and appliances, flush doors
//   split   1970s split-levels: earth tones, shake roofs, dark wood; panelled dens, shag
//           carpet, harvest gold and avocado, geometric papers, Saltillo tile
//   tract   1990s-2000s tracts: beige stucco, concrete tile roofs, white vinyl windows with
//           grids, six-panel doors; travertine and builder beige, oak or cherry cabinets,
//           granite, a Tuscan accent wall
//   modern  2010s-2020s: white board-and-batten farmhouse or charcoal contemporary, black
//           windows, metal roofs; wide grey plank floors, white shaker kitchens, quartz,
//           a navy or grasscloth accent wall
//
// The cities built in their own manner out in the world (crysis/civgen.js look) have looks of
// their own outside, kept in the house as its era; inside they are furnished as the nearest era:
//   east    East Asia's cities: white and grey tile, pale concrete, beige render, now and then a
//           brown tile front; dark grey tile roofs (terracotta in the south-east); aluminium
//   south   South Asia's: whitewash and cream, ochre, salmon, sky blue and mint paint, concrete
//           grey; flat roofs; painted doors, blue, green, maroon
//   arid    the Middle East's and North Africa's: sand, limestone, whitewash, ochre, Marrakech
//           rose, mud brick; flat roofs; blue, green, cedar and turquoise doors

import { eraFor, ERA, STYLE } from './styles.js';

export const ERA_KEYS = ['prewar', 'ranch', 'split', 'tract', 'modern'];
// the looks of the cities out in the world, and the era each is furnished as inside
export const LOOK_ERA = { east: 'modern', south: 'tract', arid: 'tract' };

// a well-mixed hash: a seed and a salt to 0..1
export function roll(seed, salt) {
	let n = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
	n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
	n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
	return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export const seedAt = (x, z) => (Math.imul(Math.round(x * 2) | 0, 73856093) ^ Math.imul(Math.round(z * 2) | 0, 19349663)) >>> 0;
const pick = (l, r) => l[Math.min(l.length - 1, Math.floor(r * l.length))];
const jit = (c, r) => c.map((v, i) => Math.min(1, v * (0.96 + ((r * (3.1 + i * 2.3)) % 1) * 0.08)));

// a gridded tract's era (styles.js ERA, plus a roll) as one of ours
export function cityEra(era, r) {
	if (era === ERA.seventies) return 'split';
	if (era === ERA.modern) return r < 0.3 ? 'modern' : 'tract';
	return 'ranch';
}
// a house's era from where it stands: given (a gridded lot knows its own), an older town's
// (mostly before the war, some postwar infill), or the mapped suburbs' by tract (one builder,
// one decade), with now and then a teardown rebuilt new or an infill lot
export function houseEra(x, z, ctx = {}) {
	if (ctx.era && (ERA_KEYS.includes(ctx.era) || ctx.era in LOOK_ERA)) return ctx.era;
	const lot = roll(seedAt(x, z), 11);
	if (ctx.style === STYLE.older) return lot < 0.64 ? 'prewar' : lot < 0.84 ? 'ranch' : lot < 0.92 ? 'split' : lot < 0.97 ? 'tract' : 'modern';
	const ti = Math.floor((x + 1e6) / 520), tj = Math.floor((z + 1e6) / 400), tr = roll(ti * 7 + 3, tj * 13 + 5);
	if (lot < 0.05) return 'modern';
	return cityEra(eraFor(x, z, tr), roll(ti, tj + 77));
}

// ---------------------------------------------------------------------------------
// outside

// pattern slots: siding (housekit.js SIDING) and door and garage door styles
export const SIDING = { lap: 0, batten: 1, shingle: 2, brick: 3, stone: 4, log: 5, render: 6, mud: 7 };
export const DOOR = { six: 0, five: 1, slab: 2, lites: 3, craftsman: 4, shaker: 5, glass: 6, carved: 7 };
export const GARAGE = { raised: 0, ribbed: 1, carriage: 2, glass: 3 };

const WHITE = [0.94, 0.93, 0.9], CREAM = [0.92, 0.88, 0.78], BLACK = [0.08, 0.08, 0.09], BRONZE = [0.33, 0.28, 0.23];
const EXT = {
	prewar: {
		wall: [[0.62, 0.66, 0.55], [0.9, 0.86, 0.72], [0.52, 0.6, 0.66], [0.58, 0.3, 0.25], [0.92, 0.84, 0.58], [0.93, 0.92, 0.88], [0.5, 0.5, 0.38], [0.78, 0.6, 0.56], [0.48, 0.36, 0.26], [0.66, 0.66, 0.62]],
		trim: [WHITE, CREAM, WHITE, [0.2, 0.3, 0.24], [0.4, 0.14, 0.12], [0.3, 0.22, 0.16]],
		roof: [[0.25, 0.25, 0.26], [0.35, 0.31, 0.27], [0.3, 0.32, 0.3], [0.4, 0.36, 0.33]],
		door: [[0.36, 0.22, 0.13], [0.42, 0.12, 0.1], [0.14, 0.24, 0.18], [0.28, 0.18, 0.11], [0.12, 0.16, 0.26]],
	},
	ranch: {
		wall: [[0.93, 0.92, 0.86], [0.86, 0.84, 0.66], [0.72, 0.8, 0.74], [0.7, 0.78, 0.84], [0.82, 0.74, 0.62], [0.64, 0.6, 0.52], [0.9, 0.86, 0.78], [0.76, 0.62, 0.52], [0.84, 0.72, 0.7]],
		trim: [WHITE, WHITE, [0.55, 0.4, 0.26], CREAM],
		roof: [[0.3, 0.3, 0.31], [0.4, 0.37, 0.34], [0.62, 0.6, 0.56], [0.26, 0.25, 0.26]],
		door: [[0.2, 0.62, 0.62], [0.9, 0.5, 0.18], [0.92, 0.78, 0.25], [0.7, 0.16, 0.14], [0.45, 0.3, 0.18], [0.9, 0.9, 0.86]],
	},
	split: {
		wall: [[0.55, 0.44, 0.32], [0.72, 0.64, 0.5], [0.5, 0.52, 0.4], [0.66, 0.5, 0.36], [0.82, 0.76, 0.64], [0.6, 0.56, 0.5], [0.46, 0.38, 0.3]],
		trim: [[0.3, 0.22, 0.16], [0.82, 0.76, 0.64], [0.36, 0.3, 0.22], CREAM],
		roof: [[0.42, 0.38, 0.32], [0.36, 0.33, 0.3], [0.48, 0.43, 0.36]],
		door: [[0.3, 0.19, 0.11], [0.22, 0.15, 0.1], [0.55, 0.3, 0.12], [0.4, 0.42, 0.2]],
	},
	tract: {
		wall: [[0.91, 0.86, 0.77], [0.85, 0.78, 0.65], [0.94, 0.91, 0.85], [0.79, 0.76, 0.68], [0.8, 0.73, 0.6], [0.72, 0.7, 0.6], [0.89, 0.83, 0.72], [0.84, 0.71, 0.6], [0.88, 0.8, 0.7]],
		trim: [WHITE, CREAM, [0.86, 0.82, 0.74]],
		roof: [[0.62, 0.32, 0.22], [0.7, 0.4, 0.27], [0.55, 0.3, 0.24], [0.66, 0.46, 0.34], [0.42, 0.4, 0.38], [0.5, 0.46, 0.42], [0.35, 0.33, 0.32]],
		door: [[0.45, 0.27, 0.15], [0.3, 0.18, 0.11], [0.9, 0.88, 0.84], [0.42, 0.12, 0.1], [0.2, 0.24, 0.2]],
	},
	modern: {
		wall: [[0.95, 0.95, 0.93], [0.95, 0.95, 0.93], [0.25, 0.26, 0.27], [0.75, 0.73, 0.69], [0.2, 0.25, 0.33], [0.62, 0.65, 0.6], [0.86, 0.86, 0.84]],
		trim: [BLACK, BLACK, WHITE, [0.2, 0.2, 0.21]],
		roof: [[0.18, 0.18, 0.19], [0.22, 0.22, 0.23], [0.3, 0.3, 0.31]],
		door: [BLACK, [0.5, 0.34, 0.2], [0.18, 0.3, 0.3], [0.6, 0.42, 0.26], [0.85, 0.66, 0.2]],
	},
	east: {
		wall: [[0.9, 0.89, 0.86], [0.92, 0.91, 0.88], [0.78, 0.78, 0.76], [0.84, 0.79, 0.7], [0.72, 0.75, 0.78], [0.62, 0.62, 0.61], [0.55, 0.44, 0.36], [0.88, 0.8, 0.76], [0.74, 0.77, 0.72], [0.93, 0.89, 0.8]],
		trim: [WHITE, [0.6, 0.61, 0.62], [0.2, 0.2, 0.22], [0.82, 0.82, 0.8]],
		roof: [[0.22, 0.24, 0.27], [0.3, 0.33, 0.38], [0.2, 0.18, 0.17], [0.62, 0.33, 0.21]],
		door: [[0.3, 0.22, 0.15], [0.55, 0.56, 0.57], [0.1, 0.1, 0.11], [0.9, 0.9, 0.88]],
	},
	south: {
		wall: [[0.93, 0.88, 0.75], [0.95, 0.94, 0.9], [0.9, 0.75, 0.42], [0.9, 0.66, 0.58], [0.62, 0.76, 0.86], [0.7, 0.86, 0.76], [0.75, 0.45, 0.32], [0.78, 0.72, 0.86], [0.68, 0.66, 0.62], [0.76, 0.84, 0.5]],
		trim: [WHITE, [0.86, 0.85, 0.8], [0.2, 0.36, 0.26]],
		roof: [[0.6, 0.58, 0.55], [0.5, 0.48, 0.45], [0.62, 0.34, 0.24]],
		door: [[0.18, 0.36, 0.62], [0.2, 0.5, 0.34], [0.4, 0.26, 0.16], [0.5, 0.14, 0.14]],
	},
	arid: {
		wall: [[0.87, 0.78, 0.6], [0.86, 0.82, 0.72], [0.95, 0.94, 0.9], [0.82, 0.65, 0.42], [0.8, 0.5, 0.4], [0.9, 0.86, 0.76], [0.72, 0.58, 0.42], [0.8, 0.79, 0.75]],
		trim: [WHITE, [0.9, 0.84, 0.7], [0.7, 0.62, 0.5]],
		roof: [[0.8, 0.74, 0.62], [0.7, 0.66, 0.6], [0.66, 0.38, 0.26]],
		door: [[0.16, 0.34, 0.6], [0.18, 0.44, 0.34], [0.45, 0.3, 0.18], [0.2, 0.55, 0.58]],
	},
};
// a house's outside: walls, roof (colour and covering, roofs.js ROOF), trim, windows, doors
export function exteriorLook(era, seed) {
	const E = EXT[era] || EXT.tract, r = (k) => roll(seed, k);
	const L = { era, wall: jit(pick(E.wall, r(1)), r(2)), roof: pick(E.roof, r(3)), trim: pick(E.trim, r(4)), door: pick(E.door, r(5)), roofTrim: 0, grilles: false, siding: null, surround: 'trim' };
	if (era === 'prewar') {
		// clapboard or shingle; now and then a stucco Spanish revival under clay tile
		const s = r(6);
		L.siding = s < 0.55 ? SIDING.lap : s < 0.8 ? SIDING.shingle : s < 0.88 ? SIDING.brick : null;
		if (L.siding === null) { L.roof = pick(EXT.tract.roof.slice(0, 4), r(7)); L.roofT = 1; L.surround = 'stucco'; L.wall = jit(pick([[0.93, 0.89, 0.8], [0.95, 0.93, 0.88], [0.9, 0.82, 0.68]], r(8)), r(2)); }
		else L.roofT = 0;
		if (L.siding === SIDING.brick) L.wall = jit(pick([[0.62, 0.34, 0.27], [0.55, 0.32, 0.26], [0.7, 0.45, 0.36]], r(8)), r(2));
		L.grilles = true; L.frame = L.trim; L.doorStyle = r(9) < 0.6 ? DOOR.craftsman : DOOR.five; L.garageStyle = GARAGE.carriage;
		L.garage = r(10) < 0.5 ? L.trim : L.wall;
		L.roofTrim = 3;
	} else if (era === 'ranch') {
		L.siding = r(6) < 0.45 ? SIDING.batten : r(6) < 0.6 ? SIDING.brick : null;
		if (L.siding === SIDING.brick) L.wall = jit(pick([[0.66, 0.42, 0.34], [0.72, 0.6, 0.5]], r(8)), r(2));
		L.roofT = r(7) < 0.25 ? 5 : 0; L.grilles = false; L.frame = [0.7, 0.71, 0.72];
		L.doorStyle = r(9) < 0.6 ? DOOR.lites : DOOR.slab; L.garageStyle = GARAGE.ribbed; L.garage = r(10) < 0.5 ? L.trim : [0.58, 0.42, 0.28];
	} else if (era === 'split') {
		L.siding = r(6) < 0.5 ? SIDING.batten : r(6) < 0.75 ? SIDING.shingle : null;
		L.roofT = 4; L.frame = BRONZE; L.doorStyle = DOOR.carved; L.garageStyle = r(10) < 0.5 ? GARAGE.carriage : GARAGE.ribbed; L.garage = r(11) < 0.6 ? [0.42, 0.3, 0.2] : L.trim;
	} else if (era in LOOK_ERA) {
		// rendered and painted, plain surrounds, metal-framed windows; East Asia's houses under
		// glazed tile (barrel tile in the south-east), the others' roofs flat
		L.surround = era === 'east' ? 'none' : 'stucco'; L.grilles = false; L.frame = era === 'east' ? [0.6, 0.61, 0.62] : L.trim;
		L.roofT = era === 'east' ? (L.roof[0] > L.roof[2] * 1.4 ? 1 : 2) : 5;
		L.doorStyle = era === 'east' ? DOOR.slab : DOOR.carved; L.garageStyle = GARAGE.ribbed; L.garage = L.trim;
	} else if (era === 'tract') {
		L.roofT = L.roof[0] > L.roof[2] * 1.4 ? 1 : 2; L.surround = 'stucco'; L.grilles = r(6) < 0.7; L.frame = r(7) < 0.8 ? WHITE : [0.86, 0.82, 0.72];
		L.doorStyle = DOOR.six; L.garageStyle = GARAGE.raised; L.garage = r(10) < 0.6 ? [0.93, 0.92, 0.88] : [0.86, 0.82, 0.72]; L.roofTrim = r(8) < 0.5 ? 0 : 3;
	} else {
		// the farmhouse (white board-and-batten, black windows, a metal roof) or the
		// contemporary (stucco and dark panels, flat glass garage)
		const farm = r(6) < 0.55;
		L.siding = farm ? SIDING.batten : r(7) < 0.4 ? SIDING.lap : null;
		if (farm) L.wall = jit(pick([[0.95, 0.95, 0.93], [0.93, 0.93, 0.91], [0.25, 0.26, 0.27]], r(1)), r(2));
		L.roofT = r(8) < 0.45 ? 3 : 0; L.frame = BLACK; L.grilles = farm && r(9) < 0.4; L.surround = farm ? 'trim' : 'none';
		L.doorStyle = farm ? DOOR.shaker : DOOR.glass; L.garageStyle = farm ? GARAGE.carriage : GARAGE.glass;
		L.garage = farm ? (r(10) < 0.5 ? [0.55, 0.38, 0.24] : L.trim) : [0.3, 0.31, 0.32];
	}
	return L;
}

// ---------------------------------------------------------------------------------
// inside

// the wall papers and panelling (housekit.js PAPER slots) and the patterned floors (FLOORS)
export const PAPER = { stripe: 0, floral: 1, damask: 2, geometric: 3, grasscloth: 4, panel: 5, beadboard: 6, ticking: 7 };
export const FLOORP = { checker: 0, terrazzo: 1, hex: 2, parquet: 3, large: 4, plank: 5, saltillo: 6, travertine: 7 };

const PAINT = {
	prewar: [[0.66, 0.7, 0.58], [0.93, 0.86, 0.66], [0.84, 0.7, 0.66], [0.68, 0.74, 0.76], [0.93, 0.9, 0.82], [0.8, 0.62, 0.48], [0.74, 0.76, 0.66], [0.9, 0.86, 0.78]],
	ranch: [[0.78, 0.88, 0.8], [0.95, 0.9, 0.68], [0.76, 0.86, 0.92], [0.94, 0.82, 0.82], [0.92, 0.89, 0.82], [0.9, 0.9, 0.86], [0.86, 0.9, 0.78]],
	split: [[0.9, 0.82, 0.62], [0.78, 0.76, 0.56], [0.92, 0.88, 0.78], [0.86, 0.72, 0.56], [0.88, 0.84, 0.74], [0.8, 0.74, 0.6]],
	tract: [[0.92, 0.89, 0.82], [0.9, 0.86, 0.78], [0.88, 0.85, 0.79], [0.93, 0.9, 0.84], [0.86, 0.82, 0.74], [0.9, 0.88, 0.84]],
	modern: [[0.95, 0.95, 0.94], [0.93, 0.93, 0.92], [0.88, 0.87, 0.85], [0.84, 0.84, 0.83], [0.94, 0.93, 0.9], [0.9, 0.9, 0.89]],
};
const ACCENT = {
	prewar: [[0.32, 0.42, 0.36], [0.5, 0.22, 0.2], [0.24, 0.3, 0.42]],
	ranch: [[0.3, 0.6, 0.6], [0.9, 0.6, 0.3], [0.86, 0.76, 0.4]],
	split: [[0.75, 0.42, 0.18], [0.45, 0.48, 0.22], [0.55, 0.36, 0.2], [0.8, 0.62, 0.22]],
	tract: [[0.72, 0.46, 0.32], [0.55, 0.58, 0.44], [0.55, 0.22, 0.2], [0.8, 0.64, 0.38], [0.62, 0.54, 0.42]],
	modern: [[0.16, 0.22, 0.33], [0.24, 0.25, 0.26], [0.5, 0.56, 0.5], [0.1, 0.1, 0.11], [0.62, 0.5, 0.42], [0.26, 0.36, 0.34]],
};
const KIDS = [[0.74, 0.84, 0.9], [0.8, 0.88, 0.76], [0.93, 0.82, 0.84], [0.84, 0.8, 0.9], [0.95, 0.9, 0.72]];
const OAK = [[0.78, 0.6, 0.42], [0.66, 0.48, 0.32]], FIR = [[0.7, 0.46, 0.28], [0.56, 0.36, 0.22]], DARK = [[0.42, 0.28, 0.18], [0.36, 0.24, 0.16]];
const WET = new Set(['bath', 'mbath', 'powder', 'laundry']);
const SOFT = new Set(['bed', 'master', 'loft', 'closet']);
const PUBLIC = new Set(['living', 'family', 'dining', 'office', 'hall']);

// a household's insides: era, then the owners' tastes (the same lot, the same rooms)
export function householdDecor(era, seed) {
	if (era in LOOK_ERA) era = LOOK_ERA[era];
	if (!ERA_KEYS.includes(era)) era = 'tract';
	const r = (k) => roll(seed, 100 + k);
	// some households redid the place since: a newer kitchen and paint over the old bones
	const redone = era !== 'modern' && r(1) < (era === 'prewar' ? 0.25 : era === 'tract' ? 0.18 : 0.25);
	const paints = PAINT[redone && r(2) < 0.5 ? 'modern' : era], accents = ACCENT[era];
	const D = { era, redone, seed };
	// the woodwork: stained in the old houses (often), the split-levels; painted white since
	const stained = era === 'split' ? r(3) < 0.75 : era === 'prewar' ? r(3) < 0.45 && !redone : era === 'ranch' ? r(3) < 0.35 : false;
	D.trim = stained ? pick(era === 'ranch' ? [[0.66, 0.48, 0.3], [0.58, 0.4, 0.24]] : DARK, r(4)) : era === 'modern' && r(4) < 0.12 ? [0.15, 0.15, 0.16] : [0.95, 0.94, 0.91];
	D.trimKey = stained ? 'grain' : 'trim';
	D.base = { prewar: 0.19, ranch: 0.07, split: 0.07, tract: 0.09, modern: 0.13 }[era];
	D.rail = era === 'prewar' && r(5) < 0.7;
	D.door = { slot: { prewar: DOOR.five, ranch: DOOR.slab, split: DOOR.slab, tract: DOOR.six, modern: DOOR.shaker }[era], col: stained ? D.trim : era === 'modern' && r(6) < 0.2 ? [0.12, 0.12, 0.13] : [0.94, 0.93, 0.9] };
	// the floors' woods and carpets
	D.wood = jit(pick({ prewar: [...FIR, ...DARK], ranch: OAK, split: [...OAK, ...DARK], tract: [[0.8, 0.6, 0.38], [0.48, 0.28, 0.18], [0.74, 0.54, 0.34]], modern: [[0.72, 0.66, 0.58], [0.82, 0.74, 0.6], [0.6, 0.56, 0.52]] }[era], r(7)), r(8));
	D.carpet = pick({ prewar: [[0.6, 0.3, 0.26], [0.7, 0.66, 0.58]], ranch: [[0.76, 0.72, 0.62], [0.62, 0.68, 0.58], [0.78, 0.64, 0.62], [0.6, 0.66, 0.72]], split: [[0.78, 0.6, 0.22], [0.46, 0.5, 0.22], [0.66, 0.36, 0.16], [0.46, 0.34, 0.24], [0.72, 0.62, 0.46]], tract: [[0.8, 0.75, 0.66], [0.74, 0.7, 0.62], [0.68, 0.64, 0.58]], modern: [[0.6, 0.6, 0.6], [0.7, 0.68, 0.66], [0.5, 0.52, 0.54]] }[era], r(9));
	D.plank = pick([[0.66, 0.64, 0.6], [0.78, 0.74, 0.68], [0.56, 0.5, 0.44], [0.84, 0.8, 0.74]], r(10));
	const kitchenFloor = {
		prewar: r(11) < 0.55 ? { key: 'floor' + FLOORP.checker, col: pick([[0.95, 0.94, 0.9], [0.92, 0.88, 0.8]], r(12)) } : { key: 'floor' + FLOORP.hex, col: [0.94, 0.93, 0.9] },
		ranch: r(11) < 0.5 ? { key: 'floor' + FLOORP.checker, col: pick([[0.95, 0.92, 0.85], [0.9, 0.94, 0.9], [0.95, 0.85, 0.8]], r(12)) } : { key: 'floor' + FLOORP.terrazzo, col: pick([[0.88, 0.86, 0.8], [0.86, 0.82, 0.8]], r(12)) },
		split: r(11) < 0.5 ? { key: 'floor' + FLOORP.saltillo, col: [0.84, 0.52, 0.34] } : { key: 'floor' + FLOORP.large, col: pick([[0.86, 0.72, 0.4], [0.72, 0.6, 0.42]], r(12)) },
		tract: r(11) < 0.55 ? { key: 'floor' + FLOORP.travertine, col: pick([[0.9, 0.84, 0.74], [0.86, 0.8, 0.7]], r(12)) } : { key: 'floor' + FLOORP.large, col: pick([[0.9, 0.86, 0.78], [0.84, 0.8, 0.72]], r(12)) },
		modern: r(11) < 0.7 ? { key: 'floor' + FLOORP.plank, col: D.plank } : { key: 'floor' + FLOORP.large, col: pick([[0.86, 0.86, 0.85], [0.6, 0.6, 0.6]], r(12)) },
	}[era];
	const bathFloor = {
		prewar: { key: 'floor' + FLOORP.hex, col: [0.95, 0.95, 0.93] },
		ranch: { key: 'floor' + FLOORP.hex, col: pick([[0.92, 0.76, 0.78], [0.72, 0.86, 0.8], [0.74, 0.82, 0.9], [0.92, 0.9, 0.8]], r(13)) },
		split: { key: 'floor' + FLOORP.large, col: pick([[0.84, 0.74, 0.5], [0.66, 0.6, 0.42], [0.86, 0.84, 0.78]], r(13)) },
		tract: { key: 'floor' + FLOORP.travertine, col: [0.9, 0.85, 0.76] },
		modern: { key: 'floor' + FLOORP.large, col: pick([[0.9, 0.9, 0.89], [0.55, 0.56, 0.57], [0.82, 0.8, 0.76]], r(13)) },
	}[era];
	const entryFloor = era === 'ranch' ? { key: 'floor' + FLOORP.terrazzo, col: [0.88, 0.86, 0.82] } : era === 'split' ? { key: 'floor' + FLOORP.saltillo, col: [0.84, 0.52, 0.34] } : era === 'prewar' ? null : kitchenFloor;
	// carpet over the old wood (the postwar houses), or the wood bare
	const carpeted = era === 'split' ? r(14) < 0.85 : era === 'ranch' ? r(14) < 0.6 : era === 'tract' ? r(14) < 0.5 : era === 'prewar' ? r(14) < 0.12 : r(14) < 0.15;
	const lvp = era === 'modern' ? r(15) < 0.7 : redone && r(15) < 0.5;
	D.floor = (type, level) => {
		if (type === 'garage') return { key: 'concrete', col: [0.72, 0.71, 0.68] };
		if (type === 'kitchen' || type === 'laundry') return kitchenFloor;
		if (WET.has(type)) return bathFloor;
		if (type === 'entry') return entryFloor || { key: 'wood', col: D.wood };
		if (SOFT.has(type) || (level === 1 && type === 'hall')) return carpeted || era === 'tract' || (era === 'modern' && r(16) < 0.5) ? { key: 'carpet', col: D.carpet } : lvp ? { key: 'floor' + FLOORP.plank, col: D.plank } : { key: 'wood', col: D.wood };
		if (lvp) return { key: 'floor' + FLOORP.plank, col: D.plank };
		if (era === 'prewar' && type === 'dining' && r(17) < 0.4) return { key: 'floor' + FLOORP.parquet, col: D.wood };
		if (carpeted && (type === 'living' || (type === 'family' && era !== 'tract'))) return { key: 'carpet', col: D.carpet };
		return { key: 'wood', col: D.wood };
	};
	// the walls: paint, paper, panelling; one accent wall in some rooms
	const paperP = { prewar: 0.5, ranch: 0.3, split: 0.35, tract: 0.08, modern: 0.04 }[era] * (redone ? 0.3 : 1);
	const papers = {
		prewar: [PAPER.damask, PAPER.floral, PAPER.stripe, PAPER.floral, PAPER.ticking],
		ranch: [PAPER.geometric, PAPER.floral, PAPER.stripe, PAPER.ticking],
		split: [PAPER.geometric, PAPER.floral, PAPER.geometric, PAPER.grasscloth],
		tract: [PAPER.floral, PAPER.stripe, PAPER.damask],
		modern: [PAPER.geometric, PAPER.grasscloth],
	}[era];
	const paperRoom = (type) => (type === 'dining' || type === 'bed' || type === 'master' || WET.has(type) || (type === 'kitchen' && era !== 'prewar') || type === 'hall' || type === 'entry' ? 1 : type === 'living' ? 0.5 : 0.2);
	const kidRoom = (id) => r(200 + id) < 0.6;
	D.wall = (type, id) => {
		const q = (k) => r(300 + id * 17 + k);
		if (type === 'garage') return { key: 'paint', col: [0.82, 0.8, 0.76] };
		// the panelled den: knotty pine in the fifties, dark walnut sheets in the seventies
		if ((type === 'family' || type === 'office') && ((era === 'split' && q(1) < 0.6) || (era === 'ranch' && q(1) < 0.3)) && !redone) return { key: 'paper' + PAPER.panel, col: era === 'split' ? pick([[0.46, 0.3, 0.18], [0.56, 0.38, 0.22]], q(2)) : [0.82, 0.62, 0.38] };
		if (q(3) < paperP * paperRoom(type)) {
			const k = pick(papers, q(4));
			return { key: 'paper' + k, col: pick([...paints, ...accents.slice(0, 1)], q(5)), paper: true };
		}
		if (type === 'bed' && kidRoom(id)) return { key: 'paint', col: pick(KIDS, q(6)) };
		if (WET.has(type) && era === 'ranch' && q(7) < 0.5) return { key: 'paint', col: pick([[0.94, 0.84, 0.86], [0.82, 0.92, 0.86], [0.84, 0.9, 0.95]], q(8)) };
		return { key: 'paint', col: pick(paints, q(9) < 0.6 ? r(20) : q(10)) };
	};
	const accentP = { prewar: 0.05, ranch: 0.12, split: 0.2, tract: 0.4, modern: 0.45 }[era];
	D.accent = (type, id) => {
		const q = (k) => r(500 + id * 13 + k);
		if (!(PUBLIC.has(type) || type === 'master' || type === 'bed' || type === 'powder') || q(1) >= accentP) return null;
		if ((era === 'modern' || era === 'tract') && q(2) < 0.3) return { key: 'paper' + (era === 'modern' ? pick([PAPER.grasscloth, PAPER.geometric, PAPER.beadboard], q(3)) : PAPER.damask), col: pick(era === 'modern' ? [[0.84, 0.8, 0.72], [0.3, 0.34, 0.4], [0.94, 0.94, 0.92]] : accents, q(4)), paper: true };
		return { key: 'paint', col: pick(accents, q(5)) };
	};
	// the kitchen (as built, or redone)
	const ke = redone && r(32) < 0.6 ? 'modern' : era;
	const cab = {
		prewar: { col: pick([[0.94, 0.93, 0.88], [0.86, 0.9, 0.82], [0.92, 0.88, 0.76]], r(30)), key: 'trim', style: 'shaker' },
		ranch: r(31) < 0.5 ? { col: [0.78, 0.6, 0.4], key: 'grain', style: 'slab' } : { col: pick([[0.94, 0.9, 0.7], [0.66, 0.84, 0.8], [0.94, 0.93, 0.9]], r(30)), key: 'trim', style: 'slab' },
		split: { col: pick([[0.36, 0.24, 0.15], [0.46, 0.32, 0.2]], r(30)), key: 'grain', style: 'raised' },
		tract: r(31) < 0.5 ? { col: [0.74, 0.54, 0.32], key: 'grain', style: 'raised' } : { col: pick([[0.36, 0.2, 0.13], [0.24, 0.16, 0.12]], r(30)), key: 'grain', style: 'raised' },
		modern: { col: pick([[0.95, 0.95, 0.93], [0.95, 0.95, 0.93], [0.2, 0.26, 0.36], [0.56, 0.62, 0.56], [0.5, 0.36, 0.24]], r(30)), key: 'trim', style: 'shaker' },
	}[ke];
	D.cab = cab;
	D.top = { prewar: [0.94, 0.94, 0.92], ranch: pick([[0.9, 0.84, 0.72], [0.85, 0.9, 0.86], [0.92, 0.82, 0.8]], r(33)), split: pick([[0.8, 0.6, 0.24], [0.52, 0.38, 0.24]], r(33)), tract: pick([[0.32, 0.29, 0.26], [0.55, 0.45, 0.36], [0.22, 0.22, 0.23]], r(33)), modern: [0.95, 0.95, 0.94] }[ke];
	D.splash = { prewar: [0.96, 0.95, 0.92], ranch: pick([[0.94, 0.82, 0.84], [0.82, 0.92, 0.86], [0.95, 0.92, 0.75]], r(34)), split: pick([[0.78, 0.56, 0.22], [0.56, 0.42, 0.26]], r(34)), tract: [0.88, 0.82, 0.7], modern: [0.96, 0.96, 0.95] }[ke];
	D.island = ke === 'modern' ? pick([[0.2, 0.26, 0.36], [0.3, 0.32, 0.34], [0.5, 0.36, 0.24], [0.95, 0.95, 0.93]], r(35)) : cab.col.map((c) => c * 0.92);
	// the appliances: enamel in the old colours, then white, then steel
	D.app = { ranch: r(36) < 0.55 ? pick([[0.55, 0.78, 0.75], [0.9, 0.72, 0.74], [0.93, 0.86, 0.55], [0.94, 0.94, 0.92]], r(37)) : null, split: r(36) < 0.7 ? pick([[0.8, 0.62, 0.22], [0.45, 0.48, 0.22], [0.5, 0.32, 0.2]], r(37)) : null, tract: r(36) < 0.4 ? pick([[0.94, 0.94, 0.92], [0.06, 0.06, 0.07]], r(37)) : null }[ke] || null;
	// the lights: a fan where the era put one, a schoolhouse pendant, a fluorescent box
	D.fixture = (type, kind) => {
		if (kind === 'bar' || kind === 'pendants' || (kind === 'pendant' && type !== 'living')) return kind;
		if (era === 'split' && type === 'kitchen') return 'tube';
		if ((era === 'split' || era === 'tract') && (SOFT.has(type) || type === 'family')) return r(400 + type.length) < 0.7 ? 'fan' : kind;
		if (era === 'prewar' && (type === 'living' || type === 'dining')) return 'chandelier';
		if (era === 'prewar' && (type === 'kitchen' || type === 'hall')) return 'pendant';
		if (era === 'modern' && kind === 'fan') return r(41) < 0.4 ? 'fan' : 'flush';
		return kind;
	};
	D.fanWood = era === 'modern' ? [0.12, 0.12, 0.13] : era === 'split' ? [0.4, 0.28, 0.18] : [0.62, 0.48, 0.32];
	D.curtains = { prewar: [[0.6, 0.24, 0.2], [0.82, 0.76, 0.6], [0.36, 0.42, 0.32]], ranch: [[0.86, 0.8, 0.6], [0.6, 0.72, 0.7], [0.9, 0.74, 0.66]], split: [[0.72, 0.5, 0.2], [0.5, 0.42, 0.22], [0.6, 0.36, 0.2]], tract: [[0.85, 0.82, 0.74], [0.62, 0.5, 0.4], [0.5, 0.2, 0.18]], modern: [[0.9, 0.9, 0.88], [0.6, 0.62, 0.64], [0.3, 0.32, 0.34]] }[era];
	return D;
}

// ---------------------------------------------------------------------------------
// offices and shops: a company's fit-out, so two floors never look the same

const OFFICE_WALL = [[0.94, 0.94, 0.92], [0.92, 0.9, 0.86], [0.88, 0.89, 0.88], [0.9, 0.88, 0.84], [0.95, 0.95, 0.95]];
const BRAND = [[0.84, 0.3, 0.2], [0.16, 0.4, 0.72], [0.14, 0.52, 0.46], [0.92, 0.7, 0.2], [0.42, 0.26, 0.56], [0.16, 0.2, 0.3], [0.62, 0.72, 0.3], [0.86, 0.42, 0.5], [0.2, 0.6, 0.78], [0.3, 0.32, 0.34]];
const CARPET = [[0.34, 0.35, 0.38], [0.42, 0.4, 0.38], [0.26, 0.3, 0.36], [0.5, 0.48, 0.44], [0.3, 0.34, 0.3], [0.4, 0.34, 0.32], [0.56, 0.56, 0.56], [0.22, 0.24, 0.28]];
const DESK = [[0.95, 0.94, 0.9], [0.76, 0.6, 0.42], [0.62, 0.48, 0.34], [0.86, 0.86, 0.85], [0.2, 0.2, 0.21], [0.88, 0.82, 0.7]];
const SEAT = [[0.36, 0.42, 0.46], [0.2, 0.2, 0.22], [0.5, 0.3, 0.24], [0.26, 0.38, 0.32], [0.6, 0.58, 0.54], [0.24, 0.3, 0.46], [0.66, 0.42, 0.2]];
// a floor's scheme from its building's key and its number (a company may take a few floors)
export function officeScheme(key, floor) {
	let h = 7;
	for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
	const company = Math.floor((floor + roll(h, 1) * 3) / 3);
	const s = (h ^ Math.imul(company + 1, 2654435761)) >>> 0, f = (h ^ Math.imul(floor + 101, 2246822519)) >>> 0, r = (k) => roll(s, k);
	return {
		company,
		wall: pick(OFFICE_WALL, r(1)),
		// (the company's colour, or on some of its floors its second one)
		brand: pick(BRAND, roll(f, 3) < 0.65 ? r(2) : r(12)),
		accentWall: r(3) < 0.75,
		carpet: pick(CARPET, r(4)),
		carpetTile: r(5) < 0.7,
		desk: pick(DESK, r(6)),
		seat: pick(SEAT, r(7)),
		sofa: pick(SEAT, r(8)),
		ceiling: r(9) < 0.3 ? 'open' : r(9) < 0.65 ? 'grid' : 'plaster',
		lights: roll(f, 2) < 0.5 ? 'panels' : 'strips',
		wood: pick([[0.69, 0.54, 0.37], [0.52, 0.36, 0.24], [0.82, 0.7, 0.54], [0.36, 0.26, 0.2]], r(11)),
		// within the company the floors still differ a little
		shade: 0.92 + ((floor * 7) % 11) * 0.015,
	};
}

// a shop's, café's or small office's insides, by what it is and who runs it
const SHOP_WALL = {
	cafe: [[0.78, 0.46, 0.34], [0.62, 0.68, 0.56], [0.93, 0.89, 0.8], [0.26, 0.28, 0.3], [0.86, 0.68, 0.36], [0.94, 0.94, 0.92]],
	restaurant: [[0.5, 0.14, 0.12], [0.18, 0.3, 0.24], [0.18, 0.22, 0.32], [0.92, 0.88, 0.8], [0.62, 0.32, 0.24], [0.3, 0.26, 0.24]],
	shop: [[0.95, 0.95, 0.94], [0.9, 0.9, 0.9], [0.92, 0.9, 0.86], [0.86, 0.88, 0.9]],
	office: OFFICE_WALL,
	dark: [[0.14, 0.14, 0.16], [0.2, 0.16, 0.24], [0.12, 0.16, 0.2], [0.3, 0.12, 0.14]],
};
const SHOP_WOOD = [[0.55, 0.38, 0.24], [0.7, 0.52, 0.34], [0.4, 0.28, 0.2], [0.62, 0.56, 0.5]], SHOP_TILE = [[0.79, 0.77, 0.73], [0.9, 0.88, 0.84], [0.5, 0.5, 0.5], [0.72, 0.62, 0.52]];
export function shopScheme(type, seed) {
	const r = (k) => roll(seed, 900 + k), walls = SHOP_WALL[type] || (type === 'shop' ? SHOP_WALL.shop : SHOP_WALL.dark);
	return { wall: pick(walls, r(1)), accent: r(2) < 0.6 ? pick(BRAND, r(3)) : null, wood: pick(SHOP_WOOD, r(4)), tile: pick(SHOP_TILE, r(5)), carpet: pick(CARPET, r(6)), desk: pick(DESK, r(7)), seat: pick(SEAT, r(8)) };
}
