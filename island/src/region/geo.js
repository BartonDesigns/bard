// A small builder for the regional structures: flat-shaded faces with a colour each, put
// down in a local frame (a lot's position and turn), all of a village merged into one
// geometry per material. Boxes, gables and hips, cylinders and cones, domes, curved eaves,
// arches; every shape is a few faces, coloured in the vertex (no textures), with a darker
// foot where it meets the ground and a little variation face to face so walls read as
// built by hand.

import * as THREE from 'three';

const tmp = new THREE.Color();
export const hexRGB = (h) => { tmp.set(h); return [tmp.r, tmp.g, tmp.b]; };
// a colour a little lighter or darker (k: 1 is the same), or mixed toward another
export const shade = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const col = (c) => (typeof c === 'string' ? hexRGB(c) : c);

export class Geo {
	constructor() {
		this.p = []; this.c = []; this.n = [];
		this.ox = 0; this.oy = 0; this.oz = 0; this.cs = 1; this.sn = 0;
		this.jit = 0.04; this.seed = 1;
	}
	// the local frame: everything after is placed about (x, y, z), turned by rot (radians)
	frame(x, y, z, rot = 0) { this.ox = x; this.oy = y; this.oz = z; this.cs = Math.cos(rot); this.sn = Math.sin(rot); return this; }
	at(x, y, z) { return [this.ox + x * this.cs + z * this.sn, this.oy + y, this.oz - x * this.sn + z * this.cs]; }
	rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
	// a flat polygon (3 or 4 local points, counter-clockwise seen from outside)
	face(pts, c) {
		c = col(c);
		const P = pts.map((q) => this.at(q[0], q[1], q[2]));
		const ax = P[1][0] - P[0][0], ay = P[1][1] - P[0][1], az = P[1][2] - P[0][2];
		const bx = P[2][0] - P[0][0], by = P[2][1] - P[0][1], bz = P[2][2] - P[0][2];
		let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
		const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
		const j = 1 + (this.rand() - 0.5) * this.jit;
		const tri = (a, b, d) => {
			for (const q of [a, b, d]) {
				// (a darker foot: the ground's shadow and its splash)
				const foot = q[1] - this.oy < 0.5 ? 0.82 + 0.36 * Math.max(0, q[1] - this.oy) : 1;
				this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz);
				this.c.push(c[0] * j * foot, c[1] * j * foot, c[2] * j * foot);
			}
		};
		tri(P[0], P[1], P[2]);
		if (P.length === 4) tri(P[0], P[2], P[3]);
		return this;
	}
	// a box from its foot centre (x, y, z), w along x, d along z, h up; turned by r about its own centre
	box(x, y, z, w, h, d, c, { r = 0, top = true, bottom = false, topc = null, sides = null } = {}) {
		const hw = w / 2, hd = d / 2, cs = Math.cos(r), sn = Math.sin(r);
		const q = (a, b, yy) => [x + a * cs + b * sn, yy, z - a * sn + b * cs];
		const A = q(-hw, -hd, y), B = q(hw, -hd, y), C = q(hw, hd, y), D = q(-hw, hd, y);
		const A2 = q(-hw, -hd, y + h), B2 = q(hw, -hd, y + h), C2 = q(hw, hd, y + h), D2 = q(-hw, hd, y + h);
		const S = sides || [c, c, c, c];
		this.face([D, C, C2, D2], S[0]).face([B, A, A2, B2], S[1]).face([C, B, B2, C2], S[2]).face([A, D, D2, A2], S[3]);
		if (top) this.face([A2, D2, C2, B2], topc || c);
		if (bottom) this.face([A, B, C, D], c);
		return this;
	}
	// a gable roof over a w x d rectangle at height y: the ridge along x, rising h, overhanging o;
	// gable ends filled with the wall colour (gc) when given
	gable(x, y, z, w, d, h, c, { o = 0.4, r = 0, gc = null, t = 0.15, snow = 0 } = {}) {
		const hw = w / 2 + o, hd = d / 2 + o, cs = Math.cos(r), sn = Math.sin(r);
		const q = (a, b, yy) => [x + a * cs + b * sn, yy, z - a * sn + b * cs];
		const e = o * h / (d / 2 + o);         // (the eave hangs below the wall top by the slope)
		const ya = y - e, yr = y + h;
		const L0 = q(-hw, -hd, ya), L1 = q(hw, -hd, ya), R0 = q(-hw, hd, ya), R1 = q(hw, hd, ya), T0 = q(-hw, 0, yr), T1 = q(hw, 0, yr);
		const rc = snow > 0 ? mixc(col(c), [0.93, 0.95, 0.98], snow) : c;
		this.face([L0, T0, T1, L1], rc).face([R1, T1, T0, R0], rc);
		// the roof's thickness under the eaves
		const u = (P) => [P[0], P[1] - t, P[2]];
		this.face([u(L1), u(L0), L0, L1], shade(col(c), 0.6)).face([u(R0), u(R1), R1, R0], shade(col(c), 0.6));
		this.face([u(L0), u(T0), u(T1), u(L1)], shade(col(c), 0.55)).face([u(R1), u(T1), u(T0), u(R0)], shade(col(c), 0.55));
		if (gc) {
			const g0 = q(-w / 2, -d / 2, y), g1 = q(-w / 2, d / 2, y), gt = q(-w / 2, 0, y + h * (d / 2) / (d / 2 + o));
			const g2 = q(w / 2, d / 2, y), g3 = q(w / 2, -d / 2, y), gt2 = q(w / 2, 0, y + h * (d / 2) / (d / 2 + o));
			this.face([g1, g0, gt], gc).face([g3, g2, gt2], gc);
		}
		return this;
	}
	// a hip roof (k: how far the hips run in, 0..0.5 of the length), or a pyramid (k = 0.5, w = d)
	hip(x, y, z, w, d, h, c, { o = 0.4, r = 0, k = 0.5, snow = 0, curl = 0 } = {}) {
		const hw = w / 2 + o, hd = d / 2 + o, cs = Math.cos(r), sn = Math.sin(r);
		const q = (a, b, yy) => [x + a * cs + b * sn, yy, z - a * sn + b * cs];
		const ya = y - o * h / (Math.min(w, d) / 2 + o), rx = Math.max(0, hw - Math.min(hw, hd) * 2 * k);
		const rc = snow > 0 ? mixc(col(c), [0.93, 0.95, 0.98], snow) : c;
		// (curl: the corners turned up, as on an East Asian roof)
		const A = q(-hw, -hd, ya + curl), B = q(hw, -hd, ya + curl), C = q(hw, hd, ya + curl), D = q(-hw, hd, ya + curl);
		const T0 = q(-rx, 0, y + h), T1 = q(rx, 0, y + h);
		if (curl) {
			const mA = q(0, -hd, ya), mC = q(0, hd, ya), mB = q(hw, 0, ya), mD = q(-hw, 0, ya);
			this.face([A, T0, mA], rc).face([mA, T0, T1], rc).face([mA, T1, B], rc);
			this.face([C, T1, mC], rc).face([mC, T1, T0], rc).face([mC, T0, D], rc);
			this.face([B, T1, mB], rc).face([mB, T1, C], rc).face([D, T0, mD], rc).face([mD, T0, A], rc);
			const u = shade(col(c), 0.55);
			this.face([B, mA, A], u).face([D, mC, C], u).face([C, mB, B], u).face([A, mD, D], u);
			return this;
		}
		this.face([A, T0, T1, B], rc).face([C, T1, T0, D], rc).face([B, T1, C], rc).face([D, T0, A], rc);
		this.face([A, B, C, D], shade(col(c), 0.5));
		return this;
	}
	// a flat slab: a roof, a floor, a step (a thin box)
	slab(x, y, z, w, d, t, c, r = 0) { return this.box(x, y, z, w, t, d, c, { r }); }
	// a cylinder or a frustum (r1 at the top), n sides, from y up h; caps
	cyl(x, y, z, r0, r1, h, c, { n = 10, top = true, topc = null, a0 = 0 } = {}) {
		for (let i = 0; i < n; i++) {
			const a = a0 + i / n * Math.PI * 2, b = a0 + (i + 1) / n * Math.PI * 2;
			const p0 = [x + Math.cos(a) * r0, y, z + Math.sin(a) * r0], p1 = [x + Math.cos(b) * r0, y, z + Math.sin(b) * r0];
			const q0 = [x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1], q1 = [x + Math.cos(b) * r1, y + h, z + Math.sin(b) * r1];
			if (r1 > 0.001) this.face([p1, p0, q0, q1], c); else this.face([p1, p0, q0], c);
			if (top && r1 > 0.001) this.face([q1, q0, [x, y + h, z]], topc || c);
		}
		return this;
	}
	cone(x, y, z, r, h, c, n = 10) { return this.cyl(x, y, z, r, 0, h, c, { n, top: false }); }
	// a dome (half a sphere, squashed or stretched by k), or an onion (bulge > 0)
	dome(x, y, z, r, c, { k = 1, n = 12, rings = 5, bulge = 0, tip = 0 } = {}) {
		const ring = (j) => {
			const t = j / rings, a = t * Math.PI / 2;
			let rr = Math.cos(a) * r * (1 + bulge * Math.sin(t * Math.PI) * 0.9), yy = Math.sin(a) * r * k;
			if (bulge) { rr *= 1 - Math.pow(t, 3) * 0.75; yy = t * r * k * 1.6; }
			return [rr, yy];
		};
		for (let j = 0; j < rings; j++) {
			const [ra, ya] = ring(j), [rb, yb] = ring(j + 1);
			for (let i = 0; i < n; i++) {
				const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
				const p0 = [x + Math.cos(a) * ra, y + ya, z + Math.sin(a) * ra], p1 = [x + Math.cos(b) * ra, y + ya, z + Math.sin(b) * ra];
				const q0 = [x + Math.cos(a) * rb, y + yb, z + Math.sin(a) * rb], q1 = [x + Math.cos(b) * rb, y + yb, z + Math.sin(b) * rb];
				if (rb > 0.01) this.face([p1, p0, q0, q1], c); else this.face([p1, p0, q0], c);
			}
		}
		if (tip) { const [, yt] = ring(rings); this.cyl(x, y + yt, z, 0.05 * r, 0.02, tip, [0.85, 0.7, 0.3], { n: 5, top: false }); }
		return this;
	}
	// a post from (x, y, z) to (x2, y2, z2), square of side s
	beam(x, y, z, x2, y2, z2, s, c) {
		const dx = x2 - x, dy = y2 - y, dz = z2 - z, L = Math.hypot(dx, dy, dz) || 1;
		const ux = dx / L, uy = dy / L, uz = dz / L;
		// two directions across it
		let ax = -uz, ay = 0, az = ux;
		if (Math.hypot(ax, az) < 0.1) { ax = 1; ay = 0; az = 0; }
		const la = Math.hypot(ax, ay, az); ax /= la; ay /= la; az /= la;
		const bx = uy * az - uz * ay, by = uz * ax - ux * az, bz = ux * ay - uy * ax;
		const h = s / 2, corner = (p, i) => { const sa = i === 0 || i === 3 ? -h : h, sb = i < 2 ? -h : h; return [p[0] + ax * sa + bx * sb, p[1] + ay * sa + by * sb, p[2] + az * sa + bz * sb]; };
		const P = [x, y, z], Q = [x2, y2, z2];
		for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.face([corner(P, i), corner(P, j), corner(Q, j), corner(Q, i)], c); }
		return this;
	}
	// an arch opening's frame on a wall plane (local x along the wall at depth z): two piers and a round top
	arch(x, y, z, w, h, t, c, { r = 0, n = 6 } = {}) {
		const cs = Math.cos(r), sn = Math.sin(r), q = (a, yy, b) => [x + a * cs + b * sn, yy, z - a * sn + b * cs];
		const R = w / 2, spring = y + h - R;
		for (let i = 0; i < n; i++) {
			const a = Math.PI - i / n * Math.PI, b = Math.PI - (i + 1) / n * Math.PI;
			const p0 = q(Math.cos(a) * R, spring + Math.sin(a) * R, 0), p1 = q(Math.cos(b) * R, spring + Math.sin(b) * R, 0);
			const p0o = q(Math.cos(a) * (R + t), spring + Math.sin(a) * (R + t), 0), p1o = q(Math.cos(b) * (R + t), spring + Math.sin(b) * (R + t), 0);
			this.face([p0, p1, p1o, p0o], c);
		}
		return this;
	}
	// a cloth or a plane hung between four local points (both faces)
	sheet(pts, c) { this.face(pts, c); this.face(pts.slice().reverse(), shade(col(c), 0.85)); return this; }
	count() { return this.p.length / 3; }
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
		g.computeBoundingSphere();
		return g;
	}
}
