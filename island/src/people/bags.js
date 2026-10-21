// Bags people carry: backpacks, canvas totes, paper and plastic shopping bags, handbags and
// the little pouch on a crossbody strap. Each kind is made once (propkit.js) in two
// versions, near with its panels, seams, zips, pockets, handles and a hint of what is in
// it, and far as a plain shape, and everyone who carries one shares it; the colours are the
// material's. A backpack rides the upper back and a pouch the hip, carried rigidly by the
// spine's bones; a bag in the hand hangs from the fist under its own weight and swings a
// little as they walk. Shoulder straps are fitted to each body and dressed with the other
// small things (garment.js), clear of the clothes under them.

import * as THREE from 'three';
import { FAB, kit, rbox, reshape, outline, loft, ribbon, cord, prober, vnoise, kitMaterial, M4 } from './propkit.js';
import { smoothstep as smooth01 } from '../noise.js';

const V = THREE.Vector3;
const DARK = 0x1c1d20, WEB = 0x222326, METAL = 0xb9bcc0, GOLDEN = 0xc9a65a;
// near this, the detailed version (people who are this close are few)
export const BAG_NEAR = 22, BAG_FAR = 90;

// ---------- the backpack: y 0 (bottom) to H, the back panel at z = 0, the front at z = -D ----------
export const packSize = (slim) => (slim ? { W: 0.28, H: 0.4, D: 0.1 } : { W: 0.3, H: 0.44, D: 0.15 });
function backpack(slim, near) {
	const { W, H, D } = packSize(slim), K = kit();
	// the main compartment: narrower and shallower towards the top, the front panel full
	const body = reshape(rbox(W, H, D, slim ? 0.036 : 0.046, near ? 3 : 1), (x, y, z) => {
		const t = y / (H / 2), up = Math.max(0, t);
		const front = z < 0 ? 1 - 0.3 * up * up : 1;
		const bulge = z < -D * 0.2 ? 0.012 * (1 - (2 * x / W) ** 2) * (1 - t * t) : 0;
		return [x * (1 - 0.13 * up * up), y + H / 2, z * front - D / 2 - bulge];
	});
	// (its base a darker, tougher panel)
	K.add(body.clone(), { tint: 1, fab: FAB.nylon, gloss: 0.12, shade: (x, y) => (y < 0.045 ? 0.42 : 1) });
	// the front pocket, in the accent
	const pw = W * 0.74, ph = H * 0.36, pd = slim ? 0.035 : 0.05, py = H * 0.25;
	const pocket = reshape(rbox(pw, ph, pd, 0.016, near ? 2 : 0), (x, y, z) => [x * (1 - 0.06 * (y / ph + 0.5)), y + py, z - D - pd / 2 - (z < 0 ? 0.006 * (1 - (2 * x / pw) ** 2) : 0) + 0.008]);
	K.add(pocket.clone(), { tint: 2, fab: FAB.nylon, gloss: 0.12 });
	if (!near) return K.done();
	const onBody = prober(body), onPocket = prober(pocket);
	// the main zip, up one side, over the top and down the other, its coil dark
	const c = new V(0, H * 0.5, -D * 0.62), zip = [];
	for (let i = 0; i <= 30; i++) { const a = -1.45 + (i / 30) * 2.9, dir = new V(Math.sin(a), Math.cos(a), 0), h = onBody(c.clone().addScaledVector(dir, 0.6), dir.clone().negate(), 0.002); if (h) zip.push(h.p); }
	K.add(cord(zip, 0.0034, { seg: 30, radial: 4 }), { col: DARK, gloss: 0.35 });
	// the side seams: piping where the front panel meets the sides
	for (const zz of [-D * 0.18]) {
		const seam = [];
		for (let i = 0; i <= 26; i++) { const a = -1.5 + (i / 26) * 3, dir = new V(Math.sin(a), Math.cos(a), 0), h = onBody(new V(0, H * 0.5, zz).addScaledVector(dir, 0.6), dir.clone().negate(), 0.0015); if (h) seam.push(h.p); }
		K.add(cord(seam, 0.0026, { seg: 26, radial: 3 }), { tint: 1, gloss: 0.1, shade: () => 0.62 });
	}
	// the pocket's zip across its top
	const pz = [];
	for (let i = 0; i <= 10; i++) { const x = (i / 10 - 0.5) * pw * 0.82, h = onPocket(new V(x, py + ph * 0.36, -1), new V(0, 0, 1), 0.002); if (h) pz.push(h.p); }
	if (pz.length > 2) K.add(cord(pz, 0.003, { seg: 16, radial: 5 }), { col: DARK, gloss: 0.35 });
	// the pulls: a slider and a loop of cord hanging from it
	const pulls = [zip[7], zip[zip.length - 8], pz[pz.length - 2]].filter(Boolean);
	for (const p of pulls) {
		K.add(rbox(0.012, 0.009, 0.006, 0.002, 0), { col: METAL, gloss: 2, at: M4(p.x, p.y, p.z - 0.002) });
		K.add(cord([new V(p.x, p.y - 0.004, p.z - 0.004), new V(p.x - 0.004, p.y - 0.018, p.z - 0.006), new V(p.x, p.y - 0.03, p.z - 0.006), new V(p.x + 0.004, p.y - 0.018, p.z - 0.006), new V(p.x, p.y - 0.004, p.z - 0.004)], 0.0016, { seg: 10, radial: 4 }), { col: DARK, gloss: 0.2 });
	}
	// the grab handle on top: a loop of webbing
	const hp = [[-0.04, H - 0.015], [-0.032, H + 0.022], [0, H + 0.036], [0.032, H + 0.022], [0.04, H - 0.015]].map(([x, y]) => new V(x, y, -0.028));
	K.add(ribbon(hp, hp.map((p) => new V(p.x, p.y - (H - 0.02), 0).normalize()), 0.024, 0.004, { seg: 12, prof: 6 }), { col: WEB, fab: FAB.nylon, gloss: 0.15 });
	// compression straps across each side, with a buckle
	for (const s of [-1, 1]) {
		const pts = [];
		for (let i = 0; i <= 6; i++) { const h = onBody(new V(s * 0.6, H * 0.6, -0.012 - (i / 6) * (D - 0.03)), new V(-s, 0, 0), 0.002); if (h) pts.push(h.p); }
		if (pts.length < 3) continue;
		K.add(ribbon(pts, new V(s, 0, 0), 0.018, 0.0028, { seg: 8, prof: 4 }), { col: WEB, fab: FAB.nylon, gloss: 0.15 });
		const m = pts[Math.floor(pts.length / 2)];
		K.add(rbox(0.008, 0.026, 0.03, 0.003, 0), { col: DARK, gloss: 0.4, at: M4(m.x + s * 0.004, m.y, m.z) });
	}
	// padding on the back panel (seen from the side), and the tabs the shoulder straps come from
	for (const s of [-1, 1]) {
		K.add(rbox(W * 0.26, H * 0.6, 0.014, 0.006, 1), { col: 0x2b2d30, fab: FAB.nylon, at: M4(s * W * 0.19, H * 0.53, 0.001) });
		K.add(rbox(0.05, 0.03, 0.012, 0.004, 0), { col: WEB, fab: FAB.nylon, at: M4(s * 0.055, H - 0.035, 0.004) });
		K.add(rbox(0.03, 0.03, 0.012, 0.004, 0), { col: WEB, fab: FAB.nylon, at: M4(s * (W / 2 - 0.028), 0.03, -0.006) });
	}
	// a little leather lash tab on the pocket (no marks on it)
	const tab = onPocket(new V(0, py + ph * 0.05, -1), new V(0, 0, 1), 0.0015);
	if (tab) K.add(rbox(0.026, 0.026, 0.004, 0.004, 0), { col: 0x8a5a3a, fab: FAB.leather, gloss: 0.3, at: M4(tab.p.x, tab.p.y, tab.p.z, 0, 0, Math.PI / 4) });
	return K.done();
}

// ---------- bags in the hand: the grip at the origin, the bag hanging below it ----------
// rings round a soft body from its bottom up; shape(y, o) gives { hw, hd, rr } and push(y,
// point) a move along the outward normal
function softBody(ys, n, shape, push = () => 0, lift = () => 0) {
	return ys.map((y) => { const s = shape(y); return outline(s.hw, s.hd, s.rr ?? 0.01, n).map((o) => { const d = push(y, o, s); return [o.x + o.nx * d, y + lift(y, o, s), o.z + o.nz * d]; }); });
}
// handles that come up from the bag's mouth to the fist: one each side (z = +-)
function handles(K, ends, top, opt, mat) {
	for (const f of [1, -1]) {
		const [x0, z0] = ends, pts = [new V(-x0, top - 0.03, f * z0), new V(-x0 * 0.9, top + 0.025, f * z0 * 0.9), new V(-x0 * 0.4, -0.03, f * 0.012), new V(0, -0.004, f * 0.006), new V(x0 * 0.4, -0.03, f * 0.012), new V(x0 * 0.9, top + 0.025, f * z0 * 0.9), new V(x0, top - 0.03, f * z0)];
		const g = opt.round ? cord(pts, opt.r, { seg: opt.seg, radial: opt.radial, shade: opt.shade }) : ribbon(pts, new V(0, 0, f), opt.w, opt.t, { seg: opt.seg, prof: opt.prof });
		K.add(g, mat);
	}
}

// a canvas tote: flat, a soft gusset, the mouth sagging between its handles, a print
function tote(variant, near) {
	const K = kit(), top = -0.17, bot = -0.52, n = near ? 44 : 14;
	const ys = near ? [bot, bot + 0.02, bot + 0.06, -0.42, -0.36, -0.3, -0.25, top - 0.03, top - 0.026, top - 0.022, top] : [bot, -0.34, top];
	const hd = (y) => 0.045 - 0.025 * smooth01(bot, top, y);
	const rings = softBody(ys, n, (y) => ({ hw: 0.18 - 0.008 * smooth01(bot, top, y), hd: hd(y), rr: Math.min(0.02, hd(y) - 0.002) }),
		(y, o) => (o.side === 0 || o.side === 2 ? 0.0035 * Math.sin(o.x * 42 + o.side) * smooth01(-0.42, top, y) : 0),
		(y, o) => (y > top - 0.04 ? -0.016 * (1 - (o.x / 0.18) ** 2) * ((y - (top - 0.04)) / 0.04) : 0));
	K.add(loft(rings), { tint: 1, fab: FAB.canvas, shade: (x, y) => (Math.abs(y - (top - 0.026)) < 0.002 && near ? 0.7 : 1) });
	handles(K, [0.075, 0.022], top, near ? { w: 0.026, t: 0.003, seg: 18, prof: 6 } : { w: 0.026, t: 0.003, seg: 6, prof: 4 }, { tint: 1, fab: FAB.canvas, shade: () => 0.94 });
	if (!near) return K.done();
	// the print: an abstract mark in the accent, on the front
	const z = hd(-0.34) + 0.0012;
	if (variant % 2 === 0) K.add(new THREE.CircleGeometry(0.058, 24), { tint: 2, fab: FAB.canvas, at: M4(0.01, -0.33, z) });
	else for (let i = 0; i < 3; i++) K.add(new THREE.PlaneGeometry(0.2, 0.018), { tint: 2, fab: FAB.canvas, at: M4(0, -0.3 - i * 0.034, z) });
	// what is in it, peeking out of the mouth
	if (variant < 2) K.add(rbox(0.15, 0.21, 0.022, 0.003, 1), { col: [0x6b3b2e, 0x2f4a5c][variant], fab: FAB.paper, gloss: 0.2, at: M4(-0.05, top - 0.07, 0, 0, 0, 0.25) });
	else for (let i = 0; i < 4; i++) K.add(reshape(new THREE.SphereGeometry(0.04, 8, 6), (x, y, zz) => [x * (1 + vnoise(x * 60, y * 60, i) * 0.4), y * 0.8, zz]), { col: 0x4f7a34, at: M4(-0.06 + i * 0.035, top - 0.01 + (i % 2) * 0.015, (i % 2 - 0.5) * 0.01) });
	return K.done();
}

// a paper shopping bag: crisp sides, the gussets folded in at the top, a turned-down cuff,
// twisted paper handles; what was bought showing at the top
function paperBag(fill, near) {
	const K = kit(), top = -0.15, bot = -0.5, hw = 0.16, hd = 0.08, n = near ? 56 : 16;
	const ys = near ? [bot, bot + 0.012, bot + hd - 0.004, bot + hd, bot + hd + 0.004, -0.34, -0.28, -0.23, -0.2, top - 0.045, top] : [bot, top];
	const rings = softBody(ys, n, () => ({ hw, hd, rr: 0.004 }), (y, o) => {
		// the gussets folded in, more towards the mouth; the crease where it was folded flat
		const g = o.side === 1 || o.side === 3 ? -(0.008 + 0.022 * smooth01(top - 0.16, top, y)) * Math.max(0, 1 - Math.abs(o.z) / hd) : 0;
		const crease = o.side === 0 || o.side === 2 ? -0.0025 * Math.exp(-(((y - (bot + hd)) / 0.004) ** 2)) : 0;
		return g + crease + (near ? (vnoise(o.x * 30, y * 30, o.side) - 0.5) * 0.003 : 0);
	});
	K.add(loft(rings), { tint: 1, fab: FAB.paper, gloss: 0.08 });
	// the cuff: the top turned down inside and out
	if (near) {
		const cuff = softBody([top - 0.046, top - 0.044, top], n, () => ({ hw: hw + 0.0025, hd: hd + 0.0025, rr: 0.005 }), (y, o) => (o.side === 1 || o.side === 3 ? -0.028 * smooth01(top - 0.16, top, y) * Math.max(0, 1 - Math.abs(o.z) / hd) : 0));
		K.add(loft(cuff, { bottom: false }), { tint: 1, fab: FAB.paper, gloss: 0.08, shade: (x, y) => (y < top - 0.043 ? 0.72 : 0.96) });
	}
	handles(K, [0.055, hd - 0.006], top, { round: true, r: 0.0036, seg: near ? 28 : 6, radial: near ? 6 : 3, shade: near ? (t, j) => 0.86 + 0.14 * Math.sin((t * 70 + j * 6.283) * 1.0) : null }, { tint: 1, fab: FAB.paper, shade: () => 0.88 });
	if (!near) return K.done();
	if (fill === 0) {
		// a long loaf, scored, and greens
		const loaf = reshape(new THREE.CapsuleGeometry(0.03, 0.28, 6, 10), (x, y, z) => [x, y, z * 0.85]);
		K.add(loaf, { col: 0xc58b45, gloss: 0.15, shade: (x, y) => 0.8 + 0.2 * Math.abs(Math.sin(y * 70)), at: M4(-0.07, top - 0.02, 0.02, 0, 0, 0.35) });
		for (let i = 0; i < 5; i++) K.add(reshape(new THREE.SphereGeometry(0.035, 8, 6), (x, y, z) => [x * (1 + (vnoise(x * 70, y * 70, i) - 0.5) * 0.6), y * 0.7, z]), { col: i % 2 ? 0x5d8a3a : 0x3f6d2c, at: M4(0.02 + i * 0.022, top + 0.01 + (i % 3) * 0.012, -0.02 + (i % 2) * 0.03) });
	} else if (fill === 1) {
		// a plain carton and a bottle's neck
		K.add(rbox(0.14, 0.2, 0.06, 0.004, 1), { col: 0xd9c9a3, fab: FAB.paper, at: M4(-0.05, top - 0.06, 0.01, 0, 0.2, 0) });
		K.add(new THREE.CylinderGeometry(0.012, 0.03, 0.12, 12), { col: 0x2f5a3a, gloss: 0.8, at: M4(0.07, top - 0.01, -0.02) });
		K.add(new THREE.CylinderGeometry(0.013, 0.013, 0.02, 10), { col: GOLDEN, gloss: 2, at: M4(0.07, top + 0.06, -0.02) });
	} else {
		// tissue paper, crumpled up out of the mouth
		for (let i = 0; i < 6; i++) K.add(reshape(new THREE.IcosahedronGeometry(0.045, 1), (x, y, z) => { const k = 0.75 + vnoise(x * 50 + i, y * 50, z * 50) * 0.5; return [x * k, y * k * 1.2, z * k * 0.7]; }), { col: 0xf3efe8, fab: FAB.paper, at: M4(-0.1 + i * 0.04, top + 0.015 + (i % 2) * 0.02, (i % 3 - 1) * 0.02, i, i * 2, 0) });
	}
	return K.done();
}

// a plastic carrier bag: thin, lumpy with what is in it, gathered up into its two loops
function plasticBag(near) {
	const K = kit(), top = -0.17, bot = -0.46, n = near ? 40 : 14;
	const ys = near ? [bot, bot + 0.01, -0.43, -0.39, -0.35, -0.31, -0.27, -0.23, -0.2, top] : [bot, -0.33, top];
	const rings = softBody(ys, n, (y) => {
		const t = (y - bot) / (top - bot), belly = Math.sin(Math.min(1, t * 1.2) * Math.PI);
		return { hw: 0.15 + 0.012 * belly - 0.05 * smooth01(0.7, 1, t), hd: 0.03 + 0.055 * belly - 0.02 * smooth01(0.75, 1, t), rr: 0.025 };
	}, (y, o) => {
		const t = (y - bot) / (top - bot);
		return near ? (vnoise(o.x * 18 + o.side, y * 16, o.z * 18) - 0.5) * 0.022 * Math.sin(Math.min(1, t * 1.3) * Math.PI) + 0.003 * Math.sin(o.x * 160) * smooth01(0.6, 1, t) : 0;
	});
	const shade = (x, y) => 0.9 + 0.1 * smooth01(-0.3, top, y);
	K.add(loft(rings), { tint: 1, fab: FAB.plastic, gloss: 0.45, shade });
	// the loops: each from a front corner up through the fist and down to the back one
	for (const s of [-1, 1]) {
		const pts = [new V(s * 0.085, top - 0.012, 0.02), new V(s * 0.06, top + 0.06, 0.016), new V(s * 0.012, -0.012, 0.006), new V(s * 0.006, 0.004, 0), new V(s * 0.012, -0.012, -0.006), new V(s * 0.06, top + 0.06, -0.016), new V(s * 0.085, top - 0.012, -0.02)];
		K.add(ribbon(pts, new V(s, 0, 0), (t) => 0.034 - 0.022 * Math.sin(t * Math.PI), 0.0016, { seg: near ? 20 : 6, prof: 4 }), { tint: 1, fab: FAB.plastic, gloss: 0.45, shade: () => 1.02 });
	}
	return K.done();
}

// a structured leather handbag: wider at the base, a flap with a clasp over the front,
// two rolled handles on rings; stitched edges; little metal feet
export const HANDBAG = { W: 0.3, H: 0.22, D: 0.11 };
function handbag(near, small = false) {
	const K = kit(), k = small ? 0.62 : 1, W = HANDBAG.W * k, H = HANDBAG.H * k, D = HANDBAG.D * k, top = small ? 0 : -0.12, y0 = top - H;
	const body = reshape(rbox(W, H, D, 0.022 * k, near ? 2 : 1), (x, y, z) => { const t = y / H + 0.5; return [x * (1 - 0.16 * t), y + y0 + H / 2, z * (1 - 0.25 * t)]; });
	K.add(body.clone(), { tint: 1, fab: FAB.leather, gloss: 0.45 });
	// the flap: over the top and down the front, a little proud of it
	const flapRows = near ? 12 : 3, cols = near ? 12 : 3, fw = W * 0.86 * (1 - 0.16), pos = [], idx = [];
	const frontAt = (y) => (D / 2) * (1 - 0.25 * ((y - y0) / H)) + 0.004, zt = frontAt(top), back = -zt * 0.6, drop = H * 0.42;
	const L1 = zt - back, L2 = drop, R = 0.012 * k;
	for (let i = 0; i <= flapRows; i++) {
		// from the back of the top, forward over it, round the front edge and down the front
		const s = (i / flapRows) * (L1 + L2);
		let yy, zz;
		if (s < L1 - R) { yy = top + 0.004; zz = back + s; }
		else if (s < L1 - R + (Math.PI / 2) * R) { const a = (s - (L1 - R)) / R; yy = top + 0.004 - R + Math.cos(a) * R; zz = zt - R + Math.sin(a) * R; }
		else { yy = top + 0.004 - R - (s - (L1 - R + (Math.PI / 2) * R)); zz = frontAt(yy); }
		const v = s / (L1 + L2);
		for (let j = 0; j <= cols; j++) { const u = j / cols - 0.5, w = fw * (v > 0.82 ? 1 - (v - 0.82) * 0.9 : 1); pos.push(u * w, yy, zz); }
	}
	for (let i = 0; i < flapRows; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
	const flap = new THREE.BufferGeometry(); flap.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); flap.setIndex(idx); flap.computeVertexNormals();
	K.add(flap, { tint: 1, fab: FAB.leather, gloss: 0.5, shade: () => 0.92 });
	const fy = top - drop + 0.006, fz = frontAt(fy) + 0.003;
	// the clasp
	K.add(rbox(0.03 * k, 0.018 * k, 0.008, 0.003, near ? 1 : 0), { col: GOLDEN, gloss: 2, at: M4(0, fy, fz) });
	if (near) {
		// the stitched edge of the flap, and down the sides
		const edge = [];
		for (let j = 0; j <= 12; j++) edge.push(new V((j / 12 - 0.5) * fw * 0.84, top - drop - 0.003, frontAt(top - drop) + 0.002));
		K.add(cord(edge, 0.0018, { seg: 24, radial: 4, shade: (t) => (Math.floor(t * 60) % 2 ? 1 : 0.7) }), { tint: 1, gloss: 0.4, shade: () => 0.8 });
		for (const s of [-1, 1]) {
			const side = [];
			for (let i = 0; i <= 6; i++) { const y = y0 + 0.01 + (i / 6) * (H - 0.02), t = (y - y0) / H; side.push(new V(s * (W / 2) * (1 - 0.16 * t), y, D / 2 * (1 - 0.25 * t) - 0.004)); }
			K.add(cord(side, 0.0016, { seg: 12, radial: 4, shade: (t) => (Math.floor(t * 30) % 2 ? 1 : 0.72) }), { tint: 1, gloss: 0.4, shade: () => 0.8 });
		}
		for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.add(new THREE.SphereGeometry(0.006, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), { col: GOLDEN, gloss: 2, at: M4(x * W * 0.36, y0, z * D * 0.32) });
	}
	if (small) {
		// rings at the top corners for the strap
		if (near) for (const s of [-1, 1]) K.add(new THREE.TorusGeometry(0.008, 0.0016, 4, 12), { col: GOLDEN, gloss: 2, at: M4(s * (W / 2 - 0.004) * 0.84, top + 0.004, 0, 0, Math.PI / 2, 0) });
		return K.done();
	}
	// rolled handles from rings on the top, up to the fist
	for (const f of [1, -1]) {
		const zt = f * D * 0.3 * 0.75, xs = 0.065;
		if (near) for (const s of [-1, 1]) K.add(new THREE.TorusGeometry(0.009, 0.0018, 4, 12), { col: GOLDEN, gloss: 2, at: M4(s * xs, top + 0.006, zt, 0, Math.PI / 2, 0) });
		const pts = [new V(-xs, top + 0.012, zt), new V(-xs * 0.85, top + 0.07, zt * 0.7), new V(-0.02, -0.02, f * 0.008), new V(0, -0.005, f * 0.005), new V(0.02, -0.02, f * 0.008), new V(xs * 0.85, top + 0.07, zt * 0.7), new V(xs, top + 0.012, zt)];
		K.add(cord(pts, 0.0062, { seg: near ? 24 : 6, radial: near ? 8 : 4 }), { tint: 1, fab: FAB.leather, gloss: 0.5, shade: () => 0.85 });
	}
	return K.done();
}

// ---------- a guitar's gig bag: y 0 (the bottom) to H, the back panel at z = 0, the front at -D ----------
export const CASE = { H: 1.02, D: 0.12 };
// its half-width up the case: the lower bout, the waist, the upper bout, the neck, the head
const CASE_W = [[0, 0.1], [0.025, 0.16], [0.07, 0.195], [0.17, 0.212], [0.29, 0.192], [0.39, 0.152], [0.46, 0.16], [0.54, 0.163], [0.61, 0.13], [0.665, 0.07], [0.7, 0.06], [0.88, 0.058], [0.91, 0.074], [0.99, 0.07], [1.02, 0.04]];
const caseW = (y) => { for (let i = 1; i < CASE_W.length; i++) if (y <= CASE_W[i][0]) { const [y0, w0] = CASE_W[i - 1], [y1, w1] = CASE_W[i], t = (y - y0) / (y1 - y0); return w0 + (w1 - w0) * (t * t * (3 - 2 * t)); } return 0.04; };
const caseD = (y) => (y < 0.62 ? 0.06 : y < 0.68 ? 0.06 - (y - 0.62) * 0.33 : 0.04);
function guitarCase(near) {
	const K = kit(), n = near ? 36 : 12, ys = [];
	// (closer together at the rounded ends)
	for (let i = 0, m = near ? 40 : 12; i <= m; i++) ys.push(CASE.H * (0.5 - 0.5 * Math.cos(Math.PI * i / m)));
	// padded nylon, a little sheen; its front a touch fuller than its back
	const rings = ys.map((y) => { const hw = caseW(y), hd = caseD(y); return outline(hw, hd, Math.min(hw, hd) * 0.92, n).map((o) => [o.x, y, (o.z < 0 ? o.z * 1.06 : o.z) - hd]); });
	const body = loft(rings, { bottom: true, top: true });
	K.add(body, { tint: 1, fab: FAB.nylon, gloss: 0.3, shade: (x, y) => (y < 0.02 ? 0.5 : 1) });
	if (!near) return K.done();
	// the zip round the edge, halfway through it, up one side, over the head and down the other
	const zip = [];
	for (let i = 0; i <= 48; i++) { const u = i / 48, y = 0.03 + (CASE.H - 0.06) * (u < 0.5 ? u * 2 : 2 - u * 2), sx = u < 0.5 ? 1 : -1; zip.push(new V(sx * (caseW(y) + 0.002), y, -caseD(y))); }
	zip.splice(24, 1, new V(0, CASE.H + 0.001, -caseD(CASE.H)));
	K.add(cord(zip, 0.0045, { seg: 96, radial: 4, shade: (t) => (Math.floor(t * 300) % 2 ? 1 : 0.75) }), { col: 0x5a5d62, gloss: 0.8 });
	// its puller, at the head
	K.add(rbox(0.012, 0.035, 0.004, 0.002, 0), { col: METAL, gloss: 1.5, at: M4(0.045, CASE.H - 0.06, -caseD(0.9) * 2 - 0.004) });
	// the front pocket on the lower bout, in the accent, and its zip
	const pw = 0.26, ph = 0.2, pd = 0.025;
	K.add(reshape(rbox(pw, ph, pd, 0.02, 2), (x, y, z) => [x * (1 - 0.12 * (y / ph + 0.5)), y + 0.2, z - 0.12 - pd / 2 + 0.006]), { tint: 2, fab: FAB.nylon, gloss: 0.25 });
	K.add(cord([new V(-pw * 0.42, 0.285, -0.14), new V(0, 0.288, -0.142), new V(pw * 0.42, 0.285, -0.14)], 0.003, { seg: 12, radial: 4 }), { col: 0x5a5d62, gloss: 0.8 });
	// the carry handle on the side, at the waist
	K.add(cord([new V(0.15, 0.36, -0.06), new V(0.178, 0.38, -0.06), new V(0.185, 0.42, -0.06), new V(0.178, 0.46, -0.06), new V(0.153, 0.48, -0.06)], 0.009, { seg: 12, radial: 6 }), { col: DARK, fab: FAB.nylon, gloss: 0.2 });
	// the strap's rings, at the neck and the bottom
	for (const [x, y] of [[0.06, 0.74], [-0.17, 0.1]]) K.add(new THREE.TorusGeometry(0.012, 0.0025, 4, 12), { col: METAL, gloss: 1.5, at: M4(x, y, -0.06, 0, Math.PI / 2, 0) });
	return K.done();
}

// ---------- made once, shared ----------
const made = new Map();
export function bagGeometry(kind, v = 0, near = true) {
	const key = `${kind}:${v}:${near ? 1 : 0}`;
	let g = made.get(key);
	if (!g) {
		g = kind === 'backpack' ? backpack(!!v, near) : kind === 'tote' ? tote(v % 3, near) : kind === 'paper' ? paperBag(v % 3, near) : kind === 'plastic' ? plasticBag(near) : kind === 'pouch' ? handbag(near, true) : kind === 'guitar' ? guitarCase(near) : handbag(near);
		made.set(key, g);
	}
	return g;
}
// which shared bag an accessory is: { kind, v }
export function bagOf(q) {
	if (q.kind === 'backpack') return { kind: 'backpack', v: q.slim ? 1 : 0 };
	if (q.kind === 'tote') return { kind: 'tote', v: q.v ?? (parseInt(String(q.acc || '0').replace('#', ''), 16) || 0) % 3 };
	if (q.kind === 'shopper') return { kind: q.paper ? 'paper' : 'plastic', v: q.fill || 0 };
	if (q.kind === 'handbag') return { kind: 'handbag', v: 0 };
	if (q.kind === 'crossbody') return { kind: 'pouch', v: 0 };
	if (q.kind === 'guitar') return { kind: 'guitar', v: 0 };
	return null;
}
export const BAG_KINDS = new Set(['backpack', 'tote', 'shopper', 'handbag', 'crossbody', 'guitar']);

// ---------- fitted to a body ----------
// the torso's surface (skin and clothes, not the arms) as flat arrays, for straps to rest on
export function torsoSurface(A, p, cloth, bones, part, cut) {
	const xs = [], ys = [], zs = [], y0 = cut.waist - 0.15, y1 = cut.shoulder + 0.12;
	const keep = (x, y) => y > y0 && y < y1 && Math.abs(x) < cut.shoulderX + 0.08;
	const n = Math.min(p.length / 3, part.length);
	for (let i = 0; i < n; i++) { const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; if (part[i] === 0 && keep(x, y)) { xs.push(x); ys.push(y); zs.push(z); } }
	if (cloth) {
		const pa = cloth.attributes.position, si = cloth.attributes.skinIndex, sw = cloth.attributes.skinWeight;
		const arm = bones.map((b) => /arm|wrist|finger|metacarpal|hand/.test(b.name));
		for (let i = 0; i < pa.count; i++) {
			let best = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
			if (arm[best]) continue;
			const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); if (keep(x, y)) { xs.push(x); ys.push(y); zs.push(z); }
		}
	}
	return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), zs: Float32Array.from(zs) };
}
// how far along n the surface comes near the line through q (within r of it), or -Infinity
function reach(S, q, n, r = 0.03) {
	let best = -Infinity; const r2 = r * r;
	for (let i = 0; i < S.xs.length; i++) {
		const dx = S.xs[i] - q.x, dy = S.ys[i] - q.y, dz = S.zs[i] - q.z, a = dx * n.x + dy * n.y + dz * n.z;
		if (a > best && dx * dx + dy * dy + dz * dz - a * a < r2) best = a;
	}
	return best;
}
// a strap's line laid on the body: sampled, each point brought to rest `clear` off the
// surface along its outward direction (out(p)), the ends where they are given
function lay(S, ctrl, out, clear, n = 18) {
	const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal'), pts = [], ups = [];
	for (let i = 0; i <= n; i++) {
		const p = curve.getPointAt(i / n), u = out(p), end = Math.min(i, n - i) / 3;
		const b = reach(S, p, u);
		if (b > -0.08) p.addScaledVector(u, (b + clear) * Math.min(1, end));
		pts.push(p); ups.push(u);
	}
	// (smoothed, and lifted once more where smoothing let it sink)
	for (let i = 1; i < n; i++) pts[i] = pts[i - 1].clone().add(pts[i + 1]).multiplyScalar(0.25).addScaledVector(pts[i], 0.5);
	for (let i = 2; i < n - 1; i++) { const b = reach(S, pts[i], ups[i]); if (b > -clear) pts[i].addScaledVector(ups[i], b + clear); }
	return { pts, ups };
}

// where each bag goes on this body, and its straps: [{ q, bag, bone | hand, M, straps: [{ geo, bone(y), col, gloss, fab }] }]
export function fitBags(o, cut, S, heldTorso) {
	const out = [], k = Math.min(1.05, Math.max(0.62, cut.height / 1.72)), midZ = (cut.backZ + cut.frontZ) / 2;
	const back = heldTorso?.back ?? cut.backZ, front = heldTorso?.front ?? cut.frontZ;
	const outward = (p) => new V(p.x, Math.max(0, p.y - (cut.shoulder - 0.07)) * 7, p.z - midZ).normalize();
	const spine = (y) => (y > cut.chest - 0.12 ? 'spine01' : y > cut.waist + 0.02 ? 'spine02' : 'spine04');
	for (const q of o.acc || []) {
		const bag = bagOf(q);
		if (!bag) continue;
		const strapCol = q.acc && q.kind === 'backpack' ? q.col : '#1b1b1d';
		if (q.kind === 'backpack') {
			const { W, H } = packSize(!!q.slim), sw = Math.min(1.08, Math.max(0.7, cut.shoulderX / 0.165)) * k, sh = k;
			const yb = cut.chest - 0.08 - (H * sh) / 2, tilt = 0.07;
			// the back panel just clear of the back, wherever it is furthest out behind
			let zb = back - 0.02;
			if (S) for (let i = 0; i < S.xs.length; i++) if (Math.abs(S.xs[i]) < (W * sw) / 2 && S.ys[i] > yb && S.ys[i] < yb + H * sh) zb = Math.min(zb, S.zs[i] + tilt * (S.ys[i] - yb) - 0.018);
			const M = new THREE.Matrix4().makeTranslation(0, yb, zb).multiply(new THREE.Matrix4().makeRotationX(-tilt)).multiply(new THREE.Matrix4().makeScale(sw, sh, sh));
			const straps = [];
			if (S) for (const s of [-1, 1]) {
				const a0 = new V(s * 0.055, H - 0.035, 0.008).applyMatrix4(M), a1 = new V(s * (W / 2 - 0.028), 0.035, -0.004).applyMatrix4(M);
				const sx = (x) => s * x * Math.min(1.1, cut.shoulderX / 0.165);
				const top = [a0, new V(sx(0.072), cut.shoulder + 0.01, back + 0.03), new V(sx(0.09), cut.shoulder + 0.035, midZ), new V(sx(0.1), cut.chest + 0.06, front), new V(sx(0.11), cut.chest - 0.06, front)];
				const A1 = lay(S, top, outward, 0.008);
				const buckle = A1.pts[A1.pts.length - 1];
				const low = [buckle, new V(sx(0.14), cut.chest - 0.13, midZ + (front - midZ) * 0.6), new V(s * cut.shoulderX * 0.86, cut.chest - 0.17, midZ), a1];
				const A2 = lay(S, low, outward, 0.003);
				straps.push({ geo: ribbon(A1.pts, A1.ups, (t) => 0.05 + 0.012 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) - 0.014 * t, (t) => 0.006 + 0.008 * Math.sin(Math.min(1, t * 1.4) * Math.PI / 2), { seg: 20, prof: 8 }), bone: spine, col: strapCol, fab: 1 });
				straps.push({ geo: ribbon(A2.pts, A2.ups, 0.024, 0.003, { seg: 12, prof: 4 }), bone: spine, col: '#1b1b1d', fab: 1 });
				straps.push({ geo: rbox(0.034, 0.03, 0.008, 0.003, 1).applyMatrix4(new THREE.Matrix4().lookAt(new V(), A1.ups.at(-1), new V(0, 1, 0)).setPosition(buckle.clone().addScaledVector(A1.ups.at(-1), 0.004))), bone: spine, col: '#141416', gloss: 0.4 });
			}
			// the sternum strap across the chest, and its clip
			if (S && !q.slim) {
				const y = cut.chest + 0.03, l = [new V(-0.095, y, front), new V(0, y, front + 0.02), new V(0.095, y, front)];
				const C = lay(S, l, (p) => new V(p.x * 0.4, 0, 1).normalize(), 0.012, 8);
				straps.push({ geo: ribbon(C.pts, C.ups, 0.016, 0.003, { seg: 8, prof: 4 }), bone: spine, col: '#1b1b1d', fab: 1 });
				straps.push({ geo: rbox(0.03, 0.02, 0.008, 0.003, 1).translate(C.pts[4].x, C.pts[4].y, C.pts[4].z + 0.004), bone: spine, col: '#141416', gloss: 0.4 });
			}
			out.push({ q, bag, bone: 'spine01', M, straps });
		} else if (q.kind === 'crossbody') {
			// the pouch on the left hip, in front; the strap over the right shoulder, round both ways
			const sk = q.small ? 0.82 : 1, x = 0.1, y = cut.waist - 0.04;
			let zf = front - 0.02;
			if (S) { const b = reach(S, new V(x, y - 0.06, midZ), new V(0.35, 0, 1).normalize(), 0.05); if (b > -1) zf = midZ + b * 0.94 + 0.004; }
			const M = new THREE.Matrix4().makeTranslation(x, y, zf + HANDBAG.D * 0.62 * 0.5 * sk).multiply(new THREE.Matrix4().makeRotationY(0.35)).multiply(new THREE.Matrix4().makeScale(sk, sk, sk));
			const ringR = new V(-0.075, 0.004, 0).applyMatrix4(M), ringL = new V(0.075, 0.004, 0).applyMatrix4(M), sx = cut.shoulderX;
			const straps = [];
			if (S) {
				const shoulder = new V(-sx * 0.55, cut.shoulder + 0.04, midZ);
				const F = lay(S, [ringR, new V(-0.04, cut.chest - 0.08, front), new V(-sx * 0.42, cut.chest + 0.05, front - 0.01), shoulder], outward, 0.004, 16);
				const B = lay(S, [shoulder, new V(-sx * 0.35, cut.chest + 0.02, back), new V(0.04, cut.chest - 0.12, back), new V(sx * 0.82, cut.waist + 0.06, midZ), ringL], outward, 0.004, 18);
				const pts = [...F.pts, ...B.pts.slice(1)], ups = [...F.ups, ...B.ups.slice(1)];
				straps.push({ geo: ribbon(pts, ups, 0.026, 0.003, { seg: 40, prof: 4 }), bone: spine, col: '#1b1b1d', fab: 1 });
			}
			out.push({ q, bag, bone: 'spine04', M, straps });
		} else if (q.kind === 'guitar') {
			// the gig bag slung on the back, its neck up past the left shoulder; one strap from the
			// neck over that shoulder, across the chest and round the right side to its foot
			// (leant to rest on the shoulder blades and the seat both: the furthest the body comes
			// out behind, high and low, under where it hangs)
			const tilt = -0.22, y0 = cut.waist - 0.36 * k, x0 = -0.05, yU = cut.chest, yL = cut.waist - 0.15;
			let zU = back, zL = back;
			if (S) for (let i = 0; i < S.xs.length; i++) if (Math.abs(S.xs[i] - 0.03) < 0.15) {
				if (S.ys[i] > yU - 0.12 && S.ys[i] < cut.shoulder - 0.02) zU = Math.min(zU, S.zs[i]);
				else if (S.ys[i] > yL - 0.14 && S.ys[i] < cut.waist) zL = Math.min(zL, S.zs[i]);
			}
			const lean = Math.atan2(zU - zL, yU - yL), zb = zL - 0.012 + Math.tan(lean) * (y0 - yL);
			const M = new THREE.Matrix4().makeTranslation(x0, y0, zb).multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(new THREE.Matrix4().makeRotationX(lean)).multiply(new THREE.Matrix4().makeScale(k, k, k));
			const top = new V(0.06, 0.74, -0.06).applyMatrix4(M), foot = new V(-0.17, 0.1, -0.06).applyMatrix4(M), sx = cut.shoulderX;
			const straps = [];
			if (S) {
				const shoulder = new V(sx * 0.55, cut.shoulder + 0.04, midZ);
				const B = lay(S, [top, new V(sx * 0.5, cut.chest + 0.04, back - 0.01), shoulder], outward, 0.006, 10);
				const F = lay(S, [shoulder, new V(sx * 0.4, cut.chest + 0.05, front), new V(-0.04, cut.chest - 0.1, front), new V(-sx * 0.86, cut.waist + 0.02, midZ), new V(-sx * 0.55, cut.waist - 0.04, back - 0.02), foot], outward, 0.006, 22);
				const pts = [...B.pts, ...F.pts.slice(1)], ups = [...B.ups, ...F.ups.slice(1)];
				straps.push({ geo: ribbon(pts, ups, 0.038, 0.004, { seg: 48, prof: 4 }), bone: spine, col: '#1b1b1d', fab: 1 });
			}
			out.push({ q, bag, bone: 'spine02', M, straps });
		} else out.push({ q, bag, hand: 'L', k: q.kind === 'tote' || q.kind === 'shopper' ? Math.max(0.85, k) : k, straps: [] });
	}
	return out;
}

// ---------- on the body ----------
const xAxis = new V(1, 0, 0), yAxis = new V(0, 1, 0), zAxis = new V(0, 0, 1), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), sc = new V(), g = new V();
// a shared bag carried rigidly by a bone (placed at M in the body's rest space), or hanging
// from a fist; .lod(distance) picks near or far and hides it past BAG_FAR
export function attachBag(P, fit, isPhone = false) {
	const near = bagGeometry(fit.bag.kind, fit.bag.v, true), far = bagGeometry(fit.bag.kind, fit.bag.v, false);
	const q = fit.q, mat = kitMaterial(q.col || '#3a3d42', q.acc || q.col || '#3a3d42');
	const mesh = new THREE.Mesh(near, mat);
	mesh.matrixAutoUpdate = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'bag:' + fit.bag.kind;
	const nearD = isPhone ? BAG_NEAR * 0.7 : BAG_NEAR;
	// (one held in a hand is set down while they sit at work: P.bagsDown, people/workplace-life.js)
	const lod = (d) => { const want = d < nearD ? near : far; if (mesh.geometry !== want) mesh.geometry = want; const v = d < BAG_FAR && !(P.bagsDown && !fit.bone); if (mesh.visible !== v) mesh.visible = v; mesh.castShadow = d < nearD; };
	// (a body without its skeleton, a stand-in: the bag simply at its side)
	if (!P.map || !P.bones) { mesh.matrixAutoUpdate = true; mesh.position.set(fit.hand === 'R' ? -0.3 : 0.3, 0.8, 0.05); P.root?.add?.(mesh); return { mesh, fit, lod, remove() { mesh.removeFromParent(); } }; }
	let place;
	if (fit.bone) {
		const i = P.map[fit.bone], bone = P.bones[i], L = new THREE.Matrix4().multiplyMatrices(P.skeleton.boneInverses[i], fit.M);
		place = () => mesh.matrixWorld.multiplyMatrices(bone.matrixWorld, L);
	} else {
		// the grip in the fist, in the wrist bone's own space; the bag hangs straight down from
		// it, facing the way they face, and swings (a damped pendulum driven by the hand)
		const side = fit.hand, i = P.map['wrist.' + side], bone = P.bones[i], rest = P.rest;
		const grip = rest.heads[i].clone().addScaledVector(rest.dirs[i], 0.07 * fit.k).applyMatrix4(P.skeleton.boneInverses[i]);
		const S = { t: performance.now(), p: null, v: new V(), sx: 0, sz: 0, wx: 0, wz: 0 }, k = fit.k;
		place = () => {
			g.copy(grip).applyMatrix4(bone.matrixWorld);
			const now = performance.now(), dt = Math.min(0.05, Math.max(0.001, (now - S.t) / 1000)), r = P.root.matrixWorld.elements;
			S.t = now;
			const yaw = Math.atan2(r[8], r[10]);
			if (S.p) {
				const vx = (g.x - S.p.x) / dt, vz = (g.z - S.p.z) / dt, ax = (vx - S.v.x) / dt, az = (vz - S.v.z) / dt;
				S.v.set(vx, 0, vz);
				// the hand's pull, in the body's own frame: forward tips it back, sideways out
				const fwd = ax * Math.sin(yaw) + az * Math.cos(yaw), lat = ax * Math.cos(yaw) - az * Math.sin(yaw);
				const tx = THREE.MathUtils.clamp(fwd * 0.03, -0.35, 0.35), tz = THREE.MathUtils.clamp(-lat * 0.03, -0.3, 0.3);
				S.wx += ((tx - S.sx) * 60 - S.wx * 7) * dt; S.wz += ((tz - S.sz) * 60 - S.wz * 7) * dt;
				S.sx += S.wx * dt; S.sz += S.wz * dt;
				if (!Number.isFinite(S.sx + S.sz)) S.sx = S.sz = S.wx = S.wz = 0;
			} else S.p = new V();
			S.p.copy(g);
			// (turned to face along the body; swung about its sideways axis, then its forward one)
			qa.setFromAxisAngle(yAxis, yaw).multiply(qb.setFromAxisAngle(zAxis, S.sz + (side === 'L' ? 0.05 : -0.05))).multiply(qb.setFromAxisAngle(xAxis, S.sx)).multiply(qb.setFromAxisAngle(yAxis, Math.PI / 2));
			mesh.matrixWorld.compose(g, qa, sc.set(k, k, k));
		};
	}
	mesh.updateMatrixWorld = place;
	mesh.updateWorldMatrix = place;
	P.body.add(mesh);
	return { mesh, fit, lod, remove() { mesh.removeFromParent(); } };
}
