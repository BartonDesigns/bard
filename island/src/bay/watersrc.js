// The sources of water.js's rivers and lakes on Earth:
//   bakedWater: the real Bay Area's (Overture Maps' base/water, from OpenStreetMap: ODbL),
//     baked by tools/bake-water.py into assets/bayarea/water.bin.gz: every lake at load,
//     the lines a 2 km tile at a time; the survey's heights under each lake let down at load
//     (every level that holds it, as bay/boardwalk.js regrades its park), so from far off,
//     where nothing finer is drawn, the water isn't pierced by the ground.
//   pondWater: the ponds the generated towns dig in their parks (crysis/civgen.js).
// (The land beyond the survey has its own: crysis/rivers.js.)
//
// A source is { lakes, version(), ready(), job?(), tile(i, j) }: tile is a generator whose
// return value is the tile's lines, [{ cls, int, name, P: [[x, z, level, width], ...] }],
// each running the way its water flows.

import * as THREE from 'three';
import { KX, KZ, LON0, LAT0, H_OFF, H_SCALE } from './geo.js';
import { inRiverWater } from './carve.js';

async function gunzip(res) {
	const ds = new DecompressionStream('gzip');
	return new Uint8Array(await new Response(res.body.pipeThrough(ds)).arrayBuffer());
}
// how deep a lake goes, and how fast its bed falls from the shore, by kind
// (lake, reservoir, basin, pond, pool)
export const DEEP = [[9, 0.1], [22, 0.16], [1.4, 0.08], [2.6, 0.1], [0.7, 0.3]];

// where a row crosses a lake's edges, in order (in, out, in, out...)
export function crossings(R, z) {
	const xs = [];
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const az = r[i + 1], bz = r[j + 1];
		if ((az > z) !== (bz > z)) xs.push(r[i] + (r[j] - r[i]) * (z - az) / (bz - az));
	}
	return xs.sort((a, b) => a - b);
}
export function edgeDist(R, x, z) {
	let best = 1e18;
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const ax = r[j], az = r[j + 1], dx = r[i] - ax, dz = r[i + 1] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
		if (d < best) best = d;
	}
	return Math.sqrt(best);
}

// riverLevel (x, z): sanlorenzo.js's water level there, or null; riverSettled (): whether it
// has laid its river (or failed to)
export function bakedWater(bay, BU, riverLevel = () => null, riverSettled = null) {
	const S = { H: null, dv: null, lakes: [], ready: false, err: null, version: 0 };
	// Santa Cruz's river, from its mouth up the valley to Felton, is bay/sanlorenzo.js's:
	// round it, none of ours where its water is (or within 22 m of it), and the Boardwalk's box
	// (bake-water.py's skip list) is left out altogether
	const SL = { x0: (-122.11 - LON0) * KX, x1: (-121.99 - LON0) * KX, z0: -(37.075 - LAT0) * KZ, z1: -(36.94 - LAT0) * KZ, ref: { x: (-122.0213 - LON0) * KX, z: -(36.9745 - LAT0) * KZ }, t0: performance.now() };
	const inSL = (x, z) => x > SL.x0 && x < SL.x1 && z > SL.z0 && z < SL.z1;
	// (laid, or given up on: settled; without a way to ask, a few minutes at most)
	const slReady = () => inRiverWater(SL.ref.x, SL.ref.z) || (riverSettled ? riverSettled() : performance.now() - SL.t0 > 240000);
	const theirs = (x, z) => { for (let a = 0; a < 8; a++) { const r = a ? 22 : 0; if (inRiverWater(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true; } return false; };
	const join = (q) => { for (let r = 0; r <= 40; r += 10) for (let a = 0; a < (r ? 8 : 1); a++) { const v = riverLevel(q[0] + Math.cos(a * 0.785) * r, q[1] + Math.sin(a * 0.785) * r); if (v !== null && v !== undefined) return v; } return null; };
	const skipBox = (x, z) => (S.H?.skip || []).some((b) => x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]);

	function* job() {
		const base = new URL('../assets/bayarea/water', import.meta.url).href;
		let H = null, bin = null, done = false;
		Promise.all([fetch(base + '.json').then((r) => r.json()), fetch(base + '.bin.gz').then(gunzip)]).then(([h, b]) => { H = h; bin = b; done = true; }).catch((e) => { S.err = e; done = true; console.warn('water', e); });
		while (!done) yield;
		if (!H) return;
		S.H = H; S.dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
		const dv = S.dv;
		let o = H.lakes[0];
		for (let n = 0; n < H.lakes[1]; n++) {
			const kind = dv.getUint8(o), fl = dv.getUint8(o + 1), nm = dv.getUint16(o + 2, true), level = dv.getInt16(o + 4, true) / 20, nr = dv.getUint16(o + 6, true);
			const cx = dv.getFloat32(o + 8, true), cz = dv.getFloat32(o + 12, true), u = dv.getUint8(o + 16) / 8, nd = dv.getUint8(o + 17);
			o += 18;
			const rings = [], dams = [];
			for (let k = 0; k < nr + nd; k++) {
				const m = dv.getUint16(o, true); o += 2;
				const r = new Float64Array(m * 2);
				for (let i = 0; i < m; i++, o += 4) { r[i * 2] = dv.getInt16(o, true) * u + cx; r[i * 2 + 1] = dv.getInt16(o + 2, true) * u + cz; }
				(k < nr ? rings : dams).push(r);
			}
			o = (o + 3) & ~3;
			S.lakes.push({ kind, int: !!(fl & 1), name: nm ? H.names[nm - 1] : '', level, rings, dams, cx, cz });
			if (n % 200 === 199) yield;
		}
		yield* regrade();
		S.ready = true; S.version++;
	}
	// the survey's heights under each lake let down to its bed
	function* regrade() {
		let n = 0, t0 = performance.now();
		for (let k = 0; k < bay.levels.length; k++) {
			const Lv = bay.levels[k], tex = BU?.['uB' + k]?.value, D = tex?.image?.data;
			if (!Lv || !D || tex.image.width !== Lv.W) continue;
			const rows = new Set(), st = Lv.step, h = THREE.DataUtils.toHalfFloat;
			const X1 = Lv.x0 + (Lv.W - 1) * st, Z1 = Lv.zN + (Lv.H - 1) * st;
			for (const L of S.lakes) {
				if (L.area === undefined) bounds(L);
				if (L.area < st * st * 0.3 || L.x1 < Lv.x0 || L.x0 > X1 || L.z1 < Lv.zN || L.z0 > Z1) continue;
				const [Dmax, sl] = DEEP[L.kind];
				const j0 = Math.max(0, Math.ceil((L.z0 - Lv.zN) / st)), j1 = Math.min(Lv.H - 1, Math.floor((L.z1 - Lv.zN) / st));
				for (let j = j0; j <= j1; j++) {
					// (a big lake's rows a few at a time)
					if (performance.now() - t0 > 3) { yield; t0 = performance.now(); }
					const z = Lv.zN + j * st, xs = crossings(L.rings, z);
					for (let c = 0; c + 1 < xs.length; c += 2) {
						for (let i = Math.max(0, Math.ceil((xs[c] - Lv.x0) / st)); i <= Math.min(Lv.W - 1, Math.floor((xs[c + 1] - Lv.x0) / st)); i++) {
							// (the heights within half a step of the shore barely let down, so the
							// ground drawn between them meets the water near its true edge)
							const x = Lv.x0 + i * st, t = L.level - Math.min(Dmax, 0.3 + Math.max(0, edgeDist(L.rings, x, z) - 0.6 * st) * sl), q = j * Lv.W + i;
							if (t < Lv.v[q] / H_SCALE - H_OFF) { Lv.v[q] = Math.round((t + H_OFF) * H_SCALE); D[q] = h(t); rows.add(j); }
						}
					}
				}
				if (++n % 40 === 0) yield;
			}
			for (const j of rows) tex.addUpdateRange(j * Lv.W * 4, Lv.W * 4);
			if (rows.size) tex.needsUpdate = true;
			yield;
		}
	}
	const nearSL = (i, j) => { const T = S.H?.tile || 2048, cx = (i + 0.5) * T, cz = (j + 0.5) * T; return inSL(cx, cz) || inSL(cx - 1024, cz - 1024) || inSL(cx + 1024, cz + 1024); };
	// the lines of a 2 km tile (cut where sanlorenzo.js's river runs)
	function* tile(i, j) {
		const H = S.H, e = H?.tiles[i + ',' + j], out = [];
		if (!e) return out;
		const cx = (i + 0.5) * H.tile, cz = (j + 0.5) * H.tile, sl = nearSL(i, j);
		// (round Santa Cruz, wait for sanlorenzo.js to lay its river first)
		while (sl && !slReady()) yield;
		const dv = S.dv, U = H.unit;
		let o = e[0];
		for (let n = 0; n < e[1]; n++) {
			const c = dv.getUint8(o), fl = dv.getUint8(o + 1), nm = dv.getUint16(o + 2, true), k = dv.getUint16(o + 4, true); o += 6;
			let px = 0, pz = 0, pl = 0;
			const P = [];
			for (let v = 0; v < k; v++, o += 8) {
				px += dv.getInt16(o, true); pz += dv.getInt16(o + 2, true); pl += dv.getInt16(o + 4, true);
				P.push([px * U + cx, pz * U + cz, pl / 20, dv.getUint16(o + 6, true) / 10]);
			}
			let cur = [];
			const flush = (at) => {
				// (running into sanlorenzo.js's river: the last 250 m let down or up to its level there)
				const their = at && cur.length > 1 ? join(at) : null;
				if (their !== null) {
					const d = their - cur[cur.length - 1][2];
					let s = 0;
					for (let q = cur.length - 1; q >= 0 && s < 250; q--) { cur[q][2] += d * (1 - s / 250); if (q) s += Math.hypot(cur[q][0] - cur[q - 1][0], cur[q][1] - cur[q - 1][1]); }
					for (let q = 1; q < cur.length; q++) cur[q][2] = Math.min(cur[q][2], cur[q - 1][2]);
				}
				if (cur.length > 1) out.push({ cls: H.classes[c], int: !!(fl & 1), name: nm ? H.names[nm - 1] : '', P: cur });
				cur = [];
			};
			for (const q of P) { if (sl && (theirs(q[0], q[1]) || skipBox(q[0], q[1]))) flush(q); else cur.push(q); }
			flush();
		}
		return out;
	}
	return { name: 'baked', lakes: S.lakes, wait: (i, j) => nearSL(i, j) && !slReady(), version: () => S.version, ready: () => S.ready, job, tile, err: () => S.err, attribution: () => S.H?.attribution, skip: skipBox };
}

// a lake's box and area
export function bounds(L) {
	let x0 = 1e18, z0 = 1e18, x1 = -1e18, z1 = -1e18, area = 0;
	for (const r of L.rings) {
		let a = 0;
		for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { a += r[j] * r[i + 1] - r[i] * r[j + 1]; x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
		area += a / 2;
	}
	Object.assign(L, { x0, z0, x1, z1, area: Math.abs(area) });
	return L;
}

// the generated towns' park ponds: their level just over the ground they are dug in
export function pondWater(real, heightAt) {
	const S = { lakes: [], version: 0, rv: -1 };
	function refresh() {
		const v = real?.version ? real.version() : 0;
		if (v === S.rv) return;
		S.rv = v;
		const now = real?.ponds ? real.ponds() : [];
		const keep = S.lakes.filter((L) => now.includes(L.src));
		for (const pts of now) {
			if (keep.some((L) => L.src === pts)) continue;
			const r = new Float64Array(pts.length * 2);
			pts.forEach((p, i) => { r[i * 2] = p.x; r[i * 2 + 1] = p.z; });
			let lo = Infinity, sx = 0, sz = 0;
			for (const p of pts) { lo = Math.min(lo, heightAt(p.x, p.z)); sx += p.x; sz += p.z; }
			keep.push({ kind: 3, int: false, name: '', level: lo - 0.15, rings: [r], dams: [], cx: sx / pts.length, cz: sz / pts.length, src: pts, gen: true });
		}
		S.lakes.length = 0; S.lakes.push(...keep);
		S.version++;
	}
	return { name: 'ponds', lakes: S.lakes, version: () => { refresh(); return S.version; }, ready: () => true, *tile() { return []; } };
}
