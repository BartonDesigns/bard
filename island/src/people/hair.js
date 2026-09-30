// Hair: cards of strands grown on the head, fitted to this skull. Each card is a clump:
// rooted on the scalp inside the hairline, it grows out from the crown's whorl (or back, or
// from a parting), falls under its own weight as far as the cut allows, curls if the hair
// curls, and is kept off the head, the neck and the shoulders as it goes. An inner layer
// gives the colour its depth; the outer layers break into strands, with a few flyaways.
// The cuts: crops, fades, textured tops, curls, afros, locs, box braids and cornrows,
// buns, ponytails, bobs and long layers; receding and thinning hair for some with the years.
// Locs, box braids and cornrows are round: tubes, the twist or the plait drawn on them.
// Most cuts are now real styles (hairkit.js); these grow the locs, braids and cornrows, and
// stand in for the rest while a style is fetched (or if it cannot be).
// One mesh and one draw a head, drawn by one shader: strands cut from each card by alpha,
// darker at the root, lit with the two highlights hair has (Kajiya-Kay: a white one, and
// a second in the hair's own colour, shifted along the strand). No textures.

import * as THREE from 'three';

const isPhone = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// the cuts. Lengths in metres: top, sides, back; drop: long hair hangs to this far below the
// eyes (m); flow: how it grows ('crown' out from the whorl, 'back' swept back, 'part' from a
// parting, 'up' standing); curl: amplitude (m); lift: volume off the scalp; fade: the sides
// clipped close (painted, no cards); tie: gathered into a ponytail or a bun; kind: how the
// strands are made
export const CUTS = {
	crop: { top: 0.035, sides: 0.02, back: 0.02, flow: 'crown', lift: 0.004 },
	short: { top: 0.055, sides: 0.03, back: 0.03, flow: 'part', lift: 0.006 },
	textured: { top: 0.06, sides: 0.012, back: 0.015, flow: 'up', lift: 0.012, curl: 0.004, fade: 0.6 },
	fade: { top: 0.045, sides: 0.004, back: 0.004, flow: 'crown', lift: 0.006, fade: 1 },
	quiff: { top: 0.075, sides: 0.01, back: 0.015, flow: 'back', lift: 0.02, fade: 0.8 },
	curls: { top: 0.06, sides: 0.045, back: 0.05, flow: 'crown', lift: 0.012, curl: 0.006 },
	coils: { top: 0.03, sides: 0.02, back: 0.02, flow: 'out', lift: 0.012, curl: 0.004, kind: 'coil', fade: 0.5 },
	afro: { top: 0.07, sides: 0.06, back: 0.06, flow: 'out', lift: 0.05, curl: 0.006, kind: 'coil' },
	locs: { top: 0.2, sides: 0.2, back: 0.24, drop: -0.14, flow: 'back', lift: 0.008, kind: 'locs' },
	shortlocs: { top: 0.09, sides: 0.08, back: 0.09, flow: 'up', lift: 0.02, kind: 'locs' },
	braids: { top: 0.3, sides: 0.3, back: 0.32, drop: -0.24, flow: 'back', lift: 0.004, kind: 'braids' },
	cornrows: { top: 0.14, sides: 0.14, back: 0.12, flow: 'back', lift: 0.002, kind: 'rows' },
	bun: { top: 0.14, sides: 0.14, back: 0.12, flow: 'back', lift: 0.004, tie: 'bun' },
	pony: { top: 0.16, sides: 0.16, back: 0.14, flow: 'back', lift: 0.005, tie: 'pony' },
	bob: { top: 0.18, sides: 0.18, back: 0.18, drop: -0.075, flow: 'part', lift: 0.008 },
	lob: { top: 0.24, sides: 0.24, back: 0.26, drop: -0.13, flow: 'part', lift: 0.008, curl: 0.004 },
	long: { top: 0.34, sides: 0.34, back: 0.38, drop: -0.28, flow: 'part', lift: 0.01, curl: 0.003 },
	waves: { top: 0.3, sides: 0.3, back: 0.34, drop: -0.24, flow: 'part', lift: 0.014, curl: 0.012 },
	pixie: { top: 0.06, sides: 0.03, back: 0.025, flow: 'part', lift: 0.008, fringe: 1 },
	fringe: { top: 0.24, sides: 0.24, back: 0.26, drop: -0.12, flow: 'part', lift: 0.008, fringe: 1 },
	slick: { top: 0.09, sides: 0.03, back: 0.04, flow: 'back', lift: 0.003 },
	thinning: { top: 0.03, sides: 0.025, back: 0.025, flow: 'crown', lift: 0.003, thin: 1 },
};
// the old hair meshes' names, for the places that still pick them
export const cutOf = (h) => h === 'ponytail01' ? 'pony' : h === 'short01' ? 'crop' : 'short';

// ---------- the head's shape: a radius for every direction from the skull's centre ----------
const AZ = 36, EL = 18;
export function skullOf(A, p, P) {
	const { map, rest } = P, hb = map.head, eyeY = (P.eyeAt[0].y + P.eyeAt[1].y) / 2, eyeZ = (P.eyeAt[0].z + P.eyeAt[1].z) / 2;
	const n = A.ids.length / 4, pts = [];
	let z0 = 1e9, z1 = -1e9, x0 = 1e9, x1 = -1e9, top = -1e9;
	for (let v = 0; v < n; v++) {
		let s = 0, h = 0;
		for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; s += w; if (A.ids[v * 4 + q] === hb) h += w; }
		if (!s || h / s < 0.6) continue;
		const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
		if (y < eyeY - 0.11) continue;
		pts.push(x, y, z);
		if (y > eyeY + 0.03) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
		top = Math.max(top, y);
	}
	const c = new THREE.Vector3((x0 + x1) / 2, eyeY + 0.012, (z0 + z1) / 2 - 0.004);
	const R = new Float32Array(AZ * EL);
	for (let i = 0; i < pts.length; i += 3) {
		const dx = pts[i] - c.x, dy = pts[i + 1] - c.y, dz = pts[i + 2] - c.z, r = Math.hypot(dx, dy, dz);
		const az = Math.atan2(dx, dz), el = Math.asin(dy / r);
		const a = Math.floor(((az / TAU + 1) % 1) * AZ), e = Math.floor(clamp((el / Math.PI + 0.5) * EL, 0, EL - 1));
		R[e * AZ + a] = Math.max(R[e * AZ + a], r);
	}
	// fill the gaps (under the jaw, inside the neck) from the rows above
	for (let e = EL - 1; e >= 0; e--) for (let a = 0; a < AZ; a++) if (!R[e * AZ + a]) R[e * AZ + a] = R[Math.min(EL - 1, e + 1) * AZ + a] || 0.08;
	for (let e = EL - 1; e >= 0; e--) for (let a = 0; a < AZ; a++) if (R[e * AZ + a] < 0.05) R[e * AZ + a] = 0.08;
	// one pass of smoothing round each row
	const S = Float32Array.from(R);
	for (let e = 0; e < EL; e++) for (let a = 0; a < AZ; a++) S[e * AZ + a] = Math.max(R[e * AZ + a], (R[e * AZ + (a + 1) % AZ] + R[e * AZ + (a + AZ - 1) % AZ]) / 2);
	const radius = (d) => {
		const az = Math.atan2(d.x, d.z), el = Math.asin(clamp(d.y, -1, 1));
		const fa = ((az / TAU + 1) % 1) * AZ - 0.5, fe = clamp((el / Math.PI + 0.5) * EL - 0.5, 0, EL - 1.001);
		const a0 = (Math.floor(fa) + AZ) % AZ, a1 = (a0 + 1) % AZ, e0 = Math.floor(fe), e1 = Math.min(EL - 1, e0 + 1), ta = fa - Math.floor(fa), te = fe - e0;
		return (S[e0 * AZ + a0] * (1 - ta) + S[e0 * AZ + a1] * ta) * (1 - te) + (S[e1 * AZ + a0] * (1 - ta) + S[e1 * AZ + a1] * ta) * te;
	};
	return { c, radius, eyeY, eyeZ, top, head: rest.heads[hb] };
}

// ---------- growing ----------
// the lowest a root may sit (above the eyes, m) all round the head, by the angle from the
// front (deg): the forehead, the temples, the sideburns, over the ears, the nape
const LINE = [[0, 0.064], [30, 0.058], [48, 0.036], [62, 0.018], [74, -0.012], [82, -0.032], [88, 0.0], [96, 0.03], [112, 0.024], [128, -0.02], [150, -0.058], [180, -0.072]];
function hairline(deg) {
	for (let i = 1; i < LINE.length; i++) if (deg <= LINE[i][0]) { const [a, y0] = LINE[i - 1], [b, y1] = LINE[i]; return y0 + (y1 - y0) * (deg - a) / (b - a); }
	return LINE[LINE.length - 1][1];
}

// where the scalp is painted with close-cropped hair (skin.js): inside the hairline, fading
// out down the sides of a fade, back where the hairline recedes, less over a thinning crown
const recedeAt = (deg, recede) => recede * (deg < 60 ? 0.03 * (1 - deg / 90) + (deg > 25 ? 0.02 * sm(25, 45, deg) * (1 - sm(50, 70, deg)) : 0) : 0);
export function scalpMask(A, P, p, K, src, cutName, opts = {}) {
	const cut = CUTS[cutName] || CUTS.short, hb = P.map.head, out = new Float32Array(src.length);
	const crown = new THREE.Vector3(0.1, 0.9, -0.45).normalize(), d = new THREE.Vector3();
	const soft = cut.fade ? 0.035 * cut.fade + 0.008 : 0.008;
	for (let i = 0; i < src.length; i++) {
		const v = src[i];
		let s = 0, h = 0;
		for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; s += w; if (A.ids[v * 4 + q] === hb) h += w; }
		if (!s || h / s < 0.6) continue;
		d.set(p[v * 3] - K.c.x, p[v * 3 + 1] - K.c.y, p[v * 3 + 2] - K.c.z);
		const deg = Math.abs(Math.atan2(d.x, d.z)) * 180 / Math.PI, y = p[v * 3 + 1] - K.eyeY;
		const line = hairline(deg) + recedeAt(deg, opts.recede || 0);
		let m = sm(line - 0.003, line + soft, y);
		if (opts.thin) m *= 1 - opts.thin * 0.7 * sm(0.8, 0.95, d.normalize().dot(crown));
		out[i] = m;
	}
	return out;
}

export function buildHair(A, P, p, cutName, opts = {}) {
	const cut = { ...(CUTS[cutName] || CUTS.short), ...(opts.adjust || {}) };
	const rnd = opts.rnd || Math.random;
	const K = opts.skull || skullOf(A, p, P);
	const { c, radius, eyeY } = K;
	const low = !!opts.low || isPhone;
	const V = [], N = [], T = [], UV = [], HK = [], I = [];
	const v3 = () => new THREE.Vector3();
	const tmp = v3(), dir = v3(), out = v3(), side = v3(), grav = new THREE.Vector3(0, -1, 0);
	// the body below the head, as the hair meets it: the neck and then the shoulders
	const cutP = P.cut, neckY = cutP.neck, shY = cutP.shoulder, backZ = cutP.backZ, frontZ = cutP.frontZ, midZ = (backZ + frontZ) / 2;
	const keepOut = (q, off) => {
		const d = tmp.subVectors(q, c), r = d.length();
		if (q.y > c.y - 0.07) {
			const R = radius(d.divideScalar(r || 1)) + off;
			if (r < R) q.copy(c).addScaledVector(d, R);
			// and off the face: round it to the sides
			if (!cut.fringe && q.z > c.z + 0.03 && q.y < eyeY + 0.035 && Math.abs(q.x) < 0.078 + off) q.x = Math.sign(q.x || 1) * (0.078 + off);
			return;
		}
		// the neck (a round column), widening to the shoulders and the back below it
		const k = sm(neckY + 0.02, shY - 0.02, q.y);
		const rx = 0.055 + k * (cutP.shoulderX + 0.02 - 0.055) + off, rz = 0.055 + k * ((frontZ - backZ) / 2 - 0.055 + 0.02) + off;
		const zc = c.z - 0.012 + (midZ - c.z + 0.012) * k;
		const ex = q.x / rx, ez = (q.z - zc) / rz, e = Math.hypot(ex, ez);
		if (e < 1) { q.x = ex / e * rx; q.z = zc + ez / e * rz; }
	};
	// the whorl, up at the back of the crown; the parting, off to one side
	const crown = new THREE.Vector3(0.1, 0.9, -0.45).normalize();
	const partAz = (opts.partSide ?? (rnd() < 0.5 ? -1 : 1)) * (0.25 + rnd() * 0.2);
	const recede = opts.recede || 0, thin = cut.thin || opts.thin || 0;
	// a card: a ribbon of m segments along the path, w wide, flat to the head
	const card = (path, w, layer, ao, seedU, kind) => {
		const m = path.length - 1, base = V.length / 3;
		for (let i = 0; i <= m; i++) {
			const q = path[i], t = i / m;
			const along = i < m ? tmp.subVectors(path[i + 1], q) : tmp.subVectors(q, path[i - 1]);
			along.normalize();
			out.subVectors(q, c).normalize();
			side.crossVectors(along, out).normalize();
			if (side.lengthSq() < 0.5) side.set(1, 0, 0);
			const ww = w * (kind === 1 ? 1 : 1.15 - t * 0.75) / 2;
			const nrm = out.clone().multiplyScalar(0.75).addScaledVector(side.clone().cross(along), 0.25).normalize();
			for (const s of [-1, 1]) {
				V.push(q.x + side.x * ww * s, q.y + side.y * ww * s, q.z + side.z * ww * s);
				N.push(nrm.x, nrm.y, nrm.z); T.push(along.x, along.y, along.z);
				UV.push(s < 0 ? 0 : 1, t); HK.push(ao * (0.55 + 0.45 * sm(0, 0.35, t) * layer), seedU + kind * 100);
			}
			if (i < m) { const a = base + i * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
		}
	};
	// a strand's path from a root: out of the scalp, the way it grows, down under its weight
	const grow = (root, nrm, flow, len, segs, lift, curl, curlF, gravity, layerOff, hug = 0.5) => {
		const path = [root.clone().addScaledVector(nrm, layerOff)];
		dir.copy(nrm).multiplyScalar(0.35 + lift * 25).add(flow).normalize();
		const q = path[0].clone(), step = len / segs, ph = rnd() * TAU;
		const u = v3().crossVectors(dir, nrm).normalize();
		for (let i = 1; i <= segs; i++) {
			const t = i / segs;
			dir.addScaledVector(grav, gravity * step * 18).normalize();
			// short hair lies along the head; volume lets it stand off
			out.subVectors(q, c).normalize();
			const od = dir.dot(out);
			if (od > 0) dir.addScaledVector(out, -od * hug).normalize();
			q.addScaledVector(dir, step);
			keepOut(q, layerOff + lift * (1 - t * 0.5));
			const pt = q.clone();
			if (curl) { const a = ph + t * len * curlF * TAU; out.subVectors(q, c).normalize(); pt.addScaledVector(u, Math.cos(a) * curl).addScaledVector(out, Math.sin(a) * curl * 0.6); }
			path.push(pt);
		}
		return path;
	};
	// the roots: spread evenly over the scalp inside the hairline
	const kind = cut.kind || 'strands';
	const dense = (low ? 0.55 : 1) * (opts.density || 1) * (1 - thin * 0.35);
	const baseN = kind === 'locs' ? 60 : kind === 'braids' ? 80 : kind === 'rows' || kind === 'coil' ? 0 : 230;
	const count = Math.round(baseN * dense);
	const roots = [];
	for (let i = 0; i < count * 3 && roots.length < count; i++) {
		// a Fibonacci spiral over the upper head, jittered
		const k = (i + 0.5) / (count * 3), y = 1 - k * 1.45, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996 + rnd() * 0.3;
		const d = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
		if (d.y < -0.5) continue;
		const R = radius(d), s = c.clone().addScaledVector(d, R);
		const deg = Math.abs(Math.atan2(d.x, d.z)) * 180 / Math.PI;
		const lineY = hairline(deg) + recedeAt(deg, recede);
		if (s.y - eyeY < lineY + (rnd() - 0.5) * 0.006) continue;
		// a thinning crown
		if (thin && d.dot(crown) > 0.9 - thin * 0.25 && rnd() < 0.7) continue;
		// under a cap or a beanie only what sticks out below it
		if (opts.capY !== undefined && s.y - eyeY > opts.capY - (deg > 90 ? 0.02 : 0)) continue;
		// clipped sides: painted on, no cards
		if (cut.fade && s.y - eyeY < 0.075 - (1 - cut.fade) * 0.05 && deg > 40) continue;
		roots.push({ s, d, deg });
	}
	const flowAt = (d) => {
		const f = v3();
		if (cut.flow === 'out') return f;
		if (cut.flow === 'back') f.set(0, 0.15, -1);
		else if (cut.flow === 'up') f.set(0, 1, 0.3);
		else if (cut.flow === 'part') {
			const az = Math.atan2(d.x, d.z);
			f.copy(d).sub(new THREE.Vector3(Math.sin(partAz) * 0.3, 1, Math.cos(partAz) * 0.35)).setY(0);
			if (d.y > 0.55 && Math.abs(az) < 1.3) f.set(Math.sign(Math.sin(az) - Math.sin(partAz) * 0.9) || 1, -0.2, 0.25);
		} else f.copy(d).sub(crown).multiplyScalar(1).add(new THREE.Vector3(0, -0.2, 0));
		if (cut.fringe && d.z > 0.35 && d.y > 0.2) f.set(Math.sin(partAz) * 0.3, -0.4, 1);
		// long hair round the face, not over it
		else if (cut.drop !== undefined && d.z > 0.2 && d.y < 0.85) f.add(new THREE.Vector3(Math.sign(d.x || 1) * 1.2, 0, -0.5));
		// flat along the scalp
		return f.addScaledVector(d, -f.dot(d)).normalize();
	};
	const tieAt = cut.tie === 'bun' ? c.clone().add(new THREE.Vector3(0, 0.075, -0.075)) : c.clone().add(new THREE.Vector3(0, 0.035, -0.095));
	// the layers: an inner one close and dense, darker; the outer ones in strands
	const layers = kind === 'strands' ? (low ? [[0.0015, 0.55, 1.5], [0.006, 1, 1]] : [[0.0015, 0.5, 1.6], [0.005, 0.85, 1.1], [0.009, 1, 0.9]]) : [[0.002, 0.8, 1]];
	for (const { s, d, deg } of roots) {
		const lenBase = d.y > 0.55 ? cut.top : deg > 120 ? cut.back : deg > 60 ? cut.sides : THREE.MathUtils.lerp(cut.top, cut.sides, sm(20, 60, deg));
		for (const [off, ao, wk] of layers) {
			let len = lenBase * (0.85 + rnd() * 0.3);
			const f = flowAt(d);
			if (kind === 'locs' || kind === 'braids') f.add(new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).multiplyScalar(0.5));
			const gravity = len > 0.08 ? 0.9 : len > 0.05 ? 0.35 : 0.1;
			// long hair: to the cut's length below the eyes, wherever it starts
			if (cut.drop !== undefined) len = Math.max(len * 0.5, s.y - (eyeY + cut.drop) + (d.y > 0.5 ? 0.05 : 0.02) + (rnd() - 0.5) * 0.02);
			// a fringe stops at the brows
			if (cut.fringe && d.z > 0.35 && d.y > 0.2) len = Math.min(len, Math.max(0.03, (s.y - eyeY - 0.022) * 1.3 + 0.02));
			let path;
			if (cut.tie) {
				// gathered: along the scalp to the tie
				path = [s.clone().addScaledVector(d, off)];
				const q = path[0].clone(), n = 5;
				for (let i = 1; i <= n; i++) { q.lerp(tieAt, 1 / (n - i + 1)); keepOut(q, off); path.push(q.clone()); }
			} else if (kind === 'rows') path = null;
			else {
				const segs = low ? Math.max(2, Math.min(5, Math.round(len / 0.04))) : Math.max(3, Math.min(kind === 'locs' || kind === 'braids' ? 8 : 10, Math.round(len / 0.03)));
				path = grow(s, d, f, len, segs, cut.lift, cut.curl ? cut.curl * (0.7 + rnd() * 0.6) : 0, 16, gravity, off, clamp(0.9 - cut.lift * 30));
			}
			if (!path) continue;
			const w = (kind === 'locs' ? 0.017 : kind === 'braids' ? 0.012 : 0.03) * wk * (cut.tie ? 1.2 : 1);
			const kd = kind === 'locs' ? 2 : kind === 'braids' ? 3 : kind === 'coil' ? 4 : 0;
			// locs and braids are round: tubes
			if (kd === 2 || kd === 3) tube(path, w * (kd === 2 ? 0.32 : 0.38), ao, rnd() * 50, kd);
			else card(path, w, off > 0.003 ? 1 : 0.4, ao, rnd() * 50, kd);
		}
	}
	// a tube along the path (a loc, a braid): a ring of sides round it, closed at the end
	function tube(path, r, ao, seed, kd) {
		const m = path.length - 1, base = V.length / 3, sides = low ? 4 : 5, u = v3(), w = v3();
		for (let i = 0; i <= m; i++) {
			const q = path[i], t = i / m;
			const along = (i < m ? tmp.subVectors(path[i + 1], q) : tmp.subVectors(q, path[i - 1])).normalize();
			out.subVectors(q, c).normalize();
			u.crossVectors(along, out).normalize();
			if (u.lengthSq() < 0.5) u.set(1, 0, 0);
			w.crossVectors(u, along);
			// (a little thinner towards the end, and closed)
			const rr = i === m ? r * 0.15 : r * (1 - t * 0.2);
			for (let k = 0; k <= sides; k++) {
				const a = k / sides * TAU, ca = Math.cos(a), sa = Math.sin(a);
				const nx = u.x * ca + w.x * sa, ny = u.y * ca + w.y * sa, nz = u.z * ca + w.z * sa;
				V.push(q.x + nx * rr, q.y + ny * rr, q.z + nz * rr);
				N.push(nx, ny, nz); T.push(along.x, along.y, along.z); UV.push(k / sides, t); HK.push(ao * (0.6 + 0.4 * sm(0, 0.3, t)), kd * 100 + seed * 0.5);
			}
			if (i < m) for (let k = 0; k < sides; k++) { const a = base + i * (sides + 1) + k, b = a + sides + 1; I.push(a, b, b + 1, a, b + 1, a + 1); }
		}
	}
	// cornrows: braids in rows from the hairline back over the scalp, then hanging
	if (kind === 'rows') {
		const rows = low ? 7 : 11;
		for (let k = 0; k < rows; k++) {
			// (each row over the top of the head from the front to the nape, fanned out to the sides)
			const az = (k / (rows - 1) - 0.5) * 2.0, path = [];
			for (let i = 0; i <= 12; i++) {
				const th = 0.45 + i / 12 * 3.1;
				const d = new THREE.Vector3(Math.sin(az) * (0.45 + 0.55 * Math.max(0, Math.sin(th))), Math.sin(th) * Math.cos(az * 0.8), Math.cos(th) * Math.cos(az * 0.8));
				d.normalize();
				const deg = Math.abs(Math.atan2(d.x, d.z)) * 180 / Math.PI, s = c.clone().addScaledVector(d, radius(d) + 0.003);
				if (s.y - eyeY < hairline(deg)) { if (path.length) break; continue; }
				path.push(s);
			}
			const tail = path[path.length - 1].clone();
			for (let i = 1; i <= 4; i++) { tail.y -= 0.03; keepOut(tail, 0.004); path.push(tail.clone()); }
			if (path.length > 2) tube(path, 0.0045, 0.9, k * 3.1, 3);
		}
	}
	// coily hair: shells of curls over the scalp out to the hair's rounded outline, the
	// inner ones dense and dark, the outer ones sparse, a soft edge
	if (kind === 'coil') {
		const shells = low ? 2 : Math.max(2, Math.round(cut.lift / 0.008) + 1), per = low ? 90 : 150;
		for (let k = 0; k < shells; k++) {
			const off = 0.003 + (k / Math.max(1, shells - 1)) * cut.lift, sz = 0.03 + off * 0.5;
			for (let i = 0; i < per; i++) {
				const kk = (i + 0.5 + k * 0.37) / per, y = 1 - kk * 1.5, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996 + k;
				const d = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
				const deg = Math.abs(Math.atan2(d.x, d.z)) * 180 / Math.PI, s = c.clone().addScaledVector(d, radius(d));
				if (s.y - eyeY < hairline(deg) + 0.004 - (k ? 0 : 0.004)) continue;
				if (opts.capY !== undefined && s.y - eyeY > opts.capY) continue;
				if (cut.fade && s.y - eyeY < 0.075 - (1 - cut.fade) * 0.05 && deg > 40) continue;
				// the outline: fuller on top and at the back
				const q = s.clone().addScaledVector(d, off * (0.6 + 0.4 * sm(-0.3, 0.6, d.y)) * (d.z > 0.5 && d.y < 0.5 ? 0.5 : 1));
				keepOut(q, 0.002);
				const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? grav : new THREE.Vector3(1, 0, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(d, t1);
				const base = V.length / 3, ao = 0.45 + 0.55 * (k / Math.max(1, shells - 1));
				for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
					const p2 = q.clone().addScaledVector(t1, (u - 0.5) * sz).addScaledVector(t2, (v - 0.5) * sz);
					V.push(p2.x, p2.y, p2.z); N.push(d.x, d.y, d.z); T.push(t2.x, t2.y, t2.z); UV.push(u, v); HK.push(ao, 400 + ((i * 7 + k * 13) % 50) + k / shells * 0.9);
				}
				I.push(base, base + 1, base + 2, base, base + 2, base + 3);
			}
		}
	}
	// the tie: a ponytail hanging from it, or a bun wound round it
	if (cut.tie === 'pony') {
		const n = low ? 8 : 16, L = 0.18 + rnd() * 0.12;
		for (let i = 0; i < n; i++) {
			const a = i / n * TAU, o = new THREE.Vector3(Math.cos(a) * 0.012, Math.sin(a) * 0.01, 0), path = [];
			const q = tieAt.clone().add(o), dd = new THREE.Vector3(o.x * 8, -0.25, -1).normalize();
			for (let j = 0; j <= 7; j++) { path.push(q.clone()); dd.addScaledVector(grav, 0.35).normalize(); q.addScaledVector(dd, L / 7); q.x += o.x * 0.25; keepOut(q, 0.01); }
			card(path, 0.03, 1, 0.9, rnd() * 50, 0);
		}
	} else if (cut.tie === 'bun') {
		const n = low ? 6 : 12;
		for (let i = 0; i < n; i++) {
			const path = [], tilt = i / n * Math.PI;
			for (let j = 0; j <= 10; j++) { const a = j / 10 * TAU * 0.9; path.push(tieAt.clone().add(new THREE.Vector3(Math.cos(a) * 0.035, Math.sin(a) * 0.035 * Math.cos(tilt), Math.sin(a) * 0.03 * Math.sin(tilt) - 0.012))); }
			card(path, 0.028, 1, 0.9, rnd() * 50, 0);
		}
	}
	// flyaways: a few stray hairs off the outline
	if (!low && kind === 'strands' && !opts.capY) {
		for (let i = 0; i < 3; i++) {
			const r0 = roots[Math.floor(rnd() * roots.length)];
			if (!r0) break;
			const len = Math.min(0.12, (r0.d.y > 0.55 ? cut.top : cut.sides) * (0.6 + rnd() * 0.6));
			const path = grow(r0.s, r0.d, flowAt(r0.d).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).multiplyScalar(0.8)).normalize(), len, 5, 0.02, 0.002, 12, 0.2, 0.01);
			card(path, 0.0035, 1, 1, rnd() * 50, 5);
		}
	}
	const g = new THREE.BufferGeometry();
	const H = K.head;
	for (let i = 0; i < V.length; i += 3) { V[i] -= H.x; V[i + 1] -= H.y; V[i + 2] -= H.z; }
	g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	g.setAttribute('hairT', new THREE.Float32BufferAttribute(T, 3));
	g.setAttribute('hairK', new THREE.Float32BufferAttribute(HK, 2));
	g.setIndex(I);
	g.computeBoundingSphere();
	return g;
}

// ---------- the shader ----------
const HEAD = /* glsl */`
uniform vec3 uRoot;
uniform vec3 uTip;
varying vec3 vHT;
varying vec2 vHK;
varying vec2 vHUv;
float hh(float x) { return fract(sin(x * 78.233) * 43758.5453); }
float kk(vec3 T, vec3 H, float e) { float th = dot(T, H); return pow(sqrt(max(0.0, 1.0 - th * th)), e); }
`;
const LIGHT = /* glsl */`
void RE_Direct_Hair( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	// diffuse: soft, lit round the strands; specular: two lobes along them
	float nl = dot( geometryNormal, directLight.direction );
	vec3 irr = directLight.color * saturate( nl * 0.6 + 0.4 );
	reflectedLight.directDiffuse += irr * BRDF_Lambert( material.diffuseColor );
	vec3 T = normalize( vHT ), H = normalize( directLight.direction + geometryViewDir );
	// (softer and broader far off, where a tight highlight would only shimmer)
	float far = smoothstep( 2.0, 10.0, length( vViewPosition ) );
	float s1 = kk( normalize( T + geometryNormal * 0.1 ), H, mix( 80.0, 24.0, far ) ) * ( 1.0 - far * 0.5 ), s2 = kk( normalize( T - geometryNormal * 0.12 ), H, mix( 22.0, 10.0, far ) ) * ( 1.0 - far * 0.4 );
	float vis = saturate( nl + 0.35 );
	reflectedLight.directSpecular += directLight.color * vis * ( s1 * 0.08 + s2 * 0.16 * material.diffuseColor * 2.5 ) * vHK.x;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Hair
`;
export function hairMaterial(root, tip) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.5 });
	const U = { uRoot: { value: new THREE.Color(root) }, uTip: { value: new THREE.Color(tip) } };
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 hairT;\nattribute vec2 hairK;\nvarying vec3 vHT;\nvarying vec2 vHK;\nvarying vec2 vHUv;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHT = normalize(normalMatrix * hairT); vHK = hairK; vHUv = uv;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HEAD)
			.replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + LIGHT)
			.replace('#include <color_fragment>', `#include <color_fragment>
{
	int kind = int(vHK.y / 100.0);
	float seed = mod(vHK.y, 100.0), v = vHUv.y, a = 1.0, shade = 1.0;
	if (kind == 2 || kind == 3) {
		// a loc (felted, twisted) or a braid (plaits in a chevron): solid, rounded
		// (a tube: round by its own normals, the plaits or the felt drawn round it)
		float x = abs(fract(vHUv.x * 2.0) - 0.5) * 2.0;
		float tw = kind == 3 ? abs(fract(v * 26.0 + x * 0.5) - 0.5) * 2.0 : 0.6 + 0.4 * hh(floor(v * 60.0 + vHUv.x * 6.0) + seed);
		shade = (0.5 + 0.3 * tw) * (0.85 + 0.3 * hh(seed * 7.3));
	} else {
		// locks: the card is solid at the root and parts into a few clumps towards the tip,
		// each clump tapering; the strands within show as shading, not as holes (no fuzz
		// of tiny strands at the outline); far off, the clumps close up
		float far = smoothstep(1.5, 6.0, length(vViewPosition));
		float n = kind == 4 ? 7.0 : kind == 5 ? 1.0 : 3.0;
		float u = vHUv.x * n + seed, id = floor(u), f = fract(u) - 0.5;
		float len = 0.8 + 0.2 * hh(id + seed * 3.1);
		float t = v / len, x = abs(vHUv.x - 0.5) * 2.0;
		float lock = 1.0 - smoothstep(0.35 - t * 0.2, 0.5 - t * 0.2, abs(f + (hh(id) - 0.5) * 0.15));
		float split = smoothstep(0.25, 0.7, t) * (1.0 - far * 0.7);
		a = mix(1.0, lock, split) * (1.0 - smoothstep(0.85 - t * 0.3, 1.0 - t * 0.3, x)) * (1.0 - smoothstep(0.9, 1.0, t));
		// the inner layer is solid: no scalp or sky through it
		if (vHK.x < 0.6) a = max(a, 1.0 - smoothstep(0.75 - v * 0.6, 0.95 - v * 0.6, x));
		if (kind == 5) a *= 1.0 - smoothstep(1.0, 3.0, length(vViewPosition));
		// the strands, as fine shading along the lock
		float strand = 0.5 + 0.25 * sin(vHUv.x * 57.0 + seed * 7.0) + 0.25 * sin(vHUv.x * 131.0 + seed * 3.0 + v * 4.0);
		shade = (0.8 + 0.3 * hh(id * 1.7 + seed)) * mix(0.85 + 0.3 * strand, 1.0, far) * (0.85 + 0.15 * lock);
		if (kind == 4) {
			// a patch of coils: little rings, denser in the inner shells, round-edged
			vec2 q = vHUv * 7.0 + seed * 3.7;
			vec2 cell = floor(q), fq = fract(q) - 0.5;
			float ring = abs(length(fq + (vec2(hh(cell.x + cell.y * 17.0), hh(cell.y - cell.x * 3.0)) - 0.5) * 0.4) - 0.28);
			float outer = fract(seed);
			a = (1.0 - smoothstep(0.08, 0.16 - outer * 0.04, ring)) + (1.0 - outer) * 0.75;
			a *= 1.0 - smoothstep(0.32, 0.5, length(vHUv - 0.5));
			shade = 0.75 + 0.5 * (1.0 - ring * 3.0);
		}
	}
	// (a loc or a braid is one colour its whole length, the root just darker)
	diffuseColor.rgb = mix(uRoot, uTip, smoothstep(0.0, kind == 2 || kind == 3 ? 0.15 : 1.0, v)) * shade * (0.45 + 0.55 * vHK.x);
	diffuseColor.a *= a;
}`)
			.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{\n\t// (a round loc or braid catches the sky all over: less of it)\n\tfloat tk = floor(vHK.y / 100.0), tube = tk == 2.0 || tk == 3.0 ? 0.45 : 1.0;\n\treflectedLight.indirectSpecular *= 0.25 * vHK.x * tube;\n\treflectedLight.indirectDiffuse *= (0.6 + 0.4 * vHK.x) * mix(0.75, 1.0, tube);\n\treflectedLight.directSpecular *= tube;\n}');
	};
	m.customProgramCacheKey = () => 'crysis-hair-5';
	return m;
}
