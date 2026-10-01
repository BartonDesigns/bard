// The landmarks' insides, laid out (interiors/plan.js planShell builds them; bay/landmarks.js
// and the boardwalk's, wharf's and lake's own modules draw the shells round them and say where
// they stand). Each is laid out the way the real one is, simplified: its great rooms first,
// the walls between them straight, the doors where you would look for them. In the plan's
// frame: x across the front, the front at +z, y up from the ground floor.

import { planShell } from './plan.js';

// a room the width of the building, from z0 to z1, at level k
const band = (K, k, type, z0, z1, extra) => K.room(k, type, -K.hw, z0, K.hw, z1, extra);

// the Ferry Building (1898): the long skylit nave on the ground floor, the marketplace, its
// stalls down both sides and an island of them down the middle; the clock tower's foot a
// pier of stone by the main door
export const ferryBuilding = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 11.5 }], top: 13.6,
	doors: [{ side: 'z+', u: -door.x, w: 3.2 }, { side: 'z-', u: 0, w: 3.2 }, { side: 'z-', u: -50, w: 3.2 }, { side: 'z-', u: 50, w: 3.2 }, { side: 'x+', u: 0, w: 3.2 }, { side: 'x-', u: 0, w: 3.2 }],
	layout: (K) => {
		band(K, 0, 'market', -K.hd, K.hd);
		// (the tower stands 11 m square, 0.5 m behind the front's middle)
		K.solid(0, -5.6, 0.4, 5.6, 11.6, 11.5);
	},
});

// San Francisco City Hall (1915): through the east doors into the rotunda under the dome,
// the grand staircase climbing to the second floor's gallery round it; offices down the wings
export const sfCityHall = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 7.5 }, { y: 8, h: 7 }], top: 25.6,
	layout: (K) => {
		const cx = 24, k1 = 1;
		// the ground floor: the wings either side of the rotunda's hall, a door into each
		K.room(0, 'rotunda', -cx, -K.hd, cx, K.hd);
		for (const s of [-1, 1]) {
			const x0 = s < 0 ? -K.hw : cx + 0.05, x1 = s < 0 ? -cx - 0.05 : K.hw, w = K.wall(0, 'z', s * cx, -K.hd, K.hd);
			const n = 4, step = 2 * K.hd / n;
			for (let i = 0; i < n; i++) {
				const z0 = -K.hd + i * step, z1 = z0 + step;
				K.room(0, 'office', x0, z0 + (i ? 0.05 : 0), x1, z1 - (i < n - 1 ? 0.05 : 0));
				if (i) K.wall(0, 'x', z0, x0, x1);
				K.door(w, z0 + step / 2, 1.4);
			}
		}
		// the grand staircase, broad and straight, up to the gallery at the back of the rotunda
		K.flight(0, -4, 4, 2, -11.6, null, 0);
		// upstairs: the gallery round the rotunda's well, its rail, the stair arriving at the back
		K.room(k1, 'mezzanine', -K.hw, -K.hd, K.hw, K.hd);
		K.hole(k1, -18, -11.6, 18, 18);
		K.rail(k1, -18.05, -11.65, -17.95, 18); K.rail(k1, 17.95, -11.65, 18.05, 18); K.rail(k1, -18, 17.95, 18, 18.05);
		K.rail(k1, -18, -11.65, -4, -11.55); K.rail(k1, 4, -11.65, 18, -11.55);
	},
});

// Oakland City Hall (1914): the lobby inside the doors, the council chamber behind it,
// offices to either side; a stair up to more of them
export const oaklandCityHall = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 5 }, { y: 5.4, h: 4.2 }], top: 29.6,
	layout: (K) => {
		const lx = 9, zc = 1;
		K.room(0, 'rotunda', -lx, zc + 0.05, lx, K.hd);
		K.room(0, 'chamber', -lx, -K.hd, lx, zc - 0.05);
		const cw = K.wall(0, 'x', zc, -lx, lx);
		K.wide(cw, -2.5, 2.5, 3.2);
		for (const s of [-1, 1]) {
			const x0 = s < 0 ? -K.hw : lx + 0.05, x1 = s < 0 ? -lx - 0.05 : K.hw, w = K.wall(0, 'z', s * lx, -K.hd, K.hd);
			K.room(0, 'office', x0, zc + 0.05, x1, K.hd); K.room(0, 'office', x0, -K.hd, x1, zc - 0.05);
			K.wall(0, 'x', zc, x0, x1);
			K.door(w, (zc + K.hd) / 2, 1.2); K.door(w, (zc - K.hd) / 2, 1.2);
		}
		// the stair up in the lobby's corner, climbing toward the chamber's wall, over which it arrives
		const x1 = lx - 0.06, x0 = x1 - 1.6, zt = zc + 0.06, zb = zt + 6.5;
		K.flight(0, x0, x1, zb, zt, null, -1);
		K.room(1, 'office', -K.hw, -K.hd, K.hw, K.hd);
		K.rail(1, x0 - 0.1, zt, x0, zb); K.rail(1, x0 - 0.1, zb, x1, zb + 0.1);
	},
});

// the Palace of Fine Arts' exhibition hall: one great open floor under the trusses
export const palaceHall = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 13 }], top: 15,
	doors: [{ side: 'z+', u: -W / 3, w: 4 }, { side: 'z+', u: W / 3, w: 4 }],
	layout: (K) => band(K, 0, 'exhibition', -K.hd, K.hd),
});

// the cellhouse on Alcatraz (1912): in at the east end, Broadway running down the middle
// between B and C blocks of cells, three tiers high, Michigan Avenue and Seedy Street along
// the outer walls, and through the gate at the west end the dining hall
export const cellhouse = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 12.5 }], top: 14.3,
	layout: (K) => {
		const zd = -K.hd + 20;
		K.room(0, 'cellhouse', -K.hw, zd + 0.05, K.hw, K.hd);
		K.room(0, 'messhall', -K.hw, -K.hd, K.hw, zd - 0.05);
		const w = K.wall(0, 'x', zd, -K.hw, K.hw);
		K.wide(w, -2.2, 2.2, 3.4);
	},
});

// Fort Point (1861): the casemates round the parade ground, their arches open onto it, a
// gun in each; in through the sally port on the land side
export const fortPoint = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 5.5 }], top: 17.6,
	layout: (K) => {
		const d = 11, cx0 = -K.hw + d, cx1 = K.hw - d, cz0 = -K.hd + d, cz1 = K.hd - d, top = 17.6;
		K.room(0, 'courtyard', cx0, cz0, cx1, cz1, { sky: true });
		// the court's walls stand the fort's full height; the casemates open onto it by arches
		const wn = K.wall(0, 'x', cz0 - 0.05, cx0 - 0.1, cx1 + 0.1, top), ws = K.wall(0, 'x', cz1 + 0.05, cx0 - 0.1, cx1 + 0.1, top);
		const ww = K.wall(0, 'z', cx0 - 0.05, cz0, cz1, top), we = K.wall(0, 'z', cx1 + 0.05, cz0, cz1, top);
		const arch = (w, c) => K.wide(w, c - 1.3, c + 1.3, 3.2);
		// the bays along the north and south sides
		const nx = Math.max(2, Math.round((cx1 - cx0) / 9)), bx = (cx1 - cx0) / nx;
		for (const [z0, z1, w] of [[-K.hd, cz0 - 0.1, wn], [cz1 + 0.1, K.hd, ws]]) for (let i = 0; i < nx; i++) {
			const a = cx0 + i * bx, b = a + bx;
			K.room(0, 'casemate', a + (i ? 0.05 : 0), z0, b - (i < nx - 1 ? 0.05 : 0), z1);
			if (i) K.wall(0, 'z', a, z0, z1);
			arch(w, (a + b) / 2);
		}
		// the bays down the east and west ends, those at the corners reached from the bays beside them
		const nz = Math.max(3, Math.round(2 * K.hd / 9)), bz = 2 * K.hd / nz;
		for (const [x0, x1, xs, w] of [[-K.hw, cx0 - 0.1, cx0 - 0.05, ww], [cx1 + 0.1, K.hw, cx1 + 0.05, we]]) {
			const side = [K.wall(0, 'z', xs, -K.hd, cz0 - 0.1), K.wall(0, 'z', xs, cz1 + 0.1, K.hd)];
			for (let i = 0; i < nz; i++) {
				const a = -K.hd + i * bz, b = a + bz, c = (a + b) / 2;
				K.room(0, 'casemate', x0, a + (i ? 0.05 : 0), x1, b - (i < nz - 1 ? 0.05 : 0));
				if (i) K.wall(0, 'x', a, x0, x1);
				if (c > cz0 && c < cz1) arch(w, c); else arch(c < cz0 ? side[0] : side[1], Math.max(c < cz0 ? -K.hd + 1.5 : cz1 + 1.5, Math.min(c < cz0 ? cz0 - 1.6 : K.hd - 1.5, c)));
			}
		}
	},
});

// a tower's lobby (the Tribune Tower, Hoover Tower): marble, the desk, the lift's doors, and
// a stair up to the floor over it
export const towerLobby = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 4.6 }, { y: 5, h: 3.6 }], top: 9,
	layout: (K) => {
		band(K, 0, 'towerLobby', -K.hd, K.hd);
		K.flight(0, -K.hw, -K.hw + 1.6, K.hd - 2.3, -K.hd + 2.3, null, 1);
		band(K, 1, 'office', -K.hd, K.hd);
		K.rail(1, -K.hw + 1.6, -K.hd + 2.3, -K.hw + 1.7, K.hd - 2.3);
	},
});

// a library (San Ramon's): the circulation desk inside the doors, the stacks in their rows,
// the reading room with its long tables along the windows, a children's corner
export const library = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'modern', levels: [{ y: 0, h: 5.2 }], top: 7.6,
	layout: (K) => {
		const zr = K.hd - 9;
		K.room(0, 'reading', -K.hw, zr + 0.05, K.hw, K.hd);
		K.room(0, 'library', -K.hw, -K.hd, K.hw, zr - 0.05);
		const w = K.wall(0, 'x', zr, -K.hw, K.hw);
		K.wide(w, -K.hw + 3, -K.hw + 9, 3); K.wide(w, K.hw - 9, K.hw - 3, 3);
	},
});

// a civic centre's hall (San Ramon City Hall): the lobby and its counter, the council
// chamber, offices behind
export const cityHall = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'modern', levels: [{ y: 0, h: 4.4 }], top: 10.6,
	layout: (K) => {
		const lx = Math.min(10, K.hw / 3), zc = 0;
		K.room(0, 'rotunda', -lx, zc + 0.05, lx, K.hd);
		K.room(0, 'chamber', -lx, -K.hd, lx, zc - 0.05);
		K.wide(K.wall(0, 'x', zc, -lx, lx), -2.5, 2.5, 3);
		for (const s of [-1, 1]) {
			const x0 = s < 0 ? -K.hw : lx + 0.05, x1 = s < 0 ? -lx - 0.05 : K.hw, w = K.wall(0, 'z', s * lx, -K.hd, K.hd);
			K.room(0, 'office', x0, -K.hd, x1, K.hd);
			K.door(w, K.hd / 2, 1.2); K.door(w, -K.hd / 2, 1.2);
		}
	},
});

// a row of shops and places to eat (Bishop Ranch's pavilions, the wharf's buildings): side
// by side across the front, each its own door; kinds from the shops' fit-outs (furnish.js)
export const shopRow = (kinds) => ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'modern', levels: [{ y: 0, h: 4.2 }], top: 5,
	doors: kinds.slice(1).map((k, i) => ({ side: 'z+', u: -W / 2 + (i + 1.5) * W / kinds.length, w: 1.8 })),
	layout: (K) => {
		const n = kinds.length, w = 2 * K.hw / n;
		for (let i = 0; i < n; i++) {
			const x0 = -K.hw + i * w, x1 = x0 + w;
			K.room(0, 'shop', x0 + (i ? 0.05 : 0), -K.hd, x1 - (i < n - 1 ? 0.05 : 0), K.hd, { shopType: kinds[i] });
			if (i) K.wall(0, 'z', x0, -K.hd, K.hd);
		}
	},
});

// the Casino on the Boardwalk (1907): the arcade behind the loggia, rows of games, the prize
// counter; at the west end, through the wide doors, the Cocoanut Grove's ballroom. towers:
// the feet of its towers, standing into it [x0, z0, x1, z1]
export const casino = (towers = []) => ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 9.6 }], top: 10.4,
	doors: [-0.3, 0.3].map((f) => ({ side: 'z+', u: f * W, w: 2.6, h: door.h })),
	layout: (K) => {
		for (const [x0, z0, x1, z1] of towers) K.solid(0, Math.max(-K.hw, x0), Math.max(-K.hd, z0), Math.min(K.hw, x1), Math.min(K.hd, z1));
		const xb = -K.hw + 34;
		K.room(0, 'ballroom', -K.hw, -K.hd, xb - 0.05, K.hd);
		K.room(0, 'arcade', xb + 0.05, -K.hd, K.hw, K.hd);
		const w = K.wall(0, 'z', xb, -K.hd, K.hd);
		K.wide(w, -6, 6, 3.4);
	},
});

// a barn: the hay mow over the central alley, stalls down one side, the tack and the
// tractor on the other
export const barn = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'plain', levels: [{ y: 0, h: 4.4 }], top: 4.7,
	doors: [{ side: 'z-', u: 0, w: 3.4, h: 3.6 }],
	layout: (K) => band(K, 0, 'barn', -K.hd, K.hd),
});

// a hall with one great room (a prison's entrance hall, a roundhouse's dining room); doors
// besides the front's, if any
export const oneRoom = (type, h = 4.4, extra = {}, doors = []) => ({ W, D, door }) => planShell({
	W, D, door, doors, use: 'site', style: 'modern', levels: [{ y: 0, h }], top: h + 0.6,
	layout: (K) => band(K, 0, type, -K.hd, K.hd, extra),
});

// the visitor centre by the ring: the store inside the doors, the model of the campus in
// the middle, the cafe at the back; wide open between them
export const visitorCentre = ({ W, D, door }) => planShell({
	W, D, door, use: 'site', style: 'modern', levels: [{ y: 0, h: 7 }], top: 8.6,
	layout: (K) => {
		const z1 = K.hd - D * 0.4, z0 = z1 - D * 0.3;
		K.room(0, 'shop', -K.hw, z1 + 0.05, K.hw, K.hd, { shopType: 'boutique' });
		K.room(0, 'exhibition', -K.hw, z0 + 0.05, K.hw, z1 - 0.05, { model: 'ring' });
		K.room(0, 'shop', -K.hw, -K.hd, K.hw, z0 - 0.05, { shopType: 'cafe' });
		K.wide(K.wall(0, 'x', z1, -K.hw, K.hw), -K.hw + 4, K.hw - 4, 4);
		K.wide(K.wall(0, 'x', z0, -K.hw, K.hw), -K.hw + 4, K.hw - 4, 4);
	},
});
