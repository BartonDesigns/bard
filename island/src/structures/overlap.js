// No building through another, through a street or into a landmark. The footprints come
// from three places that never saw each other: the surveyed map's boxes (fitted outlines that
// overlap their neighbours, set back off the street by realcity.js but only so far), the
// grown towns' lots (civgen.js), and the procedural grid's lots (city.js), whose blocks meet
// where two grids or a grid and a freeway cross. Each overlap is settled the way a planner
// would: the smaller building gives way, trimmed back along whichever of its sides frees it
// soonest, or (where that would take more than a good share of it) left out altogether.
//
// Everything here is plain numbers, no three.js, so the node tests can run it on the baked
// regions themselves (island/tools/structures-overlap.test.mjs).
//
// A box is { x, z, w, d, a }: centre, width along its local x, depth along its local z,
// yaw a (local x points along (cos a, sin a), local z along (-sin a, cos a)), as realcity.js
// and city.js have them.

const TOL = 0.05;           // overlaps thinner than this are hairlines, not intersections
const CUT_MAX = 0.45;       // never trim more than this share of a side
const MIN_SIDE = 2.4;       // a trimmed building keeps at least this much each way

// the box's frame: world to local and back
const toLocal = (b, x, z) => { const c = Math.cos(b.a), s = Math.sin(b.a), dx = x - b.x, dz = z - b.z; return [c * dx + s * dz, -s * dx + c * dz]; };
export function corners(b) {
	const c = Math.cos(b.a), s = Math.sin(b.a), hw = b.w / 2, hd = b.d / 2;
	return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [b.x + c * u - s * v, b.z + s * u + c * v]);
}
// half the box's extent seen along a unit direction
const halfAlong = (b, ax, az) => { const c = Math.cos(b.a), s = Math.sin(b.a); return (Math.abs(ax * c + az * s) * b.w + Math.abs(-ax * s + az * c) * b.d) / 2; };
// how deep two boxes run into each other (separating axes): > 0 overlapping, <= 0 clear
export function penetration(A, B) {
	const dx = B.x - A.x, dz = B.z - A.z;
	let best = 1e9;
	for (const b of [A, B]) {
		const c = Math.cos(b.a), s = Math.sin(b.a);
		for (const [ax, az] of [[c, s], [-s, c]]) {
			const pen = halfAlong(A, ax, az) + halfAlong(B, ax, az) - Math.abs(dx * ax + dz * az);
			if (pen < best) best = pen;
			if (best <= 0) return best;
		}
	}
	return best;
}
// how much of box a's outline lies inside box b, from its corners, its middle and its edges'
// middles (0..1): a crown on a tower, a storey over part of a house, are inside their own
export function inside(a, b) {
	const c = Math.cos(a.a), s = Math.sin(a.a), hw = a.w / 2, hd = a.d / 2;
	let n = 0;
	for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]]) {
		const [lx, lz] = toLocal(b, a.x + c * u * hw - s * v * hd, a.z + s * u * hw + c * v * hd);
		if (Math.abs(lx) <= b.w / 2 + 0.05 && Math.abs(lz) <= b.d / 2 + 0.05) n++;
	}
	return n / 9;
}
// the box with one side brought in by cut: side 0 +x, 1 -x, 2 +z, 3 -z
export function trimmed(b, side, cut) {
	const c = Math.cos(b.a), s = Math.sin(b.a), along = side < 2, sg = side % 2 === 0 ? 1 : -1;
	const ux = along ? c : -s, uz = along ? s : c;
	return { ...b, x: b.x - ux * sg * cut / 2, z: b.z - uz * sg * cut / 2, w: along ? b.w - cut : b.w, d: along ? b.d : b.d - cut };
}
// the least trim (side and depth) that clears box b of whatever clear(b2) says, or null
function leastTrim(b, clear) {
	let best = null;
	for (let side = 0; side < 4; side++) {
		const size = side < 2 ? b.w : b.d, lim = Math.min(size * CUT_MAX, size - MIN_SIDE);
		if (lim <= 0 || !clear(trimmed(b, side, lim))) continue;
		let lo = 0, hi = lim;
		for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (clear(trimmed(b, side, m))) hi = m; else lo = m; }
		if (!best || hi < best.cut) best = { side, cut: hi + 0.02 };
	}
	return best;
}
const apply = (b, t) => { const n = t.shift ? shifted(b, t.ax, t.az, t.cut) : trimmed(b, t.side, t.cut); b.x = n.x; b.z = n.z; b.w = n.w; b.d = n.d; };
// the box moved by s along (ax, az)
const shifted = (b, ax, az, s) => ({ ...b, x: b.x + ax * s, z: b.z + az * s });
// the least move (along either box's axes, up to lim) that clears box b, or null
function leastShift(b, other, clear, lim = 2.5) {
	let best = null;
	const dirs = [];
	for (const q of [b, other]) { const c = Math.cos(q.a), s = Math.sin(q.a); dirs.push([c, s], [-c, -s], [-s, c], [s, -c]); }
	for (const [ax, az] of dirs) {
		if (!clear(shifted(b, ax, az, lim))) continue;
		let lo = 0, hi = lim;
		for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (clear(shifted(b, ax, az, m))) hi = m; else lo = m; }
		if (!best || hi < best.cut) best = { shift: true, ax, az, cut: hi + 0.02 };
	}
	return best;
}

// ---------- streets ----------
// the distance from a segment to the box's outline (0 where it crosses the box)
function segBox(b, ax, az, bx, bz) {
	const [px, pz] = toLocal(b, ax, az), [qx, qz] = toLocal(b, bx, bz), hw = b.w / 2, hd = b.d / 2;
	// (clipped against the box: crossing it is distance 0)
	let t0 = 0, t1 = 1;
	const dx = qx - px, dz = qz - pz;
	let hit = true;
	for (const [p, q, lo, hi] of [[px, dx, -hw, hw], [pz, dz, -hd, hd]]) {
		if (Math.abs(q) < 1e-9) { if (p < lo || p > hi) { hit = false; break; } continue; }
		let u0 = (lo - p) / q, u1 = (hi - p) / q;
		if (u0 > u1) { const t = u0; u0 = u1; u1 = t; }
		t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
		if (t0 > t1) { hit = false; break; }
	}
	if (hit) return 0;
	const box = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - hw), Math.max(0, Math.abs(z) - hd));
	const seg = (x, z) => { const l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - px) * dx + (z - pz) * dz) / l2)); return Math.hypot(x - px - dx * t, z - pz - dz * t); };
	return Math.min(box(px, pz), box(qx, qz), seg(-hw, -hd), seg(hw, -hd), seg(hw, hd), seg(-hw, hd));
}
// the roads that matter to a building: the carriageways (not the bridges that pass over,
// not the paths and tracks, which the map draws through yards)
const CARRIAGE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
export const carriageway = (r) => !r.bridge && CARRIAGE.has(r.cls);
// whether box b clears the road (its carriageway, plus a margin)
export function roadClear(b, r, margin = 0) {
	const p = r.pts, hw = r.w / 2 + margin;
	const R = Math.hypot(b.w, b.d) / 2 + hw;
	if (r.box && (b.x < r.box[0] - R || b.x > r.box[2] + R || b.z < r.box[1] - R || b.z > r.box[3] + R)) return true;
	for (let i = 0; i + 3 < p.length; i += 2) {
		const mx = Math.min(p[i], p[i + 2]) - R, Mx = Math.max(p[i], p[i + 2]) + R, mz = Math.min(p[i + 1], p[i + 3]) - R, Mz = Math.max(p[i + 1], p[i + 3]) + R;
		if (b.x < mx || b.x > Mx || b.z < mz || b.z > Mz) continue;
		if (segBox(b, p[i], p[i + 1], p[i + 2], p[i + 3]) < hw - TOL) return false;
	}
	return true;
}

// ---------- a spatial grid of boxes ----------
function grid(boxes, cell = 32) {
	const G = new Map(), key = (i, j) => i * 92821 + j;
	const span = (b, pad, f) => {
		const r = Math.hypot(b.w, b.d) / 2 + pad;
		for (let j = Math.floor((b.z - r) / cell); j <= Math.floor((b.z + r) / cell); j++) for (let i = Math.floor((b.x - r) / cell); i <= Math.floor((b.x + r) / cell); i++) f(key(i, j));
	};
	boxes.forEach((b, k) => span(b, 0, (g) => { let l = G.get(g); if (!l) G.set(g, l = []); l.push(k); }));
	let mark = 0;
	const seen = new Int32Array(boxes.length);
	return (k, f) => { const m = ++mark; span(boxes[k], 0, (g) => { for (const n of G.get(g) || []) if (n !== k && seen[n] !== m) { seen[n] = m; f(n); } }); };
}

// ---------- counting ----------
// buildings through buildings (pairs, not parts of one house), through streets, on a
// landmark's ground; same(a, b) says two boxes are parts of one building
export function countOverlaps(boxes, { roads = [], landmark = null, same = sameGroup, solid = () => true, min = 0.1 } = {}) {
	const list = boxes.filter((b) => !b.gone && solid(b));
	const near = grid(list);
	let bb = 0, br = 0, bl = 0;
	for (let a = 0; a < list.length; a++) near(a, (b) => { if (b > a && !same(list[a], list[b]) && !part(list[a], list[b]) && penetration(list[a], list[b]) > min) bb++; });
	const rn = roadIndex(roads);
	for (const b of list) {
		if (segsHit(b, rn(b), -min).some((r, n) => n % 2 === 0 && r.cls !== 'service')) br++;
		if (landmark && corners(b).some(([x, z]) => landmark(x, z, 0))) bl++;
	}
	return { buildings: list.length, bb, br, bl, total: bb + br + bl };
}
export const sameGroup = (a, b) => !!a.grp && a.grp === b.grp;
// a box's height, whichever way it was given (city.js lots: h; the map's boxes: wallH + roofH)
const heightOf = (b) => b.h ?? (b.wallH || 0) + (b.roofH || 0);
const tallerOf = (small, big) => heightOf(small) > heightOf(big) + 0.5;
// one standing inside the other and above it: a tower on its podium, one building
const part = (a, b) => { const [s, g] = a.w * a.d < b.w * b.d ? [a, b] : [b, a]; return tallerOf(s, g) && inside(s, g) > 0.85; };
// the carriageways' pieces near a box: a 50 m grid of segments, each [road, index]
export function roadIndex(roads) {
	const G = new Map(), C = 50, key = (i, j) => i * 92821 + j;
	for (const r of roads) {
		if (!carriageway(r)) continue;
		const p = r.pts, pad = r.w / 2 + 2;
		for (let i = 0; i + 3 < p.length; i += 2) {
			const x0 = Math.min(p[i], p[i + 2]) - pad, x1 = Math.max(p[i], p[i + 2]) + pad, z0 = Math.min(p[i + 1], p[i + 3]) - pad, z1 = Math.max(p[i + 1], p[i + 3]) + pad;
			for (let gj = Math.floor(z0 / C); gj <= Math.floor(z1 / C); gj++) for (let gi = Math.floor(x0 / C); gi <= Math.floor(x1 / C); gi++) { const k = key(gi, gj); let l = G.get(k); if (!l) G.set(k, l = []); l.push(r, i); }
		}
	}
	// (the segments within reach of b: a flat [road, index, road, index...]; one met in two cells
	// is listed twice, which costs a second look and nothing else)
	return (b) => {
		const R = Math.hypot(b.w, b.d) / 2 + 2, out = [];
		for (let j = Math.floor((b.z - R) / C); j <= Math.floor((b.z + R) / C); j++) for (let i = Math.floor((b.x - R) / C); i <= Math.floor((b.x + R) / C); i++) {
			const l = G.get(key(i, j));
			if (l) for (let n = 0; n < l.length; n++) out.push(l[n]);
		}
		return out;
	};
}
// whether box b clears the given segments (flat [road, index...]) by margin
function segsClear(b, segs, margin) {
	const R = Math.hypot(b.w, b.d) / 2;
	for (let n = 0; n < segs.length; n += 2) {
		const r = segs[n], i = segs[n + 1], p = r.pts, hw = r.w / 2 + margin, e = R + hw;
		if (b.x < Math.min(p[i], p[i + 2]) - e || b.x > Math.max(p[i], p[i + 2]) + e || b.z < Math.min(p[i + 1], p[i + 3]) - e || b.z > Math.max(p[i + 1], p[i + 3]) + e) continue;
		if (segBox(b, p[i], p[i + 1], p[i + 2], p[i + 3]) < hw - TOL) return false;
	}
	return true;
}
// the segments of segs that box b runs into
function segsHit(b, segs, margin) {
	const out = [];
	for (let n = 0; n < segs.length; n += 2) if (!segsClear(b, [segs[n], segs[n + 1]], margin)) out.push(segs[n], segs[n + 1]);
	return out;
}

// ---------- settling them ----------
// Settles a list of footprints in place. opts:
//   roads      the streets (realcity/civgen shape: { cls, w, pts, bridge })
//   landmark   (x, z, r) => true on a landmark's ground (bay/footprints.js onLandmark)
//   same(a, b) two parts of one building (meant to overlap)
//   solid(b)   a building at all (city.js lists hold lawns, fences and awnings too)
//   keep(b)    never moved nor dropped (the surveyed buildings, when the grid's give way to them)
//   composite  boxes mostly inside another are a part of it (a crown, a storey over a wing)
//   margin     how far clear of a carriageway
//   pen        how deep an overlap is let be (city.js trims the shallow ones as drawn)
// Removed boxes get b.gone = true (the caller filters); trimmed ones change in place, their
// first size kept in b.was. Returns the counts before and after and what was done.
export function resolve(boxes, opts = {}) {
	const g = resolveSteps(boxes, opts);
	let r = g.next();
	while (!r.done) r = g.next();
	return r.value;
}
// the same, a generator that yields every few thousand buildings (so a big region can be
// settled across frames while it loads)
export function* resolveSteps(boxes, opts = {}) {
	const { roads = [], landmark = null, same = sameGroup, solid = () => true, keep = () => false, composite = false, margin = 0.3, pen: minPen = TOL } = opts;
	const t0 = Date.now();
	const before = opts.count === false ? null : countOverlaps(boxes, { roads, landmark, same, solid, min: Math.max(0.1, minPen) });
	let trims = 0, drops = 0;
	const why = { landmark: 0, road: 0, building: 0, inside: 0 };
	const list = boxes.filter((b) => !b.gone && solid(b));
	const area = (b) => b.w * b.d, groupArea = (b) => (b.grp ? b.grp.reduce((s, q) => s + (q.gone ? 0 : area(q)), 0) : area(b));
	const remember = (b) => { if (!b.was) b.was = [b.x, b.z, b.w, b.d]; };
	const drop = (b) => {
		// (a house's main block takes its wings and garage with it; a wing goes alone)
		const main = b.grp && b.grp.length > 1 && b.grp.every((q) => q === b || area(q) <= area(b));
		for (const q of main ? b.grp : [b]) if (!q.gone) { q.gone = true; drops++; }
	};
	// landmarks first: nothing stands on their ground
	if (landmark) for (const b of list) {
		if (b.gone || keep(b) || !landmark(b.x, b.z, Math.hypot(b.w, b.d) / 2) || !corners(b).some(([x, z]) => landmark(x, z, 0))) continue;
		const t = leastTrim(b, (q) => !corners(q).some(([x, z]) => landmark(x, z, 0)) && !landmark(q.x, q.z, 0));
		if (t) { remember(b); apply(b, t); trims++; } else { drop(b); why.landmark++; }
	}
	// then the streets
	yield;
	const rn = roadIndex(roads);
	let step = 0;
	for (const b of list) {
		if (++step % 4000 === 0) yield;
		if (b.gone || keep(b)) continue;
		for (let pass = 0; pass < 3; pass++) {
			const bad = segsHit(b, rn(b), margin * 0.5);
			if (!bad.length) break;
			const t = leastTrim(b, (q) => segsClear(q, bad, margin));
			// (a service way through a building is a passage: a drive-through, a garage's ramp, a
			// loading bay; it is trimmed clear where it can be, never the building taken down for it)
			if (!t && bad.every((r, n) => n % 2 === 1 || r.cls === 'service')) break;
			if (!t) { drop(b); why.road++; break; }
			remember(b); apply(b, t); trims++;
		}
	}
	// then each other, the bigger building first: the smaller gives way
	const ga = new Map();
	for (const b of list) if (!b.gone) ga.set(b, groupArea(b));
	const order = list.filter((b) => !b.gone).sort((p, q) => ga.get(q) - ga.get(p) || area(q) - area(p) || p.x - q.x || p.z - q.z);
	const at = new Map(order.map((b, k) => [b, k]));
	const near = grid(order);
	yield;
	for (let a = 0; a < order.length; a++) {
		if (a % 4000 === 3999) yield;
		const A = order[a];
		if (A.gone) continue;
		near(a, (k) => {
			const B = order[k];
			if (k < a || B.gone || A.gone || same(A, B)) return;
			const p = penetration(A, B);
			if (p <= minPen) return;
			// (B is the smaller, unless it may not move)
			let big = A, small = B;
			if (keep(B) && !keep(A)) { big = B; small = A; }
			else if (keep(B)) return;
			// (one mostly inside the other: a crown or a tower on its podium if it stands taller,
			// part of it; if not, it is hidden inside anyway and goes)
			if (inside(small, big) > 0.85) {
				if (!keep(big) && (composite || tallerOf(small, big))) return;
				drop(small); why.inside++; return;
			}
			let t = leastTrim(small, (q) => penetration(big, q) <= TOL);
			// (too deep to trim: a free-standing building may be nudged over a little instead, if
			// that leaves it clear of everything else and of the streets)
			if (!t && (!small.grp || small.grp.length < 2) && !keep(small)) {
				const ki = at.get(small), others = [];
				near(ki, (n) => { if (order[n] !== small && !order[n].gone) others.push(order[n]); });
				const rs = rn(small);
				t = leastShift(small, big, (q) => others.every((o) => same(o, q) || penetration(o, q) <= TOL) && segsClear(q, rs, margin));
			}
			if (t) { remember(small); apply(small, t); trims++; } else { drop(small); why.building++; }
		});
	}
	const after = opts.count === false ? null : countOverlaps(boxes, { roads, landmark, same, solid, min: Math.max(0.1, minPen) });
	return { before, after, trims, drops, why, ms: Date.now() - t0 };
}

// ---------- the procedural grid (city.js lists) ----------
// the lots that are buildings: city.js KIND row, house, tower, office, industry, retail,
// garage, shop, house with garage left/right, apartments (doorKind adds a fraction)
const BUILT = new Set([0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14]);
export const isBuilding = (o) => o.h > 2.6 && o.w > 1.5 && o.d > 1.5 && BUILT.has(Math.floor(o.kind)) && !o.gone;
// the freeways and the trail where the grid runs (bay/roads.js draws them there, 34 m and 4 m
// wide): their courses resampled as roads.js resamples them
export function routeRoads(routes, toWorld, covered = () => false, width = 34, cls = 'motorway') {
	const out = [];
	for (const ll of routes) {
		const P = ll.map(([a, b]) => toWorld(a, b)), pts = [];
		for (let i = 0; i < P.length - 1; i++) {
			const a = P[i], b = P[i + 1], p0 = P[Math.max(0, i - 1)], p3 = P[Math.min(P.length - 1, i + 2)], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 25));
			for (let k = 0; k < n; k++) {
				const t = k / n, t2 = t * t, t3 = t2 * t, f = (q0, q1, q2, q4) => 0.5 * (2 * q1 + (-q0 + q2) * t + (2 * q0 - 5 * q1 + 4 * q2 - q4) * t2 + (-q0 + 3 * q1 - 3 * q2 + q4) * t3);
				pts.push(f(p0.x, a.x, b.x, p3.x), f(p0.z, a.z, b.z, p3.z));
			}
		}
		// (only where the grid is: the mapped regions draw their own)
		let run = [];
		const flush = () => { if (run.length >= 4) out.push({ cls, w: width, pts: new Float32Array(run) }); run = []; };
		for (let i = 0; i < pts.length; i += 2) { if (covered(pts[i], pts[i + 1])) flush(); else run.push(pts[i], pts[i + 1]); }
		flush();
	}
	return out;
}
// Settles a city.js list in place: its gridded lots give way to the surveyed buildings (o.src,
// settled when their region loaded), to each other, to the freeways and the trail through the
// grid, and to the landmarks. Lots dropped are taken out of the list (lawns, fences and the
// rest of the yard stay: an empty lot). Returns what resolve() returns.
export function resolveLots(list, { roads = [], landmark = null, near = null, R = 1e9, count = true } = {}) {
	const solid = (o) => isBuilding(o) && (!near || (Math.abs(o.x - near[0]) < R && Math.abs(o.z - near[1]) < R));
	// (the surveyed were settled among themselves as their region loaded; the grid's lots carry no
	// group, and a crown on a tower stands inside its own box: composite)
	const same = (a, b) => !!(a.src && b.src);
	const res = resolve(list, { roads, landmark, solid, same, keep: (o) => !!o.src, composite: true, margin: 1, pen: 0.6, count });
	let n = 0;
	for (const o of list) if (!o.gone) list[n++] = o;
	list.length = n;
	return res;
}

// ---------- the surveyed regions and the grown towns ----------
// a region as realcity.js loads it (G.boxes, its roads in G.grid's cells): its buildings
// settled against each other, its streets and the landmarks, in place; the boxes left out are
// taken out of G.boxes and out of their houses' groups
export function settleRegion(G, landmark = null, count = false) {
	const roads = new Set();
	for (const c of G.grid.values()) for (const r of c.roads) roads.add(r);
	return settleBoxes(G.boxes, [...roads], landmark, count);
}
export function settleBoxes(boxes, roads, landmark = null, count = true) {
	return finish(boxes, resolve(boxes, { roads, landmark, count }));
}
// ...across frames: awaited by realcity.js while a region loads (a few milliseconds at a time)
export async function settleRegionSoon(G, landmark = null, signal = null) {
	const roads = new Set();
	for (const c of G.grid.values()) for (const r of c.roads) roads.add(r);
	const g = resolveSteps(G.boxes, { roads: [...roads], landmark, count: false });
	let r = g.next(), t = performance.now();
	while (!r.done) {
		if (performance.now() - t > 6) { await new Promise((ok) => setTimeout(ok, 0)); if (signal?.aborted) return null; t = performance.now(); }
		r = g.next();
	}
	return finish(G.boxes, r.value);
}
function finish(boxes, res) {
	let n = 0;
	for (const b of boxes) if (!b.gone) boxes[n++] = b;
	boxes.length = n;
	for (const b of boxes) if (b.grp && b.grp.some((q) => q.gone)) { const g = b.grp; let m = 0; for (const q of g) if (!q.gone) g[m++] = q; g.length = m; }
	stats.regions++; stats.trims += res.trims; stats.drops += res.drops;
	return res;
}
// what has been settled since the page loaded (Crysis.structures())
export const stats = { regions: 0, trims: 0, drops: 0, lots: 0 };
