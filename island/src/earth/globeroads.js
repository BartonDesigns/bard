// The roads between the globe's towns and cities: the highways and main roads that tie the
// atlas's places together (earth/atlas.js), laid out by the engine as a road builder would.
//
//   the network   each place joined to its natural neighbours (a relative neighbourhood graph:
//                 A and B are joined when no third place is nearer to both of them than they are
//                 to each other), the long lonely links kept only where a place would otherwise
//                 have none; big cities to big cities get dual carriageways, the rest two lanes
//   the route     found on the ground itself as you come within reach of it (A* over the
//                 ground's heights between the two, a corridor either side of the straight line):
//                 cheap along the level, dearer as the grade steepens past 4%, very dear past 9%,
//                 dear over water; so the road finds the valleys and the passes. A link that
//                 would need a long crossing of open water is left out (no ferries)
//   the store     kept as latitude and longitude, so the frame can float under it; the pieces
//                 near you are made into roads in the engine's metres (about 800 m each, joined
//                 end to end) and handed to the real city as a source (bay/realcity.js
//                 addSource), where the driving (drive.js), the traffic, the grading (berms.js)
//                 and the bridges over the creeks (water.js) find them like any mapped road
//   the town      where a place's town has been grown (globetowns.js), the road stops at its edge
//                 and a short link takes it on to the nearest end of one of the town's streets
//   drawn         as ribbons on the graded ground out to 20 km, marked like the roads they are
//
// All the work is done a slice at a time; nothing takes more than a few milliseconds a frame.

import * as THREE from 'three';
import { cities as atlasCities, atlasReady } from './atlas.js';
import { F, toXZ, toLL } from './globeframe.js';
import { BERM_U, BERM_GLSL } from '../bay/berms.js';

const KM = 111.2;
const REG = 20000;            // m: the roads made round you
const REBUILD = 3000;         // m moved before they are made again
const ROUTE_KM = 260;         // routes are found for links this near
const MOTORWAY = { cls: 'motorway', w: 11, off: 7.5 }, MAIN = { cls: 'primary', w: 8, off: 0 };
const PIECE = 40;             // points a piece (20 m apart)
const STEP = 20;

// the Bay's survey: its own roads there (bay/*)
const inBay = (lat, lon) => lat > 36.93 && lat < 38.87 && lon > -123.6 && lon < -121.45;
const wrapLon = (d) => ((d + 540) % 360 + 360) % 360 - 180;
const kmBetween = (a, b) => { const c = Math.cos((a.lat + b.lat) / 2 * Math.PI / 180); return Math.hypot(wrapLon(a.lon - b.lon) * c, a.lat - b.lat) * KM; };
// Prioritise the corridor, not only its cities: landing halfway along a long road must stream it.
export function roadCorridorDistance(p, L) {
	const c = Math.cos(p.lat * Math.PI / 180), ax = wrapLon(L.a.lon - p.lon) * c, ay = L.a.lat - p.lat;
	const dx = wrapLon(L.b.lon - L.a.lon) * c, dy = L.b.lat - L.a.lat;
	const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
	return Math.hypot(ax + dx * t, ay + dy * t) * KM;
}

// Keep a generated town's road-network identity tied to its seeded position rather than
// its display name or catalogue index. This lets the streamed Crysis town join the same
// inter-town road at both ends after the player returns to it.
export function localRoadTownId(t) {
	return `bay-town:${Math.round(Number(t?.x) || 0)}:${Math.round(Number(t?.z) || 0)}`;
}

// a small binary heap of cell indices keyed by an array
function heap(key) {
	const a = [];
	return {
		get size() { return a.length; },
		push(v) { a.push(v); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (key[a[p]] <= key[v]) break; a[i] = a[p]; i = p; } a[i] = v; },
		pop() {
			const top = a[0], last = a.pop();
			if (a.length) {
				let i = 0; const n = a.length;
				for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && key[a[c + 1]] < key[a[c]]) c++; if (key[a[c]] >= key[last]) break; a[i] = a[c]; i = c; }
				a[i] = last;
			}
			return top;
		},
	};
}

export function createGlobeRoads({ scene, height, data, groundAt, isPhone, left = () => false, extraPlaces = () => [] }) {
	const group = new THREE.Group();
	group.name = 'globe roads';
	scene.add(group);
	let nodes = null, links = null, build = null, extraKey = '';
	const routes = new Map();         // link id -> { lat: Float64Array, lon: Float64Array } | 'none'
	const queue = [];
	let job = null;
	const stats = { links: 0, routed: 0, failed: 0, pieces: 0, routeMs: 0, buildMs: 0 };

	// ---------- the network ----------
	function* network() {
		// The atlas is the long-distance backbone. The optional procedural places are the
		// settlements the Crysis town generator has seeded beyond the inner Bay survey. They
		// use the same graph and route solver, so a generated home town is not an isolated
		// island of streets when the player drives out of the mapped core.
		const atlas = atlasCities().filter((c) => !inBay(c.lat, c.lon));
		const seen = new Set(atlas.map((c) => c.id));
		const procedural = (typeof extraPlaces === 'function' ? extraPlaces() : extraPlaces || [])
			.filter((c) => Number.isFinite(c?.lat) && Number.isFinite(c?.lon))
			.map((c, i) => {
				const id = String(c.id || `procedural-${Math.round(c.lat * 1000)}-${Math.round(c.lon * 1000)}-${i}`);
				if (seen.has(id)) return null;
				seen.add(id);
				return { ...c, id, name: c.name || 'Unnamed settlement', pop: Number.isFinite(c.pop) ? c.pop | 0 : 2 };
			})
			.filter(Boolean);
		const C = [...atlas, ...procedural];
		nodes = C.map((c, i) => ({ i, id: c.id, name: c.name, lat: c.lat, lon: c.lon, pop: c.pop | 0, links: [] }));
		const cell = new Map(), key = (a, b) => a + ',' + b;
		for (const n of nodes) { const k = key(Math.floor(n.lat / 5), Math.floor((n.lon + 180) / 5)); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(n); }
		const near = (n, km) => {
			const out = [], r = Math.ceil(km / 550) + 1, rx = Math.min(36, Math.ceil(km / (550 * Math.max(0.1, Math.cos(n.lat * Math.PI / 180)))) + 1);
			for (let a = -r; a <= r; a++) for (let b = -rx; b <= rx; b++) for (const m of cell.get(key(Math.floor(n.lat / 5) + a, ((Math.floor((n.lon + 180) / 5) + b) % 72 + 72) % 72)) || []) if (m !== n) { const d = kmBetween(n, m); if (d < km) out.push([m, d]); }
			return out;
		};
		const links2 = [];
		let t0 = performance.now();
		for (const a of nodes) {
			const cand = near(a, 600);
			for (const [b, d] of cand) {
				if (b.i < a.i) continue;
				// a third place nearer to both: the road goes by way of it
				let block = false;
				for (const [c, dc] of cand) if (c !== b && dc < d && kmBetween(b, c) < d) { block = true; break; }
				if (!block && d > 0.01 && d < 450) links2.push({ id: links2.length, a, b, km: d, ...(Math.min(a.pop, b.pop) >= 2 && d > 25 ? MOTORWAY : MAIN) });
			}
			if (performance.now() - t0 > 4) { yield; t0 = performance.now(); }
		}
		for (const L of links2) { L.a.links.push(L); L.b.links.push(L); }
		// a place left alone is joined to its nearest
		for (const a of nodes) if (!a.links.length) { const c = near(a, 800).sort((p, q) => p[1] - q[1])[0]; if (c) { const L = { id: links2.length, a, b: c[0], km: c[1], ...MAIN }; links2.push(L); a.links.push(L); c[0].links.push(L); } }
		links = links2;
		stats.links = links.length;
	}

	// ---------- a route on the ground ----------
	function* route(L) {
		const t0 = performance.now();
		let work = 0, s0 = t0;
		const latM = (L.a.lat + L.b.lat) / 2, kx = 111320 * Math.cos(latM * Math.PI / 180), kz = 110996;
		let dl = L.b.lon - L.a.lon; dl = ((dl + 540) % 360) - 180;
		const ex = dl * kx, ey = (L.b.lat - L.a.lat) * kz, len = Math.hypot(ex, ey), ux = ex / len, uy = ey / len;
		const cs = Math.max(120, Math.min(500, len / 450)), pad = 3000, half = Math.max(3000, len * 0.22);
		const NU = Math.ceil((len + 2 * pad) / cs) + 1, NV = Math.ceil(2 * half / cs) + 1, N = NU * NV;
		// a cell's place (east, north metres from A)
		const pos = (i, j) => { const u = -pad + i * cs, v = -half + j * cs; return [u * ux - v * uy, u * uy + v * ux]; };
		const H = new Float32Array(N).fill(NaN), wet = new Uint8Array(N);
		const hAt = (k) => {
			if (H[k] === H[k]) return H[k];
			const i = k % NU, j = (k - i) / NU, [x, y] = pos(i, j);
			const h = height.atLL(L.a.lat + y / kz, L.a.lon + x / kx);
			wet[k] = height.out.land < 0 || h < 0.3 ? 1 : 0;
			return (H[k] = h);
		};
		const g = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
		const cellOf = (x, y) => { const u = x * ux + y * uy, v = -x * uy + y * ux; return Math.round((v + half) / cs) * NU + Math.round((u + pad) / cs); };
		const start = cellOf(0, 0), goal = cellOf(ex, ey);
		const gi = goal % NU, gj = (goal - gi) / NU;
		const hq = (k) => { const i = k % NU, j = (k - i) / NU; return Math.hypot(i - gi, j - gj) * cs; };
		const open = heap(f);
		g[start] = 0; f[start] = hq(start); open.push(start);
		const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
		let n = 0, found = false;
		while (open.size) {
			const k = open.pop();
			if (shut[k]) continue;
			if (k === goal) { found = true; break; }
			shut[k] = 1;
			const i = k % NU, j = (k - i) / NU, hk = hAt(k);
			for (const [a, b] of D8) {
				const ii = i + a, jj = j + b;
				if (ii < 0 || jj < 0 || ii >= NU || jj >= NV) continue;
				const q = jj * NU + ii;
				if (shut[q]) continue;
				const d = Math.hypot(a, b) * cs, gr = Math.abs(hAt(q) - hk) / d;
				let c = d * (1 + (gr / 0.04) ** 2 * 0.6) + (gr > 0.09 ? d * 400 * (gr - 0.09) : 0);
				if (wet[q]) c += d * 25;
				const ng = g[k] + c;
				if (ng < g[q]) { g[q] = ng; f[q] = ng + hq(q); from[q] = k; open.push(q); }
			}
			if ((++n & 31) === 0 && performance.now() - s0 > 3) { work += performance.now() - s0; yield; s0 = performance.now(); }
		}
		work += performance.now() - s0;
		stats.routeMs = Math.max(stats.routeMs, Math.round(work));
		if (!found) return 'none';
		// back along the way, then smoothed into curves and set out every 20 m
		let P = [];
		for (let k = goal; k >= 0; k = from[k]) { const i = k % NU, j = (k - i) / NU; P.push(pos(i, j)); }
		P.reverse();
		P[0] = [0, 0]; P[P.length - 1] = [ex, ey];
		// (a long run over open water: this road is not made)
		let wetRun = 0, worst = 0;
		for (let q = 1; q < P.length; q++) { const k = cellOf(P[q][0], P[q][1]); wetRun = k >= 0 && k < N && wet[k] ? wetRun + Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]) : 0; worst = Math.max(worst, wetRun); }
		if (worst > 2500) return 'none';
		for (let pass = 0; pass < 3; pass++) {
			const Q = [P[0]];
			for (let q = 0; q + 1 < P.length; q++) { const [a, b] = [P[q], P[q + 1]]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
			Q.push(P[P.length - 1]); P = Q;
		}
		const R = [P[0]];
		let carry = 0;
		for (let q = 1; q < P.length; q++) {
			const [ax, ay] = P[q - 1], [bx, by] = P[q], d = Math.hypot(bx - ax, by - ay);
			let s = STEP - carry;
			while (s <= d) { R.push([ax + (bx - ax) * s / d, ay + (by - ay) * s / d]); s += STEP; }
			carry = d - (s - STEP);
		}
		if (Math.hypot(R[R.length - 1][0] - ex, R[R.length - 1][1] - ey) > 1) R.push([ex, ey]);
		const lat = new Float64Array(R.length), lon = new Float64Array(R.length);
		// Recheck the actual smoothed route; corners must not cut across open sea.
		wetRun = 0;
		for (let q = 0; q < R.length; q++) {
			const [x, y] = R[q]; lat[q] = L.a.lat + y / kz; lon[q] = L.a.lon + x / kx;
			const h = height.atLL(lat[q], lon[q]);
			wetRun = height.out.land < 0 || h < 0.3 ? wetRun + (q ? Math.hypot(x - R[q - 1][0], y - R[q - 1][1]) : 0) : 0;
			if (wetRun > 2500) return 'none';
			if ((q & 63) === 0 && performance.now() - s0 > 3) { yield; s0 = performance.now(); }
		}
		return { lat, lon };
	}

	// ---------- the roads round you, in the frame's metres ----------
	const grid = new Map(), CELL = 400;
	let built = [], at = null, epoch = -1, townNow = [], making = null, version = 0, townKey = '';
	const pieceCache = new Map();
	function near(kind, x, z, rad, out) {
		if (kind !== 'roads' || !built.length) return;
		const seen = new Set();
		for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++) for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
			const g = grid.get(gx + ',' + gz);
			if (g) for (const r of g) if (!seen.has(r)) { seen.add(r); out.push(r); }
		}
	}
	// a polyline (engine metres) moved sideways by `off` to its right, tapering to the centre over
	// the last `taper` metres at each end that meets a junction
	function offset(P, off, taper0, taper1) {
		const n = P.length / 2, out = new Float32Array(P.length);
		let s = 0;
		const S = [0];
		for (let q = 1; q < n; q++) { s += Math.hypot(P[q * 2] - P[q * 2 - 2], P[q * 2 + 1] - P[q * 2 - 1]); S.push(s); }
		for (let q = 0; q < n; q++) {
			const a = Math.max(0, q - 1), b = Math.min(n - 1, q + 1);
			let dx = P[b * 2] - P[a * 2], dz = P[b * 2 + 1] - P[a * 2 + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
			const k = Math.min(taper0 ? Math.min(1, S[q] / 300) : 1, taper1 ? Math.min(1, (s - S[q]) / 300) : 1);
			out[q * 2] = P[q * 2] - dz * off * k; out[q * 2 + 1] = P[q * 2 + 1] + dx * off * k;
		}
		return out;
	}
	const road = (L, pts, oneway, name, extra = {}) => {
		let mnx = 1e18, mnz = 1e18, mxx = -1e18, mxz = -1e18;
		for (let k = 0; k < pts.length; k += 2) { mnx = Math.min(mnx, pts[k]); mxx = Math.max(mxx, pts[k]); mnz = Math.min(mnz, pts[k + 1]); mxz = Math.max(mxz, pts[k + 1]); }
		return { cls: L.cls, name, w: L.w, pts, drive: true, walked: false, bridge: false, end0: false, end1: false, link: false, divided: L.cls === 'motorway', oneway, rural: true, globe: true, box: [mnx, mnz, mxx, mxz], ...extra };
	};
	function connector(from, to) {
		const length = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(1, Math.ceil(length / STEP));
		const pts = new Float32Array((n + 1) * 2);
		let previous;
		for (let i = 0; i <= n; i++) {
			const x = from[0] + (to[0] - from[0]) * i / n, z = from[1] + (to[1] - from[1]) * i / n;
			const h = groundAt(x, z), ll = toLL(x, z); height.atLL(ll.lat, ll.lon);
			if (!Number.isFinite(h) || h < 0.3 || height.out.land < 0 || (i && Math.abs(h - previous) > length / n * 0.25)) return null;
			pts[i * 2] = x; pts[i * 2 + 1] = z; previous = h;
		}
		return pts;
	}
	function* make(cx, cz) {
		const t0 = performance.now();
		let s0 = t0, work = 0;
		const out = [];
		const ll = toLL(cx, cz);
		for (const L of links || []) {
			const R = routes.get(L.id);
			if (!R || R === 'none') continue;
			// (quickly: is any of it within reach?)
			if (Math.min(kmBetween(ll, L.a), kmBetween(ll, L.b)) > L.km / 2 + REG / 1000 + 5) continue;
			const n = R.lat.length, P = new Float32Array(n * 2);
			let any = false;
			for (let q = 0; q < n; q++) { const p = toXZ(R.lat[q], R.lon[q]); P[q * 2] = p.x; P[q * 2 + 1] = p.z; if (!any && Math.abs(p.x - cx) < REG && Math.abs(p.z - cz) < REG) any = true; }
			if (!any) continue;
			// the town grown at either end: stop at its edge, and go on into its streets
			let q0 = 0, q1 = n - 1;
			const joins = [];
			for (const [end, node] of [[0, L.a], [1, L.b]]) {
				const T = townNow.find((t) => t.id === node.id);
				if (!T?.roads?.length) continue;
				const reach = T.r * 0.9, previous0 = q0, previous1 = q1;
				if (end === 0) { while (q0 < q1 && Math.hypot(P[q0 * 2] - T.x, P[q0 * 2 + 1] - T.z) < reach) q0++; } else { while (q1 > q0 && Math.hypot(P[q1 * 2] - T.x, P[q1 * 2 + 1] - T.z) < reach) q1--; }
				const q = end === 0 ? q0 : q1, px = P[q * 2], pz = P[q * 2 + 1];
				let best = null, bd = Math.max(600, T.r);
				for (const r of T.roads) {
					if (!r.pts || r.pts.length < 4 || r.cls === 'service' || /path|track|footway|steps/.test(r.cls || '')) continue;
					for (const k of [0, r.pts.length - 2]) { const d = Math.hypot(r.pts[k] - px, r.pts[k + 1] - pz); if (d < bd) { const to = [r.pts[k], r.pts[k + 1]], pts = connector([px, pz], to); if (pts) { bd = d; best = pts; } } }
				}
				if (best) joins.push(best);
				else { q0 = previous0; q1 = previous1; }
			}
			const base = P.subarray(q0 * 2, q1 * 2 + 2);
			const key = L.id + ':' + F.epoch + ':' + q0 + ':' + q1 + ':' + townKey;
			let pieces = pieceCache.get(key);
			if (!pieces) {
				pieces = [];
				const name = `${L.a.name} – ${L.b.name}`, m = base.length / 2;
				const lanes = L.cls === 'motorway' ? [[L.off, false], [-L.off, true]] : [[0, false]];
				for (const [off, back] of lanes) {
					const S = off ? offset(base, (left() ? -1 : 1) * off, true, true) : base;
					for (let q = 0; q < m - 1; q += PIECE) {
						const e = Math.min(m - 1, q + PIECE);
						let pts = S.slice(q * 2, e * 2 + 2);
						if (back) { const r = new Float32Array(pts.length); for (let k = 0; k < pts.length; k += 2) { r[k] = pts[pts.length - 2 - k]; r[k + 1] = pts[pts.length - 1 - k]; } pts = r; }
						pieces.push(road(L, pts, L.cls === 'motorway', name));
					}
				}
				for (const pts of joins) pieces.push(road(MAIN, pts, false, `${L.a.name} – ${L.b.name}`, { cls: 'primary', w: 8, link: true }));
				pieceCache.set(key, pieces);
			}
			for (const r of pieces) if (r.box[2] > cx - REG && r.box[0] < cx + REG && r.box[3] > cz - REG && r.box[1] < cz + REG) out.push(r);
			if (performance.now() - s0 > 3) { work += performance.now() - s0; yield; s0 = performance.now(); }
		}
		// the ribbons: the road's own line on the ground, level across, 10 to 20 m a step
		const pos = [], uv = [], idx = [];
		for (const r of out) {
			const p = r.pts, n = p.length / 2, hw = r.w / 2, v0 = pos.length / 3;
			// Sample each edge on ungraded terrain. The shared berm texture applies the same
			// grading as the player and terrain, including after it updates while standing still.
			let s = 0;
			for (let q = 0; q < n; q++) {
				const a = Math.max(0, q - 1), b = Math.min(n - 1, q + 1);
				let dx = p[b * 2] - p[a * 2], dz = p[b * 2 + 1] - p[a * 2 + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
				if (q) s += Math.hypot(p[q * 2] - p[q * 2 - 2], p[q * 2 + 1] - p[q * 2 - 1]);
				const lx = p[q * 2] - dz * hw, lz = p[q * 2 + 1] + dx * hw, rx = p[q * 2] + dz * hw, rz = p[q * 2 + 1] - dx * hw;
				pos.push(lx, groundAt(lx, lz) + 0.12, lz, rx, groundAt(rx, rz) + 0.12, rz);
				uv.push(-1, s, 1, s);
				if (q) { const k = v0 + q * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
			}
			if (performance.now() - s0 > 3) { work += performance.now() - s0; yield; s0 = performance.now(); }
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute('aRoad', new THREE.Float32BufferAttribute(uv, 2));
		geo.setIndex(idx);
		geo.computeVertexNormals();
		geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 0, cz), REG * 1.5);
		// in one go: the store near() reads and the ribbons
		grid.clear();
		for (const r of out) for (let gx = Math.floor(r.box[0] / CELL); gx <= Math.floor(r.box[2] / CELL); gx++) for (let gz = Math.floor(r.box[1] / CELL); gz <= Math.floor(r.box[3] / CELL); gz++) { const k = gx + ',' + gz; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(r); }
		built = out; version++;
		mesh.geometry.dispose(); mesh.geometry = geo;
		stats.pieces = out.length; stats.buildMs = Math.max(stats.buildMs, Math.round(work + performance.now() - s0));
		// (keep only this epoch's pieces)
		for (const k of pieceCache.keys()) if (!k.includes(':' + F.epoch + ':') || !routes.has(Number(k.split(':')[0]))) pieceCache.delete(k);
	}

	// ---------- drawn ----------
	const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, BERM_U);
		sh.vertexShader = 'attribute vec2 aRoad; varying vec2 vRoad;\n' + BERM_GLSL + '\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vRoad = aRoad;
			transformed.y += bermDelta(position.xz);`);
		sh.fragmentShader = 'varying vec2 vRoad;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float a = abs(vRoad.x), fw = fwidth(vRoad.x) * 1.5;
				vec3 c = vec3(0.075, 0.075, 0.08) * (0.9 + 0.2 * fract(sin(dot(floor(vRoad * vec2(4.0, 0.5)), vec2(12.9898, 78.233))) * 43758.5453));
				float edge = smoothstep(0.86 - fw, 0.88, a) * (1.0 - smoothstep(0.93, 0.95 + fw, a));
				float mid = (1.0 - smoothstep(0.03, 0.05 + fw, a)) * step(0.5, fract(vRoad.y / 12.0));
				c = mix(c, vec3(0.62, 0.62, 0.58), max(edge, mid) * 0.9);
				diffuseColor.rgb = c;
			}`);
	};
	mat.customProgramCacheKey = () => 'globeroads2';
	const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
	mesh.frustumCulled = false; mesh.receiveShadow = true;
	group.add(mesh);

	// ---------- each frame ----------
	let scanT = 0;
	const placesKey = () => (typeof extraPlaces === 'function' ? extraPlaces() : extraPlaces || [])
		.filter((c) => Number.isFinite(c?.lat) && Number.isFinite(c?.lon))
		.map((c, i) => `${c.id || i}:${Math.round(c.lat * 1000)}:${Math.round(c.lon * 1000)}`).join('|');
	function update(dt, cam, on, town) {
		group.visible = on;
		if (!on) return;
		// Bay towns are created after the globe starts streaming. Rebuild the bounded graph
		// once their deterministic catalogue appears, without rebuilding every frame.
		const pk = placesKey();
		if (links && pk !== extraKey) {
			nodes = links = build = null; extraKey = pk; routes.clear(); queue.length = 0; job = null;
			pieceCache.clear(); grid.clear(); built = []; making = null; at = null;
			mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry();
		}
		if (!links) {
			if (!build && atlasReady()) { extraKey = pk; build = network(); }
			if (build) { const t0 = performance.now(); while (performance.now() - t0 < 4) if (build.next().done) { build = null; break; } }
			return;
		}
		const x = cam.position.x, z = cam.position.z, ll = toLL(x, z);
		// the links near you still to be found on the ground (the window must hold both ends)
		scanT -= dt;
		if (scanT <= 0) {
			scanT = 2;
			const W = data.win, lonW0 = -180 + W.gi0 / 10, latW1 = 90 - W.gj0 / 10;
			const inWin = (p) => { const dl = ((((p.lon - lonW0) % 360) + 360) % 360); return dl > 0.3 && dl < 25.3 && p.lat < latW1 - 0.3 && p.lat > latW1 - 25.3; };
			queue.length = 0;
			const candidates = [];
			for (const L of links) {
				const d = roadCorridorDistance(ll, L);
				if (d < ROUTE_KM && inWin(L.a) && inWin(L.b)) candidates.push([d, L]);
			}
			candidates.sort((p, q) => p[0] - q[0]);
			// Budget the queue as well as the cache: otherwise a stationary dense region
			// repeatedly computes and evicts the next-farthest road every two seconds.
			const selected = candidates.slice(0, isPhone ? 24 : 48), keep = new Set(selected.map((p) => p[1].id));
			for (const id of routes.keys()) if (!keep.has(id)) routes.delete(id);
			if (job && !keep.has(job.L.id)) job = null;
			for (const p of selected) if (!routes.has(p[1].id) && job?.L.id !== p[1].id) queue.push(p);
		}
		// (a route for somewhere you have since left is dropped, and found again if you come back)
		if (job && roadCorridorDistance(ll, job.L) > ROUTE_KM * 1.5) job = null;
		if (!job && queue.length && !data.win.moving) { const L = queue.shift()[1]; job = { L, it: route(L) }; }
		if (job) step(job);
		// the roads round you made again when you have come far, the frame moved, a town came or went, or a route arrived
		const nextTowns = Array.isArray(town) ? town : town ? [town] : [];
		const tk = nextTowns.map((t) => t.id + ':' + t.roads.length).join('|');
		if (tk !== townKey || nextTowns.some((t, i) => t.roads !== townNow[i]?.roads)) { townNow = nextTowns; townKey = tk; pieceCache.clear(); at = null; making = null; }
		if (!making && (!at || epoch !== F.epoch || Math.hypot(x - at[0], z - at[1]) > REBUILD)) { at = [x, z]; epoch = F.epoch; making = make(x, z); }
		if (making) { const t0 = performance.now(); while (performance.now() - t0 < (isPhone ? 2 : 4)) if (making.next().done) { making = null; break; } }
	}
	function step(J) {
		const r = J.it.next();
		if (r.done) { routes.set(J.L.id, r.value); if (r.value === 'none') stats.failed++; else stats.routed++; if (job === J) job = null; at = null; }
		return r.done;
	}
	// the frame moved: what is standing is in the old metres, so it goes at once (and is made again)
	function reframe() { pieceCache.clear(); scanT = 0; queue.length = 0; job = null; grid.clear(); built = []; making = null; at = null; mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry(); }
	// everything near you finished now, in one go (tests, and a jump)
	function settle(cam) {
		if (!links) { if (!build && atlasReady()) build = network(); while (build && !build.next().done); build = null; }
		if (cam && links) {
			const ll = toLL(cam.position.x, cam.position.z);
			const near = links.filter((L) => !routes.has(L.id) && roadCorridorDistance(ll, L) < 90).sort((a, b) => roadCorridorDistance(ll, a) - roadCorridorDistance(ll, b)).slice(0, 8);
			for (const L of near) { const J = { L, it: route(L) }; while (!step(J)); }
			if (job) while (!step(job));
			at = null; making = make(cam.position.x, cam.position.z); epoch = F.epoch; at = [cam.position.x, cam.position.z];
		}
		while (making && !making.next().done); making = null;
	}
	// whether a point is on one of these roads, or within pad metres of its edge (the trees keep off)
	const tmp = [];
	function onRoad(x, z, pad = 3) {
		tmp.length = 0; near('roads', x, z, 20, tmp);
		for (const r of tmp) {
			const p = r.pts, hw = r.w / 2 + pad;
			for (let k = 0; k + 3 < p.length; k += 2) {
				const ax = p[k], az = p[k + 1], dx = p[k + 2] - ax, dz = p[k + 3] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
				if (Math.hypot(x - ax - dx * t, z - az - dz * t) < hw) return true;
			}
		}
		return false;
	}
	const info = () => ({ ...stats, near: built.length, queue: queue.length, cachedRoutes: routes.size, cachedPieces: pieceCache.size, routing: job ? `${job.L.a.name} – ${job.L.b.name}` : null });
	const dispose = () => { build = job = making = null; queue.length = 0; routes.clear(); pieceCache.clear(); grid.clear(); built = []; scene.remove(group); mesh.geometry.dispose(); mat.dispose(); };
	return { update, near, onRoad, dispose, version: () => version, reframe, settle, info, group, links: () => links, routes };
}
