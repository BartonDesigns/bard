// A base, built: the pad it stands on (raised just clear of the ground, earth banked round
// it), the perimeter fence with its gate, boom and guardhouse, barracks, the headquarters,
// the armoury bunker, the motor pool, the fuel point, the helipad, the watchtowers, and on an
// air station the runway with its markings and lights, taxiways, the apron, arched hangars and
// the control tower. Everything is laid out in the base's own frame (military/rules.js) with y
// measured up from the pad, then sheared onto the pad's plane; one merged geometry per
// material, so a whole base is a handful of draw calls. Lamps light at night.
//
// Each building people go into leaves a frame for its interior (rules.interiorFrames): the
// builder that furnishes it is called with that frame in the world when one is registered.

import * as THREE from 'three';
import { builder } from './kit.js';
import { toWorld, padAt } from './rules.js';

const CONC = '#bdb7aa', CONC2 = '#a9a497', ROOF = '#55585a', EARTH = '#776a52', DARKC = '#3a3d40', STEEL = '#7d8287', KHAKI = '#a39470', TARMAC = '#5d5d5a';
const H = Math.PI / 2;

// windows along the walls of a box w by d: a row a floor on each long face, fewer on the ends
function windowsAlong(B, cx, cz, w, d, floors, fh) {
	for (const [len, half, alongX] of [[w, d / 2, true], [d, w / 2, false]]) {
		const n = Math.max(1, Math.floor(len / 3.2));
		for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
			const u = -len / 2 + (i + 0.5) * (len / n), y = f * fh + fh * 0.42;
			if (!alongX && Math.abs(u) < 2 && f === 0) continue;
			for (const s of [1, -1]) {
				const x = cx + (alongX ? u : s * (half + 0.03)), z = cz + (alongX ? s * (half + 0.03) : u);
				if (alongX && s > 0 && f === 0 && Math.abs(u) < 2.2) continue;
				B.box('glass', alongX ? 1.5 : 0.06, 1.25, alongX ? 0.06 : 1.5, x, y, z, 0);
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
	windowsAlong(B, x, z, w, d, floors, fh);
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

export function buildBase(base, kit, ground, opts = {}) {
	const L = base.layout, B = builder(), lights = [];
	const W = L.W, D = L.D;
	// ---------- the pad: one slab, banked with earth to the ground round it ----------
	// (grass and earth over most of it, concrete where people work)
	B.strip('asphalt', W + 8, D + 8, 0, 0, 0, 0, '#7a776e', -1);
	const seg = (len) => Math.max(4, Math.ceil(len / 25));
	const edge = (x0, z0, x1, z1) => {
		// (outward from the pad's middle)
		const n = seg(Math.hypot(x1 - x0, z1 - z0)), ox = z0 === z1 ? 0 : Math.sign(x0), oz = z0 === z1 ? Math.sign(z0) : 0;
		const pos = [];
		for (let i = 0; i < n; i++) {
			const t0 = i / n, t1 = (i + 1) / n;
			const pts = [[x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0], [x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1]];
			const low = pts.map(([lx, lz]) => {
				const [wx, wz] = toWorld(base, lx, lz), drop = Math.max(0.3, padAt(base, lx, lz) - ground(wx, wz)) + 0.6;
				return [lx + ox * drop * 3, -drop, lz + oz * drop * 3];
			});
			pos.push(pts[0][0], 0, pts[0][1], low[0][0], low[0][1], low[0][2], pts[1][0], 0, pts[1][1]);
			pos.push(pts[1][0], 0, pts[1][1], low[0][0], low[0][1], low[0][2], low[1][0], low[1][1], low[1][2]);
		}
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
		B.add('paint', g, 0, 0, 0, 0, EARTH);
	};
	const hw = W / 2 + 4, hd = D / 2 + 4;
	edge(-hw, hd, hw, hd); edge(hw, hd, hw, -hd); edge(hw, -hd, -hw, -hd); edge(-hw, -hd, -hw, hd);

	// ---------- roads inside: from the gate to the buildings, to the hangars ----------
	const gate = L.gate;
	B.strip('asphalt', 9, 70, gate.x, 0.1, gate.z - 30, 0, TARMAC, 0.001);
	B.strip('asphalt', Math.min(W - 40, 360), 9, gate.x + Math.min(W - 40, 360) / 2 - 10, 0.1, gate.z - 62, 0, TARMAC, 0.001);
	// a ring road inside the fence, and the cantonment's concrete
	const ri = 14;
	B.strip('asphalt', W - 2 * ri, 7, 0, 0.08, D / 2 - ri, 0, TARMAC, 0.001);
	B.strip('asphalt', W - 2 * ri, 7, 0, 0.08, -D / 2 + ri, 0, TARMAC, 0.001);
	for (const s of [-1, 1]) B.strip('asphalt', 7, D - 2 * ri, s * (W / 2 - ri), 0.081, 0, 0, TARMAC, 0.001);
	{
		const cant = L.buildings.filter((b) => ['barracks', 'hq', 'armoury', 'motorpool', 'fuel', 'guardhouse'].includes(b.type));
		let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
		for (const b of cant) { x0 = Math.min(x0, b.x - b.w / 2 - 10); x1 = Math.max(x1, b.x + b.w / 2 + 10); z0 = Math.min(z0, b.z - b.d / 2 - 12); z1 = Math.max(z1, b.z + b.d / 2 + 12); }
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
				// a mast and a dish on the headquarters' roof, a flagpole by its door (a plain banner)
				B.cyl('dark', 0.08, 0.12, 12, b.x + b.w / 2 - 3, b.h + 6, b.z - 3, 6, STEEL);
				B.add('paint', new THREE.SphereGeometry(1.4, 12, 6, 0, Math.PI * 2, 0, H * 0.8), b.x - b.w / 2 + 4, b.h + 1.6, b.z, 0, '#e2e2de', -0.9);
				B.cyl('dark', 0.06, 0.06, 10, b.x - 6, 5, b.z + b.d / 2 + 6, 6, STEEL);
				B.box('canvas', 0.04, 1.2, 1.9, b.x - 6, 8.6, b.z + b.d / 2 + 7.0, H, '#3f4a33');
				B.box('lamp', 0.3, 0.3, 0.3, b.x + b.w / 2 - 3, b.h + 12, b.z - 3, 0, '#ff3030');
			}
		} else if (b.type === 'guardhouse') {
			B.box('concrete', b.w, b.h, b.d, b.x, 0, b.z, yaw, CONC);
			B.box('paint', b.w + 1.6, 0.18, b.d + 1.6, b.x, b.h, b.z, yaw, ROOF);
			for (const s of [-1, 1]) B.box('glass', b.w * 0.8, 1.0, 0.06, b.x, 1.1, b.z + s * (b.d / 2 + 0.02), yaw);
			B.box('glass', 0.06, 1.0, b.d * 0.6, b.x - b.w / 2 - 0.02, 1.1, b.z, yaw);
			B.box('lamp', 0.5, 0.18, 0.18, b.x, b.h - 0.3, b.z + b.d / 2 + 0.1, yaw, '#ffe7b0');
		} else if (b.type === 'armoury') {
			// a bunker: concrete under an earth bank, a steel door in its face
			B.box('concrete', b.w, b.h, b.d, b.x, 0, b.z, yaw, CONC2);
			B.extrude('paint', [[-b.w / 2 - 6, 0], [b.w / 2 + 6, 0], [b.w / 2, b.h + 0.6], [-b.w / 2, b.h + 0.6]], b.d - 0.4, b.x, 0, b.z - 0.8, 0, EARTH);
			B.box('dark', 3.2, 3.0, 0.2, b.x, 0, b.z + b.d / 2 + 0.25, yaw, '#4d5258');
			B.box('concrete', 5.5, 4.2, 0.5, b.x, 0, b.z + b.d / 2 + 0.05, yaw, CONC);
			B.box('lamp', 0.5, 0.2, 0.2, b.x, 3.6, b.z + b.d / 2 + 0.4, yaw, '#ffe7b0');
			// sandbags either side of the door
			for (const s of [-1, 1]) for (let k = 0; k < 3; k++) B.box('canvas', 2.6, 0.32, 0.6, b.x + s * 4.2, k * 0.32, b.z + b.d / 2 + 2.2, yaw + s * 0.2, KHAKI);
		} else if (b.type === 'motorpool') {
			// an open shed: columns, a sloping roof, a back wall; the floor concrete
			B.strip('asphalt', b.w + 10, b.d + 18, b.x, 0.065, b.z + 6, 0, '#8a8780', 0.001);
			for (let i = 0; i <= 6; i++) { const x = b.x - b.w / 2 + i * b.w / 6; for (const s of [-1, 1]) B.box('dark', 0.35, b.h - (s > 0 ? 0 : 0.8), 0.35, x, 0, b.z + s * b.d / 2, 0, STEEL); }
			B.box('metal', b.w + 1, 0.15, b.d + 3, b.x, b.h - 0.4, b.z + 0.5, 0, '#9ea3a5', 0.05);
			B.box('metal', b.w, b.h - 0.8, 0.12, b.x, 0, b.z - b.d / 2, 0, '#8e9497');
			for (let i = 0; i < 6; i++) B.box('lamp', 0.8, 0.12, 0.3, b.x - b.w / 2 + 4.5 + i * (b.w - 9) / 5, b.h - 0.6, b.z + 2, 0, '#fff1d0');
			// shipping containers and drums at its end
			for (let i = 0; i < 3; i++) B.box('metal', 6.1, 2.6, 2.45, b.x - b.w / 2 - 8, i === 2 ? 2.6 : 0, b.z - 4 + (i % 2) * 2.6, H, ['#6b7a5a', '#8a5a3c', '#5a6b7a'][i]);
			for (let i = 0; i < 6; i++) B.cyl('paint', 0.3, 0.3, 0.9, b.x + b.w / 2 + 3 + (i % 3) * 0.65, 0.45, b.z - 6 + Math.floor(i / 3) * 0.65, 10, '#3f5a3a');
		} else if (b.type === 'fuel') {
			B.box('concrete', b.w + 3, 0.8, b.d + 3, b.x, 0, b.z, 0, CONC2);
			for (const s of [-1, 1]) { B.cyl('paint', 1.6, 1.6, b.w - 2, b.x, 2.4, b.z + s * 2.3, 16, '#d9d9d2', 0, H); for (const e of [-1, 1]) B.box('concrete', 0.5, 0.9, 3.2, b.x + e * (b.w / 2 - 3), 0.8, b.z + s * 2.3, 0, CONC2); }
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
			const fx = b.x - Math.sign(b.x) * 0.6, fz = b.z - Math.sign(b.z) * 0.6;
			B.box('lamp', 0.6, 0.4, 0.6, fx, p + 2.1, fz, Math.atan2(-b.x, -b.z), '#fff6dc');
			lights.push({ x: b.x, z: b.z, y: p + 2 });
		} else if (b.type === 'control') {
			// the control tower: a shaft with its stair windows, the glass cab, a beacon
			B.box('concrete', b.w, b.h - 4, b.d, b.x, 0, b.z, 0, '#d0cbbd');
			for (let k = 0; k < 4; k++) B.box('glass', 0.06, 1.2, 1.6, b.x + b.w / 2 + 0.02, 2 + k * 3.4, b.z, 0);
			B.box('concrete', b.w + 3, 0.4, b.d + 3, b.x, b.h - 4, b.z, 0, '#d0cbbd');
			B.box('glass', b.w + 2.4, 2.8, b.d + 2.4, b.x, b.h - 3.6, b.z, 0);
			for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box('dark', 0.2, 2.8, 0.2, b.x + sx * (b.w / 2 + 1.2), b.h - 3.6, b.z + sz * (b.d / 2 + 1.2), 0, STEEL);
			B.box('paint', b.w + 3.4, 0.35, b.d + 3.4, b.x, b.h - 0.8, b.z, 0, ROOF);
			B.box('lamp', b.w + 2.2, 0.3, b.d + 2.2, b.x, b.h - 3.2, b.z, 0, '#4fd0ff');
			B.cyl('dark', 0.05, 0.05, 4, b.x, b.h + 1.6, b.z, 6, STEEL);
			B.box('lamp', 0.35, 0.35, 0.35, b.x, b.h + 3.6, b.z, 0, '#ff3030');
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
		} else if (b.type === 'runway') {
			B.strip('asphalt', b.w, b.d, b.x, 0.14, b.z, 0, '#4b4b49', 2);
			// edge lights, threshold lights (green), end lights (red)
			for (let x = -b.w / 2; x <= b.w / 2; x += 60) for (const s of [-1, 1]) B.box('lamp', 0.3, 0.3, 0.3, b.x + x, 0.06, b.z + s * (b.d / 2 + 1.2), 0, '#fff6d8');
			for (const e of [-1, 1]) for (let v = -b.d / 2; v <= b.d / 2; v += 2.5) B.box('lamp', 0.3, 0.25, 0.3, b.x + e * (b.w / 2 + 2), 0.06, b.z + v, 0, e > 0 ? '#ff3a30' : '#30ff60');
			// the approach lights out past one end
			for (let i = 1; i <= 6; i++) B.box('lamp', 0.5, 0.25, 6, b.x - b.w / 2 - 6 - i * 12, 0.06, b.z, 0, '#fff6d8');
		} else if (b.type === 'taxiway') {
			B.strip('asphalt', b.w, b.d, b.x, 0.12, b.z, 0, '#555553', 1);
			if (!b.link) for (let x = -b.w / 2; x <= b.w / 2; x += 50) for (const s of [-1, 1]) B.box('lamp', 0.25, 0.25, 0.25, b.x + x, 0.06, b.z + s * (b.d / 2 + 1), 0, '#3a8cff');
		} else if (b.type === 'apron') {
			B.strip('asphalt', b.w, b.d, b.x, 0.11, b.z, 0, '#6a6965', 0.5);
			for (let i = 0; i < 4; i++) { const x = b.x - b.w / 2 + 20 + i * (b.w - 40) / 3; B.cyl('dark', 0.15, 0.2, 14, x, 7, b.z - b.d / 2 - 4, 8, STEEL); B.box('lamp', 1.6, 0.5, 0.8, x, 14, b.z - b.d / 2 - 3.6, 0, '#fff3d6'); lights.push({ x, z: b.z - b.d / 2, y: 14 }); }
		} else if (b.type === 'helipad') {
			B.box('concrete', b.w, 0.18, b.d, b.x, 0, b.z, 0, '#a9a69d');
			B.strip('asphalt', b.w - 2, b.d - 2, b.x, 0.2, b.z, 0, '#4f4f4c', 0.1);
			for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.box('lamp', 0.3, 0.2, 0.3, b.x + Math.cos(a) * (b.w / 2 - 0.6), 0.18, b.z + Math.sin(a) * (b.w / 2 - 0.6), 0, '#ffd23a'); }
		} else if (b.type === 'gate') {
			// the gate: two posts, a boom striped red and white, sandbag walls either side
			for (const s of [-1, 1]) B.box('concrete', 1.0, 2.6, 1.0, b.x + s * (b.w / 2 + 0.6), 0, b.z, 0, CONC);
			for (let i = 0; i < 8; i++) B.cbox('paint', b.w / 8, 0.14, 0.14, b.x - b.w / 2 + (i + 0.5) * b.w / 8, 1.1, b.z + 0.8, 0, i % 2 ? '#e8e8e4' : '#b8241c');
			B.box('dark', 0.4, 1.2, 0.4, b.x - b.w / 2 - 0.2, 0, b.z + 0.8, 0, STEEL);
			for (const s of [-1, 1]) for (let k = 0; k < 3; k++) B.box('canvas', 3.2, 0.32, 0.7, b.x + s * (b.w / 2 + 3.4), k * 0.32, b.z + 4, 0, KHAKI);
			B.box('lamp', 0.5, 0.3, 0.3, b.x, 3.4, b.z, 0, '#fff3d6');
			B.cyl('dark', 0.12, 0.12, 3.4, b.x, 1.7, b.z - 0.2, 6, STEEL);
		}
		if (b.interior) frames.push(b);
	}

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
	for (const g of Object.values(geos)) {
		const P = g.attributes.position;
		for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + padAt(base, P.getX(i), P.getZ(i)));
		P.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox();
	}
	const group = new THREE.Group(); group.name = 'mil-base:' + base.name;
	for (const [mat, g] of Object.entries(geos)) { const m = new THREE.Mesh(g, kit[mat]); m.castShadow = !opts.phone && mat !== 'asphalt' && mat !== 'lamp' && mat !== 'fence'; m.receiveShadow = true; m.name = 'mil-' + mat; group.add(m); }
	group.position.set(base.x, 0, base.z); group.rotation.y = base.yaw;
	return { group, frames, lights, draws: Object.keys(geos).length, tris: Object.values(geos).reduce((a, g) => a + g.attributes.position.count / 3, 0) };
}
