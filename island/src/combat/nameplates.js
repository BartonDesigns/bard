// A health bar over every monster in a fight (Josh 2026-10-23: the bosses have their bar across
// the top; the others are tougher now and show theirs too). Each one in it (roused, or hurt, or
// the one you have targeted) and near enough and in your sight gets a small bar over its head;
// the one you have targeted gets a wider one with its name. A pale piece behind the fill holds
// where its life was for a moment, so each blow shows as what it took. An elite's bar is edged
// in gold. Nothing for one standing still as a tree (the Burnt Giant asleep) or still in a
// villager's shape (the Moonturned): a bar would give them away.
//
// Small parts placed by transform from the mount's own corner, none screen-sized (a full-screen
// layer over the world costs a phone a screen-sized backing store: combat/hud.js), hidden with
// display:none when not needed, at most a few at a time.

import { vitalsOf, chipStep, rankOf, plainName } from './vitals.js';

// how far off a bar shows, in m (a big one from further: its height over 4 m, times)
export const PLATE_REACH = 55;
export const reachOf = (h) => PLATE_REACH * Math.max(1, (h.Sp?.height || 2) / 4);
// whether one of the fight's (combat/ai-squads.js) gets a bar now: d its distance from you
export function plateWanted(h, d, targeted = false) {
	if (!h?.cr || h.ally || h.gone) return false;
	if (h.dormant || (h.beast && h.turn < 0)) return false;
	if (h.dead) return (h.deadT || 0) < 0.9;
	if (d > reachOf(h) * (targeted ? 1.4 : 1)) return false;
	return targeted || h.alert > 0 || h.H.hp < h.H.max;
}
// the point over its head the bar sits on
export function plateTop(h, out = { x: 0, y: 0, z: 0 }) {
	out.x = h.pos.x; out.z = h.pos.z;
	out.y = h.pos.y + (h.Sp?.height || 2) * (h.cr?.size || 1) + (h.alt || 0) + 0.35;
	return out;
}

const CSS = `
.np{position:absolute;left:0;top:0;display:none;z-index:4;pointer-events:none;text-align:center;font:600 11px/1.15 var(--bard-display,system-ui,sans-serif);color:#ffe0d6;text-shadow:0 1px 2px rgba(0,0,0,.85)}
.np .n{display:none;white-space:nowrap;margin-bottom:2px;letter-spacing:.3px}
.np .n i{font-style:normal;color:#ffd257;margin-right:3px}
.np .b{position:relative;height:5px;border-radius:3px;background:rgba(8,10,12,.62);overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.55)}
.np .b i{position:absolute;left:0;top:0;bottom:0;width:100%;transform-origin:left}
.np .b .c{background:rgba(255,236,214,.9)}
.np .b .f{background:linear-gradient(180deg,#ff7a5a,#d0302a)}
.np.el .b{box-shadow:0 0 0 1px #ffd257,0 0 4px rgba(255,210,87,.45)}
.np.on .n{display:block}
.np.on .b{height:7px;box-shadow:0 0 0 1px rgba(255,255,255,.85),0 0 6px rgba(0,0,0,.6)}
.np.on.el .b{box-shadow:0 0 0 1px #ffd257,0 0 7px rgba(255,210,87,.6)}
`;
const STYLE_ID = 'np-style';

export function createNameplates({ mount, camera, vector, list, blocked, target, phone = false }) {
	if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
	const MAX = phone ? 5 : 9, W = phone ? 52 : 64, WT = phone ? 84 : 104;
	const plates = [];
	// each monster's own: its chip, its sight from you (rechecked a few times a second)
	const mine = new WeakMap();
	const top = { x: 0, y: 0, z: 0 }, p = vector();
	let w = 0, hgt = 0, sizeT = 0, shown = 0;
	function plate(i) {
		if (plates[i]) return plates[i];
		const el = document.createElement('div'); el.className = 'np'; el.setAttribute('aria-hidden', 'true');
		el.innerHTML = '<div class="n"><i></i><span></span></div><div class="b"><i class="c"></i><i class="f"></i></div>';
		const P = { el, nameEl: el.querySelector('.n span'), glyph: el.querySelector('.n i'), bar: el.querySelector('.b'), chip: el.querySelector('.c'), fill: el.querySelector('.f'), h: null, k: {} };
		mount.appendChild(el);
		return (plates[i] = P);
	}
	const set = (P, key, v, fn) => { if (P.k[key] !== v) { P.k[key] = v; fn(v); } };
	function hideFrom(i) { for (let j = i; j < plates.length; j++) { const P = plates[j]; if (P.h || P.k.on !== false) { P.h = null; P.k.on = false; P.el.style.display = 'none'; } } }
	const cand = [];
	function update(dt, show = true) {
		if (!show) { hideFrom(0); shown = 0; return; }
		sizeT -= dt;
		if (sizeT <= 0 || !w) { sizeT = 1; w = mount.clientWidth || innerWidth; hgt = mount.clientHeight || innerHeight; }
		const T0 = target?.() || null, eye = camera.position;
		cand.length = 0;
		for (const h of list()) {
			if (!h.cr) continue;
			const d = Math.hypot(h.pos.x - eye.x, h.pos.y - eye.y, h.pos.z - eye.z), on = !!T0 && T0 === h.T;
			if (!plateWanted(h, d, on)) continue;
			let m = mine.get(h);
			if (!m) { m = { chip: {}, seen: false, losT: 0 }; mine.set(h, m); }
			// (in your sight: rechecked now and then, staggered; one you just struck you can see)
			m.losT -= dt;
			if (m.losT <= 0 && !h.dead) { m.losT = 0.25 + Math.random() * 0.15; m.seen = !blocked(eye, h.T.bound); }
			if (!m.seen && !on && !(h.H.quiet < 0.6) && !h.dead) continue;
			plateTop(h, top);
			p.set(top.x, top.y, top.z).project(camera);
			if (p.z > 1 || Math.abs(p.x) > 1.15 || p.y < -1.05) continue;
			// (a tall one's head off the top of the screen: its bar rides the top edge over it)
			cand.push({ h, m, d, on, x: (p.x + 1) / 2 * w, y: Math.max(34, (1 - p.y) / 2 * hgt) });
		}
		cand.sort((a, b) => (b.on - a.on) || a.d - b.d);
		const n = Math.min(MAX, cand.length);
		for (let i = 0; i < n; i++) {
			const c = cand[i], P = plate(i), h = c.h, v = vitalsOf(h.T);
			const f = h.dead ? 0 : v ? v.frac : 0;
			if (P.h !== h) { P.h = h; P.k = {}; }
			set(P, 'on', true, () => { P.el.style.display = 'block'; });
			const rank = rankOf(h.T), wide = c.on;
			set(P, 'cls', `np${wide ? ' on' : ''}${rank ? ' el' : ''}`, (s) => { P.el.className = s; });
			// (nearer, a little larger; never less than three quarters)
			const k = wide ? 1 : Math.max(0.75, Math.min(1, 14 / Math.max(1, c.d) + 0.6)), bw = Math.round((wide ? WT : W) * k);
			set(P, 'w', bw, (x) => { P.el.style.width = `${x}px`; });
			if (wide) {
				set(P, 'name', plainName(h.T.name), (s) => { P.nameEl.textContent = s; });
				set(P, 'glyph', rank === 'boss' ? '☠' : rank ? '◆' : '', (s) => { P.glyph.textContent = s; P.glyph.style.display = s ? '' : 'none'; });
			}
			const tx = Math.round(c.x - bw / 2), ty = Math.round(c.y - (wide ? 24 : 6));
			set(P, 'xy', `${tx},${ty}`, () => { P.el.style.transform = `translate(${tx}px,${ty}px)`; });
			set(P, 'f', f.toFixed(3), (s) => { P.fill.style.transform = `scaleX(${s})`; });
			set(P, 'c', chipStep(c.m.chip, f, dt).toFixed(3), (s) => { P.chip.style.transform = `scaleX(${s})`; });
			set(P, 'o', h.dead ? Math.max(0, 1 - (h.deadT || 0) / 0.9).toFixed(2) : '1', (s) => { P.el.style.opacity = s; });
		}
		hideFrom(n);
		shown = n;
	}
	return {
		update,
		info: () => ({ shown, plates: plates.filter((P) => P.h).map((P) => ({ id: P.h.id, name: plainName(P.h.T.name), wide: P.k.cls?.includes(' on') || false, elite: P.k.cls?.includes(' el') || false, fill: +P.k.f, chip: +P.k.c, at: P.k.xy })) }),
		dispose() { for (const P of plates) P.el.remove(); plates.length = 0; },
	};
}
