// Plants: palms along the coast, hardwood groves inland, banana and fern
// understory, shrubs and boulders. Each species is a few instanced parts that
// stream in around the player from a 64 m cell index. Everything sways with
// the wind and with the music's low end.

import * as THREE from 'three';
import { mulberry32, makeNoise, smoothstep, clamp } from '../noise.js';
import * as TX from './textures.js';

// ---------- geometry helpers ----------
class Builder {
	constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.s = []; this.i = []; }
	vert(p, n, uv, c, s) {
		this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(uv[0], uv[1]);
		this.c.push(c.r, c.g, c.b); this.s.push(s);
		return this.p.length / 3 - 1;
	}
	tri(a, b, c) { this.i.push(a, b, c); }
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
		g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.s, 1));
		g.setIndex(this.i);
		g.computeBoundingSphere();
		g.computeBoundingBox();
		return g;
	}
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

function tube(b, path, radii, sides, color, swayOf) {
	const rings = [];
	for (let k = 0; k < path.length; k++) {
		const p = path[k], next = path[Math.min(path.length - 1, k + 1)], prev = path[Math.max(0, k - 1)];
		const dir = next.clone().sub(prev).normalize();
		const side = Math.abs(dir.y) > 0.95 ? V(1, 0, 0) : dir.clone().cross(UP).normalize();
		const up2 = side.clone().cross(dir).normalize();
		const ring = [];
		for (let s = 0; s <= sides; s++) {
			const a = s / sides * Math.PI * 2, n = side.clone().multiplyScalar(Math.cos(a)).add(up2.clone().multiplyScalar(Math.sin(a)));
			const band = 0.86 + 0.14 * Math.sin(k * 2.7);
			ring.push(b.vert(p.clone().add(n.clone().multiplyScalar(radii[k])), n, [s / sides, k / (path.length - 1)], { r: color.r * band, g: color.g * band, b: color.b * band }, swayOf(k / (path.length - 1))));
		}
		rings.push(ring);
	}
	for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < sides; s++) {
		const a = rings[k][s], bb = rings[k][s + 1], c = rings[k + 1][s], d = rings[k + 1][s + 1];
		b.tri(a, c, bb); b.tri(bb, c, d);
	}
}
// a leaf strip along a curve: centre line with folded edges (a shallow V)
function strip(b, pts, widths, fold, color, tipColor, swayBase, swayTip, normalUp = 0.6) {
	const L = pts.length;
	let prevSide = null;
	const rows = [];
	for (let k = 0; k < L; k++) {
		const p = pts[k], dir = pts[Math.min(L - 1, k + 1)].clone().sub(pts[Math.max(0, k - 1)]).normalize();
		let side = dir.clone().cross(UP);
		if (side.lengthSq() < 1e-4) side = prevSide || V(1, 0, 0);
		side.normalize(); prevSide = side;
		const t = k / (L - 1), w = widths[k] / 2;
		const down = V(0, -fold * w, 0);
		const col = { r: color.r + (tipColor.r - color.r) * t, g: color.g + (tipColor.g - color.g) * t, b: color.b + (tipColor.b - color.b) * t };
		const n = UP.clone().multiplyScalar(normalUp).add(dir.clone().multiplyScalar(0.2)).normalize();
		const sw = swayBase + (swayTip - swayBase) * t;
		rows.push([
			b.vert(p.clone().add(side.clone().multiplyScalar(-w)).add(down), n, [t, 0], col, sw),
			b.vert(p.clone(), n, [t, 0.5], col, sw),
			b.vert(p.clone().add(side.clone().multiplyScalar(w)).add(down), n, [t, 1], col, sw),
		]);
	}
	for (let k = 0; k < L - 1; k++) for (let s = 0; s < 2; s++) {
		const a = rows[k][s], c = rows[k][s + 1], d = rows[k + 1][s], e = rows[k + 1][s + 1];
		b.tri(a, d, c); b.tri(c, d, e);
	}
}
function card(b, center, size, rnd, color, sway, outwardFrom) {
	const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3.1, rnd() * 6.3, rnd() * 3.1));
	const n = center.clone().sub(outwardFrom).normalize().multiplyScalar(0.75).add(V(0, 0.45, 0)).normalize();
	const c = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) => V(x * size, y * size, 0).applyQuaternion(q).add(center));
	const tone = 0.82 + rnd() * 0.36, col = { r: color.r * tone, g: color.g * tone, b: color.b * tone };
	const uvs = [[0, 0], [0.96, 0], [0.96, 0.96], [0, 0.96]];
	const ids = c.map((p, k) => b.vert(p, n, uvs[k], col, sway));
	b.tri(ids[0], ids[1], ids[2]); b.tri(ids[0], ids[2], ids[3]);
}

// ---------- species ----------
const BARK = new THREE.Color(0.62, 0.55, 0.47), PALM_BARK = new THREE.Color(0.86, 0.78, 0.66);

function palm(seed, far) {
	const r = mulberry32(seed), trunk = new Builder(), crown = new Builder();
	const H = 7.5 + r() * 3.5, lean = 1.2 + r() * 2.2, la = r() * Math.PI * 2;
	const path = [], radii = [];
	for (let k = 0; k <= 10; k++) {
		const t = k / 10;
		path.push(V(Math.cos(la) * lean * t * t, H * t, Math.sin(la) * lean * t * t));
		radii.push(0.24 - 0.09 * t + (k === 0 ? 0.08 : 0));
	}
	tube(trunk, far ? path.filter((_, k) => k % 2 === 0) : path, far ? radii.filter((_, k) => k % 2 === 0) : radii, far ? 4 : 6, PALM_BARK, (t) => t * t * 0.35);
	const top = path[10];
	const nF = (far ? 8 : 10) + Math.floor(r() * 3);
	for (let f = 0; f < nF; f++) {
		const a = f / nF * Math.PI * 2 + r() * 0.3, L = 3.8 + r() * 1.2, elev = 0.25 + r() * 0.55, droop = 0.2 + r() * 0.12;
		const dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		const segs = far ? 3 : 5;
		for (let k = 0; k <= segs; k++) {
			const s = k / segs, d = L * s;
			pts.push(top.clone().add(dir.clone().multiplyScalar(d * Math.cos(elev * 0.5))).add(V(0, Math.sin(elev) * d - droop * d * d, 0)));
			widths.push(1.25 * Math.sin(Math.min(1, s * 1.2 + 0.08) * Math.PI) + 0.08);
		}
		strip(crown, pts, widths, 0.55, { r: 0.42, g: 0.62, b: 0.24 }, { r: 0.72, g: 0.74, b: 0.36 }, 0.45, 1.0, 0.7);
	}
	return { parts: [trunk.geometry(), crown.geometry()], height: H };
}

function hardwood(seed, far) {
	const r = mulberry32(seed), trunk = new Builder(), crown = new Builder();
	const H = 8 + r() * 5, bend = r() * 1.5, ba = r() * 6.28;
	const path = [], radii = [];
	for (let k = 0; k <= 6; k++) {
		const t = k / 6;
		path.push(V(Math.cos(ba) * bend * t * t, H * 0.62 * t, Math.sin(ba) * bend * t * t));
		radii.push(0.34 - 0.14 * t + (k === 0 ? 0.12 : 0));
	}
	tube(trunk, path, radii, far ? 5 : 7, BARK, (t) => t * 0.15);
	const fork = path[6], crownC = fork.clone().add(V(0, H * 0.22, 0));
	const ends = [];
	const nB = far ? 0 : 3 + Math.floor(r() * 3);
	for (let i = 0; i < nB; i++) {
		const a = i / nB * 6.28 + r() * 0.8, len = 2.5 + r() * 2.2, rise = 1.6 + r() * 2.2;
		const e = fork.clone().add(V(Math.cos(a) * len, rise, Math.sin(a) * len));
		const mid = fork.clone().lerp(e, 0.5).add(V(0, 0.5, 0));
		tube(trunk, [fork.clone(), mid, e], [0.16, 0.1, 0.05], 5, BARK, (t) => 0.2 + t * 0.4);
		ends.push(e);
	}
	const RX = 3.6 + r() * 1.6, RY = 2.4 + r() * 0.9;
	const nC = far ? 22 : 62, size = far ? 3.6 : 2.6;
	for (let i = 0; i < nC; i++) {
		const th = r() * 6.28, ph = Math.acos(2 * r() - 1), k = 0.45 + r() * 0.55;
		const c = crownC.clone().add(V(Math.sin(ph) * Math.cos(th) * RX * k, Math.cos(ph) * RY * k, Math.sin(ph) * Math.sin(th) * RX * k));
		card(crown, c, size * (0.8 + r() * 0.5), r, { r: 0.34, g: 0.50, b: 0.20 }, 0.7 + 0.3 * k, crownC);
	}
	for (const e of ends) for (let i = 0; i < 7; i++) {
		card(crown, e.clone().add(V((r() - 0.5) * 2.4, (r() - 0.2) * 1.4, (r() - 0.5) * 2.4)), size * 0.9, r, { r: 0.36, g: 0.52, b: 0.21 }, 0.95, crownC);
	}
	return { parts: [trunk.geometry(), crown.geometry()], height: H };
}

function banana(seed) {
	const r = mulberry32(seed), stem = new Builder(), leaves = new Builder();
	const H = 1.5 + r() * 0.8;
	tube(stem, [V(0, 0, 0), V(0, H * 0.5, 0), V(0, H, 0)], [0.14, 0.12, 0.09], 6, new THREE.Color(0.42, 0.50, 0.26), (t) => t * 0.3);
	const nL = 6 + Math.floor(r() * 3);
	for (let l = 0; l < nL; l++) {
		const a = l / nL * 6.28 + r() * 0.5, L = 1.7 + r() * 0.8, rise = 0.9 + r() * 0.5;
		const dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 6; k++) {
			const s = k / 6, d = L * s;
			pts.push(V(0, H, 0).add(dir.clone().multiplyScalar(d * 0.9)).add(V(0, Math.sin(s * 2.2) * rise * 0.6 - s * s * 0.9, 0)));
			widths.push(0.62 * Math.sin(Math.min(1, s + 0.12) * Math.PI) + 0.05);
		}
		strip(leaves, pts, widths, 0.25, { r: 0.55, g: 0.72, b: 0.32 }, { r: 0.62, g: 0.78, b: 0.36 }, 0.3, 1.0, 0.8);
	}
	return { parts: [stem.geometry(), leaves.geometry()], height: H + 1 };
}

function fern(seed) {
	const r = mulberry32(seed), b = new Builder();
	const nF = 8 + Math.floor(r() * 4);
	for (let f = 0; f < nF; f++) {
		const a = f / nF * 6.28 + r() * 0.4, L = 0.8 + r() * 0.5, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 4; k++) {
			const s = k / 4, d = L * s;
			pts.push(dir.clone().multiplyScalar(d).add(V(0, Math.sin(s * 2.4) * L * 0.55, 0)));
			widths.push(0.36 * (1 - s * 0.7));
		}
		strip(b, pts, widths, 0.1, { r: 0.42, g: 0.60, b: 0.24 }, { r: 0.5, g: 0.66, b: 0.28 }, 0.2, 1.0, 0.8);
	}
	return { parts: [b.geometry()], height: 0.9 };
}

function shrub(seed) {
	const r = mulberry32(seed), b = new Builder(), c0 = V(0, 0.55, 0);
	for (let i = 0; i < 22; i++) {
		const th = r() * 6.28, ph = Math.acos(r()), k = 0.5 + r() * 0.5;
		card(b, c0.clone().add(V(Math.sin(ph) * Math.cos(th) * 1.1 * k, Math.cos(ph) * 0.7 * k, Math.sin(ph) * Math.sin(th) * 1.1 * k)), 1.1, r, { r: 0.32, g: 0.46, b: 0.2 }, 0.6, V(0, 0, 0));
	}
	return { parts: [b.geometry()], height: 1.3 };
}

function boulder(seed) {
	const r = mulberry32(seed), g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
	const nz = makeNoise(seed);
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		const k = 0.75 + nz.fbm(x * 1.3 + 3, z * 1.3 + y, 3) * 0.55;
		p.setXYZ(i, x * k * 1.2, y * k * 0.75, z * k);
	}
	g.computeVertexNormals();
	const col = [];
	for (let i = 0; i < p.count; i++) { const t = 0.8 + r() * 0.3; col.push(0.45 * t, 0.43 * t, 0.39 * t); }
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
	g.computeBoundingBox();
	return { parts: [g], height: 1 };
}

// ---------- ground debris ----------
function blob(b, c, r, sy, color) {
	// a low-poly ellipsoid
	const rows = 5, cols = 8, ids = [];
	for (let j = 0; j <= rows; j++) {
		const ph = j / rows * Math.PI, row = [];
		for (let i = 0; i <= cols; i++) {
			const th = i / cols * Math.PI * 2, n = V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
			row.push(b.vert(c.clone().add(V(n.x * r, n.y * r * sy, n.z * r)), n, [i / cols, j / rows], color, 0));
		}
		ids.push(row);
	}
	for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { b.tri(ids[j][i], ids[j + 1][i], ids[j][i + 1]); b.tri(ids[j][i + 1], ids[j + 1][i], ids[j + 1][i + 1]); }
}
function coconuts(seed) {
	const r = mulberry32(seed), b = new Builder(), n = 2 + Math.floor(r() * 3);
	for (let i = 0; i < n; i++) {
		const a = r() * 6.28, d = 0.2 + r() * 0.5, ripe = r();
		const col = ripe < 0.4 ? { r: 0.42, g: 0.30, b: 0.18 } : ripe < 0.75 ? { r: 0.55, g: 0.42, b: 0.24 } : { r: 0.46, g: 0.52, b: 0.22 };
		blob(b, V(Math.cos(a) * d, 0.14, Math.sin(a) * d), 0.14 + r() * 0.03, 0.88, col);
	}
	return { parts: [b.geometry()], height: 0.3 };
}
function deadFrond(seed) {
	const r = mulberry32(seed), b = new Builder();
	const a = r() * 6.28, L = 3.2 + r() * 1.2, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
	for (let k = 0; k <= 5; k++) {
		const s = k / 5;
		pts.push(dir.clone().multiplyScalar(L * s).add(V(0, 0.06 + Math.sin(s * 3.1) * 0.12, 0)));
		widths.push(1.1 * Math.sin(Math.min(1, s * 1.2 + 0.08) * Math.PI) + 0.08);
	}
	strip(b, pts, widths, -0.35, { r: 0.60, g: 0.47, b: 0.30 }, { r: 0.72, g: 0.60, b: 0.40 }, 0, 0.05, 0.9);
	// lying face up: flip the winding so the lit side is the top
	for (let i = 0; i < b.i.length; i += 3) { const t = b.i[i + 1]; b.i[i + 1] = b.i[i + 2]; b.i[i + 2] = t; }
	return { parts: [b.geometry()], height: 0.3 };
}
function driftwood(seed) {
	const r = mulberry32(seed), b = new Builder(), L = 2.5 + r() * 3, bend = (r() - 0.5) * 0.8;
	const path = [], radii = [];
	for (let k = 0; k <= 6; k++) { const t = k / 6; path.push(V(L * (t - 0.5), 0.12 + Math.sin(t * 3.1) * 0.05, Math.sin(t * 3.1) * bend)); radii.push((0.16 - 0.07 * t) * (0.8 + r() * 0.3)); }
	tube(b, path, radii, 6, new THREE.Color(0.78, 0.74, 0.68), () => 0);
	const s0 = path[2];
	tube(b, [s0, s0.clone().add(V(0.3, 0.25, 0.4)), s0.clone().add(V(0.5, 0.45, 0.9))], [0.07, 0.05, 0.03], 5, new THREE.Color(0.8, 0.76, 0.7), () => 0);
	return { parts: [b.geometry()], height: 0.4 };
}

// ---------- materials ----------
function swayMaterial(params, shared, stiff) {
	const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0 }, params));
	const hook = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uWind = shared.uWind; sh.uniforms.uBass = shared.uBass;
		sh.vertexShader = 'attribute float aSway; uniform float uTime, uWind, uBass;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
			#include <begin_vertex>
			#ifdef USE_INSTANCING
			vec3 ip = vec3(instanceMatrix[3]);
			#else
			vec3 ip = vec3(0.0);
			#endif
			float ph = ip.x * 0.21 + ip.z * 0.17;
			float sw = aSway * aSway * ${stiff.toFixed(2)};
			float push = 0.10 + uWind * 0.22 + uBass * 0.45;
			transformed.x += (sin(uTime * 1.25 + ph) * push + sin(uTime * 3.9 + ph * 2.0 + position.y * 1.7) * 0.05) * sw;
			transformed.z += (cos(uTime * 1.05 + ph) * push * 0.7 + cos(uTime * 4.3 + position.x * 1.3) * 0.04) * sw;`);
	};
	m.onBeforeCompile = hook;
	m.customProgramCacheKey = () => 'sway' + stiff + (params.map ? 'm' : '');
	let depth = null;
	if (params.alphaTest) {
		depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: params.map, alphaTest: params.alphaTest });
		depth.onBeforeCompile = hook;
		depth.customProgramCacheKey = () => 'swaydepth' + stiff;
	}
	return { material: m, depth };
}

// ---------- placement and streaming ----------
const CELL = 64;

export function createVegetation(island, shared, scene) {
	const tex = { leaf: TX.leafCluster(), frond: TX.palmFrond(), banana: TX.bananaLeaf(), fern: TX.fernFrond(), palmBark: TX.palmBark(), woodBark: TX.woodBark() };
	tex.palmBark.repeat.set(1, 7);
	tex.woodBark.repeat.set(2, 3);
	const mats = {
		bark: swayMaterial({ map: tex.woodBark, roughness: 0.95 }, shared, 1),
		palmbark: swayMaterial({ map: tex.palmBark, roughness: 0.9 }, shared, 1),
		stem: swayMaterial({ roughness: 0.8 }, shared, 1),
		frond: swayMaterial({ map: tex.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }, shared, 1),
		leaf: swayMaterial({ map: tex.leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82 }, shared, 0.8),
		banana: swayMaterial({ map: tex.banana, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }, shared, 1.2),
		fern: swayMaterial({ map: tex.fern, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }, shared, 1.2),
		stone: { material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: false }), depth: null },
	};
	const nz = makeNoise(island.seed + 101);
	const species = [
		{ key: 'palm', variants: [0, 1, 2].map((v) => palm(island.seed * 7 + v, false)), far: [0, 1, 2].map((v) => palm(island.seed * 7 + v, true)), mats: ['palmbark', 'frond'], spacing: 10, near: 140, farR: 460, max: 700, kind: 'wood',
			accept: (x, z, h, sl, m) => h > 0.7 && h < 12 && sl < 0.45 && m.path < 0.2 && (island.shapeAt(x, z) > 0.84 || m.village > 0.3) && nz.fbm(x * 0.012, z * 0.012, 3) > 0.47 },
		{ key: 'hardwood', variants: [0, 1, 2].map((v) => hardwood(island.seed * 11 + v, false)), far: [0, 1].map((v) => hardwood(island.seed * 11 + v, true)), mats: ['bark', 'leaf'], spacing: 9, near: 130, farR: 1050, max: 1800, kind: 'wood',
			accept: (x, z, h, sl, m) => h > 4 && h < island.peak.h * 0.85 && sl < 0.62 && m.path < 0.15 && m.village < 0.2 && m.wild > 0.3 && island.shapeAt(x, z) < 0.86 && nz.fbm(x * 0.006 + 9, z * 0.006, 3) > 0.4 },
		{ key: 'banana', variants: [0, 1].map((v) => banana(island.seed * 13 + v)), mats: ['stem', 'banana'], spacing: 5.5, near: 90, max: 500, kind: 'soft',
			accept: (x, z, h, sl, m) => h > 2.2 && h < 60 && sl < 0.45 && m.path < 0.2 && m.wild > 0.25 && nz.fbm(x * 0.02 + 4, z * 0.02, 3) > 0.54 },
		{ key: 'fern', variants: [0, 1].map((v) => fern(island.seed * 17 + v)), mats: ['fern'], spacing: 3.4, near: 50, max: 700, kind: 'soft', noShadow: true,
			accept: (x, z, h, sl, m) => h > 2.6 && sl < 0.6 && m.path < 0.15 && m.wild > 0.35 && nz.fbm(x * 0.05, z * 0.05 + 2, 2) > 0.52 },
		{ key: 'shrub', variants: [0].map((v) => shrub(island.seed * 19 + v)), mats: ['leaf'], spacing: 6, near: 120, max: 500, kind: 'soft',
			accept: (x, z, h, sl, m) => h > 1.8 && sl < 0.55 && m.path < 0.2 && m.wild > 0.15 && nz.fbm(x * 0.03 + 7, z * 0.03, 2) > 0.5 },
		{ key: 'nuts', derived: true, variants: [0, 1, 2].map((v) => coconuts(island.seed * 29 + v)), mats: ['stem'], near: 60, max: 300, kind: 'wood', noShadow: true },
		{ key: 'deadfrond', derived: true, variants: [0, 1].map((v) => deadFrond(island.seed * 31 + v)), mats: ['frond'], near: 80, max: 400, kind: 'soft', noShadow: true },
		{ key: 'driftwood', variants: [0, 1, 2].map((v) => driftwood(island.seed * 37 + v)), mats: ['bark'], spacing: 9, near: 110, max: 200, kind: 'wood',
			accept: (x, z, h, sl, m) => h > 0.35 && h < 1.3 && m.village < 0.2 && m.path < 0.2 && nz.fbm(x * 0.03 + 5, z * 0.03, 2) > 0.62 },
		{ key: 'boulder', variants: [0, 1].map((v) => boulder(island.seed * 23 + v)), mats: ['stone'], spacing: 12, near: 320, max: 400, kind: 'stone',
			accept: (x, z, h, sl, m) => h > 0.2 && sl > 0.28 && m.path < 0.3 && nz.fbm(x * 0.02 + 1, z * 0.02, 2) > 0.45 },
	];
	const SHADOW_R = 55;

	// scatter once into cells
	const cells = new Map();
	const rnd = mulberry32(island.seed ^ 0xabc);
	const reach = island.R * 1.2;
	const derived = (key, px, pz, off) => {
		const sp = species.find((q) => q.key === key), h = island.heightAt(px, pz);
		if (h < 0.3 || island.maskAt(px, pz, 0) > 0.3) return;
		const ck = Math.floor(px / CELL) + ',' + Math.floor(pz / CELL);
		let c = cells.get(ck);
		if (!c) cells.set(ck, c = { x: Math.floor(px / CELL), z: Math.floor(pz / CELL), items: {} });
		(c.items[key] || (c.items[key] = [])).push({ x: px, y: h - off, z: pz, rot: rnd() * 6.283, scale: 0.85 + rnd() * 0.3, v: Math.floor(rnd() * sp.variants.length), tint: 0.8 + rnd() * 0.35 });
	};
	for (const sp of species) {
		if (sp.derived) continue;
		const s = sp.spacing;
		for (let z = -reach; z < reach; z += s) for (let x = -reach; x < reach; x += s) {
			const px = x + (rnd() - 0.5) * s * 0.9, pz = z + (rnd() - 0.5) * s * 0.9;
			const h = island.heightAt(px, pz);
			if (h < 0.2) continue;
			const n = island.normalAt(px, pz), sl = 1 - n.y;
			const m = { path: island.maskAt(px, pz, 0), village: island.maskAt(px, pz, 1), wild: island.maskAt(px, pz, 3) };
			if (!sp.accept(px, pz, h, sl, m)) continue;
			const key = Math.floor(px / CELL) + ',' + Math.floor(pz / CELL);
			let c = cells.get(key);
			if (!c) cells.set(key, c = { x: Math.floor(px / CELL), z: Math.floor(pz / CELL), items: {} });
			(c.items[sp.key] || (c.items[sp.key] = [])).push({
				x: px, y: h - (sp.key === 'boulder' ? 0.35 : 0.05), z: pz, rot: rnd() * 6.283, scale: sp.key === 'boulder' ? 0.6 + rnd() * 1.6 : 0.8 + rnd() * 0.45,
				v: Math.floor(rnd() * sp.variants.length), tint: 0.85 + rnd() * 0.3,
			});
			// palms drop their nuts and old fronds around the base
			if (sp.key === 'palm') {
				if (rnd() < 0.55) derived('nuts', px + (rnd() - 0.5) * 2.5, pz + (rnd() - 0.5) * 2.5, 0.04);
				if (rnd() < 0.6) derived('deadfrond', px + (rnd() - 0.5) * 3, pz + (rnd() - 0.5) * 3, 0.02);
			}
		}
	}

	// instanced meshes per species / variant / part / lod
	const group = new THREE.Group();
	group.name = 'vegetation';
	const pickables = [];
	for (const sp of species) {
		sp.meshes = [];
		const lods = [['close', sp.variants], ['near', sp.variants]];
		if (sp.far) lods.push(['far', sp.far]);
		for (const [lod, variants] of lods) {
			variants.forEach((vdef, vi) => {
				vdef.parts.forEach((geo, pi) => {
					const mm = mats[sp.mats[pi]];
					const cap = lod === 'close' ? Math.min(sp.max, 160) : sp.max;
					const im = new THREE.InstancedMesh(geo, mm.material, cap);
					im.count = 0;
					im.castShadow = lod === 'close' && !sp.noShadow;
					im.receiveShadow = lod !== 'far';
					if (mm.depth) im.customDepthMaterial = mm.depth;
					im.frustumCulled = false;
					im.userData.material175 = sp.kind;
					im.userData.species = sp.key;
					im.userData.cap = cap;
					im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
					group.add(im);
					sp.meshes.push({ im, lod, vi });
					if (lod !== 'far') pickables.push(im);
				});
			});
		}
	}
	scene.add(group);

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
	let lastX = 1e9, lastZ = 1e9;
	function stream(cam, force) {
		const cx = cam.position.x, cz = cam.position.z;
		if (!force && Math.hypot(cx - lastX, cz - lastZ) < 6) return;
		lastX = cx; lastZ = cz;
		for (const sp of species) for (const m of sp.meshes) m.im.count = 0;
		for (const sp of species) {
			const R = sp.farR || sp.near, cr = Math.ceil(R / CELL);
			const ci = Math.floor(cx / CELL), cj = Math.floor(cz / CELL);
			const lim = sp.max;
			for (let j = cj - cr; j <= cj + cr; j++) for (let i = ci - cr; i <= ci + cr; i++) {
				const c = cells.get(i + ',' + j);
				if (!c || !c.items[sp.key]) continue;
				for (const it of c.items[sp.key]) {
					const d = Math.hypot(it.x - cx, it.z - cz);
					const lod = d < SHADOW_R ? 'close' : d < sp.near ? 'near' : (sp.far && d < R ? 'far' : null);
					if (!lod) continue;
					q.setFromAxisAngle(UP, it.rot);
					sc.setScalar(it.scale);
					pos.set(it.x, it.y, it.z);
					m4.compose(pos, q, sc);
					col.setScalar(it.tint);
					const vi = lod === 'far' ? it.v % sp.far.length : it.v;
					for (const m of sp.meshes) {
						if (m.lod !== lod || m.vi !== vi || m.im.count >= m.im.userData.cap) continue;
						m.im.setMatrixAt(m.im.count, m4);
						m.im.setColorAt(m.im.count, col);
						m.im.count++;
					}
				}
			}
		}
		for (const sp of species) for (const m of sp.meshes) {
			m.im.instanceMatrix.needsUpdate = true;
			if (m.im.instanceColor) m.im.instanceColor.needsUpdate = true;
			m.im.computeBoundingSphere();
		}
	}
	// solid trunks and boulders the walker bumps into
	function obstacles(x, z, r) {
		const out = [];
		const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
		for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
			const c = cells.get(i + ',' + j);
			if (!c) continue;
			for (const k of ['palm', 'hardwood', 'boulder']) for (const it of c.items[k] || []) {
				const rad = k === 'boulder' ? it.scale * 1.0 : 0.35 * it.scale;
				if (Math.hypot(it.x - x, it.z - z) < r + rad + 1) out.push({ x: it.x, z: it.z, r: rad });
			}
		}
		return out;
	}
	return { group, stream, pickables, obstacles, species, cells };
}
