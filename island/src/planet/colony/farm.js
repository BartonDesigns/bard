// The dome farm: what grows under the glass, in racks round the core. Each of the eight bays
// is one kind of bed: lettuces and greens in tiers of NFT channels (the clear ones show the
// roots trailing in the nutrient film), tomatoes up a trellis, dwarf wheat in a deep tray,
// strawberries and herbs in grow towers, peppers and soybeans in troughs; the lamps over
// them pink-violet, white over a few; nutrient tanks and their pipes at the ends; a harvest
// cart by the basil. All of it is the kit's (one merged mesh with the hub), painted per
// piece, the plants in the living look (mats.js 8), dropped with the near detail.

import * as THREE from 'three';
import { box, cbox, blob, sweep } from '../alienkit.js';

const HULL = 0, LAMP = 5, LIVE = 8;
const put = (X, F, mode, tint, g, lx, ly, lz, ry = 0, rx = 0, rz = 0, s = 1) => X.K.add('shell', F.put(g, lx, ly, lz, ry, rx, rz, s), { tint, glow: mode, near: true });
const glass = (X, F, g, lx, ly, lz) => X.K.add('glass', F.put(g, lx, ly, lz), {});
const LEAF = [[0.22, 0.52, 0.16], [0.3, 0.6, 0.2], [0.42, 0.66, 0.24], [0.18, 0.42, 0.14]];
const cyl = (r0, r1, h, n = 6) => new THREE.CylinderGeometry(r0, r1, h, n);

// ---------- the plants: a few shapes each, close enough to read as food ----------
function lettuce(X, F, x, y, z, r, red) {
	const c = red ? [0.45, 0.16, 0.2] : LEAF[2];
	for (let k = 0; k < 5; k++) {
		const a = k / 5 * Math.PI * 2 + r() * 0.6;
		put(X, F, LIVE, k % 2 ? c : LEAF[1], blob(0.09, 0.05, 0.06, 5), x + Math.sin(a) * 0.06, y + 0.05, z + Math.cos(a) * 0.06, a, -0.5);
	}
	put(X, F, LIVE, [0.62, 0.8, 0.36], blob(0.06, 0.06, 0.06, 5), x, y + 0.07, z);
}
function herb(X, F, x, y, z, r) {
	put(X, F, LIVE, [0.25, 0.4, 0.2], cyl(0.006, 0.008, 0.18, 4), x, y + 0.09, z);
	for (let k = 0; k < 4; k++) put(X, F, LIVE, LEAF[(k + 1) % 3], blob(0.045, 0.025, 0.03, 4), x + (r() - 0.5) * 0.08, y + 0.08 + k * 0.035, z + (r() - 0.5) * 0.08, r() * 6);
}
function strawberry(X, F, x, y, z, r) {
	for (let k = 0; k < 3; k++) put(X, F, LIVE, LEAF[k % 4], blob(0.06, 0.02, 0.05, 4), x + (r() - 0.5) * 0.1, y + 0.03, z + (r() - 0.5) * 0.1, r() * 6);
	for (let k = 0; k < 2; k++) put(X, F, LIVE, r() < 0.7 ? [0.82, 0.08, 0.1] : [0.9, 0.9, 0.6], blob(0.022, 0.03, 0.022, 5), x + (r() - 0.5) * 0.14, y - 0.04, z + (r() - 0.5) * 0.14, 0, Math.PI);
}
function tomato(X, F, x, y, z, h, r) {
	put(X, F, LIVE, [0.28, 0.42, 0.2], cyl(0.012, 0.018, h, 5), x, y + h / 2, z);
	for (let k = 0; k < 6; k++) {
		const yy = y + 0.3 + k / 6 * (h - 0.3), a = r() * 6;
		put(X, F, LIVE, LEAF[k % 4], blob(0.14, 0.05, 0.1, 5), x + Math.sin(a) * 0.08, yy, z + Math.cos(a) * 0.08, a, 0.3);
		if (k > 1 && r() < 0.8) for (let q = 0; q < 3; q++) put(X, F, LIVE, q === 2 && r() < 0.5 ? [0.85, 0.55, 0.1] : r() < 0.3 ? [0.4, 0.62, 0.2] : [0.85, 0.12, 0.08], blob(0.035, 0.032, 0.035, 6), x + Math.sin(a + 2 + q) * 0.12, yy - 0.08 - q * 0.03, z + Math.cos(a + 2 + q) * 0.12);
	}
}
function wheat(X, F, x, y, z, r) {
	const hh = 0.38 + r() * 0.1;
	put(X, F, LIVE, [0.62, 0.66, 0.3], cyl(0.004, 0.005, hh, 3), x, y + hh / 2, z, 0, (r() - 0.5) * 0.2);
	put(X, F, LIVE, [0.86, 0.72, 0.36], blob(0.012, 0.045, 0.012, 4), x, y + hh + 0.03, z);
}
function pepper(X, F, x, y, z, r) {
	for (let k = 0; k < 4; k++) put(X, F, LIVE, LEAF[k % 4], blob(0.1, 0.07, 0.1, 5), x + (r() - 0.5) * 0.12, y + 0.18 + k * 0.08, z + (r() - 0.5) * 0.12, r() * 6);
	const c = [[0.85, 0.12, 0.08], [0.95, 0.72, 0.1], [0.3, 0.55, 0.15]][Math.floor(r() * 3)];
	for (let k = 0; k < 2; k++) put(X, F, LIVE, c, blob(0.03, 0.06, 0.03, 6), x + (r() - 0.5) * 0.18, y + 0.2 + r() * 0.15, z + (r() - 0.5) * 0.18);
}
function soy(X, F, x, y, z, r) {
	for (let k = 0; k < 6; k++) put(X, F, LIVE, LEAF[(k + 2) % 4], blob(0.06, 0.02, 0.04, 4), x + (r() - 0.5) * 0.2, y + 0.12 + r() * 0.2, z + (r() - 0.5) * 0.2, r() * 6, r() - 0.5);
	for (let k = 0; k < 3; k++) put(X, F, LIVE, [0.5, 0.6, 0.3], blob(0.012, 0.04, 0.012, 4), x + (r() - 0.5) * 0.15, y + 0.15 + r() * 0.1, z + (r() - 0.5) * 0.15, 0, 0.4);
}
// roots trailing under a clear channel
function roots(X, F, x, y, z, r) { for (let k = 0; k < 3; k++) put(X, F, LIVE, [0.92, 0.88, 0.72], cyl(0.003, 0.001, 0.08, 3), x + (r() - 0.5) * 0.05, y - 0.04, z + (r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.4); }

// a bay of the farm on its frame (local z along the radius, the bay's middle at z0)
export const CROPS = ['lettuce', 'tomato', 'strawberry', 'wheat', 'herbs', 'pepper', 'soy', 'greens'];
export function farmBay(X, F, i, z0, r, S) {
	const kind = CROPS[i % CROPS.length], L = 4.4, top = 2.25;
	const frameCol = [0.82, 0.83, 0.84];
	// the lamps over every bay: pink-violet, white over the wheat and the tomatoes
	const white = kind === 'wheat' || kind === 'tomato';
	put(X, F, LAMP, white ? [1, 0.96, 0.9] : [0.95, 0.35, 0.9], box(0.5, 0.06, L - 0.2), 0, top + 0.6, z0);
	for (const sz of [-1, 1]) put(X, F, HULL, frameCol, box(0.05, top + 0.65, 0.05), 0, (top + 0.65) / 2, z0 + sz * (L / 2 - 0.05));
	if (kind === 'lettuce' || kind === 'greens' || kind === 'herbs') {
		// tiers of NFT channels both sides of a spine
		for (const sx of [-0.45, 0.45]) for (let t = 0; t < 3; t++) {
			const y = 0.35 + t * 0.62, clear = (t === 1 && sx < 0) || kind === 'greens' && t === 0;
			if (clear) glass(X, F, box(0.16, 0.08, L - 0.3), sx, y, z0);
			else put(X, F, HULL, [0.9, 0.9, 0.88], box(0.16, 0.08, L - 0.3), sx, y, z0);
			put(X, F, LAMP, t === 2 ? [1, 0.95, 0.9] : [0.9, 0.3, 0.85], box(0.14, 0.02, L - 0.4), sx, y + 0.5, z0);
			for (let k = 0; k < 11; k++) {
				const z = z0 - L / 2 + 0.35 + k * 0.37;
				if (kind === 'herbs') herb(X, F, sx, y + 0.04, z, r); else lettuce(X, F, sx, y + 0.04, z, r, kind === 'greens' && k % 3 === 0);
				if (clear) roots(X, F, sx, y, z, r);
			}
		}
		for (const sx of [-0.45, 0.45]) put(X, F, HULL, frameCol, box(0.04, 1.7, 0.04), sx * 1.25, 0.85, z0);
	} else if (kind === 'tomato') {
		put(X, F, HULL, [0.85, 0.85, 0.82], cbox(0.9, 0.35, L - 0.2, 0.04), 0, 0.18, z0);
		for (const sx of [-0.25, 0.25]) put(X, F, HULL, [0.6, 0.6, 0.62], box(0.02, 0.02, L - 0.3), sx, 2.0, z0);
		for (let k = 0; k < 7; k++) for (const sx of [-0.25, 0.25]) tomato(X, F, sx, 0.35, z0 - L / 2 + 0.4 + k * 0.6, 1.6, r);
	} else if (kind === 'wheat') {
		put(X, F, HULL, [0.85, 0.85, 0.82], cbox(1.5, 0.45, L - 0.2, 0.04), 0, 0.23, z0);
		put(X, F, LIVE, [0.3, 0.24, 0.16], box(1.4, 0.02, L - 0.3), 0, 0.46, z0);
		for (let k = 0; k < 220; k++) wheat(X, F, (r() - 0.5) * 1.3, 0.46, z0 + (r() - 0.5) * (L - 0.4), r);
	} else if (kind === 'strawberry') {
		// grow towers: a column of pockets, a plant spilling from each
		for (let k = 0; k < 4; k++) {
			const z = z0 - L / 2 + 0.6 + k * 1.05;
			put(X, F, HULL, [0.9, 0.9, 0.88], cyl(0.12, 0.12, 1.9, 8), 0, 0.95, z);
			for (let q = 0; q < 10; q++) { const a = q * 2.4, y = 0.35 + q * 0.16; strawberry(X, F, Math.sin(a) * 0.16, y, z + Math.cos(a) * 0.16, r); }
		}
	} else {
		// troughs: peppers or soybeans
		for (const sx of [-0.4, 0.4]) {
			put(X, F, HULL, [0.85, 0.85, 0.82], cbox(0.6, 0.4, L - 0.2, 0.04), sx, 0.2, z0);
			for (let k = 0; k < 7; k++) (kind === 'pepper' ? pepper : soy)(X, F, sx, 0.4, z0 - L / 2 + 0.35 + k * 0.62, r);
		}
	}
	// a nutrient tank at the inner end, its pipe along the bay
	put(X, F, HULL, i % 2 ? [0.2, 0.45, 0.7] : [0.3, 0.6, 0.45], cyl(0.28, 0.28, 0.8, 10), 0.75, 0.4, z0 - L / 2 - 0.25);
	X.K.add('shell', sweep([F.p(0.75, 0.82, z0 - L / 2 - 0.25), F.p(0.75, 1.1, z0 - L / 2 + 0.2), F.p(0.15, 1.1, z0 + L / 2 - 0.3)], 0.025, 5, { seg: 6 }), { tint: [0.7, 0.72, 0.74], glow: HULL, near: true });
	// the harvest cart by the basil
	if (kind === 'herbs') {
		put(X, F, HULL, S?.accent || [0.9, 0.5, 0.1], cbox(0.6, 0.35, 0.9, 0.04), 1.25, 0.45, z0 + 1.2);
		for (const [cx, cz] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.38], [0.25, 0.38]]) put(X, F, HULL, [0.15, 0.15, 0.16], cyl(0.07, 0.07, 0.05, 8), 1.25 + cx, 0.08, z0 + 1.2 + cz, 0, 0, Math.PI / 2);
		for (let k = 0; k < 6; k++) lettuce(X, F, 1.1 + (k % 2) * 0.3, 0.6, z0 + 0.9 + (k >> 1) * 0.28, r, false);
	}
	return kind;
}
