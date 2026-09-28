// Where a realm stands. On a green world (and now and then on another) people build in
// stone: a castle on the high ground, a market town below it round its square, a chapel,
// mills on the knoll and on the river, fields in hedgerows, watchtowers on the hills and
// an old ring of standing stones. Everything is sited here, before the ground and the
// plants are made: the castle's hill is cut level, the river's bed is dug to the sea, the
// house plots are levelled and the roads worn in (the path mask), so the land is shaped
// round what stands on it.
//
// Plain JavaScript: nothing drawn here (realm.js builds it).

import { mulberry32, smoothstep, clamp } from '../../noise.js';

const TAU = Math.PI * 2;

// some other worlds keep a realm too, instead of (or beside) the old builders' works
const HOSTS = ['TERRAN', 'SHEPHERD', 'ARID', 'ICE'];
export function hasRealm(profile, seed) {
	const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('realm') : null;
	if (q === '0') return false;
	if (profile?.realm || q === '1') return true;
	if (!HOSTS.includes(profile?.type)) return false;
	return mulberry32((seed ^ 0x3ea1b0) >>> 0)() < 0.35;
}

// the look of a realm by its world
export const STYLES = {
	green: { stone: [0.60, 0.58, 0.53], rubble: [0.55, 0.52, 0.47], plaster: [[0.93, 0.90, 0.82], [0.92, 0.85, 0.70], [0.90, 0.82, 0.74], [0.84, 0.80, 0.70], [0.94, 0.92, 0.88]], timber: [0.22, 0.15, 0.10], roofs: ['thatch', 'thatch', 'shingle'], thatch: [0.62, 0.52, 0.34], shingle: [0.34, 0.30, 0.28], snow: 0 },
	ARID: { stone: [0.80, 0.64, 0.46], rubble: [0.74, 0.58, 0.42], plaster: [[0.90, 0.78, 0.60], [0.86, 0.70, 0.52], [0.93, 0.86, 0.72]], timber: [0.30, 0.20, 0.12], roofs: ['tile', 'tile', 'thatch'], thatch: [0.72, 0.60, 0.38], shingle: [0.66, 0.36, 0.22], snow: 0 },
	ICE: { stone: [0.56, 0.58, 0.60], rubble: [0.50, 0.52, 0.54], plaster: [[0.88, 0.88, 0.86], [0.80, 0.78, 0.74], [0.70, 0.66, 0.60]], timber: [0.20, 0.14, 0.10], roofs: ['shingle', 'shingle', 'thatch'], thatch: [0.55, 0.48, 0.34], shingle: [0.26, 0.26, 0.28], snow: 1 },
};

// heraldry: a colour on a metal, or a metal on a colour
const COLOURS = { gules: [0.62, 0.07, 0.07], azure: [0.08, 0.2, 0.55], vert: [0.08, 0.38, 0.16], sable: [0.07, 0.07, 0.08], purpure: [0.38, 0.1, 0.4] };
const METALS = { or: [0.88, 0.66, 0.14], argent: [0.92, 0.91, 0.88] };
const CHARGES = ['tower', 'star', 'fleur', 'cross', 'chevron', 'crown'];
const PRE = ['Ash', 'Eld', 'Thorn', 'Brack', 'Hol', 'Wyn', 'Mar', 'Sten', 'Dun', 'Fal', 'Kes', 'Lang', 'Mor', 'Raven', 'Stag', 'Whit', 'Oak', 'Bram', 'Fern', 'Wold', 'Harrow', 'Elm'];
const SUF = ['ford', 'wick', 'mere', 'dale', 'holm', 'by', 'ton', 'stead', 'cross', 'burgh', 'ley', 'well', 'bridge', 'combe'];
const LORDS = ['Lord Ansel', 'Lady Isolde', 'Lord Edric', 'Lady Rowena', 'Lord Osric', 'Lady Maud', 'Lord Aldwin', 'Lady Elinor'];

export function planRealm(island, profile, opts = {}) {
	if (!hasRealm(profile, island.seed)) return null;
	const r = mulberry32((island.seed ^ 0x4ea1f00d) >>> 0);
	const pick = (a) => a[Math.floor(r() * a.length)];
	const H = island.heightAt, coast = island.coastAt, R = island.R || 800;
	const V = island.village || { x: 1e9, z: 1e9 };
	const avoid = [...(opts.fields || [])];
	const blocked = (x, z, pad) => avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);
	// the ground under a round footprint: lowest, highest, mean
	const ring = (x, z, rad) => {
		let lo = H(x, z), hi = lo, s = lo, n = 1;
		for (const f of [0.35, 0.7, 1]) for (let k = 0; k < 12; k++) {
			const a = k / 12 * TAU + f, h = H(x + Math.cos(a) * rad * f, z + Math.sin(a) * rad * f);
			lo = Math.min(lo, h); hi = Math.max(hi, h); s += h; n++;
		}
		return { lo, hi, mean: s / n };
	};

	// ---------- the realm's name and arms ----------
	const style = STYLES[profile.type] || STYLES.green;
	const cn = Object.keys(COLOURS), mn = Object.keys(METALS);
	const col = COLOURS[pick(cn)], met = METALS[pick(mn)];
	const onMetal = r() < 0.4;
	const arms = { field: onMetal ? met : col, charge: onMetal ? col : met, device: pick(CHARGES), split: r() < 0.3 };
	const townName = pick(PRE) + pick(SUF);
	let castleName = pick(PRE) + pick(SUF);
	if (castleName === townName) castleName = 'Old ' + castleName;
	const realm = { seed: island.seed, style, arms, name: townName, castleName: 'Castle ' + castleName, lord: pick(LORDS), clear: [], roads: [], fields: [], houses: [], stalls: [], watchtowers: [], bridges: [], pads: [], dungeons: [], noAliens: !!profile.realm };

	// ---------- the castle: broad high ground that can be cut level ----------
	let maxH = 0;
	for (let z = -R; z <= R; z += 40) for (let x = -R; x <= R; x += 40) maxH = Math.max(maxH, H(x, z));
	let best = null;
	for (let z = -R * 0.85; z <= R * 0.85; z += 20) for (let x = -R * 0.85; x <= R * 0.85; x += 20) {
		const h = H(x, z);
		if (h < Math.min(22, maxH * 0.35) || h > maxH * 0.92 || coast(x, z) < 150 || Math.hypot(x - V.x, z - V.z) < 280 || blocked(x, z, 50)) continue;
		const g = ring(x, z, 44);
		if (g.hi - g.lo > 18) continue;
		const s = g.mean * 0.7 - (g.hi - g.lo) * 2.4 + r() * 6;
		if (!best || s > best.s) best = { s, x, z, g };
	}
	if (!best) return null;
	const castle = { x: best.x, z: best.z, y: best.g.mean };
	realm.castle = castle;

	// ---------- the town: gentle ground below it ----------
	let town = null;
	for (const lim of [9, 15]) {
		for (let z = -R; z <= R; z += 16) for (let x = -R; x <= R; x += 16) {
			const d = Math.hypot(x - castle.x, z - castle.z), h = H(x, z);
			if (d < 170 || d > 540 || h < 4 || h > castle.y - 6 || coast(x, z) < 100 || Math.hypot(x - V.x, z - V.z) < 210 || blocked(x, z, 70)) continue;
			const g = ring(x, z, 54);
			if (g.hi - g.lo > lim || g.lo < 2.5) continue;
			const s = -(g.hi - g.lo) * 1.6 - Math.abs(d - 300) * 0.02 - h * 0.04 + r() * 3;
			if (!town || s > town.s) town = { s, x, z, g };
		}
		if (town) break;
	}
	if (!town) return null;
	const T = { x: town.x, z: town.z, y: town.g.mean, r: 62 };
	realm.town = T;

	// ---------- grids: levelling, masks ----------
	const { N, cell, half, height, masks } = island;
	const cellsNear = (x, z, rad, fn) => {
		const i0 = Math.max(0, Math.floor((x - rad + half) / cell)), i1 = Math.min(N - 1, Math.ceil((x + rad + half) / cell));
		const j0 = Math.max(0, Math.floor((z - rad + half) / cell)), j1 = Math.min(N - 1, Math.ceil((z + rad + half) / cell));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(-half + i * cell, -half + j * cell, j * N + i);
	};
	// level ground to y inside dist() <= 0, easing back over `ease` metres
	const level = (cx, cz, rad, y, dist, ease) => cellsNear(cx, cz, rad + ease + cell, (x, z, k) => {
		const d = dist(x, z);
		if (d >= ease) return;
		const t = Math.max(0, d) / ease, w = 1 - t * t * (3 - 2 * t);
		height[k] = height[k] * (1 - w) + y * w;
	});
	const wear = (k, w) => { const v = Math.round(clamp(w, 0, 1) * 255); if (v > masks[k * 4]) masks[k * 4] = v; masks[k * 4 + 3] = Math.round(masks[k * 4 + 3] * (1 - clamp(w, 0, 1))); };

	// ---------- the castle's plan: a ring of walls with round towers, a gatehouse, a keep ----------
	const toTown = Math.atan2(T.z - castle.z, T.x - castle.x);
	const nv = 6 + (r() < 0.4 ? 1 : 0);
	const verts = [];
	for (let i = 0; i < nv; i++) {
		const a = toTown + Math.PI / nv + i / nv * TAU + (r() - 0.5) * 0.25;
		const rad = 31 + r() * 6;
		verts.push({ x: castle.x + Math.cos(a) * rad, z: castle.z + Math.sin(a) * rad });
	}
	// the gate: in the wall that faces the town
	let gi = 0, gd = -2;
	for (let i = 0; i < nv; i++) {
		const a = verts[i], b = verts[(i + 1) % nv], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
		const dd = Math.cos(Math.atan2(mz - castle.z, mx - castle.x) - toTown);
		if (dd > gd) { gd = dd; gi = i; }
	}
	castle.verts = verts;
	castle.gateEdge = gi;
	const ga = verts[gi], gb = verts[(gi + 1) % nv];
	castle.gate = { x: (ga.x + gb.x) / 2, z: (ga.z + gb.z) / 2 };
	castle.gate.yaw = Math.atan2(castle.gate.x - castle.x, castle.gate.z - castle.z);   // facing out
	// the keep stands at the back, its door toward the gate
	const back = castle.gate.yaw + Math.PI;
	castle.keep = { x: castle.x + Math.sin(back) * 11, z: castle.z + Math.cos(back) * 11, w: 15, d: 15, yaw: castle.gate.yaw };
	const inPoly = (x, z, pad = 0) => {
		// inside the wall ring, by the signed distance to its edges
		let inside = false, dmin = 1e9;
		for (let i = 0, j = nv - 1; i < nv; j = i++) {
			const a = verts[i], b = verts[j];
			if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
			const dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
			dmin = Math.min(dmin, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
		}
		return inside ? -dmin - pad : dmin - pad;
	};
	castle.inside = inPoly;
	// cut the hill level under the walls and the bailey, with a ramp down from the gate
	const cy = castle.y;
	level(castle.x, castle.z, 44, cy, (x, z) => inPoly(x, z) - 6, 16);
	// a ramp down from the gate to the hillside, and the bailey trodden bare
	{
		const g = castle.gate, dx = Math.sin(g.yaw), dz = Math.cos(g.yaw), L = 30, hEnd = H(g.x + dx * (L + 6), g.z + dz * (L + 6));
		cellsNear(g.x + dx * L / 2, g.z + dz * L / 2, L / 2 + 12, (x, z, k) => {
			const u = (x - g.x) * dx + (z - g.z) * dz, v = Math.abs((x - g.x) * dz - (z - g.z) * dx);
			if (u < 3 || u > L || v > 10) return;
			const t = (u - 3) / (L - 3), w = 1 - smoothstep(3, 10, v);
			height[k] = height[k] * (1 - w) + (cy + (hEnd - cy) * t * t * (3 - 2 * t)) * w;
			if (v < 2.6) wear(k, 0.9);
		});
		cellsNear(castle.x, castle.z, 46, (x, z, k) => { const d = inPoly(x, z); if (d < 1) wear(k, d < -2 ? 0.75 : 0.5); });
	}
	realm.clear.push({ x: castle.x, z: castle.z, r: 46 });

	// ---------- the town's plan: a square, lanes out from it, houses along them ----------
	level(T.x, T.z, 16, T.y, (x, z) => Math.hypot(x - T.x, z - T.z) - 14, 9);
	cellsNear(T.x, T.z, 16, (x, z, k) => { const d = Math.hypot(x - T.x, z - T.z); if (d < 15) wear(k, d < 13.5 ? 1 : 0.6); });
	T.square = { x: T.x, z: T.z, r: 13 };
	const lanes = [];
	const laneA = [Math.atan2(castle.z - T.z, castle.x - T.x)];
	const nl = 3 + (r() < 0.5 ? 1 : 0);
	for (let i = 1; i < nl; i++) laneA.push(laneA[0] + i / nl * TAU + (r() - 0.5) * 0.4);
	for (const a0 of laneA) {
		const len = 58 + r() * 18, bend = (r() - 0.5) * 0.5, pts = [];
		for (let s = 0; s <= len; s += 4) {
			const a = a0 + bend * (s / len) * (s / len);
			pts.push({ x: T.x + Math.cos(a) * (13 + s), z: T.z + Math.sin(a) * (13 + s) });
		}
		lanes.push({ a: a0, pts, len });
	}
	T.lanes = lanes;

	// ---------- the river: from a spring in the hills, past the town, to the sea ----------
	// (steepest descent with some inertia, so it bends; a pit is dug straight through)
	const trace = (sx, sz) => {
		const pts = [{ x: sx, z: sz }];
		let x = sx, z = sz, hd = null;
		for (let i = 0; i < 260; i++) {
			const h0 = H(x, z);
			if (h0 < -0.4) break;
			let bestD = null;
			for (let k = 0; k < 16; k++) {
				const a = k / 16 * TAU;
				if (hd != null) { let dd = a - hd; while (dd > Math.PI) dd -= TAU; while (dd < -Math.PI) dd += TAU; if (Math.abs(dd) > 1.1) continue; }
				const nx = x + Math.cos(a) * 8, nz = z + Math.sin(a) * 8, h = H(nx, nz);
				const turn = hd == null ? 0 : Math.abs(Math.atan2(Math.sin(a - hd), Math.cos(a - hd)));
				const s = h + turn * 0.6;
				if (!bestD || s < bestD.s) bestD = { s, a, nx, nz };
			}
			if (!bestD) break;
			hd = bestD.a; x = bestD.nx; z = bestD.nz;
			pts.push({ x, z });
		}
		return H(x, z) < 0 ? pts : null;
	};
	let river = null;
	for (let tries = 0; tries < 160; tries++) {
		const a = r() * TAU, d = 150 + r() * 330;
		const sx = T.x + Math.cos(a) * d, sz = T.z + Math.sin(a) * d;
		if (H(sx, sz) < T.y + 18 || inPoly(sx, sz) < 30 || coast(sx, sz) < 150) continue;
		const pts = trace(sx, sz);
		if (!pts || pts.length < 30) continue;
		let near = 1e9, bad = false;
		for (const p of pts) {
			const dt = Math.hypot(p.x - T.x, p.z - T.z);
			near = Math.min(near, dt);
			if (dt < 70 || inPoly(p.x, p.z) < 26 || Math.hypot(p.x - V.x, p.z - V.z) < 95 || blocked(p.x, p.z, 10)) { bad = true; break; }
		}
		if (bad || near > 160) continue;
		const s = -Math.abs(near - 95) - Math.abs(pts.length - 90) * 0.2 + r() * 10;
		if (!river || s > river.s) river = { s, pts };
	}
	if (river) {
		// smooth the line, then the water falls steadily all the way down
		let P = river.pts;
		for (let it = 0; it < 2; it++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 }); } Q.push(P[P.length - 1]); P = Q; }
		const n = P.length;
		let w = H(P[0].x, P[0].z) - 1.0;
		for (let i = 0; i < n; i++) {
			const p = P[i], seg = i ? Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z) : 0;
			// (at least a gentle fall; never above the ground less a metre)
			w = Math.min(w - seg * 0.006, H(p.x, p.z) - 1.05);
			p.w = Math.max(-0.3, w);
			p.b = 2.2 + 3.6 * smoothstep(0, 1, i / (n - 1));
		}
		// dig it: a bed under the water, banks sloping up to the land
		for (let i = 0; i < n - 1; i++) {
			const a = P[i], b = P[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
			cellsNear((a.x + b.x) / 2, (a.z + b.z) / 2, Math.sqrt(L2) / 2 + a.b + 14, (x, z, k) => {
				const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1), d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
				const wl = a.w + (b.w - a.w) * t, bw = a.b + (b.b - a.b) * t;
				if (d > bw + 14) return;
				const g = d < bw ? wl - 0.85 + 0.85 * (d / bw) * (d / bw) : wl + (d - bw) * 0.55;
				if (g < height[k]) height[k] = g;
				if (d < bw + 2.2) wear(k, d < bw ? 0.25 : 0.45 * smoothstep(bw + 2.2, bw, d));
			});
		}
		realm.river = { pts: P };
	}
	const riverDist = (x, z) => {
		if (!realm.river) return { d: 1e9 };
		let best = { d: 1e9 };
		const P = realm.river.pts;
		for (let i = 0; i < P.length - 1; i++) {
			const a = P[i], b = P[i + 1];
			if (Math.abs(a.x - x) > 60 && Math.abs(b.x - x) > 60) continue;
			if (Math.abs(a.z - z) > 60 && Math.abs(b.z - z) > 60) continue;
			const dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1), d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
			if (d < best.d) best = { d, i, t, w: a.w + (b.w - a.w) * t, b: a.b + (b.b - a.b) * t, x: a.x + dx * t, z: a.z + dz * t, dir: Math.atan2(dx, dz) };
		}
		return best;
	};
	realm.riverDist = riverDist;

	// ---------- buildings in the town ----------
	const plots = [];
	const free = (x, z, rad) => plots.every((p) => Math.hypot(p.x - x, p.z - z) > p.rad + rad + 1.5) && Math.hypot(x - T.x, z - T.z) > 13 + rad && riverDist(x, z).d > (riverDist(x, z).b || 0) + rad + 4 && !blocked(x, z, rad);
	const laneNear = (x, z, rad) => lanes.some((L) => L.pts.some((p) => Math.hypot(p.x - x, p.z - z) < rad + 2.4));
	// a building's plot, levelled; kind decides its size
	const place = (kind, x, z, yaw, w, d) => {
		const rad = Math.hypot(w, d) / 2;
		if (!free(x, z, rad) || laneNear(x, z, rad * 0.8)) return null;
		let lo = 1e9, hi = -1e9, s = 0, n = 0;
		for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5) {
			const px = x + Math.cos(yaw) * a * w / 2 + Math.sin(yaw) * b * d / 2, pz = z - Math.sin(yaw) * a * w / 2 + Math.cos(yaw) * b * d / 2, h = H(px, pz);
			lo = Math.min(lo, h); hi = Math.max(hi, h); s += h; n++;
		}
		if (hi - lo > 4.5 || lo < 1.5) return null;
		const y = s / n, c = Math.cos(yaw), sn = Math.sin(yaw);
		level(x, z, rad + 1, y, (px, pz) => { const dx = px - x, dz = pz - z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; return Math.hypot(Math.max(0, Math.abs(lx) - w / 2 - 1), Math.max(0, Math.abs(lz) - d / 2 - 1)); }, 4);
		// (bare ground under and round it: no grass through its floors)
		cellsNear(x, z, rad + 1, (px, pz, k) => { const dx = px - x, dz = pz - z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; if (Math.abs(lx) < w / 2 + 0.6 && Math.abs(lz) < d / 2 + 0.6) wear(k, 0.7); });
		const b = { kind, x, z, y, yaw, w, d, rad };
		plots.push(b);
		return b;
	};
	// round the square: the inn, the smithy, the chapel beyond
	const gaps = laneA.map((a) => ((a % TAU) + TAU) % TAU).sort((p, q) => p - q);
	const mids = gaps.map((a, i) => { const b = gaps[(i + 1) % gaps.length] + (i === gaps.length - 1 ? TAU : 0); return { a: (a + b) / 2, span: b - a }; }).sort((p, q) => q.span - p.span);
	const onSquare = (kind, m, dist, w, d) => {
		for (const off of [0, 0.25, -0.25, 0.45, -0.45]) {
			const a = m.a + off, x = T.x + Math.cos(a) * dist, z = T.z + Math.sin(a) * dist;
			const b = place(kind, x, z, Math.atan2(T.x - x, T.z - z), w, d);
			if (b) return b;
		}
		return null;
	};
	realm.inn = onSquare('inn', mids[0], 22, 12, 9);
	realm.smithy = onSquare('smithy', mids[1 % mids.length], 21, 8, 7);
	realm.chapel = onSquare('chapel', mids[2 % mids.length] || mids[0], 34, 8.5, 17) || onSquare('chapel', mids[0], 44, 8.5, 17);
	if (realm.chapel) realm.chapel.yard = { r: 14 };
	for (const k of ['inn', 'smithy', 'chapel']) if (realm[k]) realm.houses.push(realm[k]);
	// houses along the lanes, fronts to the lane
	const maxHouses = opts.isPhone ? 14 : 20;
	for (const L of lanes) for (let s = 6; s < L.len - 2; s += 10 + r() * 3) {
		for (const side of [-1, 1]) {
			if (realm.houses.length >= maxHouses + 3) break;
			const i = Math.min(L.pts.length - 2, Math.round(s / 4)), p = L.pts[i], q = L.pts[i + 1];
			const dir = Math.atan2(q.x - p.x, q.z - p.z), nx = Math.cos(dir) * side, nz = -Math.sin(dir) * side;
			const w = 5.5 + r() * 2.5, d = 7 + r() * 3, set = 3.2 + d / 2;
			const x = p.x + nx * set, z = p.z + nz * set;
			// (the house faces the lane: its front, +z in its own frame, toward it)
			const b = place('house', x, z, Math.atan2(-nx, -nz), w, d);
			if (b) { b.storeys = r() < 0.45 ? 2 : 1; b.roof = pick(style.roofs); b.wall = pick(style.plaster); realm.houses.push(b); }
		}
	}
	// market stalls round the square's edge
	for (let i = 0; i < 5; i++) {
		const a = laneA[0] + (i + 0.5) / 5 * TAU + 0.3, x = T.x + Math.cos(a) * 9.5, z = T.z + Math.sin(a) * 9.5;
		realm.stalls.push({ x, z, y: H(x, z), yaw: Math.atan2(T.x - x, T.z - z), goods: i % 5 });
	}
	realm.pads = plots;

	// ---------- the windmill on a knoll, the watermill on the river ----------
	let knoll = null;
	for (let tries = 0; tries < 300; tries++) {
		const a = r() * TAU, d = 110 + r() * 230, x = T.x + Math.cos(a) * d, z = T.z + Math.sin(a) * d;
		const h = H(x, z), g = ring(x, z, 10);
		if (h < T.y + 3 || g.hi - g.lo > 4 || inPoly(x, z) < 20 || riverDist(x, z).d < 25 || blocked(x, z, 20) || !free(x, z, 10) || coast(x, z) < 60) continue;
		const s = h - (g.hi - g.lo) * 3 - d * 0.02;
		if (!knoll || s > knoll.s) knoll = { s, x, z };
	}
	if (knoll) realm.windmill = place('windmill', knoll.x, knoll.z, Math.atan2(T.x - knoll.x, T.z - knoll.z), 8, 8);
	if (realm.river) {
		const P = realm.river.pts;
		let bm = null;
		for (let i = 2; i < P.length - 2; i++) {
			const p = P[i], d = Math.hypot(p.x - T.x, p.z - T.z);
			if (d < 75 || d > 190 || p.w < 1) continue;
			if (!bm || d < bm.d) bm = { d, i, p };
		}
		if (bm) {
			const p = bm.p, q = P[bm.i + 1], dir = Math.atan2(q.x - p.x, q.z - p.z);
			// on the bank nearer the town
			const sx = Math.cos(dir), sz = -Math.sin(dir), side = (T.x - p.x) * sx + (T.z - p.z) * sz > 0 ? 1 : -1;
			const off = p.b + 5.5;
			const x = p.x + sx * side * off, z = p.z + sz * side * off;
			const m = place('watermill', x, z, dir + (side > 0 ? -Math.PI / 2 : Math.PI / 2), 9, 8);
			if (m) { m.water = p.w; m.wheel = { x: p.x + sx * side * (p.b - 0.6), z: p.z + sz * side * (p.b - 0.6), yaw: dir, y: p.w }; realm.watermill = m; }
		}
	}

	// ---------- watchtowers on the heights, the standing stones on a hilltop ----------
	const heights = [];
	for (let z = -R * 0.9; z <= R * 0.9; z += 24) for (let x = -R * 0.9; x <= R * 0.9; x += 24) {
		const h = H(x, z);
		if (h < 14 || coast(x, z) < 50) continue;
		const g = ring(x, z, 6);
		if (g.hi - g.lo > 5) continue;
		// prominence: how far it stands above the ground round it
		const around = ring(x, z, 70).mean;
		heights.push({ x, z, h, prom: h - around + r() * 3 });
	}
	heights.sort((a, b) => b.prom - a.prom);
	const farFromAll = (x, z, d) => Math.hypot(x - castle.x, z - castle.z) > d + 40 && Math.hypot(x - T.x, z - T.z) > d + 60 && Math.hypot(x - V.x, z - V.z) > d + 80 && realm.watchtowers.every((w) => Math.hypot(w.x - x, w.z - z) > 260) && !blocked(x, z, 20) && riverDist(x, z).d > 20 && free(x, z, 8);
	for (const c of heights) {
		if (realm.watchtowers.length >= 3) break;
		if (!farFromAll(c.x, c.z, 180)) continue;
		const w = place('watchtower', c.x, c.z, r() * TAU, 5, 5);
		if (w) realm.watchtowers.push(w);
	}
	for (const c of heights) {
		if (realm.stones) break;
		if (!farFromAll(c.x, c.z, 160)) continue;
		const g = ring(c.x, c.z, 13);
		if (g.hi - g.lo > 5) continue;
		realm.stones = { x: c.x, z: c.z, y: g.mean, r: 10 };
		plots.push({ x: c.x, z: c.z, rad: 13 });
	}

	// ---------- roads: least effort over the ground ----------
	const G = 8;
	const astar = (a, b) => {
		const x0 = Math.min(a.x, b.x) - 220, x1 = Math.max(a.x, b.x) + 220, z0 = Math.min(a.z, b.z) - 220, z1 = Math.max(a.z, b.z) + 220;
		const W = Math.ceil((x1 - x0) / G) + 1, D = Math.ceil((z1 - z0) / G) + 1, n = W * D;
		const gC = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), shut = new Uint8Array(n);
		const hx = new Float32Array(n);
		for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) hx[j * W + i] = H(x0 + i * G, z0 + j * G);
		const idx = (x, z) => clamp(Math.round((z - z0) / G), 0, D - 1) * W + clamp(Math.round((x - x0) / G), 0, W - 1);
		const s = idx(a.x, a.z), t = idx(b.x, b.z), tx = t % W, tz = Math.floor(t / W);
		const heap = [];
		const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
		const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, rr = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
		gC[s] = 0; push(s, 0);
		const penal = (x, z, h) => {
			if (h < 0.8) return 1e4;
			let p = 0;
			if (inPoly(x, z) < 2) p += 1e4;
			const rd = riverDist(x, z);
			if (rd.d < rd.b + 1) p += 70;
			for (const q of plots) if (q.kind && q.kind !== 'watchtower' && Math.hypot(q.x - x, q.z - z) < q.rad + 1) p += 1e4;
			if (Math.hypot(x - T.x, z - T.z) < 13) p -= 4;   // the square is road already
			return p;
		};
		const pen = new Float32Array(n).fill(NaN);
		let it = 0;
		while (heap.length && it++ < 90000) {
			const [, k] = pop();
			if (shut[k]) continue;
			shut[k] = 1;
			if (k === t) break;
			const ci = k % W, cj = Math.floor(k / W);
			for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
				if (!di && !dj) continue;
				const ni = ci + di, nj = cj + dj;
				if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
				const q = nj * W + ni;
				if (shut[q]) continue;
				if (Number.isNaN(pen[q])) pen[q] = penal(x0 + ni * G, z0 + nj * G, hx[q]);
				const len = Math.hypot(di, dj) * G, sl = (hx[q] - hx[k]) / len;
				const c = gC[k] + len * (1 + sl * sl * 60) + Math.max(0, pen[q]) + (pen[q] < 0 ? -2 : 0);
				if (c < gC[q]) { gC[q] = c; from[q] = k; push(q, c + Math.hypot(ni - tx, nj - tz) * G); }
			}
		}
		if (from[t] < 0 && t !== s) return null;
		const out = [];
		for (let k = t; k >= 0; k = from[k]) { out.push({ x: x0 + (k % W) * G, z: z0 + Math.floor(k / W) * G }); if (k === s) break; }
		out.reverse();
		out[0] = { x: a.x, z: a.z }; out[out.length - 1] = { x: b.x, z: b.z };
		// smoothed, and then evenly spaced
		let P = out;
		for (let k2 = 0; k2 < 3; k2++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const A = P[i], B = P[i + 1]; Q.push({ x: A.x * 0.75 + B.x * 0.25, z: A.z * 0.75 + B.z * 0.25 }, { x: A.x * 0.25 + B.x * 0.75, z: A.z * 0.25 + B.z * 0.75 }); } Q.push(P[P.length - 1]); P = Q; }
		return P;
	};
	const laneEnd = (a) => { let bestL = lanes[0], bd = 1e9; for (const L of lanes) { const e = L.pts[L.pts.length - 1], d = Math.hypot(e.x - a.x, e.z - a.z); if (d < bd) { bd = d; bestL = L; } } return bestL.pts[bestL.pts.length - 1]; };
	const gateOut = { x: castle.gate.x + Math.sin(castle.gate.yaw) * 7, z: castle.gate.z + Math.cos(castle.gate.yaw) * 7 };
	const links = [[laneEnd(gateOut), gateOut, 3.2]];
	if (realm.windmill) links.push([laneEnd(realm.windmill), { x: realm.windmill.x + Math.sin(realm.windmill.yaw) * 7, z: realm.windmill.z + Math.cos(realm.windmill.yaw) * 7 }, 2.2]);
	if (realm.watermill) links.push([laneEnd(realm.watermill), { x: realm.watermill.x - Math.sin(realm.watermill.yaw) * 7, z: realm.watermill.z - Math.cos(realm.watermill.yaw) * 7 }, 2.4]);
	links.push([laneEnd(V), { x: V.x - (V.seaDir?.x || 0) * 30, z: V.z - (V.seaDir?.z || 0) * 30 }, 2.6]);
	for (const w of realm.watchtowers) links.push([laneEnd(w), { x: w.x + Math.sin(w.yaw) * 5, z: w.z + Math.cos(w.yaw) * 5 }, 1.6]);
	for (const [a, b, wdt] of links) {
		const pts = astar(a, b);
		if (pts) realm.roads.push({ pts, w: wdt });
	}
	for (const L of lanes) realm.roads.push({ pts: L.pts, w: 3.4, lane: true });
	// wear them into the ground; where one crosses the river, a bridge
	const roadDist = (x, z) => {
		let m = 1e9;
		for (const rd of realm.roads) for (let i = 0; i < rd.pts.length - 1; i++) {
			const a = rd.pts[i], b = rd.pts[i + 1];
			if (Math.abs(a.x - x) > 40 || Math.abs(a.z - z) > 40) continue;
			const dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
			m = Math.min(m, Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - rd.w / 2);
		}
		return m;
	};
	realm.roadDist = roadDist;
	for (const rd of realm.roads) {
		const hw = rd.w / 2;
		for (let i = 0; i < rd.pts.length - 1; i++) {
			const a = rd.pts[i], b = rd.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
			cellsNear((a.x + b.x) / 2, (a.z + b.z) / 2, Math.sqrt(L2) / 2 + hw + 3, (x, z, k) => {
				const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1), d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
				if (d > hw + 2.2) return;
				wear(k, smoothstep(hw + 2.2, hw * 0.6, d));
			});
		}
		// (bridges: one per crossing, where the road is nearest the water's middle)
		if (!realm.river) continue;
		let inW = false, bestB = null;
		for (let i = 0; i < rd.pts.length; i++) {
			const p = rd.pts[i], q = riverDist(p.x, p.z), wet = q.d < q.b + 1.5;
			if (wet && (!bestB || q.d < bestB.q.d)) bestB = { i, q };
			if (inW && !wet && bestB) {
				const A = rd.pts[Math.max(0, bestB.i - 2)], B = rd.pts[Math.min(rd.pts.length - 1, bestB.i + 2)];
				const yaw = Math.atan2(B.x - A.x, B.z - A.z), len = bestB.q.b * 2 + 9;
				const e0 = { x: bestB.q.x - Math.sin(yaw) * len / 2, z: bestB.q.z - Math.cos(yaw) * len / 2 }, e1 = { x: bestB.q.x + Math.sin(yaw) * len / 2, z: bestB.q.z + Math.cos(yaw) * len / 2 };
				if (!realm.bridges.some((o) => Math.hypot(o.x - bestB.q.x, o.z - bestB.q.z) < 20)) realm.bridges.push({ x: bestB.q.x, z: bestB.q.z, yaw, len, w: Math.max(3.4, rd.w + 0.8), water: bestB.q.w, y0: H(e0.x, e0.z), y1: H(e1.x, e1.z) });
				bestB = null;
			}
			inW = wet;
		}
	}

	// ---------- fields in hedgerows round the town ----------
	const maxFields = opts.isPhone ? 6 : 9;
	for (let tries = 0; tries < 420 && realm.fields.length < maxFields; tries++) {
		const a = r() * TAU, d = 85 + r() * 190, x = T.x + Math.cos(a) * d, z = T.z + Math.sin(a) * d;
		const w = 30 + r() * 26, dd = 22 + r() * 18, yaw = a + (r() - 0.5) * 0.4 + (r() < 0.5 ? Math.PI / 2 : 0);
		const c = Math.cos(yaw), s = Math.sin(yaw), rad = Math.hypot(w, dd) / 2;
		if (inPoly(x, z) < rad + 14 || blocked(x, z, rad) || !free(x, z, rad) || realm.fields.some((f) => Math.hypot(f.x - x, f.z - z) < f.rad + rad + 3)) continue;
		let ok = true;
		for (let u = -0.5; u <= 0.5 && ok; u += 0.125) for (let v = -0.5; v <= 0.5 && ok; v += 0.125) {
			const px = x + c * u * w + s * v * dd, pz = z - s * u * w + c * v * dd;
			if (H(px, pz) < 2 || island.normalAt(px, pz).y < 0.94 || roadDist(px, pz) < 2.5 || riverDist(px, pz).d < (riverDist(px, pz).b || 0) + 4 || coast(px, pz) < 25) ok = false;
		}
		if (!ok) continue;
		const crop = realm.fields.length === 1 ? 'pasture' : realm.fields.length === 3 ? 'cabbage' : r() < 0.55 ? 'wheat' : r() < 0.5 ? 'barley' : 'fallow';
		realm.fields.push({ x, z, yaw, w, d: dd, rad, crop, gate: Math.floor(r() * 4), hay: crop === 'fallow' || r() < 0.3 });
		plots.push({ x, z, rad: rad + 2 });
	}

	// ---------- what nothing grows on ----------
	realm.clear.push({ x: T.x, z: T.z, r: 80 });
	for (const b of realm.houses) if (Math.hypot(b.x - T.x, b.z - T.z) > 70) realm.clear.push({ x: b.x, z: b.z, r: b.rad + 3 });
	// (a windmill wants open ground round it for the wind)
	for (const k of ['windmill', 'watermill']) if (realm[k]) realm.clear.push({ x: realm[k].x, z: realm[k].z, r: k === 'windmill' ? 36 : 12 });
	for (const w of realm.watchtowers) realm.clear.push({ x: w.x, z: w.z, r: 7 });
	if (realm.stones) realm.clear.push({ x: realm.stones.x, z: realm.stones.z, r: 14 });
	for (const f of realm.fields) {
		const c = Math.cos(f.yaw), s = Math.sin(f.yaw), cr = Math.min(f.w, f.d) / 2 + 1;
		for (let u = -f.w / 2 + cr * 0.8; u <= f.w / 2 - cr * 0.8 + 0.01; u += cr * 1.2) realm.clear.push({ x: f.x + c * u, z: f.z - s * u, r: cr + 1 });
	}
	for (const b of realm.bridges) realm.clear.push({ x: b.x, z: b.z, r: b.len / 2 + 2 });
	// arrivals come down on the road into the town, the castle on its hill before them
	const L0 = lanes[0], sp = L0.pts[Math.min(L0.pts.length - 1, 9)];
	island.spawn = { x: sp.x, z: sp.z, yaw: Math.atan2(-(castle.x - sp.x), -(castle.z - sp.z)) };
	return realm;
}

// ---------- the dungeons, once the caves are known ----------
// Three ways down: the crypt under the chapel, the castle's cellars, and a barrow in the
// hills. Each is a stair, then vaults and passages cut in the rock; where one comes near
// the natural caves a passage breaks through into them (a short natural tunnel added to
// the cave plan, so the rock is carved to meet the masonry).
export function planDungeons(realm, island, cavePlan, makeField) {
	if (!realm || !cavePlan) return;
	const r = mulberry32((island.seed ^ 0xd06e0) >>> 0);
	const H = island.heightAt;
	const field = cavePlan.field;
	const boxes = [];
	// a room: centre, half sizes, yaw (its local +z along yaw), floor y (at lz = -hd; rising by slope along +z), height
	const mk = (x, z, hw, hd, yaw, fy, h, slope = 0, kind = 'room') => ({ x, z, hw, hd, yaw, fy, h, slope, kind, c: Math.cos(yaw), s: Math.sin(yaw) });
	const toW = (b, lx, lz) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c];
	const floorAt = (b, lz) => b.fy + (lz + b.hd) * b.slope;
	// clear of the caves (unless meant to meet them), under enough rock, off other boxes
	const sound = (b, cover = 2.6, meet = null) => {
		for (let u = -1; u <= 1.001; u += 0.25) for (let v = -1; v <= 1.001; v += 0.125) {
			const lx = u * (b.hw + 1.2), lz = v * (b.hd + 1.2), [x, z] = toW(b, lx, lz), fl = floorAt(b, clamp(lz, -b.hd, b.hd));
			if (meet && Math.hypot(x - meet.x, z - meet.z) < meet.r) continue;
			// (a stair's head is open to the sky: only its lower reach must be under rock)
			if (b.kind !== 'stair' || b.fy - fl > b.h + 1.5) if (H(x, z) - (fl + b.h) < cover) return false;
			for (const y of [fl - 1, fl + b.h * 0.5, fl + b.h + 1]) if (field.cave(x, y, z) < 2.5) return false;
		}
		for (const o of boxes) if (o.dungeon !== b.dungeon && Math.hypot(o.x - b.x, o.z - b.z) < Math.hypot(o.hw, o.hd) + Math.hypot(b.hw, b.hd) + 3 && Math.abs(o.fy - b.fy) < 8) return false;
		return true;
	};
	const tunnels = cavePlan.tunnels, chambers = cavePlan.chambers;
	// the nearest place in the caves to walk into from (x, y, z): a tunnel point or a chamber's floor
	const nearestCave = (x, y, z, maxD) => {
		let best = null;
		for (const t of tunnels) for (let i = 3; i < t.pts.length - 3; i += 2) {
			const p = t.pts[i], d = Math.hypot(p.x - x, p.z - z);
			if (d > maxD || d < 14) continue;
			const s = d + Math.abs(p.y - y) * 2.2;
			if (!best || s < best.s) best = { s, x: p.x, z: p.z, y: p.y, w: p.w };
		}
		for (const c of chambers) {
			const d = Math.hypot(c.x - x, c.z - z) - Math.min(c.rx, c.rz) * 0.6;
			if (d > maxD || d < 14) continue;
			const a = Math.atan2(z - c.z, x - c.x), px = c.x + Math.cos(a) * Math.min(c.rx, c.rz) * 0.5, pz = c.z + Math.sin(a) * Math.min(c.rx, c.rz) * 0.5;
			const s = d + Math.abs(c.fy - y) * 2.2 - 6;
			if (!best || s < best.s) best = { s, x: px, z: pz, y: c.fy, w: 3, chamber: c };
		}
		return best;
	};
	const extraTunnels = [];

	// one dungeon: a stair down from (x, z) heading yaw, then its rooms
	const dig = (id, name, x, z, yaw, opts) => {
		const y0 = H(x, z);
		const first = boxes.length;
		const D = { id, name, x, z, y0, yaw, rooms: [], stair: null, breach: null, depth: opts.depth };
		// the stair: 2.4 m wide, a steady 0.55 fall, 3.2 m of headroom, to a floor well under the rock
		let fy = y0 - opts.depth;
		const slope = 0.55;
		const L = (y0 - fy) / slope;
		const sb = mk(x + Math.sin(yaw) * L / 2, z + Math.cos(yaw) * L / 2, 1.3, L / 2, yaw, y0, 3.2, -slope, 'stair');
		sb.fy = y0 + 0.02; sb.dungeon = id; sb.openA = true;
		// (the stair's floor: y0 at its top end, falling along +z)
		if (!sound(sb, 0)) return null;
		boxes.push(sb); D.stair = sb;
		// rooms along the way: a landing, then halls and passages that turn as they go
		const cx = x + Math.sin(yaw) * (L - 0.3), cz = z + Math.cos(yaw) * (L - 0.3);
		let hd = yaw;
		// how far from a box's middle to its wall, heading a
		const ray = (b, a) => { const c = Math.abs(Math.cos(a - b.yaw)), s2 = Math.abs(Math.sin(a - b.yaw)); return Math.min(c > 1e-3 ? b.hd / c : 1e9, s2 > 1e-3 ? b.hw / s2 : 1e9); };
		const plan = opts.rooms;
		let prev = sb;
		for (let i = 0; i < plan.length; i++) {
			const R0 = plan[i];
			let placed = null;
			for (const turn of [0, 0.5, -0.5, Math.PI / 2, -Math.PI / 2]) {
				const a = hd + turn * (i === 0 ? 0 : 1);
				// a passage from the last room, then the room
				const pl = R0.pass ?? 8;
				const px0 = i === 0 ? cx : prev.x + Math.sin(a) * ray(prev, a);
				const pz0 = i === 0 ? cz : prev.z + Math.cos(a) * ray(prev, a);
				const pass = pl > 0 ? mk(px0 + Math.sin(a) * pl / 2, pz0 + Math.cos(a) * pl / 2, 1.2, pl / 2 + 1, a, fy, 3.0, 0, 'pass') : null;
				const rx = px0 + Math.sin(a) * (pl + R0.d / 2 - 0.5), rz = pz0 + Math.cos(a) * (pl + R0.d / 2 - 0.5);
				const room = mk(rx, rz, R0.w / 2, R0.d / 2, a, fy, R0.h || 4.6, 0, R0.kind);
				room.dungeon = id; if (pass) pass.dungeon = id;
				if (pass && !sound(pass)) continue;
				if (!sound(room)) continue;
				placed = { room, pass, a };
				break;
			}
			if (!placed) break;
			if (placed.pass) boxes.push(placed.pass);
			boxes.push(placed.room);
			D.rooms.push(placed.room);
			prev = placed.room; hd = placed.a;
		}
		if (!D.rooms.length) { boxes.length = first; return null; }
		// break through to the caves, from the room nearest them
		if (opts.breach !== false) {
			let bestB = null;
			for (const room of D.rooms) {
				const t = nearestCave(room.x, room.fy, room.z, opts.reach || 150);
				if (t && (!bestB || t.s < bestB.t.s)) bestB = { room, t };
			}
			if (bestB) {
				const { room, t } = bestB;
				const a = Math.atan2(t.x - room.x, t.z - room.z);
				const edge = ray(room, a);
				const sx = room.x + Math.sin(a) * edge, sz = room.z + Math.cos(a) * edge;
				const dist = Math.hypot(t.x - sx, t.z - sz);
				// masonry for most of the way, the last stretch natural rock
				const natural = Math.min(14, Math.max(6, dist * 0.3));
				const mlen = Math.max(4, dist - natural);
				// the natural stretch rises or falls at most 0.3; the masonry takes the rest in
				// steps (at most 0.5)
				const endY = t.y - clamp(t.y - room.fy, -0.3 * natural, 0.3 * natural);
				const sl = (endY - room.fy) / mlen;
				const pass = mk(sx + Math.sin(a) * mlen / 2, sz + Math.cos(a) * mlen / 2, 1.2, mlen / 2 + 0.6, a, room.fy, 3.0, sl, 'breach');
				pass.fy = room.fy - sl * 0.6; pass.dungeon = id; pass.openB = true;
				const ex = sx + Math.sin(a) * mlen, ez = sz + Math.cos(a) * mlen;
				const meet = { x: ex, z: ez, r: 3.5 };
				if (Math.abs(sl) <= 0.5 && sound(pass, 2.6, meet)) {
					// the natural tunnel: from inside the masonry's end to the cave
					const pts = [];
					const n = Math.max(3, Math.ceil(natural / 3) + 1);
					for (let k = 0; k <= n; k++) {
						const u = k / n, x2 = ex - Math.sin(a) * 1.5 + (t.x - ex + Math.sin(a) * 1.5) * u, z2 = ez - Math.cos(a) * 1.5 + (t.z - ez + Math.cos(a) * 1.5) * u;
						pts.push({ x: x2, z: z2, y: endY + (t.y - endY) * smoothstep(0, 1, u), w: 2.2 + 0.6 * u, h: 3.3 + 0.6 * u });
					}
					let ok = true;
					for (const p of pts) if (H(p.x, p.z) - (p.y + p.h) < 2.5) ok = false;
					if (ok) {
						boxes.push(pass);
						extraTunnels.push({ pts, mouth: false, amp: 1.2, dungeon: id });
						D.breach = { x: ex, z: ez, y: endY, yaw: a, box: pass, cave: t, pts };
					}
				}
			}
		}
		D.boxes = boxes.slice(first);
		return D;
	};

	const want = [];
	// the crypt: beside the chapel, going down away from the square
	const ch = realm.chapel;
	if (ch) {
		const side = r() < 0.5 ? 1 : -1;
		const x = ch.x + Math.cos(ch.yaw) * side * (ch.w / 2 + 3.2) - Math.sin(ch.yaw) * 2, z = ch.z - Math.sin(ch.yaw) * side * (ch.w / 2 + 3.2) - Math.cos(ch.yaw) * 2;
		want.push(['crypt', 'The Crypt', x, z, ch.yaw + Math.PI, { depth: 11, rooms: [{ kind: 'tomb', w: 9, d: 12, pass: 0 }, { kind: 'ossuary', w: 7, d: 9 }, { kind: 'vault', w: 11, d: 11 }], reach: 170 }]);
	}
	// the cellars: down from the bailey, under the castle
	const C = realm.castle;
	{
		const a = C.gate.yaw + Math.PI / 2 * (r() < 0.5 ? 1 : -1);
		const x = C.x + Math.sin(a) * 13, z = C.z + Math.cos(a) * 13;
		want.push(['cellar', 'The Castle Cellars', x, z, a + Math.PI / 2, { depth: 12, rooms: [{ kind: 'store', w: 10, d: 10, pass: 0 }, { kind: 'gaol', w: 8, d: 12 }, { kind: 'hall', w: 12, d: 14 }], reach: 190 }]);
	}
	for (const w of want) {
		const D = dig(...w);
		if (D) realm.dungeons.push(D);
	}
	// the barrow: on a hillside over the caves, sited so its passages reach them
	{
		let bestS = null;
		for (const t of tunnels) for (let i = 4; i < t.pts.length - 4; i += 3) {
			const p = t.pts[i];
			for (let k = 0; k < 8; k++) {
				const a = k / 8 * TAU + r() * 0.3, d = 42 + r() * 26, x = p.x - Math.sin(a) * d, z = p.z - Math.cos(a) * d, h = H(x, z);
				const depth = h - p.y;
				if (depth < 12 || depth > 26 || island.normalAt(x, z).y < 0.9 || island.coastAt(x, z) < 60) continue;
				if (realm.clear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 18)) continue;
				if (cavePlan.holes.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + 30)) continue;
				if (realm.roadDist(x, z) < 8) continue;
				const s = -Math.abs(depth - 16) + r() * 4;
				if (!bestS || s > bestS.s) bestS = { s, x, z, a, depth };
			}
		}
		if (bestS) {
			const D = dig('barrow', 'The Barrow', bestS.x, bestS.z, bestS.a, { depth: Math.min(bestS.depth - 2, 14), rooms: [{ kind: 'barrowhall', w: 8, d: 10, pass: 0 }, { kind: 'tomb', w: 9, d: 9 }], reach: 90 });
			if (D) { realm.dungeons.push(D); realm.barrow = { x: bestS.x, z: bestS.z, y: H(bestS.x, bestS.z), yaw: bestS.a }; }
		}
	}
	// the caves take the new passages, and the field is made again with them
	if (extraTunnels.length && makeField) {
		cavePlan.tunnels.push(...extraTunnels);
		cavePlan.field = makeField({ chambers: cavePlan.chambers, tunnels: cavePlan.tunnels, shaft: cavePlan.shaft, boulders: cavePlan.boulders, H, n3: cavePlan.n3, holes: cavePlan.holes });
	}
	// a hole in the ground over each stair's head, and no plants on it
	for (const D of realm.dungeons) {
		const s = D.stair, cxh = D.x + Math.sin(D.yaw) * 2.6, czh = D.z + Math.cos(D.yaw) * 2.6;
		D.hole = { x: cxh, z: czh, r: 4.2 };
		realm.clear.push({ x: cxh, z: czh, r: 7 });
		D.floorY = s.fy;
	}
	realm.boxes = boxes;
}

// a dungeon box's floor and frame, for the builders
export function boxFrame(b) {
	return {
		toW: (lx, lz) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c],
		toL: (x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; },
		floor: (lz) => b.fy + (lz + b.hd) * b.slope,
	};
}
