// What is on a shop's shelves: the packets, boxes, tins, bottles, jugs and cards a real shop is
// stocked with, painted once on a canvas sheet (nothing downloaded) as strips of shelf face, each
// strip a shelf's worth of a kind of thing seen from the aisle: the chips in their pillow bags
// two or three facings of each, the cereal boxes, the tins stacked two high, the sodas in the
// cooler, the cigarettes behind the counter, the blister cards on a pegboard, the paint cans.
// Each strip carries the shelf's price rail along its foot.
//
// A strip is one bay of shelf (1.2 m wide, 0.45 m high: the gondolas' bay and a shelf's height),
// so a shop's goods are a few quads a shelf: the front, painted, and the tops of the stock behind
// it. They are drawn unlit (their light is painted in and given per shelf), so a shop full of
// stock costs one draw and nothing of the interiors' light bake (interiors/lighting.js).
//
//   goodsSheet()               the sheet: { tex, ready }, painted a few strips a step
//   goodsSteps()               the painting, as steps (a generator), for a builder to pump
//   new GoodsBuilder()         quads into one geometry: run(), quad(), solid()
//   goodsMaterial(band)        a shop's own unlit material on the sheet (its brightness its own)

import * as THREE from 'three';
import { GFX_PHONE } from '../world/device.js';

// ---------------------------------------------------------------------------------
// the sheet: 8 strips across, 14 down, 256 x 96 each (at the full size: half on a phone), then
// the price rail on its own, the shops' hanging signs (white letters, cut out) and a plain patch
export const STRIP_W = 1.2, STRIP_H = 0.45;
const TW = 256, TH = 96, ROWS = 14, RAIL_Y = ROWS * TH, SIGN_Y = RAIL_Y + 10, SW = 256, SH = 32, W = 2048, H = 1568, PX = TW / STRIP_W, RAIL = 8;
// the kinds and how many strips of each (a strip's goods differ, so a long run never repeats
// itself side by side); cool: in a cooler, lit from behind
export const KINDS = {
	chips: 4, candy: 3, cookies: 3, cereal: 2, cans: 3, jars: 2, dry: 2, bread: 2,
	soda: 3, cancool: 3, water: 2, energy: 2, beer: 3, wine: 2, spirits: 2, dairy: 2, frozen: 2,
	laundry: 2, paper: 2, clean: 1, care: 3, meds: 3, auto: 2, pet: 2,
	paint: 2, tools: 2, peg: 3, bins: 2, books: 3, clothes: 2, tech: 2, toys: 2, smokes: 2,
	flowers: 2,
	// the cafés', restaurants' and offices': the pastries and donuts and cakes in their cases, the
	// bags of beans, the mugs, the tubs of ice cream seen from above, the glasses behind a bar, the
	// binders on an office's shelves, the menus on the wall (chalk, and lit with their pictures)
	pastry: 2, donuts: 2, cakes: 2, beans: 2, mugs: 2, tubs: 2, glasses: 2, binders: 3, menu: 7, menulit: 3,
};
export const COOL = new Set(['soda', 'cancool', 'water', 'energy', 'beer', 'dairy', 'frozen']);
const TILES = {};
{
	let i = 0;
	for (const [k, n] of Object.entries(KINDS)) { TILES[k] = []; for (let j = 0; j < n; j++) TILES[k].push(i++); }
}
// a strip's place on the sheet, in uv (v up, as three flips a canvas)
export function stripUV(kind, n = 0) {
	const list = TILES[kind] || TILES.dry, t = list[((n % list.length) + list.length) % list.length];
	const cx = t % 8, cy = Math.floor(t / 8);
	return [cx * TW / W, 1 - (cy + 1) * TH / H, (cx + 1) * TW / W, 1 - cy * TH / H];
}
// a plain white patch (the vertex colour is the colour) and the price rail
const WHITE_UV = [(W - 6) / W, 2 / H, (W - 2) / W, 6 / H];
const RAIL_UV = [0, 1 - (RAIL_Y + RAIL) / H, TW / W, 1 - RAIL_Y / H];
export const SIGNS = ['COLD DRINKS', 'BEER & WINE', 'DAIRY', 'FROZEN FOODS', 'ICE CREAM', 'COFFEE', 'HOT FOOD', 'SNACKS', 'GROCERY', 'PHARMACY', 'HEALTH & BEAUTY', 'HOUSEHOLD', 'PAINT', 'TOOLS', 'HARDWARE', 'PLUMBING', 'ELECTRICAL', 'GARDEN', 'PET SUPPLIES', 'BOOKS', 'NEW ARRIVALS', 'SALE', 'CHECKOUT', 'RESTROOMS', 'EMPLOYEES ONLY', 'WINE', 'SPIRITS', 'PRODUCE', 'BAKERY', 'FRESH FLOWERS', 'PHONES & TECH', 'LOTTERY',
	'MENU', 'ORDER HERE', 'PICK UP', 'KITCHEN', 'BAR', 'ESPRESSO', 'PASTRIES', 'DONUTS', 'PIZZA', 'BURGERS', 'TACOS', 'SUSHI', 'RAMEN', 'RECEPTION', 'SPECIALS', 'GELATO'];
// a sign's letters on the sheet (cut out: the material keeps only what is painted)
export function signUV(name) {
	const i = Math.max(0, SIGNS.indexOf(name)), cx = i % 8, cy = Math.floor(i / 8), y = SIGN_Y + cy * SH;
	return [cx * SW / W, 1 - (y + SH) / H, (cx + 1) * SW / W, 1 - y / H];
}

// ---------------------------------------------------------------------------------
// the painting
const prng = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
// the makers' names on the packets (made up, none a real brand)
const BRANDS = ['Krunchos', 'Zestara', 'Fizzlo', 'Crispeta', 'Tropiq', 'Polaro', 'Munchly', 'Zingo', 'Puffly', 'Nuvo', 'Brisko', 'Glimmo', 'Sunvale', 'Ridgemark', 'Tidewell', 'Bayline', 'Marigo', 'Velvo', 'Quenchy', 'Rivo', 'Kalo', 'Orbo', 'Pemba', 'Lupo', 'Fenna', 'Torvo', 'Dazzo', 'Calio', 'Mavo', 'Zeffy', 'Vigo', 'Snapper', 'Hearty', 'Goldleaf', 'Pinecrest', 'Oakmill', 'Redwood', 'Clearbrook', 'Summit', 'Coastal', 'Mesa', 'Sierra', 'Larkin', 'Whistle', 'Bolt', 'Rally', 'Sprig', 'Nimbus', 'Hollis', 'Juniper', 'Copper', 'Maple', 'Pebble', 'Lantern', 'Comet', 'Breeze', 'Ember', 'Harbor', 'Meadow', 'Valley', 'Willow', 'Thistle', 'Crest', 'Arrow'];
function brand(r) { return BRANDS[Math.floor(r() * BRANDS.length)]; }
const pick = (r, l) => l[Math.floor(r() * l.length)];
// the colours packets come in (bold, as they are to catch an eye across a shop)
const LOUD = ['#d62828', '#f77f00', '#fcbf49', '#ffd60a', '#2a9d8f', '#1d6fd1', '#3a0ca3', '#7b2cbf', '#06a77d', '#e63946', '#118ab2', '#073b4c', '#ef476f', '#8ac926', '#ff595e', '#1982c4', '#6a4c93', '#111111', '#f4f1de', '#c1121f'];
const SOFT = ['#f1faee', '#a8dadc', '#e9c46a', '#f4a261', '#90be6d', '#cdb4db', '#ffc8dd', '#bde0fe', '#ffffff', '#fefae0', '#e0e1dd'];
const GLASS = ['#24452c', '#3d2b1f', '#5b1a18', '#d8e4e8', '#2e3c2a', '#6b4d2a'];
function shade(c, k) {
	const n = parseInt(c.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
	const f = (v) => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1))));
	return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rr(g, x, y, w, h, r) {
	r = Math.min(r, w / 2, h / 2);
	g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
	g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
	g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
// a round thing's light: dark at its edges, a gleam a third of the way in
function roundShade(g, x, w, y, h, a = 0.45) {
	const L = g.createLinearGradient(x, 0, x + w, 0);
	L.addColorStop(0, `rgba(0,0,0,${a})`); L.addColorStop(0.28, 'rgba(255,255,255,0.18)'); L.addColorStop(0.42, 'rgba(255,255,255,0)'); L.addColorStop(0.8, 'rgba(0,0,0,0.12)'); L.addColorStop(1, `rgba(0,0,0,${a})`);
	g.fillStyle = L; g.fillRect(x, y, w, h);
}
function flatShade(g, x, w, y, h) {
	const L = g.createLinearGradient(x, 0, x + w, 0);
	L.addColorStop(0, 'rgba(255,255,255,0.10)'); L.addColorStop(0.85, 'rgba(0,0,0,0)'); L.addColorStop(1, 'rgba(0,0,0,0.28)');
	g.fillStyle = L; g.fillRect(x, y, w, h);
	const T = g.createLinearGradient(0, y, 0, y + h);
	T.addColorStop(0, 'rgba(255,255,255,0.14)'); T.addColorStop(0.15, 'rgba(255,255,255,0)'); T.addColorStop(1, 'rgba(0,0,0,0.12)');
	g.fillStyle = T; g.fillRect(x, y, w, h);
}
function word(g, s, x, y, w, size, col, bold = true) {
	g.fillStyle = col; g.font = `${bold ? '800 ' : '600 '}${size}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
	const m = g.measureText(s).width;
	if (m > w) { g.save(); g.translate(x, y); g.scale(w / m, 1); g.fillText(s, 0, 0); g.restore(); } else g.fillText(s, x, y);
}

// one product, standing on base at x, w wide and h tall; S its look
const PAINT = {
	// a pastry on its tray: a croissant, a muffin in its paper, a scone, a cinnamon roll
	pastry(g, x, b, w, h, S, r) {
		const k = Math.floor(r() * 4), cx = x + w / 2, gold = shade('#c98a3c', 0.85 + r() * 0.3);
		g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, b - 1, w * 0.45, 2, 0, 0, Math.PI * 2); g.fill();
		if (k === 0) {
			g.fillStyle = gold; g.beginPath(); g.ellipse(cx, b - h * 0.32, w * 0.48, h * 0.32, 0, Math.PI, 0); g.fill();
			g.strokeStyle = shade('#7a4a1c', 1); g.lineWidth = 1;
			for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + w * i / 5, b - 1); g.lineTo(x + w * (i / 5 + 0.04), b - h * 0.6); g.stroke(); }
		} else if (k === 1) {
			g.fillStyle = S.c; g.beginPath(); g.moveTo(x + w * 0.15, b - h * 0.45); g.lineTo(x + w * 0.85, b - h * 0.45); g.lineTo(x + w * 0.75, b); g.lineTo(x + w * 0.25, b); g.fill();
			g.fillStyle = shade(S.f, 0.9); g.beginPath(); g.ellipse(cx, b - h * 0.48, w * 0.42, h * 0.3, 0, Math.PI, 0); g.fill();
			g.fillStyle = '#3b2412'; for (let i = 0; i < 5; i++) g.fillRect(x + w * (0.25 + 0.5 * r()), b - h * (0.5 + 0.2 * r()), 2, 2);
		} else if (k === 2) {
			g.fillStyle = shade('#d9b27c', 0.9 + r() * 0.2); g.beginPath(); g.moveTo(x + w * 0.1, b); g.lineTo(cx, b - h * 0.7); g.lineTo(x + w * 0.9, b); g.fill();
			g.fillStyle = '#7a2e1f'; for (let i = 0; i < 4; i++) g.fillRect(x + w * (0.3 + 0.4 * r()), b - h * (0.15 + 0.3 * r()), 2, 2);
		} else {
			g.fillStyle = gold; g.beginPath(); g.ellipse(cx, b - h * 0.3, w * 0.45, h * 0.3, 0, 0, Math.PI * 2); g.fill();
			g.strokeStyle = '#6b3d16'; g.lineWidth = 1.3; g.beginPath();
			for (let t = 0; t < 12; t += 0.3) g.lineTo(cx + Math.cos(t) * t * w * 0.035, b - h * 0.3 + Math.sin(t) * t * h * 0.022);
			g.stroke();
			g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + w * 0.3, b - h * 0.55, w * 0.4, 1.5);
		}
	},
	// a ring donut, a little from above: the dough, its glaze, the hole, the sprinkles
	donut(g, x, b, w, h, S, r) {
		const cx = x + w / 2, cy = b - h * 0.45, rx = w * 0.46, ry = h * 0.42;
		g.fillStyle = '#c98b4a'; g.beginPath(); g.ellipse(cx, cy + ry * 0.2, rx, ry, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = S.f; g.beginPath(); g.ellipse(cx, cy, rx * 0.92, ry * 0.85, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#4a3020'; g.beginPath(); g.ellipse(cx, cy, rx * 0.28, ry * 0.25, 0, 0, Math.PI * 2); g.fill();
		if (r() < 0.6) for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = 0.45 + r() * 0.4; g.fillStyle = pick(r, ['#ffffff', '#ffd60a', '#ef476f', '#118ab2', '#8ac926']); g.fillRect(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 2.2, 1.2); }
		g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.25, ry * 0.12, -0.3, 0, Math.PI * 2); g.fill();
	},
	// a cake on its stand: the layers and their frosting, or a slice on its plate
	cake(g, x, b, w, h, S, r) {
		const cx = x + w / 2;
		g.fillStyle = '#e8e8e8'; g.fillRect(x + w * 0.05, b - 3, w * 0.9, 3);
		if (r() < 0.6) {
			const top = b - 3 - h * 0.75;
			g.fillStyle = shade(S.c, 1.1); g.fillRect(x + w * 0.12, top, w * 0.76, h * 0.75);
			g.fillStyle = S.f; for (let i = 1; i < 3; i++) g.fillRect(x + w * 0.12, top + h * 0.25 * i, w * 0.76, 2);
			g.fillStyle = shade(S.f, 1.2); g.beginPath(); g.ellipse(cx, top, w * 0.38, h * 0.09, 0, 0, Math.PI * 2); g.fill();
			g.fillStyle = '#c1121f'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + w * (0.25 + 0.17 * i), top - 1, 2, 0, Math.PI * 2); g.fill(); }
			flatShade(g, x + w * 0.12, w * 0.76, top, h * 0.75);
		} else {
			g.fillStyle = shade(S.c, 1.1); g.beginPath(); g.moveTo(x + w * 0.15, b - 3); g.lineTo(x + w * 0.85, b - 3); g.lineTo(x + w * 0.85, b - 3 - h * 0.5); g.lineTo(x + w * 0.15, b - 3 - h * 0.35); g.fill();
			g.fillStyle = S.f; g.fillRect(x + w * 0.15, b - 3 - h * 0.25, w * 0.7, 2);
		}
	},
	// a mug, its handle to the side
	mug(g, x, b, w, h, S) {
		const bw = w * 0.72;
		g.strokeStyle = S.c; g.lineWidth = Math.max(1.5, w * 0.08); g.beginPath(); g.arc(x + bw, b - h * 0.5, h * 0.22, -Math.PI / 2, Math.PI / 2); g.stroke();
		g.fillStyle = S.c; rr(g, x, b - h, bw, h, 2); g.fill();
		g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, b - h, bw, 2);
		roundShade(g, x, bw, b - h, h, 0.3);
	},
	// a glass: a wine glass's bowl on its stem, or a pint
	glass(g, x, b, w, h, S, r) {
		const cx = x + w / 2;
		g.fillStyle = 'rgba(220,232,238,0.55)'; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
		if (r() < 0.5) {
			g.beginPath(); g.ellipse(cx, b - h * 0.72, w * 0.36, h * 0.24, 0, 0, Math.PI * 2); g.fill(); g.stroke();
			g.fillRect(cx - 0.8, b - h * 0.5, 1.6, h * 0.46); g.fillRect(cx - w * 0.25, b - 2, w * 0.5, 2);
		} else { g.beginPath(); g.moveTo(x + w * 0.15, b - h * 0.85); g.lineTo(x + w * 0.85, b - h * 0.85); g.lineTo(x + w * 0.75, b); g.lineTo(x + w * 0.25, b); g.closePath(); g.fill(); g.stroke(); }
	},
	// a ring binder on an office shelf: its spine, the label, the finger hole
	binder(g, x, b, w, h, S) {
		g.fillStyle = S.c; g.fillRect(x, b - h, w - 1, h);
		g.fillStyle = '#f8f9fa'; g.fillRect(x + w * 0.15, b - h * 0.85, w * 0.7 - 1, h * 0.32);
		g.fillStyle = '#333'; for (let i = 0; i < 3; i++) g.fillRect(x + w * 0.25, b - h * (0.78 - i * 0.08), w * 0.45, 1);
		g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x + w / 2, b - h * 0.25, w * 0.18, 0, Math.PI * 2); g.fill();
		flatShade(g, x, w - 1, b - h, h);
	},
	// a florist's bucket of one kind of flower: the galvanised bucket, the stems, the heads in a dome
	bunch(g, x, b, w, h, S, r) {
		const bw = w * 0.62, bx = x + (w - bw) / 2, bh = h * 0.34;
		g.fillStyle = S.k2 === '#111111' ? '#2b2d31' : '#9aa1a8';
		g.beginPath(); g.moveTo(bx, b - bh); g.lineTo(bx + bw, b - bh); g.lineTo(bx + bw * 0.9, b); g.lineTo(bx + bw * 0.1, b); g.fill();
		g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx + 2, b - bh + 2, bw - 4, 2);
		g.strokeStyle = '#3f6b2a'; g.lineWidth = 1.2;
		for (let i = 0; i < 9; i++) { const sx = bx + bw * (0.15 + 0.7 * i / 8); g.beginPath(); g.moveTo(sx, b - bh); g.lineTo(x + w * (0.08 + 0.84 * i / 8), b - h * 0.78); g.stroke(); }
		g.fillStyle = '#4f7d36';
		for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(x + w * (0.12 + 0.76 * r()), b - h * (0.45 + 0.3 * r()), w * 0.09, h * 0.04, r() * 3, 0, Math.PI * 2); g.fill(); }
		const c = S.f, rad = Math.max(2.2, w * 0.1);
		for (let i = 0; i < 16; i++) {
			const t = r(), cx = x + w * (0.12 + 0.76 * t), cy = b - h * (0.68 + 0.3 * Math.sin(t * Math.PI) * (0.6 + 0.4 * r()));
			g.fillStyle = shade(c, 0.75 + r() * 0.4); g.beginPath(); g.arc(cx, cy, rad * (0.8 + r() * 0.4), 0, Math.PI * 2); g.fill();
			g.fillStyle = shade(c, 1.3); g.beginPath(); g.arc(cx - rad * 0.25, cy - rad * 0.25, rad * 0.35, 0, Math.PI * 2); g.fill();
		}
	},
	bag(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.c; rr(g, x + 1, y + 3, w - 2, h - 5, 3); g.fill();
		// the crimped seals
		g.fillStyle = shade(S.c, 1.25); g.fillRect(x + 2, y + 1, w - 4, 4); g.fillRect(x + 2, b - 4, w - 4, 3);
		g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = x + 3; i < x + w - 3; i += 2) { g.fillRect(i, y + 1, 1, 4); g.fillRect(i, b - 4, 1, 3); }
		// a band across, the brand on its oval, the window with what is inside
		g.fillStyle = S.a; g.beginPath(); g.moveTo(x + 1, y + h * 0.62); g.lineTo(x + w - 1, y + h * 0.5); g.lineTo(x + w - 1, y + h * 0.62); g.lineTo(x + 1, y + h * 0.74); g.fill();
		g.fillStyle = S.l; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.3, w * 0.42, h * 0.13, -0.15, 0, Math.PI * 2); g.fill();
		word(g, S.n, x + w / 2, y + h * 0.3, w * 0.72, Math.max(7, h * 0.13), S.k);
		g.fillStyle = S.f; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x + w * (0.3 + 0.13 * i), b - h * 0.24 + (i % 2) * 2, w * 0.13, h * 0.06, i, 0, Math.PI * 2); g.fill(); }
		roundShade(g, x + 1, w - 2, y + 3, h - 5, 0.32);
	},
	box(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y, w, h);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.18, w, h * 0.2);
		word(g, S.n, x + w / 2, y + h * 0.28, w * 0.85, Math.max(7, Math.min(h * 0.16, w * 0.32)), S.l);
		if (h > w * 0.9) { g.fillStyle = S.f; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.66, w * 0.33, h * 0.16, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = S.l; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.7, w * 0.36, h * 0.09, 0, 0, Math.PI); g.fill(); }
		else { g.fillStyle = S.f; g.fillRect(x + w * 0.15, y + h * 0.5, w * 0.7, h * 0.32); }
		flatShade(g, x, w, y, h);
	},
	can(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y + 2, w, h - 3);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.35, w, h * 0.3);
		if (w > 9) word(g, S.n, x + w / 2, y + h * 0.5, w * 0.86, Math.max(6, h * 0.22), S.l);
		g.fillStyle = '#b8bcc0'; g.fillRect(x + 1, y, w - 2, 3); g.fillRect(x + 1, b - 2, w - 2, 2);
		roundShade(g, x, w, y, h, 0.5);
	},
	bottle(g, x, b, w, h, S) {
		const y = b - h, nw = Math.max(3, w * 0.34), cx = x + w / 2;
		g.fillStyle = S.k2 || S.a; g.fillRect(cx - nw / 2, y, nw, h * 0.08);                      // the cap
		g.fillStyle = S.liq; g.fillRect(cx - nw / 2, y + h * 0.08, nw, h * 0.16);
		g.beginPath(); g.moveTo(cx - nw / 2, y + h * 0.24); g.quadraticCurveTo(x, y + h * 0.3, x, y + h * 0.42); g.lineTo(x, b - 1); g.lineTo(x + w, b - 1); g.lineTo(x + w, y + h * 0.42); g.quadraticCurveTo(x + w, y + h * 0.3, cx + nw / 2, y + h * 0.24); g.closePath(); g.fill();
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.5, w, h * 0.26);
		if (w > 9) word(g, S.n, cx, y + h * 0.63, w * 0.86, Math.max(6, h * 0.1), S.l);
		roundShade(g, x, w, y + h * 0.24, h * 0.76, 0.42);
		g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + w * 0.24, y + h * 0.3, 1.2, h * 0.6);
	},
	jug(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.c; rr(g, x, y + h * 0.16, w, h * 0.84, w * 0.12); g.fill();
		g.fillRect(x + w * 0.15, y + h * 0.06, w * 0.3, h * 0.14);
		g.fillStyle = S.k2 || S.a; g.fillRect(x + w * 0.17, y, w * 0.26, h * 0.08);
		g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x + w * 0.58, y + h * 0.1, w * 0.3, h * 0.16, 3); g.fill();
		g.fillStyle = S.a; rr(g, x + w * 0.1, y + h * 0.4, w * 0.8, h * 0.4, 4); g.fill();
		word(g, S.n, x + w / 2, y + h * 0.55, w * 0.7, Math.max(7, h * 0.12), S.l);
		roundShade(g, x, w, y + h * 0.16, h * 0.84, 0.38);
	},
	jar(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.k2 || '#d0d0d0'; g.fillRect(x + 1, y, w - 2, h * 0.16);
		g.fillStyle = S.liq; rr(g, x, y + h * 0.14, w, h * 0.86, 3); g.fill();
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.36, w, h * 0.42);
		word(g, S.n, x + w / 2, y + h * 0.57, w * 0.8, Math.max(6, h * 0.16), S.l);
		roundShade(g, x, w, y, h, 0.45);
	},
	carton(g, x, b, w, h, S) {                    // a gable-top carton (milk, juice)
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.18, w, h * 0.82);
		g.beginPath(); g.moveTo(x, y + h * 0.18); g.lineTo(x + w / 2, y + h * 0.04); g.lineTo(x + w, y + h * 0.18); g.fill();
		g.fillStyle = shade(S.c, 0.85); g.fillRect(x + w * 0.42, y, w * 0.16, h * 0.08);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.5, w, h * 0.24);
		word(g, S.n, x + w / 2, y + h * 0.36, w * 0.85, Math.max(6, h * 0.12), S.k);
		flatShade(g, x, w, y, h);
	},
	tall(g, x, b, w, h, S) {                      // a slim can (an energy drink)
		PAINT.can(g, x, b, w, h, S);
		g.fillStyle = S.l; g.beginPath(); g.moveTo(x + 1, b - h * 0.25); g.lineTo(x + w - 1, b - h * 0.65); g.lineTo(x + w - 1, b - h * 0.55); g.lineTo(x + 1, b - h * 0.15); g.fill();
		roundShade(g, x, w, b - h, h, 0.3);
	},
	pack(g, x, b, w, h, S) {                      // a carrier of bottles (six-pack) or a case
		const y = b - h;
		g.fillStyle = S.liq; for (let i = 0; i < 3; i++) g.fillRect(x + w * (0.14 + i * 0.28), y, w * 0.14, h * 0.2);
		g.fillStyle = S.k2 || '#c8a24a'; for (let i = 0; i < 3; i++) g.fillRect(x + w * (0.13 + i * 0.28), y, w * 0.16, h * 0.05);
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.18, w, h * 0.82);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.62, w, h * 0.16);
		word(g, S.n, x + w / 2, y + h * 0.42, w * 0.85, Math.max(7, h * 0.18), S.l);
		flatShade(g, x, w, y + h * 0.18, h * 0.82);
	},
	sleeve(g, x, b, w, h, S) {                    // a packet lying (cookies, crackers)
		const y = b - h;
		g.fillStyle = S.c; rr(g, x, y, w, h, h * 0.3); g.fill();
		g.fillStyle = S.f; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + w * (0.6 + i * 0.12), y + h * 0.55, h * 0.26, 0, Math.PI * 2); g.fill(); }
		word(g, S.n, x + w * 0.3, y + h * 0.5, w * 0.45, Math.max(6, h * 0.36), S.l);
		g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 2, y + 2, w - 4, 2);
		g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 2, b - 3, w - 4, 2);
	},
	roll(g, x, b, w, h, S) {                      // paper rolls in their wrap
		const y = b - h, n = Math.max(1, Math.round(w / 14));
		for (let i = 0; i < n; i++) { g.fillStyle = '#f2f0ea'; rr(g, x + i * w / n, y, w / n - 1, h, 4); g.fill(); roundShade(g, x + i * w / n, w / n - 1, y, h, 0.3); }
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.3, w, h * 0.32);
		word(g, S.n, x + w / 2, y + h * 0.46, w * 0.8, Math.max(7, h * 0.13), S.l);
		g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y + 2, w, 2);
	},
	spray(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.k2 || '#ffffff'; g.fillRect(x + w * 0.25, y, w * 0.55, h * 0.12); g.fillRect(x + w * 0.05, y + h * 0.02, w * 0.3, h * 0.05);
		g.fillRect(x + w * 0.4, y + h * 0.12, w * 0.2, h * 0.12);
		g.fillStyle = S.liq; rr(g, x, y + h * 0.24, w, h * 0.76, w * 0.15); g.fill();
		g.fillStyle = S.c; g.fillRect(x + 1, y + h * 0.45, w - 2, h * 0.32);
		word(g, S.n, x + w / 2, y + h * 0.6, w * 0.8, Math.max(6, h * 0.1), S.l);
		roundShade(g, x, w, y + h * 0.24, h * 0.76, 0.35);
	},
	book(g, x, b, w, h, S) {                      // a spine
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y, w, h);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.1, w, h * 0.05); g.fillRect(x, b - h * 0.14, w, h * 0.05);
		g.fillStyle = S.l; for (let i = 0; i < 3; i++) g.fillRect(x + w * 0.3, y + h * (0.25 + i * 0.12), w * 0.4, h * 0.07);
		g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w - 1, y, 1, h);
	},
	folded(g, x, b, w, h, S) {                    // a stack of folded shirts
		const n = Math.max(3, Math.floor(h / 7));
		for (let i = 0; i < n; i++) {
			const y = b - (i + 1) * h / n;
			g.fillStyle = shade(S.c, 0.9 + (i % 2) * 0.12); rr(g, x, y, w, h / n, 2); g.fill();
			g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + h / n - 1, w, 1);
			g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x + 1, y + 1, w - 2, 1);
		}
	},
	paintcan(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = '#bfc3c6'; g.fillRect(x, y + 2, w, h - 2);
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.2, w, h * 0.6);
		g.fillStyle = S.f; g.fillRect(x + w * 0.12, y + h * 0.48, w * 0.3, h * 0.26);
		word(g, S.n, x + w / 2, y + h * 0.34, w * 0.8, Math.max(6, h * 0.14), S.l);
		g.strokeStyle = '#777'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2, y + 3); g.quadraticCurveTo(x + w / 2, y - h * 0.18, x + w - 2, y + 3); g.stroke();
		roundShade(g, x, w, y + 2, h - 2, 0.42);
	},
	packs(g, x, b, w, h, S, r) {                  // cigarettes: a wall of packs in rows
		const pw = 9, ph = 13;
		for (let y = b - ph - 1; y > b - h; y -= ph + 3) for (let px = x; px + pw <= x + w; px += pw + 1) {
			const s = PALETTES.smokes[Math.floor(r() * PALETTES.smokes.length)];
			g.fillStyle = s[0]; g.fillRect(px, y, pw, ph);
			g.fillStyle = s[1]; g.fillRect(px, y, pw, ph * 0.38);
			g.fillStyle = s[2]; g.fillRect(px + 2, y + ph * 0.5, pw - 4, 2);
			g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px + pw - 1, y, 1, ph);
		}
	},
	blister(g, x, b, w, h, S) {                   // a card on a peg: the hole, the bubble, the thing in it
		const y = b - h;
		g.fillStyle = '#9a9a9a'; g.fillRect(x + w / 2 - 1, y - 6, 2, 7);
		g.fillStyle = S.c; g.fillRect(x, y, w, h);
		g.fillStyle = '#222'; g.beginPath(); g.arc(x + w / 2, y + 3, 1.6, 0, Math.PI * 2); g.fill();
		g.fillStyle = S.a; g.fillRect(x, y + 6, w, h * 0.18);
		word(g, S.n, x + w / 2, y + 6 + h * 0.09, w * 0.85, Math.max(6, h * 0.12), S.l);
		g.fillStyle = 'rgba(220,235,245,0.55)'; rr(g, x + w * 0.15, y + h * 0.36, w * 0.7, h * 0.56, 3); g.fill();
		g.fillStyle = S.f; g.fillRect(x + w * 0.3, y + h * 0.45, w * 0.4, h * 0.36);
		g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + w * 0.2, y + h * 0.4, 1.5, h * 0.4);
	},
	drawer(g, x, b, w, h, S) {                    // a little parts drawer, its label and its pull
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, b - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
		g.fillStyle = '#f4f4f0'; g.fillRect(x + w * 0.15, y + h * 0.18, w * 0.7, h * 0.3);
		g.fillStyle = '#333'; g.fillRect(x + w * 0.22, y + h * 0.28, w * 0.5, 1);
		g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + w * 0.35, y + h * 0.65, w * 0.3, h * 0.15);
	},
	sack(g, x, b, w, h, S) {                      // a big bag (pet food, soil)
		const y = b - h;
		g.fillStyle = S.c; rr(g, x, y + 2, w, h - 2, 5); g.fill();
		g.fillStyle = shade(S.c, 1.2); g.fillRect(x + 2, y, w - 4, 4);
		g.fillStyle = S.l; g.beginPath(); g.arc(x + w / 2, y + h * 0.58, Math.min(w, h) * 0.24, 0, Math.PI * 2); g.fill();
		g.fillStyle = S.f; g.beginPath(); g.arc(x + w / 2, y + h * 0.6, Math.min(w, h) * 0.16, 0, Math.PI * 2); g.fill();
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.12, w, h * 0.18);
		word(g, S.n, x + w / 2, y + h * 0.21, w * 0.85, Math.max(7, h * 0.12), S.l);
		roundShade(g, x, w, y + 2, h - 2, 0.3);
	},
	loaf(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = '#c98b4a'; rr(g, x, y + h * 0.1, w, h * 0.9, h * 0.35); g.fill();
		g.fillStyle = 'rgba(255,255,255,0.55)'; rr(g, x, y + h * 0.1, w, h * 0.9, h * 0.35); g.fill();
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.4, w, h * 0.3);
		g.fillStyle = S.a; g.fillRect(x + w * 0.85, y, w * 0.08, h * 0.2);
		word(g, S.n, x + w / 2, y + h * 0.55, w * 0.7, Math.max(7, h * 0.18), S.l);
		roundShade(g, x, w, y + h * 0.1, h * 0.9, 0.25);
	},
};
// the colour sets a kind's packets are drawn from: [body, band, logo/ink...]
const PALETTES = {
	smokes: [['#ffffff', '#c1121f', '#111'], ['#ffffff', '#1d3557', '#888'], ['#ffffff', '#f4a261', '#333'], ['#111111', '#e9c46a', '#e9c46a'], ['#f1faee', '#2a9d8f', '#2a9d8f'], ['#ffffff', '#6d6875', '#b5838d'], ['#d62828', '#ffffff', '#ffd60a'], ['#003049', '#ffffff', '#fcbf49'], ['#ffffff', '#457b9d', '#1d3557'], ['#e5e5e5', '#9d0208', '#370617']],
};
// each kind: how its strip is stocked. sizes in metres: [w, h]; ink: the colours of its packets
// the strips painted whole: what a menu board says (by its strip: the coffee bar's, a kitchen's,
// a bar's; the lit boards of a burger, a pizza and a taco counter, with their pictures), the tubs
// of ice cream seen from above in a dipping cabinet
const MENUS = [
	['COFFEE', [['Espresso', '3.25'], ['Cappuccino', '4.75'], ['Latte', '5.25'], ['Mocha', '5.50'], ['Cold brew', '4.95'], ['Chai latte', '5.25']]],
	['KITCHEN', [['Soup of the day', '7.50'], ['House salad', '9.00'], ['Club sandwich', '13.50'], ['Fish & chips', '17.00'], ['Steak frites', '24.00'], ['Pasta special', '16.50']]],
	['DRINKS', [['Draft beer', '7.00'], ['House red', '9.00'], ['House white', '9.00'], ['Margarita', '12.00'], ['Old fashioned', '13.00'], ['Lemonade', '4.00']]],
	['TEA', [['Milk tea', '5.75'], ['Taro', '6.25'], ['Matcha latte', '6.50'], ['Mango slush', '6.75'], ['Brown sugar', '6.95'], ['+ Boba', '0.75']]],
	['GELATO', [['One scoop', '4.50'], ['Two scoops', '6.50'], ['Waffle cone', '1.00'], ['Sundae', '8.25'], ['Milkshake', '7.50'], ['Affogato', '6.00']]],
	['SPECIALS', [['Tonkotsu ramen', '16.00'], ['Miso ramen', '15.00'], ['Gyoza', '8.00'], ['Salmon nigiri', '7.50'], ['Chef\'s omakase', '65.00'], ['Sake', '12.00']]],
	['BAKERY', [['Croissant', '4.25'], ['Pain au chocolat', '4.75'], ['Sourdough loaf', '9.00'], ['Morning bun', '4.50'], ['Cake slice', '6.50'], ['Baguette', '4.00']]],
];
const LIT = [
	['BURGERS', 'burger', [['Classic burger', '8.99'], ['Double cheese', '11.49'], ['Fries', '3.99']]],
	['PIZZA', 'pizza', [['Pepperoni slice', '4.25'], ['Margherita', '16.00'], ['Garlic knots', '5.50']]],
	['TACOS', 'taco', [['Carne asada', '3.75'], ['Al pastor', '3.50'], ['Burrito', '11.95']]],
];
function food(g, kind, cx, cy, s) {
	if (kind === 'burger') {
		g.fillStyle = '#d9973d'; g.beginPath(); g.ellipse(cx, cy - s * 0.2, s * 0.5, s * 0.32, 0, Math.PI, 0); g.fill();
		g.fillStyle = '#5aa02c'; g.fillRect(cx - s * 0.52, cy - s * 0.2, s * 1.04, s * 0.1);
		g.fillStyle = '#ffc93c'; g.fillRect(cx - s * 0.48, cy - s * 0.1, s * 0.96, s * 0.08);
		g.fillStyle = '#5a2d14'; rr(g, cx - s * 0.5, cy - s * 0.04, s, s * 0.18, 4); g.fill();
		g.fillStyle = '#c98232'; rr(g, cx - s * 0.48, cy + s * 0.14, s * 0.96, s * 0.16, 5); g.fill();
		g.fillStyle = '#f7e1b5'; for (let i = 0; i < 6; i++) g.fillRect(cx - s * 0.3 + i * s * 0.11, cy - s * 0.4 + (i % 2) * 3, 2, 1.2);
	} else if (kind === 'pizza') {
		g.fillStyle = '#d9a35c'; g.beginPath(); g.moveTo(cx - s * 0.5, cy - s * 0.3); g.lineTo(cx + s * 0.5, cy - s * 0.3); g.lineTo(cx, cy + s * 0.4); g.fill();
		g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(cx - s * 0.42, cy - s * 0.22); g.lineTo(cx + s * 0.42, cy - s * 0.22); g.lineTo(cx, cy + s * 0.32); g.fill();
		g.fillStyle = '#b3261e'; for (const [u, v] of [[-0.18, -0.1], [0.15, -0.08], [0, 0.1]]) { g.beginPath(); g.arc(cx + u * s, cy + v * s, s * 0.08, 0, Math.PI * 2); g.fill(); }
	} else {
		g.fillStyle = '#e8b64c'; g.beginPath(); g.ellipse(cx, cy + s * 0.1, s * 0.5, s * 0.35, 0, Math.PI, 0); g.fill();
		for (let i = 0; i < 12; i++) { g.fillStyle = ['#5aa02c', '#c1121f', '#6b3a1e', '#f4f1de'][i % 4]; g.fillRect(cx - s * 0.35 + (i % 6) * s * 0.12, cy - s * 0.22 + Math.floor(i / 6) * s * 0.08, s * 0.1, s * 0.06); }
	}
}
const WHOLE = {
	menu(g, x0, y0, n) {
		const [title, rows] = MENUS[n % MENUS.length];
		g.fillStyle = '#5a3b22'; g.fillRect(x0, y0, TW, TH);
		g.fillStyle = '#1f2420'; g.fillRect(x0 + 4, y0 + 4, TW - 8, TH - 8);
		word(g, title, x0 + TW / 2, y0 + 14, TW * 0.5, 14, '#f4f1de');
		g.fillStyle = 'rgba(244,241,222,0.35)'; g.fillRect(x0 + 40, y0 + 23, TW - 80, 1);
		rows.forEach(([name, price], i) => {
			const col = i % 2, row = Math.floor(i / 2), xx = x0 + 10 + col * (TW / 2 - 4), yy = y0 + 36 + row * 18;
			g.fillStyle = '#ece6d2'; g.font = '600 10px Arial, Helvetica, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(name, xx, yy, TW / 2 - 44);
			g.textAlign = 'right'; g.fillStyle = '#ffd166'; g.fillText(price, xx + TW / 2 - 18, yy);
		});
	},
	menulit(g, x0, y0, n) {
		const [title, kind, rows] = LIT[n % LIT.length];
		const bg = g.createLinearGradient(0, y0, 0, y0 + TH); bg.addColorStop(0, '#fffaf0'); bg.addColorStop(1, '#f3e6c8');
		g.fillStyle = bg; g.fillRect(x0, y0, TW, TH);
		g.fillStyle = '#c1121f'; g.fillRect(x0, y0, TW, 18);
		word(g, title, x0 + TW / 2, y0 + 9, TW * 0.5, 13, '#ffffff');
		rows.forEach(([name, price], i) => {
			const cx = x0 + 43 + i * 85;
			food(g, kind, cx, y0 + 46, 44);
			word(g, name, cx, y0 + 74, 80, 9, '#2b2b2b', false);
			word(g, price, cx, y0 + 87, 60, 11, '#c1121f');
		});
		g.fillStyle = '#111'; g.fillRect(x0, y0 + TH - 2, TW, 2);
	},
	tubs(g, x0, y0, n, r) {
		g.fillStyle = '#9aa1a8'; g.fillRect(x0, y0, TW, TH);
		const cols = ['#fff3d6', '#f7a6c1', '#6b3a1e', '#a8e6a1', '#ffe066', '#c9a0dc', '#ff8fa3', '#d9b38c', '#e8f4f8', '#ffb347'];
		for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
			const x = x0 + 4 + i * 63, y = y0 + 4 + row * 46, c = cols[(n * 3 + row * 4 + i) % cols.length];
			g.fillStyle = '#d7dce0'; g.fillRect(x, y, 59, 42);
			g.fillStyle = c; g.fillRect(x + 3, y + 3, 53, 36);
			g.strokeStyle = shade(c, 0.8); g.lineWidth = 1.5;
			for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + 10 + r() * 38, y + 10 + r() * 20, 6 + r() * 6, Math.PI * 0.1, Math.PI * 1.1); g.stroke(); }
			g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 3, y + 3, 53, 4);
		}
	},
};
const STOCK = {
	chips: { p: 'bag', w: [0.17, 0.24], h: [0.26, 0.36], f: [2, 4], food: ['#f6bd60', '#e9a03b', '#d4a373', '#f28482'] },
	candy: { p: 'box', w: [0.1, 0.16], h: [0.1, 0.16], f: [3, 6], food: ['#6f4518', '#9c6644', '#e5383b'] },
	cookies: { p: ['sleeve', 'box'], w: [0.16, 0.26], h: [0.07, 0.22], f: [2, 4], food: ['#7f5539', '#ddb892', '#b08968'] },
	cereal: { p: 'box', w: [0.19, 0.27], h: [0.29, 0.38], f: [2, 3], food: ['#f6bd60', '#ffe8d6', '#cb997e'] },
	cans: { p: 'can', w: [0.075, 0.1], h: [0.1, 0.13], f: [3, 6], stack: 2, food: ['#d62828'] },
	jars: { p: 'jar', w: [0.08, 0.11], h: [0.12, 0.2], f: [3, 5], liq: ['#9d0208', '#7f5539', '#606c38', '#ffd166', '#bc6c25'] },
	dry: { p: ['box', 'sleeve'], w: [0.1, 0.22], h: [0.12, 0.3], f: [2, 5], food: ['#ffe8d6', '#f6bd60', '#fefae0'] },
	bread: { p: 'loaf', w: [0.22, 0.32], h: [0.12, 0.16], f: [2, 3] },
	soda: { p: 'bottle', w: [0.07, 0.09], h: [0.22, 0.27], f: [3, 6], liq: ['#2b1a12', '#f77f00', '#8ac926', '#e63946', '#3a86ff', '#e9edc9'], cool: true },
	cancool: { p: 'can', w: [0.066, 0.068], h: [0.12, 0.123], f: [4, 8], stack: 3, cool: true },
	water: { p: 'bottle', w: [0.07, 0.08], h: [0.22, 0.25], f: [4, 8], liq: ['#cfe8f3', '#dceef5', '#b9e2f0'], ink: ['#1d6fd1', '#118ab2', '#0077b6', '#48cae4', '#023e8a'], cool: true },
	energy: { p: 'tall', w: [0.058, 0.062], h: [0.16, 0.17], f: [4, 7], stack: 2, ink: ['#111111', '#073b4c', '#3a0ca3', '#8ac926', '#fcbf49', '#e5e5e5'], cool: true },
	beer: { p: ['pack', 'can', 'bottle'], w: [0.2, 0.28], h: [0.24, 0.3], f: [2, 3], liq: ['#5b3a1a', '#7a4b1f', '#2e1a0e'], cool: true },
	wine: { p: 'bottle', w: [0.075, 0.08], h: [0.3, 0.32], f: [3, 5], liq: GLASS, ink: SOFT },
	spirits: { p: 'bottle', w: [0.08, 0.11], h: [0.25, 0.32], f: [2, 4], liq: ['#b5651d', '#d4a017', '#eeeeee', '#7a3e1d', '#2b2b2b'] },
	dairy: { p: ['jug', 'carton'], w: [0.1, 0.16], h: [0.2, 0.28], f: [3, 5], ink: ['#ffffff', '#f8f9fa', '#fff8e1'], cool: true },
	frozen: { p: 'box', w: [0.18, 0.26], h: [0.2, 0.3], f: [2, 4], food: ['#e76f51', '#f4a261', '#fefae0'], cool: true },
	laundry: { p: ['jug', 'box'], w: [0.18, 0.26], h: [0.26, 0.36], f: [2, 3], ink: ['#f77f00', '#1d6fd1', '#06a77d', '#7b2cbf', '#ffd60a', '#ef476f'] },
	paper: { p: 'roll', w: [0.24, 0.34], h: [0.26, 0.36], f: [1, 2], ink: ['#1d6fd1', '#06a77d', '#ef476f', '#7b2cbf', '#f77f00'] },
	clean: { p: 'spray', w: [0.08, 0.11], h: [0.24, 0.3], f: [2, 4], liq: ['#a8dadc', '#90be6d', '#ffd166', '#ffc8dd', '#bde0fe'] },
	care: { p: ['spray', 'jar', 'box'], w: [0.06, 0.1], h: [0.12, 0.24], f: [3, 5], liq: SOFT, ink: ['#ffffff', '#a8dadc', '#cdb4db', '#ffc8dd', '#bde0fe', '#118ab2', '#2a9d8f'] },
	meds: { p: ['box', 'jar'], w: [0.06, 0.1], h: [0.1, 0.16], f: [3, 6], liq: ['#ffffff'], ink: ['#ffffff', '#f1faee', '#e0e1dd'] },
	auto: { p: ['jug', 'bottle'], w: [0.09, 0.14], h: [0.22, 0.3], f: [3, 5], liq: ['#111111', '#073b4c'], ink: ['#111111', '#ffd60a', '#1d6fd1', '#06a77d', '#d62828'] },
	pet: { p: 'sack', w: [0.3, 0.4], h: [0.34, 0.4], f: [1, 2], food: ['#ddb892', '#f6bd60', '#ffffff'] },
	paint: { p: 'paintcan', w: [0.16, 0.18], h: [0.18, 0.2], f: [3, 5], food: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#ffb703', '#8ac926', '#cdb4db'] },
	tools: { p: 'box', w: [0.18, 0.32], h: [0.14, 0.3], f: [1, 3], ink: ['#ffd60a', '#d62828', '#f77f00', '#118ab2', '#06a77d', '#111111'], food: ['#333333', '#555555'] },
	peg: { p: 'blister', w: [0.1, 0.16], h: [0.16, 0.26], f: [2, 4], peg: true, ink: ['#d62828', '#ffd60a', '#1d6fd1', '#f77f00', '#111111', '#06a77d'], food: ['#6c757d', '#adb5bd', '#343a40', '#c0a062'] },
	bins: { p: 'drawer', w: [0.08, 0.1], h: [0.07, 0.09], f: [5, 10], grid: true, ink: ['#e9c46a', '#219ebc', '#d62828', '#8d99ae'] },
	books: { p: 'book', w: [0.025, 0.05], h: [0.19, 0.27], f: [1, 2], ink: ['#7f1d1d', '#1e3a5f', '#0b6e4f', '#2b2d42', '#e9c46a', '#a44a3f', '#5c4d7d', '#f4f1de', '#d4a373', '#264653', '#e76f51'] },
	clothes: { p: 'folded', w: [0.26, 0.32], h: [0.18, 0.32], f: [1, 1], ink: ['#1d3557', '#e63946', '#f1faee', '#2b2d42', '#a8dadc', '#6d6875', '#e9c46a', '#264653', '#ffffff', '#111111'] },
	tech: { p: ['blister', 'box'], w: [0.1, 0.18], h: [0.12, 0.22], f: [2, 4], peg: true, ink: ['#ffffff', '#111111', '#e5e5e5', '#1d6fd1'], food: ['#111111', '#333333', '#ffffff'] },
	toys: { p: 'box', w: [0.16, 0.3], h: [0.16, 0.34], f: [1, 2], food: ['#ffd60a', '#8ac926', '#ef476f', '#118ab2'] },
	smokes: { p: 'packs', w: [1.2, 1.2], h: [0.4, 0.4], f: [1, 1] },
	// (cut out: no shelf behind, no rail; the buckets stand on a florist's stands and in its cooler)
	flowers: { p: 'bunch', w: [0.24, 0.3], h: [0.4, 0.44], f: [1, 1], open: true, food: ['#d62828', '#ef476f', '#ffd60a', '#f8f9fa', '#9d4edd', '#f77f00', '#ffafcc', '#e63946'] },
	// (in a lit case: a pale back)
	pastry: { p: 'pastry', w: [0.1, 0.14], h: [0.06, 0.09], f: [3, 5], stack: 2, back: '#efe6d6', ink: ['#f4f1de', '#e9c46a', '#cdb4db', '#a8dadc'], food: ['#7f5539', '#c98a3c', '#6d2e46', '#3d405b'] },
	donuts: { p: 'donut', w: [0.1, 0.11], h: [0.06, 0.07], f: [4, 6], stack: 3, back: '#f3ece0', food: ['#f7a6c1', '#5a3420', '#fefae0', '#ffd166', '#b5838d', '#e9edc9'] },
	cakes: { p: 'cake', w: [0.22, 0.28], h: [0.16, 0.22], f: [1, 2], back: '#efe6d6', ink: ['#f4f1de', '#5a3420', '#ffc8dd', '#fefae0'], food: ['#ffffff', '#ef476f', '#7f5539', '#ffd166'] },
	beans: { p: 'bag', w: [0.14, 0.18], h: [0.22, 0.28], f: [2, 3], ink: ['#3d2b1f', '#111111', '#c9a66b', '#7a2e1f', '#f4f1de'], food: ['#3d2b1f', '#5b3a29'] },
	mugs: { p: 'mug', w: [0.1, 0.12], h: [0.09, 0.1], f: [3, 6], stack: 3, ink: ['#ffffff', '#f4f1de', '#2b2d42', '#e9c46a', '#a8dadc', '#e76f51'] },
	glasses: { p: 'glass', w: [0.07, 0.09], h: [0.14, 0.2], f: [4, 8] },
	binders: { p: 'binder', w: [0.05, 0.08], h: [0.28, 0.32], f: [2, 5], ink: ['#1d3557', '#2b2d42', '#e63946', '#f1faee', '#457b9d', '#111111', '#2a9d8f', '#e9c46a'] },
	menu: { whole: 'menu' }, menulit: { whole: 'menulit' }, tubs: { whole: 'tubs' },
};

function paintStrip(g, kind, x0, y0, seed) {
	const S0 = STOCK[kind] || STOCK.dry, r = prng(seed * 7919 + 17), cool = COOL.has(kind);
	g.save();
	g.beginPath(); g.rect(x0, y0, TW, TH); g.clip();
	if (S0.whole) { WHOLE[S0.whole](g, x0, y0, TILES[kind].indexOf(Math.round(y0 / TH) * 8 + Math.round(x0 / TW)), r); g.restore(); return; }
	// the back of the shelf: a cooler's lit white, a gondola's steel grey, the pegboard's holes;
	// darker under the shelf above
	const back = g.createLinearGradient(0, y0, 0, y0 + TH);
	if (cool) { back.addColorStop(0, '#9aa4ab'); back.addColorStop(0.35, '#e6eef2'); back.addColorStop(1, '#f4f8fa'); }
	else if (S0.peg) { back.addColorStop(0, '#6b6458'); back.addColorStop(0.2, '#bcb3a2'); back.addColorStop(1, '#a9a090'); }
	else { back.addColorStop(0, '#1d1e20'); back.addColorStop(0.3, '#4a4d52'); back.addColorStop(1, '#5d6066'); }
	if (S0.back) { const B = g.createLinearGradient(0, y0, 0, y0 + TH); B.addColorStop(0, shade(S0.back, 0.7)); B.addColorStop(0.3, S0.back); B.addColorStop(1, S0.back); g.fillStyle = B; g.fillRect(x0, y0, TW, TH); }
	else if (!S0.open) { g.fillStyle = back; g.fillRect(x0, y0, TW, TH); }
	if (S0.peg) { g.fillStyle = 'rgba(40,30,20,0.55)'; for (let y = y0 + 4; y < y0 + TH; y += 6) for (let x = x0 + 3; x < x0 + TW; x += 6) g.fillRect(x, y, 1.4, 1.4); }
	const base = y0 + TH - RAIL;
	const sku = () => {
		const ink = S0.ink || LOUD, food = S0.food || ['#f6bd60'];
		const c = pick(r, ink);
		let a = pick(r, LOUD); if (a === c) a = pick(r, SOFT);
		const lightBody = /#f[0-9a-f]{5}|#e[0-9a-f]{5}|#ffffff/i.test(c);
		return { c, a, l: lightBody ? pick(r, ['#d62828', '#1d3557', '#111111', '#06a77d']) : pick(r, ['#ffffff', '#ffd60a', '#f1faee']), k: pick(r, ['#111111', '#d62828', '#1d3557']), f: pick(r, food), liq: S0.liq ? pick(r, S0.liq) : c, k2: pick(r, ['#d62828', '#ffffff', '#1d6fd1', '#ffd60a', '#111111', '#06a77d']), n: brand(r), p: Array.isArray(S0.p) ? pick(r, S0.p) : S0.p };
	};
	if (S0.p === 'packs') PAINT.packs(g, x0 + 2, base, TW - 4, TH - RAIL - 4, null, r);
	else if (S0.grid) {
		// the drawers of a parts cabinet: rows of them, the strip full
		for (let y = base; y > y0 + 10; y -= 0.085 * PX) { const S = sku(); for (let x = x0; x < x0 + TW - 2; x += 0.09 * PX) PAINT.drawer(g, x + 1, y - 1, 0.09 * PX - 2, 0.085 * PX - 2, S); }
	} else if (S0.peg) {
		// cards on their pegs: two rows
		for (const row of [0, 1]) {
			let x = x0 + 3;
			const top = y0 + 8 + row * (TH - RAIL) / 2;
			while (x < x0 + TW - 10) {
				const S = sku(), w = (S0.w[0] + r() * (S0.w[1] - S0.w[0])) * PX * 0.7, h = Math.min((TH - RAIL) / 2 - 10, (S0.h[0] + r() * (S0.h[1] - S0.h[0])) * PX * 0.5), n = 1 + Math.floor(r() * 2);
				for (let k = 0; k < n && x + w < x0 + TW - 2; k++) { PAINT[S.p === 'box' ? 'blister' : S.p](g, x, top + h, w, h, S); x += w + 3; }
				x += 2;
			}
		}
	} else {
		let x = x0 + 1 + r() * 3;
		while (x < x0 + TW - 6) {
			const S = sku(), fw = (S0.w[0] + r() * (S0.w[1] - S0.w[0])) * PX, fh = Math.min(TH - RAIL - 10, (S0.h[0] + r() * (S0.h[1] - S0.h[0])) * PX);
			const n = S0.f[0] + Math.floor(r() * (S0.f[1] - S0.f[0] + 1)), stack = S0.stack ? Math.max(1, Math.min(S0.stack, Math.floor((TH - RAIL - 8) / fh))) : 1;
			for (let k = 0; k < n && x + fw < x0 + TW + fw * 0.4; k++) {
				for (let s = 0; s < stack; s++) PAINT[S.p](g, x, base - s * (fh + 1), fw, fh, S, r);
				x += fw + (S.p === 'book' ? 0 : 1);
			}
			x += S.p === 'book' ? 0 : 1 + r() * 2;
		}
	}
	// the price rail along the foot: its strip, a tag under each run of facings
	if (S0.open) { g.restore(); return; }
	g.fillStyle = cool ? '#d9dee2' : '#cfd2d4'; g.fillRect(x0, base, TW, RAIL);
	g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0, base, TW, 1);
	if (!S0.peg) for (let x = x0 + 6 + r() * 10; x < x0 + TW - 14; x += 22 + r() * 30) {
		g.fillStyle = r() < 0.18 ? '#ffd60a' : '#ffffff'; g.fillRect(x, base + 1.5, 12, RAIL - 2.5);
		g.fillStyle = '#222'; g.fillRect(x + 2, base + 3, 5, 1.4); g.fillRect(x + 8, base + 3, 3, 2.2);
	}
	g.restore();
}

let SHEET = null;
// the sheet; painted by goodsSteps a few strips a step (ready once all are)
export function goodsSheet() {
	if (SHEET) return SHEET;
	const k = GFX_PHONE ? 0.5 : 1, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	if (!cv) return (SHEET = { tex: null, ready: true, k, cv: null, next: 1e9 });
	cv.width = W * k; cv.height = H * k;
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = GFX_PHONE ? 2 : 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
	SHEET = { tex, ready: false, k, cv, next: 0 };
	return SHEET;
}
const ALL_TILES = Object.entries(TILES).flatMap(([kind, list]) => list.map((t, i) => [kind, t, i]));
export function* goodsSteps() {
	const S = goodsSheet();
	if (S.ready) return S;
	const g = S.cv.getContext('2d');
	if (S.next === 0) {
		g.setTransform(S.k, 0, 0, S.k, 0, 0);
		g.fillStyle = '#ffffff'; g.fillRect(W - 8, H - 8, 8, 8);
		// the price rail on its own (a cooler's door rail, a shelf with nothing painted on it)
		g.fillStyle = '#cfd2d4'; g.fillRect(0, RAIL_Y, TW, RAIL);
		g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, RAIL_Y, TW, 1);
		for (let x = 6; x < TW - 14; x += 34) { g.fillStyle = x % 3 ? '#ffffff' : '#ffd60a'; g.fillRect(x, RAIL_Y + 1.5, 12, RAIL - 2.5); }
		// the signs: their letters alone (the sign's panel is drawn under them in its own colour)
		SIGNS.forEach((t, i) => word(g, t, (i % 8) * SW + SW / 2, SIGN_Y + Math.floor(i / 8) * SH + SH / 2 + 1, SW - 24, 22, '#ffffff'));
	}
	while (S.next < ALL_TILES.length) {
		g.setTransform(S.k, 0, 0, S.k, 0, 0);
		for (let n = 0; n < 4 && S.next < ALL_TILES.length; n++, S.next++) {
			const [kind, t, i] = ALL_TILES[S.next];
			paintStrip(g, kind, (t % 8) * TW, Math.floor(t / 8) * TH, t * 31 + i * 7 + 3);
		}
		yield;
	}
	g.setTransform(1, 0, 0, 1, 0, 0);
	S.tex.needsUpdate = true;
	S.ready = true;
	return S;
}

// ---------------------------------------------------------------------------------
// a shop's own material: the sheet, unlit, each vertex its light; its brightness the shop's
export function goodsMaterial() {
	const S = goodsSheet();
	const m = new THREE.MeshBasicMaterial({ map: S.tex, vertexColors: true, alphaTest: 0.5 });
	m.name = 'goods';
	return m;
}

// ---------------------------------------------------------------------------------
// the builder: quads into one geometry, in a frame placed like the kit's (x along, z out)
export class GoodsBuilder {
	constructor() { this.p = []; this.u = []; this.c = []; this.o = [0, 0, 0]; this.r = 0; }
	// the frame: its origin and its quarter-turns (0: x along x, the face toward +z)
	at(x, y, z, rot = 0) { this.o = [x, y, z]; this.r = ((rot % 4) + 4) % 4; return this; }
	tp(x, y, z) {
		const [ox, oy, oz] = this.o;
		switch (this.r) {
			case 1: return [ox + z, oy + y, oz - x];
			case 2: return [ox - x, oy + y, oz - z];
			case 3: return [ox - z, oy + y, oz + x];
			default: return [ox + x, oy + y, oz + z];
		}
	}
	// a quad, corners anticlockwise seen from the front; uv [u0, v0, u1, v1] laid a (bottom left)
	// to c (top right); k its light (or [kBottom, kTop]), tint an rgb
	quad(a, b, c, d, uv, k = 1, tint = [1, 1, 1]) {
		const P = [a, b, c, d].map((q) => this.tp(...q)), U = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
		const K = Array.isArray(k) ? [k[0], k[0], k[1], k[1]] : [k, k, k, k];
		for (const i of [0, 1, 2, 0, 2, 3]) { this.p.push(...P[i]); this.u.push(...U[i]); this.c.push(tint[0] * K[i], tint[1] * K[i], tint[2] * K[i]); }
	}
	// a plain box, its colour in its vertices (a shelf edge, a case of stock); faces: which to draw
	solid(x0, y0, z0, x1, y1, z1, rgb, k = 1, faces = 'tfbls') {
		const w = WHITE_UV, kt = k * 1.08, ks = k * 0.78;
		if (faces.includes('f')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], w, [k * 0.85, k], rgb);
		if (faces.includes('b')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], w, [k * 0.8, k * 0.95], rgb);
		if (faces.includes('t')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], w, kt, rgb);
		if (faces.includes('l')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], w, [ks * 0.85, ks], rgb);
		if (faces.includes('s')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], w, [ks * 0.85, ks], rgb);
	}
	// stock on a shelf: from x0 to x1 (the frame's x), its face at z, standing on y, as tall as
	// the shelf gives (to STRIP_H), d deep behind its face; kind and a seed pick the strips; k
	// its light. The face painted, the tops and the ends of the stock plain in its colour.
	run(kind, x0, x1, y, h, z, d, seed = 0, k = 1) {
		const hh = Math.min(h, STRIP_H), cool = COOL.has(kind), top = TOPS[kind] || [0.45, 0.42, 0.4];
		const vt = hh / STRIP_H;
		let n = Math.floor(Math.abs(seed * 13.7)) % 97;
		for (let x = x0; x < x1 - 0.02; x += STRIP_W, n++) {
			const xe = Math.min(x1, x + STRIP_W), [u0, v0, u1, v1] = stripUV(kind, n), uw = (xe - x) / STRIP_W;
			const uv = [u0, v0, u0 + (u1 - u0) * uw, v0 + (v1 - v0) * vt];
			this.quad([x, y, z], [xe, y, z], [xe, y + hh, z], [x, y + hh, z], uv, cool ? [k * 1.1, k * 1.25] : [k * 0.82, k]);
			// the stock behind the face, seen from above (darker toward the back) and its ends
			this.quad([x, y + hh * 0.86, z], [xe, y + hh * 0.86, z], [xe, y + hh * 0.86, z - d], [x, y + hh * 0.86, z - d], WHITE_UV, [k * 0.9, k * 0.45], top);
		}
		this.quad([x0, y, z - d], [x0, y, z], [x0, y + hh * 0.86, z], [x0, y + hh * 0.86, z - d], WHITE_UV, k * 0.5, top);
		this.quad([x1, y, z], [x1, y, z - d], [x1, y + hh * 0.86, z - d], [x1, y + hh * 0.86, z], WHITE_UV, k * 0.5, top);
	}
	// the price rail alone, along a shelf's front edge
	rail(x0, x1, y, z, k = 1) {
		for (let x = x0; x < x1 - 0.02; x += STRIP_W) { const xe = Math.min(x1, x + STRIP_W); this.quad([x, y, z], [xe, y, z], [xe, y + 0.0375, z], [x, y + 0.0375, z], [RAIL_UV[0], RAIL_UV[1], RAIL_UV[0] + (RAIL_UV[2] - RAIL_UV[0]) * (xe - x) / STRIP_W, RAIL_UV[3]], k); }
	}
	// a card standing up (a strip's face alone: a pegboard's cards, a wall of packs)
	face(kind, x0, x1, y, h, z, seed = 0, k = 1) {
		let n = Math.floor(Math.abs(seed * 13.7)) % 97;
		const vt = Math.min(1, h / STRIP_H);
		for (let x = x0; x < x1 - 0.02; x += STRIP_W, n++) {
			const xe = Math.min(x1, x + STRIP_W), [u0, v0, u1, v1] = stripUV(kind, n), uw = (xe - x) / STRIP_W;
			this.quad([x, y, z], [xe, y, z], [xe, y + h, z], [x, y + h, z], [u0, v0, u0 + (u1 - u0) * uw, v0 + (v1 - v0) * vt], [k * 0.88, k]);
		}
	}
	// a strip lying flat (the tubs in a dipping cabinet, seen through its glass): from x0 to x1,
	// z0 (its foot) to z1, at y
	flat(kind, x0, x1, z0, z1, y, seed = 0, k = 1) {
		let n = Math.floor(Math.abs(seed * 13.7)) % 97;
		for (let x = x0; x < x1 - 0.02; x += STRIP_W, n++) {
			const xe = Math.min(x1, x + STRIP_W), [u0, v0, u1, v1] = stripUV(kind, n), uw = (xe - x) / STRIP_W;
			this.quad([x, y, z1], [xe, y, z1], [xe, y, z0], [x, y, z0], [u0, v0, u0 + (u1 - u0) * uw, v1], k);
		}
	}
	// a lit sign: its panel in its colour, the letters on it (from x0 to x1 at z, y to y + h)
	sign(name, x0, x1, y, h, z, rgb, k = 1.15) {
		this.quad([x0, y, z], [x1, y, z], [x1, y + h, z], [x0, y + h, z], WHITE_UV, k, rgb);
		// (the letters as wide as they were painted for their height: a narrow sign, smaller letters)
		const w = Math.min((x1 - x0) * 0.96, h * 0.92 * SW / SH), lh = w * SH / SW, xm = (x0 + x1) / 2, ym = y + h / 2;
		this.quad([xm - w / 2, ym - lh / 2, z + 0.004], [xm + w / 2, ym - lh / 2, z + 0.004], [xm + w / 2, ym + lh / 2, z + 0.004], [xm - w / 2, ym + lh / 2, z + 0.004], signUV(name), k * 1.05);
	}
	empty() { return !this.p.length; }
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
		g.computeBoundingSphere();
		return g;
	}
}
// the colour of the tops of each kind's stock (linear rgb, roughly its packets')
const TOPS = {
	chips: [0.55, 0.3, 0.12], candy: [0.35, 0.18, 0.1], cereal: [0.6, 0.45, 0.2], cans: [0.55, 0.56, 0.58], soda: [0.4, 0.15, 0.08], cancool: [0.62, 0.63, 0.66],
	water: [0.6, 0.7, 0.8], energy: [0.25, 0.25, 0.28], beer: [0.42, 0.3, 0.16], wine: [0.18, 0.12, 0.08], dairy: [0.85, 0.85, 0.85], frozen: [0.6, 0.4, 0.3],
	paper: [0.82, 0.8, 0.76], laundry: [0.6, 0.35, 0.15], paint: [0.62, 0.63, 0.64], books: [0.75, 0.7, 0.6], clothes: [0.4, 0.4, 0.45], pet: [0.5, 0.4, 0.25],
};
