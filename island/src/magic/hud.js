// Magic on screen: the bar along the bottom (your weapons on 1 to 5, your spells on 6 to 0, each
// spell's cooldown sweeping round it, dimmed when you lack the mana), the mana bar and the two
// strands of fabric you carry (a tap opens the skills and magic menu, magic/skills-ui.js, and a
// star on it says a skill point is waiting), a word when the mouse is the camera's, and the
// word when you go up a level. A tap on the bar casts or takes up the weapon.
//
// A touch screen has no bar: the spell button tops the right thumb's column (your last spell on
// it, the mana round its rim). A tap casts that spell again; held, or slid off, it fans the
// weapons and spells out in two arcs round it (spells on the inner one), and letting go on one
// casts it or takes it up. Let go on the button and the arcs stay open for a tap. Beside the
// arcs: your fabric (a tap opens skills and magic) and test mode. The first four spells bound
// are always out beside it too, a tap on one casting it: in an arc round the button's left in
// portrait, in a row left of it in landscape (Josh 2026-10-23: at least four to pick from).

import { SPELL, SCHOOLS, SLOTS, manaCost, cooldownLeft, manaMax } from './spells.js';
import { pointsOf } from './skills.js';
import { firstTime } from '../ui/touch-skin.js';

const CSS = `
.mg-bar{position:absolute;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:6px;align-items:flex-end;pointer-events:none;z-index:6;font:600 11px/1 var(--bard-display,system-ui,sans-serif);color:#eef6f4;transition:opacity .4s}
.mg-bar .grp{display:flex;gap:4px}
.mg-bar .sep{width:1px;height:30px;background:rgba(255,255,255,.18);margin:0 4px;align-self:center}
.mg-s{position:relative;width:40px;height:40px;border-radius:9px;background:rgba(10,16,20,.55);box-shadow:0 0 0 1px rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.mg-s .k{position:absolute;left:4px;top:3px;font-size:9px;opacity:.7}
.mg-s .g{font-size:19px;line-height:1;text-shadow:0 0 8px currentColor}
.mg-s .w{font-size:10px;letter-spacing:.4px;text-transform:uppercase;opacity:.9;font-family:var(--bard-display,Georgia,serif)}
.mg-s .w svg{display:block;width:26px;height:26px;opacity:.95;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.mg-s .cd{position:absolute;inset:0;border-radius:9px;pointer-events:none}
.mg-s.held{box-shadow:0 0 0 2px #7fe0c0}
.mg-s.dim .g{opacity:.35}
.mg-s.empty{opacity:.45}
.mg-mana{position:absolute;left:50%;bottom:calc(60px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(260px,52vw);height:4px;border-radius:2px;background:rgba(10,16,20,.55);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.1);pointer-events:none;z-index:6}
.mg-mana>div{height:100%;width:100%;transform-origin:left;background:linear-gradient(90deg,#5a7cff,#a8c4ff);transition:transform .15s}
.mg-fab{align-self:center;margin-left:6px;font:600 11px/1.35 var(--bard-display,system-ui,sans-serif);color:#eef6f4;text-shadow:0 1px 2px rgba(0,0,0,.6);pointer-events:auto;cursor:pointer;white-space:nowrap}
@media (max-width:660px){#l99-island-mount:not(.l99-touch) .mg-bar{left:calc(50% - 34px)}}
.mg-fab b{font-weight:700}.mg-fab .l{color:#ffd27a}.mg-fab .d{color:#b39aff}
.mg-mode{position:absolute;left:50%;top:calc(14px + var(--l99-top, env(safe-area-inset-top)));transform:translateX(-50%);background:rgba(10,16,20,.6);color:#eef6f4;font:600 12px/1 var(--bard-display,system-ui,sans-serif);padding:7px 12px;border-radius:14px;box-shadow:0 0 0 1px rgba(255,255,255,.14);pointer-events:none;z-index:7;opacity:0;transition:opacity .25s}
.mg-fab .pt{display:inline-block;margin-left:5px;padding:0 5px;border-radius:8px;background:#01a982;color:#fff;font-size:10px;line-height:15px;box-shadow:0 0 10px rgba(1,169,130,.8);animation:mgPt 2s ease-in-out infinite}
@keyframes mgPt{50%{box-shadow:0 0 18px rgba(1,169,130,1)}}
.mg-lvl{position:absolute;left:50%;top:calc(18% + var(--l99-top, env(safe-area-inset-top)));transform:translate(-50%,0);pointer-events:none;z-index:8;text-align:center;color:#fff;opacity:0;font:600 13px/1.3 var(--bard-display,system-ui,sans-serif);letter-spacing:.08em;text-shadow:0 2px 12px rgba(0,0,0,.8);white-space:nowrap}
.mg-lvl b{display:block;font:200 44px/1 var(--bard-display,system-ui,sans-serif);letter-spacing:.3em;margin-bottom:6px;background:linear-gradient(180deg,#fff 30%,#5eead4);-webkit-background-clip:text;background-clip:text;color:transparent}
.mg-lvl i{display:block;height:1px;margin:8px auto;width:0;background:linear-gradient(90deg,transparent,#5eead4,transparent)}
.mg-lvl.go{animation:mgLvl 4.2s ease forwards}.mg-lvl.go i{animation:mgLine 1.2s .2s ease-out forwards}
@keyframes mgLvl{0%{opacity:0;transform:translate(-50%,10px)}10%,78%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}
@keyframes mgLine{to{width:260px}}
/* (a touch screen: the spell button, and the arcs it opens over everything) */
.mg-hub{position:absolute;right:calc(24px + env(safe-area-inset-right));bottom:calc(226px + env(safe-area-inset-bottom));width:52px;height:52px;box-sizing:border-box;border-radius:50%;border:1px solid rgba(255,255,255,.24);background:rgba(12,16,20,.32);box-shadow:0 1px 8px rgba(0,0,0,.16);display:flex;align-items:center;justify-content:center;z-index:6;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer;transition:opacity .4s,scale .08s ease}
.mg-hub.on{scale:.94;background:rgba(255,255,255,.2)}
.mg-hub .g{font:600 22px/1 var(--bard-display,system-ui,sans-serif);color:#eef6f4;text-shadow:0 0 8px currentColor;pointer-events:none}
.mg-hub .ring{position:absolute;inset:-1px;border-radius:50%;background:conic-gradient(#9db8ff calc(var(--m,1) * 1turn),rgba(255,255,255,.12) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));pointer-events:none}
.mg-hub .cd{position:absolute;inset:3px;border-radius:50%;pointer-events:none}
.mg-hub.dim .g{opacity:.35}
.mg-hub .pt{position:absolute;right:-3px;top:-3px;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:#01a982;color:#fff;font:700 10px/16px var(--bard-body,system-ui,sans-serif);text-align:center;box-shadow:0 0 10px rgba(1,169,130,.8);pointer-events:none}
.l99-tools-open .mg-hub{visibility:hidden}
.mg-bar.mg-wheel.open~.mg-hub{z-index:17}
.mg-bar.mg-wheel{left:0;top:0;right:0;bottom:0;transform:none;display:none;pointer-events:auto;z-index:16;touch-action:none}
.mg-bar.mg-wheel.open{display:block}
.mg-wheel .grp{display:contents}
.mg-wheel .sep{display:none}
.mg-wheel svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.mg-wheel .mg-s{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(10,16,20,.72);box-shadow:0 0 0 1px rgba(255,255,255,.2),0 2px 10px rgba(0,0,0,.35);transition:scale .08s ease}
.mg-wheel .mg-s .cd{border-radius:50%}
.mg-wheel .mg-s .k{display:none}
.mg-wheel .mg-s .g{font-size:21px}
.mg-wheel .mg-s .w svg{width:30px;height:30px}
.mg-wheel .mg-s.empty{opacity:.5}
.mg-wheel .mg-s.held{box-shadow:0 0 0 2px #7fe0c0,0 2px 10px rgba(0,0,0,.35)}
.mg-wheel .mg-s.hot{scale:1.2;box-shadow:0 0 0 2px #fff,0 0 18px rgba(127,224,192,.7)}
.mg-wheel .hd{position:absolute;display:flex;flex-direction:column;gap:8px;width:124px;margin-top:-40px;padding:10px;box-sizing:border-box;border-radius:14px;background:rgba(10,16,20,.72);box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.mg-wheel .mg-mana{position:relative;left:auto;bottom:auto;transform:none;width:auto}
.mg-wheel .mg-fab{margin:-6px;padding:6px;display:flex;align-items:center;gap:8px;line-height:16px}
.mg-wheel .mg-fab br{display:none}
.mg-wheel .mg-fab .pt{margin-left:auto;order:3}
.mg-q{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;box-sizing:border-box;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(12,16,20,.32);box-shadow:0 1px 8px rgba(0,0,0,.16);display:flex;align-items:center;justify-content:center;z-index:6;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer;transition:opacity .4s,scale .08s ease}
.mg-q[hidden]{display:none}
.mg-q.on{scale:.9;background:rgba(255,255,255,.2)}
.mg-q .g{font:600 19px/1 var(--bard-display,system-ui,sans-serif);text-shadow:0 0 8px currentColor;pointer-events:none}
.mg-q .cd{position:absolute;inset:2px;border-radius:50%;pointer-events:none}
.mg-q.dim .g{opacity:.35}
.mg-q.last{box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 1px 8px rgba(0,0,0,.16)}
.l99-tools-open .mg-q,.mg-bar.mg-wheel.open~.mg-q{visibility:hidden}
`;
const STYLE_ID = 'mg-hud-style';
const KEYS = ['6', '7', '8', '9', '0'];
// each weapon's picture in its slot: a silhouette, muzzle or blade to the upper right, on a
// 24-unit square (the words above are only for a weapon with no picture yet)
const WEAPON_ICON = {
	'aurora-trail-rifle': '<g transform="translate(0 -4.8) scale(1 1.4)"><path d="M1 11h15l1-1h6v2h-6l-1 1H10l-1.6 4.5H5.8l1.4-4.5H3.6L1 14.5z"/><path d="M7.5 7.5h7v2h-7z"/><path d="M9 9.5h1v1.5H9zm3 0h1v1.5h-1z"/></g>',
	'mossback-scout-rifle': '<g transform="translate(0 -4.8) scale(1 1.4)"><path d="M1 11.6l3-1.1h13.5v-.8H23v1.6h-5.5l-1 1.4h-6l-2.2 3.8H5.6l1.8-3.8H4.2L1 14z"/><circle cx="13" cy="14.2" r="1.1"/></g>',
	'longwatch-sniper-rifle': '<g transform="translate(0 -4.8) scale(1 1.4)"><path d="M.6 11.4l2.6-.9h11.4v-.6h8.8v1.2h-8.8l-.8 1.3H9.6l-2 3.4H5.2l1.6-3.4H3.6L.6 13.8z"/><path d="M6.4 7.6h8.2v1.5H6.4zM14.2 7.3h2.2v2.1h-2.2z"/><path d="M8 9.1h.9v1.4H8zm4 0h.9v1.4H12z"/><circle cx="12" cy="13.4" r="1"/></g>',
	'warden-spark-carbine': '<g transform="translate(0 -4.8) scale(1 1.4)"><path d="M2 9.5h13V8.6h6.5v2.1H15V13h-3.4l-.5 4.5H8.6l.5-4.5H6.8L5.6 16H3l1-3H2z"/><path d="M12.4 13h2.2l.4 3.6h-2.2z"/></g>',
	'reedline-hunting-bow': '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"><path d="M8 2.5c7 4.6 7 14.4 0 19"/><path d="M8 2.5v19" stroke-width="1"/><path d="M3 12h16.5"/></g><path d="M21.5 12l-3.4-2.2v4.4z"/><path d="M3 12l-1.4-1.6M3 12l-1.4 1.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
	bat: '<g transform="rotate(-45 12 12)"><path d="M1.6 11.1H11l9.6-1.5a2.4 2.4 0 0 1 0 4.8L11 12.9H1.6z"/><rect x=".2" y="10.4" width="2" height="3.2" rx=".7"/></g>',
	pipe: '<path d="M4.2 21.4l-1.6-1.6L19.8 2.6l1.6 1.6z"/><path d="M2.4 18.4l3.2 3.2-1.6 1.6-3.2-3.2zm16-16l3.2 3.2 1.6-1.6L20 .8z"/>',
	bottle: '<path d="M14.2 2.4l2.8 2.8-1.6 1.6.2 2.6-8.4 8.4a1.4 1.4 0 0 1-2 0l-2.2-2.2a1.4 1.4 0 0 1 0-2l8.4-8.4 2.6.2z"/>',
	knife: '<path d="M2.4 20.2l4.4-4.4 1.6 1.6-4.4 4.4a1.1 1.1 0 0 1-1.6-1.6z"/><path d="M7.8 14.8L20.6 2.4c.9 2.6-.1 5.6-2.4 7.9l-8.2 8.1z"/>',
	machete: '<path d="M1.8 20.6l3.8-3.8 1.8 1.8-3.8 3.8a1.3 1.3 0 0 1-1.8-1.8z"/><path d="M6.6 15.8L17.4 5c2.4-2.4 5.6-1.6 4.8 1.2-.3 1-1 1.9-1.8 2.7L8.6 17.8z"/>',
};
const WEAPON_TAG = { 'aurora-trail-rifle': 'Rifle', 'mossback-scout-rifle': 'Scout', 'longwatch-sniper-rifle': 'Sniper', 'warden-spark-carbine': 'Carb', 'reedline-hunting-bow': 'Bow', bat: 'Bat', pipe: 'Pipe', bottle: 'Bottle', knife: 'Knife', machete: 'Blade' };

// the arcs round the spell button: radius, then each slot's angle from straight left (up is +)
const RING = { s: [100, [64, 32, 0, -32, -64]], w: [162, [40, 20, 0, -20, -40]] };
// the four spells always out, each as an offset from the spell button's centre: in portrait an
// arc round its left (radius 74, at 84, 42, 0 and -42 degrees), in landscape a row left of it
// between the top row and the Lock dock; where those would cover another button (the button
// risen over Descend while flying, with the Lock dock out), a cluster lower down
const QUICK = {
	n: 4,
	tall: [[[-8, -74], [-55, -50], [-74, 0], [-55, 50]], [[-74, 0], [-55, 50], [-130, 0], [-119, 53]]],
	wide: [[[-60, -5], [-116, -5], [-172, -5], [-228, -5]], [[-74, 0], [-55, 50], [-130, 0], [-119, 53]]],
};
// (what they keep clear of: the top row and right column, and the Lock dock)
const QUICK_CLEAR = '.l99-quick>*,.combat-focus-controls,#l99-island-mount>[aria-label^="Sky and world"],#l99-island-mount>[aria-label^="Auto music"]';

// onBook(): open the skills and magic menu; bookOpen(): whether it is open
export function createMagicHud({ mount, state, hotbar, onCast, onPress, onBook = () => {}, bookOpen = () => false, hint = () => {}, isTouch = false }) {
	if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
	const mk = (tag, cls, parent, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent?.appendChild(e); return e; };

	// ---------- the bar ----------
	const bar = mk('div', 'mg-bar', mount), wg = mk('div', 'grp', bar); mk('div', 'sep', bar); const sg = mk('div', 'grp', bar);
	// (a slot's tap; in the arcs it closes them too, and a spell becomes the button's)
	let last = 0, wheel = null;
	const press = (i) => { onPress(i); wheel?.close(); };
	const cast = (i, shift = false) => { last = i; onCast(i, { shift, tap: true }); wheel?.close(); };
	const wSlots = [...Array(5)].map((_, i) => { const e = mk('div', 'mg-s empty', wg, `<span class="k">${i + 1}</span><span class="w"></span>`); e.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); press(i); }); return e; });
	const sSlots = KEYS.map((k, i) => { const e = mk('div', 'mg-s empty', sg, `<span class="k">${k}</span><span class="g"></span><div class="cd"></div>`); e.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); cast(i, x.shiftKey); }); return e; });
	const mana = mk('div', 'mg-mana', mount, '<div></div>'), manaFill = mana.firstChild;
	// (your fabric at the bar's end: a tap opens the skills and magic menu)
	const fab = mk('div', 'mg-fab', bar);
	fab.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); wheel?.close(); onBook(); });
	// (only what changed is written: the bar is looked at every frame)
	const was = new Map();
	const put = (e, k, v, f) => { const key = e; let m = was.get(key); if (!m) was.set(key, (m = {})); if (m[k] !== v) { m[k] = v; f(v); } };
	if (isTouch) wheel = makeWheel();

	// ---------- a touch screen's spell button and its arcs ----------
	function makeWheel() {
		bar.classList.add('mg-wheel');
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		bar.prepend(svg);
		// beside the arcs: the fabric and the mana (test mode is in the places menu)
		const hd = mk('div', 'hd', bar);
		hd.append(fab, mana);
		const hub = mk('div', 'mg-hub', mount, '<div class="ring"></div><div class="cd"></div><span class="g"></span>');
		hub.setAttribute('role', 'button');
		hub.setAttribute('aria-label', 'Spells and weapons: tap to cast again, hold for all');
		const hubG = hub.querySelector('.g'), hubCd = hub.querySelector('.cd'), hubRing = hub.querySelector('.ring');
		const pt = mk('span', 'pt', hub);
		// the safe areas in px (env() only reaches CSS)
		const probe = mk('div', '', mount);
		probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;padding:var(--l99-top, env(safe-area-inset-top)) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
		const UP = RING.w[0] * Math.sin(RING.w[1][0] * Math.PI / 180) + 23;
		let isOpen = false, hot = null;
		function place() {
			const m = mount.getBoundingClientRect(), h = hub.getBoundingClientRect(), cs = getComputedStyle(probe);
			const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0, sl = parseFloat(cs.paddingLeft) || 0;
			const cx = h.left + h.width / 2 - m.left;
			// (the arcs keep under the top row and above the bottom edge)
			const cy = Math.max(st + 64 + UP, Math.min(m.height - sb - 12 - UP, h.top + h.height / 2 - m.top));
			const at = (R, a) => [cx - R * Math.cos(a * Math.PI / 180), cy - R * Math.sin(a * Math.PI / 180)];
			const lay = (slots, [R, A]) => slots.forEach((e, i) => { const [x, y] = at(R, A[i]); e.style.left = `${x}px`; e.style.top = `${y}px`; });
			lay(sSlots, RING.s); lay(wSlots, RING.w);
			// (a soft rail under each arc)
			const arc = ([R, A]) => {
				const [x0, y0] = at(R, A[0] + 6), [x1, y1] = at(R, A[A.length - 1] - 6);
				return `<path d="M${x0} ${y0}A${R} ${R} 0 0 0 ${x1} ${y1}" fill="none" stroke="rgba(10,16,20,.42)" stroke-width="58" stroke-linecap="round"/>`;
			};
			svg.innerHTML = arc(RING.s) + arc(RING.w);
			// (left of the outer arc, or above it when the screen is too narrow)
			const right = cx - RING.w[0] - 23 - 14;
			if (right - 124 >= sl + 12) { hd.style.left = `${right - 124}px`; hd.style.top = `${cy}px`; } else { hd.style.left = `${Math.max(sl + 12, cx - 124)}px`; hd.style.top = `${cy - UP - 60}px`; }
		}
		const light = (e) => { if (hot === e) return; hot?.classList.remove('hot'); hot = e; e?.classList.add('hot'); };
		function open() { if (isOpen) return; isOpen = true; place(); bar.classList.add('open'); }
		function close() { if (!isOpen) return; isOpen = false; bar.classList.remove('open'); light(null); }
		const slotAt = (x) => document.elementFromPoint(x.clientX, x.clientY)?.closest?.('.mg-wheel .mg-s') || null;
		// a tap casts again; a hold or a slide opens the arcs, and letting go on a slot picks it
		let id = null, t0 = 0, x0 = 0, y0 = 0, timer = 0, wasOpen = false;
		hub.addEventListener('pointerdown', (x) => {
			x.stopPropagation(); x.preventDefault();
			if (id !== null) return;
			id = x.pointerId; t0 = performance.now(); x0 = x.clientX; y0 = x.clientY; wasOpen = isOpen;
			try { hub.setPointerCapture(id); } catch { /* an old browser: the slide still works */ }
			hub.classList.add('on');
			clearTimeout(timer);
			timer = setTimeout(() => { if (id !== null) open(); }, 240);
		});
		hub.addEventListener('pointermove', (x) => {
			if (x.pointerId !== id) return;
			if (!isOpen && Math.hypot(x.clientX - x0, x.clientY - y0) > 12) open();
			if (isOpen) light(slotAt(x));
		});
		const lift = (x) => {
			if (x.pointerId !== id) return;
			x.stopPropagation();
			id = null; clearTimeout(timer); hub.classList.remove('on');
			if (x.type === 'pointercancel') { close(); return; }
			const s = isOpen ? slotAt(x) : null;
			light(null);
			if (s) { const w = wSlots.indexOf(s); if (w >= 0) press(w); else cast(sSlots.indexOf(s)); return; }
			// (a quick tap: the last spell again, or the arcs when there is none; on open arcs, shut)
			if (wasOpen) { close(); return; }
			if (!isOpen && performance.now() - t0 < 240) { if (SPELL[state.binds[last]]) cast(last); else open(); }
		};
		hub.addEventListener('pointerup', lift);
		hub.addEventListener('pointercancel', lift);
		// (a tap off the arcs shuts them)
		bar.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); close(); });
		if (firstTime('l99-spell-wheel')) setTimeout(() => hint('Hold the spell button for all your spells and weapons', 4200), 6000);
		// the four spells always out (q.i: the slot each shows, the first four bound in order)
		const quick = [...Array(QUICK.n)].map(() => {
			const e = mk('div', 'mg-q', mount, '<div class="cd"></div><span class="g"></span>');
			e.setAttribute('role', 'button');
			const q = { e, g: e.querySelector('.g'), cd: e.firstChild, i: -1 };
			e.addEventListener('pointerdown', (x) => { x.stopPropagation(); x.preventDefault(); if (q.i < 0) return; e.classList.add('on'); cast(q.i); });
			const up = () => e.classList.remove('on');
			e.addEventListener('pointerup', up);
			e.addEventListener('pointercancel', up);
			e.addEventListener('pointerleave', up);
			return q;
		});
		const sig = { g: '', pt: -1 };
		// the button's spell, cooldown, mana and point, and test mode's word
		function paint(now, pts) {
			const sid = state.binds[last], sp = SPELL[sid];
			const g = sp ? `${sp.glyph}|${SCHOOLS[sp.school].color}` : '✦|';
			if (g !== sig.g) { sig.g = g; const [t, c] = g.split('|'); hubG.textContent = t; hubG.style.color = c; }
			const cd = sp ? Math.round(cooldownLeft(state, sid, now) * 60) / 60 : 0;
			put(hub, 'cd', cd, (v) => { hubCd.style.background = v > 0 ? `conic-gradient(rgba(0,0,0,.6) ${v * 360}deg, transparent 0)` : ''; });
			put(hub, 'dim', !!sp && state.mana < manaCost(state, sp), (v) => hub.classList.toggle('dim', v));
			put(hub, 'm', Math.round(state.mana / manaMax(state) * 100), (v) => hubRing.style.setProperty('--m', String(Math.max(0, Math.min(1, v / 100)))));
			if (pts !== sig.pt) { sig.pt = pts; pt.textContent = pts ? `+${pts}` : ''; pt.style.display = pts ? '' : 'none'; }
			let k = 0;
			for (let i = 0; i < SLOTS && k < QUICK.n; i++) if (SPELL[state.binds[i]]) quick[k++].i = i;
			for (; k < QUICK.n; k++) quick[k].i = -1;
			for (const q of quick) {
				const qid = state.binds[q.i], qs = q.i >= 0 ? SPELL[qid] : null;
				put(q.e, 'id', qs ? `${q.i}|${qid}` : '', (v) => {
					q.e.hidden = !v;
					if (!qs) return;
					q.g.textContent = qs.glyph; q.g.style.color = SCHOOLS[qs.school].color;
					q.e.setAttribute('aria-label', `${qs.name}: tap to cast`);
				});
				const qc = qs ? Math.round(cooldownLeft(state, qid, now) * 60) / 60 : 0;
				put(q.e, 'cd', qc, (v) => { q.cd.style.background = v > 0 ? `conic-gradient(rgba(0,0,0,.6) ${v * 360}deg, transparent 0)` : ''; });
				put(q.e, 'dim', !!qs && state.mana < manaCost(state, qs), (v) => q.e.classList.toggle('dim', v));
				put(q.e, 'last', !!qs && q.i === last, (v) => q.e.classList.toggle('last', v));
			}
			if (isOpen && bookOpen()) close();
		}
		// (it tops the right thumb's column, however tall that grows)
		const thumb = mount.querySelector('.l99-thumb');
		function rise() {
			if (thumb) {
				const m = mount.getBoundingClientRect(), t = thumb.getBoundingClientRect(), sb = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
				const b = t.height ? Math.max(226, Math.round(m.bottom - t.top - sb + 12)) : 226;
				put(hub, 'b', b, (v) => { hub.style.bottom = `calc(${v}px + env(safe-area-inset-bottom))`; });
			}
			spread();
		}
		// the four round the button (from its centre, as it stands after rise): the first layout
		// that covers nothing and stays on screen, or the one that covers least
		function spread() {
			const m = mount.getBoundingClientRect(), h = hub.getBoundingClientRect();
			if (!h.width) return;
			const cx = h.left + h.width / 2 - m.left, cy = h.top + h.height / 2 - m.top, st = parseFloat(getComputedStyle(probe).paddingTop) || 0;
			const keep = [];
			for (const e of mount.querySelectorAll(QUICK_CLEAR)) { const r = e.getBoundingClientRect(); if (r.width && r.height) keep.push(r); }
			const cost = (at) => at.reduce((n, [dx, dy]) => {
				const x = cx + dx + m.left, y = cy + dy + m.top;
				if (y - 22 < m.top + st + 4 || x - 22 < m.left + 4) return n + 1;
				return n + keep.filter((r) => x + 25 > r.left && x - 25 < r.right && y + 25 > r.top && y - 25 < r.bottom).length;
			}, 0);
			let best = null, least = Infinity;
			for (const at of QUICK[m.width > m.height && m.height <= 540 ? 'wide' : 'tall']) { const c = cost(at); if (c < least) { least = c; best = at; } if (!c) break; }
			quick.forEach((q, j) => {
				const x = Math.round(cx + best[j][0]), y = Math.round(cy + best[j][1]);
				put(q.e, 'at', `${x},${y}`, () => { q.e.style.left = `${x}px`; q.e.style.top = `${y}px`; });
			});
		}
		function dispose() { hub.remove(); probe.remove(); for (const q of quick) q.e.remove(); }
		return { open, close, isOpen: () => isOpen, paint, rise, hub, quick: quick.map((q) => q.e), dispose };
	}
	const lvl = mk('div', 'mg-lvl', mount);
	const mode = mk('div', 'mg-mode', mount, 'Camera · drag to look · click the world or tap Alt / ⌥ to aim again');
	let lastSig = '', wT = 0;
	// (only what changed is written, through put above: the bar is looked at every frame)
	function update(now) {
		wT -= 1;
		if (wT <= 0) {
			wT = 15;
			const ws = hotbar?.slots?.() || [];
			for (let i = 0; i < 5; i++) {
				const s = ws[i], e = wSlots[i];
				put(e, 'w', s ? `${s.id}|${s.held}` : '', () => {
					e.classList.toggle('empty', !s); e.classList.toggle('held', !!s?.held);
					const w = e.querySelector('.w'), ic = s && WEAPON_ICON[s.id];
					if (ic) w.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ic}</svg>`;
					else w.textContent = s ? WEAPON_TAG[s.id] || s.name.slice(0, 4) : '';
					e.title = s ? `${s.name} (${i + 1})` : `Key ${i + 1}: no weapon`;
				});
			}
			wheel?.rise();
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
		wheel?.paint(now, pts);
		if (sig !== lastSig) {
			lastSig = sig;
			fab.innerHTML = `<span class="l">☀ <b>${state.fabric.light}</b></span>${pts ? `<span class="pt">+${pts}</span>` : ''}<br><span class="d">☾ <b>${state.fabric.dark}</b></span>`;
			fab.title = `Aether fabric: light and dark.${pts ? ` ${pts} skill point${pts > 1 ? 's' : ''} to spend.` : ''} Tab or N (or a tap here) opens skills and magic.`;
		}
	}
	// the word when you go up a level
	function levelUp(level, pts) {
		lvl.innerHTML = `<b>LEVEL ${level}</b><i></i>${pts === 1 ? 'A skill point to spend' : `${pts} skill points to spend`} · ${isTouch ? 'hold the spell button, then tap ☀,' : 'Tab'} for skills and magic`;
		lvl.classList.remove('go'); void lvl.offsetWidth; lvl.classList.add('go');
	}
	function setMode(m) { mode.style.opacity = m === 'camera' ? '1' : '0'; }
	function show(on) {
		for (const e of [bar, mana, wheel?.hub, ...(wheel?.quick || [])]) if (e) e.style.opacity = on ? '1' : '0';
		if (wheel) { for (const e of [wheel.hub, ...wheel.quick]) e.style.pointerEvents = on ? '' : 'none'; if (!on) wheel.close(); }
	}

	function dispose() { for (const e of [bar, mana, mode, lvl]) e.remove(); wheel?.dispose(); }
	return { update, setMode, show, levelUp, open: onBook, isOpen: bookOpen, dispose };
}
