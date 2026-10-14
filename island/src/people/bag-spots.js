// Where a bag gets left: on a bench, at a bus shelter, on a cafe or restaurant table, on a
// doorstep, on a park bench or a picnic table, and only failing all those, on the sidewalk.
// Each place is a spot: { kind, x, y, z, heading, place?, venue?, door?, id? }, gathered
// from what the world has built near you:
//   street.seatsNear(x, z, r)   the benches and bus shelters (bay/streetlife.js)
//   parks.seatsNear(x, z, r)    the park benches and picnic tables (bay/parkkit.js)
//   establishments(x, z, r)     the cafes, restaurants and shops: their doors and their
//                               tables. A small provider, so the economy's registry can be
//                               plugged in when it lands; until then the walk-in shops and
//                               cafes (bay/commercial.js doorsNear) stand in.
// Pure: no scene, no clock. people/npc-quests.js sets the bag down where it says.

const hashOf = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// how likely each kind is, when there is one about (a bench or a cafe more than the sidewalk)
export const SPOT_WEIGHT = Object.freeze({ bench: 1, shelter: 0.8, table: 0.7, doorstep: 0.6, park: 1.2, picnic: 0.6, sidewalk: 0.15 });
export const SPOT_KINDS = Object.freeze(Object.keys(SPOT_WEIGHT));

// what a spot is called: in a quest title ("left on a bench") and in what people say later
// ("grabbed a bag off a bench on the corner")
export function spotWords(spot) {
	const k = spot?.kind || 'sidewalk', venue = spot?.venue || 'cafe', place = spot?.place || '';
	switch (k) {
		case 'bench': return { left: 'on a bench', off: 'off a bench on the corner', name: 'bench' };
		case 'shelter': return { left: 'at the bus shelter', off: 'from the bus shelter', name: 'bus shelter' };
		case 'table': return { left: `on a ${venue} table`, off: `off a ${venue} table`, name: `${venue} table` };
		case 'doorstep': return { left: `on the doorstep of a ${venue}`, off: `off the doorstep of a ${venue}`, name: `${venue} doorstep` };
		case 'park': return { left: place ? `on a bench in ${place}` : 'on a park bench', off: place ? `off a bench in ${place}` : 'off a park bench', name: 'park bench' };
		case 'picnic': return { left: place ? `on a picnic table in ${place}` : 'on a picnic table', off: place ? `off a picnic table in ${place}` : 'off a picnic table in the park', name: 'picnic table' };
		default: return { left: 'on the sidewalk', off: 'off the sidewalk', name: 'sidewalk' };
	}
}

// where the bag itself sits on it: the seat of a bench (to one side), the ground at the back
// of a shelter, a table's chair, just off a doorstep. heading: the way the thing faces
export function restOn(spot) {
	const k = spot.kind, h = spot.heading || 0, y = spot.y ?? 0;
	// a point in the thing's own frame (lx across, lz forward), in the world
	const at = (lx, lz, up) => ({ x: spot.x + Math.cos(h) * lx + Math.sin(h) * lz, y: y + up, z: spot.z - Math.sin(h) * lx + Math.cos(h) * lz });
	const side = (hashOf(`${Math.round(spot.x)}:${Math.round(spot.z)}`) & 1) ? 0.5 : -0.5;
	if (k === 'bench' || k === 'park') return at(side, 0.02, 0.48);
	if (k === 'shelter') return at(-0.9, -0.35, 0);
	if (k === 'picnic') return at(side * 0.8, 0, 0.76);
	if (k === 'table') return { x: spot.x, y: y + (spot.h ?? 0.46), z: spot.z };
	if (k === 'doorstep') return at(0.6, 0.4, 0);
	return { x: spot.x, y, z: spot.z };
}
// where someone stands to set it down or pick it up: in front of it
export function standAt(spot) {
	const h = spot.heading || 0, f = spot.kind === 'shelter' ? 0.5 : spot.kind === 'table' ? 0 : 0.75;
	if (spot.kind === 'table') return { x: spot.x, z: spot.z };
	return { x: spot.x + Math.sin(h) * f, z: spot.z + Math.cos(h) * f };
}

// one spot from those about, between min and max metres from (x, z), by kind's weight.
// roll: 0..1 (the caller's dice). null when there is none (the sidewalk it is, then)
export function pickSpot(spots, { x = 0, z = 0, min = 12, max = 50, roll = Math.random() } = {}) {
	const ok = (spots || []).filter((s) => s && Number.isFinite(s.x) && Number.isFinite(s.z) && SPOT_WEIGHT[s.kind] !== undefined && s.kind !== 'sidewalk');
	const near = ok.filter((s) => { const d = Math.hypot(s.x - x, s.z - z); return d >= min && d <= max; });
	if (!near.length) return null;
	// a kind first (so fifty benches do not drown out the one cafe), then one of that kind
	const kinds = [...new Set(near.map((s) => s.kind))], total = kinds.reduce((a, k) => a + SPOT_WEIGHT[k], 0);
	let a = 0, kind = kinds[kinds.length - 1];
	const r = Math.max(0, Math.min(0.999999, roll));
	for (const k of kinds) { a += SPOT_WEIGHT[k] / total; if (r < a) { kind = k; break; } }
	const of = near.filter((s) => s.kind === kind);
	return of[Math.floor(((r * 7919) % 1) * of.length)] || of[0];
}

// the doors and tables of the cafes and restaurants about, from the walk-in shops
// (bay/commercial.js): [{ id, kind, name, door: { x, y, z, heading, inside, outside }, tables }]
export function commercialEstablishments(commercial) {
	return (x, z, r) => {
		const out = [];
		for (const D of commercial?.doorsNear?.(x, z, r) || []) {
			const kind = D.use === 'cafe' ? 'cafe' : D.use === 'restaurant' ? 'restaurant' : D.use === 'shop' ? 'shop' : null;
			if (!kind) continue;
			const B = D.B, tables = (B?.spots || []).filter((s) => s.table).map((s) => ({ x: s.x, y: s.y, z: s.z, h: s.h, heading: s.heading }));
			out.push({ id: `${kind}:${Math.round(D.x)}:${Math.round(D.z)}`, kind, name: `the ${kind}`, door: { x: D.outside.x, y: D.outside.y ?? D.y, z: D.outside.z, heading: D.heading, inside: D.inside, outside: D.outside }, tables });
		}
		return out;
	};
}

// every spot near (x, z): the street's, the parks', and the establishments'. world(): the
// live world; establishments: (x, z, r) -> [...] (use() swaps it for the economy's registry)
export function createPlaces({ world = () => null, establishments = null } = {}) {
	let E = establishments;
	const est = (x, z, r) => { try { return (E || commercialEstablishments(world()?.commercial))(x, z, r) || []; } catch { return []; } };
	function near(x, z, r = 60) {
		const W = world(), out = [];
		try { for (const s of W?.street?.seatsNear?.(x, z, r) || []) out.push({ ...s, kind: s.kind === 'shelter' ? 'shelter' : 'bench' }); } catch { /* no street here */ }
		try { for (const s of W?.parks?.seatsNear?.(x, z, r) || []) out.push({ ...s, kind: s.kind === 'picnic' ? 'picnic' : 'park' }); } catch { /* no parks here */ }
		for (const e of est(x, z, r)) {
			const venue = e.kind === 'restaurant' ? 'restaurant' : e.kind === 'shop' ? 'shop' : 'cafe', door = e.door;
			if (door && Number.isFinite(door.x)) out.push({ kind: 'doorstep', x: door.x, y: door.y ?? 0, z: door.z, heading: door.heading || 0, venue, id: e.id });
			// a table inside: reached through the door, and only near enough to see
			if (venue !== 'shop' && door?.inside && door?.outside) for (const t of (e.tables || []).slice(0, 4)) out.push({ kind: 'table', x: t.x, y: t.y ?? 0, z: t.z, h: t.h, heading: t.heading || 0, venue, id: e.id, door: { inside: door.inside, outside: door.outside } });
		}
		return out;
	}
	return {
		near,
		pick: (x, z, o = {}) => pickSpot(near(x, z, (o.max || 50) + 5), { x, z, ...o }),
		// (the economy's establishment registry, when it is there: (x, z, r) -> [{ id, kind, name, door, tables }])
		use(fn) { E = typeof fn === 'function' ? fn : null; },
	};
}
