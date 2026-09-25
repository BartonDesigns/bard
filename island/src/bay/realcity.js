// The real city: where the Bay Area is mapped street by street (San Ramon, Danville,
// Mt Diablo and Clayton), the
// roads, buildings, driveways, pools and trees come from Overture Maps (OpenStreetMap,
// Microsoft and Google footprints), baked by tools/bake-realcity.py. Inside the region
// the procedural street grid gives way to this:
//   the ground shader paints the streets from a road map rendered round you at half a
//   metre a pixel (asphalt, sidewalks and kerbs, driveways and walks, dirt trails,
//   lane lines), and from a baked 8 m map further out (roads, land use, roofs);
//   city.js raises the buildings, streetlife.js parks and drives the cars along the
//   real streets, and people walk the real sidewalks.

import * as THREE from 'three';
import { toWorld, KX, LON0, LON0_LEGACY } from './geo.js';

// the ground shader's inputs, shared with terrain.js
const blank = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t.needsUpdate = true; return t; };
export const REAL_U = {
	uRoadMap: { value: blank() }, uRoadR: { value: new THREE.Vector4(0, 0, 1, 0) },
	uRoadMap2: { value: blank() }, uRoadR2: { value: new THREE.Vector4(0, 0, 1, 0) }, uPaintMap: { value: blank() },
	uSeason: { value: 1 },                      // 0 spring green .. 1 summer gold
	uRealMap: { value: blank() }, uRealR: { value: new THREE.Vector4(0, 0, 8, 0) }, uRealB: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) },
	uRealB2: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) }, uRealB3: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) },
};
export const REAL_GLSL = /* glsl */`
uniform sampler2D uRoadMap, uRoadMap2, uPaintMap, uRealMap; uniform vec4 uRoadR, uRoadR2, uRealR, uRealB, uRealB2, uRealB3; uniform float uSeason;
bool inBox(vec2 w, vec4 b){ return w.x > b.x && w.y > b.y && w.x < b.z && w.y < b.w; }
// the main region (its land use map), and any mapped region (real streets, no grid)
bool inReal(vec2 w){ return uRealR.w > 0.5 && inBox(w, uRealB); }
bool inRealAny(vec2 w){ return inReal(w) || inBox(w, uRealB2) || inBox(w, uRealB3); }
`;

// the first region's coarse map colours the ground; the others are streets, buildings and trails
const REGIONS = ['eastbay', 'tam', 'missionpeak'];
// the regions' extents [west, south, east, north], known before their data loads
export const REAL_EXTENTS = [[-122.02, 37.715, -121.84, 37.95], [-122.66, 37.87, -122.53, 37.96], [-121.95, 37.48, -121.84, 37.55]];   // Tri-Valley and Mt Diablo; Mt Tam and Mill Valley; Mission Peak
const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'unknown']);
const WALKED = new Set(['secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);   // sidewalks both sides

async function gunzip(res) {
	const ds = new DecompressionStream('gzip');
	return new Uint8Array(await new Response(res.body.pipeThrough(ds)).arrayBuffer());
}

export function createRealCity(renderer) {
	const R = { regions: [], loaded: false, roads: [], boxes: [], paths: [], pools: [], trees: [], bounds: null, names: [] };
	const CELL = 250;
	const grid = new Map();
	const put = (kind, x, z, i) => { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); let g = grid.get(k); if (!g) grid.set(k, g = { roads: [], boxes: [], paths: [], pools: [], trees: [] }); g[kind].push(i); };

	async function load(name) {
		const base = new URL(`../assets/bayarea/real/${name}`, import.meta.url).href;
		const [H, bin, map] = await Promise.all([
			fetch(base + '.json').then((r) => r.json()),
			fetch(base + '.bin.gz').then(gunzip),
			new Promise((ok, no) => new THREE.TextureLoader().load(base + '.png', ok, undefined, no)),
		]);
		const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
		// a region baked round another origin: shift it (the mapping is a pure translation in x)
		const shiftX = ((H.geo ? H.geo[1] : LON0_LEGACY) - LON0) * KX;
		H.origin[0] += shiftX; H.bounds[0] += shiftX; H.bounds[2] += shiftX;
		const [OX, OZ] = H.origin, U = H.unit, S = H.sections;
		// roads: class, flags, name, points
		let o = S.roads[0];
		for (let n = 0; n < S.roads[1]; n++) {
			const c = dv.getUint8(o), f = dv.getUint8(o + 1), nm = dv.getUint16(o + 2, true), k = dv.getUint16(o + 4, true); o += 6;
			const pts = new Float32Array(k * 2);
			let mnx = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9;
			for (let i = 0; i < k; i++) {
				const x = dv.getInt16(o, true) * U + OX, z = dv.getInt16(o + 2, true) * U + OZ; o += 4;
				pts[i * 2] = x; pts[i * 2 + 1] = z;
				mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z);
			}
			const cls = H.classes[c];
			const r = { cls, w: H.widths[c], name: nm ? H.names[nm - 1] : '', bridge: !!(f & 1), link: !!(f & 2), end0: !!(f & 4), end1: !!(f & 8), divided: !!(f & 16), drive: DRIVE.has(cls), walked: WALKED.has(cls), pts, box: [mnx, mnz, mxx, mxz] };
			const id = R.roads.push(r) - 1;
			for (let gx = Math.floor(mnx / CELL); gx <= Math.floor(mxx / CELL); gx++) for (let gz = Math.floor(mnz / CELL); gz <= Math.floor(mxz / CELL); gz++) put('roads', gx * CELL + 1, gz * CELL + 1, id);
		}
		o = S.boxes[0];
		for (let n = 0; n < S.boxes[1]; n++, o += 18) {
			const kh = dv.getInt16(o + 14, true);
			const b = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 10000, wallH: dv.getInt16(o + 10, true) / 20, roofH: dv.getInt16(o + 12, true) / 20, kind: kh & 255, hip: kh >> 8, door: dv.getInt16(o + 16, true) / 1000 };
			put('boxes', b.x, b.z, R.boxes.push(b) - 1);
		}
		o = S.paths[0];
		for (let n = 0; n < S.paths[1]; n++, o += 10) {
			const p = { ax: dv.getInt16(o, true) * U + OX, az: dv.getInt16(o + 2, true) * U + OZ, bx: dv.getInt16(o + 4, true) * U + OX, bz: dv.getInt16(o + 6, true) * U + OZ, w: dv.getInt16(o + 8, true) / 20 };
			put('paths', p.ax, p.az, R.paths.push(p) - 1);
		}
		o = S.pools[0];
		for (let n = 0; n < S.pools[1]; n++, o += 10) {
			const p = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 10000 };
			put('pools', p.x, p.z, R.pools.push(p) - 1);
		}
		o = S.trees[0];
		for (let n = 0; n < S.trees[1]; n++, o += 8) {
			const t = { x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, h: dv.getInt16(o + 4, true) / 20, cone: dv.getInt16(o + 6, true) };
			put('trees', t.x, t.z, R.trees.push(t) - 1);
		}
		const [bx0, bz0, bx1, bz1] = H.bounds;
		// a CPU copy of the coarse map, for what grows where
		const img = map.image, cv = document.createElement('canvas');
		cv.width = img.width; cv.height = img.height;
		const cx2 = cv.getContext('2d', { willReadFrequently: true });
		cx2.drawImage(img, 0, 0);
		const reg = { name, bounds: [bx0, bz0, bx1, bz1], map: { px: cx2.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height, x0: bx0, z0: bz0, step: H.map.step } };
		R.regions.push(reg);
		// the region, pulled in a little so its edge meets the procedural towns cleanly
		const inset = [bx0 + 60, bz0 + 60, bx1 - 60, bz1 - 60];
		if (name === REGIONS[0]) {
			// the main region's coarse map colours the ground (land use, far roads and roofs)
			map.flipY = false; map.minFilter = THREE.LinearFilter; map.magFilter = THREE.LinearFilter; map.generateMipmaps = false; map.colorSpace = THREE.NoColorSpace;
			map.needsUpdate = true;
			REAL_U.uRealMap.value = map;
			REAL_U.uRealR.value.set(bx0, bz0, H.map.step, 1);
			REAL_U.uRealB.value.set(...inset);
		} else REAL_U[REGIONS.indexOf(name) === 1 ? 'uRealB2' : 'uRealB3'].value.set(...inset);
		R.attribution = H.attribution;
		R.loaded = true;
	}
	// one at a time, the nearest to the island first
	const byDist = REGIONS.map((n, i) => { const [w, so, e, no] = REAL_EXTENTS[i], c = toWorld((so + no) / 2, (w + e) / 2); return [n, Math.hypot(c.x, c.z)]; }).sort((a, b) => a[1] - b[1]).map((r) => r[0]);
	const ready = (async () => { for (const n of byDist) await load(n).catch((e) => console.warn('real city', n, e)); })();

	const regionAt = (x, z, m = 60) => R.regions.find(({ bounds: b }) => x > b[0] + m && z > b[1] + m && x < b[2] - m && z < b[3] - m);
	const inside = (x, z) => !!regionAt(x, z);
	function near(kind, x, z, rad) {
		const out = [], seen = kind === 'roads' ? new Set() : null;
		for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++) for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
			const g = grid.get(gx + ',' + gz);
			if (!g) continue;
			for (const i of g[kind]) {
				if (seen) { if (seen.has(i)) continue; seen.add(i); }
				out.push(R[kind][i]);
			}
		}
		for (const G of gens) nearGen(G, kind, x, z, rad, out);
		return out;
	}

	// ---------- Crysis: generated regions (see crysis/civgen.js and crysis/civ.js) ----------
	// A town grown by the civilization engine arrives in the same shape as a baked region
	// and joins it here: its own spatial grid (so it can be dropped again without touching
	// the real ones), its land-use map for landAt(), and while it is the active one, its map
	// stands in for the main region's in the ground shader (uRealMap/uRealR/uRealB), which
	// paints its land use and streets and keeps the procedural grid off it. Only one generated
	// town is active at a time; the real main region is far off whenever it is.
	const gens = [];
	let version = 0, saved = null;
	function nearGen(G, kind, x, z, rad, out) {
		const seen = kind === 'roads' ? new Set() : null;
		for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++) for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
			const g = G.grid.get(gx + ',' + gz);
			if (!g) continue;
			for (const o of g[kind]) { if (seen) { if (seen.has(o)) continue; seen.add(o); } out.push(o); }
		}
	}
	function swapIn(G) {
		if (REAL_U.uRealMap.value === G.tex) return;
		saved = { map: REAL_U.uRealMap.value, r: REAL_U.uRealR.value.clone(), b: REAL_U.uRealB.value.clone() };
		REAL_U.uRealMap.value = G.tex;
		REAL_U.uRealR.value.set(G.map.x0, G.map.z0, G.map.step, 1);
		REAL_U.uRealB.value.set(G.bounds[0] + 60, G.bounds[1] + 60, G.bounds[2] - 60, G.bounds[3] - 60);
	}
	function addRegion(D) {
		const G = { name: D.name, gen: true, bounds: D.bounds, map: D.map, grid: new Map(), data: D };
		const cell = (x, z) => { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); let g = G.grid.get(k); if (!g) G.grid.set(k, g = { roads: [], boxes: [], paths: [], pools: [], trees: [] }); return g; };
		for (const r of D.roads) {
			const p = r.pts;
			let mnx = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9;
			for (let i = 0; i < p.length; i += 2) { mnx = Math.min(mnx, p[i]); mxx = Math.max(mxx, p[i]); mnz = Math.min(mnz, p[i + 1]); mxz = Math.max(mxz, p[i + 1]); }
			r.box = [mnx, mnz, mxx, mxz]; r.drive = DRIVE.has(r.cls); r.walked = WALKED.has(r.cls);
			for (let gx = Math.floor(mnx / CELL); gx <= Math.floor(mxx / CELL); gx++) for (let gz = Math.floor(mnz / CELL); gz <= Math.floor(mxz / CELL); gz++) cell(gx * CELL + 1, gz * CELL + 1).roads.push(r);
		}
		for (const b of D.boxes) cell(b.x, b.z).boxes.push(b);
		for (const p of D.paths) cell(p.ax, p.az).paths.push(p);
		for (const p of D.pools) cell(p.x, p.z).pools.push(p);
		for (const t of D.trees) cell(t.x, t.z).trees.push(t);
		const M = D.map;
		G.tex = new THREE.DataTexture(M.px, M.w, M.h, THREE.RGBAFormat, THREE.UnsignedByteType);
		G.tex.minFilter = G.tex.magFilter = THREE.LinearFilter; G.tex.colorSpace = THREE.NoColorSpace; G.tex.needsUpdate = true;
		gens.push(G);
		R.regions.unshift(G);                       // found first where it overlaps nothing real anyway
		swapIn(G);
		R.loaded = true;
		version++;
		for (const M2 of MAPS) M2.x = 1e9;          // repaint the road maps
		return G;
	}
	function removeRegion(G) {
		const i = gens.indexOf(G);
		if (i < 0) return;
		gens.splice(i, 1);
		R.regions.splice(R.regions.indexOf(G), 1);
		if (REAL_U.uRealMap.value === G.tex && saved) { REAL_U.uRealMap.value = saved.map; REAL_U.uRealR.value.copy(saved.r); REAL_U.uRealB.value.copy(saved.b); saved = null; }
		G.tex.dispose();
		version++;
		for (const M2 of MAPS) M2.x = 1e9;
	}

	// ---------- the road maps round you: a fine one close by, a coarser one further out ----------
	// Each layer is drawn as distance, not coverage: 1 well inside, 0.5 exactly on the edge,
	// falling to 0 a ramp's width outside, blended by maximum so crossings union cleanly. The
	// ground shader cuts that at 0.5, so edges come out straight and sharp at any distance,
	// with no stair-steps from the texels. A second map carries the yellow lines.
	const mkRT = (res, fmt = THREE.RGBAFormat) => { const t = new THREE.WebGLRenderTarget(res, res, { format: fmt, samples: 4, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }); t.texture.colorSpace = THREE.NoColorSpace; return t; };
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
					const ph = run % (dash + gap), on = ph < dash, step = Math.min(L - s, on ? dash - ph : dash + gap - ph);
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
	const ASPH = [1, 0, 0, 0], CONC = [0, 1, 0, 0], DIRT = [0, 0, 1, 0], WHITE = [0, 0, 0, 1], YELLOW = [1, 0, 0, 0];
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
			r.built = !!L && L.lu > 0 && L.lu < 11;
		}
		return r.built;
	}
	function drawRoadMap(M, cx, cz) {
		M.x = cx; M.z = cz;
		const SIZE = M.size, x0 = cx - SIZE / 2, z0 = cz - SIZE / 2;
		const B = builder(M.ramp), Y = builder(M.ramp), fine = !!M.paint;
		const loc = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push([pts[i] - x0, pts[i + 1] - z0]); return out; };
		for (const r of near('roads', cx, cz, SIZE * 0.72)) {
			const p = loc(r.pts), hw = r.w / 2;
			if (r.cls === 'path' || r.cls === 'track') { B.line(p, hw, DIRT); continue; }
			if (r.cls === 'footway' || r.cls === 'steps' || r.cls === 'pedestrian') { B.line(p, hw, CONC); continue; }
			if (r.walked && !r.bridge && built(r)) {
				// the sidewalk and kerb both sides, the concrete rounding the corners
				B.line(p, hw + 1.7, CONC);
				for (const q of [p[0], p[p.length - 1]]) B.disc(q[0], q[1], hw + 1.7, CONC);
			}
			B.line(p, hw, ASPH);
			for (const q of [p[0], p[p.length - 1]]) B.disc(q[0], q[1], hw, ASPH);
			// a cul-de-sac's turning circle, sidewalk round it
			for (const [end, q] of [[r.end0, p[0]], [r.end1, p[p.length - 1]]]) if (end) { B.disc(q[0], q[1], 14.2, CONC); B.disc(q[0], q[1], 12.5, ASPH); }
			if (!fine) continue;
			// lane lines: a double yellow centre line on the collectors, lanes on divided roads
			if ((r.cls === 'secondary' || r.cls === 'tertiary' || r.cls === 'primary' || r.cls === 'unclassified') && !r.divided && !r.link && r.w >= 9) Y.line(p, 0.17, YELLOW, true);                                   // reads as the double yellow
			if (r.divided || r.cls === 'motorway' || r.cls === 'trunk') { B.line(p, 0.15, WHITE, false, hw / 3, 3, 9); B.line(p, 0.15, WHITE, false, -hw / 3, 3, 9); B.line(p, 0.15, WHITE, true, hw - 0.6); Y.line(p, 0.15, YELLOW, true, -hw + 0.6); }
		}
		// driveways and front walks
		for (const q of near('paths', cx, cz, SIZE * 0.72)) B.line([[q.ax - x0, q.az - z0], [q.bx - x0, q.bz - z0]], q.w / 2, CONC, false);
		const prev = renderer.getRenderTarget(), pc = renderer.getClearColor(new THREE.Color()), pa = renderer.getClearAlpha();
		render(M.rt, [B.mesh()], SIZE);
		if (M.paint) render(M.paint, [Y.mesh()], SIZE);
		renderer.setRenderTarget(prev); renderer.setClearColor(pc, pa);
		M.u[0].value = M.rt.texture;
		M.u[1].value.set(x0, z0, SIZE, 1);
		if (M.paint) M.u[2].value = M.paint.texture;
	}

	function update(camera) {
		if (!R.loaded) return;
		if (gens.length) swapIn(gens[gens.length - 1]);      // (a real region loading late would take the map back)
		const x = camera.position.x, z = camera.position.z;
		const on = !!regionAt(x, z, -800) && camera.position.y < 3000;
		for (const M of MAPS) {
			if (!on) { M.u[1].value.w = 0; M.x = 1e9; continue; }
			if (Math.hypot(x - M.x, z - M.z) > M.move) { drawRoadMap(M, x, z); break; }      // one map a frame
		}
	}

	// the coarse map at a point: land use (0 wild), roads and roofs coverage
	function landAt(x, z) {
		const M = regionAt(x, z, 0)?.map;
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

	return { ready, R, inside, near, update, sidewalk, landAt, rt, loaded: () => R.loaded, addRegion, removeRegion, version: () => version };
}
