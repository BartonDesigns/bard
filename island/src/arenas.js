// The other worlds' ball grounds. A green pitch belongs on a green world; everywhere else the
// island's ground above the village gets an arena of the world's own making, and a game made
// for it (games/arenaball.js):
//   MAGMA     an obsidian and basalt floor, its lines glowing cracks, ringed by a lava moat:
//             Magma Ball, and the volcano's bombs land round it as fresh balls;
//   TOXIC     a court of cracked chemical crust in a rim of sludge, warning stripes for lines:
//             Toxic Dodge, an acid ball, and a keeper who throws it back;
//   ICE       a frozen lake, a rink's lines under the ice, boards of ice: Ice Puck;
//   ARID      a hardpan pitch, stone markers and a stone wicket at each end: Sandball;
//   MYSTICAL  a rune court floating a little off the ground, rune rings for goals: Orb Ball;
//   OCEAN     a reef pool in a plank deck, floating goals: Reef Water Polo;
//   GAS       a metal platform on struts, in a sixth of a gravity: Low-G Ball;
//   MEDIEVAL  a tourney ground: the lists and their tilt, pavilions, and the archery butts.
// An arena is a field (sportsfields.js) of kind 'arena' with a theme: laid out, levelled,
// built near and dropped far just as the pitches are. It is drawn here in the same frame (y
// up, the play along -z), its paint feathered into the ground round it by a blurred shadow.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// each theme: its game, its name, how far the shot is (from the spot to the goal line), how
// far in from the end the goal stands, the goal's mouth, how high its floor stands off the
// ground, and how softly its edge meets the land
export const THEMES = {
	magma: { game: 'magmaball', label: 'Magma Ball arena', shot: 14, gw: 6, gh: 2.6, lift: 0, blur: 3 },
	toxic: { game: 'toxicdodge', label: 'Toxic Dodge court', shot: 13, gw: 5.5, gh: 2.4, lift: 0, blur: 6 },
	ice: { game: 'icepuck', label: 'Frozen lake rink', shot: 16, inset: 1.5, gw: 2.6, gh: 1.3, lift: 0, blur: 3 },
	arid: { game: 'sandball', label: 'Sandball pitch', shot: 18, inset: 2, gw: 1, gh: 1.05, lift: 0, blur: 12 },
	mystic: { game: 'orbball', label: 'Rune court', shot: 14, gw: 2.6, gh: 1.8, lift: 0.7, blur: 2 },
	ocean: { game: 'waterpolo', label: 'Reef water-polo pool', shot: 11, inset: 0.6, gw: 3, gh: 0.9, lift: 0.6, blur: 5, water: 0.35 },
	sky: { game: 'moonball', label: 'Sky platform', shot: 16, gw: 5, gh: 2.2, lift: 0.8, blur: 3 },
	tourney: { game: 'archery', label: 'Tourney ground', shot: 30, inset: 5, gw: 1.6, gh: 1.2, lift: 0, blur: 6 },
};
// which worlds get which (the rest keep their pitches)
const BY_TYPE = { MAGMA: 'magma', TOXIC: 'toxic', ICE: 'ice', ARID: 'arid', MYSTICAL: 'mystic', SINGULARITY: 'mystic', OCEAN: 'ocean', GAS: 'sky', BARREN: 'sky', GAS_GIANT: 'sky', MEDIEVAL: 'tourney' };
export const arenaTheme = (profile) => (profile ? BY_TYPE[profile.type] || null : null);

// an arena's dimensions and the rectangle it takes (the court, and the rim round it)
export function arenaSpec(theme) {
	const d = theme === 'tourney' ? { L: 92, W: 46 } : theme === 'ocean' ? { L: 40, W: 26 } : { L: 56, W: 36 };
	const m = theme === 'magma' ? 11 : 9;
	return { kind: 'arena', size: theme, theme, d, rect: [-d.W / 2 - m, d.W / 2 + m, -d.L / 2 - m, d.L / 2 + m] };
}
// the spot a game is played from: the shot's length out from the goal at the -z end
export function arenaSpot(f) {
	const T = THEMES[f.theme];
	return [0, -f.d.L / 2 + (T.inset || 0) + T.shot];
}
// the height of an arena's floor over the ground at a point of its frame (null off it)
export function arenaDeck(f, lx, lz) {
	const T = THEMES[f.theme];
	if (!T?.lift) return null;
	const { L, W } = f.d;
	const inCourt = Math.abs(lx) < W / 2 + (f.theme === 'ocean' ? 3 : 1.5) && Math.abs(lz) < L / 2 + (f.theme === 'ocean' ? 3 : 1.5);
	if (!inCourt) return null;
	// (the pool itself is waded in)
	if (f.theme === 'ocean' && Math.abs(lx) < W / 2 && Math.abs(lz) < L / 2) return null;
	return T.lift;
}

// ---------- the paint ----------
function sheet(f, ppm) {
	const [x0, x1, z0, z1] = f.rect, w = x1 - x0, d = z1 - z0;
	const cv = document.createElement('canvas');
	cv.width = Math.ceil(w * ppm); cv.height = Math.ceil(d * ppm);
	const g = cv.getContext('2d');
	g.setTransform(ppm, 0, 0, ppm, -x0 * ppm, -z0 * ppm);
	return { cv, g };
}
// a crack: a jagged line from a to b (seeded)
function crack(g, ax, az, bx, bz, jit, seed) {
	const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(L / 1.6)), nx = -(bz - az) / L, nz = (bx - ax) / L;
	g.beginPath(); g.moveTo(ax, az);
	for (let i = 1; i < n; i++) { const t = i / n, o = (hh(seed + i, seed * 0.7 - i) - 0.5) * 2 * jit; g.lineTo(ax + (bx - ax) * t + nx * o, az + (bz - az) * t + nz * o); }
	g.lineTo(bx, bz); g.stroke();
}
function ring(g, x, z, r, seed, jit) {
	const n = Math.max(12, Math.round(r * 3));
	g.beginPath();
	for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r + (i % n ? (hh(seed + i, seed) - 0.5) * 2 * jit : 0); g.lineTo(x + Math.cos(a) * rr, z + Math.sin(a) * rr); }
	g.stroke();
}
// the court's lines in the arena's own way: its border, halfway, centre circle, the boxes
function courtLines(f, draw) {
	const { L, W } = f.d;
	draw(-W / 2, -L / 2, W / 2, -L / 2); draw(W / 2, -L / 2, W / 2, L / 2); draw(W / 2, L / 2, -W / 2, L / 2); draw(-W / 2, L / 2, -W / 2, -L / 2);
	draw(-W / 2, 0, W / 2, 0);
	for (const s of [-1, 1]) {
		const z = s * L / 2, b = 8, a = 10;
		draw(-a, z, -a, z - s * b); draw(-a, z - s * b, a, z - s * b); draw(a, z - s * b, a, z);
	}
}
// scattered stones, cells, specks: n blobs of a colour
function specks(g, f, n, col, r0, r1, seed, inside = null) {
	const [x0, x1, z0, z1] = f.rect;
	g.fillStyle = col;
	for (let i = 0; i < n; i++) {
		const x = x0 + hh(seed + i, 3.1) * (x1 - x0), z = z0 + hh(seed - i, 7.7) * (z1 - z0);
		if (inside && !inside(x, z)) continue;
		g.beginPath(); g.arc(x, z, r0 + hh(i, seed) * (r1 - r0), 0, Math.PI * 2); g.fill();
	}
}

// the ground's albedo (col) and glow (glo) for each theme
const PAINT = {
	magma(f, g, e) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect, M = 4.5;
		// scorched ash out to the edge, basalt columns' tops under the court
		g.fillStyle = '#2a2320'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		specks(g, f, 900, 'rgba(12,9,8,0.55)', 0.2, 1.1, 11);
		const hx = 1.6, hz = hx * Math.sqrt(3) / 2;
		for (let z = -L / 2 - M, row = 0; z < L / 2 + M; z += hz, row++) for (let x = -W / 2 - M + (row % 2) * hx / 2; x < W / 2 + M; x += hx) {
			const k = hh(x, z);
			g.fillStyle = `rgb(${24 + k * 16},${19 + k * 12},${18 + k * 10})`;
			g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; g.lineTo(x + Math.cos(a) * hx * 0.54, z + Math.sin(a) * hx * 0.54); } g.fill();
		}
		// the court: polished obsidian slabs
		g.fillStyle = 'rgba(10,8,10,0.72)'; g.fillRect(-W / 2, -L / 2, W, L);
		g.strokeStyle = 'rgba(70,60,70,0.35)'; g.lineWidth = 0.05;
		for (let x = -W / 2; x <= W / 2; x += 4) crack(g, x, -L / 2, x, L / 2, 0.08, x);
		for (let z = -L / 2; z <= L / 2; z += 4) crack(g, -W / 2, z, W / 2, z, 0.08, z);
		// the moat of lava round it all
		const mo = (c, w) => { g.strokeStyle = c; g.lineWidth = w; g.strokeRect(-W / 2 - M - 1.6, -L / 2 - M - 1.6, W + 2 * M + 3.2, L + 2 * M + 3.2); };
		mo('#5a1a08', 4.4); mo('#c2410c', 3.2); mo('#ff8a1e', 1.6);
		e.fillStyle = '#000'; e.fillRect(x0, z0, x1 - x0, z1 - z0);
		e.strokeStyle = '#ff5a0e'; e.lineWidth = 3.4; e.strokeRect(-W / 2 - M - 1.6, -L / 2 - M - 1.6, W + 2 * M + 3.2, L + 2 * M + 3.2);
		e.strokeStyle = '#ffc060'; e.lineWidth = 1.2; e.strokeRect(-W / 2 - M - 1.6, -L / 2 - M - 1.6, W + 2 * M + 3.2, L + 2 * M + 3.2);
		// its crust: dark rafts drifting on it
		for (const c of [g, e]) {
			c.fillStyle = c === g ? 'rgba(40,14,6,0.8)' : 'rgba(0,0,0,0.75)';
			for (let i = 0; i < 90; i++) {
				const t = hh(i, 5.5), side = i % 4, r = 0.4 + hh(i, 9) * 0.9, o = (hh(i, 2) - 0.5) * 2.6;
				const X = W / 2 + M + 1.6, Z = L / 2 + M + 1.6;
				const [x, z] = side === 0 ? [-X + t * 2 * X, -Z + o] : side === 1 ? [-X + t * 2 * X, Z + o] : side === 2 ? [-X + o, -Z + t * 2 * Z] : [X + o, -Z + t * 2 * Z];
				c.beginPath(); c.ellipse(x, z, r, r * 0.6, t * 6, 0, Math.PI * 2); c.fill();
			}
		}
		// the lines: cracks through the obsidian with the lava showing, a dark seam in the albedo
		g.strokeStyle = '#3a0e04'; g.lineWidth = 0.34; g.lineCap = 'round'; g.lineJoin = 'round';
		courtLines(f, (a, b, c, d) => crack(g, a, b, c, d, 0.22, a * 3 + b));
		ring(g, 0, 0, 7, 3, 0.25);
		for (const [w, col] of [[0.42, '#c2330a'], [0.16, '#ffb040']]) {
			e.strokeStyle = col; e.lineWidth = w; e.lineCap = 'round'; e.lineJoin = 'round';
			courtLines(f, (a, b, c, d) => crack(e, a, b, c, d, 0.22, a * 3 + b));
			ring(e, 0, 0, 7, 3, 0.25);
		}
		// fine hair cracks off the lines, glowing faintly
		e.strokeStyle = 'rgba(255,90,20,0.55)'; e.lineWidth = 0.07;
		for (let i = 0; i < 70; i++) {
			const x = (hh(i, 1.3) - 0.5) * W, z = (hh(i, 4.1) - 0.5) * L, a = hh(i, 8) * 6.28, l = 1 + hh(i, 2) * 3;
			crack(e, x, z, x + Math.cos(a) * l, z + Math.sin(a) * l, 0.25, i);
		}
	},
	toxic(f, g, e) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect;
		// the sludge rim, and the crust poured over it
		g.fillStyle = '#3f5e14'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		e.fillStyle = '#000'; e.fillRect(x0, z0, x1 - x0, z1 - z0);
		specks(g, f, 260, 'rgba(120,200,30,0.5)', 0.3, 1.4, 21);
		specks(e, f, 160, 'rgba(110,255,40,0.55)', 0.2, 1.1, 23, (x, z) => Math.abs(x) > W / 2 + 3 || Math.abs(z) > L / 2 + 3);
		g.fillStyle = '#7a7654';
		g.beginPath(); g.roundRect(-W / 2 - 3, -L / 2 - 3, W + 6, L + 6, 4); g.fill();
		// crust cells: plates split by dark cracks, salt crystal at their edges
		g.strokeStyle = 'rgba(40,38,24,0.8)'; g.lineWidth = 0.09;
		for (let i = 0; i < 260; i++) { const x = (hh(i, 6.1) - 0.5) * (W + 4), z = (hh(i, 1.9) - 0.5) * (L + 4), a = hh(i, 3) * 6.28, l = 1.5 + hh(i, 5) * 3.5; crack(g, x, z, x + Math.cos(a) * l, z + Math.sin(a) * l, 0.3, i); }
		specks(g, f, 500, 'rgba(210,214,170,0.55)', 0.05, 0.25, 29, (x, z) => Math.abs(x) < W / 2 + 2 && Math.abs(z) < L / 2 + 2);
		specks(g, f, 90, 'rgba(96,120,40,0.45)', 0.4, 1.6, 31, (x, z) => Math.abs(x) < W / 2 && Math.abs(z) < L / 2);
		// the lines: hazard stripes, yellow and black
		const band = (ax, az, bx, bz, w) => {
			const L2 = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L2, uz = (bz - az) / L2;
			g.save(); g.translate(ax, az); g.rotate(Math.atan2(uz, ux));
			g.fillStyle = '#e8c21a'; g.fillRect(0, -w / 2, L2, w);
			g.beginPath(); g.rect(0, -w / 2, L2, w); g.clip();
			g.fillStyle = '#1a1a14';
			for (let s = -w; s < L2 + w; s += w * 1.4) { g.beginPath(); g.moveTo(s, -w / 2); g.lineTo(s + w * 0.7, -w / 2); g.lineTo(s + w * 0.7 - w, w / 2); g.lineTo(s - w, w / 2); g.closePath(); g.fill(); }
			g.restore();
		};
		courtLines(f, (a, b, c, d) => band(a, b, c, d, 0.45));
		// the middle: a trefoil in a ring
		g.strokeStyle = '#e8c21a'; g.lineWidth = 0.45; g.beginPath(); g.arc(0, 0, 6.5, 0, Math.PI * 2); g.stroke();
		g.fillStyle = 'rgba(232,194,26,0.9)';
		for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 3.2, a - 0.45, a + 0.45); g.closePath(); g.fill(); }
		g.fillStyle = '#1a1a14'; g.beginPath(); g.arc(0, 0, 0.9, 0, Math.PI * 2); g.fill();
		// puddles of acid in the corners, glowing
		for (const [x, z, r] of [[-W / 2 + 3, -L / 2 + 14, 1.4], [W / 2 - 4, 6, 1.1], [W / 2 - 3, L / 2 - 10, 1.6], [-W / 2 + 5, 12, 0.9]]) {
			g.fillStyle = '#6ad41c'; g.beginPath(); g.ellipse(x, z, r * 1.4, r, hh(x, z) * 3, 0, Math.PI * 2); g.fill();
			e.fillStyle = '#58e018'; e.beginPath(); e.ellipse(x, z, r * 1.3, r * 0.9, hh(x, z) * 3, 0, Math.PI * 2); e.fill();
		}
	},
	ice(f, g) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect;
		// snow round the lake, the lake's clear ice, its deeper patches and frost
		g.fillStyle = '#e9f0f5'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		const gr = g.createRadialGradient(0, 0, 4, 0, 0, L / 2 + 6);
		gr.addColorStop(0, '#6e9fbf'); gr.addColorStop(0.7, '#8fb8d2'); gr.addColorStop(1, '#b8d4e4');
		g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, W / 2 + 6, L / 2 + 6, 0, 0, Math.PI * 2); g.fill();
		specks(g, f, 120, 'rgba(70,110,140,0.25)', 1, 4, 41, (x, z) => (x / (W / 2 + 5)) ** 2 + (z / (L / 2 + 5)) ** 2 < 1);
		g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.05;
		for (let i = 0; i < 90; i++) { const x = (hh(i, 2.2) - 0.5) * W, z = (hh(i, 7.4) - 0.5) * L, a = hh(i, 1) * 6.28, l = 2 + hh(i, 3) * 6; crack(g, x, z, x + Math.cos(a) * l, z + Math.sin(a) * l, 0.4, i); }
		// the rink's lines, under the ice: red across the middle, blue lines, the circles, the creases
		const U = (c, w) => { g.strokeStyle = c; g.lineWidth = w; };
		U('rgba(200,40,40,0.7)', 0.3); g.beginPath(); g.moveTo(-W / 2, 0); g.lineTo(W / 2, 0); g.stroke();
		U('rgba(40,80,200,0.7)', 0.3); for (const z of [-L / 6, L / 6]) { g.beginPath(); g.moveTo(-W / 2, z); g.lineTo(W / 2, z); g.stroke(); }
		U('rgba(200,40,40,0.65)', 0.08);
		for (const s of [-1, 1]) {
			g.beginPath(); g.moveTo(-W / 2 + 3, s * (L / 2 - 1.5)); g.lineTo(W / 2 - 3, s * (L / 2 - 1.5)); g.stroke();
			for (const x of [-W / 4, W / 4]) { g.beginPath(); g.arc(x, s * (L / 2 - 9), 4.5, 0, Math.PI * 2); g.stroke(); }
			g.fillStyle = 'rgba(80,140,220,0.45)'; g.beginPath(); g.arc(0, s * (L / 2 - 1.5), 1.9, s > 0 ? Math.PI : 0, s > 0 ? Math.PI * 2 : Math.PI); g.fill();
		}
		g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI * 2); g.stroke();
		// the rink's rounded ends, scraped white
		g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.6; g.beginPath(); g.roundRect(-W / 2, -L / 2 - 2, W, L + 4, 8); g.stroke();
	},
	arid(f, g) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect;
		g.fillStyle = '#d6aa72'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		specks(g, f, 300, 'rgba(236,196,140,0.5)', 0.8, 3.5, 51);
		// the hardpan: clay baked into plates, cracked
		g.fillStyle = '#c0915c'; g.beginPath(); g.roundRect(-W / 2 - 2, -L / 2 - 2, W + 4, L + 4, 6); g.fill();
		g.strokeStyle = 'rgba(96,62,34,0.55)'; g.lineWidth = 0.07;
		for (let i = 0; i < 380; i++) { const x = (hh(i, 3.3) - 0.5) * (W + 2), z = (hh(i, 8.8) - 0.5) * (L + 2), a = hh(i, 4) * 6.28, l = 0.8 + hh(i, 6) * 2.4; crack(g, x, z, x + Math.cos(a) * l, z + Math.sin(a) * l, 0.25, i); }
		specks(g, f, 200, 'rgba(226,188,132,0.35)', 0.5, 2.2, 53, (x, z) => Math.abs(x) < W / 2 && Math.abs(z) < L / 2);
		// the strip between the wickets, packed pale and raked
		const sl = f.d.L / 2 - 2;
		g.fillStyle = '#e2c898'; g.fillRect(-1.6, -sl, 3.2, sl * 2);
		g.strokeStyle = 'rgba(160,120,80,0.35)'; g.lineWidth = 0.04;
		for (let x = -1.4; x <= 1.4; x += 0.35) { g.beginPath(); g.moveTo(x, -sl); g.lineTo(x, sl); g.stroke(); }
		// creases, scratched in
		g.strokeStyle = 'rgba(250,236,210,0.9)'; g.lineWidth = 0.08;
		for (const s of [-1, 1]) for (const dz of [0, 1.22]) { const z = s * (L / 2 - 2 - dz); g.beginPath(); g.moveTo(-1.6, z); g.lineTo(1.6, z); g.stroke(); }
		// the boundary: a ring of flat stones
		g.fillStyle = '#8a7660';
		for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, x = Math.cos(a) * (W / 2), z = Math.sin(a) * (L / 2); g.beginPath(); g.ellipse(x, z, 0.35, 0.22, a, 0, Math.PI * 2); g.fill(); }
	},
	mystic(f, g, e) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect;
		// the ground under the court: its glow, the court floats over it
		g.fillStyle = '#3a3050'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		e.fillStyle = '#000'; e.fillRect(x0, z0, x1 - x0, z1 - z0);
		g.fillStyle = '#2a2440'; g.beginPath(); g.roundRect(-W / 2 - 1.5, -L / 2 - 1.5, W + 3, L + 3, 5); g.fill();
		specks(g, f, 200, 'rgba(90,70,130,0.35)', 0.3, 1.5, 61, (x, z) => Math.abs(x) < W / 2 && Math.abs(z) < L / 2);
		// the rune lines: its border, its circles, the star between them, the glyphs round the ring
		const glow = (w, col) => { for (const c of [g, e]) { c.strokeStyle = c === g ? '#8a70d0' : col; c.lineWidth = w; } };
		const both = (fn) => { fn(g); fn(e); };
		glow(0.18, '#b890ff');
		both((c) => { c.beginPath(); c.roundRect(-W / 2 + 0.6, -L / 2 + 0.6, W - 1.2, L - 1.2, 4); c.stroke(); c.beginPath(); c.moveTo(-W / 2 + 0.6, 0); c.lineTo(W / 2 - 0.6, 0); c.stroke(); });
		for (const r of [5, 7.5]) both((c) => { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); });
		both((c) => { c.beginPath(); for (let i = 0; i <= 5; i++) { const a = i * 4 / 5 * Math.PI - Math.PI / 2; c.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); } c.stroke(); });
		for (const s of [-1, 1]) both((c) => { c.beginPath(); c.arc(0, s * L / 2, 8, s > 0 ? Math.PI : 0, s > 0 ? Math.PI * 2 : Math.PI); c.stroke(); c.beginPath(); c.arc(0, s * (L / 2 - 11), 1.2, 0, Math.PI * 2); c.stroke(); });
		glow(0.09, '#70e0ff');
		const glyph = (c, x, z, k) => {
			c.save(); c.translate(x, z); c.rotate(k * 6.28);
			c.beginPath();
			for (let j = 0; j < 3; j++) { const a = hh(k, j) * 6.28, b = hh(j, k) * 6.28; c.moveTo(Math.cos(a) * 0.45, Math.sin(a) * 0.45); c.lineTo(Math.cos(b) * 0.45, Math.sin(b) * 0.45); }
			c.stroke(); c.restore();
		};
		for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; both((c) => glyph(c, Math.cos(a) * 6.25, Math.sin(a) * 6.25, i + 0.5)); }
		for (let i = 0; i < 36; i++) { const s = i < 18 ? -1 : 1, t = (i % 18) / 17; both((c) => glyph(c, s * (W / 2 - 1.6), -L / 2 + 3 + t * (L - 6), i * 1.7)); }
	},
	ocean(f, g) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect;
		// wet sand round the deck; the pool's floor, a reef of sand, coral and weed
		g.fillStyle = '#dccca2'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		g.fillStyle = '#c9b88a'; g.fillRect(-W / 2, -L / 2, W, L);
		specks(g, f, 240, 'rgba(240,226,190,0.6)', 0.1, 0.5, 71, (x, z) => Math.abs(x) < W / 2 && Math.abs(z) < L / 2);
		const cols = ['#e0707a', '#f09a4a', '#b070c0', '#e8d060', '#6aa0a0'];
		for (let i = 0; i < 70; i++) {
			const x = (hh(i, 9.1) - 0.5) * (W - 2), z = (hh(i, 2.7) - 0.5) * (L - 2);
			g.fillStyle = cols[i % cols.length];
			for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (hh(i, k) - 0.5) * 1.2, z + (hh(k, i) - 0.5) * 1.2, 0.12 + hh(k + i, 3) * 0.3, 0, Math.PI * 2); g.fill(); }
		}
		g.strokeStyle = 'rgba(60,110,50,0.6)'; g.lineWidth = 0.06;
		for (let i = 0; i < 160; i++) { const x = (hh(i, 1.1) - 0.5) * W, z = (hh(i, 5.3) - 0.5) * L; g.beginPath(); g.moveTo(x, z); g.quadraticCurveTo(x + 0.2, z - 0.3, x + (hh(i, 2) - 0.5) * 0.6, z - 0.6); g.stroke(); }
		// the lines on the pool floor: the halfway, two and five metres out from each goal
		g.lineWidth = 0.18;
		for (const [z, c] of [[0, '#ffffff'], [-L / 2 + 2, '#d02020'], [L / 2 - 2, '#d02020'], [-L / 2 + 5, '#e8c020'], [L / 2 - 5, '#e8c020']]) { g.strokeStyle = c; g.beginPath(); g.moveTo(-W / 2, z); g.lineTo(W / 2, z); g.stroke(); }
		// the deck's planks round it
		const D = 3;
		for (const [x, z, w, d, along] of [[-W / 2 - D, -L / 2 - D, W + 2 * D, D, 'x'], [-W / 2 - D, L / 2, W + 2 * D, D, 'x'], [-W / 2 - D, -L / 2, D, L, 'z'], [W / 2, -L / 2, D, L, 'z']]) {
			g.fillStyle = '#8a6a48'; g.fillRect(x, z, w, d);
			g.strokeStyle = 'rgba(50,34,20,0.7)'; g.lineWidth = 0.03;
			if (along === 'x') for (let k = z; k <= z + d; k += 0.3) { g.beginPath(); g.moveTo(x, k); g.lineTo(x + w, k); g.stroke(); }
			else for (let k = x; k <= x + w; k += 0.3) { g.beginPath(); g.moveTo(k, z); g.lineTo(k, z + d); g.stroke(); }
		}
	},
	sky(f, g, e) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect;
		// the ground under it: scorched by the landers; the platform's plates over it
		g.fillStyle = '#4a4844'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		e.fillStyle = '#000'; e.fillRect(x0, z0, x1 - x0, z1 - z0);
		g.fillStyle = '#8c9298'; g.fillRect(-W / 2 - 1.5, -L / 2 - 1.5, W + 3, L + 3);
		for (let x = -W / 2 - 1.5, i = 0; x < W / 2 + 1.5; x += 3, i++) for (let z = -L / 2 - 1.5, j = 0; z < L / 2 + 1.5; z += 3, j++) {
			const k = hh(i, j);
			g.fillStyle = `rgb(${128 + k * 22},${134 + k * 22},${142 + k * 20})`; g.fillRect(x + 0.04, z + 0.04, 2.92, 2.92);
			g.fillStyle = 'rgba(40,44,50,0.6)'; for (const [a, b] of [[0.2, 0.2], [2.8, 0.2], [0.2, 2.8], [2.8, 2.8]]) { g.beginPath(); g.arc(x + a, z + b, 0.05, 0, 6.3); g.fill(); }
		}
		// the edge: hazard chevrons; the lines in light
		g.save(); g.beginPath(); g.rect(-W / 2 - 1.5, -L / 2 - 1.5, W + 3, L + 3); g.rect(W / 2 - 0.3, -L / 2 + 0.3, -W + 0.6, L - 0.6); g.clip('evenodd');
		g.fillStyle = '#e0b020'; g.fillRect(-W / 2 - 1.5, -L / 2 - 1.5, W + 3, L + 3);
		g.fillStyle = '#20242a'; for (let s = -L; s < L + W; s += 1.2) { g.beginPath(); g.moveTo(-W, s); g.lineTo(-W + 0.6, s); g.lineTo(W + 0.6, s + 2 * W); g.lineTo(W, s + 2 * W); g.fill(); }
		g.restore();
		for (const c of [g, e]) {
			c.strokeStyle = c === g ? '#bfefff' : '#40d8ff'; c.lineWidth = 0.14;
			courtLines(f, (a, b, cc, d) => { c.beginPath(); c.moveTo(a, b); c.lineTo(cc, d); c.stroke(); });
			c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.stroke();
		}
	},
	tourney(f, g) {
		const { L, W } = f.d, [x0, x1, z0, z1] = f.rect;
		// the green, mown in bands across; the lists worn to earth along the tilt
		g.fillStyle = '#4a7a34'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
		for (let z = -L / 2, i = 0; z < L / 2; z += 5, i++) if (i % 2) { g.fillStyle = '#57893e'; g.fillRect(-W / 2, z, W, 5); }
		g.fillStyle = '#a88a5a'; g.beginPath(); g.roundRect(-7, -L / 2 + 16, 14, L - 22, 3); g.fill();
		specks(g, f, 200, 'rgba(120,96,60,0.5)', 0.1, 0.5, 81, (x, z) => Math.abs(x) < 7 && z > -L / 2 + 16);
		// the archery range: the shooting line, the lanes out to the butts
		const sz = arenaSpot(f)[1];
		g.strokeStyle = '#f0ece0'; g.lineWidth = 0.12;
		g.beginPath(); g.moveTo(-W / 2 + 4, sz); g.lineTo(-8, sz); g.moveTo(8, sz); g.lineTo(W / 2 - 4, sz); g.stroke();
		g.fillStyle = '#9a7a4a'; g.fillRect(-3, -L / 2 + 2, 6, 5);
		g.strokeStyle = 'rgba(240,236,224,0.5)'; g.lineWidth = 0.06;
		for (const x of [-5, -1.7, 1.7, 5]) { g.beginPath(); g.moveTo(x, -L / 2 + 3); g.lineTo(x, -L / 2 + 16); g.stroke(); }
	},
};
// how each arena's paint meets the ground round it: its outline, drawn in metres
const EDGE = {
	magma: (m, f) => { const { L, W } = f.d; m.roundRect(-W / 2 - 9.5, -L / 2 - 9.5, W + 19, L + 19, 6); },
	toxic: (m, f) => {
		const { L, W } = f.d, n = 64;
		for (let i = 0; i <= n; i++) {
			const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = Math.max(Math.abs(c) / (W / 2 + 6), Math.abs(s) / (L / 2 + 6));
			const r = (1 / k) * (0.92 + 0.12 * hh(i % n, 3.3));
			m.lineTo(c * r, s * r);
		}
	},
	ice: (m, f) => { m.ellipse(0, 0, f.d.W / 2 + 8.5, f.d.L / 2 + 8.5, 0, 0, Math.PI * 2); },
	arid: (m, f) => { m.ellipse(0, 0, f.d.W / 2 + 6, f.d.L / 2 + 6, 0, 0, Math.PI * 2); },
	mystic: (m, f) => { m.roundRect(-f.d.W / 2 - 6, -f.d.L / 2 - 6, f.d.W + 12, f.d.L + 12, 8); },
	ocean: (m, f) => { m.roundRect(-f.d.W / 2 - 6.5, -f.d.L / 2 - 6.5, f.d.W + 13, f.d.L + 13, 5); },
	sky: (m, f) => { m.roundRect(-f.d.W / 2 - 6, -f.d.L / 2 - 6, f.d.W + 12, f.d.L + 12, 6); },
	tourney: (m, f) => { m.roundRect(f.rect[0] + 3, f.rect[2] + 3, f.rect[1] - f.rect[0] - 6, f.rect[3] - f.rect[2] - 6, 10); },
};
// the edge made soft on the GPU (a blurred shadow of the outline, cast onto the canvas from
// off it): no reading pixels back
function feather(cv, f, blur) {
	const [x0, x1, z0, z1] = f.rect, w = x1 - x0, d = z1 - z0, mw = Math.ceil(w), md = Math.ceil(d);
	const mk = document.createElement('canvas');
	mk.width = mw; mk.height = md;
	const m = mk.getContext('2d'), OFF = mw + md + 64;
	m.setTransform(1, 0, 0, 1, -x0 - OFF, -z0);
	m.shadowColor = '#000'; m.shadowBlur = blur; m.shadowOffsetX = OFF; m.shadowOffsetY = 0;
	m.fillStyle = '#000'; m.beginPath(); EDGE[f.theme](m, f); m.closePath(); m.fill();
	const g = cv.getContext('2d');
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.globalCompositeOperation = 'destination-in';
	g.imageSmoothingEnabled = true;
	g.drawImage(mk, 0, 0, cv.width, cv.height);
	g.globalCompositeOperation = 'source-over';
}
const GLOWS = { magma: true, toxic: true, mystic: true, sky: true };
function paintArena(f, res) {
	// (a little coarser than a pitch's chalk: the arenas' marks are broad, and a phone's paint is the stall)
	const [x0, x1, z0, z1] = f.rect, ppm = Math.min(res * 0.75, 2048 / Math.max(x1 - x0, z1 - z0));
	const A = sheet(f, ppm), E = GLOWS[f.theme] ? sheet(f, ppm * 0.5) : null;
	PAINT[f.theme](f, A.g, E?.g);
	feather(A.cv, f, f.theme === 'mystic' || f.theme === 'sky' || f.theme === 'ocean' ? 2 : THEMES[f.theme].blur);
	const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
	return { map: tex(A.cv), glow: E ? tex(E.cv) : null };
}

// ---------- the things that stand on it ----------
// the materials an arena makes for itself (freed with it)
function arenaMaterials(theme) {
	const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.8, ...o });
	const G = (c, k = 1, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).multiplyScalar(0.3), emissive: new THREE.Color(c), emissiveIntensity: k, roughness: 0.6, ...o });
	const A = (c, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, ...o });
	const common = { white: S('#f2f2ee', { roughness: 0.5 }), wood: S('#7a5a3a', { roughness: 0.9 }), rope: S('#d8c8a0') };
	if (theme === 'magma') return { ...common, basalt: S('#2a2422', { roughness: 0.95, flatShading: true }), obsidian: S('#120e12', { roughness: 0.18, metalness: 0.3, flatShading: true }), lava: G('#ff5a10', 1.6), ember: G('#ffb040', 2.2), curtain: A('#ff7a2a', { opacity: 0.6 }), halo: A('#ff6a1a', { opacity: 0.22 }) };
	if (theme === 'toxic') return { ...common, rust: S('#7a4424', { roughness: 0.9, metalness: 0.4 }), steel: S('#5a6058', { metalness: 0.6, roughness: 0.5 }), stripe: S('#e8c21a', { roughness: 0.6 }), dark: S('#1a1a14'), acid: G('#7dff2a', 1.4, { transparent: true, opacity: 0.85 }), halo: A('#7dff2a', { opacity: 0.18 }), net: S('#8a9080', { metalness: 0.5, roughness: 0.4, wireframe: true }) };
	if (theme === 'ice') return { ...common, ice: S('#bfe4f4', { roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.78 }), snow: S('#f4f8fb', { roughness: 1 }), red: S('#c82828', { roughness: 0.4 }), netw: S('#e8eef2', { wireframe: true }) };
	if (theme === 'arid') return { ...common, stone: S('#9a8670', { roughness: 1, flatShading: true }), sandstone: S('#b8845a', { roughness: 1, flatShading: true }), cloth: S('#c85a3a', { side: THREE.DoubleSide }), pot: S('#a8603a') };
	if (theme === 'mystic') return { ...common, slate: S('#3a3252', { roughness: 0.7 }), crystal: G('#b890ff', 1.2, { transparent: true, opacity: 0.85, flatShading: true }), cyan: G('#70e0ff', 1.6), rune: G('#b890ff', 1.8), under: A('#8a60ff', { opacity: 0.35 }), halo: A('#b890ff', { opacity: 0.18 }) };
	if (theme === 'ocean') return { ...common, plank: S('#8a6a48', { roughness: 0.9 }), post: S('#5a4430'), water: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2ab0c0'), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }), red: S('#d02020'), yellow: S('#f0c020'), netw: S('#f0f0f0', { wireframe: true }), float: S('#f06a1a') };
	if (theme === 'sky') return { ...common, metal: S('#8c9298', { metalness: 0.7, roughness: 0.35 }), dark: S('#2a2e34', { metalness: 0.6, roughness: 0.4 }), cyan: G('#40d8ff', 2), field: A('#40d8ff', { opacity: 0.16 }), halo: A('#40d8ff', { opacity: 0.2 }) };
	return { ...common, straw: S('#d8b860', { roughness: 1 }), canvasA: S('#c83030', { side: THREE.DoubleSide }), canvasB: S('#f0e8d8', { side: THREE.DoubleSide }), canvasC: S('#2848a0', { side: THREE.DoubleSide }), pole: S('#5a4028'), gold: S('#e0b040', { metalness: 0.5, roughness: 0.4 }) };
}

// the arena: its paint over the ground (H: the ground's height at a point of the frame), and
// everything standing on it. Returns what buildField does, and a tick for what moves.
export function buildArena(f, H, { res = 12, shadows = true } = {}) {
	const T = THEMES[f.theme], M = arenaMaterials(f.theme), group = new THREE.Group(), parts = new Map(), walls = [];
	const put = (m, geo) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(geo.index ? geo.toNonIndexed() : geo); };
	const box = (m, w, h, d, x, y, z, ry = 0) => put(m, new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(ry).translate(x, y, z));
	const cyl = (m, r0, r1, h, x, y, z, seg = 8) => put(m, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y + h / 2, z));
	const bar = (m, r, a, b, seg = 8) => {
		const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = v.length();
		const geo = new THREE.CylinderGeometry(r, r, l, seg).translate(0, l / 2, 0);
		geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
		put(m, geo.translate(a[0], a[1], a[2]));
	};
	const quad = (m, a, b, c, d) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); put(m, geo); };
	const G = (x, z) => H(x, z);
	const { L, W } = f.d, lift = T.lift, [x0, x1, z0, z1] = f.rect;
	const movers = [], extra = [];

	// the ground: the paint draped over the land (and over a floor raised off it)
	const P = paintArena(f, res);
	const drape = (keep, up, mat) => {
		const nx = Math.ceil((x1 - x0) / 3), nz = Math.ceil((z1 - z0) / 3), pos = [], uv = [], idx = [], vid = new Map();
		const v = (i, j) => {
			const k = i + ',' + j;
			if (vid.has(k)) return vid.get(k);
			const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
			pos.push(x, G(x, z) + up(x, z), z); uv.push((x - x0) / (x1 - x0), 1 - (z - z0) / (z1 - z0));
			vid.set(k, pos.length / 3 - 1);
			return pos.length / 3 - 1;
		};
		for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
			const cx = x0 + (x1 - x0) * (i + 0.5) / nx, cz = z0 + (z1 - z0) * (j + 0.5) / nz;
			if (!keep(cx, cz)) continue;
			const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
			idx.push(a, d, b, b, d, c);
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		geo.setIndex(idx); geo.computeVertexNormals();
		const mesh = new THREE.Mesh(geo, mat);
		mesh.receiveShadow = true; mesh.userData.fieldGround = true;
		group.add(mesh);
		return mesh;
	};
	const groundMat = new THREE.MeshStandardMaterial({
		map: P.map, roughness: f.theme === 'ice' ? 0.15 : f.theme === 'magma' ? 0.55 : 0.92, metalness: f.theme === 'sky' ? 0.4 : 0,
		emissiveMap: P.glow, emissive: new THREE.Color(P.glow ? 0xffffff : 0x000000), emissiveIntensity: f.theme === 'magma' ? 1.6 : 1.1,
		transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
	});
	// (a raised floor's own edge: the court's rectangle, and how far out its deck runs)
	const rim = f.theme === 'ocean' ? 3 : 1.5;
	drape(() => true, () => 0.06, groundMat);
	if (lift) {
		// the floor itself, lifted: slabs exactly the deck's shape, the same paint on them
		const deckMat = groundMat.clone();
		deckMat.transparent = false; deckMat.depthWrite = true;
		const slab = (ax, bx, az, bz) => {
			const nx = Math.max(1, Math.ceil((bx - ax) / 3)), nz = Math.max(1, Math.ceil((bz - az) / 3)), pos = [], uv = [], idx = [];
			for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
				const x = ax + (bx - ax) * i / nx, z = az + (bz - az) * j / nz;
				pos.push(x, G(x, z) + lift, z); uv.push((x - x0) / (x1 - x0), 1 - (z - z0) / (z1 - z0));
			}
			for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1; idx.push(a, d, b, b, d, c); }
			const geo = new THREE.BufferGeometry();
			geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
			geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
			geo.setIndex(idx); geo.computeVertexNormals();
			const m = new THREE.Mesh(geo, deckMat);
			m.receiveShadow = true; m.userData.fieldGround = true;
			group.add(m);
		};
		const X = W / 2 + rim, Z = L / 2 + rim;
		if (f.theme === 'ocean') { slab(-X, X, -Z, -L / 2); slab(-X, X, L / 2, Z); slab(-X, -W / 2, -L / 2, L / 2); slab(W / 2, X, -L / 2, L / 2); }
		else slab(-X, X, -Z, Z);
		// its sides: a skirt from the ground up to the floor, all round (and round the pool)
		const side = f.theme === 'ocean' ? M.post : f.theme === 'sky' ? M.dark : M.slate;
		const skirt = (hw, hd, drop) => {
			const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
			for (let i = 0; i < 4; i++) {
				const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 3);
				for (let k = 0; k < n; k++) {
					const px = ax + (bx - ax) * k / n, pz = az + (bz - az) * k / n, qx = ax + (bx - ax) * (k + 1) / n, qz = az + (bz - az) * (k + 1) / n;
					quad(side, [px, G(px, pz) + lift - drop, pz], [qx, G(qx, qz) + lift - drop, qz], [qx, G(qx, qz) + lift, qz], [px, G(px, pz) + lift, pz]);
					quad(side, [qx, G(qx, qz) + lift - drop, qz], [px, G(px, pz) + lift - drop, pz], [px, G(px, pz) + lift, pz], [qx, G(qx, qz) + lift, qz]);
				}
			}
		};
		// (the rune court floats: its slab is thin and the light shows under it)
		skirt(W / 2 + rim, L / 2 + rim, f.theme === 'mystic' ? 0.28 : lift + 0.3);
		if (f.theme === 'ocean') skirt(W / 2, L / 2, lift + 0.3);
	}

	// ---------- the goals, the props and the lights of each ----------
	const gz = -L / 2, gw = T.gw, gh = T.gh;
	const ends = [-1, 1];
	if (f.theme === 'magma') {
		for (const s of ends) {
			const z = s * L / 2, y = G(0, z);
			// basalt columns, a lintel over them; a curtain of heat in the mouth
			for (const x of [-gw / 2 - 0.35, gw / 2 + 0.35]) { put(M.basalt, new THREE.CylinderGeometry(0.42, 0.5, gh + 0.4, 6).translate(x, y + (gh + 0.4) / 2 - 0.2, z)); walls.push([x, z, x, z, 0.5, y + gh]); }
			box(M.basalt, gw + 1.8, 0.55, 0.9, 0, y + gh, z);
			for (const x of [-gw / 2 + 0.2, 0, gw / 2 - 0.2]) box(M.lava, 0.18, 0.08, 0.92, x, y + gh + 0.5, z);
			quad(M.curtain, [-gw / 2, y, z + s * 0.6], [gw / 2, y, z + s * 0.6], [gw / 2, y + gh, z + s * 0.2], [-gw / 2, y + gh, z + s * 0.2]);
			box(M.obsidian, gw + 1, gh * 0.6, 0.3, 0, y, z + s * 1.4);
			walls.push([-gw / 2, z + s * 1.4, gw / 2, z + s * 1.4, 0.2, y + gh * 0.6]);
		}
		// obsidian spires at the corners, braziers of lava down the sides
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
			const x = sx * (W / 2 + 2.5), z = sz * (L / 2 + 2.5), y = G(x, z);
			for (let k = 0; k < 3; k++) { const h = 3.5 + hh(x + k, z) * 3.5, ox = (hh(k, x) - 0.5) * 1.6, oz = (hh(z, k) - 0.5) * 1.6; put(M.obsidian, new THREE.ConeGeometry(0.5 + hh(k, z) * 0.4, h, 5).rotateZ((hh(k, x + z) - 0.5) * 0.3).translate(x + ox, y + h / 2 - 0.2, z + oz)); }
			walls.push([x, z, x, z, 1.2, y + 5]);
		}
		for (const sx of [-1, 1]) for (const z of [-L / 3, 0, L / 3]) {
			const x = sx * (W / 2 + 2.2), y = G(x, z);
			put(M.basalt, new THREE.CylinderGeometry(0.55, 0.35, 1.1, 6).translate(x, y + 0.55, z));
			put(M.lava, new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(x, y + 1.02, z));
			const fl = glowSprite('#ff7a2a', 2.2, extra);
			fl.position.set(x, y + 1.5, z); group.add(fl); movers.push({ o: fl, k: 'flicker', ph: hh(x, z) * 6, s: 2.2 });
			walls.push([x, z, x, z, 0.55, y + 1.1]);
		}
		// the moat's glow rising off it: sheets of light standing over the lava, fading upward
		const hz = document.createElement('canvas'); hz.width = 4; hz.height = 64;
		{ const c = hz.getContext('2d'), gr = c.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 4, 64); }
		const hzT = new THREE.CanvasTexture(hz); extra.push(hzT);
		M.haze = new THREE.MeshBasicMaterial({ map: hzT, color: new THREE.Color('#ff5a14'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, opacity: 0.5 });
		const X = W / 2 + 6.1, Z = L / 2 + 6.1;
		for (const [ax, az, bx, bz] of [[-X, -Z, X, -Z], [X, -Z, X, Z], [X, Z, -X, Z], [-X, Z, -X, -Z]]) {
			const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
			for (let k = 0; k < n; k++) {
				const px = ax + (bx - ax) * k / n, pz = az + (bz - az) * k / n, qx = ax + (bx - ax) * (k + 1) / n, qz = az + (bz - az) * (k + 1) / n;
				quad(M.haze, [px, G(px, pz), pz], [qx, G(qx, qz), qz], [qx, G(qx, qz) + 2.2, qz], [px, G(px, pz) + 2.2, pz]);
			}
		}
	} else if (f.theme === 'toxic') {
		for (const s of ends) {
			const z = s * L / 2, y = G(0, z), bz = z + s * 1.6;
			// a goal of rusted pipe, its net of chain
			for (const x of [-gw / 2, gw / 2]) { cyl(M.rust, 0.1, 0.1, gh, x, y, z, 8); bar(M.rust, 0.07, [x, y + gh, z], [x, y, bz], 6); walls.push([x, z, x, z, 0.12, y + gh]); }
			bar(M.rust, 0.1, [-gw / 2, y + gh, z], [gw / 2, y + gh, z], 8);
			put(M.net, new THREE.PlaneGeometry(gw, Math.hypot(gh, 1.6), 10, 6).rotateX(s > 0 ? -Math.atan2(1.6, gh) : Math.atan2(1.6, gh)).translate(0, y + gh / 2, (z + bz) / 2));
			walls.push([-gw / 2, bz, gw / 2, bz, 0.1, y + 1.5]);
			// the warning posts either side
			for (const x of [-gw / 2 - 2.2, gw / 2 + 2.2]) { cyl(M.stripe, 0.12, 0.12, 1.2, x, y, z, 8); cyl(M.dark, 0.13, 0.13, 0.2, x, y + 0.3, z, 8); cyl(M.dark, 0.13, 0.13, 0.2, x, y + 0.75, z, 8); }
		}
		// barrels, leaking, round the rim; a few tipped
		for (let i = 0; i < 14; i++) {
			const a = hh(i, 4.4) * Math.PI * 2, x = Math.cos(a) * (W / 2 + 4 + hh(i, 1) * 3), z = Math.sin(a) * (L / 2 + 4 + hh(i, 2) * 3), y = G(x, z);
			if (Math.abs(x) < 6) continue;
			const tip = hh(i, 7) < 0.3;
			const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12);
			if (tip) geo.rotateZ(Math.PI / 2).translate(x, y + 0.4, z); else geo.translate(x, y + 0.55, z);
			put(M.rust, geo);
			if (!tip) put(M.acid, new THREE.CylinderGeometry(0.36, 0.36, 0.04, 12).translate(x, y + 1.11, z));
			walls.push([x, z, x, z, 0.45, y + 1.1]);
		}
		// bubbles on the sludge, swelling and bursting
		for (let i = 0; i < 18; i++) {
			const a = hh(i, 8.8) * Math.PI * 2, x = Math.cos(a) * (W / 2 + 5 + hh(i, 3) * 2), z = Math.sin(a) * (L / 2 + 5 + hh(i, 5) * 2);
			const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.acid);
			b.position.set(x, G(x, z) + 0.02, z); group.add(b); movers.push({ o: b, k: 'bubble', ph: hh(i, 2) * 6, sp: 0.4 + hh(i, 9) * 0.6 });
		}
	} else if (f.theme === 'ice') {
		for (const s of ends) {
			const z = s * (L / 2 - T.inset), y = G(0, z), bz = z + s * 1.1;
			// a red frame, a white net
			for (const x of [-gw / 2, gw / 2]) { cyl(M.red, 0.05, 0.05, gh, x, y, z, 8); bar(M.red, 0.04, [x, y + gh, z], [x, y, bz], 6); walls.push([x, z, x, z, 0.06, y + gh]); }
			bar(M.red, 0.05, [-gw / 2, y + gh, z], [gw / 2, y + gh, z], 8);
			bar(M.red, 0.04, [-gw / 2, y, bz], [gw / 2, y, bz], 6);
			put(M.netw, new THREE.PlaneGeometry(gw, Math.hypot(gh, 1.1), 8, 5).rotateX(s > 0 ? -Math.atan2(1.1, gh) : Math.atan2(1.1, gh)).translate(0, y + gh / 2, (z + bz) / 2));
		}
		// boards of ice down the sides, snow banked behind them, ice blocks at the corners
		for (const sx of [-1, 1]) for (let z = -L / 2 + 2; z < L / 2 - 2; z += 4) {
			const x = sx * (W / 2 + 0.4);
			box(M.ice, 0.5, 0.9, 4, x, G(x, z + 2) - 0.1, z + 2);
			put(M.snow, new THREE.SphereGeometry(1, 8, 5).scale(1.6, 0.7, 2.6).translate(x + sx * 1.8, G(x + sx * 1.8, z + 2), z + 2));
		}
		walls.push([-W / 2 - 0.4, -L / 2, -W / 2 - 0.4, L / 2, 0.3, G(0, 0) + 0.8], [W / 2 + 0.4, -L / 2, W / 2 + 0.4, L / 2, 0.3, G(0, 0) + 0.8]);
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) {
			const x = sx * (W / 2 + 3 + k * 0.8), z = sz * (L / 2 + 2 + hh(k, sx) * 2), s = 0.8 + hh(sx + k, sz) * 0.8;
			put(M.ice, new THREE.BoxGeometry(s, s, s).rotateY(hh(k, sz) * 3).translate(x, G(x, z) + s / 2 - 0.1, z));
		}
		// flags on the snow at the four corners
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (W / 2 + 5), z = sz * (L / 2 + 5), y = G(x, z); cyl(M.wood, 0.04, 0.04, 3, x, y, z, 6); put(M.red, new THREE.PlaneGeometry(0.9, 0.55).translate(x + 0.45, y + 2.7, z)); }
	} else if (f.theme === 'arid') {
		// the stone wickets: three stumps and their bails, at each end
		for (const s of ends) {
			const z = s * (L / 2 - T.inset), y = G(0, z);
			for (const x of [-0.36, 0, 0.36]) cyl(M.stone, 0.08, 0.09, gh, x, y, z, 7);
			for (const x of [-0.18, 0.18]) box(M.stone, 0.36, 0.06, 0.07, x, y + gh, z);
			walls.push([-0.4, z, 0.4, z, 0.1, y + gh]);
		}
		// cairns and standing stones round the boundary; an awning with its pots
		for (let i = 0; i < 12; i++) {
			const a = i / 12 * Math.PI * 2 + 0.13, x = Math.cos(a) * (W / 2 + 3), z = Math.sin(a) * (L / 2 + 3), y = G(x, z);
			if (i % 3 === 0) { const h = 2.2 + hh(i, 1) * 1.8; put(M.sandstone, new THREE.BoxGeometry(0.9, h, 0.6, 1, 2, 1).rotateY(a).translate(x, y + h / 2 - 0.2, z)); walls.push([x, z, x, z, 0.6, y + h]); }
			else for (let k = 0; k < 3; k++) { const r = 0.4 - k * 0.1; put(M.stone, new THREE.DodecahedronGeometry(r, 0).translate(x, y + 0.2 + k * 0.5, z)); }
		}
		const ax = W / 2 + 5, y = G(ax, 0);
		for (const [px, pz] of [[-1.8, -3], [1.8, -3], [-1.8, 3], [1.8, 3]]) cyl(M.wood, 0.06, 0.06, 2.6, ax + px, y, pz, 6);
		put(M.cloth, new THREE.PlaneGeometry(4.2, 6.6).rotateX(-Math.PI / 2).rotateZ(0.12).translate(ax, y + 2.6, 0));
		for (let k = 0; k < 4; k++) put(M.pot, new THREE.SphereGeometry(0.3, 8, 6).scale(1, 1.2, 1).translate(ax - 1 + k * 0.6, y + 0.32, 1.6));
		walls.push([ax, -3, ax, 3, 2, y + 2.6]);
	} else if (f.theme === 'mystic') {
		const y0 = (x, z) => G(x, z) + lift;
		// the goals: rune rings standing on end over each goal line
		for (const s of ends) {
			const z = s * L / 2, r = gw / 2 + 0.3;
			const rr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 8, 40), M.rune);
			rr.position.set(0, y0(0, z) + gh / 2 + 0.6, z); group.add(rr); movers.push({ o: rr, k: 'spin', ph: s });
			const d = new THREE.Mesh(new THREE.CircleGeometry(r, 32), M.halo);
			d.position.copy(rr.position); group.add(d);
			cyl(M.slate, 0.3, 0.45, 0.35, 0, y0(0, z), z, 6);
		}
		// crystals floating round the court, bobbing; the glow under the slab
		for (let i = 0; i < 14; i++) {
			const a = i / 14 * Math.PI * 2, x = Math.cos(a) * (W / 2 + 4 + hh(i, 1) * 2), z = Math.sin(a) * (L / 2 + 4 + hh(i, 2) * 2), s = 0.4 + hh(i, 3) * 0.6;
			const c = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0).scale(0.6, 1.4, 0.6), M.crystal);
			c.position.set(x, G(x, z) + 1.6 + hh(i, 4) * 1.4, z); group.add(c); movers.push({ o: c, k: 'bob', ph: i, y: c.position.y });
		}
		const u = new THREE.Mesh(new THREE.PlaneGeometry(W + 5, L + 5).rotateX(-Math.PI / 2), M.under);
		u.position.set(0, G(0, 0) + lift - 0.34, 0); group.add(u);
		// arches of standing slate at the halfway line
		for (const sx of [-1, 1]) {
			const x = sx * (W / 2 + 2.6), y = G(x, 0);
			for (const z of [-1.3, 1.3]) box(M.slate, 0.5, 3.6, 0.5, x, y, z);
			box(M.slate, 0.6, 0.4, 3.4, x, y + 3.6, 0);
			box(M.cyan, 0.08, 0.08, 2.4, x, y + 3.5, 0);
			walls.push([x, -1.3, x, 1.3, 0.35, y + 3.6]);
		}
	} else if (f.theme === 'ocean') {
		const wl = T.water;
		// the pool's water, rippling
		const wt = waterTex();
		extra.push(wt);
		const wm = M.water.clone(); wm.map = wt; wm.color.set('#9ef0f0');
		const water = new THREE.Mesh(new THREE.PlaneGeometry(W, L).rotateX(-Math.PI / 2), wm);
		water.position.set(0, G(0, 0) + wl, 0); group.add(water); movers.push({ o: water, k: 'ripple', t: wt });
		// floating goals at each end: a frame on floats, a net
		for (const s of ends) {
			const z = s * (L / 2 - T.inset), y = G(0, z) + wl, bz = z + s * 0.8;
			for (const x of [-gw / 2, gw / 2]) { cyl(M.white, 0.05, 0.05, gh, x, y, z, 8); bar(M.white, 0.03, [x, y + gh, z], [x, y, bz], 6); }
			bar(M.white, 0.05, [-gw / 2, y + gh, z], [gw / 2, y + gh, z], 8);
			put(M.float, new THREE.BoxGeometry(gw + 0.4, 0.18, 0.3).translate(0, y, z));
			put(M.netw, new THREE.PlaneGeometry(gw, Math.hypot(gh, 0.8), 8, 4).rotateX(s > 0 ? -Math.atan2(0.8, gh) : Math.atan2(0.8, gh)).translate(0, y + gh / 2, (z + bz) / 2));
		}
		// the lane ropes' floats along each side, red at the ends, yellow, then white
		for (const sx of [-1, 1]) for (let z = -L / 2 + 0.3; z < L / 2; z += 0.6) {
			const m = Math.abs(z) > L / 2 - 2 ? M.red : Math.abs(z) > L / 2 - 5 ? M.yellow : M.white;
			put(m, new THREE.SphereGeometry(0.1, 6, 4).scale(1, 0.8, 1.4).translate(sx * (W / 2 - 0.3), G(0, z) + wl, z));
		}
		// posts at the deck's corners, and a lifeguard's chair
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (W / 2 + 2.8), z = sz * (L / 2 + 2.8); cyl(M.post, 0.14, 0.14, 1.6, x, G(x, z) + lift, z, 8); }
		const cx = W / 2 + 1.5, cy = G(cx, 0) + lift;
		for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) cyl(M.white, 0.05, 0.05, 1.8, cx + a, cy, b, 6);
		box(M.white, 1.2, 0.08, 1.2, cx, cy + 1.8, 0); box(M.white, 1.2, 0.9, 0.08, cx + 0.2, cy + 1.8, 0.55, Math.PI / 2);
	} else if (f.theme === 'sky') {
		const y0 = (x, z) => G(x, z) + lift;
		// struts under the platform
		for (let x = -W / 2; x <= W / 2; x += W / 3) for (let z = -L / 2; z <= L / 2; z += L / 4) { cyl(M.dark, 0.18, 0.25, lift + 0.2, x, G(x, z) - 0.2, z, 8); }
		// goals: a metal frame round a field of light
		for (const s of ends) {
			const z = s * L / 2, y = y0(0, z);
			for (const x of [-gw / 2, gw / 2]) { box(M.metal, 0.25, gh, 0.25, x, y, z); walls.push([x, z, x, z, 0.2, y + gh]); }
			box(M.metal, gw + 0.25, 0.25, 0.25, 0, y + gh, z);
			box(M.cyan, gw, 0.06, 0.06, 0, y + gh - 0.08, z - s * 0.14);
			quad(M.field, [-gw / 2, y, z], [gw / 2, y, z], [gw / 2, y + gh, z], [-gw / 2, y + gh, z]);
		}
		// guide lights round the edge; masts with beacons at the corners
		for (let i = 0; i < 40; i++) {
			const t = i / 40, per = 2 * (W + L), d = t * per, x = d < W ? -W / 2 + d : d < W + L ? W / 2 : d < 2 * W + L ? W / 2 - (d - W - L) : -W / 2;
			const z = d < W ? -L / 2 - 1.2 : d < W + L ? -L / 2 + (d - W) : d < 2 * W + L ? L / 2 + 1.2 : L / 2 - (d - 2 * W - L);
			const xx = d >= W && d < W + L ? x + 1.2 : d >= 2 * W + L ? x - 1.2 : x;
			box(M.cyan, 0.18, 0.06, 0.18, xx, y0(xx, z), z);
		}
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
			const x = sx * (W / 2 + 1), z = sz * (L / 2 + 1), y = y0(x, z);
			cyl(M.metal, 0.08, 0.1, 5, x, y, z, 8);
			const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.cyan); b.position.set(x, y + 5.1, z); group.add(b);
			const h = glowSprite('#40d8ff', 1.6, extra); h.position.set(x, y + 5.1, z); group.add(h); movers.push({ o: h, k: 'blink', ph: sx + sz * 2 });
			walls.push([x, z, x, z, 0.15, y + 5]);
		}
	} else {
		// the tourney ground. The butts: straw bosses on stands, their faces painted in rings
		const fz = gz + T.inset, y = G(0, fz), face = butTex();
		extra.push(face);
		const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.9 });
		for (const x of [-3.4, 0, 3.4]) {
			const bh = gh + 0.1;
			put(M.straw, new THREE.CylinderGeometry(0.9, 0.9, 0.5, 20).rotateX(Math.PI / 2).translate(x, y + bh, fz - 0.25));
			const fm = new THREE.Mesh(new THREE.CircleGeometry(0.82, 32), faceMat); fm.position.set(x, y + bh, fz + 0.01); group.add(fm);
			for (const sx of [-0.55, 0.55]) bar(M.pole, 0.05, [x + sx, y, fz + 0.35], [x + sx * 0.5, y + bh + 0.6, fz - 0.3], 6);
			bar(M.pole, 0.05, [x, y, fz - 1], [x, y + bh + 0.3, fz - 0.45], 6);
			walls.push([x - 0.9, fz - 0.3, x + 0.9, fz - 0.3, 0.35, y + bh + 0.9]);
		}
		// the tilt: the fence down the lists that the riders charge along
		const t0 = -L / 2 + 20, t1 = L / 2 - 6;
		for (let z = t0; z <= t1; z += 3) { cyl(M.pole, 0.08, 0.08, 1.5, 0, G(0, z), z, 6); }
		for (const h of [0.7, 1.35]) for (let z = t0; z < t1; z += 3) bar(M.wood, 0.06, [0, G(0, z) + h, z], [0, G(0, z + 3) + h, z + 3], 6);
		walls.push([0, t0, 0, t1, 0.1, G(0, 0) + 1.5]);
		// pavilions down one side, striped, their pennants on top
		const cols = [M.canvasA, M.canvasC, M.canvasA];
		for (let i = 0; i < 3; i++) {
			const x = W / 2 + 3.5, z = -10 + i * 14, yy = G(x, z), m = cols[i];
			const segs = 12;
			const body = new THREE.CylinderGeometry(2.4, 2.4, 2.6, segs, 1, true).translate(x, yy + 1.3, z);
			put(i % 2 ? M.canvasB : m, body);
			put(m, new THREE.ConeGeometry(2.7, 2, segs).translate(x, yy + 3.6, z));
			cyl(M.pole, 0.05, 0.05, 1.6, x, yy + 4.4, z, 6);
			put(M.gold, new THREE.PlaneGeometry(0.9, 0.4).translate(x + 0.45, yy + 5.7, z));
			walls.push([x, z, x, z, 2.4, yy + 3]);
		}
		// the stand for the court, under a canopy, down the other side
		const sx = -W / 2 - 3.5;
		for (let r = 0; r < 4; r++) box(M.wood, 2, 0.12, 20, sx - r * 0.7, G(sx, 0) + 0.4 + r * 0.45, 0);
		for (const z of [-10, 0, 10]) for (const dx of [0, -2.8]) cyl(M.pole, 0.07, 0.07, 4.4, sx + dx, G(sx, z), z, 6);
		put(M.canvasA, new THREE.PlaneGeometry(3.6, 21).rotateX(-Math.PI / 2).rotateZ(-0.18).translate(sx - 1.4, G(sx, 0) + 4.3, 0));
		walls.push([sx - 1.2, -10, sx - 1.2, 10, 1.6, G(sx, 0) + 2.2]);
		// banners on poles along the shooting line
		for (const x of [-W / 2 + 2, W / 2 - 2]) { const z = arenaSpot(f)[1], yy = G(x, z); cyl(M.pole, 0.06, 0.06, 5, x, yy, z, 6); put(x < 0 ? M.canvasC : M.canvasA, new THREE.PlaneGeometry(0.7, 1.8).translate(x, yy + 3.8, z)); }
	}

	// the parts, one mesh a material
	for (const [m, list] of parts) {
		const mesh = new THREE.Mesh(mergeGeometries(list), m);
		const glowy = m.blending === THREE.AdditiveBlending || m.wireframe || m.transparent;
		mesh.castShadow = shadows && !glowy;
		mesh.receiveShadow = !glowy;
		group.add(mesh);
	}
	const tex = [P.map, P.glow, ...extra].filter(Boolean);

	// what moves: the lava breathing, bubbles swelling, crystals bobbing, the pool rippling
	let t = hh(f.x || 0, f.z || 0) * 100;
	const tick = (dt) => {
		t += dt;
		if (f.theme === 'magma') groundMat.emissiveIntensity = 1.4 + 0.35 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 3.7);
		if (f.theme === 'mystic') groundMat.emissiveIntensity = 1 + 0.3 * Math.sin(t * 0.8);
		for (const o of movers) {
			if (o.k === 'flicker') o.o.scale.setScalar(o.s * (1 + 0.12 * Math.sin(t * 9 + o.ph) + 0.08 * Math.sin(t * 23 + o.ph)));
			else if (o.k === 'bubble') { const u = ((t * o.sp + o.ph) % 1); o.o.scale.setScalar(u < 0.9 ? 0.2 + u : 0.01); }
			else if (o.k === 'bob') { o.o.position.y = o.y + Math.sin(t * 0.9 + o.ph) * 0.35; o.o.rotation.y = t * 0.4 + o.ph; }
			else if (o.k === 'spin') o.o.rotation.z = t * 0.3 * o.ph;
			else if (o.k === 'ripple') { o.t.offset.set(t * 0.013, t * 0.021); }
			else if (o.k === 'blink') o.o.visible = Math.sin(t * 2.2 + o.ph) > -0.2;
		}
	};
	return { group, walls, tex, tick, mats: Object.values(M) };
}

// a glow that always faces you (its texture kept in `list` to be freed with the arena)
function glowSprite(col, s, list) {
	const c = document.createElement('canvas'); c.width = c.height = 64;
	const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
	const t = new THREE.CanvasTexture(c);
	list.push(t);
	const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: new THREE.Color(col), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
	sp.scale.setScalar(s);
	return sp;
}
// a straw butt's face: the five colours, two rings each
function butTex() {
	const c = document.createElement('canvas'); c.width = c.height = 256;
	const g = c.getContext('2d');
	g.fillStyle = '#d8b860'; g.fillRect(0, 0, 256, 256);
	const cols = ['#f4f0e4', '#f4f0e4', '#1c1c1c', '#1c1c1c', '#2a6ad0', '#2a6ad0', '#d02828', '#d02828', '#f0c828', '#f0c828'];
	for (let i = 0; i < 10; i++) { g.fillStyle = cols[i]; g.beginPath(); g.arc(128, 128, 122 * (1 - i / 10), 0, Math.PI * 2); g.fill(); g.strokeStyle = i === 2 || i === 3 ? '#888' : '#222'; g.lineWidth = 1; g.stroke(); }
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
// the pool's ripples: soft light bands, tiled
function waterTex() {
	const c = document.createElement('canvas'); c.width = c.height = 128;
	const g = c.getContext('2d');
	g.fillStyle = '#b8f0f0'; g.fillRect(0, 0, 128, 128);
	g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
	for (let i = 0; i < 26; i++) { const x = hh(i, 1) * 128, y = hh(i, 2) * 128, r = 6 + hh(i, 3) * 16; g.beginPath(); g.ellipse(x, y, r, r * 0.5, hh(i, 4) * 3, 0, Math.PI * 1.3); g.stroke(); }
	const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 6); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

// ---------- the volcano's gifts: bombs landed on a magma arena, fresh balls to play with ----------
// A ball lies where it fell, glowing, crusting over in a couple of minutes. The list lives on
// the field (f.hot), so a game started there knows how many are still hot.
export const HOT_LIFE = 150;
export function hotBalls(f, now) { return (f.hot || []).filter((b) => now - b.born < HOT_LIFE); }
// a lava bomb's shape: a lumpy clot, crust over the glow (not a ball: a ball is round)
export function bombGeometry(r = 1, seed = 1) {
	const geo = new THREE.IcosahedronGeometry(r, 1);
	const p = geo.attributes.position, col = [];
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.78 + 0.34 * hh(Math.round(x * 50) + seed, Math.round(y * 50) + Math.round(z * 30));
		p.setXYZ(i, x * k, y * k * 0.9, z * k);
		const c = k > 0.95 ? 1 : 0.3;
		col.push(c, c * 0.9, c * 0.85);
	}
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	geo.computeVertexNormals();
	return geo;
}
// the fresh balls on a built arena, drawn and cooled
export function hotBallLayer(f) {
	const g = new THREE.Group(), mats = [];
	let shown = -1;
	const skin = moltenTex();
	const make = () => {
		const m = new THREE.MeshStandardMaterial({ map: skin.map, emissiveMap: skin.glow, emissive: new THREE.Color('#ff7a20'), emissiveIntensity: 2, roughness: 0.6 });
		mats.push(m);
		return m;
	};
	return {
		group: g,
		tex: [skin.map, skin.glow],
		mats,
		update(now, H) {
			const list = hotBalls(f, now);
			if (list.length !== shown) {
				while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); }
				for (const b of list) {
					const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), mats[g.children.length] || make());
					m.position.set(b.lx, H(b.lx, b.lz) + 0.34, b.lz); m.userData.b = b;
					g.add(m);
				}
				shown = list.length;
			}
			for (const m of g.children) { const k = Math.max(0, 1 - (now - m.userData.b.born) / HOT_LIFE); m.material.emissiveIntensity = 0.2 + 2.4 * k * k; }
		},
	};
}
// a molten ball's skin: dark crust plates, the glow between them (a map and a glow map)
export function moltenTex() {
	const mk = (glow) => {
		const c = document.createElement('canvas'); c.width = 256; c.height = 128;
		const g = c.getContext('2d');
		g.fillStyle = glow ? '#ffb040' : '#3a1a0e'; g.fillRect(0, 0, 256, 128);
		g.fillStyle = glow ? '#000' : '#1a0e0a';
		for (let i = 0; i < 40; i++) { const x = hh(i, 1) * 256, y = hh(i, 2) * 128, r = 10 + hh(i, 3) * 16; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, rr = r * (0.7 + 0.3 * hh(i, k)); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9); } g.fill(); }
		const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
		return t;
	};
	return { map: mk(false), glow: mk(true) };
}
