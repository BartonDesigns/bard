// The realm's building kit. Everything is built from a few shapes (boxes, beams, prisms,
// rings, lathes, roof slopes) into one geometry per place, each face knowing what it is
// made of (aMat) and textured in metres, so the stone courses, the thatch and the
// shingles keep their true size on every wall and roof. One material draws them all:
// dressed stone in courses, rubble, lime plaster, oak, thatch, shingles and clay tiles,
// planks, iron, cloth, leaded windows lit from inside at night, flagstones.
//
// The same material serves the dungeons, lit there as the caves are (cavemat.js).

import * as THREE from 'three';
import { rockDetail } from '../cavemat.js';

// what a face is made of
export const M = { ASHLAR: 0, RUBBLE: 1, PLASTER: 2, TIMBER: 3, THATCH: 4, SHINGLE: 5, PLANK: 6, IRON: 7, CLOTH: 8, GLASS: 9, PLAIN: 10, FLAG: 11, STRAW: 12, TILE: 13, LEAF: 14, BONE: 15 };

// ---------- the builder ----------
export class Kit {
	constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.A = []; this.I = []; this.at(0, 0, 0, 0); }
	get count() { return this.P.length / 3; }
	// the frame the next shapes are placed in: a position and a turn about y
	at(x, y, z, yaw = 0) { this.ox = x; this.oy = y; this.oz = z; this.c = Math.cos(yaw); this.s = Math.sin(yaw); this.yaw = yaw; return this; }
	w(x, y, z) { return [this.ox + x * this.c + z * this.s, this.oy + y, this.oz - x * this.s + z * this.c]; }
	// one vertex: world position, normal, uv, colour, material
	v(p, n, u, v2, col, mat) {
		this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(u, v2); this.C.push(col[0], col[1], col[2]); this.A.push(mat);
		return this.P.length / 3 - 1;
	}
	// frames within frames: the current one saved, and one set inside it
	save() { return [this.ox, this.oy, this.oz, this.yaw]; }
	load(f) { return this.at(f[0], f[1], f[2], f[3]); }
	sub(x, y, z, yaw = 0) { const p = this.w(x, y, z); return this.at(p[0], p[1], p[2], this.yaw + yaw); }
	// a polygon turned to face the given local direction, whatever order its points came in
	face(pts, nl, mat, col, uv = 'auto') {
		const a = pts[0], b = pts[1], c = pts[2];
		const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
		if (n[0] * nl[0] + n[1] * nl[1] + n[2] * nl[2] < 0) return this.poly(pts.slice().reverse(), mat, col, uv === 'auto' ? uv : uv.slice().reverse());
		return this.poly(pts, mat, col, uv);
	}
	// a flat polygon in the local frame (convex, wound counter-clockwise seen from outside);
	// uv: 'auto' (walls: along the face and up; floors: x and z; in metres, from the world),
	// or an array of [u, v] per point
	poly(pts, mat, col, uv = 'auto') {
		const W = pts.map((p) => this.w(p[0], p[1], p[2]));
		col = lin(col);
		const e1 = [W[1][0] - W[0][0], W[1][1] - W[0][1], W[1][2] - W[0][2]], e2 = [W[2][0] - W[0][0], W[2][1] - W[0][1], W[2][2] - W[0][2]];
		let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
		const l = Math.hypot(...n) || 1;
		n = [n[0] / l, n[1] / l, n[2] / l];
		let uvs = uv;
		if (uv === 'auto') {
			if (Math.abs(n[1]) > 0.7) uvs = W.map((p) => [p[0], p[2]]);
			else {
				const tl = Math.hypot(n[0], n[2]) || 1, tx = -n[2] / tl, tz = n[0] / tl;
				uvs = W.map((p) => [p[0] * tx + p[2] * tz, p[1]]);
			}
		}
		const base = this.count;
		W.forEach((p, i) => this.v(p, n, uvs[i][0], uvs[i][1], col, mat));
		for (let i = 1; i < W.length - 1; i++) this.I.push(base, base + i, base + i + 1);
		return this;
	}
	quad(a, b, c, d, mat, col, uv) { return this.poly([a, b, c, d], mat, col, uv); }
	// an axis box in the local frame (faces listed in skip are left off)
	box(x0, y0, z0, x1, y1, z1, mat, col, skip = '') {
		if (!skip.includes('px')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], mat, col);
		if (!skip.includes('nx')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], mat, col);
		if (!skip.includes('py')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], mat, col);
		if (!skip.includes('ny')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], mat, col);
		if (!skip.includes('pz')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], mat, col);
		if (!skip.includes('nz')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], mat, col);
		return this;
	}
	// a box by its centre and size
	cube(x, y, z, w, h, d, mat, col, skip) { return this.box(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, mat, col, skip); }
	// a squared beam from a to b (local points), w wide and d deep; its texture runs along it
	beam(a, b, w, d, mat, col) {
		const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
		const f = [dx / L, dy / L, dz / L];
		let up = Math.abs(f[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
		let sx = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
		const sl = Math.hypot(...sx); sx = sx.map((q) => q / sl);
		up = [sx[1] * f[2] - sx[2] * f[1], sx[2] * f[0] - sx[0] * f[2], sx[0] * f[1] - sx[1] * f[0]];
		const corner = (e, k, t) => [a[0] + f[0] * t + sx[0] * e * w / 2 + up[0] * k * d / 2, a[1] + f[1] * t + sx[1] * e * w / 2 + up[1] * k * d / 2, a[2] + f[2] * t + sx[2] * e * w / 2 + up[2] * k * d / 2];
		const sides = [[1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1], [-1, 1, 1, 1]];
		for (const [e0, k0, e1, k1] of sides) this.quad(corner(e0, k0, 0), corner(e1, k1, 0), corner(e1, k1, L), corner(e0, k0, L), mat, col, [[0, 0], [w, 0], [w, L], [0, L]].map(([u, v]) => [v, u]));
		this.quad(corner(1, 1, L), corner(1, -1, L), corner(-1, -1, L), corner(-1, 1, L), mat, col);
		this.quad(corner(-1, 1, 0), corner(-1, -1, 0), corner(1, -1, 0), corner(1, 1, 0), mat, col);
		return this;
	}
	// a ring of quads round the y axis (a tower's wall, a post): radii and heights per level
	lathe(prof, sides, mat, col, a0 = 0, a1 = Math.PI * 2, capTop = false) {
		const span = a1 - a0;
		for (let j = 0; j < prof.length - 1; j++) {
			const [r0, y0] = prof[j], [r1, y1] = prof[j + 1];
			for (let i = 0; i < sides; i++) {
				const t0 = a0 + i / sides * span, t1 = a0 + (i + 1) / sides * span;
				const p = (rr, yy, t) => [Math.sin(t) * rr, yy, Math.cos(t) * rr];
				const u0 = t0 * Math.max(r0, r1), u1 = t1 * Math.max(r0, r1);
				this.quad(p(r0, y0, t0), p(r0, y0, t1), p(r1, y1, t1), p(r1, y1, t0), mat, col, [[u0, y0], [u1, y0], [u1, y1], [u0, y1]].map(([u, v]) => [u, v + this.oy]));
			}
		}
		if (capTop) {
			const [rt, yt] = prof[prof.length - 1];
			const pts = [];
			for (let i = sides - 1; i >= 0; i--) { const t = a0 + i / sides * span; pts.push([Math.sin(t) * rt, yt, Math.cos(t) * rt]); }
			if (span >= Math.PI * 2 - 1e-6) this.poly(pts.reverse(), mat, col);
		}
		return this;
	}
	// a cone roof over a ring (tower caps): the uv runs down the slope
	cone(rad, y0, h, sides, mat, col, over = 0.4) {
		const R = rad + over;
		for (let i = 0; i < sides; i++) {
			const t0 = i / sides * Math.PI * 2, t1 = (i + 1) / sides * Math.PI * 2, sl = Math.hypot(R, h);
			const a = [Math.sin(t0) * R, y0, Math.cos(t0) * R], b = [Math.sin(t1) * R, y0, Math.cos(t1) * R], tip = [0, y0 + h, 0];
			this.poly([a, b, tip], mat, col, [[t0 * R, sl], [t1 * R, sl], [(t0 + t1) / 2 * R, 0]]);
		}
		return this;
	}
	// a gabled roof over a w x d plan (ridge along z), eaves at y, pitch as rise/run, with
	// overhangs; the gable ends are filled with `gable` material
	roof(w, d, y, rise, mat, col, o = {}) {
		const ov = o.over ?? 0.45, ovz = o.overZ ?? 0.35, t = o.thick ?? 0.18;
		const hw = w / 2 + ov, x0 = -hw, x1 = hw, z0 = -d / 2 - ovz, z1 = d / 2 + ovz;
		const ry = y + rise * (w / 2), ey = y - rise * ov;
		const sl = Math.hypot(hw, ry - ey);
		// the two slopes, and their undersides a little below
		this.quad([x1, ey, z1], [x1, ey, z0], [0, ry, z0], [0, ry, z1], mat, col, [[z1, sl], [z0, sl], [z0, 0], [z1, 0]]);
		this.quad([x0, ey, z0], [x0, ey, z1], [0, ry, z1], [0, ry, z0], mat, col, [[z0, sl], [z1, sl], [z1, 0], [z0, 0]]);
		const uc = o.under || [0.32, 0.26, 0.2];
		this.quad([x1, ey - t, z0], [x1, ey - t, z1], [0, ry - t, z1], [0, ry - t, z0], M.PLANK, uc);
		this.quad([x0, ey - t, z1], [x0, ey - t, z0], [0, ry - t, z0], [0, ry - t, z1], M.PLANK, uc);
		// the thickness at the eaves and the verges
		this.quad([x1, ey - t, z1], [x1, ey - t, z0], [x1, ey, z0], [x1, ey, z1], mat, col, [[z1, sl], [z0, sl], [z0, sl - t], [z1, sl - t]]);
		this.quad([x0, ey - t, z0], [x0, ey - t, z1], [x0, ey, z1], [x0, ey, z0], mat, col, [[z0, sl], [z1, sl], [z1, sl - t], [z0, sl - t]]);
		// the verges: the roof's thickness seen end-on, a thin chevron
		const vuv = [[0, sl], [0, 0], [t, 0], [t, sl]];
		this.quad([x0, ey - t, z1], [0, ry - t, z1], [0, ry, z1], [x0, ey, z1], mat, col, vuv);
		this.quad([0, ry - t, z1], [x1, ey - t, z1], [x1, ey, z1], [0, ry, z1], mat, col, vuv);
		this.quad([0, ry - t, z0], [x0, ey - t, z0], [x0, ey, z0], [0, ry, z0], mat, col, vuv);
		this.quad([x1, ey - t, z0], [0, ry - t, z0], [0, ry, z0], [x1, ey, z0], mat, col, vuv);
		// the gables: triangles over the end walls
		if (o.gable != null) {
			const gw = w / 2;
			for (const z of [d / 2, -d / 2]) {
				const pts = z > 0 ? [[-gw, y, z], [gw, y, z], [0, y + rise * gw, z]] : [[gw, y, z], [-gw, y, z], [0, y + rise * gw, z]];
				this.poly(pts, o.gable, o.gableCol || col);
			}
		}
		// a ridge along the top
		if (o.ridge != null) this.beam([0, ry + 0.02, z0], [0, ry + 0.02, z1], 0.22, 0.2, o.ridge, o.ridgeCol || col);
		return ry;
	}
	// the finished geometry
	build() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
		g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.A, 1));
		g.setIndex(this.P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
		g.computeBoundingSphere();
		return g;
	}
	// append another kit's shapes (so pieces built apart can be merged)
	take(k) {
		const base = this.count;
		this.P.push(...k.P); this.N.push(...k.N); this.U.push(...k.U); this.C.push(...k.C); this.A.push(...k.A);
		for (const i of k.I) this.I.push(i + base);
		return this;
	}
}

// colours are given as seen; the shader works in linear light
const LIN = new Map();
function lin(c) {
	const key = c[0] + ',' + c[1] + ',' + c[2];
	let v = LIN.get(key);
	if (!v) { const f = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); v = [f(c[0]), f(c[1]), f(c[2])]; if (LIN.size < 4000) LIN.set(key, v); }
	return v;
}

// ---------- the material ----------
// one program for every surface of the realm; `cave` lights it as the caves are lit
export const TORCHES = 8;
export function kitUniforms(shared) {
	return {
		uDetail: { value: rockDetail() }, uTime: shared.uTime,
		uNight: { value: 0 }, uSnow: { value: 0 },
		uTorchP: { value: Array.from({ length: TORCHES }, () => new THREE.Vector4()) },
		uTorchK: { value: 0 },
	};
}
export function kitMaterial(U, o = {}) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: o.side ?? THREE.FrontSide });
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = 'attribute float aMat;\nvarying float vMat;\nvarying vec2 vKUv;\nvarying vec3 vKN;\nvarying vec3 vKW;\n' + sh.vertexShader
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;\nvKUv = uv;')
			.replace('#include <project_vertex>', `#include <project_vertex>
				#ifdef USE_INSTANCING
					vKW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
					vKN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
				#else
					vKW = (modelMatrix * vec4(transformed, 1.0)).xyz;
					vKN = normalize(mat3(modelMatrix) * objectNormal);
				#endif`);
		sh.fragmentShader = `uniform sampler2D uDetail; uniform float uTime, uNight, uSnow, uTorchK; uniform vec4 uTorchP[${TORCHES}];
			varying float vMat; varying vec2 vKUv; varying vec3 vKN; varying vec3 vKW;
			float kRough = 0.9, kMetal = 0.0, kH = 0.0, kGlow = 0.0, kAA = 1.0;
			vec3 kGlowC = vec3(1.0, 0.62, 0.3);
			float kh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float kn(vec2 p){ return texture2D(uDetail, p).b; }
			// stripes that fade out where they would be finer than a pixel
			float kFade(float p){ return 1.0 - smoothstep(0.35, 0.9, fwidth(p)); }
			// courses of blocks: returns the mortar (0 in a block .. 1 in a joint), and the block's id
			float courses(vec2 uv, float bh, float bl, float jw, out vec2 id) {
				float row = floor(uv.y / bh);
				float off = kh(vec2(row, 3.7)) * bl;
				float len = bl * (0.75 + 0.5 * kh(vec2(row, 1.3)));
				float x = uv.x + off;
				float col = floor(x / len);
				id = vec2(col, row);
				vec2 f = vec2(fract(x / len) * len, fract(uv.y / bh) * bh);
				float e = min(min(f.x, len - f.x), min(f.y, bh - f.y));
				return (1.0 - smoothstep(jw * 0.5, jw, e)) * kFade(uv.y / bh * 6.0);
			}
			// irregular stones: the nearest of jittered points, the joint where two are near equal
			float cells(vec2 uv, out vec2 id) {
				vec2 c = floor(uv), f = fract(uv);
				float d1 = 9.0, d2 = 9.0;
				for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
					vec2 g = vec2(float(i), float(j)), o = vec2(kh(c + g), kh(c + g + 17.3)) * 0.8 + 0.1;
					float d = length(g + o - f);
					if (d < d1) { d2 = d1; d1 = d; id = c + g; } else if (d < d2) d2 = d;
				}
				return (1.0 - smoothstep(0.03, 0.09, d2 - d1)) * kFade(uv.x * 4.0);
			}
			vec3 kPerturb(vec3 surf, vec3 n, float h, float amt) {
				vec3 sx = dFdx(surf), sy = dFdy(surf);
				vec3 r1 = cross(sy, n), r2 = cross(n, sx);
				float det = dot(sx, r1);
				vec2 dh = vec2(dFdx(h), dFdy(h)) * amt;
				vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
				return normalize(abs(det) * n - grad);
			}
			` + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				{
					int id = int(vMat + 0.5);
					vec3 kN = normalize(vKN);
					vec2 uv = vKUv;
					vec3 col = diffuseColor.rgb;
					float n1 = kn(vKW.xz * 0.037 + vKW.y * 0.021), n2 = kn(uv * 0.29);
					vec2 bid;
					if (id == 0) {
						// dressed stone in courses, each block its own shade, weathered
						float mo = courses(uv, 0.42, 0.9, 0.035, bid);
						float bk = kh(bid);
						col *= 0.82 + 0.3 * bk + 0.15 * n2;
						col *= 0.9 + 0.2 * kn(uv * 1.7 + bid * 0.37);
						col = mix(col, vec3(0.72, 0.70, 0.64) * 0.7, mo * 0.8);
						kH = (1.0 - mo) * 0.6 + n2 * 0.2 + bk * 0.1;
						// damp and moss low down and on what faces up, streaks down the face
						float streak = kn(vec2(uv.x * 0.21, vKW.y * 0.015));
						col *= 0.86 + 0.24 * streak;
						col = mix(col, vec3(0.16, 0.21, 0.09), smoothstep(0.62, 0.9, n1 + kN.y * 0.4) * 0.45);
						kRough = 0.92;
					} else if (id == 1 || id == 11) {
						// rubble walls; flagstones and cobbles underfoot
						float sc = id == 1 ? 4.6 : 1.9;
						float mo = cells(uv * sc, bid);
						float bk = kh(bid);
						col *= 0.72 + 0.45 * bk;
						col *= 0.9 + 0.2 * kn(uv * 1.3 + bid * 0.31);
						col = mix(col, id == 1 ? vec3(0.5, 0.48, 0.42) * 0.8 : vec3(0.18, 0.16, 0.13), mo * 0.85);
						kH = (1.0 - mo) * (0.5 + 0.3 * bk);
						if (id == 11) col = mix(col, vec3(0.2, 0.25, 0.1), smoothstep(0.7, 0.95, n1) * mo * 0.6);
						kRough = 0.93;
					} else if (id == 2) {
						// lime plaster: patchy, a little grimy low down
						col *= 0.9 + 0.12 * n2 + 0.06 * kn(uv * 2.3);
						col *= 1.0 - 0.12 * smoothstep(0.55, 0.85, kn(vec2(uv.x * 0.3, vKW.y * 0.05)));
						kH = n2 * 0.3;
						kRough = 0.97;
					} else if (id == 3 || id == 6) {
						// oak: grain along the timber (u), the planks' seams across
						float g = kn(vec2(uv.x * 0.08, uv.y * 1.9)) * 0.7 + kn(vec2(uv.x * 0.5, uv.y * 6.0)) * 0.3;
						col *= 0.62 + 0.55 * g;
						if (id == 6) {
							float pl = fract(uv.y / 0.19);
							float seam = (1.0 - smoothstep(0.0, 0.07, min(pl, 1.0 - pl))) * kFade(uv.y / 0.19);
							col *= 1.0 - seam * 0.55;
							col *= 0.85 + 0.3 * kh(vec2(floor(uv.y / 0.19), 2.0));
							kH = g * 0.3 - seam * 0.5;
						} else kH = g * 0.4;
						kRough = 0.78;
					} else if (id == 4 || id == 12) {
						// thatch: bundles of straw running down the slope, in layers
						float s = kn(vec2(uv.x * 2.4, uv.y * 0.18)), st = kn(vec2(uv.x * 9.0, uv.y * 0.7));
						float layer = fract(uv.y / 0.34);
						col *= 0.55 + 0.55 * s * (0.65 + 0.55 * st);
						col *= 0.78 + 0.22 * smoothstep(0.0, 0.5, layer) * kFade(uv.y / 0.34);
						col = mix(col, col * vec3(0.7, 0.75, 0.6), smoothstep(0.6, 0.85, n1) * 0.6);
						kH = s * 0.5 + st * 0.3 + layer * 0.3;
						kRough = 1.0;
					} else if (id == 5 || id == 13) {
						// shingles or clay tiles: rows down the slope, staggered, each its own shade
						float rowH = id == 5 ? 0.2 : 0.26, tw = id == 5 ? 0.24 : 0.3;
						float row = floor(uv.y / rowH), fy = fract(uv.y / rowH);
						float x = uv.x / tw + kh(vec2(row, 5.1)) * 0.5 + (mod(row, 2.0) * 0.5);
						float fx = fract(x);
						float tk = kh(vec2(floor(x), row));
						col *= 0.72 + 0.45 * tk;
						// the shadow each row casts on the one below, and the gaps between tiles
						float lip = smoothstep(0.75, 1.0, fy) * kFade(uv.y / rowH);
						float gap = (1.0 - smoothstep(0.0, 0.06, min(fx, 1.0 - fx))) * kFade(x);
						if (id == 13) col *= 0.85 + 0.25 * sin(fx * 3.14159) ;
						col *= (1.0 - lip * 0.45) * (1.0 - gap * 0.5);
						col = mix(col, vec3(0.2, 0.26, 0.12), smoothstep(0.7, 0.92, n1) * 0.4);
						kH = -lip * 0.6 + fy * 0.4 - gap * 0.4;
						kRough = id == 5 ? 0.85 : 0.75;
					} else if (id == 7) {
						// wrought iron, dark and a little rusty
						col *= 0.8 + 0.3 * n2;
						col = mix(col, vec3(0.3, 0.14, 0.06), smoothstep(0.55, 0.8, kn(uv * 2.1)) * 0.5);
						kRough = 0.5; kMetal = 0.7;
					} else if (id == 8) {
						// woven cloth
						float wv = sin(uv.x * 400.0) * sin(uv.y * 400.0) * kFade(uv.x * 60.0);
						col *= 0.9 + 0.08 * wv + 0.1 * n2;
						kRough = 0.95;
					} else if (id == 9) {
						// leaded lights: small diamond panes; dark by day, lamplit from within at night
						vec2 q = vec2(uv.x + uv.y, uv.x - uv.y) / 0.16;
						vec2 fq = abs(fract(q) - 0.5);
						float lead = (1.0 - smoothstep(0.42, 0.47, max(fq.x, fq.y))) * kFade(q.x);
						col = mix(vec3(0.06, 0.08, 0.08) + vec3(0.1, 0.12, 0.1) * kn(uv * 0.6), vec3(0.05), lead);
						// (not every house is up at night)
						float lit = step(0.3, kh(floor(vKW.xz / 2.5) + floor(vKW.y / 3.0)));
						kGlow = uNight * lit * (1.0 - lead) * (0.75 + 0.25 * sin(uTime * 3.0 + vKW.x) * sin(uTime * 1.7 + vKW.z));
						kGlowC = vec3(1.0, 0.62, 0.28) * 1.6;
						kRough = 0.15;
					} else if (id == 14) {
						// leaves: clumps of light and dark
						float lf = kn(vKW.xz * 0.9 + vKW.y * 0.7) * 0.6 + kn(vKW.xy * 1.7) * 0.4;
						col *= 0.55 + 0.7 * lf;
						kH = lf;
						kRough = 0.85;
					} else if (id == 15) {
						// old bone
						col *= 0.85 + 0.2 * n2;
						kRough = 0.6;
					} else {
						col *= 0.9 + 0.15 * n2;
					}
					// snow on what faces up, on a cold world
					if (uSnow > 0.0 && id != 9 && id != 7) col = mix(col, vec3(0.92, 0.94, 0.97), uSnow * smoothstep(0.55, 0.8, kN.y + (n1 - 0.5) * 0.4));
					diffuseColor.rgb = col;
				}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = kRough;')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = kMetal;')
			.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = kPerturb(-vViewPosition, normal, kH, 0.012);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += kGlowC * kGlow;')
			.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
				if (uTorchK > 0.0) {
					// the torches and lanterns nearby, at night
					vec3 tN = normalize(vKN), add = vec3(0.0);
					for (int i = 0; i < ${TORCHES}; i++) {
						vec4 P = uTorchP[i];
						if (P.w <= 0.0) continue;
						vec3 L = P.xyz - vKW;
						float d = length(L);
						float att = clamp(1.0 - d / P.w, 0.0, 1.0);
						att = att * att / (1.0 + d * d * 0.08);
						add += att * clamp(dot(tN, L / max(d, 1e-3)) * 0.75 + 0.25, 0.0, 1.0);
					}
					float fl = 0.88 + 0.12 * sin(uTime * 9.0) * sin(uTime * 5.3 + 1.0);
					reflectedLight.directDiffuse += diffuseColor.rgb * add * vec3(1.0, 0.58, 0.26) * 2.4 * uTorchK * fl;
				}`);
	};
	m.customProgramCacheKey = () => 'medkit' + (o.key || '');
	return m;
}

// ---------- flames: crossed cards with a moving fire ----------
export function flameMaterial(shared) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime, uK: { value: 1 } },
		vertexShader: 'varying vec2 vU; varying float vS; attribute float aS; void main(){ vU = uv; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime, uK; varying vec2 vU; varying float vS;
			float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
			void main(){
				vec2 p = vU;
				float t = uTime * 1.7 + vS * 10.0;
				float turb = n(vec2(p.x * 5.0, p.y * 4.0 - t * 1.8)) * 0.6 + n(vec2(p.x * 11.0, p.y * 9.0 - t * 3.0)) * 0.4;
				float w = (0.42 - p.y * 0.34) * (0.7 + 0.5 * turb);
				float body = smoothstep(w, w * 0.35, abs(p.x - 0.5 + (turb - 0.5) * 0.25 * p.y));
				body *= smoothstep(1.0, 0.45, p.y + turb * 0.25) * smoothstep(0.0, 0.08, p.y);
				vec3 c = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.8, 0.35), body * body);
				c = mix(c, vec3(1.0, 0.95, 0.8), pow(body, 4.0));
				gl_FragColor = vec4(c * body * 2.2 * uK, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}
// flames at points: two crossed cards each, one geometry
export function flameGeometry(list) {
	const P = [], U = [], S = [], I = [];
	for (const f of list) {
		const s = f.s || 0.35;
		for (const a of [0, Math.PI / 2]) {
			const b = P.length / 3, dx = Math.cos(a) * s * 0.5, dz = Math.sin(a) * s * 0.5;
			P.push(f.x - dx, f.y, f.z - dz, f.x + dx, f.y, f.z + dz, f.x + dx, f.y + s * 1.6, f.z + dz, f.x - dx, f.y + s * 1.6, f.z - dz);
			U.push(0, 0, 1, 0, 1, 1, 0, 1);
			const sd = Math.random();
			S.push(sd, sd, sd, sd);
			I.push(b, b + 1, b + 2, b, b + 2, b + 3);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
	g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1));
	g.setIndex(I);
	g.computeBoundingSphere();
	return g;
}
// a soft warm halo round each flame at night (camera-facing points)
export function haloMaterial(shared) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime, uK: { value: 0 }, uPx: { value: 1 } },
		vertexShader: `uniform float uPx; attribute float aSize; varying float vA;
			void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPx * 600.0 / max(1.0, -mv.z); vA = 1.0; }`,
		fragmentShader: `uniform float uK, uTime; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2); gl_FragColor = vec4(vec3(1.0, 0.6, 0.25) * a * 0.55 * uK * (0.9 + 0.1 * sin(uTime * 8.0)), 1.0); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
}

// ---------- the realm's arms, painted once ----------
export function armsTexture(arms) {
	const cv = document.createElement('canvas');
	cv.width = 128; cv.height = 256;
	const g = cv.getContext('2d');
	const css = (c) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
	g.fillStyle = css(arms.field); g.fillRect(0, 0, 128, 256);
	if (arms.split) { g.fillStyle = css(arms.charge); g.globalAlpha = 0.9; g.fillRect(0, 0, 64, 256); g.globalAlpha = 1; }
	const fg = arms.split ? css(arms.field.map((v, i) => (v + arms.charge[i]) / 2)) : css(arms.charge);
	g.fillStyle = fg; g.strokeStyle = fg;
	const cx = 64, cy = 110;
	g.save(); g.translate(cx, cy);
	if (arms.device === 'tower') {
		g.fillRect(-24, -26, 48, 60);
		for (let i = 0; i < 4; i++) g.fillRect(-24 + i * 14, -38, 8, 14);
		g.fillStyle = css(arms.field); g.beginPath(); g.arc(0, 26, 9, Math.PI, 0); g.lineTo(9, 34); g.lineTo(-9, 34); g.fill();
	} else if (arms.device === 'star') {
		g.beginPath();
		for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 14 : 36; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
		g.fill();
	} else if (arms.device === 'fleur') {
		g.beginPath(); g.moveTo(0, -40); g.bezierCurveTo(14, -24, 12, -6, 0, 4); g.bezierCurveTo(-12, -6, -14, -24, 0, -40); g.fill();
		for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4, 2); g.bezierCurveTo(s * 18, -12, s * 34, -4, s * 28, 12); g.bezierCurveTo(s * 22, 4, s * 14, 6, s * 6, 10); g.fill(); }
		g.fillRect(-18, 8, 36, 7);
		g.beginPath(); g.moveTo(-5, 15); g.lineTo(5, 15); g.lineTo(9, 36); g.lineTo(0, 30); g.lineTo(-9, 36); g.fill();
	} else if (arms.device === 'cross') {
		g.fillRect(-9, -44, 18, 88); g.fillRect(-36, -12, 72, 18);
	} else if (arms.device === 'chevron') {
		g.lineWidth = 18; g.beginPath(); g.moveTo(-60, 40); g.lineTo(0, -20); g.lineTo(60, 40); g.stroke();
	} else {
		// a crown
		g.fillRect(-30, 4, 60, 16);
		g.beginPath(); g.moveTo(-30, 4); g.lineTo(-34, -26); g.lineTo(-15, -6); g.lineTo(0, -32); g.lineTo(15, -6); g.lineTo(34, -26); g.lineTo(30, 4); g.fill();
	}
	g.restore();
	// a fringe along the bottom
	g.fillStyle = css(METAL_EDGE(arms));
	for (let x = 0; x < 128; x += 8) g.fillRect(x + 1, 236, 5, 20);
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	return t;
}
const METAL_EDGE = (arms) => (arms.field[0] + arms.field[1] > 1.4 ? arms.charge : arms.field.map((v) => Math.min(1, v * 0.6 + 0.35)));

// ---------- banners: cloth that hangs and moves in the wind ----------
// each banner is a grid; aFix is 0 where it is held (the pole or the rail) and 1 at the free end
export function bannerMaterial(shared, tex) {
	const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind; sh.uniforms.uGust = shared.uGust;
		sh.vertexShader = 'uniform float uTime, uWind, uGust; attribute float aFix; attribute vec3 aAxis; attribute float aPh;\n' + sh.vertexShader
			.replace('#include <begin_vertex>', `#include <begin_vertex>
				{
					// a flag streams and ripples; a hanging banner sways and bellies
					float k = aFix * aFix;
					float w = 0.35 + uWind * 0.8 + uGust * 1.2;
					float t = uTime * (2.2 + w * 2.5) + aPh;
					float wave = sin(t - aFix * 6.0 + position.y * 1.3) * 0.5 + sin(t * 1.7 - aFix * 11.0) * 0.18;
					transformed += aAxis * wave * k * (0.25 + w * 0.35);
				}`);
	};
	m.customProgramCacheKey = () => 'medbanner';
	return m;
}
// a banner in the world: from `a` (top of the held edge) running `len` along `dir` (a flag) or
// hanging down (a banner on a wall), `wide` across; normal side axis `axis`
export function bannerGeo(list) {
	const P = [], UV = [], F = [], AX = [], PH = [], I = [];
	for (const b of list) {
		const nu = 8, nv = 6, base = P.length / 3, ph = Math.random() * 20;
		for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
			const u = i / nu, v = j / nv;
			// (u runs from the held edge to the free one; v across)
			const x = b.a[0] + b.along[0] * u * b.len + b.across[0] * v * b.wide, y = b.a[1] + b.along[1] * u * b.len + b.across[1] * v * b.wide, z = b.a[2] + b.along[2] * u * b.len + b.across[2] * v * b.wide;
			P.push(x, y, z);
			UV.push(b.flag ? u : v, b.flag ? v : 1 - u);
			F.push(b.flag ? u : u * 0.6);
			AX.push(...b.axis);
			PH.push(ph);
		}
		for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = base + j * (nu + 1) + i; I.push(k, k + 1, k + nu + 2, k, k + nu + 2, k + nu + 1); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	g.setAttribute('aFix', new THREE.Float32BufferAttribute(F, 1));
	g.setAttribute('aAxis', new THREE.Float32BufferAttribute(AX, 3));
	g.setAttribute('aPh', new THREE.Float32BufferAttribute(PH, 1));
	g.setIndex(I);
	g.computeVertexNormals();
	g.computeBoundingSphere();
	return g;
}

// ---------- water: a river's surface ----------
export function riverMaterial(shared) {
	const m = new THREE.MeshStandardMaterial({ color: 0x2c4a4c, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uDetail = { value: rockDetail() };
		sh.vertexShader = 'varying vec3 vRW; varying vec2 vRU;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRU = uv;').replace('#include <project_vertex>', '#include <project_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
		sh.fragmentShader = 'uniform float uTime; uniform sampler2D uDetail; varying vec3 vRW; varying vec2 vRU;\n' + sh.fragmentShader
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				{
					// ripples carried downstream (v runs with the flow)
					vec2 f1 = vec2(vRU.x * 0.35, vRU.y * 0.08 - uTime * 0.25), f2 = vec2(vRU.x * 0.9 + 3.0, vRU.y * 0.2 - uTime * 0.55);
					vec2 n = (texture2D(uDetail, f1).rg - 0.5) * 0.5 + (texture2D(uDetail, f2).rg - 0.5) * 0.35;
					normal = normalize(normal + (vec4(n.x, 0.0, n.y, 0.0) * viewMatrix).xyz * 0.9);
				}`)
			.replace('#include <color_fragment>', `#include <color_fragment>
				{
					// clearer and browner at the banks, deep green-blue in the middle; foam at the edges
					float edge = abs(vRU.x);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.26, 0.18), smoothstep(0.55, 1.0, edge) * 0.6);
					float foam = smoothstep(0.82, 1.0, edge) * smoothstep(0.4, 0.7, texture2D(uDetail, vec2(vRU.x * 0.5, vRU.y * 0.15 - uTime * 0.3)).b);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.88, 0.86), foam * 0.5);
					diffuseColor.a = mix(0.9, 0.55, smoothstep(0.7, 1.0, edge));
				}`);
	};
	m.customProgramCacheKey = () => 'medriver';
	return m;
}
