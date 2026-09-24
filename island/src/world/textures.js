// Painted at load: every plant texture is drawn on a canvas, so the world
// needs no image downloads. Greys and pale greens; instance colour tints them.

import * as THREE from 'three';
import { mulberry32 } from '../noise.js';

function canvas(w, h) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	return [c, c.getContext('2d')];
}
function finish(c, repeat) {
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
	return t;
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// make a canvas tile seamlessly top-to-bottom: lay a copy shifted by half its height
// over the top and bottom quarters, fading to nothing in the middle
function tileV(c) {
	const W = c.width, H = c.height, t = document.createElement('canvas');
	t.width = W; t.height = H;
	const g = t.getContext('2d');
	g.drawImage(c, 0, H / 2); g.drawImage(c, 0, -H / 2);
	g.globalCompositeOperation = 'destination-in';
	const m = g.createLinearGradient(0, 0, 0, H);
	m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.3, 'rgba(0,0,0,0)'); m.addColorStop(0.7, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
	g.fillStyle = m; g.fillRect(0, 0, W, H);
	c.getContext('2d').drawImage(t, 0, 0);
	return c;
}

// a cluster of broad tropical leaves on a twig, for tree canopies
export function leafCluster() {
	// a rounded clump of broad leaves: dense in the middle, broken at the edge
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(71);
	for (let i = 0; i < 95; i++) {
		const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * S * 0.4;
		const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
		const len = S * (0.075 + r() * 0.04), w = len * (0.5 + r() * 0.12), ang = a + (r() - 0.5) * 1.6;
		// deeper leaves darker: they are behind and under the outer ones
		const l = (150 + r() * 105) * (0.65 + 0.35 * (d / (S * 0.4)));
		g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2);
		const gr = g.createLinearGradient(-w, 0, w, 0);
		gr.addColorStop(0, rgb(l * 0.82, l, l * 0.7)); gr.addColorStop(1, rgb(l * 0.6, l * 0.78, l * 0.52));
		g.fillStyle = gr;
		g.beginPath(); g.moveTo(0, -len); g.quadraticCurveTo(w, -len * 0.1, 0, len); g.quadraticCurveTo(-w, -len * 0.1, 0, -len); g.fill();
		g.strokeStyle = rgb(l * 0.5, l * 0.62, l * 0.42, 0.7); g.lineWidth = 1;
		g.beginPath(); g.moveTo(0, -len * 0.85); g.lineTo(0, len * 0.85); g.stroke();
		g.restore();
	}
	return finish(c);
}

// a coconut-palm frond: a rachis with long drooping leaflets either side
export function palmFrond() {
	const W = 512, H = 128, [c, g] = canvas(W, H), r = mulberry32(12);
	g.filter = 'blur(1px)';
	g.strokeStyle = rgb(170, 160, 110); g.lineWidth = 4;
	g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
	for (let i = 6; i < W - 6; i += 9) {
		const t = i / W, len = H * 0.5 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (0.85 + r() * 0.2);
		for (const s of [-1, 1]) {
			const l = 150 + r() * 90;
			g.strokeStyle = rgb(l * 0.78, l, l * 0.55);
			g.lineWidth = 5.2 * (1 - t * 0.45);
			g.beginPath(); g.moveTo(i, H / 2);
			g.quadraticCurveTo(i + len * 0.35, H / 2 + s * len * 0.6, i + len * 0.55, H / 2 + s * len * 0.98);
			g.stroke();
		}
	}
	return finish(c);
}

// a broad banana leaf: midrib, parallel veins and wind tears
export function bananaLeaf() {
	const W = 256, H = 128, [c, g] = canvas(W, H), r = mulberry32(5);
	g.save();
	g.beginPath();
	g.moveTo(2, H / 2);
	g.bezierCurveTo(W * 0.25, 4, W * 0.75, 6, W - 2, H / 2);
	g.bezierCurveTo(W * 0.75, H - 6, W * 0.25, H - 4, 2, H / 2);
	g.closePath();
	g.clip();
	const gr = g.createLinearGradient(0, 0, 0, H);
	gr.addColorStop(0, rgb(170, 215, 120)); gr.addColorStop(0.5, rgb(215, 245, 170)); gr.addColorStop(1, rgb(150, 200, 105));
	g.fillStyle = gr; g.fillRect(0, 0, W, H);
	g.strokeStyle = rgb(120, 170, 80, 0.55); g.lineWidth = 1;
	for (let i = 8; i < W; i += 5) {
		g.beginPath(); g.moveTo(i, H / 2); g.lineTo(i + 18, 2); g.moveTo(i, H / 2); g.lineTo(i + 18, H - 2); g.stroke();
	}
	// tears
	g.globalCompositeOperation = 'destination-out';
	for (let i = 0; i < 9; i++) {
		const x = 30 + r() * (W - 60), side = r() < 0.5 ? -1 : 1;
		g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, H / 2 + side * 6); g.lineTo(x + 22, side > 0 ? H : 0); g.stroke();
	}
	g.restore();
	g.strokeStyle = rgb(225, 235, 175); g.lineWidth = 3;
	g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
	return finish(c);
}

// a fern frond: pinnate, tapering
export function fernFrond() {
	const W = 256, H = 96, [c, g] = canvas(W, H), r = mulberry32(33);
	g.strokeStyle = rgb(120, 150, 70); g.lineWidth = 2;
	g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
	for (let i = 6; i < W - 4; i += 7) {
		const t = i / W, len = H * 0.46 * (1 - t * 0.85);
		for (const s of [-1, 1]) {
			const l = 150 + r() * 80;
			g.fillStyle = rgb(l * 0.72, l, l * 0.5);
			g.beginPath(); g.ellipse(i + len * 0.25, H / 2 + s * len * 0.5, len * 0.22, len * 0.5, s * 0.5, 0, Math.PI * 2); g.fill();
		}
	}
	return finish(c);
}

// grass: a strip of tapering blades
export function grassStrip() {
	// crisp at close range: 256 px, each blade a tapered, slightly curved leaf with a
	// midrib, so grass right in front of you reads as blades, not streaks
	const W = 256, H = 256, [c, g] = canvas(W, H), r = mulberry32(8);
	for (let i = 0; i < 18; i++) {
		const x = 12 + r() * (W - 24), top = H * (0.02 + r() * 0.42), l = 190 + r() * 45, lean = (r() - 0.5) * 30, w = 4.5 + r() * 3;
		const gr = g.createLinearGradient(0, H, 0, top);
		gr.addColorStop(0, rgb(l * 0.62, l * 0.72, l * 0.42)); gr.addColorStop(1, rgb(l * 0.95, l, l * 0.7));
		g.fillStyle = gr;
		const mx = x + lean * 0.45, my = (H + top) / 2;
		g.beginPath();
		g.moveTo(x - w, H);
		g.quadraticCurveTo(mx - w * 0.6, my, x + lean, top);
		g.quadraticCurveTo(mx + w * 0.6, my, x + w, H);
		g.closePath(); g.fill();
		g.strokeStyle = rgb(l * 0.7, l * 0.8, l * 0.5, 0.5); g.lineWidth = 1;
		g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(mx, my, x + lean, top + 4); g.stroke();
	}
	return finish(c);
}

// clapboard siding: horizontal boards with shadow lines, tinted per house
export function siding() {
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(4);
	for (let y = 0; y < S; y += 16) {
		const l = 225 + r() * 25;
		g.fillStyle = rgb(l, l, l); g.fillRect(0, y, S, 16);
		g.fillStyle = rgb(170, 170, 170, 0.3); g.fillRect(0, y + 13, S, 3);
		g.fillStyle = rgb(255, 255, 255, 0.35); g.fillRect(0, y, S, 1);
	}
	for (let i = 0; i < 400; i++) { g.fillStyle = rgb(0, 0, 0, 0.04); g.fillRect(r() * S, r() * S, 2 + r() * 10, 1); }
	return finish(c, true);
}

// corrugated tin / shingle roof
export function roofing() {
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(9);
	for (let x = 0; x < S; x += 8) {
		const gr = g.createLinearGradient(x, 0, x + 8, 0);
		gr.addColorStop(0, rgb(170, 170, 170)); gr.addColorStop(0.5, rgb(245, 245, 245)); gr.addColorStop(1, rgb(160, 160, 160));
		g.fillStyle = gr; g.fillRect(x, 0, 8, S);
	}
	for (let i = 0; i < 60; i++) { g.fillStyle = rgb(110, 80, 60, 0.12); g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 8, 0, 7); g.fill(); }
	return finish(c, true);
}

// weathered planks for piers and porches
export function planks() {
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(21);
	for (let x = 0; x < S; x += 32) {
		const l = 150 + r() * 50;
		g.fillStyle = rgb(l, l * 0.86, l * 0.68); g.fillRect(x, 0, 32, S);
		g.fillStyle = rgb(40, 30, 20, 0.6); g.fillRect(x + 30, 0, 2, S);
		for (let i = 0; i < 12; i++) { g.fillStyle = rgb(90, 70, 50, 0.18); g.fillRect(x + r() * 30, r() * S, 1, 20 + r() * 60); }
	}
	return finish(c, true);
}

export function glow() {
	const S = 64, [c, g] = canvas(S, S);
	const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
	gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr; g.fillRect(0, 0, S, S);
	return finish(c);
}

// Ground micro-relief, one tileable height field per channel, drawn per pixel:
// r sand (grain and wind ripples), g dirt (packed earth and gravel),
// b soil under the meadow (clods, litter, roots), a rock (grain and cracks).
// Linear data, not colour: the terrain uses it for both shade and bumps.
export function groundDetail() {
	const S = 512, data = new Uint8Array(S * S * 4), r = mulberry32(606);
	const lat = (P, salt) => {
		const t = new Float32Array(P * P);
		for (let i = 0; i < t.length; i++) t[i] = mulberry32(salt * 7919 + i)();
		return t;
	};
	const L = {};
	const noise = (x, y, P, salt) => {
		// periodic value noise on a P x P lattice across the tile
		const t = L[P + ':' + salt] || (L[P + ':' + salt] = lat(P, salt));
		const fx = x * P, fy = y * P, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
		const a = t[(j % P) * P + (i % P)], b = t[(j % P) * P + ((i + 1) % P)];
		const c = t[((j + 1) % P) * P + (i % P)], d = t[((j + 1) % P) * P + ((i + 1) % P)];
		const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
		return (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
	};
	const fbm = (x, y, P, salt, oct) => { let s = 0, a = 0.5, n = 0; for (let o = 0; o < oct; o++) { s += a * noise(x, y, P << o, salt + o); n += a; a *= 0.5; } return s / n; };
	// periodic Worley cells for stones, pebbles and clods
	const cellsOf = (G, salt) => {
		const rr = mulberry32(salt), pts = [];
		for (let i = 0; i < G * G; i++) pts.push([rr(), rr(), 0.35 + rr() * 0.6, rr()]);
		return { G, pts };
	};
	const stone = (x, y, C) => {
		const G = C.G, fx = x * G, fy = y * G, ci = Math.floor(fx), cj = Math.floor(fy);
		let best = 0, id = 0;
		for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
			const ii = (ci + di + G) % G, jj = (cj + dj + G) % G, p = C.pts[jj * G + ii];
			const dx = fx - (ci + di + p[0]), dy = fy - (cj + dj + p[1]);
			const d = Math.hypot(dx * 1.15, dy) / (p[2] * 0.5);
			if (d < 1) { const hgt = Math.sqrt(1 - d * d) * (0.6 + 0.4 * p[3]); if (hgt > best) { best = hgt; id = p[3]; } }
		}
		return [best, id];
	};
	const gravel = cellsOf(22, 11), grit = cellsOf(58, 12), clods = cellsOf(16, 13), chips = cellsOf(30, 14), crumbs = cellsOf(44, 16);
	void r;
	for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
		const u = x / S, v = y / S, k = (y * S + x) * 4;
		// sand: fine grain over soft ripples that wander
		const warp = fbm(u, v, 4, 1, 3) * 2.5;
		const rip = Math.pow(0.5 + 0.5 * Math.sin((v * 18 + warp + fbm(u, v, 8, 2, 2) * 0.6) * Math.PI * 2), 1.6);
		const sand = 0.45 * rip + 0.35 * noise(u, v, 256, 3) + 0.2 * fbm(u, v, 32, 4, 3);
		// dirt: packed earth, scattered gravel and grit
		const [gv, gid] = stone(u, v, gravel), [gr] = stone(u, v, grit);
		const dirt = Math.max(0.34 * fbm(u, v, 16, 5, 4) + 0.2 * noise(u, v, 128, 6), gv * (gid > 0.7 ? 0.8 : 0), gr * (gid < 0.25 ? 0.5 : 0.22));
		// soil: clods and fibrous litter
		const [cv] = stone(u, v, clods), [cr] = stone(u, v, crumbs);
		const soil = Math.max(0.3 * fbm(u, v, 32, 8, 3) + 0.15 * noise(u, v, 128, 7), cv * 0.65, cr * 0.4);
		// rock: crystalline grain, chips and dark cracks
		const [chv] = stone(u, v, chips);
		const crack = Math.abs(fbm(u, v, 8, 9, 4) - 0.5) < 0.012 ? 0 : 1;
		const rock = (0.4 * fbm(u, v, 16, 10, 4) + 0.3 * noise(u, v, 256, 15) + 0.3 * chv) * (0.35 + 0.65 * crack);
		data[k] = Math.min(255, sand * 255); data[k + 1] = Math.min(255, dirt * 255);
		data[k + 2] = Math.min(255, soil * 255); data[k + 3] = Math.min(255, rock * 255);
	}
	const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.magFilter = THREE.LinearFilter;
	t.minFilter = THREE.LinearMipmapLinearFilter;
	t.generateMipmaps = true;
	t.anisotropy = 8;
	t.needsUpdate = true;
	return t;
}

// coconut-palm trunk: stacked leaf-scar rings, fibrous between them
export function palmBark() {
	const W = 128, H = 256, [c, g] = canvas(W, H), r = mulberry32(44);
	g.fillStyle = rgb(170, 158, 140); g.fillRect(0, 0, W, H);
	for (let i = 0; i < 700; i++) { const l = 120 + r() * 90; g.fillStyle = rgb(l, l * 0.92, l * 0.8, 0.35); g.fillRect(r() * W, r() * H, 1 + r() * 2, 3 + r() * 10); }
	const rings = 12;
	for (let k = 0; k < rings; k++) {
		const y = (k + 0.5) / rings * H, wob = 2 + r() * 2;
		g.strokeStyle = rgb(70, 60, 50, 0.75); g.lineWidth = 2 + r() * 2;
		g.beginPath();
		for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x / W * Math.PI * 2 * 2 + k) * wob);
		g.stroke();
		g.strokeStyle = rgb(215, 205, 185, 0.45); g.lineWidth = 1.5;
		g.beginPath();
		for (let x = 0; x <= W; x += 8) g.lineTo(x, y + 3 + Math.sin(x / W * Math.PI * 2 * 2 + k) * wob);
		g.stroke();
	}
	return finish(c, true);
}

// hardwood bark: vertical furrows and plates, lichen patches
export function woodBark() {
	const W = 256, H = 256, [c, g] = canvas(W, H), r = mulberry32(45);
	g.fillStyle = rgb(150, 138, 122); g.fillRect(0, 0, W, H);
	for (let i = 0; i < 70; i++) {
		const x = r() * W, w = 3 + r() * 6, l = 60 + r() * 40;
		g.strokeStyle = rgb(l, l * 0.9, l * 0.8, 0.8); g.lineWidth = w * 0.5;
		g.beginPath(); let xx = x;
		for (let y = -10; y <= H + 10; y += 16) { xx += (r() - 0.5) * 6; g.lineTo(xx, y); }
		g.stroke();
		// wrap copies so the seam is clean
		g.save(); g.translate(x > W / 2 ? -W : W, 0); g.stroke(); g.restore();
	}
	for (let i = 0; i < 400; i++) { const l = 160 + r() * 70; g.fillStyle = rgb(l, l * 0.95, l * 0.85, 0.3); g.fillRect(r() * W, r() * H, 2 + r() * 5, 6 + r() * 16); }
	for (let i = 0; i < 14; i++) { g.fillStyle = rgb(150 + r() * 40, 170 + r() * 30, 120, 0.25); g.beginPath(); g.arc(r() * W, r() * H, 6 + r() * 16, 0, 7); g.fill(); }
	return finish(tileV(c), true);
}

// a flowering tropical shrub: glossy leaves with blossoms, painted in full colour
// (instance tint only varies brightness). kind: 'hibiscus' | 'bougainvillea'
export function bloomCluster(kind) {
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(kind === 'hibiscus' ? 81 : 82);
	const leaf = (x, y, len, ang, l) => {
		const w = len * 0.45;
		g.save(); g.translate(x, y); g.rotate(ang);
		const gr = g.createLinearGradient(-w, 0, w, 0);
		gr.addColorStop(0, rgb(46 * l, 92 * l, 34 * l)); gr.addColorStop(1, rgb(30 * l, 70 * l, 26 * l));
		g.fillStyle = gr;
		g.beginPath(); g.moveTo(0, -len); g.quadraticCurveTo(w, -len * 0.1, 0, len); g.quadraticCurveTo(-w, -len * 0.1, 0, -len); g.fill();
		g.strokeStyle = rgb(80 * l, 130 * l, 60 * l, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(0, -len * 0.9); g.lineTo(0, len * 0.9); g.stroke();
		g.restore();
	};
	for (let i = 0; i < 34; i++) {
		const a = r() * 6.283, d = r() * S * 0.36;
		leaf(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (0.07 + r() * 0.04), r() * 6.283, 0.9 + r() * 0.5);
	}
	if (kind === 'hibiscus') {
		// a few big five-petalled red flowers with a pale throat and a long stamen
		for (let i = 0; i < 6; i++) {
			const x = S * (0.22 + r() * 0.56), y = S * (0.22 + r() * 0.56), R = S * (0.07 + r() * 0.025), rot = r() * 6.283;
			const hue = r() < 0.7 ? [214, 38, 52] : [245, 120, 60];
			for (let p = 0; p < 5; p++) {
				const a = rot + p / 5 * 6.283;
				const gr = g.createRadialGradient(x, y, 0, x, y, R * 1.1);
				gr.addColorStop(0, rgb(120, 10, 30)); gr.addColorStop(0.3, rgb(...hue)); gr.addColorStop(1, rgb(hue[0] * 1.05, hue[1] * 1.2, hue[2] * 1.1));
				g.fillStyle = gr;
				g.beginPath(); g.ellipse(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, R * 0.62, R * 0.45, a, 0, 6.283); g.fill();
			}
			g.strokeStyle = rgb(250, 220, 120); g.lineWidth = 2;
			g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(rot) * R * 0.9, y + Math.sin(rot) * R * 0.9); g.stroke();
		}
	} else {
		// dense clusters of papery magenta bracts
		for (let i = 0; i < 26; i++) {
			const x = S * (0.15 + r() * 0.7), y = S * (0.15 + r() * 0.7);
			for (let k = 0; k < 6; k++) {
				const bx = x + (r() - 0.5) * 22, by = y + (r() - 0.5) * 22, R = 5 + r() * 5, l = 0.8 + r() * 0.35;
				g.fillStyle = rgb(210 * l, 40 * l, 150 * l);
				g.beginPath(); g.ellipse(bx, by, R, R * 0.75, r() * 3, 0, 6.283); g.fill();
				g.fillStyle = rgb(250, 240, 220); g.fillRect(bx - 0.8, by - 0.8, 1.6, 1.6);
			}
		}
	}
	// fade the square edge so cards never show a border
	g.globalCompositeOperation = 'destination-in';
	const m = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
	m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
	g.fillStyle = m; g.fillRect(0, 0, S, S);
	return finish(c);
}

// banana pseudostem: overlapping green sheaths streaked with brown and a dusty bloom
export function bananaStem() {
	const W = 128, H = 256, [c, g] = canvas(W, H), r = mulberry32(91);
	const gr = g.createLinearGradient(0, 0, W, 0);
	gr.addColorStop(0, rgb(120, 150, 70)); gr.addColorStop(0.5, rgb(150, 175, 90)); gr.addColorStop(1, rgb(115, 145, 68));
	g.fillStyle = gr; g.fillRect(0, 0, W, H);
	for (let i = 0; i < 90; i++) { const x = r() * W, l = r(); g.fillStyle = l < 0.5 ? rgb(95, 120, 55, 0.35) : rgb(175, 190, 120, 0.3); g.fillRect(x, r() * H, 1 + r() * 2, 20 + r() * 80); }
	for (let i = 0; i < 16; i++) { g.fillStyle = rgb(110 + r() * 30, 80 + r() * 20, 50, 0.5); g.fillRect(r() * W, r() * H, 3 + r() * 8, 30 + r() * 90); }
	// sheath edges
	for (let k = 0; k < 4; k++) { const x = (k + r() * 0.5) * W / 4; g.fillStyle = rgb(80, 100, 45, 0.6); g.fillRect(x, 0, 2, H); }
	return finish(c, true);
}

// rough coral-limestone blocks for foundations
export function stoneBlocks() {
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(61);
	g.fillStyle = rgb(170, 165, 150); g.fillRect(0, 0, S, S);
	for (let y = 0; y < S; y += 32) {
		const off = (y / 32) % 2 ? 24 : 0;
		for (let x = -48 + off; x < S; x += 48 + r() * 10) {
			const l = 150 + r() * 60;
			g.fillStyle = rgb(l, l * 0.97, l * 0.88); g.fillRect(x + 2, y + 2, 44 + r() * 6, 28);
			for (let k = 0; k < 20; k++) { g.fillStyle = rgb(90, 85, 75, 0.25); g.fillRect(x + r() * 44, y + r() * 28, 2, 2); }
		}
	}
	return finish(c, true);
}
