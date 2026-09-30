// The pitched roofs of the far and middle houses (city.js), built with some depth: a unit
// hip or gable scaled to each house, with the parts that give a real roof its edges laid
// on in true metres whatever the scale (the vertex shader offsets them after scaling): a
// fascia board and a gutter along the eaves, a frieze closing the gap under the eaves,
// barge boards up the rakes, the gable walls set back to the house's own wall and painted
// like it, a cap along the ridge and the hips. The field is drawn as its covering: three-tab
// shingle, barrel or flat tile, standing-seam metal, shake, or the tar and gravel of a low
// Eichler roof, course by course, the courses lit as bumps up close and only their average
// far off. The neglected ones sag, lose shingles and wear a blue tarp; a burnt one is
// charred and holed. No textures.

import * as THREE from 'three';

const PHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// roof types (aRoof.x)
export const ROOF = { shingle: 0, barrel: 1, flatTile: 2, metal: 3, shake: 4, gravel: 5 };
// parts (aVP.y)
const FIELD = 0, FASCIA = 1, GUTTER = 2, FRIEZE = 3, GABLE = 4, CAP = 5;

// A unit roof, base at y 0, ridge at y 1, ridge along x. Each vertex: its unit position,
// a normal, a lift in metres and its part, and two offsets (a direction in unit space and
// a length in metres; a length of -1 is the eave's overhang, -2 moves along the direction
// until it has gone the overhang across the ground).
export function roofGeometry(hip) {
	const r = hip ? 0.28 : 0.0;
	const P = [], N = [], VP = [], O1 = [], O2 = [];
	const Z = [0, 0, 0, 0];
	const v = (p, n, part, lift = 0, o1 = Z, o2 = Z) => { P.push(...p); N.push(...n); VP.push(lift, part); O1.push(...o1); O2.push(...o2); };
	const faceN = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n) || 1; return n.map((k) => k / l); };
	// a triangle of the field (normal from its own shape)
	const tri = (a, b, c, part = FIELD) => { const n = faceN(a, b, c); v(a, n, part); v(b, n, part); v(c, n, part); };
	// a quad of offset vertices: each [pos, lift, o1, o2]
	const quad = (A, B, C, D, n, part) => { for (const q of [A, B, C, A, C, D]) v(q[0], n, part, q[1], q[2], q[3]); };
	const c00 = [-0.5, 0, -0.5], c10 = [0.5, 0, -0.5], c11 = [0.5, 0, 0.5], c01 = [-0.5, 0, 0.5], rA = [-0.5 + r, 1, 0], rB = [0.5 - r, 1, 0];
	// the field
	tri(c00, rA, rB); tri(c00, rB, c10); tri(c11, rB, rA); tri(c11, rA, c01);
	if (hip) { tri(c10, rB, c11); tri(c01, rA, c00); }
	// the eaves: ±z, and on a hip ±x too. Fascia (a board 0.22 deep), the gutter hung on it
	// (0.13 out, 0.15 deep), the frieze from the wall's top up under the overhang
	const eaves = [[c00, c10, [0, 0, -1]], [c11, c01, [0, 0, 1]]];
	if (hip) eaves.push([c10, c11, [1, 0, 0]], [c01, c00, [-1, 0, 0]]);
	for (const [a, b, out] of eaves) {
		const along = [b[0] - a[0], 0, b[2] - a[2]].map((k) => Math.sign(k)), back = along.map((k) => -k);
		const O = (k) => [...out, k], AL = (d, k) => [...d, k];
		// fascia: its face, a hair outside the edge
		quad([a, 0.02, O(0.01), Z], [b, 0.02, O(0.01), Z], [b, -0.22, O(0.01), Z], [a, -0.22, O(0.01), Z], out, FASCIA);
		// the gutter: its outer face, bottom and lip; run past the corners on a hip so they meet
		const ext = hip ? 0.14 : 0.03;
		quad([a, -0.03, O(0.14), AL(back, ext)], [b, -0.03, O(0.14), AL(along, ext)], [b, -0.18, O(0.14), AL(along, ext)], [a, -0.18, O(0.14), AL(back, ext)], out, GUTTER);
		quad([a, -0.18, O(0.14), AL(back, ext)], [b, -0.18, O(0.14), AL(along, ext)], [b, -0.18, O(0.01), AL(along, ext)], [a, -0.18, O(0.01), AL(back, ext)], [0, -1, 0], GUTTER);
		quad([a, -0.03, O(0.01), AL(back, ext)], [b, -0.03, O(0.01), AL(along, ext)], [b, -0.03, O(0.14), AL(along, ext)], [a, -0.03, O(0.14), AL(back, ext)], [0, 1, 0], GUTTER);
		// the frieze: at the wall's line, from its top up to the underside of the slope
		const inw = out.map((k) => -k), k2 = out[0] !== 0 ? r : 0.5, upS = [inw[0] * k2, 1, inw[2] * k2];
		const eA = [...along, -1], eB = [...back, -1];
		quad([a, 0, [...inw, -1], eA], [b, 0, [...inw, -1], eB], [b, 0, [...upS, -2], eB], [a, 0, [...upS, -2], eA], out, FRIEZE);
	}
	if (!hip) {
		// the gable walls, set back the overhang to the house's wall; barge boards up the rakes
		for (const s of [-1, 1]) {
			const inX = [-s, 0, 0, -1], lo = [s * 0.5, 0, -0.5], hi = [s * 0.5, 0, 0.5], ap = [s * 0.5, 1, 0];
			const n = [s, 0, 0];
			const wall = (p, dz, mode) => [p, 0, inX, dz ? [0, mode === 'up' ? 1 : 0, dz, mode === 'up' ? -2 : -1] : Z];
			const a0 = wall(lo, 1, 'in'), a1 = wall(lo, 0.5, 'up'), b0 = wall(hi, -1, 'in'), b1 = wall(hi, -0.5, 'up'), apx = wall(ap, 0);
			const t = (A, B, C) => { for (const q of s > 0 ? [A, B, C] : [A, C, B]) v(q[0], n, GABLE, q[1], q[2], q[3]); };
			t(a0, b0, b1); t(a0, b1, a1); t(a1, b1, apx);
			// the barge boards: down from the rake's edge, a hair proud of it
			for (const e of [lo, hi]) {
				const O = [s, 0, 0, 0.02];
				const A = s * e[2] > 0 ? [e, ap] : [ap, e];
				quad([A[0], 0.03, O, Z], [A[1], 0.03, O, Z], [A[1], -0.22, O, Z], [A[0], -0.22, O, Z], n, FASCIA);
			}
		}
	}
	// the ridge cap: a low tent along the ridge, and down the hips
	for (const sd of [-1, 1]) {
		const down = [0, -1, sd * 0.5, 0.16];
		quad([rA, 0.06, Z, Z], [rB, 0.06, Z, Z], [rB, 0.0, down, Z], [rA, 0.0, down, Z], [0, 0.9, sd * 0.45], CAP);
	}
	if (hip) {
		for (const [e, c] of [[rB, c10], [rB, c11], [rA, c00], [rA, c01]]) {
			const sx = Math.sign(c[0]), sz = Math.sign(c[2]);
			const inSide = [-sx, 0, 0, 0.13], inEnd = [0, 0, -sz, 0.13];
			const nS = [0, 0.9, sz * 0.45], nE = [sx * 0.45, 0.9, 0];
			quad([e, 0.05, Z, Z], [c, 0.05, Z, Z], [c, 0, inSide, Z], [e, 0, inSide, Z], nS, CAP);
			quad([e, 0.05, Z, Z], [c, 0.05, Z, Z], [c, 0, inEnd, Z], [e, 0, inEnd, Z], nE, CAP);
		}
	}
	const g = new THREE.InstancedBufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
	g.setAttribute('aVP', new THREE.Float32BufferAttribute(VP, 2));
	g.setAttribute('aO1', new THREE.Float32BufferAttribute(O1, 4));
	g.setAttribute('aO2', new THREE.Float32BufferAttribute(O2, 4));
	return g;
}

// the roof material's own parts: the offsets, the parts' colours, the courses
export function roofDetail(m) {
	const prev = m.onBeforeCompile;
	m.onBeforeCompile = (sh, r) => {
		prev?.call(m, sh, r);
		sh.vertexShader = 'attribute vec2 aVP; attribute vec4 aO1; attribute vec4 aO2; attribute vec4 aRoof; attribute vec3 aWall;\nvarying vec3 vRL; varying vec3 vRN; varying vec4 vRI; varying vec3 vRWall; varying float vRPart; varying float vRH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			{
				#ifdef USE_INSTANCING
				vec3 rS = max(vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)), vec3(1e-3));
				#else
				vec3 rS = vec3(1.0);
				#endif
				float ov = aRoof.y;
				vec3 off = vec3(0.0, aVP.x, 0.0);
				for (int k = 0; k < 2; k++) {
					vec4 o = k == 0 ? aO1 : aO2;
					if (o.w == 0.0) continue;
					vec3 d = o.xyz * rS;
					off += o.w < -1.5 ? d * (ov / max(length(d.xz), 1e-3)) : normalize(d) * (o.w < 0.0 ? ov : o.w);
				}
				// a neglected roof's ridge sags in the middle
				if (aRoof.w > 2.5) off.y -= 0.4 * position.y * (1.0 - 4.0 * position.x * position.x);
				transformed += off / rS;
				vRL = transformed * rS; vRN = normalize(objectNormal / rS); vRI = aRoof; vRWall = aWall; vRPart = aVP.y; vRH = rS.y;
			}`);
		const bump = !PHONE;
		sh.fragmentShader = 'varying vec3 vRL; varying vec3 vRN; varying vec4 vRI; varying vec3 vRWall; varying float vRPart; varying float vRH;\nfloat rfH(vec2 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat rfN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rfH(i), rfH(i + vec2(1, 0)), f.x), mix(rfH(i + vec2(0, 1)), rfH(i + vec2(1, 1)), f.x), f.y); }\nfloat rfBump = 0.0, rfRough = -1.0, rfMetal = -1.0;\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float part = floor(vRPart + 0.5), rType = floor(vRI.x + 0.5), cond = floor(vRI.w + 0.5);
				float ti = floor(vRI.z + 0.5);
				vec3 trimC = ti < 0.5 ? vec3(0.92, 0.91, 0.87) : ti < 1.5 ? vec3(0.86, 0.8, 0.66) : ti < 2.5 ? vec3(0.19, 0.16, 0.13) : ti < 3.5 ? vRWall * 0.93 : vec3(0.55, 0.55, 0.53);
				if (cond > 0.5) trimC = mix(trimC, vec3(0.5, 0.48, 0.44), 0.45);
				vec3 L = vRL;
				float px = length(fwidth(L));
				float fine = 1.0 - smoothstep(0.03, 0.09, px);
				if (part > 3.5 && part < 4.5) {
					// the gable wall: the house's colour, lap siding or stucco, a louvred vent up top
					vec3 wc = vRWall;
					float lap = step(0.86, fract(L.y / 0.2)) * fine * step(0.5, rfH(vec2(floor(vRI.z * 7.0), 3.0)));
					wc *= 1.0 - lap * 0.18;
					float apex = vRH;
					float vent = step(abs(L.z), 0.35) * step(abs(L.y - apex * 0.62), 0.22) * step(0.9, apex);
					wc = mix(wc, trimC * (0.75 + 0.25 * step(0.5, fract(L.y / 0.07))), vent);
					diffuseColor.rgb = wc;
				} else if (part > 0.5 && part < 1.5) {
					diffuseColor.rgb = trimC * (0.95 + 0.05 * rfN(vec2(L.x + L.z, L.y) * vec2(3.0, 30.0)));
				} else if (part > 1.5 && part < 2.5) {
					// the gutter: the trim's colour or bare aluminium, dark inside the lip
					diffuseColor.rgb = (rfH(vec2(ti, 5.0)) > 0.7 ? vec3(0.62, 0.63, 0.64) : trimC) * (vRN.y > 0.5 ? 0.35 : 0.92);
					rfRough = 0.45;
				} else if (part > 2.5 && part < 3.5) {
					diffuseColor.rgb = mix(trimC, vRWall, 0.4) * 0.85;
				} else if (part > 4.5) {
					diffuseColor.rgb *= rType > 0.5 && rType < 2.5 ? 0.9 : 0.8;
				} else if (!gl_FrontFacing) {
					// under the overhang: the soffit, painted like the trim
					diffuseColor.rgb = mix(trimC, vRWall, 0.35) * 0.8;
				} else {
					// the field: its covering, course by course. u along the eave, v up the slope
					vec3 n = normalize(vRN);
					vec3 E = normalize(vec3(-n.z, 0.0, n.x) + vec3(1e-4, 0.0, 0.0));
					vec3 S = cross(n, E);
					float seed = rfH(floor(vWxO * 0.5) + vRI.z * 1.7) * 50.0;
					float u = dot(L, E) + seed, v = dot(L, S) * sign(S.y + 1e-4) + seed * 0.37;
					vec3 c = diffuseColor.rgb;
					float h = 0.0, avg = 1.0;
					if (rType < 0.5) {
						// three-tab shingle: 14 cm courses, tabs a third of a metre, staggered
						float cv = v / 0.143, ci = floor(cv), f = fract(cv);
						float tu = u / 0.333 + ci * 0.5, tabI = floor(tu), tf = fract(tu);
						float tone = 0.86 + 0.28 * rfH(vec2(tabI, ci));
						float slot = step(0.965, tf) * step(f, 0.55);
						float edge = smoothstep(0.86, 1.0, f);
						c *= mix(1.0, tone * (1.0 - edge * 0.38) * (1.0 - slot * 0.5), fine);
						h = (1.0 - f) * 0.6 - slot * 0.3; avg = 0.94;
					} else if (rType < 1.5) {
						// barrel tile: the rolls across, a course each third of a metre
						float bu = u / 0.24, ci = floor(v / 0.33), f = fract(v / 0.33);
						float roll = abs(sin(3.14159 * bu));
						float tone = 0.85 + 0.3 * rfH(vec2(floor(bu), ci));
						c *= mix(1.0, (0.62 + 0.5 * roll) * tone * (1.0 - smoothstep(0.88, 1.0, f) * 0.35), fine);
						h = roll * 1.4 + (1.0 - f) * 0.3; avg = 0.93;
					} else if (rType < 2.5) {
						// flat concrete tile, in 34 cm courses, joints staggered
						float cv = v / 0.34, ci = floor(cv), f = fract(cv), tu = u / 0.42 + ci * 0.5;
						float tone = 0.9 + 0.2 * rfH(vec2(floor(tu), ci));
						float jt = step(0.97, fract(tu));
						float s2 = 0.5 + 0.5 * sin(6.2832 * u / 0.21);
						c *= mix(1.0, tone * (0.92 + 0.12 * s2) * (1.0 - smoothstep(0.9, 1.0, f) * 0.42) * (1.0 - jt * 0.35), fine);
						h = (1.0 - f) * 0.7 + s2 * 0.25; avg = 0.93;
					} else if (rType < 3.5) {
						// standing-seam metal: a raised seam every 45 cm, the sheen of the pans
						float su = fract(u / 0.45);
						float seam = 1.0 - smoothstep(0.0, 0.035, min(su, 1.0 - su));
						c *= mix(1.0, 0.93 + 0.14 * seam + 0.06 * rfN(vec2(u * 0.5, v * 0.1)), fine);
						h = seam; avg = 0.98; rfRough = 0.38; rfMetal = 0.55;
					} else if (rType < 4.5) {
						// cedar shake: 25 cm courses of split shakes of all widths, silvered unevenly
						float cv = v / 0.25, ci = floor(cv), f = fract(cv);
						float wu = u / 0.19 + rfH(vec2(ci, 3.0)) * 7.0, si = floor(wu + rfN(vec2(wu * 0.7, ci)) * 0.6);
						float tone = 0.7 + 0.55 * rfH(vec2(si, ci));
						float gap = step(0.93, fract(wu + rfN(vec2(wu * 0.7, ci)) * 0.6));
						c *= mix(1.0, tone * (1.0 - smoothstep(0.82, 1.0, f) * 0.45) * (1.0 - gap * 0.55), fine);
						h = (1.0 - f) * 0.9; avg = 0.88;
					} else {
						// tar and gravel: speckled, patched
						c *= mix(1.0, 0.8 + 0.4 * rfH(floor(L.xz * 30.0)) * rfN(L.xz * 2.0 + seed), fine);
						avg = 0.92;
					}
					c *= mix(avg, 1.0, fine);
					// the neglected: shingles gone in patches, the felt showing; a blue tarp
					if (cond > 0.5) {
						float miss = smoothstep(0.62, 0.66, rfN(vec2(u, v) * 1.3 + seed)) * step(0.5, rfN(vec2(u, v) * 0.35 + seed * 2.0));
						c = mix(c, vec3(0.1, 0.09, 0.085), miss * 0.85);
						float tarp = step(abs(u - seed - 0.3) , 2.2) * step(abs(v - seed * 0.37 - 1.6), 1.6) * step(0.55, rfH(vec2(floor(seed * 10.0), 2.0))) * step(cond, 1.5);
						c = mix(c, vec3(0.08, 0.26, 0.62) * (0.85 + 0.2 * rfN(vec2(u, v) * 4.0)), tarp);
						h = mix(h, 0.0, tarp);
					}
					// the burnt: charred through, holed where it fell in
					if (cond > 1.5 && cond < 2.5) {
						float ch = rfN(vec2(u, v) * 0.6 + seed);
						c = mix(c, vec3(0.03, 0.028, 0.026), smoothstep(0.35, 0.55, ch));
						if (ch > 0.72) discard;
					}
					diffuseColor.rgb = c;
					rfBump = h * fine;
				}
			}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (rfRough >= 0.0) roughnessFactor = rfRough;')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (rfMetal >= 0.0) metalnessFactor = rfMetal;')
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
			${bump ? `{
				// the courses as relief, from the pattern's own slope across the pixel
				float bs = 0.012;
				vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
				vec3 R1 = cross(sy, normal), R2 = cross(normal, sx);
				float det = dot(sx, R1);
				vec3 grad = sign(det) * (dFdx(rfBump * bs) * R1 + dFdy(rfBump * bs) * R2);
				if (rfBump != 0.0) normal = normalize(abs(det) * normal - grad);
			}` : ''}`);
	};
	const pk = m.customProgramCacheKey?.bind(m);
	m.customProgramCacheKey = () => (pk ? pk() : '') + '|roofdetail1';
	return m;
}
