import { canHit } from './targets.js';

// A deliberate target selection. L marks a target (no camera steering, bullet magnetism or
// extra reach). People, creatures and vehicles alike: a helicopter overhead, a convoy's tank or
// a car can be locked as a person can (further off, since they are big and high), and a bolt
// cast at a locked vehicle seeks it (magic/caster.js). The ` key (or the Lock button, or a tap on a person on a touch screen) locks on:
// the view then tracks them, aimed at the chest, while your own mouse or drag still moves the aim
// about on their body (up for the head, down for the legs) within a window round them. Pushing
// well past that window lets go. combat.js hands assist() to player.js, which calls it before the
// view is set each frame; the recoil you fire with is told to kick() and settles back on its own.
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// the aim window round a locked target, in metres at their distance: across, above and below the chest
export const LOCK_WINDOW = { side: 0.75, up: 0.62, down: 1.35, slip: 0.22 };
// the yaw and pitch from an eye to a point (player.js: forward is (-sin yaw, -cos yaw))
export function aimAngles(eye, at) {
	const dx = at.x - eye.x, dy = at.y - eye.y, dz = at.z - eye.z;
	return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), d: Math.hypot(dx, dy, dz) };
}
// one frame of the lock: L the lock's state ({ offY, offP, recY, recP, lastY, lastP, slip, acq }),
// p the player ({ yaw, pitch }), want the angles to the target's chest. Moves p; false when the
// player has pushed the aim off the target hard enough to let go.
export function trackStep(L, p, want, dt, kickY = 0, kickP = 0) {
	if (L.lastY != null) {
		L.offY += wrapA(p.yaw - L.lastY) - kickY;
		L.offP += p.pitch - L.lastP - kickP;
	}
	L.recY += kickY; L.recP += kickP;
	const d = Math.max(1.5, want.d), W = LOCK_WINDOW;
	const wY = Math.atan(W.side / d), wU = Math.atan(W.up / d), wD = Math.atan(W.down / d);
	const over = Math.abs(L.offY) - wY;
	if (over > 0) { L.offY = Math.sign(L.offY) * wY; L.slip += over; } else L.slip = Math.max(0, L.slip - dt * 0.6);
	if (L.slip > W.slip) return false;
	L.offP = Math.max(-wD, Math.min(wU, L.offP));
	L.recY *= Math.exp(-dt * 7); L.recP *= Math.exp(-dt * 4.5);
	L.acq = Math.min(1, L.acq + dt / 0.28);
	const k = 1 - Math.exp(-dt * (L.acq < 1 ? 11 : 32));
	p.yaw += wrapA(want.yaw + L.offY + L.recY - p.yaw) * k;
	p.pitch = Math.max(-1.35, Math.min(1.35, p.pitch + (want.pitch + L.offP + L.recP - p.pitch) * k));
	L.lastY = p.yaw; L.lastP = p.pitch;
	return true;
}
// the person nearest a tap, as seen on screen: within a body's width of the line from their
// feet to their head (px: a function projecting a point to { x, y, z } in pixels, z > 1 behind)
export function pickAt(list, tx, ty, px, minPx = 30) {
	let best = null, bd = Infinity;
	for (const T of list) {
		const B = T.bound; if (!B) continue;
		// (a person from their feet to their head; a vehicle the height of its bound)
		const lo = isVehicle(T) ? Math.max(0.9, B.r || 0) : 0.9, hi = isVehicle(T) ? Math.max(0.85, B.r || 0) : 0.85;
		const a = px({ x: B.x, y: B.y - lo, z: B.z }), b = px({ x: B.x, y: B.y + hi, z: B.z });
		if (a.z > 1 || b.z > 1) continue;
		const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1;
		const u = Math.max(0, Math.min(1, ((tx - a.x) * vx + (ty - a.y) * vy) / l2));
		const dd = Math.hypot(tx - a.x - vx * u, ty - a.y - vy * u), reach = Math.max(minPx, Math.sqrt(l2) * 0.22);
		if (dd < reach && dd < bd) { bd = dd; best = T; }
	}
	return best;
}
// what can be locked, and how far off: a vehicle (the military's, a helicopter) from far
// further than a person, a car from a little further
export const isVehicle = (T) => T?.kind === 'vehicle' || T?.kind === 'car';
export const focusReach = (T, base = 55) => base * (T?.kind === 'vehicle' ? 4.5 : T?.kind === 'car' ? 1.6 : 1);
export function focusScore(T, eye, forward, { hostile = false, max = 55, shooter, rules, dotMin = null } = {}) {
	if (!T?.bound || !['person', 'hostile', 'remote', 'vehicle', 'car'].includes(T.kind) || !canHit(T, shooter, rules) || T.P?.ragdoll || T.ref?.dead || T.ref?.gone || T.health?.hp <= 0) return Infinity;
	const dx = T.bound.x - eye.x, dy = T.bound.y - eye.y, dz = T.bound.z - eye.z;
	const d = Math.hypot(dx, dy, dz), dot = (dx * forward.x + dy * forward.y + dz * forward.z) / (d || 1);
	if (d > focusReach(T, max) || dot < (dotMin ?? (hostile ? 0.3 : 0.965))) return Infinity;
	return (1 - dot) * 30 + d * 0.12 + (hostile ? 0 : 25);
}
export function createTargetFocus({ layer, camera, mount, active, blocked, hostile, shooter, rules, vector, hint = () => {}, aimPoint = null }) {
	let selected = null, timer = 0, hiddenFor = 0, seen = false, candidates = [], available = false;
	// the lock-on (null while only marked): see trackStep
	let track = null, kickY = 0, kickP = 0;
	const chest = (T) => aimPoint?.(T) || T.aim?.() || { x: T.bound.x, y: T.bound.y + 0.45, z: T.bound.z };
	const direction = vector(), point = vector();
	const marker = document.createElement('div'); marker.className = 'combat-focus-marker'; marker.setAttribute('aria-hidden', 'true');
	marker.style.cssText = 'display:none;position:absolute;pointer-events:none;z-index:6;color:#ffe4a0;font:600 12px var(--bard-display,system-ui,sans-serif);text-shadow:0 1px 3px #000;transform:translate(-50%,-50%);text-align:center;white-space:nowrap';
	const reticle = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H3v6M19 3h6v6M3 19v6h6M25 19v6h-6"/><circle cx="14" cy="14" r="3"/></svg>';
	const arrow = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 5 9 9-9 9"/></svg>';
	// (under the name: their life, a thin bar, for anyone who has one: Ryan 2026-10-22 could not
	// see the Burnt Giant's health)
	marker.innerHTML = '<span style="display:block;width:28px;height:28px"></span><span style="position:absolute;top:32px;left:50%;width:max-content;max-width:160px"><span style="display:block;overflow:hidden;text-overflow:ellipsis"></span><span class="combat-focus-life" style="display:none;height:3px;margin:3px auto 0;width:56px;border-radius:2px;background:rgba(0,0,0,.5);overflow:hidden"><span style="display:block;height:100%;width:100%;transform-origin:left;background:#4fe0a8"></span></span></span>';
	const glyph = marker.firstElementChild, label = marker.lastElementChild.firstElementChild, life = marker.querySelector('.combat-focus-life'), lifeFill = life.firstElementChild;
	// what they have left, 0..1, or null for one with no life to show (T.health: a person's;
	// T.ref.H: a squad fighter's or a creature's, combat/ai-squads.js)
	const lifeOf = (T) => { const H = T.health || T.ref?.H; return H && H.max > 0 && Number.isFinite(H.hp) ? Math.max(0, Math.min(1, H.hp / H.max)) : null; };
	const dock = document.createElement('div'); dock.className = 'combat-focus-controls';
	dock.style.cssText = 'display:none;position:absolute;right:calc(12px + env(safe-area-inset-right));top:clamp(110px,32%,220px);gap:6px;flex-direction:column;z-index:7';
	function button(name, text, fn) {
		const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.title = name; b.setAttribute('aria-label', name);
		b.style.cssText = 'width:48px;min-height:48px;border:1px solid #b7cbd080;border-radius:12px;color:#fff;background:#102129ce;padding:0;font:600 10px var(--bard-display,system-ui,sans-serif);touch-action:none';
		b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
		b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true }); dock.append(b); return b;
	}
	const lock = button('Lock on (the ` key, or tap a person or a vehicle); press again to release', 'Lock', () => lockOn());
	const next = button('Next target (Shift+L)', 'Next', () => cycle());
	const style = document.createElement('style'); style.textContent = '@media (orientation:landscape) and (max-height:540px){.combat-focus-controls{top:calc(110px + var(--l99-top, env(safe-area-inset-top)))!important;flex-direction:row!important}}';
	mount.append(marker, dock, style);
	const clear = () => { selected = null; track = null; seen = false; hiddenFor = 0; available = false; candidates = []; dock.style.display = 'none'; marker.style.display = 'none'; lock.textContent = 'Lock'; lock.setAttribute('aria-pressed', 'false'); };
	function scan() {
		camera.getWorldDirection(direction);
		candidates = [];
		for (const T of layer.map.values()) {
			const score = focusScore(T, camera.position, direction, { hostile: hostile(T), shooter, rules });
			if (Number.isFinite(score)) candidates.push({ T, score });
		}
		candidates.sort((a, b) => a.score - b.score);
		// Bounded line-of-sight work. A hidden target never gets a marker.
		candidates = candidates.slice(0, 8).filter(({ T }) => !blocked(camera.position, T.bound));
		available = candidates.length > 0;
	}
	function select(T, tracking = false) {
		selected = T; hiddenFor = 0; seen = true; lock.textContent = 'Unlock'; lock.setAttribute('aria-pressed', 'true');
		track = tracking ? { offY: 0, offP: 0, recY: 0, recP: 0, lastY: null, lastP: null, slip: 0, acq: 0, fresh: true } : null;
	}
	// locked on: tracked (the view follows them); pressed again, let go
	function lockOn() {
		if (!active()) return false;
		if (selected && track) { clear(); return true; }
		if (selected) { select(selected, true); return true; }
		scan(); if (candidates[0]) { select(candidates[0].T, true); return true; }
		hint('Face someone nearby, or a vehicle, with a clear line of sight to lock on.', 1800, 1); return false;
	}
	function toggle() {
		if (!active()) return false;
		if (selected) { clear(); return true; }
		scan(); if (candidates[0]) { select(candidates[0].T); return true; }
		hint('Face a nearby target with a clear line of sight.', 1800, 1); return false;
	}
	// the next target round the view (d = -1: the previous one); a lock-on stays a lock-on
	function cycle(d = 1) {
		if (!active()) return false;
		scan(); if (!candidates.length) { clear(); return false; }
		const n = candidates.length, i = candidates.findIndex(({ T }) => T === selected);
		select(candidates[((i < 0 ? (d < 0 ? 0 : -1) : i) + Math.sign(d) + n) % n].T, !!track); return true;
	}
	function key(e) {
		if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !active()) return;
		if (e.code === 'Backquote' || e.key === '`') { e.preventDefault(); e.shiftKey ? cycle() : lockOn(); return; }
		if (e.key.toLowerCase() !== 'l') return;
		e.preventDefault(); e.shiftKey ? cycle() : toggle();
	}
	// a tap on a person (touch): locked on to them. A tap is a short touch that barely moves,
	// outside the joystick's corner (player.js: the left 42% below the top 35%)
	const taps = new Map();
	// the game's own view: a canvas filling most of the screen (the HUD has small canvases of its own)
	const isView = (el) => el?.tagName === 'CANVAS' && el.clientWidth >= innerWidth * 0.5 && el.clientHeight >= innerHeight * 0.5;
	let view = null;
	const toPx = (q) => { point.set(q.x, q.y, q.z).project(camera); const r = (view || mount).getBoundingClientRect(); return { x: r.left + (point.x + 1) / 2 * r.width, y: r.top + (1 - point.y) / 2 * r.height, z: point.z }; };
	let tapWhy = null;          // (what the last tap did, for the tests)
	function tapDown(e) {
		if (e.pointerType !== 'touch' || !isView(e.target)) { if (e.pointerType === 'touch') tapWhy = 'not the view: ' + e.target?.tagName; return; }
		const r = e.target.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
		if (x < 0.42 && y > 0.35) { tapWhy = 'joystick'; return; }
		taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, far: false, el: e.target });
	}
	function tapMove(e) { const q = taps.get(e.pointerId); if (q && Math.hypot(e.clientX - q.x, e.clientY - q.y) > 12) q.far = true; }
	function tapUp(e) {
		const q = taps.get(e.pointerId); taps.delete(e.pointerId);
		// (timed by the events themselves: a slow frame between them is not a long press)
		if (!q || q.far || e.timeStamp - q.t > 320 || !active()) { if (e.pointerType === 'touch') tapWhy = !q ? 'no down' : q.far ? 'moved' : !active() ? 'inactive' : 'long ' + Math.round(e.timeStamp - q.t); return; }
		const list = [...layer.map.values()].filter((T) => Number.isFinite(focusScore(T, camera.position, { x: 0, y: 0, z: 0 }, { hostile: true, max: 65, shooter, rules, dotMin: -2 })));
		camera.updateMatrixWorld(); view = q.el;
		const T = pickAt(list, q.x, q.y, toPx, 44);          // (a fingertip: 44 px either side at the least)
		if (!T || blocked(camera.position, T.bound)) { tapWhy = !T ? `nobody (${list.length} near)` : 'blocked'; return; }
		tapWhy = 'locked';
		if (selected === T && track) return;
		select(T, true);
	}
	function pointer(e) { if (e.button === 1 && e.pointerType === 'mouse' && isView(e.target) && active()) { e.preventDefault(); toggle(); } }
	addEventListener('keydown', key); addEventListener('pointerdown', pointer); addEventListener('blur', clear);
	addEventListener('pointerdown', tapDown, true); addEventListener('pointermove', tapMove, true); addEventListener('pointerup', tapUp, true); addEventListener('pointercancel', (e) => taps.delete(e.pointerId), true);
	return {
		toggle, cycle, clear, lockOn,
		// locked on (the view held on them), not just marked
		locked: () => !!(selected && track),
		// recoil you fired with while locked on (it settles back by itself)
		kick(dp, dy) { if (track) { kickP += dp; kickY += dy; } },
		// player.js, each frame before the view is set: the view held on a locked target
		assist(p, dt) {
			const T = selected;
			if (!track || !T || !p || !seen && hiddenFor > 0.3) { kickY = kickP = 0; return false; }
			const want = aimAngles(p.pos || camera.position, chest(T));
			if (track.fresh) {
				// (aimed somewhere on them already: that spot is kept; otherwise to the chest)
				track.fresh = false;
				const oy = wrapA(p.yaw - want.yaw), op = p.pitch - want.pitch, d = Math.max(1.5, want.d);
				if (Math.abs(oy) < Math.atan(LOCK_WINDOW.side / d) && op < Math.atan(LOCK_WINDOW.up / d) && op > -Math.atan(LOCK_WINDOW.down / d)) { track.offY = oy; track.offP = op; track.acq = 1; }
			}
			const ok = trackStep(track, p, want, dt, kickY, kickP);
			kickY = kickP = 0;
			if (!ok) { clear(); hint('Lock released.', 900, 1); }
			return ok;
		},
		tracking: () => !!(track && selected),
		current: () => seen ? selected : null,
		update(dt) {
			if (!active()) { clear(); dock.style.display = 'none'; timer = 0; return; }
			timer -= dt;
			if (timer <= 0) {
				timer = 0.15; scan();
				if (selected) {
					const T = selected, d = Math.hypot(T.bound.x - camera.position.x, T.bound.y - camera.position.y, T.bound.z - camera.position.z);
					if (layer.get(T.id) !== T || !canHit(T, shooter, rules) || T.P?.ragdoll || T.ref?.dead || T.ref?.gone || T.health?.hp <= 0 || d > focusReach(T, 65)) clear();
					else seen = !blocked(camera.position, T.bound);
				}
			}
			dock.style.display = available || selected ? 'flex' : 'none'; next.style.display = selected && candidates.length > 1 ? '' : 'none';
			if (!selected) return;
			hiddenFor = seen ? 0 : hiddenFor + dt;
			if (!seen) { marker.style.display = 'none'; if (hiddenFor > 0.6) clear(); return; }
			camera.updateMatrixWorld(); point.set(selected.bound.x, selected.bound.y + (isVehicle(selected) ? 0 : 0.5), selected.bound.z).project(camera);
			const behind = point.z > 1;
			let x = point.x, y = point.y;
			if (behind) { x = -x; y = -y; }
			const edge = behind || Math.abs(x) > 0.85 || Math.abs(y) > 0.8;
			const k = Math.max(1, Math.abs(x) / 0.85, Math.abs(y) / 0.8); x /= k; y /= k;
			marker.style.display = 'block'; marker.style.left = `${(x + 1) * 50}%`; marker.style.top = `${(1 - y) * 50}%`;
			const mode = edge ? 'edge' : 'reticle';
			if (glyph.dataset.mode !== mode) { glyph.dataset.mode = mode; glyph.innerHTML = edge ? arrow : reticle; }
			glyph.style.transform = edge ? `rotate(${Math.atan2(-y, x) * 180 / Math.PI}deg)` : '';
			label.parentElement.style.transform = `translateX(${x > 0.6 ? '-100%' : x < -0.6 ? '0' : '-50%'})`;
			const distance = Math.round(camera.position.distanceTo(selected.bound));
			const text = `${track ? 'Locked · ' : ''}${selected.name || 'Target'} · ${distance} m`;
			marker.style.color = track ? '#ff9a7a' : '#ffe4a0';
			if (label.textContent !== text) label.textContent = text;
			const lk = lifeOf(selected), ld = lk == null ? 'none' : 'block';
			if (life.style.display !== ld) life.style.display = ld;
			if (lk != null) {
				const sx = `scaleX(${lk.toFixed(3)})`, lc = lk < 0.3 ? '#ff6a4a' : '#4fe0a8';
				if (lifeFill.style.transform !== sx) lifeFill.style.transform = sx;
				if (lifeFill.style.background !== lc) lifeFill.style.background = lc;
			}
		},
		info: () => ({ id: selected?.id || null, visible: seen, candidates: candidates.length, cameraAssist: !!track, tap: tapWhy, offset: track ? { yaw: +track.offY.toFixed(4), pitch: +track.offP.toFixed(4) } : null, life: selected ? lifeOf(selected) : null }),
		dispose() { clear(); marker.remove(); dock.remove(); style.remove(); removeEventListener('keydown', key); removeEventListener('pointerdown', pointer); removeEventListener('blur', clear); removeEventListener('pointerdown', tapDown, true); removeEventListener('pointermove', tapMove, true); removeEventListener('pointerup', tapUp, true); },
	};
}
