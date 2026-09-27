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
			box(F, mats.cellhouse, 40, 14.5, 150);
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
			for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) box(F, mats.dark, 2.4, 8, 0.3, i * 5, 2.4, s * 75.02);
			// the administration wing and main door at the south-east end, the dining hall at the other
			box(F, mats.cellhouse, 30, 11, 15, 0, 0, 82.5); box(F, mats.cellhouse, 31, 0.6, 16, 0, 11, 82.5);
			for (let i = -5; i <= 5; i++) for (const y of [2, 6.5]) if (i || y > 3) box(F, mats.dark, 1.3, 1.9, 0.3, i * 2.6, y, 90.02);
			box(F, mats.dark, 3, 3.6, 0.4, 0, 0, 90.1);
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
			box(F, mats.white, 6.5, 3.4, 6.5); box(F, mats.white, 7, 0.4, 7, 0, 3.4, 0);
			cyl(F, mats.white, 2.7, 1.85, 17.6, 0, 3.4, 0, 8);
			cyl(F, mats.white, 1.85, 2.4, 0.6, 0, 21, 0, 8);
			cyl(F, mats.dark, 2.7, 2.7, 0.25, 0, 21.6, 0, 16);
			for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; box(F, mats.dark, 0.06, 1, 0.06, Math.sin(a) * 2.6, 21.85, Math.cos(a) * 2.6); }
			put(F, mats.dark, new THREE.TorusGeometry(2.6, 0.04, 4, 32).rotateX(Math.PI / 2), 0, 22.85, 0);
			cyl(F, mats.dark, 1.5, 1.5, 0.7, 0, 21.85, 0, 12); cyl(F, mats.lamp, 1.42, 1.42, 1.9, 0, 22.55, 0, 12);
			cone(F, mats.dark, 1.75, 1.1, 0, 24.45, 0, 12); dome(F, mats.dark, 0.3, 0, 25.5, 0); cyl(F, mats.dark, 0.03, 0.03, 0.9, 0, 25.7, 0, 4);
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
			if (h !== h || nb !== nb || h < 8 || Math.abs(nb - h) > 0.6 || Math.abs(h - CREST) < 0.3 || roadAt(x, z)[0] < 5) continue;
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
		return { hAt, O };
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
	const ALC = alcatraz();
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

	// ---------------- Cupertino: Apple Park ----------------
	{ // the ring: four storeys of curved glass under white canopies at every floor, the solar
		// roof, and the orchard and meadow inside (the mapped footprint is left out for this)
		const F = at(37.33478, -122.00899, 0), R0 = 182, R1 = 231, H = 21, seg = 160;
		const ring = (mat, r, h, y) => put(F, mat, new THREE.CylinderGeometry(r, r, h, seg, 1, true).translate(0, y + h / 2, 0));
		ring(mats.glass, R1, H - 1, 0); ring(mats.glass, R0, H - 1, 0);
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
		const F = at(37.33065, -122.00715, 0);
		cyl(F, mats.glass, 20.5, 20.5, 6.6, 0, 0, 0, 64);
		put(F, mats.white, new THREE.CylinderGeometry(23, 23, 0.7, 64).translate(0, 7, 0));
		put(F, mats.pavement, new THREE.CylinderGeometry(27, 28, 0.4, 48).translate(0, 0.2, 0));
	}
	{ // the Visitor Center: glass walls, a floating white roof, olive trees on the terrace
		const F = at(37.3325, -122.0053, 90);
		box(F, mats.glass, 44, 9, 100);
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
	// standing on a pier, or on the Rock (its ground is its own, over the terrain's)
	function floor(x, z, y) {
		for (const P of PIERS) {
			const dx = P.bx - P.ax, dz = P.bz - P.az, l2 = dx * dx + dz * dz, t = ((x - P.ax) * dx + (z - P.az) * dz) / l2;
			if (t < 0 || t > 1) continue;
			if (Math.abs((x - P.ax) * dz - (z - P.az) * dx) / Math.sqrt(l2) < P.hw && y > P.y - 1.5) return P.y;
		}
		const h = ALC.hAt(x - ALC.O.x, z - ALC.O.z);
		if (h === h && h > 0 && y > h - 1.5) return h;
		return -1e9;
	}
	return { group, floor };
}
