// A real house, from its footprint to its rooms and furniture. No three.js here: the plan
// is plain numbers, so it can be checked on its own (tools/houseplan-test.mjs).
//
// The mapped footprint (one building's rectangles, all turned the same way, local +z
// facing the street) is laid on a grid in the main block's frame. The garage and the
// front door go exactly where the far facade paints them (city.js), so nothing jumps
// when the house comes close. The stairs rise beside the entry, as they do in most
// two-storey tract houses of the 1980s and 90s; the rest of each floor is shared out
// among the rooms such a house has, each grown from a seed as a rectangle and then
// into what is left (living room at the front, kitchen and family room at the back,
// powder room and laundry by the garage, bedrooms upstairs round a hall). Doorways join
// the rooms, windows go where the rooms meet the outside, and the furniture follows the
// rooms. The house's position seeds everything, so it is the same house every visit.

// heights above the ground floor, in metres
export const HT = { ceil0: 2.6, floor1: 2.9, ceil1: 5.45, top1: 2.9, top2: 5.75, door: 2.05 };
// wall thickness: outside walls (stud and stucco), partitions
export const TW = { ext: 0.16, part: 0.11 };
const STAIR = { w: 1.0, run: 3.3, land: 1.4, n: 14 };
// a hall's width, wall to wall (a little over a metre and a quarter clear)
const HALLW = 1.4;
// the least a room can be across, wall line to wall line, by its use
const MIN = { bath: 1.7, mbath: 1.7, powder: 1.4, laundry: 1.7, closet: 1.2 };
const minOf = (t) => MIN[t] ?? 2.5;
// which go first when a zone has no room for all it was given
const RANK = { closet: 0, loft: 1, office: 1.5, powder: 2, bath: 2.5, bed: 3, laundry: 3, dining: 3.5 };

// the runtime kinds (bake-realcity.py): 0 house, 1 garage left, 2 garage right, 3 garage wing, 4 wing
export const storeysOf = (b) => ((b.kind <= 2 || b.kind === 4) && b.wallH >= 3.8 ? 2 : 1);
export const wallTop = (b) => (b.kind > 4 ? b.wallH : storeysOf(b) === 2 ? Math.max(HT.top2, b.wallH) : b.kind === 3 ? b.wallH : Math.max(HT.top1, b.wallH));
export const isHome = (b) => b.kind <= 4;
export function mainOf(grp) {
	let m = null;
	for (const b of grp) if (b.kind <= 2 && (!m || b.w * b.d > m.w * m.d)) m = b;
	return m;
}
// the ground floor sits just above the highest ground under the house: downhill the
// foundation shows, as on the hillside lots
export function houseFloor(grp, heightAt) {
	let m = -1e9;
	for (const b of grp) {
		const ca = Math.cos(b.a), sa = Math.sin(b.a);
		for (const [sx, sz] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) m = Math.max(m, heightAt(b.x + ca * sx * b.w / 2 - sa * sz * b.d / 2, b.z + sa * sx * b.w / 2 + ca * sz * b.d / 2));
	}
	return m + 0.15;
}

function rng(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const houseSeed = (M) => (Math.imul(Math.round(M.x * 2) | 0, 73856093) ^ Math.imul(Math.round(M.z * 2) | 0, 19349663)) >>> 0;

const PUBLIC = new Set(['entry', 'hall', 'living', 'dining', 'kitchen', 'family']);
const BEDS = new Set(['master', 'bed']);
// how two rooms meet: no wall at all, a wide cased opening, or (when needed) a door
function relation(a, b) {
	const k = a < b ? a + '|' + b : b + '|' + a;
	if (k === 'family|kitchen' || k === 'entry|hall' || k === 'hall|loft') return 'open';
	if (PUBLIC.has(a) && PUBLIC.has(b)) return 'wide';
	return null;
}
// which reached room a newly reached one takes its door from
function doorScore(u, v) {
	const T = { mbath: { master: 10, hall: 2 }, bath: { hall: 8, entry: 6, bed: 3, master: 2 }, powder: { entry: 8, hall: 8, family: 5, kitchen: 5, living: 4, dining: 3 },
		laundry: { garage: 7, kitchen: 6, hall: 6, entry: 6, family: 4 }, garage: { laundry: 8, kitchen: 6, entry: 6, hall: 6, family: 4, dining: 2, living: 2 },
		master: { hall: 9, entry: 6, living: 4, family: 4 }, bed: { hall: 9, loft: 7, entry: 6, living: 4, family: 4 }, closet: { master: 8, bed: 6, hall: 5 },
		office: { entry: 8, hall: 8, living: 6, family: 5 } };
	const t = T[u];
	if (t) return t[v] ?? (BEDS.has(v) ? 0.5 : 1);
	return PUBLIC.has(v) ? 5 : 1;
}

// ---------------------------------------------------------------------------------
// the footprint

function frameOf(grp, M) {
	const ca = Math.cos(M.a), sa = Math.sin(M.a);
	const rects = grp.map((b) => {
		const dx = b.x - M.x, dz = b.z - M.z, lx = ca * dx + sa * dz, lz = -sa * dx + ca * dz;
		const sw = Math.abs(Math.round((b.a - M.a) / (Math.PI / 2))) % 2 === 1;
		const w = sw ? b.d : b.w, d = sw ? b.w : b.d;
		return { b, main: b === M, x0: lx - w / 2, x1: lx + w / 2, z0: lz - d / 2, z1: lz + d / 2, st: storeysOf(b), top: wallTop(b) };
	});
	// the rectangles' edges are rounded in the data (centres to half a metre): pull near
	// edges together so neighbouring blocks meet without slits; the main block's own
	// edges win, since its door and garage are placed from them
	for (const [k0, k1] of [['x0', 'x1'], ['z0', 'z1']]) {
		const vals = [];
		for (const r of rects) for (const k of [k0, k1]) vals.push({ r, k, v: r[k], p: r.main ? 1 : 0 });
		vals.sort((a, b) => a.v - b.v);
		for (let i = 0; i < vals.length;) {
			let j = i + 1;
			while (j < vals.length && vals[j].v - vals[j - 1].v < 0.55) j++;
			const cl = vals.slice(i, j), pm = cl.find((c) => c.p);
			const rep = pm ? pm.v : cl.reduce((s, c) => s + c.v, 0) / cl.length;
			for (const c of cl) c.r[c.k] = rep;
			i = j;
		}
	}
	return { ca, sa, rects: rects.filter((r) => r.x1 - r.x0 > 0.5 && r.z1 - r.z0 > 0.5) };
}

// the rectangle under a point, the tallest where they overlap
function under(rects, x, z) {
	let best = null;
	for (const r of rects) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && (!best || r.top > best.top)) best = r;
	return best;
}

function buildGrid(rects, extra) {
	const axis = (k0, k1, more) => {
		let e = [];
		for (const r of rects) e.push(r[k0], r[k1]);
		const lo = Math.min(...e), hi = Math.max(...e);
		// (a line of the plan's own only where it leaves a usable strip to the lines already there)
		for (const v of more) if (v > lo + 0.05 && v < hi - 0.05 && e.every((u) => Math.abs(u - v) > 0.45)) e.push(v);
		e.sort((a, b) => a - b);
		e = e.filter((v, i) => i === 0 || v - e[i - 1] > 0.04);
		const out = [e[0]];
		for (let i = 1; i < e.length; i++) {
			const L = e[i] - e[i - 1], n = Math.max(1, Math.ceil(L / 0.5 - 0.01));
			for (let k = 1; k <= n; k++) out.push(e[i - 1] + L * k / n);
		}
		return out;
	};
	const X = axis('x0', 'x1', extra.x), Z = axis('z0', 'z1', extra.z);
	const nx = X.length - 1, nz = Z.length - 1;
	const occ = new Int16Array(nx * nz).fill(-1);
	for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
		const r = under(rects, (X[i] + X[i + 1]) / 2, (Z[j] + Z[j + 1]) / 2);
		if (r) occ[i + j * nx] = rects.indexOf(r);
	}
	return { X, Z, nx, nz, occ };
}

// ---------------------------------------------------------------------------------
// the plan

export function planHouse(grp, opt = {}) {
	const M = mainOf(grp);
	if (!M) return null;
	const rnd = rng(houseSeed(M) ^ (opt.salt || 0));
	const { ca, sa, rects } = frameOf(grp, M);
	if (!rects.length) return null;
	const R0 = rects.find((r) => r.main) || rects[0];
	const at = (x, z) => under(rects, x, z);
	const tall = (x, z) => { const r = at(x, z); return !!r && r.st === 2; };

	// the garage: a wing of its own, or built into the main block's front at one end
	let garage = null;
	const gw = rects.find((r) => r.b.kind === 3);
	if (M.kind === 1 || M.kind === 2) {
		const left = M.kind === 1, w = R0.x1 - R0.x0;
		const gx0 = R0.x0 + (left ? 0.35 : w - 5.75);
		garage = { x0: left ? R0.x0 : R0.x1 - 6.2, x1: left ? R0.x0 + 6.2 : R0.x1, z0: R0.z1 - 6.4, z1: R0.z1, front: R0.z1, doors: [0, 1].map((k) => ({ x0: gx0 + k * 2.7 + 0.12, x1: gx0 + k * 2.7 + 2.58, h: 2.15 })) };
	} else if (gw) {
		const w = gw.x1 - gw.x0, bays = Math.min(3, Math.max(1, Math.floor(w / 2.9))), bw = w / bays;
		garage = { x0: gw.x0, x1: gw.x1, z0: gw.z0, z1: gw.z1, front: gw.z1, doors: [...Array(bays)].map((_, k) => ({ x0: gw.x0 + k * bw + 0.3, x1: gw.x0 + (k + 1) * bw - 0.3, h: 2.2 })) };
	}
	const inGarage = (x, z) => !!garage && x > garage.x0 && x < garage.x1 && z > garage.z0 && z < garage.z1;
	const gSide = garage ? Math.sign((garage.x0 + garage.x1) / 2 - (R0.x0 + R0.x1) / 2) || 1 : (rnd() < 0.5 ? -1 : 1);

	// the front door, where the facade shows it; if another block stands in front of it,
	// the nearest open stretch of the front
	const MW = R0.x1 - R0.x0;
	let door = { x: R0.x0 + 1.25 + M.door * (MW - 2.5), z: R0.z1, w: 0.95 };
	const doorOK = (x, z) => [-0.6, 0, 0.6].every((o) => !at(x + o, z + 0.15) && at(x + o, z - 0.15) && !inGarage(x + o, z - 0.15));
	if (!doorOK(door.x, door.z)) {
		let best = null;
		for (const r of rects) for (let x = r.x0 + 0.8; x <= r.x1 - 0.8; x += 0.25) {
			if (!doorOK(x, r.z1)) continue;
			const c = Math.abs(x - door.x) + Math.abs(r.z1 - door.z);
			if (!best || c < best.c) best = { x, z: r.z1, c };
		}
		if (best) door = { x: best.x, z: best.z, w: 0.95 };
	}

	// the stairs: a straight run up toward the back, with a landing at the top, all under
	// the second storey; beside the entry if it fits, against a wall or well clear of one
	// (never with a strip too narrow to use between them)
	let stairs = null;
	const hasUp = rects.some((r) => r.st === 2);
	if (hasUp) {
		const ok = (x0, zb) => {
			const x1 = x0 + STAIR.w, zl = zb - STAIR.run - STAIR.land;
			for (let x = x0 + 0.1; x < x1; x += 0.4) for (let z = zl + 0.1; z < zb; z += 0.25) if (!tall(x, z) || inGarage(x, z)) return false;
			// room to step on at the bottom
			for (let x = x0 + 0.1; x < x1; x += 0.4) for (let z = zb + 0.1; z < zb + 0.9; z += 0.25) { const r = at(x, z); if (!r || inGarage(x, z)) return false; }
			return true;
		};
		// how far the upper floor runs on from x, along z
		const reach = (x, z, dir) => { let d = 0; while (d < 30 && tall(x + dir * (d + 0.05), z)) d += 0.1; return d; };
		let best = null;
		const bx0 = Math.min(...rects.map((r) => r.x0)), bx1 = Math.max(...rects.map((r) => r.x1)), bz0 = Math.min(...rects.map((r) => r.z0));
		const xs = [];
		for (let x0 = bx0 + 0.2; x0 + STAIR.w < bx1 - 0.2; x0 += 0.25) xs.push(x0);
		for (const r of rects) if (r.st === 2) xs.push(r.x0 + TW.ext, r.x1 - TW.ext - STAIR.w);
		const want = door.x + (gSide > 0 ? -1 : 1) * (door.w / 2 + 0.75 + STAIR.w / 2), zEdges = rects.flatMap((r) => [r.z0, r.z1]);
		for (const x0 of xs) for (let zb = door.z - 1.3; zb - STAIR.run - STAIR.land > bz0 + 0.2; zb -= 0.25) {
			// beside the door, on the side away from the garage when both fit
			let c = Math.abs(x0 + STAIR.w / 2 - want) + Math.abs(zb - (door.z - 1.3)) * 0.6;
			if (best && c >= best.c) continue;
			if (!ok(x0, zb)) continue;
			// the strips beside the stairwell upstairs: against the wall, or wide enough for a room
			const zm = zb - STAIR.run / 2;
			for (const g of [reach(x0, zm, -1), reach(x0 + STAIR.w, zm, 1)]) if (g > 0.25 && g < 2.7) c += 6;
			// (and the landing's lines not so near a wall's that the grid would lose them)
			for (const z of [zb - STAIR.run, zb - STAIR.run - STAIR.land]) if (zEdges.some((e) => Math.abs(e - z) > 0.02 && Math.abs(e - z) < 0.47)) c += 2;
			if (!best || c < best.c) best = { x0, zb, c };
		}
		if (best) stairs = { x0: best.x0, x1: best.x0 + STAIR.w, zb: best.zb, zt: best.zb - STAIR.run, zl: best.zb - STAIR.run - STAIR.land, n: STAIR.n };
	}
	if (stairs) {
		stairs.R = HT.floor1 / stairs.n;
		stairs.T = STAIR.run / (stairs.n - 1);
		stairs.zw = stairs.zb;
	}

	// the entry: a hall behind the front door, taking in the stairs when they stand beside it
	let entry = { x0: door.x - 1.1, x1: door.x + 1.1, z0: door.z - 2.4, z1: door.z };
	let stairHall = null;
	if (stairs) {
		const near = stairs.x1 > entry.x0 - 1.2 && stairs.x0 < entry.x1 + 1.2 && stairs.zb > door.z - 2.2;
		if (near) entry = { x0: Math.min(entry.x0, stairs.x0), x1: Math.max(entry.x1, stairs.x1), z0: Math.min(entry.z0, stairs.zt), z1: door.z };
		else {
			// the stairs stand elsewhere: a hall of their own, with a passage beside them
			const side = at(stairs.x1 + 0.5, (stairs.zb + stairs.zt) / 2) && !inGarage(stairs.x1 + 0.5, (stairs.zb + stairs.zt) / 2) ? 1 : -1;
			stairHall = { x0: side > 0 ? stairs.x0 : stairs.x0 - HALLW, x1: side > 0 ? stairs.x1 + HALLW : stairs.x1, z0: stairs.zt, z1: stairs.zb + 1.5 };
		}
	}

	// the halls: upstairs, a landing at the top of the stairs running across the house from
	// wall to wall; in a one-storey house big enough for one, a hall from behind the entry to
	// the far wall, the bedrooms along it
	const up = hasUp;
	const bx0 = Math.min(...rects.map((r) => r.x0)), bx1 = Math.max(...rects.map((r) => r.x1));
	let hall0 = null, hall1 = null;
	if (stairs) {
		const zc = (stairs.zl + stairs.zt) / 2;
		let xa = stairs.x0, xb = stairs.x1;
		while (xa - 0.1 > bx0 && tall(xa - 0.1, zc) && !inGarage(xa - 0.1, zc)) xa -= 0.1;
		while (xb + 0.1 < bx1 && tall(xb + 0.1, zc) && !inGarage(xb + 0.1, zc)) xb += 0.1;
		hall1 = { x0: xa - 0.2, x1: xb + 0.2, z0: stairs.zl, z1: stairs.zt };
	}
	const far = gSide > 0 ? -1 : 1;
	if (!up) {
		const z1 = entry.z0, z0 = z1 - HALLW, zc = (z0 + z1) / 2;
		let xa = door.x, xb = door.x;
		while (xa - 0.1 > bx0 && at(xa - 0.1, zc) && !inGarage(xa - 0.1, zc)) xa -= 0.1;
		while (xb + 0.1 < bx1 && at(xb + 0.1, zc) && !inGarage(xb + 0.1, zc)) xb += 0.1;
		const x0 = far > 0 ? entry.x0 : xa - 0.2, x1 = far > 0 ? xb + 0.2 : entry.x1;
		// (a narrow house has its rooms one off another, as a cottage does, and no hall)
		if (x1 - x0 > 5 && xb - xa > 9.5 && z0 > Math.min(...rects.map((r) => r.z0)) + 2.6) hall0 = { x0, x1, z0, z1 };
	}

	// the grid, with the stairs, garage, entry and halls on its lines (the first given win
	// where two would come too close)
	const ex = { x: [], z: [] };
	if (stairs) { ex.x.push(stairs.x0, stairs.x1); ex.z.push(stairs.zb, stairs.zt, stairs.zl); }
	if (garage) { ex.x.push(garage.x0, garage.x1); ex.z.push(garage.z0); }
	if (stairHall) { ex.x.push(stairHall.x0, stairHall.x1); ex.z.push(stairHall.z1); }
	ex.x.push(entry.x0, entry.x1); ex.z.push(entry.z0);
	if (hall0) { ex.x.push(far > 0 ? hall0.x0 : hall0.x1); ex.z.push(hall0.z0); }
	const G = buildGrid(rects, ex);
	const { X, Z, nx, nz, occ } = G;
	const N = nx * nz;
	const cx = (i) => (X[i] + X[i + 1]) / 2, cz = (j) => (Z[j] + Z[j + 1]) / 2;
	const area = (c) => (X[c % nx + 1] - X[c % nx]) * (Z[Math.floor(c / nx) + 1] - Z[Math.floor(c / nx)]);
	const onLevel = (c, L) => occ[c] >= 0 && (L === 0 || rects[occ[c]].st === 2);
	const labels = [new Int16Array(N).fill(-1), new Int16Array(N).fill(-1)];
	const rooms = [];
	const addRoom = (type, level, extra) => { const r = { id: rooms.length, type, level, cells: [], area: 0, ...extra }; rooms.push(r); return r; };
	const give = (r, c) => { labels[r.level][c] = r.id; r.cells.push(c); r.area += area(c); };
	const carve = (r, box) => {
		for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
			const c = i + j * nx;
			if (!onLevel(c, r.level) || labels[r.level][c] >= 0) continue;
			const x = cx(i), z = cz(j);
			if (x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1 && !(r.level === 0 && inGarage(x, z))) give(r, c);
		}
		return r;
	};
	const inStairs = (x, z, withLanding) => !!stairs && x > stairs.x0 && x < stairs.x1 && z < stairs.zb && z > (withLanding ? stairs.zl : stairs.zt);

	// ground floor
	if (garage) carve(addRoom('garage', 0), garage);
	const E0 = carve(addRoom('entry', 0), entry);
	const SH = stairHall ? carve(addRoom('hall', 0), stairHall) : null;
	const H0 = hall0 ? carve(addRoom('hall', 0), hall0) : null;
	const freeArea = (L) => { let s = 0; for (let c = 0; c < N; c++) if (onLevel(c, L) && labels[L][c] < 0) s += area(c); return s; };
	// the extent of a level's free floor
	const extent = (L) => {
		let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
		for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (onLevel(i + j * nx, L) && labels[L][i + j * nx] < 0) { a = Math.min(a, X[i]); c = Math.max(c, X[i + 1]); b = Math.min(b, Z[j]); d = Math.max(d, Z[j + 1]); }
		return { x0: a, z0: b, x1: c, z1: d };
	};
	// seeds are placed across the free floor: u from the garage side, v from the front
	const bedSeeds = [[0.1, 0.1], [0.9, 0.1], [0.1, 0.8], [0.9, 0.5], [0.5, 0.1]];
	const F0 = freeArea(0);
	const freeMask = (L, keep) => { const m = new Uint8Array(N); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const c = i + j * nx; if (onLevel(c, L) && labels[L][c] < 0 && keep(cx(i), cz(j))) m[c] = 1; } return m; };
	const ids = (...rs) => new Set(rs.filter(Boolean).map((r) => r.id));
	if (up) {
		const prog0 = [['living', 0.85, 0.12, 0.2], ['dining', 0.3, 0.2, 0.13], ['kitchen', 0.3, 0.8, 0.17], ['family', 0.8, 0.85, 0.24], ['powder', 0.08, 0.5, -3.5]];
		if (garage) prog0.push(['laundry', 0.05, 0.3, -4.5]);
		if (F0 > 110) prog0.push(['office', 0.95, 0.5, 0.1]);
		if (F0 > 165) prog0.push(['bed', 0.9, 0.62, 0.09], ['bath', 0.6, 0.55, -5]);
		layout(0, prog0, [{ mask: freeMask(0, () => true), hubs: ids(E0, SH), takes: () => true, extra: 'office', extra2: 'family' }]);
	} else if (H0) {
		// one storey: the bedrooms along the hall, the living rooms on the garage side of it
		const xs = far > 0 ? hall0.x0 : hall0.x1, priv = (x) => (x - xs) * far > 0;
		const prog0 = [['living', 0.45, 0.12, 0.17], ['kitchen', 0.3, 0.75, 0.13], ['family', 0.5, 0.9, 0.15], ['master', 0.95, 0.9, 0.15], ['mbath', 0.97, 0.62, -6], ['bath', 0.8, 0.45, -5]];
		if (garage) prog0.push(['laundry', 0.05, 0.3, -4.2]);
		const nb = Math.max(1, Math.min(3, Math.round((F0 - 70) / 25)));
		for (let k = 0; k < nb; k++) prog0.push(['bed', 1 - bedSeeds[k][0] * 0.2, bedSeeds[k][1] < 0.5 ? 0.12 : 0.55, 0.1]);
		if (F0 > 120) prog0.push(['dining', 0.3, 0.3, 0.1]);
		const PRIV = new Set(['master', 'mbath', 'bath', 'bed']);
		layout(0, prog0, [
			{ mask: freeMask(0, (x) => priv(x)), hubs: ids(H0, E0), hall: H0 && { room: H0, box: hall0 }, takes: (t) => PRIV.has(t), extra: 'bed' },
			{ mask: freeMask(0, (x) => !priv(x)), hubs: ids(H0, E0), takes: (t) => !PRIV.has(t), extra: 'office', extra2: 'family' },
		]);
	} else {
		let prog0 = [['living', 0.45, 0.12, 0.2], ['kitchen', 0.3, 0.75, 0.16], ['family', 0.5, 0.9, 0.16], ['master', 0.95, 0.9, 0.2], ['bath', 0.8, 0.45, -5]];
		if (garage) prog0.push(['laundry', 0.05, 0.3, -4.2]);
		if (F0 < 55) prog0 = [['living', 0.5, 0.2, 0.4], ['kitchen', 0.2, 0.8, 0.25], ['bed', 0.9, 0.8, 0.3], ['bath', 0.8, 0.4, -4.5]];
		if (F0 < 26) prog0 = [['living', 0.5, 0.3, 0.7], ['bath', 0.8, 0.8, -3.2]];
		layout(0, prog0, [{ mask: freeMask(0, () => true), hubs: ids(E0), takes: () => true }]);
	}

	// upper floor: the landing's hall, the stairwell in it; bedrooms off it
	if (up) {
		let H1 = null;
		if (stairs) {
			H1 = addRoom('hall', 1);
			carve(H1, { x0: stairs.x0, x1: stairs.x1, z0: stairs.zt, z1: stairs.zb });
			// (what is left between the well and the front wall, too little for a room, opens
			// into the well: the entry below rises the two storeys there)
			let zf = stairs.zb;
			while (zf < 30 && tall((stairs.x0 + stairs.x1) / 2, zf + 0.1)) zf += 0.1;
			if (zf - stairs.zb < 2.6) { carve(H1, { x0: stairs.x0, x1: stairs.x1, z0: stairs.zb - 0.01, z1: zf + 0.2 }); stairs.zw = zf + 0.2; }
			carve(H1, hall1);
		}
		const F1 = freeArea(1);
		let prog1 = [['master', 0.8, 0.9, 0.24], ['mbath', 0.45, 0.97, -7], ['bath', 0.5, 0.45, -5]];
		if (F1 > 95) prog1.push(['closet', 0.6, 0.97, -4]);
		const nb = Math.max(1, Math.min(4, Math.round((F1 - 45) / 17)));
		for (let k = 0; k < nb; k++) prog1.push(['bed', ...bedSeeds[k], 0.13]);
		if (nb >= 3) prog1.push(['bath', 0.2, 0.45, -5]);
		if (F1 > 125) prog1.push(['loft', 0.5, 0.3, 0.1]);
		if (F1 < 45) prog1 = [['bed', 0.3, 0.3, 0.6], ['bath', 0.8, 0.8, -4.5]];
		layout(1, prog1, [{ mask: freeMask(1, () => true), hubs: ids(H1), hall: H1 && { room: H1, box: hall1 }, takes: () => true, extra: 'bed', extra2: F1 > 110 ? 'loft' : 'bed' }]);
	}

	// ---- the rooms of a level. Its free floor is cut into rectangles (zones), the biggest
	// first; each zone is shared among the rooms given to it by cuts straight across it (and,
	// where it lies along a hall, across the hall, so each room keeps a wall on the hall for
	// its door). So every room is a rectangle no narrower than its use needs, and no hallway
	// is made that the plan did not ask for. A few layouts are tried and the best is kept.
	function layout(L, prog, pools) {
		let best = null;
		for (let t = 0; t < 10; t++) {
			const a = attempt(L, prog, pools, t ? 0.45 : 0);
			if (!best || a.cost < best.cost - 1e-9) best = a;
		}
		for (const p of best.pieces) {
			if (p.join) continue;
			const r = addRoom(p.type, L, { target: p.target });
			for (const c of p.cells) give(r, c);
		}
		for (const p of best.pieces) if (p.join) for (const c of p.join.cells) give(p.join.to, c);
	}
	function zonesOf(mask) {
		const out = [], h = new Int16Array(nx);
		for (;;) {
			let best = null;
			h.fill(0);
			for (let j = 0; j < nz; j++) {
				for (let i = 0; i < nx; i++) h[i] = mask[i + j * nx] ? h[i] + 1 : 0;
				for (let i = 0; i < nx; i++) {
					let m = 1e9;
					for (let i2 = i; i2 < nx && h[i2]; i2++) {
						m = Math.min(m, h[i2]);
						const w = X[i2 + 1] - X[i], d = Z[j + 1] - Z[j - m + 1], lo = Math.min(w, d);
						const s = w * d * (lo >= 2.4 ? 1 : lo >= 1.3 ? 0.45 : 0.1);
						if (!best || s > best.s) best = { s, i0: i, i1: i2, j0: j - m + 1, j1: j };
					}
				}
			}
			if (!best) break;
			for (let j = best.j0; j <= best.j1; j++) for (let i = best.i0; i <= best.i1; i++) mask[i + j * nx] = 0;
			out.push(zone(best));
		}
		return out;
	}
	// thin strips left along the zones: each zone whose whole side a strip runs along takes
	// its stretch of it, staying square; what no zone can take is left over
	function absorb(good, scraps) {
		let list = scraps.map((q) => zone(q));
		for (let changed = true; changed;) {
			changed = false;
			for (const s of [...list]) for (const q of good) {
				let hit = null;
				if (s.i1 === q.i0 - 1 && s.j0 <= q.j0 && s.j1 >= q.j1) hit = ['i0', s.i0, 'j'];
				else if (s.i0 === q.i1 + 1 && s.j0 <= q.j0 && s.j1 >= q.j1) hit = ['i1', s.i1, 'j'];
				else if (s.j1 === q.j0 - 1 && s.i0 <= q.i0 && s.i1 >= q.i1) hit = ['j0', s.j0, 'i'];
				else if (s.j0 === q.j1 + 1 && s.i0 <= q.i0 && s.i1 >= q.i1) hit = ['j1', s.j1, 'i'];
				if (!hit) {
					// a strip along part of a zone's side: the zone is cut where the strip ends
					// (when both parts stay wide enough to use), and the part along it takes it
					const alongJ = (s.i1 === q.i0 - 1 || s.i0 === q.i1 + 1) && s.j0 <= q.j1 && s.j1 >= q.j0, alongI = (s.j1 === q.j0 - 1 || s.j0 === q.j1 + 1) && s.i0 <= q.i1 && s.i1 >= q.i0;
					if (!alongJ && !alongI) continue;
					const [a0, a1, b0, b1, lines] = alongJ ? [q.j0, q.j1, s.j0, s.j1, Z] : [q.i0, q.i1, s.i0, s.i1, X];
					const cuts = [];
					if (b0 > a0) cuts.push(b0);
					if (b1 < a1) cuts.push(b1 + 1);
					const edges = [a0, ...cuts, a1 + 1];
					if (!cuts.length || edges.some((e, k) => k && lines[e] - lines[edges[k - 1]] < 2.45)) continue;
					const parts = edges.slice(1).map((e, k) => zone(alongJ ? { ...q, j0: edges[k], j1: e - 1 } : { ...q, i0: edges[k], i1: e - 1 }));
					good.splice(good.indexOf(q), 1, ...parts);
					changed = true;
					break;
				}
				Object.assign(q, zone({ ...q, [hit[0]]: hit[1] }));
				const rest = hit[2] === 'j' ? [{ ...s, j1: q.j0 - 1 }, { ...s, j0: q.j1 + 1 }] : [{ ...s, i1: q.i0 - 1 }, { ...s, i0: q.i1 + 1 }];
				list.splice(list.indexOf(s), 1, ...rest.filter((r) => r.i1 >= r.i0 && r.j1 >= r.j0).map((r) => zone(r)));
				changed = true;
				break;
			}
		}
		return list;
	}
	function zone(q) { return { i0: q.i0, i1: q.i1, j0: q.j0, j1: q.j1, x0: X[q.i0], x1: X[q.i1 + 1], z0: Z[q.j0], z1: Z[q.j1 + 1], w: X[q.i1 + 1] - X[q.i0], d: Z[q.j1 + 1] - Z[q.j0] }; }
	function cellsOf(q) { const out = []; for (let j = q.j0; j <= q.j1; j++) for (let i = q.i0; i <= q.i1; i++) out.push(i + j * nx); return out; }
	// the side of a zone that lies along a hall (the longest such), or null
	function accessOf(L, q, hubs) {
		let best = null;
		const side = (name, cells) => { let len = 0; for (const [c, l] of cells) if (c >= 0 && hubs.has(labels[L][c])) len += l; if (len > 0.9 && (!best || len > best.len)) best = { side: name, len }; };
		const col = (i) => { const o = []; for (let j = q.j0; j <= q.j1; j++) o.push([i < 0 || i >= nx ? -1 : i + j * nx, Z[j + 1] - Z[j]]); return o; };
		const row = (j) => { const o = []; for (let i = q.i0; i <= q.i1; i++) o.push([j < 0 || j >= nz ? -1 : i + j * nx, X[i + 1] - X[i]]); return o; };
		side('x0', col(q.i0 - 1)); side('x1', col(q.i1 + 1)); side('z0', row(q.j0 - 1)); side('z1', row(q.j1 + 1));
		return best;
	}
	function attempt(L, prog, pools, jit) {
		const pieces = [], hubCells = [];
		let cost = 0;
		const E = extent(L);
		for (const pool of pools) {
			const zs = zonesOf(pool.mask);
			const good = zs.filter((q) => Math.min(q.w, q.d) >= 1.3 && q.w * q.d >= 2.5);
			const scraps = absorb(good, zs.filter((q) => !good.includes(q)));
			for (const q of good) { q.acc = accessOf(L, q, pool.hubs); q.units = []; }
			// a zone reaching far back from a short stretch of hall: the hall goes on down its
			// side (a spur), so the rooms beyond still open onto it
			for (const q of [...good]) {
				if (!q.acc || !pool.hall) continue;
				const deepX = q.acc.side[0] === 'x', depth = deepX ? q.w : q.d, len = deepX ? q.d : q.w;
				if (depth < 7 || depth < 1.6 * len || len < HALLW + 2.5) continue;
				const lines = deepX ? Z : X, lo = deepX ? q.j0 : q.i0, hi = deepX ? q.j1 : q.i1;
				// the spur along the side nearer the middle of the hall
				const hb = pool.hall.box, hm = deepX ? (hb.z0 + hb.z1) / 2 : (hb.x0 + hb.x1) / 2, atLo = Math.abs(lines[lo] - hm) < Math.abs(lines[hi + 1] - hm);
				let c = atLo ? lo + 1 : hi;
				if (atLo) { while (c < hi && lines[c] - lines[lo] < HALLW - 0.05) c++; } else { while (c > lo + 1 && lines[hi + 1] - lines[c] < HALLW - 0.05) c--; }
				const sw = atLo ? lines[c] - lines[lo] : lines[hi + 1] - lines[c];
				if (sw > HALLW + 0.45 || len - sw < 2.45) continue;
				const [sp, rest] = atLo ? [zone(deepX ? { ...q, j1: c - 1 } : { ...q, i1: c - 1 }), zone(deepX ? { ...q, j0: c } : { ...q, i0: c })] : [zone(deepX ? { ...q, j0: c } : { ...q, i0: c }), zone(deepX ? { ...q, j1: c - 1 } : { ...q, i1: c - 1 })];
				hubCells.push(...cellsOf(sp));
				pieces.push({ join: { to: pool.hall.room, cells: cellsOf(sp) }, cells: [] });
				rest.acc = { side: deepX ? (atLo ? 'z0' : 'z1') : (atLo ? 'x0' : 'x1'), len: depth };
				rest.units = [];
				good.splice(good.indexOf(q), 1, rest);
			}
			const A = good.reduce((s, q) => s + q.w * q.d, 0);
			const list = prog.filter((p) => pool.takes(p[0]));
			const fixed = list.reduce((s, p) => s + (p[3] < 0 ? -p[3] : 0), 0);
			// units: a main bedroom goes with its bath and closet
			const units = [];
			for (const [type, u, v, t] of list) {
				const px = (gSide > 0 ? E.x1 - u * (E.x1 - E.x0) : E.x0 + u * (E.x1 - E.x0)) + (rnd() - 0.5) * jit * (E.x1 - E.x0);
				const pz = E.z1 - v * (E.z1 - E.z0) + (rnd() - 0.5) * jit * (E.z1 - E.z0);
				const room = { type, px, pz, target: t < 0 ? -t : t * Math.max(8, A - fixed), fixed: t < 0 };
				const suite = (type === 'mbath' || type === 'closet') && units.find((q) => q.rooms[0].type === 'master');
				if (suite) { suite.rooms.push(room); suite.target += room.target; } else units.push({ rooms: [room], target: room.target, px, pz, hub: needsHub(type, L, pool) });
			}
			// each to the zone nearest where it wants to be that still has room for it
			units.sort((a, b) => b.target - a.target);
			for (const u of units) {
				let bz = null, bc = 1e9;
				const mn = minOf(u.rooms[0].type);
				for (const q of good) {
					const load = q.units.reduce((s, o) => s + o.target, 0);
					const dx = Math.max(q.x0 - u.px, 0, u.px - q.x1), dz = Math.max(q.z0 - u.pz, 0, u.pz - q.z1);
					const c = Math.hypot(dx, dz) * 0.25 + Math.max(0, load + u.target - q.w * q.d) / Math.max(4, u.target) * 6 + (u.hub && !q.acc ? 6 : 0) + (Math.min(q.w, q.d) < mn - 0.05 ? 30 : 0) + (q.units.length && q.w * q.d < 2 * mn * mn ? 30 : 0);
					if (c < bc) { bc = c; bz = q; }
				}
				if (bz && bc < 30) bz.units.push(u); else cost += 5;
			}
			// a zone left empty takes a room from a crowded neighbour, or one of its own
			for (const q of good) {
				if (q.units.length) continue;
				const from = good.filter((o) => o.units.length > 1).sort((a, b) => Math.hypot(a.x0 + a.w / 2 - q.x0 - q.w / 2, a.z0 + a.d / 2 - q.z0 - q.d / 2) - Math.hypot(b.x0 + b.w / 2 - q.x0 - q.w / 2, b.z0 + b.d / 2 - q.z0 - q.d / 2))[0];
				const mv = from && from.units.filter((u) => Math.min(q.w, q.d) >= minOf(u.rooms[0].type) - 0.05 && (!u.hub || q.acc)).sort((a, b) => Math.abs(a.target - q.w * q.d) - Math.abs(b.target - q.w * q.d))[0];
				if (mv) { from.units.splice(from.units.indexOf(mv), 1); q.units.push(mv); continue; }
				const type = q.w * q.d < 6 || Math.min(q.w, q.d) < 2.45 ? 'closet' : pool.extra || 'office';
				q.units.push({ rooms: [{ type, px: q.x0 + q.w / 2, pz: q.z0 + q.d / 2, target: q.w * q.d }], target: q.w * q.d, px: q.x0 + q.w / 2, pz: q.z0 + q.d / 2, hub: needsHub(type, L, pool) });
			}
			for (const q of good) {
				// the shares: the baths and closets at their size, the rest shared out; a zone
				// with much more floor than it was given takes another room
				const Aq = q.w * q.d, flex = () => q.units.flatMap((u) => u.rooms).filter((r) => !r.fixed);
				const fixedA = () => q.units.flatMap((u) => u.rooms).filter((r) => r.fixed).reduce((s, r) => s + r.target, 0);
				for (let g = 0; g < 6; g++) {
					const fl = flex(), rest = Aq - fixedA(), ft = fl.reduce((s, r) => s + r.target, 0);
					// (a long zone would make long rooms: another room shortens them)
					const long = fl.length && Math.max(q.w, q.d) / fl.length / Math.min(q.w, q.d) > 2.1 && rest / (fl.length + 1) >= 6.5;
					if (!long && (fl.length ? rest / ft < 2 || rest / (fl.length + 1) < 9 : rest < 4.5)) break;
					const type = rest < 7.5 || Math.min(q.w, q.d) < 2.45 ? 'closet' : g && pool.extra2 ? pool.extra2 : pool.extra || 'office', t = fl.length ? rest / (fl.length + 1) : rest;
					const ang = (q.units.length * 2.4) % 6.28, px = q.x0 + q.w * (0.5 + 0.4 * Math.cos(ang)), pz = q.z0 + q.d * (0.5 + 0.4 * Math.sin(ang));
					q.units.push({ rooms: [{ type, px, pz, target: t, fixed: false }], target: t, px, pz, hub: needsHub(type, L, pool) });
				}
				const fl = flex(), ft = fl.reduce((s, r) => s + r.target, 0), room = Aq - fixedA();
				const kf = fl.length ? Math.max(0.3, room) / ft : 1, kx = fl.length || room < 0 ? Math.min(1, Aq / Math.max(1e-3, fixedA())) : Aq / Math.max(1e-3, fixedA());
				for (const u of q.units) { for (const r of u.rooms) r.share = r.target * (r.fixed ? kx : kf); u.share = u.rooms.reduce((s, r) => s + r.share, 0); }
				const out = [];
				cost += cut(q, q.units, q.acc, out);
				for (const p of out) pieces.push({ type: p.room.type, target: p.room.target, cells: cellsOf(p), q: p });
			}
			for (const q of scraps) pieces.push({ scrap: true, q, cells: cellsOf(q) });
		}
		// scraps: a closet where one fits and has a room to open from, else the neighbour they
		// fit best (the one they square off, or share the most wall with)
		const lab = new Int32Array(N).fill(-1);
		pieces.forEach((p, k) => { if (!p.scrap) for (const c of p.cells) lab[c] = k; });
		const owner = (c) => (lab[c] >= 0 ? { piece: pieces[lab[c]] } : labels[L][c] >= 0 && rooms[labels[L][c]].type !== 'garage' ? { room: rooms[labels[L][c]] } : null);
		for (const p of pieces) {
			if (!p.scrap) continue;
			const q = p.q, near = new Map();
			const add = (c, len, whole) => { const o = c >= 0 ? owner(c) : null; if (!o) return; const k = o.piece || o.room; const e = near.get(k) || { o, len: 0, whole: true }; e.len += len; e.whole = e.whole && whole; near.set(k, e); };
			for (let j = q.j0; j <= q.j1; j++) { const l = Z[j + 1] - Z[j]; if (q.i0 > 0) add(q.i0 - 1 + j * nx, l, true); if (q.i1 < nx - 1) add(q.i1 + 1 + j * nx, l, true); }
			for (let i = q.i0; i <= q.i1; i++) { const l = X[i + 1] - X[i]; if (q.j0 > 0) add(i + (q.j0 - 1) * nx, l, true); if (q.j1 < nz - 1) add(i + (q.j1 + 1) * nx, l, true); }
			// (squares it off: the neighbour's side along it is exactly the scrap's)
			const fits = (e) => { const t = e.o.piece?.q; if (!t) return false; return (Math.abs(t.x0 - q.x0) < 1e-6 && Math.abs(t.x1 - q.x1) < 1e-6 && (Math.abs(t.z1 - q.z0) < 1e-6 || Math.abs(t.z0 - q.z1) < 1e-6)) || (Math.abs(t.z0 - q.z0) < 1e-6 && Math.abs(t.z1 - q.z1) < 1e-6 && (Math.abs(t.x1 - q.x0) < 1e-6 || Math.abs(t.x0 - q.x1) < 1e-6)); };
			const list = [...near.values()].filter((e) => !(L === 1 && e.o.room?.type === 'hall'));
			const sq = list.filter(fits).sort((a, b) => b.len - a.len)[0];
			if (sq) { p.merge = sq.o.piece; continue; }
			// (a strip under a metre: no room's, the wall furred out over it)
			if (Math.min(q.w, q.d) < 0.95) { p.scrap = false; p.solid = true; cost += 0.2; continue; }
			if (q.w * q.d >= 1.4 && Math.min(q.w, q.d) >= 1.15 && list.some((e) => e.o.piece && e.o.piece.type !== 'closet')) { p.scrap = false; p.type = 'closet'; p.target = q.w * q.d; continue; }
			const lg = list.sort((a, b) => b.len - a.len)[0];
			if (lg?.o.piece) p.merge = lg.o.piece; else if (lg) p.join = { to: lg.o.room, cells: p.cells };
			cost += 0.5;
		}
		for (const p of pieces) if (p.merge) { p.merge.cells.push(...p.cells); p.cells = []; }
		const kept = pieces.filter((p) => !p.solid && (p.join || (!p.scrap && p.cells.length)));
		for (const p of kept) if (p.join) { p.cells = []; p.type = null; }
		// the score: shapes, sizes, and every room that needs a hall on one
		const lab2 = new Int32Array(N).fill(-1), spur = new Uint8Array(N);
		kept.forEach((p, k) => { for (const c of p.cells) lab2[c] = k; });
		for (const c of hubCells) spur[c] = 1;
		for (const p of kept) {
			if (!p.cells.length) continue;
			const q = p.q, w = q.w, d = q.d, mn = minOf(p.type);
			cost += Math.max(0, Math.max(w, d) / Math.min(w, d) - 2.2) * 1.5 + (Math.min(w, d) < mn - 0.05 ? 4 : 0) + Math.min(2, Math.abs(p.cells.reduce((s, c) => s + area(c), 0) - p.target) / Math.max(3, p.target)) * 0.6;
			if (!needsHub(p.type, L, pools[0])) continue;
			let ok = false;
			for (const c of p.cells) {
				const i = c % nx, j = Math.floor(c / nx);
				for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
					const ii = i + di, jj = j + dj;
					if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
					const n = ii + jj * nx, o = labels[L][n], k = lab2[n];
					if (spur[n] || (o >= 0 && (rooms[o].type === 'hall' || rooms[o].type === 'entry')) || (L === 0 && k >= 0 && k !== lab2[c] && PUBLIC.has(kept[k].type)) || (p.type === 'laundry' && o >= 0 && rooms[o].type === 'garage')) ok = true;
				}
				if (ok) break;
			}
			if (!ok) cost += 3;
		}
		return { cost, pieces: kept };
	}
	// which rooms want a door straight onto a hall or a living room
	function needsHub(type, L) {
		if (type === 'mbath' || type === 'closet') return false;
		return L === 1 || !PUBLIC.has(type);
	}
	// cut a zone among its units: returns the cost of what it could not do
	function cut(q, units, acc, out) {
		if (units.length === 1) return suite(q, units[0], acc, out);
		const tries = acc ? [acc.side[0] === 'z'] : q.w >= q.d ? [true, false] : [false, true];
		let best = null;
		for (const alongX of tries) {
			const lines = alongX ? X : Z, lo = alongX ? q.i0 : q.j0, hi = alongX ? q.i1 : q.j1, span = lines[hi + 1] - lines[lo], depth = alongX ? q.d : q.w;
			const us = [...units].sort((a, b) => (alongX ? a.px - b.px : a.pz - b.pz));
			const tot = us.reduce((s, u) => s + u.share, 0);
			let ta = 0;
			for (let k = 1; k < us.length; k++) {
				ta += us[k - 1].share;
				const A = us.slice(0, k), B = us.slice(k), want = lines[lo] + span * ta / tot;
				for (let c = lo + 1; c <= hi; c++) {
					const la = lines[c] - lines[lo], lb = lines[hi + 1] - lines[c];
					if (la < need(A, depth) - 0.05 || lb < need(B, depth) - 0.05) continue;
					let cost = Math.abs(lines[c] - want) / span * 2 + (alongX === tries[0] ? 0 : 0.15);
					if (A.length === 1) cost += Math.max(0, Math.max(la, depth) / Math.min(la, depth) - 2);
					if (B.length === 1) cost += Math.max(0, Math.max(lb, depth) / Math.min(lb, depth) - 2);
					if (!best || cost < best.cost) best = { cost, alongX, c, A, B };
				}
			}
		}
		if (!best) {
			// no room for them all: the least needed one goes
			const drop = [...units].sort((a, b) => rank(a) - rank(b))[0];
			return 4 + cut(q, units.filter((u) => u !== drop), acc, out);
		}
		const qa = zone(best.alongX ? { ...q, i1: best.c - 1 } : { ...q, j1: best.c - 1 }), qb = zone(best.alongX ? { ...q, i0: best.c } : { ...q, j0: best.c });
		return cut(qa, best.A, acc, out) + cut(qb, best.B, acc, out);
	}
	function need(G, depth) { return G.reduce((s, u) => s + (u.rooms.length > 1 && depth < 4.3 ? u.rooms.reduce((t, r) => t + minOf(r.type), 0) : minOf(u.rooms[0].type)), 0); }
	function rank(u) { const t = u.rooms[0].type; return (RANK[t] ?? 5) + u.target * 0.01; }
	// a main bedroom with its bath and closet: the bedroom on the hall, the others beyond it
	// (or beside it, where the zone is too shallow)
	function suite(q, u, acc, out) {
		const [m, ...rest] = u.rooms;
		if (!rest.length) { out.push({ ...q, room: m }); return 0; }
		const deepX = acc ? acc.side[0] === 'x' : q.w > q.d, depth = deepX ? q.w : q.d, lines = deepX ? X : Z, lo = deepX ? q.i0 : q.j0, hi = deepX ? q.i1 : q.j1;
		const fromHi = acc ? acc.side === 'x1' || acc.side === 'z1' : (deepX ? m.px > q.x0 + q.w / 2 : m.pz > q.z0 + q.d / 2);
		const need2 = Math.max(...rest.map((r) => minOf(r.type)));
		if (depth >= minOf(m.type) + need2 - 0.05) {
			const width = deepX ? q.d : q.w, want = Math.max(minOf(m.type), depth - Math.max(need2, Math.min(rest.reduce((s, r) => s + r.share, 0) / width, depth - minOf(m.type))));
			let bc = null;
			for (let c = lo + 1; c <= hi; c++) {
				const dm = fromHi ? lines[hi + 1] - lines[c] : lines[c] - lines[lo], dr = depth - dm;
				if (dm < minOf(m.type) - 0.05 || dr < need2 - 0.05) continue;
				if (!bc || Math.abs(dm - want) < Math.abs(bc.dm - want)) bc = { c, dm };
			}
			if (bc) {
				const lowPart = zone(deepX ? { ...q, i1: bc.c - 1 } : { ...q, j1: bc.c - 1 }), highPart = zone(deepX ? { ...q, i0: bc.c } : { ...q, j0: bc.c });
				const [mz, rz] = fromHi ? [highPart, lowPart] : [lowPart, highPart];
				out.push({ ...mz, room: m });
				const rs = rest.map((r) => ({ rooms: [r], target: r.target, share: r.share, px: r.px, pz: r.pz }));
				return cut(rz, rs, null, out);
			}
		}
		return cut(q, u.rooms.map((r) => ({ rooms: [r], target: r.target, share: r.share, px: r.px, pz: r.pz })), acc, out);
	}

	// slivers join the neighbour they share most wall with
	const adjRuns = (L) => {
		// runs of boundary between two rooms on this level: key "a|b" -> [{axis, pos, s, e}]
		const out = new Map();
		const add = (a, b, axis, pos, s, e) => {
			const k = a < b ? a + '|' + b : b + '|' + a;
			let l = out.get(k); if (!l) out.set(k, l = []);
			const last = l[l.length - 1];
			if (last && last.axis === axis && Math.abs(last.pos - pos) < 1e-6 && Math.abs(last.e - s) < 1e-6) last.e = e; else l.push({ axis, pos, s, e });
		};
		const lab = labels[L];
		for (let i = 1; i < nx; i++) for (let j = 0; j < nz; j++) { const a = lab[i - 1 + j * nx], b = lab[i + j * nx]; if (a >= 0 && b >= 0 && a !== b) add(a, b, 'z', X[i], Z[j], Z[j + 1]); }
		for (let j = 1; j < nz; j++) for (let i = 0; i < nx; i++) { const a = lab[i + (j - 1) * nx], b = lab[i + j * nx]; if (a >= 0 && b >= 0 && a !== b) add(a, b, 'x', Z[j], X[i], X[i + 1]); }
		return out;
	};
	for (const L of [0, 1]) {
		for (let guard = 0; guard < 20; guard++) {
			const small = rooms.find((r) => r.level === L && r.cells.length && r.area < (r.type === 'closet' ? 0.9 : 1.6) && r.type !== 'garage');
			if (!small) break;
			const adj = adjRuns(L);
			let best = -1, bl = 0;
			for (const [k, runs] of adj) {
				const [a, b] = k.split('|').map(Number);
				if (a !== small.id && b !== small.id) continue;
				const o = a === small.id ? b : a, len = runs.reduce((s, r) => s + r.e - r.s, 0);
				if (rooms[o].type !== 'garage' && len > bl) { bl = len; best = o; }
			}
			for (const c of small.cells) { if (best >= 0) give(rooms[best], c); else labels[L][c] = -1; }
			small.cells = []; small.area = 0;
		}
	}
	for (const r of rooms) {
		if (!r.cells.length) continue;
		let sx = 0, sz = 0;
		for (const c of r.cells) { const a = area(c); sx += cx(c % nx) * a; sz += cz(Math.floor(c / nx)) * a; }
		r.cx = sx / r.area; r.cz = sz / r.area;
	}

	// ---- doors: open plan among the public rooms, a door into each of the others
	const conns = [];   // {a, b, kind: 'open'|'wide'|'door', run, c, w}
	const stairCellSide = (L, x, z) => (L === 0 ? inStairs(x, z, false) : !!stairs && x > stairs.x0 && x < stairs.x1 && z > stairs.zt && z < stairs.zw);
	const stairNear = (L, run, u) => {
		const p1 = run.axis === 'x' ? [u, run.pos + 0.3] : [run.pos + 0.3, u], p2 = run.axis === 'x' ? [u, run.pos - 0.3] : [run.pos - 0.3, u];
		return stairCellSide(L, ...p1) || stairCellSide(L, ...p2);
	};
	for (const L of [0, 1]) {
		const adj = adjRuns(L);
		const lv = rooms.filter((r) => r.level === L && r.cells.length);
		if (!lv.length) continue;
		const reached = new Set();
		const hub = lv.find((r) => r.type === (L === 0 ? 'entry' : 'hall')) || lv.reduce((a, b) => (a.area > b.area ? a : b));
		const runsOf = (a, b) => adj.get(a < b ? a + '|' + b : b + '|' + a) || [];
		// open and wide connections among the public rooms, where they can be cut
		for (const [k, runs] of adj) {
			const [a, b] = k.split('|').map(Number), rel = relation(rooms[a].type, rooms[b].type);
			if (!rel) continue;
			if (rel === 'open') { for (const r of runs) conns.push({ a, b, kind: 'open', run: r, level: L }); continue; }
			// the longest stretch of any of their shared walls that is not beside the stairs
			let best = null;
			for (const run of runs) {
				let lo = null;
				for (let u = run.s + 0.05; u <= run.e + 0.06; u += 0.1) {
					const ok = u < run.e - 0.04 && !stairNear(L, run, u);
					if (ok && lo === null) lo = u;
					if (!ok && lo !== null) { if (!best || u - lo > best.len) best = { run, a0: lo, a1: u, len: u - lo }; lo = null; }
				}
			}
			if (!best || best.len < 1.0) continue;
			const w = Math.max(0.9, Math.min(best.len - 0.3, best.len > 3 ? 2.4 : 1.6));
			conns.push({ a, b, kind: 'wide', run: best.run, c: (best.a0 + best.a1) / 2, w, level: L });
		}
		const spread = () => {
			for (let again = true; again;) {
				again = false;
				for (const cn of conns) {
					if (cn.level !== L) continue;
					if (reached.has(cn.a) !== reached.has(cn.b)) { reached.add(cn.a); reached.add(cn.b); again = true; }
				}
			}
		};
		reached.add(hub.id); spread();
		// then a door for each room left, from the best reached neighbour
		const bad = new Set();
		for (let guard = 0; guard < 80; guard++) {
			let best = null;
			for (const r of lv) {
				if (reached.has(r.id)) continue;
				for (const o of lv) {
					if (!reached.has(o.id)) continue;
					const runs = runsOf(r.id, o.id).filter((q) => q.e - q.s >= 1.05);
					if (!runs.length || bad.has(r.id + '|' + o.id)) continue;
					const sc = doorScore(r.type, o.type);
					if (!best || sc > best.sc) best = { r, o, runs, sc };
				}
			}
			if (!best) break;
			// near a corner of the longest run, clear of the stairs
			const run = best.runs.reduce((m, q) => (q.e - q.s > m.e - m.s ? q : m));
			const w = best.r.type === 'garage' || best.o.type === 'garage' ? 0.9 : 0.8, len = run.e - run.s;
			const tries = len > 2.2 ? [run.s + 0.25 + w / 2, run.e - 0.25 - w / 2, (run.s + run.e) / 2] : [(run.s + run.e) / 2];
			if (rnd() < 0.5 && tries.length > 1) [tries[0], tries[1]] = [tries[1], tries[0]];
			let c = null;
			for (const t of tries) {
				const clear = [-w / 2, 0, w / 2].every((o) => !stairNear(L, run, t + o));
				if (clear) { c = t; break; }
			}
			if (c === null) { bad.add(best.r.id + '|' + best.o.id); continue; }   // (never a door onto the stairs: try the next best)
			// the door swings into the room it serves, hinged at the end nearer the corner
			const sideR = sideOf(best.r, run);
			conns.push({ a: best.r.id, b: best.o.id, kind: 'door', run, c, w, level: L, swing: sideR, hinge: c - run.s < run.e - c ? -1 : 1 });
			reached.add(best.r.id); spread();
		}
	}
	// which side of a boundary run a room lies on (+1: the larger coordinate)
	function sideOf(room, run) {
		const lab = labels[room.level], u = (run.s + run.e) / 2;
		const p = run.axis === 'x' ? cellAt(u, run.pos + 0.05) : cellAt(run.pos + 0.05, u);
		return p >= 0 && lab[p] === room.id ? 1 : -1;
	}
	function cellAt(x, z) {
		if (x < X[0] || x > X[nx] || z < Z[0] || z > Z[nz]) return -1;
		let i = 0, j = 0;
		while (i < nx - 1 && X[i + 1] <= x) i++;
		while (j < nz - 1 && Z[j + 1] <= z) j++;
		return i + j * nx;
	}

	// ---- walls: every boundary between a room and the outside or another room
	const walls = [];
	const connAt = new Map();
	for (const cn of conns) {
		const k = cn.level + ':' + cn.run.axis + ':' + cn.run.pos.toFixed(3) + ':' + cn.run.s.toFixed(3);
		let l = connAt.get(k); if (!l) connAt.set(k, l = []); l.push(cn);
	}
	const topOf = (c) => rects[occ[c]].top;
	for (const L of [0, 1]) {
		const lab = labels[L];
		const occL = (c) => c >= 0 && onLevel(c, L);
		const sig = (a, b) => {
			const A = occL(a), B = occL(b);
			if (!A && !B) return null;
			if (A && B) {
				const ra = lab[a], rb = lab[b];
				if (ra === rb || (ra < 0 && rb < 0)) return null;
				// (round a strip too thin to be any room's: the wall furred out over it, solid)
				if (ra < 0 || rb < 0) { const c = ra < 0 ? b : a; return { kind: 'ext', room: lab[c], inSide: ra < 0 ? 1 : -1, yb: L ? HT.floor1 : null, yt: L ? topOf(c) : rects[occ[c]].st === 2 ? HT.floor1 : topOf(c), blocked: true }; }
				return { kind: 'part', ra, rb, yb: L ? HT.floor1 : 0, yt: L ? HT.ceil1 : HT.ceil0 };
			}
			const c = A ? a : b, other = A ? b : a;
			const inSide = A ? -1 : 1;
			if (L === 0) return { kind: 'ext', room: lab[c], inSide, yb: null, yt: rects[occ[c]].st === 2 ? HT.floor1 : topOf(c) };
			// upstairs: the outside, or the roof of a lower wing
			return { kind: 'ext', room: lab[c], inSide, yb: HT.floor1, yt: topOf(c), blocked: other >= 0 && occ[other] >= 0 };
		};
		const same = (p, q) => p && q && p.kind === q.kind && p.ra === q.ra && p.rb === q.rb && p.room === q.room && p.inSide === q.inSide && p.yt === q.yt && !!p.blocked === !!q.blocked;
		const scan = (axis, lines, along, cellPair) => {
			for (let l = 0; l < lines.length; l++) {
				let cur = null;
				for (let k = 0; k < along.length - 1; k++) {
					const [a, b] = cellPair(l, k);
					const s = sig(a, b);
					if (cur && same(cur, s) && Math.abs(cur.e - along[k]) < 1e-6) { cur.e = along[k + 1]; continue; }
					if (cur) walls.push(cur);
					cur = s ? { ...s, axis, pos: lines[l], s: along[k], e: along[k + 1], level: L, open: [] } : null;
				}
				if (cur) walls.push(cur);
			}
		};
		// walls along z (at x = X[i]) and along x (at z = Z[j])
		scan('z', X, Z, (i, j) => [i > 0 ? i - 1 + j * nx : -1, i < nx ? i + j * nx : -1]);
		scan('x', Z, X, (j, i) => [j > 0 ? i + (j - 1) * nx : -1, j < nz ? i + j * nx : -1]);
	}
	// cut the partitions where the rooms join
	const rest = [];
	for (const w of walls) {
		if (w.kind !== 'part') { rest.push(w); continue; }
		const cs = conns.filter((cn) => cn.level === w.level && cn.run.axis === w.axis && Math.abs(cn.run.pos - w.pos) < 1e-6 && ((cn.a === w.ra && cn.b === w.rb) || (cn.a === w.rb && cn.b === w.ra)) && cn.run.s < w.e - 1e-6 && cn.run.e > w.s + 1e-6);
		if (cs.some((cn) => cn.kind === 'open')) continue;
		for (const cn of cs) {
			if (cn.c - cn.w / 2 < w.s - 1e-6 || cn.c + cn.w / 2 > w.e + 1e-6) continue;
			const y0 = w.level ? HT.floor1 : 0;
			w.open.push({ s0: cn.c - cn.w / 2, s1: cn.c + cn.w / 2, y0, y1: y0 + (cn.kind === 'wide' ? 2.2 : HT.door), type: cn.kind, conn: cn });
			cn.wall = w;
		}
		rest.push(w);
	}
	walls.length = 0; walls.push(...rest);

	// the outside openings: front door, garage doors, windows, a slider to the back yard
	const roomOf = (id) => rooms[id];
	const frontWall = walls.find((w) => w.kind === 'ext' && w.level === 0 && w.axis === 'x' && Math.abs(w.pos - door.z) < 1e-3 && w.inSide < 0 && w.s < door.x - 0.4 && w.e > door.x + 0.4);
	if (frontWall) { frontWall.open.push({ s0: door.x - door.w / 2, s1: door.x + door.w / 2, y0: 0, y1: 2.1, type: 'front' }); door.wall = frontWall; }
	if (garage) {
		for (const w of walls) {
			if (w.kind !== 'ext' || w.level !== 0 || w.axis !== 'x' || Math.abs(w.pos - garage.front) > 1e-3 || w.inSide > 0) continue;
			for (const d of garage.doors) if (d.x0 > w.s - 0.05 && d.x1 < w.e + 0.05) { w.open.push({ s0: d.x0, s1: d.x1, y0: 0, y1: d.h, type: 'garage' }); d.wall = w; }
		}
	}
	const WIN = { living: [1.8, 0.55, 2.2, 2], family: [1.5, 0.9, 2.15, 2], dining: [1.5, 0.75, 2.15, 1], kitchen: [1.3, 1.05, 2.15, 1], master: [1.6, 0.9, 2.15, 2], bed: [1.4, 0.9, 2.15, 1],
		bath: [0.8, 1.35, 2.1, 1], mbath: [1.0, 1.3, 2.1, 1], powder: [0.6, 1.4, 2.05, 1], laundry: [0.7, 1.2, 2.05, 1], hall: [1.0, 0.9, 2.15, 1], entry: [0.6, 0.9, 2.1, 1], closet: null, garage: null };
	let slider = false;
	for (const w of walls) {
		if (w.kind !== 'ext' || w.blocked) continue;
		const room = roomOf(w.room);
		if (!room) continue;
		// the family room opens onto the back yard
		const y0 = w.level ? HT.floor1 : 0;
		const L = w.e - w.s;
		if (!slider && room.type === 'family' && w.axis === 'x' && w.inSide > 0 && L >= 3.4) {
			const c = (w.s + w.e) / 2;
			w.open.push({ s0: c - 1.2, s1: c + 1.2, y0, y1: y0 + 2.1, type: 'slider' });
			slider = true;
			continue;
		}
		const spec = WIN[room.type];
		if (!spec) continue;
		const [ww, sill, head, max] = spec;
		const busy = w.open.map((o) => [o.s0 - 0.35, o.s1 + 0.35]);
		const m = 0.45, span = L - 2 * m;
		if (span < 0.6) continue;
		let n = Math.min(max, Math.max(1, Math.floor((span + 0.9) / (ww + 0.9)))), wd = Math.min(ww, span);
		if (L < 1.4 && rnd() < 0.5) continue;
		for (let k = 0; k < n; k++) {
			const c = w.s + m + span * (k + 0.5) / n;
			if (busy.some(([a, b]) => c + wd / 2 > a && c - wd / 2 < b)) continue;
			w.open.push({ s0: c - wd / 2, s1: c + wd / 2, y0: y0 + sill, y1: y0 + head, type: 'window', room: room.type, frosted: room.type.includes('bath') || room.type === 'powder' });
		}
	}

	const plan = { M, ca, sa, rects, X, Z, nx, nz, occ, labels, rooms, walls, conns, door, garage, stairs, up, gSide, cellAt, onLevel, rnd, seed: houseSeed(M) };
	plan.items = furnish(plan);
	return plan;
}

// ---------------------------------------------------------------------------------
// furniture: each room's things against its walls, clear of its doors and windows

// the inside face of each wall of a room, as sides: {axis, pos (the face), s, e, n (into the room), wall}
function sidesOf(plan, room) {
	const out = [];
	for (const w of plan.walls) {
		if (w.level !== room.level) continue;
		let n = 0;
		if (w.kind === 'ext' && w.room === room.id) n = w.inSide;
		else if (w.kind === 'part' && (w.ra === room.id || w.rb === room.id)) n = w.rb === room.id ? 1 : -1;
		if (!n) continue;
		const t = w.kind === 'ext' ? TW.ext : TW.part / 2;
		out.push({ axis: w.axis, pos: w.pos + n * t, s: w.s, e: w.e, n, wall: w, ext: w.kind === 'ext' });
	}
	return out;
}

function furnish(plan) {
	const { rooms, rnd, X, Z, nx, labels, stairs, cellAt } = plan;
	const items = [];
	for (const room of rooms) {
		if (!room.cells.length) continue;
		const y0 = room.level ? HT.floor1 : 0;
		const sides = sidesOf(plan, room);
		const placed = [];   // [x0, z0, x1, z1]
		const inRoom = (x, z) => { const c = cellAt(x, z); return c >= 0 && labels[room.level][c] === room.id; };
		const hit = (b) => placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
		const inside = (b, pad = 0.12) => {
			for (let x = b[0] + pad; x <= b[2] - pad + 1e-6; x += Math.max(0.1, (b[2] - b[0] - 2 * pad) / 4)) for (let z = b[1] + pad; z <= b[3] - pad + 1e-6; z += Math.max(0.1, (b[3] - b[1] - 2 * pad) / 4)) if (!inRoom(x, z)) return false;
			return true;
		};
		// keep the doorways and their swings, the stairs and the way up them clear
		for (const w of plan.walls) {
			if (w.level !== room.level) continue;
			for (const o of w.open) {
				if (o.type === 'window') continue;
				const d = o.type === 'garage' ? 3.0 : o.type === 'wide' ? 0.9 : 1.05;
				const a = o.s0 - 0.1, b = o.s1 + 0.1;
				placed.push(w.axis === 'x' ? [a, w.pos - d, b, w.pos + d] : [w.pos - d, a, w.pos + d, b]);
			}
		}
		if (stairs) {
			if (room.level === 0) placed.push([stairs.x0 - 0.05, stairs.zt - 0.05, stairs.x1 + 0.05, stairs.zb + 1.0]);
			else placed.push([stairs.x0 - 0.05, stairs.zl - 0.9, stairs.x1 + 0.05, stairs.zb + 0.05]);
		}
		// against a wall: w wide, d deep, h high; returns the item placed (x, z at its
		// centre, rot: quarter turns, its front facing into the room)
		const against = (type, w, d, h, opt = {}) => {
			const cands = [];
			for (const sd of sides) {
				if (opt.side && !opt.side(sd)) continue;
				const len = sd.e - sd.s;
				if (len < w + 0.1) continue;
				// windows only stop what stands higher than their sill
				const block = sd.wall.open.filter((o) => o.type !== 'window' || h > o.y0 - y0 - 0.05 || opt.noWindow).map((o) => [o.s0 - 0.08, o.s1 + 0.08]);
				const steps = Math.max(1, Math.floor((len - w - 0.3) / 0.2));
				for (let k = 0; k <= steps; k++) {
					const t = k / steps;
					const c = sd.s + 0.18 + w / 2 + t * Math.max(0, len - w - 0.36);
					if (block.some(([a, b]) => c + w / 2 > a && c - w / 2 < b)) continue;
					const f0 = sd.pos, f1 = sd.pos + sd.n * d;
					const box = sd.axis === 'x' ? [c - w / 2, Math.min(f0, f1), c + w / 2, Math.max(f0, f1)] : [Math.min(f0, f1), c - w / 2, Math.max(f0, f1), c + w / 2];
					if (!inside(box, 0.05) || hit(box)) continue;
					// the room in front of it
					const cl = opt.clear ?? 0.6, g0 = sd.pos + sd.n * d, g1 = sd.pos + sd.n * (d + cl);
					const front = sd.axis === 'x' ? [c - w / 2, Math.min(g0, g1), c + w / 2, Math.max(g0, g1)] : [Math.min(g0, g1), c - w / 2, Math.max(g0, g1), c + w / 2];
					if (cl > 0 && (!inside(front, 0.02) || hit(front))) continue;
					let score = opt.score ? opt.score(sd, c, t) : 0;
					score += opt.centre ? -Math.abs(t - 0.5) * 2 : 0;
					score += opt.corner ? Math.abs(t - 0.5) * 2 : 0;
					score += opt.long ? len * 0.3 : 0;
					score += rnd() * 0.3;
					cands.push({ score, sd, c, box });
				}
			}
			if (!cands.length) return null;
			cands.sort((a, b) => b.score - a.score);
			const { sd, c, box } = cands[0];
			placed.push(box);
			// rot: the item's front (+z in its own frame) faces the room: n along z or x
			const rot = sd.axis === 'x' ? (sd.n > 0 ? 0 : 2) : (sd.n > 0 ? 1 : 3);
			const it = { type, room: room.id, level: room.level, y: y0, x: (box[0] + box[2]) / 2, z: (box[1] + box[3]) / 2, rot, w, d, h, side: sd, c, box, v: rnd() };
			items.push(it);
			return it;
		};
		// free standing, centred at x, z
		const standing = (type, x, z, w, d, h, rot = 0, pad = 0) => {
			const hw = rot % 2 ? d / 2 : w / 2, hd = rot % 2 ? w / 2 : d / 2;
			const box = [x - hw - pad, z - hd - pad, x + hw + pad, z + hd + pad];
			if (!inside(box, 0.02) || hit(box)) return null;
			placed.push(box);
			const it = { type, room: room.id, level: room.level, y: y0, x, z, rot, w, d, h, box, v: rnd() };
			items.push(it);
			return it;
		};
		// in front of an item against a wall, gap metres out
		const inFront = (base, type, w, d, h, gap) => {
			const sd = base.side, off = base.d + gap + d / 2;
			const along = base.c, out = sd.pos + sd.n * off;
			const x = sd.axis === 'x' ? along : out, z = sd.axis === 'x' ? out : along;
			return standing(type, x, z, w, d, h, base.rot);
		};
		const bb = (() => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const k of room.cells) { const i = k % nx, j = Math.floor(k / nx); a = Math.min(a, X[i]); c = Math.max(c, X[i + 1]); b = Math.min(b, Z[j]); d = Math.max(d, Z[j + 1]); } return [a, b, c, d]; })();
		const bw = bb[2] - bb[0], bd = bb[3] - bb[1];
		const t = room.type;
		const light = (kind = 'flush') => items.push({ type: 'ceilingLight', kind, room: room.id, level: room.level, y: y0, x: room.cx, z: room.cz, rot: 0, w: 0.35, d: 0.35, h: 0, v: rnd() });
		const art = (n) => { for (let k = 0; k < n; k++) against('art', 0.5 + rnd() * 0.5, 0.03, 0.01, { clear: 0, side: (s) => !s.ext || rnd() < 0.3 }); };
		if (t === 'living') {
			const sofa = against('sofa', Math.min(2.2, bw - 0.8, bd - 0.8) > 1.6 ? 2.1 : 1.6, 0.92, 0.85, { long: true, clear: 1.3, noWindow: false });
			if (sofa) {
				inFront(sofa, 'rug', Math.min(2.4, sofa.w + 0.4), 1.7, 0.01, -0.35);
				inFront(sofa, 'coffeeTable', 1.1, 0.6, 0.42, 0.45);
			}
			against('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 });
			against('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 });
			against('bookcase', 0.9, 0.34, 1.9, { clear: 0.7 });
			against('floorLamp', 0.35, 0.35, 1.6, { corner: true, clear: 0 });
			against('plant', 0.45, 0.45, 1.2, { corner: true, clear: 0 });
			art(2); light();
		} else if (t === 'family') {
			const tv = against('tvConsole', 1.7, 0.45, 0.55, { long: true, clear: 2.0, score: (s) => (s.ext ? -1 : 1) });
			if (tv) {
				const s = inFront(tv, 'sofa', Math.min(2.4, Math.max(1.6, bw - 1.2)), 0.95, 0.85, 1.9);
				if (s) { s.rot = (tv.rot + 2) % 4; inFront(tv, 'rug', 2.2, 1.6, 0.01, 0.35); inFront(tv, 'coffeeTable', 1.0, 0.55, 0.42, 0.95); }
				else against('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.1 });
			} else against('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.1 });
			against('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 });
			against('sideTable', 0.5, 0.5, 0.55, { corner: true, clear: 0 });
			against('plant', 0.45, 0.45, 1.3, { corner: true, clear: 0 });
			against('floorLamp', 0.35, 0.35, 1.6, { corner: true, clear: 0 });
			art(1); light('fan');
		} else if (t === 'dining') {
			const tw = Math.min(1.9, bw - 1.9, bd - 1.9 + 0.9), td = Math.min(1.0, Math.min(bw, bd) - 1.9);
			if (tw > 0.9 && td > 0.7) {
				const rot = bw >= bd ? 0 : 1, tbl = standing('diningTable', room.cx, room.cz, tw, td, 0.76, rot);
				if (tbl) tbl.chairs = Math.max(2, Math.min(6, Math.floor(tw / 0.6) * 2));
			}
			against('sideboard', 1.5, 0.45, 0.85, { long: true, clear: 0.5 });
			art(2); light('chandelier');
		} else if (t === 'kitchen') {
			// counters round the walls, the sink under a window, the range, the fridge at an end
			const runs = [];
			const sorted = sides.filter((s) => !s.wall.open.some((o) => o.type === 'wide' && (o.s1 - o.s0) > (s.e - s.s) * 0.7)).sort((a, b) => (b.e - b.s) - (a.e - a.s));
			for (const sd of sorted.slice(0, 3)) {
				const blocks = sd.wall.open.filter((o) => o.type !== 'window').map((o) => [o.s0 - 0.1, o.s1 + 0.1]).sort((a, b) => a[0] - b[0]);
				let s0 = sd.s + 0.17;
				for (const [a, b] of [...blocks, [sd.e - 0.17, 1e9]]) {
					const len = Math.min(a, sd.e - 0.17) - s0;
					if (len >= 1.2) runs.push({ sd, s: s0, e: s0 + len });
					s0 = Math.max(s0, b);
				}
				if (runs.length >= 2) break;
			}
			let fridge = false, range = false, sink = false;
			for (const r of runs) {
				let s = r.s, e = r.e;
				if (!fridge && e - s > 2.4) {
					const fr = { sd: r.sd, s: e - 0.92, e };
					const box = boxOn(fr.sd, fr.s, fr.e, 0.75);
					if (!hit(box) && inside(box, 0.05)) { placed.push(box); items.push({ type: 'fridge', room: room.id, level: room.level, y: y0, ...centreOn(fr.sd, fr.s, fr.e, 0.75), w: 0.9, d: 0.75, h: 1.8, v: rnd(), side: r.sd }); fridge = true; e -= 0.95; }
				}
				const box = boxOn(r.sd, s, e, 0.63);
				if (hit(box) || !inside(box, 0.05)) continue;
				placed.push(box);
				const win = r.sd.wall.open.find((o) => o.type === 'window' && o.s0 > s && o.s1 < e);
				const it = { type: 'counter', room: room.id, level: room.level, y: y0, ...centreOn(r.sd, s, e, 0.63), w: e - s, d: 0.63, h: 0.92, v: rnd(), side: r.sd, s, e, uppers: !win && !r.sd.ext ? 1 : win ? 0 : 0.6 };
				if (!sink) { it.sink = win ? (win.s0 + win.s1) / 2 : s + (e - s) * 0.35; sink = true; }
				if (!range && e - s > 1.9) { it.range = it.sink && Math.abs(it.sink - (s + (e - s) * 0.75)) > 1.0 ? s + (e - s) * 0.75 : it.sink ? (it.sink > (s + e) / 2 ? s + 0.5 : e - 0.5) : (s + e) / 2; range = true; }
				it.win = win ? [win.s0, win.s1] : null;
				items.push(it);
			}
			// an island if there is room in the middle
			if (bw > 3.6 && bd > 3.6) {
				const iw = Math.min(2.0, Math.max(bw, bd) - 2.8), rot = bw >= bd ? 0 : 1;
				const isl = iw > 1.1 ? standing('island', room.cx, room.cz, iw, 0.95, 0.92, rot, 0.85) : null;
				if (isl) { placed.pop(); placed.push(isl.box.map((v, i) => v + (i < 2 ? 0.85 : -0.85))); isl.stools = Math.floor(iw / 0.55); }
			} else if (!room.nearDining) {
				const tb = standing('diningTable', room.cx, room.cz, 1.1, 0.8, 0.76, bw >= bd ? 0 : 1, 0.55);
				if (tb) { tb.chairs = 4; placed.pop(); placed.push(tb.box.map((v, i) => v + (i < 2 ? 0.55 : -0.55))); }
			}
			light('pendants');
		} else if (t === 'master' || t === 'bed') {
			const kid = t === 'bed' && rnd() < 0.55;
			const bwid = t === 'master' ? (bw > 4 && bd > 4 ? 1.95 : 1.6) : kid ? 1.0 : 1.4, blen = t === 'master' ? 2.1 : kid ? 1.95 : 2.05;
			const bed = against('bed', bwid, blen, 0.6, { clear: 0.55, centre: true, score: (s) => (s.ext ? 0 : 0.6) + (s.e - s.s) * 0.1 });
			if (bed) {
				for (const sgn of [-1, 1]) {
					const c = bed.c + sgn * (bwid / 2 + 0.3), sd = bed.side;
					const box = boxOn(sd, c - 0.24, c + 0.24, 0.42);
					if (!hit(box) && inside(box, 0.05)) { placed.push(box); items.push({ type: 'nightstand', room: room.id, level: room.level, y: y0, ...centreOn(sd, c - 0.24, c + 0.24, 0.42), w: 0.48, d: 0.42, h: 0.6, v: rnd(), side: sd }); }
				}
				inFront(bed, 'rug', bwid + 0.8, 1.2, 0.01, -1.2);
			}
			against('closet', Math.min(2.4, Math.max(1.5, (t === 'master' ? 0.28 : 0.2) * (bw + bd))), 0.64, 2.3, { clear: 0.7, score: (s) => (s.ext ? -1 : 1) });
			against('dresser', t === 'master' ? 1.5 : 1.0, 0.5, t === 'master' ? 0.8 : 1.1, { clear: 0.7, noWindow: true });
			if (kid) against('desk', 1.1, 0.55, 0.75, { clear: 0.8, score: (s) => (s.ext ? 1 : 0) });
			else if (t === 'master') against('armchair', 0.8, 0.8, 0.85, { corner: true, clear: 0.6 });
			if (kid) against('toys', 0.6, 0.4, 0.4, { corner: true, clear: 0 });
			against('laundryBasket', 0.45, 0.35, 0.5, { corner: true, clear: 0 });
			art(t === 'master' ? 2 : 1); light(t === 'master' ? 'fan' : 'flush');
		} else if (t === 'bath' || t === 'mbath') {
			const tub = against(t === 'mbath' && bw > 2.4 && bd > 2.4 ? 'shower' : 'tub', t === 'mbath' ? 1.2 : 1.52, t === 'mbath' ? 1.0 : 0.78, 1.95, { clear: 0.5, corner: true, score: (s) => -(s.e - s.s) * 0.2 });
			against('vanity', t === 'mbath' ? Math.min(1.8, bw - 0.6, 1.8) : 1.0, 0.56, 0.86, { clear: 0.6, noWindow: true, long: true });
			against('toilet', 0.45, 0.72, 0.78, { clear: 0.5 });
			if (t === 'mbath' && tub?.type === 'shower') against('tub', 1.52, 0.8, 0.6, { clear: 0.5 });
			against('bathMat', 0.8, 0.5, 0.01, { clear: 0 });
			light('bar');
		} else if (t === 'powder') {
			against('pedestalSink', 0.5, 0.45, 0.85, { clear: 0.5, noWindow: true });
			against('toilet', 0.45, 0.72, 0.78, { clear: 0.5 });
			light('bar');
		} else if (t === 'laundry') {
			against('washer', 0.68, 0.7, 0.95, { clear: 0.7 });
			against('dryer', 0.68, 0.7, 0.95, { clear: 0.7 });
			against('shelf', 0.9, 0.35, 1.8, { clear: 0.6 });
			light();
		} else if (t === 'entry') {
			against('console', 1.0, 0.36, 0.8, { clear: 0.8, noWindow: true });
			if (bw > 1.6 && bd > 1.6) against('rug', 1.2, 0.8, 0.01, { clear: 0, score: (s) => (s.ext && s.axis === 'x' ? 2 : 0) });
			against('plant', 0.4, 0.4, 1.1, { corner: true, clear: 0 });
			art(1); light('pendant');
		} else if (t === 'hall') {
			art(2); light();
		} else if (t === 'garage') {
			against('shelves', Math.min(2.4, bw - 0.6), 0.55, 1.95, { clear: 0.8, score: (s) => (s.axis === 'x' && s.n > 0 ? 2 : 0) });
			against('waterHeater', 0.6, 0.6, 1.55, { corner: true, clear: 0 });
			against('bins', 1.4, 0.7, 1.1, { clear: 0.5 });
			against('workbench', 1.6, 0.65, 0.92, { clear: 0.8 });
			against('bikes', 1.7, 0.5, 1.0, { clear: 0.5 });
			if (bw > 5.2 && bd > 5.4 && rnd() < 0.6) items.push({ type: 'car', room: room.id, level: 0, y: y0, x: room.cx + (bw > 5.8 ? (rnd() < 0.5 ? -1.4 : 1.4) : 0), z: room.cz + 0.3, rot: 0, w: 1.85, d: 4.6, h: 1.45, v: rnd() });
			light('tube');
		} else if (t === 'closet') {
			against('shelf', Math.min(1.2, Math.max(bw, bd) - 0.4), 0.35, 1.8, { clear: 0.3 });
		}
	}
	return items;
}
function boxOn(sd, s, e, d) {
	const f0 = sd.pos, f1 = sd.pos + sd.n * d;
	return sd.axis === 'x' ? [s, Math.min(f0, f1), e, Math.max(f0, f1)] : [Math.min(f0, f1), s, Math.max(f0, f1), e];
}
function centreOn(sd, s, e, d) {
	const b = boxOn(sd, s, e, d);
	return { x: (b[0] + b[2]) / 2, z: (b[1] + b[3]) / 2, rot: sd.axis === 'x' ? (sd.n > 0 ? 0 : 2) : (sd.n > 0 ? 1 : 3), box: b, c: (s + e) / 2 };
}

// one building's blocks lie one after another in the baked data, turned the same way and
// touching: gather them (b.grp, shared by all of a house's blocks)
export function groupBoxes(boxes) {
	let cur = null;
	const touch = (c, b) => {
		const ca = Math.cos(c.a), sa = Math.sin(c.a), dx = b.x - c.x, dz = b.z - c.z;
		return Math.abs(ca * dx + sa * dz) <= (c.w + b.w) / 2 + 0.35 && Math.abs(-sa * dx + ca * dz) <= (c.d + b.d) / 2 + 0.35;
	};
	for (const b of boxes) {
		if (!isHome(b)) {
			cur = null;
			// a shop, café, restaurant or office block of a walkable size: its own group, so it
			// can be built inside when you come near (commercial.js)
			if ((b.kind === 5 || b.kind === 6) && b.w * b.d > 60 && b.w * b.d < 6000 && Math.min(b.w, b.d) > 6) { b.grp = [b]; b.grp.biz = true; }
			continue;
		}
		if (cur && Math.abs(b.a - cur[0].a) < 2e-3 && cur.length < 12 && cur.some((c) => touch(c, b))) cur.push(b);
		else cur = [b];
		b.grp = cur;
	}
}
