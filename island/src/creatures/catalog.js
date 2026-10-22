// The creatures: the night's monsters, the goblins, the dungeons' and the Deep's foes, each a
// real model made from its concept sheet (tools/monsters: build.py, then pack.mjs into
// assets/creatures). What each one is in a fight is here; its body and how it moves are in
// creatures/models.js and creatures/motion.js, and the fight itself is combat/ai-squads.js's
// (a squad member of kind 'creature', whose side is one of the creature factions in
// combat/factions.js: honor for each one brought down comes from that, combat/honor.js).
//
//   hp, armour   its life and the harm its hide turns (combat/health.js)
//   walk, run    its paces, in m/s (the run is its charge)
//   dmg, reach   a blow's harm to you (more to another fighter) and how far it reaches, in m
//   strike       a blow's whole time, in s (the wind-up is the first third: read it and step back)
//   sight        how far it notices you
//   hunt         how much further it keeps after you once roused, as a factor of sight (1.8
//                when not given): past that it loses you and gives up the chase
//   resist       harm taken by kind (combat/health.js DAMAGE_TYPES)
//   model, human its model when not its own id; human, the person it is until it turns (the
//                Moonturned: a villager who changes when you come near or hurt them)
//   look         its model dressed as something else (facets: the Facet Wraith's shard shell,
//                creatures/facets.js; legs: the Shard Mite's crystal legs and plates,
//                creatures/crystal-legs.js; sword: the Hollow King's greatsword and crown,
//                creatures/hollow-king.js); drift: it glides, no step
//   shatter      it bursts into shards when it dies, nothing left to lie there
//   fly          a flyer: the height it keeps over the ground (hover) and drops to (strike), in m
//   lurk         one that waits still among the trees (the Burnt Giant): it wakes when you come
//                within wake m, strike it or fire near it, rising over rise s; for its first
//                stalk s awake it only walks after you, and having lost you it goes back to
//                standing as a tree after settle s
//   throw        a thrower (fire pots, a curse): from past arm's reach to range it lobs one every
//                so often (every, s) for dmg, splashing splash m; it keeps back to keep m
//   where        when and where it comes on its own (combat/combat.js creatures()):
//                night (after dark only), zones (combat.js zone()), pack (how many together),
//                odds (how often, against the others there: 1 when not given)
//
// Pure data: no three, no DOM.

export const SPECIES = Object.freeze({
	'fog-wight': {
		name: 'Fog Wight', faction: 'nightborn', height: 3.0,
		hp: 260, armour: 10, walk: 1.5, run: 4.6, dmg: 22, reach: 2.6, strike: 1.1, sight: 55,
		resist: { fire: 1.5, ballistic: 0.9 }, surface: 'creature',
		where: { night: true, zones: ['earth-rural', 'earth-coast', 'wild', 'village'], pack: [1, 1] },
	},
	'sexton': {
		name: 'The Sexton', faction: 'nightborn', height: 1.85,
		hp: 180, armour: 15, walk: 1.1, run: 3.2, dmg: 18, reach: 2.3, strike: 1.0, sight: 40,
		resist: { fire: 1.3 }, surface: 'creature',
		where: { night: true, zones: ['earth-rural', 'earth-urban', 'village', 'wild'], pack: [1, 1] },
	},
	'drain-skulker': {
		name: 'Drain Skulker', faction: 'goblins', height: 1.2,
		hp: 70, armour: 0, walk: 1.8, run: 5.6, dmg: 8, reach: 1.5, strike: 0.7, sight: 45,
		resist: { fire: 1.2 }, surface: 'creature',
		where: { night: true, zones: ['earth-urban', 'earth-coast', 'village'], pack: [2, 4] },
	},
	'sporeborn-miner': {
		name: 'Sporeborn Miner', faction: 'deepborn', height: 1.8,
		hp: 150, armour: 10, walk: 1.2, run: 3.6, dmg: 14, reach: 1.9, strike: 0.9, sight: 40,
		resist: { fire: 1.6, energy: 0.9 }, surface: 'creature',
		where: { night: false, zones: ['deep'], pack: [1, 3] },
	},
	'cinderkin': {
		name: 'Cinderkin', faction: 'deepborn', height: 2.3,
		hp: 340, armour: 45, walk: 1.0, run: 2.8, dmg: 26, reach: 2.5, strike: 1.2, sight: 45,
		resist: { fire: 0.15, ballistic: 0.75, impact: 0.8, energy: 1.3 }, surface: 'stone',
		where: { night: false, zones: ['deep', 'arid'], pack: [1, 1] },
	},
	'signplate-brute': {
		name: 'Signplate Brute', faction: 'goblins', height: 1.9,
		hp: 320, armour: 60, walk: 1.1, run: 3.4, dmg: 28, reach: 2.4, strike: 1.3, sight: 45,
		resist: { ballistic: 0.7, pierce: 0.8, fire: 1.1 }, surface: 'metal',
		where: { night: true, zones: ['earth-urban', 'earth-coast', 'village'], pack: [1, 1], odds: 0.6 },
	},
	'flarepot': {
		name: 'Flarepot', faction: 'goblins', height: 1.15,
		hp: 60, armour: 0, walk: 1.8, run: 5.2, dmg: 7, reach: 1.4, strike: 0.8, sight: 50,
		resist: { fire: 0.4 }, surface: 'creature',
		throw: { range: 17, keep: 7, every: [2.2, 3.6], dmg: 14, type: 'fire', splash: 2.4 },
		where: { night: true, zones: ['earth-urban', 'earth-coast', 'village'], pack: [1, 2] },
	},
	'spore-hexer': {
		name: 'Spore Hexer', faction: 'goblins', height: 1.25,
		hp: 90, armour: 5, walk: 0.9, run: 2.6, dmg: 9, reach: 1.9, strike: 1.0, sight: 50,
		resist: { fire: 1.5, energy: 0.8 }, surface: 'creature',
		throw: { range: 20, keep: 9, every: [3, 4.5], dmg: 10, type: 'energy', splash: 2.0 },
		where: { night: false, zones: ['deep'], pack: [1, 2] },
	},
	'old-drain-king': {
		name: 'The Old Drain King', faction: 'goblins', height: 2.4,
		hp: 900, armour: 40, walk: 0.8, run: 2.0, dmg: 40, reach: 2.8, strike: 1.6, sight: 40,
		resist: { ballistic: 0.85 }, surface: 'creature',
		where: { night: false, zones: ['deep'], pack: [1, 1], odds: 0.12 },
	},
	'saltmarsh-mother': {
		name: 'Saltmarsh Mother', faction: 'nightborn', height: 2.5,
		hp: 420, armour: 10, walk: 1.0, run: 4.0, dmg: 30, reach: 3.0, strike: 1.2, sight: 50,
		resist: { fire: 1.4, ballistic: 0.8 }, surface: 'creature',
		where: { night: true, zones: ['earth-coast', 'wild'], pack: [1, 1], odds: 0.5 },
	},
	'moonturned': {
		name: 'Moonturned', faction: 'nightborn', height: 2.2, model: 'moonturned-beast', human: 'moonturned',
		hp: 220, armour: 5, walk: 1.3, run: 6.0, dmg: 20, reach: 2.0, strike: 0.8, sight: 50,
		resist: { fire: 1.2 }, surface: 'creature',
		where: { night: true, zones: ['village', 'earth-rural'], pack: [1, 2], odds: 0.7 },
	},
	'burnt-giant': {
		name: 'Burnt Giant', faction: 'nightborn', height: 12,
		hp: 2400, armour: 80, walk: 1.4, run: 3.6, dmg: 55, reach: 7, strike: 2.4, sight: 70,
		// (it hunts no further than it sees: get 70 m from it and it loses you; a fresh-woken
		// one walks after you a while before it runs, so there is time to get away)
		hunt: 1, resist: { fire: 2.0, ballistic: 0.5, pierce: 0.6 }, surface: 'wood',
		lurk: { wake: 9, rise: 3, stalk: 8, settle: 20 },
		// (by day too: a tree among trees is no less a tree in daylight)
		where: { night: false, zones: ['wild', 'earth-rural'], pack: [1, 1], odds: 0.12 },
	},
	'ridge-hound': {
		name: 'Ridge Hound', faction: 'nightborn', height: 1.15,
		hp: 110, armour: 0, walk: 1.6, run: 8.5, dmg: 13, reach: 1.7, strike: 0.7, sight: 70,
		resist: { fire: 1.3 }, surface: 'creature',
		where: { night: true, zones: ['earth-rural', 'wild'], pack: [3, 5], odds: 0.8 },
	},
	'hound-rider': {
		name: 'Hound Rider', faction: 'goblins', height: 2.1,
		hp: 280, armour: 15, walk: 1.6, run: 8.0, dmg: 20, reach: 2.3, strike: 0.85, sight: 75,
		resist: { fire: 1.2 }, surface: 'creature',
		where: { night: true, zones: ['earth-rural', 'wild', 'village'], pack: [1, 2], odds: 0.5 },
	},
	'gloomcrawler': {
		name: 'Gloomcrawler', faction: 'gloom', height: 1.0,
		hp: 90, armour: 25, walk: 1.4, run: 6.5, dmg: 12, reach: 1.8, strike: 0.8, sight: 40,
		resist: { fire: 1.4, ballistic: 0.85 }, surface: 'creature',
		throw: { range: 16, keep: 3, every: [3, 5], dmg: 9, type: 'energy', splash: 1.4 },
		// (the Deep sends its own: every gloom squad is of these, combat/ai-squads.js)
		where: { night: false, zones: [], pack: [2, 4] },
	},
	'undertow': {
		name: 'Undertow', faction: 'deepborn', height: 1.05,
		hp: 500, armour: 10, walk: 1.0, run: 4.5, dmg: 30, reach: 3.0, strike: 1.1, sight: 30,
		resist: { fire: 1.3, ballistic: 0.9 }, surface: 'creature',
		where: { night: false, zones: ['deep'], pack: [1, 1], odds: 0.3 },
	},
	'lampeater': {
		name: 'Lampeater', faction: 'nightborn', height: 0.9,
		hp: 160, armour: 0, walk: 2.5, run: 7.0, dmg: 16, reach: 2.2, strike: 1.0, sight: 60,
		resist: { fire: 1.8 }, surface: 'creature',
		fly: { hover: 4, strike: 0.9 },
		where: { night: true, zones: ['earth-urban'], pack: [1, 1], odds: 0.5 },
	},
	'facet-wraith': {
		name: 'Facet Wraith', faction: 'deepborn', height: 1.75, model: 'moonturned', look: 'facets', drift: true,
		hp: 240, armour: 0, walk: 1.2, run: 3.6, dmg: 24, reach: 3.2, strike: 1.2, sight: 45,
		resist: { energy: 0.6, fire: 0.8 }, surface: 'stone',
		fly: { hover: 0.45, strike: 0.3 },
		where: { night: false, zones: ['deep'], pack: [1, 1], odds: 0.25 },
	},
	'shard-mite': {
		name: 'Shard Mite', faction: 'deepborn', height: 0.56, look: 'legs', shatter: true,
		hp: 45, armour: 20, walk: 1.6, run: 7.0, dmg: 7, reach: 1.2, strike: 0.6, sight: 35,
		resist: { ballistic: 0.8, impact: 1.5, blast: 1.4 }, surface: 'crystal',
		where: { night: false, zones: ['deep'], pack: [3, 6], odds: 0.3 },
	},
	'hollow-king': {
		name: 'The Hollow King', faction: 'nightborn', height: 4, look: 'sword',
		hp: 1800, armour: 120, walk: 1.2, run: 3.2, dmg: 45, reach: 3.4, strike: 1.5, sight: 50,
		resist: { ballistic: 0.6, pierce: 0.7, energy: 1.2 }, surface: 'metal',
		// (the barrow's end, not the open world's: met from the places menu for now)
		where: { night: false, zones: [], pack: [1, 1] },
	},
});
export const SPECIES_IDS = Object.freeze(Object.keys(SPECIES));

// one of ids, by their odds (rnd in 0..1)
export function pickSpecies(ids, rnd = Math.random()) {
	let sum = 0;
	for (const id of ids) sum += SPECIES[id].where.odds ?? 1;
	let t = rnd * sum;
	for (const id of ids) { t -= SPECIES[id].where.odds ?? 1; if (t < 0) return id; }
	return ids[ids.length - 1];
}

// which of them may come here now: zone (combat.js zone()), night (0..1, world/sky.js uNight)
export function speciesFor(zone, night) {
	return SPECIES_IDS.filter((id) => {
		const w = SPECIES[id].where;
		return w.zones.includes(zone) && (!w.night || night > 0.6);
	});
}
