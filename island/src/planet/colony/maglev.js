// Riding the maglev: you board at one end of a line and are carried to the other in the
// lead car's cab, the train easing up to cruise (about 300 km/h on the long lines), holding
// it over the mare and the ridges, and braking smoothly into the far station. A strip at
// the top tells the line, the speed and what is left; the announcements come as hints; a
// Skip button (or Esc) jumps to the arrival.

import * as THREE from 'three';

const VMAX = 83, ACC = 2.6;     // m/s (300 km/h), m/s²
const CAB = 17.6;               // the seat, in the nose of the lead car, metres ahead of the train's middle
// the cab round the seat: the console under the windscreen, its pillars and roof edge
export function cabGroup(train, mat) {
	const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.6 }), glow = new THREE.MeshBasicMaterial({ color: 0x5ff0c6 });
	g.add(train);
	const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); };
	add(new THREE.BoxGeometry(2.2, 0.4, 0.6), dark, 0, 1.0, CAB + 1.6, -0.25);
	add(new THREE.BoxGeometry(0.5, 0.02, 0.3), glow, -0.5, 1.21, CAB + 1.45, -0.25);
	add(new THREE.BoxGeometry(0.3, 0.02, 0.2), glow, 0.45, 1.21, CAB + 1.45, -0.25);
	for (const x of [-1.1, 1.1]) add(new THREE.BoxGeometry(0.12, 1.4, 0.12), mat || dark, x, 2.0, CAB + 1.8, -0.35);
	add(new THREE.BoxGeometry(2.4, 0.12, 0.4), mat || dark, 0, 2.85, CAB + 1.5);
	g.userData.dispose = () => { dark.dispose(); glow.dispose(); };
	return g;
}
export function speedAt(s, len, vmax = VMAX, acc = ACC) {
	// the faster of easing in and braking out, never over cruise
	const v = Math.min(Math.sqrt(2 * acc * Math.max(0, s)) + 3, Math.sqrt(2 * acc * Math.max(0, len - s)) + 1.5);
	return Math.min(vmax, v);
}
// a point along a polyline by distance, and its heading
function along(path, cum, s, out) {
	let lo = 0, hi = cum.length - 1;
	while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
	const a = path[lo], b = path[hi], t = Math.min(1, Math.max(0, (s - cum[lo]) / Math.max(1e-3, cum[hi] - cum[lo])));
	out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t; out.z = a.z + (b.z - a.z) * t;
	out.yaw = Math.atan2(b.x - a.x, b.z - a.z);
	return out;
}

export function createRide({ camera, mount, hint, player, scene, mesh }) {
	let R = null;
	const pt = { x: 0, y: 0, z: 0, yaw: 0 };
	const car = mesh || null;
	if (car) { car.visible = false; scene?.add(car); }
	// the strip and the skip
	const bar = mount ? document.createElement('div') : null, skip = mount ? document.createElement('button') : null;
	if (bar) {
		bar.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(12px + env(safe-area-inset-top));display:none;align-items:center;gap:12px;padding:8px 14px;border-radius:14px;background:rgba(8,20,26,.84);border:1px solid rgba(165,246,226,.45);color:#eafaf6;font:600 13px system-ui;z-index:6;white-space:nowrap;';
		skip.type = 'button'; skip.textContent = 'Skip ⏭';
		skip.style.cssText = 'min-height:36px;padding:4px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#eafaf6;font:600 13px system-ui;cursor:pointer;';
		const txt = document.createElement('span');
		bar.append(txt, skip);
		bar.txt = txt;
		for (const ev of ['pointerdown', 'touchstart', 'keydown']) bar.addEventListener(ev, (e) => e.stopPropagation());
		skip.addEventListener('click', (e) => { e.stopPropagation(); skip.blur(); if (R) R.s = R.len - 1; });
		mount.append(bar);
	}
	const onKey = (e) => { if (R && e.key === 'Escape') R.s = R.len - 1; };
	if (mount) addEventListener('keydown', onKey);
	// line: { path, cum, len, name }, dir: 1 from its start, -1 from its end
	function start(line, dir, to, arrive) {
		R = { line, dir, to, arrive, s: 0, len: line.len, said: 0, t: 0 };
		const P = player();
		if (P) { along(line.path, line.cum, dir > 0 ? 2 : line.len - 2, pt); P.yaw = dir > 0 ? pt.yaw + Math.PI : pt.yaw; P.pitch = -0.02; P.flying = false; }
		hint?.(`Maglev to ${to}. Doors closing; please hold on.`, 4000);
		if (bar) bar.style.display = 'flex';
		if (car) car.visible = true;
	}
	function update(dt) {
		if (!R) return false;
		const P = player();
		R.t += dt;
		const v = speedAt(R.s, R.len);
		R.s = Math.min(R.len, R.s + v * dt);
		const s = R.dir > 0 ? R.s : R.len - R.s;
		along(R.line.path, R.line.cum, s, pt);
		const yaw = R.dir > 0 ? pt.yaw : pt.yaw + Math.PI;
		// the train round you, your seat at the window of the lead car's cab
		if (car) { car.position.set(pt.x - Math.sin(yaw) * CAB, pt.y, pt.z - Math.cos(yaw) * CAB); car.rotation.set(0, yaw, 0); }
		if (P) {
			P.vel?.set(0, 0, 0); P.flying = false;
			P.pos.set(pt.x, pt.y + 1.95, pt.z);
			camera.position.copy(P.pos);
		}
		const kmh = Math.round(v * 3.6), left = R.len - R.s;
		if (bar) bar.txt.textContent = `🚄 ${R.line.name || 'Maglev'} → ${R.to} · ${kmh} km/h · ${left > 1000 ? (left / 1000).toFixed(1) + ' km' : Math.round(left) + ' m'}`;
		// the announcements
		if (R.said === 0 && v > VMAX * 0.95) { R.said = 1; hint?.(`Now cruising at ${kmh} km/h. Arrival in about ${Math.max(1, Math.round(left / VMAX / 60 + 0.5))} min.`, 4000); }
		if (R.said === 1 && R.s > R.len * 0.5) { R.said = 2; hint?.('Crossing the old horizon. Earth stays where it is; the colony drops behind the curve.', 4500); }
		if (R.said === 2 && left < 900) { R.said = 3; hint?.(`Approaching ${R.to}. Please seal your suit.`, 3500); }
		if (R.s >= R.len) {
			const done = R;
			R = null;
			if (bar) bar.style.display = 'none';
			if (car) car.visible = false;
			done.arrive?.();
			hint?.(`${done.to}. Doors open. Mind the dust.`, 4000);
		}
		return true;
	}
	function dispose() { if (mount) { removeEventListener('keydown', onKey); bar.remove(); } if (car) { car.removeFromParent(); car.userData.dispose?.(); } }
	return { start, update, dispose, riding: () => !!R, info: () => (R ? { to: R.to, s: Math.round(R.s), len: Math.round(R.len), kmh: Math.round(speedAt(R.s, R.len) * 3.6) } : null) };
}
