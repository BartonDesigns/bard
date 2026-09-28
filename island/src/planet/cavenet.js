// The shape of a planet's underground. Under the high ground there are chambers:
// one great cavern where people still live, one that holds the ruins of whoever lived
// here before, and a few smaller halls. Winding tunnels join them, and a few of those
// climb to open on the hillsides as cave mouths. Everything is one field of rock: a
// number at every point in space, negative in the open air of the caves, positive in
// the rock. The walls are drawn where it crosses zero, and the floors walked on are
// found in it, so what you see and what you stand on are the same thing.
//
// Plain JavaScript: no drawing here (underworld.js meshes it).

import { mulberry32, smoothstep, clamp } from '../noise.js';

// ---------- 3D value noise (fast, seeded) ----------
export function makeNoise3(seed) {
	const r = mulberry32(seed ^ 0x3d3d3d);
	const perm = new Uint8Array(512), val = new Float32Array(256);
	for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = r() * 2 - 1; }
	for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
	for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
	return function n3(x, y, z) {
		const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
		let u = x - xi, v = y - yi, w = z - zi;
		u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
		const X = xi & 255, Y = yi & 255, Z = zi & 255;
		const a = perm[X] + Y, aa = perm[a] + Z, ab = perm[a + 1] + Z, b = perm[X + 1] + Y, ba = perm[b] + Z, bb = perm[b + 1] + Z;
		const x1 = val[perm[aa]] + (val[perm[ba]] - val[perm[aa]]) * u, x2 = val[perm[ab]] + (val[perm[bb]] - val[perm[ab]]) * u;
		const x3 = val[perm[aa + 1]] + (val[perm[ba + 1]] - val[perm[aa + 1]]) * u, x4 = val[perm[ab + 1]] + (val[perm[bb + 1]] - val[perm[ab + 1]]) * u;
		const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
		return y1 + (y2 - y1) * w;
	};
}

const GRID = 16;     // metres per cell of the lookup grid

// ---------- planning ----------
// island: from islandgen; profile: planet/profile.js. Returns the network and its field.
export function planCaves(island, profile) {
	const r = mulberry32((island.seed >>> 0) ^ 0xca7e5eed);
	const H = island.heightAt, coast = island.coastAt || (() => 999);
	const R = island.R, vill = island.village;
	const n3 = makeNoise3(island.seed + 911);

	// the least height of the ground over a round footprint (the rock above a chamber)
	const minOver = (x, z, rad) => {
		let m = H(x, z);
		for (const f of [0.3, 0.6, 0.85, 1]) for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283 + f; m = Math.min(m, H(x + Math.cos(a) * rad * f, z + Math.sin(a) * rad * f)); }
		return m;
	};
	const minCoast = (x, z, rad) => { let m = coast(x, z); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; m = Math.min(m, coast(x + Math.cos(a) * rad, z + Math.sin(a) * rad)); } return m; };

	// ---------- chambers ----------
	// candidates on a grid under the island; each remembers the rock over it
	const cands = [];
	for (let x = -R; x <= R; x += 22) for (let z = -R; z <= R; z += 22) {
		if (coast(x, z) < 80) continue;
		cands.push({ x: x + (r() - 0.5) * 12, z: z + (r() - 0.5) * 12 });
	}
	const chambers = [];
	const farFrom = (x, z, d) => chambers.every((c) => Math.hypot(c.x - x, c.z - z) > d + Math.max(c.rx, c.rz));
	// fit a chamber of the given size: floor at least 3 m above the sea, at least cover m of
	// rock over the vault, ideally 25..45 m down; returns null when the ground is too low
	const fit = (c, rx, rz, hWant, hMin, cover) => {
		const rad = Math.max(rx, rz) + 4;
		if (minCoast(c.x, c.z, rad) < 45) return null;
		const hm = minOver(c.x, c.z, rad), hc = H(c.x, c.z);
		let h = Math.min(hWant, hm - cover - 3);
		if (h < hMin) return null;
		const fy = clamp(hc - h - 32 - r() * 12, 3, hm - h - cover);
		return { x: c.x, z: c.z, fy, h, rx, rz, hm, depth: hc - fy };
	};
	const pickChamber = (rx, rz, hWant, hMin, cover, test) => {
		let best = null;
		for (const c of cands) {
			if (!test(c) || !farFrom(c.x, c.z, Math.max(rx, rz) + 22)) continue;
			const f = fit(c, rx, rz, hWant, hMin, cover);
			if (!f) continue;
			// prefer tall rooms well under the ground, a little randomly
			f.score = f.h * 2 + Math.min(40, f.depth) * 0.5 + r() * 8;
			if (!best || f.score > best.score) best = f;
		}
		return best;
	};
	// the village cavern: the biggest room we can fit, away from the village on the shore
	const awayV = (c) => !vill || Math.hypot(c.x - vill.x, c.z - vill.z) > 120;
	let village = null;
	for (const s of [[34, 28], [30, 25], [26, 22], [22, 18]]) {
		village = pickChamber(s[0], s[1], 24, 11, 9, awayV);
		if (village) break;
	}
	if (!village) for (const s of [[22, 18], [18, 15]]) { village = pickChamber(s[0], s[1], 14, 8, 5, () => true); if (village) break; }
	if (!village) return null;
	village.kind = 'village';
	village.rot = r() * Math.PI;
	chambers.push(village);
	// the ruins: a tall hall a walk away, a skylight in its roof
	const near = (c, lo, hi) => { const d = Math.hypot(c.x - village.x, c.z - village.z); return d > lo && d < hi; };
	let ruins = null;
	for (const s of [[24, 20, 24], [20, 17, 20], [17, 14, 16], [14, 12, 12]]) {
		ruins = pickChamber(s[0], s[1], s[2], 9, 7, (c) => near(c, 90, 320) && awayV(c));
		if (ruins) break;
	}
	if (!ruins) for (const s of [[16, 14, 14], [13, 11, 10]]) { ruins = pickChamber(s[0], s[1], s[2], 7, 5, (c) => near(c, 60, 420)); if (ruins) break; }
	if (ruins) { ruins.kind = 'ruins'; ruins.rot = r() * Math.PI; chambers.push(ruins); }
	// a few smaller halls between and beyond
	const extra = 1 + Math.floor(r() * 3);
	for (let i = 0; i < extra; i++) {
		const rx = 9 + r() * 8, rz = rx * (0.7 + r() * 0.3);
		const c = pickChamber(rx, rz, 8 + r() * 8, 6, 5, (q) => near(q, 70, 300));
		if (!c) continue;
		c.kind = 'hall'; c.rot = r() * Math.PI;
		chambers.push(c);
	}

	// ---------- the floor of each chamber ----------
	// gently uneven, rising in rubble slopes to the walls; pools and pits sunk into it
	const cw = profile.caves || {};
	for (const c of chambers) {
		c.cos = Math.cos(c.rot); c.sin = Math.sin(c.rot);
		c.k = Math.min(c.rx, c.rz, c.h * 0.7) * 0.85;
		c.pools = [];
		c.bump = c.kind === 'village' ? 0.12 : c.kind === 'ruins' ? 0.2 : 0.45;
	}
	const addPool = (c, kind, fx, fz, rad, depth) => {
		const lx = fx * c.rx, lz = fz * c.rz;
		// (even a pool's bed stays 2 m above the sea)
		c.pools.push({ x: c.x + lx * c.cos - lz * c.sin, z: c.z + lx * c.sin + lz * c.cos, r: rad, depth: Math.max(0.4, Math.min(depth, c.fy - 2)), kind, y: c.fy - (kind === 'lava' ? 0.35 : 0.08) });
	};
	for (const c of chambers) {
		if (cw.lava > 0 && c.kind !== 'village' && r() < 0.9) addPool(c, 'lava', (r() - 0.5) * 0.6, 0.35 + r() * 0.2, 4 + r() * 3, 2.2);
		if (cw.water > 0 && r() < Math.min(0.85, cw.water * 0.6)) addPool(c, cw.ice > 0.8 ? 'ice' : 'water', (r() - 0.5) * 0.9, -(0.3 + r() * 0.25), (c.kind === 'village' ? 7 : 4) + r() * 4, c.kind === 'village' ? 1.1 : 0.7);
	}
	if (profile.civ?.village === 'stilt' && !village.pools.some((p) => p.kind === 'water')) addPool(village, 'water', 0.3, -0.35, 11, 1.2);
	for (const c of chambers) if (cw.lava > 0 && c.kind === 'village') addPool(c, 'lava', -0.55, 0.5, 3, 2);

	// ---------- the mouths ----------
	// hillsides above the sea, steep enough that a tunnel is soon under cover, away from
	// the shore village; each with a chamber at a walkable distance below
	const mouths = [];
	const want = 2 + (r() < 0.55 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
	// (a low world gets a second, less fussy look: gentler slopes, lower hills)
	for (const relax of [0, 1]) {
		if (mouths.length >= 2) break;
		const ecands = [];
		for (let x = -R; x <= R; x += 14) for (let z = -R; z <= R; z += 14) {
			const px = x + (r() - 0.5) * 10, pz = z + (r() - 0.5) * 10, h = H(px, pz);
			if (h < (relax ? 5 : 9) || h > 190 || coast(px, pz) < (relax ? 28 : 45)) continue;
			if (vill && Math.hypot(px - vill.x, pz - vill.z) < (relax ? 100 : 140)) continue;
			if (chambers.some((c) => Math.hypot(c.x - px, c.z - pz) < Math.max(c.rx, c.rz) + 25)) continue;
			const n = island.normalAt(px, pz);
			if (n.y > (relax ? 0.96 : 0.88) || n.y < (relax ? 0.4 : 0.5)) continue;
			// the path on the ground is not a place for a hole
			if (island.maskAt && island.maskAt(px, pz, 0) > 0.3) continue;
			// ...nor a stream or a lake (planet/waters.js)
			if (island.inWater && [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]].some(([u, v]) => island.inWater(px + u, pz + v))) continue;
			// the chamber this mouth leads down to: reachable on a gentle ramp
			let best = null;
			for (const c of chambers) {
				const d = Math.hypot(c.x - px, c.z - pz), drop = h - c.fy;
				if (d > (relax ? 600 : 420) || drop / Math.max(1, d - c.rx) > 0.32) continue;
				const s = -Math.abs(d - Math.max(90, drop / 0.2)) * 0.05 - Math.abs(n.y - 0.72) * 30 + (c.kind === 'village' ? 4 : 0) + r() * 3;
				if (!best || s > best.s) best = { c, s, d };
			}
			if (best) ecands.push({ x: px, z: pz, y: h, n, to: best.c, s: best.s });
		}
		ecands.sort((a, b) => b.s - a.s);
		for (const e of ecands) {
			if (mouths.length >= want) break;
			if (mouths.some((m) => Math.hypot(m.x - e.x, m.z - e.z) < 160)) continue;
			// every chamber served before any gets a second mouth
			if (mouths.length < chambers.length && mouths.some((m) => m.to === e.to) && ecands.some((o) => o.to !== e.to && !mouths.some((m) => m.to === o.to))) continue;
			mouths.push(e);
		}
	}

	// ---------- tunnels ----------
	const tunnels = [];
	// a floor line from a to b: a wandering walk in plan, a smooth ramp in height kept
	// under the rock (roof at least 2.5 m below the ground) and above the sea
	const route = (a, b, opt) => {
		for (let attempt = 0; attempt < 6; attempt++) {
			const pts = [], step = 3;
			let x = a.x, z = a.z, hd = opt.heading ?? Math.atan2(b.z - a.z, b.x - a.x);
			const wander = r() * 100;
			pts.push({ x, z });
			for (let i = 0; i < 400; i++) {
				const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
				if (d < step * 1.5) break;
				const toB = Math.atan2(dz, dx);
				let dh = toB - hd;
				while (dh > Math.PI) dh -= 2 * Math.PI;
				while (dh < -Math.PI) dh += 2 * Math.PI;
				// hold the first heading into the hill, then turn toward the goal, wandering
				const hold = opt.hold && i * step < opt.hold ? 0.02 : 0.16 + (i * step > d * 0.6 ? 0.1 : 0);
				hd += clamp(dh, -hold, hold) + (n3(i * 0.09 + wander, attempt * 3.1, 0.5) * 0.35) * (opt.hold && i * step < opt.hold ? 0.2 : 1);
				x += Math.cos(hd) * step; z += Math.sin(hd) * step;
				pts.push({ x, z });
			}
			pts.push({ x: b.x, z: b.z });
			const n = pts.length;
			// sizes along the way: throats and bellies
			for (let i = 0; i < n; i++) {
				const p = pts[i], u = i / (n - 1);
				p.w = 2.3 + 1.1 * (n3(i * 0.11 + wander, 7.7, 1.3) * 0.5 + 0.5) + (opt.mouth ? 0.6 * smoothstep(0.1, 0, u) : 0);
				p.h = 3.4 + 1.8 * (n3(i * 0.08 + wander, 2.2, 4.1) * 0.5 + 0.5) + (opt.mouth ? 2.2 * smoothstep(0.12, 0, u) : 0);
			}
			// the roof's limit at each point: the ground over the whole cross-section
			const cap = pts.map((p, i) => {
				const q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)], tx = q.x - o.x, tz = q.z - o.z, tl = Math.hypot(tx, tz) || 1;
				const sx = -tz / tl * (p.w + 1), sz = tx / tl * (p.w + 1);
				return Math.min(H(p.x, p.z), H(p.x + sx, p.z + sz), H(p.x - sx, p.z - sz)) - p.h - 2.5;
			});
			// ramp from a.y to b.y, pulled under the cap, smoothed, limited in steepness
			const y = pts.map((p, i) => a.y + (b.y - a.y) * smoothstep(0, 1, i / (n - 1)));
			// (the mouth's first few points are under no cap: that is where it opens)
			const lock = opt.mouth ? 3 : 0;
			// crossing a chamber (or ending in one) the floor is that chamber's: no ledge at its wall
			const inside = pts.map((p) => {
				for (const c of chambers) {
					const dx = p.x - c.x, dz = p.z - c.z, lx = dx * Math.cos(c.rot) + dz * Math.sin(c.rot), lz = -dx * Math.sin(c.rot) + dz * Math.cos(c.rot);
					if ((lx / (c.rx + 5)) ** 2 + (lz / (c.rz + 5)) ** 2 < 1) return c.fy;
				}
				return null;
			});
			const fix = () => {
				for (let i = lock; i < n; i++) y[i] = inside[i] ?? Math.min(y[i], cap[i]);
				y[n - 1] = b.y;
			};
			fix();
			for (let pass = 0; pass < 24; pass++) {
				for (let i = 1; i < n - 1; i++) y[i] = (y[i - 1] + y[i] * 2 + y[i + 1]) / 4;
				fix();
				// no step steeper than 0.3 in either direction (lowering only)
				for (let i = 1; i < n; i++) y[i] = Math.min(y[i], y[i - 1] + step * 0.3);
				for (let i = n - 2; i >= 0; i--) y[i] = Math.min(y[i], y[i + 1] + step * 0.3);
			}
			let ok = true;
			for (let i = 0; i < n; i++) {
				if (i >= lock && y[i] > cap[i] + 0.05) ok = false;
				if (y[i] < 2.5) ok = false;
				if (coast(pts[i].x, pts[i].z) < 20) ok = false;
				if (i > 0 && Math.abs(y[i] - y[i - 1]) > step * 0.36) ok = false;
				if (!ok) break;
			}
			if (!ok) continue;
			for (let i = 0; i < n; i++) pts[i].y = Math.max(2.5, y[i]);
			return pts;
		}
		return null;
	};
	// the point where a tunnel meets a chamber: inside it, on its floor
	const entry = (c, from) => {
		const a = Math.atan2(from.z - c.z, from.x - c.x);
		return { x: c.x + Math.cos(a) * Math.min(c.rx, c.rz) * 0.45, z: c.z + Math.sin(a) * Math.min(c.rx, c.rz) * 0.45, y: c.fy };
	};
	const entrances = [];
	for (const m of mouths) {
		// into the hill: uphill, and a little outside the slope so the mouth is clean
		const ux = -m.n.x, uz = -m.n.z, ul = Math.hypot(ux, uz) || 1;
		const dx = ux / ul, dz = uz / ul;
		const out = { x: m.x - dx * 6, z: m.z - dz * 6 };
		out.y = H(out.x, out.z) - 0.5;
		const pts = route(out, entry(m.to, m), { heading: Math.atan2(dz, dx), hold: 14, mouth: true, ends: [m.to] });
		if (!pts) continue;
		const yaw = Math.atan2(-dx, -dz);
		tunnels.push({ pts, mouth: true, amp: 1.15 });
		entrances.push({ x: m.x, z: m.z, y: H(m.x, m.z), yaw, dir: { x: dx, z: dz }, to: m.to, tunnel: tunnels[tunnels.length - 1] });
	}
	// the chambers joined: nearest neighbours in a tree, plus one loop when there are enough
	const linked = [chambers[0]], edges = [];
	while (linked.length < chambers.length) {
		let best = null;
		for (const a of linked) for (const b of chambers) {
			if (linked.includes(b)) continue;
			const d = Math.hypot(a.x - b.x, a.z - b.z);
			if (!best || d < best.d) best = { a, b, d };
		}
		edges.push(best); linked.push(best.b);
	}
	if (chambers.length >= 4) {
		let best = null;
		for (const a of chambers) for (const b of chambers) {
			if (a === b || edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) continue;
			const d = Math.hypot(a.x - b.x, a.z - b.z);
			if (!best || d < best.d) best = { a, b, d };
		}
		if (best && best.d < 260) edges.push(best);
	}
	// (a link that cannot be dug keeping under the rock tries the next nearest chamber)
	for (const e of edges) {
		const tries = [e.a, ...chambers.filter((c) => c !== e.a && c !== e.b).sort((p, q) => Math.hypot(p.x - e.b.x, p.z - e.b.z) - Math.hypot(q.x - e.b.x, q.z - e.b.z))];
		for (const a of tries) {
			const pts = route(entry(a, e.b), entry(e.b, a), { ends: [a, e.b] });
			if (pts) { tunnels.push({ pts, mouth: false, amp: 1.3, a, b: e.b }); break; }
		}
	}
	// where two tunnels cross at different heights the upper one dips to meet the lower
	// (a floor that fell away there could not be climbed back out of)
	for (let pass = 0; pass < 3; pass++) {
		let moved = false;
		for (const A of tunnels) for (const B of tunnels) {
			if (A === B) continue;
			const P = A.pts;
			for (let i = 0; i < P.length; i++) for (const q of B.pts) {
				if (Math.abs(P[i].x - q.x) > 8 || Math.abs(P[i].z - q.z) > 8) continue;
				if (Math.hypot(P[i].x - q.x, P[i].z - q.z) < P[i].w + q.w + 1.5 && P[i].y - q.y > 0.8 && P[i].y - q.y < P[i].h + q.h + 2) { P[i].y = q.y; moved = true; }
			}
			for (let i = 1; i < P.length; i++) P[i].y = Math.min(P[i].y, P[i - 1].y + 0.9);
			for (let i = P.length - 2; i >= 0; i--) P[i].y = Math.min(P[i].y, P[i + 1].y + 0.9);
		}
		if (!moved) break;
	}
	// what a walker can reach from the mouths; a chamber (and its tunnels) nothing reaches is left out
	const reach = new Set(entrances.map((e) => e.to));
	for (let grew = true; grew;) {
		grew = false;
		for (const t of tunnels) if (!t.mouth && reach.has(t.a) !== reach.has(t.b)) { reach.add(t.a); reach.add(t.b); grew = true; }
	}
	for (let i = chambers.length - 1; i >= 0; i--) if (!reach.has(chambers[i])) chambers.splice(i, 1);
	for (let i = tunnels.length - 1; i >= 0; i--) if (!tunnels[i].mouth && !reach.has(tunnels[i].a)) tunnels.splice(i, 1);
	if (ruins && !reach.has(ruins)) ruins = null;
	// every world keeps its ruins: failing the hall meant for them, the largest other one
	if (!ruins) {
		const alt = chambers.filter((c) => c.kind === 'hall').sort((p, q) => q.rx * q.rz * q.h - p.rx * p.rz * p.h)[0];
		if (alt) { alt.kind = 'ruins'; alt.bump = 0.2; ruins = alt; }
	}
	if (!reach.has(village)) village = chambers.find((c) => c.kind === 'village') || null;

	// ---------- the skylight ----------
	// a sinkhole over the ruins: a shaft of daylight falls on the old stones
	let shaft = null;
	if (ruins && entrances.length < 4) {
		const a = r() * 6.283, off = Math.min(ruins.rx, ruins.rz) * 0.2;
		const sx = ruins.x + Math.cos(a) * off, sz = ruins.z + Math.sin(a) * off;
		const top = H(sx, sz);
		if (top - (ruins.fy + ruins.h) < 70) shaft = { x: sx, z: sz, r: 3.2 + r() * 1.3, bottom: ruins.fy + ruins.h * 0.55, top };
	}

	// ---------- rock at the mouths ----------
	// a ledge of rock over each opening (the tunnel carves through it, leaving an arch),
	// buttresses either side, and boulders round the rim that hide where the ground ends
	const boulders = [];
	const holes = [];
	const field0 = makeField({ chambers, tunnels, shaft, boulders: [], H, n3, holes: [] });
	for (const e of entrances) {
		// how far the tunnel's air breaks the ground: the hole must cover that, no more
		let hr = 0;
		for (let k = 0; k < 48; k++) {
			const a = k / 48 * 6.283;
			for (let d = 0.5; d < 16; d += 0.5) {
				const x = e.x + Math.cos(a) * d, z = e.z + Math.sin(a) * d;
				if (field0.cave(x, H(x, z) - 0.25, z) < 0.3) hr = Math.max(hr, d);
			}
		}
		// centre the hole where the opening is
		hr = clamp(hr + 1.2, 4.5, 13);
		e.hole = { x: e.x, z: e.z, r: hr };
		holes.push(e.hole);
		const px = -e.dir.z, pz = e.dir.x;
		const t = e.tunnel.pts[3] || e.tunnel.pts[e.tunnel.pts.length - 1];
		const mw = t.w, mh = t.h;
		// the lintel: a long ledge across the opening, jutting out over it
		const lx = e.x - e.dir.x * 0.5, lz = e.z - e.dir.z * 0.5;
		boulders.push({ x: lx, y: Math.max(H(lx, lz), H(e.x - e.dir.x * 4, e.z - e.dir.z * 4) + mh) + 1.4, z: lz, rx: mw + 4.5, ry: 2.6, rz: 4, rot: Math.atan2(pz, px), amp: 1.0 });
		// and a heavier shoulder of rock behind it, so the ledge grows out of the hill
		boulders.push({ x: e.x + e.dir.x * 3.5, y: H(e.x + e.dir.x * 3.5, e.z + e.dir.z * 3.5) + 1.2, z: e.z + e.dir.z * 3.5, rx: mw + 6, ry: 3, rz: 4.5, rot: Math.atan2(pz, px), amp: 1.2 });
		// buttresses
		for (const s of [-1, 1]) {
			const bx = e.x + px * s * (mw + 2.2) - e.dir.x * 1, bz = e.z + pz * s * (mw + 2.2) - e.dir.z * 1;
			boulders.push({ x: bx, y: H(bx, bz) + 1.5, z: bz, rx: 2.6 + r(), ry: 3.2 + r() * 1.5, rz: 3.5, rot: Math.atan2(pz, px) + (r() - 0.5) * 0.5, amp: 0.8 });
		}
		// the rim
		const nb = 15 + Math.floor(r() * 5);
		for (let k = 0; k < nb; k++) {
			const a = k / nb * 6.283 + r() * 0.2, d = hr + (r() - 0.4) * 0.9;
			const bx = e.x + Math.cos(a) * d, bz = e.z + Math.sin(a) * d;
			// never in the way of the path in: the downhill side stays open
			if (Math.cos(a) * -e.dir.x + Math.sin(a) * -e.dir.z > 0.8) continue;
			const s = 0.8 + r() * 1.3;
			boulders.push({ x: bx, y: H(bx, bz) + s * 0.4, z: bz, rx: s * 1.3, ry: s * 0.85, rz: s, rot: r() * 3.14, amp: 0.35 });
		}
	}
	if (shaft) {
		shaft.hole = { x: shaft.x, z: shaft.z, r: shaft.r + 1.6 };
		holes.push(shaft.hole);
		const nb = 11;
		for (let k = 0; k < nb; k++) {
			const a = k / nb * 6.283 + r() * 0.3, d = shaft.r + 1.4 + r() * 0.6;
			const bx = shaft.x + Math.cos(a) * d, bz = shaft.z + Math.sin(a) * d, s = 0.9 + r() * 1.2;
			boulders.push({ x: bx, y: H(bx, bz) + s * 0.15, z: bz, rx: s * 1.3, ry: s * 0.9, rz: s, rot: r() * 3.14, amp: 0.35 });
		}
	}
	const field = makeField({ chambers, tunnels, shaft, boulders, H, n3, holes });
	return { chambers, tunnels, entrances, shaft, boulders, holes, village, ruins, field, n3 };
}

// ---------- the field ----------
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

export function makeField({ chambers, tunnels, shaft, boulders, H, n3, holes }) {
	// primitives: tunnel segments, chambers, the shaft; each with a box for the lookup grid
	const prims = [];
	tunnels.forEach((t, ti) => {
		const P = t.pts;
		for (let i = 0; i < P.length - 1; i++) {
			const a = P[i], b = P[i + 1], dx = b.x - a.x, dz = b.z - a.z;
			const pad = Math.max(a.w, b.w) + 4;
			prims.push({ type: 0, grp: ti + 1, ax: a.x, az: a.z, ay: a.y, by: b.y, dx, dz, len2: dx * dx + dz * dz || 1, wa: a.w, wb: b.w, ha: a.h, hb: b.h, amp: t.amp,
				x0: Math.min(a.x, b.x) - pad, x1: Math.max(a.x, b.x) + pad, z0: Math.min(a.z, b.z) - pad, z1: Math.max(a.z, b.z) + pad, y0: Math.min(a.y, b.y) - 3, y1: Math.max(a.y + a.h, b.y + b.h) + 3 });
		}
	});
	for (const c of chambers) {
		const pad = Math.max(c.rx, c.rz) + 6;
		prims.push({ type: 1, grp: -1, c, amp: c.kind === 'village' ? 2.2 : 3.2, x0: c.x - pad, x1: c.x + pad, z0: c.z - pad, z1: c.z + pad, y0: c.fy - 4, y1: c.fy + c.h + 5 });
	}
	if (shaft) prims.push({ type: 2, grp: -2, s: shaft, amp: 0.8, x0: shaft.x - shaft.r - 6, x1: shaft.x + shaft.r + 6, z0: shaft.z - shaft.r - 6, z1: shaft.z + shaft.r + 6, y0: shaft.bottom - 4, y1: shaft.top + 8 });
	for (const b of boulders) {
		const m = Math.max(b.rx, b.ry, b.rz) * 1.4 + 1;
		b.cos = Math.cos(b.rot); b.sin = Math.sin(b.rot);
		b.x0 = b.x - m; b.x1 = b.x + m; b.z0 = b.z - m; b.z1 = b.z + m; b.y0 = b.y - m; b.y1 = b.y + m;
	}
	// the lookup grid over the island
	const half = 1400, N = Math.ceil(half * 2 / GRID);
	const cells = new Array(N * N), bcells = new Array(N * N);
	const put = (arr, o) => {
		const i0 = Math.max(0, Math.floor((o.x0 + half) / GRID)), i1 = Math.min(N - 1, Math.floor((o.x1 + half) / GRID));
		const j0 = Math.max(0, Math.floor((o.z0 + half) / GRID)), j1 = Math.min(N - 1, Math.floor((o.z1 + half) / GRID));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) (arr[j * N + i] ||= []).push(o);
	};
	for (const p of prims) put(cells, p);
	for (const b of boulders) put(bcells, b);
	const cellAt = (arr, x, z) => {
		const i = Math.floor((x + half) / GRID), j = Math.floor((z + half) / GRID);
		if (i < 0 || j < 0 || i >= N || j >= N) return null;
		return arr[j * N + i] || null;
	};

	// a chamber's floor: gently uneven, rubble rising to the walls, pools sunk in
	function chamberFloor(c, x, z) {
		const dx = x - c.x, dz = z - c.z;
		const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
		const q = Math.sqrt((lx / c.rx) ** 2 + (lz / c.rz) ** 2);
		let f = c.fy + c.bump * n3(x * 0.13, 5.5, z * 0.13) + 1.8 * smoothstep(0.62, 0.98, q) * (0.6 + 0.4 * n3(x * 0.2, 1.1, z * 0.2));
		// past its rim the floor climbs into the wall
		if (q > 0.95) f += (q - 0.95) * Math.min(c.rx, c.rz) * 1.4;
		for (const p of c.pools) {
			const d = Math.hypot(x - p.x, z - p.z) / p.r;
			if (d < 1.25) f -= p.depth * smoothstep(1.2, 0.55, d + 0.12 * n3(x * 0.4, 9.1, z * 0.4));
		}
		return f;
	}
	// the open air of the caves: < 0 inside, > 0 in rock. out.floor: the floor there;
	// out.prim: the nearest piece
	const out = { floor: 0, prim: null, kind: 0 };
	function cave(x, y, z) {
		const list = cellAt(cells, x, z);
		if (!list) { out.prim = null; return 99; }
		// pieces of one tunnel join plainly; different pieces blend smoothly
		// (a tunnel is its nearest segment in plan, so its floor runs on smoothly past the joints)
		let d = 99, best = 99, amp = 0.8, floor = y, g = 0, gd = 99, gHd = 1e9;
		out.prim = null;
		for (let k = 0; k < list.length; k++) {
			const p = list[k];
			if (y < p.y0 || y > p.y1 || x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
			let v, f;
			if (p.type === 0) {
				let t = ((x - p.ax) * p.dx + (z - p.az) * p.dz) / p.len2;
				t = t < 0 ? 0 : t > 1 ? 1 : t;
				const ex = x - p.ax - p.dx * t, ez = z - p.az - p.dz * t, hd2 = ex * ex + ez * ez;
				const same = p.grp === g;
				if (same && hd2 >= gHd) continue;
				f = p.ay + (p.by - p.ay) * t;
				const w = p.wa + (p.wb - p.wa) * t, h = p.ha + (p.hb - p.ha) * t;
				const vy = (y - f - h * 0.35) / (h * 0.65);
				v = (Math.sqrt(hd2 / (w * w) + vy * vy) - 1) * Math.min(w, h * 0.65);
				if (f - y > v) v = f - y;
				if (same) { gd = v; gHd = hd2; if (v < best || out.prim?.grp === g) { best = Math.min(best, v); amp = p.amp; floor = f; out.prim = p; } continue; }
				if (gd !== 99) d = d === 99 ? gd : smin(d, gd, 2.6);
				g = p.grp; gd = v; gHd = hd2;
				if (v < best) { best = v; amp = p.amp; floor = f; out.prim = p; }
				continue;
			} else if (p.type === 1) {
				const c = p.c, dx = x - c.x, dz = z - c.z;
				const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
				const cy = c.fy + c.h * 0.22, vy = y > cy ? (y - cy) / (c.h * 0.78) : (y - cy) / (c.h * 0.5);
				v = (Math.sqrt((lx * lx) / (c.rx * c.rx) + vy * vy + (lz * lz) / (c.rz * c.rz)) - 1) * c.k;
				// a vault never breaks the ground: under a gully it flattens, a few metres of rock left
				if (y > c.fy + c.h * 0.4) { const lid = y - (H(x, z) - 3); if (lid > v) v = lid; }
				// the floor only matters near it
				if (y - c.fy < 6 && v < best + 3) { f = chamberFloor(c, x, z); if (f - y > v) v = f - y; } else f = c.fy;
			} else {
				const s = p.s, sx = x - s.x, sz = z - s.z;
				v = Math.sqrt(sx * sx + sz * sz) - s.r * (1 + 0.35 * smoothstep(s.bottom + 6, s.bottom, y) + 0.25 * smoothstep(s.top - 6, s.top + 2, y));
				if (s.bottom - y > v) v = s.bottom - y;
				f = -99;
			}
			if (v < best) { best = v; amp = p.amp; floor = f; out.prim = p; }
			if (gd !== 99) d = d === 99 ? gd : smin(d, gd, 2.6);
			g = p.grp; gd = v; gHd = 1e9;
		}
		if (gd !== 99) d = d === 99 ? gd : smin(d, gd, 2.6);
		if (d === 99) return 99;
		// the rock's own roughness: big lumps on walls and vaults, a nearly flat floor
		const above = y - floor;
		const a = amp * (0.12 + 0.88 * smoothstep(0.2, 2.6, above));
		const n1 = n3(x * 0.075, y * 0.1, z * 0.075);
		d += a * (n1 + 0.45 * n3(x * 0.21 + 3, y * 0.26, z * 0.21) + 0.16 * n3(x * 0.6, y * 0.7 + 7, z * 0.6));
		// strata: the walls step in and out in ledges where softer beds have worn away
		d += a * 0.32 * Math.sin(y * 1.15 + n1 * 2.5 + x * 0.02);
		out.floor = floor;
		return d;
	}
	// solid rock added above the ground: ledges, buttresses and boulders (> 0 inside)
	function rocks(x, y, z) {
		const list = cellAt(bcells, x, z);
		if (!list) return -99;
		let v = -99;
		for (let k = 0; k < list.length; k++) {
			const b = list[k];
			if (y < b.y0 || y > b.y1 || x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
			const dx = x - b.x, dz = z - b.z, lx = dx * b.cos + dz * b.sin, lz = -dx * b.sin + dz * b.cos;
			const e = Math.sqrt((lx / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 + (lz / b.rz) ** 2);
			const s = (1 - e) * Math.min(b.rx, b.ry, b.rz) + b.amp * (n3(x * 0.35 + 11, y * 0.4, z * 0.35) * 0.7 + n3(x * 1.1, y * 1.2 + 4, z * 1.1) * 0.2);
			if (s > v) v = s;
		}
		return v;
	}
	// everything: the ground and its rocks, with the caves taken out (< 0 is air)
	// out.kind: 0 the caves decided, 1 the ground, 2 rocks
	function solid(x, y, z) {
		const c = cave(x, y, z), g = H(x, z) - y, b = rocks(x, y, z), s = Math.max(g, b);
		if (c < s) { out.kind = 0; return c; }
		out.kind = b > g ? 2 : 1;
		return s;
	}
	// quick test: is there anything of the caves near this column?
	const near = (x, z) => !!(cellAt(cells, x, z) || cellAt(bcells, x, z));
	const inHole = (x, z, pad = 0) => holes.some((h) => (x - h.x) ** 2 + (z - h.z) ** 2 < (h.r + pad) ** 2);
	return { cave, rocks, solid, near, inHole, out, prims, chamberFloor, holes, H, cellAt: (x, z) => cellAt(cells, x, z) };
}

// ---------- meshing: surface nets over one cube of the world ----------
// A generator: it yields between slabs so a chunk can be built over several frames.
// Returns { pos, nrm, info, idx } (info: x = open-air occlusion, y = what surface:
// 0 cave rock, 1 the ground at a mouth, 2 boulders) or null when there is no surface.
export function* meshChunk(field, ox, oy, oz, S, v) {
	const n = Math.round(S / v), M = n + 2, MM = M * M;       // samples -1..n on each axis
	const val = new Float32Array(MM * M), kind = new Uint8Array(MM * M);
	let neg = 0, full = 0;
	const out = field.out;
	// a coarse pass first (every 4th sample): where the rock or the air runs deep all round
	// a coarse cell, the fine samples inside it are only filled in, not measured
	const Q = 4, CN = Math.ceil((M - 1) / Q) + 1, CC = CN - 1;
	const cval = new Float32Array(CN * CN * CN), ckind = new Uint8Array(CN * CN * CN);
	for (let c = 0; c < CN; c++) for (let b = 0; b < CN; b++) for (let a = 0; a < CN; a++) {
		const k = (c * CN + b) * CN + a;
		cval[k] = field.solid(ox + (a * Q - 1) * v, oy + (b * Q - 1) * v, oz + (c * Q - 1) * v);
		ckind[k] = out.kind;
	}
	// per coarse cell: 0 = measure, 1 = deep rock, 2 = deep air
	const far = Q * v * 1.9, cfar = new Uint8Array(CC * CC * CC);
	for (let c = 0; c < CC; c++) for (let b = 0; b < CC; b++) for (let a = 0; a < CC; a++) {
		let lo = 1e9, hi = -1e9;
		for (let q = 0; q < 8; q++) { const w = cval[((c + (q >> 2)) * CN + b + ((q >> 1) & 1)) * CN + a + (q & 1)]; if (w < lo) lo = w; if (w > hi) hi = w; }
		cfar[(c * CC + b) * CC + a] = lo > far ? 1 : hi < -far ? 2 : 0;
	}
	yield 0;
	for (let c = 0; c < M; c++) {
		const z = oz + (c - 1) * v, C0 = Math.min(CC - 1, (c / Q) | 0);
		for (let b = 0; b < M; b++) {
			const y = oy + (b - 1) * v, B0 = Math.min(CC - 1, (b / Q) | 0);
			let k = c * MM + b * M;
			for (let a = 0; a < M; a++, k++) {
				const A0 = Math.min(CC - 1, (a / Q) | 0), cf = cfar[(C0 * CC + B0) * CC + A0];
				let f;
				if (cf) { f = cf === 1 ? far : -far; kind[k] = ckind[(C0 * CN + B0) * CN + A0]; }
				else { f = field.solid(ox + (a - 1) * v, y, z); kind[k] = out.kind; }
				val[k] = f;
				if (f < 0) neg++; else full++;
			}
		}
		yield 0;
	}
	if (!neg || !full) return null;
	// one vertex in each cell the surface crosses: the mean of its edge crossings
	const M1 = M - 1;
	const cellV = new Int32Array(M1 * M1 * M1).fill(-1);
	let P = new Float32Array(3 * 4096), K = new Uint8Array(4096), nP = 0;
	// corner offsets and the 12 edges as corner pairs
	const off = [0, 1, M, M + 1, MM, MM + 1, MM + M, MM + M + 1];
	const cx = [0, 1, 0, 1, 0, 1, 0, 1], cy = [0, 0, 1, 1, 0, 0, 1, 1], cz = [0, 0, 0, 0, 1, 1, 1, 1];
	const E0 = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3], E1 = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];
	const g = new Float32Array(8);
	for (let c = 0; c < M1; c++) {
		for (let b = 0; b < M1; b++) for (let a = 0; a < M1; a++) {
			const base = c * MM + b * M + a;
			let mask = 0;
			for (let q = 0; q < 8; q++) { const w = val[base + off[q]]; g[q] = w; if (w < 0) mask |= 1 << q; }
			if (mask === 0 || mask === 255) continue;
			let sx = 0, sy = 0, sz = 0, m = 0, kk = 0;
			for (let e = 0; e < 12; e++) {
				const p = E0[e], q = E1[e];
				if ((g[p] < 0) === (g[q] < 0)) continue;
				const t = g[p] / (g[p] - g[q]);
				sx += cx[p] + (cx[q] - cx[p]) * t; sy += cy[p] + (cy[q] - cy[p]) * t; sz += cz[p] + (cz[q] - cz[p]) * t; m++;
				const kd = kind[base + off[g[p] >= 0 ? p : q]];
				if (kd > kk) kk = kd;
			}
			if (nP === K.length) { const P2 = new Float32Array(P.length * 2); P2.set(P); P = P2; const K2 = new Uint8Array(K.length * 2); K2.set(K); K = K2; }
			cellV[(c * M1 + b) * M1 + a] = nP;
			P[nP * 3] = ox + (a - 1 + sx / m) * v; P[nP * 3 + 1] = oy + (b - 1 + sy / m) * v; P[nP * 3 + 2] = oz + (c - 1 + sz / m) * v;
			K[nP++] = kk;
		}
		if (c % 8 === 7) yield 0;
	}
	// the faces: one quad per crossing edge this chunk owns (the ground only in a mouth)
	let idx = new Uint32Array(6 * 4096), nI = 0;
	const CV = (a, b, c) => cellV[(c * M1 + b) * M1 + a];
	const quad = (q0, q1, q2, q3, flip, kd) => {
		if (q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) return;
		if (kd === 1 && !field.inHole(P[q0 * 3], P[q0 * 3 + 2], 0.8)) return;
		if (nI + 6 > idx.length) { const i2 = new Uint32Array(idx.length * 2); i2.set(idx); idx = i2; }
		if (flip) { idx[nI++] = q0; idx[nI++] = q2; idx[nI++] = q1; idx[nI++] = q0; idx[nI++] = q3; idx[nI++] = q2; }
		else { idx[nI++] = q0; idx[nI++] = q1; idx[nI++] = q2; idx[nI++] = q0; idx[nI++] = q2; idx[nI++] = q3; }
	};
	for (let c = 1; c <= n; c++) {
		for (let b = 1; b <= n; b++) for (let a = 1; a <= n; a++) {
			const k0 = c * MM + b * M + a, s0 = val[k0] < 0;
			if ((val[k0 + 1] < 0) !== s0) quad(CV(a, b - 1, c - 1), CV(a, b, c - 1), CV(a, b, c), CV(a, b - 1, c), !s0, s0 ? kind[k0 + 1] : kind[k0]);
			if ((val[k0 + M] < 0) !== s0) quad(CV(a - 1, b, c - 1), CV(a, b, c - 1), CV(a, b, c), CV(a - 1, b, c), s0, s0 ? kind[k0 + M] : kind[k0]);
			if ((val[k0 + MM] < 0) !== s0) quad(CV(a - 1, b - 1, c), CV(a, b - 1, c), CV(a, b, c), CV(a - 1, b, c), !s0, s0 ? kind[k0 + MM] : kind[k0]);
		}
		if (c % 8 === 7) yield 0;
	}
	if (!nI) return null;
	// keep only the vertices the faces use
	const used = new Int32Array(nP).fill(-1);
	let nv = 0;
	for (let i = 0; i < nI; i++) if (used[idx[i]] < 0) used[idx[i]] = nv++;
	const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), info = new Float32Array(nv * 2);
	for (let q = 0; q < nP; q++) {
		const o = used[q];
		if (o < 0) continue;
		pos[o * 3] = P[q * 3]; pos[o * 3 + 1] = P[q * 3 + 1]; pos[o * 3 + 2] = P[q * 3 + 2];
		info[o * 2 + 1] = K[q];
	}
	// (wound to face the open air)
	const idx2 = new Uint32Array(nI);
	for (let i = 0; i < nI; i += 3) { idx2[i] = used[idx[i]]; idx2[i + 1] = used[idx[i + 2]]; idx2[i + 2] = used[idx[i + 1]]; }
	yield 0;
	// normals from the field's slope, and how open the air is in front of each point
	const e = 0.3;
	for (let o = 0; o < nv; o++) {
		const x = pos[o * 3], y = pos[o * 3 + 1], z = pos[o * 3 + 2];
		const f1 = field.solid(x + e, y - e, z - e), f2 = field.solid(x - e, y - e, z + e), f3 = field.solid(x - e, y + e, z - e), f4 = field.solid(x + e, y + e, z + e);
		let gx = f1 - f2 - f3 + f4, gy = -f1 - f2 + f3 + f4, gz = -f1 + f2 - f3 + f4;
		const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
		// the normal points out of the rock, into the air
		gx = -gx / l; gy = -gy / l; gz = -gz / l;
		nrm[o * 3] = gx; nrm[o * 3 + 1] = gy; nrm[o * 3 + 2] = gz;
		const a1 = -field.solid(x + gx * 1.2, y + gy * 1.2, z + gz * 1.2), a2 = -field.solid(x + gx * 3.5, y + gy * 3.5, z + gz * 3.5);
		info[o * 2] = clamp(0.5 * a1 / 1.2 + 0.5 * a2 / 3.5, 0, 1);
		if (o % 150 === 149) yield 0;
	}
	return { pos, nrm, info, idx: idx2 };
}

// every chunk that may hold a surface: the boxes round the pieces and the rocks
export function chunkKeys(field, boulders, S) {
	const keys = new Map();
	const add = (x0, x1, y0, y1, z0, z1) => {
		for (let i = Math.floor(x0 / S); i <= Math.floor(x1 / S); i++) for (let j = Math.floor(y0 / S); j <= Math.floor(y1 / S); j++) for (let k = Math.floor(z0 / S); k <= Math.floor(z1 / S); k++) {
			const key = i + ',' + j + ',' + k;
			if (!keys.has(key)) keys.set(key, { i, j, k, x: (i + 0.5) * S, y: (j + 0.5) * S, z: (k + 0.5) * S });
		}
	};
	for (const p of field.prims) add(p.x0, p.x1, p.y0, p.y1, p.z0, p.z1);
	for (const b of boulders) add(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1);
	// the ground inside each hole is drawn by us, wherever it lies
	for (const h of field.holes) {
		let lo = 1e9, hi = -1e9;
		for (let k = 0; k < 24; k++) for (const f of [0, 0.5, 1]) { const a = k / 24 * 6.283, y = field.H(h.x + Math.cos(a) * (h.r + 1) * f, h.z + Math.sin(a) * (h.r + 1) * f); lo = Math.min(lo, y); hi = Math.max(hi, y); }
		add(h.x - h.r - 2, h.x + h.r + 2, lo - 3, hi + 3, h.z - h.r - 2, h.z + h.r + 2);
	}
	return [...keys.values()];
}
