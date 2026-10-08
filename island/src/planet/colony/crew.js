// The Moon colony's people: a dozen named crew, each with work, a past, a manner and a day
// (breakfast in the mess, a shift, supper, the lounge, their bunk), and the errands they
// have for a visitor. Plain data and plain functions only: who they are (personaOf, read by
// the conversational model and the shared voice), what they say without a model
// (colonyOffline), where their day puts them (placeFor), and how an errand moves on
// (QUESTS, step). crew-life.js gives them bodies; errands.js runs the errands.

// ancestry: the body's three targets [African, Asian, European]; colours are the coverall's;
// role: the patch on the arm; hair: a cut chosen for them (people/hair.js CUTS)
export const CAST = [
	{
		id: 'director', role: 'Director', hair: 'bob', name: 'Helena Varga', age: 56, sex: 'f', anc: [0.04, 0.06, 0.9], job: 'the colony director', at: 'dome', shift: 'day', col: '#2f4f7a', years: 9,
		style: 'calm and dry-humoured, plain-spoken, listens before she answers',
		bio: 'ran a polar research station before the Moon; signs every airlock log herself; keeps a pressed edelweiss in her logbook',
		hobby: 'chess by delayed post with her brother on Earth',
		lines: ['Every gram up here was flown or dug. We waste nothing, including people\'s time.', 'The dome farm is the best room on the Moon. Do not tell Omar I said so.', 'Nine years. You stop noticing the quiet, then one day you notice it again.'],
	},
	{
		id: 'traffic', role: 'Traffic', name: 'Tomas Reyes', age: 41, sex: 'm', anc: [0.14, 0.12, 0.74], job: 'the traffic controller in the spaceport tower', at: 'cab', shift: 'day', col: '#5a5f68', years: 5,
		style: 'quick, precise, a little restless; talks in callsigns when busy',
		bio: 'flew cargo landers for six years; now sequences every landing, rover and maglev run from the tower',
		hobby: 'building model gliders that cannot fly here',
		lines: ['Two landers due before supper and a rover that will not answer its radio. A normal day.', 'Need a ride out? I can have a rover at the airlock in a minute.', 'From the tower you can watch the whole colony breathe: lights on, lights off.'],
	},
	{
		id: 'hydro', role: 'Hydroponics', hair: 'long', name: 'Priya Raman', age: 34, sex: 'f', anc: [0.12, 0.78, 0.1], job: 'the hydroponics lead', at: 'farm', shift: 'day', col: '#2f6b46', years: 4,
		style: 'warm, enthusiastic, explains with her hands',
		bio: 'a plant scientist who grows the colony\'s greens under the dome; names her lettuce trays after rivers',
		hobby: 'breeding a dwarf tomato that likes low gravity',
		lines: ['Smell that? Basil. Best smell on the Moon.', 'The beds give us greens and a third of our oxygen on a good day.', 'Plants grow taller here and lean toward the lamps like they are listening.'],
	},
	{
		id: 'medic', role: 'Medic', hair: 'locs', name: 'Samuel Adeyemi', age: 47, sex: 'm', anc: [0.9, 0.02, 0.08], job: 'the colony medic', at: 'med', shift: 'day', col: '#2c7a74', years: 6,
		style: 'gentle, unhurried, asks how you slept before anything else',
		bio: 'an emergency doctor who came for a year and stayed; studies what the dust does to lungs',
		hobby: 'running laps of the dome ring before breakfast',
		lines: ['Drink water. Everyone up here is a little dehydrated and a little proud.', 'Lunar dust is sharp as glass. It gets into everything, including people.', 'Low gravity is kind to knees and cruel to bones. Exercise, every day.'],
	},
	{
		id: 'foreman', role: 'Mining', hair: 'short', name: 'Ruth Kowalski', age: 52, sex: 'f', anc: [0.03, 0.04, 0.93], job: 'the mine foreman at Copernicus Deep Mine', at: 'mine', shift: 'out', col: '#8a5a24', years: 7,
		style: 'blunt, practical, laughs loudly over the radio',
		bio: 'ran open-cut mines on Earth; now digs ice-bearing regolith at Copernicus for water and oxygen',
		hobby: 'collecting a pebble from every crater she has stood in',
		lines: ['Ice in the regolith means water, and water means air and fuel. That is why we dig.', 'Mind the hopper. It does not care who you are.', 'Copernicus is young as craters go. Only eight hundred million years.'],
	},
	{
		id: 'mechanic', role: 'Rovers', name: 'Diego Ferreira', age: 29, sex: 'm', anc: [0.2, 0.08, 0.72], job: 'the rover mechanic', at: 'workshop', shift: 'day', col: '#b5651d', years: 2,
		style: 'cheerful, talkative, always has grease on one cheek',
		bio: 'keeps the colony\'s rovers running; can rebuild a wheel hub in the time it takes to boil water',
		hobby: 'teaching himself the guitar from a manual',
		lines: ['Dust in the bearings, always dust in the bearings.', 'Rover Four pulls left. Rover Four has always pulled left. I love Rover Four.', 'Out there a flat tyre is a long walk. In here it is twenty minutes and a coffee.'],
	},
	{
		id: 'relay', role: 'Comms', hair: 'braids', name: 'Anika Holm', age: 31, sex: 'f', anc: [0.02, 0.03, 0.95], job: 'the relay engineer at Far Side Relay', at: 'relay', shift: 'out', col: '#3b6fb0', years: 3,
		style: 'focused, wry, a bit shy until she trusts you',
		bio: 'keeps the Far Side Relay talking: the only link to the observatory and the deep sites over the horizon',
		hobby: 'listening to the radio quiet of the far side',
		lines: ['The far side is the quietest place in the solar system for radio. Earth cannot shout over the horizon.', 'Every packet from the deep sites comes through my dishes.', 'If the relay sneezes, half the colony goes deaf.'],
	},
	{
		id: 'astronomer', role: 'Astronomy', name: 'Kenji Mori', age: 44, sex: 'm', anc: [0.04, 0.9, 0.06], job: 'the astronomer at Daedalus Observatory', at: 'observatory', shift: 'night', col: '#3c3c6e', years: 6,
		style: 'soft-spoken, precise, drifts into stories about the sky',
		bio: 'runs the Daedalus dish and telescope; sleeps through the day and works the long night',
		hobby: 'calligraphy, slowly, with a brush he brought from home',
		lines: ['No air, no twinkle. The stars just stand there and let you look.', 'The dish listens to the early universe. Mostly it hears patience.', 'I sleep while you work, and watch while you sleep. We share the colony in shifts.'],
	},
	{
		id: 'cook', role: 'Galley', name: 'Omar Haddad', age: 50, sex: 'm', anc: [0.1, 0.12, 0.78], job: 'the cook who runs the mess', at: 'mess', shift: 'mess', col: '#7a2f2f', years: 8,
		style: 'big-hearted, teasing, judges people by how they eat',
		bio: 'trained in hotel kitchens; cooks for the whole colony from the dome\'s greens, the stores and a lot of spice',
		hobby: 'keeping a sourdough starter alive on the Moon',
		lines: ['Lentils tonight, and flatbread, and if Priya is kind, fresh herbs.', 'Food tastes flat up here, so I cook loud.', 'Sit, eat. Nobody talks business at my tables until they have had soup.'],
	},
	{
		id: 'historian', role: 'History', hair: 'bun', name: 'Lucía Ortega', age: 61, sex: 'f', anc: [0.08, 0.06, 0.86], job: 'the colony historian, keeper of First Landing Plaza', at: 'plaza', shift: 'out', col: '#6b4c7a', years: 10,
		style: 'thoughtful, generous, tells history as if it happened to friends',
		bio: 'records the colony\'s story; guards the first bootprints under the plaza rail; knew the Kestrel\'s crew',
		hobby: 'interviewing everyone, eventually',
		lines: ['Those bootprints will outlast every one of us. No wind, no rain.', 'History up here is short and close. I knew most of it by name.', 'The plinth is empty on purpose. We have not agreed what should stand there yet.'],
	},
	{
		id: 'quartermaster', role: 'Stores', hair: 'pony', name: 'Hannah Brandt', age: 38, sex: 'f', anc: [0.03, 0.04, 0.93], job: 'the quartermaster at the supply depot', at: 'depot', shift: 'day', col: '#5c6b2f', years: 4,
		style: 'organised, brisk, secretly sentimental',
		bio: 'knows where every bolt, ration pack and oxygen candle in the colony is; logs everything twice',
		hobby: 'crosswords, in pencil, so the stores can reuse the paper',
		lines: ['Sign for it, then take it. That is the rule.', 'We are fourteen days of food from trouble, always. So we keep forty.', 'If it is not on my list, it is not on the Moon.'],
	},
	{
		id: 'shelter', role: 'Rad Safety', name: 'Yusuf Demir', age: 45, sex: 'm', anc: [0.08, 0.1, 0.82], job: 'the radiation safety officer who keeps Storm Shelter Four', at: 'shelter', shift: 'out', col: '#6e6e2a', years: 5,
		style: 'steady, careful, finds calm in checklists',
		bio: 'watches the Sun for storms and keeps the shelters stocked; once kept twelve people cheerful for three days underground',
		hobby: 'board games, especially the long ones',
		lines: ['When the Sun flares we have about twenty minutes. Everyone knows the way to a shelter.', 'Two metres of regolith over your head is the best umbrella there is.', 'I check the shelter stores every week. Nobody thanks me until they need them.'],
	},
	// the surface crew: out on the regolith most of the day, the colony's crowd outside
	{
		id: 'eva1', role: 'EVA', hair: 'afro', name: 'Amara Nwosu', age: 33, sex: 'f', anc: [0.9, 0.03, 0.07], job: 'an EVA technician on the solar farm', at: 'solar', patrol: true, shift: 'day', col: '#c05a2a', years: 3,
		style: 'bright, quick to laugh, unflappable outside',
		bio: 'keeps the solar rows clean and tracking; spends more hours suited than anyone in the colony',
		hobby: 'drawing the shadows of the panels at different hours',
		lines: ['Dust on a panel is ten percent of your power gone. So we brush. A lot.', 'Out here you learn to walk like a kangaroo with good manners.', 'Every row follows the Sun. I follow the rows.'],
	},
	{
		id: 'eva2', role: 'Cargo', name: 'Mateus Lima', age: 27, sex: 'm', anc: [0.25, 0.05, 0.7], job: 'a cargo handler on the spaceport pads', at: 'pads', patrol: true, shift: 'day', col: '#7a6a2a', years: 1,
		style: 'eager, chatty, new enough to still be amazed',
		bio: 'unloads the landers and walks the cargo sleds to the depot; a year on the Moon and still grinning',
		hobby: 'counting how many landings he has seen',
		lines: ['Lander came in this morning with forty crates. Thirty-nine were food.', 'The pads are hot after a landing. Give them an hour.', 'I still look up at Earth every time I step out. Every time.'],
	},
	{
		id: 'eva3', role: 'Surface Ops', hair: 'pony', name: 'Ingrid Solberg', age: 39, sex: 'f', anc: [0.02, 0.03, 0.95], job: 'surface operations lead', at: 'airlock', patrol: true, shift: 'day', col: '#3a6a7a', years: 5,
		style: 'calm, watchful, counts heads without seeming to',
		bio: 'signs every EVA in and out at the airlocks and walks the hull checks round the hub',
		hobby: 'cross-country skiing, back home, which she misses',
		lines: ['Buddy check before the outer door. Every time, no exceptions.', 'The berms take a beating from micrometeorites. We patch them weekly.', 'If you are going out, tell me where and when you will be back.'],
	},
	{
		id: 'eva4', role: 'Maintenance', name: 'Wen Zhao', age: 36, sex: 'm', anc: [0.03, 0.92, 0.05], job: 'a maintenance technician on the radiators', at: 'radiators', patrol: true, shift: 'day', col: '#4a4a6e', years: 4,
		style: 'quiet, dry, precise with tools',
		bio: 'keeps the radiator fins turned edge-on to the Sun and the coolant loops tight',
		hobby: 'repairing old watches, slowly',
		lines: ['Heat is the hard part up here. No air to carry it away.', 'Edge-on to the Sun, always. The fins are fussy.', 'A small leak in a coolant loop is a big day for me.'],
	},
];
export const byId = Object.fromEntries(CAST.map((c) => [c.id, c]));
// the outer sites each works at, by the plan's kind
export const OUTER = { mine: 'mine', relay: 'relay', observatory: 'observatory', plaza: 'plaza', shelter: 'shelter' };

// ---------- the day ----------
const inH = (h, a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);
// where their day puts them at this game hour: 'work', 'mess', 'lounge' or 'quarters'
// (hold: an errand keeps them at their post)
export function placeFor(c, hours, hold = false) {
	const h = ((hours % 24) + 24) % 24;
	if (hold) return 'work';
	if (c.shift === 'mess') return inH(h, 5.5, 20) ? 'work' : inH(h, 20, 22) ? 'lounge' : 'quarters';
	if (c.shift === 'night') return inH(h, 18, 4) ? 'work' : inH(h, 4, 12) ? 'quarters' : inH(h, 12, 13) || inH(h, 17, 18) ? 'mess' : 'lounge';
	if (inH(h, 22, 6)) return 'quarters';
	if (inH(h, 6, 7) || inH(h, 12, 13) || inH(h, 18, 19)) return 'mess';
	if (inH(h, 19, 22)) return 'lounge';
	return 'work';
}
const WORK = { solar: 'brushing dust off the solar rows', pads: 'working cargo on the spaceport pads', airlock: 'on the hull checks round the hub', radiators: 'tending the radiator fins', dome: 'checking the dome\'s air and the farm\'s numbers', cab: 'on shift in the traffic control tower', farm: 'tending the growing beds under the dome', med: 'on shift in the med bay', mine: 'on shift out at Copernicus Deep Mine', workshop: 'elbow-deep in a rover in the workshop', relay: 'out at Far Side Relay, tuning the dishes', observatory: 'on the night watch at Daedalus Observatory', mess: 'cooking in the mess', plaza: 'out at First Landing Plaza', depot: 'counting stores in the supply depot', shelter: 'checking the stores at Storm Shelter Four' };
// what they are doing now, in a few words
export function activity(c, place) {
	if (place === 'work') return WORK[c.at] || 'at work';
	return { mess: 'having a meal in the mess', lounge: 'off shift in the observation lounge', quarters: 'off shift in quarters, winding down' }[place] || 'about the colony';
}

// ---------- who they are, for the conversational model and the shared voice ----------
// ctx: { colony, now (what they are doing), quest (their errand's state, one line), news: [] }
export function personaOf(c, ctx = {}) {
	const first = c.name.split(' ')[0];
	const facts = [
		`lives and works in ${ctx.colony || 'Tranquility Colony'} on the Moon, ${c.years} years so far`,
		c.bio,
		ctx.quest || '',
		...(ctx.news || []).slice(0, 2),
		'the colony: a glass dome farm with a mess, quarters, med bay, workshop, observation lounge and supply depot round it; a spaceport tower; rovers and a maglev out to Copernicus Deep Mine, Far Side Relay, the Wreck of the Kestrel, First Landing Plaza, Daedalus Observatory and Storm Shelter Four',
		'an adult crew; helmets off indoors, suits sealed outside; talks plainly, never with a put-on accent',
	].filter(Boolean);
	return {
		name: c.name, first, age: c.age, job: c.job, place: ctx.colony ? `${ctx.colony}, on the Moon` : 'Tranquility Colony, on the Moon', region: 'the Moon', lang: '',
		kind: 'colony', years: c.years, mood: ctx.mood || 'calm', errand: ctx.now || activity(c, 'work'), style: c.style, hobby: c.hobby,
		temper: { outgoing: 0.5, confident: 0.6, warmth: 0.6, fidget: 0.4 }, tattoos: [], facts, colony: c.id, quest: ctx.quest || '',
	};
}

// ---------- without a model: in character, from what they know ----------
const pickBy = (list, n) => list[((n % list.length) + list.length) % list.length];
export function colonyOffline(p, text, n = Date.now() / 7000 | 0) {
	const c = byId[p.colony];
	if (!c) return null;
	const q = String(text || '').toLowerCase();
	const first = p.first || c.name.split(' ')[0];
	if (/^(hi|hey|hello|yo|good (morning|afternoon|evening)|greetings)\b/.test(q)) return `[[mood: happy]] [[gesture: wave]] Hello. I'm ${first}, ${c.job}.${p.quest ? '' : ' Welcome to the colony.'}`;
	if (/your name|who are you/.test(q)) return `[[mood: calm]] ${c.name}. ${c.job[0].toUpperCase() + c.job.slice(1)}.`;
	if (/what do you do|your job|\bwork\b|for a living/.test(q)) return `[[mood: calm]] [[gesture: explain]] I'm ${c.job}. I ${c.bio.replace(/^an? [^;]*?;\s*/, '').split(';')[0]}.`;
	if (/how long|years/.test(q)) return `[[mood: thoughtful]] ${c.years} years up here now. It goes faster than you would think.`;
	if (/where am i|where are we|what (place|colony)|this place/.test(q)) return `[[mood: amused]] [[gesture: open]] ${p.place || 'Tranquility Colony, on the Moon'}. The dome is the middle of everything; the rest hangs off it.`;
	if (/how are you|how's it going|how are things/.test(q)) return `[[mood: calm]] Well enough. I'm ${p.errand || activity(c, 'work')}.`;
	if (/earth|home|miss/.test(q)) return `[[mood: thoughtful]] [[gesture: point]] Earth hangs in the same place in our sky, always. You get used to looking up to find home.`;
	if (/food|eat|hungry|dinner|lunch|breakfast|supper|mess/.test(q)) return `[[mood: happy]] Omar runs the mess: breakfast at six, lunch at noon, supper at six in the evening. Go early for the bread.`;
	if (/rover|ride|maglev|get to|travel/.test(q)) return `[[mood: calm]] [[gesture: point]] Any terminal will call a rover for you, or ask Tomas in the tower. The maglev runs from the spaceport.`;
	if (/sleep|night|quarters|bed/.test(q)) return `[[mood: calm]] Quarters are the long module with the bunks. Lights down at ten, unless you are Kenji.`;
	if (/dust|suit|helmet|airlock/.test(q)) return '[[mood: calm]] [[gesture: explain]] Suit sealed before the outer door, helmet off only once the airlock goes green. Brush the dust off before you come in.';
	if (/bye|see you|later|thanks|thank you|goodbye/.test(q)) return `[[mood: happy]] [[gesture: wave]] Take care out there.`;
	if (/\?$/.test(q.trim())) return `[[mood: thoughtful]] [[gesture: shrug]] I couldn't say. ${pickBy(c.lines, n)}`;
	return `[[mood: calm]] [[gesture: nod]] ${pickBy(c.lines, n)}`;
}

// ---------- the errands ----------
// Each: who asks, the steps (in order; each has the line in the journal and where it is
// done), what it pays, and what has to be finished first. Places: a colonist (to: id; by:
// who hands something over), a terminal (term: the terminal's site kind or room), a site
// (site: outer kind), or the earthrise gathering (meet).
export const QUESTS = {
	relay: {
		title: 'Dead Air', giver: 'director', main: 1, keep: 'relay',
		offer: 'Far Side Relay has dropped off the network. Anika is out there with a dead transceiver and no spare, and without the relay we cannot hear the observatory or the deep sites. Would you draw a replacement board from the supply depot and take it out to her? Fit it at the relay terminal; she will talk you through it.',
		steps: [
			{ id: 'fetch', text: 'Draw a relay transceiver board at the supply depot terminal', term: 'depot' },
			{ id: 'carry', text: 'Take the board to Far Side Relay and fit it at the relay terminal (any terminal, or Tomas in the tower, can send a rover)', term: 'relay' },
			{ id: 'report', text: 'Tell Anika the relay is back', to: 'relay' },
		],
		nag: 'The depot first: Hannah keeps the spare boards. Then out to the relay.',
		thanks: 'There it is: carrier lock, all six channels. I could hug you, but the suits make it awkward. Thank you. Helena will want to hear.',
		reward: { credits: 120 },
	},
	kestrel: {
		title: 'The Kestrel\'s Last Words', giver: 'relay', main: 2, after: 'relay',
		offer: 'With the relay back I am hearing something odd: a beacon, very faint, from the Wreck of the Kestrel. Her flight recorder still has a little power after all these years. Lucía has wanted that recorder since the day she came down. Would you go to the wreck, recover it, and take it to her at First Landing Plaza?',
		steps: [
			{ id: 'find', text: 'Recover the flight recorder from the Wreck of the Kestrel', site: 'wreck' },
			{ id: 'bring', text: 'Bring the recorder to Lucía at First Landing Plaza', to: 'historian' },
		],
		nag: 'The beacon is coming from the tail section of the Kestrel. Follow the rover track out.',
		thanks: 'Oh. Oh, look at it. Mara Quint flew the Kestrel; she trained half the people who built this place. Nobody was lost that day, but we never heard what she said on the way down. Thank you. I want everyone to hear it, together.',
		reward: { credits: 150 },
	},
	earthrise: {
		title: 'Earthrise', giver: 'historian', main: 3, after: 'kestrel',
		offer: 'Come to the observation lounge for the earthrise watch. The whole off-shift crew will be there; we will play the Kestrel\'s last transmission while Earth comes up over the rim. Will you come?',
		steps: [
			{ id: 'meet', text: 'Be in the observation lounge for the earthrise watch', meet: true },
		],
		nag: 'The observation lounge, at the hour. Do not be late; Earth will not wait.',
		thanks: 'You came. Did you hear her laugh at the end? "Tell them the view was worth it." It was. Thank you for bringing her home.',
		missed: 'We held the watch without you. It was lovely, and a shame you missed it. Shall we gather again?',
		reward: { credits: 80 },
	},
	core: {
		title: 'Dust in the Lungs', giver: 'medic',
		offer: 'I am studying what lunar dust does to the lungs of people who work in it. I need a fresh core from the Copernicus face, sealed on site. Ruth will cut one for you if you ride out to the mine. Bring it back to me here?',
		steps: [
			{ id: 'ride', text: 'Ride out to Copernicus Deep Mine and ask Ruth for a sealed core', by: 'foreman' },
			{ id: 'bring', text: 'Bring the core sample to Dr Adeyemi in the med bay', to: 'medic' },
		],
		nag: 'Ruth is at Copernicus Deep Mine. Any terminal will send a rover.',
		thanks: 'Sealed and still cold. Perfect. This will tell us how sharp the fresh dust is before it weathers. Thank you.',
		reward: { credits: 90 },
		hand: { from: 'foreman', step: 'ride', item: 'regolith-core-sample', say: 'A core for Samuel? Here, sealed at the face this morning. Keep it upright and out of the sun.' },
	},
	dish: {
		title: 'Daedalus Alignment', giver: 'astronomer', window: [21, 23],
		offer: 'Tonight a quasar I have waited three months for clears the crater rim, between nine and eleven in the evening. My hands are full with the telescope. Would you set the dish on it at the observatory terminal, inside that window? Too early and it is still behind the rim.',
		steps: [
			{ id: 'align', text: 'Align the Daedalus dish at the observatory terminal, between 21:00 and 23:00', term: 'observatory' },
			{ id: 'report', text: 'Tell Kenji the dish is on target', to: 'astronomer' },
		],
		nag: 'Between nine and eleven tonight, at the observatory terminal.',
		thanks: 'I see it. A light that left before the Sun was born, and we caught it. Thank you. I will put your name in the log.',
		reward: { credits: 70 },
	},
	harvest: {
		title: 'Greens for the Mess', giver: 'hydro',
		offer: 'The basil and the lettuces are ready and Omar is waiting on them for supper. Would you carry the crate over to him in the mess? It is light; it is the Moon.',
		steps: [
			{ id: 'bring', text: 'Bring the harvest crate to Omar in the mess', to: 'cook' },
		],
		nag: 'Omar is in the mess, through the corridor past the farm terminal.',
		thanks: 'Basil! Look at it. Tonight the soup will be green and proud. Here, for your trouble.',
		reward: { credits: 40 },
		start: 'hydroponic-harvest-crate',
	},
};
// what each errand's carried thing is, and when it is given and taken
export const ITEMS = {
	'relay-transceiver-board': { quest: 'relay', given: 'fetch', taken: 'carry', name: 'Relay transceiver board' },
	'kestrel-flight-recorder': { quest: 'kestrel', given: 'find', taken: 'bring', name: 'Kestrel flight recorder' },
	'regolith-core-sample': { quest: 'core', given: 'ride', taken: 'bring', name: 'Sealed regolith core' },
	'hydroponic-harvest-crate': { quest: 'harvest', given: null, taken: 'bring', name: 'Harvest crate' },
};

// ---------- the errands' state: { s: 'none' | 'active' | 'done', k: step index } ----------
export function stateOf(S, id) { return S.q?.[id] || { s: 'none', k: 0 }; }
export function stepOf(S, id) { const st = stateOf(S, id), Q = QUESTS[id]; return st.s === 'active' ? Q.steps[st.k] || null : null; }
// can it be offered now (its giver, the one before it done)
export function offerable(S, id) { const Q = QUESTS[id]; return stateOf(S, id).s === 'none' && (!Q.after || stateOf(S, Q.after).s === 'done'); }
// moves on: accept, step done, finish. Returns the new state of that errand.
export function step(S, id, what) {
	const Q = QUESTS[id], st = { ...stateOf(S, id) };
	if (!Q) return st;
	if (what === 'accept' && offerable(S, id)) { st.s = 'active'; st.k = 0; }
	else if (what === 'next' && st.s === 'active') { st.k++; if (st.k >= Q.steps.length) { st.s = 'done'; st.k = Q.steps.length; } }
	else if (what === 'finish' && st.s === 'active') { st.s = 'done'; st.k = Q.steps.length; }
	else if (what === 'retry' && st.s === 'active') st.k = 0;
	S.q = { ...(S.q || {}), [id]: st };
	return st;
}
// which errand someone has to give or to hear about, first
export function errandFor(S, who) {
	for (const [id, Q] of Object.entries(QUESTS)) { const st = stateOf(S, id); if (st.s === 'active' && Q.steps[st.k]?.to === who) return { id, kind: 'step' }; }
	for (const [id, Q] of Object.entries(QUESTS)) if (Q.hand?.from === who && stepOf(S, id)?.id === Q.hand.step) return { id, kind: 'hand' };
	for (const [id, Q] of Object.entries(QUESTS)) if (Q.giver === who && offerable(S, id)) return { id, kind: 'offer' };
	for (const [id, Q] of Object.entries(QUESTS)) if (Q.giver === who && stateOf(S, id).s === 'active') return { id, kind: 'nag' };
	return null;
}
// kept at their post while an errand needs them there
export function holds(S, who) {
	const e = errandFor(S, who);
	if (e && (e.kind === 'step' || e.kind === 'hand')) return true;
	return Object.entries(QUESTS).some(([id, Q]) => Q.keep === who && stateOf(S, id).s === 'active');
}
// is this game hour inside an errand's window
export const inWindow = (w, hours) => !w || inH(((hours % 24) + 24) % 24, w[0], w[1]);
// what people say once something has happened (the colony talks)
export const NEWS = {
	relay: 'the Far Side Relay is back on the network, thanks to a visitor',
	kestrel: 'the Kestrel\'s flight recorder was recovered from the wreck after all these years',
	earthrise: 'the crew watched earthrise together and heard the Kestrel\'s last transmission',
	core: 'Samuel has a fresh dust core from Copernicus for his lung study',
	dish: 'Daedalus caught Kenji\'s quasar last night',
	harvest: 'fresh basil from the dome went into Omar\'s soup',
};
export const REACT = {
	relay: { cook: 'Relay\'s back! My sister\'s message came through this morning, three days late and very cross.', traffic: 'Relay\'s green on my board again. Thanks for that run.', mechanic: 'Heard you fixed the relay. Anika owes you a coffee; I owe Anika two.' },
	kestrel: { director: 'You found the Kestrel\'s recorder. Mara would have liked that someone went looking.', medic: 'Lucía has not stopped smiling since you brought that recorder in.' },
	earthrise: { cook: 'Best earthrise in years. Everyone was quiet for a whole minute, which never happens in my mess.', quartermaster: 'I logged the watch. Attendance: everyone off shift, plus one visitor.' },
	harvest: { director: 'Omar\'s soup was green last night. I gather that was you.' },
};
