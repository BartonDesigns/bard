// The lawns' sprinklers: where the heads stand and when they run, laid out as an
// irrigation designer lays out a California yard.
//
// Each house's lot is read from the map in the house's own frame (local +z to the street):
// the front lawn runs from a planting bed along the house front out to the back of the
// sidewalk, between lot lines halfway to the neighbours (or a side street), less the
// driveway and the front walk; the back lawn from a bed along the back wall to the rear
// lot line, less the pool and its deck and any shed. What is left is cut into rectangles
// of turf, and each is watered head to head: 4" pop-up spray heads on its edges throwing
// in, a quarter circle in each corner, half circles along the sides and full circles
// only inside a big lawn, square spaced, the nozzle (8, 10, 12 or 15 ft) the one that
// does it with the fewest heads and nothing thrown past the edge. A strip too narrow for
// that (beside the drive, between drive and walk) gets end-strip nozzles from its ends;
// a big back lawn gets rotors (MP rotators or gear rotors) instead. The beds are on drip,
// which shows nothing. Sprays, strips, rotors and drip each have their own valve, a zone
// to themselves, run one after another: sprays 6-10 minutes, rotors 15-25, drip longer.
// Some front yards were taken out for gravel and natives or plastic turf (more in some
// neighbourhoods than others), and now and then a head is tilted, knocked round to wet
// the sidewalk, or broken off and bubbling up like a fountain.
//
// The parks, playing fields and golf courses: gear rotors on a triangular grid 16 m
// apart, head to head; where the grass ends (a path, a court, a car park, a road) the head
// stands on the edge with a part circle throwing back in. Each controller waters a station
// at a time through the night.
//
// A fifth of the houses water at sunrise (the real sunrise for the day), another fifth at
// three in the morning, the rest never on their own (the brown lawns); the starts a few
// minutes apart from house to house. After a zone runs its grass stays wet and dries over a
// couple of hours. The timer is a window on the clock, not an instant, so it holds at any
// speed the clock runs. What they look like is world/spray.js.

import { mainOf } from '../bay/houseplan.js';
import { BLOCKS, toGrid } from '../bay/styles.js';

const TAU = Math.PI * 2, HALF = Math.PI / 2;
const G = 9.81;
// pop-up spray nozzles (8, 10, 12, 15 ft), and rotors (MP rotators to 21 and 30 ft, gear rotors to 35)
const SPRAYS = [2.4, 3.0, 3.7, 4.6], ROTORS = [6.4, 9.1, 10.7];
const STRIP = 2.0;              // narrower than this, a lawn is watered with strip nozzles
const EDGE = 0.12;              // a head stands this far in from the lawn's edge
// how long a zone runs, in minutes [least, most]
const RUN = { spray: [6, 10], strip: [5, 8], rotor: [15, 25], drip: [20, 35] };
// most heads a valve can feed
const PER = { spray: 12, strip: 6, rotor: 8 };
const PATHS = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track', 'bridleway']);

function rng(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const keyOf = (x, z) => (Math.imul(Math.round(x * 2) | 0, 73856093) ^ Math.imul(Math.round(z * 2) | 0, 19349663)) >>> 0;
const hash2 = (i, j, s) => rng((Math.imul(i, 92837111) ^ Math.imul(j, 689287499) ^ s) >>> 0)();
const wrap = (a) => ((a % TAU) + TAU + Math.PI) % TAU - Math.PI;
// hours since a time of day, 0..24
const since = (h, s) => ((h - s) % 24 + 24) % 24;

// a house's timer, from its own seed: at sunrise (1 in 5), at 3 am (1 in 5) or never;
// started a few minutes off the hour
function houseTimer(key) {
	const r = rng(key ^ 0x7133e5), u = r();
	return { at: u < 0.2 ? 'rise' : u < 0.4 ? 3 : null, off: r() * 0.2 };
}

// a head's throw: the speed for its radius at its elevation (a little over, for the air's drag)
function head(x, z, kind, a0, arc, R, r, noz, el = null) {
	if (el == null) el = kind === 2 ? 0.4 + r() * 0.06 : noz === 'EST' || noz === 'CST' ? 0.3 + r() * 0.06 : 0.42 + r() * 0.1;
	const sp = Math.min(18, Math.max(3, Math.sqrt(R * G / Math.sin(2 * el)) * 1.12));
	return { x, y: 0, z, kind, a0, arc, R, el, sp, period: kind === 2 ? (arc > 6 ? 36 : 14 + arc * 4) * (0.8 + r() * 0.4) : 0, ph: r(), k: 0, noz, zone: 0, on: 0, wet: 0 };
}

// ---- the design, in a yard's own frame: rectangles [x0, z0, x1, z1]
// a rectangle less another: what is left of it, in up to four rectangles
function cut(list, o) {
	const out = [];
	for (const q of list) {
		if (o[0] >= q[2] || o[2] <= q[0] || o[1] >= q[3] || o[3] <= q[1]) { out.push(q); continue; }
		if (o[0] > q[0]) out.push([q[0], q[1], o[0], q[3]]);
		if (o[2] < q[2]) out.push([o[2], q[1], q[2], q[3]]);
		const x0 = Math.max(q[0], o[0]), x1 = Math.min(q[2], o[2]);
		if (o[1] > q[1]) out.push([x0, q[1], x1, o[1]]);
		if (o[3] < q[3]) out.push([x0, o[3], x1, q[3]]);
	}
	return out;
}
// the arc that throws into a rectangle from a point on its edge: bx, bz the way in (-1, 0, 1)
function inward(bx, bz) {
	const tx = bx > 0 ? 0 : Math.PI, tz = bz > 0 ? HALF : -HALF;
	if (bx && bz) return [wrap(tz - tx) > 0 ? tx : tz, HALF];
	if (bx) return [tx - HALF, Math.PI];
	if (bz) return [tz - HALF, Math.PI];
	return [0, TAU];
}
// a lawn watered head to head from its edges: the nozzle that does it with fewest heads and
// least thrown past the edge; put(lx, lz, a0, arc, R, nozzle)
function layLawn(q, sizes, put) {
	const W = q[2] - q[0], D = q[3] - q[1];
	let best = null;
	for (const N of sizes) {
		const mx = Math.max(1, Math.ceil(W / N - 0.05)), mz = Math.max(1, Math.ceil(D / N - 0.05));
		for (let nx = mx; nx <= mx + 1; nx++) for (let nz = mz; nz <= mz + 1; nz++) {
			const sx = W / nx, sz = D / nz, R = Math.max(sx, sz);
			// (a nozzle turns down a quarter of its throw at most)
			if ((R < N * 0.72 && N !== sizes[0]) || R > N * 1.05) continue;
			// (a head on a long side throws as far along it as across: past the ends, where the spacing is uneven)
			const cost = (nx + 1) * (nz + 1) + (R - Math.min(sx, sz)) * 8;
			if (!best || cost < best.cost) best = { nx, nz, sx, sz, R, cost, N };
		}
	}
	const { nx, nz, sx, sz, R, N } = best;
	for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
		const bx = i === 0 ? 1 : i === nx ? -1 : 0, bz = j === 0 ? 1 : j === nz ? -1 : 0;
		const [a0, arc] = inward(bx, bz);
		put(q[0] + i * sx + bx * EDGE, q[1] + j * sz + bz * EDGE, a0, arc, R, N);
	}
	return (nx + 1) * (nz + 1);
}
// a strip: end-strip nozzles at its ends throwing down it, a centre strip between where it is long
function layStrip(q, put) {
	const W = q[2] - q[0], D = q[3] - q[1], along = W > D, L = along ? W : D, w = along ? D : W;
	const n = Math.max(1, Math.ceil(L / 4.6 - 0.05)), s = L / n, arc = Math.min(0.6, Math.max(0.22, 2 * Math.atan(w / 2 / s)));
	const at = (t) => (along ? [q[0] + t, (q[1] + q[3]) / 2] : [(q[0] + q[2]) / 2, q[1] + t]);
	const fwd = along ? 0 : HALF;
	for (let i = 0; i <= n; i++) {
		const t = i === 0 ? EDGE : i === n ? L - EDGE : i * s, [x, z] = at(t);
		if (i < n) put(x, z, fwd - arc / 2, arc, s, i === 0 ? 'EST' : 'CST');
		if (i > 0) put(x, z, fwd + Math.PI - arc / 2, arc, s, i === n ? 'EST' : 'CST');
	}
}

export function createSprinklers({ world, isPhone = false } = {}) {
	const yards = new Map();        // key -> a yard: { x, z, heads, zones, timer | win } (null: nothing to water there)
	const live = [];                // the yards in reach
	const out = [];                 // the heads in reach, handed on each frame
	let scanX = 1e9, scanZ = 1e9, scanT = 0, queue = [];
	const REACH = 140;

	const ground = (x, z) => { const I = world()?.island; return I ? (I.drawnAt || I.heightAt)(x, z) : 0; };
	const wet = (x, z) => !!world()?.water?.inWater?.(x, z);
	// a park's grass: on the land map, and nothing paved, roofed or wet on it
	function turf(x, z) {
		const real = world()?.real;
		if (wet(x, z) || !real?.landAt) return false;
		const L = real.landAt(x, z);
		return !!L && L.road < 0.05 && L.roof < 0.05 && L.lu >= 2 && L.lu <= 4;
	}

	// ---- the streets round a house: [ax, az, bx, bz, reach] for each piece, reach the back of its sidewalk
	function streetsNear(x, z, r) {
		const W = world(), real = W?.real, segs = [];
		if (!real?.loaded?.()) return segs;
		for (const q of real.near('roads', x, z, r)) {
			if (PATHS.has(q.cls) || q.bridge || q.hand) continue;
			let built = q.built;
			if (built === undefined) { const p = q.pts, k = Math.floor(p.length / 4) * 2, L = real.landAt(p[k], p[k + 1]); built = !!L && L.lu > 0 && (L.lu < 11 || L.lu === 13); }
			const reach = q.w / 2 + (q.walked && built ? 1.7 : 0.4), p = q.pts;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
				// (only the pieces that come near)
				const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
				if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r + reach) segs.push(ax, az, bx, bz, reach);
			}
		}
		return segs;
	}
	const onStreet = (segs, x, z) => {
		for (let i = 0; i < segs.length; i += 5) {
			const ax = segs[i], az = segs[i + 1], dx = segs[i + 2] - ax, dz = segs[i + 3] - az, l2 = dx * dx + dz * dz || 1;
			const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
			if (Math.hypot(x - ax - dx * t, z - az - dz * t) < segs[i + 4]) return true;
		}
		return false;
	};
	// how far from a point a ray goes before it meets a street's sidewalk (null: not within max)
	function toStreet(segs, x, z, dx, dz, max) {
		if (!segs.length) return null;
		for (let t = 0; t <= max; t += 0.5) {
			if (!onStreet(segs, x + dx * t, z + dz * t)) continue;
			let s = Math.max(0, t - 0.5);
			while (s < t && !onStreet(segs, x + dx * (s + 0.1), z + dz * (s + 0.1))) s += 0.1;
			return s;
		}
		return null;
	}
	// a gridded town's lot: how far out the lot runs in front of a point (to the back of the
	// sidewalk), and how deep the block's lots are
	function gridLot(px, pz, fx, fz) {
		const U = world()?.bayArea?.urbanAt?.(px, pz);
		if (!U || U.u < 0.1) return null;
		const [, BZ, ST] = BLOCKS[U.s] || BLOCKS[3];
		const [gx, gz] = toGrid(px, pz, U.a, U.s), [hx, hz] = toGrid(px + fx, pz + fz, U.a, U.s), dgz = hz - gz;
		if (Math.abs(dgz) < 0.7 || Math.abs(hx - gx) > 0.7) return null;
		const j = Math.floor(gz / BZ), Z0 = j * BZ + ST + 2.5, IZ = BZ - ST - 5;
		const t = ((dgz < 0 ? Z0 : Z0 + IZ) - gz) / dgz;
		return t >= 0 && t < 30 ? { front: t, half: IZ / 2 } : null;
	}

	// ---- a house's yard, front and back
	function houseYard(grp, proc) {
		const M = mainOf(grp);
		if (!M) return null;
		const key = keyOf(M.x, M.z);
		if (yards.has(key)) return key;
		const W = world(), real = W?.real;
		const r = rng(key ^ 0x5eed5);
		const ca = Math.cos(M.a), sa = Math.sin(M.a), hw = M.w / 2, hd = M.d / 2;
		const toW = (lx, lz) => [M.x + ca * lx - sa * lz, M.z + sa * lx + ca * lz];
		const toL = (x, z) => { const dx = x - M.x, dz = z - M.z; return [ca * dx + sa * dz, -sa * dx + ca * dz]; };
		const dirW = (lx, lz) => [ca * lx - sa * lz, sa * lx + ca * lz];
		// a box's footprint in this frame
		const rectOf = (b, m = 0) => {
			const c = Math.cos(b.a), s = Math.sin(b.a);
			let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
			for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
				const [lx, lz] = toL(b.x + c * u * b.w / 2 - s * v * b.d / 2, b.z + s * u * b.w / 2 + c * v * b.d / 2);
				x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); z0 = Math.min(z0, lz); z1 = Math.max(z1, lz);
			}
			return [x0 - m, z0 - m, x1 + m, z1 + m];
		};
		const own = grp.map((b) => rectOf(b));
		let xl = -hw, xr = hw, back = -hd;
		for (const q of own) { xl = Math.min(xl, q[0]); xr = Math.max(xr, q[2]); back = Math.min(back, q[1]); }

		// the street in front, and down the sides on a corner lot
		const segs = streetsNear(M.x, M.z, Math.max(M.w, M.d) / 2 + 36);
		const ray = (lx, lz, ux, uz, max) => { const [x, z] = toW(lx, lz), [dx, dz] = dirW(ux, uz); return toStreet(segs, x, z, dx, dz, max); };
		let front = ray(0, hd, 0, 1, 30), grid = null;
		if (front == null && proc) {
			const [x, z] = toW(0, hd), [dx, dz] = dirW(0, 1);
			grid = gridLot(x, z, dx, dz);
			if (grid) front = grid.front;
		}
		const deep = front == null ? 6 : front;
		// the lot lines: halfway to the neighbours, or a side street's sidewalk
		let lotL = xl - 4, lotR = xr + 4, rear = back - 6 - r() * 4;
		const others = [];
		const near = proc ? (W?.city?.procHomes?.(M.x, M.z, 45) || []).flatMap((g) => (g === grp ? [] : g)) : real?.near?.('boxes', M.x, M.z, 45) || [];
		for (const b of near) {
			if (b.grp === grp || grp.includes(b)) continue;
			const q = rectOf(b);
			others.push(q);
			if (q[3] > -hd - 1 && q[1] < hd + 3) {
				if (q[0] >= xr - 0.5) lotR = Math.min(lotR, (xr + q[0]) / 2);
				else if (q[2] <= xl + 0.5) lotL = Math.max(lotL, (xl + q[2]) / 2);
			} else if (q[3] <= back + 0.5 && q[2] > xl && q[0] < xr) rear = Math.max(rear, (back + q[3]) / 2);
		}
		for (const s of [-1, 1]) {
			const t = ray(s > 0 ? xr : xl, hd + Math.min(2, deep / 2), s, 0, 8);
			if (t != null) { if (s > 0) lotR = Math.min(lotR, xr + t - 0.1); else lotL = Math.max(lotL, xl - t + 0.1); }
		}
		if (grid) rear = Math.max(rear, hd + grid.front - grid.half);
		const tb = ray(0, back, 0, -1, 16);
		if (tb != null) rear = Math.max(rear, back - tb + 1);
		rear = Math.max(rear, back - 15);

		// the drive and the front walk: from the map's paths, else where the garage and the door are
		const drives = [], walks = [], paved = [];
		for (const p of real?.near?.('paths', M.x, M.z, 30) || []) {
			const [ax, az] = toL(p.ax, p.az), [bx, bz] = toL(p.bx, p.bz), m = p.w / 2 + 0.1;
			if (Math.abs(bx - ax) < 1.5 + Math.abs(bz - az) * 0.15) {
				// (square to the house: one rectangle; a house's own runs on out to the street)
				const mine = az > back && ax > xl - 1 && ax < xr + 1 && bz > az;
				(mine ? (p.w >= 3 ? drives : walks) : paved).push([Math.min(ax, bx) - m, Math.min(az, bz) - 0.2, Math.max(ax, bx) + m, mine ? hd + deep + 2 : Math.max(az, bz) + 0.2]);
			} else {
				// (a slanting one in short pieces)
				const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 1.5);
				for (let k = 0; k < n; k++) {
					const x0 = ax + (bx - ax) * k / n, z0 = az + (bz - az) * k / n, x1 = ax + (bx - ax) * (k + 1) / n, z1 = az + (bz - az) * (k + 1) / n;
					paved.push([Math.min(x0, x1) - m, Math.min(z0, z1) - m, Math.max(x0, x1) + m, Math.max(z0, z1) + m]);
				}
			}
		}
		if (!drives.length) {
			const gw = grp.find((b) => b.kind === 3);
			if (gw) { const q = rectOf(gw); drives.push([q[0] + 0.2, q[3] - 0.2, q[2] - 0.2, hd + deep + 2]); }
			else if (M.kind === 1) drives.push([-hw + 0.3, hd - 0.2, -hw + 5.8, hd + deep + 2]);
			else if (M.kind === 2) drives.push([hw - 5.8, hd - 0.2, hw - 0.3, hd + deep + 2]);
		}
		if (!walks.length && M.kind <= 2) { const dx = (M.door - 0.5) * (M.w - 2.5); walks.push([dx - 0.7, hd - 0.2, dx + 0.7, hd + deep + 2]); }

		// what each yard is: lawn, or taken out for gravel and natives, or plastic grass
		const hood = hash2(Math.floor(M.x / 400), Math.floor(M.z / 400), 0x51ce);
		const u = r(), xeri = 0.15 + hood * 0.1;
		const frontIs = u < xeri * 0.65 ? 'xeriscape' : u < xeri ? 'artificial' : 'lawn';
		const backIs = r() < 0.15 ? 'hardscape' : 'lawn';
		const bedF = 0.8 + r() * 0.6, bedB = 0.5 + r() * 0.5;

		const lawns = [], heads = [], zones = [], beds = [];
		const zoneOf = (kind, name) => { let z = zones.find((q) => q.name === name); if (!z) zones.push(z = { name, kind, heads: 0, min: 0 }); return zones.indexOf(z); };
		const add = (lx, lz, a0, arc, R, noz, kind, zone) => {
			const [x, z] = toW(lx, lz);
			if (wet(x, z)) return null;
			const h = head(x, z, kind, a0 + M.a, arc, R, r, noz);
			h.zone = zone; h.lx = lx; h.lz = lz;
			heads.push(h); zones[zone].heads++;
			return h;
		};
		// a part of the yard, cut down to its lawns and watered
		const water = (area, holes, where) => {
			let list = [area];
			for (const o of holes) list = cut(list, o);
			list.sort((p, q) => (q[2] - q[0]) * (q[3] - q[1]) - (p[2] - p[0]) * (p[3] - p[1]));
			for (let q of list) {
				// (the front edge: wherever the sidewalk runs across this piece)
				if (where === 'front' && segs.length) {
					for (const lx of [q[0] + 0.3, q[2] - 0.3]) { const t = ray(lx, q[1], 0, 1, q[3] - q[1]); if (t != null) q = [q[0], q[1], q[2], Math.min(q[3], q[1] + t - 0.05)]; }
				}
				const w = q[2] - q[0], d = q[3] - q[1];
				if (w < 0.9 || d < 0.9 || w * d < 2.5) { if (w * d > 0.5) beds.push(q); continue; }
				if (Math.min(w, d) < STRIP) {
					if (Math.max(w, d) < 2.5) { beds.push(q); continue; }
					const z = zoneOf('strip', where === 'front' ? 'strips' : 'back strips');
					layStrip(q, (lx, lz, a0, arc, R, noz) => add(lx, lz, a0, arc, R, noz, 1, z));
					lawns.push({ q, zone: zones[z].name, where });
					continue;
				}
				const big = w * d >= 80 && Math.min(w, d) >= 6.5;
				const z = zoneOf(big ? 'rotor' : 'spray', where + (big ? ' rotors' : ' sprays'));
				layLawn(q, big ? ROTORS : SPRAYS, (lx, lz, a0, arc, R, N) => add(lx, lz, a0, arc, R, big ? (N > 9.5 ? 'rotor' : 'MP') : arc > 6 ? 'F' : arc > 3 ? 'H' : 'Q', big ? 2 : 1, z));
				lawns.push({ q, zone: zones[z].name, where });
			}
		};
		// the front: the house, its garage and wings with a bed along them, the drive and the walk
		const fz0 = hd + bedF, fz1 = hd + Math.min(deep, 25);
		if (frontIs === 'lawn' && fz1 - fz0 > 1.2) water([lotL + EDGE, fz0, lotR - EDGE, fz1], [...own.map((q) => [q[0] - bedF, q[1], q[2] + bedF, q[3] + bedF]), ...drives, ...walks, ...paved, ...others.map((q) => [q[0] - 0.5, q[1] - 0.5, q[2] + 0.5, q[3] + 0.5])], 'front');
		else if (fz1 - fz0 > 1.2) beds.push([lotL, fz0, lotR, fz1]);
		// the back: a bed along the house, the pool and its deck, a shed
		const holes = [...own.map((q) => [q[0] - bedB, q[1] - bedB, q[2] + bedB, q[3]]), ...paved, ...others.map((q) => [q[0] - 0.6, q[1] - 0.6, q[2] + 0.6, q[3] + 0.6])];
		for (const p of real?.near?.('pools', M.x, M.z, 30) || []) holes.push(rectOf(p, 1.3));
		if (backIs === 'lawn' && back - bedB - rear > 2) water([lotL + EDGE, rear + 0.3, lotR - EDGE, back - bedB], holes, 'back');
		if (beds.length || frontIs === 'xeriscape') zoneOf('drip', 'beds');

		// (a valve feeds a dozen sprays or eight rotors: a zone with more is split, left and right)
		for (let i = 0; i < zones.length; i++) {
			const Z = zones[i], lim = PER[Z.kind];
			if (!lim || Z.heads <= lim) continue;
			const mine = heads.filter((h) => h.zone === i).sort((p, q) => p.lx - q.lx), n = Math.ceil(mine.length / lim);
			for (let k = 1; k < n; k++) {
				const Zk = { name: Z.name + ' ' + (k + 1), kind: Z.kind, heads: 0, min: 0 };
				zones.splice(i + k, 0, Zk);
				for (const h of heads) if (h.zone > i + k - 1) h.zone++;
				for (const h of mine.slice(Math.round(k * mine.length / n), Math.round((k + 1) * mine.length / n))) h.zone = i + k;
			}
			for (let k = 0; k < n; k++) zones[i + k].heads = heads.filter((h) => h.zone === i + k).length;
			i += n - 1;
		}
		// the order a controller runs them: the front, the strips, the back, the beds
		const rank = (Z) => (Z.kind === 'drip' ? 9 : Z.name.startsWith('front') ? 0 : Z.name === 'strips' ? 1 : Z.kind === 'rotor' ? 3 : 2);
		const order = zones.map((Z, i) => i).sort((a, b) => rank(zones[a]) - rank(zones[b]) || a - b), to = order.map((i, k) => [i, k]);
		const remap = new Map(to);
		zones.splice(0, zones.length, ...order.map((i) => zones[i]));
		for (const h of heads) h.zone = remap.get(h.zone);
		for (const Z of zones) Z.min = Math.round(RUN[Z.kind][0] + r() * (RUN[Z.kind][1] - RUN[Z.kind][0]));

		// the odd fault, one at most: a head knocked round onto the sidewalk, one tilted, one broken off
		const f = r(), sprays = heads.filter((h) => h.kind === 1 && h.noz !== 'EST' && h.noz !== 'CST');
		let fault = null;
		if (sprays.length && f < 0.09) {
			const h = sprays[Math.floor(r() * sprays.length)];
			if (f < 0.04) { h.a0 += (r() < 0.5 ? -1 : 1) * 0.55; h.R *= 1.15; fault = 'knocked round'; }
			else if (f < 0.075) { h.el += 0.25; h.a0 += 0.2; fault = 'tilted'; }
			else { h.kind = 1; h.noz = 'broken'; h.arc = 0.3; h.el = 1.42; h.sp = 7 + r() * 1.5; h.R = 0.9; fault = 'broken'; }
			if (fault) h.fault = fault;
		}
		// the valve box by the drive, the controller on the garage wall
		const dv = drives[0], valve = toW(dv ? (dv[0] > 0 ? dv[0] - 0.6 : dv[2] + 0.6) : xl + 0.6, hd + 0.6);
		const ctrl = toW(dv ? (dv[0] + dv[2]) / 2 : xl, hd);

		const Y = heads.length ? { x: M.x, z: M.z, kind: 'house', heads, zones, timer: houseTimer(key), front: frontIs, back: backIs, fault, valve, ctrl, lot: [lotL, rear, lotR, hd + deep], lawns: lawns.map((l) => ({ zone: l.zone, where: l.where, pts: [toW(l.q[0], l.q[1]), toW(l.q[2], l.q[1]), toW(l.q[2], l.q[3]), toW(l.q[0], l.q[3])] })), a: M.a, win: null, rise: null } : null;
		if (Y) for (const h of heads) h.yard = Y;
		yards.set(key, Y);
		return key;
	}

	// ---- the parks', fields' and golf courses' rotors: a triangular grid, head to head
	const S = 16, RZ = S * Math.sqrt(3) / 2;
	let paths = { x: 1e9, z: 1e9, segs: [] };
	// the walks through the parks, near a point
	function walksNear(x, z) {
		if (Math.hypot(x - paths.x, z - paths.z) > 60) {
			const segs = [];
			for (const q of world()?.real?.near?.('roads', x, z, 120) || []) {
				if (!PATHS.has(q.cls)) continue;
				const p = q.pts;
				for (let i = 0; i + 3 < p.length; i += 2) segs.push(p[i], p[i + 1], p[i + 2], p[i + 3], q.w / 2 + 0.6);
			}
			paths = { x, z, segs };
		}
		return paths.segs;
	}
	function parkPoint(i, j) {
		const key = (Math.imul(i, 92837111) ^ Math.imul(j, 689287499) ^ 0x9a2c) >>> 0;
		if (yards.has(key)) return key;
		let Y = null;
		let x = (i + (j & 1) * 0.5) * S, z = j * RZ;
		const walk = walksNear(x, z);
		const grass = (px, pz) => turf(px, pz) && !onStreet(walk, px, pz);
		// (a court or a lawn too small for a rotor: no)
		let n = 0;
		for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) if (turf(x + u * 10, z + v * 10)) n++;
		if (grass(x, z) && n >= 6) {
			const B = 12, open = new Array(B);
			const look = (px, pz) => { for (let k = 0; k < B; k++) { const a = k * TAU / B; const c = Math.cos(a) * S, s = Math.sin(a) * S; open[k] = grass(px + c * 0.35, pz + s * 0.35) && grass(px + c * 0.65, pz + s * 0.65) && grass(px + c * 0.95, pz + s * 0.95); } };
			look(x, z);
			let shut = 0, ox = 0, oz = 0;
			for (let k = 0; k < B; k++) if (!open[k]) { shut++; ox += Math.cos(k * TAU / B); oz += Math.sin(k * TAU / B); }
			// at the grass's edge: out to it, and throw back in
			if (shut && Math.hypot(ox, oz) > 0.3) {
				const l = Math.hypot(ox, oz);
				ox /= l; oz /= l;
				let t = 0;
				while (t < S * 0.6 && grass(x + ox * (t + 1), z + oz * (t + 1))) t++;
				x += ox * Math.max(0, t - 0.6); z += oz * Math.max(0, t - 0.6);
				look(x, z);
			}
			// the longest run of open bearings
			let k0 = -1, run = 0;
			if (open.every(Boolean)) run = B;
			else for (let k = 0; k < B; k++) {
				if (open[k] && !open[(k + B - 1) % B]) { let m = 0; while (m < B && open[(k + m) % B]) m++; if (m > run) { run = m; k0 = k; } }
			}
			if (run >= 4) {
				const r = rng(key), R = S * (0.98 + r() * 0.04);
				// (a part circle set to the open bearings: a half along a straight edge, a quarter in a corner)
				const full = run === B, arc = full ? TAU : (run - 1) * TAU / B, mid = (k0 + (run - 1) / 2) * TAU / B;
				const h = head(x, z, 2, full ? r() * TAU : mid - arc / 2, arc, R, r, full ? 'rotor' : 'rotor ' + Math.round(arc * 180 / Math.PI));
				// (a controller to a few blocks; its stations one after another through the night)
				const ci = Math.floor(x / 160), cj = Math.floor(z / 160), rc = rng((Math.imul(ci, 7919) ^ Math.imul(cj, 104729) ^ 0x3a7) >>> 0);
				const startAt = 22 + rc() * 6, len = (15 + rc() * 10) / 60, stations = 10 + Math.floor(rc() * 8), off = rc() < 0.15;
				h.zone = Math.floor(hash2(Math.floor(x / 40), Math.floor(z / 40), 0x77) * stations);
				const s = (startAt + h.zone * (len + 1 / 60)) % 24;
				Y = { x, z, kind: 'park', heads: [h], zones: [{ name: 'station ' + (h.zone + 1), kind: 'rotor', heads: 1, min: Math.round(len * 60) }], win: off ? null : [s, len], fixed: true };
				h.yard = Y; h.zone = 0;
			}
		}
		yards.set(key, Y);
		return key;
	}

	// ---- the fishing village's fenced yards: the front lawn either side of the gate path, the back
	function villageYards() {
		const list = [];
		const fp = world()?.village?.footprints || [];
		for (const f of fp) {
			if (!f.fence) continue;
			const key = keyOf(f.x + 0.25, f.z);
			if (!yards.has(key)) {
				const r = rng(key);
				const c = Math.cos(f.face), s = Math.sin(f.face);
				const at = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
				const home = fp.find((q) => !q.fence && q.x === f.x && q.z === f.z);
				const hd = home ? home.d / 2 : 3;
				const heads = [], zones = [{ name: 'front sprays', kind: 'spray', heads: 0, min: 0 }, { name: 'back sprays', kind: 'spray', heads: 0, min: 0 }];
				const put = (zone) => (lx, lz, a0, arc, R) => { const [x, z] = at(lx, lz); const h = head(x, z, 1, a0 - f.face, arc, R, r, arc > 6 ? 'F' : arc > 3 ? 'H' : 'Q'); h.zone = zone; heads.push(h); zones[zone].heads++; };
				const zf = hd + 1.6;
				for (const q of [[-f.fx + EDGE, zf, -0.8, f.fzF - EDGE], [0.8, zf, f.fx - EDGE, f.fzF - EDGE]]) if (q[2] - q[0] > 1.5 && q[3] - q[1] > 1.5) layLawn(q, SPRAYS, put(0));
				const qb = [-f.fx + EDGE, f.fzB + EDGE, f.fx - EDGE, -hd + 0.8];
				if (qb[3] - qb[1] > 1.5) layLawn(qb, SPRAYS, put(1));
				for (const Z of zones) Z.min = Math.round(6 + r() * 4);
				// (a yard with no front lawn: its back the one zone)
				if (!zones[0].heads) { zones.shift(); for (const h of heads) h.zone = 0; }
				const Y = { x: f.x, z: f.z, kind: 'village', heads, zones, timer: houseTimer(key), win: null, rise: null };
				for (const h of heads) h.yard = Y;
				yards.set(key, heads.length ? Y : null);
			}
			list.push(key);
		}
		return list;
	}

	// what is in reach, rescanned as you move; new yards worked out a few at a time
	function scan(cam, dt) {
		const x = cam.position.x, z = cam.position.z;
		scanT -= dt;
		if (Math.hypot(x - scanX, z - scanZ) > 15 || scanT < 0) {
			scanX = x; scanZ = z; scanT = 4;
			const W = world(), keys = villageYards();
			queue = [];
			if (W?.real?.loaded?.()) {
				const seen = new Set();
				for (const b of W.real.near('boxes', x, z, REACH)) {
					if (!b.grp || b.grp.biz || b.grp.shut || seen.has(b.grp)) continue;
					seen.add(b.grp);
					queue.push(() => houseYard(b.grp, false));
				}
				for (let j = Math.floor((z - REACH) / RZ); j <= Math.ceil((z + REACH) / RZ); j++) for (let i = Math.floor((x - REACH) / S) - 1; i <= Math.ceil((x + REACH) / S); i++) {
					if (Math.hypot((i + (j & 1) * 0.5) * S - x, j * RZ - z) < REACH) queue.push(() => parkPoint(i, j));
				}
			}
			for (const grp of W?.city?.procHomes?.(x, z, REACH) || []) queue.push(() => houseYard(grp, true));
			// (the ground under the heads looked at again: it may have loaded since)
			for (const k of live) for (const h of yards.get(k)?.heads || []) h.y = 0;
			live.length = 0;
			for (const k of keys) live.push(k);
			queue.reverse();
		}
		// (a millisecond or two a frame at most)
		const t0 = performance.now();
		while (queue.length && performance.now() - t0 < (isPhone ? 1 : 2)) {
			const k = queue.pop()();
			if (k != null && !live.includes(k)) live.push(k);
		}
		// let the far ones go
		if (yards.size > 6000) for (const [k, Y] of yards) if (!Y || Math.hypot(Y.x - x, Y.z - z) > REACH * 3) yards.delete(k);
	}
	// a yard's zones on the clock: each its start and its length, in hours, one after another
	function plan(Y, rise) {
		Y.rise = rise;
		const T = Y.timer;
		if (!T || T.at == null) { Y.win = null; return; }
		let s = (T.at === 'rise' ? rise : T.at) + T.off;
		Y.win = [];
		for (const Z of Y.zones) { Y.win.push(s % 24, Z.min / 60); s += Z.min / 60 + 1 / 60; }
	}

	// the heads in reach with what they are doing at this hour: on (0/1) and how wet their grass is
	let lastH = null;
	function heads(cam, hours, dt, force, rain, rise = 6) {
		scan(cam, dt);
		// (how far the clock ran since the last frame; a jump of the clock is not a run)
		const run = lastH == null ? 0 : since(hours, lastH), step = run < 2 ? run : 0;
		lastH = hours;
		out.length = 0;
		for (const k of live) {
			const Y = yards.get(k);
			if (!Y) continue;
			if (!Y.fixed && Y.rise !== rise) plan(Y, rise);
			const win = Y.win;
			for (const h of Y.heads) {
				// (looked at again on each rescan: the map's finer layers may have come in since)
				if (!h.y) { h.y = ground(h.x, h.z) + 0.1; h.ok = Y.kind === 'park' ? turf(h.x, h.z) : !wet(h.x, h.z); }
				if (!h.ok) continue;
				let on = force ? 1 : 0, w = force ? 1 : 0;
				if (win) {
					const z0 = win[h.zone * 2], len = win[h.zone * 2 + 1], a = since(hours, z0);
					// (on in its window, or if the clock ran right past its start since the last frame)
					if (a < len || a <= step) { if (!rain) on = 1; w = Math.max(w, Math.min(1, 0.3 + Math.min(a, len) * 6)); }
					else w = Math.max(w, 1 - (a - len) / 2.5);
				}
				h.on = on;
				h.wet = Math.max(0, w);
				out.push(h);
			}
		}
		return out;
	}
	// every yard worked out so far near a point, for a look at the design
	function layout(x, z, r = 60) {
		const list = [];
		for (const Y of yards.values()) if (Y && Math.hypot(Y.x - x, Y.z - z) < r) list.push(Y);
		return list;
	}
	return { heads, layout, count: () => live.length, reset() { yards.clear(); live.length = 0; scanX = 1e9; } };
}
