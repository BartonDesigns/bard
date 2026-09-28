// What of the realm is walked on and walked into. Solids are boxes in plan (turned by a
// yaw) or circles, each over a span of heights; slabs are surfaces to stand on (floors,
// stairs, wall walks, bridge decks), flat or rising along their own z. Both are kept in a
// coarse grid so a lookup only sees what is near.

const CELL = 16;

export function createCollide() {
	const grid = new Map();
	const key = (i, j) => i * 73856093 ^ j * 19349663;
	const put = (o, rad) => {
		for (let i = Math.floor((o.x - rad) / CELL); i <= Math.floor((o.x + rad) / CELL); i++) for (let j = Math.floor((o.z - rad) / CELL); j <= Math.floor((o.z + rad) / CELL); j++) {
			const k = key(i, j);
			let a = grid.get(k);
			if (!a) grid.set(k, a = []);
			a.push(o);
		}
	};
	const near = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || EMPTY;
	const frame = (x, z, yaw) => ({ x, z, c: Math.cos(yaw), s: Math.sin(yaw) });
	const local = (o, x, z) => { const dx = x - o.x, dz = z - o.z; return [dx * o.c - dz * o.s, dx * o.s + dz * o.c]; };
	const api = {
		// a box: its frame (centre x, z and yaw), its extent in that frame, heights y0..y1
		solid(x, z, yaw, x0, x1, z0, z1, y0, y1, tag) {
			const o = { ...frame(x, z, yaw), x0, x1, z0, z1, y0, y1, box: true, tag };
			put(o, Math.hypot(Math.max(-x0, x1), Math.max(-z0, z1)) + 1);
			return o;
		},
		round(x, z, r, y0, y1, tag) { const o = { x, z, r, y0, y1, tag }; put(o, r + 1); return o; },
		// a slab: top at y at its z0 edge, rising by `slope` per metre toward z1
		slab(x, z, yaw, x0, x1, z0, z1, y, slope = 0, tag) {
			const o = { ...frame(x, z, yaw), x0, x1, z0, z1, y, slope, slab: true, tag };
			put(o, Math.hypot(Math.max(-x0, x1), Math.max(-z0, z1)) + 1);
			return o;
		},
		// a round top (a mound): height fn(x, z) over a circle
		mound(x, z, r, fn, tag) { const o = { x, z, r, fn, slab: true, tag }; put(o, r + 1); return o; },
		// the highest surface under (x, z) that a foot at y can be on (steps of up to 0.7 m)
		floor(x, z, y) {
			let g = -1e9;
			for (const o of near(x, z)) {
				if (!o.slab || o.off) continue;
				let top;
				if (o.fn) { if (Math.hypot(x - o.x, z - o.z) > o.r) continue; top = o.fn(x, z); if (top == null) continue; }
				else {
					const [lx, lz] = local(o, x, z);
					if (lx < o.x0 || lx > o.x1 || lz < o.z0 || lz > o.z1) continue;
					top = o.y + (lz - o.z0) * o.slope;
				}
				if (top <= y + 0.7 && top > g) g = top;
			}
			return g;
		},
		// keep a body (radius R) at p, feet at footY, out of the solids
		push(p, footY, R = 0.35) {
			for (const o of near(p.x, p.z)) {
				if (o.slab || o.off || footY > o.y1 - 0.4 || footY + 1.7 < o.y0) continue;
				if (!o.box) {
					const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + R;
					if (d < m && d > 1e-4) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; }
					continue;
				}
				const [lx, lz] = local(o, p.x, p.z);
				if (lx < o.x0 - R || lx > o.x1 + R || lz < o.z0 - R || lz > o.z1 + R) continue;
				// out through the nearest side
				const pen = [lx - (o.x0 - R), (o.x1 + R) - lx, lz - (o.z0 - R), (o.z1 + R) - lz];
				let k = 0;
				for (let i = 1; i < 4; i++) if (pen[i] < pen[k]) k = i;
				let nx = lx, nz = lz;
				if (k === 0) nx = o.x0 - R; else if (k === 1) nx = o.x1 + R; else if (k === 2) nz = o.z0 - R; else nz = o.z1 + R;
				p.x = o.x + nx * o.c + nz * o.s; p.z = o.z - nx * o.s + nz * o.c;
			}
		},
		// is (x, y, z) inside something solid (for placing things)
		blocked(x, z, y = null) {
			for (const o of near(x, z)) {
				if (o.slab) continue;
				if (y != null && (y > o.y1 || y < o.y0)) continue;
				if (!o.box) { if (Math.hypot(x - o.x, z - o.z) < o.r) return true; continue; }
				const [lx, lz] = local(o, x, z);
				if (lx > o.x0 && lx < o.x1 && lz > o.z0 && lz < o.z1) return true;
			}
			return false;
		},
		tagged(tag) { const out = new Set(); for (const a of grid.values()) for (const o of a) if (o.tag === tag) out.add(o); return [...out]; },
	};
	return api;
}
const EMPTY = [];
