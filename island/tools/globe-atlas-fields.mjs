// Atlas-only fields shared by the full terrain bake and the offline character refresh.
import { region } from '../src/earth/atlas.js';

export const enc = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// how a kind of relief is shaped: floor (m) and gain (times the local relief) set the
// detail's height; ridge its sharpness; the rest the particular forms
const RELIEF = {
	mountains: { floor: 60, gain: 1.15, ridge: 0.85 },
	fjord: { floor: 60, gain: 1.2, ridge: 0.9 },
	'taiga plains and mountains': { floor: 25, gain: 0.9, ridge: 0.55 },
	hills: { floor: 25, gain: 0.9, ridge: 0.45 }, 'rocky hills': { floor: 30, gain: 0.9, ridge: 0.6 }, 'low hills': { floor: 12, gain: 0.8, ridge: 0.3 },
	'volcanic hills': { floor: 25, gain: 0.9, ridge: 0.4 }, rolling: { floor: 14, gain: 0.75, ridge: 0.25 },
	plains: { floor: 4, gain: 0.5, ridge: 0.1 }, 'coastal plain': { floor: 3, gain: 0.4, ridge: 0.05 }, 'plains edge': { floor: 8, gain: 0.6, ridge: 0.2 },
	'river plain': { floor: 3, gain: 0.4, ridge: 0.05 }, 'river valley': { floor: 8, gain: 0.8, ridge: 0.3 }, delta: { floor: 1.5, gain: 0.3, ridge: 0 }, 'delta plain': { floor: 1.5, gain: 0.3, ridge: 0 },
	wetland: { floor: 1.5, gain: 0.3, ridge: 0 }, lagoon: { floor: 2, gain: 0.4, ridge: 0 }, coastal: { floor: 8, gain: 0.7, ridge: 0.2 },
	steppe: { floor: 6, gain: 0.55, ridge: 0.15 }, 'rainforest basin': { floor: 6, gain: 0.6, ridge: 0.15 },
	plateau: { floor: 20, gain: 0.85, ridge: 0.35, terrace: 0.45 }, 'highland plateau': { floor: 25, gain: 0.9, ridge: 0.45, terrace: 0.25 },
	'desert plateau': { floor: 25, gain: 0.9, ridge: 0.3, terrace: 0.7 }, 'volcanic plateau': { floor: 15, gain: 0.8, ridge: 0.25, terrace: 0.35 },
	'loess plateau': { floor: 25, gain: 0.9, ridge: 0.55, terrace: 0.5 }, canyon: { floor: 40, gain: 1.0, ridge: 0.45, terrace: 0.9 },
	'eroded tuff valleys': { floor: 30, gain: 0.9, ridge: 0.5, terrace: 0.6 },
	'basin and range': { floor: 30, gain: 1.1, ridge: 0.7, bnr: 0.8 }, 'desert basins and mountains': { floor: 25, gain: 1.0, ridge: 0.6, bnr: 0.45 },
	volcanic: { floor: 30, gain: 1.0, ridge: 0.5 }, 'volcanic islands': { floor: 30, gain: 1.0, ridge: 0.55 }, islands: { floor: 18, gain: 0.9, ridge: 0.4 },
	dunes: { floor: 10, gain: 0.5, ridge: 0.2, dune: 0.9 }, desert: { floor: 8, gain: 0.6, ridge: 0.3, dune: 0.45 }, 'gravel desert and steppe': { floor: 6, gain: 0.55, ridge: 0.2, dune: 0.15 },
	karst: { floor: 40, gain: 0.9, ridge: 0.4, karst: 0.9 }, 'karst plain': { floor: 10, gain: 0.6, ridge: 0.2, karst: 0.4 },
	ocean: { floor: 0, gain: 0, ridge: 0 },
};
// the Appalachians' long ridges run north-east (the atlas's region, and the Valley and Ridge)
const RIDGE_VALLEY = /^na\.(app|ma)\b/;
function reliefOf(R) {
	const k = (R.terrain?.relief || 'rolling').toLowerCase();
	const b = { floor: 14, gain: 0.75, ridge: 0.25, terrace: 0, bnr: 0, rv: 0, dune: 0, karst: 0, ...(RELIEF[k] || {}) };
	if (RIDGE_VALLEY.test(R.id) && /mountain|hill|rolling/.test(k)) b.rv = 0.7;
	return b;
}
// how much of the ground is under trees, from the biome, then held down by a dry climate
export function treesOf(R) {
	const b = String(R.biome || '').toLowerCase(), rain = R.climate?.rain ?? 600;
	if (/tundra|ice sheet|^ice$|polar desert/.test(b) && !/forest|taiga|boreal|woodland/.test(b)) return 0;
	let v = 0.35;
	if (/rainforest|taiga|boreal|forest|woodland|jungle|swamp|bayou/.test(b)) v = 0.75;
	if (/farmland|farm/.test(b)) v = /forest/.test(b) ? 0.42 : 0.2;
	if (/savanna|bushveld|chaparral|mediterranean/.test(b)) v = 0.28;
	if (/prairie|steppe|grass/.test(b)) v = 0.06;
	if (/desert/.test(b)) v = 0.02;
	if (/alpine/.test(b)) v = 0.35;
	if (/tropical island|island|subtropical/.test(b)) v = 0.5;
	if (!b) v = Math.min(0.7, Math.max(0.02, (rain - 250) / 1100));
	return Math.min(v, Math.max(0.02, (rain - 150) / 700));
}
const cacheR = new Map();
function charOf(id, R) { let c = cacheR.get(id); if (!c) cacheR.set(id, c = { ...reliefOf(R), trees: treesOf(R) }); return c; }

export function characterOf(at) {
	const c = { floor: 0, gain: 0, ridge: 0, terrace: 0, bnr: 0, rv: 0, dune: 0, karst: 0, trees: 0 };
	if (!at?.land) return c;
	const total = at.weights.reduce((a, w) => a + w.w, 0) || 1;
	for (const w of at.weights) {
		const R = charOf(w.id, region(w.id));
		for (const f in c) c[f] += R[f] * w.w / total;
	}
	return c;
}

export function surfaceOf(at) {
	if (!at) return { ground: [[70, 90, 110], [70, 90, 110]], climate: [180, enc(Math.sqrt(800) * 4), 0] };
	const { ground, temp, rain, snow } = at.mix;
	return {
		ground: [hex(ground[0]), hex(ground[1])],
		climate: [enc(((temp[0] + temp[1]) / 2 + 30) * 4), enc(Math.sqrt(Math.max(0, rain)) * 4), enc(snow * 255)],
	};
}
