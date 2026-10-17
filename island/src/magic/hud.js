// Magic on screen: the bar along the bottom (your weapons on 1 to 5, your spells on 6 to 0, each
// spell's cooldown sweeping round it, dimmed when you lack the mana), the mana bar and the two
// strands of fabric you carry, a word when the mouse is the camera's, and the spellbook (N):
// every school's ladder of spells, what each takes to weave, weaving it, and binding what you
// know to the keys 6 to 0. A tap on the bar casts or takes up the weapon, on a touch screen too.

import { SPELLS, SPELL, SCHOOLS, SLOTS, weaveCost, weaveBlock, manaCost, cooldownLeft, manaMax, TWILIGHT_NEEDS } from './spells.js';

const CSS = `
.mg-bar{position:absolute;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:6px;align-items:flex-end;pointer-events:none;z-index:6;font:600 11px/1 system-ui,-apple-system,Segoe UI,sans-serif;color:#eef6f4;transition:opacity .4s}
.mg-bar .grp{display:flex;gap:4px}
.mg-bar .sep{width:1px;height:30px;background:rgba(255,255,255,.18);margin:0 4px;align-self:center}
.mg-s{position:relative;width:40px;height:40px;border-radius:9px;background:rgba(10,16,20,.55);box-shadow:0 0 0 1px rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.mg-s .k{position:absolute;left:4px;top:3px;font-size:9px;opacity:.7}
.mg-s .g{font-size:19px;line-height:1;text-shadow:0 0 8px currentColor}
.mg-s .w{font-size:10px;letter-spacing:.4px;text-transform:uppercase;opacity:.9}
.mg-s .cd{position:absolute;inset:0;border-radius:9px;pointer-events:none}
.mg-s.held{box-shadow:0 0 0 2px #7fe0c0}
.mg-s.dim .g{opacity:.35}
.mg-s.empty{opacity:.45}
.mg-mana{position:absolute;left:50%;bottom:calc(60px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(260px,52vw);height:4px;border-radius:2px;background:rgba(10,16,20,.55);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.1);pointer-events:none;z-index:6}
.mg-mana>div{height:100%;width:100%;transform-origin:left;background:linear-gradient(90deg,#5a7cff,#a8c4ff);transition:transform .15s}
.mg-fab{align-self:center;margin-left:6px;font:600 11px/1.35 system-ui,sans-serif;color:#eef6f4;text-shadow:0 1px 2px rgba(0,0,0,.6);pointer-events:auto;cursor:pointer;white-space:nowrap}
.mg-fab b{font-weight:700}.mg-fab .l{color:#ffd27a}.mg-fab .d{color:#b39aff}
.mg-mode{position:absolute;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(10,16,20,.6);color:#eef6f4;font:600 12px/1 system-ui,sans-serif;padding:7px 12px;border-radius:14px;box-shadow:0 0 0 1px rgba(255,255,255,.14);pointer-events:none;z-index:7;opacity:0;transition:opacity .25s}
.mg-book{position:absolute;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(4,8,12,.62);font:500 13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:#eef6f4}
.mg-book .sheet{width:min(980px,96vw);max-height:min(86vh,900px);overflow:auto;background:#10161b;border-radius:14px;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 20px 60px rgba(0,0,0,.6);padding:16px 18px 20px}
.mg-book .top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.mg-book h2{font:700 18px/1.2 system-ui,sans-serif;margin:0;flex:1;letter-spacing:.3px}
.mg-book .stat{font-size:12px;opacity:.85}
.mg-book .tabs{display:flex;gap:6px;margin:12px 0 4px}
.mg-book .tab{padding:7px 14px;border-radius:16px;background:rgba(255,255,255,.06);cursor:pointer;font-weight:600;border:0;color:inherit;font-size:13px}
.mg-book .tab.on{background:rgba(255,255,255,.16)}
.mg-book .school{margin-top:14px}
.mg-book .school h3{font:700 13px/1.3 system-ui,sans-serif;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 2px}
.mg-book .school p{margin:0 0 8px;font-size:12px;opacity:.7}
.mg-book .row{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.mg-card{background:rgba(255,255,255,.04);border-radius:10px;padding:10px;box-shadow:0 0 0 1px rgba(255,255,255,.07);display:flex;flex-direction:column;gap:5px}
.mg-card.known{box-shadow:0 0 0 1px rgba(127,224,192,.45)}
.mg-card.locked{opacity:.55}
.mg-card .h{display:flex;align-items:center;gap:8px}
.mg-card .g{font-size:20px;width:26px;text-align:center;text-shadow:0 0 8px currentColor}
.mg-card .n{font-weight:700;flex:1}
.mg-card .t{font-size:10px;opacity:.7;letter-spacing:.8px;text-transform:uppercase}
.mg-card .d{font-size:12px;opacity:.82}
.mg-card .m{font-size:11px;opacity:.7}
.mg-card .why{font-size:11px;color:#ffb08a}
.mg-card .acts{display:flex;gap:4px;flex-wrap:wrap}
.mg-card button{border:0;border-radius:7px;padding:5px 9px;font:600 12px system-ui,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:inherit}
.mg-card button.weave{background:linear-gradient(135deg,#01a982,#10b981);color:#fff}
.mg-card button.on{background:rgba(127,224,192,.35)}
.mg-x{border:0;background:rgba(255,255,255,.08);color:inherit;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:14px}
.mg-help{font-size:12px;opacity:.72;margin-top:12px;line-height:1.5}
/* (on a touch screen the thumbs' controls hold the bottom corners: the bar sits above their stack) */
.l99-touch .mg-bar{bottom:calc(var(--l99-low,88px) + 28px + env(safe-area-inset-bottom))}
.l99-touch .mg-mana{bottom:calc(var(--l99-low,88px) + 74px + env(safe-area-inset-bottom))}
`;
const STYLE_ID = 'mg-hud-style';
const KEYS = ['6', '7', '8', '9', '0'];
const WEAPON_TAG = { 'aurora-trail-rifle': 'Rifle', 'mossback-scout-rifle': 'Scout', 'warden-spark-carbine': 'Carb', 'reedline-hunting-bow': 'Bow', bat: 'Bat', pipe: 'Pipe', bottle: 'Bottle', knife: 'Knife', machete: 'Blade' };

export function createMagicHud({ mount, state, hotbar, onCast, onPress, onWeave, onBind, isTouch = false }) {
	if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
	const mk = (tag, cls, parent, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent?.appendChild(e); return e; };
	const stop = (e) => { for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'wheel', 'click']) e.addEventListener(ev, (x) => { if (ev !== 'click' && ev !== 'keydown') x.stopPropagation(); if (ev === 'keydown' && x.key !== 'Escape' && x.key.toLowerCase() !== 'n') x.stopPropagation(); }); return e; };

	// ---------- the bar ----------
	const bar = mk('div', 'mg-bar', mount), wg = mk('div', 'grp', bar); mk('div', 'sep', bar); const sg = mk('div', 'grp', bar);
	const wSlots = [...Array(5)].map((_, i) => { const e = mk('div', 'mg-s empty', wg, `<span class="k">${i + 1}</span><span class="w"></span>`); e.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); onPress(i); }); return e; });
	const sSlots = KEYS.map((k, i) => { const e = mk('div', 'mg-s empty', sg, `<span class="k">${k}</span><span class="g"></span><div class="cd"></div>`); e.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); onCast(i, { shift: x.shiftKey, tap: true }); }); return e; });
	if (isTouch) for (const e of [...wSlots, ...sSlots]) { e.style.width = e.style.height = '34px'; }
	const mana = mk('div', 'mg-mana', mount, '<div></div>'), manaFill = mana.firstChild;
	// (your fabric at the bar's end: a tap opens the spellbook)
	const fab = mk('div', 'mg-fab', bar);
	fab.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); open(); });
	const mode = mk('div', 'mg-mode', mount, 'Camera · drag to look · double-tap Alt / ⌥ to aim');
	let lastSig = '', wT = 0;
	// (only what changed is written: the bar is looked at every frame)
	const was = new Map();
	const put = (e, k, v, f) => { const key = e; let m = was.get(key); if (!m) was.set(key, (m = {})); if (m[k] !== v) { m[k] = v; f(v); } };
	function update(now) {
		wT -= 1;
		if (wT <= 0) {
			wT = 15;
			const ws = hotbar?.slots?.() || [];
			for (let i = 0; i < 5; i++) {
				const s = ws[i], e = wSlots[i];
				put(e, 'w', s ? `${s.id}|${s.held}` : '', () => {
					e.classList.toggle('empty', !s); e.classList.toggle('held', !!s?.held);
					e.querySelector('.w').textContent = s ? WEAPON_TAG[s.id] || s.name.slice(0, 4) : '';
					e.title = s ? `${s.name} (${i + 1})` : `Key ${i + 1}: no weapon`;
				});
			}
		}
		for (let i = 0; i < SLOTS; i++) {
			const id = state.binds[i], sp = SPELL[id], e = sSlots[i];
			put(e, 'id', id || '', () => {
				e.classList.toggle('empty', !sp);
				const g = e.querySelector('.g');
				g.textContent = sp?.glyph || '';
				g.style.color = sp ? SCHOOLS[sp.school].color : '';
				e.title = sp ? `${sp.name} (${KEYS[i]})` : `Key ${KEYS[i]}: no spell (bind one in the spellbook, N)`;
			});
			const cd = sp ? Math.round(cooldownLeft(state, id, now) * 60) / 60 : 0;
			put(e, 'cd', cd, (v) => { e.querySelector('.cd').style.background = v > 0 ? `conic-gradient(rgba(0,0,0,.6) ${v * 360}deg, transparent 0)` : ''; });
			put(e, 'dim', !!sp && state.mana < manaCost(state, sp), (v) => e.classList.toggle('dim', v));
		}
		const mx = manaMax(state);
		put(mana, 'm', Math.round(state.mana / mx * 200), (v) => { manaFill.style.transform = `scaleX(${Math.max(0, Math.min(1, v / 200))})`; mana.title = `Mana ${Math.round(state.mana)} / ${mx}`; });
		const sig = `${state.fabric.light}|${state.fabric.dark}`;
		if (sig !== lastSig) { lastSig = sig; fab.innerHTML = `<span class="l">☀ <b>${state.fabric.light}</b></span><br><span class="d">☾ <b>${state.fabric.dark}</b></span>`; fab.title = 'Aether fabric: light and dark. N (or a tap here) opens the spellbook.'; }
		if (book.style.display !== 'none' && dirty) draw();
	}
	function setMode(m) { mode.style.opacity = m === 'camera' ? '1' : '0'; }
	function show(on) { for (const e of [bar, mana]) e.style.opacity = on ? '1' : '0'; }

	// ---------- the spellbook ----------
	const book = stop(mk('div', 'mg-book', mount)), sheet = mk('div', 'sheet', book);
	book.addEventListener('pointerdown', (e) => { if (e.target === book) close(); });
	let tab = 'light', dirty = true;
	function draw() {
		dirty = false;
		sheet.innerHTML = '';
		const top = mk('div', 'top', sheet);
		mk('h2', '', top, 'Spellbook');
		mk('div', 'stat', top, `<span style="color:#ffd27a">☀ ${state.fabric.light} light</span> · <span style="color:#b39aff">☾ ${state.fabric.dark} dark</span> fabric &nbsp;|&nbsp; affinity ${state.affinity.light} light, ${state.affinity.dark} dark &nbsp;|&nbsp; mana ${Math.round(state.mana)} / ${manaMax(state)}`);
		const x = mk('button', 'mg-x', top, '✕'); x.onclick = close;
		const tabs = mk('div', 'tabs', sheet);
		for (const [k, label] of [['light', '☀ Light'], ['dark', '☾ Dark'], ['twilight', '◐ Twilight']]) { const b = mk('button', 'tab' + (tab === k ? ' on' : ''), tabs, label); b.onclick = () => { tab = k; draw(); }; }
		if (tab === 'twilight') mk('div', 'mg-help', sheet, `Twilight spells are woven from both strands at once, and only by one who carries both deeply: ${TWILIGHT_NEEDS.map((n, i) => `tier ${i + 1} needs ${n}`).join(', ')} affinity with each. Affinity is the fabric you have woven of that strand.`);
		for (const [sk, S] of Object.entries(SCHOOLS)) {
			if (S.strand !== tab) continue;
			const sec = mk('div', 'school', sheet);
			mk('h3', '', sec, S.name).style.color = S.color;
			mk('p', '', sec, S.line);
			const row = mk('div', 'row', sec);
			for (const sp of SPELLS.filter((q) => q.school === sk).sort((a, b) => a.tier - b.tier)) card(row, sp, S);
		}
		mk('div', 'mg-help', sheet, 'Gather fabric from the aether in the world: gold motes of light where the sun falls (by day), violet motes of dark in the hollows and woods (by night), both at dusk and dawn, and rare wells of either. Walk into one to gather it. Light spells are stronger by day, dark by night, twilight at dusk and dawn. Keys 6 to 0 cast what is bound to them; 1 to 5 take up your weapons. Alt / ⌥ frees the mouse to look about (drag); a double tap of Alt / ⌥ returns to aiming; spells cast at the cursor while you look about.');
	}
	function card(row, sp, S) {
		const known = state.known.includes(sp.id), why = known ? null : weaveBlock(state, sp), c = weaveCost(sp);
		const el = mk('div', 'mg-card' + (known ? ' known' : why ? ' locked' : ''), row);
		const h = mk('div', 'h', el);
		mk('span', 'g', h, sp.glyph).style.color = S.color;
		mk('span', 'n', h, sp.name);
		mk('span', 't', h, `Tier ${sp.tier}`);
		mk('div', 'd', el, sp.desc);
		mk('div', 'm', el, `${manaCost(state, sp) || 'No'} mana · ${sp.cd >= 1 ? Math.round(sp.cd) + ' s' : sp.cd + ' s'} cooldown${known ? '' : ` · weave: ${[c.light && `☀ ${c.light}`, c.dark && `☾ ${c.dark}`].filter(Boolean).join(' + ')}`}`);
		const acts = mk('div', 'acts', el);
		if (known) {
			for (let i = 0; i < SLOTS; i++) { const b = mk('button', state.binds[i] === sp.id ? 'on' : '', acts, KEYS[i]); b.title = `Bind to ${KEYS[i]}`; b.onclick = () => { onBind(i, state.binds[i] === sp.id ? null : sp.id); dirty = true; draw(); }; }
		} else if (!why) { const b = mk('button', 'weave', acts, 'Weave'); b.onclick = () => { onWeave(sp.id); dirty = true; draw(); }; }
		else mk('div', 'why', el, why);
	}
	function open() { book.style.display = 'flex'; dirty = true; draw(); if (document.pointerLockElement) document.exitPointerLock(); }
	function close() { book.style.display = 'none'; }
	const isOpen = () => book.style.display !== 'none';
	function dispose() { for (const e of [bar, mana, mode, book]) e.remove(); }
	return { update, setMode, show, open, close, toggle: () => (isOpen() ? close() : open()), isOpen, dispose, touchUp: () => { dirty = true; } };
}
