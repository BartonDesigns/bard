// What is on the office screens: one small atlas of pictures (an editor full of code, a
// spreadsheet, a dashboard, a video call, a design canvas, the markets...), drawn once on a
// canvas and shared by every floor, each monitor showing one of them by its uvs. A floor's
// work decides which (an engineering floor codes, a finance floor trades); a few have gone
// to their screensaver. All glow (a fixture of interiors/lighting.js, as the plain screens were).
import * as THREE from 'three';

export const COLS = 4, ROWS = 7;
export const TILE = {
	code: 0, terminal: 1, sheet: 2, dashboard: 3, bars: 4, inbox: 5, call: 6, design: 7,
	slides: 8, ticker: 9, cad: 10, map: 11, chat: 12, doc: 13, calendar: 14, photo: 15,
	wallBlue: 16, wallSunset: 17, codeLight: 18, pie: 19, kanban: 20, crm: 21, htop: 22, model: 23,
	arcade: 24, sports: 25, news: 26, game: 27,
};
// what each kind of floor has up (workplace-plan.js programs), and the screensavers
const BY_PROGRAM = {
	'Engineering': ['code', 'terminal', 'codeLight', 'htop', 'dashboard', 'kanban', 'chat', 'cad'],
	'Product studio': ['design', 'photo', 'model', 'cad', 'slides', 'kanban', 'chat'],
	'Finance': ['sheet', 'pie', 'ticker', 'bars', 'dashboard', 'inbox', 'doc'],
	'Client services': ['inbox', 'crm', 'call', 'calendar', 'slides', 'chat', 'doc'],
	'Coworking': ['code', 'design', 'sheet', 'inbox', 'call', 'doc', 'chat', 'slides', 'photo', 'kanban'],
	'Conference centre': ['slides', 'call', 'calendar', 'doc'],
	'Executive offices': ['slides', 'inbox', 'calendar', 'ticker', 'bars', 'doc', 'call'],
	'Sky commons': ['call', 'chat', 'inbox', 'map'],
};
const SAVERS = ['wallBlue', 'wallSunset'];
const hash = (a, b = 0) => { const s = Math.sin(a * 91.7 + b * 47.3) * 43758.5453; return s - Math.floor(s); };
// the picture on the screen at (x, z) of a floor of this program (seed: the floor's)
export function screenTile(program, x, z, seed = 0) {
	const r = hash(x * 3.1 + seed * 17, z * 2.3 + seed * 5);
	if (r < 0.12) return TILE[SAVERS[Math.floor(r * 100) % 2]];
	const list = BY_PROGRAM[program] || BY_PROGRAM.Coworking;
	return TILE[list[Math.floor(hash(z * 1.7 - seed, x * 4.1 + 3) * list.length) % list.length]];
}
// a plane's uvs onto one picture of the atlas (a hair inside it, so no neighbour bleeds in)
export function tileUV(geo, tile) {
	const c = tile % COLS, r = Math.floor(tile / COLS), u0 = (c + 0.03) / COLS, u1 = (c + 0.97) / COLS, v1 = 1 - (r + 0.04) / ROWS, v0 = 1 - (r + 0.96) / ROWS;
	const uv = geo.attributes.uv;
	for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) < 0.5 ? u0 : u1, uv.getY(i) < 0.5 ? v0 : v1);
	return geo;
}

let tex = null;
export function screenAtlasTexture() {
	if (tex) return tex;
	const W = 128, H = 73, cv = document.createElement('canvas');
	cv.width = W * COLS; cv.height = 512;
	const g = cv.getContext('2d');
	let seed = 11;
	const rn = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
	const rect = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
	const lines = (x, y, w, n, step, cols, minW = 0.25) => { for (let i = 0; i < n; i++) { const ind = Math.floor(rn() * 3) * 6; let cx = x + ind; for (let k = 0; k < 1 + Math.floor(rn() * 3); k++) { const lw = Math.max(4, (w - ind) * (minW + rn() * 0.35) / 2); if (cx + lw > x + w) break; rect(cols[Math.floor(rn() * cols.length)], cx, y + i * step, lw, 2); cx += lw + 3; } } };
	const bar = (x, y, w, h, c) => rect(c, x, y, w, h);
	const DRAW = {
		code(x, y) { bar(x, y, W, H, '#1e1e1e'); bar(x, y, 22, H, '#252526'); bar(x, y, W, 7, '#3c3c3c'); lines(x + 2, y + 10, 18, 9, 7, ['#8a8a8a']); for (let i = 0; i < 10; i++) rect('#5a5a5a', x + 25, y + 11 + i * 7, 4, 2); lines(x + 32, y + 11, W - 36, 10, 7, ['#569cd6', '#ce9178', '#9cdcfe', '#dcdcaa', '#6a9955', '#c586c0']); },
		codeLight(x, y) { bar(x, y, W, H, '#fbfbfb'); bar(x, y, 22, H, '#f0f0f0'); bar(x, y, W, 7, '#dddddd'); lines(x + 2, y + 10, 18, 9, 7, ['#9a9a9a']); lines(x + 30, y + 11, W - 34, 10, 7, ['#0000ff', '#a31515', '#001080', '#795e26', '#008000', '#af00db']); },
		terminal(x, y) { bar(x, y, W, H, '#0c0c0c'); bar(x, y, W, 6, '#2d2d2d'); for (const [c, k] of [['#ff5f56', 0], ['#ffbd2e', 1], ['#27c93f', 2]]) rect(c, x + 3 + k * 6, y + 1.5, 3, 3); lines(x + 4, y + 10, W - 8, 10, 7, ['#33ff66', '#d0d0d0', '#d0d0d0', '#ffcc00']); },
		htop(x, y) { bar(x, y, W, H, '#101418'); for (let i = 0; i < 4; i++) { rect('#2a3138', x + 4, y + 4 + i * 6, W - 8, 3); rect(i % 2 ? '#e05050' : '#40d070', x + 4, y + 4 + i * 6, (W - 8) * (0.2 + rn() * 0.7), 3); } rect('#2b6cb0', x, y + 30, W, 5); lines(x + 4, y + 39, W - 8, 7, 6, ['#c8d0d8', '#c8d0d8', '#7fd1ff']); },
		sheet(x, y) { bar(x, y, W, H, '#ffffff'); bar(x, y, W, 8, '#217346'); bar(x, y + 8, W, 5, '#e8e8e8'); g.fillStyle = '#d4d4d4'; for (let cx = x; cx < x + W; cx += 18) g.fillRect(cx, y + 13, 1, H - 13); for (let cy = y + 13; cy < y + H; cy += 6) g.fillRect(x, cy, W, 1); for (let cy = y + 15; cy < y + H - 3; cy += 6) for (let cx = x + 2; cx < x + W - 8; cx += 18) if (rn() < 0.7) rect(rn() < 0.1 ? '#c00000' : '#555555', cx + 4 + rn() * 3, cy, 6 + rn() * 6, 2); rect('rgba(33,115,70,.18)', x + 36, y + 31, 36, 18); },
		pie(x, y) { bar(x, y, W, H, '#ffffff'); bar(x, y, W, 8, '#217346'); let a = 0; for (const [c, k] of [['#4472c4', 0.35], ['#ed7d31', 0.25], ['#a5a5a5', 0.2], ['#ffc000', 0.2]]) { g.fillStyle = c; g.beginPath(); g.moveTo(x + 36, y + 46); g.arc(x + 36, y + 46, 26, a, a + k * Math.PI * 2); g.fill(); a += k * Math.PI * 2; } lines(x + 72, y + 22, 50, 7, 7, ['#555555']); },
		dashboard(x, y) { bar(x, y, W, H, '#111827'); for (let i = 0; i < 3; i++) { rect('#1f2937', x + 4 + i * 41, y + 4, 38, 18); rect(['#34d399', '#60a5fa', '#fbbf24'][i], x + 8 + i * 41, y + 9, 14 + rn() * 10, 5); } rect('#1f2937', x + 4, y + 26, W - 8, H - 30); g.strokeStyle = '#34d399'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i <= 12; i++) { const px = x + 8 + i * (W - 16) / 12, py = y + H - 10 - (i * 2 + rn() * 18); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.strokeStyle = '#60a5fa'; g.beginPath(); for (let i = 0; i <= 12; i++) { const px = x + 8 + i * (W - 16) / 12, py = y + H - 12 - (rn() * 22); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); },
		bars(x, y) { bar(x, y, W, H, '#f7f7f5'); rect('#1f3a5f', x, y, W, 9); lines(x + 4, y + 13, 60, 1, 6, ['#333333']); for (let i = 0; i < 9; i++) { const h = 12 + rn() * 44; rect(i % 3 === 2 ? '#e07b39' : '#2f6db5', x + 10 + i * 12, y + H - 6 - h, 8, h); } rect('#999999', x + 6, y + H - 6, W - 12, 1); },
		inbox(x, y) { bar(x, y, W, H, '#ffffff'); bar(x, y, 28, H, '#0f6cbd'); lines(x + 3, y + 8, 22, 7, 8, ['#cfe3f6']); bar(x + 28, y, W - 28, 8, '#f3f3f3'); for (let i = 0; i < 9; i++) { rect('#e6e6e6', x + 28, y + 16 + i * 7.5, W - 28, 1); rect(i < 3 ? '#222222' : '#777777', x + 32, y + 11 + i * 7.5, 18 + rn() * 14, 2); rect('#9a9a9a', x + 60, y + 11 + i * 7.5, 30 + rn() * 30, 2); } rect('#0f6cbd', x + 28, y + 9, 2, 7); },
		call(x, y) { bar(x, y, W, H, '#1b1b1f'); const skin = ['#e0b49a', '#8d5a3b', '#c68d6b', '#f1c9a5', '#5c3b28', '#d9a27c']; for (let i = 0; i < 4; i++) { const cx = x + 3 + (i % 2) * 62, cy = y + 3 + Math.floor(i / 2) * 38; rect(['#3a4a5a', '#5a4a3a', '#2f4f4f', '#4a3a5a'][i], cx, cy, 60, 36); g.fillStyle = skin[(i * 3 + 1) % skin.length]; g.beginPath(); g.arc(cx + 30, cy + 15, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = ['#2c5282', '#9b2c2c', '#2f855a', '#444444'][i]; g.fillRect(cx + 18, cy + 24, 24, 12); g.fillStyle = ['#2b1d14', '#111111', '#7a4a1f', '#d8b65a'][i]; g.fillRect(cx + 23, cy + 6, 14, 4); } rect('#e53e3e', x + 56, y + H - 8, 16, 6); },
		design(x, y) { bar(x, y, W, H, '#2c2c2c'); bar(x, y, 16, H, '#383838'); bar(x + W - 24, y, 24, H, '#383838'); bar(x + 22, y + 8, 76, 70, '#ffffff'); rect('#ff7262', x + 28, y + 14, 30, 20); g.fillStyle = '#1abcfe'; g.beginPath(); g.arc(x + 78, y + 28, 12, 0, Math.PI * 2); g.fill(); rect('#0acf83', x + 28, y + 42, 64, 6); lines(x + 28, y + 54, 60, 3, 6, ['#888888']); g.strokeStyle = '#18a0fb'; g.lineWidth = 1; g.strokeRect(x + 66.5, y + 15.5, 24, 25); lines(x + W - 22, y + 6, 18, 9, 8, ['#9a9a9a']); },
		slides(x, y) { bar(x, y, W, H, '#d6d6d6'); bar(x, y, 22, H, '#e9e9e9'); for (let i = 0; i < 5; i++) rect(i === 1 ? '#c43e1c' : '#ffffff', x + 3, y + 4 + i * 16, 16, 11); bar(x + 26, y + 8, 98, 66, '#ffffff'); rect('#c43e1c', x + 26, y + 8, 98, 12); lines(x + 30, y + 26, 44, 5, 8, ['#333333']); rect('#7fa7d9', x + 82, y + 26, 36, 28); },
		ticker(x, y) { bar(x, y, W, H, '#05070a'); g.fillStyle = '#1a2330'; for (let cy = y + 10; cy < y + H; cy += 12) g.fillRect(x, cy, W, 1); let p = 45; for (let i = 0; i < 20; i++) { const o = p, c = p + (rn() - 0.47) * 12; p = c; const hi = Math.min(o, c) - rn() * 5, lo = Math.max(o, c) + rn() * 5; const up = c < o; g.fillStyle = up ? '#22c55e' : '#ef4444'; g.fillRect(x + 4 + i * 6 + 1.5, y + hi, 1, lo - hi); g.fillRect(x + 4 + i * 6, y + Math.min(o, c), 4, Math.max(1.5, Math.abs(c - o))); } rect('#0b1220', x, y + H - 10, W, 10); lines(x + 3, y + H - 7, W - 6, 1, 6, ['#22c55e', '#ef4444', '#d0d0d0']); },
		cad(x, y) { bar(x, y, W, H, '#0b1a2e'); g.strokeStyle = 'rgba(80,140,200,.25)'; g.lineWidth = 1; for (let cx = x; cx < x + W; cx += 8) { g.beginPath(); g.moveTo(cx + 0.5, y); g.lineTo(cx + 0.5, y + H); g.stroke(); } for (let cy = y; cy < y + H; cy += 8) { g.beginPath(); g.moveTo(x, cy + 0.5); g.lineTo(x + W, cy + 0.5); g.stroke(); } g.strokeStyle = '#7dd3fc'; g.lineWidth = 1.2; g.strokeRect(x + 24.5, y + 20.5, 60, 40); g.beginPath(); g.moveTo(x + 24, y + 20); g.lineTo(x + 44, y + 8); g.lineTo(x + 104, y + 8); g.lineTo(x + 84, y + 20); g.moveTo(x + 104, y + 8); g.lineTo(x + 104, y + 48); g.lineTo(x + 84, y + 60); g.stroke(); g.strokeStyle = '#fbbf24'; g.beginPath(); g.arc(x + 54, y + 40, 10, 0, Math.PI * 2); g.stroke(); },
		model(x, y) { bar(x, y, W, H, '#3a3a3a'); const gr = g.createLinearGradient(0, y, 0, y + H); gr.addColorStop(0, '#5a5f66'); gr.addColorStop(1, '#2a2c30'); g.fillStyle = gr; g.fillRect(x + 4, y + 4, W - 30, H - 8); g.fillStyle = '#e07a3f'; g.beginPath(); g.moveTo(x + 50, y + 18); g.lineTo(x + 76, y + 30); g.lineTo(x + 76, y + 58); g.lineTo(x + 50, y + 70); g.lineTo(x + 24, y + 58); g.lineTo(x + 24, y + 30); g.closePath(); g.fill(); g.fillStyle = '#f2a06e'; g.beginPath(); g.moveTo(x + 50, y + 18); g.lineTo(x + 76, y + 30); g.lineTo(x + 50, y + 42); g.lineTo(x + 24, y + 30); g.closePath(); g.fill(); bar(x + W - 24, y, 24, H, '#2a2a2a'); lines(x + W - 22, y + 6, 18, 9, 8, ['#9a9a9a']); },
		map(x, y) { bar(x, y, W, H, '#e8efe3'); rect('#a9d3f5', x, y + 52, W, 33); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x + W, y + 34); g.moveTo(x + 40, y); g.lineTo(x + 52, y + 52); g.stroke(); g.strokeStyle = '#f6c443'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 44); g.lineTo(x + W, y + 10); g.stroke(); rect('#b9dca8', x + 70, y + 36, 30, 14); g.fillStyle = '#e53e3e'; g.beginPath(); g.arc(x + 88, y + 26, 4, 0, Math.PI * 2); g.fill(); },
		chat(x, y) { bar(x, y, W, H, '#ffffff'); bar(x, y, 30, H, '#3f0e40'); lines(x + 3, y + 8, 24, 8, 8, ['#cfb8d0']); for (let i = 0; i < 5; i++) { const cy = y + 6 + i * 15; rect(['#e01e5a', '#36c5f0', '#2eb67d', '#ecb22e', '#7c3085'][i], x + 34, cy, 8, 8); rect('#222222', x + 45, cy, 16 + rn() * 10, 2); rect('#666666', x + 45, cy + 4, 40 + rn() * 34, 2); } rect('#dddddd', x + 34, y + H - 9, W - 38, 6); },
		doc(x, y) { bar(x, y, W, H, '#e6e6e6'); bar(x, y, W, 8, '#2b579a'); bar(x + 24, y + 11, 80, H - 11, '#ffffff'); rect('#222222', x + 30, y + 16, 40, 3); lines(x + 30, y + 24, 68, 9, 6, ['#666666']); },
		calendar(x, y) { bar(x, y, W, H, '#ffffff'); bar(x, y, W, 9, '#0f6cbd'); g.fillStyle = '#e1e1e1'; for (let i = 0; i <= 5; i++) g.fillRect(x + 8 + i * 24, y + 9, 1, H - 9); for (let cy = y + 15; cy < y + H; cy += 8) g.fillRect(x, cy, W, 1); for (let i = 0; i < 9; i++) rect(['#8cb8e8', '#f7b7a3', '#b4d9a8', '#d1b3e6'][i % 4], x + 10 + (i % 5) * 24, y + 17 + Math.floor(rn() * 7) * 8, 21, 6 + Math.floor(rn() * 2) * 8); },
		photo(x, y) { bar(x, y, W, H, '#232323'); const gr = g.createLinearGradient(0, y + 8, 0, y + 60); gr.addColorStop(0, '#f28c4f'); gr.addColorStop(1, '#ffd29a'); g.fillStyle = gr; g.fillRect(x + 14, y + 8, 86, 52); g.fillStyle = '#4a3b5c'; g.beginPath(); g.moveTo(x + 14, y + 60); g.lineTo(x + 40, y + 30); g.lineTo(x + 60, y + 48); g.lineTo(x + 80, y + 26); g.lineTo(x + 100, y + 60); g.closePath(); g.fill(); bar(x, y, 10, H, '#303030'); bar(x + W - 22, y, 22, H, '#303030'); for (let i = 0; i < 3; i++) { rect('#555555', x + W - 19, y + 8 + i * 10, 16, 2); rect('#2d8ceb', x + W - 19, y + 8 + i * 10, 4 + rn() * 12, 2); } g.fillStyle = '#444444'; g.fillRect(x + 14, y + 66, 86, 12); g.strokeStyle = '#d0d0d0'; g.beginPath(); for (let i = 0; i < 86; i++) { const v = Math.exp(-((i - 50) ** 2) / 300) * 10; i ? g.lineTo(x + 14 + i, y + 78 - v) : g.moveTo(x + 14, y + 78 - v); } g.stroke(); },
		wallBlue(x, y) { const gr = g.createLinearGradient(x, y, x + W, y + H); gr.addColorStop(0, '#0f2b5b'); gr.addColorStop(1, '#3a8dde'); g.fillStyle = gr; g.fillRect(x, y, W, H); g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '600 22px system-ui'; g.textAlign = 'center'; g.fillText('10:42', x + W / 2, y + H / 2 + 6); },
		wallSunset(x, y) { const gr = g.createLinearGradient(0, y, 0, y + H); gr.addColorStop(0, '#2d1b4e'); gr.addColorStop(0.55, '#e0694a'); gr.addColorStop(1, '#f6c26b'); g.fillStyle = gr; g.fillRect(x, y, W, H); g.fillStyle = '#1d1430'; g.beginPath(); g.moveTo(x, y + H); g.lineTo(x + 30, y + 58); g.lineTo(x + 58, y + 70); g.lineTo(x + 92, y + 50); g.lineTo(x + W, y + 66); g.lineTo(x + W, y + H); g.fill(); },
		kanban(x, y) { bar(x, y, W, H, '#f4f5f7'); bar(x, y, W, 8, '#0052cc'); for (let c = 0; c < 4; c++) { rect('#ebecf0', x + 3 + c * 31, y + 11, 29, H - 14); for (let i = 0; i < 2 + Math.floor(rn() * 3); i++) { rect('#ffffff', x + 5 + c * 31, y + 14 + i * 13, 25, 11); rect(['#36b37e', '#ff5630', '#6554c0', '#ffab00'][(c + i) % 4], x + 7 + c * 31, y + 16 + i * 13, 8, 2); rect('#5e6c84', x + 7 + c * 31, y + 20 + i * 13, 16, 2); } } },
		arcade(x, y) { bar(x, y, W, H, '#050510'); for (let i = 0; i < 30; i++) rect('#ffffff', x + rn() * W, y + rn() * H, 1, 1); for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) rect(['#ff4d6d', '#ffd60a', '#4cc9f0'][r], x + 14 + c * 13, y + 8 + r * 9, 8, 5); rect('#80ff72', x + 56, y + H - 14, 14, 6); rect('#80ff72', x + 62, y + H - 18, 2, 4); rect('#ffffff', x + 60, y + 44, 2, 5); g.fillStyle = '#ffd60a'; g.font = '700 7px monospace'; g.fillText('1UP 004210', x + 4, y + 7); },
		sports(x, y) { bar(x, y, W, H, '#2f8f3a'); g.fillStyle = '#38a046'; for (let i = 0; i < W; i += 16) g.fillRect(x + i, y, 8, H); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1; g.strokeRect(x + 6.5, y + 8.5, W - 13, H - 17); g.beginPath(); g.moveTo(x + W / 2, y + 8); g.lineTo(x + W / 2, y + H - 8); g.stroke(); g.beginPath(); g.arc(x + W / 2, y + H / 2, 10, 0, Math.PI * 2); g.stroke(); for (let i = 0; i < 8; i++) rect(i < 4 ? '#e63946' : '#f1faee', x + 20 + rn() * (W - 40), y + 14 + rn() * (H - 28), 3, 4); rect('#111111', x + 4, y + 1, 52, 7); rect('#ffffff', x + 6, y + 3, 20, 3); rect('#ffd60a', x + 34, y + 3, 18, 3); },
		news(x, y) { bar(x, y, W, H, '#1d3557'); const gr = g.createLinearGradient(0, y, 0, y + H); gr.addColorStop(0, '#457b9d'); gr.addColorStop(1, '#1d3557'); g.fillStyle = gr; g.fillRect(x, y, W, H - 16); g.fillStyle = '#e0b49a'; g.beginPath(); g.arc(x + 44, y + 26, 9, 0, Math.PI * 2); g.fill(); rect('#2b2d42', x + 30, y + 35, 28, 22); rect('#c1121f', x, y + H - 16, W, 10); rect('#ffffff', x + 4, y + H - 13, 70, 3); rect('#111111', x, y + H - 6, W, 6); lines(x + 4, y + H - 5, W - 8, 1, 4, ['#dddddd']); rect('#f1faee', x + 80, y + 10, 40, 26); },
		game(x, y) { const gr = g.createLinearGradient(0, y, 0, y + H); gr.addColorStop(0, '#87ceeb'); gr.addColorStop(1, '#e0f4ff'); g.fillStyle = gr; g.fillRect(x, y, W, H); g.fillStyle = '#5a8f3d'; g.beginPath(); g.moveTo(x, y + H); g.lineTo(x, y + 48); g.quadraticCurveTo(x + 40, y + 34, x + 70, y + 50); g.quadraticCurveTo(x + 100, y + 60, x + W, y + 44); g.lineTo(x + W, y + H); g.fill(); rect('#7a5230', x + 24, y + 30, 4, 20); g.fillStyle = '#2d6a2d'; g.beginPath(); g.arc(x + 26, y + 28, 9, 0, Math.PI * 2); g.fill(); rect('#d62828', x + 60, y + 42, 6, 9); rect('#f4d35e', x + 61, y + 38, 4, 4); rect('rgba(0,0,0,.35)', x + 4, y + 4, 40, 5); rect('#e63946', x + 5, y + 5, 28, 3); },
		crm(x, y) { bar(x, y, W, H, '#f3f2f2'); bar(x, y, W, 9, '#032d60'); bar(x + 4, y + 13, W - 8, 14, '#ffffff'); rect('#0176d3', x + 8, y + 16, 8, 8); rect('#181818', x + 20, y + 17, 40, 3); bar(x + 4, y + 30, W - 8, H - 34, '#ffffff'); for (let i = 0; i < 7; i++) { rect('#e5e5e5', x + 4, y + 36 + i * 7, W - 8, 1); rect('#0176d3', x + 8, y + 32 + i * 7, 22, 2); rect('#444444', x + 40, y + 32 + i * 7, 26, 2); rect(['#2e844a', '#dd7a01', '#ba0517'][i % 3], x + 90, y + 32 + i * 7, 18, 2); } },
	};
	const names = Object.keys(TILE);
	for (const n of names) {
		const t = TILE[n], x = (t % COLS) * W, y = Math.floor(t / COLS) * H;
		g.save(); g.beginPath(); g.rect(x, y, W, H); g.clip();
		DRAW[n](x, y);
		g.restore();
	}
	tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}
