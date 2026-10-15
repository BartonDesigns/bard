// What a walk-in commercial block is (bay/commercial.js builds its fit-out from this), from its
// kind, size and where it stands, so the same block is always the same place. Pure, so the
// economy (establishments.js) can give it a sign that agrees with what is inside.

const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// b: { x, z, w, d, kind } with kind 5 office, 6 retail (the real boxes' codes)
export function venueOf(b) {
	const r = hh(Math.round(b.x * 0.37), Math.round(b.z * 0.29)), area = b.w * b.d, deep = Math.min(b.w, b.d);
	if (b.kind === 5) return area > 1400 && r < 0.18 && deep > 24 ? 'cinema' : r < 0.2 ? 'restaurant' : r < 0.3 ? 'cafe' : 'office';
	if (area > 900 && deep > 24 && r < 0.12) return 'bowling';
	if (area > 900 && deep > 24 && r < 0.2) return 'cinema';
	if (r < 0.36) return 'restaurant';
	if (r < 0.54) return 'cafe';
	if (r < 0.575 && area < 700) return 'tattoo';
	if (r < 0.62 && area > 250) return 'arcade';
	return 'shop';
}
