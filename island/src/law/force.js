// The police of the place you are in: the force that answers a crime is the one that polices
// the ground it happens on, named as people there name it. In the Bay that is the city's own
// department (San Francisco Police, Oakland Police), the county sheriff outside city limits and
// in the towns that hire the sheriff (Castro Valley, Alamo, Cupertino), and the odd shared or
// public-safety department (Central Marin Police, Sunnyvale Public Safety). Elsewhere in the
// United States a city's police in town and the state patrol out on the roads; out in the world
// the country's own pattern: the Garda in Ireland, the Police Nationale in a French town and the
// Gendarmerie in its villages, the Guardia Civil in rural Spain, the Carabinieri in an Italian
// village, Polizei with the Land in Germany, the territorial forces of Britain, the state police
// of Australia and India, and so on, with the door word in the country's own script. Anywhere
// not listed it is simply the Police.
//
//   forceAt(lat, lon)    the force at a point: { id, name, word, sub, officer, shout, tac,
//                        tacWord, tacSub, tacOfficer, air, station, signSub, kind }
//   localForce()         the force acting where you are now (law/index.js keeps it, switching
//                        only when no officer, cruiser or helicopter of the last one is about,
//                        so a chase keeps the force that started it)
//   onForceChange(fn)    told when it changes (the cruisers' liveries, signage/cars.js)
//   forceAtXZ(x, z)      the same by world position, through setForceLocator (main.js)
//
// Pure: no scene. The atlas (earth/atlas.js) is read when it is loaded; without it the coarse
// locale boxes (economy/establishments.js) still give the country.

import { PLACES } from '../bay/places.js';
import { regionAt, citiesNear } from '../earth/atlas.js';
import { localeAt, setPoliceNamer } from '../economy/establishments.js';

const RAD = Math.PI / 180;
const up = (s) => String(s || '').toUpperCase();
const an = (s) => ((/^[aeiou]/i.test(s) && !/^(u[a-z]{2}|eu|one)/i.test(s)) || /^(?!SWAT)[AEFHILMNORSX][A-Z]{1,4}\b/.test(s) ? 'an' : 'a');
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const kmBetween = (a, b, c, d) => { const k = Math.cos(((a + c) / 2) * RAD); return Math.hypot(a - c, (b - d) * k) * 111.2; };

// a force with its defaults filled in: o.city the town it is named for or stationed in
export function finish(o) {
	const name = o.name || 'Police', word = o.word || 'POLICE';
	const sub = o.sub ?? (o.city ? up(o.city) : '');
	const tac = o.tac || `${name} tactical unit`;
	const F = {
		kind: o.kind || 'national', name, word, sub,
		full: o.full || name,
		officer: o.officer || `${an(name)} ${name} officer`,
		shout: o.shout || 'Police',
		tac, tacWord: o.tacWord || word, tacSub: o.tacSub || 'TACTICAL UNIT',
		tacOfficer: o.tacOfficer || `${an(tac)} ${tac} officer`,
		air: o.air || ((o.kind === 'city' || o.kind === 'state') && word === 'POLICE' && sub && sub.length < 16 ? `${sub} POLICE` : word),
		city: o.city || '',
		signSub: o.signSub ?? (o.city ? up(o.city) : sub),
	};
	F.station = o.station || (o.city ? (o.stationAt || '{t} Police Station').replace('{t}', o.city) : `${name} station`);
	F.id = o.id || slug(`${F.kind}|${name}|${word}|${sub}`);
	return F;
}
export const GENERIC = Object.freeze(finish({ id: 'generic', name: 'Police', sub: '', kind: 'generic', officer: 'a police officer', tacOfficer: 'a tactical officer' }));

// ---------- the Bay: its cities, and the county sheriffs round them ----------
// every incorporated city of the ten counties the Bay's places cover (as they are in the
// places list: 'Suisun' is Suisun City, 'Saint Helena' St. Helena)
const BAY_CITIES = {
	'San Francisco': 'San Francisco',
	'Alameda County': 'Alameda|Albany|Berkeley|Dublin|Emeryville|Fremont|Hayward|Livermore|Newark|Oakland|Piedmont|Pleasanton|San Leandro|Union City',
	'Contra Costa County': 'Antioch|Brentwood|Clayton|Concord|Danville|El Cerrito|Hercules|Lafayette|Martinez|Moraga|Oakley|Orinda|Pinole|Pittsburg|Pleasant Hill|Richmond|San Pablo|San Ramon|Walnut Creek',
	'Santa Clara County': 'Campbell|Cupertino|Gilroy|Los Altos|Los Altos Hills|Los Gatos|Milpitas|Monte Sereno|Morgan Hill|Mountain View|Palo Alto|San Jose|Santa Clara|Saratoga|Sunnyvale',
	'San Mateo County': 'Atherton|Belmont|Brisbane|Burlingame|Colma|Daly City|East Palo Alto|Foster City|Half Moon Bay|Hillsborough|Menlo Park|Millbrae|Pacifica|Portola Valley|Redwood City|San Bruno|San Carlos|San Mateo|South San Francisco|Woodside',
	'Marin County': 'Belvedere|Corte Madera|Fairfax|Larkspur|Mill Valley|Novato|Ross|San Anselmo|San Rafael|Sausalito|Tiburon',
	'Napa County': 'American Canyon|Calistoga|Napa|Saint Helena|Yountville',
	'Solano County': 'Benicia|Dixon|Fairfield|Rio Vista|Suisun|Vacaville|Vallejo',
	'Sonoma County': 'Cloverdale|Cotati|Healdsburg|Petaluma|Rohnert Park|Santa Rosa|Sebastopol|Sonoma|Windsor',
	'Santa Cruz County': 'Capitola|Santa Cruz|Scotts Valley|Watsonville',
};
const CITY_SET = new Set(), CITY_ANY = new Set();
for (const [county, list] of Object.entries(BAY_CITIES)) for (const n of list.split('|')) { CITY_SET.add(county + '|' + n); CITY_ANY.add(n); }
// places that are part of a city though listed apart
const PART_OF = { 'Redwood Shores': 'Redwood City' };
const DISPLAY = { Suisun: 'Suisun City', 'Saint Helena': 'St. Helena' };
// the towns policed by the county sheriff under contract, the shared departments, and the
// public-safety departments (police and fire as one)
const SHERIFF_TOWNS = new Set(['Cupertino', 'Saratoga', 'Los Altos Hills', 'Half Moon Bay', 'San Carlos', 'Millbrae', 'Portola Valley', 'Woodside', 'Yountville']);
const BAY_NAMED = {
	Sunnyvale: { name: 'Sunnyvale Public Safety', word: 'PUBLIC SAFETY', sub: 'SUNNYVALE', air: 'SUNNYVALE DPS' },
	'Rohnert Park': { name: 'Rohnert Park Public Safety', word: 'PUBLIC SAFETY', sub: 'ROHNERT PARK', air: 'ROHNERT PARK DPS' },
	'Los Gatos': { name: 'Los Gatos-Monte Sereno Police', sub: 'LOS GATOS · MONTE SERENO' },
	'Monte Sereno': { name: 'Los Gatos-Monte Sereno Police', sub: 'LOS GATOS · MONTE SERENO' },
	'Corte Madera': { name: 'Central Marin Police', sub: 'CENTRAL MARIN' },
	Larkspur: { name: 'Central Marin Police', sub: 'CENTRAL MARIN' },
	'San Anselmo': { name: 'Central Marin Police', sub: 'CENTRAL MARIN' },
	Dublin: { name: 'Dublin Police Services', sub: 'DUBLIN' },
	'San Francisco': { tac: 'San Francisco Police Tactical Unit', tacSub: 'TACTICAL UNIT', air: 'SFPD' },
	Oakland: { air: 'OAKLAND POLICE' },
	'San Jose': { air: 'SAN JOSE POLICE' },
};
// a place's reach: about a third of a kilometre per root of its thousands, never under 800 m
const reachKm = (pop) => Math.max(0.8, 0.35 * Math.sqrt(Math.max(0, pop)));
function sheriffOf(county, town = '') {
	const c = county === 'San Francisco' ? 'San Francisco' : county;
	const short = c.replace(/ County$/, '');
	return finish({
		kind: 'sheriff', name: `${c} Sheriff`, word: 'SHERIFF', sub: up(c), shout: 'Sheriff\'s Office',
		officer: `${an(c)} ${c} Sheriff's deputy`, tac: `${c} Sheriff SWAT`, tacWord: 'SHERIFF', tacSub: 'SWAT',
		tacOfficer: `${an(c)} ${c} Sheriff SWAT deputy`, air: `${up(short)} SHERIFF`,
		station: town ? `${c} Sheriff's Office, ${town} Station` : `${c} Sheriff's Office`, signSub: up(c), city: town,
	});
}
function cityForce(name, district = '') {
	const city = DISPLAY[name] || name, N = BAY_NAMED[name] || {};
	const fname = N.name || `${city} Police`;
	const big = name === 'San Francisco' || name === 'Oakland' || name === 'San Jose';
	const station = big && district ? `${fname}, ${district.replace(/ District$/, '')} Station` : /Public Safety$/.test(fname) ? `${city} Department of Public Safety` : /Police$/.test(fname) ? `${fname} Department` : fname;
	return finish({ kind: 'city', city, name: fname, word: N.word || 'POLICE', sub: N.sub || up(city), tac: N.tac || `${fname} SWAT`, tacSub: N.tacSub || 'SWAT', air: N.air, station, signSub: up(city) });
}
// the force at a point in the Bay, or null out past its towns (the rest of California)
export function bayForce(lat, lon) {
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	const k = Math.cos(lat * RAD);
	let near = null, nd = 1e9, best = null, bs = 1e9, nb = null, nbd = 2.5;
	for (const P of PLACES) {
		const d = Math.hypot(P[1] - lat, (P[2] - lon) * k) * 111.2;
		if (P[5] || !P[4]) { if (d < nbd) { nbd = d; nb = P; } continue; }
		if (d < nd) { nd = d; near = P; }
		const city = PART_OF[P[0]] || P[0], inc = CITY_SET.has(P[3] + '|' + city);
		// (a few unincorporated places carry a city's name and its numbers from another county)
		if (!inc && CITY_ANY.has(P[0])) continue;
		const s = d / reachKm(inc ? P[4] : Math.min(P[4], 30));
		if (s < bs) { bs = s; best = { P, city, inc }; }
	}
	if (!near || nd > 9) return null;
	if (!best || bs > 2.5 || !best.inc) return sheriffOf((best && bs <= 2.5 ? best.P : near)[3], best && bs <= 2.5 ? best.P[0] : near[0]);
	if (SHERIFF_TOWNS.has(best.city)) return sheriffOf(best.P[3], best.city);
	return cityForce(best.city, nb ? nb[0] : '');
}

// ---------- the United States beyond the Bay ----------
// [state, south, west, north, east, patrol]: the smallest box that holds a point is taken
const STATES = [
	['Alabama', 30.2, -88.5, 35.0, -84.9, 'Alabama State Troopers'], ['Arizona', 31.3, -114.8, 37.0, -109.05, 'Arizona Highway Patrol'],
	['Arkansas', 33.0, -94.6, 36.5, -89.6, 'Arkansas State Police'], ['California', 32.5, -124.5, 42.0, -114.1, 'California Highway Patrol'],
	['Colorado', 37.0, -109.05, 41.0, -102.05, 'Colorado State Patrol'], ['Connecticut', 41.0, -73.73, 42.05, -71.79, 'Connecticut State Police'],
	['Delaware', 38.45, -75.8, 39.84, -75.05, 'Delaware State Police'], ['Florida', 24.5, -87.6, 31.0, -80.0, 'Florida Highway Patrol'],
	['Georgia', 30.36, -85.6, 35.0, -80.8, 'Georgia State Patrol'], ['Idaho', 42.0, -117.24, 49.0, -111.04, 'Idaho State Police'],
	['Illinois', 36.97, -91.5, 42.5, -87.5, 'Illinois State Police'], ['Indiana', 37.77, -88.1, 41.76, -84.78, 'Indiana State Police'],
	['Iowa', 40.38, -96.64, 43.5, -90.14, 'Iowa State Patrol'], ['Kansas', 37.0, -102.05, 40.0, -94.6, 'Kansas Highway Patrol'],
	['Kentucky', 36.5, -89.57, 39.15, -81.96, 'Kentucky State Police'], ['Louisiana', 28.9, -94.04, 33.02, -88.8, 'Louisiana State Police'],
	['Maine', 43.06, -71.08, 47.46, -66.95, 'Maine State Police'], ['Maryland', 37.9, -79.49, 39.72, -75.05, 'Maryland State Police'],
	['Massachusetts', 41.24, -73.5, 42.89, -69.93, 'Massachusetts State Police'], ['Michigan', 41.7, -90.42, 48.3, -82.4, 'Michigan State Police'],
	['Minnesota', 43.5, -97.24, 49.38, -89.5, 'Minnesota State Patrol'], ['Mississippi', 30.17, -91.66, 35.0, -88.1, 'Mississippi Highway Patrol'],
	['Missouri', 35.99, -95.77, 40.61, -89.1, 'Missouri State Highway Patrol'], ['Montana', 44.36, -116.05, 49.0, -104.04, 'Montana Highway Patrol'],
	['Nebraska', 40.0, -104.05, 43.0, -95.31, 'Nebraska State Patrol'], ['Nevada', 35.0, -120.0, 42.0, -114.04, 'Nevada Highway Patrol'],
	['New Hampshire', 42.7, -72.56, 45.31, -70.6, 'New Hampshire State Police'], ['New Jersey', 38.93, -75.56, 41.36, -73.89, 'New Jersey State Police'],
	['New Mexico', 31.33, -109.05, 37.0, -103.0, 'New Mexico State Police'], ['New York', 40.5, -79.76, 45.02, -71.86, 'New York State Police'],
	['North Carolina', 33.84, -84.32, 36.59, -75.46, 'North Carolina State Highway Patrol'], ['North Dakota', 45.94, -104.05, 49.0, -96.55, 'North Dakota Highway Patrol'],
	['Ohio', 38.4, -84.82, 41.98, -80.52, 'Ohio State Highway Patrol'], ['Oklahoma', 33.62, -103.0, 37.0, -94.43, 'Oklahoma Highway Patrol'],
	['Oregon', 41.99, -124.57, 46.29, -116.46, 'Oregon State Police'], ['Pennsylvania', 39.72, -80.52, 42.27, -74.69, 'Pennsylvania State Police'],
	['Rhode Island', 41.15, -71.86, 42.02, -71.12, 'Rhode Island State Police'], ['South Carolina', 32.03, -83.35, 35.22, -78.54, 'South Carolina Highway Patrol'],
	['South Dakota', 42.48, -104.06, 45.94, -96.44, 'South Dakota Highway Patrol'], ['Tennessee', 34.98, -90.31, 36.68, -81.65, 'Tennessee Highway Patrol'],
	['Texas', 25.84, -106.65, 36.5, -93.51, 'Texas Highway Patrol'], ['Utah', 37.0, -114.05, 42.0, -109.04, 'Utah Highway Patrol'],
	['Vermont', 42.73, -73.44, 45.02, -71.46, 'Vermont State Police'], ['Virginia', 36.54, -83.68, 39.47, -75.24, 'Virginia State Police'],
	['Washington', 45.54, -124.85, 49.0, -116.92, 'Washington State Patrol'], ['West Virginia', 37.2, -82.64, 40.64, -77.72, 'West Virginia State Police'],
	['Wisconsin', 42.49, -92.89, 47.31, -86.25, 'Wisconsin State Patrol'], ['Wyoming', 41.0, -111.06, 45.0, -104.05, 'Wyoming Highway Patrol'],
	['Alaska', 51, -180, 71.5, -129.9, 'Alaska State Troopers'], ['Hawaii', 18.9, -160.3, 22.3, -154.8, 'Hawaii Police Department'],
	['the District of Columbia', 38.79, -77.12, 38.995, -76.91, 'Metropolitan Police'],
].sort((a, b) => (a[3] - a[1]) * (a[4] - a[2]) - (b[3] - b[1]) * (b[4] - b[2]));
export function usState(lat, lon) {
	for (const S of STATES) {
		if (lat < S[1] || lat > S[3] || lon < S[2] || lon > S[4]) continue;
		// (California and Nevada share a slanted line south of Lake Tahoe)
		if (S[0] === 'Nevada' && lat < 39 && lon < -120 + (39 - lat) * 1.36) continue;
		return S;
	}
	return null;
}
const US_CITY = {
	'New York': { name: 'NYPD', word: 'NYPD', sub: 'POLICE', officer: 'an NYPD officer', tac: 'NYPD Emergency Service Unit', tacSub: 'EMERGENCY SERVICE', air: 'NYPD', station: 'NYPD precinct' },
	'Los Angeles': { name: 'LAPD', word: 'POLICE', sub: 'LOS ANGELES', officer: 'an LAPD officer', tac: 'LAPD SWAT', air: 'LAPD', station: 'LAPD community station' },
	'Washington, D.C.': { name: 'Metropolitan Police', sub: 'DISTRICT OF COLUMBIA', air: 'MPDC' },
	Washington: { name: 'Metropolitan Police', sub: 'DISTRICT OF COLUMBIA', air: 'MPDC' },
	Honolulu: { name: 'Honolulu Police', air: 'HONOLULU POLICE' },
	'San Juan': { name: 'Policía de Puerto Rico', word: 'POLICÍA', sub: 'PUERTO RICO', shout: 'Policía' },
};
function usForce(lat, lon, city) {
	if (city) {
		const N = US_CITY[city.name] || {};
		return finish({ kind: 'city', city: city.name, name: N.name || `${city.name} Police`, word: N.word || 'POLICE', sub: N.sub ?? up(city.name), officer: N.officer, tac: N.tac || `${N.name || city.name + ' Police'} SWAT`, tacSub: N.tacSub || 'SWAT', air: N.air, shout: N.shout, station: N.station || (/Police$/.test(N.name || 'Police') ? `${N.name || city.name + ' Police'} Department` : `${N.name} station`) });
	}
	const S = usState(lat, lon);
	if (!S) return finish({ kind: 'state', name: 'State Police', word: 'STATE POLICE' });
	const [state, , , , , patrol] = S, rest = patrol.replace(state, '').trim() || 'POLICE';
	return finish({
		kind: 'state', name: patrol, word: up(rest), sub: up(state), officer: /Troopers/.test(patrol) ? `${an(state)} ${state} State Trooper` : `${an(patrol)} ${patrol} officer`,
		shout: /Patrol|Troopers/.test(patrol) ? 'State Patrol' : 'State Police', tac: `${patrol} Special Response Team`, tacSub: 'SPECIAL RESPONSE', air: up(patrol).length < 26 ? up(patrol) : up(rest), station: `${patrol} office`,
	});
}

// ---------- the world: each country's pattern ----------
// N(name, word, more): name for the radio and the tags, the door's word (in the country's own
// script where its cars carry it), and what differs from the plain pattern
const N = (name, word = 'POLICE', o = {}) => ({ name, word, ...o });
const GENDARMERIE = N('Gendarmerie', 'GENDARMERIE', { officer: 'a gendarme', shout: 'Gendarmerie', tac: 'Gendarmerie intervention squad', stationAt: 'Gendarmerie de {t}' });
// country or area -> the force, or (urban, place) => the force
const WORLD = {
	ie: N('Garda', 'GARDA', { full: 'An Garda Síochána', officer: 'a Garda', shout: 'Garda', tac: 'Garda Emergency Response Unit', tacSub: 'EMERGENCY RESPONSE', tacOfficer: 'a Garda ERU officer', air: 'GARDA AIR SUPPORT', stationAt: '{t} Garda Station' }),
	'gb-sct': N('Police Scotland', 'POLICE', { sub: 'SCOTLAND', tac: 'Police Scotland Armed Policing', tacSub: 'ARMED POLICING', air: 'POLICE SCOTLAND' }),
	'gb-nir': N('PSNI', 'POLICE', { full: 'Police Service of Northern Ireland', sub: 'PSNI', officer: 'a PSNI officer', tac: 'PSNI Armed Response', tacSub: 'ARMED RESPONSE', air: 'PSNI' }),
	fr: (u, P) => (u ? N('Police Nationale', 'POLICE', { sub: 'NATIONALE', officer: 'a Police Nationale officer', air: 'POLICE NATIONALE', tac: P.city === 'Paris' ? 'BRI' : 'RAID', tacSub: P.city === 'Paris' ? 'BRI' : 'RAID', tacOfficer: P.city === 'Paris' ? 'a BRI officer' : 'a RAID officer', station: P.city ? `Commissariat de ${P.city}` : '' }) : { ...GENDARMERIE, tac: 'GIGN', tacSub: 'GIGN', tacOfficer: 'a GIGN gendarme', station: P.city ? `Gendarmerie de ${P.city}` : '' }),
	es: (u) => (u ? N('Policía Nacional', 'POLICÍA', { sub: 'NACIONAL', officer: 'a Spanish police officer', shout: 'Policía', tac: 'GEO', tacSub: 'GEO', tacOfficer: 'a GEO officer', stationAt: 'Comisaría de {t}', air: 'POLICÍA' }) : N('Guardia Civil', 'GUARDIA CIVIL', { officer: 'a Guardia Civil officer', shout: 'Guardia Civil', tac: 'GAR', tacSub: 'GAR', tacOfficer: 'a GAR officer', stationAt: 'Guardia Civil, {t}' })),
	'es-ct': N('Mossos d\'Esquadra', 'MOSSOS D\'ESQUADRA', { sub: 'POLICIA', officer: 'a Mosso d\'Esquadra', shout: 'Policia', tac: 'GEI', tacSub: 'GEI', tacOfficer: 'a GEI officer' }),
	'es-pv': N('Ertzaintza', 'ERTZAINTZA', { officer: 'an Ertzaina', shout: 'Ertzaintza', tac: 'Ertzaintza special unit' }),
	pt: (u) => (u ? N('PSP', 'POLÍCIA', { full: 'Polícia de Segurança Pública', sub: 'PSP', officer: 'a PSP officer', shout: 'Polícia', tac: 'GOE', tacSub: 'GOE' }) : N('GNR', 'GNR', { full: 'Guarda Nacional Republicana', sub: 'GUARDA NACIONAL REPUBLICANA', officer: 'a GNR guard', shout: 'GNR', tac: 'GNR special unit' })),
	it: (u) => (u ? N('Polizia di Stato', 'POLIZIA', { officer: 'an Italian police officer', shout: 'Polizia', tac: 'NOCS', tacSub: 'NOCS', tacOfficer: 'a NOCS officer', stationAt: 'Questura di {t}' }) : N('Carabinieri', 'CARABINIERI', { officer: 'a Carabiniere', shout: 'Carabinieri', tac: 'GIS', tacSub: 'GIS', tacOfficer: 'a GIS Carabiniere', stationAt: 'Stazione Carabinieri {t}' })),
	de: N('Polizei', 'POLIZEI', { officer: 'a German police officer', shout: 'Polizei', tac: 'SEK', tacSub: 'SEK', tacOfficer: 'an SEK officer', stationAt: 'Polizeirevier {t}' }),
	at: N('Polizei', 'POLIZEI', { sub: 'ÖSTERREICH', officer: 'an Austrian police officer', shout: 'Polizei', stationAt: 'Polizeiinspektion {t}', tac: 'EKO Cobra', tacSub: 'COBRA', tacOfficer: 'a Cobra officer' }),
	ch: (u, P) => (P.lon < 7.15 ? N('Police cantonale', 'POLICE', { officer: 'a Swiss police officer', shout: 'Police', air: 'POLICE' }) : P.lat < 46.45 && P.lon > 8.4 ? N('Polizia cantonale', 'POLIZIA', { officer: 'a Swiss police officer', shout: 'Polizia' }) : N('Kantonspolizei', 'POLIZEI', { officer: 'a Swiss police officer', shout: 'Polizei', stationAt: 'Polizeiposten {t}' })),
	nl: N('Politie', 'POLITIE', { officer: 'a Dutch police officer', shout: 'Politie', stationAt: 'Politiebureau {t}', tac: 'DSI', tacSub: 'DSI', tacOfficer: 'a DSI officer' }),
	be: N('Belgian Police', 'POLICE', { sub: 'POLITIE', officer: 'a Belgian police officer', tac: 'CGSU', tacSub: 'CGSU', air: 'POLICE' }),
	se: N('Polisen', 'POLIS', { officer: 'a Swedish police officer', shout: 'Polis', tac: 'Nationella insatsstyrkan', tacSub: 'NI' }),
	no: N('Politiet', 'POLITI', { officer: 'a Norwegian police officer', shout: 'Politi', tac: 'Beredskapstroppen', tacSub: 'BEREDSKAPSTROPPEN' }),
	dk: N('Politiet', 'POLITI', { officer: 'a Danish police officer', shout: 'Politi', tac: 'Politiets Aktionsstyrke', tacSub: 'AKS' }),
	fi: N('Poliisi', 'POLIISI', { sub: 'POLIS', officer: 'a Finnish police officer', shout: 'Poliisi', tac: 'Karhu', tacSub: 'KARHU' }),
	is: N('Lögreglan', 'LÖGREGLAN', { sub: 'POLICE', officer: 'an Icelandic police officer', shout: 'Lögreglan', tac: 'Víkingasveitin', tacSub: 'SÉRSVEIT' }),
	gl: N('Greenland Police', 'POLITI', { sub: 'POLITIIT' }),
	pl: N('Policja', 'POLICJA', { officer: 'a Polish police officer', shout: 'Policja', tac: 'BOA', tacSub: 'BOA' }),
	cz: N('Policie', 'POLICIE', { officer: 'a Czech police officer', shout: 'Policie', tac: 'URNA', tacSub: 'URNA' }),
	hu: N('Rendőrség', 'RENDŐRSÉG', { sub: 'POLICE', officer: 'a Hungarian police officer', shout: 'Rendőrség', tac: 'TEK', tacSub: 'TEK' }),
	ro: N('Poliția Română', 'POLIȚIA', { officer: 'a Romanian police officer', shout: 'Poliția' }),
	md: N('Poliția Moldovei', 'POLIȚIA', { officer: 'a Moldovan police officer', shout: 'Poliția' }),
	bg: N('Bulgarian Police', 'ПОЛИЦИЯ', { sub: 'POLICE', shout: 'Politsiya' }),
	rs: N('Serbian Police', 'ПОЛИЦИЈА', { sub: 'POLICIJA', shout: 'Policija' }),
	hr: N('Policija', 'POLICIJA', { officer: 'a Croatian police officer', shout: 'Policija' }),
	si: N('Policija', 'POLICIJA', { officer: 'a Slovenian police officer', shout: 'Policija' }),
	ba: N('Policija', 'POLICIJA', { officer: 'a Bosnian police officer', shout: 'Policija' }),
	al: N('Policia e Shtetit', 'POLICIA', { officer: 'an Albanian police officer', shout: 'Policia' }),
	gr: N('Hellenic Police', 'ΑΣΤΥΝΟΜΙΑ', { sub: 'POLICE', shout: 'Astynomia' }),
	cy: N('Cyprus Police', 'ΑΣΤΥΝΟΜΙΑ', { sub: 'POLICE' }),
	mt: N('Malta Police', 'PULIZIJA', { sub: 'POLICE' }),
	ru: N('Politsiya', 'ПОЛИЦИЯ', { full: 'Russian Police', sub: 'POLICE', officer: 'a Russian police officer', shout: 'Politsiya', tac: 'OMON', tacSub: 'ОМОН', tacOfficer: 'an OMON officer' }),
	ua: N('National Police of Ukraine', 'ПОЛІЦІЯ', { sub: 'POLICE', officer: 'a Ukrainian police officer', shout: 'Politsiia', tac: 'KORD', tacSub: 'КОРД' }),
	ee: N('Politsei', 'POLITSEI', { officer: 'an Estonian police officer', shout: 'Politsei' }),
	lv: N('Valsts policija', 'POLICIJA', { officer: 'a Latvian police officer', shout: 'Policija' }),
	lt: N('Lietuvos policija', 'POLICIJA', { officer: 'a Lithuanian police officer', shout: 'Policija' }),
	tr: (u) => (u ? N('Polis', 'POLİS', { full: 'Turkish National Police', officer: 'a Turkish police officer', shout: 'Polis', tac: 'Özel Harekât', tacSub: 'ÖZEL HAREKÂT', tacOfficer: 'an Özel Harekât officer' }) : N('Jandarma', 'JANDARMA', { officer: 'a Jandarma soldier', shout: 'Jandarma' })),
	ge: N('Patrol Police', 'პოლიცია', { sub: 'POLICE', officer: 'a Georgian police officer' }),
	am: N('Police of Armenia', 'ՈՍՏԻԿԱՆՈՒԹՅՈՒՆ', { sub: 'POLICE', officer: 'an Armenian police officer' }),
	az: N('Polis', 'POLİS', { full: 'Azerbaijani Police', officer: 'an Azerbaijani police officer', shout: 'Polis' }),
	kz: N('Kazakh Police', 'ПОЛИЦИЯ', { sub: 'POLICE' }),
	uz: N('Uzbek Police', 'POLITSIYA', { sub: 'POLICE' }),
	kg: N('Militsiya', 'МИЛИЦИЯ', { officer: 'a Militsiya officer', shout: 'Militsiya' }),
	tm: N('Turkmen Police', 'POLISIÝA', { sub: 'POLICE' }),
	mn: N('Mongolian Police', 'ЦАГДАА', { sub: 'POLICE' }),
	cn: (u, P) => N(P.city ? `${P.city} Public Security` : 'Public Security', '公安', { full: 'Public Security Bureau', sub: 'POLICE', officer: 'a Gong\'an officer', shout: 'Gong\'an', tac: 'SWAT', tacWord: '特警', tacSub: 'SWAT', air: '公安 POLICE' }),
	hk: N('Hong Kong Police', 'POLICE', { sub: '警察', tac: 'Special Duties Unit', tacSub: 'SDU', air: 'GFS POLICE' }),
	mo: N('Macau Public Security Police', 'POLÍCIA', { sub: '治安警察', shout: 'Polícia' }),
	tw: N('Taiwan Police', '警察', { sub: 'POLICE', officer: 'a Taiwanese police officer' }),
	kr: (u, P) => N(P.city === 'Seoul' || P.city === 'Busan' ? `${P.city} Metropolitan Police` : 'Korean National Police', '경찰', { sub: 'POLICE', officer: 'a Korean police officer', shout: 'Gyeongchal', tac: 'SWAT', tacWord: '경찰특공대', tacSub: 'SWAT', air: '경찰 POLICE' }),
	kp: N('Social Security', '사회안전', { officer: 'a Social Security officer' }),
	jp: N('Prefectural Police', '警察', { sub: 'POLICE', officer: 'a Japanese police officer', shout: 'Keisatsu', tac: 'SAT', tacWord: '警察', tacSub: 'SAT', air: '警察' }),
	in: N('Police', 'POLICE', { officer: 'an Indian police officer' }),
	bd: N('Bangladesh Police', 'POLICE', { sub: 'পুলিশ' }),
	np: N('Nepal Police', 'NEPAL POLICE', { sub: 'नेपाल प्रहरी' }),
	bt: N('Royal Bhutan Police', 'POLICE', { sub: 'BHUTAN' }),
	lk: N('Sri Lanka Police', 'POLICE', { sub: 'පොලිසිය' }),
	pk: N('Pakistan Police', 'POLICE', { sub: 'پولیس' }),
	af: N('Afghan Police', 'POLICE', { sub: 'پولیس' }),
	ir: N('Iranian Police', 'پلیس', { sub: 'POLICE', officer: 'an Iranian police officer' }),
	iq: N('Iraqi Police', 'الشرطة', { sub: 'POLICE', officer: 'an Iraqi police officer' }),
	sy: N('Syrian Police', 'الشرطة', { sub: 'POLICE' }),
	lb: N('Internal Security Forces', 'قوى الأمن الداخلي', { sub: 'ISF', officer: 'an ISF officer' }),
	jo: N('Jordan Police', 'الأمن العام', { sub: 'POLICE', officer: 'a Jordanian police officer' }),
	il: N('Israel Police', 'משטרה', { sub: 'POLICE', officer: 'an Israel Police officer', tac: 'Yamam', tacSub: 'YAMAM' }),
	ps: N('Palestinian Civil Police', 'الشرطة', { sub: 'POLICE' }),
	sa: N('Saudi Police', 'الشرطة', { sub: 'POLICE', officer: 'a Saudi police officer' }),
	ae: (u, P) => (/Abu Dhabi/.test(P.city) ? N('Abu Dhabi Police', 'ABU DHABI POLICE', { sub: 'شرطة أبوظبي' }) : N('Dubai Police', 'DUBAI POLICE', { sub: 'شرطة دبي' })),
	qa: N('Qatar Police', 'POLICE', { sub: 'الشرطة' }),
	bh: N('Bahrain Police', 'POLICE', { sub: 'الشرطة' }),
	kw: N('Kuwait Police', 'POLICE', { sub: 'الشرطة' }),
	om: N('Royal Oman Police', 'POLICE', { sub: 'شرطة عمان السلطانية' }),
	ye: N('Yemeni Police', 'الشرطة', { sub: 'POLICE' }),
	eg: N('Egyptian Police', 'الشرطة', { sub: 'POLICE', officer: 'an Egyptian police officer' }),
	ly: N('Libyan Police', 'الشرطة', { sub: 'POLICE' }),
	sd: N('Sudan Police', 'الشرطة', { sub: 'POLICE' }),
	ma: (u) => (u ? N('Sûreté Nationale', 'POLICE', { sub: 'الشرطة', officer: 'a Moroccan police officer' }) : N('Gendarmerie Royale', 'GENDARMERIE ROYALE', { officer: 'a Royal Gendarmerie officer', shout: 'Gendarmerie' })),
	dz: (u) => (u ? N('Sûreté Nationale', 'POLICE', { sub: 'الشرطة', officer: 'an Algerian police officer' }) : N('Gendarmerie Nationale', 'GENDARMERIE', { officer: 'a gendarme', shout: 'Gendarmerie' })),
	tn: (u) => (u ? N('Tunisian Police', 'POLICE', { sub: 'الشرطة' }) : N('Garde Nationale', 'GARDE NATIONALE', { officer: 'a National Guard officer' })),
	francophone: (u) => (u ? N('Police Nationale', 'POLICE', { sub: 'NATIONALE', officer: 'a Police Nationale officer' }) : GENDARMERIE),
	ng: N('Nigeria Police', 'POLICE', { full: 'Nigeria Police Force', sub: 'NIGERIA', tac: 'Nigeria Police Mobile Force', tacSub: 'MOBILE POLICE' }),
	gh: N('Ghana Police', 'POLICE', { full: 'Ghana Police Service', sub: 'GHANA' }),
	et: N('Ethiopian Federal Police', 'ፖሊስ', { sub: 'POLICE' }),
	so: N('Somali Police', 'POLICE', { sub: 'BOOLISKA' }),
	ke: N('Kenya Police', 'POLICE', { full: 'Kenya Police Service', sub: 'KENYA', tac: 'GSU', tacSub: 'GSU' }),
	tz: N('Tanzania Police', 'POLISI', { full: 'Tanzania Police Force', sub: 'TANZANIA', shout: 'Polisi' }),
	ug: N('Uganda Police', 'POLICE', { sub: 'UGANDA' }),
	rw: N('Rwanda National Police', 'POLICE', { sub: 'RNP' }),
	cd: N('Police Nationale Congolaise', 'POLICE', { sub: 'PNC' }),
	za: N('SAPS', 'POLICE', { full: 'South African Police Service', sub: 'SAPS', air: 'SAPS', officer: 'a SAPS officer', tac: 'SAPS Special Task Force', tacSub: 'STF' }),
	na: N('Namibian Police', 'POLICE', { sub: 'NAMPOL' }),
	bw: N('Botswana Police', 'POLICE', { sub: 'BOTSWANA' }),
	zw: N('Zimbabwe Republic Police', 'POLICE', { sub: 'ZRP' }),
	zm: N('Zambia Police', 'POLICE', { sub: 'ZAMBIA' }),
	mw: N('Malawi Police', 'POLICE', { sub: 'MALAWI' }),
	mz: N('PRM', 'POLÍCIA', { full: 'Polícia da República de Moçambique', sub: 'PRM', officer: 'a PRM officer', shout: 'Polícia' }),
	mg: (u) => (u ? N('Police Nationale', 'POLISY', { sub: 'POLICE' }) : GENDARMERIE),
	cv: N('Polícia Nacional', 'POLÍCIA', { sub: 'NACIONAL', shout: 'Polícia' }),
	ca: (u, P) => {
		if (u && (P.city === 'Montréal' || P.city === 'Montreal')) return N('SPVM', 'POLICE', { full: 'Service de police de la Ville de Montréal', sub: 'MONTRÉAL', officer: 'an SPVM officer' });
		if (u) return N(`${P.city} Police`, 'POLICE', { sub: up(P.city), station: `${P.city} Police Service` });
		if (P.prov === 'qc') return N('Sûreté du Québec', 'SÛRETÉ DU QUÉBEC', { sub: 'POLICE', officer: 'a Sûreté du Québec officer' });
		if (P.prov === 'on') return N('OPP', 'OPP', { full: 'Ontario Provincial Police', sub: 'POLICE', officer: 'an OPP officer', tac: 'OPP Tactics and Rescue Unit', tacSub: 'TRU' });
		return N('RCMP', 'RCMP', { full: 'Royal Canadian Mounted Police', sub: 'GRC', officer: 'an RCMP officer', tac: 'RCMP Emergency Response Team', tacSub: 'ERT' });
	},
	mx: (u, P) => (P.city === 'Mexico City' || P.city === 'Ciudad de México' ? N('Policía de la Ciudad', 'POLICÍA', { sub: 'CIUDAD DE MÉXICO', shout: 'Policía' }) : u ? N(`Policía Municipal de ${P.city}`, 'POLICÍA', { sub: up(P.city), officer: 'a municipal police officer', shout: 'Policía' }) : N('Guardia Nacional', 'GUARDIA NACIONAL', { officer: 'a Guardia Nacional officer', shout: 'Guardia Nacional' })),
	cr: N('Fuerza Pública', 'FUERZA PÚBLICA', { officer: 'a Fuerza Pública officer', shout: 'Policía' }),
	bz: N('Belize Police', 'POLICE', { sub: 'BELIZE' }),
	latam: N('Policía Nacional', 'POLICÍA', { sub: 'NACIONAL', shout: 'Policía' }),
	cu: N('PNR', 'POLICÍA', { full: 'Policía Nacional Revolucionaria', sub: 'PNR', officer: 'a PNR officer', shout: 'Policía' }),
	jm: N('Jamaica Constabulary', 'POLICE', { full: 'Jamaica Constabulary Force', sub: 'JCF', air: 'JCF', officer: 'a JCF constable' }),
	ht: N('Police Nationale d\'Haïti', 'POLICE', { sub: 'PNH', officer: 'a PNH officer' }),
	do: N('Policía Nacional', 'POLICÍA', { sub: 'NACIONAL', officer: 'a Dominican police officer', shout: 'Policía' }),
	pr: N('Policía de Puerto Rico', 'POLICÍA', { sub: 'PUERTO RICO', shout: 'Policía' }),
	tt: N('Trinidad and Tobago Police', 'POLICE', { sub: 'TTPS' }),
	bs: N('Royal Bahamas Police', 'POLICE', { sub: 'RBPF' }),
	bm: N('Bermuda Police', 'POLICE', { sub: 'BERMUDA' }),
	aw: N('Korps Politie Aruba', 'POLITIE', { sub: 'ARUBA', shout: 'Politie' }),
	cw: N('Korps Politie Curaçao', 'POLITIE', { sub: 'KÒRSOU', shout: 'Politie' }),
	'fr-carib': GENDARMERIE,
	carib: N('Royal Police Force', 'POLICE'),
	br: (u, P) => N(P.state ? `Polícia Militar ${P.state}` : 'Polícia Militar', 'POLÍCIA MILITAR', { sub: P.state ? up(P.state.replace(/^d[aoe] (Estado de )?/, '')) : '', officer: 'a Polícia Militar officer', air: 'POLÍCIA MILITAR', shout: 'Polícia', tac: 'BOPE', tacSub: 'BOPE', tacOfficer: 'a BOPE officer' }),
	ar: (u, P) => (P.city === 'Buenos Aires' ? N('Policía de la Ciudad', 'POLICÍA', { sub: 'BUENOS AIRES', officer: 'a Buenos Aires police officer', shout: 'Policía' }) : N('Policía Provincial', 'POLICÍA', { officer: 'an Argentine police officer', shout: 'Policía' })),
	cl: N('Carabineros', 'CARABINEROS', { sub: 'DE CHILE', full: 'Carabineros de Chile', officer: 'a Carabinero', shout: 'Carabineros', tac: 'GOPE', tacSub: 'GOPE' }),
	co: N('Policía Nacional', 'POLICÍA', { sub: 'COLOMBIA', full: 'Policía Nacional de Colombia', officer: 'a Colombian police officer', shout: 'Policía' }),
	pe: N('PNP', 'POLICÍA', { full: 'Policía Nacional del Perú', sub: 'PNP', officer: 'a PNP officer', shout: 'Policía' }),
	bo: N('Policía Boliviana', 'POLICÍA', { sub: 'BOLIVIA', shout: 'Policía' }),
	ec: N('Policía Nacional', 'POLICÍA', { sub: 'ECUADOR', officer: 'an Ecuadorian police officer', shout: 'Policía' }),
	uy: N('Policía Nacional', 'POLICÍA', { sub: 'URUGUAY', officer: 'a Uruguayan police officer', shout: 'Policía' }),
	py: N('Policía Nacional', 'POLICÍA', { sub: 'PARAGUAY', officer: 'a Paraguayan police officer', shout: 'Policía' }),
	gy: N('Guyana Police', 'POLICE', { full: 'Guyana Police Force', sub: 'GUYANA' }),
	sr: N('Korps Politie Suriname', 'POLITIE', { sub: 'SURINAME', shout: 'Politie' }),
	ve: N('PNB', 'PNB', { full: 'Policía Nacional Bolivariana', sub: 'POLICÍA', officer: 'a PNB officer', shout: 'Policía' }),
	nz: N('New Zealand Police', 'POLICE', { sub: 'PIRIHIMANA', air: 'POLICE', tac: 'Armed Offenders Squad', tacSub: 'AOS' }),
	pg: N('Royal PNG Constabulary', 'POLICE', { sub: 'RPNGC' }),
	fj: N('Fiji Police', 'POLICE', { sub: 'FIJI' }),
	ws: N('Samoa Police', 'POLICE', { sub: 'LEOLEO' }),
	to: N('Tonga Police', 'POLICE', { sub: 'POLISI' }),
	pf: GENDARMERIE,
	vn: N('Công an', 'CÔNG AN', { full: 'Vietnam People\'s Public Security', sub: 'POLICE', officer: 'a Công an officer', shout: 'Công an' }),
	th: N('Royal Thai Police', 'ตำรวจ', { sub: 'POLICE', officer: 'a Thai police officer', shout: 'Tamruat' }),
	kh: N('Cambodian National Police', 'POLICE', { sub: 'នគរបាល' }),
	la: N('Lao Police', 'POLICE', { sub: 'ຕຳຫຼວດ' }),
	mm: N('Myanmar Police', 'POLICE', { sub: 'ရဲ' }),
	my: N('Royal Malaysia Police', 'POLIS', { sub: 'PDRM', officer: 'a PDRM officer', shout: 'Polis' }),
	bn: N('Royal Brunei Police', 'POLIS', { sub: 'BRUNEI', shout: 'Polis' }),
	sg: N('Singapore Police', 'POLICE', { full: 'Singapore Police Force', sub: 'SINGAPORE', tac: 'Special Tactics and Rescue', tacSub: 'STAR' }),
	id: N('Polri', 'POLISI', { full: 'Indonesian National Police', officer: 'a Polri officer', shout: 'Polisi', tac: 'Brimob', tacSub: 'BRIMOB' }),
	ph: N('Philippine National Police', 'POLICE', { sub: 'PNP', air: 'PNP', officer: 'a PNP officer', tac: 'PNP SAF', tacSub: 'SAF' }),
};
// England and Wales: the territorial forces, each by a point in its ground (the nearest is taken)
const UK_FORCES = [
	['Metropolitan Police', 51.507, -0.128, 'METROPOLITAN'], ['Thames Valley Police', 51.65, -1.1, 'THAMES VALLEY'], ['Surrey Police', 51.25, -0.45, 'SURREY'],
	['Sussex Police', 50.93, -0.25, 'SUSSEX'], ['Kent Police', 51.2, 0.75, 'KENT'], ['Essex Police', 51.8, 0.6, 'ESSEX'], ['Hertfordshire Constabulary', 51.82, -0.2, 'HERTFORDSHIRE'],
	['Bedfordshire Police', 52.1, -0.45, 'BEDFORDSHIRE'], ['Cambridgeshire Constabulary', 52.35, 0.05, 'CAMBRIDGESHIRE'], ['Norfolk Constabulary', 52.65, 1.0, 'NORFOLK'],
	['Suffolk Constabulary', 52.2, 1.05, 'SUFFOLK'], ['Hampshire Constabulary', 51.0, -1.25, 'HAMPSHIRE'], ['Dorset Police', 50.75, -2.3, 'DORSET'],
	['Wiltshire Police', 51.3, -1.9, 'WILTSHIRE'], ['Avon and Somerset Police', 51.3, -2.7, 'AVON AND SOMERSET'], ['Devon and Cornwall Police', 50.5, -4.2, 'DEVON AND CORNWALL'],
	['Gloucestershire Constabulary', 51.85, -2.2, 'GLOUCESTERSHIRE'], ['West Mercia Police', 52.35, -2.65, 'WEST MERCIA'], ['West Midlands Police', 52.48, -1.9, 'WEST MIDLANDS'],
	['Warwickshire Police', 52.28, -1.55, 'WARWICKSHIRE'], ['Leicestershire Police', 52.65, -1.1, 'LEICESTERSHIRE'], ['Northamptonshire Police', 52.28, -0.88, 'NORTHAMPTONSHIRE'],
	['Nottinghamshire Police', 53.1, -1.05, 'NOTTINGHAMSHIRE'], ['Derbyshire Constabulary', 53.1, -1.6, 'DERBYSHIRE'], ['Lincolnshire Police', 53.1, -0.3, 'LINCOLNSHIRE'],
	['Staffordshire Police', 52.82, -2.05, 'STAFFORDSHIRE'], ['Cheshire Constabulary', 53.2, -2.6, 'CHESHIRE'], ['Merseyside Police', 53.42, -2.95, 'MERSEYSIDE'],
	['Greater Manchester Police', 53.48, -2.24, 'GREATER MANCHESTER'], ['Lancashire Constabulary', 53.85, -2.6, 'LANCASHIRE'], ['Cumbria Constabulary', 54.6, -3.0, 'CUMBRIA'],
	['West Yorkshire Police', 53.75, -1.62, 'WEST YORKSHIRE'], ['South Yorkshire Police', 53.45, -1.35, 'SOUTH YORKSHIRE'], ['North Yorkshire Police', 54.1, -1.2, 'NORTH YORKSHIRE'],
	['Humberside Police', 53.75, -0.4, 'HUMBERSIDE'], ['Cleveland Police', 54.57, -1.2, 'CLEVELAND'], ['Durham Constabulary', 54.72, -1.7, 'DURHAM'],
	['Northumbria Police', 55.05, -1.65, 'NORTHUMBRIA'], ['South Wales Police', 51.55, -3.45, 'SOUTH WALES'], ['Gwent Police', 51.68, -3.0, 'GWENT'],
	['Dyfed-Powys Police', 52.15, -3.95, 'DYFED-POWYS'], ['North Wales Police', 53.1, -3.65, 'NORTH WALES'],
];
function ukForce(lat, lon) {
	let best = UK_FORCES[0], bd = 1e9;
	for (const F of UK_FORCES) { const d = kmBetween(lat, lon, F[1], F[2]); if (d < bd) { bd = d; best = F; } }
	return N(best[0], 'POLICE', { sub: best[3], tac: `${best[0]} Armed Response`, tacSub: 'ARMED RESPONSE', air: 'POLICE' });
}
// Germany: the Land's own police
const DE_LAND = { berlin: 'Berlin', bavaria: 'Bayern', rhine: 'NRW' };
const DE_CITY = { Hamburg: 'Hamburg', Bremen: 'Bremen', Hanover: 'Niedersachsen', Hannover: 'Niedersachsen', Kiel: 'Schleswig-Holstein', Lübeck: 'Schleswig-Holstein', Rostock: 'Mecklenburg-Vorpommern', Dresden: 'Sachsen', Leipzig: 'Sachsen', Stuttgart: 'Baden-Württemberg', Freiburg: 'Baden-Württemberg', Heidelberg: 'Baden-Württemberg', Frankfurt: 'Hessen', Mainz: 'Rheinland-Pfalz', Trier: 'Rheinland-Pfalz', Munich: 'Bayern', München: 'Bayern', Nuremberg: 'Bayern', Cologne: 'NRW', Köln: 'NRW', Düsseldorf: 'NRW', Dortmund: 'NRW', Essen: 'NRW', Potsdam: 'Brandenburg', Erfurt: 'Thüringen', Magdeburg: 'Sachsen-Anhalt' };
// Australia: the state police by state
function auState(lat, lon) {
	if (lat < -39.4) return ['Tasmania Police', 'TASMANIA'];
	if (lat > -35.95 && lat < -35.1 && lon > 148.75 && lon < 149.4) return ['ACT Policing', 'ACT'];
	if (lon < 129) return ['WA Police', 'WESTERN AUSTRALIA'];
	if (lon < 138 && lat > -26) return ['NT Police', 'NORTHERN TERRITORY'];
	if (lon < 141) return ['SA Police', 'SOUTH AUSTRALIA'];
	if (lat > -29 || (lat > -28.2 && lon > 153)) return ['Queensland Police', 'QUEENSLAND'];
	if (lat < -34 && lon < 150 && lat < -36 + (lon - 141) * 0.12) return ['Victoria Police', 'VICTORIA'];
	return ['NSW Police', 'NEW SOUTH WALES'];
}
// India: the metros' own city police, else the state's
const IN_CITY = { Mumbai: 'Mumbai Police', Delhi: 'Delhi Police', 'New Delhi': 'Delhi Police', Kolkata: 'Kolkata Police', Chennai: 'Greater Chennai Police', Bengaluru: 'Bengaluru City Police', Bangalore: 'Bengaluru City Police', Hyderabad: 'Hyderabad City Police', Pune: 'Pune City Police', Ahmedabad: 'Ahmedabad City Police' };
const IN_STATE = { delhi: 'Delhi', punjab: 'Punjab', rajasthan: 'Rajasthan', gangetic: 'Uttar Pradesh', mumbai: 'Maharashtra', gujarat: 'Gujarat', deccan: 'Maharashtra', kerala: 'Kerala', tamil: 'Tamil Nadu', bengal: 'West Bengal', northeast: 'Assam', goa: 'Goa', ladakh: 'Ladakh' };
const BR_STATE = [['do Rio de Janeiro', -23.4, -44.9, -20.7, -40.9], ['do Estado de São Paulo', -25.4, -53.2, -19.7, -44.1], ['de Minas Gerais', -22.9, -51.1, -14.2, -39.8], ['da Bahia', -18.4, -46.7, -8.5, -37.3], ['do Amazonas', -9.9, -73.8, 2.3, -56.1], ['do Pará', -9.9, -58.9, 2.6, -46.0], ['de Pernambuco', -9.5, -41.4, -7.3, -34.8], ['do Rio Grande do Sul', -33.8, -57.7, -27.1, -49.7], ['do Paraná', -26.7, -54.6, -22.5, -48.0], ['de Santa Catarina', -29.4, -53.9, -25.9, -48.3], ['do Distrito Federal', -16.1, -48.3, -15.5, -47.3], ['do Ceará', -7.9, -41.5, -2.8, -37.2]].sort((a, b) => (a[3] - a[1]) * (a[4] - a[2]) - (b[3] - b[1]) * (b[4] - b[2]));

const inBox = (lat, lon, s, w, n, e) => lat >= s && lat <= n && lon >= w && lon <= e;
function inPoly(lat, lon, pts) {
	let inside = false;
	for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
		const [xi, yi] = pts[i], [xj, yj] = pts[j];
		if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}
// the border with Canada east of the 49th parallel, through the lakes and down the St Lawrence
// to the Bay of Fundy ([lon, lat], closed round the north)
const CANADA_EAST = [[-95.15, 49.0], [-89.6, 48.0], [-88.4, 48.3], [-84.8, 46.9], [-84.1, 46.5], [-83.5, 46.1], [-82.4, 45.0], [-82.4, 43.0], [-83.0, 42.33], [-83.13, 42.05], [-82.5, 41.7], [-81.0, 42.25], [-79.05, 42.85], [-79.05, 43.6], [-76.4, 44.2], [-75.0, 44.95], [-74.7, 45.0], [-71.5, 45.0], [-71.1, 45.3], [-70.3, 45.9], [-70.0, 46.7], [-69.2, 47.45], [-68.3, 47.35], [-67.8, 47.07], [-67.8, 45.7], [-67.4, 45.15], [-66.9, 44.8], [-60, 43.0], [-50, 45], [-50, 75], [-95.15, 75]];
export function inCanada(lat, lon) {
	if (lon < -141 || lat < 41.6) return false;
	if (lon < -95.15) return lat >= 49.0 || (lon < -123.0 && lon > -125.8 && lat > 48.3);
	return inPoly(lat, lon, CANADA_EAST);
}
// south of the line with Mexico (the land border, then the Rio Grande)
export function inMexico(lat, lon) {
	if (lat > 32.75 || lon < -117.2 || lon > -86.5 || lat < 14.4) return false;
	const b = lon < -114.72 ? 32.534 + (lon + 117.12) * 0.079 : lon < -111.07 ? 32.49 - (lon + 114.81) * 0.31 : lon < -108.21 ? 31.33 : lon < -106.53 ? 31.78 : lon < -97.2 ? 31.745 - (lon + 106.5) * 0.62 : 25.9;
	return lat < b;
}
// the country (or area) at a point: the atlas region's id first, its finer parts by box
export function countryAt(lat, lon, rid = '') {
	const r = rid || '';
	const has = (p) => r === p || r.startsWith(p + '.');
	// (the atlas's boxes overlap at the borders: the lines decide there)
	if (has('na.can') || has('na.ny') || has('na.ne') || has('na.mw') || has('na.pnw') || has('na.rockies') || has('na.plains')) { if (inCanada(lat, lon)) return 'ca'; if (has('na.can')) return usState(lat, lon) ? 'us' : 'ca'; }
	if (has('na.mx') || has('na.cal') || has('na.sw') || has('na.tx')) { if (inMexico(lat, lon)) return 'mx'; if (has('na.mx')) return usState(lat, lon) ? 'us' : 'mx'; }
	if (has('na.cam')) return inBox(lat, lon, 8.0, -86, 11.25, -82.55) ? 'cr' : inBox(lat, lon, 15.9, -89.25, 18.5, -87.5) ? 'bz' : 'latam';
	if (has('atl.carib.pr')) return 'pr';
	if (has('na') || has('na.ak') || has('na.hi')) return 'us';
	if (has('atl.bermuda')) return 'bm';
	if (has('atl.azores') || has('atl.madeira')) return 'pt';
	if (has('atl.canaries')) return 'es';
	if (has('atl.capeverde')) return 'cv';
	if (has('atl.iceland')) return 'is';
	if (has('atl.greenland')) return 'gl';
	if (has('atl.carib.cuba')) return 'cu';
	if (has('atl.carib.jamaica')) return 'jm';
	if (has('atl.carib.haiti')) return 'ht';
	if (has('atl.carib.dr')) return 'do';
	if (has('atl.carib.trinidad')) return 'tt';
	if (has('atl.carib.bahamas')) return 'bs';
	if (has('atl.carib.abc')) return lon < -69.6 ? 'aw' : 'cw';
	if (has('atl.carib')) return inBox(lat, lon, 14.3, -61.9, 16.6, -60.8) ? 'fr-carib' : 'carib';
	if (has('eu.ie.north')) return 'gb-nir';
	if (has('eu.ie')) return 'ie';
	if (has('eu.uk.scotland')) return 'gb-sct';
	if (has('eu.uk')) return lat > 55.8 || (lat > 54.95 && lon < -3.1) ? 'gb-sct' : 'gb';
	if (has('eu.es.catalonia')) return 'es-ct';
	if (has('eu.es')) return inBox(lat, lon, 42.45, -3.45, 43.45, -1.7) ? 'es-pv' : inBox(lat, lon, 40.5, 0.15, 42.9, 3.35) ? 'es-ct' : 'es';
	if (has('eu.pt')) return 'pt';
	if (has('eu.fr')) return 'fr';
	if (has('eu.low.be')) return 'be';
	if (has('eu.low')) return lat < 51.37 ? 'be' : 'nl';
	if (has('eu.alps.ch')) return 'ch';
	if (has('eu.alps.tyrol')) return lat > 47.58 ? 'de' : 'at';
	if (has('eu.alps.dolomites') || has('eu.it')) return 'it';
	if (has('eu.alps.chamonix')) return 'fr';
	if (has('eu.alps')) return lon < 6.9 ? 'fr' : lat < 46.0 ? 'it' : lon > 9.6 ? 'at' : 'ch';
	if (has('eu.de')) return 'de';
	if (has('eu.central.vienna')) return 'at';
	if (has('eu.central.cz')) return 'cz';
	if (has('eu.central.pl')) return 'pl';
	if (has('eu.central.hu')) return 'hu';
	if (has('eu.central')) return lat > 49.0 ? (lat > 50.3 || lon > 18.9 ? 'pl' : 'cz') : lon > 16.1 ? 'hu' : 'at';
	if (has('eu.east.ru') || has('as.ru')) return 'ru';
	if (has('eu.east.ua')) return 'ua';
	if (has('eu.east.baltics')) return lat > 57.55 ? 'ee' : lat > 56.4 ? 'lv' : 'lt';
	if (has('eu.east.ro')) return lon > 27.0 && lat > 45.5 && lon < 30.2 && lat < 48.5 && lon > 26.6 + (lat - 45.4) * 0.12 ? 'md' : 'ro';
	if (has('eu.east')) return lat > 51.5 ? 'ru' : 'ua';
	if (has('eu.balkans.dalmatia')) return 'hr';
	if (has('eu.balkans.bosnia')) return 'ba';
	if (has('eu.balkans.rs')) return 'rs';
	if (has('eu.balkans.bg')) return 'bg';
	if (has('eu.balkans.al')) return 'al';
	if (has('eu.balkans.si')) return 'si';
	if (has('eu.balkans')) return lon > 22.4 ? 'bg' : lat > 45.4 ? 'hr' : 'rs';
	if (has('eu.gr')) return 'gr';
	if (has('eu.nordic.no') || has('eu.nordic.svalbard')) return 'no';
	if (has('eu.nordic.dk')) return 'dk';
	if (has('eu.nordic.fi')) return 'fi';
	if (has('eu.nordic.lapland')) return lon > 23.9 ? 'fi' : lon < 16 || lat > 69.1 ? 'no' : 'se';
	if (has('eu.nordic')) return lon > 21.5 && lat > 59.7 ? 'fi' : 'se';
	if (has('eu.malta')) return 'mt';
	if (has('eu.cyprus')) return 'cy';
	if (has('af.maghreb.ma')) return 'ma';
	if (has('af.maghreb.dz')) return 'dz';
	if (has('af.maghreb.tn')) return 'tn';
	if (has('af.maghreb')) return lon < -1.7 ? 'ma' : lon > 8.3 ? 'tn' : 'dz';
	if (has('af.sahara.libya')) return 'ly';
	if (has('af.egypt')) return 'eg';
	if (has('af.sudan')) return 'sd';
	if (has('af.sahara')) return lon > 25 ? 'eg' : lon > 9.5 && lat > 23 ? 'ly' : 'francophone';
	if (has('af.west.ng') || has('af.west.hausa')) return lat < 13.7 ? 'ng' : 'francophone';
	if (has('af.west.gh')) return 'gh';
	if (has('af.west')) return lon > 2.7 && lon < 14.7 && lat < 13.9 && lat > 4.2 && lon > 3.5 - (lat - 6) * 0.1 ? 'ng' : lon > -3.25 && lon < 1.2 && lat < 11.2 ? 'gh' : 'francophone';
	if (has('af.horn.so')) return 'so';
	if (has('af.horn')) return lon > 43.5 && lat < 11.5 && lat > -1.7 ? 'so' : 'et';
	if (has('af.east.lakes')) return lat < -1.05 ? 'rw' : 'ug';
	if (has('af.east')) return lat < -1 - (lon - 34) * 0.71 ? 'tz' : 'ke';
	if (has('af.congo')) return 'cd';
	if (has('af.south.moz')) return 'mz';
	if (has('af.south.zambezi')) return lon > 32.7 && lat > -17.2 ? 'mw' : lat < -15.9 && lon > 25.2 && !(lat > -17.8 && lon < 28.2) ? 'zw' : 'zm';
	if (has('af.south.kalahari')) return lon < 20 ? 'na' : 'bw';
	if (has('af.south')) return 'za';
	if (has('af.madagascar')) return 'mg';
	if (has('af.sahel') || has('af')) return 'francophone';
	if (has('as.tr')) return 'tr';
	if (has('as.caucasus.ge')) return 'ge';
	if (has('as.caucasus.am')) return 'am';
	if (has('as.caucasus.az')) return 'az';
	if (has('as.caucasus')) return lat > 41.1 ? 'ge' : lon > 45.6 ? 'az' : 'am';
	if (has('as.levant.lb')) return 'lb';
	if (has('as.levant.jo')) return 'jo';
	if (has('as.levant.holy')) return inBox(lat, lon, 31.22, 34.2, 31.6, 34.57) || (inBox(lat, lon, 31.35, 34.88, 32.55, 35.57) && !inBox(lat, lon, 31.72, 35.13, 31.84, 35.27) && lon > 35.0 + (lat < 31.9 ? 0 : 0.05)) ? 'ps' : 'il';
	if (has('as.levant')) return 'sy';
	if (has('as.iraq')) return 'iq';
	if (has('as.arabia.dubai')) return 'ae';
	if (has('as.arabia.oman')) return 'om';
	if (has('as.arabia.yemen')) return 'ye';
	if (has('as.arabia')) return inBox(lat, lon, 28.5, 46.5, 30.1, 48.5) ? 'kw' : inBox(lat, lon, 25.75, 50.3, 26.35, 50.8) ? 'bh' : inBox(lat, lon, 24.45, 50.75, 26.2, 51.65) ? 'qa' : inBox(lat, lon, 22.6, 51.5, 26.1, 56.4) ? 'ae' : 'sa';
	if (has('as.iran')) return 'ir';
	if (has('as.central.steppe') || has('as.central.almaty')) return 'kz';
	if (has('as.central.tianshan')) return 'kg';
	if (has('as.central.turkmen')) return 'tm';
	if (has('as.central')) return 'uz';
	if (has('as.afpak.af')) return 'af';
	if (has('as.afpak')) return 'pk';
	if (has('as.india.bengal.dhaka')) return 'bd';
	if (has('as.india')) return 'in';
	if (has('as.lanka')) return 'lk';
	if (has('as.himalaya.bhutan')) return 'bt';
	if (has('as.himalaya.ladakh')) return 'in';
	if (has('as.himalaya')) return inBox(lat, lon, 26.3, 80.0, 30.45, 88.2) ? 'np' : 'in';
	if (has('as.cn.hk')) return 'hk';
	if (has('as.cn.macau')) return 'mo';
	if (has('as.tibet') || has('as.cn')) return 'cn';
	if (has('as.mongolia')) return 'mn';
	if (has('as.tw')) return 'tw';
	if (has('as.kr.north')) return 'kp';
	if (has('as.kr')) return 'kr';
	if (has('as.jp')) return 'jp';
	if (has('as.sea.vn')) return 'vn';
	if (has('as.sea.th')) return 'th';
	if (has('as.sea.kh')) return 'kh';
	if (has('as.sea.la')) return 'la';
	if (has('as.sea.mm')) return 'mm';
	if (has('as.sea.my')) return 'my';
	if (has('as.sea.sg')) return 'sg';
	if (has('as.sea.id')) return 'id';
	if (has('as.sea.ph')) return 'ph';
	if (has('as.sea.borneo')) return inBox(lat, lon, 4.0, 114.0, 5.1, 115.4) ? 'bn' : lat > 1.2 && lon < 119.3 && !(lat < 4.3 && lon > 116.0) ? 'my' : 'id';
	if (has('as.sea')) return 'th';
	if (has('oc.nz')) return 'nz';
	if (has('oc')) return 'au';
	if (has('pac.png')) return 'pg';
	if (has('pac.fiji')) return 'fj';
	if (has('pac.samoa')) return 'ws';
	if (has('pac.tonga')) return 'to';
	if (has('pac.tahiti')) return 'pf';
	if (has('sa.br')) return 'br';
	if (has('sa.ar')) return 'ar';
	if (has('sa.co')) return lat < 0.8 && lat > -5.0 && lon < -75.2 ? 'ec' : 'co';
	if (has('sa')) {
		// (the Andes and the Amazon cross borders: Chile west of the range, then by boxes)
		const chileEast = lat >= -27 ? -68.3 : lat >= -38 ? -69.6 : lat >= -50 ? -71.4 : -71.0;
		if (lat < -17.5 && lon < chileEast) return 'cl';
		if (inBox(lat, lon, -35, -58.5, -30.1, -53.2)) return 'uy';
		if (inBox(lat, lon, -27.6, -62.65, -19.3, -54.3) && !(lat > -22.9 && lon < -58)) return 'py';
		if (lat < -21.8) return 'ar';
		if (lat < -10.9 && lon > -69.6 && lon < -58) return 'bo';
		if (lat > 2.2 && lon > -54.6 && lon < -51.6 && lat > 4.3 + (lon + 51.6) * 0.875) return 'fr-carib';
		if ((lat < 1.5 && lon > -69.9 && !(lat > -0.2 && lon < -66.8)) || (lat < -7.3 && lat > -11 && lon > -73.9)) return 'br';
		if (lat > -5.0 && lat < 0.8 && lon < -75.2) return 'ec';
		if (lat > 1.1 && lon > -61.4) return lon > -54.0 ? 'fr-carib' : lon > -57.0 ? 'sr' : 'gy';
		if (lat > 0.65 && lon > -72.5) return 've';
		if (lat > -4.2 && lon > -79.1) return 'co';
		return 'pe';
	}
	if (has('an')) return null;
	// (no atlas: the coarse boxes the shops' names use)
	const L = localeAt(lat, lon);
	return { 'us-ca': 'us', 'us-tx': 'us', us: 'us', mx: 'mx', br: 'br', latam: 'latam', uk: 'gb', pt: 'pt', es: 'es', it: 'it', fr: 'fr', de: 'de', nordic: 'se', jp: 'jp', kr: 'kr', cn: 'cn', in: 'in', sea: 'th', me: 'sa' }[L] || null;
}

// city-scale detail inside a country: Japan's prefectures, India's states, Brazil's states,
// Germany's Länder, Australia's states
const JP_PREF = { tokyo: ['Tokyo Metropolitan Police', '警視庁'], kyoto: ['Kyoto Prefectural Police', '京都府警察'], kansai: ['Osaka Prefectural Police', '大阪府警察'], hokkaido: ['Hokkaido Police', '北海道警察'], okinawa: ['Okinawa Prefectural Police', '沖縄県警察'], fuji: ['Shizuoka Prefectural Police', '静岡県警察'] };
const JP_CITY = { Yokohama: ['Kanagawa Prefectural Police', '神奈川県警察'], Kamakura: ['Kanagawa Prefectural Police', '神奈川県警察'], Nagoya: ['Aichi Prefectural Police', '愛知県警察'], Fukuoka: ['Fukuoka Prefectural Police', '福岡県警察'], Kobe: ['Hyogo Prefectural Police', '兵庫県警察'], Hiroshima: ['Hiroshima Prefectural Police', '広島県警察'], Sendai: ['Miyagi Prefectural Police', '宮城県警察'], Nara: ['Nara Prefectural Police', '奈良県警察'], Osaka: ['Osaka Prefectural Police', '大阪府警察'], Kyoto: ['Kyoto Prefectural Police', '京都府警察'], Sapporo: ['Hokkaido Police', '北海道警察'], Tokyo: ['Tokyo Metropolitan Police', '警視庁'] };
function worldForce(cc, P) {
	if (cc === 'gb') return ukForce(P.lat, P.lon);
	if (cc === 'au') { const [name, sub] = auState(P.lat, P.lon); return N(name, 'POLICE', { sub, tac: `${name} Tactical Operations`, tacSub: 'TACTICAL OPERATIONS' }); }
	let T = WORLD[cc];
	if (typeof T === 'function') T = T(P.urban, P);
	if (!T) return null;
	T = { ...T };
	if (cc === 'de') { const land = DE_CITY[P.city] || DE_LAND[(P.rid || '').split('.')[2]]; if (land) { T.name = `Polizei ${land}`; T.sub = up(land); } }
	if (cc === 'jp') { const J = JP_CITY[P.city] || JP_PREF[(P.rid || '').split('.')[2]]; if (J) { T.name = J[0]; T.word = J[1]; } }
	if (cc === 'in') { const name = IN_CITY[P.city] || (IN_STATE[(P.rid || '').split('.')[2]] ? `${IN_STATE[(P.rid || '').split('.')[2]]} Police` : 'Indian Police'); T.name = name; T.sub = up(name.replace(/ Police$/, '')); T.station = P.city ? `${P.city} Police Station` : ''; }
	if (cc === 'pk') { const s = { lahore: 'Punjab Police', karachi: 'Sindh Police', north: 'Gilgit-Baltistan Police' }[(P.rid || '').split('.')[2]]; if (s) T.name = s; }
	return T;
}

// ---------- at a point ----------
// a city counts as here within its reach (by its size: a village 2 km, a megacity 30)
const CITY_REACH = [2, 4, 7, 12, 20, 30];
const cache = new Map();
export function forceAt(lat, lon) {
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return GENERIC;
	const key = Math.round(lat * 500) + ',' + Math.round(lon * 500);
	const hit = cache.get(key);
	if (hit) return hit;
	let F = bayForce(lat, lon);
	if (!F) {
		let R = null, near = [];
		try { R = regionAt(lat, lon); near = citiesNear(lat, lon, 40, 6); } catch { R = null; near = []; }
		const rid = R?.id || '';
		const C = near.find((c) => c.km <= CITY_REACH[Math.max(0, Math.min(5, c.pop | 0))]) || null;
		const cc = countryAt(lat, lon, rid);
		const town = C?.name || near.find((c) => c.km < 12)?.name || '';
		if (cc === 'us') F = usForce(lat, lon, C);
		else {
			const brState = cc === 'br' ? BR_STATE.find((S) => inBox(lat, lon, S[1], S[2], S[3], S[4]))?.[0] || '' : '';
			const prov = rid.startsWith('na.can.qc') ? 'qc' : rid.startsWith('na.can.on') ? 'on' : (lon > -79.5 && lon < -57 && lat > 45 && lat < 62.5 && !(lon > -74.5 && lat < 45.5)) ? 'qc' : '';
			const T = cc ? worldForce(cc, { lat, lon, rid, urban: !!C && (C.pop | 0) >= 1, city: C?.name || '', state: brState, prov }) : null;
			F = T ? finish({ ...T, city: T.city ?? town, sub: T.sub ?? (town ? up(town) : '') }) : GENERIC;
		}
	}
	if (cache.size > 400) cache.clear();
	cache.set(key, F);
	return F;
}

// ---------- the force where you are ----------
let acting = GENERIC, locator = null;
const listeners = new Set();
export const localForce = () => acting;
export function setLocalForce(F) {
	if (!F || F.id === acting.id) return false;
	acting = F;
	for (const fn of listeners) { try { fn(F); } catch (e) { console.warn('force', e); } }
	return true;
}
export function onForceChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
// (x, z) -> { lat, lon } on Earth, or null where there is no Earth under you
export function setForceLocator(fn) { locator = typeof fn === 'function' ? fn : null; cache.clear(); }
export function forceAtXZ(x, z) {
	let ll = null;
	try { ll = locator?.(x, z); } catch { ll = null; }
	return ll && Number.isFinite(ll.lat) ? forceAt(ll.lat, ll.lon) : null;
}

// the economy's police stations (where no service claimed the building) take the local force's name
setPoliceNamer((x, z) => { const F = forceAtXZ(x, z); return F ? { name: F.station, tag: F.word } : null; });
