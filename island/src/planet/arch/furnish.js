// The grand interiors built: a volume's shell (its floors, ceilings, glass walls, portals,
// galleries and stairs, from its plan in rooms.js) and its furnishing, a kit of parametric
// pieces set out per kind of room in the floor's own stone, metal and velvet. Everything is
// in the volume's frame (interiors.js puts the meshes there). Repeated pieces are instanced;
// the rest merged into one mesh of the one material (mats.js interiorMaterial), and the
// rooms' light (chandeliers, lamps, light sculptures, glowing plants, pools) baked into each
// vertex (and each instance) rather than cast by real lights.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../noise.js';

const TAU = Math.PI * 2;
// the looks (mats.js)
export const LK = { plaster: 0, stone: 1, terrazzo: 2, brass: 3, lacquer: 4, velvet: 5, light: 6, water: 7, plant: 8, books: 9, stars: 10, leaf: 11 };
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();

// ---------- shapes ----------
const seg = (n) => Math.max(1, Math.min(20, Math.ceil(n / 1.6)));
// a box w by h by d, its middle at (x, y, z), turned yaw (sides divided so the light bakes smoothly)
export function bx(w, h, d, x = 0, y = 0, z = 0, yaw = 0) {
	const g = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
	if (yaw) g.rotateY(yaw);
	return g.translate(x, y, z);
}
const cyl = (r0, r1, h, n, x = 0, y = 0, z = 0) => new THREE.CylinderGeometry(r0, r1, h, n, Math.max(1, Math.ceil(h / 2))).translate(x, y, z);
const sph = (r, x = 0, y = 0, z = 0, n = 12) => new THREE.SphereGeometry(r, n, Math.max(4, n >> 1)).translate(x, y, z);
const tor = (R, t, x = 0, y = 0, z = 0, n = 32) => new THREE.TorusGeometry(R, t, 6, n).rotateX(Math.PI / 2).translate(x, y, z);
// a thin slab along a to b (a run of steps, a rail), w across, t deep
function beam(ax, ay, az, bx2, by, bz, w, t) {
	const dx = bx2 - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
	const g = new THREE.BoxGeometry(w, t, len, 1, 1, seg(len));
	g.applyMatrix4(m4.makeRotationFromEuler(e4.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ')));
	return g.translate((ax + bx2) / 2, (ay + by) / 2, (az + bz) / 2);
}
// colour and look on a shape, for the one material
function tag(g, look, tint) {
	if (g.index) g = g.toNonIndexed();
	for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
	const n = g.attributes.position.count, c = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) c.set(tint, i * 3);
	g.setAttribute('color', new THREE.BufferAttribute(c, 3));
	g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(look), 1));
	return g;
}
const merge = (list) => { const g = mergeGeometries(list); for (const x of list) x.dispose(); return g; };

// ---------- the build ----------
// one volume's worth: merged parts, glass, instances, its lights, its solids and floor cuts
class Build {
	constructor(V, phone) {
		this.V = V; this.th = V.theme; this.phone = phone;
		this.r = mulberry32(V.seed ^ 0x51ab);
		this.parts = []; this.glass = []; this.inst = new Map(); this.lights = []; this.solids = []; this.cuts = []; this.lows = []; this.avoid = [];
	}
	add(g, look, tint) { this.parts.push(tag(g, look, tint)); return this; }
	pane(g) { if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); this.glass.push(g); }
	// an instance of a piece: make() gives its shape (made once per build), set at x, y, z turned yaw
	put(key, make, x, y, z, yaw = 0, s = 1) {
		let I = this.inst.get(key);
		if (!I) { I = { make, at: [] }; this.inst.set(key, I); }
		I.at.push([x, y, z, yaw, s]);
	}
	light(x, y, z, c, k, rad) { this.lights.push({ x, y, z, c, k, rad }); }
	solid(x, z, hw, hd, yaw = 0, y0 = 0, y1 = 3) { this.solids.push({ x, z, hw, hd, yaw, y0, y1 }); this.avoid.push({ x, z, r: Math.hypot(hw, hd) + 0.6 }); }
	free(x, z, r = 1) { return !this.avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r); }
}

// ---------- the pieces ----------
// (each in its own frame: its foot at the origin, its front toward +z)
const P = {
	column(th, h) {
		const r = 0.45;
		return merge([
			tag(cyl(r, r * 1.08, h - 1.0, 16, 0, 0.5 + (h - 1.0) / 2, 0), LK.stone, th.stone),
			tag(bx(1.3, 0.5, 1.3, 0, 0.25, 0), LK.stone, th.stone),
			tag(cyl(r * 1.5, r * 1.05, 0.5, 16, 0, h - 0.25, 0), LK.brass, th.metal),
			tag(tor(r * 1.08, 0.05, 0, 0.6, 0, 16), LK.brass, th.metal),
		]);
	},
	chair(th) {
		return merge([
			tag(bx(0.55, 0.12, 0.55, 0, 0.48, 0), LK.velvet, th.velvet),
			tag(bx(0.55, 0.75, 0.1, 0, 0.9, -0.24), LK.velvet, th.velvet),
			...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => tag(cyl(0.025, 0.02, 0.44, 5, a * 0.24, 0.22, b * 0.24), LK.brass, th.metal)),
		]);
	},
	armchair(th) {
		return merge([
			tag(bx(1.0, 0.42, 0.95, 0, 0.21, 0), LK.velvet, th.velvet),
			tag(bx(1.0, 0.55, 0.22, 0, 0.62, -0.38), LK.velvet, th.velvet),
			tag(bx(0.18, 0.28, 0.95, -0.45, 0.55, 0), LK.velvet, th.velvet),
			tag(bx(0.18, 0.28, 0.95, 0.45, 0.55, 0), LK.velvet, th.velvet),
			tag(bx(1.04, 0.05, 0.99, 0, 0.02, 0), LK.brass, th.metal),
		]);
	},
	sofa(th, w = 3) {
		return merge([
			tag(bx(w, 0.4, 1.0, 0, 0.2, 0), LK.velvet, th.velvet),
			tag(bx(w, 0.5, 0.25, 0, 0.62, -0.38), LK.velvet, th.velvet),
			tag(bx(w + 0.04, 0.04, 1.04, 0, 0.02, 0), LK.brass, th.metal),
		]);
	},
	seat(th) {
		return merge([
			tag(bx(0.6, 0.45, 0.55, 0, 0.22, 0), LK.velvet, th.velvet),
			tag(bx(0.6, 0.7, 0.14, 0, 0.75, -0.24), LK.velvet, th.velvet),
			tag(bx(0.06, 0.6, 0.6, 0.31, 0.3, 0), LK.lacquer, th.lacquer),
		]);
	},
	lamp(th) {
		return merge([
			tag(cyl(0.18, 0.22, 0.05, 12, 0, 0.025, 0), LK.brass, th.metal),
			tag(cyl(0.02, 0.02, 1.6, 6, 0, 0.8, 0), LK.brass, th.metal),
			tag(cyl(0.16, 0.26, 0.35, 12, 0, 1.7, 0), LK.light, th.warm),
		]);
	},
	planter(th, glow) {
		const parts = [tag(bx(1.1, 0.7, 1.1, 0, 0.35, 0), LK.lacquer, th.lacquer), tag(bx(1.14, 0.05, 1.14, 0, 0.72, 0), LK.brass, th.metal)];
		for (let k = 0; k < 7; k++) {
			const a = k / 7 * TAU, l = 0.9 + (k % 3) * 0.3;
			parts.push(tag(beam(0, 0.7, 0, Math.sin(a) * 0.45, 0.7 + l, Math.cos(a) * 0.45, 0.12, 0.03), LK.leaf, [0.05, 0.16, 0.08]));
			parts.push(tag(sph(0.09, Math.sin(a) * 0.48, 0.72 + l, Math.cos(a) * 0.48, 6), LK.plant, glow));
		}
		return merge(parts);
	},
	tree(th, glow, h) {
		const parts = [tag(cyl(0.95, 1.05, 0.8, 16, 0, 0.4, 0), LK.stone, th.stone), tag(cyl(0.16, 0.24, h * 0.6, 8, 0, 0.8 + h * 0.3, 0), LK.lacquer, [0.08, 0.05, 0.04])];
		for (let k = 0; k < 5; k++) {
			const a = k / 5 * TAU, rr = 0.8 + (k % 2) * 0.4;
			parts.push(tag(sph(1.1 + (k % 3) * 0.2, Math.sin(a) * rr, h * 0.82 + (k % 2) * 0.6, Math.cos(a) * rr, 8).scale(1, 0.6, 1), LK.leaf, [0.04, 0.12, 0.07]));
		}
		for (let k = 0; k < 14; k++) {
			const a = k * 2.4, rr = 0.6 + (k % 4) * 0.4, y = h * 0.72 + (k % 5) * 0.35;
			parts.push(tag(sph(0.11, Math.sin(a) * rr, y, Math.cos(a) * rr, 5), LK.plant, glow));
		}
		return merge(parts);
	},
	pedestal(th) {
		return merge([tag(bx(0.9, 1.0, 0.9, 0, 0.5, 0), LK.stone, th.stone), tag(bx(1.0, 0.06, 1.0, 0, 1.03, 0), LK.brass, th.metal)]);
	},
	// abstract sculptures on their pedestals: a stack of rings, an orb on a cone, a twisted
	// column, a split arch, a pierced slab
	sculpture(th, kind) {
		const y = 1.06, M = th.metal, S = th.stone, parts = [];
		if (kind === 0) for (let k = 0; k < 4; k++) parts.push(tag(new THREE.TorusGeometry(0.42 - k * 0.07, 0.06, 8, 24).rotateY(k * 0.7).translate(0, y + 0.5 + k * 0.22, 0), LK.brass, M));
		else if (kind === 1) { parts.push(tag(new THREE.ConeGeometry(0.3, 0.9, 16).translate(0, y + 0.45, 0), LK.lacquer, th.lacquer)); parts.push(tag(sph(0.36, 0, y + 1.2, 0, 16), LK.light, th.glow)); }
		else if (kind === 2) for (let k = 0; k < 7; k++) parts.push(tag(bx(0.42, 0.24, 0.42, 0, y + 0.12 + k * 0.25, 0, k * 0.28), LK.stone, S));
		else if (kind === 3) { parts.push(tag(new THREE.TorusGeometry(0.6, 0.1, 8, 24, Math.PI).translate(0, y, 0), LK.lacquer, th.lacquer)); parts.push(tag(sph(0.14, 0, y + 0.6, 0, 10), LK.brass, M)); }
		else { parts.push(tag(bx(0.7, 1.6, 0.16, 0, y + 0.8, 0), LK.stone, S)); parts.push(tag(cyl(0.2, 0.2, 0.18, 16, 0, y + 1.0, 0).rotateX(Math.PI / 2).translate(0, 0, 0), LK.light, th.glow)); }
		return merge(parts);
	},
	bookcase(th, h) {
		const w = 2.4, d = 0.5, parts = [
			tag(bx(w, h, 0.06, 0, h / 2, -d / 2 + 0.03), LK.books, [0.2, 0.15, 0.12]),
			tag(bx(0.08, h, d, -w / 2, h / 2, 0), LK.lacquer, th.lacquer),
			tag(bx(0.08, h, d, w / 2, h / 2, 0), LK.lacquer, th.lacquer),
			tag(bx(w + 0.08, 0.1, d + 0.04, 0, h + 0.05, 0), LK.lacquer, th.lacquer),
		];
		for (let y = 0.02; y < h - 0.2; y += 0.42) parts.push(tag(bx(w, 0.03, d, 0, y, 0), LK.lacquer, th.lacquer));
		// the book faces at the front, the brass rail a ladder rolls on
		parts.push(tag(new THREE.PlaneGeometry(w - 0.1, h - 0.1).translate(0, h / 2, -d / 2 + 0.38), LK.books, [0.2, 0.15, 0.12]));
		parts.push(tag(cyl(0.025, 0.025, w, 6).rotateZ(Math.PI / 2).translate(0, Math.min(h - 0.3, 3.2), d / 2 + 0.12), LK.brass, th.metal));
		return merge(parts);
	},
	ladder(th, h) {
		const parts = [tag(beam(-0.25, 0, 0.95, -0.25, h, 0.1, 0.05, 0.05), LK.brass, th.metal), tag(beam(0.25, 0, 0.95, 0.25, h, 0.1, 0.05, 0.05), LK.brass, th.metal)];
		for (let y = 0.3; y < h - 0.1; y += 0.32) { const z = 0.95 - y / h * 0.85; parts.push(tag(bx(0.5, 0.03, 0.06, 0, y, z), LK.brass, th.metal)); }
		return merge(parts);
	},
	lounger(th) {
		return merge([tag(bx(0.8, 0.3, 2.0, 0, 0.3, 0), LK.velvet, th.velvet), tag(beam(0, 0.45, -0.65, 0, 0.95, -1.05, 0.8, 0.12), LK.velvet, th.velvet), tag(bx(0.84, 0.06, 2.04, 0, 0.12, 0), LK.brass, th.metal)]);
	},
	candelabra(th) {
		const parts = [tag(cyl(0.1, 0.14, 0.5, 8, 0, 0.25, 0), LK.brass, th.metal)];
		for (let k = 0; k < 5; k++) { const x = (k - 2) * 0.14; parts.push(tag(cyl(0.025, 0.025, 0.25, 5, x, 0.6, 0), LK.light, th.warm)); }
		parts.push(tag(bx(0.62, 0.03, 0.06, 0, 0.48, 0), LK.brass, th.metal));
		return merge(parts);
	},
	horn(th) {
		return merge([tag(new THREE.CylinderGeometry(0.75, 0.06, 1.6, 20, 1, true).rotateX(Math.PI / 2).translate(0, 1.6, 0.1), LK.brass, th.metal), tag(cyl(0.05, 0.05, 1.2, 6, 0, 0.6, -0.6), LK.brass, th.metal), tag(cyl(0.4, 0.5, 0.1, 12, 0, 0.05, -0.6), LK.lacquer, th.lacquer)]);
	},
};

// ---------- the room's frame: positions across it ----------
// an area to furnish: u along the room's length, v across it (a rectangle; or for a round room
// u round the angle, v out along the radius)
function area(R, V) {
	if (!V.round) {
		const at = (u, v) => [R.x0 + u * (R.x1 - R.x0), R.z0 + v * (R.z1 - R.z0)];
		return { round: false, len: R.x1 - R.x0, wid: R.z1 - R.z0, at, inYaw: (v) => (v < 0.5 ? 0 : Math.PI), uYaw: Math.PI / 2, cx: (R.x0 + R.x1) / 2, cz: 0 };
	}
	const at = (u, v) => { const a = R.a0 + u * (R.a1 - R.a0), r = R.r0 + v * (R.r1 - R.r0); return [Math.sin(a) * r, Math.cos(a) * r]; };
	const am = (R.a0 + R.a1) / 2, rm = (R.r0 + R.r1) / 2;
	return { round: true, len: (R.a1 - R.a0) * rm, wid: R.r1 - R.r0, at, inYaw: (v, u = 0.5) => { const a = R.a0 + u * (R.a1 - R.a0); return v < 0.5 ? a : a + Math.PI; }, uYaw: am + Math.PI / 2, aAt: (u) => R.a0 + u * (R.a1 - R.a0), cx: Math.sin(am) * rm, cz: Math.cos(am) * rm };
}

// ---------- the shell ----------
// a floor (or ceiling) over x0..x1, z0..z1 at y, skipping rectangular holes and the squares
// round circular ones (each circle then ringed in to its square)
function floorGrid(B, x0, x1, z0, z1, y, holes, circles, look, tint, down = false, clipR = 0) {
	const xs = new Set([x0, x1]), zs = new Set([z0, z1]);
	for (let x = x0; x < x1; x += 1.3) xs.add(x);
	for (let z = z0; z < z1; z += 1.3) zs.add(z);
	const cut = [...holes.map((h) => [h.x - h.hw, h.x + h.hw, h.z - h.hd, h.z + h.hd]), ...circles.map((c) => [c.x - c.r - 0.4, c.x + c.r + 0.4, c.z - c.r - 0.4, c.z + c.r + 0.4])];
	for (const [a, b, c, d] of cut) { if (a > x0 && a < x1) xs.add(a); if (b > x0 && b < x1) xs.add(b); if (c > z0 && c < z1) zs.add(c); if (d > z0 && d < z1) zs.add(d); }
	const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b), pos = [];
	for (let j = 0; j < Z.length - 1; j++) for (let i = 0; i < X.length - 1; i++) {
		const ax = X[i], bx2 = X[i + 1], az = Z[j], bz = Z[j + 1], mx = (ax + bx2) / 2, mz = (az + bz) / 2;
		if (bx2 - ax < 0.01 || bz - az < 0.01 || cut.some(([a, b, c, d]) => mx > a && mx < b && mz > c && mz < d)) continue;
		if (clipR) {
			// (a round floor: cells past the edge dropped, those across it drawn in to it)
			const cs = [[ax, az], [bx2, az], [bx2, bz], [ax, bz]];
			if (!cs.some(([x, z]) => x * x + z * z < clipR * clipR)) continue;
			const [p0, p1, p2, p3] = cs.map(([x, z]) => { const l = Math.hypot(x, z); return l > clipR ? [x / l * clipR, z / l * clipR] : [x, z]; });
			if (!down) pos.push(p0[0], y, p0[1], p2[0], y, p2[1], p1[0], y, p1[1], p0[0], y, p0[1], p3[0], y, p3[1], p2[0], y, p2[1]);
			else pos.push(p0[0], y, p0[1], p1[0], y, p1[1], p2[0], y, p2[1], p0[0], y, p0[1], p2[0], y, p2[1], p3[0], y, p3[1]);
			continue;
		}
		if (!down) pos.push(ax, y, az, bx2, y, bz, bx2, y, az, ax, y, az, ax, y, bz, bx2, y, bz);
		else pos.push(ax, y, az, bx2, y, az, bx2, y, bz, ax, y, az, bx2, y, bz, ax, y, bz);
	}
	for (const c of circles) ringIn(pos, c.x, c.z, c.r, c.r + 0.4, y, down);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	B.add(g, look, tint);
}
// the ring from a circle out to its square
function ringIn(pos, x, z, r, s, y, down) {
	const n = 32;
	for (let k = 0; k < n; k++) {
		const pts = [k / n * TAU, (k + 1) / n * TAU].map((a) => { const dx = Math.sin(a), dz = Math.cos(a), m = s / Math.max(Math.abs(dx), Math.abs(dz)); return [x + dx * r, z + dz * r, x + dx * m, z + dz * m]; });
		const [i0x, i0z, o0x, o0z] = pts[0], [i1x, i1z, o1x, o1z] = pts[1];
		if (!down) pos.push(i0x, y, i0z, o0x, y, o0z, o1x, y, o1z, i0x, y, i0z, o1x, y, o1z, i1x, y, i1z);
		else pos.push(i0x, y, i0z, o1x, y, o1z, o0x, y, o0z, i0x, y, i0z, i1x, y, i1z, o1x, y, o1z);
	}
}
// a round floor (or ceiling): rings out from r0 to r1
function floorDisc(B, r0, r1, y, look, tint, down = false, n = 32) {
	const pos = [], rs = [r0];
	for (let r = r0 + 1.3; r < r1; r += 1.3) rs.push(r);
	rs.push(r1);
	for (let j = 0; j < rs.length - 1; j++) for (let k = 0; k < n; k++) {
		const a0 = k / n * TAU, a1 = (k + 1) / n * TAU, p = (r, a) => [Math.sin(a) * r, Math.cos(a) * r];
		const [ax, az] = p(rs[j], a0), [bx2, bz] = p(rs[j + 1], a0), [cx, cz] = p(rs[j + 1], a1), [dx, dz] = p(rs[j], a1);
		if (!down) pos.push(ax, y, az, bx2, y, bz, cx, y, cz, ax, y, az, cx, y, cz, dx, y, dz);
		else pos.push(ax, y, az, cx, y, cz, bx2, y, bz, ax, y, az, dx, y, dz, cx, y, cz);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	B.add(g, look, tint);
}
// a wall piece as the plan has it (rooms.js), drawn in its mode
function wallPiece(B, W, h) {
	const th = B.th, len = W.len, H = W.y1 - W.y0, at = (g) => { g.rotateY(W.yaw); return g.translate(W.x, 0, W.z); };
	if (W.mode === 'glass' || W.mode === 'shaft') {
		const sk = W.mode === 'shaft' ? 0.12 : 0.45, top = W.mode === 'shaft' ? 0 : Math.min(0.6, H * 0.1);
		B.add(at(bx(len, sk, W.t + 0.04, 0, sk / 2, 0)), LK.stone, th.stone);
		if (top) B.add(at(bx(len, top, W.t, 0, W.y1 - top / 2, 0)), LK.plaster, th.wall);
		B.pane(at(new THREE.PlaneGeometry(len, W.y1 - top - sk).translate(0, sk + (W.y1 - top - sk) / 2, 0)));
		const n = Math.max(1, Math.round(len / 2.3));
		for (let k = 0; k <= n; k++) B.add(at(bx(0.09, W.y1 - top - sk, 0.14, -len / 2 + k * len / n, sk + (W.y1 - top - sk) / 2, 0)), LK.brass, th.metal);
		for (let y = sk + 3.4; y < W.y1 - top - 1; y += 3.4) B.add(at(bx(len, 0.08, 0.14, 0, y, 0)), LK.brass, th.metal);
	} else if (W.mode === 'lintel') {
		B.add(at(bx(len, H, W.t + 0.02, 0, W.y0 + H / 2, 0)), W.t > 0.35 ? LK.stone : LK.plaster, W.t > 0.35 ? th.stone : th.wall);
		B.add(at(bx(len + 0.3, 0.18, W.t + 0.12, 0, W.y0 + 0.09, 0)), LK.brass, th.metal);
		for (const sx of [-1, 1]) B.add(at(bx(0.16, W.y0, W.t + 0.12, sx * (len / 2 + 0.07), W.y0 / 2, 0)), LK.brass, th.metal);
	} else {
		const part = W.mode === 'part';
		B.add(at(bx(len, H, W.t, 0, W.y0 + H / 2, 0)), part ? LK.stone : LK.plaster, part ? th.stone : th.wall);
		B.add(at(bx(len, 0.22, W.t + 0.05, 0, W.y0 + 0.11, 0)), LK.lacquer, th.lacquer);
		// pilasters and a light line along the top
		if (len > 3) for (let x = -len / 2 + 2; x < len / 2 - 1; x += 4) B.add(at(bx(0.5, H, W.t + 0.16, x, W.y0 + H / 2, 0)), LK.stone, th.stone);
		if (H > 4) B.add(at(bx(len, 0.08, W.t + 0.1, 0, Math.min(W.y1 - 0.5, h - 0.5), 0)), LK.light, th.glow);
	}
}

// the shell of a volume: floor, ceiling (or dome), walls, porches, gallery and stairs
function shell(B, V, extraCuts) {
	const th = B.th, L = V.L, h = V.h, holes = [...L.holes, ...extraCuts.filter((c) => c.hw)], circles = extraCuts.filter((c) => c.r);
	const kind = V.rooms[0].kind, floorLook = /baths|water|conservatory|skygarden/.test(kind) ? LK.terrazzo : LK.stone;
	const dome = kind === 'crown' || kind === 'observatory';
	if (!V.round) {
		const x0 = -V.w / 2 + 0.15, x1 = V.w / 2 - 0.15, z0 = -V.d / 2 + 0.15, z1 = V.d / 2 - 0.15;
		floorGrid(B, x0, x1, z0, z1, 0.03, holes, circles, floorLook, th.floor);
		if (dome) {
			const R = Math.min(V.d / 2 - 1.2, h - 4), hw = h - R;
			floorGrid(B, x0, x1, z0, z1, hw, [], [{ x: 0, z: 0, r: R }], LK.plaster, th.wall, true);
			B.add(new THREE.SphereGeometry(R, 40, 14, 0, TAU, 0, Math.PI / 2).scale(-1, 1, 1).translate(0, hw, 0), LK.stars, [0.1, 0.05, 0.15]);
			B.add(tor(R, 0.14, 0, hw, 0, 48), LK.light, th.glow);
			V.domeR = R; V.domeY = hw;
		} else {
			floorGrid(B, x0, x1, z0, z1, h - 0.02, V.top ? [] : L.ceilHoles || L.holes, [], LK.plaster, th.wall, true);
			// coffers: beams across the ceiling, and a light cove all round
			for (let x = x0 + 4; x < x1 - 1; x += 4) B.add(bx(0.35, 0.5, z1 - z0, x, h - 0.27, 0), LK.lacquer, th.lacquer);
			B.add(bx(x1 - x0, 0.1, 0.12, 0, h - 0.7, z0 + 0.25), LK.light, th.glow).add(bx(x1 - x0, 0.1, 0.12, 0, h - 0.7, z1 - 0.25), LK.light, th.glow);
		}
	} else {
		const r0 = V.lift ? 1.5 : 0;
		floorGrid(B, -V.r, V.r, -V.r, V.r, 0.03, holes, circles, floorLook, th.floor, false, V.r - 0.05);
		if (dome) {
			const R = V.r - 0.3, hw = Math.max(4, h - R);
			B.add(new THREE.SphereGeometry(R, 40, 14, 0, TAU, 0, Math.PI / 2).scale(-1, Math.min(1, (h - hw) / R), 1).translate(0, hw, 0), LK.stars, [0.1, 0.05, 0.15]);
			B.add(tor(R, 0.14, 0, hw, 0, 48), LK.light, th.glow);
			V.domeR = R; V.domeY = hw;
		} else {
			floorDisc(B, V.top ? 0 : r0, V.r - 0.05, h - 0.02, LK.plaster, th.wall, true);
			B.add(tor(V.r - 0.6, 0.07, 0, h - 0.7, 0, 48), LK.light, th.glow);
			for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; B.add(beam(Math.sin(a) * (r0 + 0.3), h - 0.3, Math.cos(a) * (r0 + 0.3), Math.sin(a) * (V.r - 0.3), h - 0.3, Math.cos(a) * (V.r - 0.3), 0.3, 0.45), LK.lacquer, th.lacquer); }
		}
	}
	// (the round walls want their glass to meet the floor's rings: the skirting covers the seam)
	for (const W of L.walls) wallPiece(B, W, h);
	for (const F of L.floors) {
		if (F.porch) {
			const g = bx(F.hw * 2, 0.06, F.hd * 2, 0, 0.03, 0);
			g.rotateY(F.yaw); B.add(g.translate(F.x, 0, F.z), LK.stone, th.floor);
			const c = bx(F.hw * 2, 0.3, F.hd * 2, 0, 0, 0);
			const D = L.doors.find((d) => d.porch) || { h: 4 };
			c.rotateY(F.yaw); B.add(c.translate(F.x, D.h + 0.75, F.z), LK.plaster, th.wall);
			continue;
		}
		if (!F.mezz) continue;
		if (F.ring) {
			gallery(B, F, V.mezz.y, th);
			continue;
		}
		const g = bx(F.hw * 2, 0.4, F.hd * 2, 0, 0, 0);
		g.rotateY(F.yaw || 0); B.add(g.translate(F.x, V.mezz.y - 0.2, F.z), LK.stone, th.floor);
	}
	for (const R of L.rails) balustrade(B, R, th);
	for (const S of L.ramps) stair(B, S, th);
	// the lift's landing: a brass threshold and a lamp over it
	if (V.lift && L.lift) {
		const { x, z, s } = V.lift, ox = L.lift.ox, oz = L.lift.oz;
		B.add(bx(ox ? 0.3 : s * 2, 0.04, oz ? 0.3 : s * 2, x + ox * (s + 0.3), 0.05, z + oz * (s + 0.3)), LK.brass, th.metal);
		B.add(bx(ox ? 0.1 : s * 2 - 0.4, 0.1, oz ? 0.1 : s * 2 - 0.4, x + ox * (s + 0.2), 2.85, z + oz * (s + 0.2)), LK.light, th.warm);
		B.light(x + ox * (s + 1.5), 2.6, z + oz * (s + 1.5), th.warm, 0.5, 3);
	}
}
// a ring gallery: its slab in pieces round the arc, a light line under its edge
function gallery(B, F, y, th) {
	const n = Math.ceil(F.span / 0.2);
	for (let k = 0; k < n; k++) {
		const a0 = F.a0 + k / n * F.span, a1 = F.a0 + (k + 1) / n * F.span, am = (a0 + a1) / 2, rm = (F.r0 + F.r1) / 2, len = 2 * F.r1 * Math.sin((a1 - a0) / 2) + 0.05;
		const g = bx(len, 0.4, F.r1 - F.r0, 0, 0, 0);
		g.rotateY(am); B.add(g.translate(Math.sin(am) * rm, y - 0.2, Math.cos(am) * rm), LK.stone, th.floor);
		const e = bx(len * F.r0 / F.r1, 0.06, 0.08, 0, 0, 0);
		e.rotateY(am); B.add(e.translate(Math.sin(am) * (F.r0 + 0.05), y - 0.42, Math.cos(am) * (F.r0 + 0.05)), LK.light, th.glow);
	}
}
// glass between brass rails along a to b at y (sloping to y2 on a stair)
function balustrade(B, R, th) {
	const y2 = R.y2 ?? R.y, len = Math.hypot(R.bx - R.ax, R.bz - R.az);
	if (len < 0.05) return;
	B.add(beam(R.ax, R.y + 1.1, R.az, R.bx, y2 + 1.1, R.bz, 0.09, 0.07), LK.brass, th.metal);
	B.add(beam(R.ax, R.y + 0.08, R.az, R.bx, y2 + 0.08, R.bz, 0.05, 0.1), LK.brass, th.metal);
	const n = Math.max(1, Math.round(len / 1.4));
	for (let k = 0; k <= n; k++) { const t = k / n; B.add(cyl(0.03, 0.03, 1.1, 5, R.ax + (R.bx - R.ax) * t, R.y + (y2 - R.y) * t + 0.55, R.az + (R.bz - R.az) * t), LK.brass, th.metal); }
	const yaw = Math.atan2(R.bx - R.ax, R.bz - R.az), mx = (R.ax + R.bx) / 2, mz = (R.az + R.bz) / 2;
	const p = new THREE.PlaneGeometry(len, 1.0);
	// (a sloping pane: sheared up the stair)
	const pp = p.attributes.position;
	for (let i = 0; i < pp.count; i++) pp.setY(i, pp.getY(i) + (pp.getX(i) / len) * (y2 - R.y));
	p.rotateY(yaw - Math.PI / 2).translate(mx, (R.y + y2) / 2 + 0.6, mz);
	B.pane(p);
}
// a stair: stone treads on a dark stringer, from a (at ya) to b (at yb)
function stair(B, S, th) {
	const len = Math.hypot(S.bx - S.ax, S.bz - S.az), rise = S.yb - S.ya, n = Math.max(2, Math.round(rise / 0.18)), yaw = Math.atan2(S.bx - S.ax, S.bz - S.az);
	for (let k = 0; k < n; k++) {
		const t = (k + 0.5) / n, x = S.ax + (S.bx - S.ax) * t, z = S.az + (S.bz - S.az) * t, y = S.ya + rise * (k + 1) / n;
		B.add(bx(S.hw * 2, 0.08, len / n + 0.04, x, y - 0.04, z, yaw), LK.stone, th.floor);
		B.add(bx(S.hw * 2 - 0.1, rise / n, 0.04, x - Math.sin(yaw) * len / n / 2, y - rise / n / 2, z - Math.cos(yaw) * len / n / 2, yaw), LK.lacquer, th.lacquer);
	}
	for (const sd of [-1, 1]) {
		const ox = Math.cos(yaw) * sd * S.hw, oz = -Math.sin(yaw) * sd * S.hw;
		B.add(beam(S.ax + ox, S.ya - 0.25, S.az + oz, S.bx + ox, S.yb - 0.25, S.bz + oz, 0.12, 0.5), LK.lacquer, th.lacquer);
	}
}

// ---------- the furnishing kit, set out ----------
function chandelier(B, x, y, z, R, k = 1) {
	const th = B.th, c = B.r() < 0.5 ? th.warm : th.glow;
	for (let i = 0; i < 3; i++) B.add(tor(R * (1 - i * 0.28), 0.05, x, y - i * R * 0.35, z, 32), LK.light, i === 1 ? th.glow : c);
	B.add(cyl(0.03, 0.03, 3, 5, x, y + 1.5, z), LK.brass, th.metal);
	const n = Math.round(10 * R);
	for (let i = 0; i < n; i++) { const a = i / n * TAU; B.add(cyl(0.012, 0.012, 0.6 + (i % 3) * 0.3, 3, x + Math.sin(a) * R, y - 0.4 - (i % 3) * 0.15, z + Math.cos(a) * R), LK.light, th.warm); }
	B.light(x, y - R * 0.4, z, c, 1.6 * k, 5 + R * 3);
}
// a light sculpture: tall rods of light hung in a ring, or an orb in brass rings
function sculptureLight(B, x, y, z, h, kind) {
	const th = B.th;
	if (kind) {
		for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, rr = 0.8 + (i % 2) * 0.5; B.add(cyl(0.05, 0.05, h * (0.5 + (i % 3) * 0.2), 5, x + Math.sin(a) * rr, y, z + Math.cos(a) * rr), LK.light, i % 2 ? th.glow : th.warm); }
	} else {
		B.add(sph(0.9, x, y, z, 16), LK.light, th.glow);
		for (let i = 0; i < 3; i++) B.add(new THREE.TorusGeometry(1.4 + i * 0.25, 0.04, 6, 40).rotateX(i * 0.9).rotateZ(i * 0.6).translate(x, y, z), LK.brass, th.metal);
	}
	B.light(x, y, z, th.glow, 1.4, 7 + h);
}
function rug(B, x, z, w, d, yaw, tint) {
	B.add(bx(w, 0.025, d, x, 0.045, z, yaw), LK.velvet, tint);
	B.add(bx(w + 0.12, 0.02, d + 0.12, x, 0.04, z, yaw), LK.brass, B.th.metal);
}
// a reflecting pool sunk in the floor (its floor walked, shallow), its coping, its glow
function pool(B, x, z, w, d, deep = 0.45) {
	const th = B.th, hw = w / 2, hd = d / 2;
	B.cuts.push({ x, z, hw, hd });
	B.lows.push({ x, z, hw, hd, y: -deep });
	B.add(bx(hw * 2, 0.04, hd * 2, x, -0.13, z), LK.water, [0.04, 0.08, 0.12]);
	B.add(bx(hw * 2, 0.06, hd * 2, x, -deep - 0.03, z), LK.stone, th.stone);
	for (const [ox, oz, ww, dd] of [[0, hd, hw * 2 + 0.8, 0.4], [0, -hd, hw * 2 + 0.8, 0.4], [hw, 0, 0.4, hd * 2], [-hw, 0, 0.4, hd * 2]]) {
		B.add(bx(ww, 0.14 + deep, dd, x + ox, (0.14 - deep) / 2, z + oz), LK.stone, th.stone);
	}
	B.add(bx(hw * 2 - 0.1, 0.05, 0.06, x, -0.3, z + hd - 0.05), LK.light, th.glow);
	B.light(x, 0.2, z, th.glow, 0.7, Math.max(hw, hd) + 2);
	B.avoid.push({ x, z, r: Math.hypot(hw, hd) + 0.3 });
}
// a sunken lounge: a round pit of velvet round a low table under a light
function pit(B, x, z, r) {
	const th = B.th;
	B.cuts.push({ x, z, r });
	B.lows.push({ x, z, r, y: -0.7 });
	B.add(cyl(r, r, 0.06, 32, x, -0.73, z), LK.velvet, th.velvet.map((v) => v * 0.6));
	B.add(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 0.75, 40, 1, true).scale(-1, 1, 1).translate(x, -0.33, z), LK.stone, th.stone);
	B.add(tor(r + 0.2, 0.22, x, 0.0, z, 40), LK.stone, th.stone);
	B.add(new THREE.CylinderGeometry(r - 0.1, r - 0.1, 0.45, 40, 1, true).scale(-1, 1, 1).translate(x, -0.45, z), LK.velvet, th.velvet);
	B.add(tor(r - 0.45, 0.32, x, -0.45, z, 40).scale(1, 0.8, 1), LK.velvet, th.velvet);
	B.add(cyl(r * 0.35, r * 0.35, 0.35, 24, x, -0.5, z), LK.lacquer, th.lacquer);
	B.add(cyl(r * 0.37, r * 0.37, 0.03, 24, x, -0.32, z), LK.brass, th.metal);
	B.light(x, 1.5, z, th.warm, 0.8, r + 2);
	B.avoid.push({ x, z, r: r + 0.6 });
}
function colonnade(B, A, v, n, h, u0 = 0.06, u1 = 0.94) {
	for (let i = 0; i < n; i++) {
		const [x, z] = A.at(u0 + (u1 - u0) * (n === 1 ? 0.5 : i / (n - 1)), v);
		if (!B.free(x, z, 0.2)) continue;
		B.put('col' + h.toFixed(1), () => P.column(B.th, h), x, 0, z);
		B.solid(x, z, 0.55, 0.55, 0, 0, h);
	}
}
// a row of something along u at v, every `every` metres
function row(B, A, v, every, fn, u0 = 0.08, u1 = 0.92) {
	const n = Math.max(1, Math.floor(A.len * (u1 - u0) / every / (B.phone ? 1.6 : 1)));
	for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * (n ? i / n : 0.5); const [x, z] = A.at(u, v); if (B.free(x, z, 0.4)) fn(x, z, u); }
}

// the kinds of room, furnished (R: the room from the plan, A: its area, V: the volume)
const FURN = {
	atrium(B, R, A, V) {
		const th = B.th, h = V.h, M = V.mezz;
		if (!A.round) {
			pool(B, A.cx, 0, A.len * 0.45, Math.min(A.wid * 0.3, 5));
			const ch = M ? M.y : h;
			colonnade(B, A, M ? (M.g + 0.2) / A.wid : 0.14, Math.max(3, Math.round(A.len / 4.5)), ch - 0.05, 0.12, 0.88);
			colonnade(B, A, M ? 1 - (M.g + 0.2) / A.wid : 0.86, Math.max(3, Math.round(A.len / 4.5)), ch - 0.05, 0.12, 0.88);
			for (const u of [0.3, 0.7]) chandelier(B, ...A.at(u, 0.5).flatMap((x, i) => (i ? [x] : [x, h - 2.5])), 1.6 + h * 0.06);
			for (const [u, v] of [[0.05, 0.25], [0.05, 0.75]]) { const [x, z] = A.at(u, v); if (B.free(x, z, 1)) { B.put('tree' + h.toFixed(0), () => P.tree(th, th.glow, Math.min(7, h * 0.45)), x, 0, z); B.solid(x, z, 1, 1, 0, 0, 2); B.light(x, 3, z, th.glow, 0.5, 4); } }
			for (const v of [0.3, 0.7]) { const [x, z] = A.at(0.5, v); B.put('sofa3', () => P.sofa(th, 3), x, 0, z, A.inYaw(v) + Math.PI); }
		} else {
			// round: a ring of pools round the core, a halo of light over it, columns at the glass
			const rr = (R.r0 + R.r1) / 2;
			for (let k = 0; k < 3; k++) { const a = (k / 3 + 0.08) * TAU, x = Math.sin(a) * rr, z = Math.cos(a) * rr; pool(B, x, z, 3.6, 3.6); }
			B.add(tor(V.lift ? 3.2 : 2, 0.12, 0, h - 3, 0, 48), LK.light, th.glow).add(tor(V.lift ? 4 : 2.8, 0.06, 0, h - 3.8, 0, 48), LK.light, th.warm);
			B.light(0, h - 3.5, 0, th.glow, 2.2, h + 6);
			const n = Math.max(8, Math.round(V.r * 1.1));
			for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * TAU, x = Math.sin(a) * (V.r - 1.4), z = Math.cos(a) * (V.r - 1.4); if (!B.free(x, z, 0.3)) continue; B.put('col' + (M ? M.y : h).toFixed(1), () => P.column(th, (M ? M.y : h) - 0.05), x, 0, z); B.solid(x, z, 0.55, 0.55, 0, 0, h); }
			for (let k = 0; k < 3; k++) { const a = (k / 3 + 0.25) * TAU, x = Math.sin(a) * rr, z = Math.cos(a) * rr; if (B.free(x, z, 1)) { B.put('tree' + h.toFixed(0), () => P.tree(th, th.glow, Math.min(7, h * 0.45)), x, 0, z); B.solid(x, z, 1, 1, 0, 0, 2); B.light(x, 3, z, th.glow, 0.5, 4); } }
		}
	},
	grandhall(B, R, A, V) {
		const th = B.th, h = V.h;
		const [cx, cz] = A.at(0.5, 0.5);
		rug(B, cx, cz, A.round ? 5 : A.len * 0.7, A.round ? 5 : 3.6, A.round ? 0 : 0, th.velvet.map((c) => c * 0.8));
		for (const u of [0.2, 0.5, 0.8]) { const [x, z] = A.at(u, 0.5); chandelier(B, x, h - 2.2, z, 1.4 + h * 0.05); }
		colonnade(B, A, 0.12, Math.max(3, Math.round(A.len / 4)), (V.mezz ? V.mezz.y : h) - 0.05);
		colonnade(B, A, 0.88, Math.max(3, Math.round(A.len / 4)), (V.mezz ? V.mezz.y : h) - 0.05);
		for (const u of [0.04, 0.96]) { const [x, z] = A.at(u, 0.5); if (B.free(x, z, 0.8)) { B.put('ped', () => P.pedestal(th), x, 0, z); B.put('sc' + (u > 0.5 ? 1 : 0), () => P.sculpture(th, u > 0.5 ? 1 : 0), x, 0, z); B.solid(x, z, 0.5, 0.5, 0, 0, 2); } }
		row(B, A, 0.3, 6, (x, z) => B.put('sofa3', () => P.sofa(th, 3), x, 0, z, A.inYaw(0.3) + Math.PI), 0.25, 0.75);
	},
	gallery(B, R, A, V) {
		const th = B.th, h = V.h;
		let k = 0;
		for (const v of [0.25, 0.75]) row(B, A, v, 4, (x, z) => {
			const s = k++ % 5;
			B.put('ped', () => P.pedestal(th), x, 0, z, A.inYaw(v));
			B.put('sc' + s, () => P.sculpture(th, s), x, 0, z, A.inYaw(v));
			B.solid(x, z, 0.5, 0.5, 0, 0, 2.5);
			B.light(x, 2.8, z, th.warm, 0.35, 2.5);
		});
		row(B, A, 0.5, 8, (x, z) => { B.put('bench', () => merge([tag(bx(2.4, 0.42, 0.7, 0, 0.21, 0), LK.velvet, th.velvet), tag(bx(2.44, 0.04, 0.74, 0, 0.02, 0), LK.brass, th.metal)]), x, 0, z, A.uYaw); B.solid(x, z, 1.2, 0.35, A.uYaw, 0, 0.5); }, 0.2, 0.8);
		// the works on their screens: soft panels of light in dark lacquer frames
		for (const v of [0.08, 0.92]) row(B, A, v, 5, (x, z, u) => {
			const yaw = A.inYaw(v, u), c = B.r() < 0.5 ? th.glow : th.warm, w = 1.6 + B.r() * 1.2, hh = Math.min(h - 2, 1.6 + B.r() * 1.4);
			B.add(bx(w + 0.3, hh + 0.3, 0.12, 0, 1.4 + hh / 2, 0).rotateY(yaw).translate(x, 0, z), LK.lacquer, th.lacquer);
			B.add(bx(w, hh, 0.04, 0, 1.4 + hh / 2, 0.07).rotateY(yaw).translate(x, 0, z), LK.light, c.map((q) => q * 0.35));
			B.solid(x, z, w / 2, 0.2, yaw, 0, 3);
		}, 0.15, 0.85);
		for (const u of [0.25, 0.75]) { const [x, z] = A.at(u, 0.5); B.light(x, h - 1, z, th.warm, 0.6, 6); B.add(bx(0.12, 0.08, 4, x, h - 0.9, z, A.uYaw), LK.light, th.warm); }
	},
	library(B, R, A, V) {
		const th = B.th, h = V.h, top = V.mezz ? V.mezz.y : h, sh = Math.min(top - 0.6, 7.5);
		// the stacks: tall cases in rows off both sides, ladders rolling on them; reading tables on the axis
		for (const v of [0.12, 0.88]) row(B, A, v, 3.2, (x, z) => {
			const yaw = A.uYaw;
			B.put('case' + sh.toFixed(1), () => P.bookcase(th, sh), x, 0, z, yaw);
			B.put('case' + sh.toFixed(1), () => P.bookcase(th, sh), x, 0, z, yaw + Math.PI);
			if (B.r() < 0.5) B.put('lad' + Math.min(sh - 0.3, 3.4).toFixed(1), () => P.ladder(th, Math.min(sh - 0.3, 3.4)), x + Math.sin(yaw) * 0.0, 0, z, yaw + (B.r() < 0.5 ? 0 : Math.PI));
			B.solid(x, z, 1.2, 0.55, yaw, 0, sh);
		}, 0.08, 0.92);
		row(B, A, 0.5, 6.5, (x, z) => {
			const yaw = A.uYaw, ax = Math.sin(yaw), az = Math.cos(yaw);
			B.add(bx(1.4, 0.08, 3.2, x, 0.78, z, yaw), LK.lacquer, th.lacquer);
			B.add(bx(0.12, 0.74, 2.6, x, 0.37, z, yaw), LK.brass, th.metal);
			for (const s of [-1, 1]) {
				B.put('lampT', () => merge([tag(cyl(0.02, 0.02, 0.4, 5, 0, 0.2, 0), LK.brass, th.metal), tag(cyl(0.08, 0.16, 0.18, 10, 0, 0.45, 0), LK.light, [0.4, 1.0, 0.6])]), x + ax * s * 1.1, 0.82, z + az * s * 1.1);
				B.light(x + ax * s * 1.1, 1.4, z + az * s * 1.1, th.warm, 0.45, 2.5);
				for (const t of [-0.6, 0.6]) B.put('chair', () => P.chair(th), x + ax * t + az * s * 1.05, 0, z + az * t - ax * s * 1.05, Math.atan2(-az * s, ax * s));
			}
			B.solid(x, z, 0.8, 1.6, yaw, 0, 1);
		}, 0.2, 0.8);
		for (const u of [0.3, 0.7]) { const [x, z] = A.at(u, 0.5); chandelier(B, x, h - 2, z, 1.2); }
		// shelves along the gallery's wall too
		if (V.mezz && !A.round) for (const z of [-V.d / 2 + 0.6, V.d / 2 - 0.6]) for (let x = -V.w / 2 + 6.5; x < V.w / 2 - 1.5; x += 2.5) B.put('case' + Math.min(3.2, h - V.mezz.y - 0.6).toFixed(1), () => P.bookcase(th, Math.min(3.2, h - V.mezz.y - 0.6)), x, V.mezz.y, z, z < 0 ? 0 : Math.PI);
	},
	music(B, R, A, V) {
		const th = B.th, h = V.h;
		// the stage at the far end: the organ's pipes against the wall, a grand piano
		const [sx, sz] = A.at(0.9, 0.5), yaw = A.uYaw + Math.PI;
		const sw = A.round ? 6 : Math.min(A.wid - 1, 10);
		B.add(bx(sw, 0.8, 4, sx, 0.4, sz, yaw), LK.lacquer, th.lacquer);
		B.lows.push({ x: sx, z: sz, hw: sw / 2, hd: 2, yaw, y: 0.8 });
		B.add(bx(sw, 0.06, 0.1, 0, 0, 0).rotateY(yaw).translate(sx + Math.sin(yaw) * 2, 0.82, sz + Math.cos(yaw) * 2), LK.light, th.glow);
		const np = B.phone ? 9 : 17;
		for (let k = 0; k < np; k++) { const t = (k + 0.5) / np - 0.5, ph = Math.min(h - 1.5, 3 + (1 - Math.abs(t) * 1.6) * (h - 4)); const ox = Math.cos(yaw) * t * sw * 0.9, oz = -Math.sin(yaw) * t * sw * 0.9; B.add(cyl(0.16, 0.16, ph, 10, sx + ox - Math.sin(yaw) * 1.6, 0.8 + ph / 2, sz + oz - Math.cos(yaw) * 1.6), LK.brass, th.metal); }
		B.light(sx - Math.sin(yaw) * 1.2, h * 0.5, sz - Math.cos(yaw) * 1.2, th.glow, 1.2, h);
		piano(B, sx + Math.sin(yaw) * 0.4, 0.8, sz + Math.cos(yaw) * 0.4, yaw + 0.6);
		// the rows, an aisle down the middle
		for (let u = 0.2; u < 0.68; u += 1.1 / A.len) for (let v = 0.12; v < 0.88; v += 0.75 / A.wid) {
			if (Math.abs(v - 0.5) < 1.0 / A.wid) continue;
			const [x, z] = A.at(u, v);
			if (B.free(x, z, 0.1)) B.put('seat', () => P.seat(th), x, 0, z, A.round ? A.aAt(u) + Math.PI / 2 : yaw + Math.PI);
		}
		for (const u of [0.25, 0.55]) { const [x, z] = A.at(u, 0.5); chandelier(B, x, h - 2, z, 1.8); }
	},
	listening(B, R, A, V) {
		const th = B.th;
		const [x, z] = A.at(0.5, 0.5);
		pit(B, x, z, Math.min(3.2, A.wid * 0.3));
		for (const u of [0.12, 0.88]) { const [hx, hz] = A.at(u, 0.5); if (B.free(hx, hz, 0.5)) { B.put('horn', () => P.horn(th), hx, 0, hz, Math.atan2(x - hx, z - hz)); B.solid(hx, hz, 0.6, 0.6, 0, 0, 2); } }
		for (const v of [0.1, 0.9]) row(B, A, v, 3, (cx, cz) => { B.put('case3.0', () => P.bookcase(th, 3.0), cx, 0, cz, A.inYaw(v)); B.solid(cx, cz, 1.2, 0.3, A.inYaw(v), 0, 3); }, 0.2, 0.8);
		sculptureLight(B, x, V.h - 2, z, 2.5, 1);
		lamps(B, A, 0.25);
	},
	conservatory(B, R, A, V) {
		const th = B.th, h = V.h, g = B.r() < 0.5 ? th.glow : [0.5, 1.0, 0.75];
		const [cx, cz] = A.at(0.5, 0.5);
		fountain(B, cx, cz, 2.2);
		for (const v of [0.2, 0.8]) row(B, A, v, 3.4, (x, z, u) => {
			if (Math.floor(u * 10) % 3 === 0 && h > 7) { B.put('tree' + h.toFixed(0), () => P.tree(th, g, Math.min(8, h * 0.5)), x, 0, z); B.solid(x, z, 1, 1, 0, 0, 2); B.light(x, 3.5, z, g, 0.5, 4.5); }
			else { B.put('plant', () => P.planter(th, g), x, 0, z); B.solid(x, z, 0.6, 0.6, 0, 0, 1); B.light(x, 1.8, z, g, 0.3, 2.5); }
		}, 0.1, 0.9);
		// glowing strands hung from the ceiling
		const ns = B.phone ? 14 : 30;
		for (let k = 0; k < ns; k++) { const [x, z] = A.at(0.1 + B.r() * 0.8, 0.1 + B.r() * 0.8), l = 1.5 + B.r() * Math.min(5, h * 0.4); B.add(cyl(0.02, 0.02, l, 3, x, h - l / 2, z), LK.plant, g); }
		rows(B, A, th);
	},
	baths(B, R, A, V) {
		const th = B.th;
		const [x, z] = A.at(0.5, 0.5);
		if (!A.round) pool(B, x, z, A.len * 0.5, Math.min(A.wid * 0.45, 7), 0.9);
		else pool(B, x, z, 5, 5, 0.9);
		for (const u of [0.1, 0.9]) { const [px, pz] = A.at(u, 0.5); pit(B, px, pz, 1.6); }
		row(B, A, 0.12, 2.4, (lx, lz) => { B.put('lounger', () => P.lounger(th), lx, 0, lz, A.inYaw(0.12) + Math.PI); B.solid(lx, lz, 0.4, 1, A.inYaw(0.12), 0, 0.6); }, 0.25, 0.75);
		colonnade(B, A, 0.88, Math.max(3, Math.round(A.len / 4)), V.h - 0.05, 0.25, 0.75);
		sculptureLight(B, x, V.h - 1.8, z, 2, 0);
	},
	banquet(B, R, A, V) {
		const th = B.th, h = V.h;
		const n = A.wid > 12 ? 2 : 1;
		for (let t = 0; t < n; t++) {
			const v = n === 1 ? 0.5 : 0.33 + t * 0.34, [x, z] = A.at(0.5, v), len = A.round ? 5 : A.len * 0.6, yaw = A.uYaw;
			B.add(bx(1.5, 0.1, len, x, 0.78, z, yaw), LK.lacquer, th.lacquer);
			B.add(bx(1.0, 0.72, len - 1, x, 0.36, z, yaw), LK.lacquer, th.lacquer);
			B.add(bx(0.5, 0.012, len - 0.4, x, 0.84, z, yaw), LK.velvet, th.velvet);
			B.solid(x, z, 0.8, len / 2 + 0.6, yaw, 0, 1);
			const nc = Math.floor(len / 0.9);
			for (let k = 0; k < nc; k++) {
				const o = -len / 2 + 0.45 + k * len / nc, ox = Math.sin(yaw) * o, oz = Math.cos(yaw) * o;
				for (const s of [-1, 1]) B.put('chair', () => P.chair(th), x + ox + Math.cos(yaw) * s * 1.05, 0, z + oz - Math.sin(yaw) * s * 1.05, yaw + (s > 0 ? -Math.PI / 2 : Math.PI / 2));
				if (k % 3 === 1) { B.put('cand', () => P.candelabra(th), x + ox, 0.83, z + oz); B.light(x + ox, 1.6, z + oz, th.warm, 0.5, 2.8); }
			}
		}
		for (const u of [0.25, 0.5, 0.75]) { const [x, z] = A.at(u, 0.5); chandelier(B, x, h - 2, z, 1.3 + h * 0.04); }
		for (const v of [0.06, 0.94]) row(B, A, v, 7, (x, z, u) => { const yaw = A.inYaw(v, u); B.add(bx(3, 0.9, 0.6, 0, 0.45, 0).rotateY(yaw).translate(x, 0, z), LK.lacquer, th.lacquer); B.add(bx(3.04, 0.04, 0.64, 0, 0.92, 0).rotateY(yaw).translate(x, 0, z), LK.brass, th.metal); B.solid(x, z, 1.5, 0.3, yaw, 0, 1); }, 0.2, 0.8);
	},
	water(B, R, A, V) {
		const th = B.th;
		for (const u of [0.22, 0.5, 0.78]) { const [x, z] = A.at(u, 0.5); pool(B, x, z, A.round ? 3 : Math.min(A.len * 0.18, 5), Math.min(A.wid * 0.4, 5)); }
		for (const u of [0.36, 0.64]) { const [x, z] = A.at(u, 0.5); fountain(B, x, z, 1.1); }
		for (const v of [0.12, 0.88]) row(B, A, v, 3, (x, z) => { B.put('plant', () => P.planter(th, th.glow), x, 0, z); B.solid(x, z, 0.6, 0.6, 0, 0, 1); B.light(x, 1.8, z, th.glow, 0.3, 2.5); }, 0.1, 0.9);
		const [x, z] = A.at(0.5, 0.5);
		sculptureLight(B, x, V.h - 1.6, z, 1.5, 0);
	},
	lounge(B, R, A, V) {
		const th = B.th;
		const [x, z] = A.at(0.4, 0.5);
		pit(B, x, z, Math.min(3.4, A.wid * (A.wid < 8 ? 0.2 : 0.32)));
		const [px, pz] = A.at(0.82, 0.35);
		if (B.free(px, pz, 1.5)) piano(B, px, 0, pz, A.uYaw);
		for (const v of [0.12, 0.88]) row(B, A, v, 4, (lx, lz) => B.put('arm', () => P.armchair(th), lx, 0, lz, A.inYaw(v)), 0.15, 0.85);
		chandelier(B, x, V.h - 1.8, z, 1.5);
		lamps(B, A, 0.2);
	},
	suite(B, R, A, V) {
		const th = B.th;
		// the bed faces the glass; a tub by the window; screens of lacquer; a chaise
		const [x, z] = A.at(0.35, 0.4), yaw = A.round ? A.aAt(0.35) : 0;
		B.add(bx(2.4, 0.5, 2.3, 0, 0.25, 0).rotateY(yaw).translate(x, 0, z), LK.velvet, th.velvet);
		B.add(bx(2.3, 0.12, 2.1, 0, 0.56, 0.05).rotateY(yaw).translate(x, 0, z), LK.plaster, [0.85, 0.8, 0.78]);
		B.add(bx(2.8, 1.5, 0.2, 0, 0.75, -1.2).rotateY(yaw).translate(x, 0, z), LK.velvet, th.velvet.map((c) => c * 0.8));
		B.add(bx(2.9, 0.06, 2.4, 0, 0.02, 0).rotateY(yaw).translate(x, 0, z), LK.brass, th.metal);
		B.solid(x, z, 1.2, 1.2, yaw, 0, 1);
		rug(B, ...A.at(0.35, 0.55), 3.4, 2.4, yaw, th.velvet.map((c) => c * 0.6));
		const [tx, tz] = A.at(0.75, A.round ? 0.8 : 0.75);
		B.add(new THREE.CapsuleGeometry(0.75, 1.0, 6, 16).rotateZ(Math.PI / 2).scale(1, 0.55, 0.75).translate(0, 0.42, 0).rotateY(yaw).translate(tx, 0, tz), LK.stone, th.stone);
		B.add(bx(1.6, 0.04, 0.8, 0, 0.62, 0).rotateY(yaw).translate(tx, 0, tz), LK.water, [0.06, 0.12, 0.16]);
		B.solid(tx, tz, 1.3, 0.6, yaw, 0, 0.8);
		B.put('lounger', () => P.lounger(th), ...A.at(0.6, 0.3).flatMap((q, i) => (i ? [q] : [q, 0])), yaw + 0.4);
		for (const u of [0.15, 0.55]) { const [sx, sz] = A.at(u, 0.15); B.add(bx(2.2, Math.min(3.2, V.h - 0.5), 0.1, 0, Math.min(3.2, V.h - 0.5) / 2, 0).rotateY(A.uYaw).translate(sx, 0, sz), LK.lacquer, th.lacquer); }
		lamps(B, A, 0.2);
		sculptureLight(B, x, V.h - 1.2, z, 1.2, 1);
	},
	skygarden(B, R, A, V) {
		const th = B.th, g = [0.5, 1.0, 0.75];
		for (const u of [0.25, 0.75]) { const [x, z] = A.at(u, 0.5); B.add(bx(A.round ? 4 : A.len * 0.35, 0.12, Math.min(A.wid * 0.5, 6), x, 0.06, z, A.round ? A.aAt(u) : 0), LK.leaf, [0.07, 0.16, 0.06]); }
		const [x, z] = A.at(0.5, 0.5);
		fountain(B, x, z, 1.6);
		for (const v of [0.15, 0.85]) row(B, A, v, 4.5, (tx, tz) => { if (V.h > 6.5) { B.put('tree' + V.h.toFixed(0), () => P.tree(th, g, Math.min(6, V.h * 0.6)), tx, 0, tz); B.solid(tx, tz, 1, 1, 0, 0, 2); B.light(tx, 3, tz, g, 0.45, 4); } else B.put('plant', () => P.planter(th, g), tx, 0, tz); }, 0.1, 0.9);
		row(B, A, 0.32, 5, (bx2, bz) => B.put('bench', () => merge([tag(bx(2.4, 0.42, 0.7, 0, 0.21, 0), LK.velvet, th.velvet), tag(bx(2.44, 0.04, 0.74, 0, 0.02, 0), LK.brass, th.metal)]), bx2, 0, bz, A.uYaw), 0.2, 0.8);
		// glowing flowers in the beds
		const nf = B.phone ? 40 : 90;
		for (let k = 0; k < nf; k++) { const [fx, fz] = A.at(0.12 + B.r() * 0.76, 0.3 + B.r() * 0.4); B.add(sph(0.07, fx, 0.2 + B.r() * 0.15, fz, 4), LK.plant, B.r() < 0.6 ? th.glow : [1.0, 0.75, 0.9]); }
		B.light(x, 2, z, g, 0.8, 8);
	},
	crown(B, R, A, V) {
		const th = B.th, h = V.h, cy = V.domeY || h * 0.6;
		// an orrery of light round the core under the dome, a ring of velvet facing the glass
		for (let i = 0; i < 4; i++) B.add(new THREE.TorusGeometry(3 + i * 1.1, 0.05, 6, 48).rotateX(Math.PI / 2 + (i - 1.5) * 0.25).rotateZ(i * 0.4).translate(0, cy + 1 + i * 0.6, 0), LK.brass, th.metal);
		B.add(sph(1.1, 0, cy + 2.4, 0, 20), LK.light, th.glow);
		B.add(tor(2.2, 0.06, 0, cy - 0.5, 0, 40), LK.light, th.warm);
		B.light(0, cy + 2, 0, th.glow, 2.4, h + 8);
		const n = Math.max(8, Math.round(V.r * 0.9));
		for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * TAU, rr = V.r - 2.6; if (k % 3 === 2) continue; B.put('arm', () => P.armchair(th), Math.sin(a) * rr, 0, Math.cos(a) * rr, a); }
		for (let k = 0; k < 3; k++) { const a = (k / 3 + 0.17) * TAU, rr = V.r - 2.2; telescope(B, Math.sin(a) * rr, Math.cos(a) * rr, a); }
		lampsRound(B, V, 6);
	},
	observatory(B, R, A, V) {
		const th = B.th, cy = V.domeY || V.h * 0.6;
		B.add(cyl(3.2, 3.4, 0.6, 32, 0, 0.3, 0), LK.stone, th.stone).add(tor(3.3, 0.05, 0, 0.62, 0, 40), LK.light, th.glow);
		B.lows.push({ x: 0, z: 0, r: 3.3, y: 0.6 });
		telescope(B, 0, 0, 0.6, 2.2, 0.6);
		for (const [u, v] of [[0.2, 0.2], [0.2, 0.8], [0.8, 0.2], [0.8, 0.8]]) { const [x, z] = A.at(u, v); if (B.free(x, z, 0.6)) B.put('arm', () => P.armchair(th), x, 0, z, Math.atan2(-x, -z)); }
		// star charts: dark panels with points of light
		for (const v of [0.06, 0.94]) row(B, A, v, 4, (x, z, u) => { const yaw = A.inYaw(v, u); B.add(bx(2.2, 2.2, 0.06, 0, 2.2, 0).rotateY(yaw).translate(x, 0, z), LK.stars, [0.1, 0.05, 0.15]); B.add(bx(2.4, 2.4, 0.04, 0, 2.2, -0.04).rotateY(yaw).translate(x, 0, z), LK.brass, th.metal); }, 0.15, 0.85);
		B.light(0, cy, 0, th.glow, 1.4, 12);
		lamps(B, A, 0.15);
	},
	vestibule(B, R, A, V) {
		const th = B.th;
		const [x, z] = A.at(0.5, 0.5);
		pool(B, x, z, Math.max(1.2, A.len * 0.4), Math.min(1.4, A.wid * 0.25), 0.3);
		for (const u of [0.1, 0.9]) { const [px, pz] = A.at(u, 0.2); if (B.free(px, pz, 0.6)) { B.put('plant', () => P.planter(th, th.glow), px, 0, pz); B.solid(px, pz, 0.6, 0.6, 0, 0, 1); B.light(px, 1.8, pz, th.glow, 0.35, 2.5); } }
		sculptureLight(B, x, V.h - 0.9, z, 1.0, 1);
		B.put('bench', () => merge([tag(bx(2.4, 0.42, 0.7, 0, 0.21, 0), LK.velvet, th.velvet), tag(bx(2.44, 0.04, 0.74, 0, 0.02, 0), LK.brass, th.metal)]), ...A.at(0.5, 0.85).flatMap((q, i) => (i ? [q] : [q, 0])), Math.PI / 2 * 0);
	},
	living(B, R, A, V) {
		const th = B.th, h = V.h;
		// the pit facing the glass over the drop, a hearth, the piano, the long table under a chandelier
		const [x, z] = A.at(0.5, 0.72);
		pit(B, x, z, Math.min(2.8, A.len * 0.3, A.wid * 0.18));
		const [hx, hz] = A.at(0.5, 0.42);
		B.add(bx(Math.min(3.6, A.len * 0.5), 1.1, 0.7, hx, 0.55, hz), LK.lacquer, th.lacquer);
		B.add(bx(Math.min(3.0, A.len * 0.45), 0.25, 0.72, hx, 0.6, hz), LK.light, [1.0, 0.45, 0.2]);
		B.solid(hx, hz, Math.min(1.8, A.len * 0.25), 0.4, 0, 0, 1.1);
		B.light(hx, 0.8, hz, [1.0, 0.5, 0.25], 0.9, 4);
		const [tx, tz] = A.at(0.5, 0.18), len = Math.min(4.5, A.wid * 0.3);
		B.add(bx(len, 0.08, 1.2, tx, 0.78, tz), LK.lacquer, th.lacquer).add(bx(len - 0.6, 0.72, 0.8, tx, 0.36, tz), LK.lacquer, th.lacquer);
		B.solid(tx, tz, len / 2, 0.6, 0, 0, 1);
		for (let k = 0; k < Math.floor(len / 0.9); k++) for (const s of [-1, 1]) B.put('chair', () => P.chair(th), tx - len / 2 + 0.45 + k * 0.9, 0, tz + s * 0.95, s > 0 ? Math.PI : 0);
		chandelier(B, tx, h - 1.6, tz, 1.0);
		const [px, pz] = A.at(0.85, 0.5);
		if (B.free(px, pz, 1.2) && A.len > 7) piano(B, px, 0, pz, -Math.PI / 2);
		sculptureLight(B, x, h - 1.5, z, Math.min(2.5, h * 0.3), 1);
	},
};
function piano(B, x, y, z, yaw) {
	const th = B.th;
	B.put('piano', () => {
		const g = new THREE.Shape();
		g.moveTo(-0.75, 0); g.lineTo(0.75, 0); g.lineTo(0.75, 1.2); g.bezierCurveTo(0.75, 2.0, 0.1, 1.6, -0.2, 2.2); g.lineTo(-0.75, 2.2); g.lineTo(-0.75, 0);
		const body = new THREE.ExtrudeGeometry(g, { depth: 0.35, bevelEnabled: false, curveSegments: 8 }).rotateX(Math.PI / 2).translate(0, 1.0, -0.2);
		const parts = [tag(body, LK.lacquer, [0.01, 0.01, 0.012]), tag(bx(1.5, 0.08, 0.3, 0, 0.75, -0.15), LK.plaster, [0.9, 0.88, 0.84])];
		for (const [lx, lz] of [[-0.6, 0.1], [0.6, 0.1], [-0.4, 1.9]]) parts.push(tag(cyl(0.06, 0.05, 0.65, 6, lx, 0.33, lz), LK.lacquer, [0.01, 0.01, 0.012]));
		parts.push(tag(beam(0.6, 1.0, 1.4, 0.4, 1.9, 1.6, 0.03, 0.03), LK.brass, th.metal));
		return merge(parts);
	}, x, y, z, yaw);
	B.solid(x + Math.sin(yaw) * 1, z + Math.cos(yaw) * 1, 0.8, 1.2, yaw, y, y + 1.2);
}
function fountain(B, x, z, r) {
	const th = B.th;
	B.add(new THREE.CylinderGeometry(r, r + 0.1, 0.6, 32, 1, true).translate(x, 0.3, z), LK.stone, th.stone);
	B.add(tor(r, 0.12, x, 0.62, z, 32), LK.stone, th.stone);
	B.add(cyl(r - 0.05, r - 0.05, 0.03, 32, x, 0.45, z), LK.water, [0.05, 0.1, 0.14]);
	B.add(cyl(0.25, 0.4, 1.4, 12, x, 0.7, z), LK.stone, th.stone);
	B.add(cyl(0.7, 0.2, 0.25, 16, x, 1.5, z), LK.brass, th.metal);
	B.add(cyl(0.05, 0.05, 1.6, 6, x, 2.4, z), LK.light, th.glow);
	B.light(x, 1.4, z, th.glow, 0.8, r + 3);
	B.solid(x, z, r, r, 0, 0, 0.7);
}
function telescope(B, x, z, yaw, s = 1, y = 0) {
	const th = B.th;
	B.add(cyl(0.5 * s, 0.6 * s, 0.3, 12, x, y + 0.15, z), LK.brass, th.metal);
	B.add(cyl(0.08 * s, 0.1 * s, 1.2 * s, 8, x, y + 0.75 * s, z), LK.brass, th.metal);
	const g = new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 2.4 * s, 16).rotateX(Math.PI / 2 - 0.6).rotateY(yaw).translate(x, y + 1.5 * s, z);
	B.add(g, LK.brass, th.metal);
	B.solid(x, z, 0.6 * s, 0.6 * s, 0, y, y + 2);
}
function lamps(B, A, v) {
	for (const u of [0.08, 0.92]) for (const vv of [v, 1 - v]) { const [x, z] = A.at(u, vv); if (B.free(x, z, 0.3)) { B.put('lamp', () => P.lamp(B.th), x, 0, z); B.light(x, 1.8, z, B.th.warm, 0.5, 3); } }
}
function lampsRound(B, V, n) {
	for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * TAU, rr = V.r - 1.2, x = Math.sin(a) * rr, z = Math.cos(a) * rr; if (B.free(x, z, 0.3)) { B.put('lamp', () => P.lamp(B.th), x, 0, z); B.light(x, 1.8, z, B.th.warm, 0.5, 3); } }
}
// (the conservatory's paths: stone strips through the beds)
function rows(B, A, th) {
	for (const v of [0.35, 0.65]) { const [x, z] = A.at(0.5, v); B.add(bx(A.round ? 1 : A.len * 0.8, 0.03, 0.9, x, 0.05, z, A.round ? 0 : 0), LK.stone, th.stone); }
}

// ---------- the build, start to finish ----------
// light baked into a geometry: the room's glow at each vertex, by distance and facing
function bake(g, lights, amb) {
	const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3);
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n ? n.getX(i) : 0, ny = n ? n.getY(i) : 1, nz = n ? n.getZ(i) : 0;
		let r = amb[0], gg = amb[1], b = amb[2];
		for (const L of lights) {
			const dx = L.x - x, dy = L.y - y, dz = L.z - z, d = Math.hypot(dx, dy, dz) + 1e-3;
			if (d > L.rad * 3) continue;
			const f = L.k * 0.6 / (1 + (d / L.rad) * (d / L.rad) * 3) * (0.2 + 0.8 * Math.max(0, (dx * nx + dy * ny + dz * nz) / d));
			r += L.c[0] * f; gg += L.c[1] * f; b += L.c[2] * f;
		}
		c[i * 3] = Math.min(2, r); c[i * 3 + 1] = Math.min(2, gg); c[i * 3 + 2] = Math.min(2, b);
	}
	g.setAttribute('aLit', new THREE.BufferAttribute(c, 3));
}
function litAt(x, y, z, lights, amb) {
	let r = amb[0], g = amb[1], b = amb[2];
	for (const L of lights) {
		const d = Math.hypot(L.x - x, L.y - y, L.z - z);
		if (d > L.rad * 3) continue;
		const f = L.k * 0.6 / (1 + (d / L.rad) * (d / L.rad) * 3) * 0.6;
		r += L.c[0] * f; g += L.c[1] * f; b += L.c[2] * f;
	}
	return [Math.min(2, r), Math.min(2, g), Math.min(2, b)];
}

// Build a volume: returns { solid (geometry), glass (geometry | null), inst [{ geo, mats: Float32Array, lit }],
// solids, cuts, lows } in the volume's frame
export function buildVolume(V, phone) {
	const B = new Build(V, phone);
	// keep clear: the lift's landing, the stairs, the doors and portals
	if (V.lift) B.avoid.push({ x: V.lift.x, z: V.lift.z, r: 3.6 });
	for (const S of V.L.ramps) for (let t = 0; t <= 1; t += 0.25) B.avoid.push({ x: S.ax + (S.bx - S.ax) * t, z: S.az + (S.bz - S.az) * t, r: 2 });
	for (const D of V.L.doors) B.avoid.push({ x: D.x, z: D.z, r: Math.max(2.5, D.w) });
	for (const P2 of V.parts || []) {
		if (V.round) for (const rr of [V.lift ? V.lift.s + 0.9 + P2.w / 2 : P2.w / 2]) B.avoid.push({ x: Math.sin(P2.a) * rr, z: Math.cos(P2.a) * rr, r: P2.w / 2 + 1.5 });
		else B.avoid.push({ x: P2.x, z: 0, r: P2.w / 2 + 1.8 });
	}
	// the rooms first (they cut the floors), then the shell round them
	for (const R of V.rooms) (FURN[R.kind] || FURN.lounge)(B, R, area(R, V), V);
	shell(B, V, B.cuts);
	const th = V.theme, amb = [th.warm[0] * 0.03 + 0.015, th.warm[1] * 0.03 + 0.01, th.warm[2] * 0.03 + 0.03];
	const solid = mergeGeometries(B.parts);
	for (const g of B.parts) g.dispose();
	bake(solid, B.lights, amb);
	const glass = B.glass.length ? mergeGeometries(B.glass) : null;
	for (const g of B.glass) g.dispose();
	const inst = [];
	for (const [, I] of B.inst) {
		const geo = I.make(), n = I.at.length, mats = new Float32Array(n * 16), lit = new Float32Array(n * 3);
		I.at.forEach(([x, y, z, yaw, s], k) => {
			m4.compose(v4.set(x, y, z), q4.setFromAxisAngle(s4.set(0, 1, 0), yaw), s4.set(s, s, s)).toArray(mats, k * 16);
			lit.set(litAt(x, y + 1.2, z, B.lights, amb), k * 3);
		});
		inst.push({ geo, mats, lit, n });
	}
	return { solid, glass, inst, solids: B.solids, cuts: B.cuts, lows: B.lows };
}
