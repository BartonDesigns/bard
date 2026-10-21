// A Bay Area freeway's cross section, as Caltrans builds it (and as Josh's footage from the
// passenger seat shows it): each direction's lanes 3.5 m or so, dashed white between them, a
// solid white edge line and a 3 m paved shoulder on the right, a solid yellow edge line on
// the left and the paved left shoulder running on to the median, where a tall single-slope
// concrete wall splits the two directions. Where the two carriageways part (a split median
// in the hills, the run up to an interchange) each keeps a 3 m left shoulder and a metal
// beam guardrail, and the ground between them stays ground.
//
// The mapped freeways come one centre line per direction (OpenStreetMap's), each with the
// motorway's drawn width (the lanes). The median is found from the two: the other
// direction's centre line, straight out to the left. realcity.js paints from this, and
// freeways.js stands the walls and rails on it, so the paint and the walls agree.

export const SHOULDER_R = 3.0;          // the right shoulder, beyond the lanes
export const SHOULDER_L = 3.0;          // the left shoulder where the median is wide
export const SHARED_MAX = 8.3;          // farther than this from the lanes' edge, the median is ground
export const WALL_HALF = 0.3;           // the median wall's half width at its foot
const REACH = 45;                       // how far left to look for the other direction

// the freeway's own carriageways (not its ramps, not on a bridge)
export const isCarriageway = (r) => r.cls === 'motorway' && !r.link && !r.bridge && r.drive !== false;
// the lanes on a carriageway, and each one's width: as many as the traffic drives (streetlife.js)
export const lanesOf = (r) => { const n = Math.max(2, Math.round(r.w / 3.6)); return { n, lw: r.w / n }; };

// The carriageways near you, indexed for gapLeft(): their pieces in 50 m cells (the stretches
// on bridges too: the other direction can be up on its own deck over a street for a while)
export function carriageways(roads) {
	const cells = new Map(), segs = [];
	for (const r of roads) {
		if (r.cls !== 'motorway' || r.link || r.drive === false) continue;
		const p = r.pts;
		for (let i = 0; i + 3 < p.length; i += 2) {
			const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az);
			if (L < 0.5) continue;
			const s = { r, ax, az, bx, bz, dx: (bx - ax) / L, dz: (bz - az) / L, L };
			segs.push(s);
			const i0 = Math.floor((Math.min(ax, bx) - 1) / 50), i1 = Math.floor((Math.max(ax, bx) + 1) / 50);
			const j0 = Math.floor((Math.min(az, bz) - 1) / 50), j1 = Math.floor((Math.max(az, bz) + 1) / 50);
			for (let gi = i0; gi <= i1; gi++) for (let gj = j0; gj <= j1; gj++) { const k = gi * 65536 + gj; let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(s); }
		}
	}
	return { cells, segs };
}

// How far to the left (the left normal: nx = dz, nz = -dx in this world, x east and z south)
// the other direction's centre line runs from (x, z) heading (dx, dz): 0 if none within reach
// (full: { g, r } with the other direction's road, null if none)
export function gapLeft(C, x, z, dx, dz, full = false) {
	const nx = dz, nz = -dx;
	let best = 0, other = null;
	// the cells under the line out to the left
	const seen = new Set();
	for (let t = 0; t <= REACH; t += 25) {
		const px = x + nx * t, pz = z + nz * t;
		for (let gi = -1; gi <= 1; gi++) for (let gj = -1; gj <= 1; gj++) {
			const k = (Math.floor(px / 50) + gi) * 65536 + Math.floor(pz / 50) + gj;
			if (seen.has(k)) continue;
			seen.add(k);
			for (const s of C.cells.get(k) || []) {
				// (the other direction: heading back the way this one comes)
				if (s.dx * dx + s.dz * dz > -0.8) continue;
				// where the ray out to the left crosses the piece
				const ex = s.bx - s.ax, ez = s.bz - s.az, den = nx * ez - nz * ex;
				if (Math.abs(den) < 1e-6) continue;
				const qx = s.ax - x, qz = s.az - z, t1 = (qx * ez - qz * ex) / den, u = (qx * nz - qz * nx) / den;
				if (u < -0.02 || u > 1.02 || t1 < 4 || t1 > REACH) continue;
				if (!best || t1 < best) { best = t1; other = s.r; }
			}
		}
	}
	return full ? { g: best, r: other } : best;
}

// The median along a carriageway's points pts [{x, z, dx, dz}]: for each, the gap to the other
// direction (0: none near), steadied over its neighbours so a ramp's piece or a gap in the map
// doesn't make the wall jump; and from it where the left edge of the paving and the wall or rail go
export function medianAlong(C, r, pts) {
	const raw = pts.map((p) => gapLeft(C, p.x, p.z, p.dx, p.dz));
	const hw = r.w / 2, out = [];
	for (let i = 0; i < pts.length; i++) {
		const win = [];
		for (let k = Math.max(0, i - 2); k <= Math.min(pts.length - 1, i + 2); k++) win.push(raw[k]);
		win.sort((a, b) => a - b);
		const g = win[win.length >> 1];
		out.push(medianFor(hw, g));
	}
	return out;
}
// the median for a gap g (0: none): { shared: one wall between the two directions, at `wall`
// out to the left of the centre line; or a rail at `wall` and the paving to `pave` }
export function medianFor(hw, g) {
	if (g && g / 2 <= hw + SHARED_MAX) return { shared: true, wall: g / 2, pave: g / 2, g };
	return { shared: false, wall: hw + SHOULDER_L + 0.25, pave: hw + SHOULDER_L + 0.6, g };
}
