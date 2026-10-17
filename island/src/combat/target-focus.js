import { canHit } from './targets.js';

// A deliberate target selection. No camera steering, bullet magnetism or extra reach.
export function focusScore(T, eye, forward, { hostile = false, max = 55, shooter, rules } = {}) {
	if (!T?.bound || !['person', 'hostile', 'remote'].includes(T.kind) || !canHit(T, shooter, rules) || T.P?.ragdoll || T.ref?.dead || T.ref?.gone || T.health?.hp <= 0) return Infinity;
	const dx = T.bound.x - eye.x, dy = T.bound.y - eye.y, dz = T.bound.z - eye.z;
	const d = Math.hypot(dx, dy, dz), dot = (dx * forward.x + dy * forward.y + dz * forward.z) / (d || 1);
	if (d > max || dot < (hostile ? 0.3 : 0.965)) return Infinity;
	return (1 - dot) * 30 + d * 0.12 + (hostile ? 0 : 25);
}
export function createTargetFocus({ layer, camera, mount, active, blocked, hostile, shooter, rules, vector, hint = () => {} }) {
	let selected = null, timer = 0, hiddenFor = 0, seen = false, candidates = [], available = false;
	const direction = vector(), point = vector();
	const marker = document.createElement('div'); marker.className = 'combat-focus-marker'; marker.setAttribute('aria-hidden', 'true');
	marker.style.cssText = 'display:none;position:absolute;pointer-events:none;z-index:6;color:#ffe4a0;font:600 12px system-ui;text-shadow:0 1px 3px #000;transform:translate(-50%,-50%);text-align:center;white-space:nowrap';
	const reticle = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H3v6M19 3h6v6M3 19v6h6M25 19v6h-6"/><circle cx="14" cy="14" r="3"/></svg>';
	const arrow = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 5 9 9-9 9"/></svg>';
	marker.innerHTML = '<span style="display:block;width:28px;height:28px"></span><span style="position:absolute;top:32px;left:50%;width:max-content;max-width:160px;overflow:hidden;text-overflow:ellipsis"></span>';
	const label = marker.lastElementChild, glyph = marker.firstElementChild;
	const dock = document.createElement('div'); dock.className = 'combat-focus-controls';
	dock.style.cssText = 'display:none;position:absolute;right:calc(12px + env(safe-area-inset-right));top:clamp(110px,32%,220px);gap:6px;flex-direction:column;z-index:7';
	function button(name, text, fn) {
		const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.title = name; b.setAttribute('aria-label', name);
		b.style.cssText = 'width:48px;min-height:48px;border:1px solid #b7cbd080;border-radius:12px;color:#fff;background:#102129ce;padding:0;font:600 10px system-ui;touch-action:none';
		b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
		b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true }); dock.append(b); return b;
	}
	const lock = button('Lock target (L or middle mouse); press again to release', 'Lock', () => toggle());
	const next = button('Next target (Shift+L)', 'Next', () => cycle());
	const style = document.createElement('style'); style.textContent = '@media (orientation:landscape) and (max-height:540px){.combat-focus-controls{top:calc(110px + env(safe-area-inset-top))!important;flex-direction:row!important}}';
	mount.append(marker, dock, style);
	const clear = () => { selected = null; seen = false; hiddenFor = 0; available = false; candidates = []; dock.style.display = 'none'; marker.style.display = 'none'; lock.textContent = 'Lock'; lock.setAttribute('aria-pressed', 'false'); };
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
	function select(T) { selected = T; hiddenFor = 0; seen = true; lock.textContent = 'Unlock'; lock.setAttribute('aria-pressed', 'true'); }
	function toggle() {
		if (!active()) return false;
		if (selected) { clear(); return true; }
		scan(); if (candidates[0]) { select(candidates[0].T); return true; }
		hint('Face a nearby target with a clear line of sight.', 1800, 1); return false;
	}
	function cycle() {
		if (!active()) return false;
		scan(); if (!candidates.length) { clear(); return false; }
		const i = candidates.findIndex(({ T }) => T === selected); select(candidates[(i + 1) % candidates.length].T); return true;
	}
	function key(e) { if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'l' || !active()) return; e.preventDefault(); e.shiftKey ? cycle() : toggle(); }
	function pointer(e) { if (e.button === 1 && e.pointerType === 'mouse' && e.target === mount.querySelector('canvas') && active()) { e.preventDefault(); toggle(); } }
	addEventListener('keydown', key); addEventListener('pointerdown', pointer); addEventListener('blur', clear);
	return {
		toggle, cycle, clear,
		current: () => seen ? selected : null,
		update(dt) {
			if (!active()) { clear(); dock.style.display = 'none'; timer = 0; return; }
			timer -= dt;
			if (timer <= 0) {
				timer = 0.15; scan();
				if (selected) {
					const T = selected, d = Math.hypot(T.bound.x - camera.position.x, T.bound.y - camera.position.y, T.bound.z - camera.position.z);
					if (layer.get(T.id) !== T || !canHit(T, shooter, rules) || T.P?.ragdoll || T.ref?.dead || T.ref?.gone || T.health?.hp <= 0 || d > 65) clear();
					else seen = !blocked(camera.position, T.bound);
				}
			}
			dock.style.display = available || selected ? 'flex' : 'none'; next.style.display = selected && candidates.length > 1 ? '' : 'none';
			if (!selected) return;
			hiddenFor = seen ? 0 : hiddenFor + dt;
			if (!seen) { marker.style.display = 'none'; if (hiddenFor > 0.6) clear(); return; }
			camera.updateMatrixWorld(); point.set(selected.bound.x, selected.bound.y + 0.5, selected.bound.z).project(camera);
			const behind = point.z > 1;
			let x = point.x, y = point.y;
			if (behind) { x = -x; y = -y; }
			const edge = behind || Math.abs(x) > 0.85 || Math.abs(y) > 0.8;
			const k = Math.max(1, Math.abs(x) / 0.85, Math.abs(y) / 0.8); x /= k; y /= k;
			marker.style.display = 'block'; marker.style.left = `${(x + 1) * 50}%`; marker.style.top = `${(1 - y) * 50}%`;
			const mode = edge ? 'edge' : 'reticle';
			if (glyph.dataset.mode !== mode) { glyph.dataset.mode = mode; glyph.innerHTML = edge ? arrow : reticle; }
			glyph.style.transform = edge ? `rotate(${Math.atan2(-y, x) * 180 / Math.PI}deg)` : '';
			label.style.transform = `translateX(${x > 0.6 ? '-100%' : x < -0.6 ? '0' : '-50%'})`;
			const distance = Math.round(camera.position.distanceTo(selected.bound));
			const text = `${selected.name || 'Target'} · ${distance} m`;
			if (label.textContent !== text) label.textContent = text;
		},
		info: () => ({ id: selected?.id || null, visible: seen, candidates: candidates.length, cameraAssist: false }),
		dispose() { clear(); marker.remove(); dock.remove(); style.remove(); removeEventListener('keydown', key); removeEventListener('pointerdown', pointer); removeEventListener('blur', clear); },
	};
}
