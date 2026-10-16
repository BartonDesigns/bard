// The procedural grid towns' streets (bay/city.js raises their blocks on bay/styles.js's grid)
// in the shape the signs read (placement.js streetSigns): a polyline down the middle of each
// street, its width, its class and its name. The mapped city's roads carry their real names;
// these have none, so each gets one the way an American grid town names its streets: the
// streets one way numbered (12th Ave), the cross streets named for trees and presidents (Oak
// St, Jefferson St), every seventh a boulevard. Arterials and collectors follow the blocks'
// own rhythm in city.js (an arterial every seventh line, a collector every fourth), so the stop
// signs, the all-way stops and the signals fall where the traffic would put them.
//
// Plain numbers (no scene): tested in island/tools/integration.test.mjs.

const TREES = ['Oak', 'Maple', 'Elm', 'Walnut', 'Cedar', 'Pine', 'Laurel', 'Willow', 'Sycamore', 'Chestnut', 'Hawthorne', 'Magnolia', 'Juniper', 'Poplar', 'Alder', 'Madrone', 'Linden', 'Birch', 'Aspen', 'Cypress'];
const PEOPLE = ['Lincoln', 'Washington', 'Jefferson', 'Madison', 'Monroe', 'Adams', 'Jackson', 'Grant', 'Franklin', 'Hamilton', 'Garfield', 'Harrison', 'Taylor', 'Polk', 'Pierce', 'Fillmore'];
const BOULEVARDS = ['Mission', 'Central', 'Valley', 'Park', 'University', 'Foothill', 'Bayshore', 'Industrial', 'Civic Center', 'Arroyo'];
const h2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
export function ordinal(n) {
	const t = n % 100;
	return n + (t > 10 && t < 14 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');
}
// a grid line's name and class. axis 'z': the street runs along grid z (a constant grid x, line
// i); 'x': along grid x (line j). key: the grid's own (its bearing and style), so two towns differ
export function gridName(axis, n, key = 0) {
	const off = Math.floor(h2(key, 7.3) * 40);
	if (axis === 'z') {
		if (((n % 7) + 7) % 7 === 0) return { name: BOULEVARDS[(((Math.floor(n / 7) + off) % BOULEVARDS.length) + BOULEVARDS.length) % BOULEVARDS.length] + ' Blvd', cls: 'secondary' };
		return { name: ordinal((((n + off) % 48) + 48) % 48 + 1) + ' Ave', cls: 'residential' };
	}
	const pool = h2(key, 3.1) < 0.5 ? TREES : PEOPLE, k = (((n + off) % pool.length) + pool.length) % pool.length;
	return { name: pool[k] + ' St', cls: ((n % 4) + 4) % 4 === 0 ? 'tertiary' : 'residential' };
}
// the streets of the grid round (cx, cz) within R: [{ drive, cls, pts, w, name, grid }]. G: the
// world's grid helpers { urbanAt(x, z) -> { u, a, s }, inside(x, z) (mapped for real), BLOCKS,
// toGrid(x, z, a, s), fromGrid(gx, gz, a, s) }
export function gridStreets(cx, cz, R, G) {
	const out = [];
	const U0 = G.urbanAt?.(cx, cz);
	if (!U0) return out;
	// (the grids present round here, as city.js finds them: sampled across the reach)
	const grids = new Map();
	for (let dz = -R; dz <= R; dz += R / 3) for (let dx = -R; dx <= R; dx += R / 3) {
		const U = G.urbanAt(cx + dx, cz + dz);
		if (!U || U.u < 0.15) continue;
		const a = Math.round(U.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2;
		grids.set(Math.round(a * 1000) + ':' + U.s, [a, U.s]);
	}
	for (const [key, [a, s]] of grids) {
		const B = G.BLOCKS[s];
		if (!B) continue;
		const [BX, BZ, ST] = B, k = +key.split(':')[0] + s * 7919;
		const [gx, gz] = G.toGrid(cx, cz, a, s);
		const i0 = Math.floor((gx - R) / BX), i1 = Math.ceil((gx + R) / BX), j0 = Math.floor((gz - R) / BZ), j1 = Math.ceil((gz + R) / BZ);
		// a point of the grid is a street of this grid if the town is there, the grid there is this
		// one and the real map does not cover it
		const ok = (x, z) => {
			if (Math.hypot(x - cx, z - cz) > R + 60 || G.inside?.(x, z)) return false;
			const U = G.urbanAt(x, z);
			return !!U && U.u >= 0.15 && U.s === s && Math.abs(Math.round(U.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2 - a) < 0.01;
		};
		const line = (axis, n, from, to, step) => {
			const { name, cls } = gridName(axis, n, k);
			let pts = [];
			const flush = () => { if (pts.length >= 6) out.push({ drive: true, cls, pts, w: ST, name, grid: true }); pts = []; };
			for (let m = from; m <= to; m++) for (const half of [0, 0.5]) {
				if (half && m === to) continue;
				const g1 = (m + half) * step + ST / 2, [x, z] = axis === 'z' ? G.fromGrid(n * BX + ST / 2, g1, a, s) : G.fromGrid(g1, n * BZ + ST / 2, a, s);
				if (ok(x, z)) pts.push(x, z); else flush();
			}
			flush();
		};
		for (let i = i0; i <= i1; i++) line('z', i, j0, j1, BZ);
		for (let j = j0; j <= j1; j++) line('x', j, i0, i1, BX);
	}
	return out;
}
