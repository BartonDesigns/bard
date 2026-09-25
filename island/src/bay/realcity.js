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

// the ground shader's inputs, shared with terrain.js
const blank = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t.needsUpdate = true; return t; };
export const REAL_U = {
	uRoadMap: { value: blank() }, uRoadR: { value: new THREE.Vector4(0, 0, 1, 0) },
	uRoadMap2: { value: blank() }, uRoadR2: { value: new THREE.Vector4(0, 0, 1, 0) },
	uSeason: { value: 1 },                      // 0 spring green .. 1 summer gold
	uRealMap: { value: blank() }, uRealR: { value: new THREE.Vector4(0, 0, 8, 0) }, uRealB: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) },
};
export const REAL_GLSL = /* glsl */`
uniform sampler2D uRoadMap, uRoadMap2, uRealMap; uniform vec4 uRoadR, uRoadR2, uRealR, uRealB; uniform float uSeason;
bool inReal(vec2 w){ return uRealR.w > 0.5 && w.x > uRealB.x && w.y > uRealB.y && w.x < uRealB.z && w.y < uRealB.w; }
`;

const REGIONS = ['eastbay'];
// the regions' extents [west, south, east, north], known before their data loads
export const REAL_EXTENTS = [[-122.02, 37.715, -121.84, 37.95]];           // San Ramon, Danville, Mt Diablo, Clayton
const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'unknown']);
const WALKED = new Set(['secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);   // sidewalks both sides

async function gunzip(res) {
	const ds = new DecompressionStream('gzip');
	return new Uint8Array(await new Response(res.body.pipeThrough(ds)).arrayBuffer());
}

export function createRealCity(renderer) {
	const R = { loaded: false, roads: [], boxes: [], paths: [], pools: [], trees: [], bounds: null, names: [] };
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
		R.names = H.names;
		const [bx0, bz0, bx1, bz1] = H.bounds;
		R.bounds = [bx0, bz0, bx1, bz1];
		// a CPU copy of the coarse map, for what grows where
		{
			const img = map.image, cv = document.createElement('canvas');
			cv.width = img.width; cv.height = img.height;
			const cx2 = cv.getContext('2d', { willReadFrequently: true });
			cx2.drawImage(img, 0, 0);
			R.map = { px: cx2.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height, x0: H.bounds[0], z0: H.bounds[1], step: H.map.step };
		}
		map.flipY = false; map.minFilter = THREE.LinearFilter; map.magFilter = THREE.LinearFilter; map.generateMipmaps = false; map.colorSpace = THREE.NoColorSpace;
		map.needsUpdate = true;
		REAL_U.uRealMap.value = map;
		REAL_U.uRealR.value.set(bx0, bz0, H.map.step, 1);
		// the region, pulled in a little so its edge meets the procedural towns cleanly
		REAL_U.uRealB.value.set(bx0 + 60, bz0 + 60, bx1 - 60, bz1 - 60);
		R.attribution = H.attribution;
		R.loaded = true;
	}
	const ready = Promise.all(REGIONS.map((n) => load(n).catch((e) => console.warn('real city', n, e))));

	const inside = (x, z) => !!R.bounds && x > R.bounds[0] + 60 && z > R.bounds[1] + 60 && x < R.bounds[2] - 60 && z < R.bounds[3] - 60;
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
		return out;
	}

	// ---------- the road maps round you: a fine one close by, a coarser one further out ----------
	const mkRT = (res) => { const t = new THREE.WebGLRenderTarget(res, res, { samples: 4, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }); t.texture.colorSpace = THREE.NoColorSpace; return t; };
	const MAPS = [
		{ rt: mkRT(2048), size: 512, move: 110, x: 1e9, z: 1e9, u: [REAL_U.uRoadMap, REAL_U.uRoadR] },
		{ rt: mkRT(1024), size: 1536, move: 380, x: 1e9, z: 1e9, u: [REAL_U.uRoadMap2, REAL_U.uRoadR2] },
	];
	const rt = MAPS[0].rt;
	const cam = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
	cam.position.z = 1;
	const scene2 = new THREE.Scene();
	const layerMat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.NoBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

	// flat shapes in the road map's own space (x east, y south, in metres from its corner)
	function builder() {
		const P = [], C = [];
		const tri = (ax, ay, bx, by, cx, cy, col) => { P.push(ax, ay, 0, bx, by, 0, cx, cy, 0); for (let i = 0; i < 3; i++) C.push(...col); };
		const disc = (x, y, r, col) => { const n = r > 6 ? 20 : 10; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; tri(x, y, x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r, col); } };
		const quad = (ax, ay, bx, by, hw, col, o0 = -hw, o1 = hw) => {
			const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
			const p = [ax + nx * o0, ay + ny * o0, bx + nx * o0, by + ny * o0, bx + nx * o1, by + ny * o1, ax + nx * o1, ay + ny * o1];
			tri(p[0], p[1], p[2], p[3], p[4], p[5], col); tri(p[0], p[1], p[4], p[5], p[6], p[7], col);
		};
		// a line along a polyline, round at the joins, or dashed (dash, gap), offset sideways
		const line = (pts, hw, col, round = true, off = 0, dash = 0, gap = 0) => {
			let run = 0;
			for (let i = 0; i + 1 < pts.length; i++) {
				const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
				const L = Math.hypot(bx - ax, by - ay);
				if (L < 0.01) continue;
				const nx = -(by - ay) / L, ny = (bx - ax) / L;
				if (!dash) quad(ax + nx * off, ay + ny * off, bx + nx * off, by + ny * off, hw, col);
				else for (let s = 0; s < L;) {
					const ph = run % (dash + gap), on = ph < dash, step = Math.min(L - s, on ? dash - ph : dash + gap - ph);
					if (on) { const t0 = s / L, t1 = (s + step) / L; quad(ax + (bx - ax) * t0 + nx * off, ay + (by - ay) * t0 + ny * off, ax + (bx - ax) * t1 + nx * off, ay + (by - ay) * t1 + ny * off, hw, col); }
					s += step; run += step;
				}
				if (round && !dash && i + 1 < pts.length - 1) disc(bx + nx * off, by + ny * off, hw, col);
			}
		};
		const mesh = (order) => {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
			const m = new THREE.Mesh(g, layerMat); m.renderOrder = order; m.frustumCulled = false;
			return m;
		};
		return { tri, disc, quad, line, mesh };
	}
	// colours are coverage: R asphalt, G concrete, B lane paint (0.33 white, 0.66 yellow), A dirt
	const ASPH = [1, 0, 0, 0], CONC = [0, 1, 0, 0], DIRT = [0, 0, 0, 1], WHITE = [1, 0, 0.33, 0], YELLOW = [1, 0, 0.66, 0];
	function drawRoadMap(M, cx, cz) {
		M.x = cx; M.z = cz;
		const SIZE = M.size, x0 = cx - SIZE / 2, z0 = cz - SIZE / 2, px = SIZE / M.rt.width;
		for (const m of [...scene2.children]) { scene2.remove(m); m.geometry.dispose(); }
		const L0 = builder(), L1 = builder(), L2 = builder(), L3 = builder(), L4 = builder();
		const loc = (pts) => { const out = []; for (let i = 0; i < pts.length; i += 2) out.push([pts[i] - x0, pts[i + 1] - z0]); return out; };
		// paint lines are kept at least a pixel wide, so they never break up
		const pw = (w) => Math.max(w, px * 0.6);
		for (const r of near('roads', cx, cz, SIZE * 0.72)) {
			const p = loc(r.pts), hw = r.w / 2;
			if (r.cls === 'path' || r.cls === 'track') { L0.line(p, hw, DIRT); continue; }
			if (r.cls === 'footway' || r.cls === 'steps' || r.cls === 'pedestrian') { L1.line(p, hw, CONC); continue; }
			if (r.walked && !r.bridge) {
				// the sidewalk and kerb both sides, the concrete rounding the corners
				L1.line(p, hw + 1.7, CONC);
				for (const q of [p[0], p[p.length - 1]]) L1.disc(q[0], q[1], hw + 1.7, CONC);
			}
			L3.line(p, hw, ASPH);
			for (const q of [p[0], p[p.length - 1]]) L3.disc(q[0], q[1], hw, ASPH);
			// a cul-de-sac's turning circle, sidewalk round it
			for (const [end, q] of [[r.end0, p[0]], [r.end1, p[p.length - 1]]]) if (end) { L1.disc(q[0], q[1], 14.2, CONC); L3.disc(q[0], q[1], 12.5, ASPH); }
			// lane lines: a double yellow centre line on the collectors, lanes on divided roads
			if ((r.cls === 'secondary' || r.cls === 'tertiary' || r.cls === 'primary') && !r.divided && !r.link) { L4.line(p, pw(0.08), YELLOW, false, 0.16); L4.line(p, pw(0.08), YELLOW, false, -0.16); }
			if (r.divided || r.cls === 'motorway' || r.cls === 'trunk') { L4.line(p, pw(0.07), WHITE, false, hw / 3, 3, 9); L4.line(p, pw(0.07), WHITE, false, -hw / 3, 3, 9); L4.line(p, pw(0.07), WHITE, false, hw - 0.6); L4.line(p, pw(0.07), YELLOW, false, -hw + 0.6); }
		}
		// driveways and front walks
		for (const q of near('paths', cx, cz, SIZE * 0.72)) L2.line([[q.ax - x0, q.az - z0], [q.bx - x0, q.bz - z0]], q.w / 2, CONC, false);
		scene2.add(L0.mesh(0), L1.mesh(1), L2.mesh(2), L3.mesh(3), L4.mesh(4));
		cam.left = 0; cam.right = SIZE; cam.bottom = 0; cam.top = SIZE; cam.updateProjectionMatrix();
		const prev = renderer.getRenderTarget(), pc = renderer.getClearColor(new THREE.Color()), pa = renderer.getClearAlpha();
		renderer.setRenderTarget(M.rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
		renderer.render(scene2, cam);
		renderer.setRenderTarget(prev); renderer.setClearColor(pc, pa);
		M.u[0].value = M.rt.texture;
		M.u[1].value.set(x0, z0, SIZE, 1);
	}

	function update(camera) {
		if (!R.loaded) return;
		const x = camera.position.x, z = camera.position.z;
		const on = x > R.bounds[0] - 800 && z > R.bounds[1] - 800 && x < R.bounds[2] + 800 && z < R.bounds[3] + 800 && camera.position.y < 3000;
		for (const M of MAPS) {
			if (!on) { M.u[1].value.w = 0; M.x = 1e9; continue; }
			if (Math.hypot(x - M.x, z - M.z) > M.move) { drawRoadMap(M, x, z); break; }      // one map a frame
		}
	}

	// the coarse map at a point: land use (0 wild), roads and roofs coverage
	function landAt(x, z) {
		const M = R.map;
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

	return { ready, R, inside, near, update, sidewalk, landAt, rt, loaded: () => R.loaded };
}
