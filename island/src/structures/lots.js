// The procedural grid's lots (city.js) settled each time the city round you is rebuilt: a
// lot where two grids meet, or across a freeway or the Iron Horse Trail where they run
// through the grid, or into a landmark, gives way (structures/overlap.js). The surveyed
// buildings are settled when their region loads and never move here.

import { resolveLotsSteps, routeRoads, countOverlaps, isBuilding, stats } from './overlap.js';
import { planAlleys } from './alleys.js';
import { ROUTES, TRAIL } from '../bay/roads.js';
import { toWorld } from '../bay/geo.js';
import { realCovered } from '../bay/realcity.js';
import { onLandmark } from '../bay/footprints.js';
import { GFX_PHONE } from '../world/device.js';

let ways = null;
// (a phone settles the nearer lots only, as city.js trims only the nearer ones there: the far ones are a few pixels)
const PHONE = GFX_PHONE;
const REACH = PHONE ? 700 : 1300;
// the freeways (34 m) and the trail (4 m) where bay/roads.js draws them: outside the regions
const roadsOfGrid = () => ways || (ways = [...routeRoads(Object.values(ROUTES), toWorld, (x, z) => realCovered(x, z, 70), 34), ...routeRoads([TRAIL], toWorld, (x, z) => realCovered(x, z, 70), 4, 'trunk')]);
// the grid's alleys round you now (structures/index.js draws them)
export const grid = { alleys: [], version: 0 };
const last = { list: null, x: 0, z: 0, res: null, n: 0, count: false, seen: null };
// (the first rebuild, and the next after countNext(), count before and after: a check, not for every rebuild)
export const countNext = () => { last.count = true; };
export function settleLots(list, x, z) {
	const g = settleLotsSteps(list, x, z);
	let r = g.next();
	while (!r.done) r = g.next();
	return r.value;
}
// the same in steps, as city.js lays its set out a frame's share at a time: settling the lots
// in one go cost a landing's frame 80 ms on a computer (far more on a phone), the longest step
// of the set
// (more: other roads the lots keep off as they keep off the freeways, the globe's highways and
// section roads where they reach the gridded towns out past the Bay's survey: bay/city.js)
export function* settleLotsSteps(list, x, z, more = null) {
	for (const o of list) if (o.src) o.mapped = true;
	// (the first set's before-and-after count is a check for the console, two passes over every
	// lot: a phone, which has no console open, skips it unless countNext() asks)
	const first = last.n++ === 0, count = last.count || (first && !PHONE);
	last.count = false;
	const res = yield* resolveLotsSteps(list, { roads: more?.length ? [...roadsOfGrid(), ...more] : roadsOfGrid(), landmark: onLandmark, near: [x, z], R: REACH, count });
	if (count) last.seen = { before: res.before, after: res.after, at: [Math.round(x), Math.round(z)] };
	yield;
	// the alleys behind the grid's shops and towers: each block's middle is its paved yard
	// (city.js paves the downtown and main-street blocks), the backs face it
	const yards = list.filter((o) => Math.floor(o.kind) === 4 && o.w * o.d > 1500 && o.h < 1.5);
	const block = (b) => { for (const q of yards) { const c = Math.cos(q.a), s = Math.sin(q.a), dx = b.x - q.x, dz = b.z - q.z; if (Math.abs(c * dx + s * dz) < q.w / 2 && Math.abs(-s * dx + c * dz) < q.d / 2) return [q.x, q.z, q.w / 2, q.d / 2, q.a]; } return null; };
	const built = list.filter((o) => isBuilding(o) && Math.abs(o.x - x) < REACH * 0.7 && Math.abs(o.z - z) < REACH * 0.7);
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
	const c = countOverlaps(last.list, { roads: roadsOfGrid(), landmark: onLandmark, same, solid: (o) => isBuilding(o) && Math.abs(o.x - last.x) < REACH && Math.abs(o.z - last.z) < REACH, min: 0.6 });
	return { ...c, settled: { trims: last.res.trims, drops: last.res.drops, ms: last.res.ms }, counted: last.seen };
}
