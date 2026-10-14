// Service alleys: the paved lane behind a row of shops or a downtown block, where the bins
// are wheeled out and the deliveries come in by the back doors. A row is three or more shops,
// offices or towers side by side facing one street; the alley runs behind their backs, a
// little off their walls, as far along as the row goes and on to the next street where the
// way is clear (or into the block as a service court where it is not). Each building on it
// gets a back door, and every so often a dumpster stands against a back wall.
//
// planAlleys() is plain numbers (node tests run it on the baked regions); the roads it returns
// are in realcity.js's shape, so a grown town (civgen.js) paints and drives them like its
// other streets, and the surveyed regions take them through a road source (createAlleys).

import { penetration, roadIndex } from './overlap.js';

export const ALLEY_W = 4.4;
// the kinds that line a shopping street: the map's office, retail, tower and parking boxes
// (realcity.js kinds 5, 6, 11, 12); city.js's office, retail, shop and tower lots
const MAP_KINDS = new Set([5, 6, 11, 12]);
const LOT_KINDS = new Set([2, 3, 6, 9]);
export const shopLike = (b) => (b.src ? MAP_KINDS.has(b.src.kind) : b.wallH !== undefined ? MAP_KINDS.has(b.kind) : LOT_KINDS.has(Math.floor(b.kind))) && b.w > 4 && b.d > 4;

// the nearest drive road's side of box b: its outward normal in the box's frame ([nx, nz]
// world), or on the grid the side away from its block's middle (block(b): [x, z] or null),
// or its own front (local +z)
function frontOf(b, near, block) {
	const c = Math.cos(b.a), s = Math.sin(b.a);
	const sides = [[-s, c, b.d / 2], [s, -c, b.d / 2], [c, s, b.w / 2], [-c, -s, b.w / 2]];
	if (!near) {
		const m = block?.(b);
		if (!m) return sides[0];
		const dx = b.x - m[0], dz = b.z - m[1];
		let k = 0, best = -1e9;
		sides.forEach(([nx, nz], j) => { const v = nx * dx + nz * dz; if (v > best) { best = v; k = j; } });
		return sides[k];
	}
	let best = null, bd = 1e9;
	const segs = near(b);
	for (let n = 0; n < segs.length; n += 2) {
		const r = segs[n], i = segs[n + 1], p = r.pts;
		if (r.cls === 'service' || r.cls === 'footway' || r.cls === 'path') continue;
		const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.z - az) * dz) / l2)), qx = ax + dx * t - b.x, qz = az + dz * t - b.z, d = Math.hypot(qx, qz);
		if (d >= bd) continue;
		bd = d;
		let k = 0, m = -1e9;
		sides.forEach(([nx, nz], j) => { const v = (nx * qx + nz * qz) / (d || 1); if (v > m) { m = v; k = j; } });
		best = sides[k];
	}
	return bd < 60 ? best : null;
}

// boxes: buildings ({ x, z, w, d, a } plus kind/src); roads: the streets (or null on the grid,
// where every lot faces its street with its local +z); returns the alleys as roads
export function planAlleys(boxes, roads = null, { minRow = 3, minLen = 45, step = 17, seed = 1, why = null, block = null, only = null } = {}) {
	const W = why || {};
	const tally = (k) => { W[k] = (W[k] || 0) + 1; };
	const near = roads ? roadIndex(roads) : null;
	const shops = boxes.filter((b) => !b.gone && shopLike(b) && (!only || only(b)));
	const all = boxes.filter((b) => !b.gone && b.w > 1.5 && b.d > 1.5 && (b.h === undefined || b.h > 2.6));
	// (each shop with its front: the way out to its street, and its back line)
	const F = [];
	for (const b of shops) {
		const f = frontOf(b, near, block);
		if (!f) { tally('nofront'); continue; }
		const [nx, nz, half] = f;
		F.push({ b, nx, nz, half, tx: -nz, tz: nx, back: [b.x - nx * half, b.z - nz * half] });
	}
	// rows: shops facing the same way, their backs in a line, side by side
	const used = new Set(), out = [];
	const cell = 40, G = new Map(), key = (x, z) => Math.floor(x / cell) * 92821 + Math.floor(z / cell);
	for (const f of F) { const k = key(f.b.x, f.b.z); let l = G.get(k); if (!l) G.set(k, l = []); l.push(f); }
	const neighbours = (f) => { const out2 = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const g of G.get(key(f.b.x + i * cell, f.b.z + j * cell)) || []) if (g !== f) out2.push(g); return out2; };
	const sameRow = (f, g) => f.nx * g.nx + f.nz * g.nz > 0.98 && Math.abs((g.back[0] - f.back[0]) * f.nx + (g.back[1] - f.back[1]) * f.nz) < 3.5;
	const along = (f, p) => (p[0] - f.back[0]) * f.tx + (p[1] - f.back[1]) * f.tz;
	const halfAlong = (g, f) => (Math.abs(Math.cos(g.b.a) * f.tx + Math.sin(g.b.a) * f.tz) * g.b.w + Math.abs(-Math.sin(g.b.a) * f.tx + Math.cos(g.b.a) * f.tz) * g.b.d) / 2;
	const segsNear = (x, z, r) => (near ? near({ x, z, w: r * 2, d: r * 2, a: 0 }) : []);
	const boxGrid = new Map();
	for (const b of all) { const r = Math.hypot(b.w, b.d) / 2; for (let j = Math.floor((b.z - r) / cell); j <= Math.floor((b.z + r) / cell); j++) for (let i = Math.floor((b.x - r) / cell); i <= Math.floor((b.x + r) / cell); i++) { const k = i * 92821 + j; let l = boxGrid.get(k); if (!l) boxGrid.set(k, l = []); l.push(b); } }
	const blocked = (q, skip) => {
		const r = Math.hypot(q.w, q.d) / 2, seen = new Set();
		for (let j = Math.floor((q.z - r) / cell); j <= Math.floor((q.z + r) / cell); j++) for (let i = Math.floor((q.x - r) / cell); i <= Math.floor((q.x + r) / cell); i++) for (const b of boxGrid.get(i * 92821 + j) || []) {
			if (seen.has(b) || skip?.has(b)) continue;
			seen.add(b);
			if (penetration(q, b) > 0.05) return true;
		}
		return false;
	};
	// a stretch of road near the line from p to q (an existing lane already behind the row)
	const roadAlong = (p, q, tol) => {
		const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, L = Math.hypot(q[0] - p[0], q[1] - p[1]), segs = segsNear(mx, mz, L / 2 + tol);
		const tx = (q[0] - p[0]) / (L || 1), tz = (q[1] - p[1]) / (L || 1);
		for (let n = 0; n < segs.length; n += 2) {
			const r = segs[n], i = segs[n + 1], P = r.pts;
			for (const [x, z] of [[P[i], P[i + 1]], [P[i + 2], P[i + 3]], [(P[i] + P[i + 2]) / 2, (P[i + 1] + P[i + 3]) / 2]]) {
				const u = (x - p[0]) * tx + (z - p[1]) * tz, v = Math.abs(-(x - p[0]) * tz + (z - p[1]) * tx);
				if (u > 0 && u < L && v < tol + r.w / 2) return r;
			}
		}
		return null;
	};
	const hash = (x, z) => { let h = Math.imul(Math.round(x * 3) | 0, 374761393) ^ Math.imul(Math.round(z * 3) | 0, 668265263) ^ seed; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
	for (const f of F) {
		if (used.has(f)) continue;
		// grow the row both ways from f
		const row = [f];
		used.add(f);
		for (let grew = true; grew;) {
			grew = false;
			for (const g of row.slice()) for (const h of neighbours(g)) {
				if (used.has(h) || !sameRow(f, h)) continue;
				// (side by side: no more than a gap's width between them along the row)
				const gap = Math.abs(along(f, h.back) - along(f, g.back)) - halfAlong(h, f) - halfAlong(g, f);
				if (gap > 7) continue;
				row.push(h); used.add(h); grew = true;
			}
		}
		tally('row' + Math.min(row.length, 5));
		// the line behind the backs: the deepest back, a little off it
		let lo = 1e9, hi = -1e9, deep = -1e9;
		for (const g of row) {
			const u = along(f, g.back), h = halfAlong(g, f);
			lo = Math.min(lo, u - h); hi = Math.max(hi, u + h);
			deep = Math.max(deep, -((g.back[0] - f.back[0]) * f.nx + (g.back[1] - f.back[1]) * f.nz));
		}
		// (three or more side by side, or one long strip of shops under one roof)
		if (row.length < minRow && hi - lo < minLen) { tally('short'); continue; }
		const off = deep + 0.9 + ALLEY_W / 2;
		const P = (u) => [f.back[0] + f.tx * u - f.nx * off, f.back[1] + f.tz * u - f.nz * off];
		const strip = (u0, u1) => { const [x0, z0] = P(u0), [x1, z1] = P(u1); return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(u1 - u0), d: ALLEY_W + 0.6, a: Math.atan2(f.tz, f.tx) }; };
		const rowSet = new Set(row.map((g) => g.b));
		if (blocked(strip(lo + 1, hi - 1), null)) { tally('blocked'); continue; }
		// (an existing lane already behind them)
		if (roadAlong(P(lo), P(hi), 3)) { tally('lane'); continue; }
		// on toward the streets at either end while the way is clear
		let a0 = lo, a1 = hi, open0 = false, open1 = false;
		for (const dir of [-1, 1]) {
			for (let e = 2; e <= (roads ? 34 : 6); e += 2) {
				const u = dir < 0 ? lo - e : hi + e;
				if (blocked(dir < 0 ? strip(u, lo) : strip(hi, u), rowSet)) break;
				if (dir < 0) a0 = u; else a1 = u;
				const [x, z] = P(u), segs = segsNear(x, z, 8);
				let met = false;
				for (let n = 0; n < segs.length && !met; n += 2) {
					const r = segs[n], i = segs[n + 1], Q = r.pts;
					if (!r.drive && r.cls !== 'service') continue;
					const ax = Q[i], az = Q[i + 1], dx = Q[i + 2] - ax, dz = Q[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
					if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r.w / 2 + 1) met = true;
				}
				if (met) { if (dir < 0) open0 = true; else open1 = true; break; }
			}
		}
		// (on the grid the block's ends are its streets: the row runs to them)
		if (!roads) { open0 = open1 = true; }
		if (!open0 && !open1) { tally('closed'); continue; }
		const [x0, z0] = P(a0), [x1, z1] = P(a1);
		// the bins and the back doors
		const yaw = Math.atan2(-f.nx, -f.nz), bins = [], doors = [];
		for (const g of row) {
			const u = along(f, g.back), h = halfAlong(g, f), dback = -((g.back[0] - f.back[0]) * f.nx + (g.back[1] - f.back[1]) * f.nz);
			const du = u + (hash(g.b.x, g.b.z) - 0.5) * Math.max(0, 2 * h - 3);
			const [dx, dz] = [f.back[0] + f.tx * du - f.nx * dback, f.back[1] + f.tz * du - f.nz * dback];
			doors.push([+dx.toFixed(2), +dz.toFixed(2), +yaw.toFixed(3), g.b]);
		}
		for (let u = lo + 3 + hash(f.b.x, 1) * 6; u < hi - 2; u += step + hash(u, f.b.z) * 8) {
			const [bx, bz] = P(u), w = ALLEY_W / 2 - 0.55;
			bins.push([+(bx + f.nx * w).toFixed(2), +(bz + f.nz * w).toFixed(2), +yaw.toFixed(3), hash(bx, bz) < 0.3 ? 1 : 0]);
		}
		out.push({ cls: 'service', w: ALLEY_W, name: '', alley: { bins, doors, open: [open0, open1] }, pts: new Float32Array([x0, z0, x1, z1]), box: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], end0: false, end1: false, bridge: false, link: false, divided: false, drive: false, walked: false });
	}
	return out;
}
