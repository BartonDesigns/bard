// A Strip resort's insides (bay/towers.js builds them a level at a time, as it does an office
// tower's; interiors/workplace-plan.js planResort lays out the levels). The casino: the gaming
// floor inside the doors under its low dark ceiling, the slot banks in their rows back to back
// with a stool at every machine, the table games in their pits either side of the aisle from
// the doors (blackjack, roulette, the dealers inside the pit), the bar, the cashier's cage by
// the lifts, and at the ends of a long one the sportsbook's wall of screens and the buffet; over
// it the showroom, its stage and its rows of seats. The hotel: the lobby with its front desk and
// the bell desk by the doors, then floor after floor of rooms down a corridor from the lifts,
// each with its bed, its bathroom, its desk and its window, the suites at the top; a room or
// two being made up, its door open and the cart outside. The machines and the tables are yours
// to play (interiors/office-perks.js opens ui/casino.js), the bar, the buffet and the vending
// machine by the lifts yours too.
// In the level's frame: x across the front, the doors at +z, the lifts' core at the back.

import * as THREE from 'three';
import { tileUV, TILE } from './screen-atlas.js';

// which way a seat faces: one facing (dx, dz) (bay/towers.js seats face (-sin yaw, -cos yaw))
const face = (dx, dz) => Math.atan2(-dx, -dz);

export function fitResort(T, L, B) {
	const { sign, M } = B, phone = !!B.phone;
	const solid = B.solid || (() => {}), perk = B.perk || (() => {});
	const stats = { slots: 0, tables: 0, seats: 0, rooms: 0, kind: L.kind, prims: 0 };
	const work = (role, group, extra = {}) => ({ role, group: T.key + ':' + L.n + ':' + group, side: 0, floor: L.n, program: L.program, ...extra });
	// the boxes and posts, written straight into one list of triangles a material: a casino
	// floor has thousands, and a geometry made for each would hold a phone up for a second
	const fast = new Map();
	const tris = (m) => { let q = fast.get(m); if (!q) fast.set(m, q = { p: new Float32Array(3 * 4096), n: new Float32Array(3 * 4096), u: new Float32Array(2 * 4096), k: 0 }); return q; };
	// one corner: where, which way it faces, its uv (the lists grown as they fill)
	function v(q, x, y, z, nx, ny, nz, uu, vv) {
		if (q.k * 3 >= q.p.length) { for (const key of ['p', 'n', 'u']) { const a = new Float32Array(q[key].length * 2); a.set(q[key]); q[key] = a; } }
		const i = q.k * 3, j = q.k * 2;
		q.p[i] = x; q.p[i + 1] = y; q.p[i + 2] = z; q.n[i] = nx; q.n[i + 1] = ny; q.n[i + 2] = nz; q.u[j] = uu; q.u[j + 1] = vv;
		q.k++;
	}
	// a face from its four corners, counter-clockwise seen from outside, as two triangles
	function quad(q, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz) {
		v(q, ax, ay, az, nx, ny, nz, 0, 0); v(q, bx, by, bz, nx, ny, nz, 1, 0); v(q, cx, cy, cz, nx, ny, nz, 1, 1);
		v(q, ax, ay, az, nx, ny, nz, 0, 0); v(q, cx, cy, cz, nx, ny, nz, 1, 1); v(q, dx, dy, dz, nx, ny, nz, 0, 1);
	}
	function box(m, x0, y0, z0, x1, y1, z1, s = false) {
		if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
		const q = tris(m);
		quad(q, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0);
		quad(q, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0);
		quad(q, x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0);
		quad(q, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0, -1, 0);
		quad(q, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1);
		quad(q, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1);
		stats.prims++;
		if (s) solid(x0, z0, x1, z1, y0, y1);
	}
	// a post or a disc: seg sides round it, its top and (foot) its underside
	function cyl(m, x, y, z, r, h, seg = 8, foot = true) {
		const q = tris(m), y1 = y + h, n = Math.min(seg, 12), step = Math.PI * 2 / n;
		for (let i = 0; i < n; i++) {
			const sa = Math.sin(i * step), ca = Math.cos(i * step), sb = Math.sin((i + 1) * step), cb = Math.cos((i + 1) * step);
			const ax = x + r * sa, az = z + r * ca, bx = x + r * sb, bz = z + r * cb;
			v(q, ax, y, az, sa, 0, ca, 0, 0); v(q, bx, y, bz, sb, 0, cb, 1, 0); v(q, bx, y1, bz, sb, 0, cb, 1, 1);
			v(q, ax, y, az, sa, 0, ca, 0, 0); v(q, bx, y1, bz, sb, 0, cb, 1, 1); v(q, ax, y1, az, sa, 0, ca, 0, 1);
			v(q, x, y1, z, 0, 1, 0, 0.5, 0.5); v(q, ax, y1, az, 0, 1, 0, sa * 0.5 + 0.5, ca * 0.5 + 0.5); v(q, bx, y1, bz, 0, 1, 0, sb * 0.5 + 0.5, cb * 0.5 + 0.5);
			if (foot) { v(q, x, y, z, 0, -1, 0, 0.5, 0.5); v(q, bx, y, bz, 0, -1, 0, sb * 0.5 + 0.5, cb * 0.5 + 0.5); v(q, ax, y, az, 0, -1, 0, sa * 0.5 + 0.5, ca * 0.5 + 0.5); }
		}
		stats.prims++;
	}
	function flush() {
		for (const [m, q] of fast) {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.BufferAttribute(q.p.subarray(0, q.k * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(q.n.subarray(0, q.k * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(q.u.subarray(0, q.k * 2), 2));
			B.add(m, g);
		}
		fast.clear();
	}
	// (a box from any two corners)
	const bb = (m, x0, y0, z0, x1, y1, z1, s = false) => box(m, Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), s);
	const H = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7 + L.seed * 91.3) * 43758.5453; return s - Math.floor(s); };
	const sit = (x, z, yaw, h, w) => { B.seats.push([x, z, yaw, true, h, w]); stats.seats++; };
	const stand = (x, z, yaw, w) => B.seats.push([x, z, yaw, false, 0, w]);
	// a picture of the screens' atlas, facing (sin yaw, cos yaw)
	const pic = (m, x, y, z, w, h, tile, yaw) => B.add(m, tileUV(new THREE.PlaneGeometry(w, h), tile).rotateY(yaw).translate(x, y, z));
	const NEON = M.neon || [M.glow];
	const { hw, hd } = T, cz = T.coreZ, cw = T.coreW / 2;

	// ---------- the casino ----------
	// a blackjack table: the felt's half moon toward f, the dealer at its straight edge, five stools
	// round the curve
	function blackjack(x, z, f, g) {
		const c = z - f * 0.4, t0 = f > 0 ? -Math.PI / 2 : Math.PI / 2;
		bb(M.casinoWall, x - 0.9, 0, c, x + 0.9, 0.78, c + f * 0.6);
		B.add(M.rail, new THREE.CylinderGeometry(1.24, 1.24, 0.1, 20, 1, false, t0, Math.PI).scale(1, 1, 0.8).translate(x, 0.83, c));
		B.add(M.felt, new THREE.CylinderGeometry(1.1, 1.1, 0.04, 20, 1, false, t0, Math.PI).scale(1, 1, 0.8).translate(x, 0.88, c));
		bb(M.rail, x - 1.24, 0.78, c - f * 0.05, x + 1.24, 0.9, c);
		solid(x - 1.24, Math.min(c, c + f * 1.0), x + 1.24, Math.max(c, c + f * 1.0), 0, 0.92);
		// the chip rack, the shoe, the limit sign; a hand dealt at three of the places
		bb(M.dark, x - 0.45, 0.9, c + f * 0.02, x + 0.45, 0.93, c + f * 0.2);
		for (let k = 0; k < 6; k++) cyl(M.art[k % 4], x - 0.36 + k * 0.144, 0.93, c + f * 0.11, 0.03, 0.03 + H(x + k, z) * 0.04, 8);
		bb(M.dark, x + 0.58, 0.9, c + f * 0.06, x + 0.74, 1.0, c + f * 0.3);
		bb(M.dark, x - 0.78, 0.9, c + f * 0.03, x - 0.62, 1.12, c + f * 0.06);
		bb(NEON[1 % NEON.length], x - 0.76, 1.02, c + f * 0.061, x - 0.64, 1.1, c + f * 0.066);
		for (let i = 0; i < 5; i++) {
			const a = (i - 2) * 0.5, sx = x + Math.sin(a) * 1.6, sz = c + f * Math.cos(a) * 1.4;
			cyl(M.rail, sx, 0.64, sz, 0.2, 0.08, 6, false); bb(M.steel, sx - 0.03, 0, sz - 0.03, sx + 0.03, 0.64, sz + 0.03);
			sit(sx, sz, face(x - sx, c - sz), 0.72, work('gambler', g + ':' + i));
			if (H(i, x * 3 + z) < 0.6) for (const d of [-0.04, 0.04]) bb(M.bed, x + Math.sin(a) * 0.82 + d - 0.03, 0.9, c + f * Math.cos(a) * 0.62 - 0.045, x + Math.sin(a) * 0.82 + d + 0.03, 0.902, c + f * Math.cos(a) * 0.62 + 0.045);
		}
		stand(x, c - f * 0.55, face(0, f), work('dealer', g));
		perk('blackjack', x, c + f * 1.75);
		stats.tables++;
	}
	// a roulette table: the layout on the felt, the wheel at one end, four stools along the front
	function roulette(x, z, f, g) {
		bb(M.casinoWall, x - 1.2, 0, z - 0.45, x + 1.2, 0.78, z + 0.45, true);
		bb(M.rail, x - 1.35, 0.78, z - 0.55, x + 1.35, 0.88, z + 0.55);
		bb(M.felt, x - 1.25, 0.88, z - 0.47, x + 1.25, 0.9, z + 0.47);
		// (the numbers: three rows of twelve, red and black, the zero at the wheel's end)
		for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) bb((i + j) % 2 ? M.red : M.dark, x - 1.1 + i * 0.12, 0.9, z + f * (-0.2 + j * 0.13) - 0.055, x - 1.0 + i * 0.12, 0.903, z + f * (-0.2 + j * 0.13) + 0.055);
		bb(M.green || M.felt, x + 0.36, 0.9, z - 0.3, x + 0.46, 0.903, z + 0.3);
		const wx = x + 0.9;
		cyl(M.oak, wx, 0.88, z, 0.36, 0.14, 20); cyl(M.dark, wx, 0.9, z, 0.29, 0.13, 20); cyl(M.gold, wx, 1.02, z, 0.045, 0.1, 8);
		for (let i = 0; i < 4; i++) {
			const sx = x - 1.0 + i * 0.62, sz = z + f * 0.98;
			cyl(M.rail, sx, 0.64, sz, 0.2, 0.08, 6, false); bb(M.steel, sx - 0.03, 0, sz - 0.03, sx + 0.03, 0.64, sz + 0.03);
			sit(sx, sz, face(0, -f), 0.72, work('gambler', g + ':' + i));
		}
		stand(wx, z - f * 0.85, face(0, f), work('dealer', g));
		perk('roulette', x - 0.1, z + f * 1.7);
		stats.tables++;
	}
	// the table games' pit: tables round its edge facing out, the dealers inside, the pit boss's
	// podium in the middle, chandeliers over it
	function pit(x0, x1, z0, z1, g) {
		const cx = (x0 + x1) / 2, cz2 = (z0 + z1) / 2;
		let i = 0;
		for (let x = x0 + 1.6; x <= x1 - 1.4; x += 3.7, i++) {
			const kind = i % 3 === 1 ? roulette : blackjack;
			kind(x, z1 - 0.6, 1, g + ':a' + i);
			kind(x, z0 + 0.6, -1, g + ':b' + i);
		}
		bb(M.oak, cx - 0.7, 0, cz2 - 0.5, cx + 0.7, 1.1, cz2 + 0.5, true); bb(M.stoneD, cx - 0.75, 1.1, cz2 - 0.55, cx + 0.75, 1.14, cz2 + 0.55);
		stand(cx, cz2 + 0.9, face(0, 1), work('pit boss', g));
		for (const x of [x0 + (x1 - x0) * 0.25, x0 + (x1 - x0) * 0.75]) {
			cyl(M.glow, x, L.h - 1.5, cz2, 1.0, 0.3, 16); cyl(M.gold, x, L.h - 1.2, cz2, 0.04, 0.95, 6);
			for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; bb(M.steel, x + Math.cos(a) * 1.05 - 0.02, L.h - 1.95, cz2 + Math.sin(a) * 1.05 - 0.02, x + Math.cos(a) * 1.05 + 0.02, L.h - 1.5, cz2 + Math.sin(a) * 1.05 + 0.02); }
		}
		for (const [zz, yaw] of [[cz2 + 0.02, 0], [cz2 - 0.02, Math.PI]]) sign('BLACKJACK · ROULETTE', cx, L.h - 0.75, zz, Math.min(6, x1 - x0 - 2), 0.5, yaw);
	}
	function casino() {
		const A = 2.6, gx = Math.min(hw - 2.2, 44), z0 = -hd + 1.6, z1 = hd - 4;
		const keep = [], clear = (a, b, c, d) => keep.push([a, b, c, d]);
		const free = (a, b, c, d) => !keep.some((k) => c > k[0] && a < k[2] && d > k[1] && b < k[3]);
		clear(-A, -hd - 1, A, hd + 1);                      // the aisle from the doors to the lifts
		clear(-cw - 2, -hd - 1, cw + 2, cz + 4);            // the lifts and their landing
		clear(-hw - 1, z1, hw + 1, hd + 1);                 // inside the doors
		// the pits, either side of the aisle in the middle of the floor
		const zc = (z0 + z1) / 2 + 2, pd = Math.min(7.5, (z1 - z0) / 5), pw = Math.min(26, gx - A - 3);
		if (pw >= 8 && pd >= 4) for (const side of [-1, 1]) {
			const x0 = side < 0 ? -A - 2 - pw : A + 2, x1 = side < 0 ? -A - 2 : A + 2 + pw;
			clear(x0 - 1.4, zc - pd - 2.6, x1 + 1.4, zc + pd + 2.6);
			pit(x0, x1, zc - pd, zc + pd, 'pit' + side);
		}
		// the bar, out on the floor to the left of the doors
		const bw = Math.min(9, gx - A - 5), bd = 3.6, bx = -A - 3 - bw / 2, bz = z1 - 4.6;
		if (bw >= 5 && free(bx - bw / 2 - 1.6, bz - bd / 2 - 1.6, bx + bw / 2 + 1.6, bz + bd / 2 + 1.6)) {
			clear(bx - bw / 2 - 1.8, bz - bd / 2 - 1.8, bx + bw / 2 + 1.8, bz + bd / 2 + 1.8);
			// (the counter all round, its flap at one corner for the bartenders)
			for (const s of [-1, 1]) {
				bb(M.oak, bx - bw / 2, 0, bz + s * bd / 2, bx + bw / 2, 1.08, bz + s * (bd / 2 - 0.3), true);
				bb(M.oak, bx + s * bw / 2, 0, bz - bd / 2, bx + s * (bw / 2 - 0.3), 1.08, bz + bd / 2 - (s > 0 ? 1.0 : 0), true);
				bb(M.stoneD, bx - bw / 2 - 0.1, 1.08, bz + s * (bd / 2 + 0.1), bx + bw / 2 + 0.1, 1.13, bz + s * (bd / 2 - 0.35));
			}
			// the back bar down the middle: its bottles in rows on top, lit from under, the mirror between
			bb(M.oak, bx - bw / 2 + 1.2, 0, bz - 0.35, bx + bw / 2 - 1.2, 1.05, bz + 0.35, true);
			bb(M.steel, bx - bw / 2 + 1.3, 1.05, bz - 0.03, bx + bw / 2 - 1.3, 1.95, bz + 0.03);
			for (const s of [-1, 1]) bb(NEON[2 % NEON.length], bx - bw / 2 + 1.25, 1.05, bz + s * 0.36, bx + bw / 2 - 1.25, 1.08, bz + s * 0.38);
			for (let x = bx - bw / 2 + 1.4; x < bx + bw / 2 - 1.3; x += 0.24) for (const s of [-1, 1]) cyl(M.art[Math.floor(H(x, s) * 4)], x, 1.05, bz + s * 0.2, 0.035, 0.24 + H(s, x) * 0.08, 6);
			cyl(M.glow, bx, L.h - 1.2, bz, Math.min(2.4, bw / 3), 0.25, 16);
			for (const s of [-1, 1]) {
				stand(bx + s * bw * 0.22, bz + s * (bd / 2 - 0.85), face(0, s), work('bartender', 'bar'));
				for (let x = bx - bw / 2 + 0.6; x < bx + bw / 2 - 0.4; x += 0.85) {
					const sz = bz + s * (bd / 2 + 0.55);
					cyl(M.rail, x, 0.7, sz, 0.19, 0.08, 6, false); bb(M.steel, x - 0.03, 0, sz - 0.03, x + 0.03, 0.7, sz + 0.03);
					sit(x, sz, face(0, -s), 0.78, work('drinker', 'bar'));
				}
			}
			perk('cocktail', bx, bz + bd / 2 + 1.35);
			for (const [zz, yaw] of [[bz + 0.02, 0], [bz - 0.02, Math.PI]]) sign((T.name ? T.name.replace(/^the\s+/i, '') + ' ' : '') + 'BAR', bx, L.h - 0.7, zz, Math.min(5, bw), 0.45, yaw);
		}
		// the cashier's cage, beside the lifts at the back
		const kw = Math.min(12, hw - cw - 6);
		if (kw >= 5) {
			const k0 = cw + 3, k1 = k0 + kw, kz = -hd + 3.2;
			clear(k0 - 1, -hd - 1, k1 + 1, kz + 2.4);
			bb(M.oak, k0, 0, kz - 0.5, k1, 1.1, kz, true); bb(M.stoneD, k0 - 0.05, 1.1, kz - 0.55, k1 + 0.05, 1.15, kz + 0.05);
			for (let x = k0 + 0.1; x < k1; x += 0.22) bb(M.gold, x - 0.012, 1.15, kz - 0.27, x + 0.012, 2.45, kz - 0.25);
			bb(M.gold, k0, 2.45, kz - 0.3, k1, 2.55, kz - 0.2);
			bb(M.casinoWall, k0, 2.55, kz - 0.32, k1, L.h - 0.3, kz - 0.18, true);
			for (const s of [k0, k1]) bb(M.casinoWall, s - 0.08, 0, -hd, s + 0.08, L.h - 0.3, kz, true);
			for (let x = k0 + 1.2; x < k1 - 0.6; x += 2.4) stand(x, kz - 1.0, face(0, 1), work('cashier', 'cage'));
			sign('CASINO CAGE · CASHIER', (k0 + k1) / 2, 2.85, kz - 0.17, Math.min(5, kw - 1), 0.42, 0);
			perk('cage', (k0 + k1) / 2, kz + 0.9);
		}
		// past the sportsbook and the buffet, a long casino's back of house: walled off, a door for its staff
		const xp = Math.min(hw, gx + 16);
		if (hw > xp + 0.5) for (const s of [-1, 1]) {
			bb(M.casinoWall, s * xp, 0, -hd, s * (xp + 0.2), L.h - 0.25, hd - 6, true); bb(M.casinoWall, s * xp, 0, hd - 4.8, s * (xp + 0.2), L.h - 0.25, hd, true);
			bb(M.casinoWall, s * xp, 2.2, hd - 6, s * (xp + 0.2), L.h - 0.25, hd - 4.8); bb(M.dark, s * xp, 0, hd - 6, s * (xp + 0.05), 2.2, hd - 4.8, true);
			sign('STAFF ONLY', s * (xp - 0.02), 2.45, hd - 5.4, 1.2, 0.22, -s * Math.PI / 2);
		}
		// the sportsbook at the left end of a long floor: the wall of screens, rows of armchairs
		const sx0 = -xp + 1, sx1 = -gx - 2;
		if (sx1 - sx0 >= 7) {
			const n = Math.min(10, Math.floor((2 * hd - 10) / 2.6)), zs = -n * 1.3;
			const wx = sx0 - 0.7 + (xp < hw ? 0.2 : 0);
			bb(M.dark, wx, 0.9, zs - 0.2, wx + 0.12, Math.min(L.h - 0.3, 0.9 + 3 * 1.5 + 0.2), -zs + 0.2);
			for (let j = 0; j < n; j++) for (let r = 0; r < 3; r++) pic(M.slotScreens, wx + 0.13, 1.65 + r * 1.5, zs + 1.3 + j * 2.6, 2.4, 1.35, (j + r) % 3 === 1 ? TILE.odds : TILE.sports, Math.PI / 2);
			for (let x = sx0 + 4; x < sx1 - 0.5; x += 2.4) for (let z = zs + 1.2; z < -zs - 0.6; z += 1.1) {
				bb(M.velvet, x - 0.4, 0.1, z - 0.42, x + 0.4, 0.45, z + 0.42, true); bb(M.velvet, x + 0.28, 0.45, z - 0.42, x + 0.42, 1.0, z + 0.42);
				sit(x, z, face(-1, 0), 0.46, work('sports fan', 'book'));
			}
			sign('RACE & SPORTS BOOK', wx + 0.15, L.h - 0.7, 0, Math.min(8, -2 * zs), 0.55, Math.PI / 2);
		}
		// the buffet at the right end: its counters along the wall, the tables
		const ux0 = gx + 2, ux1 = xp - 1;
		if (ux1 - ux0 >= 7) {
			const zl = Math.min(hd - 6, 16), cx = ux1 - 2.2;
			bb(M.bed, cx - 0.4, 0, -zl, cx + 0.4, 0.9, zl, true); bb(M.steel, cx - 0.45, 0.9, -zl, cx + 0.45, 0.95, zl);
			for (let z = -zl + 0.6; z < zl - 0.4; z += 0.7) bb(M.art[Math.floor(H(z, 7) * 4)], cx - 0.3, 0.95, z - 0.25, cx + 0.3, 1.0, z + 0.25);
			bb(M.glass, cx - 0.5, 1.35, -zl, cx + 0.5, 1.37, zl); bb(M.glow, cx - 0.2, 1.6, -zl, cx + 0.2, 1.65, zl);
			for (let z = -zl + 2; z < zl - 1; z += 4) stand(cx + 1.2, z, face(-1, 0), work('chef', 'buffet'));
			for (let z = -zl + 1; z < zl; z += 3) perk('casinobuffet', cx - 0.9, z);
			for (let x = ux0 + 1.2; x < cx - 3; x += 3) for (let z = -zl - 1; z < zl + 1; z += 3.2) {
				B.add(M.oak, new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16).translate(x, 0.74, z)); cyl(M.steel, x, 0, z, 0.05, 0.72, 6); solid(x - 0.55, z - 0.55, x + 0.55, z + 0.55, 0, 0.76);
				for (const [dx, dz] of [[0, 0.9], [0, -0.9]]) { bb(M.velvet, x + dx - 0.22, 0, z + dz - 0.22, x + dx + 0.22, 0.46, z + dz + 0.22); bb(M.velvet, x + dx - 0.22, 0.46, z + dz * 1.22 - 0.04, x + dx + 0.22, 0.95, z + dz * 1.22 + 0.04); sit(x + dx, z + dz, face(-dx, -dz), 0.46, work('diner', 'buffet')); }
			}
			sign('THE BUFFET', cx - 0.5, L.h - 0.7, 0, 5, 0.55, -Math.PI / 2);
		}
		// the slot banks: every place for a machine pair on the floor, the nearest the middle kept,
		// in rows back to back, a bank of eight then a way through
		// (MAX pairs of machines, back to back)
		const MAX = phone ? 70 : 150, P = 0.8, ROW = 4.8, mid = (z0 + z1) / 2;
		const cand = [];
		for (let rz = z0 + 1.7, r = 0; rz < z1 - 1.7; rz += ROW, r++) {
			let run = 0;
			for (let x = -gx + P / 2; x <= gx - P / 2; x += P) {
				if (!free(x - P / 2, rz - 1.8, x + P / 2, rz + 1.8)) { run = 0; continue; }
				if (run++ % 10 >= 8) continue;
				cand.push({ x, rz, r, d: Math.abs(x) * 0.8 + Math.abs(rz - mid) });
			}
		}
		cand.sort((a, b) => a.d - b.d);
		const took = cand.slice(0, MAX).sort((a, b) => a.r - b.r || a.x - b.x);
		let bank = null;
		const endBank = () => {
			if (!bank) return;
			const { xa, xb, rz, k } = bank, m = NEON[k % NEON.length];
			solid(xa - P / 2, rz - 0.66, xb + P / 2, rz + 0.66, 0, 2.3);
			for (const s of [-1, 1]) bb(M.casinoWall, (s < 0 ? xa - P / 2 - 0.08 : xb + P / 2), 0, rz - 0.7, (s < 0 ? xa - P / 2 : xb + P / 2 + 0.08), 2.0, rz + 0.7);
			bb(m, xa - P / 2, 2.32, rz - 0.06, xb + P / 2, 2.62, rz + 0.06);
			bank = null;
		};
		for (const q of took) {
			if (bank && (bank.r !== q.r || q.x - bank.xb > P * 1.01)) endBank();
			if (!bank) bank = { xa: q.x, xb: q.x, rz: q.rz, r: q.r, k: Math.floor(H(q.x, q.rz) * 7) };
			bank.xb = q.x;
			const { x, rz } = q, tile = H(x * 1.3, rz) < 0.5 ? TILE.slot7 : TILE.slotFruit;
			for (const f of [-1, 1]) {
				bb(M.casinoWall, x - 0.37, 0, rz, x + 0.37, 1.04, rz + f * 0.62);
				bb(M.casinoWall, x - 0.36, 1.04, rz + f * 0.04, x + 0.36, 2.0, rz + f * 0.42);
				pic(M.slotScreens, x, 1.48, rz + f * 0.425, 0.6, 0.36, tile, f > 0 ? 0 : Math.PI);
				bb(NEON[bank.k % NEON.length], x - 0.32, 1.04, rz + f * 0.5, x - 0.2, 1.07, rz + f * 0.6);
				const sz = rz + f * 1.12;
				cyl(M.rail, x, 0.6, sz, 0.2, 0.08, 6, false); bb(M.steel, x - 0.03, 0, sz - 0.03, x + 0.03, 0.6, sz + 0.03);
				sit(x, sz, face(0, -f), 0.68, work('gambler', 'slots:' + q.r + ':' + Math.round(bank.xa)));
				perk('slots', x, rz + f * 1.25);
				stats.slots++;
			}
		}
		endBank();
		// signs down the aisle: the casino's name over it, the way to the cage and the lifts
		if (T.name) for (const [zz, yaw] of [[z1 - 0.5, 0], [z1 - 0.54, Math.PI]]) sign(T.name.toUpperCase(), 0, L.h - 0.7, zz, Math.min(8, 2 * A + 2), 0.6, yaw);
		sign('CAGE · ELEVATORS · SHOWROOM', 0, 2.85, cz + 0.08, Math.min(6, T.coreW - 0.4), 0.38, 0);
	}

	// ---------- the showroom ----------
	function showroom() {
		const sw = Math.min(hw - 3, 15), s0 = hd - 8.5, top = L.h - 0.3, sh = 1.05, tw = Math.min(hw, sw + 8);
		// (a wide block: the house's own walls either side of it)
		if (hw > tw + 0.5) for (const s of [-1, 1]) bb(M.casinoWall, s * tw, 0, cz + 2.6, s * (tw + 0.2), L.h - 0.25, hd, true);
		bb(M.oak, -sw, 0, s0, sw, sh, hd - 0.4, true);
		bb(M.dark, -sw, 0, s0 - 0.02, sw, sh - 0.05, s0);
		// the proscenium: its sides and header, the curtain drawn back, the screen behind
		for (const s of [-1, 1]) {
			bb(M.casinoWall, s * sw, 0, s0 - 0.4, s * (sw + 1.6), top, s0 + 0.3, true);
			bb(M.velvet, s * (sw - 2.4), sh, s0 + 0.35, s * sw, Math.min(top, 7.5), s0 + 0.6);
		}
		bb(M.casinoWall, -sw - 1.6, Math.min(top - 0.6, 7.6), s0 - 0.4, sw + 1.6, top, s0 + 0.3);
		bb(M.velvet, -sw, sh, hd - 1.1, sw, Math.min(top, 7.5), hd - 0.9);
		const vw = Math.min(2 * sw - 6, 12);
		pic(M.slotScreens, 0, sh + 0.6 + vw * 0.28, hd - 1.15, vw, vw * 0.5625, TILE.movie, Math.PI);
		// the lights on their truss over the front of the stage
		bb(M.steel, -sw, Math.min(top - 1.2, 6.2), s0 - 3.05, sw, Math.min(top - 1.0, 6.4), s0 - 2.85);
		for (let x = -sw + 1; x < sw; x += 2) cyl(M.glow, x, Math.min(top - 1.6, 5.8), s0 - 2.95, 0.16, 0.38, 10);
		// the seats: rows facing the stage, the aisles down the middle and either side
		const MAX = phone ? 220 : 380, z0 = cz + 4.5, z1 = s0 - 2.4, ax = Math.max(4, sw * 0.6);
		let n = 0;
		const xs = tw - 1.6;
		for (let z = z1; z > z0 && n < MAX; z -= 1.0) {
			let ra = null, rb = null;
			// (the row's backs: in front of them, over the seats, a way along the row)
			const endRow = () => { if (ra !== null) solid(ra - 0.28, z - 0.32, rb + 0.28, z - 0.18, 0, 0.98); ra = rb = null; };
			for (let x = -xs; x <= xs && n < MAX; x += 0.62) {
				if (Math.abs(x) < 0.9 || Math.abs(Math.abs(x) - ax) < 0.7) { endRow(); continue; }
				if (ra === null) ra = x;
				rb = x;
				bb(M.velvet, x - 0.27, 0.12, z - 0.24, x + 0.27, 0.45, z + 0.24);
				bb(M.velvet, x - 0.27, 0.45, z - 0.3, x + 0.27, 0.98, z - 0.2);
				bb(M.dark, x - 0.3, 0, z - 0.3, x - 0.25, 0.68, z + 0.22);
				sit(x, z + 0.02, face(0, 1), 0.46, work('audience', 'show'));
				n++;
			}
			endRow();
		}
		stats.seats = n;
		sign('SHOWROOM · TONIGHT 8 & 10:30 PM', 0, 2.85, cz + 0.08, Math.min(6, T.coreW - 0.4), 0.38, 0);
		if (T.name) sign(T.name.toUpperCase() + ' SHOWROOM', 0, Math.min(top - 0.3, 8.2), s0 - 0.42, Math.min(10, 2 * sw), 0.6, Math.PI);
	}

	// ---------- the hotel ----------
	// the lobby: the front desk along the left wall, the bell desk and the luggage carts by the
	// doors, sofas and armchairs on the right, a chandelier over the middle
	function lobby() {
		const dx = -hw + 2.6, dz0 = cz + 2.5, dz1 = Math.min(hd - 4.5, dz0 + Math.min(14, (hd - cz) * 0.6));
		bb(M.oak, -hw + 0.3, 0, dz0 - 0.6, -hw + 0.45, L.h - 0.3, dz1 + 0.6);
		bb(M.oak, dx - 0.35, 0, dz0, dx + 0.35, 1.1, dz1, true); bb(M.stoneD, dx - 0.42, 1.1, dz0 - 0.05, dx + 0.42, 1.16, dz1 + 0.05);
		bb(M.gold, dx + 0.35, 0.95, dz0, dx + 0.37, 1.0, dz1);
		for (let z = dz0 + 1.2; z < dz1 - 0.8; z += 2.4) {
			bb(M.dark, dx - 0.3, 1.16, z - 0.24, dx - 0.27, 1.5, z + 0.24);
			stand(dx - 1.05, z, face(1, 0), work('front desk', 'desk'));
			stand(dx + 1.35, z, face(-1, 0), work('checking in', 'desk', { routineOnly: true }));
		}
		sign(T.name ? T.name.toUpperCase() : 'FRONT DESK', -hw + 0.47, Math.min(L.h - 0.9, 3.6), (dz0 + dz1) / 2, Math.min(6, dz1 - dz0), 0.6, Math.PI / 2);
		sign('FRONT DESK · CHECK-IN', -hw + 0.47, 2.55, (dz0 + dz1) / 2, Math.min(4, dz1 - dz0), 0.32, Math.PI / 2);
		// the bell desk and two carts inside the doors on the right
		const bx = Math.min(hw - 3, 6);
		bb(M.oak, bx - 0.7, 0, hd - 3.4, bx + 0.7, 1.05, hd - 2.8, true);
		stand(bx, hd - 2.3, face(0, -1), work('bell captain', 'bell'));
		for (const x of [bx + 1.8, bx + 3.0]) if (x < hw - 1) {
			bb(M.gold, x - 0.45, 0.25, hd - 4.4, x + 0.45, 0.3, hd - 3.6, true);
			for (const [a, b] of [[-0.43, -0.39], [0.39, 0.43]]) bb(M.gold, x + a, 0.3, hd - 4.0 - 0.02, x + b, 1.9, hd - 4.0 + 0.02);
			bb(M.gold, x - 0.43, 1.86, hd - 4.02, x + 0.43, 1.9, hd - 3.98);
			bb(M.throw, x - 0.3, 0.3, hd - 4.3, x + 0.05, 0.9, hd - 3.9); bb(M.sofa2, x + 0.05, 0.3, hd - 4.3, x + 0.35, 0.75, hd - 3.8);
		}
		// the seating on the right
		for (let z = cz + 5; z < hd - 6; z += 4.2) for (let x = 4; x < hw - 2.5; x += 5) {
			bb(M.stoneD, x - 0.6, 0, z - 0.4, x + 0.6, 0.4, z + 0.4, true);
			for (const s of [-1, 1]) {
				bb(M.velvet, x - 1.0, 0.1, z + s * 1.0 - 0.4, x + 1.0, 0.44, z + s * 1.0 + 0.4, true); bb(M.velvet, x - 1.0, 0.44, z + s * 1.32 - 0.08, x + 1.0, 0.9, z + s * 1.32 + 0.08);
				for (const d of [-0.5, 0.5]) sit(x + d, z + s * 1.0, face(0, -s), 0.46, work('guest', 'lounge'));
			}
			B.plant?.(x + 1.6, z);
		}
		cyl(M.glow, 0, L.h - 1.5, (cz + hd) / 2, Math.min(2.2, hw * 0.2), 0.4, 20); cyl(M.gold, 0, L.h - 1.1, (cz + hd) / 2, 0.05, 0.85, 6);
		sign('ELEVATORS · GUEST ROOMS 1–' + (T.levels.length - 2), 0, Math.min(L.h - 0.9, 3.4), cz + 0.08, Math.min(5, T.coreW - 0.4), 0.38, 0);
	}
	// a guest floor: the corridor from the lifts across the tower, the rooms off both sides
	function rooms() {
		const C = 1.1, top = L.h - 0.25, rw = L.suite ? 7.6 : 4.4, n = Math.max(1, Math.floor(2 * hw / rw)), x0 = -n * rw / 2;
		// (the rooms' edges: the end ones out to the windows)
		const edge = (i) => (i <= 0 ? -hw : i >= n ? hw : x0 + i * rw);
		const busy = new Set([Math.floor(H(1, 2) * n * 2), Math.floor(H(3, 4) * n * 2)]);
		let lx0 = -cw - 1, lx1 = cw + 1, num = 0;
		const no = (k) => String(L.n) + String(k).padStart(2, '0');
		// a room: partitions, the corridor wall and its door, the bathroom by the door, the bed
		// against the far partition, the desk and the screen across from it, the window's curtains
		function room(ra, rb, f, k) {
			const zw = f * C, zf = f * hd, span = hd - C, open = busy.has(k), zm = zw + f * (2.6 + (span - 2.6) * 0.45);
			if (ra > -hw + 0.1) bb(M.wall, ra - 0.06, 0, zw, ra + 0.06, top, zf, true);
			bb(M.wall, ra, 0, zw - 0.06, ra + 0.35, top, zw + 0.06, true); bb(M.wall, ra + 1.3, 0, zw - 0.06, rb, top, zw + 0.06, true); bb(M.wall, ra + 0.35, 2.15, zw - 0.06, ra + 1.3, top, zw + 0.06);
			if (open) bb(M.oak, ra + 0.35, 0, zw + f * 0.04, ra + 0.41, 2.12, zw + f * 0.98, true);
			else bb(M.oak, ra + 0.35, 0, zw - 0.035, ra + 1.3, 2.12, zw + 0.035, true);
			bb(M.gold, ra + 1.38, 1.45, zw - f * 0.07, ra + 1.52, 1.55, zw - f * 0.06);
			// the bathroom
			const bz = zw + f * 2.6;
			bb(M.wall, ra + 1.4, 0, zw, ra + 1.52, top, zw + f * 0.9, true); bb(M.wall, ra + 1.4, 0, zw + f * 1.75, ra + 1.52, top, bz, true);
			bb(M.wall, ra + 1.4, 0, bz - 0.06, rb, top, bz + 0.06, true);
			bb(M.bed, rb - 0.82, 0, zw + f * 0.15, rb - 0.1, 0.55, zw + f * 1.8, true); bb(M.stone, ra + 1.55, 0, bz - f * 0.6, ra + 2.6, 0.85, bz - f * 0.1, true);
			// the bed, its tables and their lamps
			const bed = L.suite ? 1.0 : 0.9;
			bb(M.dark, rb - 2.15, 0, zm - bed, rb - 0.08, 0.42, zm + bed, true);
			bb(M.bed, rb - 2.12, 0.42, zm - bed + 0.02, rb - 0.32, 0.6, zm + bed - 0.02);
			bb(M.bed, rb - 0.55, 0.6, zm - bed + 0.1, rb - 0.15, 0.74, zm + bed - 0.1);
			bb(M.throw, rb - 2.14, 0.6, zm - bed, rb - 1.65, 0.61, zm + bed);
			bb(M.velvet, rb - 0.16, 0, zm - bed - 0.25, rb - 0.07, 1.4, zm + bed + 0.25);
			for (const s of [-1, 1]) { bb(M.oak, rb - 0.55, 0, zm + s * (bed + 0.3) - 0.24, rb - 0.08, 0.55, zm + s * (bed + 0.3) + 0.24, true); cyl(M.shade || M.glow, rb - 0.32, 0.55, zm + s * (bed + 0.3), 0.11, 0.34, 8); }
			// the desk, its chair, the screen on the wall over the dresser
			bb(M.oak, ra + 0.06, 0.72, zm - 0.75, ra + 0.62, 0.76, zm + 0.75, true);
			bb(M.oak, ra + 0.06, 0, zm + f * 0.9, ra + 0.55, 0.8, zm + f * 2.1, true);
			bb(M.dark, ra + 0.07, 1.15, zm + f * 0.95 - 0.55 * f, ra + 0.11, 1.8, zm + f * 2.05);
			bb(M.sofa, ra + 0.75, 0, zm - 0.25, ra + 1.2, 0.48, zm + 0.25);
			// the armchair by the window and its curtains (a suite's sofa and a table for two)
			const wz = zf - f * 1.1;
			if (L.suite) { bb(M.sofa2, ra + 0.6, 0.1, wz - 0.45, ra + 2.6, 0.44, wz + 0.45, true); bb(M.oak, ra + 3.2, 0.72, wz - 0.5, ra + 4.2, 0.76, wz + 0.5, true); }
			else bb(M.sofa2, ra + 0.6, 0.1, wz - 0.4, ra + 1.4, 0.44, wz + 0.4, true);
			for (const x of [ra + 0.12, rb - 0.75]) bb(M.throw, x, 0.1, zf - f * 0.2, x + 0.6, top - 0.1, zf - f * 0.12);
			stats.rooms++;
			// (a room being made up: the cart outside, the housekeeper at it)
			if (open) {
				bb(M.steel, ra + 1.45, 0.12, zw - f * 0.3, ra + 2.65, 1.1, zw - f * 0.85, true);
				bb(M.bed, ra + 1.5, 1.1, zw - f * 0.35, ra + 2.6, 1.3, zw - f * 0.8);
				stand(ra + 3.0, zw - f * 0.55, face(-1, 0), work('housekeeping', 'room' + no(k), { routineOnly: true }));
				sit(rb - 1.3, zm + f * (bed + 0.05), face(0, f), 0.5, work('guest', 'room' + no(k)));
			}
		}
		for (const f of [1, -1]) for (let i = 0; i < n; i++) {
			const ra = edge(i), rb = edge(i + 1);
			if (f < 0 && rb > -cw - 1 && ra < cw + 1) { if (ra < 0) lx0 = Math.min(lx0, ra); if (rb > 0) lx1 = Math.max(lx1, rb); continue; }
			room(ra, rb, f, f > 0 ? ++num : n + i + 1);
		}
		// the lift lobby: its walls back to the core, the ice and the vending machine in it
		for (const x of [lx0, lx1]) bb(M.wall, x - 0.06, 0, -hd, x + 0.06, top, -C, true);
		if (lx1 - cw > 1.6) {
			const vx = (cw + lx1) / 2 + 0.1;
			bb(M.art[1], vx - 0.45, 0, -C - 0.85, vx + 0.45, 1.85, -C - 0.05, true); bb(M.shade || M.glow, vx - 0.38, 0.62, -C - 0.86, vx + 0.16, 1.76, -C - 0.84);
			perk('vending', vx, -C + 0.3);
		}
		if (cw - lx0 > 1.6) { const ix = (lx0 - cw) / 2 - 0.1; bb(M.steel, ix - 0.4, 0, -C - 0.8, ix + 0.4, 1.3, -C - 0.05, true); bb(M.dark, ix - 0.25, 0.6, -C - 0.81, ix + 0.25, 0.9, -C - 0.79); }
		// the corridor's ends at the windows, sconces down its walls
		for (let x = x0 + 2.2; x < -x0 - 1; x += 4.4) for (const f of [1, -1]) bb(M.shade || M.glow, x - 0.1, 1.8, f * (C - 0.08), x + 0.1, 2.1, f * (C - 0.06));
		sign(`FLOOR ${L.n} · ROOMS ${no(1)}–${no(2 * n)}`, 0, 2.75, cz + 0.08, Math.min(4, T.coreW - 0.4), 0.3, 0);
	}

	if (L.kind === 'casino') casino();
	else if (L.kind === 'showroom') showroom();
	else if (L.kind === 'lobby') lobby();
	else if (L.kind === 'hotel') rooms();
	flush();
	return stats;
}
