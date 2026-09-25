// Plants: palms along the coast, hardwood groves inland, banana and fern
// understory, shrubs and boulders. Each species is a few instanced parts that
// stream in around the player from a 64 m cell index. Everything sways with
// the wind and with the music's low end.

import * as THREE from 'three';
import { mulberry32, makeNoise, smoothstep, clamp } from '../noise.js';
import * as TX from './textures.js';
import { HEIGHT_GLSL } from './terrain.js';
import { addPulse } from '../pulse.js';
import { addLodFade, fadeRange } from './lodfade.js';

// ---------- geometry helpers ----------
class Builder {
	constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.s = []; this.i = []; }
	vert(p, n, uv, c, s) {
		this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(uv[0], uv[1]);
		this.c.push(c.r, c.g, c.b); this.s.push(s);
		return this.p.length / 3 - 1;
	}
	tri(a, b, c) { this.i.push(a, b, c); }
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
		g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.s, 1));
		g.setIndex(this.i);
		g.computeBoundingSphere();
		g.computeBoundingBox();
		return g;
	}
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

function tube(b, path, radii, sides, color, swayOf, uvAt) {
	const rings = [];
	// texture runs by length along the tube, so unevenly spaced rings (the flare at a
	// trunk's foot) don't squash the bark into a band
	const along = [0];
	for (let k = 1; k < path.length; k++) along.push(along[k - 1] + path[k].distanceTo(path[k - 1]));
	const total = along[along.length - 1] || 1;
	// the ring frame is carried along the tube (parallel transport): it never flips when
	// a leaning trunk crosses some angle, so the rings don't twist into a pinch
	let side = null;
	for (let k = 0; k < path.length; k++) {
		const p = path[k], next = path[Math.min(path.length - 1, k + 1)], prev = path[Math.max(0, k - 1)];
		const dir = next.clone().sub(prev).normalize();
		if (!side) side = Math.abs(dir.y) > 0.95 ? V(1, 0, 0) : dir.clone().cross(UP).normalize();
		else {
			side = side.clone().sub(dir.clone().multiplyScalar(side.dot(dir)));
			if (side.lengthSq() < 1e-6) side = Math.abs(dir.y) > 0.95 ? V(1, 0, 0) : dir.clone().cross(UP);
			side.normalize();
		}
		const up2 = side.clone().cross(dir).normalize();
		const ring = [];
		for (let s = 0; s <= sides; s++) {
			const a = s / sides * Math.PI * 2, n = side.clone().multiplyScalar(Math.cos(a)).add(up2.clone().multiplyScalar(Math.sin(a)));
			const band = 0.93 + 0.07 * Math.sin(along[k] * 1.9);
			ring.push(b.vert(p.clone().add(n.clone().multiplyScalar(radii[k])), n, uvAt || [s / sides, along[k] / total], { r: color.r * band, g: color.g * band, b: color.b * band }, swayOf(k / (path.length - 1))));
		}
		rings.push(ring);
	}
	for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < sides; s++) {
		const a = rings[k][s], bb = rings[k][s + 1], c = rings[k + 1][s], d = rings[k + 1][s + 1];
		b.tri(a, c, bb); b.tri(bb, c, d);
	}
}
// a leaf strip along a curve: centre line with folded edges (a shallow V)
function strip(b, pts, widths, fold, color, tipColor, swayBase, swayTip, normalUp = 0.6) {
	const L = pts.length;
	let prevSide = null;
	const rows = [];
	for (let k = 0; k < L; k++) {
		const p = pts[k], dir = pts[Math.min(L - 1, k + 1)].clone().sub(pts[Math.max(0, k - 1)]).normalize();
		let side = dir.clone().cross(UP);
		if (side.lengthSq() < 1e-4) side = prevSide || V(1, 0, 0);
		side.normalize(); prevSide = side;
		const t = k / (L - 1), w = widths[k] / 2;
		const down = V(0, -fold * w, 0);
		const col = { r: color.r + (tipColor.r - color.r) * t, g: color.g + (tipColor.g - color.g) * t, b: color.b + (tipColor.b - color.b) * t };
		const n = UP.clone().multiplyScalar(normalUp).add(dir.clone().multiplyScalar(0.2)).normalize();
		const sw = swayBase + (swayTip - swayBase) * t;
		rows.push([
			b.vert(p.clone().add(side.clone().multiplyScalar(-w)).add(down), n, [t, 0], col, sw),
			b.vert(p.clone(), n, [t, 0.5], col, sw),
			b.vert(p.clone().add(side.clone().multiplyScalar(w)).add(down), n, [t, 1], col, sw),
		]);
	}
	for (let k = 0; k < L - 1; k++) for (let s = 0; s < 2; s++) {
		const a = rows[k][s], c = rows[k][s + 1], d = rows[k + 1][s], e = rows[k + 1][s + 1];
		b.tri(a, d, c); b.tri(c, d, e);
	}
}
function card(b, center, size, rnd, color, sway, outwardFrom, normal) {
	const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3.1, rnd() * 6.3, rnd() * 3.1));
	const n = normal || center.clone().sub(outwardFrom).normalize().multiplyScalar(0.75).add(V(0, 0.45, 0)).normalize();
	const c = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) => V(x * size, y * size, 0).applyQuaternion(q).add(center));
	const tone = 0.82 + rnd() * 0.36, col = { r: color.r * tone, g: color.g * tone, b: color.b * tone };
	const uvs = [[0, 0], [0.96, 0], [0.96, 0.96], [0, 0.96]];
	const ids = c.map((p, k) => b.vert(p, n, uvs[k], col, sway));
	b.tri(ids[0], ids[1], ids[2]); b.tri(ids[0], ids[2], ids[3]);
}

// ---------- species ----------
const BARK = new THREE.Color(0.62, 0.55, 0.47), PALM_BARK = new THREE.Color(0.86, 0.78, 0.66);

function palm(seed, far, g = null) {
	const r = mulberry32(seed), trunk = new Builder(), crown = new Builder();
	const H = g ? g.height * (0.85 + r() * 0.35) : 7.5 + r() * 3.5, lean = (g ? g.lean : 1.2) + r() * 2.2, la = r() * Math.PI * 2;
	const FT = g ? g.frondTint : [1, 1, 1];
	const path = [], radii = [];
	for (let k = 0; k <= 10; k++) {
		const t = k / 10;
		// starts below the ground and swells into a bulb where it meets the sand
		path.push(V(Math.cos(la) * lean * t * t, H * t - (k === 0 ? 0.35 : 0), Math.sin(la) * lean * t * t));
		radii.push(0.24 - 0.09 * t + 0.16 * Math.exp(-t * 22));
	}
	tube(trunk, far ? path.filter((_, k) => k % 2 === 0) : path, far ? radii.filter((_, k) => k % 2 === 0) : radii, far ? 4 : 7, PALM_BARK, (t) => t * t * 0.35);
	if (!far) {
		// the root mass: a skirt of short, dark roots pushing into the ground
		const ROOT = new THREE.Color(0.46, 0.38, 0.30);
		// a dense mat of thin roots, in two tiers, splaying out and down into the sand
		const nR = 22 + Math.floor(r() * 8);
		for (let i = 0; i < nR; i++) {
			const a = i / nR * 6.283 + r() * 0.35, out = 0.16 + r() * 0.26, hi = 0.06 + r() * 0.2, rr = 0.022 + r() * 0.018;
			const d0 = 0.25 + r() * 0.05;
			tube(trunk, [V(Math.cos(a) * d0, hi, Math.sin(a) * d0), V(Math.cos(a) * (d0 + out * 0.5), hi * 0.3, Math.sin(a) * (d0 + out * 0.5)), V(Math.cos(a) * (d0 + out), -0.06, Math.sin(a) * (d0 + out))],
				[rr, rr * 0.9, rr * 0.6], 3, ROOT, () => 0);
		}
	}
	const top = path[10];
	// the crown: overlapping leaf bases swell out of the trunk top and close into the
	// spear of the next unopened frond
	const up = path[10].clone().sub(path[9]).normalize();
	const at = (d) => top.clone().add(up.clone().multiplyScalar(d));
	const BOOT = new THREE.Color(0.8, 0.78, 0.5);
	tube(trunk, [at(-0.4), at(0.0), at(0.35), at(0.75), at(1.1), at(1.6)], [0.16, 0.26, 0.3, 0.26, 0.13, 0.03], far ? 5 : 8, BOOT, (t) => 0.35 + t * 0.2);
	if (!far) {
		// coconuts bunched under the crown
		const rn = mulberry32(seed + 7), nN = 5 + Math.floor(rn() * 5);
		for (let i = 0; i < nN; i++) {
			const a = rn() * 6.283, d = 0.28 + rn() * 0.12, ripe = rn();
			const col = ripe < 0.5 ? { r: 0.78, g: 0.82, b: 0.38 } : ripe < 0.8 ? { r: 0.9, g: 0.7, b: 0.36 } : { r: 0.62, g: 0.46, b: 0.3 };
			nut(trunk, at(0.15 + rn() * 0.25).add(V(Math.cos(a) * d, 0, Math.sin(a) * d)), 0.15 + rn() * 0.03, col);
		}
	}
	// fronds in a spiral round the crown: the young stand up, the old arch out and droop;
	// each has a bare stalk before its leaflets start
	const nF = far ? 10 : (g ? g.fronds : 15) + Math.floor(r() * 4);
	const golden = 2.39996;
	for (let f = 0; f < nF; f++) {
		const age = f / (nF - 1);                          // 0 = youngest (top), 1 = oldest (bottom)
		const a = f * golden + r() * 0.2;
		const hy = 1.0 - age * 0.9;
		const base = at(hy).add(V(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08));
		const elev = 1.15 - age * 1.35 + (r() - 0.5) * 0.15;
		const L = (3.4 + r() * 1.3) * (0.75 + 0.25 * Math.min(1, age * 2));
		const dir = V(Math.cos(a), 0, Math.sin(a));
		const segs = far ? 4 : 8, pts = [], widths = [];
		for (let k = 0; k <= segs; k++) {
			const s2 = k / segs, d = L * s2;
			// the rachis leaves at its angle and bends down more toward the tip
			const droop = (0.12 + age * 0.22) * d * d;
			pts.push(base.clone().add(dir.clone().multiplyScalar(Math.cos(elev) * d)).add(V(0, Math.sin(elev) * d - droop, 0)));
			// grows straight out of the crown: just the rib at first, leaflets widening out of it
			widths.push(0.12 + 1.25 * Math.sin(Math.min(1, s2 * 1.1 + 0.02) * Math.PI) * Math.min(1, s2 * 4));
		}
		const green = { r: (0.26 + age * 0.05) * FT[0], g: (0.42 - age * 0.03) * FT[1], b: 0.15 * FT[2] }, tip = { r: (0.44 + age * 0.08) * FT[0], g: 0.52 * FT[1], b: 0.22 * FT[2] };
		strip(crown, pts, widths, 0.55, green, tip, 0.45, 1.0, 0.7);
	}
	if (!far) {
		// one or two dead fronds hanging brown against the trunk
		const nD = 1 + Math.floor(r() * 2);
		for (let i = 0; i < nD; i++) {
			const a = r() * 6.283, dir = V(Math.cos(a), 0, Math.sin(a)), base = at(0.0).add(dir.clone().multiplyScalar(0.2));
			const pts = [], widths = [];
			for (let k = 0; k <= 5; k++) { const s2 = k / 5; pts.push(base.clone().add(dir.clone().multiplyScalar(0.25 + 0.5 * s2)).add(V(0, -2.6 * s2, 0))); widths.push(s2 < 0.15 ? 0 : 0.9 * (1 - s2 * 0.5)); }
			strip(crown, pts, widths, 0.4, { r: 0.62, g: 0.48, b: 0.3 }, { r: 0.55, g: 0.42, b: 0.26 }, 0.3, 0.5, 0.6);
		}
	}
	return { parts: [trunk.geometry(), crown.geometry()], height: H, lean: la };
}

// crown architecture per growth form (Crysis tree genomes): how much of the height is
// bare trunk, how wide and tall the crown, how the limbs run
const CROWN = {
	round: { trunk: 0.62, rx: 1, ry: 1, len: 1, rise: 1, lift: 0.22 },
	umbrella: { trunk: 0.72, rx: 1.55, ry: 0.45, len: 1.6, rise: 0.45, lift: 0.1 },
	columnar: { trunk: 0.38, rx: 0.55, ry: 1.9, len: 0.45, rise: 1.5, lift: 0.5 },
	layered: { trunk: 0.5, rx: 1.2, ry: 1.05, len: 1.25, rise: 0.6, lift: 0.3 },
	weeping: { trunk: 0.55, rx: 1.2, ry: 1.1, len: 1.2, rise: 0.8, lift: 0.22 },
};
export function hardwood(seed, far, mid, g = null) {
	const r = mulberry32(seed), trunk = new Builder(), crown = new Builder();
	const C = CROWN[g?.crown || 'round'];
	const H = g ? g.height * (0.85 + r() * 0.3) : 8 + r() * 5, bend = r() * 1.5, ba = r() * 6.28;
	const BK = g ? new THREE.Color(BARK.r * g.bark[0], BARK.g * g.bark[1], BARK.b * g.bark[2]) : BARK;
	const LT = g ? g.leaf : [1, 1, 1];
	const path = [], radii = [];
	// fine steps near the ground so the trunk can flare out into its roots
	for (const t of [0, 0.02, 0.06, 0.12, 0.22, 0.4, 0.6, 0.8, 1]) {
		path.push(V(Math.cos(ba) * bend * t * t, H * C.trunk * t - (t === 0 ? 0.3 : 0), Math.sin(ba) * bend * t * t));
		radii.push(0.32 - 0.13 * t + 0.3 * Math.exp(-t * 20));
	}
	tube(trunk, far ? [path[0], path[4], path[path.length - 1]] : path, far ? [radii[0] * 0.8, radii[4], radii[radii.length - 1]] : radii, far ? 4 : mid ? 5 : 8, BK, (t) => t * 0.15);
	if (!far && !mid) {
		// buttress and surface roots: they leave the trunk high and run out and down into the soil
		const nR = 6 + Math.floor(r() * 3);
		for (let i = 0; i < nR; i++) {
			const a = i / nR * 6.283 + r() * 0.5, L = 1.0 + r() * 1.1, hi = 0.3 + r() * 0.22, wig = (r() - 0.5) * 0.7;
			// born inside the flare, drops to the surface, snakes out along it and dives
			// under at a fine point, so there is never a blunt end in view
			const pts = [], rad = [];
			for (let k = 0; k <= 9; k++) {
				const t = k / 9, d = 0.12 + (L + 0.3) * t;
				const y = hi * Math.pow(1 - Math.min(1, t * 1.25), 2.2) - 0.22 * Math.pow(t, 3) + Math.sin(t * 9 + i) * 0.015;
				const aa = a + wig * t + Math.sin(t * 5 + i) * 0.08;
				pts.push(V(Math.cos(aa) * d, y, Math.sin(aa) * d));
				rad.push(0.14 * Math.pow(1 - t, 1.7) + 0.004);
			}
			tube(trunk, pts, rad, 5, BK, () => 0);
			// a rootlet or two branching off along the way
			for (let b = 0; b < 2; b++) {
				const k0 = 3 + Math.floor(r() * 4), o = pts[k0], ba2 = a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.5), bl = 0.35 + r() * 0.35;
				const e1 = V(o.x + Math.cos(ba2) * bl * 0.5, o.y * 0.3, o.z + Math.sin(ba2) * bl * 0.5), e2 = V(o.x + Math.cos(ba2) * bl, -0.1, o.z + Math.sin(ba2) * bl);
				tube(trunk, [o.clone().setY(o.y + 0.01), e1, e2], [rad[k0] * 0.55, rad[k0] * 0.3, 0.003], 4, BK, () => 0);
			}
		}
	}
	const fork = path[path.length - 1], crownC = fork.clone().add(V(0, H * C.lift, 0));
	const ends = [];
	const nB = far ? 0 : 3 + Math.floor(r() * 3);
	for (let i = 0; i < nB; i++) {
		const a = i / nB * 6.28 + r() * 0.8, len = (2.5 + r() * 2.2) * C.len, rise = (1.6 + r() * 2.2) * C.rise;
		const e = fork.clone().add(V(Math.cos(a) * len, rise, Math.sin(a) * len));
		const mid = fork.clone().lerp(e, 0.5).add(V(0, 0.5, 0));
		tube(trunk, [fork.clone(), mid, e], [0.16, 0.1, 0.05], 5, BK, (t) => 0.2 + t * 0.4);
		ends.push(e);
	}
	// the crown is a cluster of leaf clumps, each a dense rounded mass on a branch
	// end: lumpy silhouette, shade deep inside, light on the sunny tops of the clumps
	const RX = (3.6 + r() * 1.6) * C.rx, RY = (2.4 + r() * 0.9) * C.ry;
	const clumps = [];
	for (const e of ends) clumps.push({ c: e.clone().add(V(0, 0.6, 0)), rad: 1.5 + r() * 0.6 });
	const nExtra = far ? 5 : 7 + Math.floor(r() * 4);
	for (let i = 0; i < nExtra; i++) {
		const th = r() * 6.28, ph = Math.acos(r() * 1.6 - 0.6), k = 0.55 + r() * 0.45;
		if (g?.crown === 'layered') {
			// flat tiers of foliage, narrowing upward, with air between them
			const tier = i % 3, tr = RX * (1 - tier * 0.28) * (0.4 + k * 0.6);
			clumps.push({ c: crownC.clone().add(V(Math.cos(th) * tr, (tier - 1) * RY * 0.75 + (r() - 0.5) * 0.3, Math.sin(th) * tr)), rad: 1.2 + r() * 0.5, flat: true });
		} else clumps.push({ c: crownC.clone().add(V(Math.sin(ph) * Math.cos(th) * RX * k, Math.cos(ph) * RY * k, Math.sin(ph) * Math.sin(th) * RX * k)), rad: (1.3 + r() * 0.8) * Math.min(1, 0.6 + C.rx * 0.4) });
	}
	// a weeping crown lets curtains of leaves hang from its rim
	if (g?.crown === 'weeping') for (let i = 0; i < (far ? 3 : 7); i++) { const th = i / 7 * 6.28 + r() * 0.5; clumps.push({ c: crownC.clone().add(V(Math.cos(th) * RX * 0.95, -RY * 0.85, Math.sin(th) * RX * 0.95)), rad: 1.1 + r() * 0.4, hang: true }); }
	const per = far ? 2 : mid ? 4 : 9, size = far ? 3.6 : mid ? 2.5 : 1.7;
	for (const cl of clumps) {
		const out = cl.c.clone().sub(crownC).normalize();
		for (let i = 0; i < per; i++) {
			// leaves sit on the clump's skin, more on its outer, sunlit side
			const dir = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().add(out.clone().multiplyScalar(0.6)).add(V(0, 0.3, 0)).normalize();
			const p = cl.c.clone().add(dir.clone().multiplyScalar(cl.rad * (0.45 + r() * 0.5)));
			const n = dir.clone().multiplyScalar(0.65).add(p.clone().sub(crownC).normalize().multiplyScalar(0.35)).normalize();
			// shade: darker toward the crown's heart and on the clump's underside
			const depth = Math.min(1, p.distanceTo(crownC) / Math.max(RX, RY));
			const sh = (0.4 + 0.6 * depth) * (0.62 + 0.38 * (dir.y * 0.5 + 0.5));
			card(crown, cl.flat ? p.setY(cl.c.y + (p.y - cl.c.y) * 0.4) : cl.hang ? p.setY(p.y - r() * 0.8) : p, size * (0.8 + r() * 0.45), r, { r: 0.24 * sh * LT[0], g: 0.38 * sh * LT[1], b: 0.14 * sh * LT[2] }, cl.hang ? 1.2 : 0.75 + 0.25 * depth, crownC, n);
		}
	}
	// a few dark leaves deep in the crown so you never see straight through it
	for (let i = 0; i < (far ? 1 : mid ? 3 : 6); i++) card(crown, crownC.clone().add(V((r() - 0.5) * RX, (r() - 0.3) * RY, (r() - 0.5) * RX)), size * 1.4, r, { r: 0.08, g: 0.13, b: 0.05 }, 0.7, crownC);
	return { parts: [trunk.geometry(), crown.geometry()], height: H };
}

function banana(seed) {
	// a banana grows as a clump: a swollen corm at the ground, the main stem, a few
	// suckers coming up around it, and old leaves hanging brown down the stems
	const r = mulberry32(seed), stem = new Builder(), leaves = new Builder();
	const H = 1.5 + r() * 0.8;
	const W = new THREE.Color(1, 1, 1);
	const plant = (x, z, h, k, lean) => {
		const lx = Math.cos(lean) * h * 0.08, lz = Math.sin(lean) * h * 0.08;
		tube(stem, [V(x, -0.2, z), V(x, 0.02, z), V(x + lx * 0.2, 0.18 * k, z + lz * 0.2), V(x + lx * 0.6, h * 0.55, z + lz * 0.6), V(x + lx * 0.95, h * 0.94, z + lz * 0.95), V(x + lx * 1.03, h + 0.1 * k, z + lz * 1.03)],
			[0.25 * k, 0.24 * k, 0.17 * k, 0.13 * k, 0.1 * k, 0.03], 8, W, (t) => t * 0.3);
		const top = V(x + lx, h, z + lz);
		const nL = Math.round((5 + Math.floor(r() * 3)) * (0.5 + 0.5 * k));
		for (let l = 0; l < nL; l++) {
			const a = l / nL * 6.28 + r() * 0.5, L = (1.7 + r() * 0.8) * (0.45 + 0.55 * k), rise = 0.9 + r() * 0.5;
			const dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
			for (let q = 0; q <= 6; q++) {
				const s2 = q / 6, d = L * s2;
				pts.push(top.clone().add(dir.clone().multiplyScalar(d * 0.9)).add(V(0, (Math.sin(s2 * 2.2) * rise * 0.6 - s2 * s2 * 0.9) * (0.5 + 0.5 * k), 0)));
				// a petiole first, then the blade widening out of it
				const lb = Math.max(0, (s2 - 0.14) / 0.86);
				widths.push(lb > 0 ? 0.62 * (0.5 + 0.5 * k) * Math.sin(Math.min(1, lb + 0.1) * Math.PI) + 0.05 : 0.05);
			}
			strip(leaves, pts, widths, 0.25, { r: 0.30, g: 0.46, b: 0.17 }, { r: 0.38, g: 0.54, b: 0.2 }, 0.3, 1.0, 0.8);
		}
		// dead leaves: brown, torn, hanging down the stem from partway up
		const nD = k > 0.7 ? 3 + Math.floor(r() * 2) : 1;
		for (let d = 0; d < nD; d++) {
			const a = r() * 6.28, y0 = h * (0.45 + r() * 0.35), L = 0.6 + r() * 0.5;
			const dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
			for (let q = 0; q <= 4; q++) {
				const s2 = q / 4;
				pts.push(V(x, y0, z).add(dir.clone().multiplyScalar(0.12 * k + 0.12 * s2)).add(V(0, -L * s2, 0)));
				widths.push(0.3 * (1 - s2 * 0.6));
			}
			strip(leaves, pts, widths, 0.15, { r: 0.62, g: 0.46, b: 0.26 }, { r: 0.52, g: 0.38, b: 0.22 }, 0.05, 0.12, 0.6);
		}
	};
	plant(0, 0, H, 1, r() * 6.28);
	const nS = 2 + Math.floor(r() * 2);
	for (let i = 0; i < nS; i++) {
		const a = r() * 6.28, d = 0.35 + r() * 0.35, k = 0.35 + r() * 0.35;
		plant(Math.cos(a) * d, Math.sin(a) * d, H * k * (0.8 + r() * 0.3), k, a);
	}
	return { parts: [stem.geometry(), leaves.geometry()], height: H + 1 };
}

function fern(seed, g = null) {
	const r = mulberry32(seed), b = new Builder(), FT = g ? g.tint : [1, 1, 1], FS = g ? g.size : 1;
	const nF = 8 + Math.floor(r() * 4);
	for (let f = 0; f < nF; f++) {
		const a = f / nF * 6.28 + r() * 0.4, L = (0.8 + r() * 0.5) * FS, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 4; k++) {
			const s = k / 4, d = L * s;
			pts.push(dir.clone().multiplyScalar(d).add(V(0, Math.sin(s * 2.4) * L * 0.55, 0)));
			widths.push(0.36 * (1 - s * 0.7));
		}
		strip(b, pts, widths, 0.1, { r: 0.2 * FT[0], g: 0.33 * FT[1], b: 0.12 * FT[2] }, { r: 0.3 * FT[0], g: 0.44 * FT[1], b: 0.16 * FT[2] }, 0.2, 1.0, 0.8);
	}
	return { parts: [b.geometry()], height: 0.9 };
}

// several woody stems rising out of one root crown and fanning into the canopy
function bushStems(b, r, n, top, spread) {
	const out = [];
	for (let i = 0; i < n; i++) {
		const a = i / n * 6.283 + r() * 0.6, base = 0.04 + r() * 0.12, reach = spread * (0.45 + r() * 0.5), up = top * (0.6 + r() * 0.45);
		const pts = [V(Math.cos(a) * base, -0.12, Math.sin(a) * base)];
		for (let q = 1; q <= 4; q++) {
			const t = q / 4, d = base + reach * Math.pow(t, 1.4);
			pts.push(V(Math.cos(a + t * 0.3) * d, up * t, Math.sin(a + t * 0.3) * d));
		}
		tube(b, pts, [0.05, 0.042, 0.032, 0.022, 0.012], 5, new THREE.Color(0.55, 0.47, 0.38), (t) => t * 0.7);
		out.push(pts[pts.length - 1], pts[2]);
	}
	return out;
}
// a flowering shrub: full-colour cards around woody stems, foliage coming right down
// into the grass instead of a ball hovering over it
function bloom(seed) {
	const r = mulberry32(seed), wood = new Builder(), b = new Builder(), c0 = V(0, 0.75, 0);
	const tips = bushStems(wood, r, 6 + Math.floor(r() * 3), 1.3, 1.0);
	for (let i = 0; i < 16; i++) {
		const th = r() * 6.28, ph = Math.acos(r() * 1.6 - 0.6), k = 0.45 + r() * 0.55;
		card(b, c0.clone().add(V(Math.sin(ph) * Math.cos(th) * 1.15 * k, Math.cos(ph) * 0.85 * k, Math.sin(ph) * Math.sin(th) * 1.15 * k)), 1.2, r, { r: 0.55 + 0.4 * k, g: 0.55 + 0.4 * k, b: 0.55 + 0.4 * k }, 0.6, V(0, 0, 0));
	}
	for (const t of tips) card(b, t.clone().add(V((r() - 0.5) * 0.3, 0.05, (r() - 0.5) * 0.3)), 0.9, r, { r: 1, g: 1, b: 1 }, 0.7, V(0, 0, 0));
	// a low skirt of leaves where it meets the grass
	for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 0.45 + r() * 0.4; card(b, V(Math.cos(a) * d, 0.22 + r() * 0.15, Math.sin(a) * d), 0.8, r, { r: 0.5, g: 0.55, b: 0.5 }, 0.4, V(0, -0.5, 0)); }
	return { parts: [wood.geometry(), b.geometry()], height: 1.8 };
}
export function shrub(seed) {
	const r = mulberry32(seed), wood = new Builder(), b = new Builder(), c0 = V(0, 0.5, 0);
	const tips = bushStems(wood, r, 5 + Math.floor(r() * 3), 0.95, 0.9);
	for (let i = 0; i < 18; i++) {
		const th = r() * 6.28, ph = Math.acos(r() * 1.6 - 0.6), k = 0.5 + r() * 0.5;
		card(b, c0.clone().add(V(Math.sin(ph) * Math.cos(th) * 1.1 * k, Math.cos(ph) * 0.6 * k, Math.sin(ph) * Math.sin(th) * 1.1 * k)), 1.05, r, { r: 0.22 * (0.55 + 0.45 * k), g: 0.34 * (0.55 + 0.45 * k), b: 0.13 * (0.55 + 0.45 * k) }, 0.6, V(0, 0, 0));
	}
	for (const t of tips) card(b, t.clone().add(V((r() - 0.5) * 0.3, 0.05, (r() - 0.5) * 0.3)), 0.8, r, { r: 0.25, g: 0.37, b: 0.14 }, 0.7, V(0, 0, 0));
	for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = 0.4 + r() * 0.35; card(b, V(Math.cos(a) * d, 0.18 + r() * 0.12, Math.sin(a) * d), 0.75, r, { r: 0.17, g: 0.27, b: 0.1 }, 0.4, V(0, -0.5, 0)); }
	return { parts: [wood.geometry(), b.geometry()], height: 1.3 };
}

// ---------- Crysis-generated plants ----------
// tree fern: a shaggy dark trunk under a crown of long arching fronds
function treefern(seed, g) {
	const r = mulberry32(seed), trunk = new Builder(), b = new Builder();
	const H = g.height * (0.8 + r() * 0.4), la = r() * 6.28, lean = r() * 0.4;
	const path = [], radii = [];
	for (let k = 0; k <= 6; k++) { const t = k / 6; path.push(V(Math.cos(la) * lean * t, H * t - (k === 0 ? 0.2 : 0), Math.sin(la) * lean * t)); radii.push(0.16 + 0.06 * Math.exp(-t * 8) + 0.03 * Math.sin(t * 17)); }
	tube(trunk, path, radii, 7, new THREE.Color(0.42, 0.32, 0.24), (t) => t * t * 0.3);
	const top = path[6];
	for (let f = 0; f < g.fronds; f++) {
		const a = f * 2.39996 + r() * 0.3, L = 1.6 + r() * 0.9, elev = 0.9 - (f / g.fronds) * 0.8, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 7; k++) {
			const t = k / 7, d = L * t;
			pts.push(top.clone().add(dir.clone().multiplyScalar(Math.cos(elev) * d)).add(V(0, Math.sin(elev) * d - 0.5 * d * d / L, 0)));
			widths.push(0.08 + 0.55 * Math.sin(Math.min(1, t * 1.05) * Math.PI) * Math.min(1, t * 3));
		}
		strip(b, pts, widths, 0.15, { r: 0.2 * g.tint[0], g: 0.34 * g.tint[1], b: 0.12 * g.tint[2] }, { r: 0.32 * g.tint[0], g: 0.46 * g.tint[1], b: 0.16 * g.tint[2] }, 0.4, 1.1, 0.8);
	}
	// the curled fiddleheads of new fronds at the very top
	for (let i = 0; i < 3; i++) { const a = r() * 6.28; nut(b, top.clone().add(V(Math.cos(a) * 0.12, 0.15, Math.sin(a) * 0.12)), 0.07, { r: 0.4, g: 0.36, b: 0.2 }); }
	return { parts: [trunk.geometry(), b.geometry()], height: H + 1 };
}
// elephant ear: big heart-shaped leaves on long stalks, rising from one crown
function taro(seed, g) {
	const r = mulberry32(seed), stalks = new Builder(), b = new Builder();
	const n = 4 + Math.floor(r() * 4), S = g.size;
	for (let i = 0; i < n; i++) {
		const a = i / n * 6.28 + r() * 0.5, h = (0.5 + r() * 0.5) * S, out = (0.15 + r() * 0.25) * S;
		const tip = V(Math.cos(a) * out, h, Math.sin(a) * out);
		tube(stalks, [V(0, -0.05, 0), V(Math.cos(a) * out * 0.3, h * 0.6, Math.sin(a) * out * 0.3), tip], [0.035 * S, 0.028 * S, 0.02 * S], 4, new THREE.Color(0.45 * g.tint[0], 0.55 * g.tint[1], 0.3 * g.tint[2]), (t) => t * 0.6);
		// the blade hangs from the stalk tip: widest near its base (the heart), to a point
		const L = (0.55 + r() * 0.3) * S, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 6; k++) {
			const t = k / 6;
			pts.push(tip.clone().add(dir.clone().multiplyScalar(L * t * 0.85)).add(V(0, 0.08 * S - t * t * L * 0.55, 0)));
			widths.push((t < 0.12 ? 0.55 + t * 2 : Math.sin(Math.PI * (0.5 + 0.5 * (t - 0.12) / 0.88)) * 0.78) * L);
		}
		strip(b, pts, widths, 0.18, { r: 0.18 * g.tint[0], g: 0.33 * g.tint[1], b: 0.12 * g.tint[2] }, { r: 0.24 * g.tint[0], g: 0.4 * g.tint[1], b: 0.14 * g.tint[2] }, 0.5, 1.0, 0.85);
	}
	return { parts: [stalks.geometry(), b.geometry()], height: S };
}
// screw pine: a leaning trunk propped on stilt roots, tufts of long strap leaves
function pandanus(seed, g) {
	const r = mulberry32(seed), wood = new Builder(), b = new Builder();
	const H = g.height * (0.8 + r() * 0.4), la = r() * 6.28, lean = 0.6 + r() * 0.8;
	const W = new THREE.Color(0.62, 0.55, 0.45);
	const base = V(0, 0.9, 0), top = V(Math.cos(la) * lean, H, Math.sin(la) * lean);
	tube(wood, [base, base.clone().lerp(top, 0.5), top], [0.13, 0.11, 0.08], 6, W, (t) => t * 0.3);
	// the stilts: from the trunk's foot, splaying down into the sand
	for (let i = 0; i < g.stilts; i++) {
		const a = i / g.stilts * 6.28 + r() * 0.4, d = 0.5 + r() * 0.5, y0 = 0.9 + r() * 0.6;
		tube(wood, [V(Math.cos(la) * lean * y0 / H, y0, Math.sin(la) * lean * y0 / H), V(Math.cos(a) * d * 0.55, y0 * 0.45, Math.sin(a) * d * 0.55), V(Math.cos(a) * d, -0.15, Math.sin(a) * d)], [0.05, 0.045, 0.04], 4, W, () => 0);
	}
	// branches, each ending in a spiral tuft of drooping strap leaves
	const heads = [top];
	for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
		const a = r() * 6.28, e = top.clone().add(V(Math.cos(a) * (0.8 + r() * 0.6), 0.3 + r() * 0.7, Math.sin(a) * (0.8 + r() * 0.6)));
		tube(wood, [top.clone().add(V(0, -0.4, 0)), e], [0.07, 0.05], 5, W, (t) => 0.3 + t * 0.3);
		heads.push(e);
	}
	for (const h of heads) for (let f = 0; f < 20; f++) {
		const a = f * 2.39996, L = 1.1 + r() * 0.6, elev = 0.9 - (f / 20) * 1.2, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 5; k++) { const t = k / 5, d = L * t; pts.push(h.clone().add(dir.clone().multiplyScalar(Math.cos(elev) * d)).add(V(0, Math.sin(elev) * d - 0.4 * d * d, 0))); widths.push(0.15 * (1 - t * 0.75)); }
		strip(b, pts, widths, 0.35, { r: 0.16 * g.tint[0], g: 0.27 * g.tint[1], b: 0.1 * g.tint[2] }, { r: 0.26 * g.tint[0], g: 0.36 * g.tint[1], b: 0.14 * g.tint[2] }, 0.4, 1.0, 0.6);
	}
	return { parts: [wood.geometry(), b.geometry()], height: H + 1 };
}
// wildflowers: a clump of thin stems, each with a head of petals round a bright eye
function wildflower(seed, g) {
	const r = mulberry32(seed), b = new Builder();
	const STEM = new THREE.Color(0.3, 0.45, 0.18), col = { r: g.colour[0], g: g.colour[1], b: g.colour[2] };
	const n = g.heads + 2 + Math.floor(r() * 3);
	for (let i = 0; i < n; i++) {
		const a = r() * 6.28, d = r() * 0.18, h = g.height * (0.6 + r() * 0.6), lean = (r() - 0.5) * 0.2;
		const tip = V(Math.cos(a) * (d + lean), h, Math.sin(a) * (d + lean));
		tube(b, [V(Math.cos(a) * d, -0.03, Math.sin(a) * d), V(Math.cos(a) * d, h * 0.5, Math.sin(a) * d), tip], [0.008, 0.006, 0.005], 3, STEM, (t) => t * 1.2);
		// a leaf or two low on the stem
		const la = r() * 6.28, lp = V(Math.cos(a) * d, h * 0.25, Math.sin(a) * d);
		strip(b, [lp, lp.clone().add(V(Math.cos(la) * 0.08, 0.04, Math.sin(la) * 0.08)), lp.clone().add(V(Math.cos(la) * 0.15, 0.02, Math.sin(la) * 0.15))], [0.01, 0.04, 0.005], 0.1, { r: 0.25, g: 0.4, b: 0.15 }, { r: 0.3, g: 0.45, b: 0.18 }, 0.4, 0.8, 0.8);
		// the head: petals as small leaves radiating from the tip, tilted to the sky
		const pr = 0.06 + r() * 0.035;
		for (let k = 0; k < g.petals; k++) {
			const pa = k / g.petals * 6.28 + r() * 0.2, dir = V(Math.cos(pa), 0.35, Math.sin(pa)).normalize();
			strip(b, [tip.clone(), tip.clone().add(dir.clone().multiplyScalar(pr * 0.6)), tip.clone().add(dir.clone().multiplyScalar(pr * 1.3))], [0.005, pr * 0.9, pr * 0.3], 0.1, col, { r: Math.min(1, col.r * 1.1 + 0.05), g: Math.min(1, col.g * 1.1 + 0.05), b: Math.min(1, col.b * 1.1 + 0.05) }, 1.2, 1.3, 0.95);
		}
		nut(b, tip.clone().add(V(0, 0.008, 0)), pr * 0.35, { r: 0.95, g: 0.8, b: 0.2 });
	}
	return { parts: [b.geometry()], height: g.height };
}

function tideRock(seed) {
	// a layered outcrop: flattened, stepped strata, a broad foot that sits in the water
	const r = mulberry32(seed), g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
	const nz = makeNoise(seed + 9), tilt = (r() - 0.5) * 0.6;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		let k = 0.8 + nz.fbm(x * 1.6 + 3, z * 1.6 + y * 0.5, 4) * 0.55;
		const ly = y + x * tilt;
		const step = Math.round(ly * 4) / 4;
		const yy = ly + (step - ly) * 0.55;                        // terraces of bedding
		k *= 1 - 0.06 * Math.abs(Math.sin(ly * 12.6));
		p.setXYZ(i, x * k * 1.5, (yy - x * tilt) * 0.8 * (y < 0 ? 0.5 : 1), z * k * 1.2);
	}
	g.computeVertexNormals();
	const col = [];
	for (let i = 0; i < p.count; i++) { const t = 0.82 + r() * 0.2; col.push(0.42 * t, 0.39 * t, 0.35 * t); }
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
	g.computeBoundingBox();
	return { parts: [g], height: 1.2 };
}
function boulder(seed) {
	const r = mulberry32(seed), g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
	const nz = makeNoise(seed);
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		const k = 0.75 + nz.fbm(x * 1.3 + 3, z * 1.3 + y, 3) * 0.55;
		p.setXYZ(i, x * k * 1.2, y * k * 0.75, z * k);
	}
	g.computeVertexNormals();
	const col = [];
	for (let i = 0; i < p.count; i++) { const t = 0.8 + r() * 0.3; col.push(0.45 * t, 0.43 * t, 0.39 * t); }
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
	g.computeBoundingBox();
	return { parts: [g], height: 1 };
}

// ---------- ground debris ----------
function blob(b, c, r, sy, color) {
	// a low-poly ellipsoid
	const rows = 5, cols = 8, ids = [];
	for (let j = 0; j <= rows; j++) {
		const ph = j / rows * Math.PI, row = [];
		for (let i = 0; i <= cols; i++) {
			const th = i / cols * Math.PI * 2, n = V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
			row.push(b.vert(c.clone().add(V(n.x * r, n.y * r * sy, n.z * r)), n, [i / cols, j / rows], color, 0));
		}
		ids.push(row);
	}
	for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { b.tri(ids[j][i], ids[j + 1][i], ids[j][i + 1]); b.tri(ids[j][i + 1], ids[j + 1][i], ids[j + 1][i + 1]); }
}
function nut(b, c, rad, color) {
	const rows = 4, cols = 7, ids = [];
	for (let j = 0; j <= rows; j++) {
		const ph = j / rows * Math.PI, row = [];
		for (let i = 0; i <= cols; i++) {
			const th = i / cols * Math.PI * 2, n = V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
			row.push(b.vert(c.clone().add(V(n.x * rad, n.y * rad * 0.9, n.z * rad)), n, [0.3, 0.0], color, 0.5));
		}
		ids.push(row);
	}
	for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { b.tri(ids[j][i], ids[j + 1][i], ids[j][i + 1]); b.tri(ids[j][i + 1], ids[j + 1][i], ids[j + 1][i + 1]); }
}
function coconuts(seed) {
	const r = mulberry32(seed), b = new Builder(), n = 2 + Math.floor(r() * 3);
	for (let i = 0; i < n; i++) {
		const a = r() * 6.28, d = 0.2 + r() * 0.5, ripe = r();
		const col = ripe < 0.4 ? { r: 0.42, g: 0.30, b: 0.18 } : ripe < 0.75 ? { r: 0.55, g: 0.42, b: 0.24 } : { r: 0.46, g: 0.52, b: 0.22 };
		blob(b, V(Math.cos(a) * d, 0.14, Math.sin(a) * d), 0.14 + r() * 0.03, 0.88, col);
	}
	return { parts: [b.geometry()], height: 0.3 };
}
function deadFrond(seed) {
	const r = mulberry32(seed), b = new Builder();
	const a = r() * 6.28, L = 3.2 + r() * 1.2, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
	for (let k = 0; k <= 5; k++) {
		const s = k / 5;
		pts.push(dir.clone().multiplyScalar(L * s).add(V(0, 0.06 + Math.sin(s * 3.1) * 0.12, 0)));
		widths.push(1.1 * Math.sin(Math.min(1, s * 1.2 + 0.08) * Math.PI) + 0.08);
	}
	strip(b, pts, widths, -0.35, { r: 0.60, g: 0.47, b: 0.30 }, { r: 0.72, g: 0.60, b: 0.40 }, 0, 0.05, 0.9);
	// lying face up: flip the winding so the lit side is the top
	for (let i = 0; i < b.i.length; i += 3) { const t = b.i[i + 1]; b.i[i + 1] = b.i[i + 2]; b.i[i + 2] = t; }
	return { parts: [b.geometry()], height: 0.3 };
}
function driftwood(seed) {
	const r = mulberry32(seed), b = new Builder(), L = 2.5 + r() * 3, bend = (r() - 0.5) * 0.8;
	const path = [], radii = [];
	for (let k = 0; k <= 6; k++) { const t = k / 6; path.push(V(L * (t - 0.5), 0.12 + Math.sin(t * 3.1) * 0.05, Math.sin(t * 3.1) * bend)); radii.push((0.16 - 0.07 * t) * (0.8 + r() * 0.3)); }
	tube(b, path, radii, 6, new THREE.Color(0.78, 0.74, 0.68), () => 0);
	const s0 = path[2];
	tube(b, [s0, s0.clone().add(V(0.3, 0.25, 0.4)), s0.clone().add(V(0.5, 0.45, 0.9))], [0.07, 0.05, 0.03], 5, new THREE.Color(0.8, 0.76, 0.7), () => 0);
	return { parts: [b.geometry()], height: 0.4 };
}

// ---------- materials ----------
const NOISE_ROCK = `
float rh(vec2 p){ p = mod(p, 512.0); vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float rvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rh(i), rh(i + vec2(1, 0)), f.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), f.x), f.y); }
float rfbm(vec2 p){ return rvn(p) * 0.5 + rvn(p * 2.1 + 3.1) * 0.3 + rvn(p * 4.3 - 1.7) * 0.2; }
`;
export function swayMaterial(params, shared, stiff) {
	const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0, alphaToCoverage: !!params.alphaTest }, params));
	const hook = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind; sh.uniforms.uBass = shared.uBass; sh.uniforms.uGust = shared.uGust; sh.uniforms.uWindT = shared.uWindT;
		sh.vertexShader = 'attribute float aSway; uniform float uTime, uWind, uBass, uGust, uWindT;\nvarying float vGroundAO;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
			#include <begin_vertex>
			// darker where it meets the ground: roots, the trunk foot, the base of a shrub
			vGroundAO = mix(0.42, 1.0, smoothstep(-0.1, 1.3, position.y));
			#ifdef USE_INSTANCING
			vec3 ip = vec3(instanceMatrix[3]);
			#else
			vec3 ip = vec3(0.0);
			#endif
			float ph = ip.x * 0.21 + ip.z * 0.17;
			float sw = aSway * aSway * ${stiff.toFixed(2)};
			// sway on the wind's own clock; a gust leans the whole plant downwind and
			// sets the leaves fluttering; at no wind it barely stirs
			float push = 0.02 + uWind * 0.2 + uGust * 0.35 + uBass * 0.3;
			float flutter = 0.006 + uWind * 0.035 + uGust * 0.06;
			float wt = uWindT * 2.2;
			transformed.x += (sin(wt * 1.25 + ph) * push + uGust * 0.25 + sin(uTime * 3.9 + ph * 2.0 + position.y * 1.7) * flutter) * sw;
			transformed.z += (cos(wt * 1.05 + ph * 1.3) * push * 0.7 + uGust * 0.1 + cos(uTime * 4.3 + position.x * 1.3) * flutter * 0.8) * sw;`);
	};
	// leaves are thin: light both faces from the outward normal, as sunlight through
	// a leaf does, instead of flipping the back face dark
	m.onBeforeCompile = (sh) => {
		hook(sh);
		addPulse(sh);
		sh.fragmentShader = 'varying float vGroundAO;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vGroundAO;');
		if (params.side === THREE.DoubleSide) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize(vNormal);');
	};
	m.customProgramCacheKey = () => 'sway' + stiff + (params.map ? 'm' : '');
	let depth = null;
	if (params.alphaTest) {
		depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: params.map, alphaTest: params.alphaTest });
		depth.onBeforeCompile = hook;
		depth.customProgramCacheKey = () => 'swaydepth' + stiff;
	}
	return { material: m, depth };
}

// ---------- placement and streaming ----------
const CELL = 64;

export function createVegetation(island, shared, scene, flora = null) {
	const tex = { leaf: TX.leafCluster(), frond: TX.palmFrond(), banana: TX.bananaLeaf(), fern: TX.fernFrond(), palmBark: TX.palmBark(), woodBark: TX.woodBark() };
	tex.palmBark.repeat.set(1, 7);
	tex.woodBark.repeat.set(2, 3);
	const mats = {
		bark: swayMaterial({ map: tex.woodBark, roughness: 0.95 }, shared, 1),
		palmbark: swayMaterial({ map: tex.palmBark, roughness: 0.9 }, shared, 1),
		stem: swayMaterial({ roughness: 0.8 }, shared, 1),
		plainleaf: swayMaterial({ roughness: 0.7, side: THREE.DoubleSide }, shared, 1.1),
		bstem: swayMaterial({ map: TX.bananaStem(), roughness: 0.7 }, shared, 1),
		hibiscus: swayMaterial({ map: TX.bloomCluster('hibiscus'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55 }, shared, 0.8),
		bougainvillea: swayMaterial({ map: TX.bloomCluster('bougainvillea'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7 }, shared, 0.8),
		frond: swayMaterial({ map: tex.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }, shared, 1),
		leaf: swayMaterial({ map: tex.leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, shared, 0.8),
		banana: swayMaterial({ map: tex.banana, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }, shared, 1.2),
		fern: swayMaterial({ map: tex.fern, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }, shared, 1.2),
		stone: { material: (() => {
			const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: false });
			m.onBeforeCompile = (sh) => {
				addPulse(sh);
				sh.vertexShader = 'varying vec3 vRW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 rw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nrw = instanceMatrix * rw;\n#endif\nvRW = (modelMatrix * rw).xyz; }');
				sh.fragmentShader = 'varying vec3 vRW; float rRough = 0.9;\n' + NOISE_ROCK + sh.fragmentShader
					.replace('#include <color_fragment>', `#include <color_fragment>
						// grain and pitting, strata lines, then the sea's marks: algae below the
						// tide line, a dark wet band just above it, dry and pale higher up
						float rn = rfbm(vRW.xz * 1.7 + vRW.y * 1.1), rp = rfbm(vRW.xz * 9.0 + vRW.y * 7.0);
						diffuseColor.rgb *= vec3(0.66, 0.6, 0.53) * (0.5 + 0.8 * rn);
						diffuseColor.rgb *= 1.0 - 0.4 * smoothstep(0.58, 0.8, rp);                     // pits
						float strata = abs(sin(vRW.y * 9.0 + rn * 5.0));
						diffuseColor.rgb *= 0.78 + 0.22 * smoothstep(0.05, 0.3, strata);               // bedding lines
						// lichen patches on the dry tops, pale salt crust near the tide
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.7, 0.5), smoothstep(0.66, 0.78, rfbm(vRW.xz * 0.9 + 4.0)) * 0.35 * smoothstep(0.6, 1.5, vRW.y));
						float tide = vRW.y + 0.15 * sin(vRW.x * 0.3 + vRW.z * 0.2);
						float algae = 1.0 - smoothstep(-0.25, 0.1, tide);
						float wetR = 1.0 - smoothstep(0.1, 0.9 + 0.3 * rn, tide);
						diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, wetR);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.2, 0.08) * (0.7 + 0.6 * rp), algae * 0.75);
						rRough = mix(0.92, 0.35, wetR * (1.0 - algae * 0.5));`)
					.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rRough;')
					.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
						{
							// relief from the same noise: grain, pits and strata as real bumps
							float hR = rfbm(vRW.xz * 3.0 + vRW.y * 2.0) * 0.05 + rfbm(vRW.xz * 11.0 + vRW.y * 9.0) * 0.012 + abs(sin(vRW.y * 9.0)) * 0.012;
							vec3 sp = -vViewPosition, vSx = dFdx(sp), vSy = dFdy(sp);
							vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
							float fDet = dot(vSx, R1) * faceDirection;
							vec2 dH = vec2(dFdx(hR), dFdy(hR));
							normal = normalize(abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2));
						}`);
			};
			m.customProgramCacheKey = () => 'stone229';
			return m;
		})(), depth: null },
	};
	const nz = makeNoise(island.seed + 101);
	const species = [
		// densities are the chance a sample at `spacing` holds a plant: random within a
		// patch, but the patches follow the land (see eco below), so plants clump
		{ key: 'palm', variants: [0, 1, 2].map((v) => palm(island.seed * 7 + v, false, flora?.palm)), far: [0, 1, 2].map((v) => palm(island.seed * 7 + v, true, flora?.palm)), mats: ['palmbark', 'frond'], midIsFar: true, spacing: 5, near: 140, farR: 600, max: 700, farMax: 1800, kind: 'wood',
			density: (e) => e.path > 0.2 || e.h < 0.7 || e.sl > 0.45 ? 0 : e.strand * e.clump(0.02, 0.45, 0.7) * 0.55 + e.yard * 0.05 + e.gully * 0.04 },
		// the canopy: one entry per Crysis tree species; the community field decides
		// which species holds each stand (see standShare below)
		...(flora ? flora.trees : [null]).map((g, ti, all) => ({ key: g ? g.key : 'hardwood', tree: true, genome: g,
			variants: [0, 1].map((v) => hardwood(island.seed * 11 + v + ti * 101, false, false, g)), mid: [0, 1].map((v) => hardwood(island.seed * 11 + v + ti * 101, false, true, g)), far: [0, 1].map((v) => hardwood(island.seed * 11 + v + ti * 101, true, false, g)),
			mats: ['bark', 'leaf'], spacing: 6, near: 110, farR: 800, max: Math.ceil(1500 * 1.6 / all.length), farMax: Math.ceil(4200 * 1.6 / all.length), kind: 'wood',
			density: (e) => e.path > 0.12 || e.sl > 0.62 || e.h < 3 ? 0 : (e.forest * 0.85 * (0.8 + 0.2 * e.clump(0.05, 0.3, 0.8)) + e.meadow * 0.004) * standShare(ti, e) })),
		{ key: 'banana', variants: [0, 1].map((v) => banana(island.seed * 13 + v)), mats: ['bstem', 'banana'], spacing: 4, near: 90, max: 500, kind: 'soft',
			density: (e) => e.path > 0.2 || e.sl > 0.45 || e.h < 2 ? 0 : (e.gully * 0.5 * e.clump(0.04, 0.5, 0.7) + e.garden * 0.3 * e.clump(0.06, 0.55, 0.7)) },
		{ key: 'fern', variants: [0, 1].map((v) => fern(island.seed * 17 + v, flora?.understory[0])), mats: ['fern'], spacing: 3, near: 50, max: 700, kind: 'soft', noShadow: true,
			density: (e) => e.path > 0.15 || e.sl > 0.6 ? 0 : e.forest * 0.22 * (0.5 + e.moist) + e.gully * 0.2 },
		{ key: 'hibiscus', variants: [0, 1].map((v) => bloom(island.seed * 41 + v)), mats: ['bark', 'hibiscus'], spacing: 5, near: 110, max: 260, kind: 'soft',
			density: (e) => e.path > 0.25 || e.sl > 0.4 || e.h < 1.8 ? 0 : e.yard * 0.22 + e.edge * 0.012 },
		{ key: 'bougainvillea', variants: [0, 1].map((v) => bloom(island.seed * 43 + v)), mats: ['bark', 'bougainvillea'], spacing: 6, near: 110, max: 220, kind: 'soft',
			density: (e) => e.path > 0.25 || e.sl > 0.45 || e.h < 1.8 ? 0 : e.yard * 0.08 + e.edge * 0.03 * e.clump(0.03, 0.55, 0.7) },
		{ key: 'shrub', variants: [0, 1].map((v) => shrub(island.seed * 19 + v)), mats: ['bark', 'leaf'], spacing: 4, near: 120, max: 500, kind: 'soft',
			density: (e) => e.path > 0.2 || e.sl > 0.55 || e.h < 1.8 ? 0 : e.edge * 0.3 + e.forest * 0.05 + e.meadow * 0.006 },
		...(flora ? [
			{ key: 'treefern', variants: [0, 1].map((v) => treefern(island.seed * 59 + v, flora.understory[1])), mats: ['stem', 'fern'], spacing: 5, near: 110, max: 300, kind: 'soft',
				density: (e) => e.path > 0.2 || e.sl > 0.55 || e.h < 3 ? 0 : (e.gully * 0.3 * e.clump(0.04, 0.4, 0.7) + e.forest * e.moist * 0.08) * (0.6 + flora.profile.rain * 0.6) },
			{ key: 'taro', variants: [0, 1].map((v) => taro(island.seed * 61 + v, flora.understory[2])), mats: ['stem', 'plainleaf'], spacing: 3, near: 70, max: 400, kind: 'soft', noShadow: true,
				density: (e) => e.path > 0.2 || e.sl > 0.5 || e.h < 1.5 ? 0 : (e.gully * 0.28 + e.moist * e.forest * 0.12) * e.clump(0.06, 0.45, 0.7) * (0.5 + flora.profile.rain) },
			{ key: 'pandanus', variants: [0, 1].map((v) => pandanus(island.seed * 67 + v, flora.understory[3])), mats: ['bark', 'plainleaf'], spacing: 6, near: 160, max: 250, kind: 'wood',
				density: (e) => e.path > 0.2 || e.h < 0.9 || e.sl > 0.4 ? 0 : (e.strand * 0.12 + e.headland * 0.08) * e.clump(0.03, 0.45, 0.75) },
			...flora.flowers.map((g, fi) => ({ key: g.key, variants: [0, 1].map((v) => wildflower(island.seed * 71 + v + fi * 13, g)), mats: ['plainleaf'], spacing: 2.2, near: 60, max: 900, kind: 'soft', noShadow: true,
				density: (e) => e.path > 0.2 || e.sl > 0.45 || e.h < 1.2 ? 0 : (g.habit === 'meadow' ? e.meadow * 0.16 : e.edge * 0.14 + e.yard * 0.06) * e.clump(0.045, 0.5 + fi * 0.03, 0.75) * (0.5 + flora.profile.bloom) })),
		] : []),
		{ key: 'nuts', derived: true, variants: [0, 1, 2].map((v) => coconuts(island.seed * 29 + v)), mats: ['stem'], near: 60, max: 300, kind: 'wood', noShadow: true },
		{ key: 'deadfrond', derived: true, variants: [0, 1].map((v) => deadFrond(island.seed * 31 + v)), mats: ['frond'], near: 80, max: 400, kind: 'soft', noShadow: true },
		{ key: 'driftwood', variants: [0, 1, 2].map((v) => driftwood(island.seed * 37 + v)), mats: ['bark'], spacing: 9, near: 110, max: 200, kind: 'wood',
			density: (e) => e.h > 0.35 && e.h < 1.3 && e.village < 0.2 && e.path < 0.2 ? 0.12 * e.clump(0.03, 0.5, 0.7) : 0 },
		{ key: 'tiderock', variants: [0, 1, 2].map((v) => tideRock(island.seed * 53 + v)), mats: ['stone'], spacing: 7, near: 360, max: 300, kind: 'stone', wet: true,
			density: (e) => e.h > 2.8 || e.h < -2.2 ? 0 : e.headland * 0.75 * (0.4 + 0.6 * e.clump(0.05, 0.3, 0.6)) },
		{ key: 'boulder', variants: [0, 1].map((v) => boulder(island.seed * 23 + v)), mats: ['stone'], spacing: 10, near: 320, max: 400, kind: 'stone',
			density: (e) => e.path > 0.3 || e.h < 0.2 ? 0 : smoothstep(0.3, 0.55, e.sl) * 0.35 * e.clump(0.03, 0.4, 0.7) + e.summit * 0.08 + e.headland * 0.1 },
	];
	const SHADOW_R = 55;
	// stands: each tree species holds a centre in the community field's range and
	// prefers its habitat; the shares sum to one, so the forest is as dense as before
	// but a stretch of it belongs to one or two species
	function standShare(ti, e) {
		if (!flora) return 1;
		const T = flora.trees, n = T.length, c = flora.community(e.x, e.z);
		let sum = 0, mine = 0;
		for (let i = 0; i < n; i++) {
			const centre = 0.3 + 0.4 * (i + 0.5) / n, w0 = 0.42 / n;
			const L = T[i].likes;
			let w = Math.exp(-Math.pow((c.primary - centre) / w0, 2)) + 0.04;
			w *= 0.4 + L.core * e.forest + L.edge * e.edge * 1.5 + L.gully * e.gully * 1.5 + L.ridge * Math.max(0, -e.moist + 0.2);
			if (c.secondary > 0.72 && i === Math.floor(c.secondary * 97) % n) w += 0.3;        // an accent tree
			sum += w; if (i === ti) mine = w;
		}
		return sum > 0 ? mine / sum : 1 / n;
	}

	// ---------- ecology: where things grow, from the shape of the land ----------
	// forest stands on slopes and in hollows, open meadow on the gentle ground around the
	// village and on windswept ridges, a coconut belt on the strand, gardens and yards at
	// the houses, scrub along every forest edge, bananas in the damp gullies.
	// Baked once onto a 5 m grid; plants and the ground shaders read it.
	const V2 = island.village;
	const ecoNoise = makeNoise(island.seed + 505);
	const EG = 5, ER = island.R * 1.25, EN = Math.ceil(ER * 2 / EG) + 1;
	const FIELDS = ['forest', 'edge', 'meadow', 'moist', 'gully', 'strand', 'garden', 'summit', 'headland'];
	const grid = {};
	for (const f of FIELDS) grid[f] = new Float32Array(EN * EN);
	for (let j = 0; j < EN; j++) for (let i = 0; i < EN; i++) {
		const x = -ER + i * EG, z = -ER + j * EG, h = island.heightAt(x, z), k = j * EN + i;
		if (h < -2.5) continue;
		const cd = island.coastAt(x, z), sl = 1 - island.normalAt(x, z).y;   // metres to the water
		let ring = 0;
		for (let q = 0; q < 8; q++) { const a = q * 0.785; ring += island.heightAt(x + Math.cos(a) * 60, z + Math.sin(a) * 60); }
		const conc = clamp((ring / 8 - h) / 8, -1, 1);                     // + hollow, - ridge
		const dv = Math.hypot(x - V2.x, z - V2.z);
		// the headland arms round the cove: jungle right down to the rocks
		let armK = 0;
		if (V2.bay) {
			const bx = x - V2.bay.x, bz = z - V2.bay.z, br = Math.hypot(bx, bz), ba = bx * V2.seaDir.x + bz * V2.seaDir.z;
			const bs = Math.abs(-bx * V2.seaDir.z + bz * V2.seaDir.x);
			// only the two arms either side of the cove, not the slope behind the village
			armK = smoothstep(V2.bay.r + 2, V2.bay.r + 30, br) * smoothstep(V2.bay.r + 200, V2.bay.r + 110, br) * smoothstep(V2.bay.r * 1.05, V2.bay.r * 0.5, ba) * smoothstep(V2.bay.r * 0.55, V2.bay.r * 0.9, bs);
		}
		// the village keeps its fields open behind it, not on the arms of the bay
		const clearing = Math.max(smoothstep(80, 160, dv), armK);
		const alt = h / island.peak.h;
		const patch = smoothstep(0.3, 0.7, ecoNoise.fbm(x * 0.0028 + 7, z * 0.0028 - 3, 3)); // stands and glades
		let f = patch + armK * 0.8 + Math.max(0, conc) * 0.6 - Math.max(0, -conc) * 0.3 + smoothstep(0.06, 0.3, sl) * 0.4 + smoothstep(0.15, 0.5, alt) * 0.15;
		f -= smoothstep(0.8, 0.95, alt) * 0.8;                            // a bare summit
		f -= smoothstep(40, 10, cd) * smoothstep(0.35, 0.1, sl) * 0.7;      // salt and sand on the low shore
		const ground = clearing * smoothstep(2.5, 5, h);
		const forest = smoothstep(0.47, 0.59, f) * ground, wide = smoothstep(0.36, 0.59, f) * ground;
		grid.forest[k] = forest;
		grid.edge[k] = Math.min(1, Math.max(0, wide - forest) * 1.6);
		grid.meadow[k] = (1 - wide) * smoothstep(2, 4, h);
		grid.moist[k] = Math.max(0, conc);
		grid.gully[k] = smoothstep(0.25, 0.6, conc) * smoothstep(2, 5, h) * (1 - smoothstep(0.5, 0.8, alt));
		grid.strand[k] = smoothstep(5, 12, cd) * (1 - smoothstep(45, 80, cd)) * (1 - smoothstep(0.25, 0.45, sl));
		grid.garden[k] = smoothstep(130, 90, dv) * smoothstep(35, 60, dv);
		grid.summit[k] = smoothstep(0.85, 0.95, alt);
		// rocky shore: the two points of the bay's headland arms, and patches along
		// the outer coast where the land meets the sea over rock instead of sand
		let point = 0;
		if (V2.bay) {
			const bx = x - V2.bay.x, bz = z - V2.bay.z, br = Math.hypot(bx, bz), ba = bx * V2.seaDir.x + bz * V2.seaDir.z;
			point = smoothstep(V2.bay.r * 0.35, V2.bay.r * 0.8, ba) * smoothstep(V2.bay.r + 150, V2.bay.r + 20, br) * smoothstep(V2.bay.r - 25, V2.bay.r + 5, br);
		}
		const rockyShore = smoothstep(0.62, 0.75, ecoNoise.fbm(x * 0.004 - 20, z * 0.004 + 31, 3)) * (1 - smoothstep(160, 90, dv));
		grid.headland[k] = Math.max(point, rockyShore) * smoothstep(34, 4, cd);
	}
	const gAt = (f, x, z) => {
		const fx = clamp((x + ER) / EG, 0, EN - 1.001), fz = clamp((z + ER) / EG, 0, EN - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * EN + i, a = grid[f];
		return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + EN] * (1 - u) + a[k + EN + 1] * u) * v;
	};
	function eco(x, z, h, sl, m) {
		const e = { x, z, h, sl, path: m.path, village: m.village, yard: smoothstep(0.15, 0.5, m.village),
			clump: (sc, lo, hi) => smoothstep(lo, hi, ecoNoise.fbm(x * sc + sc * 91, z * sc - sc * 37, 2)) };
		for (const f of FIELDS) e[f] = gAt(f, x, z);
		return e;
	}
	// the ground knows where the forest is: the wild-growth mask becomes the canopy map,
	// so forest floor, grass and leaf litter all follow the trees
	{
		const M = island.masks, N = island.N;
		for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
			const x = -island.half + i * island.cell, z = -island.half + j * island.cell;
			M[(j * N + i) * 4 + 3] = Math.round(Math.min(1, gAt('forest', x, z) + gAt('edge', x, z) * 0.35) * 255);
			// on land the blue channel carries how tall the grass grows: bunch grass in the
			// open meadows and damp hollows, in drifts; short on ridges, by paths and houses
			const h = island.height[j * N + i];
			if (h > 0.3) {
				const meadow = gAt('meadow', x, z), moist = gAt('moist', x, z);
				const drift = smoothstep(0.35, 0.7, ecoNoise.fbm(x * 0.011 + 40, z * 0.011 - 12, 3));
				const k = M[(j * N + i) * 4 + 1] / 255, path = M[(j * N + i) * 4] / 255;
				const tall = meadow * (0.25 + 0.5 * drift + 0.6 * moist) * (1 - k * 0.9) * (1 - path) * (1 - gAt('summit', x, z));
				M[(j * N + i) * 4 + 2] = Math.round(clamp(tall, 0, 1) * 255);
			}
		}
		if (shared.maskTex) shared.maskTex.needsUpdate = true;
	}

	// scatter once into cells
	const cells = new Map();
	const rnd = mulberry32(island.seed ^ 0xabc);
	const reach = island.R * 1.2;
	const derived = (key, px, pz, off) => {
		const sp = species.find((q) => q.key === key), h = island.heightAt(px, pz);
		if (h < 0.3 || island.maskAt(px, pz, 0) > 0.3) return;
		const ck = Math.floor(px / CELL) + ',' + Math.floor(pz / CELL);
		let c = cells.get(ck);
		if (!c) cells.set(ck, c = { x: Math.floor(px / CELL), z: Math.floor(pz / CELL), items: {} });
		(c.items[key] || (c.items[key] = [])).push({ x: px, y: h - off, z: pz, rot: rnd() * 6.283, scale: 0.85 + rnd() * 0.3, v: Math.floor(rnd() * sp.variants.length), tint: 0.8 + rnd() * 0.35 });
	};
	for (const sp of species) {
		if (sp.derived) continue;
		const s = sp.spacing;
		for (let z = -reach; z < reach; z += s) for (let x = -reach; x < reach; x += s) {
			const px = x + rnd() * s, pz = z + rnd() * s;
			const h = island.heightAt(px, pz);
			if (h < (sp.wet ? -2.2 : 0.2)) continue;
			const n = island.normalAt(px, pz), sl = 1 - n.y;
			const m = { path: island.maskAt(px, pz, 0), village: island.maskAt(px, pz, 1), wild: island.maskAt(px, pz, 3) };
			if (rnd() >= sp.density(eco(px, pz, h, sl, m))) continue;
			const key = Math.floor(px / CELL) + ',' + Math.floor(pz / CELL);
			let c = cells.get(key);
			if (!c) cells.set(key, c = { x: Math.floor(px / CELL), z: Math.floor(pz / CELL), items: {} });
			(c.items[sp.key] || (c.items[sp.key] = [])).push({
				x: px, y: h - (sp.key === 'boulder' ? 0.35 : sp.key === 'tiderock' ? 0.5 : 0.05), z: pz, rot: rnd() * 6.283, scale: sp.key === 'boulder' ? 0.6 + rnd() * 1.6 : sp.key === 'tiderock' ? 1.2 + rnd() * 2.8 : 0.8 + rnd() * 0.45,
				v: Math.floor(rnd() * sp.variants.length), tint: 0.85 + rnd() * 0.3,
			});
			// coconut palms lean out over the beach, toward the light and the sea
			if (sp.key === 'palm') {
				const it = c.items.palm[c.items.palm.length - 1];
				it.rot = sp.variants[it.v].lean - Math.atan2(pz, px) + (rnd() - 0.5) * 0.9;
			}
			// ferns gather in the damp shade at the foot of the big trees
			if (sp.tree) {
				const n = rnd() < 0.7 ? 1 + Math.floor(rnd() * 3) : 0;
				for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = 1.1 + rnd() * 1.6; derived('fern', px + Math.cos(a) * d, pz + Math.sin(a) * d, 0.02); }
			}
			// palms drop their nuts and old fronds around the base
			if (sp.key === 'palm') {
				if (rnd() < 0.55) derived('nuts', px + (rnd() - 0.5) * 2.5, pz + (rnd() - 0.5) * 2.5, 0.04);
				if (rnd() < 0.6) derived('deadfrond', px + (rnd() - 0.5) * 3, pz + (rnd() - 0.5) * 3, 0.02);
			}
		}
	}

	// instanced meshes per species / variant / part / lod
	const group = new THREE.Group();
	group.name = 'vegetation';
	const pickables = [];
	for (const sp of species) {
		sp.meshes = [];
		const lods = [['close', sp.variants], ['near', sp.mid || (sp.midIsFar ? sp.far : sp.variants)]];
		if (sp.far) lods.push(['far', sp.far]);
		for (const [lod, variants] of lods) {
			variants.forEach((vdef, vi) => {
				vdef.parts.forEach((geo, pi) => {
					const mm = mats[sp.mats[pi]];
					const cap = lod === 'close' ? Math.min(sp.max, 160) : lod === 'far' ? (sp.farMax || sp.max) : sp.max;
					// its own copy of the shape, to carry each plant's share of the dissolve
					const g2 = geo.clone();
					g2.setAttribute('aFade', new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2));
					const im = new THREE.InstancedMesh(g2, mm.material, cap);
					im.count = 0;
					im.castShadow = lod === 'close' && !sp.noShadow;
					im.receiveShadow = lod !== 'far';
					if (mm.depth) im.customDepthMaterial = mm.depth;
					im.frustumCulled = false;
					im.userData.material175 = sp.kind;
					im.userData.species = sp.key;
					im.userData.cap = cap;
					im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
					group.add(im);
					sp.meshes.push({ im, lod, vi });
					if (lod !== 'far') pickables.push(im);
				});
			});
		}
	}
	scene.add(group);
	for (const k in mats) addLodFade(mats[k].material, 'attribute');

	// ground occupancy: where anything stands, the soil under it is shaded, bare and
	// damp, and the grass thins toward the stem. A small map around the player that
	// the terrain and grass shaders both read, redrawn as the player moves.
	// [radius, bare shade, mound/hug]: trees and rocks shade bare earth; small plants
	// sit on a little mound the grass crowds into
	const CONTACT = { palm: [2.4, 0.75, 0.5], hardwood: [3.8, 0.85, 0.55], treefern: [1.5, 0.35, 0.6], taro: [1.0, 0.12, 0.9], pandanus: [2.2, 0.5, 0.4], banana: [1.7, 0.2, 1.0], shrub: [1.8, 0.15, 1.0], hibiscus: [1.9, 0.15, 1.0], bougainvillea: [2.0, 0.15, 1.0], boulder: [2.0, 0.7, 0.4], tiderock: [3.0, 0.5, 0.0], fern: [1.1, 0.1, 0.8], driftwood: [1.6, 0.5, 0.2], nuts: [0.7, 0.4, 0.0] };
	const OCC = shared.occ, OS = OCC.image.width, OSPAN = shared.uOccO.value.z, occData = OCC.image.data;
	const contacts = [], extra = [];

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
	// a species' detail tiers and their hand-over bands [a0, a1] in and [b0, b1] out
	function tiersOf(sp, R) {
		if (sp.tiers) return sp.tiers;
		const W1 = 10, W2 = Math.max(18, sp.near * 0.15), end = [R * 0.84, R];
		const t = [{ lod: 'close', a0: -2, a1: -1, b0: SHADOW_R - W1, b1: SHADOW_R }];
		t.push({ lod: 'near', a0: SHADOW_R - W1, a1: SHADOW_R, b0: sp.far ? sp.near - W2 : sp.near * 0.84, b1: sp.far ? sp.near : sp.near });
		if (sp.far) t.push({ lod: 'far', a0: sp.near - W2, a1: sp.near, b0: end[0], b1: end[1] });
		return (sp.tiers = t);
	}
	let lastX = 1e9, lastZ = 1e9;
	function stream(cam, force) {
		const cx = cam.position.x, cz = cam.position.z;
		if (!force && Math.hypot(cx - lastX, cz - lastZ) < 6) return;
		lastX = cx; lastZ = cz;
		for (const sp of species) for (const m of sp.meshes) m.im.count = 0;
		contacts.length = 0;
		for (const sp of species) {
			const cs = sp.tree ? CONTACT.hardwood : CONTACT[sp.key];
			const R = sp.farR || sp.near, cr = Math.ceil(R / CELL);
			const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL);
			const lim = sp.max;
			for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
				const c = cells.get(i + ',' + j);
				if (!c || !c.items[sp.key]) continue;
				for (const it of c.items[sp.key]) {
					const d = Math.hypot(it.x - cx, it.z - cz);
					if (d > R) continue;
					if (cs && d < OSPAN * 0.72) contacts.push(it.x, it.z, cs[0] * (sp.key === 'boulder' ? it.scale : it.scale * 0.9 + 0.1), cs[1], cs[2]);
					q.setFromAxisAngle(UP, it.rot);
					sc.setScalar(it.scale);
					pos.set(it.x, it.y, it.z);
					m4.compose(pos, q, sc);
					col.setScalar(it.tint);
					// the tiers this plant is in: across each hand-over band, both, sharing its pixels
					for (const T of tiersOf(sp, R)) {
						if (d < T.a0 - 7 || d > T.b1 + 7) continue;
						const lod = T.lod, [f0, f1] = fadeRange(d, T.a0, T.a1, T.b0, T.b1);
						if (f1 <= f0) continue;
						const vi = lod === 'far' ? it.v % sp.far.length : lod === 'near' && sp.midIsFar ? it.v % sp.far.length : it.v;
						for (const m of sp.meshes) {
							if (m.lod !== lod || m.vi !== vi || m.im.count >= m.im.userData.cap) continue;
							m.im.setMatrixAt(m.im.count, m4);
							m.im.setColorAt(m.im.count, col);
							const fa = m.im.geometry.attributes.aFade;
							fa.array[m.im.count * 2] = f0; fa.array[m.im.count * 2 + 1] = f1;
							m.im.count++;
						}
					}
				}
			}
		}
		// houses: trodden, shaded ground round every foundation
		for (const f of extra) if (Math.hypot(f.x - cx, f.z - cz) < OSPAN * 0.72) contacts.push(f.x, f.z, Math.max(f.w, f.d) * 0.85, 0.6, 0);
		// rasterise the soft discs into the occupancy map, centred on the player
		const ox = Math.round(cx / 4) * 4 - OSPAN / 2, oz = Math.round(cz / 4) * 4 - OSPAN / 2, px = OS / OSPAN;
		occData.fill(0);
		for (let k = 0; k < contacts.length; k += 5) {
			const x = (contacts[k] - ox) * px, z = (contacts[k + 1] - oz) * px, R = contacts[k + 2] * px, str = contacts[k + 3], hug = contacts[k + 4];
			const i0 = Math.max(0, Math.floor(x - R)), i1 = Math.min(OS - 1, Math.ceil(x + R)), j0 = Math.max(0, Math.floor(z - R)), j1 = Math.min(OS - 1, Math.ceil(z + R));
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const d = Math.hypot(i + 0.5 - x, j + 0.5 - z) / R;
				if (d >= 1) continue;
				// broad soft shade plus a dark, damp core right at the foot
				const v = Math.min(1, Math.pow(1 - d * d, 1.5) * str + Math.pow(Math.max(0, 1 - d * 2.6), 2) * 0.5 * str) * 255, o = (j * OS + i) * 2;
				if (v > occData[o]) occData[o] = v;
				// the mound: a smooth dome, highest at the stem
				const m = Math.pow(Math.max(0, 1 - d * 1.15), 2) * hug * 255;
				if (m > occData[o + 1]) occData[o + 1] = m;
			}
		}
		OCC.needsUpdate = true;
		shared.uOccO.value.set(ox, oz, OSPAN);
		for (const sp of species) for (const m of sp.meshes) {
			m.im.instanceMatrix.needsUpdate = true; m.im.geometry.attributes.aFade.needsUpdate = true;
			if (m.im.instanceColor) m.im.instanceColor.needsUpdate = true;
			m.im.computeBoundingSphere();
		}
	}
	// solid trunks and boulders the walker bumps into
	const solidKeys = ['palm', 'boulder', 'tiderock', 'pandanus', 'treefern', ...species.filter((q) => q.tree).map((q) => q.key)];
	function obstacles(x, z, r) {
		const out = [];
		const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
		for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
			const c = cells.get(i + ',' + j);
			if (!c) continue;
			for (const k of solidKeys) for (const it of c.items[k] || []) {
				const rad = k === 'boulder' ? it.scale * 1.0 : k === 'tiderock' ? it.scale * 1.3 : 0.35 * it.scale;
				if (Math.hypot(it.x - x, it.z - z) < r + rad + 1) out.push({ x: it.x, z: it.z, r: rad });
			}
		}
		return out;
	}
	// buildings: shade the ground round them and clear any plant standing where they stand
	const addContacts = (list) => {
		for (const f of list) {
			if (f.fence) continue;
			const rad = f.pier ? 0 : Math.max(f.w, f.d) * 0.62 + 0.8;
			if (!f.pier) extra.push(f);
			const ci = Math.floor(f.x / CELL), cj = Math.floor(f.z / CELL);
			for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
				const c = cells.get(i + ',' + j);
				if (!c) continue;
				for (const k in c.items) c.items[k] = c.items[k].filter((it) => {
					if (f.pier) {
						// keep the pier and its landing clear
						const dx = it.x - f.x, dz = it.z - f.z, c0 = Math.cos(f.face), s0 = Math.sin(f.face);
						const lx = dx * c0 - dz * s0, lz = dx * s0 + dz * c0;
						return !(Math.abs(lx) < f.w / 2 + 2 && lz > -6 && lz < f.len);
					}
					return Math.hypot(it.x - f.x, it.z - f.z) > rad;
				});
			}
		}
		if (lastX < 1e8) stream({ position: { x: lastX, z: lastZ } }, true);
	};
	return { group, stream, pickables, obstacles, species, cells, eco, addContacts };
}
