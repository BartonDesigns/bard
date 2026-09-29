// How far into the summer fog a place lies: 1 on the sea-facing coast ranges, where the
// redwoods and Douglas-fir grow, falling to 0 some 30 km inland. Measured from the open
// Pacific shore (Point Reyes to Santa Cruz and round Monterey Bay) and, more weakly, from
// the Golden Gate, where the fog pours in over the Bay. (A straight line of longitude
// misses the Santa Cruz Mountains, whose redwoods run down to Santa Cruz.)

import { toWorld } from '../bay/geo.js';

const COAST = [
	[38.3, -123.05], [38.0, -122.99], [37.91, -122.69], [37.83, -122.53], [37.78, -122.51], [37.6, -122.5],
	[37.45, -122.44], [37.2, -122.41], [37.11, -122.3], [36.97, -122.05], [36.95, -121.9], [36.85, -121.8],
].map(([lat, lon]) => toWorld(lat, lon));
const GATE = toWorld(37.81, -122.48);
// the East Bay hills' crest, where the fog through the Gate stacks up (Redwood Regional Park)
const RIDGE = [[37.93, -122.27], [37.86, -122.22], [37.81, -122.17], [37.74, -122.11]].map(([lat, lon]) => toWorld(lat, lon));
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// metres to a line of [x, z] points
function toLine(L, x, z) {
	let best = 1e12;
	for (let i = 1; i < L.length; i++) {
		const a = L[i - 1], b = L[i], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
		const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
		best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
	}
	return best;
}
export const toCoast = (x, z) => toLine(COAST, x, z);
export function fogBelt(x, z) {
	const coast = 1 - sm(6000, 30000, toCoast(x, z));
	const gate = (1 - sm(4000, 22000, Math.hypot(x - GATE.x, z - GATE.z))) * 0.7;
	const ridge = (1 - sm(2500, 6000, toLine(RIDGE, x, z))) * 0.75;
	return Math.max(coast, gate, ridge);
}
