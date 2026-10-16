// Standing things on the ground. A plant or a prop set at the height under its centre floats on
// the downhill side of a slope by its footprint's radius times the slope, and a sliver of sky
// shows under it from below. baseHeight finds the lowest ground under the footprint (the centre
// and four points round it at r) and sinks the base a little further, so the foot always meets
// the ground and nothing hovers at any distance. Trees stand upright whatever the slope (they
// grow toward the light); rocks and low plants lie with it (slopeTilt).
//
// Shared by every scatter of plants and props: the island's (world/vegetation.js), the region's
// (region/flora.js), the globe's woods (earth/globetrees.js) and the Bay's trees (bay/city.js).
// No allocation: the caller's quaternion is written in place.

const finite = (v) => typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity;

// the ground under a footprint of radius r at (x, z): the lowest of five samples, less sink.
// ground(x, z) is the height function the scatter already uses (the ground as drawn there)
export function baseHeight(ground, x, z, r, sink = 0.05) {
	const h = ground(x, z);
	let lo = finite(h) ? h : 0;
	if (r > 0) {
		const a = ground(x + r, z), b = ground(x - r, z), c = ground(x, z + r), d = ground(x, z - r);
		if (finite(a) && a < lo) lo = a;
		if (finite(b) && b < lo) lo = b;
		if (finite(c) && c < lo) lo = c;
		if (finite(d) && d < lo) lo = d;
		// (a footprint over a drop, a ledge or a cliff's lip: never sink more than a stride below
		// the centre, or a tree would vanish into the hillside)
		if (finite(h) && lo < h - r * 1.5 - 0.5) lo = h - r * 1.5 - 0.5;
	}
	return lo - sink;
}

// the slope at (x, z): rise over run, from central differences e metres either side
export function slopeAt(ground, x, z, e = 1) {
	const gx = (ground(x + e, z) - ground(x - e, z)) / (2 * e), gz = (ground(x, z + e) - ground(x, z - e)) / (2 * e);
	const s = Math.hypot(gx, gz);
	return finite(s) ? s : 0;
}

// the same from a slope already in hand (rise over run): the centre's height h less the drop
// across r, so a scatter that has measured its slope pays for no more samples
export function baseFromSlope(h, slope, r, sink = 0.05) {
	const s = finite(slope) ? Math.min(Math.abs(slope), 3) : 0;
	return (finite(h) ? h : 0) - Math.min(s * r, r * 1.5 + 0.5) - sink;
}

// a quaternion (written into q, a THREE.Quaternion or anything with set(x, y, z, w)) that tips
// the up axis toward the ground's normal at (x, z) by k (0 upright, 1 lying flat on the slope),
// turned about yaw first. For rocks (k near 1) and low plants (k about a half)
export function slopeTilt(ground, x, z, e, yaw, k, q) {
	const gx = (ground(x + e, z) - ground(x - e, z)) / (2 * e), gz = (ground(x, z + e) - ground(x, z - e)) / (2 * e);
	return tiltFromGradient(gx, gz, yaw, k, q);
}
// ...from the ground's gradient (dh/dx, dh/dz)
export function tiltFromGradient(gx, gz, yaw, k, q) {
	if (!finite(gx) || !finite(gz)) gx = gz = 0;
	// the normal (-gx, 1, -gz), eased toward up by k, normalised
	let nx = -gx * k, ny = 1, nz = -gz * k;
	const nl = Math.hypot(nx, ny, nz);
	nx /= nl; ny /= nl; nz /= nl;
	// the shortest turn from up (0, 1, 0) to n: axis (nz, 0, -nx), angle acos(ny)
	const ha = Math.acos(Math.min(1, ny)) * 0.5, s = Math.sin(ha), al = Math.hypot(nz, nx);
	const tx = al > 1e-6 ? nz / al * s : 0, tz = al > 1e-6 ? -nx / al * s : 0, tw = Math.cos(ha);
	// then the turn about the vertical first: tilt * yaw
	const yh = yaw * 0.5, ys = Math.sin(yh), yc = Math.cos(yh);
	q.set(tx * yc - tz * ys, tw * ys, tz * yc + tx * ys, tw * yc);
	return q;
}
