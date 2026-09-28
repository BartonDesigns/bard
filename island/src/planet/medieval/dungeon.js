// Under the realm: the crypt, the castle's cellars, the barrow. Each dungeon is a chain of
// boxes the planner cut in the rock (plan.js): a stair down from the surface, vaulted rooms
// and the passages between them. Here they are lined with masonry: walls with doorways
// where one box opens into the next, floors of flagstones, barrel vaults with ribs, stairs,
// and what each room holds (tombs, niches with urns, barrels, cells, pillars, a fallen
// vault, a portcullis worked by a lever, a chest). Where a passage broke through into the
// natural caves the masonry ends ragged over a spill of rubble and the rock goes on.
//
// Walking: the boxes, less a body's width, are where one can be; the floors are theirs.
// Dark: the masonry is lit as the caves are (cavemat.js), by the torches along its walls.

import { Kit, M } from './kit.js';
import { sconce } from './build.js';
import { createCollide } from './collide.js';

const TAU = Math.PI * 2;
const IRONC = [0.16, 0.16, 0.17];
const shade = (c, k) => c.map((v) => Math.min(1, v * k));
const inBox = (o, x, z, pad = 0) => { const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c; return Math.abs(lx) < o.hw + pad && Math.abs(lz) < o.hd + pad ? [lx, lz] : null; };
const floorOf = (o, lz) => o.fy + (lz + o.hd) * o.slope;
const spring = (o) => (o.kind === 'stair' || o.kind === 'pass' || o.kind === 'breach' ? o.h - 1.0 : o.h - 1.4);

export function buildDungeons(realm, ctx) {
	const out = [];
	for (const D of realm.dungeons) out.push(buildOne(D, realm, ctx));
	return out;
}

function buildOne(D, realm, ctx) {
	const { st, rnd } = ctx;
	const k = new Kit();
	const col = createCollide();
	const flames = [], lights = [], foes = [], props = {};
	const lctx = { flames, lights };
	const barrow = D.id === 'barrow';
	const WALL = barrow ? M.RUBBLE : M.ASHLAR, wc = shade(barrow ? st.rubble : st.stone, 0.5), fc = shade(st.stone, 0.42);
	const boxes = D.boxes;
	const others = (b) => boxes.filter((o) => o !== b);
	// is (x, z) at floor height y inside another box of this dungeon (with a margin)?
	const within = (b, x, z, y, pad) => {
		for (const o of others(b)) {
			const l = inBox(o, x, z, pad);
			if (l && Math.abs(floorOf(o, Math.max(-o.hd, Math.min(o.hd, l[1]))) - y) < 2.2) return o;
		}
		return null;
	};
	for (const b of boxes) {
		const toW = (lx, lz) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c];
		k.at(b.x, 0, b.z, b.yaw);
		const sp = spring(b), rise = b.h - sp;
		const hw = b.hw, hd = b.hd;
		// ----- walls, with doorways where another box opens off this one -----
		const sides = [
			{ n: [1, 0], a: [hw, -hd], d: [0, 1], L: hd * 2, open: false },
			{ n: [-1, 0], a: [-hw, hd], d: [0, -1], L: hd * 2, open: false },
			{ n: [0, 1], a: [hw, hd], d: [-1, 0], L: hw * 2, open: !!b.openB },
			{ n: [0, -1], a: [-hw, -hd], d: [1, 0], L: hw * 2, open: !!b.openA },
		];
		for (const S of sides) {
			if (S.open) continue;
			const step = 0.25, n = Math.ceil(S.L / step);
			const run = [];
			for (let i = 0; i < n; i++) {
				const u = (i + 0.5) / n * S.L, lx = S.a[0] + S.d[0] * u, lz = S.a[1] + S.d[1] * u;
				const fl = floorOf(b, Math.max(-hd, Math.min(hd, lz)));
				const [wx, wz] = toW(lx - S.n[0] * 0.05, lz - S.n[1] * 0.05), [ox, oz] = toW(lx + S.n[0] * 0.35, lz + S.n[1] * 0.35);
				const inside = within(b, wx, wz, fl, -0.1), beyond = within(b, ox, oz, fl, 0);
				const gap = inside || beyond;
				run.push({ u, gap, top: gap ? gap.fy + gap.h + (gap.slope ? 3 : 0) : 0, lx, lz, fl });
			}
			// merge into stretches
			let i = 0;
			while (i < run.length) {
				let j = i;
				while (j + 1 < run.length && !!run[j + 1].gap === !!run[i].gap) j++;
				const u0 = run[i].u - S.L / n / 2, u1 = run[j].u + S.L / n / 2;
				const p0 = [S.a[0] + S.d[0] * u0, S.a[1] + S.d[1] * u0], p1 = [S.a[0] + S.d[0] * u1, S.a[1] + S.d[1] * u1];
				const f0 = floorOf(b, Math.max(-hd, Math.min(hd, p0[1]))), f1 = floorOf(b, Math.max(-hd, Math.min(hd, p1[1])));
				const nl = [-S.n[0], 0, -S.n[1]];
				if (!run[i].gap) {
					// a wall, split along a slope so it follows the stair
					const segs = b.slope ? Math.max(1, Math.ceil(Math.abs(u1 - u0) / 1.2)) : 1;
					for (let q = 0; q < segs; q++) {
						const ta = q / segs, tb = (q + 1) / segs;
						const A = [p0[0] + (p1[0] - p0[0]) * ta, p0[1] + (p1[1] - p0[1]) * ta], B = [p0[0] + (p1[0] - p0[0]) * tb, p0[1] + (p1[1] - p0[1]) * tb];
						const fa = f0 + (f1 - f0) * ta, fb = f0 + (f1 - f0) * tb;
						k.face([[A[0], fa - 0.4, A[1]], [B[0], fb - 0.4, B[1]], [B[0], fb + sp, B[1]], [A[0], fa + sp, A[1]]], nl, WALL, wc);
					}
				} else {
					// a doorway: a lintel over it up to the spring, and a jamb either side
					const top = Math.min(run[i].gap.fy + run[i].gap.h, f0 + sp);
					if (top < f0 + sp - 0.05) k.face([[p0[0], top, p0[1]], [p1[0], top, p1[1]], [p1[0], f0 + sp, p1[1]], [p0[0], f0 + sp, p0[1]]], nl, WALL, wc);
					for (const P of [p0, p1]) {
						const f = floorOf(b, Math.max(-hd, Math.min(hd, P[1])));
						k.box(P[0] - 0.28 - Math.abs(S.n[0]) * 0.02, f, P[1] - 0.28 - Math.abs(S.n[1]) * 0.02, P[0] + 0.28, f + Math.min(sp, top - f), P[1] + 0.28, M.ASHLAR, shade(st.stone, 0.6));
					}
				}
				i = j + 1;
			}
		}
		// ----- the floor (and on a stair, its steps) -----
		const trim = (lz) => { const [x, z] = toW(0, lz); return (b.kind === 'pass' || b.kind === 'breach') && within(b, x, z, floorOf(b, lz), -0.3)?.kind !== 'pass' && within(b, x, z, floorOf(b, lz), -0.3); };
		if (b.slope && Math.abs(b.slope) > 0.2) {
			const td = 0.32, n = Math.floor(hd * 2 / td);
			for (let i = 0; i < n; i++) {
				const z0 = -hd + i * td, z1 = z0 + td;
				if (trim((z0 + z1) / 2)) continue;
				const top = floorOf(b, (z0 + z1) / 2) + Math.abs(b.slope) * td / 2;
				k.box(-hw, top - 0.5, z0, hw, top, z1, M.ASHLAR, shade(fc, 1.1), 'ny');
			}
		} else {
			const n = Math.max(1, Math.ceil(hd * 2 / 2));
			for (let i = 0; i < n; i++) {
				const z0 = -hd + i / n * hd * 2, z1 = -hd + (i + 1) / n * hd * 2;
				if (trim((z0 + z1) / 2)) continue;
				k.face([[-hw, floorOf(b, z0) + 0.01, z0], [hw, floorOf(b, z0) + 0.01, z0], [hw, floorOf(b, z1) + 0.01, z1], [-hw, floorOf(b, z1) + 0.01, z1]], [0, 1, 0], M.FLAG, fc);
			}
		}
		// ----- the vault: a low barrel along the box, with ribs across it -----
		{
			const segs = 10, n = Math.max(1, Math.ceil(hd * 2 / 1.0));
			for (let i = 0; i < n; i++) {
				const z0 = -hd + i / n * hd * 2, z1 = -hd + (i + 1) / n * hd * 2;
				if (trim((z0 + z1) / 2)) continue;
				const fa = floorOf(b, z0), fb = floorOf(b, z1);
				for (let j = 0; j < segs; j++) {
					const t0 = j / segs * Math.PI, t1 = (j + 1) / segs * Math.PI;
					const x0 = hw * Math.cos(t0), x1 = hw * Math.cos(t1), y0 = sp + rise * Math.sin(t0), y1 = sp + rise * Math.sin(t1);
					k.face([[x0, fa + y0, z0], [x1, fa + y1, z0], [x1, fb + y1, z1], [x0, fb + y0, z1]], [-Math.cos((t0 + t1) / 2), -Math.sin((t0 + t1) / 2), 0], barrow ? M.RUBBLE : M.ASHLAR, shade(wc, 0.9));
				}
			}
			// the half-round ends of the vault over the end walls, where nothing opens beyond
			for (const e of [-1, 1]) {
				if ((e < 0 && b.openA) || (e > 0 && b.openB)) continue;
				const lz = e * hd, f = floorOf(b, lz), [ox, oz] = toW(0, lz + e * 0.4);
				if (b.kind === 'stair' || b.kind === 'pass' || b.kind === 'breach') { if (within(b, ox, oz, f, 0) || trim(lz - e * 0.3)) continue; }
				const pts = [];
				for (let j = 0; j <= segs; j++) { const tt = j / segs * Math.PI; pts.push([hw * Math.cos(tt), f + sp + rise * Math.sin(tt), lz]); }
				k.face(pts, [0, 0, -e], WALL, wc);
			}
			// ribs (not on a stair)
			if (!b.slope) for (let z = -hd + 1.5; z < hd - 0.5; z += 3) {
				if (trim(z)) continue;
				const f = floorOf(b, z);
				for (let j = 0; j < 8; j++) {
					const t0 = j / 8 * Math.PI, t1 = (j + 1) / 8 * Math.PI, rr = 0.12;
					k.beam([(hw - rr) * Math.cos(t0), f + sp + (rise - rr) * Math.sin(t0), z], [(hw - rr) * Math.cos(t1), f + sp + (rise - rr) * Math.sin(t1), z], 0.3, 0.25, M.ASHLAR, shade(st.stone, 0.55));
				}
				for (const s of [-1, 1]) k.box(s * hw - (s > 0 ? 0.22 : 0), f, z - 0.2, s * hw + (s < 0 ? 0.22 : 0), f + sp, z + 0.2, M.ASHLAR, shade(st.stone, 0.55));
			}
		}
		// ----- torches along the walls -----
		const nT = b.kind === 'stair' ? 1 : b.kind === 'pass' || b.kind === 'breach' ? 1 : 2 + (hd > 5 ? 1 : 0);
		for (let i = 0; i < nT; i++) {
			const s = i % 2 ? -1 : 1, lz = nT === 1 ? 0 : -hd + (i + 1) / (nT + 1) * hd * 2;
			const [wx, wz] = toW(s * (hw + 0.4), lz);
			if (within(b, wx, wz, floorOf(b, lz), 0)) continue;
			const f = k.save();
			k.sub(s * hw, 0, lz, -s * Math.PI / 2);
			sconce(lctx, k, 0, floorOf(b, lz) + 2.0, 0.01, true);
			k.load(f);
		}
	}
	// ----- what each room holds -----
	const rooms = D.rooms;
	const inRoom = (b, lx, lz) => [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c];
	const place = (b, lx, lz, yaw = 0) => { k.at(...frameAt(b, lx, lz), b.yaw + yaw); return b.fy; };
	const frameAt = (b, lx, lz) => { const [x, z] = inRoom(b, lx, lz); return [x, 0, z]; };
	rooms.forEach((b, ri) => {
		const f = b.fy, last = ri === rooms.length - 1;
		if (b.kind === 'tomb') {
			for (let i = 0; i < 4; i++) {
				const lx = (i % 2 ? 1 : -1) * b.hw * 0.45, lz = (Math.floor(i / 2) - 0.5) * b.hd * 0.9;
				place(b, lx, lz);
				sarcophagus(k, f, st, rnd);
				solidAt(col, b, lx, lz, -0.55, 0.55, -1.2, 1.2, f, f + 1.1);
			}
			place(b, 0, -b.hd + 0.8);
			k.box(-0.8, f, -0.4, 0.8, f + 1.0, 0.4, M.ASHLAR, shade(st.stone, 0.6));
			for (const x of [-0.5, 0.5]) candle(lctx, k, x, f + 1.0, 0);
			solidAt(col, b, 0, -b.hd + 0.8, -0.8, 0.8, -0.4, 0.4, f, f + 1);
		} else if (b.kind === 'ossuary') {
			// niches down the long walls, each with an urn
			for (const s of [-1, 1]) for (let lz = -b.hd + 1.4; lz < b.hd - 0.8; lz += 1.6) {
				place(b, s * (b.hw - 0.01), lz, -s * Math.PI / 2);
				for (const y of [0.4, 1.5]) {
					k.face([[-0.45, f + y, 0.005], [0.45, f + y, 0.005], [0.45, f + y + 0.8, 0.005], [-0.45, f + y + 0.8, 0.005]], [0, 0, 1], M.PLAIN, [0.035, 0.03, 0.028]);
					k.box(-0.55, f + y - 0.1, 0, 0.55, f + y, 0.35, M.ASHLAR, shade(st.stone, 0.55));
					k.lathe([[0.05, f + y], [0.16, f + y + 0.12], [0.14, f + y + 0.34], [0.08, f + y + 0.42], [0.1, f + y + 0.46]], 10, M.PLAIN, [0.5, 0.3, 0.2]);
				}
			}
		} else if (b.kind === 'vault') {
			place(b, 0, 0);
			k.box(-1.2, f, -0.6, 1.2, f + 0.85, 0.6, M.ASHLAR, shade(st.stone, 0.6));
			solidAt(col, b, 0, 0, -1.2, 1.2, -0.6, 0.6, f, f + 0.9);
			for (let i = 0; i < 4; i++) { place(b, (rnd() - 0.5) * b.hw, -b.hd + 1 + rnd() * 1.5); barrelish(k, f, i); }
		} else if (b.kind === 'store') {
			for (const s of [-1, 1]) for (let lz = -b.hd + 1; lz < b.hd - 1; lz += 0.85) {
				place(b, s * (b.hw - 0.55), lz);
				barrelish(k, f, 0);
			}
			for (const s of [-1, 1]) solidAt(col, b, s * (b.hw - 0.55), 0, -0.45, 0.45, -b.hd + 0.5, b.hd - 0.5, f, f + 1);
			for (let i = 0; i < 5; i++) { const lx = (rnd() - 0.5) * b.hw, lz = (rnd() - 0.5) * b.hd; place(b, lx, lz, rnd()); k.box(-0.35, f, -0.35, 0.35, f + 0.7, 0.35, M.PLANK, [0.5, 0.4, 0.27]); solidAt(col, b, lx, lz, -0.4, 0.4, -0.4, 0.4, f, f + 0.7); }
		} else if (b.kind === 'gaol') {
			// cells down one wall behind iron bars
			const s = 1, depth = 2.4;
			place(b, 0, 0);
			for (let lz = -b.hd + 0.3; lz < b.hd - 0.2; lz += 0.2) k.beam([s * (b.hw - depth), f, lz], [s * (b.hw - depth), f + 2.6, lz], 0.05, 0.05, M.IRON, IRONC);
			for (const y of [0.2, 1.3, 2.5]) k.beam([s * (b.hw - depth), f + y, -b.hd + 0.3], [s * (b.hw - depth), f + y, b.hd - 0.2], 0.07, 0.07, M.IRON, IRONC);
			for (let lz = -b.hd + 3; lz < b.hd - 1; lz += 3) k.box(s * (b.hw - depth), f, lz - 0.1, s * b.hw, f + 2.8, lz + 0.1, WALL, wc);
			solidAt(col, b, s * (b.hw - depth) - 0.05, s * b.hw, -b.hd, b.hd, f, f + 3, true);
			for (let lz = -b.hd + 1.5; lz < b.hd - 1; lz += 3) { k.box(s * (b.hw - 0.6), f, lz - 0.8, s * b.hw, f + 0.45, lz + 0.8, M.PLANK, [0.35, 0.26, 0.18]); }
		} else if (b.kind === 'hall') {
			// two rows of pillars; at the far end the vault has come down
			for (const s of [-1, 1]) for (let lz = -b.hd + 3; lz < b.hd - 2; lz += 3.5) {
				const lx = s * b.hw * 0.42;
				place(b, lx, lz);
				pillar(k, f, spring(b) + (b.h - spring(b)) * 0.6, st);
				solidAt(col, b, lx, lz, -0.45, 0.45, -0.45, 0.45, f, f + 4);
			}
			place(b, b.hw * 0.55, b.hd * 0.6);
			rubble(k, f, st, rnd, 2.6);
			solidAt(col, b, b.hw * 0.55, b.hd * 0.6, -1.8, 1.8, -1.8, 1.8, f, f + 1.2);
		} else if (b.kind === 'barrowhall') {
			for (const s of [-1, 1]) for (let lz = -b.hd + 1; lz < b.hd - 0.5; lz += 1.8) {
				place(b, s * (b.hw - 0.25), lz);
				k.box(-0.22, f - 0.2, -0.6, 0.22, f + 2.4 + rnd() * 0.5, 0.6, M.PLAIN, [0.42, 0.41, 0.38]);
			}
			place(b, 0, 0);
			k.box(-0.7, f, -1.3, 0.7, f + 0.7, 1.3, M.PLAIN, [0.45, 0.43, 0.4]);
			k.beam([-0.15, f + 0.73, -0.9], [-0.15, f + 0.73, 0.8], 0.08, 0.02, M.IRON, [0.4, 0.38, 0.34]);
			k.beam([-0.45, f + 0.73, -0.55], [0.15, f + 0.73, -0.55], 0.05, 0.03, M.IRON, [0.4, 0.38, 0.34]);
			k.lathe([[0.32, f + 0.71], [0.35, f + 0.76], [0.1, f + 0.8]], 12, M.IRON, [0.45, 0.36, 0.2]);
			solidAt(col, b, 0, 0, -0.7, 0.7, -1.3, 1.3, f, f + 0.8);
		}
		// the dungeon's chest: in its last room, against the far wall
		if (last) {
			const lz = b.hd - 0.9;
			place(b, 0, lz, Math.PI);
			const cp = inRoom(b, 0, lz);
			props.chest = { x: cp[0], z: cp[1], y: f, yaw: b.yaw + Math.PI };
			solidAt(col, b, 0, lz, -0.7, 0.7, -0.45, 0.45, f, f + 0.8);
		}
		// the dead that do not rest, where they stand
		const nF = D.id === 'barrow' ? (ri === 0 ? 2 : 3) : D.id === 'cellar' ? (b.kind === 'hall' ? 3 : 0) : (b.kind === 'tomb' ? 2 : b.kind === 'vault' ? 1 : 0);
		for (let i = 0; i < nF; i++) {
			const lx = (rnd() - 0.5) * b.hw * 1.2, lz = (rnd() - 0.5) * b.hd * 1.2, [x, z] = inRoom(b, lx, lz);
			foes.push({ x, z, y: f, yaw: b.yaw + rnd() * TAU, dungeon: D.id, room: ri });
		}
	});
	// a portcullis in the cellars, before the last room; the lever in the room before it
	if (D.id === 'cellar' && rooms.length >= 3) {
		const last = rooms[rooms.length - 1], pass = boxes.find((o) => o.kind === 'pass' && inBox(o, (last.x + rooms[rooms.length - 2].x) / 2, (last.z + rooms[rooms.length - 2].z) / 2, 0.5)) || boxes.filter((o) => o.kind === 'pass').pop();
		if (pass) {
			const gk = new Kit();
			gk.at(0, 0, 0, 0);
			for (let x = -pass.hw + 0.1; x <= pass.hw - 0.05; x += 0.22) gk.beam([x, 0, 0], [x, 2.9, 0], 0.06, 0.06, M.IRON, IRONC);
			for (const y of [0.3, 1.2, 2.1, 2.8]) gk.beam([-pass.hw, y, 0], [pass.hw, y, 0], 0.07, 0.07, M.IRON, IRONC);
			for (let x = -pass.hw + 0.1; x <= pass.hw - 0.05; x += 0.22) gk.beam([x, 0.02, 0], [x, -0.12, 0], 0.04, 0.04, M.IRON, IRONC);
			const g = pass;
			const solid = col.solid(g.x, g.z, g.yaw, -g.hw, g.hw, -0.15, 0.15, g.fy, g.fy + 3, 'gate');
			props.gate = { kit: gk, x: g.x, z: g.z, y: g.fy, yaw: g.yaw, solid, open: 0, want: 0 };
			const prev = rooms[rooms.length - 2], lz = -prev.hd * 0.3, [lx2] = [prev.hw - 0.05];
			k.at(...frameAt(prev, lx2, lz), prev.yaw - Math.PI / 2);
			k.box(-0.25, prev.fy + 0.9, 0, 0.25, prev.fy + 1.5, 0.12, M.ASHLAR, shade(st.stone, 0.55));
			const lp = inRoom(prev, lx2 - 0.3, lz);
			props.lever = { x: lp[0], z: lp[1], y: prev.fy + 1.2, yaw: prev.yaw - Math.PI / 2, pulled: false };
		}
	}
	// the breach: the masonry ends ragged, rubble spilt across the floor into the cave
	if (D.breach) {
		const b = D.breach.box, lz = b.hd - 0.6;
		k.at(...frameAt(b, 0, lz), b.yaw);
		const f = floorOf(b, lz);
		for (let i = 0; i < 14; i++) {
			const s = rnd() < 0.5 ? -1 : 1, x = s * (b.hw - 0.3 - rnd() * 0.5), y = f + rnd() * 2.6, z = -rnd() * 1.4;
			chunk(k, x, y, z, 0.2 + rnd() * 0.12, rnd, shade(st.stone, 0.4 + rnd() * 0.15));
		}
		rubble(k, f, st, rnd, 1.6);
		// a torch on the last whole stretch of wall, so the break shows
		const t = k.save();
		k.at(...frameAt(b, -b.hw, lz - 2.5), b.yaw + Math.PI / 2);
		sconce(lctx, k, 0, floorOf(b, lz - 2.5) + 2.0, 0.01, true);
		k.load(t);
	}
	return { D, kit: k, col, flames, lights, foes, props, boxes };
}

function solidAt(col, b, lx, lz, x0, x1, z0, z1, y0, y1, absolute = false) {
	if (absolute) { col.solid(b.x, b.z, b.yaw, Math.min(x0, x1), Math.max(x0, x1), z0, z1, y0, y1); return; }
	col.solid(b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c, b.yaw, x0, x1, z0, z1, y0, y1);
}
function sarcophagus(k, f, st, rnd) {
	const c = shade(st.stone, 0.95 + rnd() * 0.1);
	k.box(-0.5, f, -1.1, 0.5, f + 0.8, 1.1, M.ASHLAR, c);
	k.box(-0.58, f + 0.8, -1.18, 0.58, f + 0.95, 1.18, M.ASHLAR, shade(c, 1.05));
	// a cross cut in relief on the lid
	k.box(-0.06, f + 0.95, -0.8, 0.06, f + 0.99, 0.8, M.ASHLAR, shade(c, 1.1));
	k.box(-0.35, f + 0.95, -0.4, 0.35, f + 0.99, -0.28, M.ASHLAR, shade(c, 1.1));
}
function candle(lctx, k, x, y, z) {
	k.lathe([[0.03, y], [0.03, y + 0.18]].map(([r, yy]) => [r, yy]), 6, M.PLAIN, [0.92, 0.88, 0.76]);
	const p = k.w(x, y + 0.19, z);
	lctx.flames.push({ x: p[0], y: p[1], z: p[2], s: 0.05, always: true });
}
function barrelish(k, f, i) {
	k.lathe([[0.3, f], [0.36, f + 0.45], [0.3, f + 0.9]], 10, M.PLANK, [0.46 + (i % 3) * 0.03, 0.33, 0.21], 0, TAU, true);
	for (const hy of [0.12, 0.78]) k.lathe([[0.32, f + hy - 0.03], [0.32, f + hy + 0.03]], 10, M.IRON, IRONC);
}
function pillar(k, f, h, st) {
	k.box(-0.45, f, -0.45, 0.45, f + 0.3, 0.45, M.ASHLAR, shade(st.stone, 0.6));
	k.lathe([[0.3, f + 0.3], [0.28, f + h - 0.35]], 12, M.ASHLAR, shade(st.stone, 0.55));
	k.box(-0.42, f + h - 0.35, -0.42, 0.42, f + h, 0.42, M.ASHLAR, shade(st.stone, 0.6));
}
// a broken lump of stone: a block with its corners knocked about
function chunk(k, x, y, z, s, rnd, col) {
	const j = () => (rnd() - 0.5) * s * 0.5;
	const c = [[-s, 0, -s * 0.7], [s, 0, -s * 0.7], [s, 0, s * 0.7], [-s, 0, s * 0.7], [-s * 0.8, s * 1.1, -s * 0.6], [s * 0.8, s * 1.1, -s * 0.6], [s * 0.8, s * 1.1, s * 0.6], [-s * 0.8, s * 1.1, s * 0.6]].map(([a, b, d]) => [x + a + j(), y + b + (b ? j() : 0), z + d + j()]);
	for (const [p, q, r2, u, nl] of [[0, 1, 5, 4, [0, 0, -1]], [1, 2, 6, 5, [1, 0, 0]], [2, 3, 7, 6, [0, 0, 1]], [3, 0, 4, 7, [-1, 0, 0]], [4, 5, 6, 7, [0, 1, 0]]]) k.face([c[p], c[q], c[r2], c[u]], nl, M.RUBBLE, col);
}
function rubble(k, f, st, rnd, R) {
	for (let i = 0; i < 30; i++) {
		const a = rnd() * TAU, d = Math.sqrt(rnd()) * R, s = 0.12 + rnd() * 0.3, h = (1 - d / R) * 0.7;
		chunk(k, Math.cos(a) * d, f + h * rnd() - 0.08, Math.sin(a) * d, s, rnd, shade(st.stone, 0.36 + rnd() * 0.2));
	}
}

// ---------- the stair heads on the surface ----------
// crypt and cellars: a stone hood over the top of the stair, an open door, paving round
// the hole in the ground; the barrow: a long grassy mound with a portal of great stones
export function buildStairHead(ctx, D, H) {
	const { k, col, st } = ctx;
	const y0 = D.y0, barrow = D.id === 'barrow';
	k.at(D.x, 0, D.z, D.yaw);
	const len = 6.2;
	if (!barrow) {
		for (const s of [-1, 1]) {
			k.box(s * 1.3 - (s < 0 ? 0.55 : 0), y0 - 3, -1.2, s * 1.3 + (s > 0 ? 0.55 : 0), y0 + 2.7, len, M.ASHLAR, st.stone);
			col.solid(D.x, D.z, D.yaw, s > 0 ? 1.3 : -1.85, s > 0 ? 1.85 : -1.3, -1.2, len, y0 - 0.5, y0 + 3);
		}
		// (the back wall stands on the stair's vault, which is just under the ground here)
		const vb = y0 - (len * 0.55) + 3.1;
		k.box(-1.85, vb, len, 1.85, y0 + 2.7, len + 0.5, M.ASHLAR, st.stone);
		col.solid(D.x, D.z, D.yaw, -1.85, 1.85, len, len + 0.5, vb, y0 + 3);
		const f = k.save();
		k.sub(0, 0, (len - 1.2) / 2 - 0.6);
		k.roof(3.7, len + 1.4, y0 + 2.7, 0.65, M.SHINGLE, st.shingle, { over: 0.25, overZ: 0.1, thick: 0.14, gable: M.ASHLAR, gableCol: st.stone });
		k.load(f);
		// the door frame, and the door swung open
		k.box(-1.35, y0 + 2.2, -1.25, 1.35, y0 + 2.7, -1.15, M.ASHLAR, shade(st.stone, 1.05));
		k.box(-1.25, y0, -1.1, -1.15, y0 + 2.2, 0.0, M.PLANK, [0.4, 0.28, 0.18]);
		for (const hy of [0.4, 1.7]) k.box(-1.15, y0 + hy, -1.08, -1.1, y0 + hy + 0.08, -0.05, M.IRON, IRONC);
		sconce(ctx, k, 1.25, y0 + 1.9, -1.26, false);
	} else {
		// the portal: two uprights and a lintel, kerb stones along the passage, a stone roof
		for (const s of [-1, 1]) k.box(s * 1.3 - 0.35, y0 - 1, -0.4, s * 1.3 + 0.35, y0 + 2.4, 0.4, M.PLAIN, [0.48, 0.47, 0.44]);
		k.box(-2.0, y0 + 2.4, -0.5, 2.0, y0 + 3.0, 0.5, M.PLAIN, [0.46, 0.45, 0.42]);
		for (const s of [-1, 1]) {
			k.box(s * 1.3 - (s < 0 ? 0.5 : 0), y0 - 3, 0.4, s * 1.3 + (s > 0 ? 0.5 : 0), y0 + 2.4, len, M.RUBBLE, st.rubble);
			col.solid(D.x, D.z, D.yaw, s > 0 ? 1.3 : -2.0, s > 0 ? 2.0 : -1.3, -0.4, len, y0 - 0.5, y0 + 4);
		}
		for (let z = 0.4; z < len; z += 1.2) k.box(-1.8, y0 + 2.4, z, 1.8, y0 + 2.8, z + 1.1, M.PLAIN, [0.44, 0.43, 0.4]);
		// the mound over it all
		// (the mound's front rim meets the portal; it rises over the passage behind)
		const RX = 8, RZ = 11, HT = 4.2, cz = RZ - 0.6;
		const moundY = (x, z) => { const lx = (x - D.x) * Math.cos(D.yaw) - (z - D.z) * Math.sin(D.yaw), lz = (x - D.x) * Math.sin(D.yaw) + (z - D.z) * Math.cos(D.yaw) - cz; const q = (lx / RX) ** 2 + (lz / RZ) ** 2; return q >= 1 ? null : H(x, z) + HT * Math.sqrt(1 - q) - 0.3; };
		const n = 20, m = 10, turf = ctx.turf || [0.44, 0.46, 0.27];
		const pt = (i, j) => { const a = i / n * TAU, rr = j / m, lx = Math.sin(a) * RX * rr, lz = Math.cos(a) * RZ * rr + cz; const x = D.x + lx * Math.cos(D.yaw) + lz * Math.sin(D.yaw), z = D.z - lx * Math.sin(D.yaw) + lz * Math.cos(D.yaw); return [x, H(x, z) + HT * Math.sqrt(Math.max(0, 1 - rr * rr)) - 0.3 + (j === m ? -0.4 : 0), z]; };
		k.at(0, 0, 0, 0);
		for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
			const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
			if (j === 0) k.face([a, c, d], [0, 1, 0], M.PLAIN, turf);
			else k.face([a, b, c, d], [0, 1, 0], M.PLAIN, turf);
		}
		col.mound(D.x + Math.sin(D.yaw) * cz, D.z + Math.cos(D.yaw) * cz, Math.max(RX, RZ), moundY, 'mound');
		k.at(D.x, 0, D.z, D.yaw);
	}
	// paving round the hole in the ground, where the ground itself is not drawn
	const h = D.hole;
	k.at(0, 0, 0, 0);
	const c = Math.cos(D.yaw), s = Math.sin(D.yaw);
	const inStair = (x, z) => { const dx = x - D.x, dz = z - D.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < 1.32 && lz > -1.25; };
	// a grid over the hole's disc, each cell kept if it is off the stair
	const G = 0.5, R2 = h.r + 0.3;
	for (let gx = -R2; gx < R2; gx += G) for (let gz = -R2; gz < R2; gz += G) {
		const cx = h.x + gx + G / 2, cz2 = h.z + gz + G / 2;
		if (Math.hypot(cx - h.x, cz2 - h.z) > R2 || inStair(cx, cz2)) continue;
		const P = (x, z) => [x, H(x, z) + 0.035, z];
		k.face([P(h.x + gx, h.z + gz), P(h.x + gx + G, h.z + gz), P(h.x + gx + G, h.z + gz + G), P(h.x + gx, h.z + gz + G)], [0, 1, 0], barrow ? M.PLAIN : M.FLAG, barrow ? (ctx.turf || [0.44, 0.46, 0.27]) : [0.55, 0.53, 0.48]);
	}
}
