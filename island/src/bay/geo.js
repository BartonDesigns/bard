// Where the real world sits in Crysis' world. The island is placed in the Gulf of the
// Farallones, 25 km west of the Golden Gate; the Bay Area is laid out around it at true
// scale in metres (equirectangular about the island: +x east, -z north).

export const LAT0 = 37.76, LON0 = -122.78;
export const KX = 111320 * Math.cos(LAT0 * Math.PI / 180);   // metres per degree of longitude here
export const KZ = 110996;                                     // metres per degree of latitude
export const toWorld = (lat, lon) => ({ x: (lon - LON0) * KX, z: -(lat - LAT0) * KZ });
export const toLatLon = (x, z) => ({ lat: LAT0 - z / KZ, lon: LON0 + x / KX });

// the baked height levels: coarse over all nine counties, finer over the core bay,
// finest round the Golden Gate and over San Ramon (see tools/bake-bayarea.mjs)
export const LEVELS = [
	{ name: 'h0', lat: [36.93, 38.87], lon: [-123.6, -121.45], step: 120, zoom: 10 },
	{ name: 'h1', lat: [37.2, 38.12], lon: [-122.62, -121.75], step: 60, zoom: 11 },
	{ name: 'h2', lat: [37.7, 37.93], lon: [-122.56, -122.36], step: 15, zoom: 13 },
	{ name: 'h3', lat: [37.715, 37.83], lon: [-122.02, -121.87], step: 10, zoom: 14 },         // San Ramon, mapped street by street
	{ name: 'h4', lat: [37.82, 37.95], lon: [-122.02, -121.84], step: 12, zoom: 14 },          // Mt Diablo
];
// height encoding in the PNGs: v = (h + 1000) * 20 in R (high byte) and G (low byte)
export const H_OFF = 1000, H_SCALE = 20;
