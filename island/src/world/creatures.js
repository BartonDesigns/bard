// Animals sculpted, not assembled. Every body here is lofted: a smooth spine through key
// cross-sections (each an egg-shaped ellipse, rounder on the back than the belly), so a
// seal is one continuous shape from its whiskered muzzle to its hind flippers rather than a
// ball stuck on a capsule. Limbs, flippers, ears, necks and wings are lofts too, and every
// vertex carries its colour: dark back to pale belly, a deer's white rump and throat, a
// harbor seal's spots, a gull's grey mantle and black wingtips.
// Each builder returns one indexed BufferGeometry (position, normal, colour), metres, the
// animal facing +z with its feet (or belly) on y = 0; draw it with a material that has
// vertexColors on and a white colour (an instance colour then tints the whole animal).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
// smooth value noise, for spots and dapples
function vnoise(x, y, z) {
	const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
	const u = (t) => t * t * (3 - 2 * t), a = u(fx), b = u(fy), c = u(fz);
	const L = (i, j, k) => hash(ix + i, iy + j, iz + k);
	const m = (p, q, t) => p + (q - p) * t;
	return m(m(m(L(0, 0, 0), L(1, 0, 0), a), m(L(0, 1, 0), L(1, 1, 0), a), b), m(m(L(0, 0, 1), L(1, 0, 1), a), m(L(0, 1, 1), L(1, 1, 1), a), b), c);
}
const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

// keys: [x, y, z, halfWidth, topRadius, bottomRadius] along the spine, head end last.
// paint(s, up, p) -> [r, g, b]: s along the spine 0..1, up -1 (belly) .. 1 (back), p the point.
export function loft(keys, { seg = 20, sub = 5, paint = () => [0.5, 0.5, 0.5] } = {}) {
	const K = keys.length, S = [];
	for (let i = 0; i < K - 1; i++) {
		for (let j = 0; j < sub; j++) {
			const t = j / sub, a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(K - 1, i + 2)];
			S.push(b.map((_v, n) => (n < 3 ? cr(a[n], b[n], c[n], d[n], t) : Math.max(0.0005, cr(a[n], b[n], c[n], d[n], t)))));
		}
	}
	S.push(keys[K - 1].slice());
	const M = S.length, pos = [], col = [], idx = [];
	const T = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
	for (let i = 0; i < M; i++) {
		const q = S[i], q0 = S[Math.max(0, i - 1)], q1 = S[Math.min(M - 1, i + 1)];
		T.set(q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]).normalize();
		side.crossVectors(Math.abs(T.y) > 0.85 ? Z : Y, T).normalize();
		up.crossVectors(T, side).normalize();
		for (let k = 0; k <= seg; k++) {
			const an = k / seg * Math.PI * 2, s = Math.sin(an), c = Math.cos(an);
			P.set(q[0], q[1], q[2]).addScaledVector(side, c * q[3]).addScaledVector(up, s * (s > 0 ? q[4] : q[5]));
			pos.push(P.x, P.y, P.z);
			col.push(...paint(i / (M - 1), s, P));
		}
	}
	for (let i = 0; i < M - 1; i++) for (let k = 0; k < seg; k++) {
		const a = i * (seg + 1) + k, b = a + seg + 1;
		idx.push(a, b, a + 1, b, b + 1, a + 1);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}
// a limb or a neck: a tube through points [x, y, z, r]
export const tube = (pts, opt = {}) => loft(pts.map(([x, y, z, r]) => [x, y, z, r, r, r]), { seg: 12, sub: 4, ...opt });
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const lin = (c) => c.map((v) => Math.pow(v, 2.2));
const shade = (back, belly, soft = 0.35) => (s, up) => mix(belly, back, THREE.MathUtils.smoothstep(up, -soft, soft));
// (every part down to the same attributes: position, normal, colour, indexed)
const done = (parts) => {
	const ps = parts.map((q) => { for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); if (!q.attributes.normal) q.computeVertexNormals(); return q.index ? q : q.setIndex([...Array(q.attributes.position.count).keys()]); });
	const g = mergeGeometries(ps);
	if (!g) throw Error('creatures: parts would not merge');
	g.computeBoundingSphere();
	return g;
};

// ---------- the pinnipeds ----------
// a harbor seal hauled out: a plump, spotted, tapering body in the "banana" pose (head and
// hind flippers lifted), a round head with a short muzzle, small fore flippers
export function harborSeal(tone = 0.5) {
	const back = lin(mix([0.36, 0.36, 0.35], [0.55, 0.52, 0.47], tone)), belly = lin(mix([0.62, 0.6, 0.56], [0.78, 0.75, 0.68], tone)), spot = lin([0.12, 0.12, 0.12]);
	const paint = (s, up, p) => {
		const c = shade(back, belly, 0.5)(s, up);
		const n = vnoise(p.x * 9, p.y * 9, p.z * 9);
		return n > 0.72 ? mix(c, spot, 0.75) : c;
	};
	const body = loft([
		[0, 0.2, -0.95, 0.04, 0.02, 0.02], [0, 0.14, -0.8, 0.1, 0.06, 0.05], [0, 0.14, -0.55, 0.2, 0.15, 0.12],
		[0, 0.2, -0.2, 0.3, 0.26, 0.19], [0, 0.22, 0.15, 0.32, 0.28, 0.2], [0, 0.24, 0.45, 0.26, 0.24, 0.17],
		[0, 0.3, 0.66, 0.16, 0.16, 0.12], [0, 0.36, 0.8, 0.15, 0.15, 0.12], [0, 0.37, 0.95, 0.09, 0.08, 0.07], [0, 0.35, 1.03, 0.045, 0.04, 0.035], [0, 0.34, 1.05, 0.005, 0.005, 0.005],
	], { seg: 24, sub: 6, paint });
	// hind flippers, spread in a V, and the fore flippers at the chest
	const fl = (x, z0, z1, y, w) => loft([[x, y, z0, 0.02, 0.01, 0.01], [x * 1.2, y, (z0 + z1) / 2, w, 0.02, 0.015], [x * 1.4, y + 0.02, z1, w * 1.3, 0.012, 0.01], [x * 1.45, y + 0.02, z1 - 0.03, 0.005, 0.005, 0.005]], { seg: 10, sub: 3, paint: () => back });
	const eye = (sx) => new THREE.SphereGeometry(0.026, 10, 8).translate(sx * 0.085, 0.42, 0.9);
	const eyes = [eye(-1), eye(1)].map((g) => { const n = g.attributes.position.count; g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0.01), 3)); return g; });
	return done([body, fl(0.06, -0.85, -1.15, 0.2, 0.08), fl(-0.06, -0.85, -1.15, 0.2, 0.08), fl(0.26, 0.45, 0.62, 0.04, 0.06), fl(-0.26, 0.45, 0.62, 0.04, 0.06), ...eyes]);
}
// a California sea lion, propped up on its fore flippers: long neck, pointed dog-like
// muzzle, sleek brown
export function seaLion(tone = 0.5) {
	const back = lin(mix([0.3, 0.2, 0.12], [0.5, 0.36, 0.22], tone)), belly = lin(mix([0.45, 0.33, 0.2], [0.62, 0.48, 0.32], tone));
	const paint = shade(back, belly, 0.5);
	const body = loft([
		[0, 0.12, -1.0, 0.04, 0.02, 0.02], [0, 0.12, -0.8, 0.14, 0.09, 0.07], [0, 0.2, -0.4, 0.28, 0.22, 0.16], [0, 0.35, 0.0, 0.3, 0.26, 0.2],
		[0, 0.6, 0.28, 0.22, 0.2, 0.18], [0, 0.85, 0.42, 0.13, 0.13, 0.12], [0, 1.0, 0.52, 0.11, 0.11, 0.1], [0, 1.02, 0.7, 0.055, 0.05, 0.04], [0, 1.0, 0.78, 0.01, 0.01, 0.01],
	], { seg: 22, sub: 6, paint });
	const ff = (sx) => loft([[sx * 0.2, 0.42, 0.18, 0.05, 0.03, 0.03], [sx * 0.32, 0.18, 0.28, 0.08, 0.02, 0.02], [sx * 0.38, 0.02, 0.45, 0.12, 0.012, 0.012], [sx * 0.4, 0.01, 0.55, 0.005, 0.005, 0.005]], { seg: 10, sub: 3, paint: () => back });
	const hf = (sx) => loft([[sx * 0.1, 0.1, -0.85, 0.04, 0.02, 0.02], [sx * 0.3, 0.02, -0.75, 0.1, 0.015, 0.015], [sx * 0.42, 0.01, -0.6, 0.004, 0.004, 0.004]], { seg: 8, sub: 3, paint: () => back });
	return done([body, ff(1), ff(-1), hf(1), hf(-1)]);
}

// a northern elephant seal on the sand at Año Nuevo: a vast tapering body, thick folded
// neck; the bull with his drooping trunk of a nose and pale scarred chest shield. About
// 2.4 m long here (scale it); the bulls about half as long again.
export function elephantSeal(bull = false) {
	const back = lin(bull ? [0.38, 0.33, 0.28] : [0.52, 0.45, 0.36]), belly = lin(bull ? [0.5, 0.45, 0.38] : [0.62, 0.55, 0.45]), scar = lin([0.72, 0.62, 0.55]);
	const paint = (s, up, p) => {
		let c = shade(back, belly, 0.5)(s, up);
		if (bull && s > 0.62 && s < 0.85) c = mix(c, scar, 0.35 + 0.35 * vnoise(p.x * 12, p.y * 12, p.z * 12));
		// the moult: patches of old coat peeling
		return mix(c, lin([0.62, 0.52, 0.4]), vnoise(p.x * 4, p.y * 4, p.z * 4) > 0.7 ? 0.35 : 0);
	};
	const H = bull ? 1.25 : 1;
	const body = loft([
		[0, 0.14, -1.2, 0.04, 0.03, 0.03], [0, 0.14, -1.05, 0.14, 0.08, 0.07], [0, 0.2, -0.7, 0.36, 0.26, 0.2], [0, 0.26, -0.2, 0.46 * H, 0.36 * H, 0.26],
		[0, 0.3, 0.3, 0.44 * H, 0.38 * H, 0.27], [0, 0.34 * H, 0.7, 0.34 * H, 0.33 * H, 0.26], [0, 0.4 * H, 0.95, 0.24, 0.23, 0.2], [0, 0.42 * H, 1.12, 0.17, 0.16, 0.14], [0, 0.4 * H, 1.25, 0.1, 0.09, 0.08], [0, 0.38 * H, 1.3, 0.01, 0.01, 0.01],
	], { seg: 26, sub: 6, paint });
	const parts = [body];
	if (bull) parts.push(tube([[0, 0.44 * H, 1.2, 0.07], [0, 0.4 * H, 1.32, 0.065], [0, 0.3 * H, 1.36, 0.05], [0, 0.22 * H, 1.33, 0.035], [0, 0.2 * H, 1.3, 0.005]], { paint: () => back }));
	const fl = (sx) => loft([[sx * 0.36, 0.1, 0.72, 0.05, 0.03, 0.03], [sx * 0.46, 0.04, 0.85, 0.09, 0.02, 0.02], [sx * 0.5, 0.02, 1.0, 0.005, 0.005, 0.005]], { seg: 8, sub: 3, paint: () => back });
	const hf = (sx) => loft([[sx * 0.06, 0.12, -1.1, 0.03, 0.02, 0.02], [sx * 0.18, 0.1, -1.3, 0.1, 0.015, 0.015], [sx * 0.26, 0.1, -1.42, 0.005, 0.005, 0.005]], { seg: 8, sub: 3, paint: () => back });
	parts.push(fl(1), fl(-1), hf(1), hf(-1));
	for (const sx of [-1, 1]) { const e = new THREE.SphereGeometry(0.035, 10, 8).translate(sx * 0.11, 0.48 * H, 1.16); const n = e.attributes.position.count; e.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0.01), 3)); parts.push(e); }
	return done(parts);
}

// ---------- a black-tailed deer ----------
export function deer() {
	const coat = lin([0.47, 0.35, 0.24]), belly = lin([0.86, 0.8, 0.7]), dark = lin([0.16, 0.12, 0.1]);
	const paint = (s, up, p) => {
		let c = shade(coat, belly, 0.25)(s, up);
		if (p.z < -0.5 && up < 0.2) c = mix(c, belly, 0.8);                           // the pale rump
		return c;
	};
	const body = loft([
		[0, 1.0, -0.62, 0.05, 0.05, 0.05], [0, 1.02, -0.55, 0.17, 0.17, 0.2], [0, 1.0, -0.2, 0.22, 0.2, 0.27], [0, 1.02, 0.2, 0.21, 0.19, 0.26], [0, 1.06, 0.45, 0.17, 0.18, 0.2], [0, 1.1, 0.56, 0.08, 0.1, 0.1],
	], { seg: 20, sub: 5, paint });
	const neck = tube([[0, 1.02, 0.36, 0.17], [0, 1.14, 0.48, 0.13], [0, 1.3, 0.6, 0.1], [0, 1.46, 0.68, 0.085], [0, 1.54, 0.72, 0.08]], { seg: 16, sub: 5, paint: (s, up) => mix(coat, belly, up < -0.4 && s > 0.5 ? 0.7 : 0) });
	const head = loft([[0, 1.55, 0.64, 0.05, 0.05, 0.05], [0, 1.57, 0.7, 0.085, 0.085, 0.075], [0, 1.57, 0.78, 0.08, 0.08, 0.07], [0, 1.53, 0.88, 0.055, 0.05, 0.05], [0, 1.5, 0.96, 0.04, 0.035, 0.035], [0, 1.49, 1.0, 0.03, 0.028, 0.026], [0, 1.485, 1.02, 0.004, 0.004, 0.004]], { seg: 18, sub: 5, paint: (s, up) => (s > 0.86 ? dark : up < -0.5 && s > 0.5 ? belly : coat) });
	const eyes = [-1, 1].map((sx) => { const e = new THREE.SphereGeometry(0.018, 10, 8).translate(sx * 0.068, 1.6, 0.8); const n = e.attributes.position.count; e.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0.01), 3)); return e; });
	// the mule-deer ears: big, cupped, held out to the sides
	const ear = (sx) => loft([[sx * 0.05, 1.64, 0.68, 0.02, 0.012, 0.012], [sx * 0.13, 1.72, 0.66, 0.07, 0.016, 0.012], [sx * 0.21, 1.77, 0.64, 0.055, 0.014, 0.01], [sx * 0.26, 1.79, 0.63, 0.004, 0.004, 0.004]], { seg: 10, sub: 4, paint: (s, up) => (up < 0 ? lin([0.8, 0.7, 0.62]) : coat) });
	const tail = tube([[0, 1.02, -0.6, 0.04], [0, 0.92, -0.7, 0.05], [0, 0.8, -0.72, 0.012]], { paint: (s, up) => (up > 0 ? dark : belly) });
	// the legs as a deer stands them: the foreleg straight and slender below the knee; the
	// hind leg a heavy thigh, the hock bent back, the long cannon bone, small dark hooves
	const T = { seg: 14, sub: 6 }, legs = [];
	for (const sx of [-1, 1]) {
		legs.push(tube([[sx * 0.12, 1.02, 0.36, 0.085], [sx * 0.12, 0.8, 0.4, 0.06], [sx * 0.115, 0.56, 0.4, 0.036], [sx * 0.112, 0.5, 0.41, 0.033], [sx * 0.11, 0.26, 0.42, 0.025], [sx * 0.11, 0.07, 0.43, 0.022], [sx * 0.11, 0.0, 0.46, 0.026]], { ...T, paint: (s) => (s > 0.93 ? dark : coat) }));
		legs.push(tube([[sx * 0.13, 1.02, -0.36, 0.12], [sx * 0.13, 0.82, -0.44, 0.09], [sx * 0.125, 0.64, -0.5, 0.05], [sx * 0.12, 0.5, -0.56, 0.035], [sx * 0.118, 0.27, -0.5, 0.026], [sx * 0.116, 0.07, -0.46, 0.022], [sx * 0.116, 0.0, -0.43, 0.026]], { ...T, paint: (s) => (s > 0.93 ? dark : coat) }));
	}
	return done([body, neck, head, ...eyes, ear(1), ear(-1), tail, ...legs]);
}

// ---------- birds, wings spread in flight ----------
// span: wingtip to wingtip (m); kind: 'gull' | 'pelican' | 'vulture' | 'hawk'
export function bird(kind) {
	const P = {
		gull: { span: 1.35, body: 0.07, back: [0.62, 0.65, 0.68], belly: [0.96, 0.96, 0.95], tip: [0.05, 0.05, 0.06], dihedral: 0.08, chord: 0.2, fingers: 0, bill: [0.95, 0.8, 0.2] },
		pelican: { span: 2.1, body: 0.12, back: [0.4, 0.38, 0.36], belly: [0.5, 0.48, 0.45], tip: [0.18, 0.17, 0.16], dihedral: 0.0, chord: 0.3, fingers: 0, bill: [0.7, 0.55, 0.35], longBill: true },
		vulture: { span: 1.8, body: 0.1, back: [0.12, 0.1, 0.09], belly: [0.18, 0.15, 0.13], tip: [0.45, 0.42, 0.4], dihedral: 0.2, chord: 0.3, fingers: 6, bill: [0.75, 0.25, 0.2] },
		hawk: { span: 1.25, body: 0.09, back: [0.36, 0.24, 0.15], belly: [0.9, 0.85, 0.75], tip: [0.2, 0.14, 0.1], dihedral: 0.05, chord: 0.26, fingers: 5, bill: [0.25, 0.22, 0.2], redTail: true },
	}[kind] || {};
	const back = lin(P.back), belly = lin(P.belly), tipC = lin(P.tip), b = P.body;
	const body = loft([[0, 0, -0.32, 0.01, 0.01, 0.01], [0, 0, -0.22, b * 0.6, b * 0.5, b * 0.5], [0, 0, 0, b, b, b * 1.1], [0, 0.01, 0.16, b * 0.8, b * 0.8, b * 0.8], [0, 0.03, 0.26, b * 0.62, b * 0.62, b * 0.58], [0, 0.03, 0.33, b * 0.4, b * 0.38, b * 0.36]], { seg: 16, sub: 4, paint: shade(back, belly, 0.3) });
	const billL = P.longBill ? 0.32 : 0.06;
	const bill = loft([[0, 0.03, 0.33, b * 0.28, b * 0.22, b * 0.22], [0, 0.02, 0.33 + billL, b * 0.12, b * 0.06, P.longBill ? b * 0.35 : b * 0.06], [0, 0.01, 0.34 + billL, 0.003, 0.003, 0.003]], { seg: 10, sub: 3, paint: () => lin(P.bill) });
	// the tail: a fan, rust red on the red-tail
	const tail = loft([[0, 0, -0.22, b * 0.5, 0.01, 0.01], [0, 0, -0.38, b * 1.4, 0.008, 0.008], [0, 0, -0.44, b * 1.5, 0.004, 0.004], [0, 0, -0.45, 0.004, 0.003, 0.003]], { seg: 8, sub: 3, paint: () => (P.redTail ? lin([0.62, 0.28, 0.14]) : back) });
	const wings = [];
	for (const sx of [-1, 1]) {
		// an airfoil tapering out to the tip, bent up by the dihedral, swept back a little
		const H = P.span / 2, c = P.chord, d = P.dihedral;
		const keys = [];
		for (let k = 0; k <= 6; k++) {
			const u = k / 6, x = sx * (b * 0.8 + u * (H - b * 0.8)), y = Math.abs(x) * Math.sin(d) + Math.sin(u * Math.PI) * 0.02;
			const ch = c * (1 - u * (P.fingers ? 0.25 : 0.6));
			keys.push([x, y, 0.05 - u * u * c * 0.35, 0.012, ch * 0.5, ch * 0.5]);
		}
		// (a wing's cross-section is its chord: lofted along x, so the "width" is thickness
		// and the "radii" the chord fore and aft; paint the upper side dark)
		const w = loft(keys.map(([x, y, z, t, cf, ca]) => [x, y, z, t, cf, ca]), { seg: 10, sub: 3, paint: (s, up) => (s > 0.8 && !P.fingers ? tipC : up > 0 ? back : mix(back, belly, 0.5)) });
		// the loft runs along x, so turn each ring's plane to lie flat: swap y/z of the offsets
		const p = w.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const ring = Math.floor(i / 11), key = keys[Math.min(keys.length - 1, Math.round(ring / 3))];
			const oy = p.getY(i) - key[1], oz = p.getZ(i) - key[2];
			p.setY(i, key[1] + oz * 0.12); p.setZ(i, key[2] + oy);
		}
		w.computeVertexNormals();
		wings.push(w);
		// the primaries splayed like fingers at the tip (vulture, hawk)
		for (let f = 0; f < P.fingers; f++) {
			const x0 = sx * H * 0.92, z0 = 0.05 - c * 0.3 - f * c * 0.12;
			wings.push(tube([[x0, (H * 0.92) * Math.sin(d), z0, 0.012], [x0 + sx * (0.14 + (f % 3) * 0.02), (H * 0.95) * Math.sin(d) + 0.01, z0 - 0.02 - f * 0.01, 0.009], [x0 + sx * 0.22, H * Math.sin(d) + 0.015, z0 - 0.04 - f * 0.012, 0.002]], { paint: () => tipC }));
		}
	}
	return done([body, bill, tail, ...wings]);
}

// ---------- ducks and geese on the water ----------
export function waterfowl(kind = 'mallard') {
	const goose = kind === 'goose';
	const back = lin(goose ? [0.42, 0.36, 0.3] : [0.45, 0.36, 0.26]), belly = lin(goose ? [0.86, 0.84, 0.8] : [0.62, 0.55, 0.45]);
	const neckC = lin(goose ? [0.06, 0.06, 0.06] : [0.1, 0.35, 0.18]), bill = lin(goose ? [0.08, 0.08, 0.08] : [0.85, 0.75, 0.2]);
	const s = goose ? 1.5 : 1;
	const body = loft([[0, 0.12 * s, -0.26 * s, 0.02, 0.02, 0.02], [0, 0.12 * s, -0.2 * s, 0.1 * s, 0.07 * s, 0.07 * s], [0, 0.1 * s, 0, 0.14 * s, 0.1 * s, 0.1 * s], [0, 0.1 * s, 0.14 * s, 0.12 * s, 0.09 * s, 0.09 * s], [0, 0.12 * s, 0.22 * s, 0.05 * s, 0.05 * s, 0.05 * s]], { seg: 16, sub: 4, paint: shade(back, belly, 0.2) });
	const nk = tube([[0, 0.14 * s, 0.18 * s, 0.045 * s], [0, (goose ? 0.4 : 0.26) * s, (goose ? 0.24 : 0.22) * s, 0.035 * s], [0, (goose ? 0.46 : 0.3) * s, (goose ? 0.28 : 0.25) * s, 0.04 * s]], { paint: () => neckC });
	const hd = loft([[0, (goose ? 0.46 : 0.3) * s, (goose ? 0.24 : 0.21) * s, 0.04 * s, 0.045 * s, 0.035 * s], [0, (goose ? 0.47 : 0.31) * s, (goose ? 0.3 : 0.27) * s, 0.035 * s, 0.035 * s, 0.03 * s], [0, (goose ? 0.45 : 0.29) * s, (goose ? 0.36 : 0.33) * s, 0.02 * s, 0.01 * s, 0.01 * s], [0, (goose ? 0.44 : 0.285) * s, (goose ? 0.38 : 0.35) * s, 0.003, 0.003, 0.003]], { seg: 12, sub: 3, paint: (t) => (t > 0.55 ? bill : neckC) });
	const parts = [body, nk, hd];
	if (goose) { const cheek = new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.4, 0.6).translate(0.035, 0.44, 0.34); const n = cheek.attributes.position.count; cheek.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0.9), 3)); parts.push(cheek, cheek.clone().translate(-0.07, 0, 0)); }
	return done(parts);
}
