// The Boardwalk's toolbox: its frame on the map, the paints, a merger that folds a whole
// structure into one mesh per paint, the timbers and bulbs as instances, painted signs,
// and the rider's seat (the × to get off, the drag to look round, a stick to steer).
//
// Everything at the Boardwalk is built in its own frame: u along the promenade (west to
// east, about sixteen degrees north of east, the way Main Beach runs), v out to sea, y the
// height above the sea. The whole park hangs off one group turned into that frame.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toWorld } from '../geo.js';

// the front edge of the promenade, halfway along (the Casino at the west end by Cliff
// Street, the Giant Dipper at the east end short of the river)
const O = toWorld(36.96354, -122.01674);
export const FRAME = { x: O.x, z: O.z, a: 16 * Math.PI / 180 };
const CA = Math.cos(FRAME.a), SA = Math.sin(FRAME.a);
export const toW = (u, v) => [FRAME.x + u * CA + v * SA, FRAME.z - u * SA + v * CA];
export const toL = (x, z) => { const dx = x - FRAME.x, dz = z - FRAME.z; return [dx * CA - dz * SA, dx * SA + dz * CA]; };
// the promenade's level, and the midway behind it
export const DECK = 3.0;

export const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- paints ----------
const PAINT = {
	white: [0xf2efe6, 0.7], cream: [0xeee0bf, 0.75], stucco: [0xe9d9bb, 0.9], stuccoPink: [0xe7c3aa, 0.9], trim: [0xfaf6ea, 0.6],
	red: [0xb3202a, 0.45], darkred: [0x7a1a1c, 0.6], tile: [0xa9502f, 0.8], green: [0x2e6b4e, 0.6], teal: [0x1e8c8c, 0.5], blue: [0x2656a8, 0.5],
	yellow: [0xf2c230, 0.5], orange: [0xe8742a, 0.5], purple: [0x6a3c9a, 0.5], pink: [0xe86aa0, 0.5],
	steel: [0x8a9096, 0.45, 0.6], darksteel: [0x3a3f45, 0.5, 0.5], chrome: [0xd8dde2, 0.2, 0.9], brass: [0xc9a449, 0.3, 0.85], gold: [0xd4a93a, 0.35, 0.7],
	wood: [0x8a6a48, 0.85], plank: [0xa98a64, 0.9], darkwood: [0x4a3526, 0.8], concrete: [0xb9b3a8, 0.95], asphalt: [0x3d3d3f, 0.95],
	black: [0x151515, 0.6], rubber: [0x1c1c1e, 0.9], glass: [0x3a5561, 0.1, 0.3], canvasRed: [0xc8323a, 0.85], canvasWhite: [0xf4f1ea, 0.85],
	tunnel: [0x2b2723, 0.95], mirror: [0xcfd6dc, 0.05, 1], sand: [0xd9c79f, 1], seat: [0x8f1f22, 0.6],
};
const mats = new Map();
export function paint(key) {
	if (mats.has(key)) return mats.get(key);
	const p = PAINT[key] || [0xff00ff, 0.5];
	const m = new THREE.MeshStandardMaterial({ color: p[0], roughness: p[1], metalness: p[2] || 0 });
	m.name = 'bw-' + key;
	mats.set(key, m);
	return m;
}

// ---------- the merger: many parts, one mesh per paint ----------
const TMP = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
export function merger() {
	const by = new Map();
	const put = (geo, m, key) => { geo.applyMatrix4(m); (by.get(key) || by.set(key, []).get(key)).push(geo); };
	const M = {
		// a geometry placed by a matrix, or by position and turn
		geo(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { put(geo, TMP.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'YXZ')), S.set(1, 1, 1)), key); return M; },
		mat(geo, key, m) { put(geo, m, key); return M; },
		box(w, h, d, key, x, y, z, rx = 0, ry = 0, rz = 0) { return M.geo(new THREE.BoxGeometry(w, h, d), key, x, y, z, rx, ry, rz); },
		cyl(r0, r1, h, key, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0) { return M.geo(new THREE.CylinderGeometry(r0, r1, h, seg), key, x, y, z, rx, ry, rz); },
		// a timber from one point to another
		beam(a, b, w, key, d = w) { const g = new THREE.BoxGeometry(w, 1, d); put(g, beamMatrix(a, b, w, d, new THREE.Matrix4()), key); return M; },
		rod(a, b, r, key, seg = 6) { const g = new THREE.CylinderGeometry(r, r, 1, seg); put(g, beamMatrix(a, b, 1, 1, new THREE.Matrix4()), key); return M; },
		// into the group: one mesh per paint
		done(group, { shadow = true, receive = true, paints = {} } = {}) {
			const out = [];
			for (const [key, list] of by) {
				// (extrusions come unindexed: then all are)
				const flat = list.some((q) => !q.index) ? list.map((q) => q.index ? q.toNonIndexed() : q) : list;
				const g = mergeGeometries(flat, false);
				for (const q of list) q.dispose();
				if (!g) continue;
				g.computeBoundingSphere();
				const mesh = new THREE.Mesh(g, paints[key] || paint(key));
				mesh.castShadow = shadow; mesh.receiveShadow = receive;
				group.add(mesh); out.push(mesh);
			}
			by.clear();
			return out;
		},
	};
	return M;
}
// a unit box (w x 1 x d along y) stretched from a to b
const UP = new THREE.Vector3(0, 1, 0), DIR = new THREE.Vector3();
export function beamMatrix(a, b, w, d, m) {
	DIR.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	const L = DIR.length() || 1e-3;
	DIR.multiplyScalar(1 / L);
	Q.setFromUnitVectors(UP, DIR);
	return m.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), Q, S.set(1, L, 1));
}

// ---------- instances: timbers, ties, bulbs ----------
export function instancer(geo, material, { shadow = false } = {}) {
	const list = [], cols = [];
	const I = {
		add(m, col) { list.push(m.clone()); if (col) cols.push(col); return I; },
		beam(a, b, w, d = w) { list.push(beamMatrix(a, b, w, d, new THREE.Matrix4()).multiply(TMP.makeScale(w, 1, d))); return I; },
		at(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, col = null) { list.push(new THREE.Matrix4().compose(P.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), S.set(sx, sy, sz))); if (col) cols.push(col); return I; },
		get count() { return list.length; },
		done(group) {
			if (!list.length) return null;
			const im = new THREE.InstancedMesh(geo, material, list.length);
			list.forEach((m, i) => im.setMatrixAt(i, m));
			if (cols.length === list.length) cols.forEach((c, i) => im.setColorAt(i, c));
			im.castShadow = shadow; im.receiveShadow = true;
			im.computeBoundingSphere();
			group.add(im);
			return im;
		},
	};
	return I;
}

// the bulbs: little lamps by day, and after dark a warm glow round each (the Boardwalk's
// lights are what it is known for at night)
const BULB = { mat: null, glowMat: null, colour: new THREE.Color(), tex: null };
function glowTexture() {
	const cv = document.createElement('canvas'); cv.width = cv.height = 64;
	const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.18, 'rgba(255,215,150,0.8)'); gr.addColorStop(0.5, 'rgba(255,170,90,0.18)'); gr.addColorStop(1, 'rgba(255,150,80,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
export function bulbMaterials() {
	if (!BULB.mat) {
		BULB.mat = new THREE.MeshBasicMaterial({ color: 0xfff1cf, toneMapped: false });
		BULB.tex = glowTexture();
		BULB.glowMat = new THREE.PointsMaterial({ map: BULB.tex, size: 1.9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, opacity: 0, toneMapped: false, fog: true });
		BULB.glowMat.onBeforeCompile = minSize;
	}
	return BULB;
}
// (far off, a bulb is still a spark of a few pixels)
function minSize(sh) { sh.vertexShader = sh.vertexShader.replace('#include <logdepthbuf_vertex>', 'gl_PointSize = max(gl_PointSize, 3.0);\n#include <logdepthbuf_vertex>'); }
// the glow at other sizes, kept in step with the first
const SIZED = new Map();
function glowSized(size) {
	if (!SIZED.has(size)) { const m = BULB.glowMat.clone(); m.size = size * 1.7; m.onBeforeCompile = minSize; SIZED.set(size, m); }
	return SIZED.get(size);
}
// night: 0 by day, 1 after dark
export function setNight(k) {
	const B = bulbMaterials();
	B.mat.color.setRGB(0.78 + k * 1.6, 0.72 + k * 1.25, 0.58 + k * 0.7);
	for (const m of [B.glowMat, ...SIZED.values()]) { m.opacity = Math.min(1, k * 1.2); m.visible = k > 0.02; }
}
const BULB_GEO = new THREE.SphereGeometry(0.075, 6, 4);
export function bulbs() {
	const pos = [], col = [];
	const warm = [1, 0.85, 0.6];
	const L = {
		add(x, y, z, c = warm) { pos.push(x, y, z); col.push(c[0], c[1], c[2]); return L; },
		// a string of bulbs from a to b, every `step` metres
		line(a, b, step = 0.6, c) { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step)); for (let i = 0; i <= n; i++) { const t = i / n; L.add(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, c); } return L; },
		get count() { return pos.length / 3; },
		// size: how big the glow is; returns { mesh, glow } (the glow a points cloud)
		done(group, size = 1.1) {
			if (!pos.length) return null;
			const B = bulbMaterials(), n = pos.length / 3;
			const im = new THREE.InstancedMesh(BULB_GEO, B.mat, n);
			for (let i = 0; i < n; i++) im.setMatrixAt(i, TMP.makeTranslation(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
			im.computeBoundingSphere();
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
			g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
			const pm = size === 1.1 ? B.glowMat : glowSized(size);
			const glow = new THREE.Points(g, pm);
			glow.renderOrder = 3;
			group.add(im, glow);
			return { mesh: im, glow };
		},
	};
	return L;
}

// ---------- signs ----------
// painted letters on a board: { bg, fg, font, border, sub }
export function signTexture(text, { w = 1024, h = 256, bg = '#b3202a', fg = '#fff6dc', font = 'bold 150px Georgia, serif', border = '#f2c230', sub = null, subFont = '64px Georgia, serif', shadow = true } = {}) {
	const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
	const g = cv.getContext('2d');
	if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
	if (border) { g.strokeStyle = border; g.lineWidth = h * 0.05; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
	g.textAlign = 'center'; g.textBaseline = 'middle';
	g.font = font;
	let size = parseFloat(font.match(/(\d+)px/)[1]);
	while (g.measureText(text).width > w * 0.9 && size > 10) { size -= 4; g.font = font.replace(/\d+px/, size + 'px'); }
	if (shadow) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(text, w / 2 + 4, (sub ? h * 0.4 : h / 2) + 5); }
	g.fillStyle = fg; g.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
	if (sub) { g.font = subFont; g.fillStyle = fg; g.fillText(sub, w / 2, h * 0.76); }
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
// a sign board: a plane (both faces) with the letters, lit a little so it reads at dusk
export function signBoard(text, bw, bh, opts = {}) {
	const tex = signTexture(text, opts);
	const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: opts.glow ?? 0.15, transparent: !opts.bg && opts.bg !== undefined, side: THREE.DoubleSide });
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), m);
	mesh.userData.sign = m;
	return mesh;
}

// ---------- sweeping a section along a path (rails, handrails, the tunnel) ----------
// frames: [{ p: Vector3, t: tangent, n: up, b: side }]; the section's corners [side, up] offsets
export function sweep(frames, corners, closed = false) {
	const pos = [], nor = [], uv = [], idx = [];
	const nC = corners.length;
	let acc = 0;
	for (let i = 0; i < frames.length; i++) {
		const F = frames[i];
		if (i) acc += F.p.distanceTo(frames[i - 1].p);
		for (let c = 0; c < nC; c++) {
			const [sx, sy] = corners[c];
			pos.push(F.p.x + F.b.x * sx + F.n.x * sy, F.p.y + F.b.y * sx + F.n.y * sy, F.p.z + F.b.z * sx + F.n.z * sy);
			// the normal: out from the section's middle
			const cx = sx - corners.reduce((a, q) => a + q[0], 0) / nC, cy = sy - corners.reduce((a, q) => a + q[1], 0) / nC, l = Math.hypot(cx, cy) || 1;
			nor.push((F.b.x * cx + F.n.x * cy) / l, (F.b.y * cx + F.n.y * cy) / l, (F.b.z * cx + F.n.z * cy) / l);
			uv.push(c / nC, acc / 4);
		}
	}
	const ring = closed ? nC : nC - 1;
	for (let i = 0; i < frames.length - 1; i++) for (let c = 0; c < ring; c++) {
		const a = i * nC + c, b = i * nC + (c + 1) % nC, d = a + nC, e = b + nC;
		idx.push(a, d, b, b, d, e);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	return g;
}

