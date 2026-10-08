// The gear catalogue's items as crafted models (gameplay/arms.js ids), for the hand: yours (in
// view, crysis/viewmodel.js, or in your hands in third person), your friends', and the gear
// screen's turning preview.
//
// Every item is one mesh with one shared material: its parts are merged, and each part carries
// its own colour, roughness, metalness, surface pattern, edge wear and glow in its vertices. The
// patterns (brushed metal, stippled grips, carbon weave, damascus, camo, knurling...) are tiles
// of one small atlas drawn once; the shader picks the tile, adds a little relief from it and
// rubs the paint off sharp edges. A sight's glass is the one extra part with its own material.
//
// Quality shows on every item as a premium finish: Common is a plain field finish, Fine an
// anodised green, Superior carbon and blue, Masterwork damascus and violet, Legendary gold with
// an oil-slick sheen. From level 4 an inlay line in the tier's colour, from level 7 the item's
// energy cell glows, and Legendary gear sheds a few motes of light.
//
// The rifles are fictional near-future trail and guard tools: exterior shapes only, no real
// make, no working parts, nothing to build from.
//
// Item space: x forward (the muzzle), y up, z to the item's right; the right hand's grip at the
// origin. HOLDS says where each hand closes on an item; handFrame() reads a hand off a body.
// lod 'low' (third person, friends, phones) drops the small parts and halves the segments.

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TIERS } from '../gameplay/gear-levels.js';
import { createFlash } from './weapon-fx.js';
import { playCue } from './weapon-sound.js';

// an icon for each item, for lists and slots
export const ITEM_ICONS = {
	'aurora-trail-rifle': '🎯', 'mossback-scout-rifle': '🌲', 'warden-spark-carbine': '🛡️', 'reedline-hunting-bow': '🏹',
	'hunting-net': '🥅', 'trail-scent-kit': '🌿', 'door-brace': '🚪', 'lantern-alarm': '🔔', 'field-medkit': '🩹',
	'camp-lantern': '🏮', 'repair-roll': '🧰', 'station-signal-flare': '🎆',
};
export const iconOf = (id) => ITEM_ICONS[id] || '📦';

// ---------- the surface atlas: 16 seamless tiles of 128 px; rgb a tint about mid grey (doubled
// in the shader), alpha the height the relief is read from ----------
const T = { plain: 0, brushed: 1, stipple: 2, wood: 3, leather: 4, webbing: 5, carbon: 6, damascus: 7, camo: 8, knurl: 9, hex: 10, speckle: 11, film: 12, canvas: 13, ribs: 14, glass: 15 };
// how many tiles to the metre, per pattern
const DENS = [8, 10, 26, 3, 14, 28, 12, 7, 2.5, 40, 14, 18, 3, 12, 30, 4];
const fract = (x) => x - Math.floor(x);
function hash(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// value noise that repeats every px by py cells, so a tile meets itself
function vnoise(x, y, px, py, s) {
	const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
	const m = (a, p) => ((a % p) + p) % p, x0 = m(xi, px), x1 = m(xi + 1, px), y0 = m(yi, py), y1 = m(yi + 1, py);
	const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
	return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(u, v, px, py, s, oct = 4) { let t = 0, a = 0.5, f = 1; for (let k = 0; k < oct; k++) { t += a * vnoise(u * px * f, v * py * f, px * f, py * f, s + k); a *= 0.5; f *= 2; } return t / (1 - Math.pow(0.5, oct)); }
// the nearest of a jittered grid of points, for pebbles and stipple
function cells(u, v, n, s) {
	let best = 9;
	const cx = Math.floor(u * n), cy = Math.floor(v * n);
	for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
		const gx = cx + i, gy = cy + j, wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n;
		const d = Math.hypot(u * n - (gx + hash(wx, wy, s)), v * n - (gy + hash(wx, wy, s + 9)));
		if (d < best) best = d;
	}
	return best;
}
const TILES = [
	(u, v) => [0.5 + (fbm(u, v, 8, 8, 1) - 0.5) * 0.05, 0.5],
	(u, v) => { const n = fbm(u, v, 3, 90, 2, 3); return [0.5 + (n - 0.5) * 0.16, 0.5 + (n - 0.5) * 0.12]; },
	(u, v) => { const d = cells(u, v, 18, 3), b = Math.max(0, 1 - d * 2.4); return [0.5 - b * 0.07 + (hash(u * 128, v * 128, 4) - 0.5) * 0.03, 0.42 + b * 0.5]; },
	(u, v) => { const w = Math.sin((u * 5 + fbm(u, v, 2, 6, 5) * 1.6) * Math.PI * 2 * 3), s = fbm(u, v, 40, 2, 6, 2); return [0.5 + w * 0.07 + (s - 0.5) * 0.1, 0.5 + w * 0.06]; },
	(u, v) => { const d = cells(u, v, 22, 7), e = Math.min(1, d * 1.6); return [0.44 + e * 0.1 + (fbm(u, v, 6, 6, 8) - 0.5) * 0.08, 0.3 + e * 0.5]; },
	(u, v) => { const a = Math.sin(v * Math.PI * 2 * 24), b = Math.sin(u * Math.PI * 2 * 64 + (a > 0 ? 0 : Math.PI)); return [0.5 + a * 0.05 + b * 0.025, 0.5 + a * 0.2 + b * 0.08]; },
	(u, v) => {
		const n = 16, cx = Math.floor(u * n), cy = Math.floor(v * n), fx = fract(u * n), fy = fract(v * n), dir = ((cx + cy) & 3) < 2;
		const sheen = dir ? Math.sin(fy * Math.PI) : Math.sin(fx * Math.PI);
		return [(dir ? 0.4 : 0.6) + sheen * 0.08, 0.5 + (dir ? 0.06 : -0.06) + sheen * 0.08];
	},
	(u, v) => { const w = v + 0.07 * Math.sin(u * Math.PI * 4 + 3 * Math.sin(v * Math.PI * 2)) + 0.05 * fbm(u, v, 3, 3, 9); const s = Math.sin(w * Math.PI * 2 * 11 + 1.5 * Math.sin(u * Math.PI * 6)); return [0.5 + s * 0.15, 0.5 + s * 0.05]; },
	(u, v) => { const a = fbm(u, v, 4, 4, 10), b = fbm(u, v, 5, 5, 20); return [a > 0.56 ? 0.3 : b > 0.57 ? 0.7 : 0.5, 0.5]; },
	(u, v) => { const tri = (x) => Math.abs(fract(x) - 0.5) * 2, r = Math.min(tri(u * 24 + v * 24), tri(u * 24 - v * 24)); return [0.42 + r * 0.14, 0.2 + r * 0.7]; },
	(u, v) => {
		// a hex grid's lines
		const s = 8, x = u * s, y = v * s * 2 / Math.sqrt(3) * 0.5 * 2;
		const q = [x - Math.floor(x), y - Math.floor(y)], e = Math.min(Math.abs(q[0] - 0.5) * 2, Math.abs(Math.abs(q[0] - 0.5) * 1 + Math.abs(q[1] - 0.5) * 1.732) * 1.2);
		const line = 1 - Math.min(1, Math.abs(1 - e) * 10);
		return [0.52 - line * 0.14, 0.55 - line * 0.35];
	},
	(u, v) => { const g = hash(Math.floor(u * 64), Math.floor(v * 64), 11); return [0.5 + (g - 0.5) * 0.1, 0.5 + (g - 0.5) * 0.16]; },
	(u, v) => [0.5 + (fbm(u, v, 3, 3, 12) - 0.5) * 0.4, 0.5],
	(u, v) => { const a = Math.sin(u * Math.PI * 2 * 16), b = Math.sin(v * Math.PI * 2 * 16); return [0.5 + a * b * 0.05 + (fbm(u, v, 8, 8, 13) - 0.5) * 0.08, 0.5 + a * b * 0.2]; },
	(u, v) => { const r = Math.abs(Math.sin(v * Math.PI * 16)); return [0.48 + r * 0.05, 0.25 + r * 0.6]; },
	() => [0.5, 0.5],
];
let atlas = null;
function atlasTex() {
	if (atlas) return atlas;
	const N = 128, c = document.createElement('canvas');
	c.width = c.height = N * 4;
	const g = c.getContext('2d'), img = g.createImageData(N * 4, N * 4), d = img.data;
	for (let k = 0; k < 16; k++) {
		const ox = (k & 3) * N, oy = (k >> 2) * N;
		for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
			const [m, h] = TILES[k](x / N, y / N), o = ((oy + y) * N * 4 + ox + x) * 4, q = Math.max(0, Math.min(255, m * 255));
			d[o] = d[o + 1] = d[o + 2] = q; d[o + 3] = Math.max(128, Math.min(255, 128 + h * 127));
		}
	}
	g.putImageData(img, 0, 0);
	atlas = new THREE.CanvasTexture(c);
	atlas.premultiplyAlpha = false; atlas.flipY = false; atlas.anisotropy = 4;
	return atlas;
}

// ---------- the one material: vertex colour, and surf = (roughness, metalness, tile + wear / 2,
// glow) ----------
const kitTime = { value: 0 }, kitFire = { value: 0 };
const kits = {};
// plain: without the world's reflections (the gear screen's own little renderer)
export function kitMaterial(plain = false) {
	const key = plain ? 'plain' : 'lit';
	if (kits[key]) return kits[key];
	const kit = kits[key] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
	kit.onBeforeCompile = (sh) => {
		sh.uniforms.kAtlas = { value: atlasTex() };
		sh.uniforms.kTime = kitTime; sh.uniforms.kFire = kitFire;
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 surf;\nvarying vec4 vSurf;\nvarying vec2 vKuv;')
			.replace('#include <uv_vertex>', '#include <uv_vertex>\nvSurf = surf; vKuv = uv;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D kAtlas;
uniform float kTime;
uniform float kFire;
varying vec4 vSurf;
varying vec2 vKuv;
vec3 kBump(vec3 p, vec3 n, vec2 dh, float fd) {
	vec3 sx = normalize(dFdx(p)), sy = normalize(dFdy(p)), r1 = cross(sy, n), r2 = cross(n, sx);
	float det = dot(sx, r1) * fd;
	return normalize(abs(det) * n - sign(det) * (dh.x * r1 + dh.y * r2));
}`)
			.replace('#include <color_fragment>', `#include <color_fragment>
	float kTile = floor(vSurf.z), kWear = fract(vSurf.z) * 2.0;
	vec2 kCell = vec2(mod(kTile, 4.0), floor(kTile / 4.0));
	vec4 kTx = textureGrad(kAtlas, (kCell + 0.03 + fract(vKuv) * 0.94) * 0.25, dFdx(vKuv) * 0.235, dFdy(vKuv) * 0.235);
	diffuseColor.rgb *= kTx.rgb * 2.0;
	vec3 kN = normalize(vNormal);
	float kCurv = length(fwidth(kN)) / max(length(fwidth(vViewPosition)), 1e-5);
	float kEdge = kWear * smoothstep(110.0, 360.0, kCurv) * smoothstep(0.3, 0.7, kTx.a + 0.2);
	if (abs(kTile - 12.0) < 0.5) {
		float ndv = abs(dot(kN, normalize(vViewPosition)));
		vec3 film = 0.5 + 0.5 * cos(6.2832 * (ndv * 1.4 + kTx.r * 1.2 + vec3(0.0, 0.33, 0.67)));
		diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * film * 1.7, 0.65);
	}
	diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.62, 0.6), kEdge);`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix(vSurf.x * (0.85 + (kTx.a - 0.5) * 0.5), 0.32, kEdge);')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = mix(vSurf.y, 1.0, kEdge);')
			.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n\tnormal = kBump(-vViewPosition, normal, vec2(dFdx(kTx.a), dFdy(kTx.a)) * 1.6, faceDirection);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb * vSurf.w * (0.88 + 0.12 * sin(kTime * 2.4 + vViewPosition.x * 9.0) + kFire * 2.5);');
	};
	kit.customProgramCacheKey = () => 'kit1';
	return kit;
}
// the sight's glass: tinted, glinting, its reticle lit (one per reticle colour)
const lensMats = {};
function lensMaterial(hex, plain = false, dot = false) {
	const key = `${hex}:${dot}:${plain}`;
	if (lensMats[key]) return lensMats[key];
	if (hex == null) return (lensMats[key] = new THREE.MeshStandardMaterial({ color: 0x0d2a36, roughness: 0.03, metalness: 0.4, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
	// a scope's fine crosshair with heavier posts, or a reflex sight's dot
	const c = document.createElement('canvas'); c.width = c.height = 128;
	const g = c.getContext('2d');
	g.strokeStyle = g.fillStyle = '#fff';
	if (dot) { g.beginPath(); g.arc(64, 64, 2.2, 0, Math.PI * 2); g.fill(); g.lineWidth = 0.8; g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.stroke(); }
	else {
		g.lineWidth = 0.7; g.beginPath(); g.moveTo(14, 64); g.lineTo(114, 64); g.moveTo(64, 14); g.lineTo(64, 114); g.stroke();
		g.lineWidth = 3; for (const [x, y] of [[0, 1], [-1, 0], [1, 0]]) { g.beginPath(); g.moveTo(64 + x * 30, 64 + y * 30); g.lineTo(64 + x * 62, 64 + y * 62); g.stroke(); }
		g.beginPath(); g.arc(64, 64, 1.6, 0, Math.PI * 2); g.fill();
	}
	const tex = new THREE.CanvasTexture(c);
	const m = new THREE.MeshStandardMaterial({ color: 0x0d2a36, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, emissive: hex, emissiveIntensity: 2.4, emissiveMap: tex });
	m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.a = max(gl_FragColor.a, texture2D(emissiveMap, vEmissiveMapUv).g * 0.95);'); };
	return (lensMats[key] = m);
}
// the world's light on held things: reflections fade with the daylight (crysis/viewmodel.js)
export function kitLight(envMap, k) {
	const m = kitMaterial(), lit = Object.entries(lensMats).filter(([key]) => key.endsWith('false')).map(([, l]) => l);
	for (const x of [m, ...lit]) { if (envMap && x.envMap !== envMap) { x.envMap = envMap; x.needsUpdate = true; } x.envMapIntensity = x === m ? k : k * 1.5; }
}
export const kitTick = (t) => { kitTime.value = t; };
// the glow surging as an item is used (decays on its own in the hand's and the view's frames)
export const kitPulse = (k) => { kitFire.value = Math.max(0, k); };
export const kitPulseNow = () => kitFire.value;

// ---------- building: parts, each with a surface, merged into one geometry ----------
// a surface: colour, roughness, metalness, pattern, and how much its edges wear and it glows
const S = (c, r, m, tile = T.plain, o = {}) => ({ c: new THREE.Color(c), r, m, tile, wear: o.wear || 0, glow: o.glow || 0, dens: o.dens || DENS[tile] });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
class Kit {
	constructor(hi) { this.hi = hi; this.body = this.parts = []; this.cellParts = []; this.cellAt = null; this.lens = []; }
	// what follows goes into the swappable cell (its own mesh, for the reload), anchored at x, y
	cell(x, y) { this.cellAt = [x, y, 0]; this.parts = this.cellParts; }
	main() { this.parts = this.body; }
	// a geometry with a surface, placed at x, y, z turned rx, ry, rz (and scaled)
	add(geo, s, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sc = null) {
		_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), sc ? _s.set(...sc) : _s.set(1, 1, 1));
		for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
		let g = toCreasedNormals(geo, 0.9);
		geo.dispose();
		g.applyMatrix4(_m);
		const pos = g.attributes.position, nv = pos.count, uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), surf = new Float32Array(nv * 4);
		const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
		for (let i = 0; i < nv; i += 3) {
			a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
			const n = b.sub(a).cross(c.sub(a)), ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
			for (let j = i; j < i + 3; j++) {
				const px = pos.getX(j), py = pos.getY(j), pz = pos.getZ(j);
				const [u, v] = ax >= ay && ax >= az ? [pz, py] : ay >= az ? [px, pz] : [px, py];
				uv[j * 2] = u * s.dens; uv[j * 2 + 1] = v * s.dens;
			}
		}
		for (let j = 0; j < nv; j++) { col[j * 3] = s.c.r; col[j * 3 + 1] = s.c.g; col[j * 3 + 2] = s.c.b; surf.set([s.r, s.m, s.tile + Math.min(0.98, s.wear) / 2, s.glow], j * 4); }
		g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.setAttribute('surf', new THREE.BufferAttribute(surf, 4));
		this.parts.push(g);
		return this;
	}
	// a sight's glass (its own see-through material up close; an opaque dark disc far off)
	glass(r, x, y, z, rx, ry, rz, reticle = 0xff3b30) {
		if (!this.hi) return this.add(new THREE.CircleGeometry(r, 12), S(0x0c1c24, 0.08, 0.6), x, y, z, rx, ry, rz);
		const g = new THREE.CircleGeometry(r, 28);
		g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1)));
		this.lens.push({ g, reticle, dot: r < 0.017 });
		return this;
	}
	build() {
		const merge = (list) => { const g = mergeGeometries(list); for (const p of list) p.dispose(); g.computeBoundingSphere(); g.computeBoundingBox(); return g; };
		const cell = this.cellParts.length ? merge(this.cellParts).translate(-this.cellAt[0], -this.cellAt[1], 0) : null;
		return { g: merge(this.body), cell, cellAt: this.cellAt, lens: this.lens };
	}
}

// ---------- shapes ----------
const V2 = (x, y) => new THREE.Vector2(x, y);
// a polygon with each corner cut by c
function poly(pts, c = 0) {
	const s = new THREE.Shape();
	const n = pts.length;
	for (let i = 0; i < n; i++) {
		const [x, y] = pts[i], [px, py] = pts[(i + n - 1) % n], [nx, ny] = pts[(i + 1) % n];
		if (!c) { if (i) s.lineTo(x, y); else s.moveTo(x, y); continue; }
		const l1 = Math.hypot(px - x, py - y), l2 = Math.hypot(nx - x, ny - y), k1 = Math.min(c, l1 * 0.45) / l1, k2 = Math.min(c, l2 * 0.45) / l2;
		const ax = x + (px - x) * k1, ay = y + (py - y) * k1, bx = x + (nx - x) * k2, by = y + (ny - y) * k2;
		if (i) s.lineTo(ax, ay); else s.moveTo(ax, ay);
		s.lineTo(bx, by);
	}
	s.closePath();
	return s;
}
const hole = (pts, c = 0) => { const s = poly(pts, c), p = new THREE.Path(s.getPoints()); return p; };
function rrect(w, h, r, cx = 0, cy = 0) {
	const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
	r = Math.min(r, w / 2, h / 2);
	s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
	return s;
}
const slotPath = (w, h, cx, cy) => new THREE.Path(rrect(w, h, Math.min(w, h) / 2, cx, cy).getPoints(4));
// a shape pushed out to depth d (centred on z), its edges bevelled by b
function slab(shape, d, b = 0.0015, bs = 2, cs = 4) {
	const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.0005, d - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: bs, curveSegments: cs });
	g.translate(0, 0, -(d - b * 2) / 2);
	return g;
}
// a chamfered block, w by h by d, centred
const block = (w, h, d, c = 0.002, b = 0.0012) => slab(poly([[-w / 2 + b, -h / 2 + b], [w / 2 - b, -h / 2 + b], [w / 2 - b, h / 2 - b], [-w / 2 + b, h / 2 - b]], c), d, b, 1);
// a turned profile [[r, x]...] about the x axis
function turn(pts, seg) { const g = new THREE.LatheGeometry(pts.map(([r, x]) => V2(Math.max(0.0004, r), x)), seg); g.rotateZ(-Math.PI / 2); return g; }
const tube = (r1, r2, len, seg) => { const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1); g.rotateZ(-Math.PI / 2); return g; };
const ring = (r, t, seg, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, Math.max(4, seg >> 2), seg, arc);
// a flat strap along a curve: w wide (across `side`), t thick
function strap(pts, w, t, n, side = new THREE.Vector3(0, 0, 1)) {
	const cv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
	const pos = [], idx = [], tan = new THREE.Vector3(), nr = new THREE.Vector3(), p = new THREE.Vector3();
	for (let i = 0; i <= n; i++) {
		cv.getPointAt(i / n, p); cv.getTangentAt(i / n, tan);
		nr.crossVectors(tan, side).normalize();
		for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(p.x + side.x * a * w / 2 + nr.x * b * t / 2, p.y + side.y * a * w / 2 + nr.y * b * t / 2, p.z + side.z * a * w / 2 + nr.z * b * t / 2);
	}
	for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + ((k + 1) & 3), c = a + 4, d = b + 4; idx.push(a, c, b, b, c, d); }
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
	return g;
}

// ---------- finishes: the tier as a premium skin on an item's main parts ----------
const tierHex = (t) => new THREE.Color(TIERS[t].color).getHex();
function finish(t, band) {
	const F = [
		{ main: S(0x1d1f20, 0.62, 0.08, T.speckle, { wear: 0.4 }), alt: S(0x6e5f48, 0.7, 0.04, T.speckle, { wear: 0.3 }), trim: S(0x3a3d41, 0.42, 0.8, T.brushed, { wear: 0.5 }) },
		{ main: S(0x3a4631, 0.55, 0.1, T.speckle, { wear: 0.45 }), alt: S(0x1e2021, 0.66, 0.05, T.speckle, { wear: 0.3 }), trim: S(0x3f7a4c, 0.3, 0.85, T.brushed, { wear: 0.4 }) },
		{ main: S(0x2b2e33, 0.48, 0.25, T.speckle, { wear: 0.4 }), alt: S(0x2a2c30, 0.26, 0.3, T.carbon, { wear: 0.1 }), trim: S(0x2a6fd0, 0.28, 0.85, T.brushed, { wear: 0.35 }) },
		{ main: S(0x7a7c80, 0.3, 0.9, T.damascus, { wear: 0.2 }), alt: S(0x1a1b1d, 0.28, 0.3, T.carbon, { wear: 0.1 }), trim: S(0x7a4fc0, 0.26, 0.88, T.brushed, { wear: 0.3 }) },
		{ main: S(0xd9a441, 0.22, 1, T.brushed, { wear: 0.12 }), alt: S(0x2d2a38, 0.2, 0.75, T.film, { wear: 0.15 }), trim: S(0xf2cf74, 0.18, 1, T.brushed, { wear: 0.1 }) },
	][t];
	const col = tierHex(t);
	// the Mossback's woodland stock, under every finish but gold
	const wild = t < 4 ? S([0x5a6444, 0x4e5a3c, 0x535b4a, 0x4a4a40][t], 0.7, 0.04, T.camo, { wear: 0.25 }) : F.alt;
	return { ...F, wild, inlay: band >= 1 ? S(col, 0.25, 0.9, T.plain, { glow: 0.35 + t * 0.12 }) : null, core: S(col, 0.3, 0, T.plain, { glow: band >= 2 ? 2.6 + t * 0.6 : 0.25 }), coreHex: col, band, t };
}
// the parts that do not change with the tier
const STEEL = S(0x2a2c2f, 0.36, 0.88, T.brushed, { wear: 0.55 });
const RAIL = S(0x1e2022, 0.46, 0.7, T.speckle, { wear: 0.75 });
const GRIP = S(0x1b1c1e, 0.86, 0.02, T.stipple, { wear: 0.05 });
const RUBBER = S(0x161718, 0.9, 0, T.ribs);
const OPTIC = S(0x1d1f22, 0.4, 0.55, T.speckle, { wear: 0.6 });
const KNURL = S(0x34373b, 0.4, 0.85, T.knurl, { wear: 0.4 });
const WEB = S(0x3c4234, 0.88, 0, T.webbing);
const BLACK = S(0x0b0c0d, 0.9, 0, T.plain);
const BRASS = S(0xa88a52, 0.3, 1, T.brushed, { wear: 0.3 });

// ---------- the long arms ----------
// a pistol grip at the origin, raked back, stippled
function pistolGrip(k) {
	const s = new THREE.Shape();
	s.moveTo(-0.026, 0.05); s.lineTo(0.026, 0.05); s.quadraticCurveTo(0.03, 0.02, 0.02, 0.0); s.quadraticCurveTo(0.026, -0.022, 0.016, -0.04);
	s.quadraticCurveTo(0.02, -0.06, 0.008, -0.074); s.lineTo(-0.034, -0.084); s.quadraticCurveTo(-0.044, -0.08, -0.04, -0.066); s.quadraticCurveTo(-0.034, -0.02, -0.036, 0.02); s.quadraticCurveTo(-0.036, 0.04, -0.026, 0.05);
	k.add(slab(s, 0.03, 0.004, k.hi ? 3 : 1, k.hi ? 6 : 2), GRIP);
	if (k.hi) k.add(block(0.006, 0.012, 0.031), RAIL, -0.034, -0.08, 0);
}
// the guard round the trigger, and the blade
function guard(k, x, F) {
	const s = rrect(0.08, 0.044, 0.016, x + 0.04, 0.026);
	s.holes.push(new THREE.Path(rrect(0.066, 0.032, 0.012, x + 0.038, 0.03).getPoints(6)));
	k.add(slab(s, 0.011, 0.0015, 1, k.hi ? 6 : 3), F.trim);
	if (k.hi) { const b = new THREE.Shape(); b.moveTo(0, 0); b.quadraticCurveTo(0.008, -0.012, 0.004, -0.024); b.lineTo(0.0005, -0.024); b.quadraticCurveTo(0.004, -0.012, -0.003, 0); k.add(slab(b, 0.006, 0.0006, 1, 3), STEEL, x + 0.03, 0.046, 0); }
}
// a toothed top rail from x0 to x1 at height y
function rail(k, x0, x1, y, w = 0.021) {
	const len = x1 - x0;
	k.add(block(len, 0.006, w * 0.8, 0.0015), RAIL, (x0 + x1) / 2, y + 0.003, 0);
	if (!k.hi) { k.add(block(len, 0.004, w, 0.001), RAIL, (x0 + x1) / 2, y + 0.008, 0); return; }
	const n = Math.floor(len / 0.0102);
	for (let i = 0; i < n; i++) k.add(block(0.0052, 0.0042, w, 0.0012, 0.0006), RAIL, x0 + 0.005 + i * 0.0102, y + 0.0081, 0);
}
// a sling: mounts and a webbing strap hanging between them, on the item's left
function sling(k, a, b, sag) {
	const z = -0.032;
	for (const p of [a, b]) k.add(ring(0.008, 0.0018, k.hi ? 16 : 8), STEEL, p[0], p[1], z + 0.004, 0, Math.PI / 2, 0);
	const mid = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - sag, z - 0.004];
	k.add(strap([[a[0], a[1] - 0.008, z], [a[0] + (mid[0] - a[0]) * 0.4, mid[1] + sag * 0.35, z - 0.004], mid, [b[0] - (b[0] - mid[0]) * 0.4, mid[1] + sag * 0.4, z - 0.004], [b[0], b[1] - 0.008, z]], 0.024, 0.003, k.hi ? 28 : 10, new THREE.Vector3(0, 0, 1)), WEB);
	if (k.hi) k.add(block(0.03, 0.03, 0.006, 0.004), RAIL, mid[0] - 0.05, mid[1] + 0.02, z - 0.004, 0, 0, 0.35);
}
// a vented handguard from x0 to x1, its axis at height y, h tall: side plates with slots,
// a floor, the inner tube seen through the vents (it glows with the core)
function handguard(k, F, x0, x1, y, h, w, hex) {
	const len = x1 - x0, plate = poly([[x0, y - h / 2], [x1, y - h / 2], [x1, y + h / 2], [x0, y + h / 2]], 0.006);
	const n = Math.max(2, Math.floor(len / 0.06));
	for (let i = 0; i < (k.hi ? n : 0); i++) {
		const cx = x0 + (i + 0.6) * len / (n + 0.2);
		if (hex) { const r = h * 0.2; plate.holes.push(new THREE.Path(poly([[cx - r, y], [cx - r / 2, y + r * 0.87], [cx + r / 2, y + r * 0.87], [cx + r, y], [cx + r / 2, y - r * 0.87], [cx - r / 2, y - r * 0.87]].reverse(), 0).getPoints())); }
		else plate.holes.push(slotPath(len / (n + 0.2) * 0.62, h * 0.24, cx, y));
	}
	for (const z of [-w / 2, w / 2]) k.add(slab(plate, 0.005, k.hi ? 0.0012 : 0, 1, k.hi ? 4 : 1), F.main, 0, 0, z);
	k.add(block(len, 0.006, w + 0.004, 0.003), F.main, (x0 + x1) / 2, y - h / 2 + 0.002, 0);
	if (k.hi) for (let i = 0; i < n; i++) k.add(block(len / (n + 0.2) * 0.5, 0.0016, 0.012, 0.0006, 0.0004), BLACK, x0 + (i + 0.6) * len / (n + 0.2), y - h / 2 - 0.0014, 0);
	if (k.hi) k.add(tube(h * 0.3, h * 0.3, len - 0.004, 18), F.band >= 2 ? F.core : STEEL, (x0 + x1) / 2, y, 0);
	k.add(block(0.012, h + 0.004, w + 0.006, 0.004), F.trim, x1 + 0.004, y, 0);
}
// a long scope from x0 to x1 at height y, on two rings
function scope(k, F, x0, x1, y, railY, reticle) {
	const seg = k.hi ? 28 : 10, r = 0.0145;
	// an open tube, dark inside, so the eye sees through it to the glass
	const outer = [[0.0185, x0 - 0.05], [0.0205, x0 - 0.05], [0.021, x0 - 0.04], [0.0195, x0 - 0.012], [r, x0], [r, x1], [0.022, x1 + 0.04], [0.0265, x1 + 0.07], [0.0265, x1 + 0.082], [0.0245, x1 + 0.082]];
	k.add(turn(outer, seg), OPTIC, 0, y, 0);
	k.add(turn(outer.map(([q, x]) => [q - 0.0015, x]).reverse(), seg), BLACK, 0, y, 0);
	if (k.hi) { k.add(turn([[0.0205, x0 - 0.035], [0.0215, x0 - 0.035], [0.0215, x0 - 0.02], [0.0205, x0 - 0.02]], seg), KNURL, 0, y, 0); k.add(ring(0.0265, 0.0015, seg), F.trim, x1 + 0.082, y, 0, 0, Math.PI / 2); }
	const mid = (x0 + x1) / 2;
	k.add(tube(0.011, 0.011, 0.02, seg), KNURL, mid, y + 0.022, 0, 0, 0, Math.PI / 2);
	k.add(tube(0.01, 0.01, 0.018, seg), KNURL, mid, y, 0.022, 0, Math.PI / 2, 0);
	k.add(turn([[0.016, mid - 0.025], [0.017, mid - 0.02], [0.017, mid + 0.02], [0.016, mid + 0.025]], seg), OPTIC, 0, y, 0);
	for (const x of [x0 + 0.03, x1 - 0.03]) {
		k.add(ring(r + 0.003, 0.003, seg), F.trim, x, y, 0, 0, Math.PI / 2);
		k.add(block(0.018, y - railY - r, 0.016, 0.003), F.trim, x, (y + railY) / 2 - 0.004, 0);
		if (k.hi) for (const z of [-0.011, 0.011]) k.add(tube(0.0028, 0.0028, 0.006, 6), STEEL, x, railY + 0.006, z, 0, Math.PI / 2, 0);
	}
	k.glass(0.0196, x0 - 0.049, y, 0, 0, -Math.PI / 2, 0, reticle);
	k.glass(0.0255, x1 + 0.0815, y, 0, 0, Math.PI / 2, 0, null);
}
// an open reflex sight on the rail at x, its window centred at height y
function reflex(k, F, x, railY, y, reticle) {
	const fr = poly([[-0.03, -0.004], [0.03, -0.004], [0.026, 0.036], [0.018, 0.044], [-0.018, 0.044], [-0.026, 0.036]], 0.004);
	fr.holes.push(new THREE.Path(rrect(0.038, 0.03, 0.008, 0, y - railY - 0.012).getPoints(6)));
	const g = slab(fr, 0.012, 0.0018, 2, 4); g.rotateY(Math.PI / 2);
	k.add(g, OPTIC, x, railY + 0.012, 0);
	k.add(block(0.05, 0.01, 0.03, 0.003), OPTIC, x - 0.012, railY + 0.008, 0);
	if (k.hi) { k.add(tube(0.006, 0.006, 0.014, 12), KNURL, x - 0.02, railY + 0.013, 0.018, Math.PI / 2, 0, 0); k.add(block(0.008, 0.004, 0.004), F.trim, x - 0.03, railY + 0.016, 0); }
	k.glass(0.015, x, y, 0, 0, -Math.PI / 2, 0, reticle);
}
// a fluted shroud over the muzzle from x0 to x1 at height y
function shroud(k, F, x0, x1, y, r, seg) {
	const p = [[0.0, x0], [r * 0.8, x0], [r, x0 + 0.008]];
	const n = 5;
	for (let i = 0; i < n; i++) { const a = x0 + 0.02 + i * (x1 - x0 - 0.05) / n; p.push([r, a], [r * 0.9, a + 0.004], [r * 0.9, a + 0.01], [r, a + 0.014]); }
	p.push([r, x1 - 0.012], [r * 0.82, x1], [r * 0.4, x1], [r * 0.4, x1 - 0.004], [0.0, x1 - 0.004]);
	k.add(turn(p, seg), STEEL, 0, y, 0);
	if (k.hi) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(block(x1 - x0 - 0.06, 0.003, 0.004, 0.001, 0.0007), F.trim, (x0 + x1) / 2, y + Math.cos(a) * (r + 0.0005), Math.sin(a) * (r + 0.0005), a, 0, 0); }
	k.add(ring(r * 0.95, 0.0016, seg), F.trim, x0 + 0.004, y, 0, 0, Math.PI / 2);
}
// the energy cell under the receiver: angled, with a window that glows with the core
function cell(k, F, x, y, len, w) {
	const s = poly([[x - 0.026, y], [x + 0.026, y], [x + 0.034, y - len], [x - 0.018, y - len - 0.004]], 0.005);
	k.cell(x + 0.004, y - len);
	k.add(slab(s, w, 0.002, 2, 2), F.alt);
	k.add(block(0.008, len * 0.7, 0.0016, 0.001, 0.0005), F.core, x + 0.008, y - len * 0.48, w / 2 + 0.0003, 0, 0, 0.1);
	k.add(block(0.008, len * 0.7, 0.0016, 0.001, 0.0005), F.core, x + 0.008, y - len * 0.48, -w / 2 - 0.0003, 0, 0, 0.1);
	k.add(block(0.056, 0.008, w + 0.004, 0.003), RUBBER, x + 0.008, y - len - 0.002, 0, 0, 0, -0.08);
	k.main();
}
// an inlay line in the tier's colour (from level 4) along a side
function inlay(k, F, x0, x1, y, z) { if (F.inlay) for (const s of [-1, 1]) k.add(block(x1 - x0, 0.0026, 0.0012, 0.0008, 0.0004), F.inlay, (x0 + x1) / 2, y, s * z); }
// a small status display (near-future kit): dark glass, a lit bar in the tier's colour
function display(k, F, x, y, z, w = 0.032) {
	if (!k.hi) return;
	const s = Math.sign(z) || 1;
	k.add(block(w, 0.014, 0.003, 0.002, 0.0008), S(0x07090a, 0.08, 0.5), x, y, z);
	k.add(block(w * 0.7, 0.0024, 0.0008, 0.0004, 0.0002), S(F.coreHex, 0.3, 0, T.plain, { glow: 1.6 }), x - w * 0.1, y + 0.002, z + s * 0.0016);
	k.add(block(w * 0.35, 0.0018, 0.0008, 0.0004, 0.0002), S(0x9fe8ff, 0.3, 0, T.plain, { glow: 0.9 }), x - w * 0.25, y - 0.003, z + s * 0.0016);
}
function screws(k, pts, z) { if (k.hi) for (const [x, y] of pts) for (const s of [-1, 1]) k.add(tube(0.0028, 0.0028, 0.002, 6), STEEL, x, y, s * z, 0, Math.PI / 2, 0); }

// the Aurora: a long marksman's trail rifle, skeleton stock, vented guard, a scope, a shroud
function aurora(k, F) {
	const seg = k.hi ? 24 : 10;
	pistolGrip(k); guard(k, 0.015, F);
	k.add(slab(poly([[-0.08, 0.046], [0.17, 0.046], [0.185, 0.07], [0.185, 0.096], [-0.08, 0.096]], 0.004), 0.05, 0.002, 2), F.main);
	k.add(slab(poly([[-0.08, 0.096], [0.2, 0.096], [0.2, 0.138], [0.19, 0.144], [-0.07, 0.144], [-0.08, 0.134]], 0.004), 0.054, 0.0022, 2), F.main);
	if (k.hi) { k.add(block(0.09, 0.022, 0.002, 0.003), F.alt, 0.07, 0.12, 0.0275); k.add(block(0.04, 0.012, 0.002, 0.003), F.alt, -0.03, 0.072, 0.0255); }
	inlay(k, F, -0.06, 0.16, 0.104, 0.0278);
	screws(k, [[-0.06, 0.06], [0.16, 0.06], [-0.06, 0.13], [0.18, 0.13]], 0.0265);
	cell(k, F, 0.12, 0.046, 0.12, 0.036);
	handguard(k, F, 0.2, 0.6, 0.112, 0.064, 0.052, false);
	rail(k, -0.075, 0.6, 0.144);
	if (k.hi) for (const z of [-1, 1]) k.add(block(0.1, 0.005, 0.014, 0.0015), RAIL, 0.53, 0.112, z * 0.03, Math.PI / 2, 0, 0);
	k.add(tube(0.0095, 0.0095, 0.08, seg), STEEL, 0.64, 0.112, 0);
	shroud(k, F, 0.66, 0.9, 0.112, 0.021, seg);
	// the stock: a skeleton with a thumb hole, a cheek riser and a ribbed pad
	const st = poly([[-0.08, 0.138], [-0.3, 0.13], [-0.35, 0.142], [-0.375, 0.142], [-0.375, -0.03], [-0.355, -0.036], [-0.2, 0.028], [-0.08, 0.052]], 0.008);
	st.holes.push(hole([[-0.33, 0.104], [-0.33, 0.012], [-0.21, 0.052], [-0.13, 0.104]].reverse(), 0.012));
	k.add(slab(st, 0.034, 0.003, k.hi ? 2 : 1, 3), F.alt);
	inlay(k, F, -0.29, -0.12, 0.118, 0.0175);
	k.add(block(0.15, 0.014, 0.03, 0.005), F.main, -0.21, 0.149, 0);
	display(k, F, -0.035, 0.121, 0.0285);
	if (k.hi) k.add(ring(0.006, 0.0016, 12), STEEL, -0.07, 0.07, -0.027);
	if (k.hi) for (const x of [-0.26, -0.16]) k.add(tube(0.004, 0.004, 0.012, 8), STEEL, x, 0.14, 0, 0, 0, Math.PI / 2);
	k.add(block(0.016, 0.19, 0.04, 0.008, 0.003), RUBBER, -0.385, 0.054, 0);
	sling(k, [-0.34, -0.012], [0.55, 0.074], 0.12);
	scope(k, F, -0.02, 0.24, 0.198, 0.152, 0xff3b30);
}
// the Mossback: a lighter scout rifle, one-piece thumbhole stock in the finish's second colour,
// a round guard with knurled bands, a long scout scope out front, a short brake
function mossback(k, F) {
	const seg = k.hi ? 24 : 10;
	const stock = poly([[0.17, 0.05], [0.17, 0.092], [-0.06, 0.1], [-0.3, 0.112], [-0.34, 0.124], [-0.37, 0.124], [-0.372, -0.04], [-0.35, -0.046], [-0.24, 0.0], [-0.06, -0.075], [-0.03, -0.086], [0.006, -0.074], [0.03, 0.045]], 0.008);
	stock.holes.push(hole([[-0.07, 0.07], [-0.21, 0.08], [-0.27, 0.06], [-0.2, 0.03], [-0.058, -0.03], [-0.035, 0.03]].reverse(), 0.012));
	k.add(slab(stock, 0.036, 0.004, k.hi ? 3 : 1, 3), F.wild);
	if (k.hi) k.add(block(0.04, 0.05, 0.038, 0.006), GRIP, -0.01, -0.03, 0, 0, 0, -0.3);
	guard(k, 0.015, F);
	k.add(slab(poly([[-0.06, 0.092], [0.21, 0.092], [0.21, 0.13], [0.2, 0.136], [-0.05, 0.136], [-0.06, 0.126]], 0.005), 0.046, 0.002, 2), F.main);
	inlay(k, F, -0.04, 0.19, 0.112, 0.0255);
	screws(k, [[-0.04, 0.12], [0.19, 0.12]], 0.024);
	cell(k, F, 0.11, 0.05, 0.075, 0.032);
	display(k, F, 0.02, 0.114, 0.0245);
	if (k.hi) for (const z of [-1, 1]) k.add(block(0.07, 0.004, 0.012, 0.0012), RAIL, 0.4, 0.108, z * 0.027, Math.PI / 2, 0, 0);
	k.add(turn([[0.024, 0.21], [0.026, 0.22], [0.026, 0.52], [0.022, 0.54], [0.012, 0.545]], seg), F.alt, 0, 0.108, 0);
	for (const x of [0.25, 0.45]) k.add(turn([[0.0262, x], [0.0275, x + 0.004], [0.0275, x + 0.03], [0.0262, x + 0.034]], seg), KNURL, 0, 0.108, 0);
	if (k.hi) for (let i = 0; i < 6; i++) k.add(block(0.04, 0.003, 0.012, 0.001), BLACK, 0.29 + i * 0.026, 0.083, 0, 0, 0, 0);
	rail(k, 0.24, 0.47, 0.132, 0.018);
	k.add(tube(0.0095, 0.0095, 0.17, seg), STEEL, 0.62, 0.108, 0);
	const br = [[0.0, 0.7], [0.016, 0.7], [0.017, 0.706], [0.017, 0.76], [0.014, 0.764], [0.0, 0.764]];
	k.add(turn(br, seg), STEEL, 0, 0.108, 0);
	if (k.hi) for (let i = 0; i < 3; i++) for (const s of [-1, 1]) k.add(block(0.008, 0.004, 0.006, 0.001, 0.0006), BLACK, 0.718 + i * 0.014, 0.108, s * 0.0145);
	k.add(block(0.016, 0.17, 0.042, 0.008, 0.003), RUBBER, -0.38, 0.04, 0);
	sling(k, [-0.33, -0.026], [0.5, 0.08], 0.1);
	// the scout scope sits forward, over the guard
	scope(k, F, 0.27, 0.43, 0.168, 0.14, 0x39ff88);
}
// the Warden: a compact guard carbine, angular plates, a reflex sight, and in place of a muzzle
// a ringed emitter that ends an encounter with a flash
function warden(k, F) {
	const seg = k.hi ? 24 : 10;
	pistolGrip(k); guard(k, 0.015, F);
	k.add(slab(poly([[-0.09, 0.046], [0.2, 0.046], [0.26, 0.07], [0.32, 0.084], [0.32, 0.15], [0.12, 0.162], [-0.06, 0.158], [-0.09, 0.14]], 0.008), 0.056, 0.0025, 2, 2), F.main);
	if (k.hi) {
		k.add(slab(poly([[0.02, 0.07], [0.24, 0.074], [0.29, 0.094], [0.29, 0.13], [0.04, 0.14]], 0.006), 0.004, 0.001, 1), F.alt, 0, 0, 0.029);
		k.add(slab(poly([[0.02, 0.07], [0.24, 0.074], [0.29, 0.094], [0.29, 0.13], [0.04, 0.14]], 0.006), 0.004, 0.001, 1), F.alt, 0, 0, -0.029);
		for (let i = 0; i < 4; i++) for (const s of [-1, 1]) k.add(block(0.022, 0.004, 0.002, 0.001, 0.0006), BLACK, 0.12 + i * 0.035, 0.12, s * 0.0315);
	}
	inlay(k, F, -0.07, 0.29, 0.152, 0.0282);
	screws(k, [[-0.07, 0.06], [0.18, 0.06], [0.3, 0.1]], 0.0285);
	// the side cell, a glowing bar along the right
	k.add(block(0.15, 0.03, 0.016, 0.005), F.alt, 0.1, 0.085, 0.034);
	k.add(block(0.12, 0.008, 0.0016), F.core, 0.1, 0.085, 0.0428);
	cell(k, F, 0.13, 0.046, 0.09, 0.034);
	display(k, F, -0.04, 0.128, 0.0295);
	if (k.hi) {
		for (const z of [-1, 1]) k.add(block(0.06, 0.005, 0.013, 0.0012), RAIL, 0.27, 0.112, z * 0.031, Math.PI / 2, 0, 0);
		k.add(slab(poly([[0.235, 0.064], [0.27, 0.074], [0.285, 0.062], [0.27, 0.046], [0.25, 0.046]], 0.004), 0.03, 0.002, 2), GRIP);
		for (let i = 0; i < 5; i++) k.add(block(0.004, 0.026, 0.002, 0.001, 0.0006), BLACK, 0.205 + i * 0.016, 0.1, 0.0302);
	}
	rail(k, -0.08, 0.3, 0.162);
	// the emitter: a cone in three coils
	k.add(turn([[0.03, 0.32], [0.032, 0.33], [0.024, 0.36], [0.026, 0.37], [0.018, 0.4], [0.014, 0.4], [0.014, 0.39], [0.0, 0.39]], seg), STEEL, 0, 0.117, 0);
	for (const [x, r] of [[0.335, 0.031], [0.358, 0.027], [0.38, 0.022]]) k.add(ring(r, 0.0032, seg), F.band >= 2 ? F.core : F.trim, x, 0.117, 0, 0, Math.PI / 2);
	k.add(turn([[0.0, 0.392], [0.011, 0.392], [0.006, 0.4], [0.0, 0.401]], seg), F.core, 0, 0.117, 0);
	// a collapsing stock: two rods and a pad
	for (const y of [0.075, 0.135]) k.add(tube(0.006, 0.006, 0.2, k.hi ? 12 : 6), STEEL, -0.18, y, 0);
	k.add(slab(poly([[-0.29, 0.16], [-0.27, 0.16], [-0.27, 0.04], [-0.29, 0.0]], 0.008), 0.042, 0.003, 2), F.alt);
	k.add(block(0.012, 0.17, 0.044, 0.006), RUBBER, -0.296, 0.078, 0);
	sling(k, [-0.28, 0.02], [0.28, 0.07], 0.09);
	reflex(k, F, 0.04, 0.17, 0.205, 0xffb347);
}
const RIFLES = { 'aurora-trail-rifle': aurora, 'mossback-scout-rifle': mossback, 'warden-spark-carbine': warden };

// ---------- the rest of the kit, at the same finish ----------
// a take-down recurve: a machined riser with cut-outs, laminated limbs, a stabiliser
function bow(k, F) {
	const seg = k.hi ? 16 : 6;
	const riser = poly([[-0.018, -0.2], [0.012, -0.2], [0.02, -0.08], [0.03, -0.03], [0.03, 0.04], [0.018, 0.08], [0.012, 0.2], [-0.018, 0.2], [-0.02, 0.08], [-0.03, 0.05], [-0.03, -0.05], [-0.02, -0.08]], 0.006);
	riser.holes.push(hole([[0.004, 0.17], [-0.008, 0.17], [-0.01, 0.09], [0.006, 0.1]], 0.004), hole([[0.006, -0.1], [-0.01, -0.09], [-0.008, -0.17], [0.004, -0.17]], 0.004));
	k.add(slab(riser, 0.026, 0.003, 2, 3), F.main);
	k.add(slab(rrect(0.05, 0.075, 0.018), 0.034, 0.004, 2, 4), GRIP);
	if (F.inlay) for (const s of [-1, 1]) k.add(block(0.004, 0.24, 0.0012, 0.0008, 0.0004), F.inlay, 0.004, 0, s * 0.0136);
	for (const sy of [1, -1]) {
		const pts = [[0, 0.19, -0.004], [0, 0.32, 0.02], [0, 0.46, 0.04], [0, 0.58, 0.02], [0, 0.66, -0.03]].map(([x, y, z]) => [z, y * sy, x]);
		k.add(strap(pts, 0.03, 0.009, k.hi ? 24 : 8, new THREE.Vector3(0, 0, 1)), F.alt);
		k.add(block(0.02, 0.03, 0.03, 0.006), F.trim, -0.004, 0.205 * sy, 0);
		k.add(ring(0.006, 0.002, 8), F.trim, -0.03, 0.66 * sy, 0, 0, Math.PI / 2);
		if (k.hi) k.add(block(0.004, 0.05, 0.0012), F.core, 0.012, 0.42 * sy, 0.016);
	}
	const sp = new THREE.CylinderGeometry(0.0012, 0.0012, 1.3, 4);
	k.add(sp, S(0xe9e2cf, 0.8, 0), -0.035, 0, 0, 0, 0, 0.0);
	k.add(tube(0.007, 0.009, 0.2, seg), F.trim, 0.12, -0.03, 0);
	k.add(tube(0.016, 0.016, 0.03, seg), RUBBER, 0.235, -0.03, 0);
	if (k.hi) { k.add(block(0.016, 0.004, 0.012, 0.001), STEEL, 0.02, 0.05, -0.016); k.add(ring(0.008, 0.0015, 10), F.core, 0.03, 0.06, 0.0, 0, Math.PI / 2); }
}
// a modern camp lantern: a machined cage round a glowing globe, a bail handle
function lantern(k, F, alarm) {
	const seg = k.hi ? 24 : 10;
	k.add(ring(0.05, 0.0035, seg, Math.PI), F.trim, 0, -0.077, 0);
	k.add(turn([[0.0, -0.104], [0.04, -0.104], [0.054, -0.1], [0.05, -0.085], [0.03, -0.075], [0.0, -0.075]], seg).rotateZ(Math.PI / 2), F.main);
	k.add(new THREE.SphereGeometry(0.034, seg, seg >> 1), S(alarm ? 0xff8a4a : 0xffd38a, 0.2, 0, T.glass, { glow: F.band >= 2 ? 3.5 : 1.6 }), 0, -0.16, 0);
	const bars = k.hi ? 8 : 4;
	for (let i = 0; i < bars; i++) { const a = i / bars * Math.PI * 2; k.add(block(0.008, 0.11, 0.006, 0.002), F.main, Math.cos(a) * 0.052, -0.16, Math.sin(a) * 0.052, 0, -a, 0); }
	k.add(new THREE.CylinderGeometry(0.056, 0.056, 0.006, seg), F.trim, 0, -0.105, 0);
	k.add(turn([[0.0, 0.205], [0.06, 0.205], [0.064, 0.215], [0.058, 0.228], [0.0, 0.228]], seg).rotateZ(Math.PI / 2).translate(0, -0.43, 0), alarm ? S(0x8e2a24, 0.5, 0.2, T.speckle, { wear: 0.4 }) : F.alt);
	if (alarm) k.add(new THREE.CylinderGeometry(0.018, 0.024, 0.018, seg), BRASS, 0, -0.06, 0);
	if (k.hi) { k.add(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 12), KNURL, 0.045, -0.214, 0, 0, 0, Math.PI / 2); k.add(ring(0.056, 0.002, seg), F.core, 0, -0.21, 0, Math.PI / 2); }
}
// a rugged first-aid pouch: a padded case, a cross patch, zip pulls, a grab handle
function medkit(k, F) {
	k.add(slab(rrect(0.24, 0.16, 0.035), 0.08, 0.012, k.hi ? 3 : 1, k.hi ? 6 : 2), S(0x6b2a2a, 0.82, 0, T.canvas), 0, -0.12, 0);
	const cross = poly([[-0.016, -0.046], [0.016, -0.046], [0.016, -0.016], [0.046, -0.016], [0.046, 0.016], [0.016, 0.016], [0.016, 0.046], [-0.016, 0.046], [-0.016, 0.016], [-0.046, 0.016], [-0.046, -0.016], [-0.016, -0.016]], 0.003);
	k.add(slab(cross, 0.003, 0.001, 1), S(0xf1efe8, 0.7, 0), 0, -0.12, 0.047);
	k.add(block(0.25, 0.008, 0.084, 0.003), BLACK, 0, -0.045, 0);
	for (const x of [-0.07, 0.07]) k.add(block(0.012, 0.03, 0.006, 0.002), F.trim, x, -0.06, 0.044);
	k.add(strap([[-0.05, -0.04, 0], [-0.04, -0.012, 0], [0.04, -0.012, 0], [0.05, -0.04, 0]], 0.022, 0.008, k.hi ? 12 : 6), WEB);
	if (F.inlay) k.add(block(0.2, 0.006, 0.002), F.inlay, 0, -0.19, 0.0415);
	if (k.hi) k.add(slab(rrect(0.08, 0.04, 0.006), 0.002, 0.0006, 1), F.alt, 0, -0.17, -0.0415);
}
// a canvas tool roll carried by its strap, handles out of one end
function toolRoll(k, F) {
	const seg = k.hi ? 20 : 8;
	k.add(turn([[0.0, -0.15], [0.048, -0.15], [0.054, -0.14], [0.054, 0.12], [0.05, 0.13], [0.0, 0.13]], seg), S(0x5d6b46, 0.88, 0, T.canvas), 0, -0.075, 0);
	for (const x of [-0.08, 0.06]) k.add(ring(0.056, 0.005, seg), WEB, x, -0.075, 0, 0, Math.PI / 2);
	k.add(strap([[-0.08, -0.03, 0], [-0.04, 0.0, 0], [0.04, 0.0, 0], [0.06, -0.03, 0]], 0.02, 0.004, 10), WEB);
	k.add(block(0.008, 0.02, 0.024, 0.003), F.trim, 0.06, -0.075, 0.057);
	const tools = k.hi ? 4 : 2;
	for (let i = 0; i < tools; i++) {
		const z = (i - (tools - 1) / 2) * 0.024;
		k.add(tube(0.008, 0.009, 0.06, 10), i % 2 ? GRIP : F.alt, 0.165, -0.075, z);
		k.add(tube(0.0035, 0.004, 0.035, 8), STEEL, 0.21, -0.075, z);
	}
	if (F.inlay) k.add(ring(0.055, 0.0025, seg), F.inlay, -0.13, -0.075, 0, 0, Math.PI / 2);
}
// a telescopic catch net: a knurled grip, a carbon pole, a hoop, the mesh
function net(k, F) {
	const seg = k.hi ? 20 : 8;
	k.add(new THREE.CylinderGeometry(0.017, 0.018, 0.13, seg), GRIP, 0, 0.0, 0);
	k.add(new THREE.CylinderGeometry(0.013, 0.014, 0.28, seg), F.main, 0, 0.2, 0);
	k.add(new THREE.CylinderGeometry(0.01, 0.011, 0.14, seg), F.trim, 0, 0.4, 0);
	k.add(ring(0.17, 0.006, k.hi ? 40 : 16), F.alt, 0, 0.62, 0, Math.PI / 2 - 0.25);
	const bag = new THREE.LatheGeometry([V2(0.0005, -0.16), V2(0.03, -0.155), V2(0.1, -0.12), V2(0.15, -0.06), V2(0.17, 0)], k.hi ? 24 : 10);
	k.add(bag, S(0xd8cfb8, 0.9, 0, T.hex, { dens: 30 }), 0, 0.62, 0, -0.25);
	if (F.inlay) k.add(ring(0.015, 0.003, seg), F.inlay, 0, 0.33, 0, Math.PI / 2);
}
function scentKit(k, F) {
	const seg = k.hi ? 20 : 8;
	const pouch = new THREE.LatheGeometry([V2(0.0005, -0.17), V2(0.04, -0.165), V2(0.055, -0.13), V2(0.05, -0.07), V2(0.035, -0.04), V2(0.03, -0.03), V2(0.0005, -0.03)], seg);
	k.add(pouch, S(0x5a3a26, 0.75, 0, T.leather), 0, 0, 0, 0, 0, 0, [1, 1, 0.7]);
	k.add(ring(0.031, 0.004, seg), WEB, 0, -0.045, 0, Math.PI / 2);
	k.add(new THREE.CylinderGeometry(0.013, 0.013, 0.05, seg), S(0x9be06a, 0.1, 0, T.glass, { glow: F.band >= 2 ? 2 : 0.5 }), 0.064, -0.09, 0);
	k.add(new THREE.CylinderGeometry(0.014, 0.014, 0.012, seg), F.trim, 0.064, -0.06, 0);
}
function brace(k, F) {
	const seg = k.hi ? 20 : 8;
	k.add(slab(rrect(0.07, 0.8, 0.014), 0.034, 0.004, 2, 3), F.alt, 0, 0.05, 0);
	k.add(block(0.085, 0.07, 0.046, 0.008), F.main, 0, 0.44, 0);
	k.add(block(0.085, 0.06, 0.046, 0.008), F.main, 0, -0.34, 0);
	k.add(new THREE.CylinderGeometry(0.012, 0.012, 0.08, seg), STEEL, 0, -0.41, 0);
	k.add(new THREE.CylinderGeometry(0.03, 0.034, 0.02, seg), RUBBER, 0, -0.46, 0);
	k.add(new THREE.CylinderGeometry(0.04, 0.04, 0.1, seg), GRIP, 0, 0, 0);
	if (F.inlay) k.add(block(0.012, 0.5, 0.002), F.inlay, 0, 0.05, 0.0175);
}
function flare(k, F) {
	const seg = k.hi ? 20 : 8;
	k.add(turn([[0.0, -0.08], [0.02, -0.08], [0.022, -0.075], [0.022, 0.1], [0.02, 0.105], [0.0, 0.105]], seg).rotateZ(Math.PI / 2), S(0xc8372a, 0.5, 0.05, T.speckle, { wear: 0.3 }));
	k.add(new THREE.CylinderGeometry(0.0225, 0.0225, 0.04, seg), GRIP, 0, 0.0, 0);
	k.add(turn([[0.0, 0.1], [0.024, 0.1], [0.024, 0.13], [0.018, 0.14], [0.0, 0.142]], seg).rotateZ(Math.PI / 2), F.trim);
	k.add(new THREE.SphereGeometry(0.012, 12, 6), S(0xffa64d, 0.3, 0, T.plain, { glow: F.band >= 2 ? 3 : 1 }), 0, 0.145, 0);
	k.add(new THREE.CylinderGeometry(0.026, 0.026, 0.01, seg), F.main, 0, -0.06, 0);
}
const BUILD = {
	...RIFLES,
	'reedline-hunting-bow': bow, 'camp-lantern': (k, F) => lantern(k, F, false), 'lantern-alarm': (k, F) => lantern(k, F, true), 'field-medkit': medkit,
	'repair-roll': toolRoll, 'hunting-net': net, 'trail-scent-kit': scentKit, 'door-brace': brace, 'station-signal-flare': flare,
};

// ---------- holds: where each hand closes on an item ----------
// A hand frame: o the palm's centre, a from the wrist toward the knuckles, t toward the thumb
// side of the knuckles; the palm faces n (t x a for the right hand, a x t for the left). A grip
// is given by the axis point the fist closes round (c), its radius (r), and a and t.
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const RAKE = 0.3;
const PISTOL = { c: v3(-0.006, -0.012, 0), r: 0.026, a: v3(Math.cos(RAKE), -Math.sin(RAKE), 0), t: v3(Math.sin(RAKE), Math.cos(RAKE), 0) };
const fore = (x, y, r = 0.034) => ({ c: v3(x, y, 0), r, a: v3(0.35, 0.45, 1).normalize(), t: v3(1, 0, 0) });
// shafts held upright (t along the shaft) and handles carried hanging (t along the handle)
const SHAFT = (y = 0, r = 0.02) => ({ c: v3(0, y, 0), r, a: v3(1, 0, 0), t: v3(0, 1, 0) });
const HANDLE = (y = 0, r = 0.012) => ({ c: v3(0, y, 0), r, a: v3(0, -1, 0), t: v3(1, 0, 0) });
// kind: 'long' (two hands, carried at the ready), 'one' (hangs in one hand), level: kept upright
export const HOLDS = {
	'aurora-trail-rifle': { kind: 'long', R: PISTOL, L: fore(0.42, 0.112, 0.036), sight: [-0.069, 0.198, 0.08], zoom: 1.9 },
	'mossback-scout-rifle': { kind: 'long', R: PISTOL, L: fore(0.36, 0.108, 0.03), sight: [0.221, 0.168, 0.2], zoom: 1.5 },
	'warden-spark-carbine': { kind: 'long', R: PISTOL, L: fore(0.22, 0.1, 0.036), sight: [0.04, 0.205, 0.22], zoom: 1.25 },
	'reedline-hunting-bow': { kind: 'bow', side: 'L', L: { c: v3(0, 0, 0), r: 0.026, a: v3(0.3, 0, -1), t: v3(0, 1, 0) } },
	'hunting-net': { kind: 'one', R: SHAFT(0, 0.018) },
	'door-brace': { kind: 'one', R: SHAFT(0, 0.04) },
	'station-signal-flare': { kind: 'one', R: SHAFT(0, 0.022) },
	'camp-lantern': { kind: 'one', R: HANDLE(-0.027, 0.0035), level: true },
	'lantern-alarm': { kind: 'one', R: HANDLE(-0.027, 0.0035), level: true },
	'field-medkit': { kind: 'one', R: HANDLE(-0.012, 0.008), level: true },
	'repair-roll': { kind: 'one', R: HANDLE(0.0, 0.004), level: true },
	'trail-scent-kit': { kind: 'one', R: HANDLE(-0.03, 0.004), level: true },
};
for (const h of Object.values(HOLDS)) for (const s of ['R', 'L']) {
	const g = h[s];
	if (!g) continue;
	g.a.normalize(); g.t.addScaledVector(g.a, -g.t.dot(g.a)).normalize();
	g.n = s === 'R' ? new THREE.Vector3().crossVectors(g.t, g.a) : new THREE.Vector3().crossVectors(g.a, g.t);
	g.o = g.c.clone().addScaledVector(g.n, -g.r);
	// the hand's frame in item space (columns a, t, n at o)
	g.m = new THREE.Matrix4().makeBasis(g.a, g.t, g.n).setPosition(g.o);
}
export const holdOf = (id) => HOLDS[id] || HOLDS['field-medkit'];

// How each usable item presents when used (crysis/viewmodel.js): shots a second it can keep up,
// the recoil (kick back, rise, the side drift shot by shot, how fast it settles), the cell's
// count and swap time for the reload, the muzzle in item space, the flash, and its sound cues
// (crysis/weapon-sound.js)
const cues = (fire, ready = 'ready') => ({ fire, dry: 'dry', out: 'cell-out', in: 'cell-in', ready, equip: 'equip', holster: 'holster', aim: 'aim' });
export const WEAPONS = {
	'aurora-trail-rifle': { rate: 1.6, mag: 8, reload: 2.3, muzzle: [0.9, 0.112], vent: [0.06, 0.13, 0.03], flash: 'flash', tint: 0xffcf95, size: 0.16, recoil: { kick: 0.055, rise: 0.11, side: [0.012, -0.02, 0.016, -0.008, 0.02], recover: 9 }, sounds: cues('marksman') },
	'mossback-scout-rifle': { rate: 1.1, mag: 5, reload: 2.0, muzzle: [0.764, 0.108], vent: [0.05, 0.12, 0.028], flash: 'flash', tint: 0xffd9a8, size: 0.14, recoil: { kick: 0.05, rise: 0.1, side: [-0.014, 0.01, -0.018, 0.012], recover: 9 }, sounds: cues('scout') },
	'warden-spark-carbine': { rate: 6, mag: 24, reload: 1.7, muzzle: [0.401, 0.117], vent: [0.1, 0.1, 0.045], flash: 'pulse', tint: 0xffb347, size: 0.11, recoil: { kick: 0.018, rise: 0.028, side: [0.006, -0.004, 0.008, -0.007, 0.003, -0.006], recover: 14 }, sounds: cues('pulse', 'charge') },
	'reedline-hunting-bow': { rate: 0.8, mag: 1, reload: 0.9, muzzle: [0.04, 0.02], flash: null, tint: 0xffffff, size: 0, recoil: { kick: 0.02, rise: 0.02, side: [0.004], recover: 8 }, sounds: { ...cues('bow'), out: 'aim', in: 'aim', ready: 'aim' } },
};
export const weaponOf = (id) => WEAPONS[id] || null;

// a hand's frame off a body (people/body.js), as a matrix (columns a, t, n at the palm)
const _w = new THREE.Vector3(), _k = new THREE.Vector3(), _i = new THREE.Vector3(), _l = new THREE.Vector3(), _a = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3();
export function handFrame(P, side, out = new THREE.Matrix4(), boneWorld = null) {
	const B = (name, v) => { const i = P.map[name + '.' + side]; if (i === undefined) return null; return boneWorld ? v.setFromMatrixPosition(boneWorld(i)) : P.bones[i].getWorldPosition(v); };
	if (!B('wrist', _w) || !B('finger3-1', _k) || !B('finger2-1', _i) || !B('finger5-1', _l)) return null;
	_a.subVectors(_k, _w).normalize();
	_t.subVectors(_i, _l); _t.addScaledVector(_a, -_t.dot(_a)).normalize();
	if (side === 'R') _n.crossVectors(_t, _a); else _n.crossVectors(_a, _t);
	// the palm's centre: between the wrist and the knuckles, a little in from the back of the hand
	_k.lerp(_w, 0.45).addScaledVector(_n, 0.012);
	return out.makeBasis(_a, _t, _n).setPosition(_k);
}

// ---------- models ----------
// Legendary: a few motes of light drifting round the item
let moteTex = null;
const moteMats = [];
function motes(t, n = 14) {
	const pos = new Float32Array(n * 3);
	for (let k = 0; k < n; k++) { const a = hash(k, 1, 5) * Math.PI * 2, y = (hash(k, 2, 5) - 0.5) * 0.3, d = 0.06 + hash(k, 3, 5) * 0.08; pos.set([0.2 + Math.cos(a) * d, 0.1 + y, Math.sin(a) * d], k * 3); }
	const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	if (!moteTex) {
		const c = document.createElement('canvas'); c.width = c.height = 32;
		const x = c.getContext('2d'), r = x.createRadialGradient(16, 16, 0, 16, 16, 16);
		r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
		x.fillStyle = r; x.fillRect(0, 0, 32, 32); moteTex = new THREE.CanvasTexture(c);
	}
	moteMats[t] ||= new THREE.PointsMaterial({ map: moteTex, color: TIERS[t].color, size: 0.02, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
	const p = new THREE.Points(g, moteMats[t]);
	p.name = 'motes';
	return p;
}
const cache = new Map();
function built(id, t, band, lod) {
	const key = `${id}:${t}:${band}:${lod}`;
	if (!cache.has(key)) {
		const k = new Kit(lod !== 'low');
		BUILD[id](k, finish(t, band));
		cache.set(key, k.build());
	}
	return cache.get(key);
}
// a fresh copy (sharing geometry and materials) of an item at a level and tier, or null
export function itemModel(id, { level = 1, tier = 0, lod = 'high', plain = false } = {}) {
	if (!BUILD[id]) return null;
	const t = Math.max(0, Math.min(4, tier | 0)), l = Math.max(1, Math.min(10, level | 0)), band = l >= 7 ? 2 : l >= 4 ? 1 : 0;
	const B = built(id, t, band, lod), g = new THREE.Group();
	const body = new THREE.Mesh(B.g, kitMaterial(plain));
	body.name = 'body';
	g.add(body);
	if (B.cell) { const c = new THREE.Mesh(B.cell, kitMaterial(plain)); c.name = 'cell'; c.position.set(...B.cellAt); g.add(c); }
	for (const L of B.lens) { const m = new THREE.Mesh(L.g, lensMaterial(L.reticle, plain, L.dot)); m.renderOrder = 2; m.name = 'glass'; g.add(m); }
	if (t === 4 && lod !== 'low') g.add(motes(t));
	g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; });
	g.name = 'held:' + id;
	g.userData = { id, long: holdOf(id).kind === 'long', tier: t, level: l, hold: holdOf(id) };
	return g;
}
// triangles in a model, for budgets
export function triangles(o) { let n = 0; o.traverse((x) => { if (x.isMesh) n += (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3; }); return Math.round(n); }
export function spinMotes(model, time) { const m = model?.getObjectByName('motes'); if (m) { m.rotation.x = time * 0.8; m.position.y = Math.sin(time * 1.3) * 0.01; } }

// ---------- in a body's hands (third person: yours and your friends') ----------
const _h = new THREE.Matrix4(), _h2 = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _o = new THREE.Vector3(), _o2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
// the carry for a long arm (people/actions.js 'carry'), or nothing
const CARRY = { long: 'carry', bow: null, one: null };
// the cell's way out and back in over a reload's progress u (item space, from where it sits);
// null while it is gone (out of view, a fresh one in hand)
export function cellPath(u, out = new THREE.Vector3()) {
	if (u < 0.22 || u >= 0.86) return out.set(0, 0, 0);
	if (u < 0.42) { const k = (u - 0.22) / 0.2; return out.set(0.02 * k, -0.32 * k * k, -0.04 * k); }
	if (u < 0.62) return null;
	const k = 1 - (u - 0.62) / 0.24, e = k * k * (3 - 2 * k);
	return out.set(0.01 * e, -0.22 * e, -0.05 * e);
}
// how a long arm tips toward the support hand through a reload (0..1)
export const reloadTilt = (u) => Math.min(1, u / 0.15, (1 - u) / 0.12);

export function createHand(scene, { lod = 'high' } = {}) {
	let key = '', model = null, gripped = null, flash = null, kick = 0, reload = null, held = false;
	const rel = new THREE.Matrix4(), cellV = new THREE.Vector3();
	function set(id, level = 1, tier = 0) {
		const k = id ? `${id}:${level}:${tier}` : '';
		if (k === key) return;
		if (model) model.parent?.remove(model);
		key = k; model = id ? itemModel(id, { level, tier, lod }) : null;
		reload = null; held = false;
		if (model) { model.matrixAutoUpdate = false; scene.add(model); flash = createFlash(model); }
	}
	// let a body go: hands open, the carry ended
	function release() {
		if (gripped) { gripped.grip?.('R', 0); gripped.grip?.('L', 0); if (gripped.S?.act?.name === 'carry') gripped.act(null); }
		gripped = null;
	}
	const hide = () => { if (model) model.visible = false; };
	// P: a people/body.js person, Mo its motion (people/motion.js)
	function follow(P, heading, visible = true, Mo = null, time = 0, dt = 1 / 60) {
		if (Mo !== gripped) release();
		const H = model?.userData.hold, on = !!(model && visible && P && P.root.visible);
		if (Mo) {
			gripped = Mo;
			const side = H?.side || 'R';
			Mo.grip?.('R', on && side === 'R' ? 1 : 0);
			Mo.grip?.('L', on && (H?.L) ? 1 : 0);
			const want = on ? CARRY[H.kind] : null, name = Mo.S.act.name;
			if (want && (!name || name === want)) { if (name !== want) Mo.act(want, 0); }
			else if (!want && name === 'carry') Mo.act(null);
		}
		if (!model) return;
		if (model.parent !== scene) scene.add(model);
		model.visible = on;
		if (!on) return;
		P.root.updateMatrixWorld(true);
		const side = H.side || 'R', G = H[side];
		if (!handFrame(P, side, _h)) { model.visible = false; return; }
		// the item where the hand holds it
		model.matrix.multiplyMatrices(_h, _inv.copy(G.m).invert());
		if (H.kind === 'long' && reload && held) {
			// mid-reload the support hand is away: kept as it lay in the grip hand
			model.matrix.multiplyMatrices(_h, rel);
		} else if (H.kind === 'long' && handFrame(P, 'L', _h2)) {
			// both hands on it: the muzzle laid along the line from the grip to the support hand,
			// rolled by the grip hand
			_o.setFromMatrixPosition(_h); _o2.setFromMatrixPosition(_h2);
			const v = _x.subVectors(_o2, _o).normalize(), vi = _y.subVectors(H.L.o, G.o).normalize();
			const iq = new THREE.Quaternion().setFromUnitVectors(vi, new THREE.Vector3(1, 0, 0));
			const thumb = _z.setFromMatrixColumn(_h, 1);
			const up = thumb.addScaledVector(v, -thumb.dot(v)).normalize(), side3 = new THREE.Vector3().crossVectors(v, up);
			const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v, up, side3)).multiply(iq);
			const pos = _o.clone().sub(G.o.clone().applyQuaternion(q));
			model.matrix.compose(pos, q, _s.set(1, 1, 1));
			rel.multiplyMatrices(_inv.copy(_h).invert(), model.matrix); held = true;
		} else if (H.level) {
			// a hanging thing stays upright, turned the way the hand points
			const o = _o.setFromMatrixPosition(_h), f = _x.setFromMatrixColumn(_h, 1);
			f.y = 0;
			if (f.lengthSq() < 1e-4) f.set(Math.sin(heading), 0, Math.cos(heading));
			f.normalize();
			const r = _z.crossVectors(f, UP);
			const q = new THREE.Quaternion().setFromRotationMatrix(_h2.makeBasis(f, UP, r));
			model.matrix.compose(o.sub(G.c.clone().applyQuaternion(q)), q, _s.set(1, 1, 1));
		}
		// used: a kick back and up, settling
		if (kick > 0) {
			const W = weaponOf(model.userData.id), k = kick / 0.14;
			kick = Math.max(0, kick - dt);
			if (W) model.matrix.multiply(_inv.makeRotationZ(W.recoil.rise * 1.5 * k)).multiply(_h2.makeTranslation(-W.recoil.kick * 1.5 * k, 0, 0));
		}
		// reloading: the cell out and a fresh one in
		const cell = model.getObjectByName('cell');
		if (reload) {
			reload.t += dt;
			const u = Math.min(1, reload.t / reload.T), at = cellPath(u, cellV);
			if (cell) { cell.visible = !!at; if (at) cell.position.fromArray(cell.userData.home ||= cell.position.toArray()).add(at); }
			if (u >= 1) { const d = reload.done; reload = null; d?.(); }
		}
		flash?.update(dt);
		model.matrixWorldNeedsUpdate = true;
		spinMotes(model, time);
		kitTick(time);
	}
	function dispose() { release(); set(null); }
	// used: the kick, the flash, its sound (distance: metres from whoever listens; null for silence)
	function fire(distance = 3) {
		const W = model && weaponOf(model.userData.id);
		if (!W || reload) return false;
		kick = 0.14;
		if (W.flash) { const [x, y] = W.muzzle; flash.sprite.position.set(x + 0.03, y, 0); flash.fire(W.flash, W.tint, W.size * 1.6); }
		if (distance != null) playCue(W.sounds.fire, { distance });
		return true;
	}
	// a reload in the hands (the body's 'reload' action shows the support hand at work)
	function reloadNow(done = null, distance = 3) {
		const W = model && weaponOf(model.userData.id);
		if (!W || reload) return false;
		reload = { t: 0, T: W.reload, done };
		gripped?.play?.('reload', W.reload, true);
		if (distance != null) { playCue(W.sounds.out, { distance }); setTimeout(() => playCue(W.sounds.in, { distance }), W.reload * 700); }
		return true;
	}
	// where it fires from and which way, in the world
	function muzzle() {
		const W = model?.visible && weaponOf(model.userData.id);
		if (!W) return null;
		return { position: new THREE.Vector3(W.muzzle[0], W.muzzle[1], 0).applyMatrix4(model.matrix), direction: new THREE.Vector3(1, 0, 0).transformDirection(model.matrix) };
	}
	// numbers for checks: the muzzle against the way the body faces, each palm against its grip
	function info(P, heading) {
		if (!model?.visible || !P) return null;
		const H = model.userData.hold, f = new THREE.Vector3(1, 0, 0).transformDirection(model.matrix), r3 = (x) => +x.toFixed(3);
		const out = { id: model.userData.id, muzzle: f.toArray().map(r3), muzzleDotAhead: r3(f.x * Math.sin(heading) + f.z * Math.cos(heading)), up: r3(new THREE.Vector3(0, 1, 0).transformDirection(model.matrix).y) };
		for (const side of ['L', 'R']) if (H[side] && handFrame(P, side, _h2)) out['palm' + side + 'mm'] = +(_o.setFromMatrixPosition(_h2).distanceTo(H[side].o.clone().applyMatrix4(model.matrix)) * 1000).toFixed(1);
		return out;
	}
	return { set, follow, release, hide, info, fire, reload: reloadNow, muzzle, dispose, get model() { return model; }, get reloading() { return !!reload; } };
}
