// How built up a town grown by the civilization engine (civgen.js) is at a point, in the shape
// of the Bay's town map (bay/terrain.js urbanAt: u how built up, a the street grid's angle, d how
// much of a downtown, s its style). What asks the Bay "is this a town, and what kind of street?"
// (the people on the sidewalks, the street sound, the music, the ghosts that keep to the woods)
// hears the same in a town grown out on the globe, past the edge of the Bay's map, where the
// Bay's map says nothing. From how far the point is from the town's middle (thinned out the way
// the Bay's map fills its towns) and the town's own land-use map round it: the yards, the shops,
// the downtown's plazas and towers, the parks.

import { STYLE } from '../bay/styles.js';
import { LU } from './civgen.js';

// the map is read on a little grid round the point, this far apart
const RING = [];
for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) RING.push([i * 20, j * 20]);
const QUARTER = Math.PI / 2;
const NONE = null;

// a town record from civgen.js (its centre, radius, angle, style and land-use map)
export function townMapAt(T, x, z) {
	const M = T?.map, C = T?.centre;
	if (!M || !C || !(T.radius > 0)) return NONE;
	const dist = Math.hypot(x - C[0], z - C[1]), d = dist / T.radius;
	if (d > 1.6) return NONE;
	// what stands round the point
	let n = 0, built = 0, shops = 0, plaza = 0, works = 0, roof = 0;
	for (const [dx, dz] of RING) {
		const i = Math.floor((x + dx - M.x0) / M.step), j = Math.floor((z + dz - M.z0) / M.step);
		if (i < 0 || j < 0 || i >= M.w || j >= M.h) continue;
		const k = (j * M.w + i) * 4, lu = Math.round(M.px[k + 1] / 16), rf = M.px[k + 2] / 255;
		n++; roof += rf;
		if (lu === LU.plaza) { plaza++; built++; }
		else if (lu === LU.commercial) { shops++; built++; }
		else if (lu === LU.industrial) { works++; built++; }
		else if (lu === LU.residential || lu === LU.school) built++;
		else if (lu >= LU.park && lu <= LU.playground) built += 0.4;             // a park, the fields
		else if (rf > 0.5 || M.px[k] > 128) built += 0.7;                           // a building or a street with no yard painted round it
	}
	if (!n) return NONE;
	built /= n; shops /= n; plaza /= n; works /= n; roof /= n;
	// how built up: the town fills out to an edge, not a haze (as the Bay's towns do)
	const u = Math.min(1, Math.exp(-d * d * d * 1.1) * 1.25) * built;
	// how much of a downtown: the big towns' centres (where civgen.js puts its towers), the
	// plazas and the shops round them, and the dense old blocks; the old towns' main streets a little
	const big = T.radius > 2000, older = T.style === 'older';
	const core = big ? 0.5 * Math.exp(-((dist / (T.radius * 0.22)) ** 2)) : older ? 0.22 * Math.exp(-((dist / (T.radius * 0.2)) ** 2)) : 0;
	const dense = Math.min(1, Math.max(0, (roof - 0.3) / 0.25));
	const down = u > 0.1 ? Math.min(1, Math.max(core, plaza * 0.6 + shops * 0.2, dense * 0.3)) : 0;
	const s = works > 0.5 ? STYLE.industry : shops + plaza > 0.45 && plaza < shops ? STYLE.retail : older ? STYLE.older : STYLE.suburb;
	return { u, a: (((T.ang || 0) % QUARTER) + QUARTER) % QUARTER, d: down, s };
}

// the world's townAt: the Bay's town map (bay/terrain.js urbanAt) where it has a town, and where
// it has none, the town grown there (bay/realcity.js townAt)
export const townAtOf = (bay, real) => (x, z) => {
	const U = bay.urbanAt(x, z);
	return U.u > 0.01 ? U : (real?.townAt?.(x, z) || U);
};
