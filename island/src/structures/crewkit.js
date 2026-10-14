// What a rebuild brings to the kerb, made of simple solids merged into one mesh a site: a
// flatbed with its load, a dump truck heaped with rubble, a cement mixer (its drum turns, a
// mesh of its own), a mobile crane on its outriggers (the upper works slew with the boom up
// and the counterweight behind), the glazier's van with its rack, a tower crane over the big
// jobs; site fencing, water barriers, cones, pallets of blocks, bundles of bars, a skip, the
// site cabin. The cloth of a site (the netting on the scaffold, the fence's mesh, the banners)
// is one drawn atlas on one material. The crew are instanced (createCrew): every worker on
// every site is a few draws, hi-vis vest, hard hat, arms and legs that move with the work.

import * as THREE from 'three';

export const lin = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
const C = {
	steel: [0.62, 0.64, 0.66], dark: [0.07, 0.07, 0.08], tyre: [0.05, 0.05, 0.05], rim: [0.55, 0.56, 0.58], glass: [0.08, 0.12, 0.16], chrome: [0.78, 0.8, 0.82],
	yellow: [0.95, 0.74, 0.08], orange: [0.97, 0.47, 0.08], white: [0.92, 0.92, 0.9], red: [0.78, 0.12, 0.1], blue: [0.16, 0.3, 0.6], grey: [0.45, 0.46, 0.47],
	wood: [0.62, 0.48, 0.3], block: [0.66, 0.65, 0.62], rust: [0.42, 0.22, 0.12], rubble: [0.55, 0.53, 0.5], concrete: [0.6, 0.6, 0.58], lamp: [1, 0.95, 0.8], amber: [1, 0.62, 0.1],
	green: [0.18, 0.36, 0.22], cabin: [0.86, 0.86, 0.8], loo: [0.15, 0.35, 0.7],
};
export const COLORS = C;

// ---------- parts into one geometry ----------
// a list of parts, each a non-indexed geometry with its colour; merged once
export function parts() {
	const P = [];
	const add = (g, c) => {
		const n = g.attributes.position.count, a = new Float32Array(n * 3), L = lin(c);
		for (let i = 0; i < n; i++) a.set(L, i * 3);
		g.setAttribute('color', new THREE.BufferAttribute(a, 3));
		if (g.attributes.uv) g.deleteAttribute('uv');
		P.push(g);
		return g;
	};
	// a frame to build in: at (x, y, z) turned by yaw, local +z ahead
	function at(x, y, z, yaw = 0) {
		const M = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
		const put = (g, lx, ly, lz, ry = 0, rx = 0, rz = 0) => { g.rotateZ(rz); g.rotateX(rx); g.rotateY(ry); g.translate(lx, ly, lz); g.applyMatrix4(M); return g; };
		return {
			M,
			// a box w by h by d standing on (lx, ly, lz)
			box(lx, ly, lz, w, h, d, c, ry = 0, rx = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(0, h / 2, 0); return add(put(g, lx, ly, lz, ry, rx, rz), c); },
			// a box about its middle
			mid(lx, ly, lz, w, h, d, c, ry = 0, rx = 0, rz = 0) { return add(put(new THREE.BoxGeometry(w, h, d).toNonIndexed(), lx, ly, lz, ry, rx, rz), c); },
			// a cylinder about its middle, along x, y or z
			cyl(lx, ly, lz, r, len, axis, c, seg = 10, r2 = r) {
				const g = new THREE.CylinderGeometry(r2, r, len, seg).toNonIndexed();
				return add(put(g, lx, ly, lz, 0, axis === 'z' ? Math.PI / 2 : 0, axis === 'x' ? Math.PI / 2 : 0), c);
			},
			// a tube from a to b (local), square in section, no ends
			tube(a, b, r, c) {
				const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
				if (L < 1e-3) return null;
				const g = new THREE.BoxGeometry(r * 2, L, r * 2).toNonIndexed();
				const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
				g.applyQuaternion(q); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); g.applyMatrix4(M);
				return add(g, c);
			},
		};
	}
	function merge() {
		let n = 0;
		for (const g of P) n += g.attributes.position.count;
		const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
		let k = 0;
		for (const g of P) { pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); col.set(g.attributes.color.array, k * 3); k += g.attributes.position.count; g.dispose(); }
		P.length = 0;
		const out = new THREE.BufferGeometry();
		out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
		out.computeBoundingSphere();
		return out;
	}
	return { at, merge, size: () => P.length };
}

// ---------- the trucks: local +z ahead, the ground at y 0 ----------
function wheels(V, axles, track, r = 0.5, w = 0.38) {
	for (const z of axles) for (const s of [-1, 1]) { V.cyl(s * track / 2, r, z, r, w, 'x', C.tyre, 12); V.cyl(s * (track / 2 + w * 0.3), r, z, r * 0.55, w * 0.5, 'x', C.rim, 8); }
}
// a cab: the body, its glass, lamps, grille and bumper, the mirrors and the beacon on its roof
function cab(V, z0, col, W = 2.4, H = 2.1, L = 2.2, y0 = 0.75) {
	V.box(0, y0, z0, W, H, L, col);
	V.box(0, y0 + H * 0.5, z0 + L / 2 + 0.01, W * 0.86, H * 0.42, 0.04, C.glass);
	for (const s of [-1, 1]) { V.box(s * (W / 2 + 0.01), y0 + H * 0.5, z0 + L * 0.12, 0.04, H * 0.38, L * 0.55, C.glass); V.mid(s * (W / 2 + 0.25), y0 + H * 0.62, z0 + L * 0.42, 0.06, 0.4, 0.22, C.dark); V.box(s * W * 0.36, y0 + 0.25, z0 + L / 2 + 0.02, 0.32, 0.18, 0.05, C.lamp); }
	V.box(0, y0 + 0.08, z0 + L / 2 + 0.02, W * 0.5, 0.55, 0.05, C.dark);
	V.box(0, y0 - 0.25, z0 + L / 2 + 0.08, W + 0.05, 0.3, 0.2, C.grey);
	V.box(0, y0 + H, z0 - L * 0.1, W * 0.5, 0.12, 0.28, C.amber);
	V.box(0, y0 - 0.45, z0 + L * 0.2, W * 0.4, 0.3, 0.5, C.dark);
}
function chassis(V, z0, z1, W = 1.1, y = 0.65) { V.box(0, y, (z0 + z1) / 2, W, 0.28, z1 - z0, C.dark); }

// a flatbed: what it carries by the stage (blocks on pallets, glass on its A-frame, bars, or nothing)
export function flatbed(V, col, load = 'blocks') {
	chassis(V, -4.6, 3.4); cab(V, 2.4, col); wheels(V, [2.4, -2.2, -3.4], 2.0);
	V.box(0, 0.95, -1.3, 2.5, 0.16, 5.8, C.grey);
	for (const s of [-1, 1]) { V.box(s * 1.22, 1.1, -1.3, 0.06, 0.32, 5.8, col); for (let k = 0; k < 4; k++) V.box(s * 1.22, 1.1, -3.9 + k * 1.75, 0.08, 0.7, 0.08, C.dark); }
	V.box(0, 1.1, 1.5, 2.5, 1.2, 0.1, C.dark);
	if (load === 'blocks') for (let k = 0; k < 3; k++) { V.box(0, 1.11, -3.4 + k * 1.6, 1.2, 0.14, 1.2, C.wood); V.box(0, 1.25, -3.4 + k * 1.6, 1.1, 0.8, 1.1, C.block); V.box(0, 2.05, -3.4 + k * 1.6, 1.12, 0.03, 1.12, [0.85, 0.85, 0.9]); }
	else if (load === 'glass') {
		V.box(0, 1.11, -1.5, 0.9, 0.14, 4.4, C.wood);
		for (const s of [-1, 1]) { V.box(s * 0.25, 1.25, -1.5, 0.1, 1.9, 4.2, C.steel, 0, 0, s * 0.18); for (let k = 0; k < 5; k++) V.box(s * (0.42 + k * 0.05), 1.25, -1.5, 0.02, 1.7, 3.8, [0.55, 0.72, 0.78], 0, 0, s * 0.18); }
	} else if (load === 'bars') for (let k = 0; k < 4; k++) V.cyl(-0.6 + k * 0.4, 1.3, -1.4, 0.16, 5.4, 'z', C.rust, 6);
}
// a dump truck, its body full of what was cleared
export function dump(V, col, full = true) {
	chassis(V, -3.8, 3.4); cab(V, 2.5, col); wheels(V, [2.5, -1.4, -2.7], 2.0, 0.55);
	V.box(0, 1.0, -1.6, 2.5, 0.2, 4.4, C.dark);
	for (const s of [-1, 1]) V.box(s * 1.22, 1.2, -1.6, 0.1, 1.3, 4.4, col, 0, 0, s * 0.08);
	V.box(0, 1.2, 0.6, 2.5, 1.5, 0.12, col); V.box(0, 1.2, -3.8, 2.5, 1.3, 0.12, col);
	V.box(0, 0.9, 0.3, 0.3, 0.9, 0.3, C.chrome, 0, -0.35, 0);
	if (full) { V.box(0, 1.25, -1.6, 2.2, 1.0, 4.1, C.rubble); for (let k = 0; k < 7; k++) V.mid(((k * 37) % 9 - 4) * 0.2, 2.4 + (k % 3) * 0.1, -3 + k * 0.45, 0.4 + (k % 3) * 0.15, 0.3, 0.45, k % 2 ? C.concrete : C.rubble, k, k * 0.3, 0); }
}
// a cement mixer's truck (the drum is mixerDrum(), turning on its own)
export function mixer(V, col) {
	chassis(V, -3.9, 3.4); cab(V, 2.5, col); wheels(V, [2.5, -1.5, -2.8], 2.0, 0.55);
	V.box(0, 0.95, -1.5, 2.2, 0.25, 4.6, C.dark);
	V.cyl(0, 2.0, 0.85, 0.35, 1.2, 'x', C.white, 10);
	V.box(0, 1.2, -1.2, 0.5, 1.4, 0.3, C.dark); V.box(0, 1.2, -3.6, 0.5, 2.0, 0.3, C.dark);
	V.mid(0, 2.9, -4.2, 0.5, 0.4, 0.9, C.steel, 0, 0.6, 0); V.mid(0, 2.0, -4.55, 0.4, 0.1, 1.4, C.steel, 0, -0.5, 0);
	V.box(0.9, 1.1, -4.0, 0.08, 2.2, 0.5, C.dark);
}
// the drum: wider at the cab end, the fins of its spiral in bands; turning about its own axis
export function mixerDrum(col) {
	const K = parts(), V = K.at(0, 0, 0);
	V.cyl(0, 0, 0.6, 1.15, 2.2, 'z', col, 14, 0.95);
	V.cyl(0, 0, -1.4, 1.15, 1.8, 'z', col, 14, 1.15);
	V.cyl(0, 0, 1.95, 0.95, 0.6, 'z', col, 14, 0.55);
	V.cyl(0, 0, -2.45, 1.15, 0.3, 'z', C.grey, 14, 0.6);
	for (let k = 0; k < 4; k++) V.mid(0, 0, -1.8 + k * 1.05, 2.36, 0.12, 0.18, C.orange, 0, 0, k * 0.8);
	return K.merge();
}
// a mobile crane's carrier: four axles, its outriggers out on their pads
export function craneCarrier(V, col) {
	chassis(V, -5.4, 4.4, 1.3); cab(V, 3.6, col, 2.5, 1.8, 1.8); wheels(V, [3.4, 2.0, -2.6, -4.0], 2.1, 0.55);
	V.box(0, 0.95, -0.8, 2.6, 0.5, 7.4, col);
	for (const z of [2.6, -4.6]) for (const s of [-1, 1]) { V.box(s * 2.0, 0.9, z, 2.0, 0.3, 0.4, C.yellow); V.box(s * 2.9, 0.1, z, 0.25, 1.0, 0.25, C.dark); V.box(s * 2.9, 0.0, z, 0.7, 0.1, 0.7, C.wood); }
	V.cyl(0, 1.6, -1.2, 0.95, 0.25, 'y', C.dark, 14);
}
// its upper works (turning about y): the turret and cab, the counterweight behind, the boom
// luffed up at angle a and the hook on its rope (its head and hook returned)
export function craneUpper(col, a = 0.85, len = 22) {
	const K = parts(), V = K.at(0, 0, 0);
	V.box(0, 0, 0, 2.4, 1.0, 3.6, col);
	V.box(0.95, 1.0, 0.6, 0.85, 1.5, 1.6, col); V.box(1.38, 1.5, 0.6, 0.02, 0.8, 1.3, C.glass); V.box(0.95, 1.5, 1.41, 0.7, 0.8, 0.02, C.glass);
	V.box(0, 0.3, -2.4, 2.6, 1.5, 1.4, C.grey); V.box(0, 1.8, -2.4, 2.6, 0.05, 1.4, C.yellow);
	// (the boom: three telescoped sections, narrowing)
	const ca = Math.cos(a), sa = Math.sin(a);
	let s0 = 0;
	for (let k = 0; k < 3; k++) {
		const L = len / 3 + 0.6, w = 0.9 - k * 0.18, mid = s0 + L / 2;
		V.mid(-0.2, 1.4 + sa * mid, 0.8 + ca * mid, w, w * 0.9, L, k ? C.yellow : col, 0, -a, 0);
		s0 += len / 3;
	}
	const hx = -0.2, hy = 1.4 + sa * len, hz = 0.8 + ca * len, drop = Math.max(4, hy - 6);
	V.mid(hx, hy - drop / 2, hz, 0.04, drop, 0.04, C.dark);
	V.mid(hx, hy - drop - 0.35, hz, 0.45, 0.7, 0.3, C.orange);
	V.mid(-0.2, 1.6, 0.4, 0.3, 2.2, 0.3, C.chrome, 0, -0.9, 0);
	return { geo: K.merge(), head: [hx, hy, hz], hook: [hx, hy - drop - 0.7, hz] };
}
// the glazier's van, its glass rack along the side
export function van(V) {
	V.box(0, 0.45, 0, 2.0, 2.0, 5.2, C.white); V.box(0, 1.5, 2.61, 1.8, 0.65, 0.04, C.glass);
	for (const s of [-1, 1]) { V.box(s * 1.01, 1.55, 1.7, 0.03, 0.55, 0.9, C.glass); V.box(s * 0.7, 0.75, 2.62, 0.3, 0.15, 0.04, C.lamp); }
	V.box(0, 0.2, 2.65, 2.05, 0.3, 0.15, C.grey); V.box(0, 2.45, 0, 0.6, 0.1, 0.25, C.amber);
	V.box(1.08, 1.0, -0.6, 0.12, 1.5, 3.0, C.steel); V.box(1.18, 1.05, -0.6, 0.04, 1.4, 2.8, [0.6, 0.78, 0.82]);
	V.box(0, 0.6, 0, 2.02, 0.18, 5.22, C.blue);
	wheels(V, [1.7, -1.7], 1.75, 0.38, 0.28);
}

// ---------- the site's things ----------
export function cone(V, x, z) { V.box(x, 0, z, 0.36, 0.04, 0.36, C.dark); V.cyl(x, 0.36, z, 0.16, 0.66, 'y', C.orange, 8, 0.03); V.cyl(x, 0.42, z, 0.115, 0.1, 'y', C.white, 8, 0.095); }
export function barrier(V, x, z, ry, red) { V.box(x, 0, z, 1.0, 0.8, 0.45, red ? C.red : C.white, ry); V.box(x, 0.8, z, 0.8, 0.05, 0.35, red ? C.red : C.white, ry); }
export function pallet(V, x, z, ry, what = 'blocks') {
	V.box(x, 0, z, 1.2, 0.14, 1.0, C.wood, ry);
	if (what === 'blocks') { V.box(x, 0.14, z, 1.1, 0.9, 0.9, C.block, ry); V.box(x, 1.04, z, 1.12, 0.03, 0.92, [0.85, 0.85, 0.9], ry); }
	else if (what === 'bars') for (let k = 0; k < 3; k++) V.mid(x, 0.25 + k * 0.12, z, 0.16, 0.12, 5.6, C.rust, ry + (k - 1) * 0.04);
	else V.box(x, 0.14, z, 1.0, 0.6, 0.8, [0.8, 0.78, 0.7], ry);
}
export function skip(V, x, z, ry, full) {
	V.box(x, 0.08, z, 1.8, 1.1, 3.6, C.yellow, ry); V.box(x, 0, z, 1.4, 0.1, 3.0, C.dark, ry);
	if (full) V.box(x, 0.5, z, 1.6, 0.8, 3.3, C.rubble, ry);
}
export function cabin(V, x, z, ry) {
	V.box(x, 0, z, 2.4, 0.3, 6.0, C.dark, ry); V.box(x, 0.3, z, 2.4, 2.5, 6.0, C.cabin, ry);
	const cy = Math.cos(ry), sy = Math.sin(ry), off = (u, v) => [x + u * cy + v * sy, z - u * sy + v * cy];
	for (const v of [-1.5, 1.2]) { const [a, b] = off(1.21, v); V.box(a, 1.3, b, 0.04, 0.8, 1.1, C.glass, ry); }
	{ const [a, b] = off(1.21, -0.2); V.box(a, 0.3, b, 0.05, 2.0, 0.85, C.blue, ry); }
	V.box(x, 2.8, z, 2.6, 0.08, 6.2, C.grey, ry);
}
export function loo(V, x, z, ry) { V.box(x, 0, z, 1.1, 2.3, 1.1, C.loo, ry); V.box(x, 2.3, z, 1.15, 0.1, 1.15, C.white, ry); }

// a tower crane: the lattice mast, the cab under the slewing ring; its jib (towerJib) turns
export function towerMast(V, h) {
	V.box(0, 0, 0, 4.0, 1.0, 4.0, C.concrete);
	for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) V.box(a, 1, b, 0.16, h - 1, 0.16, C.yellow);
	for (let k = 1.5; k < h - 1; k += 2.2) {
		V.box(0, k, -0.8, 1.6, 0.08, 0.08, C.yellow); V.box(0, k, 0.8, 1.6, 0.08, 0.08, C.yellow); V.box(-0.8, k, 0, 0.08, 0.08, 1.6, C.yellow); V.box(0.8, k, 0, 0.08, 0.08, 1.6, C.yellow);
		V.tube([-0.8, k, -0.8], [0.8, k + 2.2, -0.8], 0.035, C.yellow); V.tube([0.8, k, 0.8], [-0.8, k + 2.2, 0.8], 0.035, C.yellow);
		V.tube([-0.8, k, 0.8], [-0.8, k + 2.2, -0.8], 0.035, C.yellow); V.tube([0.8, k, -0.8], [0.8, k + 2.2, 0.8], 0.035, C.yellow);
	}
}
export function towerJib(R) {
	const K = parts(), V = K.at(0, 0, 0);
	V.box(0, 0, 0, 2.0, 0.7, 2.0, C.yellow);
	V.box(1.4, -0.9, 0.6, 1.3, 1.6, 1.5, C.yellow); V.box(2.06, -0.5, 0.6, 0.02, 0.9, 1.2, C.glass);
	V.box(0, 0.7, 0, 0.5, 4.2, 0.5, C.yellow);
	// (the jib: a triangle of chords, braced; the counter-jib behind with its blocks)
	for (const [a, y] of [[-0.55, 0.7], [0.55, 0.7], [0, 1.6]]) V.tube([a, y, 1], [a, y, R], 0.05, C.yellow);
	for (let s = 1.5; s < R; s += 2.4) { V.tube([-0.55, 0.7, s], [0, 1.6, s + 1.2], 0.03, C.yellow); V.tube([0.55, 0.7, s], [0, 1.6, s + 1.2], 0.03, C.yellow); V.tube([-0.55, 0.7, s], [0.55, 0.7, s + 1.2], 0.03, C.yellow); }
	V.box(0, 0.5, -5, 1.4, 0.5, 10, C.yellow);
	for (let k = 0; k < 4; k++) V.box(0, -0.9, -8.6 + k * 0.6, 2.2, 1.9, 0.55, C.concrete);
	V.tube([0, 4.9, 0], [0, 1.6, R * 0.7], 0.03, C.dark); V.tube([0, 4.9, 0], [0, 1.0, -9.5], 0.03, C.dark);
	const tz = R * 0.62;
	V.box(0, 0.25, tz, 1.0, 0.45, 1.2, C.grey);
	V.mid(0, -8, tz, 0.04, 16, 0.04, C.dark); V.mid(0, -16.4, tz, 0.5, 0.6, 0.5, C.orange);
	return K.merge();
}

// ---------- the site's cloth: netting, the fence's mesh, banners: one atlas ----------
export function clothMaterial() {
	const S = 256, cv = document.createElement('canvas');
	cv.width = cv.height = S * 2;
	const g = cv.getContext('2d');
	// netting: a fine green mesh, thicker threads every so often
	g.fillStyle = 'rgba(30,96,52,0.42)'; g.fillRect(0, 0, S, S);
	g.strokeStyle = 'rgba(22,70,38,0.95)'; g.lineWidth = 2;
	for (let i = 0; i <= S; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
	// the fence's mesh: wires, clear between
	g.strokeStyle = 'rgba(170,175,178,1)'; g.lineWidth = 3;
	for (let i = 0; i <= S; i += 21) { g.beginPath(); g.moveTo(S + i, 0); g.lineTo(S + i, S); g.stroke(); }
	for (let i = 0; i <= S; i += 42) { g.beginPath(); g.moveTo(S, i); g.lineTo(S * 2, i); g.stroke(); }
	// banners: the works' own, and the safety one
	const banner = (x, y, bg, fg, a, b) => {
		g.fillStyle = bg; g.fillRect(x, y + 64, S, 128);
		g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.font = 'bold 34px Arial, sans-serif'; g.fillText(a, x + S / 2, y + 108);
		g.font = 'bold 22px Arial, sans-serif'; g.fillText(b, x + S / 2, y + 152);
		for (let i = -1; i < 9; i++) { g.fillStyle = i % 2 ? '#111' : '#f2b705'; g.beginPath(); g.moveTo(x + i * 32, y + 64); g.lineTo(x + i * 32 + 16, y + 64); g.lineTo(x + i * 32 + 28, y + 76); g.lineTo(x + i * 32 + 12, y + 76); g.fill(); g.beginPath(); g.moveTo(x + i * 32, y + 180); g.lineTo(x + i * 32 + 16, y + 180); g.lineTo(x + i * 32 + 28, y + 192); g.lineTo(x + i * 32 + 12, y + 192); g.fill(); }
	};
	banner(0, S, '#1f4f8f', '#ffffff', 'CITY WORKS', 'REBUILDING YOUR STREET');
	banner(S, S, '#f2c200', '#111111', 'HARD HAT AREA', 'SITE SAFETY FIRST');
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9, alphaTest: 0.02 });
	// (each quad says which cell it shows; its uv repeats inside that cell)
	mat.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell; varying vec2 vCell; varying vec2 vRaw;').replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvCell = aCell; vRaw = uv;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCell; varying vec2 vRaw;').replace('#include <map_fragment>', 'diffuseColor *= texture2D(map, vCell + 0.004 + fract(vRaw) * 0.492);');
	};
	mat.customProgramCacheKey = () => 'structures-cloth-1';
	return mat;
}
export const NET = [0, 0], MESH = [0.5, 0], BANNER = [0, 0.5], SAFETY = [0.5, 0.5];
// quads of cloth: corners (world), the cell, how many times it repeats across and up
export function cloth() {
	const pos = [], uv = [], cell = [], nor = [];
	function quad(a, b, c, d, cl, ru = 1, rv = 1) {
		const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
		const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n) || 1;
		const U = [[0, 0], [ru, 0], [ru, rv], [0, rv]];
		for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...[a, b, c, d][k]); uv.push(...U[k]); cell.push(cl[0], cl[1]); nor.push(n[0] / l, n[1] / l, n[2] / l); }
	}
	function geo() {
		if (!pos.length) return null;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aCell', new THREE.Float32BufferAttribute(cell, 2));
		g.computeBoundingSphere();
		return g;
	}
	return { quad, geo };
}

// ---------- the crew: instanced, every worker on every site ----------
// set(x, y, z, yaw, pose, t): pose 'walk', 'hammer', 'shovel', 'carry', 'talk'; t their clock
export function createCrew(scene, cap) {
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
	const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.7 }), hatMat = new THREE.MeshStandardMaterial({ roughness: 0.4 });
	const torso = (vest) => {
		const K = parts(), V = K.at(0, 0, 0);
		V.box(0, 0.88, 0, 0.44, 0.62, 0.25, [0.22, 0.24, 0.3]);
		V.box(0, 0.92, 0, 0.47, 0.56, 0.28, vest);
		for (const y of [1.06, 1.24]) V.box(0, y, 0, 0.48, 0.05, 0.29, [0.82, 0.84, 0.86]);
		for (const s of [-1, 1]) V.box(s * 0.13, 1.28, 0, 0.06, 0.2, 0.29, [0.82, 0.84, 0.86]);
		V.box(0, 0.84, 0, 0.45, 0.07, 0.27, [0.1, 0.1, 0.1]);
		V.box(0, 1.5, 0, 0.12, 0.06, 0.12, [0.6, 0.45, 0.35]);
		return K.merge();
	};
	// (a leg from the hip down, boot at its foot; an arm from the shoulder, the hand at its end)
	const legGeo = (() => { const K = parts(), V = K.at(0, 0, 0); V.box(0, -0.84, 0, 0.17, 0.84, 0.19, [0.16, 0.18, 0.24]); V.box(0, -0.9, 0.04, 0.18, 0.12, 0.28, [0.22, 0.14, 0.08]); return K.merge(); })();
	const armGeo = (() => { const K = parts(), V = K.at(0, 0, 0); V.box(0, -0.58, 0, 0.12, 0.58, 0.13, [0.24, 0.27, 0.34]); V.box(0, -0.72, 0, 0.1, 0.14, 0.11, [0.62, 0.46, 0.36]); return K.merge(); })();
	const headGeo = new THREE.BoxGeometry(0.21, 0.25, 0.23).translate(0, 1.66, 0);
	const hatGeo = (() => { const a = new THREE.BoxGeometry(0.27, 0.12, 0.3).translate(0, 1.82, 0.01), b = new THREE.BoxGeometry(0.32, 0.025, 0.36).translate(0, 1.765, 0.03), c = new THREE.BoxGeometry(0.06, 0.03, 0.31).translate(0, 1.885, 0.01); const g = new THREE.BufferGeometry(); const m = [a, b, c].map((q) => q.toNonIndexed()); const n = m.reduce((s, q) => s + q.attributes.position.count, 0); const p = new Float32Array(n * 3), nn = new Float32Array(n * 3); let k = 0; for (const q of m) { p.set(q.attributes.position.array, k * 3); nn.set(q.attributes.normal.array, k * 3); k += q.attributes.position.count; } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); return g; })();
	const mk = (g, m, n) => { const I = new THREE.InstancedMesh(g, m, n); I.count = 0; I.castShadow = true; I.frustumCulled = false; scene.add(I); return I; };
	const T = [mk(torso(lin([0.86, 0.95, 0.12])), mat, cap), mk(torso(lin([0.98, 0.45, 0.06])), mat, cap)];
	const legs = mk(legGeo, mat, cap * 2), arms = mk(armGeo, mat, cap * 2), heads = mk(headGeo, skinMat, cap), hats = mk(hatGeo, hatMat, cap);
	const SKIN = [[0.86, 0.66, 0.52], [0.62, 0.44, 0.32], [0.42, 0.28, 0.2], [0.78, 0.58, 0.42], [0.3, 0.2, 0.14]].map((c) => new THREE.Color().setRGB(...lin(c)));
	const HAT = [[0.95, 0.95, 0.92], [0.98, 0.82, 0.1], [0.98, 0.5, 0.08], [0.2, 0.42, 0.85]].map((c) => new THREE.Color().setRGB(...lin(c)));
	const M = new THREE.Matrix4(), L = new THREE.Matrix4(), R = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
	let n = 0, nt = [0, 0];
	function begin() { n = 0; nt = [0, 0]; }
	function set(x, y, z, yaw, pose, t) {
		if (n >= cap) return;
		const i = n++;
		M.compose(P3.set(x, y, z), Q.setFromEuler(E.set(0, yaw, 0)), S1);
		// the swing of the limbs, by what they are doing
		let lS = 0, rS = 0, la = 0, ra = 0, bend = 0, bob = 0;
		const ph = t * (pose === 'walk' || pose === 'carry' ? 7 : 5);
		if (pose === 'walk') { lS = Math.sin(ph) * 0.55; rS = -lS; la = -lS * 0.8; ra = lS * 0.8; bob = Math.abs(Math.sin(ph)) * 0.04; }
		else if (pose === 'carry') { lS = Math.sin(ph) * 0.4; rS = -lS; la = ra = -1.1; bob = Math.abs(Math.sin(ph)) * 0.03; }
		else if (pose === 'hammer') { ra = -1.6 - Math.max(0, Math.sin(ph * 1.6)) * 1.0; la = -0.5; }
		else if (pose === 'shovel') { const k = (Math.sin(ph * 0.7) + 1) / 2; bend = 0.35 * k; la = -0.6 - k * 0.6; ra = -0.3 - k * 0.8; lS = 0.15; rS = -0.2; }
		else { la = Math.sin(t * 1.3) * 0.15 - 0.1; ra = -0.25 + Math.sin(t * 2.1 + 1) * 0.35; }
		if (bob) M.multiply(L.makeTranslation(0, bob, 0));
		const vest = i % 3 === 1 ? 1 : 0;
		const body = M.clone().multiply(L.makeTranslation(0, 0.88, 0)).multiply(R.makeRotationX(bend)).multiply(L.makeTranslation(0, -0.88, 0));
		T[vest].setMatrixAt(nt[vest]++, body);
		heads.setMatrixAt(i, body); hats.setMatrixAt(i, body);
		heads.setColorAt(i, SKIN[i % SKIN.length]); hats.setColorAt(i, HAT[(i * 3 + 1) % HAT.length]);
		for (const [k, s, sw] of [[0, -1, lS], [1, 1, rS]]) legs.setMatrixAt(i * 2 + k, M.clone().multiply(L.makeTranslation(s * 0.11, 0.92, 0)).multiply(R.makeRotationX(sw)));
		for (const [k, s, sw] of [[0, -1, la], [1, 1, ra]]) arms.setMatrixAt(i * 2 + k, body.clone().multiply(L.makeTranslation(s * 0.3, 1.42, 0)).multiply(R.makeRotationX(sw)).multiply(R.makeRotationZ(s * 0.06)));
	}
	function end() {
		T[0].count = nt[0]; T[1].count = nt[1]; heads.count = hats.count = n; legs.count = arms.count = n * 2;
		for (const I of [...T, legs, arms, heads, hats]) { I.instanceMatrix.needsUpdate = true; if (I.instanceColor) I.instanceColor.needsUpdate = true; }
	}
	return { begin, set, end, count: () => n, cap };
}
