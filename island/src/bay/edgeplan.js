// What the edgelands hold, square by square: the plan for one tile, as plain data
// (edgelands.js builds it). Everything comes from the land under it:
//   fire roads climb to the hilltops along the ridges, farm roads run the section lines
//   between the fields on the flat, levee and maintenance tracks keep to the banks of the
//   rivers and flood channels, and the real map's own dirt tracks are worn into ruts;
//   rural roads get dirt shoulders and gravel pull-outs;
//   the industrial land gets its back yards (containers, pallets, drums, tyres, a
//   dumpster, a fence with slats, tags on the back wall, weeds in the cracked asphalt), a
//   rail spur behind the warehouses, fenced freeway margins, bare ground under the
//   overpasses, and litter where the wind leaves it: in drifts against the fences;
//   where town gives out to open land: weedy verges, dry-grass lots with a path worn
//   across, a drainage ditch;
//   and now and then a small camp: under an overpass, on a creek bank, along the tracks or
//   a freeway fence, more near a downtown, never in a park, by a playground or a school,
//   nor on the Boardwalk or a wharf.
// Tiles are planned in slices (a generator); the same tile is the same every time.

import { toGrid, fromGrid, BLOCKS, STYLE } from './styles.js';
import { toWorld } from './geo.js';
import { ROUTES } from './roads.js';
import { REAL_EXTENTS } from './realcity.js';

export const TILE = 320;
const RC = 1600;                              // the road cells: fire roads and farm roads
const hash = (a, b) => { let h = Math.imul(Math.floor(a) | 0, 374761393) ^ Math.imul(Math.floor(b) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vnoise = (x) => { const i = Math.floor(x), u = x - i, s = u * u * (3 - 2 * u); return hash(i, 71) * (1 - s) + hash(i + 1, 71) * s; };

// where nobody camps: the Boardwalk and the wharves, the Discovery Museum, Pier 39
const NO_CAMP = [[36.9640, -122.0180, 750], [37.8087, -122.4100, 700], [37.8355, -122.4770, 450], [37.7960, -122.3935, 350]].map(([a, b, r]) => ({ ...toWorld(a, b), r }));
// the freeways outside the mapped regions (roads.js draws them on the ground there)
const REAL_W = REAL_EXTENTS.map(([w, s, e, n]) => { const a = toWorld(n, w), b = toWorld(s, e); return [a.x + 70, a.z + 70, b.x - 70, b.z - 70]; });
const inRealW = (x, z) => REAL_W.some(([x0, z0, x1, z1]) => x > x0 && z > z0 && x < x1 && z < z1);
let FWY = null;
function freewayLines() {
	if (FWY) return FWY;
	FWY = [];
	for (const ll of Object.values(ROUTES)) {
		const pts = ll.map(([a, b]) => toWorld(a, b)), out = [];
		// roads.js's own Catmull-Rom, every 25 m, so the margins follow its strip
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i], b = pts[i + 1], p0 = pts[Math.max(0, i - 1)], p3 = pts[Math.min(pts.length - 1, i + 2)];
			const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 25));
			for (let k = 0; k < n; k++) {
				const t = k / n, t2 = t * t, t3 = t2 * t, f = (q0, q1, q2, q4) => 0.5 * (2 * q1 + (-q0 + q2) * t + (2 * q0 - 5 * q1 + 4 * q2 - q4) * t2 + (-q0 + 3 * q1 - 3 * q2 + q4) * t3);
				out.push(f(p0.x, a.x, b.x, p3.x), f(p0.z, a.z, b.z, p3.z));
			}
		}
		out.push(pts[pts.length - 1].x, pts[pts.length - 1].z);
		FWY.push(out);
	}
	return FWY;
}

// a polyline every `step` metres (flat [x, z, ...])
export function resample(p, step) {
	const out = [p[0], p[1]];
	let carry = 0;
	for (let i = 0; i + 3 < p.length; i += 2) {
		const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L = Math.hypot(dx, dz);
		if (L < 1e-6) continue;
		let s = step - carry;
		while (s <= L) { out.push(ax + dx * s / L, az + dz * s / L); s += step; }
		carry = L - (s - step);
	}
	const lx = p[p.length - 2], lz = p[p.length - 1];
	if (Math.hypot(out[out.length - 2] - lx, out[out.length - 1] - lz) > step * 0.3) out.push(lx, lz);
	return out;
}
// Chaikin's corners cut, n times
function smoothLine(p, n = 2) {
	for (let k = 0; k < n; k++) {
		const o = [p[0], p[1]];
		for (let i = 0; i + 3 < p.length; i += 2) o.push(p[i] * 0.75 + p[i + 2] * 0.25, p[i + 1] * 0.75 + p[i + 3] * 0.25, p[i] * 0.25 + p[i + 2] * 0.75, p[i + 1] * 0.25 + p[i + 3] * 0.75);
		o.push(p[p.length - 2], p[p.length - 1]);
		p = o;
	}
	return p;
}
// the segment of a line an offset to one side
function offsetLine(p, off) {
	const o = [];
	for (let i = 0; i < p.length; i += 2) {
		const a = Math.max(0, i - 2), b = Math.min(p.length - 2, i + 2), dx = p[b] - p[a], dz = p[b + 1] - p[a + 1], L = Math.hypot(dx, dz) || 1;
		o.push(p[i] - dz / L * off, p[i + 1] + dx / L * off);
	}
	return o;
}

// ---------- a 2 m occupancy grid over the tile (and a margin) ----------
function occupancy(x0, z0, size) {
	const C = 2, N = Math.ceil(size / C), a = new Uint8Array(N * N);
	const cell = (x, z) => { const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
	const disc = (x, z, r, v = 1) => { for (let j = Math.floor((z - r - z0) / C); j <= Math.floor((z + r - z0) / C); j++) for (let i = Math.floor((x - r - x0) / C); i <= Math.floor((x + r - x0) / C); i++) { if (i < 0 || j < 0 || i >= N || j >= N) continue; const cx = x0 + (i + 0.5) * C, cz = z0 + (j + 0.5) * C; if ((cx - x) ** 2 + (cz - z) ** 2 <= (r + C * 0.71) ** 2) a[j * N + i] |= v; } };
	const rect = (x, z, w, d, ang, pad = 0, v = 1) => {
		const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.hypot(w, d) / 2 + pad;
		for (let j = Math.floor((z - R - z0) / C); j <= Math.floor((z + R - z0) / C); j++) for (let i = Math.floor((x - R - x0) / C); i <= Math.floor((x + R - x0) / C); i++) {
			if (i < 0 || j < 0 || i >= N || j >= N) continue;
			const dx = x0 + (i + 0.5) * C - x, dz = z0 + (j + 0.5) * C - z;
			if (Math.abs(dx * ca + dz * sa) <= w / 2 + pad + 1 && Math.abs(-dx * sa + dz * ca) <= d / 2 + pad + 1) a[j * N + i] |= v;
		}
	};
	const X1 = x0 + N * C, Z1 = z0 + N * C;
	const seg = (p, r, v = 1) => { for (let i = 0; i + 3 < p.length; i += 2) { if (Math.max(p[i], p[i + 2]) < x0 - r || Math.min(p[i], p[i + 2]) > X1 + r || Math.max(p[i + 1], p[i + 3]) < z0 - r || Math.min(p[i + 1], p[i + 3]) > Z1 + r) continue; const L = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), n = Math.max(1, Math.ceil(L / C)); for (let k = 0; k <= n; k++) disc(p[i] + (p[i + 2] - p[i]) * k / n, p[i + 1] + (p[i + 3] - p[i + 1]) * k / n, r, v); } };
	// free: nothing of the kinds in mask within r
	const free = (x, z, r = 0, mask = 255) => { for (let j = Math.floor((z - r - z0) / C); j <= Math.floor((z + r - z0) / C); j++) for (let i = Math.floor((x - r - x0) / C); i <= Math.floor((x + r - x0) / C); i++) { if (i < 0 || j < 0 || i >= N || j >= N) return false; if (a[j * N + i] & mask) return false; } return true; };
	return { disc, rect, seg, free, cell, a };
}
const BLD = 1, ROAD = 2, KEEP = 4;          // occupancy kinds: buildings, streets, kept clear (tracks, what is placed)

// ---------- the road cells: fire roads to the hilltops, farm roads on the section lines ----------
export function createRoadCells(C) {
	const cells = new Map();
	const H = (x, z) => C.bay.heightAt(x, z);
	const wild = (x, z) => C.bay.urbanAt(x, z).u < 0.03 && !C.real.inside(x, z);
	// a fire road down a ridge from a summit: at each step the heading that keeps highest
	// (the spine of the ridge), no sharp turns; it ends at a saddle, the valley floor or the
	// edge of town, where a gravel pull-out and a gate meet it
	function ridge(x, z, head, r) {
		const p = [x, z], step = 14;
		let h0 = H(x, z), up = 0, L = 0, ended = 'long';
		for (let k = 0; k < 190; k++) {
			let best = null;
			for (let d = -3; d <= 3; d++) {
				const a = head + d * 0.14, nx = x + Math.sin(a) * step, nz = z + Math.cos(a) * step;
				const s = H(nx, nz) + 0.6 * H(x + Math.sin(a) * step * 3, z + Math.cos(a) * step * 3) - Math.abs(d) * 1.2;
				if (!best || s > best.s) best = { s, a, nx, nz };
			}
			const h1 = H(best.nx, best.nz), grade = (h0 - h1) / step;
			if (grade < -0.02) up++; else up = 0;
			if (up > 3) { ended = 'saddle'; break; }
			if (Math.abs(grade) > 0.32 || h1 < 2 || C.wet(best.nx, best.nz)) { ended = 'steep'; break; }
			head = best.a + (r() - 0.5) * 0.06; x = best.nx; z = best.nz; h0 = h1; L += step;
			p.push(x, z);
			const U = C.bay.urbanAt(x, z).u;
			if (U > 0.08 || C.real.inside(x, z)) { ended = 'town'; break; }
			const sl = Math.abs(H(x + 30, z) - H(x - 30, z)) + Math.abs(H(x, z + 30) - H(x, z - 30));
			if (sl < 2.5 && k > 20) { ended = 'flat'; break; }
		}
		if (up > 3) p.length = Math.max(2, p.length - 8);
		return { pts: p, ended, L };
	}
	function* plan(ci, cj) {
		const out = [], r = rng(ci * 7919 + cj * 104729 + 17), x0 = ci * RC, z0 = cj * RC;
		// ---- the hilltop, if this cell has one (a real summit: higher than all round it) ----
		let top = null;
		for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) { const x = x0 + i * RC / 8, z = z0 + j * RC / 8, h = H(x, z); if (!top || h > top.h) top = { x, z, h }; }
		yield;
		if (top && top.h > 110 && wild(top.x, top.z) && hash(ci * 3 + 1, cj * 5 + 2) < 0.85) {
			for (let k = 0; k < 20; k++) {
				let b = top;
				for (let a = 0; a < 8; a++) { const x = top.x + Math.cos(a * Math.PI / 4) * 25, z = top.z + Math.sin(a * Math.PI / 4) * 25, h = H(x, z); if (h > b.h) b = { x, z, h }; }
				if (b === top) break;
				top = b;
			}
			let summit = true;
			for (let a = 0; a < 8 && summit; a++) if (H(top.x + Math.cos(a * Math.PI / 4) * 260, top.z + Math.sin(a * Math.PI / 4) * 260) > top.h - 6) summit = false;
			if (summit && wild(top.x, top.z)) {
				// the two gentlest spurs down from it, well apart
				const dirs = [];
				for (let a = 0; a < 16; a++) { const hd = a * Math.PI / 8; dirs.push({ hd, h: H(top.x + Math.sin(hd) * 300, top.z + Math.cos(hd) * 300) + H(top.x + Math.sin(hd) * 150, top.z + Math.cos(hd) * 150) }); }
				dirs.sort((p, q) => q.h - p.h);
				const pick = [dirs[0]];
				for (const d of dirs) if (pick.length < 2 && Math.abs(Math.atan2(Math.sin(d.hd - pick[0].hd), Math.cos(d.hd - pick[0].hd))) > 1.9) pick.push(d);
				for (const d of pick) {
					yield;
					const R = ridge(top.x, top.z, d.hd, r);
					if (R.L < 250) continue;
					const pts = resample(smoothLine(R.pts, 2), 3);
					const id = 'f' + ci + ',' + cj + ',' + d.hd.toFixed(2);
					out.push({ id, kind: 0, w: 3.6, pts, top: true, end: R.ended });
				}
				// a gravel turnaround on the summit
				out.push({ id: 's' + ci + ',' + cj, decal: true, kind: 1, x: top.x, z: top.z, w: 16, d: 12, a: r() * Math.PI });
			}
		}
		yield;
		// ---- farmland: section-line roads between the fields ----
		let ok = 0;
		for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
			const x = x0 + (i + 0.5) * RC / 5, z = z0 + (j + 0.5) * RC / 5, h = H(x, z);
			const sl = Math.abs(H(x + 60, z) - H(x - 60, z)) + Math.abs(H(x, z + 60) - H(x, z - 60));
			if (h > 1 && h < 260 && sl < 7 && (C.real.inside(x, z) ? C.real.landAt(x, z)?.lu === 11 : C.bay.urbanAt(x, z).u < 0.03) && !C.wet(x, z)) ok++;
		}
		if (ok >= 15) {
			const Q = 402.3;                              // a quarter mile: the fields' section lines
			for (let gj = Math.floor(z0 / Q); gj <= Math.floor((z0 + RC) / Q); gj++) for (let gi = Math.floor(x0 / Q); gi <= Math.floor((x0 + RC) / Q); gi++) {
				const nx = gi * Q, nz = gj * Q;
				if (nx < x0 || nx >= x0 + RC || nz < z0 || nz >= z0 + RC) continue;
				for (const dir of [0, 1]) {
					if (hash(gi * 2 + dir, gj * 3 + 7) > 0.42) continue;
					yield;
					const ex = nx + (dir ? 0 : Q), ez = nz + (dir ? Q : 0), raw = [];
					let run = [];
					const flush = () => { if (run.length >= 12) raw.push(run); run = []; };
					for (let s = 0; s <= Q + 0.1; s += 8) {
						const x = nx + (ex - nx) * s / Q, z = nz + (ez - nz) * s / Q, h = H(x, z);
						const sl = Math.abs(H(x + 20, z) - H(x - 20, z)) + Math.abs(H(x, z + 20) - H(x, z - 20));
						if (h > 0.8 && sl < 3.5 && C.bay.urbanAt(x, z).u < 0.05 && !C.wet(x, z) && (!C.real.inside(x, z) || C.real.landAt(x, z)?.lu === 11)) run.push(x, z);
						else flush();
					}
					flush();
					raw.forEach((q, n) => {
						const id = 'r' + gi + ',' + gj + ',' + dir + ',' + n, rr = hash(gi * 5 + dir, gj * 7 + n);
						out.push({ id, kind: 0, w: 3.4, pts: resample(q, 3), farm: true, fence: rr < 0.6 ? (rr < 0.3 ? 1 : -1) : 0, ditch: rr > 0.55 && rr < 0.85 ? (rr < 0.7 ? -1 : 1) : 0 });
					});
				}
			}
		}
		return out;
	}
	// the features of every cell a box touches, planning any not yet planned (returns null
	// while there are cells to plan; call again next frame)
	let job = null;
	function near(x0, z0, x1, z1, budget) {
		const out = [];
		const t0 = performance.now();
		for (let cj = Math.floor((z0 - 2800) / RC); cj <= Math.floor((z1 + 2800) / RC); cj++) for (let ci = Math.floor((x0 - 2800) / RC); ci <= Math.floor((x1 + 2800) / RC); ci++) {
			const k = ci + ',' + cj;
			let c = cells.get(k);
			if (!c) {
				if (!job || job.k !== k) job = { k, it: plan(ci, cj) };
				while (performance.now() - t0 < budget) { const s = job.it.next(); if (s.done) { cells.set(k, c = s.value); job = null; break; } }
				if (!c) return null;
			}
			for (const f of c) out.push(f);
		}
		return out;
	}
	return { near, reset: () => { cells.clear(); job = null; } };
}

// ---------- one tile ----------
// C: { bay, real, city, H (walked ground), wet(x, z), water(), parks(), beaches(), freeways() }
export function* planTile(C, ti, tj, roads) {
	const T = TILE, x0 = ti * T, z0 = tj * T, x1 = x0 + T, z1 = z0 + T, cx = x0 + T / 2, cz = z0 + T / 2;
	const r = rng(ti * 92821 + tj * 68917 + 3);
	const H = C.H, bay = C.bay, real = C.real;
	const inT = (x, z) => x >= x0 && x < x1 && z >= z0 && z < z1;
	const out = { ground: [], decals: [], fences: [], rails: [], props: {}, tags: [], camps: [], lines: [], cands: [] };
	const put = (type, x, z, o = {}) => {
		if (!inT(x, z)) return;
		const L = out.props[type] || (out.props[type] = []);
		const y = o.y ?? H(x, z) + (o.lift || 0);
		const s = o.s || [1, 1, 1], c = o.col || [1, 1, 1];
		L.push(x, y, z, o.yaw ?? r() * Math.PI * 2, o.pitch || 0, o.roll || 0, s[0], s[1], s[2], c[0], c[1], c[2]);
	};
	const M = 40, O = occupancy(x0 - M, z0 - M, T + 2 * M);

	// ---- the land under the tile: 20 m cells ----
	const N = 16, land = new Uint8Array(N * N), U0 = bay.urbanAt(cx, cz);
	// 0 open (wild), 1 farm, 2 built, 3 industrial, 4 park or school (kept), 5 water
	const kindAt = (x, z) => {
		if (C.wet(x, z)) return 5;
		if (real.inside(x, z)) {
			const L = real.landAt(x, z);
			if (!L) return 0;
			if (L.lu === 8) return 3;
			if (L.lu >= 2 && L.lu <= 6) return 4;
			if (L.lu === 11) return 1;
			if (L.lu === 0 || L.lu === 12) return L.road > 0.3 || L.roof > 0.3 ? 2 : 0;
			return 2;
		}
		const U = bay.urbanAt(x, z);
		if (U.u < 0.15) return 0;
		return U.s === STYLE.industry ? 3 : 2;
	};
	let nInd = 0, nBuilt = 0, nOpen = 0;
	for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
		const k = kindAt(x0 + (i + 0.5) * 20, z0 + (j + 0.5) * 20);
		land[j * N + i] = k;
		if (k === 3) nInd++; if (k === 2 || k === 3) nBuilt++; if (k === 0 || k === 1) nOpen++;
	}
	yield 'land';

	// ---- what stands here: buildings, streets, water ----
	const procUrban = !real.inside(cx, cz) && U0.u >= 0.12;
	const blds = [];
	// (the gridded buildings, only where there is industry: the yards are behind them)
	if (nInd > 0 && procUrban && C.city?.fill) {
		const L = [];
		C.city.fill(cx, cz, T * 0.72 + M, L);
		for (const o of L) if (o.h > 1.6) { blds.push(o); O.rect(o.x, o.z, o.w, o.d, o.a, 0.5, BLD); }
		yield 'fill';
	}
	const rboxes = real.inside(cx, cz) || real.inside(x0, z0) || real.inside(x1, z1) ? real.near('boxes', cx, cz, T * 0.75 + M) : [];
	for (const b of rboxes) O.rect(b.x, b.z, b.w, b.d, b.a, 0.6, BLD);
	const rroads = real.near('roads', cx, cz, T * 0.75 + M);
	let nq = 0;
	for (const q of rroads) {
		if (q.cls === 'path' || q.cls === 'track' || q.cls === 'footway') continue;
		if (q.box && (q.box[2] < x0 - M || q.box[0] > x1 + M || q.box[3] < z0 - M || q.box[1] > z1 + M)) continue;
		O.seg(q.pts, q.w / 2 + (q.walked ? 2.2 : 0.8), ROAD);
		if (++nq % 60 === 0) yield 'stand';
	}
	yield 'stand';
	// the procedural street grid: on a street or its pavement?
	const onStreet = (x, z) => {
		if (real.inside(x, z)) return false;
		const U = bay.urbanAt(x, z);
		if (U.u < 0.15) return false;
		const [BX, BZ, ST] = BLOCKS[U.s], [gx, gz] = toGrid(x, z, U.a, U.s);
		const fx = ((gx % BX) + BX) % BX, fz = ((gz % BZ) + BZ) % BZ;
		return fx < ST + 2.5 || fz < ST + 2.5 || fx > BX - 2.5 || fz > BZ - 2.5;
	};
	const clear = (x, z, rad = 1, mask = BLD | ROAD | KEEP) => O.free(x, z, rad, mask) && !onStreet(x, z) && !C.wet(x, z);
	const slopeAt = (x, z, e = 3) => Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e);

	// ---- litter: drifts along a line (a fence, a wall, a freeway's edge): clumped by the
	// wind, never even ----
	const LIT = { bag: [[0.86, 0.86, 0.84], [0.08, 0.08, 0.09], [0.32, 0.46, 0.7], [0.62, 0.5, 0.35], [0.55, 0.55, 0.55]], can: [[0.75, 0.76, 0.78], [0.7, 0.12, 0.1], [0.15, 0.3, 0.65], [0.2, 0.45, 0.2], [0.75, 0.6, 0.25]], cup: [[0.92, 0.92, 0.9], [0.75, 0.15, 0.12], [0.55, 0.42, 0.3]], paper: [[0.9, 0.9, 0.86], [0.68, 0.68, 0.64], [0.8, 0.74, 0.6]], bottle: [[0.15, 0.35, 0.15], [0.35, 0.2, 0.08], [0.7, 0.75, 0.72]] };
	const pickC = (list) => list[Math.floor(r() * list.length)];
	function drift(p, side, amount, fence = false) {
		// p: a line; side: which side the litter lies (+1 left, -1 right, 0 both)
		let s = 0;
		const ph = r() * 100;
		for (let i = 0; i + 3 < p.length; i += 2) {
			const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L = Math.hypot(dx, dz);
			if (L < 0.01) continue;
			const nx = -dz / L, nz = dx / L;
			for (let t = 0; t < L; t += 1.1) {
				const k = Math.pow(vnoise((s + t) / 11 + ph), 4) * 4 + Math.pow(vnoise((s + t) / 37 + ph * 2), 6) * 3;
				if (r() > k * amount * 0.12) continue;
				const sd = side || (r() < 0.5 ? 1 : -1), off = sd * (0.12 + Math.pow(r(), 2) * 1.6), x = ax + dx * t / L + nx * off, z = az + dz * t / L + nz * off;
				if (!inT(x, z) || C.wet(x, z)) continue;
				const u = r(), yaw = r() * 6.283;
				if (fence && u < 0.2) put('snag', ax + dx * t / L + nx * sd * 0.06, az + dz * t / L + nz * sd * 0.06, { lift: 0.2 + r() * 1.3, yaw: Math.atan2(nx, nz) + (sd < 0 ? Math.PI : 0), pitch: (r() - 0.5) * 0.3, col: pickC(LIT.bag), s: [0.8 + r() * 0.6, 0.8 + r() * 0.5, 1] });
				else if (u < 0.45) put('bag', x, z, { yaw, col: pickC(LIT.bag), s: [0.7 + r() * 0.7, 0.6 + r() * 0.8, 0.7 + r() * 0.6], roll: (r() - 0.5) * 0.4 });
				else if (u < 0.62) put('can', x, z, { yaw, col: pickC(LIT.can) });
				else if (u < 0.76) put('cup', x, z, { yaw, col: pickC(LIT.cup) });
				else if (u < 0.92) put('paper', x, z, { yaw, col: pickC(LIT.paper), pitch: (r() - 0.5) * 0.2 });
				else put('bottle', x, z, { yaw, col: pickC(LIT.bottle) });
			}
			s += L;
		}
	}
	// weeds along a line (a fence's foot, a wall's, the cracks), dry grass in a patch
	const WEED = (dry) => [dry, 0.8 + r() * 0.4, 0];
	function weedsAlong(p, side, dens, h = 0.6, dry = 0.3) {
		for (let i = 0; i + 3 < p.length; i += 2) {
			const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L = Math.hypot(dx, dz);
			if (L < 0.01) continue;
			const nx = -dz / L, nz = dx / L;
			for (let t = r() * 1.5; t < L; t += 0.7 + r() * 1.8 / dens) {
				if (r() > dens) continue;
				const sd = side || (r() < 0.5 ? 1 : -1), off = sd * (0.1 + r() * 0.5);
				const x = ax + dx * t / L + nx * off, z = az + dz * t / L + nz * off;
				if (C.wet(x, z)) continue;
				const hh = h * (0.5 + r() * 0.9);
				put('weed', x, z, { s: [hh * (0.8 + r() * 0.5), hh, hh * (0.8 + r() * 0.5)], col: WEED(clamp(dry + (r() - 0.5) * 0.4, 0, 1)), lift: -0.03 });
			}
		}
	}
	function tuftPatch(x, z, rad, n, h = 0.7, dry = 0.7) {
		for (let k = 0; k < n; k++) {
			const a = r() * 6.283, d = Math.sqrt(r()) * rad, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
			if (!clear(px, pz, 0) || !inT(px, pz)) continue;
			const hh = h * (0.5 + r() * 0.8);
			put('weed', px, pz, { s: [hh, hh, hh], col: WEED(clamp(dry + (r() - 0.5) * 0.3, 0, 1)), lift: -0.03 });
		}
	}
	// a fence: chain link on galvanised posts with a top rail, slats woven through some,
	// broken open now and then; litter against it and weeds along its foot
	function fence(p, { h = 1.9, slats = r() < 0.35, gap = r() < 0.4, litter = 1, weeds = 0.5, barbed = r() < 0.3 } = {}) {
		// only the runs that stand clear of buildings and streets
		const runs = [];
		let cur = [];
		for (let i = 0; i < p.length; i += 2) {
			const ok = O.free(p[i], p[i + 1], 0.5, BLD | ROAD) && !onStreet(p[i], p[i + 1]) && !C.wet(p[i], p[i + 1]);
			if (ok) cur.push(p[i], p[i + 1]);
			else { if (cur.length >= 6) runs.push(cur); cur = []; }
		}
		if (cur.length >= 6) runs.push(cur);
		for (let run of runs) {
			if (gap && run.length > 16) { const k = 2 * Math.floor(run.length / 4 + r() * run.length / 8); runs.push(run.slice(k + 4)); run = run.slice(0, k); }
			if (run.length < 4) continue;
			out.fences.push({ pts: run, h, slats: slats ? Math.floor(r() * 3) + 1 : 0, barbed });
			O.seg(run, 0.8, KEEP);
			if (litter) drift(run, 0, litter, true);
			if (weeds) weedsAlong(run, 0, weeds, 0.55, 0.35);
		}
	}
	// a ground patch (edgelands.js drapes it): kind 1 gravel, 3 bare dirt, 6 cracked asphalt, 7 dry grass
	const decal = (x, z, w, d, a, kind) => { if (inT(x, z)) out.decals.push({ x, z, w, d, a, kind }); };
	// a ribbon along a line, cut to this tile by its segments' middles (so a line split between
	// tiles meets itself exactly)
	function ribbon(id, pts, w, kind, o = {}) { out.ground.push({ id, pts, w, kind, ...o }); }

	// ---- 1. the road cells' tracks: fire roads and farm roads ----
	for (const f of roads || []) {
		if (f.decal) { decal(f.x, f.z, f.w, f.d, f.a, f.kind); continue; }
		const p = f.pts;
		let touch = false;
		for (let i = 0; i < p.length && !touch; i += 2) if (p[i] > x0 - 20 && p[i] < x1 + 20 && p[i + 1] > z0 - 20 && p[i + 1] < z1 + 20) touch = true;
		if (!touch) continue;
		ribbon(f.id, p, f.w, 0, { puddles: true });
		O.seg(p, f.w / 2 + 0.5, KEEP);
		if (f.fence) {
			const fp = offsetLine(p, f.fence * (f.w / 2 + 1.4)), wp = resample(fp, 4);
			out.lines.push({ pts: wp, kind: 'wire' });
			for (let i = 0; i < wp.length; i += 2) put('post', wp[i], wp[i + 1], { yaw: 0, s: [0.06, 1.25, 0.06], col: [0.36, 0.28, 0.2], lift: -0.1 });
			weedsAlong(fp, 0, 0.35, 0.7, 0.75);
		}
		if (f.ditch) {
			const dp = offsetLine(p, f.ditch * (f.w / 2 + 2.6));
			ribbon(f.id + 'd', dp, 2.2, 5);
			weedsAlong(offsetLine(dp, 0.9), 0, 0.5, 1.1, 0.25);
			weedsAlong(offsetLine(dp, -0.9), 0, 0.5, 1.1, 0.25);
		}
		// where a fire road leaves the road at the bottom: a gravel pull-out and a gate
		if (f.top && (f.end === 'town' || f.end === 'flat')) {
			const n = p.length, ex = p[n - 2], ez = p[n - 1], dx = p[n - 2] - p[n - 8], dz = p[n - 1] - p[n - 7], L = Math.hypot(dx, dz) || 1;
			decal(ex, ez, 14, 9, Math.atan2(dz, dx), 1);
			const gx = p[n - 14], gz = p[n - 13];
			if (inT(gx, gz)) put('gate', gx, gz, { yaw: Math.atan2(dx / L, dz / L), col: [1, 1, 1] });
		}
	}
	yield 'tracks';

	// ---- 2. the real map's own: dirt tracks worn into ruts; rural roads' shoulders and pull-outs ----
	for (const q of rroads) {
		if (q.cls === 'track') { ribbon('t' + q.pts[0].toFixed(1) + ',' + q.pts[1].toFixed(1), q.rs || (q.rs = resample(q.pts, 3)), Math.max(3, q.w), 0, { puddles: true }); continue; }
		if (!q.drive || q.bridge || q.cls === 'motorway' || q.cls === 'service' || q.cls === 'residential' || q.cls === 'living_street') continue;
		const k = Math.floor(q.pts.length / 4) * 2, L = real.landAt(q.pts[k], q.pts[k + 1]);
		if (!L || !(L.lu === 0 || L.lu === 11 || L.lu === 12) || L.roof > 0.15 || bay.urbanAt(q.pts[k], q.pts[k + 1]).u > 0.2) continue;
		const rs = q.rs || (q.rs = resample(q.pts, 3));
		for (const sd of [-1, 1]) ribbon('h' + sd + q.pts[0].toFixed(1) + ',' + q.pts[1].toFixed(1), offsetLine(rs, sd * (q.w / 2 + 0.9)), 1.8, 3);
		// a gravel pull-out every so often, on the outside of the road
		for (let i = 20; i + 20 < rs.length; i += 2) {
			if (hash(rs[i] * 0.37, rs[i + 1] * 0.21) > 0.006) continue;
			const dx = rs[i + 2] - rs[i - 2], dz = rs[i + 3] - rs[i - 1], sd = hash(rs[i], 5) < 0.5 ? 1 : -1, l = Math.hypot(dx, dz) || 1;
			const px = rs[i] - dz / l * sd * (q.w / 2 + 3.5), pz = rs[i + 1] + dx / l * sd * (q.w / 2 + 3.5);
			if (slopeAt(px, pz, 6) < 0.12 && O.free(px, pz, 3, BLD)) decal(px, pz, 20, 6, Math.atan2(dz, dx), 1);
		}
	}
	yield 'real';

	// ---- 3. rivers and flood channels: levee tracks, and in town a worn path along the bank ----
	const W = C.water();
	const banks = [];
	if (W?.streamNear && W.ready?.()) {
		const seen = [];
		for (const [sx, sz] of [[cx, cz], [x0 + 80, z0 + 80], [x1 - 80, z0 + 80], [x0 + 80, z1 - 80], [x1 - 80, z1 - 80]]) {
			const s = W.streamNear(sx, sz, 240);
			if (!s || s.w < 4 || seen.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < 60)) continue;
			seen.push(s);
			// follow it both ways through the tile
			const line = [];
			for (const dir of [1, -1]) {
				let x = s.x, z = s.z, ux = s.ux * dir, uz = s.uz * dir;
				const part = [];
				for (let k = 0; k < 60; k++) {
					const q = W.streamNear(x + ux * 12, z + uz * 12, 30);
					if (!q) break;
					const d = q.ux * ux + q.uz * uz < 0 ? -1 : 1;
					ux = q.ux * d; uz = q.uz * d; x = q.x; z = q.z;
					part.push(x, z, q.w);
					if (k % 20 === 19) yield 'trace';
					if (x < x0 - 30 || x > x1 + 30 || z < z0 - 30 || z > z1 + 30) break;
				}
				if (dir > 0) line.push(...part); else { for (let i = part.length - 3; i >= 0; i -= 3) line.unshift(part[i], part[i + 1], part[i + 2]); }
			}
			if (line.length < 18) continue;
			const cl = [], wd = [];
			for (let i = 0; i < line.length; i += 3) { cl.push(line[i], line[i + 1]); wd.push(line[i + 2]); }
			const wm = wd.reduce((a, b) => a + b, 0) / wd.length;
			const name = W.nameAt?.(s.x, s.z), flood = name?.kind === 'Flood channel';
			banks.push({ cl: smoothLine(cl, 1), w: wm, flood, town: land[Math.floor(clamp((s.z - z0) / 20, 0, N - 1)) * N + Math.floor(clamp((s.x - x0) / 20, 0, N - 1))] >= 2 });
			yield 'river';
		}
	}
	for (const B of banks) {
		const low = H(B.cl[0], B.cl[1]) < 30;
		// the side the track keeps to: the one facing south-east, the same all along
		const i0 = Math.floor(B.cl.length / 4) * 2, dx = B.cl[i0 + 2] - B.cl[i0], dz = B.cl[i0 + 3] - B.cl[i0 + 1], sd = (-dz + dx * 0.4) > 0 ? 1 : -1;
		if ((low && B.w > 5) || B.flood) {
			const tp = resample(offsetLine(B.cl, sd * (B.w / 2 + 5.5)), 3);
			// only where it stays dry and clear
			const runs = []; let cur = [];
			for (let i = 0; i < tp.length; i += 2) { if (clear(tp[i], tp[i + 1], 1.5)) cur.push(tp[i], tp[i + 1]); else { if (cur.length > 20) runs.push(cur); cur = []; } }
			if (cur.length > 20) runs.push(cur);
			runs.forEach((q, n) => { ribbon('l' + q[0].toFixed(0) + ',' + q[1].toFixed(0) + n, q, 4, 1, { puddles: true }); O.seg(q, 2.5, KEEP); });
			if (B.town || B.flood) for (const q of runs) fence(resample(offsetLine(q, -sd * 3), 3), { h: 1.8, slats: false, litter: 0.7, weeds: 0.6 });
			else for (const q of runs) weedsAlong(offsetLine(q, sd * 2.6), 0, 0.5, 0.8, 0.6);
		}
		if (B.town) {
			// a path worn along the bank, and the camp sites on it
			const bp = resample(offsetLine(B.cl, -sd * (B.w / 2 + 3.5)), 3), ok = [];
			for (let i = 0; i < bp.length; i += 2) ok.push(clear(bp[i], bp[i + 1], 1) && slopeAt(bp[i], bp[i + 1]) < 0.4);
			let cur = [];
			for (let i = 0; i < bp.length; i += 2) { if (ok[i / 2]) cur.push(bp[i], bp[i + 1]); else { if (cur.length > 16) { ribbon('b' + cur[0].toFixed(0) + ',' + cur[1].toFixed(0), cur, 1.1, 2); drift(cur, 0, 0.3); } cur = []; } }
			if (cur.length > 16) { ribbon('b' + cur[0].toFixed(0) + ',' + cur[1].toFixed(0), cur, 1.1, 2); drift(cur, 0, 0.3); }
			for (let i = 8; i + 8 < bp.length; i += 16) if (ok[i / 2] && inT(bp[i], bp[i + 1])) {
				const dx2 = bp[i + 2] - bp[i - 2], dz2 = bp[i + 3] - bp[i - 1];
				out.cands.push({ x: bp[i], z: bp[i + 1], yaw: Math.atan2(dx2, dz2), w: 2, why: 'creek', back: -sd });
			}
		}
	}
	yield 'banks';

	// ---- 4. industry: back yards behind the warehouses ----
	const PAL = {
		cont: [[0.55, 0.2, 0.14], [0.18, 0.33, 0.52], [0.2, 0.38, 0.28], [0.58, 0.58, 0.56], [0.62, 0.52, 0.36], [0.74, 0.71, 0.66], [0.45, 0.18, 0.3], [0.7, 0.42, 0.16]],
		drum: [[0.2, 0.3, 0.55], [0.55, 0.15, 0.12], [0.12, 0.12, 0.12], [0.45, 0.28, 0.16], [0.3, 0.4, 0.25], [0.7, 0.62, 0.2]],
		dump: [[0.14, 0.3, 0.18], [0.12, 0.2, 0.35], [0.35, 0.25, 0.15], [0.36, 0.36, 0.36]],
	};
	const tag = (x, z, yaw, w, h, y0) => { if (inT(x, z)) out.tags.push({ x, y: y0, z, yaw, w, h, t: Math.floor(r() * 8) }); };
	// dress the yard behind a wall: c the wall's middle, (nx, nz) out from it, len along it
	function* backYard(bx, bz, nx, nz, len, wallH, why) {
		const tx = -nz, tz = nx;          // along the wall
		// how deep the yard is before a street, a building or the tile's edge
		let depth = 0;
		for (let d = 3; d <= 31; d += 2) { const x = bx + nx * d, z = bz + nz * d; if (!O.free(x, z, 0.5, BLD | ROAD | KEEP) || onStreet(x, z) || C.wet(x, z)) break; depth = d; }
		if (depth < 4) return;
		const g = H(bx, bz);
		// the tags, low on the wall where a person can reach
		const nt = 1 + Math.floor(r() * (len > 40 ? 4 : 2));
		for (let k = 0; k < nt; k++) { const a = (r() - 0.5) * (len - 6), w = 2.4 + r() * 2.6; tag(bx + tx * a + nx * 0.04, bz + tz * a + nz * 0.04, Math.atan2(nx, nz), w, w * (0.45 + r() * 0.2), g + 0.35 + r() * 0.5); }
		weedsAlong([bx - tx * len / 2 + nx * 0.3, bz - tz * len / 2 + nz * 0.3, bx + tx * len / 2 + nx * 0.3, bz + tz * len / 2 + nz * 0.3], 0, 0.6, 0.5, 0.3);
		drift([bx - tx * len / 2 + nx * 0.4, bz - tz * len / 2 + nz * 0.4, bx + tx * len / 2 + nx * 0.4, bz + tz * len / 2 + nz * 0.4], 1, 0.35);
		decal(bx + nx * depth / 2, bz + nz * depth / 2, len, depth, Math.atan2(tz, tx), 6);
		yield 'yard';
		// against the wall: a dumpster, pallets stacked, drums, a heap of tyres
		const slots = [];
		for (let a = -len / 2 + 3; a < len / 2 - 3; a += 3 + r() * 3) slots.push(a);
		for (const a of slots) {
			const u = r(), x = bx + tx * a + nx * 1.6, z = bz + tz * a + nz * 1.6, yaw = Math.atan2(tx, tz);
			if (r() < 0.5 || !O.free(x + nx * 1.2, z + nz * 1.2, 0.6, ROAD | KEEP) || onStreet(x, z)) continue;
			if (u < 0.12) { put('dumpster', x + nx * 0.3, z + nz * 0.3, { yaw: Math.atan2(-nx, -nz), col: pickC(PAL.dump) }); O.disc(x, z, 1.2, KEEP); }
			else if (u < 0.3) { const n = 2 + Math.floor(r() * 7); for (let k = 0; k < n; k++) put('pallet', x, z, { yaw: yaw + (r() - 0.5) * 0.15, lift: k * 0.145 }); if (r() < 0.4) put('pallet', x + tx * 1.4, z + tz * 1.4, { yaw: yaw + 0.3, pitch: -1.35, lift: 0.5 }); O.disc(x, z, 1, KEEP); }
			else if (u < 0.45) { const n = 2 + Math.floor(r() * 5), col = pickC(PAL.drum); for (let k = 0; k < n; k++) { const q = k % 3, rr = Math.floor(k / 3); const px = x + tx * (q - 1) * 0.62 + nx * rr * 0.62, pz = z + tz * (q - 1) * 0.62 + nz * rr * 0.62; if (r() < 0.15) put('drum', px + nx * 0.8, pz + nz * 0.8, { yaw: r() * 6, roll: Math.PI / 2, lift: 0.29, col: r() < 0.6 ? col : pickC(PAL.drum) }); else put('drum', px, pz, { col: r() < 0.7 ? col : pickC(PAL.drum) }); } O.disc(x, z, 1.4, KEEP); }
			else if (u < 0.58) { const n = 3 + Math.floor(r() * 6); for (let k = 0; k < n; k++) put('tyre', x + (r() - 0.5) * 0.4, z + (r() - 0.5) * 0.4, { lift: k * 0.2, pitch: (r() - 0.5) * 0.15 }); if (r() < 0.5) put('tyre', x + tx * 1.2, z + tz * 1.2, { pitch: Math.PI / 2 - 0.2, lift: 0.28, yaw }); O.disc(x, z, 1, KEEP); }
			else if (u < 0.6 && why !== 'real' && r() < 0.3) { const cy = r() * 6.28; put('cart', x, z, { yaw: cy }); put('cartWire', x, z, { yaw: cy }); }
		}
		yield 'yard';
		// out in the yard: shipping containers along it, one on another now and then
		if (depth > 9) {
			let a = -len / 2 + 2 + r() * 4;
			while (a < len / 2 - 6) {
				const big = r() < 0.5, L = big ? 12.19 : 6.06, d0 = 3 + r() * Math.min(4, depth - 8);
				const x = bx + tx * (a + L / 2) + nx * (d0 + 1.22), z = bz + tz * (a + L / 2) + nz * (d0 + 1.22), yaw = Math.atan2(nx, nz);
				if (a + L < len / 2 && r() < 0.7 && O.free(x, z, 1.5, BLD | ROAD | KEEP) && O.free(x + tx * L * 0.45, z + tz * L * 0.45, 1, BLD | ROAD | KEEP) && O.free(x - tx * L * 0.45, z - tz * L * 0.45, 1, BLD | ROAD | KEEP)) {
					const gy = Math.min(H(x + tx * L / 2, z + tz * L / 2), H(x - tx * L / 2, z - tz * L / 2), H(x, z)) - 0.05;
					put(big ? 'cont40' : 'cont20', x, z, { yaw: yaw + (r() - 0.5) * 0.04, y: gy, col: pickC(PAL.cont) });
					if (r() < 0.3) put(big ? 'cont40' : 'cont20', x + (r() - 0.5) * 0.3, z, { yaw: yaw + (r() - 0.5) * 0.05, y: gy + 2.59, col: pickC(PAL.cont) });
					O.rect(x, z, L, 2.44, Math.atan2(tz, tx), 0.4, KEEP);
					drift([x - tx * L / 2 - nx * 1.4, z - tz * L / 2 - nz * 1.4, x + tx * L / 2 - nx * 1.4, z + tz * L / 2 - nz * 1.4], 1, 0.25);
				}
				a += L + 1 + r() * 5;
			}
		}
		// the fence at the yard's far side
		if (depth > 7 && r() < 0.8) fence(resample([bx - tx * (len / 2 + 4) + nx * (depth - 1), bz - tz * (len / 2 + 4) + nz * (depth - 1), bx + tx * (len / 2 + 4) + nx * (depth - 1), bz + tz * (len / 2 + 4) + nz * (depth - 1)], 3), { litter: 1.2 });
		if (depth > 6 && why !== 'rail') out.cands.push({ x: bx + nx * Math.min(depth - 3, 6) + tx * (r() - 0.5) * len * 0.6, z: bz + nz * Math.min(depth - 3, 6) + tz * (r() - 0.5) * len * 0.6, yaw: Math.atan2(nx, nz), w: 1, why: 'industrial', back: 0 });
	}
	// the warehouses of the gridded industrial flats (city.js), their backs to the block's
	// back street; a rail spur runs down some rows of blocks behind them
	const railRows = new Map(), yards = [];
	for (const o of blds) {
		if (o.kind !== 5 || o.h < 5 || o.w * o.d < 400) continue;
		const ca = Math.cos(o.a), sa = Math.sin(o.a), nx = sa, nz = -ca;           // the back: local -z
		const bx = o.x + nx * o.d / 2, bz = o.z + nz * o.d / 2;
		if (!inT(bx, bz)) continue;
		const U = bay.urbanAt(o.x, o.z);
		if (U.s === STYLE.industry) {
			const [, gz] = toGrid(o.x, o.z, U.a, U.s), BZ = BLOCKS[U.s][1], ST = BLOCKS[U.s][2], j = Math.floor(gz / BZ);
			if (hash(j * 13 + 5, Math.round(U.a * 1000)) < 0.4) railRows.set(j + ':' + U.a.toFixed(4), { j, a: U.a, s: U.s, gz: j * BZ + ST + 2.5 + 5 });
		}
		if (r() < 0.8) yards.push([bx, bz, nx, nz, o.w, o.h]);
	}
	for (const R of railRows.values()) {
		// the spur: the grid row's back edge, across the tile (and over the streets, at grade)
		const [g0] = toGrid(x0 - 40, z0 - 40, R.a, R.s), [g1] = toGrid(x1 + 40, z1 + 40, R.a, R.s), [g2] = toGrid(x1 + 40, z0 - 40, R.a, R.s), [g3] = toGrid(x0 - 40, z1 + 40, R.a, R.s);
		const ga = Math.min(g0, g1, g2, g3), gb = Math.max(g0, g1, g2, g3), pts = [];
		for (let gx = Math.floor(ga / 3) * 3; gx <= gb; gx += 3) { const [x, z] = fromGrid(gx, R.gz, R.a, R.s); pts.push(x, z); }
		const runs = []; let cur = [];
		for (let i = 0; i < pts.length; i += 2) { if (O.free(pts[i], pts[i + 1], 1.6, BLD) && !C.wet(pts[i], pts[i + 1])) cur.push(pts[i], pts[i + 1]); else { if (cur.length > 12) runs.push(cur); cur = []; } }
		if (cur.length > 12) runs.push(cur);
		for (const q of runs) {
			out.rails.push({ id: 'rr' + R.j + ':' + R.a.toFixed(3) + ':' + q[0].toFixed(0), pts: q });
			O.seg(q, 2.2, KEEP);
			weedsAlong(offsetLine(q, 1.9), 0, 0.5, 0.6, 0.55); weedsAlong(offsetLine(q, -1.9), 0, 0.5, 0.6, 0.55);
			drift(offsetLine(q, 2.4), 0, 0.35);
			// (the camps keep to the yard side of the tracks, away from the street)
			const sa = Math.sin(R.a), ca = Math.cos(R.a);
			for (let i = 20; i + 20 < q.length; i += 30) if (inT(q[i], q[i + 1])) out.cands.push({ x: q[i] - sa * 7, z: q[i + 1] + ca * 7, yaw: Math.atan2(q[i + 2] - q[i - 2], q[i + 3] - q[i - 1]), w: 1.4, why: 'rail', back: 0 });
		}
	}
	for (const [bx, bz, nx, nz, w, h] of yards) { yield* backYard(bx, bz, nx, nz, w, h, 'proc'); yield 'yard'; }
	// the mapped industrial buildings (and a generated town's industrial edge): the side away
	// from the street they face is the back
	for (const b of rboxes) {
		if (!(b.kind === 9 || (b.w * b.d > 900 && real.landAt(b.x, b.z)?.lu === 8))) continue;
		const ca = Math.cos(b.a), sa = Math.sin(b.a);
		let best = null;
		for (const [lx, lz, len] of [[0, 1, b.w], [0, -1, b.w], [1, 0, b.d], [-1, 0, b.d]]) {
			const nx = ca * lx - sa * lz, nz = sa * lx + ca * lz, half = lx ? b.w / 2 : b.d / 2;
			const px = b.x + nx * (half + 12), pz = b.z + nz * (half + 12);
			// how near a street is on this side
			let dRoad = 1e9;
			for (const q of rroads) { if (!q.drive) continue; const p = q.pts; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l2 = dx * dx + dz * dz || 1, t = clamp(((px - p[i]) * dx + (pz - p[i + 1]) * dz) / l2, 0, 1); dRoad = Math.min(dRoad, Math.hypot(p[i] + dx * t - px, p[i + 1] + dz * t - pz)); } }
			if (!best || dRoad > best.dRoad) best = { nx, nz, len, half, dRoad };
		}
		const bx = b.x + best.nx * best.half, bz = b.z + best.nz * best.half;
		if (inT(bx, bz) && r() < 0.85) yield* backYard(bx, bz, best.nx, best.nz, best.len, b.wallH, 'real');
		yield 'ryard';
	}

	// ---- 5. the freeways' margins: a fence, a weedy dirt strip, litter blown against it ----
	// (the gridded margins only through industry, where the buildings are known)
	const urbanish = (x, z) => { const k = land[Math.floor(clamp((z - z0) / 20, 0, N - 1)) * N + Math.floor(clamp((x - x0) / 20, 0, N - 1))]; return k === 3; };
	for (const fl of freewayLines()) {
		let touch = false;
		for (let i = 0; i < fl.length && !touch; i += 2) if (fl[i] > x0 - 60 && fl[i] < x1 + 60 && fl[i + 1] > z0 - 60 && fl[i + 1] < z1 + 60) touch = true;
		if (!touch) continue;
		// the stretch round this tile, outside the mapped regions
		const seg = [];
		for (let i = 0; i < fl.length; i += 2) if (fl[i] > x0 - 80 && fl[i] < x1 + 80 && fl[i + 1] > z0 - 80 && fl[i + 1] < z1 + 80 && !inRealW(fl[i], fl[i + 1])) seg.push(fl[i], fl[i + 1]);
		if (seg.length < 4) continue;
		const cl = resample(seg, 3);
		O.seg(cl, 17.5, ROAD);
		for (const sd of [-1, 1]) {
			const sh = offsetLine(cl, sd * 20.5), fp = offsetLine(cl, sd * 25.5), ok = [];
			for (let i = 0; i < sh.length; i += 2) ok.push(urbanish(sh[i], sh[i + 1]) && O.free(sh[i], sh[i + 1], 2, BLD) && !C.wet(sh[i], sh[i + 1]));
			let cur = [], fc = [];
			const flush = () => {
				if (cur.length > 20) {
					ribbon('m' + sd + cur[0].toFixed(0) + ',' + cur[1].toFixed(0), cur, 6.5, 3);
					drift(offsetLine(cur, sd * 1.5), 0, 0.5);
					fence(fc, { h: 1.8, slats: r() < 0.15, litter: 1.3, weeds: 0.7 });
					for (let i = 10; i + 10 < cur.length; i += 40) if (inT(cur[i], cur[i + 1])) out.cands.push({ x: cur[i] + (fc[i] - cur[i]) * 0.35, z: cur[i + 1] + (fc[i + 1] - cur[i + 1]) * 0.35, yaw: Math.atan2(cur[i + 2] - cur[i - 2], cur[i + 3] - cur[i - 1]), w: 1.3, why: 'freeway', back: sd });
				}
				cur = []; fc = [];
			};
			for (let i = 0; i < sh.length; i += 2) { if (ok[i / 2]) { cur.push(sh[i], sh[i + 1]); fc.push(fp[i], fp[i + 1]); } else flush(); }
			flush();
		}
	}
	// the mapped freeways through town: weeds and litter along the barrier's foot
	for (const q of rroads) {
		if (q.cls !== 'motorway' || q.bridge || q.link) continue;
		const rs = q.rs || (q.rs = resample(q.pts, 3));
		let touch = false;
		for (let i = 0; i < rs.length && !touch; i += 2) if (inT(rs[i], rs[i + 1])) touch = true;
		if (!touch) continue;
		const k = Math.floor(rs.length / 4) * 2, L = real.landAt(rs[k], rs[k + 1]);
		if (!L || L.lu === 0 || L.lu === 11 || L.lu === 12) continue;
		const vp = offsetLine(rs, -(q.w / 2 + 1.8));
		ribbon('v' + rs[0].toFixed(0) + ',' + rs[1].toFixed(0), vp, 2.4, 3);
		drift(offsetLine(rs, -(q.w / 2 + 2.9)), 0, 0.45);
		weedsAlong(offsetLine(rs, -(q.w / 2 + 3)), 0, 0.4, 0.6, 0.5);
	}
	yield 'freeways';

	const hits = new Map();
	// ---- 6. under the overpasses: bare dust where no rain falls, litter, the odd camp ----
	for (const b of rroads) {
		if (!b.bridge || !b.drive || /golden gate/i.test(b.name || '')) continue;
		const bp = b.rs || (b.rs = resample(b.pts, 3));
		let touch = false;
		for (let i = 0; i < bp.length && !touch; i += 2) if (inT(bp[i], bp[i + 1])) touch = true;
		if (!touch) continue;
		yield 'bridge';
		for (const q of rroads) {
			if (q === b || !q.drive || q.bridge || q.w < 9 || (hits.get(b) || 0) >= 2 || (q.box && b.box && (q.box[0] > b.box[2] + 5 || q.box[2] < b.box[0] - 5 || q.box[1] > b.box[3] + 5 || q.box[3] < b.box[1] - 5))) continue;
			// where the lane passes under it
			let hit = null;
			for (let i = 0; i + 3 < bp.length && !hit; i += 2) {
				const p = q.pts;
				for (let k = 0; k + 3 < p.length; k += 2) {
					const ax = bp[i], az = bp[i + 1], bx = bp[i + 2], bz = bp[i + 3], cx2 = p[k], cz2 = p[k + 1], dx2 = p[k + 2], dz2 = p[k + 3];
					const d = (bx - ax) * (dz2 - cz2) - (bz - az) * (dx2 - cx2);
					if (Math.abs(d) < 1e-9) continue;
					const t = ((cx2 - ax) * (dz2 - cz2) - (cz2 - az) * (dx2 - cx2)) / d, u = ((cx2 - ax) * (bz - az) - (cz2 - az) * (bx - ax)) / d;
					if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { hit = { i, x: ax + (bx - ax) * t, z: az + (bz - az) * t, q }; break; }
				}
			}
			if (!hit) continue;
			hits.set(b, (hits.get(b) || 0) + 1);
			// either side of the lane below, under the deck: the embankment
			for (const sd of [-1, 1]) {
				const pts = [];
				for (let s = q.w / 2 + 2.5; s < q.w / 2 + 16; s += 3) { const k = clamp(hit.i + sd * Math.round(s / 3) * 2, 0, bp.length - 2); pts.push(bp[k], bp[k + 1]); }
				if (pts.length < 4) continue;
				const mid = pts.length / 2 | 0, mx = pts[mid - (mid % 2)], mz = pts[mid - (mid % 2) + 1];
				if (C.wet(mx, mz) || !O.free(mx, mz, 1, BLD)) continue;
				ribbon('u' + sd + mx.toFixed(0) + ',' + mz.toFixed(0), pts, b.w + 2, 3);
				drift(offsetLine(pts, b.w / 2 - 0.5), 0, 0.8);
				drift(offsetLine(pts, -b.w / 2 + 0.5), 0, 0.8);
				tuftPatch(mx, mz, b.w * 0.6, 6, 0.5, 0.8);
				if (inT(mx, mz)) out.cands.push({ x: mx, z: mz, yaw: Math.atan2(pts[2] - pts[0], pts[3] - pts[1]), w: 3, why: 'overpass', back: 0, under: true });
			}
		}
	}
	yield 'overpass';

	// ---- 7. where town gives out to open land: weedy verges, a lot gone to dry grass with a
	// path worn across it, a drainage ditch ----
	if (nBuilt > 6 && nOpen > 12) {
		const edge = [];
		for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
			const k = land[j * N + i];
			if (k !== 0 && k !== 1) continue;
			let b = 0;
			for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = land[(j + dj) * N + i + di]; if (q === 2 || q === 3) b++; }
			if (b) edge.push([x0 + (i + 0.5) * 20, z0 + (j + 0.5) * 20]);
		}
		for (const [ex, ez] of edge) if (r() < 0.7) tuftPatch(ex + (r() - 0.5) * 10, ez + (r() - 0.5) * 10, 8, 10 + Math.floor(r() * 12), 0.75, 0.75);
		if (edge.length > 4) {
			// the edge's line (its principal axis) and which way the open land lies
			let mx = 0, mz = 0;
			for (const [x, z] of edge) { mx += x; mz += z; }
			mx /= edge.length; mz /= edge.length;
			let sxx = 0, sxz = 0, szz = 0;
			for (const [x, z] of edge) { sxx += (x - mx) ** 2; sxz += (x - mx) * (z - mz); szz += (z - mz) ** 2; }
			const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang);
			let ox = 0, oz = 0;
			for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = land[j * N + i]; if (k === 0 || k === 1) { ox += x0 + (i + 0.5) * 20 - mx; oz += z0 + (j + 0.5) * 20 - mz; } }
			let nx = -uz, nz = ux;
			if (nx * ox + nz * oz < 0) { nx = -nx; nz = -nz; }
			// an abandoned lot, gone to dry grass, a path worn across it
			const lx = mx + nx * 22, lz = mz + nz * 22;
			if (r() < 0.75 && clear(lx, lz, 6) && slopeAt(lx, lz, 10) < 0.12) {
				const w = 26 + r() * 22, d = 18 + r() * 12;
				decal(lx, lz, w, d, ang, 7);
				tuftPatch(lx, lz, Math.min(w, d) * 0.55, 160, 0.9, 0.9);
				const p = [], a0 = r() * 6.283, a1 = a0 + Math.PI + (r() - 0.5);
				const sx = lx + Math.cos(a0) * w * 0.55, sz = lz + Math.sin(a0) * d * 0.55, fx = lx + Math.cos(a1) * w * 0.55, fz = lz + Math.sin(a1) * d * 0.55;
				for (let t = 0; t <= 1.001; t += 0.1) p.push(sx + (fx - sx) * t + Math.sin(t * Math.PI * 2 + a0) * 2.2, sz + (fz - sz) * t + Math.cos(t * Math.PI * 1.5) * 2.2);
				ribbon('p' + ti + ',' + tj, resample(smoothLine(p, 2), 2), 0.9, 2);
				drift(resample(p, 3), 0, 0.2);
				// a line of K-rail along the side toward town, left from some job
				if (r() < 0.5) for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { const a = (k - 1) * 3.1, jx = lx - nx * (d / 2 + 1) + ux * a, jz = lz - nz * (d / 2 + 1) + uz * a; if (clear(jx, jz, 1.5)) put('jersey', jx, jz, { yaw: Math.atan2(nx, nz) + (r() - 0.5) * 0.08, col: [1, 1, 1] }); }
				out.cands.push({ x: lx + ux * w * 0.3, z: lz + uz * w * 0.3, yaw: ang, w: 0.6, why: 'lot', back: 0 });
			}
			// a drainage ditch along the edge, into the open side, with the reeds in it
			if (r() < 0.6) {
				const L = 60 + r() * 120, dp = [];
				for (let t = -L / 2; t <= L / 2; t += 3) { const x = mx + nx * 8 + ux * t, z = mz + nz * 8 + uz * t; if (clear(x, z, 2)) dp.push(x, z); else if (dp.length) break; }
				if (dp.length > 12) {
					ribbon('d' + ti + ',' + tj, dp, 2.4, 5);
					for (const s2 of [-1.1, 1.1]) weedsAlong(offsetLine(dp, s2), 0, 0.55, 1.2, 0.2);
					drift(offsetLine(dp, 1.6), 0, 0.2);
				}
			}
		}
	}
	yield 'edges';

	// ---- 8. a camp, now and then ----
	// more near a downtown than out in the suburbs, more in the industrial flats; at most one
	// a tile, and not in most
	// (only where the land is downtown or industrial; the suburbs are left alone, but for the
	// odd overpass)
	const U1 = bay.urbanAt(cx, cz), campLand = U1.d > 0.12 || nInd >= 40;
	if (!campLand) out.cands = out.cands.filter((c) => c.under && U1.d > 0.04);
	if (out.cands.length) {
		const U = bay.urbanAt(cx, cz), ind = nInd / (N * N);
		const p = clamp(0.015 + U.d * 0.5 + ind * 0.05 + (U.u > 0.6 ? 0.015 : 0), 0, 0.2);
		const roll = hash(ti * 31 + 7, tj * 17 + 3);
		const cands = out.cands.filter((c) => c.why !== 'lot' || nInd >= 40).sort((a, b) => b.w - a.w + (hash(a.x, a.z) - hash(b.x, b.z)) * 0.5);
		const pp = cands[0]?.under ? Math.min(0.5, p * 2.5) : p;
		if (roll < pp) {
			for (const c of cands) {
				if (!campOk(C, c.x, c.z) || slopeAt(c.x, c.z, 4) > 0.25 || !O.free(c.x, c.z, 3, BLD | ROAD) || onStreet(c.x, c.z)) continue;
				out.camps.push(camp(c, r, put, O, H, clear));
				break;
			}
		}
	}
	return out;
}

// never in a park, by a playground or a school, on a beach, the Boardwalk or a wharf
export function campOk(C, x, z) {
	if (NO_CAMP.some((q) => Math.hypot(q.x - x, q.z - z) < q.r)) return false;
	if (C.parks()?.parkAt?.(x, z) || C.beaches()?.beachAt?.(x, z)) return false;
	if (C.boardwalk?.()?.inside?.(x, z)) return false;
	for (let a = 0; a < 9; a++) {
		const d = a ? 70 : 0, px = x + Math.cos(a * 0.785) * d, pz = z + Math.sin(a * 0.785) * d;
		const L = C.real.inside(px, pz) ? C.real.landAt(px, pz) : null;
		if (L && L.lu >= 2 && L.lu <= 6) return false;
	}
	return true;
}

// a small camp: a few tents or a tarp, carts, a bike, a chair, crates and buckets, the
// belongings; and the places its people are (edgecamp.js brings them)
function camp(c, r, put, O, H, clear) {
	const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), sx = fz, sz = -fx;            // along, and across
	const at = (a, b) => [c.x + fx * a + sx * b, c.z + fz * a + sz * b];
	const TENT = [[0.2, 0.35, 0.6], [0.25, 0.4, 0.25], [0.45, 0.45, 0.46], [0.62, 0.32, 0.16], [0.55, 0.5, 0.38], [0.2, 0.2, 0.25], [0.5, 0.52, 0.2]];
	const TARP = [[0.15, 0.35, 0.7], [0.4, 0.3, 0.18], [0.62, 0.62, 0.6], [0.25, 0.35, 0.22]];
	const BAG = [[0.2, 0.22, 0.25], [0.3, 0.3, 0.2], [0.35, 0.2, 0.15], [0.08, 0.08, 0.09], [0.25, 0.3, 0.4], [0.45, 0.35, 0.25]];
	const pick = (L) => L[Math.floor(r() * L.length)];
	const S = { x: c.x, z: c.z, yaw: c.yaw, why: c.why, seed: Math.floor(r() * 1e9), seats: [], sleep: null, stove: null, route: null };
	const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
	// the tents in an arc, doors toward the middle
	const nt = 1 + Math.floor(r() * 3);
	for (let k = 0; k < nt; k++) {
		const a = (k - (nt - 1) / 2) * 3.4 + (r() - 0.5), b = 2.6 + r() * 1.4, [x, z] = at(a, b);
		if (!clear(x, z, 1.2)) continue;
		put('tent', x, z, { yaw: face(x, z, c.x, c.z) - Math.PI / 2, col: pick(TENT), s: [0.9 + r() * 0.3, 0.85 + r() * 0.3, 0.9 + r() * 0.2] });
		O.disc(x, z, 1.4, 4);
		// a tarp thrown over one against the rain
		if (r() < 0.3) put('tarp', x, z, { yaw: face(x, z, c.x, c.z), col: pick(TARP), s: [0.9, 0.75, 0.9], lift: 0.05 });
		for (let q = 0; q < 1 + Math.floor(r() * 3); q++) { const [bx, bz] = at(a + (r() - 0.5) * 2.2, b - 1.5 - r() * 0.6); put('duffel', bx, bz, { col: pick(BAG), s: [0.7 + r() * 0.6, 0.7 + r() * 0.6, 0.7 + r() * 0.5] }); }
	}
	// or a tarp lean-to where there are fewer tents
	if (nt === 1 || r() < 0.3) {
		const [x, z] = at(-5 - r() * 2, 1.5);
		if (clear(x, z, 1.8)) { put('tarp', x, z, { yaw: c.yaw + Math.PI / 2 + (r() - 0.5) * 0.3, col: pick(TARP) }); O.disc(x, z, 1.8, 4); S.sleep = { x, z, yaw: c.yaw + (r() - 0.5) * 0.3, under: true }; }
	}
	// the carts, loaded
	for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
		const [x, z] = at(3 + k * 1.4 + r(), -1.5 - r() * 1.5), yaw = c.yaw + (r() - 0.5) * 1.2;
		if (!clear(x, z, 0.7)) continue;
		put('cart', x, z, { yaw }); put('cartWire', x, z, { yaw });
		for (let q = 0; q < 2 + Math.floor(r() * 3); q++) put('duffel', x + (r() - 0.5) * 0.4, z + (r() - 0.5) * 0.3, { lift: 0.55 + q * 0.12, col: pick(BAG), s: [0.55, 0.6, 0.6], yaw: yaw + (r() - 0.5) });
	}
	if (r() < 0.6) { const [x, z] = at(-2.5, -2.4); if (clear(x, z, 0.8)) put('bike', x, z, { yaw: c.yaw + (r() - 0.5) * 0.5, col: [[0.1, 0.1, 0.1], [0.5, 0.1, 0.1], [0.15, 0.3, 0.55], [0.6, 0.6, 0.62]][Math.floor(r() * 4)] }); }
	// where they sit: a camp chair or two, crates and buckets turned up
	const CH = [[0.15, 0.25, 0.5], [0.2, 0.3, 0.2], [0.1, 0.1, 0.1], [0.5, 0.15, 0.12]];
	const nc = 1 + Math.floor(r() * 2);
	for (let k = 0; k < nc; k++) {
		const [x, z] = at((k - 0.5) * 2.2, -0.2 + (r() - 0.5)), yaw = face(x, z, c.x + fx * 0.5, c.z + fz * 0.5) + (r() - 0.5) * 0.5;
		if (!clear(x, z, 0.5)) continue;
		put('chair', x, z, { yaw, col: CH[Math.floor(r() * CH.length)] });
		S.seats.push({ x, z, yaw, h: 0.44, kind: 'chair' });
	}
	for (let k = 0; k < 1 + Math.floor(r() * 3); k++) {
		const [x, z] = at(1.2 + (r() - 0.5) * 3, 1 + (r() - 0.5) * 1.5);
		if (!clear(x, z, 0.3)) continue;
		if (r() < 0.5) { put('crate', x, z, { yaw: r() * 6, col: [[0.15, 0.3, 0.6], [0.6, 0.12, 0.1], [0.12, 0.12, 0.13], [0.5, 0.5, 0.5]][Math.floor(r() * 4)] }); S.seats.push({ x, z, yaw: face(x, z, c.x, c.z), h: 0.32, kind: 'crate' }); }
		else { put('bucket', x, z, { yaw: r() * 6, col: r() < 0.6 ? [0.9, 0.9, 0.88] : [0.85, 0.45, 0.12] }); S.seats.push({ x, z, yaw: face(x, z, c.x, c.z), h: 0.38, kind: 'bucket' }); }
	}
	if (r() < 0.5) { const [x, z] = at(-1, 1.6); if (clear(x, z, 0.4)) put('cooler', x, z, { yaw: c.yaw, col: [[0.2, 0.35, 0.6], [0.7, 0.2, 0.15], [0.85, 0.85, 0.83]][Math.floor(r() * 3)] }); }
	// the stove on a crate by the middle
	{
		const [x, z] = at(0.3, 0.9);
		if (clear(x, z, 0.3)) { put('crate', x, z, { yaw: c.yaw, col: [0.12, 0.12, 0.13] }); put('stove', x, z, { lift: 0.3, yaw: c.yaw }); S.stove = { x, z, y: H(x, z) + 0.3 }; }
	}
	// somewhere to sleep in the open, if not under the tarp
	if (!S.sleep) { const [x, z] = at(4.5, 2.2); if (clear(x, z, 1.2)) S.sleep = { x, z, yaw: c.yaw + (r() - 0.5) * 0.4, under: false }; }
	// a way to walk with a cart: along the fence, the bank or the tracks
	const [ax, az] = at(-14, -3.5), [bx, bz] = at(18, -3.5);
	S.route = [ax, az, bx, bz];
	// a little rubbish about, but kept: people keep their camps
	for (let k = 0; k < 3 + Math.floor(r() * 5); k++) { const [x, z] = at((r() - 0.5) * 10, (r() - 0.5) * 7); if (r() < 0.5) put('can', x, z, { col: [0.75, 0.76, 0.78] }); else put('cup', x, z, { col: [0.92, 0.92, 0.9] }); }
	O.disc(c.x, c.z, 7, 4);
	return S;
}
