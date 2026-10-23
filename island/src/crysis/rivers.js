// Crysis rivers: the streams and lakes of the land beyond the survey, where the ground is
// the generator's own (bay/terrain.js beyondH) and no map has them. The land is worked in
// fixed 8 km squares, each with a 4 km margin round it so a stream coming in from outside
// already carries what drains into it: heights every 64 m, hydrology.js's filled hollows,
// drainage and flow, then the streams past a catchment of about half a square kilometre,
// widening as more drains into them, all running on to the sea. The generator's ground was
// never worn down by water, so it is full of closed hollows: a low sill (4 m) is cut through
// by the creek, a small hollow holds a lake at its spill level, and a basin deeper or wider
// than that only a pond at its bottom (where the creeks round it end), each lake's shore
// traced on the ground every 16 m and the lake dropped where no hollow there holds it; the
// creeks lie in their beds, never over the ground. A square is worked a slice at a time as
// you come near, and the same ground always gives the same water, so a place looks the same
// every visit.
//
// As a source for bay/water.js: tile(i, j) gives the lines in a 2 km tile; lakes are listed
// as their squares are worked. near(x, z) says how far the water is (for civgen.js's towns,
// which keep their houses out of it), readyAt / pump let a town wait for its water first.

import { hydrology, smoothLine, outline } from './hydro.js';

const CORE = 8192, MARGIN = 4096, CELL = 64, TILE = 2048, FINE = 16;
const SYL = [['Wil', 'Al', 'Cor', 'Ash', 'Bran', 'Mil', 'Sil', 'Ced', 'Ro', 'Lin', 'Hol', 'Kes', 'Ma', 'Ter', 'Or', 'Bel', 'Pal', 'Mon', 'Riv', 'Tul'], ['low', 'der', 'ton', 'ley', 'ford', 'mere', 'ber', 'wick', 'sey', 'dale', 'ran', 'ita', 'amo', 'ero', 'vas', 'ena', 'ock', 'ish', 'ow', 'ar']];
const hash = (a, b) => { let x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const nameOf = (a, b) => SYL[0][Math.floor(hash(a, b) * 20)] + SYL[1][Math.floor(hash(b + 7, a - 3) * 20)];

export function proceduralWater({ heightAt, inSurvey }) {
	const doms = new Map(), lakes = [];
	let version = 0;
	const dkey = (i, j) => i + ',' + j;
	function domain(di, dj) {
		const k = dkey(di, dj);
		let D = doms.get(k);
		if (!D) { D = { di, dj, done: false, lines: new Map(), lakes: [], segs: new Map() }; D.it = work(D); doms.set(k, D); }
		return D;
	}
	function* work(D) {
		const X0 = D.di * CORE - MARGIN, Z0 = D.dj * CORE - MARGIN, n = (CORE + 2 * MARGIN) / CELL + 1;
		const h = new Float32Array(n * n);
		// (inside the survey it is the mapped water's: nothing is made there)
		const cx = D.di * CORE + CORE / 2, cz = D.dj * CORE + CORE / 2;
		let any = false;
		for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) if (!inSurvey(cx + a * CORE / 2, cz + b * CORE / 2)) any = true;
		if (!any) { D.done = true; return; }
		let t0 = performance.now();
		const due = () => { if (performance.now() - t0 < 3) return false; t0 = performance.now(); return true; };
		for (let j = 0; j < n; j++) {
			for (let i = 0; i < n; i++) h[j * n + i] = heightAt(X0 + i * CELL, Z0 + j * CELL);
			if (due()) yield;
		}
		const R = yield* hydrology({ W: n, H: n, x0: X0, z0: Z0, cell: CELL, h }, { sea: 0, minCells: 140, lakeCells: 5, lakeDepth: 1.5, inset: 0.35, breach: 4, breachLen: 48, basin: { deep: 8, cells: 300, share: 0.04, pond: 120, pondDeep: 6 } });
		const inCore = (x, z) => x >= D.di * CORE && x < D.di * CORE + CORE && z >= D.dj * CORE && z < D.dj * CORE + CORE;
		// each lake's shore traced again on the ground every 16 m (the 64 m cells it was found
		// on are too coarse for a shore: on a hillside the ground between them falls away under
		// the water's edge): the water from its deepest point out as far as the ground lies under
		// its level, within a cell of where the cells said it was
		const shores = new Map();
		function* shoreOf(L) {
			if (shores.has(L)) return shores.get(L);
			let i0 = n, j0 = n, i1 = 0, j1 = 0;
			for (const q of L.cells) { const i = q % n, j = (q - i) / n; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
			// (a cell round the cells for the water to reach, and one more so its shore closes inside the grid)
			i0 -= 2; j0 -= 2; i1 += 2; j1 += 2;
			const s = CELL / FINE, cw = i1 - i0 + 1, W = (cw - 1) * s + 1, H = (j1 - j0) * s + 1, x0 = X0 + i0 * CELL, z0 = Z0 + j0 * CELL;
			const near = new Uint8Array(cw * (j1 - j0 + 1)), g = new Float32Array(W * H).fill(NaN), id = new Int32Array(W * H);
			for (const q of L.cells) { const i = q % n - i0, j = (q - q % n) / n - j0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) near[(j + b) * cw + i + a] = 1; }
			// (the ground only where the water comes to: what it covers and the ground round that)
			const G = (q) => { let v = g[q]; if (v !== v) { const i = q % W; v = g[q] = heightAt(x0 + i * FINE, z0 + (q - i) / W * FINE); } return v; };
			const pi = L.pit % n - i0, pj = (L.pit - L.pit % n) / n - j0, k0 = pj * s * W + pi * s;
			// the water at a level from the deepest point out: whether it gets past the cells it
			// was found in (the ground between them lower than they said: no hollow holds it)
			let cells, mk = 0;
			function* fill(lv) {
				cells = []; mk++;
				if (G(k0) >= lv) return false;
				id[k0] = mk; cells.push(k0);
				for (let c = 0; c < cells.length; c++) {
					const k = cells[c], i = k % W, j = (k - i) / W;
					for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
						const ii = i + a, jj = j + b, q = jj * W + ii;
						if (ii < 0 || jj < 0 || ii >= W || jj >= H || id[q] === mk || G(q) >= lv) continue;
						if (!near[Math.round(jj / s) * cw + Math.round(ii / s)]) { if (g[q] < lv - 0.3) return true; continue; }
						id[q] = mk; cells.push(q);
					}
					if ((c & 63) === 63 && due()) yield;
				}
				return false;
			}
			// (one that would: lowered to where it is held)
			if (yield* fill(L.level)) {
				let lo = g[k0], hi = L.level;
				for (let it = 0; it < 9; it++) { const m = (lo + hi) / 2; if (yield* fill(m)) hi = m; else lo = m; }
				L.level = lo; yield* fill(lo);
			}
			// (the ground the water never came near is above it, as far as its shore is concerned)
			for (let q = 0; q < g.length; q++) if (g[q] !== g[q]) g[q] = L.level + 1;
			let rings = cells.length >= 8 && L.level - G(k0) >= 1.5 ? outline({ W, H, x0, z0, cell: FINE, h: g }, { cells, level: L.level }, id, mk) : [];
			// (and looked at between its points: where the ground still falls away under the shore,
			// as it does between even these on a steep mountainside, there is no lake)
			let low = 0, all = 0, worst = 0;
			for (const r of rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
				const d = L.level - heightAt((r[i] + r[j]) / 2, (r[i + 1] + r[j + 1]) / 2);
				all++; if (d > 1.5) low++; worst = Math.max(worst, d);
				if ((i & 63) === 0 && due()) yield;
			}
			if (low > all * 0.08 || worst > 4) rings = [];
			shores.set(L, rings);
			return rings;
		}
		// the lakes whose middle lies in this square
		const middle = (r) => { let sx = 0, sz = 0; for (let i = 0; i < r.length; i += 2) { sx += r[i]; sz += r[i + 1]; } return [sx / (r.length / 2), sz / (r.length / 2)]; };
		for (const L of R.lakes) {
			if (!L.rings[0]) continue;
			// (whose square it is by the cells' shore, so each lake is listed by one square only)
			const [mx, mz] = middle(L.rings[0]);
			if (!inCore(mx, mz) || inSurvey(mx, mz)) continue;
			L.rings = yield* shoreOf(L);
			const r = L.rings[0];
			if (!r) continue;
			const [sx, sz] = middle(r);
			const ring = (q) => Float64Array.from(q);
			const Lk = { kind: L.cells.length > 60 ? 0 : 3, int: false, name: L.cells.length > 12 ? 'Lake ' + nameOf(Math.round(sx / 97), Math.round(sz / 89)) : '', level: L.level, rings: L.rings.map(ring), dams: [], cx: sx, cz: sz, gen: true };
			Lk.bx0 = Lk.bz0 = Infinity; Lk.bx1 = Lk.bz1 = -Infinity;
			for (let i = 0; i < r.length; i += 2) { Lk.bx0 = Math.min(Lk.bx0, r[i]); Lk.bx1 = Math.max(Lk.bx1, r[i]); Lk.bz0 = Math.min(Lk.bz0, r[i + 1]); Lk.bz1 = Math.max(Lk.bz1, r[i + 1]); }
			D.lakes.push(Lk); lakes.push(Lk);
		}
		yield;
		// the streams, smoothed, their widths by what drains into them, cut to the 2 km tiles
		for (const S of R.streams) {
			if (due()) yield;
			const P = smoothLine(S.pts.map((p) => [p[0], p[1], p[2], 1.9 + 3.8 * Math.sqrt(p[3] * CELL * CELL / 1e6)]));
			// (the water in its bed, never over the ground it runs on: the ground between the
			// 64 m cells can fall away under the line drawn across them; the ends in the lake it
			// comes out of or runs into at the lake's level; only in this square, the rest is the
			// next square's to draw)
			const here = (p) => inCore(p[0], p[1]) && !inSurvey(p[0], p[1]);
			const ends = [S.pts[0][4] >= 0 && here(P[0]) ? R.lakes[S.pts[0][4]] : null, S.end === 'lake' && here(P[P.length - 1]) ? R.lakes[S.into] : null];
			for (const L of ends) if (L) L.rings = yield* shoreOf(L);
			for (let q = 0; q < P.length; q++) {
				const p = P[q], L = q < 8 ? ends[0] : q >= P.length - 8 ? ends[1] : null;
				if (here(p)) p[2] = Math.min(p[2], L && inside(L.rings, p[0], p[1]) ? L.level - 0.05 : heightAt(p[0], p[1]) - 0.35);
				if (q) p[2] = Math.min(p[2], P[q - 1][2]);
			}
			const head = S.head, big = P[P.length - 1][3] > 14;
			const name = nameOf(head % 9973, Math.floor(head / 9973) + D.di * 31 + D.dj * 17) + (big ? ' River' : ' Creek');
			const cls = big ? 'river' : 'stream';
			const runs = [];
			let run = [];
			for (const p of P) { if (inCore(p[0], p[1]) && !inSurvey(p[0], p[1])) run.push(p.slice(0, 4)); else { if (run.length >= 2) runs.push(run); run = []; } }
			if (run.length >= 2) runs.push(run);
			// (split where it crosses into the next 2 km tile)
			const tk = (p) => Math.floor(p[0] / TILE) + ',' + Math.floor(p[1] / TILE);
			for (const Rn of runs) {
				let cur = [Rn[0]];
				for (let q = 1; q < Rn.length; q++) {
					cur.push(Rn[q]);
					if (tk(Rn[q - 1]) !== tk(Rn[q]) && q < Rn.length - 1) { put(D, cls, name, cur); cur = [Rn[q]]; }
				}
				if (cur.length >= 2) put(D, cls, name, cur);
			}
		}
		D.done = true;
		version++;
	}
	function put(D, cls, name, pts) {
		const k = Math.floor((pts[0][0] + pts[1][0]) / 2 / TILE) + ',' + Math.floor((pts[0][1] + pts[1][1]) / 2 / TILE);
		let L = D.lines.get(k);
		if (!L) D.lines.set(k, L = []);
		L.push({ cls, int: false, name, P: pts });
		// (by 128 m cell, for how near the water is)
		for (let q = 0; q + 1 < pts.length; q++) {
			const a = pts[q], b = pts[q + 1];
			for (let gi = Math.floor((Math.min(a[0], b[0]) - 40) / 128); gi <= Math.floor((Math.max(a[0], b[0]) + 40) / 128); gi++) for (let gj = Math.floor((Math.min(a[1], b[1]) - 40) / 128); gj <= Math.floor((Math.max(a[1], b[1]) + 40) / 128); gj++) {
				const g = gi + ',' + gj; let s = D.segs.get(g); if (!s) D.segs.set(g, s = []); s.push(a, b);
			}
		}
	}
	const domOf = (x, z) => domain(Math.floor(x / CORE), Math.floor(z / CORE));
	// the lines in a 2 km tile, once its square is worked
	function* tile(i, j) {
		const D = domOf((i + 0.5) * TILE, (j + 0.5) * TILE);
		while (!D.done) { if (D.it.next().done) D.done = true; else yield; }
		return D.lines.get(i + ',' + j) || [];
	}
	// how far to the nearest stream's edge or lake shore (Infinity if none within about 40 m)
	function near(x, z) {
		const D = doms.get(dkey(Math.floor(x / CORE), Math.floor(z / CORE)));
		if (!D?.done) return Infinity;
		let best = Infinity;
		// (a lake is listed by the square its middle is in, and may reach into this one)
		for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
			const N = doms.get(dkey(D.di + a, D.dj + b));
			if (N?.done) for (const L of N.lakes) if (x >= L.bx0 - 40 && x <= L.bx1 + 40 && z >= L.bz0 - 40 && z <= L.bz1 + 40) { if (inside(L.rings, x, z)) return 0; best = Math.min(best, shore(L.rings, x, z)); }
		}
		const s = D.segs.get(Math.floor(x / 128) + ',' + Math.floor(z / 128));
		if (s) for (let q = 0; q < s.length; q += 2) {
			const a = s[q], b = s[q + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
			best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) - (a[3] + (b[3] - a[3]) * t) / 2);
		}
		return Math.max(0, best);
	}
	// in a lake? (the streets keep out of them; they cross the streams on bridges)
	function inLake(x, z) {
		const di = Math.floor(x / CORE), dj = Math.floor(z / CORE);
		for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
			const N = doms.get(dkey(di + a, dj + b));
			if (N?.done) for (const L of N.lakes) if (x >= L.bx0 && x <= L.bx1 && z >= L.bz0 && z <= L.bz1 && inside(L.rings, x, z)) return true;
		}
		return false;
	}
	const squares = (x, z, r) => { const out = []; for (let i = Math.floor((x - r) / CORE); i <= Math.floor((x + r) / CORE); i++) for (let j = Math.floor((z - r) / CORE); j <= Math.floor((z + r) / CORE); j++) out.push(domain(i, j)); return out; };
	return {
		name: 'procedural', lakes, version: () => version, ready: () => true, tile, near, inLake,
		readyAt: (x, z, r) => squares(x, z, r).every((D) => D.done),
		// work the squares round a place for up to ms milliseconds
		pump(x, z, r, ms) { const t0 = performance.now(); for (const D of squares(x, z, r)) while (!D.done && performance.now() - t0 < ms) if (D.it.next().done) { D.done = true; version++; } },
		// let go of squares far off (their lakes go with them)
		trim(x, z, R) {
			for (const [k, D] of doms) {
				if (Math.hypot((D.di + 0.5) * CORE - x, (D.dj + 0.5) * CORE - z) < R) continue;
				doms.delete(k);
				for (const L of D.lakes) { const q = lakes.indexOf(L); if (q >= 0) lakes.splice(q, 1); }
				if (D.lakes.length) version++;
			}
		},
	};
}
// how far to a lake's shore
function shore(R, x, z) {
	let best = Infinity;
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const ax = r[j], az = r[j + 1], dx = r[i] - ax, dz = r[i + 1] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
		best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	return best;
}
function inside(R, x, z) {
	let c = false;
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const az = r[i + 1], bz = r[j + 1];
		if ((az > z) !== (bz > z) && x < (r[j] - r[i]) * (z - az) / (bz - az) + r[i]) c = !c;
	}
	return c;
}
