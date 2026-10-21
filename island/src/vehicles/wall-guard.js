// What a vehicle in sight must never drive into: a building. Police cruisers and convoys find
// their way by the mapped roads (military/route.js), but the stretches joining a road to where
// they start or stop cross the ground, and one of those can run through a block; where you can
// see it, the vehicle pulls up at the wall instead. The city's own blocks round you (bay/city.js
// lots: the mapped buildings and the grown ones), looked up in its 40 m grid.
import { insideBox } from '../law/tactics.js';

// is (x, z) inside a building, or within pad of its walls
export function inBuilding(W, x, z, pad = 0.4) {
	const lots = W?.city?.lotsNear?.(x, z, 1);
	if (!lots) return false;
	for (const o of lots) {
		if (o.wrecked || !(o.w > 1.5) || !(o.d > 1.5) || !(o.h > 1.5)) continue;
		if (insideBox(o, x, z, pad)) return true;
	}
	return false;
}
// is the road ahead of a vehicle at (x, z) facing yaw (half its length) into a building: its
// nose, and a little on past it
export function noseInto(W, x, z, yaw, half) {
	const fx = Math.sin(yaw), fz = Math.cos(yaw);
	for (const k of [0.4, 2]) if (inBuilding(W, x + fx * (half + k), z + fz * (half + k))) return true;
	return false;
}
