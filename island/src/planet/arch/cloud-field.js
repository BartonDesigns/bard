// CPU counterpart of clouds.js DECK_V/DECK_F. Geometry, holes and coverage use
// the same fields; GPU sine-hash precision remains a visual approximation.
const fr = v => v - Math.floor(v);
const hash = (x, z) => fr(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
export const mistSmooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function mistNoise(x, z) {
	const ix = Math.floor(x), iz = Math.floor(z);
	let fx = x - ix, fz = z - iz;
	fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
	const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
	return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export const mistFractal = (x, z) => mistNoise(x, z) * .53 + mistNoise(x * 2.07 + 3.1, z * 2.07 + 3.1) * .27 + mistNoise(x * 4.3 - 1.7, z * 4.3 - 1.7) * .13 + mistNoise(x * 8.9 + 5.3, z * 8.9 + 5.3) * .07;

// A vertical column is linear in layer height even after the vertex shader's
// displacement. Solve its endpoints, then invert that line for the camera's layer.
export function mistColumn(x, z, band, obs, off = { x: 0, y: 0 }, grid = null) {
	// DECK_V runs at mesh vertices. Interpolate its two triangles, including on
	// phones, rather than sampling a smoother analytic envelope between vertices.
	if (grid) {
		const step = grid.rad * 2 / grid.segments, gx = (x - grid.x + grid.rad) / step, gz = (z - grid.z + grid.rad) / step;
		const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
		const x0 = grid.x - grid.rad + ix * step, z0 = grid.z - grid.rad + iz * step;
		const corners = fx + fz <= 1 ? [[0, 0, 1 - fx - fz], [0, 1, fz], [1, 0, fx]] : [[0, 1, 1 - fx], [1, 1, fx + fz - 1], [1, 0, 1 - fz]];
		const C = { base: 0, top: 0 };
		for (const [cx, cz, weight] of corners) {
			const c = mistColumn(x0 + cx * step, z0 + cz * step, band, obs, off);
			C.base += c.base * weight; C.top += c.top * weight;
		}
		return C;
	}
	const bl = mistNoise((x - off.x) * .012, (z - off.y) * .012) * .6 + mistNoise((x - off.x) * .031 + 4, (z - off.y) * .031 + 4) * .4;
	let heap = 0;
	for (const o of obs.slice(0, 12)) {
		if (o.r <= 0) continue;
		const r = Math.hypot(x - o.x, z - o.z) / (o.r * 4.5);
		heap += o.light * Math.exp(-r * r);
	}
	heap = Math.min(1.6, heap) * (.75 + .5 * bl);
	const depth = band.top - band.base, lift = depth * .6;
	return { base: band.base + lift * ((bl - .42) * .25 + heap * .5), top: band.top + lift * ((bl - .42) + heap * 1.4) };
}

export function mistDensity(point, M, obs, { off = { x: 0, y: 0 }, wind = { x: 1, y: 0 }, time = 0, dusk = .25, ground = -1e9, indoors = false, segments = 52 } = {}) {
	if (indoors || point.y <= ground) return 0;
	const { x, y, z } = point, radial = 1 - mistSmooth(M.rad * .6, M.rad, Math.hypot(x - M.x, z - M.z));
	if (!radial) return 0;
	let qx = x, qz = z, hole = 1, glow = 0;
	for (const o of obs.slice(0, 12)) {
		const R = o.r, dx = x - o.x, dz = z - o.z, r = Math.hypot(dx, dz);
		if (R <= 0 || r > R * 14) continue;
		const s = dx * wind.x + dz * wind.y, b = dx * -wind.y + dz * wind.x;
		const e = Math.exp(-s * s / (R * R * 5));
		let b0 = Math.sign(b) * Math.sqrt(Math.max(0, b * b - R * R * e * 1.2));
		b0 += Math.sin(s / R * .9 - time * .5 + o.x) * R * .55 * (s >= 0 ? 1 : 0) * Math.exp(-s / (R * 7)) * Math.exp(-b * b / (R * R * 2.5));
		qx -= wind.y * (b0 - b); qz += wind.x * (b0 - b);
		hole *= mistSmooth(R * .98, R * 1.35, r);
		const gr = r / (R * 2.6);
		glow += o.light * (Math.exp(-gr * gr) + .12 * Math.exp(-r / (R * 7)));
	}
	if (!hole) return 0;
	const clearance = mistSmooth(0, 9, y - ground);
	let density = 0;
	for (const [b, B] of M.bands.entries()) {
		const C = mistColumn(x, z, B, obs, off, { x: M.x, z: M.z, rad: M.rad, segments }), span = C.top - C.base;
		if (span <= 0 || y <= C.base || y >= C.top) continue;
		const l = (y - C.base) / span, mid = 1 - Math.abs(l * 2 - 1);
		const nx = (qx - off.x) * .0055 + l * 1.7 + b * 9, nz = (qz - off.y) * .0055 + l * 1.7 + b * 9;
		const n = mistFractal(nx, nz), cv = M.cover + b * .13;
		const lanes = mistSmooth(.27, .45, mistNoise((qx - off.x) * .0016 + b * 5 + 11, (qz - off.y) * .0016 + b * 5 + 11));
		const cov = mistSmooth(cv, cv + .16, n + mid * .14 - .05 - (1 - mid) * .08) * lanes;
		const lift = glow * (1 - b * .6) * dusk;
		const body = Math.min(1, cov * (1 + lift * 1.2) + lift * .3) * hole * clearance * radial;
		// Keep the sheet-to-volume transition soft while retaining clear air outside
		// the displaced band. A light-independent floor would fill its actual holes.
		const feather = Math.min(3, span * .2);
		const edge = mistSmooth(C.base, C.base + feather, y) * (1 - mistSmooth(C.top - feather, C.top, y));
		density = Math.max(density, body * edge);
	}
	return density;
}
