// Names in lights: a real resort's own name on its pylon sign by the boulevard and across the
// crown of its tower (region/landmarks.js puts them in B.signs, settle.js lays each cell's
// down). Each name is lettered once into one atlas of lit lettering, in its neon on the dark of
// the sign, the glass tubes' halo round each letter, and laid on as quads unlit, as the neon is.
// One material, one draw a cell that has any; a name stays lettered while anything shows it.

import * as THREE from 'three';

const FONTS = {
	serif: 'Georgia, "Times New Roman", serif',
	sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
	script: '"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive',
};

// a sign's words as lettered: in capitals but for the script ones, and without a leading "the"
export function signText(name, font = 'serif') {
	const t = String(name || '').replace(/^the\s+/i, '').trim();
	return font === 'script' ? t : t.toUpperCase();
}

const css = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, v) * 255)).join(',')})`;

// isPhone: a smaller atlas, smaller letters
export function createMarquees({ isPhone = false } = {}) {
	const AW = isPhone ? 1024 : 2048, AH = 1024, LINE = isPhone ? 44 : 80, TALL = isPhone ? 96 : 160;
	const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	if (cv) { cv.width = AW; cv.height = AH; }
	const g = cv?.getContext('2d');
	const tex = cv ? new THREE.CanvasTexture(cv) : null;
	if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }
	const material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: true, transparent: false, alphaTest: 0.5 });
	material.name = 'marquee';
	const cells = new Map();
	let sx = 0, sy = 0, rowH = 0, full = false;

	// room in the atlas: shelf after shelf, left to right
	function room(w, h) {
		if (sx + w > AW) { sx = 0; sy += rowH + 2; rowH = 0; }
		if (sy + h > AH) { full = true; return null; }
		const at = [sx, sy];
		sx += w + 2; rowH = Math.max(rowH, h);
		return at;
	}
	// a name lettered at the sign's shape: across one line, or a word a line up a tall one
	function letter(S) {
		const font = FONTS[S.font] ? S.font : 'serif', text = signText(S.text, font), tall = S.w / S.h < 1.2;
		const key = text + '|' + font + '|' + S.fg.join(',') + '|' + (tall ? 't' : 'w') + Math.round(S.w / S.h * 4);
		if (cells.has(key)) return cells.get(key);
		if (full || !g) return null;
		const pw = tall ? TALL : Math.min(AW, Math.round(LINE * S.w / S.h)), ph = tall ? Math.round(TALL * S.h / S.w) : LINE;
		const at = room(pw, ph);
		if (!at) return null;
		const [x0, y0] = at, fg = css(S.fg), m = Math.max(3, ph * 0.06);
		g.save();
		g.beginPath(); g.rect(x0, y0, pw, ph); g.clip();
		// the sign's face: near black, a line of the neon round its edge
		g.fillStyle = css(S.bg || [0.03, 0.025, 0.04]); g.fillRect(x0, y0, pw, ph);
		g.strokeStyle = fg; g.lineWidth = Math.max(2, ph * 0.025); g.shadowColor = fg; g.shadowBlur = m;
		g.strokeRect(x0 + m, y0 + m, pw - 2 * m, ph - 2 * m);
		// the words, as big as fit
		const lines = tall ? text.split(/\s+/).slice(0, 4) : [text];
		const weight = font === 'script' ? '' : 'bold ';
		let px = Math.floor((ph - 4 * m) / lines.length * 0.8);
		g.font = `${weight}${px}px ${FONTS[font]}`;
		const widest = Math.max(...lines.map((l) => g.measureText(l).width));
		if (widest > pw - 5 * m) px = Math.max(8, Math.floor(px * (pw - 5 * m) / widest));
		g.font = `${weight}${px}px ${FONTS[font]}`;
		g.textAlign = 'center'; g.textBaseline = 'middle';
		const step = (ph - 4 * m) / lines.length;
		// the halo, then the tube's white-hot middle
		for (const [blur, col] of [[px * 0.35, fg], [px * 0.12, fg], [0, 'rgba(255,255,255,0.85)']]) {
			g.shadowColor = fg; g.shadowBlur = blur; g.fillStyle = col;
			lines.forEach((l, i) => g.fillText(l, x0 + pw / 2, y0 + 2 * m + step * (i + 0.5)));
			if (!blur) break;
		}
		g.restore();
		tex.needsUpdate = true;
		const c = { u0: x0 / AW, u1: (x0 + pw) / AW, v0: 1 - (y0 + ph) / AH, v1: 1 - y0 / AH };
		cells.set(key, c);
		return c;
	}
	// the quads of a cell's signs: S { text, font, fg, x, y, z, w, h, yaw }, facing (sin yaw, cos yaw)
	function mesh(signs) {
		const pos = [], uv = [], idx = [];
		for (const S of signs) {
			const c = letter(S);
			if (!c) continue;
			const rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw), hw = S.w / 2, hh = S.h / 2, n = pos.length / 3;
			pos.push(S.x - rx * hw, S.y - hh, S.z - rz * hw, S.x + rx * hw, S.y - hh, S.z + rz * hw, S.x + rx * hw, S.y + hh, S.z + rz * hw, S.x - rx * hw, S.y + hh, S.z - rz * hw);
			uv.push(c.u0, c.v0, c.u1, c.v0, c.u1, c.v1, c.u0, c.v1);
			idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
		}
		if (!idx.length) return null;
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		geo.setIndex(idx);
		geo.computeBoundingSphere();
		const M = new THREE.Mesh(geo, material);
		M.name = 'marquees';
		return M;
	}
	return { mesh, letter, material, info: () => ({ names: cells.size, full }), dispose: () => { material.dispose(); tex?.dispose(); } };
}
