// Living in the colony: what you do there. The lifts up the towers, the airlocks that
// cycle as you go out (suit sealed) or come in (suit off), and the terminals: the colony
// map, a rover or the maglev out to any outpost, the supply depot.

import { DEPOT } from './interiors.js';

const CSS = 'position:absolute;left:50%;transform:translateX(-50%);pointer-events:auto;font:13px system-ui;color:#eafaf6;';

export function createColonyLife(X, o) {
	const { camera, hint, mount } = o;
	let suited = false, pressurised = null, cycle = 0, liftT = 0, liftDone = null, open = null;
	const airC = o.airMat.color;
	// ---------- the terminal's button and panel ----------
	const btn = mount ? document.createElement('button') : null;
	const panel = mount ? document.createElement('div') : null;
	if (mount) {
		btn.style.cssText = CSS + 'bottom:calc(96px + env(safe-area-inset-bottom));display:none;padding:9px 14px;border-radius:20px;border:1px solid rgba(165,246,226,.55);background:rgba(8,20,26,.82);font-weight:600;';
		panel.style.cssText = CSS + 'top:calc(70px + env(safe-area-inset-top));display:none;width:min(420px,calc(100% - 32px));max-height:calc(100% - 150px);overflow:auto;background:rgba(6,16,22,.92);border:1px solid rgba(165,246,226,.4);border-radius:12px;padding:12px;';
		panel.dataset.colonyPanel = '';
		mount.append(btn, panel);
		for (const el of [btn, panel]) for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());
		btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
	}
	let here = null;
	function toggle() {
		if (!panel) return;
		if (panel.style.display !== 'none') { panel.style.display = 'none'; open = null; return; }
		if (!here) return;
		open = here;
		render(here);
		panel.style.display = 'block';
	}
	const onKey = (e) => {
		if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
		if ((e.key === 'e' || e.key === 'E') && (here || open)) { e.preventDefault(); toggle(); }
		else if (e.key === 'Escape' && open) toggle();
	};
	if (mount) addEventListener('keydown', onKey);
	const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
	const button = (label, id, off = false) => `<button data-go="${id}" ${off ? 'disabled' : ''} style="display:block;width:100%;margin:4px 0;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:${off ? 'transparent' : 'rgba(165,246,226,.08)'};color:#eafaf6;font:13px system-ui;text-align:left;padding:6px 10px;opacity:${off ? 0.5 : 1};cursor:pointer;">${esc(label)}</button>`;
	// the map: every site as a dot, the hub at the middle, you as a ring
	function map() {
		const S = o.sites(), hb = X.rooms.dome, P = camera.position;
		let ext = 300;
		for (const s of S) ext = Math.max(ext, Math.abs(s.x - hb.x), Math.abs(s.z - hb.z));
		const k = 140 / (ext * 1.1), sx = (x) => 160 + (x - hb.x) * k, sz = (z) => 150 + (z - hb.z) * k;
		let svg = `<svg viewBox="0 0 320 300" style="width:100%;background:#05090c;border-radius:8px;margin:6px 0">`;
		for (const s of S) if (s.far) svg += `<line x1="160" y1="150" x2="${sx(s.x).toFixed(1)}" y2="${sz(s.z).toFixed(1)}" stroke="#2c3b40" stroke-dasharray="3 3"/>`;
		for (const s of S) svg += `<circle cx="${sx(s.x).toFixed(1)}" cy="${sz(s.z).toFixed(1)}" r="${s.main ? 5 : 3.5}" fill="${s.far ? '#f0b050' : '#a5f6e2'}"/><text x="${(sx(s.x) + 6).toFixed(1)}" y="${(sz(s.z) + 4).toFixed(1)}" fill="#cfe" font-size="9">${esc(s.name)}</text>`;
		svg += `<circle cx="${sx(P.x).toFixed(1)}" cy="${sz(P.z).toFixed(1)}" r="6" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`;
		return svg;
	}
	function render(T) {
		let h = `<div style="font-weight:700;letter-spacing:.05em">${esc(T.name)}</div><div style="opacity:.7;font-size:12px">${esc(o.name)} · ${suited ? 'suit sealed' : 'shirt-sleeve'}</div>`;
		// what an errand can do here (errands.js), first
		const qb = o.errands?.()?.buttons(T) || [], qsite = o.errands?.()?.site();
		if (qb.length) h += '<div style="margin:8px 0 2px;color:#e2bf6a">Errand</div>' + qb.map((b) => button(b.label, 'q:' + b.id, b.off)).join('');
		if (T.kind === 'depot') {
			h += '<div style="margin:8px 0 4px;opacity:.85">Stores for the crater runs. Take what you need.</div>';
			for (const it of DEPOT) h += button(`${it.name}: ${it.note}${o.give ? '' : ' (stores open with the inventory)'}`, 'take:' + it.id, !o.give);
		} else {
			h += map();
			h += `<div style="margin:6px 0 2px;opacity:.85">${T.kind === 'control' ? 'Traffic control: send a rover or the maglev out with you aboard.' : 'Ride out:'}</div>`;
			o.sites().forEach((s, i) => { h += button(`${s.name === qsite ? '★ ' : ''}${s.rail ? 'Maglev' : 'Rover'} to ${s.name}${s.dist ? ` · ${(s.dist / 1000).toFixed(1)} km` : ''}`, 'site:' + i); });
		}
		h += button('Close (E)', 'close');
		panel.innerHTML = h;
		for (const b of panel.querySelectorAll('button[data-go]')) b.addEventListener('click', (e) => {
			e.stopPropagation();
			const [kind, id] = b.dataset.go.split(':');
			if (kind === 'close') { toggle(); return; }
			if (kind === 'q') { const said = o.errands?.()?.act(b.dataset.go.slice(2)); if (said) hint?.(said, 5000); render(T); return; }
			if (kind === 'take') { const it = DEPOT.find((d) => d.id === id); if (it && o.give?.(it)) hint?.(`${it.name}: stowed.`, 2500); return; }
			if (kind === 'site') { toggle(); ride(+id); }
		});
	}
	// out to a site by rover or maglev, the suit sealed (a terminal, or the traffic controller)
	function ride(i) {
		const s = o.sites()[i];
		if (!s) return;
		suited = true; pressurised = false;
		o.go(i);
		hint?.(`${s.rail ? 'The maglev' : 'A rover'} takes you out to ${s.name}. Suit sealed.`, 4500);
	}

	// ---------- where you are ----------
	const inVol = (p, foot) => X.vol.some((v) => {
		if (foot < v.y0 || foot > v.y1) return false;
		if (v.kind === 'disc') return Math.hypot(p.x - v.x, p.z - v.z) < v.r;
		const dx = p.x - v.x, dz = p.z - v.z, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
		return Math.abs(dx * c - dz * s) < v.hw && Math.abs(dx * s + dz * c) < v.hd;
	});
	const inLock = (p) => X.airlocks.some((a) => {
		const dx = p.x - a.x, dz = p.z - a.z, c = Math.cos(a.yaw), s = Math.sin(a.yaw);
		return Math.abs(dx * c - dz * s) < a.hw + 0.3 && Math.abs(dx * s + dz * c) < a.hd + 0.6;
	});
	function update(dt) {
		const P = o.player?.();
		if (!P) return;
		const p = P.pos, foot = p.y - 1.7;
		// the airlock: cycling amber while it pumps, green when it is done
		if (cycle > 0) { cycle -= dt; airC.setRGB(1, 0.55, 0.1).multiplyScalar(0.6 + 0.4 * Math.sin(cycle * 14)); if (cycle <= 0) airC.setRGB(0.25, 1, 0.45); }
		if (!P.flying && !inLock(p)) {
			const inside = inVol(p, foot);
			if (pressurised === null) { pressurised = inside; suited = !inside; }
			else if (inside !== pressurised) {
				pressurised = inside;
				if (inside && suited) { suited = false; cycle = 2.2; hint?.('Airlock cycling… pressure equalised. Helmet off, suit stowed.', 3500); }
				else if (!inside && !suited) { suited = true; cycle = 2.2; hint?.('Airlock cycling… suit sealed, helmet lamps on. Outside: vacuum.', 3500); }
			}
		}
		// the lifts: stand on the pad a moment
		let onLift = null;
		for (const L of X.lifts) {
			if (Math.hypot(p.x - L.x, p.z - L.z) > 0.9) continue;
			if (Math.abs(foot - L.lo) < 0.8) onLift = { L, to: L.hi, up: true };
			else if (Math.abs(foot - L.hi) < 0.8) onLift = { L, to: L.lo, up: false };
		}
		if (!onLift) { liftT = 0; liftDone = null; } else if (liftDone !== onLift.L) {
			liftT += dt;
			if (liftT > 0.9) {
				liftT = 0; liftDone = onLift.L;
				p.y = onLift.to + 1.7; P.vel?.set(0, 0, 0);
				camera.position.y = p.y;
				hint?.(onLift.up ? `Lift: up to ${onLift.L.name}.` : 'Lift: down.', 2000);
			}
		}
		// a terminal close by: its button
		here = null;
		for (const T of o.terminals) if (Math.hypot(p.x - T.x, p.z - T.z) < 1.9 && Math.abs(foot - T.y) < 1.6) { here = T; break; }
		if (btn) {
			const show = !!here && !P.flying;
			btn.style.display = show ? 'block' : 'none';
			if (show) btn.textContent = `🖥 ${here.name}${o.isTouch ? '' : ' (E)'}`;
			if (open && (!here || here !== open) && panel.style.display !== 'none') { panel.style.display = 'none'; open = null; }
		}
	}
	function dispose() {
		if (mount) { removeEventListener('keydown', onKey); btn.remove(); panel.remove(); }
	}
	return { update, dispose, ride, suited: () => suited, inside: () => pressurised, open: () => !!open, terminal: () => here?.name || null, toggle };
}
