// The engines' arithmetic, kept apart from the sound so it can be checked on its own: what each
// kind of engine is (its cylinders, its idle and red line, its gears), the gear it is in and
// how fast it turns for a speed and a throttle, a turbine's spool, and how a sound carries
// (its level and the air's dulling with distance, the Doppler shift of a passing one), and
// which few of many sources get a voice.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// cyl: cylinders (a four-stroke fires cyl / 2 times a turn); idle, red: rpm; gears: the speed
// (m/s) each gear reaches at the red line; fuel: petrol, diesel, turbine, rotor; pops: crackles
// off the throttle; rattle: a diesel's knock (0..1); whine: a turbo's or a gearbox's (0..1);
// burble: the uneven beat of a V engine (0..1); pipe: the exhaust's resonance (Hz); level: how
// loud it is beside the others; shift: seconds a gear change takes
export const PROFILES = {
	sedan: { cyl: 4, idle: 800, red: 6200, gears: [10, 18, 27, 37, 47, 58], fuel: 'petrol', burble: 0.1, pipe: 160, level: 0.75, shift: 0.22 },
	hatch: { cyl: 4, idle: 850, red: 6800, gears: [9, 16, 24, 33, 43, 52], fuel: 'petrol', burble: 0.05, pipe: 190, level: 0.7, shift: 0.2 },
	crossover: { cyl: 4, idle: 750, red: 6000, gears: [10, 18, 27, 36, 46, 56], fuel: 'petrol', burble: 0.1, pipe: 150, level: 0.75, shift: 0.24 },
	suv: { cyl: 6, idle: 700, red: 5800, gears: [10, 17, 26, 35, 44, 52], fuel: 'petrol', burble: 0.25, pipe: 130, level: 0.8, shift: 0.26 },
	pickup: { cyl: 8, idle: 650, red: 5400, gears: [10, 18, 27, 37, 48], fuel: 'petrol', burble: 0.6, pipe: 110, level: 0.85, shift: 0.28 },
	van: { cyl: 4, idle: 750, red: 5200, gears: [9, 16, 25, 34, 46], fuel: 'petrol', burble: 0.05, pipe: 150, level: 0.7, shift: 0.26 },
	delivery: { cyl: 4, idle: 750, red: 4200, gears: [7, 13, 21, 30, 40], fuel: 'diesel', rattle: 0.6, whine: 0.3, pipe: 120, level: 0.8, shift: 0.3 },
	sports: { cyl: 8, idle: 950, red: 8000, gears: [13, 22, 32, 43, 55, 67, 80], fuel: 'petrol', pops: true, burble: 0.45, pipe: 210, level: 0.9, shift: 0.12 },
	truck: { cyl: 6, idle: 600, red: 2300, gears: [3, 5, 8, 11, 15, 19, 24, 30], fuel: 'diesel', rattle: 1, whine: 0.6, pipe: 90, level: 1, shift: 0.45 },
	bus: { cyl: 6, idle: 600, red: 2300, gears: [5, 9, 14, 20, 27], fuel: 'diesel', rattle: 0.8, whine: 0.8, pipe: 95, level: 0.95, shift: 0.5 },
	apc: { cyl: 8, idle: 650, red: 2800, gears: [4, 8, 13, 19, 26], fuel: 'diesel', rattle: 0.9, whine: 0.5, burble: 0.3, pipe: 85, level: 1, shift: 0.45 },
	jeep: { cyl: 4, idle: 750, red: 4200, gears: [7, 13, 21, 29, 37], fuel: 'diesel', rattle: 0.7, whine: 0.2, pipe: 120, level: 0.85, shift: 0.3 },
	// a gas turbine's tank: the whine of the turbine over the clatter of its tracks
	tank: { cyl: 0, idle: 0.3, red: 1, gears: [5, 9, 13, 17], fuel: 'turbine', tracks: true, pipe: 80, level: 1, spool: [0.7, 0.9] },
	// a fighter's engine: spools up over seconds, winds down slower
	jet: { cyl: 0, idle: 0.22, red: 1, gears: [], fuel: 'turbine', pipe: 0, level: 1.2, spool: [0.3, 0.22] },
	heli: { cyl: 0, idle: 0, red: 1, gears: [], fuel: 'rotor', blades: 4, rotorHz: 4.6, pipe: 0, level: 1.1, spool: [0.25, 0.2] },
};
export const profileOf = (kind) => PROFILES[kind] || PROFILES.sedan;

// the gear and rpm for a speed (m/s) and a throttle (0..1); state carries the gear and a gear
// change in progress between frames. Returns { gear, rpm, k (0..1 between idle and red line),
// load (the throttle as the engine feels it: none during a change), shifted (+1 up, -1 down, 0) }
export function gearbox(p, speed, throttle, dt, state = {}) {
	const G = p.gears, v = Math.abs(speed), thr = clamp(throttle, 0, 1);
	if (!G.length) return { gear: 0, rpm: p.idle, k: 0, load: thr, shifted: 0 };
	let g = clamp(state.gear ?? 0, 0, G.length - 1), shifted = 0;
	state.shiftT = Math.max(0, (state.shiftT || 0) - dt);
	const rpmAt = (n) => (v / G[n]) * p.red;
	// up early at a gentle throttle, at the top of the rev range flat out; down when it labours
	if (state.shiftT <= 0) {
		const up = p.red * (0.5 + 0.42 * thr), down = p.red * (0.24 + 0.2 * thr);
		if (g < G.length - 1 && rpmAt(g) > up && speed >= 0) { g++; shifted = 1; }
		else if (g > 0 && rpmAt(g) < down && rpmAt(g - 1) < p.red * 0.9) { g--; shifted = -1; }
		if (shifted) state.shiftT = p.shift || 0.25;
	}
	if (speed < -0.3) g = 0;
	state.gear = g;
	// pulling away in first the clutch slips: the revs rise with the throttle before the speed does
	const slip = g === 0 ? (p.idle + thr * (p.red - p.idle) * 0.38) * clamp(1 - v / (G[0] * 0.55), 0, 1) : 0;
	let rpm = Math.max(p.idle, rpmAt(g), slip);
	if (state.rpm !== undefined) {
		// the revs follow, quicker up than down; through a change they fall to the next gear's
		const tc = state.shiftT > 0 ? 0.09 : rpm > state.rpm ? 0.06 : 0.12;
		rpm = state.rpm + (rpm - state.rpm) * (1 - Math.exp(-dt / tc));
	}
	rpm = clamp(rpm, p.idle * 0.9, p.red * 1.02);
	state.rpm = rpm;
	const load = state.shiftT > 0 ? 0 : thr;
	return { gear: g, rpm, k: clamp((rpm - p.idle) / (p.red - p.idle), 0, 1), load, shifted };
}

// a four-stroke's firing rate (Hz) at an rpm: the note an engine sings
export const firingHz = (p, rpm) => rpm / 60 * Math.max(1, p.cyl) / 2;

// a turbine's or a rotor's spool toward a target (0..1), up and down at their own rates (per s)
export function spool(n, target, dt, up = 0.3, down = 0.25) {
	const d = target - n, rate = d > 0 ? up : down;
	return clamp(n + Math.sign(d) * Math.min(Math.abs(d), rate * dt), 0, 1);
}

// level with distance (m): full within ref, then falling as 1 / distance, gone past far
export function distanceGain(d, ref = 6, far = 900) {
	if (d >= far) return 0;
	const g = ref / Math.max(ref, d);
	// (eased to nothing over the last fifth, so a voice does not cut off)
	return g * clamp((far - d) / (far * 0.2), 0, 1);
}
// the air takes the highs off with distance (Hz for a low-pass)
export const airCutoff = (d) => clamp(20000 / (1 + d / 110), 500, 20000);
// the Doppler factor for a source moving away at vr (m/s; toward you is negative)
export const doppler = (vr) => clamp(343 / (343 + clamp(vr, -150, 150)), 0.7, 1.45);

// how many voices: tight on a phone
export const BUDGET = { desktop: { engines: 6, traffic: 4, oneShots: 6 }, phone: { engines: 3, traffic: 2, oneShots: 3 } };
export const budgetFor = (phone) => phone ? BUDGET.phone : BUDGET.desktop;

// which sources get a voice: the loudest first (priority × how loud it would be), keeping those
// already sounding unless a newcomer is clearly louder (no flicker between two of a kind).
// list: [{ id, score }], held: Set of ids sounding now; returns a Set of at most n ids
export function pickVoices(list, held, n) {
	const ranked = list.filter((s) => s.score > 1e-4).map((s) => ({ id: s.id, r: s.score * (held.has(s.id) ? 1.5 : 1) }));
	ranked.sort((a, b) => b.r - a.r);
	return new Set(ranked.slice(0, n).map((s) => s.id));
}
