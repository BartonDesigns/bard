import { waveHeight } from './ocean.js';

// Water belongs to this world's horizontal location. A deep bed alone does not
// mean a player arriving high above it is swimming.
export function waterContact(island, position, ground, time, wave = 1, diving = false) {
	const { x, y, z } = position;
	const sea = island.hasOcean === false ? null : waveHeight(island, x, z, time, wave);
	const inland = island.waterAt?.(x, z);
	const levels = [sea, inland].filter(Number.isFinite);
	const surface = levels.length ? Math.max(...levels) : null;
	const cave = island.underFloor?.(x, z, y - 1.68) != null;
	const wet = surface != null && !cave && ground < surface;
	return {
		sea,
		surface,
		swimming: wet && ground < surface - (diving ? .6 : 1.35) && y < surface + 1.2,
		under: wet && y < surface - .05,
	};
}
