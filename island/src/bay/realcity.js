// The real city: where the Bay Area is mapped street by street (San Francisco, Oakland and
// Berkeley, the Peninsula, the Tri-Valley and Mt Diablo, and more: realtiles.js), the
// roads, buildings, driveways, pools and trees come from Overture Maps (OpenStreetMap,
// Microsoft and Google footprints), baked by tools/bake-realcity.py. The regions near you
// are fetched as you come (the big cities in tiles of a few kilometres) and dropped as you
// leave. Inside them the procedural street grid gives way to this:
//   the ground shader paints the streets from a road map rendered round you at half a
//   metre a pixel (asphalt, sidewalks and kerbs, driveways and walks, dirt trails,
//   lane lines), and from the baked 8 m maps further out (roads, land use, roofs);
//   city.js raises the buildings, streetlife.js parks and drives the cars along the
//   real streets, and people walk the real sidewalks.

import * as THREE from 'three';
import { toWorld, KX, LON0, LON0_LEGACY } from './geo.js';
import { groupBoxes, isHome, frontOf } from './houseplan.js';
import { SUMMIT } from './diablo.js';
import { lakeFeatures } from './lake.js';
import { onLandmark } from './footprints.js';
import { REAL_REGIONS, REAL_TALL } from './realtiles.js';
import { footLifted } from './overpass.js';
import { carriageways, isCarriageway, lanesOf, medianAlong, SHOULDER_R } from './fwyplan.js';   // the freeway's cross section
import { settleRegionSoon } from '../structures/overlap.js';   // structures: settled footprints
import { planSites, planSitesSteps } from './siteplan.js';     // the suburbs' gas stations and corner stores
import { eraMap } from './streetera.js';                     // streets by era: the era of each street
import { paintStreet } from './potholes.js';                 // ...its sidewalk, potholes and patches in the paint layer
import { qualityNow, onQuality } from '../world/governor.js';
import { GFX_PHONE } from '../world/device.js';
import { buildSlice } from '../world/buildslice.js';

// the ground shader's inputs, shared with terrain.js
const blank = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t.needsUpdate = true; return t; };
// where the rock shows its own colour (steep ground, cliffs, road cuts)
const ROCKS = [
	[37.8255, -122.4990, 2600, 0x8e3c2c],      // Marin Headlands: red ribbon chert (Hawk Hill, Conzelman Road)
	[37.7920, -122.4570, 900, 0x3a5a4a],       // the Presidio's serpentinite, waxy green-black
	[37.4735, -122.2835, 1300, 0x40584a],      // Edgewood: serpentine grassland
	[37.8450, -121.9400, 1600, 0xc8a068],      // Mt Diablo's Rock City and Castle Rock: honey sandstone
	[37.5550, -122.5080, 2800, 0xc4b69c],      // Montara Mountain and Devil's Slide: pale speckled granite
	[37.3400, -122.4000, 16000, 0xc8b89a],     // the Purisima mudstone bluffs down the San Mateo coast
	[37.8980, -122.6950, 2500, 0x9a8a70],      // Duxbury: Monterey shale
	[37.9290, -122.5780, 2200, 0x6e6a5c],      // Mt Tam: greenstone and serpentine
].map(([lat, lon, r, c]) => ({ ...toWorld(lat, lon), r, c }));
export const GREENS = [
	[37.7694, -122.4830, 2600, 450],           // Golden Gate Park
	[37.7360, -122.4870, 700, 300],            // Stern Grove and Pine Lake
	[37.7960, -122.4050, 150, 130],            // (a placeholder kept small: Portsmouth Square)
	[37.8070, -122.4330, 350, 110],            // the Marina Green
].map(([lat, lon, rx, rz]) => ({ ...toWorld(lat, lon), rx, rz }));
const PHONE = GFX_PHONE;
// how many mapped regions the ground shader tells from the procedural world at once: the
// loaded ones nearest you (tiles side by side are merged into one box first; a phone loads
// fewer, and its ground shader is smaller for it)
export const REAL_SLOTS = PHONE ? 10 : 16;
const SLOTS = Array.from({ length: REAL_SLOTS }, (v, i) => i);
const NOWHERE = () => new THREE.Vector4(1e9, 1e9, -1e9, -1e9);
export const REAL_U = {
	uRoadMap: { value: blank() }, uRoadR: { value: new THREE.Vector4(0, 0, 1, 0) },
	uRoadMap2: { value: blank() }, uRoadR2: { value: new THREE.Vector4(0, 0, 1, 0) }, uPaintMap: { value: blank() },
	uSeason: { value: 1 },                      // 0 spring green .. 1 summer gold
	uSeasonLag: { value: 0 },                   // the foggy coast turns gold later than the inland hills
	uBloom: { value: 0 },                       // spring wildflowers: poppies, lupine, goldfields (0..1)
	uLeafFall: { value: 0 },                  // dead leaves in the gutters (0..1; by the month, main.js)
	// the rocks by region (the naturalist's geology): [x, z, radius, 0] and their colours
	uRock: { value: ROCKS.map((r) => new THREE.Vector4(r.x, r.z, r.r, 0)) }, uRockC: { value: ROCKS.map((r) => new THREE.Color(r.c)) },
	// the watered city parks, green all summer: [x, z, half-length, half-width] (axis-aligned)
	uGreen: { value: GREENS.map((g) => new THREE.Vector4(g.x, g.z, g.rx, g.rz)) },
	// the coarse map round you (land use, far roads and roofs), where it lies, and its box
	uRealMap: { value: blank() }, uRealR: { value: new THREE.Vector4(0, 0, 8, 0) }, uRealB: { value: NOWHERE() },
	// the mapped regions' boxes, and the box round all of them
	uRealBs: { value: Array.from({ length: REAL_SLOTS }, NOWHERE) }, uRealAll: { value: NOWHERE() },
};
const EMPTY_MAPS = [REAL_U.uRoadMap.value, REAL_U.uRoadMap2.value, REAL_U.uPaintMap.value, REAL_U.uRealMap.value];
export const REAL_GLSL = /* glsl */`
uniform sampler2D uRoadMap, uRoadMap2, uPaintMap, uRealMap; uniform vec4 uRoadR, uRoadR2, uRealR, uRealB, uRealAll, uRealBs[${REAL_SLOTS}]; uniform float uSeason, uSeasonLag, uBloom, uLeafFall; uniform vec4 uRock[8]; uniform vec3 uRockC[8]; uniform vec4 uGreen[4];
bool inBox(vec2 w, vec4 b){ return w.x > b.x && w.y > b.y && w.x < b.z && w.y < b.w; }
// any mapped region (real streets, no grid): inside the loaded regions' boxes and 60 m from
// their outer edge (boxes side by side are one; see realCovered), and where the coarse map covers it
// (written out flat, each box by its own index: loops over the array, with early returns, in
// a shader this size were too much for Apple's shader compiler, which lost the graphics)
bool inRealBox(vec2 w){
	return ${SLOTS.map((i) => `inBox(w, uRealBs[${i}])`).join(' || ')};
}
bool inRealAny(vec2 w){
	if (!inBox(w, uRealAll + vec4(60.0, 60.0, -60.0, -60.0))) return false;
	const vec4 IN = vec4(60.0, 60.0, -60.0, -60.0);
	if (${SLOTS.map((i) => `inBox(w, uRealBs[${i}] + IN)`).join(' || ')}) return true;
	return inRealBox(w) && inRealBox(w + vec2(60.0, 0.0)) && inRealBox(w - vec2(60.0, 0.0)) && inRealBox(w + vec2(0.0, 60.0)) && inRealBox(w - vec2(0.0, 60.0));
}
bool inReal(vec2 w){ return uRealR.w > 0.5 && inBox(w, uRealB); }
`;

// the regions, baked whole or as cells of the tile grid (realtiles.js), and their extents
// [west, south, east, north], known before their data loads
const NAMES = REAL_REGIONS.map((r) => r[0]);
export const REAL_EXTENTS = REAL_REGIONS.map((r) => r.slice(1, 5));
const BOXES = REAL_EXTENTS.map(([w, s, e, n]) => { const a = toWorld(n, w), b = toWorld(s, e); return [a.x, a.z, b.x, b.z]; });
// a coarse index of them, 2 km cells
const IDX = new Map();
BOXES.forEach((B, i) => { for (let gx = Math.floor(B[0] / 2000); gx <= Math.floor(B[2] / 2000); gx++) for (let gz = Math.floor(B[1] / 2000); gz <= Math.floor(B[3] / 2000); gz++) { const k = gx * 4096 + gz; (IDX.get(k) || IDX.set(k, []).get(k)).push(i); } });
const inMapped = (x, z) => (IDX.get(Math.floor(x / 2000) * 4096 + Math.floor(z / 2000)) || []).some((i) => { const B = BOXES[i]; return x > B[0] && z > B[1] && x < B[2] && z < B[3]; });
// whether a point is mapped (loaded or not) and at least m from where the mapped regions meet
// the procedural world: regions side by side are one, so only their outer edge is a seam.
// There the generated blocks, grid and freeways stop, and the mapped data stops m inside it.
export const realCovered = (x, z, m = 60) => inMapped(x, z) && inMapped(x - m, z) && inMapped(x + m, z) && inMapped(x, z - m) && inMapped(x, z + m);
export { REAL_TALL };
const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'unknown']);
const WALKED = new Set(['secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);   // sidewalks both sides
// how far (x, z) is from the segment a-b
const segDist = (ax, az, bx, bz, x, z) => { const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)); return Math.hypot(ax + ex * t - x, az + ez * t - z); };
// a region is fetched when you come this near its edge and dropped when you are this far
// (the buildings stand to 2 km, the trees a little further); a change this near you is
// news to everything built round you (version()); a phone keeps less of the map in memory
const LOAD = PHONE ? 2000 : 3000, DROP = PHONE ? 2800 : 4500, NEWS = 2600;
// the coarse maps round you are drawn into one, at most this many texels a side
const COMP = PHONE ? 1024 : 2048;

// a tile's parse a few milliseconds at a time: its roads, buildings, paths and trees run to tens
// and hundreds of thousands of entries, and read in one piece they held a phone's frame for the
// tens of milliseconds and more each, right as you landed. breather(signal) gives a function
// that, once this much has been spent, gives the frame back (as addDrives does) and checks the
// tile is still wanted; what is parsed is the same, only spread over frames
const PARSE_MS = PHONE ? 4 : 8;
function breather(signal, ms = PARSE_MS) {
	let t = performance.now();
	return async () => {
		if (performance.now() - t < ms) return;
		await new Promise((ok) => setTimeout(ok, 0));
		if (signal?.aborted) throw new DOMException('Tile cancelled', 'AbortError');
		t = performance.now();
	};
}

// what a coarse map says of a point: its land use, how much road and roof (null off the map)
function mapLand(M, x, z) {
	const i = Math.floor((x - M.x0) / M.step), j = Math.floor((z - M.z0) / M.step);
	if (i < 0 || j < 0 || i >= M.w || j >= M.h) return null;
	const k = (j * M.w + i) * 4;
	return { lu: Math.round(M.px[k + 1] / 16), road: M.px[k] / 255, roof: M.px[k + 2] / 255 };
}

async function gunzip(res) {
	if (!res.ok) throw new Error(res.status + ' ' + res.url);
	const ds = new DecompressionStream('gzip');
	return new Uint8Array(await new Response(res.body.pipeThrough(ds)).arrayBuffer());
}
// a coarse map's pixels, exactly as baked
async function pixels(url, signal) {
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(res.status + ' ' + res.url);
	const bm = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
	try {
		if (signal.aborted) throw new DOMException('Tile cancelled', 'AbortError');
		const cv = document.createElement('canvas');
		cv.width = bm.width; cv.height = bm.height;
		const cx = cv.getContext('2d', { willReadFrequently: true });
		cx.drawImage(bm, 0, 0);
		return cx.getImageData(0, 0, cv.width, cv.height).data;
	} finally { bm.close(); }
}

export function createRealCity(renderer, { isPhone = false } = {}) {
	const R = { regions: [], loaded: false, attribution: '' };
	const LF = lakeFeatures();
	const CELL = 250;
	const key = (gx, gz) => (gx + 4096) * 8192 + gz + 4096;
	const cellIn = (grid, x, z) => { const k = key(Math.floor(x / CELL), Math.floor(z / CELL)); let g = grid.get(k); if (!g) grid.set(k, g = { roads: [], boxes: [], paths: [], pools: [], trees: [] }); return g; };
	const roadBox = (r) => {
		const p = r.pts;
		let mnx = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9;
		for (let i = 0; i < p.length; i += 2) { mnx = Math.min(mnx, p[i]); mxx = Math.max(mxx, p[i]); mnz = Math.min(mnz, p[i + 1]); mxz = Math.max(mxz, p[i + 1]); }
		return [mnx, mnz, mxx, mxz];
	};
	// a road goes in every cell its box touches; the region's reach grows to hold it
	const putRoad = (G, r) => {
		const [mnx, mnz, mxx, mxz] = r.box;
		for (let gx = Math.floor(mnx / CELL); gx <= Math.floor(mxx / CELL); gx++) for (let gz = Math.floor(mnz / CELL); gz <= Math.floor(mxz / CELL); gz++) cellIn(G.grid, gx * CELL + 1, gz * CELL + 1).roads.push(r);
		G.reach[0] = Math.min(G.reach[0], mnx); G.reach[1] = Math.min(G.reach[1], mnz); G.reach[2] = Math.max(G.reach[2], mxx); G.reach[3] = Math.max(G.reach[3], mxz);
	};
	const live = new Map(), pending = new Map(), failed = new Set();
	let self = null;          // (this city as returned, for the streets' eras: streetera.js)
	let disposed = false, cancelled = 0;
	let roadV = 0;            // (the regions' and the hand-laid roads changed, near or far: roadVersion())
	let camX = 1e9, camZ = 1e9, late = 0;

	// Buildings clear of the street: none standing in a carriageway or on its sidewalk (the
	// mapped footprints and the drawn road widths don't always agree), and a home a little
	// further back behind its front yard. Each house is moved whole, its wings and garage with
	// it, straight away from the street (from two streets on a corner), by 3.5 m at most;
	// returns the moves (in 50 m cells) so the drives and walks to them can follow.
	const SET_MAX = 3.5;
	async function setBack(G, breathe) {
		const seen = new Set(), moves = new Map(), near = [];
		let n = 0;
		// (how far (x, z) is from a road's centre line, and the way out from it)
		const away = (r, x, z) => {
			const p = r.pts;
			let best = 1e9, ox = 0, oz = 0;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), qx = x - ax - dx * t, qz = z - az - dz * t, d = Math.hypot(qx, qz);
				if (d < best) { best = d; const l = Math.sqrt(l2); ox = d > 0.01 ? qx / d : -dz / l; oz = d > 0.01 ? qz / d : dx / l; }
			}
			return [best, ox, oz];
		};
		for (const b of G.boxes) {
			const grp = b.grp || [b];
			if (seen.has(grp)) continue;
			seen.add(grp);
			if ((++n & 127) === 0) await breathe();
			const home = isHome(b);
			let cx = 0, cz = 0, R = 0;
			for (const q of grp) { cx += q.x / grp.length; cz += q.z / grp.length; }
			for (const q of grp) R = Math.max(R, Math.hypot(q.x - cx, q.z - cz) + Math.hypot(q.w, q.d) / 2);
			near.length = 0;
			nearIn(G, 'roads', cx, cz, R + 16, near);
			let px = 0, pz = 0;
			for (const r of near) {
				if (!r.drive || r.bridge || r.cls === 'motorway' || r.cls === 'trunk') continue;
				const need = r.w / 2 + (r.walked ? 1.7 : 0.5) + (home ? 2.5 : 0.3);
				if (cx < r.box[0] - need - R || cx > r.box[2] + need + R || cz < r.box[1] - need - R || cz > r.box[3] + need + R) continue;
				if (away(r, cx, cz)[0] > need + R) continue;
				// the deepest any corner or side of the house reaches into this street's room
				let k = 0, ux = 0, uz = 0;
				for (const q of grp) {
					const ca = Math.cos(q.a), sa = Math.sin(q.a);
					for (const [u, v] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) {
						const lx = u * q.w / 2, lz = v * q.d / 2, [d, ox, oz] = away(r, q.x + ca * lx - sa * lz, q.z + sa * lx + ca * lz);
						if (need - d > k) { k = need - d; ux = ox; uz = oz; }
					}
				}
				if (k > 0) { px += ux * k; pz += uz * k; }
			}
			const L = Math.hypot(px, pz);
			if (L < 0.05) continue;
			if (L > SET_MAX) { px *= SET_MAX / L; pz *= SET_MAX / L; }
			for (const q of grp) { q.x += px; q.z += pz; }
			// (in every cell the move's reach touches)
			const m = { x: cx, z: cz, r: R + 4, px, pz };
			for (let i = Math.floor((cx - m.r) / 50); i <= Math.floor((cx + m.r) / 50); i++) for (let j = Math.floor((cz - m.r) / 50); j <= Math.floor((cz + m.r) / 50); j++) { const k = i * 65536 + j; let c = moves.get(k); if (!c) moves.set(k, c = []); c.push(m); }
		}
		return moves;
	}
	// A drive for every home, and a walk to every front door, where the map gives none, so no
	// house stands in a lot of lawn with no way to it. The drive runs from the garage's doors
	// straight out to the street it faces, concrete as the mapped ones (drawn into the ground's
	// map, drawRoadMap; the kerb cars and the trees keep off it); where the street is not ahead
	// of the doors (a corner lot, a garage to the side) it bends to the nearest kerb ahead
	// within 50 degrees, or there is none. A house whose garage the map does not show gets a
	// parking pad down the side of the house instead (the end away from the front door, where
	// nothing else stands) and out to the street, and a car is left on it (city.js realYard).
	// The walk, 1.2 m wide, goes from the front door 2 m out and across to the drive beside
	// it, or straight out to the kerb. Across frames, a few milliseconds at a time
	async function addDrives(G, signal) {
		const seen = new Set(), near = [], mapped = [], boxes = [];
		let t = performance.now();
		// how far out along (nx, nz) from (x, z) the kerb of the street is, as [distance, the
		// bend to it when it is off to one side]
		const toStreet = (x, z, nx, nz, bends) => {
			near.length = 0; nearIn(G, 'roads', x, z, 50, near);
			let best = 1e9, bend = null;
			for (const r of near) {
				if (!r.drive || r.bridge || r.link || r.cls === 'motorway' || r.cls === 'trunk') continue;
				const p = r.pts, hw = r.w / 2;
				for (let i = 0; i + 3 < p.length; i += 2) {
					// the line straight out, where it crosses this piece of street
					const ex = p[i + 2] - p[i], ez = p[i + 3] - p[i + 1], den = nx * ez - nz * ex;
					if (Math.abs(den) > 1e-6) {
						const qx = p[i] - x, qz = p[i + 1] - z, tt = (qx * ez - qz * ex) / den, u = (qx * nz - qz * nx) / den;
						if (u >= 0 && u <= 1 && tt > 1.5 && tt - hw < best) { best = tt - hw; bend = null; }
					}
					if (!bends) continue;
					// or the nearest kerb ahead, for the bend
					const l2 = ex * ex + ez * ez || 1, k = Math.max(0, Math.min(1, ((x - p[i]) * ex + (z - p[i + 1]) * ez) / l2));
					const cx = p[i] + ex * k - x, cz = p[i + 1] + ez * k - z, cd = Math.hypot(cx, cz);
					if (cd - hw > 1 && cd - hw < 30 && (cx * nx + cz * nz) / cd > 0.64 && cd - hw + 4 < best) { best = cd - hw + 4; bend = [p[i] + ex * k - cx / cd * hw, p[i + 1] + ez * k - cz / cd * hw]; }
				}
			}
			return [best, bend];
		};
		// whether a spot is at least m from every building but this house's own blocks
		const clear = (grp, x, z, m) => {
			boxes.length = 0; nearIn(G, 'boxes', x, z, 20, boxes);
			for (const b of boxes) {
				if (b.grp === grp) continue;
				const ca = Math.cos(b.a), sa = Math.sin(b.a), dx = x - b.x, dz = z - b.z;
				if (Math.abs(ca * dx + sa * dz) < b.w / 2 + m && Math.abs(-sa * dx + ca * dz) < b.d / 2 + m) return false;
			}
			return true;
		};
		// a drive the map already has, within r of (x, z)
		const driveAt = (x, z, r) => { mapped.length = 0; nearIn(G, 'paths', x, z, 30, mapped); return mapped.find((q) => q.w >= 2.2 && segDist(q.ax, q.az, q.bx, q.bz, x, z) < r); };
		for (const b of G.boxes) {
			if (!b.grp || seen.has(b.grp) || !isHome(b)) continue;
			seen.add(b.grp);
			if (performance.now() - t > 5) { await new Promise((ok) => setTimeout(ok, 0)); if (signal?.aborted) return; t = performance.now(); }
			const F = frontOf(b.grp);
			if (!F) continue;
			const { M, ca, sa, R0, door, garage: gar } = F, nx = -sa, nz = ca;
			const W = (lx, lz) => [M.x + ca * lx - sa * lz, M.z + sa * lx + ca * lz];
			const Lc = (x, z) => [ca * (x - M.x) + sa * (z - M.z), -sa * (x - M.x) + ca * (z - M.z)];
			// ---- the drive
			if (gar && gar.doors.length) {
				const d0 = gar.doors[0], d1 = gar.doors[gar.doors.length - 1];
				const [dx, dz] = W((d0.x0 + d1.x1) / 2, gar.front);
				if (!driveAt(dx + nx * 2, dz + nz * 2, 3.5)) {
					const [best, bend] = toStreet(dx, dz, nx, nz, true);
					if (best <= 32 && best >= 0.8) {
						const w = Math.min(6.4, Math.max(3.0, d1.x1 - d0.x0 + 0.5));
						const q = bend ? { ax: dx, az: dz, bx: bend[0], bz: bend[1], w, made: true } : { ax: dx, az: dz, bx: dx + nx * (best + 0.4), bz: dz + nz * (best + 0.4), w, made: true };
						cellIn(G.grid, q.ax, q.az).paths.push(q);
					}
				}
			} else {
				// (none across the front already: a mapped one, or this one made for a neighbour)
				const [cx, cz] = W((R0.x0 + R0.x1) / 2, R0.z1 + 2.5);
				if (!driveAt(cx, cz, (R0.x1 - R0.x0) / 2 + 2.5)) {
					for (const s of door.x < (R0.x0 + R0.x1) / 2 ? [1, -1] : [-1, 1]) {
						const lx = s > 0 ? R0.x1 + 1.9 : R0.x0 - 1.9;
						const [px, pz] = W(lx, R0.z1 - 4), [fx, fz] = W(lx, R0.z1 + 1);
						if (!clear(b.grp, px, pz, 1.7) || !clear(b.grp, fx, fz, 1.7)) continue;
						const [best] = toStreet(fx, fz, nx, nz, false);
						if (best > 32 || best < 0.8) continue;
						cellIn(G.grid, px, pz).paths.push({ ax: px, az: pz, bx: fx + nx * (best + 0.4), bz: fz + nz * (best + 0.4), w: 3.0, made: true, pad: true });
						break;
					}
				}
			}
			// ---- the walk
			const [wx, wz] = W(door.x, door.z + 0.05);
			mapped.length = 0; nearIn(G, 'paths', wx, wz, 30, mapped);
			if (mapped.some((q) => q.w < 2.2 && q.w > 0.6 && segDist(q.ax, q.az, q.bx, q.bz, wx + nx * 1.5, wz + nz * 1.5) < 2.5)) continue;   // (the map has one)
			const zl = door.z + 2.0, [ex, ez] = W(door.x, zl);
			let join = null;
			for (const q of mapped) {
				if (q.w < 2.2) continue;
				// where this drive crosses the line 2 m out from the front, in the house's frame
				const a = Lc(q.ax, q.az), c = Lc(q.bx, q.bz);
				if ((a[1] - zl) * (c[1] - zl) > 0) continue;
				const xl = a[0] + (c[0] - a[0]) * (zl - a[1]) / ((c[1] - a[1]) || 1e-9), d = Math.abs(xl - door.x);
				if (d < 10 && (!join || d < join.d)) join = { d, x: xl + Math.sign(door.x - xl) * (q.w / 2 - 0.3) };
			}
			if (join) {
				cellIn(G.grid, wx, wz).paths.push({ ax: wx, az: wz, bx: ex, bz: ez, w: 1.2, made: true, walk: true });
				if (Math.abs(join.x - door.x) > 0.8) { const [jx, jz] = W(join.x, zl); cellIn(G.grid, ex, ez).paths.push({ ax: ex, az: ez, bx: jx, bz: jz, w: 1.2, made: true, walk: true }); }
			} else {
				const [best] = toStreet(wx, wz, nx, nz, false);
				if (best <= 28 && best >= 1) cellIn(G.grid, wx, wz).paths.push({ ax: wx, az: wz, bx: wx + nx * (best + 0.4), bz: wz + nz * (best + 0.4), w: 1.2, made: true, walk: true });
			}
		}
	}
	async function load(i, signal) {
		const name = NAMES[i], base = new URL(`../assets/bayarea/real/${name}`, import.meta.url).href;
		const [H, bin, px] = await Promise.all([
			fetch(base + '.json', { signal }).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.json(); }),
			fetch(base + '.bin.gz', { signal }).then(gunzip),
			pixels(base + '.png', signal),
		]);
		if (signal.aborted) throw new DOMException('Tile cancelled', 'AbortError');
		const t0 = performance.now(), dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
		const breathe = breather(signal);
		// a region baked round another origin: shift it (the mapping is a pure translation in x)
		const shiftX = ((H.geo ? H.geo[1] : LON0_LEGACY) - LON0) * KX;
		const [OX, OZ] = [H.origin[0] + shiftX, H.origin[1]], U = H.unit, S = H.sections;
		const [bx0, bz0, bx1, bz1] = [H.bounds[0] + shiftX, H.bounds[1], H.bounds[2] + shiftX, H.bounds[3]];
		// what stands within 60 m of the seam with the procedural world is left to the procedural
		// towns, so nothing doubles there
		const inIb = (x, z) => realCovered(x, z);
		const G = { name, i, bounds: [bx0, bz0, bx1, bz1], reach: [bx0, bz0, bx1, bz1], grid: new Map(), boxes: [] };
		// roads: class, flags, name, points
		const roads = [];
		let o = S.roads[0];
		for (let n = 0; n < S.roads[1]; n++) {
			if ((n & 127) === 127) await breathe();
			const c = dv.getUint8(o), f = dv.getUint8(o + 1), nm = dv.getUint16(o + 2, true), k = dv.getUint16(o + 4, true); o += 6;
			// (a point repeated on the next is dropped: a zero-length piece has no direction)
			let pts = new Float32Array(k * 2), m = 0;
			for (let j = 0; j < k; j++, o += 4) {
				const x = dv.getInt16(o, true) * U + OX, z = dv.getInt16(o + 2, true) * U + OZ;
				if (m && Math.abs(x - pts[m * 2 - 2]) < 0.05 && Math.abs(z - pts[m * 2 - 1]) < 0.05) continue;
				pts[m * 2] = x; pts[m * 2 + 1] = z; m++;
			}
			if (m < 2) continue;
			if (m < k) pts = pts.slice(0, m * 2);
			const cls = H.classes[c];
			const r = { cls, w: H.widths[c], name: nm ? H.names[nm - 1] : '', bridge: !!(f & 1), link: !!(f & 2), end0: !!(f & 4), end1: !!(f & 8), divided: !!(f & 16), drive: DRIVE.has(cls), walked: WALKED.has(cls), pts };
			r.box = roadBox(r);
			putRoad(G, r);
			roads.push(r);
		}
		o = S.boxes[0];
		// Mt Diablo's summit building is modelled (diablo.js): its footprint here would stand
		// a second, ordinary building in the middle of it
		const sm = toWorld(SUMMIT.lat, SUMMIT.lon);
		for (let n = 0; n < S.boxes[1]; n++, o += 18) {
			if ((n & 1023) === 1023) await breathe();
			const kh = dv.getInt16(o + 14, true);
			const b = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 10000, wallH: dv.getInt16(o + 10, true) / 20, roofH: dv.getInt16(o + 12, true) / 20, kind: kh & 255, hip: kh >> 8, door: dv.getInt16(o + 16, true) / 1000 };
			if (!inIb(b.x, b.z) || Math.hypot(b.x - sm.x, b.z - sm.z) < 90 || LF.skip(b.x, b.z) || onLandmark(b.x, b.z, Math.max(b.w, b.d) / 2)) continue;
			G.boxes.push(b);
		}
		// a building's blocks, gathered into the house they make (houses.js builds them)
		groupBoxes(G.boxes);
		const moved = await setBack(G, breathe);
		await settleRegionSoon(G, onLandmark, signal);          // structures: no building through another, a street or a landmark
		// the occasional gas station and corner store, each on its own corner lot in place of the
		// houses there (siteplan.js): what else stood on a lot (its drives, walks, pool and yard
		// trees) is left off below
		const M = H.map, map = { px, w: M.w, h: M.h, x0: (M.x0 ?? H.bounds[0]) + shiftX, z0: M.z0 ?? H.bounds[1], step: M.step };
		const P = planSitesSteps({ roads, boxes: G.boxes }, { landAt: (x, z) => mapLand(map, x, z), bounds: G.bounds, avoid: (x, z, rad) => !inIb(x, z) || onLandmark(x, z, rad), ms: PARSE_MS });
		let plan;
		for (let r = P.next(); ; r = P.next()) { if (r.done) { plan = r.value; break; } await breathe(); }
		G.sites = plan.sites;
		const onLot = plan.clear;
		for (const q of plan.sites.flatMap((S) => S.aprons)) cellIn(G.grid, q.ax, q.az).paths.push(q);
		for (const b of G.boxes) cellIn(G.grid, b.x, b.z).boxes.push(b);
		o = S.paths[0];
		for (let n = 0; n < S.paths[1]; n++, o += 10) {
			if ((n & 1023) === 1023) await breathe();
			const p = { ax: dv.getInt16(o, true) * U + OX, az: dv.getInt16(o + 2, true) * U + OZ, bx: dv.getInt16(o + 4, true) * U + OX, bz: dv.getInt16(o + 6, true) * U + OZ, w: dv.getInt16(o + 8, true) / 20 };
			// (a drive or walk to a house set back goes on to its new front)
			for (const e of ['a', 'b']) for (const m of moved.get(Math.floor(p[e + 'x'] / 50) * 65536 + Math.floor(p[e + 'z'] / 50)) || []) if (Math.hypot(p[e + 'x'] - m.x, p[e + 'z'] - m.z) < m.r) { p[e + 'x'] += m.px; p[e + 'z'] += m.pz; break; }
			if (inIb(p.ax, p.az) && !onLot(p.ax, p.az) && !onLot(p.bx, p.bz) && !onLot((p.ax + p.bx) / 2, (p.az + p.bz) / 2)) cellIn(G.grid, p.ax, p.az).paths.push(p);
		}
		await addDrives(G, signal);
		if (signal?.aborted) throw new DOMException('Tile cancelled', 'AbortError');
		o = S.pools[0];
		for (let n = 0; n < S.pools[1]; n++, o += 10) {
			if ((n & 1023) === 1023) await breathe();
			const p = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 10000 };
			// (nothing domestic on Mt Diablo's summit: its buildings are dropped above, and their pools)
			if (inIb(p.x, p.z) && Math.hypot(p.x - sm.x, p.z - sm.z) > 400 && !onLot(p.x, p.z, Math.max(p.w, p.d) / 2)) cellIn(G.grid, p.x, p.z).pools.push(p);
		}
		o = S.trees[0];
		for (let n = 0; n < S.trees[1]; n++, o += 8) {
			if ((n & 2047) === 2047) await breathe();
			const t = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, h: dv.getInt16(o + 4, true) / 20, cone: dv.getInt16(o + 6, true) };
			if (!inIb(t.x, t.z) || LF.skip(t.x, t.z) || onLandmark(t.x, t.z, 2) || onLot(t.x, t.z, 1.5)) continue;
			cellIn(G.grid, t.x, t.z).trees.push(t);
		}
		for (const t of plan.trees) cellIn(G.grid, t.x, t.z).trees.push(t);
		// the coarse map, for what grows where (and drawn into the ground's, compose())
		G.map = map;
		// Lake Annabel's trees and its walk (lake.js), where this region holds it
		const [lx0, lz0, lx1, lz1] = LF.bounds;
		if (bx0 < lx0 && bz0 < lz0 && bx1 > lx1 && bz1 > lz1) {
			// (not on the roads and parking aisles)
			const local = (kind, x, z, rad) => { const out = []; nearIn(G, kind, x, z, rad, out); return out; };
			const onRoad = (x, z) => local('roads', x, z, 30).some((q) => { const p = q.pts; for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / l2)); if (Math.hypot(x - p[i] - dx * t, z - p[i + 1] - dz * t) < q.w / 2 + 2.5) return true; } return false; });
			const onBox = (x, z) => local('boxes', x, z, 60).some((b) => Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) / 2 + 3);
			for (const t of LF.trees) if (!onRoad(t.x, t.z) && !onBox(t.x, t.z)) cellIn(G.grid, t.x, t.z).trees.push(t);
			for (const q of LF.paths) cellIn(G.grid, q.ax, q.az).paths.push(q);
		}
		G.ms = Math.round(performance.now() - t0);
		return { G, attribution: H.attribution };
	}
	// the regions near you come, the far ones go (a few at a time, the nearest first)
	let checkX = 1e9, checkZ = 1e9, checkNear, lastCheck = 0;
	const gap = (i, x, z) => { const b = BOXES[i]; return Math.hypot(Math.max(0, b[0] - x, x - b[2]), Math.max(0, b[1] - z, z - b[3])); };
	function stream(x, z, loadNear) {
		const now = performance.now();
		if (loadNear === checkNear && Math.hypot(x - checkX, z - checkZ) < 60 && now - lastCheck < 1500) return;
		checkX = x; checkZ = z; checkNear = loadNear; lastCheck = now;
		for (const [i, task] of pending) if (!loadNear || gap(i, x, z) > DROP) {
			pending.delete(i); task.controller.abort(); cancelled++;
		}
		for (const [i, G] of live) if (gap(i, x, z) > DROP) drop(i, G);
		if (!loadNear) return;
		const want = [];
		for (let i = 0; i < NAMES.length; i++) if (!live.has(i) && !pending.has(i) && !failed.has(i)) { const d = gap(i, x, z); if (d < LOAD) want.push([d, i]); }
		want.sort((a, b) => a[0] - b[0]);
		for (const [, i] of want) {
			if (pending.size >= 2) break;
			const task = { controller: new AbortController() };
			pending.set(i, task);
			task.promise = load(i, task.controller.signal).then(({ G, attribution }) => {
				if (disposed || task.controller.signal.aborted || pending.get(i) !== task) return;
				pending.delete(i);
				if (gap(i, camX, camZ) > DROP) { late++; return; }          // (gone past it while it came)
				live.set(i, G);
				R.regions.push(G);
				R.attribution = attribution;
				R.loaded = true;
				changed(i, camX, camZ);
			}).catch((err) => {
				if (pending.get(i) !== task) return;
				pending.delete(i);
				const aborted = task.controller.signal.aborted;
				task.controller.abort();             // stop the other files when one fails
				if (disposed || aborted) return;
				failed.add(i); console.warn('real city', NAMES[i], err);
			});
		}
	}
	function drop(i, G) {
		live.delete(i);
		R.regions.splice(R.regions.indexOf(G), 1);
		R.loaded = R.regions.length > 0;
		changed(i, camX, camZ);
	}
	// what came or went: the ground's map and boxes again; news to the things built round you
	// only when it is near (the rest find it as they are built)
	let version = 0, genVersion = 0, quiet = 0;
	function changed(i, x, z) {
		roadV++;
		if (i < 0 || gap(i, x, z) < NEWS) version++; else quiet++;
		compose(); slots(x, z);
		for (const M2 of MAPS) M2.x = 1e9;          // repaint the road maps
	}

	// ---------- the ground's coarse map: the loaded regions' maps drawn into one ----------
	let comp = null;
	function compose() {
		const regs = [...live.values()];
		if (!regs.length) { comp?.tex.dispose(); comp = null; bindMain(); return; }
		let ux0 = 1e9, uz0 = 1e9, ux1 = -1e9, uz1 = -1e9;
		for (const { map: M } of regs) { ux0 = Math.min(ux0, M.x0); uz0 = Math.min(uz0, M.z0); ux1 = Math.max(ux1, M.x0 + M.w * M.step); uz1 = Math.max(uz1, M.z0 + M.h * M.step); }
		const step = Math.max(8, Math.min(...regs.map((G) => G.map.step)), Math.ceil(Math.max(ux1 - ux0, uz1 - uz0) / COMP));
		const w = Math.ceil((ux1 - ux0) / step), h = Math.ceil((uz1 - uz0) / step);
		if (!comp || comp.w !== w || comp.h !== h) {
			comp?.tex.dispose();
			const px = new Uint8Array(w * h * 4);
			const tex = new THREE.DataTexture(px, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
			tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false;
			comp = { w, h, px, tex };
		} else comp.px.fill(0);
		comp.x0 = ux0; comp.z0 = uz0; comp.step = step;
		// nearest texel, so the land use codes stay whole
		for (const { map: M } of regs) {
			const i0 = Math.max(0, Math.floor((M.x0 - ux0) / step)), i1 = Math.min(w, Math.ceil((M.x0 + M.w * M.step - ux0) / step));
			const j0 = Math.max(0, Math.floor((M.z0 - uz0) / step)), j1 = Math.min(h, Math.ceil((M.z0 + M.h * M.step - uz0) / step));
			const si = new Int32Array(i1 - i0);
			for (let i = i0; i < i1; i++) si[i - i0] = Math.min(M.w - 1, Math.max(0, Math.floor((ux0 + (i + 0.5) * step - M.x0) / M.step)));
			for (let j = j0; j < j1; j++) {
				const sj = Math.min(M.h - 1, Math.max(0, Math.floor((uz0 + (j + 0.5) * step - M.z0) / M.step)));
				const row = sj * M.w, out = j * w;
				for (let i = i0; i < i1; i++) {
					const s = (row + si[i - i0]) * 4, d = (out + i) * 4;
					if (M.px[s + 3] === 0) continue;
					comp.px[d] = M.px[s]; comp.px[d + 1] = M.px[s + 1]; comp.px[d + 2] = M.px[s + 2]; comp.px[d + 3] = 255;
				}
			}
		}
		comp.tex.needsUpdate = true;
		bindMain();
	}
	// the coarse map in the ground shader: a grown town's while one stands (the real regions are
	// far off whenever it does), else the loaded regions'
	function bindMain() {
		const G = gens[gens.length - 1];
		if (G) {
			REAL_U.uRealMap.value = G.tex;
			REAL_U.uRealR.value.set(G.map.x0, G.map.z0, G.map.step, 1);
			REAL_U.uRealB.value.set(...G.bounds);
		} else if (comp) {
			REAL_U.uRealMap.value = comp.tex;
			REAL_U.uRealR.value.set(comp.x0, comp.z0, comp.step, 1);
			REAL_U.uRealB.value.set(comp.x0, comp.z0, comp.x0 + comp.w * comp.step, comp.z0 + comp.h * comp.step);
		} else {
			// (and the map let go: a disposed texture still bound is uploaded again, and never freed)
			REAL_U.uRealMap.value = EMPTY_MAPS[3];
			REAL_U.uRealR.value.w = 0;
		}
	}
	// the boxes the shader keeps the procedural grid off: the loaded regions' and the grown
	// towns', those side by side merged, the nearest in the slots
	let slotX = 1e9, slotZ = 1e9;
	function slots(x, z) {
		slotX = x; slotZ = z;
		let bs = [...live.values(), ...gens].map((G) => [...G.bounds]);
		for (let merged = true; merged;) {
			merged = false;
			for (let a = 0; a < bs.length && !merged; a++) for (let b = 0; b < bs.length && !merged; b++) {
				if (a === b) continue;
				const A = bs[a], B = bs[b];
				const row = Math.abs(A[2] - B[0]) < 1 && Math.abs(A[1] - B[1]) < 1 && Math.abs(A[3] - B[3]) < 1;
				const col = Math.abs(A[3] - B[1]) < 1 && Math.abs(A[0] - B[0]) < 1 && Math.abs(A[2] - B[2]) < 1;
				if (row || col) { bs[a] = [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[2], B[2]), Math.max(A[3], B[3])]; bs.splice(b, 1); merged = true; }
			}
		}
		const d = (b) => Math.hypot(Math.max(0, b[0] - x, x - b[2]), Math.max(0, b[1] - z, z - b[3]));
		bs = bs.sort((a, b) => d(a) - d(b)).slice(0, REAL_SLOTS);
		const all = REAL_U.uRealAll.value.set(1e9, 1e9, -1e9, -1e9);
		REAL_U.uRealBs.value.forEach((v, k) => {
			const b = bs[k];
			if (!b) { v.set(1e9, 1e9, -1e9, -1e9); return; }
			v.set(...b);
			all.set(Math.min(all.x, b[0]), Math.min(all.y, b[1]), Math.max(all.z, b[2]), Math.max(all.w, b[3]));
		});
	}

	// roads added by hand where no mapped region reaches (the Golden Gate's deck and its
	// San Francisco approach): drivable like the mapped ones
	const hand = { name: 'hand', bounds: [0, 0, 0, 0], reach: [1e9, 1e9, -1e9, -1e9], grid: new Map() };
	function addRoads(list) {
		roadV++;
		for (const r of list) {
			r.drive = true; r.walked = false; r.hand = true;
			r.box = roadBox(r);
			putRoad(hand, r);
		}
	}
	// the region holding a point, inside its seams; its coarse map's
	const regionAt = (x, z) => R.regions.find(({ bounds: b, gen }) => (gen ? x > b[0] + 60 && z > b[1] + 60 && x < b[2] - 60 && z < b[3] - 60 : x > b[0] && z > b[1] && x < b[2] && z < b[3] && realCovered(x, z)));
	const mapAt = (x, z) => R.regions.find(({ map: M }) => x >= M.x0 && z >= M.z0 && x < M.x0 + M.w * M.step && z < M.z0 + M.h * M.step);
	const inside = (x, z) => !!regionAt(x, z);
	function nearIn(G, kind, x, z, rad, out) {
		const b = G.reach;
		if (x + rad < b[0] || x - rad > b[2] || z + rad < b[1] || z - rad > b[3]) return;
		const seen = kind === 'roads' ? new Set() : null;
		for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++) for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
			const g = G.grid.get(key(gx, gz));
			if (!g) continue;
			for (const o of g[kind]) { if (seen) { if (seen.has(o)) continue; seen.add(o); } out.push(o); }
		}
	}
	function near(kind, x, z, rad) {
		const out = nearOwn(kind, x, z, rad);
		for (const S of sources) S.near(kind, x, z, rad, out);
		return out;
	}
	// near() in its two parts: the regions' own and the hand-laid roads (which change only with
	// roadVersion), and what the other sources add (which can change without a word)
	function nearOwn(kind, x, z, rad) {
		const out = [];
		for (const G of R.regions) nearIn(G, kind, x, z, rad, out);
		if (kind === 'roads') nearIn(hand, kind, x, z, rad, out);
		return out;
	}
	function nearSources(kind, x, z, rad, out = []) {
		for (const S of sources) S.near(kind, x, z, rad, out);
		return out;
	}
	// other streets and roads that come and go on their own (the globe's highways, earth/globeroads.js):
	// a source's near(kind, x, z, rad, out) adds its own to what near() finds
	const sources = [];
	const addSource = (S) => { if (!sources.includes(S)) sources.push(S); };
	const removeSource = (S) => { const i = sources.indexOf(S); if (i >= 0) sources.splice(i, 1); };

	// ---------- Crysis: generated regions (see crysis/civgen.js and crysis/civ.js) ----------
	// A town grown by the civilization engine arrives in the same shape as a baked region
	// and joins it here: its own spatial grid (so it can be dropped again without touching
	// the real ones), its land-use map for landAt(), and while it stands, its map is the
	// ground shader's coarse map (bindMain), which paints its land use and streets, and its
	// box keeps the procedural grid off it. The real regions are far off whenever one stands.
	const gens = [];
	function addRegion(D) {
		const b = D.bounds;
		const G = { name: D.name, gen: true, bounds: b, reach: [...b], map: D.map, grid: new Map(), data: D };
		for (const r of D.roads) {
			r.box = roadBox(r); r.drive = DRIVE.has(r.cls); r.walked = WALKED.has(r.cls);
			putRoad(G, r);
		}
		// the generated town's houses are gathered like the real ones, so they are built
		// whole and can be walked into (houses.js)
		groupBoxes(D.boxes);
		// (its gas stations and corner stores as the real suburbs', away from its downtown)
		const plan = planSites({ roads: D.roads, boxes: D.boxes }, { landAt: (x, z) => mapLand(D.map, x, z), bounds: b, avoid: onLandmark });
		G.sites = plan.sites;
		for (const q of D.boxes) cellIn(G.grid, q.x, q.z).boxes.push(q);
		for (const p of D.paths) if (!plan.clear(p.ax, p.az) && !plan.clear(p.bx, p.bz)) cellIn(G.grid, p.ax, p.az).paths.push(p);
		for (const q of plan.sites.flatMap((S) => S.aprons)) cellIn(G.grid, q.ax, q.az).paths.push(q);
		for (const p of D.pools) if (!plan.clear(p.x, p.z, 2)) cellIn(G.grid, p.x, p.z).pools.push(p);
		for (const t of D.trees) if (!plan.clear(t.x, t.z, 1.5)) cellIn(G.grid, t.x, t.z).trees.push(t);
		for (const t of plan.trees) cellIn(G.grid, t.x, t.z).trees.push(t);
		const M = D.map;
		G.tex = new THREE.DataTexture(M.px, M.w, M.h, THREE.RGBAFormat, THREE.UnsignedByteType);
		G.tex.minFilter = G.tex.magFilter = THREE.LinearFilter; G.tex.colorSpace = THREE.NoColorSpace; G.tex.needsUpdate = true;
		gens.push(G);
		R.regions.unshift(G);                       // found first where it overlaps nothing real anyway
		R.loaded = true;
		genVersion++;
		changed(-1, camX, camZ);
		return G;
	}
	function removeRegion(G) {
		const i = gens.indexOf(G);
		if (i < 0) return;
		gens.splice(i, 1);
		R.regions.splice(R.regions.indexOf(G), 1);
		R.loaded = R.regions.length > 0;
		bindMain();
		G.tex.dispose();
		genVersion++;
		changed(-1, camX, camZ);
	}

	// ---------- the road maps round you: a fine one close by, a coarser one further out ----------
	// Each layer is drawn as distance, not coverage: 1 well inside, 0.5 exactly on the edge,
	// falling to 0 a ramp's width outside, blended by maximum so crossings union cleanly. The
	// ground shader cuts that at 0.5, so edges come out straight and sharp at any distance,
	// with no stair-steps from the texels. A second map carries the yellow lines.
	const mkRT = (res, fmt = THREE.RGBAFormat) => { const t = new THREE.WebGLRenderTarget(isPhone ? res / 2 : res, isPhone ? res / 2 : res, { format: fmt, samples: isPhone ? 0 : 4, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }); t.texture.colorSpace = THREE.NoColorSpace; return t; };
	const MAPS = [
		{ rt: mkRT(2048), paint: mkRT(2048), size: 512, ramp: 0.5, move: 110, x: 1e9, z: 1e9, u: [REAL_U.uRoadMap, REAL_U.uRoadR, REAL_U.uPaintMap] },
		{ rt: mkRT(1024), paint: null, size: 1536, ramp: 3, move: 380, x: 1e9, z: 1e9, u: [REAL_U.uRoadMap2, REAL_U.uRoadR2] },
	];
	const rt = MAPS[0].rt;
	// the paint target follows the quality tier: half its size and without multisampling on the
	// low tiers (world/governor.js), its shapes' ramps widened to match, and painted again
	const paintShare = () => (qualityNow().fx === 'low' ? 0.5 : 1);
	let paintK = 1;
	function sizePaint() {
		const k = paintShare(), M = MAPS[0];
		if (k === paintK || !M.paint) return;
		paintK = k;
		const res = (isPhone ? 1024 : 2048) * k;
		M.paint.samples = isPhone || k < 1 ? 0 : 4;
		M.paint.setSize(res, res);
		// (its twin made again from it when next needed, roadMapSteps)
		M.paintBack?.dispose(); M.paintBack = null;
		M.x = 1e9;
	}
	sizePaint();
	const unQuality = onQuality(sizePaint);
	R.repaint = () => { for (const M of MAPS) M.x = 1e9; };          // structures: the road maps painted again when new alleys come in
	const cam = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
	cam.position.z = 1;
	const scene2 = new THREE.Scene();
	const layerMat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

	// The shapes' vertices, kept from one road map to the next: positions (3 floats) and colours
	// (4) in typed arrays, one pair for each builder of a map (the shapes, the paint, the lanes'
	// wear). Made anew for each map, as plain arrays pushed to and then copied into typed ones,
	// a map's ran to millions of vertices (a phone's coarse map downtown, over 150 MB), most of a
	// walk's garbage. Where its target takes no multisampling (a phone's) a builder draws what it
	// has into it each CHUNK vertices and begins again: the layers are blended by maximum, so a
	// map drawn in pieces is the same map, and its store stays small (2.75 MB). A multisampled
	// target (a computer's) is drawn once, whole, and its store grows to hold it.
	const CHUNK = 3 * 32768;
	const pool = () => ({ P: new Float32Array(3 * CHUNK), C: new Float32Array(4 * CHUNK) });
	const POOLS = [pool(), pool(), pool()];
	// flat shapes in the road map's own space (x east, y south, in metres from its corner);
	// flush(mesh) draws a piece and the builder begins again (none: it grows)
	function builder(R0, S, flush = null) {
		let P = S.P, C = S.C, n = 0, cap = P.length / 3;
		const grow = () => {
			cap *= 2;
			const P2 = new Float32Array(cap * 3), C2 = new Float32Array(cap * 4);
			P2.set(P); C2.set(C);
			S.P = P = P2; S.C = C = C2;
		};
		// (stored as floats as they come: the same numbers the plain arrays' copy made; the shapes
		// come three vertices to a triangle, so a piece ends where a triangle does)
		const v = (x, y, col, k) => {
			if (n === cap) { if (flush) { flush(mesh()); n = 0; } else grow(); }
			const i = n * 3, j = n * 4;
			P[i] = x; P[i + 1] = y; P[i + 2] = 0;
			C[j] = col[0] * k; C[j + 1] = col[1] * k; C[j + 2] = col[2] * k; C[j + 3] = col[3] * k;
			n++;
		};
		// the value at distance d from the centre of a band of half-width hw
		const at = (hw, d) => Math.min(1, Math.max(0, 0.5 + (hw - d) / (2 * R0)));
		// a round blob: a fan to the inner radius, then the ramp ring out to the outer one
		const disc = (x, y, hw, col) => {
			const inner = Math.max(0, hw - R0), outer = hw + R0, vc = at(hw, inner), n = outer > 6 ? 24 : 12;
			for (let i = 0; i < n; i++) {
				const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
				if (inner > 0) { v(x, y, col, vc); v(x + c0 * inner, y + s0 * inner, col, vc); v(x + c1 * inner, y + s1 * inner, col, vc); }
				v(x + c0 * inner, y + s0 * inner, col, vc); v(x + c0 * outer, y + s0 * outer, col, 0); v(x + c1 * outer, y + s1 * outer, col, 0);
				v(x + c0 * inner, y + s0 * inner, col, vc); v(x + c1 * outer, y + s1 * outer, col, 0); v(x + c1 * inner, y + s1 * inner, col, vc);
			}
		};
		// a straight band: its flat middle and a ramp either side
		const band = (ax, ay, bx, by, hw, col) => {
			const L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
			const inner = Math.max(0, hw - R0), outer = hw + R0, vc = at(hw, inner);
			const strip = (o0, k0, o1, k1) => {
				v(ax + nx * o0, ay + ny * o0, col, k0); v(bx + nx * o0, by + ny * o0, col, k0); v(bx + nx * o1, by + ny * o1, col, k1);
				v(ax + nx * o0, ay + ny * o0, col, k0); v(bx + nx * o1, by + ny * o1, col, k1); v(ax + nx * o1, ay + ny * o1, col, k1);
			};
			if (inner > 0) strip(-inner, vc, inner, vc);
			else strip(0, vc, 0, vc);
			strip(inner, vc, outer, 0); strip(-inner, vc, -outer, 0);
		};
		// a line along a polyline, round at the joins, or dashed (dash, gap), offset sideways
		const line = (pts, hw, col, round = true, off = 0, dash = 0, gap = 0) => {
			let run = 0;
			for (let i = 0; i + 1 < pts.length; i++) {
				const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
				const L = Math.hypot(bx - ax, by - ay);
				if (L < 0.01) continue;
				const nx = -(by - ay) / L, ny = (bx - ax) / L;
				if (!dash) band(ax + nx * off, ay + ny * off, bx + nx * off, by + ny * off, hw, col);
				else for (let s = 0; s < L;) {
					const ph = run % (dash + gap), on = ph < dash, step = Math.max(1e-3, Math.min(L - s, on ? dash - ph : dash + gap - ph));      // (never a zero step)
					if (on) { const t0 = s / L, t1 = (s + step) / L; band(ax + (bx - ax) * t0 + nx * off, ay + (by - ay) * t0 + ny * off, ax + (bx - ax) * t1 + nx * off, ay + (by - ay) * t1 + ny * off, hw, col); }
					s += step; run += step;
				}
				if (round && !dash && i + 1 < pts.length - 1) disc(bx + nx * off, by + ny * off, hw, col);
			}
		};
		// (views of the store, no copy: drawn at once, before the store is filled again)
		function mesh() {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, n * 3), 3));
			g.setAttribute('color', new THREE.BufferAttribute(C.subarray(0, n * 4), 4));
			const m = new THREE.Mesh(g, layerMat); m.frustumCulled = false;
			return m;
		}
		// (what is left, drawn: the store free for the next)
		const rest = () => { const m = mesh(); n = 0; return m; };
		return { disc, line, mesh, rest };
	}
	// channels: R asphalt, G concrete, B dirt, A white lines; the paint map's R: yellow lines
	const ASPH = [1, 0, 0, 0], CONC = [0, 1, 0, 0], DIRT = [0, 0, 1, 0], WHITE = [0, 0, 0, 1], YELLOW = [1, 0, 0, 0], WEAR = [0, 1, 0, 0], JOINT = [0, 1, 0, 0], FWY = [0, 0.35, 0, 0];       // (the paint map holds two channels: both in green)
	// the asphalt's years, in the paint map's green below the freeway's: each lane a tent
	// falling from 0.07 at its centre to 0 at 1.8 m (so the ground knows where the wheels
	// run), a patch's plateau at 0.2, a cover at 0.28 (see asphaltAge in weathering.js)
	const LANE = [0, 0.14, 0, 0], PATCH = [0, 0.2, 0, 0], COVER = [0, 0.56, 0, 0];
	// a road's own dice, from where it starts, so its patches stay put
	const dice = (r) => { let h = (Math.imul(Math.round(r.pts[0] * 4), 73856093) ^ Math.imul(Math.round(r.pts[1] * 4), 19349663)) >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; };
	function wear(r, p, hw, Lb, Y) {
		const lanes = [];
		if (r.w < 6.5) lanes.push(0);
		else if (r.divided || r.link) { const n = Math.max(1, Math.round(r.w / 3.6)), lw = r.w / n; for (let k = 0; k < n; k++) lanes.push(-hw + lw * (k + 0.5)); }
		else for (let k = 0, n = Math.max(1, Math.floor(r.w / 7.2)); k < n; k++) lanes.push(1.8 + 3.6 * k, -1.8 - 3.6 * k);
		for (const o of lanes) Lb.line(p, 0, LANE, true, o);
		const rnd = dice(r);
		let run = rnd() * 40;
		for (let i = 0; i + 1 < p.length; i++) {
			const [ax, ay] = p[i], [bx, by] = p[i + 1], L = Math.hypot(bx - ax, by - ay);
			if (L < 2) continue;
			const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx;
			const at = (s, o) => [ax + tx * s + nx * o, ay + ty * s + ny * o];
			// patched rectangles in the lanes, a trench cut across or along now and then
			for (let n = 0, N = Math.floor(L / 55 + rnd()); n < N; n++) {
				const s = rnd() * L, len = 1.5 + rnd() * 4, o = lanes[Math.floor(rnd() * lanes.length)] + (rnd() - 0.5) * 0.8;
				const pw = Math.min(0.7 + rnd() * 0.7, hw - Math.abs(o) - 0.2);
				if (pw > 0.3) Y.line([at(s, o), at(Math.min(L, s + len), o)], pw, PATCH, false);
			}
			if (rnd() < L / 260) { const s = rnd() * L, a = at(s, -hw + 0.3), b = at(s, hw - 0.3); Y.line([a, b], 0.3 + rnd() * 0.3, PATCH, false); }
			if (rnd() < L / 380) { const s = rnd() * L, o = (rnd() - 0.5) * hw, a = at(s, o), b = at(Math.min(L, s + 12 + rnd() * 40), o); Y.line([a, b], 0.35 + rnd() * 0.15, PATCH, false); }
			// manholes and utility covers, every forty metres or so
			let s = run;
			for (; s < L; s += 35 + rnd() * 30) { const c = at(s, rnd() < 0.5 ? 0 : lanes[0]); Y.disc(c[0], c[1], rnd() < 0.3 ? 0.18 : 0.26, COVER); }
			run = s - L;
		}
	}
	// shapes drawn into a road map's target, cleared first (fresh) or added to it; let go at once
	// (the shapes are sent to the card: they run to tens of MB)
	const prevColor = new THREE.Color();
	function render(target, meshes, SIZE, fresh) {
		const prev = renderer.getRenderTarget(), pc = renderer.getClearColor(prevColor), pa = renderer.getClearAlpha(), auto = renderer.autoClear;
		for (const m of meshes) scene2.add(m);
		cam.left = 0; cam.right = SIZE; cam.bottom = 0; cam.top = SIZE; cam.updateProjectionMatrix();
		renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0);
		if (fresh) renderer.clear(true, false, false);
		renderer.autoClear = false;
		try { renderer.render(scene2, cam); } finally {
			renderer.autoClear = auto;
			renderer.setRenderTarget(prev); renderer.setClearColor(pc, pa);
			for (const m of meshes) { scene2.remove(m); m.geometry.dispose(); }
		}
	}
	// a street has sidewalks where it runs through town, not out on the mountain
	function built(r) {
		if (r.built === undefined) {
			const k = Math.floor(r.pts.length / 4) * 2, L = landAt(r.pts[k], r.pts[k + 1]);
			r.built = !!L && L.lu > 0 && (L.lu < 11 || L.lu === 13);
		}
		return r.built;
	}
	// The corners of a town's junctions, where three or more legs of street meet: a crosswalk
	// across each leg just clear of the cross street's sidewalk (continental stripes along the
	// traffic downtown and on the arterials, two plain lines in the suburbs), a stop bar across
	// the lane coming in, and the yellow domes of a curb ramp at either end of the crosswalk.
	const CROSS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
	// the direction a street leaves point j heading d (+1 on along its points, -1 back),
	// measured at distance a along it; null if it ends sooner than a + 9 m
	function legAt(p, j, d, a) {
		let got = 0;
		for (let i = j; i + d * 2 >= 0 && i + d * 2 < p.length; i += d * 2) {
			const ax = p[i], az = p[i + 1], bx = p[i + d * 2], bz = p[i + d * 2 + 1], l = Math.hypot(bx - ax, bz - az);
			if (got + l >= a + 9) {
				// (the crosswalk's own stretch: from where it starts to a little past it)
				const ox = p[j], oz = p[j + 1], t = Math.min(1, Math.max(0, (a - got) / (l || 1))), cx = ax + (bx - ax) * t, cz = az + (bz - az) * t, L2 = Math.hypot(cx - ox, cz - oz);
				return L2 > 1 ? [(cx - ox) / L2, (cz - oz) / L2] : [(bx - ax) / l, (bz - az) / l];
			}
			got += l;
		}
		return null;
	}
	let crossings = [];
	// (into a list of its own, out: it becomes crossings when its map is drawn; a slice at a time)
	function* corners(all, x0, z0, B, Y, out) {
		const nodes = new Map(), nk = (x, z) => Math.round(x / 1.5) * 65536 + Math.round(z / 1.5);
		for (const r of all) {
			if (!r.drive || r.bridge || r.link || r.hand || !CROSS.has(r.cls) || !r.walked) continue;
			const p = r.pts, m = p.length, b = built(r);
			for (let i = 0; i < m; i += 2) {
				const k = nk(p[i], p[i + 1]);
				let n = nodes.get(k);
				if (!n) nodes.set(k, n = { x: p[i], z: p[i + 1], legs: [], built: false });
				n.built = n.built || b;
				// the legs leaving this point: toward the next point, and back toward the last
				if (i + 2 < m) n.legs.push({ r, j: i, d: 1 });
				if (i > 0) n.legs.push({ r, j: i, d: -1 });
			}
		}
		yield;
		let count = 0;
		for (const n of nodes.values()) {
			// (in town: one of its streets at least among built-up land)
			if (n.legs.length < 3 || !n.built) continue;
			if ((++count & 31) === 0) yield;
			const L = landAt(n.x, n.z), city = !!L && (L.lu === 7 || L.lu === 8);
			for (const g of n.legs) {
				const { r, j, d } = g, p = r.pts, hw = r.w / 2;
				// the cross streets' widest reach from the corner: their half-width and sidewalk
				let reach = 0;
				for (const o of n.legs) if (o.r !== r) reach = Math.max(reach, o.r.w / 2 + 1.7);
				// the way the leg leaves, taken where its crosswalk will lie (its first points are
				// often only a few metres apart)
				const along = legAt(p, j, d, reach + 2.3);
				if (!along) continue;
				const [ux, uz] = along, nx = -uz, nz = ux;
				const big = city || r.cls === 'primary' || r.cls === 'secondary';
				// (a point a metres out along the leg and b across it, in the map's space)
				const at = (a, b) => [n.x + ux * a + nx * b - x0, n.z + uz * a + nz * b - z0];
				const c0 = reach + 0.8, c1 = c0 + 3;
				// (each crosswalk, for whoever walks them: crosswalks.js)
				out.push({ x: n.x + ux * (c0 + 1.5), z: n.z + uz * (c0 + 1.5), ux, uz, hw, city: big });
				if (big) for (let b = -hw + 0.9; b <= hw - 0.6; b += 1.2) B.line([at(c0, b), at(c1, b)], 0.3, WHITE, false);
				else for (const a of [c0, c1]) B.line([at(a, -hw + 0.3), at(a, hw - 0.3)], 0.15, WHITE, false);
				// the stop bar across the lane coming in (the right of traffic heading for the corner)
				if (!r.divided) B.line([at(c1 + 1.2, -hw + 0.4), at(c1 + 1.2, -0.25)], 0.22, WHITE, false);
				// the curb ramps' domes, on the sidewalk either end of the crosswalk
				for (const sd of [-1, 1]) Y.line([at(c0 + 0.6, sd * (hw + 0.45)), at(c1 - 0.6, sd * (hw + 0.45))], 0.45, YELLOW, false);
			}
		}
	}
	// A freeway carriageway's paving (fwyplan.js): its lanes, the right shoulder, and on the
	// left the shoulder out to the median wall (to the middle, where the two directions share
	// one) or a 3 m shoulder where the median is ground. Laid in runs of one width, the median
	// read every 16 m or so; the paint map marks it all as a freeway's concrete.
	function fwyPaving(r, CW, B, Y, x0, z0) {
		const p = r.pts, hw = r.w / 2, st = [];
		for (let i = 0; i + 3 < p.length; i += 2) {
			const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az);
			if (L < 0.01) continue;
			const n = Math.max(1, Math.ceil(L / 16));
			for (let k = st.length ? 1 : 0; k <= n; k++) st.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, dx: (bx - ax) / L, dz: (bz - az) / L });
		}
		if (st.length < 2) return;
		const med = medianAlong(CW, r, st);
		// (in the builder's terms: + is to the right of the direction of travel)
		const left = med.map((m) => Math.round(m.pave * 4) / 4), right = hw + SHOULDER_R;
		let run = [st[0]], at = left[0];
		const flush = () => {
			const pts = run.map((q) => [q.x - x0, q.z - z0]), off = (right - at) / 2, half = (right + at) / 2;
			B.line(pts, half, CONC, true, off);
			Y?.line(pts, half, FWY, true, off);
			// (round where one width meets the next, and at the road's ends)
			for (const q of [run[0], run[run.length - 1]]) B.disc(q.x - x0 - q.dz * off, q.z - z0 + q.dx * off, half, CONC);
		};
		for (let i = 1; i < st.length; i++) {
			run.push(st[i]);
			if (left[i] !== at || i === st.length - 1) { flush(); run = [st[i]]; at = left[i]; }
		}
	}
	// A road map round (cx, cz), built a slice at a time (update: a few milliseconds a frame) and
	// drawn into a twin of its targets, swapped in when it is whole: the one drawn before stays on
	// the ground till then. Done in one go the fine map held a phone's frame for the best part of
	// a second, and sent the card the whole map's shapes at once.
	//   once: drawn straight into the targets shown, this frame (nothing is shown yet, or it is far
	//   off)
	function* roadMapSteps(M, cx, cz, once) {
		M.x = cx; M.z = cz;
		const SIZE = M.size, x0 = cx - SIZE / 2, z0 = cz - SIZE / 2, fine = !!M.paint;
		// (a phone's maps are half the size: the ramps keep two texels, or the edges stair-step)
		const ramp = M.ramp * (isPhone ? 2 : 1);
		const tRoad = once ? M.rt : (M.rtBack ||= M.rt.clone()), tPaint = !fine ? null : once ? M.paint : (M.paintBack ||= M.paint.clone());
		const drawn = new Set(), into = (t) => (t && !t.samples ? (m) => { render(t, [m], SIZE, !drawn.has(t)); drawn.add(t); } : null);
		const B = builder(ramp, POOLS[0], into(tRoad)), Y = builder(ramp / paintK, POOLS[1], into(tPaint)), Lb = builder(1.8, POOLS[2], into(tPaint));
		const loc = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push([pts[i] - x0, pts[i + 1] - z0]); return out; };
		const all = near('roads', cx, cz, SIZE * 0.72), lanes = all.filter((q) => q.drive && !q.bridge);
		yield;
		// the freeways' paving first: lanes, shoulders, and the left shoulder out to the median
		const CW = carriageways(all);
		let count = 0;
		for (const r of all) if (isCarriageway(r) && !r.hand) { fwyPaving(r, CW, B, fine ? Y : null, x0, z0); if ((++count & 7) === 0) yield; }
		for (const r of all) {
			if ((++count & 7) === 0) yield;
			// (a road added by hand is driven, not painted: where it runs through a mapped region the
			// mapped one is on the ground already)
			if (r.hand) continue;
			// (a footbridge over a street is its own deck, freeways.js)
			if (r.bridge && footLifted(r, lanes)) continue;
			const p = loc(r.pts), hw = r.w / 2;
			if (r.cls === 'path' || r.cls === 'track') { B.line(p, hw, DIRT); continue; }
			if (r.cls === 'footway' || r.cls === 'steps' || r.cls === 'pedestrian') { B.line(p, hw, CONC); continue; }
			if (r.walked && !r.bridge && built(r)) {
				// the sidewalk and kerb both sides, the concrete rounding the corners
				B.line(p, hw + 1.7, CONC);
				for (const q of [p[0], p[p.length - 1]]) B.disc(q[0], q[1], hw + 1.7, CONC);
			}
			// (a bridge is its own deck, freeways.js: not painted on the ground it crosses)
			if (r.bridge && r.drive) continue;
			// the freeways are pale concrete, as Caltrans pours them (paved above, fwyPaving)
			const surf = r.cls === 'motorway' && !r.link ? CONC : ASPH;
			if (surf === ASPH) {
				B.line(p, hw, surf);
				for (const q of [p[0], p[p.length - 1]]) B.disc(q[0], q[1], hw, surf);
			}
			// a cul-de-sac's turning circle, sidewalk round it
			for (const [end, q] of [[r.end0, p[0]], [r.end1, p[p.length - 1]]]) if (end) { B.disc(q[0], q[1], 14.2, CONC); B.disc(q[0], q[1], 12.5, ASPH); }
			if (!fine) continue;
			// lane lines: a double yellow centre line on the collectors, lanes on divided roads
			if ((r.cls === 'secondary' || r.cls === 'tertiary' || r.cls === 'primary' || r.cls === 'unclassified') && !r.divided && !r.link && r.w >= 9) Y.line(p, 0.17, YELLOW, true);                                   // reads as the double yellow
			// the freeway's concrete: dark tyre-worn bands down each lane's wheel paths and the
			// slabs' transverse joints (the paint map's green)
			if (r.cls === 'motorway' && !r.link) {
				const { n: nL, lw } = lanesOf(r);
				for (let k = 0; k < nL; k++) for (const e of [-0.85, 0.85]) Y.line(p, 0.42, WEAR, false, -hw + lw * (k + 0.5) + e);
				Y.line(p, hw - 0.3, JOINT, false, 0, 0.25, 4.3);
			}
			if (surf === ASPH && r.drive && !r.bridge) wear(r, p, hw, Lb, Y);
			if (self) paintStreet(r, p, Y, ramp / paintK, eraMap(self).ofRoad(r), r.walked && built(r), x0, z0);          // streets by era (potholes.js)
			// a freeway's lanes: dashed white between them (12 ft dashes, 36 ft gaps), solid white
			// along the right shoulder, solid yellow along the left
			if (isCarriageway(r)) {
				const { n: nL, lw } = lanesOf(r);
				for (let k = 1; k < nL; k++) B.line(p, 0.1, WHITE, false, -hw + lw * k, 3.66, 11);
				B.line(p, 0.12, WHITE, true, hw); Y.line(p, 0.12, YELLOW, true, -hw);
			} else if (r.divided || r.cls === 'motorway' || r.cls === 'trunk') { B.line(p, 0.15, WHITE, false, hw / 3, 3, 9); B.line(p, 0.15, WHITE, false, -hw / 3, 3, 9); B.line(p, 0.15, WHITE, true, hw - 0.6); Y.line(p, 0.15, YELLOW, true, -hw + 0.6); }
		}
		const cross = [];
		if (fine) yield* corners(all, x0, z0, B, Y, cross);
		yield;
		// driveways and front walks
		count = 0;
		for (const q of near('paths', cx, cz, SIZE * 0.72)) {
			if ((++count & 255) === 0) yield;
			B.line([[q.ax - x0, q.az - z0], [q.bx - x0, q.bz - z0]], q.w / 2, CONC, false);
		}
		// the gas stations' and corner stores' paving and their parking spaces' lines (siteplan.js)
		for (const S of sites(cx, cz, SIZE * 0.72)) for (const [ax, az, bx, bz, hw, k] of S.ground) {
			if (k === 2 && !fine) continue;
			B.line([[ax - x0, az - z0], [bx - x0, bz - z0]], hw, k === 2 ? WHITE : k ? CONC : ASPH, false);
		}
		// what is left of the shapes drawn, the twins swapped in
		render(tRoad, [B.rest()], SIZE, !drawn.has(tRoad));
		if (fine) render(tPaint, [Lb.rest(), Y.rest()], SIZE, !drawn.has(tPaint));
		if (!once) { M.rtBack = M.rt; M.rt = tRoad; if (fine) { M.paintBack = M.paint; M.paint = tPaint; } }
		if (fine) crossings = cross;
		M.u[0].value = M.rt.texture;
		M.u[1].value.set(x0, z0, SIZE, 1);
		if (M.paint) M.u[2].value = M.paint.texture;
	}
	// the map being built (one at a time), and how long a frame gives it: its own few milliseconds,
	// a share of a slow frame (world/buildslice.js). The first map, and one where you have gone far
	// past the one drawn (a teleport, a fast flight), is built at once.
	const SLICE = isPhone ? 4 : 6;
	let job = null, lastT = 0;
	function stepMap(dt) {
		const t0 = performance.now(), budget = job.once ? Infinity : buildSlice(dt, SLICE);
		while (job && performance.now() - t0 < budget) if (job.it.next().done) job = null;
	}

	function update(camera) {
		if (disposed) return;
		const x = camera.position.x, z = camera.position.z;
		camX = x; camZ = z;
		stream(x, z, camera.position.y < 6000);
		if (!R.loaded) { for (const M of MAPS) { M.u[1].value.w = 0; M.x = 1e9; } return; }
		if (Math.hypot(x - slotX, z - slotZ) > 400) slots(x, z);
		const on = camera.position.y < 3000 && R.regions.some(({ reach: b }) => x > b[0] - 800 && z > b[1] - 800 && x < b[2] + 800 && z < b[3] + 800);
		const now = performance.now(), dt = lastT ? (now - lastT) / 1000 : 0;
		lastT = now;
		// (a map asked for again while it was being built, the regions changed or the paint
		// resized, is begun again: what it had is stale)
		if (job && (job.M.x !== job.x || job.M.z !== job.z)) job = null;
		for (const M of MAPS) {
			if (!on) { M.u[1].value.w = 0; M.x = 1e9; continue; }
			if (!job && Math.hypot(x - M.x, z - M.z) > M.move) {          // one map at a time
				const u = M.u[1].value, once = u.w === 0 || Math.hypot(x - (u.x + u.z / 2), z - (u.y + u.z / 2)) > M.size * 0.4;
				job = { M, x, z, once, it: roadMapSteps(M, x, z, once) };
				break;
			}
		}
		if (job && on) stepMap(dt);
		else job = null;
	}

	// the coarse map at a point: land use (0 wild), roads and roofs coverage
	function landAt(x, z) {
		const M = mapAt(x, z)?.map;
		return M ? mapLand(M, x, z) : null;
	}
	// the gas stations and corner stores within rad of a point (bay/forecourts.js builds them)
	function sites(x, z, rad) {
		const out = [];
		for (const G of R.regions) for (const s of G.sites || []) if (Math.abs(s.x - x) < rad && Math.abs(s.z - z) < rad) out.push(s);
		return out;
	}

	// the nearest point on a sidewalk: [x, z, heading along the street]
	function sidewalk(x, z) {
		let best = null, bd = 1e9;
		for (const r of near('roads', x, z, 120)) {
			if (!r.walked) continue;
			const p = r.pts;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
				const px = ax + dx * t, pz = az + dz * t, L = Math.sqrt(L2), nx = -dz / L, nz = dx / L;
				const side = (x - px) * nx + (z - pz) * nz > 0 ? 1 : -1, off = r.w / 2 + 0.9;
				const sx = px + nx * off * side, sz = pz + nz * off * side, d = Math.hypot(sx - x, sz - z);
				if (d < bd) { bd = d; best = [sx, sz, Math.atan2(dx, dz)]; }
			}
		}
		return best;
	}

	function dispose() {
		if (disposed) return;
		disposed = true;
		job = null;
		unQuality();
		for (const task of pending.values()) task.controller.abort();
		pending.clear();
		for (const [i, M] of MAPS.entries()) {
			if (M.u[0].value === M.rt.texture) { M.u[0].value = EMPTY_MAPS[i]; M.u[1].value.w = 0; }
			if (M.paint && M.u[2].value === M.paint.texture) M.u[2].value = EMPTY_MAPS[2];
			M.rt.dispose(); M.paint?.dispose(); M.rtBack?.dispose(); M.paintBack?.dispose();
		}
		if (REAL_U.uRealMap.value === comp?.tex || gens.some((G) => REAL_U.uRealMap.value === G.tex)) {
			REAL_U.uRealMap.value = EMPTY_MAPS[3]; REAL_U.uRealR.value.w = 0;
			REAL_U.uRealB.value.copy(NOWHERE()); REAL_U.uRealAll.value.copy(NOWHERE());
			for (const b of REAL_U.uRealBs.value) b.copy(NOWHERE());
		}
		comp?.tex.dispose(); comp = null;
		for (const G of gens) G.tex.dispose();
		layerMat.dispose();
		live.clear(); gens.length = 0; sources.length = 0; hand.grid.clear(); failed.clear(); roadV++;
		R.regions.length = 0; R.loaded = false;
	}

	// (loaded: how many regions are in; version: what stands round you changed; genVersion: a grown
	// town came or went; roadVersion: the regions' or the hand-laid roads changed, anywhere)
	return (self = { R, inside, regionAt, near, nearOwn, nearSources, roadVersion: () => roadV, update, dispose, sidewalk, landAt, sites, crossings: () => crossings, rt, loaded: () => R.loaded, addRegion, removeRegion, addRoads, addSource, removeSource, sourceVersion: () => sources.map((s) => s.version?.() || 0).join(':'), version: () => version, genVersion: () => genVersion, info: () => ({ live: [...live.values()].map((G) => G.name), ms: [...live.values()].map((G) => G.ms), pending: pending.size, failed: [...failed].map((i) => NAMES[i]), version, quiet, late, cancelled, disposed, cam: [Math.round(camX), Math.round(camZ)], comp: comp && [comp.w, comp.h, comp.step] }), ponds: () => gens.flatMap((G) => G.data.ponds || []), genParks: () => gens.flatMap((G) => (G.data.parks || []).map((q) => ({ ...q, town: G.name }))) });
}
