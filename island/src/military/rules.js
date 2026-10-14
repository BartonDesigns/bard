// The military's rules, pure (no three, no DOM): where bases go, what stands in them, where
// the soldiers are posted, who may stand where (no militia roams: every armed post belongs to
// a base, a checkpoint or a compound), and how the dispatch answers trouble with the nearest
// base's convoy or air support. military/index.js builds and runs what these say.
//
// Siting: a base wants open, flat land away from homes and towns, near a freeway or the coast,
// never in water. Candidates come from a few hand-picked Bay sites (named originally, after the
// kind of ground a former airfield or depot stands on) and from a seeded grid over the whole
// globe; each is tried, nudged about and turned until the ground agrees, or dropped.

// ---------- small seeded helpers ----------
export function hash2(a, b, s = 0) {
	let h = Math.imul((a | 0) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul((b | 0) + 0x165667b1, 0xc2b2ae35) ^ Math.imul(s | 0, 0x9e3779b1);
	h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}
export function rng(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

// ---------- names: original, never a real installation's ----------
const ROOTS = ['Kestrel', 'Harrow', 'Ironbark', 'Saltmarsh', 'Greywater', 'Thornfield', 'Larkspur', 'Ashcombe', 'Redcliff', 'Stonegate', 'Windmere', 'Osprey Reach', 'Coldbrook', 'Marrow Hill', 'Tamsin', 'Ember Flats', 'Quill', 'Hollins', 'Brackwater', 'Sedgemoor', 'Corrin', 'Fallowmere', 'Vantage', 'Ridley'];
export function baseName(seed, kind) {
	const r = rng(seed), root = pick(r, ROOTS);
	return kind === 'airbase' ? `${root} ${r() < 0.5 ? 'Air Station' : 'Field'}` : `${r() < 0.5 ? 'Camp' : 'Fort'} ${root}`;
}

// the Bay's own: open ground of the kind old airfields and depots stand on, named afresh
export const BAY_SITES = Object.freeze([
	{ id: 'bay-diablo', name: 'Diablo Flats Depot', kind: 'garrison', lat: 37.993, lon: -122.012, yaw: 0.35, note: 'grassland of an old weapons depot by Highway 4' },
	{ id: 'bay-suisun', name: 'Suisun Plain Air Station', kind: 'airbase', lat: 38.232, lon: -121.985, yaw: 0.9, note: 'farm flats off Interstate 80' },
	{ id: 'bay-pillar', name: 'Pillar Bluff Airstrip', kind: 'airbase', lat: 37.512, lon: -122.497, yaw: 2.4, note: 'the coastal terrace by Highway 1', short: true },
	{ id: 'bay-gull', name: 'Gull Point Air Station', kind: 'airbase', lat: 37.784, lon: -122.312, yaw: 1.2, note: 'a point of filled land on the Bay, a former naval field' },
]);

// globe candidates in the cells round (lat, lon): one try per cell of `cell` degrees with a
// seeded chance; about a third of them airfields
export function globeSites(lat, lon, reachDeg = 1, cell = 0.5, chance = 0.42) {
	const out = [], i0 = Math.floor((lat - reachDeg) / cell), i1 = Math.floor((lat + reachDeg) / cell), j0 = Math.floor((lon - reachDeg) / cell), j1 = Math.floor((lon + reachDeg) / cell);
	for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
		if (Math.abs(i * cell) > 70) continue;
		if (hash2(i, j, 71) > chance) continue;
		const la = (i + 0.15 + hash2(i, j, 72) * 0.7) * cell, lo = (j + 0.15 + hash2(i, j, 73) * 0.7) * cell;
		// (the Bay has its own)
		if (la > 37 && la < 38.6 && lo > -123 && lo < -121.6) continue;
		const kind = hash2(i, j, 74) < 0.34 ? 'airbase' : 'garrison', seed = Math.floor(hash2(i, j, 75) * 1e9);
		out.push({ id: `g${i}_${j}`, name: baseName(seed, kind), kind, lat: la, lon: lo, yaw: hash2(i, j, 76) * Math.PI, seed });
	}
	return out;
}

// ---------- the layout: everything in the base's own frame (x along the runway, +z the front) ----------
// building types: gate, guardhouse, barracks, hq, armoury, motorpool, hangar, tower (watch),
// control (tower), helipad, fuel, runway, taxiway, apron, fence. Each building that people go
// into has a frame for its interior: { x, z, yaw, w, d, h, floors } in the base's frame and
// the builder that furnishes it (services/interiors.js: warRoom, depot, barracks).
export function baseLayout(kind, seed = 1, short = false) {
	const r = rng(seed ^ 0xba5e);
	const air = kind === 'airbase';
	const runway = air ? (short ? 900 : 1300) : 0;
	const W = air ? runway + 120 : 380, D = air ? 460 : 280;
	const front = D / 2, B = [];
	const add = (o) => { B.push(o); return o; };
	// the gate in the front fence, off to one side, a guardhouse by it
	const gx = air ? -W / 2 + 160 : -60;
	add({ type: 'gate', x: gx, z: front, w: 14, d: 2, h: 3 });
	add({ type: 'guardhouse', x: gx + 13, z: front - 6, w: 5, d: 4, h: 3.2, yaw: 0 });
	// the cantonment: along the front, inside the fence
	const cz = air ? front - 70 : 40;
	const bx = air ? -W / 2 + 230 : -110;
	const nb = air ? 3 : 2 + (r() < 0.5 ? 1 : 0);
	for (let i = 0; i < nb; i++) add({ type: 'barracks', x: bx + i * 52, z: cz, w: 42, d: 13, h: 7.2, floors: 2, interior: 'barracks' });
	add({ type: 'hq', x: bx + nb * 52 + 14, z: cz - 4, w: 28, d: 18, h: 8.5, floors: 2, interior: 'warRoom' });
	add({ type: 'armoury', x: bx - 12, z: cz - 48, w: 18, d: 12, h: 5, floors: 1, interior: 'depot' });
	const mp = add({ type: 'motorpool', x: bx + 70, z: cz - 52, w: 54, d: 18, h: 6.5 });
	add({ type: 'fuel', x: bx + 128, z: cz - 52, w: 16, d: 10, h: 6 });
	const hp = add({ type: 'helipad', x: air ? W / 2 - 140 : 120, z: air ? cz - 10 : -60, w: 26, d: 26, h: 0 });
	// the watchtowers at the corners
	for (const [sx, sz] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) add({ type: 'tower', x: sx * (W / 2 - 6), z: sz * (D / 2 - 6), w: 3.6, d: 3.6, h: 9 });
	// the airfield: the runway along the back, a taxiway, the apron, hangars and the control tower
	let rw = null, apron = null;
	const hangars = [];
	if (air) {
		rw = add({ type: 'runway', x: 0, z: -D / 2 + 70, w: runway, d: 32, h: 0 });
		add({ type: 'taxiway', x: 0, z: -D / 2 + 130, w: runway - 80, d: 18, h: 0 });
		for (const t of [-1, 0, 1]) add({ type: 'taxiway', x: t * (runway / 2 - 80), z: -D / 2 + 100, w: 18, d: 60, h: 0, link: true });
		apron = add({ type: 'apron', x: W / 2 - 330, z: -D / 2 + 185, w: 300, d: 80, h: 0 });
		for (let i = 0; i < 3; i++) hangars.push(add({ type: 'hangar', x: apron.x - 100 + i * 100, z: apron.z + 72, w: 44, d: 48, h: 15, yaw: Math.PI }));
		add({ type: 'control', x: apron.x - 210, z: apron.z + 20, w: 8, d: 8, h: 19 });
	}
	// where things are parked, and what
	const parked = [];
	// (nose out from the shed, ready to go)
	const motor = ['tank', 'tank', 'apc', 'apc', 'jeep', 'jeep', 'jeep', 'truck'];
	motor.forEach((k, i) => parked.push({ kind: k, x: mp.x - mp.w / 2 + 6 + i * (mp.w - 12) / (motor.length - 1), z: mp.z + (k === 'tank' || k === 'apc' || k === 'truck' ? 15 : 13), yaw: 0 }));
	parked.push({ kind: 'heli', x: hp.x, z: hp.z, yaw: r() * 6.283 });
	if (!air) parked.push({ kind: 'heli', x: hp.x + 40, z: hp.z, yaw: r() * 6.283 });
	if (air) {
		parked.push({ kind: 'heli', x: hp.x + 38, z: hp.z, yaw: r() * 6.283 });
		hangars.forEach((h, i) => parked.push({ kind: 'jet', x: h.x, z: h.z - h.d / 2 - (i === 1 ? 4 : 16), yaw: Math.PI, apron: true }));
		parked.push({ kind: 'jet', x: apron.x + 120, z: apron.z - 10, yaw: Math.PI / 2, apron: true });
		// two more on the stands between the hangars, noses at their stop bars
		for (const x of [-50, 50]) parked.push({ kind: 'jet', x: apron.x + x, z: apron.z + 18, yaw: 0, apron: true });
	}
	// where soldiers are posted: the gate, the towers, a patrol inside the fence, the armoury,
	// the flight line
	const posts = [];
	posts.push({ kind: 'gate', x: gx - 3, z: front + 4, yaw: 0, n: 2, r: 30 });
	B.filter((b) => b.type === 'tower').forEach((t, i) => posts.push({ kind: 'tower', x: t.x, z: t.z, y: t.h + 0.3, yaw: Math.atan2(t.x, t.z), n: 1, r: 8, order: i }));
	const ix = W / 2 - 28, iz = D / 2 - 28;
	posts.push({ kind: 'patrol', x: 0, z: 0, n: 2, r: Math.max(W, D) / 2 + 20, loop: [[-ix, iz], [ix, iz], [ix, -iz], [-ix, -iz]] });
	const arm = B.find((b) => b.type === 'armoury');
	posts.push({ kind: 'armoury', x: arm.x, z: arm.z + arm.d / 2 + 3, yaw: 0, n: 1, r: 20 });
	if (air) posts.push({ kind: 'flightline', x: apron.x, z: apron.z, yaw: Math.PI, n: 1, r: 60, loop: [[apron.x - 120, apron.z], [apron.x + 120, apron.z]] });
	// the perimeter (the gate's gap left open)
	const fence = { w: W, d: D, gate: { x: gx, w: 14 } };
	return { kind, W, D, buildings: B, parked, posts, fence, runway: rw, apron, gate: { x: gx, z: front } };
}
// the interior frames of a layout's buildings, in the base's frame (a builder's hook)
export const interiorFrames = (L) => L.buildings.filter((b) => b.interior).map((b) => ({ builder: b.interior, type: b.type, x: b.x, z: b.z, yaw: b.yaw || 0, w: b.w, d: b.d, h: b.h, floors: b.floors || 1, floorH: b.h / (b.floors || 1) }));

// ---------- siting ----------
// sampler: { height(x, z), water(x, z) -> bool, urban(x, z) -> 0..1, built(x, z, r) -> count of
// buildings, road(x, z) -> metres to a freeway or highway (Infinity if unknown), coast(x, z) ->
// metres to the shore (Infinity if unknown) }. A site: centre, yaw, and the layout's size.
// Returns { ok, score, floor: { a, b, c } (pad height = a*lx + b*lz + c in the base frame), why }
export function siteScore(S, cx, cz, yaw, W, D, opts = {}) {
	const n = opts.n || 7, cs = Math.cos(yaw), sn = Math.sin(yaw), pts = [];
	const tol = opts.tol ?? (W > 800 ? 7 : 5);
	let wet = 0, urban = 0, built = 0;
	for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
		const lx = (i / (n - 1) - 0.5) * W, lz = (j / (n - 1) - 0.5) * D;
		const x = cx + lx * cs + lz * sn, z = cz - lx * sn + lz * cs, h = S.height(x, z);
		if (!Number.isFinite(h)) return { ok: false, score: -1, why: 'no ground' };
		if (S.water?.(x, z) || h < 0.8) wet++;
		urban = Math.max(urban, S.urban?.(x, z) || 0);
		pts.push([lx, lz, h]);
	}
	if (wet) return { ok: false, score: -1, why: 'water' };
	if (urban > 0.18) return { ok: false, score: -1, why: 'town' };
	built = S.built?.(cx, cz, Math.hypot(W, D) / 2) || 0;
	if (built > (opts.builtMax ?? 3)) return { ok: false, score: -1, why: 'homes' };
	// the plane through the ground (least squares), and how far the ground strays from it
	let sx = 0, sz = 0, sh = 0, sxx = 0, szz = 0, sxh = 0, szh = 0;
	for (const [x, z, h] of pts) { sx += x; sz += z; sh += h; sxx += x * x; szz += z * z; sxh += x * h; szh += z * h; }
	const N = pts.length, mx = sx / N, mz = sz / N, mh = sh / N;
	const a = (sxh / N - mx * mh) / Math.max(1e-6, sxx / N - mx * mx), b = (szh / N - mz * mh) / Math.max(1e-6, szz / N - mz * mz);
	const grade = Math.hypot(a, b);
	let lo = Infinity, hi = -Infinity;
	for (const [x, z, h] of pts) { const res = h - (a * (x - mx) + b * (z - mz) + mh); lo = Math.min(lo, res); hi = Math.max(hi, res); }
	const spread = hi - lo;
	if (grade > 0.025) return { ok: false, score: -1, why: 'slope' };
	if (spread > tol) return { ok: false, score: -1, why: 'rough' };
	// (the pad stands just above all the ground under it: the low spots are filled)
	const c = mh - a * mx - b * mz + hi + 0.15;
	const road = S.road?.(cx, cz) ?? Infinity, coast = S.coast?.(cx, cz) ?? Infinity;
	const access = Math.max(road < 3000 ? 1 - road / 3000 : 0, coast < 4000 ? 0.6 * (1 - coast / 4000) : 0);
	const score = 1 - spread / tol * 0.5 - grade * 8 - built * 0.05 - urban + access * 0.6;
	return { ok: true, score, floor: { a, b, c }, spread, grade, access, why: 'ok' };
}
// try a candidate where it is, then nudged in a spiral and turned, keeping the best
export function chooseSite(S, cand, W, D, opts = {}) {
	let best = null;
	const tries = opts.tries ?? 18, step = opts.step ?? Math.max(W, D) * 0.6;
	for (let k = 0; k < tries; k++) {
		const ang = k * 2.4, rad = k ? step * Math.sqrt(k) * 0.55 : 0;
		const x = cand.x + Math.cos(ang) * rad, z = cand.z + Math.sin(ang) * rad;
		for (const dy of [0, 0.5, -0.5, 1.2]) {
			const yaw = (cand.yaw || 0) + dy, s = siteScore(S, x, z, yaw, W, D, opts);
			if (s.ok && (!best || s.score > best.score)) best = { ...s, x, z, yaw };
		}
		if (best && best.score > 0.7) break;
	}
	return best;
}

// base frame <-> world
export function toLocal(B, x, z) { const c = Math.cos(B.yaw), s = Math.sin(B.yaw), dx = x - B.x, dz = z - B.z; return [dx * c - dz * s, dx * s + dz * c]; }
export function toWorld(B, lx, lz) { const c = Math.cos(B.yaw), s = Math.sin(B.yaw); return [B.x + lx * c + lz * s, B.z - lx * s + lz * c]; }
export const padAt = (B, lx, lz) => B.floor.a * lx + B.floor.b * lz + B.floor.c;

// ---------- who may stand where ----------
// a stationed side (militia, soldiers) only at its posts: within a post's reach of a base, a
// checkpoint or a compound. posts: [{ x, z, r, fid? }] in the world. Everyone else as before.
export function mayStation(F, x, z, posts = []) {
	if (!F?.stationed) return true;
	return posts.some((p) => (!p.fid || p.fid === F.id) && Math.hypot(p.x - x, p.z - z) <= (p.r || 60));
}
// the militias' compounds: one in about a third of the rural cells, fixed where they are
// (cells of `cell` metres in a world's frame; seed: the world's)
export function militiaCamps(x, z, seed = 0, reach = 1500, cell = 1400) {
	const out = [], i0 = Math.floor((x - reach) / cell), i1 = Math.floor((x + reach) / cell), j0 = Math.floor((z - reach) / cell), j1 = Math.floor((z + reach) / cell);
	for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
		if (hash2(i, j, seed ^ 0x3a11) > 0.32) continue;
		out.push({ id: `m${i}_${j}`, x: (i + 0.2 + hash2(i, j, seed ^ 0x3a12) * 0.6) * cell, z: (j + 0.2 + hash2(i, j, seed ^ 0x3a13) * 0.6) * cell, r: 70, fid: 'ridgeback' });
	}
	return out;
}

// ---------- the garrison ----------
// how many stand at each post: a phone posts fewer (the gate and the patrol first)
export function garrisonPlan(L, { phone = false, budget = 14, alert = false } = {}) {
	const order = ['gate', 'patrol', 'tower', 'armoury', 'flightline'];
	const posts = [...L.posts].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.order || 0) - (b.order || 0));
	const out = [];
	let left = Math.min(budget, phone ? 5 : 12) + (alert ? 2 : 0);
	for (const p of posts) {
		if (left <= 0) break;
		if (phone && p.kind === 'tower' && p.order > 1) continue;
		const n = Math.min(left, p.n + (alert && p.kind === 'gate' ? 1 : 0));
		out.push({ post: p, n });
		left -= n;
	}
	return out;
}

// ---------- the dispatch ----------
// what each kind of trouble draws, and from how far
export const FORCES = Object.freeze({
	gang: { reach: 15000, road: ['jeep', 'apc'], air: ['heli'], troops: 4, cool: 240 },
	riot: { reach: 15000, road: ['apc', 'apc'], air: ['heli'], troops: 6, cool: 300 },
	boss: { reach: 40000, road: ['tank', 'apc', 'jeep'], air: ['heli', 'jet'], troops: 6, cool: 420 },
	invasion: { reach: 160000, road: ['tank', 'tank', 'apc', 'apc', 'jeep'], air: ['heli', 'heli', 'jet'], troops: 10, cool: 600 },
	wanted: { reach: 12000, road: ['jeep', 'apc'], air: ['heli'], troops: 4, cool: 200 },
});
export const SPEED = { road: 16, heli: 55, jet: 190 };
// event: { kind, x, z, severity (1..3), t (seconds now) }; bases: [{ id, x, z, kind, busyUntil,
// units: { tank, apc, jeep, heli, jet } }]. The nearest ready base answers; by road when it is
// near enough for a convoy and has the vehicles, by air when far or the road force is out.
// Returns { base, mode, units, troops, eta, dist } or null.
export function planDispatch(event, bases, { roadReach = 25000 } = {}) {
	const F = FORCES[event.kind];
	if (!F) return null;
	const t = event.t || 0, sev = Math.max(1, Math.min(3, event.severity || 1));
	const ready = bases.filter((b) => (b.busyUntil || 0) <= t).map((b) => ({ b, d: Math.hypot(b.x - event.x, b.z - event.z) })).filter((q) => q.d <= F.reach).sort((p, q) => p.d - q.d);
	for (const { b, d } of ready) {
		const have = { ...(b.units || {}) };
		const take = (list) => { const got = []; for (const k of list) if ((have[k] || 0) > 0) { have[k]--; got.push(k); } return got; };
		const roadOK = d <= roadReach;
		let units = [], mode = 'air';
		if (roadOK) {
			units = take(F.road.slice(0, Math.max(1, Math.ceil(F.road.length * sev / 3))));
			if (units.length) mode = 'road';
		}
		// air support for a big trouble, or the only way there
		const air = take(F.air.slice(0, roadOK ? (sev >= 2 ? F.air.length : 0) : Math.max(1, Math.ceil(F.air.length * sev / 3))));
		if (!units.length && !air.length) continue;
		if (!units.length) mode = 'air';
		const all = [...units, ...air];
		const slow = mode === 'road' ? SPEED.road : SPEED.heli;
		return { base: b.id, baseName: b.name, mode, units: all, troops: F.troops + (sev - 1) * 2, eta: Math.round(d / slow), dist: Math.round(d), cool: F.cool };
	}
	return null;
}
// the police: from the heat (combat/heat.js RESPONSE): cruisers for the officers, and the
// military asked to back them up at four stars and more (a helicopter at five)
export function policePlan(stars, officers, have = 0) {
	const need = Math.max(0, officers - have);
	return { cruisers: Math.ceil(need / 2), officers: need, backup: stars >= 4 ? (stars >= 5 ? 'air' : 'road') : null };
}
// an invasion: due every so often (minutes), from another region, aimed at a town near you
export function nextInvasion(r = Math.random) { return (25 + r() * 25) * 60; }
export function invasionPlan(target, r = Math.random, coastDir = null) {
	const a = coastDir ?? r() * Math.PI * 2, d = 2600 + r() * 900;
	return { from: { x: target.x + Math.cos(a) * d, z: target.z + Math.sin(a) * d }, to: { x: target.x, z: target.z }, squads: [4, 4, 3], vehicles: ['tank', 'apc', 'apc'], dir: a };
}
