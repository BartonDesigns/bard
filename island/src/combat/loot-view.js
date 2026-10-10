import * as THREE from 'three';
import { itemModel } from '../crysis/held-items.js';
import { armamentVariant } from '../gameplay/armament-variants.js';
import { TIERS } from '../gameplay/gear-levels.js';
import { weaponStats, WEAPONS } from './weapons.js';
import { createLoot } from './loot.js';

export function createLootView({ group, mount, arms, camera, eye, blocked, ground, active, hint, sound, touch = false }) {
	const loot = createLoot({ max: touch ? 16 : 32, apply: (tx) => arms.apply(tx), visible: (a, b) => !blocked(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)) });
	const visuals = new Map(), forward = new THREE.Vector3(), viewer = new THREE.Vector3();
	const panel = document.createElement('div');
	panel.dataset.fieldRecovery = '';
	panel.style.cssText = 'display:none;position:absolute;left:50%;bottom:calc(var(--l99-low,88px) + env(safe-area-inset-bottom) + 20px);transform:translateX(-50%);width:min(360px,calc(100% - 32px));box-sizing:border-box;padding:12px 14px;background:rgba(12,20,25,.96);border:1px solid #617680;border-radius:12px;color:#edf5f6;font:13px/1.45 system-ui;z-index:6;box-shadow:0 8px 28px #0008;pointer-events:auto;';
	panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Recover equipment');
	const source = document.createElement('div'), title = document.createElement('strong'), stats = document.createElement('div'), buttons = document.createElement('div');
	source.style.cssText = 'font-size:11px;color:#a8b9c2';
	title.style.cssText = 'display:block;font-size:15px;margin:3px 0';
	stats.style.cssText = 'font-size:12px;margin-bottom:10px;white-space:pre-line';
	buttons.style.cssText = 'display:flex;gap:8px';
	const button = (label, equip) => {
		const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
		b.style.cssText = 'flex:1;min-height:44px;border:1px solid #76929a;border-radius:7px;background:#263c44;color:#fff;font:600 13px system-ui;cursor:pointer;touch-action:manipulation;';
		b.onclick = () => collect(equip); buttons.append(b); return b;
	};
	button(touch ? 'Take' : '[E] Take', false); button(touch ? 'Take & equip' : '[Shift+E] Equip', true);
	panel.append(source, title, stats, buttons); mount.append(panel);
	for (const event of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']) panel.addEventListener(event, (e) => e.stopPropagation());
	let selected = null, signature = '', clock = 0;
	function remove(id) {
		const v = visuals.get(id); if (!v) return;
		v.model.userData.bow?.dispose(); v.root.removeFromParent();
		// Item geometry and materials belong to the shared held-model cache.
		v.marker.geometry.dispose(); v.marker.material.dispose(); visuals.delete(id);
	}
	function add(h) {
		const drop = loot.add(h); if (!drop) return;
		const x = drop.items[0], model = itemModel(x.i, { level: x.l, tier: x.t, lod: 'high' });
		const root = new THREE.Group(); root.name = 'recovered:' + drop.id;
		// Rest the actual weapon on its side, clear of the terrain; no floating loot cube.
		model.rotation.x = Math.PI / 2; model.rotation.y = drop.yaw;
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		model.position.y = 0.04 - box.min.y;
		const floor = ground(drop.pos.x, drop.pos.z, drop.pos.y + 1);
		root.position.set(drop.pos.x, floor, drop.pos.z); drop.pos.y = floor + 0.25;
		root.add(model);
		const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.28, 48), new THREE.MeshBasicMaterial({ color: TIERS[x.t].color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
		marker.rotation.x = -Math.PI / 2; marker.position.y = 0.025; root.add(marker); group.add(root);
		visuals.set(drop.id, { root, model, marker });
		if (Math.hypot(drop.pos.x - eye().x, drop.pos.z - eye().z) < 20) hint('Equipment recoverable. Approach the fallen fighter and look toward their weapon.', 3200, 1);
	}
	function collect(equip = false) {
		if (!active()) return false;
		// Re-evaluate range, facing and walls at click time, including between render frames.
		camera.getWorldDirection(forward);
		const current = loot.nearest(eye(), forward);
		if (!current || current.id !== selected?.id) return false;
		const out = loot.take(current.id, eye());
		if (!out.ok) { hint(out.message, 2800, 1); return true; }
		remove(current.id); selected = null; panel.style.display = 'none'; signature = '';
		let held = false;
		if (equip) held = !!arms.hold(out.weapon.u)?.ok;
		hint(`${WEAPONS[out.weapon.i].name} + ammunition recovered.${held ? ' Equipped.' : ' Saved in Gear (I).'}${equip && !held ? ' Open Gear to equip.' : ''}`, 3000, 1);
		sound('chime'); return true;
	}
	const onKey = (e) => {
		if (e.key.toLowerCase() !== 'e' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target?.closest?.('input,textarea,select,[contenteditable]')) return;
		if (collect(e.shiftKey)) { e.preventDefault(); e.stopImmediatePropagation(); }
	};
	// A visible recovery prompt owns E before doors, cars and other nearby interactions.
	addEventListener('keydown', onKey, true);
	function update(dt) {
		clock += dt; loot.update(dt, eye());
		viewer.copy(eye());
		for (const [id, v] of visuals) {
			if (!loot.drops.has(id)) { remove(id); continue; }
			const d = v.root.position.distanceTo(viewer);
			v.root.visible = d < 70; v.model.visible = d < 35;
			v.marker.material.opacity = 0.42 + Math.sin(clock * 2) * 0.12;
		}
		camera.getWorldDirection(forward);
		selected = active() ? loot.nearest(eye(), forward) : null;
		panel.style.display = selected ? 'block' : 'none';
		if (!selected) { signature = ''; return; }
		const x = selected.items[0], held = arms.held?.(), key = `${selected.id}:${held?.u}:${held?.l}:${held?.t}`;
		if (key === signature) return; signature = key;
		const s = weaponStats(x), old = held && weaponStats(held), rank = TIERS[x.t], variant = armamentVariant(x.i, x.t);
		source.textContent = `${selected.name} · field recovery`;
		title.textContent = `${variant?.name || ''} ${s.name} · ${rank.name}`; title.style.color = rank.color; panel.style.borderColor = rank.color;
		const delta = old ? Math.round((s.dmg - old.dmg) * 10) / 10 : null;
		stats.textContent = `Level ${x.l} · Damage ${s.dmg} · Range ${s.range} · Magazine ${s.mag}\n${WEAPONS[x.i].perBox} reserve ${x.i === 'reedline-hunting-bow' ? 'arrows' : 'rounds'} included${delta !== null ? ` · Damage ${delta >= 0 ? '+' : ''}${delta} vs held` : ''}\nTake keeps your current weapon. Equip keeps it in your bag.`;
	}
	function clear() { loot.clear(); for (const id of [...visuals.keys()]) remove(id); selected = null; signature = ''; panel.style.display = 'none'; }
	return { add, update, clear, collect, info: () => ({ count: loot.drops.size, selected: selected?.id || null, drops: [...loot.drops.values()].map((d) => ({ id: d.id, pos: d.pos, weapon: d.items[0] })) }) };
}
