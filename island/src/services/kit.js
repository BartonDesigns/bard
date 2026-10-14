// The things in the hospitals, the police and fire stations and the armories, drawn the way
// interiors/kit.js draws a room's furniture: each in its own frame (width along x, depth
// along z, its front toward +z, standing on y = 0), into the building's builder by
// material, so a whole station stays a handful of draws. Registered with the interiors' kit
// (addKit) on import. The colours stay plain and believable: steel, enamel, olive drab,
// the reds and yellows a fire crew's gear really is. No badge or emblem of any real service.

import { addKit } from '../interiors/kit.js';
import { lin, FLAT } from '../bay/housekit.js';

const STEEL = lin([0.7, 0.71, 0.73]), DARKSTEEL = lin([0.32, 0.33, 0.35]), BLACK = lin([0.05, 0.05, 0.055]), WHITE = lin([0.93, 0.93, 0.91]);
const OFFWHITE = lin([0.86, 0.87, 0.85]), MINT = lin([0.62, 0.78, 0.74]), BLUE = lin([0.22, 0.38, 0.6]), PALE = lin([0.72, 0.82, 0.86]);
const OLIVE = lin([0.29, 0.31, 0.2]), DRAB = lin([0.38, 0.36, 0.26]), TAN = lin([0.62, 0.52, 0.34]), RED = lin([0.62, 0.08, 0.06]), YELLOW = lin([0.9, 0.72, 0.12]);
const WOODC = lin([0.55, 0.42, 0.28]), GREENLED = lin([0.2, 1, 0.45]), AMBERLED = lin([1, 0.62, 0.15]), REDLED = lin([1, 0.18, 0.12]);
const pick = (l, v) => l[Math.floor(v * 9973) % l.length];
const bx = (g, k, x0, y0, z0, x1, y1, z1, c) => g.box(k, x0, y0, z0, x1, y1, z1, c);
const legs = (g, w, d, h, c, r = 0.025, inset = 0.06) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl('metal', sx * (w / 2 - inset), 0, sz * (d / 2 - inset), r, h, c, 6); };
const caster = (g, x, z) => { g.cyl('matte', x, 0, z, 0.04, 0.07, BLACK, 6); };
// a seated person's chair, rolling, at (x, z) facing +z
const deskChair = (g, x, z, c = BLACK) => {
	g.cyl('metal', x, 0, z, 0.26, 0.03, DARKSTEEL, 8); g.cyl('metal', x, 0.03, z, 0.025, 0.42, DARKSTEEL, 6);
	bx(g, 'fabric', x - 0.24, 0.44, z - 0.24, x + 0.24, 0.52, z + 0.22, c);
	bx(g, 'fabric', x - 0.22, 0.55, z - 0.3, x + 0.22, 0.98, z - 0.24, c);
};
const screen = (g, x, y, z, w, h, col = lin([0.35, 0.55, 0.85])) => {
	bx(g, 'gloss', x - w / 2 - 0.02, y, z - 0.03, x + w / 2 + 0.02, y + h + 0.02, z, BLACK);
	bx(g, 'bulb', x - w / 2, y + 0.02, z + 0.001, x + w / 2, y + h, z + 0.004, col);
};

const KIT = {
	// ---------- the hospital ----------
	hospitalBed(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (const [x, z] of [[-W2 + 0.08, -D2 + 0.1], [W2 - 0.08, -D2 + 0.1], [-W2 + 0.08, D2 - 0.1], [W2 - 0.08, D2 - 0.1]]) caster(g, x, z);
		bx(g, 'metal', -W2 + 0.04, 0.12, -D2 + 0.06, W2 - 0.04, 0.2, D2 - 0.06, DARKSTEEL);
		bx(g, 'metal', -0.12, 0.2, -0.3, 0.12, 0.45, 0.3, STEEL);
		bx(g, 'gloss', -W2 + 0.02, 0.45, -D2 + 0.04, W2 - 0.02, 0.52, D2 - 0.04, OFFWHITE);
		// the mattress, its head raised a little, the sheet and blanket, the pillow
		bx(g, 'fabric', -W2 + 0.05, 0.52, -D2 + 0.65, W2 - 0.05, 0.66, D2 - 0.06, WHITE);
		g.beam('fabric', [0, 0.6, -D2 + 0.08], [0, 0.78, -D2 + 0.66], it.w - 0.1, 0.14, WHITE);
		bx(g, 'fabric', -W2 + 0.04, 0.66, -0.2, W2 - 0.04, 0.7, D2 - 0.12, pick([PALE, MINT, lin([0.8, 0.84, 0.9])], it.v));
		bx(g, 'fabric', -0.3, 0.8, -D2 + 0.12, 0.3, 0.92, -D2 + 0.42, WHITE);
		// head and foot boards, the side rails
		bx(g, 'gloss', -W2, 0.45, -D2, W2, 1.05, -D2 + 0.05, lin([0.78, 0.8, 0.82]));
		bx(g, 'gloss', -W2, 0.45, D2 - 0.05, W2, 0.85, D2, lin([0.78, 0.8, 0.82]));
		for (const sx of [-1, 1]) { bx(g, 'metal', sx * W2 - 0.015, 0.62, -D2 + 0.3, sx * W2 + 0.015, 0.66, D2 - 0.6, STEEL); bx(g, 'metal', sx * W2 - 0.015, 0.78, -D2 + 0.3, sx * W2 + 0.015, 0.82, D2 - 0.6, STEEL); }
		// the drip on its pole at the head
		g.cyl('metal', W2 + 0.18, 0, -D2 + 0.2, 0.012, 1.9, STEEL, 6);
		g.cyl('metal', W2 + 0.18, 0, -D2 + 0.2, 0.18, 0.02, DARKSTEEL, 6);
		bx(g, 'glass', W2 + 0.12, 1.55, -D2 + 0.17, W2 + 0.24, 1.78, -D2 + 0.23, WHITE);
	},
	vitalsMonitor(g, it) {
		g.cyl('metal', 0, 0, 0, 0.22, 0.03, DARKSTEEL, 8); g.cyl('metal', 0, 0, 0, 0.02, 1.25, STEEL, 6);
		bx(g, 'gloss', -0.2, 1.2, -0.08, 0.2, 1.52, 0.06, lin([0.85, 0.86, 0.84]));
		bx(g, 'bulb', -0.17, 1.24, 0.061, 0.17, 1.48, 0.064, lin([0.03, 0.05, 0.06]));
		// the traces: heart, oxygen, breath
		for (const [y, c] of [[1.42, GREENLED], [1.35, lin([0.2, 0.7, 1])], [1.28, AMBERLED]]) for (let i = 0; i < 6; i++) { const x = -0.15 + i * 0.05, k = (i * 7 + Math.floor(it.v * 10)) % 3 === 0 ? 0.03 : 0.006; bx(g, 'bulb', x, y - k / 2, 0.065, x + 0.035, y + k / 2, 0.068, c); }
	},
	curtain(g, it) {
		const W2 = it.w / 2, h = it.h || 2.3, c = pick([lin([0.55, 0.72, 0.7]), lin([0.6, 0.66, 0.78]), lin([0.74, 0.76, 0.66])], it.v);
		bx(g, 'metal', -W2, h + 0.15, -0.02, W2, h + 0.19, 0.02, STEEL);
		const n = Math.max(2, Math.round(it.w / 0.22));
		for (let i = 0; i < n; i++) { const x0 = -W2 + i * it.w / n, z = i % 2 ? 0.035 : -0.035; bx(g, 'fabric', x0, 0.3, z - 0.012, x0 + it.w / n + 0.01, h + 0.15, z + 0.012, c); }
	},
	nurseStation(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, top = lin([0.88, 0.86, 0.8]), face = pick([lin([0.42, 0.6, 0.66]), lin([0.55, 0.62, 0.7]), lin([0.62, 0.5, 0.42])], it.v);
		bx(g, 'grain', -W2, 0, D2 - 0.25, W2, 1.08, D2, face);
		bx(g, 'stone', -W2 - 0.04, 1.08, D2 - 0.34, W2 + 0.04, 1.12, D2 + 0.06, top);
		bx(g, 'grain', -W2, 0.72, -D2, W2, 0.76, D2 - 0.25, top);
		for (const sx of [-1, 1]) bx(g, 'grain', sx * W2 - 0.03, 0, -D2, sx * W2 + 0.03, 0.72, D2 - 0.25, face);
		for (let x = -W2 + 0.6; x < W2 - 0.4; x += 1.1) { screen(g, x, 0.82, -D2 + 0.25, 0.5, 0.32); deskChair(g, x, -D2 - 0.25 + it.d * 0.6, BLUE); }
		for (let x = -W2 + 0.3; x < W2 - 0.2; x += 0.5) bx(g, 'matte', x, 0.76, -D2 + 0.45, x + 0.22, 0.8, -D2 + 0.75, WHITE);
	},
	waitingChairs(g, it) {
		const W2 = it.w / 2, n = Math.max(1, Math.round(it.w / 0.58)), c = pick([BLUE, lin([0.3, 0.45, 0.42]), lin([0.5, 0.3, 0.32])], it.v);
		bx(g, 'metal', -W2, 0.32, -0.04, W2, 0.36, 0.04, DARKSTEEL);
		for (const x of [-W2 + 0.15, W2 - 0.15]) bx(g, 'metal', x - 0.03, 0, -0.2, x + 0.03, 0.34, 0.2, DARKSTEEL);
		for (let i = 0; i < n; i++) {
			const x = -W2 + (i + 0.5) * it.w / n;
			bx(g, 'gloss', x - 0.24, 0.4, -0.22, x + 0.24, 0.46, 0.24, c);
			bx(g, 'gloss', x - 0.24, 0.46, -0.3, x + 0.24, 0.88, -0.24, c);
			if (i) bx(g, 'metal', x - it.w / n / 2 - 0.02, 0.46, -0.2, x - it.w / n / 2 + 0.02, 0.62, 0.15, DARKSTEEL);
		}
	},
	triageDesk(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, face = lin([0.84, 0.84, 0.82]);
		bx(g, 'grain', -W2, 0, -D2, W2, 1.05, D2, face);
		bx(g, 'stone', -W2 - 0.03, 1.05, -D2, W2 + 0.03, 1.09, D2 + 0.05, lin([0.4, 0.42, 0.44]));
		bx(g, 'glass', -W2, 1.09, D2 - 0.03, W2, 2.1, D2, WHITE);
		bx(g, 'metal', -W2, 2.1, D2 - 0.05, W2, 2.14, D2 + 0.01, STEEL);
		for (let x = -W2 + 0.5; x < W2 - 0.3; x += 1.2) screen(g, x, 1.1, -D2 + 0.25, 0.46, 0.3);
		bx(g, 'bulb', -0.4, 0.5, D2 + 0.001, 0.4, 0.62, D2 + 0.004, lin([0.85, 0.3, 0.3]));
	},
	opTable(g, it) {
		const D2 = it.d / 2;
		bx(g, 'metal', -0.35, 0, -0.5, 0.35, 0.06, 0.5, DARKSTEEL);
		g.cyl('metal', 0, 0.06, 0, 0.14, 0.7, STEEL, 10);
		bx(g, 'metal', -0.3, 0.76, -D2, 0.3, 0.84, D2, STEEL);
		bx(g, 'fabric', -0.28, 0.84, -D2 + 0.02, 0.28, 0.95, D2 - 0.02, lin([0.25, 0.35, 0.4]));
		for (const sx of [-1, 1]) bx(g, 'metal', sx * 0.3, 0.8, -0.1, sx * 0.3 + sx * 0.4, 0.84, 0.05, STEEL);
	},
	surgicalLight(g, it) {
		const y = (it.ceil || 3) - 0.02;
		g.cyl('metal', 0, y - 0.12, 0, 0.08, 0.12, WHITE, 10);
		g.beam('metal', [0, y - 0.1, 0], [0.5, y - 0.75, 0.2], 0.06, 0.06, WHITE);
		g.cyl('gloss', 0.5, y - 0.95, 0.2, 0.36, 0.14, WHITE, 16);
		g.cyl('bulb', 0.5, y - 0.96, 0.2, 0.3, 0.01, lin([1, 0.98, 0.9]), 16);
		g.beam('metal', [0, y - 0.1, 0], [-0.45, y - 0.8, -0.3], 0.06, 0.06, WHITE);
		g.cyl('gloss', -0.45, y - 1.0, -0.3, 0.28, 0.12, WHITE, 14);
		g.cyl('bulb', -0.45, y - 1.01, -0.3, 0.23, 0.01, lin([1, 0.98, 0.9]), 14);
	},
	anesthesiaCart(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(g, sx * (W2 - 0.06), sz * (D2 - 0.06));
		bx(g, 'gloss', -W2, 0.08, -D2, W2, 0.95, D2, lin([0.82, 0.84, 0.86]));
		for (let y = 0.2; y < 0.9; y += 0.22) bx(g, 'metal', -W2 + 0.03, y, D2, W2 - 0.03, y + 0.02, D2 + 0.01, STEEL);
		screen(g, 0, 1.0, 0, 0.5, 0.36, lin([0.15, 0.6, 0.45]));
		for (const x of [-W2 + 0.08, -W2 + 0.2]) g.cyl('gloss', x, 0.95, -D2 + 0.1, 0.05, 0.55, x < -W2 + 0.1 ? lin([0.15, 0.55, 0.25]) : WHITE, 8);
	},
	scrubSink(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0, -D2, W2, 0.8, D2, STEEL);
		bx(g, 'metal', -W2, 0.8, -D2, W2, 1.0, -D2 + 0.06, STEEL);
		bx(g, 'metal', -W2, 0.8, D2 - 0.04, W2, 0.95, D2, STEEL);
		for (let x = -W2 + 0.35; x < W2 - 0.2; x += 0.6) { g.cyl('metal', x, 1.0, -D2 + 0.04, 0.015, 0.35, STEEL, 6); bx(g, 'metal', x - 0.015, 1.32, -D2 + 0.04, x + 0.015, 1.35, -D2 + 0.25, STEEL); }
		bx(g, 'subway', -W2, 1.0, -D2, W2, 1.9, -D2 + 0.01, WHITE);
	},
	instrumentTable(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		legs(g, it.w, it.d, 0.88, STEEL, 0.015, 0.04);
		bx(g, 'metal', -W2, 0.88, -D2, W2, 0.9, D2, STEEL);
		bx(g, 'fabric', -W2 + 0.04, 0.9, -D2 + 0.04, W2 - 0.04, 0.905, D2 - 0.04, lin([0.2, 0.42, 0.45]));
		for (let x = -W2 + 0.12; x < W2 - 0.1; x += 0.08) bx(g, 'metal', x, 0.905, -0.12, x + 0.012, 0.915, 0.12, STEEL);
	},
	pharmacyShelf(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h;
		bx(g, 'gloss', -W2, 0, -D2, W2, h, -D2 + 0.03, WHITE);
		for (const sx of [-1, 1]) bx(g, 'gloss', sx * W2 - 0.02, 0, -D2, sx * W2 + 0.02, h, D2, WHITE);
		for (let y = 0.1; y < h - 0.2; y += 0.34) {
			bx(g, 'gloss', -W2, y, -D2, W2, y + 0.02, D2, WHITE);
			for (let x = -W2 + 0.04; x < W2 - 0.08; x += 0.07 + rnd() * 0.05) { const w = 0.05 + rnd() * 0.04, hh = 0.1 + rnd() * 0.12; bx(g, 'matte', x, y + 0.02, -D2 + 0.06, x + w, y + 0.02 + hh, D2 - 0.05, rnd() < 0.6 ? WHITE : lin(pick([[0.3, 0.55, 0.8], [0.85, 0.35, 0.3], [0.4, 0.7, 0.45], [0.9, 0.75, 0.3]], rnd()))); }
		}
	},
	pharmacyCounter(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 1.0, D2, lin([0.5, 0.62, 0.66]));
		bx(g, 'stone', -W2 - 0.03, 1.0, -D2, W2 + 0.03, 1.04, D2 + 0.05, lin([0.88, 0.88, 0.86]));
		bx(g, 'glass', -W2, 1.04, D2 - 0.02, W2, 1.9, D2, WHITE);
		for (let x = -W2 + 0.6; x < W2 - 0.4; x += 1.4) { bx(g, 'metal', x - 0.25, 1.04, D2 - 0.03, x + 0.25, 1.12, D2 + 0.06, STEEL); screen(g, x, 1.06, -D2 + 0.2, 0.4, 0.28); }
	},
	medCabinet(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h;
		bx(g, 'gloss', -W2, 0, -D2, W2, h, D2 - 0.03, WHITE);
		bx(g, 'glass', -W2 + 0.03, 0.9, D2 - 0.03, W2 - 0.03, h - 0.05, D2, WHITE);
		for (let y = 1.0; y < h - 0.2; y += 0.3) for (let x = -W2 + 0.06; x < W2 - 0.1; x += 0.1) bx(g, 'matte', x, y, -0.05, x + 0.07, y + 0.08 + rnd() * 0.12, 0.08, rnd() < 0.5 ? WHITE : lin([0.4, 0.6, 0.85]));
		for (let y = 0.1; y < 0.85; y += 0.25) bx(g, 'metal', -0.1, y + 0.1, D2 - 0.03, 0.1, y + 0.12, D2 + 0.01, STEEL);
	},
	stretcher(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) caster(g, sx * (W2 - 0.06), sz * (D2 - 0.12));
		for (const sz of [-1, 1]) bx(g, 'metal', -0.04, 0.07, sz * (D2 - 0.12) - 0.02, 0.04, 0.72, sz * (D2 - 0.12) + 0.02, STEEL);
		bx(g, 'metal', -W2, 0.72, -D2, W2, 0.76, D2, STEEL);
		bx(g, 'fabric', -W2 + 0.03, 0.76, -D2 + 0.02, W2 - 0.03, 0.84, D2 - 0.02, lin([0.15, 0.2, 0.28]));
		bx(g, 'fabric', -W2 + 0.04, 0.84, -D2 + 0.05, W2 - 0.04, 0.86, D2 - 0.4, WHITE);
	},
	wheelchair(g) {
		for (const sx of [-1, 1]) { g.cyl('matte', sx * 0.3, 0.3, -0.1, 0.3, sx * 0.03, BLACK, 14, 'x'); caster(g, sx * 0.22, 0.3); }
		bx(g, 'fabric', -0.24, 0.48, -0.25, 0.24, 0.52, 0.2, BLACK);
		bx(g, 'fabric', -0.24, 0.52, -0.3, 0.24, 0.95, -0.26, BLACK);
		for (const sx of [-1, 1]) bx(g, 'metal', sx * 0.26 - 0.01, 0.2, -0.3, sx * 0.26 + 0.01, 0.98, -0.28, STEEL);
	},
	vending(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = pick([lin([0.15, 0.3, 0.55]), lin([0.55, 0.12, 0.1]), lin([0.15, 0.15, 0.17])], it.v);
		bx(g, 'gloss', -W2, 0, -D2, W2, it.h, D2, c);
		bx(g, 'glass', -W2 + 0.06, 0.6, D2, W2 - 0.25, it.h - 0.15, D2 + 0.01, WHITE);
		bx(g, 'bulb', -W2 + 0.08, 0.62, D2 - 0.02, W2 - 0.27, it.h - 0.17, D2 - 0.01, lin([0.9, 0.88, 0.8]));
		bx(g, 'matte', W2 - 0.2, 1.0, D2, W2 - 0.06, 1.3, D2 + 0.01, BLACK);
	},

	// ---------- the police station ----------
	frontDesk(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, face = lin([0.2, 0.26, 0.36]);
		bx(g, 'grain', -W2, 0, -D2, W2, 1.12, D2, face);
		bx(g, 'stone', -W2 - 0.03, 1.12, -D2, W2 + 0.03, 1.16, D2 + 0.06, lin([0.62, 0.6, 0.56]));
		// the glass partition up to the soffit, a speaking slot and a pass-through tray
		bx(g, 'glass', -W2, 1.16, D2 - 0.04, W2, 2.4, D2 - 0.01, WHITE);
		for (let x = -W2; x <= W2 + 0.01; x += it.w / Math.max(1, Math.round(it.w / 1.3))) bx(g, 'metal', x - 0.025, 1.16, D2 - 0.05, x + 0.025, 2.4, D2, DARKSTEEL);
		bx(g, 'metal', -W2, 2.4, D2 - 0.06, W2, 2.48, D2 + 0.01, DARKSTEEL);
		for (let x = -W2 + 0.7; x < W2 - 0.4; x += 1.3) { bx(g, 'metal', x - 0.2, 1.16, D2 - 0.06, x + 0.2, 1.2, D2 + 0.1, STEEL); screen(g, x, 1.18, -D2 + 0.25, 0.48, 0.32); }
		bx(g, 'bulb', -0.5, 0.8, D2 + 0.001, 0.5, 0.95, D2 + 0.004, lin([0.85, 0.8, 0.55]));
	},
	cellBars(g, it) {
		const W2 = it.w / 2, h = it.h || 2.6;
		bx(g, 'metal', -W2, 0, -0.04, W2, 0.08, 0.04, DARKSTEEL);
		bx(g, 'metal', -W2, h - 0.1, -0.05, W2, h, 0.05, DARKSTEEL);
		bx(g, 'metal', -W2, 1.1, -0.03, W2, 1.16, 0.03, DARKSTEEL);
		for (let x = -W2 + 0.06; x < W2; x += 0.13) g.cyl('metal', x, 0.08, 0, 0.016, h - 0.18, DARKSTEEL, 6);
		// the door's frame and its lock
		bx(g, 'metal', W2 - 1.0, 0.08, -0.05, W2 - 0.94, h - 0.1, 0.05, DARKSTEEL);
		bx(g, 'metal', W2 - 0.96, 1.0, 0.03, W2 - 0.84, 1.25, 0.09, BLACK);
	},
	cellFit(g, it) {
		// inside one cell, against its back wall: the steel bunk, the steel toilet and basin
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0.42, -D2, -W2 + 0.75, 0.48, D2 - 0.4, STEEL);
		for (const z of [-D2 + 0.1, D2 - 0.5]) bx(g, 'metal', -W2 + 0.02, 0, z, -W2 + 0.72, 0.42, z + 0.05, STEEL);
		bx(g, 'fabric', -W2 + 0.04, 0.48, -D2 + 0.05, -W2 + 0.72, 0.55, D2 - 0.45, lin([0.3, 0.32, 0.36]));
		bx(g, 'metal', W2 - 0.55, 0, -D2, W2 - 0.05, 0.45, -D2 + 0.55, STEEL);
		bx(g, 'metal', W2 - 0.55, 0.45, -D2, W2 - 0.05, 0.95, -D2 + 0.22, STEEL);
	},
	evidenceShelf(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h;
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 'metal', sx * W2 - 0.02, 0, sz * D2 - 0.02, sx * W2 + 0.02, h, sz * D2 + 0.02, STEEL);
		for (let y = 0.15; y < h - 0.1; y += 0.48) {
			bx(g, 'metal', -W2, y, -D2, W2, y + 0.025, D2, STEEL);
			for (let x = -W2 + 0.05; x < W2 - 0.3; x += 0.36 + rnd() * 0.1) {
				if (rnd() < 0.55) bx(g, 'matte', x, y + 0.025, -D2 + 0.05, x + 0.3, y + 0.025 + 0.22 + rnd() * 0.1, D2 - 0.05, lin(rnd() < 0.5 ? [0.66, 0.52, 0.34] : [0.75, 0.73, 0.68]));
				else { bx(g, 'gloss', x, y + 0.025, -D2 + 0.05, x + 0.34, y + 0.2, D2 - 0.05, lin([0.2, 0.32, 0.55])); bx(g, 'matte', x + 0.08, y + 0.12, D2 - 0.05, x + 0.26, y + 0.16, D2 - 0.04, WHITE); }
			}
		}
	},
	lockers(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h || 1.9, n = Math.max(1, Math.round(it.w / 0.4)), c = pick([lin([0.3, 0.38, 0.5]), lin([0.45, 0.47, 0.5]), lin([0.36, 0.42, 0.32]), lin([0.55, 0.18, 0.15])], it.v);
		bx(g, 'gloss', -W2, 0, -D2, W2, 0.1, D2, BLACK);
		for (let i = 0; i < n; i++) {
			const x0 = -W2 + i * it.w / n, x1 = x0 + it.w / n - 0.01;
			bx(g, 'gloss', x0, 0.1, -D2, x1, h, D2, c);
			for (let y = h - 0.35; y < h - 0.15; y += 0.04) bx(g, 'matte', x0 + 0.08, y, D2, x1 - 0.08, y + 0.015, D2 + 0.005, BLACK);
			bx(g, 'metal', x1 - 0.08, 1.0, D2, x1 - 0.05, 1.18, D2 + 0.02, STEEL);
			if (rnd() < 0.2) bx(g, 'matte', x0 + 0.06, 1.25, D2 + 0.003, x1 - 0.06, 1.4, D2 + 0.006, WHITE);
		}
	},
	gunRack(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h || 1.8;
		bx(g, 'metal', -W2, 0, -D2, W2, 0.12, D2, DARKSTEEL);
		bx(g, 'metal', -W2, 0, -D2, W2, h, -D2 + 0.03, DARKSTEEL);
		for (let x = -W2 + 0.15; x < W2 - 0.1; x += 0.18) {
			bx(g, 'matte', x - 0.025, 0.12, -D2 + 0.08, x + 0.025, 1.0, -D2 + 0.16, BLACK);
			bx(g, 'matte', x - 0.018, 1.0, -D2 + 0.09, x + 0.018, 1.45, -D2 + 0.12, DARKSTEEL);
		}
		bx(g, 'metal', -W2, 0.9, D2 - 0.03, W2, 0.95, D2, STEEL);
		// the wire mesh door over them, locked
		for (let x = -W2; x <= W2 + 0.01; x += 0.1) bx(g, 'metal', x - 0.006, 0.12, D2 - 0.02, x + 0.006, h, D2 - 0.01, STEEL);
		bx(g, 'metal', W2 - 0.12, 0.95, D2, W2 - 0.04, 1.08, D2 + 0.04, BLACK);
	},
	whiteboard(g, it) {
		const W2 = it.w / 2;
		bx(g, 'metal', -W2 - 0.03, 0.9, -0.01, W2 + 0.03, 2.1, 0.02, STEEL);
		bx(g, 'gloss', -W2, 0.93, 0.02, W2, 2.07, 0.025, WHITE);
		for (let i = 0; i < 6; i++) bx(g, 'matte', -W2 + 0.2 + (i % 3) * W2 * 0.6, 1.8 - Math.floor(i / 3) * 0.4, 0.026, -W2 + 0.2 + (i % 3) * W2 * 0.6 + 0.4 + (i * 0.07) % 0.3, 1.81 - Math.floor(i / 3) * 0.4, 0.028, lin(i % 2 ? [0.15, 0.25, 0.7] : [0.7, 0.15, 0.12]));
		bx(g, 'metal', -W2, 0.88, 0.02, W2, 0.92, 0.09, STEEL);
	},
	filingCabinet(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h || 1.3, n = Math.max(2, Math.round(h / 0.33)), c = pick([lin([0.5, 0.52, 0.5]), lin([0.36, 0.38, 0.42]), lin([0.72, 0.7, 0.64])], it.v);
		bx(g, 'gloss', -W2, 0, -D2, W2, h, D2, c);
		for (let i = 0; i < n; i++) { const y = 0.04 + i * h / n; bx(g, 'matte', -W2 + 0.03, y + h / n - 0.02, D2, W2 - 0.03, y + h / n - 0.01, D2 + 0.004, BLACK); bx(g, 'metal', -0.08, y + h / n * 0.6, D2, 0.08, y + h / n * 0.6 + 0.03, D2 + 0.025, STEEL); }
	},
	waterCooler(g) {
		bx(g, 'gloss', -0.16, 0, -0.16, 0.16, 1.0, 0.16, WHITE);
		g.cyl('glass', 0, 1.0, 0, 0.13, 0.42, lin([0.6, 0.8, 0.95]), 12);
		bx(g, 'metal', -0.05, 0.85, 0.16, 0.05, 0.9, 0.2, STEEL);
	},
	lightBar(g, it) {
		const W2 = it.w / 2;
		bx(g, 'matte', -W2, 0, -0.12, W2, 0.05, 0.12, BLACK);
		bx(g, 'bulb', -W2 + 0.02, 0.05, -0.1, -0.02, 0.13, 0.1, lin([1, 0.15, 0.1]));
		bx(g, 'bulb', 0.02, 0.05, -0.1, W2 - 0.02, 0.13, 0.1, lin([0.2, 0.35, 1]));
	},

	cellWall(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'matte', -W2, 0, -D2, W2, it.h || 2.6, D2, lin([0.66, 0.67, 0.66]));
	},

	// ---------- the fire station ----------
	laneLines(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (const sx of [-1, 1]) bx(g, 'gloss', sx * W2 - 0.06, 0.003, -D2, sx * W2 + 0.06, 0.008, D2, YELLOW);
		bx(g, 'gloss', -W2, 0.003, -D2, W2, 0.008, -D2 + 0.12, YELLOW);
	},
	gearRack(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, n = Math.max(1, Math.round(it.w / 0.75));
		bx(g, 'metal', -W2, 0, -D2, W2, 0.06, D2, DARKSTEEL);
		bx(g, 'metal', -W2, 1.85, -D2, W2, 1.9, D2, DARKSTEEL);
		for (let i = 0; i <= n; i++) bx(g, 'metal', -W2 + i * it.w / n - 0.02, 0, -D2, -W2 + i * it.w / n + 0.02, 1.9, -D2 + 0.04, DARKSTEEL);
		for (let i = 0; i < n; i++) {
			const x = -W2 + (i + 0.5) * it.w / n, c = rnd() < 0.8 ? TAN : lin([0.15, 0.15, 0.16]);
			// the coat on its hook, its reflective bands; the trousers folded down over the boots
			bx(g, 'fabric', x - 0.26, 0.95, -D2 + 0.06, x + 0.26, 1.7, -D2 + 0.3, c);
			for (const y of [1.08, 1.4]) bx(g, 'gloss', x - 0.265, y, -D2 + 0.055, x + 0.265, y + 0.05, -D2 + 0.305, lin([0.85, 0.9, 0.5]));
			bx(g, 'fabric', x - 0.22, 0.3, -D2 + 0.08, x + 0.22, 0.75, -D2 + 0.32, c);
			for (const sx of [-1, 1]) bx(g, 'matte', x + sx * 0.11 - 0.07, 0.06, -D2 + 0.12, x + sx * 0.11 + 0.07, 0.34, -D2 + 0.36, BLACK);
			// the helmet on the shelf
			g.sphere('gloss', x, 1.98, -D2 + 0.2, 0.15, 0.1, 0.18, rnd() < 0.7 ? YELLOW : rnd() < 0.5 ? lin([0.1, 0.1, 0.1]) : lin([0.85, 0.1, 0.08]), 10);
		}
	},
	firePole(g, it) {
		const top = it.h || 8;
		g.cyl('metal', 0, 0, 0, 0.6, 0.06, lin([0.2, 0.2, 0.22]), 14);
		g.cyl('metal', 0, 0.06, 0, 0.032, top - 0.06, lin([0.85, 0.68, 0.32]), 10);
		g.cyl('metal', 0, top - 0.12, 0, 0.09, 0.12, DARKSTEEL, 10);
	},
	hoseRack(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'metal', -W2, 0, -D2, W2, 1.8, -D2 + 0.04, DARKSTEEL);
		for (let i = 0; i < 6; i++) { const x = -W2 + 0.28 + (i % 3) * (it.w - 0.56) / 2, y = 0.45 + Math.floor(i / 3) * 0.75; g.cyl('fabric', x, y, -D2 + 0.04, 0.26, 0.16, i % 2 ? RED : YELLOW, 14, 'z'); g.cyl('metal', x, y, -D2 + 0.2, 0.06, 0.02, STEEL, 8, 'z'); }
	},
	toolWall(g, it) {
		const W2 = it.w / 2;
		bx(g, 'grain', -W2, 0.6, -0.01, W2, 2.3, 0.02, lin([0.6, 0.5, 0.36]));
		// axes, pry bars, pike poles and a saw, on their pegs
		for (let i = 0; i < 6; i++) {
			const x = -W2 + 0.25 + i * (it.w - 0.5) / 5;
			if (i % 3 === 0) { bx(g, 'grain', x - 0.02, 0.8, 0.02, x + 0.02, 1.7, 0.05, WOODC); bx(g, 'metal', x - 0.12, 1.62, 0.02, x + 0.05, 1.78, 0.05, RED); }
			else if (i % 3 === 1) bx(g, 'metal', x - 0.015, 0.7, 0.02, x + 0.015, 2.2, 0.05, YELLOW);
			else { bx(g, 'metal', x - 0.18, 1.2, 0.02, x + 0.18, 1.45, 0.12, lin([0.8, 0.35, 0.1])); bx(g, 'metal', x - 0.3, 1.25, 0.05, x - 0.18, 1.4, 0.1, STEEL); }
		}
	},
	bunkBed(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = pick([DARKSTEEL, OLIVE, lin([0.35, 0.38, 0.45])], it.v);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 'metal', sx * W2 - 0.025, 0, sz * D2 - 0.025, sx * W2 + 0.025, 1.75, sz * D2 + 0.025, c);
		for (const y of [0.3, 1.25]) {
			bx(g, 'metal', -W2, y, -D2, W2, y + 0.06, D2, c);
			bx(g, 'fabric', -W2 + 0.03, y + 0.06, -D2 + 0.03, W2 - 0.03, y + 0.2, D2 - 0.03, lin([0.82, 0.8, 0.74]));
			bx(g, 'fabric', -W2 + 0.02, y + 0.2, -0.2, W2 - 0.02, y + 0.24, D2 - 0.03, pick([OLIVE, BLUE, lin([0.45, 0.44, 0.4])], it.v * 3 + y));
			bx(g, 'fabric', -0.3, y + 0.2, -D2 + 0.06, 0.3, y + 0.3, -D2 + 0.36, WHITE);
		}
		for (let y = 0.5; y < 1.25; y += 0.25) bx(g, 'metal', W2 - 0.02, y, D2 - 0.03, W2 + 0.02, y + 0.03, D2 + 0.03, c);
	},
	footLocker(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'gloss', -W2, 0, -D2, W2, it.h || 0.42, D2, pick([OLIVE, DRAB, lin([0.25, 0.3, 0.42])], it.v));
		bx(g, 'metal', -0.06, 0.3, D2, 0.06, 0.36, D2 + 0.02, STEEL);
	},
	weightBench(g) {
		bx(g, 'fabric', -0.15, 0.42, -0.6, 0.15, 0.5, 0.55, BLACK);
		bx(g, 'metal', -0.05, 0, -0.5, 0.05, 0.42, 0.45, DARKSTEEL);
		for (const sx of [-1, 1]) bx(g, 'metal', sx * 0.55 - 0.03, 0, -0.62, sx * 0.55 + 0.03, 1.25, -0.56, DARKSTEEL);
		g.cyl('metal', -0.85, 1.1, -0.6, 0.015, 1.7, STEEL, 6, 'x');
		for (const sx of [-1, 1]) g.cyl('matte', sx * 0.7, 1.1, -0.6, 0.22, sx * 0.05, BLACK, 14, 'x');
	},
	treadmill(g) {
		bx(g, 'matte', -0.38, 0, -0.9, 0.38, 0.18, 0.75, BLACK);
		bx(g, 'matte', -0.3, 0.18, -0.85, 0.3, 0.2, 0.6, lin([0.12, 0.12, 0.12]));
		for (const sx of [-1, 1]) bx(g, 'metal', sx * 0.36 - 0.025, 0.18, 0.62, sx * 0.36 + 0.025, 1.3, 0.68, DARKSTEEL);
		bx(g, 'gloss', -0.36, 1.2, 0.6, 0.36, 1.42, 0.78, BLACK);
		bx(g, 'bulb', -0.2, 1.28, 0.59, 0.2, 1.38, 0.6, lin([0.2, 0.6, 1]));
	},
	dumbbellRack(g, it) {
		const W2 = it.w / 2;
		for (const sx of [-1, 1]) bx(g, 'metal', sx * W2 - 0.04, 0, -0.2, sx * W2 + 0.04, 0.8, 0.2, DARKSTEEL);
		for (const y of [0.4, 0.75]) { bx(g, 'metal', -W2, y, -0.2, W2, y + 0.04, 0.2, DARKSTEEL); for (let x = -W2 + 0.12; x < W2 - 0.1; x += 0.2) for (const z of [-0.08, 0.08]) g.cyl('matte', x, y + 0.1, z - 0.07, 0.06 + (x + W2) * 0.02, 0.14, BLACK, 8, 'z'); }
	},
	showerStall(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		for (const sx of [-1, 1]) bx(g, 'subway', sx * W2 - 0.03, 0, -D2, sx * W2 + 0.03, 2.05, D2, WHITE);
		bx(g, 'subway', -W2, 0, -D2, W2, 2.05, -D2 + 0.03, WHITE);
		bx(g, 'tile', -W2, 0, -D2, W2, 0.03, D2, lin([0.75, 0.77, 0.78]));
		g.cyl('metal', 0, 1.9, -D2 + 0.12, 0.08, 0.03, STEEL, 10);
		bx(g, 'metal', -0.02, 1.9, -D2, 0.02, 1.95, -D2 + 0.12, STEEL);
		bx(g, 'fabric', -W2, 0.25, D2 - 0.02, W2 * 0.2, 2.0, D2, lin([0.82, 0.85, 0.86]));
	},

	// ---------- the armory: the war room, the comms, the depot, the barracks ----------
	mapTable(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, wd = lin([0.32, 0.24, 0.16]);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 'grain', sx * (W2 - 0.18) - 0.08, 0, sz * (D2 - 0.18) - 0.08, sx * (W2 - 0.18) + 0.08, 0.88, sz * (D2 - 0.18) + 0.08, wd);
		bx(g, 'grain', -W2 + 0.1, 0.18, -D2 + 0.1, W2 - 0.1, 0.24, D2 - 0.1, wd);
		bx(g, 'grain', -W2, 0.88, -D2, W2, 0.94, D2, wd);
		// its raised rim; the map itself is laid on the top as it changes (services/screens.js)
		for (const sz of [-1, 1]) bx(g, 'grain', -W2, 0.94, sz > 0 ? D2 - 0.05 : -D2, W2, 0.98, sz > 0 ? D2 : -D2 + 0.05, wd);
		for (const sx of [-1, 1]) bx(g, 'grain', sx > 0 ? W2 - 0.05 : -W2, 0.94, -D2, sx > 0 ? W2 : -W2 + 0.05, 0.98, D2, wd);
		bx(g, 'matte', -W2 + 0.05, 0.94, -D2 + 0.05, W2 - 0.05, 0.945, D2 - 0.05, lin([0.08, 0.12, 0.12]));
	},
	wallScreen(g, it) {
		const W2 = it.w / 2, y0 = it.y0 ?? 1.15, h = it.sh ?? 1.25;
		bx(g, 'gloss', -W2 - 0.04, y0 - 0.04, -0.01, W2 + 0.04, y0 + h + 0.04, 0.06, BLACK);
		bx(g, 'bulb', -W2, y0, 0.061, W2, y0 + h, 0.064, lin([0.04, 0.08, 0.1]));
		bx(g, 'metal', -0.1, y0 - 0.2, -0.01, 0.1, y0 - 0.04, 0.03, DARKSTEEL);
	},
	commsDesk(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0.72, -D2, W2, 0.76, D2, lin([0.3, 0.32, 0.33]));
		for (const sx of [-1, 1]) bx(g, 'metal', sx * W2 - 0.04, 0, -D2, sx * W2, 0.72, D2, DARKSTEEL);
		bx(g, 'metal', -W2, 0.2, -D2 + 0.02, W2, 0.72, -D2 + 0.06, DARKSTEEL);
		// the radios stacked at the back of the desk, their faces lit, the handsets, a headset
		for (let x = -W2 + 0.3; x < W2 - 0.25; x += 0.55) {
			for (let k = 0; k < 2; k++) {
				const y = 0.76 + k * 0.17;
				bx(g, 'gloss', x - 0.24, y, -D2 + 0.08, x + 0.24, y + 0.15, -D2 + 0.36, OLIVE);
				bx(g, 'bulb', x - 0.18, y + 0.05, -D2 + 0.361, x - 0.02, y + 0.1, -D2 + 0.364, rnd() < 0.5 ? GREENLED : AMBERLED);
				for (let j = 0; j < 3; j++) g.cyl('matte', x + 0.04 + j * 0.06, y + 0.075, -D2 + 0.36, 0.018, 0.02, BLACK, 6, 'z');
			}
			bx(g, 'matte', x - 0.05, 0.76, -D2 + 0.42, x + 0.05, 0.8, -D2 + 0.6, BLACK);
		}
		screen(g, -W2 * 0.45, 0.78, -D2 + 0.65, 0.5, 0.32, lin([0.25, 0.7, 0.5]));
		screen(g, W2 * 0.45, 0.78, -D2 + 0.65, 0.5, 0.32, lin([0.3, 0.5, 0.85]));
		g.cyl('matte', 0, 0.82, 0.05, 0.09, 0.03, BLACK, 10, 'x');
	},
	radioRack(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2, h = it.h || 2;
		bx(g, 'gloss', -W2, 0, -D2, W2, h, D2 - 0.02, BLACK);
		for (let y = 0.15; y < h - 0.2; y += 0.18) {
			bx(g, 'metal', -W2 + 0.04, y, D2 - 0.02, W2 - 0.04, y + 0.15, D2, rnd() < 0.5 ? DARKSTEEL : lin([0.2, 0.21, 0.22]));
			for (let j = 0; j < 4; j++) if (rnd() < 0.7) bx(g, 'bulb', -W2 + 0.08 + j * 0.05, y + 0.06, D2, -W2 + 0.1 + j * 0.05, y + 0.08, D2 + 0.004, [GREENLED, AMBERLED, REDLED][Math.floor(rnd() * 3)]);
		}
	},
	briefingChair(g, it) {
		const c = pick([BLACK, lin([0.25, 0.28, 0.24]), lin([0.22, 0.25, 0.32])], it.v);
		legs(g, 0.46, 0.46, 0.44, DARKSTEEL, 0.012, 0.03);
		bx(g, 'fabric', -0.23, 0.44, -0.23, 0.23, 0.5, 0.22, c);
		bx(g, 'fabric', -0.22, 0.52, -0.28, 0.22, 0.88, -0.23, c);
		bx(g, 'grain', 0.16, 0.66, -0.05, 0.4, 0.68, 0.3, lin([0.6, 0.5, 0.36]));
	},
	podium(g) {
		bx(g, 'grain', -0.3, 0, -0.22, 0.3, 1.1, 0.22, lin([0.3, 0.22, 0.15]));
		g.beam('grain', [-0.32, 1.12, -0.25], [-0.32, 1.2, 0.18], 0.04, 0.04, lin([0.3, 0.22, 0.15]));
		bx(g, 'grain', -0.34, 1.1, -0.26, 0.34, 1.16, 0.24, lin([0.3, 0.22, 0.15]));
		g.cyl('metal', 0.18, 1.16, 0.1, 0.008, 0.28, BLACK, 6);
	},
	ammoCrates(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.13, D2, lin([0.52, 0.42, 0.28]));
		let y = 0.13;
		for (let row = 0; y < it.h - 0.1 && row < 6; row++) {
			const n = row % 2 ? 2 : 3;
			for (let i = 0; i < n; i++) {
				const x0 = -W2 + 0.03 + i * (it.w - 0.06) / n, x1 = x0 + (it.w - 0.06) / n - 0.03;
				bx(g, 'gloss', x0, y, -D2 + 0.04, x1, y + 0.28, D2 - 0.04, rnd() < 0.85 ? OLIVE : DRAB);
				bx(g, 'metal', (x0 + x1) / 2 - 0.08, y + 0.28, -0.03, (x0 + x1) / 2 + 0.08, y + 0.3, 0.03, BLACK);
				bx(g, 'matte', x0 + 0.04, y + 0.1, D2 - 0.04, x1 - 0.04, y + 0.16, D2 - 0.035, YELLOW);
			}
			y += 0.3;
		}
	},
	weaponRack(g, it) {
		const W2 = it.w / 2;
		for (const sx of [-1, 1]) g.beam('metal', [sx * W2, 0, -0.3], [sx * W2, 1.7, 0], 0.06, 0.06, DARKSTEEL);
		for (const sx of [-1, 1]) g.beam('metal', [sx * W2, 0, 0.3], [sx * W2, 1.7, 0], 0.06, 0.06, DARKSTEEL);
		bx(g, 'metal', -W2, 1.65, -0.04, W2, 1.72, 0.04, DARKSTEEL);
		bx(g, 'grain', -W2, 0.12, -0.32, W2, 0.18, 0.32, lin([0.4, 0.32, 0.22]));
		for (let x = -W2 + 0.15; x < W2 - 0.1; x += 0.2) for (const sz of [-1, 1]) {
			g.beam('matte', [x, 0.18, sz * 0.25], [x, 1.55, sz * 0.05], 0.05, 0.07, BLACK);
			g.beam('matte', [x, 0.9, sz * 0.15], [x, 1.1, sz * 0.12], 0.045, 0.16, DARKSTEEL);
		}
	},
	supplyCrates(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.14, D2, lin([0.55, 0.44, 0.3]));
		let y = 0.14;
		while (y < it.h - 0.2) {
			const hh = 0.5 + rnd() * 0.25, c = rnd() < 0.5 ? lin([0.6, 0.48, 0.3]) : OLIVE;
			bx(g, 'grain', -W2 + 0.04, y, -D2 + 0.04, W2 - 0.04, y + hh, D2 - 0.04, c);
			for (const t of [0.15, 0.85]) bx(g, 'grain', -W2 + 0.03, y + hh * t - 0.03, -D2 + 0.03, W2 - 0.03, y + hh * t + 0.03, D2 - 0.03, lin([0.42, 0.33, 0.22]));
			bx(g, 'matte', -0.25, y + hh * 0.4, D2 - 0.04, 0.25, y + hh * 0.6, D2 - 0.035, lin([0.9, 0.88, 0.8]));
			y += hh + 0.01;
		}
	},
	fuelDrums(g, it, rnd) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, -D2, W2, 0.13, D2, lin([0.55, 0.44, 0.3]));
		const c = pick([lin([0.6, 0.1, 0.08]), lin([0.15, 0.3, 0.6]), OLIVE, lin([0.75, 0.6, 0.12])], it.v);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
			const x = sx * W2 * 0.5, z = sz * D2 * 0.5;
			g.cyl('gloss', x, 0.13, z, 0.28, 0.86, rnd() < 0.15 ? DRAB : c, 14);
			for (const y of [0.4, 0.7]) g.cyl('metal', x, 0.13 + y, z, 0.285, 0.025, c.map((v) => v * 0.8), 14);
			g.cyl('metal', x + 0.15, 0.99, z, 0.03, 0.02, DARKSTEEL, 6);
		}
	},
	medCrates(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		let y = 0;
		for (let k = 0; k < Math.max(1, Math.round((it.h || 0.9) / 0.42)); k++) {
			bx(g, 'gloss', -W2, y, -D2, W2, y + 0.4, D2, WHITE);
			bx(g, 'gloss', -W2 - 0.002, y + 0.14, -D2 - 0.002, W2 + 0.002, y + 0.24, D2 + 0.002, lin([0.15, 0.55, 0.32]));
			bx(g, 'metal', -0.08, y + 0.4, -0.03, 0.08, y + 0.42, 0.03, STEEL);
			y += 0.42;
		}
	},
	guardDesk(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2;
		bx(g, 'grain', -W2, 0, D2 - 0.3, W2, 1.1, D2, DRAB);
		bx(g, 'grain', -W2, 0.72, -D2, W2, 0.76, D2 - 0.3, lin([0.4, 0.38, 0.3]));
		bx(g, 'stone', -W2 - 0.03, 1.1, D2 - 0.35, W2 + 0.03, 1.14, D2 + 0.05, lin([0.5, 0.5, 0.48]));
		screen(g, -W2 * 0.4, 0.78, -D2 + 0.25, 0.45, 0.3, lin([0.3, 0.6, 0.5]));
		screen(g, W2 * 0.4, 0.78, -D2 + 0.25, 0.45, 0.3, lin([0.25, 0.35, 0.5]));
	},
};

// the things you walk through: hanging lights and curtains
addKit(KIT, ['surgicalLight', 'curtain', 'laneLines']);
for (const t of ['surgicalLight', 'curtain', 'wallScreen', 'whiteboard', 'toolWall', 'laneLines', 'lightBar']) FLAT.add(t);
export const SERVICE_KIT = Object.keys(KIT);
