// The plants of the Bay Area's wild ground, as a naturalist would point them out on the
// trail (nature/fieldguide.js HABITATS): coyote brush mounds on the coastal hills,
// chamise and red-barked manzanita on the hot chaparral ridges, toyon and poison oak at
// the woodland edge, silver sage, sword ferns in the redwood shade, huckleberry and
// redwood sorrel, and the grass itself in bunches: wild oats, brome, purple needlegrass,
// with star-thistle, fennel and mustard where the ground was disturbed.
// Each builder returns { parts: [wood, leaves], height } (a tuft: parts [blades]), in
// metres, standing on y = 0, coloured in its vertices and shaded by an instance tint.
// The leaves are cards cut from one painted atlas (leafAtlas), one cell per species.

import * as THREE from 'three';
import { Builder, V, tube, strip } from '../world/vegetation.js';
import { mulberry32 } from '../noise.js';

// ---------- the leaf atlas: 4 x 2 cells of 256 px ----------
// 0 coyote brush  1 chamise  2 manzanita  3 toyon  4 poison oak  5 sage  6 sword fern  7 huckleberry
export const CELL = { coyote: 0, chamise: 1, manzanita: 2, toyon: 3, poisonoak: 4, sage: 5, fern: 6, huckle: 7 };
const AC = 4, AR = 2;
let atlas = null;
export function leafAtlas() {
	if (atlas) return atlas;
	const S = 256, c = document.createElement('canvas');
	c.width = S * AC; c.height = S * AR;
	const g = c.getContext('2d'), r = mulberry32(4242);
	const rgb = (l, k = [0.8, 1, 0.66], a = 1) => `rgba(${l * k[0] | 0},${l * k[1] | 0},${l * k[2] | 0},${a})`;
	const leaf = (x, y, len, w, ang, l, k, vein = true) => {
		g.save(); g.translate(x, y); g.rotate(ang);
		g.fillStyle = rgb(l, k);
		g.beginPath(); g.moveTo(0, -len); g.quadraticCurveTo(w, -len * 0.15, 0, len); g.quadraticCurveTo(-w, -len * 0.15, 0, -len); g.fill();
		if (vein) { g.strokeStyle = rgb(l * 0.7, k, 0.6); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -len * 0.8); g.lineTo(0, len * 0.8); g.stroke(); }
		g.restore();
	};
	const twig = (x0, y0, x1, y1, w, l) => { g.strokeStyle = rgb(l, [0.62, 0.52, 0.42]); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 20, (y0 + y1) / 2, x1, y1); g.stroke(); };
	const cell = (i, draw) => { g.save(); g.translate((i % AC) * S, Math.floor(i / AC) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); draw(); g.restore(); };
	// coyote brush: a dense clump of small toothed leaves on many short twigs
	cell(0, () => {
		for (let i = 0; i < 9; i++) twig(S / 2, S * 0.95, S * (0.15 + r() * 0.7), S * (0.1 + r() * 0.4), 2, 150);
		for (let i = 0; i < 380; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.6) * S * 0.44; leaf(S / 2 + Math.cos(a) * d, S * 0.48 + Math.sin(a) * d * 0.9, 9 + r() * 5, 5 + r() * 2, r() * 6.28, (150 + r() * 100) * (0.7 + 0.3 * d / (S * 0.44)), [0.78, 1, 0.6], false); }
	});
	// chamise: wiry stems with little bundles of needle leaves
	cell(1, () => {
		for (let i = 0; i < 14; i++) twig(S * (0.3 + r() * 0.4), S, S * (0.05 + r() * 0.9), S * (0.05 + r() * 0.5), 1.5, 120);
		for (let i = 0; i < 700; i++) {
			const x = S * (0.08 + r() * 0.84), y = S * (0.06 + Math.pow(r(), 0.8) * 0.8), l = 130 + r() * 110;
			g.strokeStyle = rgb(l, [0.85, 1, 0.62]); g.lineWidth = 2.4;
			for (let k = 0; k < 4; k++) { const a = r() * 6.28; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke(); }
		}
	});
	// manzanita: stiff oval leaves held edge-up, pale grey-green, not many
	cell(2, () => {
		for (let i = 0; i < 6; i++) twig(S / 2, S, S * (0.15 + r() * 0.7), S * (0.15 + r() * 0.4), 3, 120);
		for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.7) * S * 0.42; leaf(S / 2 + Math.cos(a) * d, S * 0.46 + Math.sin(a) * d, 13 + r() * 5, 9 + r() * 3, (r() - 0.5) * 0.8, 170 + r() * 70, [0.86, 0.95, 0.8]); }
	});
	// toyon: long leathery serrated leaves, dark and glossy
	cell(3, () => {
		for (let i = 0; i < 7; i++) twig(S / 2, S, S * (0.1 + r() * 0.8), S * (0.1 + r() * 0.4), 2.5, 120);
		for (let i = 0; i < 90; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.7) * S * 0.42; leaf(S / 2 + Math.cos(a) * d, S * 0.47 + Math.sin(a) * d, 20 + r() * 8, 7 + r() * 2, a + (r() - 0.5), (120 + r() * 110) * (0.7 + 0.3 * d / (S * 0.42)), [0.74, 1, 0.62]); }
	});
	// poison oak: leaves of three, lobed like an oak's, glossy
	cell(4, () => {
		for (let i = 0; i < 18; i++) {
			const x = S * (0.15 + r() * 0.7), y = S * (0.15 + r() * 0.7), a = r() * 6.28, l = 150 + r() * 100, s = 0.8 + r() * 0.5;
			for (const [da, dl, sz] of [[0, 1, 1.25], [-1.4, 0.55, 0.9], [1.4, 0.55, 0.9]]) {
				const la = a + da, cx = x + Math.cos(a + da) * 18 * s * dl, cy = y + Math.sin(a + da) * 18 * s * dl;
				for (let k = 0; k < 3; k++) leaf(cx + Math.cos(la) * (k - 1) * 5 * s, cy + Math.sin(la) * (k - 1) * 5 * s, 10 * s * sz * (k === 1 ? 1.2 : 0.85), 9 * s * sz, la + Math.PI / 2, l, [0.8, 1, 0.6], k === 1);
			}
		}
	});
	// sage: a haze of thread-fine silver leaves
	cell(5, () => {
		for (let i = 0; i < 10; i++) twig(S / 2, S, S * (0.1 + r() * 0.8), S * (0.1 + r() * 0.5), 1.2, 150);
		for (let i = 0; i < 900; i++) {
			const a = r() * 6.28, d = Math.pow(r(), 0.6) * S * 0.45, x = S / 2 + Math.cos(a) * d, y = S * 0.5 + Math.sin(a) * d * 0.9, l = 170 + r() * 80, b = r() * 6.28;
			g.strokeStyle = rgb(l, [0.92, 0.98, 0.9], 0.95); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * 6, y + Math.sin(b) * 6); g.stroke();
		}
	});
	// sword fern: one long frond of narrow toothed pinnae (u runs along it)
	cell(6, () => {
		g.strokeStyle = rgb(140, [0.7, 0.85, 0.5]); g.lineWidth = 3; g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
		for (let x = 6; x < S - 3; x += 6) {
			const t = x / S, len = S * 0.45 * Math.sin(Math.min(1, t * 1.1 + 0.08) * Math.PI) * (1 - t * 0.35);
			for (const s of [-1, 1]) { const l = 150 + r() * 80; g.fillStyle = rgb(l, [0.72, 1, 0.55]); g.beginPath(); g.moveTo(x - 2, S / 2); g.quadraticCurveTo(x + len * 0.25, S / 2 + s * len * 0.55, x + len * 0.3, S / 2 + s * len); g.quadraticCurveTo(x + len * 0.1, S / 2 + s * len * 0.5, x + 3, S / 2); g.fill(); }
		}
	});
	// huckleberry: small neat oval leaves in flat sprays (and redwood sorrel's clover)
	cell(7, () => {
		for (let i = 0; i < 8; i++) twig(S / 2, S, S * (0.1 + r() * 0.8), S * (0.1 + r() * 0.5), 1.5, 110);
		for (let i = 0; i < 280; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.6) * S * 0.45; leaf(S / 2 + Math.cos(a) * d, S * 0.48 + Math.sin(a) * d, 9 + r() * 3, 6, r() * 6.28, (130 + r() * 110) * (0.75 + 0.25 * d / (S * 0.45)), [0.76, 1, 0.62], false); }
	});
	atlas = new THREE.CanvasTexture(c);
	atlas.colorSpace = THREE.SRGBColorSpace;
	atlas.anisotropy = 4;
	return atlas;
}

// a leaf card cut from one atlas cell; facing roughly `normal`, turned at random about it
function acard(b, center, size, r, color, sway, normal, cellI, flat = 0) {
	const n = normal.clone().normalize();
	let t = Math.abs(n.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0).cross(n).normalize();
	const bt = n.clone().cross(t).normalize(), a = r() * 6.28;
	t = t.clone().multiplyScalar(Math.cos(a)).add(bt.clone().multiplyScalar(Math.sin(a)));
	const u2 = n.clone().cross(t).normalize();
	// tipped a little off the normal, so a clump is not a set of parallel plates
	const tip = V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9 * (1 - flat));
	const cU = t.clone().add(tip).normalize(), cV = u2.clone().sub(tip.clone().multiplyScalar(0.5)).normalize();
	const u0 = (cellI % AC) / AC, v0 = 1 - (Math.floor(cellI / AC) + 1) / AR, du = 1 / AC, dv = 1 / AR, e = 0.01;
	const tone = 0.8 + r() * 0.4, col = { r: color.r * tone, g: color.g * tone, b: color.b * tone };
	const ids = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]].map(([x, y, s, q]) =>
		b.vert(center.clone().add(cU.clone().multiplyScalar(x * size)).add(cV.clone().multiplyScalar(y * size)), n, [u0 + e + s * (du - 2 * e), v0 + e + q * (dv - 2 * e)], col, sway));
	b.tri(ids[0], ids[1], ids[2]); b.tri(ids[0], ids[2], ids[3]);
}
// a dome of foliage: cards on the skin of an ellipsoid (centre c, radii rx, ry), light side out
function dome(b, r, c, rx, ry, n, size, color, cellI, sway = 0.7, inner = 0.45) {
	for (let i = 0; i < n; i++) {
		const th = r() * 6.28, ph = Math.acos(1 - r() * 1.75), k = inner + r() * (1 - inner);
		const d = V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
		const p = c.clone().add(V(d.x * rx * k, d.y * ry * k, d.z * rx * k));
		if (p.y < 0.05) p.y = 0.05 + r() * 0.1;
		// deeper in, darker: the inside of a shrub is in its own shade
		const sh = (0.45 + 0.55 * k) * (0.7 + 0.3 * (d.y * 0.5 + 0.5));
		acard(b, p, size * (0.8 + r() * 0.4), r, { r: color.r * sh, g: color.g * sh, b: color.b * sh }, sway * (0.4 + 0.6 * Math.max(0, p.y) / (c.y + ry)), d.clone().add(V(0, 0.35, 0)), cellI);
	}
}
// woody stems from one root crown, fanning up and out; returns their tips
function stems(b, r, n, top, spread, col, rad = 0.035, twist = 0.3) {
	const tips = [];
	for (let i = 0; i < n; i++) {
		const a = i / n * 6.283 + r() * 0.7, reach = spread * (0.4 + r() * 0.6), up = top * (0.55 + r() * 0.5), pts = [], rr = [];
		for (let q = 0; q <= 4; q++) {
			const t = q / 4, d = 0.04 + reach * Math.pow(t, 1.3), aa = a + t * twist * (r() - 0.3);
			pts.push(V(Math.cos(aa) * d + (r() - 0.5) * 0.04 * q, q === 0 ? -0.1 : up * t, Math.sin(aa) * d + (r() - 0.5) * 0.04 * q));
			rr.push(rad * (1 - t * 0.75));
		}
		tube(b, pts, rr, 4, col, (t) => t * 0.6);
		tips.push(pts[4], pts[3]);
	}
	return tips;
}

const WOOD = new THREE.Color(0.42, 0.36, 0.3);
// a bead: a berry or a flower head, eight faces
function bead(b, c, rad, col) {
	const ids = [V(rad, 0, 0), V(-rad, 0, 0), V(0, rad, 0), V(0, -rad, 0), V(0, 0, rad), V(0, 0, -rad)].map((d) => b.vert(c.clone().add(d), d.clone().normalize(), [0.5, 0.5], col, 0.8));
	for (const [a, bb, cc] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) b.tri(ids[a], ids[bb], ids[cc]);
}

// coyote brush: a dense bright green mound to the ground; on the sea bluffs clipped low
// and swept inland by the wind
export function coyoteBrush(seed, windswept = false) {
	const r = mulberry32(seed), w = new Builder(), b = new Builder();
	const H = windswept ? 0.55 + r() * 0.3 : 1.1 + r() * 0.6, RX = windswept ? 1.2 + r() * 0.5 : 0.9 + r() * 0.5;
	stems(w, r, 6, H * 0.8, RX * 0.7, WOOD, 0.03);
	const c = V(windswept ? 0.25 : 0, H * 0.48, 0);
	dome(b, r, c, RX, H * 0.55, windswept ? 38 : 46, 0.62, { r: 0.28, g: 0.4, b: 0.16 }, CELL.coyote, 0.5);
	// the skirt: foliage right down into the grass
	for (let i = 0; i < 8; i++) { const a = r() * 6.28, d = RX * (0.7 + r() * 0.3); acard(b, V(Math.cos(a) * d, 0.15 + r() * 0.12, Math.sin(a) * d), 0.5, r, { r: 0.2, g: 0.3, b: 0.12 }, 0.3, V(Math.cos(a), 0.6, Math.sin(a)), CELL.coyote); }
	return { parts: [w.geometry(), b.geometry()], height: H };
}
// chamise: a thicket of straight wiry stems, olive needle-leaf bundles toward the tops
export function chamise(seed) {
	const r = mulberry32(seed), w = new Builder(), b = new Builder();
	const H = 1.4 + r() * 1.1, RX = 0.8 + r() * 0.5;
	const tips = stems(w, r, 8, H * 0.9, RX * 0.85, new THREE.Color(0.3, 0.26, 0.22), 0.02, 0.15);
	for (let i = 0; i < tips.length; i += 2) {
		const t = tips[i];
		for (let k = 0; k < 3; k++) acard(b, t.clone().add(V((r() - 0.5) * 0.4, -k * 0.28 - r() * 0.15, (r() - 0.5) * 0.4)), 0.62, r, { r: 0.3, g: 0.34, b: 0.18 }, 0.7, V(t.x, 0.5, t.z), CELL.chamise);
	}
	dome(b, r, V(0, H * 0.55, 0), RX, H * 0.48, 34, 0.75, { r: 0.24, g: 0.28, b: 0.15 }, CELL.chamise, 0.6, 0.35);
	return { parts: [w.geometry(), b.geometry()], height: H };
}
// manzanita: twisting smooth mahogany-red limbs, an open crown of grey-green leaves
export function manzanita(seed) {
	const r = mulberry32(seed), w = new Builder(), b = new Builder();
	const H = 1.6 + r() * 1.6, RED = new THREE.Color(0.58, 0.2, 0.11);
	const n = 4 + Math.floor(r() * 3), ends = [];
	for (let i = 0; i < n; i++) {
		const a = i / n * 6.283 + r() * 0.6, pts = [], rr = [];
		let x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08, dir = a;
		for (let q = 0; q <= 6; q++) {
			const t = q / 6;
			dir += (r() - 0.5) * 0.9;
			x += Math.cos(dir) * 0.22 * (0.4 + t); z += Math.sin(dir) * 0.22 * (0.4 + t);
			pts.push(V(q === 0 ? Math.cos(a) * 0.05 : x, q === 0 ? -0.1 : H * 0.85 * Math.pow(t, 0.85), q === 0 ? Math.sin(a) * 0.05 : z));
			rr.push(0.07 * (1 - t * 0.7));
		}
		tube(w, pts, rr, 5, RED, (t) => t * 0.3);
		ends.push(pts[6], pts[4]);
		// a side branch or two
		const o = pts[3], ba = dir + (r() < 0.5 ? 1 : -1) * 1.1;
		tube(w, [o, o.clone().add(V(Math.cos(ba) * 0.35, 0.3, Math.sin(ba) * 0.35)), o.clone().add(V(Math.cos(ba) * 0.6, 0.45 + r() * 0.3, Math.sin(ba) * 0.6))], [0.035, 0.025, 0.012], 4, RED, (t) => 0.3 + t * 0.3);
		ends.push(o.clone().add(V(Math.cos(ba) * 0.6, 0.6, Math.sin(ba) * 0.6)));
	}
	for (const e of ends) for (let k = 0; k < 5; k++) acard(b, e.clone().add(V((r() - 0.5) * 0.7, (r() - 0.2) * 0.5, (r() - 0.5) * 0.7)), 0.7, r, { r: 0.42, g: 0.48, b: 0.38 }, 0.6, V(e.x, 0.8, e.z), CELL.manzanita);
	return { parts: [w.geometry(), b.geometry()], height: H };
}
// toyon: a big multi-stemmed shrub, near a small tree, dark glossy leaves; red berries
// in winter (Nov-Feb)
export function toyon(seed, berries = false) {
	const r = mulberry32(seed), w = new Builder(), b = new Builder();
	const H = 2.6 + r() * 1.6, RX = 1.4 + r() * 0.7;
	stems(w, r, 7, H * 0.75, RX * 0.6, new THREE.Color(0.45, 0.42, 0.38), 0.06, 0.2);
	dome(b, r, V(0, H * 0.58, 0), RX, H * 0.45, 58, 0.85, { r: 0.18, g: 0.28, b: 0.12 }, CELL.toyon, 0.6);
	dome(b, r, V(0, H * 0.3, 0), RX * 0.8, H * 0.28, 12, 0.8, { r: 0.13, g: 0.2, b: 0.09 }, CELL.toyon, 0.4);
	if (berries) for (let i = 0; i < 16; i++) {
		const th = r() * 6.28, ph = r() * 1.2, p = V(Math.sin(ph) * Math.cos(th) * RX, H * 0.58 + Math.cos(ph) * H * 0.45, Math.sin(ph) * Math.sin(th) * RX);
		for (let k = 0; k < 5; k++) bead(w, p.clone().add(V((r() - 0.5) * 0.12, (r() - 0.5) * 0.08, (r() - 0.5) * 0.12)), 0.035, { r: 0.75, g: 0.08, b: 0.05 });
	}
	return { parts: [w.geometry(), b.geometry()], height: H };
}
// poison oak: a loose low thicket of thin stems, leaves of three (the instance tint turns
// it red in late summer and fall)
export function poisonOak(seed) {
	const r = mulberry32(seed), w = new Builder(), b = new Builder();
	const H = 0.6 + r() * 0.8, RX = 0.7 + r() * 0.6;
	const tips = stems(w, r, 9, H, RX, new THREE.Color(0.4, 0.34, 0.28), 0.015, 0.5);
	for (const t of tips) for (let k = 0; k < 2; k++) acard(b, t.clone().add(V((r() - 0.5) * 0.3, (r() - 0.6) * 0.3, (r() - 0.5) * 0.3)), 0.45, r, { r: 0.3, g: 0.42, b: 0.16 }, 0.8, V(0, 1, 0), CELL.poisonoak, 0.3);
	dome(b, r, V(0, H * 0.4, 0), RX, H * 0.4, 10, 0.45, { r: 0.26, g: 0.38, b: 0.14 }, CELL.poisonoak, 0.6);
	return { parts: [w.geometry(), b.geometry()], height: H };
}
// California sagebrush and black sage: a soft silver-grey mound
export function sage(seed) {
	const r = mulberry32(seed), w = new Builder(), b = new Builder();
	const H = 0.7 + r() * 0.5, RX = 0.6 + r() * 0.4;
	stems(w, r, 6, H * 0.8, RX * 0.6, new THREE.Color(0.45, 0.42, 0.38), 0.018);
	dome(b, r, V(0, H * 0.5, 0), RX, H * 0.5, 30, 0.55, { r: 0.46, g: 0.5, b: 0.42 }, CELL.sage, 0.9);
	return { parts: [w.geometry(), b.geometry()], height: H };
}
// huckleberry: an upright shrub of flat sprays of small dark leaves, in the redwood gaps
export function huckleberry(seed) {
	const r = mulberry32(seed), w = new Builder(), b = new Builder();
	const H = 1.0 + r() * 1.0, RX = 0.6 + r() * 0.4;
	const tips = stems(w, r, 8, H, RX, new THREE.Color(0.4, 0.3, 0.24), 0.02, 0.2);
	for (const t of tips) for (let k = 0; k < 3; k++) acard(b, t.clone().add(V((r() - 0.5) * 0.4, -k * 0.2, (r() - 0.5) * 0.4)), 0.55, r, { r: 0.16, g: 0.26, b: 0.12 }, 0.8, V(0, 1, 0), CELL.huckle, 0.4);
	return { parts: [w.geometry(), b.geometry()], height: H };
}
// a sword fern: a fountain of 20-40 long, stiff, arching fronds from one crown
export function swordFern(seed) {
	const r = mulberry32(seed), b = new Builder();
	const n = 16 + Math.floor(r() * 10), L0 = 0.8 + r() * 0.5;
	const u0 = (CELL.fern % AC) / AC, v0 = 1 - (Math.floor(CELL.fern / AC) + 1) / AR;
	for (let f = 0; f < n; f++) {
		const a = f * 2.39996 + r() * 0.3, L = L0 * (0.7 + r() * 0.45), elev = 1.25 - (f / n) * 0.75 + (r() - 0.5) * 0.2, dir = V(Math.cos(a), 0, Math.sin(a));
		const pts = [], widths = [];
		for (let k = 0; k <= 6; k++) {
			const s = k / 6, d = L * s;
			pts.push(dir.clone().multiplyScalar(Math.cos(elev) * d).add(V(0, Math.sin(elev) * d - 0.55 * d * d / L, 0)));
			widths.push(0.2 * Math.sin(Math.min(1, s * 1.05 + 0.1) * Math.PI) + 0.02);
		}
		const i0 = b.p.length / 3;
		const tone = 0.8 + r() * 0.35;
		strip(b, pts, widths, 0.18, { r: 0.13 * tone, g: 0.26 * tone, b: 0.09 * tone }, { r: 0.2 * tone, g: 0.36 * tone, b: 0.12 * tone }, 0.2, 1.0, 0.75);
		// the frond's picture from the atlas cell: u along the frond, v across it
		for (let q = i0; q < b.p.length / 3; q++) { b.uv[q * 2] = u0 + 0.01 + b.uv[q * 2] * (1 / AC - 0.02); b.uv[q * 2 + 1] = v0 + 0.01 + b.uv[q * 2 + 1] * (1 / AR - 0.02); }
	}
	// the old fronds lying brown under the fountain
	for (let f = 0; f < 5; f++) {
		const a = r() * 6.28, L = L0 * 0.8, dir = V(Math.cos(a), 0, Math.sin(a)), pts = [], widths = [];
		for (let k = 0; k <= 4; k++) { const s = k / 4; pts.push(dir.clone().multiplyScalar(L * s).add(V(0, 0.06 + 0.1 * Math.sin(s * 3), 0))); widths.push(0.16 * Math.sin(Math.min(1, s + 0.1) * Math.PI) + 0.02); }
		const i0 = b.p.length / 3;
		strip(b, pts, widths, 0.1, { r: 0.32, g: 0.22, b: 0.12 }, { r: 0.38, g: 0.28, b: 0.16 }, 0, 0.1, 0.9);
		for (let q = i0; q < b.p.length / 3; q++) { b.uv[q * 2] = u0 + 0.01 + b.uv[q * 2] * (1 / AC - 0.02); b.uv[q * 2 + 1] = v0 + 0.01 + b.uv[q * 2 + 1] * (1 / AR - 0.02); }
	}
	return { parts: [b.geometry()], height: L0 };
}
// redwood sorrel: a low carpet of clover-like leaves, a hand high
export function sorrel(seed) {
	const r = mulberry32(seed), b = new Builder();
	for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 1.1; acard(b, V(Math.cos(a) * d, 0.07 + r() * 0.08, Math.sin(a) * d), 0.42, r, { r: 0.28, g: 0.46, b: 0.16 }, 0.3, V(0, 1, 0), CELL.huckle, 0.85); }
	return { parts: [b.geometry()], height: 0.15 };
}

// ---------- grass in bunches ----------
// a tuft: blades as thin bent tapering strips from one crown. kind: 'bunch' (brome and
// needlegrass, fine and arching), 'oat' (wild oats: taller stems with nodding seed
// spikelets), 'short' (grazed). Vertex colour runs dark at the root to pale at the tip;
// the instance tint gives it its season.
export function tuft(seed, kind = 'bunch') {
	const r = mulberry32(seed), b = new Builder();
	const n = kind === 'short' ? 22 : kind === 'oat' ? 20 : 30, H = kind === 'short' ? 0.16 : kind === 'oat' ? 0.55 : 0.42;
	const nz = V(0, 1, 0);
	for (let i = 0; i < n; i++) {
		const a = r() * 6.28, h = H * (0.55 + r() * 0.6), lean = 0.15 + r() * 0.55, w = 0.012 + r() * 0.008, dx = Math.cos(a), dz = Math.sin(a);
		const o = V(dx * r() * 0.07, 0, dz * r() * 0.07), side = V(-dz, 0, dx);
		const seg = 3, ids = [];
		for (let k = 0; k <= seg; k++) {
			const t = k / seg, bend = lean * t * t;
			const p = o.clone().add(V(dx * bend * h * 0.8, h * t * (1 - bend * 0.35), dz * bend * h * 0.8));
			const ww = w * (1 - t * 0.9), l = 0.55 + 0.45 * t;
			const col = { r: l, g: l, b: l };
			const nn = nz.clone().add(V(dx * 0.4, 0, dz * 0.4)).normalize();
			ids.push(b.vert(p.clone().add(side.clone().multiplyScalar(-ww)), nn, [0, t], col, t), b.vert(p.clone().add(side.clone().multiplyScalar(ww)), nn, [1, t], col, t));
		}
		for (let k = 0; k < seg; k++) { const q = k * 2; b.tri(ids[q], ids[q + 1], ids[q + 2]); b.tri(ids[q + 1], ids[q + 3], ids[q + 2]); }
		// wild oats: a stem stands above the leaves and nods its spikelets
		if (kind === 'oat' && i % 3 === 0) {
			const top = o.clone().add(V(dx * 0.08, H * (1.1 + r() * 0.4), dz * 0.08));
			tube(b, [o.clone(), o.clone().lerp(top, 0.5), top], [0.004, 0.003, 0.002], 3, { r: 0.8, g: 0.8, b: 0.8 }, (t) => t);
			for (let k = 0; k < 5; k++) {
				const s = top.clone().add(V((r() - 0.5) * 0.08, -0.02 - k * 0.035, (r() - 0.5) * 0.08)), e = s.clone().add(V((r() - 0.5) * 0.04, -0.05, (r() - 0.5) * 0.04));
				tube(b, [s, e], [0.007, 0.002], 3, { r: 1.05, g: 1.02, b: 0.9 }, () => 1);
			}
		}
	}
	return { parts: [b.geometry()], height: H };
}
// the weeds of the disturbed ground: yellow star-thistle (grey-green, spiny yellow heads),
// fennel (tall feathery, umbels), black mustard (yellow in spring); colours are baked,
// the tint only shades
export function weed(seed, kind = 'thistle') {
	const r = mulberry32(seed), b = new Builder();
	const H = kind === 'fennel' ? 1.3 + r() * 0.6 : kind === 'mustard' ? 1.0 + r() * 0.5 : 0.5 + r() * 0.3;
	const STEM = kind === 'thistle' ? { r: 0.5, g: 0.55, b: 0.42 } : kind === 'fennel' ? { r: 0.38, g: 0.48, b: 0.26 } : { r: 0.4, g: 0.46, b: 0.24 };
	const HEAD = kind === 'thistle' ? { r: 0.85, g: 0.7, b: 0.18 } : kind === 'fennel' ? { r: 0.72, g: 0.66, b: 0.26 } : { r: 0.9, g: 0.78, b: 0.12 };
	const n = kind === 'thistle' ? 5 : 3 + Math.floor(r() * 3);
	for (let i = 0; i < n; i++) {
		const a = r() * 6.28, top = V(Math.cos(a) * 0.15, H * (0.7 + r() * 0.3), Math.sin(a) * 0.15);
		tube(b, [V(0, -0.02, 0), V(Math.cos(a) * 0.05, H * 0.5, Math.sin(a) * 0.05), top], [0.012, 0.008, 0.005], 3, STEM, (t) => t * 0.9);
		// branches, each with its flower head
		for (let k = 0; k < (kind === 'thistle' ? 4 : 6); k++) {
			const s = V(0, 0, 0).lerp(top, 0.45 + k * 0.09), ba = r() * 6.28, e = s.clone().add(V(Math.cos(ba) * 0.12, 0.08 + r() * 0.1, Math.sin(ba) * 0.12));
			tube(b, [s, e], [0.005, 0.003], 3, STEM, (t) => 0.6 + t * 0.4);
			bead(b, e, kind === 'thistle' ? 0.022 : 0.03, HEAD);
		}
		bead(b, top, kind === 'fennel' ? 0.06 : 0.03, HEAD);
	}
	return { parts: [b.geometry()], height: H };
}
