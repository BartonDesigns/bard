// The evening's lights, decided: which households have which lights outside, when each comes
// on and goes off, and how bright it is at a given hour. Plain numbers only (no three.js), so
// the city's shader (city.js, the far houses' porch and garage lights), the lights drawn close
// by (nightlights.js) and the tests (tools/night-lighting.test.mjs) all read the same plan.
//
// Every choice comes from the house's own seed (its position, as houseplan.js houseSeed), so a
// household keeps its lights from one visit to the next: the porch light on a timer till half
// past ten next door, the one across the street left on all night, the solar stakes along a
// bed that fade by two in the morning, the motion light over the garage that wakes as you pass.

// How strong each kind of lamp is: its light in the interiors' units (lightbake.js: I over the
// distance squared is the light falling on a surface facing it; 1 is a well lit room's floor).
// The moon gives about 0.18 on what faces it, so a porch light out-lights it for a few metres
// round it and a path light only in its own small pool.
export const NIGHT_I = { porch: 3, garage: 4.5, path: 0.5, solar: 0.03, tree: 40, wash: 8 };

// The hour and the night for every shader that switches lamps by the plan (city.js): x the late
// hour (lateHour), y the sky's night (0 day .. 1 night). A plain { x, y } is what three reads.
export const NIGHT_U = { uNL: { value: { x: 12, y: 0 } } };

// the city's kinds (city.js KIND), the ones that matter here
export const K = { row: 0, house: 1, tower: 2, office: 3, retail: 6, garage: 8, shop: 9, bay: 10, houseGarageL: 11, houseGarageR: 12, apt: 14 };
const HOUSES = [K.row, K.house, K.bay, K.houseGarageL, K.houseGarageR];

// a house's seed from where it stands (houseplan.js houseSeed: the same houses everywhere)
export const nightSeed = (x, z) => (Math.imul(Math.round(x * 2) | 0, 73856093) ^ Math.imul(Math.round(z * 2) | 0, 19349663)) >>> 0;
// a roll from a seed and a channel, 0..1
export function roll(seed, ch) {
	let h = Math.imul((seed ^ Math.imul(ch + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b);
	h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

// the hour as evening runs into the small hours: noon 12 .. 23 .. midnight 24 .. 6 am 30 .. 36
export const lateHour = (hours) => (hours < 12 ? hours + 24 : hours);
// all night (on until daylight takes it off)
export const ALL_NIGHT = 31;

// The colours of the lamps (linear, before strength): a warm incandescent porch light, a
// softer 3000 K LED, a cool 4000 K LED (the newer houses), the solar stakes' cold white.
export const COLOURS = [[1, 0.62, 0.3], [1, 0.74, 0.46], [0.86, 0.88, 0.9], [0.62, 0.74, 1]];

// When a light is on: switched on as the evening darkens past its own point (a photocell or a
// timer set for dusk: onK of the sky's night, 0 day .. 1 night), off at its own late hour (a
// timer, bedtime), easing over a few minutes either way so nothing pops. 0..1.
export function lampLevel(onK, offAt, hours, night) {
	if (!offAt) return 0;
	const up = smooth(onK, onK + 0.12, night);
	const late = lateHour(hours);
	const down = offAt >= ALL_NIGHT ? 1 : 1 - smooth(offAt, offAt + 0.08, late);
	return up * down;
}
// A solar stake: on once it is properly dark, as bright as its battery had sun for, fading
// through the night as the battery runs down (a weak one is out by midnight, a good one is dim
// but still there at dawn). charge 0..1.
export function solarLevel(charge, hours, night) {
	if (charge <= 0) return 0;
	const up = smooth(0.45, 0.65, night);
	const t = Math.max(0, lateHour(hours) - 19);                     // hours since about dusk
	const life = 2.5 + charge * 9;                                    // hours of light in it
	return up * (0.35 + 0.65 * charge) * Math.max(0, 1 - t / life) ** 0.7;
}
// A motion light: wakes when something comes within reach, stays on its minute, then goes.
// since: seconds since it last saw anything (Infinity if never). 0..1.
export function motionLevel(since, night, hold = 45) {
	if (night < 0.35 || !(since < hold + 2)) return 0;
	return since < hold ? 1 : 1 - (since - hold) / 2;
}
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// One household's lights outside. o: the city's lot ({ kind, w, d, h, cond }), seed: its
// seed. Nothing for a boarded or burnt house (cond 1, 2), nothing but the porch on a run-down
// one. Returns plain numbers:
//   porch    its light's late hour off (0: no porch light lit), porchCol its colour, side
//            which side of the door it hangs (-1 left, 1 right)
//   onK      when the household's lights come on (the sky's night)
//   path     path lights along the front walk (0, 2..6), pathOff
//   solar    solar stakes along the front bed (0, 4..9), charge (0..1)
//   garage   the light over the garage doors (late hour off, 0 none), motion (a motion light)
//   tree     an uplight in the front yard's tree (late hour off, 0 none)
//   wash     uplights washing the front wall (0, 2, 3: nicer houses), washOff
export function housePlan(o, seed) {
	const base = Math.floor(o.kind), cond = o.cond | 0;
	const P = { porch: 0, porchCol: 0, side: 1, onK: 0, path: 0, pathOff: 0, solar: 0, charge: 0, garage: 0, motion: false, tree: 0, wash: 0, washOff: 0 };
	const r = (k) => roll(seed, k);
	// a garage on its own: a light over its doors, or a motion light, or nothing
	if (base === K.garage) {
		if (cond === 1 || cond === 2) return P;
		P.onK = 0.18 + r(1) * 0.32;
		const g = r(12);
		if (g < 0.25) P.motion = true;
		else if (g < 0.55) P.garage = r(13) < 0.4 ? ALL_NIGHT : 22 + r(13) * 3;
		return P;
	}
	if (!HOUSES.includes(base) || cond === 1 || cond === 2) return P;
	const front = o.kind - base > 0.005 || base === K.row;           // a front door on the street side
	const big = o.w * o.d > 190 || o.h > 7.5;
	P.onK = 0.18 + r(1) * 0.32;
	// the porch: most houses leave it on in the evening, some all night, some never bother
	if (front && r(2) < (cond ? 0.55 : 0.84)) {
		const t = r(3);
		P.porch = t < 0.3 ? ALL_NIGHT : t < 0.55 ? 22 + r(4) * 1.5 : t < 0.85 ? 23.5 + r(4) * 1.5 : 25 + r(4) * 2;
		const c = r(5);
		P.porchCol = c < 0.45 ? 0 : c < 0.8 ? 1 : 2;
		P.side = r(40) < 0.5 ? -1 : 1;
	}
	if (cond) return P;
	if (!front || base === K.row) return P;                           // the row houses open straight onto the sidewalk
	// path lights along the walk (low bollards or mushroom caps), on a timer with the porch or later
	if (r(6) < (big ? 0.6 : 0.32)) { P.path = 2 + Math.floor(r(7) * (big ? 5 : 3)); P.pathOff = r(8) < 0.35 ? ALL_NIGHT : 22.5 + r(8) * 3; }
	// solar stakes: a cheap row along the bed by the walk or the house
	if (r(9) < 0.38) { P.solar = 4 + Math.floor(r(10) * 6); P.charge = 0.25 + r(11) * 0.75; }
	// the garage: a light over its doors, on with the porch; some are motion lights instead
	if (base === K.houseGarageL || base === K.houseGarageR || o.garage) {
		const g = r(12);
		if (g < 0.22) P.motion = true;
		else if (g < 0.7) P.garage = r(13) < 0.4 ? ALL_NIGHT : 22 + r(13) * 3;
	}
	// the front yard's tree lit from below (a landscape designer's touch), and the front
	// wall washed by a pair of uplights on the nicer houses
	if (r(14) < (big ? 0.45 : 0.16)) P.tree = r(15) < 0.3 ? ALL_NIGHT : 22.5 + r(15) * 2.5;
	if (big && r(16) < 0.4) { P.wash = r(17) < 0.6 ? 2 : 3; P.washOff = r(18) < 0.3 ? ALL_NIGHT : 23 + r(18) * 2; }
	return P;
}

// A building that is not a house: whether its front is washed by uplights from the ground
// (offices, the shopping streets, the towers, apartments), how many and how far apart, and
// till when; a civic building (a station, a hospital, a landmark) always is, all night.
//   wash: 0, or the spacing in metres between uplights; washOff, washCol (0 warm, 1 cool)
export function buildingPlan(o, seed, civic = false) {
	const base = Math.floor(o.kind), cond = o.cond | 0;
	const P = { wash: 0, washOff: 0, washCol: 0, onK: 0.2 + roll(seed, 21) * 0.25, sides: 1 };
	if (cond === 1 || cond === 2) return P;
	const r = (k) => roll(seed, k);
	if (civic) { P.wash = 4.5 + r(22) * 2; P.washOff = ALL_NIGHT; P.washCol = r(23) < 0.5 ? 0 : 1; P.sides = 1; return P; }
	const chance = base === K.tower ? 0.45 : base === K.office ? 0.4 : base === K.retail ? 0.3 : base === K.shop ? 0.18 : base === K.apt ? 0.15 : 0;
	if (!chance || o.h < 4 || Math.max(o.w, o.d) < 8 || cond === 3 || r(24) >= chance) return P;
	P.wash = base === K.tower ? 5 + r(25) * 3 : base === K.office ? 4 + r(25) * 3 : 3.5 + r(25) * 3;
	P.washOff = base === K.tower || r(26) < 0.4 ? ALL_NIGHT : 22 + r(26) * 3;
	P.washCol = base === K.tower ? (r(27) < 0.5 ? 1 : 0) : r(27) < 0.2 ? 1 : 0;
	P.sides = base === K.tower && r(28) < 0.6 ? 4 : 1;
	return P;
}

// The far houses' own lights, packed for the city's shader (one vec4 per building):
//   x the porch light's late hour off (0: none), y its colour index + onK (fraction),
//   z the garage light's late hour off (0: none), w which side of the door the porch light is
export function packHouse(P) {
	return [P.porch, P.porchCol + Math.min(0.99, P.onK), P.garage, P.side];
}
// where a house's front door is across its front, from its left edge (city.js doorKind:
// kind = base + 0.01 + door * 0.38), and whether it has one
export function doorAcross(o) {
	const f = o.kind - Math.floor(o.kind);
	if (f < 0.005) return null;
	const door = Math.min(1, Math.max(0, (f - 0.01) / 0.38));
	return 1.25 + door * (o.w - 2.5);
}
