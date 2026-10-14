// A building's lasting name and its frame. The city's lots are made afresh every time the
// city round you is rebuilt (city.js), so a building is known by where it stands, rounded to
// half a metre: a surveyed or grown one where its map box stands (moved off the street and
// settled once, the same every load), a gridded one where its lot does (laid out the same
// every time). (lots.js marks the surveyed ones o.mapped as the list is made, before city.js
// gives the gridded houses and shops near you a src of their own.)

export const bid = (o) => 'b' + Math.round(o.x * 2) + ':' + Math.round(o.z * 2);

// the lot's frame: local x across, local z toward its front; y up from its foot
export function frameOf(o) {
	const c = Math.cos(o.a), s = Math.sin(o.a);
	return {
		c, s,
		w: (lx, lz) => [o.x + c * lx - s * lz, o.z + s * lx + c * lz],
		l: (x, z) => { const dx = x - o.x, dz = z - o.z; return [c * dx + s * dz, -s * dx + c * dz]; },
		dir: (lx, lz) => [c * lx - s * lz, s * lx + c * lz],
	};
}
// the four faces: 0 front (+z), 1 back (-z), 2 right (+x), 3 left (-x): their outward normal in
// the lot's frame, the length along them, and a point u along (from the left, seen from outside)
export const FACES = [[0, 1], [0, -1], [1, 0], [-1, 0]];
export const faceLen = (o, f) => (f < 2 ? o.w : o.d);
export const faceDepth = (o, f) => (f < 2 ? o.d : o.w) / 2;
// local (lx, lz) on face f at u along it
export function onFace(o, f, u) {
	const [nx, nz] = FACES[f], h = faceDepth(o, f);
	// (u runs left to right seen from outside: the tangent is the normal turned a quarter)
	return [nx * h + nz * u, nz * h - nx * u];
}
// u along face f of the local point (lx, lz)
export const uOn = (f, lx, lz) => { const [nx, nz] = FACES[f]; return nz * lx - nx * lz; };
// the lot's ground and top (city.js stands a building 1.2 m into the ground)
export const groundOf = (o) => o.y + 1.2;
export const topOf = (o) => o.y + o.h;
export const hash = (a, b) => { let h = Math.imul(Math.round(a * 7) | 0, 374761393) ^ Math.imul(Math.round(b * 7) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
