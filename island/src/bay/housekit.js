// The makings of a house up close: a geometry builder that sorts faces by material, the
// materials (painted on canvases at load, so nothing is downloaded), and the furniture,
// each piece drawn in its own frame (width along x, depth along z, front toward +z,
// standing on y = 0).

import * as THREE from 'three';
import { addLodFade, NONE_IN } from '../world/lodfade.js';
import { usePhoto } from '../world/photomats.js';

const lin = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
export { lin };

// ---------------------------------------------------------------------------------
// the builder: boxes, cylinders and spheres, placed by a quarter-turn transform

export class Builder {
	constructor() { this.bufs = new Map(); this.rot = 0; this.o = [0, 0, 0]; }
	at(x, y, z, rot = 0) { this.o = [x, y, z]; this.rot = ((rot % 4) + 4) % 4; return this; }
	buf(k) { let b = this.bufs.get(k); if (!b) this.bufs.set(k, b = { p: [], n: [], u: [], c: [] }); return b; }
	tp(x, y, z) {
		const [ox, oy, oz] = this.o;
		switch (this.rot) {
			case 1: return [ox + z, oy + y, oz - x];
			case 2: return [ox - x, oy + y, oz - z];
			case 3: return [ox - z, oy + y, oz + x];
			default: return [ox + x, oy + y, oz + z];
		}
	}
	tn(x, y, z) {
		switch (this.rot) {
			case 1: return [z, y, -x];
			case 2: return [-x, y, -z];
			case 3: return [-z, y, x];
			default: return [x, y, z];
		}
	}
	// a triangle pair; corners in order round the face, normal n (local)
	quad(k, a, b, c, d, n, col, uv) {
		if (!k) return;
		const B = this.buf(k), P = [a, b, c, d].map((p) => this.tp(...p)), N = this.tn(...n);
		// wind them to face along n
		const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
		const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
		const flip = cr[0] * N[0] + cr[1] * N[1] + cr[2] * N[2] < 0;
		const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
		for (const i of order) { B.p.push(...P[i]); B.n.push(...N); B.u.push(...uv[i]); B.c.push(...col); }
	}
	// an axis-aligned box; key: a material name, or f(face) -> name (or null to leave the
	// face out); faces 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z; col likewise may be f(face)
	box(key, x0, y0, z0, x1, y1, z1, col) {
		const K = typeof key === 'function' ? key : () => key, C = typeof col === 'function' ? col : () => col;
		const f = [
			[[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], (p) => [p[2], p[1]]],
			[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], (p) => [p[2], p[1]]],
			[[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], (p) => [p[0], p[2]]],
			[[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], (p) => [p[0], p[2]]],
			[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], (p) => [p[0], p[1]]],
			[[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], (p) => [p[0], p[1]]],
		];
		for (let i = 0; i < 6; i++) {
			const k = K(i);
			if (!k) continue;
			const [a, b, c, d, n, uvf] = f[i];
			this.quad(k, a, b, c, d, n, C(i), [a, b, c, d].map(uvf));
		}
	}
	// a cylinder along an axis ('y' up, 'x' or 'z'), centred at (x, z) on that axis' base
	cyl(key, x, y, z, r, h, col, seg = 10, axis = 'y', caps = true, r2 = r) {
		const P = (a, t, rr) => {
			const c = Math.cos(a) * rr, s = Math.sin(a) * rr;
			return axis === 'y' ? [x + c, y + t, z + s] : axis === 'x' ? [x + t, y + c, z + s] : [x + c, y + s, z + t];
		};
		const Nn = (a) => { const c = Math.cos(a), s = Math.sin(a); return axis === 'y' ? [c, 0, s] : axis === 'x' ? [0, c, s] : [c, s, 0]; };
		for (let i = 0; i < seg; i++) {
			const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
			this.quad(key, P(a0, 0, r), P(a1, 0, r), P(a1, h, r2), P(a0, h, r2), Nn(am), col, [[i / seg, 0], [(i + 1) / seg, 0], [(i + 1) / seg, h], [i / seg, h]]);
			if (caps) {
				const up = axis === 'y' ? [0, 1, 0] : axis === 'x' ? [1, 0, 0] : [0, 0, 1];
				const c1 = axis === 'y' ? [x, y + h, z] : axis === 'x' ? [x + h, y, z] : [x, y, z + h];
				const c0 = axis === 'y' ? [x, y, z] : axis === 'x' ? [x, y, z] : [x, y, z];
				this.quad(key, c1, P(a0, h, r2), P(a1, h, r2), c1, up, col, [[0.5, 0.5], [0, 0], [1, 0], [0.5, 0.5]]);
				this.quad(key, c0, P(a1, 0, r), P(a0, 0, r), c0, up.map((v) => -v), col, [[0.5, 0.5], [0, 0], [1, 0], [0.5, 0.5]]);
			}
		}
	}
	// a square bar from p0 to p1 at any slope (handrails), a wide by b high
	beam(key, p0, p1, a, b, col) {
		const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.hypot(...d);
		const t = d.map((v) => v / L), up = Math.abs(t[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
		const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
		const nz = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
		const sd = nz(cr(t, up)), u2 = nz(cr(sd, t));
		const P = (e, i, j) => [0, 1, 2].map((k) => e[k] + sd[k] * a / 2 * i + u2[k] * b / 2 * j);
		const faces = [[sd, [1, -1], [1, 1]], [sd.map((v) => -v), [-1, 1], [-1, -1]], [u2, [1, 1], [-1, 1]], [u2.map((v) => -v), [-1, -1], [1, -1]]];
		for (const [n, [i0, j0], [i1, j1]] of faces) this.quad(key, P(p0, i0, j0), P(p1, i0, j0), P(p1, i1, j1), P(p0, i1, j1), n, col, [[0, 0], [L, 0], [L, 1], [0, 1]]);
	}
	sphere(key, x, y, z, rx, ry, rz, col, seg = 8) {
		const V = (i, j) => { const a = i / seg * Math.PI * 2, b = j / (seg / 2) * Math.PI - Math.PI / 2; return [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)]; };
		for (let j = 0; j < seg / 2; j++) for (let i = 0; i < seg; i++) {
			const q = [V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1)];
			const m = q.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]);
			const L = Math.hypot(...m) || 1;
			this.quad(key, ...q.map((v) => [x + v[0] * rx, y + v[1] * ry, z + v[2] * rz]), [m[0] / L, m[1] / L, m[2] / L], col, [[0, 0], [1, 0], [1, 1], [0, 1]]);
		}
	}
	// the finished meshes, one per material
	meshes(mats, shadows = true) {
		const out = [];
		for (const [k, b] of this.bufs) {
			if (!b.p.length || !mats[k]) continue;
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
			g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
			g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
			g.computeBoundingSphere();
			const m = new THREE.Mesh(g, mats[k]);
			m.castShadow = shadows && !mats[k].transparent; m.receiveShadow = true;
			m.name = k;
			out.push(m);
		}
		return out;
	}
}

// ---------------------------------------------------------------------------------
// materials, painted at load

function cv(S, draw, repeat = true, srgb = true) {
	const c = document.createElement('canvas');
	c.width = c.height = S;
	draw(c.getContext('2d'), S);
	const t = new THREE.CanvasTexture(c);
	if (srgb) t.colorSpace = THREE.SRGBColorSpace;
	if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = 8;
	return t;
}
function prng(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
const grey = (l, a = 1) => `rgba(${l | 0},${l | 0},${l | 0},${a})`;

function textures() {
	const T = {};
	// stucco: a fine sand float finish with a few trowel sweeps
	T.stucco = cv(256, (g, S) => {
		const r = prng(3);
		g.fillStyle = grey(236); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 9000; i++) { g.fillStyle = grey(200 + r() * 55, 0.35); g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
		for (let i = 0; i < 40; i++) { g.strokeStyle = grey(255, 0.08); g.lineWidth = 6 + r() * 14; g.beginPath(); const x = r() * S, y = r() * S; g.arc(x, y, 20 + r() * 50, r() * 6, r() * 6 + 1.5); g.stroke(); }
	});
	// painted drywall: almost nothing, a faint orange-peel
	T.paint = cv(128, (g, S) => {
		const r = prng(5);
		g.fillStyle = grey(246); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 2500; i++) { g.fillStyle = grey(236 + r() * 19, 0.4); g.fillRect(r() * S, r() * S, 1, 1); }
	});
	// oak planks, random lengths, four boards across 0.5 m
	T.wood = cv(512, (g, S) => {
		const r = prng(11), bw = S / 4;
		for (let x = 0; x < 4; x++) {
			let y = -r() * S;
			while (y < S) {
				const L = S * (0.35 + r() * 0.6), l = 0.82 + r() * 0.3;
				g.fillStyle = `rgb(${190 * l | 0},${142 * l | 0},${96 * l | 0})`; g.fillRect(x * bw, y, bw, L);
				for (let k = 0; k < 22; k++) { g.strokeStyle = `rgba(${90 + r() * 40 | 0},${60 + r() * 30 | 0},${35 | 0},${0.12 + r() * 0.15})`; g.lineWidth = 0.6 + r(); g.beginPath(); const xx = x * bw + r() * bw; g.moveTo(xx, y); g.bezierCurveTo(xx + (r() - 0.5) * 12, y + L / 3, xx + (r() - 0.5) * 12, y + L * 0.66, xx + (r() - 0.5) * 6, y + L); g.stroke(); }
				g.fillStyle = 'rgba(40,25,15,0.55)'; g.fillRect(x * bw, y, bw, 1.5);
				y += L;
			}
			g.fillStyle = 'rgba(40,25,15,0.5)'; g.fillRect(x * bw, 0, 1.5, S);
		}
	});
	// wall-to-wall carpet
	T.carpet = cv(256, (g, S) => {
		const r = prng(17);
		g.fillStyle = grey(200); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 26000; i++) { g.fillStyle = grey(150 + r() * 100, 0.5); g.fillRect(r() * S, r() * S, 1, 1); }
	});
	// 12 inch ceramic tile with grout
	T.tile = cv(256, (g, S) => {
		const r = prng(23), n = 4, s = S / n;
		for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const l = 225 + r() * 20; g.fillStyle = grey(l); g.fillRect(i * s, j * s, s, s); for (let k = 0; k < 120; k++) { g.fillStyle = grey(l - 25 + r() * 30, 0.25); g.fillRect(i * s + r() * s, j * s + r() * s, 2, 2); } }
		g.fillStyle = grey(165); for (let i = 0; i <= n; i++) { g.fillRect(i * s - 1.5, 0, 3, S); g.fillRect(0, i * s - 1.5, S, 3); }
	});
	// small subway tile for the shower walls
	T.subway = cv(256, (g, S) => {
		g.fillStyle = grey(245); g.fillRect(0, 0, S, S);
		g.fillStyle = grey(190);
		for (let j = 0; j < 8; j++) { g.fillRect(0, j * 32, S, 2); for (let i = 0; i < 5; i++) g.fillRect(((i + (j % 2) * 0.5) * 64) % S, j * 32, 2, 32); }
	});
	// garage slab: trowelled concrete with stains
	T.concrete = cv(256, (g, S) => {
		const r = prng(29);
		g.fillStyle = grey(190); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 6000; i++) { g.fillStyle = grey(150 + r() * 80, 0.25); g.fillRect(r() * S, r() * S, 2, 2); }
		for (let i = 0; i < 8; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(60,55,50,0.25)'); gr.addColorStop(1, 'rgba(60,55,50,0)'); g.save(); g.translate(r() * S, r() * S); g.fillStyle = gr; g.fillRect(-30, -30, 60, 60); g.restore(); }
	});
	// woven upholstery
	T.fabric = cv(128, (g, S) => {
		const r = prng(31);
		g.fillStyle = grey(220); g.fillRect(0, 0, S, S);
		for (let y = 0; y < S; y += 2) { g.fillStyle = grey(190 + r() * 40, 0.5); g.fillRect(0, y, S, 1); }
		for (let x = 0; x < S; x += 2) { g.fillStyle = grey(200 + r() * 40, 0.35); g.fillRect(x, 0, 1, S); }
	});
	// furniture wood: straight grain
	T.grain = cv(256, (g, S) => {
		const r = prng(37);
		g.fillStyle = grey(200); g.fillRect(0, 0, S, S);
		for (let k = 0; k < 90; k++) { g.strokeStyle = grey(120 + r() * 70, 0.25); g.lineWidth = 0.5 + r() * 2; g.beginPath(); const y = r() * S; g.moveTo(0, y); for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x / 40 + k) * 3); g.stroke(); }
	});
	// a six-panel door, to be mapped once over the leaf
	T.door6 = cv(256, (g, S) => {
		g.fillStyle = grey(240); g.fillRect(0, 0, S, S);
		const panel = (x, y, w, h) => { g.fillStyle = grey(222); g.fillRect(x, y, w, h); g.fillStyle = grey(200); g.fillRect(x, y, w, 3); g.fillRect(x, y, 3, h); g.fillStyle = grey(252); g.fillRect(x, y + h - 3, w, 3); g.fillRect(x + w - 3, y, 3, h); };
		for (const [y, h] of [[0.05, 0.16], [0.26, 0.3], [0.62, 0.3]]) { panel(S * 0.12, S * y, S * 0.33, S * h); panel(S * 0.55, S * y, S * 0.33, S * h); }
	}, false);
	// a sectional garage door, raised panels
	T.garage = cv(256, (g, S) => {
		g.fillStyle = grey(238); g.fillRect(0, 0, S, S);
		for (let j = 0; j < 4; j++) {
			g.fillStyle = grey(175); g.fillRect(0, j * S / 4, S, 3);
			for (let i = 0; i < 8; i++) { const x = i * S / 8 + 5, y = j * S / 4 + 10, w = S / 8 - 10, h = S / 4 - 20; g.fillStyle = grey(225); g.fillRect(x, y, w, h); g.fillStyle = grey(205); g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h); g.fillStyle = grey(250); g.fillRect(x, y, w, 2); }
		}
	}, false);
	// stone countertop: speckled granite / quartz
	T.stone = cv(256, (g, S) => {
		const r = prng(41);
		g.fillStyle = grey(200); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 9000; i++) { const l = r(); g.fillStyle = l < 0.15 ? grey(60, 0.8) : l < 0.3 ? grey(250, 0.7) : grey(150 + r() * 70, 0.5); g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
	});
	// horizontal blinds
	T.blinds = cv(64, (g, S) => {
		for (let y = 0; y < S; y += 8) { const gr = g.createLinearGradient(0, y, 0, y + 8); gr.addColorStop(0, grey(255)); gr.addColorStop(0.8, grey(215)); gr.addColorStop(1, grey(150)); g.fillStyle = gr; g.fillRect(0, y, S, 8); }
	});
	// a rug: a border and a pattern field
	T.rug = cv(256, (g, S) => {
		const r = prng(43);
		g.fillStyle = grey(200); g.fillRect(0, 0, S, S);
		g.fillStyle = grey(120); g.fillRect(8, 8, S - 16, S - 16);
		g.fillStyle = grey(225); g.fillRect(20, 20, S - 40, S - 40);
		for (let i = 0; i < 30; i++) { g.fillStyle = grey(130 + r() * 110, 0.6); g.save(); g.translate(S / 2, S / 2); g.rotate(r() * 6); g.fillRect(-r() * 90, -r() * 90, 6 + r() * 30, 6 + r() * 30); g.restore(); }
		for (let i = 0; i < 9000; i++) { g.fillStyle = grey(r() * 255, 0.08); g.fillRect(r() * S, r() * S, 1, 1); }
	}, false);
	return T;
}

// what shiny things inside reflect: a pale ceiling, warm walls, a darker floor
function roomEnv() {
	const W = 64, H = 32, d = new Uint8Array(W * H * 4);
	for (let y = 0; y < H; y++) {
		const v = y / (H - 1);
		const c = v < 0.3 ? [246, 244, 238] : v < 0.62 ? [214 - (v - 0.3) * 60, 206 - (v - 0.3) * 60, 192 - (v - 0.3) * 60] : [120, 96, 72];
		for (let x = 0; x < W; x++) { const win = v > 0.35 && v < 0.55 && (x % 21) < 6 ? 1.25 : 1; d.set([Math.min(255, c[0] * win), Math.min(255, c[1] * win), Math.min(255, c[2] * win * 1.05), 255], (y * W + x) * 4); }
	}
	const t = new THREE.DataTexture(d, W, H);
	t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
	return t;
}

// the materials a house is made of; the dissolve with the far building goes on each
export function houseMaterials(band, night) {
	const T = textures();
	// texture scales: the builder's uvs are metres
	const rep = (t, m) => { t.repeat.set(1 / m, 1 / m); };
	rep(T.stucco, 1.6); rep(T.paint, 1.2); rep(T.wood, 1.0); rep(T.carpet, 1.2); rep(T.tile, 1.2); rep(T.subway, 0.6); rep(T.concrete, 2.4); rep(T.fabric, 0.3); rep(T.grain, 0.6); rep(T.stone, 0.8); rep(T.blinds, 0.2);
	T.door6.repeat.set(1 / 0.84, 1 / 2.05); T.garage.repeat.set(1 / 2.46, 1 / 2.15); T.garage.wrapS = T.garage.wrapT = THREE.RepeatWrapping;
	T.rug.wrapS = T.rug.wrapT = THREE.RepeatWrapping; T.rug.repeat.set(0.5, 0.6); T.rug.offset.set(0.5, 0.5);
	const env = roomEnv();
	const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
	const M = {
		stucco: std({ map: T.stucco, roughness: 0.95 }),
		paint: std({ map: T.paint, roughness: 0.9, emissive: 0x22211e }),
		trim: std({ roughness: 0.42 }),
		ceiling: std({ map: T.paint, roughness: 0.95, emissive: 0x4a4945 }),
		// the rooms with a light on after dark: walls and ceiling warm with it
		paintLit: std({ map: T.paint, roughness: 0.9, emissive: 0xffc890 }),
		ceilingLit: std({ map: T.paint, roughness: 0.95, emissive: 0xffd6a8 }),
		wood: std({ map: T.wood, roughness: 0.45 }),
		carpet: std({ map: T.carpet, roughness: 1 }),
		tile: std({ map: T.tile, roughness: 0.3 }),
		subway: std({ map: T.subway, roughness: 0.2 }),
		concrete: std({ map: T.concrete, roughness: 0.9 }),
		fabric: std({ map: T.fabric, roughness: 0.95 }),
		grain: std({ map: T.grain, roughness: 0.55 }),
		matte: std({ roughness: 0.8 }),
		gloss: std({ roughness: 0.18, envMap: env, envMapIntensity: 0.6 }),
		metal: std({ roughness: 0.3, metalness: 0.85, envMap: env }),
		stone: std({ map: T.stone, roughness: 0.25, envMap: env, envMapIntensity: 0.4 }),
		door6: std({ map: T.door6, roughness: 0.45 }),
		garage: std({ map: T.garage, roughness: 0.5 }),
		blinds: std({ map: T.blinds, roughness: 0.6, side: THREE.DoubleSide }),
		rug: std({ map: T.rug, roughness: 1 }),
		mirror: std({ roughness: 0.02, metalness: 1, envMap: env }),
		glass: new THREE.MeshStandardMaterial({ color: 0x9fb4bd, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
		frost: new THREE.MeshStandardMaterial({ color: 0xe8eeef, roughness: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
		// lamp shades and fixtures, lit at night
		lamp: std({ roughness: 0.7, emissive: 0xffd7a0, emissiveIntensity: 0 }),
	};
	M.lamp.userData.night = true;
	for (const m of Object.values(M)) addLodFade(m, 'uniform', band || [NONE_IN[0], NONE_IN[1], 36, 46]);
	// by night the lamps glow and the walls lose the daylight they had from the windows
	// (seen from outside, with no lamps of its own to light it, a lit room glows brighter)
	M.setNight = (k, indoors = false) => {
		M.lamp.emissiveIntensity = k * 1.6;
		M.ceiling.emissiveIntensity = M.paint.emissiveIntensity = 1 - k * 0.6;
		M.paintLit.emissiveIntensity = 0.13 * (1 - k) + (indoors ? 0.16 : 0.42) * k; M.ceilingLit.emissiveIntensity = 0.26 * (1 - k) + (indoors ? 0.24 : 0.55) * k;
	};
	M.setNight(night || 0);
	// the photographic materials, as they arrive: for each material the swatches to try in
	// turn, [name, metres a tile covers, detail options, relief]; the house atlases first
	// when they exist (ASSET_PROMPTS_HOUSES.md), then the build 191/193 ones
	const plaster = (mean, contrast, normal, ns) => ['plaster', 1.6, { mean, contrast, normal }, ns];
	const wall = [['drywall', 1.2, { mean: 0.96, contrast: 0.6, normal: 2 }, 0.3], plaster(0.96, 0.12, 1.5, 0.25)];
	for (const [k, choices] of [
		['stucco', [['stucco', 1.5, { mean: 0.92, contrast: 1, normal: 3 }, 0.8], ['plaster', 1.4, { mean: 0.92, contrast: 0.9, normal: 3 }, 0.8]]],
		['paint', wall], ['paintLit', wall], ['ceiling', wall], ['ceilingLit', wall],
		['wood', [['oak', 1.0, { mean: 0.85, contrast: 1, normal: 2 }, 0.35], ['cedar', 1.2, { mean: 0.85, contrast: 1.1, normal: 2 }, 0.4]]],
		['grain', [['walnut', 0.5, { mean: 0.78, contrast: 1.3, normal: 1.5 }, 0.3]]],
		['fabric', [['linen', 0.35, { mean: 0.9, contrast: 1, normal: 4 }, 0.5]]],
		['carpet', [['carpet', 1.0, { mean: 0.88, contrast: 1, normal: 3 }, 0.6], ['suede', 0.6, { mean: 0.88, contrast: 1.2, normal: 3 }, 0.6]]],
		['tile', [['floorTile', 1.0, { mean: 0.9, contrast: 1, normal: 2 }, 0.4]]],
		['subway', [['subway', 1.0, { mean: 0.93, contrast: 1, normal: 2 }, 0.4]]],
		['stone', [['quartz', 0.8, { mean: 0.88, contrast: 1, normal: 1 }, 0.15], ['granite', 0.7, { mean: 0.8, contrast: 1.2, normal: 1 }, 0.2]]],
		['metal', [['aluminium', 0.8, { mean: 0.85, contrast: 0.8 }, 0]]],
		['gloss', [['enamel', 0.6, { mean: 0.95, contrast: 0.35 }, 0]]],
		['concrete', [['slab', 1.2, { mean: 0.82, contrast: 1, normal: 2 }, 0.4], ['limestone', 2.0, { mean: 0.8, contrast: 0.7, normal: 2 }, 0.4]]],
	]) usePhoto(M[k], choices);
	return M;
}

// ---------------------------------------------------------------------------------
// furniture

const FABRIC = [[0.55, 0.55, 0.53], [0.72, 0.68, 0.6], [0.3, 0.34, 0.42], [0.36, 0.42, 0.36], [0.62, 0.4, 0.3], [0.82, 0.8, 0.76], [0.25, 0.25, 0.27], [0.5, 0.45, 0.55]];
const WOOD = [[0.55, 0.38, 0.24], [0.35, 0.23, 0.15], [0.72, 0.56, 0.38], [0.22, 0.16, 0.12], [0.62, 0.52, 0.42]];
const ACCENT = [[0.75, 0.3, 0.2], [0.85, 0.7, 0.3], [0.2, 0.4, 0.55], [0.3, 0.5, 0.35], [0.9, 0.9, 0.86], [0.55, 0.3, 0.45], [0.95, 0.6, 0.45]];
const pick = (l, v) => l[Math.floor(v * 9973) % l.length];
const WHITE = lin([0.92, 0.91, 0.88]), BLACK = lin([0.05, 0.05, 0.055]), STEEL = lin([0.75, 0.75, 0.76]), DARK = lin([0.12, 0.11, 0.1]);

function legs4(g, k, w, d, h, col, r = 0.02, inset = 0.05) {
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl(k, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), r, h, col, 6);
}
function books(g, x0, x1, y, z0, depth, rnd) {
	let x = x0;
	while (x < x1 - 0.03) {
		const t = 0.02 + rnd() * 0.035, h = 0.18 + rnd() * 0.12;
		if (rnd() < 0.12) { x += 0.05 + rnd() * 0.1; continue; }
		g.box('matte', x, y, z0, Math.min(x1, x + t), y + h, z0 + depth * (0.7 + rnd() * 0.25), lin(pick(ACCENT.concat(FABRIC), rnd()).map((c) => c * (0.6 + rnd() * 0.5))));
		x += t + 0.002;
	}
}
function tableLamp(g, x, y, z, rnd) {
	g.cyl('gloss', x, y, z, 0.07, 0.04, lin(pick(ACCENT, rnd())), 10);
	g.cyl('metal', x, y + 0.04, z, 0.012, 0.3, STEEL, 6, 'y', false);
	g.cyl('lamp', x, y + 0.28, z, 0.16, 0.2, lin([0.95, 0.92, 0.85]), 12, 'y', false, 0.11);
}
function plant(g, x, y, z, s, rnd) {
	g.cyl('matte', x, y, z, 0.16 * s, 0.32 * s, lin(rnd() < 0.5 ? [0.72, 0.42, 0.3] : [0.88, 0.87, 0.84]), 10, 'y', true, 0.19 * s);
	const n = 5 + Math.floor(rnd() * 4);
	for (let i = 0; i < n; i++) {
		const a = rnd() * 6.28, rr = rnd() * 0.12 * s;
		g.sphere('matte', x + Math.cos(a) * rr, y + (0.45 + rnd() * 0.6) * s, z + Math.sin(a) * rr, 0.14 * s + rnd() * 0.1 * s, 0.18 * s + rnd() * 0.12 * s, 0.14 * s + rnd() * 0.1 * s, lin([0.18 + rnd() * 0.1, 0.33 + rnd() * 0.12, 0.14 + rnd() * 0.06]), 10);
	}
}
// a dining chair at (x, z) in the current frame, turned rot more quarter turns
function chair(g, x, z, rot, wc, rnd) {
	const R = g.rot, O = g.o, p = g.tp(x, 0, z);
	g.at(p[0], p[1], p[2], R + rot);
	legs4(g, 'grain', 0.44, 0.44, 0.45, wc, 0.017, 0.03);
	g.box('grain', -0.22, 0.45, -0.22, 0.22, 0.49, 0.22, wc);
	g.box('fabric', -0.2, 0.49, -0.2, 0.2, 0.52, 0.2, lin(pick(FABRIC, rnd())));
	for (const sx of [-1, 1]) g.box('grain', sx * 0.2 - 0.02, 0.49, -0.22, sx * 0.2 + 0.02, 0.95, -0.18, wc);
	g.box('grain', -0.2, 0.78, -0.22, 0.2, 0.93, -0.19, wc);
	g.at(O[0], O[1], O[2], R);
}

// draws one item at (it.x, it.y, it.z) turned it.rot, into builder g
export function drawItem(g, it, rnd, H) {
	const { w, d, h } = it;
	const W2 = w / 2, D2 = d / 2;
	g.at(it.x, it.y, it.z, it.rot);
	const fab = lin(pick(FABRIC, it.v)), wd = lin(pick(WOOD, it.v * 7 % 1)), acc = lin(pick(ACCENT, it.v * 13 % 1));
	switch (it.type) {
		case 'sofa': case 'armchair': {
			const arm = 0.17, seatY = 0.42;
			for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cyl('grain', sx * (W2 - 0.08), 0, sz * (D2 - 0.08), 0.022, 0.1, DARK, 6);
			g.box('fabric', -W2, 0.1, -D2, W2, seatY - 0.08, D2, fab);
			g.box('fabric', -W2, 0.1, -D2, W2, h, -D2 + 0.22, fab);
			for (const sx of [-1, 1]) g.box('fabric', sx > 0 ? W2 - arm : -W2, 0.1, -D2, sx > 0 ? W2 : -W2 + arm, 0.64, D2, fab);
			const n = it.type === 'armchair' ? 1 : w > 1.9 ? 3 : 2, cw = (w - 2 * arm) / n;
			for (let i = 0; i < n; i++) {
				const x0 = -W2 + arm + i * cw + 0.008, x1 = x0 + cw - 0.016;
				g.box('fabric', x0, seatY - 0.08, -D2 + 0.22, x1, seatY + 0.06, D2 - 0.02, fab.map((c) => c * 1.04));
				g.box('fabric', x0, seatY + 0.06, -D2 + 0.14, x1, h + 0.04, -D2 + 0.34, fab.map((c) => c * 1.02));
			}
			if (it.type === 'sofa') for (const sx of [-1, 1]) g.box('fabric', sx * (W2 - arm - 0.05) - 0.2, seatY + 0.06, -D2 + 0.3, sx * (W2 - arm - 0.05) + 0.2, seatY + 0.44, -D2 + 0.44, acc);
			break;
		}
		case 'coffeeTable': case 'sideTable': {
			legs4(g, 'grain', w, d, h - 0.04, wd, 0.02);
			g.box('grain', -W2, h - 0.04, -D2, W2, h, D2, wd);
			if (it.type === 'coffeeTable') { g.box('grain', -W2 + 0.05, 0.12, -D2 + 0.05, W2 - 0.05, 0.14, D2 - 0.05, wd); books(g, -0.3, -0.05, h, -0.12, 0.2, rnd); g.cyl('gloss', 0.25, h, 0.02, 0.12, 0.06, acc, 12, 'y', true, 0.15); }
			else tableLamp(g, 0, h, 0, rnd);
			break;
		}
		case 'rug': g.box('rug', -W2, 0, -D2, W2, 0.008, D2, lin(pick(FABRIC.concat(ACCENT), it.v)).map((c) => c * 1.1)); break;
		case 'bathMat': g.box('fabric', -W2, 0, -D2, W2, 0.01, D2, acc); break;
		case 'tvConsole': {
			g.box('grain', -W2, 0.08, -D2, W2, h, D2, wd);
			for (const sx of [-1, 1]) g.box('grain', sx * W2 - 0.03, 0, -D2 + 0.03, sx * W2 + 0.03 * -sx, 0.08, D2 - 0.03, DARK);
			g.box('matte', -W2 + 0.02, 0.12, D2, W2 - 0.02, h - 0.04, D2 + 0.004, wd.map((c) => c * 0.8));
			const tw = Math.min(1.45, w - 0.2);
			g.box('matte', -0.15, h, -0.1, 0.15, h + 0.02, 0.08, BLACK);
			g.box('matte', -0.02, h + 0.02, -0.04, 0.02, h + 0.1, 0, BLACK);
			g.box('gloss', -tw / 2, h + 0.08, -0.06, tw / 2, h + 0.08 + tw * 0.56, -0.02, BLACK);
			plant(g, W2 - 0.18, h, 0, 0.5, rnd);
			break;
		}
		case 'bookcase': case 'shelf': case 'shelves': {
			const col = it.type === 'shelves' ? lin([0.35, 0.36, 0.38]) : it.type === 'shelf' ? WHITE : wd, k = it.type === 'shelves' ? 'metal' : 'grain';
			const n = it.type === 'bookcase' ? 5 : 4;
			for (const sx of [-1, 1]) g.box(k, sx > 0 ? W2 - 0.02 : -W2, 0, -D2, sx > 0 ? W2 : -W2 + 0.02, h, D2, col);
			if (it.type === 'bookcase') g.box(k, -W2, 0, -D2, W2, h, -D2 + 0.01, col);
			for (let i = 0; i < n; i++) {
				const y = 0.05 + i * (h - 0.08) / (n - 1);
				g.box(k, -W2, y - 0.02, -D2, W2, y, D2, col);
				if (i < n - 1) {
					if (it.type === 'bookcase') books(g, -W2 + 0.03, W2 - 0.03, y, -D2 + 0.02, d - 0.04, rnd);
					else for (let x = -W2 + 0.05; x < W2 - 0.3; x += 0.35 + rnd() * 0.2) if (rnd() < 0.75) g.box('matte', x, y, -D2 + 0.03, x + 0.28 + rnd() * 0.1, y + 0.15 + rnd() * 0.18, D2 - 0.03, lin(pick([[0.8, 0.7, 0.5], [0.2, 0.3, 0.6], [0.85, 0.85, 0.8], [0.3, 0.3, 0.32], [0.7, 0.2, 0.15]], rnd())));
				}
			}
			break;
		}
		case 'floorLamp': g.cyl('metal', 0, 0, 0, 0.14, 0.03, BLACK, 10); g.cyl('metal', 0, 0.03, 0, 0.012, 1.3, BLACK, 6, 'y', false); g.cyl('lamp', 0, 1.3, 0, 0.2, 0.28, lin([0.95, 0.92, 0.84]), 12, 'y', false, 0.15); break;
		case 'plant': plant(g, 0, 0, 0, h / 1.2, rnd); break;
		case 'diningTable': {
			legs4(g, 'grain', w, d, 0.72, wd, 0.03, 0.08);
			g.box('grain', -W2, 0.72, -D2, W2, 0.76, D2, wd);
			g.box('grain', -W2 + 0.06, 0.64, -D2 + 0.06, W2 - 0.06, 0.72, D2 - 0.06, wd);
			const n = it.chairs || 4, per = Math.ceil(n / 2);
			for (let i = 0; i < per; i++) {
				const x = -W2 + w * (i + 0.5) / per;
				chair(g, x, D2 + 0.12, 2, wd, rnd);
				if (i < n - per) chair(g, x, -D2 - 0.12, 0, wd, rnd);
			}
			g.cyl('gloss', 0, 0.76, 0, 0.16, 0.08, acc, 12, 'y', true, 0.2);
			break;
		}
		case 'sideboard': case 'console': case 'dresser': case 'nightstand': {
			const legH = it.type === 'console' ? h - 0.04 : 0.1;
			legs4(g, 'grain', w, d, legH, wd, 0.02);
			if (it.type === 'console') { g.box('grain', -W2, h - 0.04, -D2, W2, h, D2, wd); g.box('grain', -W2 + 0.04, 0.15, -D2 + 0.04, W2 - 0.04, 0.17, D2 - 0.04, wd); }
			else {
				g.box('grain', -W2, 0.1, -D2, W2, h, D2, wd);
				const rows = it.type === 'sideboard' ? 1 : it.type === 'nightstand' ? 2 : Math.max(3, Math.round(h / 0.25)), cols = w > 1.2 ? 2 : 1;
				for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
					const x0 = -W2 + 0.03 + c * (w - 0.06) / cols, x1 = x0 + (w - 0.06) / cols - 0.01, y0 = 0.13 + r * (h - 0.16) / rows, y1 = y0 + (h - 0.16) / rows - 0.012;
					g.box('grain', x0, y0, D2, x1, y1, D2 + 0.012, wd.map((v) => v * 1.06));
					g.box('metal', (x0 + x1) / 2 - 0.05, (y0 + y1) / 2 - 0.006, D2 + 0.012, (x0 + x1) / 2 + 0.05, (y0 + y1) / 2 + 0.006, D2 + 0.03, STEEL);
				}
			}
			if (it.type === 'nightstand') { tableLamp(g, 0.05, h, -0.05, rnd); books(g, -0.2, -0.08, h, 0.0, 0.14, rnd); }
			if (it.type === 'console' || it.type === 'dresser' && it.w > 1.2) { g.box('grain', -0.45, h + 0.35, -D2, 0.45, h + 1.15, -D2 + 0.03, wd); g.box('mirror', -0.4, h + 0.4, -D2 + 0.03, 0.4, h + 1.1, -D2 + 0.035, WHITE); }
			if (it.type === 'console') { tableLamp(g, W2 - 0.2, h, 0, rnd); g.cyl('gloss', -0.2, h, 0, 0.1, 0.07, acc, 10, 'y', true, 0.13); }
			if (it.type === 'sideboard') { g.cyl('gloss', 0.3, h, 0, 0.08, 0.3, acc, 10); plant(g, -0.4, h, 0, 0.4, rnd); }
			if (it.type === 'dresser') books(g, W2 - 0.3, W2 - 0.1, h, -0.1, 0.18, rnd);
			break;
		}
		case 'art': {
			const y0 = 1.25 + it.v * 0.2, fh = 0.4 + it.v * 0.4;
			g.box('grain', -W2, y0, -D2, W2, y0 + fh, D2, pick([BLACK, WHITE, wd], it.v * 5 % 1));
			const cols = [acc, lin(pick(ACCENT, it.v * 3 % 1)), lin(pick(FABRIC, it.v * 11 % 1))];
			for (let i = 0; i < 3; i++) g.box('matte', -W2 + 0.04, y0 + 0.04 + i * (fh - 0.08) / 3, D2, W2 - 0.04, y0 + 0.04 + (i + 1) * (fh - 0.08) / 3, D2 + 0.004, cols[i]);
			break;
		}
		case 'bed': {
			const hb = lin(pick(FABRIC.concat(WOOD), it.v * 3 % 1));
			g.box('grain', -W2, 0.12, -D2, W2, 0.34, D2, wd);
			legs4(g, 'grain', w, d, 0.12, wd, 0.03);
			g.box('fabric', -W2 + 0.03, 0.34, -D2 + 0.05, W2 - 0.03, 0.58, D2 - 0.03, WHITE);
			g.box('fabric', -W2 - 0.04, 0.3, -D2 + 0.55, W2 + 0.04, 0.62, D2 + 0.02, fab);
			g.box('fabric', -W2 + 0.02, 0.58, D2 - 0.45, W2 - 0.02, 0.64, D2 - 0.1, fab.map((c) => c * 0.8));
			const np = w > 1.3 ? 2 : 1;
			for (let i = 0; i < np; i++) { const x = np === 1 ? 0 : (i - 0.5) * w * 0.48; g.box('fabric', x - Math.min(0.33, w / 2 - 0.1), 0.58, -D2 + 0.08, x + Math.min(0.33, w / 2 - 0.1), 0.72, -D2 + 0.45, WHITE); }
			g.box(w > 1.5 ? 'fabric' : 'grain', -W2 - 0.03, 0, -D2 - 0.06, W2 + 0.03, 1.15, -D2, hb);
			break;
		}
		case 'closet': {
			// built in: the bulkhead to the ceiling, sliding doors below it
			g.box('paint', -W2, 0, -D2, W2, H.ceil0 - 0.001, D2, it.wallCol || WHITE);
			const dk = it.v < 0.4 ? 'mirror' : 'door6';
			for (let i = 0; i < 2; i++) g.box(i ? 'trim' : dk, -W2 + 0.05 + i * (w - 0.1) / 2, 0.02, D2 - 0.01 + i * 0.03, -W2 + 0.05 + (i + 1) * (w - 0.1) / 2, 2.05, D2 + 0.02 + i * 0.03, WHITE);
			break;
		}
		case 'desk': {
			legs4(g, 'metal', w, d, h - 0.03, BLACK, 0.015);
			g.box('grain', -W2, h - 0.03, -D2, W2, h, D2, wd);
			g.box('matte', -0.25, h, -D2 + 0.05, 0.25, h + 0.02, -D2 + 0.25, BLACK);
			g.box('gloss', -0.25, h + 0.1, -D2 + 0.08, 0.25, h + 0.42, -D2 + 0.1, BLACK);
			tableLamp(g, W2 - 0.15, h, -0.1, rnd);
			g.cyl('metal', 0, 0, D2 + 0.35, 0.25, 0.04, BLACK, 5);
			g.cyl('metal', 0, 0.04, D2 + 0.35, 0.025, 0.4, BLACK, 6);
			g.box('fabric', -0.24, 0.44, D2 + 0.12, 0.24, 0.5, D2 + 0.58, lin([0.2, 0.2, 0.22]));
			g.box('fabric', -0.22, 0.5, D2 + 0.55, 0.22, 1.0, D2 + 0.6, lin([0.2, 0.2, 0.22]));
			break;
		}
		case 'toys': for (let i = 0; i < 6; i++) { const x = (rnd() - 0.5) * w, z = (rnd() - 0.5) * d, s = 0.06 + rnd() * 0.1; if (rnd() < 0.5) g.box('gloss', x - s, 0, z - s, x + s, s * 1.6, z + s, lin(pick(ACCENT, rnd()))); else g.sphere('gloss', x, s, z, s, s, s, lin(pick(ACCENT, rnd())), 8); } break;
		case 'laundryBasket': g.cyl('matte', 0, 0, 0, 0.2, 0.42, lin([0.8, 0.72, 0.58]), 10, 'y', true, 0.22); g.sphere('fabric', 0, 0.42, 0, 0.18, 0.08, 0.16, lin(pick(ACCENT, rnd())), 8); break;
		case 'tub': {
			const k = 'gloss', c = WHITE;
			g.box(k, -W2, 0, -D2, W2, 0.1, D2, c);
			g.box(k, -W2, 0.1, -D2, W2, h, -D2 + 0.08, c); g.box(k, -W2, 0.1, D2 - 0.1, W2, h, D2, c);
			g.box(k, -W2, 0.1, -D2, -W2 + 0.1, h, D2, c); g.box(k, W2 - 0.1, 0.1, -D2, W2, h, D2, c);
			if (h < 1) break;
			// tiled up the walls round it, a curtain across the front
			g.box('subway', -W2, h, -D2, W2, 2.0, -D2 + 0.01, WHITE);
			g.cyl('metal', -W2, 1.95, D2 - 0.05, 0.012, w, STEEL, 6, 'x', false);
			g.box('fabric', -W2 + 0.02, 0.55, D2 - 0.07, -W2 + 0.02 + w * 0.35, 1.93, D2 - 0.04, acc);
			g.cyl('metal', 0.5 - W2, 1.75, -D2 + 0.02, 0.03, 0.12, STEEL, 8, 'z');
			break;
		}
		case 'shower': {
			g.box('gloss', -W2, 0, -D2, W2, 0.08, D2, WHITE);
			g.box('subway', -W2, 0.08, -D2, W2, 2.05, -D2 + 0.01, WHITE);
			g.box('glass', -W2, 0.08, D2 - 0.01, W2, 2.0, D2, WHITE);
			g.box('metal', -W2, 1.98, D2 - 0.02, W2, 2.0, D2 + 0.01, STEEL);
			g.cyl('metal', 0, 1.9, -D2 + 0.01, 0.05, 0.14, STEEL, 10, 'z');
			break;
		}
		case 'vanity': case 'pedestalSink': {
			if (it.type === 'vanity') {
				g.box('grain', -W2, 0.1, -D2, W2, 0.82, D2, wd); g.box('grain', -W2 + 0.03, 0, -D2, W2 - 0.03, 0.1, D2 - 0.06, DARK);
				g.box('stone', -W2 - 0.01, 0.82, -D2, W2 + 0.01, 0.86, D2 + 0.02, lin([0.92, 0.9, 0.86]));
				for (let x = -W2 + 0.03; x < W2 - 0.1; x += 0.5) g.box('grain', x, 0.13, D2, Math.min(W2 - 0.03, x + 0.48), 0.78, D2 + 0.012, wd.map((c) => c * 1.06));
			} else { g.cyl('gloss', 0, 0, -0.05, 0.07, 0.72, WHITE, 10); g.box('gloss', -W2, 0.72, -D2, W2, 0.86, D2, WHITE); }
			const ns = it.type === 'vanity' && w > 1.4 ? 2 : 1;
			for (let i = 0; i < ns; i++) {
				const x = ns === 1 ? 0 : (i - 0.5) * w * 0.5;
				g.box('gloss', x - 0.2, 0.86, -0.05, x + 0.2, 0.87, 0.16, lin([0.97, 0.97, 0.96]));
				g.cyl('metal', x, 0.86, -D2 + 0.08, 0.02, 0.16, STEEL, 8);
				g.box('metal', x - 0.012, 0.99, -D2 + 0.08, x + 0.012, 1.01, -D2 + 0.2, STEEL);
			}
			g.box('mirror', -Math.min(W2, 0.8) + 0.02, 1.05, -D2, Math.min(W2, 0.8) - 0.02, 1.9, -D2 + 0.01, WHITE);
			g.box('lamp', -Math.min(W2, 0.6), 1.98, -D2, Math.min(W2, 0.6), 2.08, -D2 + 0.08, lin([0.95, 0.93, 0.88]));
			break;
		}
		case 'toilet': {
			const c = WHITE;
			g.box('gloss', -0.1, 0, -0.1, 0.1, 0.3, 0.12, c);
			g.cyl('gloss', 0, 0.22, 0.08, 0.19, 0.18, c, 12, 'y', true, 0.2);
			g.cyl('gloss', 0, 0.4, 0.08, 0.2, 0.025, c, 12);
			g.box('gloss', -0.22, 0.4, -D2, 0.22, 0.8, -D2 + 0.2, c);
			g.box('gloss', -0.23, 0.8, -D2 - 0.005, 0.23, 0.83, -D2 + 0.21, c);
			g.box('metal', 0.12, 0.72, -D2 + 0.2, 0.18, 0.74, -D2 + 0.22, STEEL);
			break;
		}
		case 'washer': case 'dryer': {
			g.box('gloss', -W2, 0, -D2, W2, h, D2, WHITE);
			g.box('matte', -W2 + 0.02, h - 0.15, D2, W2 - 0.02, h - 0.02, D2 + 0.01, lin([0.8, 0.8, 0.82]));
			g.cyl('gloss', 0, 0.45, D2, 0.2, 0.02, it.type === 'washer' ? lin([0.25, 0.3, 0.33]) : lin([0.7, 0.7, 0.72]), 16, 'z');
			g.cyl('metal', 0, 0.45, D2, 0.23, 0.012, STEEL, 16, 'z');
			break;
		}
		case 'counter': {
			// base cabinets with a toe kick, a stone top, doors and drawers; the sink, the range
			const cab = it.v < 0.45 ? WHITE : it.v < 0.75 ? lin([0.62, 0.48, 0.32]) : lin([0.36, 0.3, 0.26]), ck = it.v < 0.45 ? 'trim' : 'grain';
			const top = lin(pick([[0.92, 0.9, 0.86], [0.3, 0.29, 0.28], [0.8, 0.74, 0.64], [0.55, 0.5, 0.45]], it.v * 7 % 1));
			const L = w, s0 = -L / 2;
			// in the item's frame x runs along the counter
			const sinkX = it.sink !== undefined ? it.sink - it.c : null, rangeX = it.range !== undefined ? it.range - it.c : null;
			g.box(ck, s0, 0.1, -D2, -s0, 0.88, D2 - 0.02, cab);
			g.box('matte', s0, 0, -D2, -s0, 0.1, D2 - 0.08, DARK);
			g.box('stone', s0, 0.88, -D2, -s0, 0.92, D2 + 0.02, top);
			// the backsplash
			g.box('subway', s0, 0.92, -D2, -s0, 1.4, -D2 + 0.008, lin([0.95, 0.94, 0.9]));
			for (let x = s0 + 0.02; x < -s0 - 0.2; x += 0.6) {
				if (rangeX !== null && Math.abs(x + 0.3 - rangeX) < 0.4) continue;
				const x1 = Math.min(-s0 - 0.02, x + 0.58);
				g.box(ck, x + 0.01, 0.13, D2 - 0.02, x1 - 0.01, 0.62, D2 - 0.005, cab.map((c) => c * 1.05));
				g.box(ck, x + 0.01, 0.65, D2 - 0.02, x1 - 0.01, 0.85, D2 - 0.005, cab.map((c) => c * 1.05));
				g.box('metal', (x + x1) / 2 - 0.08, 0.74, D2 - 0.005, (x + x1) / 2 + 0.08, 0.755, D2 + 0.015, STEEL);
			}
			if (sinkX !== null) {
				g.box('metal', sinkX - 0.38, 0.905, -0.2, sinkX + 0.38, 0.925, 0.2, lin([0.5, 0.5, 0.52]));
				g.cyl('metal', sinkX, 0.92, -D2 + 0.08, 0.02, 0.3, STEEL, 8);
				g.box('metal', sinkX - 0.012, 1.18, -D2 + 0.08, sinkX + 0.012, 1.21, -D2 + 0.3, STEEL);
				// the dishwasher beside it
				const dx = sinkX + (sinkX < 0 ? 0.7 : -0.7);
				if (Math.abs(dx) < -s0 - 0.3) g.box('metal', dx - 0.3, 0.1, D2 - 0.01, dx + 0.3, 0.86, D2 + 0.005, STEEL);
			}
			if (rangeX !== null) {
				g.box('metal', rangeX - 0.38, 0.1, -D2, rangeX + 0.38, 0.92, D2 + 0.01, STEEL);
				g.box('gloss', rangeX - 0.36, 0.92, -D2 + 0.02, rangeX + 0.36, 0.935, D2 - 0.02, BLACK);
				g.box('gloss', rangeX - 0.3, 0.3, D2 + 0.01, rangeX + 0.3, 0.7, D2 + 0.015, BLACK);
				g.box('metal', rangeX - 0.3, 0.76, D2 + 0.01, rangeX + 0.3, 0.78, D2 + 0.05, STEEL);
				g.box('metal', rangeX - 0.38, 1.55, -D2, rangeX + 0.38, 1.7, -D2 + 0.5, STEEL);
				g.box('metal', rangeX - 0.15, 1.7, -D2, rangeX + 0.15, H.ceil0, -D2 + 0.25, STEEL);
			}
			// wall cabinets where there is wall
			if (it.uppers > 0) {
				for (let x = s0; x < -s0 - 0.2; x += 0.6) {
					if (rangeX !== null && Math.abs(x + 0.3 - rangeX) < 0.45) continue;
					if (it.win && x + it.c + 0.6 > it.win[0] - 0.05 && x + it.c < it.win[1] + 0.05) continue;
					const x1 = Math.min(-s0, x + 0.6);
					g.box(ck, x, 1.45, -D2, x1, 2.25, -D2 + 0.33, cab);
					g.box(ck, x + 0.02, 1.47, -D2 + 0.33, x1 - 0.02, 2.23, -D2 + 0.345, cab.map((c) => c * 1.05));
				}
			}
			// what is on it
			if (it.v > 0.3) g.cyl('gloss', s0 + 0.35, 0.92, -D2 + 0.18, 0.1, 0.16, acc, 10);
			g.box('matte', -s0 - 0.45, 0.92, -D2 + 0.05, -s0 - 0.2, 1.22, -D2 + 0.25, pick([BLACK, STEEL, acc], it.v * 9 % 1));
			break;
		}
		case 'fridge': {
			g.box('metal', -W2, 0, -D2, W2, 1.8, D2, STEEL);
			g.box('matte', -0.004 - 0.003, 0.05, D2, 0.003, 1.78, D2 + 0.004, DARK);
			for (const sx of [-1, 1]) g.box('metal', sx * 0.05 - 0.012, 0.9, D2 + 0.004, sx * 0.05 + 0.012, 1.4, D2 + 0.05, STEEL);
			g.box('grain', -W2 - 0.02, 1.8, -D2, W2 + 0.02, H.ceil0 - 0.2, D2 - 0.1, WHITE);
			break;
		}
		case 'island': {
			const cab = lin([0.3, 0.33, 0.36]);
			g.box('grain', -W2 + 0.02, 0.1, -D2 + 0.25, W2 - 0.02, 0.88, D2, cab);
			g.box('matte', -W2 + 0.05, 0, -D2 + 0.3, W2 - 0.05, 0.1, D2 - 0.06, DARK);
			g.box('stone', -W2, 0.88, -D2, W2, 0.92, D2 + 0.02, lin([0.93, 0.92, 0.9]));
			for (let i = 0; i < (it.stools || 2); i++) {
				const x = -W2 + w * (i + 0.5) / (it.stools || 2);
				g.cyl('metal', x, 0, -D2 - 0.18, 0.02, 0.62, BLACK, 6); g.cyl('metal', x, 0.2, -D2 - 0.18, 0.15, 0.02, BLACK, 8);
				g.cyl('fabric', x, 0.62, -D2 - 0.18, 0.18, 0.06, fab, 10);
			}
			g.cyl('gloss', 0.2, 0.92, 0.1, 0.14, 0.07, acc, 12, 'y', true, 0.18);
			for (let i = 0; i < 3; i++) g.sphere('matte', 0.2 + (i - 1) * 0.06, 1.0, 0.1 + (i % 2) * 0.04, 0.04, 0.04, 0.04, lin([[0.9, 0.3, 0.1], [0.95, 0.75, 0.2], [0.5, 0.7, 0.2]][i]), 6);
			break;
		}
		case 'washBasin': break;
		case 'waterHeater': g.cyl('gloss', 0, 0.1, 0, 0.28, 1.4, lin([0.9, 0.9, 0.88]), 14); g.cyl('metal', 0, 1.5, 0, 0.05, 1.0, STEEL, 8); g.box('matte', -0.1, 0.25, 0.26, 0.1, 0.4, 0.3, lin([0.2, 0.2, 0.2])); break;
		case 'bins': for (let i = 0; i < 3; i++) { const x = -W2 + 0.25 + i * (w - 0.5) / 2; g.box('matte', x - 0.28, 0, -0.3, x + 0.28, 1.05, 0.3, lin([[0.2, 0.3, 0.55], [0.3, 0.45, 0.25], [0.35, 0.35, 0.36]][i])); } break;
		case 'workbench': {
			legs4(g, 'grain', w, d, 0.88, wd, 0.04, 0.06);
			g.box('grain', -W2, 0.88, -D2, W2, 0.93, D2, lin([0.62, 0.5, 0.36]));
			g.box('grain', -W2, 1.0, -D2, W2, 1.9, -D2 + 0.02, lin([0.65, 0.55, 0.42]));
			for (let i = 0; i < 9; i++) g.box('metal', -W2 + 0.1 + rnd() * (w - 0.3), 1.1 + rnd() * 0.6, -D2 + 0.02, -W2 + 0.15 + rnd() * (w - 0.3), 1.2 + rnd() * 0.6, -D2 + 0.05, lin(pick([[0.7, 0.1, 0.1], [0.2, 0.2, 0.2], [0.8, 0.6, 0.1], [0.6, 0.6, 0.6]], rnd())));
			break;
		}
		case 'bikes': for (let i = 0; i < 2; i++) { const z = -0.12 + i * 0.25, c = lin(pick(ACCENT, rnd())); for (const sx of [-1, 1]) g.cyl('matte', sx * 0.52, 0.34, z, 0.34, 0.03, BLACK, 16, 'z', true); g.box('gloss', -0.5, 0.34, z + 0.005, 0.5, 0.38, z + 0.025, c); g.box('gloss', -0.1, 0.34, z + 0.005, -0.06, 0.8, z + 0.025, c); g.box('matte', -0.2, 0.8, z - 0.05, 0.05, 0.84, z + 0.08, BLACK); } break;
		case 'ceilingLight': {
			const y = (it.level ? H.ceil1 - H.floor1 : H.ceil0);
			if (it.kind === 'fan') { g.cyl('metal', 0, y - 0.3, 0, 0.1, 0.3, lin([0.3, 0.25, 0.2]), 10); for (let i = 0; i < 4; i++) { g.at(it.x, it.y, it.z, i); g.box('grain', 0.1, y - 0.3, -0.07, 0.68, y - 0.28, 0.07, wd); } g.at(it.x, it.y, it.z, 0); g.cyl('lamp', 0, y - 0.42, 0, 0.12, 0.12, lin([0.95, 0.93, 0.88]), 12); }
			else if (it.kind === 'chandelier' || it.kind === 'pendant' || it.kind === 'pendants') {
				const n = it.kind === 'pendants' ? 3 : 1;
				// (over a table or an island they hang low; where you walk, above your head)
				const drop = it.kind === 'pendant' ? 0.3 : 0.7;
				for (let i = 0; i < n; i++) { const x = n === 1 ? 0 : (i - 1) * 0.6; g.cyl('metal', x, y - drop, 0, 0.006, drop, BLACK, 4, 'y', false); g.cyl('lamp', x, y - drop - 0.25, 0, it.kind === 'chandelier' ? 0.3 : 0.14, 0.25, lin([0.95, 0.9, 0.8]), 12, 'y', true, it.kind === 'chandelier' ? 0.2 : 0.06); }
			} else if (it.kind === 'tube') g.box('lamp', -0.6, y - 0.08, -0.08, 0.6, y, 0.08, lin([0.98, 0.98, 0.98]));
			else g.cyl('lamp', 0, y - 0.07, 0, 0.18, 0.07, lin([0.97, 0.96, 0.94]), 14, 'y', true, 0.14);
			break;
		}
		default: break;
	}
}
