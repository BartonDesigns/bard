// Stable identity is separate from the historical integer terrain seed.
// Never re-seed an existing landscape just to distinguish two flight records.
const label = (v) => typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, 160) : '';
const colors = (v) => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n)) ? v.map(n => Math.max(0, Math.min(1, n))) : null;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export function worldBody(params = {}) {
	const saved = params.body?.version === 1 ? params.body : {}, origin = params.origin || {};
	const earth = params.earth !== false;
	const terrainSeed = (params.seed >>> 0) || 1337;
	const rawSeed = earth ? 1337 : finite(saved.rawSeed) ? saved.rawSeed : finite(origin.seed) ? origin.seed : finite(params.rawSeed) ? params.rawSeed : finite(params.seed) ? params.seed : terrainSeed;
	const galaxy = label(saved.galaxy ?? origin.galaxy ?? params.galaxy);
	const system = label(saved.system ?? origin.system ?? params.system);
	const id = earth ? 'earth' : label(saved.id ?? origin.id ?? params.id);
	const type = earth ? 'TERRAN' : label(saved.type ?? origin.type ?? params.biome ?? params.type) || 'TROPICAL';
	const profile = earth ? 'TROPICAL' : label(params.biome ?? params.type ?? saved.profile) || 'TROPICAL';
	const palette = saved.palette ?? params.palette ?? origin.palette ?? null;
	return { version: 1, key: earth ? 'earth' : JSON.stringify([galaxy, system, id, rawSeed, type]), id, galaxy, system, rawSeed, terrainSeed, type, profile,
		palette: typeof palette === 'string' ? palette.slice(0, 80) : finite(palette) ? palette : palette && typeof palette === 'object' ? { a: colors(palette.a), b: colors(palette.b), type: label(palette.type), primal: !!palette.primal } : null,
		primal: !!(saved.primal ?? params.primal ?? origin.primal ?? palette?.primal) };
}
export function sameBody(a, b) { return !!a && !!b && a.key === b.key && a.terrainSeed === b.terrainSeed && a.profile === b.profile; }
