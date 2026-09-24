// Walking, looking and swimming. Left thumb moves (a joystick that appears
// where you touch), right thumb looks; WASD / arrows / Shift / Space and a
// mouse drag on desktop. Keys stay with the faceplate while keyboard
// performance is on. Porches and the pier are floors, walls/trunks/rocks are
// solid, deep water floats you on the swell.

import * as THREE from 'three';
import { waveHeight } from './world/ocean.js';

const EYE = 1.68;

export function createPlayer(island, village, vegetation, camera, dom, shared) {
	const s = {
		pos: new THREE.Vector3(island.spawn.x, 0, island.spawn.z),
		vel: new THREE.Vector3(), yaw: island.spawn.yaw, pitch: -0.04,
		grounded: false, swimming: false, diving: false, run: false, locked: false,
	};
	s.pos.y = island.heightAt(s.pos.x, s.pos.z) + EYE;
	const keys = new Set();
	const touch = { move: null, look: new Map() };
	const joy = { x: 0, y: 0 };

	// ---------- input ----------
	const owns = (e) => e.target === dom.canvas;
	function keyDown(e) {
		if (!s.active || window._KEYS_PLAY_ON || e.target.closest?.('input,textarea,[contenteditable]')) return;
		const k = e.key.toLowerCase();
		if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) { keys.add(k); e.preventDefault(); }
	}
	function keyUp(e) { keys.delete(e.key.toLowerCase()); }
	let mouse = null;
	function pDown(e) {
		if (!s.active || !owns(e)) return;
		const r = dom.canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
		if (e.pointerType === 'mouse') { mouse = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
		if (x < 0.42 && y > 0.35 && !touch.move) {
			touch.move = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
			dom.joy.style.display = 'block';
			dom.joy.style.left = e.clientX - 55 + 'px'; dom.joy.style.top = e.clientY - 55 + 'px';
		} else touch.look.set(e.pointerId, { x: e.clientX, y: e.clientY });
		dom.canvas.setPointerCapture?.(e.pointerId);
	}
	function pMove(e) {
		if (mouse && e.pointerId === mouse.id) {
			s.yaw -= (e.clientX - mouse.x) * 0.0042; s.pitch -= (e.clientY - mouse.y) * 0.0042;
			mouse.x = e.clientX; mouse.y = e.clientY;
		} else if (touch.move && e.pointerId === touch.move.id) {
			const dx = e.clientX - touch.move.ox, dy = e.clientY - touch.move.oy, l = Math.hypot(dx, dy), m = Math.min(1, l / 55);
			joy.x = l ? dx / l * m : 0; joy.y = l ? dy / l * m : 0;
			dom.knob.style.transform = `translate(${joy.x * 38}px,${joy.y * 38}px)`;
			s.run = m > 0.95;
		} else if (touch.look.has(e.pointerId)) {
			const p = touch.look.get(e.pointerId);
			s.yaw -= (e.clientX - p.x) * 0.0058; s.pitch -= (e.clientY - p.y) * 0.0058;
			p.x = e.clientX; p.y = e.clientY;
		} else return;
		s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch));
	}
	function pUp(e) {
		if (mouse && e.pointerId === mouse.id) mouse = null;
		if (touch.move && e.pointerId === touch.move.id) {
			touch.move = null; joy.x = joy.y = 0; s.run = false;
			dom.joy.style.display = 'none'; dom.knob.style.transform = '';
		}
		touch.look.delete(e.pointerId);
	}
	addEventListener('keydown', keyDown); addEventListener('keyup', keyUp);
	dom.canvas.addEventListener('pointerdown', pDown);
	addEventListener('pointermove', pMove); addEventListener('pointerup', pUp); addEventListener('pointercancel', pUp);
	addEventListener('blur', () => { keys.clear(); mouse = null; touch.move = null; touch.look.clear(); joy.x = joy.y = 0; });

	// ---------- ground and walls ----------
	const foot = village.footprints;
	// footprints are placed with rotationY(face): world = (lx cos + lz sin, -lx sin + lz cos)
	const toLocal = (f, x, z) => {
		const c = Math.cos(f.face), sn = Math.sin(f.face), dx = x - f.x, dz = z - f.z;
		return [dx * c - dz * sn, dx * sn + dz * c];
	};
	const toWorld = (f, lx, lz) => {
		const c = Math.cos(f.face), sn = Math.sin(f.face);
		return [f.x + lx * c + lz * sn, f.z - lx * sn + lz * c];
	};
	function floorAt(x, z, y) {
		let g = island.heightAt(x, z);
		for (const f of foot) {
			const [lx, lz] = toLocal(f, x, z);
			if (f.pier) {
				if (Math.abs(lx) < f.w / 2 + 0.2 && lz > -2 && lz < f.len && y > f.y - 1.2) g = Math.max(g, f.y);
			} else {
				const body = f.d - 2.2;
				if (Math.abs(lx) < f.w / 2 && lz > -body / 2 && lz < body / 2 + 2.8 && y > f.y - 1.4) g = Math.max(g, f.y);
			}
		}
		return g;
	}
	function pushOut(p) {
		for (const f of foot) {
			if (f.pier) continue;
			let [lx, lz] = toLocal(f, p.x, p.z);
			// the walls are solid; the porch in front of them is not
			const hw = f.w / 2 - 0.1, hd0 = -(f.d - 2.2) / 2 - 0.3, hd1 = (f.d - 2.2) / 2 + 0.3;
			if (Math.abs(lx) < hw + 0.3 && lz > hd0 && lz < hd1 && p.y - EYE < f.y + f.h) {
				const pen = [hw + 0.3 - lx, lx + hw + 0.3, hd1 - lz, lz - hd0];
				const m = Math.min(...pen), k = pen.indexOf(m);
				if (k === 0) lx = hw + 0.3; else if (k === 1) lx = -hw - 0.3; else if (k === 2) lz = hd1; else lz = hd0;
				[p.x, p.z] = toWorld(f, lx, lz);
			}
		}
		for (const o of vegetation.obstacles(p.x, p.z, 0.35)) {
			const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + 0.35;
			if (d < min && d > 1e-4) { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; }
		}
	}

	const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
	function input() {
		let mx = joy.x, mz = joy.y;
		if (keys.has('w') || keys.has('arrowup')) mz -= 1;
		if (keys.has('s') || keys.has('arrowdown')) mz += 1;
		if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
		if (keys.has('d') || keys.has('arrowright')) mx += 1;
		return { mx: Math.max(-1, Math.min(1, mx)), mz: Math.max(-1, Math.min(1, mz)) };
	}
	function update(dt, t) {
		if (s.locked) return;
		let mx = joy.x, mz = joy.y;
		if (keys.has('w') || keys.has('arrowup')) mz -= 1;
		if (keys.has('s') || keys.has('arrowdown')) mz += 1;
		if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
		if (keys.has('d') || keys.has('arrowright')) mx += 1;
		const run = s.run || keys.has('shift');
		fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
		right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
		wish.set(0, 0, 0).addScaledVector(fwd, -mz).addScaledVector(right, mx);
		if (wish.lengthSq() > 1) wish.normalize();
		const speed = s.swimming ? 2.2 : run ? 7.5 : 3.9;
		const accel = s.grounded || s.swimming ? 10 : 2.5;
		s.vel.x += (wish.x * speed - s.vel.x) * Math.min(1, accel * dt);
		s.vel.z += (wish.z * speed - s.vel.z) * Math.min(1, accel * dt);
		const nx = s.pos.x + s.vel.x * dt, nz = s.pos.z + s.vel.z * dt;
		// refuse steps up cliffs
		const gNow = floorAt(s.pos.x, s.pos.z, s.pos.y - EYE), gNext = floorAt(nx, nz, s.pos.y - EYE);
		if (gNext - gNow < 0.9 * Math.max(dt * 60, 1) || s.swimming) { s.pos.x = nx; s.pos.z = nz; }
		else { s.vel.x *= 0.2; s.vel.z *= 0.2; }
		pushOut(s.pos);
		const ground = floorAt(s.pos.x, s.pos.z, s.pos.y - EYE);
		const surface = waveHeight(island, s.pos.x, s.pos.z, t, shared.uWave?.value ?? 1);
		s.swimming = ground < surface - 1.35 || (s.diving && ground < surface - 0.6);
		s.surface = surface;
		if (s.swimming && s.diving) {
			// under water: swim where you look; the sea slowly lifts you when you stop
			const climb = -mz * Math.sin(s.pitch) * speed + (keys.has(' ') ? 2.2 : 0);
			s.vel.y += ((Math.abs(mz) > 0.05 || keys.has(' ') ? climb : 0.45) - s.vel.y) * Math.min(1, dt * 3);
			s.pos.y += s.vel.y * dt;
			if (s.pos.y < ground + 0.5) { s.pos.y = ground + 0.5; s.vel.y = Math.max(0, s.vel.y); }
			if (s.pos.y > surface + 0.2) s.diving = false;
			s.grounded = false;
		} else if (s.swimming) {
			s.diving = false;
			const target = surface + 0.35;
			s.pos.y += (target - s.pos.y) * Math.min(1, dt * 4);
			s.vel.y = 0; s.grounded = false;
		} else {
			s.diving = false;
			if ((keys.has(' ') || s.jumpQueued) && s.grounded) { s.vel.y = 5.2; s.grounded = false; }
			s.jumpQueued = false;
			s.vel.y -= 18 * dt;
			s.pos.y += s.vel.y * dt;
			if (s.pos.y < ground + EYE) { s.pos.y = ground + EYE; s.vel.y = 0; s.grounded = true; }
			else if (s.pos.y > ground + EYE + 0.05) s.grounded = false;
		}
		// a gentle step rhythm while walking
		const moving = Math.hypot(s.vel.x, s.vel.z);
		s.bob = (s.bob || 0) + moving * dt * 2.2;
		const bob = s.grounded ? Math.sin(s.bob) * 0.035 * Math.min(1, moving / 4) : 0;
		if (s.locked) return;   // the boat has the camera
		camera.position.set(s.pos.x, s.pos.y + bob, s.pos.z);
		camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
	}
	function dispose() {
		removeEventListener('keydown', keyDown); removeEventListener('keyup', keyUp);
		removeEventListener('pointermove', pMove); removeEventListener('pointerup', pUp); removeEventListener('pointercancel', pUp);
	}
	// the jump button dives when you are swimming at the surface
	function jump() {
		if (s.swimming && !s.diving) { s.diving = true; s.vel.y = -2.4; return 'dive'; }
		s.jumpQueued = true;
		return 'jump';
	}
	return { state: s, update, input, dispose, jump, floorAt, clearInput: () => { keys.clear(); joy.x = joy.y = 0; } };
}
