// A cliff settlement, built from its plan (plan.js): houses hung off the escarpments on
// struts sunk in the face (or stepping down it in terraces), towers rising from the valley
// floor through the mist band (clouds.js), bridges across the gaps. Each house is merged into
// a mesh or two of the one shared material (mats.js) and dropped by distance; where the works
// meet the land, stone collars and a soft contact shade blend them in. Lifts run up the
// towers, craft fly between them, and by night the glazing, the soffits and the mist glow.
// Decks, terraces, bridges and roofs are floors; walls and balustrades are walked into.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, skyEnvironment, frame, box, cbox, strut, sweep, lathe, ring, prism, blob } from '../alienkit.js';
import { colliders } from '../alien.js';
import { mulberry32 } from '../../noise.js';
import { archMaterial, railGlass, contactMaterial, archUniforms } from './mats.js';
import { createMist } from './clouds.js';
import { createGlow } from './glow.js';
import { towerPlan, housePlan, frame as roomFrame } from './rooms.js';
import { createInteriors } from './interiors.js';

const TAU = Math.PI * 2;
// the material's looks (mats.js)
const G = { concrete: 0, glazing: 1, rock: 2, timber: 3, planted: 4, lamp: 5, beacon: 6, water: 7, metal: 8 };
const m4 = new THREE.Matrix4(), eu = new THREE.Euler();

// ---------- shapes ----------
// a plate's outline in plan: a rounded rectangle, or an oval
function outline(w, d, round, cr) {
	const s = new THREE.Shape();
	if (round) s.absellipse(0, 0, w / 2, d / 2, 0, TAU, false, 0);
	else {
		const r = Math.min(cr ?? Math.min(w, d) * 0.22, w / 2 - 0.01, d / 2 - 0.01), x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
		s.moveTo(x0 + r, z0); s.lineTo(x1 - r, z0); s.absarc(x1 - r, z0 + r, r, -Math.PI / 2, 0);
		s.lineTo(x1, z1 - r); s.absarc(x1 - r, z1 - r, r, 0, Math.PI / 2);
		s.lineTo(x0 + r, z1); s.absarc(x0 + r, z1 - r, r, Math.PI / 2, Math.PI);
		s.lineTo(x0, z0 + r); s.absarc(x0 + r, z0 + r, r, Math.PI, Math.PI * 1.5);
	}
	return s;
}
// a plate t thick, its top at y = 0
function plate(w, d, t, round, cr) {
	const g = new THREE.ExtrudeGeometry(outline(w, d, round, cr), { depth: t, bevelEnabled: false, curveSegments: round ? 28 : 4 });
	return g.rotateX(Math.PI / 2);
}
// a beam from a to b, w across and t deep, kept level across
function plank(a, b, w, t) {
	const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz);
	const g = box(w, t, len);
	g.applyMatrix4(m4.makeRotationFromEuler(eu.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ')));
	return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
// a broken stone: an icosahedron pushed about, the same way at shared corners
function stone(rx, ry, rz, seed) {
	const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		const h = Math.sin(Math.round(x * 50) * 12.99 + Math.round(y * 50) * 78.23 + Math.round(z * 50) * 37.72 + seed) * 43758.55;
		const k = 0.78 + (h - Math.floor(h)) * 0.42;
		p.setXYZ(i, x * k * rx, y * k * ry, z * k * rz);
	}
	g.computeVertexNormals();
	return g;
}
// geometry tagged for the shared material outside a kit (the instanced lifts and craft)
function paint(g, tint, glow) {
	if (g.index) g = g.toNonIndexed();
	for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
	const n = g.attributes.position.count, c = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) c.set(tint, i * 3);
	g.setAttribute('color', new THREE.BufferAttribute(c, 3));
	g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
	return g;
}
// the outline's points on the open side (z over `from`), inset, in the frame's plan
function edge(w, d, round, inset, zc, from) {
	const pts = outline(w - inset * 2, d - inset * 2, round).getPoints(round ? 40 : 4);
	const out = [];
	let started = false;
	for (let i = 0; i < pts.length * 2 && out.length < pts.length; i++) {
		const p = pts[i % pts.length], z = p.y + zc, inside = z > from;
		if (inside) { started = true; out.push({ x: p.x, z }); } else if (started) break;
	}
	return out;
}

// ---------- the pieces ----------
// a glass balustrade along a run of plan points in frame F at height y (with its light strip under)
function rail(X, F, pts, y, o = {}) {
	for (let i = 0; i < pts.length - 1; i++) {
		// (y is the height in the world: the frame's own taken off)
		const a = F.p(pts[i].x, y - F.y, pts[i].z), b = F.p(pts[i + 1].x, y - F.y, pts[i + 1].z);
		if (a.distanceTo(b) < 0.05) continue;
		const lift = (v, dy) => v.clone().setY(v.y + dy);
		X.K.add('glass', plank(lift(a, 0.55), lift(b, 0.55), 0.04, 1.05), { near: true });
		X.K.add('shell', plank(lift(a, 1.1), lift(b, 1.1), 0.07, 0.06), { tint: X.S.trim, glow: G.metal, near: true });
		if (o.strip !== false) X.K.add('shell', plank(lift(a, -(o.under || 0.8)), lift(b, -(o.under || 0.8)), 0.14, 0.3), { tint: X.S.band, glow: G.lamp });
		X.col.seg({ x: a.x, z: a.z }, { x: b.x, z: b.z }, 0.12, y + 1.1, X.site, y - 0.6);
	}
}
// stones round a foot where a member meets the rock
function collar(X, p, s) {
	for (let k = 0; k < 3; k++) {
		const a = X.r() * TAU, d = s * (0.3 + X.r() * 0.5);
		X.K.add('shell', stone(s * (0.8 + X.r() * 0.5), s * (0.6 + X.r() * 0.4), s * (0.8 + X.r() * 0.5), X.r() * 100).translate(p.x + Math.cos(a) * d, p.y - s * 0.2 + X.r() * s * 0.3, p.z + Math.sin(a) * d), { tint: X.rockT(), glow: G.rock });
	}
}
// a long stone from a foot back into the face: the member is seen to bear on rock, however
// the face is drawn far off
function buttress(X, F, p) {
	const g = stone(1.9 + X.r() * 0.6, 2.6 + X.r(), 5 + X.r() * 1.5, X.r() * 100);
	g.applyMatrix4(m4.makeRotationFromEuler(eu.set(-0.5, F.yaw, 0, 'YXZ')));
	X.K.add('shell', g.translate(p.x - Math.sin(F.yaw) * 3, p.y - 1.2, p.z - Math.cos(F.yaw) * 3), { tint: X.rockT(), glow: G.rock });
}
// the ground under the edge of the lip, stone filled up to the floor's underside
function lipStones(X, F, v, xs, z) {
	for (const lx of xs) {
		const p = F.p(lx, 0, z), g = X.H(p.x, p.z), gap = v.y - 0.75 - g;
		if (gap < 0.3) continue;
		const s = Math.min(6, gap + 1.2);
		X.K.add('shell', stone(2.4 + X.r(), s * 0.6, 2.0 + X.r() * 0.8, X.r() * 100).translate(p.x, g + s * 0.35 - 0.6, p.z), { tint: X.rockT(), glow: G.rock });
	}
}
// the house's back: a low mass set into the top, its plinth in stone and its roof grown over
function backMass(X, F, v, bw, z0, z1, H1, hole = null) {
	const { K, S } = X, C = { tint: S.concrete }, zc = (z0 + z1) / 2, d = z1 - z0;
	K.add('shell', F.put(cbox(bw, H1 + 2, d, 0.25), 0, (H1 + 2) / 2 - 2, zc), C);
	K.add('shell', F.put(box(bw + 0.08, 1.7, d * 0.72), 0, 1.5, zc), { tint: S.glazing, glow: G.glazing });
	K.add('shell', F.put(box(bw + 0.7, 1.3, d + 0.7), 0, -1.05, zc), { tint: X.rockT(), glow: G.rock });
	K.add('shell', F.put(box(bw - 0.7, 0.4, d - 0.7), 0, H1 + 0.2, zc), { tint: S.planted, glow: G.planted });
	// the retro-futurist complex: a dome and a drum on the roof, red lights on their tops
	if (v.domes) {
		const r = Math.min(bw, d) * 0.3, dx = bw * 0.22, rd = 1.4 + X.r() * 0.8, hd = 7 + X.r() * 6, cx = -dx - r * 0.2, cz = z0 + rd + 0.6;
		K.add('shell', F.put(blob(r, r * 0.85, r, 12, 0), dx, H1 + 0.4, zc), C);
		K.add('shell', F.put(box(0.35, 0.35, 0.35), dx, H1 + 0.4 + r * 0.85, zc), { tint: S.beacon, glow: G.beacon });
		K.add('shell', F.put(lathe([[0.01, 0], [rd, 0], [rd, hd], [rd * 0.96, hd + 0.2], [0.01, hd + 0.25]], 18, false), cx, H1 + 0.4, cz), C);
		K.add('shell', F.put(ring(rd + 0.02, 0.1, 0.9, 18), cx, H1 + 0.4 + hd - 2.2, cz), { tint: S.glazing, glow: G.glazing });
		K.add('shell', F.put(blob(rd, rd * 0.7, rd, 10, 0), cx, H1 + 0.65 + hd, cz), C);
		K.add('shell', F.put(box(0.3, 0.3, 0.3), cx, H1 + 0.7 + hd + rd * 0.7, cz), { tint: S.beacon, glow: G.beacon });
	}
	const c = F.p(0, 0, zc);
	if (!hole) X.col.box(c.x, c.z, F.yaw, bw / 2, d / 2, v.y + H1 + 0.4, { site: X.site });
	else {
		// (rooms inside: its roof still walked, its walls theirs; solid either side and behind them)
		X.col.box(c.x, c.z, F.yaw, bw / 2, d / 2, v.y + H1 + 0.4, { site: X.site, solid: false });
		const x0 = Math.max(-bw / 2, hole.x0), x1 = Math.min(bw / 2, hole.x1), zb = Math.max(z0, hole.z0);
		for (const [a, b] of [[-bw / 2, x0], [x1, bw / 2]]) if (b - a > 0.2) { const q = F.p((a + b) / 2, 0, zc); X.col.box(q.x, q.z, F.yaw, (b - a) / 2, d / 2, v.y + H1 + 0.4, { site: X.site }); }
		if (zb - z0 > 0.2) { const q = F.p((x0 + x1) / 2, 0, (z0 + zb) / 2); X.col.box(q.x, q.z, F.yaw, (x1 - x0) / 2, (zb - z0) / 2, v.y + H1 + 0.4, { site: X.site }); }
	}
	X.contacts.push({ F, x0: -bw / 2 - 0.4, x1: bw / 2 + 0.4, z0: z0 - 0.4, z1: Math.min(0, z1), m: 4.5, k: 0.42 });
}
// a glazed room with its overhanging roof plate and timber soffit, downlights under the eave
function room(X, F, w, d, h, x, zc, round, roofOver = 1.2, hollow = false) {
	const { K, S } = X, C = { tint: S.concrete };
	K.add('shell', F.put(plate(w, d, h, round), x, h, zc), { tint: S.glazing, glow: G.glazing });
	K.add('shell', F.put(plate(w + roofOver * 2, d + roofOver * 2, 0.5, round), x, h + 0.5, zc + roofOver * 0.3), C);
	K.add('shell', F.put(plate(w + roofOver * 2 - 0.1, d + roofOver * 2 - 0.1, 0.04, round), x, h, zc + roofOver * 0.3), { tint: S.timber, glow: G.timber });
	for (const p of edge(w + roofOver, d + roofOver, round, 0, zc + roofOver * 0.3, -1e9).filter((q, i) => i % (round ? 4 : 1) === 0)) {
		K.add('shell', F.put(box(0.3, 0.05, 0.3), x + p.x, h - 0.06, p.z), { tint: S.lamp, glow: G.lamp, near: true });
	}
	const c = F.p(x, 0, zc);
	X.col.box(c.x, c.z, F.yaw, w / 2, d / 2, F.y + h + 0.5, { site: X.site, y0: F.y, solid: !hollow });
}

// a house cantilevered out over the drop: a glass room on a floor plate held by struts and a
// swept root grown from the face below, a deck and a pool at its tip
function cantilever(X, v) {
	const { K, S, H } = X, F = frame(v.x, v.y, v.z, v.yaw), sd = v.side, W = v.W, B = v.B, O = v.O, H1 = 6.4, round = S.round;
	const C = { tint: S.concrete };
	// the hall's width and its line (set back from the walkway), and the vestibule behind it
	const gw = W - 2.8, gx = -sd * 1.4, bw = W * 0.82, vx0 = Math.max(-bw / 2, gx - gw / 2) + 0.2, vx1 = Math.min(bw / 2, gx + gw / 2) - 0.2;
	backMass(X, F, v, bw, -B, -B * 0.25, 3.6, { x0: vx0, x1: vx1, z0: -B });
	// the floor plate, out over the edge
	const zs0 = -B * 0.3, dd = O - zs0, zc = (zs0 + O) / 2;
	K.add('shell', F.put(plate(W, dd, 0.75, round), 0, 0, zc), C);
	const fc = F.p(0, 0, zc);
	// (an oval floor walked as boxes whose corners lie on it)
	const cuts = round ? Array.from({ length: 10 }, (_, i) => (i + 0.5) / 10 * Math.PI / 2).map((t) => [Math.cos(t) * 1.03, Math.sin(t) * 1.03]) : [[1, 1]];
	for (const [kx, kz] of cuts) X.col.box(fc.x, fc.z, v.yaw, W / 2 * kx, dd / 2 * kz, v.y, { site: X.site, solid: false });
	// the room, set back from the tip (the deck) and from the walkway along one side
	const gz0 = -B * 0.25, gz1 = O - 4.8;
	room(X, F, gw, gz1 - gz0, H1, gx, (gz0 + gz1) / 2, round, 1.2, true);
	{
		// its rooms: the vestibule from the cliff top, opening into the hall over the drop
		portal(X, F.sub((vx0 + vx1) / 2, 0, -B, Math.PI), 2.4, 2.8);
		portal(X, F.sub(gx + sd * gw * 0.25, 0, gz1, 0), 2.2, 3.0);
		const vc = F.p((vx0 + vx1) / 2, 0, -B * 0.625), hc = F.p(gx, 0, (gz0 + gz1) / 2), wall = (gaps = []) => ({ mode: 'wall', gaps }), glassS = (gaps = []) => ({ mode: 'glass', gaps });
		X.shells.push({ house: true, name: v.name, kind: 'villa', x: v.x, z: v.z, reach: W + O, seed: (X.seed + X.site * 131) >>> 0, vols: [
			{ F: roomFrame(vc.x, v.y, vc.z, v.yaw), w: vx1 - vx0, d: B * 0.75, h: 3.45, kind: 'vestibule', sides: { nz: wall([{ at: 0, w: 2.4, h: 2.8 }]), pz: { mode: 'open', gaps: [] }, px: wall(), nx: wall() } },
			{ F: roomFrame(hc.x, v.y, hc.z, v.yaw), w: gw, d: gz1 - gz0, h: H1 - 0.06, kind: 'living', theme: 1, sides: { nz: wall([{ at: (vx0 + vx1) / 2 - gx, w: vx1 - vx0 - 0.1, h: 3.3 }]), pz: glassS([{ at: sd * gw * 0.25, w: 2.2, h: 3.0 }]), px: glassS(), nx: glassS() } },
		] });
	}
	// a second room on its roof, turned off the first's line
	if (v.two) {
		const F2 = F.sub(gx, H1 + 0.5, (gz0 + gz1) / 2 - (gz1 - gz0) * 0.12, v.turn);
		room(X, F2, gw * 0.78, (gz1 - gz0) * 0.62, 3.2, 0, 0, round, 1.6);
	}
	// the pool across the tip, its far edge the plate's
	if (v.pool) K.add('shell', F.put(box(W * 0.62, 0.12, 2.8), -sd * W * 0.12, 0.04, O - 2.1), { tint: [0.10, 0.36, 0.42], glow: G.water });
	// the balustrade round the open side, the light strip under the plate's edge
	rail(X, F, edge(W, dd, round, 0.14, zc, 0.4), v.y);
	// the struts: a V each side down to the face, and the swept root from deep in it
	const foot = (lx, need, from) => {
		for (let lz = from; lz <= O + 8; lz += 0.75) { const p = F.p(lx, 0, lz), g = H(p.x, p.z); if (v.y - g >= need) return { lz, y: g - v.y - 0.9 }; }
		return null;
	};
	const feet = [];
	for (const lx of [-W / 2 + 1.3, W / 2 - 1.3]) {
		const f = foot(lx * 1.12, 7, 1);
		if (!f) continue;
		const ft = F.p(lx * 1.12, f.y, f.lz);
		K.add('shell', strut(F.p(lx, -0.75, O * 0.8), ft, 0.6, 0.85, true), C);
		K.add('shell', strut(F.p(lx, -0.75, O * 0.32), ft, 0.45, 0.65, true), C);
		feet.push(ft);
	}
	const f = foot(0, Math.min(18, v.under * 0.8), 2);
	if (f) {
		const a = F.p(0, -0.6, O * 0.55), c = F.p(0, f.y, f.lz), m = F.p(0, f.y * 0.55, (O * 0.55 + f.lz) / 2 + 2.5);
		K.add('shell', sweep([a, m, c], (t) => 1.05 - 0.3 * Math.sin(t * Math.PI) + Math.pow(t, 5) * 1.3, 10), C);
		feet.push(c);
	}
	// and the complex's slim column straight down the face from the tip
	if (v.domes) {
		const lx = -sd * W * 0.22, p = F.p(lx, 0, O * 0.7), g = H(p.x, p.z);
		if (v.y - g > 6 && v.y - g < 90) {
			K.add('shell', F.put(lathe([[0.8, g - v.y - 1], [0.75, -0.7]], 12, false), lx, 0, O * 0.7), C);
			feet.push(F.p(lx, g - v.y - 0.5, O * 0.7));
		}
	}
	for (const p of feet) { collar(X, p, 1.8); buttress(X, F, p); }
	lipStones(X, F, v, [-W / 2 + 1.5, 0, W / 2 - 1.5], 0.9);
	const st = F.p(sd * W * 0.2, 0, zc + dd * 0.3);
	v.stand = { x: st.x, y: v.y, z: st.z, yaw: v.yaw + Math.PI };
	return { x: fc.x, z: fc.z, r: W * 0.42, foot: feet.length ? Math.min(...feet.map((p) => p.y)) : v.y - 10 };
}

// a house stepping down the face: floors set into the rock one under another, each a
// planted terrace out over the next, stairs down the side
function terraces(X, v) {
	const { K, S, H } = X, F = frame(v.x, v.y, v.z, v.yaw), sd = v.side, W = v.W, B = v.B * 0.8, D = 6.5, H1 = 3.8, LS = 4.6, C = { tint: S.concrete };
	backMass(X, F, v, W * 0.7, -B, -1.5, 3.4, { x0: -(W - 1.2) / 2, x1: (W - 1.2) / 2, z0: -B * 0.5 });
	const vols = [], kinds = ['suite', 'library', 'listening', 'lounge', 'baths'], k0 = Math.floor(X.r() * kinds.length);
	const levels = [];
	for (let k = 0; k < 4; k++) {
		const y = -k * LS;
		if (k > 0 && v.under < k * LS + 4) break;
		let lz = null;
		for (let z = -1; z <= 22; z += 0.5) {
			let hi = -1e9;
			for (const lx of [-W / 2, 0, W / 2]) { const p = F.p(lx, 0, z); hi = Math.max(hi, H(p.x, p.z)); }
			if (hi <= v.y + y - 0.4) { lz = z; break; }
		}
		if (lz == null || k > 0 && lz - levels[k - 1].lz > D) break;
		levels.push({ y, lz: k ? Math.max(lz, levels[k - 1].lz) : lz });
	}
	for (let k = 0; k < levels.length; k++) {
		const L = levels[k], ext = k > 0 ? 5.6 : 0, w = W + ext, x = sd * ext / 2, z0 = L.lz - 3.5, z1 = L.lz + D, zc = (z0 + z1) / 2;
		const T = F.sub(0, L.y, 0);
		K.add('shell', T.put(plate(w, z1 - z0, 0.6, false, 0.6), x, 0, zc), C);
		const pc = T.p(x, 0, zc);
		X.col.box(pc.x, pc.z, v.yaw, w / 2, (z1 - z0) / 2, v.y + L.y, { site: X.site, solid: false });
		// its room, under the terrace above (the top one's under its own roof)
		const rz0 = k ? z0 + 0.2 : -B * 0.5, rz1 = z1 - 2.8;
		room(X, T, W - 1.2, rz1 - rz0, H1, 0, (rz0 + rz1) / 2, false, 0.6, true);
		const rc = T.p(0, 0, (rz0 + rz1) / 2);
		portal(X, T.sub(-sd * (W - 1.2) * 0.2, 0, rz1, 0), 2, 2.7);
		vols.push({ F: roomFrame(rc.x, v.y + L.y, rc.z, v.yaw), w: W - 1.2, d: rz1 - rz0, h: H1 - 0.06, kind: kinds[(k0 + k) % kinds.length], theme: k, sides: { pz: { mode: 'glass', gaps: [{ at: -sd * (W - 1.2) * 0.2, w: 2, h: 2.7 }] }, nz: { mode: 'wall', gaps: [] }, px: { mode: 'wall', gaps: [] }, nx: { mode: 'wall', gaps: [] } } });
		// the planter and the glass along its front; the open side has the stair
		K.add('shell', T.put(box(w - 1.2, 0.55, 0.7), x, 0.27, z1 - 0.5), { tint: S.planted, glow: G.planted });
		rail(X, T, [{ x: -sd * (W / 2 - 0.15), z: L.lz }, { x: -sd * (W / 2 - 0.15), z: z1 - 0.14 }, { x: x + sd * (w / 2 - 0.15), z: z1 - 0.14 }], v.y + L.y, { under: 0.7 });
		// stone where the plate's ends meet the face
		for (const sx of [-1, 1]) { const p = T.p(sx === sd ? x + sd * w / 2 : -sd * W / 2, -0.4, L.lz - 1); collar(X, p, 1.6); }
		if (k === 0 && v.pool) K.add('shell', T.put(box(W * 0.5, 0.12, 2.4), -sd * W * 0.2, 0.04, z1 - 2.3), { tint: [0.10, 0.36, 0.42], glow: G.water });
		// the stair down to the next: along the face, over the next terrace's wider end
		const N = levels[k + 1];
		if (N) {
			const zs = L.lz + D - 1.3, a = F.p(sd * (W / 2 - 0.6), L.y, zs), b = F.p(sd * (W / 2 + 4.6), N.y, zs), n = 7;
			for (let i = 0; i < n; i++) {
				const p = a.clone().lerp(b, (i + 0.5) / n);
				K.add('shell', plank(p.clone().addScaledVector(b.clone().sub(a).setY(0).normalize(), -0.4).setY(p.y - 0.12), p.clone().addScaledVector(b.clone().sub(a).setY(0).normalize(), 0.4).setY(p.y - 0.12), 1.4, 0.22), C);
			}
			const yawS = v.yaw + sd * Math.PI / 2, len = Math.hypot(b.x - a.x, b.z - a.z);
			X.col.ramp(a.x, a.z, yawS, 0.75, 0, len, a.y, b.y, X.site);
			const off = (p) => F.p(0, 0, 0) && p.clone().add(new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw)).multiplyScalar(0.75));
			X.K.add('glass', plank(off(a).setY(a.y + 0.55), off(b).setY(b.y + 0.55), 0.04, 1.05), { near: true });
		}
	}
	// a root swept from deep in the face up under the lowest terrace
	const low = levels[levels.length - 1];
	if (low) {
		for (let lz = low.lz + 1; lz <= low.lz + 16; lz += 0.75) {
			const p = F.p(0, 0, lz), g = H(p.x, p.z);
			if (v.y + low.y - g < 9) continue;
			const a = F.p(0, low.y - 0.5, low.lz + D * 0.6), c = F.p(0, g - v.y - 0.9, lz), m = F.p(0, (low.y + g - v.y) / 2, (low.lz + D * 0.6 + lz) / 2 + 2);
			K.add('shell', sweep([a, m, c], (t) => 0.9 - 0.25 * Math.sin(t * Math.PI) + Math.pow(t, 5) * 1.1, 10), C);
			collar(X, c, 1.7);
			buttress(X, F, c);
			break;
		}
	}
	lipStones(X, F, v, [-W / 2 + 1.5, W / 2 - 1.5], 0.6);
	if (vols.length) X.shells.push({ house: true, name: v.name, kind: 'terrace', x: v.x, z: v.z, reach: W + 20, seed: (X.seed + X.site * 131) >>> 0, vols });
	const L = low || { y: 0, lz: 0 }, st = F.p(-sd * W * 0.2, L.y, L.lz + D - 1.4);
	v.stand = { x: st.x, y: v.y + L.y, z: st.z, yaw: v.yaw + Math.PI };
	const fc = F.p(0, 0, (L.lz + D) / 2);
	return { x: fc.x, z: fc.z, r: W * 0.4, foot: v.y + L.y - 8 };
}

// a tower: a flared root grown from the ground, a glazed body, floor plates turning as they
// rise, a halo and mast at the crown, a lift up its side, lobbies where the bridges meet it
function tower(X, T) {
	const { K, S } = X, C = { tint: S.slab.map((c) => c * 3) }, F = frame(T.x, T.y, T.z, X.r() * TAU);
	const R = T.R, root = 14, h = T.top - T.y, n = Math.max(6, Math.floor((h - root - 6) / 4.2)), body = n * 4.2;
	const taper = (t) => 1 - 0.28 * t + 0.1 * Math.sin(t * Math.PI);
	const rootP = [[R * 2.1, -7], [R * 1.75, 0], [R * 1.32, 4], [R * 1.06, 9], [R * taper(0) * 0.98, root]];
	K.add('shell', F.put(lathe(rootP, 28, false)), C);
	if (!T.sea) {
		for (let k = 0; k < 10; k++) {
			const a = k / 10 * TAU + X.r() * 0.4, p = F.p(Math.cos(a) * R * 2.0, 0, Math.sin(a) * R * 2.0);
			K.add('shell', stone(2 + X.r() * 2, 1.2 + X.r() * 1.4, 2 + X.r() * 2, X.r() * 100).translate(p.x, X.H(p.x, p.z) + 0.2, p.z), { tint: X.rockT(), glow: G.rock });
		}
		X.contacts.push({ x: T.x, z: T.z, r: R * 2.0, m: 7, k: 0.5 });
	}
	const prof = [];
	for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([R * taper(t) * 0.86, root + t * body]); }
	// (the body, its plates and rings and lobbies are its hull: hidden from inside, where they would cut the rooms)
	K.add('hull', F.put(lathe(prof, 20, false)), { tint: S.slab, glow: G.glazing });
	K.add('shell', F.put(box(0.4, body, 0.3), R * taper(0.5) * 0.86 + 0.05, root + body / 2, 0), { tint: S.strip, glow: G.lamp });
	for (let i = 0; i <= n; i++) {
		const t = i / n, y = root + i * 4.2, rr = R * taper(t), big = i % 6 === 0 || i === n;
		K.add('hull', F.put(plate(rr * 2.2, rr * 1.75, big ? 0.75 : 0.4, S.round), 0, y + (big ? 0.35 : 0), 0, T.twist * t), C);
		if (big) K.add('hull', F.put(ring(rr * 0.84, 0.18, 0.08, 24), 0, y - 0.55, 0), { tint: S.lamp, glow: G.lamp });
	}
	// the crown: a halo on four struts, a mast with its beacon
	const yt = root + body, rt = R * taper(1);
	K.add('shell', F.put(ring(rt * 1.2, 0.9, 1.1, 40), 0, yt + 7, 0), C);
	K.add('shell', F.put(ring(rt * 1.2, 0.3, 0.12, 40), 0, yt + 6.92, 0), { tint: S.lamp, glow: G.lamp });
	for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + T.twist; K.add('shell', strut(F.p(Math.cos(a) * rt * 0.7, yt + 0.4, Math.sin(a) * rt * 0.7), F.p(Math.cos(a) * rt * 1.2, yt + 7.4, Math.sin(a) * rt * 1.2), 0.35, 0.35), { tint: S.trim, glow: G.metal }); }
	K.add('shell', F.put(prism(6, 0.55, 0.06, 24), 0, yt, 0), { tint: S.trim, glow: G.metal });
	K.add('shell', F.put(box(0.6, 0.6, 0.6), 0, yt + 24.2, 0), { tint: S.beacon, glow: G.beacon });
	for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; K.add('shell', F.put(box(0.4, 0.4, 0.4), Math.cos(a) * rt * 0.9, yt + 0.6, Math.sin(a) * rt * 0.9), { tint: S.beacon, glow: G.beacon }); }
	X.col.disc(T.x, T.z, R * 0.92, T.y + yt + 0.4, { site: X.site, solid: false });
	T.roof = T.y + yt;
	// the lift's track standing off the side, braced back to the plates
	const lx = R * 1.32 + 1.2, top = F.p(lx, yt - 2, 0), bot = F.p(lx, root - 1, 0);
	K.add('shell', strut(bot, top, 0.3, 0.6), { tint: S.trim, glow: G.metal });
	for (let y = root + 8; y < yt - 2; y += 24) K.add('shell', strut(F.p(R * taper((y - root) / body) * 0.86, y, 0), F.p(lx, y, 0), 0.25, 0.25), { tint: S.trim, glow: G.metal });
	const out = F.p(lx + 1.25, 0, 0);
	X.lifts.push({ x: out.x, z: out.z, y0: T.y + root + 0.5, y1: T.y + yt - 4, yaw: F.yaw, y: T.y + root + 0.5, dir: 1, wait: X.r() * 8 });
	// lobbies where a bridge comes in: a wider plate, railed but for the bridge's gap
	for (const L of T.lobbies) {
		const ly = L.y - T.y, t = Math.max(0, Math.min(1, (ly - root) / body)), rr = R * taper(t), r1 = rr * 1.1 + 4;
		K.add('hull', plate(r1 * 2, r1 * 2, 0.6, true).translate(T.x, L.y, T.z), C);
		const pts = [];
		for (let k = 0; k <= 36; k++) {
			const a = L.a + 0.35 + k / 36 * (TAU - 0.7);
			pts.push({ x: Math.sin(a) * (r1 - 0.15), z: Math.cos(a) * (r1 - 0.15) });
		}
		rail(X, frame(T.x, 0, T.z, 0), pts, L.y, { under: 0.7 });
		portal(X, F.sub(Math.sin(L.a - F.yaw) * (rr * 0.86 + 0.1), L.y - T.y, Math.cos(L.a - F.yaw) * (rr * 0.86 + 0.1), L.a - F.yaw), 3, 3.4);
		X.col.ring(T.x, T.z, rr * 0.86, r1, L.y, 0, TAU, X.site);
	}
	// its rooms: the clear radius at a height, inside the root or the body
	const radAt = (ya, yb) => {
		let m = 1e9;
		for (let k = 0; k <= 8; k++) {
			const y = ya - T.y + (yb - ya) * k / 8;
			let rr = 0;
			if (y < root) { for (let j = 0; j < rootP.length - 1; j++) if (y >= rootP[j][1] && y <= rootP[j + 1][1]) rr = rootP[j][0] + (rootP[j + 1][0] - rootP[j][0]) * (y - rootP[j][1]) / (rootP[j + 1][1] - rootP[j][1]); }
			else rr = R * taper(Math.min(1, (y - root) / body)) * 0.86;
			m = Math.min(m, rr);
		}
		return m - 0.5;
	};
	const sea = X.sea, y0 = T.sea ? sea + 2.5 : T.y + 2.45, doors = [], a0 = X.r() * TAU;
	if (y0 < T.y + yt - 30) {
		if (!T.sea) {
			// the way in: a porch through the root's skirt, its doors lit
			const r0 = radAt(y0, y0 + 10), rOut = R * 1.55, len = rOut - r0 + 0.4;
			doors.push({ y: y0, a: a0, w: 3.4, h: 4.4, porch: len, ext: true });
			const mid = (r0 + rOut) / 2;
			K.add('shell', F.put(box(5.2, 6.0, len), Math.sin(a0) * mid, y0 - T.y + 2.9, Math.cos(a0) * mid, a0), C);
			portal(X, F.sub(Math.sin(a0) * (rOut + 0.42), y0 - T.y, Math.cos(a0) * (rOut + 0.42), a0), 3.4, 4.4);
			// the skirt walked into but for the porch
			for (let k = 0; k < 28; k++) {
				const b0 = k / 28 * TAU, b1 = (k + 1) / 28 * TAU, bm = (b0 + b1) / 2;
				if (Math.abs(((bm - a0) % TAU + TAU + Math.PI) % TAU - Math.PI) < 0.24) continue;
				const p0 = F.p(Math.sin(b0) * R * 1.5, 0, Math.cos(b0) * R * 1.5), p1 = F.p(Math.sin(b1) * R * 1.5, 0, Math.cos(b1) * R * 1.5);
				X.col.seg(p0, p1, 0.3, y0 + 9, X.site, y0 - 3);
			}
		} else {
			doors.push({ y: y0, a: a0, w: 3.4, h: 4.4, ext: true });
			jetty(X, F, a0, radAt(y0, y0 + 10), y0, R * 1.9);
		}
		for (const L of T.lobbies) doors.push({ y: L.y, a: L.a - F.yaw, w: 3, h: 3.4, ext: true });
		X.shells.push({ name: T.name, kind: 'spire', round: true, x: T.x, z: T.z, yaw: F.yaw, y0, y1: T.y + yt - 0.4, r0: R, radAt, must: T.lobbies.map((L) => L.y), doors, top: 'crown', seed: (X.seed + X.site * 131) >>> 0 });
	}
	return [{ x: T.x, z: T.z, r: R * 0.95, light: 1, tower: true }];
}

// a cluster of dark slab towers: podiums sunk in the ground, bodies all window grid, a light
// strip up an edge, red lights at the roof corners, an antenna on the tallest
function slabs(X, T) {
	const { K, S } = X, D = { tint: S.slab.map((c) => c * 1.6) }, F = frame(T.x, T.y, T.z, X.r() * TAU), h = T.top - T.y, n = 2 + Math.floor(X.r() * 3), out = [];
	let tallest = null;
	for (let i = 0; i < n; i++) {
		// (the first, the tallest, is broad enough for grand rooms: the plan sized it and levelled its ground)
		const w = i === 0 && T.sw ? T.sw : 12 + X.r() * 10, d = i === 0 && T.sd ? T.sd : 8 + X.r() * 5, hh = h * (i === 0 ? 1 : 0.45 + X.r() * 0.4);
		const a = i * 2.1 + X.r(), off = i ? T.R * (1.1 + X.r() * 0.7) + 6 : 0, B = F.sub(Math.cos(a) * off, 0, Math.sin(a) * off, (X.r() - 0.5) * 0.3);
		K.add('shell', B.put(box(w + 2.4, 9, d + 2.4), 0, 2.5, 0), D);
		K.add('shell', B.put(box(w, hh - 7, d), 0, 7 + (hh - 7) / 2, 0), { tint: S.slab, glow: G.glazing });
		K.add('shell', B.put(box(w + 0.6, 1.2, d + 0.6), 0, hh + 0.6, 0), D);
		if (i !== 1) K.add('shell', B.put(box(0.5, hh - 7, 0.3), (w / 2 - 0.25) * (i ? -1 : 1), 7 + (hh - 7) / 2, d / 2 + 0.12), { tint: S.strip, glow: G.lamp });
		for (const sx of [-1, 1]) K.add('shell', B.put(box(0.5, 0.5, 0.5), sx * (w / 2 - 0.4), hh + 1.45, d / 2 - 0.4), { tint: S.beacon, glow: G.beacon });
		const c = B.p(0, 0, 0);
		const rooms = i === 0 && !!T.sw;
		X.col.box(c.x, c.z, B.yaw, w / 2 + 1.2, d / 2 + 1.2, T.y + hh + 1.2, { site: X.site, solid: !rooms });
		if (rooms) slabRooms(X, T, B, w, d, hh);
		if (!T.sea) X.contacts.push({ F: B, x0: -w / 2 - 1.2, x1: w / 2 + 1.2, z0: -d / 2 - 1.2, z1: d / 2 + 1.2, m: 6, k: 0.45, all: true });
		out.push({ x: c.x, z: c.z, r: i ? Math.max(w, d) * 0.55 : Math.hypot(w, d) / 2 + 1, light: i ? 0.7 : 1, tower: true });
		if (!i) tallest = { B, hh };
	}
	K.add('shell', tallest.B.put(prism(6, 0.45, 0.05, 26), 0, tallest.hh + 1.2, 0), { tint: S.trim, glow: G.metal });
	K.add('shell', tallest.B.put(box(0.5, 0.5, 0.5), 0, tallest.hh + 27.4, 0), { tint: S.beacon, glow: G.beacon });
	if (!T.sea) for (const o of out) for (let k = 0; k < 4; k++) {
		const a = X.r() * TAU, p = { x: o.x + Math.cos(a) * o.r * 1.5, z: o.z + Math.sin(a) * o.r * 1.5 };
		K.add('shell', stone(2 + X.r() * 2, 1.2 + X.r(), 2 + X.r() * 2, X.r() * 100).translate(p.x, X.H(p.x, p.z) + 0.2, p.z), { tint: X.rockT(), glow: G.rock });
	}
	T.roof = T.y + tallest.hh + 1.2;
	const st = tallest.B.p(0, tallest.hh + 1.2, 0);
	T.stand = { x: st.x, y: st.y, z: st.z, yaw: 0 };
	return out;
}

// a lit doorway on a building's skin: brass jambs and lintel round a curtain of glow (one-sided:
// from inside it is not there), frame Fr at the door's foot facing out
function portal(X, Fr, w, h) {
	const { K, S } = X, M = { tint: S.trim, glow: G.metal };
	for (const sx of [-1, 1]) K.add('shell', Fr.put(box(0.35, h + 0.35, 0.5), sx * (w / 2 + 0.17), (h + 0.35) / 2, 0), M);
	K.add('shell', Fr.put(box(w + 0.7, 0.35, 0.5), 0, h + 0.17, 0), M);
	K.add('shell', Fr.put(new THREE.PlaneGeometry(w, h).translate(0, h / 2, -0.1)), { tint: S.winB.map((c) => c * 0.45), glow: G.lamp });
	K.add('shell', Fr.put(box(w + 0.7, 0.06, 0.3), 0, 0.03, 0.35), { tint: S.lamp, glow: G.lamp });
}
// a landing deck out from a building at y (for the towers standing in the sea or the cloud):
// along bearing a in frame F, from r0 to r1, railed, a portal where it meets the skin at rs
function jetty(X, F, a, r0, y, r1, rs = r0 + 0.6) {
	const { K, S } = X, len = r1 + 4 - r0, mid = (r0 + r1 + 4) / 2, J = F.sub(Math.sin(a) * mid, y - F.y, Math.cos(a) * mid, a);
	K.add('shell', J.put(box(5, 0.5, len), 0, -0.25, 0), { tint: S.concrete });
	K.add('shell', J.put(box(5.04, 0.08, len - 0.2), 0, -0.52, 0), { tint: S.band, glow: G.lamp });
	const c = J.p(0, 0, 0);
	X.col.box(c.x, c.z, J.yaw, 2.5, len / 2, y, { site: X.site, solid: false });
	rail(X, J, [{ x: -2.35, z: -len / 2 + 1.2 }, { x: -2.35, z: len / 2 - 0.15 }, { x: 2.35, z: len / 2 - 0.15 }, { x: 2.35, z: -len / 2 + 1.2 }], y, { under: 0.6 });
	portal(X, F.sub(Math.sin(a) * rs, y - F.y, Math.cos(a) * rs, a), 3.4, 4.4);
}
// a slab tower's rooms: its ground door through the podium (or a deck on the water), a deck
// where it stands out of the cloud, a door where the plan's floors meet them
function slabRooms(X, T, B, w, d, hh) {
	const sea = X.sea, H = X.H, top = T.y + hh + 0.9;
	let g = -1e9;
	for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]]) { const q = B.p(u * w / 2, 0, v * d / 2); g = Math.max(g, H(q.x, q.z)); }
	const y0 = Math.max(g + 0.05, sea + 2.5, T.y + 0.5), doors = [], at = w * 0.22;
	if (top - y0 < 30) return;
	if (!T.sea && g > sea + 1) {
		doors.push({ y: y0, at, w: 3.4, h: 4.4, porch: 1.6, ext: true });
		portal(X, B.sub(at, y0 - B.y, d / 2 + 1.22, 0), 3.4, 4.4);
		// the podium walked into but for the door
		const hx = w / 2 + 1.2, hz = d / 2 + 1.2, P2 = (x, z) => B.p(x, 0, z);
		for (const [a, b] of [[[-hx, -hz], [hx, -hz]], [[hx, -hz], [hx, hz]], [[-hx, hz], [-hx, -hz]], [[-hx, hz], [at - 2.1, hz]], [[at + 2.1, hz], [hx, hz]]]) X.col.seg(P2(...a), P2(...b), 0.3, B.y + 7, X.site, y0 - 2);
	} else {
		doors.push({ y: y0, at, w: 3.4, h: 4.4, ext: true });
		const J = B.sub(at, 0, 0, 0);
		jetty(X, J, 0, d / 2, y0, d / 2 + 8, d / 2 + 0.05);
	}
	// out of the mist: a deck to land on
	const must = [];
	if (X.mistTop > y0 + 8 && X.mistTop + 6 < top - 20) {
		const ys = X.mistTop + 5;
		must.push(ys);
		doors.push({ y: ys, at: -w * 0.2, w: 3.0, h: 3.4, ext: true });
		jetty(X, B.sub(-w * 0.2, 0, 0, 0), 0, d / 2, ys, d / 2 + 4, d / 2 + 0.05);
	}
	X.shells.push({ name: T.name, kind: 'slab', x: B.x, z: B.z, yaw: B.yaw, y0, y1: top, w, d, must, doors, top: 'observatory', seed: (X.seed + X.site * 131) >>> 0 });
}

// the monolith: a thin black slab out on the water, one line of light up its face
function monolith(X, M, sea) {
	const { K, S } = X, F = frame(M.x, sea, M.z, M.yaw), deep = sea - M.y + 2;
	K.add('shell', F.put(box(5.5, M.h + deep, 1.4), 0, (M.h - deep) / 2, 0), { tint: [0.015, 0.015, 0.02], glow: G.metal });
	for (const sz of [-1, 1]) K.add('shell', F.put(box(0.32, M.h - 1, 0.1), 0, M.h / 2, sz * 0.72), { tint: S.strip, glow: G.lamp });
	K.add('shell', F.put(box(0.4, 0.4, 0.4), 0, M.h + 0.2, 0), { tint: S.beacon, glow: G.beacon });
	X.col.box(M.x, M.z, M.yaw, 2.75, 0.7, sea + M.h, { site: X.site });
	X.streaks.push({ x: M.x, z: M.z, y: sea + 0.06, w: 1.6, len: 220, c: S.strip });
}

// a bridge across a gap: a slender deck arched a little, a fish-belly truss under it,
// glass along both sides and a light line at its edges
function bridge(X, b) {
	const { K, S } = X, A = b.a, B = b.b, w = b.w, L = Math.hypot(B.x - A.x, B.z - A.z), n = Math.max(6, Math.ceil(L / 6));
	const yaw = Math.atan2(B.x - A.x, B.z - A.z), c = Math.cos(yaw), s = Math.sin(yaw);
	const pt = (t, dy = 0, side = 0) => new THREE.Vector3(A.x + (B.x - A.x) * t + side * c, A.y + (B.y - A.y) * t + Math.sin(t * Math.PI) * L * 0.02 + dy, A.z + (B.z - A.z) * t - side * s);
	for (let k = 0; k < n; k++) {
		const t0 = k / n, t1 = (k + 1) / n, p0 = pt(t0), p1 = pt(t1);
		K.add('shell', plank(pt(t0, -0.25), pt(t1, -0.25), w, 0.45), { tint: S.concrete });
		K.add('shell', plank(pt(t0, 0.0), pt(t1, 0.0), w - 0.5, 0.06), { tint: S.timber, glow: G.timber });
		X.col.ramp(p0.x, p0.z, yaw, w / 2, 0, Math.hypot(p1.x - p0.x, p1.z - p0.z), p0.y, p1.y, X.site);
		for (const sd of [-1, 1]) {
			const a = pt(t0, 0, sd * (w / 2 - 0.1)), e = pt(t1, 0, sd * (w / 2 - 0.1));
			K.add('glass', plank(a.clone().setY(a.y + 0.55), e.clone().setY(e.y + 0.55), 0.04, 1.05), { near: true });
			K.add('shell', plank(a.clone().setY(a.y + 1.1), e.clone().setY(e.y + 1.1), 0.07, 0.06), { tint: S.trim, glow: G.metal, near: true });
			K.add('shell', plank(a.clone().setY(a.y - 0.52), e.clone().setY(e.y - 0.52), 0.08, 0.05), { tint: S.lamp, glow: G.lamp });
			X.col.seg(a, e, 0.12, Math.max(a.y, e.y) + 1.1, X.site, Math.min(a.y, e.y) - 0.4);
			// the hanger down to the belly chord
			if (k > 0) K.add('shell', strut(pt(t0, -0.45, sd * (w / 2 - 0.25)), pt(t0, -0.5 - Math.sin(t0 * Math.PI) * L * 0.05, sd * (w / 2 - 0.25)), 0.12, 0.12), { tint: S.trim, glow: G.metal, near: true });
		}
	}
	for (const sd of [-1, 1]) {
		const pts = [];
		for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(pt(t, -0.5 - Math.sin(t * Math.PI) * L * 0.05, sd * (w / 2 - 0.25))); }
		K.add('shell', sweep(pts, 0.22, 8), { tint: S.trim, glow: G.metal });
	}
	// where it lands on the cliff top: stone under its end
	collar(X, pt(0, -1.2), 1.6);
	X.contacts.push({ x: A.x, z: A.z, r: 2.5, m: 3, k: 0.35 });
}

// the shore house: a white cube on its knoll, the upper floor slid back, a pink window and
// round ones, a stair down to the water with lamps beside it, an umbrella pine behind
function shoreHouse(X, L) {
	const { K, S, H } = X, F = frame(L.x, L.y, L.z, L.yaw), C = { tint: S.concrete }, sea = X.sea;
	K.add('shell', F.put(box(8, 4.4, 7), 0, 1.2, 0), C);
	K.add('shell', F.put(box(6.4, 3.2, 5.6), 0.9, 5.0, -0.7), C);
	K.add('shell', F.put(box(7.2, 0.3, 6.4), 0.9, 6.75, -0.5), C);
	K.add('shell', F.put(box(8.4, 0.3, 7.4), 0, 3.55, 0.1), C);
	K.add('shell', F.put(box(1.8, 1.6, 0.08), 1.6, 5.1, 2.12), { tint: S.winB, glow: G.lamp });
	K.add('shell', F.put(box(1.1, 2.2, 0.08), -1.8, 1.1, 3.52), { tint: S.window, glow: G.lamp });
	K.add('shell', F.put(box(2.4, 1.4, 0.08), 1.6, 1.8, 3.52), { tint: S.glazing, glow: G.glazing });
	for (let k = 0; k < 3; k++) K.add('shell', F.put(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16).rotateZ(Math.PI / 2), 4.12, 5.0, -2.2 + k * 1.4), { tint: S.winV, glow: G.lamp });
	X.col.box(L.x, L.z, L.yaw, 4.1, 3.6, L.y + 3.7, { site: X.site, solid: false });
	const up = F.p(0.9, 0, -0.7);
	X.col.box(up.x, up.z, L.yaw, 3.3, 2.9, L.y + 6.9, { site: X.site, y0: L.y + 3.6, solid: false });
	// its two rooms: the salon (the lit door into it), a stair along the back up to the room over it
	{
		const wall = (gaps = []) => ({ mode: 'wall', gaps }), glassS = (gaps = []) => ({ mode: 'glass', gaps });
		X.shells.push({ house: true, name: L.name, kind: 'shore', x: L.x, z: L.z, reach: 9, seed: (X.seed + X.site * 131) >>> 0, vols: [
			{ F: roomFrame(L.x, L.y, L.z, L.yaw), w: 7.9, d: 6.9, h: 3.3, kind: 'lounge', sides: { pz: glassS([{ at: -1.8, w: 1.4, h: 2.3 }]), px: glassS(), nz: wall(), nx: wall() }, stairs: [{ ax: -3.2, az: -2.65, bx: 2.5, bz: -2.65, ya: 0, yb: 3.72, hw: 0.6 }], rails: [], ceil: [{ x: -0.3, z: -2.65, hw: 2.9, hd: 0.65 }] },
			{ F: roomFrame(up.x, L.y + 3.72, up.z, L.yaw), w: 6.3, d: 5.5, h: 2.8, kind: 'suite', theme: 2, sides: { pz: glassS(), px: glassS(), nz: wall(), nx: wall() }, holes: [{ x: -1.2, z: -1.95, hw: 2.0, hd: 0.66 }], rails: [{ ax: -3.0, az: -1.28, bx: 0.8, bz: -1.28 }] },
		] });
	}
	// the stair down the knoll to a landing on the water, its lamps
	let last = null;
	for (let z = 4.2; z <= L.wd + 1.5; z += 0.75) {
		const p = F.p(-1.8, 0, z), g = Math.max(H(p.x, p.z), sea - 0.2);
		K.add('shell', F.put(box(1.6, 0.6, 0.8), -1.8, g - L.y - 0.22, z), C);
		last = { z, g };
		if (g <= sea - 0.1) break;
	}
	if (last) {
		K.add('shell', F.put(box(3.4, 0.4, 2.6), -1.8, sea + 0.25 - L.y, last.z + 1.6), { tint: S.timber, glow: G.timber });
		for (const z of [4.6, (4.6 + last.z) / 2, last.z]) {
			const p = F.p(-3.1, 0, z), g = Math.max(H(p.x, p.z), sea);
			K.add('shell', F.put(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 6), -3.1, g - L.y + 1.4, z), { tint: S.trim, glow: G.metal });
			K.add('shell', F.put(box(0.3, 0.35, 0.3), -3.1, g - L.y + 2.95, z), { tint: S.lamp, glow: G.lamp });
			X.dots.push({ x: p.x, y: g + 2.95, z: p.z, s: 0.9, c: S.lamp });
		}
		const w = F.p(0, 0, last.z + 3);
		X.streaks.push({ x: w.x, z: w.z, y: sea + 0.06, w: 1.2, len: 70, c: S.winB });
		const w2 = F.p(-3.1, 0, last.z + 1);
		X.streaks.push({ x: w2.x, z: w2.z, y: sea + 0.06, w: 0.5, len: 45, c: S.lamp });
		const w3 = F.p(1.6, 0, last.z + 2.5);
		X.streaks.push({ x: w3.x, z: w3.z, y: sea + 0.06, w: 0.8, len: 60, c: S.winV });
	}
	// the umbrella pine
	const t0 = F.p(5.5, 0, -4.5), g0 = H(t0.x, t0.z);
	K.add('shell', sweep([new THREE.Vector3(t0.x, g0 - 0.5, t0.z), F.p(5.0, g0 - L.y + 4, -4.0), F.p(4.0, g0 - L.y + 8.5, -3.2)], (t) => 0.35 - t * 0.15, 6), { tint: [0.16, 0.10, 0.07], glow: G.timber });
	const cr = F.p(4.0, g0 - L.y + 9.4, -3.2);
	K.add('shell', blob(5.2, 1.7, 4.6, 8).translate(cr.x, cr.y, cr.z), { tint: [0.05, 0.10, 0.04], glow: G.planted });
	X.contacts.push({ F, x0: -4.2, x1: 4.2, z0: -3.7, z1: 3.7, m: 3.5, k: 0.4, all: true });
	const st = F.p(-1.8, 0, 5.2);
	L.stand = { x: st.x, y: Math.max(H(st.x, st.z), sea) + 0.3, z: st.z, yaw: L.yaw + Math.PI };
}
// a white gabled cottage in the flowers, its doorway lit
function cottage(X, x, z, yaw) {
	const { K, H } = X, y = H(x, z), F = frame(x, y, z, yaw), C = { tint: [0.92, 0.9, 0.84] };
	const tri = new THREE.Shape([new THREE.Vector2(-3.4, 0), new THREE.Vector2(3.4, 0), new THREE.Vector2(0, 2.6)]);
	K.add('shell', F.put(box(6, 3.4, 8), 0, 1.2, 0), C);
	K.add('shell', F.put(new THREE.ExtrudeGeometry(tri, { depth: 8.6, bevelEnabled: false }).translate(0, 0, -4.3), 0, 2.85, 0), { tint: [0.12, 0.12, 0.13] });
	K.add('shell', F.put(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-3, 0), new THREE.Vector2(3, 0), new THREE.Vector2(0, 2.3)]), { depth: 0.1, bevelEnabled: false }), 0, 2.9, 4.0), C);
	K.add('shell', F.put(box(1.0, 2.0, 0.08), 1.6, 0.95, 4.02), { tint: [1.0, 0.45, 0.62], glow: G.lamp });
	for (const sx of [-1.3, 0.1]) K.add('shell', F.put(box(0.8, 0.9, 0.06), sx, 1.9, 4.02), { tint: [0.2, 0.22, 0.26], glow: G.glazing });
	X.col.box(x, z, yaw, 3, 4, y + 3.0, { site: X.site });
	X.contacts.push({ F, x0: -3.1, x1: 3.1, z0: -4.1, z1: 4.1, m: 2.5, k: 0.35, all: true });
}

// a far city standing out of the cloud at the edge of sight: dark slabs, their windows, red
// lights on the roofs, a strip or an antenna here and there
function farCity(X, c) {
	const { K, S } = X, rr = mulberry32(c.seed);
	for (let i = 0; i < c.n; i++) {
		const a = rr() * TAU, d = rr() * 60, w = 10 + rr() * 14, dd = 8 + rr() * 10, h = c.h * (0.4 + rr() * 0.6);
		const F = frame(c.x + Math.sin(a) * d, c.y, c.z + Math.cos(a) * d, rr() * TAU);
		K.add('shell', F.put(box(w, h, dd), 0, h / 2, 0), { tint: S.slab, glow: G.glazing });
		K.add('shell', F.put(box(0.8, 0.8, 0.8), 0, h + 0.4, 0), { tint: S.beacon, glow: G.beacon });
		if (rr() < 0.4) K.add('shell', F.put(box(0.7, h * 0.9, 0.3), w / 2 - 0.4, h * 0.5, dd / 2 + 0.15), { tint: S.strip, glow: G.lamp });
		if (rr() < 0.3) K.add('shell', F.put(prism(6, 0.5, 0.05, 20), 0, h, 0), { tint: S.trim, glow: G.metal });
	}
}

// the ground's contact shade: a draped grid round each footprint
function contactGeometry(H, list) {
	const pos = [], ks = [], idx = [];
	const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
	for (const c of list) {
		const step = 1.5, F = c.F;
		const x0 = F ? c.x0 - c.m : -c.r - c.m, x1 = F ? c.x1 + c.m : c.r + c.m, z0 = F ? c.z0 - c.m : -c.r - c.m, z1 = F ? c.z1 + c.m * (c.all ? 1 : 0.3) : c.r + c.m;
		const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step), base = pos.length / 3;
		for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
			const lx = x0 + (x1 - x0) * i / nx, lz = z0 + (z1 - z0) * j / nz;
			let x, z, d;
			if (F) { const p = F.p(lx, 0, lz); x = p.x; z = p.z; d = Math.hypot(Math.max(c.x0 - lx, 0, lx - c.x1), Math.max(c.z0 - lz, 0, lz - c.z1)); }
			else { x = c.x + lx; z = c.z + lz; d = Math.max(0, Math.hypot(lx, lz) - c.r); }
			pos.push(x, H(x, z) + 0.12, z);
			ks.push(c.k * sm(c.m, 0, d) * (F && lz > 0 && !c.all ? 0 : 1));
		}
		for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
			const a = base + j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
			idx.push(a, d, b, b, d, e);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aK', new THREE.Float32BufferAttribute(ks, 1));
	g.setIndex(idx);
	g.computeBoundingSphere();
	return g;
}

export function createArch(island, shared, scene, camera, profile, plan, opts = {}) {
	const none = { update() {}, floor: () => -Infinity, push() {}, go: () => 'no cliff settlement on this world', dispose() {}, info: () => null };
	if (!plan) return none;
	const t0 = performance.now();
	const S = plan.style, isPhone = !!opts.isPhone;
	const H = (x, z) => island.heightAt(x, z);
	const group = new THREE.Group();
	group.name = 'arch';
	scene.add(group);
	const U = archUniforms(shared, S);
	const air = profile?.air?.tint || [0.55, 0.62, 0.72], rk = profile?.ground?.rock || [0.42, 0.40, 0.37];
	const envRT = skyEnvironment(opts.renderer, air.map((v) => v * 0.5), air.map((v) => v * 0.9), rk.map((v) => v * 0.5));
	const env = envRT?.texture || null;
	const mats = { shell: archMaterial(U, { env }), glass: railGlass({ env }) };
	mats.hull = mats.shell;
	const col = colliders();
	const r = mulberry32((plan.seed ^ 0xa1c4) >>> 0);
	// the world's own stone, a little varied stone to stone (sRGB authored, made linear)
	const rockC = new THREE.Color().setRGB(rk[0], rk[1], rk[2], THREE.SRGBColorSpace);
	const X = { S, H, col, r, contacts: [], lifts: [], streaks: [], dots: [], sea: island.sea || 0, shells: [], seed: plan.seed >>> 0, mistTop: plan.mist.top, rockT: () => { const j = 0.85 + r() * 0.3; return [rockC.r * j, rockC.g * j, rockC.b * j]; } };
	const sites = [], obs = [];
	const site = (name, at, rad, far, make) => {
		X.K = new Kit();
		X.site = sites.length;
		let made = null;
		try { made = make(); } catch (err) { console.error('[arch] ' + name, err); return null; }
		const g = new THREE.Group();
		g.name = 'arch:' + name;
		const meshes = X.K.build(mats, g, far === Infinity);
		group.add(g);
		sites.push({ name, x: at.x, z: at.z, y: at.y, r: rad, g, meshes, far, nearD: 320 });
		return made;
	};
	for (const v of plan.villas) {
		const o = site(v.name, v, v.W + v.O, 3400, () => (v.kind === 'terraces' ? terraces : cantilever)(X, v));
		if (o && o.foot < plan.mist.top) obs.push({ x: o.x, z: o.z, r: o.r, light: 0.5 });
		// a house over the water: its underside band laid on the sea in a streak
		if (o && v.foot < (island.sea || 0) + 1) X.streaks.push({ x: o.x, z: o.z, y: (island.sea || 0) + 0.06, w: v.W * 0.4, len: 120, c: S.band });
	}
	for (const T of plan.towers) {
		const o = site(T.name, { x: T.x, z: T.z, y: T.y }, T.R * 3, Infinity, () => (T.kind === 'slabs' ? slabs : tower)(X, T));
		if (o) obs.unshift(...o);
		// its light on the water below it
		if (T.y < (island.sea || 0)) for (const q of o || []) X.streaks.push({ x: q.x, z: q.z, y: (island.sea || 0) + 0.06, w: q.r * 0.8, len: 160, c: S.glow });
	}
	for (const [i, c] of (plan.cities || []).entries()) site('Far city ' + (i + 1), c, 80, Infinity, () => farCity(X, c));
	const M = plan.mountain;
	if (M?.tower) site(M.tower.name, M.tower, 30, Infinity, () => slabs(X, M.tower));
	if (plan.shore) site(plan.shore.name, plan.shore, 16, 3000, () => shoreHouse(X, plan.shore));
	if (plan.monolith) site('The Monolith', plan.monolith, 8, Infinity, () => monolith(X, plan.monolith, island.sea || 0));
	if (plan.bridges.length) site('Bridges', plan.centre, 600, 3400, () => { for (const b of plan.bridges) bridge(X, b); });
	// the buildings' rooms: their plans now (cheap), each built as you come to it
	const hulls = new Map(sites.map((G) => [G.name, G.meshes.filter((m) => m.name.startsWith('alien:hull'))]));
	const order = [...plan.villas.map((q) => q.name), ...plan.towers.map((q) => q.name), ...(plan.shore ? [plan.shore.name] : [])];
	const shells = X.shells.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
	const buildings = shells.map((o) => (o.house ? housePlan(o) : towerPlan(o)));
	for (const B of buildings) { const hl = hulls.get(B.name); if (hl?.length) B.hull = hl; }
	const In = createInteriors(scene, shared, buildings, { isPhone, env, hint: opts.hint, settlement: plan.name, player: opts.player });
	// the lifts and the craft, instanced in the shared material
	const inst = (geo, n, name) => {
		const m = new THREE.InstancedMesh(geo, mats.shell, Math.max(1, n));
		m.count = n; m.castShadow = true; m.name = 'arch:' + name; m.frustumCulled = false;
		m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		group.add(m);
		return m;
	};
	const liftGeo = mergeGeometries([
		paint(lathe([[0.01, -0.2], [1.15, 0], [1.25, 0.3], [1.25, 2.6], [1.1, 2.9], [0.01, 3.0]], 12, false), S.glazing, G.glazing),
		paint(new THREE.CylinderGeometry(1.3, 1.3, 0.25, 12).translate(0, -0.1, 0), S.concrete, G.concrete),
		paint(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 12).translate(0, 2.98, 0), S.lamp, G.lamp),
	]);
	const lifts = inst(liftGeo, X.lifts.length, 'lifts');
	const craftGeo = mergeGeometries([
		paint(lathe([[0.01, -0.7], [1.3, -0.45], [1.9, 0], [1.3, 0.35], [0.01, 0.5]], 16, false).scale(1, 1, 2.3), S.concrete, G.concrete),
		paint(lathe([[0.01, 0.25], [0.9, 0.3], [0.7, 0.85], [0.01, 1.0]], 12, false).scale(1, 1, 1.6).translate(0, 0, 0.6), S.glazing, G.glazing),
		paint(new THREE.TorusGeometry(1.7, 0.06, 4, 24).rotateX(Math.PI / 2).scale(1, 1, 2.2), S.lamp, G.lamp),
		paint(new THREE.BoxGeometry(0.25, 0.25, 0.25).translate(0, 0.55, -3.6), S.beacon, G.beacon),
	]);
	const crafts = [];
	const nC = isPhone ? Math.ceil(S.craft / 2) : S.craft;
	const hi = plan.mist.top + 14;
	for (let i = 0; i < nC && plan.towers.length; i++) {
		const pts = [];
		const T0 = plan.towers[i % plan.towers.length];
		const stops = [T0, ...plan.villas.filter((v, k) => (k + i) % 3 === 0).slice(0, 2), plan.towers[(i + 1) % plan.towers.length]];
		for (const q of stops) {
			const a = r() * TAU, d = q.R ? q.R * 3 + 10 : 26;
			const y = q.R ? hi + r() * Math.max(10, (q.top - hi) * 0.8) : Math.max(hi, q.y + 18 + r() * 14);
			const p = q.R ? { x: q.x + Math.sin(a) * d, z: q.z + Math.cos(a) * d } : { x: q.x + Math.sin(q.yaw) * (q.O + 30), z: q.z + Math.cos(q.yaw) * (q.O + 30) };
			pts.push(new THREE.Vector3(p.x, Math.max(y, H(p.x, p.z) + 25), p.z));
		}
		if (pts.length < 3) pts.push(new THREE.Vector3(plan.centre.x, hi + 30, plan.centre.z));
		const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
		crafts.push({ curve, len: curve.getLength(), u: r(), v: 14 + r() * 8 });
	}
	const craftMesh = inst(craftGeo, crafts.length, 'craft');
	// the mist band, glowing from below where the towers stand in it
	const banks = (plan.cities || []).map((c) => ({ x: c.x, z: c.z, r: 75, y: (island.sea || 0) + 8, rise: 30, n: 14, size: 75 }));
	if (M) banks.push({ x: M.x, z: M.z, r: M.r, y: M.y - 6, rise: 26, n: 28, size: 85 });
	const mist = createMist(scene, shared, plan.mist, obs.slice(0, 12), { isPhone, seed: plan.seed, glow: S.glow, banks, heightAt: H });
	// glowing flowers on the green near the houses, and hamlets' lamps on the slopes over the mist
	const dots = X.dots;
	const grassy = (x, z) => island.maskAt ? island.maskAt(x, z, 3) : 1;
	const nrm = (x, z) => island.normalAt ? island.normalAt(x, z).y : 1;
	const fl = isPhone ? 500 : 1100;
	for (let p = 0; p < (S.flowers || 0); p++) {
		const v = plan.villas[p % plan.villas.length], a = v.yaw + Math.PI + (r() - 0.5) * 2.2, d = 25 + r() * 70;
		const cx = v.x + Math.sin(a) * d, cz = v.z + Math.cos(a) * d, rx = 10 + r() * 18, rz = 8 + r() * 14, ra = r() * TAU;
		if (p === 0 && grassy(cx, cz) > 0.2 && nrm(cx, cz) > 0.9) site('The Cottage', { x: cx, z: cz, y: H(cx, cz) }, 8, 2600, () => cottage(X, cx + rx * 0.6, cz, a + Math.PI));
		for (let k = 0; k < fl; k++) {
			const u = (r() + r() + r() - 1.5) * rx, w = (r() + r() + r() - 1.5) * rz;
			const x = cx + u * Math.cos(ra) - w * Math.sin(ra), z = cz + u * Math.sin(ra) + w * Math.cos(ra);
			if (grassy(x, z) < 0.25 || nrm(x, z) < 0.85) continue;
			const h = r();
			dots.push({ x, y: H(x, z) + 0.22, z, s: 0.16 + r() * 0.08, c: h < 0.55 ? [1.0, 0.28, 0.68] : h < 0.85 ? [0.78, 0.25, 1.0] : [1.0, 0.75, 0.9] });
		}
	}
	for (let k = 0, n = 0; k < 400 && n < (isPhone ? 14 : 28); k++) {
		const a = r() * TAU, d = 120 + r() * plan.mist.rad * 0.8, cx = plan.centre.x + Math.sin(a) * d, cz = plan.centre.z + Math.cos(a) * d, h = H(cx, cz);
		if (h < plan.mist.top + 6 || h > plan.mist.top + 140 || nrm(cx, cz) < 0.6 || plan.villas.some((v) => Math.hypot(v.x - cx, v.z - cz) < 40)) continue;
		n++;
		for (let j = 0; j < 8; j++) {
			const x = cx + (r() - 0.5) * 30, z = cz + (r() - 0.5) * 30;
			dots.push({ x, y: H(x, z) + 1.2, z, s: 0.5 + r() * 0.3, c: r() < 0.7 ? [1.0, 0.78, 0.5] : S.winB });
		}
	}
	// the mountain's hamlets: lamps in clusters on its slopes over the cloud
	if (M) for (let k = 0, n = 0; k < 300 && n < (isPhone ? 9 : 18); k++) {
		const a = r() * TAU, d = M.r * (0.15 + r() * 0.9), cx = M.x + Math.sin(a) * d, cz = M.z + Math.cos(a) * d, h = H(cx, cz);
		if (h < M.y + 8 || h > M.h - 8) continue;
		n++;
		for (let j = 0; j < 7; j++) {
			const x = cx + (r() - 0.5) * 26, z = cz + (r() - 0.5) * 26;
			dots.push({ x, y: H(x, z) + 1.2, z, s: 0.6 + r() * 0.3, c: r() < 0.75 ? [1.0, 0.8, 0.52] : S.winB });
		}
	}
	const glow = createGlow(scene, shared, { streaks: X.streaks, dots, renderer: opts.renderer });
	// the contact shade
	const contactMat = contactMaterial();
	const contact = new THREE.Mesh(contactGeometry(H, X.contacts), contactMat);
	contact.renderOrder = 1; contact.name = 'arch:contact';
	group.add(contact);
	// the settlement's name as you come in, then each house and tower's
	const names = [{ name: plan.name, x: plan.centre.x, z: plan.centre.z, r: plan.mist.rad * 0.6, y: plan.mist.top, big: true }, ...sites.filter((s) => s.name !== 'Bridges').map((s) => ({ name: s.name, x: s.x, z: s.z, r: s.r + 20, y: s.y }))];
	const buildMs = performance.now() - t0;

	const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), tg = new THREE.Vector3(), mx = new THREE.Matrix4();
	const seen = new Set();
	let lookT = 0, inMist = 0;
	// dusk and blue hour here are the world's own (sky.js uDusk): magenta at the horizon, violet,
	// indigo overhead, the clouds lit pink from below, a crescent over the sunset; all of it
	// handed back as the sky was when the world goes
	const duskU = shared.uDuskSky || (shared.uDuskSky = { value: new THREE.Vector4(0, 1, 0, 0) });
	const moonU = shared.uDuskMoon || (shared.uDuskMoon = { value: new THREE.Vector4(0, 0.5, -0.85, 0) });
	function update(dt) {
		const cam = camera.position, cx = cam.x, cz = cam.z;
		const sy = shared.uSunDir.value.y, night = 1 - THREE.MathUtils.smoothstep(sy, -0.12, 0.1);
		U.uNight.value = night;
		U.uLampK.value = 0.6 + night * 1.8;
		{
			const k = 1 - THREE.MathUtils.smoothstep(sy, -0.03, 0.22), b = 0.3 + 0.7 * THREE.MathUtils.smoothstep(sy, -0.38, -0.06);
			duskU.value.set(k * 0.92, b, 0, 0);
			const sd = shared.uSunDir.value, a = Math.atan2(sd.x, sd.z) + 0.45;
			moonU.value.set(Math.sin(a) * 0.9, 0.42, Math.cos(a) * 0.9, k);
		}
		for (const G of sites) {
			const d = Math.hypot(cx - G.x, cz - G.z) - G.r, vis = d < G.far;
			if (G.g.visible !== vis) G.g.visible = vis;
			if (vis) for (const m of G.meshes) if (m.userData.near) m.visible = d < G.nearD;
		}
		const near = Math.hypot(cx - plan.centre.x, cz - plan.centre.z) < plan.mist.rad + 2200;
		lifts.visible = craftMesh.visible = near;
		In.update(dt, camera);
		inMist = mist.update(dt, camera, night, In.indoors());
		glow.update(night);
		if (!near) return;
		// the lifts: up, a wait at the top, down, a wait at the foot
		for (let i = 0; i < X.lifts.length; i++) {
			const L = X.lifts[i];
			if (L.wait > 0) L.wait -= dt;
			else {
				const run = L.y1 - L.y0, at = L.dir > 0 ? L.y - L.y0 : L.y1 - L.y, sp = 1.5 + Math.min(1, at / 12, (run - at) / 12) * 6;
				L.y += L.dir * Math.max(1.2, sp) * dt;
				if (L.y >= L.y1 || L.y <= L.y0) { L.y = Math.max(L.y0, Math.min(L.y1, L.y)); L.dir *= -1; L.wait = 6 + (i % 3) * 3; }
			}
			e.set(0, L.yaw, 0); q.setFromEuler(e);
			mx.compose(v.set(L.x, L.y, L.z), q, one); lifts.setMatrixAt(i, mx);
		}
		lifts.instanceMatrix.needsUpdate = true;
		// the craft round their loops, banking into the turns
		for (let i = 0; i < crafts.length; i++) {
			const C = crafts[i];
			C.u = (C.u + C.v * dt / C.len) % 1;
			C.curve.getPointAt(C.u, v);
			C.curve.getTangentAt(C.u, tg);
			const yaw = Math.atan2(tg.x, tg.z), pitch = -Math.asin(Math.max(-1, Math.min(1, tg.y)));
			C.curve.getTangentAt((C.u + 0.01) % 1, one);
			const turn = Math.atan2(one.x, one.z) - yaw, bank = Math.atan2(Math.sin(turn), Math.cos(turn)) * -6;
			one.set(1, 1, 1);
			e.set(pitch, yaw, Math.max(-0.5, Math.min(0.5, bank))); q.setFromEuler(e);
			mx.compose(v, q, one); craftMesh.setMatrixAt(i, mx);
		}
		craftMesh.instanceMatrix.needsUpdate = true;
		// arriving: the settlement's name, then each place's
		lookT += dt;
		if (lookT > 0.5 && opts.hint) {
			lookT = 0;
			for (const N of names) {
				if (seen.has(N.name)) continue;
				if (Math.hypot(cx - N.x, cz - N.z) < N.r && cam.y < N.y + (N.big ? 400 : 90)) {
					seen.add(N.name);
					opts.hint(N.big ? `${N.name}\n${profile.name.replace(/^\w/, (c) => c.toUpperCase())}` : `${N.name}\n${plan.name}`, 5000);
					break;
				}
			}
		}
	}
	// stand on a house's deck out over the drop (or a tower's roof), looking out
	// (or, given 'b:f', stand inside building b on its floor f; 'b:f:gallery' up on its gallery)
	function go(i = 0) {
		const Pl = opts.player?.();
		if (!Pl) return plan.name;
		if (typeof i === 'string' && i.includes(':')) {
			const [b, f, view] = i.split(':'), at = In.inside(+b, +f, view);
			Pl.flying = false; Pl.diving = false; Pl.vel?.set(0, 0, 0);
			Pl.pos.set(at.x, at.y + 1.7, at.z);
			Pl.yaw = at.yaw; Pl.pitch = at.pitch;
			camera.position.copy(Pl.pos);
			return at;
		}
		const all = [...plan.villas, ...plan.towers, ...(plan.shore ? [plan.shore] : [])];
		const o = all[((i | 0) % all.length + all.length) % all.length];
		const at = o.stand || { x: o.x + o.R * 0.3, y: o.roof, z: o.z, yaw: 0 };
		Pl.flying = false; Pl.diving = false; Pl.vel?.set(0, 0, 0);
		Pl.pos.set(at.x, at.y + 1.7, at.z);
		Pl.yaw = at.yaw; Pl.pitch = -0.08;
		camera.position.copy(Pl.pos);
		seen.add(o.name);
		opts.hint?.(`${o.name}\n${plan.name}`, 5000);
		return o.name;
	}
	function dispose() {
		duskU.value.set(0, 1, 0, 0);
		moonU.value.w = 0;
		envRT?.dispose();
		for (const m of [mats.shell, mats.glass, contactMat]) m.dispose();
		group.traverse((o) => o.geometry?.dispose());
		mist.dispose();
		glow.dispose();
		In.dispose();
		scene.remove(group);
	}
	const info = () => {
		let tris = 0, meshes = 0;
		group.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
		return {
			name: plan.name, centre: { x: Math.round(plan.centre.x), z: Math.round(plan.centre.z) },
			villas: plan.villas.map((q) => ({ name: q.name, kind: q.kind, y: Math.round(q.y), under: Math.round(q.under), stand: q.stand && { x: +q.stand.x.toFixed(1), y: +q.stand.y.toFixed(2), z: +q.stand.z.toFixed(1) } })),
			towers: plan.towers.map((T) => ({ name: T.name, base: Math.round(T.y), top: Math.round(T.roof || T.top), lobbies: T.lobbies.length })),
			bridges: plan.bridges.length, mist: { base: Math.round(plan.mist.base), top: Math.round(plan.mist.top), layers: mist.layers, wisps: mist.wisps, obstacles: Math.min(12, obs.length), inside: +inMist.toFixed(2) },
			lifts: X.lifts.length, craft: crafts.length, streaks: X.streaks.length, dots: dots.length, cities: (plan.cities || []).length, mountain: M ? { h: Math.round(M.h), cloud: Math.round(M.y), tower: !!M.tower } : null, bands: plan.mist.bands.map((b) => [Math.round(b.base), Math.round(b.top)]), interiors: In.info(), monolith: !!plan.monolith, shore: !!plan.shore, colliders: col.all.length, meshes, tris: Math.round(tris), planMs: plan.planMs, buildMs: Math.round(buildMs),
		};
	};
	const floor = (x, z, y) => Math.max(col.floor(x, z, y), In.floor(x, z, y));
	const push = (p, footY) => { col.push(p, footY); In.push(p, footY); };
	return { update, floor, push, go, dispose, info, group, plan, interiors: In };
}
