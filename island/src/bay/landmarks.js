// Landmarks across the Bay Area, at their real places and heights. Built from simple
// solids merged per material, so the whole set is a handful of draws.
//
// San Francisco: the Ferry Building and its 75 m clock tower, City Hall's 94 m dome, the
// Palace of Fine Arts, Alcatraz (cellhouse, lighthouse, water tower), Fort Point under
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

const M = (color, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

export function createLandmarks(scene, bay) {
	const group = new THREE.Group();
	group.name = 'bay-landmarks';
	scene.add(group);
	const mats = {
		stone: M(0xd9d2c3), granite: M(0xc9c3b8), white: M(0xefece4, 0.6), salmon: M(0xc99a78, 0.8), brick: M(0x8a4a36, 0.9), redbrick: M(0x9c5a44, 0.85),
		gold: M(0xc9a646, 0.35, 0.8), glass: M(0x8fa3b0, 0.2, 0.6), dark: M(0x3a3c40, 0.5, 0.3), steel: M(0x9aa0a4, 0.45, 0.5), silver: M(0xc4c8cc, 0.35, 0.6),
		orange: M(0xc0362c, 0.55, 0.25), green: M(0x3c6b3a, 0.9), concrete: M(0xb2aea6, 0.9), wood: M(0x6b5238, 0.9), craneRed: M(0xb8322a, 0.6, 0.3), craneWhite: M(0xe6e4df, 0.6, 0.3),
		copper: M(0x5f8a78, 0.6, 0.3), tan: M(0xc8b08a, 0.8), sail: M(0xe8e2d4, 0.9), pavement: M(0x7d7b76, 0.95),
	};
	const parts = new Map();
	const add = (mat, g) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(g.index ? g.toNonIndexed() : g); };
	// a local frame at a real place: heading = bearing of the local +z axis, degrees from north
	const at = (lat, lon, heading = 0, base = null) => {
		const w = toWorld(lat, lon), g = base ?? Math.max(0, bay.heightAt(w.x, w.z));
		const m = new THREE.Matrix4().makeRotationY(-heading * Math.PI / 180 + Math.PI).setPosition(w.x, g, w.z);
		return { m, g, w };
	};
	const put = (F, mat, geo, x = 0, y = 0, z = 0, ry = 0) => { geo.rotateY(ry); geo.translate(x, y, z); geo.applyMatrix4(F.m); add(mat, geo); };
	const box = (F, mat, w, h, d, x = 0, y = 0, z = 0, ry = 0) => put(F, mat, new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, ry);
	const cyl = (F, mat, r0, r1, h, x = 0, y = 0, z = 0, seg = 16) => put(F, mat, new THREE.CylinderGeometry(r1, r0, h, seg).translate(0, h / 2, 0), x, y, z);
	const cone = (F, mat, r, h, x = 0, y = 0, z = 0, seg = 4) => put(F, mat, new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0), x, y, z);
	const dome = (F, mat, r, x = 0, y = 0, z = 0, sy = 1) => put(F, mat, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1), x, y, z);

	// ---------------- San Francisco ----------------
	{ // Ferry Building: a long granite shed along the Embarcadero and its clock tower
		const F = at(37.7955, -122.3937, 150);
		box(F, mats.stone, 30, 14, 200);
		box(F, mats.concrete, 26, 2, 196, 0, 14, 0);
		box(F, mats.stone, 11, 50, 11, -6, 0, 0);
		box(F, mats.stone, 9, 10, 9, -6, 50, 0);
		cyl(F, mats.stone, 4, 3.5, 8, -6, 60, 0, 8);
		cone(F, mats.stone, 3.2, 7, -6, 68, 0, 8);
		cyl(F, mats.gold, 0.25, 0.1, 4, -6, 75, 0, 6);
	}
	{ // City Hall: Beaux-Arts block, drum and a dome higher than the Capitol's, gold lantern
		const F = at(37.7793, -122.4193, 0);
		box(F, mats.granite, 124, 26, 92);
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
	}
	{ // Alcatraz: cellhouse on the crown, the lighthouse, the water tower
		const C = at(37.8269, -122.4229, 110);
		box(C, mats.white, 38, 15, 150);
		box(C, mats.concrete, 40, 3, 60, 0, 0, 90);
		const L = at(37.8262, -122.4222);
		cyl(L, mats.white, 3.2, 2.4, 25, 0, 0, 0, 8); cyl(L, mats.dark, 2.2, 2.2, 3, 0, 25, 0, 8); cone(L, mats.dark, 2.4, 2, 0, 28, 0, 8);
		const T = at(37.8279, -122.4215);
		for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) box(T, mats.steel, 0.8, 24, 0.8, x, 0, z);
		cyl(T, mats.concrete, 7, 7, 9, 0, 24, 0, 16);
	}
	{ // Fort Point, under the bridge's south end: four storeys of brick casemates
		const F = at(37.8106, -122.4771, 60);
		box(F, mats.brick, 70, 18, 45); box(F, mats.redbrick, 20, 22, 20, 30, 0, 18);
	}
	{ // Oracle Park: a brick bowl open to McCovey Cove, a green field
		const F = at(37.7786, -122.3893, 45);
		for (let i = 0; i < 30; i++) {
			const a = -0.3 + i / 29 * (Math.PI * 1.35), r = 105;
			box(F, mats.redbrick, 26, 28 - Math.abs(i - 15) * 0.5, 22, Math.cos(a) * r, 0, Math.sin(a) * r, -a + Math.PI / 2);
		}
		put(F, mats.green, new THREE.CylinderGeometry(95, 95, 0.6, 32).translate(0, 0.3, 0));
	}
	{ // Chase Center: a rounded silver arena on the bay
		const F = at(37.7680, -122.3877);
		cyl(F, mats.silver, 78, 72, 32, 0, 0, 0, 36); dome(F, mats.silver, 72, 0, 32, 0, 0.08);
	}
	// the tallest towers, by height
	for (const [lat, lon, h, w, mat] of [[37.7920, -122.4035, 237, 42, mats.dark], [37.7897, -122.3955, 245, 34, mats.glass], [37.7905, -122.3960, 197, 36, mats.glass], [37.7862, -122.3923, 188, 30, mats.glass], [37.7899, -122.4007, 212, 40, mats.granite], [37.7941, -122.3989, 184, 36, mats.dark]]) {
		const F = at(lat, lon, 0);
		box(F, mat, w, h, w * 0.8); box(F, mat, w * 0.7, 8, w * 0.55, 0, h, 0);
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
			const F = at(lat, lon, 90);
			cyl(F, mats.white, 7, 4.5, 22, 0, 0, 0, 8); cone(F, mats.wood, 5, 6, 0, 22, 0, 8);
			for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2 + 0.3; const g = new THREE.BoxGeometry(2.2, 17, 0.3).translate(0, 8.5, 0).rotateZ(a); put(F, mats.sail, g, 0, 24, 5); }
		}
	}
	{ // Point Bonita lighthouse, on its knife-edge rock
		const F = at(37.8157, -122.5298);
		cyl(F, mats.white, 2.5, 2.2, 10, 0, 0, 0, 8); cyl(F, mats.dark, 1.8, 1.8, 3, 0, 10, 0, 8);
	}

	// ---------------- East Bay ----------------
	{ // Oakland City Hall: a wedding-cake tower on a broad base
		const F = at(37.8053, -122.2724, 20);
		box(F, mats.granite, 52, 30, 34); box(F, mats.granite, 30, 45, 22, 0, 30, 0); box(F, mats.granite, 14, 14, 14, 0, 75, 0); cyl(F, mats.granite, 5, 3, 9, 0, 89, 0, 8);
	}
	{ // the Tribune Tower: red-brick campanile with its copper crown
		const F = at(37.8043, -122.2708, 20);
		box(F, mats.redbrick, 15, 76, 15); box(F, mats.redbrick, 12, 8, 12, 0, 76, 0); cone(F, mats.copper, 8, 10, 0, 84, 0, 4);
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
		const F = at(37.8721, -122.2578, 0);
		box(F, mats.granite, 11, 78, 11); box(F, mats.granite, 13, 2, 13, 0, 60, 0); cone(F, mats.copper, 8.2, 16, 0, 78, 0, 4);
	}
	{ // Memorial Stadium in Strawberry Canyon
		const F = at(37.8712, -122.2508, 0);
		for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; box(F, mats.concrete, 22, 18, 30, Math.cos(a) * 95, 0, Math.sin(a) * 125, -a + Math.PI / 2); }
		put(F, mats.green, new THREE.CylinderGeometry(70, 70, 0.6, 24).scale(1, 1, 1.35).translate(0, 0.3, 0));
	}
	{ // Mount Diablo's summit: the stone museum tower and its beacon
		const F = at(37.8816, -121.9142, 0);
		box(F, mats.tan, 14, 10, 14); box(F, mats.tan, 6, 8, 6, 0, 10, 0); cyl(F, mats.gold, 1, 1, 2, 0, 18, 0, 8);
	}

	// ---------------- Peninsula and South Bay ----------------
	{ // Hoover Tower at Stanford
		const F = at(37.4275, -122.1668, 0);
		box(F, mats.tan, 14, 70, 14); box(F, mats.tan, 11, 8, 11, 0, 70, 0); dome(F, mats.salmon, 6, 0, 78, 0, 1.3);
	}
	{ // Hangar One at Moffett Field: an airship hangar 345 m long
		const F = at(37.4155, -122.0496, 330);
		put(F, mats.silver, new THREE.CylinderGeometry(1, 1, 345, 28, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(47, 60, 1));
		put(F, mats.silver, new THREE.BoxGeometry(94, 6, 345).translate(0, 3, 0));
	}
	{ // Levi's Stadium: a bowl with the tall suite tower on its west side
		const F = at(37.4033, -121.9694, 0);
		for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; box(F, mats.concrete, 24, 28, 34, Math.cos(a) * 110, 0, Math.sin(a) * 140, -a + Math.PI / 2); }
		box(F, mats.glass, 30, 62, 230, -120, 0, 0);
		put(F, mats.green, new THREE.CylinderGeometry(80, 80, 0.6, 24).scale(1, 1, 1.4).translate(0, 0.3, 0));
	}
	{ // the SAP Center in San Jose
		const F = at(37.3327, -121.9010, 0);
		box(F, mats.silver, 150, 34, 125); box(F, mats.glass, 60, 30, 8, 0, 0, 66);
	}
	{ // Lick Observatory on Mount Hamilton: white domes on the summit
		for (const [lat, lon, r] of [[37.3414, -121.6429, 12], [37.3420, -121.6435, 8], [37.3406, -121.6420, 7]]) {
			const F = at(lat, lon, 0); cyl(F, mats.white, r, r, r * 0.8, 0, 0, 0, 20); dome(F, mats.white, r, 0, r * 0.8, 0, 1);
		}
	}

	// ---------------- San Ramon ----------------
	{ // City Center Bishop Ranch: low pavilions round a plaza under a floating canopy
		const F = at(37.7672, -121.9600, 70);
		for (const [x, z, w, d, h] of [[-60, -40, 50, 34, 12], [0, -55, 60, 30, 14], [60, -40, 50, 34, 12], [-65, 40, 45, 40, 10], [65, 40, 45, 40, 10], [0, 60, 80, 30, 16]]) { box(F, mats.glass, w, h, d, x, 0, z); box(F, mats.white, w + 4, 1.2, d + 4, x, h, z); }
		put(F, mats.pavement, new THREE.BoxGeometry(110, 0.3, 70).translate(0, 0.2, 0));
		// the canopy on slender columns
		box(F, mats.white, 150, 1.4, 60, 0, 17, 0);
		for (let i = -3; i <= 3; i++) for (const z of [-24, 24]) cyl(F, mats.steel, 0.4, 0.4, 17, i * 22, 0, z, 6);
	}
	{ // San Ramon City Hall and the library, facing Central Park
		const F = at(37.7657, -121.9552, 70);
		box(F, mats.tan, 70, 11, 30); box(F, mats.glass, 30, 13, 10, 0, 0, 16);
		const L = at(37.7648, -121.9522, 40);
		box(L, mats.tan, 45, 8, 35);
	}

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
	return { group };
}
