// Inside the towers. Walk up to any tall building (a downtown tower, a big office block) and
// in through its glass front: a lobby of stone and glass, the reception desk, seating, and a
// bank of elevators in the core at the back. Step up to them and the panel comes up: every
// floor, the lobby, the roof. Each tower is offices or homes, by its own hash:
//   office floors: open-plan desks with their screens and chairs, a glass meeting room, a
//     kitchen by the core, the ceiling of light panels, people at work through the day;
//   residential floors: one home to a floor, open living and dining, a kitchen island, the
//     bedroom behind its wall; and at the top the penthouse, its ceilings twice as high;
//   the roof: out onto it, a parapet round the edge, the city all round and below.
// Every floor is glass all round, so what you see out of it is the real city from that
// height. Only the floor you are on is built (and the lobby, while you are near); the
// building's own block stays as it was outside.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crowd, ZONE, kidsAbout } from '../people/flow.js';

const LOBBY = 6.2, STOREY = 3.9, WALL = 0.3;
const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

export function createTowers(scene, bay, city, { isPhone = false, mount, hint = () => {}, player }) {
	const group = new THREE.Group();
	group.name = 'towers';
	scene.add(group);
	const S = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
	const M = {
		stone: S(0xd8d2c6, 0.35), stoneD: S(0x3a3a3c, 0.3), carpet: S(0x55585e, 0.95), oak: S(0xb08a5e, 0.5), wall: S(0xefede8, 0.9), ceil: S(0xf4f3ef, 0.9),
		panel: S(0xffffff, 0.5, { emissive: new THREE.Color(0xfff6e6), emissiveIntensity: 1.0 }), mull: S(0x2a2d31, 0.4, { metalness: 0.6 }),
		glass: S(0xb4c8d2, 0.05, { metalness: 0.3, transparent: true, opacity: 0.16, depthWrite: false }), steel: S(0xc0c4c8, 0.25, { metalness: 0.85 }),
		desk: S(0xf2f0ea, 0.5), dark: S(0x1e2124, 0.5), screen: S(0x0e1216, 0.3, { emissive: new THREE.Color(0x7fb4ff), emissiveIntensity: 1.0 }), glow: S(0x222222, 0.4, { emissive: new THREE.Color(0xffb347), emissiveIntensity: 1.4 }),
		sofa: S(0x5d6b73, 0.9), sofa2: S(0x9c7a5a, 0.9), rug: S(0xb9a58a, 1), green: S(0x3f6b3a, 0.8), pot: S(0x8a8078, 0.8), bed: S(0xeceae4, 0.9), throw: S(0x3d5a78, 0.9), piano: S(0x0b0b0c, 0.15, { metalness: 0.2 }),
		art: [S(0xd9452c, 0.8), S(0x2c6fd9, 0.8), S(0xe8c547, 0.8), S(0x2a9d8f, 0.8)],
	};
	const FILL = [M.stone, M.carpet, M.oak, M.wall, M.ceil, M.desk, M.sofa, M.sofa2, M.rug, M.bed, M.throw, M.green, ...M.art];
	for (const m of FILL) { m.emissive = m.color.clone(); m.emissiveIntensity = 0.12; }

	let T = null;                 // the tower you are at: { o, key, lobby, up, levels, type, ... }
	const P = () => player();

	// ---------- a tower's plan ----------
	function plan(o) {
		// the lobby floor level with the highest corner of the lot, a step up off the pavement
		let g0 = -1e9;
		for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) { const ca = Math.cos(o.a), sa = Math.sin(o.a), lx = sx * o.w / 2, lz = sz * o.d / 2; g0 = Math.max(g0, bay.heightAt(o.x + ca * lx - sa * lz, o.z + sa * lx + ca * lz)); }
		const floor0 = g0 + 0.25, top = o.y + o.h, key = Math.round(o.x) + ':' + Math.round(o.z);
		const r = hh(Math.round(o.x * 0.37), Math.round(o.z * 0.29)), home = r < 0.42;
		const W = o.w, D = o.d, hw = W / 2 - WALL, hd = D / 2 - WALL;
		const n = Math.max(1, Math.floor((top - floor0 - LOBBY - 1.2) / STOREY));
		const levels = [{ n: 0, y: floor0, h: LOBBY, kind: 'lobby' }];
		for (let i = 1; i <= n; i++) {
			const pent = home && i === n && top - floor0 > 35;
			levels.push({ n: i, y: floor0 + LOBBY + (i - 1) * STOREY, h: pent ? Math.min(STOREY * 2, top - (floor0 + LOBBY + (i - 1) * STOREY) - 0.4) : STOREY, kind: home ? (pent ? 'penthouse' : 'home') : 'office' });
			if (pent) break;
		}
		levels.push({ n: 'R', y: top, h: 0, kind: 'roof' });
		const coreW = Math.min(10, W * 0.42), coreD = Math.min(4.5, D * 0.22);
		return { o, key, floor0, top, W, D, hw, hd, type: home ? 'home' : 'office', levels, coreW, coreD, coreZ: -hd + coreD, r };
	}

	// ---------- building one level ----------
	function level(T, L) {
		const { hw, hd, coreW, coreD } = T, parts = new Map(), col = [], seats = [];
		const add = (m, g) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(g.index ? g.toNonIndexed() : g); };
		const box = (m, x0, y0, z0, x1, y1, z1, solid = false) => { add(m, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); if (solid) col.push([x0, z0, x1, z1, y0, y1]); };
		const cyl = (m, x, y, z, r, h, seg = 12) => add(m, new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z));
		const H = L.h, rnd = (() => { let k = 1; return () => hh(T.r * 97 + k++ * 0.37, (typeof L.n === 'number' ? L.n : 99) * 1.3); })();
		const plant = (x, z) => { cyl(M.pot, x, 0, z, 0.3, 0.55); add(M.green, new THREE.SphereGeometry(0.55, 10, 8).scale(1, 1.3, 1).translate(x, 1.25, z)); col.push([x - 0.35, z - 0.35, x + 0.35, z + 0.35, 0, 1.2]); };
		const chair = (x, z, yaw) => { box(M.dark, x - 0.24, 0.44, z - 0.24, x + 0.24, 0.5, z + 0.24); const bx = x + Math.sin(yaw) * 0.24, bz = z + Math.cos(yaw) * 0.24; box(M.dark, bx - (Math.abs(Math.cos(yaw)) * 0.22 + 0.02), 0.5, bz - (Math.abs(Math.sin(yaw)) * 0.22 + 0.02), bx + (Math.abs(Math.cos(yaw)) * 0.22 + 0.02), 1.0, bz + (Math.abs(Math.sin(yaw)) * 0.22 + 0.02)); cyl(M.steel, x, 0, z, 0.03, 0.44, 6); seats.push([x, z, yaw, true, 0.47]); };

		if (L.kind === 'roof') {
			// the parapet round the edge, the stair and lift housing on the core
			const e = 0.25;
			for (const [x0, z0, x1, z1] of [[-hw - e, -hd - e, hw + e, -hd], [-hw - e, hd, hw + e, hd + e], [-hw - e, -hd, -hw, hd], [hw, -hd, hw + e, hd]]) box(M.stoneD, x0, 0, z0, x1, 1.1, z1, true);
			box(M.stone, -coreW / 2, 0, T.coreZ - coreD, coreW / 2, 3.2, T.coreZ, true);
			for (const dx of [-coreW / 3, 0, coreW / 3]) box(M.steel, dx - 0.55, 0, T.coreZ - 0.02, dx + 0.55, 2.2, T.coreZ + 0.04);
			return finish(parts, col, seats, L);
		}
		// the floor, the ceiling, the glass all round
		box(L.kind === 'lobby' ? M.stone : L.kind === 'office' ? M.carpet : M.oak, -hw - WALL, -0.3, -hd - WALL, hw + WALL, 0, hd + WALL);
		box(M.ceil, -hw - WALL, H - 0.25, -hd - WALL, hw + WALL, H, hd + WALL);
		for (let x = -hw + 1.8; x < hw - 1; x += 3.2) for (let z = -hd + 1.8; z < hd - 1; z += 3.2) box(M.panel, x - 0.5, H - 0.27, z - 0.5, x + 0.5, H - 0.25, z + 0.5);
		const door = L.kind === 'lobby' ? 1.4 : 0;
		const side = (x0, z0, x1, z1, gap) => {
			// glass between mullions, a dark band at the floor and at the ceiling
			const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = along ? x1 - x0 : z1 - z0;
			const pane = (a0, a1) => {
				if (a1 - a0 < 0.05) return;
				if (along) { add(M.glass, new THREE.BoxGeometry(a1 - a0, H - 0.6, 0.03).translate((a0 + a1) / 2, 0.3 + (H - 0.6) / 2, z0)); col.push([a0, z0 - WALL / 2, a1, z0 + WALL / 2, 0, H]); }
				else { add(M.glass, new THREE.BoxGeometry(0.03, H - 0.6, a1 - a0).translate(x0, 0.3 + (H - 0.6) / 2, (a0 + a1) / 2)); col.push([x0 - WALL / 2, a0, x0 + WALL / 2, a1, 0, H]); }
			};
			const a0 = along ? x0 : z0;
			if (gap) { pane(a0, -gap); pane(gap, a0 + len); } else pane(a0, a0 + len);
			for (let a = a0; a <= a0 + len + 0.01; a += Math.max(1.4, len / Math.max(1, Math.round(len / 1.6)))) {
				if (gap && Math.abs(a) < gap) continue;
				if (along) box(M.mull, a - 0.04, 0, z0 - 0.06, a + 0.04, H, z0 + 0.06); else box(M.mull, x0 - 0.06, 0, a - 0.04, x0 + 0.06, H, a + 0.04);
			}
			if (along) { box(M.mull, x0, 0, z0 - 0.08, x1, 0.3, z0 + 0.08); box(M.mull, x0, H - 0.3, z0 - 0.08, x1, H, z0 + 0.08); } else { box(M.mull, x0 - 0.08, 0, z0, x0 + 0.08, 0.3, z1); box(M.mull, x0 - 0.08, H - 0.3, z0, x0 + 0.08, H, z1); }
		};
		side(-hw, hd, hw, hd, door); side(-hw, -hd, hw, -hd, 0); side(-hw, -hd, -hw, hd, 0); side(hw, -hd, hw, hd, 0);
		if (door) { box(M.mull, -door - 0.1, 0, hd - 0.1, -door, 2.9, hd + 0.1); box(M.mull, door, 0, hd - 0.1, door + 0.1, 2.9, hd + 0.1); box(M.mull, -door, 2.8, hd - 0.1, door, 2.95, hd + 0.1); }
		// the core: stone, three elevator doors facing the floor, the floor number glowing over them
		const cz = T.coreZ;
		box(L.kind === 'lobby' ? M.stone : M.wall, -coreW / 2, 0, cz - coreD, coreW / 2, H - 0.25, cz, true);
		for (const dx of [-coreW / 3, 0, coreW / 3]) {
			box(M.steel, dx - 0.55, 0, cz - 0.02, dx - 0.005, 2.3, cz + 0.03); box(M.steel, dx + 0.005, 0, cz - 0.02, dx + 0.55, 2.3, cz + 0.03);
			box(M.glow, dx - 0.12, 2.45, cz, dx + 0.12, 2.55, cz + 0.04);
		}
		box(M.glow, -0.05, 1.1, cz, 0.05, 1.3, cz + 0.05);
		const iz0 = cz + 2.6, iz1 = hd - 1.2, ix0 = -hw + 1.0, ix1 = hw - 1.0;
		if (L.kind === 'lobby') {
			// reception, the seating by the windows, planters, a long piece of art on the core
			box(M.oak, -2.2, 0, iz0 + 1.2, 2.2, 1.1, iz0 + 2.0, true); box(M.stoneD, -2.3, 1.1, iz0 + 1.1, 2.3, 1.16, iz0 + 2.1);
			seats.push([0, iz0 + 0.6, Math.PI, false]);
			box(M.art[Math.floor(rnd() * 4)], -coreW / 2 + 0.6, 1.6, cz + 0.02, -coreW / 2 + 2.6, 3.8, cz + 0.06);
			box(M.art[Math.floor(rnd() * 4)], coreW / 2 - 2.6, 1.6, cz + 0.02, coreW / 2 - 0.6, 3.8, cz + 0.06);
			for (const sx of [-1, 1]) {
				const x = sx * Math.max(3.5, hw - 3.5), z = hd - 3.5;
				box(M.sofa, x - 1.2, 0, z - 0.45, x + 1.2, 0.42, z + 0.45, true); box(M.sofa, x - 1.2, 0.42, z + 0.3, x + 1.2, 0.85, z + 0.45);
				box(M.stoneD, x - 0.6, 0, z - 1.6, x + 0.6, 0.4, z - 0.9, true);
				for (const dx of [-0.6, 0.6]) seats.push([x + dx, z, 0, true, 0.46]);
				plant(x + sx * 1.8, z - 1.2);
			}
		} else if (L.kind === 'office') {
			// rows of desks across the floor, a glass meeting room in the corner, the kitchen
			const mx = ix1 - 5, mz = iz1 - 4;
			for (let z = iz0 + 1.2; z < iz1 - 1.5; z += 3.4) for (let x = ix0 + 1; x < ix1 - 1.2; x += 1.7) {
				if (x > mx - 1 && z > mz - 1) continue;
				box(M.desk, x - 0.78, 0.72, z - 0.4, x + 0.78, 0.76, z + 0.4, true);
				box(M.steel, x - 0.74, 0, z - 0.36, x - 0.7, 0.72, z + 0.36); box(M.steel, x + 0.7, 0, z - 0.36, x + 0.74, 0.72, z + 0.36);
				box(M.screen, x - 0.3, 0.8, z - 0.32, x + 0.3, 1.18, z - 0.29); box(M.dark, x - 0.03, 0.76, z - 0.3, x + 0.03, 0.8, z - 0.24);
				chair(x, z + 0.75, 0);
			}
			// (the meeting room: glass on two sides, a long table, chairs round it)
			add(M.glass, new THREE.BoxGeometry(5, H - 0.3, 0.03).translate(mx + 2, (H - 0.3) / 2, mz - 1)); col.push([mx - 0.5, mz - 1.1, mx + 3.6, mz - 0.9, 0, H]);
			add(M.glass, new THREE.BoxGeometry(0.03, H - 0.3, 5).translate(mx - 0.5, (H - 0.3) / 2, mz + 1.5)); col.push([mx - 0.6, mz - 1, mx - 0.4, mz + 2.6, 0, H]);
			box(M.oak, mx + 0.4, 0.72, mz + 0.4, mx + 3.6, 0.77, mz + 2.2, true);
			for (let x = mx + 0.8; x < mx + 3.5; x += 0.9) { chair(x, mz + 0.05, Math.PI); chair(x, mz + 2.55, 0); }
			box(M.wall, -coreW / 2 - 4, 0, cz - 0.7, -coreW / 2 - 0.2, 0.92, cz, true); box(M.stoneD, -coreW / 2 - 4, 0.92, cz - 0.75, -coreW / 2 - 0.2, 0.96, cz + 0.02);
			seats.push([-coreW / 2 - 2, cz + 0.6, Math.PI, false]);
			plant(ix0 + 0.4, iz1 - 0.4); plant(ix1 - 0.4, iz0 + 0.4);
		} else {
			// a home: living by the windows, dining, the kitchen island by the core, the bedroom
			// behind a wall to one side; the penthouse with a grand piano
			const lz = hd - 4.5;
			box(M.rug, -3, 0, lz - 2, 3, 0.02, lz + 2);
			box(M.sofa2, -2.6, 0, lz + 0.6, 2.6, 0.42, lz + 1.5, true); box(M.sofa2, -2.6, 0.42, lz + 1.25, 2.6, 0.9, lz + 1.5);
			for (const dx of [-1.6, 0, 1.6]) seats.push([dx, lz + 1.0, 0, true, 0.44]);
			box(M.oak, -0.9, 0, lz - 0.6, 0.9, 0.4, lz + 0.2, true);
			box(M.dark, -1.6, 0, lz - 2.4, 1.6, 0.5, lz - 2.0, true); box(M.screen, -1.1, 0.9, lz - 2.3, 1.1, 2.1, lz - 2.25);
			const dx0 = Math.min(hw - 4, 6);
			box(M.oak, dx0 - 1, 0.72, lz - 4.8, dx0 + 1, 0.76, lz - 3.8, true);
			for (const [x, z, yaw] of [[dx0 - 0.5, lz - 5.25, Math.PI], [dx0 + 0.5, lz - 5.25, Math.PI], [dx0 - 0.5, lz - 3.35, 0], [dx0 + 0.5, lz - 3.35, 0]]) chair(x, z, yaw);
			box(M.stone, -2, 0, cz + 1.4, 2, 0.92, cz + 2.4, true); box(M.stoneD, -2.05, 0.92, cz + 1.35, 2.05, 0.96, cz + 2.45);
			seats.push([0, cz + 2.9, Math.PI, false]);
			// the bedroom: a wall with a doorway, the bed and its tables
			const bx = -hw + Math.min(7, hw * 0.8);
			box(M.wall, bx - 0.08, 0, cz, bx + 0.08, H - 0.25, cz + 2, true); box(M.wall, bx - 0.08, 0, cz + 3.2, bx + 0.08, H - 0.25, Math.min(lz - 3, hd - 1), true);
			box(M.bed, -hw + 0.6, 0, cz + 1.6, -hw + 2.8, 0.55, cz + 3.8, true); box(M.throw, -hw + 0.6, 0.55, cz + 3.1, -hw + 2.8, 0.6, cz + 3.8); box(M.oak, -hw + 0.3, 0, cz + 1.6, -hw + 3.1, 1.2, cz + 1.75);
			if (L.kind === 'penthouse') { box(M.piano, dx0 - 1, 0.7, lz - 1.6, dx0 + 1, 1.0, lz + 0.6, true); for (const [x, z] of [[dx0 - 0.8, lz - 1.4], [dx0 + 0.8, lz - 1.4], [dx0, lz + 0.4]]) box(M.piano, x - 0.05, 0, z - 0.05, x + 0.05, 0.7, z + 0.05); }
			plant(ix0 + 0.4, hd - 1); plant(ix1 - 0.4, hd - 1);
		}
		return finish(parts, col, seats, L);
	}
	function finish(parts, col, seats, L) {
		const g = new THREE.Group();
		for (const [m, list] of parts) { const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.receiveShadow = true; mesh.castShadow = !isPhone && m !== M.glass; g.add(mesh); }
		const o = T.o;
		g.position.set(o.x, L.y, o.z); g.rotation.y = -o.a;
		group.add(g);
		return { g, col, seats, L, dispose: () => g.traverse((q) => q.geometry?.dispose()) };
	}
	const local = (x, z) => { const o = T.o, dx = x - o.x, dz = z - o.z, ca = Math.cos(o.a), sa = Math.sin(o.a); return [ca * dx + sa * dz, -sa * dx + ca * dz]; };
	const world = (lx, lz) => { const o = T.o, ca = Math.cos(o.a), sa = Math.sin(o.a); return [o.x + ca * lx - sa * lz, o.z + sa * lx + ca * lz]; };

	// ---------- the elevator ----------
	const panel = document.createElement('div');
	panel.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(120px + env(safe-area-inset-bottom));max-height:48dvh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;display:none;flex-direction:column;gap:4px;padding:10px;width:min(240px,70vw);border-radius:14px;background:rgba(8,20,26,.9);border:1px solid rgba(255,255,255,.2);z-index:6;color:#eafaf6;font:13px system-ui;';
	for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) panel.addEventListener(ev, (e) => e.stopPropagation());
	mount?.appendChild(panel);
	const veil = document.createElement('div');
	veil.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .35s;z-index:9;';
	mount?.appendChild(veil);
	let panelFor = null, busy = false;
	const label = (L) => (L.kind === 'lobby' ? 'L · Lobby' : L.kind === 'roof' ? 'R · Roof' : `${L.n} · ${L.kind === 'office' ? 'Offices' : L.kind === 'penthouse' ? 'Penthouse' : 'Residence'}`);
	function showPanel(cur) {
		if (panelFor === T.key + ':' + cur.n) return;
		panelFor = T.key + ':' + cur.n;
		panel.innerHTML = `<div style="font-weight:700;opacity:.8;padding:0 2px 4px">Elevator · now ${label(cur)}</div>`;
		for (const L of [...T.levels].reverse()) {
			const b = document.createElement('button');
			b.textContent = label(L);
			b.style.cssText = `flex:none;text-align:left;padding:9px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:${L === cur ? 'rgba(1,169,130,.35)' : 'transparent'};color:#eafaf6;font:13px system-ui;min-height:40px;cursor:pointer;`;
			b.onclick = (e) => { e.stopPropagation(); go(L); };
			panel.appendChild(b);
		}
		panel.style.display = 'flex';
	}
	function go(L) {
		if (busy || !T) return;
		busy = true;
		veil.style.opacity = '1';
		setTimeout(() => {
			if (T) {
				if (T.up && T.up.L !== L) { group.remove(T.up.g); T.up.dispose(); T.up = null; }
				if (L.kind !== 'lobby' && !T.up) T.up = level(T, L);
				// out of the doors in front of the middle elevator
				const [x, z] = world(0, T.coreZ + 3.2), p = P();
				p.pos.set(x, L.y + 1.7, z);
				p.vel?.set(0, 0, 0);
				p.yaw = Math.PI - T.o.a;           // facing out, away from the doors
				p.flying = false;
				hint(L.kind === 'roof' ? 'The roof' : label(L).replace(/^\d+ · /, `Floor ${L.n} · `), 2200);
			}
			panelFor = null;
			veil.style.opacity = '0';
			setTimeout(() => { busy = false; }, 400);
		}, 380);
	}

	// ---------- near you ----------
	let scanT = 0;
	function update(dt, camera, hours, nightK) {
		for (const m of FILL) m.emissiveIntensity = 0.12 + nightK * 0.25;
		M.panel.emissiveIntensity = 0.8 + nightK * 0.5;
		const p = P(), cam = camera.position;
		if (!p) return;
		scanT -= dt;
		if (scanT < 0) {
			scanT = 0.5;
			// the tower you are at (or in)
			const inT = T && (() => { const [lx, lz] = local(cam.x, cam.z); return Math.abs(lx) < T.W / 2 + 25 && Math.abs(lz) < T.D / 2 + 25 && cam.y < T.top + 30; })();
			if (!inT) {
				if (T) drop();
				const near = city?.towersNear?.(cam.x, cam.z, 22) || [];
				let best = null, bd = 1e9;
				for (const o of near) { const d = Math.hypot(o.x - cam.x, o.z - cam.z) - Math.max(o.w, o.d) / 2; if (d < bd && cam.y - bay.heightAt(cam.x, cam.z) < 40) { bd = d; best = o; } }
				if (best && bd < 22) { T = plan(best); T.lobby = level(T, T.levels[0]); }
			}
		}
		if (!T) { panel.style.display = 'none'; return; }
		// at the elevators, on whichever level: the panel
		const [lx, lz] = local(p.pos.x, p.pos.z), cur = levelAt(p.pos.y - 1.7);
		const atLift = cur && Math.abs(lx) < T.coreW / 2 + 0.3 && lz > T.coreZ && lz < T.coreZ + 2.4 && Math.abs(p.pos.y - 1.7 - cur.y) < 1;
		if (atLift && !busy) showPanel(cur); else if (!busy) { panel.style.display = 'none'; panelFor = null; }
	}
	function levelAt(y) {
		if (!T) return null;
		let best = null;
		for (const L of T.levels) if (y > L.y - 1.5 && (!best || L.y > best.y)) { if (L.kind === 'lobby' || T.up?.L === L) best = L; }
		return best;
	}
	function drop() {
		if (!T) return;
		for (const B of [T.lobby, T.up]) if (B) { group.remove(B.g); B.dispose(); }
		T = null; panel.style.display = 'none'; panelFor = null;
	}
	// the floors: the lobby's, the one you rode up to, the roof
	function floor(x, z, y) {
		if (!T) return -1e9;
		const [lx, lz] = local(x, z);
		if (Math.abs(lx) > T.W / 2 || Math.abs(lz) > T.D / 2) return -1e9;
		let best = -1e9;
		for (const B of [T.lobby, T.up]) if (B && y > B.L.y - 1.2) best = Math.max(best, B.L.y);
		return best;
	}
	function push(pos, footY) {
		if (!T) return;
		const R = 0.3;
		for (const B of [T.lobby, T.up]) {
			if (!B || footY < B.L.y - 0.5 || footY > B.L.y + Math.max(2, B.L.h)) continue;
			let [lx, lz] = local(pos.x, pos.z);
			if (Math.abs(lx) > T.W / 2 + 1 || Math.abs(lz) > T.D / 2 + 1) continue;
			const y0 = footY - B.L.y + 0.25, y1 = footY - B.L.y + 1.7;
			let moved = false;
			for (const c of B.col) {
				if (y1 < c[4] || y0 > c[5]) continue;
				const qx = Math.max(c[0], Math.min(c[2], lx)), qz = Math.max(c[1], Math.min(c[3], lz)), dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
				if (d2 >= R * R) continue;
				if (d2 < 1e-8) { const pen = [lx - c[0], c[2] - lx, lz - c[1], c[3] - lz], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) lx = c[0] - R; else if (k === 1) lx = c[2] + R; else if (k === 2) lz = c[1] - R; else lz = c[3] + R; }
				else { const d = Math.sqrt(d2); lx = qx + dx / d * R; lz = qz + dz / d * R; }
				moved = true;
			}
			if (moved) { const [wx, wz] = world(lx, lz); pos.x = wx; pos.z = wz; }
		}
	}
	// who is here: people at the desks, on the sofas, behind the counters (people/people.js)
	function venue(cam, hours) {
		if (!T) return null;
		const B = [T.up, T.lobby].find((q) => q && Math.abs(cam.y - 1.7 - q.L.y) < 2.5);
		if (!B) return null;
		const [lx, lz] = local(cam.x, cam.z);
		if (Math.abs(lx) > T.W / 2 + 6 || Math.abs(lz) > T.D / 2 + 6) return null;
		const k = B.L.kind === 'office' ? crowd(ZONE.office, hours).k : B.L.kind === 'lobby' ? 0.3 + crowd(ZONE.office, hours).k * 0.5 : 0.35;
		if (!B.spots) {
			const ca = Math.cos(T.o.a), sa = Math.sin(T.o.a);
			B.spots = B.seats.map(([x, z, yaw, sit, h = 0.46]) => {
				const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
				return { x: T.o.x + ca * x - sa * z, z: T.o.z + sa * x + ca * z, y: B.L.y, h: sit ? h : 0, sit, heading: Math.atan2(fx * ca - fz * sa, fx * sa + fz * ca), taken: false, table: sit && B.L.kind === 'office' };
			});
		}
		const n = Math.min(22, Math.round(B.spots.length * k * (B.L.kind === 'office' ? 0.6 : 0.5)));
		// the homes have their families in; a few children pass through the lobby
		const kids = B.L.kind === 'office' ? 0 : (B.L.kind === 'lobby' ? 0.08 : 0.3) * kidsAbout(hours);
		return n ? { n, kids, areas: [{ w: 1, seats: B.spots }] } : null;
	}
	// where you stand in the tower you're at: which tower, which level (for homes and shared spots)
	function here(pos) {
		if (!T) return null;
		const [lx, lz] = local(pos.x, pos.z);
		if (Math.abs(lx) > T.W / 2 || Math.abs(lz) > T.D / 2) return null;
		const L = levelAt(pos.y - 1.7);
		return L && { key: T.key, i: T.levels.indexOf(L), n: L.n, kind: L.kind, type: T.type, x: T.o.x, z: T.o.z, label: label(L) };
	}
	// build level i of this tower without moving you (the floor you are put back on)
	function raise(i) {
		const L = T?.levels[i];
		if (!L) return false;
		if (L.kind === 'lobby') return true;
		if (T.up && T.up.L !== L) { group.remove(T.up.g); T.up.dispose(); T.up = null; }
		if (!T.up) T.up = level(T, L);
		return true;
	}
	return { group, update, floor, push, venue, here, raise, key: () => T?.key || null, inside: () => !!T, levels: () => T?.levels.map(label) || [], go: (i) => { const L = T?.levels[i]; if (L) go(L); } };
}
