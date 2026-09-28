// The realm's buildings, shape by shape (see kit.js for the shapes and what they are made
// of). Each builder takes a context: the kit to build into, the collision registry, the
// ground, the realm's style and a seeded random, and lists for the lights, flames, banners
// and moving parts it adds. All heights are world heights; each building works in its own
// frame (its front toward +z).

import { M } from './kit.js';
import { hearthZ } from '../../interiors/medieval.js';

const TAU = Math.PI * 2;
const DARK = [0.03, 0.03, 0.03];
const IRONC = [0.16, 0.16, 0.17];
const PLANKC = [0.46, 0.34, 0.22];
const SHUTTERS = [[0.26, 0.36, 0.26], [0.22, 0.30, 0.42], [0.46, 0.20, 0.16], [0.40, 0.33, 0.22], [0.30, 0.30, 0.30]];
const shade = (c, k) => c.map((v) => Math.min(1, v * k));

// ---------- pieces ----------
// a wall panel with a round-headed opening through it: x across (W wide, centred on cx), z
// through (T thick, centred on cz), from y0 up H; the opening ow wide, its arch springing at `spring`
export function archWall(k, cx, y0, cz, W, H, T, ow, spring, mat, col, n = 8) {
	const x0 = cx - W / 2, x1 = cx + W / 2, zf = cz + T / 2, zb = cz - T / 2, hw = ow / 2, top = y0 + H;
	for (const [z, s] of [[zf, 1], [zb, -1]]) {
		k.face([[x0, y0, z], [cx - hw, y0, z], [cx - hw, top, z], [x0, top, z]], [0, 0, s], mat, col);
		k.face([[cx + hw, y0, z], [x1, y0, z], [x1, top, z], [cx + hw, top, z]], [0, 0, s], mat, col);
		for (let i = 0; i < n; i++) {
			const t0 = Math.PI - i / n * Math.PI, t1 = Math.PI - (i + 1) / n * Math.PI;
			const ax = cx + hw * Math.cos(t0), ay = y0 + spring + hw * Math.sin(t0), bx = cx + hw * Math.cos(t1), by = y0 + spring + hw * Math.sin(t1);
			k.face([[ax, ay, z], [bx, by, z], [bx, top, z], [ax, top, z]], [0, 0, s], mat, col);
		}
	}
	k.face([[cx - hw, y0, zb], [cx - hw, y0, zf], [cx - hw, y0 + spring, zf], [cx - hw, y0 + spring, zb]], [1, 0, 0], mat, col);
	k.face([[cx + hw, y0, zf], [cx + hw, y0, zb], [cx + hw, y0 + spring, zb], [cx + hw, y0 + spring, zf]], [-1, 0, 0], mat, col);
	for (let i = 0; i < n; i++) {
		const t0 = Math.PI - i / n * Math.PI, t1 = Math.PI - (i + 1) / n * Math.PI, tm = (t0 + t1) / 2;
		const ax = cx + hw * Math.cos(t0), ay = y0 + spring + hw * Math.sin(t0), bx = cx + hw * Math.cos(t1), by = y0 + spring + hw * Math.sin(t1);
		k.face([[ax, ay, zb], [ax, ay, zf], [bx, by, zf], [bx, by, zb]], [-Math.cos(tm), -Math.sin(tm), 0], mat, col);
	}
	k.face([[x0, top, zf], [x1, top, zf], [x1, top, zb], [x0, top, zb]], [0, 1, 0], mat, col);
	k.face([[x0, y0, zb], [x0, y0, zf], [x0, top, zf], [x0, top, zb]], [-1, 0, 0], mat, col);
	k.face([[x1, y0, zf], [x1, y0, zb], [x1, top, zb], [x1, top, zf]], [1, 0, 0], mat, col);
}
// a parapet with merlons along local x, its outer face at z = zo, t thick inward (sign: +1 when
// the outside is +z)
export function crenelX(k, x0, x1, y, zo, t, sign, mat, col) {
	const zi = zo - sign * t, za = Math.min(zo, zi), zb = Math.max(zo, zi);
	k.box(x0, y, za, x1, y + 1.05, zb, mat, col);
	const n = Math.max(1, Math.round((x1 - x0) / 1.6));
	const step = (x1 - x0) / n;
	for (let i = 0; i < n; i++) {
		const cx = x0 + (i + 0.5) * step;
		k.box(cx - 0.48, y + 1.05, za, cx + 0.48, y + 1.95, zb, mat, col, 'ny');
	}
}
// merlons round a ring
function crenelRing(k, r, y, mat, col, t = 0.5) {
	const n = Math.max(6, Math.round(TAU * r / 1.7));
	const f = k.save();
	for (let i = 0; i < n; i++) {
		const a = (i + 0.5) / n * TAU;
		k.load(f).sub(Math.sin(a) * (r - t / 2), 0, Math.cos(a) * (r - t / 2), a);
		k.box(-0.48, y, -t / 2, 0.48, y + 0.9, t / 2, mat, col, 'ny');
	}
	k.load(f);
}
// a dark arrow slit on a face (at local x, y, just proud of a face at z facing +z)
function slit(k, x, y, z) { k.face([[x - 0.07, y, z], [x + 0.07, y, z], [x + 0.07, y + 1.2, z], [x - 0.07, y + 1.2, z]], [0, 0, 1], M.PLAIN, DARK); }
// a torch in an iron sconce on a wall (the wall faces +z at z); its flame and light are listed
export function sconce(ctx, k, x, y, z, always = false) {
	k.beam([x, y - 0.25, z], [x, y - 0.05, z + 0.28], 0.05, 0.05, M.IRON, IRONC);
	k.beam([x, y - 0.1, z + 0.28], [x, y + 0.35, z + 0.34], 0.07, 0.07, M.TIMBER, [0.28, 0.2, 0.12]);
	const p = k.w(x, y + 0.36, z + 0.35);
	ctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.22, always });
	ctx.lights.push({ x: p[0], y: p[1] + 0.2, z: p[2], r: 11, always });
}
// a lantern hung from a bracket (for posts and doors)
function lantern(ctx, k, x, y, z) {
	k.box(x - 0.14, y, z - 0.14, x + 0.14, y + 0.03, z + 0.14, M.IRON, IRONC);
	k.box(x - 0.1, y + 0.36, z - 0.1, x + 0.1, y + 0.42, z + 0.1, M.IRON, IRONC);
	for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.beam([x + a * 0.12, y, z + b * 0.12], [x + a * 0.1, y + 0.38, z + b * 0.1], 0.025, 0.025, M.IRON, IRONC);
	const p = k.w(x, y + 0.05, z);
	ctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.13 });
	ctx.lights.push({ x: p[0], y: p[1] + 0.15, z: p[2], r: 9 });
}
// timber framing over one face of a plastered storey: the face runs from u = 0..W along
// dir (local unit x, z), outward normal (nx, nz), from y0 to y1; windows and a door in its bays
function frameFace(ctx, k, ox, oz, dx, dz, nx, nz, W, y0, y1, opts = {}) {
	const T = ctx.st.timber, pt = (u, y, out = 0.05) => [ox + dx * u + nx * out, y, oz + dz * u + nz * out];
	const bays = Math.max(2, Math.round(W / 1.5)), bw = W / bays;
	k.beam(pt(0, y0 + 0.1), pt(W, y0 + 0.1), 0.2, 0.14, M.TIMBER, T);
	k.beam(pt(0, y1 - 0.1), pt(W, y1 - 0.1), 0.2, 0.14, M.TIMBER, T);
	for (let i = 0; i <= bays; i++) k.beam(pt(i * bw, y0), pt(i * bw, y1), 0.2, 0.14, M.TIMBER, T);
	const win = opts.windows || [], door = opts.door ?? -1;
	for (let i = 0; i < bays; i++) {
		const u0 = i * bw, u1 = (i + 1) * bw, um = (u0 + u1) / 2;
		if (i === door) {
			// a plank door under a lintel, a step before it
			const dw = Math.min(1.05, bw - 0.25);
			if (!opts.open) k.face([pt(um - dw / 2, y0, 0.04), pt(um + dw / 2, y0, 0.04), pt(um + dw / 2, y0 + 2.05, 0.04), pt(um - dw / 2, y0 + 2.05, 0.04)], [nx, 0, nz], M.PLANK, PLANKC);
			k.beam(pt(um - dw / 2 - 0.1, y0 + 2.12), pt(um + dw / 2 + 0.1, y0 + 2.12), 0.18, 0.16, M.TIMBER, T);
			k.beam(pt(um - dw / 2, y0), pt(um - dw / 2, y0 + 2.1), 0.12, 0.12, M.TIMBER, T);
			k.beam(pt(um + dw / 2, y0), pt(um + dw / 2, y0 + 2.1), 0.12, 0.12, M.TIMBER, T);
			// iron strap hinges and a ring
			if (!opts.open) for (const hy of [0.4, 1.6]) k.face([pt(um - dw / 2 + 0.05, y0 + hy, 0.06), pt(um + dw * 0.1, y0 + hy, 0.06), pt(um + dw * 0.1, y0 + hy + 0.06, 0.06), pt(um - dw / 2 + 0.05, y0 + hy + 0.06, 0.06)], [nx, 0, nz], M.IRON, IRONC);
			continue;
		}
		if (win.includes(i) && y1 - y0 > 2) {
			// a leaded window with a frame, and shutters open either side
			const ww = Math.min(0.8, bw - 0.45), wy = y0 + 0.95, wh = Math.min(0.85, y1 - y0 - 1.3);
			k.face([pt(um - ww / 2, wy, 0.03), pt(um + ww / 2, wy, 0.03), pt(um + ww / 2, wy + wh, 0.03), pt(um - ww / 2, wy + wh, 0.03)], [nx, 0, nz], M.GLASS, [1, 1, 1]);
			k.beam(pt(um - ww / 2 - 0.06, wy), pt(um + ww / 2 + 0.06, wy), 0.12, 0.14, M.TIMBER, T);
			k.beam(pt(um - ww / 2 - 0.06, wy + wh), pt(um + ww / 2 + 0.06, wy + wh), 0.1, 0.12, M.TIMBER, T);
			k.beam(pt(um, wy), pt(um, wy + wh), 0.05, 0.08, M.TIMBER, T);
			const sc = opts.shutter;
			if (sc) for (const s of [-1, 1]) {
				const a = um + s * (ww / 2 + 0.04), b = um + s * (ww / 2 + 0.04 + ww / 2);
				k.face([pt(Math.min(a, b), wy, 0.1), pt(Math.max(a, b), wy, 0.1), pt(Math.max(a, b), wy + wh, 0.1), pt(Math.min(a, b), wy + wh, 0.1)], [nx, 0, nz], M.PLANK, sc);
			}
			continue;
		}
		// a rail and braces in the plain bays
		k.beam(pt(u0, y0 + (y1 - y0) * 0.45), pt(u1, y0 + (y1 - y0) * 0.45), 0.16, 0.12, M.TIMBER, T);
		if (i === 0) k.beam(pt(u0, y0 + 0.2), pt(u1, y0 + (y1 - y0) * 0.45), 0.14, 0.11, M.TIMBER, T);
		if (i === bays - 1) k.beam(pt(u1, y0 + 0.2), pt(u0, y0 + (y1 - y0) * 0.45), 0.14, 0.11, M.TIMBER, T);
		if (bays > 3 && (i === 0 || i === bays - 1)) k.beam(pt(i === 0 ? u0 : u1, y1 - 0.2), pt(i === 0 ? u1 : u0, y0 + (y1 - y0) * 0.45), 0.14, 0.11, M.TIMBER, T);
	}
}
// a barrel, standing
export function barrel(k, x, y, z, s = 1) {
	const f = k.save();
	k.sub(x, 0, z);
	const r0 = 0.3 * s, r1 = 0.36 * s, h = 0.9 * s;
	k.lathe([[r0, y], [r1, y + h * 0.5], [r0, y + h]], 10, M.PLANK, [0.5, 0.36, 0.22], 0, TAU, true);
	for (const hy of [0.12, 0.5, 0.88]) { const rr = r0 + (r1 - r0) * (1 - Math.abs(hy - 0.5) * 2) + 0.01; k.lathe([[rr, y + h * hy - 0.03], [rr, y + h * hy + 0.03]], 10, M.IRON, IRONC); }
	k.load(f);
}
export function crate(k, x, y, z, s, yaw = 0) {
	const f = k.save();
	k.sub(x, 0, z, yaw);
	k.box(-s / 2, y, -s / 2, s / 2, y + s, s / 2, M.PLANK, [0.55, 0.42, 0.28]);
	for (const e of [-1, 1]) k.beam([-s / 2 - 0.01, y + 0.05, e * (s / 2 + 0.01)], [s / 2 + 0.01, y + s - 0.05, e * (s / 2 + 0.01)], 0.08, 0.03, M.TIMBER, [0.4, 0.3, 0.2]);
	k.load(f);
}

// ---------- the castle ----------
export function buildCastle(ctx) {
	const { k, col, realm, st } = ctx;
	const C = realm.castle, cy = C.y, stone = st.stone;
	const WALLH = 9, TW = 2.6, TR = 4.4, TH = 13.5;
	const V = C.verts, n = V.length;
	const walk = [];
	// a stretch of curtain wall from a to b (world)
	const wallRun = (a, b, cut0 = TR * 0.75, cut1 = TR * 0.75) => {
		const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
		const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
		const sgn = Math.cos(yaw) * (mx - C.x) - Math.sin(yaw) * (mz - C.z) > 0 ? 1 : -1;
		const z0 = -L / 2 + cut0, z1 = L / 2 - cut1;
		if (z1 - z0 < 0.5) return null;
		k.at(mx, 0, mz, yaw);
		k.box(-TW / 2, cy - 2.5, z0, TW / 2, cy + WALLH, z1, M.ASHLAR, stone, 'py');
		k.face([[-TW / 2, cy + WALLH, z0], [TW / 2, cy + WALLH, z0], [TW / 2, cy + WALLH, z1], [-TW / 2, cy + WALLH, z1]], [0, 1, 0], M.FLAG, shade(stone, 0.9));
		// the parapet on the outer side, crenellated; a low kerb inside
		const f = k.save();
		k.sub(0, 0, 0, Math.PI / 2 * sgn);
		// (in this turned frame x runs along the wall and +z points out)
		const xa = sgn > 0 ? -z1 : z0, xb = sgn > 0 ? -z0 : z1;
		crenelX(k, xa, xb, cy + WALLH, TW / 2, 0.5, 1, M.ASHLAR, stone);
		// a battered plinth on the outside, and arrow slits
		k.face([[xa, cy - 2.5, TW / 2 + 1.0], [xb, cy - 2.5, TW / 2 + 1.0], [xb, cy + 1.0, TW / 2], [xa, cy + 1.0, TW / 2]], [0, 0.4, 1], M.ASHLAR, shade(stone, 0.92));
		for (let x = xa + 2.5; x < xb - 1.5; x += 4.2) slit(k, x, cy + 4.2, TW / 2 + 0.012);
		k.box(xa, cy + WALLH, -TW / 2, xb, cy + WALLH + 0.35, -TW / 2 + 0.35, M.ASHLAR, stone);
		k.load(f);
		col.solid(mx, mz, yaw, -TW / 2, TW / 2, z0, z1, cy - 3, cy + WALLH, 'wall');
		col.slab(mx, mz, yaw, -TW / 2, TW / 2, z0, z1, cy + WALLH, 0, 'walk');
		col.solid(mx, mz, yaw, sgn > 0 ? TW / 2 - 0.5 : -TW / 2, sgn > 0 ? TW / 2 : -TW / 2 + 0.5, z0, z1, cy + WALLH, cy + WALLH + 2);
		const w = { mx, mz, yaw, L, z0, z1, sgn };
		walk.push(w);
		return w;
	};
	const GW = 12;
	for (let i = 0; i < n; i++) {
		const a = V[i], b = V[(i + 1) % n];
		if (i === C.gateEdge) {
			const g = C.gate, ux = (b.x - a.x), uz = (b.z - a.z), L = Math.hypot(ux, uz);
			const ga = { x: g.x - ux / L * GW / 2, z: g.z - uz / L * GW / 2 }, gb = { x: g.x + ux / L * GW / 2, z: g.z + uz / L * GW / 2 };
			wallRun(a, ga, TR * 0.75, -0.3); wallRun(gb, b, -0.3, TR * 0.75);
		} else wallRun(a, b);
	}
	// towers at the corners: round, battered at the foot; some capped with a cone, some open
	const roofC = st.roofs.includes('tile') ? [0.62, 0.34, 0.22] : [0.30, 0.30, 0.34];
	V.forEach((v, i) => {
		k.at(v.x, 0, v.z, 0);
		k.lathe([[TR + 1.1, cy - 3], [TR + 0.15, cy + 1.6], [TR, cy + TH]], 18, M.ASHLAR, stone);
		const capped = i % 2 === 1;
		k.lathe([[TR, cy + TH], [TR - 0.5, cy + TH]], 18, M.ASHLAR, stone);
		k.face(Array.from({ length: 18 }, (_, j) => { const a = j / 18 * TAU; return [Math.sin(a) * (TR - 0.4), cy + TH - 0.2, Math.cos(a) * (TR - 0.4)]; }), [0, 1, 0], M.FLAG, shade(stone, 0.85));
		if (capped) {
			k.cone(TR, cy + TH, TR * 1.7, 18, M.SHINGLE, roofC, 0.6);
			const tip = k.w(0, cy + TH + TR * 1.7, 0);
			ctx.flags.push({ x: tip[0], y: tip[1], z: tip[2], h: 3 });
		} else {
			crenelRing(k, TR, cy + TH, M.ASHLAR, stone);
			k.lathe([[TR, cy + TH], [TR, cy + TH + 0.02]], 18, M.ASHLAR, stone);
			const p = k.w(0, cy + TH, 0);
			ctx.flags.push({ x: p[0], y: p[1], z: p[2], h: 5 });
		}
		for (let s = 0; s < 3; s++) {
			const a = Math.atan2(v.x - C.x, v.z - C.z) + (s - 1) * 0.9;
			const f = k.save(); k.sub(Math.sin(a) * (TR + 0.01), 0, Math.cos(a) * (TR + 0.01), a);
			slit(k, 0, cy + 3.5 + s * 3.2, 0.01);
			k.load(f);
		}
		col.round(v.x, v.z, TR + 0.3, cy - 3, cy + TH + 2, 'tower');
	});
	// the gatehouse: an arched passage between two drum towers, a portcullis raised in it
	{
		const g = C.gate, GD = 9, GH = 12.5;
		k.at(g.x, 0, g.z, g.yaw);
		archWall(k, 0, cy - 0.5, 0, GW, GH + 0.5, GD, 4, 3.4, M.ASHLAR, stone);
		crenelX(k, -GW / 2, GW / 2, cy + GH, GD / 2, 0.5, 1, M.ASHLAR, stone);
		crenelX(k, -GW / 2, GW / 2, cy + GH, -GD / 2, 0.5, -1, M.ASHLAR, stone);
		for (const s of [-1, 1]) {
			const f = k.save();
			k.sub(s * GW / 2, 0, GD / 2 - 1.2);
			k.lathe([[3.4, cy - 3], [3.0, cy + 1.2], [3.0, cy + GH + 1.2]], 16, M.ASHLAR, stone);
			crenelRing(k, 3.0, cy + GH + 1.2, M.ASHLAR, stone);
			k.face(Array.from({ length: 16 }, (_, j) => { const a = j / 16 * TAU; return [Math.sin(a) * 2.6, cy + GH + 1.1, Math.cos(a) * 2.6]; }), [0, 1, 0], M.FLAG, shade(stone, 0.85));
			slit(k, s * 0.2, cy + 4, 3.02);
			k.load(f);
			const p = k.w(s * GW / 2, 0, GD / 2 - 1.2);
			col.round(p[0], p[2], 3.3, cy - 3, cy + GH + 3, 'tower');
			// the piers of the passage
			col.solid(g.x, g.z, g.yaw, s > 0 ? 2 : -GW / 2, s > 0 ? GW / 2 : -2, -GD / 2, GD / 2, cy - 3, cy + GH, 'gate');
		}
		// the portcullis, raised: its spiked foot just shows under the arch
		for (let x = -1.8; x <= 1.81; x += 0.45) k.beam([x, cy + 3.3, GD / 2 - 1.1], [x, cy + 5.4, GD / 2 - 1.1], 0.09, 0.09, M.IRON, IRONC);
		for (const y of [cy + 3.55, cy + 4.3]) k.beam([-1.95, y, GD / 2 - 1.1], [1.95, y, GD / 2 - 1.1], 0.08, 0.08, M.IRON, IRONC);
		// the gates, swung open against the passage walls
		for (const s of [-1, 1]) {
			k.box(s * 1.9 - 0.08, cy, -GD / 2 + 0.6, s * 1.9 + 0.08, cy + 3.6, -GD / 2 + 2.6, M.PLANK, PLANKC);
			for (const y of [cy + 0.6, cy + 1.8, cy + 3.0]) k.box(s * 1.9 - 0.1 * s - 0.02, y, -GD / 2 + 0.7, s * 1.9 - 0.1 * s + 0.02, y + 0.1, -GD / 2 + 2.5, M.IRON, IRONC);
		}
		// torches either side of the way in, banners over it
		for (const s of [-1, 1]) sconce(ctx, k, s * 2.7, cy + 3.3, GD / 2 + 0.01, true);
		for (const s of [-1, 1]) { const a = k.w(s * 3.6, cy + 10.8, GD / 2 + 0.08), b2 = k.w(s * 3.6 + 1, cy + 10.8, GD / 2 + 0.08); ctx.banners.push(hanging(a, b2, g.yaw, 3.6, 1.6)); }
		// the road in: a slab over the threshold so it is never a step
		col.slab(g.x, g.z, g.yaw, -2, 2, -GD / 2 - 1, GD / 2 + 1, cy + 0.02, 0);
		k.face([[-2, cy + 0.03, -GD / 2], [2, cy + 0.03, -GD / 2], [2, cy + 0.03, GD / 2 + 1], [-2, cy + 0.03, GD / 2 + 1]], [0, 1, 0], M.FLAG, shade(stone, 0.8));
	}
	// the keep: three storeys, a hall you can walk into, stairs up to its roof
	buildKeep(ctx, cy);
	// a stair up onto the wall walk beside the gate
	{
		const w = walk.find((q) => q.L > 22) || walk[0];
		if (w) {
			const len = 12.8, z0 = w.z0 + 1.2, xin = -w.sgn * TW / 2, x0 = xin - w.sgn * 1.7;
			k.at(w.mx, 0, w.mz, w.yaw);
			const steps = 30;
			for (let i = 0; i < steps; i++) {
				const za = z0 + i / steps * len, zb = z0 + (i + 1) / steps * len, top = cy + (i + 1) / steps * WALLH;
				k.box(Math.min(xin, x0), cy - 0.5, za, Math.max(xin, x0), top, zb, M.ASHLAR, shade(stone, 0.95), 'nz');
			}
			col.slab(w.mx, w.mz, w.yaw, Math.min(xin, x0), Math.max(xin, x0), z0, z0 + len, cy, WALLH / len, 'stair');
		}
	}
	// the bailey: a well, a stable along the wall, a cart, barrels, targets
	const inward = (d, off = 0) => {
		const a = C.gate.yaw + Math.PI + off;
		return { x: C.x + Math.sin(a) * d, z: C.z + Math.cos(a) * d };
	};
	const wl = inward(-12, 0.9);
	well(ctx, k, wl.x, cy, wl.z);
	realm.castle.well = wl;
	{
		// a lean-to stable against one wall
		const w = walk.find((q, i) => i === Math.floor(walk.length / 2)) || walk[1];
		if (w && w.L > 16) {
			k.at(w.mx, 0, w.mz, w.yaw);
			const xin = -w.sgn * TW / 2, xo = xin - w.sgn * 4.2, zA = -5, zB = 5;
			for (const z of [zA, 0, zB]) k.beam([xo, cy, z], [xo, cy + 2.6, z], 0.2, 0.2, M.TIMBER, st.timber);
			k.beam([xo, cy + 2.6, zA - 0.3], [xo, cy + 2.6, zB + 0.3], 0.2, 0.2, M.TIMBER, st.timber);
			const t = 0.15, hi = cy + 4.2, lo = cy + 2.5;
			k.face([[xin, hi, zA - 0.5], [xin, hi, zB + 0.5], [xo - w.sgn * 0.5, lo, zB + 0.5], [xo - w.sgn * 0.5, lo, zA - 0.5]], [-w.sgn * 0.5, 1, 0], M.SHINGLE, [0.32, 0.28, 0.24], [[zA, 0], [zB, 0], [zB, 4.6], [zA, 4.6]]);
			k.face([[xin, hi - t, zB + 0.5], [xin, hi - t, zA - 0.5], [xo - w.sgn * 0.5, lo - t, zA - 0.5], [xo - w.sgn * 0.5, lo - t, zB + 0.5]], [w.sgn * 0.5, -1, 0], M.PLANK, [0.3, 0.24, 0.18]);
			// stalls' partitions, hay, a trough
			for (const z of [-2.5, 2.5]) k.box(Math.min(xin, xin - w.sgn * 2.4), cy, z - 0.06, Math.max(xin, xin - w.sgn * 2.4), cy + 1.4, z + 0.06, M.PLANK, PLANKC);
			for (let i = 0; i < 4; i++) k.box(xin - w.sgn * (0.3 + (i % 2) * 1.1) - 0.5, cy + Math.floor(i / 2) * 0.5, -4.5 + i * 0.4 - 0.4, xin - w.sgn * (0.3 + (i % 2) * 1.1) + 0.5, cy + 0.5 + Math.floor(i / 2) * 0.5, -4.5 + i * 0.4 + 0.4, M.STRAW, [0.78, 0.66, 0.36]);
			k.box(Math.min(xin - w.sgn * 0.2, xin - w.sgn * 0.8), cy, 3, Math.max(xin - w.sgn * 0.2, xin - w.sgn * 0.8), cy + 0.6, 4.6, M.PLANK, PLANKC);
			col.solid(w.mx, w.mz, w.yaw, Math.min(xin, xo), Math.max(xin, xo), zA, zB, cy, cy + 1.4);
		}
	}
	const ca = inward(-6, -1.2);
	cart(ctx, k, ca.x, cy, ca.z, C.gate.yaw + 0.7);
	for (let i = 0; i < 5; i++) { const p = inward(-16 + i * 0.8, -0.35 - i * 0.05); barrel(k, p.x, cy, p.z); }
	for (let i = 0; i < 2; i++) { const p = inward(4 + i * 3, -1.4); dummy(ctx, k, p.x, cy, p.z); }
}

function buildKeep(ctx, cy) {
	const { k, col, realm, st } = ctx;
	const K = realm.castle.keep, stone = st.stone, inner = shade(stone, 0.82);
	const W = 15, T = 1.8, H = 15, hi = W / 2 - T;
	k.at(K.x, 0, K.z, K.yaw);
	// walls: the front with the door, the others plain
	archWall(k, 0, cy - 1, W / 2 - T / 2, W, H + 1, T, 2.4, 3.6, M.ASHLAR, stone);
	k.box(-W / 2, cy - 1, -W / 2, W / 2, cy + H, -hi, M.ASHLAR, stone);
	k.box(-W / 2, cy - 1, -hi, -hi, cy + H, hi, M.ASHLAR, stone, 'pz nz');
	k.box(hi, cy - 1, -hi, W / 2, cy + H, hi, M.ASHLAR, stone, 'pz nz');
	for (const [x0, x1, z0, z1] of [[-W / 2, -1.2, hi, W / 2], [1.2, W / 2, hi, W / 2], [-W / 2, W / 2, -W / 2, -hi], [-W / 2, -hi, -hi, hi], [hi, W / 2, -hi, hi]]) col.solid(K.x, K.z, K.yaw, x0, x1, z0, z1, cy - 2, cy + H, 'keep');
	// corner turrets and the crenellated parapet between them
	for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
		const x = sx * (W / 2 - 1.3), z = sz * (W / 2 - 1.3);
		k.box(x - 1.8, cy + H - 0.5, z - 1.8, x + 1.8, cy + H + 2.8, z + 1.8, M.ASHLAR, stone, 'ny');
		const f = k.save();
		k.sub(x, 0, z);
		crenelX(k, -1.8, 1.8, cy + H + 2.8, 1.8, 0.4, 1, M.ASHLAR, stone);
		crenelX(k, -1.8, 1.8, cy + H + 2.8, -1.8, 0.4, -1, M.ASHLAR, stone);
		k.load(f);
		const p = k.w(x, 0, z);
		col.solid(p[0], p[2], K.yaw, -1.8, 1.8, -1.8, 1.8, cy + H - 1, cy + H + 5);
		if (sx > 0 && sz < 0) { const q = k.w(x, cy + H + 2.8, z); ctx.flags.push({ x: q[0], y: q[1], z: q[2], h: 6, big: true }); }
	}
	for (const [ang] of [[0], [Math.PI / 2], [Math.PI], [-Math.PI / 2]]) {
		const f = k.save();
		k.sub(0, 0, 0, ang);
		crenelX(k, -W / 2 + 3.1, W / 2 - 3.1, cy + H, W / 2, 0.5, 1, M.ASHLAR, stone);
		k.load(f);
		const a = K.yaw + ang;
		col.solid(K.x, K.z, a, -W / 2, W / 2, W / 2 - 0.5, W / 2, cy + H - 0.2, cy + H + 2.2);
	}
	// pilaster buttresses up the faces, windows at each floor (lit at night), arrow slits
	for (const [ang] of [[0], [Math.PI / 2], [Math.PI], [-Math.PI / 2]]) {
		const f = k.save();
		k.sub(0, 0, 0, ang);
		for (const x of [-3.4, 3.4]) k.box(x - 0.5, cy - 1, W / 2, x + 0.5, cy + H - 1, W / 2 + 0.35, M.ASHLAR, stone, 'ny');
		for (const y of [cy + 8.3, cy + 11.4]) for (const x of [-1.7, 1.7]) {
			k.face([[x - 0.35, y, W / 2 + 0.02], [x + 0.35, y, W / 2 + 0.02], [x + 0.35, y + 1.5, W / 2 + 0.02], [x - 0.35, y + 1.5, W / 2 + 0.02]], [0, 0, 1], M.GLASS, [1, 1, 1]);
			k.box(x - 0.5, y - 0.12, W / 2, x + 0.5, y, W / 2 + 0.18, M.ASHLAR, stone);
			// the same lights seen from inside
			k.face([[x - 0.35, y, hi - 0.02], [x + 0.35, y, hi - 0.02], [x + 0.35, y + 1.5, hi - 0.02], [x - 0.35, y + 1.5, hi - 0.02]], [0, 0, -1], M.GLASS, [1, 1, 1]);
		}
		for (const x of [-5.6, 5.6]) slit(k, x, cy + 3.2, W / 2 + 0.012);
		k.load(f);
	}
	// banners down the face, either side of the door
	for (const s of [-1, 1]) { const a = k.w(s * 3.4 - 0.7, cy + H - 1.4, W / 2 + 0.4), b = k.w(s * 3.4 + 0.7, cy + H - 1.4, W / 2 + 0.4); ctx.banners.push(hanging(a, b, K.yaw, 5.5, 1.4)); }
	for (const s of [-1, 1]) sconce(ctx, k, s * 1.9, cy + 2.9, W / 2 + 0.01, true);
	// a step up to the door
	k.box(-1.6, cy - 0.3, W / 2, 1.6, cy + 0.02, W / 2 + 1.2, M.ASHLAR, shade(stone, 0.9));

	// ----- inside: the hall -----
	const F1 = cy + 7.5, F2 = cy + H;
	k.face([[-hi, cy + 0.03, -hi], [-hi, cy + 0.03, hi], [hi, cy + 0.03, hi], [hi, cy + 0.03, -hi]], [0, 1, 0], M.FLAG, shade(stone, 0.75));
	k.face([[-1.2, cy + 0.03, hi], [-1.2, cy + 0.03, W / 2], [1.2, cy + 0.03, W / 2], [1.2, cy + 0.03, hi]], [0, 1, 0], M.FLAG, shade(stone, 0.75));
	col.slab(K.x, K.z, K.yaw, -hi, hi, -hi, W / 2 + 1.2, cy + 0.02);
	// the upper floor: boards on beams, open along the left wall where the first stair rises
	const xs = -hi + 1.7;
	k.box(xs, F1 - 0.35, -hi, hi, F1, hi, M.PLANK, [0.42, 0.31, 0.2]);
	for (let z = -hi + 1; z < hi; z += 2.2) k.beam([xs, F1 - 0.55, z], [hi, F1 - 0.55, z], 0.26, 0.3, M.TIMBER, st.timber);
	col.slab(K.x, K.z, K.yaw, xs, hi, -hi, hi, F1);
	// a rail along the gallery's edge
	k.beam([xs + 0.05, F1 + 1.0, -hi + 1.6], [xs + 0.05, F1 + 1.0, hi], 0.1, 0.1, M.TIMBER, st.timber);
	for (let z = -hi + 1.6; z <= hi; z += 1.4) k.beam([xs + 0.05, F1, z], [xs + 0.05, F1 + 1.0, z], 0.08, 0.08, M.TIMBER, st.timber);
	col.solid(K.x, K.z, K.yaw, xs - 0.05, xs + 0.15, -hi + 1.6, hi, F1, F1 + 1.2);
	// the stairs: along the left wall up to the gallery, along the right wall up to the roof
	const stair = (x0, x1, za, zb, ya, yb) => {
		const n = Math.round(Math.abs(yb - ya) / 0.24), dz = (zb - za) / n;
		for (let i = 0; i < n; i++) {
			const z0 = za + i * dz, z1 = z0 + dz, top = ya + (i + 1) * (yb - ya) / n;
			k.box(x0, top - 0.24, Math.min(z0, z1), x1, top, Math.max(z0, z1), M.ASHLAR, shade(stone, 0.9));
		}
		// the underside
		k.face([[x0, ya - 0.3, za], [x1, ya - 0.3, za], [x1, yb - 0.3, zb], [x0, yb - 0.3, zb]], [0, -1, 0], M.ASHLAR, shade(stone, 0.7));
		const lo = Math.min(za, zb), hiZ = Math.max(za, zb), yl = zb > za ? ya : yb, yh = zb > za ? yb : ya;
		col.slab(K.x, K.z, K.yaw, x0, x1, lo, hiZ, yl, (yh - yl) / (hiZ - lo), 'stair');
	};
	stair(-hi, xs, hi - 0.4, -hi + 0.6, cy, F1);
	stair(hi - 1.7, hi, -hi + 0.6, hi - 1.2, F1, F2);
	// the roof: flagstones over all but the stairhead
	// (a hair above the walls' tops, so the two never fight)
	k.box(-W / 2, F2 - 0.4, -W / 2, hi - 1.7, F2 + 0.02, W / 2, M.FLAG, shade(stone, 0.8), 'ny');
	k.box(hi - 1.7, F2 - 0.4, hi - 1.2, W / 2, F2 + 0.02, W / 2, M.FLAG, shade(stone, 0.8), 'ny');
	k.box(hi, F2 - 0.4, -W / 2, W / 2, F2 + 0.02, hi - 1.2, M.FLAG, shade(stone, 0.8), 'ny');
	k.face([[-hi, F2 - 0.41, -hi], [hi - 1.7, F2 - 0.41, -hi], [hi - 1.7, F2 - 0.41, hi], [-hi, F2 - 0.41, hi]], [0, -1, 0], M.PLANK, [0.35, 0.26, 0.18]);
	col.slab(K.x, K.z, K.yaw, -W / 2, hi - 1.7, -W / 2, W / 2, F2);
	col.slab(K.x, K.z, K.yaw, hi - 1.7, W / 2, hi - 1.2, W / 2, F2);
	col.slab(K.x, K.z, K.yaw, hi, W / 2, -W / 2, hi - 1.2, F2);
	// the hearth on the back wall, a long table, benches, the lord's chair on a dais
	k.box(-1.7, cy, -hi, 1.7, cy + 0.25, -hi + 1.0, M.ASHLAR, inner);
	k.box(-1.7, cy + 0.25, -hi, -1.3, cy + 2.2, -hi + 0.9, M.ASHLAR, inner);
	k.box(1.3, cy + 0.25, -hi, 1.7, cy + 2.2, -hi + 0.9, M.ASHLAR, inner);
	k.box(-1.9, cy + 2.2, -hi, 1.9, cy + 3.0, -hi + 1.1, M.ASHLAR, inner);
	k.face([[-1.3, cy + 0.25, -hi + 0.02], [1.3, cy + 0.25, -hi + 0.02], [1.3, cy + 2.2, -hi + 0.02], [-1.3, cy + 2.2, -hi + 0.02]], [0, 0, 1], M.PLAIN, [0.05, 0.04, 0.035]);
	for (let i = 0; i < 3; i++) k.beam([-0.6 + i * 0.1, cy + 0.32, -hi + 0.45 + i * 0.12], [0.6 - i * 0.1, cy + 0.36, -hi + 0.5], 0.12, 0.12, M.TIMBER, [0.2, 0.12, 0.07]);
	{ const p = k.w(0, cy + 0.3, -hi + 0.5); ctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.55, always: true }); ctx.lights.push({ x: p[0], y: p[1] + 0.6, z: p[2], r: 12, always: true, hearth: true }); }
	col.solid(K.x, K.z, K.yaw, -1.9, 1.9, -hi, -hi + 1.1, cy, cy + 3);
	// the table
	k.box(-0.7, cy + 0.74, -3.2, 0.7, cy + 0.82, 3.0, M.PLANK, [0.44, 0.30, 0.18]);
	for (const z of [-2.8, 2.6]) { k.box(-0.5, cy, z - 0.08, 0.5, cy + 0.74, z + 0.08, M.PLANK, [0.38, 0.26, 0.16]); }
	for (const s of [-1, 1]) k.box(s * 1.05 - 0.18, cy + 0.42, -3.0, s * 1.05 + 0.18, cy + 0.48, 2.8, M.PLANK, [0.4, 0.28, 0.17]);
	col.solid(K.x, K.z, K.yaw, -1.3, 1.3, -3.2, 3.0, cy, cy + 0.9);
	// things on the table: plates, cups, a loaf, candles
	for (let i = 0; i < 6; i++) {
		const f = k.save();
		k.sub(0.35 * (i % 2 ? 1 : -1), 0, -2.6 + i);
		k.lathe([[0.15, cy + 0.82], [0.17, cy + 0.845]], 10, M.PLAIN, [0.55, 0.52, 0.46]);
		k.lathe([[0.04, cy + 0.83], [0.045, cy + 0.95]], 8, M.IRON, [0.5, 0.45, 0.35]);
		k.load(f);
	}
	for (const z of [-1.5, 1.5]) { const f = k.save(); k.sub(0, 0, z); k.lathe([[0.05, cy + 0.82], [0.05, cy + 1.05]], 8, M.PLAIN, [0.92, 0.88, 0.78]); const p = k.w(0, cy + 1.05, 0); ctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.06, always: true }); k.load(f); }
	// the dais and the chair
	k.box(-2.4, cy, -hi + 1.3, 2.4, cy + 0.3, -hi + 3.4, M.ASHLAR, inner);
	col.slab(K.x, K.z, K.yaw, -2.4, 2.4, -hi + 1.3, -hi + 3.4, cy + 0.3);
	k.box(-0.5, cy + 0.3, -hi + 2.2, 0.5, cy + 0.8, -hi + 2.9, M.PLANK, [0.35, 0.22, 0.12]);
	k.box(-0.55, cy + 0.8, -hi + 2.1, 0.55, cy + 2.6, -hi + 2.25, M.PLANK, [0.35, 0.22, 0.12]);
	k.box(-0.42, cy + 0.85, -hi + 2.25, 0.42, cy + 2.2, -hi + 2.3, M.CLOTH, realm.arms.field);
	// banners on the side walls, torches between them
	for (const s of [-1, 1]) for (const z of [-3.2, 1.5]) {
		const x = s * (hi - 0.08);
		const a = k.w(x, cy + 6.2, z - 0.6), b = k.w(x, cy + 6.2, z + 0.6);
		ctx.banners.push(hanging(a, b, K.yaw + s * Math.PI / 2 * -1, 3.4, 1.2, true));
	}
	for (const s of [-1, 1]) for (const z of [-1, 3.8]) {
		const f = k.save();
		k.sub(s * hi, 0, z, -s * Math.PI / 2);
		sconce(ctx, k, 0, cy + 2.6, 0.01, true);
		k.load(f);
	}
	// rushes on the floor, a chest and barrels upstairs
	k.face([[-3, cy + 0.035, -1], [3, cy + 0.035, -1], [3, cy + 0.035, 4.5], [-3, cy + 0.035, 4.5]], [0, 1, 0], M.CLOTH, shade(realm.arms.field, 0.6));
	for (let i = 0; i < 3; i++) barrel(k, hi - 0.6, F1, -hi + 3 + i * 0.8);
	crate(k, 2, F1, -3, 0.8, 0.3); crate(k, 2.9, F1, -3.2, 0.7, -0.2);
	k.box(-1, F1, 2, 1.2, F1 + 0.55, 2.8, M.PLANK, [0.4, 0.26, 0.16]);
	realm.castle.hall = { x: K.x, z: K.z, y: cy };
}

// the castle's well, and the town's
function well(ctx, k, x, y, z) {
	const f = k.save();
	k.at(x, 0, z, 0);
	k.lathe([[1.15, y - 0.2], [1.15, y + 0.85]], 14, M.RUBBLE, ctx.st.rubble);
	k.lathe([[0.85, y + 0.85], [0.85, y - 0.3]], 14, M.RUBBLE, shade(ctx.st.rubble, 0.6));
	k.lathe([[0.85, y + 0.85], [1.2, y + 0.85], [1.2, y + 0.95], [0.85, y + 0.95]], 14, M.ASHLAR, ctx.st.stone);
	k.face(Array.from({ length: 14 }, (_, j) => { const a = -j / 14 * TAU; return [Math.sin(a) * 0.85, y + 0.25, Math.cos(a) * 0.85]; }), [0, 1, 0], M.PLAIN, [0.03, 0.05, 0.06]);
	for (const s of [-1, 1]) k.beam([s * 1.0, y + 0.8, 0], [s * 1.0, y + 2.4, 0], 0.16, 0.16, M.TIMBER, ctx.st.timber);
	k.beam([-1.15, y + 2.0, 0], [1.15, y + 2.0, 0], 0.12, 0.12, M.TIMBER, ctx.st.timber);
	k.lathe([[0.04, y + 1.3], [0.04, y + 2.0]], 6, M.PLAIN, [0.6, 0.5, 0.35]);
	k.lathe([[0.16, y + 1.05], [0.19, y + 1.35]], 10, M.PLANK, [0.45, 0.32, 0.2], 0, TAU, true);
	k.at(x, 0, z, 0);
	const f2 = k.save();
	k.sub(0, 0, 0, Math.PI / 2);
	k.roof(0.6, 2.8, y + 2.35, 0.9, M.SHINGLE, [0.35, 0.3, 0.26], { over: 0.35, overZ: 0.2, thick: 0.08 });
	k.load(f2);
	ctx.col.round(x, z, 1.25, y - 1, y + 1);
	k.load(f);
}
function cart(ctx, k, x, y, z, yaw) {
	const f = k.save();
	k.at(x, 0, z, yaw);
	k.box(-0.8, y + 0.7, -1.3, 0.8, y + 0.8, 1.3, M.PLANK, PLANKC);
	for (const s of [-1, 1]) k.box(s * 0.8 - 0.05, y + 0.8, -1.3, s * 0.8 + 0.05, y + 1.2, 1.3, M.PLANK, PLANKC);
	k.box(-0.8, y + 0.8, -1.35, 0.8, y + 1.2, -1.25, M.PLANK, PLANKC);
	for (const s of [-1, 1]) {
		const w = k.save();
		k.sub(s * 0.92, 0, 0.2, Math.PI / 2);
		// a spoked wheel, turned on its side
		for (let i = 0; i < 12; i++) {
			const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU;
			k.beam([Math.sin(a0) * 0.55, y + 0.6 + Math.cos(a0) * 0.55, 0], [Math.sin(a1) * 0.55, y + 0.6 + Math.cos(a1) * 0.55, 0], 0.08, 0.1, M.TIMBER, [0.35, 0.25, 0.15]);
			if (i % 2 === 0) k.beam([0, y + 0.6, 0], [Math.sin(a0) * 0.52, y + 0.6 + Math.cos(a0) * 0.52, 0], 0.04, 0.05, M.TIMBER, [0.35, 0.25, 0.15]);
		}
		k.load(w);
	}
	k.beam([-0.3, y + 0.75, 1.3], [-0.3, y + 0.5, 3.2], 0.08, 0.08, M.TIMBER, ctx.st.timber);
	k.beam([0.3, y + 0.75, 1.3], [0.3, y + 0.5, 3.2], 0.08, 0.08, M.TIMBER, ctx.st.timber);
	for (let i = 0; i < 3; i++) k.box(-0.6 + i * 0.4, y + 0.8, -0.8 + (i % 2) * 0.6, -0.25 + i * 0.4, y + 1.15, -0.3 + (i % 2) * 0.6, M.STRAW, [0.72, 0.62, 0.36]);
	ctx.col.solid(x, z, yaw, -0.95, 0.95, -1.35, 1.35, y, y + 1.2);
	k.load(f);
}
function dummy(ctx, k, x, y, z) {
	const f = k.save();
	k.at(x, 0, z, 0);
	k.beam([0, y, 0], [0, y + 1.8, 0], 0.14, 0.14, M.TIMBER, ctx.st.timber);
	k.beam([-0.6, y + 1.45, 0], [0.6, y + 1.45, 0], 0.1, 0.1, M.TIMBER, ctx.st.timber);
	k.lathe([[0.18, y + 0.9], [0.26, y + 1.2], [0.24, y + 1.6], [0.12, y + 1.75]], 10, M.CLOTH, [0.72, 0.64, 0.46], 0, TAU, true);
	k.lathe([[0.12, y + 1.78], [0.14, y + 1.9], [0.1, y + 2.05], [0.02, y + 2.1]], 8, M.CLOTH, [0.72, 0.64, 0.46]);
	ctx.col.round(x, z, 0.3, y, y + 2);
	k.load(f);
}
// a banner hung flat against a wall from the rail a..b (world), `len` long; it hangs down
export function hanging(a, b, yaw, len, wide, inside = false) {
	const ax = [Math.sin(yaw) * (inside ? -1 : 1), 0, Math.cos(yaw) * (inside ? -1 : 1)];
	return { a, along: [0, -1, 0], len, across: [(b[0] - a[0]) / wide, (b[1] - a[1]) / wide, (b[2] - a[2]) / wide], wide, axis: ax.map((v) => v * 0.35), flag: false };
}

// ---------- the town ----------
export function buildHouse(ctx, b) {
	const { k, col, st, r } = ctx;
	const { w, d } = b, y = b.y;
	const storeys = b.kind === 'inn' ? 2 : b.storeys || 1;
	const wall = b.kind === 'inn' ? st.plaster[1] : b.wall || st.plaster[0];
	const roof = b.kind === 'inn' ? 'shingle' : b.roof || 'thatch';
	const shutter = SHUTTERS[Math.floor(r() * SHUTTERS.length)];
	k.at(b.x, 0, b.z, b.yaw);
	// the stone footing
	k.box(-w / 2 - 0.05, y - 0.8, -d / 2 - 0.05, w / 2 + 0.05, y + 0.45, d / 2 + 0.05, M.RUBBLE, st.rubble, 'py');
	let y0 = y + 0.45, jet = 0;
	const H1 = 2.7, H2 = 2.5;
	for (let s = 0; s < storeys; s++) {
		const h = s ? H2 : H1, y1 = y0 + h, ext = s ? 0.45 : 0;
		const zf = d / 2 + ext, zb = -d / 2 - ext;
		const nb = Math.max(2, Math.round(w / 1.5));
		// the ground storey is hollow, its door a real opening (interiors/medieval.js furnishes
		// it and hangs the door as you come near)
		k.box(-w / 2, y0, zb, w / 2, y1, zf, M.PLASTER, wall, s ? '' : 'ny pz');
		if (!s) {
			const bw = w / nb, um = -w / 2 + (Math.floor(nb / 2) + 0.5) * bw, dw = Math.min(1.05, bw - 0.25);
			k.quad([-w / 2, y0, zf], [um - dw / 2, y0, zf], [um - dw / 2, y1, zf], [-w / 2, y1, zf], M.PLASTER, wall);
			k.quad([um + dw / 2, y0, zf], [w / 2, y0, zf], [w / 2, y1, zf], [um + dw / 2, y1, zf], M.PLASTER, wall);
			k.quad([um - dw / 2, y0 + 2.05, zf], [um + dw / 2, y0 + 2.05, zf], [um + dw / 2, y1, zf], [um - dw / 2, y1, zf], M.PLASTER, wall);
			b.inside = { w, d, y0, h: h, storeys, door: { x: um, w: dw }, nb, frontWin: [0, nb - 1].filter((q) => q !== Math.floor(nb / 2)), x: b.x, z: b.z, yaw: b.yaw, kind: b.kind || 'house', y: b.y };
		}
		const front = { windows: s ? [0, nb - 1, Math.floor(nb / 2)].filter((q, i, a) => a.indexOf(q) === i && (nb > 2 || q !== Math.floor(nb / 2))) : [0, nb - 1].filter((q) => q !== Math.floor(nb / 2)), door: s ? -1 : Math.floor(nb / 2), open: !s, shutter };
		frameFace(ctx, k, -w / 2, zf, 1, 0, 0, 1, w, y0, y1, front);
		frameFace(ctx, k, w / 2, zb, -1, 0, 0, -1, w, y0, y1, { windows: [1], shutter });
		const sb = Math.max(2, Math.round((zf - zb) / 1.5));
		frameFace(ctx, k, w / 2, zf, 0, -1, 1, 0, zf - zb, y0, y1, { windows: [Math.floor(sb / 2)], shutter });
		frameFace(ctx, k, -w / 2, zb, 0, 1, -1, 0, zf - zb, y0, y1, { windows: s ? [Math.floor(sb / 2)] : [], shutter });
		if (s) {
			// the jetty: joist ends under the overhang
			for (let x = -w / 2 + 0.3; x < w / 2; x += 0.6) for (const z of [zf, zb]) k.beam([x, y0 - 0.12, z - Math.sign(z) * 0.6], [x, y0 - 0.12, z + Math.sign(z) * 0.02], 0.14, 0.16, M.TIMBER, st.timber);
		}
		jet = ext;
		y0 = y1;
	}
	// the roof: its ridge along the plot's depth when narrow, across when broad
	const across = w > d * 0.85;
	const rw = across ? d + jet * 2 : w, rd = across ? w : d + jet * 2;
	const rise = roof === 'thatch' ? 1.1 : roof === 'tile' ? 0.62 : 0.95;
	const mat = roof === 'thatch' ? M.THATCH : roof === 'tile' ? M.TILE : M.SHINGLE;
	const rc = roof === 'thatch' ? st.thatch : st.shingle;
	const f = k.save();
	if (across) k.sub(0, 0, 0, Math.PI / 2);
	const ry = k.roof(rw, rd, y0, rise, mat, shade(rc, 0.9 + r() * 0.2), { over: roof === 'thatch' ? 0.55 : 0.4, overZ: roof === 'thatch' ? 0.45 : 0.3, thick: roof === 'thatch' ? 0.38 : 0.12, gable: M.PLASTER, gableCol: wall, ridge: roof === 'thatch' ? M.THATCH : M.TIMBER, ridgeCol: roof === 'thatch' ? shade(st.thatch, 0.8) : st.timber });
	// a king post and collar in each gable
	for (const z of [rd / 2 + 0.05, -rd / 2 - 0.05]) {
		k.beam([0, y0, z], [0, ry - 0.2, z], 0.16, 0.12, M.TIMBER, st.timber);
		k.beam([-rw / 4, y0 + rise * rw / 4, z], [rw / 4, y0 + rise * rw / 4, z], 0.14, 0.12, M.TIMBER, st.timber);
	}
	k.load(f);
	// the chimney, up through the roof by one gable
	const cx = across ? (w / 2 - 0.9) * (r() < 0.5 ? 1 : -1) : 0.8, cz = across ? 0.3 : (d / 2 - 0.9) * (r() < 0.5 ? 1 : -1);
	k.box(cx - 0.45, y0 - 0.5, cz - 0.45, cx + 0.45, ry + 0.9, cz + 0.45, M.RUBBLE, st.rubble);
	k.box(cx - 0.52, ry + 0.9, cz - 0.52, cx + 0.52, ry + 1.05, cz + 0.52, M.ASHLAR, st.stone);
	ctx.chimneys.push(k.w(cx, ry + 1.1, cz));
	// a step at the door, maybe a lantern, barrels, a bench
	k.box(-0.8, y - 0.2, d / 2, 0.8, y + 0.2, d / 2 + 0.6, M.ASHLAR, st.stone);
	if (b.kind === 'inn') {
		// the inn: a sign on a bracket, tables and a bench outside, barrels
		k.beam([-w / 2 + 1, y + 3.4, d / 2], [-w / 2 + 1, y + 3.4, d / 2 + 1.6], 0.1, 0.1, M.IRON, IRONC);
		k.box(-w / 2 + 0.55, y + 2.55, d / 2 + 1.2, -w / 2 + 1.45, y + 3.3, d / 2 + 1.26, M.PLANK, [0.3, 0.2, 0.12]);
		k.face([[-w / 2 + 0.6, y + 2.6, d / 2 + 1.27], [-w / 2 + 1.4, y + 2.6, d / 2 + 1.27], [-w / 2 + 1.4, y + 3.25, d / 2 + 1.27], [-w / 2 + 0.6, y + 3.25, d / 2 + 1.27]], [0, 0, 1], M.CLOTH, ctx.realm.arms.charge);
		for (const x of [-3.2, 3.2]) {
			k.box(x - 0.8, y + 0.72, d / 2 + 2.2, x + 0.8, y + 0.8, d / 2 + 3.0, M.PLANK, PLANKC);
			for (const s of [-1, 1]) k.box(x - 0.7, y, d / 2 + 2.6 + s * 0.3 - 0.05, x + 0.7, y + 0.72, d / 2 + 2.6 + s * 0.3 + 0.05, M.PLANK, [0.4, 0.3, 0.2]);
			for (const s of [-1, 1]) k.box(x - 0.8, y + 0.42, d / 2 + 2.6 + s * 0.8 - 0.15, x + 0.8, y + 0.48, d / 2 + 2.6 + s * 0.8 + 0.15, M.PLANK, [0.4, 0.3, 0.2]);
			col.solid(b.x, b.z, b.yaw, x - 0.8, x + 0.8, d / 2 + 2.2, d / 2 + 3, y, y + 0.8);
		}
		for (let i = 0; i < 3; i++) barrel(k, w / 2 - 0.5, y, d / 2 + 0.6 + i * 0.75, 0.9);
		ctx.innDoor = k.w(0, y, d / 2 + 1.2);
		lantern(ctx, k, 1.1, y + 2.3, d / 2 + 0.35);
	} else if (r() < 0.45) lantern(ctx, k, 0.95, y + 2.2, d / 2 + 0.3);
	if (b.kind === 'house' && r() < 0.5) barrel(k, (w / 2 - 0.5) * (r() < 0.5 ? 1 : -1), y, d / 2 + 0.45, 0.8);
	// walls to walk into, the doorway left open; the floor inside; the storey above out of reach
	const I = b.inside, T = 0.25, dl = I.door.x - I.door.w / 2, dr = I.door.x + I.door.w / 2, yf = I.y0;
	for (const [x0, x1, z0, z1] of [[-w / 2 - 0.1, w / 2 + 0.1, -d / 2 - 0.1, -d / 2 + T], [-w / 2 - 0.1, -w / 2 + T, -d / 2, d / 2], [w / 2 - T, w / 2 + 0.1, -d / 2, d / 2], [-w / 2 - 0.1, dl, d / 2 - T, d / 2 + 0.1], [dr, w / 2 + 0.1, d / 2 - T, d / 2 + 0.1]]) col.solid(b.x, b.z, b.yaw, x0, x1, z0, z1, y - 1, y0 + 3);
	col.solid(b.x, b.z, b.yaw, dl, dr, d / 2 - T, d / 2 + 0.1, yf + 2.05, y0 + 3);
	col.slab(b.x, b.z, b.yaw, -w / 2, w / 2, -d / 2, d / 2, yf);
	// the fire in the hearth inside (interiors/medieval.js builds the hearth round it)
	{ k.at(b.x, 0, b.z, b.yaw); const p = k.w(-w / 2 + 0.3, yf + 0.3, hearthZ(I)); ctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.16, always: true }); ctx.lights.push({ x: p[0], y: p[1] + 0.3, z: p[2], r: 5, always: true }); }
	b.door = k.w(I.door.x, y, d / 2 + 0.9);
}

// the smithy: a small house with an open forge under a lean-to before it
export function buildSmithy(ctx, b) {
	const { k, col, st } = ctx;
	const hb = { ...b, kind: 'house', w: b.w, d: b.d - 3.5, storeys: 1, roof: 'shingle', wall: st.plaster[3], z: b.z - Math.cos(b.yaw) * 1.75, x: b.x - Math.sin(b.yaw) * 1.75 };
	buildHouse(ctx, hb);
	b.inside = { ...hb.inside, kind: 'smithy' };
	k.at(b.x, 0, b.z, b.yaw);
	const y = b.y, zf = b.d / 2, z0 = zf - 3.5;
	for (const x of [-b.w / 2 + 0.2, b.w / 2 - 0.2]) k.beam([x, y, zf - 0.2], [x, y + 2.5, zf - 0.2], 0.2, 0.2, M.TIMBER, st.timber);
	k.beam([-b.w / 2, y + 2.5, zf - 0.2], [b.w / 2, y + 2.5, zf - 0.2], 0.2, 0.2, M.TIMBER, st.timber);
	k.face([[-b.w / 2 - 0.3, y + 2.6, zf + 0.3], [b.w / 2 + 0.3, y + 2.6, zf + 0.3], [b.w / 2 + 0.3, y + 3.3, z0], [-b.w / 2 - 0.3, y + 3.3, z0]], [0, 1, 0.2], M.SHINGLE, [0.3, 0.28, 0.26], [[-4, 3.9], [4, 3.9], [4, 0], [-4, 0]]);
	k.face([[b.w / 2 + 0.3, y + 2.5, zf + 0.3], [-b.w / 2 - 0.3, y + 2.5, zf + 0.3], [-b.w / 2 - 0.3, y + 3.2, z0], [b.w / 2 + 0.3, y + 3.2, z0]], [0, -1, -0.2], M.PLANK, [0.3, 0.22, 0.16]);
	// the forge: a stone hearth, its hood and chimney, the coals aglow
	const fx = -b.w / 2 + 1.4, fz = z0 + 1.0;
	k.box(fx - 0.9, y, fz - 0.6, fx + 0.9, y + 0.85, fz + 0.6, M.RUBBLE, st.rubble);
	k.face([[fx - 0.6, y + 0.86, fz - 0.35], [fx + 0.6, y + 0.86, fz - 0.35], [fx + 0.6, y + 0.86, fz + 0.35], [fx - 0.6, y + 0.86, fz + 0.35]].reverse(), [0, 1, 0], M.PLAIN, [0.1, 0.05, 0.03]);
	k.box(fx - 0.8, y + 1.9, fz - 0.6, fx + 0.8, y + 2.3, fz + 0.5, M.RUBBLE, st.rubble);
	k.box(fx - 0.4, y + 2.3, fz - 0.4, fx + 0.4, y + 4.6, fz + 0.2, M.RUBBLE, st.rubble);
	{ const p = k.w(fx, y + 0.86, fz); ctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.3, always: true }); ctx.lights.push({ x: p[0], y: p[1] + 0.4, z: p[2], r: 7, always: true }); ctx.coals.push(p); }
	col.solid(b.x, b.z, b.yaw, fx - 0.9, fx + 0.9, fz - 0.6, fz + 0.6, y, y + 0.9);
	// the anvil on its block, a quench trough, a rack of tools
	const ax = fx + 2.1, az = fz + 0.6;
	k.box(ax - 0.28, y, az - 0.28, ax + 0.28, y + 0.55, az + 0.28, M.TIMBER, [0.35, 0.25, 0.16]);
	k.box(ax - 0.16, y + 0.55, az - 0.12, ax + 0.16, y + 0.72, az + 0.12, M.IRON, IRONC);
	k.box(ax - 0.36, y + 0.72, az - 0.14, ax + 0.3, y + 0.86, az + 0.14, M.IRON, IRONC);
	k.beam([ax + 0.3, y + 0.8, az], [ax + 0.55, y + 0.8, az], 0.1, 0.06, M.IRON, IRONC);
	col.round(k.w(ax, 0, az)[0], k.w(ax, 0, az)[2], 0.4, y, y + 0.9);
	b.anvil = k.w(ax, y, az + 0.8);
	k.box(ax + 1.0, y, az - 0.9, ax + 1.6, y + 0.6, az + 0.3, M.PLANK, PLANKC);
	k.face([[ax + 1.05, y + 0.55, az - 0.85], [ax + 1.05, y + 0.55, az + 0.25], [ax + 1.55, y + 0.55, az + 0.25], [ax + 1.55, y + 0.55, az - 0.85]].reverse(), [0, 1, 0], M.PLAIN, [0.04, 0.06, 0.07]);
	for (let i = 0; i < 4; i++) k.beam([b.w / 2 - 0.3, y + 1.1, z0 + 0.4 + i * 0.35], [b.w / 2 - 0.3, y + 1.8, z0 + 0.45 + i * 0.35], 0.04, 0.04, M.IRON, IRONC);
	b.door = k.w(0, y, zf + 0.8);
}

// the chapel: stone, a steep roof, lancet windows, a bell-cote; pews inside; the churchyard
export function buildChapel(ctx, b) {
	const { k, col, st, r } = ctx;
	const { w, d } = b, y = b.y, T = 0.8, H = 6.2, stone = shade(st.stone, 1.08), inner = [0.82, 0.78, 0.7];
	k.at(b.x, 0, b.z, b.yaw);
	k.box(-w / 2 - 0.3, y - 1, -d / 2 - 0.3, w / 2 + 0.3, y + 0.25, d / 2 + 0.3, M.ASHLAR, shade(stone, 0.9), 'py');
	archWall(k, 0, y, d / 2 - T / 2, w, H, T, 1.8, 2.1, M.ASHLAR, stone);
	k.box(-w / 2, y, -d / 2, w / 2, y + H, -d / 2 + T, M.ASHLAR, stone);
	k.box(-w / 2, y, -d / 2 + T, -w / 2 + T, y + H, d / 2 - T, M.ASHLAR, stone, 'pz nz');
	k.box(w / 2 - T, y, -d / 2 + T, w / 2, y + H, d / 2 - T, M.ASHLAR, stone, 'pz nz');
	// the inner faces a paler plaster
	const iw = w / 2 - T - 0.01, id = d / 2 - T - 0.01;
	k.face([[-iw, y, -id], [-iw, y, id], [-iw, y + H, id], [-iw, y + H, -id]], [1, 0, 0], M.PLASTER, inner);
	k.face([[iw, y, id], [iw, y, -id], [iw, y + H, -id], [iw, y + H, id]], [-1, 0, 0], M.PLASTER, inner);
	k.face([[iw, y, -id], [-iw, y, -id], [-iw, y + H, -id], [iw, y + H, -id]], [0, 0, 1], M.PLASTER, inner);
	for (const [x0, x1, z0, z1] of [[-w / 2, -0.9, d / 2 - T, d / 2], [0.9, w / 2, d / 2 - T, d / 2], [-w / 2, w / 2, -d / 2, -d / 2 + T], [-w / 2, -w / 2 + T, -d / 2, d / 2], [w / 2 - T, w / 2, -d / 2, d / 2]]) col.solid(b.x, b.z, b.yaw, x0, x1, z0, z1, y - 1, y + H);
	// the roof, and stone gables
	k.roof(w, d, y + H, 1.15, M.SHINGLE, shade(st.shingle, 0.95), { over: 0.4, overZ: 0.25, thick: 0.14, gable: M.ASHLAR, gableCol: stone, ridge: M.ASHLAR, ridgeCol: stone });
	// buttresses along the sides
	for (const s of [-1, 1]) for (let z = -d / 2 + 2; z < d / 2 - 1; z += 4.2) k.box(s * w / 2 - (s > 0 ? 0 : 0.6), y, z - 0.35, s * w / 2 + (s > 0 ? 0.6 : 0), y + H - 1.2, z + 0.35, M.ASHLAR, stone);
	// lancets down the sides, a round window over the altar; lit at night, seen from inside too
	for (const s of [-1, 1]) for (let z = -d / 2 + 4.1; z < d / 2 - 2; z += 4.2) {
		for (const [xx, nn] of [[s * (w / 2 + 0.02), s], [s * (iw - 0.01), -s]]) {
			k.face([[xx, y + 2.3, z - 0.3], [xx, y + 2.3, z + 0.3], [xx, y + 4.4, z + 0.3], [xx, y + 4.4, z - 0.3]], [nn, 0, 0], M.GLASS, [1, 1, 1]);
			k.face([[xx, y + 4.4, z - 0.3], [xx, y + 4.4, z + 0.3], [xx, y + 4.8, z]], [nn, 0, 0], M.GLASS, [1, 1, 1]);
		}
	}
	for (const [zz, nn] of [[-d / 2 - 0.02, -1], [-id + 0.01, 1]]) k.face(Array.from({ length: 16 }, (_, j) => { const a = j / 16 * TAU; return [Math.sin(a) * 1.0, y + H + 1.4 + Math.cos(a) * 1.0, zz]; }), [0, 0, nn], M.GLASS, [1, 1, 1]);
	// the bell-cote on the front gable, and its bell
	const gy = y + H + 1.15 * w / 2;
	k.at(b.x, 0, b.z, b.yaw);
	archWall(k, 0, gy - 0.4, d / 2 - 0.3, 1.6, 2.2, 0.5, 0.9, 1.1, M.ASHLAR, stone, 6);
	k.roof(1.8, 0.8, gy + 1.8, 1.0, M.SHINGLE, st.shingle, { over: 0.1, overZ: 0.15, thick: 0.08 });
	const f = k.save(); k.sub(0, 0, d / 2 - 0.3);
	k.lathe([[0.3, gy + 0.75], [0.22, gy + 0.95], [0.18, gy + 1.3], [0.02, gy + 1.4]], 12, M.IRON, [0.45, 0.36, 0.2]);
	k.load(f);
	// inside: flagstones, pews, the altar with candles
	k.face([[-iw, y + 0.27, -id], [-iw, y + 0.27, id + T], [iw, y + 0.27, id + T], [iw, y + 0.27, -id]], [0, 1, 0], M.FLAG, [0.62, 0.6, 0.55]);
	col.slab(b.x, b.z, b.yaw, -iw, iw, -id, d / 2 + 0.4, y + 0.27);
	for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
		const z = -id + 4.8 + i * 1.6, x0 = s > 0 ? 0.7 : -iw + 0.3, x1 = s > 0 ? iw - 0.3 : -0.7;
		k.box(x0, y + 0.27 + 0.42, z - 0.2, x1, y + 0.27 + 0.48, z + 0.2, M.PLANK, [0.42, 0.3, 0.2]);
		k.box(x0, y + 0.27 + 0.48, z + 0.16, x1, y + 0.27 + 0.95, z + 0.22, M.PLANK, [0.42, 0.3, 0.2]);
		for (const xx of [x0 + 0.05, x1 - 0.1]) k.box(xx, y + 0.27, z - 0.2, xx + 0.05, y + 0.27 + 0.95, z + 0.22, M.PLANK, [0.38, 0.27, 0.18]);
		col.solid(b.x, b.z, b.yaw, x0, x1, z - 0.22, z + 0.24, y, y + 1.2);
	}
	k.box(-1.1, y + 0.27, -id + 0.6, 1.1, y + 1.3, -id + 1.5, M.ASHLAR, [0.8, 0.76, 0.68]);
	k.box(-1.15, y + 1.3, -id + 0.55, 1.15, y + 1.33, -id + 1.55, M.CLOTH, [0.92, 0.9, 0.86]);
	k.box(-0.9, y + 1.0, -id + 1.51, 0.9, y + 1.33, -id + 1.56, M.CLOTH, ctx.realm.arms.field);
	col.solid(b.x, b.z, b.yaw, -1.2, 1.2, -id + 0.5, -id + 1.6, y, y + 1.4);
	for (const x of [-0.8, 0.8]) { const f2 = k.save(); k.sub(x, 0, -id + 1.05); k.lathe([[0.05, y + 1.33], [0.05, y + 1.75]], 8, M.PLAIN, [0.95, 0.92, 0.82]); const p = k.w(0, y + 1.76, 0); ctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.07, always: true }); k.load(f2); }
	{ const p = k.w(0, y + 2.2, -id + 1.2); ctx.lights.push({ x: p[0], y: p[1], z: p[2], r: 8, always: true }); }
	// the churchyard: headstones in rows, a low wall round it, a gap and a path at the front
	const yard = 14;
	for (let i = 0; i < 18; i++) {
		const a = b.yaw + Math.PI * 0.35 + (i / 18) * Math.PI * 1.3 + (r() - 0.5) * 0.12, dd = yard * (0.55 + r() * 0.3);
		const hx = b.x + Math.sin(a) * dd, hz = b.z + Math.cos(a) * dd, hy = ctx.H(hx, hz);
		if (Math.abs(Math.sin(a - b.yaw)) * dd < w / 2 + 1.5 && Math.cos(a - b.yaw) * dd > -d / 2 - 1.5 && Math.cos(a - b.yaw) * dd < d / 2 + 1.5) continue;
		if (ctx.avoid.some((q) => Math.hypot(q.x - hx, q.z - hz) < q.r)) continue;
		k.at(hx, 0, hz, b.yaw + (r() - 0.5) * 0.15);
		const hw = 0.28 + r() * 0.12, hh = 0.6 + r() * 0.4, lean = (r() - 0.5) * 0.1;
		if (r() < 0.2) {
			k.box(-0.06, hy - 0.2, -0.06, 0.06, hy + hh + 0.2, 0.06, M.ASHLAR, [0.58, 0.57, 0.54]);
			k.box(-0.28, hy + hh - 0.1, -0.06, 0.28, hy + hh + 0.02, 0.06, M.ASHLAR, [0.58, 0.57, 0.54]);
		} else {
			k.face([[-hw, hy - 0.2, 0.06], [hw, hy - 0.2, 0.06], [hw + lean, hy + hh, 0.06], [lean, hy + hh + hw * 0.5, 0.06], [-hw + lean, hy + hh, 0.06]], [0, 0, 1], M.ASHLAR, [0.55, 0.54, 0.5]);
			k.face([[-hw, hy - 0.2, -0.06], [hw, hy - 0.2, -0.06], [hw + lean, hy + hh, -0.06], [lean, hy + hh + hw * 0.5, -0.06], [-hw + lean, hy + hh, -0.06]], [0, 0, -1], M.ASHLAR, [0.55, 0.54, 0.5]);
			k.face([[-hw, hy - 0.2, -0.06], [-hw, hy - 0.2, 0.06], [-hw + lean, hy + hh, 0.06], [-hw + lean, hy + hh, -0.06]], [-1, 0, 0], M.ASHLAR, [0.55, 0.54, 0.5]);
			k.face([[hw, hy - 0.2, 0.06], [hw, hy - 0.2, -0.06], [hw + lean, hy + hh, -0.06], [hw + lean, hy + hh, 0.06]], [1, 0, 0], M.ASHLAR, [0.55, 0.54, 0.5]);
			k.face([[-hw + lean, hy + hh, 0.06], [lean, hy + hh + hw * 0.5, 0.06], [lean, hy + hh + hw * 0.5, -0.06], [-hw + lean, hy + hh, -0.06]], [-0.5, 1, 0], M.ASHLAR, [0.55, 0.54, 0.5]);
			k.face([[lean, hy + hh + hw * 0.5, 0.06], [hw + lean, hy + hh, 0.06], [hw + lean, hy + hh, -0.06], [lean, hy + hh + hw * 0.5, -0.06]], [0.5, 1, 0], M.ASHLAR, [0.55, 0.54, 0.5]);
		}
		col.round(hx, hz, 0.3, hy - 1, hy + 1);
	}
	// the churchyard wall
	for (let i = 0; i < 40; i++) {
		const a0 = b.yaw + (i / 40) * TAU, a1 = b.yaw + ((i + 1) / 40) * TAU;
		if (Math.abs(Math.sin((a0 + a1) / 2 - b.yaw)) < 0.12 && Math.cos((a0 + a1) / 2 - b.yaw) > 0) continue;
		const p0 = [b.x + Math.sin(a0) * yard, b.z + Math.cos(a0) * yard], p1 = [b.x + Math.sin(a1) * yard, b.z + Math.cos(a1) * yard];
		if (ctx.avoid.some((q) => Math.hypot(q.x - (p0[0] + p1[0]) / 2, q.z - (p0[1] + p1[1]) / 2) < q.r)) continue;
		const h0 = ctx.H(...p0), h1 = ctx.H(...p1), yaw = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]), L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
		k.at((p0[0] + p1[0]) / 2, 0, (p0[1] + p1[1]) / 2, yaw);
		k.box(-0.3, Math.min(h0, h1) - 0.4, -L / 2 - 0.05, 0.3, (h0 + h1) / 2 + 0.85, L / 2 + 0.05, M.RUBBLE, st.rubble);
		k.box(-0.36, (h0 + h1) / 2 + 0.85, -L / 2 - 0.05, 0.36, (h0 + h1) / 2 + 0.97, L / 2 + 0.05, M.ASHLAR, st.stone);
		col.solid(k.ox, k.oz, yaw, -0.35, 0.35, -L / 2, L / 2, Math.min(h0, h1) - 1, (h0 + h1) / 2 + 1);
	}
	k.at(b.x, 0, b.z, b.yaw);
	sconce(ctx, k, 1.3, y + 2.6, d / 2 + 0.01);
	b.door = k.w(0, y, d / 2 + 1.4);
}

// a market stall: a counter, posts and a striped awning, goods on it
export function buildStall(ctx, s) {
	const { k, col, st, realm } = ctx;
	const y = s.y, stripes = [[0.82, 0.8, 0.72], s.goods % 2 ? realm.arms.field : [0.62, 0.2, 0.14]];
	k.at(s.x, 0, s.z, s.yaw);
	k.box(-1.2, y, -0.45, 1.2, y + 0.9, 0.45, M.PLANK, PLANKC);
	k.box(-1.25, y + 0.9, -0.5, 1.25, y + 0.96, 0.5, M.PLANK, [0.5, 0.38, 0.24]);
	for (const x of [-1.2, 1.2]) { k.beam([x, y, -0.5], [x, y + 2.3, -0.5], 0.09, 0.09, M.TIMBER, st.timber); k.beam([x, y, 0.5], [x, y + 2.0, 0.5], 0.09, 0.09, M.TIMBER, st.timber); }
	const n = 6;
	for (let i = 0; i < n; i++) {
		const x0 = -1.35 + i / n * 2.7, x1 = -1.35 + (i + 1) / n * 2.7;
		k.face([[x0, y + 2.35, -0.6], [x1, y + 2.35, -0.6], [x1, y + 1.95, 1.0], [x0, y + 1.95, 1.0]], [0, 1, 0.25], M.CLOTH, stripes[i % 2]);
		k.face([[x1, y + 2.34, -0.6], [x0, y + 2.34, -0.6], [x0, y + 1.94, 1.0], [x1, y + 1.94, 1.0]], [0, -1, -0.25], M.CLOTH, stripes[i % 2]);
		k.face([[x0, y + 1.95, 1.0], [x1, y + 1.95, 1.0], [x1, y + 1.75, 1.02], [x0, y + 1.75, 1.02]].reverse(), [0, 0, 1], M.CLOTH, stripes[(i + 1) % 2]);
	}
	// the goods
	const g = s.goods, top = y + 0.96;
	for (let i = 0; i < 8; i++) {
		const x = -0.95 + (i % 4) * 0.62, z = -0.2 + Math.floor(i / 4) * 0.35;
		const f = k.save(); k.sub(x, 0, z, i);
		if (g === 0) k.lathe([[0.02, top], [0.12, top + 0.03], [0.13, top + 0.08], [0.08, top + 0.13], [0.01, top + 0.14]], 8, M.PLAIN, [0.62, 0.42, 0.2]);
		else if (g === 1) for (let j = 0; j < 4; j++) { const f2 = k.save(); k.sub((j % 2) * 0.1 - 0.05, 0, Math.floor(j / 2) * 0.1 - 0.05); k.lathe([[0.01, top], [0.05, top + 0.02], [0.05, top + 0.07], [0.01, top + 0.09]], 7, M.PLAIN, j % 3 ? [0.62, 0.1, 0.08] : [0.55, 0.62, 0.15]); k.load(f2); }
		else if (g === 2) k.lathe([[0.13, top], [0.13, top + 0.09]], 12, M.PLAIN, [0.9, 0.75, 0.35], 0, TAU, true);
		else if (g === 3) k.lathe([[0.06, top], [0.1, top + 0.06], [0.12, top + 0.16], [0.06, top + 0.24], [0.05, top + 0.28]], 10, M.PLAIN, [0.6, 0.38, 0.24]);
		else { const c = [[0.5, 0.15, 0.3], [0.2, 0.3, 0.55], [0.3, 0.45, 0.2], [0.75, 0.6, 0.3]][i % 4]; k.box(-0.13, top, -0.12, 0.13, top + 0.12, 0.12, M.CLOTH, c); }
		k.load(f);
	}
	col.solid(s.x, s.z, s.yaw, -1.25, 1.25, -0.5, 0.5, y, y + 1);
	s.keeper = { x: s.x - Math.sin(s.yaw) * 1.1, z: s.z - Math.cos(s.yaw) * 1.1 };
}

// the town's square: flagstones following the ground, the well in the middle, lantern posts
export function buildSquare(ctx) {
	const { k, realm, H } = ctx;
	const T = realm.town, R0 = 13.5, n = 24, m = 8;
	k.at(0, 0, 0, 0);
	const pt = (i, j) => { const a = i / n * TAU, rr = R0 * j / m, x = T.x + Math.sin(a) * rr, z = T.z + Math.cos(a) * rr; return [x, H(x, z) + 0.04, z]; };
	for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
		const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
		if (j === 0) k.face([a, c, d], [0, 1, 0], M.FLAG, [0.6, 0.57, 0.52]);
		else k.face([a, b, c, d], [0, 1, 0], M.FLAG, [0.6, 0.57, 0.52]);
	}
	well(ctx, k, T.x, H(T.x, T.z), T.z);
	for (let i = 0; i < 4; i++) {
		const a = (i + 0.5) / 4 * TAU + realm.town.lanes[0].a, x = T.x + Math.cos(a) * 12, z = T.z + Math.sin(a) * 12, y = H(x, z);
		lampPost(ctx, k, x, y, z);
	}
	for (const L of realm.town.lanes) { const p = L.pts[Math.min(L.pts.length - 1, 7)]; lampPost(ctx, k, p.x + 2.2, H(p.x + 2.2, p.z), p.z); }
}
function lampPost(ctx, k, x, y, z) {
	const f = k.save();
	k.at(x, 0, z, 0);
	k.beam([0, y - 0.3, 0], [0, y + 2.9, 0], 0.16, 0.16, M.TIMBER, ctx.st.timber);
	k.beam([0, y + 2.75, 0], [0.55, y + 2.75, 0], 0.07, 0.07, M.IRON, IRONC);
	lantern(ctx, k, 0.55, y + 2.25, 0);
	ctx.col.round(x, z, 0.2, y, y + 3);
	k.load(f);
}

// ---------- the mills ----------
export function buildWindmill(ctx, m) {
	const { k, col, st } = ctx;
	const y = m.y;
	k.at(m.x, 0, m.z, m.yaw);
	k.lathe([[3.8, y - 1], [3.7, y + 0.2], [2.8, y + 10]], 16, M.PLASTER, st.plaster[4] || st.plaster[0]);
	k.lathe([[3.9, y - 1], [3.9, y + 0.4]], 16, M.RUBBLE, st.rubble);
	// the cap: a boat-shaped dome that turns to the wind
	k.lathe([[3.0, y + 9.9], [3.1, y + 10.3], [2.7, y + 11.4], [1.8, y + 12.2], [0.3, y + 12.6]], 16, M.SHINGLE, [0.3, 0.26, 0.24]);
	k.beam([0, y + 11.1, 1.5], [0, y + 11.1, 3.6], 0.35, 0.35, M.TIMBER, st.timber);
	// a door, a gallery of small windows
	k.face([[-0.5, y + 0.2, 3.72], [0.5, y + 0.2, 3.72], [0.5, y + 2.2, 3.72], [-0.5, y + 2.2, 3.72]], [0, 0, 1], M.PLANK, PLANKC);
	for (const [a, hy] of [[0.9, 4], [-1.2, 6.5], [2.4, 8]]) {
		const rr = 3.7 - (hy / 10) * 0.9 + 0.02;
		const f = k.save(); k.sub(Math.sin(a) * rr, 0, Math.cos(a) * rr, a);
		k.face([[-0.3, y + hy, 0], [0.3, y + hy, 0], [0.3, y + hy + 0.7, 0], [-0.3, y + hy + 0.7, 0]], [0, 0, 1], M.GLASS, [1, 1, 1]);
		k.load(f);
	}
	col.round(m.x, m.z, 3.9, y - 1, y + 10);
	for (let i = 0; i < 4; i++) { const a = m.yaw + Math.PI + (i - 1.5) * 0.35; const p = [m.x + Math.sin(a) * 4.6, m.z + Math.cos(a) * 4.6]; k.at(p[0], 0, p[1], a); k.lathe([[0.2, y], [0.3, y + 0.3], [0.26, y + 0.65], [0.12, y + 0.72]], 8, M.CLOTH, [0.78, 0.72, 0.58], 0, TAU, true); }
	m.door = { x: m.x + Math.sin(m.yaw) * 5, z: m.z + Math.cos(m.yaw) * 5 };
	// the sails, built apart: they turn on the windshaft
	const s = ctx.newKit();
	for (let i = 0; i < 4; i++) {
		const f = s.save(); s.at(0, 0, 0, 0);
		const a = i / 4 * TAU, ca = Math.cos(a), sa = Math.sin(a);
		const P = (u, v) => [ca * u - sa * v, sa * u + ca * v, 0];
		s.beam(P(0.2, 0), P(9.5, 0), 0.22, 0.22, M.TIMBER, st.timber);
		for (let u = 1.5; u <= 9.5; u += 0.8) s.beam(P(u, -0.05), P(u, 1.9), 0.06, 0.06, M.TIMBER, st.timber);
		s.beam(P(1.5, 1.9), P(9.5, 1.9), 0.07, 0.07, M.TIMBER, st.timber);
		s.face([[...P(1.5, 0.1).slice(0, 2), 0.06], [...P(9.4, 0.1).slice(0, 2), 0.06], [...P(9.4, 1.85).slice(0, 2), 0.06], [...P(1.5, 1.85).slice(0, 2), 0.06]], [0, 0, 1], M.CLOTH, [0.86, 0.82, 0.72]);
		s.face([[...P(1.5, 0.1).slice(0, 2), 0.05], [...P(9.4, 0.1).slice(0, 2), 0.05], [...P(9.4, 1.85).slice(0, 2), 0.05], [...P(1.5, 1.85).slice(0, 2), 0.05]], [0, 0, -1], M.CLOTH, [0.8, 0.76, 0.66]);
		s.load(f);
	}
	s.at(0, 0, 0, 0);
	s.box(-0.45, -0.45, -0.3, 0.45, 0.45, 0.3, M.TIMBER, st.timber);
	const hub = k.w(0, y + 11.1, 3.7);
	ctx.spinners.push({ kit: s, x: hub[0], y: hub[1], z: hub[2], yaw: m.yaw, axis: 'z', speed: 0.55 });
}
export function buildWatermill(ctx, m) {
	const { k, col, st } = ctx;
	const y = m.y, w = m.w, d = m.d;
	k.at(m.x, 0, m.z, m.yaw);
	k.box(-w / 2, y - 2, -d / 2, w / 2, y + 3.2, d / 2, M.RUBBLE, st.rubble);
	k.box(-w / 2, y + 3.2, -d / 2 - 0.3, w / 2, y + 5.6, d / 2 + 0.3, M.PLASTER, st.plaster[2]);
	frameFace(ctx, k, -w / 2, d / 2 + 0.3, 1, 0, 0, 1, w, y + 3.2, y + 5.6, { windows: [1, 4], shutter: SHUTTERS[0] });
	frameFace(ctx, k, w / 2, -d / 2 - 0.3, -1, 0, 0, -1, w, y + 3.2, y + 5.6, { windows: [2], shutter: SHUTTERS[0] });
	k.roof(w, d + 0.6, y + 5.6, 0.9, M.SHINGLE, st.shingle, { over: 0.5, overZ: 0.4, thick: 0.12, gable: M.PLASTER, gableCol: st.plaster[2], ridge: M.TIMBER, ridgeCol: st.timber });
	// the door at the back, away from the water; windows in the stone
	k.face([[-0.6, y, -d / 2 - 0.02], [0.6, y, -d / 2 - 0.02], [0.6, y + 2.2, -d / 2 - 0.02], [-0.6, y + 2.2, -d / 2 - 0.02]].reverse(), [0, 0, -1], M.PLANK, PLANKC);
	for (const x of [-2.5, 2.5]) k.face([[x - 0.35, y + 1.2, d / 2 + 0.02], [x + 0.35, y + 1.2, d / 2 + 0.02], [x + 0.35, y + 2.1, d / 2 + 0.02], [x - 0.35, y + 2.1, d / 2 + 0.02]], [0, 0, 1], M.GLASS, [1, 1, 1]);
	col.solid(m.x, m.z, m.yaw, -w / 2, w / 2, -d / 2 - 0.3, d / 2 + 0.3, y - 2, y + 6);
	m.door = { x: m.x - Math.sin(m.yaw) * (d / 2 + 1.5), z: m.z - Math.cos(m.yaw) * (d / 2 + 1.5) };
	// the wheel, built apart (axis along its x), turned by the stream
	const W = m.wheel, s = ctx.newKit(), R = 2.7, n = 16;
	for (let i = 0; i < n; i++) {
		const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
		for (const x of [-0.6, 0.6]) s.beam([x, Math.cos(a0) * R, Math.sin(a0) * R], [x, Math.cos(a1) * R, Math.sin(a1) * R], 0.12, 0.16, M.TIMBER, [0.3, 0.22, 0.14]);
		// a paddle: a board standing out from the rim
		const ca = Math.cos(a0), sa = Math.sin(a0), P2 = (x, rr, t) => [x, ca * rr - sa * t, sa * rr + ca * t];
		for (const t of [-0.03, 0.03]) s.face([P2(-0.65, R - 0.6, t), P2(0.65, R - 0.6, t), P2(0.65, R + 0.05, t), P2(-0.65, R + 0.05, t)], [0, -sa * t, ca * t], M.PLANK, [0.36, 0.28, 0.18]);
		if (i % 2 === 0) for (const x of [-0.6, 0.6]) s.beam([x, 0, 0], [x, Math.cos(a0) * R, Math.sin(a0) * R], 0.1, 0.1, M.TIMBER, [0.3, 0.22, 0.14]);
	}
	s.beam([-1.2, 0, 0], [1.2, 0, 0], 0.3, 0.3, M.TIMBER, st.timber);
	ctx.spinners.push({ kit: s, x: W.x, y: W.y + 1.3, z: W.z, yaw: m.yaw + Math.PI / 2, axis: 'x', speed: -0.7 });
}

// ---------- on the heights ----------
export function buildWatchtower(ctx, t) {
	const { k, col, st } = ctx;
	const y = t.y, S = 2.6, H = 11;
	k.at(t.x, 0, t.z, t.yaw);
	k.box(-S - 0.4, y - 1.5, -S - 0.4, S + 0.4, y + 0.6, S + 0.4, M.RUBBLE, st.rubble);
	k.box(-S, y + 0.6, -S, S, y + H, S, M.RUBBLE, st.rubble, 'py');
	k.face([[-S, y + H, S], [S, y + H, S], [S, y + H, -S], [-S, y + H, -S]], [0, 1, 0], M.FLAG, shade(st.stone, 0.8));
	for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
		const f = k.save(); k.sub(0, 0, 0, ang);
		crenelX(k, -S, S, y + H, S, 0.45, 1, M.RUBBLE, st.rubble);
		slit(k, 0.8, y + 5, S + 0.012);
		k.load(f);
	}
	k.face([[-0.55, y + 0.6, S + 0.02], [0.55, y + 0.6, S + 0.02], [0.55, y + 2.6, S + 0.02], [-0.55, y + 2.6, S + 0.02]], [0, 0, 1], M.PLANK, PLANKC);
	k.box(-0.75, y + 2.6, S, 0.75, y + 2.85, S + 0.2, M.ASHLAR, st.stone);
	// the beacon: an iron basket of wood on the roof
	k.lathe([[0.3, y + H], [0.3, y + H + 0.9]], 8, M.ASHLAR, st.stone);
	k.lathe([[0.35, y + H + 0.9], [0.9, y + H + 1.5]], 10, M.IRON, IRONC);
	for (let i = 0; i < 6; i++) k.beam([Math.cos(i) * 0.5, y + H + 1.0, Math.sin(i) * 0.5], [Math.cos(i + 2.5) * 0.4, y + H + 1.5, Math.sin(i + 2.5) * 0.4], 0.1, 0.1, M.TIMBER, [0.3, 0.2, 0.12]);
	t.beacon = k.w(0, y + H + 1.35, 0);
	t.door = k.w(0, y, S + 1.6);
	col.solid(t.x, t.z, t.yaw, -S - 0.4, S + 0.4, -S - 0.4, S + 0.4, y - 1.5, y + H + 2);
}
export function buildStones(ctx, S) {
	const { k, col, r, H } = ctx;
	const n = 11;
	for (let i = 0; i < n; i++) {
		const a = i / n * TAU + r() * 0.1, x = S.x + Math.sin(a) * S.r, z = S.z + Math.cos(a) * S.r, y = H(x, z);
		const fallen = i === 3;
		k.at(x, 0, z, a + (r() - 0.5) * 0.3);
		const w = 0.6 + r() * 0.5, t = 0.35 + r() * 0.25, h = 2.2 + r() * 1.6;
		const j = () => (r() - 0.5) * 0.18;
		// a rough slab: its corners pulled about, narrowing a little to the top
		const c = fallen
			? [[-h / 2, y - 0.1, -w / 2], [h / 2, y - 0.1, -w / 2], [h / 2, y - 0.1, w / 2], [-h / 2, y - 0.1, w / 2], [-h / 2 + j(), y + t * 1.6, -w / 2 + j()], [h / 2 + j(), y + t * 1.4, -w / 2 + j()], [h / 2 + j(), y + t * 1.5, w / 2 + j()], [-h / 2 + j(), y + t * 1.7, w / 2 + j()]]
			: [[-w / 2, y - 0.5, -t / 2], [w / 2, y - 0.5, -t / 2], [w / 2, y - 0.5, t / 2], [-w / 2, y - 0.5, t / 2], [-w * 0.4 + j(), y + h + j(), -t * 0.4 + j() * 0.3], [w * 0.4 + j(), y + h + j(), -t * 0.4], [w * 0.38 + j(), y + h + j(), t * 0.4], [-w * 0.42 + j(), y + h + j(), t * 0.4 + j() * 0.3]];
		const g = [0.52 + r() * 0.08, 0.52 + r() * 0.06, 0.5 + r() * 0.05];
		const F = [[0, 1, 5, 4, [0, 0, -1]], [1, 2, 6, 5, [1, 0, 0]], [2, 3, 7, 6, [0, 0, 1]], [3, 0, 4, 7, [-1, 0, 0]], [4, 5, 6, 7, [0, 1, 0]]];
		for (const [p, q, s2, u, nl] of F) k.face([c[p], c[q], c[s2], c[u]], nl, M.PLAIN, g);
		col.round(x, z, fallen ? 1 : 0.55, y - 1, y + (fallen ? 0.7 : h));
	}
	// the flat stone in the middle
	k.at(S.x, 0, S.z, r() * TAU);
	k.box(-1.1, S.y - 0.2, -0.6, 1.1, S.y + 0.45, 0.6, M.PLAIN, [0.5, 0.49, 0.46]);
	col.solid(S.x, S.z, k.yaw, -1.1, 1.1, -0.6, 0.6, S.y - 1, S.y + 0.45);
	col.slab(S.x, S.z, k.yaw, -1.1, 1.1, -0.6, 0.6, S.y + 0.45);
}

// ---------- the land ----------
export function buildBridge(ctx, b) {
	const { k, col, st } = ctx;
	const L = b.len, hw = b.w / 2, n = 12;
	const mid = Math.max(b.y0, b.y1, b.water + 2.2);
	const top = (t) => b.y0 + (b.y1 - b.y0) * t + (mid - (b.y0 + (b.y1 - b.y0) * 0.5)) * Math.sin(Math.PI * t);
	const under = (t) => { const a = (t - 0.14) / 0.72; return a <= 0 || a >= 1 ? -1e9 : b.water + 0.2 + (mid - 1.1 - b.water - 0.2) * Math.sqrt(Math.max(0, Math.sin(Math.PI * a))); };
	k.at(b.x, 0, b.z, b.yaw);
	for (let i = 0; i < n; i++) {
		const t0 = i / n, t1 = (i + 1) / n, z0 = -L / 2 + t0 * L, z1 = -L / 2 + t1 * L, y0 = top(t0), y1 = top(t1);
		k.face([[-hw, y0, z0], [-hw, y1, z1], [hw, y1, z1], [hw, y0, z0]], [0, 1, 0], M.FLAG, [0.55, 0.52, 0.47]);
		// the spandrels down to the arch (or to the ground at the ends)
		const u0 = Math.max(under(t0), b.water - 1.5), u1 = Math.max(under(t1), b.water - 1.5);
		for (const s of [-1, 1]) {
			const x = s * (hw + 0.4);
			k.face([[x, u0, z0], [x, u1, z1], [x, y1 + 0.9, z1], [x, y0 + 0.9, z0]], [s, 0, 0], M.ASHLAR, st.stone);
			k.face([[s * hw, y0, z0], [s * hw, y1, z1], [s * hw, y1 + 0.9, z1], [s * hw, y0 + 0.9, z0]], [-s, 0, 0], M.ASHLAR, st.stone);
			k.face([[s * hw, y0 + 0.9, z0], [s * hw, y1 + 0.9, z1], [x, y1 + 0.9, z1], [x, y0 + 0.9, z0]], [0, 1, 0], M.ASHLAR, shade(st.stone, 0.9));
		}
		if (under(t0) > -1e8 || under(t1) > -1e8) k.face([[-hw - 0.4, u0, z0], [hw + 0.4, u0, z0], [hw + 0.4, u1, z1], [-hw - 0.4, u1, z1]], [0, -1, 0], M.ASHLAR, shade(st.stone, 0.7));
		// walked on: each stretch its own slope
		col.slab(b.x, b.z, b.yaw, -hw, hw, z0, z1, y0, (y1 - y0) / (z1 - z0), 'bridge');
	}
	for (const s of [-1, 1]) col.solid(b.x, b.z, b.yaw, s > 0 ? hw : -hw - 0.4, s > 0 ? hw + 0.4 : -hw, -L / 2, L / 2, b.water - 2, mid + 1.2);
}
// the river's surface: a ribbon down its middle, level across, falling with the stream
export function riverGeometry(river) {
	const P = river.pts, pos = [], uv = [], idx = [];
	let run = 0;
	for (let i = 0; i < P.length; i++) {
		const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
		const nx = -dz / l, nz = dx / l, p = P[i], w = p.b + 0.9;
		if (i) run += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z);
		pos.push(p.x - nx * w, p.w, p.z - nz * w, p.x + nx * w, p.w, p.z + nz * w);
		uv.push(-1, run, 1, run);
		if (i) { const q = (i - 1) * 2; idx.push(q, q + 1, q + 3, q, q + 3, q + 2); }
	}
	return { pos, uv, idx };
}
// fields: crops in rows, hedgerows and fences round them, haystacks, a gate
export function buildField(ctx, f, hedge) {
	const { k, col, H, r } = ctx;
	const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
	const W = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
	k.at(0, 0, 0, 0);
	if (f.crop === 'wheat' || f.crop === 'barley') {
		const h = f.crop === 'wheat' ? 0.95 : 0.75, colr = f.crop === 'wheat' ? [0.8, 0.64, 0.3] : [0.72, 0.68, 0.42];
		for (let lz = -f.d / 2 + 1.2; lz < f.d / 2 - 1; lz += 0.9) {
			const n = Math.ceil((f.w - 2.4) / 3);
			for (let i = 0; i < n; i++) {
				const x0 = -f.w / 2 + 1.2 + i * 3, x1 = Math.min(f.w / 2 - 1.2, x0 + 3);
				const [ax, az] = W(x0, lz), [bx, bz] = W(x1, lz), ya = H(ax, az), yb = H(bx, bz);
				const q = (lx, dz, dy, y) => { const [x, z] = W(lx, lz + dz); return [x, y + dy, z]; };
				k.face([q(x0, -0.32, 0, ya), q(x1, -0.32, 0, yb), q(x1, -0.2, h, yb), q(x0, -0.2, h, ya)], [0, 0.3, -1], M.STRAW, colr, [[x0, 0], [x1, 0], [x1, h], [x0, h]]);
				k.face([q(x0, 0.32, 0, ya), q(x1, 0.32, 0, yb), q(x1, 0.2, h, yb), q(x0, 0.2, h, ya)], [0, 0.3, 1], M.STRAW, colr, [[x0, 0], [x1, 0], [x1, h], [x0, h]]);
				k.face([q(x0, -0.2, h, ya), q(x1, -0.2, h, yb), q(x1, 0.2, h, yb), q(x0, 0.2, h, ya)], [0, 1, 0], M.STRAW, shade(colr, 1.1), [[x0, 0], [x1, 0], [x1, 0.4], [x0, 0.4]]);
			}
		}
	}
	if (f.hay) for (let i = 0; i < 3; i++) {
		const [x, z] = W((r() - 0.5) * f.w * 0.6, (r() - 0.5) * f.d * 0.6), y = H(x, z);
		k.at(x, 0, z, 0);
		k.lathe([[1.5, y - 0.2], [1.6, y + 0.8], [1.3, y + 1.9], [0.6, y + 2.7], [0.05, y + 2.9]], 12, M.THATCH, [0.74, 0.62, 0.34]);
		col.round(x, z, 1.5, y - 1, y + 2.9);
		k.at(0, 0, 0, 0);
	}
	// the edges: hedgerow blobs on most sides, a post-and-rail fence round a pasture
	const edges = [[-f.w / 2, -f.d / 2, f.w / 2, -f.d / 2], [f.w / 2, -f.d / 2, f.w / 2, f.d / 2], [f.w / 2, f.d / 2, -f.w / 2, f.d / 2], [-f.w / 2, f.d / 2, -f.w / 2, -f.d / 2]];
	edges.forEach(([x0, z0, x1, z1], e) => {
		const L = Math.hypot(x1 - x0, z1 - z0), gate = e === f.gate;
		const fence = f.crop === 'pasture';
		for (let u = 0; u < L; u += fence ? 2.4 : 1.3) {
			const t = u / L;
			if (gate && Math.abs(t - 0.5) * L < 1.8) continue;
			const [x, z] = W(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t), y = H(x, z);
			if (ctx.roadDist(x, z) < 1.5) continue;
			if (fence) {
				k.at(x, 0, z, Math.atan2(W(x1, z1)[0] - W(x0, z0)[0], W(x1, z1)[1] - W(x0, z0)[1]));
				k.beam([0, y - 0.2, 0], [0, y + 1.15, 0], 0.12, 0.12, M.TIMBER, [0.36, 0.28, 0.2]);
				const [nx, nz] = W(x0 + (x1 - x0) * Math.min(1, (u + 2.4) / L), z0 + (z1 - z0) * Math.min(1, (u + 2.4) / L)), ny = H(nx, nz);
				const dl = Math.min(2.4, L - u);
				for (const hy of [0.5, 1.0]) k.beam([0, y + hy, 0], [0, ny + hy, dl], 0.07, 0.1, M.TIMBER, [0.42, 0.33, 0.22]);
				k.at(0, 0, 0, 0);
			} else hedge.push({ x, y, z, s: 0.9 + r() * 0.5 });
		}
		const [ax, az] = W(x0, z0), [bx, bz] = W(x1, z1), yaw = Math.atan2(bx - ax, bz - az);
		const segs = gate ? [[0, 0.5 - 1.8 / L], [0.5 + 1.8 / L, 1]] : [[0, 1]];
		for (const [t0, t1] of segs) {
			const L2 = (t1 - t0) * L, mx = ax + (bx - ax) * (t0 + t1) / 2, mz = az + (bz - az) * (t0 + t1) / 2, my = H(mx, mz);
			col.solid(mx, mz, yaw, -0.5, 0.5, -L2 / 2, L2 / 2, my - 2, my + 1.4, 'hedge');
		}
		if (gate) {
			const [gx, gz] = W(x0 + (x1 - x0) * 0.5, z0 + (z1 - z0) * 0.5), gy = H(gx, gz);
			k.at(gx, 0, gz, yaw);
			for (const sz of [-1.8, 1.8]) k.beam([0, gy - 0.2, sz], [0, gy + 1.3, sz], 0.18, 0.18, M.TIMBER, [0.34, 0.26, 0.18]);
			// the gate, left open
			k.at(gx, 0, gz, yaw + 1.2);
			for (const hy of [0.3, 0.7, 1.1]) k.beam([0, gy + hy, 1.7], [0, gy + hy, -1.6], 0.05, 0.1, M.TIMBER, [0.5, 0.4, 0.28]);
			k.beam([0, gy + 0.3, 1.7], [0, gy + 1.1, -1.6], 0.05, 0.1, M.TIMBER, [0.5, 0.4, 0.28]);
			k.at(0, 0, 0, 0);
		}
	});
}
