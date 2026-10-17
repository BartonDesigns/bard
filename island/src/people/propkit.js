// The making of small things people carry (bags, keys, a phone, a scarf): a few shapes to
// build them from and one material to draw them all. Every vertex carries its colour and a
// little more (kit: how glossy, what it is made of, whether the bag's own colour or its
// accent tints it), so a whole bag, seams, zips, handles and all, is one geometry made once
// and shared, and two people with the same bag in different colours share it too.
// The material's shader adds the cloth's weave, the paper's fibres, the leather's grain and
// the crinkle of a plastic bag from where each point sits, fading the fine ones out with
// distance so nothing shimmers; the insides of open bags are in shadow.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// what a part is made of (kit.y)
export const FAB = Object.freeze({ none: 0, nylon: 1, canvas: 2, paper: 3, leather: 4, plastic: 5, knit: 6, fur: 7 });

const V = THREE.Vector3;
export const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
// smooth value noise, for lumps and creases
export function vnoise(x, y, z = 0) {
	const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
	const u = (t) => t * t * (3 - 2 * t), a = u(fx), b = u(fy), c = u(fz);
	const L = (i, j, k) => hash(ix + i, iy + j, iz + k), m = (p, q, t) => p + (q - p) * t;
	return m(m(m(L(0, 0, 0), L(1, 0, 0), a), m(L(0, 1, 0), L(1, 1, 0), a), b), m(m(L(0, 0, 1), L(1, 0, 1), a), m(L(0, 1, 1), L(1, 1, 1), a), b), c);
}

// parts gathered into one geometry: position, normal, colour, kit (gloss, fabric, tint)
// tint: 0 the colour as given, 1 times the bag's colour, 2 times its accent
export function kit() {
	const P = [], N = [], C = [], K = [];
	const api = {
		add(geo, { col = 0xffffff, tint = 0, fab = 0, gloss = 0, shade = null, at = null } = {}) {
			if (at) geo.applyMatrix4(at);
			const g = geo.index ? geo.toNonIndexed() : geo;
			if (!g.attributes.normal) g.computeVertexNormals();
			const pa = g.attributes.position, na = g.attributes.normal, sa = g.attributes.shade, c = lin(col);
			for (let i = 0; i < pa.count; i++) {
				const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), s = (shade ? shade(x, y, z) : 1) * (sa ? sa.getX(i) : 1);
				P.push(x, y, z); N.push(na.getX(i), na.getY(i), na.getZ(i)); C.push(c[0] * s, c[1] * s, c[2] * s); K.push(gloss, fab, tint);
			}
			return api;
		},
		done() {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
			g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
			g.setAttribute('kit', new THREE.Float32BufferAttribute(K, 3));
			g.computeBoundingSphere(); g.computeBoundingBox();
			g.userData.shared = true; g.userData.tris = P.length / 9;
			return g;
		},
	};
	return api;
}

// one smooth surface (seams welded, normals shared)
export function smooth(g) {
	for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
	const m = mergeVertices(g, 1e-5);
	m.computeVertexNormals();
	return m;
}
// every point moved by fn(x, y, z) -> [x, y, z], then smoothed
export function reshape(g, fn) {
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v[0], v[1], v[2]); }
	return smooth(g);
}

// a box with rounded edges and corners: w x h x d, radius r, k rows round each edge (k 0: a
// plain box), centred on the origin
export function rbox(w, h, d, r, k = 2) {
	if (k < 1) return smooth(new THREE.BoxGeometry(w, h, d));
	r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
	const n = 2 * k + 2, g = new THREE.BoxGeometry(1, 1, 1, n, n, n), pa = g.attributes.position, m = 1 / n;
	const half = [w / 2, h / 2, d / 2], inner = half.map((v) => v - r);
	// the grid packed towards the edges, so the rounding has its rows and the flats few
	const place = (s, a) => { const u = Math.abs(s), q = u <= m ? (u / m) * a : a + Math.min(1, (u - m) / (0.5 - m)) * r; return Math.sign(s) * q; };
	const p = new V(), c = new V();
	for (let i = 0; i < pa.count; i++) {
		p.set(place(pa.getX(i), inner[0]), place(pa.getY(i), inner[1]), place(pa.getZ(i), inner[2]));
		c.set(THREE.MathUtils.clamp(p.x, -inner[0], inner[0]), THREE.MathUtils.clamp(p.y, -inner[1], inner[1]), THREE.MathUtils.clamp(p.z, -inner[2], inner[2]));
		p.sub(c); const l = p.length() || 1;
		p.multiplyScalar(r / l).add(c);
		pa.setXYZ(i, p.x, p.y, p.z);
	}
	return smooth(g);
}

// a rounded rectangle's outline, n points evenly along it, starting at the front middle (+z)
// and going round towards +x: [{ x, z, nx, nz, side }] (side: 0 front, 1 +x, 2 back, 3 -x;
// corners belong to the face they lead into)
export function outline(hw, hd, rr, n) {
	rr = Math.min(rr, hw - 1e-4, hd - 1e-4);
	const fx = hw - rr, fz = hd - rr, arc = Math.PI * rr / 2;
	const segs = [[fx, 0], [arc, 1], [2 * fz, 1], [arc, 2], [2 * fx, 2], [arc, 3], [2 * fz, 3], [arc, 0], [fx, 0]];
	const total = segs.reduce((s, q) => s + q[0], 0), out = [];
	for (let i = 0; i < n; i++) {
		let L = (i / n) * total, k = 0;
		while (k < segs.length - 1 && L > segs[k][0]) { L -= segs[k][0]; k++; }
		let x, z, a;
		if (k === 0) { x = L; z = hd; a = Math.PI / 2; }
		else if (k === 2) { x = hw; z = fz - L; a = 0; }
		else if (k === 4) { x = fx - L; z = -hd; a = -Math.PI / 2; }
		else if (k === 6) { x = -hw; z = -fz + L; a = Math.PI; }
		else if (k === 8) { x = -fx + L; z = hd; a = Math.PI / 2; }
		else {
			const cx = k === 1 || k === 3 ? fx : -fx, cz = k === 1 || k === 7 ? fz : -fz, a0 = { 1: Math.PI / 2, 3: 0, 5: -Math.PI / 2, 7: Math.PI }[k];
			a = a0 - L / rr; x = cx + Math.cos(a) * rr; z = cz + Math.sin(a) * rr;
		}
		out.push({ x, z, nx: Math.cos(a), nz: Math.sin(a), side: segs[k][1] });
	}
	return out;
}

// a soft shape through rings (each [[x, y, z], ...], the same count each, going the same way
// round), closed at the bottom and, if asked, at the top; facing out
export function loft(rings, { bottom = true, top = false } = {}) {
	const M = rings[0].length, pos = [], side = [], caps = [];
	for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
	for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < M; k++) { const a = i * M + k, b = i * M + (k + 1) % M; side.push(a, a + M, b, b, a + M, b + M); }
	const cap = (ri, down) => {
		const r = rings[ri], c = pos.length / 3, t = [];
		let x = 0, y = 0, z = 0; for (const p of r) { x += p[0]; y += p[1]; z += p[2]; }
		pos.push(x / M, y / M, z / M);
		for (let k = 0; k < M; k++) t.push(c, ri * M + k, ri * M + (k + 1) % M);
		caps.push([t, down]);
	};
	if (bottom) cap(0, true);
	if (top) cap(rings.length - 1, false);
	const P = (i) => new V(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
	const normalOf = (t) => new V().subVectors(P(t[2]), P(t[0])).cross(new V().subVectors(P(t[1]), P(t[0])));
	// the sides face away from the middle; the caps up or down
	const mi = Math.floor((rings.length - 1) / 2), centre = new V();
	for (const p of rings[mi]) centre.add(new V(p[0], p[1], p[2]));
	centre.multiplyScalar(1 / M);
	const t0 = side.slice(M * 6 * mi, M * 6 * mi + 3);
	const out = new V().subVectors(P(t0[0]), centre); out.y = 0;
	const flip = (t) => { for (let i = 0; i < t.length; i += 3) { const s = t[i + 1]; t[i + 1] = t[i + 2]; t[i + 2] = s; } };
	if (normalOf(t0).dot(out) < 0) flip(side);
	for (const [t, down] of caps) if ((normalOf(t.slice(0, 3)).y < 0) !== down) flip(t);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setIndex([...side, ...caps.flatMap((c) => c[0])]);
	g.computeVertexNormals();
	return g;
}

// a strap: a flattened tube through pts, its flat face towards ups (one per point, or one
// for all); width and thickness numbers or functions of the way along (0..1)
export function ribbon(pts, ups, width, thick, { seg = 16, prof = 8, round = 0.4 } = {}) {
	const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pos = [], idx = [];
	const T = new V(), N = new V(), B = new V(), U = new V(), up = Array.isArray(ups) ? ups : [ups];
	for (let i = 0; i <= seg; i++) {
		const t = i / seg, Pt = curve.getPointAt(t); curve.getTangentAt(t, T);
		const f = t * (up.length - 1), i0 = Math.floor(f), i1 = Math.min(up.length - 1, i0 + 1);
		U.copy(up[i0]).lerp(up[i1], f - i0);
		N.copy(U).addScaledVector(T, -U.dot(T)).normalize(); B.crossVectors(T, N);
		const w = (typeof width === 'function' ? width(t) : width) / 2, h = (typeof thick === 'function' ? thick(t) : thick) / 2;
		for (let j = 0; j < prof; j++) {
			const a = (j / prof) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), cx = Math.sign(c) * Math.pow(Math.abs(c), round) * w, sy = Math.sign(s) * Math.pow(Math.abs(s), round) * h;
			pos.push(Pt.x + B.x * cx + N.x * sy, Pt.y + B.y * cx + N.y * sy, Pt.z + B.z * cx + N.z * sy);
		}
	}
	for (let i = 0; i < seg; i++) for (let j = 0; j < prof; j++) { const a = i * prof + j, b = i * prof + (j + 1) % prof; idx.push(a, b, a + prof, b, b + prof, a + prof); }
	// the ends closed
	for (const [ring, flip] of [[0, true], [seg, false]]) {
		const c = pos.length / 3, P0 = curve.getPointAt(ring / seg);
		pos.push(P0.x, P0.y, P0.z);
		for (let j = 0; j < prof; j++) { const a = ring * prof + j, b = ring * prof + (j + 1) % prof; if (flip) idx.push(c, b, a); else idx.push(c, a, b); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setIndex(idx);
	g.computeVertexNormals();
	// (facing out: the first ring's first point is on +B; its normal should be too)
	const n0 = new V().fromBufferAttribute(g.attributes.normal, prof), p0 = new V().fromBufferAttribute(g.attributes.position, prof), c0 = curve.getPointAt(1 / seg);
	if (n0.dot(p0.sub(c0)) < 0) { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const s = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = s; } g.computeVertexNormals(); }
	return g;
}

// a round cord through pts; shade(i along, j round) colours it (a twist, a stitch)
export function cord(pts, r, { seg = 24, radial = 6, closed = false, shade = null } = {}) {
	const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), seg, r, radial, closed);
	if (shade) { const s = new Float32Array(g.attributes.position.count); for (let i = 0; i <= seg; i++) for (let j = 0; j <= radial; j++) s[i * (radial + 1) + j] = shade(i / seg, j / radial); g.setAttribute('shade', new THREE.BufferAttribute(s, 1)); }
	return g;
}

// where a ray from `from` along `dir` meets the surface, lifted off it by `lift`
export function prober(geo) {
	const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), ray = new THREE.Raycaster();
	return (from, dir, lift = 0) => {
		ray.set(from, dir.clone().normalize());
		const h = ray.intersectObject(mesh, false)[0];
		return h ? { p: h.point.clone().addScaledVector(h.face.normal, lift), n: h.face.normal.clone() } : null;
	};
}
export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), typeof s === 'number' ? new V(s, s, s) : new V(...s));

// ---------- the material ----------
const GLSL = `
uniform vec3 uKitA; uniform vec3 uKitB;
varying vec3 vKit; varying vec3 vRest; varying vec3 vRestN;
float kHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float kNoise(vec3 x) {
	vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(kHash(i), kHash(i + vec3(1, 0, 0)), f.x), mix(kHash(i + vec3(0, 1, 0)), kHash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(kHash(i + vec3(0, 0, 1)), kHash(i + vec3(1, 0, 1)), f.x), mix(kHash(i + vec3(0, 1, 1)), kHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// fine detail, faded out once a pixel covers more than about half of it
float kFade(vec2 w) { return 1.0 - smoothstep(0.25, 0.8, length(fwidth(w)) / 6.2832); }
float kWeave(vec2 w) { vec2 c = floor(w / 3.14159); return mod(c.x + c.y, 2.0) > 0.5 ? abs(sin(w.y)) : abs(sin(w.x)); }
float kFabric(vec3 p, vec3 n, float kind) {
	if (kind < 0.5) return 1.0;
	vec3 a = abs(n);
	vec2 uv = a.x > a.y && a.x > a.z ? p.zy : (a.y > a.z ? p.xz : p.xy);
	float mott = kNoise(p * 38.0) - 0.5;
	if (kind < 2.5) { vec2 w = uv * (kind < 1.5 ? 2600.0 : 1500.0); return 1.0 + mott * 0.07 + (kWeave(w) - 0.6) * 0.16 * kFade(w); }
	if (kind < 3.5) { vec2 w = uv * 700.0; return 1.0 + mott * 0.12 + (kNoise(vec3(w, 0.0)) - 0.5) * 0.09 * kFade(w); }
	if (kind < 4.5) { vec2 w = uv * 650.0; return 0.97 + mott * 0.09 + (smoothstep(0.3, 0.75, kNoise(vec3(w, 0.0))) - 0.5) * 0.13 * kFade(w); }
	if (kind < 5.5) return 1.0 + (kNoise(p * 55.0) - 0.5) * 0.18 + (kNoise(p * 160.0) - 0.5) * 0.07;
	if (kind < 6.5) { vec2 w = uv * vec2(900.0, 260.0); return 0.92 + abs(sin(w.x)) * 0.14 * kFade(w) + mott * 0.08; }
	// fur: fine streaks of hair over a soft mottle
	return 0.9 + kNoise(p * vec3(420.0, 110.0, 420.0)) * 0.2 * kFade(p.xz * 420.0) + mott * 0.12;
}`;
// (garment.js puts the same on the small things people wear: one program for all of it)
export function patchKit(m, a = '#ffffff', b = '#ffffff') {
	const A = new THREE.Color(a), B = new THREE.Color(b);
	m.userData.kit = { A, B };
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uKitA = { value: A }; sh.uniforms.uKitB = { value: B };
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nattribute vec3 kit;\nvarying vec3 vKit; varying vec3 vRest; varying vec3 vRestN;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKit = kit; vRest = position; vRestN = normal;');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\n' + GLSL)
			.replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= vKit.z > 1.5 ? uKitB : vKit.z > 0.5 ? uKitA : vec3(1.0);
diffuseColor.rgb *= kFabric(vRest, vRestN, vKit.y);
if (vKit.y > 0.5 && !gl_FrontFacing) diffuseColor.rgb *= 0.5;
// (armour steel, gloss 3: part metal, so it keeps its grey where the world gives no reflection,
// a little brighter where it faces the sky; dulled with grime in patches, where it is rough and
// dark and a little rust brown, and scored with fine bright scratches where it is clean)
float kSteel = 0.3;
if (vKit.x > 2.5) {
	float grime = kNoise(vRest * 11.0) * 0.6 + kNoise(vRest * 37.0) * 0.4;
	float clean = smoothstep(0.32, 0.72, grime);
	vec3 sa = abs(vRestN);
	vec2 suv = sa.x > sa.y && sa.x > sa.z ? vRest.zy : (sa.y > sa.z ? vRest.xz : vRest.xy);
	vec2 sw = vec2(suv.x * 9.0 + suv.y * 3.0, suv.y * 9.0 - suv.x * 2.0) * vec2(40.0, 900.0);
	float scratch = smoothstep(0.8, 0.95, kNoise(vec3(sw, 0.0))) * kFade(sw) * clean;
	diffuseColor.rgb *= (0.86 + 0.26 * vRestN.y) * mix(0.6, 1.06, clean);
	diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.95, 0.8, 0.66), (1.0 - clean) * 0.55);
	diffuseColor.rgb += scratch * 0.12;
	kSteel = mix(0.62, 0.27, clean) - scratch * 0.1;
}`)
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nroughnessFactor = vKit.x > 2.5 ? kSteel : vKit.x > 1.5 ? 0.24 : mix(0.82, 0.12, vKit.x); metalnessFactor = vKit.x > 2.5 ? 0.4 : vKit.x > 1.5 ? 1.0 : vKit.x * 0.3;');
	};
	m.customProgramCacheKey = () => 'crysis-kit-3';
	return m;
}
// a shared material for a bag in these colours (its own and its accent)
const mats = new Map();
export function kitMaterial(a = '#ffffff', b = '#ffffff') {
	const key = new THREE.Color(a).getHexString() + new THREE.Color(b).getHexString();
	let m = mats.get(key);
	if (!m) {
		m = patchKit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }), a, b);
		m.userData.shared = true;
		mats.set(key, m);
	}
	return m;
}
