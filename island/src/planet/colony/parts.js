// The colony kit's pieces. Each builder sets its shapes out on a frame and drops them into
// the kit's buckets ('shell' for everything lit, 'glass' for the pressure glass), each
// shape with its tint and its look (mats.js: 0 hull, 1 printed, 2 windows, 3 regolith,
// 4 solar, 5 lamp, 6 running light, 7 coolant). X carries the kit (K), the style (S), the
// ground (H), the colliders (col), a random stream (r), the detail level (det) and the
// lists the colony draws apart: lamps' ground pools, plumes, solar and radiator mounts.

import * as THREE from 'three';
import { lathe, prism, box, cbox, ring, sweep, geodesic, geoPanes, blob, frame } from '../alienkit.js';

const TAU = Math.PI * 2;
const HULL = 0, PRINT = 1, WIN = 2, REG = 3, LAMP = 5, RUN = 6, COOL = 7;

const put = (X, F, mode, tint, g, lx, ly, lz, ry, rx, rz, s, near) => X.K.add('shell', F.put(g, lx, ly, lz, ry, rx, rz, s), { tint, glow: mode, near });
const glass = (X, F, g, lx, ly, lz, ry, rx) => X.K.add('glass', F.put(g, lx, ly, lz, ry, rx), {});
const pool = (X, x, z, y, r, c) => X.pools.push({ x, z, y, r, c });
// a horizontal cylinder along the frame's z
const tube = (r, len, sides) => new THREE.CylinderGeometry(r, r, len, sides).rotateX(Math.PI / 2);
// a mound of regolith along z: the cross-section of a berm, w across, h high, len long
function mound(w, h, len) {
	const s = new THREE.Shape();
	s.moveTo(-w / 2, -0.6); s.lineTo(-w * 0.3, h * 0.82); s.quadraticCurveTo(0, h * 1.08, w * 0.3, h * 0.82); s.lineTo(w / 2, -0.6); s.lineTo(-w / 2, -0.6);
	const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.2, bevelSegments: 2, curveSegments: 6 });
	return g.translate(0, 0, -len / 2);
}

// ---------- the hub ----------
// a pressure dome on a printed ring wall, banked with regolith; the modules round it
// half-buried, glass corridors out to them and to the printed towers between
export function hub(X, h) {
	const S = X.S, P = X.P, F = frame(h.x, h.y, h.z, h.yaw), det = X.det;
	const Rd = 15;
	// the ring wall and its berm
	put(X, F, PRINT, S.print, prism(24, Rd + 0.5, Rd + 0.3, 2.6));
	put(X, F, REG, S.berm, lathe([[Rd + 0.4, -0.5], [Rd + 0.6, 2.0], [Rd + 3.2, 1.3], [Rd + 7, -0.6]], 24, true));
	if (P.dome === 'glass') {
		const Fd = F.sub(0, 2.4, 0);
		put(X, Fd, HULL, S.trim, geodesic(Rd, det > 0.8 ? 2 : 1, 0.22));
		glass(X, Fd, geoPanes(Rd, det > 0.8 ? 2 : 1));
		// inside: growing beds under violet lamps, a printed core
		for (let i = 0; i < 6; i++) {
			const a = i / 6 * TAU;
			put(X, F, HULL, [0.18, 0.42, 0.16], cbox(2.2, 0.9, 7, 0.2), Math.sin(a) * 8, 2.9, Math.cos(a) * 8, a);
			put(X, F, LAMP, [0.9, 0.35, 1.0], box(0.25, 0.12, 6.4), Math.sin(a) * 8, 5.6, Math.cos(a) * 8, a, 0, 0, 1, true);
		}
		put(X, F, PRINT, S.print, prism(10, 3.4, 2.4, 11), 0, 2.4, 0);
		put(X, F, WIN, S.hull, prism(10, 3.45, 3.1, 2.4), 0, 6.8, 0);
		pool(X, h.x, h.z, h.y, Rd * 1.3, S.window.map((v) => v * 0.6));
	} else {
		// armour: a low faceted shell of shield tiles, its window slits in a band
		put(X, F, HULL, S.hull, lathe([[Rd, 0], [Rd, 1.6], [Rd * 0.86, 6.2], [Rd * 0.55, 9.6], [Rd * 0.2, 11], [0, 11.2]], 10, true, 0), 0, 2.4, 0);
		put(X, F, WIN, S.trim, prism(10, Rd + 0.06, Rd * 0.93, 2.2, 0, 0.05), 0, 3.9, 0);
		put(X, F, RUN, S.run, box(0.6, 0.6, 0.6), 0, 13.8, 0, 0, 0, 0, 1, true);
	}
	X.col.disc(h.x, h.z, Rd + 1.2, h.y + 13, { floor: false });
	// the modules, out along the spokes
	const mods = [];
	for (let i = 0; i < P.habs; i++) {
		const a = h.yaw + i / P.habs * TAU, L = 15 + X.r() * 7, d0 = Rd + 7, mid = d0 + L / 2;
		const M = frame(h.x, h.y, h.z, a);
		put(X, M, HULL, S.hull, tube(3.1, L * 0.7, 18 * det | 0), 0, 2.2, mid);
		// the exposed end: windows, an end cap, the airlock
		put(X, M, WIN, S.hull, tube(3.12, L * 0.3, 18 * det | 0), 0, 2.2, d0 + L * 0.85);
		put(X, M, HULL, S.trim, new THREE.CylinderGeometry(2.3, 3.1, 1.2, 18 * det | 0).rotateX(Math.PI / 2), 0, 2.2, d0 + L + 0.6);
		put(X, M, HULL, S.hull, cbox(2.4, 2.6, 2.6, 0.2), 0, 1.3, d0 + L + 2.2);
		put(X, M, HULL, S.accent, box(1.4, 2.1, 0.1), 0, 1.15, d0 + L + 3.52, 0, 0, 0, 1, true);
		put(X, M, RUN, S.run, box(0.3, 0.3, 0.3), 0, 2.9, d0 + L + 3.55, 0, 0, 0, 1, true);
		for (let k = 0; k < 3; k++) put(X, M, HULL, S.trim, ring(3.25, 0.4, 0.35, 18), 0, 2.2, d0 + L * (0.72 + k * 0.1), 0, Math.PI / 2, 0, 1, true);
		// banked over with regolith against the radiation, the far end left bare
		put(X, M, REG, S.berm, mound(11, 5.4, L * 0.66), 0, 0, d0 + L * 0.36);
		const door = M.p(0, 0, d0 + L + 6);
		pool(X, door.x, door.z, h.y, 7, S.window);
		X.doors.push({ x: door.x, z: door.z, a });
		const c = M.p(0, 0, mid);
		X.col.box(c.x, c.z, a, 6.6, L / 2 + 2.5, h.y + 5.6);
		mods.push({ a, d0, L });
		// the corridor from the dome to it
		corridor(X, M, Rd + 0.4, d0 + 0.2, h.y);
	}
	// the printed towers between the spokes, each with its corridor
	for (let i = 0; i < P.towers; i++) {
		const a = h.yaw + (i + 0.5) / Math.max(P.habs, P.towers) * TAU, d = Rd + 15;
		const T = frame(h.x, h.y, h.z, a);
		const at = T.p(0, 0, d);
		tower(X, frame(at.x, h.y, at.z, a), 22 + X.r() * 14);
		corridor(X, T, Rd + 0.4, d - 4.5, h.y);
	}
	// radiator fins on the far side of the modules (turned edge-on to the sun as it goes)
	for (let i = 0; i < P.radiators; i++) {
		const a = h.yaw + (i + 0.5) / P.habs * TAU + Math.PI / P.habs, d = Rd + 34;
		const Q = frame(h.x, h.y, h.z, a), p = Q.p(0, 0, d);
		for (let k = -1; k <= 1; k++) {
			const q = Q.p(k * 4.5, 0, d);
			X.radiators.push({ x: q.x, y: h.y, z: q.z });
			put(X, frame(q.x, h.y, q.z, a), HULL, S.trim, box(0.4, 3.2, 0.4), 0, 1.6, 0, 0, 0, 0, 1, true);
		}
		put(X, frame(p.x, h.y, p.z, a), PRINT, S.print, cbox(14, 0.8, 3, 0.2), 0, 0.2, 0);
	}
	// lamp masts round the ring road
	for (let k = 0; k < 10; k++) {
		const a = k / 10 * TAU + 0.15, p = F.p(Math.sin(a) * (h.r + 4), 0, Math.cos(a) * (h.r + 4)), y = X.H(p.x, p.z);
		const Fm = frame(p.x, y, p.z, a);
		put(X, Fm, HULL, S.trim, box(0.22, 6, 0.22), 0, 3, 0, 0, 0, 0, 1, true);
		put(X, Fm, LAMP, S.window, box(0.9, 0.25, 0.5), 0, 6.05, 0.2, 0, 0, 0, 1, true);
		pool(X, p.x, p.z, y, 9, S.window);
	}
	return mods;
}

// a pressurised corridor along a frame's z from z0 to z1: a ribbed walkway, glass overhead
export function corridor(X, F, z0, z1, y) {
	const S = X.S, len = z1 - z0, mid = (z0 + z1) / 2;
	const Fy = frame(F.x, y, F.z, F.yaw);
	put(X, Fy, HULL, S.hull, cbox(3.2, 1.3, len, 0.15), 0, 0.65, mid);
	glass(X, Fy, new THREE.CylinderGeometry(1.55, 1.55, len, 10, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), 0, 1.3, mid);
	put(X, Fy, LAMP, S.window, box(0.2, 0.06, len * 0.92), 0, 1.33, mid, 0, 0, 0, 1, true);
	const n = Math.max(1, Math.floor(len / 2.6));
	for (let k = 0; k <= n; k++) put(X, Fy, HULL, S.trim, new THREE.TorusGeometry(1.6, 0.09, 4, 12, Math.PI), 0, 1.3, z0 + len * k / n, 0, 0, 0, 1, true);
	const a = Fy.p(0, 0, z0), b = Fy.p(0, 0, z1);
	X.col.seg(a, b, 1.7, y + 3.0);
}

// a tower by the world's style: printed strata, a heat-shielded block, or a sealed spire
export function tower(X, F, h) {
	const S = X.S, kind = X.P.tower;
	if (kind === 'spire') {
		const H2 = h * 3;
		put(X, F, HULL, S.hull, lathe([[4.2, 0], [3.4, 5], [1.7, H2 * 0.55], [1.3, H2 * 0.88], [1.0, H2]], 12, false));
		for (let k = 0; k < 3; k++) {
			const a = k / 3 * TAU, foot = F.p(Math.sin(a) * 12, 0, Math.cos(a) * 12), top = F.p(Math.sin(a) * 2, H2 * 0.32, Math.cos(a) * 2);
			X.K.add('shell', sweep([foot, top], 0.45, 6, { seg: 2 }), { tint: S.trim, glow: HULL });
		}
		const Fp = F.sub(0, H2 * 0.86, 0);
		put(X, Fp, HULL, S.hull, blob(7.5, 5, 7.5, 10));
		put(X, Fp, WIN, S.hull, new THREE.CylinderGeometry(7.55, 7.55, 2.2, 20, 1, true));
		glass(X, Fp, blob(5.2, 3.6, 5.2, 10, 0), 0, 3.6, 0);
		put(X, F, RUN, S.run, box(0.6, 0.6, 0.6), 0, H2 + 0.4, 0, 0, 0, 0, 1, true);
		X.col.disc(F.x, F.z, 4.2, F.y + H2);
		return;
	}
	if (kind === 'shield') {
		put(X, F, HULL, S.hull, cbox(9, h, 9, 0.6), 0, h / 2, 0);
		for (let k = 0; k < 4; k++) {
			const a = k / 4 * TAU + Math.PI / 4;
			put(X, F, HULL, S.trim, cbox(0.8, h * 0.94, 3.2, 0.1), Math.sin(a) * 6.2, h * 0.47, Math.cos(a) * 6.2, a);
			const p0 = F.p(Math.sin(a) * 5.0, 0.3, Math.cos(a) * 5.0), p1 = F.p(Math.sin(a) * 5.0, h * 0.95, Math.cos(a) * 5.0);
			X.K.add('shell', sweep([p0, p1], 0.32, 6, { seg: 2 }), { tint: S.pipe || S.accent, glow: COOL });
		}
		for (let b = 0; b < 3; b++) put(X, F, WIN, S.trim, box(9.1, 1.4, 9.1), 0, h * (0.35 + b * 0.22), 0);
		put(X, F, RUN, S.run, box(0.6, 0.6, 0.6), 0, h + 1.2, 0, 0, 0, 0, 1, true);
		X.col.box(F.x, F.z, F.yaw, 4.6, 4.6, F.y + h);
		return;
	}
	// printed: a waisted column laid down in courses, window bands, a mast
	put(X, F, PRINT, S.print, lathe([[6.2, -0.5], [5.8, 3], [4.6, h * 0.45], [4.1, h * 0.8], [4.5, h * 0.92], [4.0, h], [0, h]], 14, false));
	for (const t of [0.3, 0.55, 0.78]) {
		const rr = t < 0.5 ? 5.2 - t * 1.4 : 4.3;
		put(X, F, WIN, S.hull, new THREE.CylinderGeometry(rr + 0.12, rr + 0.18, 1.6, 14, 1, true), 0, h * t, 0);
	}
	put(X, F, HULL, S.trim, new THREE.CylinderGeometry(4.3, 4.3, 0.5, 14), 0, h + 0.25, 0);
	put(X, F, HULL, S.trim, box(0.18, 7, 0.18), 1.2, h + 3.5, 0, 0, 0, 0, 1, true);
	put(X, F, RUN, S.run, box(0.45, 0.45, 0.45), 1.2, h + 7.1, 0, 0, 0, 0, 1, true);
	X.col.disc(F.x, F.z, 5.6, F.y + h);
}

// ---------- the spaceport ----------
export function port(X, p) {
	const S = X.S, F = frame(p.x, p.y, p.z, p.yaw);
	// the apron: sintered regolith slabs
	put(X, F, HULL, S.print.map((v) => v * 1.12), cbox(p.r * 2.2, 0.4, p.r * 1.7, 0.2), 0, 0.0, 0);
	X.col.box(p.x, p.z, p.yaw, p.r * 1.1, p.r * 0.85, p.y + 0.2);
	for (const [i, d] of p.pads.entries()) {
		const Fp = frame(d.x, d.y, d.z, p.yaw);
		put(X, Fp, HULL, [0.58, 0.58, 0.57], prism(8, d.r, d.r - 0.3, 0.7), 0, 0.15, 0);
		put(X, Fp, HULL, S.accent, ring(d.r * 0.7, 0.8, 0.06, 32), 0, 0.86, 0);
		put(X, Fp, HULL, [0.92, 0.92, 0.9], box(0.7, 0.06, d.r * 1.1), 0, 0.86, 0);
		put(X, Fp, HULL, [0.92, 0.92, 0.9], box(d.r * 1.1, 0.06, 0.7), 0, 0.86, 0);
		for (let k = 0; k < 8; k++) {
			const a = k / 8 * TAU + Math.PI / 8;
			put(X, Fp, RUN, S.pad, box(0.35, 0.3, 0.35), Math.sin(a) * (d.r - 0.6), 1.0, Math.cos(a) * (d.r - 0.6), 0, 0, 0, 1, true);
		}
		// a blast wall of banked regolith behind it
		put(X, Fp, REG, S.berm, lathe([[d.r + 2, -0.5], [d.r + 2.6, 2.6], [d.r + 4, 2.6], [d.r + 6, -0.5]], 24, true, Math.PI * 0.75, Math.PI * 0.5));
		pool(X, d.x, d.z, d.y + 0.9, d.r * 1.15, S.pad);
		X.col.disc(d.x, d.z, d.r, d.y + 0.85);
		if (i % 2 === 0) lander(X, frame(d.x, d.y + 0.85, d.z, p.yaw + i));
	}
	// the control tower: a printed stem, a cab of leaning glass, a mast and its beacon
	const T = frame(p.tower.x, p.tower.y, p.tower.z, p.yaw + Math.PI * 0.75), h = 24;
	put(X, T, PRINT, S.print, prism(8, 3.6, 2.6, h));
	put(X, T, HULL, S.trim, lathe([[2.6, 0], [6.4, 2.4], [0, 2.4]], 8, true, Math.PI / 8), 0, h, 0);
	put(X, T, WIN, S.hull, lathe([[6.4, 0], [7.0, 3.2]], 8, true, Math.PI / 8), 0, h + 2.4, 0);
	glass(X, T, lathe([[6.45, 0], [7.05, 3.2]], 8, true, Math.PI / 8), 0, h + 2.4, 0);
	put(X, T, HULL, S.hull, lathe([[7.2, 0], [7.2, 0.6], [0, 1.4]], 8, true, Math.PI / 8), 0, h + 5.6, 0);
	put(X, T, HULL, S.trim, box(0.25, 9, 0.25), 0, h + 11, 0, 0, 0, 0, 1, true);
	put(X, T, RUN, S.run, box(0.7, 0.7, 0.7), 0, h + 15.6, 0, 0, 0, 0, 1, true);
	put(X, T, HULL, S.trim, lathe([[0, 0], [1.6, 0.5], [2.4, 1.3]], 10, true), 2.5, h + 7.6, 0, 0, -0.6, 0, 1, true);
	X.col.disc(p.tower.x, p.tower.z, 3.8, p.tower.y + h + 6);
	// floodlights at the apron's corners
	for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
		const q = F.p(sx * p.r * 1.12, 0, sz * p.r * 0.9), Fq = frame(q.x, p.y, q.z, p.yaw);
		put(X, Fq, HULL, S.trim, box(0.35, 12, 0.35), 0, 6, 0, 0, 0, 0, 1, true);
		put(X, Fq, LAMP, S.window, box(2.2, 0.8, 0.8), 0, 12, 0, 0, 0, 0, 1, true);
		pool(X, q.x - sx * 6, q.z - sz * 6, p.y + 0.3, 20, S.window.map((v) => v * 0.7));
	}
}

// a lander standing on its pad: a faceted body, gold foil, four legs, its engine bell
function lander(X, F) {
	const S = X.S;
	put(X, F, HULL, S.hull, prism(8, 3.2, 2.2, 3.6), 0, 2.4, 0);
	put(X, F, HULL, [0.85, 0.62, 0.22], prism(8, 3.4, 3.2, 1.4), 0, 1.4, 0);
	put(X, F, WIN, S.hull, prism(8, 2.25, 2.0, 0.9), 0, 6.0, 0);
	put(X, F, HULL, S.trim, lathe([[1.2, 0], [0.4, 1.1]], 12, false), 0, 0.3, 0);
	for (let k = 0; k < 4; k++) {
		const a = k / 4 * TAU + Math.PI / 4;
		const top = F.p(Math.sin(a) * 3, 2.2, Math.cos(a) * 3), foot = F.p(Math.sin(a) * 5.4, 0.05, Math.cos(a) * 5.4);
		X.K.add('shell', sweep([top, foot], 0.16, 5, { seg: 1 }), { tint: S.trim, glow: HULL });
		put(X, F, HULL, S.trim, new THREE.CylinderGeometry(0.7, 0.8, 0.15, 8), Math.sin(a) * 5.4, 0.08, Math.cos(a) * 5.4);
	}
	put(X, F, RUN, S.run, box(0.3, 0.3, 0.3), 0, 7.2, 0, 0, 0, 0, 1, true);
	X.col.disc(F.x, F.z, 3.4, F.y + 7);
}

// a maglev station: a printed hall with a glass canopy over the platform
export function station(X, F) {
	const S = X.S;
	put(X, F, PRINT, S.print, cbox(12, 5, 8, 0.4), 0, 2.5, 0);
	put(X, F, WIN, S.hull, box(12.1, 1.6, 8.1), 0, 2.6, 0);
	put(X, F, HULL, S.trim, box(9, 0.8, 16), 0, X.railH - 1.2, 0);
	for (const z of [-7, 7]) for (const x of [-3.5, 3.5]) put(X, F, HULL, S.trim, box(0.4, X.railH - 1.6, 0.4), x, (X.railH - 1.6) / 2, z, 0, 0, 0, 1, true);
	glass(X, F, new THREE.CylinderGeometry(4.6, 4.6, 16, 10, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), 0, X.railH - 0.8, 0);
	X.col.box(F.x, F.z, F.yaw, 6.2, 4.2, F.y + 5);
}

// ---------- outposts ----------
// a mining rig on a crater rim: a lattice derrick, the drill string, a hopper and its belt,
// spoil banked beside it, floodlit
export function mine(X, o) {
	const S = X.S, F = frame(o.x, o.y, o.z, o.yaw), h = 24;
	put(X, F, PRINT, S.print, cbox(11, 0.8, 11, 0.3), 0, 0.2, 0);
	const legs = [[-4, -4], [4, -4], [4, 4], [-4, 4]];
	for (const [x, z] of legs) X.K.add('shell', sweep([F.p(x, 0.5, z), F.p(x * 0.25, h, z * 0.25)], 0.28, 4, { seg: 1, flat: true }), { tint: S.accent, glow: HULL });
	for (let l = 1; l < 5; l++) {
		const y = l * h / 5, k = 1 - 0.75 * y / h;
		for (let i = 0; i < 4; i++) {
			const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4];
			X.K.add('shell', sweep([F.p(ax * k, y, az * k), F.p(bx * k, y, bz * k)], 0.12, 4, { seg: 1 }), { tint: S.accent, glow: HULL, near: true });
		}
	}
	put(X, F, HULL, S.hull, cbox(3.4, 3, 3.4, 0.2), 0, h + 1.2, 0);
	put(X, F, HULL, S.trim, new THREE.CylinderGeometry(0.35, 0.35, h, 8), 0, h / 2, 0);
	put(X, F, RUN, S.run, box(0.5, 0.5, 0.5), 0, h + 3.0, 0, 0, 0, 0, 1, true);
	// the hopper and the belt down to the haul road
	put(X, F, PRINT, S.print, cbox(6, 5, 6, 0.4), 9, 5.5, 0);
	for (const [x, z] of [[-2.4, -2.4], [2.4, -2.4], [2.4, 2.4], [-2.4, 2.4]]) put(X, F, HULL, S.trim, box(0.4, 3, 0.4), 9 + x, 1.5, z, 0, 0, 0, 1, true);
	X.K.add('shell', sweep([F.p(9, 8, 0), F.p(9, 4, 16)], 0.7, 4, { seg: 1, flat: true }), { tint: S.trim, glow: HULL });
	put(X, F, REG, S.berm.map((v) => v * 0.9), blob(9, 4, 7, 8, 0), -11, -0.5, 5);
	put(X, F, REG, S.berm.map((v) => v * 0.8), blob(6, 3, 5, 8, 0), -8, -0.4, -9);
	put(X, F, HULL, S.trim, box(0.3, 10, 0.3), 6, 5, -8, 0, 0, 0, 1, true);
	put(X, F, LAMP, S.window, box(2, 0.7, 0.7), 6, 10, -8, 0, 0, 0, 1, true);
	pool(X, o.x, o.z, o.y + 0.5, 22, S.window.map((v) => v * 0.8));
	X.col.disc(o.x, o.z, 5, o.y + h + 3);
	const hp = F.p(9, 0, 0);
	X.col.box(hp.x, hp.z, o.yaw, 3.2, 3.2, o.y + 8);
}

// comms: dishes on their pedestals turned up to the sky (on the Moon, toward Earth)
export function relay(X, o) {
	const S = X.S, F = frame(o.x, o.y, o.z, o.yaw);
	const n = Math.max(1, X.P.dish);
	for (let i = 0; i < n; i++) {
		const D = F.sub((i - (n - 1) / 2) * 16, 0, 0, 0.5);
		const R = i ? 4.5 : 7, f = R * 0.55, ys = R * 0.5 + 6;
		put(X, D, HULL, S.trim, prism(8, 1.6, 1.1, ys), 0, 0, 0);
		const prof = [];
		for (let k = 0; k <= 6; k++) { const rr = R * k / 6; prof.push([rr, rr * rr / (4 * f) + 0.25]); }
		for (let k = 6; k >= 0; k--) { const rr = R * k / 6; prof.push([rr, rr * rr / (4 * f)]); }
		put(X, D, HULL, S.hull, lathe(prof, 20, false), 0, ys, 0, 0, -0.75);
		const focus = D.p(0, ys + Math.cos(0.75) * f, -Math.sin(0.75) * f);
		for (let k = 0; k < 3; k++) {
			const a = k / 3 * TAU, rim = new THREE.Vector3(Math.sin(a) * R * 0.85, R * 0.33, Math.cos(a) * R * 0.85).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.75).applyAxisAngle(new THREE.Vector3(0, 1, 0), D.yaw);
			X.K.add('shell', sweep([new THREE.Vector3(D.x + rim.x, D.y + ys + rim.y, D.z + rim.z), focus], 0.07, 4, { seg: 1 }), { tint: S.trim, glow: HULL, near: true });
		}
		X.K.add('shell', box(0.8, 0.8, 0.8).translate(focus.x, focus.y, focus.z), { tint: S.trim, glow: HULL });
		X.col.disc(D.x, D.z, 1.8, D.y + ys);
	}
	put(X, F, PRINT, S.print, cbox(6, 3.2, 4, 0.3), 0, 1.6, -9);
	put(X, F, WIN, S.hull, box(6.05, 1, 4.05), 0, 1.9, -9);
	put(X, F, RUN, S.run, box(0.4, 0.4, 0.4), 0, 3.6, -9, 0, 0, 0, 1, true);
	const q = F.p(0, 0, -9);
	X.col.box(q.x, q.z, o.yaw, 3, 2, o.y + 3.2);
}

// scrubber stacks: ribbed columns breathing out what they have cleaned from the haze
export function scrubbers(X, o) {
	const S = X.S, F = frame(o.x, o.y, o.z, o.yaw), n = X.P.stacks;
	put(X, F, PRINT, S.print, cbox(o.r * 1.6, 0.8, 12, 0.3), 0, 0.2, 0);
	for (let i = 0; i < n; i++) {
		const lx = (i - (n - 1) / 2) * (o.r * 1.4 / Math.max(1, n - 1)), h = 26 + X.r() * 16;
		put(X, F, HULL, S.hull, prism(14, 2.8, 2.0, h), lx, 0, 0);
		for (let k = 1; k < 5; k++) put(X, F, HULL, S.trim, ring(2.75 - k * 0.15, 0.6, 0.6, 14), lx, h * k / 5, 0, 0, 0, 0, 1, true);
		put(X, F, HULL, S.accent, ring(2.0, 0.5, 0.9, 14), lx, h - 0.6, 0);
		put(X, F, RUN, S.run, box(0.4, 0.4, 0.4), lx + 2.1, h, 0, 0, 0, 0, 1, true);
		put(X, F, PRINT, S.print, cbox(5, 3.5, 6, 0.3), lx, 1.8, 3.5);
		const top = F.p(lx, h, 0);
		X.plumes.push({ p: top, h: 30 + h * 0.4 });
		X.col.disc(top.x, top.z, 2.9, o.y + h);
	}
}

// a solar farm: rows of trackers (their panels are drawn apart, turned to the sun)
export function solarFarm(X, s) {
	const S = X.S, F = frame(s.x, s.y, s.z, s.yaw), rows = 2, per = X.det > 0.8 ? 5 : 3;
	for (let i = 0; i < rows; i++) for (let j = 0; j < per; j++) {
		const lx = (j - (per - 1) / 2) * 7.5, lz = (i - (rows - 1) / 2) * 9;
		put(X, F, HULL, S.trim, box(0.3, 3, 0.3), lx, 1.5, lz);
		const p = F.p(lx, 3.1, lz);
		X.panels.push({ x: p.x, y: p.y, z: p.z });
	}
	put(X, F, PRINT, S.print, cbox(3, 1.8, 2, 0.2), (per / 2) * 7.5 + 2, 0.9, 0);
	put(X, F, RUN, S.run, box(0.3, 0.3, 0.3), (per / 2) * 7.5 + 2, 1.95, 0, 0, 0, 0, 1, true);
}

// ---------- the maglev ----------
// the guideway on its pylons, a few metres over the ground's highs, eased level between
export function railLine(X, pts) {
	const S = X.S, H = X.H, a = pts[0], b = pts[1];
	const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.ceil(L / 6));
	const raw = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
		let g = -1e9;
		for (const o of [-12, -6, 0, 6, 12]) g = Math.max(g, H(x + (b.x - a.x) / L * o, z + (b.z - a.z) / L * o));
		raw.push({ x, z, g: H(x, z), y: g + X.railH });
	}
	// (ends at the stations' deck height)
	raw[0].y = H(a.x, a.z) + X.railH; raw[n].y = H(b.x, b.z) + X.railH;
	for (let pass = 0; pass < 3; pass++) for (let i = 1; i < n; i++) raw[i].y = Math.max(raw[i].g + X.railH * 0.7, (raw[i - 1].y + raw[i].y * 2 + raw[i + 1].y) / 4);
	const path = raw.map((p) => new THREE.Vector3(p.x, p.y, p.z));
	const yaw = Math.atan2(b.x - a.x, b.z - a.z);
	for (let i = 0; i < n; i++) {
		const p = path[i], q = path[i + 1], len = p.distanceTo(q), mid = p.clone().add(q).multiplyScalar(0.5);
		const pitch = Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z));
		const F = frame(mid.x, mid.y, mid.z, yaw);
		put(X, F, HULL, S.hull, box(2.4, 0.9, len + 0.05), 0, -0.45, 0, 0, -pitch);
		put(X, F, LAMP, S.pad, box(0.5, 0.08, len * 0.9), 0, -0.93, 0, 0, -pitch, 0, 1, true);
		if (i % 3 === 0 && i > 0) {
			const Fp = frame(p.x, raw[i].g, p.z, yaw), ht = p.y - raw[i].g - 0.9;
			put(X, Fp, PRINT, S.print, cbox(1.3, ht, 1.3, 0.2), 0, ht / 2, 0);
			put(X, Fp, HULL, S.trim, cbox(3.4, 0.6, 1.6, 0.1), 0, ht - 0.3, 0);
			X.col.disc(p.x, p.z, 0.8, p.y - 1);
		}
	}
	return path;
}

// a maglev train: three sleek cars along z, the glow strip under them
export function trainGeometry(S) {
	const parts = [];
	const add = (g, tint, mode) => parts.push(paint(g, tint, mode));
	for (let c = 0; c < 3; c++) {
		const z = (c - 1) * 11.5;
		add(cbox(2.7, 2.5, 10.6, 0.5).translate(0, 1.4, z), S.hull, HULL);
		add(box(2.76, 0.7, 9.4).translate(0, 1.85, z), S.hull, WIN);
		add(box(2.76, 0.18, 10.6).translate(0, 0.9, z), S.accent, HULL);
		add(box(1.6, 0.12, 10).translate(0, 0.08, z), S.pad, LAMP);
	}
	add(blob(1.35, 3.6, 1.25, 8, 0).rotateX(Math.PI / 2).translate(0, 1.4, 16.8), S.hull, HULL);
	add(blob(1.35, 3.6, 1.25, 8, 0).rotateX(-Math.PI / 2).translate(0, 1.4, -16.8), S.hull, HULL);
	return merge(parts);
}

// a rover: six wheels, a pressurised cab, headlights and a beacon (origin on the ground)
export function roverGeometry(S) {
	const parts = [];
	const add = (g, tint, mode) => parts.push(paint(g, tint, mode));
	add(cbox(2.5, 0.6, 4.2, 0.12).translate(0, 1.0, 0), S.hull, HULL);
	add(cbox(2.2, 1.5, 2.2, 0.3).translate(0, 2.0, 0.6), S.hull, HULL);
	add(box(2.24, 0.6, 1.2).translate(0, 2.2, 1.2), S.hull, WIN);
	add(box(2.0, 0.9, 1.4).translate(0, 1.7, -1.4), S.accent, HULL);
	for (const z of [-1.5, 0, 1.5]) for (const x of [-1.35, 1.35]) add(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10).rotateZ(Math.PI / 2).translate(x, 0.55, z), [0.12, 0.12, 0.13], HULL);
	for (const x of [-0.8, 0.8]) add(box(0.4, 0.2, 0.1).translate(x, 1.15, 2.12), S.window, LAMP);
	add(box(0.3, 0.3, 0.3).translate(0, 2.9, -0.2), S.run, RUN);
	add(box(0.06, 1.4, 0.06).translate(0.8, 3.3, -1.2), S.trim, HULL);
	return merge(parts);
}

// a colonist in a pressure suit (origin at the feet); aLeg swings the legs and arms
export function suitGeometry(S) {
	const parts = [];
	const add = (g, tint, mode, leg = 0) => { const p = paint(g, tint, mode); p.setAttribute('aLeg', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count).fill(leg), 1)); parts.push(p); };
	const white = [0.9, 0.9, 0.88];
	add(cbox(0.56, 0.72, 0.4, 0.08).translate(0, 1.22, 0), white, HULL);
	add(cbox(0.5, 0.62, 0.26, 0.06).translate(0, 1.26, -0.32), S.trim, HULL);
	add(new THREE.SphereGeometry(0.21, 10, 8).translate(0, 1.76, 0.02), white, HULL);
	add(new THREE.SphereGeometry(0.17, 10, 6, -1.2, 2.4, 0.9, 1.3).translate(0, 1.76, 0.08), [0.95, 0.66, 0.2], HULL);
	add(box(0.12, 0.08, 0.04).translate(0, 1.42, 0.21), S.window, LAMP);
	for (const s of [-1, 1]) {
		add(cbox(0.2, 0.86, 0.22, 0.05).translate(s * 0.14, 0.43, 0), white, HULL, s);
		add(box(0.21, 0.1, 0.3).translate(s * 0.14, 0.05, 0.04), S.trim, HULL, s);
		add(cbox(0.15, 0.62, 0.16, 0.04).translate(s * 0.37, 1.18, 0), white, HULL, -s * 0.5);
		add(box(0.16, 0.06, 0.17).translate(s * 0.37, 1.32, 0), S.accent, HULL, -s * 0.5);
	}
	return merge(parts);
}

// ---------- helpers for the drawn-apart shapes ----------
function paint(g, tint, mode) {
	if (g.index) g = g.toNonIndexed();
	for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
	g.computeVertexNormals();
	const n = g.attributes.position.count, c = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) c.set(tint, i * 3);
	g.setAttribute('color', new THREE.BufferAttribute(c, 3));
	g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(mode), 1));
	return g;
}
function merge(parts) {
	const keys = Object.keys(parts[0].attributes);
	const out = new THREE.BufferGeometry();
	for (const k of keys) {
		const size = parts[0].attributes[k].itemSize;
		let n = 0;
		for (const p of parts) n += p.attributes[k].count * size;
		const a = new Float32Array(n);
		let o = 0;
		for (const p of parts) { a.set(p.attributes[k].array, o); o += p.attributes[k].array.length; }
		out.setAttribute(k, new THREE.BufferAttribute(a, size));
	}
	for (const p of parts) p.dispose();
	out.computeBoundingSphere();
	return out;
}
// a solar panel (pivot at its middle, face up) and a radiator fin (pivot at its foot)
export function panelGeometry(S) {
	return merge([paint(box(6.4, 0.1, 3.2), [0.08, 0.1, 0.2], 4), paint(box(6.6, 0.16, 0.14).translate(0, -0.02, 1.62), S.trim, HULL), paint(box(6.6, 0.16, 0.14).translate(0, -0.02, -1.62), S.trim, HULL), paint(box(0.3, 0.3, 0.5), S.trim, HULL)]);
}
export function finGeometry(S) {
	return merge([paint(box(0.12, 5.2, 9).translate(0, 5.8, 0), [0.92, 0.93, 0.95], HULL), paint(box(0.4, 0.4, 9.2).translate(0, 3.2, 0), S.trim, HULL), paint(new THREE.CylinderGeometry(0.15, 0.15, 9.2, 6).rotateX(Math.PI / 2).translate(0, 8.4, 0), S.accent, COOL)]);
}
