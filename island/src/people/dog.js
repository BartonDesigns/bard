// A dog: one skinned mesh sculpted like world/creatures.js's animals (lofted body, tube legs)
// over a skeleton of its own: spine in two (hips and chest), neck, head, a jaw that opens
// to pant and bark, two ears, a tail in three, four legs of three bones each. It walks,
// trots and gallops on a real four-legged gait (each leg's foot placed by its own phase
// and the joints solved to reach it: elbows behind, knees forward), sits, lies down, rears
// up at the person it loves and spins on the spot.
// How it feels shows in all of it: lost, the head low, ears back and the tail tucked, a
// slow walk and looking about; alert, the ears up; following, easy and loose; home again,
// ears soft, the tail a blur, bounding and jumping up. What it says (whimpers, yips, a
// bark, panting) goes out through onSound (dog-voice.js plays it).
// Breeds by seed: a lab, a shepherd, a terrier, a small fluffy one; coats by breed.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loft } from '../world/creatures.js';
import { patchKit, vnoise, FAB } from './propkit.js';
import { smoothstep as sstep, clamp } from '../noise.js';

const V = THREE.Vector3;
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// shoulder height h (m); proportions against it: legs L, body length B, girth G, head H,
// muzzle M, how far the back slopes, fluff
export const BREEDS = Object.freeze([
	{ id: 'lab', name: 'Labrador', h: 0.57, L: 1, B: 1, G: 1.06, H: 1, M: 1, N: 1, slope: 0, fluff: 0, ear: 'drop', tail: 'otter', coats: [['#d6b072', '#ecd3a4', '#c49a5c'], ['#28221f', '#3a332e', '#1d1917'], ['#5a3a28', '#6e4a34', '#4a2f20']], names: ['Bella', 'Sadie', 'Daisy', 'Buddy', 'Max', 'Cooper'] },
	{ id: 'shepherd', name: 'Shepherd', h: 0.62, L: 1.04, B: 1.1, G: 0.94, H: 0.98, M: 1.25, N: 1.1, slope: 0.07, fluff: 0.3, ear: 'prick', tail: 'brush', coats: [['#b4803f', '#d0a465', '#211c19']], names: ['Luna', 'Rex', 'Nova', 'Kaiser', 'Juno'] },
	{ id: 'terrier', name: 'Terrier', h: 0.38, L: 0.9, B: 0.98, G: 0.96, H: 1.1, M: 0.85, N: 0.85, slope: 0, fluff: 0.15, ear: 'fold', tail: 'up', coats: [['#ebe6dc', '#b57941', '#2b2622']], names: ['Pip', 'Ruby', 'Scout', 'Milo', 'Tilly'] },
	{ id: 'fluffy', name: 'Small fluffy dog', h: 0.27, L: 0.62, B: 0.95, G: 1.18, H: 1.35, M: 0.45, N: 0.6, slope: 0, fluff: 1, ear: 'drop', tail: 'plume', coats: [['#f0e4cc', '#d6a46b', '#efe9df'], ['#f6f3ee', '#e8dcc8', '#f6f3ee']], names: ['Coco', 'Teddy', 'Mochi', 'Lulu', 'Biscuit'] },
]);

// the shape in shoulder heights (the withers at 1 on average legs), facing +z: the torso as
// [z, topline, underline, half width] from the buttock to the chest, the head, the joints
function rig(b) {
	const { L, B, G, H, M } = b, lift = (L - 1) * 0.5, el = 0.5 * L;
	const T = [[-0.64, 0.9, 0.73, 0.06], [-0.57, 0.965, 0.62, 0.15], [-0.42, 0.98, 0.6, 0.17], [-0.22, 0.985, 0.64, 0.155], [0, 0.99, 0.55, 0.185], [0.2, 1, 0.5, 0.2], [0.36, 0.99, 0.5, 0.19], [0.5, 0.9, 0.55, 0.15], [0.57, 0.83, 0.62, 0.07]]
		.map(([z, t, u, w]) => { const s = b.slope * Math.max(0, -z) / 0.6; return [z * B, t + lift - s, u + lift + (u - 0.5) * (L - 1) * 0.3, w * G]; });
	const hy = 0.86 + lift + 0.26 * b.N, hz = (0.56 + 0.1 * b.N) * B;
	const P = {
		T, hy, hz, lift, el, withers: 1 + lift,
		bones: [
			['root', -1, 0, 0, 0],
			['pelvis', 0, 0, 0.8 + lift, -0.3 * B],
			['chest', 1, 0, 0.78 + lift, 0.2 * B],
			['neck', 2, 0, 0.86 + lift, 0.46 * B],
			['head', 3, 0, hy, hz - 0.02],
			['jaw', 4, 0, hy - 0.075, hz + 0.1],
			['earL', 4, 0.075 * H, hy + 0.06 * H, hz], ['earR', 4, -0.075 * H, hy + 0.06 * H, hz],
		],
	};
	P.tail = tailLine(b, P);
	P.bones.push(['tail1', 1, ...P.tail[0].slice(0, 3)], ['tail2', 8, ...P.tail[1].slice(0, 3)], ['tail3', 9, ...P.tail[2].slice(0, 3)]);
	// the legs: [joint, elbow or stifle, wrist or hock, toe]
	P.legs = [];
	for (const s of [1, -1]) {
		const x = s * 0.105 * G;
		P.legs.push({ front: true, side: s, pts: [[x, el + 0.24, 0.36 * B], [x, el, 0.27 * B], [x * 0.95, 0.12 * L, 0.3 * B], [x * 0.95, 0.025, 0.34 * B]] });
		P.legs.push({ front: false, side: s, pts: [[x * 0.9, el + 0.29, -0.43 * B], [x * 0.95, el + 0.02, -0.31 * B], [x * 0.9, 0.22 * L, -0.56 * B], [x * 0.9, 0.025, -0.51 * B]] });
	}
	for (const g of P.legs) {
		const n = (g.front ? 'f' : 'h') + (g.side > 0 ? 'L' : 'R'), base = P.bones.length;
		P.bones.push([n + '1', g.front ? 2 : 1, ...g.pts[0]], [n + '2', base, ...g.pts[1]], [n + '3', base + 1, ...g.pts[2]]);
		g.bones = [base, base + 1, base + 2];
	}
	P.M = M; P.H = H;
	return P;
}
function tailLine(b, P) {
	const z = -0.6 * b.B, y = 0.9 + P.lift - b.slope * 0.9;
	if (b.tail === 'up') return [[0, y, z, 0.04], [0, y + 0.1, z - 0.04, 0.032], [0, y + 0.2, z - 0.05, 0.024], [0, y + 0.27, z - 0.03, 0.012]];
	if (b.tail === 'plume') return [[0, y, z, 0.05], [0, y + 0.13, z - 0.04, 0.07], [0, y + 0.22, z + 0.08, 0.07], [0, y + 0.18, z + 0.22, 0.04]];
	if (b.tail === 'brush') return [[0, y - 0.02, z, 0.05], [0, y - 0.13, z - 0.12, 0.06], [0, y - 0.3, z - 0.2, 0.055], [0, y - 0.48, z - 0.2, 0.02]];
	return [[0, y, z, 0.055], [0, y - 0.05, z - 0.16, 0.045], [0, y - 0.15, z - 0.3, 0.032], [0, y - 0.28, z - 0.38, 0.014]];
}

// ---------- the body ----------
// each part's vertices bound to one or two bones (w: (p) => [[bone, weight], ...])
function bind(g, w, gloss = 0, fab = FAB.fur) {
	// (facing out: a closed shape wound the other way has a negative volume)
	if (g.index) {
		const I = g.index.array, pa0 = g.attributes.position, A = new V(), Bv = new V(), Cv = new V();
		let vol = 0;
		for (let i = 0; i < I.length; i += 3) { A.fromBufferAttribute(pa0, I[i]); Bv.fromBufferAttribute(pa0, I[i + 1]); Cv.fromBufferAttribute(pa0, I[i + 2]); vol += A.dot(Bv.cross(Cv)); }
		if (vol < 0) { for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } g.computeVertexNormals(); }
	}
	const pa = g.attributes.position, n = pa.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), kit = new Float32Array(n * 3), p = new V();
	for (let i = 0; i < n; i++) {
		p.fromBufferAttribute(pa, i);
		const ws = w(p);
		let tot = 0; for (const q of ws) tot += q[1];
		ws.slice(0, 4).forEach(([b, k], j) => { si[i * 4 + j] = b; sw[i * 4 + j] = k / (tot || 1); });
		kit[i * 3] = gloss; kit[i * 3 + 1] = fab;
	}
	g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
	g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
	g.setAttribute('kit', new THREE.BufferAttribute(kit, 3));
	for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight', 'kit'].includes(k)) g.deleteAttribute(k);
	if (!g.index) g.setIndex([...Array(n).keys()]);
	return g;
}
// the chain a point is nearest: bone weights blended across each joint
function chainWeights(pts, bones, soft = 0.035) {
	const A = pts.map((q) => new V(...q.slice(0, 3))), ab = new V(), d = new V();
	return (p) => {
		let best = 0, bt = 0, bd = Infinity;
		for (let i = 0; i < A.length - 1; i++) {
			ab.subVectors(A[i + 1], A[i]); const L2 = ab.lengthSq(), t = clamp(d.subVectors(p, A[i]).dot(ab) / L2, 0, 1);
			const dist = d.subVectors(p, A[i]).addScaledVector(ab, -t).length();
			if (dist < bd - 1e-6) { bd = dist; best = i; bt = t; }
		}
		const len = A[best].distanceTo(A[best + 1]), from = bt * len, to = (1 - bt) * len;
		const out = [[bones[best], 1]];
		if (best > 0 && from < soft) { out[0][1] = 0.5 + 0.5 * from / soft; out.push([bones[best - 1], 1 - out[0][1]]); }
		else if (best < bones.length - 1 && to < soft) { out[0][1] = 0.5 + 0.5 * to / soft; out.push([bones[best + 1], 1 - out[0][1]]); }
		return out;
	};
}
// fur pushed out a little in tufts (more on a fluffy one)
function fluffUp(g, amt, seed) {
	if (amt <= 0) return g;
	const pa = g.attributes.position, na = g.attributes.normal;
	for (let i = 0; i < pa.count; i++) {
		const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = amt * (0.012 + 0.02 * vnoise(x * 40 + seed, y * 40, z * 40));
		pa.setXYZ(i, x + na.getX(i) * k, y + na.getY(i) * k, z + na.getZ(i) * k);
	}
	g.computeVertexNormals();
	return g;
}

// a loft closed at both ends by rounding them off (the caps of a plain loft can face in)
function shut(keys) {
	const end = (a, b) => {
		const d = new V(a[0] - b[0], a[1] - b[1], a[2] - b[2]).normalize(), r = Math.max(a[3], a[4], a[5]);
		return [[...new V(...a.slice(0, 3)).addScaledVector(d, r * 0.55).toArray(), a[3] * 0.75, a[4] * 0.75, a[5] * 0.75], [...new V(...a.slice(0, 3)).addScaledVector(d, r * 0.9).toArray(), 0.002, 0.002, 0.002]];
	};
	const [s0, s1] = end(keys[0], keys[1]), [e0, e1] = end(keys[keys.length - 1], keys[keys.length - 2]);
	return [s1, s0, ...keys, e0, e1];
}
const sloft = (keys, opt) => loft(shut(keys), { ...opt, caps: false });
const stube = (pts, opt) => sloft(pts.map(([x, y, z, r]) => [x, y, z, r, r, r]), { seg: 12, sub: 4, ...opt });

const made = new Map();
function dogGeometry(b, coatI, P, lod) {
	const key = `${b.id}:${coatI}:${lod}`;
	if (made.has(key)) return made.get(key);
	const { T, hy, hz, M, H, lift } = P, { B, G } = b, idx = Object.fromEntries(P.bones.map((q, i) => [q[0], i]));
	const coat = b.coats[coatI % b.coats.length].map(lin), [main, light, dark] = coat;
	const seg = lod ? 10 : 14, sub = lod ? 2 : 3, parts = [];
	const nose = lin('#121012'), eye = lin('#2a1a10'), tongue = lin('#cf5f72'), gum = lin('#3a2224');
	// how each breed's coat falls: by part and place
	const paint = (part) => (s, up, p) => {
		const n = vnoise(p.x * 18, p.y * 18, p.z * 18);
		let c = main;
		if (b.id === 'shepherd') {
			// the black saddle and the black mask on tan
			if ((part === 'body' && up > 0.05 && p.z > -0.5 * B && p.z < 0.32 * B) || (part === 'tail' && up > -0.2) || part === 'muzzle' || (part === 'ear' && n > 0.2)) c = dark;
			else if (part === 'leg' && p.y < 0.35) c = light;
		} else if (b.id === 'terrier') {
			if (part === 'ear' || (part === 'head' && (p.x > 0.02 || n > 0.65) && up > -0.3) || (part === 'body' && up > 0.3 && n > 0.62 && p.z < 0)) c = light;
		} else if (b.id === 'fluffy') {
			if (part === 'ear') c = light;
		} else if (part === 'ear') c = dark;
		// lighter underneath, a little mottle of the hair
		if ((part === 'body' || part === 'neck') && up < -0.3 && b.id !== 'shepherd') c = mixc(c, light, 0.45);
		return c.map((v) => v * (0.92 + 0.12 * n));
	};
	// the body: between its topline and underline, rump to chest
	const body = sloft(T.map(([z, t, u, w]) => [0, (t + u) / 2, z, w, (t - u) / 2, (t - u) / 2]), { seg: seg + 4, sub, paint: paint('body') });
	parts.push(bind(fluffUp(body, b.fluff, 1), (p) => { const k = sstep(-0.3 * B, 0.15 * B, p.z); return [[idx.pelvis, 1 - k], [idx.chest, k]]; }));
	// the neck: from deep in the chest, up and forward to the back of the skull
	const neckPts = [[0, 0.84 + lift, 0.33 * B, 0.15 * G], [0, (0.84 + lift + hy) / 2, (0.46 * B + hz) / 2, 0.15 * G], [0, hy - 0.01, hz - 0.05, 0.1 * H]];
	const nw = chainWeights([[0, 0.8 + lift, 0.38 * B], [0, 0.86 + lift, 0.46 * B], [0, hy, hz - 0.02], [0, hy, hz + 0.3]], [idx.chest, idx.neck, idx.head], 0.07);
	parts.push(bind(fluffUp(stube(neckPts, { seg, sub, paint: paint('neck') }), b.fluff * 1.3, 2), nw));
	// the head: the back of the skull, its dome, the stop, the muzzle to the nose
	const tip = hz + 0.13 + 0.17 * M;
	const hd = sloft([[0, hy, hz - 0.09, 0.06 * H, 0.06 * H, 0.06 * H], [0, hy + 0.03, hz - 0.02, 0.1 * H, 0.09 * H, 0.085 * H], [0, hy + 0.02, hz + 0.06, 0.095 * H, 0.085 * H, 0.085 * H], [0, hy - 0.025, hz + 0.13, 0.066, 0.05, 0.06], [0, hy - 0.045, hz + 0.13 + 0.09 * M, 0.056, 0.045, 0.05], [0, hy - 0.05, tip, 0.04, 0.035, 0.04]], { seg, sub, paint: (s, up, p) => paint(p.z > hz + 0.11 ? 'muzzle' : 'head')(s, up, p) });
	parts.push(bind(fluffUp(hd, b.fluff * 0.8, 3), () => [[idx.head, 1]]));
	parts.push(bind(new THREE.SphereGeometry(0.03, 10, 8).scale(1.15, 0.85, 0.9).translate(0, hy - 0.035, tip + 0.006), () => [[idx.head, 1]], 0.9, 0));
	for (const s of [1, -1]) parts.push(bind(new THREE.SphereGeometry(0.018, 10, 8).translate(s * 0.068 * H, hy + 0.03, hz + 0.09), () => [[idx.head, 1]], 1, 0));
	// (colours for the small parts: nose, eyes)
	const tintPart = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
	tintPart(parts[parts.length - 3], nose); tintPart(parts[parts.length - 2], eye); tintPart(parts[parts.length - 1], eye);
	// the lower jaw and the tongue on it
	const jaw = sloft([[0, hy - 0.08, hz + 0.07, 0.045, 0.012, 0.022], [0, hy - 0.085, hz + 0.13 + 0.07 * M, 0.04, 0.012, 0.02], [0, hy - 0.082, hz + 0.13 + 0.15 * M, 0.03, 0.01, 0.015]], { seg: 10, sub: 3, paint: () => mixc(paint('muzzle')(0, 0, new V()), gum, 0.15) });
	parts.push(bind(jaw, () => [[idx.jaw, 1]]));
	const tg = sloft([[0, hy - 0.07, hz + 0.1, 0.022, 0.005, 0.005], [0, hy - 0.071, hz + 0.13 + 0.08 * M, 0.027, 0.005, 0.005], [0, hy - 0.074, hz + 0.13 + 0.145 * M, 0.02, 0.004, 0.004]], { seg: 8, sub: 3, paint: () => tongue });
	parts.push(bind(tg, () => [[idx.jaw, 1]], 0.7, 0));
	// the ears
	for (const [s, bi] of [[1, idx.earL], [-1, idx.earR]]) {
		const x = s * 0.075 * H, y = hy + 0.06 * H, z = hz;
		let ear;
		if (b.ear === 'prick') ear = sloft([[x, y - 0.01, z, 0.045, 0.014, 0.014], [x + s * 0.015, y + 0.07, z - 0.01, 0.034, 0.011, 0.011], [x + s * 0.025, y + 0.14, z - 0.015, 0.006, 0.004, 0.004]], { seg: 8, sub: 3, paint: paint('ear') });
		else if (b.ear === 'fold') ear = sloft([[x, y - 0.01, z, 0.028, 0.008, 0.008], [x + s * 0.012, y + 0.03, z + 0.005, 0.03, 0.008, 0.008], [x + s * 0.018, y + 0.035, z + 0.04, 0.022, 0.006, 0.006], [x + s * 0.022, y + 0.005, z + 0.056, 0.009, 0.004, 0.004]], { seg: 8, sub: 3, paint: paint('ear') });
		else { const big = b.fluff > 0.5 ? 1.3 : 1; ear = sloft([[x, y, z, 0.014 * big, 0.045 * big, 0.045 * big], [x + s * 0.02, y - 0.06 * big, z + 0.015, 0.013 * big, 0.055 * big, 0.05 * big], [x + s * 0.028, y - 0.14 * big, z + 0.02, 0.011 * big, 0.04 * big, 0.035 * big], [x + s * 0.026, y - 0.17 * big, z + 0.02, 0.004, 0.012, 0.012]], { seg: 8, sub: 3, paint: paint('ear') }); }
		parts.push(bind(fluffUp(ear, b.fluff * 0.6, 4 + s), (p) => { const k = Math.hypot(p.x - x, p.y - y) < 0.016 ? 0.5 : 1; return [[bi, k], [idx.head, 1 - k]]; }));
	}
	// the tail
	parts.push(bind(fluffUp(stube(P.tail, { seg: 8, sub: 4, paint: paint('tail') }), b.fluff * 1.6, 7), chainWeights(P.tail, [idx.tail1, idx.tail2, idx.tail3], 0.04)));
	// the legs: one tube each down through the joints, a paw at the foot
	for (const g of P.legs) {
		const [j, e, w, t] = g.pts, thick = g.front ? [0.07, 0.06, 0.046, 0.042] : [0.08, 0.066, 0.044, 0.04];
		const mid = g.front ? [j[0], (j[1] + e[1]) / 2, (j[2] + e[2]) / 2 + 0.02] : [j[0], (j[1] + e[1]) / 2 + 0.01, (j[2] + e[2]) / 2 - 0.01];
		const pts = [[j[0] * 0.9, j[1] + 0.02, j[2], thick[0] * G], [...mid, thick[0] * 0.95 * G], [...e, thick[1] * G], [...w, thick[2] * (1 + b.fluff * 0.3)], [...t, thick[3] * (1 + b.fluff * 0.3)]];
		const leg = stube(pts, { seg, sub: 3, paint: paint('leg') });
		parts.push(bind(fluffUp(leg, b.fluff * 0.8, 9), (p) => {
			// the top of the leg melts into the body
			const ws = chainWeights([[j[0], j[1] + 0.02, j[2]], e, w, t], g.bones, 0.04)(p);
			if (p.y > j[1] - 0.02) { const k = sstep(j[1] - 0.02, j[1] + 0.06, p.y) * 0.6; for (const q of ws) q[1] *= 1 - k; ws.push([g.front ? idx.chest : idx.pelvis, k]); }
			return ws;
		}));
		const paw = new THREE.SphereGeometry(0.05 * (1 + b.fluff * 0.25), 10, 6).scale(0.95, 0.6, 1.25).translate(t[0], 0.024, t[2] + 0.025);
		const pc = paint('leg')(0, 0, new V(t[0], 0.02, t[2]));
		tintPart(paw, pc.map((v) => v * 0.95));
		parts.push(bind(paw, () => [[g.bones[2], 1]]));
	}
	for (const q of parts) { if (!q.attributes.normal) q.computeVertexNormals(); if (!q.attributes.color) tintPart(q, main); }
	const geo = mergeGeometries(parts);
	geo.computeBoundingSphere();
	made.set(key, geo);
	return geo;
}

// ---------- moods and poses ----------
// neck/head: + lowers; ears: + back; perk: + up/forward; tail: + up; wag: amplitude, Hz;
// jaw: open; crouch: body lowered (of shoulder height); rear: hips lower
const MOODS = {
	sad: { neck: 0.55, head: 0.2, ears: 1, perk: 0, tail: -1.5, wagA: 0.05, wagF: 1.1, jaw: 0, crouch: 0.06, rear: 0.05, wiggle: 0 },
	alert: { neck: -0.25, head: -0.05, ears: -0.25, perk: 1, tail: 0.15, wagA: 0.1, wagF: 2.2, jaw: 0, crouch: 0, rear: 0, wiggle: 0 },
	calm: { neck: 0.08, head: 0, ears: 0.15, perk: 0.35, tail: -0.15, wagA: 0.3, wagF: 2.6, jaw: 0.16, crouch: 0, rear: 0, wiggle: 0 },
	happy: { neck: -0.18, head: -0.05, ears: 0.5, perk: 0.2, tail: 1.1, wagA: 0.8, wagF: 7.5, jaw: 0.3, crouch: 0, rear: 0, wiggle: 1 },
};
const POSES = ['stand', 'sit', 'lie', 'jump', 'bow'];

// who a dog of this seed is, without making it: breed, coat, name, she or he, and how its
// person would describe it
const LOOKS = { lab: ['a yellow lab', 'a black lab', 'a chocolate lab'], shepherd: ['a big shepherd, tan and black'], terrier: ['a little white terrier with brown ears'], fluffy: ['a small fluffy cream dog', 'a small fluffy white dog'] };
export function dogSpec(seed, breed = null) {
	const s = Math.abs(seed | 0), b = BREEDS.find((q) => q.id === breed) || BREEDS[s % BREEDS.length], coatI = Math.abs((seed * 7) | 0) % b.coats.length;
	return { seed, breed: b.id, coatI, name: b.names[s % b.names.length], she: s % 2 === 0, look: LOOKS[b.id][coatI % LOOKS[b.id].length], size: b.h };
}

export function createDog({ seed = 1, breed = null, isPhone = false } = {}) {
	const b = BREEDS.find((q) => q.id === breed) || BREEDS[Math.abs(seed | 0) % BREEDS.length];
	const P = rig(b), { coatI, name, she } = dogSpec(seed, b.id);
	const geo = dogGeometry(b, coatI, P, isPhone ? 1 : 0);
	const mat = patchKit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
	const root = new THREE.Group(), bones = P.bones.map((q) => { const o = new THREE.Bone(); o.name = q[0]; return o; });
	P.bones.forEach((q, i) => { bones[i].position.set(q[2], q[3], q[4]); if (q[1] >= 0) { bones[i].position.sub(new V(P.bones[q[1]][2], P.bones[q[1]][3], P.bones[q[1]][4])); bones[q[1]].add(bones[i]); } else root.add(bones[i]); });
	root.updateMatrixWorld(true);
	const skeleton = new THREE.Skeleton(bones), mesh = new THREE.SkinnedMesh(geo, mat);
	mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
	root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
	const B = Object.fromEntries(P.bones.map((q, i) => [q[0], bones[i]])), rest = P.bones.map((q) => new V(q[2], q[3], q[4]));
	// the size of it: the withers at the breed's height
	const withers = P.withers, S = b.h / withers;
	root.scale.setScalar(S);

	// the legs: rest angles (a: + pointing back), lengths, a phase offset
	const ang = (a, c) => Math.atan2(-(c[2] - a[2]), -(c[1] - a[1]));
	const legs = P.legs.map((g) => {
		const [j, e, w, t] = g.pts;
		return { ...g, a0: [ang(j, e), ang(e, w), ang(w, t)], len: [Math.hypot(e[1] - j[1], e[2] - j[2]), Math.hypot(w[1] - e[1], w[2] - e[2]), Math.hypot(t[1] - w[1], t[2] - w[2])], toe: [t[1], t[2]], foot: { y: 0, z: t[2] } };
	});
	// gait phase offsets: walk (lateral sequence), trot (diagonals), gallop (rotary)
	const OFF = { walk: { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 }, trot: { fL: 0, hR: 0, fR: 0.5, hL: 0.5 }, gallop: { hL: 0, hR: 0.1, fL: 0.45, fR: 0.57 } };
	const key = (g) => (g.front ? 'f' : 'h') + (g.side > 0 ? 'L' : 'R');

	// the state: where, which way, how fast; how it feels and stands
	const st = { x: 0, y: 0, z: 0, h: 0, speed: 0, want: { speed: 0, heading: 0, turn: 2.5 }, phase: 0, mood: 'calm', pose: 'stand', look: 0, lookT: 0, t: 0, gait: 'walk', barkT: 0, shied: false };
	const cur = { ...MOODS.calm, pose: { stand: 1, sit: 0, lie: 0, jump: 0, bow: 0 }, look: 0, gaitW: 0 };
	const want = { ...MOODS.calm };
	let onSound = null;
	const say = (k) => onSound?.(k, { x: st.x, y: st.y + b.h * 0.8, z: st.z, size: b.h });

	function place(x, y, z, heading) { st.x = x; st.y = y; st.z = z; st.h = st.want.heading = heading; st.speed = 0; root.position.set(x, y, z); root.rotation.set(0, heading, 0); }
	function setMood(m) { st.mood = m; Object.assign(want, MOODS[m]); }
	function setPose(p) { st.pose = POSES.includes(p) ? p : 'stand'; }

	// ---------- solving the legs ----------
	const rx = (y, z, a) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
	// foot: where the toe goes (the dog's frame); rel: { w, dy, dz } a place relative to the
	// joint in the body's own frame to go to instead (rearing up); pa: the paw's angle, if set
	function solveLeg(g, foot, swingK, pitchP, pitchC, bodyY, rel = null, pa0 = null) {
		// the joint where the body has carried it (in the dog's own frame, its scale)
		const pr = rest[1], cr = rest[2], jr = g.pts[0];
		const py = pr.y + bodyY, pz = pr.z;
		let jy, jz, parentA;
		if (g.front) {
			const [cy, cz] = rx(cr.y - pr.y, cr.z - pr.z, pitchP), [oy, oz] = rx(jr[1] - cr.y, jr[2] - cr.z, pitchP + pitchC);
			jy = py + cy + oy; jz = pz + cz + oz; parentA = pitchP + pitchC;
		} else { const [oy, oz] = rx(jr[1] - pr.y, jr[2] - pr.z, pitchP); jy = py + oy; jz = pz + oz; parentA = pitchP; }
		if (rel && rel.w > 0.001) { const [oy, oz] = rx(rel.dy, rel.dz, parentA); foot = { y: foot.y + (jy + oy - foot.y) * rel.w, z: foot.z + (jz + oz - foot.z) * rel.w }; }
		// the wrist (or hock) above the toe, the paw flexed back in the swing
		const [a, bb, c] = g.len, pa = pa0 ?? g.a0[2] + (g.front ? -1.3 : -0.4) * swingK;
		const wy = foot.y + c * Math.cos(pa), wz = foot.z + c * Math.sin(pa);
		let dy = wy - jy, dz = wz - jz, d = Math.hypot(dy, dz);
		d = clamp(d, Math.abs(a - bb) + 0.01, a + bb - 0.002);
		const line = Math.atan2(-dz, -dy), A = Math.acos(clamp((a * a + d * d - bb * bb) / (2 * a * d), -1, 1));
		const au = g.front ? line + A : line - A;
		const ey = jy - a * Math.cos(au), ez = jz - a * Math.sin(au);
		const al = Math.atan2(-(wz - ez), -(wy - ey)), ap = Math.atan2(-(foot.z - wz), -(foot.y - wy));
		const [u, l, p] = g.bones.map((i) => bones[i]);
		u.rotation.x = au - g.a0[0] - parentA;
		l.rotation.x = al - g.a0[1] - (au - g.a0[0]);
		p.rotation.x = ap - g.a0[2] - (al - g.a0[1]);
	}

	// ---------- each frame: the gait and the feelings into the bones ----------
	function animate(dt) {
		st.t += dt;
		const k = 1 - Math.exp(-dt * 5), kp = 1 - Math.exp(-dt * 3.5);
		for (const n of Object.keys(want)) cur[n] += (want[n] - cur[n]) * k;
		for (const p of POSES) cur.pose[p] += ((st.pose === p ? 1 : 0) - cur.pose[p]) * kp;
		// the gait for the speed, in shoulder heights a second
		const v = st.speed / b.h, gait = v < 2.4 ? 'walk' : v < 5 ? 'trot' : 'gallop';
		if (gait !== st.gait) st.gait = gait;
		// (how far the body goes in one cycle; the feet sweep back that far while down)
		const travel = (gait === 'walk' ? 1 : gait === 'trot' ? 1.7 : 2.6) * (0.8 + 0.2 * b.L), duty = gait === 'walk' ? 0.62 : gait === 'trot' ? 0.5 : 0.36;
		const moving = sstep(0.05, 0.3, st.speed);
		st.phase = (st.phase + (st.speed / S / travel) * dt) % 1;
		cur.gaitW += (moving - cur.gaitW) * (1 - Math.exp(-dt * 6));
		const gw = cur.gaitW, ph = st.phase, two = Math.sin(ph * Math.PI * 4);
		// the body: bob with the steps, the spine flexing at the gallop
		const gal = gait === 'gallop' ? gw : 0;
		let bodyY = -cur.crouch * withers + gw * (gait === 'walk' ? 0.012 : 0.022) * two + gal * 0.05 * Math.sin(ph * Math.PI * 2);
		let pitchP = cur.rear + gal * 0.14 * Math.sin(ph * Math.PI * 2 + 0.6), pitchC = -gal * 0.22 * Math.sin(ph * Math.PI * 2 + 0.6);
		// poses over it: sitting, lying, rearing up, the play bow
		const W = cur.pose;
		const hop = W.jump * (0.5 + 0.5 * Math.sin(st.t * 9.5));
		bodyY += W.sit * -0.36 + W.lie * -0.5 + W.jump * (0.06 + 0.1 * hop) + W.bow * -0.12;
		pitchP += W.sit * -0.62 + W.lie * 0.0 + W.jump * (-0.75 - 0.3 * hop) + W.bow * 0.32;
		pitchC += W.sit * 0.08 + W.bow * 0.05 + W.jump * 0.15;
		const p = bones[1], c = bones[2];
		p.position.y = rest[1].y + bodyY;
		p.rotation.x = pitchP; c.rotation.x = pitchC;
		// the happy wiggle: hips swaying with the tail
		const wagP = st.t * cur.wagF * Math.PI * 2, wag = Math.sin(wagP);
		p.rotation.y = cur.wiggle * 0.12 * wag * (1 - W.sit - W.lie); c.rotation.y = -p.rotation.y * 0.6;
		p.rotation.z = gw * (gait === 'walk' ? 0.03 : 0.02) * Math.sin(ph * Math.PI * 2);
		// the legs
		const off = OFF[gait];
		for (const g of legs) {
			const kk = key(g), ps = (ph + off[kk]) % 1;
			let fy = 0, fz = g.toe[1], sw = 0;
			if (gw > 0.001) {
				const len = travel * duty * Math.min(1, 0.4 + v * 0.3);
				if (ps < duty) fz += len * (0.5 - ps / duty);
				else { const u = (ps - duty) / (1 - duty), e2 = u * u * (3 - 2 * u); fz += len * (-0.5 + e2); fy = (gait === 'gallop' ? 0.16 : 0.1) * Math.sin(u * Math.PI); sw = Math.sin(u * Math.PI); }
				fz = g.toe[1] + (fz - g.toe[1]) * gw; fy *= gw; sw *= gw;
			}
			// pose targets for the feet
			// (sitting, the hocks down on the ground; lying, the forelegs out in front)
			const down = g.front ? W.lie : W.sit + W.lie, pawA = down > 0.01 ? g.a0[2] + (-1.5 - g.a0[2]) * Math.min(1, down) : null;
			if (g.front) fz += W.lie * 0.34 + W.bow * 0.3;
			else { fz += W.sit * 0.22 + W.lie * 0.3; fy += W.lie * 0.02; }
			// rearing up: the forepaws held up in front of the chest, curled
			const rel = g.front && W.jump > 0.01 ? { w: Math.min(1, W.jump), dy: -0.38 + 0.08 * hop, dz: 0.24 } : null;
			solveLeg(g, { y: fy, z: fz }, clamp(sw + (rel ? W.jump * 0.7 : 0), 0, 1), pitchP, pitchC, bodyY, rel, pawA);
		}
		// the head: low or high by mood, looking about, nodding with the steps
		st.lookT -= dt;
		if (st.lookT <= 0) { st.lookT = 1.5 + Math.random() * 3; st.look = st.mood === 'sad' ? (Math.random() - 0.5) * 1.4 : st.mood === 'alert' ? st.look : (Math.random() - 0.5) * 0.5; }
		cur.look += (st.look - cur.look) * (1 - Math.exp(-dt * 2.5));
		const nb = gw * 0.04 * two;
		B.neck.rotation.x = cur.neck - pitchP - pitchC * 0.5 + nb + W.lie * 0.15 - W.jump * 0.3;
		B.neck.rotation.y = clamp(cur.look, -0.9, 0.9);
		B.head.rotation.x = cur.head + W.jump * 0.25 - W.sit * 0.25;
		B.head.rotation.z = st.mood === 'happy' ? 0.08 * Math.sin(st.t * 2.1) : st.mood === 'alert' ? 0.12 * Math.sin(st.t * 0.7) : 0;
		// the mouth: panting while it runs or is happy, closed when worried
		const pant = cur.jaw + (st.mood === 'sad' ? 0 : gw * 0.12) + (st.barkT > 0 ? 0.35 : 0);
		st.barkT = Math.max(0, st.barkT - dt);
		B.jaw.rotation.x = Math.max(0, pant * (0.85 + 0.15 * Math.sin(st.t * 18)));
		// the ears: back and flat when worried, up and forward when alert
		for (const [e, s] of [[B.earL, 1], [B.earR, -1]]) {
			if (b.ear === 'prick') { e.rotation.x = -cur.ears * 0.9 + cur.perk * 0.15; e.rotation.z = s * cur.ears * 0.35; }
			else if (b.ear === 'fold') { e.rotation.x = cur.ears * 0.5 - cur.perk * 0.25; e.rotation.z = -s * cur.perk * 0.2; }
			else { e.rotation.x = cur.ears * 0.55 - cur.perk * 0.1; e.rotation.z = s * (cur.perk * 0.35 - cur.ears * 0.1); }
			e.rotation.y = s * cur.ears * 0.25;
		}
		// the tail: tucked, level or high; the wag in it, more at the tip; it sweeps the ground when sitting
		const tailUp = cur.tail * (cur.tail > 0 && (b.tail === 'plume' || b.tail === 'up') ? 0.5 : 1.15) - W.sit * 0.5 - W.lie * 0.3;
		B.tail1.rotation.x = tailUp * 0.9; B.tail2.rotation.x = tailUp * 0.3; B.tail3.rotation.x = tailUp * 0.15 + gw * 0.08 * two;
		B.tail1.rotation.y = cur.wagA * 0.7 * wag; B.tail2.rotation.y = cur.wagA * 0.5 * Math.sin(wagP - 0.6); B.tail3.rotation.y = cur.wagA * 0.4 * Math.sin(wagP - 1.2);
		root.position.set(st.x, st.y, st.z); root.rotation.set(0, st.h, 0);
	}

	// ---------- getting about ----------
	// toward the wanted heading and speed, turning at a rate; never onto water or off the land
	function move(dt, ground) {
		const dh = wrap(st.want.heading - st.h), turn = st.want.turn * dt;
		st.h += clamp(dh, -turn, turn);
		const target = st.want.speed * (Math.abs(dh) > 1.6 ? 0.3 : 1);
		st.speed += (target - st.speed) * (1 - Math.exp(-dt * (target > st.speed ? 3 : 6)));
		if (st.speed < 0.01) return true;
		const fx = Math.sin(st.h), fz = Math.cos(st.h), step = st.speed * dt;
		const ahead = ground ? ground(st.x + fx * Math.max(0.8, b.h * 2), st.z + fz * Math.max(0.8, b.h * 2)) : 0;
		if (ahead === null || ahead === undefined) { st.speed = 0; return false; }
		st.x += fx * step; st.z += fz * step;
		const y = ground ? ground(st.x, st.z) : 0;
		if (Number.isFinite(y)) st.y += (y - st.y) * Math.min(1, dt * 10);
		return true;
	}
	const toward = (x, z) => Math.atan2(x - st.x, z - st.z);
	const dist = (x, z) => Math.hypot(x - st.x, z - st.z);
	const pace = (k) => k * Math.sqrt(b.h / 0.57);

	// lost: wandering slowly about a spot, stopping to look round, sitting sadly, whimpering
	const L = { t: 0, phase: 'walk', next: 3, whimper: 2 };
	function lost(dt, ctx, home) {
		setMood('sad');
		L.t += dt; L.whimper -= dt;
		if (L.whimper <= 0) { L.whimper = 3.5 + Math.random() * 4.5; say('whimper'); }
		if (L.t > L.next) {
			L.t = 0;
			const r = Math.random();
			L.phase = r < 0.5 ? 'walk' : r < 0.85 ? 'stand' : 'sit';
			L.next = L.phase === 'walk' ? 3 + Math.random() * 4 : L.phase === 'stand' ? 2 + Math.random() * 2.5 : 4 + Math.random() * 3;
			st.want.heading = st.h + (Math.random() - 0.5) * 1.8;
			if (home && dist(home.x, home.z) > 9) st.want.heading = toward(home.x, home.z) + (Math.random() - 0.5) * 0.6;
		}
		setPose(L.phase === 'sit' ? 'sit' : 'stand');
		st.want.speed = L.phase === 'walk' ? pace(0.55) : 0; st.want.turn = 1.6;
		if (!move(dt, ctx.ground)) { st.want.heading = st.h + Math.PI * (0.6 + Math.random() * 0.8); L.phase = 'stand'; L.t = 0; L.next = 1; }
	}
	// someone near: it stops and watches them, ears up; too fast at it and it shies away
	function wary(dt, ctx, you, rushing) {
		const d = dist(you.x, you.z);
		if (rushing && d < 6) {
			setMood('sad'); setPose('stand');
			st.want.heading = toward(you.x, you.z) + Math.PI; st.want.speed = pace(2.2); st.want.turn = 5;
			if (!st.shied) { st.shied = true; say('whimper'); }
		} else {
			st.shied = false;
			setMood(d < 4.5 ? 'calm' : 'alert'); setPose('stand');
			st.want.heading = toward(you.x, you.z); st.want.speed = 0; st.want.turn = 3;
			st.look = 0;
		}
		move(dt, ctx.ground);
	}
	// following: a few metres behind, trotting to catch up, sitting when you stop
	const F = { still: 0, bark: 8 };
	function follow(dt, ctx, you, keep = 2.8) {
		setMood('calm');
		const d = dist(you.x, you.z);
		if (d > keep + 0.6) { st.want.heading = toward(you.x, you.z); st.want.speed = clamp((d - keep) * 1.4, 0.4, pace(d > 12 ? 5.5 : 3.2)); F.still = 0; }
		else if (d < keep - 0.8) { st.want.speed = 0; F.still += dt; }
		else { st.want.speed *= 0.9; F.still += dt; }
		st.want.turn = 3.5;
		setPose(F.still > 4 ? 'sit' : 'stand');
		if (!move(dt, ctx.ground)) F.still += dt;
		return d;
	}
	// home again: the dash to its person, jumping up at them, a spin or two, then sitting
	// close with the tail going
	const R = { phase: null, t: 0, yip: 0 };
	function reunite(owner, dt, ctx = {}) {
		setMood('happy');
		if (!R.phase) { R.phase = 'dash'; R.t = 0; say('bark'); st.barkT = 0.25; }
		R.t += dt; R.yip -= dt;
		const d = dist(owner.x, owner.z), reach = 0.45 + b.h * 0.9;
		if (R.phase === 'dash') {
			setPose('stand');
			st.want.heading = toward(owner.x, owner.z); st.want.speed = d > reach ? pace(d > 3 ? 6 : 2.5) : 0; st.want.turn = 7;
			move(dt, ctx.ground);
			if (d <= reach + 0.05 || R.t > 12) { R.phase = 'jump'; R.t = 0; }
		} else if (R.phase === 'jump') {
			setPose('jump'); st.want.speed = 0; st.want.heading = toward(owner.x, owner.z);
			move(dt, ctx.ground);
			if (R.yip <= 0) { R.yip = 0.45 + Math.random() * 0.25; say('yip'); st.barkT = 0.15; }
			if (R.t > 2.6) { R.phase = 'spin'; R.t = 0; say('yip'); }
		} else if (R.phase === 'spin') {
			setPose('stand'); st.h += dt * Math.PI * 2 / 0.7; st.want.heading = st.h; st.speed = 0;
			if (R.t > 1.4) { R.phase = 'settle'; R.t = 0; }
		} else {
			setPose(R.t > 1.2 ? 'sit' : 'stand'); st.want.heading = toward(owner.x, owner.z); st.want.speed = d > reach + 0.4 ? pace(1.2) : 0; st.want.turn = 4;
			move(dt, ctx.ground);
			if (R.yip <= 0) { R.yip = 2.5 + Math.random() * 3; say('yip'); st.barkT = 0.15; }
		}
		return R.phase;
	}
	// the whole of it, by what is going on (errands.js says which)
	function update(dt, ctx) {
		const m = ctx.mode;
		if (m === 'lost') lost(dt, ctx, ctx.home);
		else if (m === 'wary') wary(dt, ctx, ctx.you, ctx.rushing);
		else if (m === 'follow') follow(dt, ctx, ctx.you, ctx.keep);
		else if (m === 'reunion') reunite(ctx.owner, dt, ctx);
		else if (m === 'home') { follow(dt, ctx, ctx.owner, 1.4); setMood('happy'); want.wagA = 0.5; want.wagF = 5; }
		animate(dt);
	}
	// (for the review page: a mood and a pose held still, or a speed to show the gait)
	function pose(name) {
		const P2 = { sad: ['sad', 'stand', 0.55], alert: ['alert', 'stand', 0], calm: ['calm', 'stand', 1.1], happy: ['happy', 'stand', 0], jump: ['happy', 'jump', 0], sit: ['calm', 'sit', 0], lie: ['sad', 'lie', 0], run: ['happy', 'stand', 5.5] }[name] || ['calm', 'stand', 0];
		setMood(P2[0]); setPose(P2[1]); st.speed = st.want.speed = pace(P2[2]);
		Object.assign(cur, MOODS[P2[0]]); for (const p of POSES) cur.pose[p] = st.pose === p ? 1 : 0; cur.gaitW = st.speed > 0.1 ? 1 : 0;
	}
	function dispose() { root.removeFromParent(); mat.dispose(); }
	return {
		root, mesh, breed: b, name, she, size: b.h, tris: geo.index.count / 3,
		place, update, animate, pose, reunite, dispose,
		get pos() { return { x: st.x, y: st.y, z: st.z }; },
		mood: () => `${st.mood}/${st.pose}${R.phase ? '/' + R.phase : ''}`,
		reunion: () => R.phase,
		panting: () => st.mood !== 'sad' && (cur.gaitW > 0.5 || st.mood === 'happy'),
		set onSound(f) { onSound = f; },
	};
}
