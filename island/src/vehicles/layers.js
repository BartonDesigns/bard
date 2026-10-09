// The real models come with layers laid on their own surfaces: trim, badges and decals drawn
// a fraction of a millimetre off the panel under them, and here and there the same face twice.
// Drawn as they are, the two fight for the depth buffer and the layer flickers through in
// stripes and saw teeth, worst at a distance. Within one material (so one draw), each layer
// is lifted 2 mm clear of what it lies on and a face given twice is dropped; between
// materials the draw order does it (layerOffset, below).

import * as THREE from 'three';

// what lies on what, lowest first: the paint, the trim, the chrome, the lamps, the glass
const RANK = { paint: 0, solid: 1, chrome: 2, lamp: 3, glass: 4 };
// a material's place in the stack, as a polygon offset (nearer for the upper layers)
export function layerOffset(mat, role, name) {
	const r = role === 'solid' && /chrome/i.test(name) ? RANK.chrome : RANK[role] ?? 1;
	if (!r) return;
	mat.polygonOffset = true;
	mat.polygonOffsetFactor = -r;
	mat.polygonOffsetUnits = -r;
}

// lift the upper of each pair of overlapping faces (closer than 2.5 mm, facing the same way)
// 2 mm along its normal, on vertices of its own; drop a face that is there twice. In place;
// returns how many faces it lifted and dropped.
export function unfight(geo, lift = 0.002, near = 0.0025) {
	const P = geo.attributes.position, I = geo.index;
	if (!I) return { lifted: 0, dropped: 0 };
	const n = I.count / 3, tri = new Float32Array(n * 13);
	const v = (k) => [P.getX(k), P.getY(k), P.getZ(k)];
	// per face: its corners, unit normal, plane offset
	for (let t = 0; t < n; t++) {
		const a = v(I.getX(t * 3)), b = v(I.getX(t * 3 + 1)), c = v(I.getX(t * 3 + 2));
		const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
		let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
		const l = Math.hypot(nx, ny, nz);
		if (l < 1e-10) { tri[t * 13 + 12] = -1; continue; }
		nx /= l; ny /= l; nz /= l;
		tri.set([...a, ...b, ...c, nx, ny, nz], t * 13);
		tri[t * 13 + 12] = l / 2;
	}
	// faces in buckets by their plane: its offset to 2.5 mm, and its direction to an eighth (a
	// face near the edge of a direction cell goes in its neighbours too), looked for by their
	// own cell and the offsets either side
	const bucket = new Map(), dOf = (t) => { const o = t * 13; return Math.round((tri[o + 9] * tri[o] + tri[o + 10] * tri[o + 1] + tri[o + 11] * tri[o + 2]) / near); };
	const cellKey = (i, j, k, d) => (((i + 9) * 19 + (j + 9)) * 19 + (k + 9)) * 80000 + d + 40000;
	for (let t = 0; t < n; t++) {
		if (tri[t * 13 + 12] <= 0) continue;
		const o = t * 13, d = dOf(t), C = [9, 10, 11].map((m) => { const x = tri[o + m] * 8, r = Math.round(x); return Math.abs(x - r) > 0.18 ? [r, x > r ? r + 1 : r - 1] : [r]; });
		for (const i of C[0]) for (const j of C[1]) for (const k of C[2]) { const key = cellKey(i, j, k, d); (bucket.get(key) || bucket.set(key, []).get(key)).push(t); }
	}
	// whether point p (3 floats) is inside face t, in its plane
	const inside = (t, p) => {
		const o = t * 13, ax = tri[o], ay = tri[o + 1], az = tri[o + 2];
		const e0 = [tri[o + 6] - ax, tri[o + 7] - ay, tri[o + 8] - az], e1 = [tri[o + 3] - ax, tri[o + 4] - ay, tri[o + 5] - az], e2 = [p[0] - ax, p[1] - ay, p[2] - az];
		const dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
		const d00 = dot(e0, e0), d01 = dot(e0, e1), d02 = dot(e0, e2), d11 = dot(e1, e1), d12 = dot(e1, e2), q = d00 * d11 - d01 * d01;
		if (q <= 0) return false;
		const u = (d11 * d02 - d01 * d12) / q, w = (d00 * d12 - d01 * d02) / q;
		return u > 0.01 && w > 0.01 && u + w < 0.99;
	};
	const mid = (t) => { const o = t * 13; return [(tri[o] + tri[o + 3] + tri[o + 6]) / 3, (tri[o + 1] + tri[o + 4] + tri[o + 7]) / 3, (tri[o + 2] + tri[o + 5] + tri[o + 8]) / 3]; };
	// Exporters may rotate a triangle's index order. It is still the same face,
	// not a trim layer to lift away from the body.
	const sameFace = (a, b) => {
		for (let shift = 0; shift < 3; shift++) {
			let same = true;
			for (let c = 0; c < 3 && same; c++) for (let k = 0; k < 3; k++) {
				if (Math.abs(tri[a * 13 + c * 3 + k] - tri[b * 13 + ((c + shift) % 3) * 3 + k]) >= 1e-4) { same = false; break; }
			}
			if (same) return true;
		}
		return false;
	};
	const up = new Uint8Array(n), drop = new Uint8Array(n), pairs = [];
	for (let t = 0; t < n; t++) {
		if (tri[t * 13 + 12] <= 0 || drop[t]) continue;
		const o = t * 13, ct = mid(t), dt = tri[o + 9] * ct[0] + tri[o + 10] * ct[1] + tri[o + 11] * ct[2];
		const ci = Math.round(tri[o + 9] * 8), cj = Math.round(tri[o + 10] * 8), ck = Math.round(tri[o + 11] * 8), d = dOf(t);
		for (let e = -1; e <= 1; e++) for (const s of bucket.get(cellKey(ci, cj, ck, d + e)) || []) {
			if (s <= t || drop[s]) continue;
			const q = s * 13;
			if (tri[o + 9] * tri[q + 9] + tri[o + 10] * tri[q + 10] + tri[o + 11] * tri[q + 11] < 0.9986) continue;
			const cs = mid(s);
			if (!inside(t, cs) && !inside(s, ct)) continue;
			const sep = tri[o + 9] * cs[0] + tri[o + 10] * cs[1] + tri[o + 11] * cs[2] - dt;
			if (Math.abs(sep) > near) continue;
			const same = Math.abs(sep) < 1e-4 && sameFace(t, s);
			if (same) { drop[s] = 1; continue; }
			// the outer one is the layer; level with each other, the smaller
			const top = Math.abs(sep) > 1e-4 ? (sep > 0 ? s : t) : tri[q + 12] < tri[o + 12] ? s : t;
			pairs.push(top === s ? t : s, top);
		}
	}
	// a layer on a layer goes up a step further (up to three)
	for (let r = 0; r < 3; r++) for (let i = 0; i < pairs.length; i += 2) up[pairs[i + 1]] = Math.max(up[pairs[i + 1]], Math.min(3, up[pairs[i]] + 1));
	// the lifted faces get vertices of their own (the panel under them keeps its own)
	let lifted = 0, dropped = 0;
	const names = Object.keys(geo.attributes), extra = names.map(() => []), idx = [];
	let next = P.count;
	for (let t = 0; t < n; t++) {
		if (drop[t]) { dropped++; continue; }
		if (!up[t]) { idx.push(I.getX(t * 3), I.getX(t * 3 + 1), I.getX(t * 3 + 2)); continue; }
		lifted++;
		const o = t * 13;
		for (let c = 0; c < 3; c++) {
			const k = I.getX(t * 3 + c);
			names.forEach((nm, j) => {
				const A = geo.attributes[nm];
				for (let m = 0; m < A.itemSize; m++) extra[j].push(A.getComponent(k, m) + (nm === 'position' ? tri[o + 9 + m] * lift * up[t] : 0));
			});
			idx.push(next++);
		}
	}
	if (!lifted && !dropped) return { lifted, dropped };
	names.forEach((nm, j) => {
		const A = geo.attributes[nm], a = new Float32Array(A.count * A.itemSize + extra[j].length);
		for (let k = 0; k < A.count; k++) for (let m = 0; m < A.itemSize; m++) a[k * A.itemSize + m] = A.getComponent(k, m);
		a.set(extra[j], A.count * A.itemSize);
		geo.setAttribute(nm, new THREE.BufferAttribute(a, A.itemSize, A.normalized));
	});
	geo.setIndex(idx);
	geo.computeBoundingBox();
	geo.computeBoundingSphere();
	return { lifted, dropped };
}
