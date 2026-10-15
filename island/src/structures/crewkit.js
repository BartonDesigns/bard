// The kit a rebuild brings, the shared part: how its things are made and how they are drawn.
// Everything a site has (trucks, cranes, fencing, the scaffold, the props) is built of simple
// solids merged into a few meshes, and every vertex carries what it is made of: painted metal,
// galvanised or worn steel, chrome, rubber, glass, wood, concrete, a lamp, a flashing beacon,
// a reflective strip, a decal. One material draws them all (kitMaterial): its roughness and
// metal by the vertex, the live sky in the paint and the glass (as the cars have it), grime
// worked in low down and where the wear is, lamps and beacons lit by the night, reflective
// strips that catch the light toward you, wheels and the mixer's drum turned in the shader,
// a hook's cable let out, a dithered fade for things arriving or leaving, a height above which
// a scaffold is not built yet. Names on doors and banners come from one drawn atlas
// (crewAtlas), the netting and the fence's mesh from another (clothMaterial).
//
// The trucks are in crewtrucks.js, the cranes in crewcranes.js, the site's things in
// crewsite.js and the people in crewfolk.js.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { withCarSky } from '../bay/cars.js';

const LIN = new Map();
export const lin = (c) => {
	const k = c[0] + ',' + c[1] + ',' + c[2];
	let v = LIN.get(k);
	if (!v) { const q = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); v = [q.r, q.g, q.b]; LIN.set(k, v); }
	return v;
};
const C = {
	steel: [0.62, 0.64, 0.66], galv: [0.66, 0.68, 0.69], dark: [0.07, 0.07, 0.08], tyre: [0.045, 0.045, 0.047], rim: [0.62, 0.63, 0.64], glass: [0.05, 0.07, 0.09], chrome: [0.85, 0.86, 0.88],
	yellow: [0.95, 0.74, 0.08], orange: [0.97, 0.42, 0.06], white: [0.92, 0.92, 0.9], red: [0.75, 0.1, 0.08], blue: [0.16, 0.3, 0.6], grey: [0.42, 0.43, 0.44], black: [0.1, 0.1, 0.11],
	wood: [0.66, 0.52, 0.34], ply: [0.72, 0.6, 0.42], block: [0.68, 0.67, 0.64], rust: [0.4, 0.2, 0.11], rubble: [0.55, 0.53, 0.5], concrete: [0.62, 0.61, 0.58], lamp: [1, 0.97, 0.9], amber: [1, 0.6, 0.08],
	green: [0.18, 0.36, 0.22], cabin: [0.88, 0.88, 0.84], loo: [0.13, 0.33, 0.66], hivis: [0.85, 0.95, 0.1], silver: [0.86, 0.88, 0.9], tail: [0.8, 0.06, 0.04], alu: [0.78, 0.8, 0.82],
	plastic: [0.12, 0.12, 0.13], sand: [0.78, 0.68, 0.5], gravel: [0.56, 0.55, 0.52], cement: [0.82, 0.8, 0.74], mortar: [0.7, 0.69, 0.66],
};
export const COLORS = C;

// what a vertex is made of: roughness, metal, kind, wear. Kinds: 0 a plain surface, 1 glass,
// 2 a head lamp, 3 a flashing amber beacon, 4 a reflective strip, 5 a work light's lens, 6 a red
// aviation light, 7 a tail lamp, 8 a decal (its atlas place in aX), 9 tyre rubber
export const MAT = {
	paint: [0.34, 0.1, 0, 0.32], paintWorn: [0.5, 0.08, 0, 0.62], steel: [0.42, 0.8, 0, 0.3], galv: [0.5, 0.75, 0, 0.35], worn: [0.62, 0.55, 0, 0.8],
	chrome: [0.32, 1, 0, 0.08], alu: [0.32, 0.85, 0, 0.18], rubber: [0.86, 0, 9, 0.55], plastic: [0.6, 0, 0, 0.3], shiny: [0.38, 0, 0, 0.35],
	glass: [0.04, 0, 1, 0], lamp: [0.12, 0, 2, 0], beacon: [0.18, 0, 3, 0], reflect: [0.38, 0, 4, 0.15], worklamp: [0.12, 0, 5, 0], aviation: [0.2, 0, 6, 0], tail: [0.18, 0, 7, 0],
	decal: [0.42, 0.06, 8, 0.25], banner: [0.72, 0, 8, 0.12], wood: [0.86, 0, 0, 0.45], concrete: [0.92, 0, 0, 0.5], rubble: [0.96, 0, 0, 0.1], dirt: [0.97, 0, 0, 0],
	cloth: [0.9, 0, 0, 0.2], skin: [0.6, 0, 0, 0], pane: [0.05, 0.3, 0, 0.04],
};

// ---------- parts into one geometry ----------
// a list of parts, each a non-indexed geometry with its colour and what it is made of; merged
// once. far: a coarser build (fewer sides, the small things left off) for the distance.
export function parts(opt = {}) {
	const P = [], far = !!opt.far;
	let cur = MAT.paint, wearK = null, spin = null;
	const add = (g, c, uv = null, colFn = null) => {
		if (g.index) { const q = g.toNonIndexed(); g.dispose(); g = q; }
		const n = g.attributes.position.count, col = new Float32Array(n * 3), mt = new Float32Array(n * 4), x = new Float32Array(n * 4), L = lin(c), w = wearK ?? cur[3];
		for (let i = 0; i < n; i++) { col[i * 3] = L[0]; col[i * 3 + 1] = L[1]; col[i * 3 + 2] = L[2]; mt[i * 4] = cur[0]; mt[i * 4 + 1] = cur[1]; mt[i * 4 + 2] = cur[2]; mt[i * 4 + 3] = w; }
		if (colFn) { const p = g.attributes.position.array; for (let i = 0; i < n; i++) { const k = colFn(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], i); if (k) { const q = lin(k); col[i * 3] = q[0]; col[i * 3 + 1] = q[1]; col[i * 3 + 2] = q[2]; } } }
		if (spin) for (let i = 0; i < n; i++) x.set(spin, i * 4);
		else if (uv) for (let i = 0; i < n; i++) { x[i * 4] = uv[i * 2]; x[i * 4 + 1] = uv[i * 2 + 1]; }
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.setAttribute('aMat', new THREE.BufferAttribute(mt, 4));
		g.setAttribute('aX', new THREE.BufferAttribute(x, 4));
		if (g.attributes.uv) g.deleteAttribute('uv');
		if (g.attributes.uv1) g.deleteAttribute('uv1');
		P.push(g);
		return g;
	};
	// a frame to build in: at (x, y, z) turned by yaw, local +z ahead
	const at = (x, y, z, yaw = 0) => atM(new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z));
	function atM(M) {
		const put = (g, lx, ly, lz, ry = 0, rx = 0, rz = 0) => { if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(lx, ly, lz); g.applyMatrix4(M); return g; };
		const V = {
			M, far,
			// a frame inside this one: at (x, y, z) of it, turned by yaw
			frame(x, y, z, yaw = 0) { return atM(M.clone().multiply(new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z))); },
			// what the next parts are made of (a MAT entry), their wear (null: the material's own)
			m(k, w = null) { cur = typeof k === 'string' ? MAT[k] : k; wearK = w; return V; },
			// the next parts turn in the shader: a wheel about local x through (cy, cz), the drum
			// about its tilted axis, or the top of a cable let out (null: no longer)
			// (built in the object's own frame: cy, cz are its own)
			spin(cy, cz, kind = 1, tilt = 0) { spin = cy === null ? null : [cy, cz, tilt, kind]; return V; },
			// a box w by h by d standing on (lx, ly, lz)
			box(lx, ly, lz, w, h, d, c, ry = 0, rx = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return add(put(g, lx, ly, lz, ry, rx, rz), c); },
			// a box about its middle
			mid(lx, ly, lz, w, h, d, c, ry = 0, rx = 0, rz = 0) { return add(put(new THREE.BoxGeometry(w, h, d), lx, ly, lz, ry, rx, rz), c); },
			// a box with rounded edges about its middle (plain far off)
			rbox(lx, ly, lz, w, h, d, c, r = 0.05, ry = 0, rx = 0, rz = 0) {
				const g = far || r <= 0.005 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, r < 0.05 ? 1 : 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
				return add(put(g, lx, ly, lz, ry, rx, rz), c);
			},
			// a cylinder about its middle along x, y or z (r2 the radius at its +axis end)
			cyl(lx, ly, lz, r, len, axis, c, seg = 10, r2 = r, open = false) {
				const g = new THREE.CylinderGeometry(r2, r, len, far ? Math.max(5, Math.ceil(seg / 2)) : seg, 1, open);
				return add(put(g, lx, ly, lz, 0, axis === 'z' ? Math.PI / 2 : 0, axis === 'x' ? -Math.PI / 2 : 0), c);
			},
			// a round tube from a to b (local)
			tube(a, b, r, c, seg = 6) {
				const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
				if (L < 1e-3) return null;
				const g = new THREE.CylinderGeometry(r, r, L, far ? Math.min(seg, 4) : seg, 1, true);
				g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)));
				g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); g.applyMatrix4(M);
				return add(g, c);
			},
			// a square bar from a to b (local): steel sections, timbers
			bar(a, b, r, c, r2 = r) {
				const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
				if (L < 1e-3) return null;
				const g = new THREE.BoxGeometry(r * 2, L, r2 * 2);
				// (kept square to the ground where it can be: its width level)
				const up = new THREE.Vector3(dx / L, dy / L, dz / L), side = Math.abs(up.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(up).normalize(), fwd = new THREE.Vector3().crossVectors(side, up);
				g.applyMatrix4(new THREE.Matrix4().makeBasis(side, up, fwd));
				g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); g.applyMatrix4(M);
				return add(g, c);
			},
			// a solid of revolution: [radius, height] pairs about local y (or x, z), centred at (lx, ly, lz)
			lathe(pts, lx, ly, lz, axis, c, seg = 16, exact = false) {
				const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(Math.max(0, r), h)), exact ? seg : far ? Math.max(6, seg >> 1) : seg);
				return add(put(g, lx, ly, lz, 0, axis === 'z' ? Math.PI / 2 : 0, axis === 'x' ? -Math.PI / 2 : 0), c);
			},
			// a side profile ([z, y] pairs) extruded across local x from x0 to x1
			ext(pts, x0, x1, c, bevel = 0) {
				const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
				const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: bevel > 0 && !far, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: far ? 4 : 8 });
				g.rotateY(-Math.PI / 2); g.translate(x1, 0, 0); g.applyMatrix4(M);
				return add(g, c);
			},
			// a plan outline ([x, z] pairs) extruded up from ly by h
			plan(pts, ly, h, c) {
				const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
				const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
				g.rotateX(-Math.PI / 2); g.translate(0, ly, 0); g.applyMatrix4(M);
				return add(g, c);
			},
			// a flat decal facing local +z turned by ry about y (and rx about x), its atlas place
			// rect [u0, v0, u1, v1]; c is the surface it sits on (where the decal is clear)
			decal(lx, ly, lz, w, h, rect, c, ry = 0, rx = 0, rz = 0) {
				const g = new THREE.PlaneGeometry(w, h);
				const uv = [rect[0], rect[3], rect[2], rect[3], rect[0], rect[1], rect[2], rect[1]];
				const g2 = g.toNonIndexed(); g.dispose();
				const idx = [0, 2, 1, 2, 3, 1], fl = [];
				for (const i of idx) fl.push(uv[i * 2], uv[i * 2 + 1]);
				const keep = cur; cur = cur[2] === 8 ? cur : MAT.decal;
				const out = add(put(g2, lx, ly, lz, ry, rx, rz), c, fl);
				cur = keep;
				return out;
			},
			// any geometry made in the frame's own coordinates (colFn(x, y, z, i) may colour each vertex)
			geo(g, c, colFn = null) { g.applyMatrix4(M); return add(g, c, null, colFn); },
			// a quad of local corners (counter-clockwise seen from its front)
			quad(a, b, c2, d, c) {
				const g = new THREE.BufferGeometry();
				g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c2, ...a, ...c2, ...d], 3));
				g.computeVertexNormals(); g.applyMatrix4(M);
				return add(g, c);
			},
			// a heap: a lumpy mound w by d, h high at its crown, its colour varied by the dice
			heap(lx, ly, lz, w, d, h, cols, seed = 1, res = 10, ry = 0) {
				const r = far ? Math.max(4, res >> 1) : res, g = new THREE.PlaneGeometry(w, d, r, r);
				g.rotateX(-Math.PI / 2);
				const p = g.attributes.position;
				for (let i = 0; i < p.count; i++) {
					const x = p.getX(i) / (w / 2), z = p.getZ(i) / (d / 2), e = Math.max(0, 1 - Math.hypot(x, z));
					const n = 0.75 + 0.5 * hash(Math.round(x * 9) + seed, Math.round(z * 9) - seed);
					p.setY(i, e > 0 ? h * Math.pow(e, 0.8) * n : -0.02);
				}
				g.computeVertexNormals();
				return add(put(g, lx, ly, lz, ry), cols[0], null, (px, py, pz, i) => cols[Math.floor(hash(i * 3 + seed, i) * cols.length)]);
			},
		};
		return V;
	}
	function merge() {
		let n = 0;
		for (const g of P) n += g.attributes.position.count;
		const out = new THREE.BufferGeometry();
		for (const [k, s] of [['position', 3], ['normal', 3], ['color', 3], ['aMat', 4], ['aX', 4]]) {
			const a = new Float32Array(n * s);
			let o = 0;
			for (const g of P) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
			out.setAttribute(k, new THREE.BufferAttribute(a, s));
		}
		for (const g of P) g.dispose();
		P.length = 0;
		out.computeBoundingSphere();
		return out;
	}
	return { at, merge, size: () => P.length, far };
}
export const hash = (a, b) => { let h = Math.imul(Math.round(a * 7) | 0, 374761393) ^ Math.imul(Math.round(b * 7) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- the companies: original names, their colours, the same on every truck of a crew ----------
export const COMPANIES = [
	{ key: 'hartwell', name: 'HARTWELL & SONS', line: 'GENERAL CONTRACTORS', since: 'SINCE 1962', phone: '(415) 555-0142', paint: [0.52, 0.09, 0.09], trim: [0.93, 0.9, 0.82], body: [0.32, 0.33, 0.34], ink: '#f3ead6', bg: '#7a1414', crane: [0.93, 0.9, 0.82] },
	{ key: 'bayline', name: 'BAYLINE CONSTRUCTION', line: 'BUILDING THE BAY', since: 'EST. 1987', phone: '(510) 555-0167', paint: [0.1, 0.2, 0.4], trim: [0.96, 0.46, 0.08], body: [0.6, 0.61, 0.62], ink: '#ffffff', bg: '#16305e', crane: [0.96, 0.74, 0.1] },
	{ key: 'ridgeway', name: 'RIDGEWAY BUILDERS', line: 'CONCRETE  STEEL  GLASS', since: 'SINCE 1974', phone: '(650) 555-0119', paint: [0.9, 0.9, 0.87], trim: [0.12, 0.46, 0.3], body: [0.13, 0.4, 0.27], ink: '#173f2c', bg: '#eeeee8', crane: [0.9, 0.9, 0.87] },
	{ key: 'ironbridge', name: 'IRONBRIDGE CIVIL', line: 'HEAVY CIVIL & STRUCTURES', since: 'EST. 1995', phone: '(408) 555-0188', paint: [0.93, 0.68, 0.08], trim: [0.15, 0.15, 0.16], body: [0.18, 0.18, 0.19], ink: '#1d1d1f', bg: '#f0b316', crane: [0.95, 0.72, 0.08] },
];

// ---------- the decal atlas: names on doors and sides, banners, signs ----------
// The places are laid out without a canvas (so geometry can be built anywhere); the drawing
// happens in a browser, once. Every rect is [u0, v0, u1, v1] with v up.
const AW = 2048, AH = 1024;
const RECTS = (() => {
	const R = {}, put = (name, x, y, w, h) => { R[name] = [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH]; };
	COMPANIES.forEach((c, i) => {
		put('door' + i, i * 256, 0, 256, 160);
		put('side' + i, 1024 + (i % 2) * 512, Math.floor(i / 2) * 112, 512, 112);
		put('banner' + i, (i % 2) * 1024, 224 + Math.floor(i / 2) * 192, 1024, 192);
		put('drum' + i, i * 256, 608, 256, 96);
		put('boom' + i, 1024 + i * 256, 608, 256, 64);
		put('cjib' + i, i * 512, 704, 512, 96);
	});
	put('hardhat', 0, 800, 256, 224); put('danger', 256, 800, 256, 224); put('office', 512, 800, 384, 112); put('visitors', 512, 912, 384, 112);
	put('chevron', 896, 800, 256, 64); put('plate', 896, 864, 128, 64); put('loo', 1024, 864, 128, 64); put('reverse', 1152, 800, 256, 96);
	put('swl', 1152, 896, 128, 64); put('ppe', 1408, 800, 384, 224); put('lamp', 1280, 896, 128, 64);
	return R;
})();
export const rect = (name) => RECTS[name] || RECTS.chevron;

let atlasTex = null;
export function crewAtlas() {
	if (atlasTex || typeof document === 'undefined') return atlasTex;
	const cv = document.createElement('canvas');
	cv.width = AW; cv.height = AH;
	const g = cv.getContext('2d');
	const px = (name) => { const r = RECTS[name]; return [r[0] * AW, (1 - r[3]) * AH, (r[2] - r[0]) * AW, (r[3] - r[1]) * AH]; };
	const font = (w, s) => `${w} ${s}px "Arial Narrow", Arial, Helvetica, sans-serif`;
	const fit = (t, max, w, s) => { let k = s; g.font = font(w, k); while (g.measureText(t).width > max && k > 8) { k -= 1; g.font = font(w, k); } };
	const text = (t, x, y, max, w, s, col, align = 'center') => { g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; fit(t, max, w, s); g.fillText(t, x, y); };
	// each company's mark: a shield, waves under a span, three ridges, an arch
	const mark = (i, cx, cy, s, ink, bg) => {
		g.save(); g.translate(cx, cy); g.lineJoin = 'round';
		g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = s * 0.09;
		if (i === 0) { g.beginPath(); g.moveTo(-s * 0.42, -s * 0.48); g.lineTo(s * 0.42, -s * 0.48); g.lineTo(s * 0.42, 0); g.quadraticCurveTo(s * 0.4, s * 0.38, 0, s * 0.52); g.quadraticCurveTo(-s * 0.4, s * 0.38, -s * 0.42, 0); g.closePath(); g.fill(); g.fillStyle = bg; g.font = font('bold', s * 0.62); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 0, -s * 0.02); }
		else if (i === 1) { g.beginPath(); g.moveTo(-s * 0.5, -s * 0.05); g.quadraticCurveTo(0, -s * 0.62, s * 0.5, -s * 0.05); g.stroke(); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * s * 0.2, -s * 0.05 - (1 - Math.abs(k) / 2.6) * s * 0.28); g.lineTo(k * s * 0.2, -s * 0.05); g.stroke(); } for (let k = 0; k < 2; k++) { g.beginPath(); for (let x = -0.5; x <= 0.501; x += 0.05) g.lineTo(x * s, s * (0.14 + k * 0.18) + Math.sin(x * 12) * s * 0.04); g.stroke(); } }
		else if (i === 2) { for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-s * 0.5, s * (0.32 - k * 0.0) - k * s * 0.24); g.lineTo(0, -s * 0.2 - k * s * 0.24); g.lineTo(s * 0.5, s * 0.32 - k * s * 0.24); g.stroke(); } }
		else { g.beginPath(); g.moveTo(-s * 0.55, s * 0.4); g.lineTo(-s * 0.55, -s * 0.05); g.quadraticCurveTo(0, -s * 0.6, s * 0.55, -s * 0.05); g.lineTo(s * 0.55, s * 0.4); g.lineTo(s * 0.32, s * 0.4); g.lineTo(s * 0.32, s * 0.02); g.quadraticCurveTo(0, -s * 0.28, -s * 0.32, s * 0.02); g.lineTo(-s * 0.32, s * 0.4); g.closePath(); g.fill(); g.fillRect(-s * 0.6, -s * 0.08, s * 1.2, s * 0.08); }
		g.restore();
	};
	const stripes = (x, y, w, h, a, b, step = 24) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); for (let i = -h; i < w + h; i += step * 2) { g.fillStyle = a; g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + step, y + h); g.lineTo(x + i + step + h, y); g.lineTo(x + i + h, y); g.fill(); g.fillStyle = b; g.beginPath(); g.moveTo(x + i + step, y + h); g.lineTo(x + i + step * 2, y + h); g.lineTo(x + i + step * 2 + h, y); g.lineTo(x + i + step + h, y); g.fill(); } g.restore(); };
	COMPANIES.forEach((c, i) => {
		// (the door: the mark over the name, on a clear ground so the paint shows through)
		{ const [x, y, w] = px('door' + i); mark(i, x + w / 2, y + 52, 70, c.ink, c.bg); text(c.name, x + w / 2, y + 112, w - 16, 'bold', 30, c.ink); text(c.line, x + w / 2, y + 140, w - 24, 'bold', 15, c.ink); }
		// (the side of a body or a van: the name long, the line and the number under it)
		{ const [x, y, w, h] = px('side' + i); mark(i, x + 52, y + h / 2, 72, c.ink, c.bg); text(c.name, x + 100, y + 40, w - 116, 'bold', 52, c.ink, 'left'); text(c.line + '   ' + c.phone, x + 102, y + 86, w - 120, 'bold', 24, c.ink, 'left'); }
		// (the fence banner: the company's colours, its mark, the name, what is going on)
		{
			const [x, y, w, h] = px('banner' + i);
			g.fillStyle = c.bg; g.fillRect(x, y, w, h);
			g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + h - 30, w, 30);
			mark(i, x + 104, y + h / 2 - 8, 120, c.ink, c.bg);
			text(c.name, x + 200, y + 62, w - 240, 'bold', 78, c.ink, 'left');
			text('REBUILDING YOUR STREET  ·  ' + c.since, x + 202, y + 124, w - 240, 'bold', 32, c.ink, 'left');
			text('THANK YOU FOR YOUR PATIENCE  ·  ' + c.phone, x + w / 2, y + h - 15, w - 40, 'bold', 22, c.ink);
			// (eyelets in the corners where the ties go through)
			g.fillStyle = '#cfcfcf'; for (const ex of [x + 14, x + w - 14]) for (const ey of [y + 14, y + h - 14]) { g.beginPath(); g.arc(ex, ey, 7, 0, 7); g.fill(); }
		}
		// (the drum's band, the boom's name, the counter-jib's banner)
		{ const [x, y, w, h] = px('drum' + i); text(c.name.split(' ')[0], x + w / 2, y + h / 2, w - 12, 'bold', 70, c.ink); }
		{ const [x, y, w, h] = px('boom' + i); text(c.name, x + w / 2, y + h / 2, w - 10, 'bold', 44, c.key === 'ironbridge' || c.key === 'bayline' ? '#111' : '#14304f'); }
		{ const [x, y, w, h] = px('cjib' + i); g.fillStyle = c.bg; g.fillRect(x, y, w, h); mark(i, x + 50, y + h / 2, 64, c.ink, c.bg); text(c.name, x + 290, y + h / 2, w - 120, 'bold', 60, c.ink); }
	});
	// signs: hard hat area (blue discs), danger, the site office, visitors, chevrons, a plate
	{ const [x, y, w, h] = px('hardhat'); g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillStyle = '#1a5fb4'; g.beginPath(); g.arc(x + w / 2, y + 78, 62, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + w / 2, y + 86, 40, 26, 0, Math.PI, 0); g.fill(); g.fillRect(x + w / 2 - 50, y + 84, 100, 10); text('HARD HATS', x + w / 2, y + 168, w - 20, 'bold', 34, '#1a5fb4'); text('MUST BE WORN', x + w / 2, y + 200, w - 20, 'bold', 26, '#1a5fb4'); g.strokeStyle = '#1a5fb4'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6); }
	{ const [x, y, w, h] = px('danger'); g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillStyle = '#c4161c'; g.fillRect(x, y, w, 70); g.fillStyle = '#111'; g.beginPath(); g.ellipse(x + w / 2, y + 35, w / 2 - 12, 26, 0, 0, 7); g.fill(); g.fillStyle = '#c4161c'; g.beginPath(); g.ellipse(x + w / 2, y + 35, w / 2 - 18, 21, 0, 0, 7); g.fill(); text('DANGER', x + w / 2, y + 36, w - 60, 'bold', 38, '#fff'); text('CONSTRUCTION', x + w / 2, y + 104, w - 20, 'bold', 32, '#111'); text('SITE', x + w / 2, y + 138, w - 20, 'bold', 32, '#111'); text('KEEP OUT', x + w / 2, y + 186, w - 20, 'bold', 40, '#111'); }
	{ const [x, y, w, h] = px('office'); g.fillStyle = '#0f4c81'; g.fillRect(x, y, w, h); text('SITE OFFICE', x + w / 2, y + h / 2, w - 30, 'bold', 64, '#fff'); }
	{ const [x, y, w, h] = px('visitors'); g.fillStyle = '#ffd400'; g.fillRect(x, y, w, h); text('ALL VISITORS MUST', x + w / 2, y + 36, w - 20, 'bold', 34, '#111'); text('REPORT TO THE SITE OFFICE', x + w / 2, y + 78, w - 20, 'bold', 30, '#111'); }
	{ const [x, y, w, h] = px('chevron'); stripes(x, y, w, h, '#d11a1a', '#f4f4f0', 22); }
	{ const [x, y, w, h] = px('plate'); g.fillStyle = '#f4f4f0'; g.fillRect(x, y, w, h); g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, w - 6, h - 6); text('California', x + w / 2, y + 14, w - 20, 'italic bold', 13, '#b0202a'); text('8BLD 207', x + w / 2, y + 42, w - 12, 'bold', 32, '#1b2f6b'); }
	{ const [x, y, w, h] = px('loo'); g.fillStyle = '#fff'; g.fillRect(x, y, w, h); text('SANI-HUT', x + w / 2, y + h / 2, w - 10, 'bold', 32, '#1a4f9c'); }
	{ const [x, y, w, h] = px('reverse'); g.fillStyle = '#ffd400'; g.fillRect(x, y, w, h); text('CAUTION', x + w / 2, y + 30, w - 20, 'bold', 36, '#111'); text('THIS VEHICLE REVERSES', x + w / 2, y + 68, w - 16, 'bold', 22, '#111'); }
	{ const [x, y, w, h] = px('swl'); g.fillStyle = '#ffd400'; g.fillRect(x, y, w, h); text('SWL 8t', x + w / 2, y + h / 2, w - 10, 'bold', 40, '#111'); }
	{ const [x, y, w, h] = px('lamp'); g.fillStyle = '#ffd400'; g.fillRect(x, y, w, h); text('NIGHT', x + w / 2, y + h / 2, w - 10, 'bold', 30, '#111'); }
	{
		const [x, y, w, h] = px('ppe'); g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.strokeStyle = '#1a5fb4'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
		for (let k = 0; k < 3; k++) { const cx = x + 70 + k * 122; g.fillStyle = '#1a5fb4'; g.beginPath(); g.arc(cx, y + 76, 52, 0, 7); g.fill(); g.fillStyle = '#fff'; if (k === 0) { g.beginPath(); g.ellipse(cx, y + 84, 32, 22, 0, Math.PI, 0); g.fill(); g.fillRect(cx - 40, y + 82, 80, 8); } else if (k === 1) { g.fillRect(cx - 24, y + 48, 48, 58); g.fillStyle = '#1a5fb4'; g.fillRect(cx - 24, y + 66, 48, 6); g.fillRect(cx - 24, y + 84, 48, 6); } else { g.fillRect(cx - 14, y + 46, 22, 44); g.fillRect(cx - 14, y + 82, 44, 20); } }
		text('SAFETY HELMETS, HI-VIS AND', x + w / 2, y + 162, w - 20, 'bold', 26, '#1a5fb4'); text('SAFETY BOOTS MUST BE WORN', x + w / 2, y + 194, w - 20, 'bold', 26, '#1a5fb4');
	}
	atlasTex = new THREE.CanvasTexture(cv);
	atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8;
	return atlasTex;
}

// ---------- the material ----------
// shared by every kit material: the night (0 day, 1 dark), the time for the beacons, the atlas
export const kitShared = { uNight: { value: 0 }, uTime: { value: 0 }, uAtlas: { value: null } };
const KIT_VERT_HEAD = /* glsl */`
attribute vec4 aMat; attribute vec4 aX;
uniform float uSpin, uDrum, uStretch;
varying vec4 vKit; varying vec4 vKX; varying vec3 vKW; varying float vKY;
vec3 kitTurn(vec3 p, vec3 o, vec3 ax, float a) { vec3 q = p - o; float c = cos(a), s = sin(a); return o + q * c + cross(ax, q) * s + ax * dot(ax, q) * (1.0 - c); }
`;
const KIT_SPIN = /* glsl */`
	float kitK = floor(aX.w + 0.5);
	vec3 kitAx = vec3(1.0, 0.0, 0.0); vec3 kitO = vec3(0.0, aX.x, aX.y); float kitA = 0.0;
	if (kitK == 1.0) { kitA = uSpin; }
	else if (kitK == 2.0) { kitAx = vec3(0.0, sin(aX.z), cos(aX.z)); kitA = uDrum; }
`;
const KIT_FRAG_HEAD = /* glsl */`
uniform float uNight, uTime, uFade, uClipY, uLamps, uBeacon, uWork;
uniform sampler2D uAtlas;
varying vec4 vKit; varying vec4 vKX; varying vec3 vKW; varying float vKY;
float kitH(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float kitN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(kitH(i), kitH(i + vec3(1, 0, 0)), f.x), mix(kitH(i + vec3(0, 1, 0)), kitH(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(kitH(i + vec3(0, 0, 1)), kitH(i + vec3(1, 0, 1)), f.x), mix(kitH(i + vec3(0, 1, 1)), kitH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float kitIGN(vec2 c) { return fract(52.9829189 * fract(dot(c, vec2(0.06711056, 0.00583715)))); }
`;
// (a fade: uFade 0..1 shows a pixel where the dither is under it; -1..0 the other pixels, so
// something fading out and its replacement fading in always cover each other)
const KIT_DISCARD = /* glsl */`
	if (vKW.y > uClipY) discard;
	{ float kd = kitIGN(gl_FragCoord.xy); if (uFade >= 0.0 ? kd >= uFade : kd < -uFade) discard; }
`;
const KIT_COLOR = /* glsl */`
	float kitKind = floor(vKit.z + 0.5);
	float kitRough = vKit.x, kitMetal = vKit.y;
	vec3 kitGlow = vec3(0.0);
	if (kitKind == 8.0) { vec4 t = texture2D(uAtlas, vKX.xy); diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, t.a); }
	// grime: worked in where the wear is, more of it low down, streaked down the sides
	{
		float n = kitN(vKW * 2.1) * 0.55 + kitN(vKW * vec3(7.0, 2.2, 7.0)) * 0.3 + kitN(vKW * 23.0) * 0.15;
		float low = 1.0 - smoothstep(0.05, 1.7, vKY);
		float dirt = vKit.w * clamp(n * (0.5 + 0.9 * low) - 0.2, 0.0, 1.0);
		vec3 mud = vec3(0.3, 0.27, 0.22) * (0.75 + 0.5 * kitN(vKW * 5.0));
		diffuseColor.rgb = mix(diffuseColor.rgb, mud * (0.6 + 0.6 * dot(diffuseColor.rgb, vec3(0.33))), dirt * 0.85);
		kitRough = mix(kitRough, 0.95, dirt);
		kitMetal *= 1.0 - dirt * 0.8;
	}
	if (kitKind == 1.0) { diffuseColor.rgb = vec3(0.018, 0.024, 0.03); }
	else if (kitKind == 2.0) { kitGlow = diffuseColor.rgb * (uLamps * uNight * 3.0 + 0.06); }
	else if (kitKind == 7.0) { kitGlow = diffuseColor.rgb * (uLamps * (0.4 + uNight * 1.6) + 0.04); }
	else if (kitKind == 3.0) {
		// (a rotating beacon: a quick bright sweep, each one on its own phase)
		float ph = kitH(floor(vKW * 0.5)) * 6.283;
		float s = pow(max(0.0, sin(uTime * 6.5 + ph)), 6.0) + 0.6 * pow(max(0.0, sin(uTime * 6.5 + ph + 0.9)), 10.0);
		kitGlow = vec3(1.0, 0.5, 0.04) * uBeacon * (0.15 + s * (2.5 + 5.0 * uNight));
	}
	else if (kitKind == 5.0) { kitGlow = vec3(1.0, 0.97, 0.9) * (uWork * uNight * 9.0 + 0.05); }
	else if (kitKind == 6.0) { kitGlow = vec3(1.0, 0.04, 0.02) * uNight * (2.4 + 0.6 * sin(uTime * 2.0)); }
`;
const KIT_REFLECT = /* glsl */`
	if (kitKind == 4.0) {
		// (retroreflective: what light there is comes straight back toward you, mostly by night)
		float face = pow(saturate(dot(normal, normalize(vViewPosition))), 1.5);
		totalEmissiveRadiance += diffuseColor.rgb * face * (0.08 + uNight * 1.1);
	}
	totalEmissiveRadiance += kitGlow;
`;
// one material per mesh that moves on its own (its wheels, its fade, its clip are its own); the
// programme is shared. o.cheap: the plain sky in the reflections
export function kitMaterial(o = {}) {
	const U = { uSpin: { value: 0 }, uDrum: { value: 0 }, uStretch: { value: 0 }, uFade: { value: 1 }, uClipY: { value: 1e9 }, uLamps: { value: 0 }, uBeacon: { value: 1 }, uWork: { value: 0 } };
	if (!kitShared.uAtlas.value) kitShared.uAtlas.value = crewAtlas();
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
	if (o.cheap) m.defines = { CAR_CHEAP: '' };
	m.onBeforeCompile = (sh) => {
		withCarSky(sh);
		Object.assign(sh.uniforms, U, kitShared);
		sh.vertexShader = KIT_VERT_HEAD + sh.vertexShader
			.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + KIT_SPIN + '\tif (kitA != 0.0) objectNormal = kitTurn(objectNormal, vec3(0.0), kitAx, kitA);')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tif (kitA != 0.0) transformed = kitTurn(transformed, kitO, kitAx, kitA);\n\tif (kitK == 3.0) transformed.y += uStretch;\n\tvKit = aMat; vKX = aX; vKY = transformed.y;')
			.replace('#include <project_vertex>', '#include <project_vertex>\n\tvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
		sh.fragmentShader = KIT_FRAG_HEAD + sh.fragmentShader
			.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + KIT_DISCARD)
			.replace('#include <color_fragment>', '#include <color_fragment>\n' + KIT_COLOR)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = kitRough;')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = kitMetal;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + KIT_REFLECT);
	};
	m.customProgramCacheKey = () => 'crew-kit-2' + (o.cheap ? 'c' : '');
	m.userData.u = U;
	// (its shadow: the same fade and clip, the same turning parts)
	const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
	d.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U, kitShared);
		sh.vertexShader = KIT_VERT_HEAD + sh.vertexShader
			.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + KIT_SPIN + '\tif (kitA != 0.0) transformed = kitTurn(transformed, kitO, kitAx, kitA);\n\tif (kitK == 3.0) transformed.y += uStretch;\n\tvKit = aMat; vKX = aX; vKY = transformed.y;')
			.replace('#include <project_vertex>', '#include <project_vertex>\n\tvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
		sh.fragmentShader = KIT_FRAG_HEAD + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + KIT_DISCARD);
	};
	d.customProgramCacheKey = () => 'crew-kit-depth-2';
	m.userData.depth = d;
	return m;
}
// a mesh of the kit with its own material (and its shadow's)
export function kitMesh(geo, o = {}) {
	const mat = kitMaterial(o), m = new THREE.Mesh(geo, mat);
	m.customDepthMaterial = mat.userData.depth;
	m.castShadow = o.shadow !== false; m.receiveShadow = true;
	return m;
}

// ---------- the site's cloth: the scaffold's netting and the fence's mesh: one atlas ----------
let clothTex = null;
export function clothMaterial() {
	const U = { uClipY: { value: 1e9 }, uFade: { value: 1 } };
	if (!clothTex && typeof document !== 'undefined') {
		const S = 256, cv = document.createElement('canvas');
		cv.width = S * 2; cv.height = S;
		const g = cv.getContext('2d');
		// debris netting: a fine knitted mesh, its cords thicker every so often, faintly mottled
		g.fillStyle = 'rgba(24,72,44,0.5)'; g.fillRect(0, 0, S, S);
		g.strokeStyle = 'rgba(20,62,36,0.6)'; g.lineWidth = 1;
		for (let i = -S; i <= S * 2; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S * 0.35, S); g.stroke(); g.beginPath(); g.moveTo(i, 0); g.lineTo(i - S * 0.35, S); g.stroke(); }
		g.strokeStyle = 'rgba(12,44,26,0.85)'; g.lineWidth = 1.6;
		for (let i = 0; i <= S; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); }
		for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(${12 + (i % 20)},${44 + (i % 30)},${26 + (i % 12)},0.1)`; g.fillRect((i * 97) % S, (i * 53) % S, 12, 12); }
		// the fence's mesh: welded wire, 100 by 250 mm, galvanised, clear between
		g.clearRect(S, 0, S, S);
		g.strokeStyle = 'rgba(196,200,202,1)'; g.lineWidth = 2.2;
		for (let i = 0; i <= S; i += 16) { g.beginPath(); g.moveTo(S + i + 1, 0); g.lineTo(S + i + 1, S); g.stroke(); }
		for (let i = 0; i <= S; i += 40) { g.beginPath(); g.moveTo(S, i + 1); g.lineTo(S * 2, i + 1); g.stroke(); }
		clothTex = new THREE.CanvasTexture(cv);
		clothTex.colorSpace = THREE.SRGBColorSpace; clothTex.anisotropy = 8;
	}
	const mat = new THREE.MeshStandardMaterial({ map: clothTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.85, metalness: 0.1, alphaTest: 0.03 });
	// (each quad says which cell it shows, and whether it is held to the scaffold's height)
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U, { uNight: kitShared.uNight });
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aCell; varying vec3 vCell; varying vec2 vRaw; varying vec3 vCW;')
			.replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvCell = aCell; vRaw = uv;')
			.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n\tvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uClipY, uFade, uNight; varying vec3 vCell; varying vec2 vRaw; varying vec3 vCW;\nfloat clIGN(vec2 c) { return fract(52.9829189 * fract(dot(c, vec2(0.06711056, 0.00583715)))); }')
			.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tif (vCell.z > 0.5 && vCW.y > uClipY) discard;\n\t{ float kd = clIGN(gl_FragCoord.xy); if (uFade >= 0.0 ? kd >= uFade : kd < -uFade) discard; }')
			.replace('#include <map_fragment>', 'diffuseColor *= texture2D(map, vec2(vCell.x + 0.003 + fract(vRaw.x) * 0.494, 0.003 + fract(vRaw.y) * 0.994));');
	};
	mat.customProgramCacheKey = () => 'structures-cloth-2';
	mat.userData.u = U;
	return mat;
}
export const NET = [0, 0], MESH = [0.5, 0];
// quads of cloth: corners (world or local), the cell, how many times it repeats across and up,
// held to the scaffold's height or not; grid(): a quad split into cells, its middle let sag
export function cloth() {
	const pos = [], uv = [], cell = [], nor = [];
	function quad(a, b, c, d, cl, ru = 1, rv = 1, clip = 0, U = [[0, 0], [ru, 0], [ru, rv], [0, rv]]) {
		const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
		const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(n[0], n[1], n[2]) || 1;
		const Q = [a, b, c, d];
		for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(Q[k][0], Q[k][1], Q[k][2]); uv.push(U[k][0], U[k][1]); cell.push(cl[0], cl[1], clip); nor.push(n[0] / l, n[1] / l, n[2] / l); }
	}
	// a sheet from a (bottom left) along e1 and up e2, nu by nv cells, its middle pushed by sag
	// along n (the most at the middle of each span between its ties)
	function sheet(a, e1, e2, n, nu, nv, cl, ru, rv, sag = 0, clip = 1) {
		// (the even columns are where it is tied; the odd ones, between, bow out and drop a little)
		const P = (i, j) => {
			const t = j / nv, k = i % 2 ? 1 : 0, bow = k * sag * (0.55 + 0.45 * Math.sin(Math.PI * t)), drop = k * sag * 0.5;
			return [a[0] + e1[0] * i / nu + e2[0] * t + n[0] * bow, a[1] + e1[1] * i / nu + e2[1] * t + n[1] * bow - drop, a[2] + e1[2] * i / nu + e2[2] * t + n[2] * bow];
		};
		for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), cl, 1, 1, clip, [[ru * i / nu, rv * j / nv], [ru * (i + 1) / nu, rv * j / nv], [ru * (i + 1) / nu, rv * (j + 1) / nv], [ru * i / nu, rv * (j + 1) / nv]]);
	}
	function geo() {
		if (!pos.length) return null;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aCell', new THREE.Float32BufferAttribute(cell, 3));
		g.computeBoundingSphere();
		return g;
	}
	return { quad, sheet, geo, count: () => pos.length / 3 };
}
