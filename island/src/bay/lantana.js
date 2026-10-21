// Yellow lantana and variegated flax lily, the planting in the city's sidewalk planters
// (from Josh's photos of raised concrete planters on a Bay Area street). Lantana camara in
// a yellow cultivar: domed heads of small four-lobed florets, golden-orange in the throat;
// on an older head the outer florets fade to cream and white; a young head is a ring of
// open florets round a centre of cream buds; tight green bud balls and spiky green seed
// heads among them; rough, toothed dark leaves in opposite pairs; spent florets dropped on
// the concrete. Between the lantana, clumps of flax lily: long arching strap leaves, sage
// green with cream margins.
//
// A planter is planted in beds 1.4 m long, each bed one instance holding all of its plants,
// so a planter is two or three instances rather than dozens. Three detail levels from one
// plan (so they dissolve into each other without anything moving): every floret and leaf
// tooth close by; at street distance each head a little dome and each leaf a blade; far off
// yellow points on the green. Each level is two parts: the plants, coloured in their
// vertices (one plain swaying material), and the foliage's mass as leaf-cluster cards,
// drawn exactly as the city's shrubs' leaves are, so it costs no shader of its own.

import { Builder, tube, card, V } from '../world/vegetation.js';
import { mulberry32 } from '../noise.js';

export const BED_LEN = 1.4, BED_DEPTH = 1.14;

// colours in linear light. The swaying material darkens a plant toward its foot (its ground
// shade, by height in the model); a flower is lifted back out of it, a leaf only partly
const C = (r, g, b) => ({ r, g, b });
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const shade = (y) => 0.42 + 0.58 * sm(-0.1, 1.3, y);
const lift = (c, y, k = 1) => { const s = Math.pow(1 / shade(y), k); return C(c.r * s, c.g * s, c.b * s); };
const mix = (a, b, t) => C(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
const mul = (c, s) => C(c.r * s, c.g * s, c.b * s);
const YELLOW = C(0.93, 0.6, 0.05), GOLD = C(0.86, 0.36, 0.012), CREAM = C(0.92, 0.84, 0.52), WHITE = C(0.95, 0.93, 0.8);
const BUD = C(0.88, 0.74, 0.36), BUD_GREEN = C(0.36, 0.5, 0.16), SEED = C(0.34, 0.48, 0.14), SPENT = C(0.5, 0.36, 0.16);
const LEAF_CARD = C(0.2, 0.3, 0.15), LEAF = C(0.05, 0.115, 0.034), LEAF_YOUNG = C(0.075, 0.16, 0.045), STEM = C(0.15, 0.2, 0.075), MULCH = C(0.07, 0.05, 0.035);
const FLAX = C(0.22, 0.38, 0.11), FLAX_EDGE = C(0.72, 0.72, 0.46);

// a frame on a plane facing n
function frame(n) {
	const t1 = (Math.abs(n.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).cross(n).normalize();
	return [t1, n.clone().cross(t1).normalize()];
}

// one floret: four rounded lobes (one a little larger) round an orange throat, slightly cupped
function floret(b, c, n, r, rnd, petal, eye, sway) {
	const [t1, t2] = frame(n), rot = rnd() * 6.283, big = Math.floor(rnd() * 4);
	const ci = b.vert(c.clone().addScaledVector(n, -r * 0.22), n, [0.5, 0.5], eye, sway), ids = [];
	for (let k = 0; k < 12; k++) {
		const lobe = Math.floor(k / 3), j = k % 3, a = rot + lobe * Math.PI / 2 + [-0.5, 0.5, 0.785][j];
		const rad = r * [0.95, 0.95, 0.62][j] * (lobe === big && j < 2 ? 1.18 : 1);
		const dir = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
		const p = c.clone().addScaledVector(dir, rad).addScaledVector(n, r * (rnd() - 0.5) * 0.18);
		ids.push(b.vert(p, n.clone().addScaledVector(dir, 0.3).normalize(), [0.5, 0.5], j === 2 ? mix(petal, eye, 0.15) : petal, sway));
	}
	for (let k = 0; k < 12; k++) b.tri(ci, ids[k], ids[(k + 1) % 12]);
}
// a bud: a little four-sided spike pointing out of the head, its tip paler
function bud(b, c, dir, len, wid, base, tip, sway) {
	const [t1, t2] = frame(dir), apex = b.vert(c.clone().addScaledVector(dir, len), dir, [0.5, 1], tip, sway), ids = [];
	for (let k = 0; k < 4; k++) {
		const a = k * Math.PI / 2 + 0.4, o = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
		ids.push(b.vert(c.clone().addScaledVector(o, wid), o.clone().addScaledVector(dir, 0.5).normalize(), [0.5, 0], base, sway));
	}
	for (let k = 0; k < 4; k++) b.tri(ids[k], ids[(k + 1) % 4], apex);
}
// a small faceted ball (an octahedron)
function knob(b, c, r, col, sway) {
	const P = [V(1, 0, 0), V(0, 0, 1), V(-1, 0, 0), V(0, 0, -1)], top = V(0, 1, 0), bot = V(0, -1, 0);
	const it = b.vert(c.clone().addScaledVector(top, r), top, [0.5, 1], col, sway), ib = b.vert(c.clone().addScaledVector(bot, r * 0.7), bot, [0.5, 0], mul(col, 0.7), sway);
	const ids = P.map((p) => b.vert(c.clone().addScaledVector(p, r), p, [0.5, 0.5], col, sway));
	for (let k = 0; k < 4; k++) { b.tri(ids[k], ids[(k + 1) % 4], it); b.tri(ids[(k + 1) % 4], ids[k], ib); }
}
// a point on a head's dome: polar angle th from its axis, round by ph
function onDome(h, th, ph, R) {
	const [t1, t2] = frame(h.ax);
	const dir = h.ax.clone().multiplyScalar(Math.cos(th)).addScaledVector(t1, Math.sin(th) * Math.cos(ph)).addScaledVector(t2, Math.sin(th) * Math.sin(ph)).normalize();
	return [h.c.clone().addScaledVector(dir, R), dir];
}

// ---------- the plan: where every shoot, leaf and head goes, shared by all three levels ----------
// a leaf's face: the sky's direction, square to the leaf's own
const upFrom = (dir) => V(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
function lantanaPlan(r, at, spread, height, bounds) {
	// the plant is a dense, lumpy mound of leaves (its mass, so no gap shows the soil), and
	// over it short shoots, each a few pairs of leaves and a head at its tip; those near the
	// planter's lip lean out over it and droop down its face
	const ph = [0, 1, 2, 3].map(() => r() * 6.283);
	const mound = { at, rx: Math.min(spread * 0.92, bounds.x + 0.04 - Math.abs(at.x) * 0.6), ry: height * 0.78, rz: Math.min(spread * 0.85, bounds.z + 0.03 - Math.abs(at.z) * 0.5), ph };
	const shoots = [], n = Math.round(spread * 34 + r() * 3);
	for (let i = 0; i < n; i++) {
		// from a point on the mound (mostly its upper part), outward and up
		const th = Math.acos(1 - r() * 0.75) * 1.1, pa = i / n * 6.283 * 2.618 + r() * 0.6;
		const [s0, nrm] = moundAt(mound, th, pa, 0.93), out = V(nrm.x, 0, nrm.z).normalize();
		const lip = Math.abs(s0.z) > bounds.z - 0.16 && Math.sign(nrm.z) === Math.sign(s0.z) && th > 0.7;
		const len = lip ? 0.14 + r() * 0.1 : 0.11 + r() * 0.09;
		const dir = lip ? out.clone().add(V(0, 0.25, 0)).normalize() : nrm.clone().add(V(0, 0.9, 0)).normalize();
		const spill = lip ? 0.05 + r() * 0.1 : 0, side = V(-out.z, 0, out.x);
		const pts = [];
		for (let k = 0; k <= 3; k++) { const t = k / 3; pts.push(s0.clone().addScaledVector(dir, len * t).add(V(0, -spill * t * t + (lip ? 0 : 0.03 * Math.sin(t * 3)), 0))); }
		const tipDir = pts[3].clone().sub(pts[2]).normalize();
		const heads = [], leaves = [];
		const kindOf = () => { const q = r(); return q < 0.4 ? 'dome' : q < 0.62 ? 'ring' : q < 0.76 ? 'old' : q < 0.89 ? 'budball' : 'seed'; };
		const headAt = (c, ax) => ({ c, ax, kind: kindOf(), R: 0.028 + r() * 0.008, seed: Math.floor(r() * 1e9) });
		// (a drooping shoot's head still turns up to the light)
		heads.push(headAt(pts[3].clone().add(V(0, 0.02, 0)), tipDir.clone().multiplyScalar(lip ? 0.5 : 0.3).add(V(0, 1, 0)).normalize()));
		if (r() < 0.5) {
			const p = pts[1].clone().lerp(pts[2], 0.5), sd = r() < 0.5 ? 1 : -1;
			heads.push(headAt(p.clone().addScaledVector(side, sd * 0.06).add(V(0, 0.05 + r() * 0.03, 0)), V(sd * side.x * 0.3, 1, sd * side.z * 0.3).normalize()));
		}
		// leaves in opposite pairs up the shoot, each pair crossed on the last
		for (let k = lip ? 0 : 1; k < 3; k++) {
			const t = 0.2 + k * 0.28, seg = Math.min(2, Math.floor(t * 3)), u = t * 3 - seg;
			const base = pts[seg].clone().lerp(pts[seg + 1], u), along = pts[seg + 1].clone().sub(pts[seg]).normalize();
			const across = (k % 2 ? along.clone().cross(V(0, 1, 0)) : V(0, 1, 0)).normalize(), perp = along.clone().cross(across).normalize();
			const size = (1.2 - t * 0.4) * (0.85 + r() * 0.3);
			for (const sd of [-1, 1]) {
				// out to the side, turned up to the light, leaning a little toward the shoot's tip
				const w = (k % 2 ? across : perp).clone().multiplyScalar(sd);
				const d = w.clone().addScaledVector(along, 0.5).add(V(0, 0.2, 0)).normalize();
				leaves.push({ base, dir: d, up: upFrom(d), len: 0.085 * size, wid: 0.045 * size, tone: 0.8 + r() * 0.4, young: t > 0.7 && r() < 0.6, droop: 0.2 + r() * 0.25 });
			}
		}
		shoots.push({ pts, heads, leaves });
	}
	// the mound's face: leaf-cluster cards over it (drawn with the city's shrub leaves), and
	// among them a few leaves of the plant's own, standing out of it at their own angles
	const cards = [];
	for (let i = 0; i < Math.round(spread * 105); i++) {
		const th = Math.acos(1 - r() * 0.97) * 1.3, [p] = moundAt(mound, th, r() * 6.283, 0.84 + r() * 0.2);
		cards.push({ c: p, size: (0.26 + r() * 0.14) * Math.sqrt(spread / 0.62), tone: 0.8 + r() * 0.35, seed: Math.floor(r() * 1e9) });
	}
	const crown = [];
	for (let i = 0; i < Math.round(spread * 22); i++) {
		const th = Math.acos(1 - r() * 0.9) * 1.2, [p, nrm] = moundAt(mound, th, r() * 6.283, 0.9 + r() * 0.08);
		const tang = V(-nrm.z, 0, nrm.x).normalize().multiplyScalar(r() < 0.5 ? 1 : -1);
		const d = tang.multiplyScalar(0.5 + r() * 0.5).addScaledVector(nrm, 0.9).add(V((r() - 0.5) * 0.5, 0.25, (r() - 0.5) * 0.5)).normalize();
		crown.push({ base: p, dir: d, up: upFrom(d), len: 0.08 + r() * 0.035, wid: 0.044 + r() * 0.014, tone: 0.65 + r() * 0.45, young: r() < 0.2, droop: 0.2 + r() * 0.3 });
	}
	return { mound, shoots, crown, cards };
}
// a point on a plant's mound, th down from its top and pa round, and the outward normal there
function moundAt(M, th, pa, k) {
	const lump = 1 + 0.1 * Math.sin(3 * pa + M.ph[0]) * Math.sin(2.3 * th + M.ph[1]) + 0.07 * Math.sin(5 * pa + M.ph[2] + th * 3) + 0.05 * Math.sin(7.3 * pa + M.ph[3]);
	const sx = Math.sin(th) * Math.cos(pa), sy = Math.cos(th), sz = Math.sin(th) * Math.sin(pa);
	const p = V(M.at.x + sx * M.rx * lump * k, -0.03 + sy * M.ry * lump * k, M.at.z + sz * M.rz * lump * k);
	return [p, V(sx / M.rx, sy / M.ry, sz / M.rz).normalize()];
}
function flaxPlan(r, at, n, size) {
	const leaves = [], fan = r() * 3.14;
	for (let i = 0; i < n; i++) {
		// the strap leaves grow from a flat fan: spread along it more than across
		const a = fan + (r() - 0.5) * 2.4 + (r() < 0.5 ? Math.PI : 0), len = size * (0.6 + r() * 0.45), elev = 0.95 + r() * 0.5;
		leaves.push({ base: V(at.x + Math.cos(a) * 0.02, -0.02, at.z + Math.sin(a) * 0.02), a, len, elev, wid: 0.02 + r() * 0.007, tone: 0.85 + r() * 0.3, twist: (r() - 0.5) * 0.6 });
	}
	return leaves;
}

// ---------- drawing a plan at each level ----------
function leafDraw(b, L0, lvl, rnd) {
	// (further off a leaf is drawn larger, as the few that stand for many: at their true size
	// they would be a fraction of a pixel, and sparkle)
	const L = lvl === 0 ? L0 : { ...L0, len: L0.len * (lvl === 1 ? 1.2 : 2.2), wid: L0.wid * (lvl === 1 ? 1.2 : 2.2) };
	const side = L.dir.clone().cross(L.up).normalize(), col0 = mul(L.young ? LEAF_YOUNG : LEAF, L.tone);
	const at = (u, w) => L.base.clone().addScaledVector(L.dir, L.len * u).addScaledVector(side, w).addScaledVector(L.up, -L.droop * L.len * u * u);
	const half = (u) => L.wid * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.85);
	const col = (p, k = 0.5) => lift(col0, p.y, k), sw = (u) => 0.3 + 0.15 * u;
	const n = L.up.clone().addScaledVector(L.dir, -0.15).normalize();
	if (lvl === 2) {
		// far: a narrow diamond
		const p = [at(0, 0), at(0.45, half(0.45)), at(1, 0), at(0.45, -half(0.45))], ids = p.map((q) => b.vert(q, n, [0.5, 0.5], col(q), 0.35));
		b.tri(ids[0], ids[1], ids[2]); b.tri(ids[0], ids[2], ids[3]);
		return;
	}
	// the midrib raised along its length: the blade folds a little either side of it
	const mid = at(0.42, 0).addScaledVector(L.up, L.wid * 0.12), ci = b.vert(mid, n, [0.5, 0.5], mul(col(mid), 1.3), sw(0.42));
	const T = lvl === 0 ? 4 : 1, ring = [];
	ring.push(at(0, 0));
	for (let k = 1; k <= T * 2; k++) { const u = k / (T * 2 + 1); ring.push(at(u, half(u) * (lvl === 0 && k % 2 === 0 ? 0.8 : 1))); }
	ring.push(at(1, 0));
	for (let k = T * 2; k >= 1; k--) { const u = k / (T * 2 + 1); ring.push(at(u, -half(u) * (lvl === 0 && k % 2 === 0 ? 0.8 : 1))); }
	const ids = ring.map((q, k) => b.vert(q, n, [0.5, 0.5], mul(col(q), 0.92 + rnd() * 0.12), sw(k / ring.length)));
	for (let k = 0; k < ids.length; k++) b.tri(ci, ids[k], ids[(k + 1) % ids.length]);
}
function headDraw(b, h, lvl) {
	const r = mulberry32(h.seed), R = h.R, sway = 0.45;
	const k = h.kind;
	if (lvl === 2) {
		// far: a point of its colour (a small four-sided cap)
		const col = lift(k === 'budball' || k === 'seed' ? BUD_GREEN : k === 'old' ? mix(YELLOW, CREAM, 0.5) : YELLOW, h.c.y);
		if (k === 'seed') return;
		bud(b, h.c.clone().addScaledVector(h.ax, -R), h.ax, R * 2.2, R * 2.4, col, col, sway);
		return;
	}
	if (lvl === 1) {
		// street distance: a dome, orange-flecked yellow round the rim, its centre buds or eye
		if (k === 'seed') { knob(b, h.c, R * 0.45, lift(SEED, h.c.y), sway); return; }
		const rim = lift(k === 'budball' ? BUD_GREEN : k === 'old' ? mix(YELLOW, WHITE, 0.55) : YELLOW, h.c.y);
		const top = lift(k === 'budball' ? mix(BUD_GREEN, BUD, 0.3) : k === 'ring' ? BUD : k === 'old' ? mix(YELLOW, GOLD, 0.3) : mix(YELLOW, GOLD, 0.45), h.c.y);
		const n = 7, rr = k === 'budball' ? R * 0.6 : R, ids = [], low = [];
		const it = b.vert(h.c.clone().addScaledVector(h.ax, rr * 0.75), h.ax, [0.5, 1], top, sway);
		for (let i = 0; i < n; i++) {
			const ph = i / n * 6.283;
			const [p1, d1] = onDome(h, 1.0, ph, rr), [p2, d2] = onDome(h, 1.75, ph + 0.45, rr * 0.8);
			ids.push(b.vert(p1, d1, [0.5, 0.5], rim, sway)); low.push(b.vert(p2, d2, [0.5, 0], mul(rim, 0.7), sway));
		}
		for (let i = 0; i < n; i++) { const j = (i + 1) % n; b.tri(it, ids[i], ids[j]); b.tri(ids[i], low[i], ids[j]); b.tri(ids[j], low[i], low[j]); }
		return;
	}
	// close: every floret and bud
	const flo = (th, ph, R2, petal, eye) => { const [p, d] = onDome(h, th, ph, R2); floret(b, p, d, 0.0092 + r() * 0.0016, r, lift(petal, p.y), lift(eye, p.y), sway); };
	const buds = (n, thMax, col0, col1, len) => {
		for (let i = 0; i < n; i++) {
			const th = Math.sqrt(r()) * thMax, [p, d] = onDome(h, th, r() * 6.283, R * 0.55);
			bud(b, p, d, len * (0.8 + r() * 0.4), 0.0024, lift(col0, p.y), lift(col1, p.y), sway);
		}
	};
	if (k === 'seed') {
		// a spiky green burr: a knob with spines
		knob(b, h.c, R * 0.35, lift(SEED, h.c.y), sway);
		for (let i = 0; i < 12; i++) { const [p, d] = onDome(h, Math.acos(1 - 2 * r()), r() * 6.283, R * 0.3); bud(b, p, d, R * 0.55, 0.0016, lift(SEED, p.y), lift(mix(SEED, CREAM, 0.4), p.y), sway); }
		return;
	}
	if (k === 'budball') { knob(b, h.c, R * 0.42, lift(BUD_GREEN, h.c.y), sway); buds(18, 1.9, BUD_GREEN, mix(BUD_GREEN, BUD, 0.35), 0.008); return; }
	// the open heads: florets open from the rim inward, the centre still in bud
	const old = k === 'old', ring = k === 'ring';
	const petalAt = (th) => old ? mix(YELLOW, WHITE, Math.min(1, 0.35 + th * 0.45 + r() * 0.2)) : mix(YELLOW, CREAM, r() * 0.12 + (th > 1.2 ? 0.08 : 0));
	const eyeAt = () => old ? mix(GOLD, YELLOW, 0.5) : GOLD;
	// (a core under the florets, so no gap between them shows through the head)
	knob(b, h.c.clone().addScaledVector(h.ax, -R * 0.15), R * 0.78, lift(mix(GOLD, BUD_GREEN, 0.45), h.c.y, 0.6), sway);
	const rings = ring ? [[1.45, 8]] : old ? [[0.95, 6], [1.5, 9]] : [[0.6, 5], [1.2, 10]];
	for (const [th, n] of rings) { const o = r() * 6.283; for (let i = 0; i < n; i++) { const t2 = th + (r() - 0.5) * 0.12; flo(t2, o + i / n * 6.283, R, petalAt(t2), eyeAt()); } }
	if (ring) buds(16, 1.15, BUD, mix(BUD, WHITE, 0.4), 0.011);
	else if (!old) buds(5, 0.35, BUD, CREAM, 0.006);
}
function stemDraw(b, s, lvl) {
	if (lvl === 2) return;
	const pts = lvl === 0 ? s.pts : [s.pts[0], s.pts[3]];
	tube(b, pts, pts.map((_, k) => 0.005 - k * 0.003 / pts.length), 3, STEM, (t) => 0.15 + t * 0.3);
	// (the second head's stalk)
	if (s.heads[1] && lvl === 0) { const a = s.pts[1].clone().lerp(s.pts[2], 0.5); tube(b, [a, s.heads[1].c], [0.0028, 0.002], 3, STEM, (t) => 0.3 + t * 0.15); }
}
function moundDraw(b, M, lvl, rnd) {
	// the leafy mass: a lumpy dome in the leaves' dark greens, deeper toward its foot
	const rows = [4, 4, 2][lvl], cols = [11, 10, 7][lvl], ids = [];
	for (let j = 0; j <= rows; j++) {
		const th = j / rows * 1.62, row = [];
		for (let i = 0; i < cols; i++) {
			const [p, n] = moundAt(M, th, i / cols * 6.283, 0.82);
			if (j === rows) p.y = Math.min(p.y, 0.005);
			const c = mul(mix(LEAF, LEAF_YOUNG, rnd() * 0.5), (lvl === 0 ? 0.5 : lvl === 1 ? 0.65 : 0.8) * (0.55 + 0.45 * Math.cos(th * 0.8)) * (0.85 + rnd() * 0.3));
			row.push(b.vert(p, n, [0.5, 0.5], lift(c, p.y, 0.5), 0.15 * (1 - j / rows)));
		}
		ids.push(row);
	}
	for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const i2 = (i + 1) % cols; b.tri(ids[j][i], ids[j + 1][i], ids[j][i2]); b.tri(ids[j][i2], ids[j + 1][i], ids[j + 1][i2]); }
}
function lantanaDraw(b, cb, P, lvl, rnd) {
	moundDraw(b, P.mound, lvl, rnd);
	const out = V(P.mound.at.x, -0.12, P.mound.at.z);
	for (const c of lvl === 2 ? P.cards.filter((_, k) => k % 2 === 0) : P.cards) {
		const col = lift(mul(LEAF_CARD, c.tone), c.c.y, 0.5);
		card(cb, c.c, c.size * (lvl === 2 ? 1.35 : 1), mulberry32(c.seed), col, 0.45, out);
	}
	for (const s of P.shoots) {
		stemDraw(b, s, lvl);
		for (const h of lvl === 2 ? s.heads.slice(0, 1) : s.heads) headDraw(b, lvl === 1 ? { ...h, R: h.R * 1.3 } : h, lvl);
		const ls = lvl === 2 ? [] : lvl === 1 ? s.leaves.filter((_, k) => k < 4) : s.leaves;
		for (const L of ls) leafDraw(b, L, lvl, rnd);
	}
	if (lvl < 2) for (const L of lvl === 1 ? P.crown.filter((_, k) => k % 2 === 0) : P.crown) leafDraw(b, L, lvl, rnd);
}
function flaxDraw(b, leaves, lvl) {
	const segs = [7, 4, 2][lvl], across = lvl === 0 ? [-1, -0.72, 0.72, 1] : lvl === 1 ? [-1, 0, 1] : [-1, 1];
	const ls = lvl === 2 ? leaves.filter((_, k) => k % 2 === 0) : lvl === 1 ? leaves.filter((_, k) => k % 4 !== 3) : leaves;
	for (const L of ls) {
		const dir = V(Math.cos(L.a), 0, Math.sin(L.a)), side = V(-dir.z, 0, dir.x), rows = [];
		for (let k = 0; k <= segs; k++) {
			const t = k / segs, d = L.len * t;
			// up and out, the tip arching over and down
			const p = L.base.clone().addScaledVector(dir, Math.cos(L.elev) * d + d * d * 0.35).add(V(0, Math.sin(L.elev) * d - 0.6 * d * d / L.len, 0));
			const w = L.wid * (lvl === 2 ? 2.5 : 1) * (t > 0.85 ? (1 - t) / 0.15 * 0.8 + 0.2 : 1), tw = L.twist * t;
			const sd = side.clone().multiplyScalar(Math.cos(tw)).add(V(0, Math.sin(tw), 0));
			const n = V(0, 1, 0).addScaledVector(dir, -0.3).normalize();
			rows.push(across.map((a) => {
				// cream margins, sage green down the middle, a little V along the midrib
				const edge = Math.abs(a) > 0.9, q = p.clone().addScaledVector(sd, a * w / 2).add(V(0, (1 - Math.abs(a)) * w * 0.15, 0));
				const c0 = lvl === 2 ? mix(FLAX, FLAX_EDGE, 0.3) : edge ? FLAX_EDGE : lvl === 1 ? mix(FLAX, FLAX_EDGE, 0.15) : FLAX;
				return b.vert(q, n, [t, (a + 1) / 2], lift(mul(c0, L.tone * (0.8 + 0.3 * t)), q.y, 0.6), 0.15 + 0.6 * t);
			}));
		}
		for (let k = 0; k < segs; k++) for (let j = 0; j < across.length - 1; j++) {
			const a = rows[k][j], c = rows[k][j + 1], d = rows[k + 1][j], e = rows[k + 1][j + 1];
			b.tri(a, d, c); b.tri(c, d, e);
		}
	}
}
// spent florets lying where they fell, on a flat face at y = 0
function litterDraw(b, rnd, n, w, d) {
	for (let i = 0; i < n; i++) {
		const q = rnd(), petal = q < 0.5 ? YELLOW : q < 0.8 ? CREAM : SPENT, p = V((rnd() - 0.5) * w, 0.004 + rnd() * 0.003, (rnd() - 0.5) * d);
		const up = V((rnd() - 0.5) * 0.5, 1, (rnd() - 0.5) * 0.5).normalize();
		floret(b, p, up, 0.0055 + rnd() * 0.0015, rnd, lift(petal, 0.3), lift(q < 0.8 ? GOLD : SPENT, 0.3), 0);
		// its tube, a pale stub lying beside it
		const a = rnd() * 6.283, t = p.clone().add(V(Math.cos(a) * 0.012, -0.002, Math.sin(a) * 0.012));
		bud(b, p, t.clone().sub(p).normalize(), 0.011, 0.0015, lift(CREAM, 0.3), lift(CREAM, 0.3), 0);
	}
}

// a bed's plants (a big lantana and two smaller, two clumps of flax lily, a few dropped
// florets on the mulch) at each level, and a patch of fallen florets for the pavement
export function plantingBed(seed) {
	const r = mulberry32(seed), bounds = { x: BED_LEN / 2, z: BED_DEPTH / 2 };
	const lans = [lantanaPlan(r, V(-0.18, 0, 0.08), 0.62, 0.44, bounds), lantanaPlan(r, V(0.42, 0, -0.22), 0.42, 0.34, bounds), lantanaPlan(r, V(0.52, 0, 0.34), 0.3, 0.27, bounds)];
	const flaxA = flaxPlan(r, V(0.12, 0, 0.36), 18, 0.7), flaxB = flaxPlan(r, V(-0.5, 0, -0.3), 15, 0.62);
	const tiers = [0, 1, 2].map((lvl) => {
		const b = new Builder(), cb = new Builder(), rnd = mulberry32(seed + 17 + lvl);
		if (lvl < 2) {
			// the mulch, a hair above the planter's top
			const h = 0.012 + lvl * 0.006, col = lift(MULCH, h, 0.7);
			const ids = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => b.vert(V(x * bounds.x, h, z * bounds.z), V(0, 1, 0), [0.5, 0.5], mul(col, 0.85 + 0.3 * rnd()), 0));
			b.tri(ids[0], ids[2], ids[1]); b.tri(ids[0], ids[3], ids[2]);
		}
		for (const P of lans) lantanaDraw(b, cb, P, lvl, rnd);
		flaxDraw(b, flaxA, lvl); flaxDraw(b, flaxB, lvl);
		if (lvl === 0) { const lb = new Builder(); litterDraw(lb, rnd, 7, BED_LEN * 0.9, BED_DEPTH * 0.9); return { body: merge(b, lb, 0.02), cards: cb.geometry() }; }
		return { body: b.geometry(), cards: cb.geometry() };
	});
	const lb = new Builder();
	litterDraw(lb, mulberry32(seed + 99), 14, BED_LEN, 0.7);
	return { detail: tiers[0], mid: tiers[1], far: tiers[2], litter: lb.geometry() };
}
// one builder's triangles added to another's, raised by dy
function merge(a, b, dy) {
	const n0 = a.p.length / 3;
	for (let i = 0; i < b.p.length; i += 3) { a.p.push(b.p[i], b.p[i + 1] + dy, b.p[i + 2]); }
	a.n.push(...b.n); a.uv.push(...b.uv); a.c.push(...b.c); a.s.push(...b.s);
	for (const i of b.i) a.i.push(i + n0);
	return a.geometry();
}
