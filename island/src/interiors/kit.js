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
			for (let z = -D2 + 0.06; z < D2 - 0.12; z += 0.16 + rnd() * 0.06) { const c = lin(pick(BRIGHT, rnd())), x0 = s > 0 ? 0.1 : -W2 + 0.06, x1 = s > 0 ? W2 - 0.06 : -0.1, hh = 0.14 + rnd() * 0.2; bx(g, 'matte', x0, y + 0.03, z, x1, y + 0.03 + hh, z + 0.12, c); }
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
