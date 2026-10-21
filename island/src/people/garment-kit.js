// The cut pieces that stand off a garment: a hoodie's hood lying in folds on the shoulders and
// down the back, its drawstrings; a shirt's or a polo's collar, its stand and fall and points;
// and a plate carrier made to the wearer (plates that follow the chest and back, a cummerbund
// round the waist, straps over the shoulders, pouches sitting on the plate). Each is laid on
// the dressed body as it stands at rest (the cloth mesh's own surface: torsoField and
// necklineRing), so nothing floats off the chest. Geometry only; garment.js colours them and
// binds each to its bone in the accessory mesh.

import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The dressed torso as a height field, front and back: for a point (x, y) of the body's front
// view, how far forward the clothes come (front) and how far back (back), from rest-pose
// points (flat x, y, z: clothPoints) of the cloth's body panels and the bare torso. Cells nobody covers take their row's
// nearest neighbour, and the whole is smoothed once.
export function torsoField(cut, points) {
	const STEP = 0.016, x0 = -0.34, nx = 43, y0 = cut.waist - 0.22, y1 = cut.neck + 0.08, ny = Math.ceil((y1 - y0) / STEP) + 1;
	const F = new Float32Array(nx * ny).fill(-1e9), B = new Float32Array(nx * ny).fill(1e9), W = new Float32Array(ny);
	for (let q = 0; q < points.length; q += 3) {
		const x = points[q], y = points[q + 1], z = points[q + 2];
		const i = Math.round((x - x0) / STEP), j = Math.round((y - y0) / STEP);
		if (i < 0 || i >= nx || j < 0 || j >= ny) continue;
		const k = j * nx + i;
		if (z > F[k]) F[k] = z;
		if (z < B[k]) B[k] = z;
		W[j] = Math.max(W[j], Math.abs(x));
	}
	// (gaps: the nearest filled cell along the row, then down the column)
	for (const A of [F, B]) {
		for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
			const k = j * nx + i;
			if (Math.abs(A[k]) < 1e8) continue;
			for (let d = 1; d < nx; d++) {
				const l = i - d >= 0 ? A[k - d] : NaN, r = i + d < nx ? A[k + d] : NaN;
				if (Math.abs(l) < 1e8) { A[k] = l; break; }
				if (Math.abs(r) < 1e8) { A[k] = r; break; }
			}
		}
		for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
			const k = j * nx + i;
			if (Math.abs(A[k]) < 1e8) continue;
			for (let d = 1; d < ny; d++) {
				if (j - d >= 0 && Math.abs(A[k - d * nx]) < 1e8) { A[k] = A[k - d * nx]; break; }
				if (j + d < ny && Math.abs(A[k + d * nx]) < 1e8) { A[k] = A[k + d * nx]; break; }
			}
			if (Math.abs(A[k]) > 1e8) A[k] = A === F ? cut.frontZ : cut.backZ;
		}
		const S = Float32Array.from(A);
		for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
			const k = j * nx + i;
			A[k] = S[k] * 0.4 + (S[k - 1] + S[k + 1] + S[k - nx] + S[k + nx]) * 0.15;
		}
	}
	const at = (A, x, y) => {
		const fx = clamp((x - x0) / STEP, 0, nx - 1.001), fy = clamp((y - y0) / STEP, 0, ny - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * nx + i;
		return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + nx] * (1 - u) + A[k + nx + 1] * u) * v;
	};
	return { front: (x, y) => at(F, x, y), back: (x, y) => at(B, x, y), half: (y) => W[clamp(Math.round((y - y0) / STEP), 0, ny - 1)] || cut.waistX };
}

// The rest-pose points (flat x, y, z) of a cloth geometry's torso panels (top and layer),
// and of a body's own torso, for torsoField
export function clothPoints(geo, body = null, part = null) {
	let n = 0;
	const p = geo?.attributes.position, s = geo?.attributes.slot;
	if (geo) for (let i = 0; i < p.count; i++) { const v = s.getX(i); if (v % 10 < 1.5 && v < 10) n++; }
	if (body && part) for (let i = 0; i < part.length; i++) if (part[i] === 0) n++;
	const out = new Float32Array(n * 3);
	let k = 0;
	if (geo) for (let i = 0; i < p.count; i++) { const v = s.getX(i); if (v % 10 < 1.5 && v < 10) { out[k++] = p.getX(i); out[k++] = p.getY(i); out[k++] = p.getZ(i); } }
	if (body && part) for (let i = 0; i < part.length; i++) if (part[i] === 0) { out[k++] = body[i * 3]; out[k++] = body[i * 3 + 1]; out[k++] = body[i * 3 + 2]; }
	return out;
}

// The neckline of a top: n points round it (angle 0 at the back, plus to the left), from the
// cloth's own neck edge (its highest torso vertices at each angle), or an ellipse
export function necklineRing(geo, cut, n = 24) {
	const zc = (cut.frontZ + cut.backZ) / 2 - 0.012, best = Array.from({ length: n }, () => null);
	if (geo) {
		const p = geo.attributes.position, s = geo.attributes.slot;
		for (let i = 0; i < p.count; i++) {
			const v = s.getX(i);
			if (v >= 10 || v % 10 > 1.5) continue;
			const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
			if (y < cut.neck - 0.06) continue;
			const a = Math.atan2(x, zc - z), k = ((Math.round(a / (Math.PI * 2) * n) % n) + n) % n;
			if (!best[k] || y > best[k][1]) best[k] = [x, y, z];
		}
	}
	const ring = [];
	for (let k = 0; k < n; k++) {
		const a = k / n * Math.PI * 2, b = best[k];
		if (b) ring.push(V(...b));
		else ring.push(V(Math.sin(a) * 0.085, cut.neck + 0.03 * smooth(Math.abs(Math.sin(a))), zc - Math.cos(a) * 0.07));
	}
	// (smoothed round the ring)
	return ring.map((p, k) => p.clone().multiplyScalar(0.5).addScaledVector(ring[(k + 1) % n], 0.25).addScaledVector(ring[(k + n - 1) % n], 0.25));
}
// a point on the ring at angle a (radians, 0 at the back), between its samples
function ringAt(ring, a) {
	const n = ring.length, f = ((a / (Math.PI * 2)) * n % n + n) % n, i = Math.floor(f), u = f - i;
	return ring[i].clone().lerp(ring[(i + 1) % n], u);
}
// a lofted surface: rows of points (each row a curve across, rows in order down the piece)
function loft(rows, flip = false) {
	const g = new THREE.BufferGeometry(), nu = rows[0].length, pos = [];
	for (const r of rows) for (const p of r) pos.push(p.x, p.y, p.z);
	const idx = [];
	for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + nu; if (flip) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1); }
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
	return g;
}
const cr = (p0, p1, p2, p3, t) => {
	const t2 = t * t, t3 = t2 * t;
	return p1.clone().multiplyScalar(2).add(p2.clone().sub(p0).multiplyScalar(t)).add(p0.clone().multiplyScalar(2).sub(p1.clone().multiplyScalar(5)).add(p2.clone().multiplyScalar(4)).sub(p3).multiplyScalar(t2)).add(p1.clone().multiplyScalar(3).sub(p0).sub(p2.clone().multiplyScalar(3)).add(p3).multiplyScalar(t3)).multiplyScalar(0.5);
};
// points along a Catmull-Rom spline through ctrl, m samples
function spline(ctrl, m) {
	const out = [], n = ctrl.length - 1;
	for (let s = 0; s <= m; s++) {
		const f = s / m * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
		out.push(cr(ctrl[Math.max(0, i - 1)], ctrl[i], ctrl[i + 1], ctrl[Math.min(n, i + 2)], t));
	}
	return out;
}

// A hood down: its opening rolled round the neck, the crown lying in a soft fold down the
// upper back, a little loft between; and the two drawstrings with their tips. lo: fewer
// segments (a phone or a crowd).
export function hoodGeometry(cut, field, ring, { lo = false } = {}) {
	// (enough segments round the neck and down the fold that up close it reads as soft cloth,
	// not flat panels)
	const nu = lo ? 18 : 32, nv = lo ? 7 : 12, aMax = 2.45, zc = (cut.frontZ + cut.backZ) / 2;
	const rows = [];
	const cols = [];
	for (let i = 0; i <= nu; i++) {
		const a = (i / nu * 2 - 1) * aMax, S = ringAt(ring, a), out = V(S.x, 0, S.z - zc).normalize();
		S.addScaledVector(out, 0.004);
		const R = S.clone().addScaledVector(out, 0.024).add(V(0, 0.022, 0));
		const depth = 0.21 * Math.pow(Math.cos(a / aMax * Math.PI / 2), 0.8);
		const ex = Math.sin(a) * (0.1 + 0.05 * (1 - Math.abs(a) / aMax)), ey = S.y + 0.015 - depth;
		const E = V(ex, ey, Math.min(field.back(ex, ey), S.z) - 0.013);
		const mid = R.clone().lerp(E, 0.42).addScaledVector(V(0, 0.25, -1).normalize(), 0.042 * depth / 0.21);
		// (toward its front ends the hood thins away to only the roll: eased there column by
		// column, never switched, which crumpled the last of it into a hard flat flap)
		const k = smooth(depth / 0.07);
		const ctrl = [S, R, R.clone().add(V(0, -0.005, 0)).lerp(mid, k), R.clone().add(V(0, -0.01, 0)).lerp(E, k)];
		cols.push(spline(ctrl, nv));
	}
	for (let j = 0; j <= nv; j++) rows.push(cols.map((c) => c[j]));
	const hood = loft(rows, true);
	// the opening's edge, turned and doubled: a soft roll round the neck
	const roll = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cols.map((c) => c[Math.round(nv * 0.25)])), lo ? 16 : 32, 0.011, lo ? 6 : 10, false);
	// the drawstrings: from the front ends of the hood, hanging down the chest
	const strings = [];
	for (const s of [-1, 1]) {
		const S = ringAt(ring, s * (aMax + 0.12)), front = Math.max(S.z, field.front(S.x * 0.6, S.y - 0.05)) + 0.012;
		const pts = [V(S.x * 0.75, S.y + 0.01, S.z + 0.01), V(S.x * 0.6, S.y - 0.06, front + 0.004), V(S.x * 0.55 + s * 0.004, S.y - 0.17, field.front(S.x * 0.55, S.y - 0.17) + 0.009)];
		strings.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), lo ? 6 : 10, 0.0032, lo ? 4 : 6, false));
		const tip = new THREE.CylinderGeometry(0.0038, 0.0034, 0.02, lo ? 5 : 8); tip.translate(pts[2].x, pts[2].y - 0.008, pts[2].z); strings.push(tip);
	}
	return { hood, roll, strings };
}

// A collar: the stand up round the neck, folded at its top and laid down over the shoulders,
// with points at the front (a polo's softer and shorter)
// (out: further out, for an overshirt worn over another top; open: worn open, the collar's
// ends running down the opening at the front, spread a little, as an open shirt's lie)
export function collarGeometry(cut, ring, { polo = false, lo = false, out: further = 0, open = false } = {}) {
	const nu = lo ? 14 : 24, aMax = 2.9, zc = (cut.frontZ + cut.backZ) / 2 - 0.012, cols = [];
	const stand = polo ? 0.022 : 0.027, fall = polo ? 0.03 : 0.036;
	for (let i = 0; i <= nu; i++) {
		const a = (i / nu * 2 - 1) * aMax, S = ringAt(ring, a), out = V(S.x, 0, S.z - zc).normalize();
		S.addScaledVector(out, 0.003 + further);
		if (open) { const f = smooth((Math.abs(a) - 2.25) / 0.65); S.add(V(Math.sign(S.x) * 0.012 * f, -0.045 * f, 0.004 * f)); }
		const T = S.clone().add(V(0, stand, 0)).addScaledVector(out, -0.002);
		const fold = T.clone().addScaledVector(out, 0.006).add(V(0, 0.002, 0));
		const point = smooth((Math.abs(a) - 2.15) / 0.75) * (polo ? 0.6 : 1);
		// (an open collar's points lie down on the chest, spread to the sides, not out from it)
		const lie = open ? point : 0;
		const Fe = S.clone().addScaledVector(out, fall * 0.55 * (1 - 0.65 * lie) + 0.012 * point * (1 - lie)).add(V(Math.sign(S.x) * 0.014 * lie, 0.004 - 0.032 * point - 0.012 * lie, 0));
		cols.push([S, T, fold, fold.clone().lerp(Fe, 0.5).addScaledVector(out, 0.004), Fe]);
	}
	const rows = [];
	for (let j = 0; j < 5; j++) rows.push(cols.map((c) => c[j]));
	return loft(rows);
}

// A padded slab laid on a surface: a grid of points (inner face, on the body) and their
// outward normals, given thickness; the outer face's edge drawn in a little so it reads as a
// rounded edge. Returns one geometry (outer face, inner face, the rim between).
function slab(grid, normals, thick, bevel = 0.006) {
	const rows = grid.length, colsN = grid[0].length, pos = [], idx = [];
	const push = (p) => { pos.push(p.x, p.y, p.z); return pos.length / 3 - 1; };
	const outer = [], inner = [];
	for (let j = 0; j < rows; j++) {
		outer.push([]); inner.push([]);
		for (let i = 0; i < colsN; i++) {
			const p = grid[j][i], n = normals[j][i];
			const edge = j === 0 || j === rows - 1 || i === 0 || i === colsN - 1;
			let o = p.clone().addScaledVector(n, thick);
			if (edge) {
				// (the outer face's border pulled in toward the slab's middle and down a little)
				const c = grid[Math.floor(rows / 2)][Math.floor(colsN / 2)];
				const toC = c.clone().sub(p); toC.addScaledVector(n, -toC.dot(n)); if (toC.lengthSq() > 1e-8) toC.normalize();
				o = p.clone().addScaledVector(n, thick * 0.75).addScaledVector(toC, bevel);
			}
			outer[j].push(push(o)); inner[j].push(push(p));
		}
	}
	for (let j = 0; j < rows - 1; j++) for (let i = 0; i < colsN - 1; i++) {
		const a = outer[j][i], b = outer[j + 1][i], c = outer[j][i + 1], d = outer[j + 1][i + 1];
		idx.push(a, c, b, c, d, b);
		const e = inner[j][i], f = inner[j + 1][i], g = inner[j][i + 1], h = inner[j + 1][i + 1];
		idx.push(e, f, g, g, f, h);
	}
	// the rim: the border's outer and inner points joined
	const border = [];
	for (let i = 0; i < colsN; i++) border.push([0, i]);
	for (let j = 1; j < rows; j++) border.push([j, colsN - 1]);
	for (let i = colsN - 2; i >= 0; i--) border.push([rows - 1, i]);
	for (let j = rows - 2; j > 0; j--) border.push([j, 0]);
	for (let k = 0; k < border.length; k++) {
		const [j0, i0] = border[k], [j1, i1] = border[(k + 1) % border.length];
		const a = outer[j0][i0], b = outer[j1][i1], c = inner[j0][i0], d = inner[j1][i1];
		idx.push(a, c, b, b, c, d);
	}
	// (wound so the outer face looks out along its normals: the kit's material shades a cloth's
	// back faces as its lining)
	const du = grid[0][1].clone().sub(grid[0][0]), dv = grid[1][0].clone().sub(grid[0][0]);
	if (new THREE.Vector3().crossVectors(du, dv).dot(normals[0][0]) < 0) for (let k = 0; k < idx.length; k += 3) { const s = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = s; }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
	return g;
}
// a rounded pouch standing on a surface point p with outward normal n, up along the body
function pouch(p, n, w, h, d, { flap = true, lo = false } = {}) {
	const up = V(0, 1, 0).addScaledVector(n, -n.y).normalize(), side = new THREE.Vector3().crossVectors(up, n).normalize();
	const m = new THREE.Matrix4().makeBasis(side, up, n).setPosition(p.clone().addScaledVector(n, d / 2));
	const body = new THREE.BoxGeometry(w, h, d, lo ? 1 : 2, lo ? 1 : 2, 1);
	// (its front and sides bowed a little: a filled pouch, not a box)
	const pa = body.attributes.position;
	for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) / (w / 2), y = pa.getY(i) / (h / 2), z = pa.getZ(i); if (z > 0) pa.setZ(i, z * (1 - 0.25 * (x * x * 0.5 + y * y * 0.3))); pa.setX(i, pa.getX(i) * (1 - 0.06 * Math.max(0, z / (d / 2)))); }
	body.applyMatrix4(m);
	const out = [body];
	if (flap) {
		const f = new THREE.BoxGeometry(w * 1.04, h * 0.28, d * 1.08);
		f.translate(0, h * 0.37, d * 0.04); f.applyMatrix4(m); out.push(f);
	}
	return out;
}

// A plate carrier made to the wearer: the front and back plates following the chest and back
// a little off the clothes, a cummerbund round the waist joining them, the shoulder straps up
// over the shoulders, the pouches on the front (a police vest: a radio on the strap instead,
// and a reflective band). Pieces as { geo, part: 'plate'|'band'|'strap'|'pouch'|'flap'|'tape' }.
// (compact: a low-profile carrier, as a hero wears one: shorter, ending above the belt so the
// waist shows below it, its top cut down round the neck and clipped at the corners, webbing
// across front and back, a drag handle, the straps lying along the shoulders)
export function carrierGeometry(cut, field, { police = false, lo = false, compact = false } = {}) {
	const t = cut.chest + (compact ? 0.095 : 0.12), b = cut.waist + (compact ? 0.065 : 0.005), w = Math.min(compact ? 0.32 : 0.33, cut.shoulderX * 1.6), clear = 0.012, thick = compact ? 0.02 : 0.024;
	const nx = lo ? 4 : compact ? 9 : 7, ny = lo ? 3 : compact ? 8 : 6, out = [];
	// (the top edge: straight, or scooped round the neck and clipped at the corners)
	const topAt = (x, half) => compact ? t - 0.04 * Math.max(0, 1 - (x / (half * 0.55)) ** 2) - 0.025 * smooth((Math.abs(x) / half - 0.72) / 0.28) : t;
	const plate = (front) => {
		// A plate is stiff: a gently curved panel resting on the most prominent part of the chest
		// or back (row by row, the furthest point, carried a little up and down so it does not
		// dip into hollows), never following every bulge; it stays clear of the clothes everywhere.
		const sgn = front ? 1 : -1, surf = (x, y) => sgn * (front ? field.front(x, y) : field.back(x, y));
		const ys = [], halves = [], rowMax = [];
		const yAt = (j, x, half) => b + ((front ? topAt(x, half) : t) - b) * j / ny;
		for (let j = 0; j <= ny; j++) {
			const half = w / 2 * (1 - (compact ? 0.1 : 0.18) * smooth((j / ny - 0.7) / 0.3));
			let m = -1e9;
			for (let i = 0; i <= nx; i++) { const x = -half + 2 * half * i / nx; m = Math.max(m, surf(x, yAt(j, x, half)) + 1.4 * x * x); }
			ys.push(b + (t - b) * j / ny); halves.push(half); rowMax.push(m);
		}
		const env = rowMax.map((m, j) => Math.max(m, ((rowMax[j - 1] ?? m) + (rowMax[j + 1] ?? m)) / 2 - 0.004));
		const grid = [], normals = [];
		for (let j = 0; j <= ny; j++) {
			const row = [];
			for (let i = 0; i <= nx; i++) {
				const x = -halves[j] + 2 * halves[j] * i / nx, y = yAt(j, x, halves[j]);
				row.push(V(x, y, sgn * (Math.max(surf(x, y), env[j] - 1.4 * x * x) + clear)));
			}
			grid.push(row);
		}
		// normals from the panel itself
		for (let j = 0; j <= ny; j++) {
			const nrow = [];
			for (let i = 0; i <= nx; i++) {
				const dx = grid[j][Math.min(nx, i + 1)].clone().sub(grid[j][Math.max(0, i - 1)]), dy = grid[Math.min(ny, j + 1)][i].clone().sub(grid[Math.max(0, j - 1)][i]);
				const n = new THREE.Vector3().crossVectors(dx, dy).normalize();
				nrow.push(n.z * sgn < 0 ? n.multiplyScalar(-1) : n);
			}
			normals.push(nrow);
		}
		return { geo: slab(grid, normals, thick), grid, normals };
	};
	const F = plate(true), B = plate(false);
	out.push({ geo: F.geo, part: 'plate' }, { geo: B.geo, part: 'plate' });
	// the cummerbund: a band round the waist from plate to plate, around the sides
	const y0 = b + 0.005, y1 = b + (compact ? 0.1 : 0.12), seg = lo ? 10 : 18, band = [[], []], bn = [[], []];
	for (let k = 0; k <= seg; k++) {
		for (const [r, y] of [[0, y0], [1, y1]]) {
			const zc = (field.front(0, y) + field.back(0, y)) / 2, rz = (field.front(0, y) - field.back(0, y)) / 2 + clear * 0.6, rx = field.half(y) + 0.005;
			const a = k / seg * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
			// (one side: from under the front plate round to under the back's, superelliptic)
			const p = V(rx * Math.pow(sa, 0.7), y, zc + rz * Math.sign(ca) * Math.pow(Math.abs(ca), 0.7));
			band[r].push(p); bn[r].push(V(p.x, 0, p.z - zc).normalize());
		}
	}
	for (const sd of [1, -1]) {
		const grid = [band[0].map((p) => V(p.x * sd, p.y, p.z)), band[1].map((p) => V(p.x * sd, p.y, p.z))];
		const nor = [bn[0].map((n) => V(n.x * sd, n.y, n.z)), bn[1].map((n) => V(n.x * sd, n.y, n.z))];
		out.push({ geo: slab(grid, nor, 0.008, 0.002), part: 'band' });
	}
	// the shoulder straps: from the front plate's top over the shoulder to the back's
	for (const sd of [-1, 1]) {
		// (over the top of the shoulder where it lies: the trapezius falls from the neck's base
		// to a little above the shoulder's joint)
		const x = sd * w * 0.3, top = compact ? cut.neck + 0.004 - (cut.neck + 0.004 - (cut.shoulder + 0.045)) * smooth((Math.abs(x) - 0.045) / Math.max(0.05, cut.shoulderX - 0.045)) - 0.008 : cut.neck + 0.02 + 0.02 * smooth(Math.abs(x) / 0.12);
		const fz = field.front(x, t) + clear, bz = field.back(x, t) - clear, mz = (fz + bz) / 2;
		const pts = spline([V(x, t - 0.02, fz + 0.01), V(x, (t + top) / 2 + 0.01, fz - 0.005), V(x * 1.05, top + 0.012, mz), V(x, (t + top) / 2 + 0.01, bz + 0.005), V(x, t - 0.02, bz - 0.01)], lo ? 6 : 12);
		const grid = [], nor = [];
		for (let k = 0; k < pts.length; k++) {
			const p = pts[k], tan = (pts[Math.min(pts.length - 1, k + 1)].clone().sub(pts[Math.max(0, k - 1)])).normalize();
			const across = V(1, 0, 0), n = new THREE.Vector3().crossVectors(tan, across).normalize();
			if (n.dot(V(0, p.y - cut.chest, p.z - mz)) < 0) n.multiplyScalar(-1);
			grid.push([p.clone().addScaledVector(across, -0.026), p.clone().addScaledVector(across, 0.026)]);
			nor.push([n, n]);
		}
		const g = [], nn = [];
		for (let i = 0; i < 2; i++) { g.push(grid.map((r) => r[i])); nn.push(nor.map((r) => r[i])); }
		out.push({ geo: slab(g, nn, 0.009, 0.003), part: 'strap' });
	}
	// what sits on the front plate
	const onPlate = (u, v) => {
		const j = Math.round(v * ny), i = Math.round(u * nx);
		return { p: F.grid[j][i].clone().addScaledVector(F.normals[j][i], thick * 0.85), n: F.normals[j][i] };
	};
	// (a point of a plate's outer face, between its grid points)
	const surfAt = (Pl, u, v) => {
		const fj = clamp(v, 0, 1) * ny, fi = clamp(u, 0, 1) * nx, j0 = Math.min(ny - 1, Math.floor(fj)), i0 = Math.min(nx - 1, Math.floor(fi)), jv = fj - j0, iu = fi - i0;
		const g = Pl.grid, nn = Pl.normals, mix = (A) => A[j0][i0].clone().lerp(A[j0][i0 + 1], iu).lerp(A[j0 + 1][i0].clone().lerp(A[j0 + 1][i0 + 1], iu), jv);
		const n = mix(nn).normalize();
		return { p: mix(g).addScaledVector(n, thick), n };
	};
	// webbing: strips across a plate at heights v (from u0 to u1), each an inch wide
	const webbing = (Pl, vs, u0 = 0.07, u1 = 0.93) => {
		for (const v of vs) {
			const rows = [[], []], nr = [[], []], dv = 0.026 / Math.max(0.05, t - b);
			for (let i = 0; i <= 10; i++) for (const [r, vv] of [[0, v - dv / 2], [1, v + dv / 2]]) { const q = surfAt(Pl, u0 + (u1 - u0) * i / 10, vv); rows[r].push(q.p.addScaledVector(q.n, 0.0008)); nr[r].push(q.n); }
			out.push({ geo: slab(rows, nr, 0.0028, 0.0006), part: 'web' });
		}
	};
	if (compact) {
		// webbing over the front's upper part and over the whole back; three flat pouches low on
		// the front; a patch for a name or a flag on the chest; a handle at the back's top
		webbing(F, [0.5, 0.62, 0.74]);
		webbing(B, [0.18, 0.32, 0.46, 0.6, 0.74]);
		for (let i = -1; i <= 1; i++) {
			const q = onPlate(0.5 + i * 0.29, 0.2);
			for (const [k, g] of pouch(q.p, q.n, 0.068, 0.095, 0.02, { lo }).entries()) out.push({ geo: g, part: k ? 'flap' : 'pouch' });
		}
		const pc = surfAt(F, 0.5, 0.86), up = V(0, 1, 0).addScaledVector(pc.n, -pc.n.y).normalize(), across = new THREE.Vector3().crossVectors(up, pc.n).normalize();
		const patch = [[], []], pn = [[], []];
		for (let i = 0; i <= 2; i++) for (const r of [0, 1]) { patch[r].push(pc.p.clone().addScaledVector(across, (i / 2 - 0.5) * 0.085).addScaledVector(up, (r - 0.5) * 0.05).addScaledVector(pc.n, 0.001)); pn[r].push(pc.n); }
		out.push({ geo: slab(patch, pn, 0.002, 0.0006), part: 'patch' });
		const hp = surfAt(B, 0.5, 0.97), hpts = spline([hp.p.clone().add(V(-0.035, -0.006, 0)), hp.p.clone().add(V(-0.02, 0.022, -0.006)), hp.p.clone().add(V(0.02, 0.022, -0.006)), hp.p.clone().add(V(0.035, -0.006, 0))], lo ? 4 : 8);
		const hg = [hpts.map((p) => p.clone().add(V(0, 0, 0.004))), hpts.map((p) => p.clone().add(V(0, 0, -0.004)))], hn = [hpts.map(() => V(0, 1, 0)), hpts.map(() => V(0, 1, 0))];
		out.push({ geo: slab(hg, hn, 0.004, 0.001), part: 'web' });
		return out;
	}
	if (police) {
		// a radio on the left strap, a reflective band across the chest
		const r = onPlate(0.8, 0.86);
		for (const [k, g] of pouch(r.p, r.n, 0.05, 0.085, 0.03, { flap: false, lo }).entries()) out.push({ geo: g, part: k ? 'flap' : 'pouch' });
		const tape = [], tn = [];
		for (const v of [0.56, 0.66]) {
			const row = [], nrow = [];
			for (let i = 0; i <= nx; i++) { const j = v * ny, j0 = Math.floor(j), jf = j - j0; const p = F.grid[j0][i].clone().lerp(F.grid[j0 + 1][i], jf), n = F.normals[j0][i]; row.push(p.addScaledVector(n, thick + 0.0015)); nrow.push(n); }
			tape.push(row); tn.push(nrow);
		}
		out.push({ geo: slab(tape, tn, 0.002, 0.0005), part: 'tape' });
	} else {
		for (let i = -1; i <= 1; i++) {
			const q = onPlate(0.5 + i * 0.27, 0.22);
			for (const [k, g] of pouch(q.p, q.n, 0.072, 0.11, 0.034, { lo }).entries()) out.push({ geo: g, part: k ? 'flap' : 'pouch' });
		}
		const a = onPlate(0.78, 0.78);
		for (const [k, g] of pouch(a.p, a.n, 0.05, 0.075, 0.03, { lo }).entries()) out.push({ geo: g, part: k ? 'flap' : 'pouch' });
		const c = onPlate(0.3, 0.72);
		for (const [k, g] of pouch(c.p, c.n, 0.09, 0.06, 0.022, { lo }).entries()) out.push({ geo: g, part: k ? 'flap' : 'pouch' });
	}
	return out;
}

// ---------- boots, a belt, cargo pockets: built, not painted ----------

// the convex hull of points in a plane (monotone chain), counter-clockwise
function hull2(pts) {
	const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (P.length < 3) return P;
	const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lo = [], up = [];
	for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
	for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
	up.pop(); lo.pop();
	return lo.concat(up);
}
// rings of an outline at given heights (each ring's height per point: y(i)), walled between,
// the bottom closed
function prism(ring, ys, close = true) {
	const n = ring.length, pos = [], idx = [];
	for (const y of ys) for (let i = 0; i < n; i++) pos.push(ring[i][0], typeof y === 'function' ? y(i) : y, ring[i][1]);
	for (let r = 0; r < ys.length - 1; r++) for (let i = 0; i < n; i++) { const a = r * n + i, b = r * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, b, c, b, d, c); }
	if (close) { const c = pos.length / 3; let x = 0, z = 0, y = 0; for (let i = 0; i < n; i++) { x += ring[i][0]; z += ring[i][1]; y += pos[i * 3 + 1]; } pos.push(x / n, y / n, z / n); for (let i = 0; i < n; i++) idx.push(c, (i + 1) % n, i); }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
	return g;
}
// a convex outline (counter-clockwise in x, z) pushed out by e along its own normals
function grow(h, e) {
	const n = h.length, out = [];
	const nrm = (dx, dz) => { const l = Math.hypot(dx, dz) || 1; return [dz / l, -dx / l]; };
	for (let i = 0; i < n; i++) {
		const a = h[(i + n - 1) % n], b = h[i], c = h[(i + 1) % n];
		const n1 = nrm(b[0] - a[0], b[1] - a[1]), n2 = nrm(c[0] - b[0], c[1] - b[1]);
		let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
		const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
		const k = e / Math.max(0.5, mx * n1[0] + mz * n1[1]);
		out.push([b[0] + mx * k, b[1] + mz * k]);
	}
	return out;
}
// a closed outline resampled to n points evenly along it, from where it crosses the line ahead
// of its middle (x = its centre, z most forward) and on round the same way: so the rings of a
// loft line up front to front and back to back, however their shapes differ
function ringFrom(h, n) {
	const m = h.length, cx = h.reduce((a, p) => a + p[0], 0) / m;
	let start = 0, su = 0, best = -Infinity;
	for (let i = 0; i < m; i++) {
		const a = h[i], b = h[(i + 1) % m];
		if ((a[0] - cx) * (b[0] - cx) > 0 || a[0] === b[0]) continue;
		const u = (cx - a[0]) / (b[0] - a[0]), z = a[1] + (b[1] - a[1]) * u;
		if (z > best) { best = z; start = i; su = u; }
	}
	const a0 = h[start], b0 = h[(start + 1) % m];
	const R = [[a0[0] + (b0[0] - a0[0]) * su, a0[1] + (b0[1] - a0[1]) * su]];
	for (let k = 1; k <= m; k++) R.push(h[(start + k) % m]);
	const L = [0];
	for (let i = 1; i < R.length; i++) L.push(L[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]));
	L.push(L[R.length - 1] + Math.hypot(R[0][0] - R[R.length - 1][0], R[0][1] - R[R.length - 1][1]));
	const total = L[L.length - 1], out = [];
	for (let k = 0; k < n; k++) {
		const d = k / n * total; let i = 0; while (i < R.length - 1 && L[i + 1] < d) i++;
		const a = R[i], b = R[(i + 1) % R.length], u = (d - L[i]) / Math.max(1e-9, L[i + 1] - L[i]);
		out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
	}
	return out;
}
// A boot built over a foot: foot, shin, the skin's points (x, y, z flat) of the foot and the
// lower leg; ankle, its height; top, how high the shaft comes; off, how far the leather stands
// off the skin. The upper is lofted: at each height a ring round the convex outline of the skin
// there (the toes bridged, the hollows under the ankle bones filled, as leather lies), stood
// off by off, the shaft a little roomier; the toe box raised over the toes to its own height and
// rounded down at the front, so the front is a box, not toes in a sock. Under it an outsole
// whose heel stands taller than the forefoot (the heel's breast where they meet) and a midsole
// set in above it, the toe lifted (toe spring); a toe cap and a heel counter stitched over the
// upper; a tongue up the instep and the shin, laces crossing it from eyelet to eyelet and on up
// the shaft from hook to hook; a padded collar round the top. Pieces { geo, part }.
export function bootGeometry(foot, shin, { top, ankle = 0.1, off = 0.014, lo = false } = {}) {
	const out = [], M = lo ? 18 : 28;
	const P = [];
	for (const src of [foot, shin]) for (let q = 0; q < src.length; q += 3) if (src[q + 1] < top + 0.03) P.push([src[q], src[q + 1], src[q + 2]]);
	const base = P.filter((p) => p[1] < 0.035);
	if (base.length < 8) return out;
	let z0 = Infinity, z1 = -Infinity, cx = 0;
	for (const p of base) { z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); cx += p[0]; }
	cx /= base.length;
	const Lf = z1 - z0, heelZ = z0 + Lf * 0.27, toeH = Math.max(0.05, 0.215 * Lf);
	// (the toe box: each forefoot point raised to the box's height, rounded down at the front,
	// and a touch wider than the toes)
	const toeTop = (z) => { const t = Math.max(0, (z - (z1 - 0.045)) / 0.05); return toeH * (0.42 + 0.58 * Math.sqrt(Math.max(0, 1 - t * t))); };
	for (const p of P.slice()) if (p[2] > z1 - Lf * 0.42 && p[1] < toeH) P.push([cx + (p[0] - cx) * 1.05, Math.max(p[1], toeTop(p[2]) - 0.004), p[2]]);
	// the rings, from inside the midsole to the top of the shaft
	const step = lo ? 0.022 : 0.014, ys = [];
	for (let y = 0.018; y < top - step * 0.4; y += step) ys.push(y);
	ys.push(top);
	const rings = [];
	let prev = null;
	for (const y of ys) {
		const band = [], w = Math.max(0.008, step * 0.75);
		for (const p of P) if (Math.abs(p[1] - y) < w) band.push([p[0], p[2]]);
		let ring = prev;
		if (band.length >= 6) { const h = hull2(band); if (h.length >= 3) ring = ringFrom(grow(h, off + (y > ankle + 0.03 ? 0.004 : 0)), M); }
		if (!ring) continue;
		rings.push({ y, pts: ring.map((q) => q.slice()) });
		prev = ring;
	}
	if (rings.length < 4) return out;
	// (smoothed up and down, so the outline's steps from band to band do not show)
	for (let pass = 0; pass < 2; pass++) {
		const was = rings.map((r) => r.pts.map((q) => q.slice()));
		for (let j = 1; j < rings.length - 1; j++) for (let i = 0; i < M; i++) for (let c = 0; c < 2; c++) rings[j].pts[i][c] = was[j - 1][i][c] * 0.25 + was[j][i][c] * 0.5 + was[j + 1][i][c] * 0.25;
	}
	// a sheet over part of the loft, rings j0..j1 and round from i0 for n points, stood out by e
	const sheet = (j0, j1, i0, n, e, closed = false) => {
		const pos = [], idx = [], cols = closed ? M : n;
		for (let j = j0; j <= j1; j++) {
			const R = rings[j].pts, cxr = R.reduce((a, q) => a + q[0], 0) / M, czr = R.reduce((a, q) => a + q[1], 0) / M;
			for (let k = 0; k < cols; k++) {
				const q = R[(i0 + k + M) % M], dx = q[0] - cxr, dz = q[1] - czr, l = Math.hypot(dx, dz) || 1;
				pos.push(q[0] + dx / l * e, rings[j].y, q[1] + dz / l * e);
			}
		}
		for (let j = 0; j < j1 - j0; j++) for (let k = 0; k < (closed ? cols : cols - 1); k++) {
			const a = j * cols + k, b = j * cols + (k + 1) % cols, c = a + cols, d = b + cols;
			idx.push(a, c, b, b, c, d);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
		return g;
	};
	out.push({ geo: sheet(0, rings.length - 1, 0, M, 0, true), part: 'upper' });
	const ringAt = (y) => { let j = 0; while (j < rings.length - 1 && rings[j + 1].y <= y) j++; return j; };
	// the toe cap over the front of the box, the heel counter round the back
	const jToe = ringAt(toeH * 0.92), jHeel = ringAt(ankle + 0.005), q = Math.round(M * 0.17);
	if (jToe > 0) out.push({ geo: sheet(0, jToe, M - q, 2 * q + 1, 0.0016), part: 'cap' });
	if (jHeel > 0) out.push({ geo: sheet(0, jHeel, Math.round(M / 2) - q, 2 * q + 1, 0.0016), part: 'counter' });
	// the outsole and the midsole, cut to the upper's own bottom ring
	const spring = (z) => Math.max(0, (z - (z1 - Lf * 0.2)) / (Lf * 0.2)) * 0.007;
	const yHeel = (z) => 0.012 + 0.009 * (1 - smooth((z - heelZ + 0.006) / 0.012));
	const sole = grow(rings[0].pts, 0.005), mid = grow(rings[0].pts, 0.002);
	out.push({ geo: prism(sole, [(i) => spring(sole[i][1]), (i) => yHeel(sole[i][1]) + spring(sole[i][1])]), part: 'sole' });
	out.push({ geo: prism(mid, [(i) => yHeel(mid[i][1]) + spring(mid[i][1]) - 0.001, (i) => yHeel(mid[i][1]) + 0.011 + spring(mid[i][1])], false), part: 'mid' });
	// the front of the loft from the top of the toe box up to the collar: the tongue's line
	const line = [];
	for (let j = ringAt(toeH + 0.004); j < rings.length; j++) if (rings[j].y < top - 0.01) line.push(V(rings[j].pts[0][0], rings[j].y, rings[j].pts[0][1]));
	const normalAt = (k) => {
		const a = line[Math.max(0, k - 1)], b = line[Math.min(line.length - 1, k + 1)];
		const along = b.clone().sub(a).normalize(), n = new THREE.Vector3().crossVectors(V(1, 0, 0), along).normalize();
		return n.z < 0 ? n.multiplyScalar(-1) : n;
	};
	if (line.length >= 3) {
		// the tongue: a strip along that line, standing on the upper
		const rows = [[], []], nr = [[], []];
		for (let k = 0; k < line.length; k++) {
			const n = normalAt(k), p = line[k].clone().addScaledVector(n, 0.0015);
			for (const [r, sx] of [[0, -1], [1, 1]]) { rows[r].push(p.clone().add(V(sx * 0.022, 0, 0))); nr[r].push(n); }
		}
		out.push({ geo: slab(rows, nr, 0.004, 0.0015), part: 'tongue' });
		// the laces: crossing over it, eyelet to eyelet on the foot, hook to hook up the shaft
		let acc = 0.012, count = 0;
		for (let k = 1; k < line.length; k++) {
			const a = line[k - 1], b = line[k], L = a.distanceTo(b);
			for (; acc < L; acc += line[k].y > ankle + 0.02 ? 0.024 : 0.021) {
				const p = a.clone().lerp(b, acc / L), n = normalAt(k), along = b.clone().sub(a).normalize();
				for (const s2 of [-1, 1]) {
					const d = V(0.026, 0, 0).addScaledVector(along, s2 * 0.007);
					const g = new THREE.CylinderGeometry(0.0018, 0.0018, d.length() * 2, 4, 1, true);
					g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()));
					g.translate(p.x + n.x * 0.0065, p.y + n.y * 0.0065, p.z + n.z * 0.0065);
					out.push({ geo: g, part: 'lace' });
				}
				for (const s2 of [-1, 1]) {
					const e = new THREE.CylinderGeometry(0.0034, 0.0034, 0.003, lo ? 5 : 6);
					e.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n));
					e.translate(p.x + s2 * 0.026 + n.x * 0.003, p.y + n.y * 0.003, p.z + n.z * 0.003);
					out.push({ geo: e, part: p.y > ankle + 0.02 && count % 2 ? 'hook' : 'eyelet' });
				}
				count++;
			}
			acc -= L;
		}
	}
	// the padded collar round the top of the shaft
	const T = rings[rings.length - 1], rim = T.pts.map((q2) => { const cxr = T.pts.reduce((a, r) => a + r[0], 0) / M, czr = T.pts.reduce((a, r) => a + r[1], 0) / M, dx = q2[0] - cxr, dz = q2[1] - czr, l = Math.hypot(dx, dz) || 1; return V(q2[0] + dx / l * 0.004, T.y, q2[1] + dz / l * 0.004); });
	out.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), lo ? 14 : 24, 0.0075, lo ? 4 : 6, true), part: 'collar' });
	return out;
}

// A belt round the trousers' waistband: field, the dressed torso (torsoField); at height y (its
// middle), w wide; loops of the trousers standing over it; a buckle at the front
export function beltGeometry(cut, field, { y, w = 0.036, out: stand = 0.01, lo = false } = {}) {
	const pieces = [], seg = lo ? 16 : 32, rows = [[], []], nr = [[], []];
	const ring = (yy, a, grow) => {
		const zc = (field.front(0, yy) + field.back(0, yy)) / 2, rz = (field.front(0, yy) - field.back(0, yy)) / 2 + stand + grow, rx = field.half(yy) + stand + grow;
		const ca = Math.cos(a), sa = Math.sin(a);
		return { p: V(rx * Math.sign(sa) * Math.pow(Math.abs(sa), 0.75), yy, zc + rz * Math.sign(ca) * Math.pow(Math.abs(ca), 0.75)), zc };
	};
	for (let k = 0; k <= seg; k++) {
		const a = k / seg * 2 * Math.PI;
		for (const [r, yy] of [[0, y - w / 2], [1, y + w / 2]]) { const q = ring(yy, a, 0); rows[r].push(q.p); nr[r].push(V(q.p.x, 0, q.p.z - q.zc).normalize()); }
	}
	pieces.push({ geo: slab(rows, nr, 0.004, 0.001), part: 'belt' });
	// the loops: a little taller than the belt, standing over it
	for (const a of [0.42, -0.42, 1.25, -1.25, Math.PI]) {
		const q = ring(y, a, 0.0045), n = V(q.p.x, 0, q.p.z - q.zc).normalize(), side = new THREE.Vector3().crossVectors(V(0, 1, 0), n).normalize();
		const g = new THREE.BoxGeometry(0.012, w + 0.014, 0.003);
		g.applyMatrix4(new THREE.Matrix4().makeBasis(side, V(0, 1, 0), n).setPosition(q.p.clone().addScaledVector(n, 0.001)));
		pieces.push({ geo: g, part: 'loop' });
	}
	// the buckle: a plate with a frame, a little proud of the belt
	const q = ring(y, 0, 0.004);
	const buckle = new THREE.BoxGeometry(0.046, w + 0.006, 0.006);
	buckle.translate(q.p.x, q.p.y, q.p.z + 0.002);
	pieces.push({ geo: buckle, part: 'buckle' });
	return pieces;
}

// A bellows cargo pocket on each thigh's outer side: thigh, its points (x, y, z flat); side
// +1 or -1 (which way is out); y, the pocket's middle height; h, w its size; stand, how far out
// from the skin it lies (the trousers' cloth is under it); with a flap over its top
export function cargoPocketGeometry(thigh, side, { y, h = 0.16, w = 0.13, stand = 0.026, lo = false } = {}) {
	const near = [];
	for (let q = 0; q < thigh.length; q += 3) if (Math.abs(thigh[q + 1] - y) < h / 2 + 0.03 && Math.sign(thigh[q]) === side) near.push(thigh[q], thigh[q + 1], thigh[q + 2]);
	if (near.length < 30) return [];
	let cx = 0, cz = 0;
	for (let q = 0; q < near.length; q += 3) { cx += near[q]; cz += near[q + 2]; }
	cx /= near.length / 3; cz /= near.length / 3;
	// the thigh's radius each way, at each height (the pocket follows its curve)
	const radius = (yy, a) => {
		let r = 0;
		for (let q = 0; q < near.length; q += 3) {
			if (Math.abs(near[q + 1] - yy) > 0.015) continue;
			const dx = near[q] - cx, dz = near[q + 2] - cz, d = Math.atan2(dz, dx) - a;
			if (Math.cos(d) > 0.97) r = Math.max(r, Math.hypot(dx, dz));
		}
		return r || 0.07;
	};
	const pieces = [], na = lo ? 3 : 6, nh = lo ? 3 : 6;
	// (centred a little forward of the side, as cargo pockets sit)
	const a0 = side > 0 ? 0.18 : Math.PI - 0.18, arc = w / 0.085;
	const sheet = (y0, y1, grow, part) => {
		const grid = [], nor = [];
		for (let j = 0; j <= nh; j++) {
			const yy = y0 + (y1 - y0) * j / nh, row = [], nrow = [];
			for (let i = 0; i <= na; i++) {
				const a = a0 + (i / na - 0.5) * arc * (side > 0 ? 1 : -1), r = radius(yy, a) + stand + grow;
				row.push(V(cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r)); nrow.push(V(Math.cos(a), 0, Math.sin(a)));
			}
			grid.push(row); nor.push(nrow);
		}
		pieces.push({ geo: slab(grid, nor, 0.007, 0.002), part });
	};
	sheet(y - h / 2, y + h / 2 - 0.035, 0, 'pocket');
	sheet(y + h / 2 - 0.05, y + h / 2, 0.006, 'flap');
	return pieces;
}
