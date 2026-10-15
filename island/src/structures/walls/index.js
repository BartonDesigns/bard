// Walls you can break through, engine-wide. Every wall the builders put up near you (the houses
// of bay/houses.js, the rooms of interiors/) is known here with its assembly (assembly.js: from
// what the building is, its era and its region) and, once it is struck, a grid of damage cells
// over each run of it between openings (cells.js). A fist, a bat, a round, a blast or a car
// lands on it layer by layer; the wall is then drawn as what it is (mesh.js: the hole through
// every layer, studs, batts, lath, brick, bars) in place of the builder's own triangles, the
// marks round it (decals.js), what comes off it on the floor (chips.js), the sound of its
// material (structures/audio.js). A hole big enough to pass is a way through (the wall's boxes
// that stop you are cut round it; a crawl hole ducks you through), any hole lets light and
// sight through (rays pass where every layer is open). What happened is kept in this browser
// by building, and cleared when the building is repaired.
//
// For other systems: ray(), hit(), blow(), blast(), impact() (structures/index.js routes the
// shots, fists, blasts and cars here); repair(id) and repairWall(id, key) for the crews;
// on(fn) for anyone who wants to know a wall changed (the interior lighting: light through a
// new hole), also sent as the window event 'crysis-wall'; breaches() for the people's paths.

import * as THREE from 'three';
import { assemblyFor, layersFor, studsFor, MAT } from './assembly.js';
import { createPiece, strike, cellAt, throughAt, breachOf, serialise, restore, broken } from './cells.js';
import { createWallMesher } from './mesh.js';
import { sectionAtlas, lathTexture, MARK } from './textures.js';
import { createDecals } from './decals.js';
import { createChips } from './chips.js';
import { bid, hash } from '../ids.js';
import { qualityNow } from '../../world/governor.js';
import { setCuts } from './cuts.js';

const KEY = 'l99.structures.walls.v1';
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
const WET = new Set(['bath', 'mbath', 'powder', 'kitchen', 'laundry', 'restroom']);
const SURFACE = { drywall: 'stone', plaster: 'stone', stucco: 'stone', render: 'stone', brick: 'stone', block: 'stone', concrete: 'stone', osb: 'wood', plywood: 'wood', boards: 'wood', siding: 'wood', stud: 'wood', steel: 'metal', paper: 'stone', batt: 'stone' };

// the cell size, the debris and the marks by the quality tier (world/governor.js)
export function wallQuality(isPhone, tier = qualityNow()?.name || 'high') {
	if (isPhone) return { cs: 0.15, chips: 100, marks: 120, life: 90 };
	return tier === 'minimal' ? { cs: 0.15, chips: 90, marks: 140, life: 60 } : tier === 'low' ? { cs: 0.125, chips: 160, marks: 200, life: 120 } : tier === 'medium' ? { cs: 0.1, chips: 260, marks: 260, life: 180 } : { cs: 0.09, chips: 360, marks: 320, life: 240 };
}

export function createWalls(ctx) {
	const { scene, isPhone, sounds, debris } = ctx;
	const W = () => ctx.world();
	const Q = wallQuality(isPhone);
	const mesher = createWallMesher({ atlas: sectionAtlas(), lath: lathTexture() });
	const decals = createDecals(scene, { cap: Q.marks });
	const chips = createChips(scene, { cap: Q.chips, floorAt: (x, z, y) => ctx.floorAt(x, z, y + 0.3) });
	chips.setLife(Q.life);
	const sources = new Map();          // a builder's object (a house, an interior level) -> its walls
	const listeners = new Set();
	let saved = load(), dirtySave = false, saveWait = 0, scanT = 0, tidyT = 0, dip = 0, cutsDirty = false;
	const dirty = new Set();

	// ---------- kept in this browser ----------
	function load() { try { const s = localStorage.getItem(KEY); const d = s ? JSON.parse(s) : null; return d && typeof d === 'object' && d.b ? d : { b: {} }; } catch { return { b: {} }; } }
	function save() {
		dirtySave = false;
		const ids = Object.keys(saved.b);
		if (ids.length > 200) ids.sort((p, q) => (saved.b[p].t || 0) - (saved.b[q].t || 0)).slice(0, ids.length - 200).forEach((k) => delete saved.b[k]);
		try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* full or blocked: kept for this visit */ }
	}
	function keep(Wl) {
		const S = Wl.src, rec = saved.b[S.id] || (saved.b[S.id] = { t: 0, w: {} });
		rec.t = Date.now();
		rec.w[Wl.key] = { p: Wl.cells.map((P) => serialise(P)) };
		dirtySave = true; saveWait = 3;
	}

	// ---------- the builders' walls ----------
	function lotOfHouse(h) {
		const Mb = h.M, grp = h.grp;
		for (const o of ctx.city()?.lotsNear?.(Mb.x, Mb.z, 3) || []) if (o.src?.grp === grp || o.src === Mb) return o;
		return null;
	}
	function register(key, src) {
		src.inv = new THREE.Matrix4().copy(src.root.matrixWorld).invert();
		src.mw = src.root.matrixWorld.clone();
		src.rot = new THREE.Matrix3().setFromMatrix4(src.mw);
		src.irot = new THREE.Matrix3().setFromMatrix4(src.inv);
		const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
		const seed0 = Math.floor(hash(src.anchor.x, src.anchor.z) * 1e6);
		src.walls = src.list.map((wi, n) => {
			const asm = assemblyFor({ use: src.use, era: src.era, ext: wi.ext, siding: src.siding, region: src.region });
			const stack = layersFor(asm, wi.a0, wi.a1, wi.inside);
			const cav = stack.layers.find((l) => l.m === 'cavity');
			const rooms = wi.rooms ? wi.rooms.map((r) => (r >= 0 ? src.roomType?.(r) : null)) : [];
			for (const p of wi.pieces) if (p.rooms) rooms.push(...p.rooms);
			const Wl = {
				src, n, key: (src.level ?? '') + ':' + wi.axis + ':' + Math.round((wi.a0 + wi.a1) * 50) + ':' + Math.round(wi.s * 100) + ':' + Math.round(wi.e * 100),
				axis: wi.axis, a0: Math.min(wi.a0, wi.a1), a1: Math.max(wi.a0, wi.a1), s: wi.s, e: wi.e, y1: wi.y1, floor: wi.floor, ext: wi.ext, asm, stack,
				capCol: [0.86, 0.85, 0.8], verts: wi.verts, seed: seed0 + n * 977, inSide: wi.ext ? wi.inside : undefined,
				wired: hash(seed0 + n, 3) < (wi.ext ? 0.55 : 0.65), wet: !wi.ext && rooms.some((r) => WET.has(r)),
				pieces: wi.pieces.map((p) => ({ ...p, orig: p.col ? p.col.slice() : null, studs: cav ? studsFor(p.u0, p.u1, wi.s, cav.spacing, MAT[cav.stud].w) : [], top: p.y1 >= wi.y1 - 0.01, floor: wi.floor, repl: null })),
				cells: null, meshes: [], hidden: null, breach: [],
			};
			for (const p of Wl.pieces) {
				const [x0, x1] = wi.axis === 'x' ? [p.u0, p.u1] : [Wl.a0, Wl.a1], [z0, z1] = wi.axis === 'x' ? [Wl.a0, Wl.a1] : [p.u0, p.u1];
				b[0] = Math.min(b[0], x0); b[1] = Math.min(b[1], p.y0); b[2] = Math.min(b[2], z0); b[3] = Math.max(b[3], x1); b[4] = Math.max(b[4], p.y1); b[5] = Math.max(b[5], z1);
			}
			return Wl;
		});
		src.box = b;
		sources.set(key, src);
		// (what was done to it before, put back)
		const rec = saved.b[src.id];
		if (rec) for (const Wl of src.walls) { const d = rec.w[Wl.key]; if (d) { ensure(Wl); Wl.cells.forEach((P, i) => restore(P, d.p[i])); remarks(Wl); dirty.add(Wl); } }
	}
	function unregister(key) {
		const src = sources.get(key);
		if (!src) return;
		for (const Wl of src.walls) { decals.drop(Wl); dirty.delete(Wl); }
		chips.clear(src.id);
		sources.delete(key);
	}
	// the houses and the interiors' levels built now: new ones taken in, gone ones let go
	function scan() {
		const w = W(), seen = new Set();
		for (const [grp, h] of w?.houses?.houses || []) {
			if (!h?.walls?.list) continue;
			seen.add(h);
			if (sources.has(h)) continue;
			const o = lotOfHouse(h);
			register(h, { kind: 'house', h, root: h.root, M: h.walls.mats, list: h.walls.list, use: 'house', era: h.walls.era, siding: h.walls.siding, region: 'us', id: bid(o || h.M), lot: o, anchor: h.M, colArr: () => h.col, roomType: (r) => h.plan.rooms[r]?.type, grp });
		}
		for (const B of w?.interiors?.live?.values?.() || []) {
			if (!B.ready || !B.levels || B.site) continue;
			for (let k = 0; k < B.levels.length; k++) {
				const Lb = B.levels[k];
				if (!Lb?.walls) continue;
				seen.add(Lb);
				if (sources.has(Lb)) continue;
				B.root.updateMatrixWorld(true);
				register(Lb, { kind: 'interior', B, Lb, k, level: k, root: Lb.root, M: B.M, list: Lb.walls, use: B.use, era: B.P.style, siding: 'stucco', region: 'us', id: bid(B.o), lot: B.o, anchor: B.o, colArr: () => Lb.col });
			}
		}
		for (const key of [...sources.keys()]) if (!seen.has(key)) { if (sources.get(key).walls.some((Wl) => Wl.cuts)) cutsDirty = true; unregister(key); }
	}

	// ---------- a wall taken over ----------
	function ensure(Wl) {
		if (Wl.cells) return;
		const cs = Q.cs;
		Wl.cells = Wl.pieces.map((p) => createPiece({ u0: p.u0, u1: p.u1, y0: p.y0, y1: p.y1, studs: p.studs, cs, stack: Wl.stack }));
	}
	// the builder's own triangles for this wall made nothing (kept to put back)
	function hideSource(Wl) {
		if (Wl.hidden) return;
		Wl.hidden = [];
		const byName = new Map();
		for (const m of Wl.src.root.children) if (m.isMesh && !m.userData.wallDamage && !byName.has(m.name)) byName.set(m.name, m);
		for (const [k, s, n] of Wl.verts || []) {
			const m = byName.get(k);
			if (!m) continue;
			const a = m.geometry.attributes.position, arr = a.array;
			if ((s + n) * 3 > arr.length) continue;
			Wl.hidden.push({ m, s, n, keep: arr.slice(s * 3, (s + n) * 3) });
			arr.fill(0, s * 3, (s + n) * 3);
			a.needsUpdate = true;
		}
	}
	// whatever else the builder's meshes carry for their material, given to ours the same: the
	// houses' dissolve reads each vertex's building anchor and birth (world/lodfade.js
	// aLodAnchor); without it a wall's faces are measured from the world's origin and vanish
	function matchSource(src, meshes) {
		const ref = new Map();
		for (const m of src.root.children) if (m.isMesh && !m.userData.wallDamage && !ref.has(m.material)) ref.set(m.material, m);
		const any = [...ref.values()][0];
		for (const m of meshes) {
			const r = ref.get(m.material) || any;
			if (!r) continue;
			const n = m.geometry.attributes.position.count;
			for (const [name, a] of Object.entries(r.geometry.attributes)) {
				if (m.geometry.attributes[name] || name === 'position' || name === 'normal' || name === 'uv' || name === 'color') continue;
				const k = a.itemSize, arr = new Float32Array(n * k), first = Array.from({ length: k }, (_, q) => a.array[q]);
				for (let i = 0; i < n; i++) for (let q = 0; q < k; q++) arr[i * k + q] = first[q];
				m.geometry.setAttribute(name, new THREE.BufferAttribute(arr, k));
			}
		}
	}
	function showSource(Wl) {
		for (const H of Wl.hidden || []) { const a = H.m.geometry.attributes.position; a.array.set(H.keep, H.s * 3); a.needsUpdate = true; }
		Wl.hidden = null;
	}
	function rebuild(Wl) {
		const src = Wl.src;
		// (built first: if it cannot be, the builder's wall stays as it was)
		let meshes;
		try { meshes = mesher.build(Wl, src.M); } catch (e) { console.warn('wall', e); return; }
		matchSource(src, meshes);
		hideSource(Wl);
		for (const m of Wl.meshes) { src.root.remove(m); m.geometry.dispose(); }
		Wl.meshes = meshes;
		for (const m of Wl.meshes) src.root.add(m);
		collide(Wl);
		hung(Wl);
		// (the marks over what is now a hole go)
		decals.drop(Wl, (q) => { const P = Wl.cells[q.pi]; if (!P) return false; const r = q.s * 0.3; for (const [du, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const c = cellAt(P, q.u + du, q.y + dy); if (c >= 0 && outerBroken(Wl, P, c, q.side)) return true; } return false; });
		const holes = holesOf(Wl);
		// (an interior's outside wall: the city's block cut away round its holes, seen from the street)
		if (src.kind === 'interior' && Wl.ext) { const e = src.mw.elements, yaw = Math.atan2(e[2], e[0]) + (Wl.axis === 'x' ? 0 : Math.PI / 2); Wl.cuts = holes.map((h) => ({ x: h.x, y: h.y, z: h.z, yaw, hu: h.w / 2 + 0.06, hv: h.h / 2 + 0.06, ha: (Wl.a1 - Wl.a0) / 2 + 0.35 })); cutsDirty = true; }
		emit({ type: 'change', id: src.id, key: Wl.key, source: src.kind, root: src.root, holes, breach: Wl.breach.filter(Boolean) });
	}
	function cutsNow(camera) {
		cutsDirty = false;
		const list = [];
		for (const src of sources.values()) for (const Wl of src.walls) if (Wl.cuts) list.push(...Wl.cuts);
		if (camera) list.sort((p, q) => Math.hypot(p.x - camera.position.x, p.z - camera.position.z) - Math.hypot(q.x - camera.position.x, q.z - camera.position.z));
		setCuts(list);
	}
	// what hung on the wall where it is now a hole (a picture, a towel, a mirror) goes with it
	function hung(Wl) {
		let n = 0;
		for (const P of Wl.cells || []) for (let c = 0; c < P.n; c++) if (throughAt(P, c)) n++;
		if (n <= (Wl.throughN || 0)) return;
		Wl.throughN = n;
		const X = Wl.axis === 'x', a0 = Wl.a0 - 0.08, a1 = Wl.a1 + 0.08;
		Wl.hung = Wl.hung || [];
		for (const m of Wl.src.root.children) {
			if (!m.isMesh || m.userData.wallDamage || m.name === 'glass' || m.name === 'frost') continue;
			const pa = m.geometry.attributes.position, arr = pa.array;
			let changed = false;
			for (let i = 0; i + 8 < arr.length; i += 9) {
				const cx = (arr[i] + arr[i + 3] + arr[i + 6]) / 3, cy = (arr[i + 1] + arr[i + 4] + arr[i + 7]) / 3, cz = (arr[i + 2] + arr[i + 5] + arr[i + 8]) / 3;
				const A = X ? cz : cx, U = X ? cx : cz;
				if (A < a0 || A > a1 || U < Wl.s || U > Wl.e) continue;
				const pi = Wl.pieces.findIndex((p) => U > p.u0 && U < p.u1 && cy > p.y0 && cy < p.y1);
				if (pi < 0 || !throughAt(Wl.cells[pi], cellAt(Wl.cells[pi], U, cy))) continue;
				if (cx === 0 && cy === 0 && cz === 0) continue;
				Wl.hung.push({ m, i, keep: arr.slice(i, i + 9) });
				arr.fill(0, i, i + 9);
				changed = true;
			}
			if (changed) pa.needsUpdate = true;
		}
	}
	const outerBroken = (Wl, P, c, side) => { const L = Wl.stack.layers; const l = [...L].sort((a, b) => a.lo - b.lo)[side ? L.length - 1 : 0]; return broken(P, l.i, c); };
	// what stops you: the piece's box cut round a breach
	function collide(Wl) {
		const arr = Wl.src.colArr();
		Wl.pieces.forEach((p, i) => {
			const P = Wl.cells?.[i], br = P ? breachOf(P, p.floor ?? Wl.floor) : null;
			Wl.breach[i] = br;
			if (!p.col) return;
			if (!br) {
				if (p.orig) for (let q = 0; q < 6; q++) p.col[q] = p.orig[q];
				if (p.repl) for (const b of p.repl) { b[4] = 1e9; b[5] = -1e9; }
				return;
			}
			p.col[4] = 1e9; p.col[5] = -1e9;
			if (!p.repl) { p.repl = [0, 1, 2, 3].map(() => [0, 0, 0, 0, 1e9, -1e9]); for (const b of p.repl) arr.push(b); }
			// (what is left at the foot, no higher than a step, is stepped over)
			const boxes = [[p.u0, br.u0, p.y0, p.y1], [br.u1, p.u1, p.y0, p.y1], br.kind === 'stand' ? [br.u0, br.u1, br.y1, p.y1] : null, br.y0 - (p.floor ?? Wl.floor) > 0.42 ? [br.u0, br.u1, p.y0, br.y0] : null];
			boxes.forEach((q, k) => {
				const b = p.repl[k];
				if (!q || q[1] - q[0] < 0.01 || q[3] - q[2] < 0.01) { b[4] = 1e9; b[5] = -1e9; return; }
				if (Wl.axis === 'x') { b[0] = q[0]; b[1] = Wl.a0; b[2] = q[1]; b[3] = Wl.a1; } else { b[0] = Wl.a0; b[1] = q[0]; b[2] = Wl.a1; b[3] = q[1]; }
				b[4] = q[2]; b[5] = q[3];
			});
		});
		// (the people's paths in the rooms are found again)
		if (Wl.src.kind === 'interior' && Wl.src.B.nav) Wl.src.B.nav[Wl.src.k] = null;
	}
	// where light and sight now get through, in the world: one box a piece
	function holesOf(Wl) {
		const out = [];
		Wl.cells?.forEach((P, i) => {
			let u0 = Infinity, u1 = -Infinity, y0 = Infinity, y1 = -Infinity;
			for (let c = 0; c < P.n; c++) if (throughAt(P, c)) { const ii = c % P.nu, k = (c - ii) / P.nu; u0 = Math.min(u0, P.u0 + ii * P.csu); u1 = Math.max(u1, P.u0 + (ii + 1) * P.csu); y0 = Math.min(y0, P.y0 + k * P.csv); y1 = Math.max(y1, P.y0 + (k + 1) * P.csv); }
			if (u0 === Infinity) return;
			const c = toWorld(Wl, (u0 + u1) / 2, (y0 + y1) / 2, (Wl.a0 + Wl.a1) / 2), n = normalOf(Wl, 1);
			out.push({ piece: i, x: c.x, y: c.y, z: c.z, w: u1 - u0, h: y1 - y0, nx: n.x, ny: n.y, nz: n.z });
		});
		return out;
	}
	function emit(e) {
		for (const f of listeners) { try { f(e); } catch (err) { console.warn('wall listener', err); } }
		try { window.dispatchEvent(new CustomEvent('crysis-wall', { detail: { type: e.type, id: e.id, key: e.key, source: e.source, holes: e.holes, breach: e.breach } })); } catch { /* no window */ }
	}

	// ---------- frames ----------
	function toWorld(Wl, u, y, a, out = new THREE.Vector3()) { return (Wl.axis === 'x' ? out.set(u, y, a) : out.set(a, y, u)).applyMatrix4(Wl.src.mw); }
	function normalOf(Wl, side, out = new THREE.Vector3()) { const s = side ? 1 : -1; return (Wl.axis === 'x' ? out.set(0, 0, s) : out.set(s, 0, 0)).applyMatrix3(Wl.src.rot).normalize(); }

	// ---------- where a ray meets a wall ----------
	// o, d (world, d normalised), max: { t, n, surface, wall: { W, pi, u, y, side } } or null
	function ray(o, d, max = 300) {
		let best = null;
		for (const src of sources.values()) {
			const lo = V1.copy(o).applyMatrix4(src.inv), ld = V2.copy(d).applyMatrix3(src.irot);
			if (!boxHit(lo, ld, src.box, best ? best.t : max)) continue;
			for (const Wl of src.walls) {
				const h = rayWall(Wl, lo, ld, best ? best.t : max);
				if (h) best = h;
			}
		}
		if (!best) return null;
		best.n = normalOf(best.wall.W, best.wall.side ? 1 : 0);
		return best;
	}
	function boxHit(o, d, b, max) {
		let t0 = 0, t1 = max;
		for (let i = 0; i < 3; i++) {
			const oi = i === 0 ? o.x : i === 1 ? o.y : o.z, di = i === 0 ? d.x : i === 1 ? d.y : d.z, lo = b[i] - 0.05, hi = b[i + 3] + 0.05;
			if (Math.abs(di) < 1e-9) { if (oi < lo || oi > hi) return false; continue; }
			let a = (lo - oi) / di, c = (hi - oi) / di;
			if (a > c) { const t = a; a = c; c = t; }
			t0 = Math.max(t0, a); t1 = Math.min(t1, c);
			if (t0 > t1) return false;
		}
		return true;
	}
	function rayWall(Wl, o, d, max) {
		const X = Wl.axis === 'x', oA = X ? o.z : o.x, dA = X ? d.z : d.x, oU = X ? o.x : o.z, dU = X ? d.x : d.z;
		if (Math.abs(dA) < 1e-6) return null;
		const ta = (Wl.a0 - oA) / dA, tb = (Wl.a1 - oA) / dA, tin = Math.min(ta, tb), tout = Math.max(ta, tb);
		if (tout < 0.005 || tin > max) return null;
		const side = dA > 0 ? 0 : 1;
		if (tin < 0) return null;          // (begun inside the wall: on the way out of it)
		// (an interior's outside wall from the street is the city's block, struck as it was)
		if (Wl.src.kind === 'interior' && Wl.ext && Wl.inSide !== undefined && (side ? 1 : -1) !== Wl.inSide) return null;
		const u = oU + dU * tin, y = o.y + d.y * tin;
		if (u < Wl.s - 0.01 || u > Wl.e + 0.01) return null;
		const pi = Wl.pieces.findIndex((p) => u >= p.u0 - 1e-4 && u <= p.u1 + 1e-4 && y >= p.y0 - 1e-4 && y <= p.y1 + 1e-4);
		if (pi < 0) return null;
		let t = tin;
		const P = Wl.cells?.[pi];
		if (P && P.any) {
			const c = cellAt(P, Math.min(P.u1 - 1e-4, u), Math.min(P.y1 - 1e-4, y));
			if (throughAt(P, c)) {
				const u2 = oU + dU * tout, y2 = o.y + d.y * tout, c2 = cellAt(P, u2, y2);
				if (c2 < 0 || throughAt(P, c2)) return null;
				t = tout - 0.001;
			} else {
				// (on the first layer still whole there)
				const L = side ? [...Wl.stack.layers].sort((p, q) => q.hi - p.hi) : [...Wl.stack.layers].sort((p, q) => p.lo - q.lo);
				for (const l of L) { if (P.dmg[l.i][c] < 1 && l.m !== 'gap' && !(l.m === 'cavity' && l.fill === 'air' && !P.stud[c % P.nu])) break; t = (side ? (l.lo - oA) : (l.hi - oA)) / dA; }
				t = Math.max(tin, Math.min(tout, t));
			}
		}
		if (t > max) return null;
		const l0 = Wl.stack.layers.reduce((b, l) => (side ? (l.hi > b.hi ? l : b) : (l.lo < b.lo ? l : b)));
		return { t, surface: SURFACE[l0.m] || 'stone', material: l0.m, wall: { W: Wl, pi, u, y, side } };
	}

	// ---------- blows ----------
	// a hit on a wall where a ray met it: kind 'blunt' | 'ball' | 'blast', energy, radius; dir
	// (world) the way it was going. Returns what happened, and for a round what goes on.
	function strikeWall(wh, dir, kind, energy, r = 0.08, opts = {}) {
		const Wl = wh.W, pi = wh.pi;
		ensure(Wl);
		const P = Wl.cells[pi];
		const res = strike(P, { u: wh.u, v: wh.y, side: wh.side, kind, energy, r });
		// (a broad blow reaches the runs of wall beside this one)
		if (kind !== 'ball' && r > 0.15) Wl.cells.forEach((Q2, i) => { if (i !== pi && wh.u + r > Q2.u0 && wh.u - r < Q2.u1 && wh.y + r > Q2.y0 && wh.y - r < Q2.y1) strike(Q2, { u: wh.u, v: wh.y, side: wh.side, kind, energy, r }); });
		dirty.add(Wl);
		keep(Wl);
		feedback(Wl, wh, P, res, kind, energy, dir, opts);
		return res;
	}
	// the marks, the bits, the dust, the sound
	function feedback(Wl, wh, P, res, kind, energy, dir, opts) {
		const L = Wl.stack.layers, side = wh.side;
		const seq = [...L].sort((a, b) => a.lo - b.lo), outer = side ? seq[seq.length - 1] : seq[0], far = side ? seq[0] : seq[seq.length - 1];
		const aF = side ? Wl.a1 : Wl.a0, aB = side ? Wl.a0 : Wl.a1;
		const p = toWorld(Wl, wh.u, wh.y, aF), n = normalOf(Wl, side), pB = toWorld(Wl, wh.u, wh.y, aB, new THREE.Vector3()), nB = normalOf(Wl, side ? 0 : 1, new THREE.Vector3());
		const c = res.cell, rOut = P.dmg[outer.i][c] ?? 0, m = res.surface || outer.m, holed = rOut >= 1;
		const mark = (k, at, nn, s, sd) => decals.add(k, at, nn, s, Wl, wh.pi, wh.u, wh.y, sd);
		const ch = MAT[outer.m]?.chip || 'gypsum', id = Wl.src.id;
		const throwChips = (kindC, at, nn, k, speed, size, col = null) => { for (let i = 0; i < k; i++) chips.add(kindC, at.x + nn.x * 0.03, at.y + (Math.random() - 0.5) * 0.06, at.z + nn.z * 0.03, nn.x * speed * (0.4 + Math.random()) + (Math.random() - 0.5) * 1.2, (Math.random() - 0.2) * speed * 0.6, nn.z * speed * (0.4 + Math.random()) + (Math.random() - 0.5) * 1.2, size, id, col); };
		const finish = (q) => (q === 'stucco' ? Wl.src.lot?.col || null : null);
		if (kind === 'blunt') {
			const fist = !opts.item;
			if (!holed) {
				if (outer.m === 'drywall' || outer.m === 'plaster') mark(rOut < 0.45 ? (fist ? MARK.knuckles : MARK.dent) : MARK.crack, p, n, rOut < 0.45 ? 0.12 : 0.16 + rOut * 0.22, side);
				else if (outer.m === 'stucco' || outer.m === 'render') mark(MARK.star, p, n, 0.18 + rOut * 0.3, side);
				else if (outer.m === 'brick') mark(MARK.brickChip, p, n, 0.1, side);
				else if (outer.m === 'concrete') mark(MARK.concreteStar, p, n, 0.18, side);
				else if (outer.m === 'siding' || outer.m === 'boards') mark(MARK.split, p, n, 0.25, side);
				throwChips(ch, p, n, fist ? 1 : 2, 1.2, 0.02);
			} else throwChips(ch, p, n, 3 + (res.broke.length ? 3 : 0), 1.5, 0.035);
			if (res.broke.some((j) => L[j].m === 'cavity')) throwChips(res.stud ? 'splinter' : 'tuft', p, n, 3, 1.6, res.stud ? 0.08 : 0.05);
			if (res.broke.length || rOut > 0.6) debris?.puff?.(p.x + n.x * 0.15, p.y, p.z + n.z * 0.15, res.broke.length ? 3 : 1, 0.08, 0.12, 0.88, { life: 4 + res.broke.length, alpha: 0.22 });
			sounds.wall?.(p, m, Math.min(1.5, energy / 20), res.broke.length > 0, res.hard);
		} else if (kind === 'ball') {
			// going in: a small clean hole (drywall), a chip (stucco, brick, concrete), a split (wood)
			const entry = outer.m === 'drywall' || outer.m === 'plaster' ? MARK.entry : outer.m === 'stucco' || outer.m === 'render' ? MARK.pock : outer.m === 'brick' ? MARK.brickChip : outer.m === 'concrete' ? MARK.spall : outer.m === 'siding' || outer.m === 'boards' ? MARK.sidingHole : MARK.pock;
			if (!holed) mark(entry, p, n, entry === MARK.entry ? 0.06 : entry === MARK.pock ? 0.1 + Math.random() * 0.05 : 0.11, side);
			if ((outer.m === 'stucco' || outer.m === 'render' || outer.m === 'concrete') && Math.random() < 0.45) mark(outer.m === 'concrete' ? MARK.concreteStar : MARK.star, p, n, 0.3 + Math.random() * 0.25, side);
			throwChips(ch, p, n, outer.m === 'drywall' ? 2 : 4, 3, 0.022, finish(outer.m));
			// coming out: the blow-out on the far face, dust out of it
			if (res.out > 0 && res.exitCell >= 0) {
				const rB = P.dmg[far.i][c] ?? 0;
				if (rB < 1) mark(far.m === 'drywall' || far.m === 'plaster' ? MARK.blowout : MARK.pock, pB, nB, far.m === 'drywall' ? 0.1 + Math.random() * 0.04 : 0.1, side ? 0 : 1);
				throwChips(MAT[far.m]?.chip || 'gypsum', pB, nB, 4, 3.5, 0.025);
				debris?.puff?.(pB.x + nB.x * 0.2, pB.y, pB.z + nB.z * 0.2, 2, 0.08, 0.14, 0.9, { life: 6, alpha: 0.25 });
			}
			debris?.puff?.(p.x + n.x * 0.15, p.y, p.z + n.z * 0.15, 1, 0.06, 0.1, 0.86, { life: 4, alpha: 0.22 });
			if (res.broke.some((j) => L[j].m === 'cavity' && !res.stud)) throwChips('tuft', p, n, 2, 1.2, 0.022);
			sounds.wall?.(p, m, 0.7, res.broke.length > 0, res.hard);
		} else {
			mark(MARK.scorch, p, n, Math.min(1.4, 0.5 + energy / 1500), side);
			throwChips(ch, p, n, 10, 5, 0.045, finish(outer.m));
			throwChips(MAT[far.m]?.chip || 'gypsum', pB, nB, 8, 6, 0.045);
			if (L.some((l) => l.m === 'cavity')) { throwChips('splinter', pB, nB, 5, 6, 0.09); if (L.some((l) => l.m === 'cavity' && l.fill !== 'air')) throwChips('tuft', pB, nB, 4, 3, 0.035); }
			debris?.puff?.(p.x + n.x * 0.3, p.y, p.z + n.z * 0.3, 6, 0.3, 0.28, 0.82, { life: 8, alpha: 0.35 });
			debris?.puff?.(pB.x + nB.x * 0.3, pB.y, pB.z + nB.z * 0.3, 6, 0.3, 0.28, 0.82, { life: 8, alpha: 0.35 });
			sounds.wall?.(p, m, 2, true, true);
		}
	}
	// cracks and dents put back on a wall restored from what was kept
	function remarks(Wl) {
		const seq = [...Wl.stack.layers].sort((a, b) => a.lo - b.lo);
		let n = 0;
		Wl.cells.forEach((P, pi) => {
			for (const [side, l] of [[0, seq[0]], [1, seq[seq.length - 1]]]) for (let c = 0; c < P.n && n < 14; c++) {
				const r = P.dmg[l.i][c];
				if (r < 0.35 || r >= 1) continue;
				const i = c % P.nu, k = (c - i) / P.nu, u = P.u0 + (i + 0.5) * P.csu, y = P.y0 + (k + 0.5) * P.csv;
				const at = toWorld(Wl, u, y, side ? Wl.a1 : Wl.a0), nn = normalOf(Wl, side);
				decals.add(l.m === 'stucco' ? MARK.pock : l.m === 'brick' ? MARK.brickChip : l.m === 'concrete' ? MARK.spall : MARK.crack, at, nn, 0.14 + r * 0.15, Wl, pi, u, y, side);
				n++;
			}
		});
	}

	// a shot that met a wall (structures/index.js hit()): returns { through, dmg } or { stop }
	function hit(h, at, dir, dmg, type) {
		const kind = type === 'blast' ? 'blast' : type === 'impact' ? 'blunt' : 'ball';
		const res = strikeWall(h.wall, dir, kind, kind === 'blast' ? dmg * 3 : dmg, kind === 'blast' ? 0.5 : 0.08);
		if (kind === 'ball' && res.out > 0 && type !== 'fire') return { through: true, dmg: res.out, wall: true };
		return { stop: true, wall: true, material: res.surface };
	}
	// a fist, a bat, a pipe: from the eye along dir, within reach. move: melee-rules MOVES entry
	function blow(eye, dir, reach, move) {
		const h = ray(eye, dir, reach);
		if (!h) return null;
		const item = !!move?.item, heavy = move?.kind === 'heavy';
		const e = (move?.dmg || 10) * (item ? 1.6 : 1);
		const res = strikeWall(h.wall, dir, 'blunt', e, item ? 0.08 : heavy ? 0.085 : 0.07, { item });
		const at = V3.copy(eye).addScaledVector(dir, h.t);
		return { at: { x: at.x, y: at.y, z: at.z }, material: res.surface, hard: res.hard, stud: res.stud, broke: res.broke.length > 0, holed: res.depth > 0, through: res.depth >= h.wall.W.stack.layers.length };
	}
	// a blast at (at) of radius r and damage dmg: every wall near it, the side facing it
	function blast(at, r, dmg) {
		let n = 0;
		for (const src of sources.values()) {
			const lo = V1.copy(at).applyMatrix4(src.inv), b = src.box;
			if (lo.x < b[0] - r || lo.x > b[3] + r || lo.z < b[2] - r || lo.z > b[5] + r || lo.y < b[1] - r || lo.y > b[4] + r) continue;
			for (const Wl of src.walls) {
				const X = Wl.axis === 'x', A = X ? lo.z : lo.x, U = X ? lo.x : lo.z;
				const da = A < Wl.a0 ? Wl.a0 - A : A > Wl.a1 ? A - Wl.a1 : 0;
				for (let pi = 0; pi < Wl.pieces.length; pi++) {
					const p = Wl.pieces[pi], u = Math.max(p.u0, Math.min(p.u1, U)), y = Math.max(p.y0, Math.min(p.y1, lo.y));
					const d = Math.hypot(da, U - u, lo.y - y);
					if (d > r) continue;
					const k = Math.pow(1 - d / r, 1.3), e = dmg * 5 * k;
					if (e < 8) continue;
					ensure(Wl);
					const side = A < (Wl.a0 + Wl.a1) / 2 ? 0 : 1;
					strike(Wl.cells[pi], { u, v: y, side, kind: 'blast', energy: e, r: Math.min(r, 0.35 + dmg / 120) * (1 - d / r * 0.5) });
					if (!Wl.blasted || Wl.blasted !== at) { Wl.blasted = at; feedback(Wl, { W: Wl, pi, u, y, side }, Wl.cells[pi], { cell: cellAt(Wl.cells[pi], u, y), broke: [0], surface: null, out: 0, exitCell: -1 }, 'blast', e, null, {}); }
					dirty.add(Wl); keep(Wl); n++;
				}
			}
		}
		return n;
	}
	// a car's nose into a wall: E joules, at (world), going dir; true if a wall here took it
	function impact(at, dir, E, half = 0.9) {
		const h = ray(V3.set(at.x - dir.x * 1.2, at.y, at.z - dir.z * 1.2), V2.set(dir.x, 0, dir.z).normalize().clone(), 3);
		if (!h) return false;
		strikeWall(h.wall, dir, 'blast', Math.min(2400, E / 1000 * 3), half, { car: true });
		return true;
	}
	// is this lot's building one whose walls are known here (built near you)
	// (kind: 'house' or 'interior' to ask after one sort only); the source, or null
	const claims = (o, kind = null) => { const id = bid(o); for (const s of sources.values()) if (s.id === id && (!kind || s.kind === kind)) return s; return null; };
	// a surveyed box of combat's own standing for a house built here: the source and the top of its walls (world y)
	const claimsBox = (b) => { for (const s of sources.values()) if (s.kind === 'house' && b?.grp && s.grp === b.grp) return { src: s, top: s.mw.elements[13] + s.box[4] }; return null; };

	// ---------- repairs ----------
	function resetWall(Wl) {
		for (const m of Wl.meshes) { Wl.src.root.remove(m); m.geometry.dispose(); }
		Wl.meshes = [];
		showSource(Wl);
		for (const H of Wl.hung || []) { H.m.geometry.attributes.position.array.set(H.keep, H.i); H.m.geometry.attributes.position.needsUpdate = true; }
		Wl.hung = null; Wl.throughN = 0;
		Wl.cells = null;
		if (Wl.cuts) { Wl.cuts = null; cutsDirty = true; }
		collide(Wl);
		decals.drop(Wl);
		dirty.delete(Wl);
		emit({ type: 'repair', id: Wl.src.id, key: Wl.key, source: Wl.src.kind, root: Wl.src.root, holes: [], breach: [] });
	}
	// every wall of building id put right (the crews call this when they finish; structures/
	// index.js calls it when a building is repaired)
	function repair(id) {
		let n = 0;
		for (const src of sources.values()) if (src.id === id) for (const Wl of src.walls) if (Wl.cells) { resetWall(Wl); n++; }
		chips.clear(id);
		if (saved.b[id]) { n = Math.max(n, Object.keys(saved.b[id].w).length); delete saved.b[id]; dirtySave = true; saveWait = 0.5; }
		return n;
	}
	// one wall (its key as damaged() lists it)
	function repairWall(id, key) {
		for (const src of sources.values()) if (src.id === id) for (const Wl of src.walls) if (Wl.key === key && Wl.cells) resetWall(Wl);
		if (saved.b[id]?.w[key]) { delete saved.b[id].w[key]; if (!Object.keys(saved.b[id].w).length) delete saved.b[id]; dirtySave = true; saveWait = 0.5; }
	}
	// the buildings with broken walls: [{ id, walls: [keys], t (ms) }]
	const damaged = () => Object.entries(saved.b).map(([id, r]) => ({ id, walls: Object.keys(r.w), t: r.t }));

	// ---------- each frame ----------
	function update(dt, camera, player) {
		scanT -= dt;
		if (scanT <= 0) { scanT = 0.4; scan(); cutsNow(camera); }
		// (a wall or two rebuilt a frame, a few milliseconds at most)
		if (dirty.size) {
			const t0 = performance.now();
			for (const Wl of [...dirty]) {
				dirty.delete(Wl);
				if (Wl.cells && sources.get(Wl.src.Lb || Wl.src.h) === Wl.src) rebuild(Wl);
				if (performance.now() - t0 > 8) break;
			}
		}
		if (cutsDirty) cutsNow(camera);
		chips.update(dt);
		if ((tidyT -= dt) <= 0) { tidyT = 5; chips.tidy(); }
		if (dirtySave && (saveWait -= dt) <= 0) save();
		// through a crawl hole: ducked through it
		let want = 0;
		if (player?.pos && camera) {
			for (const src of sources.values()) {
				const lp = V1.copy(player.pos).applyMatrix4(src.inv), b = src.box;
				if (lp.x < b[0] - 1 || lp.x > b[3] + 1 || lp.z < b[2] - 1 || lp.z > b[5] + 1) continue;
				for (const Wl of src.walls) {
					if (!Wl.cells) continue;
					const X = Wl.axis === 'x', A = X ? lp.z : lp.x, U = X ? lp.x : lp.z;
					if (A < Wl.a0 - 0.45 || A > Wl.a1 + 0.45) continue;
					for (const br of Wl.breach) if (br && br.kind === 'crawl' && U > br.u0 - 0.1 && U < br.u1 + 0.1 && Math.abs(lp.y - 1.68 - br.y0) < 0.6) want = Math.max(want, Math.max(0, 1.75 - (br.y1 - br.y0)) + 0.15);
				}
			}
			dip += (want - dip) * Math.min(1, dt * 6);
			if (dip > 0.005) camera.position.y -= dip;
		}
	}
	function info() {
		let walls = 0, broken = 0, verts = 0, breaches = 0;
		for (const src of sources.values()) for (const Wl of src.walls) { walls++; if (Wl.cells) { broken++; for (const m of Wl.meshes) verts += m.geometry.attributes.position.count; breaches += Wl.breach.filter(Boolean).length; } }
		return { sources: sources.size, walls, broken, verts, breaches, cell: Q.cs, chips: chips.counts(), marks: decals.count(), kept: Object.keys(saved.b).length };
	}
	// every way through near a point, for the people's paths: [{ x, z, y, w, h, kind, nx, nz }]
	function breaches(x, z, r = 40) {
		const out = [];
		for (const src of sources.values()) for (const Wl of src.walls) Wl.breach.forEach((br) => {
			if (!br) return;
			const c = toWorld(Wl, (br.u0 + br.u1) / 2, br.y0, (Wl.a0 + Wl.a1) / 2), n = normalOf(Wl, 1);
			if (Math.hypot(c.x - x, c.z - z) < r) out.push({ x: c.x, y: c.y, z: c.z, w: br.u1 - br.u0, h: br.y1 - br.y0, kind: br.kind, nx: n.x, nz: n.z, id: src.id, key: Wl.key });
		});
		return out;
	}
	// the walls near a point (for tests and the console): [{ W, src, d }]
	function near(x, y, z, r = 3) {
		const out = [];
		for (const src of sources.values()) {
			const lp = V1.set(x, y, z).applyMatrix4(src.inv);
			for (const Wl of src.walls) {
				const X = Wl.axis === 'x', A = X ? lp.z : lp.x, U = X ? lp.x : lp.z, a = Math.max(Wl.a0, Math.min(Wl.a1, A));
				for (const p of Wl.pieces) {
					const u = Math.max(p.u0, Math.min(p.u1, U)), yy = Math.max(p.y0, Math.min(p.y1, lp.y)), d = Math.hypot(A - a, U - u, lp.y - yy);
					if (d < r) { out.push({ W: Wl, src, d, piece: p }); break; }
				}
			}
		}
		return out.sort((p, q) => p.d - q.d);
	}
	return {
		update, ray, hit, blow, blast, impact, claims, claimsBox, repair, repairWall, damaged, breaches, near, info, toWorld, normalOf,
		on: (f) => { listeners.add(f); return () => listeners.delete(f); },
		forget: () => { for (const src of sources.values()) for (const Wl of src.walls) if (Wl.cells) resetWall(Wl); saved = { b: {} }; dirtySave = true; saveWait = 0; },
		sources, decals, chips,
	};
}
