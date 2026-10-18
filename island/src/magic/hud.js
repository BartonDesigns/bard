// Magic on screen: the bar along the bottom (your weapons on 1 to 5, your spells on 6 to 0, each
// spell's cooldown sweeping round it, dimmed when you lack the mana), the mana bar and the two
// strands of fabric you carry (a tap opens the skills and magic menu, magic/skills-ui.js, and a
// star on it says a skill point is waiting), a word when the mouse is the camera's, and the
// word when you go up a level. A tap on the bar casts or takes up the weapon, on a touch screen too.

import { SPELL, SCHOOLS, SLOTS, manaCost, cooldownLeft, manaMax } from './spells.js';
import { pointsOf } from './skills.js';

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
@media (max-width:660px){#l99-island-mount:not(.l99-touch) .mg-bar{left:calc(50% - 34px)}}
.mg-fab b{font-weight:700}.mg-fab .l{color:#ffd27a}.mg-fab .d{color:#b39aff}
.mg-mode{position:absolute;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(10,16,20,.6);color:#eef6f4;font:600 12px/1 system-ui,sans-serif;padding:7px 12px;border-radius:14px;box-shadow:0 0 0 1px rgba(255,255,255,.14);pointer-events:none;z-index:7;opacity:0;transition:opacity .25s}
.mg-fab .pt{display:inline-block;margin-left:5px;padding:0 5px;border-radius:8px;background:#01a982;color:#fff;font-size:10px;line-height:15px;box-shadow:0 0 10px rgba(1,169,130,.8);animation:mgPt 2s ease-in-out infinite}
@keyframes mgPt{50%{box-shadow:0 0 18px rgba(1,169,130,1)}}
.mg-lvl{position:absolute;left:50%;top:calc(18% + env(safe-area-inset-top));transform:translate(-50%,0);pointer-events:none;z-index:8;text-align:center;color:#fff;opacity:0;font:600 13px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.08em;text-shadow:0 2px 12px rgba(0,0,0,.8);white-space:nowrap}
.mg-lvl b{display:block;font:200 44px/1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.3em;margin-bottom:6px;background:linear-gradient(180deg,#fff 30%,#5eead4);-webkit-background-clip:text;background-clip:text;color:transparent}
.mg-lvl i{display:block;height:1px;margin:8px auto;width:0;background:linear-gradient(90deg,transparent,#5eead4,transparent)}
.mg-lvl.go{animation:mgLvl 4.2s ease forwards}.mg-lvl.go i{animation:mgLine 1.2s .2s ease-out forwards}
@keyframes mgLvl{0%{opacity:0;transform:translate(-50%,10px)}10%,78%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}
@keyframes mgLine{to{width:260px}}
/* (on a touch screen the thumbs' controls hold the bottom corners: the bar sits above their stack) */
.l99-touch .mg-bar{bottom:calc(var(--l99-low,88px) + 28px + env(safe-area-inset-bottom))}
.l99-touch .mg-mana{bottom:calc(var(--l99-low,88px) + 74px + env(safe-area-inset-bottom))}
`;
const STYLE_ID = 'mg-hud-style';
const KEYS = ['6', '7', '8', '9', '0'];
const WEAPON_TAG = { 'aurora-trail-rifle': 'Rifle', 'mossback-scout-rifle': 'Scout', 'warden-spark-carbine': 'Carb', 'reedline-hunting-bow': 'Bow', bat: 'Bat', pipe: 'Pipe', bottle: 'Bottle', knife: 'Knife', machete: 'Blade' };

// onBook(): open the skills and magic menu; bookOpen(): whether it is open
export function createMagicHud({ mount, state, hotbar, onCast, onPress, onBook = () => {}, bookOpen = () => false, isTouch = false }) {
	if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
	const mk = (tag, cls, parent, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent?.appendChild(e); return e; };

	// ---------- the bar ----------
	const bar = mk('div', 'mg-bar', mount), wg = mk('div', 'grp', bar); mk('div', 'sep', bar); const sg = mk('div', 'grp', bar);
	const wSlots = [...Array(5)].map((_, i) => { const e = mk('div', 'mg-s empty', wg, `<span class="k">${i + 1}</span><span class="w"></span>`); e.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); onPress(i); }); return e; });
	const sSlots = KEYS.map((k, i) => { const e = mk('div', 'mg-s empty', sg, `<span class="k">${k}</span><span class="g"></span><div class="cd"></div>`); e.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); onCast(i, { shift: x.shiftKey, tap: true }); }); return e; });
	if (isTouch) for (const e of [...wSlots, ...sSlots]) { e.style.width = e.style.height = '34px'; }
	const mana = mk('div', 'mg-mana', mount, '<div></div>'), manaFill = mana.firstChild;
	// (your fabric at the bar's end: a tap opens the skills and magic menu)
	const fab = mk('div', 'mg-fab', bar);
	fab.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); onBook(); });
	const lvl = mk('div', 'mg-lvl', mount);
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
				e.title = sp ? `${sp.name} (${KEYS[i]})` : `Key ${KEYS[i]}: no spell (slot one in skills and magic, Tab)`;
			});
			const cd = sp ? Math.round(cooldownLeft(state, id, now) * 60) / 60 : 0;
			put(e, 'cd', cd, (v) => { e.querySelector('.cd').style.background = v > 0 ? `conic-gradient(rgba(0,0,0,.6) ${v * 360}deg, transparent 0)` : ''; });
			put(e, 'dim', !!sp && state.mana < manaCost(state, sp), (v) => e.classList.toggle('dim', v));
		}
		const mx = manaMax(state);
		put(mana, 'm', Math.round(state.mana / mx * 200), (v) => { manaFill.style.transform = `scaleX(${Math.max(0, Math.min(1, v / 200))})`; mana.title = `Mana ${Math.round(state.mana)} / ${mx}`; });
		const pts = pointsOf(state), sig = `${state.fabric.light}|${state.fabric.dark}|${pts}`;
		if (sig !== lastSig) {
			lastSig = sig;
			fab.innerHTML = `<span class="l">☀ <b>${state.fabric.light}</b></span>${pts ? `<span class="pt">+${pts}</span>` : ''}<br><span class="d">☾ <b>${state.fabric.dark}</b></span>`;
			fab.title = `Aether fabric: light and dark.${pts ? ` ${pts} skill point${pts > 1 ? 's' : ''} to spend.` : ''} Tab or N (or a tap here) opens skills and magic.`;
		}
	}
	// the word when you go up a level
	function levelUp(level, pts) {
		lvl.innerHTML = `<b>LEVEL ${level}</b><i></i>${pts === 1 ? 'A skill point to spend' : `${pts} skill points to spend`} · ${isTouch ? 'tap ☀ on the bar' : 'Tab'} for skills and magic`;
		lvl.classList.remove('go'); void lvl.offsetWidth; lvl.classList.add('go');
	}
	function setMode(m) { mode.style.opacity = m === 'camera' ? '1' : '0'; }
	function show(on) { for (const e of [bar, mana]) e.style.opacity = on ? '1' : '0'; }

	function dispose() { for (const e of [bar, mana, mode, lvl]) e.remove(); }
	return { update, setMode, show, levelUp, open: onBook, isOpen: bookOpen, dispose };
}
