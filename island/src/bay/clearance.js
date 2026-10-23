// Where no tree may stand: the carriageways and the sidewalks beside them, a cul-de-sac's
// turning circle, the trails and footways, the driveways and front walks, the freeways
// beyond the mapped regions, and every junction's sight triangle (a disc round the corner,
// out along each kerb as far as a driver needs to see). Built once per city rebuild into a
// grid of 16 m cells, so a tree asks only the few pieces in its own cell.

import { toWorld } from './geo.js';
import { ROUTES } from './roads.js';
import { realCovered } from './realcity.js';
import { FOOT } from './overpass.js';
import { runAll } from '../world/buildslice.js';

const C = 16, REACH = 6;                 // cell size; the widest crown a check may ask for

let routes = null;
export function makeClearance(real, cx, cz, R) { return runAll(makeClearanceSteps(real, cx, cz, R)); }
// the same in steps (a yield every so many roads, and between the roads, the junctions, the paths
// and the routes), for the city's rebuild to run a frame's share at a time (city.js)
export function* makeClearanceSteps(real, cx, cz, R) {
	const cells = new Map(), key = (i, j) => i * 65536 + j;
	// a piece: a segment and how far either side of its line is kept clear (and for a street
	// tree in a well at the kerb, how far: the carriageway alone, streettrees.js)
	const put = (ax, az, bx, bz, pad, well = pad) => {
		const m = pad + REACH;
		for (let i = Math.floor((Math.min(ax, bx) - m) / C); i <= Math.floor((Math.max(ax, bx) + m) / C); i++) for (let j = Math.floor((Math.min(az, bz) - m) / C); j <= Math.floor((Math.max(az, bz) + m) / C); j++) {
			const k = key(i, j);
			let c = cells.get(k);
			if (!c) cells.set(k, c = []);
			c.push(ax, az, bx, bz, pad, well);
		}
	};
	const nodes = new Map(), nk = (x, z) => Math.round(x / 1.5) * 65536 + Math.round(z / 1.5);
	let n = 0;
	for (const r of real.near('roads', cx, cz, R)) {
		if ((++n & 63) === 0) yield;
		const p = r.pts, hw = r.w / 2;
		// (a town street's sidewalk is part of it; the 0.5 m beyond is the setback)
		const pad = r.drive ? hw + (r.walked ? 1.7 : 0.3) + 0.5 : FOOT.has(r.cls) ? hw + 0.5 : hw + 0.3;
		const well = r.drive && r.walked ? hw + 0.35 : pad;
		for (let i = 0; i + 3 < p.length; i += 2) put(p[i], p[i + 1], p[i + 2], p[i + 3], pad, well);
		if (r.end0) put(p[0], p[1], p[0], p[1], 14.7);
		if (r.end1) put(p[p.length - 2], p[p.length - 1], p[p.length - 2], p[p.length - 1], 14.7);
		if (!r.drive || r.bridge) continue;
		for (let i = 0; i < p.length; i += 2) {
			const k = nk(p[i], p[i + 1]);
			let n = nodes.get(k);
			if (!n) nodes.set(k, n = { x: p[i], z: p[i + 1], legs: 0, hw: 0, big: false });
			n.legs += i === 0 || i === p.length - 2 ? 1 : 2;
			n.hw = Math.max(n.hw, hw); n.big = n.big || ['motorway', 'trunk', 'primary', 'secondary'].includes(r.cls);
		}
	}
	yield;
	// the sight triangles: where three or more legs of road meet, nothing tall within the
	// corner and 9 m along each kerb (15 m where an arterial is one of them)
	for (const n of nodes.values()) if (n.legs >= 3) put(n.x, n.z, n.x, n.z, n.hw + (n.big ? 15 : 9));
	yield;
	for (const q of real.near('paths', cx, cz, R)) put(q.ax, q.az, q.bx, q.bz, q.w / 2 + 0.3);
	yield;
	// the freeways and the Iron Horse Trail where the map doesn't draw them (roads.js)
	if (!routes) routes = Object.values(ROUTES).map((ll) => ll.map(([a, b]) => toWorld(a, b)));
	for (const pts of routes) for (let i = 0; i + 1 < pts.length; i++) {
		const a = pts[i], b = pts[i + 1];
		if (Math.hypot((a.x + b.x) / 2 - cx, (a.z + b.z) / 2 - cz) > R + Math.hypot(b.x - a.x, b.z - a.z)) continue;
		if (realCovered(a.x, a.z) && realCovered(b.x, b.z)) continue;
		put(a.x, a.z, b.x, b.z, 17);
	}
	// is a circle of radius r at (x, z) clear of all of it (well: a street tree in a tree well,
	// which may stand in the sidewalk)
	function clear(x, z, r = 0.3, well = false) {
		const c = cells.get(key(Math.floor(x / C), Math.floor(z / C)));
		if (!c) return true;
		for (let i = 0; i < c.length; i += 6) {
			const ax = c[i], az = c[i + 1], dx = c[i + 2] - ax, dz = c[i + 3] - az, l2 = dx * dx + dz * dz;
			const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
			if (Math.hypot(x - ax - dx * t, z - az - dz * t) < c[i + (well ? 5 : 4)] + Math.min(r, REACH)) return false;
		}
		return true;
	}
	return { clear };
}
