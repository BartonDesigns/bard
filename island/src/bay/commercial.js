// Walk-in shops, cafés, restaurants, offices and places to play. Within a few dozen metres
// the mapped commercial buildings (the shops along a main street, a strip centre, an office
// block's ground floor) stop being painted blocks and are built for real, the way the
// houses are (houses.js): walls with thickness, a glass storefront with its door open, a
// ceiling of light panels, and inside, a fit-out for what the place is:
//   café        - the counter and espresso machine, a pastry case, little round tables
//   restaurant  - tables laid for two and four, booths down one wall, a bar with stools
//   shop        - aisles of shelving, a checkout by the door
//   office      - a reception desk and lobby sofa, rows of desks with screens, a glass meeting room
//   arcade      - cabinets glowing down both sides, a prize counter
//   bowling     - lanes of polished wood, pins at the far end, a ball return
//   cinema      - a lobby with its concession stand, then a dark hall of raked seats and the screen
// and the people in them by the hour (people/flow.js): cafés full over breakfast, offices
// through the working day, restaurants from dusk, the arcade and lanes in the evening.
// Everything in a building is merged per material, so each is a handful of draws.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crowd, ZONE } from '../people/flow.js';

const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const CEIL = 3.6, WALL = 0.3, STORE = 3.1;

// what a commercial block is, from its kind, size and where it stands (stable for a place)
function typeOf(b) {
	const r = hh(Math.round(b.x * 0.37), Math.round(b.z * 0.29)), area = b.w * b.d, deep = Math.min(b.w, b.d);
	if (b.kind === 5) return area > 1400 && r < 0.18 && deep > 24 ? 'cinema' : r < 0.2 ? 'restaurant' : r < 0.3 ? 'cafe' : 'office';
	if (area > 900 && deep > 24 && r < 0.12) return 'bowling';
	if (area > 900 && deep > 24 && r < 0.2) return 'cinema';
	if (r < 0.36) return 'restaurant';
	if (r < 0.54) return 'cafe';
	if (r < 0.62 && area > 250) return 'arcade';
	return 'shop';
}
const ZONE_OF = { cafe: ZONE.dining, restaurant: ZONE.dining, shop: ZONE.retail, office: ZONE.office, arcade: 'play', bowling: 'play', cinema: 'play' };
function busyAt(type, h) {
	if (ZONE_OF[type] === 'play') return Math.max(0, Math.min(1, Math.exp(-(((h - 20) / 2.6) ** 2)) + Math.exp(-(((h - 15) / 2.5) ** 2)) * 0.45));
	if (type === 'cafe') return Math.max(0, Math.min(1, Math.exp(-(((h - 8.3) / 1.6) ** 2)) + Math.exp(-(((h - 14) / 2) ** 2)) * 0.35));
	if (type === 'restaurant') return Math.max(0, Math.min(1, Math.exp(-(((h - 19.4) / 1.8) ** 2)) + Math.exp(-(((h - 12.5) / 1.1) ** 2)) * 0.55));
	return crowd(ZONE_OF[type], h).k;
}
export const COMMERCIAL_TYPES = ['cafe', 'restaurant', 'shop', 'office', 'arcade', 'bowling', 'cinema'];

export function createCommercial(scene, bay, real, city, { isPhone = false } = {}) {
	const BUILD_R = isPhone ? 36 : 50, DROP_R = BUILD_R + 25, MAX = isPhone ? 3 : 6;
	const group = new THREE.Group();
	group.name = 'commercial';
	scene.add(group);
	const S = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
	const mats = {
		wall: S(0xe9e4da, 0.9), walld: S(0x8a8074, 0.85), trim: S(0x3a3a3c, 0.5, { metalness: 0.4 }), glass: S(0x9fb4bf, 0.05, { metalness: 0.3, transparent: true, opacity: 0.28, depthWrite: false }),
		floorW: S(0x8a6440, 0.55), floorT: S(0xc9c4ba, 0.45), carpet: S(0x5a5f6a, 0.95), lane: S(0xc79a5e, 0.25),
		ceil: S(0xf2f0ea, 0.9), panel: S(0xffffff, 0.5, { emissive: new THREE.Color(0xfff4e0), emissiveIntensity: 0.9 }),
		wood: S(0x6b4a2e, 0.6), dark: S(0x202224, 0.5), steel: S(0xb8bcc0, 0.3, { metalness: 0.7 }), white: S(0xf4f4f0, 0.5), red: S(0x9c2a26, 0.7), leather: S(0x5a2e22, 0.6),
		green: S(0x3f6b3a, 0.8), screen: S(0x101418, 0.3, { emissive: new THREE.Color(0x6fb0ff), emissiveIntensity: 1.2 }), neon: S(0x220a22, 0.4, { emissive: new THREE.Color(0xff4fd0), emissiveIntensity: 1.6 }),
		bigscreen: S(0x111111, 0.4, { emissive: new THREE.Color(0xc8d8ff), emissiveIntensity: 1.1 }), seat: S(0x7a1c24, 0.8), food: S(0xd9a54a, 0.7), cup: S(0xf4efe6, 0.4),
		goods: [S(0xc0392b), S(0x2e86c1), S(0xf1c40f), S(0x27ae60), S(0x8e44ad), S(0xe67e22), S(0xecf0f1)],
		skin: [S(0xe0b494), S(0xc68e6a), S(0x8d5a3b), S(0x5a3a26), S(0xf0cfb0)], cloth: [S(0x2c3e50), S(0x7f8c8d), S(0xa93226), S(0x1f618d), S(0x117a65), S(0xd4ac0d), S(0x6c3483), S(0xeeeeee)],
	};
	const FILL = [mats.wall, mats.walld, mats.ceil, mats.floorW, mats.floorT, mats.carpet, mats.lane, mats.wood, mats.white, mats.leather, mats.red, mats.seat, mats.steel, mats.food, mats.cup, mats.green, ...mats.goods, ...mats.skin, ...mats.cloth];
	for (const m of FILL) { m.emissive = m.color.clone(); m.emissiveIntensity = 0.1; }
	const built = new Map();         // grp -> building
	const Y = new THREE.Vector3(0, 1, 0);

	// ---------- building one ----------
	function build(b) {
		const type = typeOf(b), rnd = (() => { let s = 1; return () => hh(b.x * 0.013 + s++ * 0.71, b.z * 0.017 - s * 0.37); })();
		const ca = Math.cos(b.a), sa = Math.sin(b.a);
		let floorY = -1e9;
		for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) floorY = Math.max(floorY, bay.heightAt(b.x + ca * sx * b.w / 2 - sa * sz * b.d / 2, b.z + sa * sx * b.w / 2 + ca * sz * b.d / 2));
		floorY += 0.12;
		const W = b.w, D = b.d, H = Math.max(CEIL + 0.8, b.wallH - (floorY - bay.heightAt(b.x, b.z))), hw = W / 2, hd = D / 2;
		const parts = new Map(), col = [];      // col: solid boxes [x0, z0, x1, z1, y0, y1] in the local frame
		const add = (mat, g) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(g.index ? g.toNonIndexed() : g); };
		const box = (mat, x0, y0, z0, x1, y1, z1, solid = false) => { add(mat, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); if (solid) col.push([x0, z0, x1, z1, y0, y1]); };
		const cyl = (mat, x, y, z, r, h, seg = 10) => add(mat, new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z));

		// the shell: the floor, three solid walls, the storefront (glass between mullions, the
		// doorway open), the ceiling of light panels, the walls above and the roof
		const floorMat = type === 'office' ? mats.carpet : type === 'restaurant' || type === 'bowling' ? mats.floorW : type === 'cinema' ? mats.carpet : mats.floorT;
		box(floorMat, -hw, -0.4, -hd, hw, 0, hd);
		box(mats.wall, -hw, 0, -hd, hw, H, -hd + WALL, true);
		box(mats.wall, -hw, 0, -hd, -hw + WALL, H, hd, true);
		box(mats.wall, hw - WALL, 0, -hd, hw, H, hd, true);
		const doorX = (b.door ?? 0.5) * (W - 4) - (hw - 2), dw = 1.9;
		box(mats.wall, -hw, STORE, hd - WALL, hw, H, hd);
		box(mats.trim, -hw, 0, hd - WALL, hw, 0.35, hd, false);
		for (const [a0, a1] of [[-hw, doorX - dw / 2], [doorX + dw / 2, hw]]) {
			if (a1 - a0 < 0.1) continue;
			add(mats.glass, new THREE.BoxGeometry(a1 - a0, STORE - 0.35, 0.03).translate((a0 + a1) / 2, 0.35 + (STORE - 0.35) / 2, hd - WALL / 2));
			col.push([a0, hd - WALL, a1, hd, 0, STORE]);
			for (let x = a0; x <= a1 + 0.01; x += Math.max(1.2, (a1 - a0) / Math.max(1, Math.round((a1 - a0) / 2.4)))) box(mats.trim, x - 0.05, 0.35, hd - WALL, x + 0.05, STORE, hd);
		}
		box(mats.trim, doorX - dw / 2 - 0.08, 0, hd - WALL, doorX - dw / 2, STORE, hd); box(mats.trim, doorX + dw / 2, 0, hd - WALL, doorX + dw / 2 + 0.08, STORE, hd);
		// an awning over the door, the name board above it
		box(type === 'restaurant' ? mats.red : type === 'arcade' ? mats.neon : mats.dark, doorX - 2.2, STORE + 0.1, hd, doorX + 2.2, STORE + 0.25, hd + 1.4);
		box(mats.ceil, -hw, CEIL, -hd, hw, CEIL + 0.12, hd);
		for (let x = -hw + 2; x < hw - 1; x += 3) for (let z = -hd + 2; z < hd - 1; z += 3) box(type === 'cinema' && z < hd - 9 ? mats.ceil : mats.panel, x - 0.55, CEIL - 0.02, z - 0.55, x + 0.55, CEIL, z + 0.55);
		box(mats.walld, -hw, H - 0.1, -hd, hw, H + 0.25, hd);

		// ---------- the fit-out ----------
		const seats = [];                // where people sit or stand: [x, z, yaw, sitting]
		const table = (x, z, n, round) => {
			if (round) cyl(mats.wood, x, 0.72, z, 0.38, 0.04, 14); else box(mats.wood, x - 0.45, 0.72, z - 0.45 * (n > 2 ? 1.6 : 1), x + 0.45, 0.76, z + 0.45 * (n > 2 ? 1.6 : 1));
			cyl(mats.dark, x, 0, z, 0.05, 0.72, 6);
			const spots = n > 2 ? [[0.85, -0.45], [0.85, 0.45], [-0.85, -0.45], [-0.85, 0.45]] : [[0.75, 0], [-0.75, 0]];
			for (const [u, v] of spots) {
				box(mats.dark, x + u - 0.22, 0.44, z + v - 0.22, x + u + 0.22, 0.48, z + v + 0.22);
				box(mats.dark, x + u + Math.sign(u) * 0.2, 0.48, z + v - 0.22, x + u + Math.sign(u) * 0.24, 0.95, z + v + 0.22);
				seats.push([x + u, z + v, u > 0 ? Math.PI / 2 : -Math.PI / 2, true]);
			}
			// what is on the table
			if (type === 'restaurant') { cyl(mats.white, x + 0.2, 0.76, z, 0.12, 0.02, 12); cyl(mats.food, x + 0.2, 0.78, z, 0.07, 0.03, 8); cyl(mats.glass, x - 0.2, 0.76, z + 0.15, 0.04, 0.16, 8); }
			else { cyl(mats.cup, x + 0.1, 0.76, z, 0.045, 0.1, 8); }
		};
		const inside = { x0: -hw + WALL + 0.4, x1: hw - WALL - 0.4, z0: -hd + WALL + 0.4, z1: hd - WALL - 2.2 };
		const iw = inside.x1 - inside.x0, id = inside.z1 - inside.z0;
		if (type === 'cafe' || type === 'restaurant') {
			// the counter or bar across the back, stools along it, shelves behind
			const bz = inside.z0 + 1.6;
			box(mats.wood, inside.x0 + 0.5, 0, bz - 0.35, inside.x1 - 0.5, 1.05, bz + 0.35, true);
			box(mats.dark, inside.x0 + 0.4, 1.05, bz - 0.4, inside.x1 - 0.4, 1.1, bz + 0.4);
			box(mats.walld, inside.x0, 1.4, inside.z0 - 0.3, inside.x1, 1.44, inside.z0 + 0.1);
			for (let x = inside.x0 + 0.8; x < inside.x1 - 0.6; x += 0.5) box(mats.goods[Math.floor(rnd() * 7)], x, 1.44, inside.z0 - 0.25, x + 0.12, 1.72, inside.z0 - 0.05);
			if (type === 'cafe') {
				box(mats.steel, inside.x0 + 1, 1.1, bz - 0.2, inside.x0 + 1.7, 1.6, bz + 0.2);
				add(mats.glass, new THREE.BoxGeometry(1.6, 0.5, 0.6).translate(inside.x1 - 1.6, 1.35, bz));
				for (let k = 0; k < 6; k++) cyl(mats.food, inside.x1 - 2.2 + k * 0.22, 1.12, bz, 0.07, 0.05, 8);
				box(mats.dark, inside.x0 + 1.5, 2.1, inside.z0 - 0.02, inside.x0 + 3.5, 3, inside.z0 + 0.05);
			} else for (let x = inside.x0 + 1; x < inside.x1 - 0.6; x += 0.9) { cyl(mats.steel, x, 0, bz + 0.8, 0.03, 0.75, 6); cyl(mats.leather, x, 0.75, bz + 0.8, 0.2, 0.06, 10); seats.push([x, bz + 0.8, Math.PI, true]); }
			// booths down one wall (restaurants), tables through the room
			if (type === 'restaurant') for (let z = bz + 2.4; z < inside.z1 - 1; z += 2) {
				box(mats.leather, inside.x0, 0, z - 0.95, inside.x0 + 0.6, 1.15, z - 0.75, true); box(mats.leather, inside.x0, 0, z + 0.75, inside.x0 + 0.6, 1.15, z + 0.95, true);
				box(mats.wood, inside.x0 + 0.6, 0.72, z - 0.4, inside.x0 + 1.4, 0.76, z + 0.4);
				seats.push([inside.x0 + 1.05, z - 0.55, 0, true], [inside.x0 + 1.05, z + 0.55, Math.PI, true]);
			}
			const step = type === 'cafe' ? 2.1 : 2.8;
			for (let z = bz + 2.6; z < inside.z1 - 0.6; z += step) for (let x = inside.x0 + (type === 'restaurant' ? 3 : 1.4); x < inside.x1 - 1; x += step) table(x, z, type === 'restaurant' && rnd() < 0.5 ? 4 : 2, type === 'cafe');
			// pendant lights over the bar
			for (let x = inside.x0 + 1.5; x < inside.x1 - 1; x += 2.2) { cyl(mats.dark, x, 2.4, bz, 0.01, CEIL - 2.4, 4); add(mats.panel, new THREE.SphereGeometry(0.16, 10, 6).translate(x, 2.35, bz)); }
		} else if (type === 'shop') {
			for (let z = inside.z0 + 1; z < inside.z1 - 2.5; z += 2.6) {
				box(mats.white, inside.x0 + 1.2, 0, z - 0.45, inside.x1 - 1.2, 1.7, z + 0.45, true);
				for (let x = inside.x0 + 1.3; x < inside.x1 - 1.3; x += 0.34) for (const y of [0.25, 0.8, 1.35]) for (const s of [-1, 1]) box(mats.goods[Math.floor(rnd() * 7)], x, y, z + s * 0.47 - 0.06, x + 0.26, y + 0.3, z + s * 0.47 + 0.06);
			}
			box(mats.wood, doorX + 1.6, 0, inside.z1 - 0.2, doorX + 3.6, 1, inside.z1 + 0.6, true);
			box(mats.screen, doorX + 2.2, 1, inside.z1, doorX + 2.6, 1.3, inside.z1 + 0.05);
			for (let z = inside.z0 + 2.3; z < inside.z1 - 2.5; z += 2.6) seats.push([inside.x0 + 1 + rnd() * (iw - 2), z, rnd() * 6, false]);
		} else if (type === 'office') {
			// reception by the door, a sofa, then the desks
			box(mats.white, doorX - 1.5, 0, inside.z1 - 3, doorX + 1.5, 1.1, inside.z1 - 2.3, true);
			box(mats.leather, inside.x1 - 3, 0, inside.z1 - 1.4, inside.x1 - 0.8, 0.45, inside.z1 - 0.6); box(mats.leather, inside.x1 - 3, 0.45, inside.z1 - 0.6, inside.x1 - 0.8, 0.9, inside.z1 - 0.45);
			seats.push([doorX, inside.z1 - 3.5, 0, false]);
			for (let z = inside.z0 + 1.2; z < inside.z1 - 5; z += 3) for (let x = inside.x0 + 1; x < inside.x1 - 1.6; x += 1.7) {
				box(mats.white, x, 0.72, z, x + 1.5, 0.76, z + 0.75); box(mats.trim, x + 0.05, 0, z + 0.05, x + 0.1, 0.72, z + 0.7); box(mats.trim, x + 1.4, 0, z + 0.05, x + 1.45, 0.72, z + 0.7);
				box(mats.screen, x + 0.45, 0.8, z + 0.12, x + 1.05, 1.18, z + 0.15);
				box(mats.dark, x + 0.5, 0.42, z + 0.95, x + 1, 0.47, z + 1.4);
				seats.push([x + 0.75, z + 1.2, Math.PI, true]);
			}
			if (iw > 8 && id > 10) { add(mats.glass, new THREE.BoxGeometry(4, CEIL - 0.1, 0.04).translate(inside.x1 - 2, (CEIL - 0.1) / 2, inside.z0 + 4)); box(mats.wood, inside.x1 - 3.4, 0.72, inside.z0 + 1, inside.x1 - 0.6, 0.76, inside.z0 + 3); }
			for (const [x, z] of [[inside.x0 + 0.4, inside.z1 - 0.8], [inside.x1 - 0.4, inside.z0 + 0.5]]) { cyl(mats.walld, x, 0, z, 0.25, 0.5, 10); add(mats.green, new THREE.IcosahedronGeometry(0.45, 0).translate(x, 1, z)); }
		} else if (type === 'arcade') {
			for (const side of [-1, 1]) for (let z = inside.z0 + 0.8; z < inside.z1 - 1; z += 1.1) {
				const x = side < 0 ? inside.x0 + 0.4 : inside.x1 - 0.4;
				box(mats.dark, x - 0.35, 0, z - 0.4, x + 0.35, 1.85, z + 0.4, true);
				box(rnd() < 0.5 ? mats.screen : mats.neon, x - side * 0.36, 1.05, z - 0.3, x - side * 0.34, 1.55, z + 0.3);
				seats.push([x - side * 0.9, z, side > 0 ? Math.PI / 2 : -Math.PI / 2, false]);
			}
			box(mats.neon, inside.x0 + 2, 0, inside.z0 + 0.4, inside.x1 - 2, 1.05, inside.z0 + 1.1, true);
			box(mats.neon, inside.x0, CEIL - 0.3, inside.z0, inside.x1, CEIL - 0.25, inside.z0 + 0.1);
		} else if (type === 'bowling') {
			const lanes = Math.max(2, Math.min(10, Math.floor(iw / 3.2)));
			for (let k = 0; k < lanes; k++) {
				const x = inside.x0 + 1.6 + k * (iw - 3.2) / Math.max(1, lanes - 1);
				box(mats.lane, x - 0.53, 0.02, inside.z0 + 0.5, x + 0.53, 0.06, inside.z1 - 5);
				box(mats.dark, x - 0.8, 0, inside.z0 + 0.5, x - 0.53, 0.04, inside.z1 - 5);
				for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) cyl(mats.white, x + (c - r / 2) * 0.3, 0.06, inside.z0 + 1 + r * 0.26, 0.06, 0.38, 8);
				add(mats.screen, new THREE.BoxGeometry(1.2, 0.7, 0.05).translate(x, 2.6, inside.z1 - 4.8));
				seats.push([x + 0.2, inside.z1 - 3.5, Math.PI, false]);
			}
			box(mats.walld, inside.x0, 0, inside.z0 - 0.1, inside.x1, 1.2, inside.z0 + 0.5, true);
			box(mats.leather, inside.x0 + 1, 0, inside.z1 - 2.6, inside.x1 - 1, 0.45, inside.z1 - 1.8);
		} else {                        // cinema: the lobby, the concession stand, the hall
			const hall = inside.z1 - 8;
			box(mats.wall, inside.x0, 0, hall - 0.15, inside.x1 - 2.4, CEIL, hall + 0.15, true);
			box(mats.red, inside.x0 + 1, 0, hall + 2, inside.x0 + 6, 1.05, hall + 2.8, true);
			box(mats.food, inside.x0 + 1.2, 1.05, hall + 2.1, inside.x0 + 2, 1.7, hall + 2.7);
			box(mats.screen, inside.x0 + 1, 2.2, hall + 0.2, inside.x0 + 6, 3, hall + 0.25);
			const hx0 = Math.max(inside.x0, -13), hx1 = Math.min(inside.x1, 13);          // (one screen's hall, not the whole block)
			box(mats.bigscreen, hx0 + 1, 0.9, inside.z0 + 0.05, hx1 - 1, Math.min(CEIL - 0.3, 3.3), inside.z0 + 0.12);
			for (let r = 0, z = inside.z0 + 3.5; z < hall - 1 && r < 16; z += 1.1, r++) {
				const y = Math.min(1.2, r * 0.18);
				box(mats.walld, hx0, 0, z - 0.5, hx1, y, z + 0.6);
				for (let x = hx0 + 1; x < hx1 - 1; x += 0.62) { box(mats.seat, x - 0.26, y, z - 0.25, x + 0.26, y + 0.45, z + 0.2); box(mats.seat, x - 0.26, y + 0.45, z + 0.15, x + 0.26, y + 1.0, z + 0.25); seats.push([x, z - 0.02, 0, true, y]); }
			}
		}

		// ---------- the building's people, by the hour ----------
		const root = new THREE.Group();
		for (const [mat, list] of parts) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.receiveShadow = true; m.castShadow = !isPhone && mat !== mats.glass; root.add(m); }
		const figures = new THREE.Group(); root.add(figures);
		// (a hair inside the block it replaces, so the two never fight while it dissolves)
		root.position.set(b.x, floorY, b.z); root.rotation.y = -b.a; root.scale.set((W - 0.12) / W, 1, (D - 0.12) / D);
		group.add(root);
		const B = { b, type, root, figures, floorY, seats, col, hw, hd, doorX, lastH: -99, dispose: () => root.traverse((o) => o.geometry?.dispose()) };
		return B;
	}

	// a seated or standing figure: body, head, arms; merged so a room of them is a few draws
	const figGeo = (sit) => {
		const g = [new THREE.CapsuleGeometry(0.2, sit ? 0.34 : 0.62, 4, 8).translate(0, sit ? 0.78 : 1.0, 0)];
		if (sit) g.push(new THREE.BoxGeometry(0.34, 0.14, 0.46).translate(0, 0.5, -0.16), new THREE.BoxGeometry(0.3, 0.46, 0.12).translate(0, 0.23, -0.36));
		else g.push(new THREE.CapsuleGeometry(0.08, 0.7, 3, 6).translate(-0.08, 0.4, 0), new THREE.CapsuleGeometry(0.08, 0.7, 3, 6).translate(0.08, 0.4, 0));
		return mergeGeometries(g.map((q) => q.toNonIndexed()));
	};
	const FIG = { sit: figGeo(true), stand: figGeo(false), head: new THREE.SphereGeometry(0.12, 10, 8) };
	function populate(B, hours) {
		for (const c of [...B.figures.children]) B.figures.remove(c);
		const k = busyAt(B.type, hours), n = Math.round(B.seats.length * k * (B.type === 'cinema' ? 0.7 : 0.55));
		const order = B.seats.map((s, i) => [hh(i * 1.7, B.b.x) + (s[3] ? 0 : 0.1), s]).sort((a, c) => a[0] - c[0]).slice(0, n);
		const bodyBy = new Map(), headBy = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
		order.forEach(([r, [x, z, yaw, sit, y0 = 0]], i) => {
			const cloth = mats.cloth[Math.floor(hh(i, r * 9) * mats.cloth.length)], skin = mats.skin[Math.floor(hh(r * 7, i) * mats.skin.length)];
			const key = cloth.uuid + (sit ? 's' : 't');
			if (!bodyBy.has(key)) bodyBy.set(key, { mat: cloth, geo: sit ? FIG.sit : FIG.stand, list: [] });
			bodyBy.get(key).list.push(m4.clone().compose(p.set(x, y0, z), q.setFromAxisAngle(Y, yaw), s1));
			if (!headBy.has(skin)) headBy.set(skin, []);
			headBy.get(skin).push(m4.clone().compose(p.set(x, y0 + (sit ? 1.22 : 1.62), z), q, s1));
		});
		for (const { mat, geo, list } of bodyBy.values()) { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((M, i) => im.setMatrixAt(i, M)); B.figures.add(im); }
		for (const [mat, list] of headBy) { const im = new THREE.InstancedMesh(FIG.head, mat, list.length); list.forEach((M, i) => im.setMatrixAt(i, M)); B.figures.add(im); }
	}

	// ---------- near you ----------
	let scanX = 1e9, scanZ = 1e9, cands = [], cool = 0;
	function update(cam, dt, hours, nightK) {
		const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y - (bay.heightAt(x, z) || 0) > 120;
		group.visible = !high;
		mats.panel.emissiveIntensity = 0.7 + nightK * 0.6;
		// the rooms are lit from their ceilings: a glow on everything inside, more after dark
		// (no extra lights, so no shaders are rebuilt)
		for (const m of FILL) m.emissiveIntensity = 0.1 + nightK * 0.28;
		if (!real?.loaded() || high) return;
		if (Math.hypot(x - scanX, z - scanZ) > 6) {
			scanX = x; scanZ = z;
			cands = [];
			for (const b of real.near('boxes', x, z, BUILD_R + 20)) {
				if (!b.grp?.biz) continue;
				const d = Math.hypot(b.x - x, b.z - z) - Math.max(b.w, b.d) / 2;
				if (d < BUILD_R) cands.push([d, b]);
			}
			cands.sort((p, q) => p[0] - q[0]);
			cands.length = Math.min(cands.length, MAX);
		}
		for (const [grp, B] of built) {
			const d = Math.hypot(B.b.x - x, B.b.z - z) - Math.max(B.b.w, B.b.d) / 2;
			if (d > DROP_R || (!cands.some((c) => c[1].grp === grp) && built.size > MAX)) { group.remove(B.root); B.dispose(); city?.setNear?.(grp, null); built.delete(grp); }
		}
		cool -= dt;
		if (cool <= 0) for (const [, b] of cands) if (!built.has(b.grp)) {
			let B = null;
			try { B = build(b); } catch (e) { console.warn('commercial', e); }
			if (B) { built.set(b.grp, B); city?.setNear?.(b.grp, [b.x, b.z]); }
			cool = 0.25;
			break;
		}
		// who is in, as the hours go by
		for (const B of built.values()) if (Math.abs(hours - B.lastH) > 0.5) { B.lastH = hours; populate(B, hours); }
	}

	const local = (B, x, z) => { const dx = x - B.b.x, dz = z - B.b.z, ca = Math.cos(B.b.a), sa = Math.sin(B.b.a); return [ca * dx + sa * dz, -sa * dx + ca * dz]; };
	// the floor inside
	function floor(x, z, y) {
		let best = -1e9;
		for (const B of built.values()) {
			const [lx, lz] = local(B, x, z);
			if (Math.abs(lx) < B.hw && Math.abs(lz) < B.hd && y > B.floorY - 1.2) best = Math.max(best, B.floorY);
		}
		return best;
	}
	// the walls, counters and shelves are solid
	function push(pos, footY) {
		const R = 0.3;
		for (const B of built.values()) {
			let [lx, lz] = local(B, pos.x, pos.z);
			if (Math.abs(lx) > B.hw + 1 || Math.abs(lz) > B.hd + 1) continue;
			const y0 = footY - B.floorY + 0.25, y1 = footY - B.floorY + 1.7;
			let moved = false;
			for (const c of B.col) {
				if (y1 < c[4] || y0 > c[5]) continue;
				const qx = Math.max(c[0], Math.min(c[2], lx)), qz = Math.max(c[1], Math.min(c[3], lz));
				const dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
				if (d2 >= R * R) continue;
				if (d2 < 1e-8) { const pen = [lx - c[0], c[2] - lx, lz - c[1], c[3] - lz], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) lx = c[0] - R; else if (k === 1) lx = c[2] + R; else if (k === 2) lz = c[1] - R; else lz = c[3] + R; }
				else { const d = Math.sqrt(d2); lx = qx + dx / d * R; lz = qz + dz / d * R; }
				moved = true;
			}
			if (moved) { const ca = Math.cos(B.b.a), sa = Math.sin(B.b.a); pos.x = B.b.x + ca * lx - sa * lz; pos.z = B.b.z + sa * lx + ca * lz; }
		}
	}
	// the place you are in (for a hint)
	function inside(pos) {
		for (const B of built.values()) { const [lx, lz] = local(B, pos.x, pos.z); if (Math.abs(lx) < B.hw - 0.3 && Math.abs(lz) < B.hd - 0.3 && pos.y - B.floorY < CEIL) return B; }
		return null;
	}
	return { group, update, floor, push, inside, count: () => built.size };
}
