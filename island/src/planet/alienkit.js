// The builders' kit for the alien architecture (alien.js): shapes cut sharp and clean,
// a frame to set them out on a site, the buckets they are merged into (one mesh per
// material), and the materials themselves: the skin with its seams, courses and glowing
// glyph inlays, the light lines, the light shafts and the aurora curtains.
//
// Every shape is made in world space, non-indexed, with the same attributes: position,
// normal, colour (a tint), aGlow (0 plain, 1 glyph inlay, 2 lit from within) and aSpin
// (a centre and a turn rate: things that hang in the air turn and bob in the shader).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const Y = new THREE.Vector3(0, 1, 0);
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), eu = new THREE.Euler(), m4 = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), sc = new THREE.Vector3();

// ---------- shapes ----------
function finish(g, flat) {
	if (g.index) g = g.toNonIndexed();
	for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
	if (flat || !g.attributes.normal) g.computeVertexNormals();
	return g;
}
// a turned profile [[r, y], ...]: few sides and flat for cut stone and crystal, many and smooth for grown things
export function lathe(profile, sides, flat = true, phi = 0, len = Math.PI * 2) {
	const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y));
	return finish(new THREE.LatheGeometry(pts, sides, phi, len), flat);
}
// a tapering prism with a chamfer at its foot and head, and a point if r1 is 0
export function prism(sides, r0, r1, h, tip = 0, ch = 0) {
	ch = Math.min(ch || Math.min(r0, h) * 0.06, h * 0.2);
	const p = [[0, 0], [r0 - ch, 0], [r0, ch], [r1 + (r0 - r1) * (ch / h), h - ch], [Math.max(0, r1 - ch), h]];
	if (tip) p.push([0, h + tip]); else p.push([0, h]);
	return lathe(p, sides, true, Math.PI / sides);
}
// a crystal: a long bipyramid, a little off true
export function shard(r, h, sides = 6, rnd = Math.random) {
	const k = 0.7 + rnd() * 0.3;
	return lathe([[0, -h * 0.12], [r * 0.8, 0], [r, h * 0.12], [r * k, h * (0.55 + rnd() * 0.15)], [0, h]], sides, true, rnd() * 6.28);
}
export function box(w, h, d) { return finish(new THREE.BoxGeometry(w, h, d), false); }
// a box whose edges are cut at 45 degrees: a chamfered block
export function cbox(w, h, d, c = 0.08) {
	c = Math.min(c, w / 3, h / 3, d / 3);
	const hw = w / 2, hh = h / 2, hd = d / 2, P = [];
	// an octagonal section in xz, extruded in y with chamfered top and bottom
	const sec = (sx, sz, y) => [[sx - c, -sz], [sx, -sz + c], [sx, sz - c], [sx - c, sz], [-sx + c, sz], [-sx, sz - c], [-sx, -sz + c], [-sx + c, -sz]].map(([x, z]) => [x, y, z]);
	const rings = [sec(hw - c, hd - c, -hh), sec(hw, hd, -hh + c), sec(hw, hd, hh - c), sec(hw - c, hd - c, hh)];
	for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) {
		const a = rings[r][i], b = rings[r][(i + 1) % 8], cc = rings[r + 1][(i + 1) % 8], d0 = rings[r + 1][i];
		P.push(...a, ...cc, ...b, ...a, ...d0, ...cc);
	}
	for (const [r, up] of [[0, false], [3, true]]) for (let i = 1; i < 7; i++) {
		const a = rings[r][0], b = rings[r][i], cc = rings[r][i + 1];
		if (up) P.push(...a, ...cc, ...b); else P.push(...a, ...b, ...cc);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.computeVertexNormals();
	return g;
}
// a flat ring of chamfered section, lying in xz, centred on the origin
export function ring(R, w, t, sides = 32, flat = true) {
	const c = Math.min(w, t) * 0.2;
	return lathe([[R - w / 2, c], [R - w / 2 + c, 0], [R + w / 2 - c, 0], [R + w / 2, c], [R + w / 2, t - c], [R + w / 2 - c, t], [R - w / 2 + c, t], [R - w / 2, t - c], [R - w / 2, c]], sides, flat);
}
// a beam from a to b, w wide and d deep
export function strut(a, b, w, d = w, chamfer = false) {
	const len = v1.subVectors(b, a).length();
	const g = chamfer ? cbox(w, len, d, Math.min(w, d) * 0.22) : box(w, len, d);
	qa.setFromUnitVectors(Y, v1.normalize());
	m4.compose(v2.addVectors(a, b).multiplyScalar(0.5), qa, sc.set(1, 1, 1));
	return g.applyMatrix4(m4);
}
// a swept section along a smooth path through pts: r(t) its radius, sx/sy squash it
// into a blade, twist turns it along the way, sides its facets (4 for a cut beam)
export function sweep(pts, r, sides = 10, o = {}) {
	const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
	const n = o.seg || Math.max(8, Math.round(curve.getLength() / (o.step || 3)));
	const fr = curve.computeFrenetFrames(n, false);
	const P = [], idx = [];
	const sx = o.sx || 1, sy = o.sy || 1, tw = o.twist || 0, ph = o.phase ?? Math.PI / sides;
	for (let i = 0; i <= n; i++) {
		const t = i / n, c = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], rr = typeof r === 'function' ? r(t) : r;
		for (let j = 0; j <= sides; j++) {
			const a = j / sides * Math.PI * 2 + ph + tw * t, ca = Math.cos(a) * sx * rr, sa = Math.sin(a) * sy * rr;
			P.push(c.x + N.x * ca + B.x * sa, c.y + N.y * ca + B.y * sa, c.z + N.z * ca + B.z * sa);
		}
	}
	for (let i = 0; i < n; i++) for (let j = 0; j < sides; j++) {
		const a = i * (sides + 1) + j, b = a + sides + 1;
		idx.push(a, b, a + 1, a + 1, b, b + 1);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setIndex(idx);
	g.computeVertexNormals();
	const out = finish(g, !!o.flat);
	// the face each end shows (flat caps where it does not taper to nothing)
	if (o.caps) {
		const caps = [];
		for (const i of [0, n]) {
			const c = curve.getPointAt(i / n), base = i * (sides + 1);
			for (let j = 0; j < sides; j++) {
				const A = [P[(base + j) * 3], P[(base + j) * 3 + 1], P[(base + j) * 3 + 2]], B = [P[(base + j + 1) * 3], P[(base + j + 1) * 3 + 1], P[(base + j + 1) * 3 + 2]];
				if (i === 0) caps.push(c.x, c.y, c.z, ...A, ...B); else caps.push(c.x, c.y, c.z, ...B, ...A);
			}
		}
		const cg = new THREE.BufferGeometry();
		cg.setAttribute('position', new THREE.Float32BufferAttribute(caps, 3));
		cg.computeVertexNormals();
		return mergeGeometries([out, cg]);
	}
	return out;
}
// a dome's struts on a geodesic sphere (its upper half): lines between the vertices
export function geodesic(R, detail, w, above = -0.05) {
	const ico = new THREE.IcosahedronGeometry(R, detail), p = ico.attributes.position, seen = new Set(), out = [];
	const key = (v) => `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`;
	const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
	for (let i = 0; i < p.count; i += 3) {
		A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
		for (const [a, b] of [[A, B], [B, C], [C, A]]) {
			if (a.y < R * above && b.y < R * above) continue;
			const k = [key(a), key(b)].sort().join('|');
			if (seen.has(k)) continue;
			seen.add(k);
			out.push(strut(a.clone(), b.clone(), w, w * 1.3));
		}
	}
	return mergeGeometries(out);
}
// the panes between a geodesic dome's struts: its upper triangles, shrunk a little
export function geoPanes(R, detail, above = -0.05) {
	const ico = new THREE.IcosahedronGeometry(R * 0.995, detail), p = ico.attributes.position, P = [];
	const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), M = new THREE.Vector3();
	for (let i = 0; i < p.count; i += 3) {
		A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
		if (Math.min(A.y, B.y, C.y) < R * above) continue;
		M.copy(A).add(B).add(C).multiplyScalar(1 / 3);
		for (const v of [A, B, C]) { v.lerp(M, 0.06); P.push(v.x, v.y, v.z); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.computeVertexNormals();
	return g;
}
// a smooth ellipsoid (sacs, pods, domes cut off at the ground by cut)
export function blob(rx, ry, rz, seg = 12, cut = -1) {
	const prof = [];
	for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 + Math.PI * i / seg, y = Math.sin(a); if (y < cut) continue; prof.push([Math.cos(a), y]); }
	if (prof[0][1] > -1) prof.unshift([0, prof[0][1]]);
	const g = lathe(prof, seg * 2, false);
	return g.scale(rx, ry, rz);
}
// a vertical light strip: a thin box along a to b (for the glow bucket)
export const line = (a, b, w) => strut(a, b, w, w);

// ---------- placing things ----------
// a site's frame: local x across, z along its facing, y up from its base
export function frame(x, y, z, yaw) {
	const c = Math.cos(yaw), s = Math.sin(yaw);
	const F = {
		x, y, z, yaw, c, s,
		// local to world
		p: (lx, ly, lz) => new THREE.Vector3(x + lx * c + lz * s, y + ly, z - lx * s + lz * c),
		// set a shape at a local point, turned (ry about up, then rx, rz), scaled
		put(g, lx = 0, ly = 0, lz = 0, ry = 0, rx = 0, rz = 0, s = 1) {
			eu.set(rx, ry, rz, 'YXZ');
			qa.setFromEuler(eu);
			qb.setFromAxisAngle(Y, yaw).multiply(qa);
			m4.compose(F.p(lx, ly, lz), qb, typeof s === 'number' ? sc.set(s, s, s) : sc.set(s[0], s[1], s[2]));
			return g.applyMatrix4(m4);
		},
		// a sub-frame: a point and turn within this one
		sub: (lx, ly, lz, ry = 0) => { const q = F.p(lx, ly, lz); return frame(q.x, q.y, q.z, yaw + ry); },
	};
	return F;
}

// ---------- the buckets ----------
// shapes land in a bucket by material; floating ones (spin) and fine detail seen only
// close by (near) in their own. build() merges each into one mesh.
export class Kit {
	constructor() { this.b = new Map(); }
	add(mat, g, o = {}) {
		if (!g) return g;
		if (g.index) g = g.toNonIndexed();
		for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
		if (!g.attributes.normal) g.computeVertexNormals();
		const n = g.attributes.position.count, t = o.tint || [1, 1, 1];
		const col = new Float32Array(n * 3), gl = new Float32Array(n).fill(o.glow || 0), sp = new Float32Array(n * 4);
		const j = o.jit || 1;
		for (let i = 0; i < n; i++) { col[i * 3] = t[0] * j; col[i * 3 + 1] = t[1] * j; col[i * 3 + 2] = t[2] * j; }
		if (o.spin) for (let i = 0; i < n; i++) sp.set(o.spin, i * 4);
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
		g.setAttribute('aSpin', new THREE.BufferAttribute(sp, 4));
		const key = mat + (o.spin ? '|F' : '') + (o.near ? '|N' : '');
		if (!this.b.has(key)) this.b.set(key, []);
		this.b.get(key).push(g);
		return g;
	}
	// (all: near detail merged in with the rest, for works spread too wide to drop it by distance)
	build(mats, group, all = false) {
		const out = [];
		if (all) for (const [key, list] of [...this.b]) if (key.endsWith('|N')) { const k = key.slice(0, -2); this.b.delete(key); if (!this.b.has(k)) this.b.set(k, []); this.b.get(k).push(...list); }
		for (const [key, list] of this.b) {
			const [mat] = key.split('|'), geo = mergeGeometries(list);
			for (const g of list) g.dispose();
			geo.computeBoundingSphere();
			const mesh = new THREE.Mesh(geo, mats[mat]);
			const solid = mat !== 'glow' && mat !== 'glass' && mat !== 'veil';
			mesh.castShadow = solid && !key.includes('|F');
			mesh.receiveShadow = solid;
			mesh.userData.near = key.includes('|N');
			mesh.name = 'alien:' + key;
			group.add(mesh);
			out.push(mesh);
		}
		this.b.clear();
		return out;
	}
}

// ---------- materials ----------
const VERT_HEAD = /* glsl */`
attribute float aGlow;
attribute vec4 aSpin;
varying vec3 vAW;
varying vec3 vAN;
varying float vAG;
uniform float uTime;
mat3 aRotY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
float aPhase(){ return fract(sin(dot(aSpin.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831; }
`;
// what hangs in the air turns about its own upright and bobs
const SPIN = /* glsl */`
	float aAng = aSpin.w != 0.0 ? uTime * aSpin.w : 0.0;
	vec3 aBob = aSpin.w != 0.0 ? vec3(0.0, sin(uTime * 0.55 + aPhase()) * 0.7, 0.0) : vec3(0.0);
`;
const FRAG_HEAD = /* glsl */`
uniform float uTime, uGlowK, uSeam, uSeamK, uRim, uBass, uNight;
uniform vec3 uGlowC, uRimC;
varying vec3 vAW;
varying vec3 vAN;
varying float vAG;
float aH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float aSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// one sign per cell: strokes on a 3x3 lattice, now and then a ring or a dot
float aGlyph(vec2 uv){
	vec2 cell = floor(uv), f = fract(uv);
	float h0 = aH(vec3(cell, 7.0));
	if (h0 < 0.18 || f.y < 0.1 || f.y > 0.9) return 0.0;
	float d = 1.0;
	for (int i = 0; i < 3; i++) {
		float a = aH(vec3(cell, float(i) * 3.1 + 1.0)), b = aH(vec3(cell, float(i) * 5.7 + 2.0));
		vec2 A = vec2(floor(a * 3.0), floor(fract(a * 7.0) * 3.0)) * 0.3 + 0.2;
		vec2 B = vec2(floor(b * 3.0), floor(fract(b * 7.0) * 3.0)) * 0.3 + 0.2;
		if (length(A - B) < 0.1) B = vec2(0.5, 0.2);
		d = min(d, aSeg(f, A, B));
	}
	if (aH(vec3(cell, 9.0)) > 0.75) d = min(d, abs(length(f - 0.5) - 0.2));
	return 1.0 - smoothstep(0.035, 0.065, d);
}
float aEm = 0.0;
`;
const SKIN = /* glsl */`
	vec3 an = normalize(vAN), aa = abs(an);
	vec2 fp = aa.y > 0.8 ? vAW.xz : (aa.x > aa.z ? vAW.zy : vAW.xy);
	vec3 aCol = diffuseColor.rgb;
	float sk = uSeamK;
	if (uSeam < 0.5) {
		// panels: plates set edge to edge, each a shade off, the joints dark
		vec2 q = fp * vec2(sk, sk * 0.62);
		vec2 e = abs(fract(q) - 0.5);
		aCol *= 0.9 + 0.16 * aH(vec3(floor(q), 1.0));
		aCol *= 0.62 + 0.38 * smoothstep(0.495, 0.47, max(e.x, e.y));
	} else if (uSeam < 1.5) {
		// courses of cut stone, the joints staggered, and the wind's scour across them
		float y = vAW.y * sk, c = floor(y);
		vec2 q = vec2((aa.x > aa.z ? vAW.z : vAW.x) * sk * 0.42 + c * 0.37, y);
		if (aa.y > 0.8) q = vAW.xz * sk * 0.5;
		vec2 e = abs(fract(q) - 0.5);
		aCol *= 0.84 + 0.22 * aH(vec3(floor(q), 2.0));
		aCol *= 0.68 + 0.32 * smoothstep(0.492, 0.46, e.y) * mix(1.0, smoothstep(0.494, 0.47, e.x), 0.85);
		aCol *= 0.93 + 0.07 * sin(vAW.y * 9.0 + sin(vAW.x * 0.4 + vAW.z * 0.3) * 2.0);
	} else if (uSeam < 2.5) {
		// grown: fine growth lines, like a shell's, and a nacre sheen that shifts
		float g = sin((vAW.y + fp.x * 0.35) * sk * 6.2831 + sin(fp.x * 0.15) * 2.0 + sin(fp.x * 0.9) * 0.3);
		aCol *= 0.95 + 0.05 * g;
		vec3 vv = normalize(cameraPosition - vAW);
		float fr = 1.0 - abs(dot(an, vv));
		aCol = mix(aCol, aCol * vec3(0.85, 1.05, 1.12), fr * 0.5);
	} else {
		// crystal veins and cleavage planes
		float v = abs(sin(dot(vAW, vec3(0.31, 0.83, 0.46)) * sk + sin(dot(vAW, vec3(0.7, -0.2, 0.5)) * sk * 0.6) * 1.7));
		aCol *= 0.9 + 0.1 * smoothstep(0.0, 0.2, v);
		aCol = mix(aCol, uRimC * 0.7, (1.0 - smoothstep(0.0, 0.05, v)) * 0.35);
	}
	// seams and courses fade out with distance before they can shimmer
	float aFar = smoothstep(180.0, 700.0, length(cameraPosition - vAW));
	diffuseColor.rgb = mix(aCol, diffuseColor.rgb * 0.92, aFar);
	// the inlays: bands of signs cut in the upright faces, glowing
	if (vAG > 0.5 && vAG < 1.5 && aa.y < 0.7) {
		float band = fract(fp.y / 7.0);
		float reg = step(0.1, band) * step(band, 0.32);
		float gg = aGlyph(fp / vec2(0.55, 0.6)) * reg * (1.0 - smoothstep(70.0, 220.0, length(cameraPosition - vAW)));
		diffuseColor.rgb *= 1.0 - gg * 0.75;
		aEm = gg;
	} else if (vAG > 1.5) aEm = 0.5 + 0.5 * (vAG - 1.5);
`;
const EMIT = /* glsl */`
	float aPulse = 0.72 + 0.28 * sin(uTime * 1.1 - vAW.y * 0.06 + vAW.x * 0.01) + uBass * 0.6;
	totalEmissiveRadiance += uGlowC * aEm * aPulse * uGlowK;
	if (uRim > 0.0) {
		vec3 vv = normalize(cameraPosition - vAW);
		float fr = pow(1.0 - abs(dot(normalize(vAN), vv)), 3.0);
		totalEmissiveRadiance += uRimC * fr * uRim * (0.35 + uNight * 1.2);
	}
`;

// the uniforms every alien material shares (updated once a frame by alien.js)
export function alienUniforms(shared, glowC) {
	return {
		uTime: shared.uTime, uBass: shared.uBass || { value: 0 },
		uGlowK: { value: 1 }, uNight: { value: 0 }, uGlowC: { value: new THREE.Color(...glowC) },
	};
}
// a lit skin: seam 0 panels, 1 stone courses, 2 grown, 3 crystal; rim a fresnel light
export function skinMaterial(U, o) {
	const phys = o.clearcoat || o.iridescence || o.sheen || o.transmission;
	const Ctor = phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
	const p = { vertexColors: true, color: new THREE.Color(...o.color), roughness: o.rough ?? 0.6, metalness: o.metal ?? 0 };
	if (phys) Object.assign(p, { clearcoat: o.clearcoat || 0, clearcoatRoughness: o.ccRough ?? 0.15, iridescence: o.iridescence || 0, iridescenceIOR: 1.6, sheen: o.sheen || 0, sheenColor: new THREE.Color(...(o.sheenC || [1, 1, 1])) });
	if (o.opacity < 1) Object.assign(p, { transparent: true, opacity: o.opacity, depthWrite: false, side: THREE.DoubleSide });
	if (o.env) p.envMap = o.env;
	if (o.flat) p.flatShading = true;
	const m = new Ctor(p);
	const L = { uSeam: { value: o.seam ?? 0 }, uSeamK: { value: o.seamK ?? 0.5 }, uRim: { value: o.rim || 0 }, uRimC: { value: new THREE.Color(...(o.rimC || o.color)) } };
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U, L);
		sh.vertexShader = VERT_HEAD + sh.vertexShader
			.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
				${SPIN}
				objectNormal = aRotY(aAng) * objectNormal;`)
			.replace('#include <begin_vertex>', `#include <begin_vertex>
				if (aSpin.w != 0.0) transformed = aRotY(aAng) * (transformed - aSpin.xyz) + aSpin.xyz + aBob;
				vAW = (modelMatrix * vec4(transformed, 1.0)).xyz;
				vAN = normalize(mat3(modelMatrix) * objectNormal);
				vAG = aGlow;`);
		sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
			.replace('#include <color_fragment>', '#include <color_fragment>\n' + SKIN)
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMIT);
	};
	m.customProgramCacheKey = () => 'alienskin';
	// rough stone takes little from the sky map (it would wash out); metal and glass take it all
	m.userData.env = o.envK ?? (o.metal > 0.5 || o.clearcoat > 0.5 || o.opacity < 1 ? 1 : 0.3);
	return m;
}
// the light lines: unlit, their colour the civilisation's light, a slow tide running up them
export function glowMaterial(U, o = {}) {
	const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: !!o.additive, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.additive });
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			${SPIN}
			if (aSpin.w != 0.0) transformed = aRotY(aAng) * (transformed - aSpin.xyz) + aSpin.xyz + aBob;
			vAW = (modelMatrix * vec4(transformed, 1.0)).xyz;
			vAN = normal;
			vAG = aGlow;`);
		sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			float tide = 0.7 + 0.3 * sin(vAW.y * 0.11 - uTime * 1.4 + vAW.x * 0.03 + vAW.z * 0.02);
			diffuseColor.rgb *= uGlowC * uGlowK * (tide + uBass * 0.7);`);
	};
	m.customProgramCacheKey = () => 'alienglow' + (o.additive ? 'a' : '');
	return m;
}
// light shafts: soft additive columns, brightest at their root, fading up (or down)
export function beamMaterial(U) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: U.uTime, uBeamK: { value: 0.3 }, uBass: U.uBass },
		vertexShader: /* glsl */`
			attribute vec3 color;
			varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vC;
			void main(){ vUv = uv; vC = color; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
		fragmentShader: /* glsl */`
			uniform float uTime, uBeamK, uBass;
			varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vC;
			void main(){
				float f = abs(dot(normalize(vN), normalize(cameraPosition - vP)));
				float a = pow(1.0 - vUv.y, 1.8) * smoothstep(0.0, 0.03, vUv.y) * f * f;
				a *= 0.8 + 0.2 * sin(vUv.y * 40.0 - uTime * 2.0) + uBass * 0.3;
				gl_FragColor = vec4(vC * a * uBeamK, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}
// a light shaft from a point, up (dir 1) or down (-1): an open cone, r0 at its root
export function beamGeo(p, len, r0, r1, dir = 1, col = [1, 1, 1]) {
	const g = new THREE.CylinderGeometry(r1, r0, len, 16, 1, true);
	g.translate(0, len / 2, 0);
	if (dir < 0) g.rotateX(Math.PI);
	g.translate(p.x, p.y, p.z);
	const n = g.attributes.position.count, c = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) c.set(col, i * 3);
	g.setAttribute('color', new THREE.BufferAttribute(c, 3));
	return g.toNonIndexed();
}
// an aurora curtain: folds of green going violet at the top, drifting
export function auroraMaterial(U) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: U.uTime, uK: { value: 0.3 } },
		vertexShader: /* glsl */`
			uniform float uTime;
			varying vec2 vUv;
			void main(){ vUv = uv; vec3 p = position + normal * sin(uv.x * 14.0 + uTime * 0.4) * 3.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
		fragmentShader: /* glsl */`
			uniform float uTime, uK;
			varying vec2 vUv;
			void main(){
				float folds = 0.5 + 0.5 * sin(vUv.x * 34.0 + uTime * 0.6 + sin(vUv.x * 7.0 - uTime * 0.25) * 3.0);
				float a = pow(folds, 2.0) * smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
				vec3 c = mix(vec3(0.2, 1.0, 0.55), vec3(0.7, 0.3, 1.0), smoothstep(0.35, 0.9, vUv.y));
				gl_FragColor = vec4(c * a * uK, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}
// a curtain hung along an arc: centre c, radius R, from angle a0 to a1, h tall
export function curtainGeo(c, R, a0, a1, h, n = 48) {
	const P = [], N = [], UV = [], I = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n, a = a0 + (a1 - a0) * t, r = R * (1 + 0.15 * Math.sin(t * 9));
		const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
		for (const v of [0, 1]) { P.push(x, c.y + v * h, z); N.push(Math.cos(a), 0, Math.sin(a)); UV.push(t, v); }
	}
	for (let i = 0; i < n; i++) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
	g.setIndex(I);
	return g.toNonIndexed();
}
// an environment to reflect: the planet's sky above, its haze at the horizon, dark ground,
// a bright patch for the sun. Metal and glass have nothing to show without one.
export function skyEnvironment(renderer, zen, hor, ground) {
	if (!renderer) return null;
	const s = new THREE.Scene();
	const mat = new THREE.ShaderMaterial({
		side: THREE.BackSide, depthWrite: false,
		uniforms: { uZ: { value: new THREE.Color(...zen) }, uH: { value: new THREE.Color(...hor) }, uG: { value: new THREE.Color(...ground) } },
		vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform vec3 uZ, uH, uG; varying vec3 vD;
			void main(){ vec3 d = normalize(vD); vec3 c = d.y > 0.0 ? mix(uH, uZ, pow(d.y, 0.6)) : mix(uH * 0.7, uG, smoothstep(0.0, 0.25, -d.y));
			c += vec3(3.0, 2.7, 2.2) * pow(max(0.0, dot(d, normalize(vec3(0.4, 0.55, 0.35)))), 60.0);
			gl_FragColor = vec4(c, 1.0); }`,
	});
	s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
	const pm = new THREE.PMREMGenerator(renderer);
	const rt = pm.fromScene(s, 0.02);
	pm.dispose(); mat.dispose(); s.children[0].geometry.dispose();
	return rt;
}
