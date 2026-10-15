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

const pick = (l, v) => l[Math.floor(v * 9973) % l.length];
const BRIGHT = [[0.8, 0.25, 0.2], [0.9, 0.7, 0.2], [0.25, 0.5, 0.7], [0.35, 0.6, 0.3], [0.85, 0.5, 0.6], [0.95, 0.9, 0.8], [0.55, 0.35, 0.6]];
const WOODS = [[0.36, 0.22, 0.14], [0.22, 0.14, 0.1], [0.5, 0.34, 0.2], [0.3, 0.2, 0.15]];
const STEEL = lin([0.72, 0.73, 0.75]), DARK = lin([0.06, 0.06, 0.065]), WHITE = lin([0.92, 0.91, 0.88]), BRASS = lin([0.78, 0.62, 0.3]);
const LEATHER = [[0.45, 0.12, 0.1], [0.12, 0.25, 0.2], [0.2, 0.15, 0.12], [0.55, 0.45, 0.2]];
const bx = (g, k, x0, y0, z0, x1, y1, z1, c) => g.box(k, x0, y0, z0, x1, y1, z1, c);

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
	// a rail of clothes on two posts, the garments in colours
	clothesRack(g, it, rnd) {
		const W2 = it.w / 2;
		for (const x of [-W2, W2]) { g.cyl('metal', x, 0, 0, 0.02, 1.55, STEEL, 6); bx(g, 'metal', x - 0.25, 0, -0.02, x + 0.25, 0.03, 0.02, STEEL); }
		bx(g, 'metal', -W2, 1.52, -0.015, W2, 1.55, 0.015, STEEL);
		for (let x = -W2 + 0.08; x < W2 - 0.05; x += 0.07 + rnd() * 0.05) bx(g, 'fabric', x, 0.6 + rnd() * 0.35, -0.22, x + 0.035, 1.5, 0.22, lin(pick(BRIGHT, rnd())));
	},
	mannequin(g, it) {
		const c = lin([0.88, 0.86, 0.82]), cl = lin(pick(BRIGHT, it.v));
		bx(g, 'metal', -0.2, 0, -0.2, 0.2, 0.03, 0.2, DARK); g.cyl('metal', 0, 0.03, 0, 0.02, 0.95, STEEL, 6);
		g.sphere('fabric', 0, 1.25, 0, 0.19, 0.3, 0.12, cl, 10); g.sphere('fabric', 0, 0.98, 0, 0.17, 0.08, 0.11, cl, 10);
		g.cyl('gloss', 0, 1.52, 0, 0.05, 0.1, c, 6); g.sphere('gloss', 0, 1.72, 0, 0.1, 0.12, 0.1, c, 10);
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
		for (let k = 0; k < 4; k++) g.cyl('gloss', -W2 + 0.15 + k * 0.12, 0.84, 0, 0.03, 0.12 + rnd() * 0.1, lin(pick(BRIGHT, rnd())), 6);
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
		for (const y of [1.15, 1.6]) {
			bx(g, 'glass', -W2 + 0.05, y, -D2 + 0.02, W2 - 0.05, y + 0.02, -D2 + 0.25, WHITE);
			for (let x = -W2 + 0.12; x < W2 - 0.1; x += 0.09 + rnd() * 0.05) g.cyl('gloss', x, y + 0.02, -D2 + 0.12, 0.035, 0.24 + rnd() * 0.1, lin(pick([[0.35, 0.2, 0.08], [0.15, 0.3, 0.15], [0.85, 0.85, 0.8], [0.6, 0.3, 0.1], [0.2, 0.25, 0.5]], rnd())), 6);
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

