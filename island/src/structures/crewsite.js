// The site's things, each in proportion and of what it is made of. Mesh fence panels (3.5 by
// 2 m, round galvanised frames) standing in their rubber feet, coupled by clamps top and
// bottom, a stay behind every few; the company's banner tied on the street side. Water-filled
// barriers, red and white, locked end to end, a lamp on the end ones. Traffic cones with their
// two reflective collars on a rubber foot. The debris box (a roll-off skip) on its runners, ribbed,
// its doors at the back, full of rubble while the wreck is cleared. The site office: a trailer
// on blocks, ribbed walls, windows with grilles, its door up three steps with a rail, the air
// conditioner on its end, its signs. The portable toilet. A light tower: its generator on two
// wheels, the mast up, four lamps over the work. Heaps of sand and gravel, lumber on bearers,
// scaffold boards, cement in sacks, a wheelbarrow, a generator. Coordinates are the site's own
// (its origin on the ground), y the ground under the thing.

import { COLORS as C, rect } from './crewkit.js';
import { pallet, blocksPallet, barsBundle, glassFrame } from './crewtrucks.js';

// ---------- the fence ----------
// a panel from a to b ([x, y, z], y its ground), its outside toward n ([nx, nz]); the cloth gets its
// mesh; banner: an atlas rect for the street side, or null. foot: whether to stand a foot at a
// (the next panel shares the one at b)
export function herasPanel(V, CL, a, b, n, banner = null, foot = true, stay = false) {
	const H = 2.0, y0 = Math.min(a[1], b[1]) + 0.12, dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ry = Math.atan2(dx, dz);
	const A = [a[0] + ux * 0.03, a[2] + uz * 0.03], B = [b[0] - ux * 0.03, b[2] - uz * 0.03];
	V.m('rubber', 0.5);
	if (foot) V.box(a[0], a[1], a[2], 0.2, 0.14, 0.68, [0.16, 0.16, 0.17], ry + Math.PI / 2);
	V.m('galv', 0.3);
	V.tube([A[0], y0, A[1]], [A[0], y0 + H, A[1]], 0.021, C.galv, 6);
	V.tube([B[0], y0, B[1]], [B[0], y0 + H, B[1]], 0.021, C.galv, 6);
	V.tube([A[0], y0 + H, A[1]], [B[0], y0 + H, B[1]], 0.019, C.galv, 6);
	V.tube([A[0], y0 + 0.04, A[1]], [B[0], y0 + 0.04, B[1]], 0.019, C.galv, 6);
	if (!V.far) {
		// (the clamps coupling it to the next, top and low)
		V.m('steel', 0.4);
		for (const y of [y0 + 1.85, y0 + 0.35]) V.cyl(b[0], y, b[2], 0.045, 0.12, 'y', [0.55, 0.57, 0.58], 8);
		// (a stay behind: a strut from the top rail back to a foot)
		if (stay) { const m = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2], f = [m[0] - n[0] * 1.3, m[1] - n[1] * 1.3]; V.m('galv', 0.4); V.tube([m[0], y0 + 1.7, m[1]], [f[0], a[1] + 0.12, f[1]], 0.018, C.galv, 5); V.m('rubber', 0.5); V.box(f[0], a[1], f[1], 0.2, 0.12, 0.6, [0.16, 0.16, 0.17], ry + Math.PI / 2); }
	}
	CL.quad([A[0], y0 + 0.04, A[1]], [B[0], y0 + 0.04, B[1]], [B[0], y0 + H, B[1]], [A[0], y0 + H, A[1]], [0.5, 0], L / 0.85, H / 0.85 * 0.4, 0);
	if (banner) {
		// (tied on the street side, a hand off the mesh)
		const o = 0.045, bx = (a[0] + b[0]) / 2 + n[0] * o, bz = (a[2] + b[2]) / 2 + n[1] * o, rn = Math.atan2(n[0], n[1]);
		V.m('banner'); V.decal(bx, y0 + 1.05, bz, L - 0.25, Math.min(1.1, (L - 0.25) * 0.19), banner, [0.9, 0.9, 0.9], rn);
		V.decal(bx - n[0] * 0.006, y0 + 1.05, bz - n[1] * 0.006, L - 0.25, Math.min(1.1, (L - 0.25) * 0.19), banner, [0.9, 0.9, 0.9], rn + Math.PI);
	}
}
// a gate: two panels swung open into the site
export function gate(V, CL, a, b, n) {
	const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], dx = m[0] - a[0], dz = m[2] - a[2], L = Math.hypot(dx, dz);
	const open = 1.05;
	for (const [p, s] of [[a, 1], [b, -1]]) {
		const ux = (s > 0 ? dx : -dx) / L, uz = (s > 0 ? dz : -dz) / L, c = Math.cos(open), sn = Math.sin(open);
		const ex = p[0] + (ux * c - n[0] * sn) * L * 0.95, ez = p[2] + (uz * c - n[1] * sn) * L * 0.95;
		herasPanel(V, CL, s > 0 ? p : [ex, p[1], ez], s > 0 ? [ex, p[1], ez] : p, n, null, true, false);
	}
}

// ---------- barriers, cones ----------
export function barrier(V, x, y, z, ry, red, lamp = false) {
	V.m('shiny', 0.5);
	const col = red ? [0.8, 0.1, 0.08] : [0.93, 0.93, 0.9];
	const prof = [[-0.24, 0], [0.24, 0], [0.2, 0.18], [0.11, 0.62], [0.12, 0.8], [-0.12, 0.8], [-0.11, 0.62], [-0.2, 0.18]];
	const W = V.frame(x, y, z, ry);
	W.m('shiny', 0.5).ext(prof, -0.6, 0.6, col, 0.025);
	if (!V.far) {
		W.m('plastic'); W.mid(0, 0.81, 0, 0.12, 0.02, 0.14, [0.2, 0.2, 0.2]); W.mid(-0.63, 0.45, 0, 0.08, 0.5, 0.16, col); W.mid(0.63, 0.25, 0, 0.08, 0.5, 0.16, col);
		W.m('reflect'); W.mid(0, 0.5, 0.135, 0.9, 0.08, 0.01, C.white); W.mid(0, 0.5, -0.135, 0.9, 0.08, 0.01, C.white);
	}
	if (lamp) { W.m('plastic'); W.mid(0, 0.86, 0, 0.06, 0.12, 0.06, C.black); W.m('beacon'); W.cyl(0, 1.0, 0, 0.09, 0.18, 'z', C.amber, 10); }
}
export function cone(V, x, y, z) {
	V.m('rubber', 0.6); V.box(x, y, z, 0.38, 0.035, 0.38, [0.08, 0.08, 0.08]);
	V.m('shiny', 0.55);
	const seg = [[0.17, 0.035], [0.155, 0.12], [0.12, 0.3], [0.1, 0.4], [0.065, 0.58], [0.04, 0.7], [0.03, 0.72]];
	V.lathe(seg, x, y, z, 'y', [0.98, 0.36, 0.05], 12);
	V.m('reflect');
	V.lathe([[0.124, 0.29], [0.113, 0.355]], x, y + 0.004, z, 'y', C.white, 12);
	V.lathe([[0.095, 0.43], [0.081, 0.5]], x, y + 0.004, z, 'y', C.white, 12);
}

// ---------- the debris box ----------
export function debrisBox(V, x, y, z, ry, full, co) {
	const W = V.frame(x, y, z, ry), L = 5.6, w = 2.3, h = 1.45;
	W.m('worn', 0.9);
	for (const s of [-1, 1]) W.mid(s * 0.5, 0.1, 0, 0.16, 0.2, L, C.dark);
	W.cyl(0, 0.12, -L / 2 + 0.2, 0.12, 1.4, 'x', C.dark, 10);
	W.m('paintWorn', 0.95);
	const col = co ? co.paint : C.yellow;
	W.mid(0, 0.26, 0, w, 0.12, L, col);
	for (const s of [-1, 1]) { W.mid(s * w / 2, 0.2 + h / 2, 0, 0.06, h, L, col); W.mid(s * (w / 2 + 0.05), 0.2 + h, 0, 0.14, 0.12, L, col); }
	W.mid(0, 0.2 + h / 2, L / 2, w, h, 0.06, col, 0, -0.12, 0);
	W.mid(0, 0.2 + h / 2, -L / 2, w + 0.06, h, 0.08, col);
	if (!V.far) {
		for (const s of [-1, 1]) for (let k = 0; k < 7; k++) W.mid(s * (w / 2 + 0.05), 0.2 + h / 2, -L / 2 + 0.4 + k * (L - 0.8) / 6, 0.08, h - 0.05, 0.1, col);
		W.m('worn'); for (const s of [-1, 1]) { W.mid(s * 0.55, 0.2 + h * 0.55, -L / 2 - 0.06, 0.08, h * 0.9, 0.06, C.dark); W.mid(s * 0.35, 0.2 + h * 0.4, -L / 2 - 0.07, 0.5, 0.05, 0.05, C.dark); }
		W.m('worn'); W.mid(0, 0.55, L / 2 + 0.12, 0.6, 0.4, 0.2, C.dark);
	}
	if (co) { W.m('decal', 0.7); for (const s of [-1, 1]) W.decal(s * (w / 2 + 0.105), 0.2 + h * 0.55, 0, 2.6, 0.58, rect('side' + co.i), col, s * Math.PI / 2); }
	if (full) { W.m('rubble'); W.heap(0, 0.2 + h - 0.45, 0, w - 0.1, L - 0.2, 0.75, [C.rubble, C.concrete, [0.45, 0.42, 0.4], [0.6, 0.56, 0.5]], 11, 16); if (!V.far) { W.m('rubble'); for (let k = 0; k < 6; k++) W.mid(((k * 41) % 7 - 3) * 0.25, 0.2 + h + 0.15, -L / 2 + 0.8 + k * 0.8, 0.4, 0.22, 0.5, k % 2 ? C.concrete : [0.5, 0.47, 0.43], k, k * 0.4, 0.2); } }
}

// ---------- the site office, the toilet ----------
export function cabin(V, x, y, z, ry, doorSide = 1) {
	const W = V.frame(x, y, z, ry), L = 6.0, w = 2.45, h = 2.55, b = 0.45;
	W.m('concrete', 0.6); for (const zz of [-2.4, 0, 2.4]) for (const s of [-1, 1]) W.box(s * 0.9, 0, zz, 0.4, b - 0.05, 0.4, C.concrete);
	W.m('worn', 0.8); W.box(0, b - 0.1, 0, w, 0.12, L, C.dark);
	W.m('paintWorn', 0.5); W.box(0, b, 0, w, h, L, C.cabin);
	W.m('paint', 0.4); W.box(0, b + h, 0, w + 0.08, 0.1, L + 0.08, [0.6, 0.62, 0.62]);
	// (the ribs of its walls)
	if (!V.far) { W.m('paintWorn', 0.5); for (const s of [-1, 1]) for (let k = 0; k < 15; k++) W.box(s * (w / 2 + 0.01), b + 0.05, -L / 2 + 0.2 + k * (L - 0.4) / 14, 0.03, h - 0.1, 0.05, [0.8, 0.8, 0.76]); }
	// windows on the door side with their frames and grilles, the door, three steps and a rail
	const sx = doorSide * (w / 2 + 0.035);
	for (const zz of [-1.7, 1.6]) {
		W.m('paint', 0.3); W.mid(sx, b + 1.55, zz, 0.05, 0.95, 1.25, [0.75, 0.76, 0.77]);
		W.m('glass'); W.mid(sx + doorSide * 0.012, b + 1.55, zz, 0.02, 0.82, 1.12, C.glass);
		if (!V.far) { W.m('steel', 0.5); for (let k = 0; k < 6; k++) W.mid(sx + doorSide * 0.04, b + 1.55, zz - 0.5 + k * 0.2, 0.02, 0.84, 0.02, C.dark); }
	}
	W.m('paint', 0.5); W.mid(sx, b + 1.05, 0, 0.05, 2.05, 0.95, [0.32, 0.34, 0.36]);
	W.m('chrome'); W.mid(sx + doorSide * 0.04, b + 1.0, 0.33, 0.04, 0.04, 0.14, C.chrome);
	W.m('decal'); W.decal(sx + doorSide * 0.03, b + 1.95, 0, 0.8, 0.23, rect('office'), [0.32, 0.34, 0.36], doorSide * Math.PI / 2);
	W.decal(doorSide * (w / 2 + 0.02), b + 1.55, -0.78, 0.5, 0.15 * 0.5 / 0.34 * 0.34, rect('visitors'), C.cabin, doorSide * Math.PI / 2);
	W.decal(doorSide * (w / 2 + 0.02), b + 1.5, 0.75, 0.38, 0.33, rect('ppe'), C.cabin, doorSide * Math.PI / 2);
	W.m('galv', 0.6);
	for (let k = 0; k < 3; k++) W.box(doorSide * (w / 2 + 0.25 + k * 0.28), 0, 0, 0.3, b - 0.02 - k * 0.15, 1.1, C.galv);
	if (!V.far) for (const zz of [-0.58, 0.58]) { W.tube([doorSide * (w / 2 + 0.95), 0, zz], [doorSide * (w / 2 + 0.95), b + 0.95, zz], 0.022, C.galv); W.tube([doorSide * (w / 2 + 0.95), b + 0.95, zz], [doorSide * (w / 2 + 0.1), b + 0.95, zz], 0.022, C.galv); W.tube([doorSide * (w / 2 + 0.95), 0.9, zz], [doorSide * (w / 2 + 0.1), b + 0.9 + 0.0, zz], 0.018, C.galv); }
	// the air conditioner on its end, a lamp over the door
	W.m('paint', 0.5); W.rbox(0, b + 1.7, L / 2 + 0.3, 0.9, 0.7, 0.55, [0.86, 0.85, 0.8], 0.04);
	if (!V.far) { W.m('worn'); W.mid(0, b + 1.7, L / 2 + 0.58, 0.7, 0.5, 0.02, [0.3, 0.3, 0.3]); }
	W.m('worklamp'); W.mid(sx + doorSide * 0.08, b + 2.25, 0, 0.12, 0.08, 0.3, C.lamp);
}
export function toilet(V, x, y, z, ry) {
	const W = V.frame(x, y, z, ry);
	W.m('plastic', 0.4); W.box(0, 0, 0, 1.15, 0.08, 1.15, [0.1, 0.24, 0.5]);
	W.m('shiny', 0.45); W.rbox(0, 1.18, 0, 1.1, 2.2, 1.1, C.loo, 0.06);
	W.m('shiny', 0.3); W.lathe([[0.6, 0], [0.55, 0.08], [0.3, 0.17], [0, 0.19]], 0, 2.27, 0, 'y', [0.93, 0.93, 0.9], 8);
	W.m('plastic'); W.cyl(0.38, 2.45, -0.38, 0.05, 0.4, 'y', [0.14, 0.14, 0.15], 6);
	W.m('shiny', 0.45); W.mid(0, 1.1, 0.565, 0.82, 1.95, 0.04, [0.11, 0.28, 0.58]);
	W.m('decal'); W.decal(0, 1.7, 0.59, 0.5, 0.25, rect('loo'), [0.11, 0.28, 0.58]);
	if (!V.far) { W.m('reflect'); W.mid(-0.3, 1.05, 0.59, 0.1, 0.05, 0.02, [0.3, 0.8, 0.3]); W.m('steel'); W.mid(0.3, 1.05, 0.59, 0.05, 0.2, 0.03, C.steel); }
}

// ---------- the light tower ----------
// aimed: the yaw its lamps face. Returns where its lamps are (local to the site)
export function lightTower(V, x, y, z, ry, aimed) {
	const W = V.frame(x, y, z, ry);
	W.m('paintWorn', 0.6);
	W.rbox(0, 0.75, 0, 1.25, 0.95, 2.1, [0.96, 0.72, 0.08], 0.05);
	W.m('plastic'); if (!V.far) for (let k = 0; k < 5; k++) W.mid(0.63, 0.8, -0.6 + k * 0.3, 0.02, 0.5, 0.12, C.black);
	W.m('worn', 0.7); W.mid(0, 0.25, 0, 0.9, 0.12, 2.6, C.dark); W.bar([0, 0.25, 1.3], [0, 0.35, 2.1], 0.04, C.dark);
	for (const s of [-1, 1]) { W.spin(0.28, 0, 1); W.m('rubber'); W.cyl(s * 0.72, 0.28, 0, 0.28, 0.18, 'x', C.tyre, 12); W.spin(null); }
	W.m('worn'); for (const s of [-1, 1]) { W.bar([s * 0.5, 0.3, -0.9], [s * 1.5, 0.15, -0.9], 0.04, C.dark); W.box(s * 1.5, 0, -0.9, 0.2, 0.15, 0.2, C.dark); }
	W.m('galv'); W.cyl(0, 3.6, -0.7, 0.08, 6.0, 'y', C.galv, 8); W.cyl(0, 6.9, -0.7, 0.055, 0.8, 'y', C.galv, 8);
	W.m('paint', 0.4); W.mid(0, 7.25, -0.7, 1.4, 0.08, 0.08, C.dark, aimed - ry);
	const c = Math.cos(aimed - ry), s = Math.sin(aimed - ry), heads = [];
	for (const [u, v] of [[-0.55, 0.3], [-0.2, 0.42], [0.2, 0.42], [0.55, 0.3]]) {
		const lx = c * u, lz = -0.7 - s * u, hy = 7.25 + v * 0.6;
		W.m('paint', 0.4); W.mid(lx, hy, lz, 0.42, 0.32, 0.12, [0.25, 0.26, 0.27], aimed - ry, 0.5);
		W.m('worklamp'); W.mid(lx + s * 0.065, hy - 0.03, lz + c * 0.065, 0.36, 0.26, 0.02, C.lamp, aimed - ry, 0.5);
		heads.push([x + Math.cos(ry) * (lx) + Math.sin(ry) * lz, y + hy, z - Math.sin(ry) * lx + Math.cos(ry) * lz]);
	}
	W.m('decal'); W.decal(0.64, 0.8, 0.55, 0.5, 0.25, rect('lamp'), [0.96, 0.72, 0.08], Math.PI / 2);
	return heads;
}

// ---------- materials and tools ----------
export function sandHeap(V, x, y, z, ry, gravel = false) {
	V.m('dirt'); V.heap(x, y, z, 2.6, 2.2, gravel ? 0.75 : 0.85, gravel ? [C.gravel, [0.5, 0.49, 0.46], [0.62, 0.61, 0.58]] : [C.sand, [0.74, 0.64, 0.46], [0.82, 0.72, 0.55]], gravel ? 5 : 9, 9, ry);
}
export function lumber(V, x, y, z, ry, len = 3.6) {
	const W = V.frame(x, y, z, ry);
	W.m('wood', 0.5);
	for (const zz of [-len * 0.35, len * 0.35]) W.box(0, 0, zz, 1.1, 0.1, 0.1, [0.5, 0.4, 0.28]);
	for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) W.box(-0.47 + k * 0.188, 0.1 + r * 0.095, 0, 0.18, 0.09, len - (k % 2) * 0.1, k % 2 ? C.wood : [0.7, 0.56, 0.38]);
	W.m('plastic'); W.box(0, 0.1, len * 0.2, 1.14, 0.4, 0.03, [0.15, 0.15, 0.16]);
}
export function boards(V, x, y, z, ry) {
	const W = V.frame(x, y, z, ry);
	W.m('wood', 0.6);
	for (const zz of [-1.4, 1.4]) W.box(0, 0, zz, 1.0, 0.08, 0.1, [0.5, 0.4, 0.28]);
	for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) W.box(-0.34 + k * 0.226, 0.08 + r * 0.04, 0, 0.22, 0.038, 3.9, r % 3 ? C.wood : [0.6, 0.48, 0.32]);
	if (!V.far) { W.m('worn'); for (const zz of [-1.94, 1.94]) W.box(0, 0.08, zz, 0.9, 0.32, 0.01, C.dark); }
}
export function cementPallet(V, x, y, z, ry) {
	pallet(V, x, y, z, ry);
	const W = V.frame(x, y, z, ry);
	W.m('cloth', 0.4);
	for (let r = 0; r < 5; r++) for (let k = 0; k < 2; k++) for (let j = 0; j < (r % 2 ? 2 : 3); j++) {
		const along = r % 2 ? [(-0.25 + j * 0.5), (-0.24 + k * 0.48)] : [(-0.36 + j * 0.36) * 1.1, (-0.24 + k * 0.48)];
		W.mid(along[0] * 0.95, 0.2 + r * 0.13, along[1], r % 2 ? 0.46 : 0.36, 0.12, 0.44, (r + k + j) % 3 ? [0.88, 0.84, 0.74] : [0.82, 0.78, 0.68]);
	}
}
export function wheelbarrow(V, x, y, z, ry) {
	const W = V.frame(x, y, z, ry);
	W.m('paintWorn', 0.8); W.lathe([[0.1, 0], [0.35, 0.05], [0.42, 0.28], [0.43, 0.3]], 0, 0.42, 0, 'y', [0.2, 0.45, 0.25], 10);
	W.m('worn'); for (const s of [-1, 1]) W.bar([s * 0.22, 0.48, 0.45], [s * 0.3, 0.6, -0.95], 0.02, C.dark);
	for (const s of [-1, 1]) W.bar([s * 0.2, 0.42, -0.35], [s * 0.2, 0.0, -0.4], 0.016, C.dark);
	W.m('rubber'); W.cyl(0, 0.2, 0.62, 0.2, 0.09, 'x', C.tyre, 12);
	W.m('dirt'); W.heap(0, 0.6, 0, 0.6, 0.6, 0.12, [[0.55, 0.54, 0.52], [0.5, 0.49, 0.47]], 4, 5);
}
export function generator(V, x, y, z, ry) {
	const W = V.frame(x, y, z, ry);
	W.m('worn'); W.box(0, 0, 0, 0.9, 0.1, 1.5, C.dark);
	W.m('paintWorn', 0.6); W.rbox(0, 0.62, 0, 0.85, 1.0, 1.45, [0.16, 0.42, 0.24], 0.05);
	W.m('plastic'); if (!V.far) for (let k = 0; k < 5; k++) W.mid(0.43, 0.7, -0.5 + k * 0.25, 0.02, 0.5, 0.1, C.black);
	W.m('chrome'); W.cyl(-0.2, 1.2, -0.5, 0.04, 0.2, 'y', C.chrome, 6);
}
// a stack of what the stage brings, on the ground: blocks, bars, glass, formwork
export function stock(V, x, y, z, ry, what) {
	if (what === 'blocks') blocksPallet(V, x, y, z, ry);
	else if (what === 'bars') { const W = V.frame(x, y, z, ry); W.m('wood'); for (const zz of [-2, 0, 2]) W.box(0, 0, zz, 1.2, 0.1, 0.12, C.wood); barsBundle(W, -0.35, 0.1, 0, 0, 5.4); barsBundle(W, 0.35, 0.1, 0, 0, 5.4); }
	else if (what === 'glass') glassFrame(V, x, y, z, ry, 2.6);
	else if (what === 'cement') cementPallet(V, x, y, z, ry);
	else if (what === 'boards') boards(V, x, y, z, ry);
	else if (what === 'lumber') lumber(V, x, y, z, ry);
	else pallet(V, x, y, z, ry);
}
