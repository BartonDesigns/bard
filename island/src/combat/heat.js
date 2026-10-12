// Wanted: how hard the police on Earth look for you after trouble. Offences add points; the
// points make stars (0 to 5); the stars say how many patrol officers come and how they are
// equipped. Out of their sight for long enough, the points ebb away; knocked out, it is over.
// Seeds from the arms core's heat (a theft the station noticed). Pure rules.

export const STARS = [0, 10, 35, 70, 120, 190];
export const OFFENCE = Object.freeze({ shots: 2, hitCivilian: 12, downCivilian: 25, hitPolice: 18, downPolice: 35, car: 14, prop: 1 });
// per star: officers at once, their armour, whether drones come
export const RESPONSE = [
	{ officers: 0, armour: 0, drones: 0 },
	{ officers: 2, armour: 0, drones: 0 },
	{ officers: 3, armour: 20, drones: 0 },
	{ officers: 4, armour: 40, drones: 1 },
	{ officers: 5, armour: 60, drones: 2 },
	{ officers: 6, armour: 90, drones: 3 },
];
const COOL_AFTER = 14;

export function createWanted(seedHeat = 0) {
	return { points: seedHeat >= 60 ? STARS[1] : 0, stars: seedHeat >= 60 ? 1 : 0, quiet: 0, seen: false, peak: 0 };
}
export const starsFor = (points) => { let s = 0; for (let i = 1; i < STARS.length; i++) if (points >= STARS[i]) s = i; return s; };

// an offence, where witnesses (or the police) could tell; shots alone never pass two stars
export function offend(W, kind, witnessed = true) {
	const n = OFFENCE[kind] || 0;
	if (!n || !witnessed) return W.stars;
	if (kind === 'shots' && W.points >= STARS[2]) return W.stars;
	W.points = Math.min(STARS[5] + 40, W.points + n);
	W.quiet = 0;
	W.stars = Math.max(W.stars, starsFor(W.points));
	W.peak = Math.max(W.peak, W.stars);
	return W.stars;
}
// time: seen by an officer keeps it hot; unseen, after a while the points ebb (a star at a time)
export function tickWanted(W, dt, seen) {
	W.seen = !!seen;
	if (!W.points) { W.stars = 0; return W.stars; }
	if (seen) { W.quiet = 0; return W.stars; }
	W.quiet += dt;
	if (W.quiet > COOL_AFTER) {
		W.points = Math.max(0, W.points - dt * (6 + W.points * 0.04));
		W.stars = starsFor(W.points);
	}
	return W.stars;
}
// knocked out, or out of Earth: the matter is closed
export function clearWanted(W) { W.points = 0; W.stars = 0; W.quiet = 0; }
export const responseFor = (stars) => RESPONSE[Math.max(0, Math.min(5, stars | 0))];
