// The cliff settlements' settings per world: an advanced people's houses hung off the
// escarpments, towers rising through the mist, bridges across the gorges. plan.js sites
// them on the land, arch.js builds them, clouds.js lays the mist band they stand in.
//
//   villas     how many houses hang off the cliff edges (phones half)
//   kinds      the houses' shapes, drawn in turn: 'cantilever' (a glass floor out over the
//              drop on struts sunk in the face), 'terraces' (floors stepping down the face)
//   round      the floor plates oval rather than squared
//   towers     how many, rising from `towerAt`: 'low' (the valley floor, through the mist),
//              'sea' (standing in the cloud sea on their roots)
//   tall       the towers' height over the mist band's top, metres [least, most]
//   bridges    the most sky bridges across the gaps
//   drop       the least fall a cliff must have to be built off, metres
//   mist       the mist band: its base over the cliff feet (or the sea), its depth, its cover 0..1
//   craft      flying craft between the towers
//   towerKinds 'slabs' (a cluster of dark slab towers, window grids and light strips),
//              'spire' (a turning tower of floor plates with a halo, mast and lift)
//   domes      how often a house's back carries domes and drums (the retro-futurist complex)
//   flowers    patches of glowing flowers on the green slopes near the houses
// The look is dusk and blue hour: dark towers, window grids in warm white, pink and violet,
// the mist glowing from below where the towers stand in it, a monolith out on the water.
// colours are linear rgb: concrete, glazing, trim (metal), timber, window lights (warm, pink,
// violet), lamps, the band under the decks, the towers' strips, the mist's glow, beacons

export const ARCH = {
	SHEPHERD: {
		name: 'Ringfall Terraces',
		places: ['Halo House', 'The Stepped Garden', 'Long Light', 'Brinkhouse', 'Arc Pavilion', 'Tread House', 'The Overlook', 'Quiet Edge'],
		towers: ['Ringward Spire', 'Meridian Tower', 'The Lantern'],
		villas: 8, kinds: ['cantilever', 'terraces', 'cantilever'], round: true,
		towerN: 2, towerAt: 'low', tall: [45, 80], bridges: 3, drop: 16,
		mist: { base: 3, depth: 26, cover: 0.42 }, craft: 3,
		towerKinds: ['slabs', 'spire'], domes: 0.5, flowers: 5, slab: [0.06, 0.06, 0.08],
		winB: [1.0, 0.42, 0.66], winV: [0.60, 0.42, 1.0], band: [1.0, 0.45, 0.72], strip: [1.0, 0.62, 0.82], glow: [1.0, 0.40, 0.66],
		concrete: [0.86, 0.84, 0.80], glazing: [0.30, 0.38, 0.42], trim: [0.62, 0.58, 0.50], timber: [0.55, 0.36, 0.20],
		window: [1.0, 0.78, 0.50], lamp: [1.0, 0.82, 0.58], beacon: [1.0, 0.30, 0.15], planted: [0.30, 0.42, 0.16],
	},
	ICE: {
		name: 'Glasshollow',
		places: ['Rime House', 'Fjordglass', 'The Hanging Hall', 'Snowline', 'Northlight', 'Cold Harbour House', 'Seracs'],
		towers: ['The Needle', 'Aurora Mast'],
		villas: 7, kinds: ['cantilever', 'cantilever', 'terraces'], round: false,
		towerN: 2, towerAt: 'low', tall: [55, 95], bridges: 2, drop: 18,
		mist: { base: 2, depth: 30, cover: 0.40 }, craft: 2,
		towerKinds: ['spire', 'slabs'], domes: 0.35, flowers: 0, slab: [0.07, 0.08, 0.10],
		winB: [0.85, 0.45, 1.0], winV: [0.45, 0.70, 1.0], band: [0.70, 0.55, 1.0], strip: [0.75, 0.85, 1.0], glow: [0.66, 0.46, 1.0],
		concrete: [0.90, 0.92, 0.94], glazing: [0.22, 0.32, 0.40], trim: [0.42, 0.46, 0.52], timber: [0.48, 0.34, 0.24],
		window: [1.0, 0.82, 0.58], lamp: [0.95, 0.90, 0.80], beacon: [1.0, 0.22, 0.16], planted: [0.70, 0.74, 0.70],
	},
	GAS: {
		name: 'Stratos Reach',
		places: ['Cloudbreak House', 'The Brink', 'Updraught', 'High Shelf', 'Driftwatch', 'Cirrus House', 'Edgewise'],
		towers: ['Zenith Tower', 'Stratos One', 'The Column'],
		villas: 7, kinds: ['cantilever', 'cantilever', 'terraces'], round: true,
		towerN: 3, towerAt: 'sea', tall: [70, 120], bridges: 3, drop: 12,
		mist: { base: 1, depth: 22, cover: 0.40, sea: true }, craft: 4,
		towerKinds: ['slabs', 'slabs', 'spire'], domes: 0.6, flowers: 0, slab: [0.05, 0.05, 0.07],
		winB: [1.0, 0.38, 0.62], winV: [0.62, 0.40, 1.0], band: [1.0, 0.40, 0.70], strip: [1.0, 0.70, 0.86], glow: [1.0, 0.42, 0.70],
		concrete: [0.92, 0.90, 0.86], glazing: [0.34, 0.36, 0.40], trim: [0.78, 0.66, 0.46], timber: [0.60, 0.44, 0.30],
		window: [1.0, 0.86, 0.62], lamp: [1.0, 0.86, 0.66], beacon: [1.0, 0.25, 0.20], planted: [0.48, 0.50, 0.40],
	},
	TERRAN: {
		name: 'Verdance',
		places: ['Fern House', 'The Green Shelf', 'Ridgeway', 'Kestrel House', 'Moss Terrace', 'Highgrove', 'Cliff Garden'],
		towers: ['Canopy Tower', 'The Trellis'],
		villas: 7, kinds: ['terraces', 'cantilever', 'cantilever'], round: false,
		towerN: 2, towerAt: 'low', tall: [50, 90], bridges: 2, drop: 16,
		mist: { base: 4, depth: 24, cover: 0.42 }, craft: 3,
		towerKinds: ['slabs', 'spire'], domes: 0.4, flowers: 6, slab: [0.06, 0.07, 0.07],
		winB: [1.0, 0.45, 0.62], winV: [0.58, 0.45, 1.0], band: [1.0, 0.50, 0.70], strip: [1.0, 0.85, 0.90], glow: [1.0, 0.45, 0.62],
		concrete: [0.84, 0.82, 0.78], glazing: [0.26, 0.34, 0.32], trim: [0.36, 0.34, 0.30], timber: [0.50, 0.33, 0.18],
		window: [1.0, 0.80, 0.52], lamp: [1.0, 0.84, 0.60], beacon: [1.0, 0.35, 0.15], planted: [0.22, 0.38, 0.10],
	},
};

export function archStyle(type) { return ARCH[type] || null; }
