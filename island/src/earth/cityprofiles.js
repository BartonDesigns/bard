// City-level identity layered over the regional atlas. The atlas says what a region is like;
// these profiles preserve the few relationships that make a major city recognisable before a
// label appears. Keep them data-first so another city does not become another generator fork.

const RAD = Math.PI / 180;

const NYC = {
	id: 'nyc',
	look: 'nyc',
	// Manhattan's cross streets run roughly east-south-east; the avenues are square to them.
	angle: 29 * RAD,
	centres: new Set(['new-york', 'brooklyn']),
	sites: [
		// A compressed but correctly proportioned Central Park. It is still over four kilometres
		// long: the surrounding district streams it in rather than asking downtown to own it.
		{ kind: 'park', name: 'Central Park', lat: 40.7829, lon: -73.9654, w: 820, d: 4100, angle: 29 * RAD, noPond: true },
	],
};

export const CITY_PROFILES = Object.freeze({ nyc: NYC });

export function cityProfile(city) {
	if (!city) return null;
	const id = String(city.id || '').toLowerCase(), name = String(city.name || '').toLowerCase();
	return NYC.centres.has(id) || name === 'new york' || name === 'new york city' || name === 'brooklyn' ? NYC : null;
}

// Atlas places may name a borough as a city in its own right. The parent profile owns the
// continuous city so two full generators do not build through one another.
export function cityAbsorbed(city, nearby = []) {
	return String(city?.name || '').toLowerCase() === 'brooklyn' && nearby.some((c) => String(c?.name || '').toLowerCase() === 'new york');
}

// A borough is an ordinary-city cue, not a title-card trick. These deliberately broad bounds
// keep the generated district names stable while the detailed blocks remain procedural.
export function cityDistrict(profile, lat, lon) {
	if (profile?.id !== 'nyc') return '';
	if (lon < -74.05 && lat < 40.67) return 'Staten Island';
	if (lat > 40.695 && lon > -74.03 && lon < -73.91) {
		if (lat < 40.725) return 'Lower Manhattan';
		if (lat < 40.755) return 'Midtown Manhattan';
		if (lat < 40.805) return 'Upper Manhattan';
		return 'Harlem';
	}
	if (lat > 40.785 && lon > -73.94 && lon < -73.76) return 'The Bronx';
	if (lat < 40.745 && lon > -74.05 && lon < -73.83) return 'Brooklyn';
	if (lon > -73.96 && lon < -73.69 && lat < 40.84) return 'Queens';
	return 'New York City';
}

// Reserved, real city spaces transformed into the current floating globe frame. The town
// generator receives only those close enough to affect the district being grown.
export function citySites(profile, toXZ, x, z, radius) {
	if (!profile?.sites?.length) return [];
	const out = [];
	for (const s of profile.sites) {
		const p = toXZ(s.lat, s.lon), reach = radius + Math.hypot(s.w, s.d) / 2 + 200;
		if (Math.hypot(p.x - x, p.z - z) > reach) continue;
		out.push({
			kind: s.kind,
			name: s.name,
			x: p.x,
			z: p.z,
			ux: Math.cos(s.angle || 0),
			uz: Math.sin(s.angle || 0),
			hw: s.w / 2,
			hd: s.d / 2,
			noPond: !!s.noPond,
		});
	}
	return out;
}
