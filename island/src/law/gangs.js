// The gangs' ground: which streets a gang holds, where its people hang out, how many, and how
// they take to a rival or a patrol car. Pure rules (no three, no DOM); law/index.js puts the
// corner crews on the street through combat's squads.
//
// Territory follows the regions people live in (people/moral-regions.js, the area-code groups
// and the globe cells): a region's trouble (its town's situation) and its morality tally
// (combat/morality.js createCommons) say how much of it the gangs hold. The ground is cut into
// cells a few blocks across; neighbouring cells mostly share an owner (the owner is drawn on a
// coarser grid), so a gang holds a stretch of streets and where two stretches meet there is a
// border, where trouble starts. Low-morality regions hold more ground and recruit faster.
// Militia keep to the outskirts and the country: never in a town.

export const GANGS = Object.freeze(['copperline', 'glasshouse']);
export const CELL = 420;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// a seeded 0..1 from a region and two cell numbers
export function cellHash(region, i, j, salt = 0) {
	let h = 2166136261 ^ salt;
	for (const c of String(region)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	h = Math.imul(h ^ (i | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h ^ (j | 0), 0xc2b2ae35); h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}
// how far a region has gone wrong: 0 decent .. 1 lawless (its tally's law and protect axes)
export function lowMorality(tally) {
	if (!tally) return 0;
	return clamp(-((tally.law || 0) + (tally.protect || 0)) / 2 / 40);
}

// who holds the ground at (x, z): { gang, strength 0..1, border, cell, low } or null where it
// is not town. opts: { trouble (the town's, 0..1), tally (the region's), urban (0..1) }
export function territoryAt(region, x, z, { trouble = 0.3, tally = null, urban = 1 } = {}) {
	if (urban < 0.3) return null;
	const low = lowMorality(tally);
	const presence = clamp(trouble * 0.9 + low * 0.45 - 0.05, 0, 0.85);
	const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
	const held = (a, b) => cellHash(region, a, b, 1) < presence;
	const owner = (a, b) => GANGS[cellHash(region, Math.floor(a / 3), Math.floor(b / 3), 2) < 0.5 ? 0 : 1];
	if (!held(i, j)) return { gang: null, strength: 0, border: false, cell: [i, j], low };
	const gang = owner(i, j);
	let border = false;
	for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (held(i + a, j + b) && owner(i + a, j + b) !== gang) border = true;
	const strength = clamp((presence - cellHash(region, i, j, 1)) / Math.max(0.05, presence) * 0.7 + low * 0.3);
	return { gang, strength: Math.round(strength * 100) / 100, border, cell: [i, j], low };
}

// how many hang out on a corner: more where they are strong, more in the evening
export function cornerSize(T, { phone = false, hour = 12 } = {}) {
	if (!T?.gang) return 0;
	const evening = hour >= 17 || hour < 3;
	const n = 2 + (T.strength > 0.5 ? 1 : 0) + (evening ? 1 : 0);
	return Math.min(phone ? 3 : 4, n);
}
// a recruit joins a corner now and then; faster where the region has gone wrong
export function recruits(size, max, low, dt, r = Math.random) {
	if (size >= max) return size;
	return r() < (0.003 + low * 0.012) * dt ? size + 1 : size;
}

// street corners from the roads round a point: where two or more streets' ends meet, or one
// street's end lies on another (rounded to a few metres). roads: [{ pts: [x, z, ...], cls }]
export function junctions(roads, snap = 6) {
	const ends = new Map(), out = [];
	const key = (x, z) => `${Math.round(x / snap)},${Math.round(z / snap)}`;
	for (const r of roads) {
		if (!r?.pts || r.pts.length < 4 || /footway|path|steps|cycleway|pedestrian|track|motorway/.test(r.cls || '')) continue;
		for (const k of [0, r.pts.length - 2]) {
			const x = r.pts[k], z = r.pts[k + 1], id = key(x, z);
			const e = ends.get(id);
			if (e) e.n++; else ends.set(id, { x, z, n: 1 });
		}
	}
	for (const e of ends.values()) if (e.n >= 2) out.push({ x: e.x, z: e.z, n: e.n });
	return out;
}
// which corners a crew uses: in the window of distances, the same ones each visit (by place)
export function pickCorners(points, region, eye, { min = 60, max = 170, n = 1 } = {}) {
	return points
		.map((p) => ({ ...p, d: Math.hypot(p.x - eye.x, p.z - eye.z), h: cellHash(region, Math.round(p.x / 8), Math.round(p.z / 8), 3) }))
		.filter((p) => p.d >= min && p.d <= max && p.h < 0.45)
		.sort((a, b) => a.h - b.h)
		.slice(0, n);
}

// how a corner crew takes what comes: provoked or in a fight, they fight; a rival crew with
// no patrol about, they square up; a patrol car pulling up and nobody provoked them, they
// drift off round the corner; otherwise they hold the corner and watch
export function gangStance({ provoked = false, alert = false, rivalsNear = 0, policeNear = 0, outnumbered = false } = {}) {
	if (provoked || alert) return outnumbered ? 'scatter' : 'fight';
	if (policeNear) return 'disperse';
	if (rivalsNear) return 'square-up';
	return 'hold';
}
// a gang war starting by itself: mostly where two gangs' ground meets
export function warChance(T) {
	if (!T?.gang) return 0;
	return T.border ? 0.25 + T.strength * 0.25 : 0.03 + T.low * 0.05;
}

// a militia compound only out of town: open country, few buildings, well away from any town
export function militiaAllowed({ urban = 0, built = 0, townD = Infinity } = {}) {
	return urban < 0.08 && built <= 2 && townD > 1500;
}
