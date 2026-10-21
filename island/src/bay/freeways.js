// The Bay Area's freeways as you see them from the driver's seat, on the mapped roads
// round you: pale concrete carriageways (painted in realcity.js), a concrete barrier
// down the median, tall block sound walls where the freeway passes houses, and the
// overpasses: every mapped bridge lifted clear of what it crosses, a concrete box girder
// with parapets and a chain-link fence on top, columns and bent caps under it where it
// isn't over a lane, and the green overhead signs on its face toward the traffic. The
// decks are floors: you walk and drive over them (floor()).
// Rebuilt round you as you move, like the city.

import * as THREE from 'three';
import { ROUTES } from './roads.js';
import { toWorld } from './geo.js';
import { FOOT, distTo, footLifted, lanesUnder, sidewalkOf } from './overpass.js';
import { carriageways, gapLeft, isCarriageway, medianFor, SHOULDER_R } from './fwyplan.js';
import { lampPools, lampLook } from './streetlamps.js';

// where the freeways go, for the signs (by route number and direction of travel)
export const DEST = {
	680: { N: 'Sacramento', S: 'San Jose' }, 580: { W: 'Oakland  San Francisco', E: 'Stockton', N: 'San Rafael', S: 'Oakland' }, 80: { E: 'Sacramento', W: 'San Francisco', N: 'Sacramento', S: 'San Francisco' },
	880: { N: 'Oakland', S: 'San Jose' }, 101: { N: 'San Francisco', S: 'San Jose' }, 280: { N: 'San Francisco', S: 'San Jose' }, 24: { E: 'Walnut Creek', W: 'Oakland', N: 'Walnut Creek', S: 'Oakland' }, 4: { E: 'Antioch', W: 'Martinez', N: 'Martinez', S: 'Antioch' },
};

// the route a freeway is (the mapped ones carry names like "Donald D Doyle Highway",
// not numbers): the nearest of the known alignments
let ROUTE_PTS = null;
export function routeOf(x, z) {
	if (!ROUTE_PTS) ROUTE_PTS = Object.entries(ROUTES).map(([k, ll]) => [(/(\d+)/.exec(k) || [])[1], ll.map(([a, b]) => toWorld(a, b))]);
	let best = null, bd = 1500;
	for (const [num, pts] of ROUTE_PTS) for (let i = 0; i + 1 < pts.length; i++) {
		const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
		const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
		if (d < bd) { bd = d; best = num; }
	}
	return best;
}
// the chain link: a diamond mesh between posts, on a transparent ground
function chainLink() {
	const c = document.createElement('canvas');
	c.width = 128; c.height = 64;
	const g = c.getContext('2d');
	g.strokeStyle = 'rgba(150,154,156,0.95)'; g.lineWidth = 1.2;
	for (let x = -64; x < 192; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 64, 64); g.stroke(); g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 64, 0); g.stroke(); }
	g.fillStyle = 'rgba(120,124,126,1)'; g.fillRect(0, 0, 4, 64); g.fillRect(0, 0, 128, 3); g.fillRect(0, 61, 128, 3);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
// a green freeway sign: the shield, the direction, the city
const signTex = new Map();
function signTexture(num, dir, dest) {
	const key = num + dir + dest;
	if (signTex.has(key)) return signTex.get(key);
	const c = document.createElement('canvas');
	c.width = 512; c.height = 200;
	const g = c.getContext('2d');
	g.fillStyle = '#0f6b3c'; g.fillRect(0, 0, 512, 200);
	g.strokeStyle = '#f2f2ee'; g.lineWidth = 5; g.strokeRect(8, 8, 496, 184);
	// the interstate shield (blue and red) or a state route's spade (white)
	const inter = [80, 280, 580, 680, 880].includes(+num);
	g.save(); g.translate(70, 92);
	g.beginPath(); g.moveTo(-42, -40); g.quadraticCurveTo(0, -52, 42, -40); g.lineTo(42, 5); g.quadraticCurveTo(38, 42, 0, 55); g.quadraticCurveTo(-38, 42, -42, 5); g.closePath();
	g.fillStyle = inter ? '#1c3f94' : '#f2f2ee'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#f2f2ee'; g.stroke();
	if (inter) { g.fillStyle = '#c8202a'; g.fillRect(-40, -44, 80, 16); }
	g.fillStyle = inter ? '#f2f2ee' : '#111'; g.font = `bold ${String(num).length > 2 ? 30 : 38}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.fillText(num, 0, 22);
	g.restore();
	g.fillStyle = '#f2f2ee'; g.textAlign = 'left';
	g.font = 'bold 30px Arial, Helvetica, sans-serif'; g.fillText({ N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' }[dir], 130, 62);
	g.font = 'bold 44px Arial, Helvetica, sans-serif';
	const words = dest.split('  ');
	words.forEach((w, i) => g.fillText(w, 130, 112 + i * 48));
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	signTex.set(key, t);
	return t;
}

// a soft round glow for the lamp heads
function glowTexture() {
	const cv = document.createElement('canvas');
	cv.width = cv.height = 32;
	const g = cv.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
	gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
	return new THREE.CanvasTexture(cv);
}

// geometry, flat-shaded, with vertex colours
function Geo() {
	const P = [], C = [];
	const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) C.push(col[0], col[1], col[2]); };
	const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
	// sweep a cross-section along a path: path points {x, z, y, nx, nz} (n: the left normal),
	// profile [[across, up], ...]; closed profiles join the last point to the first
	// (prof can be a function of the point's index, each the same number of points)
	const sweep = (path, prof, col, closed = false) => {
		const at = typeof prof === 'function' ? prof : () => prof, n = at(0).length - (closed ? 0 : 1);
		for (let i = 0; i + 1 < path.length; i++) {
			const A = path[i], B = path[i + 1], PA = at(i), PB = at(i + 1);
			const pa = (p) => [A.x + A.nx * p[0], A.y + p[1], A.z + A.nz * p[0]], pb = (p) => [B.x + B.nx * p[0], B.y + p[1], B.z + B.nz * p[0]];
			const cc = typeof col === 'function' ? col(i) : col;
			for (let k = 0; k < n; k++) { const k1 = (k + 1) % PA.length; quad(pa(PA[k]), pb(PB[k]), pb(PB[k1]), pa(PA[k1]), cc); }
		}
	};
	// a square bar of side w from point a to point b ([x, y, z]), its faces square to the world's up
	const beam = (a, b, w, col) => {
		const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1;
		d[0] /= L; d[1] /= L; d[2] /= L;
		// (a side across it, level where it can be)
		let sx = -d[2], sz = d[0], sl = Math.hypot(sx, sz);
		if (sl < 1e-3) { sx = 1; sz = 0; sl = 1; }
		sx /= sl; sz /= sl;
		const ux = -sz * d[1], uy = sz * d[0] - sx * d[2], uz = sx * d[1];
		const h = w / 2, c = (p, i, j) => [p[0] + (sx * i + ux * j) * h, p[1] + uy * j * h, p[2] + (sz * i + uz * j) * h];
		const A = [c(a, -1, -1), c(a, 1, -1), c(a, 1, 1), c(a, -1, 1)], B = [c(b, -1, -1), c(b, 1, -1), c(b, 1, 1), c(b, -1, 1)];
		for (let k = 0; k < 4; k++) quad(A[k], B[k], B[(k + 1) % 4], A[(k + 1) % 4], col);
		quad(A[3], A[2], A[1], A[0], col); quad(B[0], B[1], B[2], B[3], col);
	};
	// an upright round column (sides faces) from y0 (radius r0) to y1 (radius r1)
	const column = (x, z, y0, y1, r0, r1, sides, col) => {
		for (let k = 0; k < sides; k++) {
			const a0 = k / sides * Math.PI * 2, a1 = (k + 1) / sides * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
			quad([x + c0 * r0, y0, z + s0 * r0], [x + c1 * r0, y0, z + s1 * r0], [x + c1 * r1, y1, z + s1 * r1], [x + c0 * r1, y1, z + s0 * r1], col);
		}
	};
	// an upright box, turned by yaw
	const box = (x, y0, z, sx, sy, sz, yaw, col) => {
		const c = Math.cos(yaw), s = Math.sin(yaw);
		const v = (a, b, h) => [x + c * a - s * b, y0 + h, z + s * a + c * b];
		const X = sx / 2, Z = sz / 2;
		const q = [v(-X, -Z, 0), v(X, -Z, 0), v(X, Z, 0), v(-X, Z, 0), v(-X, -Z, sy), v(X, -Z, sy), v(X, Z, sy), v(-X, Z, sy)];
		quad(q[4], q[5], q[6], q[7], col); quad(q[0], q[1], q[5], q[4], col); quad(q[1], q[2], q[6], q[5], col); quad(q[2], q[3], q[7], q[6], col); quad(q[3], q[0], q[4], q[7], col);
	};
	// a wall from the path's height down into the ground under it (each point's g), at `off` across
	const skirt = (path, off, col) => {
		for (let i = 0; i + 1 < path.length; i++) {
			const A = path[i], B = path[i + 1], at = (q, y) => [q.x + q.nx * off, y, q.z + q.nz * off];
			quad(at(A, A.y), at(B, B.y), at(B, B.g), at(A, A.g), typeof col === 'function' ? col(i) : col);
		}
	};
	const mesh = (mat) => {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		g.computeVertexNormals();
		return new THREE.Mesh(g, mat);
	};
	return { sweep, skirt, box, beam, column, mesh, size: () => P.length / 3 };
}

// a polyline's points every `step` metres, with the left normal (the direction's left in
// this world: x east, z south) at each
function resample(pts, step) {
	const out = [];
	for (let i = 0; i + 3 < pts.length; i += 2) {
		const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3], L = Math.hypot(bx - ax, bz - az);
		if (L < 0.01) continue;
		const n = Math.max(1, Math.ceil(L / step));
		for (let k = i ? 1 : 0; k <= n; k++) out.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, dx: (bx - ax) / L, dz: (bz - az) / L });
	}
	for (const p of out) { p.nx = p.dz; p.nz = -p.dx; }
	return out;
}

// roadAt(r, x, z): a road's graded height (berms.js), the surface a deck ramps down to and
// the lanes under it are cleared from, the same wherever you stand
const LIT = 450, LAMP_GAP = 58;                                  // lit for 450 m round a ramp's ends, a pole every 58 m
const STEEL = [0.56, 0.57, 0.58], POST = [0.46, 0.46, 0.45], HEAD = [0.3, 0.31, 0.32];
export function createFreeways(scene, bay, real, { isPhone = false, roadAt = null } = {}) {
	const group = new THREE.Group();
	group.name = 'freeways';
	scene.add(group);
	const concrete = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide });
	const fenceTex = chainLink();
	const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, transparent: false, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
	// the lamps after dark: no lights (a phone rebuilds its shaders when the count changes),
	// a glow on each head and the pool it throws on the lanes below
	const CAP = isPhone ? 160 : 320;
	const lamps = new THREE.Group();
	lamps.name = 'freeway-lamps';
	scene.add(lamps);
	const glowGeo = new THREE.BufferGeometry();
	glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(CAP * 3), 3));
	glowGeo.setDrawRange(0, 0);
	// (made as the street lamps' glow is, streetlife.js, so the two share one shader program)
	const LED = lampLook('led').c;
	glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(CAP * 3).map((_, i) => LED[i % 3]), 3));
	const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({ color: 0xffffff, vertexColors: true, size: 2.2, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
	glow.frustumCulled = false; glow.visible = false;
	lamps.add(glow);
	const pools = lampPools(CAP);
	lamps.add(pools);
	const poolPos = new Float32Array(CAP * 3), poolCol = new Float32Array(CAP * 3), poolKind = new Uint8Array(CAP), poolYaw = new Float32Array(CAP);
	for (let i = 0; i < CAP; i++) poolCol.set(LED, i * 3);
	poolKind.fill(1);
	let lampN = 0;
	const R = isPhone ? 900 : 1400;
	let at = { x: 1e9, z: 1e9 }, ver = -1;
	let decks = [];                                  // for the floors: [{ pts: [{x,z,y}], hw }]
	// what the signage reads (signage/): the sound walls' faces toward the traffic, the piers,
	// the ramps' retaining walls, the bridges' faces over each road with its clearance, and
	// where each bridge crosses a freeway
	let marks = { walls: [], piers: [], abutments: [], faces: [], crossings: [] }, builds = 0;
	const grid = new Map();                          // 25 m cells -> deck segments
	const cellKey = (x, z) => Math.floor(x / 25) + ',' + Math.floor(z / 25);

	function clear() {
		for (const m of [...group.children]) { group.remove(m); m.geometry.dispose(); if (m.material !== concrete && m.material !== fenceMat) m.material.dispose(); }
		decks = []; grid.clear();
		marks = { walls: [], piers: [], abutments: [], faces: [], crossings: [] };
	}

	function build(cx, cz) {
		clear();
		const H = (x, z) => bay.heightAt(x, z), roadH = (q, x, z) => roadAt?.(q, x, z) ?? H(x, z);
		const all = real.near('roads', cx, cz, R), roads = all.filter((r) => r.drive);
		const lanes = roads.filter((r) => !r.bridge);
		const G = Geo(), F = [], heads = [];              // concrete; chain link as ribbons { a, b, v }; lamp heads
		const CON = [0.66, 0.64, 0.6], WALL = [0.6, 0.56, 0.49], ASPH = [0.26, 0.26, 0.27];
		const tint = (base, i, k = 0.05) => { const h = Math.sin(i * 12.9898) * 43758.5453 % 1; const f = 1 + (Math.abs(h) - 0.5) * k * 2; return base.map((c) => c * f); };
		// chain link between two lines along a path, each [across, up] from its points
		const ribbon = (pts, [o0, h0], [o1, h1]) => F.push({ a: pts.map((q) => [q.x + q.nx * o0, q.y + h0, q.z + q.nz * o0]), b: pts.map((q) => [q.x + q.nx * o1, q.y + h1, q.z + q.nz * o1]), v: Math.hypot(o1 - o0, h1 - h0) / 1.85 });

		// A davit lamp standard: a pole to 12 m, its arm curving out over the lanes on each side
		// asked (-1 the right of the way it stands by, +1 the left) to an LED head; heads go in
		// `heads` for their glow and their pools after dark. (x, y, z): its foot, g the ground.
		const lampPost = (x, y, z, nx, nz, sides, g) => {
			const top = g + 12.2;
			G.beam([x, y - 0.1, z], [x, top - 0.6, z], 0.26, STEEL);
			for (const sd of sides) {
				// (the arm's curve: up out of the pole and over, 2.6 m out)
				const pts = [[0, top - 0.9], [0.25, top - 0.25], [0.8, top + 0.05], [1.7, top + 0.18], [2.6, top + 0.22]];
				for (let k = 0; k + 1 < pts.length; k++) {
					const [a0, h0] = pts[k], [a1, h1] = pts[k + 1];
					G.beam([x + nx * sd * a0, h0, z + nz * sd * a0], [x + nx * sd * a1, h1, z + nz * sd * a1], 0.12, STEEL);
				}
				// the head: a flat LED fitting, its lens to the road
				const hx = x + nx * sd * 3.05, hz = z + nz * sd * 3.05;
				G.beam([x + nx * sd * 2.55, top + 0.2, z + nz * sd * 2.55], [hx + nx * sd * 0.35, top + 0.2, hz + nz * sd * 0.35], 0.3, HEAD);
				heads.push({ x: hx, y: top + 0.02, z: hz, yaw: Math.atan2(nz, -nx) });
			}
		};

		// ---- the freeways: the median wall or rail, lamps, sound walls beside the houses ----
		// (fwyplan.js: where the other direction runs, and so where the median is)
		const CW = carriageways(roads);
		// where the ramps leave and join: the freeway is lit for a stretch either side
		const gores = [];
		for (const q of roads) if (q.link && q.cls === 'motorway' && !q.bridge) { const p = q.pts, m = p.length; gores.push([p[0], p[1]], [p[m - 2], p[m - 1]]); }
		const lit = (x, z) => gores.some(([gx, gz]) => Math.abs(gx - x) < LIT && Math.abs(gz - z) < LIT && Math.hypot(gx - x, gz - z) < LIT);
		// a carriageway's key: of the two either side of a shared wall, the lower one builds it
		const keyOf = (q) => q.pts[0] * 7.31 + q.pts[1];
		// whether a column can't stand at (x, z): on a road or its shoulders, or on a freeway's
		// paved median anywhere but the line of its wall
		const blocked = (x, z) => lanes.some((l) => {
			if (!near(l, x, z, 25)) return false;
			const c = isCarriageway(l), hw = l.w / 2, d = distTo(l, x, z);
			if (d < hw + (c ? SHOULDER_R + 0.8 : 2.2)) return true;
			if (!c || d > hw + 12) return false;
			// (the nearest point on its centre line, and whether (x, z) is on its left there)
			const p = l.pts;
			let bd = 1e9, bx = 0, bz = 0, ux = 0, uz = 0;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], ex = p[i + 2] - ax, ez = p[i + 3] - az, l2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
				const dd = Math.hypot(x - ax - ex * t, z - az - ez * t);
				if (dd < bd) { bd = dd; bx = ax + ex * t; bz = az + ez * t; const L = Math.sqrt(l2); ux = ex / L; uz = ez / L; }
			}
			if ((x - bx) * uz - (z - bz) * ux <= 0) return false;
			const m = medianFor(hw, gapLeft(CW, bx, bz, ux, uz));
			return !m.shared || Math.abs(d - m.wall) > 0.9;
		});
		for (const r of roads) {
			if (r.cls !== 'motorway' || r.bridge) continue;
			const hw = r.w / 2, path = resample(r.pts, 8);
			if (!r.link) {
				// the median, read at each point and steadied over its neighbours (a ramp's piece or a
				// gap in the map shouldn't make the wall jump)
				const raw = path.map((p) => gapLeft(CW, p.x, p.z, p.dx, p.dz, true));
				const med = path.map((p, i) => {
					const win = [];
					for (let k = Math.max(0, i - 2); k <= Math.min(path.length - 1, i + 2); k++) win.push(raw[k]);
					win.sort((a, b) => a.g - b.g);
					const w = win[win.length >> 1];
					return { ...medianFor(hw, w.g), other: w.r };
				});
				// The shared wall: Caltrans's Type 60, a tall single-slope concrete barrier (no step
				// at the foot), built by one of the two directions. Where the two sides lie at
				// different heights it reaches down to the lower and up past the higher.
				const mine = (i) => med[i].shared && (!med[i].other || med[i].other.bridge || keyOf(r) <= keyOf(med[i].other) || (i && med[i - 1].other !== med[i].other) || (i + 1 < med.length && med[i + 1].other !== med[i].other));
				let run = [];
				const flushWall = () => {
					if (run.length > 1) {
						const prof = (i) => { const q = run[i], d = q.hi - q.lo; return [[-0.3, -0.25 - d], [-0.3, 0], [-0.27, 0.22], [-0.1, 1.07], [0.1, 1.07], [0.27, 0.22], [0.3, 0], [0.3, -0.25 - d]]; };
						// (weathered: darker at the foot where the road grime splashes it)
						G.sweep(run, (i) => prof(i).slice(0, 3), [0.38, 0.37, 0.35]);
						G.sweep(run, (i) => prof(i).slice(2, 6), (i) => tint([0.62, 0.61, 0.58], Math.floor(i / 2), 0.035));
						G.sweep(run, (i) => prof(i).slice(5), [0.38, 0.37, 0.35]);
					}
					run = [];
				};
				for (let i = 0; i < path.length; i++) {
					if (!mine(i)) { flushWall(); continue; }
					const p = path[i], o = med[i].wall, x = p.x + p.nx * o, z = p.z + p.nz * o;
					const yL = H(x + p.nx * 0.6, z + p.nz * 0.6), yR = H(x - p.nx * 0.6, z - p.nz * 0.6), hi = Math.max(yL, yR, H(x, z)) - 0.04, lo = Math.min(yL, yR) - 0.04;
					run.push({ x, z, y: hi, hi, lo, nx: p.nx, nz: p.nz });
				}
				flushWall();
				// Where the median is ground: a metal beam guardrail beyond the left shoulder, its
				// posts behind it, away from the traffic
				run = [];
				const flushRail = () => {
					if (run.length > 1) {
						G.sweep(run, [[0, 0.5], [0.07, 0.58], [0.0, 0.66], [0.07, 0.74], [0, 0.82]], (i) => tint(STEEL, i, 0.03));
						G.sweep(run, [[0.07, 0.82], [0.13, 0.84]], STEEL);
						// (a post every 4 m: at each point and halfway to the next)
						const post = (x, y, z, nx, nz) => G.beam([x + nx * 0.2, y - 0.3, z + nz * 0.2], [x + nx * 0.2, y + 0.78, z + nz * 0.2], 0.15, POST);
						for (let i = 0; i < run.length; i++) {
							const q = run[i], n = run[i + 1];
							post(q.x, q.y, q.z, q.nx, q.nz);
							if (n) post((q.x + n.x) / 2, (q.y + n.y) / 2, (q.z + n.z) / 2, q.nx, q.nz);
						}
					}
					run = [];
				};
				for (let i = 0; i < path.length; i++) {
					if (med[i].shared) { flushRail(); continue; }
					const p = path[i], o = med[i].wall, x = p.x + p.nx * o, z = p.z + p.nz * o;
					run.push({ x, z, y: H(x, z) - 0.03, nx: p.nx, nz: p.nz });
				}
				flushRail();
				// The lamps by the interchanges: davit poles on the median wall (two arms, one over
				// each direction) or, on a split median, one arm over the lanes from beyond the rail
				let last = -1e9, s = 0;
				for (let i = 0; i < path.length; i++) {
					if (i) s += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
					if (s - last < LAMP_GAP || !lit(path[i].x, path[i].z)) continue;
					if (med[i].shared && !mine(i)) continue;
					last = s;
					const p = path[i], o = med[i].wall + (med[i].shared ? 0 : 0.6), x = p.x + p.nx * o, z = p.z + p.nz * o, y = H(x, z) + (med[i].shared ? 1.07 : 0);
					lampPost(x, y, z, p.nx, p.nz, med[i].shared ? [-1, 1] : [-1], H(x, z));
				}
			}
			// sound walls on the right where houses back onto the freeway, broken at ramps and
			// cross streets
			let run = [];
			const flush = () => {
				if (run.length > 3) {
					for (let i = 0; i + 1 < run.length; i++) { const a = run[i], b = run[i + 1]; marks.walls.push({ x: (a.x + b.x) / 2 + a.nx * 0.17, z: (a.z + b.z) / 2 + a.nz * 0.17, y: Math.min(a.y, b.y), nx: a.nx, nz: a.nz, w: Math.hypot(b.x - a.x, b.z - a.z), h: 4.3 }); }
					G.sweep(run, [[-0.16, -0.6], [-0.16, 4.3], [0.16, 4.3], [0.16, -0.6]], (i) => tint(WALL, Math.floor(i / 2), 0.04));
					G.sweep(run, [[-0.24, 4.3], [-0.24, 4.5], [0.24, 4.5], [0.24, 4.3]], [0.52, 0.49, 0.44]);
				}
				run = [];
			};
			for (const p of path) {
				const off = -(hw + (r.link ? 1.5 : 3.2)), x = p.x + p.nx * off, z = p.z + p.nz * off;
				const L = real.landAt(p.x + p.nx * (off - 22), p.z + p.nz * (off - 22));
				const houses = !!L && L.lu === 1;
				const crossing = houses && lanes.some((q) => q !== r && q.cls !== 'motorway' && Math.abs(q.box[0] + q.box[2] - 2 * x) < (q.box[2] - q.box[0]) + 30 && Math.abs(q.box[1] + q.box[3] - 2 * z) < (q.box[3] - q.box[1]) + 30 && distTo(q, x, z) < q.w / 2 + 9);
				if (houses && !crossing) run.push({ x, z, y: H(x, z), nx: p.nx, nz: p.nz });
				else flush();
			}
			flush();
		}

		// ---- the overpasses ----
		// Every mapped bridge that crosses a road, and the footbridges over them. A deck clears
		// only the roads that pass under it (not the ones it joins at its ends) and ramps down
		// along the road it carries on to, through plain joins and never across a junction, so
		// you drive or walk up onto it rather than meeting a wall.
		const signs = [];
		const ends = new Map(), ek = (x, z) => Math.round(x / 4) + ',' + Math.round(z / 4);
		for (const q of all) {
			if (q.bridge) continue;
			const p = q.pts, m = p.length;
			for (const e of [0, 1]) { const k = ek(e ? p[m - 2] : p[0], e ? p[m - 1] : p[1]); let c = ends.get(k); if (!c) ends.set(k, c = []); c.push([q, e]); }
		}
		// the roads on the ground that end at (x, z)
		const endsAt = (x, z, ok) => {
			const out = [], i0 = Math.round(x / 4), j0 = Math.round(z / 4);
			for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (const [q, e] of ends.get(i + ',' + j) || []) {
				const p = q.pts, m = p.length;
				if (ok(q) && Math.hypot((e ? p[m - 2] : p[0]) - x, (e ? p[m - 1] : p[1]) - z) < 1.5) out.push([q, e]);
			}
			return out;
		};
		// the road leading on from a deck's end (x, z), heading (dx, dz) away from it, for up to
		// len metres: its points from the end outward (the roads it takes go in `took`)
		const approach = (x, z, dx, dz, len, ok, took) => {
			const out = [];
			let got = 0;
			for (let hop = 0; hop < 4 && got < len; hop++) {
				const at = endsAt(x, z, ok).filter(([q]) => !took.has(q));
				if (at.length !== 1) break;
				const [q, e] = at[0], p = q.pts, m = p.length / 2;
				took.add(q);
				let px = x, pz = z;
				for (let k = 1; k < m && got < len; k++) {
					const id = e ? m - 1 - k : k, qx = p[id * 2], qz = p[id * 2 + 1], L = Math.hypot(qx - px, qz - pz);
					if (L < 0.01) continue;
					// (it has to lead on, not turn back under the deck)
					if (((qx - px) * dx + (qz - pz) * dz) / L < 0.5) return out;
					const t = Math.min(1, (len - got) / L);
					out.push({ x: px + (qx - px) * t, z: pz + (qz - pz) * t });
					got += L * t; dx = (qx - px) / L; dz = (qz - pz) / L; px = qx; pz = qz;
				}
				x = px; z = pz;
			}
			return out;
		};
		const bridges = all.filter((q) => q.bridge && q.drive);
		const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
		const lenOf = (pts) => { let l = 0; for (let i = 0; i + 1 < pts.length; i++) l += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z); return l; };
		const near = (q, x, z, pad) => x > q.box[0] - pad && x < q.box[2] + pad && z > q.box[1] - pad && z < q.box[3] + pad;
		const FOOTC = [0.64, 0.62, 0.58];
		for (const r of all) {
			if (!r.bridge) continue;
			const foot = FOOT.has(r.cls);
			if (!r.drive && !foot) continue;
			// (the great water crossings are modelled whole elsewhere, bay/bridge.js and
			// bay/landmarks.js: a mapped bridge mostly over open water is theirs, not an overpass)
			if (/golden gate bridge/i.test(r.name || '')) continue;
			{ let wet = 0, n = 0; for (let i = 0; i < r.pts.length; i += 2) { n++; if (bay.heightAt(r.pts[i], r.pts[i + 1]) < -2) wet++; } if (wet > n * 0.3) continue; }
			// (a footbridge over a creek stays painted on the ground, realcity.js; one mapped as an
			// overpass's sidewalk is carried on the road's own deck)
			if (foot && (!footLifted(r, lanes) || sidewalkOf(r, bridges))) continue;
			const p = r.pts, m = p.length;
			const span = resample(p, 4);
			if (span.length < 2) continue;
			const SL = lenOf(span);
			const under = lanesUnder(r, lanes);
			// a "bridge" with nothing driven under it (a culvert, a gully, the cut at Vista Point) is
			// laid on the ground it crosses: no deck on stilts across open ground
			const grounded = !under.size;
			if (grounded && foot) continue;
			// (a town street's overpass carries its sidewalks)
			const walk = !foot && r.walked && r.cls !== 'motorway' && r.cls !== 'trunk' && !r.link;
			const W = foot ? Math.max(r.w, 2.4) + 0.6 : r.w + 1.2 + (walk ? 3.4 : 0);
			// ramps at 6% for cars, 1 in 12 for people on foot, steeper only where the road runs out
			const g0 = foot ? 0.083 : 0.06, gMax = foot ? 0.12 : 0.1, ok = foot ? (q) => FOOT.has(q.cls) : (q) => q.drive && !q.bridge;
			const took = new Set(), len = 8.5 / g0 + 10;
			const A = grounded ? [] : approach(p[0], p[1], ...unit(p[0] - p[2], p[1] - p[3]), len, ok, took);
			const B = grounded ? [] : approach(p[m - 2], p[m - 1], ...unit(p[m - 2] - p[m - 4], p[m - 1] - p[m - 3]), len, ok, took);
			const flat = [];
			for (let k = A.length - 1; k >= 0; k--) flat.push(A[k].x, A[k].z);
			for (let k = 0; k < m; k++) flat.push(p[k]);
			for (const q of B) flat.push(q.x, q.z);
			const path = resample(flat, 4), n = path.length;
			if (n < 2) continue;
			let L = 0;
			const s = path.map((q, i) => (i ? (L += Math.hypot(q.x - path[i - 1].x, q.z - path[i - 1].z)) : 0));
			const sA = A.length ? lenOf([{ x: p[0], z: p[1] }, ...A]) : 0, sB = sA + SL;
			const onSpan = (i) => s[i] >= sA - 0.5 && s[i] <= sB + 0.5;
			// the ground under each point: the road it ramps down along, or the land under the span
			const gnd = path.map((q) => { for (const t of took) if (distTo(t, q.x, q.z) < t.w / 2) return roadH(t, q.x, q.z); return H(q.x, q.z); });
			// the height each point must clear: the lane under it, its clearance and the girder
			const need = path.map((q) => {
				let c = -1e9;
				for (const l of under) if (near(l, q.x, q.z, 30) && distTo(l, q.x, q.z) < l.w / 2 + 3) c = Math.max(c, roadH(l, q.x, q.z) + (l.cls === 'motorway' || l.cls === 'trunk' ? 5.1 : l.cls === 'service' ? 4.2 : 4.6) + (foot ? 0.9 : 1.75));
				return c;
			});
			let ys;
			if (grounded) ys = gnd.map((g) => g + 0.25);
			else {
				const lo = need.findIndex((v) => v > -1e8), hi = n - 1 - [...need].reverse().findIndex((v) => v > -1e8);
				const gA = Math.min(gMax, Math.max(g0, (need[lo] - gnd[0]) / Math.max(1, s[lo]))), gB = Math.min(gMax, Math.max(g0, (need[hi] - gnd[n - 1]) / Math.max(1, L - s[hi])));
				ys = gnd.map((g, i) => g + (onSpan(i) ? 0.25 : -0.3));
				for (let j = lo; j <= hi; j++) if (need[j] > -1e8) for (let i = 0; i < n; i++) ys[i] = Math.max(ys[i], need[j] + 0.3 - (i < j ? gA * (s[j] - s[i]) : gB * (s[i] - s[j])));
				// level across the lanes it crosses (no sag between them), then eased into a vertical
				// curve at the crest and at the foot of each ramp, not a kink
				for (let i = lo; i <= hi; i++) ys[i] = Math.max(ys[i], ys[lo] + (ys[hi] - ys[lo]) * (s[i] - s[lo]) / Math.max(1, s[hi] - s[lo]));
				for (let pass = 0; pass < 4; pass++) { const c = ys.slice(); for (let i = 1; i < n - 1; i++) ys[i] = (c[i - 1] + c[i] * 2 + c[i + 1]) / 4; }
				for (let i = 0; i < n; i++) { if (need[i] > -1e8) ys[i] = Math.max(ys[i], need[i]); if (onSpan(i)) ys[i] = Math.max(ys[i], gnd[i] + 0.25); }
			}
			const deck = path.map((q, i) => ({ x: q.x, z: q.z, y: ys[i] + 0.2, g: gnd[i] - 0.4, nx: q.nx, nz: q.nz, sp: onSpan(i) }));
			// the runs that stand up off the ground (each with a point either end that sinks back into it)
			const runs = [];
			{
				let cur = null;
				for (let i = 0; i < n; i++) {
					if (deck[i].sp || deck[i].y - gnd[i] > 0.12) { if (!cur) { cur = []; if (i) cur.push({ ...deck[i - 1], y: gnd[i - 1] - 0.05 }); } cur.push(deck[i]); }
					else if (cur) { cur.push({ ...deck[i], y: gnd[i] - 0.05 }); runs.push(cur); cur = null; }
				}
				if (cur) runs.push(cur);
			}
			// a run split into its span and its ramps (sharing the points where they meet)
			const parts = (run) => { const out = []; let cur = [run[0]]; for (let i = 1; i < run.length; i++) { cur.push(run[i]); if (run[i].sp !== run[i - 1].sp || i === run.length - 1) { if (cur.length > 1) out.push([cur, run[i - 1].sp && run[i].sp]); cur = [run[i]]; } } return out; };
			const hw = W / 2, rim = foot ? 0.2 : 0.38;
			for (const run of runs) {
				if (!walk) G.sweep(run, [[-hw, 0], [hw, 0]], foot ? FOOTC : ASPH);
				else {
					const rw = hw - 1.7;
					G.sweep(run, [[-rw, 0], [rw, 0]], ASPH);
					for (const sd of [-1, 1]) G.sweep(run, [[sd * rw, 0], [sd * rw, 0.15], [sd * hw, 0.15]], FOOTC);
				}
				for (const [pts, sp] of parts(run)) for (const sd of [-1, 1]) {
					if (foot) G.sweep(pts, [[sd * hw, 0], [sd * hw, 0.22], [sd * (hw + rim), 0.22], [sd * (hw + rim), -0.3], [sd * hw, -0.3]], (i) => tint(CON, i, 0.03));
					else G.sweep(pts, [[sd * hw, 0], [sd * hw, 0.95], [sd * (hw + rim), 1.05], [sd * (hw + rim), -0.55], [sd * hw, -0.55]], (i) => tint(CON, i, 0.03));
					// the ramps ride on fill between retaining walls
					if (!sp) {
						G.skirt(pts, sd * (hw + rim), (i) => tint(CON, i + 3, 0.04).map((c) => c * 0.92));
						if (!foot) for (let i = 0; i + 1 < pts.length; i += 2) { const a = pts[i], b = pts[Math.min(pts.length - 1, i + 2)], o = sd * (hw + rim + 0.01), hgt = Math.min(a.y, b.y) - Math.max(a.g, b.g) - 0.2; if (hgt > 1.4) marks.abutments.push({ x: (a.x + b.x) / 2 + a.nx * o, z: (a.z + b.z) / 2 + a.nz * o, y: Math.max(a.g, b.g) + 0.4, nx: a.nx * sd, nz: a.nz * sd, w: Math.hypot(b.x - a.x, b.z - a.z), h: hgt }); }
					}
				}
				// the girder under the span
				for (const [pts, sp] of parts(run)) if (sp) {
					if (foot) G.sweep(pts, [[-hw - rim, -0.3], [-hw + 0.5, -0.9], [hw - 0.5, -0.9], [hw + rim, -0.3]], (i) => tint(CON, i, 0.03).map((c) => c * 0.86));
					else G.sweep(pts, [[-hw - rim, -0.55], [-hw + 0.7, -1.75], [hw - 0.7, -1.75], [hw + rim, -0.55]], (i) => tint(CON, i, 0.03).map((c) => c * 0.86));
				}
				// the chain link: along a road deck's parapets where it stands clear of the ground; on a
				// footbridge a railing up its ramps and over the traffic the cage, sides and roof
				let f = [];
				const flush = () => {
					if (f.length > 1) {
						const high = f.some((q) => q.y - q.g > 3);
						if (!foot) for (const sd of [-1, 1]) ribbon(f, [sd * (hw + 0.19), 1.05], [sd * (hw + 0.19), 2.9]);
						else if (!high) for (const sd of [-1, 1]) ribbon(f, [sd * (hw + 0.1), 0.22], [sd * (hw + 0.1), 1.15]);
						else {
							for (const sd of [-1, 1]) ribbon(f, [sd * (hw + 0.1), 0.22], [sd * (hw + 0.1), 2.3]);
							for (let k = 0; k < 6; k++) { const a0 = Math.PI * k / 6, a1 = Math.PI * (k + 1) / 6; ribbon(f, [Math.cos(a0) * (hw + 0.1), 2.3 + Math.sin(a0) * 0.8], [Math.cos(a1) * (hw + 0.1), 2.3 + Math.sin(a1) * 0.8]); }
						}
					}
					f = [];
				};
				for (const q of run) {
					const up = q.y - q.g - 0.4;
					if (foot ? up > 0.6 : up > 2.5) { if (f.length && foot && (up > 3) !== (f[f.length - 1].y - f[f.length - 1].g - 0.4 > 3)) { const last = f[f.length - 1]; flush(); f.push(last); } f.push(q); }
					else flush();
				}
				flush();
				decks.push({ pts: run, hw });
			}
			// columns, wherever the span is high and nothing drives beneath: a ramp's flyover on
			// single round columns flaring into the girder, a wide deck on two under a bent cap
			let last = -1e9;
			for (let i = 1; i < n - 1; i++) {
				const q = deck[i], gy = gnd[i], clear = q.y - gy;
				if (!q.sp || clear < 3.2 || s[i] - last < (foot ? 18 : 20)) continue;
				const cols = foot || W <= 13 ? [0] : [-W * 0.26, W * 0.26];
				if (cols.some((o) => blocked(q.x + q.nx * o, q.z + q.nz * o))) continue;
				last = s[i];
				// (the cap runs across the deck, along its normal)
				const yaw = Math.atan2(q.nz, q.nx), top = q.y - (foot ? 0.9 : 1.75);
				if (foot) { G.box(q.x, top - 0.6, q.z, W * 0.9, 0.6, 0.9, yaw, tint(CON, i, 0.03)); G.box(q.x, gy - 0.6, q.z, 0.8, top - 0.6 - gy + 0.6, 0.8, yaw, tint(CON, i + 7, 0.03)); continue; }
				if (cols.length > 1) G.box(q.x, top - 1.0, q.z, W * 0.82, 1.0, 1.4, yaw, tint(CON, i, 0.03));
				const cTop = cols.length > 1 ? top - 1.0 : top, flare = cols.length > 1 ? 0 : Math.min(2.2, (cTop - gy) * 0.2), r = cols.length > 1 ? 0.75 : 0.95;
				for (const o of cols) {
					const x = q.x + q.nx * o, z = q.z + q.nz * o, sides = isPhone ? 10 : 14;
					G.column(x, z, gy - 0.6, cTop - flare, r, r, sides, tint(CON, i + 7, 0.03));
					if (flare) G.column(x, z, cTop - flare, cTop + 0.05, r, Math.min(W * 0.3, r * 1.9), sides, tint(CON, i + 9, 0.03));
					marks.piers.push({ x, z, y: gy, h: cTop - gy, nx: q.nx, nz: q.nz, w: r * 2 });
				}
			}
			if (foot) continue;
			// the faces over each road it crosses, with the height under the girder, both sides
			for (const l of under) {
				let bi = -1, bd = 1e9;
				for (let i = 0; i < n; i++) { if (need[i] < -1e8) continue; const d = distTo(l, deck[i].x, deck[i].z); if (d < bd) { bd = d; bi = i; } }
				if (bi < 0 || bd > l.w / 2 + 2) continue;
				const q = deck[bi], clear = q.y - 1.75 - roadH(l, q.x, q.z);
				for (const sd of [-1, 1]) marks.faces.push({ x: q.x + q.nx * sd * (W / 2 + 0.39), z: q.z + q.nz * sd * (W / 2 + 0.39), y: q.y - 0.02, nx: q.nx * sd, nz: q.nz * sd, clear, cls: l.cls });
				if (l.cls === 'motorway') marks.crossings.push({ x: q.x, z: q.z });
			}
			// the signs, on the face toward the traffic of each freeway it crosses
			const seen = new Set();
			for (let i = 0; i < n; i++) {
				if (need[i] < -1e8) continue;
				const q = [...under].find((l) => l.cls === 'motorway' && !l.link && !seen.has(l) && distTo(l, deck[i].x, deck[i].z) < l.w / 2 + 3);
				if (!q) continue;
				seen.add(q);
				const num = (/(\d{1,3})/.exec(q.name || '') || [])[1] || routeOf(deck[i].x, deck[i].z);
				if (!num) continue;
				// the freeway's direction of travel here
				const qp = q.pts; let best = 0, bd = 1e9;
				for (let k = 0; k + 3 < qp.length; k += 2) { const d = Math.hypot((qp[k] + qp[k + 2]) / 2 - deck[i].x, (qp[k + 1] + qp[k + 3]) / 2 - deck[i].z); if (d < bd) { bd = d; best = k; } }
				let tx = qp[best + 2] - qp[best], tz = qp[best + 3] - qp[best + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
				const dir = Math.abs(tx) > Math.abs(tz) ? (tx > 0 ? 'E' : 'W') : (tz < 0 ? 'N' : 'S');
				const dest = q.dest || DEST[+num]?.[dir] || q.name || 'Freeway';
				// the deck's face toward oncoming traffic: the side the traffic comes from
				const sd = Math.sign(deck[i].nx * -tx + deck[i].nz * -tz) || 1;
				const fx = deck[i].x + deck[i].nx * sd * (W / 2 + 0.45), fz = deck[i].z + deck[i].nz * sd * (W / 2 + 0.45);
				signs.push({ x: fx, y: deck[i].y - 0.35, z: fz, yaw: Math.atan2(-tx, -tz), num, dir, dest });
			}
		}

		// meshes
		if (G.size()) { const m = G.mesh(concrete); m.castShadow = true; m.receiveShadow = true; group.add(m); }
		if (F.length) {
			const P = [], UV = [];
			for (const { a, b, v } of F) {
				let u = 0;
				for (let i = 0; i + 1 < a.length; i++) {
					const du = Math.hypot(a[i + 1][0] - a[i][0], a[i + 1][2] - a[i][2]) / 3.0;
					P.push(...a[i], ...a[i + 1], ...b[i + 1], ...a[i], ...b[i + 1], ...b[i]);
					UV.push(u, 0, u + du, 0, u + du, v, u, 0, u + du, v, u, v);
					u += du;
				}
			}
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
			g.computeVertexNormals();
			group.add(new THREE.Mesh(g, fenceMat));
		}
		for (const sg of signs) {
			const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.8), new THREE.MeshStandardMaterial({ map: signTexture(sg.num, sg.dir, sg.dest), roughness: 0.5 }));
			m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.yaw;
			const back = new THREE.Mesh(new THREE.BoxGeometry(7.3, 2.9, 0.12), concrete);
			back.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(back.geometry.attributes.position.count * 3).fill(0.5), 3));
			back.position.set(0, 0, -0.08); m.add(back);
			m.castShadow = true;
			group.add(m);
		}
		// the lamps' glow and pools, the nearest first
		heads.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
		lampN = Math.min(CAP, heads.length);
		const gp = glowGeo.attributes.position.array;
		for (let i = 0; i < lampN; i++) { const h = heads[i]; gp[i * 3] = h.x; gp[i * 3 + 1] = h.y; gp[i * 3 + 2] = h.z; poolPos[i * 3] = h.x; poolPos[i * 3 + 1] = h.y; poolPos[i * 3 + 2] = h.z; poolYaw[i] = h.yaw; }
		glowGeo.attributes.position.needsUpdate = true;
		glowGeo.setDrawRange(0, lampN);
		pools.fill(lampN, poolPos, poolCol, poolKind, poolYaw, H);
		builds++;
		// the decks, indexed for floor()
		decks.forEach((d, di) => { for (let i = 0; i + 1 < d.pts.length; i++) { const a = d.pts[i], b = d.pts[i + 1]; for (const k of new Set([cellKey(a.x, a.z), cellKey(b.x, b.z)])) { let c = grid.get(k); if (!c) grid.set(k, c = []); c.push([di, i]); } } });
	}

	// the deck under (x, z) if you are on it or above it (y: your feet's height less a margin)
	function floor(x, z, y) {
		let best = -1e9;
		for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
			const c = grid.get((Math.floor(x / 25) + gx) + ',' + (Math.floor(z / 25) + gz));
			if (!c) continue;
			for (const [di, i] of c) {
				const d = decks[di], a = d.pts[i], b = d.pts[i + 1];
				const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
				if (t < -0.02 || t > 1.02) continue;
				const off = Math.abs((x - a.x) * dz - (z - a.z) * dx) / Math.sqrt(l2);
				if (off > d.hw + 0.2) continue;
				const yd = a.y + (b.y - a.y) * Math.max(0, Math.min(1, t));
				if (y > yd - 2.2 && yd > best) best = yd;
			}
		}
		return best;
	}

	function update(camera, night = 0) {
		if (!real?.loaded()) return;
		const x = camera.position.x, z = camera.position.z;
		const v = real.version ? real.version() : 0;
		if (camera.position.y > 3000) { group.visible = lamps.visible = false; return; }
		group.visible = lamps.visible = true;
		// (on as the street lamps come on: streetlife.js)
		const on = Math.max(0, Math.min(1, (night - 0.08) / 0.25));
		glow.material.opacity = on; glow.visible = on > 0.002 && lampN > 0;
		pools.setLevel(on);
		if (Math.hypot(x - at.x, z - at.z) < R * 0.3 && v === ver) return;
		at = { x, z }; ver = v;
		build(x, z);
	}
	return { group, update, floor, decks: () => decks.length, marks: () => marks, builds: () => builds };
}
