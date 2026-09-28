// Crysis civilization engine: a grown town's industrial edge. Real valley towns keep
// their warehouses, yards and contractors' lots out where the main road leaves town, past
// the last houses; a town grown by civgen.js gets the same before it is handed to the real
// city: a row of warehouses down one side of a through road, each with its driveway, the
// ground under them marked industrial in the town's land-use map (so the edgelands dress
// their back yards, bay/edgeplan.js). Seeded by the town, the same every visit.

import { rng } from './civgen.js';

const LU_IND = 8;

export function industrialEdge(D, heightAt, nearWater = null) {
	if (!D || D.edge) return D;
	D.edge = { warehouses: 0, why: {} };
	const no = (k) => { D.edge.why[k] = (D.edge.why[k] || 0) + 1; return false; };
	const r = rng((D.seed || 1) * 31 + 7);
	const [bx0, bz0, bx1, bz1] = D.bounds, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
	// how far out the houses reach
	let reach = 0;
	for (const b of D.boxes) if (b.kind <= 4) reach = Math.max(reach, Math.hypot(b.x - cx, b.z - cz));
	if (reach < 200) return D;
	// the through roads, as the stretches of them beyond the houses
	const mains = D.roads.filter((q) => q.cls === 'primary' && !q.bridge && q.pts.length >= 6);
	if (!mains.length) return D;
	const inBox = (x, z, m) => x > bx0 + m && z > bz0 + m && x < bx1 - m && z < bz1 - m;
	// what is out past the houses already: road points every 5 m, and buildings
	const pts = [], far = D.boxes.filter((b) => Math.hypot(b.x - cx, b.z - cz) > reach - 250);
	for (const q of D.roads) {
		const p = q.pts;
		for (let i = 0; i + 3 < p.length; i += 2) {
			const L = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), n = Math.max(1, Math.ceil(L / 5));
			for (let k = 0; k <= n; k++) { const x = p[i] + (p[i + 2] - p[i]) * k / n, z = p[i + 1] + (p[i + 3] - p[i + 1]) * k / n; if (Math.hypot(x - cx, z - cz) > reach - 250) pts.push(x, z, (q.w || 6) / 2); }
		}
	}
	// (bucketed by 50 m, to ask quickly)
	const cells = new Map(), bucket = (x, z, hw) => { const k = Math.floor(x / 50) * 65536 + Math.floor(z / 50); let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(x, z, hw); };
	for (let i = 0; i < pts.length; i += 3) bucket(pts[i], pts[i + 1], pts[i + 2]);
	// is the footprint (a rectangle turned by a) clear: flat, dry, off every road, clear of every building
	const clear = (x, z, w, d, a) => {
		const ca = Math.cos(a), sa = Math.sin(a), hs = [];
		for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0]]) {
			const px = x + ca * u * w - sa * v * d, pz = z + sa * u * w + ca * v * d;
			if (!inBox(px, pz, 60)) return no('box');
			const h = heightAt(px, pz);
			if (h < 1.5 || (nearWater && nearWater(px, pz) < 30)) return no('water');
			hs.push(h);
		}
		if (Math.max(...hs) - Math.min(...hs) > 5) return no('slope');
		const inside = (px, pz, m) => { const dx = px - x, dz = pz - z; return Math.abs(dx * ca + dz * sa) < w / 2 + m && Math.abs(-dx * sa + dz * ca) < d / 2 + m; };
		const R = Math.hypot(w, d) / 2 + 12;
		for (let gj = Math.floor((z - R) / 50); gj <= Math.floor((z + R) / 50); gj++) for (let gi = Math.floor((x - R) / 50); gi <= Math.floor((x + R) / 50); gi++) {
			const c = cells.get(gi * 65536 + gj);
			if (c) for (let i = 0; i < c.length; i += 3) if (inside(c[i], c[i + 1], c[i + 2] + 2)) return no('road');
		}
		for (const b of far) if (inside(b.x, b.z, Math.hypot(b.w, b.d) / 2 + 4)) return no('house');
		return true;
	};
	const M = D.map, paint = (x, z, w, d, a) => {
		const ca = Math.cos(a), sa = Math.sin(a), R = Math.hypot(w, d) / 2;
		for (let j = Math.floor((z - R - M.z0) / M.step); j <= Math.floor((z + R - M.z0) / M.step); j++) for (let i = Math.floor((x - R - M.x0) / M.step); i <= Math.floor((x + R - M.x0) / M.step); i++) {
			if (i < 0 || j < 0 || i >= M.w || j >= M.h) continue;
			const dx = M.x0 + (i + 0.5) * M.step - x, dz = M.z0 + (j + 0.5) * M.step - z;
			if (Math.abs(dx * ca + dz * sa) <= w / 2 && Math.abs(-dx * sa + dz * ca) <= d / 2) M.px[(j * M.w + i) * 4 + 1] = LU_IND * 16;
		}
	};
	// one or two of the through roads, one side of each
	const outer = (q) => { let m = 0; for (let i = 0; i < q.pts.length; i += 2) m = Math.max(m, Math.hypot(q.pts[i] - cx, q.pts[i + 1] - cz)); return m; };
	const picks = mains.filter((q) => outer(q) > reach * 0.75).sort(() => r() - 0.5);
	const want = 4 + Math.floor(r() * 4);
	for (const q of picks) {
		if (D.edge.warehouses >= want) break;
		const p = q.pts;
		let placed = 0, lastS = -1e9, s = 0;
		for (let i = 0; i + 3 < p.length && placed < 6; i += 2) {
			const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz);
			if (L < 1e-3) continue;
			const ux = dx / L, uz = dz / L;
			for (let t = 0; t < L && placed < 6; t += 10) {
				const x = p[i] + ux * t, z = p[i + 1] + uz * t, dc = Math.hypot(x - cx, z - cz);
				if (dc < reach * 0.7 || s + t - lastS < 30) continue;
				const w = 40 + r() * 45, d = 28 + r() * 22, set = (q.w || 12) / 2 + 22 + d / 2, side = r() < 0.5 ? 1 : -1, nx = -uz * side, nz = ux * side;
				const wx = x + ux * w / 2 + nx * set, wz = z + uz * w / 2 + nz * set, a = Math.atan2(uz, ux);
				if (!clear(wx + nx * 6, wz + nz * 6, w + 12, d + 36, a)) continue;
				// the building (its front to the road), its driveway, the yard round it marked industrial
				const b = { x: wx, z: wz, w, d, a, wallH: 7.5 + r() * 4, roofH: 0, kind: 9, hip: 0, door: 0.5 };
				D.boxes.push(b); far.push(b);
				const ex = x + ux * w / 2 + nx * ((q.w || 12) / 2), ez = z + uz * w / 2 + nz * ((q.w || 12) / 2), fx = wx - nx * (d / 2 + 2), fz = wz - nz * (d / 2 + 2);
				D.roads.push({ cls: 'service', w: 6, name: '', pts: new Float32Array([ex, ez, fx, fz]), end0: false, end1: false, bridge: false, link: false, divided: false });
				for (let k = 0; k <= 6; k++) bucket(ex + (fx - ex) * k / 6, ez + (fz - ez) * k / 6, 3);
				paint(wx + nx * 6, wz + nz * 6, w + 24, d + 46, a);
				placed++; lastS = s + t + w;
				D.edge.warehouses++;
			}
			s += L;
		}
	}
	return D;
}
