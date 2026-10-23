// Filling the city's blocks with buildings, moved out of bay/city.js's createCity: the street
// grids round a point, then each block's lots, kinds and heights.
// What it uses from city.js's createCity comes from cc: what is set up before it can run, once at
// the top of each call; the rest as cc.name at each use. A name not yet there needs a getter in
// createCity's cc.

import { BLOCKS, toGrid, fromGrid, STYLE, ERA, sfDistrict, eraFor } from './styles.js';
import { runAll } from '../world/buildslice.js';
import { realCovered } from './realcity.js';
import { inWater } from './watercarve.js';
import { ROOF } from './roofs.js';
import { cityEra } from './decor.js';

export function cityBlocks(cc, cx, cz, R, list, minH = 0) { return runAll(cityBlocksSteps(cc, cx, cz, R, list, minH)); }
// the same a block at a time (a yield before each: the city's rebuild runs it a frame's share at a
// time, city.js rebuildSteps; filling 1200 m of suburb whole was a tenth of a second on a phone)
export function* cityBlocksSteps(cc, cx, cz, R, list, minH = 0) {
	const { bay, CANVAS, CARS, condFor, doorKind, FACE_A, FADED, FENCES, fract, hash, jit, KIND, kit2,
		lot, LX, NZ, OCEAN_X, PAL, pick, real, REMODEL, setCond } = cc;
	// the (angle, style) grids present round here
	const grids = new Map();
	for (let dz = -R; dz <= R; dz += R / 4) for (let dx = -R; dx <= R; dx += R / 4) {
		const u = bay.urbanAt(cx + dx, cz + dz);
		if (u.u > 0.05) grids.set(Math.round(u.a / (Math.PI / 2) * 255) + ':' + u.s, [Math.round(u.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2, u.s]);
	}
	for (const [a, style] of grids.values()) {
		const [BX, BZ, ST] = BLOCKS[style];
		const [gcx, gcz] = toGrid(cx, cz, a, style);
		const i0 = Math.floor((gcx - R) / BX), i1 = Math.floor((gcx + R) / BX), j0 = Math.floor((gcz - R) / BZ), j1 = Math.floor((gcz + R) / BZ);
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			yield;
			const [wx, wz] = fromGrid((i + 0.5) * BX, (j + 0.5) * BZ, a, style);
			if (Math.hypot(wx - cx, wz - cz) > R) continue;
			const U = bay.urbanAt(wx, wz);
			if (U.u < 0.15 || U.s !== style || Math.abs(U.a - a) > 0.01) continue;
			if (real?.inside(wx, wz) || (minH && realCovered(wx, wz))) continue;              // mapped for real (the far skyline's are REAL_TALL)
			const ground = bay.heightAt(wx, wz);
			if (ground < 0.8) continue;
			// how far the block falls corner to corner: the parks, courts and pools want level
			// ground below the hills; a hillside block keeps to houses
			let blo = ground, bhi = ground;
			for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const [x, z] = fromGrid((i + u) * BX, (j + v) * BZ, a, style), h = bay.heightAt(x, z); blo = Math.min(blo, h); bhi = Math.max(bhi, h); }
			const level = (k) => bhi - blo < k && bhi < 300;
			const parkBlock = hash(i * 3 + 7, j * 5 + 1) > 0.975 && U.d < 0.2 && level(2.5);              // a park or a playground
			// not in a lake, a reservoir or a creek (bay/water.js)
			if ([[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].some(([u, v]) => { const [x, z] = fromGrid((i + u) * BX, (j + v) * BZ, a, style); return inWater(x, z); })) continue;
			// not on the ocean beach: low ground with the Pacific a block away is sand and dune
			// (the bay shore keeps its waterfront)
			if (ground < 5 && wx < OCEAN_X && Math.min(bay.heightAt(wx - 120, wz), bay.heightAt(wx + 120, wz), bay.heightAt(wx, wz - 120), bay.heightAt(wx, wz + 120)) < 0.2) continue;
			const X0 = i * BX + ST + 2.5, Z0 = j * BZ + ST + 2.5, IX = BX - ST - 5, IZ = BZ - ST - 5;   // the block inside its pavements
			const r0 = hash(i * 17 + 3, j * 29 + 1);
			if (parkBlock) {
				if (minH > 0) continue;
				lot(list, a, style, X0 + IX / 2, Z0 + IZ / 2, IX * 0.96, IZ * 0.96, 0, KIND.plain, [0.28, 0.42, 0.18], null, 0.9);
				const T = list.trees || (list.trees = []);
				for (let k = 0; k < 10; k++) { const [x, z] = fromGrid(X0 + IX * hash(k, i), Z0 + IZ * hash(j, k), a, style), g = bay.heightAt(x, z); if (g > 0.8) T.push({ x, y: g - 0.3, z, h: 8 + hash(k, k) * 8, cone: hash(k, 3) > 0.8, col: [0.2, 0.3, 0.13] }); }
				continue;
			}
			if (U.d > 0.22) {
				// downtown: towers on bigger lots, some with a setback crown
				const L = 26;
				// the block paved between the towers: plazas and service yards, not lawn
				lot(list, a, style, X0 + IX / 2, Z0 + IZ / 2, IX, IZ, 0.4, KIND.paved, jit([0.47, 0.46, 0.44], hash(i * 5 + 1, j * 7 + 2)), null, 0.9);
				// street trees in grates along the block's pavements
				if (!list.noGrounds) {
					const TT = list.trees || (list.trees = []);
					for (let t = 5; t < IX - 3; t += 10) for (const e of [1.6, IZ - 1.6]) { const [x, z] = fromGrid(X0 + t, Z0 + e, a, style), g = bay.heightAt(x, z), rr = hash(x, z); if (g > 0.8) TT.push({ x, y: g - 0.3, z, h: 7 + rr * 3, cone: false, col: jit(pick(PAL.crown, rr), rr) }); }
				}
				for (let k = 0; k * L < IX; k++) for (const side of [0, 1]) {
					const r = hash(i * 131 + k * 7 + side, j * 17 + k);
					// (steeply down from the core: a few towers at the centre, mid-rise round them)
					let h = 10 + Math.pow(r, 3) * U.d * U.d * U.d * 300 + U.d * U.d * 48;
					if (h < minH) continue;
					const col = jit(pick(PAL.tower, hash(i * 7 + k, j * 3 + side)), r);
					const gx = X0 + k * L + L / 2, gz = side ? Z0 + IZ - L * 0.55 : Z0 + L * 0.55;
					lot(list, a, style, gx, gz, L * 0.9, L * 1.05, h, KIND.tower, col, null);
					if (h > 90 && r > 0.4) lot(list, a, style, gx, gz, L * 0.62, L * 0.7, h + 8 + r * 20, KIND.tower, col, null);
				}
				continue;
			}
			if (minH > 0) continue;
			const trees = list.trees || (list.trees = []);
			// a tree in grid space: height, round or conical, crown colour
			// a pool's deck in grid space on level ground below the hills (a hillside yard is lawn)
			const flatYard = (gx, gz, w, d) => { let lo = 1e9, hi = -1e9; for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [x, z] = fromGrid(gx + u * w / 2, gz + v * d / 2, a, style), h = bay.heightAt(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo < 1.2 && hi < 300; };
			const tree = (gx, gz, h, cone, r) => { const [x, z] = fromGrid(gx, gz, a, style), g = bay.heightAt(x, z); if (g > 0.8) trees.push({ x, y: g - 0.3, z, h, cone, col: cone ? jit([0.13, 0.21, 0.11], r) : jit(pick(PAL.crown, r), r) }); };
			// paved ground: parking lots, yards, plazas
			const pave = (gx, gz, w, d, kind = KIND.paved, col = [0.25, 0.25, 0.26], O = null) => lot(list, a, style, gx, gz, w, d, 0.25 - 1.2 + 1.35, kind, col, null, 0.9, O?.rot ? { rot: O.rot, pw: O.pw } : null);
			// close in, each house gets its porch, walk, shrubs and back fences
			const detail = Math.hypot(wx - cx, wz - cz) < 480;
			// the back fences of a lot from x0 to x1: its left side line (the neighbour has the
			// right), and the back line on one side of the block; at(m) is depth into the block
			// (of all kinds: cedar, weathered grey boards, white vinyl, a block wall, chain link, dark stain)
			const fences = (x0, x1, at, m0, m1, side, r) => {
				if (m1 - m0 < 2) return;
				const F = FENCES[Math.floor(hash(r * 97.1, i + j * 3) * FENCES.length)];
				const fc = jit(F, r), th = F[4];
				lot(list, a, style, x0, at((m0 + m1) / 2), th, m1 - m0, F[3], KIND.plain, fc, null);
				if (!side) lot(list, a, style, (x0 + x1) / 2, at(m1), x1 - x0, th, F[3], KIND.plain, fc, null);
			};
			// foundation shrubs across a house front, leaving the door clear
			const shrubs = (hx, gz, w, dx, r) => {
				for (let n = 0; n < 4; n++) {
					const sx = hx + (n / 3 - 0.5) * (w - 1.5);
					if (Math.abs(sx - dx) < 1.4 || hash(n * 7 + r * 100, i + j) < 0.3) continue;
					const [x, z] = fromGrid(sx, gz, a, style), g = bay.heightAt(x, z);
					if (g > 0.8) trees.push({ x, y: g - 0.1, z, h: 1.1 + hash(n, r * 50) * 0.9, shrub: true, col: jit(pick(PAL.crown, hash(n, r)), r) });
				}
			};
			// ---------- the lived-in blocks (older towns and suburbs) ----------
			const props = list.props || (list.props = {});
			let bAngV = null;
			const bAng = () => { if (bAngV === null) { const [x1, z1] = fromGrid(X0, Z0 + IZ / 2, a, style), [x2, z2] = fromGrid(X0 + 10, Z0 + IZ / 2, a, style); bAngV = Math.atan2(z2 - z1, x2 - x1); } return bAngV; };
			// one of the props (lotkit.js) at a grid point, turned to face a street (+ yaw)
			const prop = (k, gx, gz, face, yaw = 0, sc = 1, c = null, lift = 0, tilt = 0) => {
				if (!detail || !kit2.has(k)) return;
				const [x, z] = fromGrid(gx, gz, a, style), g = bay.heightAt(x, z);
				if (g < 0.8) return;
				const e = [x, g + lift, z, bAng() + FACE_A[face] + yaw, ...(typeof sc === 'number' ? [sc, sc, sc] : sc), tilt];
				if (c) e.push(c[0], c[1], c[2]);
				(props[k] || (props[k] = [])).push(e);
			};
			// a run of fence panels (props) from one grid point to another
			const fenceRun = (k, x0, z0, x1, z1, sy = 1) => {
				const L2 = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L2 / 2.4)), f = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 's' : 'e';
				for (let m = 0; m < n; m++) prop(k, x0 + (x1 - x0) * (m + 0.5) / n, z0 + (z1 - z0) * (m + 0.5) / n, f, 0, [L2 / n / 2.4, sy, 1]);
			};
			const weeds = (x0, x1, z0, z1, n, seed) => { if (!detail) return; for (let m = 0; m < n; m++) { const [x, z] = fromGrid(x0 + hash(m, seed * 3 + i) * (x1 - x0), z0 + hash(seed + m * 7, j) * (z1 - z0), a, style), g = bay.heightAt(x, z); if (g > 0.8) trees.push({ x, y: g - 0.2, z, h: 0.8 + hash(m * 3, seed) * 1.4, shrub: true, col: jit([0.32, 0.34, 0.17], hash(m, seed)) }); } };
			const lawn = (gx, gz, w, d, c, face) => lot(list, a, style, gx, gz, w, d, 0.34, KIND.plain, c, null, false, { face, lift: -0.3 });
			const rolls = (k, side) => (n) => hash(k * 7.7 + n * 3.1 + side * 1.3, i * 13 + j * 7 + n * 0.7);
			// out front and out back: the walk, the porch, the fences, the cars and bins, the AC
			// unit; a pool on its deck, a shed, a cottage, raised beds; and on the run-down
			// ones, dead lawn, weeds and a car left to sit
			const yard = (c) => {
				const { lotX, Lw, side, face, at, r, k, x: hx, w, d, hf, setback, gx, gw, gs, dw, dx0, pad, big, cnd, col, rc, door, O, SY } = c, R2 = rolls(k + 50, side);
				const dx = hx + (side ? 1 : -1) * (door - 0.5) * (w - 2.5);
				const back = hf + d, room = IZ / 2 - back;
				let pool = false;
				if (detail) {
					pave(dx, at(hf / 2), 1.1, hf, KIND.plain, [0.7, 0.69, 0.65], O);
					if (c.porch) {
						lot(list, a, style, dx, at(hf - 0.8), 2.6, 1.8, 0.22, KIND.plain, rc, null, false, { ...O, lift: 2.6 });
						if (c.modern || r > 0.5) for (const e of [-1, 1]) lot(list, a, style, dx + e * 1.15, at(hf - 1.55), 0.2, 0.2, 2.6, KIND.plain, [0.92, 0.91, 0.88], null, false, O);
					}
					fences(lotX, lotX + Lw, at, hf + d * 0.55, IZ / 2, side, r);
					if (!cnd) shrubs(hx, at(hf - 0.9), w, dx, r);
					if (gw > 0) {
						if (!cnd && R2(1) < 0.55) prop('car', gx - gs * gw / 4, at(setback * 0.45), face, (R2(2) - 0.5) * 0.08, 1, pick(CARS, R2(3)));
						if (!cnd && R2(1) < 0.2 && gw > 5) prop('car', gx + gs * gw / 4, at(setback * 0.4), face, (R2(4) - 0.5) * 0.1, 1, pick(CARS, R2(5)));
						if (pad && R2(6) < 0.4) prop(R2(7) < 0.55 ? 'rv' : 'boat', dx0 - gs * (dw / 2 - 1.35), at(4.4), face);
						if (!cnd && R2(9) < 0.07) prop('hoop', gx + gs * (gw / 2 - 0.3), at(setback + 0.15), face);
					}
					if (!cnd && R2(8) < 0.35) prop('bins', (gw > 0 ? dx0 + gs * (dw / 2 + 1.1) : lotX + 1.6), at(0.7), face);
					if (R2(10) < 0.6) prop('cond', hx - gs * (w / 2 + 0.7), at(hf + d * 0.6), face);
					const pl = big ? 12 : 8.5, pwd = big ? 5.5 : 4.2, pz = back + 3.2 + pwd / 2, px = hx + (R2(12) - 0.5) * Math.max(0, w - pl) * 0.8;
					if (room > 11 && R2(11) < (big ? 0.85 : c.pools) && flatYard(px, at(pz), pl + 2.8, pwd + 2.8)) {
						pool = true;
						lot(list, a, style, px, at(pz), pl + 2.8, pwd + 2.8, 0.36, KIND.plain, jit([0.8, 0.77, 0.7], R2(12)), null, false, { face, lift: -0.3 });
						const PL = lot(list, a, style, px, at(pz), pl, pwd, 0, KIND.pool, [0.9, 0.89, 0.85], null, 0.9, { face });
						if (PL) PL.dec = true;
						if (big) { prop('cabana', px + (pl / 2 + 3.2) * (R2(13) < 0.5 ? 1 : -1), at(pz), face); for (let n = 0; n < 3; n++) prop('lounger', px - pl / 2 + 2 + n * 1.3, at(pz + pwd / 2 + 1.5), face, Math.PI); }
						else if (R2(13) < 0.6) prop('lounger', px - pl / 4, at(pz + pwd / 2 + 1.4), face, Math.PI);
					}
					if (room > 9 && R2(14) < (big ? 0.6 : 0.2)) lot(list, a, style, gs > 0 ? lotX + 2.2 : lotX + Lw - 2.2, at(IZ / 2 - 2.6), 2.8, 2.4, 2.3, KIND.garage, R2(15) < 0.5 ? [0.6, 0.55, 0.45] : jit(col, R2(15)), { hip: false, rot: true, h: 0.9, col: rc, t: R2(15) < 0.3 ? ROOF.metal : ROOF.shingle, ov: 0.2, trim: 3 }, false, { face });
					if (room > 15 && R2(16) < (big ? 0.5 : c.adu)) setCond(lot(list, a, style, gs > 0 ? lotX + Lw - SY - 3.4 : lotX + SY + 3.4, at(IZ / 2 - 4.3), 6.2, 6.4, 3.2, doorKind(KIND.house, 0.5), jit(col, R2(17)), { hip: R2(17) < 0.5, h: 1.6, col: rc, t: ROOF.shingle, ov: 0.4 }, false, { face: face === 's' ? 'n' : 's' }), cnd);
					if (room > 8 && R2(18) < 0.09) for (let n = 0; n < 2; n++) prop('bed', hx + (n - 0.5) * 2.4, at(IZ / 2 - 2.2), face);
					if (cnd) {
						lawn(lotX + Lw / 2, at(hf / 2), Lw - 1, hf - 0.6, jit([0.46, 0.41, 0.27], r), face);
						weeds(lotX + 1, lotX + Lw - 1, at(0.8), at(hf - 0.8), 10, k * 7 + side);
						if (R2(19) < 0.45) prop('car', gw > 0 ? gx : hx, at(setback * 0.5), face, (R2(20) - 0.5) * 0.5, [1, 0.94, 1], pick(FADED, R2(21)), -0.09, 0.03);
					}
				}
				// yard trees: a front tree and one or two out back, bigger in the older places
				if (hash(k + 1, side + i * 3) < c.treeK * 0.6) tree(hx - gs * (w * 0.3), at(2.5), c.treeH * (0.7 + r * 0.6), false, r * 3.1 % 1);
				if (hash(k + 5, side + j * 7) < c.treeK) tree(hx + (r - 0.5) * 6, at(pool ? IZ / 2 - 3 : back + 7), c.treeH * (0.8 + r * 0.7), r > 0.82, r * 5.7 % 1);
				if (big) for (let n = 0; n < 3; n++) tree(lotX + 3 + hash(n, k + i) * (Lw - 6), at(IZ / 2 - 2 - hash(k, n + j) * 4), c.treeH * 1.1, n === 2, hash(n * 5, k));
			};
			// a suburban house: the tract's, or an estate on a double lot, or a skinny infill
			const suburbHome = (c, T) => {
				const { lotX, Lw, face, at, r, rw, k, side } = c, { era, modern, eich, big, thin } = T, R = rolls(k, side);
				const remodel = R(3) < 0.14, rr = R(0);
				const col = jit(remodel ? pick(REMODEL, rw * 7.3 % 1) : T.walls[Math.floor(r * 4)], r);
				const rc = jit(rr < 0.1 || (remodel && rr < 0.5) ? pick(T.roofsAll, rr * 10 % 1) : T.roofs[r > 0.8 ? 1 : 0], rr).map((v) => v * (0.9 + ((rr * 13.7) % 1) * 0.16));
				const rt = remodel && rr < 0.3 ? ROOF.shingle : T.roofT;
				const across = modern || thin;
				const setback = (modern ? 6 : 8) + (R(1) - 0.5) * (modern ? 1.5 : 3.2) + (big ? 5 : 0), SY = 1.1 + R(2) * 1.8;
				const two = big || thin || (modern ? r > 0.12 : era === ERA.seventies ? r > 0.5 : era === ERA.ranch ? r > 0.9 : false);
				const h = two ? 6.4 : 3.3, gs = r > 0.5 ? 1 : -1;
				const gw = big ? 9.4 : thin ? 3.6 : modern && r > 0.7 ? 8.8 : 6.2;
				const avail = Lw - 2 * SY;
				const w = big ? Math.min(avail - gw - 3, 15 + r * 9) : across ? avail - ((r * 2.9) % 1) * 1.5 : avail - gw - ((r * 2.9) % 1) * 1.8;
				if (w < 5) return;
				const d = big ? 14 + r * 5 : modern ? 12 + ((r * 5.3) % 1) * 3 : 10 + ((r * 5.3) % 1) * 3;
				const hf = across ? setback + 3 : setback + 1.5;
				const hx = across ? lotX + Lw / 2 : big ? lotX + Lw / 2 - gs * (gw + 1) / 2 : lotX + SY + (gs > 0 ? w / 2 : gw + w / 2);
				const gx = big ? hx + gs * (w / 2 + 0.5 + gw / 2) : gs > 0 ? lotX + Lw - SY - gw / 2 : lotX + SY + gw / 2;
				const roofH = eich ? 0.9 : Math.min(w, d) * (modern ? 0.3 : era === ERA.ranch ? 0.2 : 0.26) * (big ? 1.15 : 1);
				const door = modern ? (gs > 0 ? 0.28 : 0.72) : 0.35 + ((r * 3.3) % 1) * 0.3;
				const ov = eich ? 0.95 : era === ERA.ranch ? 0.65 : 0.45;
				const roof = { hip: modern || big || (era === ERA.ranch && r > 0.4), h: roofH, col: rc, t: rt, ov };
				// not every house square to its street (the older tracts least of all)
				const rot = R(4) < (modern ? 0.12 : 0.4) ? (R(5) - 0.5) * (modern ? 0.05 : 0.1) : 0;
				const O = { face, rot, pw: rot ? fromGrid(lotX + Lw / 2, at(hf + d / 2), a, style) : null };
				// a second storey popped up over part of an old one-storey house
				const pop = !two && w > 11 && R(6) < 0.1, w1 = pop ? w * 0.56 : w;
				const H = lot(list, a, style, pop ? hx - gs * (w - w1) / 2 : hx, at(hf + d / 2), w1, d, h, doorKind(KIND.house, pop ? Math.min(0.75, Math.max(0.25, door)) : door), col, roof, false, O);
				if (!H) return;
				H.era = remodel && R(10) < 0.4 ? 'modern' : cityEra(era, R(11));
				H.street = c.busy;
				const cnd = condFor(H, T.neglectK);
				setCond(H, cnd);
				if (pop) setCond(lot(list, a, style, hx + gs * w1 / 2, at(hf + d / 2 + 0.6), w - w1, d - 1.2, 6.4, KIND.house, col, { ...roof, hip: true, h: Math.min(w - w1, d) * 0.28 }, false, O), cnd);
				// an addition out the back
				if (R(7) < 0.13 && !eich) setCond(lot(list, a, style, hx + (R(2) - 0.5) * w * 0.4, at(hf + d + 2.2), Math.min(w * 0.5, 7), 4.6, 3.1, KIND.house, remodel ? col : jit(col, R(7) * 7 % 1), { hip: false, rot: true, h: 1.3, col: rc, t: R(7) < 0.05 ? ROOF.metal : rt, ov: 0.35 }, false, O), cnd);
				// the garage, its doors to the street (or made into a room, the drive still to it)
				const conv = !big && !modern && R(8) < 0.06;
				setCond(lot(list, a, style, gx, at(setback + 3.5), gw, 7, 3.1, conv ? KIND.house : KIND.garage, col, { hip: modern || big, h: eich ? 0.5 : 1.6, col: rc, t: rt, ov }, false, O), cnd);
				// the driveway: one car wide, two, or three with a pad to the side for the RV
				const pad = !thin && R(9) < 0.3 ? 2.8 : 0, dw = gw - 0.6 + pad, dx0 = gx - gs * pad / 2;
				pave(dx0, at(setback / 2), dw, setback, KIND.plain, jit([0.62, 0.61, 0.58], R(9)), O);
				yard({ ...c, x: hx, w, d, hf, setback, gx, gw, gs, dw, dx0, pad, big, cnd, col, rc, door, O, SY, porch: !eich, modern, pools: modern ? 0.28 : 0.2, adu: 0.06, treeK: T.treeK, treeH: T.treeH });
			};
			// an older town's house: wood, a deep porch, the drive down the side to a garage out back
			const olderHome = (c, T) => {
				const { lotX, Lw, face, at, r, k, side } = c, { big, thin } = T, R = rolls(k, side);
				const w = big ? Math.min(Lw - 6, 12 + r * 5) : thin ? Lw - 1.6 : Math.min(Lw - 3.6, 7.6 * Lw / 12 + r * 2), d = big ? 14 + r * 4 : 10 + ((r * 7.7) % 1) * 4;
				const h = big || thin || r > 0.55 ? 6.4 : 3.6;
				const col = jit(pick(PAL.older, hash(i + k * 13, j * 7 + side)), r);
				const rc = pick(PAL.olderRoof, hash(i * 3 + k, j + side * 5));
				const gs = r > 0.5 ? 1 : -1;
				const cx = thin ? lotX + Lw / 2 : lotX + Lw / 2 - gs * (Lw - w - 3) / 2;
				const hf = 6 + (R(1) - 0.5) * 3 + (big ? 3 : 0);
				const door = 0.25 + ((r * 3.3) % 1) * 0.5;
				const rot = R(4) < 0.45 ? (R(5) - 0.5) * 0.12 : 0;
				const O = { face, rot, pw: rot ? fromGrid(cx, at(hf + d / 2), a, style) : null };
				const H = lot(list, a, style, cx, at(hf + d / 2), w, d, h, doorKind(KIND.house, door), col, { hip: big || r > 0.8, rot: r < 0.3 && !big, h: Math.min(w, d) * (0.42 + (R(6) - 0.5) * 0.2), col: rc, t: T.roofT, ov: 0.45 }, false, O);
				if (!H) return;
				H.era = R(10) < 0.82 ? 'prewar' : R(11) < 0.6 ? 'ranch' : 'split';
				H.street = c.busy;
				const cnd = condFor(H, T.neglectK);
				setCond(H, cnd);
				if (R(7) < 0.15) setCond(lot(list, a, style, cx + (R(2) - 0.5) * w * 0.3, at(hf + d + 2), Math.min(w * 0.6, 6), 4.2, 3.2, KIND.house, jit(col, R(7) * 5 % 1), { hip: false, rot: true, h: 1.2, col: rc, t: R(7) < 0.06 ? ROOF.metal : T.roofT, ov: 0.3 }, false, O), cnd);
				const dx = cx + (side ? 1 : -1) * (door - 0.5) * (w - 2.5);
				const gx = lotX + Lw / 2 + gs * (Lw / 2 - 1.9);
				if (detail) {
					// the porch: a roof on posts across much of the front, a rail between, steps
					const pw = w * (0.5 + r * 0.3);
					lot(list, a, style, dx, at(hf - 1.2), pw, 2.6, 0.25, KIND.plain, rc, null, false, { ...O, lift: 2.7 });
					for (const e of [-1, 1]) lot(list, a, style, dx + e * (pw / 2 - 0.2), at(hf - 2.3), 0.22, 0.22, 2.7, KIND.plain, [0.9, 0.89, 0.85], null, false, O);
					if (R(10) < 0.6) for (const e of [-1, 1]) lot(list, a, style, dx + e * (pw / 4 + 0.35), at(hf - 2.3), pw / 2 - 1.3, 0.08, 0.95, KIND.plain, [0.9, 0.89, 0.85], null, false, O);
					// the front fence: pickets, a low chain link, or nothing
					if (R(11) < 0.25) for (const [f0, f1] of thin ? [[lotX + 0.3, lotX + Lw - 0.3]] : [[lotX + 0.3, gx - 1.6], [gx + 1.6, lotX + Lw - 0.3]]) if (f1 - f0 > 1) fenceRun('picket', f0, at(0.5), f1, at(0.5));
					else if (R(11) < 0.33) lot(list, a, style, lotX + Lw / 2, at(0.5), Lw - 3.4, 0.05, 1.1, KIND.plain, [0.55, 0.56, 0.57], null, false, { face });
					if (!thin) {
						pave(gx, at(12), 2.8, 24, KIND.plain, [0.56, 0.55, 0.52]);
						if (r > 0.3) setCond(lot(list, a, style, gx - gs * 0.6, at(hf + d + 6), 3.6, 6, 2.8, R(12) < 0.1 ? doorKind(KIND.house, 0.5) : KIND.garage, jit(col, r * 3.1 % 1), { hip: false, h: 1.3, col: rc, t: T.roofT, ov: 0.3 }, false, { face }), cnd);
						if (!cnd && R(13) < 0.45) prop('car', gx, at(hf + 1 + R(14) * 4), face, (R(14) - 0.5) * 0.05, 1, pick(CARS, R(15)));
						if (!cnd && R(13) > 0.97) prop(R(15) < 0.5 ? 'rv' : 'boat', gx, at(hf + 6), face);
					}
				}
				yard({ ...c, x: cx, w, d, hf, setback: hf, gx, gw: 0, gs, dw: 0, dx0: gx, pad: 0, big, cnd, col, rc, door, O, SY: 1, porch: false, modern: false, pools: 0.06, adu: 0.13, treeK: 1, treeH: 12 });
				if (k % 2 === 0) tree(lotX + Lw / 2, side ? Z0 + IZ + 1.9 : Z0 - 1.9, 9 + r * 6, false, r);
			};
			const home = (c, T) => (T.sub ? suburbHome(c, T) : olderHome(c, T));
			// an empty lot: dirt or dry grass, weeds, a sign up now and then
			const vacant = (c) => {
				const { lotX, Lw, face, at, r, k, side } = c;
				lawn(lotX + Lw / 2, at(IZ / 4), Lw - 0.6, IZ / 2 - 1, r * 7.1 % 1 < 0.5 ? jit([0.5, 0.42, 0.32], r) : jit([0.47, 0.44, 0.27], r), face);
				if (hash(r * 31, 7) < 0.55) prop('sign', lotX + Lw * 0.3, at(1.6), face);
				weeds(lotX + 1, lotX + Lw - 1, at(1), at(IZ / 2 - 2), 14, k * 5 + side);
				if (r * 3.3 % 1 < 0.5) tree(lotX + Lw * 0.6, at(IZ / 3), 8 + r * 5, false, r);
			};
			// balconies across a front, one to each unit above the ground floor (the facade's
			// sliders are on the odd bays); lift = floor height; the flats' own storey
			const balconies = (gxC, gzC, W, D, face, floors, storey, c, first = 1, pitch = 7.2, off = 1.5) => {
				if (!detail) return;
				const [ux, uz] = LX[face], [nx, nz] = NZ[face], ew = face === 's' || face === 'n';
				for (let f = first; f < floors; f++) for (let m = 0; (m + 0.5) * pitch + off * 3.6 - 1.8 <= W - 1.6; m++) {
					const fxc = m * pitch + off * 3.6;
					const bw = fract(fxc / 25.2);
					if (pitch > 7 && bw > 0.44 && bw < 0.56) continue;
					const bx = gxC + ux * (fxc - W / 2) + nx * (D / 2 + 0.7), bz = gzC + uz * (fxc - W / 2) + nz * (D / 2 + 0.7);
					lot(list, a, style, bx, bz, ew ? 3.0 : 1.4, ew ? 1.4 : 3.0, 1.05, KIND.plain, c, null, false, { face, lift: f * storey - 0.12 });
				}
			};
			// a small apartment building on a lot and a half (the older towns' fourplexes)
			const fourplex = (c, wc) => {
				const { lotX, Lw, face, at, r, side } = c, fl = r < 0.6 ? 2 : 3, W = Lw - 5, D = 16 + r * 5;
				const col = jit(wc, r), o = lot(list, a, style, lotX + 1.5 + W / 2, at(5 + D / 2), W, D, fl * 2.8 + 0.4, KIND.apt, col, r < 0.5 ? { hip: true, h: 1.6, col: pick(PAL.olderRoof, r * 3.3 % 1), t: ROOF.shingle, ov: 0.5 } : null, false, { face });
				setCond(o, condFor(o, 0.06));
				balconies(lotX + 1.5 + W / 2, at(5 + D / 2), W, D, face, fl, 2.8, col.map((v) => Math.min(1, v * 1.06)));
				if (detail) { pave(lotX + Lw - 1.8, at(IZ / 4), 2.8, IZ / 2 - 2, KIND.plain, [0.55, 0.54, 0.52]); pave(lotX + Lw / 2, at(IZ / 2 - 5), Lw - 1, 8, KIND.paved); prop('bins', lotX + Lw - 1.5, at(0.8), face); }
				fences(lotX, lotX + Lw, at, 5 + D, IZ / 2, side, r);
				tree(lotX + 2, at(2.5), 9 + r * 4, false, r * 1.7 % 1);
			};
			// garden apartments round a courtyard: blocks along the streets, a third wing across
			// the end, and in the middle the pool with its deck, spa, loungers, umbrellas, a
			// cabana and the grill, the clubhouse beside it; parking under carports; a gated
			// drive in, the mailbox kiosk by it; lawns, shrubs and trees
			const complex = () => {
				const q = (n) => hash(i * 5.3 + n * 1.7, j * 7.1 + n * 2.9);
				const floors = q(0) < 0.55 ? 2 : 3, bh = floors * 2.8 + 0.4;
				const col = jit(pick(PAL.suburb, q(1)), q(0)), rcol = pick(PAL.tile, q(2) * 0.99);
				const roof = { hip: true, h: 2.2, col: rcol, t: rcol[0] > rcol[2] * 1.4 ? ROOF.barrel : ROOF.flatTile, ov: 0.7, trim: q(3) < 0.5 ? 0 : 3 };
				const e = 4.5, bd = 13, entry = 18, fw = IX - 2 * e - entry;
				const balc = col.map((v) => Math.min(1, v * 1.06));
				const bldg = (gx, gz, w, d, face) => {
					const o = lot(list, a, style, gx, gz, w, d, bh, KIND.apt, col, roof, false, { face });
					setCond(o, condFor(o, 0.02));
					const ew = face === 's' || face === 'n';
					balconies(gx, gz, ew ? w : d, ew ? d : w, face, floors, 2.8, balc);
					if (detail) { const [nx, nz] = NZ[face], [ux, uz] = LX[face], W = ew ? w : d, D = ew ? d : w; for (let m = 0; m < W / 4; m++) { const [x, z] = fromGrid(gx + ux * (m * 4 + 2 - W / 2) + nx * (D / 2 + 1.2), gz + uz * (m * 4 + 2 - W / 2) + nz * (D / 2 + 1.2), a, style), g = bay.heightAt(x, z); if (g > 0.8) trees.push({ x, y: g - 0.1, z, h: 1.0 + hash(m, gx) * 0.8, shrub: true, col: jit(pick(PAL.crown, hash(m, gz)), q(4)) }); } }
				};
				bldg(X0 + e + fw / 2, Z0 + e + bd / 2, fw, bd, 'n');
				bldg(X0 + e + fw / 2, Z0 + IZ - e - bd / 2, fw, bd, 's');
				const m0 = Z0 + e + bd + 3, m1 = Z0 + IZ - e - bd - 3, mz = (m0 + m1) / 2, band = m1 - m0;
				const west = band > 20;
				if (west) bldg(X0 + e + bd / 2, mz, bd, band - 1, 'e');
				const cx0 = X0 + e + (west ? bd + 3 : 2), cx1 = X0 + IX * 0.6, ccx = (cx0 + cx1) / 2;
				// the courtyard lawn, the deck, the pool and spa
				lawn((cx0 + cx1) / 2, mz, cx1 - cx0, band, jit([0.3, 0.46, 0.2], q(5)), 's');
				const pl = Math.min(15, (cx1 - cx0) * 0.4), pw2 = Math.min(7, band * 0.35), dk = [Math.min(cx1 - cx0 - 14, pl + 12), Math.min(band - 2, pw2 + 8)];
				lot(list, a, style, ccx, mz, dk[0], dk[1], 0.38, KIND.plain, jit([0.82, 0.78, 0.7], q(6)), null, false, { face: 's', lift: -0.3 });
				const PL = lot(list, a, style, ccx - 1, mz, pl, pw2, 0, KIND.pool, [0.9, 0.89, 0.85], null, 0.9, { face: 's' });
				if (PL) PL.dec = true;
				lot(list, a, style, ccx + pl / 2 + 2.2, mz - pw2 / 2 + 1.3, 2.6, 2.6, 0, KIND.pool, [0.86, 0.84, 0.8], null, 0.9, { face: 's' });
				if (detail) {
					for (const s2 of [-1, 1]) for (let n = 0; n < Math.floor(pl / 1.6); n++) {
						const lx = ccx - 1 - pl / 2 + 0.8 + n * 1.6;
						if (n % 3 === 2) prop('umbrella', lx, mz + s2 * (pw2 / 2 + 2.0), 's', 0, 1, pick(CANVAS, q(7 + n)));
						else prop('lounger', lx, mz + s2 * (pw2 / 2 + 1.9), s2 > 0 ? 'n' : 's');
					}
					prop('cabana', ccx - dk[0] / 2 + 2.2, mz, 'e', 0, 1, pick(CANVAS, q(8)));
					prop('bbq', ccx + dk[0] / 2 - 1.6, mz + dk[1] / 2 - 1.2, 'n');
					for (const s2 of [-1, 1]) prop('table', ccx + dk[0] / 2 - 3.5, mz + s2 * 2.2, 's');
					// the pool fence round the deck
					const fx0 = ccx - dk[0] / 2, fx1 = ccx + dk[0] / 2, fz0 = mz - dk[1] / 2, fz1 = mz + dk[1] / 2;
					fenceRun('iron', fx0, fz0, fx1, fz0); fenceRun('iron', fx0, fz1, fx1 - 2, fz1); fenceRun('iron', fx0, fz0, fx0, fz1); fenceRun('iron', fx1, fz0, fx1, fz1);
					for (const [tx, tz] of [[cx0 + 2, m0 + 2], [cx0 + 2, m1 - 2], [cx1 - 2, m0 + 2], [cx1 - 2, m1 - 2]]) tree(tx, tz, 7 + q(9) * 4, false, q(9));
				}
				// the clubhouse, facing the pool
				lot(list, a, style, cx1 + 7, mz, 11, Math.min(band - 4, 12), 4.2, KIND.office, jit(col, q(10)), { ...roof, h: 2.4 }, false, { face: 'w' });
				// the parking: carports down both sides of the lane, cars under most
				const px0 = cx1 + 14, px1 = X0 + IX - e;
				pave((px0 + px1) / 2, mz, px1 - px0, band + 4, KIND.paved);
				pave(X0 + IX - e - entry / 2, (Z0 + m0) / 2, entry - 5, m0 - Z0, KIND.plain, [0.3, 0.3, 0.31]);
				pave(X0 + IX - e - entry / 2, (m1 + Z0 + IZ) / 2, entry - 5, Z0 + IZ - m1, KIND.plain, [0.3, 0.3, 0.31]);
				if (detail) for (let x = px0 + 1.6; x < px1 - 1.5; x += 3.0) for (const [z, f] of [[m0 + 1.2, 'n'], [m1 - 1.2, 's']]) {
					prop('carport', x, z + (f === 'n' ? 1.8 : -1.8), f, 0, [1, 1, 1], [0.8, 0.79, 0.76]);
					if (hash(x, z + i) < 0.7) prop('car', x, z + (f === 'n' ? 1.8 : -1.8), f, 0, 1, pick(CARS, hash(z, x + j)));
				}
				// the gate across the drive in, the mailbox kiosk inside it
				prop('gate', X0 + IX - e - entry / 2, Z0 + 3, 's');
				prop('mailbox', X0 + IX - e - entry + 0.6, m0 - 1.2, 'e');
				for (let t = 5; t < IX - 3; t += 11) for (const ez of [1.6, IZ - 1.6]) tree(X0 + t, Z0 + ez, 8 + hash(t, ez) * 3, false, hash(t * 3, ez + i));
			};
			// townhouses in rows of four to six, garages under, little patios out back
			const townhouses = (side, at, face, wc, rcol) => {
				const len = IX - 4, uw = 6.4 + hash(i * 3, j * 5 + side) * 1.4, d = 12, fl = hash(i * 7 + side, j * 3) < 0.5 ? 2 : 3;
				const h = fl * 3.0 + 0.6, sb = 4 + hash(i, j * 9 + side) * 2;
				const tones = [wc, jit(wc, 0.9).map((v) => v * 0.9), [0.9, 0.88, 0.82]];
				let x = 2;
				for (let g = 0; x < len - uw * 3; g++) {
					const n = Math.min(Math.floor((len - x) / uw), 4 + Math.floor(hash(g * 3 + i, j + side) * 3));
					for (let u = 0; u < n; u++) {
						const gxC = X0 + x + uw * (u + 0.5), rU = hash(g * 11 + u, i * 7 + j + side);
						const o = lot(list, a, style, gxC, at(sb + d / 2 + (u % 2) * 0.6), uw + 0.02, d, h + (u % 3 === 1 ? 0.6 : 0), KIND.row + (u % 2 ? 0.1 : 0.2), jit(tones[(u + g) % 3], rU), { hip: false, rot: true, h: 2.2, col: rcol, t: ROOF.shingle, ov: 0.3 }, false, { face });
						setCond(o, condFor(o, 0.02));
						if (!detail) continue;
						pave(gxC, at(sb / 2), uw * 0.5, sb, KIND.plain, [0.64, 0.63, 0.6]);
						lawn(gxC, at(sb + d + 2.4), uw - 0.4, 4.4, [0.7, 0.68, 0.63], face);
						lot(list, a, style, gxC - uw / 2, at(sb + d + 2.4), 0.1, 4.6, 1.6, KIND.plain, [0.5, 0.42, 0.33], null, false, { face });
						lot(list, a, style, gxC, at(sb + d + 4.7), uw, 0.1, 1.6, KIND.plain, [0.5, 0.42, 0.33], null, false, { face });
						if (rU < 0.4) prop('table', gxC, at(sb + d + 2.3), face);
						if (rU > 0.7) prop('bins', gxC + uw * 0.3, at(0.7), face);
					}
					x += uw * n + 5 + hash(g, i + j) * 4;
				}
				for (let t = 4; t < IX - 3; t += 12) tree(X0 + t, at(-1.8), 7 + hash(t, side) * 3, false, hash(t, i + side));
			};
			// the neighbourhood's own: tennis and pickleball courts, a dog park, a community
			// garden, a pocket park
			const amenities = (side, at, face) => {
				const len = IX - 4, dep = IZ / 2 - 3, pa = hash(i * 13 + side, j * 17);
				const kinds = pa < 0.3 ? ['tennis', 'dog'] : pa < 0.55 ? ['pickle', 'garden', 'park'] : pa < 0.8 ? ['park', 'tennis'] : ['garden', 'dog', 'pickle'];
				const each = len / kinds.length;
				kinds.forEach((kd, n) => {
					const cx = X0 + 2 + each * (n + 0.5), cz = at(dep / 2 + 1.5);
					lawn(cx, cz, each - 1, dep, jit([0.3, 0.44, 0.2], pa + n * 0.1), face);
					if (kd === 'tennis' && each > 37.5 && dep > 19) {
						lot(list, a, style, cx, cz, 36.6, 18.3, 0, KIND.court, [0.3, 0.4, 0.3], null, 0.9, { face: 'e' });
						prop('net', cx, cz, 'e', 0, [11.9, 1, 1]);
						fenceRun('iron', cx - 18.3, cz - 9.15, cx + 18.3, cz - 9.15, 2); fenceRun('iron', cx - 18.3, cz + 9.15, cx + 18.3, cz + 9.15, 2);
						fenceRun('iron', cx - 18.3, cz - 9.15, cx - 18.3, cz + 9.15, 2); fenceRun('iron', cx + 18.3, cz - 9.15, cx + 18.3, cz + 9.15, 2);
					} else if (kd === 'pickle' || kd === 'tennis') {
						const nc = Math.max(1, Math.min(4, Math.floor((each - 2) / 10)));
						for (let m = 0; m < nc; m++) {
							const px = cx + (m - (nc - 1) / 2) * 10;
							lot(list, a, style, px, cz, 9.6, Math.min(18, dep - 1), 0, KIND.court + 0.5, [0.3, 0.4, 0.3], null, 0.9, { face: 's' });
							prop('net', px, cz, 's', 0, [6.6, 0.85, 1]);
						}
						fenceRun('iron', cx - each / 2 + 0.6, cz - dep / 2 + 0.5, cx + each / 2 - 0.6, cz - dep / 2 + 0.5, 1.6); fenceRun('iron', cx - each / 2 + 0.6, cz + dep / 2 - 0.5, cx + each / 2 - 0.6, cz + dep / 2 - 0.5, 1.6);
					} else if (kd === 'dog') {
						lawn(cx, cz, each - 3, dep - 2, jit([0.44, 0.42, 0.26], pa), face);
						fenceRun('iron', cx - each / 2 + 1.5, cz - dep / 2 + 1, cx + each / 2 - 1.5, cz - dep / 2 + 1, 0.8); fenceRun('iron', cx - each / 2 + 1.5, cz + dep / 2 - 1, cx + each / 2 - 1.5, cz + dep / 2 - 1, 0.8);
						fenceRun('iron', cx - each / 2 + 1.5, cz - dep / 2 + 1, cx - each / 2 + 1.5, cz + dep / 2 - 1, 0.8); fenceRun('iron', cx + each / 2 - 1.5, cz - dep / 2 + 1, cx + each / 2 - 1.5, cz + dep / 2 - 1, 0.8);
						for (let m = 0; m < 3; m++) prop('bench', cx - each / 4 + m * each / 4, cz + dep / 2 - 3, face);
						prop('cabana', cx + each / 4, cz, face, 0, 1, [0.55, 0.6, 0.62]);
						for (let m = 0; m < 3; m++) tree(cx + (hash(m, n + i) - 0.5) * (each - 8), cz + (hash(n, m + j) - 0.5) * (dep - 6), 8 + hash(m, n) * 5, false, hash(m * 3, n));
					} else if (kd === 'garden') {
						for (let bx = cx - each / 2 + 3; bx < cx + each / 2 - 3; bx += 2.2) for (let bz = cz - dep / 2 + 3; bz < cz + dep / 2 - 5; bz += 3.4) prop('bed', bx, bz, 's', 0, 1, jit([1, 1, 1], hash(bx, bz)));
						lot(list, a, style, cx + each / 2 - 3, cz + dep / 2 - 3, 3, 3, 2.4, KIND.garage, [0.5, 0.42, 0.3], { hip: false, h: 1, col: [0.35, 0.33, 0.3], t: ROOF.metal, ov: 0.2 }, false, { face });
						fenceRun('picket', cx - each / 2 + 1, cz - dep / 2 + 1, cx + each / 2 - 1, cz - dep / 2 + 1);
					} else {
						pave(cx, cz, 2, dep - 2, KIND.plain, [0.72, 0.7, 0.64]);
						for (let m = 0; m < 3; m++) prop('bench', cx + 2, cz + (m - 1) * 6, 'e');
						prop('table', cx - 5, cz + 3, 's'); prop('table', cx - 6, cz - 5, 's');
						for (let m = 0; m < 6; m++) tree(cx + (hash(m, n * 3 + i) - 0.5) * (each - 6), cz + (hash(n * 5, m + j) - 0.5) * (dep - 4), 8 + hash(m, n) * 6, m === 5, hash(m * 7, n));
					}
				});
			};
			// shops below, flats above with their balconies, built out to the pavement; parking behind
			const mixedUse = () => {
				pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.95, IZ * 0.4);
				for (const side of [0, 1]) {
					const face = side ? 's' : 'n', at = (m) => (side ? Z0 + IZ - m : Z0 + m);
					for (let x = 1, k = 0; x < IX - 8; k++) {
						const rr = hash(i * 31 + k * 5 + side, j * 29 + k), w = Math.min(IX - 1 - x, 10 + rr * 16), D = 16 + rr * 4, fl = 3 + Math.floor(rr * 2.2);
						const col = jit(pick(rr < 0.5 ? PAL.retail : PAL.sunset, rr * 7.7 % 1), rr), h = fl * 3.3 + 0.9;
						const o = lot(list, a, style, X0 + x + w / 2, at(0.6 + D / 2), w, D, h, KIND.shop, col, null, false, { face });
						setCond(o, condFor(o, 0.02));
						if (rr > 0.35) balconies(X0 + x + w / 2, at(0.6 + D / 2), w, D, face, fl, 3.3, [0.25, 0.25, 0.27], 2, 5.08, 0.85);
						if (detail && hash(k, side + i) < 0.7) { const aw = hash(i + k, j * 9 + side); if (o) o.awn = lot(list, a, style, X0 + x + w / 2, at(-0.2), w * 0.86, 1.6, 0.18, KIND.plain, aw < 0.3 ? [0.55, 0.12, 0.1] : aw < 0.6 ? [0.1, 0.3, 0.2] : [0.2, 0.2, 0.2], null, false, { face, lift: 3.0 }); }
						x += w + (rr > 0.8 ? 4 : 0.02);
					}
					for (let t = 5; t < IX - 3; t += 10) tree(X0 + t, side ? Z0 + IZ + 1.6 : Z0 - 1.6, 7, false, hash(t, side + i));
				}
			};
			const arterial = (style === STYLE.suburb || style === STYLE.older) && (((i % 7) + 7) % 7 === 0);
			const civic = hash(i * 11 + 5, j * 13 + 7);
			if ((style === STYLE.suburb || style === STYLE.older) && civic < 0.035) {
				// a school: low classroom wings, a field and a car park
				lot(list, a, style, X0 + IX * 0.3, Z0 + IZ * 0.3, IX * 0.45, 14, 4.5, KIND.office, [0.86, 0.8, 0.68], { hip: false, h: 1.5, col: [0.5, 0.47, 0.44] });
				lot(list, a, style, X0 + IX * 0.3, Z0 + IZ * 0.62, IX * 0.35, 12, 4.5, KIND.office, [0.86, 0.8, 0.68], { hip: false, h: 1.5, col: [0.5, 0.47, 0.44] });
				pave(X0 + IX * 0.76, Z0 + IZ * 0.5, IX * 0.4, IZ * 0.8, KIND.plain, [0.3, 0.44, 0.2]);
				continue;
			}
			if (arterial) {
				// a commercial strip on the arterial: shops at the back, parking in front, a pad or
				// two; or (more toward the centres) a street of shops with flats over them
				const r = hash(i * 17 + 1, j * 19 + 3);
				if (hash(i * 23 + 5, j * 7 + 1) < 0.3 + U.d * 2) { mixedUse(); continue; }
				pave(X0 + IX * 0.5, Z0 + IZ * 0.36, IX * 0.95, IZ * 0.62);
				// (the shops face their parking: their fronts are toward -z, front = -1)
				const st1 = lot(list, a, style, X0 + IX * 0.5, Z0 + IZ * 0.84, IX * (0.7 + r * 0.2), 22, 7.4 + r * 2, KIND.retail, jit(pick(PAL.retail, r), r), null);
				if (st1) st1.front = -1;
				if (r > 0.4) lot(list, a, style, X0 + IX * 0.18, Z0 + IZ * 0.18, 18, 14, 6.5, KIND.retail, jit(pick(PAL.retail, r * 3.7), r), null);
				for (let k = 0; k < 5; k++) tree(X0 + IX * (0.1 + k * 0.2), Z0 + 3, 7, false, hash(i + k, j));
				continue;
			}
			if (style === STYLE.sf || style === STYLE.sunset) {
				const dist = style === STYLE.sunset ? 'sunset' : sfDistrict(wx, wz);
				const wide = dist === 'nobhill' || dist === 'pacheights';
				const L = wide ? 15.24 : 7.62, deep = style === STYLE.sf ? (wide ? 24 : 19) : 21;
				const pal = { chinatown: PAL.chinatown, northbeach: PAL.northbeach, nobhill: PAL.nobhill, mission: PAL.mission, pacheights: PAL.pale, marina: PAL.sf, victorian: PAL.sf, sunset: PAL.sunset }[dist] || PAL.sf;
				// the shopping streets: every few streets a commercial corridor (Valencia, 24th,
				// Clement, Irving...), shops on the ground floor, flats above, awnings out front
				const share = { chinatown: 0.85, northbeach: 0.6, mission: 0.3, sunset: 0.14 }[dist] ?? 0.2;
				const comm = (jj) => hash(jj * 7 + 13, Math.round(a * 1000) + style * 5) < share;
				const nK = Math.ceil((IX - 0.1) / L);
				for (const side of [0, 1]) for (let k = 0, skip = -1; k * L < IX - 0.1; k++) {
					if (k === skip) continue;
					const r = hash(i * 131 + k * 7 + side, j * 17 + k);
					// an empty lot now and then, fenced; now and then a double lot with a bigger
					// block of flats on it
					if (r < 0.03) {
						const gz = side ? Z0 + IZ - deep / 2 : Z0 + deep / 2;
						lot(list, a, style, X0 + k * L + L / 2, gz, L - 0.3, deep - 0.6, 0.34, KIND.plain, jit([0.46, 0.42, 0.34], r), null, false, { lift: -0.3 });
						lot(list, a, style, X0 + k * L + L / 2, side ? Z0 + IZ - 0.4 : Z0 + 0.4, L - 0.2, 0.05, 1.9, KIND.plain, [0.5, 0.51, 0.52], null, false, { face: side ? 's' : 'n' });
						continue;
					}
					const dbl = k * L + 2 * L < IX - 0.1 && hash(i * 57 + k * 3 + side, j * 11 + k) < 0.07 && dist !== 'chinatown';
					if (dbl) skip = k + 1;
					const Lk = dbl ? 2 * L : L;
					let h = ({ chinatown: 11 + r * 7, northbeach: 9 + r * 5, nobhill: 16 + Math.pow(r, 1.5) * 26, mission: 8.5 + Math.floor(r * 3) * 2.8, pacheights: 11 + r * 4, marina: 8 + r * 3, sunset: 7 + r * 1.5 }[dist] ?? 8.5 + Math.floor(r * 3) * 2.8 + (r > 0.93 ? 6 : 0)) + (dbl ? 3.3 + Math.floor(r * 2) * 3.3 : 0);
					const col = jit(pick(pal, hash(i + k * 13, j * 7 + side)), r);
					let roof = null;
					if (dist === 'victorian' && r > 0.3) roof = { hip: false, rot: true, h: 3.4, col: [0.3, 0.3, 0.32] };                      // the gable faces the street
					else if (dist === 'marina' && r > 0.55) roof = { hip: true, h: 2, col: pick(PAL.tile, r) };
					else if (dist === 'pacheights' && r > 0.5) roof = { hip: true, h: 4, col: [0.3, 0.32, 0.35] };
					else if (dist === 'chinatown' && r > 0.78) roof = { hip: true, h: 2.6, col: r > 0.9 ? [0.18, 0.42, 0.3] : [0.62, 0.16, 0.12] };
					const gz = side ? Z0 + IZ - deep / 2 : Z0 + deep / 2, face = side ? 's' : 'n', front = side ? Z0 + IZ : Z0;
					const out = (m) => side ? front + m : front - m;
					const corner = (k === 0 || k === nK - 1) && r > 0.55;
					const shop = comm(side ? j + 1 : j) || corner;
					// a garage under the house (the Sunset nearly always, older SF often), left or right
					const r2 = hash(i * 37 + k * 11 + side, j * 43 + k);
					const garageP = { sunset: 0.85, nobhill: 0.08, chinatown: 0.04, northbeach: 0.15, pacheights: 0.4 }[dist] ?? 0.55;
					const kind = shop ? KIND.shop : KIND.row + (r2 < garageP ? (r2 < garageP / 2 ? 0.1 : 0.2) : 0);
					const so = lot(list, a, style, X0 + k * L + Lk / 2, gz, Lk + 0.02, deep, h, kind, col, roof, false, { face });
					if (dist !== 'nobhill' && dist !== 'pacheights') setCond(so, condFor(so, 0.02));
					// bay windows stacked up the front, from the first floor up
					if (style === STYLE.sf && r > 0.35 && dist !== 'nobhill' && dist !== 'chinatown' && h > 7) lot(list, a, style, X0 + k * L + Lk / 2, out(0.5), Math.min(3.6, L * 0.47), 1.4, h - 4.4, KIND.bay, col.map((c) => Math.min(1, c * 1.05)), null, false, { face, lift: 3.4 });
					// an awning over the shopfront
					if (shop && hash(k * 5 + side, i * 3 + j) < 0.75) {
						const aw = hash(i + k, j * 9 + side);
						const ac = aw < 0.25 ? [0.55, 0.12, 0.1] : aw < 0.45 ? [0.1, 0.3, 0.2] : aw < 0.6 ? [0.12, 0.18, 0.36] : aw < 0.75 ? [0.2, 0.2, 0.2] : aw < 0.88 ? [0.86, 0.6, 0.18] : [0.9, 0.88, 0.82];
						const awo = lot(list, a, style, X0 + k * L + Lk / 2, out(0.8), Lk * 0.86, 1.6, 0.18, KIND.plain, ac, null, false, { face, lift: 3.0 });
						if (so && awo) so.awn = awo;
					}
					// a street tree now and then (more in the Sunset and the Mission)
					if (hash(k * 3 + side, i * 5 + j) < (dist === 'sunset' || dist === 'mission' ? 0.2 : 0.1)) tree(X0 + k * L + L / 2, side ? Z0 + IZ + 2.0 : Z0 - 2.0, 6 + r * 3, false, r);
				}
				// the short ends of the block are built up too, houses facing the cross streets
				for (let k = 0; deep + (k + 1) * L < IZ - deep + 0.1; k++) for (const side of [0, 1]) {
					const r = hash(i * 71 + k * 5 + side, j * 23 + k + 9);
					const h = { chinatown: 11 + r * 7, northbeach: 9 + r * 5, nobhill: 16 + Math.pow(r, 1.5) * 26, pacheights: 11 + r * 4, marina: 8 + r * 3, sunset: 7 + r * 1.5 }[dist] ?? 8.5 + Math.floor(r * 3) * 2.8;
					const col = jit(pick(pal, hash(i * 3 + k * 11, j * 5 + side)), r);
					const r2 = hash(i * 29 + k * 13 + side, j * 31 + k);
					lot(list, a, style, side ? X0 + IX - deep / 2 : X0 + deep / 2, Z0 + deep + k * L + L / 2, deep, L + 0.02, h, r2 < 0.2 ? KIND.shop : KIND.row + (r2 < 0.55 ? 0.1 : 0), col, null, false, { face: side ? 'e' : 'w' });
				}
			} else if (style === STYLE.older || style === STYLE.suburb) {
				const sub = style === STYLE.suburb;
				// the tract (suburbs): one builder, one decade, one look; then fifty years of owners
				const ti = Math.floor(((i * BX) + 1e6) / 520), tj = Math.floor(((j * BZ) + 1e6) / 400);
				const tr = hash(ti * 7 + 3, tj * 13 + 5), era = sub ? eraFor(wx, wz, tr) : ERA.ranch;
				const wallsAll = sub ? [PAL.ranch, PAL.seventies, PAL.suburb, PAL.eichler][era] : PAL.older, roofsAll = sub ? [PAL.ranchRoof, PAL.shake, PAL.tile, PAL.flat][era] : PAL.olderRoof;
				const walls = [0, 1, 2, 3].map((n) => pick(wallsAll, hash(ti + n * 17, tj + n * 31)));
				const roofs = [0, 1].map((n) => pick(roofsAll, hash(ti * 3 + n, tj * 5 + n)));
				const modern = sub && era === ERA.modern, eich = sub && era === ERA.eichler;
				const L = !sub ? 12 : modern ? 16 : eich ? 19 : 20;
				const treeK = sub ? [0.9, 0.7, 0.3, 0.9][era] : 1, treeH = sub ? [11, 9, 5, 10][era] : 12;
				const roofT = !sub ? (hash(ti, tj * 3) < 0.15 ? ROOF.metal : ROOF.shingle) : modern ? (roofs[0][0] > roofs[0][2] * 1.4 ? ROOF.barrel : ROOF.flatTile) : eich ? ROOF.gravel : era === ERA.seventies ? ROOF.shake : ROOF.shingle;
				// (more let go out at the ragged edge of town, where it thins into the open land)
			const neglectK = (sub ? 0.04 : 0.11) * (U.u < 0.45 ? 2.2 : 1);
				// a block of garden apartments round a pool now and then (more toward the town centres)
				const br = hash(i * 41 + 7, j * 43 + 11);
				if (br < (sub ? 0.035 : 0.025) + U.d * 0.5 && IX > 80 && IZ > 55 && level(3)) { complex(); continue; }
				const im7 = ((i % 7) + 7) % 7, jm4 = ((j % 4) + 4) % 4, artNext = im7 === 1 ? 1 : im7 === 6 ? -1 : 0, collector = jm4 === 0 ? 0 : jm4 === 3 ? 1 : -1;
				for (const side of [0, 1]) {
					const fz = side ? Z0 + IZ : Z0, inw = side ? -1 : 1, face = side ? 's' : 'n', at = (m) => fz + inw * m;
					// a row of townhouses along one side, or the neighbourhood's courts, dog park and garden
					const sr = hash(i * 47 + side * 5, j * 53 + 3);
					if (sr < (sub ? 0.045 : 0.03)) { townhouses(side, at, face, pick(wallsAll, sr * 13.1), roofs[0]); continue; }
					if (sr < (sub ? 0.065 : 0.045) && level(2.5)) { amenities(side, at, face); continue; }
					const len = IX - (sub ? 4 : 2);
					for (let x = 0, k = 0; x < len - 6; k++) {
						const r = hash(i * 131 + k * 7 + side, j * 17 + k), rw = hash(i * 71 + k * 13 + side * 3, j * 37 + k * 5);
						// lots of their own widths: most near the tract's, now and then a double or a
						// triple lot with an estate on it, a skinny infill, an empty one
						let Lw = L * (0.86 + rw * 0.3), kind = 'house';
						if (rw < 0.05 && x + L * 2.4 < len) { Lw = L * (rw < 0.016 ? 3 : 2) * (0.95 + r * 0.1); kind = 'estate'; }
						else if (rw > 0.955) { Lw = L * (sub ? 0.62 : 0.7); kind = 'narrow'; }
						else if (r < (sub ? 0.03 : 0.05)) kind = 'vacant';
						else if (!sub && rw > 0.9 && x + L * 1.8 < len) { Lw = L * 1.7; kind = 'plex'; }
						if (len - (x + Lw) < L * 0.55) Lw = len - x;              // (the last takes what is left)
						const lotX = X0 + x;
						x += Lw;
						if (Lw < 6.5) break;
						const corner = k === 0 || x >= len - 0.1;
						// how busy its street is, for the economy (economy/layer.js): a collector every
						// fourth street, the corners, and most of all the corners on an arterial
						const busy = (corner && (artNext === 1 ? k === 0 : artNext === -1 ? x >= len - 0.1 : false)) || collector === side ? 2 : corner ? 1 : 0;
						const ctx = { lotX, Lw, side, face, at, r, rw, k, corner, busy };
						if (kind === 'vacant') { vacant(ctx); continue; }
						if (kind === 'plex') { fourplex(ctx, pick(wallsAll, r * 5.1)); continue; }
						home(ctx, { sub, era, modern, eich, big: kind === 'estate', thin: kind === 'narrow', L, walls, wallsAll, roofs, roofsAll, roofT, neglectK, treeK, treeH });
					}
				}
			} else if (style === STYLE.industry) {
				// warehouses and plants in concrete yards, trailers at the docks
				const n = r0 > 0.6 ? 2 : r0 > 0.25 ? 1 : 3;
				pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.96, IZ * 0.96, KIND.plain, [0.48, 0.47, 0.45]);
				for (let k = 0; k < n; k++) {
					const r = hash(i * 31 + k, j * 11 + k);
					const w = IX * (n === 1 ? 0.7 : n === 2 ? 0.42 : 0.28), d = IZ * (0.35 + r * 0.3), h = 8 + r * 6;
					const gx = X0 + IX * (n === 1 ? 0.5 : (k + 0.5) / n), gz = Z0 + IZ * 0.45;
					lot(list, a, style, gx, gz, w, d, h, KIND.industry, jit(pick(PAL.industry, r), r), null);
					for (let t = 0; t < 4; t++) if (hash(k * 5 + t, i + j) > 0.4) lot(list, a, style, gx - w * 0.4 + t * w * 0.25, gz + d / 2 + 9, 2.6, 13, 4, KIND.plain, [0.9, 0.9, 0.88], null);
				}
			} else if (style === STYLE.retail) {
				// a mall or big-box centre: the anchor at the back, parking all round
				const r = r0;
				pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.97, IZ * 0.97);
				const anchor = lot(list, a, style, X0 + IX / 2, Z0 + IZ * 0.72, IX * (0.55 + r * 0.3), IZ * 0.36, 9 + r * 5, KIND.retail, jit(pick(PAL.retail, r), r), null);
				if (anchor) anchor.front = -1;
				if (r > 0.3) lot(list, a, style, X0 + IX * 0.2, Z0 + IZ * 0.18, 26, 18, 7, KIND.retail, jit(pick(PAL.retail, r * 2.3), r), null);
				for (let k = 0; k < 6; k++) tree(X0 + IX * (0.1 + k * 0.16), Z0 + IZ * 0.45, 6, false, hash(k, i + j));
			} else {
				// business park and campus: office blocks in parking and lawns
				const n = r0 > 0.5 ? 2 : 1;
				pave(X0 + IX / 2, Z0 + IZ / 2, IX * 0.95, IZ * 0.95);
				for (let k = 0; k < n; k++) {
					const r = hash(i * 31 + k, j * 11 + k);
					const w = n === 2 ? IX * 0.36 : IX * 0.55, d = IZ * (0.45 + r * 0.15), h = 12 + Math.floor(r * 4) * 4.1;
					lot(list, a, style, X0 + IX * (n === 2 ? 0.27 + k * 0.46 : 0.5), Z0 + IZ * 0.5, w, d, h, KIND.office, jit(pick(PAL.office, r), r), null);
				}
				for (let k = 0; k < 8; k++) tree(X0 + IX * (0.06 + k * 0.125), Z0 + 4, 8, k % 3 === 0, hash(k, i * 3 + j));
			}
		}
	}
}
