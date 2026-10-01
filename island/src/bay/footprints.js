// The ground the landmarks stand on that the generated city must leave to them (bay/landmarks.js
// builds them hollow, to walk into: a block of flats or a street tree must not stand inside one).
// Each is a rectangle in a frame like landmarks.js' at(): its middle at a real place, heading
// the bearing of its local +z, offset (ox, oz) within that frame, half-sizes hw (along local x)
// and hd (along local z), a few metres wider than the building.

import { toWorld } from './geo.js';
import { toW } from './rides/kit.js';

const RECTS = [
	[37.82661, -122.42277, 125, 0, 7.5, 22, 86],       // Alcatraz: the cellhouse and its entrance hall
	[37.82644, -122.42176, 125, 0, 0, 4, 4],           // ...the lighthouse's foot
	[37.7955, -122.3937, 150, 0, 0, 18, 104],          // the Ferry Building
	[37.7793, -122.4193, 0, 0, 0, 65, 49],             // San Francisco City Hall
	[37.8029, -122.4484, 30, 55, -42, 20, 55],         // the Palace of Fine Arts' hall
	[37.8029, -122.4484, 30, 0, 30, 95, 45],           // ...its rotunda and colonnade
	[37.8106, -122.4771, 60, 0, 0, 37, 25],            // Fort Point
	[37.7786, -122.3893, 45, 0, 0, 122, 122],          // Oracle Park
	[37.7680, -122.3877, 0, 0, 0, 82, 82],             // the Chase Center
	[37.8053, -122.2724, 20, 0, 0, 28, 19],            // Oakland City Hall
	[37.8043, -122.2708, 20, 0, 0, 9, 9],              // the Tribune Tower
	[37.8721, -122.2578, 0, 0, 0, 8, 8],               // the Campanile
	[37.8712, -122.2508, 0, 0, 0, 102, 128],           // Memorial Stadium
	[37.4275, -122.1668, 0, 0, 0, 9, 9],               // Hoover Tower
	[37.4155, -122.0496, 330, 0, 0, 50, 176],          // Hangar One
	[37.4033, -121.9694, 0, 0, 0, 140, 148],           // Levi's Stadium
	[37.3327, -121.9010, 0, 0, 0, 78, 74],             // the SAP Center
	[37.7672, -121.9600, 70, 0, 0, 95, 80],            // Bishop Ranch's City Center
	[37.7657, -121.9552, 70, 0, 3, 38, 22],            // San Ramon City Hall
	[37.7648, -121.9522, 40, 0, 0, 26, 21],            // the San Ramon library
	[37.33478, -122.00899, 0, 0, 0, 238, 238],         // Apple Park's ring
	[37.33065, -122.00715, 0, 0, 0, 30, 30],           // its theater
	[37.3325, -122.0053, 90, 0, 0, 30, 58],            // its visitor centre
	[37.7705, -122.5087, 90, 0, 0, 9, 9], [37.7658, -122.5087, 90, 0, 0, 9, 9],      // the windmills
].map(([lat, lon, h, ox, oz, hw, hd]) => {
	const w = toWorld(lat, lon), t = -h * Math.PI / 180 + Math.PI, c = Math.cos(t), s = Math.sin(t);
	return { x: w.x + c * ox + s * oz, z: w.z - s * ox + c * oz, c, s, hw, hd, r: Math.hypot(hw, hd) };
});
// the Boardwalk's Casino and its carousel house (bay/boardwalk.js: in its own frame, 16 degrees
// round from the map's)
{
	const a = 16 * Math.PI / 180;
	for (const [u, v, hw, hd] of [[-208, -23, 60, 18], [-128, -34, 15, 15]]) { const [x, z] = toW(u, v); RECTS.push({ x, z, c: Math.cos(a), s: Math.sin(a), hw, hd, r: Math.hypot(hw, hd) }); }
}

// whether (x, z), or a thing r across round it, stands on a landmark's ground
export function onLandmark(x, z, r = 0) {
	for (const L of RECTS) {
		const dx = x - L.x, dz = z - L.z;
		if (Math.abs(dx) > L.r + r || Math.abs(dz) > L.r + r) continue;
		if (Math.abs(L.c * dx - L.s * dz) < L.hw + r && Math.abs(L.s * dx + L.c * dz) < L.hd + r) return true;
	}
	return false;
}
