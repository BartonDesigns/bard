// The mapped streets near a point, as the economy reads a building's place (layer.js describe):
// the busiest street it faces (within 40 m), whether two named streets meet by it (within 26 m),
// whether a freeway is near (within 230 m). Asked once for every mapped building round you, and
// each asking walked every street within 230 m point by point: downtown that was the best part
// of the economy's whole rebuild.
//
// So the streets are sorted once per 64 m cell, round its centre: those that are surely
// within reach of every point in the cell, those that surely are not, and between them only the
// pieces of street that might be, kept for the points to measure as before. The answer for a
// point is exactly what walking every street gave: each test is a distance under a limit, and
// a piece further than the limit and the cell's half-diagonal from the centre (and a centimetre
// more) is further than the limit from every point in the cell.
//
// The cells hold the real city's own streets (its regions' and the hand-laid ones), and are let
// go when those change (real.roadVersion); the streets other sources add (the globe's roads and
// lanes, the alleys) can change without a word, so they are asked for at each point as before.
//   createRoadsAt(real)    -> roadsAt(x, z): { busy, corner, highway }

export const DRIVE_CLS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
export const BUSY_CLS = { trunk: 2, primary: 2, secondary: 2, tertiary: 1 };
const FAR = 230, BUSY = 40, CLOSE = 26;
const C = 128, HALF = C * Math.SQRT1_2 + 0.01, MAX_CELLS = 4096;
// (a street that can count for anything here: a freeway, a busy street or one driven)
const counts = (r) => r.cls === 'motorway' || BUSY_CLS[r.cls] || DRIVE_CLS.has(r.cls);

// the old way, one street at a time over all its points (for the sources, and a city without cells)
function street(r, x, z, S) {
	const pts = r.pts;
	if (!pts) return;
	let best = 1e9;
	for (let i = 0; i + 3 < pts.length; i += 2) {
		const ax = pts[i], az = pts[i + 1], dx = pts[i + 2] - ax, dz = pts[i + 3] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
		best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	if (r.cls === 'motorway' && best < FAR) S.highway = true;
	if (best < BUSY && BUSY_CLS[r.cls]) S.busy = Math.max(S.busy, BUSY_CLS[r.cls]);
	if (best < CLOSE && DRIVE_CLS.has(r.cls)) S.close.add(r.name || r);
}
// how far (x, z) is from the piece a-b, exactly as street() measures it
const piece = (ax, az, bx, bz, x, z) => {
	const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
	const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
	return Math.hypot(x - ax - dx * t, z - az - dz * t);
};

export function createRoadsAt(real) {
	const cells = new Map();
	let version = null;
	// one cell's streets: near (pieces within BUSY + HALF of the centre, with their street) and
	// far (the freeways' pieces within FAR + HALF), or highway when a freeway is surely in reach
	// (a street with a point not a number measures as nothing at all, the old way: Math.min of a
	// NaN is NaN; it is kept whole and walked the old way, at each point)
	function cell(i, j) {
		const cx = (i + 0.5) * C, cz = (j + 0.5) * C;
		const near = [], nearR = [], far = [], whole = [];
		let highway = false;
		for (const r of real.nearOwn('roads', cx, cz, FAR + C)) {
			const pts = r.pts;
			if (!pts || !counts(r)) continue;
			let odd = false;
			for (let k = 0; k < pts.length && !odd; k++) odd = !Number.isFinite(pts[k]);
			if (odd) { whole.push(r); continue; }
			const fwy = r.cls === 'motorway', busy = BUSY_CLS[r.cls] || DRIVE_CLS.has(r.cls);
			for (let k = 0; k + 3 < pts.length; k += 2) {
				const ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3], d = piece(ax, az, bx, bz, cx, cz);
				if (busy && d < BUSY + HALF) { near.push(ax, az, bx, bz); nearR.push(r); }
				if (fwy && !highway) {
					if (d < FAR - HALF) highway = true;
					else if (d < FAR + HALF) far.push(ax, az, bx, bz);
				}
			}
		}
		return { near, nearR, far: highway ? [] : far, highway, whole };
	}
	const sources = [];
	return function roadsAt(x, z) {
		const v = real.roadVersion();
		if (v !== version || cells.size > MAX_CELLS) { cells.clear(); version = v; }
		const i = Math.floor(x / C), j = Math.floor(z / C), key = i * 4194304 + j;
		let K = cells.get(key);
		if (!K) cells.set(key, K = cell(i, j));
		const S = { busy: 0, highway: K.highway, close: new Set() };
		const { near, nearR, far, whole } = K;
		for (let k = 0, n = 0; k < near.length; k += 4, n++) {
			const r = nearR[n], d = piece(near[k], near[k + 1], near[k + 2], near[k + 3], x, z);
			if (d < BUSY && BUSY_CLS[r.cls]) S.busy = Math.max(S.busy, BUSY_CLS[r.cls]);
			if (d < CLOSE && DRIVE_CLS.has(r.cls)) S.close.add(r.name || r);
		}
		for (let k = 0; k < far.length && !S.highway; k += 4) if (piece(far[k], far[k + 1], far[k + 2], far[k + 3], x, z) < FAR) S.highway = true;
		for (const r of whole) street(r, x, z, S);
		// (the other sources' streets, as they are now)
		sources.length = 0;
		real.nearSources('roads', x, z, FAR, sources);
		for (const r of sources) if (counts(r)) street(r, x, z, S);
		return { busy: S.busy, corner: S.close.size >= 2, highway: S.highway };
	};
}

// the same answer the old way, every street within reach walked (where the city keeps no cells)
export function roadsAtOnce(real, x, z) {
	const S = { busy: 0, highway: false, close: new Set() };
	for (const r of real.near('roads', x, z, FAR)) street(r, x, z, S);
	return { busy: S.busy, corner: S.close.size >= 2, highway: S.highway };
}
