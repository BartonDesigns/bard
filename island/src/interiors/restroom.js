// A park's or a beach's restroom you can walk into. The little block is hollow: the doorways
// in its front stand open (each door swung back against the inside of the wall), and inside
// each room are its stalls along the back wall, each with its toilet, the basins on a counter
// under a mirror, a hand dryer and the light. A small one is a single room: the toilet in the
// back corner, the basin beside the door. In the building's own frame (x across, the front at
// +d/2, y up from the floor); the caller places it and draws it in its own materials, by role:
// wall, tile (the inside, the ceiling), floor, fixture (the porcelain), steel, mirror, door.
// Also the boxes that are solid, and walkIns(), which keeps a module's restrooms walkable.

import * as THREE from 'three';

const T = 0.2;   // the block wall

export function restroomParts(w, d, h = 2.7, rooms = 2) {
	const parts = { wall: [], tile: [], floor: [], fixture: [], steel: [], mirror: [], door: [] }, solids = [];
	const box = (k, x0, y0, z0, x1, y1, z1, solid = false) => { parts[k].push(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); if (solid) solids.push([x0, z0, x1, z1, y0, y1]); };
	const hw = w / 2, hd = d / 2, zi = hd - T, DW = 0.9;
	// the slab, the ceiling, the back and side walls (tiled within)
	box('floor', -hw, -0.06, -hd, hw, 0.004, hd);
	box('tile', -hw + T, h - 0.03, -hd + T, hw - T, h, zi);
	box('wall', -hw, 0, -hd, hw, h, -hd + T, true);
	box('wall', -hw, 0, -hd + T, -hw + T, h, zi, true);
	box('wall', hw - T, 0, -hd + T, hw, h, zi, true);
	box('tile', -hw + T, 0, -hd + T, hw - T, 1.4, -hd + T + 0.01);
	// the rooms side by side, a door to each near its outer end
	const n = Math.max(1, rooms), rw = (w - 2 * T - (n - 1) * 0.15) / n, doors = [];
	for (let k = 0; k < n; k++) {
		const x0 = -hw + T + k * (rw + 0.15), x1 = x0 + rw, left = k < n / 2;
		const dc = n === 1 ? x0 + Math.min(rw / 2, 0.7) : left ? x0 + 0.7 : x1 - 0.7;
		doors.push([dc - DW / 2, dc + DW / 2]);
		if (k < n - 1) box('wall', x1, 0, -hd + T, x1 + 0.15, h, zi, true);
		// the door, swung back against the wall on its hinge side
		const hx = left || n === 1 ? dc - DW / 2 : dc + DW / 2, s = left || n === 1 ? 1 : -1;
		box('door', Math.min(hx, hx + s * 0.04), 0.02, zi - DW + 0.05, Math.max(hx, hx + s * 0.04), 2.05, zi - 0.03);
		// along the back: the stalls (or the one toilet)
		const stalls = n === 1 ? 1 : Math.max(1, Math.min(3, Math.floor((rw - 0.2) / 0.95))), sw = n === 1 ? rw : (rw - 0.1) / stalls, sd = 1.55;
		for (let i = 0; i < stalls; i++) {
			const a = x0 + i * sw, c = a + sw / 2, zb = -hd + T;
			// the toilet: its tank against the wall, the bowl before it
			const tx = n === 1 ? x1 - 0.45 : c;
			box('fixture', tx - 0.22, 0.4, zb, tx + 0.22, 0.78, zb + 0.2, true);
			box('fixture', tx - 0.19, 0, zb + 0.2, tx + 0.19, 0.42, zb + 0.68, true);
			box('steel', tx + 0.3, 0.7, zb + 0.02, tx + 0.42, 0.8, zb + 0.14);
			if (n === 1) continue;
			// the steel partitions between the stalls, and their fronts with the doors open
			if (i > 0) box('steel', a - 0.015, 0.3, zb, a + 0.015, 1.95, zb + sd, true);
			box('steel', a + 0.03, 0.3, zb + sd - 0.03, a + 0.18, 1.95, zb + sd, true);
			box('steel', a + sw - 0.18, 0.3, zb + sd - 0.03, a + sw - 0.03, 1.95, zb + sd, true);
			box('steel', a + sw - 0.2, 0.3, zb + sd - 0.62, a + sw - 0.17, 1.95, zb + sd - 0.04);
		}
		// the basins on a counter along the side wall away from the door, the mirror over it
		const far = n === 1 ? x0 : left ? x1 : x0, sgn = far === x0 ? 1 : -1, cz0 = n === 1 ? zi - 1.3 : -hd + T + 1.75, cz1 = n === 1 ? zi - 0.2 : Math.min(zi - 0.25, cz0 + 1.7);
		if (cz1 - cz0 > 0.5) {
			const f0 = far, f1 = far + sgn * 0.5;
			box('fixture', Math.min(f0, f1), 0.78, cz0, Math.max(f0, f1), 0.86, cz1, true);
			box('steel', Math.min(f0, f1) + 0.05, 0, cz0 + 0.05, Math.max(f0, f1) - 0.05, 0.78, cz0 + 0.1);
			for (let z = cz0 + 0.4; z < cz1 - 0.2; z += 0.75) box('steel', far + sgn * 0.08 - 0.03, 0.86, z - 0.02, far + sgn * 0.08 + 0.03, 1.08, z + 0.02);
			box('mirror', Math.min(far, far + sgn * 0.02), 1.15, cz0 + 0.1, Math.max(far, far + sgn * 0.02), 1.9, cz1 - 0.1);
			box('steel', Math.min(far, far + sgn * 0.12), 1.0, cz1 + 0.05, Math.max(far, far + sgn * 0.12), 1.3, cz1 + 0.3);
		}
		box('tile', (x0 + x1) / 2 - 0.3, h - 0.05, -0.3, (x0 + x1) / 2 + 0.3, h - 0.03, 0.3);
	}
	// the front, with its doorways
	const cuts = [-hw, ...doors.flat(), hw];
	for (let i = 0; i < cuts.length - 1; i += 2) box('wall', cuts[i], 0, zi, cuts[i + 1], h, hd, true);
	for (const [a, b] of doors) box('wall', a, 2.1, zi, b, h, hd);
	return { parts, solids, doors };
}

// a module's restrooms, walkable: add(F, solids, w, d) with F their placing (a Matrix4: their
// frame to the world); push(p, footY) keeps you off their walls and fittings, floor(x, z, y)
// carries you over their slab; drop(tag) lets go of those added under a tag
export function walkIns() {
	const list = [];
	const local = (R, x, z) => { const dx = x - R.x, dz = z - R.z; return [R.ca * dx - R.sa * dz, R.sa * dx + R.ca * dz]; };
	function add(F, solids, w, d, tag) {
		const e = F.elements, yaw = Math.atan2(e[8], e[0]);
		list.push({ x: e[12], y: e[13], z: e[14], ca: Math.cos(yaw), sa: Math.sin(yaw), solids, hw: w / 2, hd: d / 2, tag });
	}
	function push(p, footY) {
		for (const R of list) {
			if (Math.abs(p.x - R.x) > R.hw + R.hd + 1 || Math.abs(p.z - R.z) > R.hw + R.hd + 1) continue;
			let [lx, lz] = local(R, p.x, p.z);
			const y0 = footY - R.y + 0.25, y1 = footY - R.y + 1.7;
			let moved = false;
			for (const b of R.solids) {
				if (y1 < b[4] || y0 > b[5]) continue;
				const qx = Math.max(b[0], Math.min(b[2], lx)), qz = Math.max(b[1], Math.min(b[3], lz)), dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
				if (d2 >= 0.09) continue;
				if (d2 < 1e-8) { const pen = [lx - b[0], b[2] - lx, lz - b[1], b[3] - lz], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) lx = b[0] - 0.3; else if (k === 1) lx = b[2] + 0.3; else if (k === 2) lz = b[1] - 0.3; else lz = b[3] + 0.3; } else { const d = Math.sqrt(d2); lx = qx + dx / d * 0.3; lz = qz + dz / d * 0.3; }
				moved = true;
			}
			if (moved) { p.x = R.x + R.ca * lx + R.sa * lz; p.z = R.z - R.sa * lx + R.ca * lz; }
		}
	}
	function floor(x, z, y) {
		let best = -1e9;
		for (const R of list) {
			if (Math.abs(x - R.x) > R.hw + R.hd + 1 || Math.abs(z - R.z) > R.hw + R.hd + 1) continue;
			const [lx, lz] = local(R, x, z);
			if (Math.abs(lx) < R.hw && Math.abs(lz) < R.hd && y > R.y - 0.6) best = Math.max(best, R.y);
		}
		return best;
	}
	const drop = (tag) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].tag === tag) list.splice(i, 1); };
	return { add, push, floor, drop };
}
