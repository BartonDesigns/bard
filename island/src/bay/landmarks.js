// Landmarks across the Bay Area, at their real places and heights. Built from simple
// solids merged per material, so the whole set is a handful of draws.
//
// San Francisco: the Ferry Building and its 75 m clock tower, City Hall's 94 m dome, the
// Palace of Fine Arts, Alcatraz (the whole Rock: see below), Fort Point under
// the bridge, Oracle Park and the Chase Center, the Dutch and Murphy windmills in Golden
// Gate Park, the tallest downtown towers, the Embarcadero's finger piers, Point Bonita.
// East Bay: Oakland City Hall and the Tribune Tower, the Oakland Temple, the Port of
// Oakland's container cranes, Berkeley's Campanile and Memorial Stadium, Mount Diablo's
// summit. Peninsula and South Bay: Hoover Tower, Hangar One at Moffett Field, Levi's
// Stadium, the SAP Center, Lick Observatory on Mount Hamilton. The other bridges: the
// Richmond-San Rafael, San Mateo, Dumbarton, Carquinez and Benicia-Martinez.
// San Ramon: Bishop Ranch's City Center, City Hall and Central Park.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ferryBuilding, sfCityHall, oaklandCityHall, palaceHall, cellhouse, fortPoint, towerLobby, library, cityHall, shopRow, oneRoom, visitorCentre } from '../interiors/landmarks.js';

// piers you can walk out on (floor())
const PIERS = [];
const M = (color, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
// value noise on an integer lattice, for the Rock's faces
const ih = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, z) => {
	const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
	return (ih(i, j) * (1 - a) + ih(i + 1, j) * a) * (1 - b) + (ih(i, j + 1) * (1 - a) + ih(i + 1, j + 1) * a) * b;
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the words painted in 1969-71, during the occupation: round the water tower's tank, and in
// red over the penitentiary's sign at the dock (one canvas: the tank's band above, the sign below)
function alcatrazPaint() {
	const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
	const g = cv.getContext('2d');
	// the tank: weathered grey-buff steel, rust running down from the seams
	g.fillStyle = '#9a948a'; g.fillRect(0, 0, 1024, 256);
	for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${110 + (i % 5) * 12},${60 + (i % 3) * 8},40,${0.08 + (i % 4) * 0.04})`; g.fillRect((i * 173) % 1024, (i * 37) % 60, 2 + (i % 3) * 2, 80 + (i * 29) % 170); }
	g.fillStyle = '#b3261e'; g.textAlign = 'center'; g.textBaseline = 'middle';
	g.font = 'bold 50px Arial, sans-serif';
	g.fillText('PEACE AND FREEDOM', 256, 96); g.fillText('WELCOME', 768, 96);
	g.fillText('HOME OF THE FREE', 256, 170); g.fillText('INDIAN LAND', 768, 170);
	// the sign: black on white, the red paint over it
	g.fillStyle = '#e9e7df'; g.fillRect(0, 256, 1024, 256);
	g.strokeStyle = '#22221f'; g.lineWidth = 8; g.strokeRect(12, 268, 1000, 232);
	g.fillStyle = '#1d1d1b'; g.font = 'bold 64px Georgia, serif'; g.fillText('UNITED STATES PENITENTIARY', 512, 440);
	g.fillStyle = '#b3261e'; g.font = 'bold 92px Arial, sans-serif'; g.fillText('INDIANS WELCOME', 512, 330);
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}

export function createLandmarks(scene, bay) {
	const group = new THREE.Group();
	group.name = 'bay-landmarks';
	scene.add(group);
	const mats = {
		stone: M(0xd9d2c3), granite: M(0xc9c3b8), white: M(0xefece4, 0.6), salmon: M(0xc99a78, 0.8), brick: M(0x8a4a36, 0.9), redbrick: M(0x9c5a44, 0.85),
		gold: M(0xc9a646, 0.35, 0.8), glass: M(0x8fa3b0, 0.2, 0.6), dark: M(0x3a3c40, 0.5, 0.3), steel: M(0x9aa0a4, 0.45, 0.5), silver: M(0xc4c8cc, 0.35, 0.6),
		orange: M(0xc0362c, 0.55, 0.25), green: M(0x3c6b3a, 0.9), concrete: M(0xb2aea6, 0.9), wood: M(0x6b5238, 0.9), craneRed: M(0xb8322a, 0.6, 0.3), craneWhite: M(0xe6e4df, 0.6, 0.3),
		copper: M(0x5f8a78, 0.6, 0.3), tan: M(0xc8b08a, 0.8), sail: M(0xe8e2d4, 0.9), pavement: M(0x7d7b76, 0.95),
		cellhouse: M(0xd8d5cb, 0.85), ruin: M(0xaba08e, 0.95), b64: M(0xcfc6b1, 0.9), redPaint: M(0xa3322a, 0.8), cypress: M(0x2f4a2c, 0.9),
		gull: M(0xf3f3ef, 0.6), gullGrey: M(0x8c949a, 0.6), lamp: M(0x55646a, 0.1, 0.5), painted: new THREE.MeshStandardMaterial({ map: alcatrazPaint(), roughness: 0.8 }),
		bronze: new THREE.MeshStandardMaterial({ color: 0x7a5a2c, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide }), seat: M(0x24405f, 0.7), red: M(0x8e2622, 0.7), court: M(0xb98a55, 0.5), ice: M(0xe8eef2, 0.25),
		glow: new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xfff0d0, emissiveIntensity: 1.2 }),
	};
	// (the same, seen from inside too: the shells you walk into, round or domed)
	const two = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
	for (const k of ['silver', 'white', 'glass', 'dark', 'lamp']) mats[k + 'In'] = two(mats[k]);
	const parts = new Map();
	// (what is drawn goes to the landmarks' merged meshes, or, while an inside is being built
	// as you come near it, to that inside's own)
	let into = parts;
	const add = (mat, g) => { if (!into.has(mat)) into.set(mat, []); into.get(mat).push(g.index ? g.toNonIndexed() : g); };

	// ---------- solid: what you walk round, and step up on ----------
	// Every block and drum the landmarks are built of is solid: you are pushed off its sides,
	// and step up onto any whose top is within a stair's rise of your feet (the tiers of the
	// stands, a plinth, a step). Kept in cells of the ground, to find the near ones quickly.
	const CELL = 48, cells = new Map();
	let ghost = 0;          // (while drawing what is not solid: bars, rails, the insides' small things)
	let tag = null;         // (what the solids drawn now are besides: walk, a floor only; on, a gate)
	let yieldTo = null;     // (where the city's own tower stands, ours gives way: its lobby is there)
	function solid(s) {
		if (ghost) return;
		if (tag) Object.assign(s, tag);
		const R = s.r ?? Math.hypot(s.hw, s.hd);
		for (let i = Math.floor((s.x - R) / CELL); i <= Math.floor((s.x + R) / CELL); i++) for (let j = Math.floor((s.z - R) / CELL); j <= Math.floor((s.z + R) / CELL); j++) {
			const k = i + ',' + j;
			if (!cells.has(k)) cells.set(k, []);
			cells.get(k).push(s);
		}
	}
	const yawOf = (F) => Math.atan2(F.m.elements[8], F.m.elements[0]);
	const V = new THREE.Vector3();
	// a local frame at a real place: heading = bearing of the local +z axis, degrees from north
	const at = (lat, lon, heading = 0, base = null) => {
		const w = toWorld(lat, lon), g = base ?? Math.max(0, bay.heightAt(w.x, w.z));
		const m = new THREE.Matrix4().makeRotationY(-heading * Math.PI / 180 + Math.PI).setPosition(w.x, g, w.z);
		return { m, g, w };
	};
	const put = (F, mat, geo, x = 0, y = 0, z = 0, ry = 0) => { geo.rotateY(ry); geo.translate(x, y, z); geo.applyMatrix4(F.m); add(mat, geo); };
	const box = (F, mat, w, h, d, x = 0, y = 0, z = 0, ry = 0) => {
		put(F, mat, new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, ry);
		if (h > 0.12 && w > 0.05 && d > 0.05) { V.set(x, y, z).applyMatrix4(F.m); solid({ x: V.x, z: V.z, y0: V.y, y1: V.y + h, hw: w / 2, hd: d / 2, yaw: yawOf(F) + ry }); }
	};
	const cyl = (F, mat, r0, r1, h, x = 0, y = 0, z = 0, seg = 16) => {
		put(F, mat, new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, h / 2, 0), x, y, z);
		if (h > 0.12) { V.set(x, y, z).applyMatrix4(F.m); solid({ x: V.x, z: V.z, y0: V.y, y1: V.y + h, r: Math.max(r0, r1) }); }
	};
	// a frame within a frame: at (x, z) in it, turned ry, y up
	const sub = (F, x, z, ry = 0, y = 0) => ({ m: F.m.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeRotationY(ry)), g: F.g });
	// a building's shell, hollow: four walls T thick (the openings left in them: doors, at the
	// ground, [u, w, h] on each side, u along x on the z sides and along z on the x sides, as
	// the plans' doors are; +z the front), a roof over (with an opening for a court
	// or a stair), in the frame F (its middle on the ground)
	// (an opening may stand above the ground: [u, w, h, y0]; a side named in open is left out;
	// use: the doors are the townsfolk's way in, to that use)
	// (inside: a building with a floor in it, its doorways as much taller as its floor stands over
	// the ground at its middle)
	const hollow = (F, mat, W, H, D, { doors = {}, T = 0.45, roof = true, roofHole = null, roofMat = mat, open = [], use = null, inside = false } = {}) => {
		const up = inside ? rise(F, W, D) : 0;
		const side = (name, len) => {
			if (open.includes(name)) return;
			const gaps = (doors[name] || []).map(([u, w, h, y0 = 0]) => [u - w / 2, u + w / 2, h + (y0 < 0.3 ? up : 0), y0]).sort((a, b) => a[0] - b[0]);
			const piece = (a, b, y0, y1) => {
				if (b - a < 0.02 || y1 - y0 < 0.02) return;
				const u = (a + b) / 2, h = y1 - y0;
				if (name === 'z+') box(F, mat, b - a, h, T, u, y0, D / 2 - T / 2); else if (name === 'z-') box(F, mat, b - a, h, T, u, y0, -D / 2 + T / 2);
				else if (name === 'x+') box(F, mat, T, h, b - a, W / 2 - T / 2, y0, u); else box(F, mat, T, h, b - a, -W / 2 + T / 2, y0, u);
			};
			let a = -len / 2;
			for (const [g0, g1, h, y0] of gaps) {
				piece(a, g0, 0, H); piece(g0, g1, 0, y0); piece(g0, g1, y0 + h, H); a = g1;
				if (use && y0 < 0.3) {
					const u = (g0 + g1) / 2, [lx, lz, nx, nz] = name === 'z+' ? [u, D / 2, 0, 1] : name === 'z-' ? [u, -D / 2, 0, -1] : name === 'x+' ? [W / 2, u, 1, 0] : [-W / 2, u, -1, 0];
					entranceL(F, lx, lz, nx, nz, use);
				}
			}
			piece(a, len / 2, 0, H);
		};
		side('z+', W); side('z-', W); side('x+', D - 2 * T); side('x-', D - 2 * T);
		if (!roof) return;
		const rx0 = -W / 2 + T, rx1 = W / 2 - T, rz0 = -D / 2 + T, rz1 = D / 2 - T, rt = 0.4;
		if (!roofHole) { box(F, roofMat, rx1 - rx0, rt, rz1 - rz0, 0, H - rt, 0); return; }
		const [hx0, hz0, hx1, hz1] = roofHole;
		box(F, roofMat, hx0 - rx0, rt, rz1 - rz0, (rx0 + hx0) / 2, H - rt, 0); box(F, roofMat, rx1 - hx1, rt, rz1 - rz0, (hx1 + rx1) / 2, H - rt, 0);
		box(F, roofMat, hx1 - hx0, rt, hz0 - rz0, (hx0 + hx1) / 2, H - rt, (rz0 + hz0) / 2); box(F, roofMat, hx1 - hx0, rt, rz1 - hz1, (hx0 + hx1) / 2, H - rt, (hz1 + rz1) / 2);
	};
	// ---------- the insides ----------
	// a landmark built inside by the interiors (interiors/index.js addSite): its frame (the
	// shell's, front +z), the shell's size and thickness, the plan (interiors/landmarks.js);
	// the plan stands just within the shell, its outer walls hidden in the shell's thickness
	const sites = [];
	// how far a building's floor stands over its frame's ground: clear of the ground anywhere
	// under it (sampled every few metres), so no slope shows through it (kept per frame)
	const rises = new WeakMap();
	const rise = (F, W, D) => {
		if (rises.has(F)) return rises.get(F);
		const g0 = F.m.elements[13];
		let m = -1e9;
		for (let a = -W / 2; a <= W / 2 + 0.01; a += Math.max(1.5, W / 16)) for (let c = -D / 2; c <= D / 2 + 0.01; c += Math.max(1.5, D / 16)) { const [x, z] = toW(F, a, c); m = Math.max(m, bay.heightAt(x, z)); }
		const r = Math.max(0, m + 0.3 - g0);
		rises.set(F, r);
		return r;
	};
	// (street: the ground at its door, if not the terrain's there)
	const site = (key, F, W, D, plan, { T = 0.45, f0 = rise(F, W, D) + 0.05, door = { x: 0, w: 1.8 }, hours = null, street = null } = {}) => {
		const e = F.m.elements, a = -Math.atan2(e[8], e[0]);
		V.set(door.x, 0, D / 2 + 1.5).applyMatrix4(F.m);
		const S = { key, o: { x: e[12], z: e[14], a, w: W, d: D, f0: e[13] + f0, street: street ?? Math.min(e[13] + f0, Math.max(bay.heightAt(V.x, V.z), e[13] - 3)) }, ready: () => true, hours, plan: () => { const P = plan({ W: W - 2 * (T - 0.15), D: D - 2 * (T - 0.15), door }); P.hours = hours; return P; } };
		sites.push(S);
		return S;
	};
	// the smaller insides, drawn here as you come near and let go as you leave: what they
	// hold (fn draws it, into its own meshes; its solids are kept from the first time)
	const props = [];
	const prop = (x, z, r, fn) => props.push({ x, z, r, fn, group: null, once: false });
	// the doorways the townsfolk may use (the interiors' own doors are theirs: these are the
	// open ones of the halls drawn here) [{ x, z, y, nx, nz, inside, outside, use }]
	const entrances = [];
	// (in the frame F: where to the world, and back)
	const toW = (F, lx, lz) => { const e = F.m.elements; return [e[12] + e[0] * lx + e[8] * lz, e[14] - e[8] * lx + e[0] * lz]; };
	const toL = (F, x, z) => { const e = F.m.elements, dx = x - e[12], dz = z - e[14]; return [e[0] * dx - e[8] * dz, e[8] * dx + e[0] * dz]; };
	// a doorway at (lx, lz) in F, its outward normal (nx, nz) there
	const entranceL = (F, lx, lz, nx, nz, use, y = 0) => {
		const e = F.m.elements, [x, z] = toW(F, lx, lz), [ix, iz] = toW(F, lx - nx * 2, lz - nz * 2), [ox, oz] = toW(F, lx + nx * 2, lz + nz * 2);
		const wx = e[0] * nx + e[8] * nz, wz = -e[8] * nx + e[0] * nz;
		entrances.push({ x, z, y: e[13] + y, nx: wx, nz: wz, heading: Math.atan2(wx, wz), inside: { x: ix, z: iz }, outside: { x: ox, z: oz }, use });
	};
	// lifts: a car that carries you between its floors when you stand in it a moment
	const lifts = [];
	const cone = (F, mat, r, h, x = 0, y = 0, z = 0, seg = 4) => put(F, mat, new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0), x, y, z);
	const dome = (F, mat, r, x = 0, y = 0, z = 0, sy = 1) => put(F, mat, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1), x, y, z);
	const lift = (F, x, z, w, d, y0, y1) => {
		const G = [], g0 = F.m.elements[13];
		const part = (gw, gh, gd, px, py, pz) => G.push(new THREE.BoxGeometry(gw, gh, gd).translate(x + px, py + gh / 2, z + pz).applyMatrix4(F.m).toNonIndexed());
		part(w, 0.12, d, 0, -0.12, 0); part(w, 0.1, d, 0, 2.6, 0);
		for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(0.08, 2.6, 0.08, sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04));
		part(w, 1.0, 0.04, 0, 0, -d / 2 + 0.02);
		const car = new THREE.Mesh(mergeGeometries(G), mats.steel);
		car.position.y = 0;
		group.add(car);
		const L = { local: (wx, wz) => { const [lx, lz] = toL(F, wx, wz); return [lx - x, lz - z]; }, hw: w / 2, hd: d / 2, g0, y: g0 + y0, y0: g0 + y0, y1: g0 + y1, car, dwell: 0, armed: true, moving: false, to: g0 + y0 };
		lifts.push(L);
		return L;
	};
	// a flat sector of a ring, r0 to r1, from angle t0 to t1 (a cylinder's angles: round from +z
	// toward +x), at height y, facing up (or down)
	const sector = (r0, r1, t0, t1, y = 0, down = false, n = 24) => {
		const P = [], N = [];
		const at2 = (r, a) => [r * Math.sin(a), y, r * Math.cos(a)];
		for (let i = 0; i < n; i++) {
			const a = t0 + (t1 - t0) * i / n, b = t0 + (t1 - t0) * (i + 1) / n, q = [at2(r0, a), at2(r1, a), at2(r1, b), at2(r0, b)];
			for (const k of down ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) { P.push(...q[k]); N.push(0, down ? -1 : 1, 0); }
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(P.length / 3 * 2).fill(0), 2));
		return g;
	};
	// a round wall you are kept out of (r0 to r1 round (x, z) in F, y0 to y1 over its ground),
	// but where it is open: gaps [t0, t1] in a cylinder's angles
	const ringWall = (F, x, z, r0, r1, y0, y1, gaps = []) => {
		const [wx, wz] = toW(F, x, z), psi = yawOf(F), g0 = F.m.elements[13];
		solid({ ring: true, x: wx, z: wz, r: r1, r0, r1, y0: g0 + y0, y1: g0 + y1, gaps: gaps.map(([t0, t1]) => [Math.PI / 2 - psi - t1, Math.PI / 2 - psi - t0]) });
	};
	// and drawn: rb across at the foot, rt at the top, h high from y; open through the gaps from
	// its foot up gh
	const drum = (F, mat, rb, rt, h, { x = 0, z = 0, y = 0, seg = 32, gaps = [], gh = 3 } = {}) => {
		const r = (t) => rb + (rt - rb) * t / h;
		if (!gaps.length) { put(F, mat, new THREE.CylinderGeometry(rt, rb, h, seg, 1, true).translate(0, h / 2, 0), x, y, z); return; }
		const g = [...gaps].sort((a, b) => a[0] - b[0]);
		for (let i = 0; i < g.length; i++) {
			const a = g[i][1], b = i + 1 < g.length ? g[i + 1][0] : g[0][0] + Math.PI * 2;
			put(F, mat, new THREE.CylinderGeometry(r(gh), rb, gh, Math.max(2, Math.round(seg * (b - a) / (Math.PI * 2))), 1, true, a, b - a).translate(0, gh / 2, 0), x, y, z);
		}
		put(F, mat, new THREE.CylinderGeometry(rt, r(gh), h - gh, seg, 1, true).translate(0, (h + gh) / 2, 0), x, y, z);
	};
	// stands: tiers (each rise higher, run deeper) round an ellipse rx by rz from the field's edge
	// out, from angle a0 to a1 in n sections; through every gate-th section a passage cut to the
	// field; behind the top tier its rail, then the concourse ring, then the outer wall (wallH
	// high, if any), open at the passages. skip(x, z): no stands there
	const bowl = (F, mat, { rx, rz, a0 = 0, a1 = Math.PI * 2, n, tiers, rise = 0.5, run = 0.8, concourse = 6, wallH = 0, wallMat = mat, gate = 5, pass = 4, skip = null, seatMat = mats.seat }) => {
		const da = (a1 - a0) / n, full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-3;
		const place = (a, t, w, d, h, y, m, off = 0) => {
			const A = rx + t, B = rz + t, phi = Math.atan2(Math.sin(a) * A, Math.cos(a) * B), tx = Math.sin(phi), tz = -Math.cos(phi);
			box(F, m, w, h, d, Math.cos(a) * A + tx * off, y, Math.sin(a) * B + tz * off, -phi + Math.PI / 2);
		};
		const len = (a, t) => Math.hypot((rx + t) * Math.sin(a), (rz + t) * Math.cos(a)) * da * 1.03;
		for (let i = 0; i < n; i++) {
			const a = a0 + (i + 0.5) * da, open = i % gate === Math.floor(gate / 2) && (full || (i > 0 && i < n - 1));
			if (skip && skip(Math.cos(a) * (rx + tiers * run), Math.sin(a) * (rz + tiers * run))) continue;
			for (let k = 0; k < tiers; k++) {
				const t = (k + 0.5) * run, w = len(a, t), h = (k + 1) * rise, m = k % 2 ? mat : seatMat;
				if (!open) { place(a, t, w, run + 0.02, h, 0, m); continue; }
				const hw = (w - pass) / 2;
				for (const sg of [-1, 1]) place(a, t, hw, run + 0.02, h, 0, m, sg * (pass + hw) / 2);
			}
			// the rail along the top
			const tt = tiers * run;
			if (!open) place(a, tt - 0.1, len(a, tt), 0.15, 1.1, tiers * rise, mats.steel);
			else for (const sg of [-1, 1]) place(a, tt - 0.1, (len(a, tt) - pass) / 2, 0.15, 1.1, tiers * rise, mats.steel, sg * (pass + (len(a, tt) - pass) / 2) / 2);
			if (!wallH) continue;
			const tw = tt + concourse + 0.5, ww = len(a, tw);
			if (!open) { place(a, tw, ww, 1, wallH, 0, wallMat); continue; }
			const hw = (ww - pass) / 2;
			for (const sg of [-1, 1]) place(a, tw, hw, 1, wallH, 0, wallMat, sg * (pass + hw) / 2);
			place(a, tw, pass + 0.2, 1, wallH - 4.2, 4.2, wallMat);
			if (stadiumUse) { const A = rx + tw + 0.5, B = rz + tw + 0.5, phi = Math.atan2(Math.sin(a) * A, Math.cos(a) * B); entranceL(F, Math.cos(a) * A, Math.sin(a) * B, Math.cos(phi), Math.sin(phi), stadiumUse); }
		}
	};
	let stadiumUse = null;
	// a lighthouse you can climb: its round tower (rb across at the foot, rt at the top, from y0
	// up to the gallery at top), T thick; the doorway at its foot toward +z (if it stands on the
	// ground), the stair winding up inside round a post from the floor; up top the lantern room
	// (r across, lh high) and the gallery round it to walk out on behind its rail
	const lighthouse = (F, mat, { y0 = 0, rb, rt, top, T = 0.35, seg = 16, r = 1.4, lh = 2.2, gallery = 0.9 }) => {
		const ri = (y) => (y < y0 ? rb : rb + (rt - rb) * (y - y0) / (top - y0)) - T;
		const door = y0 < 0.1 ? [[-0.32, 0.32]] : [];
		drum(F, mat, rb, rt, top - y0, { y: y0, seg, gaps: door, gh: 2.3 });
		drum(F, mat, rb - T, rt - T, top - y0, { y: y0, seg, gaps: door, gh: 2.3 });
		// (mat is seen from inside too: two-sided)
		ringWall(F, 0, 0, Math.min(rt, rb) - T, Math.max(rt, rb), y0, y0 + 2.4, door);
		ringWall(F, 0, 0, Math.min(rt, rb) - T, Math.max(rt, rb), y0 + 2.4, top);
		if (door.length) entranceL(F, 0, rb, 0, 1, 'lighthouse');
		// the stair: sixteen treads a turn, each a fifth of a metre up, round the post
		const n = Math.ceil((top - 0.05) / 0.2), dt = Math.PI * 2 / 16, t0 = 1.0;
		cyl(F, mats.steel, 0.12, 0.12, top + 1, 0, 0, 0, 8);
		for (let k = 0; k < n; k++) {
			const y1 = Math.min(top, (k + 1) * 0.2), re = Math.min(ri(y1), ri(y1 - 2)) - 0.04, rm = (0.12 + re) / 2, a = t0 + k * dt;
			box(F, mats.steel, dt * re + 0.04, 0.14, re - 0.12, Math.sin(a) * rm, y1 - 0.14, Math.cos(a) * rm, a);
		}
		// the gallery floor (to stand on as you come up through it), the lantern room on it
		const rg = rt + gallery, aEnd = t0 + (n - 1) * dt;
		ghost++;
		put(F, mats.dark, sector(0.12, rg, aEnd + 0.4, aEnd - 1.6 + Math.PI * 2, 0, false, 28), 0, top, 0);
		put(F, mats.dark, sector(0.12, rg, aEnd + 0.4, aEnd - 1.6 + Math.PI * 2, 0, true, 28), 0, top - 0.2, 0);
		put(F, mats.dark, new THREE.CylinderGeometry(rg, rg, 0.2, 32, 1, true).translate(0, -0.1, 0), 0, top, 0);
		drum(F, mats.darkIn, r, r, 0.9, { y: top, seg: 24, gaps: [[-0.4, 0.4]], gh: 0.9 });
		drum(F, mats.lampIn, r, r, lh - 0.9, { y: top + 0.9, seg: 24, gaps: [[-0.4, 0.4]], gh: lh - 0.9 });
		for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; box(F, mats.dark, 0.06, 1.05, 0.06, Math.sin(a) * (rg - 0.05), top, Math.cos(a) * (rg - 0.05)); }
		put(F, mats.dark, new THREE.TorusGeometry(rg - 0.05, 0.04, 4, 32).rotateX(Math.PI / 2), 0, top + 1.05, 0);
		cyl(F, mats.glow, 0.35, 0.35, 0.9, 0, top + 0.8, 0, 12);
		cone(F, mats.dark, r + 0.3, 1.1, 0, top + lh, 0, 16);
		ghost--;
		const [gx, gz] = toW(F, 0, 0), g0 = F.m.elements[13];
		solid({ x: gx, z: gz, y0: g0 + top - 0.1, y1: g0 + top, r: rg, walk: true });
		ringWall(F, 0, 0, r - 0.05, r + 0.05, top, top + lh, [[-0.4, 0.4]]);
		ringWall(F, 0, 0, rg - 0.1, rg, top, top + 1.05);
		cyl(F, mats.dark, 0.45, 0.45, 0.8, 0, top, 0, 12);
	};
	// an arena's inside, drawn as you come near: the court (or the rink), the bowl of seats round
	// it (n sections, the passages to the court through every sixth), the scoreboard over it and
	// the lamps; shell(gaps) draws its round wall, open where the passages are
	const arena = (F, n, shell, { rx, rz, tiers, court, r, roof }) => {
		const gaps = [];
		for (let i = 3; i < n; i += 6) { const t = Math.PI / 2 - (i + 0.5) * Math.PI * 2 / n; gaps.push([t - 0.03, t + 0.03]); }
		if (shell) shell(gaps);
		const [cx, cz] = toW(F, 0, 0);
		prop(cx, cz, r, () => {
			const [w, d, m] = court;
			put(F, m, new THREE.BoxGeometry(w, 0.1, d).translate(0, 0.05, 0));
			bowl(F, mats.concrete, { rx, rz, n, tiers, rise: 0.6, run: 1.0, concourse: 0, gate: 6 });
			ghost++;
			box(F, mats.dark, 8, 5, 8, 0, roof - 10, 0); box(F, mats.glow, 7.4, 3.6, 8.2, 0, roof - 9.3, 0); box(F, mats.glow, 8.2, 3.6, 7.4, 0, roof - 9.3, 0);
			for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; box(F, mats.glow, 2, 0.3, 2, Math.cos(a) * (rx + 18), roof - 1, Math.sin(a) * (rz + 18)); }
			ghost--;
		});
	};
	// bells hung in a belfry over its deck, d out from the middle
	const bells = (F, deck, d) => {
		ghost++;
		for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
			put(F, mats.bronze, new THREE.CylinderGeometry(0.35, 0.75, 1.2, 14, 1, true).translate(0, 0.6, 0), sx * d, deck + 4.2, sz * d);
			cyl(F, mats.bronze, 0.36, 0.36, 0.1, sx * d, deck + 5.4, sz * d, 10);
		}
		for (const sz of [-1, 1]) box(F, mats.wood, 2 * d + 1, 0.3, 0.3, 0, deck + 5.5, sz * d);
		ghost--;
	};
	// a belfry: a square shaft W across (T thick) up to its deck, the lift up the middle to it,
	// the arches open all round over the deck (open0 to open1, between the piers at its corners),
	// its roof at H; a door at the foot toward +z
	const belfry = (F, mat, { W, deck, open0, open1, H, W2 = W, door = [0, 1.6, 2.8], T = 0.6, use = 'tower' }) => {
		hollow(F, mat, W, deck, W, { T, roof: false, doors: { 'z+': [door] }, use });
		const pier = Math.min(2, W2 * 0.18), wo = W2 - 2 * pier;
		const up = sub(F, 0, 0, 0, deck), sides = { 'z+': [[0, wo, open1 - open0, open0 - deck]], 'z-': [[0, wo, open1 - open0, open0 - deck]], 'x+': [[0, wo, open1 - open0, open0 - deck]], 'x-': [[0, wo, open1 - open0, open0 - deck]] };
		hollow(up, mat, W2, H - deck, W2, { T, doors: sides });
		// the deck, round the lift's shaft, a rail round that (its gate shut while the lift is away)
		const h = 1.3, inner = W / 2 - T;
		tag = { walk: true };
		box(F, mat, 2 * inner, 0.3, inner - h, 0, deck - 0.3, (inner + h) / 2); box(F, mat, 2 * inner, 0.3, inner - h, 0, deck - 0.3, -(inner + h) / 2);
		box(F, mat, inner - h, 0.3, 2 * h, (inner + h) / 2, deck - 0.3, 0); box(F, mat, inner - h, 0.3, 2 * h, -(inner + h) / 2, deck - 0.3, 0);
		tag = null;
		// (where the shaft is wider than the belfry on it, a parapet round its top)
		if (W > W2) for (const [x, z, w, d] of [[0, W / 2 - 0.1, W, 0.2], [0, -W / 2 + 0.1, W, 0.2], [W / 2 - 0.1, 0, 0.2, W], [-W / 2 + 0.1, 0, 0.2, W]]) box(F, mats.steel, w, 1.1, d, x, deck, z);
		const L = lift(F, 0, 0, 2 * h - 0.2, 2 * h - 0.2, 0, deck);
		box(F, mats.steel, 2 * h, 1.1, 0.06, 0, deck, -h); box(F, mats.steel, 0.06, 1.1, 2 * h, h, deck, 0); box(F, mats.steel, 0.06, 1.1, 2 * h, -h, deck, 0);
		tag = { on: () => Math.abs(L.y - L.y1) > 0.05 }; box(F, mats.steel, 2 * h, 1.1, 0.06, 0, deck, h); tag = null;
		return L;
	};

	// ---------------- Alcatraz ----------------
	// The Rock as it stands. The ground under it (bay/terrain.js) is a soft lump sampled every
	// 15 m, so the island is built again over it here: the ground's own heights, steepened into
	// cliffs at the water, stepped into the benches and retaining walls of the terraces, cut
	// flat along the crest for the cellhouse and graded for the road, and never below the
	// ground. Dark greywacke streaked white by the gulls on the sides; ice plant, dry grass,
	// rubble and the old gardens on the terraces. On it, in the real layout: the cellhouse along
	// the crest, 150 m by 40, running north-west to south-east, three storeys of barred windows
	// under a flat roof with its long skylights, the recreation yard's walls on its south-west
	// side; at its south-east end the 1909 lighthouse (84 ft, white, tapering) against the burnt
	// shell of the warden's house; the water tower to the north with the occupation's words
	// round its tank, and the powerhouse stack; Building 64, the old barracks, along the dock
	// with its red INDIANS WELCOME; the officers' club's shell; the road switching back up from
	// the dock by the parade ground; and the gulls, perched and wheeling.
	function alcatraz() {
		const O = toWorld(37.8267, -122.4230), CREST = 42.2, CELL = 3;
		// a frame at (x, z) metres east and south of the island's middle, heading as at()'s
		const atL = (x, z, heading, base) => ({ m: new THREE.Matrix4().makeRotationY(-heading * Math.PI / 180 + Math.PI).setPosition(O.x + x, base, O.z + z) });
		const tAt = (x, z) => bay.heightAt(O.x + x, O.z + z);
		// the cellhouse's axes: a along it (south-east), c across it (north-east); likewise the dock's
		const axes = (x, z, h) => { const ax = Math.sin(h * Math.PI / 180), az = -Math.cos(h * Math.PI / 180); return { x, z, h, ax, az, to: (a, c) => [x + a * ax + c * az, z + a * az - c * ax], of: (px, pz) => [(px - x) * ax + (pz - z) * az, (px - x) * az - (pz - z) * ax] }; };
		const CH = axes(20, 10, 125), DK = axes(186, 48, 143);
		// a rod from p to q (each [x, y, z] in the frame F)
		const Yv = new THREE.Vector3(0, 1, 0);
		const rod = (F, mat, p, q, r, seg = 5) => {
			const d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]), L = d.length();
			const g = new THREE.CylinderGeometry(r, r, L, seg).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Yv, d.normalize()));
			put(F, mat, g, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
		};

		// ---- the road, from the dock round by the parade ground and up the crest's flank ----
		const WAY = [[167, 0], [150, 18], [200, 92], [150, 90], [100, 94], [80, 86], [40, 64], [4, 40]];
		const DECK = (() => { let m = 0; for (let a = -45; a <= 45; a += 5) for (let c = 8; c <= 30; c += 4) { const [x, z] = DK.to(a, c); m = Math.max(m, tAt(x, z)); } return Math.max(2.6, m + 0.8); })();
		const road = [];
		for (let i = 0; i < WAY.length - 1; i++) {
			const [x0, z0] = WAY[i], [x1, z1] = WAY[i + 1], l = Math.hypot(x1 - x0, z1 - z0);
			for (let s = 0; s < l - 0.01; s += 2) road.push([x0 + (x1 - x0) * s / l, z0 + (z1 - z0) * s / l]);
		}
		road.push(WAY[WAY.length - 1]);
		{
			// its grade: never below the ground, climbing all the way, the last pitch at 16% to
			// the crest; then eased
			let s = 0, env = DECK;
			const len = road.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - road[i - 1][0], p[1] - road[i - 1][1]) : 0), 0);
			road.forEach((p, i) => { if (i) s += Math.hypot(p[0] - road[i - 1][0], p[1] - road[i - 1][1]); p.push(tAt(p[0], p[1])); env = Math.max(env, p[2] + 0.8); p.push(Math.min(CREST, Math.max(env, CREST - (len - s) * 0.16))); });
			for (let k = 0; k < 6; k++) { const y = road.map((p) => p[3]); for (let i = 1; i < road.length - 1; i++) road[i][3] = Math.max(road[i][2] + 0.8, (y[i - 1] + y[i] * 2 + y[i + 1]) / 4); }
			road[road.length - 1][3] = CREST;
		}
		const roadAt = (x, z) => { let d = 1e9, y = 0; for (const p of road) { const e = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (e < d) { d = e; y = p[3]; } } return [Math.sqrt(d), y]; };

		// ---- the Rock itself ----
		const X0 = -290, Z0 = -230, NX = Math.round(590 / CELL) + 1, NZ = Math.round(460 / CELL) + 1;
		const H = new Float32Array(NX * NZ).fill(NaN), idx = new Int32Array(NX * NZ).fill(-1);
		const inRect = (a, c, a0, a1, c0, c1) => Math.max(a0 - a, a - a1, c0 - c, c - c1), [la, lc] = CH.of(...WAY[WAY.length - 1]);
		// the cellhouse's floor (and its entrance hall's): the crest, or over the survey's ground
		// where that stands higher in it; the Rock kept under the floor there
		const inCH = (a, c) => inRect(a, c, -77, 91, -21, 21) <= 0;
		let FLOOR = CREST;
		for (let a = -77; a <= 91; a += 3) for (let c = -21; c <= 21; c += 3) { const [x, z] = CH.to(a, c); FLOOR = Math.max(FLOOR, tAt(x, z) + 0.2); }
		for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
			const x = X0 + i * CELL, z = Z0 + j * CELL, t = tAt(x, z), k = j * NX + i;
			if (t < -7) continue;
			// cliffs three times the ground's steepness at the water; above, benches every 10 m or
			// so, their edges wandering (and never below the ground: see the last line)
			const tw = t - 5 + (vn(x / 45 + 7, z / 45) - 0.5) * 5, fl = Math.floor(tw / 10), fr = tw / 10 - fl, qv = 10 * (fl + Math.min(1, fr * 4)) + 5, cl = 3 * t + 2;
			let h = Math.min(cl, qv, CREST);
			const rough = Math.max(smooth(0, 3, qv - cl), fr < 0.25 ? 1 : 0) * (h < CREST - 0.1 ? 1 : 0);
			h += (vn(x / 5, z / 5) + vn(x / 2, z / 2) * 0.5 - 0.75) * 2.4 * rough;
			// the crest cut level for the cellhouse, its yard, the lighthouse and the warden's house
			const [a, c] = CH.of(x, z);
			const dPad = Math.min(inRect(a, c, -95, 100, -26, 44), inRect(a, c, -86, -4, -70, -20), Math.hypot(a - la, c - lc) - 9);
			h += (CREST - h) * smooth(5, 0, dPad);
			// the dock, down at the water
			const [da, dc] = DK.of(x, z);
			h += (Math.min(h, DECK - 0.4) - h) * smooth(3, 0, inRect(da, dc, -50, 50, 8, 32));
			// the road's bench
			const [rd, ry] = roadAt(x, z);
			h += (ry - 0.1 - h) * smooth(9, 3.5, rd);
			if (t > -1) h = Math.max(h, t + 0.6);
			if (inCH(a, c)) h = FLOOR - 0.15;
			H[k] = h;
		}
		const hAt = (x, z) => {
			const fi = (x - X0) / CELL, fj = (z - Z0) / CELL;
			if (fi < 0 || fj < 0 || fi >= NX - 1 || fj >= NZ - 1) return NaN;
			const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * NX + i;
			return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + NX] * (1 - u) + H[k + NX + 1] * u) * v;
		};
		{
			const P = [], C = [], I = [];
			for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
				const k = j * NX + i, h = H[k];
				if (h !== h) continue;
				const x = X0 + i * CELL, z = Z0 + j * CELL;
				idx[k] = P.length / 3;
				P.push(O.x + x, h, O.z + z);
				const nb = (di, dj) => { const v = H[Math.min(NZ - 1, Math.max(0, j + dj)) * NX + Math.min(NX - 1, Math.max(0, i + di))]; return v === v ? v : h; };
				const slope = Math.hypot(nb(1, 0) - nb(-1, 0), nb(0, 1) - nb(0, -1)) / (2 * CELL), n1 = vn(x / 4, z / 4);
				// dark greywacke, the gulls' white streaked down from the ledges
				let r = 0.3 + n1 * 0.08, g = 0.29 + n1 * 0.07, b = 0.27 + n1 * 0.06;
				const guano = 0.75 * smooth(0.6, 1.2, slope) * smooth(0.55, 0.75, vn(x / 3, z / 3 + h / 4) * 0.7 + vn(x / 9, z / 9) * 0.5) * smooth(2, 8, h);
				r += (0.84 - r) * guano; g += (0.83 - g) * guano; b += (0.78 - b) * guano;
				// on the level: ice plant, dry grass, old paving and rubble
				const flat = smooth(0.55, 0.25, slope) * smooth(3, 6, h);
				const plant = smooth(0.4, 0.62, vn(x / 11 + 3, z / 11)), pave = smooth(0.55, 0.75, vn(x / 7 - 5, z / 7 + 2));
				let fr = 0.5 + n1 * 0.06, fg = 0.47 + n1 * 0.05, fb = 0.31;
				fr += (0.26 - fr) * plant; fg += (0.38 - fg) * plant; fb += (0.17 - fb) * plant;
				fr += (0.6 - fr) * pave; fg += (0.58 - fg) * pave; fb += (0.54 - fb) * pave;
				r += (fr - r) * flat; g += (fg - g) * flat; b += (fb - b) * flat;
				// wet and weedy at the water line
				const wet = smooth(2.5, 0.2, h);
				r += (0.14 - r) * wet; g += (0.15 - g) * wet; b += (0.12 - b) * wet;
				C.push(r ** 2.2, g ** 2.2, b ** 2.2);
			}
			for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
				const k = j * NX + i, a = idx[k], b = idx[k + 1], c = idx[k + NX], d = idx[k + NX + 1];
				if (a >= 0 && b >= 0 && c >= 0 && d >= 0) I.push(a, c, b, b, c, d);
			}
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
			g.setIndex(I); g.computeVertexNormals();
			const rock = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));
			rock.castShadow = true; rock.receiveShadow = true; rock.name = 'alcatraz-rock';
			group.add(rock);
		}
		const base = (x, z) => { const h = hAt(x, z); return h === h ? h : Math.max(0, tAt(x, z)); };

		// ---- the road: asphalt, a concrete parapet on its downhill side ----
		{
			const P = [], N = [], UV = [], I = [];
			for (let i = 0; i < road.length; i++) {
				const p = road[i], q = road[Math.min(road.length - 1, i + 1)], o = road[Math.max(0, i - 1)];
				const dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1, px = -dz / l * 2.7, pz = dx / l * 2.7;
				P.push(O.x + p[0] + px, p[3] + 0.06, O.z + p[1] + pz, O.x + p[0] - px, p[3] + 0.06, O.z + p[1] - pz);
				N.push(0, 1, 0, 0, 1, 0); UV.push(0, 0, 1, 0);
				if (i) I.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
				if (i % 2 === 0 && i < road.length - 1) {
					// (the parapet where the ground falls away from the road)
					const side = tAt(p[0] + px * 2, p[1] + pz * 2) < tAt(p[0] - px * 2, p[1] - pz * 2) ? 1 : -1;
					const F = atL(p[0] + px * side * 1.05, p[1] + pz * side * 1.05, Math.atan2(dx, -dz) * 180 / Math.PI, p[3]);
					box(F, mats.concrete, 0.3, 0.9, 4.1);
				}
			}
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
			g.setIndex(I);
			add(mats.pavement, g);
		}

		// ---- the cellhouse ----
		{
			const F = atL(CH.x, CH.z, CH.h, CREST);
			box(F, mats.cellhouse, 42, 12, 152, 0, -12, 0);
			// (its walls hollow: inside, the cell blocks down Broadway and the dining hall at the far
			// end, interiors/landmarks.js; in through the administration wing)
			hollow(F, mats.cellhouse, 40, 14.5, 150, { doors: { 'z+': [[0, 3, 3.6 + FLOOR - CREST]] } });
			site('alcatraz-cellhouse', F, 40, 150, cellhouse, { door: { x: 0, w: 3, h: 3.6 }, hours: [9, 18.5], f0: FLOOR - CREST + 0.05, street: FLOOR + 0.05 });
			box(F, mats.cellhouse, 40.8, 0.7, 150.8, 0, 14.5, 0);
			box(F, mats.concrete, 39.6, 0.3, 149.6, 0, 15.2, 0);
			// the roof's two long skylight monitors
			for (const s of [-1, 1]) { box(F, mats.cellhouse, 5, 2.4, 124, s * 9, 15.2, 0); box(F, mats.glass, 5.2, 1.3, 122, s * 9, 15.7, 0); box(F, mats.concrete, 5.6, 0.25, 124.6, s * 9, 17.6, 0); }
			// the tall barred windows down both long sides, the small ones over them
			for (let i = 0; i < 28; i++) for (const s of [-1, 1]) {
				const z = -67.5 + i * 5;
				box(F, mats.dark, 0.3, 9, 2.6, s * 20.02, 2.4, z);
				for (const b of [-0.65, 0, 0.65]) box(F, mats.steel, 0.14, 9, 0.12, s * 20.2, 2.4, z + b);
				for (let k = 0; k < 5; k++) box(F, mats.steel, 0.14, 0.12, 2.6, s * 20.2, 2.4 + k * 2.22, z);
				box(F, mats.dark, 0.3, 1.1, 2.2, s * 20.02, 12.3, z);
			}
			for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) if (i || s < 0) box(F, mats.dark, 2.4, 8, 0.3, i * 5, 2.4, s * 75.02);
			// the administration wing and main door at the south-east end (its hall the way in to
			// the cellhouse), the dining hall at the other
			const A = sub(F, 0, 82.5);
			hollow(A, mats.cellhouse, 30, 11, 15, { doors: { 'z+': [[0, 3, 3.6 + FLOOR - CREST]], 'z-': [[0, 3, 3.6 + FLOOR - CREST]] }, use: 'museum' });
			site('alcatraz-hall', A, 30, 15, oneRoom('rotunda', 5, {}, [{ side: 'z-', u: 0, w: 3, h: 3.6 }]), { door: { x: 0, w: 3, h: 3.6 }, hours: [9, 18.5], f0: FLOOR - CREST + 0.05, street: CREST + 0.05 });
			box(F, mats.cellhouse, 31, 0.6, 16, 0, 11, 82.5);
			for (let i = -5; i <= 5; i++) for (const y of [2, 6.5]) if (i || y > 3) box(F, mats.dark, 1.3, 1.9, 0.3, i * 2.6, y, 90.02);
			box(F, mats.cellhouse, 36, 10, 15, 0, 0, -82.5); box(F, mats.cellhouse, 36.8, 0.6, 15.8, 0, 10, -82.5);
			for (let i = -6; i <= 6; i++) box(F, mats.dark, 1.5, 4.5, 0.3, i * 2.7, 3, -90.02);
			// the recreation yard: its high walls, the concrete steps, a guard tower at the corner
			box(F, mats.concrete, 44, 0.2, 76, -42, 0, -44);
			box(F, mats.cellhouse, 1, 6.5, 77, -64.5, 0, -44); box(F, mats.cellhouse, 45, 6.5, 1, -42, 0, -82.5); box(F, mats.cellhouse, 45, 6.5, 1, -42, 0, -5.5);
			for (let k = 0; k < 7; k++) box(F, mats.concrete, 42, 0.55, (7 - k) * 1.1, -42, k * 0.55, -82 + (7 - k) * 0.55);
			for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(F, mats.steel, 0.25, 9, 0.25, -64.5 + x * 1.6, 0, -82.5 + z * 1.6);
			box(F, mats.cellhouse, 4.4, 2.6, 4.4, -64.5, 9, -82.5); box(F, mats.dark, 4.5, 1, 4.5, -64.5, 10.1, -82.5); box(F, mats.concrete, 5.4, 0.3, 5.4, -64.5, 11.6, -82.5);
			// gulls along the roof's edge
			for (let i = 0; i < 26; i++) gull(F, (i % 2 ? 1 : -1) * 20.2, 15.2, -70 + i * 5.4 + (i % 3), i * 1.7);
		}
		// ---- the lighthouse, 1909: white concrete, tapering, the gallery and lantern ----
		{
			const [x, z] = CH.to(84, 36), F = atL(x, z, CH.h, CREST);
			// the keeper's room at its foot, the stair winding up out of it to the lantern
			hollow(F, mats.white, 6.5, 3.4, 6.5, { T: 0.4, doors: { 'z+': [[0, 1.2, 2.3]] }, roofHole: [-2.4, -2.4, 2.4, 2.4], use: 'lighthouse' });
			ghost++;
			for (const [w, d, cx, cz] of [[7, 1.1, 0, 2.95], [7, 1.1, 0, -2.95], [1.1, 4.8, 2.95, 0], [1.1, 4.8, -2.95, 0]]) box(F, mats.white, w, 0.4, d, cx, 3.4, cz);
			box(F, mats.wood, 0.9, 0.75, 0.7, 2.3, 0, -2.35); box(F, mats.dark, 0.7, 0.9, 0.6, -2.4, 0, -2.4); cyl(F, mats.dark, 0.06, 0.06, 2.2, -2.4, 0.9, -2.4, 6);
			box(F, mats.wood, 0.45, 0.45, 0.45, 2.3, 0, -1.6); box(F, mats.sail, 0.9, 0.5, 1.9, -2.4, 0, 1.4);
			cyl(F, mats.white, 1.85, 2.5, 0.6, 0, 21.25, 0, 16);
			ghost--;
			lighthouse(F, mats.whiteIn, { y0: 3.4, rb: 2.7, rt: 1.85, top: 21.85, T: 0.35, r: 1.42, lh: 2.6, gallery: 0.75 });
			for (let i = 0; i < 5; i++) gull(F, (i - 2) * 1.2, 3.8, 3.3, i * 2.3);
		}
		// a shell of walls: piers and the bands between floors, the openings empty, the tops broken
		const shell = (F, mat, L, W, ht, floors, seed) => {
			const fh = ht / floors;
			for (const [len, along, off] of [[L, true, W / 2], [L, true, -W / 2], [W, false, L / 2], [W, false, -L / 2]]) {
				const bays = Math.max(2, Math.round(len / 3.2)), bw = len / bays;
				const wall = (u, y, w, h) => (along ? box(F, mat, 0.5, h, w, off, y, u) : box(F, mat, w, h, 0.5, u, y, off));
				for (let b = 0; b <= bays; b++) {
					const u = -len / 2 + b * bw, top = ht - ih(b + seed, off > 0 ? 3 : 7) * ht * 0.45;
					wall(u, 0, 1.2, top);
					if (b === bays) break;
					for (let f = 0; f < floors; f++) {
						const y = f * fh;
						if (y + fh > top + 0.5) break;
						wall(u + bw / 2, y, bw - 1.2, 0.9);
						wall(u + bw / 2, y + fh - 0.7, bw - 1.2, 0.7);
					}
				}
			}
			box(F, mats.dark, W - 1, 0.2, L - 1);
		};
		// ---- the warden's house, burnt in 1970: three storeys of empty walls and its chimneys ----
		{
			const [x, z] = CH.to(62, 34), F = atL(x, z, CH.h, CREST);
			shell(F, mats.ruin, 24, 14, 10.5, 3, 11);
			box(F, mats.ruin, 1.3, 13, 1.3, -7.6, 0, -6); box(F, mats.ruin, 1.3, 12, 1.3, 7.6, 0, 5);
			for (let i = 0; i < 7; i++) gull(F, 7.3, 10.5 - (i % 3) * 1.4, -9 + i * 3, i * 3.1);
		}
		// ---- the officers' club, burnt the same summer: its long arcaded shell above the dock ----
		{
			const x = 152, z = 58, F = atL(x, z, DK.h, base(x, z));
			box(F, mats.ruin, 16, 3, 32, 0, -3, 0);
			shell(F, mats.ruin, 30, 13, 5, 1, 23);
		}
		// ---- Building 64 at the dock: the barracks, four storeys to the water, the red paint ----
		{
			const F = atL(DK.x, DK.z, DK.h, DECK);
			box(F, mats.b64, 17, DECK + 4, 77, 0, -(DECK + 4), 0);
			box(F, mats.b64, 16, 16, 76);
			box(F, mats.concrete, 16.8, 0.5, 76.8, 0, 16, 0);
			for (let f = 0; f < 4; f++) for (let i = 0; i < 19; i++) {
				const z = -36 + i * 4;
				if (!(f >= 2 && Math.abs(z) < 14)) box(F, mats.dark, 0.3, 1.8, 1.6, 8.02, 1.2 + f * 4, z);
				if (f >= 1) box(F, mats.dark, 0.3, 1.8, 1.6, -8.02, 1.2 + f * 4, z);
			}
			box(F, mats.redPaint, 0.2, 1.1, 76.2, 8.12, 14.4, 0);
			const sign = new THREE.PlaneGeometry(26, 6.5).rotateY(Math.PI / 2), uv = sign.attributes.uv;
			for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.5);
			put(F, mats.painted, sign, 8.3, 11, 0);
			// the wharf on its piles, bollards along its edge, the ferry slip
			box(F, mats.concrete, 22, 1.2, 96, 19, -1.2, 0);
			for (let i = -4; i <= 4; i++) { for (const x of [12, 20, 28]) cyl(F, mats.concrete, 0.45, 0.45, DECK + 7, x, -(DECK + 7), i * 11, 6); box(F, mats.dark, 0.5, 0.6, 0.5, 29.4, 0, i * 11 + 5); }
			box(F, mats.steel, 8, 0.6, 14, 34, -1.4, 40);
			for (let i = 0; i < 9; i++) gull(F, 29.5, 0.6, -44 + i * 11 + 5, i * 0.9);
		}
		// ---- the water tower, on its legs on the north end, the words round its tank ----
		{
			const x = -108, z = -108, F = atL(x, z, 20, base(x, z)), R = 6.4, TOP = 24;
			const legs = [];
			for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; legs.push([Math.cos(a), Math.sin(a)]); }
			for (const [c, s] of legs) rod(F, mats.steel, [c * 7.2, 0, s * 7.2], [c * 5.6, TOP, s * 5.6], 0.3, 6);
			for (let i = 0; i < 6; i++) {
				const [c0, s0] = legs[i], [c1, s1] = legs[(i + 1) % 6], r = (y) => 7.2 - y / TOP * 1.6;
				for (const [y0, y1] of [[1.5, 9], [9, 16.5], [16.5, TOP - 0.5]]) {
					rod(F, mats.steel, [c0 * r(y0), y0, s0 * r(y0)], [c1 * r(y1), y1, s1 * r(y1)], 0.07, 4);
					rod(F, mats.steel, [c1 * r(y0), y0, s1 * r(y0)], [c0 * r(y1), y1, s0 * r(y1)], 0.07, 4);
					rod(F, mats.steel, [c0 * r(y1), y1, s0 * r(y1)], [c1 * r(y1), y1, s1 * r(y1)], 0.12, 4);
				}
			}
			cyl(F, mats.steel, 0.5, 0.5, 6, 0, TOP - 6, 0, 8);
			put(F, mats.steel, new THREE.ConeGeometry(R, 2.2, 24).rotateX(Math.PI), 0, TOP + 0.4, 0);
			cyl(F, mats.dark, R + 0.9, R + 0.9, 0.2, 0, TOP + 1.4, 0, 24);
			const tank = new THREE.CylinderGeometry(R, R, 9, 32, 1, true).translate(0, 4.5, 0), uv = tank.attributes.uv;
			for (let i = 0; i < uv.count; i++) uv.setY(i, 0.5 + uv.getY(i) * 0.5);
			put(F, mats.painted, tank, 0, TOP + 1.5, 0);
			cone(F, mats.steel, R + 0.2, 2.4, 0, TOP + 10.5, 0, 24);
			for (let i = 0; i < 8; i++) gull(F, Math.cos(i * 0.8) * (R + 0.7), TOP + 1.6, Math.sin(i * 0.8) * (R + 0.7), i);
		}
		// ---- the powerhouse and its stack; the model industries building on the north point ----
		{
			const x = -142, z = -92, F = atL(x, z, 35, base(x, z));
			box(F, mats.b64, 16, 11, 26, 0, -3, 0); box(F, mats.concrete, 16.6, 0.5, 26.6, 0, 8, 0);
			for (let i = -2; i <= 2; i++) box(F, mats.dark, 0.3, 3, 2.2, 8.02, 3, i * 5);
			cyl(F, mats.concrete, 1.9, 1.3, 34, 0, 8, -8, 12);
			const x2 = -176, z2 = -150, F2 = atL(x2, z2, 50, base(x2, z2));
			box(F2, mats.b64, 14, 13, 90, 0, -4, 0); box(F2, mats.concrete, 14.6, 0.5, 90.6, 0, 9, 0);
			for (let i = 0; i < 22; i++) for (const s of [-1, 1]) box(F2, mats.dark, 0.3, 2.2, 2.6, s * 7.02, 4.8, -42 + i * 4);
		}
		// ---- the parade ground: the rubble of the apartments pulled down in 1971 ----
		for (let i = 0; i < 40; i++) {
			const x = 120 + ih(i, 1) * 80, z = 96 + ih(i, 2) * 50, F = atL(x, z, ih(i, 3) * 360, base(x, z) - 0.3);
			box(F, i % 3 ? mats.ruin : mats.concrete, 1 + ih(i, 4) * 3, 0.5 + ih(i, 5) * 1.2, 1 + ih(i, 6) * 4);
		}
		// ---- the gardens on the terraces, and a few old cypresses ----
		for (let i = 0; i < 150; i++) {
			const x = -70 + ih(i, 11) * 230, z = -60 + ih(i, 12) * 170, h = hAt(x, z), nb = hAt(x + 3, z);
			if (h !== h || nb !== nb || h < 8 || Math.abs(nb - h) > 0.6 || Math.abs(h - CREST) < 0.3 || inCH(...CH.of(x, z)) || roadAt(x, z)[0] < 5) continue;
			const F = atL(x, z, 0, h), r = 0.6 + ih(i, 13) * 0.9;
			put(F, i % 5 ? mats.green : mats.cypress, new THREE.IcosahedronGeometry(r, 0).scale(1.3, 0.8, 1.2).translate(0, r * 0.5, 0));
			if (i % 9 === 0) { cyl(F, mats.wood, 0.25, 0.2, 4, 1.5, 0, 0, 5); put(F, mats.cypress, new THREE.IcosahedronGeometry(3, 0).scale(1.4, 1, 1.2).translate(1.5, 5.5, 0)); }
		}
		// ---- the gulls: western gulls on the ledges of the cliffs ----
		for (let i = 0, n = 0; i < 4000 && n < 110; i++) {
			const x = X0 + ih(i, 21) * (NX - 1) * CELL, z = Z0 + ih(i, 22) * (NZ - 1) * CELL, h = hAt(x, z), nb = hAt(x, z + 2);
			if (h !== h || nb !== nb || h < 3 || h > 30 || Math.abs(nb - h) > 0.8) continue;
			gull(atL(x, z, 0, h), 0, 0, 0, i); n++;
		}
		// ---- and wheeling over it on the wind off the cliffs ----
		for (const [n, r0, y0, w] of [[9, 90, 55, 0.12], [7, 150, 80, -0.08]]) {
			const L = [], turn = w > 0 ? Math.PI : 0;
			for (let i = 0; i < n; i++) {
				const a = i / n * Math.PI * 2 + ih(i, n), r = r0 * (0.7 + ih(i, 5) * 0.6), x = Math.cos(a) * r, y = y0 + ih(i, 6) * 30, z = Math.sin(a) * r;
				// (the body along its path round, the long wings a little bent)
				for (const s of [-1, 1]) L.push(new THREE.BoxGeometry(0.75, 0.03, 0.22).translate(s * 0.4, 0, 0).rotateZ(s * 0.18).rotateY(turn - a).translate(x, y, z));
				L.push(new THREE.SphereGeometry(0.14, 6, 4).scale(1, 1, 3).rotateY(turn - a).translate(x, y, z));
			}
			const wheel = new THREE.Mesh(mergeGeometries(L.map((g) => g.toNonIndexed())), mats.gull);
			wheel.position.set(O.x, 0, O.z);
			wheel.onBeforeRender = () => { wheel.rotation.y = performance.now() * 0.001 * w; };
			group.add(wheel);
		}
		return { hAt, O, FLOOR };
	}
	// a western gull, standing: white body and head, grey mantle, yellow bill left to the eye
	function gull(F, x, y, z, k) {
		const a = k * 2.4;
		put(F, mats.gull, new THREE.SphereGeometry(0.16, 6, 4).scale(1.7, 0.9, 0.9).rotateY(a), x, y + 0.2, z);
		put(F, mats.gull, new THREE.SphereGeometry(0.08, 6, 4), x + Math.cos(a) * 0.24, y + 0.33, z - Math.sin(a) * 0.24);
		put(F, mats.gullGrey, new THREE.SphereGeometry(0.15, 6, 4).scale(1.8, 0.5, 1).rotateY(a), x - Math.cos(a) * 0.03, y + 0.27, z + Math.sin(a) * 0.03);
	}

	// ---------------- San Francisco ----------------
	{ // Ferry Building: a long granite shed along the Embarcadero and its clock tower
		// (inside, the marketplace down its nave, interiors/landmarks.js: in at the arches along the
		// city side and the bay side, and at either end; its front, +z here, the city's)
		const F = at(37.7955, -122.3937, 150), S = sub(F, 0, 0, -Math.PI / 2), arch = (u) => [u, 3.2, 3.6];
		hollow(S, mats.stone, 200, 14, 30, { inside: true, use: 'market', doors: { 'z+': [arch(12), arch(-12)], 'z-': [arch(0), arch(-50), arch(50)], 'x+': [arch(0)], 'x-': [arch(0)] } });
		site('ferry-building', S, 200, 30, ferryBuilding, { door: { x: 12, w: 3.2, h: 3.6 }, hours: [7, 20] });
		box(F, mats.concrete, 26, 2, 196, 0, 14, 0);
		box(F, mats.stone, 11, 50, 11, -6, 0, 0);
		box(F, mats.stone, 9, 10, 9, -6, 50, 0);
		cyl(F, mats.stone, 4, 3.5, 8, -6, 60, 0, 8);
		cone(F, mats.stone, 3.2, 7, -6, 68, 0, 8);
		cyl(F, mats.gold, 0.25, 0.1, 4, -6, 75, 0, 6);
	}
	{ // City Hall: Beaux-Arts block, drum and a dome higher than the Capitol's, gold lantern
		// (inside: the rotunda and its grand stair, the gallery round it; in from the plaza, east)
		const F = at(37.7793, -122.4193, 0), S = sub(F, 0, 0, -Math.PI / 2);
		hollow(S, mats.granite, 92, 26, 124, { inside: true, doors: { 'z+': [[0, 3.2, 4.5]] }, use: 'civic' });
		site('sf-city-hall', S, 92, 124, sfCityHall, { door: { x: 0, w: 3.2, h: 4.5 }, hours: [8, 20] });
		box(F, mats.granite, 60, 6, 40, 0, 26, 0);
		cyl(F, mats.granite, 20, 19, 22, 0, 32, 0, 24);
		dome(F, mats.copper, 19, 0, 54, 0, 1.25);
		cyl(F, mats.granite, 4, 3.5, 8, 0, 77, 0, 12);
		dome(F, mats.gold, 3.8, 0, 85, 0, 1.4);
		cyl(F, mats.gold, 0.4, 0.1, 5, 0, 89, 0, 6);
	}
	{ // Palace of Fine Arts: the rotunda among its colonnades
		const F = at(37.8029, -122.4484, 30);
		for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(F, mats.salmon, 5, 32, 5, Math.cos(a) * 17, 0, Math.sin(a) * 17, -a); }
		cyl(F, mats.salmon, 18, 18, 6, 0, 32, 0, 24);
		dome(F, mats.salmon, 17.5, 0, 38, 0, 0.62);
		for (let i = -12; i <= 12; i++) { const a = i / 12 * 1.2; cyl(F, mats.salmon, 1.4, 1.4, 16, Math.sin(a) * 90, 0, 40 - Math.cos(a) * 90 + 60, 8); }
		// the exhibition hall beside it, its long front toward the rotunda: one great open floor
		const Hf = sub(F, 55, -42, -Math.PI / 2), Wp = 105 - 0.6;
		hollow(Hf, mats.salmon, 105, 15.4, 36, { inside: true, doors: { 'z+': [[0, 4, 4], [-Wp / 3, 4, 4], [Wp / 3, 4, 4]] }, use: 'museum' });
		site('palace-hall', Hf, 105, 36, palaceHall, { door: { x: 0, w: 4, h: 4 } });
		box(F, mats.salmon, 106, 1.2, 37, 55, 15.4, -42, Math.PI / 2);
	}
	const ALC = alcatraz();
	{ // Fort Point, under the bridge's south end: four storeys of brick casemates
		// (inside, the casemates round the parade ground, open to the sky: interiors/landmarks.js;
		// in at the sally port on the land side, the front here, its door lined up with a bay's arch)
		const F = at(37.8106, -122.4771, 60), S = sub(F, 0, 0, -Math.PI / 2), cx = (45 - 0.6) / 2 - 11, cz = (70 - 0.6) / 2 - 11;
		const port = -cx + cx / Math.max(2, Math.round(2 * cx / 9));
		hollow(S, mats.brick, 45, 18, 70, { inside: true, doors: { 'z+': [[port, 2.6, 3.2]] }, roofHole: [-cx, -cz, cx, cz], use: 'museum' });
		site('fort-point', S, 45, 70, fortPoint, { door: { x: port, w: 2.6, h: 3.2 } });
		// the little light on the barbette
		cyl(F, mats.white, 1.2, 1.0, 6, 28, 18, 16, 8); cyl(F, mats.dark, 1.0, 1.0, 1.6, 28, 24, 16, 8);
	}
	{ // Oracle Park: a brick bowl open to McCovey Cove, a green field
		// (the stands rise from the field's edge; in through the gates in the brick and the
		// passages through the stands, out onto the field or up the tiers)
		const F = at(37.7786, -122.3893, 45);
		stadiumUse = 'stadium';
		bowl(F, mats.concrete, { rx: 95, rz: 95, a0: -0.3, a1: -0.3 + Math.PI * 1.35, n: 30, tiers: 20, concourse: 5, wallH: 22, wallMat: mats.redbrick });
		stadiumUse = null;
		put(F, mats.green, new THREE.CylinderGeometry(95, 95, 0.6, 32).translate(0, 0.3, 0));
	}
	{ // Chase Center: a rounded silver arena on the bay
		// (in at its four doors to the concourse round the bowl, the court down in the middle)
		const F = at(37.7680, -122.3877);
		arena(F, 24, (gaps) => {
			drum(F, mats.silverIn, 78, 72, 32, { seg: 48, gaps, gh: 4 });
			ringWall(F, 0, 0, 76.6, 78.3, 0, 32, gaps);
			dome(F, mats.silverIn, 72, 0, 32, 0, 0.08);
			for (const [a] of gaps) entranceL(F, Math.sin(a + 0.03) * 78, Math.cos(a + 0.03) * 78, Math.sin(a + 0.03), Math.cos(a + 0.03), 'arena');
		}, { rx: 20, rz: 13, tiers: 34, court: [32, 19, mats.court], r: 78, roof: 30 });
	}
	// the tallest towers, by height
	for (const [lat, lon, h, w, mat] of [[37.7920, -122.4035, 237, 42, mats.dark], [37.7897, -122.3955, 245, 34, mats.glass], [37.7905, -122.3960, 197, 36, mats.glass], [37.7862, -122.3923, 188, 30, mats.glass], [37.7899, -122.4007, 212, 40, mats.granite], [37.7941, -122.3989, 184, 36, mats.dark]]) {
		const F = at(lat, lon, 0);
		tag = { soft: true };
		box(F, mat, w, h, w * 0.8); box(F, mat, w * 0.7, 8, w * 0.55, 0, h, 0);
		tag = null;
	}
	{ // the Embarcadero's finger piers north of the Ferry Building
		for (let k = 0; k < 14; k++) {
			const lat = 37.7975 + k * 0.00115, lon = -122.3945 - k * 0.00125;
			const F = at(lat, lon, 60, 0.5);
			box(F, mats.concrete, 34, 3, 190, 0, 0, 100);
			box(F, mats.stone, 28, 9, 170, 0, 3, 100);
		}
	}
	{ // the windmills at the west end of Golden Gate Park
		for (const [lat, lon] of [[37.7705, -122.5087], [37.7658, -122.5087]]) {
			// (its ground floor a room, the door toward the sea; above, the mill's works, shut)
			const F = at(lat, lon, 90), gaps = [[-0.16, 0.16]];
			drum(F, mats.whiteIn, 7, 4.5, 22, { seg: 16, gaps, gh: 2.6 });
			ringWall(F, 0, 0, 6.3, 7.2, 0, 22, gaps);
			put(F, mats.wood, new THREE.CylinderGeometry(6.6, 6.6, 0.3, 16).translate(0, 4.15, 0));
			entranceL(F, 0, 7, 0, 1, 'windmill');
			const [wx, wz] = toW(F, 0, 0);
			prop(wx, wz, 7, () => {
				cyl(F, mats.ruin, 1.1, 1.1, 0.5, -2.5, 0, -2.5, 16); cyl(F, mats.ruin, 1.1, 1.1, 0.35, -2.5, 0.5, -2.5, 16);
				cyl(F, mats.wood, 0.25, 0.25, 4, 0, 0, 0, 8);
				for (let i = 0; i < 5; i++) box(F, mats.tan, 0.6, 0.5, 0.45, 2.6 - (i % 3) * 0.65, Math.floor(i / 3) * 0.5, -2.8);
				box(F, mats.wood, 2.2, 0.45, 0.5, 3.6, 0, 1.4, -0.6);
			});
			cone(F, mats.wood, 5, 6, 0, 22, 0, 8);
			for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2 + 0.3; const g = new THREE.BoxGeometry(2.2, 17, 0.3).translate(0, 8.5, 0).rotateZ(a); put(F, mats.sail, g, 0, 24, 5); }
		}
	}
	{ // Point Bonita lighthouse, on its knife-edge rock
		const F = at(37.8157, -122.5298);
		lighthouse(F, mats.whiteIn, { rb: 2.5, rt: 2.2, top: 10, T: 0.3, r: 1.5, lh: 2.6, gallery: 0.7 });
	}

	// ---------------- East Bay ----------------
	{ // Oakland City Hall: a wedding-cake tower on a broad base
		const F = at(37.8053, -122.2724, 20);
		hollow(F, mats.granite, 52, 30, 34, { inside: true, doors: { 'z+': [[0, 2.4, 3.2]] }, use: 'civic' });
		site('oakland-city-hall', F, 52, 34, oaklandCityHall, { door: { x: 0, w: 2.4, h: 3.2 } });
		box(F, mats.granite, 30, 45, 22, 0, 30, 0); box(F, mats.granite, 14, 14, 14, 0, 75, 0); cyl(F, mats.granite, 5, 3, 9, 0, 89, 0, 8);
	}
	{ // the Tribune Tower: red-brick campanile with its copper crown
		const F = at(37.8043, -122.2708, 20);
		hollow(F, mats.redbrick, 15, 9.4, 15, { inside: true, doors: { 'z+': [[0, 1.8, 2.8]] }, use: 'office' });
		site('tribune-tower', F, 15, 15, towerLobby, { door: { x: 0, w: 1.8, h: 2.8 } });
		box(F, mats.redbrick, 15, 66.6, 15, 0, 9.4, 0); box(F, mats.redbrick, 12, 8, 12, 0, 76, 0); cone(F, mats.copper, 8, 10, 0, 84, 0, 4);
	}
	{ // the Oakland Temple on its hill: white granite and five spires
		const F = at(37.8078, -122.1978, 0);
		box(F, mats.white, 60, 18, 60);
		for (const [x, z, h] of [[0, 0, 52], [-20, -20, 38], [20, -20, 38], [-20, 20, 38], [20, 20, 38]]) { box(F, mats.white, 8, h - 10, 8, x, 0, z); cone(F, mats.gold, 5, 10, x, h - 10, z, 4); }
	}
	{ // Port of Oakland: rows of container cranes along the outer and middle harbours
		const rows = [[[37.8105, -122.3300], [37.8010, -122.3205]], [[37.7975, -122.3190], [37.7940, -122.3025]]];
		for (const [a, b] of rows) for (let k = 0; k <= 11; k++) {
			const u = k / 11, lat = a[0] + (b[0] - a[0]) * u, lon = a[1] + (b[1] - a[1]) * u;
			const hd = Math.atan2((b[1] - a[1]) * 88000, (b[0] - a[0]) * 111000) * 180 / Math.PI;
			const F = at(lat, lon, hd + 90, 2);
			for (const [x, z] of [[-14, -9], [14, -9], [-14, 9], [14, 9]]) box(F, mats.craneWhite, 2.2, 48, 2.2, x, 0, z);
			box(F, mats.craneRed, 32, 5, 24, 0, 46, 0);
			box(F, mats.craneWhite, 5, 4, 120, 0, 51, 40);
			box(F, mats.craneRed, 3, 32, 3, 0, 50, -6);
			for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.6, 0.6, 70).rotateX(-0.42 * s).translate(0, 67, s > 0 ? 30 : -22); put(F, mats.craneWhite, g); }
		}
		// stacks of containers on the terminals
		const cols = [mats.craneRed, mats.steel, mats.copper, mats.tan, mats.dark, mats.craneWhite];
		for (let k = 0; k < 160; k++) {
			const u = (k * 0.618) % 1, v = (k * 0.382) % 1;
			const F = at(37.8040 - u * 0.008 - v * 0.004, -122.3180 + u * 0.004 - v * 0.012, 45, 3);
			box(F, cols[k % cols.length], 2.5, 2.6 * (1 + (k % 4)), 12);
		}
	}
	{ // Sather Tower, the Campanile, over the campus
		// (in at its foot, the lift up to the bells and the arches open over the campus)
		const F = at(37.8721, -122.2578, 0);
		belfry(F, mats.granite, { W: 11, deck: 62, open0: 62.6, open1: 69.5, H: 78 });
		tag = { walk: true }; box(F, mats.granite, 13, 2, 13, 0, 60, 0); tag = null;
		bells(F, 62, 3);
		cone(F, mats.copper, 8.2, 16, 0, 78, 0, 4);
	}
	{ // Memorial Stadium in Strawberry Canyon
		const F = at(37.8712, -122.2508, 0);
		stadiumUse = 'stadium';
		bowl(F, mats.concrete, { rx: 72, rz: 97, n: 26, tiers: 24, concourse: 5, wallH: 18, gate: 6 });
		stadiumUse = null;
		put(F, mats.green, new THREE.CylinderGeometry(70, 70, 0.6, 24).scale(1, 1, 1.35).translate(0, 0.3, 0));
	}
	// (Mount Diablo's summit building and beacon: bay/diablo.js, on the mapped footprints)

	// ---------------- Peninsula and South Bay ----------------
	{ // Hoover Tower at Stanford
		const F = at(37.4275, -122.1668, 0);
		belfry(F, mats.tan, { W: 14, W2: 11, deck: 70, open0: 70.8, open1: 76.4, H: 78 });
		bells(F, 70, 2.6);
		dome(F, mats.salmon, 6, 0, 78, 0, 1.3);
	}
	{ // Hangar One at Moffett Field: an airship hangar 345 m long
		// (one vast open hall inside: in at the doors in its long sides)
		const F = at(37.4155, -122.0496, 330);
		put(F, mats.silverIn, new THREE.CylinderGeometry(1, 1, 345, 28, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(47, 60, 1));
		hollow(F, mats.silver, 94, 6, 345, { T: 0.6, roof: false, doors: { 'x+': [[0, 12, 5.4], [-110, 6, 4.5]], 'x-': [[0, 12, 5.4], [110, 6, 4.5]] }, use: 'museum' });
		put(F, mats.concrete, new THREE.BoxGeometry(93, 0.08, 344).translate(0, 0.04, 0));
		const [hx, hz] = toW(F, 0, 0);
		prop(hx, hz, 175, () => {
			// an airship moored in it, as there was; the lamps high up along the hall
			put(F, mats.sail, new THREE.SphereGeometry(1, 24, 12).scale(11, 11, 48).translate(0, 22, 30));
			for (const sx of [-1, 1]) put(F, mats.sail, new THREE.BoxGeometry(0.3, 7, 6).translate(sx * 7, 22, 74).rotateZ(sx * 0.6));
			put(F, mats.dark, new THREE.BoxGeometry(2.6, 2.2, 9).translate(0, 10.6, 26));
			ghost++; for (let z = -160; z <= 160; z += 20) for (const x of [-20, 20]) box(F, mats.glow, 2.4, 0.3, 0.8, x, 44, z); ghost--;
		});
	}
	{ // Levi's Stadium: a bowl with the tall suite tower on its west side
		const F = at(37.4033, -121.9694, 0);
		stadiumUse = 'stadium';
		bowl(F, mats.concrete, { rx: 82, rz: 114, n: 28, tiers: 28, concourse: 6, wallH: 26, gate: 6, skip: (x) => x < -95 });
		stadiumUse = null;
		box(F, mats.glass, 30, 62, 230, -120, 0, 0);
		put(F, mats.green, new THREE.CylinderGeometry(80, 80, 0.6, 24).scale(1, 1, 1.4).translate(0, 0.3, 0));
	}
	{ // the SAP Center in San Jose
		// (in through the glass hall at its front, or the doors on its sides, to the concourse round
		// the bowl, the rink down in the middle)
		const F = at(37.3327, -121.9010, 0), door = [[0, 6, 4]];
		hollow(F, mats.silver, 150, 34, 125, { doors: { 'z+': door, 'z-': door, 'x+': door, 'x-': door }, use: 'arena' });
		hollow(sub(F, 0, 66.25), mats.glass, 60, 30, 7.5, { open: ['z-'], doors: { 'z+': [[0, 6, 4], [-20, 4, 3], [20, 4, 3]] }, use: 'arena' });
		arena(F, 24, null, { rx: 32, rz: 16, tiers: 30, court: [60, 26, mats.ice], r: 75, roof: 32 });
	}
	{ // Lick Observatory on Mount Hamilton: white domes on the summit
		for (const [lat, lon, r] of [[37.3414, -121.6429, 12], [37.3420, -121.6435, 8], [37.3406, -121.6420, 7]]) {
			const F = at(lat, lon, 0);
			if (r < 12) { cyl(F, mats.white, r, r, r * 0.8, 0, 0, 0, 20); dome(F, mats.white, r, 0, r * 0.8, 0, 1); continue; }
			// the great dome: in at its door to the refractor on its pier
			const gaps = [[-0.08, 0.08]];
			drum(F, mats.whiteIn, r, r, r * 0.8, { seg: 40, gaps, gh: 2.6 });
			ringWall(F, 0, 0, r - 0.4, r + 0.1, 0, r * 0.8, gaps);
			dome(F, mats.whiteIn, r, 0, r * 0.8, 0, 1);
			entranceL(F, 0, r, 0, 1, 'observatory');
			tag = { walk: true }; cyl(F, mats.wood, r - 0.05, r - 0.05, 0.2, 0, 0, 0, 40); tag = null;
			const [ox, oz] = toW(F, 0, 0);
			prop(ox, oz, r, () => {
				cyl(F, mats.dark, 1.3, 1.0, 4.6, 0, 0.2, -1, 12);
				put(F, mats.white, new THREE.CylinderGeometry(0.5, 0.62, 17, 16).rotateX(0.85).translate(0, 7.4, 1.2));
				put(F, mats.dark, new THREE.BoxGeometry(1.4, 1.4, 1.6).translate(0, 4.9, -1));
				put(F, mats.dark, new THREE.CylinderGeometry(0.7, 0.7, 1.8, 12).rotateX(0.85).translate(0, 3.6, -3.5));
				box(F, mats.wood, 2.4, 0.9, 0.8, 6.5, 0.2, 5, -0.6); box(F, mats.steel, 0.5, 2.4, 0.5, -5.5, 0.2, 4);
				for (let k = 0; k < 6; k++) box(F, mats.wood, 1.2, 0.3 + k * 0.3, 0.5, -4.2, 0.2, 2.4 - k * 0.5);
			});
		}
	}

	// ---------------- San Ramon ----------------
	{ // City Center Bishop Ranch: low pavilions round a plaza under a floating canopy
		// (each pavilion a row of shops and places to eat, their doors on the plaza)
		const F = at(37.7672, -121.9600, 70), KINDS = ['restaurant', 'cafe', 'boutique', 'books', 'gift', 'bar', 'candy', 'grocer', 'boutique', 'restaurant', 'cafe', 'bar', 'hardware'];
		let q = 0;
		for (const [x, z, w, d, h] of [[-60, -40, 50, 34, 12], [0, -55, 60, 30, 14], [60, -40, 50, 34, 12], [-65, 40, 45, 40, 10], [65, 40, 45, 40, 10], [0, 60, 80, 30, 16]]) {
			const P = sub(F, x, z, z > 0 ? Math.PI : 0), n = Math.max(2, Math.round(w / 12)), Wp = w - 0.6, kinds = [];
			for (let i = 0; i < n; i++) kinds.push(KINDS[q++ % KINDS.length]);
			const us = kinds.map((k, i) => -Wp / 2 + (i + 0.5) * Wp / n);
			hollow(P, mats.glass, w, h, d, { inside: true, doors: { 'z+': us.map((u) => [u, 1.8, 2.6]) }, use: 'shop' });
			site('bishop-ranch-' + q, P, w, d, shopRow(kinds), { door: { x: us[0], w: 1.8 }, hours: [9, 21] });
			box(F, mats.white, w + 4, 1.2, d + 4, x, h, z);
		}
		put(F, mats.pavement, new THREE.BoxGeometry(110, 0.3, 70).translate(0, 0.2, 0));
		// the canopy on slender columns
		box(F, mats.white, 150, 1.4, 60, 0, 17, 0);
		for (let i = -3; i <= 3; i++) for (const z of [-24, 24]) cyl(F, mats.steel, 0.4, 0.4, 17, i * 22, 0, z, 6);
	}
	{ // San Ramon City Hall and the library, facing Central Park
		const F = at(37.7657, -121.9552, 70);
		hollow(F, mats.tan, 70, 11, 30, { inside: true, doors: { 'z+': [[0, 2.4, 3]] }, use: 'civic' });
		site('san-ramon-city-hall', F, 70, 30, cityHall, { door: { x: 0, w: 2.4, h: 3 } });
		hollow(sub(F, 0, 18), mats.glass, 30, 13, 6, { open: ['z-'], doors: { 'z+': [[0, 3, 3]] } });
		const L = at(37.7648, -121.9522, 40);
		hollow(L, mats.tan, 45, 8, 35, { inside: true, doors: { 'z+': [[0, 2.4, 3]] }, use: 'library' });
		site('san-ramon-library', L, 45, 35, library, { door: { x: 0, w: 2.4, h: 3 }, hours: [10, 20] });
	}

	// ---------------- Cupertino: Apple Park ----------------
	{ // the ring: four storeys of curved glass under white canopies at every floor, the solar
		// roof, and the orchard and meadow inside (the mapped footprint is left out for this)
		const F = at(37.33478, -122.00899, 0), R0 = 182, R1 = 231, H = 21, seg = 160;
		const ring = (mat, r, h, y) => put(F, mat, new THREE.CylinderGeometry(r, r, h, seg, 1, true).translate(0, y + h / 2, 0));
		// (in at the doors on its east side, through it to the courtyard; just inside, a stretch of
		// the ground floor's open office between two of its cross walls)
		const te = -Math.PI / 2, go = [[te - 0.012, te + 0.012]], gi = [[te - 0.015, te + 0.015]];
		drum(F, mats.glassIn, R1, R1, H - 1, { seg, gaps: go, gh: 3 });
		drum(F, mats.glassIn, R0, R0, H - 1, { seg, gaps: gi, gh: 3 });
		ringWall(F, 0, 0, R1 - 0.15, R1 + 0.15, 0, H, go); ringWall(F, 0, 0, R0 - 0.15, R0 + 0.15, 0, H, gi);
		entranceL(F, Math.sin(te) * R1, Math.cos(te) * R1, Math.sin(te), Math.cos(te), 'office');
		{
			const span = 0.14, Rm = (R0 + R1) / 2, [ex, ez] = toW(F, Math.sin(te) * Rm, Math.cos(te) * Rm);
			prop(ex, ez, 40, () => {
				put(F, mats.white, sector(R0, R1, te - span, te + span, 4.6, true, 32));
				put(F, mats.stone, sector(R0, R1, te - span, te + span, 0.05, false, 32));
				for (const sg of [-1, 1]) { const a = te + sg * span; box(F, mats.white, 0.3, 4.6, R1 - R0, Math.sin(a) * Rm, 0, Math.cos(a) * Rm, a); }
				for (let r = R0 + 5; r < R1 - 4; r += 3.4) for (let a = te - span + 3 / r; a < te + span - 2 / r; a += 2.3 / r) {
					if (Math.abs(a - te) * r < 3.5 || Math.abs(r - Rm) < 2.5) continue;
					const D = sub(F, Math.sin(a) * r, Math.cos(a) * r, a);
					box(D, mats.white, 1.6, 0.75, 0.8); box(D, mats.dark, 0.5, 0.48, 0.5, 0, 0, -0.75);
					ghost++; box(D, mats.dark, 0.6, 0.38, 0.04, 0, 0.78, 0.25); box(D, mats.dark, 0.5, 0.5, 0.06, 0, 0.48, -1.0); ghost--;
				}
				ghost++;
				for (let r = R0 + 4; r < R1 - 3; r += 6) for (let a = te - span + 0.01; a < te + span; a += 5 / r) box(F, mats.glow, 1.2, 0.05, 0.3, Math.sin(a) * r, 4.5, Math.cos(a) * r, a);
				ghost--;
			});
		}
		for (let k = 1; k <= 4; k++) {
			const y = k * 4.8;
			put(F, mats.white, new THREE.RingGeometry(R1 - 0.2, R1 + 2.6, seg).rotateX(-Math.PI / 2).translate(0, y, 0));
			put(F, mats.white, new THREE.RingGeometry(R0 - 2.6, R0 + 0.2, seg).rotateX(-Math.PI / 2).translate(0, y, 0));
		}
		// the roof: dark solar panels, a white edge
		put(F, mats.dark, new THREE.RingGeometry(R0 - 3, R1 + 3, seg).rotateX(-Math.PI / 2).translate(0, H, 0));
		ring(mats.white, R1 + 3, 0.8, H - 0.4); ring(mats.white, R0 - 3, 0.8, H - 0.4);
		// the courtyard: a meadow, a pond, and groves of fruit trees
		put(F, mats.green, new THREE.CircleGeometry(R0 - 3, 96).rotateX(-Math.PI / 2).translate(0, 0.25, 0));
		put(F, mats.glass, new THREE.CircleGeometry(24, 40).rotateX(-Math.PI / 2).scale(1.6, 1, 1).translate(-40, 0.32, 30));
		for (let i = 0; i < 260; i++) {
			const a = i * 2.39996, r = 30 + Math.sqrt(i / 260) * (R0 - 45), x = Math.cos(a) * r, z = Math.sin(a) * r;
			if (Math.hypot(x + 40, z - 30) < 45) continue;
			cyl(F, mats.wood, 0.18, 0.14, 1.6, x, 0, z, 5);
			put(F, mats.green, new THREE.IcosahedronGeometry(2.1 + (i % 5) * 0.25, 0).scale(1, 0.8, 1).translate(x, 3.1, z));
		}
		// a trees on the outside berm, all round
		for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2 + (i % 3) * 0.01, r = R1 + 25 + (i % 4) * 11; put(F, mats.green, new THREE.IcosahedronGeometry(4 + (i % 3), 0).scale(1, 1.3, 1).translate(Math.cos(a) * r, 6, Math.sin(a) * r)); cyl(F, mats.wood, 0.3, 0.25, 3, Math.cos(a) * r, 0, Math.sin(a) * r, 5); }
	}
	{ // the Steve Jobs Theater: a glass drum under a thin white carbon-fibre roof, on its hill
		// (its lobby inside the glass: the two stairs curving down to the hall below, lined in wood)
		const F = at(37.33065, -122.00715, 0), gaps = [[-0.1, 0.1], [Math.PI - 0.1, Math.PI + 0.1]];
		drum(F, mats.glassIn, 20.5, 20.5, 6.6, { seg: 64, gaps, gh: 3, y: 0.4 });
		ringWall(F, 0, 0, 20.35, 20.65, 0.4, 7, gaps);
		for (const [a] of gaps) entranceL(F, Math.sin(a + 0.1) * 20.5, Math.cos(a + 0.1) * 20.5, Math.sin(a + 0.1), Math.cos(a + 0.1), 'theater', 0.4);
		put(F, mats.white, new THREE.CylinderGeometry(23, 23, 0.7, 64).translate(0, 7, 0));
		tag = { walk: true }; cyl(F, mats.pavement, 27, 28, 0.4, 0, 0, 0, 48); tag = null;
		const [tx, tz] = toW(F, 0, 0);
		prop(tx, tz, 21, () => {
			for (const sx of [-1, 1]) {
				const x = sx * 8;
				box(F, mats.wood, 0.3, 1.1, 9, x - 2.3, 0.4, 0); box(F, mats.wood, 0.3, 1.1, 9, x + 2.3, 0.4, 0); box(F, mats.wood, 4.9, 1.1, 0.3, x, 0.4, -4.5);
				ghost++;
				put(F, mats.dark, new THREE.BoxGeometry(4.3, 0.02, 8.6).translate(x, 0.42, 0.2));
				for (let k = 0; k < 6; k++) box(F, mats.wood, 4.3, 0.04, 0.5, x, 0.38 - k * 0.2 + 0.02, 4 - k * 0.6);
				ghost--;
			}
			for (const [x, z] of [[0, 9], [0, -9], [-14, 6], [14, -6]]) box(F, mats.wood, 3, 0.45, 0.6, x, 0.4, z);
		});
	}
	{ // the Visitor Center: glass walls, a floating white roof, olive trees on the terrace
		const F = at(37.3325, -122.0053, 90);
		hollow(F, mats.glass, 44, 9, 100, { inside: true, doors: { 'z+': [[0, 3, 3]] }, use: 'shop', roofMat: mats.white });
		site('apple-park-visitor', F, 44, 100, visitorCentre, { door: { x: 0, w: 3, h: 3 }, hours: [9, 19] });
		box(F, mats.white, 54, 0.8, 110, 0, 9, 0);
		for (let i = 0; i < 12; i++) put(F, mats.green, new THREE.IcosahedronGeometry(2.3, 0).translate(-30 + (i % 2) * 60, 3, -48 + Math.floor(i / 2) * 19));
	}

	// ---------------- Fort Baker: the Bay Area Discovery Museum ----------------
	// (Lookout Cove and the museum itself: bay/discovery.js)
	// the fishing piers you can walk out on: Fort Baker's in Horseshoe Bay under the bridge,
	// Pacifica's long concrete pier into the surf (no licence needed on a public pier), and
	// Torpedo Wharf off Crissy Field
	const pier = (a, b, deck, width) => {
		const A = toWorld(a[0], a[1]), B = toWorld(b[0], b[1]);
		const L = Math.hypot(B.x - A.x, B.z - A.z), ang = Math.atan2(B.x - A.x, B.z - A.z), hw = width / 2;
		const g = new THREE.BoxGeometry(width, 0.5, L).translate(0, deck - 0.25, L / 2).rotateY(ang).translate(A.x, 0, A.z);
		add(mats.concrete, g.toNonIndexed());
		for (let k = 0; k <= Math.floor(L / 8); k++) {
			const t = k * 8;
			for (const s2 of [-hw + 0.4, hw - 0.4]) {
				const pg = new THREE.CylinderGeometry(0.3, 0.3, deck + 8, 8).translate(s2, (deck - 8) / 2 - 0.5, t).rotateY(ang).translate(A.x, 0, A.z); add(mats.concrete, pg.toNonIndexed());
				const rg = new THREE.BoxGeometry(0.1, 1.07, 8).translate(Math.sign(s2) * (hw - 0.05), deck + 0.53, t + 4).rotateY(ang).translate(A.x, 0, A.z); add(mats.steel, rg.toNonIndexed());
			}
			// lamps every 20 m, a bench every 30
			if (k % 3 === 0) { const lg = new THREE.CylinderGeometry(0.06, 0.08, 4, 6).translate(hw - 0.3, deck + 2, t).rotateY(ang).translate(A.x, 0, A.z); add(mats.dark, lg.toNonIndexed()); }
			if (k % 4 === 2) { const bg = new THREE.BoxGeometry(0.45, 0.45, 1.8).translate(-hw + 1.2, deck + 0.22, t).rotateY(ang).translate(A.x, 0, A.z); add(mats.wood, bg.toNonIndexed()); }
		}
		PIERS.push({ ax: A.x, az: A.z, bx: B.x, bz: B.z, y: deck, hw });
	};
	pier([37.83285, -122.47535], [37.83175, -122.47515], 3.25, 4.2);        // Fort Baker
	pier([37.63340, -122.49400], [37.63240, -122.49810], 5.5, 4.5);         // Pacifica Pier (347 m)
	pier([37.81030, -122.47150], [37.81170, -122.47170], 3.5, 5);           // Torpedo Wharf

	// ---------------- the other bridges ----------------
	const bridge = (a, b, deck, span, hump = null, pierMat = mats.concrete, deckMat = mats.concrete, towers = null) => {
		const A = toWorld(a[0], a[1]), B = toWorld(b[0], b[1]), L = Math.hypot(B.x - A.x, B.z - A.z), n = Math.ceil(L / span);
		const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L, ang = Math.atan2(dx, dz);
		const y = (u) => { let h = deck; if (hump) for (const [u0, u1, top] of hump) if (u > u0 && u < u1) { const t = (u - u0) / (u1 - u0); h = deck + (top - deck) * Math.sin(t * Math.PI); } return h; };
		for (let k = 0; k < n; k++) {
			const u0 = k / n, u1 = (k + 1) / n, y0 = y(u0), y1 = y(u1);
			const g = new THREE.BoxGeometry(22, 2.4, L / n + 0.5);
			g.rotateX(-Math.atan2(y1 - y0, L / n));
			g.rotateY(ang); g.translate(A.x + dx * L * (u0 + u1) / 2, (y0 + y1) / 2, A.z + dz * L * (u0 + u1) / 2);
			add(deckMat, g.toNonIndexed());
			const px = A.x + dx * L * u0, pz = A.z + dz * L * u0, gnd = Math.min(0, bay.heightAt(px, pz)) - 2;
			const pg = new THREE.BoxGeometry(6, y0 - gnd, 4).translate(0, (y0 + gnd) / 2, 0); pg.rotateY(ang); pg.translate(px, 0, pz);
			add(pierMat, pg.toNonIndexed());
		}
		if (towers) for (const [u, h] of towers) for (const s of [-1, 1]) {
			const tx = A.x + dx * L * u + dz * 12 * s, tz = A.z + dz * L * u - dx * 12 * s;
			const g = new THREE.BoxGeometry(4, h, 4).translate(tx, h / 2, tz); add(towers.mat || mats.steel, g.toNonIndexed());
		}
	};
	bridge([37.9360, -122.4745], [37.9368, -122.4060], 22, 90, [[0.08, 0.2, 56], [0.62, 0.8, 56]], mats.concrete, mats.steel);        // Richmond-San Rafael
	bridge([37.5832, -122.2583], [37.6180, -122.1470], 11, 60, [[0.12, 0.34, 42]]);                                                  // San Mateo
	bridge([37.4897, -122.1240], [37.5110, -122.0790], 10, 60, [[0.38, 0.62, 28]]);                                                  // Dumbarton
	bridge([38.0540, -122.2280], [38.0680, -122.2250], 45, 80, null, mats.concrete, mats.craneWhite, Object.assign([[0.22, 125], [0.78, 125]], { mat: mats.craneWhite }));   // Carquinez (Al Zampa)
	bridge([38.0330, -122.1260], [38.0520, -122.1230], 40, 100);                                                                      // Benicia-Martinez

	for (const [mat, list] of parts) {
		const m = new THREE.Mesh(mergeGeometries(list), mat);
		m.castShadow = true; m.receiveShadow = true;
		group.add(m);
	}
	// ---------- you among them ----------
	const near = (x, z) => cells.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || [];
	function push(p, footY) {
		const lo = footY + 0.55, hi = footY + 1.7, R = 0.3;
		for (const s of near(p.x, p.z)) {
			if (s.y1 <= lo || s.y0 > hi || s.walk || (s.on && !s.on())) continue;
			if (s.soft && (s.gone || (s.gone = !!yieldTo?.(s.x, s.z)))) continue;
			if (s.ring) { ringPush(p, s); continue; }
			if (s.r !== undefined) {
				const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
				if (d < s.r + R && d > 1e-6) { p.x = s.x + dx / d * (s.r + R); p.z = s.z + dz / d * (s.r + R); }
				continue;
			}
			const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), dx = p.x - s.x, dz = p.z - s.z;
			let lx = c * dx - sn * dz, lz = sn * dx + c * dz;
			if (Math.abs(lx) > s.hw + R || Math.abs(lz) > s.hd + R) continue;
			const qx = Math.max(-s.hw, Math.min(s.hw, lx)), qz = Math.max(-s.hd, Math.min(s.hd, lz)), ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
			if (d >= R) continue;
			if (d > 1e-6) { lx = qx + ex / d * R; lz = qz + ez / d * R; } else if (s.hw - Math.abs(lx) < s.hd - Math.abs(lz)) lx = Math.sign(lx || 1) * (s.hw + R); else lz = Math.sign(lz || 1) * (s.hd + R);
			p.x = s.x + c * lx + sn * lz; p.z = s.z - sn * lx + c * lz;
		}
	}
	// a ring of wall (the curved glass of the ring building, an arena's drum): kept out of its
	// band but where it is open
	function ringPush(p, s) {
		const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
		if (d < s.r0 - 0.3 || d > s.r1 + 0.3) return;
		const a = Math.atan2(dz, dx);
		if (s.gaps.some(([a0, a1]) => ((a - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) < ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI))) return;
		const r = d - s.r0 < s.r1 - d ? s.r0 - 0.3 : s.r1 + 0.3;
		p.x = s.x + dx / d * r; p.z = s.z + dz / d * r;
	}
	// the tops of the blocks you can step up on
	function stepAt(x, z, y) {
		let best = -1e9;
		for (const s of near(x, z)) {
			if (s.ring || s.on || s.y1 > y + 0.55 || s.y1 < y - 1.5 || s.y1 <= best) continue;
			if (s.r !== undefined) { if (Math.hypot(x - s.x, z - s.z) < s.r) best = s.y1; continue; }
			const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), dx = x - s.x, dz = z - s.z;
			if (Math.abs(c * dx - sn * dz) < s.hw && Math.abs(sn * dx + c * dz) < s.hd) best = s.y1;
		}
		for (const L of lifts) { const [lx, lz] = L.local(x, z); if (Math.abs(lx) < L.hw && Math.abs(lz) < L.hd && y > L.y - 1.5 && y < L.y + 2.5) best = Math.max(best, L.y); }
		return best;
	}
	// the insides near you drawn, the far ones let go; the lifts run
	let scanT = 0;
	function update(dt, cam) {
		const x = cam.position.x, z = cam.position.z;
		scanT -= dt;
		if (scanT < 0) {
			scanT = 0.7;
			for (const P of props) {
				const d = Math.hypot(P.x - x, P.z - z) - P.r;
				if (!P.group && d < 90) {
					const was = into;
					into = new Map(); ghost += P.once ? 1 : 0;
					try { P.fn(); } finally { ghost -= P.once ? 1 : 0; }
					P.once = true;
					P.group = new THREE.Group();
					for (const [mat, list] of into) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = m.receiveShadow = true; P.group.add(m); }
					into = was;
					group.add(P.group);
				} else if (P.group && d > 160) { group.remove(P.group); P.group.traverse((o) => o.geometry?.dispose()); P.group = null; }
			}
		}
		for (const L of lifts) {
			const [lx, lz] = L.local(x, z), on = Math.abs(lx) < L.hw && Math.abs(lz) < L.hd && Math.abs(cam.position.y - 1.7 - L.y) < 0.8;
			// (stand in it a moment and it goes; it waits at the other end until you step out and in again)
			L.dwell = on && !L.moving ? L.dwell + dt : 0;
			if (!on) L.armed = true;
			if (L.dwell > 1.2 && L.armed) { L.moving = true; L.armed = false; L.to = L.y < (L.y0 + L.y1) / 2 ? L.y1 : L.y0; }
			if (L.moving) { const st = Math.sign(L.to - L.y) * Math.min(Math.abs(L.to - L.y), dt * 3); L.y += st; if (Math.abs(L.to - L.y) < 1e-3) L.moving = false; }
			L.car.position.y = L.y - L.g0;
		}
	}
	const doorsNear = (x, z, r = 40) => entrances.filter((E) => Math.hypot(E.x - x, E.z - z) < r);

	// standing on a pier, or on the Rock (its ground is its own, over the terrain's)
	function floor(x, z, y) {
		for (const P of PIERS) {
			const dx = P.bx - P.ax, dz = P.bz - P.az, l2 = dx * dx + dz * dz, t = ((x - P.ax) * dx + (z - P.az) * dz) / l2;
			if (t < 0 || t > 1) continue;
			if (Math.abs((x - P.ax) * dz - (z - P.az) * dx) / Math.sqrt(l2) < P.hw && y > P.y - 1.5) return P.y;
		}
		const h = ALC.hAt(x - ALC.O.x, z - ALC.O.z), st = stepAt(x, z, y);
		if (h === h && h > 0 && y > h - 1.5) return Math.max(h, st);
		return st;
	}
	return { group, floor, push, update, doorsNear, sites, yieldTo: (f) => { yieldTo = f; } };
}
