// The sign systems of the world, as a traffic engineer would group them: the American manual
// (white regulatory rectangles, yellow diamond warnings, green guide signs, route numbers on
// shields), its cousins in the rest of the Americas and Australia (the diamonds and the
// octagon, kilometres and the local word on the stop sign), the Vienna convention across
// Europe and most of the world (red rings and triangles, blue or green motorway signs, the
// word STOP), Britain's own reading of it (miles, white street plates), Japan's (the red
// inverted triangle that says stop, blue numerals in the ring, blue guide signs), and an
// off-world system for the planets (hexagons, cyan on graphite). Which applies where comes
// from economy/establishments.js's localeAt. Plain data; the drawing is in faces.js.

const US = {
	id: 'us', side: 'right', unit: 'mph', stop: 'STOP', guide: '#0b6a3a', guideFg: '#f4f4ee', blade: '#0b6a3a', bladeFg: '#f4f4ee',
	warn: 'diamond', warnBg: '#f7c51c', ring: false, plate: 'us', speeds: { primary: 45, secondary: 40, tertiary: 35, residential: 25, unclassified: 30, living_street: 15, service: 15, school: 25 },
	clearance: (m) => { const ft = Math.floor(m * 3.28084), inch = Math.floor((m * 3.28084 - ft) * 12); return `${ft}'-${inch}"`; },
	frontPlate: true, allWay: true,
};
const AMERICAS = { ...US, id: 'americas', unit: 'km/h', stop: 'ALTO', speeds: { primary: 60, secondary: 50, tertiary: 40, residential: 30, unclassified: 40, living_street: 20, service: 10, school: 30 }, clearance: (m) => `${m.toFixed(1)} m`, plate: 'latam', allWay: false };
const VIENNA = {
	id: 'vienna', side: 'right', unit: 'km/h', stop: 'STOP', guide: '#1d4f9c', guideFg: '#ffffff', blade: '#1d4f9c', bladeFg: '#ffffff',
	warn: 'triangle', warnBg: '#ffffff', ring: true, plate: 'eu', speeds: { primary: 70, secondary: 50, tertiary: 50, residential: 30, unclassified: 50, living_street: 20, service: 10, school: 30 },
	clearance: (m) => `${m.toFixed(1)} m`, frontPlate: true, allWay: false,
};
const UK = { ...VIENNA, id: 'uk', side: 'left', unit: 'mph', blade: '#ffffff', bladeFg: '#111111', guide: '#0d5a2f', plate: 'uk', speeds: { primary: 40, secondary: 30, tertiary: 30, residential: 20, unclassified: 30, living_street: 10, service: 10, school: 20 }, clearance: (m) => { const ft = Math.floor(m * 3.28084), inch = Math.floor((m * 3.28084 - ft) * 12); return `${ft}'${inch}"`; } };
const JP = {
	id: 'jp', side: 'left', unit: 'km/h', stop: '止まれ', guide: '#1f4d9e', guideFg: '#ffffff', blade: '#1f4d9e', bladeFg: '#ffffff',
	warn: 'diamond', warnBg: '#f7c51c', ring: true, plate: 'jp', speeds: { primary: 50, secondary: 40, tertiary: 40, residential: 30, unclassified: 30, living_street: 20, service: 10, school: 30 },
	clearance: (m) => `${m.toFixed(1)} m`, frontPlate: true, allWay: false,
};
const AU = { ...AMERICAS, id: 'au', side: 'left', stop: 'STOP', plate: 'au', guide: '#0b6a3a', speeds: { primary: 60, secondary: 60, tertiary: 50, residential: 50, unclassified: 50, living_street: 10, service: 10, school: 40 } };
const ORBITAL = {
	id: 'orbital', side: 'right', unit: 'u/s', stop: 'HALT', guide: '#20272c', guideFg: '#6fe7f2', blade: '#20272c', bladeFg: '#6fe7f2',
	warn: 'hex', warnBg: '#ffb43a', ring: true, plate: 'orbital', speeds: { primary: 40, secondary: 30, tertiary: 25, residential: 15, unclassified: 20, living_street: 10, service: 8, school: 10 },
	clearance: (m) => `${m.toFixed(1)} m`, frontPlate: false, allWay: false,
};
export const SYSTEMS = Object.freeze({ us: US, americas: AMERICAS, vienna: VIENNA, uk: UK, jp: JP, au: AU, orbital: ORBITAL });

// the system for a locale (economy/establishments.js localeAt), or for another world
export function systemFor(locale, { planet = false } = {}) {
	if (planet) return ORBITAL;
	if (locale === 'us' || locale === 'us-ca' || locale === 'us-tx') return US;
	if (locale === 'mx' || locale === 'latam' || locale === 'br') return AMERICAS;
	if (locale === 'uk') return UK;
	if (locale === 'jp') return JP;
	if (locale === 'au') return AU;
	return VIENNA;
}
// the road's place in the hierarchy: 3 arterial .. 0 a lane
export const RANK = Object.freeze({ motorway: 4, trunk: 3, primary: 3, secondary: 3, tertiary: 2, residential: 1, unclassified: 1, living_street: 0, service: 0 });
