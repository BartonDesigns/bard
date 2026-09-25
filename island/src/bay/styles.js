// How each part of the Bay Area is built: the street grid's real bearing, the block
// size, and the kind of houses on it. Shared by the ground shader (streets, lawns,
// roofs seen from afar) and the buildings, so they always line up.
//
// Styles:
//   0 sf       San Francisco: attached Victorians and Edwardians, 3-4 storeys, pastel,
//              flat roofs, bay windows, no gaps between them
//   1 sunset   the Sunset and the Richmond: rows of two-storey stucco, white and pastel
//   2 older    Oakland, Berkeley, the older towns: detached wood houses, pitched roofs,
//              shingle browns, sage, cream, big street trees
//   3 suburb   the valleys and the newer towns (San Ramon, Danville, Dublin...):
//              one- and two-storey stucco, clay-tile hip roofs, lawns, curving streets
//   4 office   business parks and tech campuses (Bishop Ranch, Silicon Valley...): office
//              blocks in parking lots
//   5 industry warehouses, docks, yards: the port, the flats along the bay, the refineries
//   6 retail   malls and big-box centres in their parking lots
// Downtown towers come from the urban map's downtown channel on top of any style.

import { toLatLon } from './geo.js';

export const STYLE = { sf: 0, sunset: 1, older: 2, suburb: 3, office: 4, industry: 5, retail: 6 };

// block sizes [along the grid x, along the grid z] and street width, per style
export const BLOCKS = [[125, 84, 14], [180, 72, 13], [120, 90, 13], [150, 84, 12], [220, 160, 16], [260, 180, 18], [240, 170, 16]];

const OLDER = new Set(['Oakland', 'Berkeley', 'Alameda', 'Albany', 'Emeryville', 'Piedmont', 'El Cerrito', 'Richmond', 'San Leandro', 'Kensington', 'Sausalito', 'Mill Valley', 'San Rafael', 'San Anselmo', 'Fairfax', 'Larkspur', 'Ross', 'Palo Alto', 'Burlingame', 'San Mateo', 'Vallejo', 'Benicia', 'Napa', 'Petaluma', 'Sonoma', 'Martinez', 'Los Gatos', 'Alameda', 'Belvedere', 'Tiburon', 'Crockett', 'Menlo Park', 'Saint Helena', 'Healdsburg', 'Sebastopol', 'Calistoga']);

// bearings (degrees clockwise from north) of real street grids; the grid is the same
// under a quarter turn, so what is stored is the bearing modulo 90
const BEARING = {
	'San Francisco': 0, 'Daly City': 0, Oakland: 20.8, Emeryville: 20.8, Piedmont: 20.8, Berkeley: 0, Albany: 0, 'El Cerrito': 10,
	'San Jose': 60, 'Santa Clara': 0, 'Palo Alto': 50, 'Menlo Park': 40, 'Mountain View': 35, Sunnyvale: 0, 'Redwood City': 35,
	'San Mateo': 60, Burlingame: 60, 'San Carlos': 40, Belmont: 40, 'San Ramon': 70, Danville: 70, Dublin: 0, Pleasanton: 20,
	'Walnut Creek': 15, Concord: 10, Fremont: 50, Hayward: 55, 'San Leandro': 40, Alameda: 0, Richmond: 0, Vallejo: 0, Napa: 0,
};
const rad = (b) => ((b % 90) + 90) % 90 * Math.PI / 180;
export function bearingFor(name, hash) { return name in BEARING ? rad(BEARING[name]) : hash * Math.PI / 2; }
export function styleFor(name, county) {
	if (county === 'San Francisco') return STYLE.sf;
	if (OLDER.has(name)) return STYLE.older;
	return STYLE.suburb;
}
// local corrections inside a town, by position
const MARKET_A = { lat: 37.7625, lon: -122.4351 }, MARKET_B = { lat: 37.7955, lon: -122.3937 };
export function localOverride(x, z, style, angle) {
	const { lat, lon } = toLatLon(x, z);
	if (style === STYLE.sf) {
		// South of Market: the grid runs square to Market Street, 45 degrees off
		const side = (lon - MARKET_A.lon) * (MARKET_B.lat - MARKET_A.lat) - (lat - MARKET_A.lat) * (MARKET_B.lon - MARKET_A.lon);
		if (side > 0 && lat > 37.768 && lon > -122.43) return { style, angle: rad(45) };
		// the Sunset and the Richmond, west of the park's middle
		if (lon < -122.463 && lat > 37.73 && lat < 37.79) return { style: STYLE.sunset, angle: rad(89.6) };   // long blocks run north-south
	}
	// Bishop Ranch, San Ramon's business park, along the freeway
	if (lat > 37.758 && lat < 37.782 && lon > -121.975 && lon < -121.955) return { style: STYLE.office, angle: rad(70) };
	// land use: the industrial flats, the tech campuses and business parks, the malls
	for (const [zl, zo, r, st, b] of ZONING) {
		const dx = (lon - zo) * 88000, dz = (lat - zl) * 111000;
		if (dx * dx + dz * dz < r * r) return { style: st, angle: b === undefined ? angle : rad(b) };
	}
	return { style, angle };
}

// [lat, lon, radius m, style, grid bearing?]: where the land is used for work and shopping
const I = STYLE.industry, O = STYLE.office, R = STYLE.retail;
export const ZONING = [
	// malls and shopping centres (checked first: they sit inside everything else)
	[37.6955, -121.9280, 480, R, 0], [37.8950, -122.0580, 330, R], [37.9650, -122.0600, 430, R], [37.7800, -121.9790, 300, R, 70], [37.7035, -121.8880, 550, R, 0],
	[37.3250, -121.9460, 430, R], [37.4430, -122.1710, 380, R, 50], [37.5380, -122.3000, 380, R], [37.6720, -122.4690, 380, R], [37.6560, -122.1030, 430, R],
	[37.6970, -122.1270, 330, R], [37.9900, -122.3310, 430, R], [37.4160, -121.8970, 480, R], [37.2530, -121.8620, 430, R], [37.6380, -122.4160, 380, R],
	// industry: the port and the flats along the bay, refineries up the strait
	[37.8060, -122.3000, 1400, I, 20.8], [37.7350, -122.2000, 1500, I], [37.7050, -122.1800, 1300, I], [37.6350, -122.1300, 2200, I], [37.4950, -121.9600, 2200, I],
	[37.7350, -122.3850, 1100, I, 0], [37.7580, -122.3890, 600, I, 0], [37.6550, -122.3900, 1500, I], [37.6850, -122.3950, 800, I], [37.9250, -122.3650, 1800, I],
	[37.8450, -122.2930, 800, I, 0], [37.6900, -121.8000, 1500, I], [38.0200, -122.1100, 1200, I], [38.0300, -121.8800, 1500, I], [37.5050, -122.2350, 700, I],
	// tech campuses and business parks
	[37.4200, -122.0830, 1200, O], [37.4050, -122.0200, 1300, O], [37.3950, -121.9750, 1500, O], [37.4050, -121.9300, 1800, O], [37.4850, -122.1480, 600, O],
	[37.7000, -121.8900, 1200, O, 0], [37.5250, -122.2500, 700, O], [37.3900, -122.0400, 600, O],
];

// when a suburban tract was built, and so what it looks like; one builder, one look
export const ERA = { ranch: 0, seventies: 1, modern: 2, eichler: 3 };
export function eraFor(x, z, r) {
	const { lat, lon } = toLatLon(x, z);
	// Dougherty Valley, east Dublin, the far east bay: built out 1995-2015
	if ((lat > 37.73 && lat < 37.79 && lon > -121.935 && lon < -121.86) || (lat > 37.69 && lat < 37.73 && lon > -121.9 && lon < -121.83) || lon > -121.8) return r < 0.85 ? ERA.modern : ERA.seventies;
	// west San Ramon and Danville: the 1970s-80s valley, with newer tracts
	if (lat > 37.74 && lat < 37.86 && lon > -122.03 && lon < -121.935) return r < 0.5 ? ERA.seventies : r < 0.8 ? ERA.modern : ERA.ranch;
	// the Peninsula and the South Bay: postwar ranch houses, and Eichler tracts
	if (lat < 37.5 && lon < -121.9) return r < 0.28 ? ERA.eichler : r < 0.8 ? ERA.ranch : ERA.seventies;
	if (lat > 37.87 && lat < 37.93 && lon > -122.1 && lon < -122.03) return r < 0.2 ? ERA.eichler : r < 0.6 ? ERA.ranch : ERA.seventies;
	return r < 0.45 ? ERA.ranch : r < 0.75 ? ERA.seventies : ERA.modern;
}

// San Francisco's districts: each with its own buildings
export function sfDistrict(x, z) {
	const { lat, lon } = toLatLon(x, z);
	const d = (a, b) => Math.hypot((lon - b) * 88000, (lat - a) * 111000);
	if (d(37.7941, -122.4078) < 330) return 'chinatown';
	if (d(37.8006, -122.4103) < 380) return 'northbeach';
	if (d(37.7905, -122.4150) < 700) return 'nobhill';
	if (d(37.8020, -122.4370) < 620) return 'marina';
	if (d(37.7925, -122.4382) < 650) return 'pacheights';
	if (d(37.7599, -122.4148) < 900) return 'mission';
	if (d(37.7700, -122.4460) < 900 || d(37.7609, -122.4350) < 600 || d(37.7765, -122.4330) < 450 || d(37.7510, -122.4330) < 600) return 'victorian';
	return 'sf';
}

// curving suburban streets: the grid is warped by a slow, smooth field; the same
// formula runs in GLSL (see WARP_GLSL) so ground and buildings agree
export function warp(x, z, style) {
	if (style !== STYLE.suburb) return [0, 0];
	const S = 60;
	return [S * (Math.sin(z * 0.0063 + 1.7) + 0.6 * Math.sin(x * 0.0041 + 0.4)), S * (Math.sin(x * 0.0059 + 2.9) + 0.6 * Math.sin(z * 0.0037 + 5.1))];
}
export const WARP_GLSL = /* glsl */`
vec2 streetWarp(vec2 w, float style){
	if (abs(style - 3.0) > 0.5) return vec2(0.0);
	// each argument wrapped to one period first: GPU sin() loses precision far from zero
	const float TWO_PI = 6.283185307;
	#define WS(v, k, ph) sin(mod(v, TWO_PI / k) * k + ph)
	return 60.0 * vec2(WS(w.y, 0.0063, 1.7) + 0.6 * WS(w.x, 0.0041, 0.4), WS(w.x, 0.0059, 2.9) + 0.6 * WS(w.y, 0.0037, 5.1));
}
vec3 blockOf(float style){
	if (style < 0.5) return vec3(125.0, 84.0, 14.0);
	if (style < 1.5) return vec3(180.0, 72.0, 13.0);
	if (style < 2.5) return vec3(120.0, 90.0, 13.0);
	if (style < 3.5) return vec3(150.0, 84.0, 12.0);
	if (style < 4.5) return vec3(220.0, 160.0, 16.0);
	if (style < 5.5) return vec3(260.0, 180.0, 18.0);
	return vec3(240.0, 170.0, 16.0);
}
`;
// world -> grid coordinates (the GLSL mat2(c, -s, s, c) * w, plus the warp)
export function toGrid(x, z, a, style) {
	const c = Math.cos(a), s = Math.sin(a), [wx, wz] = warp(x, z, style);
	return [c * x + s * z + wx, -s * x + c * z + wz];
}
// grid -> world, by fixed-point iteration through the warp
export function fromGrid(gx, gz, a, style) {
	const c = Math.cos(a), s = Math.sin(a);
	let x = c * gx - s * gz, z = s * gx + c * gz;
	if (style !== STYLE.suburb) return [x, z];
	for (let i = 0; i < 16; i++) {
		const [wx, wz] = warp(x, z, style), ux = gx - wx, uz = gz - wz;
		x = c * ux - s * uz; z = s * ux + c * uz;
	}
	return [x, z];
}
