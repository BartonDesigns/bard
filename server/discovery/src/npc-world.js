// What the game's people know of their world, and what each one has going on. WORLD is the
// common knowledge, the hearsay and the mysteries nobody has answered: the same for everyone, so
// it sits with the fixed rules in the prompt cache. flavourOf gives one person their own angle on
// it, picked from their name, job and place, so the same person keeps the same mouth, hustle,
// secret and theory every time you meet them (nothing the game sends can set these).
//
//   flavourOf({ name, job, place, age, temper, dialogueStyle })
//       -> { mouth, hustle, secret, rumour }   mouth: clean | salty | rude | raunchy
//
// The lore is the game's own (magic/spells.js, magic/aether.js, combat/factions.js,
// creatures/catalog.js, combat/targets.js for the Spark, planet/cave-lore.js for the cave
// folk); the mysteries and the theories are hearsay, said as hearsay, never settled.

export const WORLD = [
	'THE WORLD, as the people in it know it. Use it the way a local would: from hearsay, opinion, superstition and what happened to a cousin, never like an encyclopedia. Bring it up when it fits, not in every line.',
	'- Where: a tropical island out in the Gulf of the Farallones, the San Francisco Bay Area beyond it at full size, the rest of the Earth, and the Moon and further worlds for anyone who can fly that far. Ordinary life goes on through all of it: jobs, rent, traffic, family dinners, bars, exes, gossip.',
	'- The aether: magic runs through the world in two strands. Light aether gathers as gold motes where the sun falls (high open ground, still water, by day); dark aether as violet motes where it does not (caves, deep woods, the night); at dusk and dawn both show. Wells are rare bright springs of one strand. Travellers weave it into themselves to learn spells: the light schools Radiance, Restoration, Warding and Dawn; the dark schools Shadow, Void, Blight and Umbral; and where both cross, the twilight schools Storm, Chrono and Primal. What you weave is who you become. Most people can see the motes but cannot weave them; some envy travellers, some fear them, some want a cut.',
	'- Travellers: people like the one in front of you. They fly, cross the world in a blink, come back changed, and trouble follows them. Old folks sometimes call them bards, because the first ones were said to have come singing.',
	'- The Spark: no harm reaches the young until they come of age. Bullets turn aside in a shimmer, fire and wheels part round them. Everyone knows it; nobody knows who gave it, or why it leaves at eighteen.',
	'- After dark come the Nightborn: Fog Wights drifting with a cold light in their chests; the Sexton, a gravedigger who is not a man; the Moonturned, neighbours who change when you get close (everyone suspects someone on their street); the Saltmarsh Mother out on the coastal marsh; the Lampeater, a flyer that hunts the city\'s streetlights; Ridge Hounds running in packs on the hills; the Burnt Giant, who stands in the woods as a dead tree until you come too near. On the worst foggy nights the Fog Mother rises over the Golden Gate. The Hollow King walks with a crown and a greatsword, and there is nothing under the crown.',
	'- In the drains and alleys, the goblins: Drain Skulkers, Flarepots who throw fire, Signplate Brutes in helmets beaten out of street signs; and under it all, down in the Deep, the Old Drain King.',
	'- The Deep: caves under everything. Cave villages hang with lamps where the water sings; cave folk say the water remembers every room it has passed through, that the stone breathes, and that the core is listening. Deeper live the Deepborn: Sporeborn Miners, Cinderkin with magma for hearts, Facet Wraiths made of glass, Shard Mites, and the Undertow in the black water.',
	'- The land: the Bay is quake country, and some swear the big ones come when the Deep is restless; the gold-grass hills burn every dry season.',
	'- Crews and powers: the Copperline Kings (a crown over a rail) and the Glasshouse Crew (a cracked pane) run the city\'s rougher blocks and hate each other; the Saltjack Smugglers work the coast; Halcyon Contractors are mercenaries for whoever pays; Ashfang Raiders and Dune Cutters ride the deserts; the Ridgeback Volunteers keep to their militia compounds; the Meridian Guard hold the bases; the Frontier Rangers watch the wild country; the Hearthguard keep the villages with lanterns and bows; the local police are named for wherever you are; rogue drones haunt the empty country; and there is always talk of the Ironvale Legion coming over the border or the sea.',
	'- Honor: people notice who a traveller fights. Honor won against monsters and raiders earns respect; picking on ordinary folk earns the opposite, and people talk.',
	'- MYSTERIES nobody has answered. People argue about them, guess, lie and sell theories. Never solve one; drop a lead now and then, and a lead can become a quest: who gave the young the Spark, and why it leaves; why the aether seems stronger every year; what the Fog Mother wants with the bridge; whose crown the Hollow King wears, and what was in the hollow; whether the Moonturned is a sickness, a curse or a choice; what the Old Drain King serves at the bottom of the Deep; why travellers who open a black hole (the Void spell they call Gargantua) say the world feels thinner afterwards; and the lights people see on the Moon at night.',
].join('\n');

// how this person talks, when the player has mature talk on and the person is grown
export const MOUTHS = ['clean', 'salty', 'rude', 'raunchy'];

// what they have going on: a side hustle, a grudge or a scheme, the root of the jobs they offer
const HUSTLES = [
	'sells "lucky" aether charms that are painted glass, and is proud of it',
	'owes the Copperline Kings money and is two weeks late',
	'runs a betting book on which neighbour is secretly Moonturned',
	'buys gathered motes cheap from kids and resells them to tourists',
	'is trying to go viral filming Nightborn at night and keeps nearly dying',
	'keeps a notebook on every traveller who passes through and sells the pages',
	'drives for three delivery apps at once and hates all of them',
	'talks big about a heist on the armoured truck that comes on Fridays',
	'collects "protection" money for a crew they are scared of',
	'sells bootleg fireworks to people who hunt Flarepots',
	'is seeing someone from the Glasshouse Crew while their whole family is Copperline',
	'runs an underground fight night behind a closed-down business',
	'smuggles glowing Deep mushrooms up to a Saltjack buyer',
	'is writing a tell-all about the local police and wants dirt',
	'wants revenge on an ex who stole their truck and their dog',
	'is quietly buying up land near the fault line, betting on the next big quake',
	'runs a "ghost tour" of places the Sexton has dug and invents half of it',
	'is trying to get into the Meridian Guard and keeps failing the test',
	'fences scrap that rogue drones drop and asks no questions',
	'is starting a band and needs a traveller to make them famous',
];
// what they hide: let slip to someone they trust, or when pushed, drunk or scared
const SECRETS = [
	'saw the Burnt Giant move in broad daylight and told no one',
	'is sure their own partner is Moonturned and sleeps with the light on',
	'found a piece of a hollow crown in a storm drain and still has it',
	'was a traveller once, wove too much dark aether, and gave it all up',
	'hears the stone singing through the floor at night',
	'owes the Saltjack Smugglers a debt they can never pay',
	'covered for a friend who started last year\'s wildfire',
	'pays the goblins in the drain to leave their place alone',
	'faked their death in another city and lives under a new name',
	'has seen the lights on the Moon up close, from a plane, and nobody believes them',
	'took Halcyon money once to look the other way',
	'is terrified of the dark and has never told a soul',
];
// their take on one mystery, said as gospel or as a joke
const RUMOURS = [
	'swears the Spark is the Fog Mother\'s doing, and that she cries over the bridge for every child who grows out of it',
	'thinks the aether grows stronger because something in the Deep is waking up',
	'says the Hollow King\'s crown was made for a king of the Bay who never existed in any history book',
	'believes the Moonturned chose it, and that you can tell by who leaves their curtains open on a full moon',
	'heard the Old Drain King is only a doorman, keeping something below from coming up',
	'claims every Gargantua a traveller opens leaves a thin spot, and that the quakes come through the thin spots',
	'is sure the lights on the Moon are travellers who went too far and could not come back down',
	'says the first bards sang the Spark into the world and nobody remembers the song',
	'thinks the Sexton digs graves for people before they die, and that you should check the cemetery for your own name',
	'swears the cave folk know what is at the bottom of the Deep and are paid to keep quiet',
	'says the Burnt Giants were people once, the ones who started the first wildfires',
	'believes the Copperline Kings made a deal with the goblins for the drains under downtown',
	'thinks the Ironvale Legion is a story the Meridian Guard tells to get more money',
	'claims the Fog Mother is looking for something somebody threw off the Golden Gate',
	'says the motes follow music, and that travellers who sing gather more',
	'insists the Lampeater is not hunting the streetlights but putting them out so the Nightborn can come in',
];
// a child's own versions, nothing grown up about them
const KID_HUSTLES = [
	'trades Spark stories for candy',
	'is sure their teacher is Moonturned and is collecting proof',
	'has a secret club that hunts motes after school',
	'is saving up for a real traveller\'s cape',
];
const KID_SECRETS = [
	'has been down the cave ladder twice and saw the lamps',
	'heard the rocks sing and is not lying, whatever their sister says',
	'is scared the Spark will leave early',
];

function hash(text) { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
// an independent draw 0..1 from the same person
const draw = (h, k) => (hash(h + ':' + k) % 100000) / 100000;
const pick = (list, h, k) => list[hash(h + ':' + k) % list.length];

export function flavourOf({ name = '', job = '', place = '', age = 30, temper = '', dialogueStyle = null } = {}) {
	const key = `${name}|${job}|${place}`;
	if (!(age >= 18)) return { mouth: 'clean', hustle: pick(KID_HUSTLES, key, 'h'), secret: pick(KID_SECRETS, key, 's'), rumour: pick(RUMOURS, key, 'r') };
	// about a third keep it clean, a third swear, a sixth are rude and a sixth raunchy; a gentle
	// temper leans clean, a hard one leans rude, and youth and old age both lean raunchy
	const t = String(temper).toLowerCase();
	let w = [34, 32, 17, 17];
	if (/gentle|kind|shy|soft|polite|warm|calm|sweet|patient/.test(t)) w = [w[0] + 16, w[1], w[2] - 9, w[3] - 7];
	if (/gruff|blunt|hot|fier|bitter|sharp|grumpy|brash|harsh|cynic|loud/.test(t)) w = [w[0] - 14, w[1] + 2, w[2] + 10, w[3] + 2];
	if (age < 30 || age >= 65) w = [w[0] - 5, w[1], w[2], w[3] + 5];
	let roll = draw(key, 'm') * w.reduce((a, b) => a + b, 0), mouth = MOUTHS[0];
	for (let i = 0; i < w.length; i++) { if ((roll -= w[i]) < 0) { mouth = MOUTHS[i]; break; } }
	if (dialogueStyle?.tone === 'clean') mouth = 'clean';
	return { mouth, hustle: pick(HUSTLES, key, 'h'), secret: pick(SECRETS, key, 's'), rumour: pick(RUMOURS, key, 'r') };
}
