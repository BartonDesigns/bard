// Coming down on Earth from orbit: which place is under the ship, and what the game builds
// there. The orbital globe and the walkable globe share one geography (view.js anchors the
// texture with geoBasis), so the point under the ship is a real latitude and longitude.
//
//   geoBasis(lat, lon)       the local frame at a place (x east, y up, z south) in globe axes
//   regionNote(lat, lon)     a short note on a place: { title, sub, kind, lat, lon }
//   kmBetween(a, b)          great-circle km between two { lat, lon }
//   citiesAround(lat, lon)   cities to head for from a place: the nearest, then the region's biggest
import * as THREE from 'three';
import { atlasReady, loadAtlas, regionAt, citiesNear, POP } from '../earth/atlas.js';
import { kitAt } from '../region/choose.js';
import { bayKm } from '../earth/globeframe.js';

// the walkable globe's frame stops here (earth/globeframe.js setFrame)
export const LAT_LIMIT = 83.5;
// within this of the Bay's origin the hand-built Bay is what you land in (earth/globe.js BAY_WILD_KM)
const BAY_HAND_KM = 180;
const RAD = Math.PI / 180;

export function geoBasis(lat = 0, lon = 0, out = new THREE.Matrix3()) {
	const a = lat * RAD, b = lon * RAD;
	return out.set(-Math.sin(b), Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), 0, Math.sin(a), -Math.cos(a), Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a) * Math.sin(b));
}
// globe axes (unit vector) <-> latitude and longitude, as the orbital texture reads them
export function geoLL(g) { return { lat: Math.asin(Math.max(-1, Math.min(1, g.y))) / RAD, lon: Math.atan2(g.z, g.x) / RAD }; }
export function geoVec(lat, lon, out = new THREE.Vector3()) { const a = lat * RAD, b = lon * RAD; return out.set(Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)); }

export function kmBetween(p, q) {
	const s = Math.sin((q.lat - p.lat) * RAD / 2) ** 2 + Math.cos(p.lat * RAD) * Math.cos(q.lat * RAD) * Math.sin((q.lon - p.lon) * RAD / 2) ** 2;
	return 12742 * Math.asin(Math.min(1, Math.sqrt(s)));
}
export function llLabel(lat, lon) {
	return `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`;
}
const cap = (t = '') => t ? t[0].toUpperCase() + t.slice(1) : '';
const unique = (list) => list.filter((t, i) => t && list.indexOf(t) === i);

// What you get if you come down here. The note is honest about what is hand-built (the Bay)
// and what is generated (everywhere else: the real terrain, with the region's kit on it).
export function regionNote(lat, lon) {
	const where = llLabel(lat, lon);
	const polar = Math.abs(lat) > LAT_LIMIT ? ` The walkable globe stops at ${LAT_LIMIT}°, so you come down at its edge.` : '';
	if (!atlasReady()) return { kind: 'unknown', title: where, sub: `Charting this region…${polar}`, lat, lon };
	const R = regionAt(lat, lon);
	if (!R) return { kind: 'unknown', title: where, sub: `Real terrain from the globe.${polar}`, lat, lon };
	const country = R.profile.country || '';
	if (bayKm(lat, lon) < 4) return { kind: 'bay', title: 'The island', sub: 'The island off the Golden Gate, where Bard begins, with the hand-built Bay Area around it.', lat, lon };
	if (bayKm(lat, lon) < BAY_HAND_KM) {
		const c = citiesNear(lat, lon, 25, 1)[0];
		return { kind: 'bay', title: c ? `${c.km < 6 ? '' : 'Near '}${c.name}` : 'The Bay Area', sub: 'The hand-built Bay Area: surveyed ground, real streets and towns, and the island off the Golden Gate.', lat, lon };
	}
	if (!R.land) {
		const c = citiesNear(lat, lon, 900, 1)[0];
		const shore = c ? ` The nearest town is ${c.name}, ${Math.round(c.km)} km away.` : ' No land is close: fly low to find a coast.';
		return { kind: 'sea', title: cap(R.name || 'The open sea'), sub: `Open water. You come down over the sea.${shore}${polar}`, lat, lon };
	}
	const c = citiesNear(lat, lon, 60, 1)[0];
	const K = kitAt(R, { pop: c && c.km < 8 ? c.pop : -1 });
	const name = cap(R.name);
	const title = c ? `${c.km < 6 ? '' : 'Near '}${c.name}` : name;
	const place = unique([c ? name : '', country !== R.name ? country : '']).filter((t) => t !== c?.name).join(', ');
	const kit = K?.kit?.name ? ` in its ${K.kit.name} style` : '';
	const big = c && c.km < 8 && c.pop >= 3 ? ` ${c.name} is grown street by street as you near it.` : '';
	return { kind: 'land', title, sub: `${place ? place + '. ' : ''}Real terrain from the globe; the towns, roads, plants and people are generated${kit}.${big}${polar}`, lat, lon };
}

// Cities to head for from a place: the nearest first, then the biggest round it (a place a
// short way from one already picked is its suburb, left out), then the rest by distance. Out
// at sea, or where no town is near, the nearest wherever it is.
//   -> [{ id, name, lat, lon, km, pop, size }]   (size: 'village' ... 'megacity')
export function citiesAround(lat, lon, n = 6, radiusKm = 350) {
	if (!atlasReady()) { loadAtlas().catch(() => {}); return []; }
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
	let near = citiesNear(lat, lon, radiusKm, 400);
	if (!near.length) near = citiesNear(lat, lon, 2000, 1);
	if (!near.length) return [];
	const pick = [near[0]], apart = (c) => pick.every((p) => kmBetween(p, c) > 25);
	for (const c of near.slice(1).filter((c) => c.pop >= 2).sort((a, b) => b.pop - a.pop || a.km - b.km)) { if (pick.length >= n) break; if (apart(c)) pick.push(c); }
	for (const c of near.slice(1)) { if (pick.length >= n) break; if (!pick.includes(c) && apart(c)) pick.push(c); }
	const [first, ...rest] = pick;
	return [first, ...rest.sort((a, b) => a.km - b.km)].map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, km: c.km, pop: c.pop, size: POP[c.pop] || 'town' }));
}
// '12 km', '850 m', '1,240 km'
export const kmLabel = (km) => km < 1 ? `${Math.round(km * 100) * 10} m` : `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en')} km`;
