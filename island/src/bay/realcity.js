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
import { groupBoxes } from './houseplan.js';
import { SUMMIT } from './diablo.js';
import { lakeFeatures } from './lake.js';
import { onLandmark } from './footprints.js';
import { REAL_REGIONS, REAL_TALL } from './realtiles.js';

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
const PHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
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
// a region is fetched when you come this near its edge and dropped when you are this far
// (the buildings stand to 2 km, the trees a little further); a change this near you is
// news to everything built round you (version()); a phone keeps less of the map in memory
const LOAD = PHONE ? 2000 : 3000, DROP = PHONE ? 2800 : 4500, NEWS = 2600;
// the coarse maps round you are drawn into one, at most this many texels a side
const COMP = PHONE ? 1024 : 2048;

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
	let disposed = false, cancelled = 0;
	let camX = 1e9, camZ = 1e9, late = 0;

	async function load(i, signal) {
		const name = NAMES[i], base = new URL(`../assets/bayarea/real/${name}`, import.meta.url).href;
		const [H, bin, px] = await Promise.all([
			fetch(base + '.json', { signal }).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.json(); }),
			fetch(base + '.bin.gz', { signal }).then(gunzip),
			pixels(base + '.png', signal),
		]);
		if (signal.aborted) throw new DOMException('Tile cancelled', 'AbortError');
		const t0 = performance.now(), dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
		// a region baked round another origin: shift it (the mapping is a pure translation in x)
		const shiftX = ((H.geo ? H.geo[1] : LON0_LEGACY) - LON0) * KX;
		const [OX, OZ] = [H.origin[0] + shiftX, H.origin[1]], U = H.unit, S = H.sections;
		const [bx0, bz0, bx1, bz1] = [H.bounds[0] + shiftX, H.bounds[1], H.bounds[2] + shiftX, H.bounds[3]];
		// what stands within 60 m of the seam with the procedural world is left to the procedural
		// towns, so nothing doubles there
		const inIb = (x, z) => realCovered(x, z);
		const G = { name, i, bounds: [bx0, bz0, bx1, bz1], reach: [bx0, bz0, bx1, bz1], grid: new Map(), boxes: [] };
		// roads: class, flags, name, points
		let o = S.roads[0];
		for (let n = 0; n < S.roads[1]; n++) {
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
		}
		o = S.boxes[0];
		// Mt Diablo's summit building is modelled (diablo.js): its footprint here would stand
		// a second, ordinary building in the middle of it
		const sm = toWorld(SUMMIT.lat, SUMMIT.lon);
		for (let n = 0; n < S.boxes[1]; n++, o += 18) {
			const kh = dv.getInt16(o + 14, true);
			const b = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 10000, wallH: dv.getInt16(o + 10, true) / 20, roofH: dv.getInt16(o + 12, true) / 20, kind: kh & 255, hip: kh >> 8, door: dv.getInt16(o + 16, true) / 1000 };
			if (!inIb(b.x, b.z) || Math.hypot(b.x - sm.x, b.z - sm.z) < 90 || LF.skip(b.x, b.z) || onLandmark(b.x, b.z, Math.max(b.w, b.d) / 2)) continue;
			G.boxes.push(b);
		}
		// a building's blocks, gathered into the house they make (houses.js builds them)
		groupBoxes(G.boxes);
		for (const b of G.boxes) cellIn(G.grid, b.x, b.z).boxes.push(b);
		o = S.paths[0];
		for (let n = 0; n < S.paths[1]; n++, o += 10) {
			const p = { ax: dv.getInt16(o, true) * U + OX, az: dv.getInt16(o + 2, true) * U + OZ, bx: dv.getInt16(o + 4, true) * U + OX, bz: dv.getInt16(o + 6, true) * U + OZ, w: dv.getInt16(o + 8, true) / 20 };
			if (inIb(p.ax, p.az)) cellIn(G.grid, p.ax, p.az).paths.push(p);
		}
		o = S.pools[0];
		for (let n = 0; n < S.pools[1]; n++, o += 10) {
			const p = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 10000 };
			if (inIb(p.x, p.z)) cellIn(G.grid, p.x, p.z).pools.push(p);
		}
		o = S.trees[0];
		for (let n = 0; n < S.trees[1]; n++, o += 8) {
			const t = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, h: dv.getInt16(o + 4, true) / 20, cone: dv.getInt16(o + 6, true) };
			if (!inIb(t.x, t.z) || LF.skip(t.x, t.z) || onLandmark(t.x, t.z, 2)) continue;
			cellIn(G.grid, t.x, t.z).trees.push(t);
		}
		// the coarse map, for what grows where (and drawn into the ground's, compose())
		const M = H.map;
		G.map = { px, w: M.w, h: M.h, x0: (M.x0 ?? H.bounds[0]) + shiftX, z0: M.z0 ?? H.bounds[1], step: M.step };
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
		} else REAL_U.uRealR.value.w = 0;
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
		const out = [];
		for (const G of R.regions) nearIn(G, kind, x, z, rad, out);
		if (kind === 'roads') nearIn(hand, kind, x, z, rad, out);
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
		for (const q of D.boxes) cellIn(G.grid, q.x, q.z).boxes.push(q);
		for (const p of D.paths) cellIn(G.grid, p.ax, p.az).paths.push(p);
		for (const p of D.pools) cellIn(G.grid, p.x, p.z).pools.push(p);
		for (const t of D.trees) cellIn(G.grid, t.x, t.z).trees.push(t);
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
		{ rt: mkRT(2048), paint: mkRT(2048, THREE.RGFormat), size: 512, ramp: 0.5, move: 110, x: 1e9, z: 1e9, u: [REAL_U.uRoadMap, REAL_U.uRoadR, REAL_U.uPaintMap] },
		{ rt: mkRT(1024), paint: null, size: 1536, ramp: 3, move: 380, x: 1e9, z: 1e9, u: [REAL_U.uRoadMap2, REAL_U.uRoadR2] },
	];
	const rt = MAPS[0].rt;
	const cam = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
	cam.position.z = 1;
	const scene2 = new THREE.Scene();
	const layerMat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

	// flat shapes in the road map's own space (x east, y south, in metres from its corner)
	function builder(R0) {
		const P = [], C = [];
		const v = (x, y, col, k) => { P.push(x, y, 0); C.push(col[0] * k, col[1] * k, col[2] * k, col[3] * k); };
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
		const mesh = () => {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
			const m = new THREE.Mesh(g, layerMat); m.frustumCulled = false;
			return m;
		};
		return { disc, line, mesh };
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
	function render(target, meshes, SIZE) {
		for (const m of [...scene2.children]) { scene2.remove(m); m.geometry.dispose(); }
		for (const m of meshes) scene2.add(m);
		cam.left = 0; cam.right = SIZE; cam.bottom = 0; cam.top = SIZE; cam.updateProjectionMatrix();
		renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
		renderer.render(scene2, cam);
	}
	// a street has sidewalks where it runs through town, not out on the mountain
	function built(r) {
		if (r.built === undefined) {
			const k = Math.floor(r.pts.length / 4) * 2, L = landAt(r.pts[k], r.pts[k + 1]);
			r.built = !!L && L.lu > 0 && (L.lu < 11 || L.lu === 13);
		}
		return r.built;
	}
	function drawRoadMap(M, cx, cz) {
		M.x = cx; M.z = cz;
		const SIZE = M.size, x0 = cx - SIZE / 2, z0 = cz - SIZE / 2;
		// (a phone's maps are half the size: the ramps keep two texels, or the edges stair-step)
		const ramp = M.ramp * (isPhone ? 2 : 1);
		const B = builder(ramp), Y = builder(ramp), Lb = builder(1.8), fine = !!M.paint;
		const loc = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push([pts[i] - x0, pts[i + 1] - z0]); return out; };
		for (const r of near('roads', cx, cz, SIZE * 0.72)) {
			// (a road added by hand is driven, not painted: where it runs through a mapped region the
			// mapped one is on the ground already)
			if (r.hand) continue;
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
			// the freeways are pale concrete, as Caltrans pours them
			const surf = r.cls === 'motorway' && !r.link ? CONC : ASPH;
			B.line(p, hw, surf);
			for (const q of [p[0], p[p.length - 1]]) B.disc(q[0], q[1], hw, surf);
			// a cul-de-sac's turning circle, sidewalk round it
			for (const [end, q] of [[r.end0, p[0]], [r.end1, p[p.length - 1]]]) if (end) { B.disc(q[0], q[1], 14.2, CONC); B.disc(q[0], q[1], 12.5, ASPH); }
			if (!fine) continue;
			// lane lines: a double yellow centre line on the collectors, lanes on divided roads
			if ((r.cls === 'secondary' || r.cls === 'tertiary' || r.cls === 'primary' || r.cls === 'unclassified') && !r.divided && !r.link && r.w >= 9) Y.line(p, 0.17, YELLOW, true);                                   // reads as the double yellow
			// the freeway's concrete: dark tyre-worn bands down each lane's wheel paths and the
			// slabs' transverse joints (the paint map's green)
			if (r.cls === 'motorway' && !r.link) {
				Y.line(p, hw, FWY, true);                   // (the whole carriageway, faintly: it marks the concrete as a freeway's)
				const nL = Math.max(2, Math.round(r.w / 3.7)), lw = r.w / nL;
				for (let k = 0; k < nL; k++) for (const e of [-0.85, 0.85]) Y.line(p, 0.42, WEAR, false, -hw + lw * (k + 0.5) + e);
				Y.line(p, hw - 0.3, JOINT, false, 0, 0.25, 4.3);
			}
			if (surf === ASPH && r.drive && !r.bridge) wear(r, p, hw, Lb, Y);
			if (r.divided || r.cls === 'motorway' || r.cls === 'trunk') { B.line(p, 0.15, WHITE, false, hw / 3, 3, 9); B.line(p, 0.15, WHITE, false, -hw / 3, 3, 9); B.line(p, 0.15, WHITE, true, hw - 0.6); Y.line(p, 0.15, YELLOW, true, -hw + 0.6); }
		}
		// driveways and front walks
		for (const q of near('paths', cx, cz, SIZE * 0.72)) B.line([[q.ax - x0, q.az - z0], [q.bx - x0, q.bz - z0]], q.w / 2, CONC, false);
		const prev = renderer.getRenderTarget(), pc = renderer.getClearColor(new THREE.Color()), pa = renderer.getClearAlpha();
		render(M.rt, [B.mesh()], SIZE);
		if (M.paint) render(M.paint, [Lb.mesh(), Y.mesh()], SIZE);
		renderer.setRenderTarget(prev); renderer.setClearColor(pc, pa);
		// (the shapes are drawn: let them go now, not at the next redraw; they run to tens of MB)
		for (const m of [...scene2.children]) { scene2.remove(m); m.geometry.dispose(); }
		M.u[0].value = M.rt.texture;
		M.u[1].value.set(x0, z0, SIZE, 1);
		if (M.paint) M.u[2].value = M.paint.texture;
	}

	function update(camera) {
		if (disposed) return;
		const x = camera.position.x, z = camera.position.z;
		camX = x; camZ = z;
		stream(x, z, camera.position.y < 6000);
		if (!R.loaded) { for (const M of MAPS) { M.u[1].value.w = 0; M.x = 1e9; } return; }
		if (Math.hypot(x - slotX, z - slotZ) > 400) slots(x, z);
		const on = camera.position.y < 3000 && R.regions.some(({ reach: b }) => x > b[0] - 800 && z > b[1] - 800 && x < b[2] + 800 && z < b[3] + 800);
		for (const M of MAPS) {
			if (!on) { M.u[1].value.w = 0; M.x = 1e9; continue; }
			if (Math.hypot(x - M.x, z - M.z) > M.move) { drawRoadMap(M, x, z); break; }      // one map a frame
		}
	}

	// the coarse map at a point: land use (0 wild), roads and roofs coverage
	function landAt(x, z) {
		const M = mapAt(x, z)?.map;
		if (!M) return null;
		const i = Math.floor((x - M.x0) / M.step), j = Math.floor((z - M.z0) / M.step);
		if (i < 0 || j < 0 || i >= M.w || j >= M.h) return null;
		const k = (j * M.w + i) * 4;
		return { lu: Math.round(M.px[k + 1] / 16), road: M.px[k] / 255, roof: M.px[k + 2] / 255 };
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
		for (const task of pending.values()) task.controller.abort();
		pending.clear();
		for (const [i, M] of MAPS.entries()) {
			if (M.u[0].value === M.rt.texture) { M.u[0].value = EMPTY_MAPS[i]; M.u[1].value.w = 0; }
			if (M.paint && M.u[2].value === M.paint.texture) M.u[2].value = EMPTY_MAPS[2];
			M.rt.dispose(); M.paint?.dispose();
		}
		if (REAL_U.uRealMap.value === comp?.tex || gens.some((G) => REAL_U.uRealMap.value === G.tex)) {
			REAL_U.uRealMap.value = EMPTY_MAPS[3]; REAL_U.uRealR.value.w = 0;
			REAL_U.uRealB.value.copy(NOWHERE()); REAL_U.uRealAll.value.copy(NOWHERE());
			for (const b of REAL_U.uRealBs.value) b.copy(NOWHERE());
		}
		comp?.tex.dispose(); comp = null;
		for (const G of gens) G.tex.dispose();
		for (const m of [...scene2.children]) { scene2.remove(m); m.geometry.dispose(); }
		layerMat.dispose();
		live.clear(); gens.length = 0; sources.length = 0; hand.grid.clear(); failed.clear();
		R.regions.length = 0; R.loaded = false;
	}

	// (loaded: how many regions are in; version: what stands round you changed; genVersion: a grown
	// town came or went)
	return { R, inside, near, update, dispose, sidewalk, landAt, rt, loaded: () => R.loaded, addRegion, removeRegion, addRoads, addSource, removeSource, sourceVersion: () => sources.map((s) => s.version?.() || 0).join(':'), version: () => version, genVersion: () => genVersion, info: () => ({ live: [...live.values()].map((G) => G.name), ms: [...live.values()].map((G) => G.ms), pending: pending.size, failed: [...failed].map((i) => NAMES[i]), version, quiet, late, cancelled, disposed, cam: [Math.round(camX), Math.round(camZ)], comp: comp && [comp.w, comp.h, comp.step] }), ponds: () => gens.flatMap((G) => G.data.ponds || []), genParks: () => gens.flatMap((G) => (G.data.parks || []).map((q) => ({ ...q, town: G.name }))) };
}
