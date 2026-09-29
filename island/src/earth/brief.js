// A city brief: what should be in a town or city you come to, in one small object the
// generators read (civgen's streets and shop signs, the people's chatter, the music, the
// ambience). Made two ways, in the same shape:
//
//   fallbackBrief(city)       from the atlas alone, with seeded choices: the same every time
//   validateBrief(raw, base)  from what a model wrote, every field checked and clamped, and
//                             anything missing or bad taken from base
//
// A place's brief is made once, off the device, and shared: the discovery server (server/
// discovery) makes it the first time anyone comes to the place, asking with briefRequest
// (built from the atlas alone) and keeping what briefFromReply makes of the answer, or the
// atlas brief when it cannot ask. Every player then reads the same brief through
// canonicalBrief, for good.
//
// The shape (BRIEF_SCHEMA; a change of shape bumps it, and the cached briefs are made anew):
//   { v, id, city, region, country, lang, source: 'atlas' | 'llm' | 'mixed',
//     vibe:       one sentence
//     districts:  2-6 of { name, kind (DISTRICT_KINDS), share (0-1, summing to 1), architecture, height: [lo, hi] storeys }
//     landmarks:  1-6 of { look (a generic stand-in: 'red suspension bridge'), name (the real one it stands for, or ''), kind (LANDMARK_KINDS) }
//     streets:    10-20 street names in the local pattern
//     signs:      10-20 shop and sign texts in the local language or slang
//     chatter:    10-20 short lines people say in passing
//     music:      { genre, bpm, scale } (never a faceplate: the player chooses theirs)
//     wardrobe, food, vehicles, vegetation: short lists }

import { region, regionAt, citiesNear, rng, slug, streetName, music as musicOf, POP } from './atlas.js';

export const BRIEF_SCHEMA = 1;
export const DISTRICT_KINDS = ['downtown', 'oldtown', 'residential', 'market', 'industrial', 'waterfront', 'campus', 'park', 'suburb', 'village', 'temple'];
export const LANDMARK_KINDS = ['bridge', 'transit', 'tower', 'church', 'mosque', 'temple', 'pagoda', 'castle', 'palace', 'market', 'stadium', 'monument', 'pyramid', 'square', 'garden', 'harbour', 'museum', 'street', 'mountain', 'waterfall', 'lighthouse', 'other'];
export const LIMITS = { districts: [2, 6], landmarks: [1, 6], streets: [10, 20], signs: [10, 20], chatter: [10, 20], wardrobe: [2, 8], food: [3, 10], vehicles: [2, 8], vegetation: [2, 8] };
const HEIGHT = { low: [1, 2], mid: [3, 6], high: [7, 20], tower: [20, 80] };

// ---------- checking what came in ----------
// (lines that stray into what a place should never be made fun of for are dropped)
const UNKIND = /\b(ghetto|slum|thug|gang|crime|criminal|poor|poverty|stupid|dumb|idiot|lazy|dirty|filthy|savage|primitive|backward|uncivili[sz]ed|terroris[mt]|drunk(ard)?s?|redneck|hillbilly|peasant)\b/i;
const PLACEHOLDER = /^(<.*>|\.\.\.|…|string|name|text|n\/a|none|null|example|todo|tbd|item|line \d+|street \d+|sign \d+|\?+)$/i;
export function clean(v, max = 80) {
	if (v && typeof v === 'object' && !Array.isArray(v)) v = v.name ?? v.text ?? v.line ?? v.value ?? '';
	if (typeof v === 'number') v = String(v);
	if (typeof v !== 'string') return '';
	let s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[*_`#]+/g, '').replace(/\s+/g, ' ').trim();
	s = s.replace(/^(?:[-•]+\s*|\d{1,2}[.)]\s+)(?=\S)/, '').replace(/^["']|["']$/g, '').trim();
	if (!s || PLACEHOLDER.test(s) || UNKIND.test(s)) return '';
	if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '').trim() || s.slice(0, max);
	return s;
}
export function cleanList(v, [lo, hi], max = 60) {
	if (typeof v === 'string') v = v.split(/\s*[;\n]\s*|\s*,\s+(?=[A-ZÀ-￿])/);
	if (!Array.isArray(v)) return [];
	const out = [], seen = new Set();
	for (const x of v) {
		const s = clean(x, max), k = s.toLowerCase();
		if (!s || seen.has(k)) continue;
		seen.add(k); out.push(s);
		if (out.length >= hi) break;
	}
	return out.length >= Math.min(lo, 1) ? out : [];
}
const kindOfDistrict = (s) => {
	const t = String(s || '').toLowerCase();
	if (/old|histor|medina|casco|altstadt|hutong|heritage|walled/.test(t)) return 'oldtown';
	if (/down|centr|cbd|business|financ|core/.test(t)) return 'downtown';
	if (/market|bazaar|souk|souq|shop|commerc|mall/.test(t)) return 'market';
	if (/indust|factory|warehouse|dock|rail|port\b|works/.test(t)) return 'industrial';
	if (/water|harbou?r|beach|sea|river|marina|lake|bay|coast|ghat|quay|pier/.test(t)) return 'waterfront';
	if (/univers|campus|college|school/.test(t)) return 'campus';
	if (/park|garden|green|common/.test(t)) return 'park';
	if (/suburb|estate|outskirt/.test(t)) return 'suburb';
	if (/village|rural|farm|hamlet/.test(t)) return 'village';
	if (/temple|church|cathedral|mosque|shrine|holy|sacred|monaster/.test(t)) return 'temple';
	return DISTRICT_KINDS.includes(t) ? t : 'residential';
};
export function heightOf(v) {
	if (Array.isArray(v) && v.length) { const a = +v[0], b = +(v[1] ?? v[0]); if (Number.isFinite(a) && Number.isFinite(b)) return clampH(Math.min(a, b), Math.max(a, b)); }
	if (typeof v === 'number' && Number.isFinite(v)) return clampH(v, v);
	const t = String(v ?? '').toLowerCase();
	const m = t.match(/(\d+)\s*(?:-|to|–)\s*(\d+)/) || t.match(/(\d+)/);
	if (m) return clampH(+m[1], +(m[2] ?? m[1]));
	if (/sky|tower|high-rise|highrise/.test(t)) return HEIGHT.tower.slice();
	if (/high|tall/.test(t)) return HEIGHT.high.slice();
	if (/mid|medium|moderate/.test(t)) return HEIGHT.mid.slice();
	if (/one|single/.test(t)) return [1, 1];
	return HEIGHT.low.slice();
}
const clampH = (a, b) => [Math.max(1, Math.min(120, Math.round(a))), Math.max(1, Math.min(120, Math.round(b)))];

// what kind of thing a landmark is, from its words
const KINDS = [
	['bridge', /bridge|puente|ponte|\bpont\b|\bmost\b|köprü|viaduct/i], ['lighthouse', /lighthouse|light\b|lanterna|faro\b/i],
	['pyramid', /pyramid|sphinx|ziggurat/i], ['mosque', /mosque|masjid|cami|minaret|mezquita/i],
	['pagoda', /pagoda|stupa|chedi|chorten|dagoba/i], ['temple', /temple|\bwat\b|shrine|jinja|-ji\b|gompa|monaster|dzong|lavra|torii|gopuram/i],
	['church', /cathedral|church|basilica|chapel|duomo|kirk|abbey|minster|kirche|notre-dame|sagrada|sé\b|cristo|christ the/i],
	['palace', /palace|palazzo|palais|residenz|mahal|haveli|forbidden city|imperial|royal/i],
	['castle', /castle|\bfort|citadel|kremlin|alcázar|alcazaba|kasbah|château|\bburg\b|schloss|hrad|zamek|ramparts|\bwalls?\b/i],
	['transit', /\btram|streetcar|cable car|metro\b|subway|funicular|railway|station\b|\btrain\b|ferry\b|gondola/i], ['stadium', /stadium|arena|colosseum|amphitheat|coliseum|field\b|bowl\b/i],
	['market', /market|bazaar|souk|souq|mercado|marché|markt|halles|chowk/i], ['tower', /tower|torre|\btour\b|turm|needle|spire|campanile|belfry|skytree|minar\b|obelisk/i],
	['monument', /monument|statue|memorial|column|arch\b|arco|gate|triumph|mausoleum|tomb|lion|merlion/i],
	['square', /square|plaza|piazza|\bplace\b|platz|zócalo|meydan|maidan|\brynek\b/i], ['garden', /garden|park\b|jardín|jardin|botanic|bagh/i],
	['harbour', /harbou?r|pier|wharf|\bport\b|quay|marina|waterfront|ghat|dock|canal|creek/i], ['museum', /museum|gallery|library|opera|theatre|theater|hall\b|house\b/i],
	['waterfall', /falls|waterfall|cascade/i], ['mountain', /mountain|peak|mount\b|volcano|rock\b|hill\b|dome\b|canyon|gorge|cliff|island|lake|bay\b|beach|dunes?\b/i],
	['street', /street|avenue|road|rambla|strip\b|boulevard|broadway|\brow\b|lane\b/i],
];
export const landmarkKind = (s) => (KINDS.find(([, re]) => re.test(s || '')) || ['other'])[0];
const GENERIC = { bridge: 'long bridge over the water', tower: 'tall landmark tower', church: 'great church with a spire', mosque: 'domed mosque with minarets', temple: 'old temple with carved roofs', pagoda: 'tiered pagoda', castle: 'old fortress on a hill', palace: 'grand palace', market: 'busy covered market', stadium: 'big stadium', monument: 'stone monument on a plaza', pyramid: 'ancient pyramid', square: 'grand square with a fountain', garden: 'formal garden', harbour: 'busy harbour front', transit: 'old tram line on the main street', museum: 'grand museum building', street: 'famous street lined with shops', mountain: 'the mountain over the town', waterfall: 'waterfall in a gorge', lighthouse: 'lighthouse on the point', other: 'local landmark' };

// ---------- district names by language ----------
const DN = {
	en: { downtown: ['Downtown', '{city} Centre', 'the Central District'], oldtown: ['Old Town', 'the Historic District', 'the Old Quarter'], residential: ['{w} Heights', 'the {w} District', 'North Side', 'West End', 'East Side', '{w} Hill'], market: ['the Market District', '{w} Market'], industrial: ['the Rail Yards', 'the Industrial District', 'the Works'], waterfront: ['the Waterfront', 'the Harbour', 'the Docks', '{w} Beach'], campus: ['University Hill', 'the Campus'], park: ['{w} Park', 'the Commons'], suburb: ['{w} Estates', '{w} Hills', '{w} Village'], village: ['{w} Village', 'the Old Village'], temple: ['the Cathedral Quarter', 'Temple Hill'] },
	es: { downtown: ['Centro'], oldtown: ['Casco Antiguo', 'Barrio Viejo'], residential: ['Barrio de {w}', 'Colonia {w}', 'El Ensanche'], market: ['Barrio del Mercado'], industrial: ['Polígono Industrial'], waterfront: ['El Malecón', 'La Playa', 'El Puerto'], campus: ['Ciudad Universitaria'], park: ['Parque {w}'], suburb: ['Urbanización {w}'], village: ['Pueblo de {w}'], temple: ['Barrio de la Catedral'] },
	pt: { downtown: ['Centro', 'Baixa'], oldtown: ['Cidade Velha', 'Centro Histórico'], residential: ['Bairro {w}', 'Vila {w}'], market: ['Bairro do Mercado'], industrial: ['Zona Industrial'], waterfront: ['A Orla', 'A Praia', 'A Ribeira'], campus: ['Cidade Universitária'], park: ['Parque {w}'], suburb: ['Jardim {w}'], village: ['Aldeia {w}'], temple: ['Largo da Sé'] },
	fr: { downtown: ['Centre-ville'], oldtown: ['Vieille Ville', 'Vieux Quartier'], residential: ['Quartier {w}', 'Faubourg {w}'], market: ['Les Halles', 'Quartier du Marché'], industrial: ['Zone Industrielle'], waterfront: ['Le Port', 'Les Quais', 'Le Front de Mer', 'Les Docks'], campus: ['Quartier Latin', 'Campus'], park: ['Parc {w}'], suburb: ['Les Hauts de {w}'], village: ['Le Village'], temple: ['Quartier de la Cathédrale'] },
	it: { downtown: ['Centro'], oldtown: ['Centro Storico'], residential: ['Quartiere {w}', 'Borgo {w}'], market: ['Il Mercato'], industrial: ['Zona Industriale'], waterfront: ['Lungomare', 'Il Porto'], campus: ['Città Universitaria'], park: ['Parco {w}'], suburb: ['Periferia {w}'], village: ['Borgo'], temple: ['Piazza del Duomo'] },
	de: { downtown: ['Innenstadt'], oldtown: ['Altstadt'], residential: ['{w}viertel', '{w}kiez'], market: ['Marktviertel'], industrial: ['Industriegebiet', 'Gewerbegebiet'], waterfront: ['Hafen', 'Uferpromenade', 'Hafenviertel'], campus: ['Uni-Viertel'], park: ['{w}park'], suburb: ['Vorstadt'], village: ['Dorf'], temple: ['Domviertel'] },
	nl: { downtown: ['Centrum'], oldtown: ['Binnenstad'], residential: ['{w}wijk'], market: ['Marktkwartier'], industrial: ['Industrieterrein'], waterfront: ['De Haven', 'De Kade'], campus: ['Universiteitskwartier'], park: ['{w}park'], suburb: ['Buitenwijk'], village: ['Dorp'], temple: ['Domkwartier'] },
	ar: { downtown: ['Wust al-Balad (downtown)'], oldtown: ['the Medina'], residential: ['Hay {w}'], market: ['the Souq'], industrial: ['the Industrial Quarter'], waterfront: ['the Corniche', 'the Port'], campus: ['University Quarter'], park: ['the Gardens'], suburb: ['the New Town'], village: ['the Old Village'], temple: ['the Mosque Quarter'] },
	tr: { downtown: ['Merkez'], oldtown: ['Eski Şehir'], residential: ['{w} Mahallesi'], market: ['Çarşı'], industrial: ['Sanayi'], waterfront: ['Sahil', 'Liman'], campus: ['Kampüs'], park: ['{w} Parkı'], suburb: ['Yeni Mahalle'], village: ['Köy'], temple: ['Cami Mahallesi'] },
	ru: { downtown: ['Tsentr'], oldtown: ['Stary Gorod'], residential: ['{w} rayon', 'Mikrorayon'], market: ['Rynok'], industrial: ['Promzona'], waterfront: ['Naberezhnaya'], campus: ['Universitetsky Gorodok'], park: ['Park {w}'], suburb: ['Prigorod'], village: ['Derevnya'], temple: ['Sobornaya Ploshchad'] },
	zh: { downtown: ['Central District (Zhongxin Qu)'], oldtown: ['Old City (Laocheng)'], residential: ['{w} Lu neighbourhood', 'New Village (Xincun)'], market: ['Night Market Street'], industrial: ['Development Zone (Kaifaqu)'], waterfront: ['Riverside (Binjiang)'], campus: ['University Town'], park: ['{w} Park'], suburb: ['New District (Xinqu)'], village: ['Old Village'], temple: ['Temple Street'] },
	ja: { downtown: ['Ekimae (station front)'], oldtown: ['Jōkamachi (old castle town)'], residential: ['{w}-chō'], market: ['Shōtengai (shopping arcade)'], industrial: ['Kōgyō Chitai (industrial zone)'], waterfront: ['Minato (harbour)'], campus: ['Gakuen-toshi'], park: ['{w} Kōen'], suburb: ['New Town'], village: ['Mura'], temple: ['Monzenmachi (temple town)'] },
	ko: { downtown: ['Dosim (downtown)'], oldtown: ['Hanok Maeul'], residential: ['{w}-dong'], market: ['Sijang (market)'], industrial: ['Industrial Complex'], waterfront: ['Port'], campus: ['University Street'], park: ['{w} Park'], suburb: ['New Town'], village: ['Maeul'], temple: ['Temple Road'] },
	hi: { downtown: ['City Centre'], oldtown: ['Old City'], residential: ['{w} Nagar', '{w} Colony'], market: ['the Bazaar'], industrial: ['Industrial Area'], waterfront: ['the Ghats'], campus: ['University Area'], park: ['{w} Bagh'], suburb: ['New Township'], village: ['Gaon'], temple: ['Temple Road'] },
	sw: { downtown: ['Town Centre (Mjini)'], oldtown: ['Old Town (Mji wa Kale)'], residential: ['{w} Estate'], market: ['the Soko (market)'], industrial: ['Industrial Area'], waterfront: ['the Seafront'], campus: ['University Hill'], park: ['{w} Gardens'], suburb: ['New Estate'], village: ['Kijiji'], temple: ['Cathedral Hill'] },
};
const LANG_NAME = { en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', it: 'Italian', de: 'German', nl: 'Dutch', el: 'Greek', tr: 'Turkish', ar: 'Arabic', fa: 'Persian', hi: 'Hindi', ur: 'Urdu', bn: 'Bengali', ta: 'Tamil', ml: 'Malayalam', mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', zh: 'Chinese', yue: 'Cantonese', wuu: 'Shanghainese', ja: 'Japanese', ko: 'Korean', ru: 'Russian', uk: 'Ukrainian', pl: 'Polish', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', sv: 'Swedish', nb: 'Norwegian', da: 'Danish', fi: 'Finnish', is: 'Icelandic', ga: 'Irish', cy: 'Welsh', ca: 'Catalan', sw: 'Swahili', am: 'Amharic', ha: 'Hausa', so: 'Somali', mg: 'Malagasy', vi: 'Vietnamese', th: 'Thai', km: 'Khmer', lo: 'Lao', my: 'Burmese', ms: 'Malay', id: 'Indonesian', fil: 'Filipino', mn: 'Mongolian', bo: 'Tibetan', ne: 'Nepali', ka: 'Georgian', hy: 'Armenian', az: 'Azerbaijani', uz: 'Uzbek', kk: 'Kazakh', ug: 'Uyghur', ht: 'Haitian Creole', mt: 'Maltese', sq: 'Albanian', bg: 'Bulgarian', sr: 'Serbian', hr: 'Croatian', bs: 'Bosnian', sl: 'Slovenian', lt: 'Lithuanian', si: 'Sinhala', dz: 'Dzongkha' };
export const langName = (code) => LANG_NAME[String(code || 'en').split('-')[0]] || code;

// which of a region's building types suit a kind of district, and what stands there otherwise
const ARCH_FIT = {
	residential: /house|flat|rowhouse|row house|bungalow|cottage|apartment|home|townhouse|villa|hut|\bger\b|yurt|courtyard|terrace|tenement|block|hanok|machiya|siheyuan|shotgun|brownstone|walk-up|riad|compound|croft|cabin|izba/i,
	suburb: /house|bungalow|ranch|villa|cottage|home|tract|semi-detached|split-level/i,
	market: /shop|market|store|stall|souk|souq|bazaar|café|cafe|restaurant|taqueria|diner|bar\b|arcade|mall|kiosk|duka|bodega|hawker|chai|tea ?house|pub|dhaba|taverna|izakaya|konbini|deli|bakery/i,
	oldtown: /church|temple|mosque|minaret|historic|colonial|palace|townhouse|gate|mission|adobe|victorian|castle|shrine|riad|hutong|siheyuan|machiya|stone|timber|half-timbered|pagoda|burgher|medina|kasbah|dzong|monaster|cathedral|pueblo/i,
	downtown: /tower|office|skyscraper|bank|hall|hotel|station|block|glass/i,
	industrial: /warehouse|factory|port|crane|mill|dock|depot|shed|gin|tipple|refinery|packing/i,
	waterfront: /pier|harbou?r|wharf|boat|fish|beach|lifeguard|seafront|quay|dock|houseboat|lighthouse|stilt|ghat|malecón|corniche/i,
	temple: /church|temple|mosque|shrine|pagoda|stupa|cathedral|monaster|chapel|gompa|wat\b/i,
	village: /farm|barn|cottage|hut|cabin|village|croft|granary|house/i,
};
const ARCH_ELSE = { industrial: 'warehouses, depots and yards', waterfront: 'promenade of cafés and moorings', campus: 'university halls round green quads', park: 'lawns, paths, a bandstand and old trees' };
const wordsOf = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter((w) => w.length >= 4 && !/^(with|over|from|into|great|grand|tall|long|with|the|city|town|old|new|park|street|tower|house|hall)$/.test(w));
const shuffle = (L, r) => { const a = L.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- from the atlas alone ----------
export function fallbackBrief(city) {
	const R = region(city.region) || region('na');
	const r = rng('brief:' + city.id);
	const pop = Math.max(0, Math.min(5, city.pop | 0));
	const lang = R.lang || 'en', L = DN[lang.split('-')[0]] || DN.en;
	const words = R.streets?.words?.length ? R.streets.words : ['Main'];
	const fill = (t) => t.replace('{city}', city.name).replace('{w}', () => words[Math.floor(r() * words.length)]);
	const types = R.arch?.types || [], style = R.arch?.style || '';
	const dens = R.settle?.density ?? 0.4;
	const watery = /harbou?r|port|beach|bay|sea|river|lake|pier|wharf|coast|canal|lagoon|island/i.test(city.char + ' ' + city.landmarks.join(' '));
	const oldish = /old|medina|walled|hutong|historic|ancient|colonial|medieval|baroque|castle|fort/i.test(city.char + ' ' + (R.settle?.pattern || []).join(' ')) || !/^en-(US|AU|CA)/.test(lang);
	// the districts: a heart, homes, a market, then what a place of its size and setting has
	const kinds = [oldish ? 'oldtown' : 'downtown', 'residential', 'market'];
	if (pop >= 3) kinds.splice(1, 0, oldish ? 'downtown' : 'oldtown');
	if (watery) kinds.push('waterfront');
	if (pop >= 2) kinds.push(pop >= 3 ? 'industrial' : 'suburb');
	if (pop >= 4) kinds.push('campus');
	if (pop === 0) kinds.splice(0, kinds.length, 'village', 'residential', r() < 0.5 ? 'market' : 'park');
	const K = kinds.slice(0, [3, 3, 4, 5, 6, 6][pop]);
	const lowH = dens < 0.2 ? [1, 2] : dens < 0.5 ? [1, 3] : dens < 0.8 ? [2, 4] : [3, 6];
	const districts = K.map((kind, i) => {
		const names = L[kind] || DN.en[kind];
		let height = lowH.slice();
		if (kind === 'downtown') height = [[2, 3], [3, 6], [5, 12], [8, 30], [15, 60], [20, 90]][pop];
		if (kind === 'oldtown') height = [Math.max(1, lowH[0]), Math.max(3, lowH[1])];
		if (kind === 'industrial' || kind === 'market') height = [1, 3];
		const fit = types.filter((t) => ARCH_FIT[kind]?.test(t)), from = fit.length ? fit : ARCH_ELSE[kind] ? [] : types;
		const arch = kind === 'downtown' && pop >= 3 ? 'glass and concrete towers over ' + (fit[0] || types[0] || 'older blocks') : from.length ? from[(i + Math.floor(r() * from.length)) % from.length] : ARCH_ELSE[kind] || style;
		return { name: fill(names[Math.floor(r() * names.length)]), kind, share: kind === 'residential' ? 0.4 : kind === 'suburb' ? 0.25 : 0.12, architecture: arch, height };
	});
	normShares(districts);
	// the landmarks: the city's own, each with a stand-in look: the region's that shares a word
	// with it, else the region's of the same kind, else a plain one
	const lm = (R.lm || []).map((look) => ({ look, kind: landmarkKind(look), words: wordsOf(look) })), used = new Set();
	const landmarks = city.landmarks.slice(0, 5).map((name) => {
		const kind = landmarkKind(name), W = wordsOf(name);
		const free = lm.filter((x) => !used.has(x.look)), shares = (x) => x.words.some((w) => W.includes(w));
		const hit = (kind !== 'other' && (free.find((x) => x.kind === kind && shares(x)) || free.find((x) => x.kind === kind))) || free.find(shares);
		if (hit) used.add(hit.look);
		return { look: hit ? hit.look : kind === 'other' ? `${style ? style.split(' ')[0] + ' ' : ''}landmark` : GENERIC[kind], name, kind: hit ? hit.kind : kind };
	});
	for (const x of shuffle(lm, r)) { if (landmarks.length >= 3) break; if (!used.has(x.look)) { used.add(x.look); landmarks.push({ look: x.look, name: '', kind: x.kind }); } }
	// the words: street names, signs and chatter
	const streets = new Set();
	for (let k = 0; streets.size < 14 && k < 60; k++) streets.add(streetName(R, r));
	const S = R.say || {}, food = R.food || [];
	const signs = shuffle(S.signs || [], r).slice(0, 14);
	for (const f of shuffle(food, r)) { if (signs.length >= 12) break; const u = f.toUpperCase(); if (!signs.includes(u)) signs.push(u); }
	const greet = S.greet?.[0] || 'Hello!', bye = S.bye?.[0] || 'Goodbye!';
	const chatter = shuffle(S.chatter || [], r).slice(0, 14);
	const pad = [`${greet} Welcome to ${city.name}!`, city.landmarks[0] ? `Have you been to the ${city.landmarks[0]} yet?` : '', food[0] ? `Best ${food[0]} in ${city.name}, I promise.` : '', ...shuffle(S.greet || [], r), ...shuffle(S.bye || [], r), bye].filter(Boolean);
	for (const p of pad) { if (chatter.length >= 12) break; if (!chatter.includes(p)) chatter.push(p); }
	const M = musicOf(R.id);
	const genre = M.genres.length ? M.genres[Math.floor(r() * Math.min(3, M.genres.length))] : 'folk';
	const bpm = Math.round(M.bpm[0] + (M.bpm[1] - M.bpm[0]) * (0.3 + r() * 0.4));
	return {
		v: BRIEF_SCHEMA, id: city.id, city: city.name, region: R.id, country: city.country || R.country || '', lang, source: 'atlas',
		vibe: clean([city.char, R.char].filter(Boolean).join('. '), 200) || R.name,
		districts, landmarks, streets: [...streets], signs: signs.slice(0, 20), chatter: chatter.slice(0, 20),
		music: { genre, bpm, scale: M.scale },
		wardrobe: shuffle(R.wear || [], r).slice(0, 6), food: shuffle(food, r).slice(0, 8), vehicles: (R.road?.vehicles || []).slice(0, 6), vegetation: shuffle(R.veg || [], r).slice(0, 6),
		pop: POP[pop],
	};
}
function normShares(D) { const t = D.reduce((a, d) => a + d.share, 0) || 1; for (const d of D) d.share = Math.round(d.share / t * 100) / 100; }

// ---------- from what the model wrote: checked, clamped, gaps filled from base ----------
export function validateBrief(raw, base) {
	const B = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : Array.isArray(raw) && raw[0] && typeof raw[0] === 'object' ? raw[0] : {};
	const out = { ...base, districts: base.districts, landmarks: base.landmarks };
	let took = 0;
	const vibe = clean(B.vibe ?? B.description ?? B.mood, 200);
	if (vibe.length > 12) { out.vibe = vibe; took++; }
	// districts
	const D = Array.isArray(B.districts) ? B.districts : [];
	const districts = [];
	for (const d of D) {
		if (districts.length >= LIMITS.districts[1]) break;
		const o = d && typeof d === 'object' ? d : { name: d };
		const name = clean(o.name ?? o.district, 40);
		if (!name || districts.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
		const kind = kindOfDistrict(DISTRICT_KINDS.includes(String(o.kind).toLowerCase()) ? String(o.kind).toLowerCase() : (o.kind || o.type || name));
		let share = +o.share; if (!Number.isFinite(share) || share <= 0) share = kind === 'residential' ? 0.35 : 0.15;
		if (share > 1) share /= 100;
		districts.push({ name, kind, share: Math.min(1, share), architecture: clean(o.architecture ?? o.style ?? o.buildings, 90) || base.districts[0]?.architecture || '', height: heightOf(o.height ?? o.storeys ?? o.floors) });
	}
	// (shares already summing to 1 are left as they are, so a kept brief reads back the same)
	if (districts.length >= LIMITS.districts[0]) { if (Math.abs(districts.reduce((a, d) => a + d.share, 0) - 1) > 0.02) normShares(districts); out.districts = districts; took++; }
	// landmarks
	const Lm = Array.isArray(B.landmarks) ? B.landmarks : [];
	const landmarks = [];
	for (const l of Lm) {
		if (landmarks.length >= LIMITS.landmarks[1]) break;
		const o = l && typeof l === 'object' ? l : { look: l };
		const look = clean(o.look ?? o.description ?? o.standIn ?? o.type ?? o.name, 70), name = clean(o.name ?? o.of ?? '', 60);
		if (!look || landmarks.some((x) => x.look.toLowerCase() === look.toLowerCase())) continue;
		landmarks.push({ look, name: name === look ? '' : name, kind: landmarkKind(look + ' ' + name) });
	}
	if (landmarks.length >= LIMITS.landmarks[0]) { out.landmarks = landmarks; took++; }
	// the lists: the model's where it gave enough, topped up from base
	for (const key of ['streets', 'signs', 'chatter', 'wardrobe', 'food', 'vehicles', 'vegetation']) {
		const lim = LIMITS[key], L = cleanList(B[key], lim, key === 'chatter' ? 140 : key === 'streets' ? 48 : 60);
		if (L.length < Math.max(2, Math.ceil(lim[0] / 2))) continue;
		for (const x of base[key] || []) { if (L.length >= lim[0]) break; if (!L.some((y) => y.toLowerCase() === x.toLowerCase())) L.push(x); }
		out[key] = L.slice(0, lim[1]); took++;
	}
	// the music
	const M = B.music && typeof B.music === 'object' ? B.music : { genre: B.music ?? B.genre, bpm: B.bpm ?? B.tempo };
	const genre = clean(M.genre ?? M.style, 40);
	if (genre) {
		let bpm = Math.round(+String(M.bpm ?? M.tempo ?? '').replace(/[^\d.]/g, ''));
		if (!Number.isFinite(bpm) || bpm < 50 || bpm > 200) bpm = base.music.bpm;
		out.music = { genre, bpm, scale: base.music.scale };
		took++;
	}
	out.took = took;
	return out;
}

// ---------- asking the model: three short questions, each a small JSON object ----------
export const SYSTEM = 'You are a world designer for a game that recreates real places with affection. Reply with one JSON object only: no prose, no markdown, no comments. Keep every string short. Be authentic and warm: the things locals know and smile at, their food, music, streets, customs and humour. Describe places, not people. Never mock anyone; no slurs, and nothing about intelligence, poverty or crime.';
// what the atlas knows of a place, a few short lines (for a generated town, where it is and
// what is near, but never its name: that is written {town})
export function briefFacts(city) {
	const R = region(city.region) || region('na');
	const up = (R.names || []).slice(1).reverse().filter((n) => n !== city.name).slice(0, 2);
	const where = city.gen ? `a ${POP[city.pop | 0]} in ${up.join(', ') || R.name}` : [city.name, ...up].join(', ');
	const near = city.gen ? citiesNear(city.lat, city.lon, 120, 3).map((c) => `${c.name} (${Math.round(c.km)} km)`) : [];
	return [
		`Place: ${where}${city.country ? ' (' + city.country + ')' : ''}. Size: ${POP[city.pop | 0]}.`,
		`Character: ${city.gen ? R.char || '' : city.char || R.char}.`,
		near.length ? `Nearest known places: ${near.join('; ')}.` : '',
		city.landmarks?.length ? `Known landmarks: ${city.landmarks.join('; ')}.` : '',
		`Architecture: ${R.arch?.style || ''}; ${(R.arch?.types || []).slice(0, 5).join(', ')}.`,
		`Climate: ${R.climate?.kind || ''}; plants: ${(R.veg || []).slice(0, 6).join(', ')}.`,
		`Food: ${(R.food || []).slice(0, 6).join(', ')}. Music: ${(R.music?.genres || []).join(', ')}.`,
		`Local language: ${langName(R.lang)}.`,
	].filter(Boolean).join('\n');
}
export function briefPrompts(city, base) {
	const R = region(city.region) || region('na');
	const facts = briefFacts(city);
	const slang = (R.say?.words || []).slice(0, 8).join('; '), greet = (R.say?.greet || []).slice(0, 3).join(' ');
	const lang = langName(R.lang);
	return [
		{
			part: 'look', maxTokens: 420,
			user: `${facts}\n\nDescribe how ${city.name} looks and feels. Return JSON with these keys:\n{"vibe":"one sentence","districts":[{"name":"local district name","kind":"downtown|oldtown|residential|market|industrial|waterfront|campus|park|suburb|village|temple","share":0.3,"architecture":"a few words","height":"low|mid|high|tower"}],"landmarks":[{"look":"generic look, e.g. gold-domed capitol","name":"the real landmark"}],"music":{"genre":"","bpm":100},"wardrobe":[],"food":[],"vehicles":[],"vegetation":[]}\nGive ${Math.min(6, 3 + (city.pop | 0) / 2 | 0)} districts, 3 to 5 landmarks, and 4 to 6 items in each list.`,
			accept: (v) => (v && (Array.isArray(v.districts) || Array.isArray(v.landmarks) || v.vibe) ? v : null),
		},
		{
			part: 'words', maxTokens: 360,
			user: `${facts}\nStreet names there look like: ${base.streets.slice(0, 3).join('; ')}.\nSigns there look like: ${base.signs.slice(0, 3).join('; ')}.\n\nReturn JSON: {"streets":[14 street names in ${city.name}'s own style and language],"signs":[14 short shop, café and street sign texts, as locals write them, in ${lang}${/^English/.test(lang) ? ' with local slang' : ''}]}`,
			accept: (v) => (v && (cleanList(v.streets, LIMITS.streets).length >= 5 || cleanList(v.signs, LIMITS.signs).length >= 5) ? v : null),
		},
		{
			part: 'voices', maxTokens: 360,
			user: `${facts}\nLocal greetings: ${greet || 'hello'}. Local words: ${slang || 'none given'}.\n\nReturn JSON: {"chatter":[12 short things people in ${city.name} say in passing on the street: friendly, everyday, under 14 words each, in English flavoured with local words${lang === 'English' ? ' and slang' : ' and a few words of ' + lang}]}`,
			accept: (v) => (v && cleanList(v.chatter ?? v.lines, LIMITS.chatter).length >= 5 ? { chatter: v.chatter ?? v.lines } : null),
		},
	].map((P) => ({ ...P, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: P.user }], retry: [{ role: 'system', content: SYSTEM }, { role: 'user', content: P.user + '\nOnly the JSON object, starting with { and ending with }.' }] }));
}

// ---------- asking once, off the device, for the brief everyone shares ----------
// One request per place, answered as JSON in this shape (structured output: no lengths or
// ranges in a schema, so the counts are in the words and validateBrief clamps them). Built
// from the atlas alone: nothing a player sends ever reaches the words.
export const TOWN = '{town}';
const STR = { type: 'string' }, LIST = { type: 'array', items: STR };
const obj = (props) => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
export const BRIEF_JSON_SCHEMA = obj({
	vibe: STR,
	districts: { type: 'array', items: obj({ name: STR, kind: { type: 'string', enum: DISTRICT_KINDS }, share: { type: 'number' }, architecture: STR, height: { type: 'string', enum: Object.keys(HEIGHT) } }) },
	landmarks: { type: 'array', items: obj({ look: STR, name: STR }) },
	streets: LIST, signs: LIST, chatter: LIST,
	music: obj({ genre: STR, bpm: { type: 'integer' } }),
	wardrobe: LIST, food: LIST, vehicles: LIST, vegetation: LIST,
});

export function briefRequest(city) {
	const R = region(city.region) || region('na');
	const base = fallbackBrief(city), lang = langName(R.lang), name = city.gen ? TOWN : city.name;
	const slang = (R.say?.words || []).slice(0, 8).join('; '), greet = (R.say?.greet || []).slice(0, 3).join(' ');
	const user = [
		briefFacts(city),
		`Street names there look like: ${base.streets.slice(0, 3).join('; ')}.`,
		`Signs there look like: ${base.signs.slice(0, 3).join('; ')}.`,
		`Local greetings: ${greet || 'hello'}. Local words: ${slang || 'none given'}.`,
		'',
		city.gen
			? `This is a small place the game made up, so it has no real name here: write ${TOWN} wherever its name belongs, and give its landmarks an empty name (they stand for nothing real).`
			: '',
		`Write the brief for ${name}, one JSON object:`,
		'- vibe: one sentence on how it looks and feels.',
		`- districts: ${Math.min(6, 3 + (city.pop | 0) / 2 | 0)} districts with local names; kind is the nearest of the listed kinds; share is its part of the place (they sum to 1); architecture in a few words; height of its buildings.`,
		`- landmarks: ${city.gen ? '1 to 3' : '3 to 5'}. look is a generic stand-in a game can build (e.g. "red suspension bridge"); name is the real landmark it stands for, or "".`,
		`- streets: 14 street names in ${name}'s own style and language.`,
		`- signs: 14 short shop, café and street sign texts as locals write them, in ${lang}${/^English/.test(lang) ? ' with local slang' : ''}.`,
		`- chatter: 12 short things people say in passing on the street: friendly, everyday, under 14 words each, in English flavoured with local words${lang === 'English' ? ' and slang' : ' and a few words of ' + lang}.`,
		'- music: the genre that fits the place, and its tempo in bpm (60 to 180).',
		'- wardrobe, food, vehicles, vegetation: 4 to 6 short items each.',
	].filter((x, i, L) => x || L[i - 1]).join('\n');
	return { system: SYSTEM, user };
}

// what a reply makes: the brief (source 'llm', or 'mixed' where the atlas filled much in), or
// null when too little of it could be used
export function briefFromReply(value, city) {
	const b = validateBrief(value, fallbackBrief(city));
	if (b.took < 3) return null;
	b.source = b.took >= 9 ? 'llm' : 'mixed';
	delete b.took;
	return b;
}

// kept and sent without what every player works out from the atlas (the id, names and size)
const OWN = ['source', 'vibe', 'districts', 'landmarks', 'streets', 'signs', 'chatter', 'music', 'wardrobe', 'food', 'vehicles', 'vegetation'];
export function compactBrief(b) {
	const out = {};
	for (const k of OWN) if (b[k] !== undefined) out[k] = k === 'music' ? { genre: b.music.genre, bpm: b.music.bpm } : b[k];
	return out;
}
// a kept brief made whole for this player: a town's name put in, then checked again against
// the atlas (the same for everyone, and never a faceplate)
export function canonicalBrief(kept, city) {
	if (!kept || typeof kept !== 'object' || Array.isArray(kept)) return null;
	const named = city.gen ? nameTown(kept, city.name) : kept;
	if (named.source === 'atlas') return keptAtlas(named, city);
	const b = validateBrief(named, fallbackBrief(city));
	const took = b.took;
	delete b.took;
	if (!took) return null;
	b.source = ['llm', 'mixed', 'atlas'].includes(kept.source) ? kept.source : 'llm';
	return b;
}
// an atlas brief kept on the server reads back as it was made (the atlas made it, so it is
// not checked as a model's words are; only its shape is)
function keptAtlas(k, city) {
	const b = fallbackBrief(city);
	const strs = (L) => Array.isArray(L) && L.every((x) => typeof x === 'string');
	if (typeof k.vibe === 'string') b.vibe = k.vibe.slice(0, 200);
	for (const key of ['streets', 'signs', 'chatter', 'wardrobe', 'food', 'vehicles', 'vegetation']) if (strs(k[key])) b[key] = k[key].slice(0, LIMITS[key][1]).map((x) => x.slice(0, 140));
	if (Array.isArray(k.districts) && k.districts.length && k.districts.every((d) => d && typeof d.name === 'string' && DISTRICT_KINDS.includes(d.kind) && Number.isFinite(d.share))) b.districts = k.districts.slice(0, LIMITS.districts[1]).map((d) => ({ name: d.name, kind: d.kind, share: d.share, architecture: String(d.architecture ?? ''), height: heightOf(d.height) }));
	if (Array.isArray(k.landmarks) && k.landmarks.every((l) => l && typeof l.look === 'string')) b.landmarks = k.landmarks.slice(0, LIMITS.landmarks[1]).map((l) => ({ look: l.look, name: String(l.name ?? ''), kind: LANDMARK_KINDS.includes(l.kind) ? l.kind : landmarkKind(l.look + ' ' + (l.name ?? '')) }));
	if (k.music && typeof k.music.genre === 'string' && Number.isFinite(k.music.bpm)) b.music = { genre: k.music.genre, bpm: Math.max(50, Math.min(200, Math.round(k.music.bpm))), scale: b.music.scale };
	b.source = 'atlas';
	return b;
}
export function nameTown(v, name) {
	if (typeof v === 'string') return v.split(TOWN).join(name);
	if (Array.isArray(v)) return v.map((x) => nameTown(x, name));
	if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = nameTown(x, name); return o; }
	return v;
}

// ---------- the generated towns: 'gen:<slug>:<lat>,<lon>' ----------
export const genId = (name, lat, lon) => 'gen:' + slug(name || 'town') + ':' + lat.toFixed(2) + ',' + lon.toFixed(2);
const GEN_ID = /^gen:([a-z0-9]+(?:-[a-z0-9]+)*):(-?\d{1,2}\.\d{2}),(-?\d{1,3}\.\d{2})$/;
export function parseGenId(id) {
	const m = typeof id === 'string' && id.length <= 80 ? id.match(GEN_ID) : null;
	if (!m || m[1].length > 48) return null;
	const lat = +m[2], lon = +m[3];
	return Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { slug: m[1], lat, lon } : null;
}
// a generated town as a city record (the atlas must be loaded)
export function genCity({ id, name, lat, lon, pop = 1, char, landmarks }) {
	const at = regionAt(lat, lon);
	return { id: id || genId(name, lat, lon), name: name || 'Town', lat, lon, pop, char: char || `A ${pop >= 2 ? 'city' : 'town'} in ${at.name}`, landmarks: landmarks || [], region: at.id, regionName: at.name, country: at.profile.country || '', gen: true };
}
