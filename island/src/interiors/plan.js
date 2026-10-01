// Rooms for the buildings that stood as painted boxes: the plan, from the footprint, the
// height, the use and the seed. No three.js here, plain numbers (the building's own frame:
// x across the front, z from the back to the front at +d/2, y up from the ground floor).
//
//   row      San Francisco's Victorians and Edwardians: the garage (or a den) at street
//            level, the front door into a stair hall along one party wall, the stair
//            climbing flight over flight toward the back, the parlour at the front with the
//            bay window, the dining room behind it, the kitchen across the back; bedrooms and
//            the bath up top
//   shop     the same, with a shop on the street (a café, a grocer, a bookshop...) and the
//            flat reached by the stair at its side
//   apt      apartments: a lobby, a corridor down the middle, a stair in its own well
//            turning at each half landing, and flats either side, on every floor
//   hall     the big plain ones: a warehouse, a school, a store, a garage or shed, a
//            parking deck, an office floor
//
// Everything is rectangles: rooms, walls with their openings (doors, windows, the bay),
// flights of stairs, landings, rails, the holes in the floors over the stairs. The rooms
// are then furnished (furnish.js).

export const ST = { storey: 3.3, ceil: 3.0, ext: 0.18, part: 0.1, vest: 1.3, run: 4.0, land: 1.25, stairW: 1.0, risers: 18, door: 2.1 };

export function rng(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedOf = (x, z, salt = 0) => (Math.imul(Math.round(x * 2) | 0, 73856093) ^ Math.imul(Math.round(z * 2) | 0, 19349663) ^ salt) >>> 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function base(S) {
	const hw = S.W / 2 - ST.ext, hd = S.D / 2 - ST.ext;
	return { use: S.use, W: S.W, D: S.D, hw, hd, levels: [], rooms: [], walls: [], flights: [], landings: [], rails: [], alcoves: [], items: [], seats: [], door: null, rnd: S.rnd, style: S.style };
}
function room(P, k, type, x0, z0, x1, z1, extra) {
	const r = { id: P.rooms.length, k, type, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), ...extra };
	P.rooms.push(r);
	P.levels[k].rooms.push(r.id);
	return r;
}
// a wall along x (at z = pos) or along z (at x = pos), from s to e, y0 to y1
function wall(P, k, axis, pos, s, e, y0, y1, kind = 'part', out = 0) {
	const w = { k, axis, pos, s: Math.min(s, e), e: Math.max(s, e), y0, y1, t: kind === 'ext' ? ST.ext : ST.part, kind, out, open: [] };
	P.walls.push(w);
	return w;
}
function open(w, s0, s1, y0, y1, type) {
	s0 = Math.max(w.s + 0.05, s0); s1 = Math.min(w.e - 0.05, s1);
	if (s1 - s0 < 0.3) return null;
	if (w.open.some((o) => s0 < o.s1 + 0.12 && s1 > o.s0 - 0.12)) return null;
	const o = { s0, s1, y0, y1, type };
	w.open.push(o);
	return o;
}
const doorway = (w, c, y, width = 0.9) => open(w, c - width / 2, c + width / 2, y, y + ST.door, 'door');
// split a length into n slots by weights: [[a, b], ...]
function slots(a, b, weights) {
	const t = weights.reduce((s, v) => s + v, 0), out = [];
	let s = a;
	for (const v of weights) { const e = s + (b - a) * v / t; out.push([s, e]); s = e; }
	return out;
}
// the level's floor rectangles: its rooms less the holes over the stairs
export function minusHoles(r, holes) {
	let out = [[r.x0, r.z0, r.x1, r.z1]];
	for (const h of holes) {
		const next = [];
		for (const [x0, z0, x1, z1] of out) {
			if (h[0] >= x1 || h[2] <= x0 || h[1] >= z1 || h[3] <= z0) { next.push([x0, z0, x1, z1]); continue; }
			if (h[0] > x0) next.push([x0, z0, h[0], z1]);
			if (h[2] < x1) next.push([h[2], z0, x1, z1]);
			const ax = Math.max(x0, h[0]), bx = Math.min(x1, h[2]);
			if (h[1] > z0) next.push([ax, z0, bx, h[1]]);
			if (h[3] < z1) next.push([ax, h[3], bx, z1]);
		}
		out = next.filter((q) => q[2] - q[0] > 0.01 && q[3] - q[1] > 0.01);
	}
	return out;
}

// ---------------------------------------------------------------------------------
// the row house and the flats over a shop

// S: { use: 'row' | 'shop', W, D, levels, doorX, garage (bool), zb[k] (the back wall's inner
//      face, where the hill behind cuts a level short), winCols (x centres of the front's
//      windows), winRows[k] ([y0, y1] of the front windows on level k), bay ({ x0, x1, y0, y1 }
//      or null), shopType, rnd, style }
export function planRow(S) {
	const P = base(S), r = S.rnd, n = S.levels, reach = Math.min(n, S.reach || n);
	const { hw, hd } = P, PT = ST.part;
	const side = S.stairSide ?? (S.doorX >= 0 ? 1 : -1);
	const sw = ST.stairW, hallW = 1.25;
	const sx0 = side > 0 ? hw - sw : -hw, sx1 = sx0 + sw;
	const hx0 = side > 0 ? sx0 - hallW : sx1, hx1 = hx0 + hallW;
	const xw = side > 0 ? hx0 - PT / 2 : hx1 + PT / 2;
	const rx0 = side > 0 ? -hw : xw + PT / 2, rx1 = side > 0 ? xw - PT / 2 : hw;
	const cx0 = Math.min(sx0, hx0), cx1 = Math.max(sx1, hx1);
	const zf = hd, zs = zf - ST.vest;
	const fz = (k) => zs - k * (ST.run + ST.land);
	const zc0 = reach > 1 ? fz(reach - 2) - ST.run - ST.land : zs - 2.5;
	P.core = { sx0, sx1, hx0, hx1, zc0, side };
	const doorW = S.use === 'shop' ? 1.2 : 1.0;
	P.door = { x: S.doorX, w: doorW, y: 0, h: 2.3 };
	const E = ST.ext;
	for (let k = 0; k < n; k++) {
		const y = k * ST.storey, yc = y + ST.ceil, top = y + ST.storey;
		const zb = Math.max(-hd, Math.min(S.zb?.[k] ?? -hd, zc0 - 0.01));
		const L = { k, y, h: ST.ceil, zb, rooms: [], holes: [] };
		P.levels.push(L);
		// (the floors above the stair's reach: shut rooms behind the windows)
		if (k >= reach) {
			const front = wall(P, k, 'x', zf + E / 2, -hw - E, hw + E, y, top, 'ext', 1);
			wall(P, k, 'x', zb - E / 2, -hw - E, hw + E, y, top, 'ext', -1);
			wall(P, k, 'z', -hw - E / 2, zb, zf, y, top, 'ext', -1).party = true;
			wall(P, k, 'z', hw + E / 2, zb, zf, y, top, 'ext', 1).party = true;
			room(P, k, 'sealed', -hw, zb, hw, zf);
			for (const c of S.winCols || []) { const [w0, w1] = S.winRows[k] || [y + 0.9, y + 2.4]; open(front, c - 0.5, c + 0.5, w0, w1, 'window'); }
			continue;
		}
		// the flight up from here, the hole over the one from below, rails round it
		if (k < reach - 1) P.flights.push({ k, x0: sx0, x1: sx1, zb: fz(k), zt: fz(k) - ST.run, y0: y, y1: y + ST.storey, n: ST.risers, dir: -1, open: side > 0 ? -1 : 1 });
		if (k > 0) {
			const h0 = fz(k - 1) - ST.run, h1 = fz(k - 1);
			L.holes.push([sx0, h0, sx1, h1]);
			const rx = side > 0 ? sx0 : sx1;
			P.rails.push({ k, x0: rx - 0.03, z0: h0 + 0.02, x1: rx + 0.03, z1: h1, y0: y, y1: y + 0.95 });
			P.rails.push({ k, x0: sx0, z0: h1 - 0.03, x1: sx1, z1: h1 + 0.03, y0: y, y1: y + 0.95 });
		}
		// the walls round the level: the front, the back (a retaining wall where the hill cuts
		// it short), the party walls
		const front = wall(P, k, 'x', zf + E / 2, -hw - E, hw + E, y, top, 'ext', 1);
		const back = wall(P, k, 'x', zb - E / 2, -hw - E, hw + E, y, top, 'ext', -1);
		back.earth = zb > -hd + 0.05;
		wall(P, k, 'z', -hw - E / 2, zb, zf, y, top, 'ext', -1).party = true;
		wall(P, k, 'z', hw + E / 2, zb, zf, y, top, 'ext', 1).party = true;
		// the core: the stair strip and the hall beside it (in a shop, the flat's way up
		// from the back of the shop)
		const shop = S.use === 'shop' && k === 0;
		const hall = room(P, k, 'hall', cx0, zc0, cx1, zf, { stairs: true });
		void hall;
		// the rooms beside the core, front to back
		const sideLen = zf - zc0;
		const first = k === 0 ? (S.garage ? 'garage' : r() < 0.5 ? 'den' : 'bed') : k === 1 ? 'living' : 'master';
		const roles3 = [first, k === 0 ? 'bath' : k === 1 ? 'powder' : 'bath', k === 0 ? 'laundry' : k === 1 ? 'dining' : 'bed'];
		const roles2 = [first, k === 0 ? 'laundry' : k === 1 ? 'dining' : 'bed'];
		const hallWall = wall(P, k, 'z', xw, zc0, shop ? zs : zf, y, yc);
		if (shop) {
			// the shop: the whole front beside the stair, the stair's foot open to it
			room(P, k, 'shop', rx0, zc0, rx1, zf, { shopType: S.shopType });
		} else {
			const ws = sideLen > 10 ? [0.45, 0.2, 0.35] : sideLen > 5.8 ? [0.55, 0.45] : [1];
			const sl = slots(zf, zc0, ws);
			sl.forEach(([a, b], i) => {
				const type = (ws.length === 3 ? roles3 : roles2)[i] || first;
				const rm = room(P, k, type, rx0, Math.min(a, b) + (i < sl.length - 1 ? PT / 2 : 0), rx1, Math.max(a, b) - (i > 0 ? PT / 2 : 0));
				// a doorway to the hall; the garage's at its back, away from the car
				const zmid = type === 'garage' ? rm.z0 + 0.7 : (rm.z0 + rm.z1) / 2;
				doorway(hallWall, zmid, y, type === 'bath' || type === 'powder' ? 0.8 : 0.95);
				if (i > 0) wall(P, k, 'x', Math.max(a, b), rx0, rx1, y, yc);
			});
		}
		// the back: one room or two, the first off the hall
		const backLen = zc0 - PT - zb;
		if (backLen > 2.2) {
			const cw = wall(P, k, 'x', zc0 - PT / 2, -hw, hw, y, yc);
			doorway(cw, shop ? (rx0 + rx1) / 2 : (hx0 + hx1) / 2, y, 0.9);
			const two = backLen > 7.5;
			const bl = two ? slots(zc0 - PT, zb, [0.5, 0.5]) : [[zc0 - PT, zb]];
			const types = shop ? ['storage', 'storage'] : k === 0 ? ['family', 'bed'] : k === 1 ? ['kitchen', reach > 2 ? 'family' : 'bed'] : ['bed', 'office'];
			bl.forEach(([a, b], i) => {
				room(P, k, types[i], -hw, Math.min(a, b) + (i < bl.length - 1 ? PT / 2 : 0), hw, Math.max(a, b) - (i > 0 ? PT / 2 : 0));
				if (i > 0) { const pw = wall(P, k, 'x', Math.max(a, b), -hw, hw, y, yc); doorway(pw, side * hw * 0.35, y, 0.95); }
			});
			P.rooms.filter((q) => q.k === k && (q.type === 'kitchen' || q.type === 'family' || q.type === 'bed' || q.type === 'office' || q.type === 'storage') && Math.abs(q.z0 - zb) < 0.05).forEach((q) => { q.back = true; });
		}
		// the front: the door, the windows over the street, the bay
		if (k === 0) {
			const d = open(front, S.doorX - doorW / 2, S.doorX + doorW / 2, 0, 2.3, 'front');
			if (d) d.main = true;
			if (shop) {
				// the shopfront: glass from the kick plate to the sign, the door in it
				const a = side > 0 ? -hw + 0.1 : hx1 + 0.1, b = side > 0 ? hx0 - 0.1 : hw - 0.1;
				for (const [s0, s1] of [[a, S.doorX - doorW / 2 - 0.1], [S.doorX + doorW / 2 + 0.1, b]]) if (s1 - s0 > 0.4) open(front, s0, s1, 0.45, 2.95, 'store');
			}
		}
		const bay = S.bay && k > 0 && y + 1 > S.bay.y0 && y + 2 < S.bay.y1 ? S.bay : null;
		if (bay) {
			const b0 = Math.max(bay.x0 + 0.12, rx0 + 0.1), b1 = Math.min(bay.x1 - 0.12, rx1 - 0.1);
			if (b1 - b0 > 1.2 && open(front, b0, b1, y + 0.02, y + 2.62, 'bay')) {
				P.alcoves.push({ k, x0: bay.x0 + 0.1, x1: bay.x1 - 0.1, z0: zf, z1: zf + ST.ext + 1.0, y });
				const rm = P.rooms.find((q) => q.k === k && q.z1 > zf - 0.2 && q.x0 <= b0 && q.x1 >= b1);
				if (rm) rm.bay = [b0, b1];
			}
		}
		if (!shop && (k > 0 || !S.garage)) for (const c of S.winCols || []) { const [w0, w1] = S.winRows[k] || [y + 0.9, y + 2.4]; open(front, c - 0.5, c + 0.5, w0, w1, 'window'); }
		// the back windows (none into the hill)
		if (!back.earth && backLen > 2.2) {
			const nW = P.W > 9 ? 3 : 2;
			for (let i = 0; i < nW; i++) open(back, -hw + (i + 0.5) * 2 * hw / nW - 0.6, -hw + (i + 0.5) * 2 * hw / nW + 0.6, y + 0.9, y + 2.35, 'window');
		}
	}
	return P;
}

// ---------------------------------------------------------------------------------
// apartments: a lobby, a corridor, the stair in its well, flats either side

// S: { W, D, levels, doorX, winCols, winRows, party (side walls shared), rnd, style }
export function planApt(S) {
	const P = base(S), r = S.rnd, n = S.levels, PT = ST.part, E = ST.ext;
	const { hw, hd } = P;
	const cw = 0.85, zf = hd, lobby = Math.min(6, hd * 0.4);
	// the stair well beside the corridor, behind the lobby: two flights a storey, turning
	// at the half landing at its far end; each floor's landing over the last, a door onto
	// the corridor
	const half = ST.storey / 2, risers = 9, tread = 0.27, runH = (risers - 1) * tread, land = 1.2;
	const wx0 = cw + PT, wx1 = hw, fw = Math.min(1.3, (wx1 - wx0 - 0.1) / 2), wz1 = zf - lobby - PT, wz0 = wz1 - (land + runH + land);
	P.door = { x: S.doorX, w: 1.4, y: 0, h: 2.3 };
	for (let k = 0; k < n; k++) {
		const y = k * ST.storey, yc = y + ST.ceil, top = y + ST.storey;
		const L = { k, y, h: ST.ceil, zb: -hd, rooms: [], holes: [] };
		P.levels.push(L);
		const front = wall(P, k, 'x', zf + E / 2, -hw - E, hw + E, y, top, 'ext', 1);
		const back = wall(P, k, 'x', -hd - E / 2, -hw - E, hw + E, y, top, 'ext', -1);
		const wl = wall(P, k, 'z', -hw - E / 2, -hd, zf, y, top, 'ext', -1), wr = wall(P, k, 'z', hw + E / 2, -hd, zf, y, top, 'ext', 1);
		wl.party = wr.party = !!S.party;
		if (k < n - 1) {
			P.flights.push({ k, x0: wx0, x1: wx0 + fw, zb: wz1 - land, zt: wz1 - land - runH, y0: y, y1: y + half, n: risers, dir: -1, open: 1 });
			P.landings.push({ k, x0: wx0, z0: wz0, x1: wx1, z1: wz0 + land, y: y + half });
			P.flights.push({ k, x0: wx1 - fw, x1: wx1, zb: wz0 + land, zt: wz0 + land + runH, y0: y + half, y1: top, n: risers, dir: 1, open: -1 });
			P.rails.push({ k, x0: wx0 + fw, z0: wz0 + land, x1: wx1 - fw, z1: wz1 - land, y0: y, y1: top + 0.95 });
		}
		if (k > 0) {
			L.holes.push([wx0, wz0, wx1, wz1 - land]);
			P.rails.push({ k, x0: wx0, z0: wz1 - land - 0.03, x1: wx0 + fw, z1: wz1 - land + 0.03, y0: y, y1: y + 0.95 });
		}
		room(P, k, 'well', wx0, wz0, wx1, wz1, { stairs: true });
		const wc = wall(P, k, 'z', cw + PT / 2, wz0, wz1, y, yc);
		doorway(wc, wz1 - land / 2, y, 1.0);
		wall(P, k, 'x', wz0 - PT / 2, wx0, wx1, y, yc);
		if (k > 0) wall(P, k, 'x', wz1 + PT / 2, wx0, wx1, y, yc);
		// the lobby on the ground floor, the corridor from it (above, from the front wall) back
		const cz1 = k === 0 ? zf - lobby - PT : zf;
		if (k === 0) {
			room(P, k, 'lobby', -hw, zf - lobby, hw, zf);
			const lw = wall(P, k, 'x', zf - lobby - PT / 2, -hw, hw, y, yc);
			open(lw, -cw + 0.05, cw - 0.05, y, y + 2.6, 'wide');
			const fd = open(front, S.doorX - 0.7, S.doorX + 0.7, 0, 2.3, 'front');
			if (fd) fd.main = true;
		}
		const cz0 = -hd + (2 * hd > 30 ? 6.5 + PT : 0);
		room(P, k, 'corridor', -cw, cz0, cw, cz1);
		// the flats either side of the corridor (the well takes a piece of the right side)
		for (const sd of [-1, 1]) {
			const x0 = sd < 0 ? -hw : sd > 0 ? cw + PT : 0, x1 = sd < 0 ? -cw - PT : hw;
			if (x1 - x0 < 3.2) continue;
			const spans = sd > 0 ? [[wz1 + PT, cz1], [cz0, wz0 - PT]] : [[cz0, cz1]];
			for (const [za, zbnd] of spans) {
				const len = zbnd - za;
				if (len < 3.5) continue;
				const cwall = wall(P, k, 'z', sd * (cw + PT / 2), za, zbnd, y, yc);
				const nU = Math.max(1, Math.round(len / 8));
				slots(zbnd, za, Array(nU).fill(1)).forEach(([a, b], i) => {
					const z0 = Math.min(a, b) + (i < nU - 1 ? PT / 2 : 0), z1 = Math.max(a, b) - (i > 0 ? PT / 2 : 0);
					if (i > 0) wall(P, k, 'x', Math.max(a, b), x0, x1, y, yc);
					flat(P, k, x0, z0, x1, z1, sd, cwall, r);
				});
			}
		}
		// the flat across the back, at the corridor's end
		if (cz0 > -hd + 1) {
			const bw = wall(P, k, 'x', cz0 - PT / 2, -hw, hw, y, yc);
			room(P, k, 'living', -hw, -hd, hw, cz0 - PT, { flat: true });
			doorway(bw, 0, y, 0.95);
		}
		// windows: the front's where the facade shows them, round the other sides evenly
		const [w0, w1] = S.winRows?.[k] || [y + 0.9, y + 2.4];
		if (k > 0) for (const c of S.winCols || evenly(-hw, hw, 2.6)) open(front, c - 0.5, c + 0.5, w0, w1, 'window');
		for (const c of evenly(-hw, hw, 2.8)) open(back, c - 0.6, c + 0.6, y + 0.9, y + 2.35, 'window');
		if (!S.party) for (const w of [wl, wr]) for (const c of evenly(-hd, zf, 3.2)) open(w, c - 0.6, c + 0.6, y + 0.9, y + 2.35, 'window');
	}
	return P;
}
function evenly(a, b, step) { const n = Math.max(1, Math.floor((b - a) / step)), out = []; for (let i = 0; i < n; i++) out.push(a + (i + 0.5) * (b - a) / n); return out; }
// one flat: the living room and kitchen toward the outside wall, the bedroom and bath
function flat(P, k, x0, z0, x1, z1, sd, cwall, r) {
	const y = k * ST.storey, yc = y + ST.ceil, PT = ST.part, len = z1 - z0, deep = x1 - x0;
	// the door off the corridor, into the living room
	const liveFront = r() < 0.5;
	// (too short for a bedroom as well: a studio, all one room)
	if (len < 6) { room(P, k, 'living', x0, z0, x1, z1, { flat: true }); doorway(cwall, (z0 + z1) / 2, y, 0.95); return; }
	const bl = Math.min(len - 3.2, Math.max(2.7, len * 0.42));
	const lz = liveFront ? [z0 + bl, z1] : [z0, z1 - bl];
	const bz = liveFront ? [z0, z0 + bl - PT] : [z1 - bl + PT, z1];
	room(P, k, 'living', x0, lz[0] + (liveFront ? PT / 2 : 0), x1, lz[1] - (liveFront ? 0 : PT / 2), { flat: true });
	doorway(cwall, (lz[0] + lz[1]) / 2 + (liveFront ? 1 : -1) * Math.min(1.2, len * 0.15), y, 0.95);
	const split = wall(P, k, 'x', liveFront ? z0 + bl : z1 - bl, x0, x1, y, yc);
	// the bath at the corridor side of the bedroom's slice
	const bathW = Math.min(2.3, deep * 0.4), bx = sd < 0 ? [x1 - bathW, x1] : [x0, x0 + bathW], rx = sd < 0 ? [x0, x1 - bathW - PT] : [x0 + bathW + PT, x1];
	if (bz[1] - bz[0] > 2.4 && deep > 5) {
		room(P, k, 'bath', bx[0], bz[0], bx[1], bz[1]);
		room(P, k, 'bed', rx[0], bz[0], rx[1], bz[1]);
		const bw = wall(P, k, 'z', sd < 0 ? x1 - bathW - PT / 2 : x0 + bathW + PT / 2, bz[0], bz[1], y, yc);
		void bw;
		doorway(split, (bx[0] + bx[1]) / 2, y, 0.8);
		doorway(split, (rx[0] + rx[1]) / 2, y, 0.9);
	} else {
		room(P, k, 'bed', x0, bz[0], x1, bz[1]);
		doorway(split, (x0 + x1) / 2, y, 0.9);
	}
}

// ---------------------------------------------------------------------------------
// the big plain buildings: one hall, fitted out for what it is

// S: { use: 'warehouse' | 'school' | 'store' | 'garage' | 'shed' | 'parking' | 'office', W, D, h, doorX, rnd }
export function planHall(S) {
	const P = base(S), E = ST.ext, PT = ST.part;
	const { hw, hd } = P, h = clamp(S.h, 2.6, S.use === 'warehouse' ? 9 : 4.2);
	const L = { k: 0, y: 0, h, zb: -hd, rooms: [], holes: [] };
	P.levels.push(L);
	const front = wall(P, 0, 'x', hd + E / 2, -hw - E, hw + E, 0, h + 0.3, 'ext', 1);
	const back = wall(P, 0, 'x', -hd - E / 2, -hw - E, hw + E, 0, h + 0.3, 'ext', -1);
	const wl = wall(P, 0, 'z', -hw - E / 2, -hd, hd, 0, h + 0.3, 'ext', -1), wr = wall(P, 0, 'z', hw + E / 2, -hd, hd, 0, h + 0.3, 'ext', 1);
	const dw = S.use === 'garage' || S.use === 'shed' ? 1.0 : 1.8;
	P.door = { x: S.doorX, w: dw, y: 0, h: 2.3 };
	const fd = open(front, S.doorX - dw / 2, S.doorX + dw / 2, 0, 2.3, 'front');
	if (fd) fd.main = true;
	if (S.use === 'school' && hd * 2 > 16 && hw * 2 > 14) {
		// a corridor down the middle, classrooms either side
		const cw = 1.5;
		room(P, 0, 'corridor', -cw, -hd, cw, hd);
		for (const sd of [-1, 1]) {
			const x0 = sd < 0 ? -hw : cw + PT, x1 = sd < 0 ? -cw - PT : hw, cwl = wall(P, 0, 'z', sd * (cw + PT / 2), -hd, hd, 0, h);
			const nC = Math.max(1, Math.round(2 * hd / 9));
			slots(hd, -hd, Array(nC).fill(1)).forEach(([a, b], i) => {
				if (i > 0) wall(P, 0, 'x', Math.max(a, b), x0, x1, 0, h);
				const rm = room(P, 0, 'classroom', x0, Math.min(a, b) + (i < nC - 1 ? PT / 2 : 0), x1, Math.max(a, b) - (i > 0 ? PT / 2 : 0));
				doorway(cwl, rm.z1 - 1.2, 0, 1.0);
			});
		}
	} else room(P, 0, S.use, -hw, -hd, hw, hd);
	// windows (a warehouse's high up, a garage's none)
	if (S.use !== 'garage' && S.use !== 'shed' && S.use !== 'parking') {
		const wy = S.use === 'warehouse' ? [h - 1.6, h - 0.5] : [0.9, 2.3];
		for (const [w, a, b] of [[front, -hw, hw], [back, -hw, hw], [wl, -hd, hd], [wr, -hd, hd]]) for (const c of evenly(a, b, S.use === 'warehouse' ? 6 : 3.2)) open(w, c - 0.6, c + 0.6, wy[0], wy[1], 'window');
	}
	return P;
}

// ---------------------------------------------------------------------------------
// the Summit Building on Mt Diablo (1939-42, the CCC's sandstone: bay/diablo.js draws its
// stone outside and hollows it). Through the door from the car park, the lobby with the
// information desk and the stair up; the gift shop on the one hand; on the other the Summit
// Museum, a gallery round the base of the tower (a solid pier of stone through both floors).
// Upstairs a second gallery over the shop, the landing, and the museum's upper room; from the
// landing a stair on up through the roof to the observation deck.

// S: { W, D (the inside of the stone shell), pier ([x0, z0, x1, z1]: the tower's base),
//      doorX, roofY (the deck, over the ground floor), windows ([side, u, k]: side 'z+', 'z-',
//      'x+', 'x-', u along the wall, k the level), rnd }
export function planSummit(S = {}) {
	const P = base({ use: 'site', W: S.W ?? 25.4, D: S.D ?? 11.75, rnd: S.rnd || rng(1939), style: 'plain' });
	const E = ST.ext, PT = ST.part, { hw, hd } = P;
	const pier = S.pier ?? [4.7, -3.2, 11.1, 3.2], doorX = S.doorX ?? -3.5, roofY = S.roofY ?? 6.9;
	const windows = S.windows ?? [...[-10.5, -7, 0, 3.5, 7, 10.5].flatMap((u) => [['z+', u, 0], ['z-', u, 0], ['z+', u, 1], ['z-', u, 1]]), ['z-', -3.5, 0], ['z+', -3.5, 1], ['z-', -3.5, 1], ...[-3, 3].flatMap((u) => [['x-', u, 0], ['x-', u, 1], ['x+', u, 0], ['x+', u, 1]])];
	// the shop's wall and the lobby's, across the building
	const xs = Math.max(-hw + 4, doorX - 3), xl = Math.min(pier[0] - 3.2, doorX + 3);
	P.door = { x: doorX, w: 1.2, y: 0, h: 2.3 };
	// (an oak door, as the CCC hung)
	P.doorColor = [0.3, 0.19, 0.11];
	P.solid = [];
	P.topHoles = [];
	for (let k = 0; k < 2; k++) {
		const y = k * ST.storey, yc = y + ST.ceil, top = k ? roofY : y + ST.storey;
		const L = { k, y, h: ST.ceil, zb: -hd, rooms: [], holes: [[pier[0], pier[1], pier[2], pier[3]]] };
		P.levels.push(L);
		P.solid.push({ k, box: [pier[0], pier[1], pier[2], pier[3], y - 0.2, top] });
		const ext = { 'z+': wall(P, k, 'x', hd + E / 2, -hw - E, hw + E, y, top, 'ext', 1), 'z-': wall(P, k, 'x', -hd - E / 2, -hw - E, hw + E, y, top, 'ext', -1), 'x-': wall(P, k, 'z', -hw - E / 2, -hd, hd, y, top, 'ext', -1), 'x+': wall(P, k, 'z', hw + E / 2, -hd, hd, y, top, 'ext', 1) };
		for (const [side, u, kk] of windows) if (kk === k) open(ext[side], u - 0.55, u + 0.55, y + 0.85, y + 2.3, 'window');
		// the west room (the shop below, a gallery above), the lobby or landing, the museum
		room(P, k, k ? 'gallery' : 'shop', -hw, -hd, xs - PT / 2, hd, { shopType: 'gift' });
		room(P, k, k ? 'hall' : 'visitor', xs + PT / 2, -hd, xl - PT / 2, hd, { stairs: !!k });
		room(P, k, 'gallery', xl + PT / 2, -hd, pier[0], hd);
		room(P, k, 'gallery', pier[0], pier[3], hw, hd);
		room(P, k, 'gallery', pier[0], -hd, hw, pier[1]);
		// (the strip between the tower and the east wall: a store cupboard)
		room(P, k, 'closet', pier[2] + PT, pier[1] + PT / 2, hw, pier[3] - PT / 2);
		wall(P, k, 'z', pier[2] + PT / 2, pier[1] - PT, pier[3] + PT, y, yc);
		wall(P, k, 'x', pier[1] - PT / 2, pier[2], hw, y, yc);
		const sf = wall(P, k, 'x', pier[3] + PT / 2, pier[2], hw, y, yc);
		doorway(sf, (pier[2] + hw) / 2 + 0.1, y, 0.8);
		// the walls either side of the lobby, and their openings
		const ws = wall(P, k, 'z', xs, -hd, hd, y, yc), wl = wall(P, k, 'z', xl, -hd, hd, y, yc);
		open(ws, hd - 2.6, hd - 1.1, y, y + 2.3, 'wide');
		// (upstairs, clear of the stair on up to the deck along it)
		const up = -hd + 1.25 + (Math.max(12, Math.round((roofY - ST.storey) / 0.18)) - 1) * 0.25 + 0.4;
		open(wl, k ? Math.max(0.6, up) : -2, k ? Math.max(0.6, up) + 3 : 2.4, y, y + 2.6, 'wide');
		if (k === 0) {
			const d = open(ext['z+'], doorX - 0.6, doorX + 0.6, 0, 2.3, 'front');
			if (d) d.main = true;
			// the stair up, along the shop's wall, climbing toward the back
			const x0 = xs + PT / 2 + 0.02;
			P.flights.push({ k, x0, x1: x0 + 1.1, zb: 1.6, zt: 1.6 - ST.run, y0: 0, y1: ST.storey, n: ST.risers, dir: -1, open: 1 });
		} else {
			const f = P.flights[0];
			L.holes.push([f.x0, f.zt, f.x1, f.zb]);
			P.rails.push({ k, x0: f.x1 - 0.03, z0: f.zt, x1: f.x1 + 0.03, z1: f.zb, y0: y, y1: y + 0.95 }, { k, x0: f.x0, z0: f.zb - 0.03, x1: f.x1 + 0.03, z1: f.zb + 0.03, y0: y, y1: y + 0.95 });
			// and on up to the deck, along the museum's wall, toward the front
			const x1 = xl - PT / 2 - 0.02, n = Math.max(12, Math.round((roofY - y) / 0.18)), run = (n - 1) * 0.25, zb = -hd + 1.25;
			P.flights.push({ k, x0: x1 - 1.1, x1, zb, zt: zb + run, y0: y, y1: roofY, n, dir: 1, open: -1 });
			P.topHoles.push([x1 - 1.1, zb, x1, zb + run]);
		}
	}
	return P;
}

// ---------------------------------------------------------------------------------
// the landmarks' insides (interiors/landmarks.js lays each out): a stone or glass shell drawn
// by its own module, and within it, here, levels of any height, their rooms, the walls
// between, doors, stairs and what stands solid

// S: { W, D (inside the shell), levels ([{ y, h }]), top (the roof, over the ground floor),
//      door ({ x, w, h }: on the front), doors ([{ side, u, w, h }]: more, at the ground),
//      use, style, rnd, layout (K) => the rooms }
export function planShell(S) {
	const P = base({ use: S.use || 'site', W: S.W, D: S.D, rnd: S.rnd || rng(seedOf(S.W, S.D, 77)), style: S.style || 'plain' });
	const E = ST.ext, { hw, hd } = P;
	P.door = { x: S.door?.x ?? 0, w: S.door?.w ?? 1.6, y: 0, h: S.door?.h ?? 2.6 };
	P.solid = [];
	P.topHoles = [];
	P.top = S.top ?? S.levels.reduce((m, L) => Math.max(m, L.y + L.h), 0);
	const ext = [];
	S.levels.forEach((Lv, k) => {
		const L = { k, y: Lv.y, h: Lv.h, zb: -hd, rooms: [], holes: [] };
		P.levels.push(L);
		const top = k < S.levels.length - 1 ? S.levels[k + 1].y : P.top;
		ext.push({ 'z+': wall(P, k, 'x', hd + E / 2, -hw - E, hw + E, L.y, top, 'ext', 1), 'z-': wall(P, k, 'x', -hd - E / 2, -hw - E, hw + E, L.y, top, 'ext', -1), 'x-': wall(P, k, 'z', -hw - E / 2, -hd, hd, L.y, top, 'ext', -1), 'x+': wall(P, k, 'z', hw + E / 2, -hd, hd, L.y, top, 'ext', 1) });
	});
	const f = open(ext[0]['z+'], P.door.x - P.door.w / 2, P.door.x + P.door.w / 2, 0, P.door.h, 'front');
	if (f) f.main = true;
	for (const d of S.doors || []) open(ext[0][d.side], d.u - d.w / 2, d.u + d.w / 2, 0, d.h || P.door.h, 'wide');
	const lv = (k) => P.levels[k];
	const K = {
		P, hw, hd, ext,
		room: (k, type, x0, z0, x1, z1, extra) => room(P, k, type, x0, z0, x1, z1, extra),
		// a partition along x (at z = pos) or along z (at x = pos), the level's height
		wall: (k, axis, pos, s, e, y1 = null) => wall(P, k, axis, pos, s, e, lv(k).y, y1 ?? lv(k).y + lv(k).h),
		door: (w, c, width = 0.95) => doorway(w, c, w.y0, width),
		wide: (w, s0, s1, h = 2.6) => open(w, s0, s1, w.y0, w.y0 + h, 'wide'),
		window: (side, k, u, w = 1.2, y0 = 0.9, y1 = 2.4) => open(ext[k][side], u - w / 2, u + w / 2, lv(k).y + y0, lv(k).y + y1, 'window'),
		// a flight up from level k: along z, from zb toward zt, to y1 (the next level, or the roof)
		flight: (k, x0, x1, zb, zt, y1 = null, open1 = 1) => {
			const y0 = lv(k).y, top = y1 ?? (lv(k + 1)?.y ?? P.top), n = Math.max(6, Math.round((top - y0) / 0.18));
			const F = { k, x0, x1, zb, zt, y0, y1: top, n, dir: zt < zb ? -1 : 1, open: open1 };
			P.flights.push(F);
			if (lv(k + 1) && Math.abs(top - lv(k + 1).y) < 0.05) lv(k + 1).holes.push([x0, Math.min(zb, zt), x1, Math.max(zb, zt)]);
			else if (Math.abs(top - P.top) < 0.05) P.topHoles.push([x0, Math.min(zb, zt), x1, Math.max(zb, zt)]);
			return F;
		},
		hole: (k, x0, z0, x1, z1) => lv(k).holes.push([x0, z0, x1, z1]),
		rail: (k, x0, z0, x1, z1) => P.rails.push({ k, x0, z0, x1, z1, y0: lv(k).y, y1: lv(k).y + 1.0 }),
		solid: (k, x0, z0, x1, z1, y1 = null) => { P.solid.push({ k, box: [x0, z0, x1, z1, lv(k).y - 0.2, y1 ?? lv(k).y + lv(k).h] }); lv(k).holes.push([x0, z0, x1, z1]); },
	};
	S.layout(K);
	return P;
}
