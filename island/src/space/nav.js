// Space navigation: labelled markers on the bodies around the ship, and the warp
// list. Markers are DOM labels projected from fixed world positions, so they move
// across the screen as the ship turns. Tapping a marker targets it for a warp.
import * as THREE from 'three';

export function distanceLabel(m) {
	if (m < 1e4) return `${Math.round(m).toLocaleString()} m`;
	if (m < 1e7) return `${Math.round(m / 1000).toLocaleString()} km`;
	if (m < 1.5e10) return `${(m / 1e9).toFixed(m < 1e9 ? 2 : 1)} M km`;
	return `${(m / 1.496e11).toFixed(2)} AU`;
}
export function speedReadout(v) {
	if (v < 1e4) return `${Math.round(v).toLocaleString()} m/s`;
	const c = v / 299792458;
	return `${Math.round(v / 1000).toLocaleString()} km/s${c >= .01 ? ` · ${c < 10 ? c.toFixed(2) : Math.round(c).toLocaleString()} c` : ''}`;
}

const MARK = 'position:absolute;display:none;transform:translate(-50%,-50%);color:#a5f6e2;font:12px system-ui;text-align:center;white-space:pre;text-shadow:0 1px 5px #000;cursor:pointer;pointer-events:auto;padding:4px 6px;';
const PANEL = 'position:absolute;right:calc(12px + env(safe-area-inset-right));top:calc(112px + env(safe-area-inset-top));max-height:calc(100% - 140px);overflow:auto;display:none;min-width:220px;background:rgba(6,16,22,.86);border:1px solid rgba(165,246,226,.35);border-radius:10px;padding:8px;color:#eafaf6;font:13px system-ui;pointer-events:auto;';

export function createNav({ mount, isTouch, onWarp, onTarget }) {
	const marks = new Map(), local = new THREE.Vector3(), projected = new THREE.Vector3();
	let target = null, open = false, list = [], pick = 0;
	const button = document.createElement('button');
	button.style.cssText = 'position:absolute;right:calc(12px + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));display:none;padding:9px 13px;border-radius:22px;border:1px solid rgba(165,246,226,.5);background:rgba(8,20,26,.7);color:#eafaf6;font:600 13px system-ui;pointer-events:auto;';
	button.textContent = isTouch ? '⤳ Warp' : '⤳ Warp (J)';
	button.title = 'Warp to a planet, moon, the Sun or the black hole (J)';
	const panel = document.createElement('div');
	panel.style.cssText = PANEL;
	panel.dataset.warpPanel = '';
	mount.append(button, panel);
	for (const el of [button, panel]) for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation());
	button.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
	function mark(id) {
		let el = marks.get(id);
		if (!el) {
			el = document.createElement('div'); el.style.cssText = MARK; el.dataset.navMark = id;
			el.addEventListener('pointerdown', (e) => { e.stopPropagation(); target = id; onTarget?.(id); });
			mount.append(el); marks.set(id, el);
		}
		return el;
	}
	// items: [{ id, name, pos (world metres), distance }]
	function update(camera, items, show) {
		const seen = new Set();
		for (const it of items) {
			const el = mark(it.id); seen.add(it.id);
			if (!show) { el.style.display = 'none'; continue; }
			local.copy(it.pos).sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
			const behind = local.z > 0;
			projected.copy(it.pos).project(camera);
			const on = !behind && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1;
			const selected = it.id === target;
			if (!on && !selected) { el.style.display = 'none'; continue; }
			let x = projected.x * .5 + .5, y = .5 - projected.y * .5, arrow = '◇';
			if (!on) {
				// the selected target stays on the screen's edge, pointing the way to turn
				const a = Math.atan2(-local.y, local.x);
				x = .5 + Math.cos(a) * .44; y = .5 + Math.sin(a) * .4;
				arrow = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? '→' : '←') : (Math.sin(a) > 0 ? '↓' : '↑');
			}
			el.style.display = 'block';
			el.style.left = `${Math.min(.94, Math.max(.06, x)) * 100}%`; el.style.top = `${Math.min(.9, Math.max(.1, y)) * 100}%`;
			el.style.color = selected ? '#ffe9a8' : '#a5f6e2';
			const text = `${arrow}\n${it.name}\n${distanceLabel(it.distance)}`;
			if (el.textContent !== text) el.textContent = text;
		}
		for (const [id, el] of marks) if (!seen.has(id)) el.style.display = 'none';
	}
	function render() {
		panel.textContent = '';
		const head = document.createElement('div');
		head.style.cssText = 'font-weight:600;letter-spacing:.08em;margin:2px 4px 6px;color:#a5f6e2;';
		head.textContent = isTouch ? 'WARP TO' : 'WARP TO · 1–9, ↑↓ Enter, Esc';
		panel.append(head);
		list.forEach((d, i) => {
			const row = document.createElement('button');
			row.style.cssText = `display:flex;justify-content:space-between;gap:12px;width:100%;padding:7px 8px;margin:1px 0;border:0;border-radius:6px;font:13px system-ui;text-align:left;cursor:pointer;color:#eafaf6;background:${i === pick ? 'rgba(1,169,130,.55)' : 'transparent'};`;
			const n = document.createElement('span'); n.textContent = `${i < 9 ? `${i + 1}. ` : i === 9 ? '0. ' : ''}${d.name}`;
			const s = document.createElement('span'); s.style.opacity = '.7'; s.textContent = d.note;
			row.append(n, s);
			row.addEventListener('click', (e) => { e.stopPropagation(); engage(i); });
			panel.append(row);
		});
	}
	function toggle(entries) {
		open = !open;
		if (open) {
			list = entries || onWarp('list') || [];
			pick = Math.max(0, list.findIndex((d) => d.id === target));
			render();
		}
		panel.style.display = open ? 'block' : 'none';
	}
	function engage(i) {
		const d = list[i]; if (!d) return;
		open = false; panel.style.display = 'none';
		target = d.id; onWarp('go', d);
	}
	function key(e) {
		if (!open) return false;
		const k = e.key;
		if (k === 'Escape') { toggle(); return true; }
		if (k === 'ArrowDown' || k === 'ArrowUp') { pick = (pick + (k === 'ArrowDown' ? 1 : list.length - 1)) % list.length; render(); return true; }
		if (k === 'Enter') { engage(pick); return true; }
		if (/^[0-9]$/.test(k)) { engage(k === '0' ? 9 : +k - 1); return true; }
		return false;
	}
	return {
		update, toggle, key, engage,
		get open() { return open; },
		get target() { return target; },
		set target(id) { target = id; },
		showButton(on) { const d = on ? 'block' : 'none'; if (button.style.display !== d) button.style.display = d; if (!on && open) toggle(); },
		dispose() { button.remove(); panel.remove(); for (const el of marks.values()) el.remove(); marks.clear(); },
	};
}
