// Inside the realm's houses (planet/medieval/): the ground floor of each cottage, the inn
// and the smith's house, built from the realm's own kit as you come near and let go as you
// leave. The houses stand hollow with their doorways open (build.js buildHouse); here the
// inside faces of their walls, the floorboards and the joists, the glass of the windows
// seen from within, and what the place is for:
//   the inn     - the bar across the back with its casks, long tables and benches, tankards
//   a cottage   - a box bed under a blanket, the table and stools, a chest, a dresser of
//                 crocks, a spinning wheel by the window
//   the smithy  - the smith's cot, his table, a rack of tongs and hammers, iron stock
// and the plank door on its strap hinges, swinging open as you come to it.

import * as THREE from 'three';
import { Kit, M } from '../planet/medieval/kit.js';

const WOOD = [0.42, 0.3, 0.2], DARK = [0.25, 0.18, 0.12], PLASTER = [0.86, 0.82, 0.72], IRON = [0.16, 0.16, 0.17];

export function createMedievalInteriors({ group, mat, col, houses, isPhone = false }) {
	const BUILD_R = isPhone ? 30 : 42, DROP_R = BUILD_R + 20, MAX = isPhone ? 3 : 5;
	const list = houses.filter((b) => b.inside);
	const live = new Map();
	const stats = { built: 0, maxMs: 0 };

	function build(b) {
		const t0 = performance.now(), I = b.inside, k = new Kit(), { w, d, y0 } = I, hw = w / 2 - 0.02, hd = d / 2 - 0.02, H = Math.min(2.6, I.h - 0.1);
		const r = ((s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; })(Math.floor(Math.abs(I.x * 13.1 + I.z * 7.7)) % 2147483646 + 1);
		k.at(I.x, 0, I.z, I.yaw);
		const solids = [];
		const solid = (x0, x1, z0, z1, h) => solids.push(col.solid(I.x, I.z, I.yaw, x0, x1, z0, z1, y0 - 0.2, y0 + h));
		// the floorboards, the walls' inside faces, the ceiling on its joists
		k.face([[-hw, y0 + 0.005, -hd], [hw, y0 + 0.005, -hd], [hw, y0 + 0.005, hd], [-hw, y0 + 0.005, hd]], [0, 1, 0], M.PLANK, [0.5, 0.38, 0.26]);
		const dl = I.door.x - I.door.w / 2, dr = I.door.x + I.door.w / 2;
		for (const [a0, a1, b0, b1] of [[-hw, dl, y0, y0 + H], [dr, hw, y0, y0 + H], [dl, dr, y0 + 2.05, y0 + H]]) k.face([[a0, b0, hd], [a0, b1, hd], [a1, b1, hd], [a1, b0, hd]], [0, 0, -1], M.PLASTER, PLASTER);
		for (const x of [dl, dr]) k.face([[x, y0, hd], [x, y0 + 2.05, hd], [x, y0 + 2.05, d / 2 + 0.02], [x, y0, d / 2 + 0.02]], [x === dl ? 1 : -1, 0, 0], M.TIMBER, DARK);
		k.face([[-hw, y0, -hd], [hw, y0, -hd], [hw, y0 + H, -hd], [-hw, y0 + H, -hd]], [0, 0, 1], M.PLASTER, PLASTER);
		k.face([[-hw, y0, -hd], [-hw, y0, hd], [-hw, y0 + H, hd], [-hw, y0 + H, -hd]], [1, 0, 0], M.PLASTER, PLASTER);
		k.face([[hw, y0, -hd], [hw, y0, hd], [hw, y0 + H, hd], [hw, y0 + H, -hd]], [-1, 0, 0], M.PLASTER, PLASTER);
		k.face([[-hw, y0 + H, -hd], [hw, y0 + H, -hd], [hw, y0 + H, hd], [-hw, y0 + H, hd]], [0, -1, 0], M.PLANK, [0.4, 0.3, 0.2]);
		for (let x = -hw + 0.4; x < hw; x += 0.8) k.beam([x, y0 + H - 0.1, -hd], [x, y0 + H - 0.1, hd], 0.12, 0.18, M.TIMBER, DARK);
		// the windows' glass, seen from inside (lit from outside by day, the lamps' by night)
		const nb = I.nb, bw = w / nb, sb = Math.max(2, Math.round(d / 1.5)), sbw = d / sb, wy = y0 + 0.95, wh = Math.min(0.85, I.h - 1.3), ww = Math.min(0.8, bw - 0.45);
		const pane = (x, z, nx, nz, W2) => { const ax = nz !== 0 ? 1 : 0, az = nx !== 0 ? 1 : 0; k.face([[x - ax * W2, wy, z - az * W2], [x + ax * W2, wy, z + az * W2], [x + ax * W2, wy + wh, z + az * W2], [x - ax * W2, wy + wh, z - az * W2]], [nx, 0, nz], M.GLASS, [1, 1, 1]); };
		for (const i of I.frontWin) pane(-w / 2 + (i + 0.5) * bw, hd - 0.02, 0, -1, ww / 2);
		pane(w / 2 - 1.5 * bw, -hd + 0.02, 0, 1, ww / 2);
		pane(hw - 0.02, d / 2 - (Math.floor(sb / 2) + 0.5) * sbw, -1, 0, Math.min(0.8, sbw - 0.45) / 2);
		// the hearth on the left wall (its fire is the house's own: build.js)
		const hz = hearthZ(I);
		k.box(-hw, y0, hz - 0.8, -hw + 0.7, y0 + 0.25, hz + 0.8, M.RUBBLE, [0.5, 0.47, 0.42]);
		k.box(-hw, y0 + 0.25, hz - 0.8, -hw + 0.55, y0 + 1.1, hz - 0.55, M.RUBBLE, [0.5, 0.47, 0.42]);
		k.box(-hw, y0 + 0.25, hz + 0.55, -hw + 0.55, y0 + 1.1, hz + 0.8, M.RUBBLE, [0.5, 0.47, 0.42]);
		k.box(-hw, y0 + 1.1, hz - 0.85, -hw + 0.6, y0 + H, hz + 0.85, M.RUBBLE, [0.5, 0.47, 0.42]);
		k.box(-hw + 0.02, y0 + 0.26, hz - 0.5, -hw + 0.4, y0 + 1.05, hz + 0.5, M.PLAIN, [0.05, 0.04, 0.03]);
		k.beam([-hw + 0.15, y0 + 0.95, hz], [-hw + 0.5, y0 + 0.95, hz], 0.03, 0.03, M.IRON, IRON);
		k.lathe([[0.18, y0 + 0.4], [0.22, y0 + 0.55], [0.16, y0 + 0.75]], 10, M.IRON, IRON);
		solid(-hw, -hw + 0.7, hz - 0.85, hz + 0.85, 2);
		// what the place is for
		const kind = I.kind, seats = [];
		const table = (x, z, len, across) => {
			const lx = across ? 0.45 : len / 2, lz = across ? len / 2 : 0.45;
			k.box(x - lx, y0 + 0.72, z - lz, x + lx, y0 + 0.78, z + lz, M.PLANK, WOOD);
			for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(x + sx * (lx - 0.1) - 0.05, y0, z + sz * (lz - 0.1) - 0.05, x + sx * (lx - 0.1) + 0.05, y0 + 0.72, z + sz * (lz - 0.1) + 0.05, M.TIMBER, DARK);
			solid(x - lx, x + lx, z - lz, z + lz, 0.8);
			for (let i = 0; i < 3; i++) { const tx = x + (across ? (r() - 0.5) * 0.5 : (r() - 0.5) * (len - 0.4)), tz = z + (across ? (r() - 0.5) * (len - 0.4) : (r() - 0.5) * 0.5); const f = k.save(); k.sub(tx, 0, tz); k.lathe([[0.05, y0 + 0.78], [0.055, y0 + 0.92]], 8, kind === 'inn' ? M.PLANK : M.PLAIN, kind === 'inn' ? [0.5, 0.36, 0.22] : [0.75, 0.68, 0.55], 0, Math.PI * 2, true); k.load(f); }
		};
		const bench = (x, z, len, across) => {
			const lx = across ? 0.16 : len / 2, lz = across ? len / 2 : 0.16;
			k.box(x - lx, y0 + 0.42, z - lz, x + lx, y0 + 0.47, z + lz, M.PLANK, WOOD);
			for (const s of [-1, 1]) k.box(across ? x - 0.14 : x + s * (lx - 0.12) - 0.04, y0, across ? z + s * (lz - 0.12) - 0.04 : z - 0.14, across ? x + 0.14 : x + s * (lx - 0.12) + 0.04, y0 + 0.42, across ? z + s * (lz - 0.12) + 0.04 : z + 0.14, M.PLANK, DARK);
			for (let u = -len / 2 + 0.4; u < len / 2 - 0.2; u += 0.65) seats.push(across ? [x, z + u, x < 0 ? 1 : -1, 0] : [x + u, z, 0, z < 0 ? 1 : -1]);
		};
		const barrel = (x, z, s = 1) => { const f = k.save(); k.sub(x, 0, z); k.lathe([[0.3 * s, y0], [0.36 * s, y0 + 0.45 * s], [0.3 * s, y0 + 0.9 * s]], 12, M.PLANK, [0.46, 0.33, 0.2], 0, Math.PI * 2, true); for (const hy of [0.15, 0.75]) k.lathe([[0.33 * s, y0 + hy * s], [0.335 * s, y0 + (hy + 0.05) * s]], 12, M.IRON, IRON); k.load(f); solid(x - 0.36 * s, x + 0.36 * s, z - 0.36 * s, z + 0.36 * s, 0.9 * s); };
		if (kind === 'inn') {
			// the bar across the back, casks behind it on their racks, the tables down the room
			const bz = -hd + 1.4;
			k.box(-hw + 1.2, y0, bz - 0.3, hw - 0.4, y0 + 1.05, bz + 0.3, M.PLANK, WOOD);
			k.box(-hw + 1.1, y0 + 1.05, bz - 0.35, hw - 0.3, y0 + 1.12, bz + 0.35, M.PLANK, DARK);
			solid(-hw + 1.2, hw - 0.4, bz - 0.3, bz + 0.3, 1.1);
			for (let x = -hw + 1.6; x < hw - 0.6; x += 0.9) barrel(x, -hd + 0.45, 0.85);
			for (let x = -hw + 1.5; x < hw - 0.6; x += 0.7) { const f = k.save(); k.sub(x, 0, bz); k.lathe([[0.05, y0 + 1.12], [0.055, y0 + 1.26]], 8, M.PLANK, [0.5, 0.36, 0.22], 0, Math.PI * 2, true); k.load(f); }
			for (let x = -hw + 1.6; x < hw - 0.6; x += 0.8) seats.push([x, bz - 0.55, 0, 1, 'stand']);
			for (let x = -hw + 1.9; x < hw - 1.2; x += 2.4) for (let z = bz + 2.0; z < hd - 1.2; z += 2.2) { table(x, z, 1.7, true); bench(x - 0.65, z, 1.6, true); bench(x + 0.65, z, 1.6, true); }
		} else if (kind === 'smithy') {
			k.box(hw - 0.9, y0, -hd + 0.1, hw - 0.1, y0 + 0.45, -hd + 2.0, M.PLANK, WOOD); k.box(hw - 0.85, y0 + 0.45, -hd + 0.15, hw - 0.15, y0 + 0.6, -hd + 1.95, M.STRAW, [0.7, 0.6, 0.35]);
			solid(hw - 0.9, hw - 0.1, -hd + 0.1, -hd + 2.0, 0.6);
			table(0.2, -0.2, 1.3, false); bench(0.2, 0.45, 1.2, false);
			for (let i = 0; i < 5; i++) k.beam([-0.8 + i * 0.3, y0 + 1.1, -hd + 0.05], [-0.8 + i * 0.3, y0 + 1.7, -hd + 0.05], 0.04, 0.04, M.IRON, IRON);
			k.beam([-1.0, y0 + 1.72, -hd + 0.06], [0.6, y0 + 1.72, -hd + 0.06], 0.06, 0.06, M.TIMBER, DARK);
			for (let i = 0; i < 6; i++) k.beam([hw - 1.6 + i * 0.1, y0, hd - 0.4], [hw - 1.6 + i * 0.1 + 0.05, y0 + 1.6, hd - 0.35], 0.04, 0.04, M.IRON, IRON);
		} else {
			// a box bed in the far corner, the table and stools, a chest at its foot, a dresser
			const bx = hw - 0.55, bz = -hd + 1.1;
			k.box(bx - 0.5, y0, bz - 1.05, bx + 0.5, y0 + 0.5, bz + 1.05, M.PLANK, WOOD);
			k.box(bx - 0.46, y0 + 0.5, bz - 1.0, bx + 0.46, y0 + 0.66, bz + 1.0, M.CLOTH, [0.55 + r() * 0.3, 0.3 + r() * 0.3, 0.25 + r() * 0.2]);
			k.box(bx - 0.44, y0 + 0.66, bz - 0.95, bx + 0.44, y0 + 0.74, bz - 0.6, M.CLOTH, [0.85, 0.82, 0.74]);
			k.box(bx - 0.5, y0, bz - 1.1, bx + 0.5, y0 + 1.1, bz - 1.02, M.PLANK, DARK);
			solid(bx - 0.5, bx + 0.5, bz - 1.1, bz + 1.1, 0.75);
			seats.push([bx - 0.3, bz + 0.3, -1, 0]);
			k.box(bx - 0.4, y0, bz + 1.2, bx + 0.4, y0 + 0.5, bz + 1.65, M.PLANK, [0.35, 0.24, 0.15]); solid(bx - 0.4, bx + 0.4, bz + 1.2, bz + 1.65, 0.5);
			table(0.1, 0.3, 1.3, false);
			for (const [sx, sz] of [[-0.3, -0.35], [0.5, -0.35], [0.1, 0.95]]) { const f = k.save(); k.sub(0.1 + sx - 0.1, 0, 0.3 + sz); k.lathe([[0.18, y0], [0.16, y0 + 0.45], [0.19, y0 + 0.46]], 8, M.PLANK, WOOD, 0, Math.PI * 2, true); k.load(f); seats.push([sx, 0.3 + sz, 0, sz < 0 ? 1 : -1]); }
			// the dresser of crocks against the back wall
			k.box(-0.6, y0, -hd + 0.02, 0.6, y0 + 0.9, -hd + 0.45, M.PLANK, WOOD);
			for (const sy of [1.3, 1.7]) { k.box(-0.6, y0 + sy, -hd + 0.02, 0.6, y0 + sy + 0.04, -hd + 0.3, M.PLANK, WOOD); for (let x = -0.5; x < 0.55; x += 0.22) { const f = k.save(); k.sub(x, 0, -hd + 0.16); k.lathe([[0.06, y0 + sy + 0.04], [0.08, y0 + sy + 0.12], [0.05, y0 + sy + 0.22]], 8, M.PLAIN, [0.7 + r() * 0.2, 0.5, 0.35]); k.load(f); } }
			solid(-0.6, 0.6, -hd, -hd + 0.45, 1.8);
			if (w > 5 && r() < 0.7) { const f = k.save(); k.sub(hw - 0.6, 0, hd - 1.0); k.lathe([[0.02, y0 + 0.5], [0.4, y0 + 0.5], [0.4, y0 + 0.55], [0.02, y0 + 0.55]], 14, M.PLANK, WOOD); k.load(f); k.beam([hw - 0.6, y0, hd - 1.0], [hw - 0.6, y0 + 0.5, hd - 1.0], 0.06, 0.06, M.PLANK, DARK); }
			barrel(-hw + 0.5, hd - 0.6, 0.7);
		}
		const mesh = new THREE.Mesh(k.build(), mat);
		mesh.receiveShadow = true;
		mesh.matrixAutoUpdate = false;
		group.add(mesh);
		// the door, hung on its hinge at the doorway's left
		const dk = new Kit();
		dk.box(0, 0, -0.06, I.door.w - 0.02, 2.02, 0, M.PLANK, [0.46, 0.34, 0.22]);
		for (const hy of [0.4, 1.6]) dk.box(0, hy, 0, I.door.w * 0.6, hy + 0.06, 0.01, M.IRON, IRON);
		const pivot = new THREE.Group(), leaf = new THREE.Mesh(dk.build(), mat);
		pivot.add(leaf);
		const [px, , pz] = k.w(dl + 0.01, 0, d / 2 - 0.02);
		pivot.position.set(px, y0, pz);
		pivot.rotation.y = I.yaw;
		group.add(pivot);
		const doorSolid = col.solid(I.x, I.z, I.yaw, dl, dr, d / 2 - 0.3, d / 2 + 0.05, y0 - 0.2, y0 + 2.05);
		const ms = performance.now() - t0;
		stats.built++; stats.maxMs = Math.max(stats.maxMs, ms);
		return { b, mesh, pivot, solids: [...solids, doorSolid], doorSolid, open: 0, seats, ms, at: k.w(I.door.x, y0, d / 2) };
	}
	function drop(H) {
		group.remove(H.mesh); group.remove(H.pivot);
		H.mesh.geometry.dispose(); H.pivot.children[0].geometry.dispose();
		for (const s of H.solids) s.off = true;
	}
	let t = 0;
	function update(dt, cam) {
		t -= dt;
		if (t < 0) {
			t = 0.5;
			const near = list.map((b) => [Math.hypot(b.inside.x - cam.x, b.inside.z - cam.z), b]).filter((q) => q[0] < BUILD_R).sort((a, b) => a[0] - b[0]).slice(0, MAX);
			for (const [b, H] of live) if (Math.hypot(b.inside.x - cam.x, b.inside.z - cam.z) > DROP_R || (live.size > MAX && !near.some((q) => q[1] === b))) { drop(H); live.delete(b); }
			// one a beat (each is a few milliseconds)
			for (const [, b] of near) if (!live.has(b)) { live.set(b, build(b)); break; }
		}
		// the doors open as you come to them
		for (const H of live.values()) {
			const d = Math.hypot(H.at[0] - cam.x, H.at[2] - cam.z), want = d < 2.4 && Math.abs(cam.y - 1.7 - H.b.inside.y0) < 1.8 ? 1 : 0;
			H.open += Math.sign(want - H.open) * Math.min(Math.abs(want - H.open), dt * 1.8);
			H.pivot.rotation.y = H.b.inside.yaw + H.open * Math.PI * 0.5;
			H.doorSolid.off = H.open > 0.35;
		}
	}
	// the one you are in
	function inside(p) {
		for (const H of live.values()) {
			const I = H.b.inside, dx = p.x - I.x, dz = p.z - I.z, c = Math.cos(I.yaw), s = Math.sin(I.yaw), lx = dx * c - dz * s, lz = dx * s + dz * c;
			if (Math.abs(lx) < I.w / 2 && Math.abs(lz) < I.d / 2 && Math.abs(p.y - 1.7 - I.y0) < 1.5) return H;
		}
		return null;
	}
	return { update, inside, info: () => ({ live: live.size, houses: list.length, ...stats }), live };
}
// where the hearth stands along the left wall (the same in build.js, for its fire)
export const hearthZ = (I) => Math.max(-I.d / 2 + 1.2, Math.min(I.d / 2 - 1.6, -I.d * 0.15));
