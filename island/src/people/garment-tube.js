// A worn tube fitted round a part of the body, moved out of people/garment.js's
// accessoryGeometry: sleeves, belts, straps and padding, sized by measuring what it is worn over.
// What it uses from garment.js's accessoryGeometry comes from ga: what is set up before it can run,
// once at the top of each call; the rest (ARMOUR, V3) as ga.name at each use. A name not yet there
// needs a getter in accessoryGeometry's ga.

import * as THREE from 'three';

export function garmentFitTube(ga, { o, axis, t0, t1, dt = 0.016, seg = 32, arc = null, span = null, floor = null, thick = null, skin, cloth = null, wall = 0.008, cover = null, lift = null, bone, closeA = 0, closeB = 0, smooth = 12, give = 0.008, rim = 0.0035, edge = null, wear = 0.38, rimCol = null, col, paint = null, stain = null, fab = 0, gloss = ga.ARMOUR, ref = ga.V3(0, 0, 1), minR = 0.02, rows = 0, draw = true }) {
	const { ARMOUR, map, nSkin, out, P0, PAINT, POLY, PT, skinP, STAINC, V3 } = ga;
	const a = axis.clone().normalize(), f = ref.clone().projectOnPlane(a);
	if (f.lengthSq() < 1e-6) f.set(1, 0, 0).projectOnPlane(a);
	f.normalize();
	const sv = V3(0, 0, 0).crossVectors(a, f), ns = Math.max(2, Math.round((t1 - t0) / dt)) + 1, step = (t1 - t0) / (ns - 1);
	if (P0.lo) seg = Math.max(16, seg >> 1);
	const R = new Float32Array(ns * seg), got = new Uint8Array(ns * seg);
	const take = (x, y, z) => {
		const dx = x - o.x, dy = y - o.y, dz = z - o.z, t = dx * a.x + dy * a.y + dz * a.z;
		if (t < t0 - step || t > t1 + step) return;
		const i = Math.max(0, Math.min(ns - 1, Math.round((t - t0) / step)));
		const px = dx - a.x * t, py = dy - a.y * t, pz = dz - a.z * t, r = Math.hypot(px, py, pz);
		const th = Math.atan2(px * sv.x + py * sv.y + pz * sv.z, px * f.x + py * f.y + pz * f.z);
		const j = ((Math.round(th / (Math.PI * 2) * seg) % seg) + seg) % seg, k = i * seg + j;
		if (r > R[k]) R[k] = r; got[k] = 1;
	};
	for (let i = 0, v = 0; i < nSkin; i += 3, v++) if (skin(v, skinP[i], skinP[i + 1], skinP[i + 2])) take(skinP[i], skinP[i + 1], skinP[i + 2]);
	const cp = P0.cloth?.attributes.position, sl = P0.cloth?.attributes.slot;
	if (cloth && cp && sl) for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), s = sl.getX(i); if (cloth(x, y, z, s % 10, Math.floor(s / 10 + 0.01))) take(x, y, z); }
	// (empty sectors: from their ring's nearest; an empty ring: from the ring beside it)
	for (let i = 0; i < ns; i++) {
		if (![...got.subarray(i * seg, i * seg + seg)].some(Boolean)) continue;
		for (let j = 0; j < seg; j++) {
			const k = i * seg + j; if (got[k]) continue;
			for (let d = 1; d < seg; d++) { const l = i * seg + ((j - d + seg) % seg), r = i * seg + ((j + d) % seg); if (got[l] || got[r]) { R[k] = Math.max(got[l] ? R[l] : 0, got[r] ? R[r] : 0); break; } }
		}
		for (let j = 0; j < seg; j++) got[i * seg + j] = 1;
	}
	for (let pass = 0; pass < 2; pass++) for (let i0 = 0; i0 < ns; i0++) {
		const i = pass ? ns - 1 - i0 : i0, n = pass ? i + 1 : i - 1;
		if (got[i * seg] || n < 0 || n >= ns || !got[n * seg]) continue;
		for (let j = 0; j < seg; j++) { R[i * seg + j] = R[n * seg + j]; got[i * seg + j] = 1; }
	}
	for (let k = 0; k < R.length; k++) R[k] = Math.max(R[k], minR);
	const raw = R.slice(), S = R.slice();
	for (let it = 0; it < smooth; it++) for (let i = 0; i < ns; i++) for (let j = 0; j < seg; j++) {
		const k = i * seg + j, l = i * seg + ((j + seg - 1) % seg), r = i * seg + ((j + 1) % seg);
		let s = S[l] + S[r] + S[k] * 2, w = 4;
		if (i > 0) { s += S[k - seg]; w++; } if (i < ns - 1) { s += S[k + seg]; w++; }
		// (a fold of cloth may stand a little proud of the curve: the wall covers it)
		S[k] = Math.max(raw[k] - give, s / w);
	}
	// (the domed ends)
	const domed = (t, r) => {
		if (closeA && t < t0 + closeA) { const u = (t0 + closeA - t) / closeA; return r * Math.sqrt(Math.max(0, 1 - u * u)); }
		if (closeB && t > t1 - closeB) { const u = (t - (t1 - closeB)) / closeB; return r * Math.sqrt(Math.max(0, 1 - u * u)); }
		return r;
	};
	// (the smoothed reach anywhere on the grid; a domed end takes it from where the dome starts)
	const reach = (t, th) => {
		const tc = Math.min(t1 - closeB, Math.max(t0 + closeA, t)), fi = Math.max(0, Math.min(ns - 1, (tc - t0) / step)), i = Math.min(ns - 2, Math.floor(fi)), u = fi - i;
		const fj = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * seg, j = Math.floor(fj) % seg, w = fj - Math.floor(fj), j1 = (j + 1) % seg;
		const r = (S[i * seg + j] * (1 - w) + S[i * seg + j1] * w) * (1 - u) + (S[(i + 1) * seg + j] * (1 - w) + S[(i + 1) * seg + j1] * w) * u;
		return domed(t, r);
	};
	// arc: only the sectors between two angles; span(θ): the rows run between two places
	// along the axis that differ round it (a helmet's rim cut high over the ears), so the
	// edges follow the cut and do not step (rows: how many across it, when the span is much
	// narrower than t0..t1, a band of a fauld cut from a tall measure)
	const nr = span && rows ? Math.max(2, rows) : ns, W = seg + 1, NV = nr * W;
	const thOf = (j) => (arc ? arc[0] + ((arc[1] - arc[0]) * j) / seg : (j / seg) * Math.PI * 2 - (j / seg > 0.5 ? Math.PI * 2 : 0));
	const tOf = (i, j) => { if (!span) return t0 + i * step; const [A, Bt] = span(thOf(j)); return A + ((Bt - A) * i) / (nr - 1); };
	const dirAt = (th, d) => { const c = Math.cos(th), s = Math.sin(th); return d.set(f.x * c + sv.x * s, f.y * c + sv.y * s, f.z * c + sv.z * s); };
	const D3 = V3(0, 0, 0);
	// (a point on the curve, stood off by the wall, and out by h more)
	const point = (t, th, h = 0, to = V3(0, 0, 0)) => { const r = reach(t, th), rr = r > 1e-4 ? Math.max(r, floor ? floor(t, th) : 0) + wall + h : 0; dirAt(th, D3); return to.set(o.x + a.x * t + D3.x * rr, o.y + a.y * t + D3.y * rr, o.z + a.z * t + D3.z * rr); };
	// (which quads are kept, and so how far each point lies in from an edge)
	const onV = new Uint8Array(NV);
	for (let i = 0; i < nr; i++) for (let j = 0; j <= seg; j++) { const t = tOf(i, j), th = thOf(j % W); onV[i * W + j] = !cover || cover(t, th, point(t, th, 0, PT)) ? 1 : 0; }
	const quad = (i, j) => i >= 0 && i < nr - 1 && j >= 0 && j < seg && onV[i * W + j] && onV[(i + 1) * W + j] && onV[i * W + j + 1] && onV[(i + 1) * W + j + 1];
	const D = new Uint8Array(NV).fill(255), Q = [];
	const wrapQ = (i, j) => quad(i, arc ? j : (j + seg) % seg);
	for (let i = 0; i < nr; i++) for (let j = 0; j <= seg; j++) {
		const inner = wrapQ(i, j) && wrapQ(i - 1, j) && wrapQ(i, j - 1) && wrapQ(i - 1, j - 1);
		if (!inner && !(i === 0 && closeA) && !(i === nr - 1 && closeB)) { D[i * W + j] = 0; Q.push(i * W + j); }
	}
	for (let h = 0; h < Q.length; h++) {
		const k = Q[h], i = Math.floor(k / W), j = k % W, d = D[k] + 1; if (d > 6) continue;
		for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const ii = i + di; let jj = j + dj; if (ii < 0 || ii >= nr) continue;
			if (arc) { if (jj < 0 || jj > seg) continue; } else if (jj < 0) jj = seg - 1; else if (jj > seg) jj = 1;
			const kk = ii * W + jj; if (D[kk] > d) { D[kk] = d; Q.push(kk); if (!arc && (jj === 0 || jj === seg)) { const tw = ii * W + (jj ? 0 : seg); if (D[tw] > d) { D[tw] = d; Q.push(tw); } } }
		}
	}
	if (thick == null) thick = gloss === ARMOUR ? 0.0035 : 0;
	const steel = stain ?? gloss === ARMOUR, baseC = new THREE.Color(col), wornC = rimCol ? new THREE.Color(rimCol) : null;
	const V = new Float32Array(NV * 3), Cc = new Float32Array(NV * 3), Wy = new Float32Array(NV), B = [], tint = new THREE.Color(), seamC = new THREE.Color('#141517');
	for (let i = 0; i < nr; i++) for (let j = 0; j <= seg; j++) {
		const k = i * W + j, t = tOf(i, j), th = thOf(j), p = point(t, th);
		const L = lift ? lift(t, th, p) : null, d = D[k];
		const e = edge ? edge(d) : d === 0 ? rim : d === 1 ? rim * 0.45 : 0;
		point(t, th, (L?.lift || 0) + e, D3);
		V[k * 3] = D3.x; V[k * 3 + 1] = D3.y; V[k * 3 + 2] = D3.z;
		tint.copy((paint && paint(t, th, p)) || baseC);
		if (d === 0) { if (wornC) tint.copy(wornC); else if (steel) tint.lerp(new THREE.Color('#c8ccd2'), wear); }
		if (steel) {
			// (use: the steel dulled and stained in patches, rust brown in the worst of them,
			// a little darker toward its lower edge)
			const X = V[k * 3], Y = V[k * 3 + 1], Z = V[k * 3 + 2];
			const s1 = Math.sin(X * 23 + Y * 7) * Math.sin(Y * 19 - Z * 11) * Math.sin(Z * 17 + X * 13), s2 = Math.sin(X * 41 - Z * 29) * Math.sin(Y * 37 + X * 17);
			tint.multiplyScalar(0.84 + 0.16 * s1 * s1 + 0.08 * (i / Math.max(1, nr - 1)) * (a.y > 0.5 ? 1 : 0));
			if (s2 > 0.55 && d > 0) tint.lerp(STAINC, (s2 - 0.55) * 0.9);
		}
		if (L?.seam) tint.lerp(seamC, Math.min(1, L.seam));
		if (L?.tone) tint.multiplyScalar(L.tone);
		Wy[k] = Math.min(1, (L?.seam || 0) * 0.4 + (L?.dirt || 0));
		Cc[k * 3] = tint.r; Cc[k * 3 + 1] = tint.g; Cc[k * 3 + 2] = tint.b;
		const b = bone(t, th);
		B.push(typeof b === 'string' ? [[map[b] ?? 0, 1]] : b.map(([n, w]) => [map[n] ?? 0, w]));
	}
	// the finished surface, for what is fixed on it
	const surf = (t, th, to) => point(t, th, lift ? lift(t, th, point(t, th))?.lift || 0 : 0, to);
	const at = (t, th, off = 0) => {
		const p = surf(t, th, V3(0, 0, 0)), dT = surf(t + 0.004, th, V3(0, 0, 0)).sub(surf(t - 0.004, th, V3(0, 0, 0))), dS = surf(t, th + 0.02, V3(0, 0, 0)).sub(surf(t, th - 0.02, V3(0, 0, 0)));
		const n = V3(0, 0, 0).crossVectors(dT, dS).normalize();
		if (n.dot(dirAt(th, V3(0, 0, 0))) < 0) n.negate();
		return { p: p.addScaledVector(n, off), n, bone: bone(t, th) };
	};
	// (how far out the finished surface stands, for what is worn over it: floor)
	const rad = (t, th) => (t < t0 || t > t1 ? 0 : Math.max(reach(t, th), floor ? floor(t, th) : 0) + wall + (lift ? lift(t, th, point(t, th))?.lift || 0 : 0));
	// (the clothes under it, test(x, y, z, slot, limb), pressed in under its inside and the shift
	// kept so the shader does not push them back out, cloth-collide.js)
	const press = (test, clear = 0.003) => {
		const cp2 = P0.cloth?.attributes.position, ci = P0.cloth?.attributes.clothInset, sl2 = P0.cloth?.attributes.slot, inset = (thick ?? (gloss === ARMOUR ? 0.0035 : 0)) + clear;
		if (!cp2) return;
		for (let i = 0; i < cp2.count; i++) {
			const x = cp2.getX(i), y = cp2.getY(i), z = cp2.getZ(i), sn = sl2 ? sl2.getX(i) : 0;
			if (!test(x, y, z, sn % 10, Math.floor(sn / 10 + 0.01))) continue;
			const dx = x - o.x, dy = y - o.y, dz = z - o.z, t = dx * a.x + dy * a.y + dz * a.z;
			if (t < t0 || t > t1) continue;
			const px = dx - a.x * t, py = dy - a.y * t, pz = dz - a.z * t, r = Math.hypot(px, py, pz);
			const th = Math.atan2(px * sv.x + py * sv.y + pz * sv.z, px * f.x + py * f.y + pz * f.z);
			if (arc && (((th - arc[0]) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) > arc[1] - arc[0]) continue;
			if (span) { const [A0, B0] = span(th); if (t < A0 || t > B0) continue; }
			const inner = rad(t, th) - inset; if (inner <= 0 || r <= inner) continue;
			const k = inner / r;
			cp2.setXYZ(i, o.x + a.x * t + px * k, o.y + a.y * t + py * k, o.z + a.z * t + pz * k);
			if (ci) ci.setX(i, ci.getX(i) + (r - inner));
		}
	};
	if (!draw) return { at, rad, press };
	const I = [];
	for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) if (quad(i, j)) { const p = i * W + j, q = p + W; I.push(p, p + 1, q, p + 1, q + 1, q); }
	if (!I.length) return null;
	const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(V, 3)); g.setIndex(I); g.computeVertexNormals();
	const na = g.attributes.normal;
	// (round a closed tube, the first and last sectors are the same points: one normal for both,
	// or a crease shows down the front)
	if (!arc) for (let i = 0; i < nr; i++) {
		const k0 = i * W, k1 = i * W + seg, x = na.getX(k0) + na.getX(k1), y = na.getY(k0) + na.getY(k1), z = na.getZ(k0) + na.getZ(k1), l = Math.hypot(x, y, z) || 1;
		na.setXYZ(k0, x / l, y / l, z / l); na.setXYZ(k1, x / l, y / l, z / l);
	}
	// (how worn each point is: its edges rubbed, its seams and laps holding dirt)
	const wearX = (k) => (D[k] === 0 ? 1 : D[k] === 1 ? 0.55 : D[k] === 2 ? 0.2 : 0);
	const emit = (k, nx, ny, nz, ox, oy, oz, wx, wy) => {
		out.pos.push(V[k * 3] + ox, V[k * 3 + 1] + oy, V[k * 3 + 2] + oz); out.nor.push(nx, ny, nz); out.col.push(Cc[k * 3], Cc[k * 3 + 1], Cc[k * 3 + 2]);
		const b = B[k]; let sum = 0; for (const [, w] of b) sum += w;
		for (let q = 0; q < 4; q++) { out.si.push(b[q]?.[0] ?? 0); out.sw.push(b[q] ? b[q][1] / (sum || 1) : 0); }
		out.kit.push(gloss, fab, 0); out.wr.push(wx, wy);
	};
	for (const k of I) emit(k, na.getX(k), na.getY(k), na.getZ(k), 0, 0, 0, wearX(k), Wy[k]);
	// a plate has a thickness: its inside, and a wall round every edge where the two meet
	const th2 = P0.lo ? 0 : thick;
	if (th2 > 0) {
		// (in toward the axis: the normals follow the grid's winding, which may face either way)
		const k0 = I[0], rx0 = V[k0 * 3] - o.x, ry0 = V[k0 * 3 + 1] - o.y, rz0 = V[k0 * 3 + 2] - o.z, al0 = rx0 * a.x + ry0 * a.y + rz0 * a.z;
		const sg = (rx0 - a.x * al0) * na.getX(k0) + (ry0 - a.y * al0) * na.getY(k0) + (rz0 - a.z * al0) * na.getZ(k0) >= 0 ? th2 : -th2;
		const inn = (k) => [-na.getX(k) * sg, -na.getY(k) * sg, -na.getZ(k) * sg];
		// (a rigid shell's inside only near its edges, where it is seen past the rim; further in,
		// the body fills it and the material's other side stands in for it)
		const band = gloss === ARMOUR || gloss === PAINT || gloss === POLY ? 3 : 255;
		for (let f = 0; f < I.length; f += 3) {
			if (Math.min(D[I[f]], D[I[f + 1]], D[I[f + 2]]) > band) continue;
			for (const k of [I[f], I[f + 2], I[f + 1]]) { const o2 = inn(k); emit(k, -na.getX(k), -na.getY(k), -na.getZ(k), o2[0], o2[1], o2[2], 0, 0.3); }
		}
		// (a wall along the edge k0-k1 of the kept quad (qi, qj), facing away from it)
		const wall = (k0, k1, qi, qj) => {
			const P = (k, o2) => [V[k * 3] + (o2 ? o2[0] : 0), V[k * 3 + 1] + (o2 ? o2[1] : 0), V[k * 3 + 2] + (o2 ? o2[2] : 0)];
			const a0 = inn(k0), a1 = inn(k1), q0 = qi * W + qj, C = [0, 1, 2].map((c) => (V[q0 * 3 + c] + V[(q0 + 1) * 3 + c] + V[(q0 + W) * 3 + c] + V[(q0 + W + 1) * 3 + c]) / 4);
			const A0 = P(k0), A1 = P(k1), e = [A1[0] - A0[0], A1[1] - A0[1], A1[2] - A0[2]], n0 = [na.getX(k0) + na.getX(k1), na.getY(k0) + na.getY(k1), na.getZ(k0) + na.getZ(k1)];
			let sv2 = [e[1] * n0[2] - e[2] * n0[1], e[2] * n0[0] - e[0] * n0[2], e[0] * n0[1] - e[1] * n0[0]];
			const l = Math.hypot(...sv2) || 1; sv2 = sv2.map((x) => x / l);
			if (((A0[0] + A1[0]) / 2 - C[0]) * sv2[0] + ((A0[1] + A1[1]) / 2 - C[1]) * sv2[1] + ((A0[2] + A1[2]) / 2 - C[2]) * sv2[2] < 0) sv2 = sv2.map((x) => -x);
			// (two triangles, wound to face the way the wall does)
			const B1 = P(k1, a1), tri = [[k0, null], [k1, null], [k1, a1], [k0, null], [k1, a1], [k0, a0]];
			const cr = [e[1] * (B1[2] - A0[2]) - e[2] * (B1[1] - A0[1]), e[2] * (B1[0] - A0[0]) - e[0] * (B1[2] - A0[2]), e[0] * (B1[1] - A0[1]) - e[1] * (B1[0] - A0[0])];
			const order = cr[0] * sv2[0] + cr[1] * sv2[1] + cr[2] * sv2[2] >= 0 ? tri : [tri[0], tri[2], tri[1], tri[3], tri[5], tri[4]];
			for (const [k, o2] of order) emit(k, sv2[0], sv2[1], sv2[2], o2 ? o2[0] : 0, o2 ? o2[1] : 0, o2 ? o2[2] : 0, 1, 0);
		};
		const kept = (i, j) => (arc ? quad(i, j) : quad(i, (j + seg) % seg));
		for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) {
			if (!quad(i, j)) continue;
			const p = i * W + j;
			if (!kept(i - 1, j) && !(i === 0 && closeA)) wall(p, p + 1, i, j);
			if (!kept(i + 1, j) && !(i + 1 === nr - 1 && closeB)) wall(p + W, p + W + 1, i, j);
			if (!kept(i, j - 1)) wall(p, p + W, i, j);
			if (!kept(i, j + 1)) wall(p + 1, p + W + 1, i, j);
		}
	}
	g.dispose();
	return { at, rad, press };
}
