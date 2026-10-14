// The military's vehicles, modelled in proportion and all original:
//   a main battle tank: a hull of sloped plates with composite armour on the glacis, side
//     skirts in panels, seven paired road wheels a side, the idler and the toothed sprocket,
//     track belts whose links scroll as it drives, a wedge turret with its mantlet, a long gun
//     with a thermal sleeve, fume extractor and muzzle, the commander's cupola and sight,
//     periscopes, hatches, smoke dischargers, a stowage basket, aerials;
//   a six-wheeled armoured truck: a faceted V-hull, flared wheel arches, a bull bar, a roof gun
//     ring with its shield, vision blocks, lights in guards;
//   an open utility jeep: flared arches, a bull bar, a roll cage carrying a gun ring;
//   a canvas-topped cargo truck;
//   a twin-engined fighter: a lofted fuselage with chines, a framed bubble canopy, side
//     intakes, swept wings with flaps and ailerons, all-moving tailplanes, twin canted fins
//     with rudders (all moving with the stick), gear that folds away behind its doors, twin
//     nozzles with an afterburner's flame;
//   a utility helicopter: a lofted cabin and boom, a rotor hub and blades that blur into a disc
//     at speed, the tail rotor, skids, stub wings, and a door gunner's post each side.
// Each is built in its parts, +z forward, y up, its origin on the ground at its middle; the
// parts that move have their own pivots. Every part is one geometry in one shared material
// (kit.vehicle, the paint by instance colour: military/kit.js), so a parked kind is one draw,
// and a coarse version stands in past ~150 m.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PI = Math.PI, H = PI / 2;
// sizes, for the physics and the parking (L long, W wide, H high, wr wheel radius)
export const DIMS = Object.freeze({
	tank: { L: 7.9, W: 3.6, H: 2.55, wr: 0.42, clear: 0.45, wz: 2.6, mass: 42000 },
	apc: { L: 7.2, W: 2.75, H: 2.7, wr: 0.6, clear: 0.5, wz: 2.4, mass: 16000 },
	jeep: { L: 4.6, W: 2.05, H: 1.95, wr: 0.43, clear: 0.42, wz: 1.45, mass: 2600 },
	truck: { L: 8.2, W: 2.5, H: 3.3, wr: 0.55, clear: 0.45, wz: 2.7, mass: 9000 },
	jet: { L: 16.4, W: 10.6, H: 4.9, wr: 0.36, clear: 1.2, wz: 4.5, mass: 13000 },
	heli: { L: 16.5, W: 3.2, H: 4.4, wr: 0.2, clear: 0.3, wz: 1.5, mass: 6500 },
});
// the colours a side paints them
export const SCHEMES = Object.freeze({ woodland: '#5b6346', desert: '#b6a47c', invader: '#6f7064', grey: '#8c939b', police: '#141a2c' });
// where the coarse model takes over
export const LOD_FAR = 150, LOD_FAR_PHONE = 95;

// the surfaces the vehicle shader knows (kit.js reads the same numbers)
export const M = Object.freeze({ camo: 0, paint: 1, dark: 2, rubber: 3, glass: 4, lamp: 5, canvas: 6, track: 7, hot: 8, beacon: 9, steel: 10 });
const WHITE = '#ffffff', DARK = '#3b3e41', GUN = '#2c2e30', TYRE = '#1c1d1e', STEEL = '#73777b', LIGHT = '#fff1d2', RED = '#ff3020', GREEN = '#30ff60';

// ---------- geometry ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
const geom = (pos, uv) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; };
// a triangle facing out (away from `out`, a point inside, or along `dir`)
function tri(pos, a, b, c, out, dir) {
	_a.fromArray(a); _b.fromArray(b); _c.fromArray(c);
	_n.subVectors(_b, _a).cross(_c.clone().sub(_a));
	const want = dir ? _p.fromArray(dir) : _p.set((a[0] + b[0] + c[0]) / 3 - out[0], (a[1] + b[1] + c[1]) / 3 - out[1], (a[2] + b[2] + c[2]) / 3 - out[2]);
	if (_n.dot(want) < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
}
// a slab between two outlines: bot and top are [x, z] (any simple polygon, the same count),
// at heights yb and yt; flat faced (armour plates, turrets, hulls seen from above)
export function prism(bot, yb, top, yt) {
	const pos = [], n = bot.length;
	// area sign: which way round the outline goes
	let area = 0;
	for (let i = 0; i < n; i++) { const [x0, z0] = bot[i], [x1, z1] = bot[(i + 1) % n]; area += x0 * z1 - x1 * z0; }
	const sg = Math.sign(area) || 1;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n, b0 = [bot[i][0], yb, bot[i][1]], b1 = [bot[j][0], yb, bot[j][1]], t0 = [top[i][0], yt, top[i][1]], t1 = [top[j][0], yt, top[j][1]];
		// (outward from this edge, in plan)
		const ex = bot[j][0] - bot[i][0], ez = bot[j][1] - bot[i][1], dir = [ez * sg, 0, -ex * sg];
		tri(pos, b0, b1, t1, null, dir); tri(pos, b0, t1, t0, null, dir);
	}
	for (const [ring, y, up] of [[bot, yb, -1], [top, yt, 1]]) {
		const faces = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []);
		for (const [a, b, c] of faces) tri(pos, [ring[a][0], y, ring[a][1]], [ring[b][0], y, ring[b][1]], [ring[c][0], y, ring[c][1]], null, [0, up, 0]);
	}
	return geom(pos);
}
// a skin through rings of points (each ring a closed loop, the same count): smooth unless
// flat; capped at the ends if asked
export function loft(rings, { flat = false, caps = true, open = false } = {}) {
	const n = rings[0].length, m = rings.length, pos = [];
	const centre = (r) => { const c = [0, 0, 0]; for (const p of r) { c[0] += p[0] / r.length; c[1] += p[1] / r.length; c[2] += p[2] / r.length; } return c; };
	const cs = rings.map(centre);
	if (!flat) {
		// indexed so the normals smooth round the loop
		const P = [], idx = [];
		for (const r of rings) for (const p of r) P.push(...p);
		let flip = null;
		for (let k = 0; k < m - 1; k++) for (let i = 0; i < (open ? n - 1 : n); i++) {
			const j = (i + 1) % n, a = k * n + i, b = k * n + j, c = (k + 1) * n + j, d = (k + 1) * n + i;
			if (flip === null) {
				_a.fromArray(P, a * 3); _b.fromArray(P, b * 3); _c.fromArray(P, c * 3);
				_n.subVectors(_b, _a).cross(_c.clone().sub(_a));
				const mid = [(P[a * 3] + P[c * 3]) / 2, (P[a * 3 + 1] + P[c * 3 + 1]) / 2, (P[a * 3 + 2] + P[c * 3 + 2]) / 2], cc = cs[k];
				flip = _n.dot(_p.set(mid[0] - cc[0], mid[1] - cc[1], mid[2] - cc[2])) < 0;
			}
			if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeVertexNormals();
		const parts = [g.toNonIndexed()];
		if (caps) for (const k of [0, m - 1]) {
			const cp = [], c = cs[k], dir = [cs[k][0] - cs[k === 0 ? 1 : m - 2][0], cs[k][1] - cs[k === 0 ? 1 : m - 2][1], cs[k][2] - cs[k === 0 ? 1 : m - 2][2]];
			for (let i = 0; i < n; i++) tri(cp, c, rings[k][i], rings[k][(i + 1) % n], null, dir);
			parts.push(geom(cp));
		}
		return parts.length > 1 ? mergeGeometries(parts) : parts[0];
	}
	for (let k = 0; k < m - 1; k++) for (let i = 0; i < (open ? n - 1 : n); i++) {
		const j = (i + 1) % n, a = rings[k][i], b = rings[k][j], c = rings[k + 1][j], d = rings[k + 1][i];
		const cc = [(cs[k][0] + cs[k + 1][0]) / 2, (cs[k][1] + cs[k + 1][1]) / 2, (cs[k][2] + cs[k + 1][2]) / 2];
		tri(pos, a, b, c, cc); tri(pos, a, c, d, cc);
	}
	if (caps) for (const k of [0, m - 1]) {
		const c = cs[k], dir = [cs[k][0] - cs[k === 0 ? 1 : m - 2][0], cs[k][1] - cs[k === 0 ? 1 : m - 2][1], cs[k][2] - cs[k === 0 ? 1 : m - 2][2]];
		for (let i = 0; i < n; i++) tri(pos, c, rings[k][i], rings[k][(i + 1) % n], null, dir);
	}
	return geom(pos);
}
// a rounded-box section at z: half width w, up ht and down hb from cy; e the squareness
export function sring(z, cy, w, ht, hb, n = 16, e = 2.6, cx = 0) {
	const out = [];
	for (let i = 0; i < n; i++) {
		const a = (i / n) * PI * 2, c = Math.cos(a), s = Math.sin(a);
		out.push([cx + w * Math.sign(c) * Math.abs(c) ** (2 / e), cy + (s >= 0 ? ht : hb) * Math.sign(s) * Math.abs(s) ** (2 / e), z]);
	}
	return out;
}
// an aerofoil panel from root to tip: each a leading edge point, a trailing edge point and a
// thickness, thickened along `up` (the panel's normal)
const FOIL = [[0, 0], [0.04, 0.55], [0.16, 0.9], [0.38, 1], [0.66, 0.72], [1, 0.08]];
export function panel(rootLE, rootTE, rootT, tipLE, tipTE, tipT, up = [0, 1, 0]) {
	const ring = (le, te, t) => {
		const out = [];
		for (let i = 0; i < FOIL.length; i++) { const [u, h] = FOIL[i]; out.push([le[0] + (te[0] - le[0]) * u + up[0] * h * t / 2, le[1] + (te[1] - le[1]) * u + up[1] * h * t / 2, le[2] + (te[2] - le[2]) * u + up[2] * h * t / 2]); }
		for (let i = FOIL.length - 2; i > 0; i--) { const [u, h] = FOIL[i]; out.push([le[0] + (te[0] - le[0]) * u - up[0] * h * t / 2, le[1] + (te[1] - le[1]) * u - up[1] * h * t / 2, le[2] + (te[2] - le[2]) * u - up[2] * h * t / 2]); }
		return out;
	};
	return loft([ring(rootLE, rootTE, rootT), ring(tipLE, tipTE, tipT)], { flat: false });
}

// the builder: geometries tagged with their surface and colour, in named parts
function vb(lo) {
	const parts = new Map();
	let cur = 'body', off = null;
	const add = (g, mtl, col = WHITE, x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0) => {
		let geo = g.index ? g.toNonIndexed() : g.clone();
		for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo.deleteAttribute(a);
		if (!geo.attributes.normal) geo.computeVertexNormals();
		const n = geo.attributes.position.count;
		if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
		if (x || y || z || yaw || pitch || roll) geo.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')), _s));
		if (off) geo.translate(off[0], off[1], off[2]);
		const cs = new Float32Array(n * 3), ms = new Float32Array(n), cc = new THREE.Color(col);
		for (let i = 0; i < n; i++) { cs[i * 3] = cc.r; cs[i * 3 + 1] = cc.g; cs[i * 3 + 2] = cc.b; ms[i] = mtl; }
		geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
		geo.setAttribute('mtl', new THREE.BufferAttribute(ms, 1));
		if (!parts.has(cur)) parts.set(cur, []);
		parts.get(cur).push(geo);
		return geo;
	};
	const B = {
		lo,
		seg: (n) => (lo ? Math.max(5, Math.round(n / 2.2)) : n),
		part(name) { cur = name; off = null; return B; },
		// build what follows about this point (a part made at its own origin)
		at(x, y, z) { off = [x, y, z]; return B; },
		add,
		// a box centred at (x, y, z)
		box: (mtl, col, w, h, d, x, y, z, yaw = 0, pitch = 0, roll = 0) => add(new THREE.BoxGeometry(w, h, d), mtl, col, x, y, z, yaw, pitch, roll),
		// a cylinder along y, or along z (cz) or x (cx)
		cyl: (mtl, col, r0, r1, h, x, y, z, seg = 12, pitch = 0, roll = 0, yaw = 0) => add(new THREE.CylinderGeometry(r0, r1, h, B.seg(seg)), mtl, col, x, y, z, yaw, pitch, roll),
		cz: (mtl, col, r0, r1, h, x, y, z, seg = 12) => add(new THREE.CylinderGeometry(r1, r0, h, B.seg(seg)).rotateX(H), mtl, col, x, y, z),
		cx: (mtl, col, r, h, x, y, z, seg = 12) => add(new THREE.CylinderGeometry(r, r, h, B.seg(seg)).rotateZ(H), mtl, col, x, y, z),
		lathe: (mtl, col, pts, seg, x, y, z, pitch = 0, yaw = 0, roll = 0) => add(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), B.seg(seg)), mtl, col, x, y, z, yaw, pitch, roll),
		// a tube through points (rails, bull bars, frames)
		tube: (mtl, col, pts, r, seg = 6) => { for (let i = 0; i < pts.length - 1; i++) { const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]), d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length() + r * 0.6, B.seg(seg)); g.applyQuaternion(_q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); add(g, mtl, col); } },
		// all parts merged, each moved to its pivot
		done(pivots = {}) {
			const out = {};
			for (const [name, gs] of parts) {
				for (const g of gs) g.setAttribute('opos', g.attributes.position.clone());
				const g = gs.length > 1 ? mergeGeometries(gs) : gs[0];
				for (const q of gs) if (q !== g) q.dispose();
				const p = pivots[name];
				if (p) g.translate(-p[0], -p[1], -p[2]);
				g.computeBoundingSphere(); g.computeBoundingBox();
				out[name] = g;
			}
			parts.clear();
			return out;
		},
	};
	return B;
}

// ---------- wheels ----------
// a tyre with a chunky tread and a dished steel rim, round the x axis at the origin
function wheel(B, r, w, side = 1) {
	const n = B.seg(28), prof = [[r * 0.6, -w / 2], [r * 0.9, -w / 2], [r * 0.985, -w * 0.42], [r, -w * 0.3], [r, w * 0.3], [r * 0.985, w * 0.42], [r * 0.9, w / 2], [r * 0.6, w / 2]];
	const tyre = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), n);
	if (!B.lo) {
		// tread blocks: the outer rows of the lathe stepped in and out round the tyre
		const P = tyre.attributes.position;
		for (let i = 0; i < P.count; i++) {
			const x = P.getX(i), z = P.getZ(i), rr = Math.hypot(x, z);
			if (rr < r * 0.97) continue;
			const a = Math.atan2(z, x), k = 1 + 0.035 * Math.sign(Math.sin(a * n / 2 + (P.getY(i) > 0 ? 1.2 : 0)));
			P.setX(i, x * k); P.setZ(i, z * k);
		}
		tyre.computeVertexNormals();
	}
	B.add(tyre.rotateZ(H), M.rubber, TYRE);
	B.add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 0.7, B.seg(18)).rotateZ(H), M.paint, '#ffffff', side * 0.0);
	B.add(new THREE.CylinderGeometry(r * 0.4, r * 0.46, 0.08, B.seg(14)).rotateZ(H), M.steel, STEEL, side * (w * 0.36));
	B.add(new THREE.CylinderGeometry(r * 0.14, r * 0.17, 0.12, B.seg(10)).rotateZ(H), M.dark, DARK, side * (w * 0.4));
	if (!B.lo) for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; B.add(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 6).rotateZ(H), M.dark, GUN, side * (w * 0.4), Math.sin(a) * r * 0.27, Math.cos(a) * r * 0.27); }
}

// ---------- the tank ----------
const TK = { sprocket: [-3.42, 0.76, 0.36], idler: [3.5, 0.72, 0.33], wheelY: 0.47, wheelR: 0.39, track: 0.62, tx: 1.48, turret: [0, 1.7, -0.3], gun: [0, 2.12, 1.95] };
// the belt's outer line, as (z, y) points round the sprocket, idler and wheels
function trackPath() {
	const pts = [], [sz, sy, sr] = TK.sprocket, [iz, iy, ir] = TK.idler, t = 0.08;
	const R1 = ir + t, R0 = sr + t;
	pts.push([-2.85, 0.0], [3.0, 0.0]);
	for (let i = 0; i <= 8; i++) { const a = -1.85 + (i / 8) * (H + 1.85); pts.push([iz + Math.cos(a) * R1, iy + Math.sin(a) * R1]); }
	for (let i = 1; i < 6; i++) { const u = i / 6; pts.push([iz + (sz - iz) * u, iy + R1 + (sy + R0 - iy - R1) * u - Math.sin(u * PI) * 0.06]); }
	for (let i = 0; i <= 8; i++) { const a = H + (i / 8) * (PI + 1.1 - H + 0.25); pts.push([sz + Math.cos(a) * R0, sy + Math.sin(a) * R0]); }
	return pts;
}
// the belt as a ribbon w wide at x, its uv in metres along (u) and across (v)
function quadUV(pos, uv, A, B2, C, D, ua, ub, uc, ud, dir) {
	_a.fromArray(A); _b.fromArray(B2); _c.fromArray(C);
	_n.subVectors(_b, _a).cross(_c.clone().sub(_a));
	if (_n.dot(_p.fromArray(dir)) < 0) { pos.push(...A, ...C, ...B2, ...A, ...D, ...C); uv.push(...ua, ...uc, ...ub, ...ua, ...ud, ...uc); }
	else { pos.push(...A, ...B2, ...C, ...A, ...C, ...D); uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); }
}
function trackBelt(B, x, w) {
	const P = trackPath(), n = P.length, t = 0.08, pos = [], uv = [];
	const mz = P.reduce((s, p) => s + p[0], 0) / n, my = P.reduce((s, p) => s + p[1], 0) / n;
	const L = [0];
	for (let i = 1; i <= n; i++) { const a = P[i - 1], b = P[i % n]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
	// the inner line: each point moved t toward the middle of the loop, square to the belt
	const In = P.map((p, i) => {
		const a = P[(i - 1 + n) % n], b = P[(i + 1) % n], dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
		let nz = -dy / l, ny = dz / l;
		if (nz * (mz - p[0]) + ny * (my - p[1]) < 0) { nz = -nz; ny = -ny; }
		return [p[0] + nz * t, p[1] + ny * t];
	});
	const hw = w / 2;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n, u0 = L[i], u1 = L[i + 1], o0 = P[i], o1 = P[j], i0 = In[i], i1 = In[j];
		const out = [0, (o0[1] + o1[1]) / 2 - my, (o0[0] + o1[0]) / 2 - mz];
		quadUV(pos, uv, [x - hw, o0[1], o0[0]], [x + hw, o0[1], o0[0]], [x + hw, o1[1], o1[0]], [x - hw, o1[1], o1[0]], [u0, -hw], [u0, hw], [u1, hw], [u1, -hw], out);
		quadUV(pos, uv, [x - hw, i0[1], i0[0]], [x + hw, i0[1], i0[0]], [x + hw, i1[1], i1[0]], [x - hw, i1[1], i1[0]], [u0, -hw], [u0, hw], [u1, hw], [u1, -hw], [0, -out[1], -out[2]]);
		for (const s of [-1, 1]) quadUV(pos, uv, [x + s * hw, o0[1], o0[0]], [x + s * hw, o1[1], o1[0]], [x + s * hw, i1[1], i1[0]], [x + s * hw, i0[1], i0[0]], [u0, s * hw], [u1, s * hw], [u1, s * hw * 0.8], [u0, s * hw * 0.8], [s, 0, 0]);
	}
	B.add(geom(pos, uv), M.track, '#5a554d');
}
function roadWheel(B, x, z, s) {
	const r = TK.wheelR, y = TK.wheelY;
	if (B.lo) { B.cx(M.rubber, TYRE, r, 0.5, x, y, z, 10); return; }
	// a pair of rubber-tyred discs on the hub
	for (const o of [-0.16, 0.16]) {
		B.cx(M.rubber, TYRE, r, 0.12, x + o, y, z, 20);
		B.cx(M.paint, WHITE, r * 0.84, 0.13, x + o, y, z, 20);
	}
	B.cx(M.dark, DARK, r * 0.5, 0.34, x, y, z, 14);
	B.cx(M.steel, STEEL, 0.13, 0.04, x + s * 0.25, y, z, 10);
	for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; B.cx(M.dark, GUN, 0.02, 0.05, x + s * 0.24, y + Math.sin(a) * 0.09, z + Math.cos(a) * 0.09, 5); }
}
function tank(B) {
	const lo = B.lo;
	B.part('hull');
	// the lower hull between the tracks; the upper hull out over them, its sides sloped in
	B.add(loft([[[-1.2, 0.48, -3.55], [-1.2, 0.48, 3.2], [-1.2, 1.1, 3.88], [-1.2, 1.15, -3.7]], [[1.2, 0.48, -3.55], [1.2, 0.48, 3.2], [1.2, 1.1, 3.88], [1.2, 1.15, -3.7]]], { flat: true }), M.camo, WHITE);
	const up = (x, xt) => [[x, 1.06, -3.78], [x, 1.06, 3.92], [xt, 1.62, 2.38], [xt, 1.7, -3.5], [xt * 0.98, 1.48, -3.8]];
	B.add(loft([up(-1.8, -1.62), up(1.8, 1.62)], { flat: true }), M.camo, WHITE);
	// composite armour on the glacis: a raised slab with bevelled edges and a chevron
	const gl = (x, k) => [[x, 1.13 + k * 0.05, 3.82 - k * 0.04], [x, 1.58 + k * 0.05, 2.5 - k * 0.04]];
	B.add(loft([[...gl(-1.5, 0), ...gl(-1.5, 1).reverse()], [...gl(1.5, 0), ...gl(1.5, 1).reverse()]], { flat: true }), M.camo, '#f2f2ee');
	// the turret ring's collar, the engine deck and its grilles, the rear plate
	B.cyl(M.camo, WHITE, 1.15, 1.2, 0.08, 0, 1.68, TK.turret[2], 28);
	for (let i = 0; i < (lo ? 0 : 7); i++) B.box(M.dark, '#2a2c2e', 2.0, 0.03, 0.09, 0, 1.71, -1.95 - i * 0.2);
	B.box(M.camo, WHITE, 2.3, 0.05, 1.5, 0, 1.69, -2.55);
	if (!lo) {
		for (let i = 0; i < 9; i++) B.box(M.dark, '#232527', 0.08, 0.02, 1.2, -0.9 + i * 0.225, 1.72, -3.0);
		for (const s of [-1, 1]) {
			// exhaust louvres, tail lights, tow pintle, towing eyes and shackles
			B.box(M.dark, '#262829', 0.7, 0.32, 0.06, s * 0.95, 1.25, -3.79);
			for (let i = 0; i < 4; i++) B.box(M.dark, '#3b3d3f', 0.66, 0.03, 0.08, s * 0.95, 1.14 + i * 0.07, -3.81);
			B.box(M.lamp, '#ff3a2a', 0.12, 0.08, 0.04, s * 1.55, 1.52, -3.8);
			B.box(M.dark, DARK, 0.12, 0.3, 0.16, s * 0.6, 0.86, 3.75, 0, 0.55);
			B.add(new THREE.TorusGeometry(0.08, 0.025, 6, 10), M.steel, STEEL, s * 0.6, 0.72, 3.88, H);
			B.box(M.dark, DARK, 0.1, 0.3, 0.14, s * 0.9, 0.9, -3.72);
		}
		// the tow cables along the glacis edge, the spare track links on the nose
		for (const s of [-1, 1]) B.tube(M.dark, '#4a4844', [[s * 1.55, 1.64, 1.6], [s * 1.6, 1.65, -1.2], [s * 1.6, 1.62, -2.6]], 0.03, 5);
		for (let i = 0; i < 4; i++) B.box(M.track, '#5a554d', 0.62, 0.05, 0.17, -0.2 + (i % 2) * 0.66 - 0.33, 1.3 - Math.floor(i / 2) * 0.12, 3.6 - Math.floor(i / 2) * 0.12, 0, 0.88);
	}
	// headlights in their guards, the driver's hatch and periscopes
	for (const s of [-1, 1]) {
		B.box(M.lamp, LIGHT, 0.2, 0.13, 0.06, s * 1.25, 1.48, 3.18, 0, -0.9);
		if (!lo) { B.tube(M.dark, DARK, [[s * 1.12, 1.38, 3.28], [s * 1.12, 1.58, 3.3], [s * 1.38, 1.58, 3.3], [s * 1.38, 1.38, 3.28]], 0.018, 4); B.box(M.lamp, '#ffb35a', 0.08, 0.06, 0.04, s * 1.6, 1.44, 3.55, 0, -0.9); }
	}
	B.cyl(M.camo, WHITE, 0.36, 0.38, 0.07, -0.55, 1.66, 2.15, 18);
	if (!lo) for (let i = -1; i <= 1; i++) { B.box(M.dark, DARK, 0.18, 0.12, 0.12, -0.55 + i * 0.21, 1.68, 2.52, i * 0.25); B.box(M.glass, '#26363c', 0.15, 0.07, 0.02, -0.55 + i * 0.22, 1.69, 2.585, i * 0.25); }
	// fenders and the side skirts in panels, their lower edges rubber
	for (const s of [-1, 1]) {
		B.box(M.camo, WHITE, 0.66, 0.05, 7.4, s * (1.48), 1.08, 0.06);
		B.box(M.camo, WHITE, 0.66, 0.05, 0.45, s * 1.48, 1.03, 3.85, 0, -0.3);
		const n = lo ? 1 : 6;
		for (let i = 0; i < n; i++) {
			const len = 6.6 / n, z = -3.2 + (i + 0.5) * len;
			B.box(M.camo, i % 2 ? WHITE : '#f0f0ea', 0.07, 0.5, len - (lo ? 0 : 0.03), s * 1.83, 0.82, z);
			if (!lo) { B.box(M.rubber, TYRE, 0.04, 0.09, len - 0.05, s * 1.83, 0.53, z); for (const e of [-1, 1]) B.cx(M.dark, GUN, 0.025, 0.03, s * 1.87, 1.0, z + e * (len / 2 - 0.12), 6); }
		}
		// the skirt's front panel, raked; stowage boxes on the fenders
		B.box(M.camo, WHITE, 0.07, 0.42, 0.62, s * 1.83, 0.92, 3.68, 0, -0.35);
		B.box(M.camo, '#e8e8e2', 0.55, 0.38, 1.25, s * 1.48, 1.3, -2.4);
		if (!lo) { B.box(M.camo, '#e2e2dc', 0.5, 0.3, 0.8, s * 1.48, 1.26, 0.9); B.box(M.dark, DARK, 0.52, 0.03, 0.04, s * 1.48, 1.4, 0.62); }
	}
	// the running gear: road wheels, idler, sprocket with its teeth, return rollers; the belts
	for (const s of [-1, 1]) {
		const x = s * TK.tx;
		for (let i = 0; i < 7; i++) roadWheel(B, x, -2.6 + i * 0.86, s);
		const [iz, iy, ir] = TK.idler, [sz, sy, sr] = TK.sprocket;
		B.cx(M.dark, DARK, ir, 0.42, x, iy, iz, 18);
		B.cx(M.steel, STEEL, ir * 0.45, 0.46, x, iy, iz, 12);
		B.cx(M.dark, DARK, sr, 0.3, x, sy, sz, 18);
		B.cx(M.steel, STEEL, sr * 0.5, 0.48, x, sy, sz, 12);
		if (!lo) {
			for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; for (const o of [-0.12, 0.12]) B.box(M.dark, DARK, 0.05, 0.11, 0.09, x + o, sy + Math.sin(a) * (sr + 0.02), sz + Math.cos(a) * (sr + 0.02), 0, -a); }
			for (let i = 0; i < 3; i++) B.cx(M.dark, DARK, 0.09, 0.2, x, 1.0, -1.8 + i * 1.8, 10);
		}
	}
	// (+x is the left side: forward is +z, up +y)
	for (const s of [-1, 1]) { B.part(s > 0 ? 'trackL' : 'trackR'); trackBelt(B, s * TK.tx, TK.track); }

	// ---------- the turret ----------
	B.part('turret');
	const ty = TK.turret[1], tz = TK.turret[2];
	const plan = [[0.42, 2.0], [0.62, 2.42], [1.74, 1.3], [1.8, -0.6], [1.66, -1.5], [1.5, -2.6], [-1.5, -2.6], [-1.66, -1.5], [-1.8, -0.6], [-1.74, 1.3], [-0.62, 2.42], [-0.42, 2.0]];
	const top = plan.map(([x, z]) => [x * 0.9, z * 0.95 - 0.06]);
	B.add(prism(plan, ty + 0.06, top, ty + 0.86), M.camo, WHITE, 0, 0, tz);
	B.add(prism(plan.map(([x, z]) => [x * 0.96, z * 0.97]), ty - 0.02, plan, ty + 0.06), M.camo, '#ececE6', 0, 0, tz);
	// add-on armour on the cheeks (a second skin, its seams showing)
	if (!lo) for (const s of [-1, 1]) {
		const ch = [[s * 0.66, 2.44], [s * 1.74, 1.32], [s * 1.6, 1.22], [s * 0.6, 2.24]].map(([x, z]) => [x, z]);
		B.add(prism(ch, ty + 0.12, ch.map(([x, z]) => [x * 0.97, z * 0.97]), ty + 0.8), M.camo, '#f4f4f0', 0, 0, tz);
	}
	// the mantlet and its dust boot
	B.add(prism([[-0.48, 1.85], [0.48, 1.85], [0.4, 2.38], [-0.4, 2.38]], ty + 0.1, [[-0.42, 1.88], [0.42, 1.88], [0.34, 2.3], [-0.34, 2.3]], ty + 0.78), M.camo, WHITE, 0, 0, tz);
	B.cz(M.canvas, '#5f5a44', 0.26, 0.18, 0.32, 0, TK.gun[1], 2.48 + tz + 0.02, 14);
	// the commander's cupola with its periscopes and hatch; the panoramic sight; the gunner's sight
	B.cyl(M.camo, WHITE, 0.42, 0.46, 0.28, 0.75, ty + 1.0, tz - 0.55, 20);
	B.cyl(M.camo, '#efefea', 0.4, 0.4, 0.06, 0.75, ty + 1.17, tz - 0.55, 20);
	if (!lo) for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2 + 0.3; B.box(M.glass, '#26363c', 0.12, 0.08, 0.03, 0.75 + Math.sin(a) * 0.45, ty + 1.02, tz - 0.55 + Math.cos(a) * 0.45, a); }
	B.cyl(M.dark, DARK, 0.09, 0.11, 0.35, 0.95, ty + 1.05, tz + 0.55, 10);
	B.box(M.camo, WHITE, 0.42, 0.34, 0.42, 0.95, ty + 1.35, tz + 0.55);
	B.box(M.glass, '#1f2e34', 0.32, 0.2, 0.02, 0.95, ty + 1.36, tz + 0.77);
	B.box(M.camo, WHITE, 0.5, 0.36, 0.62, -0.85, ty + 0.98, tz + 1.0);
	B.box(M.glass, '#1f2e34', 0.38, 0.2, 0.03, -0.85, ty + 1.02, tz + 1.32, 0, -0.2);
	// the loader's hatch and his machine gun on its mount
	B.cyl(M.camo, WHITE, 0.36, 0.36, 0.06, -0.62, ty + 0.9, tz - 0.6, 18);
	if (!lo) {
		B.cyl(M.dark, DARK, 0.04, 0.04, 0.42, -0.62, ty + 1.1, tz - 0.15, 6);
		B.box(M.dark, GUN, 0.12, 0.14, 0.7, -0.62, ty + 1.35, tz + 0.05);
		B.cz(M.dark, GUN, 0.025, 0.025, 0.7, -0.62, ty + 1.37, tz + 0.7, 6);
		B.box(M.dark, '#3a4033', 0.1, 0.16, 0.18, -0.52, ty + 1.26, tz - 0.05);
	}
	// smoke dischargers: two banks of four each side, angled up and out
	for (const s of [-1, 1]) for (let i = 0; i < (lo ? 1 : 4); i++) B.cyl(M.dark, '#3c4036', 0.06, 0.06, 0.32, s * (1.55 + (i % 2) * 0.13), ty + 0.62 + Math.floor(i / 2) * 0.14, tz + 0.95, 8, -0.75, -s * 0.5);
	if (!lo) for (const s of [-1, 1]) B.box(M.camo, WHITE, 0.28, 0.06, 0.4, s * 1.63, ty + 0.55, tz + 0.95);
	// the bustle rack: a wire basket with bags and boxes in it; stowage boxes on the turret sides
	if (!lo) {
		B.tube(M.dark, DARK, [[-1.45, ty + 0.3, tz - 2.6], [-1.5, ty + 0.3, tz - 3.15], [1.5, ty + 0.3, tz - 3.15], [1.45, ty + 0.3, tz - 2.6]], 0.025, 4);
		B.tube(M.dark, DARK, [[-1.45, ty + 0.75, tz - 2.6], [-1.5, ty + 0.75, tz - 3.15], [1.5, ty + 0.75, tz - 3.15], [1.45, ty + 0.75, tz - 2.6]], 0.025, 4);
		for (let i = 0; i < 6; i++) B.cyl(M.dark, DARK, 0.02, 0.02, 0.45, -1.5 + i * 0.6, ty + 0.52, tz - 3.15, 4);
		B.box(M.canvas, '#6a6449', 1.2, 0.45, 0.45, -0.7, ty + 0.5, tz - 2.88, 0.05);
		B.box(M.canvas, '#57543f', 0.9, 0.38, 0.4, 0.55, ty + 0.46, tz - 2.85, -0.08);
		B.box(M.camo, '#d8d8d0', 0.5, 0.32, 0.38, 1.2, ty + 0.44, tz - 2.88);
		B.add(new THREE.SphereGeometry(0.28, 8, 6).scale(1.5, 0.8, 1), M.canvas, '#4f4c3a', -1.15, ty + 0.62, tz - 2.85);
	}
	if (lo) B.box(M.canvas, '#6a6449', 2.6, 0.42, 0.42, 0, ty + 0.48, tz - 2.85);
	for (const s of [-1, 1]) B.box(M.camo, '#ececE6', 0.36, 0.42, 1.3, s * 1.86, ty + 0.4, tz - 1.0);
	// aerials, a wind sensor, lifting eyes
	for (const s of [-1, 1]) { B.cyl(M.dark, DARK, 0.05, 0.06, 0.1, s * 1.3, ty + 0.9, tz - 2.2, 8); B.cyl(M.dark, '#1a1a1a', 0.008, 0.012, 2.6, s * 1.3, ty + 2.2, tz - 2.2, 4); }
	if (!lo) { B.cyl(M.dark, DARK, 0.015, 0.015, 0.6, -1.1, ty + 1.15, tz - 1.6, 4); B.box(M.dark, DARK, 0.06, 0.06, 0.06, -1.1, ty + 1.46, tz - 1.6); for (const [x, z] of [[1.3, 1.0], [-1.3, 1.0], [1.2, -2.2], [-1.2, -2.0]]) B.add(new THREE.TorusGeometry(0.06, 0.018, 5, 8), M.dark, DARK, x, ty + 0.9, tz + z, 0, 0, H); }

	// ---------- the gun: sleeve sections, fume extractor, muzzle reference, muzzle ----------
	B.part('gun');
	const gy = TK.gun[1], gz = TK.gun[2], L = 5.4;
	B.cz(M.camo, WHITE, 0.16, 0.17, 0.5, 0, gy, gz + 0.55, 18);
	const secs = lo ? [[0.8, L, 0.13, 0.105]] : [[0.8, 2.1, 0.135, 0.128], [2.12, 2.6, 0.13, 0.126], [3.45, 4.5, 0.122, 0.115], [4.52, 5.2, 0.115, 0.11]];
	for (const [a, b, r0, r1] of secs) B.cz(M.camo, WHITE, r0, r1, b - a, 0, gy, gz + (a + b) / 2, 18);
	if (!lo) for (const z of [2.11, 3.44, 4.51]) B.cz(M.dark, DARK, 0.142, 0.142, 0.05, 0, gy, gz + z, 18);
	B.cz(M.camo, '#f0f0ea', 0.2, 0.2, 0.84, 0, gy, gz + 3.03, 18);
	if (!lo) { B.cz(M.camo, '#e6e6e0', 0.2, 0.15, 0.1, 0, gy, gz + 2.56, 18); B.cz(M.camo, '#e6e6e0', 0.15, 0.2, 0.1, 0, gy, gz + 3.5, 18); }
	B.cz(M.dark, GUN, 0.13, 0.13, 0.22, 0, gy, gz + L - 0.08, 18);
	if (!lo) { B.cz(M.dark, '#111', 0.09, 0.09, 0.03, 0, gy, gz + L + 0.04, 12); B.box(M.dark, DARK, 0.08, 0.08, 0.14, 0, gy + 0.17, gz + L - 0.25); }
	// the coaxial gun beside it
	if (!lo) B.cz(M.dark, GUN, 0.03, 0.03, 0.5, 0.3, gy - 0.02, gz + 0.45, 6);
}

// ---------- the wheeled vehicles ----------
// wheel arches: a flared lip round each wheel, at x (the outer face), over a wheel at z
function arch(B, mtl, x, s, z, y, r, w, n = 9) {
	const k = B.lo ? 4 : n;
	for (let i = 0; i < k; i++) {
		const a0 = PI * 0.08 + (i / k) * PI * 0.84, a1 = PI * 0.08 + ((i + 1) / k) * PI * 0.84, am = (a0 + a1) / 2;
		const len = r * (a1 - a0) + 0.02;
		B.box(mtl, WHITE, w, 0.06, len, x, y + Math.sin(am) * r, z + Math.cos(am) * r, 0, -(am - H));
	}
	if (!B.lo) B.box(M.rubber, TYRE, 0.02, 0.4, r * 1.1, x - s * 0.01, y - 0.05, z - r - 0.05);
}
function apc(B) {
	const D = DIMS.apc, lo = B.lo;
	B.part('body');
	// the hull: a V underneath, the sides angled, the roof flat; the nose raked
	const sec = (z, k = 1, roof = 2.35) => [[0, 0.62 + (1 - k) * 0.3, z], [0.95 * k, 0.82, z], [1.34 * k, 1.3, z], [1.14 * k, roof, z], [-1.14 * k, roof, z], [-1.34 * k, 1.3, z], [-0.95 * k, 0.82, z]];
	B.add(loft([sec(3.62, 0.86, 1.25), sec(3.2, 0.96, 1.85), sec(2.35, 1, 2.3), sec(-3.5, 1, 2.35), sec(-3.62, 0.96, 2.3)], { flat: true }), M.camo, WHITE);
	// the armoured windscreen and its frame, the bull bar
	B.box(M.glass, '#26363c', 1.7, 0.42, 0.04, 0, 2.02, 2.8, 0, -0.62);
	B.box(M.camo, WHITE, 0.08, 0.5, 0.08, 0, 2.02, 2.82, 0, -0.62);
	for (const s of [-1, 1]) { B.box(M.glass, '#26363c', 0.04, 0.36, 0.6, s * 1.22, 1.95, 2.25, 0, 0, s * 0.18); }
	const bb = (x) => [x, 0.75, 3.75];
	if (!lo) { B.tube(M.dark, '#2e3133', [[-1.05, 0.65, 3.55], [-1.05, 1.2, 3.82], [1.05, 1.2, 3.82], [1.05, 0.65, 3.55]], 0.05, 6); B.tube(M.dark, '#2e3133', [bb(-0.9), bb(0.9)], 0.045, 6); B.tube(M.dark, '#2e3133', [[-0.5, 0.7, 3.7], [-0.5, 1.2, 3.82]], 0.04, 6); B.tube(M.dark, '#2e3133', [[0.5, 0.7, 3.7], [0.5, 1.2, 3.82]], 0.04, 6); }
	else B.box(M.dark, '#2e3133', 2.1, 0.5, 0.08, 0, 0.95, 3.78);
	// lights in guards, indicators, the convoy light at the back
	for (const s of [-1, 1]) {
		B.box(M.lamp, LIGHT, 0.2, 0.14, 0.05, s * 0.85, 1.32, 3.56, 0, -0.5);
		if (!lo) { B.box(M.lamp, '#ffb35a', 0.08, 0.06, 0.04, s * 1.12, 1.3, 3.5, 0, -0.5); B.tube(M.dark, DARK, [[s * 0.72, 1.22, 3.66], [s * 0.72, 1.44, 3.6], [s * 0.98, 1.44, 3.6], [s * 0.98, 1.22, 3.66]], 0.015, 4); B.box(M.lamp, '#ff3a2a', 0.1, 0.12, 0.04, s * 1.05, 1.5, -3.63); }
	}
	// wheels' arches, side doors with their vision blocks, steps, storage
	for (const s of [-1, 1]) {
		for (const z of [2.4, 0.6, -2.3]) arch(B, M.camo, s * 1.3, s, z, 0.62, 0.74, 0.32);
		for (let i = 0; i < 3; i++) B.box(M.glass, '#26363c', 0.04, 0.2, 0.32, s * 1.255, 1.85, 1.3 - i * 1.15, 0, 0, s * 0.18);
		B.box(M.camo, '#e6e6e0', 0.04, 0.9, 1.0, s * 1.34, 1.5, -0.85, 0, 0, s * 0.03);
		if (!lo) { B.box(M.dark, DARK, 0.06, 0.06, 0.2, s * 1.38, 1.5, -0.5); B.box(M.dark, DARK, 0.3, 0.04, 0.55, s * 1.25, 0.72, -0.85); B.box(M.camo, '#d8d8d0', 0.3, 0.5, 1.6, s * 1.25, 1.75, -2.6, 0, 0, s * 0.18); }
	}
	// the rear door with a spare wheel and jerry cans
	B.box(M.camo, '#e4e4de', 1.6, 1.2, 0.06, 0, 1.55, -3.64);
	if (!lo) for (let i = 0; i < 2; i++) B.box(M.camo, '#7c7f5c', 0.18, 0.45, 0.32, 0.9 + i * 0.2, 1.4, -3.75);
	// the roof: hatches, the gun ring with its shield and machine gun, smoke dischargers, aerials
	B.cyl(M.camo, WHITE, 0.62, 0.66, 0.12, 0.1, 2.41, -0.4, 22);
	if (!lo) B.add(new THREE.TorusGeometry(0.6, 0.05, 6, 22).rotateX(H), M.dark, DARK, 0.1, 2.5, -0.4);
	B.box(M.camo, '#ececE6', 1.0, 0.5, 0.06, 0.1, 2.75, 0.2, 0, -0.1);
	for (const s of [-1, 1]) B.box(M.camo, '#ececE6', 0.06, 0.45, 0.5, 0.1 + s * 0.5, 2.72, 0.0, s * 0.35);
	B.box(M.dark, GUN, 0.14, 0.18, 0.85, 0.1, 2.82, 0.0);
	B.cz(M.dark, GUN, 0.035, 0.035, 0.9, 0.1, 2.84, 0.85, 6);
	if (!lo) { B.box(M.dark, '#3a4033', 0.14, 0.18, 0.2, 0.25, 2.74, -0.05); B.cyl(M.camo, WHITE, 0.32, 0.32, 0.05, -0.55, 2.38, -2.2, 14); B.cyl(M.camo, WHITE, 0.32, 0.32, 0.05, 0.6, 2.38, -2.2, 14); }
	for (const s of [-1, 1]) for (let i = 0; i < (lo ? 1 : 3); i++) B.cyl(M.dark, '#3c4036', 0.05, 0.05, 0.28, s * 1.0, 2.45 + i * 0.03, 2.1 - i * 0.12, 8, -0.7, -s * 0.5);
	for (const s of [-1, 1]) B.cyl(M.dark, '#1a1a1a', 0.008, 0.012, 2.3, s * 1.0, 3.5, -3.2, 4);
	B.part('wheel'); wheel(B, D.wr, 0.44);
}
function jeep(B) {
	const D = DIMS.jeep, lo = B.lo;
	B.part('body');
	// the tub and the bonnet: sections from the grille back
	const sec = (z, yb, yt, w, wt) => [[-w, yb, z], [w, yb, z], [wt, yt, z], [-wt, yt, z]];
	B.add(loft([sec(2.28, 0.62, 1.12, 0.92, 0.84), sec(2.1, 0.58, 1.2, 0.95, 0.88), sec(0.75, 0.58, 1.25, 0.98, 0.9), sec(0.62, 0.58, 1.02, 0.98, 0.95), sec(-2.2, 0.62, 1.05, 0.98, 0.95), sec(-2.3, 0.68, 1.02, 0.96, 0.93)], { flat: true }), M.camo, WHITE);
	// a seat well cut in (dark floor), the grille, lights, mirrors
	B.box(M.dark, '#2b2d2b', 1.7, 0.04, 2.6, 0, 1.05, -0.75);
	if (!lo) for (let i = 0; i < 7; i++) B.box(M.dark, '#1d1f1f', 0.06, 0.32, 0.03, -0.36 + i * 0.12, 0.88, 2.3);
	for (const s of [-1, 1]) {
		B.cz(M.lamp, LIGHT, 0.09, 0.09, 0.05, s * 0.66, 0.98, 2.3, 12);
		if (!lo) { B.cz(M.dark, DARK, 0.11, 0.11, 0.04, s * 0.66, 0.98, 2.28, 12); B.box(M.lamp, '#ff3a2a', 0.08, 0.1, 0.03, s * 0.86, 0.95, -2.32); B.box(M.dark, DARK, 0.03, 0.14, 0.2, s * 1.02, 1.42, 0.62); }
		// the arches, flared out over the wheels
		for (const z of [D.wz, -D.wz]) arch(B, M.camo, s * 0.98, s, z, 0.45, 0.55, 0.3);
		B.box(M.dark, '#2b2d2b', 0.25, 0.04, 1.6, s * 0.95, 0.6, 0);
	}
	// the bull bar and winch
	if (!lo) { B.tube(M.dark, '#262829', [[-0.85, 0.5, 2.38], [-0.85, 1.02, 2.5], [0.85, 1.02, 2.5], [0.85, 0.5, 2.38]], 0.04, 6); B.tube(M.dark, '#262829', [[-0.85, 0.7, 2.47], [0.85, 0.7, 2.47]], 0.035, 6); B.box(M.dark, DARK, 0.5, 0.18, 0.18, 0, 0.62, 2.4); }
	// the windscreen frame and glass, folded up
	B.box(M.dark, DARK, D.W - 0.35, 0.05, 0.05, 0, 1.72, 0.62, 0, -0.15);
	for (const s of [-1, 1]) B.box(M.dark, DARK, 0.05, 0.5, 0.05, s * 0.85, 1.47, 0.66, 0, -0.15);
	B.box(M.glass, '#26363c', D.W - 0.45, 0.42, 0.02, 0, 1.47, 0.65, 0, -0.15);
	// the roll cage carrying a gun ring, seats, a spare wheel and cans at the back, aerial
	const c = (x, y, z) => [x, y, z];
	for (const s of [-1, 1]) B.tube(M.dark, '#2e3133', [c(s * 0.88, 1.02, 0.3), c(s * 0.82, 2.02, -0.3), c(s * 0.82, 2.02, -1.7), c(s * 0.88, 1.02, -2.1)], 0.04, 6);
	B.tube(M.dark, '#2e3133', [c(-0.82, 2.02, -0.3), c(0.82, 2.02, -0.3)], 0.04, 6);
	B.tube(M.dark, '#2e3133', [c(-0.82, 2.02, -1.7), c(0.82, 2.02, -1.7)], 0.04, 6);
	B.add(new THREE.TorusGeometry(0.48, 0.04, 6, B.seg(20)).rotateX(H), M.dark, DARK, 0, 2.04, -1.0);
	B.box(M.camo, '#ececE6', 0.6, 0.32, 0.04, 0, 2.28, -0.55, 0, -0.1);
	B.box(M.dark, GUN, 0.12, 0.16, 0.75, 0, 2.2, -0.85);
	B.cz(M.dark, GUN, 0.03, 0.03, 0.8, 0, 2.22, -0.1, 6);
	for (const s of [-1, 1]) { B.box(M.canvas, '#42433a', 0.5, 0.12, 0.5, s * 0.42, 1.12, -0.1); B.box(M.canvas, '#42433a', 0.5, 0.55, 0.1, s * 0.42, 1.4, -0.38); }
	B.add(new THREE.CylinderGeometry(D.wr, D.wr, 0.28, B.seg(16)).rotateX(H), M.rubber, TYRE, 0, 1.2, -2.42);
	if (!lo) { for (let i = 0; i < 2; i++) B.box(M.camo, '#7c7f5c', 0.17, 0.42, 0.3, 0.6 + i * 0.19 - 1.4, 1.25, -2.38); B.cyl(M.dark, '#1a1a1a', 0.008, 0.012, 2.4, 0.8, 2.4, -2.0, 4); }
	B.part('wheel'); wheel(B, D.wr, 0.3);
}
function truck(B) {
	const D = DIMS.truck, lo = B.lo;
	B.part('body');
	// the cab with its bonnet, the bed, the canvas cover on hoops
	B.add(loft([[[-1.2, 0.8, 4.1], [1.2, 0.8, 4.1], [1.15, 1.6, 4.05], [-1.15, 1.6, 4.05]], [[-1.22, 0.8, 3.25], [1.22, 0.8, 3.25], [1.2, 1.72, 3.25], [-1.2, 1.72, 3.25]]], { flat: true }), M.camo, WHITE);
	B.add(loft([[[-1.24, 0.8, 3.25], [1.24, 0.8, 3.25], [1.22, 2.85, 2.98], [-1.22, 2.85, 2.98]], [[-1.24, 0.8, 1.8], [1.24, 0.8, 1.8], [1.24, 2.9, 1.8], [-1.24, 2.9, 1.8]]], { flat: true }), M.camo, WHITE);
	B.box(M.glass, '#26363c', D.W - 0.4, 0.62, 0.04, 0, 2.38, 3.12, 0, 0.2);
	for (const s of [-1, 1]) { B.box(M.glass, '#26363c', 0.04, 0.55, 0.8, s * 1.25, 2.4, 2.35); B.cyl(M.dark, DARK, 0.07, 0.07, 1.4, s * 1.32, 2.3, 1.95, 8); B.box(M.dark, DARK, 0.04, 0.3, 0.2, s * 1.42, 2.55, 3.0); }
	B.box(M.camo, WHITE, D.W, 0.12, 5.6, 0, 1.1, -1.1);
	for (const s of [-1, 1]) B.box(M.camo, WHITE, 0.06, 0.6, 5.6, s * (D.W / 2 - 0.03), 1.45, -1.1);
	const cover = new THREE.CylinderGeometry(D.W / 2, D.W / 2, 5.5, B.seg(16), 1, false, -H, PI); cover.rotateX(-H).scale(1, 0.45, 1);
	B.add(cover, M.canvas, '#6e6a4c', 0, 2.72, -1.1);
	B.box(M.canvas, '#6e6a4c', D.W, 1.55, 5.5, 0, 1.95, -1.1);
	if (!lo) for (let i = 0; i < 5; i++) B.box(M.canvas, '#5e5a40', D.W + 0.02, 0.06, 0.08, 0, 2.2 + 0.0, -3.6 + i * 1.25);
	for (const s of [-1, 1]) {
		for (const z of [3.0, -1.4, -2.8]) arch(B, M.camo, s * 1.25, s, z, 0.56, 0.68, 0.3, 7);
		B.box(M.lamp, LIGHT, 0.2, 0.14, 0.05, s * 0.85, 1.25, 4.12);
		if (!lo) B.box(M.lamp, '#ff3a2a', 0.1, 0.12, 0.04, s * 1.0, 1.0, -3.92);
	}
	if (!lo) { B.tube(M.dark, '#262829', [[-1.1, 0.6, 4.2], [-1.1, 1.3, 4.3], [1.1, 1.3, 4.3], [1.1, 0.6, 4.2]], 0.05, 6); for (let i = 0; i < 9; i++) B.box(M.dark, '#1d1f1f', 0.06, 0.55, 0.03, -0.5 + i * 0.125, 1.2, 4.12); }
	B.part('wheel'); wheel(B, D.wr, 0.4);
}

// ---------- the jet ----------
const JT = { y: 2.1, gearN: [0, 1.48, 4.7], gearL: [1.3, 1.55, -1.3], gearR: [-1.3, 1.55, -1.3] };
function jet(B) {
	const lo = B.lo, y = JT.y, n = B.seg(22);
	B.part('body');
	// the fuselage: from the radome through the cockpit, out to the chines and intakes, the engines' bay
	const st = [[8.3, 0.02, 0.02, 0.02, 2], [7.7, 0.24, 0.24, 0.22, 2], [6.8, 0.46, 0.46, 0.4, 2.1], [5.8, 0.64, 0.62, 0.52, 2.2], [4.6, 0.82, 0.76, 0.6, 2.5], [3.4, 1.0, 0.84, 0.66, 3], [2.2, 1.35, 0.82, 0.72, 3.6], [0.6, 1.55, 0.74, 0.78, 3.8], [-2.0, 1.58, 0.7, 0.8, 3.8], [-4.6, 1.52, 0.66, 0.74, 3.5], [-6.4, 1.38, 0.6, 0.66, 3.2], [-7.2, 1.25, 0.56, 0.6, 3]];
	B.add(loft(st.map(([z, w, ht, hb, e]) => sring(z, y, w, ht, hb, n, e))), M.paint, WHITE);
	// the spine behind the canopy, sloping down to the tail
	B.add(loft([sring(2.6, y + 0.55, 0.42, 0.35, 0.05, B.seg(12), 2.2), sring(0, y + 0.6, 0.48, 0.32, 0.05, B.seg(12), 2.2), sring(-4.5, y + 0.55, 0.42, 0.18, 0.05, B.seg(12), 2.2), sring(-6.6, y + 0.55, 0.3, 0.05, 0.05, B.seg(12), 2.2)]), M.paint, WHITE);
	// the canopy: a bubble of glass on a frame, the bow and the sill rails
	const can = [[5.3, 0.05, 0.05], [4.9, 0.36, 0.3], [4.2, 0.5, 0.52], [3.3, 0.52, 0.6], [2.4, 0.46, 0.52], [1.6, 0.34, 0.36], [1.0, 0.1, 0.1]];
	B.add(loft(can.map(([z, w, h]) => sring(z, y + 0.62, w, h, 0.02, B.seg(18), 2.1))), M.glass, '#2d3d44');
	B.add(loft([sring(3.98, y + 0.62, 0.53, 0.58, 0.02, B.seg(18), 2.1), sring(3.86, y + 0.62, 0.54, 0.6, 0.02, B.seg(18), 2.1)], { caps: false }), M.paint, '#cfd2d4');
	for (const s of [-1, 1]) B.tube(M.paint, '#cfd2d4', [[s * 0.36, y + 0.64, 4.9], [s * 0.5, y + 0.64, 4.0], [s * 0.5, y + 0.64, 2.6], [s * 0.34, y + 0.64, 1.6]], 0.03, 4);
	if (!lo) { B.box(M.dark, '#222', 0.5, 0.25, 0.1, 0, y + 0.85, 4.3, 0, -0.5); B.box(M.dark, '#3a3a3a', 0.4, 0.5, 0.5, 0, y + 0.85, 3.4); }
	// the intakes: raked mouths under the chines, ducts fairing into the body
	for (const s of [-1, 1]) {
		const ix = s * 1.18;
		B.add(loft([sring(3.0, y - 0.32, 0.36, 0.42, 0.4, B.seg(12), 4, ix), sring(2.0, y - 0.3, 0.42, 0.46, 0.44, B.seg(12), 4, ix), sring(-1.6, y - 0.2, 0.32, 0.4, 0.4, B.seg(12), 4, s * 0.9)]), M.paint, WHITE);
		B.add(new THREE.PlaneGeometry(0.62, 0.72), M.dark, '#141516', ix, y - 0.32, 3.02);
		if (!lo) B.add(loft([sring(3.06, y - 0.32, 0.37, 0.43, 0.41, B.seg(12), 4, ix), sring(2.98, y - 0.32, 0.31, 0.37, 0.35, B.seg(12), 4, ix)], { caps: false }), M.paint, '#b9bdc0');
	}
	// the wing: swept leading edge, straight trailing edge (the flaps and ailerons hang there)
	const wy = y - 0.12;
	for (const s of [-1, 1]) {
		B.add(panel([s * 1.3, wy, 1.8], [s * 1.3, wy, -3.95], 0.26, [s * 5.25, wy - 0.12, -2.55], [s * 5.25, wy - 0.12, -3.95], 0.07), M.paint, WHITE);
		// a leading edge root extension blending the wing into the chine
		B.add(panel([s * 1.0, wy + 0.15, 3.4], [s * 1.0, wy + 0.05, 0.4], 0.12, [s * 1.6, wy, 1.2], [s * 1.6, wy, 0.5], 0.08), M.paint, WHITE);
		// wingtip rails with missiles, a pylon and a tank under each wing
		B.box(M.paint, '#dfe2e4', 0.08, 0.1, 2.0, s * 5.3, wy - 0.12, -3.1);
		B.cz(M.paint, '#e9e9e4', 0.08, 0.08, 2.6, s * 5.38, wy - 0.12, -2.6, 10);
		B.cz(M.paint, '#e9e9e4', 0.0, 0.08, 0.35, s * 5.38, wy - 0.12, -1.13, 10);
		if (!lo) for (let f = 0; f < 4; f++) B.box(M.paint, '#d2d5d7', 0.01, 0.2, 0.25, s * 5.38, wy - 0.12, -3.7, 0, 0, f * PI / 4);
		B.box(M.paint, '#d8dbdd', 0.08, 0.32, 1.2, s * 2.9, wy - 0.3, -1.4);
		B.add(loft([sring(0.6, wy - 0.65, 0.01, 0.01, 0.01, 10, 2, s * 2.9), sring(0.0, wy - 0.65, 0.24, 0.24, 0.24, 10, 2, s * 2.9), sring(-2.3, wy - 0.65, 0.24, 0.24, 0.24, 10, 2, s * 2.9), sring(-2.9, wy - 0.65, 0.05, 0.05, 0.05, 10, 2, s * 2.9)]), M.paint, '#cfd2d4');
		// nav lights on the tips
		B.box(M.beacon, s > 0 ? RED : GREEN, 0.06, 0.06, 0.12, s * 5.27, wy - 0.12, -2.45);
	}
	// the fins: twin, canted out, the rudders on their trailing edges (parts of their own)
	for (const s of [-1, 1]) {
		const g = panel([0, 0, -4.3], [0, 0, -6.75], 0.16, [0, 2.6, -6.6], [0, 2.6, -7.35], 0.06, [1, 0, 0]);
		B.add(g, M.paint, WHITE, s * 1.02, y + 0.45, 0, 0, 0, -s * 0.36);
		B.add(new THREE.BoxGeometry(0.1, 0.12, 0.3), M.beacon, '#ffffff', s * (1.02 + Math.sin(0.36) * 2.6), y + 0.45 + 2.62 * Math.cos(0.36), -7.1);
	}
	// the engines: twin nozzles with their petals, the hot metal inside
	for (const s of [-1, 1]) {
		const x = s * 0.6;
		B.add(loft([sring(-6.6, y - 0.05, 0.58, 0.58, 0.58, n, 2, x), sring(-7.5, y - 0.05, 0.56, 0.56, 0.56, n, 2, x)]), M.paint, '#a7abae');
		B.lathe(M.dark, '#55514c', [[0.56, 0], [0.5, -0.5], [0.46, -0.9], [0.44, -0.92], [0.4, -0.5], [0.3, -0.1]], 20, x, y - 0.05, -7.5, H);
		B.lathe(M.hot, '#6b5a4a', [[0.36, -0.2], [0.34, -0.7], [0.25, -0.75], [0.0, -0.76]], 16, x, y - 0.05, -7.5, H);
	}
	// the gun port, an aerial, a beacon on the spine
	if (!lo) { B.box(M.dark, '#151515', 0.12, 0.08, 0.5, 0.75, y + 0.45, 4.0); B.box(M.paint, '#c9ccce', 0.04, 0.35, 0.3, 0, y + 0.95, -1.8, 0, -0.5); }
	B.box(M.beacon, RED, 0.12, 0.06, 0.12, 0, y - 0.82, -0.5);
	// the gear bays under the body (dark when the doors are open)
	B.box(M.dark, '#2a2c2e', 0.42, 0.04, 1.4, 0, y - 0.66, 4.3);
	for (const s of [-1, 1]) B.box(M.dark, '#2a2c2e', 0.75, 0.04, 1.3, s * 0.85, y - 0.74, -1.3);

	// the moving surfaces, each on its hinge: flaps and ailerons, tailplanes, rudders
	for (const s of [-1, 1]) {
		const side = s < 0 ? 'R' : 'L';
		B.part('flap' + side); B.add(panel([s * 1.4, 0, 0], [s * 1.4, 0, -0.62], 0.1, [s * 3.15, 0, 0], [s * 3.15, 0, -0.62], 0.07), M.paint, '#f4f4f4');
		B.part('ail' + side); B.add(panel([s * 3.25, 0, 0], [s * 3.25, 0, -0.62], 0.07, [s * 5.05, 0, 0], [s * 5.05, 0, -0.55], 0.05), M.paint, '#f4f4f4');
		B.part('tail' + side); B.add(panel([s * 0.9, 0, 0.9], [s * 0.9, 0, -1.4], 0.12, [s * 3.5, 0, -0.5], [s * 3.5, 0, -1.25], 0.05), M.paint, WHITE);
		B.part('rud' + side); B.add(panel([0, 0, 0], [0, 0, -0.58], 0.07, [0, 2.45, 0], [0, 2.45, -0.5], 0.04, [1, 0, 0]), M.paint, '#f4f4f4');
	}
	// the gear: legs, oleos, wheels, their doors
	B.part('gearN');
	B.cyl(M.steel, '#b9bdc0', 0.07, 0.07, 1.0, 0, -0.5, 0, 10);
	B.cyl(M.steel, '#d9dcde', 0.05, 0.05, 0.5, 0, -1.0, 0, 8);
	B.cx(M.rubber, TYRE, 0.3, 0.22, 0, -1.18, 0.05, 16); B.cx(M.steel, STEEL, 0.17, 0.24, 0, -1.18, 0.05, 10);
	if (!lo) { B.box(M.lamp, LIGHT, 0.1, 0.08, 0.06, 0, -0.55, 0.12); B.box(M.dark, DARK, 0.04, 0.5, 0.06, 0.1, -0.7, -0.15, 0, 0.6); }
	for (const s of [-1, 1]) {
		const side = s < 0 ? 'R' : 'L';
		B.part('gear' + side);
		B.cyl(M.steel, '#b9bdc0', 0.09, 0.09, 1.0, 0, -0.5, 0, 10);
		B.cyl(M.steel, '#d9dcde', 0.065, 0.065, 0.45, 0, -1.0, 0, 8);
		B.cx(M.rubber, TYRE, 0.37, 0.26, s * 0.12, -1.19, 0, 18); B.cx(M.steel, STEEL, 0.22, 0.28, s * 0.12, -1.19, 0, 12);
		if (!lo) B.tube(M.dark, DARK, [[0, -0.3, 0], [-s * 0.45, 0, 0.1]], 0.03, 5);
		B.box(M.paint, '#e9ebec', 0.04, 0.85, 1.2, s * 0.14, -0.45, 0);
		B.part('door' + side); B.box(M.paint, WHITE, 0.7, 0.03, 1.25, -s * 0.35, 0, 0);
	}
	B.part('doorN'); for (const s of [-1, 1]) B.box(M.paint, WHITE, 0.21, 0.03, 1.3, s * 0.11, 0, 0);
}
// each moving part's hinge: where it is and which way it turns (axis in the body)
const JET_PIVOTS = {
	flapL: [0, JT.y - 0.12, -3.95], flapR: [0, JT.y - 0.12, -3.95], ailL: [0, JT.y - 0.2, -3.95], ailR: [0, JT.y - 0.2, -3.95],
	tailL: [0, JT.y - 0.02, -6.3], tailR: [0, JT.y - 0.02, -6.3], rudL: [1.02, JT.y + 0.45, -6.75], rudR: [-1.02, JT.y + 0.45, -6.75],
	gearN: JT.gearN, gearL: JT.gearL, gearR: JT.gearR, doorL: [1.2, JT.y - 0.75, -1.3], doorR: [-1.2, JT.y - 0.75, -1.3], doorN: [0, JT.y - 0.68, 4.3],
};
// (the parts are built at their hinges already, but for the rudders, built upright at the origin)
const BUILT_AT_HINGE = new Set(['flapL', 'flapR', 'ailL', 'ailR', 'tailL', 'tailR', 'rudL', 'rudR', 'gearN', 'gearL', 'gearR', 'doorL', 'doorR', 'doorN']);

// ---------- the helicopter ----------
const HL = { rotor: [0, 3.95, -0.35], tail: [0.32, 3.15, -8.95] };
function heli(B) {
	const lo = B.lo, n = B.seg(20);
	B.part('body');
	// the cabin and nose; the boom tapering to the fin
	const st = [[3.1, 0.05, 0.05, 0.05, 2.2, 1.35], [2.85, 0.55, 0.4, 0.4, 2.2, 1.3], [2.3, 0.95, 0.75, 0.6, 2.6, 1.45], [1.3, 1.25, 1.05, 0.72, 3.2, 1.6], [0.0, 1.32, 1.2, 0.8, 3.6, 1.7], [-1.6, 1.3, 1.15, 0.8, 3.6, 1.75], [-2.6, 1.0, 0.95, 0.6, 3, 1.95], [-3.4, 0.55, 0.5, 0.35, 2.4, 2.25]];
	B.add(loft(st.map(([z, w, ht, hb, e, cy]) => sring(z, cy, w, ht, hb, n, e))), M.paint, WHITE);
	B.add(loft([sring(-3.3, 2.25, 0.52, 0.48, 0.34, B.seg(14), 2.3), sring(-6.0, 2.42, 0.32, 0.3, 0.22, B.seg(14), 2.2), sring(-8.6, 2.6, 0.2, 0.2, 0.15, B.seg(14), 2)]), M.paint, WHITE);
	// the cockpit glazing over the nose, the cabin windows
	const gl = [[2.95, 0.3, 0.3], [2.6, 0.82, 0.62], [1.95, 1.12, 0.92], [1.25, 1.27, 1.06]];
	B.add(loft(gl.map(([z, w, h]) => sring(z, 1.42, w + 0.02, h + 0.02, 0.05, B.seg(18), 2.6)), { caps: false }), M.glass, '#2d3d44');
	if (!lo) for (const s of [-1, 1]) { B.box(M.paint, '#d4d7d9', 0.06, 1.0, 0.07, s * 1.15, 2.1, 1.28, 0, 0, s * 0.28); }
	for (const s of [-1, 1]) B.box(M.glass, '#2d3d44', 0.04, 0.5, 0.7, s * 1.31, 2.15, -1.9, 0, 0, s * 0.1);
	// the side doors slid back, the door gunners' mounts and guns
	for (const s of [-1, 1]) {
		B.box(M.dark, '#202224', 0.04, 1.45, 1.6, s * 1.3, 1.65, -0.35);
		B.box(M.paint, '#eceeef', 0.06, 1.4, 1.5, s * 1.36, 1.68, -1.75);
		if (!lo) {
			B.tube(M.dark, DARK, [[s * 1.0, 0.95, 0.15], [s * 1.25, 1.6, 0.25]], 0.03, 5);
			B.box(M.dark, GUN, 0.12, 0.18, 0.7, s * 1.4, 1.7, 0.35, s * 0.6);
			B.cz(M.dark, GUN, 0.025, 0.025, 0.7, s * 1.4 + s * Math.sin(0.6) * 0.5, 1.72, 0.35 + Math.cos(0.6) * 0.5, 6);
			B.box(M.dark, '#3a4033', 0.12, 0.2, 0.2, s * 1.32, 1.6, 0.25);
			B.box(M.canvas, '#41443a', 0.45, 0.1, 0.45, s * 0.85, 1.0, 0.0);
		}
	}
	// the engines and their cowlings, exhausts, the rotor mast fairing
	B.add(loft([sring(1.0, 2.82, 0.62, 0.05, 0.05, B.seg(12), 2.4), sring(0.6, 2.95, 0.72, 0.32, 0.05, B.seg(12), 2.6), sring(-1.6, 2.98, 0.75, 0.38, 0.05, B.seg(12), 2.8), sring(-2.6, 2.7, 0.5, 0.2, 0.05, B.seg(12), 2.4)]), M.paint, '#f2f2f2');
	for (const s of [-1, 1]) { B.cz(M.dark, '#2f2c28', 0.18, 0.2, 0.5, s * 0.55, 3.08, -2.55, 12); B.cz(M.hot, '#3a3028', 0.13, 0.13, 0.05, s * 0.55, 3.08, -2.81, 10); if (!lo) for (let i = 0; i < 5; i++) B.box(M.dark, '#1f2123', 0.02, 0.18, 0.5, s * 0.66, 3.05, -0.1 - i * 0.18, 0, 0, s * 0.4); }
	B.cyl(M.paint, '#e6e6e6', 0.32, 0.42, 0.55, HL.rotor[0], 3.42, HL.rotor[2], 14);
	// the fin, the tail rotor's gearbox, the tailplane, the tail skid
	B.add(panel([0, 2.55, -7.9], [0, 2.55, -9.0], 0.18, [0, 4.0, -8.85], [0, 4.0, -9.45], 0.1, [1, 0, 0]), M.paint, WHITE);
	B.cx(M.paint, '#e6e6e6', 0.16, 0.25, 0.18, HL.tail[1], HL.tail[2], 10);
	for (const s of [-1, 1]) B.add(panel([0, 2.6, -7.6], [0, 2.6, -8.2], 0.08, [s * 1.3, 2.6, -7.8], [s * 1.3, 2.6, -8.2], 0.05), M.paint, WHITE);
	B.tube(M.dark, DARK, [[0, 2.4, -8.4], [0, 2.0, -8.9], [0, 1.95, -9.25]], 0.03, 5);
	// the skids on their cross tubes, steps; stub wings with rocket pods
	for (const s of [-1, 1]) {
		B.tube(M.dark, '#2b2d2f', [[s * 1.3, 0.08, 2.2], [s * 1.3, 0.08, -2.0]], 0.06, 8);
		B.tube(M.dark, '#2b2d2f', [[s * 1.3, 0.08, 2.2], [s * 1.3, 0.28, 2.5]], 0.06, 8);
		for (const z of [1.2, -1.0]) B.tube(M.dark, '#2b2d2f', [[s * 1.3, 0.08, z], [s * 1.2, 0.5, z], [s * 0.6, 0.85, z]], 0.05, 6);
		B.add(panel([s * 1.25, 1.35, 0.6], [s * 1.25, 1.35, -0.6], 0.14, [s * 2.4, 1.3, 0.35], [s * 2.4, 1.3, -0.45], 0.1), M.paint, '#f2f2f2');
		B.cz(M.dark, '#4a4c46', 0.22, 0.22, 1.5, s * 2.15, 1.05, 0.0, 12);
		B.cz(M.dark, '#4a4c46', 0.22, 0.12, 0.3, s * 2.15, 1.05, 0.9, 12);
		if (!lo) { B.cz(M.dark, '#111', 0.2, 0.2, 0.02, s * 2.15, 1.05, -0.76, 12); B.box(M.dark, DARK, 0.06, 0.25, 0.5, s * 2.15, 1.22, 0.0); }
	}
	// the chin sensor ball, the nose gun, lights, the beacon, aerials
	B.add(new THREE.SphereGeometry(0.3, B.seg(14), B.seg(10)), M.dark, '#2a2c2e', 0, 0.82, 2.25);
	B.box(M.glass, '#1d2a30', 0.22, 0.18, 0.05, 0, 0.82, 2.53);
	B.box(M.lamp, LIGHT, 0.16, 0.1, 0.08, 0, 1.0, 2.75, 0, 0.4);
	B.box(M.beacon, RED, 0.12, 0.1, 0.12, 0, 3.36, -2.2);
	for (const s of [-1, 1]) B.box(M.beacon, s > 0 ? RED : GREEN, 0.08, 0.08, 0.1, s * 2.42, 1.3, -0.05);
	if (!lo) { B.cyl(M.dark, '#1a1a1a', 0.01, 0.01, 0.9, 0, 0.35, -3.0, 4, 0.3); B.box(M.dark, '#1a1a1a', 0.02, 0.4, 0.3, 0, 3.45, -5.5, 0, -0.6); }

	// the main rotor: hub, blade grips, four blades with a little droop
	B.part('rotor').at(...HL.rotor);
	B.cyl(M.dark, '#2e3033', 0.28, 0.22, 0.45, 0, 0, 0, 14);
	B.cyl(M.dark, '#2e3033', 0.1, 0.1, 0.4, 0, -0.35, 0, 8);
	for (let i = 0; i < 4; i++) {
		const a = i * H, c = Math.cos(a), s = Math.sin(a);
		B.box(M.dark, '#3a3c3f', 0.18, 0.12, 0.5, s * 0.45, 0.05, c * 0.45, a);
		// (each blade built as a span along x, then turned to its place)
		B.add(panel([0.6, 0.06, 0.21], [0.6, 0.06, -0.21], 0.08, [7.4, -0.12, 0.17], [7.4, -0.12, -0.19], 0.04), M.dark, '#2b2d30', 0, 0, 0, a - H);
	}
	// the tail rotor: hub and two blades (spinning about x)
	B.part('tail').at(...HL.tail);
	B.cx(M.dark, '#2e3033', 0.1, 0.18, 0, 0, 0, 10);
	for (let i = 0; i < 2; i++) B.add(panel([0, 0.1, 0.07], [0, 0.1, -0.07], 0.05, [0, 1.05, 0.06], [0, 1.05, -0.08], 0.03, [1, 0, 0]), M.dark, '#2b2d30', 0.04, 0, 0, 0, i * PI);
}

const BUILD = { tank, apc, jeep, truck, jet, heli };
const PIVOTS = { tank: { turret: TK.turret, gun: TK.gun }, heli: { rotor: HL.rotor, tail: HL.tail } };
// where each wheel of a wheeled kind is: [x, z]
const WHEELS = {
	apc: [2.4, 0.6, -2.3].flatMap((z) => [[1.16, z], [-1.16, z]]),
	jeep: [DIMS.jeep.wz, -DIMS.jeep.wz].flatMap((z) => [[0.85, z], [-0.85, z]]),
	truck: [3.0, -1.4, -2.8].flatMap((z) => [[1.05, z], [-1.05, z]]),
};
const cache = new Map();
// a kind's geometries: whole (everything at rest, near), far (the coarse one), its moving parts
export function vehicleGeometry(kind) {
	if (cache.has(kind)) return cache.get(kind);
	const make = (lo) => {
		const B = vb(lo);
		BUILD[kind](B);
		// the jet's rudders were built upright at the origin: lean them onto their fins
		const parts = B.done(kind === 'jet' ? {} : PIVOTS[kind] || {});
		if (kind === 'jet') for (const s of ['L', 'R']) {
			const g = parts['rud' + s];
			if (!g) continue;
			const k = s === 'L' ? 1 : -1;
			g.applyMatrix4(rudderBasis(k));
		}
		return parts;
	};
	const near = make(false), far = make(true);
	const out = { kind, parts: near, wheels: WHEELS[kind] || null, pivots: PIVOTS[kind] || (kind === 'jet' ? JET_PIVOTS : {}) };
	// the whole: every part in its rest pose, the wheels on their hubs
	const rest = (parts) => {
		const gs = [];
		for (const [name, g] of Object.entries(parts)) {
			if (name === 'wheel' || (kind === 'jet' && name === 'doorN')) continue;
			const q = g.clone();
			if (kind === 'jet') {
				// (parked, the gear is down and its doors hang open; the nose doors are folded away)
				if (name === 'doorL') q.rotateZ(1.45); else if (name === 'doorR') q.rotateZ(-1.45);
				if (BUILT_AT_HINGE.has(name)) q.translate(...JET_PIVOTS[name]);
			}
			else { const p = out.pivots[name]; if (p) q.translate(p[0], p[1], p[2]); }
			gs.push(q);
		}
		if (parts.wheel && out.wheels) for (const [x, z] of out.wheels) { const q = parts.wheel.clone(); if (x < 0) q.rotateY(PI); q.translate(x, DIMS[kind].wr, z); gs.push(q); }
		const g = mergeGeometries(gs);
		for (const q of gs) q.dispose();
		g.computeBoundingSphere(); g.computeBoundingBox();
		return g;
	};
	out.whole = rest(near);
	out.far = rest(far);
	for (const g of Object.values(far)) g.dispose();
	cache.set(kind, out);
	return out;
}
// the rudder's frame: its hinge up the fin's trailing edge, the fin canted out
function rudderBasis(s) {
	const sweep = Math.atan2(0.6, 2.6);
	return new THREE.Matrix4().makeRotationZ(-s * 0.36).multiply(new THREE.Matrix4().makeRotationX(-sweep));
}
const RUD_Q = { L: new THREE.Quaternion().setFromRotationMatrix(rudderBasis(1)), R: new THREE.Quaternion().setFromRotationMatrix(rudderBasis(-1)) };

// ---------- the vehicle you drive, or a convoy's: a little hierarchy ----------
// root (a LOD: the near hierarchy, the coarse one past LOD_FAR) > turret > gun, tracks; rotor,
// tail, its blur discs; the jet's surfaces, gear and doors, nozzle flames; wheels (instanced)
const _qs = new THREE.Quaternion(), _mx = new THREE.Matrix4(), _qx = new THREE.Quaternion(), _px = new THREE.Vector3(), _sx = new THREE.Vector3(1, 1, 1), _ax = new THREE.Vector3();
function one(geo, material, tint) {
	const m = new THREE.InstancedMesh(geo, material, 1);
	m.setMatrixAt(0, _mx.identity());
	m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array([tint.r, tint.g, tint.b]), 3);
	m.castShadow = true; m.receiveShadow = true;
	m.computeBoundingSphere();
	return m;
}
export function vehicleMesh(kind, kit, colour = SCHEMES.woodland, { phone = false } = {}) {
	const G = vehicleGeometry(kind), root = new THREE.LOD(), near = new THREE.Group();
	root.name = 'mil-' + kind;
	const tint = new THREE.Color(colour), mat = kit.vehicleLit;
	const meshes = [];
	const add = (geo, parent) => { const m = one(geo, mat, tint); parent.add(m); meshes.push(m); return m; };
	const pivot = (name, parent) => { const g = new THREE.Group(); g.name = name; const p = G.pivots[name] || [0, 0, 0]; g.position.set(p[0], p[1], p[2]); parent.add(g); return g; };
	const U = { kind };
	if (kind === 'tank') {
		add(G.parts.hull, near);
		const tl = add(G.parts.trackL, near), tr = add(G.parts.trackR, near);
		const tur = pivot('turret', near), gun = new THREE.Group();
		gun.position.set(G.pivots.gun[0] - G.pivots.turret[0], G.pivots.gun[1] - G.pivots.turret[1], G.pivots.gun[2] - G.pivots.turret[2]);
		tur.add(gun);
		add(G.parts.turret, tur);
		// (the gun's geometry is about its own pivot)
		add(G.parts.gun, gun);
		Object.assign(U, { turret: tur, gun, muzzle: 5.45 });
		// the tracks: the links scroll by how far each side has run (its instance colour carries it)
		const run = [0, 0];
		U.pose = ({ track } = {}) => {
			if (!track) return;
			for (let i = 0; i < 2; i++) { run[i] = (run[i] + track[i]) % 17; const m = i ? tr : tl; m.instanceColor.setX(0, run[i]); m.instanceColor.needsUpdate = true; }
		};
	} else if (kind === 'heli') {
		add(G.parts.body, near);
		const rot = pivot('rotor', near), tail = pivot('tail', near);
		const blades = add(G.parts.rotor, rot), tblades = add(G.parts.tail, tail);
		const disc = new THREE.Mesh(kit.discGeo(7.5), kit.disc); disc.position.y = 0.0; disc.visible = false; rot.add(disc);
		const tdisc = new THREE.Mesh(kit.discGeo(1.08), kit.disc); tdisc.rotation.z = H; tdisc.position.x = 0.05; tdisc.visible = false; tail.add(tdisc);
		Object.assign(U, { rotor: rot, tail });
		U.pose = ({ spin = 1, dt = 0 } = {}) => {
			rot.rotation.y += spin * dt * 28; tail.rotation.x += spin * dt * 60;
			// fast enough, the blades are a blur
			disc.visible = tdisc.visible = spin > 0.55;
			blades.visible = spin < 0.9; tblades.visible = spin < 0.8;
		};
	} else if (kind === 'jet') {
		add(G.parts.body, near);
		const P = {};
		for (const name of Object.keys(JET_PIVOTS)) {
			const g = new THREE.Group(); g.name = name; g.position.set(...JET_PIVOTS[name]);
			if (name.startsWith('rud')) g.quaternion.copy(RUD_Q[name.slice(3)]);
			near.add(g);
			// (the rudders' geometry was leaned onto the fin: undo it inside the hinge's frame)
			const geo = name.startsWith('rud') ? G.parts[name].clone().applyMatrix4(rudderBasis(name === 'rudL' ? 1 : -1).invert()) : G.parts[name];
			add(geo, g);
			P[name] = g;
		}
		// the nozzles' flames: a soft core always lit with the throttle, the afterburner's long flame
		const flames = [];
		for (const s of [-1, 1]) for (const ab of [0, 1]) {
			const f = new THREE.Mesh(kit.flameGeo, ab ? kit.flameAB : kit.flame);
			f.position.set(s * 0.6, JT.y - 0.05, -8.4); f.visible = false; f.renderOrder = 2;
			near.add(f); flames.push([f, ab]);
		}
		Object.assign(U, { surfaces: P, gear: P.gearN });
		let doorT = 1;
		U.pose = ({ surf = { pitch: 0, roll: 0, yaw: 0, flap: 0 }, gear = 1, throttle = 0, ab = 0, dt = 0.016 } = {}) => {
			// (a positive turn about x lifts a trailing edge)
			const fl = surf.flap * 0.5;
			P.flapL.rotation.x = -fl - surf.roll * 0.12; P.flapR.rotation.x = -fl + surf.roll * 0.12;
			P.ailL.rotation.x = -surf.roll * 0.35 - fl * 0.3; P.ailR.rotation.x = surf.roll * 0.35 - fl * 0.3;
			P.tailL.rotation.x = surf.pitch * 0.3 - surf.roll * 0.12; P.tailR.rotation.x = surf.pitch * 0.3 + surf.roll * 0.12;
			for (const s of ['L', 'R']) P['rud' + s].children[0].rotation.y = surf.yaw * 0.4;
			// the gear folds: the nose leg forward, the main legs in toward the body; the doors
			// open while it moves and while it is down
			const up = 1 - gear;
			P.gearN.rotation.x = up * -1.6;
			P.gearL.rotation.z = -up * 1.5; P.gearR.rotation.z = up * 1.5;
			for (const n of ['gearN', 'gearL', 'gearR']) P[n].visible = gear > 0.02;
			doorT += Math.max(-dt * 3, Math.min(dt * 3, (gear > 0.01 ? 1 : 0) - doorT));
			P.doorL.rotation.z = doorT * 1.45; P.doorR.rotation.z = -doorT * 1.45;
			P.doorN.visible = doorT < 0.5;
			for (const [f, isAB] of flames) {
				const k = isAB ? ab : Math.max(0, throttle - 0.08);
				f.visible = k > 0.02;
				f.scale.set(1, 1, isAB ? 1 + ab * 1.6 : 0.4 + throttle * 0.9);
			}
		};
	} else {
		add(G.parts.body, near);
		// the wheels: one instanced draw, each turning on its hub (the front ones steer)
		const wh = new THREE.InstancedMesh(G.parts.wheel, mat, G.wheels.length);
		wh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(G.wheels.length * 3), 3);
		wh.castShadow = wh.receiveShadow = true; wh.frustumCulled = false;
		near.add(wh); meshes.push(wh);
		let spinA = 0;
		const front = Math.max(...G.wheels.map((w) => w[1]));
		const placeWheels = (steer = 0) => {
			G.wheels.forEach(([x, z], i) => {
				// (the left ones turned round, so they spin the other way about their own axis)
				_qx.setFromAxisAngle(_ax.set(0, 1, 0), (z === front ? steer : 0) + (x < 0 ? PI : 0)).multiply(_qs.setFromAxisAngle(_ax.set(1, 0, 0), x < 0 ? -spinA : spinA));
				_mx.compose(_px.set(x, DIMS[kind].wr, z), _qx, _sx);
				wh.setMatrixAt(i, _mx); wh.setColorAt(i, tint);
			});
			wh.instanceMatrix.needsUpdate = true; if (wh.instanceColor) wh.instanceColor.needsUpdate = true;
		};
		placeWheels();
		U.wheels = wh;
		U.pose = ({ roll = 0, steer = 0 } = {}) => { spinA = (spinA + roll / DIMS[kind].wr) % (PI * 2); placeWheels(steer); };
	}
	// the coarse one, far off
	const far = one(G.far, mat, tint);
	root.addLevel(near, 0); root.addLevel(far, phone ? LOD_FAR_PHONE : LOD_FAR);
	meshes.push(far);
	// burnt out: every part to the wreck's material
	U.burn = () => { for (const m of meshes) m.material = kit.vehicleBurnt; };
	U.kind = kind;
	U.dispose = () => { for (const m of meshes) m.dispose?.(); };
	root.userData = U;
	return root;
}
