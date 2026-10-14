// A damaged building as it stands: the far box (city.js) taken away and in its place its
// walls as a shell of panels, a storey's spandrel, window and head to each row, with what is
// gone left out: holes blown or punched through (ragged at their edges, the wall's thickness
// showing round them, soot round the worst), the upper storeys of a partial collapse gone on a
// slant with a floor slab pancaked down into the gap, or nothing but stubs of wall over the
// mound of a full one; the rubble heaped where it fell, slabs and blocks lying on it. Inside,
// through the holes: dark rooms and the floors. A rebuild puts it back storey by storey: the
// rubble cleared, the new work bare concrete until it is finished and glazed.
//
// buildShell(o, rec, p) returns the geometry (one mesh, vertex colours, in the lot's frame with
// its foot at y 0), the boxes that stop you (lot frame), and the rubble's height for walking.

import * as THREE from 'three';
import { FACES, onFace, faceLen, hash } from './ids.js';

const lin = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
const CORE = [0.36, 0.35, 0.33], DARK = [0.035, 0.035, 0.04], SOOT = [0.06, 0.055, 0.05], RAW = [0.42, 0.42, 0.4], GLASS = [0.05, 0.08, 0.1], REBAR = [0.12, 0.08, 0.06];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the storey of a kind of building, and how much of its face is glass
export function facadeOf(o) {
	const k = Math.floor(o.kind), src = o.src?.kind;
	const tower = k === 2 || src === 11, office = k === 3 || src === 5 || src === 12, shop = k === 9 || k === 6 || src === 6;
	return { storey: tower || office ? 3.6 : shop ? 3.4 : 3.0, curtain: tower || (office && !o.roof), shop, house: !!o.roof };
}

// the rubble's height above the foot at (lx, lz), for a damage record (and how far the
// clearing has gone, k from 1 down to 0)
export function rubbleAt(o, rec, lx, lz, k = 1) {
	if (k <= 0) return 0;
	let h = 0;
	const H = o.h - 1.2, c = rec.c || 0;
	if (c > 0) {
		const m = Math.min(7, 1.2 + H * c * 0.22), peak = Math.min(H * 0.45, Math.max(0.6, H * c * 0.32 + 0.4));
		const ex = Math.max(0, Math.abs(lx) - o.w / 2), ez = Math.max(0, Math.abs(lz) - o.d / 2);
		const edge = 1 - smooth(0, m, Math.hypot(ex, ez));
		const inner = smooth(0, Math.min(o.w, o.d) * 0.35, Math.min(o.w / 2 - Math.abs(lx), o.d / 2 - Math.abs(lz)) + m * 0.4);
		h = peak * edge * (0.45 + 0.55 * inner) * (0.78 + 0.4 * hash(Math.round(lx / 2), Math.round(lz / 2) + (rec.s || 0)));
	}
	for (const [f, u, y, r] of rec.m || []) {
		const [px, pz] = onFace(o, f, u), d = Math.hypot(lx - px, lz - pz), R = r * 1.3;
		if (d < R && y - r < 2.5) h = Math.max(h, (1 - d / R) * Math.min(1.2, r * 0.45));
	}
	return h * k;
}

export function buildShell(o, rec, p = null) {
	const pos = [], nor = [], col = [];
	const H = o.h - 1.2, F = facadeOf(o), st = F.storey, wall = lin(o.col || [0.7, 0.68, 0.64]);
	const seed = rec.s || 0;
	// the rebuild: how much rubble is left (k), how high the new work has risen
	const clearK = p === null ? 1 : 1 - smooth(0, 0.12, p);
	const rise = p === null ? -1 : smooth(0.3, 0.85, p);
	const glazed = p !== null && p > 0.9;
	const restored = rise < 0 ? -1e9 : Math.floor(rise * H / st + 1e-6) * st + (rise >= 1 ? 1e9 : 0);
	// how high the wall stands at a point of the outline (collapse), local frame
	const c = rec.c || 0, dirA = (seed % 628) / 100, dx = Math.cos(dirA), dz = Math.sin(dirA), Rr = Math.hypot(o.w, o.d) / 2;
	const standing = (lx, lz) => {
		if (c <= 0) return H;
		const jag = (hash(Math.round(lx * 1.3) + seed, Math.round(lz * 1.3)) - 0.5) * Math.min(2.2, st * 0.7);
		let h = c >= 0.85 ? 0.8 + hash(Math.round(lx / 1.7), Math.round(lz / 1.7) + seed) * Math.min(2.6, H * 0.25) : H * (1 - c) + (dx * lx + dz * lz) / Rr * H * c * 0.55 + jag;
		if (restored > -1e8) h = Math.max(h, Math.min(H, restored));
		return Math.min(H, Math.max(0.4, h));
	};
	const holes = (rec.m || []).map(([f, u, y, r]) => { const [hx, hz] = onFace(o, f, u); return [hx, y, hz, r]; });
	const holed = (lx, y, lz, salt) => {
		if (y < restored) return false;
		for (const [hx, hy, hz, r] of holes) { const k = 0.78 + 0.45 * hash(salt, Math.round(y * 3) + seed); if (Math.hypot(lx - hx, y - hy, lz - hz) < r * k) return true; }
		return false;
	};
	const near = (lx, y, lz) => { let m = 1e9; for (const [hx, hy, hz, r] of holes) m = Math.min(m, Math.hypot(lx - hx, y - hy, lz - hz) - r); return m; };
	const quad = (a, b, c2, d, n, cl) => {
		pos.push(...a, ...b, ...c2, ...a, ...c2, ...d);
		for (let i = 0; i < 6; i++) { nor.push(n[0], n[1], n[2]); col.push(cl[0], cl[1], cl[2]); }
	};
	const shade = (cl, k) => [cl[0] * k, cl[1] * k, cl[2] * k];
	const T = 0.3;            // the wall's thickness
	const colBoxes = [];
	// ---------- the four faces ----------
	for (let f = 0; f < 4; f++) {
		const L = faceLen(o, f), [nx, nz] = FACES[f], tx = nz, tz = -nx;
		const nCol = Math.max(1, Math.round(L / 1.6)), cw = L / nCol;
		// (rows: each storey spandrel, window, head; a huge face is drawn a row a storey)
		const rows = [];
		const nSt = Math.max(1, Math.ceil(H / st)), fine = nCol * nSt * 3 < 2600;
		rows.push([-1.2, 0, 'base']);
		for (let k = 0; k < nSt; k++) {
			const y0 = k * st, y1 = Math.min(H, (k + 1) * st);
			if (y1 - y0 < 0.2) break;
			if (fine && y1 - y0 > st * 0.8) { rows.push([y0, y0 + st * 0.28, 'spandrel']); rows.push([y0 + st * 0.28, y0 + st * 0.76, 'window']); rows.push([y0 + st * 0.76, y1, 'head']); }
			else rows.push([y0, y1, 'window']);
		}
		const keep = [];
		for (let i = 0; i < nCol; i++) {
			const u0 = -L / 2 + i * cw, u1 = u0 + cw, um = (u0 + u1) / 2;
			const [cx, cz] = onFace(o, f, um), top = standing(cx, cz);
			const colKeep = [];
			for (let r = 0; r < rows.length; r++) {
				let [y0, y1, kind] = rows[r];
				if (y0 >= top - 0.05) { colKeep.push(null); continue; }
				y1 = Math.min(y1, top);
				const ym = (y0 + y1) / 2, gone = kind !== 'base' && holed(cx, ym, cz, i * 31 + f * 7 + r);
				colKeep.push(gone ? null : [y0, y1, kind]);
			}
			keep.push({ u0, u1, um, cx, cz, top, rows: colKeep });
		}
		// the panels, their inner faces, and the wall's thickness where a neighbour is gone
		const P = (u, y, inset) => { const [lx, lz] = onFace(o, f, u); return [lx - nx * inset, y, lz - nz * inset]; };
		const n0 = [nx, 0, nz], nIn = [-nx, 0, -nz];
		for (let i = 0; i < nCol; i++) {
			const C = keep[i];
			for (let r = 0; r < C.rows.length; r++) {
				const cell = C.rows[r];
				if (!cell) continue;
				const [y0, y1, kind] = cell;
				const dmg = near(C.cx, (y0 + y1) / 2, C.cz);
				const newWork = restored > -1e8 && y0 >= restored - st - 0.01 && rise < 1;
				const winCol = F.curtain || (F.shop && y0 < st) || i % 2 === (F.house ? 0 : 1) || nCol < 3;
				let cl = kind === 'window' && winCol ? (newWork && !glazed ? DARK : dmg < 2.5 || (rec.c && y1 > C.top - 0.5) ? DARK : GLASS) : newWork ? RAW : shade(wall, 0.9 + hash(i + f * 13, r) * 0.16);
				if (kind === 'spandrel' && F.curtain && !newWork) cl = shade(wall, 0.55);
				if (dmg < 1.6 && !newWork) cl = shade(cl === GLASS ? DARK : cl, 0.35 + Math.max(0, dmg) * 0.35);
				// (soot rising above a blast)
				if (dmg < 4 && !newWork && holes.some(([hx, hy, hz, rr]) => (y0 > hy && Math.hypot(C.cx - hx, C.cz - hz) < rr * 1.4))) cl = [cl[0] * 0.55 + SOOT[0] * 0.45, cl[1] * 0.55 + SOOT[1] * 0.45, cl[2] * 0.55 + SOOT[2] * 0.45];
				quad(P(C.u0, y0, 0), P(C.u1, y0, 0), P(C.u1, y1, 0), P(C.u0, y1, 0), n0, cl);
				quad(P(C.u1, y0, T), P(C.u0, y0, T), P(C.u0, y1, T), P(C.u1, y1, T), nIn, DARK);
				// the broken edges: left, right, below, above
				const left = i > 0 ? keep[i - 1].rows[r] : true, right = i < nCol - 1 ? keep[i + 1].rows[r] : true;
				const below = r > 0 ? C.rows[r - 1] : true, above = r < C.rows.length - 1 ? C.rows[r + 1] : null;
				if (!left) quad(P(C.u0, y0, T), P(C.u0, y0, 0), P(C.u0, y1, 0), P(C.u0, y1, T), [-tx, 0, -tz], CORE);
				if (!right) quad(P(C.u1, y0, 0), P(C.u1, y0, T), P(C.u1, y1, T), P(C.u1, y1, 0), [tx, 0, tz], CORE);
				if (!below) quad(P(C.u0, y0, T), P(C.u1, y0, T), P(C.u1, y0, 0), P(C.u0, y0, 0), [0, -1, 0], CORE);
				if (!above) quad(P(C.u0, y1, 0), P(C.u1, y1, 0), P(C.u1, y1, T), P(C.u0, y1, T), [0, 1, 0], y1 >= H - 0.01 ? shade(wall, 0.7) : CORE);
			}
		}
		// what stops you: each column's wall from the ground to its first gap (a gap at the
		// foot is a way in), runs of equal height together
		let run = null;
		const flush = () => { if (run) { colBoxes.push([f, run.u0, run.u1, run.h]); run = null; } };
		for (const C of keep) {
			let h = -1.2;
			for (const cell of C.rows) { if (!cell || cell[0] > h + 0.05) break; h = cell[1]; }
			if (h < 0.7) { flush(); continue; }
			if (run && Math.abs(run.h - h) < 0.3) { run.u1 = C.u1; run.h = Math.min(run.h, h); } else { flush(); run = { u0: C.u0, u1: C.u1, h }; }
		}
		flush();
	}
	// ---------- the floors inside, and a slab pancaked into a partial collapse ----------
	const hw = o.w / 2 - T, hd = o.d / 2 - T;
	let minTop = H;
	for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, 0]]) minTop = Math.min(minTop, standing(lx, lz));
	for (let y = st; y < minTop - 0.3; y += st) {
		const fl = shade(RAW, 0.6);
		quad([-hw, y, hd], [hw, y, hd], [hw, y, -hd], [-hw, y, -hd], [0, 1, 0], fl);
		quad([-hw, y - 0.25, -hd], [hw, y - 0.25, -hd], [hw, y - 0.25, hd], [-hw, y - 0.25, hd], [0, -1, 0], DARK);
	}
	if (c > 0 && c < 0.85 && rise < 1) {
		// (falling away from the high side, its far edge down in the rubble)
		const hi = H * (1 - c) + H * c * 0.4, lo = rubbleAt(o, rec, -dx * hw, -dz * hd, clearK) + 0.3;
		const a = [dx * hw - dz * hd, dz * hw + dx * hd], b = [dx * hw + dz * hd, dz * hw - dx * hd];
		const a2 = [-dx * hw - dz * hd * 0.8, -dz * hw + dx * hd * 0.8], b2 = [-dx * hw + dz * hd * 0.8, -dz * hw - dx * hd * 0.8];
		const ny = Math.hypot(hw * 2, hi - lo), n = [-dx * (hi - lo) / ny, (2 * hw) / ny, -dz * (hi - lo) / ny];
		quad([a[0], Math.min(hi, minTop + st), a[1]], [b[0], Math.min(hi, minTop + st), b[1]], [b2[0], lo, b2[1]], [a2[0], lo, a2[1]], n, shade(RAW, 0.75));
		quad([a2[0], lo - 0.25, a2[1]], [b2[0], lo - 0.25, b2[1]], [b[0], Math.min(hi, minTop + st) - 0.25, b[1]], [a[0], Math.min(hi, minTop + st) - 0.25, a[1]], [-n[0], -n[1], -n[2]], DARK);
	}
	// the roof, while there is one: flat (its parapet the walls' tops) or pitched over a house
	if (c <= 0) {
		const yT = H;
		if (o.roof && o.roof.h > 0.2) {
			const rc = lin(o.roof.col || [0.3, 0.3, 0.32]), ov = 0.3, rh = o.roof.h;
			const along = o.roof.rot ? 'z' : 'x', A = (along === 'x' ? o.w : o.d) / 2 + ov, B = (along === 'x' ? o.d : o.w) / 2 + ov;
			const ridge = o.roof.hip ? Math.max(0, A - B) : A;
			const W2 = (a, b, y) => (along === 'x' ? [a, y, b] : [b, y, a]);
			for (const s of [-1, 1]) {
				const n = along === 'x' ? [0, B, s * rh] : [s * rh, B, 0], l = Math.hypot(...n), nn = n.map((v) => v / l);
				quad(W2(-A, s * B, yT), W2(A, s * B, yT), W2(ridge, 0, yT + rh), W2(-ridge, 0, yT + rh), s > 0 ? nn : nn, shade(rc, 0.95));
				if (o.roof.hip) { const m = along === 'x' ? [s * rh, A - ridge, 0] : [0, A - ridge, s * rh], ml = Math.hypot(...m) || 1; quad(W2(s * A, s * B, yT), W2(s * A, -s * B, yT), W2(s * ridge, 0, yT + rh), W2(s * ridge, 0, yT + rh), m.map((v) => v / ml), shade(rc, 0.85)); }
				else quad(W2(s * A, -B, yT), W2(s * A, B, yT), W2(s * A, 0, yT + rh), W2(s * A, 0, yT + rh), along === 'x' ? [s, 0, 0] : [0, 0, s], shade(wall, 0.85));
			}
		} else quad([-o.w / 2, yT, o.d / 2], [o.w / 2, yT, o.d / 2], [o.w / 2, yT, -o.d / 2], [-o.w / 2, yT, -o.d / 2], [0, 1, 0], shade(wall, 0.55));
	}
	// ---------- the rubble: its mound, and what lies on it ----------
	const rub = [];
	if (clearK > 0) {
		const m = c > 0 ? Math.min(7, 1.2 + H * c * 0.22) : 2.5, X0 = -o.w / 2 - m, X1 = o.w / 2 + m, Z0 = -o.d / 2 - m, Z1 = o.d / 2 + m;
		const N = Math.max(4, Math.min(18, Math.round(Math.max(X1 - X0, Z1 - Z0) / 2.5)));
		const hAt = (x, z) => rubbleAt(o, rec, x, z, clearK);
		const dust = [0.5, 0.48, 0.44];
		for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
			const x0 = X0 + (X1 - X0) * i / N, x1 = X0 + (X1 - X0) * (i + 1) / N, z0 = Z0 + (Z1 - Z0) * j / N, z1 = Z0 + (Z1 - Z0) * (j + 1) / N;
			const h00 = hAt(x0, z0), h10 = hAt(x1, z0), h11 = hAt(x1, z1), h01 = hAt(x0, z1);
			if (h00 + h10 + h11 + h01 < 0.04) continue;
			const ex = new THREE.Vector3(x1 - x0, h10 - h00, 0), ez = new THREE.Vector3(0, h01 - h00, z1 - z0), n = ez.cross(ex).normalize();
			const k = 0.75 + hash(i + seed, j) * 0.3;
			quad([x0, h00 - 0.05, z1 - (z1 - z0)], [x0, h01 - 0.05, z1], [x1, h11 - 0.05, z1], [x1, h10 - 0.05, z0], [n.x, n.y, n.z], [dust[0] * k, dust[1] * k, dust[2] * k]);
		}
		// blocks and slabs lying on it
		const nb = Math.min(140, Math.round((c > 0 ? 30 + H * c * 3 : 6 * (rec.m?.length || 0)) * clearK));
		for (let k = 0; k < nb; k++) {
			const r1 = hash(k * 3 + seed, 11), r2 = hash(k * 7, seed + 5), r3 = hash(k + 2, seed * 3 + 1);
			let x, z;
			if (c > 0) { x = X0 + r1 * (X1 - X0); z = Z0 + r2 * (Z1 - Z0); }
			else { const hl = rec.m[k % rec.m.length], [px, pz] = onFace(o, hl[0], hl[1]), a = r1 * Math.PI * 2, rr = r2 * hl[3] * 1.4; x = px + Math.cos(a) * rr; z = pz + Math.sin(a) * rr; }
			const y = hAt(x, z);
			if (y < 0.05 && c <= 0 && r3 < 0.3) continue;
			const s = 0.25 + Math.pow(r3, 2) * (c > 0 ? 2.4 : 0.9), slab = r3 > 0.75;
			const bw = s * (slab ? 2.2 : 1), bh = s * (slab ? 0.25 : 0.6 + r1 * 0.5), bd = s * (slab ? 1.6 : 0.8 + r2 * 0.5);
			const yaw = r1 * 6.28, tilt = (r2 - 0.5) * (slab ? 0.9 : 0.5), cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), stl = Math.sin(tilt);
			const cl = r3 < 0.08 ? REBAR : r2 < 0.5 ? shade(wall, 0.7 + r1 * 0.2) : shade(CORE, 1.1 + r1 * 0.4);
			rub.push([x, y, z, bw, bh, bd, yaw, tilt, cl]);
			// (a box turned by yaw about y and tilted about its own x)
			const V = (u, v, w) => { const v2 = v * ct - w * stl, w2 = v * stl + w * ct; return [x + u * cy - w2 * sy, y + v2 + bh * 0.3, z + u * sy + w2 * cy]; };
			const hx = bw / 2, hy = bh / 2, hz = bd / 2;
			const pts = [V(-hx, -hy, -hz), V(hx, -hy, -hz), V(hx, hy, -hz), V(-hx, hy, -hz), V(-hx, -hy, hz), V(hx, -hy, hz), V(hx, hy, hz), V(-hx, hy, hz)];
			const nrm = (a, b, c2) => { const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2 = new THREE.Vector3(c2[0] - a[0], c2[1] - a[1], c2[2] - a[2]); const n = e1.cross(e2).normalize(); return [n.x, n.y, n.z]; };
			for (const [a, b, c2, d, sh] of [[3, 2, 6, 7, 1], [4, 5, 1, 0, 0.5], [7, 6, 5, 4, 0.8], [0, 1, 2, 3, 0.75], [1, 5, 6, 2, 0.85], [4, 0, 3, 7, 0.7]]) quad(pts[a], pts[b], pts[c2], pts[d], nrm(pts[a], pts[b], pts[c2]), shade(cl, sh));
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	geo.computeBoundingSphere();
	// the boxes that stop you, in the lot's frame: [lx0, lz0, lx1, lz1, y0, y1]
	const solid = colBoxes.map(([f, u0, u1, h]) => {
		const [ax, az] = onFace(o, f, u0), [bx, bz] = onFace(o, f, u1), [nx, nz] = FACES[f];
		const ix = -nx * T, iz = -nz * T;
		return [Math.min(ax, bx, ax + ix, bx + ix), Math.min(az, bz, az + iz, bz + iz), Math.max(ax, bx, ax + ix, bx + ix), Math.max(az, bz, az + iz, bz + iz), -1.2, h];
	});
	return { geo, solid, rubble: (lx, lz) => rubbleAt(o, rec, lx, lz, clearK), standing, verts: pos.length / 3, blocks: rub.length };
}
