// Faces: the MakeHuman face shape targets (nose, jaw, chin, cheekbones, brow, lips, eyes,
// ears, the head's shape; CC0), a dozen or so blended strongly per person and the rest a
// little, so no two faces look like family; the skin's baked shading per vertex (ambient
// occlusion, thin flesh, the oily T-zone, the flush); the eyes (a cornea over an iris with a
// limbal ring, wet); and the small things round them, one mesh: lashes that close with the
// lids, brows of short hairs, the wet line along the lower lid. All baked for the base mesh
// by tools/bake-people-faces.mjs into assets/people/faces.json.

import * as THREE from 'three';

const FACES_URL = new URL('../assets/people/faces.json', import.meta.url).href;
const b64 = (s, Type) => { const a = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return new Type(a.buffer); };

// ---------- the asset ----------
export async function loadFaces() {
	const J = await (await fetch(FACES_URL)).json();
	const unpack = (t) => {
		if (!t) return null;
		const gaps = b64(t.i, Uint8Array), q = b64(t.d, Int8Array), idx = new Uint32Array(t.n), d = new Float32Array(t.n * 3);
		let v = -1, k = 0;
		for (let j = 0; j < gaps.length; j++) { v += gaps[j]; if (gaps[j] === 255) continue; v++; idx[k] = v; for (let c = 0; c < 3; c++) d[k * 3 + c] = q[k * 3 + c] * t.s; k++; }
		return { idx, d };
	};
	return { axes: J.axes.map((a) => ({ n: a.n, lo: unpack(a.lo), hi: unpack(a.hi) })), skin: b64(J.skin, Uint8Array), lash: b64(J.lash, Uint16Array), brow: b64(J.brow, Uint16Array) };
}

// ---------- who has which face ----------
// how far each feature varies between people (in the targets' -1..1), and which are one-sided
const SPREAD = {
	'nose-width': 0.4, 'nose-length': 0.35, 'nose-depth': 0.35, 'nose-hump': 0.35, 'nose-tip': 0.35, nostrils: 0.35, 'nose-curve': 0.3, 'nose-height': 0.25, 'nose-volume': 0.3, 'nose-flare': 0.3, 'nose-point': 0.3,
	'chin-out': 0.35, 'chin-width': 0.35, 'chin-height': 0.3, jaw: 0.4, 'jaw-out': 0.25, 'chin-cleft': 0.4,
	cheekbones: 0.4, cheeks: 0.35, 'cheek-inner': 0.3, forehead: 0.3, 'forehead-height': 0.3, temples: 0.3, 'brow-ridge': 0.35, 'brow-angle': 0.3,
	'mouth-width': 0.3, 'mouth-height': 0.25, 'lower-lip': 0.4, 'upper-lip': 0.4, 'cupids-bow': 0.35, 'mouth-corners': 0.3, 'mouth-out': 0.25, philtrum: 0.3,
	'eye-size': 0.25, 'eye-spacing': 0.25, 'eye-height': 0.2, 'eye-tilt': 0.35, 'eye-open': 0.3, 'eye-bags': 0.25, 'eye-fold': 0.3,
	'ear-size': 0.3, 'ear-out': 0.35, 'ear-lobe': 0.35, 'head-fat': 0.25, 'neck-width': 0.25,
};
const SHAPES = ['head-oval', 'head-round', 'head-square', 'head-triangle', 'head-heart', 'head-diamond'];

// a face from the seed: every feature a little, a dozen of them a lot, the head one or two
// shapes blended; nothing past what real faces do
export function faceDNA(r, d) {
	const n = () => (r() + r() + r() - 1.5) * 2;
	const f = {}, keys = Object.keys(SPREAD);
	for (const k of keys) f[k] = n() * SPREAD[k] * 0.35;
	for (let i = 0; i < 12; i++) { const k = keys[Math.floor(r() * keys.length)]; f[k] = n() * SPREAD[k]; }
	f['chin-cleft'] = r() < 0.25 ? r() * 0.5 : 0;
	const a = SHAPES[Math.floor(r() * SHAPES.length)], b = SHAPES[Math.floor(r() * SHAPES.length)];
	f[a] = 0.2 + r() * 0.45; f[b] = (f[b] || 0) + r() * 0.3;
	// the years: fuller under the eyes, a softer jaw; weight shows in the face
	f['eye-bags'] += Math.max(0, (d.age - 35) / 45) * 0.6;
	f['head-fat'] += (d.weight - 0.25) * 0.8;
	if (d.male) { f['brow-ridge'] += 0.12; f.jaw += 0.1; f['neck-width'] += 0.2; }
	for (const k in f) { f[k] = Math.max(-0.8, Math.min(0.8, f[k] * (d.child ? 0.5 : 1))); if (SHAPES.includes(k) || k === 'chin-cleft') f[k] = Math.max(0, f[k]); }
	return f;
}

// the face's shape into the body's vertices (before it is scaled to its height)
export function shapeFace(F, p, face) {
	if (!F || !face) return;
	for (const ax of F.axes) {
		const w = face[ax.n];
		if (!w) continue;
		const t = w > 0 ? ax.hi : ax.lo;
		if (!t) continue;
		const k = Math.abs(w), { idx, d } = t;
		for (let j = 0; j < idx.length; j++) { const o = idx[j] * 3; p[o] += d[j * 3] * k; p[o + 1] += d[j * 3 + 1] * k; p[o + 2] += d[j * 3 + 2] * k; }
	}
}

// the skin's baked shading for a piece of the body (its source vertices)
export function skinAttribute(F, src) {
	const a = new Uint8Array(src.length * 4);
	for (let i = 0; i < src.length; i++) { const o = src[i] * 4; if (F) a.set(F.skin.subarray(o, o + 4), i * 4); else a.set([255, 0, 0, 0], i * 4); }
	return new THREE.BufferAttribute(a, 4, true);
}

// ---------- lashes, brows and the lower lid's wet line: one small skinned mesh ----------
const MORPHS = [['eye-left-closure', 'eye-right-closure'], ['mouth-open'], ['mouth-corner-puller'], ['eyebrows-left-up', 'eyebrows-right-up']];
// (_normalOf: once the skin's normals at the brow, now read off the skin itself; kept in its
// place among the arguments)
export function faceDetail(A, F, P, p, S, rnd, _normalOf, grey = 0) {
	if (!F) return null;
	const V = [], UV = [], K = [], SI = [], SW = [], I = [], src = [];
	const vert = (x, y, z, u, v, kind, from) => { V.push(x, y, z); UV.push(u, v); K.push(kind); src.push(from); let s = 0; for (let q = 0; q < 4; q++) s += A.weights[from * 4 + q]; for (let q = 0; q < 4; q++) { SI.push(A.ids[from * 4 + q]); SW.push(A.weights[from * 4 + q] / (s || 1)); } return V.length / 3 - 1; };
	const at = (v) => [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
	// the lashes: the base mesh's own strips, strands drawn across them
	const L = F.lash;
	const eyeC = P.eyes.map((e, i) => P.eyeAt[i]);
	for (let j = 0; j < L.length; j += 3) {
		const v = L[j], u = L[j + 1] / 32767, w = L[j + 2] / 32767, upper = w >= 1 ? 1 : 0;
		const [x, y, z] = at(v);
		I.push(vert(x, y, z, u, w - upper, upper ? 0 : 1, v));
	}
	// the wet line: a thin strip from the lower lid's lash roots in towards the eye
	for (let side = 0; side < 2; side++) {
		const c = eyeC[side], roots = [];
		for (let j = 0; j < L.length; j += 3) { const w = L[j + 2] / 32767; if (w < 0.08) { const v = L[j]; if ((p[v * 3] > 0) === (c.x > 0) && !roots.some((q) => q.v === v)) roots.push({ v, u: L[j + 1] / 32767 }); } }
		roots.sort((a, b) => a.u - b.u);
		let prev = null;
		for (const q of roots) {
			const o = new THREE.Vector3(...at(q.v)), inw = c.clone().sub(o).setY(0).normalize();
			const a = o.clone().addScaledVector(inw, 0.0008).add(new THREE.Vector3(0, 0.0012, 0)), b = o.clone().addScaledVector(inw, 0.0022).add(new THREE.Vector3(0, 0.0016, 0));
			const i0 = vert(a.x, a.y, a.z, q.u, 0, 3, q.v), i1 = vert(b.x, b.y, b.z, q.u, 1, 3, q.v);
			if (prev) I.push(prev[0], i0, i1, prev[0], i1, prev[1]);
			prev = [i0, i1];
		}
	}
	// the brows: short hairs lying on the skin along each brow's arch, thick at the inner end
	// and thinning to the tail; the lower ones sweep up and out, the upper ones out and a little
	// down, the inner ones up; the grey share of them (grey) drawn grey. Under them the brow's
	// own tone, a soft ribbon, so the hairs read as one brow and not as strokes
	const B = F.brow, cx = (eyeC[0].x + eyeC[1].x) / 2;
	// (a woman's finer than a man's)
	const fine = P.dna.male ? 1 : 0.82, dens0 = (0.7 + rnd() * 0.6) * fine, thick0 = (0.8 + rnd() * 0.45) * fine;
	// everyone's brows as brows grow: of a natural weight (each their own, from the draws above),
	// many fine short hairs lying tidily, over the brow's own tone; or groomed to set values
	// (P.dna.brows: dens, thick, len, tidy, wid)
	const G = P.dna.brows || {}, dens = G.dens ?? dens0 * 1.15, thick = G.thick ?? thick0 * 0.68, blen = G.len ?? 0.72, tidy = G.tidy ?? 0.55, bwid = G.wid ?? 0.0008;
	// where each brow runs, inner end to tail: the face data's arch, cleaned (it repeats some
	// points and lists a few on the skin inside the brow ridge, centimetres behind it)
	const arches = [];
	for (let j = 0, cur = null, lastT = -1; j < B.length; j += 2) {
		const t = B[j + 1] / 65535;
		// (a brow ends where t falls back: the other one begins)
		if (!cur || t < lastT) arches.push(cur = []);
		lastT = t;
		const q = new THREE.Vector3(...at(B[j]));
		if (!cur.length || cur[cur.length - 1].q.distanceTo(q) > 1e-4) cur.push({ q, v: B[j] });
	}
	for (let k = 0; k < arches.length; k++) arches[k] = arches[k].filter((o, i, all) => { const a = all[i - 1] || all[i + 1], b = all[i + 1] || all[i - 1]; return !a || o.q.z > Math.min(a.q.z, b.q.z) - 0.015 * S; });
	// the skin itself, round the brows: a brow lies on it, every point of it, over the ridge's
	// curve (laid flat between a few points it cut through the ridge and stood off it by turns)
	const eyeY = (eyeC[0].y + eyeC[1].y) / 2, eyeZ = (eyeC[0].z + eyeC[1].z) / 2;
	const skinAt = frontSkin(A, p, cx - 0.085 * S, cx + 0.085 * S, eyeY - 0.01 * S, eyeY + 0.06 * S, eyeZ - 0.04 * S);
	const hit = { p: new THREE.Vector3(), n: new THREE.Vector3(), v: 0 };
	// a point on the skin at (x, y), off it by off along its normal; null off the skin
	const onSkinAt = (x, y, off) => skinAt(x, y, hit) ? { q: hit.p.clone().addScaledVector(hit.n, off * S), n: hit.n.clone(), v: hit.v } : null;
	for (const L of arches) {
		if (L.length < 2) continue;
		const side = Math.sign(L[0].q.x - cx) || 1, x0 = L[0].q.x, x1 = L[L.length - 1].q.x;
		// the brow bone along it: at each step across, the skin's frontmost point above the eye
		// (else the arch's own height there). The brow takes its height and lean from the bone
		// over the middle and the outer part (at the inner end the frontmost skin is the bulge
		// between the brows, higher up) and a brow's own shape: the head a little below the arch,
		// the peak some way out, the tail falling; never dipping (the data's inner end hooked
		// down, a tick)
		const ts = [], ys = [];
		for (let k = 0; k <= 10; k++) {
			const t = k / 10, x = x0 + (x1 - x0) * t;
			let best = null;
			for (let y = eyeY + 0.008 * S; y <= eyeY + 0.032 * S; y += 0.0005 * S) if (skinAt(x, y, hit) && (!best || hit.p.z > best.z)) best = { y, z: hit.p.z };
			let y = best && best.y > eyeY + 0.0095 * S ? best.y : null;
			if (y === null) { for (let i = 0; i + 1 < L.length; i++) if ((L[i].q.x - x) * (L[i + 1].q.x - x) <= 0) { const f = (x - L[i].q.x) / ((L[i + 1].q.x - L[i].q.x) || 1); y = L[i].q.y + (L[i + 1].q.y - L[i].q.y) * f; } }
			if (y !== null) { ts.push(t); ys.push(y); }
		}
		const ridge = browLine(ts, ys, { rise: (0.0025 + rnd() * 0.0015) * S, fall: (0.004 + rnd() * 0.002) * S, peak: 0.58 + rnd() * 0.1, tilt: 0.004 * S });
		// its edges: the lower on the bone, the upper above by the brow's height there, fullest
		// at the head (rounded in), tapering to the tail
		const hmax = 0.011 * thick * S, hAt = (t) => hmax * (0.72 + 0.28 * sm(0, 0.12, t)) * (1 - 0.7 * sm(0.45, 1, t));
		const lowAt = (t) => ridge(t) - 0.0015 * S, xAt = (t) => x0 + (x1 - x0) * t;
		// the tone: a fine grid laid on the skin, along it and across it
		const NT = 24, NU = 4, grid = [];
		for (let i = 0; i <= NT; i++) {
			const t = i / NT, row = [];
			for (let j = 0; j <= NU; j++) {
				const u = j / NU, o = onSkinAt(xAt(t), lowAt(t) + u * hAt(t), 0.0003);
				row.push(o ? vert(o.q.x, o.q.y, o.q.z, u, t, 5, o.v) : -1);
			}
			grid.push(row);
		}
		for (let i = 0; i < NT; i++) for (let j = 0; j < NU; j++) {
			const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j], d = grid[i + 1][j + 1];
			if (a >= 0 && b >= 0 && c >= 0 && d >= 0) I.push(a, c, d, a, d, b);
		}
		// the hairs, as many as the brow's length holds, more at the head
		const len0 = Math.abs(x1 - x0) / S, count = Math.round(54 * 13 * dens * (len0 / 0.036) * 0.9);
		for (let h = 0; h < count; h++) {
			// (thicker at the inner end: more of them there)
			let t = rnd();
			if (rnd() < 0.35) t *= t;
			const u = rnd(), x = xAt(t), y = lowAt(t) + u * hAt(t);
			const r0 = onSkinAt(x, y, 0.00025);
			if (!r0) continue;
			// up at the head, out along the body, down at the tail; the upper hairs lie a little
			// down and the lower a little up, meeting along the middle
			const ang = THREE.MathUtils.lerp(1.0, -0.35, Math.min(1, t * 1.25)) - (u - 0.5) * 0.5 * sm(0.12, 0.5, t) + (rnd() - 0.5) * 0.45 * tidy;
			const len = (0.005 + rnd() * 0.004) * S * blen;
			const r1 = onSkinAt(x + Math.cos(ang) * side * len, y + Math.sin(ang) * len, 0.0005);
			if (!r1) continue;
			const root = r0.q, tip = r1.q, dir = tip.clone().sub(root).normalize(), n = r0.n.clone().add(r1.n).normalize();
			const sv = new THREE.Vector3().crossVectors(n, dir).normalize().multiplyScalar(bwid * S / 2);
			const kind = grey && hash(h * 131 + (side > 0 ? 7919 : 0)) < grey ? 4 : 2;
			const a0 = vert(root.x - sv.x, root.y - sv.y, root.z - sv.z, 0, 0, kind, r0.v), a1 = vert(root.x + sv.x, root.y + sv.y, root.z + sv.z, 1, 0, kind, r0.v);
			const b0 = vert(tip.x - sv.x, tip.y - sv.y, tip.z - sv.z, 0, 1, kind, r1.v), b1 = vert(tip.x + sv.x, tip.y + sv.y, tip.z + sv.z, 1, 1, kind, r1.v);
			I.push(a0, a1, b1, a0, b1, b0);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	g.setAttribute('kind', new THREE.Float32BufferAttribute(K, 1));
	g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
	g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
	g.setIndex(I);
	g.computeVertexNormals();
	g.morphTargetsRelative = true;
	g.morphAttributes.position = MORPHS.map((list) => {
		const d = new Float32Array(src.length * 3);
		for (let i = 0; i < src.length; i++) for (const nm of list) { const t = A.targets[nm]; if (t) for (let c = 0; c < 3; c++) d[i * 3 + c] += t[src[i] * 3 + c] * A.unit * S; }
		return new THREE.Float32BufferAttribute(d, 3);
	});
	g.computeBoundingSphere();
	return g;
}

const hash = (x) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// a brow's line through the bone's heights (t, y): a brow's own shape (o.rise below the peak at
// the head, o.peak the way along, o.fall below it at the tail), set at the bone's height and
// leaning with it (no more than o.tilt end to end), weighed over the middle and the outer part
export function browLine(ts, ys, o) {
	const shape = (t) => t < o.peak ? -o.rise * ((o.peak - t) / o.peak) ** 2 : -o.fall * ((t - o.peak) / (1 - o.peak)) ** 2;
	let w0 = 0, w1 = 0, w2 = 0, r0 = 0, r1 = 0;
	for (let i = 0; i < ts.length; i++) {
		const t = ts[i], w = sm(0.2, 0.45, t), r = ys[i] - shape(t);
		w0 += w; w1 += w * t; w2 += w * t * t; r0 += w * r; r1 += w * r * t;
	}
	if (!w0) return shape;
	const d = w0 * w2 - w1 * w1;
	const b = Math.max(-o.tilt, Math.min(o.tilt, Math.abs(d) > 1e-12 ? (w0 * r1 - w1 * r0) / d : 0)), a = (r0 - b * w1) / w0;
	return (t) => a + b * t + shape(t);
}

// the frontmost skin at each (x, y) in a box round the brows: its point, its normal (smooth,
// across the triangles) and the vertex nearest it there (which the point rides); out: { p, n, v }
export function frontSkin(A, p, x0, x1, y0, y1, zMin) {
	const F = A.body, tris = [], nrm = new Map();
	const inBox = (v) => p[v * 3] > x0 && p[v * 3] < x1 && p[v * 3 + 1] > y0 && p[v * 3 + 1] < y1 && p[v * 3 + 2] > zMin;
	for (let i = 0; i < F.length; i += 6) {
		const a = F[i], b = F[i + 2], c = F[i + 4];
		if (!inBox(a) && !inBox(b) && !inBox(c)) continue;
		const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], wx = p[c * 3] - p[a * 3], wy = p[c * 3 + 1] - p[a * 3 + 1], wz = p[c * 3 + 2] - p[a * 3 + 2];
		const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
		for (const v of [a, b, c]) { const q = nrm.get(v) || [0, 0, 0]; q[0] += n[0]; q[1] += n[1]; q[2] += n[2]; nrm.set(v, q); }
		tris.push(a, b, c);
	}
	for (const [, q] of nrm) { const l = Math.hypot(q[0], q[1], q[2]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; }
	// (bucketed by x and y, 3 mm)
	const G = 0.003, grid = new Map(), key = (i, j) => i * 100003 + j;
	for (let k = 0; k < tris.length; k += 3) {
		let ax = 1e9, bx = -1e9, ay = 1e9, by = -1e9;
		for (let m = 0; m < 3; m++) { const v = tris[k + m]; ax = Math.min(ax, p[v * 3]); bx = Math.max(bx, p[v * 3]); ay = Math.min(ay, p[v * 3 + 1]); by = Math.max(by, p[v * 3 + 1]); }
		for (let i = Math.floor(ax / G); i <= Math.floor(bx / G); i++) for (let j = Math.floor(ay / G); j <= Math.floor(by / G); j++) { const kk = key(i, j); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(k); }
	}
	return (x, y, out) => {
		let best = -1e9;
		for (const k of grid.get(key(Math.floor(x / G), Math.floor(y / G))) || []) {
			const a = tris[k], b = tris[k + 1], c = tris[k + 2];
			const ax = p[a * 3], ay = p[a * 3 + 1], bx = p[b * 3], by = p[b * 3 + 1], cx = p[c * 3], cy = p[c * 3 + 1];
			const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
			if (Math.abs(d) < 1e-14) continue;
			const l0 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, l1 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d, l2 = 1 - l0 - l1;
			if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
			const z = l0 * p[a * 3 + 2] + l1 * p[b * 3 + 2] + l2 * p[c * 3 + 2];
			if (z <= best) continue;
			best = z;
			const na = nrm.get(a), nb = nrm.get(b), nc = nrm.get(c);
			out.p.set(x, y, z);
			out.n.set(l0 * na[0] + l1 * nb[0] + l2 * nc[0], l0 * na[1] + l1 * nb[1] + l2 * nc[1], l0 * na[2] + l1 * nb[2] + l2 * nc[2]).normalize();
			out.v = l0 >= l1 && l0 >= l2 ? a : l1 >= l2 ? b : c;
		}
		return best > -1e9;
	};
}

// lashes, brows and the wet line: strands drawn in the shader, no textures (hairCol: the
// brows' colour, greyCol: their grey hairs')
export function detailMaterial(hairCol, greyCol = hairCol) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
	// (uFill: how full the brow's own tone under its hairs)
	const U = { uHair: { value: new THREE.Color(hairCol) }, uGrey: { value: new THREE.Color(greyCol) }, uFill: { value: 1.8 } };
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float kind;\nvarying float vKind;\nvarying vec2 vSt;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKind = kind; vSt = uv;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uHair;
uniform vec3 uGrey;
uniform float uFill;
varying float vKind;
varying vec2 vSt;
float dh(float x) { return fract(sin(x * 91.7) * 43758.5453); }
float gRgh = 0.7, gSpec = 1.0, gLit = 1.0;`)
			.replace('#include <color_fragment>', `#include <color_fragment>
{
	int k = int(vKind + 0.5);
	float a = 0.0; vec3 c = uHair;
	if (k <= 1) {
		// lashes: fine strands out from the lid, tapering, darker than the hair
		float n = k == 0 ? 130.0 : 50.0, x = vSt.x * n, id = floor(x);
		float len = 0.55 + 0.45 * dh(id + float(k) * 7.0), t = vSt.y / len;
		float w = 0.22 * (1.0 - t * 0.8);
		a = step(t, 1.0) * (1.0 - smoothstep(w * 0.6, w, abs(fract(x + (dh(id) - 0.5) * 0.3 + t * 0.15) - 0.5)));
		a *= k == 0 ? 1.0 : 0.6;
		c = uHair * 0.3 + vec3(0.008);
	} else if (k == 2 || k == 4) {
		// a brow hair: thin, tapering to the tip; matt and in its own shade, as hair lying
		// thick on skin is (a shine on so fine a thing only greys it)
		// (each a little see-through: many together make the brow, softly)
		float w = 0.5 * (1.0 - vSt.y * 0.8);
		a = (1.0 - smoothstep(w * 0.45, w, abs(vSt.x - 0.5))) * 0.8;
		c = k == 4 ? uGrey : uHair;
		gRgh = 0.85; gSpec = 0.15; gLit = 0.82;
	} else if (k == 5) {
		// the brow's own tone under its hairs: soft across, fullest at the inner end, fading to
		// the tail
		float across = 1.0 - smoothstep(0.05, 0.5, abs(vSt.x - 0.5));
		a = min(0.65, across * (0.3 + 0.14 * (1.0 - vSt.y)) * uFill) * smoothstep(0.0, 0.06, vSt.y) * (1.0 - smoothstep(0.8, 1.0, vSt.y));
		c = uHair * 1.08;
		gRgh = 0.9; gSpec = 0.1; gLit = 0.75;
	} else {
		// the wet line: clear, glossy, a little pink where it meets the lid
		a = sin(vSt.y * 3.14159) * 0.45;
		c = vec3(0.75, 0.55, 0.52);
		gRgh = 0.06;
	}
	diffuseColor.rgb = c;
	diffuseColor.a *= a;
	if (diffuseColor.a < 0.02) discard;
}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRgh;')
			.replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.directSpecular *= gSpec; reflectedLight.indirectSpecular *= gSpec; reflectedLight.directDiffuse *= gLit; reflectedLight.indirectDiffuse *= gLit;');
	};
	m.customProgramCacheKey = () => 'crysis-face-detail-8';
	return m;
}

// ---------- the eyes ----------
// one eyeball for everyone: a unit sphere with the cornea's bulge over the iris (+z)
let eyeGeo = null;
export function eyeGeometry() {
	if (eyeGeo) return eyeGeo;
	const g = new THREE.SphereGeometry(1, 28, 20);
	g.rotateX(Math.PI / 2);
	const pos = g.attributes.position, v = new THREE.Vector3();
	for (let i = 0; i < pos.count; i++) {
		v.fromBufferAttribute(pos, i);
		const th = Math.acos(THREE.MathUtils.clamp(v.z, -1, 1)), k = th < 0.62 ? Math.pow(1 - (th / 0.62) ** 2, 1.4) : 0;
		v.multiplyScalar(1 + 0.085 * k);
		pos.setXYZ(i, v.x, v.y, v.z);
	}
	g.computeVertexNormals();
	eyeGeo = g;
	return g;
}
// irises people have: browns most, then hazel, amber, green, grey and blue
const IRIS = [[0.16, 0.08, 0.035], [0.22, 0.12, 0.05], [0.3, 0.17, 0.07], [0.35, 0.24, 0.1], [0.3, 0.3, 0.13], [0.24, 0.32, 0.2], [0.34, 0.4, 0.44], [0.26, 0.38, 0.55], [0.4, 0.26, 0.09]];
export function irisOf(d, r) {
	const eu = d.ancestry[2], x = r();
	// dark brown for most of the world; lighter eyes mostly with European ancestry
	const light = eu > 0.5 ? (x < 0.3 ? 7 : x < 0.5 ? 6 : x < 0.65 ? 5 : x < 0.8 ? 4 : x < 0.9 ? 3 : 2) : x < 0.75 ? 0 : x < 0.93 ? 1 : 8;
	return light;
}
const eyeMats = new Map();
export function eyeMaterial(k) {
	if (eyeMats.has(k)) return eyeMats.get(k);
	const c = IRIS[k] || IRIS[0];
	const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.376, specularIntensity: 1 });
	const U = { uIris: { value: new THREE.Color().setRGB(...c) }, uIris2: { value: new THREE.Color().setRGB(c[0] * 1.6 + 0.08, c[1] * 1.3 + 0.04, c[2] * 0.8) } };
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vEyeP;\nvarying vec3 vEyeV;\nvarying vec3 vEyeN;\nvarying float vUpN;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEyeP = position; vEyeN = normal;\nvEyeV = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz - position;\nvUpN = normalize( mat3( modelMatrix ) * normal ).y;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uIris;
uniform vec3 uIris2;
varying vec3 vEyeP;
varying vec3 vEyeV;
varying vec3 vEyeN;
varying float vUpN;
float eh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float en(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(eh(i), eh(i + vec2(1, 0)), f.x), mix(eh(i + vec2(0, 1)), eh(i + vec2(1, 1)), f.x), f.y); }
float gWet = 0.0;`)
			.replace('#include <color_fragment>', `#include <color_fragment>
{
	// the iris lies on a plane behind the cornea: seen through it, bent
	const float IZ = 0.84, IR = 0.56;
	vec3 P = vEyeP, V = normalize(vEyeV);
	vec2 ip = P.xy;
	if (P.z > IZ) { vec3 R = refract(-V, normalize(vEyeN), 1.0 / 1.376); ip = P.xy + R.xy * (IZ - P.z) / min(R.z, -0.2); }
	float r = length(ip) / IR, an = atan(ip.y, ip.x);
	vec3 sclera = vec3(0.86, 0.82, 0.78) * (0.9 + 0.1 * en(P.xy * 9.0));
	// fine vessels and a pinker white towards the corners
	float corner = smoothstep(0.35, 0.95, abs(P.x));
	float vein = smoothstep(0.72, 0.9, en(vec2(an * 6.0, length(P.xy) * 14.0)) * en(P.xy * 30.0 + 3.0) * 1.6) * smoothstep(0.55, 0.9, length(P.xy));
	sclera = mix(sclera, vec3(0.8, 0.5, 0.47), corner * 0.3 + vein * 0.35);
	// the iris: fibres out from the pupil, a lighter collarette, crypts, the dark limbal ring
	float fib = en(vec2(an * 38.0, r * 3.0)) * 0.6 + en(vec2(an * 90.0, r * 7.0)) * 0.4;
	vec3 iris = mix(uIris * 0.7, uIris * 1.25, fib);
	iris = mix(iris, uIris2, smoothstep(0.62, 0.35, r) * 0.55 * (0.6 + 0.4 * fib));
	iris *= 1.0 - 0.35 * smoothstep(0.55, 0.8, en(vec2(an * 14.0, r * 5.0))) * step(0.4, r);
	iris = mix(iris, uIris * 0.25, smoothstep(0.8, 0.98, r));
	float pupil = 0.36 + 0.04 * sin(an * 3.0) * 0.0;
	iris = mix(vec3(0.012), iris, smoothstep(pupil - 0.02, pupil + 0.02, r));
	vec3 col = mix(iris, sclera, smoothstep(0.97, 1.05, r));
	// the lids' shade over the top of the eye
	col *= 1.0 - 0.5 * smoothstep(0.0, 0.55, vUpN);
	diffuseColor.rgb = col;
	gWet = 1.0 - smoothstep(0.95, 1.05, r);
}`);
	};
	m.customProgramCacheKey = () => 'crysis-eye-2';
	m.userData.shared = true;
	// (a copy keeps the iris: some places light their people's eyes their own way)
	const own = m.onBeforeCompile, key = m.customProgramCacheKey;
	m.clone = function () { const c = new THREE.MeshPhysicalMaterial().copy(this); c.onBeforeCompile = own; c.customProgramCacheKey = key; return c; };
	eyeMats.set(k, m);
	return m;
}
