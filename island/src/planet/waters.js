// A planet's streams and lakes, worked out as the world is made (crysis/hydro.js on the
// island's heights, every 10 m): where the rain drains off the hills, a stream starts once
// enough ground feeds it, widens on its way down and runs to the sea; the closed hollows
// hold lakes at their spill level. The channels are carved into the island's heights before
// the plants, caves and ruins are planned, and the plants keep out of the water.
//
// How much and what kind by the world (planet/profile.js): rich on green, tropical and
// medieval worlds, a few dry-country creeks and oases on a desert, frozen streams and lakes
// on ice (and on a green world's cold side, where its snow comes down), lava running down
// from the cone and pooling on a volcanic world, tinted as its sea is on the toxic and
// mystical ones, none on a gas giant's moon. The realm's own river (medieval/plan.js), its
// castle, town and fields, and the village are left alone; where a realm road crosses a
// stream a timber bridge carries it.
//
// Resolves to { source (for bay/water.js), look, inWater(x, z), roads } or null. Worked a slice at
// a time between the loading card's frames, so the page never stops for long.

import { hydrology, smoothLine } from '../crysis/hydro.js';

const KINDS = {
	TERRAN: { area: 0.035, look: 'water' }, TROPICAL: { area: 0.03, look: 'water' }, MEDIEVAL: { area: 0.035, look: 'water' }, SHEPHERD: { area: 0.04, look: 'water' },
	OCEAN: { area: 0.08, look: 'water' }, ARID: { area: 0.25, look: 'water', few: 4, pools: 3 }, ICE: { area: 0.05, look: 'ice' }, MAGMA: { area: 0.14, look: 'lava', pools: 6 },
	TOXIC: { area: 0.04, look: 'water' }, MYSTICAL: { area: 0.04, look: 'water' }, SINGULARITY: { area: 0.05, look: 'water' },
};

export async function planWaters(island, profile, opts = {}) {
	const it = steps(island, profile, opts);
	let t = performance.now();
	for (;;) {
		const r = it.next();
		if (r.done) return r.value;
		if (performance.now() - t > 25) { await new Promise((ok) => setTimeout(ok, 0)); t = performance.now(); }
	}
}
function* steps(island, profile, { clear = [], realm = null } = {}) {
	const K = KINDS[profile?.type];
	if (!K) return null;
	const { N, cell, half, height } = island;
	// the heights on a 10 m grid
	const M = 256, cs = island.size / (M - 1), h = new Float32Array(M * M);
	for (let j = 0; j < M; j++) { for (let i = 0; i < M; i++) h[j * M + i] = island.heightAt(-half + i * cs, -half + j * cs); if (j % 32 === 31) yield; }
	const R = yield* hydrology({ W: M, H: M, x0: -half, z0: -half, cell: cs, h }, { sea: 0.3, minCells: Math.round(K.area * 1e6 / (cs * cs)), lakeCells: 10, lakeDepth: 1.0, inset: 0.25 });
	// what is left alone: the realm's river, its castle, town and fields, the ball fields, the village
	const kept = (x, z, m) => !clear.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + m) && !(realm?.riverDist && realm.riverDist(x, z).d < 30 + m) && island.maskAt(x, z, 1) < 0.15;
	const lines = [], lakes = [];
	// frozen: an ice world's all, a greener world's where its cold side brings the snow down
	const B = island.biomes, lava = K.look === 'lava';
	const frozen = (x, z, h) => K.look === 'ice' || (!lava && !!B && (B.at(x, z).cold > 0.5 || B.snowAt(x, z, h) > 0.4));
	// (a desert's few oases and a volcanic world's lava pools: the biggest hollows only)
	const pools = new Set(K.pools ? [...R.lakes].sort((a, b) => b.cells.length - a.cells.length).slice(0, K.pools) : R.lakes);
	for (const L of R.lakes) {
		if (!pools.has(L)) continue;
		const ring = L.rings[0];
		if (!ring) continue;
		let sx = 0, sz = 0;
		for (let i = 0; i < ring.length; i += 2) { sx += ring[i]; sz += ring[i + 1]; }
		sx /= ring.length / 2; sz /= ring.length / 2;
		// (the whole shore clear of what is left alone, not just its middle)
		if (!kept(sx, sz, 20) || L.rings[0].some((v, i) => i % 8 === 0 && !kept(v, L.rings[0][i + 1], 6))) continue;
		lakes.push({ kind: 0, int: false, name: '', level: L.level, rings: L.rings.map((q) => Float64Array.from(q)), dams: [], cx: sx, cz: sz, ice: frozen(sx, sz, L.level) });
	}
	let few = 0;
	for (const S of R.streams) {
		if (K.few && ++few > K.few) break;
		// (one that ran into a hollow left dry sinks away before it)
		if (S.end === 'lake' && !pools.has(R.lakes[S.into])) S.pts.pop();
		if (S.pts[0]?.[4] >= 0 && !pools.has(R.lakes[S.pts[0][4]])) S.pts.shift();
		if (S.pts.length < 2) continue;
		const P = smoothLine(S.pts.map((p) => [p[0], p[1], p[2], Math.min(18, 1.2 + 6 * Math.sqrt(p[3] * cs * cs / 1e6))]));
		let cur = [];
		const flush = () => { if (cur.length >= 3) lines.push({ cls: P[P.length - 1][3] > 9 ? 'river' : 'stream', int: false, name: '', P: cur }); cur = []; };
		for (const p of P) { if (kept(p[0], p[1], p[3] / 2 + 6)) cur.push([p[0], p[1], p[2], p[3], frozen(p[0], p[1], p[2]) ? 1 : 0]); else flush(); }
		flush();
	}
	// the realm's roads across the streams: timber bridges, the ground under them left as it was
	const decks = [];
	const roads = (realm?.roads || []).map((q) => { const f = []; for (const p of q.pts) f.push(p.x, p.z); return { pts: f, w: q.w || 3.4, cls: 'track' }; });
	for (const rd of roads) {
		const p = rd.pts;
		for (let e = 0; e + 3 < p.length; e += 2) {
			const rx = p[e], rz = p[e + 1], ex = p[e + 2] - rx, ez = p[e + 3] - rz, el = Math.hypot(ex, ez);
			if (el < 0.3) continue;
			for (const L of lines) for (let k = 0; k + 1 < L.P.length; k++) {
				const a = L.P[k], b = L.P[k + 1], fx = b[0] - a[0], fz = b[1] - a[1], den = ex * fz - ez * fx;
				if (Math.abs(den) < 1e-6) continue;
				const u = ((a[0] - rx) * fz - (a[1] - rz) * fx) / den, v = ((a[0] - rx) * ez - (a[1] - rz) * ex) / den;
				if (u < 0 || u > 1 || v < 0 || v > 1) continue;
				const X = rx + ex * u, Z = rz + ez * u, w = a[3] + (b[3] - a[3]) * v, sin = Math.abs(den) / (el * Math.hypot(fx, fz));
				if (decks.some((D) => Math.hypot(D.x - X, D.z - Z) < 12)) continue;
				decks.push({ x: X, z: Z, ux: ex / el, uz: ez / el, span: Math.min(30, (w / 2 + 4) / Math.max(0.4, sin)), hw: rd.w / 2 + 0.6, y: island.heightAt(X, Z) + 0.3, wood: true, foot: true });
			}
		}
	}
	// the channels carved into the island's heights, the plants kept out of them
	const wet = new Uint8Array(N * N);
	const at = (x, z) => { const i = Math.round((x + half) / cell), j = Math.round((z + half) / cell); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
	for (const L of lines) for (let k = 0; k + 1 < L.P.length; k++) {
		if (k % 16 === 0) yield;
		const a = L.P[k], b = L.P[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, Rr = Math.max(a[3], b[3]) / 2 + 10;
		const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - Rr + half) / cell)), i1 = Math.min(N - 1, Math.ceil((Math.max(a[0], b[0]) + Rr + half) / cell));
		const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - Rr + half) / cell)), j1 = Math.min(N - 1, Math.ceil((Math.max(a[1], b[1]) + Rr + half) / cell));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			const x = -half + i * cell, z = -half + j * cell, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)), d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
			if (d > Rr) continue;
			const w = a[3] + (b[3] - a[3]) * t, lv = a[2] + (b[2] - a[2]) * t, hw = w / 2, D = (t < 0.5 ? a : b)[4] ? 0.02 : lava ? 0.35 : 0.3 + w * 0.06;
			const tg = d < hw ? lv - 0.05 - D * Math.pow(Math.max(0, 1 - (d / hw) ** 2), 0.6) : lv - 0.05 + (d - hw) * 0.8;
			const q = j * N + i, fade = 1 - Math.max(0, Math.min(1, (d - Rr + 4) / 4));
			if (tg < height[q]) height[q] += (tg - height[q]) * fade;
			if (d < hw + 2) { wet[q] = 1; island.masks[q * 4 + 3] = 0; }
		}
	}
	for (const L of lakes) {
		const ring = L.rings[0];
		let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
		for (let i = 0; i < ring.length; i += 2) { x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); z0 = Math.min(z0, ring[i + 1]); z1 = Math.max(z1, ring[i + 1]); }
		for (let z = z0; z <= z1; z += cell) for (let x = x0; x <= x1; x += cell) {
			if (!inRing(L.rings, x, z)) continue;
			const q = at(x, z);
			if (q < 0) continue;
			wet[q] = 1; island.masks[q * 4 + 3] = 0;
			// (a frozen lake is flat ice to walk on)
			if (L.ice) height[q] = Math.max(height[q], L.level - 0.03);
		}
	}
	const inWater = (x, z) => { const q = at(x, z); return q >= 0 && wet[q] === 1; };
	const source = {
		name: 'planet', lakes, decks, version: () => 1, ready: () => true,
		*tile(i, j) { return lines.filter((L) => { const p = L.P[Math.min(1, L.P.length - 1)], q = L.P[0]; return Math.floor((p[0] + q[0]) / 2 / 2048) === i && Math.floor((p[1] + q[1]) / 2 / 2048) === j; }); },
	};
	// (tinted as the world's sea is: bay/water.js reads the world's own uWaterT)
	const look = { kind: K.look };
	return { source, look, inWater, roads: (x, z, rr) => roads.filter((q) => { for (let k = 0; k < q.pts.length; k += 2) if (Math.abs(q.pts[k] - x) < rr && Math.abs(q.pts[k + 1] - z) < rr) return true; return false; }), lines, lakes };
}
function inRing(R, x, z) {
	let c = false;
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const az = r[i + 1], bz = r[j + 1];
		if ((az > z) !== (bz > z) && x < (r[j] - r[i]) * (z - az) / (bz - az) + r[i]) c = !c;
	}
	return c;
}
