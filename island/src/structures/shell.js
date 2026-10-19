// A damaged building as it stands: the far box (city.js) taken away and in its place its
// walls as a shell, with what is gone left out. Holes blown or punched through are ragged at
// their edges, the wall's thickness and its rebar showing round them, soot above the worst;
// through them the rooms: painted partitions, a desk or a cabinet, the ceilings. A partial
// collapse takes the upper storeys away on a slant: the floor slabs end in broken edges, the
// pieces that cracked off still hanging from their rebar, the columns standing up out of it
// with their bars bent at the top. A full one leaves stubs of wall and columns over a mound
// that spills furthest the way the building fell, the slabs pancaked in it, blocks of every
// size and the bars sticking out. A rebuild puts it back in stages: the rubble cleared, the
// frame rising storey by storey (columns, slabs, formwork at the top), the walls closed in in
// bare concrete behind it, then glazed and finished from the ground up.
//
// The intact runs of a wall are big quads: the windows on them are drawn by the shell's own
// material (shellMaterial(), from each vertex's facade: its style, storey and column, and
// whether the glass is there, broken or not yet in), so a tower with one hole costs little.
//
// buildShell(o, rec, p) returns the geometry (one mesh, in the lot's frame with its foot at
// y 0), the boxes that stop you (lot frame), and the rubble's height for walking.
// fireSpots(o, rec) says where it burns.

import * as THREE from 'three';
import { FACES, onFace, faceLen, hash } from './ids.js';
import { smoothstep as smooth } from '../noise.js';

const lin = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
const CORE = [0.36, 0.35, 0.33], DARK = [0.05, 0.05, 0.055], SOOT = [0.05, 0.045, 0.04], RAW = [0.45, 0.45, 0.43], REBAR = [0.2, 0.11, 0.07], CEIL = [0.62, 0.61, 0.58], FORM = [0.55, 0.4, 0.22];
const PAINT = [[0.86, 0.82, 0.72], [0.74, 0.8, 0.84], [0.78, 0.82, 0.72], [0.82, 0.8, 0.78], [0.88, 0.76, 0.66], [0.7, 0.7, 0.74]].map(lin);
const WOODS = [[0.42, 0.3, 0.2], [0.3, 0.3, 0.32], [0.55, 0.52, 0.48], [0.2, 0.22, 0.26]].map(lin);
const shade = (cl, k) => [cl[0] * k, cl[1] * k, cl[2] * k];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// the storey of a kind of building, and how much of its face is glass
export function facadeOf(o) {
	const k = Math.floor(o.kind), src = o.src?.kind;
	const tower = k === 2 || src === 11, office = k === 3 || src === 5 || src === 12, shop = k === 9 || k === 6 || src === 6;
	return { storey: tower || office ? 3.6 : shop ? 3.4 : 3.0, curtain: tower || (office && !o.roof), shop, house: !!o.roof };
}

// ---------- the shell's material: vertex colours, and the windows drawn on the facades ----------
// aFac: style (0 none, 1 punched windows in the odd columns, 2 in the even ones, 3 curtain wall,
// 4 curtain at the ground storey and punched above), the storey's height, the column's width,
// and the glass (0 in, 1 broken: a dark opening, 2 not yet glazed); aFU: along the face and up
export function shellMaterial() {
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide });
	mat.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nattribute vec4 aFac; attribute vec2 aFU; varying vec4 vFac; varying vec2 vFU;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvFac = aFac; vFU = aFU;');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\nvarying vec4 vFac; varying vec2 vFU;\nfloat shH(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
			.replace('#include <color_fragment>', `#include <color_fragment>
	float shGlass = 0.0;
	if (vFac.x > 0.5 && vFU.y > 0.05) {
		float st = vFac.y, cw = vFac.z, ci = floor(vFU.x / cw), cu = fract(vFU.x / cw), si = floor(vFU.y / st), rv = fract(vFU.y / st);
		float m = 0.07 / cw, win = 0.0;
		bool curtain = vFac.x > 2.5 && (vFac.x < 3.5 || si < 0.5);
		if (curtain) {
			win = step(m, cu) * step(cu, 1.0 - m) * step(0.28, rv) * step(rv, 0.985);
			if (rv < 0.28) diffuseColor.rgb *= 0.55;
		} else {
			float odd = mod(ci, 2.0);
			bool wc = vFac.x < 1.5 || vFac.x > 3.5 ? odd > 0.5 : odd < 0.5;
			if (wc) {
				float inW = step(0.16, cu) * step(cu, 0.84) * step(0.3, rv) * step(rv, 0.75);
				float sill = step(0.12, cu) * step(cu, 0.88) * step(0.26, rv) * step(rv, 0.3);
				diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.05, sill);
				win = inW;
			}
		}
		if (win > 0.5) {
			float r = shH(vec2(ci, si));
			vec3 glass = mix(vec3(0.05, 0.07, 0.09), vec3(0.3, 0.36, 0.42), 0.25 + 0.35 * r) + vec3(0.12) * smoothstep(0.6, 1.0, rv);
			vec3 hole = vec3(0.02, 0.018, 0.016) + vec3(0.05) * r;
			vec3 bare = vec3(0.07, 0.07, 0.075);
			diffuseColor.rgb = vFac.w < 0.5 ? glass : vFac.w < 1.5 ? hole : bare;
			shGlass = vFac.w < 0.5 ? 1.0 : 0.0;
		}
	}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix(roughnessFactor, 0.22, shGlass);')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = mix(metalnessFactor, 0.15, shGlass);');
	};
	mat.customProgramCacheKey = () => 'structures-shell-1';
	return mat;
}

// ---------- the geometry, a quad and a box at a time ----------
// (into typed arrays that grow: a shell is rebuilt as the work goes on, and must be quick)
function builder() {
	let cap = 4096, n = 0;
	let pos = new Float32Array(cap * 3), nor = new Float32Array(cap * 3), col = new Float32Array(cap * 3), fac = new Float32Array(cap * 4), fu = new Float32Array(cap * 2);
	const grow = () => {
		cap *= 2;
		const g = (a, k) => { const b = new Float32Array(cap * k); b.set(a); return b; };
		pos = g(pos, 3); nor = g(nor, 3); col = g(col, 3); fac = g(fac, 4); fu = g(fu, 2);
	};
	const vert = (v, nn, cl, F, u, y) => {
		if (n >= cap) grow();
		const i3 = n * 3, i4 = n * 4, i2 = n * 2;
		pos[i3] = v[0]; pos[i3 + 1] = v[1]; pos[i3 + 2] = v[2];
		nor[i3] = nn[0]; nor[i3 + 1] = nn[1]; nor[i3 + 2] = nn[2];
		col[i3] = cl[0]; col[i3 + 1] = cl[1]; col[i3 + 2] = cl[2];
		if (F) { fac[i4] = F[0]; fac[i4 + 1] = F[1]; fac[i4 + 2] = F[2]; fac[i4 + 3] = F[3]; fu[i2] = u; fu[i2 + 1] = y; }
		else { fac[i4] = 0; fac[i4 + 1] = 0; fac[i4 + 2] = 0; fac[i4 + 3] = 0; fu[i2] = 0; fu[i2 + 1] = 0; }
		n++;
	};
	// a quad a b c d, its normal nn, colour cl; F the facade (aFac) and uv the corners' (u, y)
	function quad(a, b, c, d, nn, cl, F = null, uv = null) {
		const U = F && uv ? F : null;
		vert(a, nn, cl, U, U ? uv[0][0] : 0, U ? uv[0][1] : 0);
		vert(b, nn, cl, U, U ? uv[1][0] : 0, U ? uv[1][1] : 0);
		vert(c, nn, cl, U, U ? uv[2][0] : 0, U ? uv[2][1] : 0);
		vert(a, nn, cl, U, U ? uv[0][0] : 0, U ? uv[0][1] : 0);
		vert(c, nn, cl, U, U ? uv[2][0] : 0, U ? uv[2][1] : 0);
		vert(d, nn, cl, U, U ? uv[3][0] : 0, U ? uv[3][1] : 0);
	}
	// a quad with a normal at each corner
	function quadN(a, b, c, d, N, cl) { vert(a, N[0], cl, null, 0, 0); vert(b, N[1], cl, null, 0, 0); vert(c, N[2], cl, null, 0, 0); vert(a, N[0], cl, null, 0, 0); vert(c, N[2], cl, null, 0, 0); vert(d, N[3], cl, null, 0, 0); }
	// a box about (x, y, z), half sizes, turned by yaw about y, pitched about its own x, rolled about its own z
	function box(x, y, z, hx, hy, hz, cl, yaw = 0, pitch = 0, roll = 0, shades = SH6) {
		const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
		// R = Ry Rx Rz, its columns the box's axes in the lot's frame
		const ax = [cy * cr + sy * sp * sr, cp * sr, -sy * cr + cy * sp * sr];
		const ay = [-cy * sr + sy * sp * cr, cp * cr, sy * sr + cy * sp * cr];
		const az = [sy * cp, -sp, cy * cp];
		const P = (i, j, k) => [x + ax[0] * hx * i + ay[0] * hy * j + az[0] * hz * k, y + ax[1] * hx * i + ay[1] * hy * j + az[1] * hz * k, z + ax[2] * hx * i + ay[2] * hy * j + az[2] * hz * k];
		const p000 = P(-1, -1, -1), p100 = P(1, -1, -1), p010 = P(-1, 1, -1), p110 = P(1, 1, -1), p001 = P(-1, -1, 1), p101 = P(1, -1, 1), p011 = P(-1, 1, 1), p111 = P(1, 1, 1);
		const neg = (v) => [-v[0], -v[1], -v[2]];
		quad(p011, p111, p110, p010, ay, shade(cl, shades[0]));
		if (hy > 0.08) quad(p000, p100, p101, p001, neg(ay), shade(cl, shades[1]));
		quad(p001, p101, p111, p011, az, shade(cl, shades[2]));
		quad(p100, p000, p010, p110, neg(az), shade(cl, shades[3]));
		quad(p101, p100, p110, p111, ax, shade(cl, shades[4]));
		quad(p000, p001, p011, p010, neg(ax), shade(cl, shades[5]));
	}
	// a bar from a to b (rebar): two thin strips crossed along it
	function bar(a, b, r, cl) {
		const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
		if (L < 1e-3) return;
		// (two sides square to it: one level, one up)
		let sx = -dz, sz = dx;
		const sl = Math.hypot(sx, sz);
		if (sl < 1e-4) { sx = r * 1.6; sz = 0; } else { sx = sx / sl * r * 1.6; sz = sz / sl * r * 1.6; }
		const ux = (dy * sz) / L, uy = (dz * sx - dx * sz) / L, uz = (-dy * sx) / L;
		quad([a[0] - sx, a[1], a[2] - sz], [a[0] + sx, a[1], a[2] + sz], [b[0] + sx, b[1], b[2] + sz], [b[0] - sx, b[1], b[2] - sz], [0, 1, 0], cl);
		quad([a[0] - ux, a[1] - uy, a[2] - uz], [a[0] + ux, a[1] + uy, a[2] + uz], [b[0] + ux, b[1] + uy, b[2] + uz], [b[0] - ux, b[1] - uy, b[2] - uz], [sx, 0, sz], shade(cl, 0.8));
	}
	function geo() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, n * 3), 3));
		g.setAttribute('normal', new THREE.BufferAttribute(nor.slice(0, n * 3), 3));
		g.setAttribute('color', new THREE.BufferAttribute(col.slice(0, n * 3), 3));
		g.setAttribute('aFac', new THREE.BufferAttribute(fac.slice(0, n * 4), 4));
		g.setAttribute('aFU', new THREE.BufferAttribute(fu.slice(0, n * 2), 2));
		g.computeBoundingSphere();
		return g;
	}
	return { quad, quadN, box, bar, geo, count: () => n };
}
const SH6 = [1, 0.5, 0.8, 0.75, 0.85, 0.7];

// ---------- how it stands ----------
// how much of it came down and which way it fell; how high the walls stand at a point (lot
// frame, above the foot), before any rebuild
export function standingOf(o, rec) {
	const H = o.h - 1.2, st = facadeOf(o).storey, seed = rec.s || 0, c = rec.c || 0;
	const dirA = (seed % 628) / 100, dx = Math.cos(dirA), dz = Math.sin(dirA), Rr = Math.hypot(o.w, o.d) / 2;
	const at = (lx, lz) => {
		if (c <= 0) return H;
		const jag = (hash(Math.round(lx * 1.3) + seed, Math.round(lz * 1.3)) - 0.5) * Math.min(2.2, st * 0.7);
		const h = c >= 0.85 ? 0.8 + hash(Math.round(lx / 1.7), Math.round(lz / 1.7) + seed) * Math.min(2.6, H * 0.25) : H * (1 - c) + (dx * lx + dz * lz) / Rr * H * c * 0.55 + jag;
		return Math.min(H, Math.max(0.4, h));
	};
	return { at, c, H, st, dx, dz, Rr };
}

// the rubble's height above the foot at (lx, lz), for a damage record (and how far the
// clearing has gone, k from 1 down to 0). The mound leans the way the upper storeys fell.
export function rubbleAt(o, rec, lx, lz, k = 1) {
	if (k <= 0) return 0;
	let h = 0;
	const H = o.h - 1.2, c = rec.c || 0, seed = rec.s || 0;
	if (c > 0) {
		const dirA = (seed % 628) / 100, fx = -Math.cos(dirA), fz = -Math.sin(dirA);
		// (spilling further on the side it fell to)
		const m0 = Math.min(7, 1.2 + H * c * 0.22), lean = (lx * fx + lz * fz) / (Math.hypot(o.w, o.d) / 2 + 1);
		const m = m0 * (1 + 0.6 * Math.max(0, lean));
		// (a fifth or so of what stood: a storey's floors and walls pack down to a metre or less)
		const peak = Math.min(H * 0.3, Math.min(o.w, o.d) * 0.35, Math.max(0.6, H * c * 0.2 + 0.5)) * (1 + 0.25 * lean);
		const ex = Math.max(0, Math.abs(lx) - o.w / 2), ez = Math.max(0, Math.abs(lz) - o.d / 2);
		const edge = 1 - smooth(0, m, Math.hypot(ex, ez));
		const inner = smooth(0, Math.min(o.w, o.d) * 0.35, Math.min(o.w / 2 - Math.abs(lx), o.d / 2 - Math.abs(lz)) + m * 0.4);
		const amp = Math.min(1, 3 / peak);
		const lump = 1 + amp * (0.3 * (hash(Math.round(lx / 2.2), Math.round(lz / 2.2) + seed) - 0.5) + 0.14 * (hash(Math.round(lx / 0.9) + 3, Math.round(lz / 0.9) + seed) - 0.5)) + 0.18 * (hash(Math.round(lx / 6), Math.round(lz / 6) + seed + 1) - 0.5);
		h = Math.max(0, peak * edge * (0.45 + 0.55 * inner) * lump);
	}
	for (const [f, u, y, r] of rec.m || []) {
		const [px, pz] = onFace(o, f, u), d = Math.hypot(lx - px, lz - pz), R = r * 1.4;
		if (d < R && y - r < 2.5) h = Math.max(h, (1 - d / R) * Math.min(1.2, r * 0.45) * (0.8 + 0.4 * hash(Math.round(lx * 2), Math.round(lz * 2))));
	}
	return h * k;
}

// where it burns: a blast's holes (most of them) and a collapse's broken storeys and rubble,
// in the lot's frame: [lx, y, lz, how fiercely]
export function fireSpots(o, rec) {
	const out = [], S = standingOf(o, rec), seed = rec.s || 0;
	(rec.m || []).forEach(([f, u, y, r], i) => {
		if (!(rec.cause === 'blast' ? hash(i + 3, seed) < 0.65 : hash(i + 3, seed) < 0.2)) return;
		const [px, pz] = onFace(o, f, u), [nx, nz] = FACES[f];
		out.push([px - nx * 1.2, Math.max(0.2, y - r * 0.6), pz - nz * 1.2, Math.min(1.4, 0.5 + r * 0.4)]);
	});
	if (S.c > 0) {
		const n = S.c >= 0.85 ? 4 : 3;
		for (let i = 0; i < n; i++) {
			const lx = (hash(i * 5 + 1, seed) - 0.5) * o.w * 0.7, lz = (hash(i * 7 + 2, seed) - 0.5) * o.d * 0.7;
			const top = S.c >= 0.85 ? rubbleAt(o, rec, lx, lz) : Math.max(0.2, Math.floor(S.at(lx, lz) / S.st - 1) * S.st);
			out.push([lx, top + 0.2, lz, 0.8 + hash(i, seed + 9) * 0.7]);
		}
	}
	return out.slice(0, 6);
}

export function buildShell(o, rec, p = null, opts = {}) {
	const G = builder(), { quad, quadN, box, bar } = G;
	const H = o.h - 1.2, F = facadeOf(o), st = F.storey, wall = lin(o.col || [0.7, 0.68, 0.64]);
	const seed = rec.s || 0, lite = !!opts.lite;
	const S = standingOf(o, rec), c = S.c;
	// ---------- the rebuild's stages ----------
	// the rubble cleared (k down to 0); the frame up to frameY; the walls closed in to cladY;
	// glazed and finished to glazeY (each by whole storeys, all of it once done)
	const snap = (y) => (y >= H - 0.01 ? 1e9 : Math.floor(y / st + 1e-6) * st);
	const clearK = p === null ? 1 : 1 - smooth(0, 0.12, p);
	const frameY = p === null ? -1e9 : snap(H * smooth(0.18, 0.66, p) + st * 0.999);
	const cladY = p === null ? -1e9 : snap(H * smooth(0.3, 0.82, p));
	const glazeY = p === null ? -1e9 : snap(H * smooth(0.5, 0.97, p));
	const done = p !== null && p >= 0.999;
	// how high the walls stand, the rebuilt part counted
	const standing = (lx, lz) => Math.min(H, Math.max(S.at(lx, lz), cladY));
	const holes = (rec.m || []).map(([f, u, y, r]) => { const [hx, hz] = onFace(o, f, u); return [hx, y, hz, r, f]; });
	const holed = (lx, y, lz) => {
		if (y < cladY) return false;
		for (const [hx, hy, hz, r] of holes) { const k = 0.8 + 0.42 * hash(Math.round(lx * 2.6) + seed, Math.round(y * 2.6) + Math.round(lz * 2.6)); if (Math.hypot(lx - hx, y - hy, lz - hz) < r * k) return true; }
		return false;
	};
	const near = (lx, y, lz) => { let m = 1e9; for (const [hx, hy, hz, r] of holes) m = Math.min(m, Math.hypot(lx - hx, y - hy, lz - hz) - r); return m; };
	const sootAbove = (lx, y, lz) => y >= cladY && holes.some(([hx, hy, hz, rr]) => y > hy && y < hy + rr * 4 && Math.hypot(lx - hx, lz - hz) < rr * (1.1 + (y - hy) * 0.18));
	const T = 0.3;            // the walls' thickness
	const style = F.curtain ? 3 : F.shop ? 4 : F.house ? 2 : 1;
	const paintOf = (k, f) => PAINT[Math.floor(hash(k * 3 + f, seed + 1) * PAINT.length)];
	let rebars = 0;
	const RB = lite ? 60 : 220;
	const colBoxes = [];

	// ---------- the four faces ----------
	for (let f = 0; f < 4; f++) {
		const L = faceLen(o, f), [nx, nz] = FACES[f], tx = nz, tz = -nx;
		const nCol = Math.max(1, Math.round(L / 1.6)), cw = L / nCol;
		const rows = [[-1.2, 0, 0]];
		for (let k = 0; k * st < H - 0.2; k++) {
			const y0 = k * st, y1 = Math.min(H, (k + 1) * st);
			if (y1 - y0 > st * 0.8) { rows.push([y0, y0 + st * 0.28, k]); rows.push([y0 + st * 0.28, y0 + st * 0.76, k]); rows.push([y0 + st * 0.76, y1, k]); }
			else rows.push([y0, y1, k]);
		}
		const nR = rows.length;
		const P = (u, y, inset) => { const [lx, lz] = onFace(o, f, u); return [lx - nx * inset, y, lz - nz * inset]; };
		const UL = (u) => u + L / 2;
		// each column's top, each cell's state: 0 gone, 1 plain, 2 drawn on its own, 3 drawn finely (by a hole)
		// (the broken top runs on a line from one column's edge to the next, not in steps)
		const edgeTop = [];
		for (let i = 0; i <= nCol; i++) { const [ex, ez] = onFace(o, f, -L / 2 + i * cw); edgeTop.push(standing(ex, ez)); }
		const tops = [], cells = [];
		for (let i = 0; i < nCol; i++) {
			const um = -L / 2 + (i + 0.5) * cw, [cx, cz] = onFace(o, f, um);
			tops.push(c > 0 ? Math.min(edgeTop[i], edgeTop[i + 1], standing(cx, cz)) : standing(cx, cz));
			for (let r = 0; r < nR; r++) {
				const [y0, y1] = rows[r], ym = (y0 + y1) / 2;
				let s;
				if (y0 >= tops[i] - 0.05) s = 0;
				else if (r > 0 && holed(cx, ym, cz)) s = 0;
				else {
					const dg = r > 0 ? near(cx, ym, cz) : 1e9;
					s = dg < Math.max(cw, y1 - y0) * 0.9 ? 3 : (dg < 2.6 || y1 > tops[i] - 0.01 || sootAbove(cx, ym, cz)) ? 2 : 1;
				}
				cells.push(s);
			}
		}
		const at = (i, r) => (i < 0 || i >= nCol || r < 0 || r >= nR ? -1 : cells[i * nR + r]);
		const capped = (i) => c > 0 && i >= 0 && i < nCol && tops[i] < H - 0.05 && Math.max(edgeTop[i], edgeTop[i + 1]) > tops[i] + 0.05;
		// the facade a cell carries: its style and glass, by where it is in the rebuild
		const facOf = (y0, broken) => [style, st, cw, y0 < glazeY || done ? 0 : y0 < cladY ? 2 : broken ? 1 : 0];
		const colOf = (i, r, y0, y1, cx, cz) => {
			if (y0 < glazeY || done) return shade(wall, 0.97);
			if (y0 < cladY) return RAW;
			let cl = shade(wall, 0.9 + hash(i + f * 13, r) * 0.16);
			const dg = near(cx, (y0 + y1) / 2, cz);
			if (dg < 1.6) cl = shade(cl, 0.35 + Math.max(0, dg) * 0.35);
			if (sootAbove(cx, (y0 + y1) / 2, cz)) cl = mix(cl, SOOT, 0.5);
			return cl;
		};
		const n0 = [nx, 0, nz], nIn = [-nx, 0, -nz];
		// a panel u0..u1, y0..y1: its face outside, inside, and the wall's thickness where told
		const panel = (u0, u1, y0, y1, cl, fc, k, edges) => {
			const uv = [[UL(u0), y0], [UL(u1), y0], [UL(u1), y1], [UL(u0), y1]];
			quad(P(u0, y0, 0), P(u1, y0, 0), P(u1, y1, 0), P(u0, y1, 0), n0, cl, y0 >= 0 ? fc : null, uv);
			const inner = y0 >= 0 ? paintOf(k, f) : DARK;
			quad(P(u1, y0, T), P(u0, y0, T), P(u0, y1, T), P(u1, y1, T), nIn, inner, y0 >= 0 ? fc : null, [uv[1], uv[0], uv[3], uv[2]]);
			if (!edges) return;
			const [l, rt, b, t] = edges;
			if (l) quad(P(u0, y0, T), P(u0, y0, 0), P(u0, y1, 0), P(u0, y1, T), [-tx, 0, -tz], CORE);
			if (rt) quad(P(u1, y0, 0), P(u1, y0, T), P(u1, y1, T), P(u1, y1, 0), [tx, 0, tz], CORE);
			if (b) quad(P(u0, y0, T), P(u1, y0, T), P(u1, y0, 0), P(u0, y0, 0), [0, -1, 0], CORE);
			if (t) quad(P(u0, y1, 0), P(u1, y1, 0), P(u1, y1, T), P(u0, y1, T), [0, 1, 0], y1 >= H - 0.01 ? shade(wall, 0.7) : CORE);
		};
		// (bars out of a broken edge into the gap)
		const bars = (u, y, du, dy, n) => {
			for (let j = 0; j < n && rebars < RB; j++, rebars++) {
				const k = (j + 0.5) / n, a = P(u + (dy ? 0 : du * 0.02) + (dy ? (k - 0.5) * 0.9 : 0), y + (dy ? dy * 0.02 : (k - 0.5) * 0.9), T * 0.5);
				const len = 0.25 + hash(u * 7 + j, y * 5 + seed) * 0.55, bend = (hash(j + 1, u * 3 + y) - 0.5) * 0.5;
				bar(a, [a[0] + tx * du * len - nx * bend * 0.4, a[1] + dy * len - Math.abs(bend) * 0.3, a[2] + tz * du * len - nz * bend * 0.4], 0.016, REBAR);
			}
		};
		// the plain cells, merged into big panels (a row's runs, then runs alike above each other)
		const runs = [];
		for (let r = 0; r < nR; r++) {
			let i = 0;
			while (i < nCol) {
				if (at(i, r) !== 1) { i++; continue; }
				let j = i;
				while (j + 1 < nCol && at(j + 1, r) === 1) j++;
				runs.push([i, j, r, r]);
				i = j + 1;
			}
		}
		// (a run joins the one below it when they span the same columns and the same class of facade)
		const cls = (r) => { const y0 = rows[r][0]; return y0 < glazeY || done ? 0 : y0 < cladY ? 1 : 2; };
		runs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
		const merged = [];
		for (const q of runs) {
			const m = merged[merged.length - 1];
			if (m && m[0] === q[0] && m[1] === q[1] && m[3] + 1 === q[2] && cls(m[3]) === cls(q[2]) && (rows[q[2]][0] >= 0) === (rows[m[3]][0] >= 0)) m[3] = q[2];
			else merged.push([...q]);
		}
		for (const [i0, i1, r0, r1] of merged) {
			const u0 = -L / 2 + i0 * cw, u1 = -L / 2 + (i1 + 1) * cw, y0 = rows[r0][0], y1 = rows[r1][1];
			const cl = y0 < glazeY || done ? shade(wall, 0.97) : y0 < cladY ? RAW : shade(wall, 0.96);
			panel(u0, u1, y0, y1, cl, facOf(y0, false), rows[r0][2], null);
		}
		// the cells drawn on their own: coloured by the damage near, edged where a neighbour is gone
		for (let i = 0; i < nCol; i++) for (let r = 0; r < nR; r++) {
			const s = at(i, r);
			if (s < 2) continue;
			const u0 = -L / 2 + i * cw, u1 = u0 + cw, um = (u0 + u1) / 2, [cx, cz] = onFace(o, f, um);
			let [y0, y1, k] = rows[r];
			y1 = Math.min(y1, tops[i]);
			const broken = r > 0 && (near(cx, (y0 + y1) / 2, cz) < 2.5 || (c > 0 && y1 > tops[i] - 0.5));
			const cl = colOf(i, r, y0, y1, cx, cz), fc = facOf(y0, broken);
			if (s === 2) {
				const top = (r === nR - 1 || at(i, r + 1) === 0 || rows[r][1] > tops[i]) && !(capped(i) && rows[r][1] > tops[i]);
				panel(u0, u1, y0, y1, cl, fc, k, [at(i - 1, r) === 0, at(i + 1, r) === 0, r > 0 && at(i, r - 1) === 0, top]);
				continue;
			}
			// (by a hole: three by three, the ragged edge of it, bars out of the break)
			const du = cw / 3, dy = (y1 - y0) / 3;
			const solid = (u, y) => {
				const ii = Math.floor((u + L / 2) / cw), rr = rows.findIndex((q) => y >= q[0] && y < q[1]);
				const sN = at(ii, rr);
				if (sN <= 0 || y >= tops[ii] - 0.02) return false;
				if (sN !== 3) return true;
				const [lx, lz] = onFace(o, f, u);
				return !holed(lx, y, lz);
			};
			for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
				const su0 = u0 + a * du, su1 = su0 + du, sy0 = y0 + b * dy, sy1 = sy0 + dy, sm = su0 + du / 2, ym = sy0 + dy / 2;
				if (!solid(sm, ym)) continue;
				const gl = !solid(sm - du, ym), gr = !solid(sm + du, ym), gb = !solid(sm, ym - dy), gt = sy1 >= tops[i] - 0.02 || !solid(sm, ym + dy);
				panel(su0, su1, sy0, sy1, cl, fc, k, [gl, gr, gb, gt]);
				if (gl && hash(a + i * 3, b + r * 3 + seed) < 0.35) bars(su0, ym, -1, 0, 1);
				if (gr && hash(a + i * 3 + 1, b + r * 3 + seed) < 0.35) bars(su1, ym, 1, 0, 1);
				if (gt && sy1 < tops[i] - 0.05 && hash(a + i * 5, b + r * 3 + seed + 2) < 0.35) bars(sm, sy1, 0, 1, 1);
				if (gb && hash(a + i * 5 + 1, b + r * 3 + seed) < 0.3) bars(sm, sy0, 0, -1, 1);
			}
		}
		// the broken tops: from the column's lowest up to the line between its edges, its face,
		// its inside, and the broken top of the wall along it with the bars standing out
		for (let i = 0; i < nCol; i++) {
			if (!capped(i)) continue;
			const u0 = -L / 2 + i * cw, u1 = u0 + cw, y = tops[i], tl = Math.min(H, edgeTop[i]), tr = Math.min(H, edgeTop[i + 1]);
			const r = rows.findIndex((q) => y - 0.01 >= q[0] && y - 0.01 < q[1]);
			if (r < 0 || at(i, r) <= 0) continue;
			const [cx, cz] = onFace(o, f, (u0 + u1) / 2), cl = colOf(i, r, y, Math.max(tl, tr), cx, cz), fc = facOf(y, true);
			quad(P(u0, y, 0), P(u1, y, 0), P(u1, tr, 0), P(u0, tl, 0), n0, cl, fc, [[UL(u0), y], [UL(u1), y], [UL(u1), tr], [UL(u0), tl]]);
			quad(P(u1, y, T), P(u0, y, T), P(u0, tl, T), P(u1, tr, T), nIn, paintOf(rows[r][2], f), fc, [[UL(u1), y], [UL(u0), y], [UL(u0), tl], [UL(u1), tr]]);
			quad(P(u0, tl, 0), P(u1, tr, 0), P(u1, tr, T), P(u0, tl, T), [0, 1, 0], CORE);
			if (i === 0 || !capped(i - 1)) quad(P(u0, y, T), P(u0, y, 0), P(u0, tl, 0), P(u0, tl, T), [-tx, 0, -tz], CORE);
			if (i === nCol - 1 || !capped(i + 1)) quad(P(u1, y, 0), P(u1, y, T), P(u1, tr, T), P(u1, tr, 0), [tx, 0, tz], CORE);
			if (hash(i * 3 + f, seed) < 0.6) bars((u0 + u1) / 2, (tl + tr) / 2, 0, 1, 2);
		}
		// what stops you: each column's wall from the ground to its first gap (a gap at the
		// foot is a way in), runs of equal height together
		let run = null;
		const flush = () => { if (run) { colBoxes.push([f, run.u0, run.u1, run.h]); run = null; } };
		for (let i = 0; i < nCol; i++) {
			let h = -1.2;
			for (let r = 0; r < nR; r++) { if (at(i, r) <= 0 || rows[r][0] > h + 0.05) break; h = Math.min(rows[r][1], tops[i]); }
			const u0 = -L / 2 + i * cw, u1 = u0 + cw;
			if (h < 0.7) { flush(); continue; }
			if (run && Math.abs(run.h - h) < 0.3) { run.u1 = u1; run.h = Math.min(run.h, h); } else { flush(); run = { u0, u1, h }; }
		}
		flush();
	}

	// ---------- the floors: whole where the walls hold them, broken off and hanging where not ----------
	const hw = o.w / 2 - T, hd = o.d / 2 - T;
	const gx = Math.max(2, Math.round(o.w / 3.2)), gz = Math.max(2, Math.round(o.d / 3.2)), sx = 2 * hw / gx, sz = 2 * hd / gz;
	const cellC = (i, j) => [-hw + (i + 0.5) * sx, -hd + (j + 0.5) * sz];
	let hangs = 0;
	const HANG = lite ? 10 : 36;
	for (let k = 1; k * st < H - 0.3; k++) {
		const y = k * st, framed = y < frameY;
		if (c >= 0.85 && !framed) break;
		const held = (i, j) => { if (framed || c <= 0) return true; const [lx, lz] = cellC(i, j); return S.at(lx, lz) > y + 0.5 + (hash(i * 7 + k, j * 3 + seed) - 0.5) * 0.8; };
		const inside = (i, j) => i >= 0 && j >= 0 && i < gx && j < gz;
		const fl = framed && y >= cladY ? RAW : shade(RAW, 0.85);
		for (let j = 0; j < gz; j++) {
			let i = 0;
			while (i < gx) {
				if (!held(i, j)) { i++; continue; }
				let e = i;
				while (e + 1 < gx && held(e + 1, j)) e++;
				const x0 = -hw + i * sx, x1 = -hw + (e + 1) * sx, z0 = -hd + j * sz, z1 = z0 + sz;
				quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], fl);
				quad([x0, y - 0.25, z0], [x1, y - 0.25, z0], [x1, y - 0.25, z1], [x0, y - 0.25, z1], [0, -1, 0], CEIL);
				i = e + 1;
			}
		}
		if (framed) {
			// (the new frame's edge beams round the slab, formwork at the top storey being cast)
			if (y >= cladY) for (const [ax, az, bx, bz] of [[-hw, hd, hw, hd], [-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [-hw, -hd, -hw, hd]]) box((ax + bx) / 2, y - 0.22, (az + bz) / 2, Math.max(0.2, Math.abs(bx - ax) / 2 + 0.2), 0.22, Math.max(0.2, Math.abs(bz - az) / 2 + 0.2), RAW);
			if (y + st >= frameY && !done) for (const [ax, az, bx, bz] of [[-hw, hd, hw, hd], [-hw, -hd, hw, -hd]]) box((ax + bx) / 2, y + 0.3, (az + bz) / 2, Math.abs(bx - ax) / 2, 0.3, 0.04, FORM);
			continue;
		}
		// the broken edges, and the pieces hanging off them
		if (c <= 0) continue;
		for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
			if (!held(i, j)) continue;
			const [cx, cz] = cellC(i, j);
			for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				if (!inside(i + di, j + dj) || held(i + di, j + dj)) continue;
				const ex = cx + di * sx / 2, ez = cz + dj * sz / 2, len = (di ? sz : sx) / 2;
				const ax = dj ? 1 : 0, az = di ? 1 : 0;
				// (the slab's broken edge, CORE, a little ragged)
				quad([ex - ax * len, y, ez - az * len], [ex + ax * len, y, ez + az * len], [ex + ax * len, y - 0.25, ez + az * len], [ex - ax * len, y - 0.25, ez - az * len], [di, 0, dj], CORE);
				const outside = Math.abs(ex + di * 0.6) > hw + 0.01 || Math.abs(ez + dj * 0.6) > hd + 0.01;
				const r = hash(i * 13 + k * 7 + di * 3, j * 11 + dj * 5 + seed);
				if (!outside && hangs < HANG && r < 0.55) {
					// a piece cracked off and hanging from its bars: hinged at the edge, swung down
					hangs++;
					const L2 = (di ? sx : sz) * (0.55 + 0.4 * hash(i + k, j + seed)), wide = len * (0.6 + 0.35 * r), th = 0.5 + 0.75 * hash(j + k * 3, i + seed), yaw = Math.atan2(di, dj);
					const dx = Math.sin(yaw), dz = Math.cos(yaw), down = Math.sin(th), out = Math.cos(th);
					const off = (r - 0.25) * len * 0.5;
					box(ex + dx * out * L2 / 2 + ax * off, y - 0.125 - down * L2 / 2, ez + dz * out * L2 / 2 + az * off, wide, 0.125, L2 / 2, shade(RAW, 0.8), yaw, th, (hash(i, j + k) - 0.5) * 0.25);
					for (let b = 0; b < 4 && rebars < RB; b++, rebars++) {
						const s = (b / 3 - 0.5) * wide * 1.6;
						bar([ex + ax * (off + s), y - 0.12, ez + az * (off + s)], [ex + ax * (off + s) + dx * 0.25, y - 0.32, ez + az * (off + s) + dz * 0.25], 0.014, REBAR);
					}
				} else if (rebars < RB && r < 0.85) {
					for (let b = 0; b < 3; b++, rebars++) { const s = (b / 2 - 0.5) * len * 1.4, l2 = 0.3 + hash(b + i, j + k) * 0.6; bar([ex + ax * s, y - 0.12, ez + az * s], [ex + ax * s + di * l2, y - 0.12 - l2 * 0.35, ez + az * s + dj * l2], 0.014, REBAR); }
				}
			}
		}
	}

	// ---------- the frame: columns up out of the break (bars bent at their tops), or the new work rising ----------
	{
		const ncx = Math.max(2, Math.round(o.w / 6) + 1), ncz = Math.max(2, Math.round(o.d / 6) + 1);
		for (let a = 0; a < ncx; a++) for (let b = 0; b < ncz; b++) {
			const lx = -hw + 0.3 + (2 * hw - 0.6) * a / (ncx - 1), lz = -hd + 0.3 + (2 * hd - 0.6) * b / (ncz - 1);
			const edge = a === 0 || b === 0 || a === ncx - 1 || b === ncz - 1;
			let top;
			if (frameY > S.at(lx, lz) + 0.5 && !done) top = Math.min(H, frameY + (frameY < H ? 1.2 : 0));
			else if (c > 0) {
				const sAt = S.at(lx, lz), r = hash(a * 3 + 1, b * 5 + seed);
				if (c >= 0.85) top = rubbleAt(o, rec, lx, lz, clearK) + 0.6 + r * Math.min(4, H * 0.3);
				else if (sAt < H - 0.5) top = Math.min(H, sAt + 0.4 + r * st * 0.8);
				else continue;
				if (r < 0.25) continue;
			} else continue;
			if (!edge && top < 1) continue;
			const tilt = c >= 0.85 && frameY < 0 ? (hash(a, b + seed) - 0.5) * 0.5 : 0;
			box(lx, top / 2, lz, 0.25, top / 2, 0.25, frameY > 0 && top > S.at(lx, lz) ? RAW : shade(RAW, 0.9), 0, tilt, 0);
			// (the bars standing out of its top, bent this way and that)
			for (let q = 0; q < 4 && rebars < RB; q++, rebars++) {
				const ox = (q & 1 ? 0.16 : -0.16), oz = (q & 2 ? 0.16 : -0.16), l2 = 0.4 + hash(q + a, b + seed) * 0.9, bx = c > 0 && frameY < 0 ? (hash(q, a + b) - 0.5) * 0.9 : 0;
				bar([lx + ox, top - 0.05, lz + oz], [lx + ox + bx, top + l2, lz + oz + (hash(a + q, b) - 0.5) * (c > 0 ? 0.6 : 0.05)], 0.015, REBAR);
			}
		}
	}

	// ---------- the rooms seen through the holes: partitions, and the odd desk or cabinet ----------
	if (!done) {
		const roomsUp = Math.min(Math.ceil(H / st), lite ? 4 : 12);
		let sMin = H;
		for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, 0]]) sMin = Math.min(sMin, S.at(lx, lz));
		const px = [], pz = [];
		for (let x = -hw + 4 + hash(1, seed) * 2; x < hw - 3; x += 4.5 + hash(x, seed) * 3) px.push(x);
		for (let z = -hd + 4 + hash(2, seed) * 2; z < hd - 3; z += 5 + hash(z, seed) * 3) pz.push(z);
		let furn = 0;
		const FURN = lite ? 8 : 40;
		for (let k = 0; k < roomsUp; k++) {
			const y0 = k * st, y1 = y0 + st - 0.25;
			if (y0 < cladY) continue;
			// (only the storeys with an opening near: what would be seen)
			const open = holes.some(([, hy, , r]) => Math.abs(hy - (y0 + st / 2)) < r + st) || (c > 0 && c < 0.85 && y0 + st >= sMin - st);
			if (!open || c >= 0.85) continue;
			const piece = (ax, az, bx, bz) => {
				const mx = (ax + bx) / 2, mz = (az + bz) / 2, top = Math.min(y1, S.at(mx, mz) - 0.3);
				if (top - y0 < 1.2) return;
				const cl = PAINT[Math.floor(hash(mx * 0.7 + k, mz * 0.7 + seed) * PAINT.length)];
				box(mx, y0 + (top - y0) / 2, mz, Math.max(0.06, Math.abs(bx - ax) / 2), (top - y0) / 2, Math.max(0.06, Math.abs(bz - az) / 2), cl, 0, 0, 0, [0.8, 0.6, 1, 0.95, 0.9, 0.85]);
			};
			for (const x of px) for (let z = -hd; z < hd - 0.1; z += 3) { const z2 = Math.min(hd, z + 3); if (hash(x * 3 + k, z + seed) < 0.8) piece(x - 0.06, z, x + 0.06, z2 - (hash(z, k) < 0.25 ? 0.95 : 0)); }
			for (const z of pz) for (let x = -hw; x < hw - 0.1; x += 3) { const x2 = Math.min(hw, x + 3); if (hash(z * 3 + k, x + seed) < 0.8) piece(x, z - 0.06, x2 - (hash(x, k) < 0.25 ? 0.95 : 0), z + 0.06); }
			// (furniture along the outer walls where the holes look in)
			for (const [hx, hy, hz, r, f] of holes) {
				if (Math.abs(hy - (y0 + 1)) > r + 1.5 || furn >= FURN) continue;
				const [nx, nz] = FACES[f];
				for (let q = 0; q < 2 && furn < FURN; q++, furn++) {
					const tw = hash(q + k, hx + seed), along = (q - 0.5) * 2.4, ix = hx - nx * (1.6 + tw * 1.5) + nz * along, iz = hz - nz * (1.6 + tw * 1.5) - nx * along;
					if (Math.abs(ix) > hw - 0.5 || Math.abs(iz) > hd - 0.5 || S.at(ix, iz) < y0 + 1.5) continue;
					const kind = Math.floor(tw * 3), cl = WOODS[Math.floor(hash(q, k + seed) * WOODS.length)], yaw = Math.atan2(nx, nz) + (tw - 0.5) * 0.6;
					if (kind === 0) { box(ix, y0 + 0.73, iz, 0.7, 0.03, 0.38, cl, yaw); box(ix - 0.6, y0 + 0.36, iz, 0.04, 0.36, 0.35, cl, yaw); box(ix + 0.6, y0 + 0.36, iz, 0.04, 0.36, 0.35, cl, yaw); }
					else if (kind === 1) box(ix, y0 + 0.95, iz, 0.45, 0.95, 0.25, cl, yaw);
					else { box(ix, y0 + 0.22, iz, 0.9, 0.22, 0.42, shade(cl, 1.4), yaw); box(ix, y0 + 0.55, iz - 0.0, 0.9, 0.3, 0.1, shade(cl, 1.2), yaw); }
				}
			}
		}
	}

	// ---------- the roof, while there is one: flat (its parapet the walls' tops) or pitched over a house ----------
	if (c <= 0 || done) {
		const yT = H;
		if (o.roof && o.roof.h > 0.2) {
			const rc = lin(o.roof.col || [0.3, 0.3, 0.32]), ov = 0.3, rh = o.roof.h;
			const along = o.roof.rot ? 'z' : 'x', A = (along === 'x' ? o.w : o.d) / 2 + ov, B = (along === 'x' ? o.d : o.w) / 2 + ov;
			const ridge = o.roof.hip ? Math.max(0, A - B) : A;
			const W2 = (a, b, y) => (along === 'x' ? [a, y, b] : [b, y, a]);
			for (const s of [-1, 1]) {
				const n = along === 'x' ? [0, B, s * rh] : [s * rh, B, 0], l = Math.hypot(...n), nn = n.map((v) => v / l);
				quad(W2(-A, s * B, yT), W2(A, s * B, yT), W2(ridge, 0, yT + rh), W2(-ridge, 0, yT + rh), nn, shade(rc, 0.95));
				if (o.roof.hip) { const m = along === 'x' ? [s * rh, A - ridge, 0] : [0, A - ridge, s * rh], ml = Math.hypot(...m) || 1; quad(W2(s * A, s * B, yT), W2(s * A, -s * B, yT), W2(s * ridge, 0, yT + rh), W2(s * ridge, 0, yT + rh), m.map((v) => v / ml), shade(rc, 0.85)); }
				else quad(W2(s * A, -B, yT), W2(s * A, B, yT), W2(s * A, 0, yT + rh), W2(s * A, 0, yT + rh), along === 'x' ? [s, 0, 0] : [0, 0, s], shade(wall, 0.85));
			}
		} else quad([-o.w / 2, yT, o.d / 2], [o.w / 2, yT, o.d / 2], [o.w / 2, yT, -o.d / 2], [-o.w / 2, yT, -o.d / 2], [0, 1, 0], shade(wall, 0.55));
	}

	// ---------- the rubble: its mound, the slabs pancaked in it, and what lies on it ----------
	const rub = [];
	if (clearK > 0) {
		const lean = 1.6;
		const m = c > 0 ? Math.min(7, 1.2 + H * c * 0.22) * lean : 2.5, X0 = -o.w / 2 - m, X1 = o.w / 2 + m, Z0 = -o.d / 2 - m, Z1 = o.d / 2 + m;
		const N = Math.max(4, Math.min(lite ? 12 : 22, Math.round(Math.max(X1 - X0, Z1 - Z0) / 2.2)));
		const hAt = (x, z) => rubbleAt(o, rec, x, z, clearK);
		const dust = lin([0.66, 0.62, 0.55]);
		// (the heap shaded smooth: each corner's normal from the slope round it)
		const nAt = (x, z) => { const e = 0.6, gx = (hAt(x + e, z) - hAt(x - e, z)) / (2 * e), gz = (hAt(x, z + e) - hAt(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, -gz / l]; };
		for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
			const x0 = X0 + (X1 - X0) * i / N, x1 = X0 + (X1 - X0) * (i + 1) / N, z0 = Z0 + (Z1 - Z0) * j / N, z1 = Z0 + (Z1 - Z0) * (j + 1) / N;
			const h00 = hAt(x0, z0), h10 = hAt(x1, z0), h11 = hAt(x1, z1), h01 = hAt(x0, z1);
			if (h00 + h10 + h11 + h01 < 0.04) continue;
			// (dusty grey, with the wall's colour, a room's paint and soot in patches)
			// (in clumps a few cells across, not cell by cell)
			const r = hash(i + seed, j), r2 = hash(Math.floor(j / 3) + 3, Math.floor(i / 3) + seed);
			let cl = shade(dust, 0.86 + r * 0.12);
			if (r2 < 0.22) cl = mix(cl, wall, 0.55); else if (r2 > 0.9) cl = mix(cl, PAINT[Math.floor(r * PAINT.length)], 0.4); else if (r2 > 0.8) cl = shade(cl, 0.45);
			quadN([x0, h00 - 0.05, z0], [x0, h01 - 0.05, z1], [x1, h11 - 0.05, z1], [x1, h10 - 0.05, z0], [nAt(x0, z0), nAt(x0, z1), nAt(x1, z1), nAt(x1, z0)], cl);
		}
		// the slabs pancaked into a full collapse, tilted and half buried
		if (c >= 0.85) {
			const nSlab = Math.min(lite ? 2 : 5, 1 + Math.floor(H / st / 2));
			for (let q = 0; q < nSlab; q++) {
				const r1 = hash(q + 1, seed + 7), r2 = hash(q + 5, seed + 3), lx = (r1 - 0.5) * o.w * 0.4, lz = (r2 - 0.5) * o.d * 0.4;
				const y = hAt(lx, lz) * (0.55 + 0.3 * r1);
				box(lx, y, lz, o.w * (0.18 + 0.12 * r2), 0.14, o.d * (0.16 + 0.12 * r1), shade(RAW, 0.75 + 0.15 * r2), r1 * 0.8 - 0.4, (r2 - 0.5) * 0.5, (r1 - 0.5) * 0.45);
			}
		}
		// blocks of every size on it: grit, chunks, broken slabs with their bars
		const nb = Math.min(lite ? 70 : 180, Math.round((c > 0 ? 40 + H * c * 3.5 : 8 * (rec.m?.length || 0)) * clearK));
		for (let k = 0; k < nb; k++) {
			const r1 = hash(k * 3 + seed, 11), r2 = hash(k * 7, seed + 5), r3 = hash(k + 2, seed * 3 + 1);
			let x, z;
			if (c > 0) { x = X0 + r1 * (X1 - X0); z = Z0 + r2 * (Z1 - Z0); }
			else { const hl = rec.m[k % rec.m.length], [hx, hz] = onFace(o, hl[0], hl[1]), [nx, nz] = FACES[hl[0]], a = r1 * Math.PI * 2, rr = r2 * hl[3] * 1.6; x = hx + Math.cos(a) * rr + nx * rr * 0.5; z = hz + Math.sin(a) * rr + nz * rr * 0.5; }
			const y = hAt(x, z);
			if (y < 0.05 && r3 < 0.35) continue;
			// (most small, some middling, a few great slabs)
			const kind = r3 < 0.58 ? 0 : r3 < 0.9 ? 1 : 2;
			const s = kind === 0 ? 0.12 + r1 * 0.3 : kind === 1 ? 0.45 + r2 * 0.8 : 1.4 + r1 * (c > 0 ? 2.4 : 0.8);
			const bw = s * (kind === 2 ? 1.5 : 1), bh = kind === 2 ? 0.22 : s * (0.55 + r1 * 0.45), bd = s * (kind === 2 ? 1 : 0.7 + r2 * 0.5);
			const yaw = r1 * 6.28, tilt = (r2 - 0.5) * (kind === 2 ? 0.9 : 0.6), roll = (r3 - 0.5) * 0.5;
			const cl = r2 < 0.45 ? shade(wall, 0.65 + r1 * 0.3) : r2 < 0.55 ? PAINT[Math.floor(r1 * PAINT.length)] : r2 > 0.95 ? SOOT : shade(CORE, 1.05 + r1 * 0.45);
			rub.push([x, y, z, bw, bh, bd]);
			box(x, y + bh * 0.3, z, bw / 2, bh / 2, bd / 2, cl, yaw, tilt, roll);
			if (kind === 2 && rebars < RB) for (let b = 0; b < 3; b++, rebars++) { const ex = x + Math.sin(yaw) * bd / 2, ez = z + Math.cos(yaw) * bd / 2, s2 = (b - 1) * bw * 0.3; bar([ex + Math.cos(yaw) * s2, y + bh * 0.3, ez - Math.sin(yaw) * s2], [ex + Math.cos(yaw) * s2 + Math.sin(yaw) * 0.6, y + bh * 0.3 + 0.2 + r3 * 0.4, ez - Math.sin(yaw) * s2 + Math.cos(yaw) * 0.6], 0.015, REBAR); }
		}
	}
	// the boxes that stop you, in the lot's frame: [lx0, lz0, lx1, lz1, y0, y1]
	const solid = colBoxes.map(([f, u0, u1, h]) => {
		const [ax, az] = onFace(o, f, u0), [bx, bz] = onFace(o, f, u1), [nx, nz] = FACES[f];
		const ix = -nx * T, iz = -nz * T;
		return [Math.min(ax, bx, ax + ix, bx + ix), Math.min(az, bz, az + iz, bz + iz), Math.max(ax, bx, ax + ix, bx + ix), Math.max(az, bz, az + iz, bz + iz), -1.2, h];
	});
	return { geo: G.geo(), solid, rubble: (lx, lz) => rubbleAt(o, rec, lx, lz, clearK), standing, verts: G.count(), blocks: rub.length, rebars, hangs };
}
