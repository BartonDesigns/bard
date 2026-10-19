// Street tactics, pure (no three, no DOM): where a roadblock goes on the road ahead of a
// suspect and how its cars stand across it, where a unit can appear without popping up in
// front of you, whether a squad holds or falls back, and keeping people out of buildings.
// law/index.js and military/police.js use them.

import { clamp } from '../noise.js';

// is (x, z) inside a building box { x, z, w, d, a } (world.real's boxes), with a margin?
export function insideBox(b, x, z, pad = 0) {
	const c = Math.cos(b.a || 0), s = Math.sin(b.a || 0), dx = x - b.x, dz = z - b.z;
	const lx = c * dx + s * dz, lz = -s * dx + c * dz;
	return Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad;
}
// out of any box it has walked into, by the shortest way (p: { x, z }); true when moved
export function pushOut(boxes, p, r = 0.35) {
	let moved = false;
	for (const b of boxes) {
		if (!(b.w > 1.5) || !(b.d > 1.5)) continue;
		const c = Math.cos(b.a || 0), s = Math.sin(b.a || 0), dx = p.x - b.x, dz = p.z - b.z;
		let lx = c * dx + s * dz, lz = -s * dx + c * dz;
		const hw = b.w / 2 + r, hd = b.d / 2 + r;
		if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;
		if (hw - Math.abs(lx) < hd - Math.abs(lz)) lx = Math.sign(lx || 1) * hw; else lz = Math.sign(lz || 1) * hd;
		p.x = b.x + c * lx - s * lz; p.z = b.z + s * lx + c * lz;
		moved = true;
	}
	return moved;
}

// a roadblock: a point on a road ahead of `from` along `dir` (a unit heading { x, z }), between
// min and max metres off, on as big a road as there is; with the road's own heading there.
// roads: [{ pts, cls }]. Returns { x, z, yaw, tx, tz, cls, d } or null.
export function roadblockSpot(roads, from, dir, { min = 130, max = 260, cone = 0.6 } = {}) {
	let best = null;
	const L = Math.hypot(dir.x, dir.z) || 1, ux = dir.x / L, uz = dir.z / L;
	for (const r of roads) {
		if (!r?.pts || r.pts.length < 4 || /footway|path|steps|cycleway|pedestrian|track|service/.test(r.cls || '')) continue;
		const big = /motorway|trunk|primary/.test(r.cls || '') ? 0.35 : /secondary|tertiary/.test(r.cls || '') ? 0.2 : 0;
		const P = r.pts;
		for (let i = 2; i < P.length - 2; i += 2) {
			const dx = P[i] - from.x, dz = P[i + 1] - from.z, d = Math.hypot(dx, dz);
			if (d < min || d > max) continue;
			const align = (dx * ux + dz * uz) / d;
			if (align < Math.cos(cone)) continue;
			const tx = P[i + 2] - P[i - 2], tz = P[i + 3] - P[i - 1], tl = Math.hypot(tx, tz) || 1;
			const score = align + big - Math.abs(d - (min + max) / 2) / max * 0.3;
			if (!best || score > best.score) best = { x: P[i], z: P[i + 1], tx: tx / tl, tz: tz / tl, yaw: Math.atan2(tx, tz), cls: r.cls || '', d, score };
		}
	}
	return best;
}
// the cars across the road at a roadblock: n of them, nose to tail across the carriageway,
// turned a little; and where the officers stand behind them (away from the suspect at `from`)
export function blockSlots(spot, from, n = 2, gap = 3.0) {
	const px = -spot.tz, pz = spot.tx, cars = [];
	for (let i = 0; i < n; i++) {
		const o = (i - (n - 1) / 2) * gap;
		cars.push({ x: spot.x + px * o, z: spot.z + pz * o, yaw: spot.yaw + Math.PI / 2 + (i % 2 ? 0.25 : -0.25) });
	}
	// behind: along the road away from the suspect
	const bx = spot.x - from.x, bz = spot.z - from.z, bl = Math.hypot(bx, bz) || 1;
	const post = { x: spot.x + bx / bl * 5, z: spot.z + bz / bl * 5 };
	return { cars, post };
}

// in front of an eye looking along dir (unit { x, z }) within the half-angle?
export function inCone(eye, dir, x, z, half = 0.9) {
	const dx = x - eye.x, dz = z - eye.z, d = Math.hypot(dx, dz) || 1;
	return (dx * dir.x + dz * dir.z) / d > Math.cos(half);
}
// of candidate spots [{ x, z }], the first one you cannot see: out of the view cone, or with
// something in the way (blocked(x, z) -> true); else the farthest
export function hiddenSpot(cands, eye, dir, blocked = () => false, half = 0.9) {
	let far = null, fd = -1;
	for (const c of cands) {
		if (!c) continue;
		if (!inCone(eye, dir, c.x, c.z, half) || blocked(c.x, c.z)) return c;
		const d = Math.hypot(c.x - eye.x, c.z - eye.z);
		if (d > fd) { fd = d; far = c; }
	}
	return far && fd > 220 ? far : null;
}

// a squad's nerve: { alive, start, enemies (in the fight near them), hurt (0..1 the squad's
// mean wound) }: 'hold', 'fallback' (back to cover, further off) or 'rout' (break and run)
export function squadMorale({ alive = 1, start = 1, enemies = 0, hurt = 0, kind = 'gang' } = {}) {
	if (kind === 'machines' || kind === 'creatures' || enemies < 1) return 'hold';
	const steady = kind === 'military' || kind === 'police' || kind === 'invaders' ? 0.6 : 1;
	const odds = enemies / Math.max(1, alive);
	if (alive <= 1 && odds >= 2 && kind !== 'military') return 'rout';
	if ((alive < start * 0.6 && odds > 1.4 * (1 / steady)) || hurt > 0.65 * (1 / steady)) return 'fallback';
	return 'hold';
}

// a unit far from you can be moved along faster than it would drive (nobody sees it); near,
// at its real pace. d: metres to you
export const offscreenPace = (d, pace) => (d > 450 ? pace * clamp(d / 300, 1.5, 3) : pace);
