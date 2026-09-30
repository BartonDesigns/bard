// Ink on a flat design, as a tattooist draws it: lines in four hands (a steady line, dots,
// dashes, and the tribal stroke that swells from a point and tapers back to one), the flash
// sheet's base shapes to start from, and a handful of inks. A design is a list of marks, so it
// can be redrawn at any size, undone a mark at a time, and kept as a few hundred bytes.

// inks: black, a grey wash, and the colours that hold best in skin
export const INKS = {
	black: [0.07, 0.08, 0.1],
	grey: [0.38, 0.4, 0.43],
	red: [0.62, 0.08, 0.09],
	blue: [0.1, 0.2, 0.52],
	green: [0.08, 0.36, 0.2],
	ochre: [0.66, 0.45, 0.12],
};
export const STYLES = ['line', 'dotted', 'dashed', 'tribal'];

const TAU = Math.PI * 2;
const css = (ink) => { const c = INKS[ink] || INKS.black; return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`; };

// ---------- the base shapes: outlines in a unit box (-1..1), as point lists ----------
function poly(n, r = 1, rot = -Math.PI / 2) { const p = []; for (let i = 0; i <= n; i++) { const a = rot + i / n * TAU; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
function star(n = 5, r1 = 1, r2 = 0.42) { const p = []; for (let i = 0; i <= n * 2; i++) { const a = -Math.PI / 2 + i / (n * 2) * TAU, r = i % 2 ? r2 : r1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
function heart() { const p = []; for (let i = 0; i <= 64; i++) { const t = i / 64 * TAU, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); p.push([x / 17, -y / 17 + 0.1]); } return p; }
function wave() { const p = []; for (let i = 0; i <= 48; i++) { const x = -1 + i / 24; p.push([x, Math.sin(x * Math.PI * 2) * 0.35]); } return p; }
function spiral() { const p = []; for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU * 2.6, r = 0.08 + i / 90 * 0.92; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
function arrow() { return [[-1, 0], [0.75, 0], null, [0.4, -0.3], [0.8, 0], [0.4, 0.3], null, [-1, -0.25], [-0.75, 0], [-1, 0.25]]; }
function banner() { return [[-1, -0.25], [-0.75, -0.4], [0.75, -0.4], [1, -0.25], [0.8, 0], [1, 0.25], [0.75, 0.1], [-0.75, 0.1], [-1, 0.25], [-0.8, 0], [-1, -0.25]]; }
function moon() { const p = []; for (let i = 0; i <= 40; i++) { const a = Math.PI * 0.25 + i / 40 * Math.PI * 1.5; p.push([Math.cos(a), Math.sin(a)]); } for (let i = 40; i >= 0; i--) { const a = Math.PI * 0.35 + i / 40 * Math.PI * 1.3; p.push([Math.cos(a) * 0.72 + 0.28, Math.sin(a) * 0.72]); } return p; }
function mountain() { return [[-1, 0.6], [-0.45, -0.35], [-0.15, 0.1], [0.25, -0.65], [1, 0.6], [-1, 0.6]]; }
function rose() { const p = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, r = 0.35 + 0.6 * Math.abs(Math.cos(a * 2.5)); p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
// the band: a repeating tribal wave around a limb (tapered in the drawing, tribal style)
function band() { const p = []; for (let i = 0; i <= 64; i++) { const x = -1 + i / 32; p.push([x, Math.sin(x * Math.PI * 3) * 0.3]); } return p; }

export const SHAPES = {
	circle: () => poly(48), triangle: () => poly(3), diamond: () => poly(4, 1, 0), hexagon: () => poly(6),
	star: () => star(), heart, wave, spiral, arrow, banner, moon, mountain, rose, band,
};

// ---------- a design: marks, each a stroke or a placed shape ----------
// { kind: 'stroke', pts: [[x, y], ...] (0..1), style, ink, size }
// { kind: 'shape', shape, x, y, s, rot, style, ink, size, fill }
export function newDesign() { return { marks: [] }; }

// a mark's outline as point runs, in the design's 0..1 square
function runs(m) {
	if (m.kind === 'stroke') return [m.pts];
	const P = SHAPES[m.shape]?.() || [];
	const out = [];
	let run = [];
	const c = Math.cos(m.rot || 0), s = Math.sin(m.rot || 0);
	for (const q of P) {
		if (!q) { if (run.length) out.push(run); run = []; continue; }
		const x = q[0] * m.s, y = q[1] * m.s;
		run.push([m.x + x * c - y * s, m.y + x * s + y * c]);
	}
	if (run.length) out.push(run);
	return out;
}

// draw a run of points in a style
function drawRun(g, pts, style, width) {
	if (pts.length < 2) { if (pts.length) { g.beginPath(); g.arc(pts[0][0], pts[0][1], width / 2, 0, TAU); g.fill(); } return; }
	if (style === 'tribal') {
		// the tribal stroke: a filled blade, swelling from a point to its width and back
		const L = [], R = [], n = pts.length;
		for (let i = 0; i < n; i++) {
			const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
			let dx = b[0] - a[0], dy = b[1] - a[1];
			const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
			const k = Math.sin(Math.PI * i / (n - 1)) ** 0.8, w = width * 1.6 * k;
			L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
		}
		g.beginPath(); g.moveTo(L[0][0], L[0][1]);
		for (const q of L) g.lineTo(q[0], q[1]);
		for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
		g.closePath(); g.fill();
		return;
	}
	if (style === 'dotted') {
		// dots at an even spacing along the line
		const gap = width * 2.2;
		let carry = 0;
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
			for (let t = carry; t <= L; t += gap) { g.beginPath(); g.arc(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L, width * 0.55, 0, TAU); g.fill(); }
			carry = ((carry - L) % gap + gap) % gap;
		}
		return;
	}
	g.setLineDash(style === 'dashed' ? [width * 3, width * 2.2] : []);
	g.lineWidth = width; g.lineCap = style === 'dashed' ? 'butt' : 'round'; g.lineJoin = 'round';
	g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
	for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
	g.stroke();
	g.setLineDash([]);
}

// draw a design into a square of a canvas (x0, y0, size in pixels); ink over transparent
export function drawDesign(g, design, x0, y0, size) {
	g.save();
	g.translate(x0, y0); g.scale(size, size);
	for (const m of design.marks) {
		const col = css(m.ink), w = (m.size || 0.02);
		g.fillStyle = col; g.strokeStyle = col;
		const R = runs(m);
		if (m.kind === 'shape' && m.fill) for (const r of R) { g.beginPath(); g.moveTo(r[0][0], r[0][1]); for (const q of r) g.lineTo(q[0], q[1]); g.closePath(); g.fill(); }
		else for (const r of R) drawRun(g, r, m.style || 'line', w);
	}
	g.restore();
}
