// A way by road from one place to another, for a convoy or a police cruiser: from the road
// nearest the start, along the mapped roads (world.real: the Bay's survey and the towns grown
// on the globe), at each end taking the road that leads on nearest the goal, and the last
// stretch across the ground. Where there are no roads it is the straight line. Pure but for
// the roads it is handed: near(x, z, r) -> [{ pts: [x, z, ...], cls }].

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// the polyline's points from index i to its end (dir 1) or its start (dir -1)
function walk(pts, i, dir, out) { for (let k = i; k >= 0 && k < pts.length; k += 2 * dir) out.push(pts[k], pts[k + 1]); }

export function roadRoute(near, from, to, { maxSteps = 40, snap = 400 } = {}) {
	const out = [from.x, from.z];
	if (!near) { out.push(to.x, to.z); return finish(out); }
	let x = from.x, z = from.z;
	const used = new Set();
	for (let step = 0; step < maxSteps; step++) {
		if (dist(x, z, to.x, to.z) < 250) break;
		let best = null;
		for (const r of near(x, z, step ? 30 : snap) || []) {
			if (used.has(r) || !r.pts || r.pts.length < 4 || /footway|path|steps|cycleway|pedestrian|track/.test(r.cls || '')) continue;
			const P = r.pts, n = P.length;
			// where we join it (the nearest point), and which way along it leads nearer the goal
			let ji = 0, jd = Infinity;
			for (let i = 0; i < n; i += 2) { const d = dist(P[i], P[i + 1], x, z); if (d < jd) { jd = d; ji = i; } }
			for (const dir of [1, -1]) {
				const ei = dir > 0 ? n - 2 : 0;
				if (ei === ji) continue;
				const gain = dist(x, z, to.x, to.z) - dist(P[ei], P[ei + 1], to.x, to.z);
				const score = gain - jd * 2 + (/motorway|trunk|primary/.test(r.cls || '') ? 120 : 0);
				if (gain > 0 && (!best || score > best.score)) best = { r, ji, dir, ei, score };
			}
		}
		if (!best) break;
		used.add(best.r);
		walk(best.r.pts, best.ji, best.dir, out);
		x = best.r.pts[best.ei]; z = best.r.pts[best.ei + 1];
	}
	out.push(to.x, to.z);
	return finish(out);
}
// the route without its last stretch across the ground when that is long (a vehicle stops on
// the road nearest the goal rather than driving through the block to it)
export function trimToRoad(R, max = 15) {
	const n = R.pts.length;
	if (n < 6) return R;
	const last = dist(R.pts[n - 4], R.pts[n - 3], R.pts[n - 2], R.pts[n - 1]);
	return last > max ? finish(R.pts.slice(0, n - 2)) : R;
}
// a stretch of points [x, z, ...] leading into a route, joined on
export function joinRoute(pts, R) { return finish([...pts, ...R.pts]); }
// a route ended at distance s along it (a column pulled up short at a wall: military/dispatch.js)
export function cutRoute(R, s) {
	const q = along(R, s), pts = [];
	for (let i = 0; i < R.L.length && R.L[i] < s; i++) pts.push(R.pts[i * 2], R.pts[i * 2 + 1]);
	pts.push(q.x, q.z);
	return finish(pts.length >= 4 ? pts : [R.pts[0], R.pts[1], q.x, q.z]);
}
// any line of points [x, z, ...] as a route, to travel along (vehicles/lane-path.js's lanes)
export const routeOf = (pts) => finish(pts);
// with its running length, for travelling along it
function finish(pts) {
	const L = [0];
	for (let i = 2; i < pts.length; i += 2) L.push(L[L.length - 1] + dist(pts[i - 2], pts[i - 1], pts[i], pts[i + 1]));
	return { pts, L, length: L[L.length - 1] };
}
// where along a route at distance s: { x, z, dx, dz } (dx, dz the unit heading)
export function along(R, s) {
	const { pts, L } = R, n = L.length;
	if (n < 2) return { x: pts[0], z: pts[1], dx: 0, dz: 1 };
	s = Math.max(0, Math.min(R.length, s));
	let lo = 0, hi = n - 1;
	while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
	const seg = L[hi] - L[lo] || 1, t = (s - L[lo]) / seg;
	const ax = pts[lo * 2], az = pts[lo * 2 + 1], bx = pts[hi * 2], bz = pts[hi * 2 + 1], l = dist(ax, az, bx, bz) || 1;
	return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / l, dz: (bz - az) / l };
}
