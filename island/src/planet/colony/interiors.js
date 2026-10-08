// Inside the colony. The shells, their walls, doors and decks are the colony's own
// (parts.js); here what is in them, built when you come near and let go when you leave:
// the farm under the dome, each module's room by its role (mess, quarters, med bay,
// workshop, lounge, supply depot), the tower lounge, the spaceport's control room. And
// what they do: lifts, airlocks that cycle as you suit up or down, and terminals with the
// colony map, rides out to the outposts, and the supply depot.

import * as THREE from 'three';
import { Kit, frame, box, cbox, prism, blob, ring } from '../alienkit.js';
import { inward, roverGeometry } from './parts.js';

const TAU = Math.PI * 2;
const HULL = 0, PRINT = 1, LAMP = 5;
const WALL = [0.80, 0.80, 0.78], DECK = [0.22, 0.23, 0.25], SOFT = [0.42, 0.46, 0.55], WHITE = [0.92, 0.93, 0.94];
const SCREEN = [[0.35, 0.85, 1.0], [0.4, 1.0, 0.6], [1.0, 0.7, 0.3]];
const GREEN = [0.16, 0.42, 0.14];

// what the supply depot holds (handed to the inventory when there is one: opts.give)
export const DEPOT = [
	{ id: 'oxygen-candle', name: 'Oxygen candle', note: 'six hours of air' },
	{ id: 'ration-pack', name: 'Ration pack', note: 'three days, rehydrated' },
	{ id: 'suit-patch', name: 'Suit patch kit', note: 'seals a tear in a minute' },
	{ id: 'geology-hammer', name: 'Geology hammer', note: 'for the crater rims' },
	{ id: 'core-sampler', name: 'Core sampler', note: 'a metre of regolith a go' },
];

export function createColonyInteriors(X, o) {
	const { S, camera, isPhone } = o;
	const group = new THREE.Group();
	group.name = 'colony:interiors';
	o.group.add(group);
	const mats = { room: o.roomMat, glass: o.glassMat };
	const live = new Map();
	const near = isPhone ? [110, 170] : [170, 260];

	// ---------- the rooms ----------
	function build(key) {
		const K = new Kit(), extra = [];
		const put = (F, tint, mode, g, lx = 0, ly = 0, lz = 0, ry = 0, rx = 0) => K.add('room', F.put(g, lx, ly, lz, ry, rx), { tint, glow: mode });
		const R = X.rooms;
		if (key === 'hub') {
			const d = R.dome, F = frame(d.x, d.y, d.z, d.yaw);
			put(F, DECK, HULL, new THREE.CylinderGeometry(d.r, d.r, 0.1, 40), 0, 0.03, 0);
			for (let k = 0; k < 4; k++) {
				const a = d.yaw + k / 4 * TAU + 0.4;
				put(F, WHITE, HULL, new THREE.CylinderGeometry(0.9, 0.9, 2.4, 14), Math.sin(a) * 12.2, 1.2, Math.cos(a) * 12.2);
				put(F, [0.3, 0.6, 0.9], LAMP, box(0.1, 1.6, 0.05), Math.sin(a) * 11.28, 1.3, Math.cos(a) * 11.28, a);
			}
			for (const M of R.modules) room(M, put, extra);
			for (const T of R.towers) lounge(T, put);
		}
		if (key === 'cab' && R.cab) control(R.cab, put, extra);
		const g = new THREE.Group();
		g.name = 'colony:rooms:' + key;
		for (const m of K.build(mats, g, true)) { m.castShadow = false; m.receiveShadow = false; }
		for (const m of extra) g.add(m);
		group.add(g);
		return g;
	}
	// a module's room: lined, decked, lit along its ridge, furnished by its role
	function room(M, put, extra) {
		const F = M.frame, z0 = M.d0, z1 = M.z1, L = M.L, D = 0.4;
		put(F, WALL, HULL, inward(new THREE.CylinderGeometry(3.0, 3.0, L * 0.7, 18, 1, true).rotateX(Math.PI / 2)), 0, 2.2, z0 + L * 0.35);
		o.windows.push(F.put(new THREE.CylinderGeometry(3.0, 3.0, L * 0.3, 18, 1, true).rotateX(Math.PI / 2), 0, 2.2, z0 + L * 0.85));
		put(F, DECK, HULL, box(5.0, 0.12, L), 0, D - 0.06, z0 + L / 2);
		put(F, WHITE, LAMP, box(0.3, 0.05, L - 1), 0, 4.9, z0 + L / 2);
		for (const z of [z0 + 0.06, z1 - 0.06]) {
			put(F, M.role === 'med' ? [0.3, 0.8, 0.7] : S.accent, HULL, box(0.12, 2.4, 0.12), -0.82, D + 1.15, z);
			put(F, M.role === 'med' ? [0.3, 0.8, 0.7] : S.accent, HULL, box(0.12, 2.4, 0.12), 0.82, D + 1.15, z);
			put(F, S.accent, HULL, box(1.76, 0.12, 0.12), 0, D + 2.36, z);
		}
		const zz = (t) => z0 + 1.6 + (L * 0.7 - 2.2) * t;
		const role = M.role;
		if (role === 'mess') {
			for (let k = 0; k < 3; k++) {
				const z = zz(k / 2.2);
				put(F, WHITE, HULL, cbox(1.2, 0.06, 1.7, 0.02), -1.25, D + 0.74, z);
				put(F, DECK, HULL, new THREE.CylinderGeometry(0.08, 0.2, 0.72, 8), -1.25, D + 0.36, z);
				for (const sz of [-1.05, 1.05]) put(F, S.accent, HULL, new THREE.CylinderGeometry(0.2, 0.2, 0.45, 10), -1.25, D + 0.22, z + sz);
				collide(F, -1.25, z, 0.7, 0.9);
			}
			put(F, WHITE, HULL, cbox(0.7, 0.92, L * 0.4, 0.05), 2.05, D + 0.46, zz(0.45));
			put(F, SCREEN[2], LAMP, box(0.05, 0.6, 1.4), 2.42, D + 1.7, zz(0.3));
			put(F, SCREEN[0], LAMP, box(0.05, 0.6, 1.4), 2.42, D + 1.7, zz(0.65));
			collide(F, 2.05, zz(0.45), 0.4, L * 0.2);
		} else if (role === 'quarters') {
			for (let k = 0; k * 2.4 < L * 0.65 - 2; k++) for (const sx of [-1, 1]) {
				const z = z0 + 2.2 + k * 2.4, x = sx * 1.85;
				for (const y of [0.45, 1.55]) {
					put(F, DECK, HULL, box(0.95, 0.12, 2.05), x, D + y, z);
					put(F, SOFT, HULL, cbox(0.85, 0.16, 1.9, 0.05), x, D + y + 0.14, z);
				}
				put(F, S.accent, HULL, box(0.04, 0.9, 1.0), x - sx * 0.48, D + 1.95, z + 0.45);
				put(F, S.window, LAMP, box(0.12, 0.06, 0.12), x + sx * 0.3, D + 1.1, z - 0.8);
				collide(F, x, z, 0.5, 1.05);
			}
		} else if (role === 'med') {
			for (let k = 0; k < 2; k++) {
				const z = zz(0.15 + k * 0.5);
				put(F, DECK, HULL, box(0.9, 0.6, 2.0), -1.6, D + 0.3, z);
				put(F, WHITE, HULL, cbox(0.86, 0.14, 1.95, 0.05), -1.6, D + 0.67, z);
				put(F, SCREEN[1], LAMP, box(0.05, 0.5, 0.8), -2.35, D + 1.5, z);
				collide(F, -1.6, z, 0.5, 1.05);
			}
			put(F, [0.3, 1.0, 0.9], LAMP, new THREE.TorusGeometry(0.95, 0.06, 6, 24, Math.PI), -1.6, D + 0.7, zz(0.15));
			put(F, WHITE, HULL, cbox(0.6, 1.9, 1.6, 0.05), 2.1, D + 0.95, zz(0.4));
			put(F, [0.3, 0.9, 0.8], LAMP, box(0.05, 0.5, 0.14), 1.78, D + 1.5, zz(0.4));
			put(F, [0.3, 0.9, 0.8], LAMP, box(0.05, 0.14, 0.5), 1.78, D + 1.5, zz(0.4));
			collide(F, 2.1, zz(0.4), 0.35, 0.85);
		} else if (role === 'workshop') {
			put(F, DECK, HULL, cbox(0.8, 0.9, 3.4, 0.04), 2.0, D + 0.45, zz(0.25));
			put(F, [0.1, 0.11, 0.12], HULL, box(0.05, 1.2, 3.2), 2.43, D + 1.7, zz(0.25));
			for (let k = 0; k < 8; k++) put(F, k % 2 ? S.accent : WALL, HULL, box(0.06, 0.12 + (k % 3) * 0.12, 0.08), 2.38, D + 1.4 + (k % 2) * 0.4, zz(0.25) - 1.4 + k * 0.4);
			put(F, S.window, LAMP, box(0.3, 0.05, 2.4), 2.0, D + 2.2, zz(0.25));
			collide(F, 2.0, zz(0.25), 0.45, 1.75);
			const rv = new THREE.Mesh(roverGeometry(S), o.roomMat);
			const p = F.p(-0.9, D + 0.3, zz(0.7));
			rv.position.set(p.x, p.y, p.z); rv.rotation.y = F.yaw; rv.scale.setScalar(0.85);
			extra.push(rv);
			for (const sz of [-1.2, 1.2]) put(F, S.accent, HULL, box(1.8, 0.3, 0.3), -0.9, D + 0.15, zz(0.7) + sz);
			collide(F, -0.9, zz(0.7), 1.2, 1.9);
		} else if (role === 'lounge') {
			for (const k of [0, 1]) {
				const z = zz(0.55 + k * 0.28);
				put(F, SOFT, HULL, cbox(2.6, 0.45, 0.8, 0.12), 0, D + 0.25, z);
				put(F, SOFT, HULL, cbox(2.6, 0.55, 0.22, 0.08), 0, D + 0.65, z - 0.32);
				collide(F, 0, z, 1.35, 0.45);
			}
			for (const sx of [-1.9, 1.9]) {
				put(F, S.print, PRINT, prism(8, 0.35, 0.28, 0.6), sx, D, zz(0.2));
				put(F, GREEN, HULL, blob(0.45, 0.6, 0.45, 8), sx, D + 0.9, zz(0.2));
			}
			put(F, SCREEN[0], LAMP, box(1.8, 1.0, 0.05), 0, D + 1.8, zz(0.08));
			o.terminals.push(term(F, 1.9, zz(0.35), M.y + D, 'map', 'Lounge terminal'));
		} else if (role === 'depot') {
			for (let k = 0; k < 4; k++) for (const sx of [-1, 1]) {
				const z = zz(0.05 + k * 0.24), x = sx * 2.0;
				for (const y of [0.05, 0.85, 1.65]) put(F, DECK, HULL, box(0.7, 0.06, 1.5), x, D + y, z);
				for (let c = 0; c < 4; c++) put(F, (c + k) % 3 ? S.accent : WALL, HULL, cbox(0.5, 0.45, 0.6, 0.04), x, D + 0.32 + (c % 3) * 0.8, z + (c > 1 ? 0.35 : -0.35));
				collide(F, x, z, 0.4, 0.8);
			}
			o.terminals.push(term(F, 0, zz(0.92), M.y + D, 'depot', 'Supply depot'));
		}
		// a screen and a console by the door in every room
		put(F, SCREEN[M.i % 3], LAMP, box(0.05, 0.45, 0.7), -2.3, D + 1.6, z1 - 1.6);
	}
	// the tower's lobby and lift, and its lounge up behind the window band
	function lounge(T, put) {
		const F = frame(T.x, T.y, T.z, T.yaw), top = T.top;
		put(F, WALL, HULL, inward(prism(12, 5.0, 4.8, 4)), 0, 0, 0);
		put(F, WALL, HULL, inward(new THREE.CylinderGeometry(4.8, 4.8, 0.1, 24)), 0, 4, 0);
		put(F, DECK, HULL, new THREE.CylinderGeometry(4.95, 4.95, 0.1, 24), 0, 0.03, 0);
		lift(F, put, 0, 4);
		put(F, DECK, HULL, new THREE.CylinderGeometry(4.0, 4.0, 0.3, 24), 0, top - 0.15, 0);
		put(F, WALL, HULL, inward(new THREE.CylinderGeometry(4.0, 4.0, 0.35, 24, 1, true)), 0, top + 0.15, 0);
		put(F, WALL, HULL, inward(new THREE.CylinderGeometry(4.0, 4.0, 1.4, 24, 1, true)), 0, top + 2.4, 0);
		put(F, WALL, HULL, inward(new THREE.CylinderGeometry(4.0, 4.0, 0.1, 24)), 0, top + 3.1, 0);
		put(F, WHITE, LAMP, ring(2.2, 0.15, 0.05, 24), 0, top + 3.0, 0);
		lift(F, put, top, 3.1);
		put(F, SOFT, HULL, ring(3.1, 0.8, 0.45, 20, false), 0, top, 0);
		for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + 0.5; put(F, GREEN, HULL, blob(0.4, 0.55, 0.4, 8), Math.sin(a) * 2.2, top + 0.55, Math.cos(a) * 2.2); }
		o.terminals.push(term(F, 0, 2.0, T.y + top, 'map', 'Tower lounge terminal'));
	}
	// the spaceport's control room: consoles in a ring facing out over the pads
	function control(C, put) {
		const F = frame(C.x, C.y, C.z, C.yaw), h = C.h, cab = C.cab;
		put(F, WALL, HULL, inward(prism(8, 3.3, 2.4, h)), 0, 0, 0);
		lift(F, put, 0, 3);
		put(F, DECK, HULL, new THREE.CylinderGeometry(6.3, 6.3, 0.2, 8, 1, false, Math.PI / 8), 0, cab - 0.1, 0);
		put(F, WALL, HULL, inward(new THREE.CylinderGeometry(7.1, 7.1, 0.1, 8, 1, false, Math.PI / 8)), 0, h + 5.5, 0);
		put(F, WHITE, LAMP, ring(3.0, 0.2, 0.05, 24), 0, h + 5.4, 0);
		lift(F, put, cab, 3);
		for (let k = 0; k < 5; k++) {
			const a = Math.PI + (k - 2) * 0.55, x = Math.sin(a) * 4.6, z = Math.cos(a) * 4.6;
			put(F, DECK, HULL, cbox(1.5, 0.8, 0.7, 0.06), x, cab + 0.4, z, a);
			put(F, SCREEN[k % 3], LAMP, box(1.3, 0.04, 0.5), x, cab + 0.82, z, a, -0.3);
			put(F, SCREEN[(k + 1) % 3], LAMP, box(1.2, 0.55, 0.04), x - Math.sin(a) * 0.3, cab + 1.25, z - Math.cos(a) * 0.3, a, 0.2);
			collide(F, x, z, 0.8, 0.8);
			if (k === 2) o.terminals.push(term(F, Math.sin(a) * 3.6, Math.cos(a) * 3.6, C.y + cab, 'control', 'Traffic control'));
		}
		put(F, [0.1, 0.12, 0.14], HULL, new THREE.CylinderGeometry(1.0, 1.1, 0.9, 16), 2.4, cab + 0.45, 1.6);
		put(F, SCREEN[0], LAMP, new THREE.CylinderGeometry(0.95, 0.95, 0.04, 16), 2.4, cab + 0.92, 1.6);
		collide(F, 2.4, 1.6, 1.1, 1.1);
	}
	function lift(F, put, y, h) {
		put(F, [0.3, 0.9, 1.0], LAMP, new THREE.CylinderGeometry(0.9, 0.9, 0.04, 20), 0, y + 0.05, 0);
		put(F, S.trim, HULL, ring(0.95, 0.12, 0.12, 20), 0, y + 0.02, 0);
		put(F, S.trim, HULL, ring(0.95, 0.12, 0.12, 20), 0, y + h - 0.15, 0);
	}
	const term = (F, lx, lz, y, kind, name) => { const p = F.p(lx, 0, lz); return { x: p.x, z: p.z, y, kind, name, live: true }; };
	// the furniture's solids, live while the rooms are
	let solids = [];
	function collide(F, lx, lz, hw, hd) { const p = F.p(lx, 0, lz); solids.push({ x: p.x, z: p.z, c: Math.cos(F.yaw), s: Math.sin(F.yaw), hw, hd, y: F.y }); }
	function push(p, footY) {
		for (const b of solids) {
			if (footY > b.y + 2.6 || footY < b.y - 1) continue;
			const dx = p.x - b.x, dz = p.z - b.z, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c, pad = 0.3;
			if (Math.abs(lx) >= b.hw + pad || Math.abs(lz) >= b.hd + pad) continue;
			const ex = b.hw + pad - Math.abs(lx), ez = b.hd + pad - Math.abs(lz);
			let nx = lx, nz = lz;
			if (ex < ez) nx = Math.sign(lx || 1) * (b.hw + pad); else nz = Math.sign(lz || 1) * (b.hd + pad);
			p.x = b.x + nx * b.c + nz * b.s; p.z = b.z - nx * b.s + nz * b.c;
		}
	}

	// ---------- near or far ----------
	let t = 0;
	function stream() {
		const cx = camera.position.x, cz = camera.position.z, R = X.rooms;
		const want = [['hub', R.dome], ['cab', R.cab]];
		for (const [key, at] of want) {
			if (!at) continue;
			const d = Math.hypot(cx - at.x, cz - at.z);
			if (!live.has(key) && d < near[0]) {
				const n0 = solids.length, t0 = o.terminals.length, w0 = o.windows.length;
				const g = build(key);
				live.set(key, { g, solids: solids.slice(n0), terms: o.terminals.slice(t0), wins: o.windows.slice(w0) });
				windowsMesh();
				return;
			}
			if (live.has(key) && d > near[1]) {
				const L = live.get(key);
				group.remove(L.g);
				L.g.traverse((m) => { if (m.geometry && !m.geometry.userData.keep) m.geometry.dispose(); });
				solids = solids.filter((s) => !L.solids.includes(s));
				for (const q of L.terms) o.terminals.splice(o.terminals.indexOf(q), 1);
				for (const w of L.wins) { o.windows.splice(o.windows.indexOf(w), 1); w.dispose(); }
				live.delete(key);
				windowsMesh();
			}
		}
	}
	// the window sections, seen from inside: clear glass onto the plain
	let winMesh = null;
	function windowsMesh() {
		if (winMesh) { group.remove(winMesh); winMesh.geometry.dispose(); winMesh = null; }
		if (!o.windows.length) return;
		const K = new Kit();
		for (const w of o.windows) K.add('glass', inward(w.clone()), {});
		const g = new THREE.Group();
		K.build(mats, g, true);
		winMesh = g.children[0];
		group.add(winMesh);
	}
	function update(dt) {
		t -= dt;
		if (t <= 0) { t = 0.4; stream(); }
	}
	function dispose() {
		group.traverse((m) => m.geometry?.dispose());
		for (const w of o.windows) w.dispose();
		o.group.remove(group);
	}
	return { update, push, dispose, live, group, info: () => ({ rooms: [...live.keys()], solids: solids.length }) };
}
