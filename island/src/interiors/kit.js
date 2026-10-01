// The things in the new rooms that the houses' kit (bay/housekit.js) has no drawing for:
// a Victorian parlour's fireplace and upright piano, a claw-foot tub, the window seat in a
// bay, crown moulding and wainscot; a shop's counter, pastry case, shelving, produce and
// flowers; the lobby's mailboxes and bench; a classroom's desks and blackboard; a
// warehouse's racks, crates and forklift; an office's desks. Each is drawn in its own frame
// (width along x, depth along z, its front toward +z, standing on y = 0) into the same
// builder, by material, so a whole building is a handful of draws.

import { drawItem, lin } from '../bay/housekit.js';

const pick = (l, v) => l[Math.floor(v * 9973) % l.length];
const WOOD = [[0.36, 0.22, 0.14], [0.22, 0.14, 0.1], [0.5, 0.34, 0.2], [0.3, 0.2, 0.15]];
const BRIGHT = [[0.8, 0.25, 0.2], [0.9, 0.7, 0.2], [0.25, 0.5, 0.7], [0.35, 0.6, 0.3], [0.85, 0.5, 0.6], [0.95, 0.9, 0.8], [0.55, 0.35, 0.6]];
const BLACK = lin([0.05, 0.05, 0.055]), STEEL = lin([0.72, 0.73, 0.75]), WHITE = lin([0.92, 0.91, 0.88]), MARBLE = lin([0.9, 0.88, 0.84]);

// whatever the item is: the houses' drawing, or ours
export function drawAny(g, it, rnd) {
	const H = { ceil0: it.ceil || 3.0, ceil1: 5.45, floor1: 2.9 };
	if (it.type === 'crown') { crown(g, it); return; }
	if (!EXTRA[it.type]) { drawItem(g, it, rnd, H); return; }
	g.at(it.x, it.y, it.z, it.rot || 0);
	EXTRA[it.type](g, it, rnd);
}
const bx = (g, k, x0, y0, z0, x1, y1, z1, c) => g.box(k, x0, y0, z0, x1, y1, z1, c);
const EXTRA = {
	fireplace(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOOD, it.v)), br = lin([0.45, 0.2, 0.15]);
		bx(g, 'stone', -W2, 0, -D2, W2, 0.06, D2 + 0.25, MARBLE);                   // the hearth
		bx(g, 'grain', -W2, 0, -D2, -W2 + 0.28, 1.15, D2, wd); bx(g, 'grain', W2 - 0.28, 0, -D2, W2, 1.15, D2, wd);
		bx(g, 'grain', -W2 - 0.08, 1.15, -D2, W2 + 0.08, 1.24, D2 + 0.08, wd);    // the mantel shelf
		bx(g, 'grain', -W2 + 0.28, 0.85, -D2, W2 - 0.28, 1.15, D2 - 0.02, wd);
		bx(g, 'matte', -W2 + 0.28, 0.06, -D2, W2 - 0.28, 0.85, D2 - 0.12, lin([0.06, 0.05, 0.05]));
		bx(g, 'matte', -W2 + 0.34, 0.06, D2 - 0.14, W2 - 0.34, 0.12, D2 - 0.1, br);
		// the grate and its coals, a pair of candlesticks and a clock on the shelf
		bx(g, 'metal', -0.3, 0.06, -0.05, 0.3, 0.3, 0.1, BLACK);
		bx(g, 'lamp', -0.22, 0.14, -0.02, 0.22, 0.22, 0.08, lin([1, 0.45, 0.15]));
		for (const x of [-W2 + 0.2, W2 - 0.2]) { g.cyl('metal', x, 1.24, 0, 0.03, 0.28, lin([0.8, 0.65, 0.3]), 8); g.cyl('lamp', x, 1.52, 0, 0.012, 0.08, WHITE, 6); }
		bx(g, 'grain', -0.15, 1.24, -0.05, 0.15, 1.5, 0.07, lin([0.25, 0.15, 0.1]));
		if (it.mirror) { bx(g, 'grain', -0.55, 1.35, -D2, 0.55, 2.35, -D2 + 0.04, lin([0.6, 0.45, 0.2])); bx(g, 'mirror', -0.48, 1.42, -D2 + 0.04, 0.48, 2.28, -D2 + 0.05, WHITE); }
	},
	piano(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = lin([0.04, 0.03, 0.03]);
		bx(g, 'gloss', -W2, 0.02, -D2, W2, 1.25, -D2 + 0.35, c);
		bx(g, 'gloss', -W2, 0.68, -D2 + 0.35, W2, 0.76, D2 - 0.05, c);
		bx(g, 'matte', -W2 + 0.08, 0.74, -D2 + 0.36, W2 - 0.08, 0.76, D2 - 0.1, WHITE);
		for (let x = -W2 + 0.12; x < W2 - 0.1; x += 0.165) bx(g, 'matte', x, 0.76, -D2 + 0.36, x + 0.07, 0.785, -D2 + 0.48, BLACK);
		for (const x of [-W2 + 0.06, W2 - 0.12]) bx(g, 'gloss', x, 0, D2 - 0.12, x + 0.06, 0.68, D2 - 0.06, c);
		bx(g, 'gloss', -0.45, 0.46, D2 + 0.25, 0.45, 0.52, D2 + 0.6, c);                // the bench
		for (let i = 0; i < 5; i++) bx(g, 'matte', -W2 + 0.2 + i * 0.12, 1.25, -D2 + 0.05, -W2 + 0.3 + i * 0.12, 1.4 + (i % 2) * 0.05, -D2 + 0.25, lin(pick(BRIGHT, it.v + i * 0.13)));
	},
	clawTub(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		g.sphere('gloss', 0, 0.42, 0, W2, 0.3, D2, WHITE, 16);
		bx(g, 'gloss', -W2 + 0.08, 0.38, -D2 + 0.06, W2 - 0.08, 0.62, D2 - 0.06, WHITE);
		bx(g, 'matte', -W2 + 0.14, 0.6, -D2 + 0.12, W2 - 0.14, 0.62, D2 - 0.12, lin([0.72, 0.84, 0.88]));
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.sphere('metal', sx * (W2 - 0.2), 0.08, sz * (D2 - 0.12), 0.07, 0.09, 0.07, lin([0.8, 0.66, 0.3]), 8);
		g.cyl('metal', W2 - 0.1, 0.62, 0, 0.02, 0.3, lin([0.8, 0.66, 0.3]), 8);
	},
	windowSeat(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.4, D2, lin([0.88, 0.86, 0.8]));
		bx(g, 'fabric', -W2 + 0.03, 0.4, -D2 + 0.02, W2 - 0.03, 0.47, D2 - 0.02, lin(pick(BRIGHT, it.v)));
		for (let i = 0; i < 3; i++) bx(g, 'fabric', -W2 + 0.2 + i * 0.5, 0.47, -D2 + 0.05, -W2 + 0.55 + i * 0.5, 0.78, -D2 + 0.2, lin(pick(BRIGHT, it.v * 3 + i * 0.3)));
	},
	shopCounter(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOOD, it.v));
		if (it.kind === 'info') {
			// an information desk: a stone-topped counter, a screen, a rack of leaflets
			bx(g, 'grain', -W2, 0, -D2, W2, 1.05, D2, wd);
			bx(g, 'stone', -W2 - 0.03, 1.05, -D2, W2 + 0.03, 1.1, D2 + 0.04, MARBLE);
			bx(g, 'gloss', -0.3, 1.1, -D2 + 0.1, 0.3, 1.45, -D2 + 0.14, BLACK);
			for (let x = W2 - 0.9; x < W2 - 0.1; x += 0.2) bx(g, 'matte', x, 1.1, D2 - 0.25, x + 0.14, 1.32, D2 - 0.2, lin(pick(BRIGHT, rnd())));
			return;
		}
		if (it.kind === 'prize') {
			// the prize counter: glass cases of trinkets, the big soft toys on shelves behind
			bx(g, 'grain', -W2, 0, -D2, W2, 0.5, D2, wd);
			bx(g, 'glass', -W2, 0.5, -D2, W2, 1.05, D2, WHITE);
			for (let x = -W2 + 0.15; x < W2 - 0.1; x += 0.22) g.sphere('gloss', x, 0.6, (rnd() - 0.5) * D2, 0.05, 0.05, 0.05, lin(pick(BRIGHT, rnd())), 6);
			for (const y of [1.3, 1.9]) {
				bx(g, 'grain', -W2, y, -D2 - 0.6, W2, y + 0.04, -D2 - 0.2, wd);
				for (let x = -W2 + 0.25; x < W2 - 0.2; x += 0.45) g.sphere('fabric', x, y + 0.2, -D2 - 0.4, 0.17, 0.2, 0.15, lin(pick(BRIGHT, rnd())), 8);
			}
			return;
		}
		bx(g, 'grain', -W2, 0, -D2, W2, 0.98, D2, wd);
		bx(g, 'stone', -W2 - 0.03, 0.98, -D2, W2 + 0.03, 1.03, D2 + 0.04, MARBLE);
		bx(g, 'gloss', W2 - 0.5, 1.03, -0.1, W2 - 0.15, 1.3, 0.2, BLACK);              // the till
		if (it.kind === 'cafe' || it.kind === 'bar') {
			bx(g, 'metal', -W2 + 0.2, 1.03, -D2 + 0.05, -W2 + 0.85, 1.5, -D2 + 0.45, STEEL); // the espresso machine or the taps
			for (let i = 0; i < 4; i++) g.cyl('gloss', -W2 + 1.1 + i * 0.16, 1.03, -0.05, 0.04, 0.1, WHITE, 8);
		}
		// the shelves behind, bottles, tins and jars along them
		for (const y of [1.35, 1.75, 2.15]) {
			bx(g, 'grain', -W2, y, -D2 - 0.55, W2, y + 0.03, -D2 - 0.25, wd);
			for (let x = -W2 + 0.08; x < W2 - 0.1; x += 0.13 + rnd() * 0.08) g.cyl(rnd() < 0.5 ? 'gloss' : 'matte', x, y + 0.03, -D2 - 0.4, 0.035 + rnd() * 0.02, 0.12 + rnd() * 0.14, lin(pick(BRIGHT, rnd())), 6);
		}
	},
	displayCase(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.75, D2, lin(pick(WOOD, it.v)));
		bx(g, 'glass', -W2, 0.75, -D2, W2, 1.1, D2, WHITE);
		for (let x = -W2 + 0.12; x < W2 - 0.1; x += 0.16) for (const z of [-0.12, 0.12]) g.sphere('matte', x, 0.8, z, 0.06, 0.04, 0.06, lin(pick([[0.82, 0.58, 0.3], [0.62, 0.36, 0.2], [0.9, 0.8, 0.6], [0.7, 0.3, 0.35]], rnd())), 6);
	},
	cafeTable(g, it) {
		const c = lin([0.15, 0.15, 0.15]), top = lin(pick([[0.9, 0.88, 0.82], [0.4, 0.3, 0.2], [0.2, 0.3, 0.3]], it.v));
		g.cyl('metal', 0, 0, 0, 0.2, 0.03, c, 10); g.cyl('metal', 0, 0.03, 0, 0.03, 0.7, c, 6); g.cyl('stone', 0, 0.72, 0, 0.32, 0.03, top, 14);
		g.cyl('gloss', 0.08, 0.75, 0.05, 0.045, 0.09, WHITE, 8);
		for (const sz of [-1, 1]) {
			const z = sz * 0.55;
			g.cyl('metal', 0, 0, z, 0.02, 0.46, c, 6); g.cyl('fabric', 0, 0.44, z, 0.19, 0.04, lin([0.55, 0.2, 0.15]), 10);
			bx(g, 'metal', -0.17, 0.48, z + sz * 0.16, 0.17, 0.85, z + sz * 0.19, c);
		}
	},
	shopShelf(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h;
		bx(g, 'metal', -0.05, 0, -D2, 0.05, h, D2, lin([0.85, 0.85, 0.83]));
		for (const y of [0.12, 0.55, 0.98, 1.4].filter((q) => q < h - 0.2)) for (const s of [-1, 1]) {
			bx(g, 'metal', s > 0 ? 0.05 : -W2, y, -D2, s > 0 ? W2 : -0.05, y + 0.03, D2, lin([0.8, 0.8, 0.78]));
			for (let z = -D2 + 0.06; z < D2 - 0.3; z += 0.34 + rnd() * 0.1) { const c = lin(pick(BRIGHT, rnd())), x0 = s > 0 ? 0.1 : -W2 + 0.06, x1 = s > 0 ? W2 - 0.06 : -0.1, hh = 0.14 + rnd() * 0.2; bx(g, 'matte', x0, y + 0.03, z, x1, y + 0.03 + hh, z + 0.28, c); }
		}
	},
	produce(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.75, D2, lin([0.45, 0.32, 0.2]));
		for (let z = -D2 + 0.2; z < D2 - 0.1; z += 0.45) { const c = lin(pick([[0.8, 0.1, 0.1], [0.95, 0.6, 0.1], [0.9, 0.85, 0.2], [0.35, 0.6, 0.2], [0.5, 0.15, 0.4]], rnd())); for (let x = -W2 + 0.1; x < W2 - 0.05; x += 0.12) g.sphere('gloss', x, 0.8, z + (rnd() - 0.5) * 0.1, 0.055, 0.05, 0.055, c, 6); }
	},
	bookTable(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.8, D2, lin(pick(WOOD, it.v)));
		for (let z = -D2 + 0.1; z < D2 - 0.2; z += 0.3) for (let x = -W2 + 0.08; x < W2 - 0.2; x += 0.24) bx(g, 'matte', x, 0.8, z, x + 0.18, 0.82 + rnd() * 0.12, z + 0.24, lin(pick(BRIGHT, rnd())));
	},
	flowers(g, it, rnd) {
		const W2 = it.w / 2;
		for (let i = 0; i < 3; i++) {
			const x = -W2 + 0.15 + i * (it.w - 0.3) / 2;
			g.cyl('metal', x, 0, 0, 0.13, 0.35, lin([0.6, 0.62, 0.64]), 10);
			for (let k = 0; k < 7; k++) g.sphere('matte', x + (rnd() - 0.5) * 0.2, 0.45 + rnd() * 0.4, (rnd() - 0.5) * 0.2, 0.06, 0.05, 0.06, lin(pick([[0.9, 0.2, 0.3], [0.95, 0.85, 0.3], [0.95, 0.95, 0.9], [0.8, 0.4, 0.8], [0.95, 0.5, 0.2]], rnd())), 6);
		}
	},
	mailboxes(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = lin([0.7, 0.58, 0.3]);
		bx(g, 'metal', -W2, 0.6, -D2, W2, 1.5, D2, c);
		for (let x = -W2 + 0.05; x < W2 - 0.2; x += 0.3) for (let y = 0.65; y < 1.45; y += 0.2) bx(g, 'metal', x, y, D2, x + 0.26, y + 0.16, D2 + 0.01, lin([0.8, 0.68, 0.36]));
	},
	// a museum's case: a wooden base, a glass case on it, rocks, a fossil and a few old things
	exhibitCase(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOOD, it.v));
		bx(g, 'grain', -W2, 0, -D2, W2, 0.8, D2, wd);
		bx(g, 'matte', -W2 + 0.04, 0.8, -D2 + 0.04, W2 - 0.04, 0.82, D2 - 0.04, lin([0.2, 0.22, 0.2]));
		for (let x = -W2 + 0.2; x < W2 - 0.15; x += 0.28) g.sphere('matte', x + (rnd() - 0.5) * 0.06, 0.86, (rnd() - 0.5) * D2, 0.07 + rnd() * 0.04, 0.04 + rnd() * 0.03, 0.06, lin(pick([[0.75, 0.62, 0.42], [0.45, 0.42, 0.38], [0.62, 0.3, 0.22], [0.86, 0.82, 0.72], [0.3, 0.45, 0.35]], rnd())), 6);
		g.cyl('matte', 0, 0.82, D2 * 0.4, 0.09, 0.012, lin([0.7, 0.66, 0.55]), 10);
		bx(g, 'glass', -W2, 0.82, -D2, W2, 1.05, D2, WHITE);
		bx(g, 'matte', -W2 + 0.05, 0.62, D2, W2 - 0.05, 0.74, D2 + 0.01, lin([0.9, 0.88, 0.8]));
	},
	// a panel on two legs, printed with the mountain's story: pictures and bands of colour
	exhibitPanel(g, it, rnd) {
		const W2 = it.w / 2, c = lin([0.26, 0.2, 0.14]);
		for (const x of [-W2 + 0.04, W2 - 0.08]) bx(g, 'metal', x, 0, -0.04, x + 0.04, 2.0, 0.04, BLACK);
		bx(g, 'matte', -W2, 0.7, -0.03, W2, 2.0, 0.03, lin([0.92, 0.88, 0.78]));
		bx(g, 'matte', -W2, 1.78, 0.03, W2, 1.98, 0.035, c);
		for (let k = 0; k < 3; k++) { const x = -W2 + 0.1 + k * (it.w - 0.2) / 3; bx(g, 'matte', x, 1.2, 0.03, x + (it.w - 0.4) / 3, 1.7, 0.036, lin(pick([[0.45, 0.55, 0.62], [0.62, 0.52, 0.32], [0.38, 0.5, 0.3], [0.7, 0.45, 0.3]], rnd()))); }
		for (let y = 0.8; y < 1.12; y += 0.07) bx(g, 'matte', -W2 + 0.1, y, 0.03, W2 - 0.1 - rnd() * 0.3, y + 0.03, 0.034, lin([0.35, 0.33, 0.3]));
	},
	// the mountain in relief on a plinth: its two summits and the ridges down from them
	reliefModel(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.85, D2, lin([0.3, 0.22, 0.15]));
		bx(g, 'matte', -W2 + 0.05, 0.85, -D2 + 0.05, W2 - 0.05, 0.88, D2 - 0.05, lin([0.62, 0.6, 0.45]));
		const G = lin([0.42, 0.46, 0.3]), B = lin([0.55, 0.47, 0.34]);
		g.sphere('matte', 0.1 * W2, 0.88, 0, W2 * 0.55, 0.28, D2 * 0.6, G, 10);
		g.sphere('matte', -0.35 * W2, 0.88, -0.2 * D2, W2 * 0.3, 0.22, D2 * 0.35, B, 8);
		g.sphere('matte', 0.45 * W2, 0.88, 0.25 * D2, W2 * 0.35, 0.2, D2 * 0.3, G, 8);
		g.sphere('matte', 0.2 * W2, 1.02, 0, W2 * 0.18, 0.18, D2 * 0.2, B, 8);
	},
	// a spinning rack of postcards
	postcards(g, it, rnd) {
		g.cyl('metal', 0, 0, 0, 0.2, 0.03, BLACK, 10); g.cyl('metal', 0, 0, 0, 0.02, 1.6, BLACK, 6);
		for (let y = 0.5; y < 1.55; y += 0.22) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, x = Math.sin(a) * 0.14, z = Math.cos(a) * 0.14; bx(g, 'matte', x - 0.07, y, z - 0.07, x + 0.07, y + 0.15, z + 0.07, lin(pick(BRIGHT, rnd()))); }
	},
	bench(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOOD, it.v));
		bx(g, 'grain', -W2, 0.4, -D2, W2, 0.46, D2, wd);
		for (const x of [-W2 + 0.1, W2 - 0.14]) bx(g, 'metal', x, 0, -D2 + 0.05, x + 0.04, 0.4, D2 - 0.05, BLACK);
		bx(g, 'grain', -W2, 0.46, -D2, W2, 0.9, -D2 + 0.05, wd);
	},
	blackboard(g, it) {
		const W2 = it.w / 2;
		bx(g, 'grain', -W2 - 0.05, 0.85, -0.02, W2 + 0.05, 2.1, 0.03, lin([0.45, 0.32, 0.2]));
		bx(g, 'matte', -W2, 0.9, 0.03, W2, 2.05, 0.04, lin([0.1, 0.2, 0.14]));
		bx(g, 'grain', -W2, 0.88, 0.03, W2, 0.9, 0.1, lin([0.45, 0.32, 0.2]));
	},
	schoolDesk(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = lin([0.3, 0.3, 0.32]);
		for (const sx of [-1, 1]) bx(g, 'metal', sx * (W2 - 0.04) - 0.02, 0, -0.02, sx * (W2 - 0.04) + 0.02, 0.7, 0.02, c);
		bx(g, 'grain', -W2, 0.7, -D2, W2, 0.73, D2, lin([0.75, 0.62, 0.45]));
		// the chair behind it (toward -z)
		const z = -D2 - 0.3;
		for (const sx of [-1, 1]) bx(g, 'metal', sx * 0.18 - 0.015, 0, z - 0.015, sx * 0.18 + 0.015, 0.44, z + 0.015, c);
		bx(g, 'gloss', -0.21, 0.44, z - 0.2, 0.21, 0.47, z + 0.2, lin(pick(BRIGHT, it.v)));
		bx(g, 'gloss', -0.21, 0.47, z - 0.22, 0.21, 0.85, z - 0.19, lin(pick(BRIGHT, it.v)));
	},
	rack(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, blue = lin([0.15, 0.3, 0.6]), orange = lin([0.9, 0.45, 0.1]);
		for (let z = -D2; z <= D2 + 0.01; z += Math.max(2.4, it.d / Math.max(1, Math.round(it.d / 2.7)))) for (const sx of [-1, 1]) bx(g, 'metal', sx * W2 - 0.05, 0, z - 0.05, sx * W2 + 0.05, it.h, z + 0.05, blue);
		for (let y = 0.15; y < it.h - 0.4; y += 1.5) {
			for (const sx of [-1, 1]) bx(g, 'metal', sx * W2 - 0.06, y, -D2, sx * W2 + 0.06, y + 0.12, D2, orange);
			for (let z = -D2 + 0.6; z < D2 - 0.5; z += 1.3) if (rnd() < 0.8) { bx(g, 'grain', -W2 + 0.05, y + 0.12, z - 0.55, W2 - 0.05, y + 0.26, z + 0.55, lin([0.6, 0.48, 0.3])); bx(g, 'matte', -W2 + 0.1, y + 0.26, z - 0.5, W2 - 0.1, y + 0.26 + 0.5 + rnd() * 0.6, z + 0.5, lin([0.7 + rnd() * 0.1, 0.55 + rnd() * 0.1, 0.35])); }
		}
	},
	crates(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.14, D2, lin([0.6, 0.48, 0.3]));
		let y = 0.14;
		while (y < it.h) { const hh = 0.35 + rnd() * 0.25; bx(g, 'matte', -W2 + 0.05, y, -D2 + 0.05, W2 - 0.05, y + hh, D2 - 0.05, lin([0.7 + rnd() * 0.1, 0.56, 0.36])); y += hh + 0.01; }
	},
	forklift(g) {
		const Y = lin([0.95, 0.7, 0.1]);
		bx(g, 'gloss', -0.55, 0.25, -1.1, 0.55, 1.1, 0.5, Y);
		bx(g, 'matte', -0.5, 1.1, -0.9, 0.5, 1.2, -0.2, BLACK);
		for (const sx of [-1, 1]) { bx(g, 'metal', sx * 0.5 - 0.03, 1.1, -0.1, sx * 0.5 + 0.03, 2.1, -0.04, BLACK); bx(g, 'metal', sx * 0.5 - 0.03, 1.1, -1.05, sx * 0.5 + 0.03, 2.1, -0.99, BLACK); }
		bx(g, 'metal', -0.55, 2.05, -1.05, 0.55, 2.1, -0.04, BLACK);
		bx(g, 'metal', -0.45, 0, 0.5, 0.45, 2.3, 0.62, lin([0.3, 0.3, 0.3]));
		for (const sx of [-1, 1]) bx(g, 'metal', sx * 0.3 - 0.06, 0.08, 0.62, sx * 0.3 + 0.06, 0.12, 1.2, STEEL);
		for (const sx of [-1, 1]) for (const z of [-0.8, 0.25]) g.cyl('matte', sx * 0.55, 0.25, z, 0.25, 0.18 * sx, BLACK, 12, 'x');
	},
	officeDesk(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0.72, -D2, W2, 0.75, D2, lin([0.9, 0.89, 0.86]));
		for (const sx of [-1, 1]) bx(g, 'metal', sx * (W2 - 0.05) - 0.02, 0, -D2 + 0.05, sx * (W2 - 0.05) + 0.02, 0.72, D2 - 0.05, STEEL);
		bx(g, 'gloss', -0.3, 0.8, D2 - 0.2, 0.3, 1.15, D2 - 0.17, BLACK); bx(g, 'lamp', -0.28, 0.82, D2 - 0.225, 0.28, 1.13, D2 - 0.2, lin([0.5, 0.65, 0.9]));
		bx(g, 'matte', -0.25, 0.42, -D2 - 0.45, 0.25, 0.47, -D2 - 0.0, BLACK); bx(g, 'matte', -0.25, 0.47, -D2 - 0.5, 0.25, 1.0, -D2 - 0.44, BLACK);
	},
	boxes(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		let y = 0;
		for (let i = 0; i < 1 + Math.floor(it.v * 3); i++) { const s = 0.8 - i * 0.12; bx(g, 'matte', -W2 * s, y, -D2 * s, W2 * s, y + 0.28, D2 * s, lin([0.72, 0.58, 0.4].map((c) => c * (0.85 + rnd() * 0.2)))); y += 0.28; }
	},
	// a market stall: a counter at the front, an awning over it, goods on it and on the shelf behind;
	// down the middle of a hall (it.island) a counter all round
	stall(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOOD, it.v)), aw = lin(pick(BRIGHT, it.v * 7));
		const GOODS = [[[0.8, 0.1, 0.1], [0.95, 0.6, 0.1], [0.35, 0.6, 0.2]], [[0.82, 0.58, 0.3], [0.62, 0.38, 0.2]], [[0.95, 0.85, 0.5], [0.9, 0.75, 0.3]], [[0.9, 0.2, 0.3], [0.95, 0.85, 0.3], [0.8, 0.4, 0.8]], [[0.3, 0.18, 0.1], [0.45, 0.3, 0.2]], [[0.75, 0.75, 0.78], [0.9, 0.55, 0.45]]][it.kind % 6];
		const counter = (x0, z0, x1, z1) => {
			bx(g, 'grain', x0, 0, z0, x1, 0.9, z1, wd);
			bx(g, 'stone', x0 - 0.02, 0.9, z0 - 0.02, x1 + 0.02, 0.94, z1 + 0.02, MARBLE);
			// (the goods heaped in crates and baskets along it)
			for (let x = x0 + 0.05; x < x1 - 0.3; x += 0.34) for (let z = z0 + 0.05; z < z1 - 0.25; z += 0.34) bx(g, 'matte', x, 0.94, z, x + 0.3, 1.0 + rnd() * 0.08, z + 0.3, lin(pick(GOODS, rnd())));
		};
		if (it.island) {
			counter(-W2, D2 - 0.6, W2, D2); counter(-W2, -D2, W2, -D2 + 0.6);
			counter(-W2, -D2 + 0.6, -W2 + 0.6, D2 - 0.6); counter(W2 - 0.6, -D2 + 0.6, W2, D2 - 0.6);
		} else {
			counter(-W2, D2 - 0.7, W2, D2);
			for (const y of [0.9, 1.5, 2.1]) {
				bx(g, 'grain', -W2, y, -D2, W2, y + 0.04, -D2 + 0.5, wd);
				for (let x = -W2 + 0.1; x < W2 - 0.4; x += 0.4) bx(g, rnd() < 0.5 ? 'gloss' : 'matte', x, y + 0.04, -D2 + 0.1, x + 0.32, y + 0.22 + rnd() * 0.12, -D2 + 0.4, lin(pick(GOODS, rnd())));
			}
		}
		for (const sx of [-1, 1]) for (const sz of it.island ? [-1, 1] : [1]) bx(g, 'metal', sx * W2 - 0.04 * (sx + 1), 0.94, sz * D2 - 0.04 * (sz + 1), sx * W2 - 0.04 * (sx - 1), it.h - 0.3, sz * D2 - 0.04 * (sz - 1), BLACK);
		bx(g, 'fabric', -W2 - 0.1, it.h - 0.3, -D2 - 0.1, W2 + 0.1, it.h - 0.24, D2 + 0.3, aw);
		for (let x = -W2; x < W2 - 0.05; x += 0.6) bx(g, 'fabric', x, it.h - 0.55, D2 + 0.28, x + 0.3, it.h - 0.24, D2 + 0.3, x % 1.2 < 0.6 ? aw : WHITE);
		g.cyl('lamp', 0, it.h - 0.55, D2 * 0.3, 0.12, 0.2, lin([1, 0.85, 0.6]), 8);
	},
	// a lift's doors in their steel frame, the call button beside them
	liftDoors(g, it) {
		const W2 = it.w / 2;
		bx(g, 'metal', -W2 - 0.12, 0, -0.02, W2 + 0.12, it.h + 0.2, 0.06, STEEL);
		bx(g, 'mirror', -W2, 0, 0.06, -0.01, it.h, 0.08, lin([0.62, 0.63, 0.66]));
		bx(g, 'mirror', 0.01, 0, 0.06, W2, it.h, 0.08, lin([0.62, 0.63, 0.66]));
		bx(g, 'metal', W2 + 0.25, 1.0, 0.0, W2 + 0.37, 1.25, 0.06, STEEL);
		g.cyl('lamp', W2 + 0.31, 1.12, 0.06, 0.025, 0.02, lin([1, 0.8, 0.4]), 8, 'z');
		bx(g, 'lamp', -0.3, it.h + 0.05, 0.06, 0.3, it.h + 0.15, 0.08, lin([1, 0.6, 0.3]));
	},
	// a raised platform: a long desk with its chairs on it for a council, music stands for a band
	dais(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin(pick(WOOD, it.v));
		bx(g, 'grain', -W2, 0, -D2, W2, 0.45, D2, wd);
		bx(g, 'grain', -W2, 0, D2, W2, 0.22, D2 + 0.3, wd);
		if (it.band) {
			for (let k = 0; k < 6; k++) { const x = -W2 + 0.8 + k * (it.w - 1.6) / 5, z = (k % 2 ? -0.3 : 0.4) * D2; g.cyl('metal', x, 0.45, z, 0.012, 1.0, BLACK, 4); bx(g, 'metal', x - 0.22, 1.35, z - 0.02, x + 0.22, 1.6, z + 0.02, BLACK); }
			g.cyl('gloss', W2 - 1.0, 0.45, -D2 * 0.4, 0.32, 0.3, lin([0.7, 0.15, 0.12]), 12);
			bx(g, 'gloss', -W2 + 0.4, 0.45, -D2 + 0.2, -W2 + 1.9, 1.45, -D2 + 0.8, BLACK);
			return;
		}
		bx(g, 'grain', -W2 + 0.3, 0.45, D2 - 0.75, W2 - 0.3, 1.5, D2 - 0.2, wd);
		bx(g, 'stone', -W2 + 0.25, 1.5, D2 - 0.8, W2 - 0.25, 1.55, D2 - 0.15, MARBLE);
		for (let x = -W2 + 0.9; x < W2 - 0.6; x += 1.1) {
			bx(g, 'fabric', x - 0.25, 0.9, D2 - 1.45, x + 0.25, 0.97, D2 - 0.95, lin([0.4, 0.12, 0.1]));
			bx(g, 'fabric', x - 0.25, 0.97, D2 - 1.5, x + 0.25, 1.75, D2 - 1.42, lin([0.4, 0.12, 0.1]));
			bx(g, 'metal', x - 0.04, 1.55, D2 - 0.6, x + 0.04, 1.85, D2 - 0.55, BLACK);
			if (rnd() < 0.3) bx(g, 'matte', x - 0.15, 1.55, D2 - 0.5, x + 0.15, 1.57, D2 - 0.3, WHITE);
		}
		// the seal on the wall behind (a plain disc)
		g.cyl('metal', 0, 2.6, -D2 + 0.02, 0.6, 0.04, lin([0.75, 0.6, 0.3]), 16, 'z');
	},
	// a block of cells three tiers high, back to back along its length, the cells opening to
	// either side (±x) behind their bars; the galleries to the upper tiers along its faces
	cellBlock(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, tier = 2.7, CON = lin([0.78, 0.77, 0.72]), BAR = lin([0.28, 0.3, 0.3]), cell = 1.55;
		const n = Math.max(1, Math.floor(it.d / cell)), z0 = -n * cell / 2, gal = 0.9;
		bx(g, 'stone', -1, 0, -D2, 1, tier * 3 + 0.3, D2, CON);   // the utility corridor between
		for (let t = 0; t < 3; t++) {
			const y = t * tier;
			for (const s of [-1, 1]) {
				const xf = s * (W2 - gal), xb = s, lo = Math.min(xf, xb), hi = Math.max(xf, xb);
				bx(g, 'stone', lo, y, -D2, hi, y + 0.15, D2, CON);
				bx(g, 'stone', lo, y + tier - 0.15, -D2, hi, y + tier, D2, CON);
				for (let i = 0; i <= n; i++) bx(g, 'stone', lo, y, z0 + i * cell - 0.06, hi, y + tier, z0 + i * cell + 0.06, CON);
				// the bars: a few uprights and a cross bar to each cell, a bunk behind
				for (let i = 0; i < n; i++) {
					const za = z0 + i * cell, b0 = Math.min(xb + s * 0.1, xb + s * 1.9), b1 = Math.max(xb + s * 0.1, xb + s * 1.9);
					for (let k = 1; k < 5; k++) bx(g, 'metal', xf - 0.02, y + 0.15, za + k * cell / 5 - 0.015, xf + 0.02, y + tier - 0.15, za + k * cell / 5 + 0.015, BAR);
					bx(g, 'metal', xf - 0.025, y + 1.2, za, xf + 0.025, y + 1.28, za + cell, BAR);
					bx(g, 'matte', b0, y + 0.5, za + 0.1, b1, y + 0.56, za + 0.78, lin([0.55, 0.55, 0.5]));
					if (rnd() < 0.5) bx(g, 'fabric', b0 + 0.05, y + 0.56, za + 0.14, b1 - 0.05, y + 0.64, za + 0.74, lin(pick([[0.5, 0.5, 0.45], [0.35, 0.38, 0.45]], rnd())));
				}
				// the gallery to this tier, its rail
				if (t) {
					bx(g, 'metal', Math.min(xf, s * W2), y - 0.08, -D2, Math.max(xf, s * W2), y + 0.02, D2, BAR);
					bx(g, 'metal', s * W2 - 0.03, y + 1.0, -D2, s * W2 + 0.03, y + 1.06, D2, BAR);
					for (let z = -D2; z <= D2; z += 1.6) bx(g, 'metal', s * W2 - 0.02, y, z - 0.02, s * W2 + 0.02, y + 1.0, z + 0.02, BAR);
				}
			}
		}
		bx(g, 'stone', -W2 + gal, tier * 3, -D2, W2 - gal, tier * 3 + 0.3, D2, CON);
		if (it.cap0 ?? true) bx(g, 'stone', -W2 + gal, 0, -D2 - 0.15, W2 - gal, tier * 3, -D2, CON);
		if (it.cap1 ?? true) bx(g, 'stone', -W2 + gal, 0, D2, W2 - gal, tier * 3, D2 + 0.15, CON);
	},
	// a long steel table with its fixed round stools either side
	messTable(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0.72, -D2, W2, 0.76, D2, STEEL);
		for (const x of [-W2 + 0.3, W2 - 0.34]) bx(g, 'metal', x, 0, -0.05, x + 0.04, 0.72, 0.05, STEEL);
		const per = Math.ceil((it.chairs || 6) / 2);
		for (let i = 0; i < per; i++) for (const s of [-1, 1]) { const x = -W2 + it.w * (i + 0.5) / per, z = s * (D2 + 0.14); g.cyl('metal', x, 0, z, 0.03, 0.44, STEEL, 6); g.cyl('metal', x, 0.44, z, 0.17, 0.04, STEEL, 10); }
	},
	// a muzzle-loading gun on its iron carriage, its muzzle toward the wall behind it (-z)
	cannon(g, it) {
		const IRON = lin([0.12, 0.12, 0.13]), D2 = it.d / 2;
		bx(g, 'grain', -0.5, 0.1, -D2 + 0.4, 0.5, 0.55, D2 - 0.2, lin([0.3, 0.22, 0.15]));
		for (const sx of [-1, 1]) for (const z of [-D2 + 0.6, D2 - 0.5]) g.cyl('metal', sx * 0.52, 0.22, z, 0.22, 0.08 * sx, IRON, 12, 'x');
		g.cyl('metal', 0, 0.85, -D2 + 0.05, 0.14, it.d - 0.6, IRON, 12, 'z', true, 0.24);
		g.sphere('metal', 0, 0.85, D2 - 0.55, 0.24, 0.24, 0.2, IRON, 10);
		for (let k = 0; k < 6; k++) g.sphere('metal', 0.75 + (k % 3) * 0.17, 0.08 + Math.floor(k / 3) * 0.14, D2 - 0.3 - (k % 2) * 0.1, 0.08, 0.08, 0.08, IRON, 6);
	},
	flagpole(g, it) {
		g.cyl('stone', 0, 0, 0, 0.5, 0.3, MARBLE, 12);
		g.cyl('metal', 0, 0.3, 0, 0.06, it.h - 0.3, WHITE, 8, 'y', true, 0.035);
		g.sphere('metal', 0, it.h + 0.05, 0, 0.09, 0.09, 0.09, lin([0.8, 0.66, 0.3]), 8);
		bx(g, 'fabric', 0.05, it.h - 1.9, -0.01, 2.6, it.h - 0.4, 0.01, lin([0.75, 0.15, 0.15]));
		bx(g, 'fabric', 0.05, it.h - 1.3, -0.012, 1.2, it.h - 0.4, 0.012, lin([0.15, 0.2, 0.5]));
	},
	// a double-faced run of library shelves full of books
	stack(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, c = lin([0.55, 0.5, 0.45]);
		bx(g, 'metal', -W2, 0, -0.02, W2, it.h, 0.02, c);
		for (const x of [-W2, W2 - 0.04]) bx(g, 'metal', x, 0, -D2, x + 0.04, it.h, D2, c);
		for (let y = 0.1; y < it.h - 0.2; y += 0.38) {
			bx(g, 'metal', -W2, y, -D2, W2, y + 0.02, D2, c);
			for (const s of [-1, 1]) for (let x = -W2 + 0.06; x < W2 - 0.12;) { const w = 0.6 + rnd() * 0.7; bx(g, 'matte', x, y + 0.02, s > 0 ? 0.03 : -D2 + 0.03, Math.min(W2 - 0.06, x + w), y + 0.24 + rnd() * 0.08, s > 0 ? D2 - 0.03 : -0.03, lin(pick(BRIGHT, rnd()).map((v) => v * 0.7))); x += w + 0.02; }
		}
	},
	// an arcade game: the cabinet, its glowing screen and marquee, the controls
	arcadeCabinet(g, it, rnd) {
		const W2 = it.w / 2 - 0.1, D2 = it.d / 2 - 0.1, c = lin(pick([[0.1, 0.1, 0.12], [0.5, 0.1, 0.1], [0.1, 0.2, 0.5], [0.12, 0.35, 0.15]], it.v));
		if (it.v < 0.2) {
			// a claw machine: glass box on a cabinet, the prizes heaped inside
			bx(g, 'gloss', -W2, 0, -D2, W2, 0.9, D2, c);
			bx(g, 'glass', -W2, 0.9, -D2, W2, 1.8, D2, WHITE);
			for (let k = 0; k < 10; k++) g.sphere('fabric', (rnd() - 0.5) * W2 * 1.6, 0.98, (rnd() - 0.5) * D2 * 1.6, 0.09, 0.08, 0.09, lin(pick(BRIGHT, rnd())), 6);
			bx(g, 'lamp', -W2, 1.8, -D2, W2, 1.9, D2, lin([1, 0.8, 0.4]));
			return;
		}
		bx(g, 'gloss', -W2, 0, -D2, W2, it.h, D2 - 0.35, c);
		bx(g, 'gloss', -W2, 0, D2 - 0.35, W2, 0.9, D2, c);
		bx(g, 'matte', -W2 + 0.04, 0.9, D2 - 0.36, W2 - 0.04, 1.0, D2 - 0.1, BLACK);
		g.cyl('gloss', -0.12, 1.0, D2 - 0.22, 0.015, 0.08, BLACK, 6); g.sphere('gloss', -0.12, 1.09, D2 - 0.22, 0.03, 0.03, 0.03, lin([0.9, 0.1, 0.1]), 6);
		for (let k = 0; k < 3; k++) g.cyl('gloss', 0.05 + k * 0.08, 1.0, D2 - 0.2, 0.022, 0.015, lin(pick(BRIGHT, k * 0.3)), 8);
		bx(g, 'lamp', -W2 + 0.06, 1.1, D2 - 0.36, W2 - 0.06, 1.6, D2 - 0.34, lin(pick([[0.3, 0.6, 1], [0.4, 1, 0.5], [1, 0.4, 0.6], [1, 0.8, 0.3]], rnd())));
		bx(g, 'lamp', -W2, it.h - 0.22, D2 - 0.36, W2, it.h - 0.04, D2 - 0.34, lin(pick(BRIGHT, rnd())));
	},
	// a horse's stall: plank sides and a half door
	barnStall(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin([0.45, 0.3, 0.18]);
		for (const x of [-W2, W2 - 0.08]) bx(g, 'grain', x, 0, -D2, x + 0.08, it.h, D2, wd);
		bx(g, 'grain', -W2 + 0.08, 0, D2 - 0.08, -0.6, it.h * 0.75, D2, wd);
		bx(g, 'grain', 0.6, 0, D2 - 0.08, W2 - 0.08, it.h * 0.75, D2, wd);
		bx(g, 'grain', -0.6, 0.3, D2 - 0.06, 0.6, 1.3, D2 - 0.02, lin([0.6, 0.18, 0.12]));
		bx(g, 'matte', -W2 + 0.1, 0, -D2, W2 - 0.1, 0.05, D2 - 0.1, lin([0.8, 0.7, 0.4]));
		bx(g, 'grain', -W2 + 0.2, 0.9, -D2, -W2 + 0.8, 1.2, -D2 + 0.4, wd);
	},
	// a stack of straw bales
	hay(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (let y = 0; y < it.h - 0.05; y += 0.5) bx(g, 'fabric', -W2 + rnd() * 0.06, y, -D2, W2 - rnd() * 0.06, Math.min(it.h, y + 0.48), D2, lin([0.82 + rnd() * 0.06, 0.7, 0.38]));
	},
	// a small old tractor: the big rear wheels, the hood, the seat and the stack
	tractor(g) {
		const R = lin([0.7, 0.12, 0.1]);
		bx(g, 'gloss', -0.4, 0.5, -0.4, 0.4, 1.3, 1.5, R);
		bx(g, 'gloss', -0.55, 0.5, -1.4, 0.55, 1.0, -0.4, R);
		bx(g, 'matte', -0.25, 1.0, -1.0, 0.25, 1.1, -0.6, BLACK);
		g.cyl('metal', 0.2, 1.3, 1.1, 0.05, 0.7, BLACK, 6);
		for (const sx of [-1, 1]) { g.cyl('matte', sx * 0.65, 0.75, -1.0, 0.75, 0.3 * sx, BLACK, 14, 'x'); g.cyl('matte', sx * 0.45, 0.38, 1.2, 0.38, 0.18 * sx, BLACK, 12, 'x'); }
	},
	// a fish market's case: a cold steel case, crushed ice in it, the fish laid on the ice
	fishCase(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0, -D2, W2, 0.8, D2, STEEL);
		bx(g, 'matte', -W2 + 0.05, 0.8, -D2 + 0.05, W2 - 0.05, 0.86, D2 - 0.05, lin([0.9, 0.93, 0.96]));
		bx(g, 'glass', -W2, 0.86, D2 - 0.06, W2, 1.15, D2, WHITE);
		for (let x = -W2 + 0.15; x < W2 - 0.15; x += 0.22) for (let z = -D2 + 0.15; z < D2 - 0.15; z += 0.3) g.sphere('gloss', x, 0.9, z, 0.08, 0.035, 0.12, lin(pick(it.live ? [[0.3, 0.3, 0.25], [0.5, 0.4, 0.3]] : [[0.75, 0.75, 0.78], [0.9, 0.5, 0.42], [0.85, 0.3, 0.2], [0.55, 0.58, 0.6]], rnd())), 6);
	},
	// a model of a campus on its table: the ring of the building, its roof of panels, the trees
	campusModel(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, R = Math.min(W2, D2) * 0.8;
		bx(g, 'stone', -W2, 0, -D2, W2, 0.9, D2, WHITE);
		bx(g, 'matte', -W2 + 0.1, 0.9, -D2 + 0.1, W2 - 0.1, 0.92, D2 - 0.1, lin([0.45, 0.55, 0.32]));
		g.cyl('matte', 0, 0.92, 0, R, 0.18, WHITE, 48, 'y', false);
		g.cyl('matte', 0, 0.92, 0, R * 0.8, 0.18, WHITE, 48, 'y', false);
		for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, b = (i + 1) / 48 * Math.PI * 2, x0 = Math.sin(a), z0 = Math.cos(a), x1 = Math.sin(b), z1 = Math.cos(b); g.quad('matte', [x0 * R * 0.8, 1.1, z0 * R * 0.8], [x0 * R, 1.1, z0 * R], [x1 * R, 1.1, z1 * R], [x1 * R * 0.8, 1.1, z1 * R * 0.8], [0, 1, 0], lin([0.12, 0.13, 0.16]), [[0, 0], [1, 0], [1, 1], [0, 1]]); }
		for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, r = rnd() < 0.6 ? rnd() * R * 0.7 : R * (1.05 + rnd() * 0.15); g.sphere('matte', Math.sin(a) * r, 0.97, Math.cos(a) * r, 0.06, 0.06, 0.06, lin([0.25, 0.42, 0.2]), 6); }
		bx(g, 'glass', -W2, 0.92, -D2, W2, 1.5, D2, WHITE);
	},
};
// crown moulding round the ceiling, a picture rail below it
function crown(g, it) {
	g.at(0, it.y, 0, 0);
	const c = WHITE, y = it.ceil, { x0, z0, x1, z1 } = it;
	for (const [a, b, e, f] of [[x0, z0, x1, z0 + 0.1], [x0, z1 - 0.1, x1, z1], [x0, z0, x0 + 0.1, z1], [x1 - 0.1, z0, x1, z1]]) {
		g.box('trim', a, y - 0.14, b, e, y, f, c);
		g.box('trim', a, y - 0.3, b, e, y - 0.27, f, c);          // (the picture rail)
	}
}
// what a solid item stops you walking through (rugs, art, moulding, lights: nothing)
export const SOFT = new Set(['rug', 'bathMat', 'art', 'ceilingLight', 'toys', 'crown']);
