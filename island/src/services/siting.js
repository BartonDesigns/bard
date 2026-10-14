// Which buildings become the town's hospital, its police and fire stations and its armory.
// Plain numbers, no three.js: the runtime (services/index.js) hands in the buildings it can
// see, wherever they come from (the Bay's mapped blocks, its gridded towns, a town grown on
// the globe), and gets back the same choice every visit.
//
// The ground is laid out in a lattice for each kind of service, one cell a few kilometres
// across for a hospital, less for a fire or police station. Each cell has an anchor (its
// middle, nudged by a hash), and the service stands in the building nearest that anchor
// which can take it: big enough, low enough, on level ground, of a kind a civic building
// would be (an office block, a store, an industrial hall; never a home, a school or a tower).
// So that one building is never wanted by two services, each building is dealt one kind by
// a hash of where it stands; a town with a few dozen big buildings has all four.
//
// The economy's registry of establishments can call siteFor() with its own list later and
// keep the answer: the choice depends only on the buildings and the anchor.

export const SERVICES = {
	// cell: lattice spacing (m); reach: how far from the anchor a building may stand; deal: the
	// share of buildings dealt this kind [from, to); W/D: the least width across the front and
	// depth; area: the most floor; top: the tallest block that can be dressed as one
	hospital: { cell: 3200, reach: 850, deal: [0, 0.34], W: 26, D: 18, area: 4800, top: 26, label: 'Hospital' },
	fire: { cell: 1700, reach: 650, deal: [0.34, 0.58], W: 16, D: 14, area: 2600, top: 16, label: 'Fire station' },
	police: { cell: 1900, reach: 700, deal: [0.58, 0.84], W: 15, D: 13, area: 2600, top: 16, label: 'Police station' },
	armory: { cell: 6400, reach: 1000, deal: [0.84, 1], W: 20, D: 16, area: 5200, top: 16, label: 'Armory' },
};
export const KINDS = Object.keys(SERVICES);

const fract = (v) => v - Math.floor(v);
export const hash2 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

// the building kinds that can take a civic use: the mapped/grown boxes' (5 office, 6 retail,
// 9 industrial) and the gridded towns' (city.js KIND: 5 industry, 7 plain)
const REAL_OK = new Set([5, 6, 9]);
const GRID_OK = new Set([5, 7]);

// one building, as the runtime describes it: { x, z, w, d, a, h (height above its ground),
// kind, grid (true for a gridded town's lot), rise (ground fall across it, m) }
export function dealOf(b) { return hash2(Math.round(b.x * 0.5) + 0.37, Math.round(b.z * 0.5) - 0.71); }
export function fits(kind, b) {
	const S = SERVICES[kind];
	if (!S || !b || !Number.isFinite(b.x + b.z + b.w + b.d)) return false;
	if (!(b.grid ? GRID_OK : REAL_OK).has(b.kind)) return false;
	if (b.w < S.W || b.d < S.D || b.w * b.d > S.area || Math.max(b.w, b.d) > 80) return false;
	if (!(b.h > 3.5) || b.h > S.top) return false;
	if ((b.rise ?? 0) > 2.4) return false;
	const u = dealOf(b);
	return u >= S.deal[0] && u < S.deal[1];
}

// the anchors of a kind's cells within r of (x, z): { key, kind, x, z }
export function anchorsNear(kind, x, z, r) {
	const S = SERVICES[kind], out = [];
	if (!S) return out;
	const C = S.cell, i0 = Math.floor((x - r) / C), i1 = Math.floor((x + r) / C), j0 = Math.floor((z - r) / C), j1 = Math.floor((z + r) / C);
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
		const ax = (i + 0.5 + (hash2(i * 1.7 + kind.length, j * 2.3) - 0.5) * 0.5) * C, az = (j + 0.5 + (hash2(i * 3.1, j * 0.9 + kind.length) - 0.5) * 0.5) * C;
		if (Math.hypot(ax - x, az - z) <= r) out.push({ key: `${kind}:${i}:${j}`, kind, x: ax, z: az });
	}
	return out;
}

// the building a cell's service stands in: the nearest that fits, within reach of the anchor
export function siteFor(kind, anchor, buildings) {
	const S = SERVICES[kind];
	let best = null, bd = Infinity;
	for (const b of buildings) {
		if (!fits(kind, b)) continue;
		const d = Math.hypot(b.x - anchor.x, b.z - anchor.z);
		// (ties broken by position, so the order buildings arrive in never matters)
		if (d > S.reach) continue;
		const tie = Math.abs(d - bd) <= 1e-6;
		if (d < bd - 1e-6 || (tie && (b.x < best.x || (b.x === best.x && b.z < best.z)))) { best = b; bd = d; }
	}
	return best;
}

// every service for the buildings round (x, z): [{ key, kind, building, anchor }]
export function siteServices(buildings, x, z, r) {
	const out = [];
	for (const kind of KINDS) for (const A of anchorsNear(kind, x, z, r)) {
		const b = siteFor(kind, A, buildings);
		if (b) out.push({ key: A.key, kind, building: b, anchor: A });
	}
	return out;
}
