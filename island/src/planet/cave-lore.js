// Preserved verbatim from runtime/caves-179.html.gz (decompressed source).
// Dweller LORE at 9478; SOUL_LORE at 8991; VAULT_LORE at 5072;
// EPOCH_ADJ/EPOCH_NOUN at 1929–1930; MILESTONES at 10720.
// Data only: preserving a story does not claim its legacy mechanics are migrated.

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const CAVE_LORE_SOURCE = 'runtime/caves-179.html.gz';

export const DWELLER_LORE = freeze({
  "elder": [
    "the water remembers every room it has passed through. that is why it sings.",
    "we do not dig down. down is already there. we only stop refusing it.",
    "my grandmother walked to the third fall and came back with a stone that hummed.",
    "the mushrooms are older than the town. we are guests of the light.",
    "when the stone stirs and closes a way, it is not malice. it is breathing.",
    "there were lamps in the deep places before there were hands to hang them.",
    "if you meet the small folk that fold themselves, do not follow. listen, then leave.",
    "every epoch below has its own weather. learn its name and it will let you pass.",
    "the river is a road that was here before the road.",
    "we bury nobody. we give them to the current and it takes them home."
  ],
  "trader": [
    "torches, rope, dried cap, and quiet. the quiet costs the most.",
    "a shard for a lamp is fair. a shard for two lamps is a friendship.",
    "the last caravan came up from the ninth fall with nothing but salt and stories.",
    "buy the rope. everyone who did not buy the rope came back needing rope.",
    "i do not take coin. coin is for people who can leave."
  ],
  "parent": [
    "keep to the lantern line after the third bell. the alleys are not safe when the stone moves.",
    "my eldest went down to the shanty road and sends word by the water.",
    "we built this wall with the family next door. one wall, two homes, no argument since.",
    "the little one asks where the light comes from. i have stopped pretending i know.",
    "when the fog comes up warm, we bring everyone inside and we sing until it passes."
  ],
  "worker": [
    "the beam over the fourth walkway is soft. i have told them twice.",
    "we quarry only what the wall offers. take more and the ceiling remembers.",
    "the lamps want trimming every third day or they smoke the whole terrace.",
    "i have laid plank in nine towns and this rock is the strangest yet."
  ],
  "child": [
    "i can hear the rocks sing! can you hear them?",
    "my sister says there are people made of light. i think she is lying.",
    "do not tell anyone, but i have been down the ladder twice.",
    "if you jump in the river it takes you all the way to the loud part."
  ]
});

export const SOUL_LORE = freeze([
  "the crust lets go of you",
  "the last root passes",
  "nothing here has ever been seen",
  "the stone runs like water at this speed",
  "heat arrives before light does",
  "the mantle turns over slowly, and you fall through its turning",
  "iron begins to sing",
  "the weight of everything above becomes a sound",
  "the center pulls, and you were always going to answer"
]);

export const VAULT_LORE = freeze([
  "below, the stone forgets the sun",
  "the dark here has a different weight",
  "you are deeper than any root has reached",
  "the water above is a rumor now",
  "the cave dreams slower at this depth",
  "few lights have ever burned this far down",
  "the pressure sings in a lower key",
  "here the stone keeps its oldest thoughts",
  "the surface is a story you tell yourself",
  "the core is listening for your steps"
]);

export const EPOCH_ADJECTIVES = freeze([
  "SILENT",
  "BURIED",
  "HOLLOW",
  "MOLTEN",
  "SUNKEN",
  "BREATHING",
  "FORGOTTEN",
  "GLASS",
  "IRON",
  "VELVET",
  "HUNGRY",
  "PATIENT",
  "SHIMMERING",
  "BLIND",
  "ANCIENT",
  "HUMMING"
]);

export const EPOCH_NOUNS = freeze([
  "REACHES",
  "THROATS",
  "GALLERIES",
  "FATHOMS",
  "CHANCELS",
  "MARROW",
  "VAULTS",
  "GARDENS",
  "CHASMS",
  "CRADLES",
  "LUNGS",
  "COURTS",
  "VEINS",
  "CISTERNS",
  "FOLDS",
  "CHOIRS"
]);

export const DEPTH_MILESTONES = freeze([
  {
    "depth": 250,
    "name": "DEPTH 250: THE VIOLET GALLERIES"
  },
  {
    "depth": 500,
    "name": "DEPTH 500: THE DROWNED BLUE"
  },
  {
    "depth": 1000,
    "name": "DEPTH 1000: THE EMBER REACH"
  },
  {
    "depth": 1500,
    "name": "DEPTH 1500: THE BONE HOLLOWS"
  }
]);

const JOB = Object.freeze({ elder: 'an elder who tends the village lamps', trader: 'a trader at the underground market', parent: 'raising a family in the cave village', worker: 'a worker maintaining the village paths and beams', child: 'a child growing up in the cave village' });
const ERRAND = Object.freeze({ elder: 'resting by the fire and listening to the village', trader: 'watching the market stall', parent: 'walking with the family', worker: 'checking the paths between the houses', child: 'exploring close to home' });
const HOBBY = Object.freeze({ elder: 'remembering the old stories', trader: 'hearing travelers’ stories', parent: 'singing with the family', worker: 'listening to stone and water', child: 'finding rocks that sing' });
const coord = value => Math.round((Number.isFinite(value) ? value : 0) * 100);
const hash = text => { let n = 2166136261; for (const ch of String(text)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619); return n >>> 0; };

// Stable across geometry streaming and rebuilds. The caller's body namespace keeps
// identically seeded planets separate in persistent social storage.
export function caveResidentMeta({ worldSeed = 0, chamber = {}, index = 0, age = 30, activity = 'walk', parent = false } = {}) {
	const id = `cave:${worldSeed >>> 0}:${coord(chamber.x)},${coord(chamber.z)}:${Math.max(0, Math.trunc(index))}`;
	const role = age < 18 ? 'child' : activity === 'keep' ? 'trader' : parent ? 'parent' : age >= 60 ? 'elder' : 'worker';
	return { id, seed: hash(id), role, place: chamber.name || 'the lamplit cave village', lore: DWELLER_LORE[role] };
}

export function cavePersona(base, meta) {
	if (!meta || !Object.hasOwn(DWELLER_LORE, meta.role)) return base;
	const role = meta.role;
	// Surface regional sheets must not tell a cave resident that they are standing
	// in a Bay Area street or encourage them to invent surface weather underground.
	const person = { ...base };
	for (const key of ['local', 'region', 'lang', 'facts']) delete person[key];
	return { ...person, kind: 'cave', place: meta.place, job: JOB[role], errand: ERRAND[role], hobby: HOBBY[role], caveMeta: { ...meta },
		facts: [`Lives in ${meta.place}; role: ${role}.`, 'These are inherited local stories, not promises of available game actions.', ...meta.lore] };
}

// Only answer local-lore topics here. Generic conversation and real action parsing
// stay with the shared NPC system. Returning null lets that system continue.
export function caveLoreReply(meta, text, turn = 0) {
	if (!meta || !Object.hasOwn(DWELLER_LORE, meta.role)) return null;
	const q = String(text || '').toLowerCase();
	if (!/\b(cave|cavern|underground|story|stories|lore|history|river|water|stone|rock|lamp|lantern|mushroom|epoch|current|family|children|town|village|market|trade|coin|rope)\b/.test(q)) return null;
	const words = q.match(/[a-z]{4,}/g) || [];
	const scored = meta.lore.map(line => ({ line, score: words.filter(word => line.includes(word)).length }));
	const best = Math.max(...scored.map(item => item.score));
	const options = scored.filter(item => item.score === best);
	const choice = options[(hash(meta.id + ':' + q) + Math.max(0, Math.trunc(turn))) % options.length];
	return `[[mood: thoughtful]] [[gesture: explain]] ${choice.line[0].toUpperCase()}${choice.line.slice(1)}`;
}
