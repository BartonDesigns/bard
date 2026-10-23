// The way to the next thing you agreed to do: a pin standing at the place, visible from
// afar, a marker on the screen over it (held at the screen's edge, pointing, while the place is
// out of view), a chip at the top of the screen with an arrow, the distance and the time left,
// and the wayfinder: a trail of chevrons on the ground from your feet toward the place.
// The guide decides what is marked; this only draws it. The pin and marker (waypoint) and the
// trail (wayfinder) can each be turned off; with both off nothing is drawn.
import * as THREE from 'three';

export function createWaypoint({ scene, camera, mount, onTap = () => {}, top = 86, groundAt = null, wayfinder = false }) {
	let opts = { waypoint: true, wayfinder: !!groundAt && wayfinder };
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

	// ---------- the wayfinder: chevrons flowing along the ground toward the place ----------
	const TRAIL = 16, STEP = 4.5, FIRST = 3;
	const chev = new THREE.Shape([[0, 0.45], [0.7, -0.25], [0.7, -0.57], [0, 0.13], [-0.7, -0.57], [-0.7, -0.25]].map(([x, y]) => new THREE.Vector2(x, y)));
	const chevGeo = new THREE.ShapeGeometry(chev); chevGeo.rotateX(-Math.PI / 2);	// lying flat, pointing -z
	// (plain blending, not added light: the same teal over bright sand as over dark grass; each
	// chevron grows in and shrinks out at the trail's ends instead of fading)
	const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false });
	const trail = new THREE.InstancedMesh(chevGeo, trailMat, TRAIL);
	trail.name = 'wayfinder'; trail.visible = false; trail.frustumCulled = false; trail.renderOrder = 5;
	trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	trail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TRAIL * 3), 3).setUsage(THREE.DynamicDrawUsage);
	scene.add(trail);
	const TEAL = new THREE.Color(0x01a982), GLOW = new THREE.Color(0x8ff7dc), tint = new THREE.Color(), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), at = new THREE.Vector3(), size = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

	// ---------- the marker over the place on the screen ----------
	// (not a control: taps go through it to the game)
	const marker = document.createElement('div');
	marker.setAttribute('aria-hidden', 'true');
	marker.style.cssText = 'position:absolute;left:0;top:0;display:none;flex-direction:column;align-items:center;gap:2px;pointer-events:none;will-change:transform;z-index:2;';
	const gemIcon = document.createElement('div');
	gemIcon.style.cssText = 'position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 6px rgba(1,169,130,.85)) drop-shadow(0 1px 2px rgba(0,0,0,.6));';
	gemIcon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 22.5 12 12 22.5 1.5 12z" fill="rgba(10,14,18,.55)" stroke="#5ff0c6" stroke-width="2"/><path d="M12 7 17 12 12 17 7 12z" fill="#5ff0c6"/></svg>';
	const edgeArrow = document.createElement('div');
	edgeArrow.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;display:none;';
	edgeArrow.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" style="position:absolute;left:-7px;top:-27px" aria-hidden="true"><path d="M12 3 21 19H3z" fill="#5ff0c6"/></svg>';
	gemIcon.append(edgeArrow);
	const markLabel = document.createElement('div');
	markLabel.style.cssText = 'padding:1px 7px;border-radius:9px;background:rgba(10,14,18,.62);color:#eafaf6;font:600 11.5px/1.35 var(--bard-display,system-ui,sans-serif);white-space:nowrap;letter-spacing:.02em;text-shadow:0 1px 2px rgba(0,0,0,.6);';
	marker.append(gemIcon, markLabel); mount.append(marker);

	// ---------- the chip ----------
	const chip = document.createElement('button');
	chip.type = 'button';
	// (text to read, not a control: the touch skin leaves it as it is and keeps controls off it)
	chip.dataset.hudText = 'quest';
	chip.style.cssText = 'position:absolute;left:50%;top:calc(86px + var(--l99-top, env(safe-area-inset-top)));transform:translateX(-50%);display:none;align-items:center;gap:10px;max-width:min(440px,calc(100vw - 32px));min-height:44px;padding:6px 14px 6px 8px;border-radius:22px;border:1px solid rgba(1,169,130,.55);background:rgba(10,14,18,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#f2f5f4;font:600 13px/1.25 var(--bard-display,system-ui,sans-serif);cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);text-align:left;';
	chip.style.top = `calc(${top}px + var(--l99-top, env(safe-area-inset-top)))`;
	const arrow = document.createElement('span');
	arrow.style.cssText = 'flex-shrink:0;width:30px;height:30px;border-radius:50%;background:rgba(1,169,130,.22);display:flex;align-items:center;justify-content:center;transition:transform .15s linear;';
	arrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#5ff0c6" aria-hidden="true"><path d="M12 2 20 21l-8-4.5L4 21z"/></svg>';
	const text = document.createElement('span');
	text.style.cssText = 'min-width:0;display:flex;flex-direction:column;overflow:hidden;';
	const line1 = document.createElement('span'), line2 = document.createElement('span');
	line1.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
	line2.style.cssText = 'font:500 11.5px/1.25 var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
	text.append(line1, line2); chip.append(arrow, text);
	// (the chip stays the mount's last child: a room's own pin finds its chip that way, net/multiplayer.js)
	mount.append(chip);
	for (const ev of ['pointerdown', 'touchstart']) chip.addEventListener(ev, e => e.stopPropagation());
	chip.onclick = () => onTap(current);

	let current = null, last = '', lastMark = '', frame = 0, chipBottom = top + 60;
	const dir = new THREE.Vector3(), v = new THREE.Vector3();
	function fmt(d) { return d < 1000 ? `${Math.round(d / 5) * 5} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`; }
	/**
	 * Mark a place, or clear the mark with null.
	 * @param {{ x:number, y:number, z:number, title:string, detail?:string, radius?:number, key?:string } | null} mark
	 */
	function set(mark) { current = mark && [mark.x, mark.z].every(Number.isFinite) ? mark : null; }
	/** @param {{ waypoint?:boolean, wayfinder?:boolean }} next */
	function setOptions(next = {}) {
		opts = { waypoint: next.waypoint ?? opts.waypoint, wayfinder: !!groundAt && (next.wayfinder ?? opts.wayfinder) };
	}
	// where the marker goes: over the place when it is in view, else at the screen's edge on its side
	function placeMarker(m, y, d, rel) {
		const w = mount.clientWidth || innerWidth, h = mount.clientHeight || innerHeight;
		if (frame % 30 === 0) { const r = chip.getBoundingClientRect(), b = mount.getBoundingClientRect(); if (r.height) chipBottom = r.bottom - b.top; }
		const touch = mount.classList.contains('l99-touch');
		// (held clear of the chip, the hotbar, and on a touch screen the thumb columns and stick)
		const left = 40, right = w - (touch ? 100 : 40), topEdge = Math.min(h * 0.4, chipBottom + 30), bottom = h - (touch ? Math.min(200, h * 0.4) : 96);
		v.set(m.x, y + 2.2, m.z).applyMatrix4(camera.matrixWorldInverse);
		const behind = v.z > -0.1;
		v.applyMatrix4(camera.projectionMatrix);
		let sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
		const inView = !behind && sx >= left && sx <= right && sy >= topEdge && sy <= bottom;
		if (!inView) {
			// out of view: on the line from the centre toward the place's bearing, held to the edge
			const cx = w / 2, cy = (topEdge + bottom) / 2;
			let ex = Math.sin(rel), ey = -Math.cos(rel);
			if (!behind) { ex = sx - cx; ey = sy - cy; }
			const k = Math.min(Math.abs(ex) > 1e-6 ? (ex > 0 ? right - cx : cx - left) / Math.abs(ex) : Infinity, Math.abs(ey) > 1e-6 ? (ey > 0 ? bottom - cy : cy - topEdge) / Math.abs(ey) : Infinity);
			sx = cx + ex * k; sy = cy + ey * k;
			edgeArrow.style.display = 'block';
			edgeArrow.style.transform = `rotate(${Math.atan2(ex, -ey)}rad)`;
		} else edgeArrow.style.display = 'none';
		marker.style.transform = `translate(${Math.round(sx)}px,${Math.round(sy)}px) translate(-50%,-13px)`;
		marker.style.opacity = d < (m.radius || 10) ? '0.35' : '1';
		const words = fmt(d);
		if (words !== lastMark) { lastMark = words; markLabel.textContent = words; }
	}
	function placeTrail(m, d, dx, dz, time) {
		const cam = camera.position, ux = dx / d, uz = dz / d;
		const feet = cam.y - 1.7, g0 = groundAt(cam.x, cam.z, feet);
		const wet = cam.y > -0.5;
		// on foot (or swimming) the trail lies on the ground; up in the air it runs level with you
		const aloft = !Number.isFinite(g0) || cam.y - Math.max(g0, wet ? 0 : -Infinity) > 14;
		const end = Math.min(d - Math.max(4, (m.radius || 10) * 0.6), FIRST + TRAIL * STEP);
		if (end <= FIRST) { trail.visible = false; return; }
		const flow = (time * 3.2 / STEP) % 1, yaw = Math.atan2(-ux, -uz), s0 = aloft ? 2.2 : 1.15;
		q.setFromAxisAngle(UP, yaw);
		const yAir = cam.y - 3;
		for (let i = 0; i < TRAIL; i++) {
			const s = FIRST + (i + flow) * STEP;
			const fade = Math.max(0, Math.min(1, (s - FIRST) / STEP, (end - s) / (STEP * 2.5)));
			const x = cam.x + ux * s, z = cam.z + uz * s;
			let y = yAir;
			if (!aloft) { const g = groundAt(x, z, feet); y = (Number.isFinite(g) ? (wet ? Math.max(g, 0) : g) : feet) + 0.28; }
			at.set(x, y, z); size.setScalar(Math.max(0.0001, s0 * fade));
			trail.setMatrixAt(i, mtx.compose(at, q, size));
			// a brighter beat running along the trail, toward the place
			const pulse = Math.max(0, Math.cos((s - FIRST - time * 9) * 0.35)) ** 3;
			trail.setColorAt(i, tint.copy(TEAL).lerp(GLOW, pulse));
		}
		trail.instanceMatrix.needsUpdate = true; trail.instanceColor.needsUpdate = true;
		trail.visible = true;
	}
	function update(dt, time, enabled = true) {
		frame++;
		const m = current, on = !!m && enabled && (opts.waypoint || opts.wayfinder);
		pin.visible = on && opts.waypoint;
		const show = on ? 'flex' : 'none';
		if (chip.style.display !== show) chip.style.display = show;
		const showMark = on && opts.waypoint ? 'flex' : 'none';
		if (marker.style.display !== showMark) marker.style.display = showMark;
		if (!on) { trail.visible = false; return; }
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
		if (opts.waypoint) placeMarker(m, y, d, rel);
		if (opts.wayfinder && d > 1) placeTrail(m, d, dx, dz, time); else trail.visible = false;
		const words = `${m.title}|${m.detail || ''}|${fmt(d)}`;
		if (words !== last) { last = words; line1.textContent = m.title; line2.textContent = `${fmt(d)}${m.detail ? ' · ' + m.detail : ''}`; chip.setAttribute('aria-label', `${m.title}, ${fmt(d)} away. ${m.detail || ''}. Open Quests.`); }
	}
	function dispose() { pin.removeFromParent(); trail.removeFromParent(); for (const o of [beam, gem, ring]) { o.geometry.dispose(); o.material.dispose(); } chevGeo.dispose(); trailMat.dispose(); trail.dispose(); chip.remove(); marker.remove(); }
	return { set, update, dispose, setOptions, options: () => ({ ...opts }), mark: () => current, info: () => ({ visible: pin.visible, chip: chip.style.display, marker: marker.style.display, trail: trail.visible, title: line1.textContent, detail: line2.textContent, ...opts }) };
}
