// The insides of the offices, the places to play and the tattoo parlours (bay/commercial.js builds
// the shell), fitted out the way real ones are:
//   an office  - reception by the door, the company's board on the wall behind it, a sofa or two
//                and the water cooler; then the desks in pods of four, each with its chair, its
//                screen at its work (a tech company codes, a firm keeps its books), the meeting
//                room behind glass, the kitchenette with the coffee machine, the fridge, the
//                vending machine and the first-aid box. A clinic or a dentist has its waiting
//                room and its treatment rooms instead of the desks.
//   an arcade  - the video cabinets down one wall under their marquees, the pinball machines down
//                the other, the skee-ball lanes at the back, the claw machines and an air hockey
//                table, the prize counter and its wall of prizes, the change machine
//   the lanes  - the lanes themselves (the approach, the arrows, the gutters, the pins on their
//                deck, the masking over them), the ball returns, the scores overhead, the
//                settees; the shoe counter and its cubbies, the ball racks, the snack bar
//   a cinema   - the lobby: the concession stand (the popcorn machine, the candy case, the
//                drinks, the menus lit over it), the posters of what's showing, the ticket
//                kiosks; then the hall, dark, its rows stepping up toward the back, the screen
//                between its curtains
//   a tattoo parlour - the counter by the door with the portfolios, the flash framed down one
//                wall, the stations down the other: the chair, the artist's stool, the cart with
//                the inks, the lamp on its arm
// And what works: the office's coffee, water, snacks and first aid, the cinema's popcorn and the
// lanes' snack bar are yours too (interiors/office-perks.js reads K.perk's); every pinball
// machine, claw machine, air hockey table, skee-ball lane, dartboard and bowling lane is a game
// to play where it stands (arcade.js reads K.game's).
//
// K is commercial.js's fit (bay/storefit.js says what is in it), and also: screen(x, y, z, w, h,
// tile, yaw) a picture of interiors/screen-atlas.js, board(x, y, z, w, h, yaw) the place's own
// board, flash(x, y, z, w, h, yaw, i) a sheet of tattoo flash, perk(kind, x, z), game(id, x, z,
// r, name), biz.

import { drawAny } from '../interiors/kit.js';
import '../interiors/estab-kit.js';
import { MARQUEES, stripUV } from '../interiors/goods.js';
import { TILE, screenTile } from '../interiors/screen-atlas.js';
import { srgbToLinear as lin } from '../world/srgb.js';
import { strips } from './storefit.js';

const YAW = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const BLACK = lin([0.03, 0.03, 0.035]), DARK = lin([0.09, 0.09, 0.1]), STEEL = lin([0.72, 0.73, 0.75]), WHITE = lin([0.93, 0.93, 0.91]);
const OAK = lin([0.66, 0.5, 0.33]), WALNUT = lin([0.3, 0.2, 0.13]), MAPLE = lin([0.86, 0.68, 0.46]), GREY = lin([0.55, 0.56, 0.58]);
const RED = lin([0.62, 0.06, 0.08]), VELVET = lin([0.42, 0.04, 0.07]), BEIGE = lin([0.8, 0.76, 0.68]);
const PLUSH = [[0.95, 0.75, 0.2], [0.95, 0.45, 0.65], [0.35, 0.7, 0.95], [0.55, 0.85, 0.4], [0.75, 0.55, 0.35], [0.98, 0.98, 0.95], [0.7, 0.45, 0.9], [0.95, 0.35, 0.25]].map(lin);

// what kind of office a business keeps (economy/establishments.js's office types): a tech
// company's or a studio's open floor ('studio'), a firm's desks and its shelves of files ('firm'),
// a clinic's or a dentist's waiting room and treatment rooms ('care')
export const officeKind = (type) => ({ tech: 'studio', agency: 'studio', design: 'studio', clinic: 'care', dental: 'care', hospital: 'care' })[type] || 'firm';
// what is up on its screens (interiors/screen-atlas.js programs)
const PROGRAM = { tech: 'Engineering', design: 'Product studio', agency: 'Product studio', finance: 'Finance', law: 'Client services', insurance: 'Client services', realtor: 'Client services', clinic: 'Client services', dental: 'Client services', hospital: 'Client services' };

// ---------------------------------------------------------------------------------
// a thing's own frame at (x, z) turned rot quarter-turns (as the kit's: its front toward +z,
// standing on y = 0), both builders set to it; w(lx, lz) a point of it in the building's, d(dx,
// dz) a way of it
function at(K, x, z, rot = 0) {
	rot = ((rot % 4) + 4) % 4;
	K.g.at(x, 0, z, rot); K.s.at(x, 0, z, rot);
	const d = (dx, dz) => (rot === 1 ? [dz, -dx] : rot === 2 ? [-dx, -dz] : rot === 3 ? [-dz, dx] : [dx, dz]);
	return { x, z, rot, yaw: YAW[rot], d, w: (lx, lz) => { const [a, b] = d(lx, lz); return [x + a, z + b]; } };
}
// solid from (lx0, lz0) to (lx1, lz1) of a frame, from y0 up to y1
function block(K, T, lx0, lz0, lx1, lz1, y1, y0 = 0) {
	const [ax, az] = T.w(lx0, lz0), [bx, bz] = T.w(lx1, lz1);
	K.col.push([Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), y0, y1]);
}
// a place to stand or sit at (lx, lz) of a frame, facing along its (dx, dz) (h: a seat's height)
function place(K, T, lx, lz, dx, dz, sit = false, staff = false, h = 0) {
	const [x, z] = T.w(lx, lz), [fx, fz] = T.d(dx, dz), q = [x, z, Math.atan2(-fx, -fz), sit];
	if (h) q.push(0, h);
	if (staff) q.staff = true;
	K.seats.push(q);
}
// a picture on a screen in a frame, its middle at (lx, y, lz), facing the frame's +z (back: -z)
function scr(K, T, lx, y, lz, w, h, tile, back = false) { const [x, z] = T.w(lx, lz); K.screen(x, y, z, w, h, tile, T.yaw + (back ? Math.PI : 0)); }
// a box of commercial.js's materials (a lamp, a pane) in a frame
function mbox(K, T, mat, lx0, y0, lz0, lx1, y1, lz1, solid = false) {
	const [ax, az] = T.w(lx0, lz0), [bx, bz] = T.w(lx1, lz1);
	K.box(mat, Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz), solid);
}
// a kit item (interiors/kit.js, estab-kit.js, the house kit) at (lx, lz) of a frame, turned rot
// more; the frame set again after
function put(K, T, type, lx, lz, w, d, h, rot = 0, extra = {}) {
	const [x, z] = T.w(lx, lz);
	drawAny(K.g, { type, x, y: 0, z, w, d, h, rot: (T.rot + rot) % 4, v: K.rnd(), ceil: K.ceil ?? 3.6, ...extra }, K.rnd);
	K.g.at(T.x, 0, T.z, T.rot); K.s.at(T.x, 0, T.z, T.rot);
}
const perk = (K, T, kind, lx, lz) => { const [x, z] = T.w(lx, lz); K.perk(kind, x, z); };
const game = (K, T, id, lx, lz, r, name) => { const [x, z] = T.w(lx, lz); K.game(id, x, z, r, name); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------------
// the pieces (each in its own frame: drawn at the origin, its front toward +z)

// a task chair: the five-star base, the gas lift, the seat, the back, the arms (the sitter faces +z)
function taskChair(g, c) {
	for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4 + 0.3; g.beam('metal', [0, 0.07, 0], [Math.cos(a) * 0.29, 0.05, Math.sin(a) * 0.29], 0.035, 0.03, BLACK); g.box('matte', Math.cos(a) * 0.29 - 0.025, 0, Math.sin(a) * 0.29 - 0.025, Math.cos(a) * 0.29 + 0.025, 0.05, Math.sin(a) * 0.29 + 0.025, BLACK); }
	g.cyl('metal', 0, 0.07, 0, 0.025, 0.33, STEEL, 6);
	g.box('matte', -0.12, 0.38, -0.12, 0.12, 0.42, 0.12, BLACK);
	g.box('fabric', -0.25, 0.42, -0.22, 0.25, 0.5, 0.25, c);
	g.box('metal', -0.03, 0.42, -0.31, 0.03, 0.62, -0.26, BLACK);
	g.box('fabric', -0.23, 0.58, -0.32, 0.23, 1.04, -0.26, c);
	for (const sx of [-1, 1]) { g.box('matte', sx * 0.25 - 0.015, 0.45, -0.05, sx * 0.25 + 0.015, 0.66, -0.01, BLACK); g.box('matte', sx * 0.25 - 0.035, 0.66, -0.12, sx * 0.25 + 0.035, 0.69, 0.12, BLACK); }
}
// a side chair: four legs, a seat, a back (for the meeting table, a guest, the waiting room)
function sideChair(g, c, frame = STEEL) {
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box('metal', sx * 0.2 - 0.012, 0, sz * 0.2 - 0.012, sx * 0.2 + 0.012, 0.45, sz * 0.2 + 0.012, frame);
	g.box('fabric', -0.22, 0.43, -0.22, 0.22, 0.48, 0.22, c);
	g.box('fabric', -0.21, 0.5, -0.24, 0.21, 0.88, -0.2, c);
	for (const sx of [-1, 1]) g.box('metal', sx * 0.2 - 0.012, 0.45, -0.235, sx * 0.2 + 0.012, 0.86, -0.21, frame);
}
// a monitor on its stand (its face toward +z) standing on y, the picture on it
function monitor(K, T, lx, lz, tile, w = 0.58, y = 0.76) {
	const g = K.g, h = w * 0.58, y0 = y + 0.1;
	g.box('gloss', lx - w / 2, y0, lz - 0.025, lx + w / 2, y0 + h, lz, BLACK);
	g.box('metal', lx - 0.03, y, lz - 0.06, lx + 0.03, y0 + 0.02, lz - 0.03, GREY);
	g.box('metal', lx - 0.11, y, lz - 0.14, lx + 0.11, y + 0.01, lz + 0.02, GREY);
	scr(K, T, lx, y0 + h / 2, lz + 0.002, w - 0.03, h - 0.03, tile);
}
// a desk at the frame's origin, its sitter on +z: the top, its legs, the screen at the back (one or
// two), the keyboard and mouse, a mug, papers, now and then a plant; the chair pulled up
function desk(K, T, tile, chair, o = {}) {
	const g = K.g, w = o.w ?? 1.4, D = 0.72;
	g.box('grain', -w / 2, 0.72, -D / 2, w / 2, 0.75, D / 2, o.top || WHITE);
	for (const sx of [-1, 1]) { g.box('metal', sx * (w / 2 - 0.05) - 0.025, 0, -D / 2 + 0.04, sx * (w / 2 - 0.05) + 0.025, 0.72, -D / 2 + 0.09, GREY); g.box('metal', sx * (w / 2 - 0.05) - 0.025, 0, -D / 2 + 0.04, sx * (w / 2 - 0.05) + 0.025, 0.03, D / 2 - 0.04, GREY); }
	g.box('metal', -w / 2 + 0.05, 0.6, -D / 2 + 0.05, w / 2 - 0.05, 0.64, -D / 2 + 0.08, GREY);
	if (o.dual) { monitor(K, T, -0.3, -0.18, tile, 0.52); monitor(K, T, 0.3, -0.18, o.tile2 ?? tile, 0.52); }
	else monitor(K, T, 0, -0.18, tile);
	g.box('matte', -0.22, 0.75, 0.06, 0.22, 0.768, 0.2, DARK);
	g.box('matte', 0.3, 0.75, 0.1, 0.36, 0.765, 0.18, DARK);
	const r = K.rnd();
	g.cyl('gloss', -0.48, 0.75, 0.1, 0.04, 0.095, r < 0.5 ? WHITE : lin([0.15, 0.3, 0.55]), 8);
	g.box('matte', 0.42, 0.75, -0.12, 0.62, 0.762, 0.16, lin([0.95, 0.95, 0.93]));
	if (r > 0.7) { g.cyl('matte', -0.55, 0.75, -0.2, 0.06, 0.1, lin([0.7, 0.42, 0.3]), 8); g.sphere('matte', -0.55, 0.92, -0.2, 0.1, 0.09, 0.1, lin([0.2, 0.42, 0.18]), 6); }
	// (a privacy screen along the back in the company's colour)
	if (o.screen) g.box('fabric', -w / 2, 0.75, -D / 2 - 0.025, w / 2, 1.2, -D / 2 + 0.005, o.screen);
	block(K, T, -w / 2, -D / 2, w / 2, D / 2 - 0.12, 0.76);
	if (chair) {
		const [qx, qz] = T.w(0, 0.62);
		g.at(qx, 0, qz, (T.rot + 2) % 4);
		taskChair(g, chair);
		g.at(T.x, 0, T.z, T.rot);
		place(K, T, 0, 0.62, 0, -1, true);
	}
}
// a pod of four desks back to back, a screen of the company's colour between them
function pod(K, x, z, rot, tile, chair, scrCol, top) {
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
		const T = at(K, x, z, rot), [dx, dz] = T.w(sx * 0.71, sz * 0.36);
		const D = at(K, dx, dz, sz > 0 ? rot : rot + 2);
		desk(K, D, tile(dx, dz), chair, { screen: sz > 0 ? scrCol : null, top, dual: K.rnd() < 0.3 });
	}
}
// a water cooler: its cabinet, the bottle upside down on it, the taps
function cooler(g) {
	g.box('gloss', -0.16, 0, -0.16, 0.16, 0.98, 0.16, WHITE);
	g.box('matte', -0.1, 0.72, 0.16, 0.1, 0.86, 0.17, DARK);
	g.box('gloss', -0.06, 0.78, 0.17, -0.02, 0.81, 0.2, lin([0.1, 0.25, 0.7])); g.box('gloss', 0.02, 0.78, 0.17, 0.06, 0.81, 0.2, lin([0.7, 0.1, 0.1]));
	g.cyl('gloss', 0, 0.98, 0, 0.14, 0.4, lin([0.55, 0.75, 0.9]), 12);
	g.cyl('gloss', 0, 1.38, 0, 0.05, 0.05, lin([0.2, 0.45, 0.8]), 8);
}
// a vending machine: its body in its maker's colour, the glass front with the snacks and drinks
// in their rows (the goods' sheet), the keypad, the slot at the foot
function vending(K, T, col) {
	const g = K.g, s = K.s;
	g.box('gloss', -0.45, 0, -0.42, 0.45, 1.86, 0.4, col);
	g.box('matte', -0.4, 0.62, 0.38, 0.18, 1.78, 0.4, lin([0.05, 0.05, 0.06]));
	['chips', 'candy', 'cancool', 'cookies', 'chips'].forEach((k, i) => {
		const y = 0.66 + i * 0.22;
		g.box('metal', -0.39, y - 0.012, 0.1, 0.17, y, 0.39, STEEL);
		s.run(k, -0.38, 0.16, y, 0.19, 0.37, 0.25, i * 5 + 2, 1.05);
	});
	mbox(K, T, K.mats.screens, -0.4, 0.62, 0.405, 0.18, 1.78, 0.41);
	g.box('gloss', 0.22, 1.0, 0.4, 0.4, 1.5, 0.42, lin([0.12, 0.12, 0.13]));
	for (let i = 0; i < 9; i++) g.box('matte', 0.25 + (i % 3) * 0.05, 1.08 + Math.floor(i / 3) * 0.06, 0.42, 0.29 + (i % 3) * 0.05, 1.12 + Math.floor(i / 3) * 0.06, 0.425, lin([0.75, 0.75, 0.75]));
	g.box('matte', -0.38, 0.12, 0.38, 0.16, 0.42, 0.42, lin([0.08, 0.08, 0.08]));
	block(K, T, -0.45, -0.42, 0.45, 0.42, 1.86);
}
// a filing cabinet, four drawers and their handles
function filing(g, w = 0.46) {
	g.box('metal', -w / 2, 0, -0.3, w / 2, 1.32, 0.3, lin([0.62, 0.63, 0.64]));
	for (let i = 0; i < 4; i++) { g.box('metal', -w / 2 + 0.02, 0.04 + i * 0.32, 0.3, w / 2 - 0.02, 0.32 + i * 0.32, 0.31, lin([0.66, 0.67, 0.68])); g.box('metal', -0.08, 0.26 + i * 0.32, 0.31, 0.08, 0.28 + i * 0.32, 0.33, DARK); }
}
// a printer on its stand
function printer(g) {
	g.box('matte', -0.35, 0, -0.3, 0.35, 0.72, 0.3, lin([0.3, 0.31, 0.33]));
	g.box('matte', -0.33, 0.72, -0.28, 0.33, 1.02, 0.28, lin([0.85, 0.85, 0.84]));
	g.box('matte', -0.2, 1.02, -0.2, 0.2, 1.06, 0.2, lin([0.6, 0.61, 0.62]));
	g.box('matte', -0.24, 0.8, 0.28, 0.24, 0.84, 0.42, WHITE);
	g.box('gloss', 0.12, 1.02, 0.18, 0.3, 1.04, 0.26, BLACK);
}
// a shelf against a wall (its back at z = 0, toward +z): levels of binders, or of books
function binderShelf(K, w, kind = 'binders', seed = 1) {
	const g = K.g, s = K.s;
	g.box('grain', -w / 2, 0, 0, w / 2, 1.9, 0.34, OAK);
	for (let y = 0.08; y < 1.85; y += 0.43) {
		g.box('grain', -w / 2 + 0.02, y, 0.01, w / 2 - 0.02, y + 0.025, 0.33, OAK.map((c) => c * 0.85));
		if (y > 0.1) s.run(kind, -w / 2 + 0.04, w / 2 - 0.04, y + 0.025, 0.36, 0.3, 0.24, seed + y * 7, 0.95);
	}
}
// a framed picture or certificate on a wall (its back at z = 0): the frame, the goods' sheet's picture
function framed(K, kind, n, j, parts, w, h, y, frameCol = BLACK) {
	K.g.box('grain', -w / 2 - 0.03, y - 0.03, 0, w / 2 + 0.03, y + h + 0.03, 0.025, frameCol);
	K.s.card(kind, n, j, parts, -w / 2, w / 2, y, h, 0.027, 1.05);
}

// ---------------------------------------------------------------------------------
// an office
function* fitOffice(K, biz) {
	const w = K.wall, g = K.g, type = biz?.type || 'tech', kind = officeKind(type), care = kind === 'care', prog = PROGRAM[type] || 'Coworking', b = K.brand;
	const seed = Math.floor(K.rnd() * 1000), tile = (x, z) => screenTile(prog, x, z, seed);
	const chairCol = lin(kind === 'studio' ? [0.12, 0.13, 0.15] : care ? [0.2, 0.32, 0.42] : [0.1, 0.1, 0.11]);
	const top = kind === 'firm' ? WALNUT.map((c) => c * 1.5) : WHITE, wood = top === WHITE ? OAK : top;
	const W = w.x1 - w.x0, front = w.z1, deep = front - w.z0, side = K.doorX > (w.x0 + w.x1) / 2 ? -1 : 1, ph = K.ceil ?? 2.75;
	// (the board's colour, muted, for the desks' screens)
	const scrCol = b.bg.map((c) => c * 0.8 + 0.04);
	// ---- reception: the desk facing the door, the company's board on a wall behind it
	const rx = clamp(K.doorX + side * 1.6, w.x0 + 1.8, w.x1 - 1.8), rz = front - 3.4;
	{
		const T = at(K, rx, rz, 0);
		g.box('grain', -1.1, 0, -0.35, 1.1, 1.08, 0.35, wood);
		g.box('gloss', -1.12, 0.3, 0.35, 1.12, 0.36, 0.37, b.bg);
		g.box('stone', -1.15, 1.08, 0.05, 1.15, 1.12, 0.42, lin([0.9, 0.89, 0.86]));
		g.box('grain', -1.1, 0.72, -0.75, 1.1, 0.76, -0.35, wood);
		block(K, T, -1.15, -0.75, 1.15, 0.42, 1.12);
		// (the receptionist's screen turned to them, their chair; someone at the desk)
		monitor(K, at(K, ...T.w(-0.4, -0.5), 2), 0, 0, TILE.calendar, 0.5);
		at(K, rx, rz - 1.05, 0); taskChair(g, chairCol);
		at(K, rx, rz, 0);
		place(K, T, 0, -1.05, 0, 1, false, true);
		place(K, T, 0.4, 0.95, 0, -1);
		// (the wall behind, the board on it, a light over it, a plant beside it)
		const zb = -1.9;
		g.box('grain', -1.8, 0, zb - 0.12, 1.8, 2.75, zb, kind === 'studio' ? lin([0.24, 0.25, 0.27]) : care ? lin([0.82, 0.84, 0.85]) : WALNUT);
		const [bx, bz] = T.w(0, zb + 0.004);
		K.board(bx, 1.9, bz, 2.6, 0.65, 0);
		mbox(K, T, K.mats.panel, -1.4, 2.62, zb + 0.02, 1.4, 2.66, zb + 0.12);
		block(K, T, -1.8, zb - 0.12, 1.8, zb, 2.75);
		const [px, pz] = T.w(-1.6 * side, zb + 0.5);
		put(K, at(K, px, pz, 0), 'plant', 0, 0, 0.5, 0.5, 1.3);
	}
	// the lobby on the other side of the door: armchairs about a low table with the magazines on
	// it (a clinic's rows of chairs turned to the desk), the water cooler by the wall
	{
		const lx = clamp(K.doorX - side * 2.6, w.x0 + 1.7, w.x1 - 1.7), lz = front - 3.0;
		if (Math.abs(lx - rx) > 3 && care) {
			const T = at(K, lx, lz, side > 0 ? 1 : 3), n = 4;
			for (const r of [0, -1.1]) {
				put(K, T, 'waitingChairs', 0, r, n * 0.55, 0.5, 0.9);
				block(K, T, -n * 0.28, r - 0.25, n * 0.28, r + 0.22, 0.5);
				for (let i = 0; i < n; i++) if (K.rnd() < 0.7) place(K, T, -n * 0.275 + (i + 0.5) * 0.55, r, 0, 1, true);
			}
		} else if (Math.abs(lx - rx) > 3) {
			const T = at(K, lx, lz, 0);
			put(K, T, 'armchair', -0.85, 0, 0.8, 0.8, 0.82, 1);
			put(K, T, 'armchair', 0.85, 0, 0.8, 0.8, 0.82, 3);
			g.box('grain', -0.35, 0.38, -0.3, 0.35, 0.42, 0.3, WALNUT); g.box('metal', -0.3, 0, -0.25, 0.3, 0.38, 0.25, BLACK);
			for (let i = 0; i < 3; i++) K.s.stack('covers', i, i, 4, -0.28 + i * 0.18, -0.12, -0.14 + i * 0.18, 0.08, 0.42, 0.43 + i * 0.006, BEIGE, 1.0);
			block(K, T, -1.25, -0.4, 1.25, 0.4, 0.8);
			place(K, T, -0.85, 0, 1, 0, true); place(K, T, 0.85, 0, -1, 0, true);
		}
		const cx = side > 0 ? w.x0 + 0.3 : w.x1 - 0.3, T = at(K, cx, front - 4.7, side > 0 ? 1 : 3);
		cooler(g); block(K, T, -0.17, -0.17, 0.17, 0.17, 1.4); perk(K, T, 'water', 0, 0.5);
		// (a clinic's vending machine is out here too: its kitchen is the staff's)
		if (care) {
			const V = at(K, side > 0 ? w.x0 + 0.45 : w.x1 - 0.45, front - 5.75, T.rot);
			vending(K, V, lin([0.08, 0.2, 0.55])); perk(K, V, 'vending', 0, 1.0);
		}
	}
	yield;
	// ---- the back: the meeting room behind glass on one side, the kitchenette on the other
	const roomD = !care && deep > 13 && W > 9 ? 3.6 : 0, back = w.z0 + roomD, mw = roomD ? Math.min(6, W * 0.45) : 0;
	if (roomD) {
		const mx0 = side > 0 ? w.x0 : w.x1 - mw, mx1 = mx0 + mw, mz = back;
		// (the glass front and its door, the wall at its end)
		g.at(0, 0, 0, 0); K.s.at(0, 0, 0, 0);
		const dx = (mx0 + mx1) / 2 + 1.2;
		for (const [a0, a1] of [[mx0, dx - 0.5], [dx + 0.5, mx1]]) { K.box(K.mats.glass, a0, 0, mz - 0.03, a1, ph - 0.05, mz, true); g.box('metal', a0, 0, mz - 0.05, a1, 0.05, mz + 0.02, BLACK); g.box('metal', a0, ph - 0.1, mz - 0.05, a1, ph, mz + 0.02, BLACK); }
		g.box('metal', dx - 0.55, 0, mz - 0.05, dx - 0.5, ph, mz + 0.02, BLACK); g.box('metal', dx + 0.5, 0, mz - 0.05, dx + 0.55, ph, mz + 0.02, BLACK);
		g.box('metal', dx - 0.5, 2.1, mz - 0.05, dx + 0.5, ph, mz + 0.02, BLACK);
		const end = side > 0 ? mx1 : mx0;
		g.box('paint', end - 0.06, 0, w.z0, end + 0.06, ph, mz, lin([0.88, 0.88, 0.86])); K.col.push([end - 0.06, w.z0, end + 0.06, mz, 0, ph]);
		// (the table, its chairs)
		const cx = (mx0 + mx1) / 2, cz = (w.z0 + mz) / 2 + 0.2, tw = Math.min(3.2, mw - 2), T = at(K, cx, cz, 0);
		g.box('grain', -tw / 2, 0.72, -0.55, tw / 2, 0.76, 0.55, WALNUT); g.box('metal', -tw / 2 + 0.3, 0, -0.08, tw / 2 - 0.3, 0.72, 0.08, BLACK);
		block(K, T, -tw / 2, -0.55, tw / 2, 0.55, 0.76);
		const n = Math.max(2, Math.floor(tw / 0.75));
		for (let i = 0; i < n; i++) for (const sz of [-1, 1]) {
			const x = -tw / 2 + (i + 0.5) * tw / n, [qx, qz] = T.w(x, sz * 0.85);
			g.at(qx, 0, qz, sz > 0 ? 2 : 0); taskChair(g, chairCol); g.at(cx, 0, cz, 0);
			place(K, T, x, sz * 0.85, 0, -sz, true);
		}
		// (the screen on its back wall with the meeting on it, the credenza under it)
		const S = at(K, cx, w.z0, 0);
		g.box('gloss', -0.9, 1.05, 0, 0.9, 2.08, 0.05, BLACK);
		scr(K, S, 0, 1.565, 0.052, 1.74, 0.97, kind === 'studio' ? TILE.call : TILE.slides);
		g.box('matte', -1.2, 0, 0, 1.2, 0.6, 0.4, WALNUT); block(K, S, -1.2, 0, 1.2, 0.4, 0.6);
		yield;
	}
	// the kitchenette along the back wall from the far corner: the vending machine, the coffee
	// point (its first-aid box on the wall over it), the fridge, then the printer and the files
	if (!care) {
		const q = side > 0 ? -1 : 1, ex = side > 0 ? w.x1 : w.x0, room = W - mw - (mw ? 0.6 : 0.3);
		const V = at(K, ex + q * 0.55, w.z0 + 0.45, 0);
		vending(K, V, lin(kind === 'studio' ? [0.75, 0.08, 0.1] : [0.08, 0.2, 0.55]));
		perk(K, V, 'vending', 0, 1.0);
		const T = at(K, ex, w.z0, 0);
		put(K, T, 'coffeeBar', q * 2.1, 0.4, 1.9, 0.6, 0.92);
		block(K, T, q * 1.15, 0, q * 3.05, 0.72, 0.92);
		perk(K, T, 'coffee', q * 2.1 - 0.57, 1.1); perk(K, T, 'firstaid', q * 2.1 + 0.5, 1.1);
		place(K, T, q * 2.1 - 0.4, 1.25, 0, -1);
		if (room > 4.2) { put(K, T, 'fridge', q * 3.56, 0.38, 0.72, 0.68, 1.8, 0, { ceil: 2.4 }); block(K, T, q * 3.2, 0, q * 3.92, 0.72, 1.8); }
		if (room > 5.1) { const P = at(K, ex + q * 4.55, w.z0 + 0.32, 0); printer(g); block(K, P, -0.35, -0.3, 0.35, 0.42, 1.06); }
		if (room > 6.3) for (let i = 0; i < 2; i++) { const F = at(K, ex + q * (5.38 + i * 0.51), w.z0 + 0.3, 0); filing(g); block(K, F, -0.23, -0.3, 0.23, 0.33, 1.32); }
		yield;
	}
	// ---- the floor between: desks in pods of four (a clinic's treatment rooms instead)
	const z0 = back + (roomD ? 1.6 : 3.4), z1 = front - 5.8;
	if (care) yield* careRooms(K, w, z1, chairCol, side);
	else if (z1 - z0 > 2.6) {
		const px0 = w.x0 + 2.8, px1 = w.x1 - 2.8, cols = px1 > px0 ? Math.floor((px1 - px0) / 3.9) + 1 : W > 4.6 ? 1 : 0, rows = Math.max(1, Math.floor((z1 - z0) / 3.6));
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const x = cols === 1 ? (w.x0 + w.x1) / 2 : px0 + c * (px1 - px0) / (cols - 1), z = z1 - 1.5 - r * 3.6;
				pod(K, x, z, 0, tile, chairCol, scrCol, top);
				yield;
			}
		}
	}
	// ---- the walls: a whiteboard (a studio's) or shelves of binders (a firm's) down one, the
	// screens of what the company is up to or its certificates down the other; the plants
	if (!care && z1 - z0 > 2) {
		const wx = side > 0 ? w.x0 : w.x1, zc = (z0 + z1) / 2, len = Math.min(5, z1 - z0), T = at(K, wx, zc, side > 0 ? 1 : 3);
		if (kind === 'studio') { put(K, T, 'mobileBoard', 0, 0.45, 2.0, 0.6, 2.0); block(K, T, -1, 0.15, 1, 0.75, 2); }
		else for (let i = 0; i < Math.floor(len / 1.1); i++) { const B = at(K, ...T.w(-len / 2 + 0.55 + i * 1.1, 0), T.rot); binderShelf(K, 1.0, 'binders', i * 3 + seed); block(K, B, -0.5, 0, 0.5, 0.34, 1.9); }
		const O = at(K, side > 0 ? w.x1 : w.x0, zc, side > 0 ? 3 : 1);
		for (let i = -1; i <= 1; i++) {
			if (Math.abs(i * 2.2) > len / 2 + 0.3) continue;
			const F = at(K, ...O.w(i * 2.2, 0), O.rot);
			if (kind === 'studio') { g.box('gloss', -0.62, 1.2, 0, 0.62, 1.92, 0.05, BLACK); scr(K, F, 0, 1.56, 0.052, 1.18, 0.66, [TILE.dashboard, TILE.kanban, TILE.bars][i + 1]); }
			else framed(K, 'certs', 0, (i + 1) % 4, 4, 0.36, 0.5, 1.45, WALNUT);
		}
	} else if (care) {
		// (a clinic's certificates by its desk)
		const O = at(K, side > 0 ? w.x1 : w.x0, front - 3.4, side > 0 ? 3 : 1);
		for (let i = -1; i <= 1; i++) { at(K, ...O.w(i * 0.6, 0), O.rot); framed(K, 'certs', 0, (i + 1) % 4, 4, 0.36, 0.5, 1.45, WALNUT); }
	}
	yield;
	for (const x of [w.x0 + 0.45, w.x1 - 0.45]) put(K, at(K, x, front - 0.6, 0), 'plant', 0, 0, 0.5, 0.5, 1.4);
}
// a clinic's or a dentist's treatment rooms: a row of them along the back wall, and where it is
// deep enough a second row in front of the corridor to them, its doors on the waiting room
// (one room's width left open at its end, the way through); each behind its partition with its
// door: the exam table or the dental chair, the stool, the cabinet with its sink, the screen
function* careRooms(K, w, z1, chairCol, side) {
	const g = K.g, dental = K.biz?.type === 'dental', W = w.x1 - w.x0, n = Math.max(1, Math.floor((W - 0.2) / 3.1)), rw = (W - 0.2) / n;
	const wallCol = lin([0.9, 0.9, 0.88]), ph = K.ceil ?? 2.7;
	const wall = (x0, z0, x1, z1, y0 = 0) => { g.at(0, 0, 0, 0); g.box('paint', x0, y0, z0, x1, ph, z1, wallCol); if (!y0) K.col.push([x0, z0, x1, z1, 0, ph]); };
	// a row of them from zb (the wall behind: the building's, or a partition) to zd (their doors),
	// but for the skip-th
	function* row(zb, zd, partition, skip = -1) {
		const f = zd > zb ? 1 : -1, d = Math.abs(zd - zb);
		for (let i = 0; i < n; i++) {
			const x0 = w.x0 + 0.1 + i * rw, x1 = x0 + rw, cx = (x0 + x1) / 2;
			if (i < n - 1) wall(x1 - 0.05, Math.min(zb, zd), x1 + 0.05, Math.max(zb, zd));
			if (i === skip) continue;
			wall(x0, zd - 0.05, cx - 0.5, zd + 0.05); wall(cx + 0.5, zd - 0.05, x1, zd + 0.05); wall(cx - 0.5, zd - 0.05, cx + 0.5, zd + 0.05, 2.1);
			if (partition) wall(x0, zb - 0.05, x1, zb + 0.05);
			// (in the room's own frame: its back at z = 0, its door at z = d)
			const T = at(K, cx, zb + f * 0.05, f > 0 ? 0 : 2), m = d / 2;
			if (dental) put(K, T, 'dentalChair', -0.3, m, 0.8, 1.8, 1.2);
			else put(K, T, 'examTable', -0.3, m, 0.7, 1.8, 0.75);
			block(K, T, -0.7, m - 0.9, 0.1, m + 0.9, 0.8);
			at(K, ...T.w(0.55, m + 0.2), (T.rot + 3) % 4); sideChair(g, chairCol, BLACK);
			at(K, cx, zb + f * 0.05, T.rot);
			place(K, T, 0.55, m + 0.2, -1, 0, true, true);
			if (K.rnd() < 0.6) place(K, T, -0.3, m, 0, 1, true, false, dental ? 0.52 : 0.76);
			// (the cabinet and its sink along the back, the screen over the counter)
			g.box('grain', -1.3, 0, 0, -0.1, 0.9, 0.55, WHITE); g.box('stone', -1.32, 0.9, 0, -0.08, 0.94, 0.58, lin([0.85, 0.85, 0.84]));
			g.box('metal', -0.95, 0.85, 0.15, -0.55, 0.95, 0.45, STEEL); g.cyl('metal', -0.75, 0.94, 0.08, 0.012, 0.25, STEEL, 6);
			block(K, T, -1.3, 0, -0.1, 0.58, 0.94);
			g.box('gloss', 0.3, 1.3, 0, 1.2, 1.85, 0.04, BLACK); scr(K, T, 0.75, 1.575, 0.042, 0.86, 0.5, dental ? TILE.photo : TILE.calendar);
			yield;
		}
	}
	yield* row(w.z0, w.z0 + 3.0, false);
	if (n > 1 && z1 - (w.z0 + 7.8) > 0.6) yield* row(w.z0 + 4.8, w.z0 + 7.8, true, side > 0 ? n - 1 : 0);
}

// ---------------------------------------------------------------------------------
// the arcade's machines (each in its frame, the player standing on +z)

// a video cabinet: the body in its game's colours, the side art, the marquee lit over the screen,
// the screen, the control panel and its stick and buttons, the coin door
function cabinet(K, T, m, tile) {
	const g = K.g, [, a, b2] = MARQUEES[m], ca = hexLin(a), cb = hexLin(b2);
	g.box('gloss', -0.36, 0, -0.42, 0.36, 1.92, 0.12, BLACK);
	for (const sx of [-1, 1]) { g.box('gloss', sx * 0.36 - 0.012, 0, -0.42, sx * 0.36 + 0.012, 1.92, 0.14, ca); g.box('gloss', sx * 0.36 - 0.013, 0.9, -0.3, sx * 0.36 + 0.013, 1.5, 0.0, cb); }
	g.box('gloss', -0.36, 0, 0.12, 0.36, 0.86, 0.3, BLACK);
	g.beam('gloss', [-0.36, 0.95, 0.32], [0.36, 0.95, 0.32], 0.05, 0.36, DARK);
	g.box('matte', -0.35, 0.86, 0.12, 0.35, 0.96, 0.34, DARK);
	g.cyl('gloss', -0.12, 0.96, 0.2, 0.012, 0.07, BLACK, 6); g.sphere('gloss', -0.12, 1.04, 0.2, 0.025, 0.025, 0.025, lin([0.8, 0.05, 0.05]), 6);
	for (let k = 0; k < 4; k++) g.cyl('gloss', 0.02 + (k % 2) * 0.08 + Math.floor(k / 2) * 0.03, 0.96, 0.16 + Math.floor(k / 2) * 0.07, 0.02, 0.012, [lin([0.9, 0.1, 0.1]), lin([0.1, 0.3, 0.9]), lin([0.95, 0.8, 0.1]), lin([0.1, 0.7, 0.2])][k], 8);
	g.box('metal', -0.1, 0.32, 0.3, 0.1, 0.6, 0.31, STEEL);
	g.box('bulb', -0.06, 0.48, 0.31, -0.02, 0.52, 0.315, lin([1, 0.3, 0.1])); g.box('bulb', 0.02, 0.48, 0.31, 0.06, 0.52, 0.315, lin([1, 0.3, 0.1]));
	g.box('gloss', -0.33, 1.02, 0.0, 0.33, 1.6, 0.1, BLACK);
	scr(K, T, 0, 1.31, 0.102, 0.5, 0.4, tile);
	marquee(K, m, -0.34, 0.34, 1.66, 0.22, 0.125);
	block(K, T, -0.37, -0.42, 0.37, 0.34, 1.92);
}
// a marquee of the arcade's machines (the goods' sheet, six to a strip), lit, from x0 to x1 at z
function marquee(K, m, x0, x1, y, h, z) {
	K.g.box('gloss', x0 - 0.02, y - 0.02, z - 0.02, x1 + 0.02, y + h + 0.02, z, BLACK);
	const i = m % 6;
	K.s.sub('marquee', Math.floor(m / 6), (i % 2) / 2, Math.floor(i / 2) / 3, (i % 2) / 2 + 0.5, Math.floor(i / 2) / 3 + 1 / 3, x0, x1, y, h, z + 0.002, 1.35);
}
const hexLin = (h) => { const n = parseInt(h.slice(1), 16); return lin([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]); };
// a pinball machine: the legs, the cabinet sloping up away from you, the glass over the playfield,
// the backbox standing at the far end with its lit art
function pinball(K, T, m) {
	const g = K.g, [, a, b2] = MARQUEES[m], ca = hexLin(a), cb = hexLin(b2), chrome = lin([0.8, 0.81, 0.83]);
	for (const sx of [-1, 1]) for (const z of [0.5, -0.6]) g.box('metal', sx * 0.32 - 0.025, 0, z - 0.025, sx * 0.32 + 0.025, z > 0 ? 0.82 : 0.94, z + 0.025, chrome);
	// (the cabinet, its sides in the game's colours, the rails along its top)
	g.beam('gloss', [0, 0.99, 0.55], [0, 1.11, -0.65], 0.72, 0.36, BLACK);
	for (const sx of [-1, 1]) {
		g.beam('gloss', [sx * 0.362, 0.99, 0.55], [sx * 0.362, 1.11, -0.65], 0.006, 0.34, ca);
		g.beam('gloss', [sx * 0.364, 1.05, 0.3], [sx * 0.364, 1.12, -0.4], 0.006, 0.12, cb);
		g.beam('metal', [sx * 0.35, 1.19, 0.55], [sx * 0.35, 1.31, -0.65], 0.04, 0.04, chrome);
	}
	// (the playfield under its glass: the game's art, lit; the lockdown bar, the flipper buttons,
	// the plunger, the coin door)
	slab(K, 'marquee', m, -0.33, 0.33, 1.175, 0.53, 1.295, -0.63, 1.25);
	g.box('metal', -0.36, 1.15, 0.53, 0.36, 1.2, 0.6, chrome);
	for (const sx of [-1, 1]) g.cyl('gloss', sx > 0 ? 0.36 : -0.39, 1.06, 0.42, 0.018, 0.03, lin([0.95, 0.85, 0.1]), 8, 'x');
	g.cyl('metal', 0.26, 1.0, 0.55, 0.012, 0.12, chrome, 6, 'z'); g.cyl('gloss', 0.26, 1.0, 0.67, 0.022, 0.04, BLACK, 8, 'z');
	g.box('metal', -0.16, 0.84, 0.55, 0.16, 1.06, 0.565, STEEL);
	g.box('bulb', -0.1, 0.95, 0.565, -0.06, 0.99, 0.57, lin([1, 0.3, 0.1])); g.box('bulb', 0.06, 0.95, 0.565, 0.1, 0.99, 0.57, lin([1, 0.3, 0.1]));
	// (the backbox at the far end, its art lit, its sides in the game's colour)
	g.box('gloss', -0.36, 1.2, -0.8, 0.36, 2.0, -0.6, BLACK);
	for (const sx of [-1, 1]) g.box('gloss', sx * 0.362 - 0.004, 1.2, -0.8, sx * 0.362 + 0.004, 2.0, -0.6, ca);
	marquee(K, m, -0.32, 0.32, 1.3, 0.62, -0.598);
	block(K, T, -0.37, -0.8, 0.37, 0.6, 2.0);
}
// a part of the goods' sheet's picture laid on a slope (a pinball's playfield): from x0 to x1,
// from its foot (yf, zf) up to its head (yb, zb), the m-th marquee's art
function slab(K, kind, m, x0, x1, yf, zf, yb, zb, k = 1) {
	const [u0, v0, u1, v1] = stripUV(kind, Math.floor(m / 6)), i = m % 6, du = (u1 - u0) / 2, dv = (v1 - v0) / 3;
	const ua = u0 + (i % 2) * du, vt = v1 - Math.floor(i / 2) * dv;
	K.s.quad([x0, yf, zf], [x1, yf, zf], [x1, yb, zb], [x0, yb, zb], [ua, vt - dv, ua + du, vt], k);
}
// a claw machine: the cabinet, the glass box with the prizes heaped in it (the goods' toys), the
// claw on its gantry, the lit top
function claw(K, T, m) {
	const g = K.g, s = K.s, [, a] = MARQUEES[m], ca = hexLin(a);
	g.box('gloss', -0.45, 0, -0.45, 0.45, 0.85, 0.45, ca);
	g.box('matte', -0.42, 0.85, -0.42, 0.42, 0.88, 0.42, lin([0.85, 0.85, 0.85]));
	for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box('metal', sx * 0.44 - 0.02, 0.85, sz * 0.44 - 0.02, sx * 0.44 + 0.02, 1.9, sz * 0.44 + 0.02, STEEL);
	// (the plush heaped in it, a few boxed prizes among them)
	for (let k = 0; k < 16; k++) {
		const q = (n) => (Math.sin((k + 1) * 12.9898 + n * 78.233 + m * 3.1) * 43758.5453) % 1, px = (Math.abs(q(1)) - 0.5) * 0.7, pz = (Math.abs(q(2)) - 0.5) * 0.7, r = 0.07 + Math.abs(q(3)) * 0.05;
		g.sphere('fabric', px, 0.88 + r * 0.8 + (k > 9 ? 0.09 : 0), pz, r, r * 0.9, r, PLUSH[k % PLUSH.length], 8);
	}
	s.at(T.x, 0, T.z, T.rot); s.run('toys', -0.38, -0.02, 0.88, 0.16, 0.4, 0.12, m, 1.0);
	K.box(K.mats.glass, ...glassBox(T, -0.44, 0.88, -0.44, 0.44, 1.9, 0.44));
	g.box('metal', -0.42, 1.78, -0.02, 0.42, 1.8, 0.02, STEEL); g.cyl('metal', 0.05, 1.5, 0.05, 0.006, 0.28, STEEL, 4);
	for (let k = 0; k < 3; k++) { const ang = k * 2.1; g.beam('metal', [0.05, 1.5, 0.05], [0.05 + Math.cos(ang) * 0.07, 1.4, 0.05 + Math.sin(ang) * 0.07], 0.012, 0.012, STEEL); }
	marquee(K, m, -0.42, 0.42, 1.9, 0.26, 0.45);
	g.box('gloss', -0.45, 1.9, -0.45, 0.45, 2.18, 0.44, ca);
	g.box('matte', -0.3, 0.85, 0.45, 0.3, 0.95, 0.6, DARK); g.cyl('gloss', -0.1, 0.95, 0.52, 0.012, 0.07, BLACK, 6); g.sphere('gloss', -0.1, 1.03, 0.52, 0.025, 0.025, 0.025, lin([0.9, 0.1, 0.1]), 6); g.cyl('gloss', 0.12, 0.95, 0.52, 0.035, 0.02, lin([0.1, 0.8, 0.2]), 8);
	block(K, T, -0.46, -0.46, 0.46, 0.6, 2.18);
}
// a box in a frame, as the building's box corners
function glassBox(T, lx0, y0, lz0, lx1, y1, lz1) {
	const [ax, az] = T.w(lx0, lz0), [bx, bz] = T.w(lx1, lz1);
	return [Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz)];
}
// an air hockey table: the deck with its holes' sheen, the rails, the goals, the scores over it
function airHockey(K, T) {
	const g = K.g;
	g.box('gloss', -0.65, 0, -1.1, 0.65, 0.72, 1.1, BLACK);
	g.box('gloss', -0.62, 0.72, -1.07, 0.62, 0.76, 1.07, lin([0.85, 0.88, 0.92]));
	g.box('matte', -0.62, 0.761, -0.005, 0.62, 0.763, 0.005, lin([0.85, 0.1, 0.1]));
	g.cyl('matte', 0, 0.761, 0, 0.18, 0.002, lin([0.85, 0.1, 0.1]), 16);
	for (const sx of [-1, 1]) g.box('gloss', sx * 0.65 - 0.03, 0.72, -1.1, sx * 0.65 + 0.03, 0.82, 1.1, lin([0.1, 0.3, 0.8]));
	for (const sz of [-1, 1]) { g.box('gloss', -0.65, 0.72, sz * 1.1 - 0.03, -0.18, 0.82, sz * 1.1 + 0.03, lin([0.1, 0.3, 0.8])); g.box('gloss', 0.18, 0.72, sz * 1.1 - 0.03, 0.65, 0.82, sz * 1.1 + 0.03, lin([0.1, 0.3, 0.8])); }
	for (const sz of [-1, 1]) { g.cyl('gloss', 0, 0.76, sz * 0.75, 0.05, 0.06, sz > 0 ? lin([0.9, 0.1, 0.1]) : lin([0.1, 0.2, 0.9]), 10); }
	g.cyl('gloss', 0.2, 0.76, 0.3, 0.035, 0.008, lin([0.95, 0.85, 0.1]), 10);
	block(K, T, -0.68, -1.12, 0.68, 1.12, 0.82);
}
// a skee-ball lane: the ramp rising away from you, the rings and their holes at the top, the
// cage over them, the score lit over it, the balls waiting at the foot
function skee(K, T) {
	const g = K.g;
	g.box('grain', -0.4, 0, 0.0, 0.4, 0.62, 0.7, WALNUT);
	g.beam('matte', [0, 0.62, 0.65], [0, 1.0, -2.0], 0.66, 0.02, lin([0.12, 0.45, 0.25]));
	for (const sx of [-1, 1]) g.beam('gloss', [sx * 0.39, 0.62, 0.7], [sx * 0.39, 1.12, -2.0], 0.04, 0.22, lin([0.9, 0.75, 0.1]));
	g.box('grain', -0.42, 0, -2.6, 0.42, 1.0, -1.9, WALNUT);
	g.beam('gloss', [0, 1.02, -1.92], [0, 1.6, -2.55], 0.78, 0.04, lin([0.08, 0.08, 0.1]));
	for (const [r, y, z] of [[0.3, 1.18, -2.15], [0.2, 1.3, -2.3], [0.1, 1.42, -2.42]]) g.cyl('gloss', 0, y, z, r, 0.03, lin([0.9, 0.85, 0.2]).map((c, i) => (r === 0.2 ? [0.9, 0.2, 0.2][i] : c)), 16);
	// (the cage: thin posts and rails over the rings, wires between them)
	for (const sx of [-1, 1]) {
		for (const z of [-2.58, -1.9]) g.box('metal', sx * 0.42 - 0.012, 1.0, z - 0.012, sx * 0.42 + 0.012, 1.95, z + 0.012, STEEL);
		for (const y of [1.35, 1.65, 1.94]) g.box('metal', sx * 0.42 - 0.006, y - 0.006, -2.58, sx * 0.42 + 0.006, y + 0.006, -1.9, STEEL);
	}
	for (let x = -0.3; x < 0.35; x += 0.15) g.box('metal', x - 0.005, 1.935, -2.58, x + 0.005, 1.945, -1.9, STEEL);
	g.box('metal', -0.42, 1.93, -1.912, 0.42, 1.955, -1.888, STEEL);
	g.box('gloss', -0.42, 1.95, -2.62, 0.42, 2.35, -2.5, BLACK);
	scr(K, T, 0, 2.15, -2.498, 0.7, 0.32, TILE.scores);
	for (let i = 0; i < 6; i++) g.sphere('gloss', -0.25 + i * 0.1, 0.66, 0.55, 0.04, 0.04, 0.04, lin([0.55, 0.32, 0.18]), 6);
	block(K, T, -0.43, -2.62, 0.43, 0.7, 1.2);
}
// a dartboard on a wall (its back at z = 0): the cabinet open, the board, the scores beside it
function dartboard(K, T) {
	const g = K.g;
	g.box('grain', -0.5, 1.3, 0, 0.5, 2.1, 0.06, WALNUT);
	g.cyl('matte', 0, 1.73, 0.06, 0.23, 0.04, BLACK, 20, 'z');
	g.cyl('matte', 0, 1.73, 0.1, 0.17, 0.004, lin([0.85, 0.75, 0.55]), 20, 'z');
	g.cyl('matte', 0, 1.73, 0.105, 0.1, 0.004, lin([0.7, 0.1, 0.1]), 20, 'z');
	g.cyl('matte', 0, 1.73, 0.11, 0.025, 0.004, lin([0.1, 0.5, 0.2]), 12, 'z');
	g.box('matte', -0.6, 0, 2.36, 0.6, 0.006, 2.4, lin([0.9, 0.9, 0.9]));
	block(K, T, -0.5, 0, 0.5, 0.11, 2.1);
}

// ---------------------------------------------------------------------------------
// an arcade
function* fitArcade(K) {
	const w = K.wall, g = K.g, front = w.z1 - 2.4, side = K.doorX > (w.x0 + w.x1) / 2 ? -1 : 1;
	let m = Math.floor(K.rnd() * 8);
	// the light: a few strips over the floor, the neon round the walls
	strips(K, w.x0 + 1.5, w.x1 - 1.5, w.z0 + 1.5, w.z1 - 1.5, 5);
	g.at(0, 0, 0, 0);
	for (const [x0, z0, x1, z1] of [[w.x0, w.z0, w.x1, w.z0 + 0.05], [w.x0, w.z0, w.x0 + 0.05, w.z1 - 0.4], [w.x1 - 0.05, w.z0, w.x1, w.z1 - 0.4]]) K.box(K.mats.neon, x0, 2.85, z0, x1, 2.92, z1);
	// the video cabinets down one wall, the pinball down the other
	const vx = side > 0 ? w.x1 : w.x0, px = side > 0 ? w.x0 : w.x1;
	for (let z = w.z0 + 3.4, k = 0; z < front - 2.4; z += 0.82, k++) {
		const T = at(K, vx - side * 0.45, z, side > 0 ? 3 : 1);
		cabinet(K, T, m++ % 8, [TILE.arcade, TILE.shooter, TILE.game][k % 3]);
		place(K, T, 0, 0.8, 0, -1);
		if (k % 3 === 2) yield;
	}
	yield;
	for (let z = w.z0 + 3.4, k = 0; z < front - 1.6; z += 1.0, k++) {
		const T = at(K, px + side * 0.85, z, side > 0 ? 1 : 3);
		pinball(K, T, k % 3 ? (k * 3 + 1) % 8 : 8);
		game(K, T, 'pinball', 0, 1.0, 0.6, 'Pinball');
		place(K, T, 0, 0.95, 0, -1);
		yield;
	}
	yield;
	// the skee-ball lanes across the back
	const n = Math.max(2, Math.min(6, Math.floor((w.x1 - w.x0 - 5) / 0.95)));
	for (let i = 0; i < n; i++) {
		const T = at(K, (w.x0 + w.x1) / 2 + (i - (n - 1) / 2) * 0.92, w.z0 + 2.75, 0);
		skee(K, T);
		game(K, T, 'skeeball', 0, 1.1, 0.5, 'Skee-Ball');
		place(K, T, 0, 1.1, 0, -1);
		if (i % 2) yield;
	}
	yield;
	// down the middle: an air hockey table, the claw machines; the prize counter by the door
	const mx = (w.x0 + w.x1) / 2, mz0 = w.z0 + 5.4, mz1 = front - 2.6;
	if (mz1 - mz0 > 2.4) {
		const A = at(K, mx, mz0 + 1.3, 0);
		airHockey(K, A);
		game(K, A, 'airhockey', 0, 1.5, 0.6, 'Air hockey');
		place(K, A, 0, 1.5, 0, -1); place(K, A, 0, -1.5, 0, 1);
		for (let z = mz0 + 3.6, k = 0; z < mz1; z += 1.3, k++) for (const sx of [-1, 1]) {
			const T = at(K, mx + sx * 0.6, z, sx < 0 ? 3 : 1);
			claw(K, T, 10);
			game(K, T, 'claw', 0, 0.9, 0.5, 'Claw machine');
			yield;
		}
	}
	yield;
	// the prize counter: a glass case of the small prizes, the wall of the big ones behind,
	// the PRIZES sign; the change machine by it; a dartboard on the wall near the door
	{
		const cx = clamp(K.doorX + side * 3.2, w.x0 + 2.6, w.x1 - 2.6), cz = front - 0.6, T = at(K, cx, cz, 0);
		g.box('gloss', -1.4, 0, -0.3, 1.4, 0.95, 0.3, BLACK);
		g.box('metal', -1.38, 0.15, -0.28, 1.38, 0.17, 0.28, STEEL);
		K.s.run('toys', -1.35, 1.35, 0.17, 0.3, 0.27, 0.4, 7, 1.05);
		g.box('metal', -1.38, 0.55, -0.28, 1.38, 0.57, 0.28, STEEL);
		K.s.run('candy', -1.35, 1.35, 0.57, 0.3, 0.27, 0.4, 3, 1.05);
		K.box(K.mats.glass, ...glassBox(T, -1.38, 0.15, 0.28, 1.38, 0.95, 0.3));
		g.box('stone', -1.42, 0.95, -0.32, 1.42, 0.99, 0.32, lin([0.15, 0.15, 0.16]));
		block(K, T, -1.42, -0.32, 1.42, 0.32, 0.99);
		place(K, T, 0, -0.75, 0, 1, false, true); place(K, T, 0.5, 0.75, 0, -1);
		yield;
		// (the wall of big prizes behind: shelves of boxed toys, the plush on top)
		const zb = -1.25;
		g.box('grain', -1.6, 0, zb - 0.35, 1.6, 2.85, zb - 0.32, DARK);
		for (const y of [0.3, 0.75, 1.2, 1.65]) { g.box('metal', -1.6, y - 0.02, zb - 0.32, 1.6, y, zb, STEEL); if (y < 1.6) K.s.run('toys', -1.58, 1.58, y, 0.42, zb - 0.02, 0.28, y * 9, 1.0); }
		// (the big plush along the top, the ones you save up for)
		for (let k = 0; k < 9; k++) { const r = 0.14 + (k % 3) * 0.025; g.sphere('fabric', -1.42 + k * 0.355, 1.65 + r * 0.95, zb - 0.17, r, r * 0.95, r * 0.85, PLUSH[(k * 3) % PLUSH.length], 10); }
		block(K, T, -1.6, zb - 0.35, 1.6, zb, 2.85);
		yield;
		K.s.sign('PRIZES', -0.9, 0.9, 2.42, 0.32, zb - 0.31, lin([0.85, 0.1, 0.45]), 1.3);
		const V = at(K, ...T.w(2.0, -0.1), T.rot);
		g.box('gloss', -0.3, 0, -0.3, 0.3, 1.6, 0.3, lin([0.85, 0.75, 0.15])); g.box('gloss', -0.22, 0.9, 0.3, 0.22, 1.4, 0.31, BLACK); scr(K, V, 0, 1.2, 0.312, 0.36, 0.2, TILE.arcade);
		block(K, V, -0.3, -0.3, 0.3, 0.3, 1.6);
	}
	{
		const D = at(K, side > 0 ? w.x0 : w.x1, front + 0.6, side > 0 ? 1 : 3);
		dartboard(K, D); game(K, D, 'darts', 0, 2.3, 0.6, 'Darts');
	}
}

// ---------------------------------------------------------------------------------
// the lanes
function* fitBowling(K) {
	const w = K.wall, g = K.g, s = K.s, b = K.brand, ceil = K.ceil ?? 3.6;
	// (from the back: the pit, the lanes, the approaches, the settees, then the concourse by the door)
	const deep = w.z1 - w.z0, L = clamp(deep - 14, 6, 18.3), pinZ = w.z0 + 1.6, foul = pinZ + L, appr = foul + 4.2;
	const lw = 1.6, n = clamp(Math.floor((w.x1 - w.x0 - 1.6) / lw), 2, 16), x0 = (w.x0 + w.x1) / 2 - n * lw / 2;
	// the masking over the pins: a band across the alley in the place's colours, a pin and a ball
	// on it over each lane; the pit dark behind
	g.at(0, 0, 0, 0); s.at(0, 0, 0, 0);
	g.box('gloss', w.x0, 1.25, pinZ + 0.6, w.x1, 2.6, pinZ + 0.7, b.bg);
	g.box('gloss', w.x0, 1.18, pinZ + 0.6, w.x1, 1.25, pinZ + 0.72, b.fg);
	g.box('gloss', w.x0, 2.52, pinZ + 0.6, w.x1, 2.56, pinZ + 0.72, b.fg);
	for (let i = 0; i < n; i++) {
		const cx = x0 + (i + 0.5) * lw, z = pinZ + 0.7;
		g.cyl('gloss', cx - 0.22, 1.5, z, 0.07, 0.42, WHITE, 10); g.cyl('gloss', cx - 0.22, 1.92, z, 0.035, 0.05, RED, 8); g.sphere('gloss', cx - 0.22, 2.03, z, 0.055, 0.07, 0.03, WHITE, 8);
		g.sphere('gloss', cx + 0.18, 1.78, z, 0.2, 0.2, 0.04, b.fg, 12);
	}
	g.box('matte', w.x0, 0, w.z0, w.x1, 2.6, pinZ + 0.6, BLACK);
	g.box('matte', w.x0, 2.6, w.z0, w.x1, ceil, pinZ + 0.7, DARK);
	K.col.push([w.x0, w.z0, w.x1, pinZ + 0.7, 0, 3]);
	// the lanes: the boards, the arrows, the gutters, the pin deck and its ten pins; the approach
	// and its dots, the foul line
	for (let i = 0; i < n; i++) {
		const cx = x0 + (i + 0.5) * lw;
		g.box('wood', cx - 0.53, 0, pinZ + 0.6, cx + 0.53, 0.04, foul, MAPLE);
		g.box('wood', cx - 0.8, 0, foul, cx + 0.8, 0.04, appr, MAPLE.map((c) => c * 0.95));
		g.box('matte', cx - 0.53, 0.04, foul - 0.01, cx + 0.53, 0.042, foul + 0.01, BLACK);
		for (let a = 0; a < 7; a++) { const ax = cx - 0.45 + a * 0.15, az = foul - 4.6 + Math.abs(a - 3) * 0.3; g.box('matte', ax - 0.012, 0.04, az - 0.07, ax + 0.012, 0.042, az + 0.07, lin([0.2, 0.08, 0.05])); }
		for (let a = 0; a < 5; a++) g.box('matte', cx - 0.3 + a * 0.15 - 0.01, 0.04, foul + 2.2 - 0.01, cx - 0.3 + a * 0.15 + 0.01, 0.042, foul + 2.2 + 0.01, lin([0.2, 0.08, 0.05]));
		for (const sx of [-1, 1]) g.box('gloss', cx + sx * 0.66 - 0.12, -0.02, pinZ + 0.6, cx + sx * 0.66 + 0.12, 0.01, foul, lin([0.06, 0.06, 0.07]));
		g.box('wood', cx - 0.53, 0.04, pinZ + 0.6, cx + 0.53, 0.05, pinZ + 1.6, MAPLE.map((c) => c * 1.08));
		for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) {
			const px = cx + (c - r / 2) * 0.3, pz = pinZ + 1.45 - r * 0.26;
			g.cyl('gloss', px, 0.05, pz, 0.055, 0.25, WHITE, 6); g.cyl('gloss', px, 0.3, pz, 0.03, 0.04, RED, 6); g.cyl('gloss', px, 0.34, pz, 0.035, 0.05, WHITE, 6);
		}
		game(K, at(K, cx, foul + 1.6, 0), 'bowling', 0, 0, 0.7, `Lane ${i + 1}`);
		g.at(0, 0, 0, 0);
		yield;
	}
	// the dividers, the ball return between each pair, the pair's scores hung over the approach
	// (turned to the settees)
	for (let i = 0; i <= n; i++) {
		const xx = x0 + i * lw;
		g.box('gloss', xx - 0.08, 0, pinZ + 0.6, xx + 0.08, 0.08, foul, lin([0.2, 0.2, 0.22]));
		if (i % 2 === 0) continue;
		const T = at(K, xx, foul + 1.5, 0);
		g.box('gloss', -0.28, 0, -0.9, 0.28, 0.55, 0.6, lin([0.1, 0.1, 0.12]));
		g.box('gloss', -0.3, 0.55, -0.6, 0.3, 0.75, 0.2, b.bg);
		for (let k = 0; k < 6; k++) g.sphere('gloss', -0.12 + (k % 2) * 0.24, 0.66, 0.35 - Math.floor(k / 2) * 0.24, 0.108, 0.108, 0.108, lin([[0.1, 0.2, 0.7], [0.6, 0.05, 0.1], [0.05, 0.4, 0.2], [0.3, 0.05, 0.4], [0.05, 0.05, 0.05], [0.7, 0.4, 0.05]][(i * 2 + k) % 6]), 8);
		g.box('gloss', -0.32, 0.55, 0.2, 0.32, 0.6, 0.62, lin([0.15, 0.15, 0.17]));
		block(K, T, -0.32, -0.9, 0.32, 0.62, 0.8);
		const S = at(K, xx, foul + 2.6, 0);
		g.box('gloss', -1.45, 2.3, -0.06, 1.45, 3.05, 0, BLACK); g.box('metal', -0.03, 3.05, -0.06, 0.03, ceil, 0, DARK);
		scr(K, S, -0.72, 2.675, 0.002, 1.36, 0.68, TILE.scores); scr(K, S, 0.72, 2.675, 0.002, 1.36, 0.68, TILE.scores);
		g.at(0, 0, 0, 0);
		if (i % 4 === 3) yield;
	}
	// the light over the pins (under the masking), the lanes and the approaches, the concourse
	K.box(K.mats.panel, w.x0 + 0.3, 1.12, pinZ + 0.72, w.x1 - 0.3, 1.16, pinZ + 0.78);
	strips(K, x0 + 0.8, x0 + n * lw - 0.8, foul - L * 0.6, appr + 1, lw * 2);
	strips(K, w.x0 + 1.5, w.x1 - 1.5, appr + 1.6, w.z1 - 1.2, 4);
	yield;
	// the settees behind the approaches, a table for each pair, a bowler up on one
	const sz = appr + 1.8;
	for (let i = 0; i + 1 < n; i += 2) {
		const cx = x0 + (i + 1) * lw, T = at(K, cx, sz, 2);
		put(K, T, 'sofa', 0, 0, 2.2, 0.85, 0.85);
		block(K, T, -1.1, -0.42, 1.1, 0.42, 0.85);
		for (const sx of [-0.62, 0.62]) if (K.rnd() < 0.75) place(K, T, sx, 0.05, 0, 1, true);
		if (K.rnd() < 0.5) place(K, T, -0.8, sz - foul - 1.9, 0, 1);
		const D = at(K, cx, sz - 1.05, 0);
		g.box('gloss', -0.3, 0.7, -0.2, 0.3, 0.74, 0.2, DARK); g.cyl('metal', 0, 0, 0, 0.04, 0.7, STEEL, 6);
		g.cyl('gloss', -0.1, 0.74, 0.05, 0.04, 0.13, RED, 8); g.cyl('gloss', 0.1, 0.74, -0.05, 0.04, 0.13, lin([0.1, 0.3, 0.8]), 8);
		block(K, D, -0.3, -0.2, 0.3, 0.2, 0.75);
		if (i % 4 === 2) yield;
	}
	yield;
	// the concourse: the shoe counter and its cubbies, the ball racks, the snack bar
	const side = K.doorX > (w.x0 + w.x1) / 2 ? -1 : 1, room = w.z1 - 4.85 > sz + 1.4;
	if (room) {
		const cz = w.z1 - 3.2, sx = clamp(K.doorX + side * 3.2, w.x0 + 2, w.x1 - 2), T = at(K, sx, cz, 0);
		g.box('grain', -1.3, 0, -0.35, 1.3, 1.05, 0.35, WALNUT); g.box('gloss', -1.32, 0.4, 0.35, 1.32, 0.48, 0.37, b.bg);
		g.box('stone', -1.35, 1.05, -0.38, 1.35, 1.09, 0.4, lin([0.15, 0.15, 0.16]));
		monitor(K, at(K, ...T.w(-0.6, -0.12), 2), 0, 0, TILE.scores, 0.42, 1.09);
		at(K, sx, cz, 0);
		block(K, T, -1.35, -0.38, 1.35, 0.4, 1.09);
		place(K, T, 0, -0.8, 0, 1, false, true); place(K, T, 0.5, 0.8, 0, -1);
		const zb = -1.3;
		g.box('grain', -1.5, 0, zb - 0.3, 1.5, 2.75, zb, lin([0.25, 0.17, 0.11]));
		for (let k = 0; k < 4; k++) s.face('shoes', -1.45, 1.45, 0.25 + k * 0.45, 0.45, zb + 0.002, k * 2 + 1, 1.0);
		block(K, T, -1.5, zb - 0.3, 1.5, zb, 2.75);
		s.sign('SHOES', -0.7, 0.7, 2.24, 0.28, zb + 0.004, b.bg, 1.25);
	}
	yield;
	{
		// the ball racks along the side wall: three tiers of house balls in their colours
		const rx = side > 0 ? w.x0 : w.x1, len = Math.min(4, w.z1 - 4.4 - sz), T = at(K, rx, sz + len / 2, side > 0 ? 1 : 3);
		if (len > 1.5) {
			for (let t = 0; t < 3; t++) {
				const y = 0.25 + t * 0.32, zz = 0.25;
				g.box('metal', -len / 2, y - 0.03, zz - 0.12, len / 2, y, zz + 0.12, STEEL);
				for (let k = 0; k < Math.floor(len / 0.24); k++) g.sphere('gloss', -len / 2 + 0.12 + k * 0.24, y + 0.1, zz, 0.108, 0.108, 0.108, lin([[0.1, 0.2, 0.7], [0.6, 0.05, 0.1], [0.05, 0.4, 0.2], [0.3, 0.05, 0.4], [0.7, 0.4, 0.05], [0.05, 0.05, 0.05], [0.8, 0.1, 0.5]][(k + t * 3) % 7]), 7);
			}
			for (const ex of [-len / 2, len / 2]) g.box('metal', ex - 0.02, 0, 0.1, ex + 0.02, 1.0, 0.4, STEEL);
			block(K, T, -len / 2, 0, len / 2, 0.42, 1.0);
		}
	}
	yield;
	if (room) {
		// the snack bar on the other side of the door: its counter, the drinks and the fryer
		// behind, the menus lit on the wall over them
		const nx = clamp(K.doorX - side * 3.4, w.x0 + 2, w.x1 - 2), T = at(K, nx, w.z1 - 3.0, 0);
		if (Math.abs(nx - K.doorX) > 2.4) {
			g.box('gloss', -1.2, 0, -0.35, 1.2, 1.0, 0.35, RED); g.box('stone', -1.24, 1.0, -0.38, 1.24, 1.04, 0.4, lin([0.85, 0.85, 0.84]));
			block(K, T, -1.24, -0.38, 1.24, 0.4, 1.04);
			const zb = -1.2;
			g.box('grain', -1.35, 0, zb - 0.12, 1.35, 2.75, zb - 0.05, DARK);
			g.box('metal', -1.2, 0, zb - 0.05, 0.2, 0.95, zb + 0.55, STEEL);
			s.face('fountain', -1.1, -0.3, 0.98, 0.42, zb + 0.4, 0, 1.15);
			g.box('metal', -1.1, 0.95, zb, -0.3, 1.42, zb + 0.38, STEEL);
			put(K, T, 'fryer', 0.6, zb + 0.25, 0.7, 0.55, 0.95);
			g.box('gloss', -1.3, 1.8, zb - 0.05, 1.3, 2.5, zb - 0.02, BLACK);
			s.card('menulit', 0, 0, 1, -1.25, 0, 1.85, 0.6, zb - 0.016, 1.2); s.card('menulit', 1, 0, 1, 0, 1.25, 1.85, 0.6, zb - 0.016, 1.2);
			s.sign('SNACK BAR', -0.9, 0.9, 2.52, 0.2, zb - 0.044, RED, 1.25);
			block(K, T, -1.35, zb - 0.12, 1.35, zb + 0.55, 1.42);
			place(K, T, 0, -0.75, 0, 1, false, true); place(K, T, 0.4, 0.8, 0, -1);
			perk(K, T, 'snackbar', 0, 0.8);
		}
	}
}

// ---------------------------------------------------------------------------------
// a cinema
function* fitCinema(K) {
	const w = K.wall, g = K.g, s = K.s, b = K.brand, side = K.doorX > (w.x0 + w.x1) / 2 ? -1 : 1, ceil = K.ceil ?? 3.6;
	// the hall at the back (one screen's, no wider than 13 m: its own walls where the block is
	// wider), its aisle down one side, the lobby by the street
	const hall = w.z1 - 10.2, mid = (w.x0 + w.x1) / 2, hh = Math.min(w.x1 - w.x0, 13) / 2, hx0 = mid - hh, hx1 = mid + hh;
	const aisleR = side > 0, door = aisleR ? hx1 - 0.8 : hx0 + 0.8;
	const cx = clamp(K.doorX + side * 3.2, w.x0 + 2.6, w.x1 - 2.6), cz = hall + 3.6;
	const wl = lin([0.2, 0.06, 0.07]), dark = lin([0.06, 0.04, 0.05]);
	// the wall between the lobby and the hall, its doorway, EXIT over it on the hall's side
	g.at(0, 0, 0, 0); s.at(0, 0, 0, 0);
	for (const [a0, a1] of [[w.x0, door - 0.7], [door + 0.7, w.x1]]) if (a1 - a0 > 0.1) { g.box('paint', a0, 0, hall - 0.15, a1, ceil, hall + 0.15, wl); K.col.push([a0, hall - 0.15, a1, hall + 0.15, 0, ceil]); }
	g.box('paint', door - 0.7, 2.3, hall - 0.15, door + 0.7, ceil, hall + 0.15, wl);
	s.at(door, 0, hall - 0.16, 2); s.sign('EXIT', -0.3, 0.3, 2.42, 0.16, 0, lin([0.05, 0.55, 0.15]), 1.4); s.at(0, 0, 0, 0);
	if (hx0 > w.x0 + 0.3) for (const x of [hx0 - 0.15, hx1]) { g.box('paint', x, 0, w.z0, x + 0.15, ceil, hall - 0.15, dark); K.col.push([x, w.z0, x + 0.15, hall - 0.15, 0, ceil]); }
	// (the posters of what's showing on the lobby's side of it, in their cases)
	for (let k = 0, x = w.x0 + 0.8; x < w.x1 - 0.8 && k < 8; x += 1.2) {
		if (Math.abs(x - door) < 1.4 || Math.abs(x - cx) < 2.7) continue;
		g.box('metal', x - 0.44, 0.95, hall + 0.15, x + 0.44, 2.25, hall + 0.22, BLACK);
		s.card('films', k >> 2, k & 3, 4, x - 0.38, x + 0.38, 1.03, 1.14, hall + 0.225, 1.3);
		k++;
	}
	// ---- the hall: dark walls, the screen between its curtains over the stage, the rows stepping up
	const sz = w.z0 + 0.3, top = Math.min(ceil - 0.25, 3.4), sw = Math.min(hx1 - hx0 - 2, 8.6);
	K.band(hx0, w.z0, hx1, w.z0 + 0.02, [0.08, 0.05, 0.06], 0, ceil);
	K.band(hx0, w.z0, hx0 + 0.02, hall - 0.15, [0.08, 0.05, 0.06], 0, ceil); K.band(hx1 - 0.02, w.z0, hx1, hall - 0.15, [0.08, 0.05, 0.06], 0, ceil);
	g.box('matte', mid - sw / 2 - 0.4, 0.45, sz - 0.05, mid + sw / 2 + 0.4, top + 0.15, sz, BLACK);
	K.box(K.mats.bigscreen, mid - sw / 2, 0.6, sz + 0.01, mid + sw / 2, top, sz + 0.03);
	K.screen(mid, (0.6 + top) / 2, sz + 0.035, sw - 0.06, top - 0.66, TILE.movie, 0);
	for (const sx of [-1, 1]) {
		const xc = mid + sx * (sw / 2 + 0.08);
		for (let f = 0; f < 6; f++) { const x = xc + sx * f * 0.14; g.box('fabric', x - 0.07, 0.5, sz + 0.04 + (f % 2) * 0.05, x + 0.07, top + 0.2, sz + 0.16 + (f % 2) * 0.05, VELVET); }
	}
	g.box('fabric', mid - sw / 2 - 1, top + 0.05, sz + 0.04, mid + sw / 2 + 1, top + 0.35, sz + 0.2, VELVET);
	g.box('wood', hx0 + 0.3, 0, sz, hx1 - 0.3, 0.5, sz + 1.0, lin([0.18, 0.08, 0.08]));
	K.col.push([hx0 + 0.3, sz, hx1 - 0.3, sz + 1.0, 0, 0.5]);
	// (the house lights: sconces down the side walls)
	for (let z = w.z0 + 2.6; z < hall - 1; z += 3.2) for (const x of [hx0 + 0.02, hx1 - 0.07]) K.box(K.mats.panel, x, 2.3, z - 0.12, x + 0.05, 2.5, z + 0.12);
	yield;
	const rx0 = aisleR ? hx0 + 0.2 : hx0 + 1.6, rx1 = aisleR ? hx1 - 1.6 : hx1 - 0.2, seats = [];
	let zl = w.z0 + 4.0;
	for (let r = 0, z = w.z0 + 4.0; z < hall - 1.4 && r < 12; z += 1.05, r++) {
		const y = Math.min(1.3, r * 0.18);
		if (y > 0) {
			g.box('carpet', rx0, 0, z - 0.55, rx1, y, z + 0.5, lin([0.25, 0.05, 0.07]));
			// (a step light at its end on the aisle)
			const lx = aisleR ? rx1 : rx0 - 0.01;
			g.box('bulb', lx, y - 0.07, z - 0.12, lx + 0.01, y - 0.03, z + 0.12, lin([1, 0.8, 0.5]));
		}
		const m = (rx0 + rx1) / 2, wide = rx1 - rx0 > 12;
		for (let x = rx0 + 0.55; x < rx1 - 0.5; x += 0.58) {
			if (wide && Math.abs(x - m) < 0.5) continue;
			g.box('fabric', x - 0.25, y + 0.18, z - 0.22, x + 0.25, y + 0.46, z + 0.22, VELVET);
			g.box('fabric', x - 0.25, y + 0.46, z + 0.18, x + 0.25, y + 1.05, z + 0.3, VELVET);
			g.box('matte', x + 0.25, y, z - 0.25, x + 0.31, y + 0.66, z + 0.28, BLACK);
			seats.push([x, z - 0.02, 0, true, y]);
		}
		zl = z;
		if (r % 2) yield;
	}
	K.seats.push(...seats);
	K.col.push([rx0, w.z0 + 3.75, rx1, zl + 0.5, 0, 1.6]);
	yield;
	// ---- the lobby: the concession stand facing the door, the ticket kiosks, the ropes
	const T = at(K, cx, cz, 0);
	g.box('gloss', -2.2, 0, -0.4, 2.2, 1.0, 0.4, RED); g.box('stone', -2.24, 1.0, -0.44, 2.24, 1.04, 0.44, lin([0.12, 0.12, 0.13]));
	// (the candy case let into its front: rows of boxes behind the glass)
	g.box('matte', -1.9, 0.1, 0.4, 0.4, 0.9, 0.402, lin([0.85, 0.85, 0.83]));
	for (const y of [0.14, 0.52]) s.run('candy', -1.85, 0.35, y, 0.34, 0.405, 0.05, y * 13, 1.1);
	mbox(K, T, K.mats.glass, -1.9, 0.1, 0.41, 0.4, 0.9, 0.43);
	block(K, T, -2.24, -0.44, 2.24, 0.44, 1.04);
	// (the popcorn machine on the counter, its glass full of corn; the buckets by it)
	g.box('gloss', 0.8, 1.04, -0.3, 1.6, 1.12, 0.3, RED);
	for (const [a, r2] of [[0.3, 0], [-0.3, 2]]) { s.at(...T.w(1.2, a), (T.rot + r2) % 4); s.card('popcorn', 0, 0, 2, -0.38, 0.38, 1.12, 0.62, 0, 1.15); }
	s.at(cx, 0, cz, 0);
	g.box('gloss', 0.8, 1.74, -0.3, 1.6, 1.86, 0.3, RED); g.box('metal', 0.8, 1.12, -0.3, 0.83, 1.74, 0.3, STEEL); g.box('metal', 1.57, 1.12, -0.3, 1.6, 1.74, 0.3, STEEL);
	s.sub('popcorn', 0, 0.5, 0.3, 1, 1, 1.65, 2.2, 1.04, 0.29, 0.1, 1.1);
	// (behind: the wall with the menus lit on it, the drinks' fountain under them, the sign)
	const zb = -1.3;
	g.box('grain', -2.3, 0, zb - 0.2, 2.3, 3.2, zb - 0.1, wl);
	g.box('metal', -2.2, 0, zb - 0.1, 2.2, 0.95, zb + 0.5, STEEL);
	s.face('fountain', -1.9, -0.9, 0.98, 0.42, zb + 0.35, 0, 1.15);
	g.box('metal', -1.9, 0.95, zb, -0.9, 1.42, zb + 0.33, STEEL);
	g.box('gloss', -2.2, 1.85, zb - 0.1, 2.2, 2.65, zb, BLACK);
	for (const k of [-1, 0, 1]) scr(K, T, k * 1.42, 2.25, zb + 0.004, 1.36, 0.74, TILE.concession);
	s.sign('CONCESSIONS', -1.4, 1.4, 2.78, 0.3, zb - 0.095, RED, 1.3);
	block(K, T, -2.3, zb - 0.2, 2.3, zb + 0.5, 1.42);
	place(K, T, -0.6, -0.75, 0, 1, false, true); place(K, T, 1.0, -0.75, 0, 1, false, true);
	place(K, T, -0.4, 0.85, 0, -1); place(K, T, 0.8, 1.1, 0, -1);
	perk(K, T, 'popcorn', 0, 0.85);
	yield;
	// the ticket kiosks by the door, the ropes to queue between
	{
		const kx = clamp(K.doorX - side * 2.6, w.x0 + 1, w.x1 - 1), kz = w.z1 - 3.0;
		for (const dx of [-0.45, 0.45]) {
			const Q = at(K, kx + dx, kz, 0);
			g.box('gloss', -0.22, 0, -0.18, 0.22, 1.0, 0.18, BLACK); g.box('gloss', -0.24, 1.0, -0.2, 0.24, 1.6, -0.04, b.bg);
			scr(K, Q, 0, 1.3, -0.038, 0.38, 0.5, TILE.movie);
			block(K, Q, -0.24, -0.2, 0.24, 0.18, 1.6);
		}
		g.at(0, 0, 0, 0); s.at(0, 0, 0, 0);
		g.box('gloss', kx - 0.62, 2.48, kz - 0.29, kx + 0.62, 2.76, kz - 0.26, BLACK);
		for (const dx of [-0.5, 0.5]) g.box('metal', kx + dx - 0.01, 2.76, kz - 0.285, kx + dx + 0.01, ceil, kz - 0.265, DARK);
		s.sign('TICKETS', kx - 0.6, kx + 0.6, 2.5, 0.24, kz - 0.255, b.bg, 1.25);
		for (let k = 0; k < 4; k++) {
			const px = cx - 1.6 + k * 1.1, pz = cz + 1.6;
			g.cyl('metal', px, 0, pz, 0.12, 0.03, lin([0.75, 0.6, 0.25]), 10); g.cyl('metal', px, 0.03, pz, 0.025, 0.92, lin([0.75, 0.6, 0.25]), 6);
			if (k < 3) g.beam('fabric', [px, 0.85, pz], [px + 1.1, 0.85, pz], 0.035, 0.035, VELVET);
		}
	}
	// (the lobby's light: strips over it)
	strips(K, w.x0 + 1.5, w.x1 - 1.5, hall + 0.8, w.z1 - 1.0, 3);
}

// ---------------------------------------------------------------------------------
// a tattoo parlour
function* fitTattoo(K) {
	const w = K.wall, g = K.g, s = K.s, b = K.brand, side = K.doorX > (w.x0 + w.x1) / 2 ? -1 : 1;
	const flashX = side > 0 ? w.x1 : w.x0, stX = side > 0 ? w.x0 : w.x1;
	// the counter by the door, the portfolios on it, the register; the waiting bench under the window
	{
		const T = at(K, clamp(K.doorX + side * 2.0, w.x0 + 1.6, w.x1 - 1.6), w.z1 - 3.0, 0);
		g.box('grain', -1.1, 0, -0.35, 1.1, 1.05, 0.35, lin([0.12, 0.1, 0.09]));
		g.box('gloss', -1.12, 0.6, 0.35, 1.12, 0.66, 0.37, b.bg);
		g.box('grain', -1.14, 1.05, -0.38, 1.14, 1.09, 0.4, WALNUT);
		for (let i = 0; i < 3; i++) s.stack('covers', 2, i, 4, -0.9 + i * 0.3, -0.1, -0.68 + i * 0.3, 0.2, 1.09, 1.13, BLACK, 1.0);
		monitor(K, at(K, ...T.w(0.6, -0.1), (T.rot + 2) % 4), 0, 0, TILE.photo, 0.4, 1.09);
		at(K, T.x, T.z, T.rot);
		block(K, T, -1.14, -0.38, 1.14, 0.4, 1.09);
		place(K, T, 0, -0.8, 0, 1, false, true);
		const B = at(K, clamp(K.doorX - side * 2.4, w.x0 + 1.2, w.x1 - 1.2), w.z1 - 1.0, 2);
		put(K, B, 'sofa', 0, 0, 1.9, 0.8, 0.82);
		block(K, B, -0.95, -0.4, 0.95, 0.4, 0.8);
		place(K, B, -0.4, 0.05, 0, 1, true); place(K, B, 0.4, 0.05, 0, 1, true);
	}
	yield;
	// the flash down its wall, framed, two high
	{
		const T = at(K, flashX, (w.z0 + w.z1) / 2, side > 0 ? 3 : 1), len = w.z1 - w.z0 - 4.6;
		for (let i = 0, x = -len / 2 + 0.6; x < len / 2 - 0.4; x += 1.05, i++) for (const y of [1.15, 2.15]) {
			g.box('grain', x - 0.47, y - 0.47, 0, x + 0.47, y + 0.47, 0.035, BLACK);
			const [fx, fz] = T.w(x, 0.04);
			K.flash(fx, y, fz, 0.86, 0.86, T.yaw, i * 2 + (y > 2 ? 1 : 0));
		}
		// (a neon tube along the top of it)
		mbox(K, T, K.mats.neon, -len / 2 + 0.3, 2.72, 0.05, len / 2 - 0.3, 2.76, 0.09);
	}
	yield;
	// the stations down the other wall: the chair, the stool, the cart, the lamp, a partition
	for (let z = w.z0 + 1.6; z < w.z1 - 4.6; z += 2.7) {
		const T = at(K, stX + side * 1.5, z, side > 0 ? 1 : 3);
		// (the chair: its column, the padded bench, the back raised, the headrest, an arm board)
		g.cyl('metal', 0, 0, 0, 0.25, 0.04, BLACK, 12); g.cyl('metal', 0, 0.04, 0, 0.07, 0.45, STEEL, 8);
		g.box('fabric', -0.32, 0.5, -0.35, 0.32, 0.62, 0.55, BLACK);
		g.beam('fabric', [0, 0.62, -0.35], [0, 1.15, -0.85], 0.64, 0.12, BLACK);
		g.box('fabric', -0.16, 1.1, -0.98, 0.16, 1.22, -0.8, BLACK);
		g.beam('fabric', [0, 0.6, 0.55], [0, 0.35, 0.95], 0.6, 0.1, BLACK);
		g.box('fabric', 0.34, 0.68, -0.25, 0.48, 0.74, 0.3, BLACK); g.box('metal', 0.38, 0.5, -0.02, 0.42, 0.68, 0.02, STEEL);
		block(K, T, -0.35, -0.95, 0.5, 0.95, 0.75);
		place(K, T, 0, -0.1, 0, 1, true);
		// (the artist's stool, the cart with the inks, the machine, the gloves and the sharps box)
		g.cyl('metal', -0.75, 0, 0.1, 0.22, 0.03, BLACK, 10); g.cyl('metal', -0.75, 0.03, 0.1, 0.03, 0.45, STEEL, 6); g.cyl('fabric', -0.75, 0.48, 0.1, 0.19, 0.08, BLACK, 12);
		place(K, T, -0.75, 0.1, 1, 0, true, true);
		g.box('metal', -0.95, 0, -0.75, -0.45, 0.8, -0.4, STEEL); g.box('metal', -0.95, 0.8, -0.75, -0.45, 0.82, -0.4, lin([0.85, 0.86, 0.88]));
		s.at(...T.w(-0.7, -0.42), T.rot); s.run('inks', -0.23, 0.23, 0.82, 0.1, 0.0, 0.2, z * 3, 1.0); s.at(T.x, 0, T.z, T.rot);
		g.box('matte', -0.9, 0.82, -0.72, -0.78, 0.94, -0.62, lin([0.85, 0.08, 0.08]));
		g.box('gloss', -0.62, 0.82, -0.68, -0.52, 0.86, -0.55, BLACK);
		block(K, T, -0.95, -0.75, -0.45, -0.4, 0.95);
		// (the lamp on its arm, swung over the chair)
		g.cyl('metal', 0.85, 0, -0.6, 0.18, 0.03, BLACK, 10); g.cyl('metal', 0.85, 0.03, -0.6, 0.015, 1.5, STEEL, 6);
		g.beam('metal', [0.85, 1.53, -0.6], [0.3, 1.75, -0.1], 0.025, 0.025, STEEL);
		g.cyl('lamp', 0.3, 1.62, -0.1, 0.14, 0.12, lin([0.95, 0.93, 0.88]), 12);
		// (a half wall out from the wall between it and the one before, a sheet of flash framed on
		// it; on the wall a shelf of the artist's inks, and a mirror)
		g.box('grain', -1.38, 0, -1.5, -1.32, 1.7, 0.2, WALNUT);
		g.box('grain', -1.4, 1.7, -1.5, -1.3, 1.74, 0.22, WALNUT.map((c) => c * 0.8));
		block(K, T, -1.38, -1.5, -1.32, 0.2, 1.74);
		g.box('grain', -1.32, 0.83, -1.02, -1.318, 1.47, -0.38, BLACK);
		{ const [fx, fz] = T.w(-1.316, -0.7); K.flash(fx, 1.15, fz, 0.6, 0.6, YAW[(T.rot + 1) % 4], Math.floor(z * 7) + 3); }
		g.box('grain', -1.0, 1.3, -1.5, -0.1, 1.33, -1.3, WALNUT);
		s.at(...T.w(-0.55, -1.31), T.rot); s.run('inks', -0.42, 0.42, 1.33, 0.1, 0, 0.17, z * 5 + 3, 1.0); s.at(T.x, 0, T.z, T.rot);
		g.box('mirror', 0.35, 0.9, -1.485, 1.05, 1.8, -1.47, WHITE);
	}
}

// ---------------------------------------------------------------------------------
// the fit-out for what the place is
export function* fitVenue(K, type, biz) {
	if (type === 'office') yield* fitOffice(K, biz);
	else if (type === 'arcade') yield* fitArcade(K);
	else if (type === 'bowling') yield* fitBowling(K);
	else if (type === 'cinema') yield* fitCinema(K);
	else yield* fitTattoo(K);
	K.g.at(0, 0, 0, 0); K.s.at(0, 0, 0, 0);
}
