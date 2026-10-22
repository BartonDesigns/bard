// Game controllers: an Xbox or PlayStation pad (wired or Bluetooth, through the browser's
// Gamepad API) plays all of Bard. The sticks walk and look (player.js s.pad, s.padLook); the
// rest presses what the keyboard and the screen already press, so every module keeps its own
// rules: a button sends the module's key (Space, C, E, the digits...), or calls the module's
// own hook where the mouse does the work (the trigger, the sights, the block, the reel).
//
// Four ways the pad is read, picked each frame:
//   game     on foot, swimming or flying: the layout below (LAYOUT lists it for the card)
//   vehicle  in a car, a military vehicle or on a ride: the triggers drive, the stick steers
//   menu     a menu or panel is open (any [role=dialog], [aria-modal], [data-pad-layer]), or
//            the world is not up yet: the stick or the d-pad moves a ring between its buttons,
//            A presses, B goes back, the bumpers turn its tabs, the right stick scrolls.
//            A panel marked data-pad="keys" (the skills menu) takes the arrow keys itself.
//   screen   View (Create on a PlayStation pad) puts the ring on the screen's own buttons
// Start (Options) opens the controller menu: everything that has no button of its own (the
// skills menu, gear, the character view, chat, the guide, the compass, drive, explore...) and
// the layout with this pad's own glyphs. Other modules add to it with gamepad.menu.add().
//
// X presses the on-screen prompt nearest the thumb (Open the door, Talk, Use, Pick up...), so a
// new prompt anywhere in the game (.l99-prompts) works on the pad with nothing else to do.

import { SPELL, SCHOOLS } from '../magic/spells.js';

// the standard mapping's buttons (w3c.github.io/gamepad/#remapping)
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16, PAD: 17 };
const HOLD = 420;          // ms: a press held this long is a hold, not a tap
const CAST_HOLD = 240;     // ms: locked on, RB held this long casts; let go sooner, it turns to the next target
const DEAD = 0.18;         // the sticks' rest (a radial dead zone)
const TRIG_ON = 0.35, TRIG_OFF = 0.22;
// the view's turn at full tilt, radians a second (a held full tilt speeds up after a moment)
const YAW_RATE = 3.3, PITCH_RATE = 2.3, BOOST_AFTER = 0.3, BOOST = 1.55;

// ---------- glyphs: the face buttons as each pad prints them ----------
export const GLYPHS = {
	xbox: { A: ['A', '#3fb950'], B: ['B', '#f85149'], X: ['X', '#3b82f6'], Y: ['Y', '#f5b70b'], LB: ['LB'], RB: ['RB'], LT: ['LT'], RT: ['RT'], L3: ['LS'], R3: ['RS'], LS: ['L'], RS: ['R'], VIEW: ['⧉'], START: ['☰'], PAD: ['⧉'], UP: ['↑'], DOWN: ['↓'], LEFT: ['←'], RIGHT: ['→'], DPAD: ['✛'] },
	// Backbone One (the phone's clip-on pad): A B X Y in the Xbox places and colours, the
	// shoulders and stick clicks named as on its shell, the two small buttons either side
	backbone: { A: ['A', '#3fb950'], B: ['B', '#f85149'], X: ['X', '#3b82f6'], Y: ['Y', '#f5b70b'], LB: ['L1'], RB: ['R1'], LT: ['L2'], RT: ['R2'], L3: ['L3'], R3: ['R3'], LS: ['L'], RS: ['R'], VIEW: ['⧉'], START: ['☰'], PAD: ['⧉'], UP: ['↑'], DOWN: ['↓'], LEFT: ['←'], RIGHT: ['→'], DPAD: ['✛'] },
	ps: { A: ['✕', '#7ea8ff'], B: ['○', '#ff6b6b'], X: ['□', '#e88ad0'], Y: ['△', '#3ddc97'], LB: ['L1'], RB: ['R1'], LT: ['L2'], RT: ['R2'], L3: ['L3'], R3: ['R3'], LS: ['L'], RS: ['R'], VIEW: ['Create'], START: ['Options'], PAD: ['Touchpad'], UP: ['↑'], DOWN: ['↓'], LEFT: ['←'], RIGHT: ['→'], DPAD: ['✛'] },
};
// Sony's vendor id 054c and its pads' names, Backbone's (358a, and its PlayStation Edition with
// Sony's marks); everything else reads as an Xbox layout
const BACKBONE = /backbone|358a/i;
export function padFamily(id = '') {
	if (BACKBONE.test(id)) return /playstation/i.test(id) ? 'ps' : 'backbone';
	if (/045e|xbox|xinput/i.test(id)) return 'xbox';
	return /054c|playstation|dualsense|dualshock|wireless controller|ps[345]/i.test(id) ? 'ps' : 'xbox';
}
export function padName(id = '') {
	if (BACKBONE.test(id)) return /playstation/i.test(id) ? 'Backbone One PlayStation Edition' : 'Backbone One';
	if (padFamily(id) === 'ps') return /dualsense|0ce6|0df2/i.test(id) ? 'DualSense controller' : 'PlayStation controller';
	return /045e|xbox|xinput/i.test(id) ? 'Xbox controller' : 'Controller';
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function glyphHTML(name, family = 'xbox') {
	const [t, c] = GLYPHS[family]?.[name] || [name];
	const face = !!c, long = t.length > 2;
	return `<span class="gp-g${face ? ' f' : ''}${long ? ' w' : ''}"${c ? ` style="--c:${c}"` : ''}>${esc(t)}</span>`;
}

// ---------- the layout, as the card shows it (the handlers below follow it) ----------
// [buttons, what they do]; a row's buttons join with a space ('UP+hold': held)
export const LAYOUT = [
	['On foot', [
		[['LS'], 'Move · click L3 to sprint'],
		[['RS'], 'Look · click R3 to lock on (hold: next target)'],
		[['A'], 'Jump · double-tap to fly or land · hold to climb in flight'],
		[['B'], 'Crouch · slide out of a sprint · dodge · descend in flight'],
		[['X'], 'The prompt on screen (doors, talk, pick up, use) · reload · hold: fishing rod, hands up'],
		[['DOWN'], 'Use what you hold · hold: throw a flare'],
	]],
	['Combat and magic', [
		[['RT'], 'Fire · strike · reel in a fish'],
		[['LT'], 'Aim down the sights (a tap leaves them up) · block with fists or a blade'],
		[['RB'], 'Cast your spell (hold for beams)'],
		[['LB'], 'Next spell · hold: the spell and weapon wheel, pick with RS'],
		[['RB', 'LB'], 'Locked on: the next and previous target (hold RB to cast)'],
		[['Y'], 'Heavy strike (hold to charge) · fire mode with a gun'],
		[['LEFT', 'RIGHT'], 'Previous and next weapon, or empty hands'],
		[['UP'], 'Grab or take down · in flight: flight speed · hold: warp in space'],
	]],
	['Vehicles and rides', [
		[['RT', 'LT'], 'Accelerate and brake'],
		[['LS'], 'Steer · click L3 to boost'],
		[['A'], 'Handbrake'], [['B'], 'Camera'], [['X'], 'Drive mode'], [['RB'], 'Vehicle guns'], [['Y'], 'Get out'],
	]],
	['Menus', [
		[['START'], 'This menu: skills, gear, map, settings and the rest'],
		[['VIEW'], 'Point at the buttons on screen'],
		[['PAD'], 'Skills and magic (PlayStation touchpad)'],
		[['LS', 'DPAD'], 'Move between buttons'],
		[['A'], 'Press'], [['B'], 'Back'], [['LB', 'RB'], 'Tabs and pages'], [['RS'], 'Scroll'],
	]],
];

// a key the game knows: [key, code]
const KEYS = { ' ': [' ', 'Space'], '`': ['`', 'Backquote'], Tab: ['Tab', 'Tab'], Enter: ['Enter', 'Enter'], Escape: ['Escape', 'Escape'], PageUp: ['PageUp', 'PageUp'], PageDown: ['PageDown', 'PageDown'],
	ArrowUp: ['ArrowUp', 'ArrowUp'], ArrowDown: ['ArrowDown', 'ArrowDown'], ArrowLeft: ['ArrowLeft', 'ArrowLeft'], ArrowRight: ['ArrowRight', 'ArrowRight'], Shift: ['Shift', 'ShiftLeft'] };
function keyOf(k, shift) {
	if (KEYS[k]) return KEYS[k];
	if (/^\d$/.test(k)) return [k, 'Digit' + k];
	return [shift ? k.toUpperCase() : k.toLowerCase(), 'Key' + k.toUpperCase()];
}

const CSS = `
.gp-g{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:6px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.28);color:#eafaf6;font:700 11px/1 var(--bard-display,system-ui,sans-serif);vertical-align:middle;white-space:nowrap}
.gp-g.f{width:22px;padding:0;border-radius:50%;background:color-mix(in srgb,var(--c) 22%,rgba(10,16,20,.8));border-color:var(--c);color:var(--c);font-size:12px}
.gp-g.w{font-size:10px}
.gp-ring{position:fixed;z-index:2147483000;pointer-events:none;border-radius:12px;box-shadow:0 0 0 2px #01a982,0 0 0 5px rgba(1,169,130,.28),0 0 18px rgba(1,169,130,.55);transition:left .09s ease,top .09s ease,width .09s ease,height .09s ease;display:none}
.gp-tip{position:fixed;z-index:2147483001;pointer-events:none;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);display:none;gap:14px;align-items:center;padding:7px 14px;border-radius:999px;background:rgba(8,20,26,.86);border:1px solid rgba(255,255,255,.16);color:rgba(234,250,246,.86);font:600 12px var(--bard-display,system-ui,sans-serif);white-space:nowrap}
.gp-tip span.i{display:inline-flex;gap:6px;align-items:center}
.gp-menu{position:absolute;inset:0;padding-bottom:48px;box-sizing:border-box;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font:14px var(--bard-body,system-ui,sans-serif);color:#eafaf6}
.gp-menu .pn{width:min(760px,calc(100vw - 32px));max-height:calc(100% - 32px - var(--l99-top, env(safe-area-inset-top)) - env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;padding:18px;border-radius:16px;background:#1a1a1a;border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.8)}
.gp-menu h2{margin:0 0 2px;font:700 20px var(--bard-display,system-ui,sans-serif)}
.gp-menu .sub{color:rgba(255,255,255,.6);font-size:12px;margin-bottom:14px}
.gp-menu .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.gp-menu .tiles button{display:flex;align-items:center;gap:10px;min-height:48px;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#eafaf6;font:600 13px var(--bard-display,system-ui,sans-serif);text-align:left;cursor:pointer}
.gp-menu .tiles button:hover{background:rgba(255,255,255,.1)}
.gp-menu .tiles .ic{font-size:18px;width:22px;text-align:center;flex:none}
.gp-menu h3{margin:18px 0 8px;font:700 12px var(--bard-display,system-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:#01a982}
.gp-menu .lay{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px 18px}
.gp-menu .row{display:flex;gap:10px;align-items:flex-start;padding:4px 0;font-size:13px;line-height:1.4;color:rgba(255,255,255,.82)}
.gp-menu .row .bs{display:flex;gap:4px;flex:none;min-width:52px}
.gp-menu .ft{display:flex;gap:14px;margin-top:16px;color:rgba(255,255,255,.6);font-size:12px;align-items:center}
.gp-wheel{position:absolute;left:50%;top:50%;width:330px;height:330px;margin:-165px 0 0 -165px;z-index:40;display:none;pointer-events:none;border-radius:50%;background:radial-gradient(circle,rgba(8,20,26,.2) 0 22%,rgba(8,20,26,.78) 23% 70%,rgba(8,20,26,0) 71%)}
.gp-wheel .s{position:absolute;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,16,20,.8);box-shadow:0 0 0 1px rgba(255,255,255,.18);font:700 11px var(--bard-display,system-ui,sans-serif);color:#eafaf6;text-align:center;transition:transform .08s ease,box-shadow .08s ease}
.gp-wheel .s .g{font-size:22px;text-shadow:0 0 10px currentColor}
.gp-wheel .s.empty{opacity:.4}
.gp-wheel .s.held{box-shadow:0 0 0 2px #7fe0c0}
.gp-wheel .s.hot{transform:scale(1.22);box-shadow:0 0 0 2px #fff,0 0 20px rgba(1,169,130,.8)}
.gp-wheel .c{position:absolute;left:50%;top:50%;width:120px;transform:translate(-50%,-50%);text-align:center;font:600 12px/1.3 var(--bard-display,system-ui,sans-serif);color:#eafaf6}
.gp-wheel .lb{position:absolute;left:0;right:0;text-align:center;font:700 9px var(--bard-display,system-ui,sans-serif);letter-spacing:.14em;color:rgba(255,255,255,.5)}
.gp-wheel .c small{display:block;color:rgba(255,255,255,.55);font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;font-family:var(--bard-display,Georgia,serif)}
#l99-island-mount.l99-touch.gp-on :is(.l99-joy,.l99-thumb,.mg-hub,.mc-btn,.cb-btn,.combat-focus-controls,button[aria-label="Aim"],button[aria-label="Aim held item"]){display:none !important}
.mg-s.gp-sel{box-shadow:0 0 0 2px #01a982,0 0 12px rgba(1,169,130,.7)}
#l99-island-mount.gp-on [data-gp]{position:relative}
#l99-island-mount.gp-on [data-gp]::after{content:attr(data-gp);position:absolute;left:-9px;top:-9px;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--gp-c,#3b82f6) 25%,#0a0a0a);border:1px solid var(--gp-c,#3b82f6);color:var(--gp-c,#3b82f6);font:700 11px/1 var(--bard-display,system-ui,sans-serif);pointer-events:none}
`;

const FOCUSABLE = 'button,[role="button"],[role="tab"],[role="menuitem"],[role="option"],[role="switch"],[role="checkbox"],a[href],input:not([type="hidden"]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),.mg-s,[style*="cursor:pointer"],[style*="cursor: pointer"]';
const LAYERS = '[aria-modal="true"],[role="dialog"],[data-pad-layer]';

// deps: mount (the island's), canvas (the view), world() (the island's world, .player.state),
// hooks (main.js's HOOKS: combat, magic, gear, fishing, drive, carjack...), hint(text, ms),
// places() and settings() open the map pin's menu and the settings panel
export function createGamepad({ mount, canvas, world = () => null, hooks = {}, hint = () => {}, places = null, settings = null } = {}) {
	if (typeof navigator === 'undefined' || !navigator.getGamepads) return { available: false, menu: { add() {} }, info: () => ({ available: false }) };
	if (!document.getElementById('gp-style')) { const st = document.createElement('style'); st.id = 'gp-style'; st.textContent = CSS; document.head.appendChild(st); }
	const mk = (tag, cls, parent, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; parent?.appendChild(e); return e; };
	const P = () => world()?.player?.state || null;

	// ---------- the pad ----------
	let pad = null, family = 'xbox', raf = 0, lastT = 0, usedAt = 0, touchAt = 0, mode = 'idle', hudMode = false;
	const coarse = !!globalThis.matchMedia?.('(pointer: coarse)')?.matches;
	const touchy = () => coarse || !!mount?.classList.contains('l99-touch');
	// (eaten: down when the way of reading changed, so it counts only once let go: the A that
	// picks a menu's tile is not also a jump)
	const down = new Array(18).fill(false), at = new Array(18).fill(0), held = new Array(18).fill(false), eaten = new Array(18).fill(false);
	const trig = { LT: false, RT: false };
	function pickPad() {
		const all = [...(navigator.getGamepads?.() || [])].filter(Boolean);
		// (the one last pressed, else the first; a standard-mapped pad first)
		return all.find((g) => g.index === pad?.index && g.connected) || all.find((g) => g.mapping === 'standard') || all[0] || null;
	}
	function stick(x, y) {
		const m = Math.hypot(x, y);
		if (m < DEAD) return [0, 0, 0];
		const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
		return [x * k, y * k, Math.min(1, (m - DEAD) / (1 - DEAD))];
	}

	// ---------- keys, sent as the keyboard sends them ----------
	// (to the view: they bubble to the window's listeners, and a panel's own never see them)
	const sent = new Map();
	function key(type, k, o = {}) {
		const [kk, code] = keyOf(k, o.shift);
		const e = new KeyboardEvent(type, { key: kk, code, shiftKey: !!o.shift, bubbles: true, cancelable: true, composed: true });
		const to = o.to || (canvas?.isConnected ? canvas : document.body);
		return !to.dispatchEvent(e);          // true: something took it (preventDefault)
	}
	function hold(k, on, o = {}) {
		const id = (o.shift ? 'S+' : '') + k;
		if (on && !sent.has(id)) { sent.set(id, o); return key('keydown', k, o); }
		if (!on && sent.has(id)) { sent.delete(id); key('keyup', k, o); }
		return false;
	}
	const tap = (k, o) => { const r = key('keydown', k, o); key('keyup', k, o); return r; };
	// everything let go: on a change of mode, a lost pad, a hidden page
	let firing = null, aimHeld = false, aimLatched = false, aimDownT = 0, blocking = false, casting = null;
	// RB while locked on: a tap turns to the next target, so the cast waits for CAST_HOLD
	let rbAt = 0, rbCast = false;
	function releaseAll() {
		for (const [id, o] of [...sent]) { sent.delete(id); key('keyup', id.replace(/^S\+/, ''), o); }
		if (firing === 'gun') hooks.combat?.trigger?.(false);
		if (firing === 'reel') reel(false);
		firing = null;
		if (aimHeld || aimLatched) { hooks.gear?.weapon?.aim?.(false); aimHeld = aimLatched = false; }
		if (blocking) { hooks.combat?.melee?.block?.(false); blocking = false; }
		casting = null; rbCast = false;
		const s = P();
		if (s?.pad) { s.pad.x = s.pad.y = 0; s.pad.run = false; }
		wheel.close(false);
	}

	// ---------- the ring and the tip line ----------
	const ring = mk('div', 'gp-ring', document.body);
	const tip = mk('div', 'gp-tip', document.body);
	// (moved: the ring was moved by hand in this panel, so a panel's own first choice, such as
	// Enter world showing up when the world is ready, no longer takes it)
	let focusEl = null, tipSig = '', moved = false, layerWas = null;
	const FIRST = '[data-pad-first],[autofocus],.bl-enter';
	function showTip(items) {
		const sig = family + items.map((i) => i.join()).join('|');
		if (sig === tipSig) return;
		tipSig = sig;
		tip.innerHTML = items.map(([b, t]) => `<span class="i">${glyphHTML(b, family)} ${esc(t)}</span>`).join('');
	}

	// ---------- what is open ----------
	const visible = (el) => {
		if (!el?.isConnected) return false;
		if (el.checkVisibility) { if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; }
		else { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; }
		const r = el.getBoundingClientRect();
		return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
	};
	function openLayer() {
		if (menuEl.style.display === 'flex') return menuEl;
		let best = null, modal = false;
		for (const el of document.querySelectorAll(LAYERS)) {
			if (el === menuEl || el.closest('[data-pad-skip]') || !visible(el)) continue;
			const m = el.getAttribute('aria-modal') === 'true';
			if (!best || m || !modal) { best = el; modal = modal || m; }
		}
		return best;
	}
	function vehicle() {
		try { return !!(hooks.drive?.active?.() || hooks.carjack?.active?.() || world()?.boardwalk?.riding?.()); } catch { return false; }
	}
	function worldUp() {
		const s = P();
		return !!s && !!s.active && mount?.isConnected && mount.style.display !== 'none' && !window.L99Loading?.active?.();
	}

	// ---------- the ring's moves ----------
	function candidates(root, screen) {
		const out = [];
		for (const el of root.querySelectorAll(FOCUSABLE)) {
			if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[inert],[data-pad-skip]') || el === canvas) continue;
			// (a button inside another one: the outer one is the press)
			if (el.parentElement?.closest(FOCUSABLE) && root.contains(el.parentElement.closest(FOCUSABLE))) continue;
			if (!visible(el)) continue;
			// (on the screen's own buttons, only what a finger could press: not under a panel)
			if (screen) { const r = el.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (h && !el.contains(h) && !h.contains(el)) continue; }
			out.push(el);
		}
		return out;
	}
	const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
	function firstOf(list) {
		// (what is chosen, if anything says so; else the top left)
		const sel = list.find((e) => e.getAttribute('aria-selected') === 'true' && e.getAttribute('role') !== 'tab') || list.find((e) => e === document.activeElement);
		if (sel) return sel;
		return list.slice().sort((a, b) => { const p = centre(a), q = centre(b); return (Math.round(p.y / 24) - Math.round(q.y / 24)) || (p.x - q.x); })[0] || null;
	}
	function step(list, dx, dy) {
		if (!focusEl || !list.includes(focusEl)) { focus(firstOf(list)); return; }
		moved = true;
		const c = centre(focusEl);
		let best = null, bestS = Infinity;
		for (const el of list) {
			if (el === focusEl) continue;
			const q = centre(el), vx = q.x - c.x, vy = q.y - c.y;
			// (how far along the way pressed, measured edge to edge, and how far off its line)
			const along = dx ? (dx > 0 ? q.r.left - c.r.right : c.r.left - q.r.right) : (dy > 0 ? q.r.top - c.r.bottom : c.r.top - q.r.bottom);
			const ahead = vx * dx + vy * dy;
			if (ahead <= 4 || along < -Math.min(c.r.width, c.r.height) * 0.5) continue;
			const off = dx ? Math.max(0, Math.max(q.r.top, c.r.top) - Math.min(q.r.bottom, c.r.bottom)) : Math.max(0, Math.max(q.r.left, c.r.left) - Math.min(q.r.right, c.r.right));
			const s = Math.max(0, along) + off * 2.4 + Math.abs(dx ? vy : vx) * 0.15;
			if (s < bestS) { bestS = s; best = el; }
		}
		if (best) focus(best);
	}
	function focus(el) {
		focusEl = el;
		if (!el) return;
		try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* old browsers */ }
	}
	function paintRing() {
		if (!focusEl || !visible(focusEl)) { ring.style.display = 'none'; return; }
		const r = focusEl.getBoundingClientRect();
		ring.style.display = 'block';
		ring.style.left = `${r.left - 3}px`; ring.style.top = `${r.top - 3}px`;
		ring.style.width = `${r.width + 6}px`; ring.style.height = `${r.height + 6}px`;
		ring.style.borderRadius = getComputedStyle(focusEl).borderRadius || '12px';
	}
	// a press as a finger or the mouse makes it
	function press(el) {
		if (!el) return;
		if (el.tagName === 'INPUT' && /^(text|search|email|password|number|url|tel)?$/.test(el.type) || el.tagName === 'TEXTAREA') { el.focus(); return; }
		if (el.tagName === 'SELECT') { el.focus(); try { el.showPicker?.(); } catch { /* the arrows still change it */ } return; }
		const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
		const o = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 31, pointerType: 'mouse', isPrimary: true };
		const PE = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
		el.dispatchEvent(new PE('pointerdown', o));
		el.dispatchEvent(new MouseEvent('mousedown', o));
		el.dispatchEvent(new PE('pointerup', { ...o, buttons: 0 }));
		el.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
		if (el.isConnected) el.click();
		rumble(0.12, 0.05, 18);
	}
	// a slider or a list of choices, turned by left and right
	function adjust(el, d) {
		if (el?.tagName === 'INPUT' && el.type === 'range') { if (d > 0) el.stepUp(); else el.stepDown(); }
		else if (el?.tagName === 'SELECT') { const i = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + d)); if (i === el.selectedIndex) return true; el.selectedIndex = i; }
		else return false;
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
		return true;
	}
	function back(layer) {
		const a = document.activeElement;
		if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { a.blur(); return; }
		if (layer === menuEl) { closeMenu(); return; }
		if (!layer) { hudMode = false; return; }
		// Escape, where the panel listens and then where the game does; then its close button
		key('keydown', 'Escape', { to: focusEl && layer.contains(focusEl) ? focusEl : layer });
		if (!visible(layer)) return;
		key('keydown', 'Escape', { to: document.body });
		if (!visible(layer)) return;
		const x = [...layer.querySelectorAll('button,[role="button"]')].find((b) => visible(b) && /^(×|✕|✖|close|done|back|cancel)$|close|back to the game/i.test((b.getAttribute('aria-label') || b.textContent || '').trim()));
		if (x) { press(x); return; }
		if (layer.dataset.padLayer === 'hide') layer.style.display = 'none';
	}
	function tabs(layer, d) {
		if (layer?.dataset.pad === 'keys') { tap(d > 0 ? 'PageDown' : 'PageUp', { to: layer }); return; }
		const list = candidates(layer || mount, false).filter((e) => e.getAttribute('role') === 'tab');
		if (!list.length) return;
		const i = Math.max(0, list.findIndex((e) => e.getAttribute('aria-selected') === 'true' || e.classList.contains('on') || e.classList.contains('active')));
		const t = list[(i + d + list.length) % list.length];
		press(t); focus(t);
	}
	function scroller(from, root) {
		for (let e = from; e && e !== document.documentElement; e = e.parentElement) {
			const cs = getComputedStyle(e);
			if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) return e;
			if (e === root) break;
		}
		// (else the biggest that scrolls inside the panel)
		let best = null;
		if (root) for (const e of root.querySelectorAll('*')) if (e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && (!best || e.clientHeight > best.clientHeight)) best = e;
		return best;
	}

	// ---------- the menu (Start): what has no button of its own, and the layout ----------
	const ITEMS = [
		{ id: 'skills', icon: '✦', label: 'Skills and magic', run: () => tap('Tab') },
		{ id: 'gear', icon: '🎒', label: 'Gear and trade', run: () => tap('i') },
		{ id: 'character', icon: '🛡', label: 'Character and honor', run: () => tap('I', { shift: true }) },
		{ id: 'places', icon: '📍', label: 'Map and places', run: () => places?.() },
		{ id: 'settings', icon: '☀', label: 'Settings', run: () => settings?.() },
		{ id: 'chat', icon: '💬', label: 'Chat', run: () => hooks.chat?.open?.() },
		{ id: 'guide', icon: '✧', label: 'The Guide', run: () => tap('g') },
		{ id: 'compass', icon: '🧭', label: 'Morality compass', run: () => tap('k') },
		{ id: 'fly', icon: '✈', label: 'Fly or land', run: () => tap('f') },
		{ id: 'drive', icon: '🚗', label: 'Drive the roads', run: () => tap('v') },
		{ id: 'explore', icon: '🎬', label: 'Explore (hands free)', run: () => tap('o') },
		{ id: 'third', icon: '👤', label: 'Third person view', run: () => tap('p') },
		{ id: 'shove', icon: '✋', label: 'Shove', run: () => tap('x') },
		{ id: 'flare', icon: '🔥', label: 'Throw a flare', run: () => tap('y') },
		{ id: 'tattoo', icon: '🖋', label: 'Tattoo studio', run: () => tap('t') },
		{ id: 'test', icon: '∞', label: 'Spell test mode', run: () => { const b = [...document.querySelectorAll('button')].find((x) => /^∞ Test mode/.test(x.textContent || '')); b?.click(); } },
	];
	const menuEl = mk('div', 'gp-menu', mount || document.body);
	menuEl.setAttribute('role', 'dialog'); menuEl.setAttribute('aria-modal', 'true'); menuEl.setAttribute('aria-label', 'Controller menu');
	for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) menuEl.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') closeMenu(); });
	menuEl.addEventListener('pointerdown', (e) => { if (e.target === menuEl) closeMenu(); });
	function drawMenu() {
		const name = padName(pad?.id);
		menuEl.innerHTML = `<div class="pn"><h2>🎮 ${esc(name)}</h2><div class="sub">Everything in Bard, from the pad. ${glyphHTML('A', family)} to choose, ${glyphHTML('B', family)} to go back.</div><div class="tiles"></div>
			<h3>Layout</h3><div class="lay">${LAYOUT.map(([title, rows]) => `<div><div class="row" style="color:#fff;font-weight:700">${esc(title)}</div>${rows.map(([bs, t]) => `<div class="row"><span class="bs">${bs.map((b) => glyphHTML(b, family)).join('')}</span><span>${esc(t)}</span></div>`).join('')}</div>`).join('')}</div>
			<div class="ft"><span>Look speed follows Aim sensitivity in the settings; Invert look applies too.</span></div></div>`;
		const tiles = menuEl.querySelector('.tiles');
		for (const it of ITEMS) {
			if (it.when && !it.when()) continue;
			const b = mk('button', '', tiles, `<span class="ic">${esc(it.icon)}</span><span>${esc(it.label)}</span>`);
			b.type = 'button';
			b.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); try { it.run(); } catch (err) { console.warn('[gamepad]', it.id, err); } });
		}
		const x = mk('button', '', tiles, '<span class="ic">↩</span><span>Back to the game</span>');
		x.type = 'button'; x.setAttribute('aria-label', 'Back to the game');
		x.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); });
	}
	function openMenu() { releaseAll(); drawMenu(); menuEl.style.display = 'flex'; focusEl = null; }
	function closeMenu() { menuEl.style.display = 'none'; focusEl = null; }

	// ---------- the wheel (LB held): spells along the top, weapons along the bottom ----------
	const wheel = (() => {
		const el = mk('div', 'gp-wheel', mount || document.body);
		const mid = mk('div', 'c', el);
		mk('div', 'lb', el, 'SPELLS').style.top = '6px'; mk('div', 'lb', el, 'WEAPONS').style.bottom = '6px';
		let open = false, hot = -1, slots = [];
		// (angles from the right, up positive: five spells over the top, empty hands and five weapons under)
		const SPOTS = [162, 126, 90, 54, 18, -165, -135, -105, -75, -45, -15];
		const R = 118;
		function build() {
			el.querySelectorAll('.s').forEach((e) => e.remove());
			const M = hooks.magic, binds = M?.state?.binds || [], ws = M?.hotbar?.slots?.() || [];
			slots = SPOTS.map((a, i) => {
				const e = mk('div', 's', el);
				const x = 165 + R * Math.cos(a * Math.PI / 180), y = 165 - R * Math.sin(a * Math.PI / 180);
				e.style.left = `${x}px`; e.style.top = `${y}px`;
				if (i < 5) {
					const sp = SPELL[binds[i]];
					if (sp) { e.innerHTML = `<span class="g" style="color:${SCHOOLS[sp.school]?.color || '#fff'}">${esc(sp.glyph)}</span>`; if (i === spell) e.classList.add('held'); }
					else e.classList.add('empty');
					return { kind: 'spell', i, name: sp?.name || 'No spell', ok: !!sp, e };
				}
				if (i === 5) { const any = ws.some((w) => w?.held); e.textContent = '✋'; e.style.fontSize = '20px'; if (!any) e.classList.add('held'); return { kind: 'hands', name: 'Empty hands', ok: true, e }; }
				const w = ws[i - 6];
				if (w) { e.textContent = w.name.split(' ').pop().slice(0, 8); if (w.held) e.classList.add('held'); } else e.classList.add('empty');
				return { kind: 'weapon', i: i - 6, name: w?.name || 'Nothing here', ok: !!w, e };
			});
			mid.innerHTML = '<small>Spells and weapons</small>Point with the right stick';
		}
		return {
			get open() { return open; },
			show() { if (open) return; open = true; hot = -1; build(); el.style.display = 'block'; },
			point(x, y) {
				if (!open) return;
				if (Math.hypot(x, y) < 0.5) return;
				const a = Math.atan2(-y, x) * 180 / Math.PI;
				let best = -1, bd = 999;
				SPOTS.forEach((s, i) => { const d = Math.abs(((a - s + 540) % 360) - 180); if (d < bd) { bd = d; best = i; } });
				if (best === hot) return;
				slots[hot]?.e.classList.remove('hot'); hot = best; slots[hot]?.e.classList.add('hot');
				const S = slots[hot];
				mid.innerHTML = `<small>${S.kind === 'spell' ? 'Spell' : S.kind === 'hands' ? 'Put away' : 'Weapon'}</small>${esc(S.name)}`;
				rumble(0.05, 0.02, 12);
			},
			close(pick = true) {
				if (!open) return;
				open = false; el.style.display = 'none';
				const S = slots[hot];
				if (!pick || !S?.ok) return;
				if (S.kind === 'spell') { spell = S.i; hint(`${S.name} on ${GLYPHS[family].RB[0]}`, 1400); }
				else if (S.kind === 'hands') hands();
				else { const ws = hooks.magic?.hotbar?.slots?.() || []; if (!ws[S.i]?.held) hooks.magic?.hotbar?.press?.(S.i); }
			},
		};
	})();

	// ---------- the game's own actions ----------
	let spell = 0;
	const binds = () => hooks.magic?.state?.binds || [];
	function nextSpell(d = 1) {
		const b = binds();
		for (let k = 1; k <= 5; k++) { const i = (spell + d * k + 5) % 5; if (SPELL[b[i]]) { spell = i; hint(`${SPELL[b[i]].name}`, 1000); return; } }
		hint('No spells on the bar yet: the skills menu (Start) teaches them.', 2000);
	}
	function castStart() {
		const b = binds();
		if (!SPELL[b[spell]]) { const i = b.findIndex((id) => SPELL[id]); if (i < 0) { hint('No spells on the bar yet.', 1600); return; } spell = i; }
		casting = String((spell + 6) % 10);
		hold(casting, true);
	}
	function castEnd() { if (casting) { hold(casting, false); casting = null; } }
	function hands() {
		const ws = hooks.magic?.hotbar?.slots?.() || [], h = ws.findIndex((w) => w?.held);
		if (h >= 0) hooks.magic.hotbar.press(h);
	}
	function nextWeapon(d) {
		const ws = hooks.magic?.hotbar?.slots?.() || [];
		// (the ring: empty hands, then each slot with something on it)
		const ring = [-1, ...ws.map((w, i) => (w ? i : null)).filter((i) => i !== null)];
		if (ring.length < 2) { hint('Nothing to take up: weapons you own and what you pick up fill the bar.', 1800); return; }
		const now = Math.max(0, ring.indexOf(ws.findIndex((w) => w?.held)));
		const to = ring[(now + d + ring.length) % ring.length];
		if (to < 0) hands(); else hooks.magic.hotbar.press(to);
	}
	const armed = () => { try { return !!hooks.combat?.armed?.(); } catch { return false; } };
	// locked on to someone (combat/target-focus.js): RB and LB turn to the next and previous target
	const locked = () => { try { return !!hooks.combat?.focus?.locked?.(); } catch { return false; } };
	function cycleTarget(d) { if (hooks.combat?.focus?.cycle?.(d)) rumble(0.12, 0.08, 30); }
	const rodOut = () => { try { return !!hooks.fishing?.rodOut?.(); } catch { return false; } };
	function reel(on) { const F = hooks.fishing; if (F?.reel) F.reel(on); else if (on) F?.press?.(); }
	// X: the prompt nearest the thumb, else the E key's things, else a reload
	function prompt() {
		const box = mount?.querySelector('.l99-prompts');
		if (!box) return null;
		let best = null, by = -1;
		for (const b of box.querySelectorAll('button,[role="button"]')) { if (!visible(b)) continue; const r = b.getBoundingClientRect(); if (r.bottom > by) { by = r.bottom; best = b; } }
		return best;
	}
	function interact() {
		const p = prompt();
		if (p) { press(p); return; }
		if (tap('e')) return;
		if (armed()) tap('r');
	}
	let badge = null;
	function paintBadge(on) {
		const p = on ? prompt() : null;
		if (p === badge) return;
		if (badge) { badge.removeAttribute('data-gp'); badge.style.removeProperty('--gp-c'); }
		badge = p;
		if (p) { const [t, c] = GLYPHS[family].X; p.setAttribute('data-gp', t); p.style.setProperty('--gp-c', c); }
	}

	// ---------- the rumble ----------
	function rumble(strong, weak, ms) {
		try { pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch { /* no motors */ }
	}

	// ---------- each frame ----------
	const pressed = (i) => !!pad?.buttons[i]?.pressed;
	const value = (i) => pad?.buttons[i]?.value ?? (pressed(i) ? 1 : 0);
	let repeatAt = 0, lookHeld = 0;
	function frame(t) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, Math.max(0, (t - (lastT || t)) / 1000)); lastT = t;
		pad = pickPad();
		if (!pad) { if (mode !== 'idle') { releaseAll(); mode = 'idle'; } ring.style.display = tip.style.display = 'none'; paintBadge(false); return; }
		family = padFamily(pad.id);
		// edges: what went down or up since the last frame (triggers with a little give)
		const now = performance.now(), edge = [];
		for (let i = 0; i < 18; i++) {
			let on = pressed(i);
			if (i === B.LT || i === B.RT) { const k = i === B.LT ? 'LT' : 'RT', v = value(i); on = trig[k] ? v > TRIG_OFF : v > TRIG_ON; trig[k] = on; }
			if (eaten[i]) { if (on) { usedAt = now; continue; } eaten[i] = false; }
			if (on !== down[i]) { down[i] = on; edge[i] = on ? 'down' : 'up'; if (on) { at[i] = now; held[i] = false; usedAt = now; } }
		}
		const [lx, ly] = stick(pad.axes[0] || 0, pad.axes[1] || 0), [rx, ry, rm] = stick(pad.axes[2] || 0, pad.axes[3] || 0);
		if (lx || ly || rx || ry) usedAt = now;
		// (in use: on a touch screen until a finger is back on the glass, so the touch
		// controls stay out of the way; elsewhere for a while after the last press)
		const active = touchy() ? usedAt > touchAt : now - usedAt < 20000;
		mount?.classList.toggle('gp-on', active);
		// holds: a press past HOLD fires its hold once
		const holdNow = (i) => { if (down[i] && !held[i] && now - at[i] > HOLD) { held[i] = true; return true; } return false; };
		const tapped = (i) => edge[i] === 'up' && !held[i];

		// which way the pad is read now
		const layer = openLayer();
		const next = layer ? 'menu' : !worldUp() ? (document.hidden ? 'idle' : 'menu') : hudMode ? 'screen' : vehicle() ? 'vehicle' : 'game';
		if (next !== mode) {
			releaseAll(); mode = next; focusEl = null; tipSig = ''; repeatAt = 0;
			if (next !== 'screen') hudMode = false;
			for (let i = 0; i < 18; i++) if (down[i]) { eaten[i] = true; down[i] = false; edge[i] = undefined; }
		}
		if (edge[B.START] === 'down') { if (menuEl.style.display === 'flex') closeMenu(); else if (worldUp()) openMenu(); return; }

		if (mode === 'menu' || mode === 'screen') {
			paintBadge(false);
			const root = mode === 'screen' ? mount : layer || document.body;
			const nativeKeys = layer?.dataset.pad === 'keys';
			const list = nativeKeys ? [] : candidates(root, mode === 'screen');
			if (root !== layerWas) { layerWas = root; moved = false; }
			const first = !moved && list.find((e) => e.matches(FIRST));
			if (first && focusEl !== first) focus(first);
			else if (!nativeKeys && (!focusEl || !list.includes(focusEl))) focus(firstOf(list));
			// the stick or the d-pad: a step, then repeats while held
			let dx = 0, dy = 0;
			if (down[B.LEFT] || lx < -0.55) dx = -1; else if (down[B.RIGHT] || lx > 0.55) dx = 1;
			else if (down[B.UP] || ly < -0.55) dy = -1; else if (down[B.DOWN] || ly > 0.55) dy = 1;
			const fresh = edge[B.LEFT] === 'down' || edge[B.RIGHT] === 'down' || edge[B.UP] === 'down' || edge[B.DOWN] === 'down';
			if (!dx && !dy) repeatAt = 0;
			else if (fresh || !repeatAt || now >= repeatAt) {
				repeatAt = now + (repeatAt ? 110 : 380);
				if (nativeKeys) tap(dx < 0 ? 'ArrowLeft' : dx > 0 ? 'ArrowRight' : dy < 0 ? 'ArrowUp' : 'ArrowDown', { to: layer });
				else if (!(dx && adjust(focusEl, dx))) step(list, dx, dy);
			}
			if (edge[B.A] === 'down') { if (nativeKeys) tap('Enter', { to: layer }); else { const el = focusEl; press(el); if (mode === 'screen' && !openLayer()) hudMode = false; } }
			if (edge[B.B] === 'down') { if (nativeKeys) tap('Escape', { to: layer }); else back(mode === 'screen' ? null : layer); }
			if (edge[B.VIEW] === 'down' && mode === 'screen') hudMode = false;
			if (edge[B.LB] === 'down') tabs(layer, -1);
			if (edge[B.RB] === 'down') tabs(layer, 1);
			if (edge[B.PAD] === 'down' && nativeKeys) tap('Escape', { to: layer });
			if (ry) { const sc = scroller(focusEl || layer, layer || root); if (sc) sc.scrollTop += ry * 900 * dt; }
			paintRing();
			tip.style.display = active ? 'flex' : 'none';
			showTip(mode === 'screen' ? [['A', 'Press'], ['B', 'Back to the game']] : [['A', 'Choose'], ['B', 'Back'], ...(list.some((e) => e.getAttribute('role') === 'tab') || nativeKeys ? [['LB', 'Tabs'], ['RB', '']] : [])]);
			return;
		}
		ring.style.display = 'none'; tip.style.display = 'none';
		focusEl = null;
		paintBadge(active && mode === 'game');
		const s = P();
		if (!s) return;
		if (edge[B.VIEW] === 'down') { releaseAll(); hudMode = true; return; }
		if (edge[B.PAD] === 'down') { tap('Tab'); return; }

		if (mode === 'vehicle') {
			const thr = value(B.RT) > 0.3 || ly < -0.4, brk = value(B.LT) > 0.3 || ly > 0.4;
			hold('ArrowUp', thr); hold('ArrowDown', brk && !thr);
			hold('ArrowLeft', lx < -0.35); hold('ArrowRight', lx > 0.35);
			hold('Shift', down[B.L3]);
			hold(' ', down[B.A]);
			hold('q', down[B.RB]);
			if (edge[B.B] === 'down') tap('c');
			if (edge[B.X] === 'down') tap('m');
			if (edge[B.RIGHT] === 'down') tap('n');
			if (edge[B.Y] === 'down') { tap('Escape'); }
			s.padLook?.(rx * YAW_RATE * dt, ry * PITCH_RATE * dt);
			return;
		}

		// ----- on foot, swimming, flying -----
		// walking and running
		s.pad.x = lx; s.pad.y = ly;
		if (edge[B.L3] === 'down') s.pad.run = !s.pad.run;
		if (Math.hypot(lx, ly) < 0.2 && !s.flying) s.pad.run = false;
		// the view (a held full tilt turns faster after a moment), or the wheel
		if (wheel.open) wheel.point(rx, ry);
		else {
			lookHeld = rm > 0.95 ? lookHeld + dt : 0;
			const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.7);
			const k = lookHeld > BOOST_AFTER ? BOOST : 1;
			s.padLook?.(curve(rx) * YAW_RATE * k * dt, curve(ry) * PITCH_RATE * k * dt);
		}
		// A: Space (jump, a double tap flies or lands, held climbs in flight); B: C (crouch, slide, dodge, descend)
		hold(' ', down[B.A]);
		hold('c', down[B.B]);
		// RT: the reel when the rod is out, the gun's trigger with a gun in hand, else a strike (Q)
		if (edge[B.RT] === 'down') {
			if (rodOut()) { firing = 'reel'; reel(true); }
			else if (armed()) { firing = 'gun'; hooks.combat?.trigger?.(true); rumble(0.25, 0.4, 60); }
			else { firing = 'q'; hold('q', true); }
		} else if (edge[B.RT] === 'up') {
			if (firing === 'reel') reel(false);
			else if (firing === 'gun') hooks.combat?.trigger?.(false);
			else if (firing === 'q') hold('q', false);
			firing = null;
		}
		// LT: the sights with a gun (a quick tap leaves them up), the block without
		if (edge[B.LT] === 'down') {
			if (aimLatched) { aimLatched = false; hooks.gear?.weapon?.aim?.(false); }
			else if (armed()) { aimHeld = true; aimDownT = now; hooks.gear?.weapon?.aim?.(true); }
			else { blocking = true; hooks.combat?.melee?.block?.(true); }
		} else if (edge[B.LT] === 'up') {
			if (blocking) { hooks.combat?.melee?.block?.(false); blocking = false; }
			if (aimHeld) { if (now - aimDownT < 280) aimLatched = true; else hooks.gear?.weapon?.aim?.(false); aimHeld = false; }
		}
		if (aimLatched && !armed()) aimLatched = false;
		// RB: the chosen spell, held for as long as a beam pours. Locked on, a tap turns to the
		// next target and the cast starts once the button has been held a moment.
		if (edge[B.RB] === 'down') { rbAt = now; rbCast = !locked(); if (rbCast) castStart(); }
		else if (edge[B.RB] === 'up') { if (rbCast) castEnd(); else cycleTarget(1); rbCast = false; }
		else if (down[B.RB] && !rbCast && now - rbAt > CAST_HOLD) { rbCast = true; castStart(); }
		// LB: a tap, the next spell (locked on: the previous target); held, the wheel
		if (holdNow(B.LB)) { wheel.show(); rumble(0.08, 0.04, 20); }
		if (edge[B.LB] === 'up') { if (wheel.open) wheel.close(true); else if (locked()) cycleTarget(-1); else nextSpell(1); }
		// Y: the heavy blow (Shift+Q) without a gun, the fire mode (Z) with one
		if (edge[B.Y] === 'down') { if (armed()) tap('z'); else hold('q', true, { shift: true }); }
		else if (edge[B.Y] === 'up') hold('q', false, { shift: true });
		// X: the prompt / E / reload; held, the rod or hands up (H)
		if (holdNow(B.X)) tap('h');
		if (tapped(B.X)) interact();
		// R3: lock on; held, the next one
		if (holdNow(B.R3)) tap('`', { shift: true });
		if (tapped(B.R3)) { tap('`'); if (locked()) hint(`Locked on. ${GLYPHS[family].RB[0]} / ${GLYPHS[family].LB[0]}: the next and previous target · hold ${GLYPHS[family].RB[0]} to cast.`, 2600); }
		// the d-pad
		if (edge[B.LEFT] === 'down') nextWeapon(-1);
		if (edge[B.RIGHT] === 'down') nextWeapon(1);
		if (holdNow(B.UP)) tap('j');
		if (tapped(B.UP)) { if (s.flying) tap('b'); else tap('j'); }
		if (holdNow(B.DOWN)) tap('y');
		if (tapped(B.DOWN)) tap('u');
		// the chosen spell, lit on the bar
		const bar = mount?.querySelectorAll('.mg-bar .grp')[1];
		if (bar) [...bar.children].forEach((e, i) => e.classList.toggle('gp-sel', active && i === spell));
	}

	// ---------- plugged in, unplugged ----------
	function start() { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } }
	addEventListener('gamepadconnected', (e) => {
		const g = e.gamepad; family = padFamily(g.id); usedAt = performance.now();
		start();
		hint(`🎮 ${padName(g.id)} ready. ${GLYPHS[family].START[0]} for the menu and the layout, ${GLYPHS[family].VIEW[0]} for the buttons on screen.`, 5200);
	});
	addEventListener('gamepaddisconnected', () => {
		if ([...(navigator.getGamepads?.() || [])].some(Boolean)) return;
		releaseAll(); cancelAnimationFrame(raf); raf = 0; mode = 'idle';
		ring.style.display = tip.style.display = 'none'; paintBadge(false); mount?.classList.remove('gp-on');
		hint('Controller disconnected.', 2400);
	});
	document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
	// (the keyboard or the mouse in hand: the pad's marks go)
	for (const ev of ['keydown', 'mousedown']) addEventListener(ev, (e) => { if (e.isTrusted) usedAt = 0; }, true);
	addEventListener('pointerdown', (e) => { if (e.isTrusted && e.pointerType === 'touch') touchAt = performance.now(); }, true);
	// (a pad already awake when the page opened)
	if ([...(navigator.getGamepads?.() || [])].some(Boolean)) start();

	return {
		available: true,
		// the Start menu's tiles: { id, icon, label, run(), when?() }
		menu: { add(item) { const i = ITEMS.findIndex((x) => x.id === item.id); if (i >= 0) ITEMS[i] = item; else ITEMS.push(item); return () => { const j = ITEMS.indexOf(item); if (j >= 0) ITEMS.splice(j, 1); }; }, open: openMenu, close: closeMenu },
		family: () => family, glyph: (b) => glyphHTML(b, family),
		info: () => ({ available: true, connected: !!pad, id: pad?.id || null, family, mode, spell, focus: focusEl ? (focusEl.getAttribute('aria-label') || focusEl.textContent || '').trim().slice(0, 60) : null, menu: menuEl.style.display === 'flex', wheel: wheel.open, held: [...sent.keys()] }),
	};
}
