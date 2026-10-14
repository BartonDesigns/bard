// The procedural grid's lots (city.js) settled each time the city round you is rebuilt: a
// lot where two grids meet, or across a freeway or the Iron Horse Trail where they run
// through the grid, or into a landmark, gives way (structures/overlap.js). The surveyed
// buildings are settled when their region loads and never move here.

import { resolveLots, routeRoads, countOverlaps, isBuilding, stats } from './overlap.js';
import { planAlleys } from './alleys.js';
import { ROUTES, TRAIL } from '../bay/roads.js';
import { toWorld } from '../bay/geo.js';
import { realCovered } from '../bay/realcity.js';
import { onLandmark } from '../bay/footprints.js';

let ways = null;
// the freeways (34 m) and the trail (4 m) where bay/roads.js draws them: outside the regions
const roadsOfGrid = () => ways || (ways = [...routeRoads(Object.values(ROUTES), toWorld, (x, z) => realCovered(x, z, 70), 34), ...routeRoads([TRAIL], toWorld, (x, z) => realCovered(x, z, 70), 4, 'trunk')]);
// the grid's alleys round you now (structures/index.js draws them)
export const grid = { alleys: [], version: 0 };
const last = { list: null, x: 0, z: 0, res: null, n: 0, count: false, seen: null };
// (the first rebuild, and the next after countNext(), count before and after: a check, not for every rebuild)
export const countNext = () => { last.count = true; };
export function settleLots(list, x, z) {
	for (const o of list) if (o.src) o.mapped = true;
	const count = last.count || last.n++ === 0;
	last.count = false;
	const res = resolveLots(list, { roads: roadsOfGrid(), landmark: onLandmark, near: [x, z], R: 1300, count });
	if (count) last.seen = { before: res.before, after: res.after, at: [Math.round(x), Math.round(z)] };
	// the alleys behind the grid's shops and towers: each block's middle is its paved yard
	// (city.js paves the downtown and main-street blocks), the backs face it
	const yards = list.filter((o) => Math.floor(o.kind) === 4 && o.w * o.d > 1500 && o.h < 1.5);
	const block = (b) => { for (const q of yards) { const c = Math.cos(q.a), s = Math.sin(q.a), dx = b.x - q.x, dz = b.z - q.z; if (Math.abs(c * dx + s * dz) < q.w / 2 && Math.abs(-s * dx + c * dz) < q.d / 2) return [q.x, q.z, q.w / 2, q.d / 2, q.a]; } return null; };
	const built = list.filter((o) => isBuilding(o) && Math.abs(o.x - x) < 900 && Math.abs(o.z - z) < 900);
	grid.alleys = planAlleys(built, null, { block, seed: 7, only: (o) => !o.src });
	grid.version++;
	stats.lots += res.trims + res.drops;
	last.list = list; last.x = x; last.z = z; last.res = res;
	return res;
}
// how the last list stands now (counted on asking: Crysis.structures())
export function lotOverlaps() {
	if (!last.list) return null;
	// (the surveyed against each other were settled as their region loaded, against their own streets)
	const same = (a, b) => !!(a.mapped && b.mapped);
	const c = countOverlaps(last.list, { roads: roadsOfGrid(), landmark: onLandmark, same, solid: (o) => isBuilding(o) && Math.abs(o.x - last.x) < 1300 && Math.abs(o.z - last.z) < 1300, min: 0.6 });
	return { ...c, settled: { trims: last.res.trims, drops: last.res.drops, ms: last.res.ms }, counted: last.seen };
}
