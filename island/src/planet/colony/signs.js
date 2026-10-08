// The colony's lettering: stencilled signs, status plates, screens of logs and rosters,
// labels on crates. Every one is a cell of one shared canvas atlas (made once, on first
// use), and each site's or room's lettering is one merged mesh of little quads: one draw,
// one texture.
//
//   sign   dark plate, pale stencil        ok    green status plate
//   warn   yellow and black                screen a dark screen, lines of small type
//   crate  a stencil on a crate's face     red   an emergency plate
//   patch  a crew patch on a suit's arm

import * as THREE from 'three';

const CW = 256, CH = 128, COLS = 4, ROWS = 16;
let atlas = null, mat = null;
const cells = new Map();
function canvas() {
	if (atlas) return atlas;
	const cv = document.createElement('canvas');
	cv.width = CW * COLS; cv.height = CH * ROWS;
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	atlas = { cv, g: cv.getContext('2d'), tex };
	return atlas;
}
const STYLE = {
	sign: ['#2b2f33', '#e8e2d0', 'bold 30px'], ok: ['#163a24', '#8ff0a8', 'bold 28px'], warn: ['#e0b020', '#141414', 'bold 30px'],
	screen: ['#0b1a26', '#9fe8d0', '18px'], crate: ['#c9c2ae', '#1a1a1a', 'bold 26px'], red: ['#a3241c', '#fff1e8', 'bold 28px'], patch: ['#22325a', '#f3e7c4', 'bold 26px'],
};
// the cell for a text (lines split on |), drawn once
function cell(kind, text) {
	const key = kind + ':' + text;
	if (cells.has(key)) return cells.get(key);
	const n = cells.size;
	if (n >= COLS * ROWS) return cells.values().next().value;
	const A = canvas(), g = A.g, x = (n % COLS) * CW, y = Math.floor(n / COLS) * CH;
	const [bg, fg, font] = STYLE[kind] || STYLE.sign;
	g.fillStyle = bg; g.fillRect(x + 2, y + 2, CW - 4, CH - 4);
	if (kind === 'warn') { g.fillStyle = '#141414'; for (let k = -2; k < 12; k++) { g.beginPath(); g.moveTo(x + k * 26, y + CH - 2); g.lineTo(x + k * 26 + 13, y + CH - 2); g.lineTo(x + k * 26 + 23, y + CH - 16); g.lineTo(x + k * 26 + 10, y + CH - 16); g.fill(); } }
	if (kind === 'screen') { g.strokeStyle = 'rgba(159,232,208,.35)'; g.strokeRect(x + 6, y + 6, CW - 12, CH - 12); }
	g.fillStyle = fg;
	const lines = text.split('|');
	const mono = kind === 'screen' ? 'ui-monospace, Menlo, monospace' : 'system-ui, sans-serif';
	const size = kind === 'screen' ? 15 : lines.length > 2 ? 20 : lines.length > 1 ? 26 : 32;
	g.font = `${font.split(' ')[0] === 'bold' ? 'bold ' : ''}${size}px ${mono}`;
	g.textBaseline = 'middle';
	g.textAlign = kind === 'screen' ? 'left' : 'center';
	const lh = Math.min(size * 1.2, (CH - 16) / lines.length);
	lines.forEach((l, i) => {
		const ty = y + CH / 2 + (i - (lines.length - 1) / 2) * lh;
		let fs = size;
		while (fs > 10 && g.measureText(l).width > CW - 20) { fs -= 2; g.font = `${kind === 'screen' ? '' : 'bold '}${fs}px ${mono}`; }
		g.fillText(l, kind === 'screen' ? x + 14 : x + CW / 2, ty);
		g.font = `${kind === 'screen' ? '' : 'bold '}${size}px ${mono}`;
	});
	A.tex.needsUpdate = true;
	const c = { u0: x / A.cv.width, v0: 1 - (y + CH) / A.cv.height, u1: (x + CW) / A.cv.width, v1: 1 - y / A.cv.height };
	cells.set(key, c);
	return c;
}
function material() {
	if (mat) return mat;
	const A = canvas();
	mat = new THREE.MeshStandardMaterial({ map: A.tex, emissiveMap: A.tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
	return mat;
}
// one lettering item: { kind, text, x, y, z, yaw (the way it faces), w, h }
export function signMesh(list) {
	if (!list.length || typeof document === 'undefined') return null;
	const pos = [], uv = [], nor = [], idx = [];
	for (const s of list) {
		const c = cell(s.kind, s.text), h = s.h ?? s.w * CH / CW, cs = Math.cos(s.yaw), sn = Math.sin(s.yaw);
		const rx = cs * s.w / 2, rz = -sn * s.w / 2, nx = sn, nz = cs, o = pos.length / 3;
		for (const [a, b, u, v] of [[-1, -1, c.u0, c.v0], [1, -1, c.u1, c.v0], [1, 1, c.u1, c.v1], [-1, 1, c.u0, c.v1]]) {
			pos.push(s.x + rx * a + nx * 0.01, s.y + b * h / 2, s.z + rz * a + nz * 0.01);
			uv.push(u, v); nor.push(nx, 0, nz);
		}
		idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setIndex(idx);
	g.computeBoundingSphere();
	const m = new THREE.Mesh(g, material());
	m.name = 'colony:signs';
	return m;
}
// a frame's local point and turn as a lettering item (F from alienkit frame: local +z faces yaw 0)
export const at = (F, kind, text, lx, ly, lz, ry, w, h) => { const p = F.p(lx, ly, lz); return { kind, text, x: p.x, y: p.y, z: p.z, yaw: F.yaw + ry, w, h }; };
export function disposeSigns() { mat?.dispose(); atlas?.tex.dispose(); mat = null; atlas = null; cells.clear(); }
