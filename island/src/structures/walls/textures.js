// What the inside of a wall looks like, painted once on canvases: the section atlas (sixteen
// tiles: the gypsum core of drywall and its brown paper back, fir studs along the grain and
// across it, OSB's flakes and plywood's veneer, the batt's fibres and its kraft facing, tar
// paper, stucco's grey base coats, brick faces in running bond and broken brick, concrete with
// its aggregate, plaster, rusty bar and plain white for anything tinted), the stucco's wire lath
// (an open mesh, cut out by its alpha), and the marks a fight leaves on a wall's face (knuckle
// dents, cracks, a round's small clean hole going in and the torn blow-out where it came out,
// chipped stucco, brick and concrete, dust).

import * as THREE from 'three';

export const TILE = Object.freeze({ gypsum: 0, back: 1, wood: 2, end: 3, osb: 4, ply: 5, fibre: 6, kraft: 7, tar: 8, stucco: 9, brick: 10, brickIn: 11, concrete: 12, plaster: 13, rust: 14, flat: 15 });
// how many metres one repeat of a tile covers
export const TILE_M = [0.22, 0.5, 0.6, 0.05, 0.6, 0.6, 0.3, 0.5, 0.5, 0.3, 0.45, 0.3, 0.5, 0.3, 0.25, 1];
export const BRICK_TILE = [0.45, 0.3];          // two bricks by four courses, running bond

function prng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

function canvas(w, h) {
	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	return c;
}

// the section atlas: 4 x 4 tiles of 256
export function sectionAtlas() {
	const S = 256, cv = canvas(S * 4, S * 4), g = cv.getContext('2d');
	const at = (t) => [(t % 4) * S, Math.floor(t / 4) * S];
	const speck = (x0, y0, n, base, spread, size, alpha, r) => { for (let i = 0; i < n; i++) { const l = base + (r() - 0.5) * spread; g.fillStyle = rgb(l, l, l, alpha); g.fillRect(x0 + r() * S, y0 + r() * S, size * (0.5 + r()), size * (0.5 + r())); } };
	const tile = (t, draw) => { const [x, y] = at(t); g.save(); g.beginPath(); g.rect(x, y, S, S); g.clip(); g.translate(x, y); draw(prng(t * 977 + 13)); g.restore(); };
	// gypsum core: chalky off-white with grit and pores
	tile(TILE.gypsum, (r) => {
		g.fillStyle = rgb(232, 229, 220); g.fillRect(0, 0, S, S);
		speck(0, 0, 5000, 215, 60, 1.6, 0.5, r);
		for (let i = 0; i < 260; i++) { g.fillStyle = rgb(170, 165, 155, 0.5); g.beginPath(); g.arc(r() * S, r() * S, 0.6 + r() * 1.6, 0, 6.3); g.fill(); }
	});
	// drywall's paper back, grey-brown, with the faint print lines
	tile(TILE.back, (r) => {
		g.fillStyle = rgb(176, 162, 138); g.fillRect(0, 0, S, S);
		speck(0, 0, 3000, 160, 40, 1.2, 0.35, r);
		g.strokeStyle = rgb(120, 108, 90, 0.25); g.lineWidth = 1;
		for (let y = 12; y < S; y += 24 + r() * 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (r() - 0.5) * 3); g.stroke(); }
	});
	// fir along the grain: light, streaky, a knot now and then
	tile(TILE.wood, (r) => {
		g.fillStyle = rgb(206, 170, 118); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 70; i++) { const x = r() * S, w = 0.6 + r() * 2.2; g.strokeStyle = rgb(150 + r() * 40, 108 + r() * 30, 60 + r() * 20, 0.35 + r() * 0.3); g.lineWidth = w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 18, S * 0.33, x + (r() - 0.5) * 18, S * 0.66, x + (r() - 0.5) * 8, S); g.stroke(); }
		for (let i = 0; i < 2; i++) { const x = r() * S, y = r() * S; for (let k = 8; k > 0; k--) { g.strokeStyle = rgb(110, 70, 36, 0.25); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, k * 2.2, k * 4.5, 0, 0, 6.3); g.stroke(); } }
	});
	// end grain: rings, the torn fibres of a break
	tile(TILE.end, (r) => {
		g.fillStyle = rgb(196, 156, 104); g.fillRect(0, 0, S, S);
		const cx = S * (0.2 + r() * 0.6), cy = -S * 0.6;
		for (let k = 4; k < S * 1.8; k += 5 + r() * 6) { g.strokeStyle = rgb(140, 96, 52, 0.45); g.lineWidth = 1.5 + r() * 2; g.beginPath(); g.arc(cx, cy, k, 0, 6.3); g.stroke(); }
		for (let i = 0; i < 400; i++) { g.fillStyle = rgb(230, 200, 150, 0.5); g.fillRect(r() * S, r() * S, 1, 3 + r() * 6); }
	});
	// OSB: big flat strands pressed every way
	tile(TILE.osb, (r) => {
		g.fillStyle = rgb(190, 152, 96); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 260; i++) { g.save(); g.translate(r() * S, r() * S); g.rotate(r() * 6.3); const l = 150 + r() * 70; g.fillStyle = rgb(l + 30, l, l * 0.6, 0.85); g.fillRect(-14 - r() * 18, -3 - r() * 4, 28 + r() * 36, 6 + r() * 8); g.restore(); }
		speck(0, 0, 1500, 110, 40, 1.5, 0.4, r);
	});
	// plywood and sheathing boards: a peeled veneer's long figure
	tile(TILE.ply, (r) => {
		g.fillStyle = rgb(198, 160, 110); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 40; i++) { const y = r() * S; g.strokeStyle = rgb(150, 110, 66, 0.3 + r() * 0.3); g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 30, S * 0.6, y + (r() - 0.5) * 30, S, y + (r() - 0.5) * 10); g.stroke(); }
	});
	// glass fibre: a tangle of fine strands, light (tinted pink, yellow or grey by the batt)
	tile(TILE.fibre, (r) => {
		g.fillStyle = rgb(225, 225, 225); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 1400; i++) {
			const x = r() * S, y = r() * S, a = r() * 6.3, l = 6 + r() * 26, l2 = 150 + r() * 105;
			g.strokeStyle = rgb(l2, l2, l2, 0.25 + r() * 0.35); g.lineWidth = 0.5 + r() * 0.9;
			g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
		}
		for (let i = 0; i < 90; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 10); gr.addColorStop(0, 'rgba(120,120,120,0.25)'); gr.addColorStop(1, 'rgba(120,120,120,0)'); g.save(); g.translate(r() * S, r() * S); g.fillStyle = gr; g.fillRect(-10, -10, 20, 20); g.restore(); }
	});
	// kraft facing: brown paper with the maker's print
	tile(TILE.kraft, (r) => {
		g.fillStyle = rgb(170, 128, 80); g.fillRect(0, 0, S, S);
		speck(0, 0, 2500, 140, 40, 1.4, 0.3, r);
		g.fillStyle = rgb(60, 40, 30, 0.35); g.font = 'bold 18px sans-serif';
		for (let y = 30; y < S; y += 64) g.fillText('R-13  FACED  INSULATION', 6, y);
	});
	// tar paper: black felt, a little sheen in streaks
	tile(TILE.tar, (r) => {
		g.fillStyle = rgb(52, 50, 47); g.fillRect(0, 0, S, S);
		speck(0, 0, 3000, 70, 40, 1.3, 0.5, r);
		for (let i = 0; i < 20; i++) { g.strokeStyle = rgb(70, 70, 70, 0.2); g.lineWidth = 3 + r() * 6; g.beginPath(); const y = r() * S; g.moveTo(0, y); g.lineTo(S, y + (r() - 0.5) * 20); g.stroke(); }
	});
	// stucco's base coats: grey sand and cement, coarse
	tile(TILE.stucco, (r) => {
		g.fillStyle = rgb(158, 154, 146); g.fillRect(0, 0, S, S);
		speck(0, 0, 9000, 150, 90, 1.8, 0.55, r);
		for (let i = 0; i < 160; i++) { const l = 100 + r() * 90; g.fillStyle = rgb(l, l * 0.97, l * 0.92, 0.8); g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 2.5, 0, 6.3); g.fill(); }
	});
	// brick faces in running bond: two bricks by four courses, mortar between
	tile(TILE.brick, (r) => {
		g.fillStyle = rgb(188, 180, 166); g.fillRect(0, 0, S, S);
		const bw = S / 2, ch = S / 4, m = S * 0.01 / 0.3 * 1.0;
		for (let row = 0; row < 4; row++) for (let i = -1; i < 3; i++) {
			const x = i * bw + (row % 2 ? bw / 2 : 0), y = row * ch, k = 0.8 + r() * 0.35;
			g.fillStyle = rgb(150 * k, 66 * k, 46 * k); g.fillRect(x + m, y + m, bw - 2 * m, ch - 2 * m);
			for (let s = 0; s < 120; s++) { const l = r(); g.fillStyle = rgb(110 + l * 70, 50 + l * 30, 36 + l * 20, 0.4); g.fillRect(x + m + r() * (bw - 2 * m), y + m + r() * (ch - 2 * m), 1.5, 1.5); }
		}
	});
	// broken brick: the fired body, rough, mortar crumbs
	tile(TILE.brickIn, (r) => {
		g.fillStyle = rgb(160, 74, 52); g.fillRect(0, 0, S, S);
		speck(0, 0, 6000, 120, 80, 2, 0.35, r);
		for (let i = 0; i < 120; i++) { g.fillStyle = rgb(190, 182, 168, 0.7); g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 3, 0, 6.3); g.fill(); }
	});
	// concrete: grey paste and its stones
	tile(TILE.concrete, (r) => {
		g.fillStyle = rgb(150, 148, 142); g.fillRect(0, 0, S, S);
		speck(0, 0, 5000, 145, 50, 1.5, 0.5, r);
		for (let i = 0; i < 220; i++) { const l = 90 + r() * 110; g.fillStyle = rgb(l, l * 0.96, l * 0.9, 0.95); g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 7, 2 + r() * 5, r() * 3, 0, 6.3); g.fill(); }
	});
	// plaster: lime white, grey under it, a hair crack or two
	tile(TILE.plaster, (r) => {
		g.fillStyle = rgb(222, 218, 206); g.fillRect(0, 0, S, S);
		speck(0, 0, 4000, 205, 50, 1.4, 0.45, r);
		g.strokeStyle = rgb(150, 145, 135, 0.35);
		for (let i = 0; i < 6; i++) { g.lineWidth = 0.8; g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
	});
	// rusty bar: dark steel with orange rust and the ribs across
	tile(TILE.rust, (r) => {
		g.fillStyle = rgb(80, 52, 38); g.fillRect(0, 0, S, S);
		for (let i = 0; i < 1800; i++) { g.fillStyle = rgb(140 + r() * 60, 70 + r() * 30, 30, 0.35); g.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3); }
		g.fillStyle = rgb(40, 30, 24, 0.5); for (let x = 0; x < S; x += 20) g.fillRect(x, 0, 5, S);
	});
	tile(TILE.flat, () => { g.fillStyle = rgb(236, 236, 236); g.fillRect(0, 0, S, S); });
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace;
	// (no mipmaps: each tile repeats inside its own square, and a mip would bleed across them)
	t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
	return t;
}

// the stucco's wire: an expanded metal mesh, transparent between its strands
export function lathTexture() {
	const S = 128, cv = canvas(S, S), g = cv.getContext('2d');
	g.clearRect(0, 0, S, S);
	g.strokeStyle = 'rgba(70,72,74,1)'; g.lineWidth = 3;
	const w = S / 4, h = S / 6;
	for (let j = -1; j < 7; j++) for (let i = -1; i < 5; i++) {
		const x = i * w + (j % 2 ? w / 2 : 0), y = j * h;
		g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + h / 2); g.lineTo(x + w / 2, y + h); g.closePath(); g.stroke();
	}
	const t = new THREE.CanvasTexture(cv);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = 4;
	return t;
}

// the marks on a wall's face: 4 x 4 cells of 128
export const MARK = Object.freeze({ dent: 0, crack: 1, entry: 2, blowout: 3, pock: 4, star: 5, brickChip: 6, spall: 7, concreteStar: 8, dust: 9, split: 10, scorch: 11, plasterCrack: 12, sidingHole: 13, knuckles: 14, smear: 15 });
export function marksAtlas() {
	const S = 128, cv = canvas(S * 4, S * 4), g = cv.getContext('2d');
	const r = prng(41);
	const cell = (k, draw) => { const x = (k % 4) * S, y = Math.floor(k / 4) * S; g.save(); g.beginPath(); g.rect(x, y, S, S); g.clip(); g.translate(x + S / 2, y + S / 2); draw(); g.restore(); };
	const blob = (cx, cy, rad, n, jag) => { g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * 6.283, k = rad * (1 - jag + r() * jag * 2); if (i) g.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k); else g.moveTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k); } g.closePath(); g.fill(); };
	const cracks = (n, r0, r1, col, wid) => {
		g.strokeStyle = col; g.lineCap = 'round';
		for (let i = 0; i < n; i++) {
			let a = r() * 6.283, x = Math.cos(a) * r0, y = Math.sin(a) * r0;
			const len = r0 + (r1 - r0) * (0.5 + r() * 0.5);
			g.lineWidth = wid; g.beginPath(); g.moveTo(x, y);
			for (let d = r0; d < len; d += 5) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 5; y += Math.sin(a) * 5; g.lineTo(x, y); if (r() < 0.12) { g.stroke(); g.lineWidth = wid * 0.6; g.beginPath(); g.moveTo(x, y); } }
			g.stroke();
		}
	};
	// knuckle dents: a shallow crushed patch, shaded, paper wrinkled round it
	cell(MARK.dent, () => {
		const gr = g.createRadialGradient(-6, -6, 2, 0, 0, 34); gr.addColorStop(0, 'rgba(90,86,80,0.55)'); gr.addColorStop(0.6, 'rgba(140,136,128,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr; blob(0, 0, 34, 18, 0.25);
		g.fillStyle = 'rgba(255,255,255,0.35)'; blob(8, 8, 14, 10, 0.4);
		cracks(5, 10, 34, 'rgba(70,66,60,0.55)', 1.2);
	});
	// cracked board: the face crushed in where the fist landed (shaded, a lit lip), the paper
	// split in short hair cracks out from it, flakes of it lifted
	cell(MARK.crack, () => {
		const gr = g.createRadialGradient(-5, -5, 2, 0, 0, 30); gr.addColorStop(0, 'rgba(95,90,82,0.6)'); gr.addColorStop(0.7, 'rgba(150,145,136,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = gr; blob(0, 0, 30, 20, 0.3);
		g.fillStyle = 'rgba(255,255,255,0.3)'; blob(9, 9, 12, 12, 0.4);
		cracks(14, 10, 44, 'rgba(80,75,68,0.55)', 0.8);
		g.fillStyle = 'rgba(240,237,230,0.75)'; for (let i = 0; i < 10; i++) blob((r() - 0.5) * 30, (r() - 0.5) * 30, 1.5 + r() * 2.5, 6, 0.4);
	});
	// a round going in: a small clean hole, the paper pushed in round it
	cell(MARK.entry, () => {
		g.fillStyle = 'rgba(150,145,135,0.45)'; blob(0, 0, 12, 12, 0.3);
		g.fillStyle = 'rgba(14,12,11,1)'; blob(0, 0, 6, 10, 0.2);
		cracks(4, 6, 16, 'rgba(60,57,52,0.6)', 1);
	});
	// going out: the paper torn back in a ragged ring, the gypsum crushed white, a dark heart
	cell(MARK.blowout, () => {
		g.fillStyle = 'rgba(205,200,190,0.95)'; blob(0, 0, 40, 22, 0.35);
		g.fillStyle = 'rgba(232,228,218,1)'; blob(0, 0, 28, 18, 0.35);
		g.fillStyle = 'rgba(160,154,142,1)'; blob(0, 0, 15, 14, 0.4);
		g.fillStyle = 'rgba(16,14,13,1)'; blob(0, 0, 9, 12, 0.35);
		g.strokeStyle = 'rgba(120,110,95,0.8)'; g.lineWidth = 1.5;
		for (let i = 0; i < 9; i++) { const a = r() * 6.28, l = 30 + r() * 14; g.beginPath(); g.moveTo(Math.cos(a) * 26, Math.sin(a) * 26); g.lineTo(Math.cos(a + 0.15) * l, Math.sin(a + 0.15) * l); g.stroke(); }
	});
	// chipped stucco: the finish coat off, the grey base showing, a dark hole
	cell(MARK.pock, () => {
		g.fillStyle = 'rgba(150,146,138,0.95)'; blob(0, 0, 30, 20, 0.4);
		g.fillStyle = 'rgba(110,106,100,1)'; blob(0, 0, 17, 14, 0.4);
		g.fillStyle = 'rgba(18,16,15,1)'; blob(0, 0, 7, 10, 0.3);
		cracks(5, 20, 50, 'rgba(60,58,54,0.6)', 1.2);
	});
	// a star of cracks in stucco or render
	cell(MARK.star, () => { cracks(9, 4, 58, 'rgba(70,66,60,0.5)', 0.9); g.fillStyle = 'rgba(120,116,108,0.35)'; blob(0, 0, 8, 10, 0.4); });
	// a brick chipped: the fired body pale where the face came off
	cell(MARK.brickChip, () => {
		g.fillStyle = 'rgba(196,120,96,0.95)'; blob(0, 0, 28, 18, 0.45);
		g.fillStyle = 'rgba(120,60,44,1)'; blob(0, 0, 14, 12, 0.4);
		g.fillStyle = 'rgba(30,18,14,1)'; blob(0, 0, 6, 10, 0.3);
		g.fillStyle = 'rgba(170,90,70,0.6)'; for (let i = 0; i < 18; i++) blob((r() - 0.5) * 80, (r() - 0.5) * 80, 1 + r() * 3, 5, 0.4);
	});
	// concrete spalled: a shallow crater, the stones showing
	cell(MARK.spall, () => {
		g.fillStyle = 'rgba(128,126,120,0.95)'; blob(0, 0, 32, 22, 0.35);
		for (let i = 0; i < 26; i++) { const l = 80 + r() * 80; g.fillStyle = `rgba(${l},${l * 0.97},${l * 0.92},1)`; blob((r() - 0.5) * 44, (r() - 0.5) * 44, 2 + r() * 4, 6, 0.4); }
		g.fillStyle = 'rgba(30,29,27,1)'; blob(0, 0, 8, 10, 0.3);
	});
	cell(MARK.concreteStar, () => { cracks(8, 6, 60, 'rgba(56,54,50,0.6)', 1.1); });
	// dust on a face: a pale spray out from a hole
	cell(MARK.dust, () => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62); gr.addColorStop(0, 'rgba(240,238,232,0.6)'); gr.addColorStop(1, 'rgba(240,238,232,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128); for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(245,243,238,0.5)'; g.fillRect((r() - 0.5) * 110, (r() - 0.5) * 110, 1.5, 1.5); } });
	// wood split along its grain
	cell(MARK.split, () => { g.strokeStyle = 'rgba(40,24,12,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-3, -60); for (let y = -60; y < 60; y += 8) g.lineTo((r() - 0.5) * 6, y); g.stroke(); g.strokeStyle = 'rgba(240,210,160,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(3, -40); for (let y = -40; y < 40; y += 8) g.lineTo(3 + (r() - 0.5) * 4, y); g.stroke(); });
	cell(MARK.scorch, () => { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 62); gr.addColorStop(0, 'rgba(10,9,8,0.9)'); gr.addColorStop(1, 'rgba(20,18,16,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128); });
	cell(MARK.plasterCrack, () => { cracks(6, 4, 62, 'rgba(70,66,58,0.7)', 1.3); });
	cell(MARK.sidingHole, () => { g.fillStyle = 'rgba(200,170,120,0.9)'; blob(0, 0, 16, 12, 0.5); g.fillStyle = 'rgba(20,14,10,1)'; blob(0, 0, 7, 10, 0.3); g.strokeStyle = 'rgba(40,26,14,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-40, 1); g.lineTo(40, -1); g.stroke(); });
	// the knuckles' row of four small dents
	cell(MARK.knuckles, () => { for (let i = 0; i < 4; i++) { const gr = g.createRadialGradient(-24 + i * 16, 0, 1, -24 + i * 16, 0, 9); gr.addColorStop(0, 'rgba(80,76,70,0.6)'); gr.addColorStop(1, 'rgba(120,116,110,0)'); g.fillStyle = gr; blob(-24 + i * 16, (r() - 0.5) * 4, 9, 10, 0.3); } });
	cell(MARK.smear, () => { g.fillStyle = 'rgba(90,86,80,0.35)'; blob(0, 6, 40, 18, 0.4); });
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
