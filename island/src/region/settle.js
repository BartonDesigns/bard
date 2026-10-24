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
//
// A home up close is a house you can walk into: each house lot keeps a record of its own
// faces in the cell's meshes and of its shape (structures.js home()), and bay/houses.js builds
// it for real with its rooms when you come within a few dozen metres (homesNear). Its faces
// here dissolve into the house built (the same screen-noise hand-over the Bay's houses use,
// aNear), and its walls stop holding you out.

import * as THREE from 'three';
import { Geo } from './geo.js';
import { STRUCTURES, basePalette } from './structures.js';
import { plan, blockLots, BLOCK, SIZES, denseStreetDistance, lotGround } from './layout.js';
import { KITS } from './kits.js';
import { detailClock, updateDetailClock } from '../world/lodfade.js';
import { createMarquees } from './marquee.js';

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
// a home's faces give up their pixels to the house built for real (bay/houses.js) as it takes
// them: aNear = its centre in the place's frame, 1 while it is built, and when it was
// (world/lodfade.js: the same noise, the same band, the same half second from its birth)
function nearDissolve(m, band) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev?.call(m, sh, r);
		sh.uniforms.uNearBand = band; sh.uniforms.uDetailNow = detailClock;
		sh.vertexShader = 'attribute vec4 aNear; uniform vec2 uNearBand; uniform float uDetailNow; varying float vNearK;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
			vNearK = aNear.z > 0.5 ? (1.0 - smoothstep(uNearBand.x, uNearBand.y, length((modelMatrix * vec4(aNear.x, 0.0, aNear.y, 1.0)).xz - cameraPosition.xz))) * smoothstep(0.0, 0.5, max(0.0, uDetailNow - aNear.w)) : 0.0;`);
		sh.fragmentShader = 'varying float vNearK;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vNearK > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < vNearK) discard;');
	};
	m.customProgramCacheKey = () => 'settle-near';
	return m;
}

// a big city the kit builds whole (a dense quarter: Tokyo, Mumbai, Cairo) is its blocks out as far
// as its lights reach (earth/globeterrain.js draws its built-up ground that far), by the atlas's
// size class; its blocks are still laid out only round you (DENSE_R)
export const DENSE_FOOT = [0, 0, 2500, 5000, 9000, 13000];

export function createSettlements({ scene, ground, wet, waterReady = () => true, isPhone = false, toXZ, toLL = null, F, lanes = null }) {
	const group = new THREE.Group();
	group.name = 'regional settlements';
	scene.add(group);
	const nearBand = { value: new THREE.Vector2(36, 46) };
	const mat = nearDissolve(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }), nearBand);
	const glowMat = nearDissolve(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, fog: true }), nearBand);
	// (the lights that are on only after dark, a tower's lit rooms and the Luxor's beam: the same shader as the glow)
	const nightMat = nearDissolve(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, fog: true }), nearBand);
	// (paving laid on the ground, a resort's whole clearing: region/index.js paveLot. Drawn a hair nearer than
	// it is, so the far ground's coarser mesh never shows through it; the same program as mat)
	// (the real resorts' names in lights: marquee.js)
	const marquees = createMarquees({ isPhone });
	const paveMat = nearDissolve(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), nearBand);
	const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
	const smokeU = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.4, 0.2) }, uCol: { value: new THREE.Color(0.7, 0.7, 0.72) }, uSize: { value: isPhone ? 260 : 380 } };
	const smokeMat = new THREE.ShaderMaterial({ uniforms: smokeU, vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false });
	const BUILD_R = isPhone ? 900 : 1600, DENSE_R = isPhone ? 300 : 420, DROP_R = BUILD_R + 350, SITE_R = 3200;
	// (a landmark is seen from further off: one lot, cheap to have)
	const reachOf = (s) => (s.kind === 'real' ? (isPhone ? 5000 : 9000) : s.kind === 'lore' ? (isPhone ? 2000 : 3500) : 0);
	// (a big city's dense quarter is planned once you are within its footprint, not only near its middle)
	const footOf = (s) => (s.kind === 'town' && !s.planned && kitOf(s)?.build?.dense ? DENSE_FOOT[s.pop] || 0 : 0);
	const sites = new Map();            // key -> site
	const queue = [];                   // [site, i, j]
	const stats = { built: 0, ms: 0, cells: 0, lots: 0, tris: 0 };
	let epoch = -1, job = null, occupancyVersion = 0, treesVersion = 0, homesVersion = 0;

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
		// (not before the creeks and ponds round it are known: asked again on the next look round)
		if (s.kind !== 'real' && !waterReady(s.x, s.z, 600)) return;
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
		if (P.dense) { P.R = Math.max(kit.build.spread * (0.8 + Math.max(0, s.pop) * 0.25), DENSE_FOOT[s.pop] || 0); P.block = BLOCK(kit); }
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
		const G = new Geo(), glow = new Geo(), nightG = new Geo(), paveG = new Geo(), smoke = [], solids = [], spots = [], lights = [], trees = [], homes = [], halls = [], big = [], signs = [];
		G.seed = glow.seed = nightG.seed = paveG.seed = (s.seed ^ (i * 92821 + j * 68917)) >>> 0 || 1;
		const opts = { ...(s.opts || {}), snow: snowOf(s) };
		for (const L of lots) {
			const r = rng((s.seed ^ Math.imul(Math.round(L.x * 10), 73856093) ^ Math.imul(Math.round(L.z * 10), 19349663)) >>> 0);
			const fn = L.build || STRUCTURES[L.type];
			if (!fn) continue;
			const terrainLot = { ...L, x: s.x + L.x, z: s.z + L.z };
			const foundation = L.role === 'house' ? lotGround(terrainLot, ground, wet) : null;
			if (L.role === 'house' && !foundation) continue;
			const y = foundation?.y ?? ground(terrainLot.x, terrainLot.z);

			const B = { G, glow, night: nightG, pave: paveG, later: [], smoke: [], solid: [], lights: [], trees: [], signs: [], name: s.kind === 'real' ? s.name : null, seat: null, seats: null, seatY: 0, lite: !!s.planned.dense, home: null };
			const rot = L.rot + Math.PI;
			G.frame(L.x, y, L.z, rot); glow.frame(L.x, y, L.z, rot); nightG.frame(L.x, y, L.z, rot); paveG.frame(L.x, y, L.z, rot);
			const pal = basePalette(s.palette, kit, r, opts);
			// (a home's own faces, from its foundation on: structures.js home() marks where they stop)
			const v0 = G.count(), g0 = glow.count();
			if (foundation && foundation.hi - foundation.lo > 0.12) G.box(0, foundation.lo - y - 0.25, 0, L.w, y - foundation.lo + 0.3, L.d, pal.stone);
			try { fn(B, { w: L.w, d: L.d }, pal, r); } catch (e) { console.warn('[regional] ' + L.type, e); }
			// (a landmark's heavier pieces, its hotel towers, one at a time between frames)
			for (const f of B.later) { tWork += performance.now() - tLast; yield; tLast = performance.now(); try { f(); } catch (e) { console.warn('[regional] ' + L.type, e); } }
			const cs = Math.cos(rot), sn = Math.sin(rot), toS = (a, b) => [L.x + a * cs + b * sn, L.z - a * sn + b * cs];
			const H = L.role === 'house' && !B.lite ? B.home : null;
			const rec = H ? { L, y, H, v0, v1: H.v, g0, g1: H.gv, c: toS(H.x || 0, 0), cell: null, grp: null, nearGrp: null, n: homes.length } : null;
			if (rec) homes.push(rec);
			// (a resort's casino, walked into: bay/towers.js builds its floor inside it, hallsNear; Fremont
			// Street has a row of them, each its own)
			const HLs = new Map();
			for (const Q of B.halls || []) {
				const HL = { L, y, rot: rot + Q.r, name: Q.name || B.name, c: toS(Q.x, Q.z), door: toS(Q.gx, Q.gz), w: Q.w, d: Q.d, h: Q.h, v0: Q.v0, v1: Q.v1, g0: Q.g0, g1: Q.g1, fy: Q.fy || 0, stair: Q.stair, cell: null, open: false, o: null };
				halls.push(HL); HLs.set(Q, HL);
			}
			// (what stands on a casino's roof, its hotel towers, holds you out where the casino does: its
			// footing is the casino's own floor, which you walk once you are in)
			const onHall = (a, b) => { for (const [Q, HL] of HLs) { const dx = a - Q.x, dz = b - Q.z, c = Math.cos(Q.r), n = Math.sin(Q.r); if (Math.abs(dx * c - dz * n) < Q.w / 2 && Math.abs(dx * n + dz * c) < Q.d / 2) return HL; } return null; };
			// (and those towers are its hotel, its lobby up off the casino's roof, the elevators from
			// the casino floor up to it: its storeys open round you there, openTower)
			for (const t of B.towers || []) {
				const HL = t.y0 > 1 && HLs.size ? onHall(t.x, t.z) : null;
				if (HL) (HL.hotels || (HL.hotels = [])).push({ hall: HL, c: toS(t.x, t.z), w: t.w, d: t.d, y0: t.y0, h: t.h, rot: rot + t.r, storeys: t.storeys, open: null });
			}
			const h = (SIZES[L.type]?.[0] || 4) > 12 ? 14 : 8;
			// (the walls of a home hold you out until it is built for real round you; a casino's, till you are in it)
			for (const [a, b, w, d, rr, tag] of B.solid) {
				const [x, z] = toS(a, b), q = { x, z, w, d, rot: rot + (rr || 0), y0: y - 1, h: h + 2, home: rec && Math.abs(a - (H.x || 0)) < H.w / 2 + 0.6 && Math.abs(b) < H.d / 2 + 0.6 ? rec : null, hall: HLs.get(tag) || (HLs.size ? onHall(a, b) : null) };
				solids.push(q);
				// (one reaching further than the next cell's edge: a resort's casino block, a garage)
				if (Math.max(w, d) > 50) big.push(q);
			}
			for (const [a, yy, b] of B.smoke) { const [x, z] = toS(a, b); if (((Math.abs(x * 7.1 + z * 3.3) | 0) % 100) / 100 < kit.smoke + 0.15) smoke.push(x, y + yy, z); }
			for (const [a, yy, b] of B.lights) { const [x, z] = toS(a, b); lights.push([x, y + yy, z]); }
			for (const q of B.signs) { const [x, z] = toS(q.x, q.z); signs.push({ ...q, x, y: y + q.y, z, yaw: rot + q.yaw }); }
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
		const C = { i, j, mesh: null, glow: null, night: null, pave: null, signs: null, ground: null, smoke: null, solids, big, spots, lights, trees, homes, halls };
		if (trees.length) treesVersion++;
		const nearOf = (g) => { g.setAttribute('aNear', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 4), 4)); return g; };
		if (G.count()) { C.mesh = new THREE.Mesh(nearOf(G.geometry()), mat); C.mesh.castShadow = !isPhone; C.mesh.receiveShadow = true; s.group.add(C.mesh); stats.tris += G.count() / 3; }
		if (glow.count()) { C.glow = new THREE.Mesh(nearOf(glow.geometry()), glowMat); s.group.add(C.glow); }
		if (nightG.count()) { C.night = new THREE.Mesh(nearOf(nightG.geometry()), nightMat); s.group.add(C.night); }
		if (paveG.count()) { C.pave = new THREE.Mesh(nearOf(paveG.geometry()), paveMat); C.pave.receiveShadow = true; s.group.add(C.pave); stats.tris += paveG.count() / 3; }
		if (signs.length && (C.signs = marquees.mesh(signs))) s.group.add(C.signs);
		for (const rec of homes) rec.cell = C;
		for (const H of halls) H.cell = C;
		if (homes.length) homesVersion++;
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
		// (its homes built for real go with it: bay/houses.js lets a dead one go)
		for (const rec of C.homes) { if (rec.grp) rec.grp.dead = true; rec.grp = null; rec.nearGrp = null; }
		if (C.homes.length) homesVersion++;
		for (const m of [C.mesh, C.glow, C.night, C.pave, C.signs, C.ground, C.smoke]) if (m) { m.geometry.dispose(); m.parent?.remove(m); }
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
		if (epoch !== F.epoch) {
			epoch = F.epoch;
			for (const s of sites.values()) { place(s); for (const C of s.cells.values()) for (const rec of C.homes) if (rec.grp) { rec.grp.dead = true; rec.grp = null; } }
			homesVersion++;
		}
		smokeU.uTime.value += dt;
		if (wind) smokeU.uWind.value.set(wind.x, wind.y);
		glowMat.color.setScalar(0.25 + 0.95 * night);
		nightMat.color.setScalar(1.2 * night); nightMat.visible = night > 0.02;
		smokeU.uCol.value.setScalar(0.72 - 0.5 * night);
		const cx = cam.position.x, cz = cam.position.z;
		scanT -= dt;
		if (scanT <= 0) {
			scanT = 0.5;
			for (const s of sites.values()) {
				const d = Math.hypot(s.x - cx, s.z - cz);
				if (d > SITE_R + reachOf(s) + footOf(s) + (s.planned?.reach || 0)) { if (performance.now() - s.last > 4000) drop(s); continue; }
				s.last = performance.now();
				if (!s.planned) { if (d < SITE_R + reachOf(s) + footOf(s)) planSite(s); continue; }
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
			const list = C?.solids || [], near = edgeSolids(s, lx, lz, list);
			// (and the big ones from wherever in the place they stand: a resort's casino block is
			// solid all along its front, not only in the cell its lot is in)
			for (const D of s.cells.values()) if (D !== C && D.big?.length) for (const b of D.big) near.push(b);
			for (const b of near) {
				if (footY > b.y0 + b.h || footY < b.y0 - 2 || b.home?.nearGrp || b.hall?.open) continue;
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
			// (a landmark on paved ground, its whole clearing: a resort's drives, pools and gardens, a
			// pedestrian mall; no wild plant comes up in it)
			if (includeRoads && s.paved && s.planned && Math.hypot(x - s.x, z - s.z) < s.clear + m) return true;
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
	// ---------- the homes, built for real near you (bay/houses.js) ----------
	// the homes within r of a point, each as a house's block list (the shape houseplan.js plans
	// from, in the engine's metres now): the same list for the same home while its cell stands
	// and the frame holds (a new one after, the old one dead)
	function homesNear(x, z, r) {
		const out = [];
		for (const s of sites.values()) {
			if (!s.cells.size || Math.abs(x - s.x) > (s.planned?.reach || 0) + r + s.cell || Math.abs(z - s.z) > (s.planned?.reach || 0) + r + s.cell) continue;
			for (const C of s.cells.values()) for (const rec of C.homes) {
				if (Math.abs(s.x + rec.c[0] - x) > r || Math.abs(s.z + rec.c[1] - z) > r) continue;
				out.push(rec.grp || (rec.grp = homeGrp(s, rec)));
			}
		}
		return out;
	}
	// what a home is called when it is yours (share.js: "Farmhouse near Ames")
	const HOME_NAMES = { log: 'Log cabin', arctic: 'Arctic house', chalet: 'Chalet', farmhouse: 'Farmhouse', cottage: 'Cottage', halftimber: 'Half-timbered house', stonehouse: 'Stone house', stonetile: 'Stone house', cube: 'Whitewashed house', adobe: 'Adobe house', adobethatch: 'Adobe house', homestead: 'Homestead', tinroof: 'Tin-roofed house', tincottage: 'Island cottage', stilt: 'Stilt house', easthouse: 'Village house', flatbrick: 'Brick house', mudtile: 'Mud-brick house' };
	function homeGrp(s, rec) {
		const { L, H } = rec, x = s.x + rec.c[0], z = s.z + rec.c[1];
		// (the door along the front: houseplan.js puts it at door x (0..1) across, the front in the
		// house's frame is the lot's -z, and its x runs the other way)
		const lx = -((H.door || 0) - (H.x || 0)), span = H.w - 2.5;
		const b = { x, z, w: H.w, d: H.d, a: -L.rot, wallH: H.H, roofH: H.roof?.rise || 0, kind: 0, door: span > 0.2 ? Math.max(0, Math.min(1, (lx + H.w / 2 - 1.25) / span)) : 0.5, hip: H.roof?.kind === 'hip' ? 1 : 0 };
		const grp = [b];
		grp.owner = api; grp.rec = rec; grp.rural = H; grp.floorY = rec.y + H.y0; grp.epoch = F.epoch;
		// (who it is, wherever the frame lies: its place and its lot)
		grp.homeId = 'r' + s.key + '#' + L.type + ':' + Math.round(L.x * 10) + ':' + Math.round(L.z * 10);
		grp.ll = toLL ? toLL(x, z) : null;
		grp.region = s.regionId; grp.kit = s.kitId || s.kit; grp.label = HOME_NAMES[L.type] || 'House';
		return grp;
	}
	// ---------- the resorts' casinos, walked into (bay/towers.js) ----------
	// the casino blocks within r of a point, each as the block bay/towers.js plans a casino in
	// (interiors/workplace-plan.js planResort): just inside its walls, its doors to the front (the
	// tower's +z, the lot's -z), up to under the hotel over it; the same one while its cell stands
	function hallsNear(x, z, r) {
		const out = [];
		for (const s of sites.values()) {
			if (!s.cells.size || Math.abs(x - s.x) > (s.planned?.reach || 0) + r + s.cell || Math.abs(z - s.z) > (s.planned?.reach || 0) + r + s.cell) continue;
			for (const C of s.cells.values()) for (const H of C.halls || []) {
				const hx = s.x + H.c[0], hz = s.z + H.c[1];
				if (Math.hypot(hx - x, hz - z) > r + Math.max(H.w, H.d) / 2) continue;
				// (its floor where the lot laid it, the steps up to its doors)
				if (!H.o) {
					H.o = { x: hx, z: hz, y: H.y, w: H.w - 1, d: H.d - 1, h: H.h - 1.5, a: Math.PI - H.rot, floor0: H.y + H.fy, stair: H.stair && { y: H.y + H.stair.y, len: H.stair.len, w: H.stair.w }, hall: H, landmark: H.name, src: { kind: 6, resort: [Math.round(hx), Math.round(hz)], biz: { name: H.name } }, hotels: [] };
					// (its hotel towers, each planned as the Strip's own hotels are: the lobby, the guest floors)
					for (const t of H.hotels || []) {
						const tx = s.x + t.c[0], tz = s.z + t.c[1];
						t.org = [s.x, s.z];
						H.o.hotels.push(t.o = { x: tx, z: tz, y: H.y + t.y0, w: t.w - 1, d: t.d - 1, h: t.h - 0.5, a: Math.PI - t.rot, floor0: H.y + t.y0 + 0.1, tower: t, casino: H.o, landmark: H.name, src: { kind: 11, resort: H.o.src.resort, biz: { name: H.name } } });
					}
				}
				out.push(H.o);
				for (const t of H.o.hotels) if (Math.hypot(t.x - x, t.z - z) < r + Math.max(t.w, t.d) / 2) out.push(t);
			}
		}
		return out;
	}
	// the casino built inside one (its block, as hallsNear gave it) or none: its walls let you in,
	// and the dark glass over its doors gives way to its own as you come up to them
	let openH = null;
	function openHall(o) {
		const H = o?.hall || null;
		if (H === openH) return;
		for (const q of [openH, H]) {
			if (!q) continue;
			const on = q === H, born = on ? updateDetailClock() : 0;
			q.open = on;
			// (its door frames in the cell's faces, the light through its glass in its glow)
			for (const [m, a, b] of [[q.cell?.mesh, q.v0, q.v1], [q.cell?.glow, q.g0, q.g1]]) {
				const A = m?.geometry.attributes.aNear;
				if (!A || b <= a) continue;
				for (let k = a; k < b; k++) { A.array[k * 4] = on ? q.door[0] : 0; A.array[k * 4 + 1] = on ? q.door[1] : 0; A.array[k * 4 + 2] = on ? 1 : 0; A.array[k * 4 + 3] = born; }
				A.addUpdateRange(a * 4, (b - a) * 4); A.needsUpdate = true;
			}
		}
		openH = H;
	}
	// a hotel tower walked into (as hallsNear gave it) between heights y0 and y1, you at (x, z), or
	// none: its storeys there give way round you to its floors built inside it (bay/towers.js), the
	// rest of it stands
	let openT = null;
	function openTower(o, y0 = 0, y1 = 0, x = 0, z = 0) {
		const t = o?.tower || null;
		if (openT && openT !== t) setStoreys(openT, null);
		if (t) setStoreys(t, [y0, y1], [x - t.org[0], z - t.org[1]]);
		openT = t;
	}
	function setStoreys(t, span, at) {
		const C = t.hall.cell, was = t.open || new Set(), now = new Set();
		if (span) for (const [i, [ya, yb]] of t.storeys.entries()) if (t.hall.y + yb > span[0] && t.hall.y + ya < span[1]) now.add(i);
		// (round where you stand: a slab of a tower is longer than the faces' band is wide)
		const moved = at && (!t.at || Math.hypot(at[0] - t.at[0], at[1] - t.at[1]) > 6);
		if (moved) t.at = at;
		const born = updateDetailClock();
		for (const [i, [, , v0, v1, l0, l1]] of t.storeys.entries()) {
			const on = now.has(i), fresh = on !== was.has(i);
			if (!fresh && !(on && moved)) continue;
			for (const [m, a, b] of [[C?.mesh, v0, v1], [C?.night || C?.glow, l0, l1]]) {
				const A = m?.geometry.attributes.aNear;
				if (!A || b <= a) continue;
				for (let k = a; k < b; k++) { A.array[k * 4] = on ? t.at[0] : 0; A.array[k * 4 + 1] = on ? t.at[1] : 0; A.array[k * 4 + 2] = on ? 1 : 0; if (fresh) A.array[k * 4 + 3] = born; }
				A.addUpdateRange(a * 4, (b - a) * 4); A.needsUpdate = true;
			}
		}
		t.open = span ? now : null;
		if (!span) t.at = null;
	}
	// a home built for real (at c, its centre) or given back (null): its faces here hand over
	function setNear(grp, c) {
		const rec = grp.rec;
		grp.near = c;
		if (!rec || (!c && rec.nearGrp !== grp)) return;
		rec.nearGrp = c ? grp : null;
		const C = rec.cell;
		for (const [m, a, b] of [[C?.mesh, rec.v0, rec.v1], [C?.glow, rec.g0, rec.g1]]) {
			const A = m?.geometry.attributes.aNear;
			if (!A || b <= a) continue;
			for (let k = a; k < b; k++) { A.array[k * 4] = c ? rec.c[0] : 0; A.array[k * 4 + 1] = c ? rec.c[1] : 0; A.array[k * 4 + 2] = c ? 1 : 0; A.array[k * 4 + 3] = c ? grp.nearBorn || 0 : 0; }
			A.addUpdateRange(a * 4, (b - a) * 4); A.needsUpdate = true;
		}
	}
	function dispose() { for (const s of [...sites.values()]) drop(s); scene.remove(group); mat.dispose(); glowMat.dispose(); nightMat.dispose(); paveMat.dispose(); marquees.dispose(); groundMat.dispose(); smokeMat.dispose(); }
	// the great trees of the built cells, where they stand now
	function trees() { const out = []; for (const s of sites.values()) for (const C of s.cells.values()) for (const T of C.trees) out.push({ ...T, x: s.x + T.x, z: s.z + T.z }); return out; }
	const api = { add, sites, update, push, blocked, vegetationBlocked: (x, z, m) => blocked(x, z, m, true), version: () => occupancyVersion, trees, treesVersion: () => treesVersion, roadTowns, spotsNear, nearest, homesNear, homesVersion: () => homesVersion, setNear, hallsNear, openHall, openTower, setNearBand: (a, b) => nearBand.value.set(a, b), dispose, group, info: () => ({ sites: sites.size, cells: stats.cells, built: stats.built, lots: stats.lots, queue: queue.length, msPerCell: Math.round(stats.ms * 10) / 10, ktris: Math.round(stats.tris / 1000) }), CELL };
	return api;
}
