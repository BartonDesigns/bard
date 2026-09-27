// Where a game sets up: the search for a patch of ground that suits it. The player might be
// standing on a suburban sidewalk with street trees, parked cars and a house either side;
// a bocce court or a bowling alley laid straight down in front of them would have a tree
// growing through it. So a game's footprint (a rectangle: width, metres ahead of the
// stage's origin, metres behind it) is tried at spots in rings around the player, out to
// about sixty metres, and the nearest spot is taken where the footprint is:
//   clear of buildings (the real city's building boxes), trees (the real trees, and the
//     city's own trees, counted cell by cell), and roads (cars would drive through it);
//   on land (a lawn game does not go in the bay);
//   flat enough (the spread of ground heights under it).
// Water games search the other way: for a footprint that is mostly water, and set the
// stage at the water's level. With no world to ask (or nothing suitable), the stage goes
// down in front of the player as it always did, and the caller is told it isn't clear.

// the water's surface at a world point, or null for land: Lake Annabel's level, or the sea
export function waterLevel(ctx, x, z) {
	const W = ctx.getWorld?.();
	const lv = W?.lake?.waterAt?.(x, z);
	if (lv !== null && lv !== undefined) return lv;
	const gy = ctx.groundAt?.(x, z);
	return Number.isFinite(gy) && gy < -0.3 ? 0 : null;
}

// the footprint's sample points in world coordinates, every ~3 m, with a margin
function footprint(x, z, yaw, [w, ahead, back = 1], margin) {
	const fx = -Math.sin(yaw), fz = -Math.cos(yaw), pts = [];
	const W2 = w / 2 + margin, A = ahead + margin, B = back + margin;
	const nu = Math.max(2, Math.ceil(W2 * 2 / 3)), nv = Math.max(2, Math.ceil((A + B) / 3));
	for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
		const u = -W2 + i / nu * W2 * 2, v = -B + j / nv * (A + B);
		pts.push([x + fx * v - fz * u, z + fz * v + fx * u]);
	}
	return pts;
}
const segDist = (x, z, p, i) => {
	const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l2 = dx * dx + dz * dz || 1;
	const t = Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / l2));
	return Math.hypot(x - p[i] - dx * t, z - p[i + 1] - dz * t);
};

// how a footprint fares at one spot: blocked, and how rough the ground is (height spread)
function judge(ctx, W, x, z, yaw, span, want) {
	const pts = footprint(x, z, yaw, span, want.water ? 0 : 1.5);
	const rad = Math.hypot(span[0] / 2, Math.max(span[1], span[2] ?? 1)) + 3;
	const real = W?.real, city = W?.city;
	let boxes = [], trees = [], roads = [];
	try {
		boxes = real?.near?.('boxes', x, z, rad + 40) || [];
		trees = real?.near?.('trees', x, z, rad + 5) || [];
		roads = real?.near?.('roads', x, z, rad + 20) || [];
	} catch { /* a city still loading: judge on the ground alone */ }
	let lo = Infinity, hi = -Infinity, wet = 0;
	for (const [px, pz] of pts) {
		const lv = waterLevel(ctx, px, pz);
		if (lv !== null) wet++;
		else if (!want.water) {
			const h = ctx.groundAt?.(px, pz);
			if (Number.isFinite(h)) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
		}
		if (boxes.some((b) => Math.hypot(px - b.x, pz - b.z) < Math.max(b.w, b.d) / 2 + 1)) return null;
		if (!want.water && trees.some((t) => Math.hypot(px - t.x, pz - t.z) < 2.5)) return null;
		if (!want.water && roads.some((r) => { if (!r.drive && !r.walked) return false; const p = r.pts; for (let i = 0; i + 3 < p.length; i += 2) if (segDist(px, pz, p, i) < (r.w || 6) / 2 + 1) return true; return false; })) return null;
	}
	if (want.water) return wet >= pts.length * 0.75 ? { rough: 0, wet: true } : null;
	if (wet) return null;
	// the city's own trees (street trees, yard trees): counted in cells over the footprint
	if (city?.treesNear) {
		const cells = footprint(x, z, yaw, span, 0.5);
		for (let k = 0; k < cells.length; k += 2) if (city.treesNear(cells[k][0], cells[k][1], 3).length) return null;
	}
	const rough = hi > lo ? hi - lo : 0;
	return rough <= want.flat ? { rough } : null;
}

// find the spot: mode 'clear' (land) or 'water'; returns { x, z, yaw, clear, water }
export function findSpot(ctx, { mode = 'clear', dist = 4, span = [4, 4, 1], flat = 1.2 } = {}) {
	const p = ctx.player.pos, yaw = ctx.player.yaw || 0, W = ctx.getWorld?.();
	const front = { x: p.x - Math.sin(yaw) * dist, z: p.z - Math.cos(yaw) * dist, yaw, clear: false, water: false };
	if (mode === 'here' || mode === 'front') return front;
	const want = { water: mode === 'water', flat };
	// in front first; then rings outward, each spot facing away from you (you walk up to it)
	const cand = [[front.x, front.z, yaw, 0]];
	for (const r of [8, 14, 21, 29, 38, 48, 60]) for (let k = 0; k < 12; k++) {
		const a = yaw + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 6;
		const cx = p.x - Math.sin(a) * r, cz = p.z - Math.cos(a) * r;
		cand.push([cx, cz, a, r]);
	}
	let best = null, bestRing = Infinity;
	for (const [cx, cz, cy, r] of cand) {
		if (r > bestRing) break;
		let j = null;
		try { j = judge(ctx, W, cx, cz, cy, span, want); } catch { j = null; }
		if (!j) continue;
		const score = j.rough * 4 + r * 0.05;
		if (!best || score < best.score) { best = { x: cx, z: cz, yaw: cy, clear: true, water: !!j.wet, score }; bestRing = r; }
	}
	// no water to be had: a water game falls back to a clear spot on land (it builds its own)
	if (!best && want.water) return findSpot(ctx, { mode: 'clear', dist, span, flat: 1.5 });
	return best || front;
}
