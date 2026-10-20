// A glove's shell over the hand, moved out of people/garment.js's accessoryGeometry: the cuff,
// the knuckle guard, a gauntlet's plates, from the body's own faces.
// What it uses from garment.js's accessoryGeometry comes from ga: what is set up before it can run,
// once at the top of each call; the rest as ga.name at each use. A name not yet there needs a
// getter in accessoryGeometry's ga.

import * as THREE from 'three';
import { KIT_MODEL } from './kit-models.js';

export function garmentGloveShell(ga, sd, proud, cuff, c, gloss = 0, fab = 0, knuckle = null, plate = null, real = null) {
	const { A, ARMOUR, colour, heads, map, nSkin, out, P0, skinP, V3 } = ga;
	const part = P0.part, faces = A.body, wi = map['wrist.' + sd], w = heads[wi], fore = P0.rest.dirs[map['lowerarm01.' + sd]];
	if (!part || !faces || !w || !fore) return false;
	const sx = Math.sign(w.x) || 1;
	const keep = (v) => {
		if (v * 3 >= nSkin || Math.sign(skinP[v * 3]) !== sx) return false;
		if (part[v] === 3) return true;
		if (part[v] !== 2) return false;
		const t = (w.x - skinP[v * 3]) * fore.x + (w.y - skinP[v * 3 + 1]) * fore.y + (w.z - skinP[v * 3 + 2]) * fore.z;
		return t < cuff;
	};
	const tris = [], tn = [], nor = new Map(), ctr = V3(0, 0, 0), a = V3(0, 0, 0), b = V3(0, 0, 0), e = V3(0, 0, 0);
	const nf = real ? real.faces.length : faces.length / 6;
	for (let k = 0; k < nf; k++) {
		const i = (real ? real.faces[k] : k) * 6;
		const t = [faces[i], faces[i + 2], faces[i + 4]];
		if (real ? !t.every((v) => v * 3 < nSkin) : !t.every(keep)) continue;
		tris.push(t); tn.push(k);
		a.set(skinP[t[1] * 3] - skinP[t[0] * 3], skinP[t[1] * 3 + 1] - skinP[t[0] * 3 + 1], skinP[t[1] * 3 + 2] - skinP[t[0] * 3 + 2]);
		b.set(skinP[t[2] * 3] - skinP[t[0] * 3], skinP[t[2] * 3 + 1] - skinP[t[0] * 3 + 1], skinP[t[2] * 3 + 2] - skinP[t[0] * 3 + 2]);
		e.crossVectors(a, b);
		for (const v of t) { if (!nor.has(v)) { nor.set(v, V3(0, 0, 0)); ctr.x += skinP[v * 3]; ctr.y += skinP[v * 3 + 1]; ctr.z += skinP[v * 3 + 2]; } nor.get(v).add(e); }
	}
	if (!tris.length) return false;
	ctr.multiplyScalar(1 / nor.size);
	// (the body's winding, read from the shell itself: its normals point away from its middle)
	let out1 = 0; for (const [v, n] of nor) out1 += n.x * (skinP[v * 3] - ctr.x) + n.y * (skinP[v * 3 + 1] - ctr.y) + n.z * (skinP[v * 3 + 2] - ctr.z);
	const flip = out1 < 0 ? -1 : 1;
	for (const n of nor.values()) n.normalize().multiplyScalar(flip);
	// (the knuckles: midway between the first finger's and the little finger's, on the back of
	// the hand, which faces out from the body in the rest pose)
	let K = null, nb = null, hd = null;
	const k2 = heads[map['finger2-1.' + sd]], k5 = heads[map['finger5-1.' + sd]];
	if ((knuckle || plate) && k2 && k5) {
		K = k2.clone().add(k5).multiplyScalar(0.5); hd = K.clone().sub(w).normalize();
		nb = V3(0, 0, 0).crossVectors(P0.rest.dirs[wi], k5.clone().sub(k2)).normalize(); if (nb.x * sx < 0) nb.negate();
	}
	// (a gauntlet: the back of the hand and of the fingers in steel, in lames across the hand,
	// each with a dark lap where it ends)
	const plC = plate ? new THREE.Color(plate.col) : null;
	const kc = new THREE.Color(knuckle?.col || c), base = new THREE.Color(c);
	// (the body's winding turned if need be; a real glove's atlas follows its corners)
	const ord = flip > 0 ? [0, 1, 2] : [0, 2, 1], start = out.pos.length / 3, kuv = real ? new Float32Array(tris.length * 6) : null;
	for (let ti = 0; ti < tris.length; ti++) for (let cn = 0; cn < 3; cn++) {
		const v = tris[ti][ord[cn]], n = nor.get(v);
		if (real) {
			const q = (tn[ti] * 3 + ord[cn]) * 2, o2 = (ti * 3 + cn) * 2;
			kuv[o2] = real.uv[q] / 65535; kuv[o2 + 1] = real.uv[q + 1] / 65535;
			const off = proud + (real.lift ? real.lift[q >> 1] * 0.00005 : 0);
			out.pos.push(skinP[v * 3] + n.x * off, skinP[v * 3 + 1] + n.y * off, skinP[v * 3 + 2] + n.z * off); out.nor.push(n.x, n.y, n.z);
			out.col.push(base.r, base.g, base.b); out.kit.push(KIT_MODEL, 0, 0); out.wr.push(0, 0);
			let sum = 0; for (let w4 = 0; w4 < 4; w4++) sum += A.weights[v * 4 + w4];
			for (let w4 = 0; w4 < 4; w4++) { out.si.push(A.ids[v * 4 + w4]); out.sw.push(A.weights[v * 4 + w4] / (sum || 1)); }
			continue;
		}
		let k = 0;
		if (K && knuckle) {
			const d = Math.hypot(skinP[v * 3] - K.x, skinP[v * 3 + 1] - K.y, skinP[v * 3 + 2] - K.z);
			k = Math.max(0, 1 - d / (knuckle?.reach || 0.034)) * Math.max(0, Math.min(1, (n.dot(nb) - 0.2) / 0.4));
			k = k > 0.25 ? Math.min(1, k * 1.6) : 0;
		}
		const pl = plC && nb && n.dot(nb) > 0.1 ? 1 : 0, sAlong = pl ? (skinP[v * 3] - w.x) * hd.x + (skinP[v * 3 + 1] - w.y) * hd.y + (skinP[v * 3 + 2] - w.z) * hd.z : 0;
		const lap = pl && sAlong > 0 && (sAlong / 0.017) % 1 > 0.84;
		const lift = proud + k * (knuckle?.rise || 0) + pl * 0.0016;
		colour.copy(base).lerp(kc, k > 0 ? 1 : 0);
		if (pl) colour.copy(plC).multiplyScalar(lap ? 0.45 : 1);
		out.pos.push(skinP[v * 3] + n.x * lift, skinP[v * 3 + 1] + n.y * lift, skinP[v * 3 + 2] + n.z * lift); out.nor.push(n.x, n.y, n.z);
		out.col.push(colour.r, colour.g, colour.b); out.kit.push(pl ? ARMOUR : k > 0 && knuckle?.gloss != null ? knuckle.gloss : gloss, pl || (k > 0 && knuckle?.gloss === ARMOUR) ? 0 : fab, 0); out.wr.push(pl ? (lap ? 0 : 0.35) : k > 0 ? 0.6 : 0, lap ? 0.5 : 0);
		let sum = 0; for (let q = 0; q < 4; q++) sum += A.weights[v * 4 + q];
		for (let q = 0; q < 4; q++) { out.si.push(A.ids[v * 4 + q]); out.sw.push(A.weights[v * 4 + q] / (sum || 1)); }
	}
	if (real) out.uvs.push([start, kuv]);
	return true;
}
