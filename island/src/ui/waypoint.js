// The way to the next thing you agreed to do: a pin standing at the place, visible from
// afar, and a chip at the top of the screen with an arrow, the distance and the time left.
// The guide decides what is marked; this only draws it.
import * as THREE from 'three';

export function createWaypoint({ scene, camera, mount, onTap = () => {} }) {
	// ---------- the pin: a soft beam of light with a turning diamond on top ----------
	const pin = new THREE.Group(); pin.name = 'waypoint'; pin.visible = false;
	const beamMat = new THREE.MeshBasicMaterial({ color: 0x01a982, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
	const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 1, 12, 1, true), beamMat);
	const gemMat = new THREE.MeshBasicMaterial({ color: 0x5ff0c6, transparent: true, opacity: 0.95, fog: false });
	const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), gemMat);
	const ringMat = new THREE.MeshBasicMaterial({ color: 0x01a982, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false });
	const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), ringMat); ring.rotation.x = -Math.PI / 2;
	beam.renderOrder = gem.renderOrder = ring.renderOrder = 5;
	pin.add(beam, gem, ring); scene.add(pin);

	// ---------- the chip ----------
	const chip = document.createElement('button');
	chip.type = 'button';
	chip.style.cssText = 'position:absolute;left:50%;top:calc(86px + env(safe-area-inset-top));transform:translateX(-50%);display:none;align-items:center;gap:10px;max-width:min(440px,calc(100vw - 32px));min-height:44px;padding:6px 14px 6px 8px;border-radius:22px;border:1px solid rgba(1,169,130,.55);background:rgba(10,14,18,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#f2f5f4;font:600 13px/1.25 system-ui;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);text-align:left;';
	const arrow = document.createElement('span');
	arrow.style.cssText = 'flex-shrink:0;width:30px;height:30px;border-radius:50%;background:rgba(1,169,130,.22);display:flex;align-items:center;justify-content:center;transition:transform .15s linear;';
	arrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#5ff0c6" aria-hidden="true"><path d="M12 2 20 21l-8-4.5L4 21z"/></svg>';
	const text = document.createElement('span');
	text.style.cssText = 'min-width:0;display:flex;flex-direction:column;overflow:hidden;';
	const line1 = document.createElement('span'), line2 = document.createElement('span');
	line1.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
	line2.style.cssText = 'font:500 11.5px/1.25 system-ui;color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
	text.append(line1, line2); chip.append(arrow, text); mount.append(chip);
	for (const ev of ['pointerdown', 'touchstart']) chip.addEventListener(ev, e => e.stopPropagation());
	chip.onclick = () => onTap(current);

	let current = null, last = '';
	const dir = new THREE.Vector3();
	function fmt(d) { return d < 1000 ? `${Math.round(d / 5) * 5} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`; }
	/**
	 * Mark a place, or clear the mark with null.
	 * @param {{ x:number, y:number, z:number, title:string, detail?:string, radius?:number } | null} mark
	 */
	function set(mark) { current = mark && [mark.x, mark.z].every(Number.isFinite) ? mark : null; }
	function update(dt, time, enabled = true) {
		const m = current, on = !!m && enabled;
		pin.visible = on;
		const show = on ? 'flex' : 'none';
		if (chip.style.display !== show) chip.style.display = show;
		if (!on) return;
		const cam = camera.position, dx = m.x - cam.x, dz = m.z - cam.z, d = Math.hypot(dx, dz);
		const y = Number.isFinite(m.y) ? m.y : 0;
		// Taller and wider with distance, so it reads from across a valley; gone when you are on it.
		const k = Math.max(1, Math.min(40, d / 60)), h = Math.min(260, 18 + d * 0.12);
		pin.position.set(m.x, y, m.z);
		beam.scale.set(k * 0.6, h, k * 0.6); beam.position.y = h / 2;
		gem.scale.setScalar(k * 0.8); gem.position.y = h + k * 1.2 + Math.sin(time * 2) * 0.3 * k; gem.rotation.y = time * 1.4;
		ring.scale.setScalar(m.radius || 10); ring.position.y = 0.15;
		beamMat.opacity = d < (m.radius || 10) ? 0.1 : 0.32;
		// The arrow points where the place is, relative to where you are looking.
		camera.getWorldDirection(dir);
		const rel = Math.atan2(dx, -dz) - Math.atan2(dir.x, -dir.z);
		arrow.style.transform = `rotate(${rel}rad)`;
		const words = `${m.title}|${m.detail || ''}|${fmt(d)}`;
		if (words !== last) { last = words; line1.textContent = m.title; line2.textContent = `${fmt(d)}${m.detail ? ' · ' + m.detail : ''}`; chip.setAttribute('aria-label', `${m.title}, ${fmt(d)} away. ${m.detail || ''}. Open Quests.`); }
	}
	function dispose() { pin.removeFromParent(); for (const o of [beam, gem, ring]) { o.geometry.dispose(); o.material.dispose(); } chip.remove(); }
	return { set, update, dispose, mark: () => current, info: () => ({ visible: pin.visible, chip: chip.style.display, title: line1.textContent, detail: line2.textContent }) };
}
