// When a street was laid out, and so how it looks: its trees, its sidewalk, its kerb, its
// lamps and how far its asphalt has gone. Every neighbourhood gets an era:
//   historic  a town's old core, before the First World War: brick sidewalks, London planes
//             and ginkgos in tree wells with iron grates, granite kerbs, acorn lamps on posts
//   prewar    the streetcar suburbs, 1900-1945: big mature sycamores, planes, elms and oaks
//             in the parkway strip, old scored concrete heaved and lifted by their roots,
//             tall square kerbs worn round, cobra-head lamps
//   postwar   the ranch and split-level tracts, 1946-1975: middling trees of all sorts
//             (maples, pears, crape myrtles, a few palms), scored concrete, square kerbs
//   tract     the 1980s-2000s tracts: younger, tidier trees, clean concrete, rolled kerbs
//   new       the newest subdivisions: young trees on stakes in a regular row, new concrete
//             and slim LED lamps
// From the buildings' own start dates where the map has them; otherwise a guess from the
// houses' era where it stands (decor.js), how close a dense old core is, and the street
// pattern (a regular grid reads older, cul-de-sacs and curves newer). Pure but for the
// runtime map at the end, which reads the loaded regions; the same street always gets the
// same answer.

import { houseEra, roll } from './decor.js';
import { toLatLon } from './geo.js';

export const ERAS = ['historic', 'prewar', 'postwar', 'tract', 'new'];
export const ERA_INDEX = Object.freeze(Object.fromEntries(ERAS.map((k, i) => [k, i])));
// how old and worn a street of each era is, 0 new .. 1 old
export const ERA_AGE = Object.freeze({ historic: 1, prewar: 0.85, postwar: 0.6, tract: 0.35, new: 0.1 });

// the era a year of building belongs to (a dense core before 1912 is the historic one)
export function eraOfYear(year, dense = false) {
	if (!Number.isFinite(year)) return null;
	if (year < 1912) return dense ? 'historic' : 'prewar';
	if (year < 1946) return 'prewar';
	if (year < 1976) return 'postwar';
	if (year < 2006) return 'tract';
	return 'new';
}
// a year out of an OSM start_date ('1923', '1923-05-01', 'c. 1923', '~1923', '1920s', 'before 1900')
export function yearOf(v) {
	if (v === undefined || v === null || v === '') return NaN;
	if (typeof v === 'number') return v;
	const m = String(v).match(/(1[6-9]\d\d|20\d\d)/);
	return m ? +m[1] + (/\d0s/.test(String(v)) ? 5 : 0) : NaN;
}

// the old town centres: a dense core of brick and street trees, older streets round it
// [lat, lon, core radius m, old radius m]
export const OLD_TOWNS = [
	[37.7946, -122.4030, 1300, 5200],   // San Francisco: downtown, and the city round it
	[37.8030, -122.2720, 700, 3600],    // Oakland
	[37.8700, -122.2680, 500, 2600],    // Berkeley
	[37.7650, -122.2420, 400, 2200],    // Alameda
	[37.4440, -122.1610, 380, 1500],    // Palo Alto, University Avenue
	[37.3360, -121.8910, 650, 2400],    // San Jose
	[37.5640, -122.3250, 350, 1500],    // San Mateo
	[37.5790, -122.3450, 300, 1200],    // Burlingame
	[37.8216, -121.9990, 260, 700],     // Old Town Danville, Hartz Avenue
	[37.6620, -121.8750, 300, 900],     // Pleasanton, Main Street
	[37.6820, -121.7680, 320, 1100],    // Livermore, First Street
	[37.6700, -122.0810, 320, 1100],    // Hayward
	[37.9020, -122.0640, 300, 900],     // Walnut Creek
	[38.0190, -122.1340, 300, 1000],    // Martinez
	[38.0490, -122.1590, 260, 900],     // Benicia
	[37.9740, -122.5310, 320, 1100],    // San Rafael
	[37.8590, -122.4850, 220, 800],     // Sausalito
	[38.2340, -122.6400, 300, 1100],    // Petaluma
	[38.1040, -122.2560, 320, 1300],    // Vallejo
	[37.4850, -122.2300, 300, 1100],    // Redwood City
	[37.2270, -121.9800, 220, 800],     // Los Gatos
	[37.9770, -122.0310, 320, 1000],    // Concord, Todos Santos
	[38.2970, -122.2860, 320, 1100],    // Napa
];
const OLD_W = OLD_TOWNS.map(([lat, lon, core, old]) => ({ lat, lon, core, old }));
// how near an old town centre a point is: 2 in its core, 1 in its older streets, 0 beyond
export function oldTownAt(x, z) {
	const { lat, lon } = toLatLon(x, z);
	let best = 0;
	for (const T of OLD_W) {
		const dx = (lon - T.lon) * 88000, dz = (lat - T.lat) * 111000, d = Math.hypot(dx, dz);
		if (d < T.core) return 2;
		if (d < T.old) best = 1;
	}
	return best;
}

// The era of a neighbourhood from what is known of it:
//   years    start dates of the buildings in it (any it has)
//   prior    the houses' era there (decor.js: prewar, ranch, split, tract, modern)
//   dense    0..1 how much of it is a packed core (paved to the walls, shops)
//   oldTown  2 an old centre's core, 1 its older streets, 0 neither
//   regular  0..1 how square the street grid is
//   culs     cul-de-sacs in it
//   coreDist metres from the centre of a grown town (crysis), when that is what it is
export function guessEra({ years = [], prior = 'tract', dense = 0, oldTown = 0, regular = 0.5, culs = 0, coreDist = null } = {}) {
	const ys = years.map(yearOf).filter(Number.isFinite).sort((a, b) => a - b);
	if (ys.length >= 3) return eraOfYear(ys[ys.length >> 1], dense > 0.35);
	if ((dense > 0.35 || (oldTown === 2 && dense > 0.15)) && (oldTown === 2 || (regular > 0.65 && (oldTown || (coreDist !== null && coreDist < 450))))) return 'historic';
	let s = { prewar: 1, ranch: 2, split: 2.35, tract: 3, modern: 3.9 }[prior] ?? 3;
	if (oldTown === 2) s -= 1.6; else if (oldTown === 1) s -= 0.9;
	if (regular > 0.75 && culs === 0) s -= 0.45;
	else if (regular < 0.35) s += 0.35;
	if (culs >= 3) s += 0.6; else if (culs >= 1) s += 0.25;
	if (coreDist !== null) s += Math.max(-1.2, Math.min(1.4, (coreDist - 900) / 1100));
	s = Math.max(1, Math.min(4, s));          // (historic only for a dense core, above)
	return ERAS[Math.round(s)];
}

// how square a set of street pieces is: their lengths' agreement with one grid bearing
// (angles folded into a quarter turn); pts: [ax, az, bx, bz] pieces
export function gridRegularity(pieces) {
	let sx = 0, sy = 0, sw = 0;
	for (const [ax, az, bx, bz] of pieces) {
		const L = Math.hypot(bx - ax, bz - az);
		if (L < 3) continue;
		const a = Math.atan2(bz - az, bx - ax) * 4;                 // a quarter turn is a full one
		sx += Math.cos(a) * L; sy += Math.sin(a) * L; sw += L;
	}
	return sw > 0 ? Math.hypot(sx, sy) / sw : 0.5;
}

// ---------- each era's street ----------
// the street trees, by species: city.js tier (sp: 0 round, 1 oak, 3 palm), summer crown
// colour, autumn colour (deciduous ones), crown width against height (nx)
export const SPECIES = Object.freeze({
	plane: { sp: 0, col: [0.27, 0.36, 0.15], fall: [0.56, 0.43, 0.17], nx: 1 },
	sycamore: { sp: 0, col: [0.3, 0.38, 0.16], fall: [0.62, 0.46, 0.15], nx: 1 },
	elm: { sp: 0, col: [0.22, 0.33, 0.12], fall: [0.66, 0.55, 0.12], nx: 0.95 },
	oak: { sp: 1, col: [0.16, 0.24, 0.1], fall: null, nx: 1 },
	ginkgo: { sp: 0, col: [0.32, 0.42, 0.16], fall: [0.9, 0.74, 0.06], nx: 0.6 },
	pear: { sp: 0, col: [0.24, 0.36, 0.13], fall: [0.64, 0.13, 0.1], nx: 0.68 },
	maple: { sp: 0, col: [0.24, 0.34, 0.12], fall: [0.84, 0.26, 0.06], nx: 0.85 },
	crape: { sp: 0, col: [0.26, 0.34, 0.14], fall: [0.8, 0.34, 0.1], nx: 0.8 },
	palm: { sp: 3, col: [0.25, 0.35, 0.15], fall: null, nx: 1 },
});
// per era: tree species and their shares, heights, spacing (m), where they stand (in tree
// wells at the kerb, or in the strip behind the sidewalk), a young tree's stake, gaps in
// the row, palms where the climate suits; the sidewalk, the kerb, the lamp; potholes per
// 100 m of lane
export const KITS = Object.freeze({
	historic: { trees: [['plane', 0.6], ['ginkgo', 0.25], ['elm', 0.15]], h: [10, 14], spacing: 9, well: true, stake: false, gap: 0.1, palms: 0.05, walk: 'brick', curb: 'granite', lamp: 'acorn', holes: 0.9 },
	prewar: { trees: [['sycamore', 0.35], ['plane', 0.25], ['elm', 0.15], ['oak', 0.25]], h: [13, 19], spacing: 11, well: false, stake: false, gap: 0.18, palms: 0.06, walk: 'scored-old', curb: 'square', lamp: 'cobra', holes: 1.4 },
	postwar: { trees: [['sycamore', 0.2], ['maple', 0.25], ['oak', 0.2], ['crape', 0.15], ['pear', 0.2]], h: [8, 13], spacing: 14, well: false, stake: false, gap: 0.25, palms: 0.14, walk: 'scored', curb: 'square', lamp: 'cobra', holes: 0.8 },
	tract: { trees: [['pear', 0.35], ['crape', 0.2], ['maple', 0.25], ['oak', 0.2]], h: [5.5, 9], spacing: 13, well: false, stake: false, gap: 0.12, palms: 0.18, walk: 'clean', curb: 'rolled', lamp: 'cobra', holes: 0.3 },
	new: { trees: [['pear', 0.4], ['maple', 0.3], ['ginkgo', 0.3]], h: [3.2, 5], spacing: 10.5, well: false, stake: true, gap: 0.04, palms: 0.04, walk: 'new', curb: 'rolled', lamp: 'led', holes: 0.05 },
});
export const kitFor = (era) => KITS[era] || KITS.tract;

// one street tree of an era, from a roll (0..1 each: species, height, palm); fog: 0..1
// how far into the coast's fog belt (fewer palms there)
export function treeFor(era, r1, r2, r3 = 0.5, fog = 0) {
	const K = kitFor(era);
	let name = K.trees[K.trees.length - 1][0];
	if (r3 < K.palms * (1 - fog * 0.6)) name = 'palm';
	else {
		let acc = 0;
		for (const [n, w] of K.trees) { acc += w; if (r1 < acc) { name = n; break; } }
	}
	const S = SPECIES[name];
	// a palm stands tall over any era's street; the rest are as old as the street
	const h = name === 'palm' ? 11 + r2 * 9 : K.h[0] + (K.h[1] - K.h[0]) * r2;
	return { species: name, sp: S.sp, h, col: S.col, fall: S.fall, nx: S.nx, stake: K.stake && name !== 'palm', well: K.well };
}

// where along a street of length L (m) its trees stand on one side: the distances, from a
// starting roll and a row of rolls (each a gap or a nudge); spacing from the era
export function treeRow(era, L, rnd) {
	const K = kitFor(era), out = [];
	const jit = era === 'new' ? 0.04 : era === 'tract' ? 0.1 : 0.22;          // the new rows are planted on a string line
	for (let s = 3 + rnd() * K.spacing; s < L - 3; s += K.spacing * (1 - jit + rnd() * jit * 2)) if (rnd() >= K.gap) out.push(s);
	return out;
}

// potholes in a street: how many per 100 m of lane, from its era, its class and how let go
// the neighbourhood is (neglect 0..1, a kilometre-scale roll)
const CLASS_HOLES = { residential: 1.2, living_street: 1.1, unclassified: 1.1, service: 1.5, tertiary: 1, secondary: 0.8, primary: 0.6, trunk: 0.3, unknown: 1, motorway: 0 };
export function holeRate(era, cls, neglect = 0.5) {
	return kitFor(era).holes * (CLASS_HOLES[cls] ?? 0.8) * (0.35 + neglect * 1.3);
}

// ---------- the runtime: the era where you are, read from the loaded map ----------
// Neighbourhoods are 250 m cells, each worked out once (the houses' era there, how much of
// it is a packed core and how near one is, its street pattern, any start dates) and kept.
const CELL = 250;
const maps = new WeakMap();
export function eraMap(real) {
	if (!real) return null;
	let M = maps.get(real);
	if (M) return M;
	const cells = new Map();
	let seenV = -1;
	function cellEra(i, j) {
		const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
		// the houses' era here: the most common of five lots
		const tally = {};
		for (const [dx, dz] of [[0, 0], [-70, -60], [70, -50], [-60, 70], [60, 60]]) { const e = houseEra(cx + dx, cz + dz); tally[e] = (tally[e] || 0) + 1; }
		const prior = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
		// a packed core: paved to the walls (13) or shops (7), in a 3 by 3 of samples
		let dense = 0, n = 0;
		// (or roofed over: a region baked without the paved-core fill still shows its packed blocks)
		for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = real.landAt?.(cx + a * 80, cz + b * 80), u = L?.lu ?? 0; dense += Math.max(u === 13 ? 1 : u === 7 ? 0.5 : 0, (L?.roof ?? 0) > 0.55 ? 0.6 : 0); n++; }
		dense /= n;
		// the streets in it: how square, how many dead ends
		const pieces = [];
		let culs = 0;
		for (const r of real.near?.('roads', cx, cz, CELL * 0.7) || []) {
			if (!r.drive || r.cls === 'motorway' || r.cls === 'service' || r.link) continue;
			const p = r.pts;
			for (let k = 0; k + 3 < p.length; k += 2) if (Math.abs(p[k] - cx) < CELL && Math.abs(p[k + 1] - cz) < CELL) pieces.push([p[k], p[k + 1], p[k + 2], p[k + 3]]);
			if ((r.end0 && Math.abs(p[0] - cx) < CELL / 2 && Math.abs(p[1] - cz) < CELL / 2) || (r.end1 && Math.abs(p[p.length - 2] - cx) < CELL / 2 && Math.abs(p[p.length - 1] - cz) < CELL / 2)) culs++;
		}
		// start dates, where the map gives the buildings any
		const years = [];
		for (const b of real.near?.('boxes', cx, cz, CELL * 0.6) || []) { const y = yearOf(b.start_date ?? b.year); if (Number.isFinite(y)) years.push(y); }
		// a grown town (crysis): its centre is its old core
		const G = real.regionAt?.(cx, cz);
		const coreDist = G?.gen && G.bounds ? Math.hypot(cx - (G.bounds[0] + G.bounds[2]) / 2, cz - (G.bounds[1] + G.bounds[3]) / 2) : null;
		const key = guessEra({ years, prior, dense, oldTown: oldTownAt(cx, cz), regular: gridRegularity(pieces), culs, coreDist });
		// how let go it is, beside how old: a kilometre-scale roll
		const neglect = roll((Math.floor(cx / 1000) * 73) | 0, (Math.floor(cz / 1000) * 37) | 0);
		return { key, idx: ERA_INDEX[key], age: ERA_AGE[key], neglect };
	}
	// (a region came or went: what was guessed from its map is guessed again)
	const sync = () => { const v = (real.version?.() ?? 0) * 4096 + (real.genVersion?.() ?? 0); if (v !== seenV) { seenV = v; cells.clear(); } };
	function at(x, z) {
		sync();
		const i = Math.floor(x / CELL), j = Math.floor(z / CELL), k = (i + 4096) * 8192 + j + 4096;
		let e = cells.get(k);
		if (!e) { e = cellEra(i, j); cells.set(k, e); }
		return e;
	}
	// a street's era: where its middle is (kept on the road)
	function ofRoad(r) {
		sync();
		if (r.era && r.eraV === seenV) return r.era;
		const p = r.pts, k = (Math.floor(p.length / 4)) * 2;
		r.era = at(p[k], p[k + 1]); r.eraV = seenV;
		return r.era;
	}
	M = { at, ofRoad, clear: () => cells.clear() };
	maps.set(real, M);
	return M;
}
