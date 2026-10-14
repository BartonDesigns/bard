// Regions as people live them: neighbouring towns grouped the way area codes group them.
// The Bay's towns fall into seven (the City and the Peninsula, Marin, the East Bay, the
// Diablo and Tri-Valley towns over the hills, the South Bay, the North Bay and Santa Cruz);
// out on the globe, towns are grouped by nearness inside their atlas region, in cells about
// 150 km across, each named for its biggest town. Each region keeps a morality tally
// (combat/morality.js createCommons), moved by everyone's deeds in it.
//
// A town's situation (how much trouble, how comfortable) is not survey data: it is grown
// from the town's size, the kind of street you are on and a little of the town's own name,
// the same every visit. Pure: no scene, no clock.

import { PLACES } from '../bay/places.js';
import { ZONE } from './flow.js';

export const BAY_REGIONS = Object.freeze({
	'bay.sf': { name: 'the City and the Peninsula', code: '415' },
	'bay.marin': { name: 'Marin', code: '415' },
	'bay.east': { name: 'the East Bay', code: '510' },
	'bay.diablo': { name: 'the Diablo and Tri-Valley towns', code: '925' },
	'bay.south': { name: 'the South Bay', code: '408' },
	'bay.north': { name: 'the North Bay', code: '707' },
	'bay.santacruz': { name: 'Santa Cruz', code: '831' },
});

// which region a Bay county's town belongs to (east of the hills it is the 925)
function bayGroup(county, lon) {
	if (county === 'San Francisco' || county === 'San Mateo County') return 'bay.sf';
	if (county === 'Marin County') return 'bay.marin';
	if (county === 'Santa Clara County') return 'bay.south';
	if (county === 'Santa Cruz County') return 'bay.santacruz';
	if (county === 'Alameda County') return lon > -121.96 ? 'bay.diablo' : 'bay.east';
	if (county === 'Contra Costa County') return lon > -122.15 ? 'bay.diablo' : 'bay.east';
	return 'bay.north';
}

// the nearest named place in the Bay, and the region it belongs to
export function bayTownAt(lat, lon) {
	const k = Math.cos(lat * Math.PI / 180);
	let best = null, bd = 1e9;
	for (const P of PLACES) {
		const dy = P[1] - lat, dx = (P[2] - lon) * k, d = dy * dy + dx * dx;
		if (d < bd) { bd = d; best = P; }
	}
	return best && { name: best[0], county: best[3], pop: best[4], km: Math.round(Math.sqrt(bd) * 111.2 * 10) / 10 };
}
export function bayRegionOf(lat, lon) {
	const T = bayTownAt(lat, lon), id = T ? bayGroup(T.county, lon) : 'bay.sf';
	return { id, name: BAY_REGIONS[id].name, code: BAY_REGIONS[id].code, town: T };
}

// a globe region: the atlas region and a cell of it; cities: [{ name, lat, lon, pop }] near it,
// the biggest in the same cell names it (pop: the atlas size class, or people)
export const CELL = 1.4;
export function globeCell(lat, lon) {
	const cy = Math.floor(lat / CELL), w = CELL / Math.max(0.3, Math.cos((cy + 0.5) * CELL * Math.PI / 180));
	return { cy, cx: Math.floor(lon / w), w };
}
export function globeRegionOf({ regionId = 'earth', regionName = '', lat = 0, lon = 0, cities = [] } = {}) {
	const { cy, cx, w } = globeCell(lat, lon);
	const inCell = cities.filter((c) => Math.floor(c.lat / CELL) === cy && Math.floor(c.lon / w) === cx).sort((a, b) => (b.pop || 0) - (a.pop || 0));
	const big = inCell[0]?.name;
	return { id: `${regionId}#${cy}.${cx}`, name: big ? `the ${big} area` : regionName || 'these parts', town: big || null };
}

// ---------- a town's situation ----------
const hash01 = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const ZONE_TROUBLE = { [ZONE.downtown]: 0.12, [ZONE.industrial]: 0.15, [ZONE.retail]: 0.05, [ZONE.dining]: 0.04, [ZONE.office]: 0, [ZONE.neighbourhood]: -0.05, [ZONE.trail]: -0.1, [ZONE.beach]: -0.06, [ZONE.quiet]: -0.08, island: -0.12 };
const ZONE_MEANS = { [ZONE.office]: 0.12, [ZONE.industrial]: -0.15, [ZONE.neighbourhood]: 0.05, [ZONE.dining]: 0.04, [ZONE.retail]: 0, [ZONE.downtown]: 0, island: -0.05 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// pop in thousands (the Bay's list) or the atlas class (0 village .. 5 megacity)
export function situationOf({ name = '', pop = 0, cls = null, zone = ZONE.neighbourhood } = {}) {
	const big = cls !== null ? cls / 5 : clamp01(Math.log10(1 + Math.max(0, pop)) / 3);
	const j = hash01(name), j2 = hash01(name + '|means');
	return {
		trouble: Math.round(clamp01(0.12 + 0.3 * big + (ZONE_TROUBLE[zone] ?? 0) + (j - 0.5) * 0.2) * 100) / 100,
		means: Math.round(clamp01(0.5 + (ZONE_MEANS[zone] ?? 0) + (j2 - 0.5) * 0.5) * 100) / 100,
	};
}
