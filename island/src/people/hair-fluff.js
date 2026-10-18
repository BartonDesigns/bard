// Fluffy hair: the hair as thousands of tiny tufts, grown from the scalp the way the grass
// grows from the ground (world/grass.js): each tuft is a pair of crossed ribbons, one flat
// to the head and one standing off it, tapering to a point, and the shader cuts each into a
// few fine blades of their own lengths. The tufts are gathered into locks. A lock follows
// one path, brushed the way the cut goes (out from the whorl, back, from a parting, up, out),
// falling under its own weight and kept off the head, the face, the neck and the shoulders.
// Round its core its tufts draw together to a point at the tip, as drawn hair does.
// Per cut: bangs over the forehead (full, curtained, swept, spiky), locks framing the face,
// spiky tips, ends flicked out or turned under, waves, ponytails and buns, now and then a
// stray lock standing up off the crown. An inner layer, shorter and darker, gives the hair
// depth, and a short undercoat lies under it all.
// Shaded as drawn hair is: one soft mass in two tones, the light's edge soft; a band of
// light round the head that breaks lock by lock into a zigzag (the ring); a rim when lit
// from behind; darker at the roots and inside. No textures. One mesh and one draw a head,
// skinned to the head, and to the neck and the upper back as long hair falls. Far off,
// fewer tufts are drawn: the outer locks' cores first, so the outline holds.

import * as THREE from 'three';
import { CUTS, skullOf, hairline, recedeAt } from './hair.js';
import { guideUniform } from './hair-motion.js';

const isPhone = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const V3 = THREE.Vector3;

// the cuts grown as fluff (locs, box braids and cornrows are round, and stay so: hair.js)
export const FLUFFY = new Set(['crop', 'short', 'textured', 'fade', 'quiff', 'curls', 'coils', 'afro', 'bun', 'pony', 'bob', 'lob', 'long', 'waves', 'pixie', 'fringe', 'slick', 'thinning']);

// how each cut is brushed. locks: how many over the head; w: a lock's width at the root (m);
// members: tufts round each lock's core; pull: how far they draw together at the tip; spike:
// the tips standing off the head; fluff: tufts straying from their lock (m); flick: the ends
// turned out (or under, below 0); wave: (m), its length waveL; bangs: the ways the front may
// fall, one picked a head; frame: locks each side framing the face; tail: a ponytail's
// locks; bun: the locks wound into a bun; ahoge: the chance of a lock standing up off the crown
const BASE = { locks: 170, w: 0.02, members: 5, pull: 0.8, spike: 0, fluff: 0.003, flick: 0, wave: 0, waveL: 0.07, bangs: [null], frame: 0, inner: 0.4, ahoge: 0 };
const BRUSH = {
	crop: { locks: 230, w: 0.012, members: 4, spike: 0.35, bangs: ['short'], ahoge: 0.12 },
	short: { locks: 240, w: 0.014, members: 4, spike: 0.2, bangs: ['swept', 'short'], ahoge: 0.12 },
	textured: { locks: 210, w: 0.013, members: 4, spike: 0.6, pull: 0.9, bangs: ['spiky'] },
	fade: { locks: 160, w: 0.012, members: 4, spike: 0.3, bangs: ['short', null] },
	quiff: { locks: 200, w: 0.015, members: 4, spike: 0.2 },
	slick: { locks: 200, w: 0.016, members: 3, pull: 0.6, fluff: 0.001 },
	thinning: { locks: 120, w: 0.011, members: 3, spike: 0.1 },
	curls: { locks: 230, w: 0.013, members: 5, pull: 0.55, wave: 0.008, waveL: 0.03, fluff: 0.004 },
	coils: { locks: 320, w: 0.011, members: 3, pull: 0.45, wave: 0.004, waveL: 0.018, fluff: 0.004 },
	afro: { locks: 440, w: 0.012, members: 4, pull: 0.4, wave: 0.006, waveL: 0.022, fluff: 0.005 },
	pixie: { locks: 220, w: 0.014, members: 4, spike: 0.2, bangs: ['swept'], ahoge: 0.15 },
	bob: { locks: 170, w: 0.022, members: 5, flick: -0.5, bangs: ['full', 'split', 'swept'], frame: 1, ahoge: 0.08 },
	lob: { locks: 180, w: 0.022, members: 5, flick: 0.5, bangs: ['split', 'swept', null], frame: 1 },
	long: { locks: 190, w: 0.022, members: 5, flick: 0.2, bangs: ['split', 'full', 'swept', null], frame: 2, ahoge: 0.08 },
	waves: { locks: 180, w: 0.022, members: 5, wave: 0.014, bangs: ['split', null], frame: 1 },
	fringe: { locks: 180, w: 0.022, members: 5, bangs: ['full'], frame: 2 },
	pony: { locks: 150, w: 0.02, members: 2, pull: 0.3, bangs: ['split', 'swept', null], frame: 1, tail: 9 },
	bun: { locks: 150, w: 0.02, members: 2, pull: 0.3, bangs: ['split', null], frame: 1, bun: 10 },
};

// a path's points spaced evenly, segs segments
function resample(path, segs) {
	const L = [0];
	for (let i = 1; i < path.length; i++) L.push(L[i - 1] + path[i].distanceTo(path[i - 1]));
	const total = L[L.length - 1], out = [path[0].clone()];
	let j = 1;
	for (let i = 1; i <= segs; i++) {
		const at = total * i / segs;
		while (j < path.length - 1 && L[j] < at) j++;
		out.push(path[j - 1].clone().lerp(path[j], clamp((at - L[j - 1]) / ((L[j] - L[j - 1]) || 1))));
	}
	return out;
}
// a path cut where it first goes below y
function clipBelow(path, y) {
	for (let i = 1; i < path.length; i++) {
		if (path[i].y >= y) continue;
		const a = path[i - 1], b = path[i];
		return path.slice(0, i).concat([a.clone().lerp(b, clamp((a.y - y) / ((a.y - b.y) || 1)))]);
	}
	return path;
}

// the hair for a cut, fitted to this head: rest-pose positions, skinned (skinIndex and
// skinWeight: the head, and below it the neck and the upper back). userData.lod: how many
// indices to draw far off, middling, near
export function buildFluff(A, P, p, cutName, opts = {}) {
	const cut = { ...(CUTS[cutName] || CUTS.short), ...(opts.adjust || {}) };
	const B = { ...BASE, ...(BRUSH[cutName] || BRUSH.short), ...(opts.brush || {}) };
	const rnd = opts.rnd || Math.random;
	const K = opts.skull || skullOf(A, p, P);
	const { c, radius, eyeY } = K;
	const low = !!opts.low || isPhone;
	const capped = opts.capY !== undefined;
	// this head's own: how full, how spiky, which way the front falls, which side it parts
	const vol = (opts.volume ?? 1) * (0.9 + rnd() * 0.2), spike = B.spike * (0.75 + rnd() * 0.5);
	const bangs = capped ? null : B.bangs[Math.floor(rnd() * B.bangs.length)];
	const sw = opts.partSide ?? (rnd() < 0.5 ? -1 : 1), partAz = sw * (0.25 + rnd() * 0.2);
	const recede = opts.recede || 0, thin = cut.thin || opts.thin || 0;
	const dense = (low ? 0.55 : 1) * (opts.density || 1) * (1 - thin * 0.35);
	const tmp = new V3(), dir = new V3(), out = new V3(), grav = new V3(0, -1, 0);

	// the body below the head, as the hair meets it (as hair.js keeps its cards off it)
	const cutP = P.cut, neckY = cutP.neck, shY = cutP.shoulder, backZ = cutP.backZ, frontZ = cutP.frontZ, midZ = (backZ + frontZ) / 2, cloth = opts.clothOff || 0;
	const keepOut = (q, off, face = true) => {
		const d = tmp.subVectors(q, c), r = d.length();
		if (q.y > c.y - 0.07) {
			const R = radius(d.divideScalar(r || 1)) + off;
			if (r < R) q.copy(c).addScaledVector(d, R);
			// off the face, round it to the sides (bangs fall over the forehead, so may come in)
			if (face && q.z > c.z + 0.03 && q.y < eyeY + 0.035 && Math.abs(q.x) < 0.078 + off) q.x = Math.sign(q.x || 1) * (0.078 + off);
			return;
		}
		// (and over the clothes there, as thick as they are)
		const k = sm(neckY + 0.02, shY - 0.02, q.y), co = cloth * (1 - sm(neckY, neckY + 0.04, q.y));
		const rx = 0.055 + k * (cutP.shoulderX + 0.02 - 0.055) + off + co, rz = 0.055 + k * ((frontZ - backZ) / 2 - 0.055 + 0.02) + off + co;
		const zc = c.z - 0.012 + (midZ - c.z + 0.012) * k;
		const ex = q.x / rx, ez = (q.z - zc) / rz, e = Math.hypot(ex, ez);
		if (e < 1) { q.x = ex / e * rx; q.z = zc + ez / e * rz; }
	};
	// a lock's path from a root: out of the scalp, the way it is brushed, down under its weight
	const grow = (root, nrm, flow, len, segs, lift, gravity, off, hug, rise, face) => {
		const path = [root.clone().addScaledVector(nrm, off)];
		dir.copy(nrm).multiplyScalar(rise + lift * 25).add(flow).normalize();
		const q = path[0].clone(), step = len / segs;
		for (let i = 1; i <= segs; i++) {
			const t = i / segs;
			dir.addScaledVector(grav, gravity * step * 18).normalize();
			out.subVectors(q, c).normalize();
			const od = dir.dot(out);
			if (od > 0 && (hug < 1 || q.y > c.y + 0.01)) dir.addScaledVector(out, -od * hug).normalize();
			q.addScaledVector(dir, step);
			keepOut(q, off + lift * (1 - t * 0.5), face);
			path.push(q.clone());
		}
		return path;
	};
	// along a path: the way it runs, across it flat to the head, and out from the head
	const frameOf = (pts) => pts.map((q, i) => {
		const along = (i < pts.length - 1 ? new V3().subVectors(pts[i + 1], q) : new V3().subVectors(q, pts[i - 1])).normalize();
		if (along.lengthSq() < 0.5) along.set(0, -1, 0);
		const o = new V3().subVectors(q, c).normalize(), side = new V3().crossVectors(along, o);
		if (side.lengthSq() < 1e-8) side.set(1, 0, 0); else side.normalize();
		return { along, side, up: new V3().crossVectors(side, along).normalize() };
	});
	// the shapes a brush gives a lock: tips standing off, ends flicked, waves
	const shape = (path, len, o) => {
		const fr = frameOf(path), m = path.length - 1, ph = rnd() * TAU, zig = (rnd() - 0.5) * 2, wl = TAU / B.waveL;
		const sp = o.spike ?? spike, fl = o.flick ?? B.flick, wv = o.wave ?? (B.wave || (cut.curl || 0) * 1.5);
		for (let i = 1; i <= m; i++) {
			const t = i / m, q = path[i], f = fr[i];
			q.addScaledVector(f.up, sp * len * 0.35 * t * t).addScaledVector(f.side, sp * len * 0.18 * zig * t * t);
			if (fl) q.addScaledVector(f.up, fl * len * 0.25 * sm(0.6, 1, t));
			if (wv) { const a = ph + t * len * wl; q.addScaledVector(f.side, Math.sin(a) * wv * sm(0, 0.15, t)).addScaledVector(f.up, Math.cos(a) * wv * 0.4 * sm(0, 0.15, t)); }
			keepOut(q, o.off ?? 0.002, o.face ?? true);
		}
		return path;
	};

	// ---------- the mesh ----------
	const V = [], N = [], T = [], UV = [], HK = [], I = [[], [], []];
	const rad = new V3(), nrm = new V3(), lift = new V3();
	// the normal: out from the hair's mass as one soft volume (below the head, out from its
	// middle, level), a little of the tuft's own; nc: the middle it rounds on
	const radial = (q, nc) => { rad.subVectors(q, nc); if (rad.y < -0.04) rad.y = -0.04 + (rad.y + 0.04) * 0.15; return rad.normalize(); };
	// one tuft: two ribbons crossed along pts, w wide at the root, tapering to a point. kind:
	// 0 a lock's core, 1 a tuft round it, 2 the undercoat, 3 a stray; ao: how deep in the hair
	// (darker inside); sway: how freely its tip swings; bucket: the level of detail it is in
	// hold: how far up a long lock keeps its width before it tapers (and its blades stay whole)
	const tuft = (pts, fr, w, kind, ao, seed, sway, bucket, ribbons, nc = c, hold = 0) => {
		const n = pts.length - 1, Ib = I[bucket];
		for (let r = 0; r < ribbons; r++) {
			const base = V.length / 3;
			for (let i = 0; i <= n; i++) {
				const q = pts[i], f = fr[i], t = i / n;
				// (a brush stroke: narrow at the root, widest a quarter of the way up, to a point)
				const tt = hold ? clamp((t - hold) / (1 - hold)) : t;
				const ww = w * 0.5 * (0.45 + 0.55 * sm(0, 0.25, t)) * Math.pow(1 - tt, kind === 0 ? 0.55 : 0.8) * (r ? 0.6 : 1) + 0.0002;
				const ax = r ? f.up : f.side;
				// (the standing ribbon sits out from the tuft, not half inside the head)
				lift.copy(f.up).multiplyScalar(r ? ww * 0.8 : 0);
				nrm.copy(radial(q, nc)).multiplyScalar(0.8).addScaledVector(f.up, 0.2).normalize();
				const a = ao * (0.75 + 0.25 * sm(0, 0.3, t)), s2 = sway * t * t;
				for (let s = -1; s <= 1; s += 2) {
					V.push(q.x + ax.x * ww * s + lift.x, q.y + ax.y * ww * s + lift.y, q.z + ax.z * ww * s + lift.z);
					N.push(nrm.x, nrm.y, nrm.z); T.push(f.along.x, f.along.y, f.along.z);
					UV.push(s < 0 ? 0 : 1, t); HK.push(a, kind + (hold ? 4 : 0), seed, s2);
				}
				if (i < n) { const v = base + i * 2; Ib.push(v, v + 1, v + 3, v, v + 3, v + 2); }
			}
		}
	};
	// a lock: its core along the path, and tufts round it that draw to a point at the tip
	const lock = (path, o) => {
		const members = o.members ?? B.members, pull = o.pull ?? B.pull, ao = o.ao ?? 1, sway = o.sway ?? 1;
		const bucket = o.bucket ?? 0, nc = o.nc || c, face = o.face ?? true, fluff = o.fluff ?? B.fluff, mid = o.mid ?? 2;
		const m = path.length - 1, fr = frameOf(path), seed = Math.floor(rnd() * 256);
		// (a lock is long and thin, never a chip: no wider than its length allows)
		let plen = 0;
		for (let i = 1; i <= m; i++) plen += path[i].distanceTo(path[i - 1]);
		const w = Math.min(o.w ?? B.w, plen * 0.4), hold = plen > 0.15 ? 0.5 : plen > 0.09 ? 0.25 : 0;
		tuft(path, fr, w, o.kind ?? 0, ao, seed, sway, bucket, 2, nc, hold);
		const a0 = new V3(), a1 = new V3();
		for (let j = 0; j < members; j++) {
			const a = rnd() * TAU, rr = Math.sqrt(rnd());
			const ox = Math.cos(a) * rr * w * 0.55, oy = Math.sin(a) * rr * w * 0.3 + w * 0.08;
			// (a long lock's tufts run nearly its whole length: its end is a point, not wisps)
			const lk = hold ? 0.88 + rnd() * 0.12 : 0.72 + rnd() * 0.3, n = Math.max(2, Math.round(m * lk)), ph = rnd() * TAU, pts = [];
			for (let i = 0; i <= n; i++) {
				const u = i / n * lk * m, i0 = Math.min(m - 1, Math.floor(u)), f = u - i0, g = u / m;
				const q = new V3().lerpVectors(path[i0], path[i0 + 1], f);
				a0.lerpVectors(fr[i0].side, fr[i0 + 1].side, f); a1.lerpVectors(fr[i0].up, fr[i0 + 1].up, f);
				const k = 1 - pull * sm(hold ? 0.5 : 0.2, 1, g);
				q.addScaledVector(a0, ox * k + Math.sin(ph + g * 6) * fluff * g).addScaledVector(a1, oy * k + Math.cos(ph + g * 5) * fluff * 0.6 * g);
				if (i) keepOut(q, 0.0015, face);
				pts.push(q);
			}
			// (the ones under the core in its shade)
			tuft(pts, frameOf(pts), Math.min(w * (0.3 + rnd() * 0.25), plen * 0.18), 1, ao * (oy > w * 0.1 ? 1 : 0.82), (seed + 4 * (j + 1)) % 256, sway, Math.max(bucket, j < mid ? 1 : 2), low ? 1 : 2, nc, hold);
		}
	};
	const segsFor = (len) => low ? Math.max(2, Math.min(6, Math.round(len / 0.045))) : Math.max(3, Math.min(9, Math.round(len / 0.03)));

	// ---------- where it grows ----------
	const crown = new V3(0.1, 0.9, -0.45).normalize();
	const degOf = (d) => Math.abs(Math.atan2(d.x, d.z)) * 180 / Math.PI;
	// roots over the scalp inside the hairline, evenly (a Fibonacci spiral, jittered)
	// (the whole spiral is tried; if too few fall inside this head's hairline, a denser one is,
	// so every head gets its count, but for what a hat covers)
	const rootsOf = (count, turn, M = Math.round(count * 1.6), again = true) => {
		const roots = [];
		for (let i = 0; i < M; i++) {
			const k = (i + 0.5) / M, y = 1 - k * 1.45, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996 + turn + rnd() * 0.3;
			const d = new V3(Math.sin(a) * r, y, Math.cos(a) * r);
			if (d.y < -0.5) continue;
			const s = c.clone().addScaledVector(d, radius(d)), deg = degOf(d);
			if (s.y - eyeY < hairline(deg) + recedeAt(deg, recede) + (rnd() - 0.5) * 0.006) continue;
			if (thin && d.dot(crown) > 0.9 - thin * 0.25 && rnd() < 0.7) continue;
			// under a cap or a beanie only what shows below it; a fade's sides are painted
			if (capped && s.y - eyeY > opts.capY - (deg > 90 ? 0.02 : 0)) continue;
			if (cut.fade && s.y - eyeY < 0.075 - (1 - cut.fade) * 0.05 && deg > 40) continue;
			roots.push({ s, d, deg });
		}
		return again && !capped && roots.length < count * 0.9 ? rootsOf(count, turn, Math.round(M * count / Math.max(1, roots.length)), false) : roots;
	};
	const isFront = (d, deg) => bangs && d.z > 0.3 && d.y > 0.12 && deg < 58;
	// the way it is brushed at each root, flat along the scalp
	const flowAt = (d, deg) => {
		const f = new V3();
		if (capped) f.set(0, -1, 0);
		else if (cut.flow === 'out') f.set(rnd() - 0.5, rnd() - 0.6, rnd() - 0.5).multiplyScalar(0.6);
		else if (cut.flow === 'back') f.set(0, 0.15, -1);
		else if (cut.flow === 'up') f.set(0, 1, 0.3);
		else if (cut.flow === 'part') {
			const az = Math.atan2(d.x, d.z);
			f.copy(d).sub(new V3(Math.sin(partAz) * 0.3, 1, Math.cos(partAz) * 0.35)).setY(0);
			if (d.y > 0.55 && Math.abs(az) < 1.3) f.set(Math.sign(Math.sin(az) - Math.sin(partAz) * 0.9) || 1, -0.2, 0.25);
		} else f.copy(d).sub(crown).add(new V3(0, -0.2, 0));
		if (isFront(d, deg)) {
			if (bangs === 'full') f.set(d.x * 0.4, -0.6, 1);
			else if (bangs === 'split') f.set((Math.sign(d.x) || 1) * 0.9, -0.5, 0.8);
			else if (bangs === 'swept') f.set(sw * 1.1, -0.5, 0.7);
			else if (bangs === 'spiky') f.set(d.x * 0.6, 0.05, 1);
			else f.set(d.x * 0.4, -0.45, 1);
		} else if (cut.drop !== undefined && d.z > 0.2 && d.y < 0.85) f.add(new V3(Math.sign(d.x || 1) * 1.2, 0, -0.5));
		if (f.lengthSq() < 1e-6) f.set(0, -1, 0);
		return f.addScaledVector(d, -f.dot(d)).normalize();
	};
	// where bangs end: at the brows (spiky and short ones higher), a swept fringe longer to its
	// side, curtains longer to both
	const bangTip = (d) => eyeY + (bangs === 'spiky' ? 0.045 : bangs === 'short' ? 0.04 : 0.028) - (bangs === 'swept' ? 0.035 * clamp(d.x * sw * 8 + 0.3) : bangs === 'split' ? 0.03 * clamp(Math.abs(d.x) * 6) : 0) + (rnd() - 0.5) * 0.01;
	// a tie: a ponytail's high or low, a bun up on the crown; on the scalp, out by the hair
	const tieDir = (cut.tie === 'bun' ? new V3(0, 0.075, -0.075) : new V3(0, rnd() < 0.5 ? 0.06 : 0.035, -0.095)).normalize();
	const tieAt = c.clone().addScaledVector(tieDir, radius(tieDir) + (cut.tie === 'bun' ? 0.03 : 0.012));

	// ---------- the locks ----------
	const roots = rootsOf(Math.round(B.locks * dense), 0);
	for (const { s, d, deg } of roots) {
		const inner = rnd() < B.inner, off = inner ? 0.0015 : 0.004 + cut.lift * vol * 0.5;
		const lv = { ao: inner ? 0.6 : 1, members: inner ? 2 : B.members, bucket: inner ? 1 : 0 };
		if (cut.tie) {
			// gathered: along the scalp to the tie, drawn tight
			const path = [s.clone().addScaledVector(d, off)], q = path[0].clone();
			if (isFront(d, deg) && bangs) {
				const f = flowAt(d, deg);
				const bp = clipBelow(grow(s, d, f, 0.12, 6, 0.002, 0.6, off, 0.9, 0.2, false), bangTip(d));
				lock(resample(shape(bp, 0.08, { face: false, spike: 0, flick: 0 }), segsFor(0.08)), { ...lv, face: false });
				continue;
			}
			for (let i = 1; i <= 6; i++) { q.lerp(tieAt, 1 / (6 - i + 1)); keepOut(q, off + 0.002); path.push(q.clone()); }
			lock(resample(path, 4), { ...lv, w: 0.026, members: inner ? 2 : 3, pull: 0.25, sway: 0, fluff: 0.0005 });
			continue;
		}
		if (cut.flow === 'out') {
			// coily hair, a cloud of curls: each tuft a little loop, lying tilted on one of the shells
			// over the scalp out to the hair's rounded outline (fuller on top and at the back), more
			// of them out at the edge, the inner ones darker
			const sh = Math.pow(rnd(), 0.35), so = 0.003 + cut.lift * vol * sh * (0.6 + 0.4 * sm(-0.3, 0.6, d.y)) * (d.z > 0.5 && d.y < 0.5 ? 0.5 : 1);
			const e1 = new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), e2 = new V3();
			e1.addScaledVector(d, -e1.dot(d)).normalize(); e2.crossVectors(d, e1).addScaledVector(d, 0.6).normalize();
			const rc = (cut.lift > 0.03 ? 0.0055 : 0.0042) * (0.8 + rnd() * 0.45), sweep = TAU * (0.7 + rnd() * 0.5), at = c.clone().addScaledVector(d, radius(d) + so), path = [];
			for (let j = 0; j <= 6; j++) {
				const a = j / 6 * sweep, q = at.clone().addScaledVector(e1, Math.sin(a) * rc).addScaledVector(e2, (1 - Math.cos(a)) * rc).addScaledVector(d, j / 6 * 0.002);
				keepOut(q, 0.002);
				path.push(q);
			}
			lock(path, { w: rc * 1.5, members: sh > 0.45 ? 2 : 1, mid: 1, pull: 0.45, ao: 0.5 + 0.5 * sh, bucket: sh > 0.45 ? 0 : 1, sway: 0.4 });
			continue;
		}
		const lenBase = d.y > 0.55 ? cut.top : deg > 120 ? cut.back : deg > 60 ? cut.sides : THREE.MathUtils.lerp(cut.top, cut.sides, sm(20, 60, deg));
		let len = lenBase * (0.85 + rnd() * 0.3) * (inner ? 0.9 : 1) * (cut.flow === 'out' ? vol : 1);
		if (cut.drop !== undefined) len = Math.max(len * 0.5, s.y - (eyeY + cut.drop) + (d.y > 0.5 ? 0.05 : 0.02) + (rnd() - 0.5) * 0.02);
		const f = flowAt(d, deg), front = isFront(d, deg);
		// (spiky hair stands up more under its weight; long hair hangs)
		const gravity = (len > 0.08 ? 0.9 : len > 0.05 ? 0.35 : 0.1) * (1 - spike * 0.5);
		const lift2 = cut.lift * vol, hug = clamp(0.9 - lift2 * 30);
		let path;
		if (front) {
			// bangs: over the forehead to the brows
			path = clipBelow(grow(s, d, f, Math.max(len, 0.1), 8, Math.min(lift2, 0.006), 0.6, off, 0.9, 0.25, false), bangTip(d));
			len = Math.min(len, 0.1);
		} else path = grow(s, d, f, len, segsFor(len) * 2, lift2, gravity, off, hug, 0.35, true);
		if (path.length < 3) continue;
		lock(resample(shape(path, len, { face: !front, off, flick: front ? 0 : undefined }), segsFor(len)), { ...lv, face: !front });
	}

	// the locks framing the face: in front of the ears, down beside the cheeks
	for (let side = -1; side <= 1; side += 2) for (let k = 0; k < (capped ? 0 : B.frame); k++) {
		const deg = 64 + k * 9 + rnd() * 4, az = side * deg * Math.PI / 180, target = hairline(deg) + 0.022 + k * 0.012;
		let d = null, s = null;
		for (let el = -0.2; el < 1.2; el += 0.04) {
			const dd = new V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
			const ss = c.clone().addScaledVector(dd, radius(dd));
			if (ss.y - eyeY >= target) { d = dd; s = ss; break; }
		}
		if (!d) continue;
		const tip = eyeY + (cut.drop !== undefined ? Math.max(cut.drop, -0.2) : -0.07) + (rnd() - 0.5) * 0.02;
		const len = (s.y - tip) * 1.25 + 0.03;
		const path = clipBelow(grow(s, d, new V3(side * 0.15, -1, 0.3).normalize(), len, 10, 0.004, 0.9, 0.005, 0.9, 0.3, true), tip);
		if (path.length < 3) continue;
		lock(resample(shape(path, len, { spike: 0, flick: B.flick * 0.5 }), segsFor(len)), { w: 0.024, members: B.members + 1, pull: 0.88 });
	}

	// a ponytail from the tie: locks fanning a little out and back, then hanging, to a point
	if (cut.tie === 'pony') {
		const n = Math.round((B.tail || 9) * (low ? 0.6 : 1)), L = (0.2 + rnd() * 0.12) * vol;
		const back = tieDir.clone(), across = new V3().crossVectors(back, new V3(0, 1, 0)).normalize(), upw = new V3().crossVectors(across, back);
		for (let i = 0; i < n; i++) {
			const a = i / n * TAU, o = across.clone().multiplyScalar(Math.cos(a) * 0.009).addScaledVector(upw, Math.sin(a) * 0.008);
			const q = tieAt.clone().add(o), dd = back.clone().addScaledVector(upw, 0.35).addScaledVector(o, 18).normalize(), path = [q.clone()];
			for (let j = 1; j <= 10; j++) { dd.addScaledVector(grav, 0.3).normalize(); q.addScaledVector(dd, L * (0.85 + 0.15 * Math.cos(a * 2)) / 10); keepOut(q, 0.012); path.push(q.clone()); }
			lock(resample(shape(path, L, { spike: 0, off: 0.012, face: false, flick: 0.15 }), segsFor(L)), { w: 0.026, members: B.members + 4, pull: 0.85, nc: tieAt });
		}
	} else if (cut.tie === 'bun') {
		// a bun: locks wound round and round
		const n = Math.round((B.bun || 10) * (low ? 0.6 : 1)), rb = 0.03 * vol;
		for (let i = 0; i < n; i++) {
			const path = [], tilt = i / n * Math.PI, a0 = rnd() * TAU;
			for (let j = 0; j <= 10; j++) { const a = a0 + j / 10 * TAU * 0.85; path.push(tieAt.clone().add(new V3(Math.cos(a) * rb, Math.sin(a) * rb * Math.cos(tilt), Math.sin(a) * rb * 0.9 * Math.sin(tilt)))); }
			lock(path, { w: 0.026, members: 3, pull: 0.5, sway: 0.15, nc: tieAt, face: false });
		}
	}

	// a lock standing up off the crown, curving forward (now and then)
	if (!capped && !cut.tie && rnd() < B.ahoge) {
		const d = crown.clone().lerp(new V3(0, 1, 0), 0.6).normalize(), s = c.clone().addScaledVector(d, radius(d) + cut.lift * vol + 0.004);
		const fw = new V3(sw * 0.2, 0, 1).normalize(), path = [];
		for (let j = 0; j <= 6; j++) { const t = j / 6; path.push(s.clone().addScaledVector(d, Math.sin(t * 2.2) * 0.04).addScaledVector(fw, t * t * 0.05)); }
		lock(path, { w: 0.009, members: 2, pull: 0.9, kind: 3, face: false });
	}

	// the undercoat: tufts lying flat on the scalp the way the hair goes (to the tie, tied), as
	// long as the cut is there (to 4.5 cm), wide and close: short hair's locks are small and
	// would leave the scalp between them
	const under = cut.flow === 'out' ? 0.5 : cut.top < 0.1 ? 1.5 : 0.8;
	for (const { s, d, deg } of rootsOf(Math.round(B.locks * under * dense), 1.3)) {
		// (under coily hair, short and brushed up and back, off the face)
		const coily = cut.flow === 'out', up = coily ? new V3(0, 1, -0.3).addScaledVector(d, -new V3(0, 1, -0.3).dot(d)) : null;
		const f = cut.tie ? new V3().subVectors(tieAt, s).addScaledVector(d, -new V3().subVectors(tieAt, s).dot(d)).normalize() : coily ? (up.lengthSq() > 1e-6 ? up.normalize() : flowAt(d, deg)) : flowAt(d, deg);
		const at = d.y > 0.55 ? cut.top : deg > 120 ? cut.back : cut.sides, ln = coily ? 0.015 : clamp(at * 0.9, 0.02, 0.045) * (0.85 + rnd() * 0.3);
		const path = grow(s, d, f, ln, 2, 0, 0.1, 0.0012, 1, 0.1, true);
		tuft(path, frameOf(path), Math.min(0.024, ln * 0.9), 2, 0.62, Math.floor(rnd() * 256), 0, 1, 1);
	}

	// ---------- packed ----------
	const nv = V.length / 3, g = new THREE.BufferGeometry();
	const n8 = (A8) => { const o = new Int8Array(A8.length); for (let i = 0; i < A8.length; i++) o[i] = Math.round(clamp(A8[i], -1, 1) * 127); return o; };
	const uv = new Uint8Array(UV.length), hk = new Uint8Array(HK.length), si = new Uint8Array(nv * 4), wt = new Uint8Array(nv * 4);
	for (let i = 0; i < UV.length; i++) uv[i] = Math.round(clamp(UV[i]) * 255);
	for (let i = 0; i < HK.length; i += 4) { hk[i] = Math.round(clamp(HK[i]) * 255); hk[i + 1] = HK[i + 1]; hk[i + 2] = HK[i + 2]; hk[i + 3] = Math.round(clamp(HK[i + 3]) * 255); }
	// (the head carries it; below the neck, more and more the neck and the upper back)
	const hb = P.map.head, nb = P.map.neck01 ?? hb, bb = P.map.spine01 ?? nb;
	for (let v = 0; v < nv; v++) {
		const k = 0.6 * (1 - sm(shY - 0.06, neckY + 0.04, V[v * 3 + 1]));
		const wn = Math.round(k * 0.35 * 255), wb = Math.round(k * 0.65 * 255);
		si.set([hb, nb, bb, 0], v * 4); wt.set([255 - wn - wb, wn, wb, 0], v * 4);
	}
	g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
	g.setAttribute('normal', new THREE.BufferAttribute(n8(N), 3, true));
	g.setAttribute('hairT', new THREE.BufferAttribute(n8(T), 3, true));
	g.setAttribute('uv', new THREE.BufferAttribute(uv, 2, true));
	g.setAttribute('hairK', new THREE.BufferAttribute(hk, 4));
	g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
	g.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4, true));
	const idx = I[0].concat(I[1], I[2]);
	g.setIndex(new THREE.BufferAttribute(nv > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx), 1));
	g.userData.lod = [I[0].length, I[0].length + I[1].length, idx.length];
	g.computeBoundingSphere();
	return g;
}

// ---------- the shader ----------
const HEAD = /* glsl */`
uniform vec3 uRoot;
uniform vec3 uTip;
uniform float uRing;
varying vec3 vHT;
varying vec4 vHK;
varying vec2 vHUv;
float hh(float x) { return fract(sin(x * 78.233) * 43758.5453); }
`;
const LIGHT = /* glsl */`
void RE_Direct_Fluff( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 N = geometryNormal, L = directLight.direction;
	float nl = dot( N, L );
	// drawn hair: two tones, the edge between them soft
	float lit = smoothstep( -0.1, 0.3, nl );
	reflectedLight.directDiffuse += directLight.color * mix( 0.38, 1.0, lit ) * BRDF_Lambert( material.diffuseColor );
	// the ring: a band of light round the head where the strands turn from the light,
	// shifted lock by lock into the zigzag drawn hair has (softer far off)
	vec3 T = normalize( vHT ), H = normalize( L + geometryViewDir );
	vec3 Ts = normalize( T + N * ( 0.25 + ( hh( vHK.z ) - 0.5 ) * 0.12 ) );
	float th = dot( Ts, H ), k = pow( sqrt( max( 0.0, 1.0 - th * th ) ), 60.0 );
	float far = smoothstep( 3.0, 12.0, length( vViewPosition ) );
	// (over the top of the head, along the middle of the strands)
	float ring = smoothstep( 0.25, 0.75, k ) * ( 1.0 - far * 0.6 ) * lit * smoothstep( -0.1, 0.45, dot( N, viewMatrix[ 1 ].xyz ) ) * smoothstep( 0.05, 0.25, vHUv.y ) * ( 1.0 - smoothstep( 0.75, 0.95, vHUv.y ) );
	reflectedLight.directSpecular += directLight.color * ring * uRing * mix( vec3( 1.0 ), material.diffuseColor * 2.5 + 0.08, 0.6 ) * 0.16 * ( vHK.x / 255.0 );
	// and a rim when the light is behind
	float rim = pow( 1.0 - saturate( dot( N, geometryViewDir ) ), 3.0 ) * saturate( 0.5 - dot( geometryViewDir, L ) * 0.5 );
	reflectedLight.directDiffuse += directLight.color * rim * 0.35 * material.diffuseColor;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Fluff
`;
export function fluffMaterial(root, tip) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.4, alphaToCoverage: true });
	const U = { uHairGuides: guideUniform(), uHairMotion: { value: new THREE.Vector3() }, uHairTime: { value: 0 }, uRoot: { value: new THREE.Color(root) }, uTip: { value: new THREE.Color(tip) }, uRing: { value: 1 } };
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uHairGuides[4];\nuniform float uHairTime;\nattribute vec3 hairT;\nattribute vec4 hairK;\nvarying vec3 vHT;\nvarying vec4 vHK;\nvarying vec2 vHUv;')
			// (each lock swings on one of the four guides, its tip the most)
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHT = normalize(normalMatrix * hairT); vHK = hairK; vHUv = uv;\ntransformed += (uHairGuides[int(mod(hairK.z, 4.0))] + vec3(sin(uHairTime * 1.4 + hairK.z), 0.0, cos(uHairTime * 1.1 + hairK.z)) * 0.0012) * (hairK.w / 255.0);');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HEAD)
			.replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + LIGHT)
			// (one soft mass: its normals face out of it on both sides of every ribbon)
			.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );')
			.replace('#include <color_fragment>', `#include <color_fragment>
{
	// (kind 4 and up: a long lock's, holding its width half way)
	float held = step(3.5, vHK.y), kind = vHK.y - 4.0 * held, seed = vHK.z, v = vHUv.y, x = vHUv.x;
	float far = smoothstep(2.5, 8.0, length(vViewPosition));
	// the blades a ribbon is cut into, each its own length, each tapering to its point
	float n = kind < 0.5 ? 5.0 : kind > 2.5 ? 2.0 : 3.0;
	float u = x * n, id = floor(min(u, n - 0.001)), f = fract(min(u, n - 0.001)) - 0.5;
	float len = 1.0 - (0.32 - 0.22 * held) * hh(id * 3.7 + seed * 0.37);
	float tt = clamp((v / len - held * 0.5) / (1.0 - held * 0.5), 0.0, 1.0);
	float bend = (hh(id + seed * 1.3) - 0.5) * 0.35 * tt;
	float hw = 0.5 * pow(1.0 - tt, 0.7), aw = fwidth(u) * 0.75 + 0.02;
	float blade = (1.0 - smoothstep(hw - aw, hw + aw, abs(f - bend))) * step(v, len);
	// solid at the root, the blades parting further up; far off, one solid lock
	float edge = 1.0 - smoothstep(0.82, 1.0, abs(x - 0.5) * 2.0);
	// (the undercoat is there to hide the scalp: solid further up)
	float join = (1.0 - smoothstep(kind < 0.5 ? 0.15 : kind < 2.5 && kind > 1.5 ? 0.35 : 0.05, kind < 0.5 ? 0.4 : kind < 2.5 && kind > 1.5 ? 0.7 : 0.25, v)) * edge;
	float a = max(max(blade, join), far * edge * (1.0 - smoothstep(0.8, 1.0, v)));
	// darker at the root and inside, lighter to the tips, a little different lock by lock
	float tone = 0.94 + 0.12 * hh(seed * 1.7 + 0.3);
	vec3 col = mix(uRoot, uTip, 0.3 + 0.7 * smoothstep(0.0, 0.8, v)) * tone * (0.35 + 0.65 * vHK.x / 255.0);
	diffuseColor.rgb = col * (0.93 + 0.07 * sin(x * 40.0 + seed));
	diffuseColor.a *= a;
}`)
			.replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectSpecular *= 0.15;\nreflectedLight.indirectDiffuse *= 0.6 + 0.4 * vHK.x / 255.0;');
	};
	m.customProgramCacheKey = () => 'fluff-hair-2';
	return m;
}
