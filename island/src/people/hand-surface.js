// First-person detail for the existing CC0 MakeHuman skin. Refine only the selected
// arm triangles, retaining UVs, tattoos and normalized four-bone skin influences.
//
// Close up, the hands and forearms carry a map of where everything is on them, laid on the
// refined surface once (handAttributes): which way each point faces (the back of the hand or
// the palm), where it sits across and along the hand, how far it is from each finger joint,
// where the nail is on each fingertip, how thin the flesh is there, and the shade of the
// folds between the fingers. The skin shader (people/skin.js, SKIN_HERO) draws the creases,
// palm lines, tendons, veins, nails, the wrist bone and the forearm's hair from it, so no
// texture is fetched. fingerCurls() reads how far each finger is closed each frame, which
// darkens the palm side where it meets the grip or folds into a fist.
import * as THREE from 'three';
import { skinMaterial } from './skin.js';

export function refineHandSurface(source, indices, passes = 1) {
	const attrs = Object.entries(source.attributes), data = Object.fromEntries(attrs.map(([k]) => [k, []]));
	const remap = new Map(), faces = [];
	for (const old of indices) {
		if (!remap.has(old)) {
			remap.set(old, remap.size);
			for (const [key, a] of attrs) for (let k = 0; k < a.itemSize; k++) data[key].push(a.getComponent(old, k));
		}
		faces.push(remap.get(old));
	}
	let ix = faces;
	for (let pass = 0; pass < passes; pass++) {
		const edges = new Map(), next = [];
		const midpoint = (a, b) => {
			const key = a < b ? a + ':' + b : b + ':' + a;
			if (edges.has(key)) return edges.get(key);
			const out = data.position.length / 3;
			for (const [name, attr] of attrs) {
				if (name === 'skinIndex' || name === 'skinWeight') continue;
				for (let k = 0; k < attr.itemSize; k++) data[name].push((data[name][a * attr.itemSize + k] + data[name][b * attr.itemSize + k]) * .5);
			}
			// Cubic tangent projection rounds the silhouette without shrinking knuckles
			// or moving the original contact vertices. Cap the bulge at 1/8 edge length.
			const p = data.position, n = data.normal, d = [0, 1, 2].map(k => p[b * 3 + k] - p[a * 3 + k]);
			const da = d.reduce((s, v, k) => s + v * n[a * 3 + k], 0), db = d.reduce((s, v, k) => s + v * n[b * 3 + k], 0);
			const bulge = d.map((_, k) => (db * n[b * 3 + k] - da * n[a * 3 + k]) * .125);
			const limit = Math.min(1, Math.hypot(...d) * .125 / (Math.hypot(...bulge) || 1));
			for (let k = 0; k < 3; k++) p[out * 3 + k] += bulge[k] * limit;
			const len = Math.hypot(...n.slice(out * 3, out * 3 + 3)) || 1;
			for (let k = 0; k < 3; k++) n[out * 3 + k] /= len;
			const weights = new Map();
			for (const v of [a, b]) for (let k = 0; k < 4; k++) {
				const bone = data.skinIndex[v * 4 + k], w = data.skinWeight[v * 4 + k] * .5;
				weights.set(bone, (weights.get(bone) || 0) + w);
			}
			const best = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = best.reduce((s, v) => s + v[1], 0) || 1;
			for (let k = 0; k < 4; k++) { data.skinIndex.push(best[k]?.[0] || 0); data.skinWeight.push((best[k]?.[1] || 0) / sum); }
			edges.set(key, out); return out;
		};
		for (let i = 0; i < ix.length; i += 3) {
			const [a, b, c] = ix.slice(i, i + 3), ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
			next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
		}
		ix = next;
	}
	const g = new THREE.BufferGeometry();
	for (const [key, a] of attrs) g.setAttribute(key, key === 'skinIndex' ? new THREE.Uint16BufferAttribute(data[key], a.itemSize) : new THREE.Float32BufferAttribute(data[key], a.itemSize));
	g.setIndex(ix); g.computeBoundingSphere();
	handSlots(g);
	return g;
}

// The hand map's attributes, blank (plain skin), made with the geometry so the renderer
// uploads and binds them from the first frame; handAttributes() fills them in when the body is
// known (the first time the surface is drawn) and they are sent again.
function handSlots(g) {
	const n = g.attributes.position.count, A = new Uint8Array(n * 4), C = new Float32Array(n * 4);
	for (let v = 0; v < n; v++) { A[v * 4] = 128; A[v * 4 + 1] = 255; C.set([1, 1, 1, 9], v * 4); }
	g.setAttribute('handA', new THREE.BufferAttribute(A, 4, true));
	g.setAttribute('handB', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
	g.setAttribute('handC', new THREE.BufferAttribute(C, 4));
}

export function closeHandMaterial(P) {
	const m = skinMaterial(P.skinMat.map, P.skinMat.color.clone(), P.dna.age, { closeup: true });
	// Preserve personalized skin and tattoo uniforms, without modifying the body material.
	for (const key of ['scalp', 'beard', 'skin', 'vit']) if (P.skinMat.userData[key]) m.userData[key].value.copy(P.skinMat.userData[key].value);
	for (const [key, value] of Object.entries(P.skinMat.userData.ink || {})) if (m.userData.ink[key]) m.userData.ink[key].value = value.value;
	// the hand's measures for the shader, and the body's own hair and veins
	const F = handFrames(P), f = F.R || F.L, U = m.userData.hand;
	if (f) {
		U.uHand.value.set(f.L, f.span, ...handLook(P.dna));
		U.uThumb.value.set(...f.thumb);
		const c = P.skinMat.userData.beard?.value;
		if (c && c.x + c.y + c.z > 0) U.uHair.value.set(c.x, c.y, c.z, 1);
	}
	// laid on the refined surface the first time it is drawn (the sleeves have cut it by
	// then), and each frame how far each finger is closed
	const chains = fingerChains(P);
	m.onBeforeRender = (renderer, scene, camera, geometry, object) => {
		if (!geometry.userData.handMapped && geometry.attributes.skinIndex) handAttributes(P, geometry);
		if (object.skeleton) fingerCurls(chains, object.skeleton.bones, U.uCurl.value);
	};
	return m;
}

// how much body hair shows on the forearm and how plainly the veins stand out, by the body
// (more on men, veins plainer with age and on lean or muscular arms)
export function handLook(dna = {}) {
	const male = dna.male ?? (dna.sex ?? 0.5) > 0.5, age = dna.age ?? 35;
	const hair = (male ? 0.85 : 0.18) * (0.6 + Math.min(1, Math.max(0, (age - 14) / 30)) * 0.4);
	const lean = 1 - Math.min(1, Math.max(0, ((dna.weight ?? 0.5) - 0.3) / 0.6));
	const veins = Math.min(1, 0.35 + Math.min(1, Math.max(0, (age - 25) / 45)) * 0.4 + lean * 0.25 + (dna.muscle ?? 0.5) * 0.2 + (male ? 0.1 : 0));
	return [+hair.toFixed(3), +veins.toFixed(3)];
}

export function armTriangles(P, side) {
	const g = P.skin.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
	const wanted = new RegExp('^(lowerarm0[12]|wrist|finger\\d-\\d|metacarpal\\d)\\.' + side + '$');
	const keep = P.bones.map(b => wanted.test(b.name));
	const belongs = v => { let best = 0; for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k; return keep[si.getComponent(v, best)]; };
	const out = [], ix = g.index.array;
	for (let i = 0; i < ix.length; i += 3) if (belongs(ix[i]) && belongs(ix[i + 1]) && belongs(ix[i + 2])) out.push(ix[i], ix[i + 1], ix[i + 2]);
	return out;
}

// ---------- where things are on a hand ----------
const tipOf = (P, i) => P.rest.tails?.[i] ? P.rest.tails[i].clone() : P.rest.heads[i].clone().addScaledVector(P.rest.dirs[i], 0.02);

// Each hand's frame in the body's rest pose. Y runs from the wrist to the knuckles (L long),
// X across them from the index finger's to the little finger's (span is half of that), D out
// of the back of the hand. The thumb lies in front of the palm, which says which way D goes.
// The forearm has its own (F from the elbow to the wrist, FX, FD), and the thumb's knuckle and
// base are given in the hand's own measures (u across in spans, v along in lengths).
export function handFrames(P) {
	const out = {};
	for (const side of ['L', 'R']) {
		const at = (n) => P.map[n + '.' + side], H = P.rest.heads;
		const iw = at('wrist'), names = ['finger2-1', 'finger3-1', 'finger4-1', 'finger5-1', 'finger1-3', 'finger1-2', 'finger1-1', 'lowerarm01'];
		if (iw == null || names.some((n) => at(n) == null)) continue;
		const W = H[iw].clone(), mcp = [2, 3, 4, 5].map((f) => H[at(`finger${f}-1`)].clone());
		const mid = mcp.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(0.25);
		const Y = mid.clone().sub(W), L = Y.length();
		Y.normalize();
		const X = mcp[3].clone().sub(mcp[0]);
		X.addScaledVector(Y, -X.dot(Y));
		const span = X.length() / 2;
		X.normalize();
		const D = new THREE.Vector3().crossVectors(X, Y).normalize();
		if (tipOf(P, at('finger1-3')).sub(W).dot(D) > 0) D.negate();
		const C = mcp[0].clone().add(mcp[3]).multiplyScalar(0.5);
		const F = W.clone().sub(H[at('lowerarm01')]).normalize();
		const FX = X.clone().addScaledVector(F, -X.dot(F)).normalize(), FD = D.clone().addScaledVector(F, -D.dot(F)).normalize();
		// (the forearm's centre line meets the hand's across the wrist)
		const FO = W.clone().addScaledVector(X, C.clone().sub(W).dot(X));
		const uv = (p) => [p.clone().sub(C).dot(X) / span, p.clone().sub(W).dot(Y) / L];
		out[side] = { W, X, Y, D, L, span, C, F, FX, FD, FO, mcp, uv, thumb: [...uv(H[at('finger1-2')]), ...uv(H[at('finger1-1')])].map((x) => +x.toFixed(4)) };
	}
	return out;
}

// each finger's bones from its knuckle's parent out, for fingerCurls: [side, finger, parent,
// first, second, third] and how far it is closed at rest (radians)
export function fingerChains(P) {
	const out = [];
	for (const side of ['L', 'R']) for (let f = 1; f <= 5; f++) {
		const ids = [1, 2, 3].map((j) => P.map[`finger${f}-${j}.${side}`]);
		if (ids.some((i) => i == null)) continue;
		const parent = P.bones.indexOf(P.bones[ids[0]].parent);
		if (parent < 0) continue;
		const chain = [parent, ...ids], dirs = chain.map((i) => P.rest.dirs[i]);
		let rest = 0;
		for (let k = 1; k < 4; k++) rest += dirs[k - 1].angleTo(dirs[k]);
		out.push({ side: side === 'L' ? 1 : 0, f, chain, dirs, rest });
	}
	return out;
}

// How far each finger is closed now, 0 (open, as at rest) to 1 (a fist), written into out[side
// * 6 + finger] (the palm's slot, finger 0, takes the mean of the four fingers). bones: the
// skeleton's bones, whose matrixWorld turns each bone from the rest pose (their inverses carry
// no turn). No allocation.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix3();
export function fingerCurls(chains, bones, out) {
	out.fill(0);
	const sum = [0, 0];
	for (const c of chains) {
		let total = 0;
		for (let k = 1; k < 4; k++) {
			_a.copy(c.dirs[k - 1]).applyMatrix3(_m.setFromMatrix4(bones[c.chain[k - 1]].matrixWorld)).normalize();
			_b.copy(c.dirs[k]).applyMatrix3(_m.setFromMatrix4(bones[c.chain[k]].matrixWorld)).normalize();
			total += Math.acos(Math.max(-1, Math.min(1, _a.dot(_b))));
		}
		// (a fist closes the four fingers about 3.8 radians from straight, the thumb about 2)
		const k = Math.max(0, Math.min(1, (total - c.rest) / (c.f === 1 ? 1.6 : 2.9)));
		out[c.side * 6 + c.f] = k;
		if (c.f > 1) sum[c.side] += k / 4;
	}
	out[0] = sum[0]; out[6] = sum[1];
	return out;
}

// The map laid on a refined hand surface (g, in the body's bind space, skinned to P's bones):
//   handA (bytes): x which way it faces (0 the palm, 1 the back), y the shade of the folds, z how
//     thin the flesh is, w which finger (side * 6 + finger, 0 the palm and forearm)
//   handB: x across the hand (spans, + toward the little finger), y along it (lengths, 0 at the
//     wrist, 1 at the knuckles, below 0 down the forearm), z across the finger and w up it
//     (finger radii; w > 0 on the nail's side)
//   handC: the signed distance (m) along the finger to its knuckle, its middle joint and its
//     last joint (the thumb: its knuckle and its one joint), w along the nail (0 at the free
//     edge, 1 at the cuticle; 9 off the fingers)
export function handAttributes(P, g) {
	const F = handFrames(P), pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
	const n = pos.count, A = new Uint8Array(n * 4), B = new Float32Array(n * 4), Cc = new Float32Array(n * 4);
	const names = P.bones.map((b) => b.name), H = P.rest.heads;
	// each bone: what it is, and the way its back faces
	const info = names.map((name) => {
		const m = /^(finger(\d)-(\d)|metacarpal\d|wrist|lowerarm0[12])\.(L|R)$/.exec(name);
		if (!m) return null;
		const side = m[4], fr = F[side];
		if (!fr) return null;
		const f = m[2] ? +m[2] : 0, j = m[3] ? +m[3] : 0, fore = /^lowerarm/.test(name);
		return { side, f, j, fore, fr };
	});
	for (let i = 0; i < names.length; i++) {
		const b = info[i];
		if (!b) continue;
		if (b.fore) { b.dorsal = b.fr.FD; continue; }
		if (!b.f) { b.dorsal = b.fr.D; continue; }
		const dir = P.rest.dirs[i];
		let up = b.fr.D.clone();
		// (the thumb's nail faces out, away from the index finger, and partly back)
		if (b.f === 1) {
			const toward = H[P.map['finger2-2.' + b.side]].clone().sub(H[i]);
			up = toward.addScaledVector(dir, -toward.dot(dir)).normalize().negate().multiplyScalar(0.75).addScaledVector(b.fr.D, 0.45);
		}
		b.dir = dir; b.head = H[i];
		b.dorsal = up.addScaledVector(dir, -up.dot(dir)).normalize();
		b.lateral = new THREE.Vector3().crossVectors(dir, b.dorsal).normalize();
	}
	// each finger's joints: the plane through each, square to the bisector of the bones meeting
	// there, and where its tip ends
	const joints = {};
	for (const side of ['L', 'R']) for (let f = 1; f <= 5; f++) {
		const ids = [1, 2, 3].map((j) => P.map[`finger${f}-${j}.${side}`]);
		if (ids.some((i) => i == null)) continue;
		const plane = (i, prev) => ({ at: H[i], dir: prev == null ? P.rest.dirs[i].clone() : P.rest.dirs[prev].clone().add(P.rest.dirs[i]).normalize() });
		const parent = P.bones.indexOf(P.bones[ids[0]].parent);
		// (the thumb's own knuckle is its second bone's head, its one joint the third's)
		const list = f === 1 ? [plane(ids[1], ids[0]), plane(ids[2], ids[1]), null] : [plane(ids[0], parent >= 0 ? parent : null), plane(ids[1], ids[0]), plane(ids[2], ids[1])];
		joints[side + f] = { list, ids, tip: 0, len: H[ids[2]].distanceTo(tipOf(P, ids[2])) };
	}
	const p = new THREE.Vector3(), q = new THREE.Vector3(), nv = new THREE.Vector3(), dv = new THREE.Vector3();
	const dominant = new Int32Array(n), radius = new Map(), sideShade = new Float32Array(n);
	// first: the dominant bone of each vertex, each finger's tip, each finger bone's radius
	for (let v = 0; v < n; v++) {
		let best = 0;
		for (let k = 1; k < 4; k++) if (sw.getComponent(v, k) > sw.getComponent(v, best)) best = k;
		const i = si.getComponent(v, best), b = info[i];
		dominant[v] = b ? i : -1;
		if (!b?.f) continue;
		p.fromBufferAttribute(pos, v).sub(b.head);
		const t = p.dot(b.dir);
		const r = radius.get(i) || { s: 0, n: 0 };
		r.s += p.addScaledVector(b.dir, -t).length(); r.n++; radius.set(i, r);
		const J = joints[b.side + b.f];
		if (b.j === 3 && J) J.tip = Math.max(J.tip, t);
	}
	for (const [i, r] of radius) radius.set(i, Math.max(0.004, r.s / r.n));
	const nearestFinger = (side, x) => {
		let best = 2, d = Infinity;
		for (let f = 2; f <= 5; f++) { const J = joints[side + f]; if (!J) continue; const at = J.list[0].at, e = x.distanceToSquared(at); if (e < d) { d = e; best = f; } }
		return best;
	};
	for (let v = 0; v < n; v++) {
		const i = dominant[v];
		p.fromBufferAttribute(pos, v); nv.fromBufferAttribute(nor, v);
		Cc[v * 4] = Cc[v * 4 + 1] = Cc[v * 4 + 2] = 1; Cc[v * 4 + 3] = 9;
		if (i < 0) { A.set([128, 255, 0, 0], v * 4); continue; }
		const b = info[i], fr = b.fr;
		// which way it faces: the bones' backs blended by their weights
		dv.set(0, 0, 0);
		let thumbW = 0, palmW = 0;
		for (let k = 0; k < 4; k++) {
			const w = sw.getComponent(v, k), o = info[si.getComponent(v, k)];
			if (!o || !w) continue;
			dv.addScaledVector(o.dorsal, w);
			if (o.f === 1) thumbW += w; else if (!o.f && !o.fore) palmW += w;
		}
		const dorsal = dv.lengthSq() ? nv.dot(dv.normalize()) : 0;
		// across and along: the hand's frame, the forearm's, blended smoothly over the 4 cm
		// either side of the wrist (a kink there would crowd the detail drawn along it)
		const uh = q.copy(p).sub(fr.C).dot(fr.X) / fr.span, vh = q.copy(p).sub(fr.W).dot(fr.Y) / fr.L;
		const uf = q.copy(p).sub(fr.FO).dot(fr.FX) / fr.span, vf = q.copy(p).sub(fr.W).dot(fr.F) / fr.L;
		const k = Math.max(0, Math.min(1, (0.08 - vh) / 0.45)), blend = k * k * (3 - 2 * k);
		B[v * 4] = uh + (uf - uh) * blend; B[v * 4 + 1] = vh + (vf - vh) * blend;
		// the finger: across and up it, the joints, the nail
		const f = b.f || (b.fore ? 0 : nearestFinger(b.side, p)), J = joints[b.side + f];
		if (b.f) {
			q.copy(p).sub(b.head);
			const t = q.dot(b.dir);
			q.addScaledVector(b.dir, -t);
			const r = radius.get(i);
			B[v * 4 + 2] = q.dot(b.lateral) / r; B[v * 4 + 3] = q.dot(b.dorsal) / r;
			// the sides of the fingers that lie against their neighbours in a grip or a fist
			// (all but the index finger's outer side and the little finger's): in shade
			const la = q.dot(fr.X) / r;
			if (b.f > 1 && ((la > 0 && b.f < 5) || (la < 0 && b.f > 2))) sideShade[v] = Math.max(0, Math.min(1, (Math.abs(la) - 0.3) / 0.6)) * (b.j === 3 ? 0.6 : 1);
		}
		if (J && !b.fore) {
			for (let k = 0; k < 3; k++) { const pl = J.list[k]; if (pl) Cc[v * 4 + k] = q.copy(p).sub(pl.at).dot(pl.dir); }
			if (b.f) {
				// the nail: half the last bone's length (more on the thumb), from just short of the tip
				const last = J.ids[2], t = q.copy(p).sub(H[last]).dot(P.rest.dirs[last]);
				const tipLen = Math.max(J.tip, J.len * 0.8), nail = tipLen * (f === 1 ? 0.58 : 0.52), gap = nail * 0.1;
				Cc[v * 4 + 3] = (tipLen - t - gap) / nail;
			}
		}
		// thin flesh: the fingers (thinnest toward the tips), the webs between them and the thumb's
		let thin = 0;
		if (b.f) thin = 0.6 + 0.4 * Math.max(0, Math.min(1, 1 - Cc[v * 4 + 3] / 3));
		else if (!b.fore) thin = Math.max(Math.max(0, Math.min(1, (vh - 0.88) / 0.2)) * 0.75, Math.min(thumbW, palmW) * 1.4);
		A[v * 4] = Math.round(Math.max(0, Math.min(1, dorsal * 0.5 + 0.5)) * 255);
		A[v * 4 + 2] = Math.round(Math.min(1, thin) * 255);
		A[v * 4 + 3] = (b.side === 'L' ? 6 : 0) + (b.fore ? 0 : b.f || 0);
	}
	const ao = bakeShade(pos, nor, g.index);
	for (let v = 0; v < n; v++) A[v * 4 + 1] = Math.round(Math.max(0.2, ao[v] * (1 - 0.55 * sideShade[v])) * 255);
	// (into the blank slots when they are there, so the renderer keeps its binding of them)
	const put = (name, data, normalized = false) => {
		const at = g.attributes[name];
		if (at && at.array.length === data.length && at.array.constructor === data.constructor) { at.array.set(data); at.needsUpdate = true; } else g.setAttribute(name, new THREE.BufferAttribute(data, 4, normalized));
	};
	put('handA', A, true); put('handB', B); put('handC', Cc);
	g.userData.handMapped = true;
	return g;
}

// The shade of the folds: how much of the sky each vertex sees past the skin around it (2.2 cm
// round), from a sample of the surface as small discs (point-based occlusion). 1 is open.
export function bakeShade(pos, nor, index, { reach = 0.022, stride = 3 } = {}) {
	const n = pos.count, out = new Float32Array(n).fill(1), area = new Float32Array(n);
	const P = Float32Array.from({ length: n * 3 }, (_, i) => pos.getComponent(i / 3 | 0, i % 3)), N = Float32Array.from({ length: n * 3 }, (_, i) => nor.getComponent(i / 3 | 0, i % 3));
	// each vertex's share of the surface (a third of its triangles'); each sample stands for the
	// stride vertices round it
	const ix = index ? index.array : null, nt = ix ? ix.length : n;
	for (let t = 0; t < nt; t += 3) {
		const a = (ix ? ix[t] : t) * 3, b = (ix ? ix[t + 1] : t + 1) * 3, c = (ix ? ix[t + 2] : t + 2) * 3;
		const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
		const s = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 6;
		area[a / 3] += s; area[b / 3] += s; area[c / 3] += s;
	}
	// the samples in cells a reach wide
	const cell = (x) => Math.floor(x / reach), key = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791), grid = new Map();
	for (let v = 0; v < n; v += stride) {
		if (!area[v]) continue;
		const k = key(cell(P[v * 3]), cell(P[v * 3 + 1]), cell(P[v * 3 + 2]));
		let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(v);
	}
	const r2 = reach * reach;
	for (let v = 0; v < n; v++) {
		const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
		const cx = cell(x), cy = cell(y), cz = cell(z);
		let occ = 0;
		for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
			const list = grid.get(key(cx + a, cy + b, cz + c));
			if (list) for (let i = 0; i < list.length; i++) {
				const o = list[i], dx = P[o * 3] - x, dy = P[o * 3 + 1] - y, dz = P[o * 3 + 2] - z, d2 = dx * dx + dy * dy + dz * dz;
				if (d2 < 1e-8 || d2 > r2) continue;
				const d = Math.sqrt(d2), cos = (dx * nx + dy * ny + dz * nz) / d;
				if (cos <= 0.1) continue;
				// (a disc facing back toward this point blocks the most; one edge on, less)
				const back = Math.max(0.2, -(dx * N[o * 3] + dy * N[o * 3 + 1] + dz * N[o * 3 + 2]) / d), A = area[o] * stride;
				occ += A * cos * back / (Math.PI * d2 + A) * (1 - d / reach);
			}
		}
		out[v] = Math.max(0.3, 1 - Math.min(1, occ * 3));
	}
	return out;
}
