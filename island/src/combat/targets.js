// The combat layer: what shots and blasts can strike, as a few simple shapes each (capsules
// for people, boxes for cars and crates, spheres for drones and a boss's weak points), with a
// coarse sphere round each for a cheap first look. Shots are cast against this layer only,
// never against the scene's meshes.
//
// The hit filter is the one gate every shot, blast and hit report passes through: children
// (and the ghost child in the woods) are never targets of anything, protected people never
// are, friends are only with the room's PvP setting on, and a side never hurts its own.
// Pure maths on {x, y, z} points: no three, no DOM.

// a person who is a child: by the body's own flag or their age
export const isChild = (P) => !!P && (!!P.dna?.child || (Number.isFinite(P.dna?.age) && P.dna.age < 18) || !!P.ghost);

// may `shooter` strike `target`? rules: { pvp } (the room's setting)
export function canHit(target, shooter = null, rules = {}) {
	if (!target || target.removed) return false;
	if (target.child || target.ghost || target.protected) return false;
	if (target.P && isChild(target.P)) return false;
	if (shooter && target.id === shooter.id) return false;
	if (target.kind === 'player' || target.kind === 'remote') {
		if (!rules.pvp) return false;
		if (shooter && shooter.kind !== 'player' && shooter.kind !== 'remote') return true;
	}
	if (shooter?.faction && target.faction && shooter.faction === target.faction) return false;
	return true;
}

// ---------- rays against shapes (o origin, d unit direction; the distance, or Infinity) ----------
export function raySphere(o, d, c, r) {
	const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
	const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
	const disc = b * b - cc;
	if (disc < 0) return Infinity;
	const s = Math.sqrt(disc), t0 = -b - s;
	if (t0 >= 0) return t0;
	return -b + s >= 0 ? 0 : Infinity;
}
// a capsule: the segment a to b swollen by r
export function rayCapsule(o, d, a, b, r) {
	const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
	const oax = o.x - a.x, oay = o.y - a.y, oaz = o.z - a.z;
	const baba = bax * bax + bay * bay + baz * baz, bard = bax * d.x + bay * d.y + baz * d.z, baoa = bax * oax + bay * oay + baz * oaz;
	const rdoa = d.x * oax + d.y * oay + d.z * oaz, oaoa = oax * oax + oay * oay + oaz * oaz;
	const A = baba - bard * bard, B = baba * rdoa - baoa * bard, C = baba * oaoa - baoa * baoa - r * r * baba;
	if (A > 1e-9) {
		const h = B * B - A * C;
		if (h >= 0) {
			const t = (-B - Math.sqrt(h)) / A, y = baoa + t * bard;
			if (t >= 0 && y > 0 && y < baba) return t;
		}
	}
	// the caps
	return Math.min(raySphere(o, d, a, r), raySphere(o, d, b, r));
}
// a box turned about y by yaw: c centre, h half sizes [x, y, z]; returns { t, n } or null
export function rayBox(o, d, c, h, yaw = 0) {
	const cs = Math.cos(yaw), sn = Math.sin(yaw);
	// into the box's frame (its x = (cos, 0, -sin), z = (sin, 0, cos) in the world)
	const px = o.x - c.x, py = o.y - c.y, pz = o.z - c.z;
	const lo = [px * cs - pz * sn, py, px * sn + pz * cs], ld = [d.x * cs - d.z * sn, d.y, d.x * sn + d.z * cs];
	let tmin = -Infinity, tmax = Infinity, axis = 0;
	for (let i = 0; i < 3; i++) {
		if (Math.abs(ld[i]) < 1e-12) { if (Math.abs(lo[i]) > h[i]) return null; continue; }
		let t1 = (-h[i] - lo[i]) / ld[i], t2 = (h[i] - lo[i]) / ld[i];
		if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
		if (t1 > tmin) { tmin = t1; axis = i; }
		if (t2 < tmax) tmax = t2;
		if (tmin > tmax) return null;
	}
	if (tmax < 0) return null;
	const t = Math.max(0, tmin);
	// the face's normal, back in the world
	const n = [0, 0, 0];
	n[axis] = ld[axis] > 0 ? -1 : 1;
	return { t, n: { x: n[0] * cs + n[2] * sn, y: n[1], z: -n[0] * sn + n[2] * cs } };
}
// a point's distance to a segment
export function segDist(p, a, b) {
	const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, l = bx * bx + by * by + bz * bz;
	const u = l > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by + (p.z - a.z) * bz) / l)) : 0;
	return Math.hypot(p.x - a.x - bx * u, p.y - a.y - by * u, p.z - a.z - bz * u);
}

// one shape: { type: 'sphere', c, r, part } | { type: 'capsule', a, b, r, part } | { type: 'box', c, h, yaw, part }
export function rayShape(o, d, s) {
	if (s.type === 'sphere') { const t = raySphere(o, d, s.c, s.r); return t < Infinity ? { t, n: null } : null; }
	if (s.type === 'capsule') { const t = rayCapsule(o, d, s.a, s.b, s.r); return t < Infinity ? { t, n: null } : null; }
	if (s.type === 'box') return rayBox(o, d, s.c, s.h, s.yaw || 0);
	return null;
}

// a person standing at feet (x, y, z), of height h: head, torso and legs (arms count as limbs
// with the legs; the multipliers are health.js PARTS)
export function personShapes(x, y, z, h = 1.75, crouch = 0) {
	const k = 1 - 0.3 * crouch, top = y + h * k;
	return [
		{ type: 'sphere', c: { x, y: top - h * 0.075, z }, r: h * 0.068, part: 'head' },
		{ type: 'capsule', a: { x, y: y + h * 0.5 * k, z }, b: { x, y: top - h * 0.2, z }, r: h * 0.115, part: 'torso' },
		{ type: 'capsule', a: { x, y: y + h * 0.08, z }, b: { x, y: y + h * 0.46 * k, z }, r: h * 0.09, part: 'limb' },
	];
}

// the layer: targets are { id, kind, faction?, bound: { x, y, z, r }, shapes: [] or () => [],
// child?, protected?, P? (a people/body.js person), health?, ref? }
export function createLayer() {
	const map = new Map();
	const shapesOf = (T) => (typeof T.shapes === 'function' ? T.shapes() : T.shapes) || [];
	return {
		map,
		add(T) { map.set(T.id, T); return T; },
		remove(id) { const T = map.get(id); if (T) T.removed = true; map.delete(id); },
		get: (id) => map.get(id) || null,
		clear() { map.clear(); },
		get size() { return map.size; },
		// the nearest target a ray strikes within max, past the filter: { T, t, part, n, shape }
		cast(o, d, max, shooter = null, rules = {}) {
			let best = null, bt = max;
			for (const T of map.values()) {
				const B = T.bound;
				if (!B || !canHit(T, shooter, rules)) continue;
				// (the bounding sphere first)
				const bx = B.x - o.x, by = B.y - o.y, bz = B.z - o.z, along = bx * d.x + by * d.y + bz * d.z;
				if (along < -B.r || along - B.r > bt) continue;
				const ax = bx - d.x * along, ay = by - d.y * along, az = bz - d.z * along;
				if (ax * ax + ay * ay + az * az > B.r * B.r) continue;
				for (const s of shapesOf(T)) {
					const h = rayShape(o, d, s);
					if (h && h.t < bt) { bt = h.t; best = { T, t: h.t, part: s.part || 'body', n: h.n, shape: s }; }
				}
			}
			return best;
		},
		// everything within r of a point, past the filter, with its distance to the nearest shape
		within(c, r, shooter = null, rules = {}) {
			const out = [];
			for (const T of map.values()) {
				const B = T.bound;
				if (!B || !canHit(T, shooter, rules)) continue;
				if (Math.hypot(B.x - c.x, B.y - c.y, B.z - c.z) > r + B.r) continue;
				let best = Infinity, part = 'body';
				for (const s of shapesOf(T)) {
					const dd = s.type === 'capsule' ? segDist(c, s.a, s.b) - s.r : s.type === 'sphere' ? Math.hypot(c.x - s.c.x, c.y - s.c.y, c.z - s.c.z) - s.r : Math.max(0, Math.hypot(c.x - s.c.x, c.y - s.c.y, c.z - s.c.z) - Math.min(s.h[0], s.h[1], s.h[2]));
					if (dd < best) { best = dd; part = s.part || 'body'; }
				}
				if (best <= r) out.push({ T, d: Math.max(0, best), part });
			}
			return out;
		},
	};
}
