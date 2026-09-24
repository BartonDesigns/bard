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

// a cluster of broad tropical leaves on a twig, for tree canopies
export function leafCluster() {
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(71);
	g.strokeStyle = rgb(95, 80, 55); g.lineWidth = 3;
	const tips = [];
	for (let i = 0; i < 6; i++) {
		const a = -Math.PI / 2 + (r() - 0.5) * 2.4, len = S * (0.2 + r() * 0.2);
		const x = S / 2 + Math.cos(a) * len, y = S * 0.62 + Math.sin(a) * len;
		tips.push([x, y]);
		g.beginPath(); g.moveTo(S / 2, S * 0.95); g.quadraticCurveTo(S / 2, (y + S * 0.95) / 2, x, y); g.stroke();
	}
	for (let i = 0; i < 38; i++) {
		const t = tips[i % tips.length], x = t[0] + (r() - 0.5) * 70, y = t[1] + (r() - 0.5) * 70;
		if (Math.hypot(x - S / 2, y - S / 2) > S * 0.46) continue;
		const len = S * (0.09 + r() * 0.06), w = len * (0.42 + r() * 0.12), ang = r() * Math.PI * 2, l = 150 + r() * 105;
		g.save(); g.translate(x, y); g.rotate(ang);
		const gr = g.createLinearGradient(-w, 0, w, 0);
		gr.addColorStop(0, rgb(l * 0.82, l, l * 0.7)); gr.addColorStop(1, rgb(l * 0.62, l * 0.8, l * 0.55));
		g.fillStyle = gr;
		g.beginPath(); g.moveTo(0, -len); g.quadraticCurveTo(w, -len * 0.15, 0, len); g.quadraticCurveTo(-w, -len * 0.15, 0, -len); g.fill();
		g.strokeStyle = rgb(l * 0.45, l * 0.58, l * 0.4, 0.8); g.lineWidth = 1.2;
		g.beginPath(); g.moveTo(0, -len * 0.9); g.lineTo(0, len * 0.9); g.stroke();
		g.restore();
	}
	return finish(c);
}

// a coconut-palm frond: a rachis with long drooping leaflets either side
export function palmFrond() {
	const W = 512, H = 128, [c, g] = canvas(W, H), r = mulberry32(12);
	g.strokeStyle = rgb(170, 160, 110); g.lineWidth = 4;
	g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
	for (let i = 6; i < W - 6; i += 5) {
		const t = i / W, len = H * 0.5 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (0.85 + r() * 0.2);
		for (const s of [-1, 1]) {
			const l = 150 + r() * 90;
			g.strokeStyle = rgb(l * 0.78, l, l * 0.55);
			g.lineWidth = 2.6 * (1 - t * 0.5);
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
	const W = 128, H = 128, [c, g] = canvas(W, H), r = mulberry32(8);
	for (let i = 0; i < 26; i++) {
		const x = 4 + r() * (W - 8), top = r() * H * 0.35, l = 160 + r() * 90, lean = (r() - 0.5) * 20;
		const gr = g.createLinearGradient(0, H, 0, top);
		gr.addColorStop(0, rgb(l * 0.45, l * 0.6, l * 0.3)); gr.addColorStop(1, rgb(l * 0.9, l, l * 0.6));
		g.fillStyle = gr;
		g.beginPath(); g.moveTo(x - 2.5, H); g.quadraticCurveTo(x + lean * 0.4, (H + top) / 2, x + lean, top); g.lineTo(x + 2.5, H); g.fill();
	}
	return finish(c);
}

// clapboard siding: horizontal boards with shadow lines, tinted per house
export function siding() {
	const S = 256, [c, g] = canvas(S, S), r = mulberry32(4);
	for (let y = 0; y < S; y += 16) {
		const l = 225 + r() * 25;
		g.fillStyle = rgb(l, l, l); g.fillRect(0, y, S, 16);
		g.fillStyle = rgb(150, 150, 150, 0.55); g.fillRect(0, y + 14, S, 2);
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
