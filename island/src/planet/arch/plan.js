// Where a cliff settlement stands: houses hung off the steepest edges the land has, towers
// rising from the valley floor (or the cloud sea) past them, bridges over the gaps, and the
// mist band they all stand in. Planned before the ground is baked: each house's back is
// seated into the cliff top (the ground eased up to its floor, never a pad), the cliff face
// itself left as it is, and the paths between the houses worn along the contours.

import { mulberry32, smoothstep, lerp } from '../../noise.js';
import { archStyle } from './styles.js';

const TAU = Math.PI * 2;

// a frame on the ground: local x across, z out over the edge
export const local = (o, x, z) => { const dx = x - o.x, dz = z - o.z, c = Math.cos(o.yaw), s = Math.sin(o.yaw); return [dx * c - dz * s, dx * s + dz * c]; };
export const world = (o, lx, lz) => { const c = Math.cos(o.yaw), s = Math.sin(o.yaw); return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c }; };

// ease the ground under a house's back to its floor, over `blend` metres round it; nothing
// past the lip is touched (the face stays the land's own)
function seat(I, o, x0, x1, z0, z1, y, blend) {
	const { N, cell, half, height } = I, R = Math.hypot(Math.max(-x0, x1), Math.max(-z0, z1)) + blend;
	const i0 = Math.max(0, Math.floor((o.x - R + half) / cell)), i1 = Math.min(N - 1, Math.ceil((o.x + R + half) / cell));
	const j0 = Math.max(0, Math.floor((o.z - R + half) / cell)), j1 = Math.min(N - 1, Math.ceil((o.z + R + half) / cell));
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
		const [lx, lz] = local(o, -half + i * cell, -half + j * cell);
		if (lz > 0.5) continue;
		const d = Math.hypot(Math.max(x0 - lx, 0, lx - x1), Math.max(z0 - lz, 0, lz - z1));
		if (d > blend) continue;
		const k = j * N + i;
		height[k] = lerp(height[k], y, smoothstep(blend, 0, d) * (lz > -1 ? smoothstep(0.5, -1, lz) : 1));
	}
}
// a disc eased to y (a tower's root), over blend
function ease(I, x, z, r, blend, y) {
	const { N, cell, half, height } = I, R = r + blend;
	for (let j = Math.max(0, Math.floor((z - R + half) / cell)); j <= Math.min(N - 1, Math.ceil((z + R + half) / cell)); j++) {
		for (let i = Math.max(0, Math.floor((x - R + half) / cell)); i <= Math.min(N - 1, Math.ceil((x + R + half) / cell)); i++) {
			const d = Math.hypot(-half + i * cell - x, -half + j * cell - z);
			if (d < R) height[j * N + i] = lerp(height[j * N + i], y, smoothstep(R, r, d));
		}
	}
}
// no grass through the floors
function bare(I, x, z, r) {
	const { N, cell, half, masks } = I;
	for (let j = Math.max(0, Math.floor((z - r + half) / cell)); j <= Math.min(N - 1, Math.ceil((z + r + half) / cell)); j++) {
		for (let i = Math.max(0, Math.floor((x - r + half) / cell)); i <= Math.min(N - 1, Math.ceil((x + r + half) / cell)); i++) {
			const w = smoothstep(r, r - 5, Math.hypot(-half + i * cell - x, -half + j * cell - z));
			if (w > 0) masks[(j * N + i) * 4 + 3] = Math.round(masks[(j * N + i) * 4 + 3] * (1 - w));
		}
	}
}
// a footpath worn into the path mask
function wear(I, pts, w) {
	const { N, cell, half, masks } = I;
	for (let s = 0; s < pts.length - 1; s++) {
		const a = pts[s], b = pts[s + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (cell * 0.5));
		for (let t = 0; t <= n; t++) {
			const ci = (lerp(a.x, b.x, t / n) + half) / cell, cj = (lerp(a.z, b.z, t / n) + half) / cell, rr = w / cell + 1;
			for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
				if (i < 0 || j < 0 || i >= N || j >= N) continue;
				const v = Math.round(smoothstep(w / 2 + cell, w / 2 - cell * 0.3, Math.hypot(i - ci, j - cj) * cell) * 200);
				if (v > masks[(j * N + i) * 4]) masks[(j * N + i) * 4] = v;
			}
		}
	}
}
// a path from a to b that keeps to the contour: steps of 6 m, the levellest of a fan
function contour(H, a, b) {
	const pts = [{ x: a.x, z: a.z }], y0 = H(a.x, a.z);
	let x = a.x, z = a.z;
	for (let n = 0; n < 80; n++) {
		if (Math.hypot(b.x - x, b.z - z) < 8) break;
		const to = Math.atan2(b.x - x, b.z - z);
		let best = null;
		for (let k = -3; k <= 3; k++) {
			const h = to + k * 0.3, nx = x + Math.sin(h) * 6, nz = z + Math.cos(h) * 6;
			const cost = Math.abs(H(nx, nz) - y0) * 1.4 + Math.abs(k) * 0.4;
			if (!best || cost < best.cost) best = { cost, nx, nz };
		}
		x = best.nx; z = best.nz;
		pts.push({ x, z });
	}
	pts.push({ x: b.x, z: b.z });
	return pts;
}
function rough(H, x, z, r) {
	const c = H(x, z);
	let s = 0;
	for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; s = Math.max(s, Math.abs(H(x + Math.cos(a) * r, z + Math.sin(a) * r) - c)); }
	return s;
}

export function planArch(island, profile, opts = {}) {
	const S = archStyle(profile?.type);
	if (!S) return null;
	const t0 = performance.now();
	const isPhone = !!opts.isPhone;
	const r = mulberry32((island.seed ^ 0xa7c4e5) >>> 0);
	const H = island.heightAt, half = island.half, sea = island.sea || 0;
	const avoid = [...(opts.avoid || [])];
	const V = island.village;
	if (V && !profile.noVillage) avoid.push({ x: V.x, z: V.z, r: 150 });
	for (const rd of opts.roads || []) for (let k = 0; k < rd.pts.length; k += 3) avoid.push({ x: rd.pts[k].x, z: rd.pts[k].z, r: 10 });
	const free = (x, z, pad) => Math.hypot(x, z) < half * 0.78 && !avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);

	// ---------- the cliff edges ----------
	const cands = [], D = 26;
	for (let z = -half * 0.74; z <= half * 0.74; z += 12) for (let x = -half * 0.74; x <= half * 0.74; x += 12) {
		const h = H(x, z);
		if (h < sea + 6) continue;
		let drop = 0, a = 0;
		for (let k = 0; k < 16; k++) { const t = k / 16 * TAU, d = h - H(x + Math.sin(t) * D, z + Math.cos(t) * D); if (d > drop) { drop = d; a = t; } }
		if (drop < S.drop) continue;
		const dx = Math.sin(a), dz = Math.cos(a);
		// a level top behind the edge to set the house's back on
		const b1 = H(x - dx * 10, z - dz * 10), b2 = H(x - dx * 20, z - dz * 20);
		if (Math.abs(b1 - h) > 3 || b2 - h < -5 || b2 - h > 8) continue;
		// the lip: out to where the ground falls away
		let t = 0;
		while (t < 18 && H(x + dx * (t + 1), z + dz * (t + 1)) > h - 1.2) t++;
		const lx = x + dx * t, lz = z + dz * t, ly = H(lx, lz);
		// air under a floor hung out past it, and along the edge to either side (not a spur's point)
		const under = ly - H(lx + dx * 14, lz + dz * 14);
		if (under < 9) continue;
		const side = Math.min(ly - H(lx - dz * 8 + dx * 14, lz + dx * 8 + dz * 14), ly - H(lx + dz * 8 + dx * 14, lz - dx * 8 + dz * 14));
		if (side < 5 || !free(lx, lz, 26)) continue;
		cands.push({ x: lx, z: lz, y: ly, dx, dz, drop, under, q: Math.min(drop, 60) * 0.06 + Math.min(under, 40) * 0.05 - Math.abs(b1 - h) * 0.3 });
	}
	if (cands.length < 3) return null;
	// the settlement's heart: where the most good edges gather, toward the middle of the land
	const bins = new Map(), bk = (i, j) => i * 4099 + j;
	for (const o of cands) { const k = bk(Math.floor(o.x / 60), Math.floor(o.z / 60)); bins.set(k, (bins.get(k) || 0) + Math.max(0.2, o.q)); }
	let centre = null;
	for (const c of cands) {
		const ci = Math.floor(c.x / 60), cj = Math.floor(c.z / 60);
		let s = -Math.hypot(c.x, c.z) * 0.01;
		for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (i * i + j * j <= 18) s += bins.get(bk(ci + i, cj + j)) || 0;
		if (!centre || s > centre.s) centre = { x: c.x, z: c.z, s };
	}

	// ---------- the houses ----------
	const nV = isPhone ? Math.ceil(S.villas / 2) : S.villas;
	const order = cands.map((c) => ({ c, k: Math.hypot(c.x - centre.x, c.z - centre.z) * 0.012 - c.q + r() * 0.4 })).sort((a, b) => a.k - b.k);
	const villas = [];
	const names = [...S.places];
	for (const { c } of order) {
		if (villas.length >= nV) break;
		if (Math.hypot(c.x - centre.x, c.z - centre.z) > 430) continue;
		if (villas.some((v) => Math.hypot(v.x - c.x, v.z - c.z) < 52)) continue;
		const kind = S.kinds[villas.length % S.kinds.length];
		const v = {
			kind, x: c.x, z: c.z, y: c.y + 0.15, yaw: Math.atan2(c.dx, c.dz), under: c.under, drop: c.drop,
			W: 11 + r() * 6, B: 9 + r() * 5, O: 10 + r() * 7, two: r() < 0.55, pool: r() < 0.6, domes: r() < S.domes, turn: (r() - 0.5) * 0.5, side: r() < 0.5 ? -1 : 1,
			name: names.shift() || 'Cliff House',
		};
		// the floor of the gorge below it
		v.foot = Math.min(...[15, 30, 45, 60].map((d) => H(c.x + c.dx * d, c.z + c.dz * d)));
		villas.push(v);
	}
	if (!villas.length) return null;

	// ---------- the mist band ----------
	const feet = villas.map((v) => v.foot).sort((a, b) => a - b), decks = villas.map((v) => v.y).sort((a, b) => a - b);
	// (most of the houses stand over it; the lowest of them in it)
	let base = S.mist.sea ? sea + S.mist.base : Math.max(sea + 1, feet[Math.floor(feet.length / 2)] + S.mist.base);
	let top = Math.min(base + S.mist.depth, decks[Math.floor(decks.length / 2)] - 2);
	if (top < base + 14) base = Math.max(sea + 1, top - 14), top = base + 14;

	// ---------- the towers ----------
	const towers = [], tNames = [...S.towers];
	const nT = S.towerN;
	for (let n = 0; n < nT; n++) {
		let best = null;
		for (let k = 0; k < 900; k++) {
			const a = r() * TAU, d = 40 + r() * 380, x = centre.x + Math.sin(a) * d, z = centre.z + Math.cos(a) * d;
			if (!free(x, z, 22)) continue;
			const h = H(x, z);
			const sea0 = S.towerAt === 'sea';
			if (sea0 ? h > sea - 4 : h < sea + 1 || h > top - 2) continue;
			if (!sea0 && rough(H, x, z, 12) > 4) continue;
			const near = Math.min(...villas.map((v) => Math.hypot(v.x - x, v.z - z)));
			if (near < 42 || towers.some((o) => Math.hypot(o.x - x, o.z - z) < 110)) continue;
			// next to the edges and the houses, not out on its own
			const score = Math.abs(near - 75) * 0.05 + d * 0.004 + r() * 0.5 + (sea0 ? Math.max(0, near - 110) * 0.05 : 0);
			if (!best || score < best.score) best = { x, z, score, h };
		}
		if (!best) continue;
		// (a spire broad enough for grand rooms; a slab cluster's tallest sized here, its ground levelled)
		const kind = S.towerKinds[towers.length % S.towerKinds.length], R = kind === 'spire' ? 11 + r() * 3.5 : 8 + r() * 5;
		const sw = kind === 'slabs' ? 22 + r() * 8 : 0, sd = kind === 'slabs' ? 14 + r() * 5 : 0;
		let y = best.h;
		if (S.towerAt !== 'sea') {
			for (let k = 0; k < 8; k++) y = Math.min(y, H(best.x + Math.cos(k) * R, best.z + Math.sin(k) * R));
			ease(island, best.x, best.z, Math.max(R * 1.3, Math.hypot(sw, sd) / 2 + 3), 12, y + 0.4);
			avoid.push({ x: best.x, z: best.z, r: R + 12 });
		}
		const tall = S.tall[0] + r() * (S.tall[1] - S.tall[0]);
		towers.push({ x: best.x, z: best.z, y: y - 2, R, top: Math.max(top + tall, y + 70), twist: (r() < 0.5 ? -1 : 1) * (0.6 + r() * 1.2), name: tNames.shift() || 'Tower', lobbies: [], sea: S.towerAt === 'sea', kind, sw, sd });
	}

	// ---------- the bridges ----------
	const bridges = [], uses = new Map();
	const clearUnder = (a, b, y) => {
		for (let t = 0.12; t <= 0.88; t += 0.04) if (H(lerp(a.x, b.x, t), lerp(a.z, b.z, t)) > y - 6) return false;
		for (const T of towers) {
			const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((T.x - a.x) * dx + (T.z - a.z) * dz) / l2));
			if (Math.hypot(a.x + dx * t - T.x, a.z + dz * t - T.z) < T.R + 4 && t > 0.02 && t < 0.98) return false;
		}
		return true;
	};
	// a house's side, where a bridge leaves it: its walkway on the cliff top, toward the other end
	const sideOf = (v, to) => {
		const [lx] = local(v, to.x, to.z), sd = lx < 0 ? -1 : 1, p = world(v, sd * (v.W / 2 + 2.5), -1.5);
		return { x: p.x, z: p.z, y: v.y };
	};
	const beside = (v, A, B) => {
		const [ax, az] = local(v, A.x, A.z), [bx, bz] = local(v, B.x, B.z);
		if (bz <= az + 1) return true;
		const at = ax + (bx - ax) * Math.min(1, (v.O + 6 - az) / (bz - az));
		return Math.sign(at) === Math.sign(ax) && Math.abs(at) > v.W / 2 + 1;
	};
	const opts2 = [];
	for (let i = 0; i < villas.length; i++) {
		for (let j = i + 1; j < villas.length; j++) {
			const a = villas[i], b = villas[j], d = Math.hypot(a.x - b.x, a.z - b.z);
			if (d < 40 || d > 170 || Math.abs(a.y - b.y) > 5) continue;
			opts2.push({ d, a, b });
		}
		for (const T of towers) {
			if (T.kind !== 'spire') continue;
			const a = villas[i], d = Math.hypot(a.x - T.x, a.z - T.z);
			if (d < 35 || d > 150 || a.y > T.top - 20 || a.y < T.y + 12) continue;
			opts2.push({ d: d * 0.8, a, T });
		}
	}
	opts2.sort((p, q) => p.d - q.d);
	for (const o of opts2) {
		if (bridges.length >= S.bridges) break;
		if ((uses.get(o.a) || 0) >= 1 || o.b && (uses.get(o.b) || 0) >= 1) continue;
		const A = sideOf(o.a, o.b || o.T);
		let B;
		if (o.b) B = sideOf(o.b, o.a);
		else {
			const dx = A.x - o.T.x, dz = A.z - o.T.z, l = Math.hypot(dx, dz);
			B = { x: o.T.x + dx / l * (o.T.R + 3.5), z: o.T.z + dz / l * (o.T.R + 3.5), y: A.y };
		}
		// (passing beside the house it leaves, and the far one, not through them)
		if (!beside(o.a, A, B) || o.b && !beside(o.b, B, A)) continue;
		if (!clearUnder(A, B, Math.min(A.y, B.y))) continue;
		bridges.push({ a: A, b: B, w: 3.2 });
		uses.set(o.a, 1);
		if (o.b) uses.set(o.b, 1);
		else o.T.lobbies.push({ y: A.y, a: Math.atan2(A.x - o.T.x, A.z - o.T.z) });
	}

	// ---------- the ground ----------
	const clear = [];
	for (const v of villas) {
		seat(island, v, -v.W / 2 - 1, v.W / 2 + 1, -v.B - 1, 0, v.y - 0.12, 10);
		const back = world(v, 0, -v.B / 2);
		bare(island, back.x, back.z, Math.max(v.W, v.B) / 2 + 4);
		clear.push({ x: back.x, z: back.z, r: Math.max(v.W, v.B) / 2 + 8 });
		avoid.push({ x: v.x, z: v.z, r: 30 });
	}
	for (const T of towers) if (!T.sea) { bare(island, T.x, T.z, T.R + 4); clear.push({ x: T.x, z: T.z, r: T.R + 10 }); }
	// footpaths along the cliff tops between neighbouring houses
	const paths = [];
	for (let i = 0; i < villas.length; i++) {
		const a = villas[i];
		let best = null;
		for (const b of villas) {
			if (b === a || Math.abs(b.y - a.y) > 6) continue;
			const d = Math.hypot(a.x - b.x, a.z - b.z);
			if (d < 160 && (!best || d < best.d)) best = { b, d };
		}
		if (!best || paths.some((p) => p.ends.includes(a) && p.ends.includes(best.b))) continue;
		const pa = world(a, 0, -a.B - 4), pb = world(best.b, 0, -best.b.B - 4);
		const pts = contour(H, pa, pb);
		if (pts.some((p) => Math.abs(H(p.x, p.z) - a.y) > 9)) continue;
		wear(island, pts, 2.6);
		paths.push({ ends: [a, best.b], pts });
	}
	// the monolith: a lone black slab out on the water, in sight of the houses
	let monolith = null;
	for (let k = 0; k < 900; k++) {
		const a = r() * TAU, d = 160 + r() * 1200, x = centre.x + Math.sin(a) * d, z = centre.z + Math.cos(a) * d;
		if (Math.hypot(x, z) > half * 0.92 || H(x, z) > sea - 4 || towers.some((T) => Math.hypot(T.x - x, T.z - z) < 90)) continue;
		let sh = -Infinity;
		for (let j = 0; j < 8; j++) sh = Math.max(sh, H(x + Math.cos(j) * 30, z + Math.sin(j) * 30));
		if (sh > sea - 1) continue;
		const score = Math.max(0, d - 300) * 0.01 + r();
		if (!monolith || score < monolith.score) monolith = { x, z, score, y: H(x, z), h: 90 + r() * 60, yaw: Math.atan2(centre.x - x, centre.z - z) };
	}
	// the shore house: a white cube on a knoll over the water, a stair down to it
	let shore = null;
	for (let k = 0; k < 1500; k++) {
		const a = r() * TAU, d = 60 + r() * 900, x = centre.x + Math.sin(a) * d, z = centre.z + Math.cos(a) * d, h = H(x, z);
		if (h < 2.5 || h > 16 || !free(x, z, 24) || rough(H, x, z, 7) > 2.2 || villas.some((v) => Math.hypot(v.x - x, v.z - z) < 60)) continue;
		let best = null;
		for (let j = 0; j < 16; j++) {
			const t = j / 16 * TAU;
			for (let dd = 10; dd <= 44; dd += 3) if (H(x + Math.sin(t) * dd, z + Math.cos(t) * dd) < -0.3) { if (!best || dd < best.dd) best = { dd, t }; break; }
		}
		if (!best || best.dd < 12) continue;
		const score = best.dd * 0.05 + d * 0.002 + rough(H, x, z, 7) + r() * 0.3;
		if (!shore || score < shore.score) shore = { x, z, y: h, yaw: best.t, wd: best.dd, score, name: S.shore || 'The Shore House' };
	}
	if (shore) {
		ease(island, shore.x, shore.z, 6, 8, shore.y);
		bare(island, shore.x, shore.z, 8);
		clear.push({ x: shore.x, z: shore.z, r: 12 });
	}
	let rad = 0;
	for (const o of [...villas, ...towers]) rad = Math.max(rad, Math.hypot(o.x - centre.x, o.z - centre.z));
	// a second band higher up: just under the high houses' floors, or round the towers' middles
	const upper = decks.filter((y) => y > top + 12);
	const tt = towers.length ? Math.min(...towers.map((t) => t.top)) : top + 90;
	let b2 = upper.length >= 2 ? { base: Math.min(...upper) - 16, top: Math.min(...upper) - 2 } : { base: top + (tt - top) * 0.5 - 8, top: top + (tt - top) * 0.5 + 8 };
	b2 = { base: Math.max(b2.base, top + 14), top: Math.max(b2.top, Math.max(b2.base, top + 14) + 10), cover: S.mist.cover + 0.05 };
	const mist = { base, top, cover: S.mist.cover, bands: [{ base, top, cover: S.mist.cover }, b2], x: centre.x, z: centre.z, rad: Math.min(1000, rad + 300) };
	// far cities standing out of the cloud at the edge of sight
	const cities = [];
	for (let k = 0; k < 400 && cities.length < 3; k++) {
		const a = r() * TAU, R = half * (0.8 + r() * 0.12), x = Math.cos(a) * R, z = Math.sin(a) * R;
		if (Math.hypot(x - centre.x, z - centre.z) < 650 || cities.some((c) => Math.hypot(c.x - x, c.z - z) < 500)) continue;
		const h = H(x, z);
		if (h > sea + 2 && k < 300) continue;
		cities.push({ x, z, y: Math.min(h, sea) - 3, n: 5 + Math.floor(r() * 5), h: 50 + r() * 90, seed: (r() * 1e9) >>> 0 });
	}
	// a mountain through the cloud: the highest ground within reach, mist round its flanks,
	// hamlets' lamps on its slopes, a lit tower at its foot
	let mountain = null;
	for (let z = -half * 0.8; z <= half * 0.8; z += 40) for (let x = -half * 0.8; x <= half * 0.8; x += 40) {
		const d = Math.hypot(x - centre.x, z - centre.z), h = H(x, z);
		if (d < 250 || d > 1150 || h < top + 70 || villas.some((v) => Math.hypot(v.x - x, v.z - z) < 90)) continue;
		if (!mountain || h > mountain.h) mountain = { x, z, h };
	}
	if (mountain) {
		const M = mountain, y = top + (M.h - top) * 0.45;
		let rr = 0;
		for (let k = 0; k < 8; k++) { let d = 10; while (d < 600 && H(M.x + Math.cos(k * 0.785) * d, M.z + Math.sin(k * 0.785) * d) > y) d += 10; rr += d / 8; }
		M.y = y; M.r = rr;
		const a = Math.atan2(centre.x - M.x, centre.z - M.z);
		let tw = null;
		for (let k = 0; k < 40 && !tw; k++) {
			const b = a + (r() - 0.5) * 2, d = rr * (1.1 + r() * 0.5), x = M.x + Math.sin(b) * d, z = M.z + Math.cos(b) * d, h = H(x, z);
			if (h > sea + 1 && h < y - 10 && rough(H, x, z, 10) < 5 && free(x, z, 12)) tw = { x, z, y: h - 2, R: 8, top: y + 55 + r() * 30, twist: 0, name: 'Summit Light', lobbies: [], sea: false, kind: 'slabs' };
		}
		M.tower = tw;
	}
	return { style: S, seed: island.seed, name: S.name, centre, villas, towers, bridges, monolith, shore, cities, mountain, paths: paths.map((p) => p.pts), mist, clear, planMs: Math.round(performance.now() - t0) };
}
