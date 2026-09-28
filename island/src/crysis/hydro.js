// Crysis hydrology: where the rain goes on a heightfield. Given heights on a grid it works
// out, the way a landscape drains:
//   1. the ground with its hollows filled to where they spill (priority flood, seeded from
//      the sea and the grid's edges), so every cell has somewhere lower to go;
//   2. where each cell drains (the steepest fall on the filled ground) and how much ground
//      drains through it (flow accumulation);
//   3. the lakes: the filled hollows deep and wide enough to hold water, each lying at its
//      spill level, its shore traced where the ground meets that level (marching squares);
//   4. the streams: from where enough ground drains to keep one running, down to the stream
//      it joins, the lake it fills or the sea, each vertex with its water's level (falling,
//      never rising) and how much drains into it.
// Pure and deterministic: the same heights give the same water. It is a generator, yielding
// every few thousand cells, so a caller can spread it over frames.

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

// a binary heap of cell indices keyed by a Float32Array
function heap(key) {
	const a = [];
	const up = (i) => { const v = a[i], k = key[v]; while (i > 0) { const p = (i - 1) >> 1; if (key[a[p]] < k || (key[a[p]] === k && a[p] < v)) break; a[i] = a[p]; i = p; } a[i] = v; };
	const down = (i) => {
		const n = a.length, v = a[i], k = key[v];
		for (;;) {
			let c = 2 * i + 1;
			if (c >= n) break;
			if (c + 1 < n && (key[a[c + 1]] < key[a[c]] || (key[a[c + 1]] === key[a[c]] && a[c + 1] < a[c]))) c++;
			if (key[a[c]] > k || (key[a[c]] === k && a[c] > v)) break;
			a[i] = a[c]; i = c;
		}
		a[i] = v;
	};
	return { push(v) { a.push(v); up(a.length - 1); }, pop() { const t = a[0], l = a.pop(); if (a.length) { a[0] = l; down(0); } return t; }, get size() { return a.length; } };
}

// G: { W, H, x0, z0, cell, h: Float32Array (W*H, row-major, z rows) }
// opts: sea (cells at or under it are the sea), minCells (catchment for a stream),
// lakeCells, lakeDepth (the smallest lake kept), inset (water under the filled ground)
export function* hydrology(G, { sea = 0, minCells = 100, lakeCells = 5, lakeDepth = 1.2, inset = 0.3 } = {}) {
	const { W, H, h } = G, n = W * H, cell = G.cell;
	// ---- 1. fill the hollows ----
	const f = new Float32Array(n), done = new Uint8Array(n), Q = heap(f);
	for (let k = 0; k < n; k++) {
		const i = k % W, j = (k - i) / W;
		f[k] = h[k];
		if (i === 0 || j === 0 || i === W - 1 || j === H - 1 || h[k] <= sea) { done[k] = 1; Q.push(k); }
	}
	let c = 0;
	while (Q.size) {
		const k = Q.pop(), i = k % W, j = (k - i) / W;
		for (const [di, dj] of N8) {
			const a = i + di, b = j + dj;
			if (a < 0 || b < 0 || a >= W || b >= H) continue;
			const q = b * W + a;
			if (done[q]) continue;
			done[q] = 1;
			// (a hair above what it spills into, so even a filled flat drains)
			f[q] = Math.max(h[q], f[k] + 1e-3);
			Q.push(q);
		}
		if (++c % 6000 === 0) yield;
	}
	// ---- 2. where each cell drains, and how much drains through it ----
	const rec = new Int32Array(n).fill(-1);
	for (let k = 0; k < n; k++) {
		const i = k % W, j = (k - i) / W;
		if (h[k] <= sea) continue;
		let best = 0;
		for (const [di, dj] of N8) {
			const a = i + di, b = j + dj;
			if (a < 0 || b < 0 || a >= W || b >= H) continue;
			const q = b * W + a, s = (f[k] - f[q]) / (di && dj ? 1.4142 : 1);
			if (s > best) { best = s; rec[k] = q; }
		}
		if (k % 12000 === 0) yield;
	}
	const order = new Uint32Array(n);
	for (let k = 0; k < n; k++) order[k] = k;
	order.sort((a, b) => f[b] - f[a] || a - b);
	yield;
	const acc = new Float32Array(n).fill(1);
	for (let t = 0; t < n; t++) { const k = order[t]; if (rec[k] >= 0) acc[rec[k]] += acc[k]; }
	yield;
	// ---- 3. the lakes ----
	const lakeId = new Int32Array(n).fill(-1), lakes = [];
	for (let k = 0; k < n; k++) {
		if (lakeId[k] !== -1 || f[k] - h[k] < 0.25 || h[k] <= sea) continue;
		// the hollow's cells (4-connected), its deepest point and spill level
		const cells = [k], seen = [k];
		lakeId[k] = -2;
		let deep = 0, lvl = Infinity;
		for (let s = 0; s < cells.length; s++) {
			const q = cells[s], i = q % W, j = (q - i) / W;
			deep = Math.max(deep, f[q] - h[q]); lvl = Math.min(lvl, f[q]);
			for (const [di, dj] of N8.slice(0, 4)) {
				const a = i + di, b = j + dj;
				if (a < 0 || b < 0 || a >= W || b >= H) continue;
				const p = b * W + a;
				if (lakeId[p] !== -1 || f[p] - h[p] < 0.25 || h[p] <= sea) continue;
				lakeId[p] = -2; cells.push(p); seen.push(p);
			}
		}
		const keep = cells.length >= lakeCells && deep >= lakeDepth;
		const id = keep ? lakes.length : -3;
		for (const q of seen) lakeId[q] = id;
		if (keep) lakes.push({ cells, level: lvl, deep });
		if (lakes.length % 20 === 0) yield;
	}
	yield;
	for (const L of lakes) L.rings = outline(G, L, lakeId, lakes.indexOf(L));
	yield;
	// ---- 4. the streams ----
	const chan = (k) => acc[k] >= minCells && lakeId[k] < 0 && h[k] > sea;
	const donors = new Uint16Array(n);
	for (let k = 0; k < n; k++) if (rec[k] >= 0 && chan(k) && chan(rec[k])) donors[rec[k]]++;
	const visited = new Uint8Array(n), streams = [];
	const X = (k) => G.x0 + (k % W) * cell, Z = (k) => G.z0 + Math.floor(k / W) * cell;
	for (let t = 0; t < n; t++) {
		const k0 = order[t];
		if (!chan(k0) || visited[k0] || donors[k0] > 0) continue;
		const pts = [];
		// (out of a lake: from its shore)
		let from = -1, fa = 0;
		const i0 = k0 % W, j0 = (k0 - i0) / W;
		for (const [di, dj] of N8) { const a = i0 + di, b = j0 + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const q = b * W + a; if (rec[q] === k0 && lakeId[q] >= 0 && acc[q] > fa) { fa = acc[q]; from = q; } }
		if (from >= 0) pts.push([X(from), Z(from), lakes[lakeId[from]].level - 0.05, acc[k0], lakeId[from]]);
		let k = k0, end = 'edge', into = -1;
		for (;;) {
			visited[k] = 1;
			pts.push([X(k), Z(k), f[k] - inset, acc[k], -1]);
			const r = rec[k];
			if (r < 0) { end = h[k] <= sea ? 'sea' : 'edge'; break; }
			if (lakeId[r] >= 0) { pts.push([X(r), Z(r), lakes[lakeId[r]].level - 0.05, acc[k], lakeId[r]]); end = 'lake'; into = lakeId[r]; break; }
			if (h[r] <= sea) { pts.push([X(r), Z(r), sea + 0.05, acc[k], -1]); end = 'sea'; break; }
			if (visited[r]) { pts.push([X(r), Z(r), f[r] - inset, acc[r], -1]); end = 'join'; break; }
			if (!chan(r)) { end = 'edge'; break; }
			k = r;
		}
		// (the water never rises going down)
		for (let q = 1; q < pts.length; q++) pts[q][2] = Math.min(pts[q][2], pts[q - 1][2]);
		if (pts.length >= 2) streams.push({ pts, end, into, head: k0 });
		if (streams.length % 40 === 0) yield;
	}
	return { lakes, streams, filled: f, acc, lakeId, rec };
}

// a lake's shore: where the ground meets its level, traced round its cells (marching squares
// on level - ground, only over the lake's cells and their neighbours); rings of world x, z
function outline(G, L, lakeId, id) {
	const { W, H, h, cell } = G;
	let i0 = W, j0 = H, i1 = 0, j1 = 0;
	for (const q of L.cells) { const i = q % W, j = (q - i) / W; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
	i0 = Math.max(0, i0 - 1); j0 = Math.max(0, j0 - 1); i1 = Math.min(W - 1, i1 + 1); j1 = Math.min(H - 1, j1 + 1);
	const w = i1 - i0 + 1, hh = j1 - j0 + 1, v = new Float32Array(w * hh);
	for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
		const q = (j + j0) * W + i + i0;
		// (inside: the lake's own cells; outside: everything else, never under the level)
		v[j * w + i] = lakeId[q] === id ? Math.max(0.02, L.level - h[q]) : Math.min(-0.02, L.level - h[q]);
	}
	// the edges crossing zero, as segments keyed by their end points
	const segs = new Map(), P = (i, j) => [G.x0 + (i + i0) * cell, G.z0 + (j + j0) * cell];
	const ekey = (i, j, d) => (j * (w + 1) + i) * 2 + d;
	const cross = (i, j, d) => {
		// d 0: the edge from (i, j) to (i+1, j); 1: to (i, j+1)
		const a = v[j * w + i], b = d ? v[(j + 1) * w + i] : v[j * w + i + 1], t = a / (a - b);
		const [x0, z0] = P(i, j);
		return d ? [x0, z0 + t * cell] : [x0 + t * cell, z0];
	};
	const link = (e0, e1) => { (segs.get(e0) || segs.set(e0, []).get(e0)).push(e1); (segs.get(e1) || segs.set(e1, []).get(e1)).push(e0); };
	const pos = new Map();
	for (let j = 0; j + 1 < hh; j++) for (let i = 0; i + 1 < w; i++) {
		const a = v[j * w + i] > 0, b = v[j * w + i + 1] > 0, c = v[(j + 1) * w + i + 1] > 0, d = v[(j + 1) * w + i] > 0;
		const E = [];
		if (a !== b) E.push(ekey(i, j, 0));
		if (b !== c) E.push(ekey(i + 1, j, 1));
		if (d !== c) E.push(ekey(i, j + 1, 0));
		if (a !== d) E.push(ekey(i, j, 1));
		for (const e of E) if (!pos.has(e)) { const d2 = e % 2, r = (e - d2) / 2, ii = r % (w + 1), jj = (r - ii) / (w + 1); pos.set(e, cross(ii, jj, d2)); }
		if (E.length === 2) link(E[0], E[1]);
		else if (E.length === 4) { if (a) { link(E[0], E[1]); link(E[2], E[3]); } else { link(E[0], E[3]); link(E[1], E[2]); } }
	}
	// chained into rings
	const rings = [], used = new Set();
	for (const s of segs.keys()) {
		if (used.has(s)) continue;
		const ring = [];
		let cur = s, prev = -1;
		for (let guard = 0; guard < 100000; guard++) {
			used.add(cur);
			const p = pos.get(cur); ring.push(p[0], p[1]);
			const nx = segs.get(cur).find((e) => e !== prev && !used.has(e));
			if (nx === undefined) break;
			prev = cur; cur = nx;
		}
		if (ring.length >= 8) rings.push(ring);
	}
	// the outer shore first (the largest), the islands in it after
	const area = (r) => { let a = 0; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1]; return Math.abs(a / 2); };
	rings.sort((a, b) => area(b) - area(a));
	return rings.filter((r, k) => k === 0 || area(r) > cell * cell * 0.5);
}

// a stream's line made smooth (Chaikin), its levels carried along and still falling
export function smoothLine(pts, passes = 2) {
	let P = pts;
	for (let p = 0; p < passes; p++) {
		const out = [P[0]];
		for (let i = 0; i + 1 < P.length; i++) {
			const a = P[i], b = P[i + 1];
			out.push(a.map((v, k) => v * 0.75 + b[k] * 0.25), a.map((v, k) => v * 0.25 + b[k] * 0.75));
		}
		out.push(P[P.length - 1]);
		P = out;
	}
	for (let q = 1; q < P.length; q++) P[q][2] = Math.min(P[q][2], P[q - 1][2]);
	return P;
}
