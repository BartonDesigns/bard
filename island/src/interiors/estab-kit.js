// The drawings of the businesses' things (estab-fit.js places them): booths, the pass, ranges,
// prep tables, a fryer, a pizza oven, the front desk with its keys, luggage racks, clothes rails
// and mannequins, salon chairs and their mirrors, a basin, a car lift, tool chests and tyres, a
// bar and its back bar, stools, a wall of gear, a canoe on its brackets, bread racks, a deck
// oven, a dentist's chair, an examination table, waiting chairs, a treadmill, a weight rack,
// yoga mats, a menu board, a host's stand, cots. Each in its own frame like the rest of the
// kit (kit.js): width along x, depth along z, its front toward +z, standing on y = 0; added
// to the kit on import (interiors/index.js and bay/houses.js import it). No lamps: the rooms'
// light is someone else's (estab-fit.js leaves anchors where the lamps go).

import { addKit } from './kit.js';
import { lin } from '../bay/housekit.js';

const pick = (l, v) => l[((Math.floor(v * 9973) % l.length) + l.length) % l.length];       // (v may be negative: a place left of an item's middle)
const BRIGHT = [[0.8, 0.25, 0.2], [0.9, 0.7, 0.2], [0.25, 0.5, 0.7], [0.35, 0.6, 0.3], [0.85, 0.5, 0.6], [0.95, 0.9, 0.8], [0.55, 0.35, 0.6]];
const WOODS = [[0.36, 0.22, 0.14], [0.22, 0.14, 0.1], [0.5, 0.34, 0.2], [0.3, 0.2, 0.15]];
const STEEL = lin([0.72, 0.73, 0.75]), DARK = lin([0.06, 0.06, 0.065]), WHITE = lin([0.92, 0.91, 0.88]), BRASS = lin([0.78, 0.62, 0.3]);
const LEATHER = [[0.45, 0.12, 0.1], [0.12, 0.25, 0.2], [0.2, 0.15, 0.12], [0.55, 0.45, 0.2]];
const bx = (g, k, x0, y0, z0, x1, y1, z1, c) => g.box(k, x0, y0, z0, x1, y1, z1, c);

// ---------- clothes, the way a shop hangs them ----------
// a rail's worth goes together: one of these ranges (srgb), its colours in runs along it
export const RANGES = [
	[[0.93, 0.91, 0.86], [0.78, 0.74, 0.66], [0.55, 0.5, 0.44], [0.25, 0.24, 0.23], [0.1, 0.1, 0.11]],          // neutrals
	[[0.16, 0.24, 0.38], [0.22, 0.32, 0.48], [0.32, 0.43, 0.58], [0.12, 0.15, 0.24], [0.5, 0.6, 0.72]],          // denim and navy
	[[0.45, 0.32, 0.2], [0.62, 0.5, 0.32], [0.36, 0.38, 0.22], [0.72, 0.62, 0.46], [0.55, 0.26, 0.16]],          // earth
	[[0.92, 0.76, 0.78], [0.76, 0.85, 0.92], [0.85, 0.9, 0.78], [0.96, 0.9, 0.76], [0.84, 0.8, 0.93]],           // pastels
	[[0.72, 0.12, 0.15], [0.1, 0.2, 0.45], [0.95, 0.76, 0.18], [0.1, 0.45, 0.36], [0.08, 0.08, 0.1]],            // bold
	[[0.08, 0.08, 0.09], [0.96, 0.96, 0.95], [0.46, 0.46, 0.48], [0.2, 0.2, 0.22], [0.62, 0.1, 0.12]],           // black and white
];
// the cuts: [length under the hanger, half the width, thickness]
export const CUTS = { tee: [0.66, 0.24, 0.012], shirt: [0.76, 0.25, 0.016], knit: [0.64, 0.25, 0.034], dress: [1.06, 0.2, 0.016], coat: [0.96, 0.27, 0.05], jeans: [0.56, 0.2, 0.03] };
const CUT_KEYS = Object.keys(CUTS);
// what the mannequins wear (srgb): top, low (the trousers or the skirt), long sleeves, a coat
const OUTFITS = [
	{ top: [0.95, 0.95, 0.93], low: [0.2, 0.3, 0.48], cut: 'pants' },
	{ top: [0.12, 0.16, 0.28], low: [0.78, 0.7, 0.55], cut: 'pants', long: true, shoe: [0.35, 0.2, 0.12] },
	{ top: [0.72, 0.12, 0.15], cut: 'dress', shoe: [0.1, 0.08, 0.08] },
	{ top: [0.08, 0.08, 0.09], low: [0.1, 0.1, 0.11], cut: 'skirt', long: true },
	{ top: [0.36, 0.38, 0.22], low: [0.14, 0.17, 0.26], cut: 'pants', long: true, coat: true },
	{ top: [0.92, 0.78, 0.8], low: [0.95, 0.94, 0.9], cut: 'pants', shoe: [0.9, 0.88, 0.84] },
	{ top: [0.72, 0.6, 0.42], low: [0.1, 0.1, 0.11], cut: 'pants', long: true, coat: true },
	{ top: [0.76, 0.85, 0.92], cut: 'dress', long: true, shoe: [0.85, 0.8, 0.72] },
	{ top: [0.55, 0.26, 0.16], low: [0.25, 0.24, 0.23], cut: 'skirt', long: true },
];
// a garment on its hanger, side on to a rail along x at height R: at x, its middle at z (the
// hook over the rail, the hanger, the shoulders, the body; a dress's skirt wider than its top)
// (the faces nobody sees left out: a garment's top under its shoulders, its hem, the hanger's
// underside; a rack holds a few dozen of them)
const SIDES = (k) => (f) => (f === 2 || f === 3 ? null : k), TOPPED = (k) => (f) => (f === 3 ? null : k);
export function hang(g, x, z, R, cut, c, wood = false) {
	const [L, hw, t] = CUTS[cut], s = R - 0.05, x0 = x - t / 2, x1 = x + t / 2;
	bx(g, SIDES('metal'), x - 0.003, s, z - 0.004, x + 0.003, R + 0.025, z + 0.004, STEEL);
	bx(g, TOPPED(wood ? 'grain' : 'gloss'), x - 0.006, s - 0.012, z - hw + 0.02, x + 0.006, s, z + hw - 0.02, wood ? lin([0.55, 0.4, 0.25]) : DARK);
	if (cut === 'jeans') { bx(g, TOPPED('fabric'), x0, s - L, z - hw, x1, s - 0.012, z + hw, c); return; }
	bx(g, TOPPED('fabric'), x0, s - 0.09, z - hw * 0.8, x1, s - 0.008, z + hw * 0.8, c);
	if (cut === 'dress') { bx(g, SIDES('fabric'), x0, s - 0.42, z - hw, x1, s - 0.09, z + hw, c); bx(g, TOPPED('fabric'), x0, s - L, z - hw * 1.3, x1, s - 0.42, z + hw * 1.3, c); }
	else bx(g, SIDES('fabric'), x0, s - L, z - hw, x1, s - 0.09, z + hw, c);
}
// a stack of n folded garments on a table or a shelf at y, w x d, each a little askew
export function folded(g, x, z, y, w, d, c, n, rnd) {
	for (let i = 0; i < n; i++) {
		const h = 0.028 + rnd() * 0.01, ox = (rnd() - 0.5) * 0.014, oz = (rnd() - 0.5) * 0.012, f = i % 2 ? 0.94 : 1.0;
		bx(g, i === n - 1 ? TOPPED('fabric') : SIDES('fabric'), x - w / 2 + ox, y, z - d / 2 + oz, x + w / 2 + ox, y + h, z + d / 2 + oz, c.map((v) => v * f));
		y += h;
	}
	return y;
}

// ---------- the drawings ----------
const KIT = {
	// a booth: two high-backed benches facing across a table (the table along x)
	booth(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOODS, it.v)), up = lin(pick(LEATHER, it.v * 3));
		for (const s of [-1, 1]) {
			const z0 = s * D2, z1 = s * (D2 - 0.5);
			bx(g, 'grain', -W2, 0, Math.min(z0, z1), W2, 0.42, Math.max(z0, z1), wd);
			bx(g, 'fabric', -W2 + 0.03, 0.42, Math.min(z0, z1) + 0.02, W2 - 0.03, 0.5, Math.max(z0, z1) - 0.02, up);
			bx(g, 'fabric', -W2 + 0.03, 0.5, s > 0 ? D2 - 0.14 : -D2, W2 - 0.03, 1.15, s > 0 ? D2 : -D2 + 0.14, up);
		}
		bx(g, 'stone', -W2 + 0.05, 0.72, -0.32, W2 - 0.05, 0.76, 0.32, lin([0.9, 0.88, 0.84]));
		g.cyl('metal', 0, 0, 0, 0.05, 0.72, DARK, 6);
		g.cyl('gloss', -0.3, 0.76, 0.1, 0.05, 0.1, WHITE, 8); g.cyl('gloss', 0.25, 0.76, -0.12, 0.04, 0.14, lin([0.75, 0.85, 0.9]), 8);
	},
	// the pass: a steel shelf at counter height with the tickets on their rail, the plates waiting
	pass(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0, -D2, W2, 1.0, D2, STEEL);
		bx(g, 'metal', -W2 - 0.02, 1.0, -D2, W2 + 0.02, 1.04, D2 + 0.04, STEEL);
		bx(g, 'metal', -W2, 1.55, -D2, W2, 1.6, D2 * 0.6, STEEL);                       // the heat shelf over it
		for (const x of [-W2 + 0.05, W2 - 0.05]) bx(g, 'metal', x - 0.02, 1.04, -D2 + 0.02, x + 0.02, 1.55, -D2 + 0.06, STEEL);
		bx(g, 'metal', -W2, 1.45, D2 * 0.5 - 0.02, W2, 1.47, D2 * 0.5, STEEL);          // the ticket rail
		for (let x = -W2 + 0.15; x < W2 - 0.1; x += 0.18 + rnd() * 0.1) bx(g, 'matte', x, 1.32, D2 * 0.5, x + 0.08, 1.45, D2 * 0.5 + 0.005, WHITE);
		for (let x = -W2 + 0.25; x < W2 - 0.2; x += 0.5) if (rnd() < 0.6) { g.cyl('gloss', x, 1.04, 0, 0.13, 0.02, WHITE, 12); g.sphere('matte', x, 1.08, 0, 0.08, 0.04, 0.08, lin(pick([[0.8, 0.55, 0.3], [0.5, 0.6, 0.3], [0.85, 0.3, 0.2]], rnd())), 6); }
	},
	// a commercial range: burners on top, an oven below, the hood over it
	range(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0, -D2, W2, 0.9, D2, STEEL);
		bx(g, 'matte', -W2 + 0.08, 0.15, D2 - 0.01, W2 - 0.08, 0.7, D2 + 0.005, lin([0.2, 0.2, 0.21]));
		for (let x = -W2 + 0.25; x < W2 - 0.15; x += 0.45) for (const z of [-0.15, 0.15]) g.cyl('metal', x, 0.9, z, 0.12, 0.03, DARK, 10);
		if (it.w > 1.2) g.cyl('metal', -W2 + 0.3, 0.93, 0.1, 0.16, 0.12, lin([0.6, 0.6, 0.62]), 12);   // a stockpot
		bx(g, 'metal', -W2 - 0.05, 1.95, -D2, W2 + 0.05, 2.4, D2 + 0.15, STEEL);
	},
	prepTable(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0.88, -D2, W2, 0.92, D2, STEEL);
		bx(g, 'metal', -W2 + 0.04, 0.2, -D2 + 0.04, W2 - 0.04, 0.23, D2 - 0.04, STEEL);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 'metal', sx * (W2 - 0.05) - 0.02, 0, sz * (D2 - 0.05) - 0.02, sx * (W2 - 0.05) + 0.02, 0.88, sz * (D2 - 0.05) + 0.02, STEEL);
		bx(g, 'grain', -0.25, 0.92, -0.18, 0.25, 0.95, 0.18, lin([0.75, 0.62, 0.42]));         // a board
		for (let k = 0; k < 3; k++) g.cyl('gloss', -W2 + 0.3 + k * 0.3, 0.23, (rnd() - 0.5) * D2, 0.12, 0.18, WHITE, 10);
	},
	fryer(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0, -D2, W2, 0.92, D2, STEEL);
		bx(g, 'matte', -W2 + 0.05, 0.92, -D2 + 0.05, W2 - 0.05, 0.93, D2 - 0.05, lin([0.55, 0.42, 0.15]));
		for (const x of [-W2 / 2, W2 / 2]) bx(g, 'metal', x - 0.12, 0.93, -0.1, x + 0.12, 1.05, 0.15, lin([0.5, 0.5, 0.52]));
	},
	pizzaOven(g, it) {
		const W2 = it.w / 2, br = lin([0.6, 0.28, 0.18]);
		bx(g, 'stone', -W2, 0, -W2, W2, 1.0, W2, lin([0.5, 0.48, 0.45]));
		g.sphere('stone', 0, 1.0, 0, W2, W2 * 0.8, W2, br, 14);
		bx(g, 'matte', -0.3, 1.05, W2 - 0.12, 0.3, 1.4, W2 + 0.01, lin([0.05, 0.04, 0.03]));
		g.cyl('stone', 0, 1.6, -W2 * 0.3, 0.14, 1.0, br, 8);
	},
	// a reception desk: a panelled front, a top, the bell and the book; the keys on the wall behind
	frontDesk(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOODS, it.v));
		bx(g, 'grain', -W2, 0, -D2, W2, 1.05, D2, wd);
		bx(g, 'stone', -W2 - 0.03, 1.05, -D2, W2 + 0.03, 1.1, D2 + 0.05, lin([0.85, 0.82, 0.76]));
		for (let x = -W2 + 0.3; x < W2 - 0.2; x += 0.5) bx(g, 'grain', x - 0.18, 0.2, D2, x + 0.18, 0.85, D2 + 0.015, lin(pick(WOODS, it.v + 0.3)));
		g.sphere('metal', W2 - 0.3, 1.1, 0.1, 0.05, 0.04, 0.05, BRASS, 8);
		bx(g, 'matte', -0.25, 1.1, -0.1, 0.15, 1.13, 0.15, lin([0.5, 0.12, 0.1]));
		if (it.keys) {
			bx(g, 'grain', -0.45, 1.35, -D2 - 0.65, 0.45, 1.95, -D2 - 0.62, wd);
			for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) bx(g, 'metal', -0.35 + i * 0.22, 1.5 + j * 0.15, -D2 - 0.62, -0.32 + i * 0.22, 1.56 + j * 0.15, -D2 - 0.6, BRASS);
		}
	},
	luggageRack(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (const sx of [-1, 1]) bx(g, 'grain', sx * W2 - 0.02, 0, -D2, sx * W2 + 0.02, 0.5, D2, lin([0.4, 0.28, 0.18]));
		for (let z = -D2 + 0.05; z < D2; z += 0.12) bx(g, 'fabric', -W2, 0.46, z, W2, 0.48, z + 0.05, lin([0.3, 0.2, 0.15]));
		bx(g, 'fabric', -W2 + 0.05, 0.48, -D2 + 0.05, W2 - 0.05, 0.75, D2 - 0.05, lin(pick(BRIGHT, it.v)));
	},
	// a rail of clothes on two posts: each on its hanger, a kind or two along it, the colours of
	// one range in runs (a size run each)
	clothesRack(g, it, rnd) {
		const W2 = it.w / 2, R = it.h - 0.02, range = RANGES[Math.floor(rnd() * RANGES.length)];
		for (const x of [-W2, W2]) {
			g.cyl('metal', x, 0.03, 0, 0.014, R - 0.03, STEEL, 8);
			bx(g, 'metal', x - 0.018, 0, -0.27, x + 0.018, 0.03, 0.27, STEEL);
			for (const z of [-0.25, 0.25]) g.cyl('gloss', x, 0, z, 0.018, 0.012, DARK, 6);
		}
		g.cyl('metal', -W2 - 0.02, R, 0, 0.011, it.w + 0.04, STEEL, 8, 'x');
		const a = CUT_KEYS[Math.floor(rnd() * CUT_KEYS.length)], b = rnd() < 0.5 ? a : CUT_KEYS[Math.floor(rnd() * CUT_KEYS.length)], wood = rnd() < 0.4;
		let x = -W2 + 0.06, k = Math.floor(rnd() * 5);
		while (x < W2 - 0.05) {
			const cut = x < 0 ? a : b, c0 = range[k++ % range.length], n = 3 + Math.floor(rnd() * 4);
			for (let i = 0; i < n && x < W2 - 0.05; i++) {
				const f = 0.93 + rnd() * 0.1;
				hang(g, x, 0, R, cut, lin(c0.map((v) => Math.min(1, v * f))), wood);
				x += CUTS[cut][2] + 0.024 + rnd() * 0.018;
			}
		}
	},
	// a round rack: the ring on its post, the clothes hung round it
	roundRack(g, it, rnd) {
		const r = Math.min(it.w, it.d) / 2 - 0.26, R = it.h - 0.02, range = RANGES[Math.floor(rnd() * RANGES.length)], cut = CUT_KEYS[Math.floor(rnd() * 4)];
		g.cyl('metal', 0, 0, 0, 0.28, 0.025, STEEL, 16); g.cyl('metal', 0, 0.025, 0, 0.022, R - 0.025, STEEL, 8);
		const N = 18;
		for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2; g.beam('metal', [Math.cos(a0) * r, R, Math.sin(a0) * r], [Math.cos(a1) * r, R, Math.sin(a1) * r], 0.02, 0.02, STEEL); }
		for (const a of [0, Math.PI / 2]) g.beam('metal', [-Math.cos(a) * r, R, -Math.sin(a) * r], [Math.cos(a) * r, R, Math.sin(a) * r], 0.016, 0.016, STEEL);
		const [L, hw, t] = CUTS[cut], step = (t + 0.045) / r, s0 = R - 0.05;
		let k = Math.floor(rnd() * 5);
		for (let a = rnd() * step; a < Math.PI * 2 - step * 0.6;) {
			const c0 = range[k++ % range.length], n = 3 + Math.floor(rnd() * 4);
			for (let i = 0; i < n && a < Math.PI * 2 - step * 0.6; i++, a += step * (0.9 + rnd() * 0.3)) {
				const dx = Math.cos(a), dz = Math.sin(a), f = 0.93 + rnd() * 0.1, c = lin(c0.map((v) => Math.min(1, v * f)));
				const P = (d, y) => [dx * (r + d), y, dz * (r + d)];
				g.beam('metal', P(-hw * 0.85, s0 - 0.004), P(hw * 0.85, s0 - 0.004), 0.006, 0.008, STEEL);
				g.beam('fabric', P(-hw * 0.8, s0 - 0.05), P(hw * 0.8, s0 - 0.05), t, 0.08, c);
				g.beam('fabric', P(-hw, s0 - 0.09 - (L - 0.09) / 2), P(hw, s0 - 0.09 - (L - 0.09) / 2), t, L - 0.09, c);
			}
		}
	},
	// a mannequin in one of the shop's outfits, on its stand (white or black, an egg for a head)
	mannequin(g, it) {
		const O = OUTFITS[(it.outfit ?? Math.floor(Math.abs(it.v) * 9973)) % OUTFITS.length], skin = Math.floor(Math.abs(it.v) * 31) % 3 ? lin([0.9, 0.89, 0.86]) : lin([0.08, 0.08, 0.085]);
		const top = lin(O.top), low = lin(O.low || O.top), shoe = lin(O.shoe || [0.08, 0.07, 0.07]), bare = O.cut !== 'pants';
		g.cyl('metal', 0, 0, -0.02, 0.2, 0.02, STEEL, 12); g.cyl('metal', 0.085, 0.02, -0.02, 0.012, 0.42, STEEL, 6);
		for (const sx of [-1, 1]) {
			const x = sx * 0.085;
			if (bare) g.cyl('gloss', x, 0.09, 0, 0.042, 0.5, skin, 8, 'y', true, 0.062);
			else g.cyl('fabric', x, 0.09, 0, 0.056, 0.86, low, 8, 'y', true, 0.088);
			g.sphere('gloss', x, 0.05, 0.035, 0.048, 0.045, 0.11, shoe, 6);
			// (the arms: the sleeve, the forearm bare or sleeved, the hand)
			const sh = [sx * 0.19, 1.37, 0], el = [sx * 0.235, 1.11, 0.02], wr = [sx * 0.255, 0.86, 0.06];
			g.sphere('fabric', sh[0] - sx * 0.01, sh[1] - 0.01, sh[2], 0.055, 0.05, 0.06, top, 6);
			g.beam('fabric', sh, el, 0.08, 0.08, top);
			g.sphere(O.long ? 'fabric' : 'gloss', el[0], el[1], el[2], 0.038, 0.038, 0.038, O.long ? top : skin, 6);
			g.beam(O.long ? 'fabric' : 'gloss', el, wr, O.long ? 0.07 : 0.055, O.long ? 0.07 : 0.055, O.long ? top : skin);
			g.sphere('gloss', wr[0], wr[1] - 0.04, wr[2], 0.032, 0.06, 0.028, skin, 6);
		}
		// (the hips, the waist, the chest; a skirt or a dress flared from the waist; a coat to the knee)
		g.sphere('fabric', 0, 0.96, 0, 0.17, 0.12, 0.115, O.cut === 'dress' ? top : low, 10);
		if (bare) g.cyl('fabric', 0, 0.52, 0, O.cut === 'dress' ? 0.27 : 0.23, 0.46, O.cut === 'dress' ? top : low, 16, 'y', true, 0.165);
		g.sphere('fabric', 0, 1.07, 0, 0.145, 0.15, 0.105, top, 10);
		g.sphere('fabric', 0, 1.25, 0, O.coat ? 0.19 : 0.175, 0.17, O.coat ? 0.125 : 0.11, top, 10);
		if (O.coat) g.cyl('fabric', 0, 0.6, 0, 0.21, 0.5, top, 14, 'y', false, 0.18);
		g.cyl('fabric', -0.18, 1.35, 0, 0.055, 0.36, top, 10, 'x');
		g.cyl('gloss', 0, 1.41, 0, 0.045, 0.11, skin, 8);
		g.sphere('gloss', 0, 1.62, 0.005, 0.095, 0.12, 0.105, skin, 12);
	},
	// a salon's chair on its pedestal, and the mirror and shelf on the wall in front of it
	salonChair(g, it) {
		const up = lin(pick(LEATHER, it.v));
		g.cyl('metal', 0, 0, 0, 0.28, 0.04, STEEL, 12); g.cyl('metal', 0, 0.04, 0, 0.06, 0.4, STEEL, 8);
		bx(g, 'fabric', -0.26, 0.44, -0.24, 0.26, 0.56, 0.26, up); bx(g, 'fabric', -0.26, 0.56, -0.3, 0.26, 1.2, -0.2, up);
		for (const s of [-1, 1]) bx(g, 'fabric', s * 0.3 - 0.04, 0.56, -0.2, s * 0.3 + 0.04, 0.72, 0.2, up);
		bx(g, 'metal', -0.12, 0.2, 0.28, 0.12, 0.23, 0.42, STEEL);
	},
	mirrorStation(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0.78, -D2, W2, 0.84, D2, lin(pick(WOODS, it.v)));
		bx(g, 'grain', -W2 + 0.05, 0.84, -D2, W2 - 0.05, 2.05, -D2 + 0.04, lin([0.2, 0.18, 0.16]));
		bx(g, 'mirror', -W2 + 0.1, 0.95, -D2 + 0.04, W2 - 0.1, 1.95, -D2 + 0.05, WHITE);
		// (its bottles, unless whoever fits it out stocks it with real ones: bay/storefit.js)
		if (!it.bare) for (let k = 0; k < 4; k++) g.cyl('gloss', -W2 + 0.15 + k * 0.12, 0.84, 0, 0.03, 0.12 + rnd() * 0.1, lin(pick(BRIGHT, rnd())), 6);
	},
	washBasin(g) {
		bx(g, 'gloss', -0.3, 0, -0.3, 0.3, 0.85, 0.05, lin([0.15, 0.15, 0.16]));
		g.sphere('gloss', 0, 0.85, -0.12, 0.24, 0.1, 0.2, WHITE, 12);
		bx(g, 'fabric', -0.26, 0.42, 0.1, 0.26, 0.54, 0.6, lin([0.12, 0.12, 0.13])); bx(g, 'fabric', -0.26, 0.54, 0.0, 0.26, 0.85, 0.1, lin([0.12, 0.12, 0.13]));
	},
	// a garage's lift: two posts, the arms under a car (the car itself is drawn as the cars are)
	carLift(g, it) {
		const W2 = it.w / 2;
		for (const s of [-1, 1]) { bx(g, 'metal', s * W2 - 0.18, 0, -0.18, s * W2 + 0.18, 2.6, 0.18, lin([0.75, 0.6, 0.1])); bx(g, 'metal', s * W2 - 0.28, 0, -0.28, s * W2 + 0.28, 0.06, 0.28, DARK); }
		for (const s of [-1, 1]) for (const z of [-0.9, 0.9]) bx(g, 'metal', s * W2 - s * 1.05, it.lift - 0.08, z - 0.06, s * W2, it.lift, z + 0.06, DARK);
	},
	toolChest(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = lin(it.v < 0.5 ? [0.7, 0.1, 0.08] : [0.1, 0.2, 0.45]);
		bx(g, 'gloss', -W2, 0.08, -D2, W2, 1.0, D2, c);
		for (let y = 0.2; y < 0.95; y += 0.12) bx(g, 'metal', -W2 + 0.05, y, D2, W2 - 0.05, y + 0.015, D2 + 0.015, STEEL);
		for (const sx of [-1, 1]) g.cyl('matte', sx * (W2 - 0.08), 0, D2 - 0.08, 0.05, 0.08, DARK, 8);
	},
	tyres(g) { for (let k = 0; k < 4; k++) g.cyl('matte', 0, k * 0.22, 0, 0.32, 0.21, lin([0.04, 0.04, 0.045]), 14); },
	// a bar: the counter with its taps and a brass foot rail; the back bar of bottles on a mirror
	barCounter(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOODS, it.v));
		bx(g, 'grain', -W2, 0, -D2, W2, 1.08, D2, wd);
		bx(g, 'gloss', -W2 - 0.04, 1.08, -D2, W2 + 0.04, 1.13, D2 + 0.08, lin(pick(WOODS, it.v + 0.4)));
		bx(g, 'metal', -W2, 0.18, D2 + 0.15, W2, 0.22, D2 + 0.19, BRASS);
		if (it.kind === 'sushi') { bx(g, 'glass', -W2 + 0.1, 1.13, -D2 + 0.05, W2 - 0.1, 1.38, -D2 + 0.4, WHITE); for (let x = -W2 + 0.2; x < W2 - 0.2; x += 0.22) g.sphere('matte', x, 1.16, -D2 + 0.22, 0.07, 0.03, 0.05, lin(pick([[0.9, 0.4, 0.3], [0.95, 0.6, 0.4], [0.9, 0.9, 0.85]], x * 3.7 % 1)), 6); return; }
		for (let k = 0; k < Math.max(1, Math.floor(it.w / 1.6)); k++) { const x = -W2 + 0.6 + k * 1.6; bx(g, 'metal', x - 0.2, 1.13, -D2 + 0.1, x + 0.2, 1.2, -D2 + 0.2, STEEL); for (let t = 0; t < 4; t++) g.cyl('metal', x - 0.15 + t * 0.1, 1.2, -D2 + 0.15, 0.015, 0.3, BRASS, 6); }
	},
	backBar(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOODS, it.v));
		bx(g, 'grain', -W2, 0, -D2, W2, 0.95, D2, wd);
		bx(g, 'mirror', -W2 + 0.1, 1.05, -D2, W2 - 0.1, 2.2, -D2 + 0.02, WHITE);
		// the bottles on their glass shelves: a body and a neck each, in the glass they come in
		// (amber, green, clear, smoke), a label on the odd one; set in loose groups, gaps between
		for (const y of [1.15, 1.6]) {
			bx(g, 'glass', -W2 + 0.05, y, -D2 + 0.02, W2 - 0.05, y + 0.02, -D2 + 0.25, WHITE);
			for (let x = -W2 + 0.14; x < W2 - 0.1; x += 0.085 + rnd() * 0.04 + (rnd() < 0.15 ? 0.12 : 0)) {
				const h = 0.17 + rnd() * 0.08, r = 0.03 + rnd() * 0.008, col = lin(pick([[0.42, 0.22, 0.06], [0.12, 0.26, 0.12], [0.86, 0.86, 0.82], [0.55, 0.3, 0.08], [0.25, 0.22, 0.2], [0.7, 0.45, 0.12]], rnd())), z = -D2 + 0.1 + rnd() * 0.06;
				g.cyl('gloss', x, y + 0.02, z, r, h, col, 6);
				g.cyl('gloss', x, y + 0.02 + h, z, r * 0.4, 0.07 + rnd() * 0.04, col, 4, 'y', true, r * 0.32);
				if (rnd() < 0.5) g.cyl('matte', x, y + 0.02 + h * 0.3, z, r + 0.002, h * 0.35, lin(pick([[0.92, 0.88, 0.78], [0.1, 0.1, 0.1], [0.75, 0.12, 0.1], [0.85, 0.7, 0.3]], rnd())), 6, 'y', false);
			}
		}
	},
	barStool(g, it) { g.cyl('metal', 0, 0, 0, 0.2, 0.03, DARK, 10); g.cyl('metal', 0, 0.03, 0, 0.03, 0.72, DARK, 6); g.cyl('fabric', 0, 0.72, 0, 0.18, 0.06, lin(pick(LEATHER, it.v)), 12); g.cyl('metal', 0, 0.28, 0, 0.17, 0.02, BRASS, 10); },
	// a wall of gear: rods up on pegs, paddles, jackets, a shelf of boxes under them
	gearWall(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin([0.55, 0.42, 0.28]);
		bx(g, 'grain', -W2, 0, -D2, W2, 2.2, -D2 + 0.04, wd);
		bx(g, 'grain', -W2, 0.6, -D2, W2, 0.64, D2, wd);
		for (let x = -W2 + 0.1; x < W2 - 0.1; x += 0.12 + rnd() * 0.08) {
			if (it.kind === 'tools') { bx(g, 'metal', x, 1.0 + rnd() * 0.8, -D2 + 0.04, x + 0.04, 1.3 + rnd() * 0.6, -D2 + 0.08, lin(pick([[0.7, 0.1, 0.08], [0.6, 0.6, 0.62], [0.1, 0.1, 0.1], [0.85, 0.65, 0.1]], rnd()))); continue; }
			const r = rnd();
			if (r < 0.5) g.cyl('gloss', x, 0.7, -D2 + 0.08, 0.012, 1.4 + rnd() * 0.4, lin(pick([[0.1, 0.1, 0.1], [0.5, 0.15, 0.1], [0.8, 0.75, 0.6]], rnd())), 5);
			else if (r < 0.8) bx(g, 'fabric', x, 1.2, -D2 + 0.04, x + 0.1, 1.9, -D2 + 0.22, lin(pick(BRIGHT, rnd())));
			else bx(g, 'grain', x, 1.0, -D2 + 0.05, x + 0.14, 2.0, -D2 + 0.08, lin([0.6, 0.45, 0.25]));
		}
		for (let x = -W2 + 0.1; x < W2 - 0.3; x += 0.35) bx(g, 'matte', x, 0.64, -D2 + 0.06, x + 0.28, 0.64 + 0.15 + rnd() * 0.2, -D2 + 0.3, lin(pick(BRIGHT, rnd())));
	},
	// an outrigger canoe up on brackets on the wall
	canoeRack(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = lin(pick([[0.75, 0.25, 0.15], [0.2, 0.45, 0.6], [0.85, 0.75, 0.4]], it.v));
		for (const x of [-W2 * 0.6, W2 * 0.6]) bx(g, 'grain', x - 0.04, 1.6, -D2, x + 0.04, 1.66, D2, lin([0.4, 0.3, 0.2]));
		g.sphere('gloss', 0, 1.85, 0, W2, 0.2, D2 * 0.7, c, 14);
	},
	breadRack(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (const x of [-W2, W2]) bx(g, 'grain', x - 0.03, 0, -D2, x + 0.03, 1.9, D2, lin([0.45, 0.32, 0.2]));
		for (let y = 0.3; y < 1.85; y += 0.38) {
			bx(g, 'grain', -W2, y, -D2, W2, y + 0.03, D2, lin([0.55, 0.4, 0.25]));
			for (let x = -W2 + 0.12; x < W2 - 0.1; x += 0.2 + rnd() * 0.06) g.sphere('matte', x, y + 0.09, (rnd() - 0.5) * D2, 0.09, 0.07, 0.17, lin(pick([[0.75, 0.5, 0.25], [0.6, 0.38, 0.18], [0.85, 0.65, 0.35]], rnd())), 7);
		}
	},
	deckOven(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0, -D2, W2, 1.85, D2, STEEL);
		for (const y of [0.55, 1.05, 1.55]) { bx(g, 'matte', -W2 + 0.08, y - 0.3, D2, W2 - 0.08, y, D2 + 0.01, lin([0.15, 0.15, 0.16])); bx(g, 'metal', -W2 + 0.2, y - 0.06, D2 + 0.01, W2 - 0.2, y - 0.03, D2 + 0.05, STEEL); }
	},
	dentalChair(g) {
		const c = lin([0.3, 0.55, 0.6]);
		g.cyl('metal', 0, 0, 0, 0.3, 0.05, WHITE, 12); g.cyl('metal', 0, 0.05, 0, 0.08, 0.35, WHITE, 8);
		bx(g, 'fabric', -0.28, 0.4, -0.5, 0.28, 0.52, 0.3, c); bx(g, 'fabric', -0.28, 0.52, -0.75, 0.28, 0.62, -0.45, c);
		colorArm(g); bx(g, 'gloss', 0.45, 0.9, -0.2, 0.75, 0.95, 0.1, WHITE);
	},
	examTable(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'gloss', -W2, 0, -D2, W2, 0.65, D2, lin([0.85, 0.85, 0.86]));
		bx(g, 'fabric', -W2 + 0.02, 0.65, -D2 + 0.02, W2 - 0.02, 0.75, D2 - 0.02, lin([0.25, 0.35, 0.45]));
		bx(g, 'matte', -W2 + 0.05, 0.75, -D2 + 0.05, W2 - 0.05, 0.755, D2 - 0.05, WHITE);
	},
	waitingChairs(g, it) {
		const W2 = it.w / 2, n = Math.max(2, Math.round(it.w / 0.55)), c = lin(pick([[0.3, 0.4, 0.5], [0.5, 0.3, 0.25], [0.35, 0.35, 0.35]], it.v));
		bx(g, 'metal', -W2, 0.38, -0.25, W2, 0.42, 0.2, DARK);
		for (let k = 0; k < n; k++) { const x = -W2 + (k + 0.5) * it.w / n; bx(g, 'fabric', x - 0.23, 0.42, -0.22, x + 0.23, 0.48, 0.2, c); bx(g, 'fabric', x - 0.23, 0.48, -0.25, x + 0.23, 0.9, -0.2, c); }
		for (const x of [-W2 + 0.05, W2 - 0.05]) bx(g, 'metal', x - 0.02, 0, -0.2, x + 0.02, 0.4, 0.15, DARK);
	},
	treadmill(g) {
		bx(g, 'matte', -0.4, 0, -0.9, 0.4, 0.2, 0.9, DARK); bx(g, 'matte', -0.35, 0.2, -0.85, 0.35, 0.21, 0.85, lin([0.15, 0.15, 0.16]));
		for (const s of [-1, 1]) bx(g, 'metal', s * 0.38 - 0.03, 0.2, -0.85, s * 0.38 + 0.03, 1.3, -0.75, STEEL);
		bx(g, 'gloss', -0.38, 1.25, -0.95, 0.38, 1.45, -0.75, DARK);
	},
	weightRack(g, it) {
		const W2 = it.w / 2;
		for (const x of [-W2, W2]) bx(g, 'metal', x - 0.04, 0, -0.3, x + 0.04, 2.1, -0.22, DARK);
		bx(g, 'metal', -W2, 1.4, -0.27, W2, 1.43, -0.24, STEEL);
		for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.cyl('matte', s * (W2 - 0.25 - k * 0.06), 1.15, -0.26, 0.22 - k * 0.04, 0.05, DARK, 12, 'x');
		bx(g, 'fabric', -0.3, 0, 0.1, 0.3, 0.45, 1.3, lin([0.12, 0.12, 0.13]));
	},
	yogaMat(g, it) { bx(g, 'fabric', -it.w / 2, 0, -it.d / 2, it.w / 2, 0.012, it.d / 2, lin(pick(BRIGHT, it.v))); },
	// a menu board on the wall: dark, lines of chalk
	menuBoard(g, it, rnd) {
		const W2 = it.w / 2;
		bx(g, 'grain', -W2, 1.8, -0.02, W2, 2.55, 0.02, lin([0.4, 0.28, 0.18]));
		bx(g, 'matte', -W2 + 0.05, 1.85, 0.02, W2 - 0.05, 2.5, 0.025, lin([0.08, 0.1, 0.09]));
		for (let y = 1.95; y < 2.45; y += 0.08) bx(g, 'matte', -W2 + 0.12, y, 0.025, -W2 + 0.12 + (W2 * 2 - 0.3) * (0.5 + rnd() * 0.5), y + 0.025, 0.03, lin([0.85, 0.85, 0.8]));
	},
	hostStand(g, it) { const wd = lin(pick(WOODS, it.v)); bx(g, 'grain', -0.3, 0, -0.22, 0.3, 1.1, 0.22, wd); bx(g, 'grain', -0.33, 1.1, -0.25, 0.33, 1.14, 0.28, wd); bx(g, 'matte', -0.15, 1.14, -0.1, 0.15, 1.16, 0.12, lin([0.85, 0.82, 0.7])); },
	cribs(g, it) { const W2 = it.w / 2, D2 = it.d / 2, c = lin([0.92, 0.9, 0.86]); bx(g, 'grain', -W2, 0.25, -D2, W2, 0.3, D2, c); for (let x = -W2; x <= W2 + 1e-3; x += 0.1) for (const z of [-D2, D2]) bx(g, 'grain', x - 0.01, 0, z - 0.01, x + 0.01, 0.9, z + 0.01, c); bx(g, 'fabric', -W2 + 0.03, 0.3, -D2 + 0.03, W2 - 0.03, 0.4, D2 - 0.03, lin([0.7, 0.85, 0.95])); },
};
function colorArm(g) { bx(g, 'metal', 0.3, 0.6, -0.1, 0.36, 1.6, -0.04, WHITE); bx(g, 'metal', 0.0, 1.55, -0.1, 0.36, 1.6, 0.2, WHITE); }
addKit(KIT, ['yogaMat', 'menuBoard']);

// what a shop's shelves hold (estab-fit.js tags them with the shop: it.stock), from the goods'
// sheet (goods.js), into a GoodsBuilder s: its makers' packets on the shelves, the crates on a
// grocer's bins, the new books on a table; the kit draws the fixtures bare (it.bare). Used by
// interiors/build.js and bay/houses.js
const SHELF_KINDS = {
	grocer: ['cans', 'jars', 'dry', 'cereal', 'chips', 'cookies', 'candy', 'paper', 'laundry', 'clean'], general: ['cans', 'dry', 'chips', 'candy', 'paper', 'clean', 'care', 'tools'],
	hardware: ['paint', 'tools', 'auto', 'bins', 'clean'], pharmacy: ['care', 'meds', 'meds', 'clean', 'paper'], pet: ['pet', 'pet', 'meds'], liquor: ['wine', 'spirits', 'beer', 'wine'],
	gift: ['toys', 'mugs', 'candy', 'books'], antiques: ['books', 'mugs', 'toys'], clothes: ['clothes'], tailor: ['clothes'], books: ['books'], records: ['books'],
};
export const STOCKED = new Set(['shopShelf', 'produce', 'bookTable', 'bookcase']);
export function stockShop(s, it) {
	const W2 = it.w / 2, D2 = it.d / 2, seed = Math.floor(it.v * 997);
	if (it.type === 'produce') {
		// (the crates on a slope along the bin's top, rising from its front to its back)
		s.at(it.x, it.y, it.z, it.rot || 0);
		s.slope('crates', -W2 + 0.03, W2 - 0.03, 0.76, D2 - 0.04, 0.95, -D2 + 0.04, seed, 0.95);
		return;
	}
	if (it.type === 'bookTable') {
		s.at(it.x, it.y, it.z, it.rot || 0);
		const cols = Math.max(1, Math.floor((it.w - 0.06) / 0.21)), rows = Math.max(1, Math.floor((it.d - 0.04) / 0.27));
		for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
			const x = -W2 + 0.03 + (i + 0.5) * (it.w - 0.06) / cols, z = -D2 + 0.02 + (j + 0.5) * (it.d - 0.04) / rows, n = (seed + i * 7 + j * 5) % 12, h = 0.03 + ((seed + i * 5 + j * 11) % 4) * 0.018;
			s.stack('covers', n >> 2, n & 3, 4, x - 0.078, z - 0.115, x + 0.078, z + 0.115, 0.8, 0.8 + h, [0.6, 0.55, 0.45], 0.9);
		}
		return;
	}
	if (it.type === 'bookcase') {
		// (a bookshop's case: a run of spines along each shelf, its front toward +z; the shelves as
		// housekit.js draws them)
		s.at(it.x, it.y, it.z, it.rot || 0);
		for (let i = 0; i < 4; i++) {
			const y = 0.05 + i * (it.h - 0.08) / 4;
			s.run('books', -W2 + 0.03, W2 - 0.03, y, (it.h - 0.08) / 4 - 0.04, D2 - 0.02, it.d - 0.06, seed + i * 3, 0.8 + 0.2 * Math.min(1, y / 1.4));
		}
		return;
	}
	const kinds = SHELF_KINDS[it.stock] || SHELF_KINDS.general, lv = [0.12, 0.55, 0.98, 1.4].filter((q) => q < it.h - 0.2);
	if (it.d < 0.7) {
		// a shelf against a wall: each shelf a run toward the room, either side of the spine
		s.at(it.x, it.y, it.z, it.rot || 0);
		lv.forEach((y, i) => {
			const top = i + 1 < lv.length ? lv[i + 1] : it.h, k = 0.85 + 0.15 * Math.min(1, y / 1.4);
			for (const [x0, x1, j] of [[-W2 + 0.02, -0.06, 0], [0.06, W2 - 0.02, 1]]) s.run(kinds[(i + j + seed) % kinds.length], x0, x1, y + 0.03, top - y - 0.06, D2 - 0.01, it.d - 0.04, seed + i * 3 + j, k);
		});
		return;
	}
	// a gondola: its two sides, back to back on the spine, each shelf of them a run of one kind
	for (const side of [1, -1]) {
		s.at(it.x, it.y, it.z, ((it.rot || 0) + (side > 0 ? 1 : 3)) % 4);
		lv.forEach((y, i) => {
			const top = i + 1 < lv.length ? lv[i + 1] : it.h;
			s.run(kinds[(i + seed + (side > 0 ? 0 : 2)) % kinds.length], -D2 + 0.02, D2 - 0.02, y + 0.03, top - y - 0.06, W2 - 0.01, W2 - 0.07, seed + i * 3 + side, 0.85 + 0.15 * Math.min(1, y / 1.4));
		});
	}
}
