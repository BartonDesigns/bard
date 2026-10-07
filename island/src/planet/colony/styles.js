// The colony kit's settings per world: what an off-world colony builds there, in what
// materials, and how much of it. plan.js sites the parts, colony.js builds them.
//
// parts: how many of each piece (0 leaves it out)
//   habs      segmented modules round the hub, half-buried under regolith berms
//   dome      the hub's pressure dome: 'glass' (a lattice over glass), 'armour' (shield tiles)
//   towers    printed towers in layered strata ('printed'), heat shields ('shield'),
//             sealed spires lifted over the haze ('spire')
//   solar     sun-tracking panel rows; radiators the white fins edge-on to the sun
//   pads      landing pads at the spaceport, with its control tower
//   rail      a maglev line from the spaceport through the hub to the outposts
//   rovers    rovers driving the compacted roads; walkers colonists in suits
//   mine      a mining rig on a crater rim (or the nearest high ground)
//   dish      comms dishes on the high ground
//   pipes     glowing coolant runs between the works; stacks scrubber stacks venting
// colours are linear rgb; light colours are the window glow, the running lights, the pads'

export const COLONY = {
	MOON: {
		name: 'Tranquility Colony', port: 'Tranquility Spaceport',
		outposts: ['Copernicus Mine', 'Serenity Array', 'Shackleton Relay', 'Apennine Works'],
		parts: { habs: 6, dome: 'glass', towers: 2, tower: 'printed', solar: 4, radiators: 3, pads: 3, rail: 1, rovers: 5, walkers: 12, mine: 1, dish: 2, pipes: 0, stacks: 0 },
		hull: [0.86, 0.86, 0.84], trim: [0.30, 0.31, 0.33], print: [0.52, 0.50, 0.47], berm: [0.44, 0.44, 0.43],
		accent: [0.95, 0.55, 0.12], glass: [0.55, 0.68, 0.80],
		window: [1.0, 0.80, 0.52], run: [1.0, 0.18, 0.12], pad: [0.35, 0.85, 1.0],
		hard: true,
	},
	MAGMA: {
		name: 'Basalt Hold', port: 'Basalt Hold Pads',
		outposts: ['Caldera Tap', 'Cinder Relay', 'Obsidian Works'],
		parts: { habs: 4, dome: 'armour', towers: 3, tower: 'shield', solar: 0, radiators: 4, pads: 2, rail: 1, rovers: 3, walkers: 6, mine: 1, dish: 1, pipes: 1, stacks: 0 },
		hull: [0.22, 0.21, 0.21], trim: [0.62, 0.60, 0.56], print: [0.17, 0.16, 0.16], berm: [0.14, 0.13, 0.13],
		accent: [0.90, 0.30, 0.08], glass: [0.20, 0.30, 0.36],
		window: [1.0, 0.72, 0.42], run: [1.0, 0.45, 0.10], pad: [0.30, 0.95, 1.0], pipe: [0.25, 0.95, 1.0],
	},
	TOXIC: {
		name: 'Clearsky Spires', port: 'Clearsky Landing',
		outposts: ['Scrubber Field Nine', 'Bile Flats Station', 'Verdigris Relay'],
		parts: { habs: 3, dome: 'glass', towers: 4, tower: 'spire', solar: 2, radiators: 0, pads: 2, rail: 1, rovers: 3, walkers: 6, mine: 0, dish: 1, pipes: 0, stacks: 5 },
		hull: [0.88, 0.90, 0.86], trim: [0.24, 0.27, 0.25], print: [0.62, 0.64, 0.58], berm: [0.30, 0.33, 0.24],
		accent: [0.95, 0.85, 0.10], glass: [0.50, 0.75, 0.62],
		window: [0.85, 1.0, 0.80], run: [0.75, 1.0, 0.15], pad: [0.90, 1.0, 0.30],
	},
};

export function colonyStyle(type) { return COLONY[type] || null; }
