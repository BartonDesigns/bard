// The Earth atlas: what the world is like anywhere on the way east from the Bay, over the
// Sierra, the Rockies and the Plains to the Atlantic, its islands, Europe, Africa and on
// across Asia to China and Japan. The facts are in data/ (bundled on their own as
// dist/earth-atlas.js and loaded only when first asked for); this is the query side:
//
//   regionAt(lat, lon)        the place's profile, blended near the borders (with weights)
//   citiesNear(lat, lon, km)  the real towns and cities round a point, nearest first
//   phrase(id, kind, seed)    a greeting, a line of chatter, a sign, a street name...
//   palette(id)               the colours and materials of the ground and the buildings
//   music(id)                 genres, tempo, scale, and the Bard faceplates that fit
//
// Regions nest continent > region > subregion (the id says where: 'na.cal.bay.sf'); each
// inherits what it does not say from the one above. A list written '+a|b' adds to the
// parent's list instead of replacing it. Everything answers the same for the same seed.

const DATA_URL = new URL('./earth-atlas.js', import.meta.url).href;     // next to the bundle
const DATA_SRC = './data/index.js';                                     // unbundled (tests, dev)

const RAD = Math.PI / 180;
// fields that are lists, written as 'a|b|c' in the data
const LISTS = new Set(['veg', 'ground', 'pattern', 'materials', 'roofs', 'walls', 'roofc', 'types', 'vehicles', 'pat', 'words', 'food', 'genres', 'inst', 'ambient', 'wear', 'greet', 'bye', 'chatter', 'signs', 'lm']);
// how softly a region fades into its neighbours (km), by depth, unless it says
const BLEND = [0, 90, 50, 25, 10, 5];

export const SCALES = {
	major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
	phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harmonic: [0, 2, 3, 5, 7, 8, 11], hijaz: [0, 1, 4, 5, 7, 8, 10],
	double: [0, 1, 4, 5, 7, 8, 11], pentatonic: [0, 2, 4, 7, 9], minorpent: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10],
	in: [0, 1, 5, 7, 8], yo: [0, 2, 5, 7, 9], hirajoshi: [0, 2, 3, 7, 8], ryukyu: [0, 4, 5, 7, 11], pelog: [0, 1, 3, 7, 8],
	slendro: [0, 2, 5, 7, 9], bhairav: [0, 1, 4, 5, 7, 8, 11], kafi: [0, 2, 3, 5, 7, 9, 10],
};
// the Bard's faceplates for a genre (the first rule that matches wins)
const GENRE_FACE = [
	[/drum and bass|jungle|garage|grime|dubstep|breakbeat/i, 'DNB'],
	[/hyphy|mobb|g-funk|west coast|hip hop|rap|trap|phonk|crunk|bounce|drill/i, 'HYPHY'],
	[/techno|house|trance|electro|club|amapiano|gqom|kuduro|edm|schlager/i, 'GAS'],
	[/reggae|dancehall|reggaeton|dembow|soca|calypso|zouk|kompa|bachata|merengue|salsa|cumbia|afrobeat|highlife|soukous|rumba|décalé|mbalax|bongo|taarab|samba|bossa|mento|ska|steelpan|juju|fuji|kwaito/i, 'DANCEHALL'],
	[/soul|motown|r&b|gospel|funk|doo-wop|disco/i, 'SOUL'],
	[/k-pop|hyperpop|bollywood|eurovision|turbo|dangdut|filmi|arabesk|chalga/i, 'GLITCHPOP'],
	[/j-pop|city pop|anime|idol|c-pop|mandopop|cantopop|enka|kayōkyoku|t-pop|v-pop/i, 'KAWAII'],
	[/jazz|blues|lo-fi|swing|ragtime|chanson|fado|tango|cabaret|lounge|bolero|trova|morna/i, 'BREW'],
	[/classical|opera|orchestra|baroque|choral|symphon|waltz|romantic|brass band/i, 'MAESTRO'],
	[/gamelan|music box|mbira|kalimba|celesta|bells|kulintang/i, 'SPARKLE'],
	[/synth|new wave|italo|surf|psychedelic|shoegaze|kraut|rock|metal|punk|grunge|indie/i, 'SYNTHWAVE'],
	[/./, 'BARD'],
];
export const FACEPLATES = ['BARD', 'MAESTRO', 'SYNTHWAVE', 'DNB', 'SPARKLE', 'SOUL', 'GAS', 'HYPHY', 'DANCEHALL', 'GLITCHPOP', 'KAWAII', 'BREW'];
const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];
export const POP = ['village', 'town', 'city', 'large city', 'metropolis', 'megacity'];

// ---------- small tools ----------
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export function rng(seed) {
	let s = (typeof seed === 'number' ? seed : hash(seed)) >>> 0 || 1;
	return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (L, r) => (L && L.length ? L[Math.floor(r() * L.length)] : '');
export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const smooth = (t) => t * t * (3 - 2 * t);
export function km(lat1, lon1, lat2, lon2) {
	const a = Math.sin((lat2 - lat1) * RAD / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2;
	return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

// ---------- the data, made ready once ----------
let A = null, loading = null;
export const atlasReady = () => !!A;

// load the facts (once); resolves to this module's query functions
export function loadAtlas() {
	if (A) return Promise.resolve(API);
	if (!loading) loading = import(/* @vite-ignore */ DATA_URL).catch(() => import(/* @vite-ignore */ DATA_SRC)).then((m) => { useAtlasData(m); return API; });
	return loading;
}

// take the facts as given (tests; or a globe that brings its own)
export function useAtlasData({ REGIONS, CITIES }) {
	const raw = new Map(), res = new Map();
	for (const r of REGIONS) { if (raw.has(r.id)) throw Error('atlas: two regions ' + r.id); raw.set(r.id, r); }
	const resolve = (id) => {
		if (res.has(id)) return res.get(id);
		const r = raw.get(id);
		if (!r) return null;
		const up = id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null;
		const P = up ? resolve(up) || resolve(up.slice(0, up.lastIndexOf('.'))) : null;
		const out = merge(P, r);
		out.id = id; out.name = r.name; out.parent = P ? P.id : null; out.depth = id.split('.').length;
		out.path = P ? [...P.path, id] : [id];
		out.names = P ? [...P.names, r.name] : [r.name];
		delete out.box; delete out.poly; delete out.pri; delete out.blend;
		res.set(id, out);
		return out;
	};
	const shaped = [];
	for (const r of REGIONS) {
		const R = resolve(r.id);
		if (!r.box && !r.poly) continue;
		const S = shapeOf(r);
		S.id = r.id; S.R = R; S.sea = R.kind === 'ocean';
		S.pri = r.pri ?? R.depth; S.blend = r.blend ?? BLEND[Math.min(R.depth, 5)];
		shaped.push(S);
	}
	// a coarse index: 10-degree cells, each listing the shapes that reach into it (with their fade)
	const cells = new Map(), CELL = 10;
	for (const S of shaped) {
		const pad = S.blend / 111 + 0.5, [s, w, n, e] = S.bb;
		for (let i = Math.floor((s - pad) / CELL); i <= Math.floor((n + pad) / CELL); i++) for (let j = Math.floor((w - pad * 2) / CELL); j <= Math.floor((e + pad * 2) / CELL); j++) {
			const k = i + ',' + j; let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(S);
		}
	}
	for (const c of cells.values()) c.sort((a, b) => b.pri - a.pri || a.area - b.area);
	A = { raw, res, shaped, cells, CELL, cities: [], byId: new Map(), cityCells: new Map() };
	// the towns and cities: 'Name|lat|lon|size|character|landmark;landmark' (an 'id=' field names it)
	for (const row of CITIES) {
		const f = row.split('|');
		const c = { name: f[0], lat: +f[1], lon: +f[2], pop: +f[3], popClass: POP[+f[3]] || 'town', char: f[4] || '', landmarks: f[5] ? f[5].split(';').map((s) => s.trim()).filter(Boolean) : [] };
		let id = f[6] || slug(c.name);
		if (A.byId.has(id)) id += '-' + slug(regionAt(c.lat, c.lon).id.split('.').pop());
		if (A.byId.has(id)) throw Error('atlas: two cities ' + id);
		c.id = id;
		const at = regionAt(c.lat, c.lon);
		c.region = at.id; c.regionName = at.name; c.country = at.profile.country || '';
		A.cities.push(c); A.byId.set(id, c);
		const k = Math.floor(c.lat) + ',' + Math.floor(c.lon);
		let L = A.cityCells.get(k); if (!L) A.cityCells.set(k, L = []); L.push(c);
	}
	return API;
}

function merge(P, r) {
	const out = P ? { ...P } : {};
	for (const [k, v] of Object.entries(r)) {
		if (k === 'id' || k === 'name') continue;
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const base = P && P[k] && typeof P[k] === 'object' && !Array.isArray(P[k]) ? P[k] : {};
			const o = { ...base };
			for (const [k2, v2] of Object.entries(v)) o[k2] = field(k2, v2, base[k2]);
			out[k] = o;
		} else out[k] = field(k, v, P?.[k]);
	}
	return out;
}
function field(k, v, parent) {
	if (!LISTS.has(k) || typeof v !== 'string') return v;
	const add = v.startsWith('+'), L = (add ? v.slice(1) : v).split('|').map((s) => s.trim()).filter(Boolean);
	if (!add || !Array.isArray(parent)) return L;
	const seen = new Set(L);
	return [...L, ...parent.filter((x) => !seen.has(x))];
}

// ---------- shapes: boxes [south, west, north, east] (one or several) or a polygon ----------
function shapeOf(r) {
	if (r.poly) {
		const P = r.poly, lat = [], lon = [];
		for (let i = 0; i < P.length; i += 2) { lat.push(P[i]); lon.push(P[i + 1]); }
		const bb = [Math.min(...lat), Math.min(...lon), Math.max(...lat), Math.max(...lon)];
		let a = 0;
		for (let i = 0, j = lat.length - 1; i < lat.length; j = i++) a += (lon[j] * lat[i] - lon[i] * lat[j]);
		return { lat, lon, bb, area: Math.abs(a / 2) * Math.cos((bb[0] + bb[2]) / 2 * RAD) };
	}
	const B = typeof r.box[0] === 'number' ? [r.box] : r.box;
	const bb = [Math.min(...B.map((b) => b[0])), Math.min(...B.map((b) => b[1])), Math.max(...B.map((b) => b[2])), Math.max(...B.map((b) => b[3]))];
	return { boxes: B, bb, area: B.reduce((a, b) => a + (b[2] - b[0]) * (b[3] - b[1]) * Math.cos((b[0] + b[2]) / 2 * RAD), 0) };
}
// how far inside the shape the point is, in km (negative outside)
function inside(S, lat, lon) {
	const kx = 111.32 * Math.cos(lat * RAD), ky = 110.57;
	if (S.boxes) {
		let best = -1e9;
		for (const [s, w, n, e] of S.boxes) {
			const a = (lon - w) * kx, b = (e - lon) * kx, c = (lat - s) * ky, d = (n - lat) * ky;
			const v = a >= 0 && b >= 0 && c >= 0 && d >= 0 ? Math.min(a, b, c, d) : -Math.hypot(Math.max(0, -a, -b), Math.max(0, -c, -d));
			if (v > best) best = v;
		}
		return best;
	}
	const { lat: Y, lon: X } = S;
	let inn = false, dmin = 1e9;
	for (let i = 0, j = Y.length - 1; i < Y.length; j = i++) {
		if ((Y[i] > lat) !== (Y[j] > lat) && lon < (X[j] - X[i]) * (lat - Y[i]) / (Y[j] - Y[i]) + X[i]) inn = !inn;
		const ax = (X[j] - lon) * kx, ay = (Y[j] - lat) * ky, bx = (X[i] - lon) * kx, by = (Y[i] - lat) * ky;
		const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
		const d = Math.hypot(ax + dx * t, ay + dy * t);
		if (d < dmin) dmin = d;
	}
	return inn ? dmin : -dmin;
}

// ---------- queries ----------
const cellOf = (lat, lon) => A.cells.get(Math.floor(lat / A.CELL) + ',' + Math.floor(lon / A.CELL)) || [];
export function region(id) { return A?.res.get(id) || null; }
export const regions = () => (A ? [...A.res.values()] : []);

// the place at a point: the profile of the region it is most in, how much of each region
// round it is here (weights summing to 1, the most first), and the numbers blended by them
export function regionAt(lat, lon) {
	if (!A) return null;
	lon = ((lon + 540) % 360) - 180;
	let rem = 1, sea = null;
	const W = [];
	for (const S of cellOf(lat, lon)) {
		const d = inside(S, lat, lon);
		if (S.sea) { if (d >= 0 && !sea) sea = S.R; continue; }
		if (rem < 0.004 || d <= -S.blend) continue;
		const a = smooth(Math.max(0, Math.min(1, 0.5 + d / (2 * S.blend))));
		if (a <= 0) continue;
		W.push({ id: S.id, name: S.R.name, w: rem * a, R: S.R });
		rem *= 1 - a;
	}
	if (!W.length) {
		const R = sea || A.res.get('sea') || null;
		return R ? { lat, lon, id: R.id, name: R.name, land: false, weights: [{ id: R.id, name: R.name, w: 1 }], profile: R, mix: mixOf([{ w: 1, R }]), coast: R.terrain?.coast || 'open sea', sea: R } : null;
	}
	const tot = W.reduce((a, b) => a + b.w, 0);
	for (const x of W) x.w /= tot;
	W.sort((a, b) => b.w - a.w);
	const top = W[0].R;
	return { lat, lon, id: top.id, name: top.name, land: true, path: top.path, weights: W.map(({ id, name, w }) => ({ id, name, w: Math.round(w * 1000) / 1000 })), profile: top, mix: mixOf(W), coast: top.terrain?.coast || 'none', sea };
}
function mixOf(W) {
	const num = (f) => W.reduce((a, x) => a + (f(x.R) ?? 0) * x.w, 0);
	const pair = (f) => [num((R) => f(R)?.[0]), num((R) => f(R)?.[1])].map((v) => Math.round(v * 10) / 10);
	const ground = [0, 1, 2].map((i) => { const c = [0, 0, 0]; let t = 0; for (const x of W) { const G = x.R.ground; if (!G?.length) continue; const h = hex(G[i % G.length]); for (let k = 0; k < 3; k++) c[k] += h[k] * x.w; t += x.w; } return t ? toHex(c.map((v) => v / t)) : '#7a7a60'; });
	// the plants: each region's in turn, by weight, most-weighted first
	const veg = [], seen = new Set();
	for (const x of W) { const n = Math.max(1, Math.round(x.w * 10)); for (const v of (x.R.veg || []).slice(0, n)) if (!seen.has(v)) { seen.add(v); veg.push(v); } }
	return { elev: pair((R) => R.terrain?.elev), temp: pair((R) => R.climate?.temp), rain: Math.round(num((R) => R.climate?.rain)), snow: Math.round(num((R) => R.climate?.snow) * 100) / 100, density: Math.round(num((R) => R.settle?.density) * 100) / 100, ground, veg: veg.slice(0, 12) };
}

// the real towns and cities within radiusKm of a point, nearest first
export function citiesNear(lat, lon, radiusKm = 50, limit = 50) {
	if (!A) return [];
	const out = [], dl = Math.ceil(radiusKm / 111) + 1, dn = Math.ceil(radiusKm / (111 * Math.max(0.05, Math.cos(lat * RAD)))) + 1;
	for (let i = Math.floor(lat) - dl; i <= Math.floor(lat) + dl; i++) for (let j = Math.floor(lon) - Math.min(dn, 180); j <= Math.floor(lon) + Math.min(dn, 180); j++) {
		for (const c of A.cityCells.get(i + ',' + (((j + 180) % 360 + 360) % 360 - 180)) || []) { const d = km(lat, lon, c.lat, c.lon); if (d <= radiusKm) out.push({ ...c, km: Math.round(d * 10) / 10 }); }
	}
	out.sort((a, b) => a.km - b.km);
	return out.slice(0, limit);
}
export const cities = () => (A ? A.cities : []);
export function city(id) { return A?.byId.get(id) || null; }
// by name (any case, accents or not; the biggest of several with the name)
export function cityByName(name) {
	if (!A) return null;
	const s = slug(name);
	return A.byId.get(s) || A.cities.filter((c) => slug(c.name) === s || c.id.startsWith(s + '-')).sort((a, b) => b.pop - a.pop)[0] || A.cities.find((c) => slug(c.name).startsWith(s)) || null;
}

// a line of the place's own: kind is greet, bye, chatter, sign, word, food, street or landmark
export function phrase(regionId, kind = 'greet', seed = 0) {
	const R = region(regionId);
	if (!R) return '';
	const r = rng(hash(regionId + ':' + kind + ':' + seed));
	const S = R.say || {};
	switch (kind) {
		case 'street': return streetName(R, r);
		case 'food': return pick(R.food, r);
		case 'landmark': return pick(R.lm, r);
		case 'word': return pick(S.words, r);
		case 'sign': return pick(S.signs, r);
		case 'bye': return pick(S.bye, r);
		case 'chatter': return pick(S.chatter, r);
		default: return pick(S.greet, r);
	}
}
// a street name in the local pattern: '{w}' a local word, '{n}' a number or ordinal
export function streetName(R, r) {
	const T = R.streets || {}, pat = pick(T.pat, r) || '{w} Street';
	return pat.replace('{w}', () => pick(T.words, r) || 'Main').replace('{n}', () => (/^en/.test(R.lang || 'en') ? ORD[Math.floor(r() * 8)] : String(1 + Math.floor(r() * 12))));
}

// the colours and materials a generator paints the place with
export function palette(regionId) {
	const R = region(regionId);
	if (!R) return null;
	const a = R.arch || {};
	return { style: a.style || '', ground: R.ground || [], walls: a.walls || [], roofs: a.roofc || [], roofShapes: a.roofs || [], materials: a.materials || [], buildings: a.types || [], vegetation: R.veg || [], road: R.road?.look || '' };
}

// what the place sounds like, and the Bard faceplates that play it
export function music(regionId) {
	const R = region(regionId);
	if (!R) return null;
	const M = R.music || {}, genres = M.genres || [];
	const faces = [];
	if (M.face) faces.push(M.face);
	for (const g of genres) { const f = GENRE_FACE.find(([re]) => re.test(g))[1]; if (!faces.includes(f)) faces.push(f); }
	const scale = M.scale || 'major';
	return { genres, face: faces[0] || 'BARD', faces, bpm: M.bpm || [90, 120], scale, intervals: SCALES[scale] || SCALES.major, instruments: M.inst || [], ambient: R.ambient || [] };
}
export const faceFor = (genre) => GENRE_FACE.find(([re]) => re.test(genre || ''))[1];

// a short account of a point, for the console (Crysis.atlas)
export function describeAt(lat, lon) {
	const at = regionAt(lat, lon);
	if (!at) return null;
	const R = at.profile;
	return {
		place: R.names.join(' › '), id: at.id, weights: at.weights, land: at.land, char: R.char,
		terrain: R.terrain, climate: R.climate, biome: R.biome, coast: at.coast, sea: at.sea?.name, mix: at.mix,
		architecture: R.arch?.style, settlement: R.settle, language: R.lang, music: music(at.id), greet: phrase(at.id, 'greet', lat * 1000 + lon), chatter: phrase(at.id, 'chatter', lat + lon),
		near: citiesNear(lat, lon, 80, 5).map((c) => `${c.name} (${c.km} km)`),
	};
}

const API = { loadAtlas, atlasReady, useAtlasData, region, regions, regionAt, citiesNear, cities, city, cityByName, phrase, streetName, palette, music, faceFor, describeAt, km, hash, rng, slug, SCALES, FACEPLATES, POP };
export default API;
