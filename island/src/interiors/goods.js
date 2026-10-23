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
import { brandName } from '../signage/brand-catalog.js';
import { brandMark } from '../signage/brand-marks.js';

// ---------------------------------------------------------------------------------
// the sheet: 8 strips across, 17 down, 256 x 96 each (at the full size: half on a phone), then
// the price rail on its own, the shops' hanging signs (white letters, cut out) and a plain patch
export const STRIP_W = 1.2, STRIP_H = 0.45;
const TW = 256, TH = 96, ROWS = 17, RAIL_Y = ROWS * TH, SIGN_Y = RAIL_Y + 10, SW = 256, SH = 32, W = 2048, H = 1888, PX = TW / STRIP_W, RAIL = 8;
// the kinds and how many strips of each (a strip's goods differ, so a long run never repeats
// itself side by side); cool: in a cooler, lit from behind
export const KINDS = {
	chips: 4, candy: 3, cookies: 3, trays: 2, cereal: 2, cans: 3, jars: 2, dry: 2, bread: 2,
	soda: 3, cancool: 3, water: 2, energy: 2, fountain: 1, beer: 3, wine: 2, spirits: 2, dairy: 2, frozen: 2, crates: 2,
	laundry: 2, paper: 2, clean: 1, care: 3, meds: 3, vanity: 2, auto: 2, pet: 2,
	paint: 2, tools: 2, peg: 3, bins: 2, books: 3, covers: 3, clothes: 2, tech: 2, toys: 2, smokes: 2,
	flowers: 2, notices: 1, posters: 3,
	// (vanity: a stylist's bottles and jars standing on a counter, nothing behind them;
	// painted whole: a fast-food tray from above, two to a strip; a drinks fountain's front, its
	// makers' badges over the nozzles; a grocer's crates of produce from above, five to a strip; the
	// covers of new books, four to a strip, for the tops of the stacks on a table; a notice board;
	// the pictures on a café's or a restaurant's walls: makers' posters and painted prints)
	// the cafés', restaurants' and offices': the pastries and donuts and cakes in their cases, the
	// bags of beans, the mugs, the tubs of ice cream seen from above, the glasses behind a bar, the
	// binders on an office's shelves, the menus on the wall (chalk, and lit with their pictures)
	pastry: 2, donuts: 2, cakes: 2, beans: 2, mugs: 2, tubs: 2, glasses: 2, binders: 3, menu: 7, menulit: 3,
	// the places to play and the offices': film posters, four to a strip; the arcade machines'
	// marquees, six (two across, three down); a bowling alley's shoe cubbies; a popcorn machine's
	// glass and its buckets; a tattoo artist's inks; framed certificates, four
	films: 2, marquee: 2, shoes: 1, popcorn: 1, inks: 1, certs: 1,
	// a clothes shop's: the garments it hangs facing out, four to a strip (GARMENTS)
	garments: 4,
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
	'MENU', 'ORDER HERE', 'PICK UP', 'KITCHEN', 'BAR', 'ESPRESSO', 'PASTRIES', 'DONUTS', 'PIZZA', 'BURGERS', 'TACOS', 'SUSHI', 'RAMEN', 'RECEPTION', 'SPECIALS', 'GELATO',
	'TICKETS', 'BOX OFFICE', 'CONCESSIONS', 'SHOES', 'SNACK BAR', 'PRIZES', 'LANES', 'EXIT'];
// a sign's letters on the sheet (cut out: the material keeps only what is painted)
export function signUV(name) {
	const i = Math.max(0, SIGNS.indexOf(name)), cx = i % 8, cy = Math.floor(i / 8), y = SIGN_Y + cy * SH;
	return [cx * SW / W, 1 - (y + SH) / H, (cx + 1) * SW / W, 1 - y / H];
}

// the garments on their strips (garments: four to a strip, cut out round them, each on its
// hanger): its cut (estab-kit.js CUTS: what the clothes hung behind it are) and its colour (srgb)
// and how far it hangs, in pixels of its 96 (from its shoulders, 15 down, to its hem)
export const GARMENTS = [
	['tee', 'tee', '#f2f0ea', 52], ['graphic', 'tee', '#1b1b1d', 52], ['stripes', 'tee', '#f4f1e8', 52], ['polo', 'tee', '#1f5f4a', 52],
	['oxford', 'shirt', '#bcd3ea', 60], ['flannel', 'shirt', '#9e2a2b', 60], ['blouse', 'shirt', '#e8c4c4', 60], ['sweater', 'knit', '#d9cdb4', 54],
	['cardigan', 'knit', '#b08a5a', 54], ['hoodie', 'knit', '#8d9096', 54], ['denim', 'coat', '#4f6f99', 58], ['bomber', 'coat', '#4d5434', 58],
	['trench', 'coat', '#b59a6d', 76], ['dress', 'dress', '#24365c', 74], ['jeans', 'jeans', '#2e4468', 78], ['skirt', 'jeans', '#6b3a5a', 46],
].map(([name, cut, c, len]) => ({ name, cut, c, len }));
// a garment's front on the sheet (the n-th of GARMENTS): its strip and its quarter of it
export const garmentAt = (n) => { const i = ((n % GARMENTS.length) + GARMENTS.length) % GARMENTS.length; return [i >> 2, (i & 3) / 4, ((i & 3) + 1) / 4]; };
// (a face-out's size: the quarter strip, 0.3 x 0.45 m of sheet, drawn 0.62 x 0.93 m)
export const GARMENT_W = 0.62, GARMENT_H = 0.93;

// ---------------------------------------------------------------------------------
// the painting
const prng = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
// whose goods each kind's are: a family of the brand catalog (signage/brand-catalog.js), its
// eight makers' marks on the family's sheet of emblems. A packet carries its maker's mark (on a
// pale label of its own where the packet is dark), and is printed in its maker's inks.
const MAKERS = {
	chips: 'snacks', candy: 'snacks', cookies: 'snacks', cereal: 'grains', cans: 'pantry', jars: 'pantry', dry: 'pasta', bread: 'bakery',
	soda: 'beverages', cancool: 'beverages', water: 'beverages', energy: 'beverages', beer: 'guild', wine: 'guild', spirits: 'guild',
	dairy: 'dairy', frozen: 'produce', laundry: 'cleaning', paper: 'cleaning', clean: 'cleaning', care: 'care', meds: 'care', vanity: 'care', clothes: 'apparel',
	auto: 'transport', pet: 'home', paint: 'hardware', tools: 'hardware', peg: 'hardware', tech: 'mobile', toys: 'retro',
	posters: ['coffee', 'beverages', 'bakery', 'tea'], covers: 'books', crates: 'produce', beans: 'coffee', mugs: 'coffee', trays: 'snacks', fountain: 'beverages', notices: 'network',
	films: 'network', marquee: 'orbital', popcorn: 'snacks', inks: 'fae', garments: 'apparel',
};
// the families' sheets while the goods are painted (the small sheets: a packet's mark is a few
// dozen pixels across), a few on their way at once, each let go once its kinds are painted
const LOGOS = new Map();
let logosT0 = 0;
function logos(fam) {
	if (LOGOS.has(fam) || typeof Image === 'undefined') return LOGOS.get(fam);
	const img = new Image(), L = { img, ok: false, done: false, t: performance.now() };
	logosT0 ||= L.t;
	img.onload = () => { L.ok = true; L.done = true; };
	img.onerror = () => { L.done = true; };            // (its makers' names in type instead)
	img.decoding = 'async';
	img.src = new URL(`../assets/signage/brands-${fam}-v1-mobile.webp`, import.meta.url).href;
	LOGOS.set(fam, L);
	return L;
}
// (in, or given up on: four seconds a family, eight in all, and the shops are not kept waiting)
const logosIn = (fam) => { const L = logos(fam), t = performance.now(); return !L || L.done || t - L.t > 4000 || t - logosT0 > 8000; };
function letGo(fam) { const L = LOGOS.get(fam); if (L?.img) { L.img.onload = L.img.onerror = null; L.img = null; L.ok = false; L.done = true; } }
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
// a colour's channels (a '#rrggbb' or an 'rgb(r,g,b)'), how light it is, whether it is a strong one
function rgbOf(c) {
	if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
	return (c.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
}
const pale = (c) => { const [r, g, b] = rgbOf(c); return 0.3 * r + 0.59 * g + 0.11 * b > 165; };
const strong = (c) => { const q = rgbOf(c), hi = Math.max(...q); return hi - Math.min(...q) > 40 && hi > 50; };
// a colour made k times as bright (its hue kept), as '#rrggbb'
const lift = (c, k) => '#' + rgbOf(c).map((v) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, '0')).join('');
// a maker's mark, centred at x, y and fitted to w x h: straight onto what is under it where that is
// pale, else on a pale label of its own; its name in type if its sheet never came
function mark(g, S, x, y, w, h, under) {
	const L = S.logo, onPale = pale(under);
	if (!L) { word(g, S.n, x, y, w, Math.max(6, Math.min(h * 0.8, w * 0.3)), onPale ? S.ink : '#ffffff'); return; }
	const { m, t } = L, cw = L.img.naturalWidth / 4, ch = L.img.naturalHeight / 2;
	const sw = (m.x1 - m.x0) * cw, sh = (m.y1 - m.y0) * ch, k = Math.min(w / sw, h / sh), dw = sw * k, dh = sh * k;
	if (!onPale) { g.fillStyle = S.lab; rr(g, x - dw / 2 - 2, y - dh / 2 - 1.5, dw + 4, dh + 3, 2); g.fill(); }
	g.drawImage(L.img, (t % 4) * cw + m.x0 * cw, Math.floor(t / 4) * ch + m.y0 * ch, sw, sh, x - dw / 2, y - dh / 2, dw, dh);
}
// a maker, as mark() takes it: its family's t-th, its inks
function maker(fam, t) {
	const M = brandMark(fam, t), L = LOGOS.get(fam);
	return { n: brandName(fam, t), ink: M?.ink || '#222222', lab: '#fbf8f0', logo: M && L?.ok ? { img: L.img, m: M, t } : null };
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
		mark(g, S, x + bw / 2, b - h * 0.5, bw * 0.78, h * 0.42, S.c);
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
		g.fillStyle = S.lab; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.3, w * 0.44, h * 0.15, -0.15, 0, Math.PI * 2); g.fill();
		mark(g, S, x + w / 2, y + h * 0.3, w * 0.7, h * 0.2, S.lab);
		g.fillStyle = S.f; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x + w * (0.3 + 0.13 * i), b - h * 0.24 + (i % 2) * 2, w * 0.13, h * 0.06, i, 0, Math.PI * 2); g.fill(); }
		roundShade(g, x + 1, w - 2, y + 3, h - 5, 0.32);
	},
	box(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y, w, h);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.18, w, h * 0.2);
		mark(g, S, x + w / 2, y + h * 0.28, w * 0.84, Math.min(h * 0.2, w * 0.5), S.a);
		if (h > w * 0.9) { g.fillStyle = S.f; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.66, w * 0.33, h * 0.16, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = S.l; g.beginPath(); g.ellipse(x + w / 2, y + h * 0.7, w * 0.36, h * 0.09, 0, 0, Math.PI); g.fill(); }
		else { g.fillStyle = S.f; g.fillRect(x + w * 0.15, y + h * 0.5, w * 0.7, h * 0.32); }
		flatShade(g, x, w, y, h);
	},
	can(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y + 2, w, h - 3);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.35, w, h * 0.3);
		if (w > 9) mark(g, S, x + w / 2, y + h * 0.5, w * 0.86, h * 0.26, S.a);
		g.fillStyle = '#b8bcc0'; g.fillRect(x + 1, y, w - 2, 3); g.fillRect(x + 1, b - 2, w - 2, 2);
		roundShade(g, x, w, y, h, 0.5);
	},
	bottle(g, x, b, w, h, S) {
		const y = b - h, nw = Math.max(3, w * 0.34), cx = x + w / 2;
		g.fillStyle = S.k2 || S.a; g.fillRect(cx - nw / 2, y, nw, h * 0.08);                      // the cap
		g.fillStyle = S.liq; g.fillRect(cx - nw / 2, y + h * 0.08, nw, h * 0.16);
		g.beginPath(); g.moveTo(cx - nw / 2, y + h * 0.24); g.quadraticCurveTo(x, y + h * 0.3, x, y + h * 0.42); g.lineTo(x, b - 1); g.lineTo(x + w, b - 1); g.lineTo(x + w, y + h * 0.42); g.quadraticCurveTo(x + w, y + h * 0.3, cx + nw / 2, y + h * 0.24); g.closePath(); g.fill();
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.5, w, h * 0.26);
		if (w > 9) mark(g, S, cx, y + h * 0.63, w * 0.84, h * 0.22, S.c);
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
		mark(g, S, x + w / 2, y + h * 0.6, w * 0.72, h * 0.3, S.a);
		roundShade(g, x, w, y + h * 0.16, h * 0.84, 0.38);
	},
	jar(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.k2 || '#d0d0d0'; g.fillRect(x + 1, y, w - 2, h * 0.16);
		g.fillStyle = S.liq; rr(g, x, y + h * 0.14, w, h * 0.86, 3); g.fill();
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.36, w, h * 0.42);
		mark(g, S, x + w / 2, y + h * 0.57, w * 0.82, h * 0.36, S.c);
		roundShade(g, x, w, y, h, 0.45);
	},
	carton(g, x, b, w, h, S) {                    // a gable-top carton (milk, juice)
		const y = b - h;
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.18, w, h * 0.82);
		g.beginPath(); g.moveTo(x, y + h * 0.18); g.lineTo(x + w / 2, y + h * 0.04); g.lineTo(x + w, y + h * 0.18); g.fill();
		g.fillStyle = shade(S.c, 0.85); g.fillRect(x + w * 0.42, y, w * 0.16, h * 0.08);
		g.fillStyle = S.a; g.fillRect(x, y + h * 0.5, w, h * 0.24);
		mark(g, S, x + w / 2, y + h * 0.36, w * 0.84, h * 0.2, S.c);
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
		mark(g, S, x + w / 2, y + h * 0.42, w * 0.84, h * 0.3, S.c);
		flatShade(g, x, w, y + h * 0.18, h * 0.82);
	},
	sleeve(g, x, b, w, h, S) {                    // a packet lying (cookies, crackers)
		const y = b - h;
		g.fillStyle = S.c; rr(g, x, y, w, h, h * 0.3); g.fill();
		g.fillStyle = S.f; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + w * (0.6 + i * 0.12), y + h * 0.55, h * 0.26, 0, Math.PI * 2); g.fill(); }
		mark(g, S, x + w * 0.27, y + h * 0.5, w * 0.44, h * 0.72, S.c);
		g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 2, y + 2, w - 4, 2);
		g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 2, b - 3, w - 4, 2);
	},
	roll(g, x, b, w, h, S) {                      // paper rolls in their wrap
		const y = b - h, n = Math.max(1, Math.round(w / 14));
		for (let i = 0; i < n; i++) { g.fillStyle = '#f2f0ea'; rr(g, x + i * w / n, y, w / n - 1, h, 4); g.fill(); roundShade(g, x + i * w / n, w / n - 1, y, h, 0.3); }
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.3, w, h * 0.32);
		mark(g, S, x + w / 2, y + h * 0.46, w * 0.8, h * 0.28, S.c);
		g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y + 2, w, 2);
	},
	spray(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = S.k2 || '#ffffff'; g.fillRect(x + w * 0.25, y, w * 0.55, h * 0.12); g.fillRect(x + w * 0.05, y + h * 0.02, w * 0.3, h * 0.05);
		g.fillRect(x + w * 0.4, y + h * 0.12, w * 0.2, h * 0.12);
		g.fillStyle = S.liq; rr(g, x, y + h * 0.24, w, h * 0.76, w * 0.15); g.fill();
		g.fillStyle = S.c; g.fillRect(x + 1, y + h * 0.45, w - 2, h * 0.32);
		mark(g, S, x + w / 2, y + h * 0.61, w * 0.82, h * 0.26, S.c);
		roundShade(g, x, w, y + h * 0.24, h * 0.76, 0.35);
	},
	book(g, x, b, w, h, S, r) {                   // a spine: its bands, the title down it, the publisher at its foot
		const y = b - h, ink = pale(S.c) ? '#2b2d42' : '#f4f1de';
		g.fillStyle = S.c; g.fillRect(x, y, w, h);
		if (r() < 0.6) { g.fillStyle = S.a; g.fillRect(x, y + h * 0.06, w, h * 0.04); g.fillRect(x, b - h * 0.18, w, h * 0.04); }
		g.fillStyle = ink; g.globalAlpha = 0.85;
		g.fillRect(x + w * 0.38, y + h * 0.16, Math.max(1, w * 0.24), h * (0.34 + r() * 0.2));
		if (r() < 0.5) g.fillRect(x + w * 0.38, y + h * 0.66, Math.max(1, w * 0.24), h * 0.08);
		g.globalAlpha = 1;
		g.fillRect(x + w * 0.3, b - h * 0.1, w * 0.4, h * 0.04);
		g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + w - 1, y, 1, h);
		g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, 1, h);
	},
	folded(g, x, b, w, h, S) {                    // a stack of folded shirts
		const n = Math.max(3, Math.floor(h / 7));
		for (let i = 0; i < n; i++) {
			const y = b - (i + 1) * h / n;
			g.fillStyle = shade(S.c, 0.9 + (i % 2) * 0.12); rr(g, x, y, w, h / n, 2); g.fill();
			g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + h / n - 1, w, 1);
			g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x + 1, y + 1, w - 2, 1);
		}
		// the maker's label on the top one
		mark(g, S, x + w / 2, b - h + h / n * 0.5, w * 0.42, h / n * 0.62, S.c);
	},
	paintcan(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = '#bfc3c6'; g.fillRect(x, y + 2, w, h - 2);
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.2, w, h * 0.6);
		g.fillStyle = S.f; g.fillRect(x + w * 0.12, y + h * 0.48, w * 0.3, h * 0.26);
		mark(g, S, x + w / 2, y + h * 0.33, w * 0.8, h * 0.2, S.c);
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
		mark(g, S, x + w / 2, y + 6 + h * 0.09, w * 0.84, h * 0.16, S.a);
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
		mark(g, S, x + w / 2, y + h * 0.21, w * 0.84, h * 0.17, S.a);
		roundShade(g, x, w, y + 2, h - 2, 0.3);
	},
	loaf(g, x, b, w, h, S) {
		const y = b - h;
		g.fillStyle = '#c98b4a'; rr(g, x, y + h * 0.1, w, h * 0.9, h * 0.35); g.fill();
		g.fillStyle = 'rgba(255,255,255,0.55)'; rr(g, x, y + h * 0.1, w, h * 0.9, h * 0.35); g.fill();
		g.fillStyle = S.c; g.fillRect(x, y + h * 0.4, w, h * 0.3);
		g.fillStyle = S.a; g.fillRect(x + w * 0.85, y, w * 0.08, h * 0.2);
		mark(g, S, x + w / 2, y + h * 0.55, w * 0.72, h * 0.28, S.c);
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
// the new books' covers: [ground, type, picture], their titles and their authors (made up)
const COVERS = [['#1d3557', '#f1faee', '#e63946'], ['#f4f1de', '#3d405b', '#e07a5f'], ['#2a9d8f', '#ffffff', '#e9c46a'], ['#e9c46a', '#264653', '#f4a261'], ['#6d597a', '#ffffff', '#e56b6f'], ['#ffffff', '#111111', '#118ab2'],
	['#283618', '#fefae0', '#dda15e'], ['#bc4749', '#f2e8cf', '#386641'], ['#0b132b', '#ffd166', '#3a506b'], ['#ffcad4', '#3d405b', '#f4acb7'], ['#ffb703', '#023047', '#fb8500'], ['#edf2f4', '#2b2d42', '#ef233c']];
const TITLES = [['SALT', 'HOUR'], ['NORTH', 'OF MAY'], ['THE GLASS', 'BAY'], ['LOW TIDE'], ['PAPER', 'MOONS'], ['THE FOG', 'LINE'], ['GOLDEN', 'HILLS'], ['NIGHT', 'FERRY'], ['THE LONG', 'WALK'], ['ORCHARD', 'SONGS'], ['EAST OF', 'THE BRIDGE'], ['WILD', 'MINT']];
const AUTHORS = ['MAYA ORTEGA', 'J. L. HART', 'SAMIR NOOR', 'ELLEN VOSS', 'T. OKAFOR', 'RUTH CALDER', 'LEO MARSH', 'ANA SILVA', 'KENJI ROSS', 'NOOR HADDAD'];
// a grocer's produce, a crate of each: [its card, its colour, its size (px), its shape, its price]
// (ten crates on the sheet: the first ten)
const PRODUCE = [['APPLES', '#c1121f', 6, 'round', '1.99'], ['ORANGES', '#f77f00', 6.5, 'round', '1.49'], ['LEMONS', '#f7d117', 5.5, 'oval', '0.79'], ['LIMES', '#6a994e', 4.5, 'round', '0.50'],
	['TOMATOES', '#e63946', 6, 'round', '2.49'], ['AVOCADOS', '#3a5a40', 6, 'oval', '1.25'], ['LETTUCE', '#80b918', 13, 'leafy', '1.99'], ['BANANAS', '#f9d423', 8, 'banana', '0.69'],
	['ONIONS', '#c9a66b', 6, 'round', '1.29'], ['POTATOES', '#b08968', 6, 'oval', '0.99'], ['PEPPERS', '#d62828', 6.5, 'round', '2.99'], ['PEARS', '#a7c957', 6, 'oval', '2.29']];
// one piece of produce, seen from above
function fruit(g, form, x, y, s, c, r) {
	g.fillStyle = c;
	if (form === 'banana') {
		g.strokeStyle = c; g.lineWidth = s * 0.55; g.lineCap = 'round';
		const a = r() * Math.PI * 2;
		for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + Math.cos(a) * i * 2, y + Math.sin(a) * i * 2, s, a, a + 1.8); g.stroke(); }
		g.lineCap = 'butt';
		return;
	}
	g.beginPath();
	if (form === 'oval') g.ellipse(x, y, s * 1.25, s * 0.85, r() * Math.PI, 0, Math.PI * 2);
	else g.arc(x, y, s, 0, Math.PI * 2);
	g.fill();
	g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1; g.stroke();
	if (form === 'leafy') {
		g.strokeStyle = 'rgba(230,255,200,0.45)';
		for (let i = 0; i < 5; i++) { const a = i * 1.26 + r(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.4) * s * 0.6, y + Math.sin(a + 0.4) * s * 0.6, x + Math.cos(a) * s * 0.95, y + Math.sin(a) * s * 0.95); g.stroke(); }
	}
	g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - s * 0.32, y - s * 0.32, s * 0.32, 0, Math.PI * 2); g.fill();
}
// a flyer pinned to a board, centred at x, y: a maker's (its mark, two lines), or a neighbour's (its
// line, lines of writing, the tear-off tabs)
function flyer(g, x, y, w, h, F, r) {
	g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.14);
	g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-w / 2 + 1.5, -h / 2 + 1.5, w, h);
	g.fillStyle = F.bg; g.fillRect(-w / 2, -h / 2, w, h);
	if (F.fam) {
		const S = maker(F.fam, F.t);
		g.fillStyle = lift(S.ink, 1.6); g.fillRect(-w / 2, h / 2 - 8, w, 8);
		mark(g, S, 0, -h * 0.22, w * 0.82, h * 0.3, F.bg);
		word(g, F.line, 0, h * 0.12, w * 0.86, 6, '#1d1d1d');
		word(g, 'call today', 0, h * 0.27, w * 0.8, 4.5, '#444', false);
	} else {
		word(g, F.line, 0, -h / 2 + 7, w * 0.88, 6, '#1d1d1d');
		if (F.cat) { g.fillStyle = '#222'; g.beginPath(); g.arc(0, -h * 0.05, w * 0.16, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(-w * 0.15, -h * 0.1); g.lineTo(-w * 0.1, -h * 0.25); g.lineTo(-w * 0.02, -h * 0.14); g.moveTo(w * 0.15, -h * 0.1); g.lineTo(w * 0.1, -h * 0.25); g.lineTo(w * 0.02, -h * 0.14); g.fill(); }
		else { g.fillStyle = 'rgba(40,40,60,0.55)'; for (let i = 0; i < 4; i++) g.fillRect(-w * 0.38, -h / 2 + 13 + i * 5, w * (0.5 + r() * 0.26), 1.2); }
		g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6;
		for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(-w / 2 + i * w / 6, h / 2 - 11); g.lineTo(-w / 2 + i * w / 6, h / 2); g.stroke(); }
		g.beginPath(); g.moveTo(-w / 2, h / 2 - 11); g.lineTo(w / 2, h / 2 - 11); g.stroke();
	}
	g.fillStyle = F.pin; g.beginPath(); g.arc(0, -h / 2 + 2.5, 2, 0, Math.PI * 2); g.fill();
	g.restore();
}
// a maker's poster: its colour, its mark large on a pale disc, its line
function poster(g, x, y, w, h, fam, t, line) {
	const S = maker(fam, t), c = strong(S.ink) ? lift(S.ink, 1.35) : lift(S.ink, 2.4);
	g.fillStyle = c; g.fillRect(x, y, w, h);
	g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x + w * 0.85, y + h * 0.15, Math.min(w, h) * 0.5, 0, Math.PI * 2); g.fill();
	const d = Math.min(w * 0.8, h * 0.62);
	g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(x + w / 2, y + h * 0.42, d / 2, 0, Math.PI * 2); g.fill();
	mark(g, S, x + w / 2, y + h * 0.42, d * 0.8, d * 0.5, '#fbf8f0');
	word(g, line, x + w / 2, y + h * 0.86, w * 0.86, Math.max(6, h * 0.08), '#ffffff');
}
// a painted print: 0 the hills under the sun, 1 the bay and its bridge, 2 a leaf, 3 shapes
function scene(g, x, y, w, h, k, r) {
	g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
	if (k === 0 || k === 1) {
		const sky = g.createLinearGradient(0, y, 0, y + h); sky.addColorStop(0, k ? '#9cc5d9' : '#f4c27a'); sky.addColorStop(1, k ? '#e8eef0' : '#f7e3c0');
		g.fillStyle = sky; g.fillRect(x, y, w, h);
		g.fillStyle = k ? '#f1f1e8' : '#e76f51'; g.beginPath(); g.arc(x + w * 0.7, y + h * 0.35, h * 0.14, 0, Math.PI * 2); g.fill();
		const bands = k ? ['#6b8f71', '#3d5a6c', '#2a3d4f'] : ['#c9a46b', '#8a9a5b', '#4f6d3a'];
		bands.forEach((c, i) => {
			g.fillStyle = c; g.beginPath(); g.moveTo(x, y + h);
			for (let u = 0; u <= 1.001; u += 0.1) g.lineTo(x + u * w, y + h * (0.55 + i * 0.13) - Math.sin(u * 3 + i * 2 + r()) * h * 0.07);
			g.lineTo(x + w, y + h); g.fill();
		});
		if (k) {
			g.strokeStyle = '#c0362c'; g.lineWidth = 2;
			for (const tx of [0.3, 0.62]) { g.beginPath(); g.moveTo(x + w * tx, y + h * 0.78); g.lineTo(x + w * tx, y + h * 0.3); g.stroke(); }
			g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + h * 0.66); g.quadraticCurveTo(x + w * 0.3, y + h * 0.32, x + w * 0.46, y + h * 0.6); g.quadraticCurveTo(x + w * 0.62, y + h * 0.32, x + w, y + h * 0.66); g.stroke();
			g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + h * 0.66); g.lineTo(x + w, y + h * 0.66); g.stroke();
		}
	} else if (k === 2) {
		g.fillStyle = '#f2ede1'; g.fillRect(x, y, w, h);
		g.fillStyle = '#4f772d'; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.12); g.quadraticCurveTo(x + w * 0.95, y + h * 0.45, x + w / 2, y + h * 0.88); g.quadraticCurveTo(x + w * 0.05, y + h * 0.45, x + w / 2, y + h * 0.12); g.fill();
		g.strokeStyle = '#d8e2c4'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.15); g.lineTo(x + w / 2, y + h * 0.92); g.stroke();
		for (let i = 1; i < 6; i++) for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(x + w / 2, y + h * (0.2 + i * 0.11)); g.lineTo(x + w / 2 + sx * w * 0.25, y + h * (0.12 + i * 0.11)); g.stroke(); }
	} else {
		g.fillStyle = '#efe6d8'; g.fillRect(x, y, w, h);
		const cs = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'];
		for (let i = 0; i < 4; i++) { g.fillStyle = cs[i]; if (i % 2) g.fillRect(x + w * (0.1 + r() * 0.4), y + h * (0.1 + i * 0.2), w * 0.45, h * 0.18); else { g.beginPath(); g.arc(x + w * (0.3 + r() * 0.4), y + h * (0.2 + i * 0.2), w * 0.22, 0, Math.PI * 2); g.fill(); } }
	}
	g.restore();
}
// the films showing: the title (two lines), the line over it, the sky's two colours, the title's
const FILMS = [
	['FOG', 'CITY', 'THE BAY KEEPS ITS SECRETS', '#1b263b', '#e07a5f', '#ffffff'], ['LAST', 'FERRY', 'ONE NIGHT. ONE WAY HOME.', '#0b132b', '#3a506b', '#ffd166'],
	['STAR', 'HARBOR', 'BEYOND THE GOLDEN GATE', '#10002b', '#5a189a', '#e0aaff'], ['THE', 'QUIET HILL', 'SOME DOORS STAY SHUT', '#2b2d42', '#8d99ae', '#edf2f4'],
	['REDLINE', '', 'NO BRAKES. NO RULES.', '#370617', '#dc2f02', '#ffba08'], ['ORBIT', '', 'HOME IS 400 KM DOWN', '#03071e', '#023e8a', '#90e0ef'],
	['SUMMER', 'OF 99', 'THE BEST YEAR EVER', '#ff9f1c', '#ffbf69', '#2b2d42'], ['DRAGON', 'GATE', 'THE LEGEND AWAKENS', '#1a1a1a', '#9d0208', '#f48c06'],
];
// the arcade's machines: the game on each marquee, its two colours and its title's (the first
// eight video games, then the pinball's, the skee-ball's, the claw's, the hoops')
export const MARQUEES = [
	['THE JOUST', '#ffbe0b', '#fb5607', '#ffffff'], ['STAR RAIDER', '#3a0ca3', '#7209b7', '#4cc9f0'], ['MAGMA BALL', '#d00000', '#370617', '#ffba08'], ['ROBO RUMBLE', '#2b9348', '#004b23', '#eeef20'],
	['NEON DRIFT', '#ff006e', '#3a0ca3', '#ffffff'], ['GALAXIA', '#03045e', '#0077b6', '#ffd60a'], ['TURBO 99', '#111111', '#e63946', '#f1faee'], ['DRAGON GATE', '#6a040f', '#1a1a1a', '#f48c06'],
	['SILVER BALL', '#ffd60a', '#d00000', '#111111'], ['SKEE-BALL', '#06a77d', '#073b4c', '#ffffff'], ['CLAW KING', '#ef476f', '#7b2cbf', '#ffffff'], ['HOOP FEVER', '#f77f00', '#1d3557', '#ffffff'],
];
// big letters with a dark edge round them, fitted to w
function title(g, s, x, y, w, size, col, edge = '#111111') {
	g.save(); g.font = `900 ${size}px "Arial Black", Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
	const m = g.measureText(s).width;
	g.translate(x, y); if (m > w) g.scale(w / m, 1);
	g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, size * 0.18); g.strokeStyle = edge; g.strokeText(s, 0, 0);
	g.fillStyle = col; g.fillText(s, 0, 0);
	g.restore();
}
const WHOLE = {
	// four new books' covers: the picture, the title, the author, the publisher's mark at the foot
	covers(g, x0, y0, n) {
		const CW = TW / 4;
		for (let i = 0; i < 4; i++) {
			const k = n * 4 + i, x = x0 + i * CW, y = y0, [bg, ink, acc] = COVERS[k % COVERS.length];
			g.fillStyle = bg; g.fillRect(x, y, CW, TH);
			g.fillStyle = acc; g.strokeStyle = acc; g.beginPath();
			switch (k % 5) {
				case 0: g.arc(x + CW / 2, y + TH * 0.56, CW * 0.26, 0, Math.PI * 2); g.fill(); break;
				case 1: g.moveTo(x, y + TH * 0.76); g.lineTo(x + CW * 0.35, y + TH * 0.46); g.lineTo(x + CW * 0.6, y + TH * 0.62); g.lineTo(x + CW * 0.8, y + TH * 0.5); g.lineTo(x + CW, y + TH * 0.66); g.lineTo(x + CW, y + TH * 0.78); g.lineTo(x, y + TH * 0.78); g.fill(); break;
				case 2: for (let j = 0; j < 4; j++) g.fillRect(x, y + TH * (0.42 + j * 0.08), CW, TH * 0.04); break;
				case 3: g.lineWidth = 2; g.strokeRect(x + 6, y + 6, CW - 12, TH - 12); g.fillRect(x + CW * 0.3, y + TH * 0.46, CW * 0.4, CW * 0.4); break;
				default: g.moveTo(x, y + TH); g.lineTo(x + CW, y + TH * 0.36); g.lineTo(x + CW, y + TH); g.fill();
			}
			const [t1, t2] = TITLES[k % TITLES.length];
			word(g, t1, x + CW / 2, y + TH * 0.14, CW - 10, 11, ink);
			if (t2) word(g, t2, x + CW / 2, y + TH * 0.26, CW - 10, 11, ink);
			word(g, AUTHORS[(k * 3) % AUTHORS.length], x + CW / 2, y + TH * 0.85, CW - 12, 6, ink, false);
			mark(g, maker('books', k % 8), x + CW / 2, y + TH * 0.94, CW * 0.4, 5, bg);
			g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y, 2, TH);
			g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 2, y, 1, TH);
		}
	},
	// five crates of produce from above: the slatted rim, the fruit heaped, the grower's card on the
	// front rim and the price on its stick
	crates(g, x0, y0, n, r) {
		const CW = TW / 5;
		for (let i = 0; i < 5; i++) {
			const k = n * 5 + i, [name, col, rad, form, price] = PRODUCE[k % PRODUCE.length], x = x0 + i * CW, y = y0;
			g.fillStyle = '#9c6b3f'; g.fillRect(x, y, CW, TH);
			g.fillStyle = 'rgba(0,0,0,0.3)'; for (let j = 1; j < 3; j++) g.fillRect(x, y + j * TH / 3, CW, 1);
			g.fillStyle = '#4a2e17'; g.fillRect(x + 4, y + 4, CW - 8, TH - 8);
			g.save(); g.beginPath(); g.rect(x + 3, y + 3, CW - 6, TH - 6); g.clip();
			const step = rad * 1.65;
			for (let row = 0, yy = y + 4; yy < y + TH - 1; yy += step * 0.86, row++) for (let xx = x + 4 + (row % 2) * step / 2; xx < x + CW - 1; xx += step) fruit(g, form, xx + (r() - 0.5) * rad * 0.5, yy + (r() - 0.5) * rad * 0.5, rad * (0.88 + r() * 0.22), shade(col, 0.8 + r() * 0.35), r);
			g.restore();
			mark(g, maker('produce', k % 8), x + CW / 2, y + TH - 6, CW * 0.66, 7, '#4a2e17');
			g.fillStyle = '#ffffff'; g.fillRect(x + CW - 25, y + 5, 21, 14);
			word(g, name, x + CW - 14.5, y + 9, 19, 5, '#222222', false);
			word(g, '$' + price, x + CW - 14.5, y + 15, 19, 6, '#c1121f');
		}
	},
	// two fast-food trays from above: the tray, its liner printed with a snack maker's marks, the
	// burger opened in its wrapper, the fries in the maker's carton, the cup's lid and straw, ketchup
	trays(g, x0, y0, n, r) {
		for (let i = 0; i < 2; i++) {
			const k = n * 2 + i, x = x0 + i * 128, y = y0, S = maker('snacks', (k * 3) % 8);
			g.fillStyle = ['#8c1c13', '#5e3023', '#b5121b', '#3d405b'][k % 4]; rr(g, x + 2, y + 2, 124, 92, 9); g.fill();
			g.fillStyle = 'rgba(255,255,255,0.14)'; rr(g, x + 5, y + 5, 118, 86, 7); g.fill();
			g.fillStyle = '#fbf6ea'; g.fillRect(x + 11, y + 10, 106, 76);
			g.globalAlpha = 0.3; for (let j = 0; j < 6; j++) mark(g, S, x + 29 + (j % 3) * 35, y + 20 + Math.floor(j / 3) * 56, 28, 9, '#fbf6ea'); g.globalAlpha = 1;
			// the burger, its wrapper open under it
			g.fillStyle = '#efe0c2'; g.beginPath(); g.moveTo(x + 16, y + 30); g.lineTo(x + 56, y + 18); g.lineTo(x + 68, y + 62); g.lineTo(x + 24, y + 74); g.closePath(); g.fill();
			g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; g.stroke();
			g.fillStyle = '#5a2d14'; g.beginPath(); g.arc(x + 42, y + 47, 17, 0, Math.PI * 2); g.fill();
			g.fillStyle = '#d9973d'; g.beginPath(); g.arc(x + 42, y + 46, 15.5, 0, Math.PI * 2); g.fill();
			g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.arc(x + 37, y + 41, 6, 0, Math.PI * 2); g.fill();
			g.fillStyle = '#f7e1b5'; for (let j = 0; j < 9; j++) g.fillRect(x + 32 + r() * 20, y + 37 + r() * 18, 2, 1.2);
			// the fries in their carton, the maker's mark on its front
			g.fillStyle = S.ink === '#222222' ? '#c1121f' : lift(S.ink, 1.4); g.beginPath(); g.moveTo(x + 72, y + 52); g.lineTo(x + 100, y + 52); g.lineTo(x + 97, y + 80); g.lineTo(x + 75, y + 80); g.closePath(); g.fill();
			g.fillStyle = '#f2c14e'; for (let j = 0; j < 12; j++) { const fx = x + 74 + j * 2.1; g.fillRect(fx, y + 40 + r() * 8, 2, 16); }
			g.fillStyle = 'rgba(160,100,20,0.5)'; for (let j = 0; j < 6; j++) g.fillRect(x + 75 + j * 4, y + 42 + r() * 6, 1, 12);
			mark(g, S, x + 86, y + 68, 20, 10, '#c1121f');
			// the cup: its lid, the dome's ring, the straw; the ketchup
			g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 98, y + 26, 14, 0, Math.PI * 2); g.fill();
			g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); g.arc(x + 98, y + 26, 10, 0, Math.PI * 2); g.stroke();
			g.strokeStyle = '#e63946'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 98, y + 26); g.lineTo(x + 110, y + 14); g.stroke();
			g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 112, y + 74, 6, 0, Math.PI * 2); g.fill();
			g.fillStyle = '#b3261e'; g.beginPath(); g.arc(x + 112, y + 74, 4.2, 0, Math.PI * 2); g.fill();
		}
	},
	// a drinks fountain's front: six makers' badges, lit, each over its nozzle and lever; the grate
	fountain(g, x0, y0, n) {
		const B = g.createLinearGradient(0, y0, 0, y0 + TH); B.addColorStop(0, '#30353a'); B.addColorStop(1, '#141618');
		g.fillStyle = B; g.fillRect(x0, y0, TW, TH);
		for (let i = 0; i < 6; i++) {
			const S = maker('beverages', (n * 3 + i) % 8), x = x0 + 5 + i * 41.5, w = 37;
			g.fillStyle = lift(S.ink, S.ink === '#222222' ? 4 : 1.5); rr(g, x, y0 + 5, w, 45, 4); g.fill();
			g.fillStyle = '#fbf8f0'; rr(g, x + 3, y0 + 8, w - 6, 30, 3); g.fill();
			mark(g, S, x + w / 2, y0 + 23, w - 10, 22, '#fbf8f0');
			g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 3, y0 + 41, w - 6, 5);
			g.fillStyle = '#a3aab1'; rr(g, x + w / 2 - 7, y0 + 54, 14, 12, 2); g.fill();
			g.fillStyle = '#2a2e32'; g.fillRect(x + w / 2 - 3, y0 + 66, 6, 7);
			g.fillStyle = '#cfd4d9'; g.fillRect(x + w / 2 - 9, y0 + 75, 18, 3);
		}
		g.fillStyle = '#5c636a'; g.fillRect(x0, y0 + TH - 11, TW, 11);
		g.fillStyle = '#25292d'; for (let x = x0 + 3; x < x0 + TW; x += 5) g.fillRect(x, y0 + TH - 9, 2, 7);
	},
	// a notice board: cork in its frame, the flyers pinned up (an internet maker's or two, rooms to
	// rent, a lost cat, lessons, a yard sale, a dog walker)
	notices(g, x0, y0, n, r) {
		g.fillStyle = '#b5835a'; g.fillRect(x0, y0, TW, TH);
		for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,50,20,0.3)' : 'rgba(255,230,190,0.2)'; g.fillRect(x0 + r() * TW, y0 + r() * TH, 1.5, 1.5); }
		g.fillStyle = '#5b3c22'; g.fillRect(x0, y0, TW, 4); g.fillRect(x0, y0 + TH - 4, TW, 4); g.fillRect(x0, y0, 4, TH); g.fillRect(x0 + TW - 4, y0, 4, TH);
		const F = [
			{ fam: 'network', t: 0, line: 'FAST FIBER', bg: '#ffffff' }, { line: 'ROOM FOR RENT', bg: '#fff3b0' }, { line: 'LOST CAT', cat: true, bg: '#ffffff' },
			{ fam: 'network', t: 4, line: 'NOW IN YOUR AREA', bg: '#eef6f8' }, { line: 'GUITAR LESSONS', bg: '#d8f3dc' }, { line: 'YARD SALE SAT', bg: '#ffd6e0' }, { line: 'DOG WALKER', bg: '#ffffff' },
		];
		F.forEach((f, i) => flyer(g, x0 + 22 + i * 35.5, y0 + 46 + (i % 2 ? 6 : -4), 30, 58 + (i % 3) * 6, { ...f, pin: ['#d62828', '#1d6fd1', '#06a77d', '#ffd60a'][i % 4] }, r));
	},
	// the pictures for a café's or a restaurant's walls: two makers' posters across (a coffee
	// roaster's, a drinks maker's), two painted prints across (the hills and the sun, the bay and
	// its bridge), and four up (a baker's poster, a tea maker's, a leaf, shapes)
	posters(g, x0, y0, n, r) {
		if (n === 0) { poster(g, x0, y0, 128, TH, 'coffee', 2, 'ROASTED DOWN THE ROAD'); poster(g, x0 + 128, y0, 128, TH, 'beverages', 0, 'ICE COLD, ALWAYS'); }
		else if (n === 1) { scene(g, x0, y0, 128, TH, 0, r); scene(g, x0 + 128, y0, 128, TH, 1, r); }
		else { poster(g, x0, y0, 64, TH, 'bakery', 4, 'BAKED AT DAWN'); poster(g, x0 + 64, y0, 64, TH, 'tea', 1, 'STEEP SLOW'); scene(g, x0 + 128, y0, 64, TH, 2, r); scene(g, x0 + 192, y0, 64, TH, 3, r); }
	},
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
	// four film posters: the picture (a skyline under the moon, a figure on a ridge against the sun,
	// a ringed planet in the stars, a road running into the dusk), the line over it, the title big,
	// the billing block and the studio's mark at the foot
	films(g, x0, y0, n, r) {
		const CW = TW / 4;
		for (let i = 0; i < 4; i++) {
			const k = n * 4 + i, x = x0 + i * CW, y = y0, [t1, t2, line, a, b, c] = FILMS[k % FILMS.length];
			g.save(); g.beginPath(); g.rect(x, y, CW, TH); g.clip();
			const sky = g.createLinearGradient(0, y, 0, y + TH); sky.addColorStop(0, a); sky.addColorStop(0.55, b); sky.addColorStop(1, '#050505');
			g.fillStyle = sky; g.fillRect(x, y, CW, TH);
			const hz = y + TH * 0.5;
			switch (k % 4) {
				case 0:
					g.fillStyle = 'rgba(255,255,240,0.9)'; g.beginPath(); g.arc(x + CW * 0.7, y + TH * 0.2, 7, 0, Math.PI * 2); g.fill();
					g.fillStyle = '#0a0a0f';
					for (let bx = x; bx < x + CW; bx += 5 + r() * 6) { const bh = 6 + r() * 22; g.fillRect(bx, hz - bh, 4 + r() * 5, bh + TH * 0.5); }
					g.fillStyle = 'rgba(255,214,102,0.8)'; for (let j = 0; j < 14; j++) g.fillRect(x + r() * CW, hz - r() * 20, 1, 1.4);
					break;
				case 1:
					g.fillStyle = 'rgba(255,200,120,0.95)'; g.beginPath(); g.arc(x + CW / 2, hz - 4, 15, 0, Math.PI * 2); g.fill();
					g.fillStyle = '#0a0a0f'; g.beginPath(); g.moveTo(x, hz + 6); g.quadraticCurveTo(x + CW / 2, hz - 8, x + CW, hz + 4); g.lineTo(x + CW, y + TH); g.lineTo(x, y + TH); g.fill();
					g.fillRect(x + CW / 2 - 1.5, hz - 14, 3, 10); g.beginPath(); g.arc(x + CW / 2, hz - 16, 2.2, 0, Math.PI * 2); g.fill();
					break;
				case 2:
					g.fillStyle = '#ffffff'; for (let j = 0; j < 30; j++) g.fillRect(x + r() * CW, y + r() * TH * 0.6, 0.8, 0.8);
					g.fillStyle = c; g.beginPath(); g.arc(x + CW * 0.45, y + TH * 0.32, 11, 0, Math.PI * 2); g.fill();
					g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x + CW * 0.45, y + TH * 0.32, 19, 4, -0.3, 0, Math.PI * 2); g.stroke();
					break;
				default:
					g.fillStyle = '#16161c'; g.beginPath(); g.moveTo(x + CW / 2 - 2, hz); g.lineTo(x + CW / 2 + 2, hz); g.lineTo(x + CW * 0.9, y + TH); g.lineTo(x + CW * 0.1, y + TH); g.fill();
					g.strokeStyle = '#ffd166'; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x + CW / 2, hz); g.lineTo(x + CW / 2, y + TH); g.stroke(); g.setLineDash([]);
					g.fillStyle = '#ff4d4d'; g.fillRect(x + CW / 2 - 6, hz + 18, 3, 1.6); g.fillRect(x + CW / 2 + 3, hz + 18, 3, 1.6);
			}
			word(g, line, x + CW / 2, y + 5, CW - 6, 4.5, 'rgba(255,255,255,0.85)', false);
			title(g, t1, x + CW / 2, y + TH * (t2 ? 0.63 : 0.68), CW - 6, 12, c, '#050505');
			if (t2) title(g, t2, x + CW / 2, y + TH * 0.74, CW - 8, 9, c, '#050505');
			g.fillStyle = 'rgba(255,255,255,0.5)'; for (let j = 0; j < 3; j++) g.fillRect(x + 6, y + TH * 0.83 + j * 2.6, CW - 12, 0.9);
			mark(g, maker('network', k % 8), x + CW / 2, y + TH * 0.93, CW * 0.36, 5, '#000000');
			g.restore();
		}
	},
	// six arcade marquees, two across and three down: the colours, the rays, the game's name, its maker
	marquee(g, x0, y0, n) {
		for (let i = 0; i < 6; i++) {
			const k = n * 6 + i, x = x0 + (i % 2) * TW / 2, y = y0 + Math.floor(i / 2) * TH / 3, w = TW / 2, h = TH / 3, [t, a, b, c] = MARQUEES[k % MARQUEES.length];
			g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
			const L = g.createLinearGradient(0, y, 0, y + h); L.addColorStop(0, a); L.addColorStop(1, b);
			g.fillStyle = L; g.fillRect(x, y, w, h);
			g.fillStyle = 'rgba(255,255,255,0.16)';
			for (let j = 0; j < 9; j++) { g.beginPath(); g.moveTo(x + w / 2, y + h * 1.4); g.lineTo(x + j * w / 8 - 3, y); g.lineTo(x + j * w / 8 + 4, y); g.fill(); }
			title(g, t, x + w / 2, y + h * 0.5, w - 22, 17, c);
			mark(g, maker('orbital', k % 8), x + w - 11, y + h - 5, 18, 5, b);
			g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
			g.restore();
		}
	},
	// a bowling alley's shoe cubbies: six across, three up, a pair in each (two-tone, its size on a tag)
	shoes(g, x0, y0, n) {
		g.fillStyle = '#4a3322'; g.fillRect(x0, y0, TW, TH);
		const cw = TW / 6, ch = TH / 3, tones = [['#c1121f', '#1d3557'], ['#2b2d42', '#e9c46a'], ['#6a994e', '#f1faee'], ['#1d6fd1', '#d62828'], ['#8d5524', '#f4f1de'], ['#111111', '#ef476f'], ['#f1faee', '#457b9d']];
		for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
			const x = x0 + col * cw, y = y0 + row * ch, [a, b] = tones[(n * 5 + row * 6 + col) % tones.length];
			g.fillStyle = '#140d08'; g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
			for (const s of [0, 1]) {
				const sx = x + 5 + s * (cw / 2 - 2), sw = cw / 2 - 7, sy = y + ch - 13;
				g.fillStyle = a; rr(g, sx, sy, sw, 9, 3); g.fill();
				g.fillStyle = b; g.fillRect(sx + sw * 0.32, sy + 0.5, sw * 0.36, 8);
				g.fillStyle = '#f2efe8'; g.fillRect(sx, sy + 8, sw, 2.4);
				g.fillStyle = 'rgba(255,255,255,0.75)'; for (let l = 0; l < 3; l++) g.fillRect(sx + sw * 0.42, sy + 1.5 + l * 2, sw * 0.16, 0.8);
			}
			g.fillStyle = '#fbf8f0'; g.fillRect(x + cw / 2 - 6, y + 4, 12, 7);
			word(g, String(5 + ((row * 6 + col + n * 3) % 9)), x + cw / 2, y + 7.8, 10, 6, '#111111');
			g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 2, y + 2, cw - 4, 1.5);
		}
	},
	// a popcorn machine's glass (the kettle hanging under its lamp, the corn heaped), then three
	// buckets of it on the counter, its maker's mark on each
	popcorn(g, x0, y0, n, r) {
		const w = TW / 2;
		const L = g.createLinearGradient(0, y0, 0, y0 + TH); L.addColorStop(0, '#ffe8b0'); L.addColorStop(0.35, '#a33a1e'); L.addColorStop(1, '#6b1f12');
		g.fillStyle = L; g.fillRect(x0, y0, w, TH);
		g.fillStyle = '#d4d7db'; g.beginPath(); g.ellipse(x0 + w / 2, y0 + 22, 24, 12, 0, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#8d9196'; g.fillRect(x0 + w / 2 - 2, y0, 4, 12); g.fillRect(x0 + w / 2 - 26, y0 + 20, 52, 3);
		const corn = ['#fff4d6', '#ffe8a3', '#fffaf0', '#f6d27a', '#ffffff'];
		for (let i = 0; i < 420; i++) {
			const px = x0 + 3 + r() * (w - 6), top = y0 + TH * 0.46 + Math.abs(px - x0 - w / 2) * 0.22, py = top + r() * (y0 + TH - top);
			g.fillStyle = pick(r, corn); g.beginPath(); g.arc(px, py, 1.6 + r() * 1.6, 0, Math.PI * 2); g.fill();
		}
		g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0 + 6, y0, 5, TH); g.fillRect(x0 + w - 16, y0, 3, TH);
		const B = g.createLinearGradient(0, y0, 0, y0 + TH); B.addColorStop(0, '#2b1712'); B.addColorStop(1, '#4a2a1e');
		g.fillStyle = B; g.fillRect(x0 + w, y0, w, TH);
		for (let i = 0; i < 3; i++) {
			const cx = x0 + w + 22 + i * 42, bw = i === 1 ? 36 : 30, bt = y0 + TH - (i === 1 ? 62 : 52), bb = y0 + TH - 4;
			for (let j = 0; j < 160; j++) { const a = r() * Math.PI, rad = r() * bw * 0.55; g.fillStyle = pick(r, corn); g.beginPath(); g.arc(cx + Math.cos(a) * rad, bt - Math.sin(a) * rad * 0.55, 1.5 + r() * 1.3, 0, Math.PI * 2); g.fill(); }
			g.save(); g.beginPath(); g.moveTo(cx - bw / 2, bt); g.lineTo(cx + bw / 2, bt); g.lineTo(cx + bw * 0.38, bb); g.lineTo(cx - bw * 0.38, bb); g.closePath(); g.clip();
			g.fillStyle = '#f7f3ea'; g.fillRect(cx - bw / 2, bt, bw, bb - bt);
			g.fillStyle = '#d62828'; for (let s = 0; s < 5; s++) g.fillRect(cx - bw / 2 + s * bw / 5 + bw / 20, bt, bw / 10, bb - bt);
			roundShade(g, cx - bw / 2, bw, bt, bb - bt, 0.35);
			g.restore();
			g.fillStyle = '#ffffff'; rr(g, cx - bw * 0.36, bt + (bb - bt) * 0.36, bw * 0.72, (bb - bt) * 0.3, 3); g.fill();
			mark(g, maker('snacks', 2), cx, bt + (bb - bt) * 0.51, bw * 0.62, (bb - bt) * 0.24, '#ffffff');
		}
	},
	// four framed certificates: the frame, the mat, the paper with its heading, its lines, its seal
	// and the signature
	// four garments facing out, each on its hanger, the sheet left clear round them (cut out):
	// the tee, the shirts, the knits, the jackets and the coat, the dress, the jeans, the skirt
	garments(g, x0, y0, n) {
		const CW = TW / 4;
		for (let i = 0; i < 4; i++) {
			const k = n * 4 + i, G = GARMENTS[k], x = x0 + i * CW, cx = x + CW / 2, sy = y0 + 15, c = G.c;
			g.save(); g.beginPath(); g.rect(x, y0, CW, TH); g.clip();
			// the hanger: its hook and its bar (a clip hanger for the jeans and the skirt)
			g.strokeStyle = '#9a9ca0'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx + 2, y0 + 5, 3, Math.PI, Math.PI * 2.4); g.stroke();
			g.beginPath(); g.moveTo(cx, y0 + 8); g.lineTo(cx, y0 + 11); g.stroke();
			const clip = G.cut === 'jeans';
			g.fillStyle = k % 3 ? '#1c1c1e' : '#8a6a48';
			if (clip) { g.fillRect(cx - 17, y0 + 11, 34, 2.5); g.fillStyle = '#b8babd'; g.fillRect(cx - 16, y0 + 12, 4, 5); g.fillRect(cx + 12, y0 + 12, 4, 5); }
			else { g.beginPath(); g.moveTo(cx, y0 + 10); g.lineTo(cx - 22, y0 + 17); g.lineTo(cx - 22, y0 + 19); g.lineTo(cx + 22, y0 + 19); g.lineTo(cx + 22, y0 + 17); g.closePath(); g.fill(); }
			const fill = (bw) => { const L = g.createLinearGradient(cx - bw, 0, cx + bw, 0); L.addColorStop(0, shade(c, 1.08)); L.addColorStop(0.5, c); L.addColorStop(1, shade(c, 0.8)); return L; };
			const dark = shade(c, 0.62), light = shade(c, 1.25);
			if (G.name === 'jeans' || G.name === 'skirt') {
				const top = sy + 2;
				g.fillStyle = fill(16); g.beginPath();
				if (G.name === 'jeans') { g.moveTo(cx - 14, top); g.lineTo(cx + 14, top); g.lineTo(cx + 16, top + 74); g.lineTo(cx + 2, top + 74); g.lineTo(cx, top + 26); g.lineTo(cx - 2, top + 74); g.lineTo(cx - 16, top + 74); }
				else { g.moveTo(cx - 13, top); g.lineTo(cx + 13, top); g.lineTo(cx + 22, top + 44); g.lineTo(cx - 22, top + 44); }
				g.closePath(); g.fill();
				g.fillStyle = dark; g.fillRect(cx - 14, top, 28, 4);
				g.strokeStyle = light; g.lineWidth = 0.6;
				if (G.name === 'jeans') {
					g.beginPath(); g.moveTo(cx, top + 4); g.lineTo(cx, top + 22); g.stroke();
					g.beginPath(); g.arc(cx - 10, top + 4, 6, 0, Math.PI / 2); g.stroke(); g.beginPath(); g.arc(cx + 10, top + 4, 6, Math.PI / 2, Math.PI); g.stroke();
					g.fillStyle = '#c9a227'; g.fillRect(cx - 1, top + 1, 2, 2);
				} else for (let j = -2; j <= 2; j++) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(cx + j * 5, top + 6); g.lineTo(cx + j * 8, top + 43); g.stroke(); }
				g.restore();
				continue;
			}
			// the cut: how wide, how long, the sleeves
			const coat = G.cut === 'coat', len = G.len;
			const bw = coat ? 18 : 16, long = !['tee', 'graphic', 'stripes', 'polo', 'dress'].includes(G.name);
			const body = () => {
				g.beginPath(); g.moveTo(cx - 6, sy); g.lineTo(cx - bw, sy + 3);
				if (G.name === 'dress') { g.lineTo(cx - 11, sy + 26); g.lineTo(cx - 22, sy + len); g.lineTo(cx + 22, sy + len); g.lineTo(cx + 11, sy + 26); }
				else { g.lineTo(cx - bw, sy + len); g.lineTo(cx + bw, sy + len); }
				g.lineTo(cx + bw, sy + 3); g.lineTo(cx + 6, sy); g.closePath();
			};
			const sleeves = () => {
				g.beginPath();
				for (const sx of [-1, 1]) {
					const ex = cx + sx * bw;
					if (long) { g.moveTo(ex, sy + 3); g.lineTo(ex + sx * 8, sy + 8); g.lineTo(ex + sx * 8, sy + len - 6); g.lineTo(ex + sx * 1, sy + len - 6); g.lineTo(ex - sx * 1, sy + 14); }
					else if (G.name !== 'dress') { g.moveTo(ex, sy + 3); g.lineTo(ex + sx * 10, sy + 9); g.lineTo(ex + sx * 6, sy + 19); g.lineTo(ex, sy + 16); }
					g.closePath();
				}
			};
			if (G.name === 'hoodie') { g.fillStyle = dark; g.beginPath(); g.ellipse(cx, sy + 1, 11, 8, 0, Math.PI, Math.PI * 2); g.fill(); }
			g.fillStyle = fill(bw + 8); sleeves(); g.fill();
			g.fillStyle = 'rgba(0,0,0,0.18)'; sleeves(); g.fill();
			g.fillStyle = fill(bw); body(); g.fill();
			// the pattern, inside the cut
			g.save(); body(); g.clip();
			if (G.name === 'stripes') { g.fillStyle = '#1d2a4a'; for (let y = sy + 6; y < sy + len; y += 6) g.fillRect(cx - bw, y, bw * 2, 2.4); }
			if (G.name === 'flannel') { g.fillStyle = 'rgba(10,10,10,0.38)'; for (let xx = cx - bw; xx < cx + bw; xx += 8) g.fillRect(xx, sy, 3, len); for (let y = sy; y < sy + len; y += 8) g.fillRect(cx - bw, y, bw * 2, 3); g.fillStyle = 'rgba(255,255,255,0.18)'; for (let xx = cx - bw + 5; xx < cx + bw; xx += 8) g.fillRect(xx, sy, 0.6, len); }
			if (G.name === 'dress') { g.fillStyle = 'rgba(255,240,245,0.75)'; for (let y = sy + 6; y < sy + len; y += 7) for (let xx = cx - 22 + ((y / 7) % 2) * 3.5; xx < cx + 22; xx += 7) { g.beginPath(); g.arc(xx, y, 1, 0, Math.PI * 2); g.fill(); } }
			if (G.cut === 'knit') { g.fillStyle = 'rgba(0,0,0,0.1)'; for (let xx = cx - bw + 1; xx < cx + bw; xx += 2.5) g.fillRect(xx, sy, 0.7, len); }
			g.restore();
			// a hem band and cuffs (the knits and the bomber ribbed), a fold or two in the cloth
			if (G.cut === 'knit' || G.name === 'bomber') { g.fillStyle = dark; g.fillRect(cx - bw, sy + len - 5, bw * 2, 5); for (const sx of [-1, 1]) g.fillRect(cx + sx * bw + (sx < 0 ? -8 : 1), sy + len - 10, 7, 4); }
			g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 0.8;
			g.beginPath(); g.moveTo(cx - bw + 5, sy + 12); g.quadraticCurveTo(cx - bw + 7, sy + len * 0.6, cx - bw + 4, sy + len - 2); g.stroke();
			g.beginPath(); g.moveTo(cx + bw - 6, sy + 16); g.quadraticCurveTo(cx + bw - 9, sy + len * 0.6, cx + bw - 5, sy + len - 2); g.stroke();
			// the neck: a crew, a v, a collar and its placket, a hood's strings, an open front
			g.fillStyle = dark; g.strokeStyle = dark; g.lineWidth = 1.2;
			switch (G.name) {
				case 'tee': case 'graphic': case 'stripes': case 'sweater':
					g.beginPath(); g.moveTo(cx - 6, sy); g.quadraticCurveTo(cx, sy + 6, cx + 6, sy); g.stroke(); break;
				case 'blouse':
					g.beginPath(); g.moveTo(cx - 6, sy); g.lineTo(cx, sy + 10); g.lineTo(cx + 6, sy); g.stroke(); break;
				case 'polo': case 'oxford': case 'flannel': case 'denim':
					g.fillStyle = shade(c, 0.85);
					for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx, sy + 3); g.lineTo(cx + sx * 7, sy - 1); g.lineTo(cx + sx * 5, sy + 7); g.closePath(); g.fill(); }
					g.fillStyle = shade(c, 0.7); g.fillRect(cx - 0.6, sy + 4, 1.2, G.name === 'polo' ? 10 : len - 4);
					g.fillStyle = G.name === 'denim' ? '#c9a227' : '#f4f1e8';
					for (let y = sy + 7; y < sy + (G.name === 'polo' ? 14 : len - 2); y += G.name === 'polo' ? 4 : 7) { g.beginPath(); g.arc(cx + 1.6, y, 0.9, 0, Math.PI * 2); g.fill(); }
					if (G.name !== 'polo') { g.strokeStyle = shade(c, 0.7); g.lineWidth = 0.7; g.strokeRect(cx - bw + 4, sy + 9, 7, 7); if (G.name === 'denim') g.strokeRect(cx + bw - 11, sy + 9, 7, 7); }
					break;
				case 'cardigan': case 'trench': case 'bomber':
					g.fillStyle = shade(c, 0.7); g.fillRect(cx - 0.8, sy + 2, 1.6, len - 2);
					g.beginPath(); g.moveTo(cx - 6, sy); g.lineTo(cx, sy + (G.name === 'trench' ? 16 : 10)); g.lineTo(cx + 6, sy); g.stroke();
					if (G.name === 'trench') { g.fillRect(cx - bw, sy + 28, bw * 2, 3); g.fillStyle = '#2b2118'; for (const sx of [-5, 5]) for (let y = sy + 12; y < sy + 26; y += 6) { g.beginPath(); g.arc(cx + sx, y, 1, 0, Math.PI * 2); g.fill(); } }
					else if (G.name === 'cardigan') { g.fillStyle = '#efe6d2'; for (let y = sy + 12; y < sy + len - 6; y += 7) { g.beginPath(); g.arc(cx + 2, y, 0.9, 0, Math.PI * 2); g.fill(); } }
					else { g.fillStyle = '#b8babd'; g.fillRect(cx - 0.4, sy + 6, 0.8, len - 10); g.fillStyle = dark; g.fillRect(cx - 7, sy - 1, 14, 3); }
					break;
				case 'hoodie':
					g.beginPath(); g.moveTo(cx - 6, sy); g.quadraticCurveTo(cx, sy + 6, cx + 6, sy); g.stroke();
					g.strokeStyle = '#e8e6e0'; g.lineWidth = 0.8; for (const sx of [-2.5, 2.5]) { g.beginPath(); g.moveTo(cx + sx, sy + 3); g.lineTo(cx + sx, sy + 15); g.stroke(); }
					g.fillStyle = shade(c, 0.86); g.beginPath(); g.moveTo(cx - 10, sy + 32); g.lineTo(cx + 10, sy + 32); g.lineTo(cx + 13, sy + 46); g.lineTo(cx - 13, sy + 46); g.closePath(); g.fill();
					break;
				case 'dress':
					g.beginPath(); g.moveTo(cx - 6, sy); g.quadraticCurveTo(cx, sy + 7, cx + 6, sy); g.stroke(); g.fillRect(cx - 11, sy + 24, 22, 2.5); break;
			}
			// the maker's mark: big on the graphic tee, small on the chest of the rest
			if (G.name === 'graphic') mark(g, maker('apparel', k % 8), cx, sy + 22, bw * 1.4, 14, c);
			else if (['tee', 'polo', 'sweater', 'hoodie', 'bomber'].includes(G.name)) mark(g, maker('apparel', (k * 3) % 8), cx + bw * 0.45, sy + 11, 8, 4, c);
			g.restore();
		}
	},
	certs(g, x0, y0, n, r) {
		const CW = TW / 4;
		for (let i = 0; i < 4; i++) {
			const x = x0 + i * CW, y = y0, k = n * 4 + i, ink = ['#8a6d1f', '#1d3557', '#6a040f', '#2d6a4f'][k % 4];
			g.fillStyle = ['#2b1d14', '#111111', '#3d2b1f', '#5c4033'][k % 4]; g.fillRect(x, y, CW, TH);
			g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, CW, 1.5); g.fillRect(x, y, 1.5, TH);
			g.fillStyle = '#efe7d4'; g.fillRect(x + 5, y + 5, CW - 10, TH - 10);
			g.fillStyle = '#fffaf0'; g.fillRect(x + 9, y + 10, CW - 18, TH - 20);
			g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(x + 11, y + 12, CW - 22, TH - 24);
			word(g, ['CERTIFICATE', 'DIPLOMA', 'LICENSE', 'AWARD'][k % 4], x + CW / 2, y + 20, CW - 28, 6, ink);
			g.fillStyle = 'rgba(40,40,40,0.55)'; for (let j = 0; j < 5; j++) { const lw = (CW - 34) * (j === 1 ? 0.9 : 0.5 + r() * 0.4); g.fillRect(x + CW / 2 - lw / 2, y + 29 + j * 7, lw, j === 1 ? 1.6 : 0.9); }
			g.fillStyle = '#c9a227'; g.beginPath(); g.arc(x + 20, y + TH - 22, 5, 0, Math.PI * 2); g.fill();
			g.fillStyle = '#b5161f'; g.beginPath(); g.moveTo(x + 17, y + TH - 18); g.lineTo(x + 15, y + TH - 12); g.lineTo(x + 19, y + TH - 14); g.fill(); g.beginPath(); g.moveTo(x + 23, y + TH - 18); g.lineTo(x + 25, y + TH - 12); g.lineTo(x + 21, y + TH - 14); g.fill();
			g.strokeStyle = '#1d3557'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + CW - 34, y + TH - 20);
			for (let s = 0; s < 6; s++) g.quadraticCurveTo(x + CW - 32 + s * 3, y + TH - 25 + (s % 2) * 7, x + CW - 30 + s * 3, y + TH - 20);
			g.stroke();
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
	vanity: { p: ['spray', 'jar', 'bottle'], w: [0.05, 0.075], h: [0.1, 0.19], f: [1, 2], open: true, foot: 1, liq: SOFT, ink: ['#ffffff', '#111111', '#e9edc9', '#cdb4db', '#2b2d42', '#f4f1de', '#ffc8dd'] },
	meds: { p: ['box', 'jar'], w: [0.06, 0.1], h: [0.1, 0.16], f: [3, 6], liq: ['#ffffff'], ink: ['#ffffff', '#f1faee', '#e0e1dd'] },
	auto: { p: ['jug', 'bottle'], w: [0.09, 0.14], h: [0.22, 0.3], f: [3, 5], liq: ['#111111', '#073b4c'], ink: ['#111111', '#ffd60a', '#1d6fd1', '#06a77d', '#d62828'] },
	pet: { p: 'sack', w: [0.3, 0.4], h: [0.34, 0.4], f: [1, 2], food: ['#ddb892', '#f6bd60', '#ffffff'] },
	paint: { p: 'paintcan', w: [0.16, 0.18], h: [0.18, 0.2], f: [3, 5], food: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#ffb703', '#8ac926', '#cdb4db'] },
	tools: { p: 'box', w: [0.18, 0.32], h: [0.14, 0.3], f: [1, 3], ink: ['#ffd60a', '#d62828', '#f77f00', '#118ab2', '#06a77d', '#111111'], food: ['#333333', '#555555'] },
	peg: { p: 'blister', w: [0.1, 0.16], h: [0.16, 0.26], f: [2, 4], peg: true, ink: ['#d62828', '#ffd60a', '#1d6fd1', '#f77f00', '#111111', '#06a77d'], food: ['#6c757d', '#adb5bd', '#343a40', '#c0a062'] },
	bins: { p: 'drawer', w: [0.08, 0.1], h: [0.07, 0.09], f: [5, 10], grid: true, ink: ['#e9c46a', '#219ebc', '#d62828', '#8d99ae'] },
	books: { p: 'book', w: [0.025, 0.05], h: [0.19, 0.27], f: [1, 2], ink: ['#7f1d1d', '#1e3a5f', '#0b6e4f', '#2b2d42', '#e9c46a', '#a44a3f', '#5c4d7d', '#f4f1de', '#d4a373', '#264653', '#e76f51'] },
	clothes: { p: 'folded', w: [0.26, 0.32], h: [0.18, 0.32], f: [1, 1], open: true, foot: 1, ink: ['#1d3557', '#e63946', '#f1faee', '#2b2d42', '#a8dadc', '#6d6875', '#e9c46a', '#264653', '#ffffff', '#111111'] },
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
	covers: { whole: 'covers' }, crates: { whole: 'crates' }, trays: { whole: 'trays' }, fountain: { whole: 'fountain' }, notices: { whole: 'notices' }, posters: { whole: 'posters' },
	films: { whole: 'films' }, marquee: { whole: 'marquee' }, shoes: { whole: 'shoes' }, popcorn: { whole: 'popcorn' }, certs: { whole: 'certs' }, garments: { whole: 'garments' },
	// (the little dropper bottles on an artist's cart, nothing behind them)
	inks: { p: 'bottle', w: [0.03, 0.04], h: [0.07, 0.09], f: [1, 2], open: true, foot: 1, liq: ['#111111', '#d62828', '#1d6fd1', '#ffd60a', '#06a77d', '#7b2cbf', '#f77f00', '#ef476f', '#00b4d8'], ink: ['#111111', '#ffffff', '#2b2d42', '#f4f1de'] },
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
	const base = y0 + TH - (S0.foot ?? RAIL);
	// a product: its maker (one of its family's eight), its packet in the maker's inks: the maker's
	// own strong colour, or a pale packet with the colour in its band (a kind with colours of its
	// own, the water's blues and the milk's whites, keeps them, the maker's colour in the band)
	const fam = [].concat(MAKERS[kind] || [])[0], L = fam && LOGOS.get(fam);
	const sku = () => {
		const food = S0.food || ['#f6bd60'], t = Math.floor(r() * 8), M = fam ? brandMark(fam, t) : null;
		const ink = M ? M.ink : pick(r, ['#111111', '#d62828', '#1d3557']), ink2 = M && M.ink2 !== M.ink ? M.ink2 : null;
		let c, a;
		if (S0.ink) { c = pick(r, S0.ink); a = M ? lift(strong(ink) || !ink2 ? ink : ink2, 1.25) : pick(r, LOUD); }
		else if (M && strong(ink) && r() < 0.75) { c = lift(ink, Math.max(1.3, 150 / Math.max(...rgbOf(ink)))); a = ink2 && !pale(ink2) ? lift(ink2, 1.2) : '#f4efe2'; }
		else if (M && r() < 0.5) { c = lift(ink, 1.7); a = ink2 && strong(ink2) ? lift(ink2, 1.2) : '#f4efe2'; }
		else { c = pick(r, ['#f6f2e8', '#ffffff', '#efe9dc', '#f3efe4', '#e9eef0']); a = M ? lift(ink2 && strong(ink2) ? ink2 : ink, strong(ink) ? 1.25 : 1.9) : pick(r, LOUD); }
		if (a === c) a = pick(r, SOFT);
		const lightBody = pale(c);
		return {
			c, a, ink, lab: '#fbf8f0', l: lightBody ? lift(ink, 1.2) : pick(r, ['#ffffff', '#ffd60a', '#f1faee']), k: ink, f: pick(r, food), liq: S0.liq ? pick(r, S0.liq) : c,
			k2: pick(r, ['#d62828', '#ffffff', '#1d6fd1', '#ffd60a', '#111111', '#06a77d']), p: Array.isArray(S0.p) ? pick(r, S0.p) : S0.p,
			n: M ? brandName(fam, t) : '', logo: M && L?.ok ? { img: L.img, m: M, t } : null,
		};
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
	// the makers' families in the order their kinds are painted (each kind's strips together), the
	// last strip each is wanted for
	const famsOf = (kind) => [].concat(MAKERS[kind] || []), fams = [], last = new Map();
	ALL_TILES.forEach(([kind], i) => { for (const f of famsOf(kind)) { if (!last.has(f)) fams.push(f); last.set(f, i); } });
	g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
	while (S.next < ALL_TILES.length) {
		// this strip's makers' marks and the next two families' on their way; these waited for (a
		// few seconds at most: then their names in type)
		const fk = famsOf(ALL_TILES[S.next][0]);
		if (fk.length) { const at = fams.indexOf(fk[0]); for (let j = at; j < at + 2 + fk.length && j < fams.length; j++) logos(fams[j]); }
		if (!fk.every(logosIn)) { yield; continue; }
		g.setTransform(S.k, 0, 0, S.k, 0, 0);
		for (let n = 0; n < 4 && S.next < ALL_TILES.length; n++, S.next++) {
			const [kind, t, i] = ALL_TILES[S.next], fs = famsOf(kind);
			if (!fs.every(logosIn)) break;
			paintStrip(g, kind, (t % 8) * TW, Math.floor(t / 8) * TH, t * 31 + i * 7 + 3);
			for (const f of fs) if (last.get(f) === S.next) letGo(f);
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
	// one of the pictures painted parts to a strip (a book's cover, a tray), lying flat at y from
	// (x0, z0) to (x1, z1), its top toward z0: the j-th of the n-th strip of kind's
	decal(kind, n, j, parts, x0, z0, x1, z1, y, k = 1) {
		const [u0, v0, u1, v1] = stripUV(kind, n), du = (u1 - u0) / parts;
		this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [u0 + du * j, v0, u0 + du * (j + 1), v1], k);
	}
	// one of them standing up (a picture on a wall): from x0 to x1 at z, y to y + h
	card(kind, n, j, parts, x0, x1, y, h, z, k = 1) {
		const [u0, v0, u1, v1] = stripUV(kind, n), du = (u1 - u0) / parts;
		this.quad([x0, y, z], [x1, y, z], [x1, y + h, z], [x0, y + h, z], [u0 + du * j, v0, u0 + du * (j + 1), v1], k);
	}
	// a part of a strip's picture standing up (an arcade marquee, six to a strip): fx0 to fx1 across
	// it, fy0 to fy1 down it, as fractions; from x0 to x1 at z, y to y + h
	sub(kind, n, fx0, fy0, fx1, fy1, x0, x1, y, h, z, k = 1) {
		const [u0, v0, u1, v1] = stripUV(kind, n), du = u1 - u0, dv = v1 - v0;
		this.quad([x0, y, z], [x1, y, z], [x1, y + h, z], [x0, y + h, z], [u0 + du * fx0, v1 - dv * fy1, u0 + du * fx1, v1 - dv * fy0], k);
	}
	// a stack of them (a pile of one new book): its sides plain in side (linear rgb), the picture on top
	stack(kind, n, j, parts, x0, z0, x1, z1, y0, y1, side, k = 1) {
		this.solid(x0, y0, z0, x1, y1, z1, side, k, 'fbls');
		this.decal(kind, n, j, parts, x0, z0, x1, z1, y1, k * 1.05);
	}
	// strips laid on a slope (a grocer's angled bins), from x0 to x1, from the slope's front edge
	// (yf, zf) up to its back (yb, zb): rows of them, a strip's height deep each
	slope(kind, x0, x1, yf, zf, yb, zb, seed = 0, k = 1) {
		const rows = Math.max(1, Math.round(Math.hypot(yb - yf, zb - zf) / STRIP_H));
		let n = Math.floor(Math.abs(seed * 13.7)) % 97;
		for (let i = 0; i < rows; i++, n += 3) {
			const ya = yf + (yb - yf) * i / rows, za = zf + (zb - zf) * i / rows, yc = yf + (yb - yf) * (i + 1) / rows, zc = zf + (zb - zf) * (i + 1) / rows;
			for (let x = x0, m = n; x < x1 - 0.02; x += STRIP_W, m++) {
				const xe = Math.min(x1, x + STRIP_W), [u0, v0, u1, v1] = stripUV(kind, m), uw = (xe - x) / STRIP_W;
				this.quad([x, ya, za], [xe, ya, za], [xe, yc, zc], [x, yc, zc], [u0, v0, u0 + (u1 - u0) * uw, v1], [k * 0.92, k]);
			}
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
