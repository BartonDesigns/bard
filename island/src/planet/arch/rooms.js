// The grand interiors' plans: what each floor of a cliff settlement's buildings holds, laid
// out before anything is built. A building is a stack of volumes (a tower's floors, a
// house's rooms); each volume is a footprint (a rectangle or a circle) zoned into a core (the
// lift and its landing) and rooms along one clear axis, the rooms parted by walls with wide
// portals on that axis (so no wall ever crosses another and no hall is narrow), the grand
// floors ringed by a gallery reached by a sweeping stair. Seeded per building and floor.
// interiors.js walks and builds them, furnish.js furnishes them.

import { mulberry32 } from '../../noise.js';

const TAU = Math.PI * 2;

// the kinds of room, what each is called, and which are grand (one room to a floor, a gallery round it)
export const KINDS = {
	atrium: { names: ['The Great Atrium', 'The Lantern Court', 'The Court of Mist', 'The Rose Atrium', 'The Hall of Echoes'], grand: true, mezz: true },
	grandhall: { names: ['The Grand Hall', 'The Hall of Columns', 'The Processional'], grand: true, mezz: true },
	gallery: { names: ['The Long Gallery', 'The Statuary', 'The Hall of Forms', 'The Quiet Gallery'], mezz: true },
	library: { names: ['The Archive of Dusk', 'The Long Library', 'The Reading Vault', 'The Stacks'], mezz: true },
	music: { names: ['The Music Hall', 'The Organ Hall', 'The Resonance'], grand: true, mezz: true },
	listening: { names: ['The Listening Room', 'The Quiet Room', 'The Velvet Ear'] },
	conservatory: { names: ['The Night Conservatory', 'The Glasshouse', 'The Glowing Garden'], grand: true, mezz: true },
	baths: { names: ['The Baths', 'The Moon Pool', 'The Thermae', 'The Steam Halls'] },
	banquet: { names: ['The Banquet Hall', 'The Feast Hall', 'The Long Table'], grand: true },
	water: { names: ['The Water Garden', 'The Cascades', 'The Still Pools'] },
	lounge: { names: ['The Sunken Lounge', 'The Velvet Pit', 'The Low Room'] },
	suite: { names: ['The Mist Suite', 'The High Suite', 'The Dusk Chamber', 'The Cloud Rooms'] },
	skygarden: { names: ['The Sky Garden', 'The Hanging Garden', 'The High Meadow'] },
	crown: { names: ['The Crown Room', 'The Lantern Room'] },
	observatory: { names: ['The Observatory', 'The Star Dome'] },
	vestibule: { names: ['The Vestibule', 'The Entrance Hall', 'The Threshold'] },
	living: { names: ['The Hall over the Drop', 'The Long Room', 'The Cliff Room'] },
};
// each floor's materials: stone, the floor's stone, walls, dark lacquer, velvet, metal, the
// glow (pink or violet) and warm lamp light (linear rgb)
export const THEMES = [
	{ name: 'Rosewater', stone: [0.78, 0.66, 0.66], floor: [0.55, 0.42, 0.44], wall: [0.46, 0.34, 0.40], lacquer: [0.06, 0.025, 0.04], velvet: [0.40, 0.05, 0.18], metal: [1.0, 0.72, 0.45], glow: [1.0, 0.42, 0.68], warm: [1.0, 0.74, 0.5] },
	{ name: 'Nocturne', stone: [0.22, 0.18, 0.28], floor: [0.13, 0.11, 0.17], wall: [0.20, 0.15, 0.26], lacquer: [0.02, 0.02, 0.035], velvet: [0.24, 0.06, 0.38], metal: [0.95, 0.76, 0.48], glow: [0.66, 0.42, 1.0], warm: [1.0, 0.7, 0.5] },
	{ name: 'Ivory', stone: [0.86, 0.82, 0.74], floor: [0.68, 0.62, 0.54], wall: [0.72, 0.66, 0.58], lacquer: [0.05, 0.04, 0.035], velvet: [0.06, 0.22, 0.24], metal: [1.0, 0.78, 0.48], glow: [1.0, 0.55, 0.72], warm: [1.0, 0.8, 0.56] },
	{ name: 'Obsidian', stone: [0.09, 0.08, 0.09], floor: [0.05, 0.045, 0.05], wall: [0.11, 0.09, 0.10], lacquer: [0.015, 0.01, 0.012], velvet: [0.45, 0.04, 0.12], metal: [1.0, 0.68, 0.4], glow: [1.0, 0.32, 0.55], warm: [1.0, 0.66, 0.42] },
	{ name: 'Moonstone', stone: [0.62, 0.64, 0.72], floor: [0.42, 0.44, 0.52], wall: [0.40, 0.40, 0.50], lacquer: [0.03, 0.03, 0.05], velvet: [0.16, 0.10, 0.40], metal: [0.85, 0.84, 0.9], glow: [0.6, 0.55, 1.0], warm: [0.95, 0.85, 0.75] },
	{ name: 'Ember', stone: [0.62, 0.40, 0.30], floor: [0.40, 0.24, 0.18], wall: [0.36, 0.20, 0.16], lacquer: [0.05, 0.02, 0.015], velvet: [0.50, 0.12, 0.06], metal: [1.0, 0.7, 0.4], glow: [1.0, 0.5, 0.4], warm: [1.0, 0.72, 0.45] },
];

// a frame: local x across, z along, y up from the floor; to the world and back
export function frame(x, y, z, yaw) {
	const c = Math.cos(yaw), s = Math.sin(yaw);
	return { x, y, z, yaw, c, s, p: (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], l: (wx, wz) => { const dx = wx - x, dz = wz - z; return [dx * c - dz * s, dx * s + dz * c]; } };
}
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, r) => a[Math.floor(r() * a.length)];

// ---------- the walls a volume stands in ----------
// A wall piece: centred (x, z), running along its own x (yaw in the volume's frame), len long,
// t thick, from y0 to y1 over the floor. mode: 'glass' (a window wall), 'wall', 'part' (a
// partition), 'shaft' (the lift's glass), 'lintel' (over a gap).
function sideRun(L, a, b, along, at, yaw, t, h, mode, gaps) {
	// a run from a to b (along the side), less its gaps; the lintels over gaps lower than the wall
	const cuts = gaps.map((g) => [g.at - g.w / 2, g.at + g.w / 2, g.h]).sort((p, q) => p[0] - q[0]);
	let u = a;
	const piece = (u0, u1, y0, y1, m) => {
		if (u1 - u0 < 0.05) return;
		const m0 = (u0 + u1) / 2;
		L.walls.push({ ...along(m0, at), len: u1 - u0, t, yaw, y0, y1, mode: m });
	};
	for (const [g0, g1, gh] of cuts) {
		piece(u, Math.max(u, g0), 0, h, mode);
		if (gh < h - 0.2) piece(Math.max(u, g0), g1, gh, h, 'lintel');
		u = Math.max(u, g1);
	}
	piece(u, b, 0, h, mode);
}

// lay out a volume: its walls, its floors, its holes, its stairs and rails
export function layout(V) {
	const L = { walls: [], floors: [], holes: [], ramps: [], rails: [], doors: [] };
	const t = 0.3, h = V.h;
	if (!V.round) {
		const hw = V.w / 2, hd = V.d / 2;
		const S = V.sides;
		// +z and -z run along x; +x and -x along z
		const runX = (side, z) => sideRun(L, -hw, hw, (u) => ({ x: u, z }), z, 0, t, h, S[side].mode, S[side].mode === 'open' ? [] : S[side].gaps);
		const runZ = (side, x) => sideRun(L, -hd, hd, (u) => ({ x, z: u }), x, Math.PI / 2, t, h, S[side].mode, S[side].mode === 'open' ? [] : S[side].gaps);
		if (S.pz.mode !== 'open') runX('pz', hd - t / 2);
		if (S.nz.mode !== 'open') runX('nz', -hd + t / 2);
		if (S.px.mode !== 'open') runZ('px', hw - t / 2);
		if (S.nx.mode !== 'open') runZ('nx', -hw + t / 2);
		for (const k of ['pz', 'nz', 'px', 'nx']) for (const g of S[k].gaps) {
			const on = k[1] === 'z', sg = k[0] === 'p' ? 1 : -1;
			const x = on ? g.at : sg * (hw - t / 2), z = on ? sg * (hd - t / 2) : g.at;
			L.doors.push({ x, z, yaw: on ? 0 : Math.PI / 2, out: sg, axis: on ? 'z' : 'x', w: g.w, h: g.h, porch: g.porch || 0, ext: !!g.ext });
		}
	} else {
		const N = V.r > 9 ? 28 : 22, r = V.r - t / 2;
		for (let i = 0; i < N; i++) {
			const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, am = (a0 + a1) / 2;
			const gap = V.gaps.find((g) => Math.abs(((am - g.a) % TAU + TAU + Math.PI) % TAU - Math.PI) < g.w / 2 / V.r);
			const len = 2 * r * Math.sin((a1 - a0) / 2) + 0.12, x = Math.sin(am) * r * Math.cos(Math.PI / N), z = Math.cos(am) * r * Math.cos(Math.PI / N);
			// (a chord's own x runs along the tangent: its yaw is the bearing)
			const yaw = am;
			if (!gap) L.walls.push({ x, z, len, t, yaw, y0: 0, y1: h, mode: 'glass' });
			else if (gap.h < h - 0.2) L.walls.push({ x, z, len, t, yaw, y0: gap.h, y1: h, mode: 'lintel' });
		}
		for (const g of V.gaps) L.doors.push({ x: Math.sin(g.a) * (V.r - t / 2), z: Math.cos(g.a) * (V.r - t / 2), yaw: g.a, a: g.a, w: g.w, h: g.h, porch: g.porch || 0, ext: !!g.ext, round: true });
	}
	// the porches: a passage out through the building's skin to the ground, floored and walled
	for (const D of L.doors) {
		if (!D.porch) continue;
		const [ox, oz] = D.round ? [Math.sin(D.a), Math.cos(D.a)] : D.axis === 'z' ? [0, D.out] : [D.out, 0];
		const cx = D.x + ox * D.porch / 2, cz = D.z + oz * D.porch / 2, yaw = Math.atan2(ox, oz);
		L.floors.push({ x: cx, z: cz, hw: D.w / 2 + 0.6, hd: D.porch / 2 + 0.4, yaw, y: 0, porch: true });
		for (const sd of [-1, 1]) L.walls.push({ x: cx + oz * sd * (D.w / 2 + 0.15), z: cz - ox * sd * (D.w / 2 + 0.15), len: D.porch, t: 0.3, yaw: yaw + Math.PI / 2, y0: 0, y1: D.h + 0.6, mode: 'part' });
	}
	// the lift: a glass shaft, open toward the floor at the landing
	if (V.lift) {
		const { x, z, s, a } = V.lift, side = [[0, 1], [1, 0], [0, -1], [-1, 0]];
		for (let k = 0; k < 4; k++) {
			const [ox, oz] = side[k], open = k === a;
			const piece = { x: x + ox * (s + 0.1), z: z + oz * (s + 0.1), t: 0.16, yaw: k % 2 ? Math.PI / 2 : 0, mode: 'shaft' };
			if (open) L.walls.push({ ...piece, len: s * 2 + 0.3, y0: 3.0, y1: h, mode: 'lintel' }), L.lift = { ox, oz };
			else L.walls.push({ ...piece, len: s * 2 + 0.3, y0: 0, y1: h });
		}
		if (!V.bottom) L.holes.push({ x, z, hw: s + 0.05, hd: s + 0.05 });
	}
	// the partitions: walls across the long axis, each with a wide portal on the circulation axis
	for (const P of V.parts || []) {
		if (!V.round) sideRun(L, -V.d / 2 + t, V.d / 2 - t, (u) => ({ x: P.x, z: u }), P.x, Math.PI / 2, 0.45, h, 'part', [{ at: 0, w: P.w, h: P.h }]);
		else {
			const r0 = V.lift ? V.lift.s + 0.3 : 0.5, r1 = V.r - t;
			const seg = (u0, u1, y0, m) => { const m0 = (u0 + u1) / 2; L.walls.push({ x: Math.sin(P.a) * m0, z: Math.cos(P.a) * m0, len: u1 - u0, t: 0.45, yaw: P.a + Math.PI / 2, y0, y1: h, mode: m }); };
			seg(r0, r0 + 0.6, 0, 'part');
			seg(r0 + 0.6, r0 + 0.6 + P.w, P.h, 'lintel');
			seg(r0 + 0.6 + P.w, r1, 0, 'part');
		}
	}
	// the gallery: its floors, the rail along its edge, the stair up to it
	const M = V.mezz;
	if (M) {
		for (const f of M.floors) L.floors.push({ ...f, y: M.y, mezz: true });
		for (const r of M.rails) L.rails.push({ ...r, y: M.y });
		for (const st of M.stairs) {
			L.ramps.push(st);
			// the stair's own rail along its open side
			if (st.rail) L.rails.push({ ...st.rail, y: st.ya, y2: st.yb });
		}
	}
	return L;
}

// ---------- the floors of a tower ----------
// heights from y0 to y1, floors forced at `must` (where bridges and decks come in); the first
// (the entrance) and the last (the crown) tall, the rest a seeded mix of grand and plain
function stack(y0, y1, must, r, first, last) {
	const ys = [y0], pts = [...must.filter((m) => m > y0 + first && m < y1 - last).sort((a, b) => a - b), y1];
	const grand = [9, 10, 12, 14, 16, 18], plain = [6, 6.5, 7, 7.5, 8];
	for (const tgt of pts) {
		let y = ys[ys.length - 1];
		const end = tgt === y1 ? last : 6;
		for (;;) {
			const rem = tgt - y, h0 = ys.length === 1 ? first : (r() < 0.45 ? pick(grand, r) : pick(plain, r));
			if (rem < h0 + end) {
				// (no crown taller than it need be: a plain floor under it)
				if (tgt === y1 && rem > end + 7) ys.push(y + rem - end);
				if (tgt !== y1) ys.push(tgt);
				break;
			}
			y += h0;
			ys.push(y);
		}
	}
	// (the last floor's ceiling is the tower's top)
	return ys;
}

// the rooms of a floor, by its height and its size, drawn from decks shuffled per building
function decks(r) {
	return { grand: shuffle(['conservatory', 'music', 'banquet', 'grandhall', 'library', 'baths', 'gallery', 'water'], r), plain: shuffle(['library', 'gallery', 'suite', 'lounge', 'listening', 'baths', 'water', 'skygarden', 'suite', 'gallery'], r), gi: 0, pi: 0 };
}
const draw = (D, grand) => grand ? D.grand[D.gi++ % D.grand.length] : D.plain[D.pi++ % D.plain.length];
const named = (kind, r, used) => {
	const list = KINDS[kind].names, n = list.filter((x) => !used.has(x));
	const nm = n.length ? pick(n, r) : pick(list, r);
	used.add(nm);
	return nm;
};

// the gallery round a grand rectangular floor: along both long walls and the far end, the
// stair up beside the near gallery's edge to the far end
function rectMezz(V, x0, r) {
	const hw = V.w / 2, hd = V.d / 2, g = 3.4, y = Math.max(4.5, Math.min(7.5, V.h * (0.42 + r() * 0.12)));
	const run = y / 0.62, xs1 = hw - g, xs0 = xs1 - run, zs0 = -hd + g, zs1 = zs0 + 2.3;
	if (xs0 < x0 + 1 || V.d < 13) return null;
	const xa = x0 + 0.6;
	return {
		y, g,
		floors: [
			{ x: (xa + hw) / 2, z: -hd + g / 2, hw: (hw - xa) / 2, hd: g / 2, yaw: 0 },
			{ x: (xa + hw) / 2, z: hd - g / 2, hw: (hw - xa) / 2, hd: g / 2, yaw: 0 },
			{ x: hw - g / 2, z: 0, hw: g / 2, hd: hd, yaw: 0 },
			// the stair's landing at its head
			{ x: xs1 + 0.6, z: (zs0 + zs1) / 2, hw: 0.6, hd: 1.15, yaw: 0 },
		],
		rails: [
			{ ax: xa, az: -hd + g, bx: xs0 - 0.1, bz: -hd + g },
			{ ax: xa, az: hd - g, bx: hw - g, bz: hd - g },
			{ ax: hw - g, az: zs1 + 0.1, bx: hw - g, bz: hd - g },
			{ ax: xa, az: -hd, bx: xa, bz: -hd + g },
			{ ax: xa, az: hd, bx: xa, bz: hd - g },
		],
		stairs: [{ ax: xs0, az: (zs0 + zs1) / 2, bx: xs1, bz: (zs0 + zs1) / 2, ya: 0, yb: y, hw: 1.15, rail: { ax: xs0, az: zs1, bx: xs1, bz: zs1 } }],
	};
}
// the gallery round a grand round floor: a ring along the glass, a curving stair up to it
function roundMezz(V, r) {
	const g = 3.0, y = Math.max(4.5, Math.min(7.0, V.h * (0.42 + r() * 0.1))), R = V.r;
	if (R < 9.5) return null;
	const a0 = r() * TAU, span = TAU * 0.72, rm = R - g - 1.1, run = y / 0.6, sa = run / rm, n = 7;
	const floors = [{ ring: true, r0: R - g, r1: R, a0, span }];
	const rails = [];
	for (let k = 0; k < 18; k++) {
		const u0 = a0 + 0.12 + k / 18 * (span - 0.12), u1 = a0 + 0.12 + (k + 1) / 18 * (span - 0.12), rr = R - g;
		rails.push({ ax: Math.sin(u0) * rr, az: Math.cos(u0) * rr, bx: Math.sin(u1) * rr, bz: Math.cos(u1) * rr });
	}
	for (const u of [a0, a0 + span]) rails.push({ ax: Math.sin(u) * (R - g), az: Math.cos(u) * (R - g), bx: Math.sin(u) * R, bz: Math.cos(u) * R });
	const stairs = [];
	for (let k = 0; k < n; k++) {
		const u0 = a0 - sa + k / n * sa, u1 = a0 - sa + (k + 1) / n * sa;
		const ri = rm - 1.15;
		stairs.push({ ax: Math.sin(u0) * rm, az: Math.cos(u0) * rm, bx: Math.sin(u1) * rm, bz: Math.cos(u1) * rm, ya: y * k / n, yb: y * (k + 1) / n, hw: 1.15, rail: { ax: Math.sin(u0) * ri, az: Math.cos(u0) * ri, bx: Math.sin(u1) * ri, bz: Math.cos(u1) * ri } });
	}
	// a landing from the stair's head out onto the ring
	floors.push({ x: Math.sin(a0 + 0.05) * (rm + 0.4), z: Math.cos(a0 + 0.05) * (rm + 0.4), hw: 1.6, hd: 1.4, yaw: a0 });
	return { y, g, floors, rails, stairs, a0 };
}

// A tower's floors. o: { name, kind ('slab' | 'spire'), x, z, yaw, y0, y1, round, w, d (a
// slab's), radAt (a spire's: its clear radius between two heights), must (floors forced
// there), doors [{ y, at | a, w, h, porch, ext }], top ('observatory' | 'crown'), seed }
export function towerPlan(o) {
	const r = mulberry32(o.seed >>> 0), D = decks(r), used = new Set();
	const must = [];
	for (const m of [...(o.must || [])].sort((a, b) => a - b)) if (!must.length || m - must[must.length - 1] > 6) must.push(m);
	const ys = stack(o.y0, o.y1, must, r, o.round ? 12 : 11 + r() * 4, o.round ? 15 : 13);
	const B = { name: o.name, kind: o.kind, x: o.x, z: o.z, yaw: o.yaw, y0: o.y0, y1: o.y1, vols: [], seed: o.seed, reach: o.round ? o.r0 + 4 : Math.hypot(o.w, o.d) / 2 + 4 };
	// the lift: a corner of the slab, the middle of the spire; open toward the rooms
	const lift = o.round ? { x: 0, z: 0, s: 1.45, a: Math.floor(r() * 4) } : { x: -o.w / 2 + 2.3, z: -o.d / 2 + 2.3, s: 1.45, a: 0 };
	B.lift = { stops: [], at: lift };
	const ti = Math.floor(r() * THEMES.length);
	for (let i = 0; i < ys.length; i++) {
		const y = ys[i], top = i === ys.length - 1, h = (top ? o.y1 : ys[i + 1]) - y - (top ? 0.3 : 0.45);
		const V = { B, i, F: frame(o.x, y, o.z, o.yaw), round: !!o.round, h, bottom: i === 0, top, lift, theme: THEMES[(ti + i * 2 + (r() < 0.3 ? 1 : 0)) % THEMES.length], seed: (o.seed + i * 7919) >>> 0 };
		if (o.round) { V.r = o.radAt(y, y + h); V.gaps = []; } else { V.w = o.w; V.d = o.d; V.sides = { pz: { mode: 'glass', gaps: [] }, nz: { mode: 'glass', gaps: [] }, px: { mode: 'wall', gaps: [] }, nx: { mode: 'wall', gaps: [] } }; }
		for (const d of o.doors || []) {
			if (Math.abs(d.y - y) > 0.6) continue;
			if (o.round) V.gaps.push({ a: d.a, w: d.w, h: Math.min(d.h, h - 0.3), porch: d.porch, ext: d.ext });
			else V.sides.pz.gaps.push({ at: d.at, w: d.w, h: Math.min(d.h, h - 0.3), porch: d.porch, ext: d.ext });
		}
		// what it holds
		const kind0 = i === 0 ? 'atrium' : top ? o.top : draw(D, h >= 10.5);
		const grand = KINDS[kind0].grand || i === 0 || top;
		const rooms = [];
		if (o.round) {
			const k = grand || V.r < 9 ? 1 : 2, a0 = r() * TAU;
			V.parts = [];
			for (let j = 0; j < k; j++) {
				const kind = j === 0 ? kind0 : draw(D, false);
				rooms.push({ kind, name: named(kind, r, used), a0: a0 + j / k * TAU, a1: a0 + (j + 1) / k * TAU, r0: lift.s + 1.6, r1: V.r - 0.4 });
				if (k > 1) V.parts.push({ a: a0 + j / k * TAU, w: Math.min(5, (V.r - lift.s - 1) * 0.55), h: Math.min(h - 1, 5.5) });
			}
			if (k === 1 && KINDS[kind0].mezz && h >= 10) V.mezz = roundMezz(V, r);
		} else {
			const x0 = -o.w / 2 + 4.6, x1 = o.w / 2 - 0.3, k = grand || o.w < 21 ? 1 : 2;
			V.parts = [];
			if (k === 1) rooms.push({ kind: kind0, name: named(kind0, r, used), x0, x1, z0: -o.d / 2 + 0.3, z1: o.d / 2 - 0.3 });
			else {
				const c = (x0 + x1) / 2 + (r() - 0.5) * o.w * 0.12, kind1 = draw(D, false);
				rooms.push({ kind: kind0, name: named(kind0, r, used), x0, x1: c - 0.25, z0: -o.d / 2 + 0.3, z1: o.d / 2 - 0.3 });
				rooms.push({ kind: kind1, name: named(kind1, r, used), x0: c + 0.25, x1, z0: -o.d / 2 + 0.3, z1: o.d / 2 - 0.3 });
				V.parts.push({ x: c, w: Math.max(4.5, Math.min(7, o.d * 0.42)), h: Math.min(h - 1, 6) });
			}
			if (k === 1 && KINDS[kind0].mezz && h >= 10) V.mezz = rectMezz(V, x0, r);
		}
		V.rooms = rooms;
		V.L = layout(V);
		B.lift.stops.push(y);
		B.vols.push(V);
	}
	return B;
}

// A house's rooms, given whole by its builder: vols [{ F, w, d, h, sides, kind, stairs?, holes? }]
export function housePlan(o) {
	const r = mulberry32(o.seed >>> 0), used = new Set(), ti = Math.floor(r() * THEMES.length);
	const B = { name: o.name, kind: o.kind, x: o.x, z: o.z, y0: Math.min(...o.vols.map((v) => v.F.y)), y1: Math.max(...o.vols.map((v) => v.F.y + v.h)), vols: [], seed: o.seed, reach: o.reach };
	for (const [i, q] of o.vols.entries()) {
		const V = { B, i, F: q.F, round: false, w: q.w, d: q.d, h: q.h, sides: q.sides, bottom: true, theme: THEMES[(ti + (q.theme || 0)) % THEMES.length], seed: (o.seed + i * 7919) >>> 0, parts: [] };
		const kind = q.kind;
		V.rooms = [{ kind, name: named(kind, r, used), x0: -q.w / 2 + 0.3, x1: q.w / 2 - 0.3, z0: -q.d / 2 + 0.3, z1: q.d / 2 - 0.3, open: q.open }];
		if (q.stairs || q.rails) V.mezz = { y: 0, floors: [], rails: q.rails || [], stairs: q.stairs || [] };
		V.L = layout(V);
		if (q.holes) V.L.holes.push(...q.holes);
		// (a stair up through the ceiling)
		if (q.ceil) V.L.ceilHoles = q.ceil;
		B.vols.push(V);
	}
	return B;
}
