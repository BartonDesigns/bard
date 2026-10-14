// A base, built: the pad it stands on (raised just clear of the ground, its edges graded down
// into the land round it), the perimeter fence with its gate, boom and guardhouse, barracks,
// the headquarters, the armoury bunker, the motor pool, the fuel point, the helipad, the
// watchtowers, and on an air station the runway with its markings and lights, taxiways, the
// apron, arched hangars and the control tower. Then the clutter a working base gathers: jersey
// barriers in a chicane at the gate, sandbags, earth-filled wire-mesh barriers, containers,
// fuel bladders in their berm, generators, a lattice mast and aerials, flags with the base's
// own emblem, forklifts and tow tractors, a windsock; and its lights: floodlight masts and
// street lamps that throw pools of light at night, lit windows, runway edge lights, approach
// and slope lights, a beacon turning on the control tower, red lights blinking on the masts
// (the glows that read from far off are one point cloud).
//
// Everything is laid out in the base's own frame (military/rules.js) with y measured up from
// the pad, then sheared onto the pad's plane; one merged geometry per material, so a whole base
// is a handful of draw calls. Each building people go into leaves a frame for its interior
// (rules.interiorFrames): the builder that furnishes it is called with that frame in the world
// when one is registered.

import * as THREE from 'three';
import { builder } from './kit.js';
import { toWorld, padAt } from './rules.js';

const CONC = '#bdb7aa', CONC2 = '#a9a497', ROOF = '#55585a', EARTH = '#776a52', DARKC = '#3a3d40', STEEL = '#7d8287', KHAKI = '#a39470', TARMAC = '#5d5d5a', OLIVE = '#4f5640', HESCO = '#b3a27a';
const H = Math.PI / 2;
const ease = (t) => t * t * (3 - 2 * t);

// windows along the walls of a box w by d: a row a floor on each long face, fewer on the ends;
// some lit at night (lamps behind dark glass)
function windowsAlong(B, cx, cz, w, d, floors, fh, seed = 1) {
	let k = seed;
	for (const [len, half, alongX] of [[w, d / 2, true], [d, w / 2, false]]) {
		const n = Math.max(1, Math.floor(len / 3.2));
		for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
			const u = -len / 2 + (i + 0.5) * (len / n), y = f * fh + fh * 0.42;
			if (!alongX && Math.abs(u) < 2 && f === 0) continue;
			for (const s of [1, -1]) {
				const x = cx + (alongX ? u : s * (half + 0.03)), z = cz + (alongX ? s * (half + 0.03) : u);
				if (alongX && s > 0 && f === 0 && Math.abs(u) < 2.2) continue;
				k = (k * 9301 + 49297) % 233280;
				const lit = k / 233280 < 0.42;
				B.box(lit ? 'lamp' : 'glass', alongX ? 1.5 : 0.06, 1.25, alongX ? 0.06 : 1.5, x, y, z, 0, lit ? '#3a3020' : undefined);
				B.box('concrete', alongX ? 1.75 : 0.14, 0.1, alongX ? 0.14 : 1.75, x, y - 0.1, z, 0, CONC2);
			}
		}
	}
}
// a flat-roofed block: walls, a parapet, a roof, windows, a door with its canopy, roof kit
function block(B, b, col = CONC) {
	const { x, z, w, d, h } = b, yaw = b.yaw || 0, floors = b.floors || 1, fh = h / floors;
	B.box('concrete', w, h, d, x, 0, z, yaw, col);
	B.box('paint', w + 0.3, 0.12, d + 0.3, x, h, z, yaw, ROOF);
	B.box('concrete', w + 0.3, 0.55, 0.25, x, h, z + (d / 2 + 0.02) * Math.cos(yaw), yaw, col);
	B.box('concrete', w + 0.3, 0.55, 0.25, x, h, z - (d / 2 + 0.02) * Math.cos(yaw), yaw, col);
	windowsAlong(B, x, z, w, d, floors, fh, Math.abs(Math.round(x * 7 + z * 3)) + 1);
	// the door on the front, a concrete canopy over it, a step
	const dz = d / 2 + 0.05;
	B.box('dark', 1.8, 2.3, 0.12, x, 0, z + dz, yaw, DARKC);
	B.box('concrete', 3.2, 0.2, 1.6, x, 2.75, z + dz + 0.7, yaw, CONC2);
	B.box('concrete', 2.8, 0.18, 1.2, x, 0, z + dz + 0.5, yaw, CONC2);
	B.box('lamp', 0.4, 0.15, 0.15, x, 2.6, z + dz + 0.1, yaw, '#ffe7b0');
	// air handlers on the roof, a vent stack
	for (let i = 0; i < Math.max(1, Math.floor(w / 14)); i++) B.box('metal', 2.2, 1.1, 1.6, x - w / 2 + 5 + i * 12, h + 0.12, z, yaw, '#c2c5c6');
	B.cyl('dark', 0.25, 0.25, 1.6, x + w / 2 - 2, h + 0.9, z - d / 4, 8, STEEL);
}

// ---------- the clutter ----------
const _v = new THREE.Vector3();
// along a line from (x, z) at yaw (0 runs along +x): the point t metres on, o metres to the side
const along = (x, z, yaw, t, o = 0) => [x + Math.cos(yaw) * t + Math.sin(yaw) * o, z - Math.sin(yaw) * t + Math.cos(yaw) * o];
// jersey barriers: n concrete sections end to end
const JERSEY = [[-0.3, 0], [0.3, 0], [0.3, 0.08], [0.1, 0.3], [0.08, 0.81], [-0.08, 0.81], [-0.1, 0.3], [-0.3, 0.08]];
function jersey(B, x, z, yaw, n = 1) {
	for (let i = 0; i < n; i++) { const [px, pz] = along(x, z, yaw, (i - (n - 1) / 2) * 3.05); B.extrude('concrete', JERSEY, 3.0, px, 0, pz, yaw + H, i % 2 ? '#c4beb0' : '#b8b2a4'); }
}
// sandbags: a wall len long, rows high, each row half a bag along from the last
function sandbags(B, x, z, yaw, len, rows = 3) {
	const n = Math.max(1, Math.round(len / 0.62));
	for (let r = 0; r < rows; r++) for (let i = 0; i < n - (r % 2); i++) {
		const t = (i - (n - 1) / 2 + (r % 2) * 0.5) * 0.62, [px, pz] = along(x, z, yaw, t), j = ((i * 7 + r * 3) % 5) / 5;
		B.box('canvas', 0.6, 0.17, 0.38, px, r * 0.16, pz, yaw + (j - 0.5) * 0.12, j > 0.6 ? '#a8996f' : j > 0.3 ? '#9c8e66' : KHAKI);
	}
}
// earth-filled wire-mesh barriers: cells 1.1 m square in a row, the fill showing through the mesh
function hesco(B, x, z, yaw, n = 4, h = 1.4) {
	for (let i = 0; i < n; i++) {
		const [px, pz] = along(x, z, yaw, (i - (n - 1) / 2) * 1.1);
		B.box('canvas', 1.02, h - 0.04, 1.02, px, 0, pz, yaw, i % 2 ? HESCO : '#a89670');
		B.box('fence', 1.08, h, 1.08, px, 0, pz, yaw);
		B.box('canvas', 1.0, 0.06, 1.0, px, h - 0.1, pz, yaw, '#8c7c58');
	}
}
// a shipping container, corrugated, its doors' locking bars and corner castings
function container(B, x, y, z, yaw, col) {
	B.box('metal', 6.06, 2.59, 2.44, x, y, z, yaw, col);
	const c = Math.cos(yaw), s = Math.sin(yaw);
	for (let i = 0; i < 4; i++) { const o = -0.9 + i * 0.6; B.box('dark', 0.05, 2.3, 0.05, x + c * 3.05 + s * o, y + 0.12, z - s * 3.05 + c * o, yaw, '#2e3133'); }
	for (const a of [-1, 1]) for (const b of [-1, 1]) for (const yy of [0, 2.45]) B.box('dark', 0.18, 0.14, 0.18, x + c * a * 2.95 + s * b * 1.13, y + yy, z - s * a * 2.95 + c * b * 1.13, yaw, '#2e3133');
}
// a fuel bladder: a flattened pillow of rubberised fabric, its hose
function bladder(B, x, z, yaw) {
	B.add('paint', new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, H).scale(5, 0.9, 2.4), x, 0, z, yaw, '#2f3328');
	const [hx, hz] = along(x, z, yaw, 6.5);
	B.cyl('dark', 0.08, 0.08, 3, hx, 0.08, hz, 6, '#1f2122', H, 0, yaw + H);
}
// a generator on its skid, its vents and exhaust, a lamp that shows it running
function generator(B, x, z, yaw) {
	B.box('dark', 2.6, 0.15, 1.2, x, 0, z, yaw, '#2b2d2f');
	B.box('paint', 2.4, 1.35, 1.1, x, 0.15, z, yaw, OLIVE);
	for (let i = 0; i < 5; i++) { const [px, pz] = along(x, z, yaw, -0.9 + i * 0.3, 0.56); B.box('dark', 0.18, 0.7, 0.02, px, 0.45, pz, yaw, '#1d1f20'); }
	const [ex, ez] = along(x, z, yaw, 0.9), [lx, lz] = along(x, z, yaw, -0.6, 0.57);
	B.cyl('dark', 0.06, 0.06, 0.6, ex, 1.75, ez, 6, '#1d1f20');
	B.box('lamp', 0.08, 0.08, 0.03, lx, 1.2, lz, yaw, '#30ff60');
}
// a forklift: body, counterweight, mast and forks, the overhead guard, wheels
function forklift(B, x, z, yaw) {
	const P = (t, o = 0) => along(x, z, yaw, t, o);
	B.box('paint', 2.0, 0.9, 1.1, x, 0.3, z, yaw, '#6a6a3a');
	const [cx, cz] = P(-0.9);
	B.box('paint', 0.5, 0.5, 1.1, cx, 1.0, cz, yaw, '#5a5a32');
	for (const o of [-0.35, 0.35]) { const [mx, mz] = P(1.1, o), [fx, fz] = P(1.7, o); B.box('dark', 0.1, 2.6, 0.1, mx, 0, mz, yaw, '#2a2c2e'); B.box('dark', 1.1, 0.05, 0.12, fx, 0.08, fz, yaw, '#2a2c2e'); }
	for (const [t, o] of [[0.55, 0.5], [0.55, -0.5], [-0.55, 0.5], [-0.55, -0.5]]) { const [mx, mz] = P(t, o); B.box('dark', 0.05, 1.1, 0.05, mx, 1.2, mz, yaw, '#2a2c2e'); }
	B.box('dark', 1.2, 0.05, 1.15, x, 2.3, z, yaw, '#2a2c2e');
	for (const [t, o] of [[0.7, 0.5], [0.7, -0.5], [-0.65, 0.5], [-0.65, -0.5]]) { const [wx, wz] = P(t, o); B.add('dark', new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10).rotateX(H), wx, 0.3, wz, yaw, '#1c1d1e'); }
}
// a tow tractor for the aircraft: low, wide, a seat with no cab, a beacon
function tug(B, x, z, yaw) {
	B.box('paint', 3.2, 0.75, 1.9, x, 0.3, z, yaw, '#8a8a62');
	const [sx, sz] = along(x, z, yaw, -0.6);
	B.box('canvas', 0.6, 0.5, 0.6, sx, 1.05, sz, yaw, '#2b2b26');
	for (const [t, o] of [[1.1, 0.85], [1.1, -0.85], [-1.1, 0.85], [-1.1, -0.85]]) { const [wx, wz] = along(x, z, yaw, t, o); B.add('dark', new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10).rotateX(H), wx, 0.38, wz, yaw, '#1c1d1e'); }
	B.box('lamp', 0.12, 0.12, 0.3, x, 1.05, z, yaw, '#ffb020');
}
// a lattice mast with guy wires, aerials and dishes, a red light blinking on top
function lattice(B, x, z, h, glow) {
	const r = 0.55;
	for (let i = 0; i < 3; i++) { const a = i * 2.094; B.cyl('dark', 0.05, 0.07, h, x + Math.cos(a) * r, h / 2, z + Math.sin(a) * r, 5, STEEL); }
	for (let y = 1.5; y < h; y += 1.8) for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.047; B.cyl('dark', 0.025, 0.025, r * 1.75, x + Math.cos(a) * r * 0.5, y, z + Math.sin(a) * r * 0.5, 3, STEEL, H, 0, a + H); }
	for (let i = 0; i < 3; i++) {
		const a = i * 2.094 + 0.3, gx = x + Math.cos(a) * h * 0.6, gz = z + Math.sin(a) * h * 0.6, mx = (x + gx) / 2, mz = (z + gz) / 2, len = Math.hypot(h * 0.6, h * 0.8);
		const g = new THREE.CylinderGeometry(0.012, 0.012, len, 3); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.set(gx - x, -h * 0.8, gz - z).normalize()));
		B.add('dark', g, mx, h * 0.4 + 0.2, mz, 0, '#3a3c3e');
	}
	B.add('paint', new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, H * 0.7), x + 0.6, h * 0.7, z, -H, '#e2e2de', -1.2);
	B.cyl('dark', 0.03, 0.03, 3.5, x, h + 1.7, z, 4, '#2a2a2a');
	B.box('lamp', 0.25, 0.25, 0.25, x, h + 0.1, z, 0, '#ff3020');
	glow.halo(x, h + 0.25, z, 1.4, '#ff2a1a', 1.0);
}
// a flagpole and its flag (the flag's own material waves it)
function flag(B, x, z, h = 11, emblem = 0) {
	B.cyl('dark', 0.07, 0.1, h, x, h / 2, z, 8, '#c9cccf');
	B.add('paint', new THREE.SphereGeometry(0.14, 8, 6), x, h + 0.1, z, 0, '#c9b45a');
	const g = new THREE.PlaneGeometry(2.6, 1.6, 12, 4).translate(1.3, 0, 0);
	// (three flags on one cloth, a row each: each pole shows its own)
	const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 2 - emblem) / 3);
	B.add('flag', g, x + 0.08, h - 0.95, z, 0, '#ffffff', 0, 0, [0, 0, 0]);
}
// a floodlight mast: a tapered pole, a head frame, lamps aimed down and out (aim: the way they
// face, 0 along +z), their pool of light; a beam under it if asked; a red light on a tall one
function mast(B, x, z, h, aim, glow, heads = 3, beam = false) {
	const fwd = (t, o = 0) => [x + Math.sin(aim) * t + Math.cos(aim) * o, z + Math.cos(aim) * t - Math.sin(aim) * o];
	B.cyl('dark', 0.14, 0.26, h, x, h / 2, z, 8, STEEL);
	B.box('dark', 0.3, 0.12, 2.4, x, h, z, aim + H, '#3a3d40');
	for (let i = 0; i < heads; i++) {
		const o = (i - (heads - 1) / 2) * 0.75, [hx, hz] = fwd(0.3, o), [lx, lz] = fwd(0.42, o);
		B.box('dark', 0.62, 0.42, 0.2, hx, h - 0.3, hz, aim, '#2f3235', 0.6);
		B.box('lamp', 0.54, 0.34, 0.04, lx, h - 0.28, lz, aim, '#fff2d6', 0.6);
		glow.halo(lx, h - 0.15, lz, 1.2, '#fff0d0', 0);
	}
	const [px, pz] = fwd(h * 0.9);
	glow.pool(px, pz, h * 1.25, '#ffe2b0', 1);
	if (beam) glow.beam(x, h, z, px, pz, h * 1.0, '#ffe8c0');
	if (h > 14) { B.box('lamp', 0.2, 0.2, 0.2, x, h + 0.25, z, 0, '#ff3020'); glow.halo(x, h + 0.35, z, 1.0, '#ff2a1a', 1.37); }
}
// a street lamp by a road: pole, arm, head (aim: the way the arm reaches, 0 along +z), its pool
function lamppost(B, x, z, aim, glow) {
	const fwd = (t) => [x + Math.sin(aim) * t, z + Math.cos(aim) * t];
	B.cyl('dark', 0.07, 0.1, 7.5, x, 3.75, z, 6, STEEL);
	const [mx, mz] = fwd(0.6), [ax, az] = fwd(1.1), [px, pz] = fwd(2);
	B.box('dark', 0.08, 0.08, 1.3, mx, 7.45, mz, aim, STEEL);
	B.box('lamp', 0.25, 0.1, 0.5, ax, 7.3, az, aim, '#ffe0a8');
	glow.halo(ax, 7.2, az, 0.8, '#ffd9a0', 0);
	glow.pool(px, pz, 9, '#ffd49a', 0.75);
}
// a windsock on its pole, striped, streaming out downwind
function windsock(B, x, z, yaw) {
	B.cyl('dark', 0.06, 0.08, 6, x, 3, z, 6, '#c9cccf');
	for (let i = 0; i < 5; i++) {
		const r0 = 0.45 - i * 0.07, r1 = 0.45 - (i + 1) * 0.07, [px, pz] = along(x, z, yaw, 0.35 + i * 0.7);
		B.add('canvas', new THREE.CylinderGeometry(r1, r0, 0.7, 10, 1, true).rotateZ(-H), px, 5.9 - i * 0.12, pz, yaw, i % 2 ? '#e8e6e0' : '#e0601e', 0, 0.1);
	}
}

// the glows: pools of light on the ground and beams under the floodlights (the glow material, lit
// only at night), and the halos round every light that read from far off (a point cloud)
function glows(B) {
	const halos = { p: [], c: [], s: [], b: [] }, col = new THREE.Color();
	return {
		halos,
		halo(x, y, z, size, c, blink = 0) { col.set(c); halos.p.push(x, y, z); halos.c.push(col.r, col.g, col.b); halos.s.push(size); halos.b.push(blink); },
		pool(x, z, r, c, k = 1) { col.set(c).multiplyScalar(k); B.add('glow', new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-H), x, 0.18, z, 0, '#' + col.getHexString(), 0, 0, [0, 0, 0]); },
		beam(x, y, z, tx, tz, r, c) {
			const len = Math.hypot(tx - x, y, tz - z), g = new THREE.CylinderGeometry(0.25, r * 0.55, len, 14, 1, true);
			g.translate(0, -len / 2, 0);
			g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), _v.set(tx - x, -y, tz - z).normalize()));
			B.add('glow', g, x, y - 0.3, z, 0, c, 0, 0, [1, 0, 0]);
		},
	};
}

// ---------- the pad's edges, graded into the ground ----------
// rows out from the pad's edge to where the bank meets the ground: the further it has to fall
// (or climb), the further out it reaches, eased at the top and at the toe; grassed like the pad
function grade(B, base, ground, w, d) {
	const hw = w / 2, hd = d / 2, K = 6, step = 12, pts = [];
	const sides = [[-hw, hd, hw, hd], [hw, hd, hw, -hd], [hw, -hd, -hw, -hd], [-hw, -hd, -hw, hd]];
	sides.forEach(([x0, z0, x1, z1], si) => {
		const a0 = [H, 0, -H, Math.PI][si], n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
		for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, Math.cos(a0), Math.sin(a0)]); }
		// round the corner at the side's end
		for (let j = 0; j < 4; j++) { const a = a0 - (j / 4) * H; pts.push([x1, z1, Math.cos(a), Math.sin(a)]); }
	});
	const n = pts.length, gw = (lx, lz) => { const [x, z] = toWorld(base, lx, lz); return ground(x, z); };
	// how far each bank reaches, smoothed along the edge so the toe runs on without steps
	let reach = pts.map(([x, z]) => Math.min(70, Math.max(7, Math.abs(padAt(base, x, z) - gw(x, z)) * 3.6 + 6)));
	for (let pass = 0; pass < 3; pass++) reach = reach.map((r, i) => (reach[(i - 2 + n) % n] + reach[(i - 1 + n) % n] + r * 2 + reach[(i + 1) % n] + reach[(i + 2) % n]) / 6);
	const V = [];
	for (let i = 0; i < n; i++) {
		const [x, z, nx, nz] = pts[i], top = padAt(base, x, z);
		for (let k = 0; k <= K; k++) {
			const t = k / K, dd = reach[i] * t, px = x + nx * dd, pz = z + nz * dd, g = gw(px, pz) - 0.3;
			// (heights in the pad's frame: the shear adds the plane back)
			V.push([px, top + (g - top) * ease(t) - padAt(base, px, pz) + (k ? 0 : 0.02), pz]);
		}
	}
	const pos = [];
	const tri = (a, b, c) => {
		const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
		// (facing up: the cross product's y positive)
		if (uz * vx - ux * vz < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
	};
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		for (let k = 0; k < K; k++) { const a = V[i * (K + 1) + k], b = V[j * (K + 1) + k], c = V[j * (K + 1) + k + 1], e = V[i * (K + 1) + k + 1]; tri(a, b, c); tri(a, c, e); }
	}
	const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
	B.add('asphalt', g, 0, 0, 0, 0, '#7a776e', 0, 0, [1, 1, -1]);
	return { reach: Math.max(...reach) };
}

export function buildBase(base, kit, ground, opts = {}) {
	const L = base.layout, B = builder(), phone = !!opts.phone;
	const W = L.W, D = L.D, glow = glows(B);
	// ---------- the pad: grass and earth over most of it, its edges graded down to the land ----------
	B.strip('asphalt', W + 8, D + 8, 0, 0, 0, 0, '#7a776e', -1);
	const banks = grade(B, base, ground, W + 8, D + 8);

	// ---------- roads inside: from the gate to the buildings, to the hangars ----------
	const gate = L.gate;
	B.strip('asphalt', 9, 70, gate.x, 0.1, gate.z - 30, 0, TARMAC, 0.001);
	B.strip('asphalt', Math.min(W - 40, 360), 9, gate.x + Math.min(W - 40, 360) / 2 - 10, 0.1, gate.z - 62, 0, TARMAC, 0.001);
	// a ring road inside the fence, and the cantonment's concrete
	const ri = 14;
	B.strip('asphalt', W - 2 * ri, 7, 0, 0.08, D / 2 - ri, 0, TARMAC, 0.001);
	B.strip('asphalt', W - 2 * ri, 7, 0, 0.08, -D / 2 + ri, 0, TARMAC, 0.001);
	for (const s of [-1, 1]) B.strip('asphalt', 7, D - 2 * ri, s * (W / 2 - ri), 0.081, 0, 0, TARMAC, 0.001);
	let cant = null;
	{
		const cb = L.buildings.filter((b) => ['barracks', 'hq', 'armoury', 'motorpool', 'fuel', 'guardhouse'].includes(b.type));
		let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
		for (const b of cb) { x0 = Math.min(x0, b.x - b.w / 2 - 10); x1 = Math.max(x1, b.x + b.w / 2 + 10); z0 = Math.min(z0, b.z - b.d / 2 - 12); z1 = Math.max(z1, b.z + b.d / 2 + 12); }
		cant = { x0, x1, z0, z1 };
		B.strip('asphalt', x1 - x0, z1 - z0, (x0 + x1) / 2, 0.05, (z0 + z1) / 2, 0, '#8f8b82', 0.001);
		// and a road from it to the helipad and the flight line
		const hp = L.buildings.find((b) => b.type === 'helipad');
		if (hp) { const len = Math.abs(hp.x - (x0 + x1) / 2); B.strip('asphalt', len, 7, ((x0 + x1) / 2 + hp.x) / 2, 0.1, hp.z, 0, TARMAC, 0.001); }
		if (L.apron) { const zz = (z0 + L.apron.z + L.apron.d / 2) / 2, len = Math.abs(z0 - (L.apron.z + L.apron.d / 2)); B.strip('asphalt', 9, len + 4, L.apron.x + L.apron.w / 2 - 20, 0.1, zz, 0, TARMAC, 0.001); }
	}
	// (and out through the gate, down the bank)
	B.strip('asphalt', 9, 40, gate.x, 0.1, gate.z + 22, 0, TARMAC, 0.001);

	// ---------- buildings ----------
	const frames = [];
	for (const b of L.buildings) {
		const yaw = b.yaw || 0;
		if (b.type === 'barracks' || b.type === 'hq') {
			block(B, b, b.type === 'hq' ? '#c6c0b0' : CONC);
			if (b.type === 'hq') {
				// a mast and a dish on the headquarters' roof; flags before its door, a lattice mast beside it
				B.cyl('dark', 0.08, 0.12, 12, b.x + b.w / 2 - 3, b.h + 6, b.z - 3, 6, STEEL);
				B.add('paint', new THREE.SphereGeometry(1.4, 12, 6, 0, Math.PI * 2, 0, H * 0.8), b.x - b.w / 2 + 4, b.h + 1.6, b.z, 0, '#e2e2de', -0.9);
				B.box('lamp', 0.3, 0.3, 0.3, b.x + b.w / 2 - 3, b.h + 12, b.z - 3, 0, '#ff3030');
				glow.halo(b.x + b.w / 2 - 3, b.h + 12.2, b.z - 3, 1.0, '#ff2a1a', 1.11);
				for (let i = 0; i < 3; i++) flag(B, b.x - 5 + i * 5, b.z + b.d / 2 + 8, i === 1 ? 12 : 10.5, i);
				B.box('concrete', 16, 0.3, 3, b.x, 0, b.z + b.d / 2 + 8, 0, CONC2);
				lattice(B, b.x + b.w / 2 + 12, b.z - 4, phone ? 18 : 26, glow);
				generator(B, b.x + b.w / 2 + 4, b.z - b.d / 2 + 2, H);
			} else hesco(B, b.x - b.w / 2 - 4, b.z + b.d / 2 + 3, H, 3, 1.6);
		} else if (b.type === 'guardhouse') {
			B.box('concrete', b.w, b.h, b.d, b.x, 0, b.z, yaw, CONC);
			B.box('paint', b.w + 1.6, 0.18, b.d + 1.6, b.x, b.h, b.z, yaw, ROOF);
			for (const s of [-1, 1]) B.box('glass', b.w * 0.8, 1.0, 0.06, b.x, 1.1, b.z + s * (b.d / 2 + 0.02), yaw);
			B.box('glass', 0.06, 1.0, b.d * 0.6, b.x - b.w / 2 - 0.02, 1.1, b.z, yaw);
			B.box('lamp', 0.5, 0.18, 0.18, b.x, b.h - 0.3, b.z + b.d / 2 + 0.1, yaw, '#ffe7b0');
			sandbags(B, b.x, b.z + b.d / 2 + 1.6, 0, b.w + 1, 4);
		} else if (b.type === 'armoury') {
			// a bunker: concrete under an earth bank, a steel door in its face, blast walls before it
			B.box('concrete', b.w, b.h, b.d, b.x, 0, b.z, yaw, CONC2);
			B.extrude('paint', [[-b.w / 2 - 6, 0], [b.w / 2 + 6, 0], [b.w / 2, b.h + 0.6], [-b.w / 2, b.h + 0.6]], b.d - 0.4, b.x, 0, b.z - 0.8, 0, EARTH);
			B.box('dark', 3.2, 3.0, 0.2, b.x, 0, b.z + b.d / 2 + 0.25, yaw, '#4d5258');
			B.box('concrete', 5.5, 4.2, 0.5, b.x, 0, b.z + b.d / 2 + 0.05, yaw, CONC);
			B.box('lamp', 0.5, 0.2, 0.2, b.x, 3.6, b.z + b.d / 2 + 0.4, yaw, '#ffe7b0');
			for (const s of [-1, 1]) sandbags(B, b.x + s * 4.2, b.z + b.d / 2 + 2.2, -s * 0.2, 2.6, 4);
			for (const s of [-1, 1]) hesco(B, b.x + s * (b.w / 2 + 3), b.z + b.d / 2 + 6, H, 4, 1.8);
			hesco(B, b.x, b.z + b.d / 2 + 9.5, 0, 5, 1.8);
		} else if (b.type === 'motorpool') {
			// an open shed: columns, a sloping roof, a back wall; the floor concrete
			B.strip('asphalt', b.w + 10, b.d + 18, b.x, 0.065, b.z + 6, 0, '#8a8780', 0.001);
			for (let i = 0; i <= 6; i++) { const x = b.x - b.w / 2 + i * b.w / 6; for (const s of [-1, 1]) B.box('dark', 0.35, b.h - (s > 0 ? 0 : 0.8), 0.35, x, 0, b.z + s * b.d / 2, 0, STEEL); }
			B.box('metal', b.w + 1, 0.15, b.d + 3, b.x, b.h - 0.4, b.z + 0.5, 0, '#9ea3a5', 0.05);
			B.box('metal', b.w, b.h - 0.8, 0.12, b.x, 0, b.z - b.d / 2, 0, '#8e9497');
			for (let i = 0; i < 6; i++) B.box('lamp', 0.8, 0.12, 0.3, b.x - b.w / 2 + 4.5 + i * (b.w - 9) / 5, b.h - 0.6, b.z + 2, 0, '#fff1d0');
			glow.pool(b.x, b.z + 2, b.w * 0.45, '#ffe6c0', 0.6);
			// containers stacked at its end, drums, a forklift, a generator, barriers lining the hardstand
			container(B, b.x - b.w / 2 - 8, 0, b.z - 4, H, '#6b7a5a');
			container(B, b.x - b.w / 2 - 8, 0, b.z - 1.4, H, '#8a5a3c');
			container(B, b.x - b.w / 2 - 8, 2.6, b.z - 2.7, H, '#5a6b7a');
			container(B, b.x - b.w / 2 - 12, 0, b.z + 6, 0.08, '#7a6e52');
			for (let i = 0; i < 9; i++) B.cyl('paint', 0.3, 0.3, 0.9, b.x + b.w / 2 + 3 + (i % 3) * 0.65, 0.45, b.z - 6 + Math.floor(i / 3) * 0.65, 10, i % 4 ? '#3f5a3a' : '#5a3f2a');
			forklift(B, b.x - b.w / 2 - 3, b.z + 10, 0.4);
			generator(B, b.x + b.w / 2 + 3, b.z + 2, 0);
			jersey(B, b.x, b.z + b.d / 2 + 18.5, 0, Math.floor(b.w / 3.05));
			mast(B, b.x + b.w / 2 + 6, b.z + 16, 14, -H, glow, 2);
		} else if (b.type === 'fuel') {
			B.box('concrete', b.w + 3, 0.8, b.d + 3, b.x, 0, b.z, 0, CONC2);
			for (const s of [-1, 1]) { B.cyl('paint', 1.6, 1.6, b.w - 2, b.x, 2.4, b.z + s * 2.3, 16, '#d9d9d2', 0, H); for (const e of [-1, 1]) B.box('concrete', 0.5, 0.9, 3.2, b.x + e * (b.w / 2 - 3), 0.8, b.z + s * 2.3, 0, CONC2); }
			// fuel bladders in their earth berm beside it, a pump and generator, barriers round it
			const bx = b.x + b.w / 2 + 16;
			B.extrude('paint', [[-1.6, 0], [1.6, 0], [0.5, 1.2], [-0.5, 1.2]], 26, bx - 9, 0, b.z, 0, EARTH);
			B.extrude('paint', [[-1.6, 0], [1.6, 0], [0.5, 1.2], [-0.5, 1.2]], 26, bx + 9, 0, b.z, 0, EARTH);
			B.extrude('paint', [[-1.6, 0], [1.6, 0], [0.5, 1.2], [-0.5, 1.2]], 16, bx, 0, b.z - 12.2, H, EARTH);
			for (const o of [-4, 4]) bladder(B, bx + o * 0.9, b.z + o * 1.6, H + 0.05);
			generator(B, bx, b.z + 15, 0);
			for (const s of [-1, 1]) jersey(B, b.x + s * (b.w / 2 + 3), b.z, H, 3);
		} else if (b.type === 'tower') {
			// a watchtower: four legs, braces, a platform with its rail, a roof, a ladder, a floodlight
			const p = b.h, s2 = b.w / 2 - 0.2;
			for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box('dark', 0.25, p, 0.25, b.x + sx * s2, 0, b.z + sz * s2, 0, STEEL);
			for (let k = 1; k < 3; k++) for (const s of [-1, 1]) { B.cbox('dark', b.w, 0.1, 0.1, b.x, k * p / 3, b.z + s * s2, 0, STEEL); B.cbox('dark', 0.1, 0.1, b.w, b.x + s * s2, k * p / 3, b.z, 0, STEEL); }
			B.box('concrete', b.w + 0.8, 0.25, b.w + 0.8, b.x, p, b.z, 0, CONC2);
			for (const s of [-1, 1]) { B.box('metal', b.w + 0.8, 1.05, 0.08, b.x, p + 0.25, b.z + s * (b.w / 2 + 0.36), 0, '#7c8076'); B.box('metal', 0.08, 1.05, b.w + 0.8, b.x + s * (b.w / 2 + 0.36), p + 0.25, b.z, 0, '#7c8076'); }
			for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box('dark', 0.1, 2.3, 0.1, b.x + sx * (b.w / 2 + 0.3), p + 0.25, b.z + sz * (b.w / 2 + 0.3), 0, STEEL);
			B.box('metal', b.w + 1.6, 0.12, b.w + 1.6, b.x, p + 2.55, b.z, 0, '#6b6f68');
			for (let k = 0; k < Math.floor(p / 0.35); k++) B.cbox('dark', 0.5, 0.05, 0.05, b.x, k * 0.35 + 0.3, b.z + b.w / 2 + 0.25, 0, STEEL);
			const fx = b.x - Math.sign(b.x) * 0.6, fz = b.z - Math.sign(b.z) * 0.6, aim = Math.atan2(-b.x, -b.z);
			B.box('lamp', 0.6, 0.4, 0.6, fx, p + 2.1, fz, aim, '#fff6dc');
			glow.halo(fx, p + 2.2, fz, 1.3, '#fff0d0', 0);
			glow.pool(fx - Math.sign(b.x) * 16, fz - Math.sign(b.z) * 16, 20, '#ffe6c0', 0.7);
			// sandbags round its feet
			for (const s of [-1, 1]) { sandbags(B, b.x, b.z + s * (b.w / 2 + 0.9), 0, b.w + 2, 3); sandbags(B, b.x + s * (b.w / 2 + 0.9), b.z, H, b.w, 3); }
		} else if (b.type === 'control') {
			// the control tower: a shaft with its stair windows, the glass cab, the beacon turning on top
			B.box('concrete', b.w, b.h - 4, b.d, b.x, 0, b.z, 0, '#d0cbbd');
			for (let k = 0; k < 4; k++) B.box('glass', 0.06, 1.2, 1.6, b.x + b.w / 2 + 0.02, 2 + k * 3.4, b.z, 0);
			B.box('concrete', b.w + 3, 0.4, b.d + 3, b.x, b.h - 4, b.z, 0, '#d0cbbd');
			B.box('glass', b.w + 2.4, 2.8, b.d + 2.4, b.x, b.h - 3.6, b.z, 0);
			for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box('dark', 0.2, 2.8, 0.2, b.x + sx * (b.w / 2 + 1.2), b.h - 3.6, b.z + sz * (b.d / 2 + 1.2), 0, STEEL);
			B.box('paint', b.w + 3.4, 0.35, b.d + 3.4, b.x, b.h - 0.8, b.z, 0, ROOF);
			B.box('lamp', b.w + 2.2, 0.3, b.d + 2.2, b.x, b.h - 3.2, b.z, 0, '#4fd0ff');
			B.cyl('dark', 0.05, 0.05, 4, b.x, b.h + 1.6, b.z, 6, STEEL);
			B.cyl('dark', 0.35, 0.35, 0.5, b.x, b.h + 3.85, b.z, 10, '#2e3133');
			B.box('lamp', 0.5, 0.3, 0.5, b.x, b.h + 3.4, b.z, 0, '#ff3030');
			// (the beacon: green and white flashes, turn about)
			glow.halo(b.x, b.h + 3.9, b.z, 2.6, '#40ff70', 0.5);
			glow.halo(b.x, b.h + 3.9, b.z, 2.6, '#ffffff', 0.75);
			glow.halo(b.x, b.h + 0.1, b.z, 0.9, '#ff2a1a', 1.23);
			B.box('canvas', 1.2, 0.8, 1.2, b.x + b.w / 2 + 3, 0, b.z + 4, 0, '#55594a');
			generator(B, b.x - b.w / 2 - 4, b.z, H);
		} else if (b.type === 'hangar') {
			// an arched hangar: the curved roof, its back wall, the floor, door leaves pushed aside
			const r = b.w / 2, k = b.h / r;
			const arch = new THREE.CylinderGeometry(r, r, b.d, 28, 1, true, -H, Math.PI); arch.rotateX(-H).scale(1, k, 1);
			B.add('metal', arch, b.x, 0, b.z, yaw, '#a7acae');
			const half = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI; half.push([Math.cos(a) * r, Math.sin(a) * r * k]); }
			B.extrude('metal', half, 0.25, b.x, 0, b.z - b.d / 2 * Math.cos(yaw), yaw, '#959b9e');
			B.strip('asphalt', b.w, b.d, b.x, 0.07, b.z, yaw, '#8c8a84', 0.001);
			for (const s of [-1, 1]) B.box('metal', b.w * 0.24, b.h * 0.42, 0.25, b.x + s * (r + 1.5), 0, b.z - b.d / 2 * Math.cos(yaw) * -1, yaw, '#8b9194');
			for (let i = 0; i < 4; i++) B.box('lamp', 0.5, 0.2, 2.4, b.x - r * 0.6 + i * r * 0.4, b.h * 0.92 - 1, b.z, yaw, '#fff3d6');
			glow.pool(b.x, b.z, r * 0.9, '#fff0d8', 0.55);
			// a container and a tug beside its doors, barriers along its flank
			const fz = b.z - b.d / 2 * Math.cos(yaw) * -1;
			container(B, b.x + r + 5, 0, b.z, H, ['#6e7258', '#5d6a70', '#7c6a4f'][Math.abs(Math.round(b.x)) % 3]);
			tug(B, b.x - r - 4, fz - 6, 0.3);
		} else if (b.type === 'runway') {
			B.strip('asphalt', b.w, b.d, b.x, 0.14, b.z, 0, '#4b4b49', 2);
			// edge lights each 30 m, threshold lights (green), end lights (red), each with its halo
			for (let x = -b.w / 2; x <= b.w / 2 + 0.1; x += 30) for (const s of [-1, 1]) { B.box('lamp', 0.3, 0.3, 0.3, b.x + x, 0.06, b.z + s * (b.d / 2 + 1.2), 0, '#fff6d8'); glow.halo(b.x + x, 0.4, b.z + s * (b.d / 2 + 1.2), 0.9, '#fff2d0', 0); }
			for (const e of [-1, 1]) for (let v = -b.d / 2; v <= b.d / 2; v += 2.5) { B.box('lamp', 0.3, 0.25, 0.3, b.x + e * (b.w / 2 + 2), 0.06, b.z + v, 0, e > 0 ? '#ff3a30' : '#30ff60'); glow.halo(b.x + e * (b.w / 2 + 2), 0.35, b.z + v, 0.8, e > 0 ? '#ff3020' : '#30ff60', 0); }
			// the approach lights out past one end, a flashing run leading in
			for (let i = 1; i <= 8; i++) for (let j = -2; j <= 2; j++) { B.box('lamp', 0.4, 0.25, 0.4, b.x - b.w / 2 - 6 - i * 30, 0.06 + i * 0.05, b.z + j * 1.5, 0, '#fff6d8'); glow.halo(b.x - b.w / 2 - 6 - i * 30, 0.5 + i * 0.05, b.z + j * 1.5, 0.8, '#fff6dc', j === 0 ? 2 + i * 0.06 : 0); }
			// the slope indicator lights beside the touchdown zone: two red, two white
			for (let i = 0; i < 4; i++) { const x = b.x - b.w / 2 + 300, z = b.z + b.d / 2 + 12 + i * 9; B.box('dark', 1.2, 0.8, 0.8, x, 0, z, 0, '#d8d8d0'); B.box('lamp', 0.9, 0.35, 0.05, x - 0.42, 0.45, z, H, i < 2 ? '#ff4030' : '#ffffff'); glow.halo(x - 0.5, 0.5, z, 1.0, i < 2 ? '#ff3020' : '#ffffff', 0); }
			windsock(B, b.x - b.w / 2 + 220, b.z + b.d / 2 + 30, 0.6);
		} else if (b.type === 'taxiway') {
			B.strip('asphalt', b.w, b.d, b.x, 0.12, b.z, 0, '#555553', 1);
			if (!b.link) for (let x = -b.w / 2; x <= b.w / 2; x += 50) for (const s of [-1, 1]) { B.box('lamp', 0.25, 0.25, 0.25, b.x + x, 0.06, b.z + s * (b.d / 2 + 1), 0, '#3a8cff'); glow.halo(b.x + x, 0.35, b.z + s * (b.d / 2 + 1), 0.7, '#3a7cff', 0); }
			else for (const s of [-1, 1]) for (let v = -b.d / 2; v <= b.d / 2; v += 15) { B.box('lamp', 0.25, 0.25, 0.25, b.x + s * (b.w / 2 + 1), 0.06, b.z + v, 0, '#3a8cff'); glow.halo(b.x + s * (b.w / 2 + 1), 0.35, b.z + v, 0.7, '#3a7cff', 0); }
		} else if (b.type === 'apron') {
			B.strip('asphalt', b.w, b.d, b.x, 0.11, b.z, 0, '#6a6965', 0.5);
			// floodlight masts along its back edge, their beams on the stands
			for (let i = 0; i < 4; i++) { const x = b.x - b.w / 2 + 20 + i * (b.w - 40) / 3; mast(B, x, b.z + b.d / 2 + 4, 18, Math.PI, glow, 4, !phone); }
			// barriers along the front, ground equipment at the stands
			jersey(B, b.x - b.w / 2 + 40, b.z + b.d / 2 + 1.2, 0, 8);
			for (let i = 0; i < 3; i++) tug(B, b.x - 80 + i * 70, b.z - b.d / 2 + 12, Math.PI / 2 + i);
			for (let i = 0; i < 2; i++) generator(B, b.x - 120 + i * 140, b.z + b.d / 2 - 4, 0);
			forklift(B, b.x + 60, b.z + b.d / 2 - 8, 2.4);
			container(B, b.x + b.w / 2 - 12, 0, b.z + b.d / 2 - 6, 0, '#6b7a5a');
			container(B, b.x + b.w / 2 - 12, 0, b.z + b.d / 2 - 8.6, 0, '#5a6b7a');
		} else if (b.type === 'helipad') {
			B.box('concrete', b.w, 0.18, b.d, b.x, 0, b.z, 0, '#a9a69d');
			B.strip('asphalt', b.w - 2, b.d - 2, b.x, 0.2, b.z, 0, '#4f4f4c', 0.1);
			for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = b.x + Math.cos(a) * (b.w / 2 - 0.6), z = b.z + Math.sin(a) * (b.w / 2 - 0.6); B.box('lamp', 0.3, 0.2, 0.3, x, 0.18, z, 0, '#ffd23a'); glow.halo(x, 0.45, z, 0.8, '#ffc820', 0); }
			// blast walls on two sides, a floodlight
			hesco(B, b.x - b.w / 2 - 4, b.z, H, 12, 2.2);
			hesco(B, b.x + 18, b.z - b.d / 2 - 6, 0, 16, 2.2);
			mast(B, b.x - b.w / 2 - 7, b.z - b.d / 2 - 4, 12, 0.87, glow, 2);
		} else if (b.type === 'gate') {
			// the gate: two posts, a boom striped red and white, sandbag walls, blast walls inside,
			// a jersey barrier chicane on the road in, a floodlight on the approach
			for (const s of [-1, 1]) B.box('concrete', 1.0, 2.6, 1.0, b.x + s * (b.w / 2 + 0.6), 0, b.z, 0, CONC);
			for (let i = 0; i < 8; i++) B.cbox('paint', b.w / 8, 0.14, 0.14, b.x - b.w / 2 + (i + 0.5) * b.w / 8, 1.1, b.z + 0.8, 0, i % 2 ? '#e8e8e4' : '#b8241c');
			B.box('dark', 0.4, 1.2, 0.4, b.x - b.w / 2 - 0.2, 0, b.z + 0.8, 0, STEEL);
			for (const s of [-1, 1]) sandbags(B, b.x + s * (b.w / 2 + 3.4), b.z + 4, 0, 3.2, 4);
			B.box('lamp', 0.5, 0.3, 0.3, b.x, 3.4, b.z, 0, '#fff3d6');
			B.cyl('dark', 0.12, 0.12, 3.4, b.x, 1.7, b.z - 0.2, 6, STEEL);
			for (const s of [-1, 1]) hesco(B, b.x + s * (b.w / 2 + 9), b.z - 2.5, 0, 12, 2.0);
			for (let i = 0; i < 4; i++) jersey(B, b.x + (i % 2 ? 2.6 : -2.6), b.z + 9 + i * 8, 0, 2);
			mast(B, b.x + b.w / 2 + 5, b.z + 6, 12, -0.88, glow, 2, !phone);
		}
		if (b.interior) frames.push(b);
	}
	// street lamps along the ring road and the roads in
	if (!phone || W < 600) {
		const step = W > 600 ? 75 : 50;
		for (let x = -W / 2 + ri + 10; x < W / 2 - ri; x += step) { lamppost(B, x, D / 2 - ri - 4.5, 0, glow); lamppost(B, x + step / 2, -D / 2 + ri + 4.5, Math.PI, glow); }
		for (let z = gate.z - 60; z < gate.z - 6; z += 25) lamppost(B, gate.x - 6, z, H, glow);
	}
	// a few more barrier runs about the cantonment
	if (cant && !phone) { hesco(B, cant.x0 + 6, cant.z0 - 4, 0, 10, 1.6); jersey(B, cant.x1 - 20, cant.z1 + 2, 0, 5); }

	// ---------- the fence: chain-link on posts, three strands of wire on outriggers ----------
	const fw = W / 2, fd = D / 2, gx = L.fence.gate.x, gw = L.fence.gate.w / 2;
	const runs = [[[-fw, fd], [gx - gw, fd]], [[gx + gw, fd], [fw, fd]], [[fw, fd], [fw, -fd]], [[fw, -fd], [-fw, -fd]], [[-fw, -fd], [-fw, fd]]];
	for (const [[x0, z0], [x1, z1]] of runs) {
		const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
		B.add('fence', new THREE.PlaneGeometry(len, 2.4), cx, 1.2, cz, yaw);
		for (let k = 0; k < 3; k++) B.add('dark', new THREE.CylinderGeometry(0.012, 0.012, len, 3).rotateZ(H), cx, 2.55 + k * 0.17, cz, yaw, STEEL);
		const n = Math.ceil(len / 3.2);
		for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; B.box('dark', 0.07, 2.95, 0.07, x, 0, z, 0, STEEL); }
	}
	const geos = B.geometries();
	// onto the pad's plane: y up from the pad, wherever it is
	const shear = (g) => {
		const P = g.attributes.position;
		for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + padAt(base, P.getX(i), P.getZ(i)));
		P.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox();
	};
	for (const g of Object.values(geos)) shear(g);
	const group = new THREE.Group(); group.name = 'mil-base:' + base.name;
	for (const [mat, g] of Object.entries(geos)) {
		const m = new THREE.Mesh(g, kit[mat]);
		m.castShadow = !phone && !['asphalt', 'lamp', 'fence', 'glow', 'flag'].includes(mat); m.receiveShadow = mat !== 'glow';
		m.name = 'mil-' + mat;
		if (mat === 'glow') m.renderOrder = 3;
		group.add(m);
	}
	// the halos: one point cloud for the base
	const hg = new THREE.BufferGeometry(), Hh = glow.halos;
	hg.setAttribute('position', new THREE.Float32BufferAttribute(Hh.p, 3));
	hg.setAttribute('color', new THREE.Float32BufferAttribute(Hh.c, 3));
	hg.setAttribute('size', new THREE.Float32BufferAttribute(Hh.s, 1));
	hg.setAttribute('blink', new THREE.Float32BufferAttribute(Hh.b, 1));
	shear(hg);
	const halos = new THREE.Points(hg, kit.halo); halos.name = 'mil-halos'; halos.renderOrder = 4; halos.frustumCulled = false;
	group.add(halos);
	group.position.set(base.x, 0, base.z); group.rotation.y = base.yaw;
	const tris = Object.values(geos).reduce((a, g) => a + g.attributes.position.count / 3, 0);
	return { group, frames, draws: Object.keys(geos).length + 1, tris, halos: Hh.s.length, banks: banks.reach };
}

// a checkpoint on the road outside a base (its own frame: the road along z, the ground at y 0):
// the boom, a chicane of jersey barriers both ways, sandbag walls, the guards' hut, blast walls,
// a floodlight
export function buildCheckpoint(kit, opts = {}) {
	const B = builder(), glow = glows(B);
	for (let i = 0; i < 8; i++) B.cbox('paint', 0.875, 0.14, 0.14, -3.5 + (i + 0.5) * 0.875, 1.05, -0.6, 0, i % 2 ? '#e8e8e4' : '#b8241c');
	for (const x of [-4.1, 3.9]) B.box('concrete', 0.6, 1.0, 0.6, x, 0, -0.6, 0, CONC);
	B.box('dark', 0.5, 0.4, 0.3, -4.6, 0.75, -0.6, 0, '#2e3133');
	for (const s of [-1, 1]) for (let i = 0; i < 2; i++) jersey(B, (i % 2 ? 2.4 : -2.4) * s, s * (9 + i * 8), 0, 2);
	for (const s of [-1, 1]) sandbags(B, s * 6.6, 0.6, 0, 5.6, 4);
	B.box('concrete', 2.6, 2.5, 2.6, -8, 0, 3.2, 0, CONC);
	B.box('paint', 3.2, 0.15, 3.2, -8, 2.5, 3.2, 0, ROOF);
	B.box('glass', 0.06, 0.8, 1.6, -6.68, 1.2, 3.2, 0);
	B.box('dark', 0.06, 2.0, 0.9, -8, 0, 1.88, H, DARKC);
	B.box('lamp', 0.4, 0.14, 0.14, -8, 2.25, 1.85, 0, '#ffe7b0');
	hesco(B, -10.2, 3.2, H, 5, 1.6);
	if (!opts.phone) generator(B, -11.5, -2, H);
	mast(B, 7.5, 2.5, 8, -2.0, glow, 2);
	const geos = B.geometries(), group = new THREE.Group();
	group.name = 'mil-checkpoint';
	for (const [mat, g] of Object.entries(geos)) {
		const m = new THREE.Mesh(g, kit[mat]);
		m.castShadow = !opts.phone && !['lamp', 'fence', 'glow'].includes(mat); m.receiveShadow = mat !== 'glow';
		if (mat === 'glow') m.renderOrder = 3;
		group.add(m);
	}
	const Hh = glow.halos, hg = new THREE.BufferGeometry();
	hg.setAttribute('position', new THREE.Float32BufferAttribute(Hh.p, 3));
	hg.setAttribute('color', new THREE.Float32BufferAttribute(Hh.c, 3));
	hg.setAttribute('size', new THREE.Float32BufferAttribute(Hh.s, 1));
	hg.setAttribute('blink', new THREE.Float32BufferAttribute(Hh.b, 1));
	const halos = new THREE.Points(hg, kit.halo); halos.frustumCulled = false; halos.renderOrder = 4;
	group.add(halos);
	return group;
}
