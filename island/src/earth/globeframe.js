// Where the world's metres are on the globe. The engine's ground is flat: +x east, -z north,
// in metres. Near the Bay the frame is the Bay's own (bay/geo.js: equirectangular about the
// island, the origin at the island), so everything baked there stays where it is. Far off,
// a float can't hold a metre thousands of kilometres out, so the frame floats: its anchor
// (a latitude and longitude) moves to where you are and is laid down at a fixed spot FAR in
// the engine's metres, out in the Pacific where nothing of the Bay's is, and the world is
// shifted under you (globe.js does the shifting). About the anchor the frame is
// equirectangular again, true to scale round you wherever it is.
//
//   toLL(x, z) / toXZ(lat, lon)   between the engine's metres and the globe, in the frame now
//   F                             the frame: anchor lat/lon, where it lies (fx, fz), metres per degree
//   setFrame(lat, lon) / bayFrame()
//
// The ground's own relief is a function of the latitude and longitude alone (globeheight.js),
// so moving the frame never changes a hill.

import { LAT0, LON0, KX, KZ } from '../bay/geo.js';

export const RAD = Math.PI / 180;
export const EARTH_R = 6371000;
// where the anchor lies when the frame floats: 400 km west of the island, in open sea as the
// Bay's own systems see it (they are all within 250 km of the island). A float holds 3 cm here.
export const FAR = { x: -400000, z: 0 };
// how far from the Bay the Bay's frame is kept (km), and how far you may go from a floating
// anchor before it moves (m)
export const BAY_KM = 330, BAY_BACK_KM = 300, DRIFT = 40000, DRIFT_MAX = 120000;

export const F = { lat: LAT0, lon: LON0, fx: 0, fz: 0, kx: KX, kz: KZ, bay: true, epoch: 0 };
const wrap = (d) => ((d + 540) % 360 + 360) % 360 - 180;

export function toLL(x, z) { return { lat: F.lat - (z - F.fz) / F.kz, lon: wrap(F.lon + (x - F.fx) / F.kx) }; }
// (the longitude not wrapped: the ground's noise runs on across the frame without a seam)
export const lonRaw = (x) => F.lon + (x - F.fx) / F.kx;
export function toXZ(lat, lon) { return { x: F.fx + wrap(lon - F.lon) * F.kx, z: F.fz - (lat - F.lat) * F.kz }; }

export function setFrame(lat, lon) {
	lat = Math.max(-84, Math.min(84, lat));
	Object.assign(F, { lat, lon: wrap(lon), fx: FAR.x, fz: FAR.z, kx: 111320 * Math.cos(lat * RAD), kz: KZ, bay: false });
	F.epoch++;
}
export function bayFrame() { Object.assign(F, { lat: LAT0, lon: LON0, fx: 0, fz: 0, kx: KX, kz: KZ, bay: true }); F.epoch++; }

// great-circle km from the Bay's origin
export function bayKm(lat, lon) {
	const a = Math.sin((lat - LAT0) * RAD / 2) ** 2 + Math.cos(lat * RAD) * Math.cos(LAT0 * RAD) * Math.sin((lon - LON0) * RAD / 2) ** 2;
	return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
