// The towns' trees far off. Round you city.js stands every mapped tree (its far ones as one
// picture each, out to 2.8 km; a phone's to 2.4 km); past that nothing stood in the towns, and
// the ground there was the 8 m map's roofs, streets and yards alone: pale grey and tan that the
// evening haze turned blue, so from San Ramon south Danville read as a lake where the photo
// shows a forest with roofs in it (Josh 2026-10-24). So the coarse maps carry their trees too:
// how much of each cell their crowns cover seen from above, in the alpha (1 none .. 255 all; 0
// is still off the map), and the ground paints them past the trees (terrain.js townSeen).

import { GFX_PHONE } from '../world/device.js';

// where the painted crowns come in, as the trees' far pictures dissolve out (city.js LOD.far)
export const FAR_CROWNS = GFX_PHONE ? [1700, 2400] : [2100, 2800];

// a crown's radius from its tree's height (m): a 10 m yard oak spreads 4 m each way
const crownR = (h) => Math.min(6, Math.max(2.5, h * 0.4));
// what a cell's land use (G / 16) holds of trees whatever the map's own say: the odd one in a
// park, on a golf course, in a playground or a schoolyard. The neighbourhoods have only their
// own (a Danville yard is planted, a street in San Francisco's Sunset hardly at all)
const FLOOR = [0, 0, 0.03, 0.03, 0, 0.02, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// Into map.px's alpha, a few thousand cells or trees a step (yields): every cell on the map
// (alpha > 0) first set to its land use's floor, then each tree's crown spread over the four
// cells round its trunk by how near each one's middle it stands
export function* canopySteps(map, trees) {
	const { px, w, h, x0, z0, step } = map, cell = step * step;
	for (let j = 0; j < h; j++) {
		for (let i = j * w, e = i + w; i < e; i++) if (px[i * 4 + 3]) px[i * 4 + 3] = 1 + Math.round(FLOOR[(px[i * 4 + 1] + 8) >> 4 & 15] * 254);
		if ((j & 31) === 31) yield;
	}
	let n = 0;
	for (const t of trees) {
		if ((++n & 4095) === 0) yield;
		if (t.shrub || t.fern || !(t.h > 3)) continue;
		const r = crownR(t.h), a = Math.PI * r * r / cell * 254;
		const fx = (t.x - x0) / step - 0.5, fz = (t.z - z0) / step - 0.5, i0 = Math.floor(fx), j0 = Math.floor(fz), u = fx - i0, v = fz - j0;
		for (let k = 0; k < 4; k++) {
			const i = i0 + (k & 1), j = j0 + (k >> 1);
			if (i < 0 || j < 0 || i >= w || j >= h) continue;
			const q = (j * w + i) * 4 + 3;
			if (px[q]) px[q] = Math.min(255, px[q] + Math.round(a * (k & 1 ? u : 1 - u) * (k >> 1 ? v : 1 - v)));
		}
	}
}
// the same at once (a small map, or a test)
export function canopyInto(map, trees) {
	const S = canopySteps(map, trees);
	while (!S.next().done);
}
// how much of a cell the crowns cover, as the ground reads it (0..1; null off the map)
export function canopyAt(map, x, z) {
	const i = Math.floor((x - map.x0) / map.step), j = Math.floor((z - map.z0) / map.step);
	if (i < 0 || j < 0 || i >= map.w || j >= map.h) return null;
	const a = map.px[(j * map.w + i) * 4 + 3];
	return a ? (a - 1) / 254 : null;
}
