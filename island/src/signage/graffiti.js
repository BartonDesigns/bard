// Graffiti, drawn by hand (procedurally): the writers' names, their tags, throw-ups and the odd
// full piece, the wheatpaste posters, the stickers they slap on poles and sign backs, the flyers
// on the posts, and the buff a city crew rolls over it all. One skeleton alphabet (a single
// stroke per part of each letter, in a unit box) is written three ways: thin and fast for a
// tag (slanted, the letters crowding, a swoosh under, the odd drip), fat and doubled for a
// throw-up (outline, then fill, then a highlight), and built up for a piece (an extruded
// shadow, a gradient fill, a cloud behind, stars). Each mark is drawn from its seed alone, so
// the same wall says the same thing every visit. tagName() is plain and tested.

import { rng, pick } from './rand.js';
import { denied } from '../economy/establishments.js';

// the skeleton: strokes as x, y pairs in a box 1 high, w wide (0 top, 1 bottom)
const SK = {
	A: [[0, 1, 0.5, 0, 1, 1], [0.22, 0.62, 0.78, 0.62]], B: [[0, 1, 0, 0, 0.62, 0, 0.88, 0.14, 0.66, 0.46, 0, 0.48], [0.66, 0.48, 1, 0.72, 0.74, 1, 0, 1]],
	C: [[1, 0.16, 0.7, 0, 0.24, 0.06, 0, 0.5, 0.24, 0.95, 0.7, 1, 1, 0.84]], D: [[0, 0, 0, 1, 0.58, 1, 1, 0.62, 1, 0.38, 0.58, 0, 0, 0]],
	E: [[1, 0, 0, 0, 0, 1, 1, 1], [0, 0.5, 0.74, 0.5]], F: [[1, 0, 0, 0, 0, 1], [0, 0.5, 0.7, 0.5]],
	G: [[1, 0.16, 0.7, 0, 0.24, 0.06, 0, 0.5, 0.24, 0.95, 0.7, 1, 1, 0.76, 1, 0.56, 0.6, 0.56]], H: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.5, 1, 0.5]],
	I: [[0.5, 0, 0.5, 1]], J: [[1, 0, 1, 0.74, 0.72, 1, 0.3, 1, 0, 0.76]], K: [[0, 0, 0, 1], [1, 0, 0, 0.56, 1, 1]], L: [[0, 0, 0, 1, 1, 1]],
	M: [[0, 1, 0, 0, 0.5, 0.62, 1, 0, 1, 1]], N: [[0, 1, 0, 0, 1, 1, 1, 0]], O: [[0.5, 0, 0.1, 0.2, 0, 0.5, 0.1, 0.8, 0.5, 1, 0.9, 0.8, 1, 0.5, 0.9, 0.2, 0.5, 0]],
	P: [[0, 1, 0, 0, 0.7, 0, 1, 0.25, 0.7, 0.52, 0, 0.52]], Q: [[0.5, 0, 0.1, 0.2, 0, 0.5, 0.1, 0.8, 0.5, 1, 0.9, 0.8, 1, 0.5, 0.9, 0.2, 0.5, 0], [0.62, 0.72, 1.05, 1.08]],
	R: [[0, 1, 0, 0, 0.7, 0, 1, 0.25, 0.7, 0.5, 0, 0.5], [0.42, 0.5, 1, 1]], S: [[1, 0.12, 0.64, 0, 0.2, 0.05, 0.04, 0.28, 0.3, 0.48, 0.76, 0.56, 1, 0.76, 0.8, 0.97, 0.34, 1, 0, 0.88]],
	T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]], U: [[0, 0, 0, 0.72, 0.3, 1, 0.7, 1, 1, 0.72, 1, 0]], V: [[0, 0, 0.5, 1, 1, 0]], W: [[0, 0, 0.24, 1, 0.5, 0.4, 0.76, 1, 1, 0]],
	X: [[0, 0, 1, 1], [1, 0, 0, 1]], Y: [[0, 0, 0.5, 0.5, 1, 0], [0.5, 0.5, 0.5, 1]], Z: [[0, 0, 1, 0, 0, 1, 1, 1]],
	0: [[0.5, 0, 0.05, 0.25, 0.05, 0.75, 0.5, 1, 0.95, 0.75, 0.95, 0.25, 0.5, 0]], 1: [[0.2, 0.2, 0.55, 0, 0.55, 1]], 2: [[0, 0.22, 0.4, 0, 0.9, 0.12, 0.9, 0.42, 0, 1, 1, 1]],
	3: [[0, 0.1, 0.8, 0, 0.9, 0.3, 0.4, 0.48, 0.95, 0.66, 0.85, 0.96, 0, 0.92]], 4: [[0.75, 1, 0.75, 0, 0, 0.7, 1, 0.7]], 5: [[1, 0, 0.1, 0, 0.05, 0.45, 0.7, 0.4, 1, 0.7, 0.75, 1, 0, 0.95]],
	6: [[0.9, 0.05, 0.3, 0.1, 0, 0.6, 0.3, 1, 0.85, 0.9, 0.85, 0.55, 0.3, 0.5, 0.05, 0.65]], 7: [[0, 0, 1, 0, 0.35, 1]], 8: [[0.5, 0.5, 0.1, 0.25, 0.5, 0, 0.9, 0.25, 0.5, 0.5, 0.05, 0.75, 0.5, 1, 0.95, 0.75, 0.5, 0.5]], 9: [[0.95, 0.4, 0.6, 0.55, 0.1, 0.4, 0.2, 0.05, 0.8, 0.05, 0.95, 0.4, 0.8, 1]],
};
const WIDTH = { I: 0.3, 1: 0.55, M: 1.15, W: 1.25, J: 0.85, L: 0.8, T: 0.9 };

// a writer's name: short, said aloud, made of the sounds writers like (and no brand's)
const ON = ['K', 'Z', 'R', 'T', 'S', 'M', 'D', 'V', 'B', 'N', 'G', 'J', 'X', 'P', 'Kr', 'Sk', 'Tr', 'Dr', 'Gr', 'St'];
const NU = ['A', 'E', 'I', 'O', 'U', 'Y', 'EE', 'OO', 'AI'];
const CO = ['K', 'R', 'S', 'X', 'Z', 'N', 'M', 'T', 'NE', 'KS', 'RS', 'ZE', 'ER', 'OH'];
export function tagName(seed) {
	const r = rng((seed >>> 0) * 2654435761 + 7);
	for (let tries = 0; tries < 12; tries++) {
		let s = pick(r, ON) + pick(r, NU) + (r() < 0.7 ? pick(r, CO) : '');
		if (r() < 0.25) s += pick(r, NU) + pick(r, ['K', 'S', 'R', 'Z']);
		s = s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
		if (s.length >= 3 && !denied(s)) return s;
	}
	return 'KRES';
}
export const crewName = (seed) => { const r = rng((seed >>> 0) ^ 0x9e3779b9); let s = ''; for (let i = 0; i < 3; i++) s += pick(r, ['A', 'B', 'C', 'D', 'K', 'M', 'R', 'S', 'T', 'V', 'X', 'Z']); return denied(s) ? 'TKZ' : s; };

// letters laid along a line: [{ ch, x, y, s, w, rot }] in a box h high, and the run's width
function layout(name, h, r, { slant = 0.2, crowd = 0.78, bounce = 0.12 } = {}) {
	const out = [];
	let x = 0;
	for (const ch of name) {
		const s = h * (0.8 + r() * 0.35), w = (WIDTH[ch] ?? 0.8) * s * 0.62;
		out.push({ ch, x, y: (r() - 0.5) * h * bounce, s, w, rot: (r() - 0.5) * 0.25, slant });
		x += w * crowd + s * 0.08;
	}
	return { letters: out, width: x };
}
// the skeleton of one letter as paths in canvas space, a little shaken (hand)
function strokes(L, r, shake) {
	const out = [];
	for (const st of SK[L.ch] || []) {
		const p = [];
		for (let i = 0; i < st.length; i += 2) {
			let u = st[i] * L.w, v = st[i + 1] * L.s;
			u += (r() - 0.5) * shake * L.s; v += (r() - 0.5) * shake * L.s;
			// (turned, and slanted forward like a fast hand)
			const c = Math.cos(L.rot), s = Math.sin(L.rot);
			const ux = u * c - v * s - (v - L.s) * L.slant, vy = u * s + v * c;
			p.push(L.x + ux, L.y + vy);
		}
		out.push(p);
	}
	return out;
}
function path(g, p) {
	g.beginPath(); g.moveTo(p[0], p[1]);
	if (p.length === 4) { g.lineTo(p[2], p[3]); return; }
	for (let i = 2; i + 2 < p.length; i += 2) g.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
	g.lineTo(p[p.length - 2], p[p.length - 1]);
}
const INK = ['#141414', '#141414', '#1d1d24', '#c8c8cc', '#d22a2a', '#2a4fd2', '#f2f2f2', '#2f9e44', '#e8b21c', '#7a2fd2'];
const FILL = ['#e8e8ec', '#f4d23c', '#e85d9e', '#58c4f0', '#9ef05a', '#ff8a2a', '#f4f4f4', '#c9b2ff', '#ff4a4a'];

// a tag: fast, thin, slanted; a swoosh under, maybe a crown or a halo; drips where it pooled
export function drawTag(g, x0, y0, W, H, seed) {
	const r = rng(seed * 7919 + 1), name = tagName(seed);
	const spray = r() < 0.65, col = pick(r, INK);
	const { letters, width } = layout(name, H * 0.62, r, { slant: 0.15 + r() * 0.35, crowd: 0.62 + r() * 0.25, bounce: 0.2 });
	const k = Math.min(1, (W * 0.9) / Math.max(1, width + H * 0.3));
	g.save(); g.translate(x0 + W * 0.05 + (W * 0.9 - width * k) / 2, y0 + H * 0.12); g.scale(k, k);
	g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
	const lw = H * (spray ? 0.07 : 0.045);
	const paths = letters.flatMap((L) => strokes(L, r, 0.06));
	if (spray) { g.globalAlpha = 0.25; g.lineWidth = lw * 2.2; for (const p of paths) { path(g, p); g.stroke(); } g.globalAlpha = 1; }
	g.lineWidth = lw; for (const p of paths) { path(g, p); g.stroke(); }
	// the swoosh under the name, thrown from the last letter
	const last = letters[letters.length - 1], base = H * 0.62;
	if (r() < 0.75) { g.lineWidth = lw * 0.9; g.beginPath(); g.moveTo(last.x + last.w, base * 0.9); g.bezierCurveTo(width * 0.6, base * 1.35, width * 0.2, base * 1.1, -H * 0.05, base * 1.18); g.stroke(); }
	if (r() < 0.3) { g.lineWidth = lw * 0.7; const cx = letters[0].x + letters[0].w * 0.5; g.beginPath(); g.moveTo(cx - H * 0.12, -H * 0.02); g.lineTo(cx - H * 0.06, -H * 0.14); g.lineTo(cx, -H * 0.04); g.lineTo(cx + H * 0.06, -H * 0.14); g.lineTo(cx + H * 0.12, -H * 0.02); g.stroke(); }
	else if (r() < 0.25) { g.lineWidth = lw * 0.6; g.beginPath(); g.ellipse(letters[0].x + letters[0].w * 0.5, -H * 0.08, H * 0.12, H * 0.04, 0, 0, Math.PI * 2); g.stroke(); }
	// drips: where the can was held too long
	if (spray) for (let i = 0, n = Math.floor(r() * 4); i < n; i++) { const L = pick(r, letters), dx = L.x + L.w * r(), len = H * (0.1 + r() * 0.35); g.lineWidth = lw * 0.45; g.beginPath(); g.moveTo(dx, base * 0.95); g.lineTo(dx + len * 0.02, base * 0.95 + len); g.stroke(); g.beginPath(); g.arc(dx + len * 0.02, base * 0.95 + len, lw * 0.35, 0, Math.PI * 2); g.fill(); }
	g.restore();
}
// a throw-up: two or three fat letters, outlined, filled fast, a highlight
export function drawThrowup(g, x0, y0, W, H, seed) {
	const r = rng(seed * 104729 + 3), name = tagName(seed).slice(0, 2 + Math.floor(r() * 2));
	const { letters, width } = layout(name, H * 0.5, r, { slant: 0.05 + r() * 0.12, crowd: 0.75, bounce: 0.08 });
	const k = Math.min(1, (W * 0.84) / Math.max(1, width + H * 0.35));
	const out = pick(r, ['#101010', '#101010', '#1a2a8a', '#8a1a1a']), fill = pick(r, FILL);
	g.save(); g.translate(x0 + W * 0.08 + (W * 0.84 - width * k) / 2, y0 + H * 0.24); g.scale(k, k);
	g.lineCap = 'round'; g.lineJoin = 'round';
	const paths = letters.flatMap((L) => strokes(L, r, 0.04));
	g.strokeStyle = out; g.lineWidth = H * 0.3; for (const p of paths) { path(g, p); g.stroke(); }
	g.strokeStyle = fill; g.lineWidth = H * 0.2; for (const p of paths) { path(g, p); g.stroke(); }
	// (the fill rushed: the outline shows through in streaks)
	g.globalAlpha = 0.18; g.strokeStyle = out; g.lineWidth = H * 0.02; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-H * 0.1, H * (0.05 + r() * 0.5)); g.lineTo(width + H * 0.1, H * (0.05 + r() * 0.5)); g.stroke(); }
	g.globalAlpha = 0.85; g.strokeStyle = '#ffffff'; g.lineWidth = H * 0.025; for (const p of paths) { g.save(); g.translate(-H * 0.035, -H * 0.035); path(g, p.slice(0, 4)); g.stroke(); g.restore(); }
	g.restore();
}
// a piece: a cloud behind, letters extruded into a shadow, a gradient fill, outline, shine,
// stars; the name and crew small in the corner with the year
export function drawPiece(g, x0, y0, W, H, seed) {
	const r = rng(seed * 15485863 + 5), name = tagName(seed);
	g.save();
	// the background: a cloud of colour in overlapping rounds
	const bg = pick(r, ['#2b6fd6', '#7c3fc4', '#1fa38a', '#d64f2b', '#2a2a38']);
	g.fillStyle = bg;
	for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(x0 + W * (0.08 + r() * 0.84), y0 + H * (0.2 + r() * 0.6), H * (0.18 + r() * 0.2), 0, Math.PI * 2); g.fill(); }
	const { letters, width } = layout(name, H * 0.52, r, { slant: 0.1 + r() * 0.15, crowd: 0.8, bounce: 0.16 });
	const k = Math.min(1, (W * 0.8) / Math.max(1, width + H * 0.4));
	g.translate(x0 + W * 0.1 + (W * 0.8 - width * k) / 2, y0 + H * 0.22); g.scale(k, k);
	g.lineCap = 'round'; g.lineJoin = 'round';
	const paths = letters.flatMap((L) => strokes(L, r, 0.03));
	// the extrusion: the outline drawn again and again down and to the right
	g.strokeStyle = '#121212';
	for (let d = 0; d < 8; d++) { g.save(); g.translate(d * H * 0.012, d * H * 0.012); g.lineWidth = H * 0.24; for (const p of paths) { path(g, p); g.stroke(); } g.restore(); }
	g.lineWidth = H * 0.24; for (const p of paths) { path(g, p); g.stroke(); }
	const gr = g.createLinearGradient(0, 0, 0, H * 0.55);
	const c1 = pick(r, FILL), c2 = pick(r, ['#ff3a6e', '#ffb23a', '#3aff9e', '#3ac4ff', '#c43aff']);
	gr.addColorStop(0, c1); gr.addColorStop(0.55, c2); gr.addColorStop(1, c1);
	g.strokeStyle = gr; g.lineWidth = H * 0.15; for (const p of paths) { path(g, p); g.stroke(); }
	// cut-throughs and the shine
	g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = H * 0.012; for (const p of paths) { g.save(); g.translate(H * 0.02, H * 0.02); path(g, p); g.stroke(); g.restore(); }
	g.strokeStyle = '#ffffff'; g.lineWidth = H * 0.022; for (const p of paths) { g.save(); g.translate(-H * 0.03, -H * 0.03); path(g, p.slice(0, Math.min(6, p.length))); g.stroke(); g.restore(); }
	g.fillStyle = '#ffffff';
	for (let i = 0; i < 6; i++) { const sx = r() * width, sy = r() * H * 0.5, s = H * (0.02 + r() * 0.04); g.beginPath(); g.moveTo(sx, sy - s * 2); g.lineTo(sx + s * 0.5, sy - s * 0.5); g.lineTo(sx + s * 2, sy); g.lineTo(sx + s * 0.5, sy + s * 0.5); g.lineTo(sx, sy + s * 2); g.lineTo(sx - s * 0.5, sy + s * 0.5); g.lineTo(sx - s * 2, sy); g.lineTo(sx - s * 0.5, sy - s * 0.5); g.fill(); }
	g.restore();
	g.save(); g.fillStyle = '#f2f2f2'; g.font = `italic bold ${Math.round(H * 0.07)}px "Liberation Sans", Arial, sans-serif`; g.textAlign = 'right';
	g.fillText(`${name} ${crewName(seed)} '26`, x0 + W * 0.94, y0 + H * 0.93); g.restore();
}
// the buff: a roller's block of grey, a shade off the wall, its edges ragged
export function drawBuff(g, x0, y0, W, H, tone) {
	const col = ['#8e8a84', '#a7a29a', '#9a9ea2', '#b9b0a2'][tone % 4];
	const r = rng(tone * 31 + 9);
	g.save(); g.fillStyle = col;
	g.beginPath(); g.moveTo(x0 + W * 0.03, y0 + H * 0.05);
	for (let i = 1; i <= 10; i++) g.lineTo(x0 + W * (0.03 + i * 0.094), y0 + H * (0.03 + r() * 0.05));
	for (let i = 1; i <= 6; i++) g.lineTo(x0 + W * (0.96 + r() * 0.03), y0 + H * (i / 6) * 0.94);
	for (let i = 10; i >= 0; i--) g.lineTo(x0 + W * (0.03 + i * 0.094), y0 + H * (0.93 + r() * 0.05));
	g.closePath(); g.fill();
	// the roller's passes, lighter and darker
	g.globalAlpha = 0.08;
	for (let x = x0 + W * 0.05; x < x0 + W * 0.95; x += W * 0.09) { g.fillStyle = r() < 0.5 ? '#ffffff' : '#000000'; g.fillRect(x, y0 + H * 0.06, W * 0.085, H * 0.86); }
	g.restore();
}
// a wheatpaste poster: a show that never happened, a face of blocks, a slogan; torn and layered
const BANDS = ['THE SALT MARSH', 'NIGHT FERRY', 'GLASS CANYON', 'LOW TIDE CLUB', 'VELVET OVERPASS', 'THE FOGHORNS', 'STATIC BLOOM', 'CRANE & GULL', 'MIDNIGHT ORCHARD', 'THE CUL-DE-SACS'];
const VENUES = ['THE ANCHOR ROOM', 'PIER 9 HALL', 'THE BOILER', 'OLD MINT HALL', 'THE LANTERN'];
export function drawWheatpaste(g, x0, y0, W, H, seed) {
	const r = rng(seed * 9973 + 11);
	g.save();
	// the paper, torn: a ragged outline
	g.beginPath();
	const ragged = (n, f) => { for (let i = 0; i <= n; i++) f(i / n, (r() - 0.5) * 0.03); };
	g.moveTo(x0 + W * 0.02, y0 + H * 0.02);
	ragged(8, (t, j) => g.lineTo(x0 + W * (0.02 + t * 0.96), y0 + H * (0.02 + j)));
	ragged(10, (t, j) => g.lineTo(x0 + W * (0.98 + j), y0 + H * (0.02 + t * 0.96)));
	ragged(8, (t, j) => g.lineTo(x0 + W * (0.98 - t * 0.96), y0 + H * (0.98 + j)));
	g.closePath();
	const kind = Math.floor(r() * 3), paper = pick(r, ['#f2ede0', '#f6f0d8', '#ffffff', '#f4c43a', '#ff5a3a', '#7ad0f0']);
	g.fillStyle = paper; g.fill(); g.clip();
	g.fillStyle = '#141414'; g.textAlign = 'center';
	if (kind === 0) {
		// a show: the band big, the venue and the date small
		const band = pick(r, BANDS);
		g.fillRect(x0, y0 + H * 0.56, W, H * 0.3);
		g.font = `900 ${Math.round(H * 0.11)}px "Liberation Sans", Arial, sans-serif`;
		const words = band.split(' ');
		words.forEach((w2, i) => g.fillText(w2, x0 + W / 2, y0 + H * (0.16 + i * 0.12), W * 0.9));
		g.fillStyle = paper; g.font = `bold ${Math.round(H * 0.06)}px "Liberation Sans", Arial, sans-serif`;
		g.fillText(pick(r, VENUES), x0 + W / 2, y0 + H * 0.68, W * 0.9);
		g.fillText(`${pick(r, ['FRI', 'SAT', 'THU'])} ${1 + Math.floor(r() * 28)}.${1 + Math.floor(r() * 12)}`, x0 + W / 2, y0 + H * 0.78);
	} else if (kind === 1) {
		// a face in halftone blocks
		g.fillStyle = pick(r, ['#141414', '#2a2a8a', '#8a1a1a']);
		const cx = x0 + W / 2, cy = y0 + H * 0.42;
		for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) {
			const px = x0 + (x + 0.5) * W / 12, py = y0 + (y + 0.5) * H / 18;
			const d = Math.hypot((px - cx) / W, (py - cy) / H * 0.8), v = Math.max(0, 0.36 - d) * 3 + (Math.abs(px - cx) < W * 0.12 && Math.abs(py - cy - H * 0.05) < H * 0.03 ? 0.6 : 0);
			g.beginPath(); g.arc(px, py, Math.min(W / 24, v * W / 18), 0, Math.PI * 2); g.fill();
		}
		g.font = `900 ${Math.round(H * 0.08)}px "Liberation Sans", Arial, sans-serif`;
		g.fillText(pick(r, ['WAKE UP', 'LOOK UP', 'STAY', 'LISTEN', 'BREATHE']), x0 + W / 2, y0 + H * 0.92);
	} else {
		// a slogan, set in blocks of colour
		for (let i = 0; i < 4; i++) { g.fillStyle = pick(r, ['#141414', '#e83a2a', '#2a5ae8', '#f4c43a']); g.fillRect(x0, y0 + H * i / 4, W, H / 4 - 2); }
		g.fillStyle = '#ffffff'; g.font = `900 ${Math.round(H * 0.12)}px "Liberation Sans", Arial, sans-serif`;
		const s = pick(r, ['NO MORE|RENT|HIKES|!!', 'THE CITY|IS|OURS|TOO', 'FREE|THE|BAY|NOW', 'CALL|YOUR|MOTHER|TODAY']).split('|');
		s.forEach((w2, i) => g.fillText(w2, x0 + W / 2, y0 + H * (i + 0.7) / 4, W * 0.9));
	}
	// the weather: a torn-away corner, a crease
	g.globalCompositeOperation = 'destination-out';
	if (r() < 0.6) { g.beginPath(); const cx = r() < 0.5 ? x0 : x0 + W, cy = r() < 0.5 ? y0 : y0 + H; g.moveTo(cx, cy); g.lineTo(cx + (cx === x0 ? 1 : -1) * W * (0.2 + r() * 0.3), cy); g.lineTo(cx, cy + (cy === y0 ? 1 : -1) * H * (0.15 + r() * 0.25)); g.fill(); }
	g.restore();
}
// a sticker: a slap with a writer's name, a little character, a label with a blank to fill
export function drawSticker(g, x0, y0, W, H, seed) {
	const r = rng(seed * 6271 + 13), kind = Math.floor(r() * 5), name = tagName(seed + 77);
	g.save();
	const cx = x0 + W / 2, cy = y0 + H / 2;
	if (kind === 0) {
		// the name label: a coloured band with a word, a white blank, a tag across it
		g.fillStyle = pick(r, ['#d8232a', '#2a64d8', '#20a050']); g.beginPath(); g.roundRect(x0 + 2, y0 + 2, W - 4, H - 4, 6); g.fill();
		g.fillStyle = '#ffffff'; g.fillRect(x0 + 6, y0 + H * 0.42, W - 12, H * 0.48);
		g.font = `bold ${Math.round(H * 0.16)}px "Liberation Sans", Arial, sans-serif`; g.textAlign = 'center'; g.fillText('HELLO', cx, y0 + H * 0.24);
		g.font = `${Math.round(H * 0.08)}px "Liberation Sans", Arial, sans-serif`; g.fillText('my name is', cx, y0 + H * 0.36);
		drawTag(g, x0 + 6, y0 + H * 0.4, W - 12, H * 0.5, seed);
	} else if (kind === 1) {
		// a little character: a round face with big eyes
		g.fillStyle = pick(r, ['#f4d23c', '#9ef05a', '#58c4f0', '#ffffff', '#ff8ab4']); g.beginPath(); g.arc(cx, cy, Math.min(W, H) * 0.46, 0, Math.PI * 2); g.fill();
		g.lineWidth = 3; g.strokeStyle = '#141414'; g.stroke();
		g.fillStyle = '#ffffff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * W * 0.14, cy - H * 0.06, W * 0.11, 0, Math.PI * 2); g.fill(); g.stroke(); }
		g.fillStyle = '#141414'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * W * 0.14 + W * 0.03, cy - H * 0.05, W * 0.045, 0, Math.PI * 2); g.fill(); }
		g.beginPath(); g.arc(cx, cy + H * 0.12, W * 0.12, 0.2, Math.PI - 0.2); g.stroke();
	} else if (kind === 2) {
		// a name slap: bold letters in a box
		g.fillStyle = pick(r, ['#141414', '#ffffff', '#e83a2a', '#f4c43a']); g.fillRect(x0 + 2, y0 + 2, W - 4, H - 4);
		g.fillStyle = g.fillStyle === '#141414' ? '#f4f4f4' : '#141414';
		g.font = `900 ${Math.round(H * 0.42)}px "Liberation Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, cx, cy, W * 0.88);
	} else if (kind === 3) {
		// a crew's round mark
		g.fillStyle = '#141414'; g.beginPath(); g.arc(cx, cy, Math.min(W, H) * 0.47, 0, Math.PI * 2); g.fill();
		g.fillStyle = pick(r, FILL); g.font = `900 ${Math.round(H * 0.3)}px "Liberation Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(crewName(seed), cx, cy);
	} else {
		// a skateboard-shop style star, no shop
		g.fillStyle = pick(r, ['#e83a2a', '#2a5ae8', '#141414']); g.beginPath();
		for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 0.2 : 0.46) * Math.min(W, H); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
		g.closePath(); g.fill();
		g.fillStyle = '#ffffff'; g.font = `bold ${Math.round(H * 0.14)}px "Liberation Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, cx, cy, W * 0.4);
	}
	g.restore();
}
// a flyer on a post: a heading, a line or two, the tear-off tabs at the foot (some torn off)
export function drawFlyer(g, x0, y0, W, H, seed) {
	const r = rng(seed * 4241 + 17);
	const [head, body] = pick(r, [['LOST CAT', 'grey tabby · answers to Pixel'], ['ROOM FOR RENT', 'sunny · near the bus · no smokers'], ['GUITAR LESSONS', 'all ages · first lesson free'], ['BAND SEEKS DRUMMER', 'garage rock · weeknights'], ['YARD SALE SAT', 'books · records · a canoe'], ['DOG WALKER', 'reliable · references'], ['FOUND KEYS', 'on the bench by the stop'], ['TUTORING', 'math and science · grades 6-12']]);
	g.save();
	g.fillStyle = pick(r, ['#ffffff', '#fff7c4', '#d6f0ff', '#ffd6e6']); g.fillRect(x0 + 2, y0 + 2, W - 4, H - 4);
	g.fillStyle = '#141414'; g.textAlign = 'center';
	g.font = `900 ${Math.round(H * 0.1)}px "Liberation Sans", Arial, sans-serif`; g.fillText(head, x0 + W / 2, y0 + H * 0.16, W * 0.9);
	if (/CAT|DOG/.test(head)) { g.fillStyle = '#777'; g.fillRect(x0 + W * 0.2, y0 + H * 0.22, W * 0.6, H * 0.3); g.fillStyle = '#141414'; }
	g.font = `${Math.round(H * 0.055)}px "Liberation Sans", Arial, sans-serif`; g.fillText(body, x0 + W / 2, y0 + H * 0.62, W * 0.92);
	// the tabs: the number turned on its side, every strip cut
	const n = 7, tw = (W - 8) / n;
	for (let i = 0; i < n; i++) {
		if (r() < 0.35) { g.clearRect(x0 + 4 + i * tw + 1, y0 + H * 0.72, tw - 2, H * 0.27); continue; }
		g.save(); g.translate(x0 + 4 + (i + 0.5) * tw, y0 + H * 0.86); g.rotate(-Math.PI / 2);
		g.font = `${Math.round(tw * 0.55)}px "Liberation Sans", Arial, sans-serif`; g.fillText(`555-01${10 + Math.floor(r() * 89)}`, 0, tw * 0.2); g.restore();
		g.fillRect(x0 + 4 + (i + 1) * tw - 0.5, y0 + H * 0.72, 1, H * 0.27);
	}
	g.restore();
}
