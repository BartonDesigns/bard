// What the server knows of a place: its own copy of the Earth atlas and the brief code (the
// game's own files, island/src/earth, bundled in), so the words it asks with and the checks it
// makes are the game's. Nothing a player sends reaches a prompt: a place is only ever its id
// (an atlas city's, or a generated town's 'gen:<slug>:<lat>,<lon>') and a size class.

import { useAtlasData, city as atlasCity, cities, regionAt } from '../../../island/src/earth/atlas.js';
import * as DATA from '../../../island/src/earth/data/index.js';
import { parseGenId, genCity, briefRequest, briefFromReply, fallbackBrief, compactBrief, TOWN, BRIEF_SCHEMA, BRIEF_JSON_SCHEMA } from '../../../island/src/earth/brief.js';
import { looseJSON } from '../../../island/src/earth/json.js';

useAtlasData(DATA);

export { BRIEF_SCHEMA, BRIEF_JSON_SCHEMA };

// the place an id names, or why not: { city } or { error }
// body: { id, lat, lon, pop } for a town (lat and lon must be the id's, the point on land);
// an atlas city needs only its id
export function placeOf(id, body = null) {
	if (typeof id !== 'string' || id.length > 80) return { error: 'bad id' };
	if (!id.startsWith('gen:')) {
		const c = atlasCity(id);
		return c ? { city: c } : { error: 'unknown place' };
	}
	const g = parseGenId(id);
	if (!g) return { error: 'bad id' };
	let pop = 1;
	if (body) {
		const { lat, lon } = body;
		if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return { error: 'bad lat/lon' };
		if (Math.abs(lat - g.lat) > 0.0051 || Math.abs(lon - g.lon) > 0.0051) return { error: 'lat/lon do not match the id' };
		if (body.pop !== undefined) {
			if (!Number.isInteger(body.pop) || body.pop < 0 || body.pop > 3) return { error: 'bad pop' };
			pop = body.pop;
		}
		if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length > 60 || slugOf(body.name) !== g.slug)) return { error: 'name does not match the id' };
	}
	const at = regionAt(g.lat, g.lon);
	if (!at || !at.land) return { error: 'not on land' };
	// the name stays out: the brief says {town}, and each player's game puts the name in
	return { city: genCity({ id, name: TOWN, lat: g.lat, lon: g.lon, pop }) };
}
const slugOf = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// the prompt, from the atlas alone
export const requestFor = (city) => briefRequest(city);

// what a reply makes, compacted for keeping; null when it cannot be used
export function briefOf(reply, city) {
	let v = reply;
	if (typeof v === 'string') v = looseJSON(v)?.value;
	if (!v || typeof v !== 'object') return null;
	const b = briefFromReply(v, city);
	return b ? compactBrief(b) : null;
}
// the atlas brief, compacted: kept when the place cannot be asked about
export const atlasBriefOf = (city) => compactBrief(fallbackBrief(city));

// the atlas cities, biggest first (for the nightly round)
export const citiesByPop = () => cities().slice().sort((a, b) => b.pop - a.pop || (a.id < b.id ? -1 : 1));
