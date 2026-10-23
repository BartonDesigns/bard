// Names for the services and the people who work in them: original, made from where a place
// stands, the same every visit. No real hospital or agency is named; the police stations alone
// are the local force's (law/force.js: 'San Francisco Police, Mission Station', 'Alameda County
// Sheriff's Office', 'Dublin Garda Station'), where the force is known.

import { hash2 } from './siting.js';
import { forceAtXZ } from '../law/force.js';

const PLACE = ['Harbor', 'Ridgeway', 'Oakmont', 'Cedar Hill', 'Bayside', 'Northgate', 'Westfield', 'Summit', 'Valley View', 'Lakeside', 'Riverside', 'Hillcrest', 'Pinecrest', 'Granite', 'Meadowbrook', 'Crescent', 'Southport', 'Eastbridge', 'Fairhaven', 'Stonebrook'];
const HOSPITAL = ['General Hospital', 'Medical Center', 'Community Hospital', 'Regional Medical Center', 'Memorial Hospital'];
const FIRST = ['Ana', 'Ben', 'Chen', 'Dara', 'Eli', 'Farah', 'Gus', 'Hana', 'Ivan', 'Jo', 'Kofi', 'Lena', 'Mateo', 'Nia', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq', 'Uma', 'Vic', 'Wen', 'Yusuf', 'Zoe', 'Marisol', 'Theo', 'Imani', 'Kenji', 'Leila'];
const LAST = ['Alvarez', 'Brooks', 'Castillo', 'Dunn', 'Ekwueme', 'Fischer', 'Garza', 'Hale', 'Ito', 'Jansen', 'Kaur', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quintero', 'Reyes', 'Sato', 'Tran', 'Usman', 'Varga', 'Whitlock', 'Xu', 'Yilmaz', 'Zeller'];
const pick = (list, u) => list[Math.floor(u * list.length) % list.length];

export function placeName(x, z) { return pick(PLACE, hash2(Math.round(x / 400) + 0.13, Math.round(z / 400) + 0.57)); }
export function serviceName(kind, x, z) {
	const place = placeName(x, z), u = hash2(Math.round(x) * 0.31, Math.round(z) * 0.29);
	if (kind === 'hospital') return `${place} ${pick(HOSPITAL, u)}`;
	if (kind === 'fire') return `Fire Station ${1 + Math.floor(u * 38)}`;
	// (with no force known, as off the Earth: a plain station, never a made-up force's)
	if (kind === 'police') { const F = forceAtXZ(x, z); return F ? F.station : `Police Station ${1 + Math.floor(u * 24)}`; }
	return `${place} Reserve Armory`;
}
// the sign over the door, short
export function signOf(kind, x, z) {
	if (kind === 'hospital') return { top: serviceName(kind, x, z).toUpperCase(), sub: 'EMERGENCY' };
	if (kind === 'fire') return { top: serviceName(kind, x, z).toUpperCase(), sub: 'FIRE · RESCUE' };
	if (kind === 'police') { const F = forceAtXZ(x, z); return F ? { top: F.word, sub: F.signSub || F.sub } : { top: 'POLICE', sub: '' }; }
	return { top: 'RESERVE ARMORY', sub: placeName(x, z).toUpperCase() };
}
// a worker's name, from their post and their place
export function staffName(seed) {
	const u = hash2(seed * 0.0137 + 3.1, seed * 0.0071 - 1.7), v = hash2(seed * 0.0219 - 0.4, seed * 0.0113 + 2.2);
	return `${pick(FIRST, u)} ${pick(LAST, v)}`;
}
