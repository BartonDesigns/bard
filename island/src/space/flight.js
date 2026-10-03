import * as THREE from 'three';
import { createOrbitFrame, ORBIT, musicThrust } from './frame.js';
import { createOrbitView } from './view.js';

export function createOrbitalFlight({ renderer, camera, dom, world, earth, seed, profile, shared, location, sun, departed, hint }) {
	const radius = earth ? ORBIT.radius : 2400000 + (seed % 3400) * 1000;
	const frame = createOrbitFrame({ earth, radius });
	const view = createOrbitView({ renderer, earth, seed, radius, profile, shared });
	const P = world.player.state, up = new THREE.Vector3(), marker = new THREE.Vector3();
	const hud = document.createElement('div');
	hud.dataset.orbitHud = '';
	hud.style.cssText = 'position:absolute;top:max(18px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);pointer-events:none;text-align:center;color:#eafaf6;font:12px system-ui;letter-spacing:.08em;text-shadow:0 1px 5px #000;display:none;white-space:pre-line;';
	const bearing = document.createElement('div');
	bearing.style.cssText = 'position:absolute;pointer-events:none;display:none;color:#a5f6e2;font:12px system-ui;text-align:center;text-shadow:0 1px 5px #000;transform:translate(-50%,-50%);';
	bearing.textContent = '◇\nDeparture';
	dom.mount.append(hud, bearing);
	let wasSpace = false, text = '', disposed = false;
	const controls = {
		speed: (run, boost, agl) => frame.speed(P.pos, run, boost, agl) * musicThrust(shared.uBass.value, shared.uPulse.value),
		up: (out) => frame.up(P.pos, out),
		high: () => !!frame.anchor && frame.altitude(P.pos) > ORBIT.start,
	};
	P.orbit = controls;
	function before() {
		if (!frame.anchor && P.flying && P.pos.y >= ORBIT.start) {
			const at = location();
			frame.capture(P, at);
			view.anchor(at.lat, at.lon, sun());
			departed?.(frame.anchor);
			hint('Leaving the atmosphere. Keep flying; descend to return here.', 4000);
		}
		if (controls.high()) P.flying = true;
	}
	function after(dt = 1 / 60) {
		if (!P.flying || P.locked) return;
		if (frame.update(P)) hint('Returning to your departure area. You have control.', 3500);
		if (frame.altitude(P.pos) < ORBIT.end && P.roll) P.roll *= Math.exp(-Math.max(0, dt) * 1.5);
		if (frame.anchor && frame.altitude(P.pos) < ORBIT.start * .65) {
			frame.reset(); wasSpace = false;
			hint('Back above your departure area.', 3000);
		}
		camera.position.copy(P.pos);
		camera.rotation.set(P.pitch, P.yaw, P.roll || 0, 'YXZ');
	}
	function updateHud() {
		const h = frame.altitude(P.pos), on = !!frame.anchor;
		hud.style.display = on ? 'block' : 'none';
		bearing.style.display = on ? 'block' : 'none';
		if (!on) return;
		const phase = h >= 100000 ? 'SPACE' : 'ATMOSPHERE';
		const next = `${phase} · ${(h / 1000).toFixed(h < 1e6 ? 1 : 0)} km\n${Math.round(P.vel.length()).toLocaleString()} m/s`;
		if (text !== next) { text = next; hud.textContent = next; }
		if (h >= 100000 && !wasSpace) { wasSpace = true; hint('Space. C / ⇣ descends toward the planet. WASD / joystick still steers.', 5000); }
		// Point toward the planet above orbit; near the ground, toward the exact saved exit.
		marker.set(frame.anchor.x, 0, frame.anchor.z);
		if (h > ORBIT.entry) marker.copy(frame.center);
		up.copy(marker).sub(P.pos).applyQuaternion(camera.quaternion.clone().invert());
		marker.project(camera);
		const behind = up.z > 0;
		const x = behind ? (up.x >= 0 ? .94 : .06) : THREE.MathUtils.clamp(marker.x * .5 + .5, .06, .94);
		const y = behind ? .82 : THREE.MathUtils.clamp(.5 - marker.y * .5, .12, .82);
		bearing.style.left = `${x * 100}%`; bearing.style.top = `${y * 100}%`;
		bearing.textContent = `${behind ? (up.x >= 0 ? '→' : '←') : '◇'}\nDeparture`;
	}
	return {
		before, after, updateHud,
		active: () => !!frame.anchor,
		blend: () => frame.blend(P.pos),
		space: () => !!frame.anchor && frame.blend(P.pos) >= 1,
		render: (time) => { if (!disposed) view.render(frame, P, camera, time); },
		info: () => ({ ...frame.info(P.pos), speed: P.vel.length(), radius, music: { bass: shared.uBass.value, mid: shared.uMid.value, high: shared.uHigh.value, thrust: musicThrust(shared.uBass.value, shared.uPulse.value) } }),
		cancel: () => { frame.reset(); P.roll = 0; P.climbAssist = false; hud.style.display = bearing.style.display = 'none'; },
		dispose() { disposed = true; delete P.orbit; hud.remove(); bearing.remove(); view.dispose(); },
	};
}
