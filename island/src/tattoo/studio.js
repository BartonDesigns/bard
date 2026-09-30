// The tattoo studio: a pad to draw a design on (a steady line, dots, dashes or the tribal
// stroke, in the inks that hold), the flash sheet's shapes to start from, and the chair: pick
// where it goes, turn and slide and size it, and see it on your own body as you do. Up to six
// pieces, kept in this browser and worn wherever you go (people/avatar.js).

import { INKS, STYLES, SHAPES, newDesign, drawDesign } from './ink.js';
import { SLOTS, MAX, inkAtlas, applyInk } from './skinink.js';

const KEY = 'l99-ink';
const FOCUS = { upperarm: 1.35, forearm: 1.05, thigh: 0.7, calf: 0.35, torso: 1.3, neck: 1.55 };
const SIDE = { L: 1, R: -1 };

// the pieces kept in this browser: [{ design, slot, angle, along, size, rot }]
export function loadInk() {
	try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return Array.isArray(v?.pieces) ? v.pieces.slice(0, MAX) : []; } catch { return []; }
}
function saveInk(pieces) {
	try { localStorage.setItem(KEY, JSON.stringify({ pieces })); return true; } catch { return false; }
}
// your own pieces on your own body (and the texture they are drawn in)
let OWN = null;
export function wearOwnInk(P, pieces = loadInk()) {
	if (!OWN) OWN = inkAtlas([], 4, 2, 256);
	OWN.draw(pieces.map((p) => p.design));
	applyInk(P.skinMat, P, pieces.map((p, i) => ({ ...p, tile: OWN.tiles[i] })), OWN.tex);
	return OWN;
}

const css = (el, s) => { el.style.cssText = s; return el; };
const el = (tag, s = '', text = '') => { const e = css(document.createElement(tag), s); if (text) e.textContent = text; return e; };
const BTN = 'min-height:36px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#fff;font:600 13px system-ui;cursor:pointer;';
const ON = 'background:#01a982;border-color:#01a982;';

export function createTattooStudio({ mount, avatar, player, setCine, hint = () => {}, isPhone = false }) {
	let root = null, pieces = [], cur = 0, open = false;
	const tool = { mode: 'pen', style: 'line', ink: 'black', width: 0.02, shape: 'star', fill: false };
	let orbit = 0, drag = null, lastError = null;

	function piece() { return pieces[cur]; }
	function fresh() { return { design: newDesign(), slot: 'forearm.L', angle: 0, along: 0.5, size: 0.1, rot: 0 }; }
	// the body under the needle: your own, stood before the camera
	function wear() { for (const me of [avatar.me, avatar.chairMe]) if (me) wearOwnInk(me.P, pieces); }

	// ---------- the pad ----------
	let pad = null, pg = null, live = null;
	function drawPad() {
		const n = pad.width;
		pg.clearRect(0, 0, n, n);
		pg.fillStyle = '#d9b89c'; pg.fillRect(0, 0, n, n);                       // (skin, to draw on)
		pg.strokeStyle = 'rgba(0,0,0,.12)'; pg.setLineDash([6, 6]); pg.strokeRect(n * 0.03, n * 0.03, n * 0.94, n * 0.94); pg.setLineDash([]);
		const d = piece()?.design;
		if (d) drawDesign(pg, live ? { marks: [...d.marks, live] } : d, n * 0.03, n * 0.03, n * 0.94);
	}
	function padXY(e) { const r = pad.getBoundingClientRect(); return [Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width - 0.03) / 0.94)), Math.min(1, Math.max(0, ((e.clientY - r.top) / r.height - 0.03) / 0.94))]; }
	function padDown(e) {
		e.preventDefault(); e.stopPropagation();
		if (!piece()) return;
		pad.setPointerCapture(e.pointerId);
		const [x, y] = padXY(e);
		live = tool.mode === 'pen'
			? { kind: 'stroke', pts: [[x, y]], style: tool.style, ink: tool.ink, size: tool.width }
			: { kind: 'shape', shape: tool.shape, x, y, s: 0.12, rot: 0, style: tool.style, ink: tool.ink, size: tool.width, fill: tool.fill, x0: x, y0: y };
		drawPad();
	}
	function padMove(e) {
		if (!live) return;
		e.preventDefault();
		const [x, y] = padXY(e);
		if (live.kind === 'stroke') { const q = live.pts[live.pts.length - 1]; if (Math.hypot(x - q[0], y - q[1]) > 0.004) live.pts.push([x, y]); }
		else { live.s = Math.max(0.04, Math.hypot(x - live.x0, y - live.y0)); live.rot = Math.atan2(y - live.y0, x - live.x0); }
		drawPad();
	}
	function padUp() {
		if (!live) return;
		const m = live; live = null;
		delete m.x0; delete m.y0;
		piece().design.marks.push(m);
		drawPad(); wear();
	}

	// ---------- the controls ----------
	function row(parent, label) { const r = el('div', 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;'); if (label) r.appendChild(el('span', 'font:12px system-ui;opacity:.7;min-width:52px;', label)); parent.appendChild(r); return r; }
	function choice(parent, items, get, set, name = (v) => v) {
		const bs = items.map((v) => { const b = el('button', BTN, name(v)); b.onclick = () => { set(v); paint(); }; parent.appendChild(b); return [v, b]; });
		const paint = () => { for (const [v, b] of bs) b.style.cssText = BTN + (get() === v ? ON : ''); };
		paint();
		return paint;
	}
	function slider(parent, label, min, max, step, get, set, fmt) {
		const r = row(parent, label), s = el('input', 'flex:1;min-width:120px;accent-color:#01a982;'), v = el('span', 'font:12px system-ui;opacity:.8;min-width:48px;text-align:right;');
		s.type = 'range'; s.min = min; s.max = max; s.step = step; s.setAttribute('aria-label', label);
		const show = () => { s.value = get(); v.textContent = fmt(get()); };
		s.oninput = () => { set(+s.value); v.textContent = fmt(+s.value); wear(); };
		r.append(s, v);
		return show;
	}

	let refresh = () => {};
	function build() {
		root = el('div', `position:absolute;z-index:40;${isPhone ? 'left:0;right:0;bottom:0;max-height:62vh;border-radius:16px 16px 0 0;' : 'right:12px;top:12px;bottom:12px;width:min(420px,92vw);border-radius:16px;'}overflow:auto;background:rgba(18,18,18,.94);border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.6);backdrop-filter:blur(8px);color:#fff;padding:14px;font:14px system-ui;`);
		root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Tattoo studio');
		for (const ev of ['pointerdown', 'touchstart', 'wheel', 'keydown']) root.addEventListener(ev, (e) => e.stopPropagation());
		const head = el('div', 'display:flex;align-items:center;justify-content:space-between;');
		head.append(el('div', 'font-weight:700;letter-spacing:.06em;', 'TATTOO STUDIO'));
		const close = el('button', BTN, 'Done'); close.onclick = () => finish(true); head.append(close);
		root.append(head);

		// the pieces
		const pr = row(root, 'Pieces');
		const drawPieces = () => {
			pr.querySelectorAll('button').forEach((b) => b.remove());
			pieces.forEach((p, i) => { const b = el('button', BTN + (i === cur ? ON : ''), String(i + 1)); b.setAttribute('aria-label', 'Piece ' + (i + 1) + ', ' + SLOTS[p.slot].label); b.onclick = () => { cur = i; refresh(); }; pr.appendChild(b); });
			if (pieces.length < MAX) { const b = el('button', BTN, '+ New'); b.onclick = () => { pieces.push(fresh()); cur = pieces.length - 1; refresh(); wear(); }; pr.appendChild(b); }
			if (pieces.length) { const b = el('button', BTN + 'color:#ef4444;', 'Remove'); b.onclick = () => { pieces.splice(cur, 1); cur = Math.max(0, cur - 1); refresh(); wear(); }; pr.appendChild(b); }
		};

		// the pad
		pad = el('canvas', 'display:block;width:100%;aspect-ratio:1;margin-top:10px;border-radius:12px;touch-action:none;cursor:crosshair;');
		pad.width = pad.height = 512; pad.setAttribute('aria-label', 'Drawing pad');
		pg = pad.getContext('2d');
		pad.addEventListener('pointerdown', padDown); pad.addEventListener('pointermove', padMove);
		pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
		root.append(pad);

		// the needle
		choice(row(root, 'Tool'), ['pen', 'shape'], () => tool.mode, (v) => { tool.mode = v; }, (v) => v === 'pen' ? 'Pen' : 'Shape');
		choice(row(root, 'Line'), STYLES, () => tool.style, (v) => { tool.style = v; }, (v) => v[0].toUpperCase() + v.slice(1));
		const sr = row(root, 'Shapes');
		choice(sr, Object.keys(SHAPES), () => tool.shape, (v) => { tool.shape = v; tool.mode = 'shape'; refresh(); }, (v) => v[0].toUpperCase() + v.slice(1));
		const ir = row(root, 'Ink');
		const inks = Object.keys(INKS).map((k) => { const c = INKS[k], b = el('button', ''); b.setAttribute('aria-label', k + ' ink'); b.onclick = () => { tool.ink = k; paintInks(); }; ir.appendChild(b); return [k, b, `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`]; });
		const paintInks = () => { for (const [k, b, col] of inks) b.style.cssText = `width:32px;height:32px;border-radius:50%;cursor:pointer;background:${col};border:2px solid ${tool.ink === k ? '#01a982' : 'rgba(255,255,255,.3)'};box-shadow:${tool.ink === k ? '0 0 0 3px rgba(1,169,130,.3)' : 'none'};`; };
		paintInks();
		const fr = row(root, '');
		const fillB = el('button', BTN, 'Filled shape'); fillB.onclick = () => { tool.fill = !tool.fill; fillB.style.cssText = BTN + (tool.fill ? ON : ''); };
		const undo = el('button', BTN, 'Undo'); undo.onclick = () => { piece()?.design.marks.pop(); drawPad(); wear(); };
		const clear = el('button', BTN, 'Clear'); clear.onclick = () => { if (piece()) piece().design.marks = []; drawPad(); wear(); };
		fr.append(fillB, undo, clear);
		const showW = slider(root, 'Weight', 0.006, 0.05, 0.001, () => tool.width, (v) => { tool.width = v; }, (v) => Math.round(v * 1000) / 10 + '%');

		// the chair: where it goes
		const pl = row(root, 'Place');
		const sel = el('select', 'flex:1;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:#1a1a1a;color:#fff;padding:0 10px;font:inherit;');
		sel.setAttribute('aria-label', 'Where on the body');
		for (const [k, S] of Object.entries(SLOTS)) { const o = el('option'); o.value = k; o.textContent = S.label; sel.appendChild(o); }
		sel.onchange = () => { if (piece()) { piece().slot = sel.value; wear(); } };
		pl.appendChild(sel);
		const sA = slider(root, 'Around', -180, 180, 1, () => Math.round((piece()?.angle || 0) * 180 / Math.PI), (v) => { if (piece()) piece().angle = v * Math.PI / 180; orbit = v * Math.PI / 180; }, (v) => v === 0 ? 'front' : Math.abs(v) >= 170 ? 'back' : v + '°');
		const sL = slider(root, 'Along', 0, 100, 1, () => Math.round((piece()?.along ?? 0.5) * 100), (v) => { if (piece()) piece().along = v / 100; }, (v) => v + '%');
		const sS = slider(root, 'Size', 3, 35, 0.5, () => Math.round((piece()?.size || 0.1) * 200) / 2, (v) => { if (piece()) piece().size = v / 100; }, (v) => v + ' cm');
		const sR = slider(root, 'Turn', -180, 180, 1, () => Math.round((piece()?.rot || 0) * 180 / Math.PI), (v) => { if (piece()) piece().rot = v * Math.PI / 180; }, (v) => v + '°');

		const foot = row(root, '');
		const cancel = el('button', BTN, 'Cancel'); cancel.onclick = () => finish(false);
		const save = el('button', BTN + ON, 'Save tattoos'); save.onclick = () => finish(true);
		foot.append(cancel, save);
		foot.appendChild(el('div', 'font:11px system-ui;opacity:.55;width:100%;margin-top:4px;', 'Draw on the pad, then place it: drag the view to walk round yourself.'));

		refresh = () => { drawPieces(); drawPad(); if (piece()) sel.value = piece().slot; sA(); sL(); sS(); sR(); showW(); };
		mount.appendChild(root);
	}

	// ---------- the view: walked round you, drawn to the part being inked ----------
	function onDragDown(e) { if (open && e.target === mount.querySelector('canvas')) drag = e.clientX; }
	function onDragMove(e) { if (drag !== null) { orbit -= (e.clientX - drag) * 0.01; drag = e.clientX; } }
	function onDragUp() { drag = null; }
	function cam(camera) {
		const me = avatar.chairMe;
		if (!me) return;
		const at = me.M.S.pos, h = me.M.S.heading, sl = piece()?.slot || 'torso';
		const part = sl.split('.')[0], side = SIDE[sl.split('.')[1]] || 0;
		const y = at.y + (FOCUS[part] || 1.2) * (me.P.height / 1.75), a = h + orbit + side * (part === 'upperarm' || part === 'forearm' ? 0.9 : 0.25);
		const d = part === 'torso' ? 1.5 : 1.15;
		camera.position.set(at.x + Math.sin(a) * d, y + 0.15, at.z + Math.cos(a) * d);
		camera.lookAt(at.x + Math.cos(h) * side * 0.18, y, at.z - Math.sin(h) * side * 0.18);
	}

	async function start() {
		if (open) return;
		open = true;
		pieces = loadInk().map((p) => ({ ...p, design: { marks: [...(p.design?.marks || [])] } }));
		if (!pieces.length) pieces.push(fresh());
		cur = 0; orbit = 0;
		if (!root) build();
		root.style.display = '';
		refresh();
		const P = player().state;
		try {
			const me = await avatar.chair();
			if (!open) return;
			me.M.place(P.pos.x, P.pos.y - 1.68, P.pos.z, P.yaw + Math.PI);
			me.M.stand(); me.M.setPose('rest'); me.M.act(null);
			me.P.root.visible = true;
			wear();
			// (your body stood still in the chair, moved each frame as the rig moves anyone)
			setCine((camera, dt, t) => { me.M.want.speed = 0; me.M.update(dt || 0.016, t || 0, null); cam(camera); });
		} catch (e) { lastError = String(e?.message || e); console.warn('tattoo studio', e); }
		addEventListener('pointerdown', onDragDown); addEventListener('pointermove', onDragMove); addEventListener('pointerup', onDragUp);
		hint('Tattoo studio', 1500);
	}
	function finish(keep) {
		if (!open) return;
		open = false;
		if (keep) { pieces = pieces.filter((p) => p.design.marks.length); saveInk(pieces); }
		for (const me of [avatar.me, avatar.chairMe]) if (me) wearOwnInk(me.P);
		setCine(null);
		if (avatar.chairMe) avatar.chairMe.P.root.visible = false;
		removeEventListener('pointerdown', onDragDown); removeEventListener('pointermove', onDragMove); removeEventListener('pointerup', onDragUp);
		if (root) root.style.display = 'none';
		if (keep) hint(pieces.length ? 'Saved. Wear it well.' : 'No tattoos kept.', 2200);
	}
	// (for tests: is it open, is your body up, anything that went wrong)
	const info = () => ({ open, me: !!avatar.chairMe, shown: !!avatar.chairMe?.P.root.visible, pieces: pieces.length, error: lastError });
	return { start, finish, active: () => open, info };
}
