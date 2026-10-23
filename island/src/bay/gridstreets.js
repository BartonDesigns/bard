// The gridded towns' streets out past the Bay's survey. Round the Bay's map the town map
// (terrain.js) seeds towns out to 50 km, and city.js raises their houses block by block on the
// grid (styles.js). Inside the survey the Bay's ground paints the streets between the blocks;
// a few kilometres past it the globe's ground draws instead, and it paints none: the houses
// stood in their rows on bare ground. So here the grid's streets are worked out as lines, the
// very lines the Bay's ground paints (a street down each grid line, its centre ST/2 past it,
// between two blocks where either is built), for earth/townstreets.js to lay on the ground and
// for the highways to join (earth/globeroads.js). Named and classed as the signs name them
// (signage/gridstreets.js gridName): a boulevard every seventh line, a collector every fourth.
//
// Worked out in tiles of 960 m round you, one a few milliseconds a frame; plain numbers, no
// scene. A street runs crossing to crossing, so the driving can turn at each.

import { BLOCKS, toGrid, fromGrid } from './styles.js';
import { gridName } from '../signage/gridstreets.js';
import { inWater as wet } from './watercarve.js';

const TILE = 960;
const SW = 2.3;               // the pavement between a street and its blocks (city-blocks.js keeps 2.5 m)

// the grid's angle as the town map stores it (a byte of a quarter turn), so it compares equal
const quant = (a) => Math.round(a / (Math.PI / 2) * 255) / 255 * Math.PI / 2;

export function createGridStreets({ bay, real = () => null, painted = () => false, inWater = wet, isPhone = false }) {
	const R = isPhone ? 1700 : 2500;
	const tiles = new Map();          // 'i,j' -> { key, i, j, x, z, roads, v }
	let job = null, scanAt = null, genV = -1, serial = 0, version = 0;
	const stats = { tiles: 0, roads: 0, ms: 0 };

	// whether a block of the grid is built (as city-blocks.js decides: the town is there, the grid
	// there is this one, no mapped or grown town covers it, dry ground above the water)
	function blockBuilt(i, j, a, s, B, cache) {
		const key = i + ',' + j;
		let v = cache.get(key);
		if (v !== undefined) return v;
		const [BX, BZ] = B, [wx, wz] = fromGrid((i + 0.5) * BX, (j + 0.5) * BZ, a, s), U = bay.urbanAt(wx, wz);
		v = U.u >= 0.15 && U.s === s && Math.abs(U.a - a) <= 0.01 && !real()?.inside?.(wx, wz) && bay.heightAt(wx, wz) >= 0.8;
		if (v) for (const [u, w] of [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) { const [x, z] = fromGrid((i + u) * BX, (j + w) * BZ, a, s); if (inWater(x, z)) { v = false; break; } }
		cache.set(key, v);
		return v;
	}
	function* buildTile(T) {
		const t0 = performance.now();
		let s0 = t0;
		const x0 = T.i * TILE, z0 = T.j * TILE, roads = [];
		// the grids present here (sampled across the tile and a little past it)
		const grids = new Map();
		for (let z = z0 - 120; z <= z0 + TILE + 120; z += 120) for (let x = x0 - 120; x <= x0 + TILE + 120; x += 120) {
			const U = bay.urbanAt(x, z);
			if (U.u < 0.05) continue;
			const a = quant(U.a);
			grids.set(Math.round(a * 1000) + ':' + U.s, [a, U.s]);
		}
		for (const [gkey, [a, s]] of grids) {
			const B = BLOCKS[s];
			if (!B) continue;
			const [BX, BZ, ST] = B, nameKey = +gkey.split(':')[0] + s * 7919, cache = new Map();
			// the tile's corners in the grid (the warp moves the suburbs' lines up to a hundred metres)
			let gx0 = Infinity, gx1 = -Infinity, gz0 = Infinity, gz1 = -Infinity;
			for (const [x, z] of [[x0, z0], [x0 + TILE, z0], [x0, z0 + TILE], [x0 + TILE, z0 + TILE]]) { const [gx, gz] = toGrid(x, z, a, s); gx0 = Math.min(gx0, gx); gx1 = Math.max(gx1, gx); gz0 = Math.min(gz0, gz); gz1 = Math.max(gz1, gz); }
			gx0 -= 160; gx1 += 160; gz0 -= 160; gz1 += 160;
			// a street from crossing to crossing along one grid line: the line's points every 12 m or so
			const street = (axis, n, m) => {
				const L = axis === 'z' ? BZ : BX, steps = Math.max(2, Math.ceil(L / 12)), pts = [];
				for (let k = 0; k <= steps; k++) {
					const g = (m + k / steps) * L + ST / 2, [x, z] = axis === 'z' ? fromGrid(n * BX + ST / 2, g, a, s) : fromGrid(g, n * BZ + ST / 2, a, s);
					if (bay.heightAt(x, z) < 0.4 || inWater(x, z)) return null;
					pts.push(x, z);
				}
				return pts;
			};
			for (let n = Math.floor(gx0 / BX); n <= Math.ceil(gx1 / BX); n++) for (let m = Math.floor(gz0 / BZ); m <= Math.ceil(gz1 / BZ); m++) {
				for (const axis of ['z', 'x']) {
					// (a line along grid z is at gx = n*BX + ST/2, between blocks n-1 and n of row m; along
					// grid x at gz = n'*BZ + ST/2: here the roles of n and m swap)
					const [ln, lm] = axis === 'z' ? [n, m] : [m, n];
					const mid = axis === 'z' ? fromGrid(ln * BX + ST / 2, (lm + 0.5) * BZ + ST / 2, a, s) : fromGrid((lm + 0.5) * BX + ST / 2, ln * BZ + ST / 2, a, s);
					if (mid[0] < x0 || mid[0] >= x0 + TILE || mid[1] < z0 || mid[1] >= z0 + TILE) continue;
					const built = axis === 'z' ? blockBuilt(ln - 1, lm, a, s, B, cache) || blockBuilt(ln, lm, a, s, B, cache) : blockBuilt(lm, ln - 1, a, s, B, cache) || blockBuilt(lm, ln, a, s, B, cache);
					if (!built || painted(mid[0], mid[1])) continue;
					const pts = street(axis, ln, lm);
					if (!pts) continue;
					const { name, cls } = gridName(axis, ln, nameKey);
					let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
					for (let k = 0; k < pts.length; k += 2) { bx0 = Math.min(bx0, pts[k]); bx1 = Math.max(bx1, pts[k]); bz0 = Math.min(bz0, pts[k + 1]); bz1 = Math.max(bz1, pts[k + 1]); }
					roads.push({ cls, w: ST, sw: SW, name, pts: new Float32Array(pts), drive: true, walked: true, grid: true, end0: false, end1: false, bridge: false, link: false, divided: false, box: [bx0, bz0, bx1, bz1] });
				}
				if (performance.now() - s0 > (isPhone ? 2 : 3)) { stats.ms += performance.now() - s0; yield; s0 = performance.now(); }
			}
		}
		stats.ms += performance.now() - s0;
		T.roads = roads; T.v = ++serial; version++;
	}

	// ---------- each frame ----------
	function update(cam, on) {
		if (!on) { if (tiles.size) { tiles.clear(); job = null; scanAt = null; version++; } return; }
		const x = cam.position.x, z = cam.position.z, R2 = real();
		// a town grown or let go: its blocks are the grown town's now (or the grid's again)
		const gv = R2?.genVersion?.() ?? 0;
		if (gv !== genV) { genV = gv; for (const T of tiles.values()) T.v = 0; job = null; scanAt = null; }
		if (!scanAt || Math.hypot(x - scanAt[0], z - scanAt[1]) > 200) {
			scanAt = [x, z];
			const keep = new Set();
			for (let i = Math.floor((x - R) / TILE); i <= Math.floor((x + R) / TILE); i++) for (let j = Math.floor((z - R) / TILE); j <= Math.floor((z + R) / TILE); j++) {
				const cx = (i + 0.5) * TILE, cz = (j + 0.5) * TILE;
				if (Math.hypot(cx - x, cz - z) > R + TILE * 0.71) continue;
				const k = i + ',' + j;
				keep.add(k);
				if (!tiles.has(k)) tiles.set(k, { key: k, i, j, x: cx, z: cz, roads: [], v: 0 });
			}
			for (const k of [...tiles.keys()]) if (!keep.has(k) && Math.hypot(tiles.get(k).x - x, tiles.get(k).z - z) > R + TILE * 1.2) { tiles.delete(k); version++; if (job?.T.key === k) job = null; }
		}
		if (!job) {
			let best = null, bd = Infinity;
			for (const T of tiles.values()) if (!T.v) { const d = Math.hypot(T.x - x, T.z - z); if (d < bd) { bd = d; best = T; } }
			if (best) job = { T: best, it: buildTile(best) };
		}
		if (job) {
			const t0 = performance.now();
			while (performance.now() - t0 < (isPhone ? 2 : 3)) if (job.it.next().done) { job = null; break; }
		}
		stats.tiles = tiles.size;
		stats.roads = [...tiles.values()].reduce((s, T) => s + T.roads.length, 0);
	}
	// every tile round you laid out now (tests, and a jump)
	function settle(cam) {
		scanAt = null;
		for (let k = 0; k < 400; k++) {
			update(cam, true);
			if (job) { while (!job.it.next().done); job = null; }
			if (![...tiles.values()].some((T) => !T.v)) break;
		}
	}
	// what townstreets.js draws: a set for each tile with streets in it
	function sets() {
		const out = [];
		for (const T of tiles.values()) if (T.v && T.roads.length) out.push({ key: 'grid:' + T.key + ':' + T.v, x: T.x, z: T.z, roads: T.roads });
		return out;
	}
	// the streets near a point (the highways' ends find a town's here)
	function near(x, z, rad) {
		const out = [];
		for (const T of tiles.values()) {
			if (Math.abs(T.x - x) > rad + TILE || Math.abs(T.z - z) > rad + TILE) continue;
			for (const r of T.roads) { const b = r.box; if (b[2] >= x - rad && b[0] <= x + rad && b[3] >= z - rad && b[1] <= z + rad) out.push(r); }
		}
		return out;
	}
	// a town's streets for the highways to join (globeroads.js): those of the tiles over it, once
	// every tile over it round you is laid out (the same list till one of them changes, so the
	// highways are not made again for every tile)
	const towns = new Map();          // town -> { key, roads }
	function townRoads(t, rad) {
		let key = '', ready = true;
		for (const T of tiles.values()) {
			if (Math.abs(T.x - t.x) > rad + TILE / 2 || Math.abs(T.z - t.z) > rad + TILE / 2) continue;
			if (!T.v) { ready = false; break; }
			key += T.key + ':' + T.v + '|';
		}
		const was = towns.get(t);
		if (!ready) return was?.roads || null;
		if (was?.key === key) return was.roads;
		const roads = key ? near(t.x, t.z, rad) : [];
		towns.set(t, { key, roads });
		return roads;
	}
	const info = () => ({ ...stats, ms: Math.round(stats.ms), building: job ? job.T.key : null });
	const clear = () => { tiles.clear(); towns.clear(); job = null; scanAt = null; version++; };
	return { update, settle, sets, near, townRoads, info, clear, version: () => version };
}
