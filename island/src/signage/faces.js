// The graphics themselves, drawn into the signage atlas: regulatory, warning and guide signs
// in each system's manner, street-name blades, the shop's glass (hours, push and pull, cards,
// the access symbol, the street number, the alarm company, gold leaf), the grocery's aisle
// markers and shelf tags, transit, wayfinding, the construction site's boards, plates and
// stickers for cars and the services' liveries, and the graffiti (graffiti.js).
//
// The typography is a sign shop's: one sans family from the system (condensed by scaling,
// as the highway alphabets are narrower than a text face), legends sized to the panel with
// a border's width of margin, tracking opened on the capitals, mixed case where the eye reads
// words (street names, destinations) and capitals where it reads a command. Colours are each
// system's own: legend and field contrast, nothing decorative on a regulatory sign.
//
// drawFace(g, x, y, w, h, face) draws face (placement.js records' face) into the box;
// faceDims(face, w, h) gives the box in pixels for a record of w x h metres.

import { picto, arrow } from './pictograms.js';
import { drawTag, drawThrowup, drawPiece, drawBuff, drawWheatpaste, drawSticker, drawFlyer } from './graffiti.js';
import { SYSTEMS } from './systems.js';
import { CARD_MARKS } from './placement.js';
import { rng, pick } from './rand.js';
import { drawEmblem, drawTradeBoard, drawBanner, drawProduct } from './art.js';

export const SANS = '"Inter", "Liberation Sans", "Helvetica Neue", Arial, sans-serif';
export const SERIF = '"Liberation Serif", Georgia, "Times New Roman", serif';
export const JPF = '"IPAGothic", "Hiragino Sans", "Noto Sans CJK JP", "Yu Gothic", sans-serif';
const sysOf = (f) => SYSTEMS[f.sys] || SYSTEMS.us;

// px per metre by kind: the faces read close get more
const DENS = { blade: 330, hours: 520, pushpull: 760, payment: 760, access: 700, nosmoking: 700, alarm: 900, address: 520, suite: 900, nosolicit: 900, open: 600, window: 420, sale: 420, staff: 640, deliveries: 640, plate: 900, bumper: 900, wsticker: 900, cpermit: 1100, livery: 200, aisle: 260, dept: 200, price: 1200, talker: 1000, flyer: 640, sticker: 1100, permit: 420, site: 300 };
export function faceDims(face, w, h) {
	const d = DENS[face.k] ?? (face.k === 'tag' || face.k === 'throwup' ? 200 : face.k === 'piece' ? 120 : face.k === 'buff' ? 40 : face.k === 'wheatpaste' ? 300 : 230);
	// (three quarters of the nominal density: enough for the distance each is read at, and the
	// region's faces fit one sheet without repacking)
	let pw = Math.round(w * d * 0.75), ph = Math.round(h * d * 0.75);
	const s = Math.min(1, 1024 / Math.max(pw, 1), 384 / Math.max(ph, 1));
	pw = Math.max(16, Math.round(pw * s)); ph = Math.max(16, Math.round(ph * s));
	return [pw, ph];
}

// ---------- small tools ----------
function text(g, s, x, y, px, { font = SANS, weight = 'bold', align = 'center', base = 'middle', col = '#111', maxW = 0, cond = 1, track = 0, mirror = false } = {}) {
	g.save();
	g.font = `${weight} ${Math.max(4, Math.round(px))}px ${font}`;
	g.fillStyle = col; g.textBaseline = base;
	if ('letterSpacing' in g) g.letterSpacing = `${Math.round(track * px)}px`;
	const tw = g.measureText(s).width * cond;
	const k = maxW && tw > maxW ? maxW / tw : 1;
	g.translate(x, y); g.scale(cond * k * (mirror ? -1 : 1), 1);
	g.textAlign = align;
	g.fillText(s, 0, 0);
	g.restore();
	return tw * k;
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function poly(g, cx, cy, r, n, rot) { g.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); }
function ring(g, cx, cy, r, w, col) { g.beginPath(); g.arc(cx, cy, r - w / 2, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = col; g.stroke(); }
// a sign blank with the border the manuals call for (a stroke inside the edge)
function panel(g, x, y, w, h, bg, fg, rad = 0.08, bw = 0.035) {
	const m = Math.min(w, h);
	rrect(g, x + 1, y + 1, w - 2, h - 2, m * rad); g.fillStyle = bg; g.fill();
	if (fg) { rrect(g, x + m * bw * 0.9, y + m * bw * 0.9, w - m * bw * 1.8, h - m * bw * 1.8, m * rad * 0.7); g.lineWidth = m * bw * 0.6; g.strokeStyle = fg; g.stroke(); }
}
// a route marker, as a generic shape: a shield, a spade, a circle or a box (no agency's own)
function shield(g, cx, cy, s, num, kind = 'shield') {
	g.save(); g.translate(cx, cy);
	if (kind === 'shield') {
		g.beginPath(); g.moveTo(-s * 0.44, -s * 0.4); g.quadraticCurveTo(0, -s * 0.52, s * 0.44, -s * 0.4); g.lineTo(s * 0.44, 0); g.quadraticCurveTo(s * 0.4, s * 0.4, 0, s * 0.52); g.quadraticCurveTo(-s * 0.4, s * 0.4, -s * 0.44, 0); g.closePath();
		g.fillStyle = '#f4f4ee'; g.fill(); g.lineWidth = s * 0.05; g.strokeStyle = '#111'; g.stroke();
	} else if (kind === 'circle') { g.beginPath(); g.arc(0, 0, s * 0.46, 0, Math.PI * 2); g.fillStyle = '#f4f4ee'; g.fill(); g.lineWidth = s * 0.05; g.strokeStyle = '#111'; g.stroke(); }
	else { rrect(g, -s * 0.46, -s * 0.34, s * 0.92, s * 0.68, s * 0.08); g.fillStyle = '#f4f4ee'; g.fill(); g.lineWidth = s * 0.04; g.strokeStyle = '#111'; g.stroke(); }
	text(g, String(num), 0, s * 0.04, s * (String(num).length > 2 ? 0.38 : 0.48), { col: '#111', cond: 0.86 });
	g.restore();
}

// ---------- road signs ----------
const ROAD = {
	stop(g, x, y, w, h, f) {
		const S = sysOf(f), cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2 - 1;
		if (S.id === 'jp') {
			// the inverted red triangle, white border, 止まれ
			g.beginPath(); g.moveTo(x + 2, y + h * 0.08); g.lineTo(x + w - 2, y + h * 0.08); g.lineTo(cx, y + h - 2); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
			g.beginPath(); g.moveTo(x + w * 0.1, y + h * 0.14); g.lineTo(x + w * 0.9, y + h * 0.14); g.lineTo(cx, y + h * 0.9); g.closePath(); g.fillStyle = '#c8102e'; g.fill();
			text(g, '止まれ', cx, y + h * 0.36, h * 0.2, { font: JPF, col: '#fff', maxW: w * 0.62 });
			return;
		}
		poly(g, cx, cy, r, 8, Math.PI / 8); g.fillStyle = '#ffffff'; g.fill();
		poly(g, cx, cy, r * 0.92, 8, Math.PI / 8); g.fillStyle = '#c8102e'; g.fill();
		text(g, f.word || 'STOP', cx, cy + r * 0.04, r * 0.52, { col: '#fff', cond: 0.86, maxW: r * 1.6, track: 0.04 });
	},
	yield(g, x, y, w, h, f) {
		const S = sysOf(f), cx = x + w / 2;
		g.beginPath(); g.moveTo(x + 2, y + 2); g.lineTo(x + w - 2, y + 2); g.lineTo(cx, y + h - 2); g.closePath(); g.fillStyle = '#c8102e'; g.fill();
		g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.13); g.lineTo(x + w * 0.8, y + h * 0.13); g.lineTo(cx, y + h * 0.74); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
		if (S.id === 'us' || S.id === 'americas') text(g, S.id === 'us' ? 'YIELD' : 'CEDA', cx, y + h * 0.3, h * 0.13, { col: '#c8102e', cond: 0.86 });
	},
	allway(g, x, y, w, h) { panel(g, x, y, w, h, '#c8102e', '#ffffff', 0.12, 0.08); text(g, 'ALL-WAY', x + w / 2, y + h * 0.54, h * 0.62, { col: '#fff', cond: 0.86, maxW: w * 0.86 }); },
	speed(g, x, y, w, h, f) {
		const S = sysOf(f), cx = x + w / 2, cy = y + h / 2;
		if (S.ring) {
			// the Vienna ring: red round a white field, the number in black (blue in Japan)
			const r = Math.min(w, h) / 2 - 1;
			g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
			ring(g, cx, cy, r * 0.97, r * 0.2, '#c8102e');
			text(g, String(f.n), cx, cy + r * 0.05, r * (String(f.n).length > 2 ? 0.72 : 0.92), { col: S.id === 'jp' ? '#1f3f9e' : '#111', cond: 0.84, maxW: r * 1.3 });
			return;
		}
		panel(g, x, y, w, h, '#ffffff', '#111', 0.06, 0.03);
		text(g, 'SPEED', cx, y + h * 0.17, h * 0.13, { col: '#111', cond: 0.84, track: 0.06 });
		text(g, 'LIMIT', cx, y + h * 0.32, h * 0.13, { col: '#111', cond: 0.84, track: 0.06 });
		text(g, String(f.n), cx, y + h * 0.66, h * 0.42, { col: '#111', cond: 0.8 });
		if (S.unit !== 'mph') text(g, 'km/h', cx, y + h * 0.9, h * 0.08, { col: '#111' });
	},
	oneway(g, x, y, w, h, f) {
		const S = sysOf(f);
		if (S.ring && S.id !== 'jp') {
			panel(g, x, y, w, h, S.guide, null, 0.06);
			arrow(g, x + w / 2, y + h / 2, h * 0.9, f.dir === 'L' ? Math.PI : 0, '#ffffff');
			return;
		}
		panel(g, x, y, w, h, '#111', null, 0.06);
		g.fillStyle = '#ffffff';
		const L = f.dir === 'L';
		g.beginPath(); const ax = L ? x + w * 0.06 : x + w * 0.94, sx = L ? 1 : -1;
		g.moveTo(ax, y + h / 2); g.lineTo(ax + sx * h * 0.42, y + h * 0.12); g.lineTo(ax + sx * h * 0.42, y + h * 0.3); g.lineTo(ax + sx * w * 0.86, y + h * 0.3); g.lineTo(ax + sx * w * 0.86, y + h * 0.7); g.lineTo(ax + sx * h * 0.42, y + h * 0.7); g.lineTo(ax + sx * h * 0.42, y + h * 0.88); g.closePath(); g.fill();
		text(g, S.id === 'jp' ? '一方通行' : 'ONE WAY', x + w / 2 + (L ? h * 0.18 : -h * 0.18), y + h / 2 + 1, h * 0.3, { col: '#111', cond: 0.86, font: S.id === 'jp' ? JPF : SANS, track: 0.05 });
	},
	noentry(g, x, y, w, h, f) {
		const S = sysOf(f), cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2 - 1;
		g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
		g.beginPath(); g.arc(cx, cy, r * 0.94, 0, Math.PI * 2); g.fillStyle = '#c8102e'; g.fill();
		g.fillStyle = '#ffffff'; g.fillRect(cx - r * 0.7, cy - r * 0.13, r * 1.4, r * 0.26);
		if (S.id === 'us') { text(g, 'DO NOT', cx, cy - r * 0.42, r * 0.26, { col: '#fff', cond: 0.86 }); text(g, 'ENTER', cx, cy + r * 0.44, r * 0.26, { col: '#fff', cond: 0.86 }); }
	},
	noparking(g, x, y, w, h, f) {
		const S = sysOf(f), cx = x + w / 2;
		if (S.ring) {
			const cy = y + h / 2, r = Math.min(w, h) / 2 - 1;
			g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = '#c8102e'; g.fill();
			g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2); g.fillStyle = '#1d4f9c'; g.fill();
			g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 4); g.fillStyle = '#c8102e'; g.fillRect(-r * 0.86, -r * 0.1, r * 1.72, r * 0.2); g.restore();
			return;
		}
		panel(g, x, y, w, h, '#ffffff', '#c8102e', 0.06, 0.04);
		text(g, 'NO', cx, y + h * 0.15, h * 0.12, { col: '#c8102e', cond: 0.86 });
		text(g, 'PARKING', cx, y + h * 0.28, h * 0.1, { col: '#c8102e', cond: 0.8, maxW: w * 0.86 });
		const cy = y + h * 0.52, r = w * 0.26;
		ring(g, cx, cy, r, r * 0.18, '#c8102e'); picto(g, 'parking', cx, cy, r * 1.25, '#111');
		g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 4); g.fillStyle = '#c8102e'; g.fillRect(-r * 0.92, -r * 0.09, r * 1.84, r * 0.18); g.restore();
		text(g, f.tow ? 'TOW-AWAY' : f.hours ? '7AM–6PM' : 'ANY TIME', cx, y + h * 0.78, h * 0.085, { col: '#c8102e', cond: 0.8, maxW: w * 0.86 });
		if (f.tow) text(g, 'ZONE', cx, y + h * 0.89, h * 0.085, { col: '#c8102e', cond: 0.8 });
	},
	school(g, x, y, w, h, f) {
		const S = sysOf(f), cx = x + w / 2;
		if (S.warn === 'triangle') { warnTri(g, x, y, w, h); picto(g, 'school', cx, y + h * 0.6, h * 0.42, '#111'); return; }
		// the fluorescent yellow-green pentagon
		g.beginPath(); g.moveTo(cx, y + 2); g.lineTo(x + w - 2, y + h * 0.42); g.lineTo(x + w - 2, y + h - 2); g.lineTo(x + 2, y + h - 2); g.lineTo(x + 2, y + h * 0.42); g.closePath(); g.fillStyle = '#c5e30e'; g.fill();
		g.lineWidth = w * 0.03; g.strokeStyle = '#111'; g.stroke();
		picto(g, 'school', cx, y + h * 0.64, h * 0.5, '#111');
	},
	work(g, x, y, w, h, f) {
		const S = sysOf(f), cx = x + w / 2;
		if (S.warn === 'triangle') { warnTri(g, x, y, w, h); picto(g, 'worker', cx, y + h * 0.62, h * 0.4, '#111'); return; }
		g.save(); g.translate(cx, y + h / 2); g.rotate(Math.PI / 4);
		const s = Math.min(w, h) * 0.69; rrect(g, -s / 2, -s / 2, s, s, s * 0.06); g.fillStyle = '#f47b20'; g.fill(); g.lineWidth = s * 0.03; g.strokeStyle = '#111'; rrect(g, -s * 0.46, -s * 0.46, s * 0.92, s * 0.92, s * 0.05); g.stroke(); g.restore();
		text(g, 'ROAD', cx, y + h * 0.36, h * 0.11, { col: '#111', cond: 0.86 }); text(g, 'WORK', cx, y + h * 0.5, h * 0.11, { col: '#111', cond: 0.86 }); text(g, 'AHEAD', cx, y + h * 0.64, h * 0.11, { col: '#111', cond: 0.86 });
	},
	// a street-name blade: the name in mixed case, the block number small, a keyline
	blade(g, x, y, w, h, f) {
		const S = sysOf(f);
		panel(g, x, y, w, h, S.blade, S.bladeFg, 0.12, 0.06);
		const name = f.name || '';
		const m = name.match(/^(.*?)(\s+(St|Ave|Blvd|Rd|Dr|Ln|Ct|Pl|Ter|Hwy|Pkwy|Way|Cir|Expy))$/);
		const fs = h * 0.6;
		let left = x + h * 0.32;
		if (f.block) { text(g, String(f.block), left, y + h * 0.5, h * 0.26, { col: S.bladeFg, align: 'left', cond: 0.8 }); left += h * 0.95; }
		const room = x + w - h * 0.25 - left;
		if (m) {
			g.save(); g.font = `bold ${Math.round(fs)}px ${SANS}`; const a = g.measureText(m[1]).width * 0.84; g.font = `bold ${Math.round(fs * 0.62)}px ${SANS}`; const b = g.measureText(m[3]).width * 0.84; g.restore();
			const k = Math.min(1, room / (a + b + h * 0.16));
			text(g, m[1], left, y + h * 0.56, fs, { col: S.bladeFg, align: 'left', cond: 0.84 * k });
			text(g, m[3], left + (a + h * 0.12) * k, y + h * 0.42, fs * 0.62, { col: S.bladeFg, align: 'left', cond: 0.84 * k });
		} else text(g, name, left, y + h * 0.56, fs, { col: S.bladeFg, align: 'left', cond: 0.84, maxW: room, font: S.id === 'jp' ? JPF : SANS });
	},
	// a guide sign: the exit tab, the shield and direction, the destination, an arrow down to
	// its lane (or the distance)
	guide(g, x, y, w, h, f) {
		const S = sysOf(f), fg = S.guideFg;
		g.fillStyle = S.guide; rrect(g, x + 1, y + h * (f.exit ? 0.17 : 0) + 1, w - 2, h * (f.exit ? 0.83 : 1) - 2, h * 0.04); g.fill();
		g.lineWidth = h * 0.014; g.strokeStyle = fg; rrect(g, x + h * 0.025, y + h * (f.exit ? 0.19 : 0.025), w - h * 0.05, h * (f.exit ? 0.785 : 0.95), h * 0.03); g.stroke();
		if (f.exit) {
			// the tab, top right
			const tw = w * 0.34; g.fillStyle = S.guide; rrect(g, x + w - tw - 1, y + 1, tw, h * 0.22, h * 0.03); g.fill(); g.strokeStyle = fg; rrect(g, x + w - tw + h * 0.015, y + h * 0.02, tw - h * 0.04, h * 0.19, h * 0.025); g.stroke();
			text(g, `EXIT ${f.exit}`, x + w - tw / 2, y + h * 0.115, h * 0.11, { col: fg, cond: 0.84, track: 0.04 });
		}
		const top = y + h * (f.exit ? 0.26 : 0.1);
		let tx = x + w * 0.06;
		if (f.route) { shield(g, x + w * 0.13, top + h * 0.17, h * 0.32, f.route, S.id === 'us' ? 'shield' : S.id === 'jp' ? 'box' : 'circle'); tx = x + w * 0.27; text(g, { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' }[f.dir] || '', tx, top + h * 0.17, h * 0.1, { col: fg, align: 'left', cond: 0.84, track: 0.08 }); }
		(f.lines || []).forEach((L, i) => text(g, L, f.route ? x + w / 2 : x + w / 2, top + h * (f.route ? 0.44 : 0.22) + i * h * 0.17, h * 0.15, { col: fg, cond: 0.86, maxW: w * 0.86, weight: 'bold' }));
		if (f.dist) text(g, f.dist, x + w / 2, y + h * 0.88, h * 0.1, { col: fg, cond: 0.86, track: 0.04 });
		if (f.arrow === 'down' && !f.dist) arrow(g, x + w / 2, y + h * 0.84, h * 0.2, Math.PI / 2, fg);
	},
	exitgore(g, x, y, w, h, f) {
		const S = sysOf(f);
		panel(g, x, y, w, h, S.guide, S.guideFg, 0.06, 0.03);
		text(g, 'EXIT', x + w / 2, y + h * 0.28, h * 0.24, { col: S.guideFg, cond: 0.86, track: 0.06 });
		text(g, String(f.n || ''), x + w * 0.35, y + h * 0.66, h * 0.3, { col: S.guideFg, cond: 0.86 });
		arrow(g, x + w * 0.72, y + h * 0.66, h * 0.4, -Math.PI / 4, S.guideFg);
	},
	clearance(g, x, y, w, h, f) {
		panel(g, x, y, w, h, '#f7c51c', '#111', 0.08, 0.06);
		text(g, f.txt, x + w / 2, y + h * 0.56, h * 0.52, { col: '#111', cond: 0.84, maxW: w * 0.8 });
		g.fillStyle = '#111';
		g.beginPath(); g.moveTo(x + w * 0.07, y + h * 0.5); g.lineTo(x + w * 0.11, y + h * 0.2); g.lineTo(x + w * 0.15, y + h * 0.5); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(x + w * 0.85, y + h * 0.5); g.lineTo(x + w * 0.89, y + h * 0.8); g.lineTo(x + w * 0.93, y + h * 0.5); g.closePath(); g.fill();
	},
	// transit: the stop's flag, its routes, and a map of the lines on the shelter
	busstop(g, x, y, w, h, f) {
		const S = sysOf(f);
		const bg = S.id === 'vienna' ? '#1d4f9c' : S.id === 'jp' ? '#1f4d9e' : '#ffffff', fg = bg === '#ffffff' ? '#111' : '#ffffff';
		panel(g, x, y, w, h, bg, fg, 0.06, 0.03);
		picto(g, 'bus', x + w / 2, y + h * 0.24, h * 0.3, fg);
		text(g, S.id === 'jp' ? 'バス停' : S.id === 'vienna' ? 'BUS' : 'BUS STOP', x + w / 2, y + h * 0.48, h * 0.08, { col: fg, cond: 0.86, font: S.id === 'jp' ? JPF : SANS, track: 0.08 });
		(f.routes || []).slice(0, 4).forEach((n, i) => { const bx = x + w * (0.14 + i * 0.19), by = y + h * 0.58; g.fillStyle = ['#e03a2a', '#2a8ae0', '#20a050', '#e0a020'][i]; rrect(g, bx, by, w * 0.16, h * 0.1, 3); g.fill(); text(g, String(n), bx + w * 0.08, by + h * 0.05, h * 0.065, { col: '#fff' }); });
		text(g, f.name || '', x + w / 2, y + h * 0.8, h * 0.055, { col: fg, cond: 0.86, maxW: w * 0.86, weight: 'normal' });
	},
	transitmap(g, x, y, w, h, f) {
		const r = rng(f.seed || 1);
		g.fillStyle = '#f6f6f2'; g.fillRect(x, y, w, h);
		g.fillStyle = '#1b1b1b'; g.fillRect(x, y, w, h * 0.1);
		text(g, 'SYSTEM MAP', x + w * 0.05, y + h * 0.05, h * 0.05, { col: '#fff', align: 'left', track: 0.1 });
		const cols = ['#e03a2a', '#2a8ae0', '#20a050', '#e0a020', '#8a3ae0'];
		const st = [];
		for (let k = 0; k < 4; k++) {
			g.strokeStyle = cols[k]; g.lineWidth = w * 0.022; g.lineJoin = 'round'; g.beginPath();
			let px = x + w * 0.08, py = y + h * (0.2 + r() * 0.7); g.moveTo(px, py);
			for (let i = 0; i < 5; i++) { const nx = px + w * 0.17, ny = Math.max(y + h * 0.16, Math.min(y + h * 0.94, py + (r() < 0.5 ? 0 : (r() - 0.5) * h * 0.3))); g.lineTo(nx, ny); st.push([nx, ny]); px = nx; py = ny; }
			g.stroke();
		}
		for (const [sx, sy] of st) { g.beginPath(); g.arc(sx, sy, w * 0.014, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = w * 0.006; g.strokeStyle = '#1b1b1b'; g.stroke(); }
		g.beginPath(); g.arc(x + w * 0.5, y + h * 0.55, w * 0.03, 0, Math.PI * 2); g.fillStyle = '#e03a2a'; g.fill();
		text(g, 'YOU ARE HERE', x + w * 0.5, y + h * 0.62, h * 0.03, { col: '#1b1b1b' });
	},
	// a wayfinding totem downtown: a header, the places with an arrow and the minutes' walk
	totem(g, x, y, w, h, f) {
		g.fillStyle = '#23302f'; g.fillRect(x, y, w, h);
		g.fillStyle = '#e8b33a'; g.fillRect(x, y + h * 0.1, w, h * 0.012);
		text(g, f.title || 'DOWNTOWN', x + w * 0.1, y + h * 0.055, w * 0.12, { col: '#ffffff', align: 'left', track: 0.12 });
		(f.items || []).slice(0, 7).forEach((it, i) => {
			const yy = y + h * (0.18 + i * 0.1);
			arrow(g, x + w * 0.14, yy, w * 0.13, it.a ?? 0, '#e8b33a');
			text(g, it.name, x + w * 0.27, yy - w * 0.02, w * 0.075, { col: '#ffffff', align: 'left', maxW: w * 0.66, weight: 'bold' });
			text(g, `${it.min} min`, x + w * 0.27, yy + w * 0.07, w * 0.055, { col: '#b8c4c2', align: 'left', weight: 'normal' });
		});
		picto(g, 'walk', x + w * 0.5, y + h * 0.93, w * 0.18, '#e8b33a');
	},
	// the hospital's wayfinding: H, EMERGENCY, an arrow, on the campus blue
	hospital(g, x, y, w, h, f) {
		panel(g, x, y, w, h, '#1d4f9c', '#ffffff', 0.06, 0.03);
		g.fillStyle = '#ffffff'; rrect(g, x + h * 0.12, y + h * 0.15, h * 0.7, h * 0.7, h * 0.08); g.fill();
		picto(g, 'hospital', x + h * 0.47, y + h * 0.5, h * 0.6, '#1d4f9c');
		text(g, f.line || 'EMERGENCY', x + h * 1.0, y + h * 0.5, h * 0.3, { col: '#ffffff', align: 'left', cond: 0.86, maxW: w - h * 1.8, track: 0.04 });
		if (f.arrow !== undefined) arrow(g, x + w - h * 0.45, y + h * 0.5, h * 0.55, f.arrow, '#ffffff');
	},
	parkrules(g, x, y, w, h, f) {
		g.fillStyle = '#5a3f26'; g.fillRect(x, y, w, h);
		g.fillStyle = '#f2ead6'; g.fillRect(x + w * 0.04, y + h * 0.04, w * 0.92, h * 0.92);
		text(g, f.name || 'CITY PARK', x + w / 2, y + h * 0.11, h * 0.07, { col: '#2b3a22', maxW: w * 0.84, font: SERIF });
		text(g, 'PARK RULES', x + w / 2, y + h * 0.2, h * 0.045, { col: '#2b3a22', track: 0.15 });
		const rules = [['dog', 'Dogs on leash'], ['recycle', 'Pack it out'], ['cigarette', 'No smoking'], ['bike', 'Walk bikes on paths'], ['tent', 'No camping'], ['fire', 'No open fires']];
		rules.forEach(([p, t], i) => { const yy = y + h * (0.3 + i * 0.105); picto(g, p, x + w * 0.16, yy, h * 0.08, '#2b3a22'); text(g, t, x + w * 0.28, yy, h * 0.045, { col: '#2b3a22', align: 'left', weight: 'normal', maxW: w * 0.66 }); });
		text(g, 'Open dawn to dusk', x + w / 2, y + h * 0.93, h * 0.04, { col: '#2b3a22', weight: 'normal' });
	},
	site(g, x, y, w, h, f) {
		panel(g, x, y, w, h, '#ffffff', '#111', 0.02, 0.02);
		g.fillStyle = '#1d4f9c'; g.fillRect(x + w * 0.04, y + h * 0.06, w * 0.92, h * 0.3);
		picto(g, 'hazard', x + w * 0.16, y + h * 0.21, h * 0.24, '#ffffff');
		text(g, f.sys === 'jp' ? '工事中' : 'NOTICE', x + w * 0.58, y + h * 0.21, h * 0.16, { col: '#fff', track: 0.1, font: f.sys === 'jp' ? JPF : SANS });
		text(g, f.line || 'HARD HAT AREA', x + w / 2, y + h * 0.58, h * 0.13, { col: '#111', maxW: w * 0.88, cond: 0.9 });
		text(g, 'Site office · visitors report to gate 1', x + w / 2, y + h * 0.82, h * 0.06, { col: '#333', maxW: w * 0.88, weight: 'normal' });
	},
	permit(g, x, y, w, h, f) {
		g.fillStyle = '#fbf4c8'; g.fillRect(x + 1, y + 1, w - 2, h - 2);
		text(g, 'BUILDING PERMIT', x + w / 2, y + h * 0.1, h * 0.06, { col: '#111', maxW: w * 0.9 });
		text(g, `No. ${f.no}`, x + w / 2, y + h * 0.2, h * 0.05, { col: '#111', weight: 'normal' });
		g.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 12; i++) g.fillRect(x + w * 0.1, y + h * (0.3 + i * 0.05), w * (0.5 + ((i * 37) % 30) / 100), h * 0.012);
		g.strokeStyle = '#c8102e'; g.lineWidth = 3; g.beginPath(); g.arc(x + w * 0.72, y + h * 0.84, w * 0.12, 0, Math.PI * 2); g.stroke();
	},
};
function warnTri(g, x, y, w, h) {
	const cx = x + w / 2;
	g.beginPath(); g.moveTo(cx, y + 2); g.lineTo(x + w - 2, y + h - 2); g.lineTo(x + 2, y + h - 2); g.closePath(); g.fillStyle = '#c8102e'; g.fill();
	g.beginPath(); g.moveTo(cx, y + h * 0.17); g.lineTo(x + w * 0.86, y + h * 0.9); g.lineTo(x + w * 0.14, y + h * 0.9); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
}

// ---------- the shop's glass ----------
const GLASS = {
	pushpull(g, x, y, w, h, f) { text(g, f.word || 'PULL', x + w / 2, y + h / 2, h * 0.7, { col: '#f4f4f0', cond: 0.95, track: 0.18, font: f.word === '押' ? JPF : SANS }); },
	// the hours: cut white vinyl, a hierarchy of the name, the word, the days, the times
	hours(g, x, y, w, h, f) {
		const fg = '#f6f6f2', cx = x + w / 2;
		// (shared by every shop keeping the same hours: no name on it, the name is on the fascia)
		text(g, f.sys === 'jp' ? '営業時間' : f.sys === 'vienna' ? 'OPEN' : 'HOURS', cx, y + h * 0.14, h * 0.11, { col: fg, track: 0.2, font: f.sys === 'jp' ? JPF : SANS });
		g.fillStyle = fg; g.fillRect(x + w * 0.25, y + h * 0.25, w * 0.5, Math.max(1, h * 0.008));
		const rows = f.closedSun ? [['MON – SAT', f.line], ['SUN', 'CLOSED']] : [['MON – FRI', f.line], ['SAT – SUN', f.line]];
		rows.forEach(([d, t], i) => { const yy = y + h * (0.38 + i * 0.22); text(g, d, cx, yy, h * 0.065, { col: fg, weight: 'normal', track: 0.12, maxW: w * 0.86 }); text(g, t, cx, yy + h * 0.09, h * 0.075, { col: fg, weight: 'bold', maxW: w * 0.86 }); });
		text(g, 'Thank you for visiting', cx, y + h * 0.86, h * 0.05, { col: fg, weight: 'normal', font: SERIF });
	},
	address(g, x, y, w, h, f) { text(g, f.n, x + w / 2, y + h * 0.55, h * 0.85, { col: f.gold ? '#e8c46a' : '#f6f6f2', weight: f.gold ? 'bold' : 'normal', font: f.gold ? SERIF : SANS, track: 0.06 }); },
	payment(g, x, y, w, h, f) {
		g.fillStyle = '#ffffff'; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.08); g.fill();
		text(g, 'WE ACCEPT', x + w / 2, y + h * 0.15, h * 0.12, { col: '#333', track: 0.12 });
		const marks = f.marks || [0, 1, 2], cw = (w - h * 0.2) / 4;
		marks.slice(0, 4).forEach((m, i) => {
			const bx = x + h * 0.1 + i * cw, by = y + h * 0.32, bw = cw - 4, bh = h * 0.56;
			const col = ['#0f7c74', '#5b3fa8', '#d0731c', '#2b6fd6', '#1c8f3c', '#a8283b'][m % 6];
			g.fillStyle = col; rrect(g, bx, by, bw, bh, bh * 0.12); g.fill();
			g.fillStyle = 'rgba(255,255,255,0.85)';
			// each invented mark: a shape of its own on its card
			if (m % 3 === 0) { g.beginPath(); g.arc(bx + bw * 0.3, by + bh * 0.42, bh * 0.2, 0, Math.PI * 2); g.fill(); }
			else if (m % 3 === 1) { g.beginPath(); g.moveTo(bx + bw * 0.12, by + bh * 0.6); g.quadraticCurveTo(bx + bw * 0.35, by + bh * 0.1, bx + bw * 0.6, by + bh * 0.5); g.lineTo(bx + bw * 0.6, by + bh * 0.62); g.closePath(); g.fill(); }
			else { poly(g, bx + bw * 0.3, by + bh * 0.42, bh * 0.22, 6, 0); g.fill(); }
			text(g, CARD_MARKS[m % CARD_MARKS.length], bx + bw / 2, by + bh * 0.82, bh * 0.2, { col: '#fff', maxW: bw * 0.9 });
		});
	},
	access(g, x, y, w, h) { g.fillStyle = '#1d4f9c'; rrect(g, x + 1, y + 1, w - 2, h - 2, w * 0.1); g.fill(); picto(g, 'access', x + w / 2, y + h / 2, w * 0.82, '#ffffff'); },
	nosmoking(g, x, y, w, h) {
		const cx = x + w / 2, cy = y + h / 2, r = w / 2 - 1;
		g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
		picto(g, 'cigarette', cx, cy, r * 1.4, '#111');
		ring(g, cx, cy, r, r * 0.16, '#c8102e');
		g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 4); g.fillStyle = '#c8102e'; g.fillRect(-r * 0.9, -r * 0.08, r * 1.8, r * 0.16); g.restore();
	},
	// an alarm company's sticker: a shield, a word of warning, an invented name
	alarm(g, x, y, w, h, f) {
		const r = rng((f.co || '').length * 977 + 3), col = pick(r, ['#0e3b7a', '#a01b1b', '#14532d', '#1a1a1a']);
		g.beginPath(); g.moveTo(x + w * 0.05, y + h * 0.05); g.lineTo(x + w * 0.95, y + h * 0.05); g.lineTo(x + w * 0.95, y + h * 0.55); g.quadraticCurveTo(x + w * 0.9, y + h * 0.88, x + w / 2, y + h * 0.97); g.quadraticCurveTo(x + w * 0.1, y + h * 0.88, x + w * 0.05, y + h * 0.55); g.closePath();
		g.fillStyle = col; g.fill(); g.lineWidth = w * 0.04; g.strokeStyle = '#e8e8e8'; g.stroke();
		text(g, 'PROTECTED BY', x + w / 2, y + h * 0.2, h * 0.075, { col: '#fff', maxW: w * 0.8, track: 0.1 });
		const words = String(f.co || '').split(' ');
		text(g, words[0].toUpperCase(), x + w / 2, y + h * 0.42, h * 0.16, { col: '#fff', maxW: w * 0.82 });
		text(g, words.slice(1).join(' ').toUpperCase(), x + w / 2, y + h * 0.58, h * 0.075, { col: '#fff', maxW: w * 0.74 });
		text(g, '24 HR MONITORED', x + w / 2, y + h * 0.74, h * 0.06, { col: '#e8e8e8', maxW: w * 0.6 });
	},
	window(g, x, y, w, h, f) {
		// the name in an arc, in leaf or white, with its trade under
		const name = f.name || '', cx = x + w / 2, R = w * 0.9;
		g.save();
		g.font = `bold ${Math.round(h * 0.42)}px ${SERIF}`; g.fillStyle = '#e8c46a'; g.textAlign = 'center'; g.textBaseline = 'middle';
		const tw = g.measureText(name).width, k = Math.min(1, w * 0.92 / Math.max(1, tw));
		g.font = `bold ${Math.round(h * 0.42 * k)}px ${SERIF}`;
		let a = -g.measureText(name).width / 2 / R;
		for (const ch of name) { const cw = g.measureText(ch).width; g.save(); g.translate(cx + Math.sin(a + cw / 2 / R) * R, y + h * 0.4 + R - Math.cos(a + cw / 2 / R) * R); g.rotate(a + cw / 2 / R); g.fillText(ch, 0, 0); g.restore(); a += cw / R; }
		g.restore();
		if (f.tag) text(g, f.tag, cx, y + h * 0.84, h * 0.13, { col: '#f4f4f0', track: 0.2, maxW: w * 0.8 });
	},
	sale(g, x, y, w, h, f) {
		g.fillStyle = '#ffd400'; g.fillRect(x + 1, y + 1, w - 2, h - 2);
		g.fillStyle = '#d8232a'; g.fillRect(x + 1, y + 1, w - 2, h * 0.3);
		text(g, f.sys === 'jp' ? 'セール' : f.sys === 'vienna' ? 'SALE' : 'SALE', x + w / 2, y + h * 0.16, h * 0.2, { col: '#fff', font: f.sys === 'jp' ? JPF : SANS, track: 0.06 });
		text(g, `${f.pct}%`, x + w / 2, y + h * 0.5, h * 0.25, { col: '#d8232a', cond: 0.9 });
		text(g, 'OFF', x + w / 2, y + h * 0.68, h * 0.11, { col: '#111', track: 0.2 });
		text(g, /grocer|market|general/.test(f.what) ? 'Fresh produce · this week' : 'Selected items', x + w / 2, y + h * 0.86, h * 0.055, { col: '#111', weight: 'normal', maxW: w * 0.9 });
	},
	open(g, x, y, w, h, f) {
		g.fillStyle = '#ffffff'; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.12); g.fill();
		g.lineWidth = h * 0.05; g.strokeStyle = '#1c7a3c'; rrect(g, x + h * 0.08, y + h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.1); g.stroke();
		text(g, f.sys === 'jp' ? '営業中' : f.sys === 'vienna' ? 'OPEN' : 'OPEN', x + w / 2, y + h * 0.42, h * 0.38, { col: '#1c7a3c', track: 0.15, font: f.sys === 'jp' ? JPF : SANS });
		text(g, 'come in', x + w / 2, y + h * 0.76, h * 0.16, { col: '#1c7a3c', weight: 'normal', font: SERIF });
	},
	suite(g, x, y, w, h, f) { g.fillStyle = '#b8b2a4'; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.06); g.fill(); g.strokeStyle = '#6e6a60'; g.lineWidth = 2; g.stroke(); text(g, 'SUITE', x + w / 2, y + h * 0.26, h * 0.14, { col: '#2a2a28', track: 0.25 }); text(g, f.n, x + w / 2, y + h * 0.64, h * 0.42, { col: '#2a2a28', weight: 'normal' }); },
	nosolicit(g, x, y, w, h) { g.fillStyle = '#ffffff'; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.08); g.fill(); text(g, 'NO', x + w / 2, y + h * 0.32, h * 0.28, { col: '#c8102e', track: 0.1 }); text(g, 'SOLICITING', x + w / 2, y + h * 0.68, h * 0.2, { col: '#111', track: 0.1, maxW: w * 0.9 }); },
	staff(g, x, y, w, h, f) { panel(g, x, y, w, h, '#1a1a1a', '#e8e8e8', 0.06, 0.06); text(g, f.sys === 'jp' ? '関係者以外立入禁止' : f.sys === 'vienna' ? 'STAFF ONLY · PRIVAT' : 'STAFF ONLY', x + w / 2, y + h * 0.54, h * 0.46, { col: '#f0f0f0', maxW: w * 0.88, track: 0.12, font: f.sys === 'jp' ? JPF : SANS }); },
	deliveries(g, x, y, w, h) { panel(g, x, y, w, h, '#f4f4f0', '#111', 0.04, 0.04); text(g, 'DELIVERIES', x + w / 2, y + h * 0.3, h * 0.22, { col: '#111', track: 0.1, maxW: w * 0.9 }); text(g, 'please ring bell', x + w / 2, y + h * 0.66, h * 0.16, { col: '#333', weight: 'normal' }); g.beginPath(); g.arc(x + w * 0.86, y + h * 0.66, h * 0.1, 0, Math.PI * 2); g.fillStyle = '#c8102e'; g.fill(); },
};

// ---------- the grocery ----------
const SHOP = {
	// an aisle marker, hung from the ceiling: the number big in a disc, what is on its shelves
	aisle(g, x, y, w, h, f) {
		const col = f.col || '#1c6b3a';
		g.fillStyle = col; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.06); g.fill();
		g.beginPath(); g.arc(x + h * 0.36, y + h / 2, h * 0.3, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
		text(g, String(f.n), x + h * 0.36, y + h * 0.53, h * 0.36, { col });
		(f.items || []).slice(0, 4).forEach((it, i) => text(g, it, x + h * 0.78, y + h * (0.18 + i * 0.21), h * 0.15, { col: '#ffffff', align: 'left', maxW: w - h * 0.9, weight: i ? 'normal' : 'bold' }));
	},
	dept(g, x, y, w, h, f) { g.fillStyle = f.col || '#7a2a1c'; g.fillRect(x, y, w, h); text(g, f.name, x + w / 2 + h * 0.3, y + h * 0.54, h * 0.55, { col: '#fff7e6', track: 0.12, maxW: w - h * 1.4, font: SERIF }); if (f.picto) picto(g, f.picto, x + h * 0.6, y + h / 2, h * 0.7, '#fff7e6'); },
	price(g, x, y, w, h, f) {
		g.fillStyle = f.sale ? '#ffd400' : '#ffffff'; g.fillRect(x, y, w, h);
		g.fillStyle = f.sale ? '#d8232a' : '#111';
		text(g, f.item || '', x + w * 0.05, y + h * 0.22, h * 0.18, { col: '#333', align: 'left', weight: 'normal', maxW: w * 0.55 });
		const [a, b] = String(f.price || '1.99').split('.');
		text(g, a, x + w * 0.62, y + h * 0.6, h * 0.62, { col: f.sale ? '#d8232a' : '#111', align: 'right' });
		text(g, b || '99', x + w * 0.64, y + h * 0.42, h * 0.3, { col: f.sale ? '#d8232a' : '#111', align: 'left' });
		g.fillStyle = '#111'; for (let i = 0; i < 14; i++) g.fillRect(x + w * (0.06 + i * 0.022), y + h * 0.72, (i % 3 ? 1 : 2), h * 0.2);
	},
	talker(g, x, y, w, h, f) { g.fillStyle = f.col || '#d8232a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.8); g.lineTo(x + w / 2, y + h); g.lineTo(x, y + h * 0.8); g.closePath(); g.fill(); text(g, f.line || 'NEW!', x + w / 2, y + h * 0.4, h * 0.3, { col: '#fff', maxW: w * 0.86 }); },
};

// ---------- cars ----------
const CAR = {
	// a plate in the region's manner; a dealer's frame round some
	plate(g, x, y, w, h, f) {
		const st = f.style || 'us';
		if (st === 'eu' || st === 'uk') {
			g.fillStyle = st === 'uk' && f.rear ? '#f4c430' : '#f6f6f2'; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.1); g.fill();
			g.fillStyle = '#1d3f9c'; rrect(g, x + 1, y + 1, h * 0.75, h - 2, h * 0.1); g.fill();
			g.fillStyle = '#f4c430'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.arc(x + h * 0.38 + Math.cos(a) * h * 0.2, y + h * 0.34 + Math.sin(a) * h * 0.2, h * 0.03, 0, Math.PI * 2); g.fill(); }
			text(g, f.cc || 'D', x + h * 0.38, y + h * 0.78, h * 0.26, { col: '#fff' });
			text(g, f.text, x + h * 0.75 + (w - h * 0.75) / 2, y + h * 0.54, h * 0.72, { col: '#111', cond: 0.78, maxW: w - h * 1.0 });
		} else if (st === 'jp') {
			g.fillStyle = '#f6f6f2'; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.08); g.fill();
			g.lineWidth = h * 0.03; g.strokeStyle = '#1a6b3a'; rrect(g, x + h * 0.05, y + h * 0.05, w - h * 0.1, h - h * 0.1, h * 0.06); g.stroke();
			text(g, f.top || '品川 300', x + w / 2, y + h * 0.25, h * 0.24, { col: '#1a6b3a', font: JPF });
			text(g, f.kana || 'さ', x + w * 0.12, y + h * 0.66, h * 0.26, { col: '#1a6b3a', font: JPF });
			text(g, f.text, x + w * 0.58, y + h * 0.66, h * 0.5, { col: '#1a6b3a', cond: 0.9 });
		} else {
			// the American plate: a pale field, the state in script along the top, the number
			g.fillStyle = f.field || '#f6f6f2'; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.12); g.fill();
			if (f.band) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, f.band); gr.addColorStop(0.35, '#f6f6f2'); g.fillStyle = gr; rrect(g, x + 1, y + 1, w - 2, h - 2, h * 0.12); g.fill(); }
			text(g, f.state || '', x + w / 2, y + h * 0.18, h * 0.17, { col: f.ink2 || '#b8222a', font: '"Liberation Serif", serif', weight: 'italic bold' });
			text(g, f.text, x + w / 2, y + h * 0.58, h * 0.5, { col: f.ink || '#1c2f6b', cond: 0.82, maxW: w * 0.88 });
			if (f.dealer) {
				g.fillStyle = '#111'; g.fillRect(x, y + h * 0.84, w, h * 0.16); g.fillRect(x, y, w, h * 0.05);
				text(g, f.dealer.toUpperCase(), x + w / 2, y + h * 0.92, h * 0.1, { col: '#e8e8e8', track: 0.15, maxW: w * 0.9 });
			}
		}
	},
	bumper(g, x, y, w, h, f) {
		const r = rng(f.seed * 131 + 7), kind = f.seed % 6;
		if (kind === 0) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); g.fill(); g.lineWidth = 3; g.strokeStyle = '#111'; g.stroke(); text(g, pick(r, ['26.2', '13.1', 'BAY', 'FOG', 'DLT', 'PNW']), x + w / 2, y + h * 0.54, h * 0.55, { col: '#111' }); return; }
		const pal = pick(r, [['#1c2f6b', '#ffffff'], ['#ffffff', '#1c2f6b'], ['#d8232a', '#ffffff'], ['#1c7a3c', '#ffffff'], ['#f4c430', '#111111'], ['#111111', '#f4f4f0']]);
		g.fillStyle = pal[0]; g.fillRect(x + 1, y + 1, w - 2, h - 2);
		const line = pick(r, ['I BRAKE FOR TIDE POOLS', 'KEEP IT SALTY', 'MY OTHER CAR IS A BICYCLE', 'ARE WE THERE YET?', 'FOG CITY NATIVE', 'TRAIL MIX ENTHUSIAST', 'RADIO TIDE 101.9', 'PROUD PARENT · HARBOR HIGH', 'HONK IF YOU LOVE HILLS', 'SAVE THE TIDEPOOLS', 'STUDENT DRIVER · BE PATIENT', 'LIFE IS BETTER AT THE COAST']);
		text(g, line, x + w / 2, y + h * 0.54, h * 0.46, { col: pal[1], maxW: w * 0.92, track: 0.04 });
	},
	// a rear-window sticker: a family of stick figures, a college-ish name, a mountain
	wsticker(g, x, y, w, h, f) {
		const r = rng(f.seed * 211 + 3), kind = f.seed % 3, col = '#f4f4f0';
		if (kind === 0) { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const s = h * (i < 2 ? 0.9 : 0.6); picto(g, 'walk', x + w * (0.15 + i * 0.7 / n), y + h - s * 0.55, s, col); } if (r() < 0.5) picto(g, 'dog', x + w * 0.88, y + h * 0.75, h * 0.4, col); }
		else if (kind === 1) { text(g, pick(r, ['BAYSIDE STATE', 'HILLCREST COLLEGE', 'COASTAL TECH', 'NORTHRIDGE U']), x + w / 2, y + h * 0.5, h * 0.42, { col, font: SERIF, maxW: w * 0.95, track: 0.06 }); }
		else { g.strokeStyle = col; g.lineWidth = h * 0.08; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x + w * 0.05, y + h * 0.9); g.lineTo(x + w * 0.35, y + h * 0.2); g.lineTo(x + w * 0.5, y + h * 0.55); g.lineTo(x + w * 0.65, y + h * 0.3); g.lineTo(x + w * 0.95, y + h * 0.9); g.stroke(); }
	},
	cpermit(g, x, y, w, h, f) {
		const st = f.style || 'us';
		if (st === 'jp') { g.fillStyle = '#2a6fd6'; g.fillRect(x, y, w, h); text(g, String(f.year % 100 || 7), x + w / 2, y + h * 0.42, h * 0.5, { col: '#fff' }); text(g, '検査', x + w / 2, y + h * 0.82, h * 0.18, { col: '#fff', font: JPF }); return; }
		if (st === 'de') { g.beginPath(); g.arc(x + w / 2, y + h / 2, w / 2 - 1, 0, Math.PI * 2); g.fillStyle = '#2f9e44'; g.fill(); text(g, '4', x + w / 2, y + h * 0.56, h * 0.5, { col: '#111' }); return; }
		g.fillStyle = pick(rng(f.seed + 1), ['#f4c430', '#58c4f0', '#ff8ab4', '#9ef05a']); g.fillRect(x, y, w, h);
		text(g, 'ZONE', x + w / 2, y + h * 0.18, h * 0.13, { col: '#111', track: 0.2 });
		text(g, String.fromCharCode(65 + (f.seed % 8)), x + w / 2, y + h * 0.5, h * 0.42, { col: '#111' });
		text(g, `RESIDENT ${f.year}`, x + w / 2, y + h * 0.86, h * 0.1, { col: '#111' });
	},
	// a livery panel for a door or a bonnet: the service's word, its mark, its number
	livery(g, x, y, w, h, f) {
		const L = f.svc;
		if (L === 'police') {
			text(g, f.word || 'POLICE', x + w * 0.56, y + h * 0.42, h * 0.42, { col: '#141a2c', maxW: w * 0.7, track: 0.06 });
			// an invented badge: a seven-pointed star in a ring
			const cx = x + h * 0.48, cy = y + h * 0.45, r = h * 0.36;
			g.beginPath(); for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + i * Math.PI / 7, rr = i % 2 ? r * 0.55 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fillStyle = '#c9a23a'; g.fill();
			g.beginPath(); g.arc(cx, cy, r * 0.38, 0, Math.PI * 2); g.fillStyle = '#141a2c'; g.fill();
			text(g, f.sub || 'HARBOUR', x + w * 0.56, y + h * 0.8, h * 0.16, { col: '#141a2c', track: 0.35, maxW: w * 0.7 });
		} else if (L === 'ambulance') {
			text(g, f.word || 'AMBULANCE', x + w / 2, y + h * 0.5, h * 0.5, { col: '#b8121b', maxW: w * 0.92, track: 0.05, mirror: f.mirror });
		} else if (L === 'fire') {
			text(g, f.word || 'FIRE RESCUE', x + w / 2, y + h * 0.42, h * 0.38, { col: '#e8c46a', maxW: w * 0.92, font: SERIF, track: 0.06 });
			g.fillStyle = '#e8c46a'; g.fillRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.04);
			text(g, f.sub || 'ENGINE 7', x + w / 2, y + h * 0.86, h * 0.14, { col: '#e8c46a', track: 0.3 });
		} else if (L === 'military') {
			g.globalAlpha = 0.85; text(g, f.word || 'MERIDIAN GUARD', x + w / 2, y + h * 0.5, h * 0.36, { col: '#e8e4d0', font: '"DejaVu Sans Mono", "Courier New", monospace', track: 0.12, maxW: w * 0.94 }); g.globalAlpha = 1;
		} else if (L === 'roof') {
			text(g, f.word || '12', x + w / 2, y + h * 0.54, h * 0.8, { col: '#141414' });
		} else if (L === 'stripe') {
			g.fillStyle = f.col || '#c9a23a'; g.fillRect(x, y + h * 0.15, w, h * 0.25); g.fillStyle = f.col2 || '#b8121b'; g.fillRect(x, y + h * 0.55, w, h * 0.3);
		} else if (L === 'chevron') {
			for (let i = -2; i < 14; i++) { g.fillStyle = i % 2 ? '#e8f04a' : '#1c7a3c'; g.beginPath(); g.moveTo(x + i * w / 10, y + h); g.lineTo(x + (i + 1) * w / 10, y + h); g.lineTo(x + (i + 1.6) * w / 10, y); g.lineTo(x + (i + 0.6) * w / 10, y); g.closePath(); g.fill(); }
		} else if (L === 'pulse') {
			g.fillStyle = '#ffffff'; g.fillRect(x, y, w, h); picto(g, 'pulse', x + w / 2, y + h / 2, h * 0.9, '#b8121b');
		}
	},
};

// ---------- the graffiti and the grime's paper ----------
const STREET = {
	tag: (g, x, y, w, h, f) => drawTag(g, x, y, w, h, f.seed),
	throwup: (g, x, y, w, h, f) => drawThrowup(g, x, y, w, h, f.seed),
	piece: (g, x, y, w, h, f) => drawPiece(g, x, y, w, h, f.seed),
	buff: (g, x, y, w, h, f) => drawBuff(g, x, y, w, h, f.tone || 0),
	wheatpaste: (g, x, y, w, h, f) => drawWheatpaste(g, x, y, w, h, f.seed),
	sticker: (g, x, y, w, h, f) => { if (f.seed % 3 !== 0 || !drawEmblem(g, x + (w - Math.min(w, h)) / 2, y + (h - Math.min(w, h)) / 2, Math.min(w, h), 'modern', Math.abs(f.seed) % 8, !!f.phone)) drawSticker(g, x, y, w, h, f.seed); },
	banner: (g, x, y, w, h, f) => drawBanner(g, x, y, w, h, f, { phone: !!f.phone }),
	product: drawProduct,
	trade: (g, x, y, w, h, f) => drawTradeBoard(g, x, y, w, h, f, { family: f.family || 'modern', phone: !!f.phone, portrait: true }),
	flyer: (g, x, y, w, h, f) => drawFlyer(g, x, y, w, h, f.seed),
};

const ALL = { ...ROAD, ...GLASS, ...SHOP, ...CAR, ...STREET };
export const FACE_KINDS = Object.keys(ALL);
export function drawFace(g, x, y, w, h, face) {
	const f = ALL[face.k];
	g.save();
	g.beginPath(); g.rect(x, y, w, h); g.clip();
	try { if (f) f(g, x, y, w, h, face); }
	finally { g.restore(); }
}
