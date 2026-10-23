// Where a suburb keeps its corner store and its gas station (Josh 2026-10-23: the neighbourhoods'
// houses are homes, with no signs on their lots, "aside from the occasional corner store, and gas
// station"). Each is its own building on its own lot, as they are on the real streets, not a house
// with a board in its front garden:
//   a gas station on a corner where two arterials meet (primary, secondary or tertiary roads), a
//     lot about 40 m along the bigger road and 38 m back from it, its food mart at the back
//     facing the pumps; one every kilometre or so at most, and not at every such corner
//   a corner store on a corner where a residential street meets another or a collector, a lot
//     about 24 m by 28 m, the store at the back behind its few parking spaces; rarer still
// A lot is laid in the corner's quarter clear of both streets and their sidewalks, never across
// another street, a park, a school or a shopping centre. The houses (and the odd shed or
// little shop) standing on it are taken off the map, the store is put there as one of the
// mapped shops (kind 6: city.js raises it, economy/ names and signs it, commercial.js builds
// its inside), and what else stood on the lot (the old drives and walks, a pool, the yard
// trees) is cleared through clear(x, z). bay/forecourts.js builds the rest: the canopy and the
// pumps, the forecourt, the price sign, the ice box and the propane cage, the parking.
//
// Pure (no three, no document), so node can plan a region from its baked file:
//   const S = planSites({ roads, boxes }, { landAt, bounds, avoid })
//     roads: the region's roads ({ cls, w, name, pts, walked, bridge, link })
//     boxes: its building boxes (realcity.js), changed in place: the lots' boxes out, the stores in
//     landAt(x, z) -> { lu } or null (the coarse map's land use); bounds [x0, z0, x1, z1]
//     avoid(x, z, r): true where a landmark or the like stands
//   S.sites   [{ kind: 'fuel' | 'corner', id, x, z, a, w, d, side, store, removed, cars, ground,
//              aprons, roads }]
//   S.trees   the lots' own trees, for the region's list
//   S.clear(x, z)  true on a lot (its old drives, walks, pools and trees are dropped)

import { isHome } from './houseplan.js';

const ART = new Set(['primary', 'secondary', 'tertiary']);
const RES = new Set(['residential', 'unclassified', 'living_street']);
// the streets a lot is kept off (a service road or a footway may cross one: a station's own)
const CROSS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'unknown']);
const RANK = { primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 1, living_street: 0 };
// the land a lot may take: none mapped, homes, shops and car parks, industry (not parks, golf,
// pitches, playgrounds, schools, farms or reserves)
const LOT_LU = { fuel: new Set([0, 1, 7, 8]), corner: new Set([1, 0]) };

// the two lots, in the lot's own frame (x along the bigger street, +z toward it: the front), all
// in metres: the lot, the store on it (centre, size, wall height; x toward the corner), the cells
// that are one kind of site at most, the share of good corners that get one (a station's by how
// many of its two streets are secondary roads or bigger), the most houses a lot may take (and for
// a corner store, how long its side street must be: a through street, not a court)
export const LOTS = {
	fuel: { w: 40, d: 38, store: { x: -2, z: -12.5, w: 15, d: 10, h: 4.6 }, cell: 900, share: [0.3, 0.55, 0.75], homes: 6 },
	corner: { w: 24, d: 28, store: { x: 2, z: -7, w: 16, d: 12, h: 4.4 }, cell: 1500, share: [0.18], homes: 2, street: 400 },
};

// a position (and a salt) to 0..1, the same each time a region is planned
export function siteHash(x, z, salt = 0) {
	const s = Math.sin(Math.round(x) * 12.9898 + Math.round(z) * 78.233 + salt * 37.719) * 43758.5453;
	return s - Math.floor(s);
}
// a lot's frame: world from local, and its corners
const frameOf = (L) => { const ca = Math.cos(L.a), sa = Math.sin(L.a); return { ca, sa, w: (lx, lz) => [L.x + ca * lx - sa * lz, L.z + sa * lx + ca * lz], l: (x, z) => { const dx = x - L.x, dz = z - L.z; return [ca * dx + sa * dz, -sa * dx + ca * dz]; } }; };
// do two rotated rectangles ({ x, z, w, d, a }) overlap, each grown by m
function overlaps(A, B, m = 0) {
	const ax = [Math.cos(A.a), Math.sin(A.a)], az = [-Math.sin(A.a), Math.cos(A.a)], bx = [Math.cos(B.a), Math.sin(B.a)], bz = [-Math.sin(B.a), Math.cos(B.a)];
	const dx = B.x - A.x, dz = B.z - A.z;
	for (const u of [ax, az, bx, bz]) {
		const ra = (A.w / 2 + m) * Math.abs(ax[0] * u[0] + ax[1] * u[1]) + (A.d / 2 + m) * Math.abs(az[0] * u[0] + az[1] * u[1]);
		const rb = (B.w / 2 + m) * Math.abs(bx[0] * u[0] + bx[1] * u[1]) + (B.d / 2 + m) * Math.abs(bz[0] * u[0] + bz[1] * u[1]);
		if (Math.abs(dx * u[0] + dz * u[1]) > ra + rb) return false;
	}
	return true;
}
// does a piece (in a box's frame) pass through the box (half sizes hw, hd)
function segBox(x0, z0, x1, z1, hw, hd) {
	let t0 = 0, t1 = 1;
	const dx = x1 - x0, dz = z1 - z0;
	for (const [pp, q] of [[-dx, x0 + hw], [dx, hw - x0], [-dz, z0 + hd], [dz, hd - z0]]) {
		if (Math.abs(pp) < 1e-9) { if (q < 0) return false; continue; }
		const t = q / pp;
		if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
	}
	return t0 <= t1;
}
// a road's way out of a point it passes through: the direction to a point 18 m along it
function armDir(p, i, step) {
	const x0 = p[i], z0 = p[i + 1];
	let j = i, d = 0, x = x0, z = z0;
	while (d < 18) {
		const k = j + step * 2;
		if (k < 0 || k + 1 >= p.length) break;
		d += Math.hypot(p[k] - x, p[k + 1] - z); x = p[k]; z = p[k + 1]; j = k;
	}
	const l = Math.hypot(x - x0, z - z0);
	return l > 4 ? [(x - x0) / l, (z - z0) / l] : null;
}

// a slice's worth of work at a time: yield* rest() gives the frame back once ms have been spent
// since the last (the planner's caller waits between slices, realcity.js)
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function pacer(ms) {
	let t = now();
	return function* rest() { if (now() - t < ms) return; yield; t = now(); };
}

// where two named streets meet: a point both pass through, with the arms leaving it (a generator:
// it yields now and then, so a big region is planned a few milliseconds at a time)
function* junctions(roads, rest) {
	// (each point once, as its road and place; a corner's only for the points two roads share)
	const first = new Map(), at = new Map(), multi = [], nameOf = (ri) => roads[ri].name || '#' + ri;
	// (and how long each street is, all its pieces: a court's a few houses long, a through street's not)
	const len = new Map();
	let n = 0;
	for (let ri = 0; ri < roads.length; ri++) {
		const r = roads[ri];
		if ((++n & 63) === 0) yield* rest();
		if (!(ART.has(r.cls) || RES.has(r.cls)) || r.bridge || r.link) continue;
		const p = r.pts, name = nameOf(ri);
		let l = len.get(name) || 0;
		for (let i = 0; i + 3 < p.length; i += 2) l += Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
		len.set(name, l);
		for (let i = 0; i + 1 < p.length; i += 2) {
			const k = Math.round(p[i] * 2) * 1048576 + Math.round(p[i + 1] * 2), f = first.get(k);
			if (f === undefined) { first.set(k, ri * 65536 + i / 2); continue; }
			let J = at.get(k);
			if (!J) {
				const r0 = Math.floor(f / 65536), n0 = nameOf(r0);
				at.set(k, J = { x: p[i], z: p[i + 1], refs: [roads[r0], (f % 65536) * 2, n0], names: new Set([n0]) });
			}
			J.refs.push(r, i, name);
			if (!J.names.has(name)) { J.names.add(name); if (J.names.size === 2) multi.push(J); }
		}
	}
	yield* rest();
	// (a divided road's two carriageways meet a cross street at two points close together: one
	// corner, the one with the most arms)
	const out = [], kept = new Map(), C = 40;
	const list = multi.filter((J) => J.refs.length >= 6);
	list.sort((a, b) => b.refs.length - a.refs.length || a.x - b.x || a.z - b.z);
	for (const J of list) {
		if ((++n & 63) === 0) yield* rest();
		const gi = Math.floor(J.x / C), gj = Math.floor(J.z / C);
		let dup = false;
		for (let i = gi - 1; i <= gi + 1 && !dup; i++) for (let j = gj - 1; j <= gj + 1 && !dup; j++) for (const K of kept.get(i * 65536 + j) || []) if (Math.hypot(K.x - J.x, K.z - J.z) < 28 && [...J.names].every((q) => K.names.has(q))) { dup = true; break; }
		if (dup) continue;
		const k = gi * 65536 + gj;
		(kept.get(k) || kept.set(k, []).get(k)).push(J);
		J.arms = [];
		for (let q = 0; q < J.refs.length; q += 3) {
			const r = J.refs[q], i = J.refs[q + 1], name = J.refs[q + 2];
			for (const step of [-1, 1]) { const dir = armDir(r.pts, i, step); if (dir) J.arms.push({ dir, r, name, cls: r.cls, len: len.get(name) || 0 }); }
		}
		if (J.arms.length >= 3) out.push(J);
	}
	return out;
}

export function planSites(R, opt) {
	const it = planSitesSteps(R, opt);
	for (let r = it.next(); ; r = it.next()) if (r.done) return r.value;
}
// the same a slice at a time: yields between slices (realcity.js gives the frame back then)
export function* planSitesSteps(R, { landAt = null, bounds = null, avoid = null, ms = 4 } = {}) {
	const roads = R.roads || [], boxes = R.boxes || [], rest = pacer(ms);
	// the roads and boxes by 50 m cell
	const C = 50, key = (i, j) => i * 73856093 ^ j * 19349663;
	const roadCells = new Map(), boxCells = new Map();
	let n = 0;
	for (const r of roads) {
		if ((++n & 127) === 0) yield* rest();
		if (!CROSS.has(r.cls)) continue;
		let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
		for (let i = 0; i + 1 < r.pts.length; i += 2) { x0 = Math.min(x0, r.pts[i]); x1 = Math.max(x1, r.pts[i]); z0 = Math.min(z0, r.pts[i + 1]); z1 = Math.max(z1, r.pts[i + 1]); }
		for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) { const k = key(i, j); (roadCells.get(k) || roadCells.set(k, []).get(k)).push(r); }
	}
	for (const b of boxes) {
		if ((++n & 1023) === 0) yield* rest();
		const k = key(Math.floor(b.x / C), Math.floor(b.z / C));
		(boxCells.get(k) || boxCells.set(k, []).get(k)).push(b);
	}
	const nearRoads = (x, z, rad) => { const s = new Set(); for (let i = Math.floor((x - rad) / C); i <= Math.floor((x + rad) / C); i++) for (let j = Math.floor((z - rad) / C); j <= Math.floor((z + rad) / C); j++) for (const r of roadCells.get(key(i, j)) || []) s.add(r); return s; };
	const nearBoxes = (x, z, rad) => { const out = []; for (let i = Math.floor((x - rad) / C); i <= Math.floor((x + rad) / C); i++) for (let j = Math.floor((z - rad) / C); j <= Math.floor((z + rad) / C); j++) for (const b of boxCells.get(key(i, j)) || []) out.push(b); return out; };
	const clearance = (r) => r.w / 2 + (r.walked ? 2.1 : 1.1);
	const inBounds = (x, z, m) => !bounds || (x > bounds[0] + m && x < bounds[2] - m && z > bounds[1] + m && z < bounds[3] - m);

	// a lot in one quarter of a corner: along arm A (the bigger street), on arm B's side of it
	function lotAt(J, A, B, kind) {
		const S = LOTS[kind], t = A.dir;
		let n = [-t[1], t[0]];
		if (n[0] * B.dir[0] + n[1] * B.dir[1] < 0) n = [-n[0], -n[1]];
		const cos = t[0] * B.dir[0] + t[1] * B.dir[1], sin = Math.sqrt(Math.max(0.05, 1 - cos * cos));
		// the front faces street A (-n): the box convention's yaw (local +z toward the street)
		const f = [-n[0], -n[1]], a = Math.atan2(-f[0], f[1]);
		// (local +x in the world: the corner, toward street B, is the side back along t)
		const lx = [Math.cos(a), Math.sin(a)], side = lx[0] * t[0] + lx[1] * t[1] < 0 ? 1 : -1;
		// (the streets' pieces within reach, once: [ax, az, bx, bz, clearance, 0 another, 1 A, 2 B])
		const segs = [], reach = Math.hypot(S.w, S.d) + 60;
		for (const r of nearRoads(J.x, J.z, reach)) {
			const name = r.name || '#' + roads.indexOf(r), who = name === A.name ? 1 : name === B.name ? 2 : 0, need = clearance(r), p = r.pts;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
				if (Math.min(ax, bx) > J.x + reach || Math.max(ax, bx) < J.x - reach || Math.min(az, bz) > J.z + reach || Math.max(az, bz) < J.z - reach) continue;
				segs.push(ax, az, bx, bz, need, who);
			}
		}
		const PTS = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [0, -1], [1, 0], [-1, 0], [0, 0], [-0.5, 1], [0.5, 1], [-0.5, -1], [0.5, -1], [1, 0.5], [1, -0.5], [-1, 0.5], [-1, -0.5]];
		let u = S.w / 2 + 3 + (B.r.w / 2) / sin, v = S.d / 2 + clearance(A.r);
		for (let it = 0; it < 60; it++) {
			const L = { x: J.x + t[0] * u + n[0] * v, z: J.z + t[1] * u + n[1] * v, w: S.w, d: S.d, a, side };
			const F = frameOf(L), hw = S.w / 2, hd = S.d / 2, rad = Math.hypot(hw, hd);
			let pushU = false, pushV = false, bad = false;
			for (let q = 0; q < segs.length && !bad; q += 6) {
				const ax = segs[q], az = segs[q + 1], bx = segs[q + 2], bz = segs[q + 3], need = segs[q + 4], who = segs[q + 5];
				if ((who === 1 && pushV) || (who === 2 && pushU)) continue;
				let hit = false;
				const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
				// (a piece further from the lot's middle than its corners are needs no closer look)
				const t0 = Math.max(0, Math.min(1, ((L.x - ax) * dx + (L.z - az) * dz) / l2));
				if (Math.hypot(L.x - ax - dx * t0, L.z - az - dz * t0) > rad + need) continue;
				for (const [px, pz] of PTS) {
					const [x, z] = F.w(px * hw, pz * hd), tt = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
					if (Math.hypot(x - ax - dx * tt, z - az - dz * tt) < need) { hit = true; break; }
				}
				// (a piece through the lot's middle, between the points)
				if (!hit) { const [lx0, lz0] = F.l(ax, az), [lx1, lz1] = F.l(bx, bz); hit = segBox(lx0, lz0, lx1, lz1, hw, hd); }
				if (!hit) continue;
				if (who === 1) pushV = true; else if (who === 2) pushU = true; else bad = true;
			}
			if (bad) return null;
			if (!pushU && !pushV) return L;
			if (pushU) u += 1;
			if (pushV) v += 1;
			if (u > S.w / 2 + 40 || v > S.d / 2 + 30) return null;
		}
		return null;
	}

	// a lot is good when it is dry, built land in town, clear of anything the map keeps, and takes
	// only a few houses (and the odd shed or kiosk): what it takes is listed
	function check(L, kind) {
		const S = LOTS[kind];
		if (!inBounds(L.x, L.z, Math.hypot(S.w, S.d) / 2 + 25)) return null;
		if (avoid?.(L.x, L.z, Math.hypot(S.w, S.d) / 2 + 4)) return null;
		const F = frameOf(L);
		if (landAt) {
			let ok = 0, n = 0;
			for (const [px, pz] of [[0, 0], [-0.35, -0.35], [0.35, -0.35], [0.35, 0.35], [-0.35, 0.35]]) {
				const [x, z] = F.w(px * S.w, pz * S.d), q = landAt(x, z);
				n++;
				if (q && LOT_LU[kind].has(q.lu)) ok++;
			}
			if (ok < n - 1) return null;
		}
		const take = [], grps = new Set();
		let homes = 0, around = 0, flat = 0;
		for (const b of nearBoxes(L.x, L.z, 90)) {
			if (Math.hypot(b.x - L.x, b.z - L.z) < 90 && isHome(b)) { around++; if (b.roofH < 0.5 && b.kind <= 2) flat++; }
			if (!overlaps(L, b, 0.6)) continue;
			// (a grown town's old centre is its shops already: economy/)
			if ((b.core ?? 1) < 0.4) return null;
			// (a terrace's house: its corner shop is the corner building's own ground floor, economy/)
			if (isHome(b) && b.roofH < 0.5 && b.kind <= 2) return null;
			if (isHome(b)) { const g = b.grp || [b]; if (!grps.has(g)) { grps.add(g); homes++; for (const q of g) take.push(q); } continue; }
			// (a shed, a carport, a little kiosk or shop the station replaces; nothing bigger)
			if (b.kind === 10 || ((b.kind === 5 || b.kind === 6) && b.w * b.d < 360)) { take.push(b); continue; }
			return null;
		}
		if (homes > S.homes || flat > around * 0.4) return null;
		// (a corner store is a neighbourhood's: houses round it; a station stands on built land)
		if (kind === 'corner' && (around < 10 || homes < 1)) return null;
		if (kind === 'fuel' && around + take.length < 3) return null;
		// a house of the lot reaching well past it would leave half a house's ground bare: not here
		for (const b of take) { const [lx, lz] = F.l(b.x, b.z); if (Math.abs(lx) > S.w / 2 + 6 || Math.abs(lz) > S.d / 2 + 6) return null; }
		return { take, homes };
	}

	// every corner, the quarters each kind could take there, scored
	const cands = { fuel: [], corner: [] };
	const JS = yield* junctions(roads, rest);
	for (const J of JS) {
		const arms = J.arms.map((m) => ({ ...m, ang: Math.atan2(m.dir[1], m.dir[0]) })).sort((p, q) => p.ang - q.ang);
		const art = arms.filter((m) => ART.has(m.cls)), res = arms.filter((m) => RES.has(m.cls) && m.len >= LOTS.corner.street);
		const names = (list) => new Set(list.map((m) => m.name)).size;
		const big = arms.some((m) => m.cls === 'primary');
		// (a station where two arterials meet; a corner store where a neighbourhood's street meets
		// its collector, on the way in and out: not at a court's end, not on a highway)
		const kinds = [];
		if (names(art) >= 2) kinds.push('fuel');
		if (!big && res.length && art.length) kinds.push('corner');
		if (!kinds.length) continue;
		for (const kind of kinds) {
			const h = siteHash(J.x, J.z, kind === 'fuel' ? 3 : 7), SH = LOTS[kind].share;
			if (h >= SH[Math.min(SH.length - 1, names(art.filter((m) => (RANK[m.cls] ?? 0) >= 4)))]) continue;
			let best = null;
			for (let i = 0; i < arms.length; i++) {
				yield* rest();
				const P = arms[i], Q = arms[(i + 1) % arms.length];
				if (P.name === Q.name) continue;
				if (kind === 'fuel' && !(ART.has(P.cls) && ART.has(Q.cls))) continue;
				if (kind === 'corner' && !((res.includes(P) && ART.has(Q.cls)) || (res.includes(Q) && ART.has(P.cls)))) continue;
				let gap = Q.ang - P.ang;
				if (gap <= 0) gap += Math.PI * 2;
				if (gap < 1.0 || gap > 2.15) continue;
				// (the lot along the bigger street)
				const [A, B] = (RANK[Q.cls] ?? 0) > (RANK[P.cls] ?? 0) ? [Q, P] : [P, Q];
				const L = lotAt(J, A, B, kind);
				if (!L) continue;
				const got = check(L, kind);
				if (!got) continue;
				// (fewest houses taken; then the quarter the hash likes)
				const score = got.homes + siteHash(L.x, L.z, 11) * 0.5;
				if (!best || score < best.score) best = { kind, J, L, got, score, h, A, B };
			}
			if (best) cands[kind].push(best);
		}
	}
	// one of each kind to a cell at most (the corner the hash likes), the stations first, and no lot
	// on another or a corner store near a station
	const sites = [], taken = new Set(), trees = [];
	for (const kind of ['fuel', 'corner']) {
		const S = LOTS[kind], cell = new Map();
		for (const c of cands[kind]) {
			const k = Math.floor(c.L.x / S.cell) + ',' + Math.floor(c.L.z / S.cell);
			const q = cell.get(k);
			if (!q || c.h < q.h) cell.set(k, c);
		}
		for (const c of [...cell.values()].sort((p, q) => p.h - q.h)) {
			yield* rest();
			const L = c.L;
			if (sites.some((s) => overlaps(s, L, 4) || (kind === 'corner' && Math.hypot(s.x - L.x, s.z - L.z) < (s.kind === 'fuel' ? 400 : S.cell * 0.6)))) continue;
			if (c.got.take.some((b) => taken.has(b))) continue;
			const F = frameOf(L), st = S.store, [sx, sz] = F.w(st.x * L.side, st.z);
			const store = { x: sx, z: sz, w: st.w, d: st.d, a: L.a, wallH: st.h, roofH: 0, kind: 6, hip: 0, door: 0.5, store: kind, econFace: 0 };
			store.grp = [store]; store.grp.biz = true;
			const id = kind + ':' + Math.round(L.x) + ':' + Math.round(L.z);
			const site = { kind, id, x: L.x, z: L.z, a: L.a, w: L.w, d: L.d, side: L.side, store, removed: c.got.take.length, homes: c.got.homes, roads: { a: c.A.name, b: c.B.name, aCls: c.A.cls, bCls: c.B.cls, aw: c.A.r.w, bw: c.B.r.w } };
			store.site = site;
			// cars: at the pumps and in the spaces before the store, now and then (city.js parks them)
			site.cars = carsFor(site, F);
			// its paving and its drives out to the streets
			site.ground = groundOf(site, F);
			site.aprons = apronsOf(site, F, [...nearRoads(L.x, L.z, Math.hypot(L.w, L.d) / 2 + 12)].filter((r) => r.drive !== false && r.cls !== 'service'));
			// (no way in from either street: not here)
			if (!site.aprons.length) continue;
			for (const b of c.got.take) taken.add(b);
			// its own trees: along the back and the far side (the planting strip)
			for (const [px, pz] of kind === 'fuel' ? [[-0.44, -0.47], [0.44, -0.47], [-0.47 * L.side, 0.12]] : [[-0.43, -0.46], [-0.46 * L.side, 0.43]]) {
				if (siteHash(L.x + px * 100, L.z + pz * 100, 13) < 0.2) continue;
				const [x, z] = F.w(px * L.w, pz * L.d);
				trees.push({ x, z, h: 6 + siteHash(x, z, 17) * 4, cone: 0, lot: id });
			}
			sites.push(site);
		}
	}
	// the lots' boxes off the map; the stores on it
	if (taken.size) {
		let n = 0;
		for (let i = 0; i < boxes.length; i++) {
			if ((i & 2047) === 2047) yield* rest();
			if (!taken.has(boxes[i])) boxes[n++] = boxes[i];
		}
		boxes.length = n;
	}
	for (const s of sites) boxes.push(s.store);
	const clear = (x, z, m = 0.3) => {
		for (const s of sites) {
			if (Math.abs(x - s.x) > s.w + s.d || Math.abs(z - s.z) > s.w + s.d) continue;
			const F = frameOf(s), [lx, lz] = F.l(x, z);
			if (Math.abs(lx) < s.w / 2 + m && Math.abs(lz) < s.d / 2 + m) return true;
		}
		return false;
	};
	return { sites, trees, clear };
}

// the cars a site has standing on it: at the pumps (fuel) and in the spaces before the store, as
// [x, z, the way it points as a box's yaw] (city.js lists them with the drives' cars)
export function carsFor(site, F = frameOf(site)) {
	const out = [], h = (k) => siteHash(site.x + k * 7.3, site.z - k * 3.1, 23);
	const put = (lx, lz, yaw) => { const [x, z] = F.w(lx, lz); out.push([x, z, site.a + yaw]); };
	if (site.kind === 'fuel') {
		// three islands at x -8, 0, 8 (z 5.8 to 12.2): a car each side of each now and then, nose
		// toward the street or away
		for (const ix of PUMP_X) for (const s of [-1, 1]) if (h(ix * 3 + s) < 0.3) put(ix + s * 2.15, 9 + (h(ix + s * 5) - 0.5) * 0.8, h(ix - s) < 0.5 ? 0 : Math.PI);
		for (let k = 0; k < 5; k++) if (h(40 + k) < 0.28) put((STALL_X0 + k * 2.8) * site.side + LOTS.fuel.store.x * site.side, -3.1, Math.PI);
	} else {
		for (let k = 0; k < 5; k++) if (h(60 + k) < 0.35) put((STALL_X0 + k * 2.8 + LOTS.corner.store.x) * site.side, 3.6, Math.PI);
	}
	return out;
}

// A lot's ground, painted by the road map (realcity.js) as the streets are: asphalt, concrete and
// the white lines, as rectangles in the lot's frame ([what, x0, z0, x1, z1]: 0 asphalt, 1
// concrete, 2 a white line; x toward the corner when side is 1). The planting strips along the
// lot's edges are left as they were (the ground's own lawn and beds), but where the drives cut
// through them. No two of asphalt and concrete overlap (the ground shows asphalt where both are).
const LINE = 0.06;
const stallLines = (x0, n, z0, z1) => Array.from({ length: n + 1 }, (_, k) => [2, x0 + k * 2.8 - LINE, z0, x0 + k * 2.8 + LINE, z1]);
export const GROUND = {
	fuel: [
		// the pump slab under the canopy, the walk along the food mart's front
		[1, -15, 3, 15, 15], [1, -10.5, -7.5, 6.5, -5.6],
		// asphalt round them and the mart: the front aisle, the spaces and the aisle behind the
		// pumps, either side of the slab, either side of the mart
		[0, -18.6, 15, 18.6, 17.6], [0, -18.6, -5.6, 18.6, 3], [0, -18.6, 3, -15, 15], [0, 15, 3, 18.6, 15],
		[0, -18.6, -17.8, -10.5, -5.6], [0, 6.5, -17.8, 18.6, -5.6], [0, -10.5, -17.8, -9.5, -7.5], [0, 5.5, -17.8, 6.5, -7.5],
		// the drives in: two off the main street, one off the side street
		[0, -16.5, 17.6, -9.5, 19], [0, 9.5, 17.6, 16.5, 19], [0, 18.6, -4, 20, 4],
		// the mart's five spaces
		...stallLines(-9, 5, -5.4, -0.6),
	],
	corner: [
		[1, -7, -1, 11, 0.9],
		[0, -10.6, 0.9, 10.6, 12.6], [0, -10.6, -13, -7, 0.9], [0, -7, -13, -6, -1],
		[0, -10, 12.6, -3.5, 14], [0, 10.6, 3, 12, 9.5],
		...stallLines(-5, 5, 1.1, 6.1),
	],
};
// the drives from a lot's cuts out across the sidewalk to the street, as the mapped drives are
// ([x along the lot's edge or z, width]): to the main street (its front), to the side street
const CUTS = { fuel: { a: [[-13, 7], [13, 7]], b: [[0, 8]] }, corner: { a: [[-6.75, 6.5]], b: [[6.25, 6.5]] } };
// how near a road's centre line comes to a point
function lineDist(r, x, z) {
	const p = r.pts;
	let best = 1e9;
	for (let i = 0; i + 3 < p.length; i += 2) {
		const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
		best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	return best;
}
// a site's ground in the world: [ax, az, bx, bz, half width, what] (a band along a to b)
function groundOf(site, F) {
	const out = [];
	for (const [k, x0, z0, x1, z1] of GROUND[site.kind]) {
		const zm = (z0 + z1) / 2, [ax, az] = F.w(x0 * site.side, zm), [bx, bz] = F.w(x1 * site.side, zm);
		out.push([ax, az, bx, bz, (z1 - z0) / 2, k]);
	}
	return out;
}
// ...and its drives out to the streets, as paths (the road map paints them; the kerb cars and the
// sight lines keep clear of them, streetlife.js and clearance.js): straight out from each cut
// across the sidewalk to the carriageway's edge (roads: the streets near the lot)
function apronsOf(site, F, roads) {
	const out = [], C = CUTS[site.kind], hw = site.w / 2, hd = site.d / 2;
	// (how far out along (nx, nz) the nearest carriageway begins: none within 9 m, no drive)
	const outTo = (x, z, nx, nz) => { for (let t = 0; t < 9; t += 0.25) for (const r of roads) if (lineDist(r, x + nx * t, z + nz * t) < r.w / 2) return t; return -1; };
	const drive = (l0, l1) => {
		const [x, z] = F.w(l0[0], l0[1]), [ex, ez] = F.w(l1[0], l1[1]), L = Math.hypot(ex - x, ez - z), far = outTo(x, z, (ex - x) / L, (ez - z) / L);
		if (far > 0) { const [ax, az] = F.w(l0[0] - (l1[0] - l0[0]) / L, l0[1] - (l1[1] - l0[1]) / L), k = (far + 0.4) / L; out.push({ ax, az, bx: x + (ex - x) * k, bz: z + (ez - z) * k, w: 0, made: true, lot: site.id }); }
	};
	for (const [lx, w] of C.a) { drive([lx * site.side, hd], [lx * site.side, hd + 1]); if (out.length) out[out.length - 1].w ||= w; }
	for (const [lz, w] of C.b) { drive([hw * site.side, lz], [(hw + 1) * site.side, lz]); if (out.length) out[out.length - 1].w ||= w; }
	return out.filter((q) => q.w);
}
// the pump islands' x in the station's frame, and its first parking space's (from the store's middle)
export const PUMP_X = [-8, 0, 8];
export const STALL_X0 = -5.6;
