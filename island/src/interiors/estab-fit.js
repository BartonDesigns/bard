// The insides of the businesses, by what they are (economy/frontage.js fit): a café's counter
// with the espresso machine and the pastry case, its little tables, the kitchen behind; a
// restaurant's tables and booths, the host's stand by the door, the pass at the back with
// the kitchen through it (the ranges, the prep tables, the fryer); a pub's bar with its
// stools, the back bar's bottles; a bookshop's cases; a hardware store's gondolas; an
// outfitter's wall of rods and its canoe; a salon's chairs at their mirrors and the basin at
// the back; a garage's lift with a car up on it, the tool chests and the tyres; a guest
// house's front desk with the keys behind it, the breakfast room, the luggage racks upstairs.
//
// The same fit-outs serve the three kinds of building that are built inside: the flats over
// shops and the halls (interiors/plan.js and furnish.js), and the houses that became
// businesses (bay/houseplan.js, which re-types their ground floor). Each is handed the room
// and its helpers (K: against, standing, inFront, stand, sitOn, chairs, light, rnd...).
// Nothing here touches lighting or materials: where a lamp would hang it leaves an anchor
// (K.anchor: a pendant over the counter or a table, a heat lamp over the pass, track over
// the shelves, a sconce by a mirror), for whoever lights the rooms to use.
//
// The drawings of the new things (booths, the pass, ranges, the front desk, racks, salon
// chairs, the car lift...) are added to the interiors' kit (kit.js addKit), each in its own
// frame like the rest: width along x, depth along z, its front toward +z, standing on y = 0.

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
	washBasin(g, it) {
		bx(g, 'gloss', -0.3, 0, -0.3, 0.3, 0.85, 0.05, lin([0.15, 0.15, 0.16]));
		g.sphere('gloss', 0, 0.85, -0.12, 0.24, 0.1, 0.2, WHITE, 12);
		bx(g, 'fabric', -0.26, 0.42, 0.1, 0.26, 0.54, 0.6, lin([0.12, 0.12, 0.13])); bx(g, 'fabric', -0.26, 0.54, 0.0, 0.26, 0.85, 0.1, lin([0.12, 0.12, 0.13]));
	},
	// a garage's lift: two posts, the arms under a car (the car itself is drawn as the cars are)
	carLift(g, it) {
		const W2 = it.w / 2, y = []; void y;
		for (const s of [-1, 1]) { bx(g, 'metal', s * W2 - 0.18, 0, -0.18, s * W2 + 0.18, 2.6, 0.18, lin([0.75, 0.6, 0.1])); bx(g, 'metal', s * W2 - 0.28, 0, -0.28, s * W2 + 0.28, 0.06, 0.28, DARK); }
		for (const s of [-1, 1]) for (const z of [-0.9, 0.9]) bx(g, 'metal', s * W2 - s * 1.05, it.lift - 0.08, z - 0.06, s * W2, it.lift, z + 0.06, DARK);
	},
	toolChest(g, it) {
		const W2 = it.w / 2, D2 = it.d / 2, c = lin(it.v < 0.5 ? [0.7, 0.1, 0.08] : [0.1, 0.2, 0.45]);
		bx(g, 'gloss', -W2, 0.08, -D2, W2, 1.0, D2, c);
		for (let y = 0.2; y < 0.95; y += 0.12) bx(g, 'metal', -W2 + 0.05, y, D2, W2 - 0.05, y + 0.015, D2 + 0.015, STEEL);
		for (const sx of [-1, 1]) g.cyl('matte', sx * (W2 - 0.08), 0, D2 - 0.08, 0.05, 0.08, DARK, 8);
	},
	tyres(g, it) { for (let k = 0; k < 4; k++) g.cyl('matte', 0, k * 0.22, 0, 0.32, 0.21, lin([0.04, 0.04, 0.045]), 14); },
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
	dentalChair(g, it) {
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
	treadmill(g, it) {
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

// ---------- the fit-outs ----------
// what the back room of each is (a kitchen behind a café or a restaurant, a bakehouse, the
// stockroom, a workshop), and what each room of a house becomes in a house that is a business
export const BACK = { cafe: 'kitchen', bakery: 'bakehouse', counter: 'kitchen', restaurant: 'kitchen', pizzeria: 'kitchen', diner: 'kitchen', sushi: 'kitchen', pub: 'kitchen', tasting: 'stock', garage: 'workshop', workshop: 'workshop', repair: 'workshop', bike: 'workshop', tailor: 'workshop', bnb: null, reception: 'office', fishmarket: 'stock', butcher: 'kitchen' };
const FOOD = new Set(['cafe', 'bakery', 'counter', 'restaurant', 'pizzeria', 'diner', 'sushi', 'pub', 'tasting']);
// a house's ground floor, re-typed: the room by the front door is the business's front; the
// dining room and family room more of it (or a breakfast room, a waiting room); the kitchen
// its kitchen or stockroom; a den its office; the garage its workshop or store
export function houseRoles(fit, roomType) {
	if (!fit) return null;
	if (roomType === 'living' || roomType === 'entry') return { fit, role: 'front' };
	if (roomType === 'dining') return fit === 'bnb' ? { fit: 'breakfast', role: 'more' } : FOOD.has(fit) ? { fit, role: 'more' } : fit === 'clinic' || fit === 'dental' || fit === 'office' || fit === 'studio' ? { fit, role: 'more' } : { fit, role: 'more' };
	if (roomType === 'family') return fit === 'bnb' ? { fit: 'lounge', role: 'more' } : FOOD.has(fit) ? { fit, role: 'more' } : { fit: fit === 'clinic' || fit === 'dental' ? fit : 'stock', role: fit === 'clinic' || fit === 'dental' ? 'more' : 'back' };
	if (roomType === 'kitchen') return fit === 'bnb' ? null : { fit: BACK[fit] || 'stock', role: 'back' };
	if (roomType === 'den' || roomType === 'office') return fit === 'bnb' ? null : { fit: 'office', role: 'back' };
	if (roomType === 'garage') return { fit: fit === 'garage' || fit === 'workshop' || fit === 'bike' ? 'workshop' : 'stock', role: 'back', garage: fit === 'garage' };
	return null;
}

// (helpers over K's own: an item's extra fields after it is placed, wherever it was placed)
function helpers(K) {
	const ag = (type, w, d, h, opt = {}, extra = null) => { const it = K.against(type, w, d, h, opt); if (it && extra) Object.assign(it, extra); return it; };
	const st = (type, x, z, w, d, h, rot = 0, pad = 0, extra = null) => { const it = K.standing(type, x, z, w, d, h, rot, pad); if (it && extra) Object.assign(it, extra); return it; };
	const face = (rot) => [[0, 1], [1, 0], [0, -1], [-1, 0]][rot];
	// someone working behind a thing that stands against a wall (between it and the wall: no;
	// in front of it facing it, as at a range; or behind a counter, facing the room)
	const behind = (it, k = 0.55) => { if (!it) return; const [fx, fz] = face(it.rot); K.stand(it.x - fx * k, it.z - fz * k, fx, fz, true); };
	const atFront = (it, k = 0.6) => { if (!it) return; const [fx, fz] = face(it.rot); K.stand(it.x + fx * (it.d / 2 + k), it.z + fz * (it.d / 2 + k), -fx, -fz, true); };
	const lamp = (kind, x, z, drop = 0.6) => K.anchor(kind, x, K.y0 + K.ceil - drop, z);
	const front = K.sides.find((s) => s.axis === 'x' && s.n < 0 && s.ext) || K.sides.find((s) => s.axis === 'x' && s.n < 0);
	const backS = K.sides.find((s) => s.axis === 'x' && s.n > 0);
	const notFront = (s) => s !== front;
	return { ag, st, face, behind, atFront, lamp, front, backS, notFront };
}
// tables in a grid over the free floor, chairs round each, a pendant over each
function tables(K, h, type, w, d, step, nMax, chairs = 2) {
	const { st, lamp } = h;
	let n = 0;
	for (let z = K.rm.z1 - 1.5; z > K.rm.z0 + 1.2 && n < nMax; z -= step) for (let x = K.rm.x0 + 1.0; x < K.rm.x1 - 0.8 && n < nMax; x += step) {
		const tb = st(type, x, z, w, d, 0.75, 0, 0.55, { chairs });
		if (!tb) continue;
		n++;
		K.chairs(tb);
		lamp('pendant', x, z, 0.9);
	}
	return n;
}
// the front of the house of each kind of business
export function fitFront(fit, K) {
	const h = helpers(K), { ag, st, behind, atFront, lamp, front, backS, notFront } = h, r = K.rnd;
	const big = K.bw * K.bd > 22, long = Math.max(K.bw, K.bd);
	const counterAt = (kind, w = Math.min(3.2, long - 1.4)) => {
		const c = ag('shopCounter', w, 0.7, 1.0, { side: (s) => s === backS || (s.axis === 'z' && notFront(s)), clear: 1.1, score: (s) => (s === backS ? 1 : 0) }, { kind });
		behind(c);
		if (c) lamp('counter', c.x, c.z);
		return c;
	};
	const shelvesRound = (type, n, hgt = 1.8, w = 1.2) => { for (let k = 0; k < n; k++) { const s = ag(type, w, 0.45, hgt, { side: notFront, clear: 0.9 }); if (s && k % 2 === 0) lamp('track', s.x, s.z, 0.3); } };
	const browsers = (n) => { for (let k = 0; k < n; k++) K.stand(K.rm.x0 + 1 + r() * (K.bw - 2), K.rm.z0 + 1.2 + r() * (K.bd - 2.4), r() - 0.5, r() - 0.5, false); };
	switch (fit) {
		case 'cafe': case 'counter': {
			const c = counterAt(fit === 'cafe' ? 'cafe' : 'bar');
			if (c) h.ag('menuBoard', Math.min(2.4, c.w), 0.05, 0.01, { side: (s) => s === c.side, clear: 0, noWindow: true });
			ag('displayCase', 1.3, 0.6, 1.1, { clear: 0.8, side: notFront });
			if (big && fit === 'cafe') { const b = ag('booth', 1.6, 1.5, 1.15, { side: (s) => s.axis === 'z', clear: 0.4 }); if (b) { K.sitOn(b, 1, 0.5, 0.45); lamp('pendant', b.x, b.z, 0.9); } }
			tables(K, h, 'cafeTable', 0.6, 0.6, 1.8, big ? 8 : 4);
			break;
		}
		case 'bakery': {
			const c = counterAt('cafe');
			ag('displayCase', 1.6, 0.6, 1.1, { clear: 0.9, side: (s) => s.axis === 'z' || s === backS });
			ag('displayCase', 1.2, 0.6, 1.1, { clear: 0.9, side: notFront });
			for (let k = 0; k < 2; k++) ag('breadRack', 1.2, 0.45, 1.9, { side: (s) => s === (c ? c.side : backS) || s.axis === 'z', clear: 0.6 });
			tables(K, h, 'cafeTable', 0.6, 0.6, 1.8, 2);
			break;
		}
		case 'restaurant': case 'pizzeria': case 'diner': case 'sushi': {
			// the host by the door, booths down a side wall, tables, the pass or the counter at the back
			const hs = front ? st('hostStand', front.s + 0.9 < K.cx ? K.rm.x0 + 0.7 : K.rm.x1 - 0.7, K.rm.z1 - 1.2, 0.6, 0.44, 1.1, 2, 0.3) : null;
			if (hs) K.stand(hs.x, hs.z - 0.45, 0, 1, true);
			if (fit === 'sushi') { const bar = ag('barCounter', Math.min(4.2, long - 1.6), 0.7, 1.08, { side: (s) => s === backS || s.axis === 'z', clear: 1.4 }, { kind: 'sushi' }); behind(bar); if (bar) for (let k = 0; k < Math.floor(bar.w / 0.65); k++) { const [fx, fz] = h.face(bar.rot), u = -bar.w / 2 + 0.35 + k * 0.65, ax = [fz, -fx]; const s2 = st('barStool', bar.x + ax[0] * u + fx * (bar.d / 2 + 0.35), bar.z + ax[1] * u + fz * (bar.d / 2 + 0.35), 0.4, 0.4, 0.75, 0, 0); if (s2) K.seat(s2.x, s2.z, -fx, -fz, 0.75); lamp('pendant', bar.x + ax[0] * u, bar.z + ax[1] * u, 0.8); } }
			else if (fit === 'pizzeria') { const ov = ag('pizzaOven', 1.5, 1.5, 1.8, { side: (s) => s === backS || s.axis === 'z', clear: 1.2 }); atFront(ov); counterAt('cafe', Math.min(2.4, long - 2)); }
			else if (fit === 'diner') { const c = ag('barCounter', Math.min(4.5, long - 1.6), 0.7, 1.08, { side: (s) => s === backS, clear: 1.6 }); behind(c, 0.6); if (c) { const [fx, fz] = h.face(c.rot), ax = [fz, -fx]; for (let k = 0; k < Math.floor(c.w / 0.7); k++) { const u = -c.w / 2 + 0.35 + k * 0.7; const s2 = st('barStool', c.x + ax[0] * u + fx * (c.d / 2 + 0.35), c.z + ax[1] * u + fz * (c.d / 2 + 0.35), 0.4, 0.4, 0.75); if (s2) K.seat(s2.x, s2.z, -fx, -fz, 0.75); } lamp('pendant', c.x, c.z); } }
			else { const p = K.passSide ? ag('pass', Math.min(2.2, long - 2), 0.55, 1.6, { side: (s) => s === K.passSide, clear: 1.2 }) : null; if (p) { lamp('heatlamp', p.x, p.z, 1.3); atFront(p, 0.4); } else counterAt('bar', Math.min(2.4, long - 2)); }
			for (let k = 0; k < (fit === 'diner' ? 3 : big ? 2 : 1); k++) { const b = ag('booth', 1.4, 1.5, 1.15, { side: (s) => s.axis === 'z' && s.walled !== false, clear: 0.5 }); if (b) { K.sitOn(b, 1, 0.5, 0.45); lamp('pendant', b.x, b.z, 0.9); } }
			tables(K, h, 'diningTable', 0.9, 0.9, 2.2, big ? 10 : 4, 2);
			break;
		}
		case 'pub': case 'tasting': {
			const bb = ag('backBar', Math.min(3.6, long - 1.6), 0.45, 2.2, { side: (s) => s === backS || (s.axis === 'z' && notFront(s)), clear: 1.9 });
			const bar = bb ? K.inFront(bb, 'barCounter', bb.w, 0.7, 1.08, 0.95) : ag('barCounter', 3, 0.7, 1.08, { clear: 1.4 });
			if (bar) {
				if (bb) bar.rot = bb.rot;
				K.stand(bb ? (bb.x + bar.x) / 2 : bar.x, bb ? (bb.z + bar.z) / 2 : bar.z, ...h.face((bar.rot) % 4), true);
				const [fx, fz] = h.face(bar.rot), ax = [fz, -fx];
				for (let k = 0; k < Math.floor(bar.w / 0.7); k++) { const u = -bar.w / 2 + 0.35 + k * 0.7; const s2 = st('barStool', bar.x + ax[0] * u + fx * (bar.d / 2 + 0.35), bar.z + ax[1] * u + fz * (bar.d / 2 + 0.35), 0.4, 0.4, 0.75); if (s2) K.seat(s2.x, s2.z, -fx, -fz, 0.75); }
				lamp('pendant', bar.x, bar.z);
			}
			const b = ag('booth', 1.5, 1.5, 1.15, { side: (s) => s.axis === 'z', clear: 0.5 });
			if (b) K.sitOn(b, 1, 0.5, 0.45);
			tables(K, h, fit === 'tasting' ? 'cafeTable' : 'diningTable', 0.8, 0.8, 2.0, big ? 6 : 3, 2);
			break;
		}
		case 'books': case 'records': {
			shelvesRound('bookcase', 8, 2.0, 1.0);
			for (let x = K.rm.x0 + 1.8; x < K.rm.x1 - 1.4; x += 2.2) st('bookTable', x, K.cz + 0.3, 0.9, Math.min(1.8, K.bd - 4), 0.85, 0, 0.7);
			counterAt('books', 1.8);
			const ac = ag('armchair', 0.8, 0.8, 0.85, { corner: true, clear: 0.6 }); if (ac) K.sitOn(ac, 1);
			browsers(3);
			break;
		}
		case 'florist': {
			for (let k = 0; k < 7; k++) ag('flowers', 0.6, 0.5, 0.9, { clear: 0.7 });
			for (let x = K.rm.x0 + 1.5; x < K.rm.x1 - 1; x += 1.6) st('flowers', x, K.cz, 0.8, 0.8, 0.9, 0, 0.6);
			const c = counterAt('florist', 1.6); void c;
			ag('workbench', 1.4, 0.6, 0.92, { clear: 0.7, side: notFront });
			break;
		}
		case 'grocer': case 'general': {
			shelvesRound('shopShelf', 6);
			for (let x = K.rm.x0 + 1.9; x < K.rm.x1 - 1.5; x += 2.2) { const g = st(fit === 'grocer' ? 'produce' : 'shopShelf', x, K.cz + 0.4, 0.9, Math.min(3.6, K.bd - 4), 1.2, 0, 0.7); if (g) h.lamp('track', g.x, g.z, 0.3); }
			counterAt('grocer', 1.8);
			if (fit === 'general') ag('crates', 1.0, 0.8, 0.8, { corner: true, clear: 0 });
			browsers(3);
			break;
		}
		case 'hardware': case 'pharmacy': case 'pet': case 'liquor': case 'gift': case 'antiques': {
			shelvesRound('shopShelf', 7, fit === 'antiques' ? 1.6 : 1.9);
			for (let x = K.rm.x0 + 1.9; x < K.rm.x1 - 1.5; x += 2.3) st(fit === 'gift' || fit === 'antiques' ? 'bookTable' : 'shopShelf', x, K.cz + 0.4, 0.9, Math.min(3.6, K.bd - 4), fit === 'gift' ? 0.9 : 1.6, 0, 0.75);
			counterAt(fit === 'pharmacy' ? 'info' : 'grocer', 1.8);
			if (fit === 'gift') ag('postcards', 0.5, 0.5, 1.6, { corner: true, clear: 0.6 });
			if (fit === 'antiques') { const ac = ag('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.6 }); if (ac) K.sitOn(ac, 1); }
			browsers(2);
			break;
		}
		case 'gear': case 'bait': {
			for (let k = 0; k < 3; k++) { const g = ag('gearWall', Math.min(2.4, long - 1.5), 0.45, 2.2, { side: notFront, clear: 1.0 }); if (g) lamp('track', g.x, g.z, 0.3); }
			if (fit === 'gear' && K.bw > 4) ag('canoeRack', Math.min(4.5, long - 0.8), 0.6, 2.1, { side: (s) => s.axis === 'z' || s === backS, clear: 0, noWindow: true });
			if (fit === 'bait') ag('fishCase', 1.6, 0.8, 1.0, { clear: 1.0 }, { live: true });
			st('clothesRack', K.cx, K.cz + 0.4, Math.min(1.6, K.bw - 2.5), 0.5, 1.55, 0, 0.7);
			counterAt('grocer', 1.8);
			browsers(2);
			break;
		}
		case 'clothes': case 'tailor': {
			for (let x = K.rm.x0 + 1.6; x < K.rm.x1 - 1.2; x += 1.9) st('clothesRack', x, K.cz, 1.3, 0.5, 1.55, 1, 0.6);
			for (let k = 0; k < 2; k++) ag('mannequin', 0.45, 0.45, 1.8, { side: (s) => s === front, clear: 0.3 });
			shelvesRound('shopShelf', 2, 1.8);
			ag('mirrorStation', 0.9, 0.12, 2.0, { side: notFront, clear: 0.9, noWindow: true });
			if (fit === 'tailor') { const wb = ag('workbench', 1.6, 0.7, 0.92, { side: notFront, clear: 0.8 }); behind(wb, -0.55); }
			counterAt('grocer', 1.6);
			browsers(2);
			break;
		}
		case 'butcher': case 'fishmarket': {
			for (let k = 0; k < 3; k++) { const c = ag(fit === 'fishmarket' ? 'fishCase' : 'displayCase', 1.8, 0.85, 1.0, { side: notFront, clear: 1.1 }); if (c) behind(c, 0.6); }
			if (fit === 'fishmarket') for (let x = K.rm.x0 + 2.2; x < K.rm.x1 - 1.8; x += 2.6) st('fishCase', x, K.cz, 0.9, Math.min(3, K.bd - 5), 1.0, 0, 0.8);
			counterAt('grocer', 1.4);
			browsers(2);
			break;
		}
		case 'salon': case 'barber': {
			const n = Math.max(1, Math.min(4, Math.floor((long - 1.5) / 1.3)));
			for (let k = 0; k < n; k++) {
				const m = ag('mirrorStation', 1.0, 0.3, 2.05, { side: (s) => s.axis === 'z', clear: 1.6, noWindow: true });
				if (!m) break;
				const c = K.inFront(m, 'salonChair', 0.6, 0.6, 1.2, 0.35);
				if (c) { c.rot = (m.rot + 2) % 4; K.seat(c.x, c.z, ...h.face(m.rot).map((v) => -v), 0.5); const [fx, fz] = h.face(m.rot); K.stand(c.x + fx * 0.7 + fz * 0.3, c.z + fz * 0.7 - fx * 0.3, -fx, -fz, true); }
				lamp('sconce', m.x, m.z, 0.9);
			}
			if (fit === 'salon') ag('washBasin', 0.6, 0.9, 0.85, { side: (s) => s === backS, clear: 0.8 });
			const w = ag('waitingChairs', 1.6, 0.5, 0.9, { side: (s) => s === front || s.axis === 'z', clear: 0.6 }); if (w) K.sitOn(w, 2, 0.46, 0.05);
			counterAt('info', 1.2);
			break;
		}
		case 'laundromat': {
			for (const s of K.sides) if (s.walled !== false && s !== front) for (let k = 0; k < 8; k++) ag(k % 2 ? 'dryer' : 'washer', 0.7, 0.72, 0.95, { side: (q) => q === s, clear: 1.0 });
			const be = st('bench', K.cx, K.rm.z1 - 1.8, 1.6, 0.5, 0.45, 2, 0.3); if (be) K.sitOn(be, 2, 0.45, 0.05);
			break;
		}
		case 'gym': case 'yoga': {
			if (fit === 'gym') {
				for (let k = 0; k < 2; k++) ag('weightRack', 1.6, 1.4, 2.1, { side: notFront, clear: 0.6 });
				for (let x = K.rm.x0 + 1.0; x < K.rm.x1 - 0.8; x += 1.1) st('treadmill', x, K.rm.z1 - 1.6, 0.8, 1.9, 1.45, 2, 0.15);
			} else for (let z = K.rm.z1 - 1.4; z > K.rm.z0 + 1; z -= 1.0) for (let x = K.rm.x0 + 0.9; x < K.rm.x1 - 0.7; x += 2.2) st('yogaMat', x, z, 1.8, 0.62, 0.01, 1, 0.15);
			counterAt('info', 1.2);
			ag('mirrorStation', Math.min(3, long - 2), 0.15, 2.0, { side: notFront, clear: 0.6, noWindow: true });
			browsers(3);
			break;
		}
		case 'clinic': case 'dental': case 'office': case 'studio': case 'reception': case 'bnb': {
			// a reception: the desk facing the door, chairs to wait on, the rest by its kind
			const desk = ag('frontDesk', Math.min(2.2, long - 2), 0.7, 1.1, { side: (s) => s === backS || (s.axis === 'z' && notFront(s)), clear: 1.4, score: (s) => (s === backS ? 1 : 0) }, { keys: fit === 'bnb' || fit === 'reception' });
			behind(desk);
			if (desk) lamp('pendant', desk.x, desk.z);
			if (fit === 'bnb' || fit === 'reception') {
				for (let k = 0; k < 2; k++) { const ac = ag('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 }); if (ac) K.sitOn(ac, 1); }
				ag('luggageRack', 0.7, 0.45, 0.75, { side: (s) => s === front, clear: 0.3 });
				ag('plant', 0.5, 0.5, 1.3, { corner: true, clear: 0 });
				ag('rug', Math.min(2.4, K.bw - 1.2), Math.min(1.6, K.bd - 1.6), 0.01, { clear: 0, centre: true });
			} else {
				const w = ag('waitingChairs', Math.min(2.2, long - 2), 0.5, 0.9, { side: (s) => s.axis === 'z' || s === front, clear: 0.7 }); if (w) K.sitOn(w, 3, 0.46, 0.05);
				if (fit === 'dental') { const c = st('dentalChair', K.cx, K.cz, 0.6, 1.3, 1.0, 0, 0.6); if (c) { K.stand(c.x + 0.7, c.z, -1, 0, true); lamp('task', c.x, c.z, 0.9); } }
				else if (fit === 'clinic') { const c = ag('examTable', 0.7, 1.9, 0.8, { side: notFront, clear: 0.9 }); if (c) lamp('task', c.x, c.z, 0.9); }
				else for (let x = K.rm.x0 + 1.2; x < K.rm.x1 - 1.2; x += 1.9) { const d = st('officeDesk', x, K.cz - 0.3, 1.5, 0.75, 0.76, 0, 0.45); if (d) { K.seat(x, K.cz - 1.0, 0, 1, 0.47); lamp('pendant', x, K.cz - 0.3, 0.6); } }
				ag('plant', 0.5, 0.5, 1.3, { corner: true, clear: 0 });
			}
			break;
		}
		case 'breakfast': {
			// a guest house's breakfast room: small tables, the sideboard with the coffee
			ag('sideboard', 1.6, 0.5, 0.9, { long: true, clear: 0.7 });
			tables(K, h, 'cafeTable', 0.7, 0.7, 1.7, 4);
			break;
		}
		case 'lounge': {
			const so = ag('sofa', 2.0, 0.92, 0.85, { long: true, clear: 1.2 }); if (so) { K.sitOn(so, 3); K.inFront(so, 'coffeeTable', 1.0, 0.55, 0.42, 0.45); }
			for (let k = 0; k < 2; k++) { const ac = ag('armchair', 0.85, 0.85, 0.85, { corner: true, clear: 0.7 }); if (ac) K.sitOn(ac, 1); }
			ag('bookcase', 0.9, 0.34, 1.9, { clear: 0.7 });
			break;
		}
		case 'garage': case 'workshop': case 'repair': case 'bike': {
			if (fit === 'garage' && K.bw > 4.4 && K.bd > 6) {
				const lift = r() < 0.6 ? 1.6 : 0.1;
				const L = st('carLift', K.cx, K.cz + 0.2, 3.4, 1.0, 2.6, 0, 0.3, { lift });
				if (L) { K.items.push({ type: 'car', x: K.cx, z: K.cz + 0.2, y: K.y0 + lift, rot: 1, w: 1.85, d: 4.6, h: 1.45, v: r(), raised: lift > 1 }); K.stand(K.cx + 0.4, K.cz + 1.6, 0, -1, true); }
			}
			ag('gearWall', Math.min(2.4, long - 1.5), 0.3, 2.2, { side: notFront, clear: 0.9 }, { kind: 'tools' });
			ag('toolChest', 1.0, 0.5, 1.0, { side: notFront, clear: 0.8 });
			const wb = ag('workbench', 1.8, 0.7, 0.92, { side: notFront, clear: 0.8 }); if (wb) { atFront(wb, 0.5); lamp('task', wb.x, wb.z, 0.8); }
			if (fit === 'garage') ag('tyres', 0.65, 0.65, 0.9, { corner: true, clear: 0 });
			if (fit === 'repair' || fit === 'bike') counterAt('grocer', 1.6);
			if (fit === 'bike') for (let k = 0; k < 2; k++) ag('bikes', 1.6, 0.5, 1.0, { clear: 0.5 });
			break;
		}
		case 'daycare': {
			ag('rug', Math.min(3, K.bw - 1.2), Math.min(2.2, K.bd - 1.4), 0.01, { clear: 0, centre: true });
			for (let k = 0; k < 3; k++) ag('toys', 0.7, 0.45, 0.45, { corner: k === 0, clear: 0.3 });
			for (let x = K.rm.x0 + 1.2; x < K.rm.x1 - 1; x += 1.6) st('schoolDesk', x, K.cz, 0.7, 0.5, 0.55, 0, 0.4);
			if (K.bw * K.bd > 14) ag('cribs', 1.2, 0.65, 0.9, { side: notFront, clear: 0.4 });
			K.stand(K.cx, K.cz + 0.8, 0, -1, true);
			break;
		}
		default: return false;
	}
	ag('plant', 0.45, 0.45, 1.2, { corner: true, clear: 0 });
	K.light(FOOD.has(fit) ? 'pendant' : 'flush');
	return true;
}
// the back of the house: the kitchen (ranges along the wall, the prep tables in the middle,
// the fryer, the fridge, the shelves), the bakehouse, the stockroom, the workshop, the office
export function fitBack(kind, K) {
	const h = helpers(K), { ag, st, atFront, lamp } = h;
	switch (kind) {
		case 'kitchen': {
			const rg = ag('range', Math.min(1.8, Math.max(K.bw, K.bd) - 1.6), 0.85, 0.92, { clear: 1.1, long: true, noWindow: true });
			atFront(rg, 0.45);
			if (rg) lamp('hood', rg.x, rg.z, 0.7);
			ag('fryer', 0.8, 0.75, 0.92, { clear: 1.0, noWindow: true });
			ag('fridge', 0.9, 0.75, 1.9, { corner: true, clear: 0.9 });
			const p = st('prepTable', K.cx, K.cz, Math.min(1.8, K.bw - 2.2), 0.75, 0.92, K.bw >= K.bd ? 0 : 1, 0.75);
			if (p) { K.stand(p.x, p.z + (K.bw >= K.bd ? -0.65 : 0), 0, 1, true); lamp('task', p.x, p.z, 0.7); }
			ag('shelves', 1.2, 0.5, 1.9, { clear: 0.7 });
			K.light('tube');
			return true;
		}
		case 'bakehouse': {
			const ov = ag('deckOven', 1.6, 1.0, 1.85, { clear: 1.2, noWindow: true }); atFront(ov, 0.5);
			ag('breadRack', 1.2, 0.5, 1.9, { clear: 0.8 });
			const p = st('prepTable', K.cx, K.cz, Math.min(2.0, K.bw - 2.2), 0.8, 0.92, 0, 0.75); if (p) K.stand(p.x, p.z - 0.7, 0, 1, true);
			K.light('tube');
			return true;
		}
		case 'stock': {
			for (let k = 0; k < 3; k++) ag('shelves', Math.min(2.2, Math.max(K.bw, K.bd) - 1), 0.5, 1.9, { clear: 0.7 });
			for (let k = 0; k < 3; k++) ag('boxes', 0.5, 0.45, 0.5 + K.rnd() * 0.5, { corner: true, clear: 0 });
			K.light('tube');
			return true;
		}
		case 'workshop': {
			const wb = ag('workbench', 1.8, 0.7, 0.92, { clear: 0.9 }); atFront(wb, 0.5);
			ag('gearWall', Math.min(2.2, Math.max(K.bw, K.bd) - 1.5), 0.3, 2.2, { clear: 0.8 }, { kind: 'tools' });
			ag('toolChest', 1.0, 0.5, 1.0, { clear: 0.8 });
			ag('shelves', 1.6, 0.5, 1.9, { clear: 0.6 });
			if (K.garage && K.bw > 2.8 && K.bd > 5.6) K.items.push({ type: 'car', x: K.cx, z: K.rm.z1 - 2.6, y: K.y0, rot: 0, w: 1.85, d: 4.6, h: 1.45, v: K.rnd() });
			K.light('tube');
			return true;
		}
		case 'office': {
			const d = ag('desk', 1.4, 0.65, 0.75, { clear: 0.9 }); if (d) K.sitOn(d, 1, 0.47, 0.55);
			ag('bookcase', 0.9, 0.34, 1.9, { clear: 0.6 });
			ag('boxes', 0.5, 0.45, 0.6, { corner: true, clear: 0 });
			K.light('flush');
			return true;
		}
		default: return false;
	}
}
