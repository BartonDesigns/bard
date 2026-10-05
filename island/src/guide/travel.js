// Travel language resolves only to authored atlas places or existing local destinations.
// Broad regions choose an announced starting city, never an invented coordinate.
export const travelText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function travelRequest(text) {
	const q = travelText(text);
	if (/\b(dont|do not|not yet|not now|never|stop|cancel|if|hypothetically|without going)\b/.test(q)) return null;
	const polite = q.replace(/^(?:(?:hey|okay|ok|please)\s+)+/, '').replace(/\s+(?:please|for me|for us|thanks|thank you)$/, '');
	let m = polite.match(/^(?:(?:can|could|would|will) (?:you|we)\s+)?(?:please\s+)?(?:take|bring|send|transport|teleport|fly|guide|lead|show|move)(?:\s+(?:me|us))?(?:\s+(?:over to|to|toward|towards|around|into|in the direction of|near))?\s+(.+)$/);
	if (!m) m = polite.match(/^(?:(?:lets|let us|i want to|id like to|i would like to|i would love to|i feel like|can we|could we|we should|please)\s+)?(?:go|head(?:ing)?|travel|visit|explore|see|check out)(?:\s+(?:over to|to|around|into))?\s+(.+)$/);
	if (!m) m = polite.match(/^(?:i want|id like|i would like) (?:to go|to visit|to explore|a trip|to be taken)(?:\s+to)?\s+(.+)$/);
	return m ? m[1].replace(/^(?:somewhere|someplace|a place|a city|a town) (?:in|around|over in) /, '').replace(/^(?:over in|over to|over toward|over towards|in) /, '').trim() : null;
}

const GROUPS = [
	[['far east', 'far eastern', 'east asia', 'eastern asia', 'the orient'], ['kyoto', 'tokyo', 'beijing', 'seoul'], 'East Asia'],
	[['southeast asia', 'south east asia', 'southeastern asia'], ['bangkok', 'hanoi', 'singapore'], 'Southeast Asia'],
	[['south asia', 'indian subcontinent'], ['delhi', 'mumbai', 'kathmandu'], 'South Asia'],
	[['middle east', 'middle eastern', 'western asia'], ['dubai', 'amman', 'muscat'], 'the Middle East'],
	[['asia'], ['kyoto', 'beijing', 'bangkok'], 'Asia'],
	[['europe', 'western europe'], ['paris', 'rome', 'london'], 'Europe'],
	[['scandinavia', 'nordic countries', 'northern europe'], ['oslo', 'stockholm', 'copenhagen'], 'northern Europe'],
	[['africa'], ['nairobi', 'cairo', 'cape-town'], 'Africa'],
	[['south america', 'latin america'], ['rio-de-janeiro', 'buenos-aires', 'lima'], 'South America'],
	[['north america'], ['new-york', 'vancouver', 'mexico-city'], 'North America'],
	[['oceania', 'down under'], ['sydney', 'auckland'], 'Oceania'],
	[['pacific northwest'], ['seattle', 'portland', 'vancouver'], 'the Pacific Northwest'],
	[['far north', 'arctic', 'the arctic', 'somewhere cold', 'somewhere snowy', 'somewhere icy'], ['longyearbyen', 'tromso', 'iqaluit'], 'the far north'],
	[['the alps', 'alps', 'somewhere mountainous', 'snowy mountains', 'the mountains'], ['zermatt', 'chamonix', 'innsbruck'], 'the Alps'],
	[['the tropics', 'tropics', 'somewhere tropical', 'tropical island', 'somewhere warm'], ['honolulu', 'denpasar', 'singapore'], 'the tropics'],
	[['rainforest', 'the jungle', 'jungle', 'amazon', 'amazon rainforest'], ['manaus'], 'the Amazon'],
	[['desert', 'the desert', 'somewhere desert'], ['marrakesh', 'cairo', 'dubai'], 'a desert-region city'],
];
const COUNTRY_ALIASES = { uk: 'united kingdom', britain: 'united kingdom', 'great britain': 'united kingdom', england: 'united kingdom', usa: 'united states', us: 'united states', america: 'united states', korea: 'south korea', 'new zealand': 'new zealand' };
const key = (s) => travelText(s).replace(/^the /, '');
const cityTarget = (c) => ({ name: c.name, lat: c.lat, lon: c.lon, kind: 'town', fact: c.char || c.regionName || c.country || '', country: c.country, regionName: c.regionName, id: c.id });

// The atlas is lazy-loaded with the world. These authored fallbacks keep a first
// conversation useful while it is streaming, without inventing a destination.
const FALLBACK_CITIES = [
	['Kyoto', 35.0116, 135.7681, 'Japan'], ['Tokyo', 35.6762, 139.6503, 'Japan'], ['Beijing', 39.9042, 116.4074, 'China'], ['Seoul', 37.5665, 126.9780, 'South Korea'],
	['Bangkok', 13.7563, 100.5018, 'Thailand'], ['Hanoi', 21.0278, 105.8342, 'Vietnam'], ['Singapore', 1.3521, 103.8198, 'Singapore'], ['Delhi', 28.6139, 77.2090, 'India'], ['Mumbai', 19.0760, 72.8777, 'India'], ['Kathmandu', 27.7172, 85.3240, 'Nepal'],
	['Dubai', 25.2048, 55.2708, 'United Arab Emirates'], ['Amman', 31.9539, 35.9106, 'Jordan'], ['Muscat', 23.5880, 58.3829, 'Oman'], ['Paris', 48.8566, 2.3522, 'France'], ['Rome', 41.9028, 12.4964, 'Italy'], ['London', 51.5074, -0.1278, 'United Kingdom'],
	['Oslo', 59.9139, 10.7522, 'Norway'], ['Stockholm', 59.3293, 18.0686, 'Sweden'], ['Copenhagen', 55.6761, 12.5683, 'Denmark'], ['Nairobi', -1.2921, 36.8219, 'Kenya'], ['Cairo', 30.0444, 31.2357, 'Egypt'], ['Cape Town', -33.9249, 18.4241, 'South Africa'],
	['Rio de Janeiro', -22.9068, -43.1729, 'Brazil'], ['Buenos Aires', -34.6037, -58.3816, 'Argentina'], ['Lima', -12.0464, -77.0428, 'Peru'], ['New York', 40.7128, -74.0060, 'United States'], ['Vancouver', 49.2827, -123.1207, 'Canada'], ['Mexico City', 19.4326, -99.1332, 'Mexico'],
	['Sydney', -33.8688, 151.2093, 'Australia'], ['Auckland', -36.8509, 174.7645, 'New Zealand'], ['Seattle', 47.6062, -122.3321, 'United States'], ['Portland', 45.5152, -122.6784, 'United States'],
	['Longyearbyen', 78.2232, 15.6469, 'Norway'], ['Tromso', 69.6492, 18.9553, 'Norway'], ['Iqaluit', 63.7467, -68.5170, 'Canada'], ['Zermatt', 46.0207, 7.7491, 'Switzerland'], ['Chamonix', 45.9237, 6.8694, 'France'], ['Innsbruck', 47.2692, 11.4041, 'Austria'],
	['Honolulu', 21.3069, -157.8583, 'United States'], ['Denpasar', -8.6500, 115.2167, 'Indonesia'], ['Manaus', -3.1190, -60.0217, 'Brazil'], ['Marrakesh', 31.6295, -7.9811, 'Morocco'],
].map(([name, lat, lon, country]) => ({ id: travelText(name).replace(/ /g, '-'), name, lat, lon, country, regionName: country }));

export function resolveTravel(query, { cities = [], regions = [], local = [] } = {}) {
	const atlasCities = cities.length ? cities : FALLBACK_CITIES;
	let q = key(query).replace(/^(?:somewhere|someplace|a place|a city|a town) (?:in|around) /, '');
	if (!q || /^(?:there|here|east|west|north|south|somewhere|anywhere|that place)$/.test(q)) return { kind: 'clarify', message: 'Which region or city? You can say “the Far East”, “Japan”, “Paris”, or “somewhere snowy”.' };
	const exactLocal = local.find(t => key(t.name) === q);
	if (exactLocal) return { kind: 'destination', place: exactLocal, broad: false };
	const exactCities = atlasCities.filter(c => key(c.name) === q || key(c.id) === q);
	if (exactCities.length === 1) return { kind: 'destination', place: cityTarget(exactCities[0]), broad: false };
	if (exactCities.length > 1) return { kind: 'clarify', message: 'Which ' + exactCities[0].name + '? ' + exactCities.slice(0, 4).map(c => `${c.name}, ${c.country || c.regionName}`).join('; ') + '.', choices: exactCities.slice(0, 4).map(cityTarget) };
	// City and country together disambiguate repeated city names.
	const qualified = atlasCities.filter(c => [c.country, c.regionName].some(n => n && q === key(c.name + ' ' + n)));
	if (qualified.length === 1) return { kind: 'destination', place: cityTarget(qualified[0]), broad: false };
	const group = GROUPS.find(([aliases]) => aliases.some(alias => key(alias) === q));
	if (group) {
		const c = group[1].map(id => atlasCities.find(c => c.id === id || key(c.name) === key(id))).find(Boolean);
		if (c) return { kind: 'destination', place: cityTarget(c), broad: true, region: group[2] };
	}
	q = COUNTRY_ALIASES[q] || q;
	const R = regions.filter(r => key(r.name) === q), ids = R.map(r => r.id);
	const area = atlasCities.filter(c => key(c.country) === q || key(c.regionName) === q || ids.some(id => c.region === id || c.region?.startsWith(id + '.'))).sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name));
	if (area.length) return { kind: 'destination', place: cityTarget(area[0]), broad: true, region: area[0].country && key(area[0].country) === q ? area[0].country : R[0]?.name || query };
	const candidates = [...local, ...atlasCities.map(cityTarget)].filter(t => key(t.name).startsWith(q) || key(t.name).includes(q)).slice(0, 5);
	if (candidates.length === 1) return { kind: 'destination', place: candidates[0], broad: false };
	return { kind: 'clarify', message: candidates.length ? 'Which place did you mean? ' + candidates.map(c => c.name).join(', ') + '.' : `I couldn’t match “${query}” to the world atlas. Try a country, city, region such as the Far East, or somewhere snowy.`, choices: candidates };
}
