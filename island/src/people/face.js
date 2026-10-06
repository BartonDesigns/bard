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
export function faceDetail(A, F, P, p, S, rnd, normalOf, grey = 0) {
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
	// the brows: hairs on the skin along each brow's line (the base mesh's, on the brow bone),
	// groomed: a blunt head by the nose, an arch about two-thirds out, a tapered tail. At the
	// head the hairs stand up and out; along the arch and the tail they lie flat along it, the
	// upper ones combed down and the lower ones up, so the edges are clean. Each person has
	// their own shape (browShape); the grey share of the hairs (grey) drawn grey
	const B = F.brow, n0 = new THREE.Vector3(), n1 = new THREE.Vector3(), cx = (eyeC[0].x + eyeC[1].x) / 2;
	const sh = browShape(P.dna, rnd), up = new THREE.Vector3(0, 1, 0), tan = new THREE.Vector3(), dir = new THREE.Vector3(), sv = new THREE.Vector3();
	// the skin round the brows (its vertices and normals, in a fine grid), so that every
	// hair lies on it, a hair's width out, whatever the brow ridge's shape
	const onSkin = skinNear(A, p, B);
	const hair = (root, n, dir0, len, from, j, h) => {
		const kind = grey && hash(j * 131 + h) < grey ? 4 : 2, wid = sh.wid * S;
		dir.copy(dir0).addScaledVector(n, -dir0.dot(n)).normalize();
		const tip = root.clone().addScaledVector(dir, len).addScaledVector(n, 0.0005);
		onSkin(root, 0.0005); onSkin(tip, 0.0007);
		sv.crossVectors(n, dir).normalize().multiplyScalar(wid / 2);
		const a0 = vert(root.x - sv.x, root.y - sv.y, root.z - sv.z, 0, 0, kind, from), a1 = vert(root.x + sv.x, root.y + sv.y, root.z + sv.z, 1, 0, kind, from);
		const b0 = vert(tip.x - sv.x, tip.y - sv.y, tip.z - sv.z, 0, 1, kind, from), b1 = vert(tip.x + sv.x, tip.y + sv.y, tip.z + sv.z, 1, 1, kind, from);
		I.push(a0, a1, b1, a0, b1, b0);
	};
	const heads = [];
	for (let j = 0; j + 2 < B.length; j += 2) {
		const va = B[j], vb = B[j + 2], ta = B[j + 1] / 65535, tb = B[j + 3] / 65535;
		if (tb < ta) continue;
		// (the line lifted into the arch)
		const a = new THREE.Vector3(...at(va)).addScaledVector(up, sh.arch(ta) * S), b = new THREE.Vector3(...at(vb)).addScaledVector(up, sh.arch(tb) * S), side = Math.sign(a.x - cx) || 1;
		normalOf(va, n0); normalOf(vb, n1);
		if (ta === 0) heads.push({ a: a.clone(), n: n0.clone(), v: va });
		tan.subVectors(b, a);
		const L = tan.length();
		tan.normalize();
		const count = Math.round(L * sh.width((ta + tb) / 2) * S * sh.dens * 1.6e6);
		for (let h = 0; h < count; h++) {
			const f = rnd(), t = ta + (tb - ta) * f, n = n0.clone().lerp(n1, f).normalize(), w = sh.width(t) * S;
			// (across the brow: -1 its lower edge, 1 its upper; the head rounded off)
			const y = (rnd() * 2 - 1) * (t < 0.06 ? 0.7 + 0.3 * t / 0.06 : 1);
			const root = a.clone().lerp(b, f).addScaledVector(up, y * w / 2);
			// up and out at the head, flat along the line beyond it, combed in to the middle
			const k = Math.min(1, t / 0.28), comb = -y * 0.22 * (1 - sh.feather);
			const lift = (1 - k) * 1.15 + sh.feather * 0.45 * (1 - t) + comb + (rnd() - 0.5) * (0.25 + sh.feather * 0.3);
			const d0 = tan.clone().multiplyScalar(Math.cos(lift)).addScaledVector(up, Math.sin(lift));
			if (d0.x * side < 0 && k < 1) d0.x = Math.abs(d0.x) * side * 0.3;
			// (with the years, a wiry one now and then)
			const wiry = rnd() < sh.wiry;
			const len = (0.0045 + rnd() * 0.003) * (1 - 0.25 * t) * (wiry ? 1.8 : 1) * S;
			if (wiry) d0.addScaledVector(up, (rnd() - 0.3) * 0.8);
			hair(root, n, d0, len, f < 0.5 ? va : vb, j, h);
		}
	}
	// one in a hundred: the two brows joined by a few fine hairs over the nose
	if (sh.joined && heads.length === 2) {
		const [L0, L1] = heads, n = L0.n.clone().add(L1.n).normalize();
		for (let h = 0; h < 46; h++) {
			const f = rnd(), q = 1 - Math.abs(f - 0.5) * 2;
			if (rnd() < q * 0.45) continue;
			const root = L0.a.clone().lerp(L1.a, f).addScaledVector(up, (rnd() - 0.5) * sh.width(0) * 0.7 * S);
			const d0 = up.clone().multiplyScalar(0.8).add(new THREE.Vector3(Math.sign(f - 0.5) * 0.5, 0, 0));
			hair(root, n, d0, (0.003 + rnd() * 0.002) * S, f < 0.5 ? L0.v : L1.v, 999, h);
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

// brow shapes: [name, arch (m, at its peak), the peak (along it), the head's width and the
// tail's (m), density, feathering, weight for women, for men]
const BROWS = [
	['straight', 0.0012, 0.68, 0.0072, 0.0024, 1, 0, 1, 2],
	['soft arch', 0.0028, 0.66, 0.007, 0.0023, 1, 0, 1.4, 1.2],
	['high arch', 0.0046, 0.62, 0.0064, 0.0019, 1.05, 0, 1, 0.2],
	['full', 0.0024, 0.66, 0.0098, 0.0036, 1.3, 0.1, 0.7, 1.5],
	['thin', 0.003, 0.64, 0.0046, 0.0015, 1.1, 0, 1, 0.3],
	['feathered', 0.0026, 0.66, 0.0078, 0.0027, 0.9, 0.5, 1, 1],
];
// a person's brows: a shape (fuller with dark, coarse hair, finer with fair), their own
// width and arch, a man's flatter and wider; sparser and a little wiry with age; one in a
// hundred joined
function browShape(d, rnd) {
	const top = Math.max(...d.hairColour), dark = 1 - Math.min(1, top / 0.45);
	const wts = BROWS.map((b) => (d.male ? b[8] : b[7]) * (b[0] === 'full' ? 0.5 + dark : b[0] === 'thin' ? 1.4 - dark * 0.8 : 1));
	let x = rnd() * wts.reduce((a, b) => a + b, 0), k = 0;
	while (k < BROWS.length - 1 && (x -= wts[k]) > 0) k++;
	const [name, arch0, peak0, head0, tail0, dens0, feather] = BROWS[k];
	const wk = (0.85 + rnd() * 0.3) * (d.male ? 1.22 : 1), ak = (0.8 + rnd() * 0.4) * (d.male ? 0.6 : 1), peak = peak0 + (rnd() - 0.5) * 0.08;
	const old = clamp01((d.age - 55) / 30);
	const head = head0 * wk, tail = tail0 * wk, arch = arch0 * ak;
	const seed = Math.imul((d.seed ?? 0) ^ 0x51b2, 2654435761) >>> 0;
	return {
		name, feather, dens: dens0 * (1 - old * 0.35), wiry: old * (d.male ? 0.07 : 0.03), wid: d.male ? 0.0012 : 0.001, joined: seed % 100 === 7,
		// (rising to the peak, falling more steeply to the tail)
		arch: (t) => arch * (t < peak ? Math.sin(t / peak * Math.PI / 2) : Math.cos((t - peak) / (1 - peak) * Math.PI / 2) * 1.1 - 0.1),
		// (full from the head to past the middle, then tapering to the tail)
		width: (t) => head + (tail - head) * smooth(0.3, 1, t),
	};
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// a point kept a little out from the skin near the given vertices (off: how far, m): the
// skin's vertices there with their normals, bucketed; each point is set against the nearest
function skinNear(A, p, verts) {
	let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
	for (let j = 0; j < verts.length; j += 2) { const v = verts[j] * 3; x0 = Math.min(x0, p[v]); x1 = Math.max(x1, p[v]); y0 = Math.min(y0, p[v + 1]); y1 = Math.max(y1, p[v + 1]); z0 = Math.min(z0, p[v + 2]); z1 = Math.max(z1, p[v + 2]); }
	const m = 0.015, inBox = (v) => p[v * 3] > x0 - m && p[v * 3] < x1 + m && p[v * 3 + 1] > y0 - m && p[v * 3 + 1] < y1 + m && p[v * 3 + 2] > z0 - m && p[v * 3 + 2] < z1 + m;
	const nrm = new Map(), F = A.body;
	for (let i = 0; i < F.length; i += 6) {
		const a = F[i], b = F[i + 2], c = F[i + 4];
		if (!inBox(a) && !inBox(b) && !inBox(c)) continue;
		const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], wx = p[c * 3] - p[a * 3], wy = p[c * 3 + 1] - p[a * 3 + 1], wz = p[c * 3 + 2] - p[a * 3 + 2];
		const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
		for (const v of [a, b, c]) { const q = nrm.get(v) || [0, 0, 0]; q[0] += n[0]; q[1] += n[1]; q[2] += n[2]; nrm.set(v, q); }
	}
	const G = 0.004, grid = new Map(), key = (x, y, z) => Math.floor(x / G) + ',' + Math.floor(y / G) + ',' + Math.floor(z / G);
	for (const [v, n] of nrm) { const l = Math.hypot(...n) || 1, e = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2], n[0] / l, n[1] / l, n[2] / l], k = key(e[0], e[1], e[2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e); }
	return (q, off) => {
		let best = null, bd = 1e9;
		const cx = Math.floor(q.x / G), cy = Math.floor(q.y / G), cz = Math.floor(q.z / G);
		for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) for (const e of grid.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)) || []) { const d = (q.x - e[0]) ** 2 + (q.y - e[1]) ** 2 + (q.z - e[2]) ** 2; if (d < bd) { bd = d; best = e; } }
		if (!best) return;
		const s = (q.x - best[0]) * best[3] + (q.y - best[1]) * best[4] + (q.z - best[2]) * best[5];
		if (s < off) { q.x += best[3] * (off - s); q.y += best[4] * (off - s); q.z += best[5] * (off - s); }
	};
}

// lashes, brows and the wet line: strands drawn in the shader, no textures (hairCol: the
// brows' colour, greyCol: their grey hairs')
export function detailMaterial(hairCol, greyCol = hairCol) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
	const U = { uHair: { value: new THREE.Color(hairCol) }, uGrey: { value: new THREE.Color(greyCol) } };
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float kind;\nvarying float vKind;\nvarying vec2 vSt;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKind = kind; vSt = uv;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uHair;
uniform vec3 uGrey;
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
		float w = 0.5 * (1.0 - vSt.y * 0.8);
		a = 1.0 - smoothstep(w * 0.45, w, abs(vSt.x - 0.5));
		c = k == 4 ? uGrey : uHair;
		gRgh = 0.85; gSpec = 0.15; gLit = 0.7;
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
	m.customProgramCacheKey = () => 'crysis-face-detail-3';
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
