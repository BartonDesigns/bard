// The signage atlas: one canvas the graphics are drawn into (faces.js), packed on shelves,
// one texture for every sign, sticker, poster and tag in a region. Each face is drawn once
// and shared by every instance that shows it. sync() takes everything the region wants:
// what is already drawn stays, what is new is packed into the free room; when it will not
// fit, the sheet is cleared and packed again from the tallest down (the drawing is the same
// from the face alone, so a repack looks no different). A phone's sheet is a quarter the
// area; the faces scale down to fit it.

import * as THREE from 'three';
import { drawFace, faceDims } from './faces.js';

const PAD = 6;
export function faceKey(face) {
	let s = face.k;
	for (const k of Object.keys(face).sort()) if (k !== 'k') s += '|' + k + ':' + (face[k] && typeof face[k] === 'object' ? JSON.stringify(face[k]) : face[k]);
	return s;
}
export function createAtlas({ size = 2048, height = size, name = 'signage', scale = 1 } = {}) {
	const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	if (cv) { cv.width = size; cv.height = height; }
	const g = cv?.getContext('2d', { willReadFrequently: false });
	const tex = cv ? new THREE.CanvasTexture(cv) : new THREE.Texture();
	tex.name = name; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
	tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
	const entries = new Map();
	let shelves = [], nextY = 0, repacks = 0, drawn = 0;
	function reset() { entries.clear(); shelves = []; nextY = 0; g?.clearRect(0, 0, size, height); repacks++; }
	function alloc(w, h) {
		const W = w + PAD * 2, H = h + PAD * 2;
		if (W > size) return null;
		let best = null;
		for (const S of shelves) if (S.h >= H && S.h <= H * 2 + 8 && size - S.x >= W && (!best || S.h < best.h)) best = S;
		if (!best) {
			if (nextY + H > height) return null;
			best = { y: nextY, h: H, x: 0 };
			shelves.push(best); nextY += H;
		}
		const at = { x: best.x + PAD, y: best.y + PAD };
		best.x += W;
		return at;
	}
	function place(key, face, w, h) {
		const at = alloc(w, h);
		if (!at) return null;
		const e = { x: at.x, y: at.y, w, h, cell: [at.x / size + 0.5 / size, 1 - (at.y + h) / height + 0.5 / height, (w - 1) / size, (h - 1) / height] };
		if (g) {
			g.clearRect(at.x - PAD, at.y - PAD, w + PAD * 2, h + PAD * 2);
			drawFace(g, at.x, at.y, w, h, face);
			// (the gutter takes the edge's colour at zero alpha, so a far mip does not go dark round it)
		}
		entries.set(key, e);
		drawn++;
		return e;
	}
	// want: Map key -> { face, w, h } (metres); gives back nothing, get(key) the cells after
	function sync(want) {
		const fresh = [];
		for (const [key, W] of want) if (!entries.has(key)) { const [pw, ph] = faceDims(W.face, W.w, W.h); fresh.push([key, W.face, Math.round(pw * scale), Math.round(ph * scale)]); }
		if (!fresh.length) return 0;
		fresh.sort((a, b) => b[3] - a[3]);
		let ok = true;
		for (const [key, face, w, h] of fresh) if (!place(key, face, w, h)) { ok = false; break; }
		if (!ok) {
			reset();
			const all = [];
			for (const [key, W] of want) { const [pw, ph] = faceDims(W.face, W.w, W.h); all.push([key, W.face, Math.round(pw * scale), Math.round(ph * scale)]); }
			all.sort((a, b) => b[3] - a[3]);
			for (const [key, face, w, h] of all) {
				if (place(key, face, w, h)) continue;
				// (still no room: halved, and halved again)
				if (!place(key, face, Math.max(8, w >> 1), Math.max(8, h >> 1))) place(key, face, Math.max(8, w >> 2), Math.max(8, h >> 2));
			}
		}
		tex.needsUpdate = true;
		return fresh.length;
	}
	return {
		tex, canvas: cv, sync, reset,
		get: (key) => entries.get(key)?.cell || null,
		has: (key) => entries.has(key),
		info: () => ({ size: `${size}x${height}`, faces: entries.size, shelves: shelves.length, full: Math.round(nextY / height * 100) + '%', repacks, drawn }),
		dispose() { tex.dispose(); entries.clear(); },
	};
}
