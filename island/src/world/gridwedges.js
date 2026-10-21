// The ground's camera-centred grids (world/terrain.js radialGrid and ringGrid) drawn as a middle
// and wedges round it, each its own draw the renderer leaves out when it is out of the view.
// A grid reaches all the way round you and a phone's view takes in a tenth of the circle: the
// rest was lifted, lit and clipped in the vertex shader every frame for nothing.
// The pieces share the grid's vertices (one copy on the graphics card); only the triangles are
// split. A wedge is tested by the convex hull of its own vertices, stood up over every height the
// ground can be lifted to, so a triangle that could show is never left out: whatever is drawn
// is drawn exactly as before, by any camera (the sea's mirror, a scope) and in any pass.

import * as THREE from 'three';

// the 2-D convex hull of points [x0, z0, x1, z1, ...], counter-clockwise, as a flat array
export function hull2(pts) {
	const n = pts.length / 2, ord = Array.from({ length: n }, (_, i) => i);
	ord.sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
	const cross = (o, a, b) => (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
	const lo = [], hi = [];
	for (const i of ord) { while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), i) <= 0) lo.pop(); lo.push(i); }
	for (let k = n - 1; k >= 0; k--) { const i = ord[k]; while (hi.length > 1 && cross(hi.at(-2), hi.at(-1), i) <= 0) hi.pop(); hi.push(i); }
	const h = lo.slice(0, -1).concat(hi.slice(0, -1)), out = new Float64Array(h.length * 2);
	h.forEach((i, k) => { out[k * 2] = pts[i * 2]; out[k * 2 + 1] = pts[i * 2 + 1]; });
	return out;
}

// Splits a square grid's triangles (its vertices n x n, row by row) into a middle block, every
// triangle with all three corners within mid of the centre on both axes, and `wedges` wedges by
// the bearing of each other triangle's centre. Each piece: its triangles' indices and the hull of
// its vertices (from each row only the outermost two count: a grid's rows are straight).
export function splitGrid(geo, wedges, mid) {
	const P = geo.attributes.position.array, I = geo.index.array, nv = P.length / 3, n = Math.round(Math.sqrt(nv));
	const parts = Array.from({ length: wedges + 1 }, () => ({ tris: [], lo: new Int32Array(n).fill(-1), hi: new Int32Array(n).fill(-1) }));
	const inMid = (v) => Math.abs(P[v * 3]) <= mid && Math.abs(P[v * 3 + 2]) <= mid;
	for (let t = 0; t < I.length; t += 3) {
		const a = I[t], b = I[t + 1], c = I[t + 2];
		let k = 0;
		if (!(inMid(a) && inMid(b) && inMid(c))) {
			const x = P[a * 3] + P[b * 3] + P[c * 3], z = P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2];
			k = 1 + Math.min(wedges - 1, Math.floor((Math.atan2(z, x) + Math.PI) / (2 * Math.PI) * wedges));
		}
		const S = parts[k];
		S.tris.push(a, b, c);
		for (const v of [a, b, c]) { const r = Math.floor(v / n); if (S.lo[r] < 0 || P[v * 3] < P[S.lo[r] * 3]) S.lo[r] = v; if (S.hi[r] < 0 || P[v * 3] > P[S.hi[r] * 3]) S.hi[r] = v; }
	}
	return parts.filter((S) => S.tris.length).map((S, k) => {
		const pts = [];
		for (let r = 0; r < n; r++) for (const v of [S.lo[r], S.hi[r]]) if (v >= 0) pts.push(P[v * 3], P[v * 3 + 2]);
		return { mid: k === 0 && parts[0].tris.length > 0, index: nv > 65535 ? new Uint32Array(S.tris) : new Uint16Array(S.tris), hull: boundHull(hull2(pts)) };
	});
}

// a convex hull cut down to at most k corners by its supporting lines in k even directions:
// the polygon they bound holds the whole hull (a little larger, never smaller)
export function boundHull(h, k = 16) {
	if (h.length / 2 <= k) return h;
	const L = [];
	for (let i = 0; i < k; i++) {
		const a = (i / k) * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
		let s = -Infinity;
		for (let j = 0; j < h.length; j += 2) s = Math.max(s, h[j] * ux + h[j + 1] * uz);
		L.push([ux, uz, s]);
	}
	const out = new Float64Array(k * 2);
	for (let i = 0; i < k; i++) {
		const [a1, b1, c1] = L[i], [a2, b2, c2] = L[(i + 1) % k], det = a1 * b2 - a2 * b1;
		out[i * 2] = (c1 * b2 - c2 * b1) / det; out[i * 2 + 1] = (a1 * c2 - a2 * c1) / det;
	}
	return out;
}

// The view's footprint on the ground: the frustum cut to the heights yLo..yHi, seen from above,
// as a convex polygon. (Its corners are where three of its planes meet; three's planes come as
// right, left, bottom, top, far, near.)
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _corner = [];
for (let i = 0; i < 8; i++) _corner.push(new THREE.Vector3());
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
function meet(p1, p2, p3, out) {
	const n1 = p1.normal, n2 = p2.normal, n3 = p3.normal;
	_A.crossVectors(n2, n3); const det = n1.dot(_A);
	if (Math.abs(det) < 1e-12) return false;
	out.copy(_A).multiplyScalar(-p1.constant);
	out.add(_B.crossVectors(n3, n1).multiplyScalar(-p2.constant));
	out.add(_B.crossVectors(n1, n2).multiplyScalar(-p3.constant));
	out.divideScalar(det);
	return true;
}
export function footprint(planes, yLo, yHi) {
	const P = planes, pts = [];
	for (let i = 0; i < 8; i++) if (!meet(P[i & 1], P[2 + ((i >> 1) & 1)], P[4 + ((i >> 2) & 1)], _corner[i])) return null;
	for (const c of _corner) if (c.y >= yLo && c.y <= yHi) pts.push(c.x, c.z);
	for (const [i, j] of EDGES) {
		const a = _corner[i], b = _corner[j];
		for (const y of [yLo, yHi]) if ((a.y - y) * (b.y - y) < 0) { const t = (y - a.y) / (b.y - a.y); pts.push(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t); }
	}
	return pts.length ? hull2(pts) : new Float64Array(0);
}

// whether two convex polygons (flat [x, z, ...] arrays) are apart: some edge of either separates them.
// pad: A grown by a square pad either side (a vertex the shader moves sideways by up to pad),
// tested along the square's own edges too
export function polysApart(A, ax, az, B, pad = 0) {
	const span = (Q, ox, oz, nx, nz) => { let lo = Infinity, hi = -Infinity; for (let k = 0; k < Q.length; k += 2) { const d = (Q[k] + ox) * nx + (Q[k + 1] + oz) * nz; if (d < lo) lo = d; if (d > hi) hi = d; } return [lo, hi]; };
	const apart = (nx, nz) => {
		const [a0, a1] = span(A, ax, az, nx, nz), [b0, b1] = span(B, 0, 0, nx, nz), g = pad * (Math.abs(nx) + Math.abs(nz));
		return a1 + g < b0 || b1 < a0 - g;
	};
	for (const [Q, qx, qz] of [[A, ax, az], [B, 0, 0]]) {
		const n = Q.length / 2;
		if (n < 2) continue;
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			if (apart(Q[j * 2 + 1] - Q[i * 2 + 1], Q[i * 2] - Q[j * 2])) return true;
		}
	}
	return pad > 0 && (apart(1, 0) || apart(0, 1));
}

// true when the hull (in the mesh's own x, z, moved by ox, oz, and grown by pad), stood from yLo
// to yHi, has no point inside the frustum
export function hullOut(hull, ox, oz, yLo, yHi, planes, pad = 0) {
	const F = footprint(planes, yLo, yHi);
	if (!F) return false;
	if (!F.length) return true;
	return polysApart(hull, ox, oz, F, pad);
}

// The grid as meshes under one group: the middle always drawn, the wedges each culled by the
// view. y: [lowest, highest] the vertex shader can lift the ground to (or a function giving it
// now); pad: how far it can move a vertex sideways (m, or a function); at: where the shader
// itself centres the grid (a Vector2 it adds to x, z, read as the view is drawn: the sea's)
export function wedgeMeshes(geo, material, { wedges = 8, mid, y, pad = 0, at = null }) {
	const root = new THREE.Group(), meshes = [];
	for (const S of splitGrid(geo, wedges, mid)) {
		const g = new THREE.BufferGeometry();
		for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
		g.setIndex(new THREE.BufferAttribute(S.index, 1));
		g.boundingSphere = geo.boundingSphere;
		const m = new THREE.Mesh(g, material);
		if (S.mid) m.frustumCulled = false;
		else {
			// (only moved, never turned or scaled: anything else is drawn, never wrongly left out)
			m.intersectsFrustum = (f) => {
				const e = m.matrixWorld.elements;
				if (e[0] !== 1 || e[5] !== 1 || e[10] !== 1 || e[1] || e[2] || e[4] || e[6] || e[8] || e[9]) return true;
				const Y = typeof y === 'function' ? y() : y, p = typeof pad === 'function' ? pad() : pad;
				return !hullOut(S.hull, e[12] + (at ? at.x : 0), e[14] + (at ? at.y : 0), Y[0] + e[13], Y[1] + e[13], f.planes, p);
			};
		}
		root.add(m); meshes.push(m);
	}
	return { root, meshes };
}
