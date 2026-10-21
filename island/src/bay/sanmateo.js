// The San Mateo-Hayward Bridge (SR 92), as you see it driving west across it: 10.5 km over
// the South Bay from Hayward to Foster City. Two low concrete trestles side by side for the
// first seven kilometres (the 1967 one and its 2003 twin, three lanes and a wide right
// shoulder each way, a narrow left shoulder by the yellow edge line, a Jersey barrier both
// sides, open water in the gap between them), then the high-rise: one steel box girder
// carrying all six lanes in a long climb to 41 m over the shipping channel and down onto
// the Peninsula shore, its girder haunched over the twin-legged piers so the soffits read
// as arches from the trestle. Tall single-arm davit lamps along both outer edges at a steady
// rhythm, and beside the bridge to the south the line of steel lattice towers carrying the
// power lines across the bay, the two either side of the channel twice the height.
//
// Cheap by design: everything is built once, merged per material (concrete, the painted
// deck, the lamps and towers instanced in one steel, the wires as lines, the lamps' glow as
// points), five draws for the whole crossing. No real lights: by night the lamp heads glow
// and their pools are painted on the deck by its own shader (one uniform). You can walk
// and drive across it (floor()); the gap between the trestles is open water.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// the shores it spans: Foster City (west, s = 0) and Hayward (east)
const WEST = [37.5832, -122.2583], EAST = [37.6180, -122.1470];
// the high-rise's length from the west shore, how far it turns from the trestle's line (the
// trestle runs on WSW and the high-rise bends away south toward Foster City), the bend's radius
const HIGH = 3060, BEND = 10 * Math.PI / 180, RADIUS = 1200;
// heights of the road: the trestle, the top of the climb (41 m clearance under a deep girder)
const TRESTLE_Y = 8.5, PEAK_Y = 46.5;
// (the road's run down onto each shore)
export const RAMP = 260;
// a deck: 15.2 m of road (3.0 m right shoulder, the white edge line, three 3.66 m lanes, the
// yellow line, 0.92 m left shoulder) between 0.5 m barriers; the gap between the trestles
export const ROAD_W = 15.2, BARRIER_W = 0.5, DECK_W = ROAD_W + 2 * BARRIER_W, GAP = 3, BARRIER_H = 0.95;
// the paint repeats every 48 ft (a 12 ft dash, a 36 ft gap); a lamp every three repeats
export const PAINT_L = 14.63, LAMP_D = 3 * PAINT_L, LAMP_0 = LAMP_D / 2;
// a lamp: its head over the road (in from the road's edge) and above it
export const LAMP_IN = 3.35, LAMP_H = 13.1;
// the power line: its offset south of the centre line, the towers' spacing
const LINE_T = -30, TOWER_D = 330;

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The bridge's plan and profile: the centre line by distance s from the west shore (local
// metres about the bridge's middle, +x east, +z south), the road's height, the two decks'
// offsets. Plain numbers, for the build, the floor and the tests.
export function sanMateoLayout(heightAt = () => -4) {
	const A = toWorld(...WEST), B = toWorld(...EAST);
	const O = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
	const C = Math.hypot(B.x - A.x, B.z - A.z), bc = Math.atan2(B.x - A.x, -(B.z - A.z));
	// bearings (clockwise from north) eastward: the high-rise turned south of the chord, the
	// trestle north of it, so the two legs meet the shores
	const LT = C - HIGH, bH = bc - LT * BEND / C, bT = bc + HIGH * BEND / C;
	const arc = RADIUS * BEND;
	const sA = HIGH - arc / 2, sB = HIGH + arc / 2;
	const bearing = (s) => s < sA ? bH : s > sB ? bT : bH + (bT - bH) * (s - sA) / arc;
	// integrate the heading every 2 m, then fit the far end onto the Hayward shore
	const STEP = 2, pts = [{ x: 0, z: 0 }];
	let x = 0, z = 0, s = 0;
	while (s < C + 200) { const b = bearing(s + STEP / 2); x += Math.sin(b) * STEP; z -= Math.cos(b) * STEP; s += STEP; pts.push({ x, z }); }
	// (the length that reaches the shore: where the run passes nearest B's distance)
	let n = pts.length - 1;
	while (n > 1 && Math.hypot(pts[n - 1].x, pts[n - 1].z) >= C) n--;
	const end = pts[n], k = C / Math.hypot(end.x, end.z), rot = Math.atan2(B.x - A.x, B.z - A.z) - Math.atan2(end.x, end.z);
	const cr = Math.cos(rot), sr = Math.sin(rot);
	const X = new Float64Array(n + 1), Z = new Float64Array(n + 1);
	for (let i = 0; i <= n; i++) { const p = pts[i]; X[i] = A.x - O.x + k * (p.x * cr + p.z * sr); Z[i] = A.z - O.z + k * (-p.x * sr + p.z * cr); }
	const L = n * STEP * k, ds = STEP * k;
	// the frame at s: the point, the way east (dx, dz) and the left of it (north: nx, nz)
	function frame(s, out = {}) {
		const f = Math.max(0, Math.min(n - 1e-6, s / ds)), i = Math.floor(f), u = f - i;
		const x0 = X[i], z0 = Z[i], x1 = X[Math.min(n, i + 1)], z1 = Z[Math.min(n, i + 1)];
		let dx = x1 - x0, dz = z1 - z0; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
		out.x = x0 + (x1 - x0) * u; out.z = z0 + (z1 - z0) * u; out.dx = dx; out.dz = dz; out.nx = dz; out.nz = -dx;
		return out;
	}
	// the ground at the two ends, where the road comes down onto the shore
	const gW = Math.max(1.2, heightAt(A.x, A.z)) + 0.25, gE = Math.max(1.2, heightAt(B.x, B.z)) + 0.25;
	const peakS = RAMP + (HIGH - RAMP) * 0.45;
	// the road's height: down to the shores at the ends, the trestle's level, and the
	// high-rise's climb, a long vertical curve to the channel and a longer one down
	function roadY(s) {
		let y = TRESTLE_Y + (gW - TRESTLE_Y) * (1 - smooth(0, RAMP, s)) + (gE - TRESTLE_Y) * smooth(L - RAMP, L, s);
		if (s > RAMP && s < HIGH) {
			const v = (s - RAMP) / (HIGH - RAMP), p = 0.45;
			const h = v < p ? 0.5 * (1 - Math.cos(Math.PI * v / p)) : 0.5 * (1 + Math.cos(Math.PI * (v - p) / (1 - p)));
			y += (PEAK_Y - TRESTLE_Y) * h;
		}
		return y;
	}
	// the gap between the two decks: none on the high-rise (one girder, a median barrier),
	// opening to the trestles' over the bend's last stretch
	const gap = (s) => GAP * smooth(HIGH, HIGH + 120, s);
	// the centre of each deck across the centre line: westbound to the north (+), eastbound south
	const deckT = (s, dir) => dir * (DECK_W / 2 + gap(s) / 2);
	// where (x, z) (local) lies: s along, t across (Newton steps from the chord)
	const ux = (X[n] - X[0]) / L, uz = (Z[n] - Z[0]) / L, F = {};
	function locate(x, z) {
		let s = (x - X[0]) * ux + (z - Z[0]) * uz;
		for (let k = 0; k < 4; k++) { frame(s, F); s += (x - F.x) * F.dx + (z - F.z) * F.dz; }
		frame(s, F);
		return { s, t: (x - F.x) * F.nx + (z - F.z) * F.nz };
	}
	// the floor under (x, z): the road, the barriers' tops; NaN off the decks
	function deckAt(s, t) {
		if (s < 0 || s > L) return NaN;
		const y = roadY(s);
		for (const dir of [1, -1]) {
			const a = Math.abs(t - deckT(s, dir));
			if (a <= ROAD_W / 2) return y;
			if (a <= DECK_W / 2) return y + BARRIER_H;
		}
		return NaN;
	}
	return { O, A, B, L, HIGH, peakS, frame, roadY, gap, deckT, locate, deckAt, high: (s) => s < HIGH };
}

// ---------- the painted deck ----------
// one deck's road, 15.2 m across (u from the right-hand, outer barrier) by one repeat of the
// paint along: pale concrete, the wheel paths darker, a joint, the lines, the reflectors
function deckTexture() {
	const W = 512, H = 512, c = document.createElement('canvas');
	c.width = W; c.height = H;
	const g = c.getContext('2d'), px = (u) => u / ROAD_W * W, py = (v) => v / PAINT_L * H;
	let seed = 92;
	const rn = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
	g.fillStyle = '#b5b1a7'; g.fillRect(0, 0, W, H);
	// mottling, then the grain of the aggregate
	for (let i = 0; i < 260; i++) { const r = 8 + rn() * 40; g.fillStyle = `rgba(${rn() < 0.5 ? '90,86,80' : '215,212,204'},${0.03 + rn() * 0.04})`; g.beginPath(); g.ellipse(rn() * W, rn() * H, r, r * (0.5 + rn()), rn() * 3, 0, Math.PI * 2); g.fill(); }
	for (let i = 0; i < 16000; i++) { g.fillStyle = `rgba(${rn() < 0.5 ? '70,68,64' : '230,228,222'},${0.06 + rn() * 0.12})`; g.fillRect(rn() * W, rn() * H, 1, 1); }
	// each lane's wheel paths and the drip line down its middle
	for (let k = 0; k < 3; k++) {
		const mid = 3.15 + 1.83 + 3.66 * k;
		for (const o of [-0.88, 0.88]) { const gr = g.createLinearGradient(px(mid + o - 0.4), 0, px(mid + o + 0.4), 0); gr.addColorStop(0, 'rgba(60,58,54,0)'); gr.addColorStop(0.5, 'rgba(60,58,54,0.13)'); gr.addColorStop(1, 'rgba(60,58,54,0)'); g.fillStyle = gr; g.fillRect(px(mid + o - 0.4), 0, px(0.8), H); }
		const gr = g.createLinearGradient(px(mid - 0.3), 0, px(mid + 0.3), 0); gr.addColorStop(0, 'rgba(40,38,35,0)'); gr.addColorStop(0.5, 'rgba(40,38,35,0.09)'); gr.addColorStop(1, 'rgba(40,38,35,0)'); g.fillStyle = gr; g.fillRect(px(mid - 0.3), 0, px(0.6), H);
	}
	// the shoulders take less wear: a touch paler, with grit at the barrier's foot
	g.fillStyle = 'rgba(225,222,214,0.10)'; g.fillRect(0, 0, px(3.0), H); g.fillRect(px(14.28), 0, W - px(14.28), H);
	g.fillStyle = 'rgba(95,90,82,0.18)'; g.fillRect(0, 0, px(0.25), H); g.fillRect(W - px(0.25), 0, px(0.25), H);
	// the transverse joint between deck slabs
	g.fillStyle = 'rgba(55,54,52,0.45)'; g.fillRect(0, 0, W, 1.5);
	g.fillStyle = 'rgba(40,40,40,0.18)'; g.fillRect(0, 1.5, W, 1.5);
	// the lines: the solid white edge line, the dashed lane lines, the yellow edge line
	const paint = (u0, u1, v0, v1, col) => {
		g.fillStyle = col; g.fillRect(px(u0), py(v0), px(u1 - u0), py(v1 - v0));
		// worn by the tyres: flecks of concrete through it
		for (let i = 0; i < (u1 - u0) * (v1 - v0) * 140; i++) { g.fillStyle = `rgba(170,166,158,${0.25 + rn() * 0.5})`; g.fillRect(px(u0 + rn() * (u1 - u0)), py(v0 + rn() * (v1 - v0)), 1, 1); }
	};
	paint(3.0, 3.15, 0, PAINT_L, 'rgba(240,239,232,0.93)');
	for (const u of [3.15 + 3.66, 3.15 + 7.32]) paint(u - 0.05, u + 0.05, 1.2, 1.2 + 3.66, 'rgba(240,239,232,0.93)');
	paint(14.13, 14.28, 0, PAINT_L, 'rgba(226,178,46,0.92)');
	// the raised reflectors: one in each lane line's gap, amber ones along the yellow line
	for (const u of [3.15 + 3.66, 3.15 + 7.32]) { g.fillStyle = '#dcdad2'; g.fillRect(px(u - 0.05), py(9.6), px(0.1), py(0.1)); g.fillStyle = 'rgba(30,30,30,0.5)'; g.fillRect(px(u - 0.05), py(9.7), px(0.1), 1); }
	g.fillStyle = '#d8a830'; g.fillRect(px(13.97), py(7.3), px(0.1), py(0.1));
	// a few stains and bits of tread on the shoulders
	for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(35,33,30,${0.15 + rn() * 0.2})`; const u = rn() < 0.7 ? rn() * 2.8 : 14.4 + rn() * 0.7; g.fillRect(px(u), rn() * H, 2 + rn() * 5, 1 + rn() * 2); }
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
	t.repeat.set(1 / ROAD_W, 1 / PAINT_L);
	return t;
}
// a soft round glow for the lamps by night
function glowTexture() {
	const c = document.createElement('canvas'); c.width = c.height = 64;
	const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

// ---------- the pieces ----------
// a box from a to b (its long axis), w across and h up, in vertex colour col
function strut(a, b, w, h, col, list) {
	const d = new THREE.Vector3().subVectors(b, a), L = d.length();
	if (L < 1e-4) return;
	const g = new THREE.BoxGeometry(w, h, L);
	// (its two ends are never seen: dropped, a third fewer triangles)
	g.setIndex([...g.index.array].slice(0, 24));
	const up = Math.abs(d.y / L) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
	g.applyMatrix4(new THREE.Matrix4().lookAt(a, b, up));
	g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
	list.push(paintGeo(g, col));
}
function paintGeo(g, col, shade = null) {
	g.deleteAttribute('uv');
	const p = g.attributes.position, c = new Float32Array(p.count * 3);
	for (let i = 0; i < p.count; i++) { const k = shade ? shade(p.getX(i), p.getY(i), p.getZ(i)) : 1; c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k; }
	g.setAttribute('color', new THREE.BufferAttribute(c, 3));
	return g;
}
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// The davit lamp: a tapered galvanized pole 10 m up, a long sweep over into the arm, the flat
// LED head at its end. Its foot at the origin, the arm reaching along +x.
function lampGeometry() {
	const path = [];
	const R = 2.3, pole = 9.6;
	path.push([0, 0], [0, pole * 0.5], [0, pole]);
	for (let k = 1; k <= 8; k++) { const a = k / 8 * (Math.PI / 2 - 0.1); path.push([R - R * Math.cos(a), pole + R * Math.sin(a)]); }
	const last = path[path.length - 1], ang = 0.1;
	path.push([last[0] + Math.cos(ang) * 1.1, last[1] + Math.sin(ang) * 1.1]);
	const N = 6, pos = [], idx = [];
	let len = 0; const cum = [0];
	for (let i = 1; i < path.length; i++) cum.push(len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
	for (let i = 0; i < path.length; i++) {
		const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
		let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
		const r = 0.12 + (0.065 - 0.12) * cum[i] / len;
		for (let k = 0; k < N; k++) {
			const q = k / N * Math.PI * 2, cq = Math.cos(q), sq = Math.sin(q);
			// the ring in the plane across the path: (-ty, tx) in x-y, and z
			pos.push(path[i][0] - ty * cq * r, path[i][1] + tx * cq * r, sq * r);
		}
	}
	for (let i = 0; i + 1 < path.length; i++) for (let k = 0; k < N; k++) {
		const a = i * N + k, b = i * N + (k + 1) % N, c = a + N, d = b + N;
		idx.push(a, c, b, b, c, d);
	}
	const pole3 = new THREE.BufferGeometry();
	pole3.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	pole3.setIndex(idx); pole3.computeVertexNormals();
	paintGeo(pole3, lin(0xb4b8ba));
	// the head: a flat box, its lens below, pale
	const tip = path[path.length - 1];
	const head = new THREE.BoxGeometry(0.85, 0.16, 0.36).translate(0.32, 0, 0).rotateZ(ang).translate(tip[0], tip[1] - 0.02, 0);
	paintGeo(head, lin(0xa9adb0), (x, y) => (y < tip[1] - 0.06 ? 1.7 : 1));
	// a base plate on the barrier's top
	const plate = paintGeo(new THREE.BoxGeometry(0.42, 0.12, 0.42).translate(0, 0.06, 0), lin(0x8f9496));
	return { geo: mergeGeometries([pole3.toNonIndexed(), head.toNonIndexed(), plate.toNonIndexed()]), head: new THREE.Vector3(tip[0] + Math.cos(ang) * 0.32, tip[1] - 0.12, 0) };
}
// A steel lattice tower for a double-circuit line, 46 m: four legs splaying to a 9 m base,
// cross-braced face by face, three crossarms each side, two peaks for the earth wires. Local
// x across the line, z along it. Returns the geometry and the wires' attachment points.
export const TOWER_H = 46;
function towerGeometry() {
	const list = [], col = lin(0x9fa4a6), V = (x, y, z) => new THREE.Vector3(x, y, z);
	const waist = 30, top = 44, b0 = 4.6, w1 = 1.35;
	const half = (y) => y <= waist ? b0 + (w1 - b0) * (y / waist) : w1;
	const levels = [0, 6.5, 12, 17, 21.5, 25.5, 30, 34.5, 39, 44];
	const corners = (y) => { const h = half(y); return [V(-h, y, -h), V(h, y, -h), V(h, y, h), V(-h, y, h)]; };
	for (let i = 0; i + 1 < levels.length; i++) {
		const lo = corners(levels[i]), hi = corners(levels[i + 1]), m = i < 6 ? 0.32 : 0.24;
		for (let k = 0; k < 4; k++) {
			strut(lo[k], hi[k], m, m, col, list);                                   // the leg
			const a0 = lo[k], a1 = lo[(k + 1) % 4], c0 = hi[k], c1 = hi[(k + 1) % 4];
			strut(a0, c1, 0.14, 0.14, col, list); strut(a1, c0, 0.14, 0.14, col, list);   // the X on the face
			strut(c0, c1, 0.16, 0.16, col, list);                                  // the horizontal
		}
	}
	const wires = [];
	// the crossarms: a tapering truss out each side, an insulator string hanging from its tip
	for (const [y, reach] of [[30, 6.4], [35.5, 7.6], [41, 6.4]]) for (const sx of [-1, 1]) {
		const h = half(y), tip = V(sx * reach, y, 0);
		strut(V(sx * h, y, -h), tip, 0.18, 0.18, col, list); strut(V(sx * h, y, h), tip, 0.18, 0.18, col, list);
		strut(V(sx * h, y + 2.2, 0), tip, 0.16, 0.16, col, list);
		strut(V(sx * h, y, -h), V(sx * h, y + 2.2, 0), 0.12, 0.12, col, list); strut(V(sx * h, y, h), V(sx * h, y + 2.2, 0), 0.12, 0.12, col, list);
		const ins = V(sx * reach, y - 2.6, 0);
		list.push(paintGeo(new THREE.CylinderGeometry(0.13, 0.13, 2.6, 6, 1, true).translate(ins.x, y - 1.3, 0), lin(0x5f6e78)));
		wires.push(ins);
	}
	// the earth wires' peaks
	for (const sx of [-1, 1]) { const pk = V(sx * 2.6, 47.2, 0); strut(V(sx * w1, top, -w1), pk, 0.16, 0.16, col, list); strut(V(sx * w1, top, w1), pk, 0.16, 0.16, col, list); strut(V(0, top, 0), pk, 0.14, 0.14, col, list); wires.push(pk); }
	return { geo: mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), wires };
}

// ---------- the bridge ----------
export function createSanMateoBridge(scene, bay, { isPhone = false } = {}) {
	const Lay = sanMateoLayout((x, z) => bay.heightAt(x, z));
	const { O, L, frame, roadY, deckT, high } = Lay;
	const group = new THREE.Group();
	group.name = 'san-mateo-bridge';
	group.position.set(O.x, 0, O.z);
	const seabed = (x, z) => Math.min(-1.5, bay.heightAt(x + O.x, z + O.z));
	const F = {}, P = (s, t, y) => { frame(s, F); return new THREE.Vector3(F.x + F.nx * t, y, F.z + F.nz * t); };

	// the stations along the bridge: fine on the curves and the climb, longer on the straight
	const stations = [];
	for (let s = 0; s < L; ) { stations.push(s); const curvy = s < Lay.HIGH + 200 || s > L - RAMP - 30; s = Math.min(L, s + (curvy ? 7.315 : 29.26)); if (s >= L) { stations.push(L); break; } }

	const concrete = [], deck = [];
	const C_BARRIER = lin(0xc9c4b8), C_SLAB = lin(0xb1ada3), C_BENT = lin(0x9d9a92), C_PIER = lin(0x7d858a), C_GIRDER = lin(0xd6bca6), C_WEB = lin(0xb8b4ab);
	// tide stain on what stands in the water: darker and greener up to a metre and a half
	const tide = (x, y) => (y < 1.6 ? 0.62 + 0.38 * smooth(-1, 1.6, y) : 1);

	// sweep a cross-section along the stations s0..s1: prof(s) gives [t, y] points (y above
	// the road), each edge drawn flat across; col per station
	function sweep(s0, s1, prof, col, list, shade = null) {
		const ring = stations.filter((s) => s >= s0 - 1e-6 && s <= s1 + 1e-6);
		if (ring[0] > s0 + 1e-3) ring.unshift(s0);
		if (ring[ring.length - 1] < s1 - 1e-3) ring.push(s1);
		if (ring.length < 2) return;
		const pos = [], cols = [], idx = [];
		const m = prof(ring[0]).length;
		let v = 0;
		for (const s of ring) {
			const pr = prof(s), y0 = roadY(s);
			frame(s, F);
			for (let e = 0; e + 1 < m; e++) for (const q of [pr[e], pr[e + 1]]) {
				const y = y0 + q[1];
				pos.push(F.x + F.nx * q[0], y, F.z + F.nz * q[0]);
				const k = (shade ? shade(s, y) : 1) * (0.96 + 0.08 * Math.abs(Math.sin(Math.floor(s / 58.5) * 12.9898) * 43758.5453 % 1));
				cols.push(col[0] * k, col[1] * k, col[2] * k);
			}
			v++;
		}
		const per = (m - 1) * 2;
		for (let r = 0; r + 1 < v; r++) for (let e = 0; e + 1 < m; e++) {
			const a = r * per + e * 2, b = a + 1, c = a + per, d = b + per;
			idx.push(a, b, c, b, d, c);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
		g.setIndex(idx); g.computeVertexNormals();
		list.push(g);
	}
	// the barrier (New Jersey shape): its traffic face at t = e, facing toward side -o (o = +1:
	// the barrier lies to +t of the road), its back dropping to yb
	const jersey = (e, o, yb) => [[e, 0], [e + o * 0.07, 0.075], [e + o * 0.23, 0.33], [e + o * 0.33, BARRIER_H], [e + o * BARRIER_W, BARRIER_H], [e + o * BARRIER_W, yb]];
	// the four barriers: outer and inner of each deck
	for (const dir of [1, -1]) {
		const faceO = (s) => deckT(s, dir) + dir * ROAD_W / 2, faceI = (s) => deckT(s, dir) - dir * ROAD_W / 2;
		// outer: on the high-rise it caps the girder's fascia, on the trestle it hides the slab's edge
		sweep(0, L, (s) => jersey(faceO(s), dir, high(s) ? -0.55 : -1.45), C_BARRIER, concrete);
		sweep(0, L, (s) => jersey(faceI(s), -dir, high(s) ? 0 : -1.45), C_BARRIER, concrete);
	}
	// the road on each deck, in pieces of a dozen lamps' length (so its paint never runs far from 0)
	for (const dir of [1, -1]) {
		for (let p0 = 0; p0 < L; p0 += LAMP_D * 12) {
			const p1 = Math.min(L, p0 + LAMP_D * 12);
			const ring = stations.filter((s) => s > p0 && s < p1); ring.unshift(p0); ring.push(p1);
			const pos = [], uv = [], idx = [];
			for (const s of ring) {
				const y = roadY(s) + 0.01, c = deckT(s, dir);
				frame(s, F);
				// u from the outer (driver's right-hand) edge
				for (const u of [0, ROAD_W]) { const t = c + dir * (ROAD_W / 2 - u); pos.push(F.x + F.nx * t, y, F.z + F.nz * t); uv.push(u, s - p0); }
			}
			for (let r = 0; r + 1 < ring.length; r++) { const a = r * 2; if (dir > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
			g.setIndex(idx); g.computeVertexNormals();
			deck.push(g);
		}
	}
	// ---- the trestles: a slab on precast girders, on bents of four piles every 29 m
	const sT = Lay.HIGH;
	for (const dir of [1, -1]) sweep(sT, L, (s) => { const c = deckT(s, dir), h = DECK_W / 2; return [[c + h, -1.45], [c + h * 0.92, -1.6], [c - h * 0.92, -1.6], [c - h, -1.45]]; }, C_SLAB, concrete);
	// (the bents: their caps square to the deck, the piles down into the mud)
	const bent = (s, dir, list) => {
		const y = roadY(s) - 1.6, c = deckT(s, dir);
		frame(s, F);
		const yaw = Math.atan2(-F.nz, F.nx);
		const cap = new THREE.BoxGeometry(DECK_W - 0.4, 1.1, 1.3).translate(0, y - 0.55, 0).rotateY(yaw).translate(F.x + F.nx * c, 0, F.z + F.nz * c);
		list.push(paintGeo(cap, C_BENT, (x, yy) => tide(0, yy)));
		for (const o of [-6.4, -2.15, 2.15, 6.4]) {
			const px = F.x + F.nx * (c + o), pz = F.z + F.nz * (c + o), bot = seabed(px, pz) - 1, h = y - 1.1 - bot;
			if (h < 0.5) continue;
			list.push(paintGeo(new THREE.CylinderGeometry(0.36, 0.4, h, 8, 1, true).rotateY(Math.PI / 8).translate(px, bot + h / 2, pz), C_BENT, (x, yy) => tide(0, yy)));
		}
	};
	const subs = [];
	for (let s = sT + 14.63; s < L - 10; s += 29.26) for (const dir of [1, -1]) if (roadY(s) - 1.6 > 2) bent(s, dir, subs);
	// the west approach, low over the shallows before the climb: the same bents under the girder
	for (let s = 29.26; s < RAMP + 40; s += 29.26) for (const dir of [1, -1]) if (roadY(s) - 1.6 > 2) bent(s, dir, subs);

	// ---- the high-rise: a steel box girder, haunched over its piers
	const piers = [];
	{
		const main = 230, sP = Lay.peakS;
		piers.push(sP - main / 2, sP + main / 2);
		for (let s = sP - main / 2 - 150; s > RAMP + 40; s -= 92) piers.push(s);
		for (let s = sP + main / 2 + 150; s < Lay.HIGH - 30; s += 92) piers.push(s);
		piers.sort((a, b) => a - b);
	}
	const knots = [RAMP + 40 - 92, ...piers, Lay.HIGH + 40];
	const depth = (s) => {
		let i = 0; while (i + 1 < knots.length - 1 && knots[i + 1] < s) i++;
		const a = knots[i], b = knots[i + 1], Ls = b - a, u = Math.max(0, Math.min(1, (s - a) / Ls));
		const dp = Math.max(3.4, Ls / 26), dm = Math.max(2.4, Ls / 46);
		return dm + (dp - dm) * Math.pow(Math.abs(2 * u - 1), 2.4);
	};
	const HW = DECK_W;    // the girder's half-width at the deck (the outer barriers' backs)
	sweep(0, Lay.HIGH + 40, (s) => [[HW, -0.55], [HW - 0.3, -0.85], [11.4, -1.05], [10.2, -depth(s)], [-10.2, -depth(s)], [-11.4, -1.05], [-HW + 0.3, -0.85], [-HW, -0.55]], C_WEB, concrete);
	// (the painted fascia: a warm band along the girder's edge)
	for (const sx of [1, -1]) sweep(0, Lay.HIGH + 40, (s) => (sx > 0 ? [[HW + 0.01, -0.5], [HW + 0.01, -0.86]] : [[-HW - 0.01, -0.86], [-HW - 0.01, -0.5]]), C_GIRDER, concrete);
	// the piers: two legs under the webs, a cap beam across their tops
	for (const s of piers) {
		const top = roadY(s) - depth(s);
		frame(s, F);
		const yaw = Math.atan2(-F.nz, F.nx);
		const capH = 2.2;
		subs.push(paintGeo(new THREE.BoxGeometry(24, capH, 4.6).translate(0, top - capH / 2, 0).rotateY(yaw).translate(F.x, 0, F.z), C_PIER));
		for (const o of [-8.2, 8.2]) {
			const px = F.x + F.nx * o, pz = F.z + F.nz * o, bot = seabed(px, pz) - 1, h = top - capH - bot;
			if (h < 1) continue;
			subs.push(paintGeo(new THREE.BoxGeometry(3.6, h, 4.2).translate(0, bot + h / 2, 0).rotateY(yaw).translate(px, 0, pz), C_PIER, (x, yy) => tide(0, yy)));
			// the footing ring at the waterline
			subs.push(paintGeo(new THREE.BoxGeometry(5.6, 2.4, 6.2).translate(0, -0.6, 0).rotateY(yaw).translate(px, 0, pz), C_BENT, (x, yy) => tide(0, yy)));
		}
	}
	// under the low ends of the girder (the west approach) the bents carry it; past the bend it
	// is the trestles'

	// ---- the power line: lattice towers along the south side, on concrete pads in the water
	const T = towerGeometry(), towers = [];
	{
		const sP = Lay.peakS, cross = [sP - 160, sP + 160];
		for (let s = 120; s < L - 80; s += TOWER_D) {
			if (Math.abs(s - sP) < 330) continue;
			towers.push({ s, h: Math.max(TOWER_H, roadY(s) + 32) });
		}
		for (const s of cross) towers.push({ s, h: 98 });
		towers.sort((a, b) => a.s - b.s);
	}
	for (const tw of towers) {
		frame(tw.s, F);
		tw.x = F.x + F.nx * LINE_T; tw.z = F.z + F.nz * LINE_T; tw.yaw = Math.atan2(F.dx, F.dz); tw.k = tw.h / TOWER_H;
		const base = 2.2;
		tw.y = base;
		const b = seabed(tw.x, tw.z) - 1;
		subs.push(paintGeo(new THREE.BoxGeometry(11 * tw.k, base - b, 11 * tw.k).translate(0, (base + b) / 2, 0).rotateY(tw.yaw).translate(tw.x, 0, tw.z), C_BENT, (x, yy) => tide(0, yy)));
	}

	// ---- materials and meshes
	// (both faces: the swept sections are drawn without minding which way round they wind)
	const concreteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide });
	const deckTex = typeof document !== 'undefined' ? deckTexture() : null;
	const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.88, side: THREE.DoubleSide });
	// by night, each lamp's pool on the road: strength over the slant distance cubed (as the
	// street lamps', streetlamps.js), thrown a little further along the road than across
	const uNight = { value: 0 };
	deckMat.onBeforeCompile = (sh) => {
		sh.uniforms.uSMNight = uNight;
		sh.vertexShader = 'varying vec2 vSMRaw;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvSMRaw = uv;');
		sh.fragmentShader = 'uniform float uSMNight;\nvarying vec2 vSMRaw;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		float dv = mod(vSMRaw.y - ${LAMP_0.toFixed(3)}, ${LAMP_D.toFixed(3)});
		dv = min(dv, ${LAMP_D.toFixed(3)} - dv);
		float du = vSMRaw.x - ${LAMP_IN.toFixed(2)}, h2 = ${(LAMP_H * LAMP_H).toFixed(2)};
		float d2 = du * du + dv * dv * 0.6;
		float pool = h2 * ${LAMP_H.toFixed(2)} / pow(h2 + d2, 1.5);
		totalEmissiveRadiance += vec3(0.78, 0.84, 1.0) * diffuseColor.rgb * uSMNight * 0.55 * pool;
	}`);
	};
	deckMat.customProgramCacheKey = () => 'sanmateo-deck';
	// (galvanized: a dull, pale metal; with no sky reflection to catch, a high metalness reads black)
	const steelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
	const mk = (list, mat, shadow = true) => {
		const m = new THREE.Mesh(mergeGeometries(list), mat);
		m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false;
		group.add(m); m.updateMatrix();
		for (const g of list) g.dispose();
		return m;
	};
	const concreteMesh = mk(concrete.concat(subs), concreteMat);
	const deckMesh = mk(deck, deckMat, false);

	// the lamps: along both outer edges, a lamp every 44 m, the arm over its deck
	const lamp = lampGeometry(), lampSpots = [];
	for (let s = LAMP_0; s < L - 30; s += LAMP_D) for (const dir of [1, -1]) {
		const t = deckT(s, dir) + dir * (ROAD_W / 2 + BARRIER_W * 0.6);
		frame(s, F);
		lampSpots.push({ x: F.x + F.nx * t, y: roadY(s) + BARRIER_H, z: F.z + F.nz * t, ax: -dir * F.nx, az: -dir * F.nz });
	}
	const lamps = new THREE.InstancedMesh(lamp.geo, steelMat, lampSpots.length);
	const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
	const glowPos = [], glowCol = [];
	lampSpots.forEach((p, i) => {
		// (local +x, the arm, turned to point across the deck)
		Q.setFromAxisAngle(Y, Math.atan2(-p.az, p.ax));
		M4.compose(new THREE.Vector3(p.x, p.y, p.z), Q, S1);
		lamps.setMatrixAt(i, M4);
		const hd = lamp.head.clone().applyMatrix4(M4);
		glowPos.push(hd.x, hd.y, hd.z); glowCol.push(0.78, 0.86, 1);
	});
	lamps.castShadow = true; lamps.receiveShadow = true;
	lamps.computeBoundingSphere();
	group.add(lamps);
	// the towers, scaled to their heights, turned square to the line
	const towerMesh = new THREE.InstancedMesh(T.geo, steelMat, towers.length);
	towers.forEach((tw, i) => {
		Q.setFromAxisAngle(Y, tw.yaw);
		M4.compose(new THREE.Vector3(tw.x, tw.y, tw.z), Q, new THREE.Vector3(tw.k, tw.k, tw.k));
		towerMesh.setMatrixAt(i, M4); tw.m = M4.clone();
		// the tall ones over the channel carry red lights on their peaks
		if (tw.h > 80) for (const w of T.wires.slice(-2)) { const p = w.clone().applyMatrix4(M4); glowPos.push(p.x, p.y + 0.4, p.z); glowCol.push(1, 0.08, 0.03); }
	});
	towerMesh.castShadow = true; towerMesh.receiveShadow = true;
	towerMesh.computeBoundingSphere();
	group.add(towerMesh);
	// the wires: from each tower's insulators and peaks to the next's, sagging between
	const wp = [];
	for (let i = 0; i + 1 < towers.length; i++) {
		const a = towers[i], b = towers[i + 1], span = Math.hypot(b.x - a.x, b.z - a.z), sag = span * 0.024, N = 14;
		T.wires.forEach((w) => {
			const p0 = w.clone().applyMatrix4(a.m), p1 = w.clone().applyMatrix4(b.m);
			let prev = p0;
			for (let k = 1; k <= N; k++) {
				const u = k / N, q = p0.clone().lerp(p1, u);
				q.y -= sag * 4 * u * (1 - u);
				wp.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
				prev = q;
			}
		});
	}
	const wireGeo = new THREE.BufferGeometry();
	wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
	// (by night they go: a wire in the haze is a pale thread across the dark)
	const wireMat = new THREE.LineBasicMaterial({ color: 0x34383b, transparent: true });
	const wires = new THREE.LineSegments(wireGeo, wireMat);
	wires.matrixAutoUpdate = false; wires.updateMatrix();
	group.add(wires);
	// the glow of the lamp heads (and the channel towers' red lights) by night
	const glowGeo = new THREE.BufferGeometry();
	glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
	glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(glowCol, 3));
	const glowMat = new THREE.PointsMaterial({ size: isPhone ? 2.6 : 2.2, sizeAttenuation: true, map: typeof document !== 'undefined' ? glowTexture() : null, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
	const glow = new THREE.Points(glowGeo, glowMat);
	glow.matrixAutoUpdate = false; glow.updateMatrix(); glow.visible = false;
	group.add(glow);
	scene.add(group);

	// walking and driving on the decks: the floor under (x, z) at height y, or -Infinity
	function floor(x, z, y) {
		const lx = x - O.x, lz = z - O.z;
		// (well clear of the bridge: nothing to look up)
		if (Math.hypot(lx, lz) > L / 2 + 60) return -Infinity;
		const { s, t } = Lay.locate(lx, lz);
		if (Math.abs(t) > DECK_W + GAP) return -Infinity;
		const d = Lay.deckAt(s, t);
		return d === d && y > d - 3 ? d : -Infinity;
	}
	function update(cam, night) {
		const far = Math.hypot(cam.position.x - O.x, cam.position.z - O.z) > 26000 || cam.position.y > 30000;
		group.visible = !far;
		if (far) return;
		uNight.value = night;
		glow.visible = night > 0.02;
		glowMat.opacity = Math.min(1, night * 1.2);
		wireMat.opacity = 1 - 0.9 * night;
		concreteMat.emissive.setRGB(0.16, 0.15, 0.13).multiplyScalar(0.22 * night);
	}
	return { group, floor, update, layout: Lay, substructure: concreteMesh, deck: deckMesh, stats: () => ({ lamps: lampSpots.length, towers: towers.length, piers: piers.length, tris: [concreteMesh, deckMesh].reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0) + lampSpots.length * (lamp.geo.attributes.position.count / 3) + towers.length * (T.geo.attributes.position.count / 3) }) };
}
