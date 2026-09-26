// Crysis civilization engine, part two: grow a town on any ground from what the real
// Bay Area taught us (civstats.json, learned by tools/learn-civ.py).
//
// generateTown({ seed, cx, cz, radius, heightAt, stats, style, name }) returns a region in
// the same shape as a baked real one (see bay/realcity.js): roads with their points, class,
// width, name and cul-de-sac ends; building boxes; driveways and walks; pools; trees; and
// an RGBA land-use map (R roads, G land use x16, B roofs). Registered with the real city,
// the buildings rise, the streets are painted, furnished, driven and walked like the real ones.
//
// How a town grows, in the order a real one is laid out:
//   1. the arterials: a grid at the learned spacing (about 1.75 km), turned to the town's
//      angle, each line meandering and bending round steep ground between the crossings;
//   2. in each superblock between them a collector crossing it, a school or park beside
//      it now and then, and a shopping centre on the corners of the busier crossings;
//   3. residential streets grown from the collectors (and a few from the arterials): each
//      walks forward with a slowly wandering curvature, steering off steep ground, and
//      ends by joining another street, or stops short as a cul-de-sac (a court) when it
//      nears one or runs out of room; side streets branch off as it goes;
//   4. lots down both sides of every street at the learned frontage and setback, a
//      house on each facing its street, its garage, driveway and front walk, a pool out
//      back now and then, yard and street trees;
//   5. the land-use map painted from all of that.
// Everything is drawn from one seeded random stream, so a town is the same every visit.

import STATS from './civstats.json' with { type: 'json' };

// ---------- small tools ----------
export function rng(seed) {
	let s = (seed >>> 0) || 1;
	return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// a draw from a learned percentile table (10th, 25th, 50th, 75th, 90th): the inverse of the
// piecewise-linear distribution through them, its tails stretched a little past the ends
const QS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
export function fromPct(P, u) {
	const lo = Math.max(0, P[0] - (P[1] - P[0]) * 0.6), hi = P[4] + (P[4] - P[3]) * 0.6, V = [lo, ...P, hi];
	for (let i = 1; i < QS.length; i++) if (u <= QS[i]) return V[i - 1] + (V[i] - V[i - 1]) * (u - QS[i - 1]) / (QS[i] - QS[i - 1]);
	return hi;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickW = (tbl, u) => { let acc = 0; const tot = Object.values(tbl).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(tbl)) { acc += v / tot; if (u <= acc) return k; } return Object.keys(tbl)[0]; };

// land-use classes of the real map (see bake-realcity.py)
export const LU = { wild: 0, residential: 1, park: 2, golf: 3, pitch: 4, playground: 5, school: 6, commercial: 7, industrial: 8, plaza: 13 };       // (9-12 are the real maps' bunker, water hazard, farm, reserve)
// building kinds of the real boxes: 0 house, 1/2 house with its garage left/right of the
// front, 3 garage wing, 4 wing, 5 office, 6 retail, 7 school, 8 apartments, 9 industrial, 10 shed,
// 11 downtown tower (generated towns only)
const K = { house: 0, garageL: 1, garageR: 2, garage: 3, wing: 4, office: 5, retail: 6, school: 7, apartments: 8, shed: 10, tower: 11 };

// ---------- street names: learned words and suffixes ----------
const TAILS = ['wood', 'brook', 'ridge', 'field', 'view', 'crest', 'dale', 'haven', 'glen', 'stone', 'hurst', 'mont'];
function namer(r, S) {
	const used = new Set(), W = S.nameWords, word = () => W[Math.floor(r() * W.length)];
	return (kind) => {
		for (let k = 0; k < 12; k++) {
			const u = r(), suf = pickW(S.suffix[kind] || S.suffix.street, r());
			let a = word();
			if (u < 0.3 && !/[A-Z].*[A-Z]/.test(a) && a.length < 8) a += TAILS[Math.floor(r() * TAILS.length)];
			else if (u < 0.55) { const b = word(); if (b !== a) a += ' ' + b; }
			const n = a + ' ' + suf;
			if (!used.has(n)) { used.add(n); return n; }
		}
		return word() + ' ' + (used.size + 1) + ' ' + pickW(S.suffix.street, r());
	};
}

// ---------- the street graph: nodes, edges (polylines), a segment index ----------
function createGraph() {
	const N = [], E = [], CELL = 32, idx = new Map();
	const key = (i, j) => i * 73856093 ^ j * 19349663;
	const cellsOf = (ax, az, bx, bz, f) => { for (let i = Math.floor(Math.min(ax, bx) / CELL); i <= Math.floor(Math.max(ax, bx) / CELL); i++) for (let j = Math.floor(Math.min(az, bz) / CELL); j <= Math.floor(Math.max(az, bz) / CELL); j++) f(key(i, j)); };
	function node(x, z) { return N.push({ x, z }) - 1; }
	function edge(a, b, p, props) {
		const e = { a, b, p, alive: true, ...props }, id = E.push(e) - 1;
		G0.onEdge?.(p);
		for (let i = 0; i + 3 < p.length; i += 2) cellsOf(p[i], p[i + 1], p[i + 2], p[i + 3], (k) => { let c = idx.get(k); if (!c) idx.set(k, c = []); c.push(id, i); });
		return id;
	}
	// the nearest point on a live edge within rad of (x, z); skip(id, e) leaves edges out
	function nearest(x, z, rad, skip) {
		// (a segment listed in several cells is just measured again: cheaper than remembering)
		let best = null, bd = rad;
		for (let i = Math.floor((x - rad) / CELL); i <= Math.floor((x + rad) / CELL); i++) for (let j = Math.floor((z - rad) / CELL); j <= Math.floor((z + rad) / CELL); j++) {
			const c = idx.get(key(i, j));
			if (!c) continue;
			for (let k = 0; k < c.length; k += 2) {
				const id = c[k], s = c[k + 1], e = E[id];
				if (!e.alive || (skip && skip(id, e))) continue;
				const p = e.p, ax = p[s], az = p[s + 1], dx = p[s + 2] - ax, dz = p[s + 3] - az, l2 = dx * dx + dz * dz || 1;
				const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(px - x, pz - z);
				if (d < bd) { bd = d; best = { id, s, t, x: px, z: pz, d }; }
			}
		}
		return best;
	}
	// the first crossing of segment a-b with a live edge: its parameter along a-b
	function crossing(ax, az, bx, bz, skip) {
		let best = null;
		cellsOf(ax, az, bx, bz, (kk) => {
			const c = idx.get(kk);
			if (!c) return;
			for (let k = 0; k < c.length; k += 2) {
				const id = c[k], s = c[k + 1], e = E[id];
				if (!e.alive || (skip && skip(id, e))) continue;
				const p = e.p, cx = p[s], cz = p[s + 1], ex = p[s + 2] - cx, ez = p[s + 3] - cz, dx = bx - ax, dz = bz - az;
				const den = dx * ez - dz * ex;
				if (Math.abs(den) < 1e-9) continue;
				const t = ((cx - ax) * ez - (cz - az) * ex) / den, u = ((cx - ax) * dz - (cz - az) * dx) / den;
				if (t > 1e-6 && t <= 1 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { id, s, t: u, at: t, x: ax + dx * t, z: az + dz * t };
			}
		});
		return best;
	}
	// cut a live edge at a point on it (a hit from nearest or crossing): the node there
	function split(hit) {
		const e = E[hit.id], p = e.p, x = hit.x, z = hit.z;
		if (Math.hypot(N[e.a].x - x, N[e.a].z - z) < 3) return e.a;
		if (Math.hypot(N[e.b].x - x, N[e.b].z - z) < 3) return e.b;
		const n = node(x, z);
		const p1 = p.slice(0, hit.s + 2), p2 = p.slice(hit.s + 2);
		if (Math.hypot(p1[p1.length - 2] - x, p1[p1.length - 1] - z) < 0.5) p1.length -= 2;
		if (Math.hypot(p2[0] - x, p2[1] - z) < 0.5) p2.splice(0, 2);
		p1.push(x, z); p2.unshift(x, z);
		e.alive = false;
		const props = { cls: e.cls, name: e.name, run: e.run, hw: e.hw };
		edge(e.a, n, p1, props); edge(n, e.b, p2, props);
		return n;
	}
	// a node for a point: an existing node or edge within snap, or a new node
	function attach(x, z, snap = 2.5) {
		const h = nearest(x, z, snap);
		return h ? split(h) : node(x, z);
	}
	// add a polyline, cutting it (and what it crosses) at every crossing
	function addNoded(p, props) {
		const nodes = [attach(p[0], p[1])], parts = [[p[0], p[1]]];
		const fresh = new Set();   // our own pieces, not to be crossed
		const skip = (id) => fresh.has(id);
		for (let i = 0; i + 3 < p.length; i += 2) {
			let ax = p[i], az = p[i + 1];
			const bx = p[i + 2], bz = p[i + 3];
			for (let guard = 0; guard < 8; guard++) {
				const c = crossing(ax, az, bx, bz, skip);
				if (!c || Math.hypot(c.x - ax, c.z - az) < 0.3) break;
				const n = split(c);
				parts[parts.length - 1].push(N[n].x, N[n].z);
				nodes.push(n); parts.push([N[n].x, N[n].z]);
				ax = N[n].x; az = N[n].z;
			}
			parts[parts.length - 1].push(bx, bz);
		}
		// the far end
		const last = parts[parts.length - 1];
		const n1 = attach(last[last.length - 2], last[last.length - 1]);
		last[last.length - 2] = N[n1].x; last[last.length - 1] = N[n1].z;
		nodes.push(n1);
		const ids = [];
		for (let k = 0; k < parts.length; k++) {
			const q = parts[k];
			if (q.length < 4 || nodes[k] === nodes[k + 1]) continue;
			const id = edge(nodes[k], nodes[k + 1], q, props);
			fresh.add(id); ids.push(id);
		}
		return ids;
	}
	// every live segment near a point, for many tests against the same few: [ax, az, bx, bz, edge]
	const segBuf = [];
	function segs(x, z, rad) {
		const out = segBuf;
		out.length = 0;
		for (let i = Math.floor((x - rad) / CELL); i <= Math.floor((x + rad) / CELL); i++) for (let j = Math.floor((z - rad) / CELL); j <= Math.floor((z + rad) / CELL); j++) {
			const c = idx.get(key(i, j));
			if (c) for (let k = 0; k < c.length; k += 2) { const e = E[c[k]], s = c[k + 1]; if (e.alive) out.push(e.p[s], e.p[s + 1], e.p[s + 2], e.p[s + 3], e); }
		}
		return out;
	}
	const G0 = { N, E, node, edge, nearest, crossing, split, attach, addNoded, segs, onEdge: null };
	return G0;
}
const lengthOf = (p) => { let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return L; };
// position and unit tangent at distance s along a polyline
function along(p, s) {
	let acc = 0;
	for (let i = 2; i < p.length; i += 2) {
		const ax = p[i - 2], az = p[i - 1], dx = p[i] - ax, dz = p[i + 1] - az, L = Math.hypot(dx, dz);
		if (acc + L >= s || i === p.length - 2) { const t = L ? clamp((s - acc) / L, 0, 1) : 0; return [ax + dx * t, az + dz * t, dx / (L || 1), dz / (L || 1)]; }
		acc += L;
	}
	return [p[0], p[1], 1, 0];
}

// ---------- the town ----------
export function generateTown(opts) {
	const it = generateTownSteps(opts);
	let r = it.next();
	while (!r.done) r = it.next();
	return r.value;
}

// the same, one piece at a time: yields between the pieces (a superblock, a pass), so a
// caller can spread the work over frames. The generator's return value is the region.
export function* generateTownSteps({ seed = 1, cx = 0, cz = 0, radius = 1500, heightAt, stats = STATS, style = 'suburb', name = 'Town', ang = 0 }) {
	const S = stats, r = rng(seed), T0 = Date.now();
	const older = style === 'older';
	const W = S.widths;
	const ca = Math.cos(ang), sa = Math.sin(ang);
	const toW = (u, v) => [cx + u * ca - v * sa, cz + u * sa + v * ca];
	const toL = (x, z) => [(x - cx) * ca + (z - cz) * sa, -(x - cx) * sa + (z - cz) * ca];
	const Rdev = radius * 1.15, Rbox = radius * 1.3 + 150;
	// how built up the town is at a distance: the same falloff as the town map's
	const dens = (x, z) => { const d = Math.hypot(x - cx, z - cz) / radius; return Math.exp(-d * d * d * 1.1); };
	const G = createGraph();
	// where the streets already reach: 24 m cells within about 66 m of one, for finding the gaps
	const CV = 24, CN = Math.ceil(2 * Rbox / CV) + 1, cover = new Uint8Array(CN * CN);
	G.onEdge = (p) => {
		for (let i = 0; i < p.length; i += 2) {
			const ci = Math.floor((p[i] - cx + Rbox) / CV), cj = Math.floor((p[i + 1] - cz + Rbox) / CV);
			for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) if (di * di + dj * dj <= 8) { const a = ci + di, b = cj + dj; if (a >= 0 && b >= 0 && a < CN && b < CN) cover[b * CN + a] = 1; }
		}
	};
	const covered = (x, z) => { const a = Math.floor((x - cx + Rbox) / CV), b = Math.floor((z - cz + Rbox) / CV); return a < 0 || b < 0 || a >= CN || b >= CN || cover[b * CN + a] === 1; };
	const nameOf = namer(r, S);

	// heights on a lazy 16 m grid (the terrain function is too slow to call per step)
	const HC = 16, HB = 32, hch = new Map();
	function H(x, z) {
		const fx = x / HC, fz = z / HC, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
		const g = (ii, jj) => {
			const ci = Math.floor(ii / HB), cj = Math.floor(jj / HB), k = ci * 100003 + cj;
			let c = hch.get(k);
			if (!c) { c = new Float32Array(HB * HB).fill(NaN); hch.set(k, c); }
			const q = (jj - cj * HB) * HB + (ii - ci * HB);
			let h = c[q];
			if (h !== h) h = c[q] = heightAt(ii * HC, jj * HC);
			return h;
		};
		return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
	}
	const slope = (x, z) => Math.hypot(H(x + HC, z) - H(x - HC, z), H(x, z + HC) - H(x, z - HC)) / (2 * HC);
	const dry = (x, z) => H(x, z) > 1.5;
	const MAXG = older ? 0.14 : 0.18;      // streets steeper than this are not built (the real ones: 90% under 0.21)

	// reserved sites (schools, parks, shopping): oriented rectangles streets and lots keep out of
	const sites = [];
	const inSite = (x, z, pad = 0) => { for (const s of sites) { const dx = x - s.x, dz = z - s.z, a = dx * s.ux + dz * s.uz, b = -dx * s.uz + dz * s.ux; if (Math.abs(a) < s.hw + pad && Math.abs(b) < s.hd + pad) return s; } return null; };

	// ---------- 1. the arterials ----------
	const SP = older ? clamp(radius * 0.7, 600, 1200) : clamp(radius * 0.8, 700, S.arterialSpacing);
	const nL = Math.floor(Rdev / SP);
	const artName = new Map();
	const DTR = W.primary / 2 + 5 + 2 * clamp(radius * 0.055, 110, 200) + 20;     // the downtown's reach from the crossing (below)
	// a line of the grid, meandering between crossings (it passes the lattice points exactly,
	// so the crossings stay where the superblocks expect them) and easing round steep ground
	function traceLine(axis, k, v0, v1, cls) {
		const pts = [], step = 30, amp = SP * (older ? 0.03 : 0.07);
		const ph = r() * 6.28, fr = 1 + Math.floor(r() * 2);
		let drift = 0;
		for (let v = v0; v <= v1 + 0.01; v += step) {
			// (the main roads run straight through a big town's downtown, its grid square to them)
			const calm = k === 0 && radius > 2000 ? clamp((Math.abs(v) - DTR) / 300, 0, 1) : 1;
			const env = Math.sin(Math.PI * ((((v / SP) % 1) + 1) % 1)) * calm * calm * (3 - 2 * calm);
			// look sideways for gentler ground, within the envelope
			const base = k * SP + env * amp * Math.sin(v / SP * Math.PI * fr + ph);
			let best = drift, bs = 1e9;
			for (const dd of [-5, 0, 5]) {
				const o = clamp(drift + dd, -env * amp, env * amp), [x, z] = axis ? toW(v, base + o) : toW(base + o, v);
				const s2 = slope(x, z) + Math.abs(o) / 4000 + Math.abs(dd) / 3000;
				if (s2 < bs) { bs = s2; best = o; }
			}
			drift = clamp(best, -env * amp, env * amp);
			const [x, z] = axis ? toW(v, base + drift) : toW(base + drift, v);
			pts.push(x, z);
		}
		// broken where the ground will not take a road: water, cliffs
		const pieces = [];
		let cur = [];
		for (let i = 0; i < pts.length; i += 2) {
			const x = pts[i], z = pts[i + 1], ok = dry(x, z) && slope(x, z) < 0.3;
			if (ok) cur.push(x, z);
			else { if (cur.length >= 16) pieces.push(cur); cur = []; }
		}
		if (cur.length >= 16) pieces.push(cur);
		const nm = artName.get(axis + ':' + k) || nameOf(cls === 'tertiary' ? 'col' : 'art');
		artName.set(axis + ':' + k, nm);
		for (const q of pieces) G.addNoded(q, { cls, name: nm });
	}
	for (const axis of [0, 1]) for (let k = -nL; k <= nL; k++) {
		const u = k * SP, half = Math.sqrt(Math.max(0, Rdev * Rdev - u * u));
		let e = Math.round(half / SP) * SP;
		const main = k === 0;
		if (main) e = Math.floor(Rbox / SP) * SP + (Rbox % SP > 60 ? Rbox % SP - 40 : 0);   // the through roads run on out of town
		if (e < SP * 0.99 && !main) continue;
		traceLine(axis, k, -e, e, main ? 'primary' : 'secondary');
	}
	yield 'arterials';

	// ---------- 2. superblocks: collectors, shopping, schools, parks ----------
	const blocks = [];
	for (let i = -nL - 1; i <= nL; i++) for (let j = -nL - 1; j <= nL; j++) {
		const [x, z] = toW((i + 0.5) * SP, (j + 0.5) * SP), d = dens(x, z);
		if (d < 0.2) continue;
		blocks.push({ i, j, x, z, d, u0: i * SP, v0: j * SP });
	}
	// the expected houses, for how many schools and parks the town needs
	const houseGuess = blocks.reduce((a, b) => a + b.d, 0) * SP * SP / 1e4 * S.landUse.residential * S.housesPerHa * 0.8;
	const nSchool = Math.max(radius > 900 ? 1 : 0, Math.round(houseGuess / 1000 * S.sitesPer1000Houses.school));
	const nPark = Math.max(1, Math.round(houseGuess / 1000 * S.sitesPer1000Houses.park));
	// the busiest superblocks (nearest the centre) get them first
	const byD = blocks.slice().sort((a, b) => b.d - a.d);
	byD.forEach((b, n) => { b.school = n % 2 === 1 && Math.floor(n / 2) < nSchool; });
	const service = [];
	const degree = (n) => { let c = 0; for (const e of G.E) if (e.alive && (e.a === n || e.b === n)) c++; return c; };
	// a shopping centre in the corner of a crossing
	function shopping(ci, cj, qu, qv, big) {
		const area = (big ? 2.5 : 1) * fromPct(S.siteHa.commercial, 0.35 + r() * 0.5) * 1e4;
		const w = clamp(Math.sqrt(area * (1.1 + r() * 0.5)), 90, 330), d = clamp(area / w, 70, 240);
		const off = W.primary / 2 + 9;
		const [x, z] = toW(ci * SP + qu * (off + w / 2), cj * SP + qv * (off + d / 2));
		if (!dry(x, z) || slope(x, z) > 0.1 || inSite(x, z, Math.max(w, d) / 2)) return;
		sites.push({ kind: 'shop', x, z, ux: ca, uz: sa, hw: w / 2, hd: d / 2, qu, qv, big });
	}
	// a big town's downtown: the four corners of its main crossing laid out in short blocks
	// on a street grid of their own, towers on plazas, trees along the pavements (claimed
	// before the shops and the houses, which grow round it)
	const DT_NAMES = ['Main Street', 'First Street', 'Second Street', 'Market Street', 'Center Street', 'Broadway', 'Civic Way', 'Plaza Way'];
	let dtName = Math.floor(r() * 3);
	if (radius > 2000) {
		const hw = clamp(radius * 0.055, 110, 200), off = W.primary / 2 + 5, nIn = hw > 150 ? 2 : 1;
		for (const [qu, qv] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
			const uc = qu * (off + hw), vc = qv * (off + hw), [x, z] = toW(uc, vc);
			if (!dry(x, z) || slope(x, z) > 0.12 || dens(x, z) < 0.5) continue;
			// the inner streets, across the corner from arterial to its far side
			const cuts = [];
			for (let k = 1; k <= nIn; k++) cuts.push(-hw + 2 * hw * k / (nIn + 1));
			for (const c of cuts) for (const ax of [0, 1]) {
				const pts = [];
				for (let t = 0; t <= off + 2 * hw + 14.01; t += 20) { const [px2, pz2] = ax ? toW(qu * t, vc + c) : toW(uc + c, qv * t); pts.push(px2, pz2); }
				G.addNoded(pts, { cls: 'tertiary', name: DT_NAMES[dtName++ % DT_NAMES.length] });
			}
			sites.push({ kind: 'downtown', x, z, ux: ca, uz: sa, hw, hd: hw, cuts });
		}
	}
	for (let i = -nL; i <= nL; i++) for (let j = -nL; j <= nL; j++) {
		const [x, z] = toW(i * SP, j * SP), d = dens(x, z);
		if (d < 0.55) continue;
		const centre = i === 0 && j === 0;
		if (!centre && r() > 0.55 * d) continue;
		const quads = [[1, 1], [-1, 1], [1, -1], [-1, -1]].sort(() => r() - 0.5).slice(0, centre ? 2 + (radius > 2000 ? 1 : 0) : 1);
		for (const [qu, qv] of quads) shopping(i, j, qu, qv, centre && radius > 2000);
	}
	let parks = 0;
	blocks.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
	for (const B of blocks) {
		// the collector: across the middle of the superblock, arterial to arterial
		B.col = null;
		if (SP >= 900 && B.d > 0.3) {
			const ax = (B.i + B.j) & 1, k = ax ? B.j + 0.5 : B.i + 0.5, t0 = ax ? B.u0 : B.v0;
			const pts = [], ph = r() * 6.28, amp = SP * (0.05 + r() * 0.07);
			for (let t = t0 - SP * 0.12; t <= t0 + SP * 1.12 + 0.01; t += 20) {
				const f = (t - t0) / SP, o = Math.sin(Math.PI * clamp(f, 0, 1)) * amp * Math.sin(f * Math.PI * 1.5 + ph);
				const [x, z] = ax ? toW(t, k * SP + o) : toW(k * SP + o, t);
				pts.push(x, z);
			}
			// only where the ground takes it
			let ok = true;
			for (let n = 0; n < pts.length; n += 8) if (!dry(pts[n], pts[n + 1]) || slope(pts[n], pts[n + 1]) > 0.22 || inSite(pts[n], pts[n + 1], 8)) ok = false;
			if (ok) {
				const nm = nameOf('col');
				const ids = G.addNoded(pts, { cls: 'tertiary', name: nm });
				// trim the stubs past the arterials it overshot
				if (ids.length > 1) for (const [id, n] of [[ids[0], G.E[ids[0]].a], [ids[ids.length - 1], G.E[ids[ids.length - 1]].b]]) if (degree(n) === 1) G.E[id].alive = false;
				const keep = ids.filter((id) => G.E[id].alive).flatMap((id) => Array.from(G.E[id].p));
				if (keep.length >= 8) B.col = { pts: keep, ax, name: nm };
			}
		}
		// a school beside the collector
		if (B.school && B.col) {
			const area = fromPct(S.siteHa.school, 0.3 + r() * 0.45) * 1e4, w = clamp(Math.sqrt(area * 1.3), 140, 280), d = clamp(area / w, 110, 220);
			const [mx, mz, tx, tz] = along(B.col.pts, lengthOf(B.col.pts) * (0.3 + r() * 0.4)), sd = r() < 0.5 ? 1 : -1;
			const x = mx - tz * sd * (W.tertiary / 2 + 6 + d / 2), z = mz + tx * sd * (W.tertiary / 2 + 6 + d / 2);
			if (dry(x, z) && slope(x, z) < 0.1 && !inSite(x, z, Math.max(w, d) / 2)) sites.push({ kind: 'school', x, z, ux: tx, uz: tz, hw: w / 2, hd: d / 2, fx: tz * sd, fz: -tx * sd });
		}
		// a park somewhere inside
		if (parks < nPark && r() < 0.7) {
			const area = fromPct(S.siteHa.park, 0.3 + r() * 0.6) * 1e4, w = clamp(Math.sqrt(area * 1.4), 50, 260), d = clamp(area / w, 40, 200);
			for (let tries = 0; tries < 6; tries++) {
				const [x, z] = toW(B.u0 + SP * (0.2 + r() * 0.6), B.v0 + SP * (0.2 + r() * 0.6));
				if (!dry(x, z) || slope(x, z) > 0.14 || inSite(x, z, Math.max(w, d) / 2 + 20) || G.nearest(x, z, Math.max(w, d) / 2 + 12)) continue;
				sites.push({ kind: 'park', x, z, ux: ca, uz: sa, hw: w / 2, hd: d / 2 });
				parks++;
				break;
			}
		}
	}
	// the sites' entrances: a service drive from the nearest arterial or collector
	for (const s of sites) {
		if (s.kind === 'park' || s.kind === 'downtown') continue;
		const hit = G.nearest(s.x, s.z, Math.max(s.hw, s.hd) + 40, (id, e) => e.cls === 'service');
		if (!hit) continue;
		const dx = s.x - hit.x, dz = s.z - hit.z, L = Math.hypot(dx, dz) || 1, len = Math.min(L, s.kind === 'shop' ? 70 : 45);
		service.push([hit.x, hit.z, hit.x + dx / L * len, hit.z + dz / L * len]);
	}
	for (const [ax, az, bx, bz] of service) G.addNoded([ax, az, bx, bz], { cls: 'service', name: '' });
	yield 'skeleton';

	// ---------- 3. residential streets ----------
	const ST = S.street;
	const pConnect = older ? 0.92 : 0.9;
	const runs = [];
	// a street grown from a point, heading h; its parent edge is left alone at the start
	function grow(x0, z0, h0, parent, court, B) {
		const pts = [x0, z0], step = 12;
		const curvy = fromPct(ST.turnPer100m, r()) * (older ? 0.3 : 1) * Math.PI / 180 / 100;
		const target = court ? clamp(fromPct(ST.culDepth, r()), 35, 260) : 180 + r() * 420;
		let h = h0, k = (r() - 0.5) * curvy, L = 0, x = x0, z = z0, end = 'free', hit = null;
		const skipNear = (id, e) => L < 40 && (id === parent || e.a === parent?.node || e.b === parent?.node);
		for (let n = 0; n < 60; n++) {
			k = clamp(k + (r() - 0.5) * curvy * 0.8, -curvy * 1.4, curvy * 1.4);
			// steer onto the gentlest heading near the wanted one
			let bh = h + k * step, bs = 1e9;
			for (const dd of [-0.3, -0.15, 0, 0.15, 0.3]) {
				const hh = h + k * step + dd, nx = x + Math.cos(hh) * step, nz = z + Math.sin(hh) * step;
				const g = Math.abs(H(nx, nz) - H(x, z)) / step, s2 = Math.max(0, g - 0.05) * 25 + Math.abs(dd) * 0.5 + (dry(nx, nz) ? 0 : 99);
				if (s2 < bs) { bs = s2; bh = hh; }
			}
			const nx = x + Math.cos(bh) * step, nz = z + Math.sin(bh) * step;
			if (bs > 90 || Math.abs(H(nx, nz) - H(x, z)) / step > MAXG) { end = 'stop'; break; }
			// stay in the superblock, in town, off the reserved sites
			const [lu, lv] = toL(nx, nz);
			// (the arterials bound it; this only catches a street slipping through a gap in them)
			if (lu < B.u0 - SP * 0.2 || lu > B.u0 + SP * 1.2 || lv < B.v0 - SP * 0.2 || lv > B.v0 + SP * 1.2 || dens(nx, nz) < 0.22 || inSite(nx, nz, 22)) { end = 'stop'; break; }
			// a street ahead: join it, or stop short of it as a court
			const ax = x + Math.cos(bh) * 30, az = z + Math.sin(bh) * 30;
			const ahead = L > 25 && G.nearest(ax, az, 18, skipNear);
			if (ahead) {
				const q = G.E[ahead.id];
				const pj = q.cls === 'primary' || q.cls === 'secondary' ? 0.15 : court ? 0.12 : pConnect;
				if (r() < pj && Math.abs(H(ahead.x, ahead.z) - H(x, z)) / (ahead.d + 30) < MAXG) { end = 'join'; hit = ahead; }
				else end = 'stop';
				break;
			}
			// too close alongside another street: no room for the lots between
			if (L > 30 && G.nearest(nx, nz, older ? 30 : 38, skipNear)) { end = 'stop'; break; }
			x = nx; z = nz; h = bh; L += step;
			pts.push(x, z);
			if (L >= target) break;
		}
		if (end === 'join') { pts.push(hit.x, hit.z); L += hit.d; }
		if (L < (court ? 30 : 45)) return null;
		return { pts, end, L };
	}
	// seeds: along the collectors, now and then off an arterial
	function seedsAlong(pts, every, prob, gen, B, cross) {
		const L = lengthOf(pts), out = [];
		for (let s = 40 + r() * every * 0.5; s < L - 40; s += every * (0.7 + r() * 0.6)) {
			if (r() > prob) continue;
			const [x, z, tx, tz] = along(pts, s), both = r() < cross, sd = r() < 0.5 ? 1 : -1;
			for (const side of both ? [1, -1] : [sd]) out.push({ x, z, h: Math.atan2(tx * side, -tz * side) + (r() - 0.5) * 0.35, gen, B });
		}
		return out;
	}
	for (const B of blocks) {
		const t1 = Date.now();
		const queue = [];
		if (B.col) queue.push(...seedsAlong(B.col.pts, older ? 110 : 150, 0.9, 0, B, older ? 0.6 : 0.3));
		// off the arterials round the superblock (rarely: the suburbs turn their backs to them)
		for (const [a0, b0, a1, b1] of [[0, 0, 1, 0], [0, 1, 1, 1], [0, 0, 0, 1], [1, 0, 1, 1]]) {
			const pts = [];
			for (let t = 0.12; t <= 0.88; t += 0.04) { const [x, z] = toW(B.u0 + SP * (a0 + (a1 - a0) * t), B.v0 + SP * (b0 + (b1 - b0) * t)); pts.push(x, z); }
			for (const s of seedsAlong(pts, B.col ? 450 : 200, B.col ? 0.5 : 0.8, 0, B, 0)) {
				// start from the real arterial, heading square off it into the superblock
				const hit = G.nearest(s.x, s.z, SP * 0.15, (id, e) => e.cls !== 'primary' && e.cls !== 'secondary');
				if (!hit) continue;
				const q = G.E[hit.id].p, tx = q[hit.s + 2] - q[hit.s], tz = q[hit.s + 3] - q[hit.s + 1], tl = Math.hypot(tx, tz) || 1;
				const [mx, mz] = toW(B.u0 + SP / 2, B.v0 + SP / 2), sd = (-tz * (mx - hit.x) + tx * (mz - hit.z)) > 0 ? 1 : -1;
				queue.push({ x: hit.x, z: hit.z, h: Math.atan2(tx / tl * sd, -tz / tl * sd), gen: 0, B });
			}
		}
		let made = 0;
		const drain = function* () {
			while (queue.length && made < 500) {
				const sd = queue.shift();
				if (dens(sd.x, sd.z) < 0.25) continue;
				const pa = G.nearest(sd.x, sd.z, 2);
				if (!pa) continue;
				const court = sd.gen > 0 && r() < (older ? 0.08 : 0.16);
				const g = grow(sd.x, sd.z, sd.h, { id: pa.id }, court, B);
				if (!g) continue;
				// cut the parent where the street leaves it; the far end joins or stops
				const run = { name: nameOf(g.end === 'stop' && (court || g.L < 220) ? 'cul' : 'street'), court };
				G.addNoded(g.pts, { cls: 'residential', name: run.name, run: runs.length });
				runs.push(run);
				made++;
				if (sd.gen < 6 && !court) {
					const every = older ? 85 : fromPct(ST.segLen, 0.5 + r() * 0.4) + 35;
					queue.push(...seedsAlong(g.pts, every, older ? 0.9 : 0.8, sd.gen + 1, B, older ? 0.6 : 0.45));
				}
				if (made % 30 === 0) yield 'streets';
			}
		};
		yield* drain();
		// then fill the gaps: open buildable ground far from any street gets one grown to it
		// from the nearest street
		const dead = new Set();
		for (let pass = 0; pass < 4; pass++) {
			const gaps = [];
			for (let a = -0.1; a <= 1.1; a += 55 / SP) for (let b = -0.1; b <= 1.1; b += 55 / SP) {
				const [x, z] = toW(B.u0 + SP * a, B.v0 + SP * b);
				const gk = Math.round(a * 1000) * 7919 + Math.round(b * 1000);
				if (!dead.has(gk) && !covered(x, z) && dens(x, z) > 0.3 && dry(x, z) && slope(x, z) < 0.15 && !inSite(x, z, 30)) gaps.push([x, z, r(), gk]);
			}
			gaps.sort((p, q) => p[2] - q[2]);
			const before = made;
			for (const [x, z, , gk] of gaps) {
				if (covered(x, z)) { dead.add(gk); continue; }
				const noSvc = (id, e) => e.cls === 'service';
				const hit = G.nearest(x, z, 140, noSvc) || G.nearest(x, z, 320, noSvc);
				// (tried once from each side: no second go from the same street)
				if (!hit || dead.has(-gk - 1)) { dead.add(gk); continue; }
				dead.add(-gk - 1);
				queue.push({ x: hit.x, z: hit.z, h: Math.atan2(z - hit.z, x - hit.x), gen: 1, B });
				yield* drain();
			}
			if (made === before) break;
		}
		B.ms = Date.now() - t1;
		yield 'streets';
	}

	// ---------- the finished network: roads and cul-de-sacs ----------
	const deg = new Uint16Array(G.N.length);
	const live = G.E.filter((e) => e.alive && e.p.length >= 4);
	for (const e of live) { deg[e.a]++; deg[e.b]++; }
	const roads = [];
	for (const e of live) {
		const res = e.cls === 'residential';
		const pts = new Float32Array(e.p);
		roads.push({ cls: e.cls, w: W[e.cls] || 6, name: e.name || '', pts, end0: res && deg[e.a] === 1, end1: res && deg[e.b] === 1, bridge: false, link: false, divided: false });
	}

	// ---------- 4. lots, houses, driveways, pools, trees ----------
	const boxes = [], paths = [], pools = [], trees = [];
	const HO = 4, ON = Math.ceil(2 * Rbox / HO) + 2, occ = new Uint8Array(ON * ON);    // 4 m occupancy of the buildings and yards claimed
	const OI = Math.floor((cx - Rbox) / HO), OJ = Math.floor((cz - Rbox) / HO);
	const okey = (i, j) => { const a = i - OI, b = j - OJ; return a < 0 || b < 0 || a >= ON || b >= ON ? -1 : b * ON + a; };
	const rectCells = (x, z, ux, uz, hw, hd, f) => {
		const R = Math.hypot(hw, hd);
		for (let i = Math.floor((x - R) / HO); i <= Math.floor((x + R) / HO); i++) for (let j = Math.floor((z - R) / HO); j <= Math.floor((z + R) / HO); j++) {
			const px = (i + 0.5) * HO - x, pz = (j + 0.5) * HO - z, a = px * ux + pz * uz, b = -px * uz + pz * ux;
			if (Math.abs(a) <= hw + HO * 0.5 && Math.abs(b) <= hd + HO * 0.5 && f(okey(i, j)) === false) return false;
		}
		return true;
	};
	const free = (x, z, ux, uz, hw, hd) => rectCells(x, z, ux, uz, hw, hd, (k) => k >= 0 && occ[k] === 0);
	const claim = (x, z, ux, uz, hw, hd) => rectCells(x, z, ux, uz, hw, hd, (k) => { if (k >= 0) occ[k] = 1; });
	// clear of every street: the corners and the back of the yard
	const roadClear = (x, z, w) => { const h = G.nearest(x, z, w + 7); return !h || h.d > (W[G.E[h.id].cls] || 6) / 2 + w; };
	const HS = S.buildings.house, GA = S.garage;
	const treeH = () => fromPct(S.treeHeight, r());
	function house(ex, ez, tx, tz, side, hw, frontage, big) {
		// the street's edge at the lot, its normal into the lot (the house faces back along it)
		const nx = -tz * side, nz = tx * side;
		const u = r(), w = clamp(fromPct(HS.w, clamp(u + (r() - 0.5) * 0.3, 0, 1)) * (big ? 1.2 : 1), 7, Math.min(24, frontage - 3));
		const d = clamp(fromPct(HS.d, clamp(u + (r() - 0.5) * 0.4, 0, 1)), 8, 22);
		const set = clamp(fromPct(S.lots.setback, r() * 0.8 + 0.1), 5, 16) * (older ? 0.75 : 1);
		const off = hw + set + d / 2, x = ex + nx * off, z = ez + nz * off;
		const ux = -nz, uz = nx;    // the box's local x in the world, along the street
		if (!dry(x, z) || slope(x, z) > 0.2 || inSite(x, z, Math.max(w, d) / 2 + 4)) return false;
		if (r() > Math.min(1, dens(x, z) * 1.25)) return false;
		if (!free(x, z, ux, uz, w / 2 + 1.5, d / 2 + 1.5)) return false;
		// the whole footprint and a back yard clear of the streets and the neighbours
		const near = G.segs(x, z, Math.max(w, d) + 22);
		const roadClear = (px, pz, m) => {
			for (let k = 0; k < near.length; k += 5) {
				const ax = near[k], az = near[k + 1], dx = near[k + 2] - ax, dz = near[k + 3] - az, l2 = dx * dx + dz * dz || 1;
				const e = near[k + 4], t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1), lim = (e.hw || (e.hw = (W[e.cls] || 6) / 2)) + m;
				const ex2 = ax + dx * t - px, ez2 = az + dz * t - pz;
				if (ex2 * ex2 + ez2 * ez2 < lim * lim) return false;
			}
			return true;
		};
		for (const [a, b, m] of [[-1, -1, 3], [1, -1, 3], [-1, 1, 3], [1, 1, 3], [0, 2.2, 3]]) if (!roadClear(x + ux * a * w / 2 + nx * b * d / 2, z + uz * a * w / 2 + nz * b * d / 2, m)) return false;
		claim(x, z, ux, uz, w / 2 + 1.5, d / 2 + 1.5);
		const yaw = Math.atan2(nx, -nz);   // the front (local +z) faces the street
		const roofH = clamp(fromPct(HS.roofH, r()), 1, Math.min(3.2, Math.min(w, d) * 0.25));
		const two = r() < (older ? 0.35 : 0.2);
		const wallH = two ? 5.2 + r() * 0.8 : clamp(fromPct(HS.wallH, r() * 0.6), 2.6, 3.4);
		const hip = r() < 0.55 ? 1 : 0;
		// the garage: in the front of the house (left or right), a wing beside it, or none seen
		const g = r();
		let kind = K.house, gx = 0, door = r() * 0.6 + 0.2;
		if (g < GA.attached && w >= 11) { kind = r() < 0.5 ? K.garageL : K.garageR; gx = (kind === K.garageL ? -1 : 1) * (w / 2 - 3); door = r() * 0.3 + (kind === K.garageL ? 0.55 : 0.15); }
		boxes.push({ x, z, w, d, a: yaw, wallH, roofH, kind, hip, door });
		const fx = x - nx * d / 2, fz = z - nz * d / 2;   // the middle of the front
		let dx = fx + ux * gx, dz = fz + uz * gx, dw = 5.0;
		if (kind === K.house && g < GA.attached + GA.wing + 0.2) {
			// a garage wing flush with the front, to one side
			const s2 = r() < 0.5 ? 1 : -1, gw = clamp(6 + r() * 3, 5.5, 9.5), gd = clamp(6.5 + r() * 2, 6, 9);
			const qx = x + ux * s2 * (w / 2 + gw / 2) + nx * (gd - d) / 2, qz = z + uz * s2 * (w / 2 + gw / 2) + nz * (gd - d) / 2;
			if (roadClear(qx, qz, 4) && free(qx, qz, ux, uz, gw / 2, gd / 2)) {
				claim(qx, qz, ux, uz, gw / 2 + 0.5, gd / 2 + 0.5);
				boxes.push({ x: qx, z: qz, w: gw, d: gd, a: yaw, wallH: 3.0, roofH: Math.min(roofH, 1.6), kind: K.garage, hip, door: 0.5 });
				dx = qx - nx * gd / 2; dz = qz - nz * gd / 2; dw = gw > 7.5 ? 5.6 : 5.0;
			} else { dx = fx + ux * s2 * (w / 2 - 2.5); dz = fz + uz * s2 * (w / 2 - 2.5); }
		}
		// the driveway to the kerb, the front walk from the door
		if (r() < S.lots.drivewayPerHouse + 0.03) paths.push({ ax: dx, az: dz, bx: dx - nx * (set + hw * 0.5), bz: dz - nz * (set + hw * 0.5), w: dw });
		if (kind !== K.garage && r() < 0.8) { const o = (door - 0.5) * (w - 2.5), wx = fx + ux * o, wz = fz + uz * o; paths.push({ ax: wx, az: wz, bx: wx - nx * (set + hw * 0.5), bz: wz - nz * (set + hw * 0.5), w: 1.2 }); }
		// out back: a pool now and then, and the yard trees
		const bx = x + nx * (d / 2 + 9.5), bz = z + nz * (d / 2 + 9.5);
		if (r() < S.lots.poolPerHouse * 0.9 && w * d > 100 && roadClear(bx, bz, 7) && free(bx, bz, ux, uz, 2.5, 3.5)) {
			pools.push({ x: bx, z: bz, w: 4 + r() * 1.5, d: 8 + r() * 3, a: yaw + Math.PI / 2 + (r() - 0.5) * 0.2 });
			claim(bx, bz, ux, uz, 3, 5);
		}
		const nT = Math.round((S.treesPerHa.residential / S.housesPerHa) * 0.55 * (0.5 + r()));
		for (let n = 0; n < nT; n++) {
			const back = r() < 0.7, a = (r() - 0.5) * frontage * 0.9, b = back ? d / 2 + 3 + r() * 12 : -(d / 2 + 2 + r() * (set - 4));
			const qx = x + ux * a + nx * b, qz = z + uz * a + nz * b;
			if (roadClear(qx, qz, 2.5) && free(qx, qz, ux, uz, 1, 1)) trees.push({ x: qx, z: qz, h: treeH() * (back ? 1 : 0.8), cone: r() < 0.22 ? 1 : 0 });
		}
		return true;
	}
	// down both sides of every residential street (and some collectors)
	const houseRoads = roads.filter((q) => q.cls === 'residential' || (q.cls === 'tertiary' && r() < 0.35));
	let nh = 0, done = 0;
	for (const q of houseRoads) {
		const p = q.pts, L = lengthOf(p), hw = q.w / 2;
		for (const side of [1, -1]) {
			let s = 6 + r() * 6;
			while (s < L - 4) {
				const fr = clamp(fromPct(S.lots.frontage, 0.25 + r() * 0.6), 14, 40) * (older ? 0.75 : 1);
				const [x, z, tx, tz] = along(p, s + fr / 2);
				if (house(x, z, tx, tz, side, hw, fr, false)) nh++;
				s += fr;
			}
			// street trees behind the kerb
			if (q.cls === 'residential') for (let t = 4 + r() * 8; t < L; t += 11 + r() * 8) {
				if (r() > 0.7) continue;
				const [x, z, tx, tz] = along(p, t), ox = x - tz * side * (hw + 3), oz = z + tx * side * (hw + 3);
				if (roadClear(ox, oz, 2.5) && free(ox, oz, 1, 0, 0.8, 0.8) && dry(ox, oz)) trees.push({ x: ox, z: oz, h: treeH() * 0.9, cone: 0 });
			}
		}
		// round the turning circle of a court
		for (const [end, k, dir] of [[q.end0, 0, -1], [q.end1, p.length - 2, 1]]) {
			if (!end) continue;
			const ex = p[k], ez = p[k + 1], [, , tx, tz] = along(p, k ? L - 1 : 1);
			for (const da of [-1.0, 0, 1.0]) {
				const a = Math.atan2(tz * dir, tx * dir) + da, cxx = Math.cos(a), czz = Math.sin(a);
				// a lot on the bulb: the "street" there runs round the circle
				if (house(ex + cxx * 5, ez + czz * 5, -czz, cxx, -1, 8, 24, true)) nh++;
			}
		}
		if (++done % 80 === 0) yield 'lots';
	}
	yield 'lots';

	// ---------- the sites: shopping centres, schools, parks ----------
	for (const s of sites) {
		const { x, z, ux, uz, hw, hd } = s;
		// a point in the site's own frame: a along ux, b along (-uz, ux)
		const at = (a, b) => [x + ux * a - uz * b, z + uz * a + ux * b];
		claim(x, z, ux, uz, hw, hd);
		if (s.kind === 'downtown') {
			// the blocks between the inner streets: a tower or two on each, set back behind a
			// plaza, lower shops beside; taller toward the crossing; trees along the pavements
			const edges = [-hw, ...s.cuts, hw], hs = W.tertiary / 2 + 4;
			for (let ia = 0; ia < edges.length - 1; ia++) for (let ib = 0; ib < edges.length - 1; ib++) {
				const a0 = edges[ia] + (ia ? hs : 6), a1 = edges[ia + 1] - (ia < edges.length - 2 ? hs : 4);
				const b0 = edges[ib] + (ib ? hs : 6), b1 = edges[ib + 1] - (ib < edges.length - 2 ? hs : 4);
				const bw = a1 - a0, bd = b1 - b0;
				if (bw < 30 || bd < 30) continue;
				const [bx, bz] = at((a0 + a1) / 2, (b0 + b1) / 2);
				const near = clamp(1 - (Math.hypot(bx - cx, bz - cz) - 60) / (hw * 2.4), 0.2, 1);
				const tw = clamp(bw * (0.42 + r() * 0.18), 22, 50), td = clamp(bd * (0.42 + r() * 0.18), 20, 46);
				const sx = (r() - 0.5) * (bw - tw - 16), sz2 = (r() - 0.5) * (bd - td - 16);
				const [tx, tz] = at((a0 + a1) / 2 + sx, (b0 + b1) / 2 + sz2);
				if (G.nearest(tx, tz, Math.hypot(tw, td) / 2 + 2)) continue;           // (never on a road)
				const tall = older ? 12 + r() * 16 : 16 + Math.pow(r(), 1.5) * 100 * near;
				boxes.push({ x: tx, z: tz, w: tw, d: td, a: Math.atan2(sa, ca), wallH: tall, roofH: 0, kind: tall > 22 ? K.tower : K.office, hip: 0, door: 0.5 });
				// a low block of shops along one side of the block
				if (r() < 0.7) {
					const side = r() < 0.5 ? -1 : 1, lw = bw * 0.8, ld = Math.min(14, (bd - td) / 2 - 6);
					if (ld > 8) { const [lx, lz] = at((a0 + a1) / 2, side > 0 ? b1 - ld / 2 - 2 : b0 + ld / 2 + 2); boxes.push({ x: lx, z: lz, w: lw, d: ld, a: Math.atan2(sa, ca), wallH: 5 + r() * 2, roofH: 0, kind: K.retail, hip: 0, door: 0.5 }); }
				}
				// street trees in their grates along the block's edges
				for (let t = a0 + 6; t < a1 - 4; t += 11) for (const bb of [b0 + 1.5, b1 - 1.5]) { const [qx, qz] = at(t, bb); trees.push({ x: qx, z: qz, h: treeH() * 0.75, cone: 0 }); }
				for (let t = b0 + 12; t < b1 - 10; t += 11) for (const aa of [a0 + 1.5, a1 - 1.5]) { const [qx, qz] = at(aa, t); trees.push({ x: qx, z: qz, h: treeH() * 0.75, cone: 0 }); }
			}
		} else if (s.kind === 'shop') {
			// the anchor store in the far corner facing the crossing, a strip of shops along the
			// back beside it, pads out by the arterials; the rest is parking
			const A = s.qu, Bk = s.qv;    // away from the arterials, along a and b
			const face = Math.atan2(-Bk * uz, -Bk * ux);
			const aw = clamp(hw * 2 * 0.45, 40, 110), ad = clamp(hd * 2 * 0.38, 28, 60);
			const [ax, az] = at(A * (hw - aw / 2 - 6), Bk * (hd - ad / 2 - 6));
			boxes.push({ x: ax, z: az, w: aw, d: ad, a: face, wallH: 7.5 + r() * 2.5, roofH: 0, kind: K.retail, hip: 0, door: 0.5 });
			let run = hw * 2 - aw - 18, a0 = A * (hw - aw - 6);
			while (run > 16) {
				const sw = clamp(14 + r() * 12, 14, run), sd2 = 18 + r() * 6;
				const [bx, bz] = at(a0 - A * sw / 2, Bk * (hd - sd2 / 2 - 6));
				boxes.push({ x: bx, z: bz, w: sw, d: sd2, a: face, wallH: 5 + r() * 1.5, roofH: 0, kind: K.retail, hip: 0, door: 0.5 });
				a0 -= A * (sw + 0.2); run -= sw + 0.2;
			}
			for (let n = 0; n < (s.big ? 3 : 1 + Math.floor(r() * 2)); n++) {
				const pw = 12 + r() * 10, pd = 12 + r() * 6, [px, pz] = at(-A * (hw - pw / 2 - 8) + A * n * (pw + 14), -Bk * (hd - pd / 2 - 8));
				boxes.push({ x: px, z: pz, w: pw, d: pd, a: face, wallH: 4.5 + r() * 1.5, roofH: 0, kind: r() < 0.5 ? K.retail : K.office, hip: 0, door: 0.5 });
			}
			// downtown: offices round the main crossing of a big town
			if (s.big) for (let n = 0; n < 2; n++) {
				const ow = 26 + r() * 20, od = 18 + r() * 10, [ox, oz] = at(-A * (hw * 0.1 + n * (ow + 12)), -Bk * hd * 0.15);
				boxes.push({ x: ox, z: oz, w: ow, d: od, a: face, wallH: 10 + r() * 22, roofH: 0, kind: K.office, hip: 0, door: 0.5 });
			}
			// lot trees on the islands
			for (let a = -hw + 8; a < hw - 8; a += 18) for (let b = -hd + 8; b < hd - 8; b += 26) if (r() < 0.4) { const [tx, tz] = at(a, b); trees.push({ x: tx, z: tz, h: treeH() * 0.8, cone: 0 }); }
		} else if (s.kind === 'school') {
			// classroom wings nearer the road, a gym, the playing field behind
			const f = (s.fx * -uz + s.fz * ux) > 0 ? 1 : -1;    // the side (along b) the road lies on
			const face = Math.atan2(-s.fx, s.fz);
			const nW = 3 + Math.floor(r() * 3);
			for (let n = 0; n < nW; n++) {
				if (hd - 24 - n * 20 < -hd * 0.05) break;
				const ww = clamp(hw * 0.9, 30, 60), wd = 11 + r() * 3, [bx, bz] = at(-hw * 0.35 + (n % 2) * 8, f * (hd - 24 - n * 20));
				boxes.push({ x: bx, z: bz, w: ww, d: wd, a: face, wallH: 4 + r(), roofH: 0, kind: K.school, hip: 0, door: 0.5 });
			}
			const [gx, gz] = at(hw * 0.62, f * hd * 0.25);
			boxes.push({ x: gx, z: gz, w: clamp(hw * 0.5, 20, 34), d: 24, a: face, wallH: 7.5, roofH: 0, kind: K.school, hip: 0, door: 0.5 });
			// trees round the edge
			const nT = hw * hd * 4 / 1e4 * S.treesPerHa.school;
			for (let n = 0; n < nT; n++) { const e = r() * 4, t = r() * 2 - 1, [tx, tz] = e < 2 ? at(t * (hw - 4), (e < 1 ? 1 : -1) * (hd - 4)) : at((e < 3 ? 1 : -1) * (hw - 4), t * (hd - 4)); trees.push({ x: tx, z: tz, h: treeH(), cone: r() < 0.2 ? 1 : 0 }); }
		} else {
			// a park: lawns, a path round it, trees, a playground and maybe a field
			const loop = [];
			for (let n = 0; n <= 24; n++) { const a = n / 24 * Math.PI * 2, [px, pz] = at(Math.cos(a) * (hw - 8), Math.sin(a) * (hd - 8)); loop.push(px, pz); }
			roads.push({ cls: 'footway', w: 1.8, name: '', pts: new Float32Array(loop), end0: false, end1: false, bridge: false, link: false, divided: false });
			const nT = hw * hd * 4 / 1e4 * S.treesPerHa.park;
			for (let n = 0; n < nT; n++) { const a = (r() - 0.5) * 2 * (hw - 4), b = (r() - 0.5) * 2 * (hd - 4); if (Math.hypot(a / hw, b / hd) > 0.55) { const [tx, tz] = at(a, b); trees.push({ x: tx, z: tz, h: treeH() * 1.1, cone: r() < 0.2 ? 1 : 0 }); } }
		}
	}
	yield 'sites';

	// ---------- 5. the land-use map: R roads, G land use x16, B roofs ----------
	const step = Rbox > 3500 ? 10 : 8, x0 = cx - Rbox, z0 = cz - Rbox, MW = Math.ceil(2 * Rbox / step), MH = MW;
	const px = new Uint8Array(MW * MH * 4);
	for (let k = 3; k < px.length; k += 4) px[k] = 255;
	// visit the cells whose centres fall in a disc or an oriented rectangle
	const cellsIn = (x, z, R, test, f) => {
		for (let j = Math.max(0, Math.floor((z - R - z0) / step)); j <= Math.min(MH - 1, Math.floor((z + R - z0) / step)); j++) for (let i = Math.max(0, Math.floor((x - R - x0) / step)); i <= Math.min(MW - 1, Math.floor((x + R - x0) / step)); i++) {
			const dx = x0 + (i + 0.5) * step - x, dz = z0 + (j + 0.5) * step - z;
			if (test(dx, dz)) f((j * MW + i) * 4);
		}
	};
	const disc = (x, z, rad, ch, val) => cellsIn(x, z, rad, (dx, dz) => dx * dx + dz * dz <= rad * rad, (k) => { px[k + ch] = val; });
	const rect = (s, ch, val, pad = 0) => cellsIn(s.x, s.z, Math.hypot(s.hw, s.hd) + pad, (dx, dz) => Math.abs(dx * s.ux + dz * s.uz) <= s.hw + pad && Math.abs(-dx * s.uz + dz * s.ux) <= s.hd + pad, (k) => { px[k + ch] = val; });
	// the neighbourhoods: yards round every house, verges along the streets
	yield 'map';
	for (const b of boxes) if (b.kind <= K.wing) disc(b.x, b.z, Math.max(b.w, b.d) / 2 + 16, 1, LU.residential * 16);
	yield 'map';
	for (const q of roads) if (q.cls === 'residential') for (let i = 0; i < q.pts.length; i += 2) disc(q.pts[i], q.pts[i + 1], q.w / 2 + 12, 1, LU.residential * 16);
	for (const s of sites) {
		const sub = (a, b, hw, hd) => ({ x: s.x + s.ux * a - s.uz * b, z: s.z + s.uz * a + s.ux * b, ux: s.ux, uz: s.uz, hw, hd });
		if (s.kind === 'shop') rect(s, 1, LU.commercial * 16, 4);
		else if (s.kind === 'downtown') rect(s, 1, LU.plaza * 16, 4);
		else if (s.kind === 'school') {
			const f = (s.fx * -s.uz + s.fz * s.ux) > 0 ? 1 : -1;
			rect(s, 1, LU.school * 16, 2);
			rect(sub(-s.hw * 0.2, -f * s.hd * 0.5, s.hw * 0.55, s.hd * 0.35), 1, LU.pitch * 16);
		} else {
			rect(s, 1, LU.park * 16, 2);
			if (s.hw * s.hd * 4 > 12000) rect(sub(s.hw * 0.4, 0, s.hw * 0.3, s.hd * 0.35), 1, LU.pitch * 16);
			rect(sub(-s.hw * 0.5, 0, 12, 12), 1, LU.playground * 16);
		}
	}
	// the streets (for the far view) and the roofs
	yield 'map';
	for (const q of roads) {
		if (q.cls === 'footway') continue;
		const p = q.pts, rad = Math.max(step * 0.5, q.w / 2);
		for (let i = 0; i + 3 < p.length; i += 2) {
			const L = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), n = Math.max(1, Math.ceil(L / (step * 0.7)));
			for (let k = 0; k <= n; k++) disc(p[i] + (p[i + 2] - p[i]) * k / n, p[i + 1] + (p[i + 3] - p[i + 1]) * k / n, rad, 0, 255);
		}
		if (q.end0) disc(p[0], p[1], 12.5, 0, 255);
		if (q.end1) disc(p[p.length - 2], p[p.length - 1], 12.5, 0, 255);
	}
	yield 'map';
	for (const b of boxes) rect({ x: b.x, z: b.z, ux: Math.cos(b.a), uz: Math.sin(b.a), hw: b.w / 2, hd: b.d / 2 }, 2, 255);
	return {
		name, gen: true, seed, style, bounds: [x0, z0, x0 + MW * step, z0 + MH * step],
		roads, boxes, paths, pools, trees,
		map: { px, w: MW, h: MH, x0, z0, step },
		info: { houses: nh, runs: runs.length, sites: sites.map((s) => s.kind), ms: Date.now() - T0, arterialSpacing: SP },
	};
}
