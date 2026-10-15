// First-person detail for the existing CC0 MakeHuman skin. Refine only the selected
// arm triangles, retaining UVs, tattoos and normalized four-bone skin influences.
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
	return g;
}

export function closeHandMaterial(P) {
	const m = skinMaterial(P.skinMat.map, P.skinMat.color.clone(), P.dna.age, { closeup: true });
	// Preserve personalized skin and tattoo uniforms, without modifying the body material.
	for (const key of ['scalp', 'beard', 'skin', 'vit']) if (P.skinMat.userData[key]) m.userData[key].value.copy(P.skinMat.userData[key].value);
	for (const [key, value] of Object.entries(P.skinMat.userData.ink || {})) if (m.userData.ink[key]) m.userData.ink[key].value = value.value;
	return m;
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
