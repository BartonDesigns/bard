// The light of a building's own fixtures, worked out once when it is built (lighting.js puts
// it on the meshes and draws it). Plain numbers, no renderer: a test runs it as it is.
//
// For each vertex of the building's rooms:
//   - the light straight from every fixture near enough to matter: inverse square, the
//     cosine at the surface, the fixture's own spread (a downlight throws down, a bare bulb
//     all round, a spot in its cone), and a ray to it tested against the walls, floors and
//     big furniture (the building's solid boxes), so a wall shades the room behind it and a
//     table the floor under it;
//   - how much open sky it sees (rays out round its normal that leave the building through
//     a window or a door), which the day's skylight is scaled by, and how shut in it is close
//     by (the corners, the seams, under things), which darkens it;
//   - one bounce: each room's light, coloured by its walls and floor, given back to all of it.
// The result per vertex: the fixtures' light (rgb), the share of sky (a), and the direction
// most of the fixtures' light comes from (for their gleam on a polished floor).
//
// The geometry is cut finer first (tessellate) so a big floor has vertices enough to hold a
// pool of light under each fixture.

// ---------------------------------------------------------------------------------
// settings: a desktop's and a phone's
export const QUALITY = {
	desktop: { cell: 1.0, rays: 8, maxVerts: 240000 },
	phone: { cell: 1.6, rays: 5, maxVerts: 90000 },
};
// irradiance is kept to this (an encoding range: lighting.js packs it in 16 bits)
export const E_RANGE = 64;
const EPS_E = 0.004, AO_R = 0.9, SKY_MAX = 18, BOUNCE = 1.35, SHADOWED = 6;

// ---------------------------------------------------------------------------------
// fixtures: { p: [x, y, z], c: [r, g, b] (linear), I (candela, as a three.js point light),
//   shape: 'point' | 'down' | 'tube' | 'panel' | 'spot', n: facing ([0, -1, 0] for a ceiling),
//   axis, len (a tube), w, d (a panel), cone: [cos inner, cos outer] (a spot), on }
// each as a few point samples, each with how it spreads
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export function fixtureSamples(f) {
	const out = [], n = norm(f.n || [0, -1, 0]), c = f.c || [1, 0.85, 0.7], shape = f.shape || 'point';
	const push = (p, I, kind) => out.push({ x: p[0], y: p[1], z: p[2], nx: n[0], ny: n[1], nz: n[2], I, r: c[0], g: c[1], b: c[2], kind, ci: f.cone?.[0] ?? 0.9, co: f.cone?.[1] ?? 0.6, soft: f.soft ?? 0.06, beam: f.beam ?? 1.5 });
	if (shape === 'tube') {
		const a = norm(f.axis || [1, 0, 0]), len = f.len || 1.2, k = Math.max(2, Math.ceil(len / 0.45));
		for (let i = 0; i < k; i++) { const t = (i + 0.5) / k - 0.5; push([f.p[0] + a[0] * t * len, f.p[1] + a[1] * t * len, f.p[2] + a[2] * t * len], f.I / k, 1); }
	} else if (shape === 'panel') {
		// two axes across the panel, square to its facing
		const u = norm(Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [-n[2], 0, n[0]]), v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
		const w = f.w || 0.6, d = f.d || 0.6;
		for (const su of [-0.25, 0.25]) for (const sv of [-0.25, 0.25]) push([f.p[0] + u[0] * su * w + v[0] * sv * d, f.p[1] + u[1] * su * w + v[1] * sv * d, f.p[2] + u[2] * su * w + v[2] * sv * d], f.I / 4, 2);
	} else push(f.p, f.I, shape === 'spot' ? 3 : shape === 'down' ? 1 : 0);
	return out;
}
// how a sample throws its light toward direction (dx, dy, dz), from it to the surface
function spread(s, dx, dy, dz) {
	const c = s.nx * dx + s.ny * dy + s.nz * dz;
	if (s.kind === 0) return 1;                                   // a bare bulb, a lamp shade: all round
	if (s.kind === 1) return c > 0 ? 0.12 + 1.6 * Math.pow(c, s.beam) : 0.12;   // a downlight, a tube: a pool under it, some up and out
	if (s.kind === 2) return Math.max(0, c) * 1.15;               // a panel: its face only
	const t = Math.min(1, Math.max(0, (c - s.co) / Math.max(1e-3, s.ci - s.co)));
	return t * t * (3 - 2 * t);                                   // a spot: its cone
}

// ---------------------------------------------------------------------------------
// the solid boxes [x0, z0, x1, z1, y0, y1], in a grid over the plan for the rays
export function occluderGrid(boxes, bounds, cell = 1) {
	let [x0, z0, x1, z1] = bounds || [1e9, 1e9, -1e9, -1e9];
	if (!bounds) for (const b of boxes) { x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]); }
	if (!(x1 > x0)) { x0 = z0 = -1; x1 = z1 = 1; }
	x0 -= 0.5; z0 -= 0.5; x1 += 0.5; z1 += 0.5;
	const nx = Math.max(1, Math.min(256, Math.ceil((x1 - x0) / cell))), nz = Math.max(1, Math.min(256, Math.ceil((z1 - z0) / cell)));
	const cx = (x1 - x0) / nx, cz = (z1 - z0) / nz;
	const B = new Float32Array(boxes.length * 6);
	const lists = Array.from({ length: nx * nz }, () => []);
	boxes.forEach((b, i) => {
		B.set([b[0], b[4], b[1], b[2], b[5], b[3]], i * 6);
		const i0 = Math.max(0, Math.floor((b[0] - x0) / cx)), i1 = Math.min(nx - 1, Math.floor((b[2] - x0) / cx));
		const j0 = Math.max(0, Math.floor((b[1] - z0) / cz)), j1 = Math.min(nz - 1, Math.floor((b[3] - z0) / cz));
		for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) lists[j * nx + k].push(i);
	});
	// (flattened: each cell's start and count into one index list)
	const start = new Int32Array(nx * nz + 1);
	for (let c = 0; c < nx * nz; c++) start[c + 1] = start[c] + lists[c].length;
	const idx = new Int32Array(start[nx * nz]);
	for (let c = 0; c < nx * nz; c++) idx.set(lists[c], start[c]);
	return { B, n: boxes.length, x0, z0, x1, z1, nx, nz, cx, cz, start, idx, stamp: new Int32Array(boxes.length), ray: 0 };
}
// the nearest hit of a ray from (ox, oy, oz) along unit (dx, dy, dz) within tmax, or -1; any:
// stop at the first (a shadow ray). A ray that leaves the grid has left the building. A box
// the ray starts in (or, for a shadow ray, ends in) does not count: a lamp inside its own
// stand, a floor's edge under a wall.
export function castRay(G, ox, oy, oz, dx, dy, dz, tmax, any) {
	const ex = ox + dx * tmax, ey = oy + dy * tmax, ez = oz + dz * tmax;
	const ray = ++G.ray;
	if (ray > 2e9) { G.stamp.fill(0); G.ray = 1; }
	const { B, x0, z0, nx, nz, cx, cz, start, idx, stamp } = G;
	// clip the ray to the grid
	let t0 = 0, t1 = tmax;
	const idx0 = dx !== 0 ? 1 / dx : 1e30, idz0 = dz !== 0 ? 1 / dz : 1e30;
	{
		let a = (x0 - ox) * idx0, b = (G.x1 - ox) * idx0;
		if (a > b) { const t = a; a = b; b = t; }
		if (dx === 0) { if (ox < x0 || ox > G.x1) return -1; } else { t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
		a = (z0 - oz) * idz0; b = (G.z1 - oz) * idz0;
		if (a > b) { const t = a; a = b; b = t; }
		if (dz === 0) { if (oz < z0 || oz > G.z1) return -1; } else { t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
		if (t0 > t1) return -1;
	}
	// walk the cells it crosses (Amanatides and Woo)
	let px = ox + dx * t0, pz = oz + dz * t0;
	let i = Math.min(nx - 1, Math.max(0, Math.floor((px - x0) / cx))), j = Math.min(nz - 1, Math.max(0, Math.floor((pz - z0) / cz)));
	const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
	const tdx = Math.abs(cx * idx0), tdz = Math.abs(cz * idz0);
	let tmx = dx !== 0 ? (x0 + (i + (dx > 0 ? 1 : 0)) * cx - ox) * idx0 : 1e30, tmz = dz !== 0 ? (z0 + (j + (dz > 0 ? 1 : 0)) * cz - oz) * idz0 : 1e30;
	let best = -1, bestT = t1;
	for (let guard = 0; guard < 1024; guard++) {
		const c = j * nx + i;
		for (let q = start[c], e = start[c + 1]; q < e; q++) {
			const k = idx[q];
			if (stamp[k] === ray) continue;
			stamp[k] = ray;
			const o = k * 6;
			if (ox >= B[o] && ox <= B[o + 3] && oy >= B[o + 1] && oy <= B[o + 4] && oz >= B[o + 2] && oz <= B[o + 5]) continue;
			if (any && ex >= B[o] && ex <= B[o + 3] && ey >= B[o + 1] && ey <= B[o + 4] && ez >= B[o + 2] && ez <= B[o + 5]) continue;
			// the slab test
			let lo = 0, hi = bestT, a, b;
			if (dx !== 0) { a = (B[o] - ox) * idx0; b = (B[o + 3] - ox) * idx0; if (a > b) { const t = a; a = b; b = t; } if (a > lo) lo = a; if (b < hi) hi = b; } else if (ox < B[o] || ox > B[o + 3]) continue;
			if (lo > hi) continue;
			if (dy !== 0) { const iy = 1 / dy; a = (B[o + 1] - oy) * iy; b = (B[o + 4] - oy) * iy; if (a > b) { const t = a; a = b; b = t; } if (a > lo) lo = a; if (b < hi) hi = b; } else if (oy < B[o + 1] || oy > B[o + 4]) continue;
			if (lo > hi) continue;
			if (dz !== 0) { a = (B[o + 2] - oz) * idz0; b = (B[o + 5] - oz) * idz0; if (a > b) { const t = a; a = b; b = t; } if (a > lo) lo = a; if (b < hi) hi = b; } else if (oz < B[o + 2] || oz > B[o + 5]) continue;
			if (lo > hi) continue;
			if (any) return lo;
			best = k; bestT = lo;
		}
		// (a hit nearer than the next cell's edge is the nearest)
		const tNext = Math.min(tmx, tmz);
		if (best >= 0 && bestT <= tNext) return bestT;
		if (tNext > t1) break;
		if (tmx < tmz) { i += si; tmx += tdx; if (i < 0 || i >= nx) break; } else { j += sj; tmz += tdz; if (j < 0 || j >= nz) break; }
	}
	return best >= 0 ? bestT : -1;
}

// ---------------------------------------------------------------------------------
// cutting the geometry finer: attrs { name: { array, size } } non-indexed triangles. Two
// triangles that make a flat four-sided face are cut as a grid, the rest as triangles; every
// attribute is carried along (interpolated)
// mark: a vertex the list is split at (a shell's own vertices before it, housekit.js sunCast);
// the result's mark is where that split falls in the finer list (no quad is made across it);
// marks: more of them, the same way (a cooler door's own vertices: bay/cooler-doors.js)
export function tessellate(attrs, count, cell, mark = -1, marks = null) {
	const P = attrs.position.array, names = Object.keys(attrs), N = attrs.normal?.array;
	const out = {};
	for (const k of names) out[k] = { size: attrs[k].size, list: [] };
	const sameP = (a, b) => Math.abs(P[a * 3] - P[b * 3]) < 1e-5 && Math.abs(P[a * 3 + 1] - P[b * 3 + 1]) < 1e-5 && Math.abs(P[a * 3 + 2] - P[b * 3 + 2]) < 1e-5;
	const sameN = (a, b) => !N || N[a * 3] * N[b * 3] + N[a * 3 + 1] * N[b * 3 + 1] + N[a * 3 + 2] * N[b * 3 + 2] > 0.999;
	const dist = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
	// a vertex mixed from corners with weights
	const emit = (vs, ws) => {
		for (const k of names) {
			const A = attrs[k].array, s = attrs[k].size, L = out[k].list;
			for (let c = 0; c < s; c++) { let v = 0; for (let q = 0; q < vs.length; q++) v += A[vs[q] * s + c] * ws[q]; L.push(v); }
		}
	};
	const copy = (v) => { for (const k of names) { const A = attrs[k].array, s = attrs[k].size, L = out[k].list; for (let c = 0; c < s; c++) L.push(A[v * s + c]); } };
	const ntri = count / 3, cuts = marks?.length ? new Set(marks) : null, cutAt = new Map();
	let t = 0, markAt = -1;
	while (t < ntri) {
		const a = t * 3, T0 = [a, a + 1, a + 2];
		if (a === mark) markAt = out.position.list.length / 3;
		if (cuts?.has(a)) cutAt.set(a, out.position.list.length / 3);
		// a quad: the next triangle shares two corners with this one and lies flat with it
		if (t + 1 < ntri && a + 3 !== mark && !cuts?.has(a + 3)) {
			const T1 = [a + 3, a + 4, a + 5], shared = [];
			for (const p of T0) for (const q of T1) if (sameP(p, q) && sameN(p, q)) shared.push([p, q]);
			if (shared.length === 2) {
				const u = T0.find((p) => !shared.some((s) => s[0] === p)), w = T1.find((q) => !shared.some((s) => s[1] === q));
				const j = T0.indexOf(u), A = T0[(j + 1) % 3], Bv = T0[(j + 2) % 3];
				// (w on the plane of the first)
				const e1 = [P[A * 3] - P[u * 3], P[A * 3 + 1] - P[u * 3 + 1], P[A * 3 + 2] - P[u * 3 + 2]], e2 = [P[Bv * 3] - P[u * 3], P[Bv * 3 + 1] - P[u * 3 + 1], P[Bv * 3 + 2] - P[u * 3 + 2]];
				const nn = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
				const off = (P[w * 3] - P[u * 3]) * nn[0] + (P[w * 3 + 1] - P[u * 3 + 1]) * nn[1] + (P[w * 3 + 2] - P[u * 3 + 2]) * nn[2];
				if (Math.abs(off) < 1e-4) {
					const nu = Math.max(1, Math.ceil(Math.max(dist(u, A), dist(Bv, w)) / cell - 0.05)), nv = Math.max(1, Math.ceil(Math.max(dist(u, Bv), dist(A, w)) / cell - 0.05));
					if (nu === 1 && nv === 1) { for (let q = 0; q < 6; q++) copy(a + q); t += 2; continue; }
					const V = (s, r) => emit([u, A, w, Bv], [(1 - s) * (1 - r), s * (1 - r), s * r, (1 - s) * r]);
					for (let jv = 0; jv < nv; jv++) for (let iu = 0; iu < nu; iu++) {
						const s0 = iu / nu, s1 = (iu + 1) / nu, r0 = jv / nv, r1 = (jv + 1) / nv;
						V(s0, r0); V(s1, r0); V(s1, r1); V(s0, r0); V(s1, r1); V(s0, r1);
					}
					t += 2;
					continue;
				}
			}
		}
		const n = Math.max(1, Math.ceil(Math.max(dist(a, a + 1), dist(a + 1, a + 2), dist(a + 2, a)) / cell - 0.05));
		if (n === 1) { copy(a); copy(a + 1); copy(a + 2); t++; continue; }
		const V = (i, j) => emit(T0, [1 - (i + j) / n, i / n, j / n]);
		for (let j = 0; j < n; j++) for (let i = 0; i + j < n; i++) {
			V(i, j); V(i + 1, j); V(i, j + 1);
			if (i + j < n - 1) { V(i + 1, j); V(i + 1, j + 1); V(i, j + 1); }
		}
		t++;
	}
	const res = {};
	for (const k of names) res[k] = { size: out[k].size, array: new Float32Array(out[k].list) };
	const n = res.position.array.length / 3;
	return { attrs: res, count: n, mark: mark < 0 ? null : markAt >= 0 ? markAt : n, marks: marks ? marks.map((m) => cutAt.get(m) ?? n) : null };
}
// how many vertices tessellate would make, to pick a cell that keeps within a budget
export function tessellatedCount(P, count, cell) {
	let n = 0;
	for (let a = 0; a < count; a += 3) {
		const d = (p, q) => Math.hypot(P[p * 3] - P[q * 3], P[p * 3 + 1] - P[q * 3 + 1], P[p * 3 + 2] - P[q * 3 + 2]);
		// (each triangle as half a grid of its two shorter sides: near enough for a budget)
		const s = [d(a, a + 1), d(a + 1, a + 2), d(a + 2, a)].sort((x, y) => x - y);
		n += 3 * Math.max(1, Math.ceil(s[0] / cell) * Math.ceil(s[1] / cell));
	}
	return n;
}

// ---------------------------------------------------------------------------------
// the bake. ctx: {
//   fixtures: [fixture], boxes: [[x0, z0, x1, z1, y0, y1]] (what stops light),
//   bounds: [x0, z0, x1, z1] (the plan: a ray past it is outside), slabs: [[y0, y1]] (each
//   level's floor and ceiling heights: solid between levels, inside the bounds),
//   roomOf(x, y, z) -> room number or -1, rays, sky: false to leave the skylight as it is
//   (furniture in rooms whose walls are not here to shade it)
// }
// meshes: [{ P, N, C (albedo per vertex, rgb, or null), base: [r, g, b], count }]
// A generator: yields every few milliseconds when budget(ms) says so; returns per mesh
// { light: Float32Array(count * 4), dir: Float32Array(count * 4), night: Float32Array(count) }
// (night: the share of the light that comes from the fixtures left on at night, those not
// marked night: false; 1 where every lamp stays on).
export function* bake(meshes, ctx, budget = () => false) {
	const rays = ctx.rays ?? QUALITY.desktop.rays;
	const boxes = [...(ctx.boxes || [])];
	const bounds = ctx.bounds;
	// the floors and ceilings: thin slabs over the whole plan
	if (bounds) for (const [y0, y1] of ctx.slabs || []) { boxes.push([bounds[0], bounds[1], bounds[2], bounds[3], y0 - 0.25, y0]); boxes.push([bounds[0], bounds[1], bounds[2], bounds[3], y1, y1 + 0.25]); }
	const G = occluderGrid(boxes, bounds, 1);
	// (above the top ceiling is out of the building too)
	const hiY = Math.max(-1e9, ...(ctx.slabs || []).map((q) => q[1] + 0.3));
	// the fixtures as samples, with the reach of each (where it falls below what shows)
	// (each fixture's samples together: F0[f] .. F0[f + 1])
	const S = [], F0 = [0];
	for (const f of ctx.fixtures || []) { if (f.on === false) continue; for (const s of fixtureSamples(f)) { s.reach = Math.sqrt(s.I * 1.2 / EPS_E); s.fi = F0.length - 1; s.night = f.night !== false; S.push(s); } F0.push(S.length); }
	const nF = F0.length - 1;
	const sE = new Float64Array(S.length), wS = new Float64Array(S.length), sL = new Float64Array(S.length * 4), FE = new Float64Array(nF), pick = new Int32Array(Math.min(nF, SHADOWED)), seenF = new Uint8Array(nF);
	// the sky rays: a fixed spread over the hemisphere, cosine-weighted (a spiral)
	const dirs = [];
	for (let i = 0; i < rays; i++) { const r = Math.sqrt((i + 0.5) / rays), a = i * 2.39996323; dirs.push([r * Math.cos(a), r * Math.sin(a), Math.sqrt(Math.max(0, 1 - r * r))]); }
	const roomOf = ctx.roomOf || (() => -1);
	const nRooms = Math.max(1, ctx.rooms || 1);
	// per room: area, light times albedo, sky times albedo (for the bounce)
	const RA = new Float64Array(nRooms), RE = new Float64Array(nRooms * 3), RS = new Float64Array(nRooms), RN = new Float64Array(nRooms);
	const results = [];
	let tick = 0;
	// (a vertex shared by many triangles is worked out once: keyed by position and facing)
	const seen = new Map();
	for (const m of meshes) {
		const n = m.count, P = m.P, N = m.N, C = m.C, base = m.base || [0.7, 0.7, 0.7];
		const light = new Float32Array(n * 4), dir = new Float32Array(n * 4), room = new Int16Array(n), aoA = new Float32Array(n), nightL = new Float32Array(n);
		// (each vertex's share of its triangle's area; loose points count a square metre)
		const area = new Float32Array(n).fill(n % 3 ? 1 : 0);
		for (let a = 0; a < n && !(n % 3); a += 3) {
			const e1x = P[a * 3 + 3] - P[a * 3], e1y = P[a * 3 + 4] - P[a * 3 + 1], e1z = P[a * 3 + 5] - P[a * 3 + 2];
			const e2x = P[a * 3 + 6] - P[a * 3], e2y = P[a * 3 + 7] - P[a * 3 + 1], e2z = P[a * 3 + 8] - P[a * 3 + 2];
			const ar = 0.5 * Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x) / 3;
			area[a] = area[a + 1] = area[a + 2] = ar;
		}
		for (let v = 0; v < n; v++) {
			if ((++tick & 31) === 0 && budget()) yield;
			const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2];
			let nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
			const nl = Math.hypot(nx, ny, nz) || 1;
			nx /= nl; ny /= nl; nz /= nl;
			const key = qkey(px, py, pz, nx, ny, nz);
			const known = seen.get(key);
			let r = 0, g = 0, b = 0, ddx = 0, ddy = 0, ddz = 0, eSum = 0, sky = 0, ao = 0, rn = 0;
			if (known) { [r, g, b, sky, ao, ddx, ddy, ddz, eSum, rn] = known; }
			else {
				// start a little off the surface, so the ray does not find what it starts on
				const ox = px + nx * 0.03, oy = py + ny * 0.03, oz = pz + nz * 0.03;
				// each sample's light, unshaded, and each fixture's
				FE.fill(0);
				for (let i = 0; i < S.length; i++) {
					const s = S[i];
					sE[i] = 0;
					let lx = s.x - ox, ly = s.y - oy, lz = s.z - oz;
					const d2 = lx * lx + ly * ly + lz * lz;
					if (d2 > s.reach * s.reach) continue;
					const d = Math.sqrt(d2) || 1e-4;
					lx /= d; ly /= d; lz /= d;
					const cs = lx * nx + ly * ny + lz * nz;
					if (cs <= 0) continue;
					const sp = spread(s, -lx, -ly, -lz);
					if (sp <= 0) continue;
					const E = s.I * sp * cs / (d2 + s.soft);
					if (E < EPS_E) continue;
					sE[i] = E; sL[i * 4] = lx; sL[i * 4 + 1] = ly; sL[i * 4 + 2] = lz; sL[i * 4 + 3] = d;
					FE[s.fi] += E;
				}
				// the brightest few tested against the walls (the nearest of them sample by
				// sample, for soft edges); the rest shaded as those were on the whole
				let np = 0;
				seenF.fill(0);
				for (; np < pick.length; np++) {
					let best = -1, bE = EPS_E;
					for (let f = 0; f < nF; f++) if (!seenF[f] && FE[f] > bE) { bE = FE[f]; best = f; }
					if (best < 0) break;
					seenF[best] = 1; pick[np] = best;
				}
				let tot = 0, vis = 0;
				wS.fill(0);
				for (let k = 0; k < np; k++) {
					const f = pick[k], a0 = F0[f], a1 = F0[f + 1];
					tot += FE[f];
					if (k < 2 || a1 - a0 === 1) {
						for (let i = a0; i < a1; i++) if (sE[i] > 0 && castRay(G, ox, oy, oz, sL[i * 4], sL[i * 4 + 1], sL[i * 4 + 2], sL[i * 4 + 3] - 0.1, true) < 0) { wS[i] = 1; vis += sE[i]; }
					} else {
						let m = a0;
						for (let i = a0; i < a1; i++) if (sE[i] > sE[m]) m = i;
						if (castRay(G, ox, oy, oz, sL[m * 4], sL[m * 4 + 1], sL[m * 4 + 2], sL[m * 4 + 3] - 0.1, true) < 0) { for (let i = a0; i < a1; i++) wS[i] = 1; vis += FE[f]; }
					}
				}
				if (np === pick.length && tot > 0) {
					const q = vis / tot;
					if (q > 0) for (let i = 0; i < S.length; i++) if (!seenF[S[i].fi]) wS[i] = q;
				}
				for (let i = 0; i < S.length; i++) {
					const E = sE[i] * wS[i];
					if (E <= 0) continue;
					const s = S[i];
					r += E * s.r; g += E * s.g; b += E * s.b; ddx += sL[i * 4] * E; ddy += sL[i * 4 + 1] * E; ddz += sL[i * 4 + 2] * E; eSum += E;
					// (the night lights' share: the few left on after hours)
					if (s.night) rn += E * (s.r + s.g + s.b) / 3;
				}
				// the sky and the corners: rays round the normal
				if (ctx.sky !== false) {
					const tx0 = Math.abs(ny) < 0.9 ? 0 : 1, ty0 = Math.abs(ny) < 0.9 ? 1 : 0;
					// a frame round the normal, turned a little per vertex so the rays do not band
					let ux = ty0 * nz - 0 * ny, uy = 0 * nx - tx0 * nz, uz = tx0 * ny - ty0 * nx;
					const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
					const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
					const rot = ((px * 12.9898 + pz * 78.233 + py * 37.719) % 6.2832 + 6.2832) % 6.2832, cr = Math.cos(rot), sr = Math.sin(rot);
					for (let i = 0; i < dirs.length; i++) {
						const [a0, b0, c0] = dirs[i], a1 = a0 * cr - b0 * sr, b1 = a0 * sr + b0 * cr;
						const dx = ux * a1 + vx * b1 + nx * c0, dy = uy * a1 + vy * b1 + ny * c0, dz = uz * a1 + vz * b1 + nz * c0;
						const t = castRay(G, ox, oy, oz, dx, dy, dz, SKY_MAX, false);
						// (out of the building, that is sky; a long way across a hall without, not)
						if (t >= 0) ao += Math.min(1, t / AO_R);
						else { ao += 1; const ex = ox + dx * SKY_MAX, ez = oz + dz * SKY_MAX; if (!bounds || ex < bounds[0] || ex > bounds[2] || ez < bounds[1] || ez > bounds[3] || oy + dy * SKY_MAX > hiY) sky += 1; }
					}
					sky /= dirs.length; ao /= dirs.length;
				} else { sky = 1; ao = 1; }
				seen.set(key, [r, g, b, sky, ao, ddx, ddy, ddz, eSum, rn]);
			}
			light[v * 4] = r; light[v * 4 + 1] = g; light[v * 4 + 2] = b; light[v * 4 + 3] = sky;
			const dl = Math.hypot(ddx, ddy, ddz);
			if (dl > 1e-6) { dir[v * 4] = ddx / dl; dir[v * 4 + 1] = ddy / dl; dir[v * 4 + 2] = ddz / dl; dir[v * 4 + 3] = Math.min(1, dl / Math.max(eSum, 1e-6)); }
			aoA[v] = ao; nightL[v] = rn;
			// the room it belongs to: the one it faces
			const rm = roomOf(px + nx * 0.15, py + ny * 0.15, pz + nz * 0.15);
			room[v] = rm;
			if (rm >= 0 && rm < nRooms) {
				const al = C ? [C[v * 3] * base[0], C[v * 3 + 1] * base[1], C[v * 3 + 2] * base[2]] : base, ar = area[v];
				RA[rm] += ar; RE[rm * 3] += r * al[0] * ar; RE[rm * 3 + 1] += g * al[1] * ar; RE[rm * 3 + 2] += b * al[2] * ar;
				RS[rm] += sky * (al[0] + al[1] + al[2]) / 3 * ar;
				RN[rm] += rn * (al[0] + al[1] + al[2]) / 3 * ar;
			}
		}
		results.push({ light, dir, room, ao: aoA, nightL });
	}
	// the bounce: each room's light given back to all of it, less in its corners
	for (let mi = 0; mi < results.length; mi++) {
		const R = results[mi];
		for (let i = 0; i < R.room.length; i++) {
			const rm = R.room[i];
			if (rm >= 0 && rm < nRooms && RA[rm] > 0) {
				const k = BOUNCE * (0.3 + 0.7 * R.ao[i]) / RA[rm];
				R.light[i * 4] += RE[rm * 3] * k; R.light[i * 4 + 1] += RE[rm * 3 + 1] * k; R.light[i * 4 + 2] += RE[rm * 3 + 2] * k;
				R.light[i * 4 + 3] = Math.min(1, R.light[i * 4 + 3] + RS[rm] * k * 1.2);
				R.nightL[i] += RN[rm] * k;
			}
			// the night lights' share of all the light here (1 where every lamp stays on)
			const all = (R.light[i * 4] + R.light[i * 4 + 1] + R.light[i * 4 + 2]) / 3;
			R.nightL[i] = all > 1e-5 ? Math.min(1, R.nightL[i] / all) : 1;
		}
		if ((mi & 3) === 3 && budget()) yield;
	}
	return results.map((R) => ({ light: R.light, dir: R.dir, night: R.nightL }));
}
// a vertex's key: its position to the millimetre and its facing roughly (52 bits)
function qkey(x, y, z, nx, ny, nz) {
	const q = (v) => Math.max(0, Math.min(32767, Math.round(v * 100) + 16384));
	const nq = (v) => Math.round(v * 2) + 2;
	return ((q(x) * 32768 + q(y)) * 32768 + q(z)) * 128 + (nq(nx) * 25 + nq(ny) * 5 + nq(nz));
}

// ---------------------------------------------------------------------------------
// fixtures found in geometry: the triangles of a lamp's material, in the pieces they make
// (each shade, tube, panel or screen one), with where each is, how big, which way it faces.
// tris: [{ P, C?, count }]; returns [{ p, size: [sx, sy, sz], area, n: mean facing, c }]
export function findPieces(meshes) {
	const out = [];
	for (const m of meshes) {
		const P = m.P, n = m.count, parent = new Int32Array(n).map((_, i) => i);
		const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
		const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
		// the triangle's corners belong together; so do corners at one place (to the centimetre)
		const at = new Map();
		for (let v = 0; v < n; v++) {
			if (v % 3) join(v, v - (v % 3));
			const k = Math.round(P[v * 3] * 100) + ',' + Math.round(P[v * 3 + 1] * 100) + ',' + Math.round(P[v * 3 + 2] * 100);
			const o = at.get(k);
			if (o === undefined) at.set(k, v); else join(v, o);
		}
		const acc = new Map();
		for (let a = 0; a < n; a += 3) {
			const id = find(a);
			let A = acc.get(id);
			if (!A) acc.set(id, A = { lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9], area: 0, c: [0, 0, 0], n: [0, 0, 0], tri: [] });
			const e1 = [P[a * 3 + 3] - P[a * 3], P[a * 3 + 4] - P[a * 3 + 1], P[a * 3 + 5] - P[a * 3 + 2]], e2 = [P[a * 3 + 6] - P[a * 3], P[a * 3 + 7] - P[a * 3 + 1], P[a * 3 + 8] - P[a * 3 + 2]];
			const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], ar = Math.hypot(...cr) / 2;
			A.area += ar;
			for (let k = 0; k < 3; k++) { A.n[k] += cr[k] / 2; }
			for (let q = 0; q < 3; q++) for (let k = 0; k < 3; k++) { const v = P[(a + q) * 3 + k]; A.lo[k] = Math.min(A.lo[k], v); A.hi[k] = Math.max(A.hi[k], v); }
			if (m.C) for (let k = 0; k < 3; k++) A.c[k] += (m.C[a * 3 + k] + m.C[a * 3 + 3 + k] + m.C[a * 3 + 6 + k]) / 3 * ar;
			A.tri.push(a);
		}
		for (const A of acc.values()) {
			if (A.area < 1e-5) continue;
			out.push({ mesh: m, p: [0, 1, 2].map((k) => (A.lo[k] + A.hi[k]) / 2), size: [0, 1, 2].map((k) => A.hi[k] - A.lo[k]), area: A.area, n: A.n.map((v) => v / A.area), c: m.C ? A.c.map((v) => v / A.area) : [1, 1, 1], tri: A.tri });
		}
	}
	return out;
}
// a piece of lamp made a fixture: by its shape and where it hangs. ceilings: [[y0, y1]]
// (each level's floor and ceiling), centre: [x, z] of the plan, glow: its material's colour
export function pieceFixture(pc, { ceilings = [], centre = [0, 0], glow = [1, 0.9, 0.8], strength = 1 } = {}) {
	const [sx, sy, sz] = pc.size, top = pc.p[1] + sy / 2;
	const c = [0, 1, 2].map((k) => glow[k] * Math.min(1.2, pc.c[k] * 1.1));
	const lum = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
	if (lum < 0.03 || pc.area < 0.004) return null;
	const flatV = Math.min(sx, sz) < 0.06 && sy > 0.08;              // a screen or a sign on a wall
	// (up high: flush with a ceiling, hung under one on rods, or along a ridge)
	const lv = ceilings.find(([y0, y1]) => pc.p[1] >= y0 - 0.1 && pc.p[1] <= y1 + 0.1);
	const atCeiling = !flatV && sy < 0.4 && !!lv && top > lv[0] + 1.9;
	const long = Math.max(sx, sz), short = Math.min(sx, sz);
	const f = { p: [...pc.p], c, on: true, piece: pc };
	if (atCeiling) {
		// (a little under the ceiling, its light on the ceiling soft: the 1 m cut holds a halo, not a star)
		f.p[1] = pc.p[1] - sy / 2 - 0.12; f.soft = 0.45;
		// (as bright as a room's ceiling light is: about 300 lux on the floor under it at an
		// ordinary height, more from the lights of a tall hall)
		const tall = Math.min(1.8, Math.max(0.7, (f.p[1] - lv[0]) / 2.8));
		if (long > 0.6 && short < 0.4) { f.shape = 'tube'; f.axis = sx > sz ? [1, 0, 0] : [0, 0, 1]; f.len = long; f.I = Math.min(22, 6 + 7 * Math.min(long, 3)); }
		else if (long > 0.5) { f.shape = 'panel'; f.n = [0, -1, 0]; f.w = sx; f.d = sz; f.I = Math.min(26, 12 * sx * sz + 7); }
		else { f.shape = 'down'; f.n = [0, -1, 0]; f.I = Math.min(16, 6 + 6 * Math.sqrt(pc.area / 0.12)); }
		f.I *= tall * 0.85;
		// (a tall hall's lights have reflectors: tighter pools)
		f.beam = tall > 1.25 ? 12 : 3;
	} else if (flatV) {
		// facing out from the wall it is on (toward the middle of the plan)
		const ax = sx < sz ? 0 : 2, to = (ax === 0 ? centre[0] - pc.p[0] : centre[1] - pc.p[2]) >= 0 ? 1 : -1;
		f.shape = 'panel'; f.n = ax === 0 ? [to, 0, 0] : [0, 0, to]; f.w = Math.max(sx, sz); f.d = sy;
		f.I = Math.min(6, 0.6 + 7 * f.w * f.d) * Math.min(1, lum * 2);
		f.screen = true;
	} else { f.shape = 'point'; f.I = Math.min(8, 2 + 5 * Math.sqrt(pc.area / 0.3)); }
	f.I *= strength;
	return f;
}

// the big flat faces of the geometry as thin solid boxes just behind them (the walls, floors,
// ceilings and the tops and sides of big furniture: what any builder's rooms are made of),
// for the rays. Only faces square to the axes, of at least minArea.
export function quadBoxes(P, N, count, minArea = 0.25, out = []) {
	const ntri = Math.floor(count / 3);
	const lo = [0, 0, 0], hi = [0, 0, 0];
	for (let t = 0; t + 1 < ntri; t++) {
		const a = t * 3, nx = N[a * 3], ny = N[a * 3 + 1], nz = N[a * 3 + 2];
		const ax = Math.abs(nx) > 0.995 ? 0 : Math.abs(ny) > 0.995 ? 1 : Math.abs(nz) > 0.995 ? 2 : -1;
		if (ax < 0) continue;
		// (the next triangle on the same plane, facing the same way, sharing an edge)
		if (Math.abs(N[(a + 3) * 3 + ax] - N[a * 3 + ax]) > 0.01) continue;
		let shared = 0;
		for (let p = 0; p < 3; p++) for (let q = 3; q < 6; q++) if (Math.abs(P[(a + p) * 3] - P[(a + q) * 3]) + Math.abs(P[(a + p) * 3 + 1] - P[(a + q) * 3 + 1]) + Math.abs(P[(a + p) * 3 + 2] - P[(a + q) * 3 + 2]) < 1e-5) shared++;
		if (shared !== 2) continue;
		lo[0] = lo[1] = lo[2] = 1e9; hi[0] = hi[1] = hi[2] = -1e9;
		for (let q = 0; q < 6; q++) for (let k = 0; k < 3; k++) { const v = P[(a + q) * 3 + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
		if (hi[ax] - lo[ax] > 1e-3) continue;
		t++;
		const s0 = ax === 0 ? 1 : 0, s1 = ax === 2 ? 1 : 2;
		if ((hi[s0] - lo[s0]) * (hi[s1] - lo[s1]) < minArea) continue;
		const f = lo[ax], up = (ax === 0 ? nx : ax === 1 ? ny : nz) > 0;
		const b = [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]];
		b[ax] = up ? f - 0.06 : f + 0.005; b[ax + 3] = up ? f - 0.005 : f + 0.06;
		out.push([b[0], b[2], b[3], b[5], b[1], b[4]]);
	}
	return out;
}
