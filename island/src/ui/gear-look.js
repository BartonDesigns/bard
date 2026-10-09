// The look shared by the gear screen and the trade window (ui/gear.js, ui/trade-window.js): a
// dark frame with brass trim and inner shadows, item slots with a tier-coloured edge and glow, a
// level badge and a stack count, tooltips with stats and their differences, coin stacks, and
// small sounds for placing, removing and accepting. All drawn here: no images, no fonts loaded.

import { ARMS_CATALOG } from '../gameplay/arms.js';
import { TIERS, statsOf, compareStats, xpNeed, MAX_LEVEL } from '../gameplay/gear-levels.js';
import { iconOf } from '../crysis/held-items.js';
import { soundBus } from '../world/soundbus.js';

export const nameOf = (id) => ARMS_CATALOG[id]?.name || id;
export const tierName = (t) => TIERS[t]?.name || 'Common';
export const tierColor = (t) => TIERS[t]?.color || '#c9d1d3';

const CSS = `
.g99-frame{background:linear-gradient(180deg,rgba(22,30,36,.97),rgba(9,13,17,.97));border:1px solid #7a6136;border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,225,160,.18),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 0 34px rgba(0,0,0,.6),0 14px 44px rgba(0,0,0,.55);color:#efe6d2;font:13px system-ui;box-sizing:border-box}
.g99-frame *{box-sizing:border-box}
.g99-title{font:600 15px Georgia,'Times New Roman',serif;letter-spacing:.06em;color:#e9cf93;text-shadow:0 1px 0 #000}
.g99-label{font:700 10px system-ui;letter-spacing:.12em;color:#b89a62;text-transform:uppercase}
.g99-rule{height:1px;background:linear-gradient(90deg,transparent,#8a6d3b,transparent);margin:2px 0;flex:none}
.g99-panel{position:relative;border:1px solid #4f4128;border-radius:10px;padding:8px;background:rgba(0,0,0,.3);box-shadow:inset 0 0 20px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,225,160,.06);transition:border-color .25s,box-shadow .25s}
.g99-panel.ok{border-color:#5fe08a;animation:g99pulse 1.3s ease-in-out infinite}
.g99-panel.flash{animation:g99flash .7s ease-out}
.g99-panel .check{position:absolute;right:8px;top:6px;font:700 12px system-ui;color:#7dffaa;text-shadow:0 0 6px rgba(95,224,138,.8)}
@keyframes g99pulse{0%,100%{box-shadow:inset 0 0 20px rgba(0,0,0,.7),0 0 10px rgba(95,224,138,.35)}50%{box-shadow:inset 0 0 20px rgba(0,0,0,.7),0 0 22px rgba(95,224,138,.8)}}
@keyframes g99flash{0%{background:rgba(255,190,80,.38)}100%{background:rgba(0,0,0,.3)}}
.g99-grid{display:grid;grid-template-columns:repeat(var(--cols,6),var(--slot,48px));gap:5px;justify-content:center}
.g99-slot{position:relative;width:var(--slot,48px);height:var(--slot,48px);border-radius:7px;background:radial-gradient(circle at 50% 38%,#2b343b,#0c1115);border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 2px 7px rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;padding:0;color:inherit;transition:transform .12s}
.g99-slot.item{border-color:var(--tc);box-shadow:inset 0 2px 7px rgba(0,0,0,.85),inset 0 0 calc(var(--tg) * 16px) var(--tc),0 0 calc(var(--tg) * 9px) var(--tc)}
.g99-slot.item:hover{transform:translateY(-1px)}
.g99-slot img{width:90%;height:90%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.g99-slot .lv{position:absolute;right:2px;bottom:1px;font:800 10px system-ui;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;pointer-events:none}
.g99-slot .n{position:absolute;left:3px;top:1px;font:800 10px system-ui;color:#f4e3b0;text-shadow:0 1px 2px #000;pointer-events:none}
.g99-slot.held::after{content:'✋';position:absolute;left:2px;bottom:0;font-size:10px}
.g99-slot.new{animation:g99snap .24s ease-out}
.g99-slot.drop{outline:2px dashed #e9cf93;outline-offset:2px}
@keyframes g99snap{0%{transform:scale(.5);opacity:.2}70%{transform:scale(1.08)}100%{transform:scale(1)}}
.g99-btn{min-height:44px;min-width:44px;padding:8px 14px;border-radius:9px;border:1px solid #7a6136;background:linear-gradient(180deg,#2e261a,#16110b);color:#f1dfb4;font:600 13px system-ui;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,225,160,.22),0 2px 6px rgba(0,0,0,.4);touch-action:manipulation}
.g99-btn:disabled{opacity:.42;cursor:default}
.g99-btn.go{background:linear-gradient(180deg,#2f6b45,#163723);border-color:#5fe08a;color:#eafff0;font:700 15px system-ui;letter-spacing:.04em}
.g99-btn.quiet{background:transparent;box-shadow:none}
.g99-coins{display:flex;align-items:center;gap:8px;font:700 14px system-ui;color:#f3d27a;text-shadow:0 1px 0 #000}
.g99-coin{width:20px;height:10px;border-radius:50%;margin-top:9px;background:radial-gradient(ellipse at 40% 35%,#fff0b8,#c8962e);box-shadow:0 -3px 0 #9d721c,0 -4px 0 #f0cf74,0 -7px 0 #9d721c,0 -8px 0 #f3d585;flex:none}
.g99-tip{position:fixed;z-index:40;max-width:250px;padding:10px 12px;border-radius:9px;background:rgba(8,10,12,.97);border:1px solid #7a6136;box-shadow:0 8px 24px rgba(0,0,0,.7);pointer-events:none;font:12px system-ui;line-height:1.5;color:#e8e0cc}
.g99-tip b{font:600 14px Georgia,serif}
.g99-up{color:#6ff09a}.g99-down{color:#ff7a6a}
.g99-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.7)}.g99-bar>i{display:block;height:100%;background:linear-gradient(90deg,#b48a3c,#f3d27a)}
.g99-ghost{position:fixed;z-index:50;pointer-events:none;opacity:.9;transform:translate(-50%,-50%) scale(1.1)}
.g99-count{font:700 13px system-ui;color:#e9cf93}
`;
let styled = false;
export function useStyle() {
	if (styled) return;
	styled = true;
	const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
}

export const el = (tag, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== '') e.textContent = text; return e; };
export function btn(label, fn, cls = '', title = '') {
	const b = el('button', 'g99-btn ' + cls, label); b.type = 'button';
	if (title) { b.title = title; b.setAttribute('aria-label', title); }
	b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); };
	return b;
}
export function coins(n) { const d = el('div', 'g99-coins'); d.append(el('span', 'g99-coin'), el('span', '', `${(n || 0).toLocaleString()}`)); return d; }
export function bar(frac) { const b = el('div', 'g99-bar'), i = el('i'); i.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`; b.append(i); return b; }
export const xpFrac = (x) => (x.l >= MAX_LEVEL ? 1 : x.x / xpNeed(x.l));

// an item slot: the item's picture (or icon), its tier's edge and glow, level and count
export function slot(inst, { thumb = '', count = 0, held = false, fresh = false, title = '' } = {}) {
	const s = el('button', 'g99-slot');
	s.type = 'button';
	if (!inst) return s;
	const T = TIERS[inst.t] || TIERS[0];
	s.classList.add('item');
	if (held) s.classList.add('held');
	if (fresh) s.classList.add('new');
	s.style.setProperty('--tc', T.color); s.style.setProperty('--tg', String(0.25 + T.glow));
	if (thumb) { const im = el('img'); im.src = thumb; im.alt = ''; s.append(im); } else s.append(iconOf(inst.i));
	s.append(el('span', 'lv', String(inst.l)));
	if (count > 1) s.append(el('span', 'n', `×${count}`));
	s.setAttribute('aria-label', title || `${tierName(inst.t)} ${nameOf(inst.i)}, level ${inst.l}${count > 1 ? `, ${count}` : ''}`);
	return s;
}

const fmt = (v, unit) => `${v}${unit === '%' ? '%' : unit ? ' ' + unit : ''}`;
// a tooltip's content: name in its tier's colour, tier and level, the stats, and the change
// against `vs` (green better, red worse) with a word for what is compared
export function tipContent(inst, vs = null, vsLabel = '') {
	const d = el('div');
	const nm = el('b', '', nameOf(inst.i)); nm.style.color = tierColor(inst.t);
	d.append(nm, el('div', '', `${tierName(inst.t)} · Level ${inst.l}${inst.l < MAX_LEVEL ? ` (${inst.x}/${xpNeed(inst.l)} xp)` : ' (max)'}`));
	const rows = vs ? compareStats(vs, inst) : statsOf(inst).map((r) => ({ ...r, b: r.value, delta: 0 }));
	for (const r of rows) {
		const line = el('div', '', `${r.label}: ${fmt(r.b, r.unit)}`);
		if (vs && r.delta) { const dd = el('span', r.delta > 0 ? 'g99-up' : 'g99-down', ` ${r.delta > 0 ? '▲ +' : '▼ '}${r.delta}`); line.append(dd); }
		d.append(line);
	}
	if (vsLabel) { const v = el('div', '', vsLabel); v.style.opacity = '.7'; v.style.marginTop = '4px'; d.append(v); }
	const use = ARMS_CATALOG[inst.i]?.use;
	if (use) { const u = el('div', '', use); u.style.cssText = 'opacity:.62;margin-top:4px;font-style:italic;'; d.append(u); }
	return d;
}
let tipEl = null;
export function showTip(content, x, y) {
	hideTip();
	tipEl = el('div', 'g99-tip'); tipEl.append(content);
	document.body.appendChild(tipEl);
	const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
	tipEl.style.left = `${Math.max(6, Math.min(innerWidth - w - 6, x + 14))}px`;
	tipEl.style.top = `${Math.max(6, Math.min(innerHeight - h - 6, y - h - 10 < 6 ? y + 18 : y - h - 10))}px`;
}
export function hideTip() { tipEl?.remove(); tipEl = null; }

// small sounds, made on the spot: a wooden tick to place, a lighter one to take back, a
// two-note chime to accept, a soft low note when a change clears the accepts, a chord when done
export function sound(kind) {
	const bus = soundBus();
	if (!bus) return;
	const { ctx, out } = bus, t = ctx.currentTime;
	const note = (f, at, len, vol, type = 'sine') => {
		const o = ctx.createOscillator(), g = ctx.createGain();
		o.type = type; o.frequency.setValueAtTime(f, t + at);
		g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(vol, t + at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
		o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + len + 0.02);
	};
	if (kind === 'place') { note(180, 0, 0.09, 0.18, 'triangle'); note(360, 0, 0.05, 0.06); }
	else if (kind === 'remove') { note(420, 0, 0.06, 0.1, 'triangle'); }
	else if (kind === 'accept') { note(660, 0, 0.18, 0.1); note(990, 0.09, 0.25, 0.08); }
	else if (kind === 'flash') { note(220, 0, 0.2, 0.08); }
	else if (kind === 'done') { for (const [f, k] of [[523, 0], [659, 0.06], [784, 0.12]]) note(f, k, 0.5, 0.07); }
}
