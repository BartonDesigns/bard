// The insides of the walk-in shops (bay/commercial.js builds the shell), fitted out the way real
// ones are: a gas station's food mart or a corner store with its wall of lit glass-door coolers,
// its low gondolas of chips and candy and household things, the counter by the door with the
// register, the impulse racks and the tobacco wall behind the clerk, the coffee bar and the
// fountain drinks, the roller grill, the ice cream chest; a grocer's produce bins, its dairy
// case and freezers and its checkout lanes; a hardware store's tall pegboard runs, the paint
// counter and its wall of colour chips, the fasteners' drawers, the lumber rack; a pharmacy's
// aisles and its counter at the back; a bottle shop's wine walls and beer cave; a bookshop's
// cases; a clothes shop's rails, tables and fitting rooms; a salon's chairs; a laundromat's
// machines; a gym's floor. Whatever it is, the brand's colours run round its walls.
//
// What is drawn goes three ways: the fittings into the house kit's builder (bay/housekit.js,
// its materials: lit by the interiors' light bake), the stock into the goods builder
// (interiors/goods.js: one unlit draw of painted packets), and the few lamps and glass panes
// into commercial.js's own materials (its light strips are the bake's fixtures). Each fit-out
// is a generator: it yields between its parts so a shop builds over a few frames.
//
// K, from commercial.js: { g (Builder), s (GoodsBuilder), box(mat, x0, y0, z0, x1, y1, z1,
// solid), mats, col, seats, aisles, rnd, wall: { x0, x1, z0, z1 } (the walls' inner faces),
// doorX, ceil, brand: { bg, fg } (linear rgb), band(x0, z0, x1, z1, rgb, y0, y1), isPhone }

import { drawAny } from '../interiors/kit.js';
import '../interiors/estab-kit.js';
import { stripUV } from '../interiors/goods.js';
import { srgbToLinear as lin } from '../world/srgb.js';

const C = {
	steel: lin([0.78, 0.79, 0.8]), shelf: lin([0.86, 0.87, 0.88]), kick: lin([0.2, 0.2, 0.21]), black: lin([0.04, 0.04, 0.045]),
	back: lin([0.82, 0.83, 0.82]), peg: lin([0.74, 0.66, 0.52]), white: lin([0.93, 0.93, 0.91]), top: lin([0.15, 0.15, 0.16]),
	wood: lin([0.55, 0.38, 0.24]), oak: lin([0.72, 0.56, 0.38]), orange: lin([0.93, 0.42, 0.08]), steelDark: lin([0.32, 0.33, 0.35]),
	paper: lin([0.96, 0.96, 0.94]), red: lin([0.78, 0.1, 0.1]), cream: lin([0.94, 0.9, 0.82]), glassTint: lin([0.75, 0.85, 0.9]),
};

// ---------------------------------------------------------------------------------
// a frame on a face: dir the way the face looks ('+z', '-z', '+x', '-x'), line its x or z.
// Locally the face is at z = 0, the room toward +z, x along it; L(a0, a1) the local x range of a
// run from a0 to a1 along the world axis, W(lx, lz) the world point
export function frame(dir, line) {
	switch (dir) {
		case '-z': return { rot: 2, o: [0, line], L: (a0, a1) => [-a1, -a0], W: (lx, lz) => [-lx, line - lz] };
		case '+x': return { rot: 1, o: [line, 0], L: (a0, a1) => [-a1, -a0], W: (lx, lz) => [line + lz, -lx] };
		case '-x': return { rot: 3, o: [line, 0], L: (a0, a1) => [a0, a1], W: (lx, lz) => [line - lz, lx] };
		default: return { rot: 0, o: [0, line], L: (a0, a1) => [a0, a1], W: (lx, lz) => [lx, line + lz] };
	}
}
// a colour from hue, saturation and lightness (0..1), as srgb
function hsl(h, s, l) {
	const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
	return [f(0), f(8), f(4)];
}
const use = (K, F) => { K.g.at(F.o[0], 0, F.o[1], F.rot); K.s.at(F.o[0], 0, F.o[1], F.rot); };
// a box of commercial.js's materials (a light strip, a pane of glass) in a frame
function fbox(K, F, mat, lx0, y0, lz0, lx1, y1, lz1, solid = false) {
	const [ax, az] = F.W(lx0, lz0), [bx, bz] = F.W(lx1, lz1);
	K.box(mat, Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y1, Math.max(az, bz), solid);
}
// something solid, in a frame
function solid(K, F, lx0, lz0, lx1, lz1, y1, y0 = 0) {
	const [ax, az] = F.W(lx0, lz0), [bx, bz] = F.W(lx1, lz1);
	K.col.push([Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), y0, y1]);
}
// a place to stand, in a frame, looking along local (dx, dz); staff: someone who works there
function spot(K, F, lx, lz, dx, dz, staff = false) {
	const [x, z] = F.W(lx, lz), [ox, oz] = F.W(0, 0), [fx, fz] = F.W(dx, dz);
	const wx = fx - ox, wz = fz - oz;
	const s = [x, z, Math.atan2(-wx, -wz), false];
	if (staff) s.staff = true;
	K.seats.push(s);
}
// a kit item (interiors/kit.js, estab-kit.js) at a point in a frame, turned rot quarter-turns
// from the frame's own facing
function item(K, F, type, lx, lz, w, d, h, rot = 0, extra = {}) {
	const [x, z] = F.W(lx, lz);
	const it = { type, x, y: 0, z, w, d, h, rot: (F.rot + rot) % 4, v: K.rnd(), ...extra };
	drawAny(K.g, it, K.rnd);
	use(K, F);
	return it;
}

// ---------------------------------------------------------------------------------
// shelving

// a run of shelves along a face (a wall's, or one side of a gondola): a kick plate, the deck,
// the levels with their stock, the ends; the back panel too when it stands against a wall.
//   o: { h, depth, levels: [y...], kinds: (level, bay) => kind, back: colour or null, light }
function shelfRun(K, dir, line, a0, a1, o) {
	const F = frame(dir, line), [L0, L1] = F.L(a0, a1), d = o.depth ?? 0.42, h = o.h ?? 1.45, g = K.g, s = K.s;
	use(K, F);
	g.box('metal', L0, 0, -d, L1, 0.11, -0.03, C.kick);
	if (o.back) g.box(o.peg ? 'matte' : 'metal', L0, 0.11, -d - 0.04, L1, h, -d, o.back);
	// the uprights between the bays, the ends
	for (let x = L0; x <= L1 + 1e-3; x += 1.2) g.box('metal', Math.min(x, L1) - 0.02, 0, -d - 0.02, Math.min(x, L1) + 0.02, h, -d + 0.03, C.steelDark);
	if (o.ends !== false) for (const x of [L0, L1]) g.box('metal', x - 0.015, 0, -d, x + 0.015, h, 0.01, o.back || C.back);
	const lv = o.levels || [0.12, 0.47, 0.82, 1.17];
	lv.forEach((y, i) => {
		const top = i + 1 < lv.length ? lv[i + 1] - 0.03 : h - 0.02;
		g.box('metal', L0, y - 0.025, -d, L1, y, 0.0, C.shelf);
		const k = (o.light ?? 1) * (0.78 + 0.22 * Math.min(1, y / 1.4));
		// (the price rail along its front edge, its tags; not under the bottom shelf's stock)
		if (y > 0.2 && o.rail !== false) s.rail(L0, L1, y - 0.04, 0.004, k);
		for (let x = L0, b = 0; x < L1 - 0.05; x += 1.2, b++) {
			const kind = typeof o.kinds === 'function' ? o.kinds(i, b) : o.kinds;
			if (kind) s.run(kind, x, Math.min(L1, x + 1.2), y, top - y, -0.015, d - 0.05, (o.seed || 0) + i * 5 + b, k);
		}
	});
	if (o.cap !== false) g.box('metal', L0, h - 0.02, -d - 0.04, L1, h, 0.0, C.shelf);
	return F;
}
// a gondola: two shelf runs back to back on a spine, from x0 to x1 along x at z; ends: its two
// endcaps (single-sided bays facing the cross aisles, a sign over each)
function gondola(K, x0, x1, z, o) {
	const d = o.depth ?? 0.44, h = o.h ?? 1.45, g = K.g;
	g.at(0, 0, 0, 0);
	g.box(o.peg ? 'matte' : 'metal', x0, 0.11, z - 0.025, x1, h, z + 0.025, o.peg ? C.peg : C.back);
	shelfRun(K, '+z', z + d, x0, x1, { ...o, depth: d, back: null, ends: false, kinds: (i, b) => o.kinds(i, b, 1), seed: (o.seed || 0) + 1 });
	shelfRun(K, '-z', z - d, x0, x1, { ...o, depth: d, back: null, ends: false, kinds: (i, b) => o.kinds(i, b, -1), seed: (o.seed || 0) + 2 });
	let e0 = x0, e1 = x1;
	if (o.ends) {
		const ek = o.ends;
		shelfRun(K, '-x', x0 - 0.42, z - d, z + d, { h, depth: 0.42, levels: o.levels, kinds: (i) => ek[i % ek.length], back: null, seed: (o.seed || 0) + 3, light: o.light });
		shelfRun(K, '+x', x1 + 0.42, z - d, z + d, { h, depth: 0.42, levels: o.levels, kinds: (i) => ek[(i + 1) % ek.length], back: null, seed: (o.seed || 0) + 4, light: o.light });
		e0 = x0 - 0.42; e1 = x1 + 0.42;
	}
	// what the run holds, on a header along its top: read from either aisle
	if (o.sign) {
		const xm = (x0 + x1) / 2, hw = Math.min(1.0, (x1 - x0) / 2 - 0.1), col = o.signCol || K.brand.bg;
		g.at(0, 0, 0, 0);
		for (const x of [xm - hw + 0.1, xm + hw - 0.1]) g.box('metal', x - 0.015, h, z - 0.015, x + 0.015, h + 0.1, z + 0.015, C.steelDark);
		g.box('matte', xm - hw, h + 0.1, z - 0.012, xm + hw, h + 0.36, z + 0.012, col);
		for (const [dir, line] of [['+z', z + 0.013], ['-z', z - 0.013]]) {
			const F = frame(dir, line), [a, b] = F.L(xm - hw, xm + hw);
			use(K, F);
			K.s.sign(o.sign, a + 0.02, b - 0.02, h + 0.12, 0.22, 0.0, col);
		}
	}
	K.col.push([e0, z - d, e1, z + d, 0, h]);
	K.aisles.push([e0, e1, z]);
}
// a gondola running along z (the aisles back from a shop's front): from z0 to z1 at x, its
// endcaps facing the front and the back, its sign over the front one
function gondolaZ(K, z0, z1, x, o) {
	const d = o.depth ?? 0.44, h = o.h ?? 1.45, g = K.g, ek = o.ends;
	g.at(0, 0, 0, 0);
	g.box('metal', x - 0.025, 0.11, z0, x + 0.025, h, z1, C.back);
	shelfRun(K, '+x', x + d, z0, z1, { ...o, depth: d, back: null, ends: false, kinds: (i, b) => o.kinds(i, b, 1), seed: (o.seed || 0) + 1 });
	shelfRun(K, '-x', x - d, z0, z1, { ...o, depth: d, back: null, ends: false, kinds: (i, b) => o.kinds(i, b, -1), seed: (o.seed || 0) + 2 });
	let e0 = z0, e1 = z1;
	if (ek) {
		shelfRun(K, '-z', z0 - 0.42, x - d, x + d, { h, depth: 0.42, levels: o.levels, kinds: (i) => ek[i % ek.length], back: null, seed: (o.seed || 0) + 3 });
		shelfRun(K, '+z', z1 + 0.42, x - d, x + d, { h, depth: 0.42, levels: o.levels, kinds: (i) => ek[(i + 1) % ek.length], back: null, seed: (o.seed || 0) + 4 });
		e0 = z0 - 0.42; e1 = z1 + 0.42;
	}
	// its name over its ends, on a card each way
	if (o.sign) {
		const col = o.signCol || K.brand.bg, hw = d + 0.1;
		for (const [z, dir] of [[e1, '+z'], [e0, '-z']]) {
			const F = frame(dir, z + (dir === '+z' ? -0.2 : 0.2)), [a, b] = F.L(x - hw, x + hw);
			use(K, F);
			g.box('metal', (a + b) / 2 - 0.015, h, -0.015, (a + b) / 2 + 0.015, h + 0.12, 0.015, C.steelDark);
			g.box('matte', a, h + 0.12, -0.012, b, h + 0.34, 0.0, col);
			K.s.sign(o.sign, a, b, h + 0.12, 0.22, 0.003, col);
		}
	}
	K.col.push([x - d, e0, x + d, e1, 0, h]);
}
// a bank of reach-in coolers along a face: the doors' frames, the glass, the lit shelves of
// drinks behind, the lights down each mullion, a lit header with its sign; kinds(door) the
// stock behind each door
function coolers(K, dir, line, a0, a1, o) {
	const F = frame(dir, line), [L0, L1] = F.L(a0, a1), g = K.g, s = K.s, D = o.depth ?? 0.85, top = o.top ?? 2.08;
	const n = Math.max(1, Math.floor((L1 - L0) / 0.76)), dw = (L1 - L0) / n;
	use(K, F);
	// the cabinet: its kick, its back and ends, the header box over the doors
	g.box('gloss', L0, 0, -D, L1, 0.24, 0.02, C.black);
	g.box('gloss', L0, top, -D, L1, top + 0.36, 0.03, C.black);
	for (const x of [L0, L1]) g.box('gloss', x - 0.03, 0, -D, x + 0.03, top + 0.36, 0.03, C.black);
	g.box('matte', L0, 0.24, -D, L1, top, -D + 0.03, C.white);
	g.box('gloss', L0, 0.24, -0.05, L1, 0.3, 0.02, C.black);
	g.box('gloss', L0, top - 0.06, -0.05, L1, top, 0.02, C.black);
	const lv = o.levels || [0.32, 0.66, 1.0, 1.34, 1.68];
	for (let k = 0; k < n; k++) {
		const x = L0 + k * dw, kind = o.kinds(k);
		// the mullion and its light (a fixture of the bake: a cool pool on the floor before it)
		g.box('gloss', x - 0.025, 0.24, -0.06, x + 0.025, top, 0.02, C.black);
		fbox(K, F, K.mats.panel, x + 0.03, 0.34, -0.09, x + 0.05, top - 0.1, -0.07);
		// the shelves inside, their stock
		for (let i = 0; i < lv.length; i++) {
			const y = lv[i], t = i + 1 < lv.length ? lv[i + 1] - 0.02 : top - 0.08;
			g.box('metal', x + 0.03, y - 0.015, -D + 0.05, x + dw - 0.03, y, -0.1, C.steel);
			const kk = typeof kind === 'function' ? kind(i) : kind;
			if (o.face) s.face(kk, x + 0.05, x + dw - 0.05, y, Math.min(0.45, t - y), -0.3, (o.seed || 0) + k * 7 + i, 1.2);
			else s.run(kk, x + 0.05, x + dw - 0.05, y, t - y, -0.13, D - 0.25, (o.seed || 0) + k * 7 + i, 1.25);
		}
		// the door's handle (by its free edge) and its frame
		const hx = k % 2 ? x + 0.07 : x + dw - 0.07;
		g.box('metal', hx - 0.015, 0.85, 0.03, hx + 0.015, 1.75, 0.06, C.steel);
		g.box('gloss', x + 0.02, 0.3, 0.0, x + 0.045, top - 0.06, 0.025, C.black);
		g.box('gloss', x + dw - 0.045, 0.3, 0.0, x + dw - 0.02, top - 0.06, 0.025, C.black);
	}
	g.box('gloss', L1 - 0.025, 0.24, -0.06, L1 + 0.025, top, 0.02, C.black);
	fbox(K, F, K.mats.glass, L0, 0.3, 0.008, L1, top - 0.06, 0.016);
	// the lit header and its sign
	if (o.signs) {
		const per = Math.max(1, Math.round((L1 - L0) / 3.2)), sw = (L1 - L0) / per;
		for (let i = 0; i < per; i++) s.sign(o.signs[i % o.signs.length], L0 + i * sw + 0.08, L0 + (i + 1) * sw - 0.08, top + 0.06, 0.24, 0.035, o.signCol || K.brand.bg, 1.3);
	}
	solid(K, F, L0, -D, L1, 0.03, top + 0.36);
	return { F, L0, L1, n, dw };
}
// an open case (dairy, deli, produce misted): shelves stepping back, lit from above, no doors
function openCase(K, dir, line, a0, a1, o) {
	const F = frame(dir, line), [L0, L1] = F.L(a0, a1), g = K.g, s = K.s, D = 0.95;
	use(K, F);
	g.box('gloss', L0, 0, -D, L1, 0.5, 0.0, o.body || C.white);
	g.box('gloss', L0, 0.5, -D, L1, 2.1, -D + 0.05, C.black);
	g.box('gloss', L0, 1.95, -D, L1, 2.15, -0.35, o.body || C.white);
	fbox(K, F, K.mats.panel, L0 + 0.05, 1.93, -0.45, L1 - 0.05, 1.95, -0.38);
	for (const x of [L0, L1]) g.box('gloss', x - 0.03, 0, -D, x + 0.03, 2.15, 0.0, o.body || C.white);
	const lv = [0.5, 0.86, 1.2, 1.52];
	lv.forEach((y, i) => {
		const z0 = -0.05 - i * 0.12, t = i + 1 < lv.length ? lv[i + 1] - 0.02 : 1.9;
		g.box('metal', L0, y - 0.02, -D + 0.05, L1, y, z0, C.steel);
		for (let x = L0, b = 0; x < L1 - 0.05; x += 1.2, b++) s.run(o.kinds(i, b), x, Math.min(L1, x + 1.2), y, t - y, z0 - 0.02, 0.5, (o.seed || 0) + i * 3 + b, 1.2);
	});
	if (o.sign) s.sign(o.sign, L0 + 0.2, L1 - 0.2, 2.18, 0.26, -0.3, o.signCol || K.brand.bg, 1.3);
	solid(K, F, L0, -D, L1, 0.0, 2.15);
	return F;
}

// ---------------------------------------------------------------------------------
// counters

// a shop's counter along a face (its customer side at z = 0, the clerk's behind at -depth): a
// front in the brand's colour with its stripe, the top, the register and what stands by it;
// impulse: the candy racks and the gum on the customer side
function counter(K, dir, line, a0, a1, o = {}) {
	const F = frame(dir, line), [L0, L1] = F.L(a0, a1), g = K.g, s = K.s, D = o.depth ?? 0.7, hgt = 0.98;
	use(K, F);
	g.box('gloss', L0, 0.1, -D, L1, hgt, -0.02, o.front || K.brand.bg);
	g.box('matte', L0, 0, -D + 0.05, L1, 0.1, -0.06, C.black);
	g.box('gloss', L0, hgt * 0.62, -0.025, L1, hgt * 0.68, -0.015, K.brand.fg);
	g.box('stone', L0 - 0.03, hgt, -D - 0.02, L1 + 0.03, hgt + 0.04, 0.03, o.top || lin([0.24, 0.24, 0.25]));
	solid(K, F, L0, -D, L1, 0.03, hgt + 0.04);
	// the register: its screen toward the clerk, the drawer, the card reader toward you
	const rx = o.reg ?? (L0 + L1) / 2, y = hgt + 0.04;
	g.box('gloss', rx - 0.22, y, -D + 0.1, rx + 0.22, y + 0.1, -D + 0.5, C.black);
	g.box('gloss', rx - 0.2, y + 0.1, -D + 0.28, rx + 0.2, y + 0.42, -D + 0.32, C.black);
	fbox(K, F, K.mats.screen, rx - 0.18, y + 0.13, -D + 0.27, rx + 0.18, y + 0.4, -D + 0.275);
	g.box('gloss', rx + 0.3, y, -0.32, rx + 0.42, y + 0.14, -0.22, C.black);
	fbox(K, F, K.mats.screen, rx + 0.31, y + 0.08, -0.215, rx + 0.41, y + 0.13, -0.212);
	spot(K, F, rx, -D - 0.45, 0, 1, true);
	spot(K, F, rx + 0.1, 0.55, 0, -1);
	if (o.impulse) {
		// the candy racks: three tiers stepping out from the counter's front, the gum on top
		for (let t = 0; t < 3; t++) {
			const yy = 0.18 + t * 0.26, zz = 0.3 - t * 0.09;
			g.box('metal', L0 + 0.1, yy - 0.02, -0.02, L1 - 0.1, yy, zz, C.steelDark);
			s.run(t === 2 ? 'candy' : t === 1 ? 'candy' : 'chips', L0 + 0.12, L1 - 0.12, yy, 0.22, zz - 0.01, zz - 0.04, t * 3 + 1, 0.95);
		}
		solid(K, F, L0 + 0.1, -0.02, L1 - 0.1, 0.32, 0.9);
		g.box('metal', rx - 0.75, y, -0.25, rx - 0.35, y + 0.03, 0.0, C.steelDark);
		s.run('candy', rx - 0.74, rx - 0.36, y + 0.03, 0.14, -0.02, 0.2, 9, 1.0);
	}
	return { F, L0, L1, D, y };
}

// ---------------------------------------------------------------------------------
// the light: strips down the room (the bake finds each a fixture), and the brand's stripe
function strips(K, x0, x1, z0, z1, y, every = 2.4) {
	const n = Math.max(1, Math.round((x1 - x0) / every));
	for (let i = 0; i < n; i++) {
		const x = x0 + (i + 0.5) * (x1 - x0) / n;
		// (its housing against the ceiling, the lit lens under it)
		K.g.at(0, 0, 0, 0); K.g.box('metal', x - 0.12, y - 0.035, z0 - 0.05, x + 0.12, y, z1 + 0.05, C.white);
		K.box(K.mats.panel, x - 0.085, y - 0.06, z0, x + 0.085, y - 0.035, z1);
	}
}
function stripe(K, y = 2.48) {
	const w = K.wall, b = K.brand, light = [0.92, 0.92, 0.9];
	for (const [x0, z0, x1, z1] of [[w.x0, w.z0, w.x1, w.z0 + 0.02], [w.x0, w.z0, w.x0 + 0.02, w.z1], [w.x1 - 0.02, w.z0, w.x1, w.z1]]) {
		K.band(x0, z0, x1, z1, b.bgs, y, y + 0.16);
		K.band(x0, z0, x1, z1, light, y + 0.16, y + 0.2);
		K.band(x0, z0, x1, z1, b.fgs, y + 0.2, y + 0.3);
	}
}

// ---------------------------------------------------------------------------------
// the fit-outs

// a gas station's food mart, a corner store (bay/siteplan.js b.store): fuel or corner
export function* fitMart(K, store) {
	const w = K.wall, g = K.g, s = K.s, r = K.rnd, corner = store === 'corner';
	const front = w.z1, kx = w.x1 - 1.95;
	stripe(K);
	strips(K, w.x0 + 0.3, w.x1 - 0.3, w.z0 + 0.6, w.z1 - 0.6, K.ceil);
	yield;
	// the coolers down the back wall: the dairy and frozen at the left, then the sodas, the cans,
	// the water and energy drinks, the beer at the right (more of it in a corner store)
	const ca = w.x0 + 1.5, cb = w.x1 - 0.05;
	const order = corner ? ['dairy', 'frozen', 'soda', 'cancool', 'water', 'energy', 'beer', 'beer', 'beer', 'beer', 'beer', 'beer'] : ['dairy', 'frozen', 'soda', 'soda', 'cancool', 'cancool', 'water', 'energy', 'energy', 'beer', 'beer', 'beer'];
	const nDoors = Math.floor((cb - ca) / 0.76);
	const pickDoor = (k) => order[Math.min(order.length - 1, Math.floor(k * order.length / nDoors))];
	coolers(K, '+z', w.z0 + 0.85, ca, cb, { kinds: pickDoor, signs: corner ? ['DAIRY', 'COLD DRINKS', 'BEER & WINE'] : ['DAIRY', 'COLD DRINKS', 'COLD DRINKS', 'BEER & WINE'], seed: 11 });
	for (let k = 0; k < 3; k++) spot(K, frame('+z', w.z0 + 0.85), ca + 1 + k * (cb - ca - 2) / 2, 0.75, 0, -1);
	// the doors in the back corner: the restrooms, the stockroom
	g.at(0, 0, 0, 0);
	g.box('grain', w.x0 + 0.15, 0, w.z0, w.x0 + 1.05, 2.1, w.z0 + 0.05, C.oak);
	g.box('metal', w.x0 + 0.9, 0.95, w.z0 + 0.05, w.x0 + 0.95, 1.1, w.z0 + 0.1, C.steel);
	s.at(0, 0, 0, 0); s.sign('RESTROOMS', w.x0 + 0.15, w.x0 + 1.05, 2.18, 0.14, w.z0 + 0.06, lin([0.1, 0.35, 0.6]), 1.0);
	g.box('grain', w.x0, 0, w.z0 + 0.4, w.x0 + 0.05, 2.1, w.z0 + 1.3, C.steelDark);
	s.at(0, 0, 0, 0);
	yield;
	// the gondolas, low enough to see over, running back from the front so the coolers glow at
	// the end of every aisle: household and the car's things by the coffee, the groceries, the
	// snacks nearest the counter
	const gz0 = w.z0 + 0.85 + 1.45 + 0.42, gz1 = front - 2.5 - 0.42;
	const gxa = w.x0 + 0.75 + 1.35 + 0.44, gxb = kx - 1.8 - 0.44;
	const nG = gz1 - gz0 < 1.2 ? 0 : Math.max(1, Math.min(4, Math.floor((gxb - gxa) / 2.25) + 1)), pitch = nG > 1 ? (gxb - gxa) / (nG - 1) : 0;
	const THEMES = [
		[['paper', 'laundry'], ['clean', 'auto'], ['care', 'meds'], ['meds', 'care']],
		[['cans', 'dry'], ['jars', 'cans'], ['cereal', 'bread'], ['dry', 'bread']],
		[['chips', 'cookies'], ['chips', 'chips'], ['candy', 'cookies'], ['candy', 'chips']],
		[['chips', 'chips'], ['cookies', 'chips'], ['candy', 'candy'], ['candy', 'cookies']],
	];
	const SIGN = ['HOUSEHOLD', 'GROCERY', 'SNACKS', 'SNACKS'];
	for (let i = 0; i < nG; i++) {
		const x = nG > 1 ? gxa + i * pitch : (gxa + gxb) / 2, T = THEMES[nG < 3 ? i + 1 : i];
		gondolaZ(K, gz0, gz1, x, { h: 1.45, levels: [0.12, 0.47, 0.82, 1.17], kinds: (lv, b, side) => T[3 - lv][(b + (side > 0 ? 0 : 1)) % 2], ends: i % 2 ? ['chips', 'soda', 'candy', 'cancool'] : ['cancool', 'chips', 'water', 'candy'], sign: SIGN[nG < 3 ? i + 1 : i], seed: 20 + i * 9 });
		spot(K, frame('+x', x + 0.44), -(gz0 + r() * (gz1 - gz0)), 0.65, 0, -1);
	}
	yield;
	// the counter by the door: the clerk's side toward the wall
	const kz0 = front - 4.3, kz1 = front - 1.0;
	const ct = counter(K, '-x', kx, kz0, kz1, { impulse: true, depth: 0.72, reg: undefined });
	{
		// the lottery: the terminal, the case of scratch tickets on the counter
		const F = ct.F, y = ct.y;
		use(K, F);
		g.box('gloss', ct.L0 + 0.2, y, -0.55, ct.L0 + 0.6, y + 0.32, -0.35, C.black);
		fbox(K, F, K.mats.screen, ct.L0 + 0.22, y + 0.06, -0.345, ct.L0 + 0.58, y + 0.3, -0.34);
		g.box('glass', ct.L1 - 1.2, y, -0.65, ct.L1 - 0.1, y + 0.3, -0.35, C.glassTint);
		s.face('smokes', ct.L1 - 1.18, ct.L1 - 0.12, y + 0.02, 0.26, -0.36, 41, 1.2);
		// the tip jar, the lighters, a stack of the day's papers
		g.cyl('glass', ct.L0 + 1.0, y, -0.15, 0.06, 0.16, C.glassTint, 8);
		g.box('matte', ct.L0 + 1.3, y, -0.2, ct.L0 + 1.6, y + 0.1, -0.05, lin([0.85, 0.2, 0.15]));
	}
	// the tobacco wall behind the clerk, its lit price header; the back counter under it
	{
		const F = frame('-x', w.x1);
		const [a, b] = F.L(kz0 - 0.2, kz1 + 0.1);
		use(K, F);
		g.box('grain', a, 0, -0.02, b, 0.95, 0.5, lin([0.3, 0.3, 0.32]));
		g.box('stone', a, 0.95, -0.02, b, 0.99, 0.52, lin([0.24, 0.24, 0.25]));
		g.box('gloss', a, 1.15, -0.02, b, 2.45, 0.3, C.black);
		s.face('smokes', a + 0.05, b - 0.05, 1.22, 0.42, 0.31, 3, 1.15);
		s.face('smokes', a + 0.05, b - 0.05, 1.68, 0.42, 0.31, 4, 1.15);
		s.sign('LOTTERY', a + 0.05, b - 0.05, 2.14, 0.22, 0.31, K.brand.bg, 1.3);
		solid(K, F, a, -0.02, b, 0.52, 2.45);
		// the cameras' monitor up in the corner
		g.box('gloss', b - 0.1, 2.55, 0.1, b + 0.05, 2.9, 0.55, C.black);
		fbox(K, F, K.mats.screen, b - 0.11, 2.58, 0.13, b - 0.105, 2.87, 0.52);
	}
	yield;
	// the coffee bar down the left wall: the brewers and their pots, the cups and lids, the
	// cappuccino machine, then the fountain with its ice, the slush drums, the roller grill
	{
		const za = front - 6.2, zb = front - 0.9;
		const F = frame('+x', w.x0);
		const [L0, L1] = F.L(Math.max(za, w.z0 + 1.6), zb), D = 0.72;
		use(K, F);
		g.box('grain', L0, 0, -0.02, L1, 0.92, D, lin([0.35, 0.24, 0.16]));
		g.box('stone', L0, 0.92, -0.02, L1, 0.96, D + 0.03, lin([0.82, 0.8, 0.76]));
		solid(K, F, L0, -0.02, L1, D + 0.03, 1.0);
		let x = L0 + 0.15;
		// the brewers
		for (let i = 0; i < 3 && x < L1 - 0.6; i++, x += 0.5) {
			// (its tower at the back, the hood over the pot, the warmer plate, the pot of coffee on it,
			// a second pot on the warmer on top)
			g.box('gloss', x, 0.96, 0.02, x + 0.4, 1.62, 0.2, C.black);
			g.box('gloss', x, 1.4, 0.2, x + 0.4, 1.56, 0.44, C.black);
			g.box('metal', x + 0.02, 1.44, 0.44, x + 0.38, 1.52, 0.445, C.steel);
			g.box('metal', x + 0.03, 0.96, 0.2, x + 0.37, 0.99, 0.44, C.steelDark);
			g.cyl('glass', x + 0.2, 0.99, 0.32, 0.075, 0.17, lin([0.18, 0.1, 0.05]), 10);
			g.cyl('gloss', x + 0.2, 1.16, 0.32, 0.08, 0.035, C.black, 10);
			g.box('metal', x + 0.28, 1.08, 0.31, x + 0.31, 1.12, 0.42, C.black);
			g.cyl('glass', x + 0.2, 1.62, 0.12, 0.07, 0.15, lin([0.18, 0.1, 0.05]), 10);
		}
		// the cups and lids
		for (let i = 0; i < 4; i++) g.cyl('matte', x + 0.1 + i * 0.12, 0.96, 0.55, 0.045, 0.45, C.paper, 8);
		x += 0.6;
		// the fountain: its lit front, the nozzles, the ice
		if (x < L1 - 1.0) {
			g.box('gloss', x, 0.96, 0.02, x + 0.9, 1.75, 0.5, C.black);
			fbox(K, F, K.mats.screen, x + 0.04, 1.42, 0.505, x + 0.86, 1.72, 0.51);
			for (let i = 0; i < 6; i++) g.box('metal', x + 0.08 + i * 0.13, 1.25, 0.45, x + 0.16 + i * 0.13, 1.33, 0.55, C.steel);
			g.box('metal', x + 0.05, 0.96, 0.4, x + 0.85, 1.0, 0.6, C.steel);
			spot(K, F, x + 0.45, D + 0.65, 0, -1);
			x += 1.0;
		}
		// the slush drums
		if (x < L1 - 0.7) {
			g.box('gloss', x, 0.96, 0.05, x + 0.62, 1.2, 0.5, C.black);
			for (const [i, c] of [[0, lin([0.85, 0.1, 0.15])], [1, lin([0.1, 0.35, 0.9])]]) { g.cyl('glass', x + 0.16 + i * 0.3, 1.2, 0.28, 0.13, 0.42, c, 10); g.cyl('matte', x + 0.16 + i * 0.3, 1.2, 0.28, 0.12, 0.3, c, 10); }
			x += 0.75;
		}
		// the roller grill under its guard, the hot dogs turning
		if (x < L1 - 0.6) {
			g.box('metal', x, 0.96, 0.08, x + 0.6, 1.08, 0.55, C.steel);
			for (let i = 0; i < 7; i++) g.cyl('matte', x + 0.05, 1.11, 0.13 + i * 0.06, 0.022, 0.5, lin([0.62, 0.22, 0.12]), 6, 'x');
			g.box('glass', x, 1.2, 0.1, x + 0.6, 1.24, 0.55, C.glassTint);
			fbox(K, F, K.mats.panel, x + 0.05, 1.42, 0.2, x + 0.55, 1.44, 0.45);
		}
		spot(K, F, L0 + 0.8, D + 0.6, 0, -1);
		// the menu board over it
		// (proud of the wall's paint)
		s.sign('COFFEE', L0 + 0.1, L0 + 2.0, 2.0, 0.28, 0.03, lin([0.3, 0.17, 0.08]), 1.2);
		s.sign('HOT FOOD', L1 - 2.0, L1 - 0.1, 2.0, 0.28, 0.03, lin([0.75, 0.12, 0.08]), 1.2);
	}
	yield;
	// by the door: the ice cream chest, a spinner of chips, the ATM, the mat
	{
		g.at(0, 0, 0, 0);
		// (against the window right of the door, its lids toward the room)
		const ix0 = K.doorX + 1.25, iz = front - 0.78;
		if (ix0 + 1.4 < kx - 0.9) {
			// (open under its sliding lids: its walls, its well)
			for (const [a0, b0, a1, b1] of [[ix0, iz, ix0 + 1.4, iz + 0.06], [ix0, iz + 0.64, ix0 + 1.4, iz + 0.7], [ix0, iz, ix0 + 0.06, iz + 0.7], [ix0 + 1.34, iz, ix0 + 1.4, iz + 0.7]]) g.box('gloss', a0, 0, b0, a1, 0.82, b1, C.white);
			g.box('gloss', ix0 + 0.06, 0, iz + 0.06, ix0 + 1.34, 0.58, iz + 0.64, lin([0.82, 0.84, 0.86]));
			g.box('glass', ix0 + 0.04, 0.82, iz + 0.04, ix0 + 1.36, 0.86, iz + 0.66, C.glassTint);
			// (the tubs and bars inside, seen down through the lid)
			s.at(0, 0, 0, 0);
			s.quad([ix0 + 0.06, 0.62, iz + 0.66], [ix0 + 1.34, 0.62, iz + 0.66], [ix0 + 1.34, 0.62, iz + 0.06], [ix0 + 0.06, 0.62, iz + 0.06], stripUV('frozen', 1), 1.2);
			K.col.push([ix0, iz, ix0 + 1.4, iz + 0.7, 0, 0.86]);
			const F = frame('-z', iz - 0.004), [a, b] = F.L(ix0 + 0.1, ix0 + 1.3);
			use(K, F);
			s.sign('ICE CREAM', a, b, 0.5, 0.15, 0, K.brand.bg, 1.2);
		}
		// a spinner rack of chips by the window
		const sx = K.doorX - 2.4, sz = front - 1.5;
		if (sx > w.x0 + 1.4) {
			g.box('metal', sx - 0.02, 0, sz - 0.02, sx + 0.02, 1.6, sz + 0.02, C.steelDark);
			for (const [dir, line] of [['+z', sz + 0.2], ['-z', sz - 0.2], ['+x', sx + 0.2], ['-x', sx - 0.2]]) {
				const F = frame(dir, line), [a, b] = F.L(dir.endsWith('z') ? sx - 0.2 : sz - 0.2, dir.endsWith('z') ? sx + 0.2 : sz + 0.2);
				use(K, F);
				s.face('chips', a, b, 0.4, 1.1, 0.0, 61 + line, 1.0);
			}
			K.col.push([sx - 0.22, sz - 0.22, sx + 0.22, sz + 0.22, 0, 1.6]);
		}
		// the ATM against the front, by the door
		g.at(0, 0, 0, 0);
		const ax = K.doorX - 1.5;
		g.box('gloss', ax - 0.35, 0, front - 0.62, ax + 0.35, 1.55, front - 0.02, lin([0.15, 0.17, 0.2]));
		g.box('gloss', ax - 0.3, 1.0, front - 0.7, ax + 0.3, 1.05, front - 0.62, lin([0.3, 0.32, 0.35]));
		K.box(K.mats.screen, ax - 0.18, 1.1, front - 0.64, ax + 0.18, 1.38, front - 0.62);
		K.col.push([ax - 0.35, front - 0.7, ax + 0.35, front - 0.02, 0, 1.55]);
		// the mat inside the door
		g.box('fabric', K.doorX - 0.9, 0.0, front - 1.6, K.doorX + 0.9, 0.012, front - 0.05, lin([0.08, 0.08, 0.09]));
	}
	// the cameras on the ceiling, the round mirror in the back corner
	g.at(0, 0, 0, 0);
	for (const [x, z] of [[w.x0 + 2, w.z0 + 2], [kx - 1, front - 2]]) g.sphere('gloss', x, K.ceil - 0.02, z, 0.09, 0.08, 0.09, C.black, 8);
	g.sphere('mirror', w.x1 - 0.45, 2.45, w.z0 + 0.45, 0.32, 0.32, 0.12, C.white, 10);
}

// ---------------------------------------------------------------------------------
// the shops by trade (economy/establishments.js TYPES): what each sells, how it is laid out
const TRADE = {
	grocer: 'grocer', general: 'grocer', farmstand: 'grocer', butcher: 'grocer', feed: 'hardware',
	hardware: 'hardware', pharmacy: 'pharmacy', liquor: 'liquor', winery: 'liquor',
	bookshop: 'books', records: 'books', antiques: 'variety', gift: 'variety',
	boutique: 'clothes', thrift: 'clothes', surf: 'clothes', tailor: 'clothes',
	pet: 'pet', phonefix: 'tech', bike: 'variety', outfitter: 'variety', bait: 'variety', huntpost: 'variety',
	florist: 'florist', salon: 'salon', barber: 'salon', laundromat: 'laundry', gym: 'gym', yoga: 'gym', vet: 'clinic',
};
export const tradeOf = (type) => TRADE[type] || 'variety';

// the checkout by the door (and a second for a big shop): its customer side toward the room
function frontCounter(K, impulse = true, len = 2.4) {
	const w = K.wall, side = K.doorX < 0 ? 1 : -1;
	// (on the side of the door with more room)
	const x0 = side > 0 ? Math.min(w.x1 - len - 0.9, K.doorX + 1.6) : Math.max(w.x0 + 0.9, K.doorX - 1.6 - len);
	return counter(K, '-z', w.z1 - 1.9, x0, x0 + len, { impulse, depth: 0.7 });
}
// the rows of gondolas filling the middle, front to back; kinds(row, level, bay, side)
function aisles(K, o) {
	const w = K.wall, x0 = w.x0 + (o.left ?? 1.4), x1 = w.x1 - (o.right ?? 1.4), z0 = w.z0 + (o.back ?? 1.6), z1 = w.z1 - (o.front ?? 3.2);
	const pitch = (o.depth ?? 0.44) * 2 + (o.aisle ?? 1.5);
	let i = 0;
	for (let z = z0 + (o.depth ?? 0.44); z + (o.depth ?? 0.44) < z1; z += pitch, i++) {
		const row = i;
		gondola(K, x0 + (o.ends ? 0.42 : 0), x1 - (o.ends ? 0.42 : 0), z, { ...o, kinds: (lv, b, side) => o.kinds(row, lv, b, side), seed: (o.seed || 0) + row * 13, sign: o.signs?.[row % o.signs.length] });
		spot(K, frame('+z', z + 0.44), x0 + 1 + K.rnd() * (x1 - x0 - 2), 0.62, 0, -1);
	}
	return i;
}

export function* fitShop(K, type) {
	const t = tradeOf(type), w = K.wall, g = K.g, s = K.s, r = K.rnd;
	const iw = w.x1 - w.x0, id = w.z1 - w.z0;
	stripe(K);
	strips(K, w.x0 + 0.4, w.x1 - 0.4, w.z0 + 0.6, w.z1 - 0.8, K.ceil);
	yield;
	if (t === 'grocer') {
		// the dairy along the back, the frozen down one side, produce by the door, aisles between
		openCase(K, '+z', w.z0 + 0.95, w.x0 + 0.2, w.x1 - 0.2, { kinds: (i) => ['dairy', 'dairy', 'bread', 'dairy'][i], sign: 'DAIRY' });
		yield;
		if (id > 9) coolers(K, '+x', w.x0 + 0.85, w.z0 + 1.6, w.z1 - 3.4, { kinds: () => 'frozen', signs: ['FROZEN FOODS'], seed: 5 });
		const n = aisles(K, { left: id > 9 ? 2.4 : 1.2, right: 1.2, back: 2.5, front: 3.6, h: 1.8, levels: [0.12, 0.48, 0.84, 1.2, 1.56], ends: ['chips', 'soda', 'cereal', 'cans', 'cookies'], signs: ['GROCERY', 'SNACKS', 'HOUSEHOLD'],
			kinds: (row, lv, b, side) => [['cans', 'jars', 'dry', 'cereal', 'dry'], ['chips', 'cookies', 'candy', 'chips', 'cookies'], ['paper', 'laundry', 'clean', 'care', 'meds']][row % 3][(lv + b + (side > 0 ? 0 : 2)) % 5] });
		yield;
		// produce: angled bins of fruit and greens by the windows
		for (let x = w.x0 + 1.2, k = 0; x < w.x1 - 4.5 && k < 3; x += 1.9, k++) item(K, frame('+z', 0), 'produce', x + 0.8, w.z1 - 2.6, 1.6, 0.9, 0.85, 0);
		frontCounter(K, true, 2.2);
		if (iw > 12) { const c2 = counter(K, '-z', w.z1 - 1.9, w.x1 - 4.2, w.x1 - 2.0, { impulse: true, depth: 0.7 }); void c2; }
	} else if (t === 'hardware') {
		// tall runs with pegboard above their shelves, the paint desk and its wall of chips at the
		// back, the drawers of fasteners down one wall, lumber and pipe on a rack down the other
		const orange = [C.orange[0], C.orange[1], C.orange[2]];
		g.at(0, 0, 0, 0);
		// the paint desk
		const px0 = w.x0 + iw * 0.35, px1 = Math.min(w.x1 - 1.5, px0 + 3.2);
		counter(K, '+z', w.z0 + 1.6, px0, px1, { front: lin([0.9, 0.9, 0.88]) });
		{
			const F = frame('+z', w.z0);
			use(K, F);
			// the colour chips: a wall of little swatches, rows of them
			// (on the goods' sheet: a plain patch each, in its colour)
			g.box('matte', px0 - 0.05, 1.0, 0.0, px1 + 0.05, 2.32, 0.02, C.white);
			for (let y = 1.05, j = 0; y < 2.25; y += 0.12, j++) for (let x = px0, i = 0; x < px1 - 0.05; x += 0.09, i++) {
				const hue = (i * 0.618 + j * 0.13) % 1, v = 0.35 + 0.6 * ((j * 0.37) % 1);
				s.solid(x, y, 0.02, x + 0.08, y + 0.1, 0.024, lin(hsl(hue, 0.55, v)), 1.0, 'f');
			}
			s.sign('PAINT', px0, px1, 2.4, 0.28, 0.03, orange, 1.25);
			// the shaker and the tinting machine on the desk
			g.box('metal', px0 + 0.2, 1.02, 0.95, px0 + 0.7, 1.55, 1.4, lin([0.8, 0.8, 0.82]));
			g.box('gloss', px1 - 0.8, 1.02, 0.95, px1 - 0.2, 1.75, 1.45, lin([0.92, 0.92, 0.9]));
		}
		shelfRun(K, '+z', w.z0 + 0.5, w.x0 + 0.2, px0 - 0.3, { h: 2.1, depth: 0.45, levels: [0.12, 0.5, 0.88, 1.26, 1.64], kinds: (i) => ['paint', 'paint', 'paint', 'paint', 'paint'][i], back: C.peg, peg: true, seed: 7 });
		shelfRun(K, '+z', w.z0 + 0.5, px1 + 0.3, w.x1 - 0.2, { h: 2.1, depth: 0.45, levels: [0.12, 0.5, 0.88, 1.26, 1.64], kinds: (i) => ['laundry', 'clean', 'paint', 'tools', 'tools'][i], back: C.peg, seed: 8 });
		yield;
		// the fasteners' drawers down the left wall
		shelfRun(K, '+x', w.x0 + 0.5, w.z0 + 1.0, w.z1 - 3.0, { h: 2.0, depth: 0.45, levels: [0.12, 0.45, 0.78, 1.11, 1.44], kinds: (i, b) => i < 1 ? 'tools' : b % 3 === 2 ? 'peg' : 'bins', back: C.peg, peg: true, seed: 9 });
		// lumber and pipe on a rack down the right wall
		{
			const F = frame('-x', w.x1), [a, b] = F.L(w.z0 + 1.0, w.z1 - 3.4);
			use(K, F);
			for (let x = a; x <= b; x += 1.2) g.box('metal', x - 0.04, 0, 0.0, x + 0.04, 2.4, 0.6, orange);
			for (const y of [0.3, 0.9, 1.5, 2.1]) {
				g.box('metal', a, y - 0.04, 0.0, b, y, 0.6, orange);
				for (let z = 0.06; z < 0.55; z += 0.1) g.box('grain', a + 0.05, y, z, b - 0.05, y + 0.09, z + 0.085, lin([0.86, 0.72, 0.5]));
			}
			solid(K, F, a, 0, b, 0.6, 2.4);
		}
		yield;
		aisles(K, { left: 1.8, right: 1.8, back: 2.6, front: 3.4, h: 2.0, peg: true, levels: [0.12, 0.5, 0.88], ends: ['tools', 'paint', 'tools'], signs: ['TOOLS', 'PLUMBING', 'ELECTRICAL', 'GARDEN'],
			kinds: (row, lv, b, side) => lv < 2 ? ['tools', 'bins', 'paint', 'auto'][(row + b) % 4] : null, seed: 40 });
		// the pegboard above each run's shelves: the cards on their hooks
		for (const [x0, x1, z] of K.aisles) for (const sd of [-1, 1]) {
			const F = frame(sd > 0 ? '+z' : '-z', z + sd * 0.03), [a, b] = F.L(x0 + 0.42, x1 - 0.42);
			use(K, F);
			s.face(r() < 0.5 ? 'peg' : 'tech', a, b, 1.2, 0.75, 0.0, x0 * 3 + z, 1.0);
		}
		frontCounter(K, true, 2.4);
	} else if (t === 'pharmacy') {
		// the pharmacy's counter at the back with its shelves of boxes behind, the waiting chairs,
		// aisles of health and beauty, the checkout by the door
		const px0 = w.x0 + iw * 0.3, px1 = w.x1 - 1.0;
		shelfRun(K, '+z', w.z0 + 0.45, px0, px1, { h: 2.1, depth: 0.4, levels: [0.12, 0.5, 0.88, 1.26, 1.64], kinds: () => 'meds', back: C.white, seed: 3 });
		counter(K, '+z', w.z0 + 2.0, px0 + 0.3, px1 - 0.3, { front: lin([0.92, 0.92, 0.9]) });
		s.at(0, 0, 0, 0); s.sign('PHARMACY', px0 + 0.5, px1 - 0.5, 2.4, 0.3, w.z0 + 0.06, lin([0.1, 0.45, 0.3]), 1.3);
		item(K, frame('+z', 0), 'waitingChairs', w.x0 + 1.6, w.z0 + 1.0, 2.0, 0.5, 0.9, 0);
		shelfRun(K, '+x', w.x0 + 0.45, w.z0 + 2.4, w.z1 - 2.6, { h: 1.9, depth: 0.42, levels: [0.12, 0.48, 0.84, 1.2, 1.56], kinds: (i) => ['care', 'care', 'meds', 'care', 'care'][i], back: C.white, seed: 4 });
		yield;
		aisles(K, { left: 1.6, right: 1.4, back: 3.4, front: 3.4, h: 1.7, levels: [0.12, 0.5, 0.88, 1.26], ends: ['candy', 'care', 'cancool'], signs: ['HEALTH & BEAUTY', 'HOUSEHOLD', 'SNACKS'],
			kinds: (row, lv, b, side) => [['care', 'meds', 'care', 'meds'], ['paper', 'clean', 'laundry', 'paper'], ['chips', 'candy', 'cookies', 'candy']][row % 3][(lv + b) % 4], seed: 50 });
		if (id > 9) coolers(K, '-x', w.x1 - 0.85, w.z0 + 2.6, w.z1 - 3.4, { kinds: (k) => ['soda', 'water', 'cancool', 'dairy'][k % 4], signs: ['COLD DRINKS'], seed: 6 });
		frontCounter(K, true, 2.2);
	} else if (t === 'liquor') {
		// wine along both walls, the beer cave's doors at the back, spirits behind the counter
		coolers(K, '+z', w.z0 + 0.85, w.x0 + 0.3, w.x1 - 0.3, { kinds: (k) => ['beer', 'beer', 'cancool', 'beer', 'soda', 'beer'][k % 6], signs: ['BEER & WINE', 'COLD DRINKS'], seed: 12 });
		for (const [dir, line] of [['+x', w.x0 + 0.42], ['-x', w.x1 - 0.42]]) shelfRun(K, dir, line, w.z0 + 1.4, w.z1 - 2.6, { h: 2.0, depth: 0.38, levels: [0.12, 0.48, 0.84, 1.2, 1.56], kinds: (i, b) => i < 1 ? 'beer' : 'wine', back: lin([0.35, 0.24, 0.16]), seed: dir === '+x' ? 13 : 14 });
		yield;
		aisles(K, { left: 1.6, right: 1.6, back: 2.6, front: 3.6, h: 1.45, levels: [0.12, 0.47, 0.82, 1.17], ends: ['chips', 'wine', 'spirits'], signs: ['WINE', 'SPIRITS'],
			kinds: (row, lv, b) => row % 2 ? ['spirits', 'spirits', 'wine', 'wine'][lv] : ['wine', 'wine', 'wine', 'spirits'][lv], seed: 60 });
		const c = frontCounter(K, true, 2.4);
		{
			const F = c.F;
			use(K, F);
			for (const y of [1.2, 1.55, 1.9]) { K.g.box('glass', c.L0, y - 0.02, -c.D - 0.75, c.L1, y, -c.D - 0.45, C.glassTint); s.run('spirits', c.L0 + 0.05, c.L1 - 0.05, y, 0.33, -c.D - 0.47, 0.25, y * 10, 1.1); }
			K.g.box('gloss', c.L0, 0, -c.D - 0.8, c.L1, 1.18, -c.D - 0.45, lin([0.25, 0.17, 0.11]));
		}
	} else if (t === 'books') {
		// cases round the walls, low cases down the middle, tables of new books by the door
		const brown = lin([0.32, 0.2, 0.12]);
		shelfRun(K, '+z', w.z0 + 0.38, w.x0 + 0.2, w.x1 - 0.2, { h: 2.2, depth: 0.32, levels: [0.12, 0.5, 0.88, 1.26, 1.64], kinds: () => 'books', back: brown, seed: 2 });
		for (const [dir, line] of [['+x', w.x0 + 0.34], ['-x', w.x1 - 0.34]]) shelfRun(K, dir, line, w.z0 + 0.8, w.z1 - 2.8, { h: 2.2, depth: 0.32, levels: [0.12, 0.5, 0.88, 1.26, 1.64], kinds: () => 'books', back: brown, seed: line });
		yield;
		aisles(K, { left: 2.0, right: 2.0, back: 2.0, front: 4.0, h: 1.5, depth: 0.32, aisle: 1.4, levels: [0.12, 0.5, 0.88], ends: ['books'], signs: ['BOOKS', 'NEW ARRIVALS'], kinds: () => 'books', seed: 70 });
		for (let x = w.x0 + 1.6, k = 0; x < w.x1 - 2 && k < 2; x += 2.6, k++) item(K, frame('+z', 0), 'bookTable', x + 0.7, w.z1 - 2.9, 1.4, 0.8, 0.8, 0);
		item(K, frame('+z', 0), 'armchair', w.x1 - 1.2, w.z1 - 2.2, 0.85, 0.85, 0.9, 3);
		frontCounter(K, false, 1.8);
	} else if (t === 'clothes') {
		// shelves of folded clothes round the walls, rails and mannequins on the floor, tables of
		// folded stacks, the fitting rooms at the back
		shelfRun(K, '+x', w.x0 + 0.42, w.z0 + 2.2, w.z1 - 2.6, { h: 2.1, depth: 0.4, levels: [0.12, 0.6, 1.08, 1.56], kinds: () => 'clothes', back: C.white, seed: 21 });
		shelfRun(K, '-x', w.x1 - 0.42, w.z0 + 0.6, w.z1 - 2.6, { h: 2.1, depth: 0.4, levels: [0.12, 0.6, 1.08, 1.56], kinds: () => 'clothes', back: C.white, seed: 22 });
		// the fitting rooms: booths with curtains
		{
			g.at(0, 0, 0, 0);
			const n = Math.max(2, Math.min(4, Math.floor(iw / 3.2)));
			for (let k = 0; k < n; k++) {
				const x = w.x0 + 0.2 + k * 1.3;
				g.box('matte', x, 0, w.z0, x + 0.05, 2.2, w.z0 + 1.4, C.white);
				g.box('fabric', x + 0.05, 0.15, w.z0 + 1.36, x + 1.25, 2.1, w.z0 + 1.4, lin([0.35, 0.3, 0.4]));
				g.box('mirror', x + 0.3, 0.4, w.z0 + 0.02, x + 0.95, 2.0, w.z0 + 0.04, C.white);
				K.col.push([x, w.z0, x + 0.05, w.z0 + 1.4, 0, 2.2]);
			}
			K.col.push([w.x0, w.z0 + 1.35, w.x0 + 0.2 + n * 1.3, w.z0 + 1.42, 0, 2.2]);
		}
		yield;
		for (let z = w.z0 + 2.6; z < w.z1 - 3.0; z += 2.0) for (let x = w.x0 + 1.9; x < w.x1 - 1.8; x += 2.4) {
			const kind = (Math.round(x * 3 + z) % 3 + 3) % 3;
			if (kind === 0) item(K, frame('+z', 0), 'clothesRack', x, z, 1.4, 0.5, 1.6, 0);
			else if (kind === 1) item(K, frame('+z', 0), 'bookTable', x, z, 1.2, 0.8, 0.8, 0);
			else item(K, frame('+z', 0), 'mannequin', x, z, 0.4, 0.4, 1.8, r() < 0.5 ? 0 : 1);
			K.col.push([x - 0.7, z - 0.4, x + 0.7, z + 0.4, 0, 1.6]);
			spot(K, frame('+z', z + 0.6), x, 0.0, 0, -1);
		}
		frontCounter(K, false, 2.0);
	} else if (t === 'pet') {
		shelfRun(K, '+z', w.z0 + 0.45, w.x0 + 0.2, w.x1 - 0.2, { h: 2.0, depth: 0.42, levels: [0.12, 0.6, 1.1, 1.5], kinds: (i) => i < 2 ? 'pet' : 'meds', back: C.white, seed: 31 });
		// the fish: a wall of lit tanks
		{
			const F = frame('+x', w.x0), [a, b] = F.L(w.z0 + 1.2, w.z1 - 3.2);
			use(K, F);
			g.box('gloss', a, 0, 0, b, 0.8, 0.5, C.black);
			for (const y of [0.85, 1.5]) for (let x = a + 0.05; x < b - 0.7; x += 0.8) { g.box('glass', x, y, 0.02, x + 0.75, y + 0.55, 0.45, lin([0.3, 0.6, 0.75])); fbox(K, F, K.mats.screen, x + 0.02, y + 0.04, 0.04, x + 0.73, y + 0.5, 0.05); }
			solid(K, F, a, 0, b, 0.5, 2.1);
		}
		yield;
		aisles(K, { left: 1.8, right: 1.4, back: 2.6, front: 3.4, h: 1.6, levels: [0.12, 0.5, 0.88, 1.26], ends: ['pet', 'toys'], signs: ['PET SUPPLIES'], kinds: (row, lv) => lv < 2 ? 'pet' : ['toys', 'meds', 'clean'][(row + lv) % 3], seed: 80 });
		frontCounter(K, true, 2.0);
	} else if (t === 'tech') {
		// the wall of cases and chargers, display tables of phones, the repair bench at the back
		shelfRun(K, '+z', w.z0 + 0.3, w.x0 + 0.2, w.x1 - 0.2, { h: 2.1, depth: 0.25, levels: [0.12, 1.0], kinds: (i) => i ? 'tech' : 'tech', back: C.white, peg: true, seed: 41 });
		for (const [dir, line] of [['+x', w.x0 + 0.3], ['-x', w.x1 - 0.3]]) { const F = frame(dir, line), [a, b] = F.L(w.z0 + 0.8, w.z1 - 2.6); use(K, F); g.box('matte', a, 0.3, -0.3, b, 2.2, -0.28, C.white); s.face('tech', a + 0.05, b - 0.05, 0.6, 0.45, -0.27, line, 1.1); s.face('peg', a + 0.05, b - 0.05, 1.1, 0.45, -0.27, line + 1, 1.05); s.face('tech', a + 0.05, b - 0.05, 1.6, 0.45, -0.27, line + 2, 1.1); }
		yield;
		g.at(0, 0, 0, 0);
		for (let x = w.x0 + 2, k = 0; x < w.x1 - 2 && k < 3; x += 2.6, k++) {
			const z = w.z0 + (w.z1 - w.z0) * 0.45;
			g.box('grain', x - 0.8, 0, z - 0.45, x + 0.8, 0.9, z + 0.45, C.oak);
			for (let i = 0; i < 5; i++) { const px = x - 0.6 + i * 0.3; g.box('gloss', px - 0.04, 0.9, z - 0.1, px + 0.04, 0.92, z + 0.06, C.black); K.box(K.mats.screen, px - 0.035, 0.921, z - 0.09, px + 0.035, 0.923, z + 0.05); }
			K.col.push([x - 0.8, z - 0.45, x + 0.8, z + 0.45, 0, 0.92]);
			spot(K, frame('+z', z + 0.45), x, 0.5, 0, -1);
		}
		frontCounter(K, false, 2.0);
	} else if (t === 'florist') {
		// the flower cooler at the back, buckets on tiered stands, the work table
		coolers(K, '+z', w.z0 + 0.85, w.x0 + 0.4, w.x1 - 0.4, { kinds: () => 'flowers', face: true, levels: [0.32, 0.92, 1.5], signs: ['FRESH FLOWERS'], seed: 3 });
		// the stands: three wooden steps, a bucket of each kind on each
		for (let x = w.x0 + 1.4, k = 0; x < w.x1 - 1.4 && k < 5; x += 1.6, k++) for (const z of [w.z0 + 2.9, w.z0 + 4.9].filter((q) => q < w.z1 - 3)) {
			const F = frame('+z', z + 0.45);
			use(K, F);
			for (let t = 0; t < 3; t++) {
				const y = 0.2 + t * 0.3, z0 = -0.3 * (t + 1);
				g.box('grain', x - 0.6, 0, z0, x + 0.6, y, z0 + 0.3, C.oak);
				s.face('flowers', x - 0.58, x + 0.58, y, 0.45, z0 + 0.15, k * 3 + t + z, 1.05);
			}
			solid(K, F, x - 0.6, -0.9, x + 0.6, 0, 0.8);
		}
		// the work table by the counter: paper, ribbon, a bouquet being made
		{
			g.at(0, 0, 0, 0);
			const tx = w.x1 - 1.5, tz = w.z1 - 4.2;
			if (tz > w.z0 + 2.4) { g.box('grain', tx - 0.9, 0.86, tz - 0.4, tx + 0.9, 0.9, tz + 0.4, C.oak); for (const [a, b] of [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]]) g.box('metal', tx + a - 0.025, 0, tz + b - 0.025, tx + a + 0.025, 0.86, tz + b + 0.025, C.steelDark); g.box('matte', tx - 0.5, 0.9, tz - 0.25, tx + 0.2, 0.905, tz + 0.25, lin([0.92, 0.88, 0.8])); K.col.push([tx - 0.9, tz - 0.4, tx + 0.9, tz + 0.4, 0, 0.9]); spot(K, frame('-z', tz - 0.4), -tx, 0.5, 0, -1, true); }
		}
		frontCounter(K, false, 2.0);
	} else if (t === 'salon') {
		// the chairs at their mirrors down one wall, the basins at the back, the waiting bench
		const n = Math.max(2, Math.min(6, Math.floor((id - 4) / 1.5)));
		for (let k = 0; k < n; k++) {
			const z = w.z0 + 1.2 + k * 1.5;
			item(K, frame('+x', w.x0), 'mirrorStation', -z, 0.3, 1.2, 0.4, 2.0, 0);
			item(K, frame('+x', w.x0), 'salonChair', -z, 1.25, 0.6, 0.7, 1.2, 0);
			K.col.push([w.x0, z - 0.6, w.x0 + 0.5, z + 0.6, 0, 2]);
			K.seats.push([w.x0 + 1.25, z, -Math.PI / 2, true]);
			spot(K, frame('+x', w.x0), -z - 0.2, 1.95, 0, -1, true);
		}
		for (let k = 0; k < 2; k++) { item(K, frame('+z', w.z0), 'washBasin', w.x1 - 1.2 - k * 1.0, 0.35, 0.6, 0.6, 0.85, 0); }
		shelfRun(K, '-x', w.x1 - 0.32, w.z0 + 1.6, w.z1 - 3.2, { h: 1.9, depth: 0.3, levels: [0.12, 0.8, 1.2, 1.6], kinds: (i) => i ? 'care' : null, back: C.white, seed: 5 });
		item(K, frame('+z', 0), 'waitingChairs', w.x1 - 2.2, w.z1 - 2.6, 2.0, 0.5, 0.9, 2);
		frontCounter(K, false, 1.6);
	} else if (t === 'laundry') {
		// the washers in a row down one wall and back to back down the middle, the dryers
		// stacked down the other, the folding tables and chairs
		const mach = (dir, line, a0, a1, stack) => {
			const F = frame(dir, line), [a, b] = F.L(a0, a1);
			use(K, F);
			for (let x = a; x + 0.7 <= b; x += 0.72) for (let k = 0; k < (stack ? 2 : 1); k++) {
				const y = k * 0.95;
				g.box('gloss', x + 0.02, y, -0.75, x + 0.7, y + 0.92, 0, C.white);
				g.cyl('glass', x + 0.36, y + 0.45, -0.02, 0.22, 0.04, lin([0.3, 0.35, 0.4]), 14, 'z');
				g.cyl('metal', x + 0.36, y + 0.45, -0.01, 0.25, 0.02, C.steel, 14, 'z');
				K.box(K.mats.screen, ...(() => { const [p, q] = F.W(x + 0.1, 0.005), [p2, q2] = F.W(x + 0.25, 0.01); return [Math.min(p, p2), y + 0.8, Math.min(q, q2), Math.max(p, p2), y + 0.86, Math.max(q, q2)]; })());
			}
			solid(K, F, a, -0.75, b, 0, stack ? 1.9 : 0.92);
		};
		mach('+x', w.x0 + 0.75, w.z0 + 0.4, w.z1 - 2.6, false);
		mach('-x', w.x1 - 0.75, w.z0 + 0.4, w.z1 - 2.6, true);
		yield;
		g.at(0, 0, 0, 0);
		const mx = (w.x0 + w.x1) / 2;
		for (let z = w.z0 + 1.0; z < w.z1 - 3.0; z += 2.6) { g.box('stone', mx - 0.5, 0, z, mx + 0.5, 0.9, z + 1.6, lin([0.85, 0.85, 0.82])); K.col.push([mx - 0.5, z, mx + 0.5, z + 1.6, 0, 0.9]); K.seats.push([mx + 1.0, z + 0.8, Math.PI / 2, false]); }
		item(K, frame('+z', 0), 'waitingChairs', mx, w.z1 - 2.2, 2.2, 0.5, 0.9, 2);
	} else if (t === 'gym') {
		g.at(0, 0, 0, 0);
		g.box('matte', w.x0, 0.002, w.z0, w.x1, 0.012, w.z1 - 2.4, lin([0.08, 0.08, 0.09]));
		for (let x = w.x0 + 0.8, k = 0; x < w.x1 - 0.8 && k < 6; x += 1.1, k++) { item(K, frame('+z', 0), 'treadmill', x, w.z0 + 1.3, 0.8, 1.8, 1.45, 0); K.col.push([x - 0.4, w.z0 + 0.4, x + 0.4, w.z0 + 2.2, 0, 1.4]); spot(K, frame('+z', w.z0 + 1.3), x, -0.3, 0, -1); }
		g.box('mirror', w.x0 + 0.5, 0.3, w.z0 + 0.01, w.x1 - 0.5, 2.3, w.z0 + 0.03, C.white);
		for (let x = w.x0 + 1.5, k = 0; x < w.x1 - 1.5 && k < 3; x += 3.2, k++) { item(K, frame('+z', 0), 'weightRack', x, w.z0 + 4.2, 1.8, 1.4, 2.1, 0); K.col.push([x - 0.9, w.z0 + 3.9, x + 0.9, w.z0 + 4.0, 0, 2.1]); }
		for (let x = w.x0 + 1.2, k = 0; x < w.x1 - 1 && k < 5; x += 1.3, k++) item(K, frame('+z', 0), 'yogaMat', x, w.z1 - 4.0, 0.6, 1.8, 0.01, 0, { y: 0.013 });
		frontCounter(K, false, 1.8);
	} else if (t === 'clinic') {
		// a vet's: the waiting room at the front (chairs down both sides, the food and the
		// medicines on a shelf, the scale on the floor), a wall across with the exam rooms behind
		// it, each with its table, its counter and sink, its door open
		const pz = id > 7 ? w.z0 + Math.min(3.4, id * 0.4) : null;
		if (pz != null) {
			g.at(0, 0, 0, 0);
			const n = Math.max(1, Math.min(3, Math.floor(iw / 3.4))), rw = iw / n;
			for (let k = 0; k < n; k++) {
				const a = w.x0 + k * rw, b = a + rw, dx = a + rw * 0.72;
				// the wall with its doorway, the door standing open into the room
				g.box('matte', a, 0, pz - 0.05, dx - 0.45, 2.8, pz + 0.05, C.white);
				g.box('matte', dx + 0.45, 0, pz - 0.05, b, 2.8, pz + 0.05, C.white);
				g.box('matte', dx - 0.45, 2.1, pz - 0.05, dx + 0.45, 2.8, pz + 0.05, C.white);
				g.box('grain', dx + 0.42, 0, pz - 0.9, dx + 0.46, 2.08, pz - 0.05, C.oak);
				K.col.push([a, pz - 0.05, dx - 0.45, pz + 0.05, 0, 2.8], [dx + 0.45, pz - 0.05, b, pz + 0.05, 0, 2.8]);
				if (k) g.box('matte', a - 0.05, 0, w.z0, a + 0.05, 2.8, pz, C.white), K.col.push([a - 0.05, w.z0, a + 0.05, pz, 0, 2.8]);
				// the room: the table, the counter and its sink along the back, a stool
				item(K, frame('+z', 0), 'examTable', a + rw * 0.4, (w.z0 + pz) / 2, 0.6, 1.2, 0.9, 1);
				K.col.push([a + rw * 0.4 - 0.6, (w.z0 + pz) / 2 - 0.3, a + rw * 0.4 + 0.6, (w.z0 + pz) / 2 + 0.3, 0, 0.9]);
				const F = frame('+z', w.z0 + 0.62);
				use(K, F);
				g.box('grain', a + 0.2, 0, -0.62, b - 0.3, 0.88, 0, lin([0.9, 0.9, 0.88]));
				g.box('stone', a + 0.18, 0.88, -0.62, b - 0.28, 0.92, 0.02, lin([0.3, 0.3, 0.32]));
				g.box('metal', a + 0.6, 0.86, -0.45, a + 1.0, 0.92, -0.15, C.steel);
				g.box('grain', a + 0.2, 1.5, -0.62, b - 0.3, 2.2, -0.3, lin([0.9, 0.9, 0.88]));
				s.run('meds', a + 0.3, Math.min(b - 0.4, a + 1.5), 0.92, 0.2, -0.35, 0.2, k * 5 + 1, 0.95);
				solid(K, F, a + 0.2, -0.62, b - 0.3, 0.02, 0.92);
				spot(K, frame('+z', (w.z0 + pz) / 2), a + rw * 0.4, -0.85, 0, 1, true);
			}
		}
		shelfRun(K, '+x', w.x0 + 0.4, (pz ?? w.z0) + 0.4, Math.min(w.z1 - 3.2, (pz ?? w.z0) + 3.0), { h: 1.9, depth: 0.35, levels: [0.12, 0.6, 1.1, 1.5], kinds: (i) => (i < 2 ? 'pet' : 'meds'), back: C.white, seed: 9 });
		item(K, frame('+z', 0), 'waitingChairs', w.x1 - 0.45, (pz ?? w.z0) + 2.2, 2.4, 0.5, 0.9, 3);
		item(K, frame('+z', 0), 'waitingChairs', w.x0 + 1.8, w.z1 - 2.6, 2.0, 0.5, 0.9, 0);
		g.at(0, 0, 0, 0); g.box('metal', w.x0 + 0.6, 0, w.z1 - 1.6, w.x0 + 1.5, 0.05, w.z1 - 0.9, C.steelDark);
		frontCounter(K, false, 2.0);
	} else {
		// a shop of a bit of everything: gondolas of mixed goods, wall shelves, coolers at the back
		if (id > 8) coolers(K, '+z', w.z0 + 0.85, w.x0 + iw * 0.45, w.x1 - 0.3, { kinds: (k) => ['soda', 'cancool', 'water'][k % 3], signs: ['COLD DRINKS'], seed: 19 });
		shelfRun(K, '+x', w.x0 + 0.42, w.z0 + 0.4, w.z1 - 2.6, { h: 1.9, depth: 0.42, levels: [0.12, 0.5, 0.88, 1.26], kinds: (i, b) => ['toys', 'tech', 'books', 'care', 'clean'][(i + b) % 5], back: C.white, seed: 17 });
		yield;
		aisles(K, { left: 1.8, right: 1.4, back: id > 8 ? 2.6 : 1.4, front: 3.4, h: 1.5, levels: [0.12, 0.47, 0.82, 1.17], ends: ['chips', 'toys', 'candy'], signs: ['SALE', 'HOUSEHOLD', 'SNACKS'],
			kinds: (row, lv, b) => ['toys', 'tech', 'paper', 'clean', 'chips', 'candy', 'care', 'books'][(row * 3 + lv + b) % 8], seed: 90 });
		frontCounter(K, true, 2.0);
	}
}
