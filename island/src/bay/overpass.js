// What a mapped bridge passes over, shared by the decks (freeways.js) and the road paint
// (realcity.js): a footbridge lifted over a street is never also painted across it.

// the ways people walk or ride a bike, not drive
export const FOOT = new Set(['footway', 'path', 'cycleway', 'pedestrian', 'steps', 'track']);

// how far (x, z) is from a road's centre line
export function distTo(r, x, z) {
	let best = 1e9;
	const p = r.pts;
	for (let i = 0; i + 3 < p.length; i += 2) {
		const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
		best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	return best;
}

// the lanes that pass under a bridge: the ones that cross its line, at a fair angle and
// clear of its last few metres (never a road running alongside it or joining it at an end)
export function lanesUnder(r, lanes) {
	const p = r.pts, m = p.length, out = new Set();
	let L = 0;
	for (let i = 0; i + 3 < m; i += 2) L += Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
	const edge = Math.min(6, L * 0.25);
	const [x0, z0, x1, z1] = r.box || [Math.min(p[0], p[m - 2]), Math.min(p[1], p[m - 1]), Math.max(p[0], p[m - 2]), Math.max(p[1], p[m - 1])];
	for (const q of lanes) {
		if (q === r || q.box[2] < x0 || q.box[0] > x1 || q.box[3] < z0 || q.box[1] > z1) continue;
		const c = q.pts;
		let s = 0, hit = false;
		for (let i = 0; i + 3 < m && !hit; i += 2) {
			const ax = p[i], az = p[i + 1], ux = p[i + 2] - ax, uz = p[i + 3] - az, l = Math.hypot(ux, uz);
			for (let k = 0; k + 3 < c.length && !hit; k += 2) {
				const bx = c[k], bz = c[k + 1], vx = c[k + 2] - bx, vz = c[k + 3] - bz, den = ux * vz - uz * vx, lv = Math.hypot(vx, vz);
				if (Math.abs(den) < 0.34 * l * lv) continue;          // (within 20 degrees of parallel)
				const t = ((bx - ax) * vz - (bz - az) * vx) / den, u = ((bx - ax) * uz - (bz - az) * ux) / den;
				if (t < 0 || t > 1 || u < 0 || u > 1) continue;
				const at = s + l * t;
				hit = at > edge && at < L - edge;
			}
			s += l;
		}
		if (hit) out.add(q);
	}
	return out;
}

// a footbridge that crosses a street stands up on its own deck; one over a creek or a
// gully stays on the ground
export function footLifted(r, lanes) {
	if (!r.bridge || !FOOT.has(r.cls)) return false;
	if (r.lifted) return true;
	const up = lanesUnder(r, lanes).size > 0;
	// (only a yes is kept: the street under may be in a region still loading)
	if (up) r.lifted = true;
	return up;
}

// a footbridge mapped as the sidewalk of a road's overpass: running alongside a road bridge,
// close and near parallel (the road's deck carries its sidewalks, freeways.js)
export function sidewalkOf(r, bridges) {
	const p = r.pts, m = p.length, mx = (p[0] + p[m - 2]) / 2, mz = (p[1] + p[m - 1]) / 2;
	let ux = p[m - 2] - p[0], uz = p[m - 1] - p[1];
	const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
	for (const q of bridges) {
		if (q === r || mx < q.box[0] - 25 || mx > q.box[2] + 25 || mz < q.box[1] - 25 || mz > q.box[3] + 25) continue;
		if (distTo(q, mx, mz) > q.w / 2 + 7) continue;
		const c = q.pts, k = c.length, vx = c[k - 2] - c[0], vz = c[k - 1] - c[1], vl = Math.hypot(vx, vz) || 1;
		if (Math.abs(ux * vx + uz * vz) / vl > 0.85) return q;
	}
	return null;
}
