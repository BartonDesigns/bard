// The insides of the cafés and restaurants (bay/commercial.js builds the shell: its venue 'cafe'
// or 'restaurant', the economy's business type its cuisine), laid out the way real ones are:
//   - a sit-down place (a trattoria, a bistro, a fish house, a curry house): the kitchen across
//     the back behind its wall, the plates coming out through the pass; the host's stand by the
//     door, booths down one wall, tables laid with their plates, glasses and napkins, the wine on
//     the wall, pendants low over the tables
//   - a pub, a tapas bar: the bar down one wall (its taps, its brass rail, the stools, the back
//     bar of bottles on its mirror), booths across from it, high tables between, the game on
//   - a pizzeria: the counter with the slices under glass, the oven glowing behind it, the lit
//     boards over it, tables and booths out front
//   - a burger, taco or kebab counter: the order counter and its lit menu with the pictures, the
//     line behind it (the fryers, the grill, the hood), the drinks fountain, booths and two-tops
//   - a diner: the long counter with its stools and the pie case, the coffee on the back counter,
//     booths down the wall and along the windows, the pass at the back
//   - a sushi bar, a ramen shop, an izakaya: the counter across the room with its stools, the
//     chefs behind it at the fish case or the stockpots, the curtain at the kitchen door,
//     lanterns over it, a few tables by the window
//   - a café: the espresso bar (the machine, the grinder, the pastry case, the register), the
//     menu boards behind on the wall, the cups and the beans on the shelf; round tables, a
//     communal table, the bar along the window with its stools, a pair of armchairs
//   - a bakery, a donut shop, a bubble tea counter, an ice cream parlour: the cases and racks of
//     what they make, behind the counter what they make it with, a few tables
// What is drawn goes the shops' three ways (bay/storefit.js): the fittings into the house kit's
// builder, what is painted (the menus, the pastries and donuts in their cases, the glasses and the
// cups) on the goods' sheet, the lamps and the glass in commercial.js's materials. A generator:
// it yields between its parts.

import '../interiors/estab-kit.js';
import { stripUV } from '../interiors/goods.js';
import { srgbToLinear as lin } from '../world/srgb.js';
import { frame, COL as C, hsl, use, fbox, solid, spot, item, shelfRun, counter, strips, HUNG } from './storefit.js';

// the economy's dining types, by how their rooms are laid out
const STYLE = {
	cafe: 'cafe', waffle: 'cafe', bakery: 'bakery', donut: 'donut', boba: 'boba', icecream: 'icecream',
	pasta: 'sitdown', bistro: 'sitdown', seafood: 'sitdown', curry: 'sitdown', tapas: 'pub', pub: 'pub',
	pizza: 'pizza', diner: 'diner', burger: 'quick', taco: 'quick', grill: 'quick', bbq: 'quick',
	sushi: 'counter', ramen: 'counter', noodles: 'counter', izakaya: 'counter',
};
export const styleOf = (venue, type) => STYLE[type] || (venue === 'cafe' ? 'cafe' : 'sitdown');
// which of the goods' chalk menus each hangs (interiors/goods.js MENUS) and which lit board
const MENU = { cafe: 0, sitdown: 1, pub: 2, boba: 3, icecream: 4, counter: 5, bakery: 6, donut: 0, diner: 1 };
// (a counter's row of boards, left to right)
const BOARDS = { cafe: [0, 3, 6], bakery: [6, 0, 6], donut: [0, 6], boba: [3, 3], icecream: [4, 0] };
const LIT = { burger: 0, bbq: 0, grill: 0, pizza: 1, taco: 2 };

const WD = { oak: lin([0.6, 0.43, 0.27]), walnut: lin([0.3, 0.19, 0.11]), pale: lin([0.82, 0.7, 0.52]), ash: lin([0.88, 0.82, 0.72]) };
const WHITE = lin([0.95, 0.95, 0.93]), STEEL = lin([0.74, 0.75, 0.77]), CLOTH = lin([0.97, 0.97, 0.95]), BLACK = lin([0.04, 0.04, 0.045]);
const GLASSY = lin([0.82, 0.9, 0.94]), RED = lin([0.72, 0.08, 0.08]), CREAM = lin([0.96, 0.92, 0.84]);

// ---------------------------------------------------------------------------------
// the pieces

// a seat at (x, z) for someone looking along (fx, fz), sat at h
function sit(K, x, z, fx, fz, h = 0.46) {
	const s = [x, z, Math.atan2(-fx, -fz), true];
	if (h !== 0.46) { s[4] = 0; s[5] = h; }
	K.seats.push(s);
}
// a chair at (x, z), its sitter looking along (fx, fz): the seat, the back behind, four legs
function chair(K, x, z, fx, fz, col, legs = C.black) {
	const g = K.g;
	g.at(x, 0, z, Math.abs(fz) > Math.abs(fx) ? (fz > 0 ? 0 : 2) : fx > 0 ? 1 : 3);
	g.box('fabric', -0.21, 0.43, -0.2, 0.21, 0.48, 0.2, col);
	g.box('grain', -0.21, 0.48, -0.24, 0.21, 0.92, -0.2, col);
	for (const sx of [-0.17, 0.17]) for (const sz of [-0.2, 0.16]) g.box('metal', sx - 0.015, 0, sz - 0.015, sx + 0.015, 0.43, sz + 0.015, legs);
	g.at(0, 0, 0, 0);
}
// what is laid at a place: a plate, the knife and fork, the glass, the napkin (dinner); a cup on
// its saucer (cafe); a tray with the food and the cup (quick). At (x, z), the diner along (fx, fz)
function place(K, x, z, fx, fz, y, kind) {
	const g = K.g, rx = -fz, rz = fx;
	g.at(0, 0, 0, 0);
	if (kind === 'dinner') {
		g.cyl('gloss', x, y, z, 0.13, 0.012, WHITE, 8);
		for (const s of [-1, 1]) { const cx = x + rx * s * 0.18, cz = z + rz * s * 0.18; g.box('metal', cx - 0.012 - Math.abs(fx) * 0.08, y, cz - 0.012 - Math.abs(fz) * 0.08, cx + 0.012 + Math.abs(fx) * 0.08, y + 0.005, cz + 0.012 + Math.abs(fz) * 0.08, STEEL); }
		const gx = x + fx * 0.2 + rx * 0.16, gz = z + fz * 0.2 + rz * 0.16;
		g.cyl('glass', gx, y, gz, 0.006, 0.095, GLASSY, 3); g.cyl('glass', gx, y + 0.095, gz, 0.038, 0.07, GLASSY, 6, 'y', true, 0.032);
	} else if (kind === 'cafe') {
		g.cyl('gloss', x, y, z, 0.07, 0.008, WHITE, 9); g.cyl('gloss', x, y + 0.008, z, 0.042, 0.07, WHITE, 8);
	} else if (kind === 'quick') {
		g.box('gloss', x - 0.17, y, z - 0.13, x + 0.17, y + 0.014, z + 0.13, RED);
		g.cyl('matte', x - 0.05, y + 0.014, z, 0.06, 0.05, lin([0.8, 0.55, 0.28]), 8);
		g.cyl('gloss', x + 0.09, y + 0.014, z + 0.04, 0.035, 0.14, WHITE, 7);
	}
}
// a table for n (2 or 4) at (x, z), along x; o: { top, cloth, round, chair, place, h (a high top) }
function table(K, x, z, n, o = {}) {
	const g = K.g, T = o.h ?? 0.74, hw = n > 2 ? 0.6 : 0.36, hd = n > 2 ? 0.42 : 0.36, top = o.top || WD.oak;
	g.at(0, 0, 0, 0);
	if (o.round) {
		g.cyl('stone', x, T - 0.03, z, hd + 0.04, 0.03, top, 14);
		g.cyl('metal', x, 0, z, 0.04, T - 0.03, C.black, 6, 'y', false); g.cyl('metal', x, 0, z, 0.24, 0.025, C.black, 10);
	} else {
		g.box(o.cloth ? 'fabric' : 'grain', x - hw, T - 0.035, z - hd, x + hw, T, z + hd, o.cloth ? CLOTH : top);
		if (o.cloth) for (const [a, b, c, d] of [[x - hw, z - hd - 0.01, x + hw, z - hd], [x - hw, z + hd, x + hw, z + hd + 0.01], [x - hw - 0.01, z - hd, x - hw, z + hd], [x + hw, z - hd, x + hw + 0.01, z + hd]]) g.box('fabric', a, T - 0.3, b, c, T, d, CLOTH);
		else for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box('metal', x + sx * (hw - 0.05) - 0.02, 0, z + sz * (hd - 0.05) - 0.02, x + sx * (hw - 0.05) + 0.02, T - 0.035, z + sz * (hd - 0.05) + 0.02, C.black);
	}
	K.col.push([x - hw, z - hd, x + hw, z + hd, 0, T]);
	const at = n > 2 ? [[-0.3, -1], [0.3, -1], [-0.3, 1], [0.3, 1]] : [[0, -1], [0, 1]];
	for (const [u, s] of at) {
		const sx = x + u, sz = z + s * (hd + 0.3);
		if (o.h) { item(K, frame('+z', 0), 'barStool', sx, sz, 0.4, 0.4, 0.8, 0, { v: K.sv }); sit(K, sx, sz, 0, -s, 0.78); }
		else { chair(K, sx, sz, 0, -s, o.chair || WD.walnut); sit(K, sx, sz, 0, -s); }
		if (o.place) place(K, sx, z + s * (hd - 0.17), 0, -s, T, o.place);
	}
	// (in the middle: a candle in its glass, a bud vase; the salt and pepper)
	if (o.place === 'dinner') { g.cyl('glass', x, T, z, 0.03, 0.07, lin([0.95, 0.8, 0.5]), 7); g.cyl('gloss', x + 0.08, T, z + 0.02, 0.012, 0.06, WHITE, 5); g.cyl('gloss', x + 0.11, T, z + 0.02, 0.012, 0.06, C.black, 5); }
	else if (o.place === 'quick') g.box('metal', x - 0.05, T, z - 0.04, x + 0.05, T + 0.12, z + 0.04, STEEL);
}
// booths down a side wall (side -1 the left, +1 the right) from z a to b: each a table out from
// the wall with its two high-backed benches; o.place what is laid
function booths(K, side, a, b, o = {}) {
	const w = K.wall, x0 = side < 0 ? w.x0 : w.x1, pitch = 1.95;
	let n = 0;
	for (let z = a + pitch / 2; z + pitch / 2 <= b + 1e-3; z += pitch, n++) {
		const cx = x0 - side * 0.66;
		item(K, frame('+z', 0), 'booth', cx, z, 1.3, 1.9, 1.15, 0, o.v != null ? { v: o.v } : {});
		K.col.push([cx - 0.65, z - 0.95, cx + 0.65, z - 0.45, 0, 1.15], [cx - 0.65, z + 0.45, cx + 0.65, z + 0.95, 0, 1.15], [cx - 0.6, z - 0.32, cx + 0.6, z + 0.32, 0, 0.76]);
		for (const u of [-0.3, 0.3]) for (const s of [-1, 1]) {
			sit(K, cx + u, z + s * 0.68, 0, -s, 0.5);
			if (o.place) place(K, cx + u, z + s * 0.17, 0, -s, 0.76, o.place);
		}
	}
	return n;
}
// a bar along a face (dir, at the wall's line) from a0 to a1: the back bar against the wall, the
// counter out from it with its taps and brass rail, the stools, the bartender between
function bar(K, dir, line, a0, a1, o = {}) {
	const F = frame(dir, line), [L0, L1] = F.L(a0, a1), mid = (L0 + L1) / 2, len = L1 - L0;
	item(K, F, 'backBar', mid, 0.28, len, 0.55, 2.2, 0);
	solid(K, F, L0, 0, L1, 0.56, 2.2);
	// (the bottles lit from under their shelves, against the mirror)
	for (const y of [1.13, 1.58]) fbox(K, F, K.mats.panel, L0 + 0.15, y, 0.04, L1 - 0.15, y + 0.012, 0.07);
	item(K, F, 'barCounter', mid, 1.55, len - 0.9, 0.6, 1.13, 0, { kind: o.kind });
	solid(K, F, L0 + 0.45, 1.25, L1 - 0.45, 1.85, 1.13);
	for (let x = L0 + 0.75; x < L1 - 0.6; x += 0.62) {
		item(K, F, 'barStool', x, 2.28, 0.4, 0.4, 0.8, 0, { v: K.sv });
		const [wx, wz] = F.W(x, 2.28), [ox, oz] = F.W(0, 0), [fx, fz] = F.W(0, -1);
		sit(K, wx, wz, fx - ox, fz - oz, 0.78);
	}
	spot(K, F, mid - len * 0.2, 0.9, 0, 1, true);
	if (len > 5) spot(K, F, mid + len * 0.25, 0.9, 0, 1, true);
	// the glasses racked on the back bar's lower shelf, the pendants over the counter
	use(K, F);
	K.s.face('glasses', L0 + 0.2, L1 - 0.2, 0.95, 0.2, 0.42, 3, 1.0);
	for (let x = L0 + 0.8; x < L1 - 0.5; x += 1.6) { const [wx, wz] = F.W(x, 1.55); pendant(K, wx, wz, 2.05, o.shade || BLACK); }
	return F;
}
// a pendant lamp at (x, z), its shade's rim at y: the cord to the ceiling, the shade, the bulb
function pendant(K, x, z, y, col, r = 0.17) {
	const g = K.g, top = K.ceil ?? K.roof ?? HUNG;
	g.at(0, 0, 0, 0);
	g.box('metal', x - 0.005, y + 0.22, z - 0.005, x + 0.005, top, z + 0.005, C.black);
	g.cyl('gloss', x, y, z, r, 0.22, col, 14, 'y', false, r * 0.3);
	K.box(K.mats.panel, x - 0.05, y + 0.02, z - 0.05, x + 0.05, y + 0.1, z + 0.05);
}
// small round lights let into the ceiling, every `every` metres over the room's part
function downlights(K, x0, x1, z0, z1, every = 2.6) {
	// (none where the room is open to the roof: its own pendants light it, bay/commercial.js)
	if (!K.ceil) return;
	const y = K.ceil, g = K.g;
	const nx = Math.max(1, Math.round((x1 - x0) / every)), nz = Math.max(1, Math.round((z1 - z0) / every));
	g.at(0, 0, 0, 0);
	for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
		const x = x0 + (i + 0.5) * (x1 - x0) / nx, z = z0 + (j + 0.5) * (z1 - z0) / nz;
		g.cyl('metal', x, y - 0.012, z, 0.1, 0.012, C.white, 12);
		K.box(K.mats.panel, x - 0.065, y - 0.016, z - 0.065, x + 0.065, y - 0.012, z + 0.065);
	}
}
// a framed picture on a side or back wall: dir the way the wall faces, at (a along it, y), w x h
function art(K, dir, line, a, y, w, h, col, frameCol = C.black) {
	const F = frame(dir, line), [L0, L1] = F.L(a - w / 2, a + w / 2);
	use(K, F);
	K.g.box('grain', L0, y, 0.0, L1, y + h, 0.03, frameCol);
	K.g.box('matte', L0 + 0.05, y + 0.05, 0.03, L1 - 0.05, y + h - 0.05, 0.035, col);
	// (a few shapes in it: hills, a sun, a bowl of fruit, as it may be)
	K.g.box('matte', L0 + 0.08, y + 0.08, 0.035, L1 - 0.08, y + h * 0.4, 0.038, lin(hsl((col[0] * 7) % 1, 0.35, 0.35)));
}
// a potted plant: the pot, the leaves in a few loose balls
function plant(K, x, z, h = 1.2, potCol = lin([0.82, 0.8, 0.76])) {
	const g = K.g;
	g.at(0, 0, 0, 0);
	g.cyl('matte', x, 0, z, 0.2, 0.4, potCol, 12, 'y', true, 0.24);
	const green = lin([0.16, 0.32, 0.14]);
	for (let k = 0; k < 4; k++) { const a = k * 1.7, r = 0.12 + k * 0.03; g.sphere('matte', x + Math.cos(a) * r, 0.4 + h * (0.35 + 0.15 * k), z + Math.sin(a) * r, 0.24, 0.2 + 0.05 * k, 0.24, green, 8); }
	K.col.push([x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, 0.5]);
}
// a board of the goods' sheet (a menu, lit or chalk) at the wall's line, from x0 to x1, y to y + h
function board(K, F, kind, n, L0, L1, y, h, k = 1) {
	const [u0, v0, u1, v1] = stripUV(kind, n);
	use(K, F);
	K.g.box('gloss', L0 - 0.04, y - 0.04, -0.005, L1 + 0.04, y + h + 0.04, 0.025, BLACK);
	K.s.quad([L0, y, 0.03], [L1, y, 0.03], [L1, y + h, 0.03], [L0, y + h, 0.03], [u0, v0, u1, v1], k);
}
// the kitchen across the back, behind its wall at kz: the pass (a window over a steel shelf) in
// the middle, its door at one end; behind, along the back wall, the ranges under their hood, the
// fryer, the steel prep tables down the middle, the shelves; the cooks at the line.
// o: { pizza (an oven), fryers, door: 'left' | 'right', open (no wall: an open kitchen behind a
// counter, as a pizzeria's or a burger place's), sign }
function* kitchen(K, kz, o = {}) {
	const w = K.wall, g = K.g, s = K.s, top = Math.min(K.ceil ?? 3.4, 3.4), iw = w.x1 - w.x0;
	const pa = (w.x0 + w.x1) / 2 - Math.min(1.8, iw * 0.2), pb = (w.x0 + w.x1) / 2 + Math.min(1.8, iw * 0.2);
	const dl = o.door === 'left', da = dl ? w.x0 + 0.6 : w.x1 - 1.6, db = da + 1.0;
	g.at(0, 0, 0, 0);
	// the floor of red quarry tile, the steel up the back wall
	g.box('tile', w.x0, 0.003, w.z0, w.x1, 0.012, kz - 0.06, lin([0.5, 0.26, 0.18]));
	g.box('metal', w.x0, 0.9, w.z0 + 0.0, w.x1, 2.0, w.z0 + 0.02, STEEL);
	if (!o.open) {
		const segs = dl ? [[w.x0, da], [db, pa], [pb, w.x1]] : [[w.x0, pa], [pb, da], [db, w.x1]];
		for (const [a, b] of segs) if (b - a > 0.05) { g.box('matte', a, 0, kz - 0.06, b, top, kz + 0.06, C.white); K.col.push([a, kz - 0.06, b, kz + 0.06, 0, top]); }
		g.box('matte', pa, 1.95, kz - 0.06, pb, top, kz + 0.06, C.white);
		g.box('matte', da, 2.1, kz - 0.06, db, top, kz + 0.06, C.white);
		// the door: a steel swing door standing half open, its round window
		g.box('metal', da + 0.02, 0.02, kz - 0.06, da + 0.06, 2.06, kz + 0.75, STEEL);
		g.cyl('glass', da + 0.04, 1.5, kz + 0.4, 0.12, 0.03, GLASSY, 12, 'x');
		// the pass in the window: its steel shelf, the heat lamps glowing over the plates waiting
		item(K, frame('+z', 0), 'pass', (pa + pb) / 2, kz, pb - pa, 0.5, 1.6, 0);
		K.col.push([pa, kz - 0.25, pb, kz + 0.25, 0, 1.04]);
		g.at(0, 0, 0, 0);
		for (let x = pa + 0.4; x < pb - 0.2; x += 0.8) g.box('metal', x - 0.15, 1.5, kz - 0.06, x + 0.15, 1.55, kz + 0.06, STEEL);
		K.box(K.mats.panel, pa + 0.1, 1.49, kz - 0.04, pb - 0.1, 1.5, kz + 0.04);
		if (o.sign) { s.at(0, 0, 0, 0); s.sign(o.sign, pa + 0.3, pb - 0.3, 2.0, 0.24, kz + 0.07, K.brand.bg); }
	}
	yield;
	// the line along the back wall: ranges under the hood, the fryers, a pizza oven
	const F = frame('+z', w.z0), x0 = w.x0 + 0.5, x1 = w.x1 - 0.5;
	let x = x0;
	const put = (type, wd, dp, h, extra = {}) => { if (x + wd > x1) return false; item(K, F, type, x + wd / 2, dp / 2 + 0.02, wd, dp, h, 0, extra); solid(K, F, x, 0.02, x + wd, dp + 0.02, Math.min(h, 1.0)); x += wd + 0.05; return true; };
	if (o.pizza) put('pizzaOven', 1.6, 1.6, 2.3);
	for (let k = 0; k < (o.fryers ?? 1); k++) put('fryer', 0.5, 0.8, 1.05);
	put('range', 1.6, 0.85, 2.4);
	if (x1 - x > 2) put('range', 1.2, 0.85, 2.4);
	if (x1 - x > 1.2) { use(K, F); g.box('metal', x, 0, 0.02, x1, 0.9, 0.7, STEEL); g.box('metal', x, 0.9, 0.02, x1, 0.94, 0.72, STEEL); solid(K, F, x, 0.02, x1, 0.72, 0.94); s.run('jars', x + 0.05, Math.min(x1, x + 2.4), 0.94, 0.25, 0.6, 0.3, 4, 0.9); }
	// the shelf over the line, its pans and tins
	use(K, F);
	g.box('metal', x0, 2.05, 0.02, Math.min(x1, x0 + 3.6), 2.08, 0.4, STEEL);
	s.run('cans', x0 + 0.05, Math.min(x1, x0 + 3.5), 2.08, 0.3, 0.38, 0.3, 7, 0.85);
	// the prep tables down the middle, the cooks between them and the line
	const pz = (w.z0 + kz) / 2 + 0.25;
	if (kz - w.z0 > 2.4) for (let px = w.x0 + 1.2; px < w.x1 - 1.6; px += 2.0) {
		item(K, frame('+z', 0), 'prepTable', px + 0.75, pz, 1.5, 0.7, 0.95, 0);
		K.col.push([px, pz - 0.35, px + 1.5, pz + 0.35, 0, 0.95]);
	}
	for (let k = 0, cx = x0 + 0.8; k < 3 && cx < x1 - 0.5; k++, cx += 1.9) spot(K, F, cx, 1.25, 0, -1, true);
	// the kitchen's own lights
	for (const lx of [w.x0 + iw * 0.3, w.x0 + iw * 0.7]) K.box(K.mats.panel, lx - 0.6, top - 0.03, (w.z0 + kz) / 2 - 0.08, lx + 0.6, top - 0.01, (w.z0 + kz) / 2 + 0.08);
}
// the espresso machine on a counter top at y, its front toward +z from z, centred on x
function espresso(K, x, y, z, accent) {
	const g = K.g;
	g.at(0, 0, 0, 0);
	g.box('metal', x - 0.42, y, z, x + 0.42, y + 0.44, z + 0.48, STEEL);
	g.box('gloss', x - 0.4, y + 0.2, z + 0.48, x + 0.4, y + 0.42, z + 0.5, accent);
	g.box('gloss', x - 0.43, y + 0.44, z, x + 0.43, y + 0.48, z + 0.5, BLACK);
	for (let i = 0; i < 5; i++) g.cyl('gloss', x - 0.3 + i * 0.15, y + 0.48, z + 0.25, 0.035, 0.07, WHITE, 8);
	for (const gx of [-0.2, 0.2]) {
		g.cyl('metal', x + gx, y + 0.2, z + 0.53, 0.045, 0.06, STEEL, 10);
		g.box('gloss', x + gx - 0.015, y + 0.19, z + 0.52, x + gx + 0.015, y + 0.22, z + 0.72, BLACK);
		g.cyl('gloss', x + gx, y + 0.04, z + 0.6, 0.035, 0.07, WHITE, 8);
	}
	for (const sx of [-0.36, 0.36]) g.box('metal', x + sx - 0.006, y + 0.1, z + 0.5, x + sx + 0.006, y + 0.3, z + 0.52, STEEL);
	g.box('metal', x - 0.4, y, z + 0.48, x + 0.4, y + 0.03, z + 0.66, STEEL);
	// the grinder beside it: its body, the hopper of beans
	g.cyl('gloss', x + 0.62, y, z + 0.25, 0.09, 0.34, BLACK, 10);
	g.cyl('glass', x + 0.62, y + 0.34, z + 0.25, 0.085, 0.2, GLASSY, 10, 'y', true, 0.1);
	g.cyl('matte', x + 0.62, y + 0.35, z + 0.25, 0.075, 0.1, lin([0.16, 0.09, 0.05]), 10);
}
// a glass case on a counter (pastries, donuts, cakes, slices under heat): its base, the glass,
// its two lit shelves of what it holds, toward +z (the customers) from z; L0..L1 along x
function caseOf(K, F, L0, L1, kinds, y = 0.95) {
	const g = K.g, s = K.s;
	use(K, F);
	g.box('gloss', L0, 0, -0.75, L1, y, -0.02, lin([0.25, 0.2, 0.17]));
	for (let i = 0; i < 2; i++) {
		const yy = y + 0.04 + i * 0.26;
		g.box('glass', L0 + 0.03, yy - 0.015, -0.7, L1 - 0.03, yy, -0.1, GLASSY);
		s.run(kinds[i % kinds.length], L0 + 0.05, L1 - 0.05, yy, 0.2, -0.14, 0.45, 11 + i * 3, 1.25);
	}
	fbox(K, F, K.mats.glass, L0, y, -0.06, L1, y + 0.56, -0.04);
	fbox(K, F, K.mats.glass, L0, y + 0.56, -0.7, L1, y + 0.58, -0.06);
	fbox(K, F, K.mats.panel, L0 + 0.05, y + 0.55, -0.5, L1 - 0.05, y + 0.56, -0.4);
	solid(K, F, L0, -0.75, L1, -0.02, y + 0.58);
}
// the seats along the front windows: a narrow bar at standing height, stools under it (the door
// left clear); from x a to b
function windowBar(K, a, b) {
	const w = K.wall, g = K.g, z = w.z1 - 0.12;
	const runs = [[a, Math.min(b, K.doorX - 1.3)], [Math.max(a, K.doorX + 1.3), b]];
	for (const [x0, x1] of runs) {
		if (x1 - x0 < 1.2) continue;
		g.at(0, 0, 0, 0);
		g.box('grain', x0, 1.02, z - 0.42, x1, 1.06, z, WD.oak);
		for (const x of [x0 + 0.1, x1 - 0.1]) g.box('metal', x - 0.02, 0, z - 0.25, x + 0.02, 1.02, z - 0.21, C.black);
		K.col.push([x0, z - 0.42, x1, z, 0.95, 1.06]);
		for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.62) { item(K, frame('+z', 0), 'barStool', x, z - 0.72, 0.4, 0.4, 0.8, 0, { v: K.sv }); sit(K, x, z - 0.72, 0, 1, 0.78); }
	}
}

// ---------------------------------------------------------------------------------
// the fit-outs

export function* fitDining(K, venue, type) {
	const st = styleOf(venue, type);
	K.sv = K.rnd();                  // (the stools' covers: one leather through the place)
	if (st === 'sitdown' || st === 'pub' || st === 'diner' || st === 'counter') yield* fitRestaurant(K, st, type);
	else if (st === 'pizza' || st === 'quick') yield* fitCounterService(K, st, type);
	else yield* fitCafe(K, st, type);
}

// a place where you sit and are brought what you ordered
function* fitRestaurant(K, st, type) {
	const w = K.wall, g = K.g, r = K.rnd, iw = w.x1 - w.x0, id = w.z1 - w.z0, left = K.doorX < 0;
	const kd = Math.max(2.6, Math.min(4.2, id * 0.27)), kz = w.z0 + kd;
	const warm = st === 'pub' || st === 'counter', top = st === 'diner' ? lin([0.85, 0.82, 0.76]) : st === 'counter' ? WD.pale : WD.walnut;
	const chairCol = st === 'diner' ? RED : st === 'counter' ? WD.oak : WD.walnut;
	const place = st === 'diner' ? 'cafe' : 'dinner';
	// (the kitchen: its door at the end away from where the bar or the counter runs)
	const barSide = left ? 1 : -1;                                     // the bar down the far wall from the door
	yield* kitchen(K, kz, { door: barSide > 0 ? 'left' : 'right', fryers: st === 'diner' || st === 'pub' ? 2 : 1, sign: st === 'diner' ? 'PICK UP' : null });
	yield;
	const z0 = kz + 0.5, z1 = w.z1 - 1.5;
	// the long things down the walls: the bar, the diner's counter, the sushi bar across the room
	let xa = w.x0 + 0.3, xb = w.x1 - 0.3;
	if (st === 'pub' && iw > 7) {
		const line = barSide > 0 ? w.x1 : w.x0;
		bar(K, barSide > 0 ? '-x' : '+x', line, z0 + 0.2, Math.min(z1 - 0.6, z0 + Math.max(4, (z1 - z0) * 0.75)), { shade: lin([0.55, 0.38, 0.12]) });
		// the game on over the bar
		const F = frame(barSide > 0 ? '-x' : '+x', line), [p, q] = F.L(z0 + 0.6, z0 + 1.9);
		use(K, F); g.box('gloss', p, 2.3, 0.0, q, 3.05, 0.06, BLACK); fbox(K, F, K.mats.bigscreen, p + 0.04, 2.34, 0.06, q - 0.04, 3.01, 0.065);
		if (barSide > 0) xb = w.x1 - 2.9; else xa = w.x0 + 2.9;
	} else if (st === 'diner' && iw > 7) {
		// the counter parallel to the far wall, the back counter against it with the coffee, the
		// pie case on the counter, the stools in a row
		const line = barSide > 0 ? w.x1 : w.x0, F = frame(barSide > 0 ? '-x' : '+x', line), [L0, L1] = F.L(z0, Math.min(z1 - 0.4, z0 + (z1 - z0) * 0.8));
		use(K, F);
		g.box('gloss', L0, 0, 0.0, L1, 0.9, 0.6, STEEL); g.box('stone', L0, 0.9, 0.0, L1, 0.94, 0.62, lin([0.85, 0.85, 0.84])); solid(K, F, L0, 0, L1, 0.62, 0.94);
		for (let x = L0 + 0.3; x < L1 - 0.4; x += 0.9) { g.box('metal', x, 0.94, 0.15, x + 0.22, 1.32, 0.42, BLACK); g.cyl('glass', x + 0.11, 0.97, 0.52, 0.07, 0.17, lin([0.25, 0.14, 0.08]), 10); }
		g.box('gloss', L0, 0, 1.25, L1, 1.0, 1.85, CREAM); g.box('gloss', L0, 0.55, 1.85, L1, 0.62, 1.86, RED);
		g.box('stone', L0 - 0.03, 1.0, 1.22, L1 + 0.03, 1.05, 1.9, lin([0.6, 0.62, 0.64]));
		solid(K, F, L0, 1.25, L1, 1.9, 1.05);
		caseOf(K, frame(barSide > 0 ? '-x' : '+x', line + (barSide > 0 ? -1.9 : 1.9)), ...F.L(z0 + 0.4, z0 + 1.6), ['cakes', 'pastry'], 1.05);
		for (let x = L0 + 0.5; x < L1 - 0.3; x += 0.62) { item(K, F, 'barStool', x, 2.3, 0.4, 0.4, 0.8, 0, { v: 0.02 }); const [wx, wz] = F.W(x, 2.3), [ox, oz] = F.W(0, 0), [fx, fz] = F.W(0, -1); sit(K, wx, wz, fx - ox, fz - oz, 0.78); }
		spot(K, F, (L0 + L1) / 2, 0.95, 0, 1, true);
		for (let x = L0 + 0.8; x < L1 - 0.5; x += 1.6) { const [wx, wz] = F.W(x, 1.55); pendant(K, wx, wz, 2.2, RED, 0.2); }
		if (barSide > 0) xb = w.x1 - 3.0; else xa = w.x0 + 3.0;
	} else if (st === 'counter' && id > 9) {
		// across the room before the kitchen: the chefs' counter, its stools along the front
		const cz = kz + 1.9, a = w.x0 + 1.0, b = w.x1 - (iw > 9 ? 2.6 : 1.0), sushi = type === 'sushi';
		const F = frame('+z', cz);
		use(K, F);
		item(K, frame('+z', 0), 'barCounter', (a + b) / 2, cz - 0.3, b - a, 0.6, 1.13, 0, { kind: sushi ? 'sushi' : null, v: 0.6 });
		K.col.push([a, cz - 0.6, b, cz, 0, 1.13]);
		for (let x = a + 0.4; x < b - 0.3; x += 0.62) { item(K, frame('+z', 0), 'barStool', x, cz + 0.45, 0.4, 0.4, 0.8, 0, { v: 0.6 }); sit(K, x, cz + 0.45, 0, -1, 0.78); }
		// behind it the chefs, their boards and bowls; the stockpots on the back counter for a
		// noodle house
		g.at(0, 0, 0, 0);
		for (let x = a + 0.8; x < b - 0.5; x += 1.6) { spot(K, frame('+z', cz - 1.1), x, 0, 0, 1, true); g.box('grain', x - 0.25, 1.13, cz - 0.5, x + 0.25, 1.16, cz - 0.3, WD.pale); }
		if (!sushi) for (let x = a + 0.4; x < b - 0.4; x += 0.7) g.cyl('metal', x, 1.13, cz - 0.45, 0.17, 0.32, STEEL, 12);
		// the paper lanterns over it
		for (let x = a + 0.5; x < b - 0.2; x += 1.2) { g.at(0, 0, 0, 0); g.box('metal', x - 0.004, 2.5, cz - 0.3 - 0.004, x + 0.004, K.ceil ?? K.roof ?? HUNG, cz - 0.3 + 0.004, BLACK); g.sphere('fabric', x, 2.3, cz - 0.3, 0.2, 0.26, 0.2, lin([0.95, 0.88, 0.75]), 10); K.box(K.mats.panel, x - 0.06, 2.24, cz - 0.36, x + 0.06, 2.36, cz - 0.24); }
		// the curtain at the kitchen door
		const dx = barSide > 0 ? w.x0 + 1.1 : w.x1 - 1.1;
		for (let k = 0; k < 3; k++) g.box('fabric', dx - 0.5 + k * 0.34, 1.55, kz + 0.07, dx - 0.18 + k * 0.34, 2.1, kz + 0.09, brandDark(K));
	}
	yield;
	// booths down the wall nearest the door's side (the other side from the bar)
	const bSide = -barSide;
	let bn = 0;
	if (iw > 6.5 && st !== 'counter') { bn = booths(K, bSide, z0 + (st === 'diner' ? 0 : 0.2), z1 - 0.3, { place }); if (bSide < 0) xa = Math.max(xa, w.x0 + 1.5); else xb = Math.min(xb, w.x1 - 1.5); }
	// the host's stand by the door (a sit-down place)
	if (st === 'sitdown') { item(K, frame('+z', 0), 'hostStand', K.doorX + (left ? 1.3 : -1.3), w.z1 - 1.3, 0.6, 0.45, 1.14, 2); K.col.push([K.doorX + (left ? 1.0 : -1.6), w.z1 - 1.55, K.doorX + (left ? 1.6 : -1.0), w.z1 - 1.05, 0, 1.14]); spot(K, frame('+z', w.z1 - 1.75), K.doorX + (left ? 1.3 : -1.3), 0, 0, 1, true); }
	// the tables through the middle: fours in a sit-down place, twos and fours elsewhere, high
	// tops in a pub
	const ta = z0 + (st === 'counter' && id > 9 ? 3.0 : 0.9), tb = z1 - (st === 'sitdown' ? 0.6 : 0.2);
	const pitchX = st === 'sitdown' ? 2.6 : 2.3, pitchZ = st === 'sitdown' ? 2.6 : 2.4;
	const nx = Math.max(1, Math.floor((xb - xa) / pitchX)), nz = Math.max(1, Math.floor((tb - ta) / pitchZ));
	for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
		const x = xa + (i + 0.5) * (xb - xa) / nx, z = ta + (j + 0.5) * (tb - ta) / nz;
		if (Math.abs(x - K.doorX) < 1.3 && z > w.z1 - 3.2) continue;
		const four = st === 'sitdown' ? r() < 0.65 : r() < 0.4, high = st === 'pub' && (i + j) % 2 === 1;
		table(K, x, z, four ? 4 : 2, { top, cloth: st === 'sitdown' && (type === 'bistro' || type === 'seafood' || type === 'pasta'), chair: chairCol, place: high ? null : place, h: high ? 1.05 : undefined });
		if (!high) pendant(K, x, z, 1.75, st === 'counter' ? lin([0.9, 0.85, 0.75]) : brandDark(K), 0.2);
	}
	yield;
	// the walls: pictures, the wine on a rack, the chalk menu; plants by the door
	const sideWall = bSide > 0 ? w.x0 : w.x1, sDir = bSide > 0 ? '+x' : '-x';
	if (st === 'sitdown' && bSide !== 0 && !(st === 'pub')) {
		shelfRun(K, sDir, sideWall + (bSide > 0 ? 0.3 : -0.3), z0 + 0.5, Math.min(z1 - 0.6, z0 + 3.0), { h: 2.0, depth: 0.3, levels: [0.12, 0.5, 0.88, 1.26, 1.64], kinds: () => 'wine', back: WD.walnut, seed: 31 });
	}
	for (let k = 0; k < Math.min(3, bn); k++) art(K, bSide < 0 ? '+x' : '-x', bSide < 0 ? w.x0 : w.x1, z0 + 1.0 + k * 1.95, 1.45, 0.8, 0.6, lin(hsl(r(), 0.35, 0.55)), warm ? WD.walnut : C.black);
	board(K, frame('+z', kz + 0.07), 'menu', MENU[st] ?? 1, w.x0 + 0.5, w.x0 + 1.7, 2.1, 0.45);
	plant(K, left ? K.doorX + 2.2 : K.doorX - 2.2, w.z1 - 0.5, 1.1);
	// the light: low over the tables (above), a few let into the ceiling between
	downlights(K, w.x0 + 0.5, w.x1 - 0.5, kz + 0.4, w.z1 - 0.5, 3.4);
}

// a place where you order at the counter: a pizzeria, a burger, taco or kebab counter
function* fitCounterService(K, st, type) {
	const w = K.wall, g = K.g, s = K.s, r = K.rnd, iw = w.x1 - w.x0, id = w.z1 - w.z0, left = K.doorX < 0;
	const pizza = st === 'pizza', cz = w.z0 + Math.max(2.8, Math.min(4.2, id * 0.3));
	// the line behind the counter, open to the room: the oven or the fryers and the grill
	yield* kitchen(K, cz - 1.2, { open: true, pizza, fryers: pizza ? 0 : 2 });
	yield;
	// the counter across, its registers; the slices under glass on a pizzeria's
	const a = w.x0 + 0.8, b = w.x1 - (iw > 9 ? 2.4 : 0.8);
	counter(K, '+z', cz, a, b, { depth: 0.75, front: K.brand.bg });
	if (iw > 8) counter(K, '+z', cz, Math.min(b - 0.1, a + 2.2), Math.min(b - 0.1, a + 2.21), { depth: 0.75 });
	if (pizza) caseOf(K, frame('+z', cz), b - 1.8, b - 0.2, ['cakes', 'pastry'], 0.98);
	// the lit boards over the counter, hung from the ceiling on rods
	const n = Math.max(1, Math.min(4, Math.floor((b - a) / 1.7))), bw = Math.min(1.6, (b - a) / n - 0.15), by = Math.min(2.35, (K.ceil ?? 3.4) - 1.05);
	for (let k = 0; k < n; k++) {
		const x = a + (k + 0.5) * (b - a) / n, F = frame('+z', cz - 0.9);
		board(K, F, 'menulit', LIT[type] ?? (pizza ? 1 : 0), x - bw / 2, x + bw / 2, by, bw * 0.375, 1.35);
		g.at(0, 0, 0, 0);
		for (const sx of [-1, 1]) g.box('metal', x + sx * (bw / 2 - 0.1) - 0.006, by + bw * 0.375, cz - 0.91, x + sx * (bw / 2 - 0.1) + 0.006, K.ceil ?? HUNG, cz - 0.9, STEEL);
		K.box(K.mats.panel, x - bw / 2 + 0.1, by - 0.08, cz - 0.8, x + bw / 2 - 0.1, by - 0.06, cz - 0.75);
	}
	s.at(0, 0, 0, 0);
	s.sign('ORDER HERE', a + 0.2, a + 1.6, by + bw * 0.375 + 0.12, 0.2, cz - 0.88, K.brand.bg);
	yield;
	// the drinks fountain and the lids and straws, on the customers' side by the counter's end
	{
		const x = b + 0.9, z = cz + 0.6;
		if (x + 0.6 < w.x1) {
			g.at(0, 0, 0, 0);
			g.box('gloss', x - 0.6, 0, z - 0.35, x + 0.6, 0.9, z + 0.35, BLACK);
			g.box('stone', x - 0.62, 0.9, z - 0.37, x + 0.62, 0.94, z + 0.37, lin([0.3, 0.3, 0.32]));
			g.box('gloss', x - 0.5, 0.94, z - 0.35, x + 0.5, 1.75, z - 0.05, K.brand.bg);
			for (let k = 0; k < 6; k++) { g.box('metal', x - 0.42 + k * 0.17, 1.1, z - 0.05, x - 0.32 + k * 0.17, 1.2, z + 0.05, STEEL); g.box('gloss', x - 0.43 + k * 0.17, 1.25, z - 0.05, x - 0.31 + k * 0.17, 1.4, z - 0.04, lin(hsl(k / 6, 0.6, 0.5))); }
			g.box('metal', x - 0.5, 0.94, z - 0.05, x + 0.5, 0.97, z + 0.3, STEEL);
			K.col.push([x - 0.62, z - 0.37, x + 0.62, z + 0.37, 0, 1.75]);
		}
	}
	// the seats: booths down the wall across from the door, two-tops and fours through the room
	const z0 = cz + 1.6, z1 = w.z1 - 1.4, bSide = left ? 1 : -1;
	const bn = iw > 7 ? booths(K, bSide, z0, z1 - 0.2, { place: 'quick', v: 0.3 }) : 0;
	let xa = w.x0 + 0.6, xb = w.x1 - 0.6;
	if (bn) { if (bSide < 0) xa = w.x0 + 1.6; else xb = w.x1 - 1.6; }
	const nx = Math.max(1, Math.floor((xb - xa) / 2.1)), nz = Math.max(1, Math.floor((z1 - z0) / 2.2));
	const seatCol = lin(hsl(r(), 0.5, 0.45));
	for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
		const x = xa + (i + 0.5) * (xb - xa) / nx, z = z0 + (j + 0.5) * (z1 - z0) / nz;
		if (Math.abs(x - K.doorX) < 1.3 && z > w.z1 - 3.2) continue;
		table(K, x, z, r() < 0.4 ? 4 : 2, { top: lin([0.85, 0.83, 0.78]), chair: seatCol, place: (i + j) % 3 ? 'quick' : null });
	}
	// the bin and tray stand by the door
	g.at(0, 0, 0, 0);
	const tx = K.doorX + (left ? 1.5 : -1.5);
	g.box('grain', tx - 0.35, 0, w.z1 - 0.75, tx + 0.35, 1.05, w.z1 - 0.3, lin([0.4, 0.3, 0.22]));
	g.box('gloss', tx - 0.25, 0.75, w.z1 - 0.3, tx + 0.25, 0.85, w.z1 - 0.29, BLACK);
	K.col.push([tx - 0.35, w.z1 - 0.75, tx + 0.35, w.z1 - 0.3, 0, 1.05]);
	strips(K, w.x0 + 0.4, w.x1 - 0.4, cz + 0.4, w.z1 - 0.8);
}

// a café, a bakery, a donut shop, a bubble tea counter, an ice cream parlour
function* fitCafe(K, st, _type) {
	const w = K.wall, g = K.g, s = K.s, r = K.rnd, iw = w.x1 - w.x0, id = w.z1 - w.z0, left = K.doorX < 0;
	const bz = w.z0 + Math.max(2.2, Math.min(3.0, id * 0.26));
	// the back counter against the wall: the espresso machine (or the tea urns, the oven, the
	// dipping cabinet's stock), the shelf of cups and beans over it, the boards above that
	{
		const F = frame('+z', w.z0), a = w.x0 + 0.4, b = w.x1 - 0.4;
		use(K, F);
		g.box('grain', a, 0, 0.0, b, 0.9, 0.62, WD.pale);
		g.box('stone', a - 0.02, 0.9, 0.0, b + 0.02, 0.94, 0.64, lin([0.88, 0.87, 0.85]));
		solid(K, F, a, 0, b, 0.64, 0.94);
		const ex = a + 1.0;
		if (st === 'cafe' || st === 'donut') { const [wx, wz] = F.W(ex, 0.08); espresso(K, wx, 0.94, wz, K.brand.bg); }
		else if (st === 'boba') { g.at(0, 0, 0, 0); for (let k = 0; k < 4; k++) g.cyl('metal', a + 0.5 + k * 0.4, 0.94, w.z0 + 0.3, 0.13, 0.5, STEEL, 12); }
		else if (st === 'bakery') { item(K, F, 'deckOven', ex + 0.2, 0.45, 1.6, 0.9, 1.85, 0); }
		use(K, F);
		// the shelf of cups and bags of beans, the boards over it
		g.box('grain', a + 2.0, 1.45, 0.0, b - 0.2, 1.48, 0.3, WD.oak);
		s.run(st === 'cafe' ? 'beans' : st === 'bakery' ? 'bread' : 'mugs', a + 2.05, b - 0.25, 1.48, 0.3, 0.28, 0.25, 5, 1.0);
		s.run('mugs', a + 2.05, b - 0.25, 0.94, 0.12, 0.55, 0.3, 9, 1.0);
		const nb = Math.max(1, Math.min(3, Math.floor((b - a - 0.4) / 1.6))), by = Math.min(2.0, (K.ceil ?? 3.4) - 1.2);
		for (let k = 0; k < nb; k++) { const x = a + 0.3 + (k + 0.5) * (b - a - 0.6) / nb; const B = BOARDS[st] || [MENU[st] ?? 0]; board(K, F, 'menu', B[k % B.length], x - 0.7, x + 0.7, by, 0.53, 1.05); }
		spot(K, F, ex, 1.0, 0, -1, true);
		// the bakery's bread on racks down the side
		if (st === 'bakery') { item(K, frame(left ? '-x' : '+x', left ? w.x1 : w.x0), 'breadRack', left ? w.z0 + 1.4 : -(w.z0 + 1.4), 0.3, 1.4, 0.5, 1.9, 0); K.col.push(left ? [w.x1 - 0.55, w.z0 + 0.7, w.x1, w.z0 + 2.1, 0, 1.9] : [w.x0, w.z0 + 0.7, w.x0 + 0.55, w.z0 + 2.1, 0, 1.9]); }
	}
	yield;
	// the front counter: the register, the case, the pick-up end
	const a = w.x0 + 0.6, b = w.x1 - (iw > 8 ? 1.6 : 0.6);
	counter(K, '+z', bz, a, b, { depth: 0.75, front: lin([0.4, 0.28, 0.18]), top: lin([0.88, 0.87, 0.85]) });
	const Fc = frame('+z', bz);
	if (st === 'icecream') {
		// the dipping cabinet: glass sloped toward you over the tubs, lit
		const ca = a + 0.2, cb = Math.min(b - 1.2, a + 2.8);
		use(K, Fc);
		g.box('gloss', ca, 0, 0.0, cb, 0.85, 0.75, WHITE);
		s.flat('tubs', ca + 0.05, cb - 0.05, 0.1, 0.65, 0.86, 1, 1.15);
		fbox(K, Fc, K.mats.glass, ca, 0.86, 0.72, cb, 1.25, 0.74);
		fbox(K, Fc, K.mats.panel, ca + 0.1, 1.24, 0.3, cb - 0.1, 1.25, 0.4);
		solid(K, Fc, ca, 0, cb, 0.75, 1.25);
		s.at(0, 0, 0, 0); s.sign('GELATO', ca + 0.3, cb - 0.3, 1.35, 0.2, bz + 0.75, K.brand.bg);
	} else if (st === 'donut') caseOf(K, Fc, a + 0.2, Math.min(b - 1.2, a + 2.6), ['donuts', 'donuts'], 0.98);
	else if (st === 'bakery') caseOf(K, Fc, a + 0.2, Math.min(b - 1.2, a + 3.0), ['pastry', 'cakes'], 0.98);
	else caseOf(K, Fc, b - 1.6, b - 0.2, ['pastry', 'cakes'], 0.98);
	s.at(0, 0, 0, 0);
	if (st === 'cafe') s.sign('PICK UP', b - 1.4, b - 0.4, 1.95, 0.2, bz + 0.02, K.brand.bg);
	for (let x = a + 0.6; x < b - 0.4; x += 1.8) pendant(K, x, bz + 0.35, 2.0, brandDark(K), 0.15);
	yield;
	// the seats: the bar along the window, the round tables, a long table in a big one, a pair of
	// armchairs by the wall
	const z0 = bz + 1.6, z1 = w.z1 - 1.2;
	windowBar(K, w.x0 + 0.3, w.x1 - 0.3);
	// (the room's widths left for the round tables, either side of the long one)
	let runs = [[w.x0 + 0.7, w.x1 - 0.7]];
	if (iw > 9 && z1 - z0 > 3.5 && st === 'cafe') {
		// the communal table down the middle, its stools
		const cx = (w.x0 + w.x1) / 2 + (left ? 1.2 : -1.2), za = z0 + 0.3, zb = Math.min(z1 - 0.5, za + 3.2);
		g.at(0, 0, 0, 0);
		g.box('grain', cx - 0.45, 0.72, za, cx + 0.45, 0.77, zb, WD.oak);
		for (const zz of [za + 0.15, zb - 0.15]) g.box('grain', cx - 0.4, 0, zz - 0.04, cx + 0.4, 0.72, zz + 0.04, WD.oak);
		K.col.push([cx - 0.45, za, cx + 0.45, zb, 0, 0.77]);
		for (let z = za + 0.4; z < zb - 0.2; z += 0.65) for (const sx of [-1, 1]) { chair(K, cx + sx * 0.75, z, -sx, 0, WD.walnut); sit(K, cx + sx * 0.75, z, -sx, 0); if ((z * 7 | 0) % 2) place(K, cx + sx * 0.25, z, -sx, 0, 0.77, 'cafe'); }
		runs = [[w.x0 + 0.7, cx - 1.4], [cx + 1.4, w.x1 - 0.7]];
	}
	// two armchairs and their low table against the far wall
	let lounge = null;
	{
		const sx = left ? w.x1 - 0.6 : w.x0 + 0.6, z = z1 - 0.8;
		if (z - z0 > 1.4) {
			for (const dz of [-0.55, 0.55]) {
				const up = lin(hsl(0.08 + r() * 0.1, 0.4, 0.35)), x = sx;
				g.at(x, 0, z + dz, left ? 3 : 1);
				g.box('fabric', -0.4, 0.15, -0.38, 0.4, 0.45, 0.38, up); g.box('fabric', -0.4, 0.45, -0.38, 0.4, 0.95, -0.22, up);
				for (const s2 of [-1, 1]) g.box('fabric', s2 * 0.4 - (s2 > 0 ? 0.14 : 0), 0.45, -0.38, s2 * 0.4 + (s2 < 0 ? 0.14 : 0), 0.65, 0.38, up);
				g.at(0, 0, 0, 0);
				K.col.push([x - 0.4, z + dz - 0.4, x + 0.4, z + dz + 0.4, 0, 0.65]);
				sit(K, x + (left ? -0.08 : 0.08), z + dz, left ? -1 : 1, 0, 0.45);
			}
			const tx = sx + (left ? -0.85 : 0.85);
			g.cyl('grain', tx, 0, z, 0.3, 0.45, WD.walnut, 14);
			K.col.push([tx - 0.3, z - 0.3, tx + 0.3, z + 0.3, 0, 0.45]);
			lounge = [Math.min(sx, tx) - 0.9, z - 1.4, Math.max(sx, tx) + 0.9, z + 1.4];
		}
	}
	const nz = Math.max(1, Math.floor((z1 - z0) / 1.9));
	for (const [xa, xb] of runs) {
		if (xb - xa < 1.3) continue;
		const nx = Math.max(1, Math.floor((xb - xa) / 1.7));
		for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
			const x = xa + (i + 0.5) * (xb - xa) / nx, z = z0 + (j + 0.5) * (z1 - z0) / nz;
			if (Math.abs(x - K.doorX) < 1.2 && z > w.z1 - 2.6) continue;
			if (lounge && x > lounge[0] && x < lounge[2] && z > lounge[1] && z < lounge[3]) continue;
			table(K, x, z, 2, { round: true, top: st === 'icecream' ? WHITE : WD.oak, chair: st === 'icecream' ? lin(hsl(0.92, 0.5, 0.75)) : WD.walnut, place: (i + j) % 2 ? 'cafe' : null });
		}
	}
	yield;
	// the walls: prints, a plant; the light let into the ceiling
	const sideWall = left ? w.x0 : w.x1, sDir = left ? '+x' : '-x';
	for (let z = z0 + 0.6, k = 0; z < z1 - 0.4 && k < 3; z += 1.9, k++) art(K, sDir, sideWall, z, 1.4, 0.6, 0.75, lin(hsl(r(), 0.4, 0.6)), WD.oak);
	plant(K, left ? w.x0 + 0.5 : w.x1 - 0.5, w.z1 - 0.6, 1.3);
	downlights(K, w.x0 + 0.5, w.x1 - 0.5, bz + 0.8, w.z1 - 0.4, 2.6);
}

// the brand's colour taken darker (lamp shades, a curtain): a café's or a restaurant's own
function brandDark(K) { const [r, g, b] = K.brand.bg; return [r * 0.55, g * 0.55, b * 0.55]; }
