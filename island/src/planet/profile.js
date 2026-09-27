// What kind of world flight has landed on. Space flight names every planet by type
// (TERRAN, OCEAN, ARID, ICE, MAGMA, TOXIC, MYSTICAL, GAS, SHEPHERD, SINGULARITY, BAYAREA);
// each type here becomes a whole ground: the shape of the land, the colours of its soil,
// grass, leaves, rock and water, the air and sky, which plants grow, what lies underground
// (the caves, the old ruins, the villages still lived in), and which mushrooms grow where.
//
// A profile is plain data. Everything that builds a world reads the one it is given.

import { mulberry32 } from '../noise.js';

// colours are authored in display space, 0..1
const TYPES = {
	TROPICAL: {
		name: 'tropical island',
		ground: { grass: [0.34, 0.48, 0.10], sand: [0.88, 0.78, 0.58], rock: [0.44, 0.41, 0.37], soil: [0.30, 0.24, 0.15], mix: 0 },
		leaf: { tint: [1, 1, 1], mix: 0 },
		relief: 'island', coast: 1, grass: 1, trees: 1, snow: 0, glow: null,
		water: { tint: null, mix: 0 },
		air: { tint: null, mix: 0, haze: 1 },
		flora: 'tropical',
		caves: { rock: [0.30, 0.27, 0.24], glow: [0.35, 0.85, 0.75], crystals: 0, lava: 0, ice: 0, water: 1 },
		civ: { ruin: 'stone', village: 'hut', people: 'human' },
		shrooms: ['psilocybe', 'glowcap'],
	},
	TERRAN: {
		name: 'green world',
		ground: { grass: [0.30, 0.46, 0.14], sand: [0.80, 0.72, 0.56], rock: [0.42, 0.40, 0.37], soil: [0.30, 0.23, 0.15], mix: 0.55 },
		leaf: { tint: [0.9, 1.05, 0.85], mix: 0.3 },
		relief: 'highland', coast: 1.25, grass: 1.1, trees: 1, snow: 0.25, glow: null,
		water: { tint: [0.10, 0.34, 0.40], mix: 0.25 },
		air: { tint: null, mix: 0, haze: 1 },
		flora: 'temperate',
		caves: { rock: [0.33, 0.30, 0.27], glow: [0.40, 0.90, 0.70], crystals: 0.2, lava: 0, ice: 0, water: 1 },
		civ: { ruin: 'stone', village: 'hut', people: 'human' },
		shrooms: ['psilocybe', 'amanita', 'glowcap'],
	},
	OCEAN: {
		name: 'ocean world',
		ground: { grass: [0.36, 0.52, 0.16], sand: [0.92, 0.86, 0.70], rock: [0.40, 0.40, 0.40], soil: [0.28, 0.24, 0.16], mix: 0.35 },
		leaf: { tint: [1, 1, 1], mix: 0 },
		relief: 'atoll', coast: 0.72, grass: 1, trees: 1.1, snow: 0, glow: null,
		water: { tint: [0.02, 0.42, 0.62], mix: 0.35 },
		air: { tint: [0.80, 0.90, 1.0], mix: 0.15, haze: 1.2 },
		flora: 'tropical',
		caves: { rock: [0.26, 0.30, 0.32], glow: [0.30, 0.80, 1.00], crystals: 0.1, lava: 0, ice: 0, water: 1.5 },
		civ: { ruin: 'coral', village: 'stilt', people: 'human' },
		shrooms: ['psilocybe', 'glowcap'],
	},
	ARID: {
		name: 'desert world',
		ground: { grass: [0.62, 0.52, 0.28], sand: [0.90, 0.64, 0.40], rock: [0.66, 0.38, 0.24], soil: [0.58, 0.36, 0.22], mix: 1 },
		leaf: { tint: [0.95, 0.85, 0.55], mix: 0.6 },
		relief: 'mesa', coast: 1.3, grass: 0.25, trees: 0.04, snow: 0, glow: null,
		water: { tint: [0.10, 0.40, 0.42], mix: 0.35 },
		air: { tint: [1.0, 0.78, 0.55], mix: 0.45, haze: 1.6 },
		flora: 'desert',
		caves: { rock: [0.58, 0.36, 0.24], glow: [1.0, 0.75, 0.35], crystals: 0.5, lava: 0, ice: 0, water: 0.3 },
		civ: { ruin: 'sandstone', village: 'adobe', people: 'human' },
		shrooms: ['psilocybe', 'peyote'],
	},
	ICE: {
		name: 'ice world',
		ground: { grass: [0.62, 0.66, 0.60], sand: [0.84, 0.86, 0.88], rock: [0.40, 0.44, 0.50], soil: [0.46, 0.46, 0.48], mix: 1 },
		leaf: { tint: [0.55, 0.7, 0.65], mix: 0.7 },
		relief: 'glacier', coast: 1.2, grass: 0.35, trees: 0.1, snow: 1, glow: null,
		water: { tint: [0.06, 0.20, 0.28], mix: 0.55 },
		air: { tint: [0.82, 0.90, 1.0], mix: 0.35, haze: 1.4 },
		flora: 'boreal',
		caves: { rock: [0.55, 0.70, 0.85], glow: [0.45, 0.75, 1.0], crystals: 0.6, lava: 0, ice: 1, water: 0.5 },
		civ: { ruin: 'ice', village: 'igloo', people: 'human' },
		shrooms: ['glowcap'],
	},
	MAGMA: {
		name: 'volcanic world',
		ground: { grass: [0.22, 0.19, 0.17], sand: [0.20, 0.18, 0.17], rock: [0.14, 0.12, 0.11], soil: [0.18, 0.15, 0.13], mix: 1 },
		leaf: { tint: [0.35, 0.28, 0.22], mix: 0.85 },
		relief: 'volcano', coast: 1.15, grass: 0.05, trees: 0.05, snow: 0, glow: [1.0, 0.36, 0.08],
		water: { tint: [0.10, 0.08, 0.07], mix: 0.6 },
		air: { tint: [1.0, 0.55, 0.38], mix: 0.65, haze: 2.4 },
		flora: 'ash',
		caves: { rock: [0.14, 0.12, 0.11], glow: [1.0, 0.40, 0.10], crystals: 0.3, lava: 1, ice: 0, water: 0 },
		civ: { ruin: 'basalt', village: 'bunker', people: 'human' },
		shrooms: ['emberfoot'],
	},
	TOXIC: {
		name: 'toxic world',
		ground: { grass: [0.52, 0.62, 0.16], sand: [0.62, 0.56, 0.34], rock: [0.34, 0.28, 0.40], soil: [0.26, 0.20, 0.28], mix: 1 },
		leaf: { tint: [0.70, 0.95, 0.30], mix: 0.75 },
		relief: 'swamp', coast: 1.1, grass: 0.8, trees: 0.35, snow: 0, glow: [0.55, 1.0, 0.20],
		water: { tint: [0.30, 0.42, 0.06], mix: 0.6 },
		air: { tint: [0.78, 0.95, 0.45], mix: 0.55, haze: 2 },
		flora: 'fungal',
		caves: { rock: [0.28, 0.24, 0.30], glow: [0.60, 1.0, 0.25], crystals: 0.2, lava: 0, ice: 0, water: 1 },
		civ: { ruin: 'rust', village: 'bunker', people: 'human' },
		shrooms: ['glowcap', 'amanita', 'veilhorn'],
	},
	MYSTICAL: {
		name: 'mystical world',
		ground: { grass: [0.40, 0.37, 0.54], sand: [0.84, 0.80, 0.88], rock: [0.40, 0.37, 0.46], soil: [0.24, 0.18, 0.30], mix: 1 },
		leaf: { tint: [0.80, 0.55, 1.0], mix: 0.7 },
		relief: 'enchanted', coast: 1.2, grass: 1, trees: 0.5, snow: 0.1, glow: [0.65, 0.45, 1.0],
		water: { tint: [0.20, 0.30, 0.60], mix: 0.45 },
		air: { tint: [0.88, 0.76, 1.0], mix: 0.45, haze: 1.3 },
		flora: 'fae',
		caves: { rock: [0.30, 0.26, 0.38], glow: [0.70, 0.50, 1.0], crystals: 1, lava: 0, ice: 0, water: 1 },
		civ: { ruin: 'crystal', village: 'fae', people: 'human' },
		shrooms: ['psilocybe', 'amanita', 'glowcap', 'veilhorn'],
	},
	// the moon of a gas giant: the giant itself hangs in the sky
	GAS: {
		name: 'moon of a gas giant',
		ground: { grass: [0.52, 0.50, 0.46], sand: [0.70, 0.68, 0.64], rock: [0.40, 0.39, 0.37], soil: [0.46, 0.44, 0.40], mix: 1 },
		leaf: { tint: [0.6, 0.62, 0.5], mix: 0.6 },
		relief: 'crater', coast: 1.35, grass: 0.15, trees: 0.03, snow: 0.2, glow: null,
		water: { tint: [0.14, 0.18, 0.22], mix: 0.55 },
		air: { tint: [0.90, 0.86, 0.80], mix: 0.25, haze: 0.7 },
		flora: 'barren',
		caves: { rock: [0.36, 0.35, 0.34], glow: [0.55, 0.85, 1.0], crystals: 0.8, lava: 0, ice: 0.3, water: 0.2 },
		civ: { ruin: 'metal', village: 'dome', people: 'human' },
		shrooms: ['glowcap'],
		sky: { giant: true },
	},
};
TYPES.SHEPHERD = { ...TYPES.TERRAN, name: 'ringed world', sky: { rings: true } };
TYPES.SINGULARITY = { ...TYPES.MYSTICAL, name: 'world by the dark star', air: { tint: [0.6, 0.55, 0.75], mix: 0.5, haze: 1.5 } };
TYPES.BARREN = TYPES.GAS;
TYPES.GAS_GIANT = TYPES.GAS;

// the mushrooms, and what people report they do. Onset, peak and fading are in minutes of
// play (a few real minutes stand for hours), so an experience runs its course in a sitting.
export const SHROOMS = {
	psilocybe: { name: 'Liberty cap', latin: 'Psilocybe semilanceata', look: 'small conical tan cap, dark gills, thin wavy stem', grows: 'grass', glow: 0 },
	amanita: { name: 'Fly agaric', latin: 'Amanita muscaria', look: 'red cap with white warts, white stem and ring', grows: 'trees', glow: 0 },
	glowcap: { name: 'Glowcap', latin: 'Mycena lux-caverna', look: 'clusters of tiny bell caps glowing blue-green', grows: 'caves', glow: 1 },
	peyote: { name: 'Button cactus', latin: 'Lophophora', look: 'spineless blue-green button cactus, tufts of wool', grows: 'sand', glow: 0 },
	emberfoot: { name: 'Emberfoot', latin: 'Pyronema ignis', look: 'black cups with ember-orange rims that pulse', grows: 'ash', glow: 0.6 },
	veilhorn: { name: 'Veilhorn', latin: 'Phallus indusiatus', look: 'tall stem with a lacy white veil skirt', grows: 'shade', glow: 0.3 },
};

// the planet a landing packet names, as a whole profile
export function planetProfile(type, seed = 1) {
	const key = String(type || 'TROPICAL').toUpperCase();
	const base = TYPES[key] || TYPES.TROPICAL;
	const r = mulberry32((seed >>> 0) ^ 0x51f15e);
	// every world of a type differs a little: hue drift in its grass and leaves
	const drift = (c, a) => c.map((v) => Math.max(0, Math.min(1, v * (1 + (r() - 0.5) * a))));
	return {
		...base,
		type: TYPES[key] ? key : 'TROPICAL',
		ground: { ...base.ground, grass: drift(base.ground.grass, 0.25), rock: drift(base.ground.rock, 0.15) },
		leaf: { ...base.leaf, tint: drift(base.leaf.tint, 0.2) },
		earthlike: key === 'TROPICAL' || key === 'TERRAN' || key === 'OCEAN' || key === 'SHEPHERD',
	};
}

export const PLANET_TYPES = Object.keys(TYPES);
