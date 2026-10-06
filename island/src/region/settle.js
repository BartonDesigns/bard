// The regional settlements, built near you as you come to them. What is there:
//
//   towns     the atlas's real towns and villages the regional kit claims (globetowns.js
//             leaves them to it): laid out in their kit's manner (layout.js)
//   villages  the hamlets, camps and stations of the open country, found on a grid of the
//             latitude and longitude (the same ones in the same places for everyone): more
//             where the atlas says the land is settled, none on water or a cliff
//   farms     farmsteads strung across the open valleys, where the land is flat and farmed
//   lore      the landmarks of the place's own stories (landmarks.js): a ruined tower on a
//             hill, a shrine on the pass, a wreck on the ice, a caravanserai on the old road
//   real      the real landmarks at their real places (landmarks.js), simplified
//
// A place is planned when you come within a few kilometres (its lots, lanes and fields) and
// built a cell (120 m) at a time near you, a few milliseconds a frame: one merged mesh of
// its buildings per cell (vertex colours, no textures), one of the lit things (windows,
// lanterns, signs: brighter at night), the painted ground (its lanes, square, yards and
// fields), the chimneys' smoke as points. Cells far behind you are let go.

import * as THREE from 'three';
import { Geo } from './geo.js';
import { STRUCTURES, basePalette } from './structures.js';
import { plan, blockLots, BLOCK, SIZES, denseStreetDistance, lotGround } from './layout.js';
import { KITS } from './kits.js';

const CELL = 120, VCELL = 240;
const kitOf = (s) => s.kitObj || KITS[s.kit];
const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hashS = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// the smoke: points rising from the chimneys, drifting downwind and spreading as they go
const SMOKE_VS = /* glsl */`
	attribute float aPhase; uniform float uTime, uSize; uniform vec2 uWind; varying float vA;
	void main() {
		float t = fract(uTime * 0.07 + aPhase);
		vec3 p = position + vec3(uWind.x * t * t * 22.0 + sin(aPhase * 40.0 + uTime * 0.6) * t * 1.5, t * 16.0, uWind.y * t * t * 22.0 + cos(aPhase * 31.0 + uTime * 0.5) * t * 1.5);
		vec4 mv = modelViewMatrix * vec4(p, 1.0);
		gl_Position = projectionMatrix * mv;
		gl_PointSize = uSize * (1.2 + t * 7.0) / max(1.0, -mv.z);
		vA = smoothstep(0.0, 0.08, t) * (1.0 - t) * smoothstep(1400.0, 300.0, -mv.z);
	}`;
const SMOKE_FS = /* glsl */`
	uniform vec3 uCol; varying float vA;
	void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)) * vA * 0.32; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }`;

export function createSettlements({ scene, ground, wet, isPhone = false, toXZ, F, lanes = null }) {
	const group = new THREE.Group();
	group.name = 'regional settlements';
	scene.add(group);
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
	const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, fog: true });
	const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
	const smokeU = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.4, 0.2) }, uCol: { value: new THREE.Color(0.7, 0.7, 0.72) }, uSize: { value: isPhone ? 260 : 380 } };
	const smokeMat = new THREE.ShaderMaterial({ uniforms: smokeU, vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false });
	const BUILD_R = isPhone ? 900 : 1600, DENSE_R = isPhone ? 300 : 420, DROP_R = BUILD_R + 350, SITE_R = 3200;
	// (a landmark is seen from further off: one lot, cheap to have)
	const reachOf = (s) => (s.kind === 'real' ? (isPhone ? 5000 : 9000) : s.kind === 'lore' ? (isPhone ? 2000 : 3500) : 0);
	const sites = new Map();            // key -> site
	const queue = [];                   // [site, i, j]
	const stats = { built: 0, ms: 0, cells: 0, lots: 0, tris: 0 };
	let epoch = -1, job = null, occupancyVersion = 0, treesVersion = 0;

	// ---------- a site ----------
	// desc: { key, kind, lat, lon, kit (kit id), pop, name, regionId, culture, palette, opts, lots? }
	function add(desc) {
		if (sites.has(desc.key)) return sites.get(desc.key);
		const s = { ...desc, seed: hashS(desc.key), planned: null, cells: new Map(), group: new THREE.Group(), x: 0, z: 0, y: 0, last: performance.now() };
		s.group.name = 'site ' + (desc.name || desc.key);
		group.add(s.group);
		place(s);
		sites.set(s.key, s);
		return s;
	}
	function place(s) { const p = toXZ(s.lat, s.lon); s.x = p.x; s.z = p.z; s.group.position.set(p.x, 0, p.z); s.roadEpoch = -1; }
	function drop(s) {
		for (const c of s.cells.values()) freeCell(c);
		s.cells.clear();
		group.remove(s.group);
		sites.delete(s.key); occupancyVersion++;
	}
	// the plan: lots, lanes, square, fields (a dense quarter only its streets; its blocks come later)
	function planSite(s) {
		const kit = kitOf(s), r = rng(s.seed);
		const y0 = ground(s.x, s.z);
		const H = (x, z) => ground(s.x + x, s.z + z) - y0, W = (x, z) => wet(s.x + x, s.z + z);
		let P;
		if (s.lots) P = { lots: s.lots, paths: s.paths || [], plazas: s.plazas || [], fields: [], R: 80 };
		else P = plan(kit, { r, H, wet: W, size: Math.max(0, s.pop), spread: s.spread, axis: s.align?.axis ?? null, avoid: lanes ? (x, z, m) => lanes.keepOff(s.x + x, s.z + z, m) : null });
		P.seed = s.seed;
		// a farm on a section line: its road is the survey's (earth/globelanes.js), all along it
		if (s.align && lanes && P.paths[0]) {
			const p = P.paths[0].pts, on = (q) => { const g = lanes.gridAt(s.x + q[0], s.z + q[1]); return g && g.d < 2; };
			P.paths[0].grid = P.onGrid = on(p[0]) && on(p[p.length - 1]) && on(p[p.length >> 1]);
		}
		// the real landmarks near it keep their ground: no house of this place stands on them
		P.holes = [];
		if (s.kind !== 'real') for (const o of sites.values()) if (o.kind === 'real' && o.clear > 0) { const dx = o.x - s.x, dz = o.z - s.z; if (Math.hypot(dx, dz) < (P.R || 400) + o.clear + 800) P.holes.push([dx, dz, o.clear]); }
		if (P.holes.length) { const keep = (L) => !P.holes.some(([hx, hz, hr]) => Math.hypot(L.x - hx, L.z - hz) < hr + Math.hypot(L.w, L.d) / 2); P.lots = P.lots.filter(keep); P.keep = keep; }
		if (P.dense) { P.R = kit.build.spread * (0.8 + Math.max(0, s.pop) * 0.25); P.block = BLOCK(kit); }
		// the lots by cell
		s.cell = P.dense ? CELL : VCELL;
		P.byCell = new Map();
		for (const L of P.lots) { const k = Math.floor(L.x / s.cell) + ',' + Math.floor(L.z / s.cell); let a = P.byCell.get(k); if (!a) P.byCell.set(k, a = []); a.push(L); }
		// the reach of the place: its lots and fields
		let R = 60;
		for (const L of P.lots) R = Math.max(R, Math.hypot(L.x, L.z) + 30);
		for (const f of P.fields) R = Math.max(R, Math.hypot(f.x, f.z) + Math.max(f.w, f.d));
		P.reach = P.dense ? P.R + 60 : R;
		s.planned = P; occupancyVersion++;
		stats.lots += P.lots.length;
	}
	// the lots in one cell of a site
	function cellLots(s, i, j) {
		const P = s.planned, kit = kitOf(s);
		if (!P.dense) return P.byCell.get(i + ',' + j) || [];
		const ck = i + ',' + j;
		if (P.cellCache?.has(ck)) return P.cellCache.get(ck);
		if (!P.cellCache) { P.cellCache = new Map(); P.blocks = new Map(); }
		const out = [], B = P.block, cs = Math.cos(P.ax), sn = Math.sin(P.ax);
		const blockOf = (bx, bz) => { const k = bx + ',' + bz; let L = P.blocks.get(k); if (!L) P.blocks.set(k, L = blockLots(kit, P, bx, bz, rng)); return L; };
		const x0 = i * CELL, z0 = j * CELL, cx = x0 + CELL / 2, cz = z0 + CELL / 2;
		// the block grid is turned by ax: the cell's corners into it, then every block that may reach in
		const lx = cx * cs - cz * sn, lz = cx * sn + cz * cs, R = CELL * 0.75 + B;
		for (let bx = Math.floor((lx - R) / B); bx <= Math.ceil((lx + R) / B); bx++) for (let bz = Math.floor((lz - R) / B); bz <= Math.ceil((lz + R) / B); bz++) {
			for (const L of blockOf(bx, bz)) if (L.x >= x0 && L.x < x0 + CELL && L.z >= z0 && L.z < z0 + CELL && (!P.keep || P.keep(L))) out.push(L);
		}
		P.cellCache.set(ck, out);
		// (keep the caches to the cells round you)
		if (P.cellCache.size > 200) { P.cellCache.clear(); P.blocks.clear(); }
		return out;
	}

	// ---------- building a cell ----------
	function snowOf(s) { return s.env?.snow || 0; }
	function* buildCell(s, i, j) {
		let tWork = 0, tLast = performance.now();
		const kit = kitOf(s), lots = cellLots(s, i, j);
		const G = new Geo(), glow = new Geo(), smoke = [], solids = [], spots = [], lights = [], trees = [];
		G.seed = glow.seed = (s.seed ^ (i * 92821 + j * 68917)) >>> 0 || 1;
		const opts = { ...(s.opts || {}), snow: snowOf(s) };
		for (const L of lots) {
			const r = rng((s.seed ^ Math.imul(Math.round(L.x * 10), 73856093) ^ Math.imul(Math.round(L.z * 10), 19349663)) >>> 0);
			const fn = L.build || STRUCTURES[L.type];
			if (!fn) continue;
			const terrainLot = { ...L, x: s.x + L.x, z: s.z + L.z };
			const foundation = L.role === 'house' ? lotGround(terrainLot, ground, wet) : null;
			if (L.role === 'house' && !foundation) continue;
			const y = foundation?.y ?? ground(terrainLot.x, terrainLot.z);

			const B = { G, glow, smoke: [], solid: [], lights: [], trees: [], seat: null, seats: null, seatY: 0, lite: !!s.planned.dense };
			const rot = L.rot + Math.PI;
			G.frame(L.x, y, L.z, rot); glow.frame(L.x, y, L.z, rot);
			const pal = basePalette(s.palette, kit, r, opts);
			if (foundation && foundation.hi - foundation.lo > 0.12) G.box(0, foundation.lo - y - 0.25, 0, L.w, y - foundation.lo + 0.3, L.d, pal.stone);
			try { fn(B, { w: L.w, d: L.d }, pal, r); } catch (e) { console.warn('[regional] ' + L.type, e); }
			const cs = Math.cos(rot), sn = Math.sin(rot), toS = (a, b) => [L.x + a * cs + b * sn, L.z - a * sn + b * cs];
			const h = (SIZES[L.type]?.[0] || 4) > 12 ? 14 : 8;
			for (const [a, b, w, d, rr] of B.solid) { const [x, z] = toS(a, b); solids.push({ x, z, w, d, rot: rot + (rr || 0), y0: y - 1, h: h + 2 }); }
			for (const [a, yy, b] of B.smoke) { const [x, z] = toS(a, b); if (((Math.abs(x * 7.1 + z * 3.3) | 0) % 100) / 100 < kit.smoke + 0.15) smoke.push(x, y + yy, z); }
			for (const [a, yy, b] of B.lights) { const [x, z] = toS(a, b); lights.push([x, y + yy, z]); }
			// (a great tree the lot keeps is grown with the region's plants, flora.js)
			for (const [a, b, word, size] of B.trees) { const [x, z] = toS(a, b); trees.push({ x, z, word, size, yaw: rot + a }); }
			const seats = B.seats || (B.seat ? [B.seat] : []);
			for (const [a, b, yaw] of seats) { const [x, z] = toS(a, b); spots.push({ x, z, y: y + (B.seatY || 0), yaw: yaw + rot, kind: L.type, role: L.role }); }
			if (L.role === 'house' || L.role === 'centre') { const [x, z] = toS(0, -L.d / 2 - 1.6); spots.push({ x, z, y: ground(s.x + x, s.z + z), yaw: rot + Math.PI, kind: 'door', role: L.role, lot: L.type }); }
			if (B.minaret) { const [x, z] = toS(B.minaret[0], B.minaret[2]); s.minaret = [s.x + x, y + B.minaret[1], s.z + z]; }
			// (a cell is built a few lots at a time, between frames)
			tWork += performance.now() - tLast;
			yield;
			tLast = performance.now();
		}
		// the terraces: low walls along the contours of the hillside fields
		const P = s.planned;
		for (const f of P.fields || []) {
			if (f.kind !== 'terrace' && f.kind !== 'paddy') continue;
			const cs = Math.cos(f.rot), sn = Math.sin(f.rot), wall = f.kind === 'paddy' ? [0.42, 0.38, 0.3] : [0.52, 0.48, 0.42];
			for (let v = -f.d / 2; v <= f.d / 2; v += 5) for (let u = -f.w / 2; u < f.w / 2; u += 6) {
				const x = f.x + (u + 3) * cs + v * sn, z = f.z - (u + 3) * sn + v * cs;
				if (x < i * s.cell || x >= (i + 1) * s.cell || z < j * s.cell || z >= (j + 1) * s.cell) continue;
				const y = ground(s.x + x, s.z + z);
				G.frame(x, y - 0.35, z, f.rot); G.box(0, 0, 0, 6.2, 0.75, 0.45, wall, { r: 0 });
			}
		}
		const C = { i, j, mesh: null, glow: null, ground: null, smoke: null, solids, spots, lights, trees };
		if (trees.length) treesVersion++;
		if (G.count()) { C.mesh = new THREE.Mesh(G.geometry(), mat); C.mesh.castShadow = !isPhone; C.mesh.receiveShadow = true; s.group.add(C.mesh); stats.tris += G.count() / 3; }
		if (glow.count()) { C.glow = new THREE.Mesh(glow.geometry(), glowMat); s.group.add(C.glow); }
		C.ground = paintCell(s, i, j, kit);
		if (smoke.length) {
			const n = smoke.length / 3, K = 7, pos = new Float32Array(n * K * 3), ph = new Float32Array(n * K);
			for (let a = 0; a < n; a++) for (let k = 0; k < K; k++) { pos.set(smoke.slice(a * 3, a * 3 + 3), (a * K + k) * 3); ph[a * K + k] = k / K + a * 0.137; }
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
			g.boundingSphere = new THREE.Sphere(new THREE.Vector3(i * s.cell + s.cell / 2, ground(s.x, s.z) + 20, j * s.cell + s.cell / 2), s.cell + 60);
			C.smoke = new THREE.Points(g, smokeMat); C.smoke.frustumCulled = true;
			s.group.add(C.smoke);
		}
		s.cells.set(i + ',' + j, C);
		stats.built++; stats.cells++;
		tWork += performance.now() - tLast;
		stats.ms += (tWork - stats.ms) * 0.1;
		return C;
	}
	function freeCell(C) {
		for (const m of [C.mesh, C.glow, C.ground, C.smoke]) if (m) { m.geometry.dispose(); m.parent?.remove(m); }
		if (C.trees.length) treesVersion++;
		stats.cells--;
	}

	// ---------- the painted ground: lanes, the square, yards, fields ----------
	function paintCell(s, i, j, kit) {
		const P = s.planned, C0 = s.cell, step = 4, N = C0 / step;
		const gC = kit.ground, snow = snowOf(s);
		const SNOW = [0.84, 0.86, 0.9], mud = (c) => mix3(c, SNOW, snow * 0.75);
		const cPath = mud(hex(snow > 0.5 ? gC.path : earthy(gC.path, kit))), cPlaza = mud(hex(snow > 0.5 ? gC.plaza : earthy(gC.plaza, kit))), cYard = mud(hex(snow > 0.5 ? gC.yard : earthy(gC.yard, kit))), cField = mix3(hex(gC.field || gC.yard), SNOW, snow * 0.9);
		const x0 = i * C0, z0 = j * C0;
		// which features reach this cell
		const near = (x, z, r) => x + r > x0 && x - r < x0 + C0 && z + r > z0 && z - r < z0 + C0;
		// (the lanes and drives are drawn on the ground as roads, earth/globelanes.js: the paint
		// keeps off them, and off the roads from outside)
		const segs = [];
		for (const p of P.paths) for (let k = 0; k + 1 < p.pts.length; k++) { const [ax, az] = p.pts[k], [bx, bz] = p.pts[k + 1]; if (near((ax + bx) / 2, (az + bz) / 2, Math.hypot(bx - ax, bz - az) / 2 + p.w)) segs.push([ax, az, bx, bz, p.w / 2]); }
		const plazas = P.plazas.filter((q) => near(q.x, q.z, Math.max(q.w, q.d)));
		const fields = P.fields.filter((f) => near(f.x, f.z, Math.max(f.w, f.d)));
		const lots = [];
		// (the yards round the houses; a dense quarter is all street and wall)
		if (!P.dense) for (const L of [...(P.byCell.get(i + ',' + j) || []), ...neighbours(P, i, j)]) if (L.role !== 'prop' && near(L.x, L.z, Math.hypot(L.w, L.d) / 2 + 5)) lots.push(L);
		const dense = P.dense ? { B: P.block, cs: Math.cos(P.ax), sn: Math.sin(P.ax), street: kitOf(s).build.layout === 'souk' ? 5 : 9, R: P.R } : null;
		if (!segs.length && !plazas.length && !fields.length && !lots.length && !dense) return null;
		const pos = [], col = [], idx = [];
		const vert = new Float32Array((N + 1) * (N + 1) * 4);
		for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) {
			const x = x0 + a * step, z = z0 + b * step;
			let c = null, k = 0;
			if (dense) {
				const lx = x * dense.cs - z * dense.sn, lz = x * dense.sn + z * dense.cs, B = dense.B;
				const e = denseStreetDistance(lx, lz, B);
				if (Math.hypot(x, z) < dense.R + 20) { c = e < dense.street / 2 + 0.5 ? cPath : cPlaza; k = 0.92; }
			}
			for (const f of fields) {
				const dx = x - f.x, dz = z - f.z, u = dx * Math.cos(f.rot) - dz * Math.sin(f.rot), v = dx * Math.sin(f.rot) + dz * Math.cos(f.rot);
				if (Math.abs(u) < f.w / 2 && Math.abs(v) < f.d / 2) {
					const row = 0.5 + 0.5 * Math.sin(v * (f.kind === 'paddy' ? 1.2 : 3.4));
					const base = f.kind === 'paddy' ? (snow < 0.3 ? [0.32, 0.5, 0.36] : cField) : f.kind === 'oasis' ? [0.32, 0.45, 0.2] : f.crop === 0 ? cField : f.crop === 1 ? mix3(cField, [0.55, 0.48, 0.3], 0.5) : mix3(cField, [0.4, 0.5, 0.25], 0.5);
					c = mix3(base, mix3(base, [0.3, 0.25, 0.18], 0.4), row * 0.6); k = Math.max(k, 0.55 * Math.min(1, (f.w / 2 - Math.abs(u)) / 3, (f.d / 2 - Math.abs(v)) / 3));
				}
			}
			for (const L of lots) { const d = Math.hypot(x - L.x, z - L.z) - Math.hypot(L.w, L.d) / 2; if (d < 4) { const kk = 0.5 * Math.min(1, (4 - d) / 3); if (kk > k * 0.9) { c = cYard; k = Math.max(k, kk); } } }
			for (const q of plazas) { const dx = x - q.x, dz = z - q.z, u = dx * Math.cos(q.rot) - dz * Math.sin(q.rot), v = dx * Math.sin(q.rot) + dz * Math.cos(q.rot); if (Math.abs(u) < q.w / 2 && Math.abs(v) < q.d / 2) { c = cPlaza; k = 0.9; } }
			if (c) for (const [ax, az, bx, bz, hw] of segs) {
				const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
				if (Math.hypot(x - ax - dx * t, z - az - dz * t) < hw + 1.5) { c = null; break; }
			}
			if (c && lanes?.onRoad(s.x + x, s.z + z, 1.5)) c = null;
			const o = (b * (N + 1) + a) * 4;
			if (c) { vert[o] = c[0]; vert[o + 1] = c[1]; vert[o + 2] = c[2]; vert[o + 3] = k; }
		}
		const vid = new Int32Array((N + 1) * (N + 1)).fill(-1);
		const V = (a, b) => {
			const q = b * (N + 1) + a;
			if (vid[q] >= 0) return vid[q];
			const x = x0 + a * step, z = z0 + b * step;
			vid[q] = pos.length / 3;
			pos.push(x, ground(s.x + x, s.z + z) + 0.12, z);
			col.push(vert[q * 4], vert[q * 4 + 1], vert[q * 4 + 2], vert[q * 4 + 3]);
			return vid[q];
		};
		for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
			const q = b * (N + 1) + a;
			if (vert[q * 4 + 3] + vert[(q + 1) * 4 + 3] + vert[(q + N + 1) * 4 + 3] + vert[(q + N + 2) * 4 + 3] < 0.04) continue;
			const p0 = V(a, b), p1 = V(a + 1, b), p2 = V(a + 1, b + 1), p3 = V(a, b + 1);
			idx.push(p0, p3, p2, p0, p2, p1);
		}
		if (!idx.length) return null;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
		g.setIndex(idx);
		g.computeVertexNormals();
		const m = new THREE.Mesh(g, groundMat);
		m.receiveShadow = true; m.renderOrder = 1;
		s.group.add(m);
		return m;
	}
	// a snowy kit's lanes out of the snow season are packed earth
	function earthy(h, kit) { return kit.climate === 'polar' || kit.climate === 'boreal' ? '#7a6e5c' : kit.climate === 'alpine' ? (h === kit.ground.yard ? '#5a7a3a' : '#8a8070') : h; }
	function neighbours(P, i, j) { const out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) for (const L of P.byCell.get((i + a) + ',' + (j + b)) || []) out.push(L); return out; }

	// ---------- each frame ----------
	let scanT = 0;
	function update(dt, cam, { night = 0, wind = null, budget = isPhone ? 3 : 5 } = {}) {
		if (epoch !== F.epoch) { epoch = F.epoch; for (const s of sites.values()) place(s); }
		smokeU.uTime.value += dt;
		if (wind) smokeU.uWind.value.set(wind.x, wind.y);
		glowMat.color.setScalar(0.25 + 0.95 * night);
		smokeU.uCol.value.setScalar(0.72 - 0.5 * night);
		const cx = cam.position.x, cz = cam.position.z;
		scanT -= dt;
		if (scanT <= 0) {
			scanT = 0.5;
			for (const s of sites.values()) {
				const d = Math.hypot(s.x - cx, s.z - cz);
				if (d > SITE_R + reachOf(s) + (s.planned?.reach || 0)) { if (performance.now() - s.last > 4000) drop(s); continue; }
				s.last = performance.now();
				if (!s.planned) { if (d < SITE_R + reachOf(s)) planSite(s); continue; }
				const reach = s.planned.reach, lx = cx - s.x, lz = cz - s.z;
				const R = s.planned.dense ? DENSE_R : Math.max(BUILD_R, reachOf(s));
				if (d > reach + R + 400) { for (const [k, C] of s.cells) { freeCell(C); s.cells.delete(k); } continue; }
				// the cells of the place within reach, nearest first
				const Cs = s.cell, i0 = Math.floor((lx - R) / Cs), i1 = Math.floor((lx + R) / Cs), j0 = Math.floor((lz - R) / Cs), j1 = Math.floor((lz + R) / Cs);
				for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
					const mx = i * Cs + Cs / 2, mz = j * Cs + Cs / 2;
					if (Math.hypot(mx, mz) > reach + Cs || Math.hypot(mx - lx, mz - lz) > R + Cs * 0.5) continue;
					const k = i + ',' + j;
					if (!s.cells.has(k) && !queue.some((q) => q[0] === s && q[1] === i && q[2] === j)) queue.push([s, i, j, Math.hypot(mx - lx, mz - lz)]);
				}
				for (const [k, C] of s.cells) { const mx = C.i * s.cell + s.cell / 2, mz = C.j * s.cell + s.cell / 2; if (Math.hypot(mx - lx, mz - lz) > (s.planned.dense ? DENSE_R + 250 : Math.max(DROP_R, reachOf(s) + 400))) { freeCell(C); s.cells.delete(k); } }
			}
			queue.sort((a, b) => a[3] - b[3]);
		}
		const t0 = performance.now();
		while ((job || queue.length) && performance.now() - t0 < budget) {
			if (!job) {
				const [s, i, j] = queue.shift();
				if (!sites.has(s.key) || s.cells.has(i + ',' + j) || !s.planned) continue;
				job = { s, gen: buildCell(s, i, j) };
			}
			if (!sites.has(job.s.key)) { job = null; continue; }
			if (job.gen.next().done) job = null;
		}
	}

	// ---------- being solid ----------
	function push(p, footY) {
		for (const s of sites.values()) {
			if (!s.cells.size || Math.abs(p.x - s.x) > 4000 || Math.abs(p.z - s.z) > 4000) continue;
			const lx = p.x - s.x, lz = p.z - s.z, C = s.cells.get(Math.floor(lx / s.cell) + ',' + Math.floor(lz / s.cell));
			const list = C?.solids || [];
			for (const b of edgeSolids(s, lx, lz, list)) {
				if (footY > b.y0 + b.h || footY < b.y0 - 2) continue;
				const cx = Math.cos(b.rot), cz = Math.sin(b.rot), dx = p.x - s.x - b.x, dz = p.z - s.z - b.z;
				// (the box's frame: x along its width)
				const u = dx * cx - dz * cz, v = dx * cz + dz * cx, r = 0.3;
				const ou = b.w / 2 + r - Math.abs(u), ov = b.d / 2 + r - Math.abs(v);
				if (ou <= 0 || ov <= 0) continue;
				if (ou < ov) { const sg = (Math.sign(u) || 1) * ou; p.x += cx * sg; p.z -= cz * sg; } else { const sg = (Math.sign(v) || 1) * ov; p.x += cz * sg; p.z += cx * sg; }
			}
		}
	}
	// a cell's solids and its neighbours' (a house can straddle the line)
	function edgeSolids(s, lx, lz, own) {
		const Cs = s.cell, i = Math.floor(lx / Cs), j = Math.floor(lz / Cs), out = own.slice();
		const fx = lx - i * Cs, fz = lz - j * Cs, di = fx < 30 ? -1 : fx > Cs - 30 ? 1 : 0, dj = fz < 30 ? -1 : fz > Cs - 30 ? 1 : 0;
		for (const [a, b] of [[di, 0], [0, dj], [di, dj]]) if (a || b) { const C = s.cells.get((i + a) + ',' + (j + b)); if (C) for (const q of C.solids) out.push(q); }
		return out;
	}
	// is a point in (or within m of) a building of a place round you?
	function blocked(x, z, m = 2, includeRoads = false) {
		for (const s of sites.values()) {
			const P = s.planned;
			if (!P || Math.hypot(x - s.x, z - s.z) > P.reach + m + 40) continue;
			const lx = x - s.x, lz = z - s.z;
			// Reserve the planned roads and footprints before their meshes stream in.
			// Otherwise foliage generated first survives inside the later buildings.
			if (includeRoads && P.dense) {
				const cs = Math.cos(P.ax), sn = Math.sin(P.ax), street = kitOf(s).build.layout === 'souk' ? 5 : 9;
				if (Math.hypot(lx, lz) < P.R + m && denseStreetDistance(lx * cs - lz * sn, lx * sn + lz * cs, P.block) < street / 2 + m) return true;
			} else if (includeRoads) for (const path of P.paths) for (let k = 0; k + 1 < path.pts.length; k++) {
				const a = path.pts[k], b = path.pts[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = dx * dx + dz * dz;
				const t = len ? Math.max(0, Math.min(1, ((lx - a[0]) * dx + (lz - a[1]) * dz) / len)) : 0;
				if (Math.hypot(lx - a[0] - dx * t, lz - a[1] - dz * t) < path.w / 2 + m) return true;
			}
			const i = Math.floor(lx / s.cell), j = Math.floor(lz / s.cell);
			for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const L of cellLots(s, i + a, j + b)) {
				const cs = Math.cos(L.rot), sn = Math.sin(L.rot), dx = lx - L.x, dz = lz - L.z;
				if (Math.abs(dx * cs - dz * sn) < L.w / 2 + m && Math.abs(dx * sn + dz * cs) < L.d / 2 + m) return true;
			}
		}

		return false;
	}
	// the places to be near a point: spots for people (seats, stalls, doorsteps)
	function spotsNear(x, z, r) {
		const out = [];
		for (const s of sites.values()) for (const C of s.cells.values()) for (const q of C.spots) { const wx = s.x + q.x, wz = s.z + q.z; if (Math.abs(wx - x) < r && Math.abs(wz - z) < r) out.push({ ...q, x: wx, z: wz, site: s }); }
		return out;
	}
	// Native local streets share the road registry used by highways, traffic and driving.
	// Keep arrays stable until the floating coordinate frame changes.
	function roadTowns() {
		const out = [];
		for (const s of sites.values()) {
			if (s.kind !== 'town' || !s.key.startsWith('town:') || !s.planned) continue;
			if (s.roadEpoch !== F.epoch) {
				const P = s.planned, paths = P.paths.slice();
				if (P.dense) {
					const cs = Math.cos(P.ax), sn = Math.sin(P.ax), R = P.R, B = P.block;
					const point = (x, z) => [x * cs + z * sn, -x * sn + z * cs];
					for (let n = Math.ceil(-R / B - 0.5); (n + 0.5) * B < R; n++) {
						const q = (n + 0.5) * B, end = Math.sqrt(R * R - q * q);
						const w = kitOf(s).build.layout === 'souk' ? 5 : 9;
						// Driving turns only at road endpoints. Split both grid directions at
						// the exact same rotated intersection coordinates.
						const cuts = [-end];
						for (let k = Math.ceil(-end / B - 0.5); (k + 0.5) * B < end; k++) if ((k + 0.5) * B > -end + 0.01) cuts.push((k + 0.5) * B);
						cuts.push(end);
						for (let k = 0; k + 1 < cuts.length; k++) {
							paths.push({ pts: [point(q, cuts[k]), point(q, cuts[k + 1])], w }, { pts: [point(cuts[k], q), point(cuts[k + 1], q)], w });
						}
					}
				}
				const roads = [];
				for (const path of paths) {
					let run = [], lastHeight = null;
					const flush = () => {
						if (run.length >= 4) {
							let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
							for (let k = 0; k < run.length; k += 2) { x0 = Math.min(x0, run[k]); x1 = Math.max(x1, run[k]); z0 = Math.min(z0, run[k + 1]); z1 = Math.max(z1, run[k + 1]); }
							roads.push({ pts: new Float32Array(run), box: [x0, z0, x1, z1], cls: path.w >= 5 ? 'residential' : 'footway', drive: path.w >= 5, w: path.w, name: s.name, end0: true, end1: true, bridge: false, divided: false, oneway: false });
						}
						run = []; lastHeight = null;
					};
					for (let k = 0; k + 1 < path.pts.length; k++) {
						const a = path.pts[k], b = path.pts[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), count = Math.max(1, Math.ceil(len / 12));
						for (let q = k ? 1 : 0; q <= count; q++) {
							const x = s.x + (q === count ? b[0] : a[0] + (b[0] - a[0]) * q / count), z = s.z + (q === count ? b[1] : a[1] + (b[1] - a[1]) * q / count), y = ground(x, z);
							if (!Number.isFinite(y) || wet(x, z) || (lastHeight !== null && Math.abs(y - lastHeight) > len / count * 0.28)) { flush(); continue; }
							run.push(x, z); lastHeight = y;
						}
					}
					flush();
				}
				s.roadTown = { id: s.key.slice(5), x: s.x, z: s.z, r: P.R || P.reach, roads };
				s.roadEpoch = F.epoch;
			}
			out.push(s.roadTown);
		}
		return out;
	}
	// the site you are in or nearest to (and how far)
	function nearest(x, z, kinds = null) {
		let best = null, bd = 1e9;
		for (const s of sites.values()) { if (kinds && !kinds.includes(s.kind)) continue; const d = Math.hypot(s.x - x, s.z - z) - (s.planned?.reach || 60); if (d < bd) { bd = d; best = s; } }
		return best ? { site: best, d: Math.max(0, bd) } : null;
	}
	function dispose() { for (const s of [...sites.values()]) drop(s); scene.remove(group); mat.dispose(); glowMat.dispose(); groundMat.dispose(); smokeMat.dispose(); }
	// the great trees of the built cells, where they stand now
	function trees() { const out = []; for (const s of sites.values()) for (const C of s.cells.values()) for (const T of C.trees) out.push({ ...T, x: s.x + T.x, z: s.z + T.z }); return out; }
	return { add, sites, update, push, blocked, vegetationBlocked: (x, z, m) => blocked(x, z, m, true), version: () => occupancyVersion, trees, treesVersion: () => treesVersion, roadTowns, spotsNear, nearest, dispose, group, info: () => ({ sites: sites.size, cells: stats.cells, built: stats.built, lots: stats.lots, queue: queue.length, msPerCell: Math.round(stats.ms * 10) / 10, ktris: Math.round(stats.tris / 1000) }), CELL };
}
