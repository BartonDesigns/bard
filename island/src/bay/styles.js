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
//   4 office   business parks (Bishop Ranch...): low office blocks in parking lots
// Downtown towers come from the urban map's downtown channel on top of any style.

import { toLatLon } from './geo.js';

export const STYLE = { sf: 0, sunset: 1, older: 2, suburb: 3, office: 4 };

// block sizes [along the grid x, along the grid z] and street width, per style
export const BLOCKS = [[125, 84, 14], [180, 72, 13], [120, 90, 13], [150, 84, 12], [220, 160, 16]];

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
	return { style, angle };
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
	return 60.0 * vec2(sin(w.y * 0.0063 + 1.7) + 0.6 * sin(w.x * 0.0041 + 0.4), sin(w.x * 0.0059 + 2.9) + 0.6 * sin(w.y * 0.0037 + 5.1));
}
vec3 blockOf(float style){
	if (style < 0.5) return vec3(125.0, 84.0, 14.0);
	if (style < 1.5) return vec3(180.0, 72.0, 13.0);
	if (style < 2.5) return vec3(120.0, 90.0, 13.0);
	if (style < 3.5) return vec3(150.0, 84.0, 12.0);
	return vec3(220.0, 160.0, 16.0);
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
	for (let i = 0; i < 4; i++) {
		const [wx, wz] = warp(x, z, style), ux = gx - wx, uz = gz - wz;
		x = c * ux - s * uz; z = s * ux + c * uz;
	}
	return [x, z];
}
