// Mt Diablo's landmarks, at their real places:
//   Rock City: honey-coloured sandstone domes by South Gate Road, weathered into
//     wind caves you can walk into, honeycombed with tafoni, ledged by old bedding
//   Castle Rock: the sandstone crags over Pine Canyon
//   the summit: the stone Summit Building, its observation deck, its crenellated tower
//     and the beacon, and the car park's walled loop
// Each rock is carved from a signed-distance field (blobs, bedding ledges, caves hollowed
// out of it) into a surface-nets mesh, in a Web Worker, the nearest first as you come
// near. The same field makes the rock solid: you are pushed off its walls and can step
// up on its ledges, and the caves are open to walk in.

import * as THREE from 'three';
import { photoUniform, TRI_GLSL } from '../world/photomats.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toWorld } from './geo.js';

// ---------- the landmarks ----------
// size: half the formation's extent; blobs: how many masses; caves: hollows; tall: spires
const ROCKS = [
	// Rock City, by South Gate Road
	{ lat: 37.8455, lon: -121.9387, size: 14, blobs: 4, caves: 2, seed: 11 },
	{ lat: 37.8449, lon: -121.9378, size: 11, blobs: 3, caves: 1, seed: 12 },
	{ lat: 37.8461, lon: -121.9373, size: 9, blobs: 3, caves: 1, seed: 13 },
	{ lat: 37.8443, lon: -121.9393, size: 8, blobs: 2, caves: 0, seed: 14 },
	{ lat: 37.8466, lon: -121.9397, size: 12, blobs: 2, caves: 0, seed: 15, tall: 1.8 },     // Sentinel Rock
	{ lat: 37.8452, lon: -121.9403, size: 7, blobs: 2, caves: 1, seed: 16 },
	{ lat: 37.8438, lon: -121.9372, size: 9, blobs: 3, caves: 1, seed: 17 },
	// Castle Rock, over Pine Canyon
	{ lat: 37.8942, lon: -121.9918, size: 22, blobs: 4, caves: 1, seed: 21, tall: 1.6 },
	{ lat: 37.8930, lon: -121.9904, size: 18, blobs: 3, caves: 0, seed: 22, tall: 1.9 },
	{ lat: 37.8951, lon: -121.9899, size: 15, blobs: 3, caves: 1, seed: 23, tall: 1.4 },
];
export const SUMMIT = { lat: 37.88175, lon: -121.91415 };

// ---------- the carver ----------
// Everything that shapes a rock lives in this one self-contained function (it names
// nothing outside itself), so the same code runs here, for the rock's solidity and to
// carve when there is no worker, and, as its own source text, in a Web Worker.
function rockKit() {
	const hh = (i, j, k) => { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
	function vn3(x, y, z) {
		const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k;
		const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), sw = w * w * (3 - 2 * w);
		const l = (a, b, t) => a + (b - a) * t;
		return l(l(l(hh(i, j, k), hh(i + 1, j, k), su), l(hh(i, j + 1, k), hh(i + 1, j + 1, k), su), sv), l(l(hh(i, j, k + 1), hh(i + 1, j, k + 1), su), l(hh(i, j + 1, k + 1), hh(i + 1, j + 1, k + 1), su), sv), sw);
	}
	const fbm = (x, y, z) => vn3(x, y, z) * 0.6 + vn3(x * 2.03 + 5.1, y * 2.03, z * 2.03 - 3.3) * 0.28 + vn3(x * 4.1 - 7, y * 4.1 + 2, z * 4.1) * 0.12;
	const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
	const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
	const smax = (a, b, k) => -smin(-a, -b, k);
	const ell = (x, y, z, rx, ry, rz) => { const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 > 1e-6 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); };

	// the land under a rock, in its own frame: G×G heights over ±E, read bilinearly
	function groundOf(H, G, E) {
		const s = (G - 1) / (2 * E);
		return (x, z) => {
			const u = Math.min(G - 1.001, Math.max(0, (x + E) * s)), v = Math.min(G - 1.001, Math.max(0, (z + E) * s));
			const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, o = j * G + i;
			return (H[o] * (1 - fu) + H[o + 1] * fu) * (1 - fv) + (H[o + G] * (1 - fu) + H[o + G + 1] * fu) * fv;
		};
	}

	// the signed distance to the rock (negative inside): masses sitting on the ground, the
	// caves opening at its level on the downhill side
	function sdfOf(spec, ground) {
		const r = mulberry(spec.seed), S = spec.size, T = (spec.tall || 1) * 1.35;
		const blobs = [];
		for (let k = 0; k < spec.blobs; k++) {
			const a = r() * Math.PI * 2, d = k ? S * (0.25 + r() * 0.3) : 0;
			const rx = S * (0.35 + r() * 0.25) * (k ? 0.85 : 1), rz = S * (0.3 + r() * 0.25), ry = S * (0.3 + r() * 0.2) * T;
			const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
			blobs.push([bx, ground(bx, bz) + ry * (0.6 + r() * 0.25), bz, rx, ry, rz]);
		}
		const caves = [];
		for (let k = 0; k < spec.caves; k++) {
			const b = blobs[k % blobs.length];
			// the mouth faces downhill
			const gx = ground(b[0] + 3, b[2]) - ground(b[0] - 3, b[2]), gz = ground(b[0], b[2] + 3) - ground(b[0], b[2] - 3);
			const a = Math.hypot(gx, gz) > 0.3 ? Math.atan2(-gz, -gx) + (r() - 0.5) * 0.6 : r() * Math.PI * 2;
			const cr = Math.min(b[3], b[5]) * (0.45 + r() * 0.15), ry = 1.9 + r() * 0.6;
			const cx = b[0] + Math.cos(a) * cr * 0.8, cz = b[2] + Math.sin(a) * cr * 0.8;
			// a sandstone floor just above the ground, the hollow rising from it
			const floorY = Math.max(ground(cx, cz), ground(b[0], b[2]) - 1) + 0.25;
			caves.push([cx, floorY + ry * 0.75, cz, cr, ry, cr * 0.85]);
			// a window high in the wall, as the wind carves them
			caves.push([b[0] - Math.cos(a) * cr * 0.4, floorY + 3 + r() * 1.5, b[2] - Math.sin(a) * cr * 0.4, cr * 0.4, 1.1, cr * 1.6]);
		}
		const f = (x, y, z) => {
			let d = 1e9;
			for (const b of blobs) d = smin(d, ell(x - b[0], y - b[1], z - b[2], b[3], b[4], b[5]), 3);
			// weathering: lumps, then ledges along the old bedding planes
			d += (fbm(x * 0.09, y * 0.09, z * 0.09) - 0.5) * S * 0.28 + (fbm(x * 0.3, y * 0.3, z * 0.3) - 0.5) * 0.45;
			d += Math.sin(y * 1.25 + fbm(x * 0.06, y * 0.2, z * 0.06) * 5) * 0.22;
			for (const c of caves) d = smax(d, -ell(x - c[0], y - c[1], z - c[2], c[3], c[4], c[5]), 0.9);
			// tafoni: shallow hollows eaten into the lower walls
			d += Math.max(0, fbm(x * 0.35 + 3, y * 0.35, z * 0.35) - 0.6) * 2.4 * (y < S * T * 0.8 ? 1 : 0.3);
			return Math.max(d, -(y - ground(x, z) + S * 0.4));                                 // closed well under the ground
		};
		return { f, S, T, blobs, caves };
	}

	// Carve a rock into a surface: the field sampled on a grid of about 46 cells across the
	// rock, then a surface-nets mesh with normals from the field's gradient and a baked
	// occlusion in the vertex colours (dark in the caves and where the rock meets the ground).
	// A generator: it pauses every little while, so the main thread can spread it over frames.
	function* carve(spec, H, G, E) {
		const ground = groundOf(H, G, E), sdf = sdfOf(spec, ground), f = sdf.f, S = sdf.S;
		// the box it fills: round the masses, from under the lowest ground to over the tops
		let X = 0, hi = -1e9, lo = 1e9;
		for (const b of sdf.blobs) { X = Math.max(X, Math.hypot(b[0], b[2]) + Math.max(b[3], b[5])); hi = Math.max(hi, b[1] + b[4]); }
		X += S * 0.15 + 2; hi += S * 0.15 + 1.5;
		for (let a = -1; a <= 1; a += 0.25) for (let b = -1; b <= 1; b += 0.25) lo = Math.min(lo, ground(a * X, b * X));
		lo -= 1.5;
		const c = Math.max(0.45, Math.max(2 * X, hi - lo) / 46);
		const nx = Math.ceil(2 * X / c) + 1, ny = Math.ceil((hi - lo) / c) + 1, nz = nx, sxy = nx * ny;
		const x0 = -(nx - 1) * c / 2, y0 = lo, z0 = x0;
		const F = new Float32Array(sxy * nz), done = new Uint8Array(sxy * nz);
		// first blocks of 4×4×4 cells, each tried at its middle: one far from the surface
		// (by more than the field can change across it) is all inside or all outside
		const B = 4, far = 2.5 * B * 0.5 * c * Math.sqrt(3) + 1, near = [];
		for (let k0 = 0; k0 < nz - 1; k0 += B) {
			const k1 = Math.min(nz - 1, k0 + B);
			for (let j0 = 0; j0 < ny - 1; j0 += B) {
				const j1 = Math.min(ny - 1, j0 + B);
				for (let i0 = 0; i0 < nx - 1; i0 += B) {
					const i1 = Math.min(nx - 1, i0 + B), d = f(x0 + (i0 + i1) / 2 * c, y0 + (j0 + j1) / 2 * c, z0 + (k0 + k1) / 2 * c);
					if (Math.abs(d) < far) { near.push(i0, i1, j0, j1, k0, k1); continue; }
					for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) F[i + j * nx + k * sxy] = d;
				}
			}
			yield;
		}
		// then the field itself in the blocks the surface may pass through
		for (let q = 0; q < near.length; q += 6) {
			for (let k = near[q + 4]; k <= near[q + 5]; k++) for (let j = near[q + 2]; j <= near[q + 3]; j++) for (let i = near[q]; i <= near[q + 1]; i++) {
				const o = i + j * nx + k * sxy;
				if (!done[o]) { F[o] = f(x0 + i * c, y0 + j * c, z0 + k * c); done[o] = 1; }
			}
			yield;
		}
		// outside at the box's faces, so the surface closes (its floor is under the ground)
		for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
			if (i && j && k && i < nx - 1 && j < ny - 1 && k < nz - 1) continue;
			const o = i + j * nx + k * sxy;
			F[o] = Math.max(F[o], 0.05);
		}
		yield;
		// one vertex in each cell the surface crosses, at the mean of the crossings on its edges
		const CO = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1], EDGES = [];
		for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) EDGES.push(a, a | bit);
		const vid = new Int32Array(sxy * nz).fill(-1), P = [], N = [], v = new Float64Array(8);
		const at = (i, j, k) => F[Math.min(nx - 1, Math.max(0, i)) + Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nz - 1, Math.max(0, k)) * sxy];
		for (let k = 0; k < nz - 1; k++) {
			for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
				const o = i + j * nx + k * sxy;
				let m = 0;
				for (let q = 0; q < 8; q++) { v[q] = F[o + CO[q]]; if (v[q] < 0) m |= 1 << q; }
				if (m === 0 || m === 255) continue;
				let sx = 0, sy = 0, sz = 0, n = 0;
				for (let e = 0; e < 24; e += 2) {
					const a = EDGES[e], b = EDGES[e + 1];
					if ((v[a] < 0) === (v[b] < 0)) continue;
					const t = v[a] / (v[a] - v[b]);
					sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; n++;
				}
				const fx = sx / n, fy = sy / n, fz = sz / n;
				vid[o] = P.length / 3;
				P.push(x0 + (i + fx) * c, y0 + (j + fy) * c, z0 + (k + fz) * c);
				// the smooth normal: the field's gradient at the corners, blended to the vertex
				let gx = 0, gy = 0, gz = 0;
				for (let q = 0; q < 8; q++) {
					const di = q & 1, dj = q >> 1 & 1, dk = q >> 2 & 1, w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz);
					const ci = i + di, cj = j + dj, ck = k + dk;
					gx += (at(ci + 1, cj, ck) - at(ci - 1, cj, ck)) * w; gy += (at(ci, cj + 1, ck) - at(ci, cj - 1, ck)) * w; gz += (at(ci, cj, ck + 1) - at(ci, cj, ck - 1)) * w;
				}
				const gl = Math.hypot(gx, gy, gz) || 1;
				N.push(gx / gl, gy / gl, gz / gl);
			}
			yield;
		}
		// a quad across each grid edge the surface crosses, joining the four cells round it
		const I = [];
		const quad = (a, b, cc, d) => {
			if (a < 0 || b < 0 || cc < 0 || d < 0) return;
			// wound to face out, along the gradient
			const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
			const wx = P[cc * 3] - P[a * 3], wy = P[cc * 3 + 1] - P[a * 3 + 1], wz = P[cc * 3 + 2] - P[a * 3 + 2];
			const s = (uy * wz - uz * wy) * (N[a * 3] + N[cc * 3]) + (uz * wx - ux * wz) * (N[a * 3 + 1] + N[cc * 3 + 1]) + (ux * wy - uy * wx) * (N[a * 3 + 2] + N[cc * 3 + 2]);
			if (s >= 0) I.push(a, b, cc, a, cc, d); else I.push(a, cc, b, a, d, cc);
		};
		for (let k = 0; k < nz - 1; k++) {
			for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
				const o = i + j * nx + k * sxy, in0 = F[o] < 0;
				if (j && k && in0 !== F[o + 1] < 0) quad(vid[o - nx - sxy], vid[o - sxy], vid[o], vid[o - nx]);
				if (i && k && in0 !== F[o + nx] < 0) quad(vid[o - 1 - sxy], vid[o - sxy], vid[o], vid[o - 1]);
				if (i && j && in0 !== F[o + sxy] < 0) quad(vid[o - 1 - nx], vid[o - nx], vid[o], vid[o - 1]);
			}
			yield;
		}
		// the occlusion: how much open air lies out along the normal, and the ground's shade
		const nv = P.length / 3, col = new Uint8Array(nv * 3);
		for (let q = 0; q < nv; q++) {
			const px = P[q * 3], py = P[q * 3 + 1], pz = P[q * 3 + 2];
			const d = f(px + N[q * 3] * 1.2, py + N[q * 3 + 1] * 1.2, pz + N[q * 3 + 2] * 1.2);
			const ao = Math.min(1, Math.max(0.42, 0.3 + 0.7 * d / 1.2)) * (0.78 + 0.22 * Math.min(1, Math.max(0, (py - ground(px, pz)) / 1.6)));
			col[q * 3] = Math.round(255 * ao); col[q * 3 + 1] = Math.round(248 * ao); col[q * 3 + 2] = Math.round(238 * ao);
			if (q % 250 === 249) yield;
		}
		return { pos: new Float32Array(P), nor: new Float32Array(N), col, idx: nv > 65535 ? new Uint32Array(I) : new Uint16Array(I) };
	}
	return { sdfOf, groundOf, carve, hh, mulberry };
}
const KIT = rockKit();
// the worker: carves each rock it is sent and hands the arrays back (transferred, not copied)
const WORKER_SRC = `const K = (${rockKit})();
onmessage = (e) => {
	const { id, spec, H, G, E } = e.data, it = K.carve(spec, H, G, E);
	let r = it.next();
	while (!r.done) r = it.next();
	const o = r.value;
	postMessage({ id, ...o }, [o.pos.buffer, o.nor.buffer, o.col.buffer, o.idx.buffer]);
};`;

function rockMaterial() {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, vertexColors: true });
	// the photographed sandstone (build 191) laid over the painted bedding, at hand's reach
	const [uStone, uStoneK] = photoUniform('sandstone', { mean: 0.9, contrast: 0.9 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uStone = uStone; sh.uniforms.uStoneK = uStoneK;
		sh.vertexShader = 'varying vec3 vRW; varying vec3 vRN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);');
		sh.fragmentShader = 'varying vec3 vRW; varying vec3 vRN; uniform sampler2D uStone; uniform float uStoneK;\n' + TRI_GLSL + `
float rh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float rn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(rh(i), rh(i + vec3(1,0,0)), f.x), mix(rh(i + vec3(0,1,0)), rh(i + vec3(1,1,0)), f.x), f.y), mix(mix(rh(i + vec3(0,0,1)), rh(i + vec3(1,0,1)), f.x), mix(rh(i + vec3(0,1,1)), rh(i + vec3(1,1,1)), f.x), f.y), f.z); }
// honeycomb: distance to the nearest and second-nearest cell centres, on a plane
float rh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cell2(vec2 p){ vec2 i = floor(p); float d1 = 9.0, d2 = 9.0;
	for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) { vec2 g = i + vec2(a, b); vec2 o = g + vec2(rh2(g), rh2(g + 7.1)) * 0.8; float d = length(p - o); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
	return vec2(d1, d2); }
float rockH = 0.0;
` + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 n = normalize(vRN);
				float up = n.y;
				// the sandstone: warm ochre and cream in bands along the bedding, iron-stained
				float band = rn(vec3(vRW.x * 0.05, vRW.y * 0.9, vRW.z * 0.05)), big = rn(vRW * 0.08), fine = rn(vRW * 2.3);
				vec3 c = mix(vec3(0.72, 0.47, 0.18), vec3(0.86, 0.64, 0.3), band);
				c = mix(c, vec3(0.66, 0.38, 0.2), smoothstep(0.55, 0.85, big) * 0.6);
				// honeycomb tafoni on the walls: pits with pale sharp rims
				float wall = 1.0 - smoothstep(0.35, 0.75, abs(up));
				// on the plane the face mostly looks along; only close by, where it can be seen
				vec2 fp = abs(n.x) > abs(n.z) ? vRW.zy : vRW.xy;
				float nearK = 1.0 - smoothstep(50.0, 80.0, length(cameraPosition - vRW));
				vec2 v = nearK > 0.0 ? cell2(fp * (1.1 + 1.2 * rn(vRW * 0.1))) : vec2(0.0, 1.0);
				wall *= nearK;
				float pit = smoothstep(0.04, 0.3, v.y - v.x) * wall;
				float patchT = smoothstep(0.5, 0.72, rn(vRW * 0.18));
				c *= mix(1.0, 0.5 + 0.5 * smoothstep(0.0, 0.5, v.x), pit * patchT);
				rockH = (v.y - v.x) * wall * 0.25 * patchT;
				// lichen on the tops: grey-green and a little orange; dark streaks down the faces
				float lich = smoothstep(0.55, 0.75, rn(vRW * 0.9)) * smoothstep(0.4, 0.9, up);
				c = mix(c, mix(vec3(0.55, 0.58, 0.48), vec3(0.8, 0.55, 0.2), step(0.85, rn(vRW * 3.0))), lich * 0.7);
				c *= 1.0 - smoothstep(0.6, 0.9, rn(vec3(vRW.x * 0.6, vRW.y * 0.08, vRW.z * 0.6))) * wall * 0.35;
				// soot and shade deep in the hollows (faces looking down)
				c *= mix(1.0, 0.7, smoothstep(0.0, -0.8, up));
				// the grain, layering and weathering of real sandstone, strongest close by
				float pk = uStoneK * (1.0 - smoothstep(60.0, 160.0, length(cameraPosition - vRW)));
				// (two scales: its bedding a few metres across, its grain up close)
				float phL = dot(triPhoto(uStone, vRW, n, 0.13), vec3(0.3, 0.59, 0.11)) * 0.65 + dot(triPhoto(uStone, vRW + 3.7, n, 0.6), vec3(0.3, 0.59, 0.11)) * 0.35;
				float pkF = pk * (1.0 - smoothstep(8.0, 30.0, length(cameraPosition - vRW)) * 0.5);
				c = mix(c, c * mix(1.0, phL / 0.79, 0.6), pkF);
				rockH += (phL - 0.79) * 0.035 * pkF;
				// the occlusion carved into the vertices: dark in the caves and at the foot
				#ifdef USE_COLOR
				c *= vColor.rgb;
				#endif
				diffuseColor.rgb = c * (0.9 + 0.2 * fine);
			}`)
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
			{
				vec3 sp = -vViewPosition, vSx = dFdx(sp), vSy = dFdy(sp);
				vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
				float fDet = dot(vSx, R1);
				vec2 dH = vec2(dFdx(rockH), dFdy(rockH));
				normal = normalize(abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2));
			}`);
	};
	m.customProgramCacheKey = () => 'sandstone5';
	return m;
}

// ---------- the summit's stone ----------
// Rough-coursed sandstone as the CCC laid it: courses of uneven height, blocks of every
// length in warm tans, ochres and a few iron-stained browns, in a sunken grey-brown mortar.
// A canvas 4 m across (colour, and its relief for the bump map), mipmapped so it still
// reads as stone from the far side of the car park.
const TILE = 4;
function stoneTextures() {
	const S = 512, cv = document.createElement('canvas'), bv = document.createElement('canvas');
	cv.width = cv.height = bv.width = bv.height = S;
	const g = cv.getContext('2d'), b = bv.getContext('2d'), r = KIT.mulberry(1939);
	g.fillStyle = '#6f624f'; g.fillRect(0, 0, S, S);
	b.fillStyle = '#1c1c1c'; b.fillRect(0, 0, S, S);
	const stoneAt = (x, y, w, h, fill, relief) => {
		// a roughly squared block, its corners knocked off unevenly
		const j = () => 2 + r() * 5, path = (c) => { c.beginPath(); c.moveTo(x + j(), y + 3); c.lineTo(x + w - j(), y + 3); c.lineTo(x + w - 3, y + j()); c.lineTo(x + w - 3, y + h - j()); c.lineTo(x + w - j(), y + h - 3); c.lineTo(x + j(), y + h - 3); c.lineTo(x + 3, y + h - j()); c.lineTo(x + 3, y + j()); c.closePath(); };
		path(g); g.fillStyle = fill; g.fill();
		path(b); b.fillStyle = relief; b.fill();
	};
	for (let y = 0; y < S;) {
		const h = S - y < 70 ? S - y : 30 + Math.floor(r() * 30);
		// a course's blocks, laid round the tile so it repeats without a seam
		const ws = [];
		for (let t = 0; t < S;) { const w = Math.min(S - t, 44 + Math.floor(r() * 96)); ws.push(w < 30 && ws.length ? (ws[ws.length - 1] += w, 0) : w); t += w; }
		let x = -Math.floor(r() * 64);
		for (const w of ws) {
			if (!w) continue;
			const k = r(), iron = r() < 0.12;
			const hue = iron ? 18 + r() * 8 : 30 + r() * 12, sat = iron ? 38 + r() * 12 : 26 + r() * 22, lit = iron ? 38 + r() * 10 : 52 + r() * 18;
			const fill = `hsl(${hue.toFixed(0)},${sat.toFixed(0)}%,${lit.toFixed(0)}%)`, relief = `rgb(${150 + (k * 90) | 0},${150 + (k * 90) | 0},${150 + (k * 90) | 0})`;
			for (const o of [-S, 0, S]) stoneAt(x + o, y, w, h, fill, relief);
			x += w;
		}
		y += h;
	}
	// the grain: pits, fossil shell flecks, lichen, and the weathered darker tops of the blocks
	for (let n = 0; n < 5000; n++) {
		const x = r() * S, y = r() * S, s = 0.6 + r() * 1.8, k = r();
		g.fillStyle = k < 0.45 ? 'rgba(60,44,28,0.35)' : k < 0.85 ? 'rgba(236,220,188,0.3)' : k < 0.95 ? 'rgba(120,128,104,0.45)' : 'rgba(196,140,60,0.5)';
		g.fillRect(x, y, s, s);
		b.fillStyle = k < 0.45 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.2)';
		b.fillRect(x, y, s, s);
	}
	const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
	return [tex(cv, true), tex(bv, false)];
}
// texture co-ordinates in metres, laid on whichever plane each face mostly looks along
function planarUV(geo, ox = 0, oy = 0) {
	const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
	for (let i = 0; i < p.count; i++) {
		const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
		const u = ay > ax && ay > az ? p.getX(i) : ax > az ? p.getZ(i) : p.getX(i), v = ay > ax && ay > az ? p.getZ(i) : p.getY(i);
		uv.setXY(i, (u + ox) / TILE, (v + oy) / TILE);
	}
	return geo;
}
// a round-headed opening w wide and h tall, standing on y = 0 and facing +z
function archGeo(w, h) {
	const s = new THREE.Shape();
	s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2);
	s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
	s.lineTo(-w / 2, 0);
	return new THREE.ShapeGeometry(s, 8);
}
// The car park's loop on the summit (the mapped service road), in metres east and south
// of SUMMIT, and where the roads and the path to the building cross its wall
const LOOP = [[-39.3, -2.2], [-48.3, -1.2], [-52.8, 1.8], [-54.8, 5.8], [-53.8, 8.8], [-51.8, 11.8], [-48.8, 13.3], [-41.3, 12.8], [-37.3, 11.8], [-34.8, 9.8], [-33.8, 7.3], [-33.3, 2.3], [-35.3, -1.7]];
const LOOP_GAPS = [[-54.5, 1.5], [-49.5, 15], [-31.5, 4.5]];
// the Summit Building's mapped footprint (Overture): the hall's middle from SUMMIT, its
// long axis's bearing (radians, as the map records it) and size, and the tower's middle
const HALL = { dx: -4.3, dz: -0.7, a: 0.9717, w: 26, d: 12.35 }, TOWER = { dx: 0.2, dz: 5.8, s: 6.4 };
// landmarks.js's stand-in for this building, a plain block and tower some 17 m off
const STAND_IN = { lat: 37.8816, lon: -121.9142 };

export function createDiablo(scene, bay) {
	const group = new THREE.Group();
	group.name = 'mt-diablo';
	scene.add(group);
	const rockMat = rockMaterial();
	const rocks = ROCKS.map((spec) => { const w = toWorld(spec.lat, spec.lon); return { spec, x: w.x, z: w.z, built: false, mesh: null, sdf: null, y: 0, yaw: KIT.hh(spec.seed, 3, 5) * 6.28, H: null, E: 0 }; });
	// the heights here are only true once the Mt Diablo level has loaded (it loads last)
	let terrainDone = false;
	bay.ready?.then(() => { terrainDone = true; }, () => { terrainDone = true; });
	const fine = () => terrainDone || !!bay.levels?.[4];

	// ---------- carving the rocks ----------
	// The carving runs in a Web Worker, one rock at a time, the nearest first; the worker
	// hands back the surface's arrays and only the mesh is made here. Without a worker the
	// same carver runs here, a few milliseconds a frame at most.
	const G = 40;
	let worker = null, pending = null, job = null;
	// where it stands, and the land under it sampled for the carver
	function prepare(R) {
		// between its middle and its lowest edge, so it stands clear of the slope's downhill side
		const s0 = R.spec.size;
		let gmin = bay.heightAt(R.x, R.z);
		const g0 = gmin;
		for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) gmin = Math.min(gmin, bay.heightAt(R.x + a * s0 * 0.6, R.z + b * s0 * 0.6));
		R.y = (g0 + gmin) / 2 - 0.6;
		const c = Math.cos(R.yaw), sn = Math.sin(R.yaw), E = s0 * 3, H = new Float32Array(G * G);
		for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
			const lx = -E + i * 2 * E / (G - 1), lz = -E + j * 2 * E / (G - 1);
			H[j * G + i] = bay.heightAt(R.x + lx * c + lz * sn, R.z - lx * sn + lz * c) - R.y;
		}
		R.H = H; R.E = E;
	}
	function carveHere(R) { job = { R, it: KIT.carve(R.spec, R.H, G, R.E) }; }
	try {
		worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
		worker.onmessage = (e) => { const R = rocks[e.data.id]; pending = null; build(R, e.data); };
		// a worker that cannot run (a strict policy, an old browser): carve here instead
		worker.onerror = (e) => { e.preventDefault?.(); worker.terminate(); worker = null; if (pending) carveHere(pending); pending = null; };
	} catch {
		worker = null;
	}
	function build(R, o) {
		R.sdf = KIT.sdfOf(R.spec, KIT.groundOf(R.H, G, R.E));
		if (!o.idx.length) return;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(o.pos, 3));
		g.setAttribute('normal', new THREE.BufferAttribute(o.nor, 3));
		g.setAttribute('color', new THREE.BufferAttribute(o.col, 3, true));
		g.setIndex(new THREE.BufferAttribute(o.idx, 1));
		g.computeBoundingSphere();
		const mesh = new THREE.Mesh(g, rockMat);
		mesh.castShadow = mesh.receiveShadow = true;
		mesh.position.set(R.x, R.y, R.z); mesh.rotation.y = R.yaw;
		group.add(mesh);
		R.mesh = mesh;
	}

	// ---------- the summit: the Summit Building ----------
	// Built by the CCC in 1939-42 of the mountain's own sandstone: a long two-storey hall of
	// rough-coursed tan stone with round-arched windows, its flat roof an observation deck
	// behind a parapet and a railing, and a squat square tower with a crenellated top that
	// carries the aviation beacon. Below it the loop of the summit car park, walled in stone.
	const sw = toWorld(SUMMIT.lat, SUMMIT.lon);
	const summit = new THREE.Group();
	summit.name = 'diablo-summit';
	group.add(summit);
	const [stoneMap, stoneBump] = stoneTextures();
	const stone = new THREE.MeshStandardMaterial({ map: stoneMap, bumpMap: stoneBump, bumpScale: 1, roughness: 0.95 });
	// the dressed stone of the sills, arches and copings: paler and smooth
	const trim = new THREE.MeshStandardMaterial({ color: 0xcfb58c, roughness: 0.85 });
	const glassM = new THREE.MeshStandardMaterial({ color: 0x1b2328, roughness: 0.15, metalness: 0.4, emissive: 0xffb46a, emissiveIntensity: 0 });
	const steel = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.5, metalness: 0.6 });
	const lens = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.2, metalness: 0.1, emissive: 0xfff0c8, emissiveIntensity: 0 });
	const ca = Math.cos(HALL.a), sa = Math.sin(HALL.a);
	// the tower's middle in the hall's frame (+x along the hall)
	const tdx = TOWER.dx - HALL.dx, tdz = TOWER.dz - HALL.dz, tx = ca * tdx + sa * tdz, tz = -sa * tdx + ca * tdz;
	const dims = { Hm: 7, Ht: 12.6, gc: 0 };
	const beaconPos = new THREE.Vector3(tx, 14, tz);
	let beaconDay = 0;
	const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
	const glow = (color) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
	// the beacon's turning white beam, and the steady red warning light under it
	const beacon = glow(0xfff2dc), red = glow(0xff2a1a);
	summit.add(beacon, red);
	// (built over three frames: the building, the car park's wall, then the stand-in cleared)
	let summitPlaced = false, summitStage = 0;

	function buildHall() {
		const { w: W, d: D } = HALL, T = TOWER.s;
		const cx = sw.x + HALL.dx, cz = sw.z + HALL.dz;
		const toW = (lx, lz) => [cx + ca * lx - sa * lz, cz + sa * lx + ca * lz];
		const gAt = (lx, lz) => { const [x, z] = toW(lx, lz); return bay.heightAt(x, z); };
		// the ground under it: the building stands on its middle, walls down to the lowest
		const gc = gAt(0, 0);
		let gmin = 0, gmax = 0;
		for (let a = -1; a <= 1; a += 1 / 3) for (let b = -1; b <= 1; b += 0.5) { const h = gAt(a * W / 2, b * D / 2) - gc; gmin = Math.min(gmin, h); gmax = Math.max(gmax, h); }
		const yb = gmin - 1.5, Hm = Math.max(0, gmax) + 7, Ht = Hm + 5.6;
		Object.assign(dims, { Hm, Ht, gc });
		summit.position.set(cx, gc, cz); summit.rotation.y = -HALL.a;
		const parts = { stone: [], trim: [], glass: [], steel: [] };
		// a block placed in the hall's frame, textured where it stands so the courses run on
		const box = (list, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z); parts[list].push(list === 'stone' || list === 'trim' ? planarUV(g) : g); };
		// the hall, and the tower rising through it
		box('stone', W, Hm - yb, D, 0, yb, 0);
		box('stone', W + 0.5, 0.9 - yb, D + 0.5, 0, yb, 0);                                         // the projecting base course
		box('trim', W + 0.24, 0.3, D + 0.24, 0, Hm * 0.5 - 0.15, 0);                                 // the string course between the floors
		box('stone', T, Ht - yb, T, tx, yb, tz);
		// the observation deck: a parapet round the roof, its coping, and the railing on it
		box('stone', W, 1.1, 0.45, 0, Hm, D / 2 - 0.225); box('stone', W, 1.1, 0.45, 0, Hm, -D / 2 + 0.225);
		box('stone', 0.45, 1.1, D - 0.9, W / 2 - 0.225, Hm, 0); box('stone', 0.45, 1.1, D - 0.9, -W / 2 + 0.225, Hm, 0);
		box('trim', W + 0.2, 0.16, 0.65, 0, Hm + 1.1, D / 2 - 0.225); box('trim', W + 0.2, 0.16, 0.65, 0, Hm + 1.1, -D / 2 + 0.225);
		box('trim', 0.65, 0.16, D - 0.9, W / 2 - 0.225, Hm + 1.1, 0); box('trim', 0.65, 0.16, D - 0.9, -W / 2 + 0.225, Hm + 1.1, 0);
		const yr = Hm + 1.26;
		for (const s of [-1, 1]) {
			box('steel', W, 0.06, 0.06, 0, yr + 0.9, s * (D / 2 - 0.225)); box('steel', W, 0.05, 0.05, 0, yr + 0.45, s * (D / 2 - 0.225));
			box('steel', 0.06, 0.06, D, s * (W / 2 - 0.225), yr + 0.9, 0); box('steel', 0.05, 0.05, D, s * (W / 2 - 0.225), yr + 0.45, 0);
			for (let x = -W / 2 + 0.3; x <= W / 2 - 0.2; x += W / 13) box('steel', 0.06, 0.92, 0.06, x, yr, s * (D / 2 - 0.225));
			for (let z = -D / 2 + 0.3; z <= D / 2 - 0.2; z += D / 6) box('steel', 0.06, 0.92, 0.06, s * (W / 2 - 0.225), yr, z);
		}
		// the tower's top: a corbelled band, then a crenellated parapet, four merlons a side
		const Tc = T + 0.5;
		box('trim', Tc, 0.35, Tc, tx, Ht - 0.35, tz);
		for (const [ux, uz] of [[1, 0], [0, 1]]) for (const s of [-1, 1]) {
			const px = tx + uz * s * (Tc / 2 - 0.225), pz = tz + ux * s * (Tc / 2 - 0.225);
			box('stone', ux ? Tc : 0.45, 0.5, ux ? 0.45 : Tc, px, Ht, pz);
			for (let m = 0; m < 4; m++) {
				const u = -Tc / 2 + 0.45 + m * (Tc - 0.9) / 3;
				box('stone', ux ? 0.9 : 0.45, 0.75, ux ? 0.45 : 0.9, px + ux * u, Ht + 0.5, pz + uz * u);
			}
		}
		// the beacon on its steel pedestal
		box('steel', 1.3, 1.4, 1.3, tx, Ht, tz);
		const lensG = new THREE.CylinderGeometry(0.62, 0.62, 0.8, 16).translate(tx, Ht + 1.8, tz), capG = new THREE.ConeGeometry(0.72, 0.5, 16).translate(tx, Ht + 2.45, tz);
		parts.steel.push(capG);
		beaconPos.set(tx, Ht + 1.8, tz); beacon.position.copy(beaconPos); red.position.set(tx, Ht + 1.1, tz); red.scale.setScalar(6);
		// round-arched windows in dressed-stone surrounds, with sills; a door facing the car park
		const win = (lx, y, lz, ry, w, h, glass = 'glass') => {
			const nx = Math.sin(ry), nz = Math.cos(ry);
			parts.trim.push(planarUV(archGeo(w + 0.4, h + 0.2)).rotateY(ry).translate(lx + nx * 0.03, y - 0.1, lz + nz * 0.03));
			parts[glass].push(archGeo(w, h).rotateY(ry).translate(lx + nx * 0.06, y, lz + nz * 0.06));
			parts.trim.push(planarUV(new THREE.BoxGeometry(w + 0.5, 0.12, 0.3)).rotateY(ry).translate(lx + nx * 0.1, y - 0.12, lz + nz * 0.1));
		};
		const low = Hm * 0.5 - 2.6, up = Hm - 2.7;
		for (const s of [-1, 1]) {
			for (const x of [-10.5, -7, -3.5, 0, 3.5, 7, 10.5]) {
				const door = s > 0 && x === -3.5;
				if (door) win(x, gAt(x, D / 2 + 0.5) - gc + 0.05, D / 2, 0, 1.9, 3, 'steel');
				else if (gAt(x, s * (D / 2 + 0.5)) - gc + 0.9 < low) win(x, low, s * D / 2, s > 0 ? 0 : Math.PI, 1.1, 2);
				win(x, up, s * D / 2, s > 0 ? 0 : Math.PI, 1.1, 1.9);
			}
			for (const z of [-3, 3]) {
				if (gAt(s * (W / 2 + 0.5), z) - gc + 0.9 < low) win(s * W / 2, low, z, s * Math.PI / 2, 1.1, 2);
				win(s * W / 2, up, z, s * Math.PI / 2, 1.1, 1.9);
			}
			// the tower's tall windows, looking out over the deck
			win(tx + s * T / 2, Hm + 1.5, tz, s * Math.PI / 2, 1.2, 2.8);
			win(tx, Hm + 1.5, tz + s * T / 2, s > 0 ? 0 : Math.PI, 1.2, 2.8);
		}
		const mats = { stone, trim, glass: glassM, steel };
		for (const k in parts) {
			const m = new THREE.Mesh(mergeGeometries(parts[k]), mats[k]);
			m.castShadow = m.receiveShadow = true;
			summit.add(m);
		}
		const lm = new THREE.Mesh(lensG, lens);
		summit.add(lm);
	}
	// the car park's low stone wall, outside the loop (open where the roads and the path
	// cross it) and round the island in its middle
	function buildLoopWall() {
		const ctr = LOOP.reduce((a, p) => [a[0] + p[0] / LOOP.length, a[1] + p[1] / LOOP.length], [0, 0]);
		const wall = [];
		for (const off of [3.3, -3.3]) {
			const ring = LOOP.map(([x, z]) => { const dx = x - ctr[0], dz = z - ctr[1], l = Math.hypot(dx, dz); return [x + dx / l * off, z + dz / l * off]; });
			for (let q = 0; q < ring.length; q++) {
				const [ax, az] = ring[q], [bx, bz] = ring[(q + 1) % ring.length], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2));
				for (let t = 0; t < n; t++) {
					const mx = ax + (bx - ax) * (t + 0.5) / n, mz = az + (bz - az) * (t + 0.5) / n;
					if (off > 0 && LOOP_GAPS.some(([gx, gz]) => Math.hypot(mx - gx, mz - gz) < 4)) continue;
					const gy = bay.heightAt(sw.x + mx, sw.z + mz);
					const g = planarUV(new THREE.BoxGeometry(L / n + 0.12, 1.05, 0.5), mx * 0.7, gy);
					wall.push(g.rotateY(-Math.atan2(bz - az, bx - ax)).translate(mx, gy - 0.3 + 0.525, mz));
				}
			}
		}
		const wm = new THREE.Mesh(mergeGeometries(wall), stone);
		wm.position.set(sw.x, 0, sw.z); wm.castShadow = wm.receiveShadow = true;
		group.add(wm);
	}
	// landmarks.js's plain stand-in for this building stands 17 m off: fold its faces away
	function foldStandIn() {
		const lw = toWorld(STAND_IN.lat, STAND_IN.lon);
		scene.getObjectByName('bay-landmarks')?.traverse((o) => {
			const p = o.isMesh && !o.geometry.index && o.geometry.attributes.position;
			if (!p || p.isInterleavedBufferAttribute) return;
			const A = p.array, near = (v) => Math.abs(A[v] - lw.x) < 12 && Math.abs(A[v + 2] - lw.z) < 12;
			let hit = false;
			for (let t = 0; t < A.length; t += 9) {
				if (!near(t) || !near(t + 3) || !near(t + 6)) continue;
				for (let v = t + 3; v < t + 9; v++) A[v] = A[t + (v - t) % 3];
				hit = true;
			}
			if (hit) { p.needsUpdate = true; o.geometry.computeBoundingSphere(); }
		});
	}

	function update(dt, t, cam, nightK) {
		if (!bay.loaded() || !fine()) return;
		const x = cam.position.x, z = cam.position.z;
		// the summit first, over three frames; then carve the rocks you come near, the nearest first
		if (summitStage < 3) { [buildHall, buildLoopWall, foldStandIn][summitStage++](); summitPlaced = true; } else if (!pending && !job) {
			let best = null, bd = 3500;
			for (const R of rocks) { const d = Math.hypot(R.x - x, R.z - z); if (!R.built && d < bd) { bd = d; best = R; } }
			if (best) {
				best.built = true;
				prepare(best);
				if (worker) { pending = best; worker.postMessage({ id: rocks.indexOf(best), spec: best.spec, H: best.H, G, E: best.E }); }
				else carveHere(best);
			}
		} else if (job?.out) { build(job.R, job.out); job = null; } else if (job) {
			// (on the main thread: a few milliseconds of it a frame, never more, and the mesh
			// made on a frame of its own)
			const t0 = performance.now();
			let r = job.it.next();
			while (!r.done && performance.now() - t0 < 3) r = job.it.next();
			if (r.done) job.out = r.value;
		}
		for (const R of rocks) if (R.mesh) R.mesh.visible = Math.hypot(R.x - x, R.z - z) < 9000;
		// the beacon turns: a flash each time its beam sweeps past you
		const bw = beaconPos.clone().applyMatrix4(summit.matrixWorld), a = t * 1.9;
		const to = new THREE.Vector2(cam.position.x - bw.x, cam.position.z - bw.z).normalize();
		const flash = Math.pow(Math.max(0, Math.cos(a) * to.x + Math.sin(a) * to.y), 24);
		// (on Pearl Harbor Day it is lit in earnest, as it has been every 7 December since 1964)
		beacon.material.opacity = nightK * (0.25 + 0.9 * flash) * (1 + beaconDay * 0.6);
		beacon.scale.setScalar((20 + 60 * flash) * (1 + beaconDay * 1.5));
		lens.emissiveIntensity = (0.15 + 2.5 * flash) * Math.max(nightK, beaconDay * 0.5);
		red.material.opacity = nightK * (0.55 + 0.45 * Math.sin(t * 3)) * 0.9;
		// the museum's windows lit in the evening
		glassM.emissiveIntensity = nightK * 0.35;
	}

	// ---------- the rock and the building are solid ----------
	const local = (R, x, y, z) => { const c = Math.cos(-R.yaw), s = Math.sin(-R.yaw), dx = x - R.x, dz = z - R.z; return [dx * c - dz * s, y - R.y, dx * s + dz * c]; };
	// the hall and the tower in the hall's frame, and a point there
	const hallAt = (x, z) => { const dx = x - summit.position.x, dz = z - summit.position.z; return [ca * dx + sa * dz, -sa * dx + ca * dz]; };
	// (the hall's walls stand from the ground; the tower's, over the deck, from the deck)
	const rects = () => [{ x: 0, z: 0, hw: HALL.w / 2, hd: HALL.d / 2, bottom: -1e9, top: dims.Hm }, { x: tx, z: tz, hw: TOWER.s / 2, hd: TOWER.s / 2, bottom: dims.Hm - 0.4, top: dims.Ht }];
	// push a body (feet at footY) off the rock walls and the building's
	function push(p, footY) {
		for (const R of rocks) {
			if (!R.sdf || Math.abs(p.x - R.x) > R.sdf.S * 2 || Math.abs(p.z - R.z) > R.sdf.S * 2) continue;
			const [lx, ly, lz] = local(R, p.x, footY + 0.6, p.z), f = R.sdf.f;
			const d = f(lx, ly, lz);
			if (d > 0.4) continue;
			const e = 0.15, gx = f(lx + e, ly, lz) - f(lx - e, ly, lz), gz = f(lx, ly, lz + e) - f(lx, ly, lz - e), gl = Math.hypot(gx, gz) || 1;
			const m = 0.4 - d, c = Math.cos(R.yaw), s = Math.sin(R.yaw), wx = gx / gl * m, wz = gz / gl * m;
			p.x += wx * c - wz * s; p.z += wx * s + wz * c;
		}
		if (!summitPlaced || Math.abs(p.x - summit.position.x) + Math.abs(p.z - summit.position.z) > 40) return;
		let [lx, lz] = hallAt(p.x, p.z);
		const y = footY - dims.gc, r0 = lx, s0 = lz;
		for (const r of rects()) {
			if (y > r.top - 0.4 || y < r.bottom) continue;
			const qx = lx - r.x, qz = lz - r.z, ex = r.hw + 0.35 - Math.abs(qx), ez = r.hd + 0.35 - Math.abs(qz);
			if (ex <= 0 || ez <= 0) continue;
			if (ex < ez) lx += (qx < 0 ? -1 : 1) * ex; else lz += (qz < 0 ? -1 : 1) * ez;
		}
		// on the deck, the parapet keeps you there
		if (y > dims.Hm - 0.4 && y < dims.Hm + 2 && Math.abs(lx) < HALL.w / 2 && Math.abs(lz) < HALL.d / 2) {
			lx = Math.max(-HALL.w / 2 + 0.8, Math.min(HALL.w / 2 - 0.8, lx)); lz = Math.max(-HALL.d / 2 + 0.8, Math.min(HALL.d / 2 - 0.8, lz));
		}
		p.x += ca * (lx - r0) - sa * (lz - s0); p.z += sa * (lx - r0) + ca * (lz - s0);
	}
	// a ledge to step up on (never a whole cliff at once), the deck and the tower's top
	function floor(x, z, footY) {
		let best = -1e9;
		for (const R of rocks) {
			if (!R.sdf || Math.abs(x - R.x) > R.sdf.S * 2 || Math.abs(z - R.z) > R.sdf.S * 2) continue;
			for (let y = footY + 0.55; y > footY - 1.5; y -= 0.12) {
				const [lx, ly, lz] = local(R, x, y, z);
				if (R.sdf.f(lx, ly, lz) < 0) { best = Math.max(best, y); break; }
			}
		}
		if (summitPlaced && Math.abs(x - summit.position.x) + Math.abs(z - summit.position.z) < 40) {
			const [lx, lz] = hallAt(x, z);
			for (const r of rects()) if (Math.abs(lx - r.x) < r.hw && Math.abs(lz - r.z) < r.hd && footY > dims.gc + r.top - 1.2) best = Math.max(best, dims.gc + r.top);
		}
		return best;
	}
	return { update, push, floor, group, rocks, setBeaconDay: (on) => { beaconDay = on ? 1 : 0; } };
}
