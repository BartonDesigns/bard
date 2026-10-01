// What people talk about, out in the world: the regional sheet a persona carries (persona.js
// puts it in the conversational model's prompt, and answers from it without a model). Their
// greeting in their own language with its meaning; the weather and the season as they are
// here this month (the polar night, the monsoon, the dry season, the blossom); the food;
// their work; the nearest landmark and its story; the road onward; a word of the language.
//
// It speaks plainly, as a neighbour would: no accents written out, no lectures, nobody
// performing their culture for a visitor.

import { today } from '../calendar.js';
import { languageOf } from './cultures.js';

const pick = (r, L) => (L && L.length ? L[Math.floor(r() * L.length)] : '');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const deg = (C, t) => (C.f ? `${Math.round(t * 9 / 5 + 32)} degrees` : `${t} degrees`);
const minus = (C, t) => (C.f ? deg(C, t) : t < 0 ? `minus ${-t}` : `${t} degrees`);

// a greeting and its meaning, from the atlas's lists ('Merhaba!' and 'merhaba: hello')
export function greeting(R, r, C = null) {
	const S = { ...(R?.say || {}) };
	if (C?.say) { S.greet = C.say.greet; S.words = [...C.say.words, ...(S.words || [])]; }
	const g = pick(r, S.greet) || 'Hello!';
	const plain = g.replace(/\(.*?\)/g, '').replace(/[!?.,¡¿]/g, '').trim().toLowerCase();
	let mean = '';
	for (const e of S.words || []) { const [k, v] = e.split(':'); if (k && v && plain.startsWith(k.trim().toLowerCase().replace(/[!?.,]/g, ''))) { mean = v.trim(); break; } }
	const roman = g.match(/\((.*?)\)/)?.[1] || '';
	// (the language's name is already on the greeting: not twice)
	if (roman && mean.endsWith(`(${roman})`)) mean = mean.slice(0, -roman.length - 2).trim();
	if (mean && /\(.*?\)$/.test(mean) && /\(.*?\)/.test(g)) mean = mean.replace(/\s*\([^)]*\)$/, '');
	return { text: g, mean, roman, english: /^(hi|hello|hey|morning|good|g'day|howdy)/i.test(plain) };
}
export function farewell(R, r) { return pick(r, R?.say?.bye) || 'Take care!'; }
// a word of the place and what it means
export function aWord(R, r) {
	const W = R?.say?.words;
	if (!W?.length) return null;
	const [k, v] = pick(r, W).split(':');
	return k && v ? { word: k.trim(), mean: v.trim() } : null;
}

// the weather and the season, said as people here would say it
export function weatherLine(kit, C, wx, r, R, coast = true) {
	const k = kit?.id || 'village', s = C.season, t = C.now, rain = (wx?.rain || 0) > 0.25;
	const L = [];
	if (rain && C.temp > 2) L.push('Wet one today, isn\'t it? It will clear by evening, or it won\'t.');
	if (rain && C.temp <= 2) L.push('Snowing again. Good for the skis, bad for the roads.');
	if (C.polar === 'night') L.push(`The sun won\'t be back over the hills until February. We have the moon, the lamps and the lights in the sky.`);
	if (C.polar === 'sun') L.push('The sun hasn\'t set in weeks. You stop knowing what time it is; the children play outside at midnight.');
	switch (k) {
		case 'station':
			L.push('The katabatic wind comes off the plateau like a door slamming. Rope lines between the buildings when it blows.', C.polar === 'sun' || (C.south && C.season === 'summer') ? 'Twenty-four hours of daylight: we sleep with the blinds taped down.' : `${minus(C, t)} today. Everything takes three times as long in the cold.`);
			break;
		case 'polar':
			if (C.temp < -5) L.push(`${minus(C, t)} this morning and the sea is frozen out past the point. Good for travelling, at least.`, 'The floe edge is a day out by snowmobile. That\'s where the seals are, and the hunters.');
			else if (C.temp < 3) L.push(s === 'autumn' ? 'New ice is forming in the bay; a few more weeks and we can go out on it.' : 'The ice is breaking up; you can hear it groaning at night.', `${minus(C, t)}, and the wind off the glacier makes it feel colder.`);
			else L.push(`${deg(C, t)}, practically a heat wave. The ice went out of the bay weeks ago.`, 'Summer: the boats are all out, and nobody sleeps much in this light.');
			break;
		case 'snow':
			if (s === 'winter') L.push(`${minus(C, t)}, and the snow\'s up to the windows. The stove goes day and night.`, 'The lake is frozen thick; the winter road runs right across it.');
			else if (s === 'spring') L.push('The snow\'s going soft. The river ice will break any day now, with a bang you can hear in the village.');
			else if (s === 'summer') L.push('Long light and mosquitoes. Berry season soon, cloudberries if we\'re lucky.', `${deg(C, t)} today, warm for us.`);
			else L.push('First frost last night. Time to get the wood in before the snow.', 'The birches have turned; the first snow can\'t be far off.');
			break;
		case 'alpine':
			if (s === 'winter') L.push('Fresh snow on the passes. The road over is closed till spring.', 'The avalanche warning is up, stay on the marked paths.');
			else if (s === 'summer') L.push('The cows are up at the alp. We bring them down in September, with flowers on their heads.', 'Thunderstorms most afternoons in summer. Be off the ridge by two.');
			else L.push('Between seasons: no snow on the slopes yet, but the peaks are white.', 'The larches are going gold up the valley.');
			break;
		case 'himalaya': case 'andes':
			L.push(s === 'winter' || C.temp < 3 ? 'Cold at night, very cold. In the sun at midday it\'s almost warm.' : 'The sun up here burns, even when the air is cold. Cover your head.');
			if (k === 'himalaya') L.push(s === 'monsoon' || (s === 'summer' && C.rain > 600) ? 'The monsoon clouds sit on the valleys; up here we get rain and mist.' : 'Clear days now, the mountains out every morning.');
			else L.push(s === 'wet' || (C.south && (s === 'summer')) ? 'The rains are here. The paths turn to mud.' : 'Dry season, cold nights, blue sky every day.');
			break;
		case 'desert': case 'pueblo': case 'outback':
			if (C.now > 30) L.push(`It\'ll be ${deg(C, Math.max(t, C.temp + 6))} by the afternoon. Everyone rests through the middle of the day.`, 'In this heat you work at dawn and in the evening, and you drink before you are thirsty.');
			else L.push('Warm days, but the nights are cold out here. You\'d be surprised.', 'If the wind gets up this afternoon we\'ll have dust. Keep a cloth over your mouth.');
			break;
		case 'bazaar':
			L.push(C.now > 28 ? 'Hot in the square, but the souk stays cool under its roof. That\'s what the roof is for.' : 'Good weather for the market: not too hot, everyone\'s out.');
			if (s === 'winter') L.push('It rained last night, the lanes are slippery by the spice sellers.');
			break;
		case 'jungle':
			if (s === 'wet' || s === 'monsoon') L.push('It rains every afternoon now, you could set a clock by it. The river\'s up.', 'Everything grows in this season, you can almost hear it.');
			else L.push('The dry months. The river is low and the boats have to be pushed over the sandbars.', 'Hot and still. The rain will come back, it always does.');
			break;
		case 'island':
			if (s === 'wet') L.push('Wet season: big rain in the afternoons, and we keep an ear on the radio for cyclones.', 'Heavy and warm. The breadfruit is coming in.');
			else L.push('Dry season: blue sky, the trade wind, the lagoon like glass in the mornings.', 'The trade wind keeps it cool. Good fishing on the reef this week.');
			break;
		case 'savanna': case 'sahel':
			if (s === 'wet') L.push('The rains came last week. In a few days the grass will be green to the horizon.', 'Planting time. Everyone is in the fields from first light.');
			else L.push('Dry season. The cattle walk further every day for grass and water.', k === 'sahel' && C.temp < 28 ? 'The harmattan is blowing: dust in the air, cool mornings, everything a little orange.' : 'Hot and dry. We\'re all watching the sky for the first rains.');
			break;
		case 'steppe':
			if (s === 'winter') L.push(`${minus(C, t)} at night. In a winter like this we watch the animals very closely.`, 'Cold but clear: the sky here is blue three hundred days a year.');
			else if (s === 'summer') L.push('The grass is good this year; the horses are fat. Naadam soon.', 'Summer is short here. We make the most of it.');
			else L.push('The wind has turned cold. We\'ll move to the winter camp soon, out of the wind.');
			break;
		case 'eastvillage': case 'eastcity':
			if (s === 'spring') L.push(C.temp < 6 ? 'The plum blossom is out, even with frost in the mornings.' : 'The cherry blossom is out. Everyone is under the trees with a picnic.');
			else if (s === 'summer') L.push(k === 'eastvillage' ? 'The rice is up to my knees. The frogs sing all night in the paddies.' : 'Humid! The rainy season. Carry an umbrella, always.');
			else if (s === 'autumn') L.push(k === 'eastvillage' ? 'Harvest is nearly in. In a few weeks the maples on the hill go red.' : 'The best weather of the year: blue skies, and the plane trees going gold along the streets.');
			else L.push('Cold and dry. The mountains have snow on top this week.');
			break;
		case 'southasia': case 'southcity':
			if (s === 'monsoon') L.push('The monsoon is here: everything green, everything wet. The roads are rivers some days.');
			else if (C.now > 33) L.push(`${deg(C, Math.max(t, C.temp + 5))} in the afternoon, the hot weather before the rains. Everyone\'s watching the sky.`);
			else L.push('Pleasant now, the best time of year. Cool mornings, a bit of mist.');
			break;
		case 'mediterranean':
			if (s === 'summer') L.push('Thirty-something every day, and the cicadas never stop. The afternoon rest isn\'t optional.');
			else if (s === 'winter') L.push('Rain on the hills; the olives are coming in. The whole family helps with the harvest.');
			else L.push(coast ? 'The best time of year: warm sun, cool evenings, the sea still warm enough to swim.' : 'The best time of year: warm sun, cool evenings, and the markets full of pomegranates.');
			break;
		default:
			L.push(s === 'winter' ? `${deg(C, t)} and grey. The wood stove is lit.` : s === 'summer' ? `${deg(C, t)}, a proper summer day.` : 'Changeable weather. Four seasons in a day, some days.');
	}
	void R;
	const out = pick(r, L);
	return out ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

// a line about the food here
export function foodLine(R, r, place) {
	const f = pick(r, R?.food);
	if (!f) return '';
	return pick(r, [`You have to try the ${f} here. ${place ? `Everyone in ${place} has an opinion about who makes it best.` : ''}`, `If you're hungry: ${f}. Ask anyone, they'll point you to their aunt's.`, `${f[0].toUpperCase() + f.slice(1)}: that's what people have round here. Simple, and the best.`]).trim();
}
// a line about the nearest landmark and its story
export function landmarkLine(L, r) {
	if (!L) return '';
	const where = L.km < 0.3 ? 'right here' : `about ${L.km < 1 ? Math.round(L.km * 10) * 100 + ' metres' : L.km + ' km'} ${L.dir}`;
	const N = L.name.charAt(0).toUpperCase() + L.name.slice(1);
	return L.real ? `${N} is ${where}. ${L.tale}` : pick(r, [`Have you seen ${L.name}? It's ${where}. ${L.tale}`, `${N}, ${where}. My grandmother told it like this. ${L.tale}`]);
}
// the road onward
export function onwardLine(O, kit, r, coast = true) {
	const way = (coast ? kit?.travel : kit?.travelInland || kit?.travel) || '';
	if (!O) return '';
	return pick(r, [`${O.name} is about ${O.km} km ${O.dir}, ${way || 'down the road'}.`, `Going on? ${O.name}, ${O.km} km ${O.dir}. ${way ? way[0].toUpperCase() + way.slice(1) + '.' : ''}`]).trim();
}

// the whole sheet, for a persona (here: region/here.js; r: the person's own random stream)
export function regionalSheet(H, r) {
	const R = H.region, kit = H.kit, C = H.climate || {};
	const g = greeting(R, r, H.culture), w = H.culture?.say && r() < 0.5 ? aWord({ say: { words: H.culture.say.words } }, r) : aWord(R, r);
	const place = H.town?.name || (H.regionName ? H.regionName[0].toUpperCase() + H.regionName.slice(1) : 'here');
	return {
		place, region: H.regionName, country: H.country, kit: kit?.name || '', culture: H.culture?.key,
		greet: g, bye: farewell(R, r), word: w, lang: languageOf(H.culture, R?.lang),
		weather: weatherLine(kit, C, H.wx, r, R, H.coast !== false), season: C.season, month: MONTHS[today().getMonth()], temp: C.now, f: !!C.f,
		food: foodLine(R, r, H.town?.name), foods: (R?.food || []).slice(0, 4),
		landmark: H.landmark ? { ...H.landmark, line: landmarkLine(H.landmark, r) } : null,
		onward: H.onward ? { ...H.onward, line: onwardLine(H.onward, kit, r, H.coast !== false) } : null,
		chatter: (R?.say?.chatter || []).slice(0, 6),
		known: H.known?.landmarks?.length ? `${H.known.town}: ${H.known.landmarks.join(', ')}` : '',
		travel: (H.coast === false && kit?.travelInland) || kit?.travel || '',
	};
}
