// The baked real-map regions read in node as realcity.js load() reads them in the browser
// (roads, building boxes, grouped into houses), for tests that check what stands where.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { LON0, LON0_LEGACY, KX } from '../src/bay/geo.js';
import { groupBoxes } from '../src/bay/houseplan.js';
import { onLandmark } from '../src/bay/footprints.js';

const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'unknown']);
const WALKED = new Set(['secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);

export function loadRegion(name) {
	const base = new URL(`../assets/bayarea/real/${name}`, import.meta.url);
	const H = JSON.parse(fs.readFileSync(base.pathname + '.json', 'utf8'));
	const bin = zlib.gunzipSync(fs.readFileSync(base.pathname + '.bin.gz'));
	const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
	const shiftX = ((H.geo ? H.geo[1] : LON0_LEGACY) - LON0) * KX;
	const [OX, OZ] = [H.origin[0] + shiftX, H.origin[1]], U = H.unit, S = H.sections;
	const roads = [], boxes = [];
	let o = S.roads[0];
	for (let n = 0; n < S.roads[1]; n++) {
		const c = dv.getUint8(o), f = dv.getUint8(o + 1), k = dv.getUint16(o + 4, true); o += 6;
		const pts = new Float32Array(k * 2);
		for (let j = 0; j < k; j++, o += 4) { pts[j * 2] = dv.getInt16(o, true) * U + OX; pts[j * 2 + 1] = dv.getInt16(o + 2, true) * U + OZ; }
		const cls = H.classes[c];
		if (k >= 2) roads.push({ cls, w: H.widths[c], bridge: !!(f & 1), link: !!(f & 2), drive: DRIVE.has(cls), walked: WALKED.has(cls), pts });
	}
	o = S.boxes[0];
	for (let n = 0; n < S.boxes[1]; n++, o += 18) {
		const kh = dv.getInt16(o + 14, true);
		const b = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 10000, wallH: dv.getInt16(o + 10, true) / 20, roofH: dv.getInt16(o + 12, true) / 20, kind: kh & 255, hip: kh >> 8, door: dv.getInt16(o + 16, true) / 1000 };
		if (onLandmark(b.x, b.z, Math.max(b.w, b.d) / 2)) continue;
		boxes.push(b);
	}
	groupBoxes(boxes);
	return { name, bounds: [H.bounds[0] + shiftX, H.bounds[1], H.bounds[2] + shiftX, H.bounds[3]], roads, boxes };
}
// a window of a region (boxes and the roads near them), for a quick test
export function clip(G, cx, cz, R) {
	const boxes = G.boxes.filter((b) => Math.abs(b.x - cx) < R && Math.abs(b.z - cz) < R);
	const roads = G.roads.filter((r) => { const p = r.pts; for (let i = 0; i < p.length; i += 2) if (Math.abs(p[i] - cx) < R + 60 && Math.abs(p[i + 1] - cz) < R + 60) return true; return false; });
	groupBoxes(boxes);
	return { ...G, boxes, roads };
}
export { onLandmark };
