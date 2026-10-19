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
//   resist       harm taken by kind (combat/health.js DAMAGE_TYPES)
//   where        when and where it comes on its own (combat/combat.js creatures()):
//                night (after dark only), zones (combat.js zone()), pack (how many together)
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
});
export const SPECIES_IDS = Object.freeze(Object.keys(SPECIES));

// which of them may come here now: zone (combat.js zone()), night (0..1, world/sky.js uNight)
export function speciesFor(zone, night) {
	return SPECIES_IDS.filter((id) => {
		const w = SPECIES[id].where;
		return w.zones.includes(zone) && (!w.night || night > 0.6);
	});
}
