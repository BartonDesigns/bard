// Driving and flying the military's vehicles with the controls drive.js already has (V gets in
// and out, W/S and the arrows, A/D, Space, C for the view, the touch pad), each extended for
// what it is:
//   tank: slow and heavy on Rapier's ray-cast vehicle (vehicles/physics.js, its own weight and
//     power), turning on the spot at a crawl; the turret follows where you look, slewing at its
//     own pace, the gun rises and falls with your look; left button or Q fires the cannon (a
//     shell that flies and bursts), then a reload.
//   armoured truck and jeep: the same physics, lighter; the roof gun fires while held.
//   jet: W/S set the throttle (Shift for the afterburner), A/D roll, up and down pitch, left
//     and right the rudder; down the runway to take off (it rotates past flying speed), gear up
//     on its own, banks to turn; back down gently on its wheels to land, Space for the brakes. Too
//     fast or too steep a landing is a crash. Q or the left button fires the gun.
//   helicopter: the rotor spools up, up and down climb and descend, W/S fly forward and back,
//     A/D turn, left and right slide; set it down gently; the chin gun fires where you look.
// The camera is behind the vehicle (C for the seat). Nothing here draws to the speakers but
// through the world's bus (military/sound.js).

import * as THREE from 'three';
import { loadRapier, createCarPhysics } from '../vehicles/physics.js';
import { vehicleMesh, DIMS, SCHEMES } from './models.js';
import { engineSound, oneShot } from './sound.js';
import { jetState, jetStep, heliState, heliStep } from './flight.js';
import { firstTime } from '../ui/touch-skin.js';
import { stencilVehicle } from '../signage/cars.js';
import { clamp, wrapAngle as wrap } from '../noise.js';

// how each ground vehicle drives (vehicles/physics.js FEEL's fields)
const FEEL = {
	tank: { mass: 42000, power: 95000, top: 17, drive: 'all', steer: 0.75, spring: 60, travel: 0.22, damp: [3.4, 4.4], grip: 3.2, side: 1.4, brake: 2800 },
	apc: { mass: 16000, power: 52000, top: 26, drive: 'all', steer: 0.55, spring: 50, travel: 0.3, damp: [3.0, 4.0], grip: 2.4, side: 1.0, brake: 1100 },
	jeep: { mass: 2600, power: 11500, top: 36, drive: 'all', steer: 0.55, spring: 26, travel: 0.3, damp: [2.6, 3.6], grip: 2.4, side: 0.95, brake: 210 },
	truck: { mass: 9000, power: 26000, top: 26, drive: 'rear', steer: 0.55, spring: 42, travel: 0.28, damp: [3.0, 4.0], grip: 2.0, side: 0.85, brake: 640 },
};
const specFor = (k) => { const D = DIMS[k]; return { L: D.L, W: D.W, H: D.H, clear: D.clear, wr: D.wr, wz: D.wz }; };
const NAMES = { tank: 'Tank', apc: 'Armoured truck', jeep: 'Jeep', truck: 'Cargo truck', jet: 'Jet', heli: 'Helicopter' };
const G = 9.81;
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

export function createMilDrive({ world, camera, combat, kit, group, hint, isPhone, mount }) {
	const W = () => world();
	// the world as the physics sees it (as drive.js gives it its cars)
	function env() {
		const w = W(), I = w.island;
		return {
			floorAt: (x, z, y) => Math.max(I.heightAt(x, z), I.extraFloor ? I.extraFloor(x, z, y) : -1e9),
			boxes: (x, z, r) => (w.real?.loaded?.() ? w.real.near('boxes', x, z, r) : []).filter((b) => b.w > 1 && b.d > 1).map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, a: b.a, h: b.wallH + 2, y: I.heightAt(b.x, b.z) - 1 })),
			cars: (x, z, r) => (w.vehicles ? w.vehicles.carsNear(x, z, r).filter((c) => c.id !== 'mine') : []).map((c) => ({ id: c.id || c.kind + c.x.toFixed(1) + c.z.toFixed(1), kind: c.kind, x: c.x, y: c.y, z: c.z, yaw: c.yaw })),
			push: I.extraPush ? (p, footY) => I.extraPush(p, footY) : null,
		};
	}
	const floorAt = (x, z, y) => env().floorAt(x, z, y);

	// v: the parked vehicle ({ kind, x, y, z, yaw, scheme }); io: drive.js's { held, pedals, hud(text), strike(car), seat() (C: the seat's view) }
	function board(v, io) {
		const kind = v.kind, D = DIMS[kind], air = kind === 'jet' || kind === 'heli';
		const mesh = stencilVehicle(vehicleMesh(kind, kit, SCHEMES[v.scheme] || SCHEMES.woodland, { phone: isPhone }), kind, { parked: true, grey: air });
		group.add(mesh);
		mesh.position.set(v.x, v.y, v.z); mesh.rotation.set(0, v.yaw, 0);
		const S = { kind, mesh, car: null, loading: false, pos: new THREE.Vector3(v.x, v.y, v.z), q: new THREE.Quaternion().setFromAxisAngle(Y, v.yaw), yaw: v.yaw, spd: 0, vel: new THREE.Vector3(), throttle: 0, ground: true, gear: true, spin: 0, turret: 0, gun: 0, reload: 0, fire: 0, shells: [], camPos: null, dustT: 0, dead: false, alt: 0 };
		// the aircraft's own state (military/flight.js)
		const F = kind === 'jet' ? jetState(v.x, v.y, v.z, v.yaw) : kind === 'heli' ? heliState(v.x, v.y, v.z, v.yaw) : null;
		const engine = engineSound(kind);
		const P = W().player.state;
		// fire: the left button on the view, Q, or the Fire button on a touch screen
		let firing = false;
		const canvas = mount.querySelector('canvas');
		const down = (e) => { if (e.button === 0 && (!canvas || e.target === canvas)) firing = true; };
		const up = (e) => { if (e.button === 0) firing = false; };
		const keyD = (e) => { if ((e.key === 'q' || e.key === 'Q') && !e.repeat) firing = true; };
		const keyU = (e) => { if (e.key === 'q' || e.key === 'Q') firing = false; };
		addEventListener('pointerdown', down); addEventListener('pointerup', up); addEventListener('keydown', keyD); addEventListener('keyup', keyU);
		const btns = [];
		// (data-mil: its place by the thumb on a touch screen, ui/touch-skin.js)
		const btn = (label, css, on, role) => {
			const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', label); b.title = label;
			b.className = 'l99-mil'; b.dataset.mil = role;
			b.style.cssText = 'position:absolute;min-width:56px;min-height:56px;border-radius:14px;border:1px solid rgba(255,255,255,.3);background:rgba(8,20,26,.55);color:#eafaf6;font:600 13px var(--bard-display,system-ui,sans-serif);touch-action:none;' + css;
			b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); on(true); b.style.background = '#01a982'; });
			for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { on(false); b.style.background = 'rgba(8,20,26,.55)'; });
			b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
			mount.appendChild(b); btns.push(b); return b;
		};
		const touch = { up: false, down: false };
		if (isPhone || matchMedia?.('(pointer: coarse)')?.matches) {
			btn(kind === 'tank' ? 'Cannon' : 'Fire', 'right:calc(16px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 170px + env(safe-area-inset-bottom));', (o) => { firing = o; }, 'fire');
			if (air) { btn('Up', 'right:calc(90px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 230px + env(safe-area-inset-bottom));', (o) => { touch.up = o; }, 'up'); btn('Down', 'right:calc(90px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 165px + env(safe-area-inset-bottom));', (o) => { touch.down = o; }, 'down'); }
		}
		const k = (a, b) => io.held.has(a) || (b && io.held.has(b));
		if (!air) {
			S.loading = true;
			loadRapier().then((R) => { S.loading = false; if (S.dead) return; S.car = createCarPhysics(R, kind, { x: v.x, z: v.z, yaw: v.yaw }, env(), { spec: specFor(kind), feel: FEEL[kind] }); }).catch((e) => { S.loading = false; console.warn('[military] physics', e); });
		}
		if (!isPhone || firstTime('l99-tip-' + kind)) hint(air ? (kind === 'jet' ? (isPhone ? 'Jet: ▲ ▼ throttle, ◀ ▶ roll, Up and Down to pitch, Fire for the gun. Take off down the runway.' : 'Jet: W/S throttle (Shift afterburner), A/D roll, ↑/↓ pitch, ←/→ rudder, Space brakes, Q or click fires. V to get out once stopped.') : (isPhone ? 'Helicopter: Up and Down climb and descend, ▲ ▼ forward and back, ◀ ▶ turn, Fire for the gun.' : 'Helicopter: ↑/↓ climb and descend, W/S forward and back, A/D turn, ←/→ slide, Q or click fires. Set it down gently.')) : (kind === 'tank' ? (isPhone ? 'Tank: the pad drives, look to turn the turret, Cannon fires.' : 'Tank: W/S drive, A/D turn (on the spot at a crawl), look to aim the turret, click or Q fires the cannon, C for the gunner\'s sight.') : `${NAMES[kind]}: drive it as any car; click or Q fires the roof gun.`), 5000, 1);

		// ---------- weapons ----------
		const view = () => _v.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)).normalize().clone();
		function gunfire(from, dir, dmg, spread = 0.01) {
			const d = dir.clone().add(_w.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
			const hit = combat.firstHit(from, d, 400, combat.me);
			const end = hit ? from.clone().addScaledVector(d, hit.t) : from.clone().addScaledVector(d, 400);
			if (hit) combat.landShot(hit, from, d, combat.me, dmg, 'ballistic');
			combat.fx.tracer(from, end, 1, 700);
			combat.fx.muzzle(from, d, 0);
			oneShot('gun', 0.8);
		}
		function cannon(from, dir) {
			S.shells.push({ pos: from.clone(), vel: dir.clone().multiplyScalar(190), life: 6 });
			combat.fx.muzzle(from, dir, 2); combat.fx.smokePuff(from, 0.35, 2.6, 2.5); combat.fx.dust(_w.copy(S.pos), 14, 0.6, 0.55, 0.48, 1.4, 0.4);
			oneShot('cannon', 1);
			if (S.car) { const b = S.car.body, lv = b.linvel(); b.setLinvel({ x: lv.x - dir.x * 0.6, y: lv.y, z: lv.z - dir.z * 0.6 }, true); }
		}
		function shells(dt) {
			for (let i = S.shells.length - 1; i >= 0; i--) {
				const s = S.shells[i];
				s.life -= dt; s.vel.y -= G * 0.35 * dt;
				const step = s.vel.length() * dt, dir = s.vel.clone().normalize();
				const hit = combat.firstHit(s.pos, dir, step, combat.me);
				if (hit || s.life <= 0) {
					const at = s.pos.clone().addScaledVector(dir, hit ? hit.t : 0);
					if (hit) { W()?.structures?.shell?.(at, dir, hit, 260); combat.blast(at, 7, 260, combat.me); combat.fx.explosion(at, 3.2); }          // structures: the shell through the wall it struck, then the burst
					S.shells.splice(i, 1); continue;
				}
				const from = s.pos.clone(); s.pos.addScaledVector(dir, step);
				combat.fx.tracer(from, s.pos, 3, 2000);
			}
		}

		// ---------- the ground vehicles ----------
		function ground(dt) {
			const C = S.car;
			if (!C) { io.hud(S.loading ? 'Starting the engine…' : ''); placeCamera(dt); return; }
			const T = io.pedals;
			C.ctl.throttle = k('arrowup', 'w') || T.straight ? (k('shift') ? 1 : 0.85) : 0;
			C.ctl.brake = k('arrowdown', 's') || T.back ? 1 : 0;
			C.ctl.steer = (k('arrowleft', 'a') || T.left ? 1 : 0) - (k('arrowright', 'd') || T.right ? 1 : 0);
			C.ctl.hand = k(' ') ? 1 : 0;
			C.step(dt);
			const o = C.pose();
			// a tracked vehicle turns on the spot at a crawl
			if (kind === 'tank' && Math.abs(o.speed) < 2.5 && C.ctl.steer && !C.ctl.throttle) { const av = C.body.angvel(); C.body.setAngvel({ x: av.x, y: C.ctl.steer * 0.55, z: av.z }, true); }
			_q.set(o.q[0], o.q[1], o.q[2], o.q[3]);
			_m.compose(_w.set(o.p[0], o.p[1], o.p[2]), _q, _v.set(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, o.down, 0));
			mesh.matrixAutoUpdate = true;
			_m.decompose(mesh.position, mesh.quaternion, mesh.scale);
			S.pos.copy(mesh.position); S.q.copy(mesh.quaternion); S.spd = o.speed;
			const e = _m.elements; S.yaw = Math.atan2(e[8], e[10]);
			// upside down: back on its tracks
			if (_v.set(0, 1, 0).applyQuaternion(_q).y < 0.2 && Math.abs(o.speed) < 1) { S.flipT = (S.flipT || 0) + dt; if (S.flipT > 2) { C.reset(S.pos.x, S.pos.z, S.yaw); S.flipT = 0; } } else S.flipT = 0;
			// anyone in the way is struck
			if (io.strike) { const lv = C.body.linvel(); const n = io.strike({ kind: kind === 'jeep' ? 'suv' : 'truck', x: S.pos.x, y: S.pos.y, z: S.pos.z, yaw: S.yaw, vx: lv.x, vz: lv.z, mass: FEEL[kind].mass }); if (n && kind === 'jeep') C.body.setLinvel({ x: lv.x * 0.8, y: lv.y, z: lv.z * 0.8 }, true); }
			// the tracks run with the ground (one side faster in a turn), the wheels roll and steer
			const U = mesh.userData, wy = C.body.angvel().y;
			if (kind === 'tank') U.pose?.({ track: [(o.speed - wy * D.W * 0.4) * dt, (o.speed + wy * D.W * 0.4) * dt] });
			else U.pose?.({ roll: o.speed * dt, steer: C.ctl.steer * 0.5 * (1 - Math.min(0.6, Math.abs(o.speed) / 40)) });
			// the turret follows your look; the gun its pitch
			if (U.turret) {
				const want = wrap(P.yaw + Math.PI - S.yaw);
				S.turret += clamp(wrap(want - S.turret), -0.7 * dt, 0.7 * dt);
				U.turret.rotation.y = S.turret;
				S.gun += clamp(clamp(P.pitch, -0.12, 0.35) - S.gun, -0.4 * dt, 0.4 * dt);
				U.gun.rotation.x = -S.gun;
			}
			S.reload = Math.max(0, S.reload - dt); S.fire = Math.max(0, S.fire - dt);
			if (firing && kind === 'tank' && S.reload <= 0) {
				U.gun.updateWorldMatrix(true, false);
				const from = new THREE.Vector3(0, 0, U.muzzle || 5.4).applyMatrix4(U.gun.matrixWorld), dir = new THREE.Vector3(0, 0, 1).transformDirection(U.gun.matrixWorld);
				cannon(from, dir); S.reload = 3.6;
			} else if (firing && kind !== 'tank' && kind !== 'truck' && S.fire <= 0) {
				const from = S.pos.clone().add(_w.set(0, D.H + 0.3, 0)); gunfire(from, view(), 26, 0.02); S.fire = 0.1;
			}
			// dust off the tracks and wheels, exhaust when it works hard
			S.dustT -= dt;
			if (S.dustT <= 0 && Math.abs(o.speed) > 2) { S.dustT = 0.12; const back = _w.set(Math.sin(S.yaw), 0, Math.cos(S.yaw)).multiplyScalar(-D.L / 2); combat.fx.dust({ x: S.pos.x + back.x, y: S.pos.y + 0.3, z: S.pos.z + back.z }, kind === 'tank' ? 4 : 2, 0.58, 0.53, 0.45, kind === 'tank' ? 1.3 : 0.7, 0.5); }
			if (C.ctl.throttle && Math.random() < dt * 6) combat.fx.smokePuff({ x: S.pos.x - Math.sin(S.yaw) * D.L / 2, y: S.pos.y + 1.4, z: S.pos.z - Math.cos(S.yaw) * D.L / 2 }, 0.45, 0.6, 1.2);
			engine.set(Math.abs(o.speed) / FEEL[kind].top, C.ctl.throttle, 1, o.speed, { x: S.pos.x, y: S.pos.y + 1, z: S.pos.z, inside: io.seat() });
			placeCamera(dt);
			io.hud(`${NAMES[kind]} · ${Math.round(Math.abs(o.speed) * 3.6)} km/h${o.speed < -0.3 ? ' R' : ''}${kind === 'tank' ? (S.reload > 0 ? ` · loading ${S.reload.toFixed(1)} s` : ' · cannon ready') : ''}`);
		}

		// ---------- the jet (military/flight.js flies it) ----------
		function jet(dt) {
			const T = io.pedals;
			const I = {
				thr: (k('w') || T.straight ? 1 : 0) - (k('s') || T.back ? 1 : 0), ab: k('shift'),
				pitch: (k('arrowup') || touch.up ? 1 : 0) - (k('arrowdown') || touch.down ? 1 : 0),
				roll: (k('d') || T.right ? 1 : 0) - (k('a') || T.left ? 1 : 0),
				yaw: (k('arrowright') ? 1 : 0) - (k('arrowleft') ? 1 : 0), brake: k(' '),
			};
			const ev = jetStep(F, I, dt, floorAt);
			if (ev === 'crash') return crash();
			if (ev === 'smooth' || ev === 'firm') hint(ev === 'smooth' ? 'Smooth touchdown.' : 'Down, firmly.', 1500, 1);
			S.pos.copy(F.pos); S.q.copy(F.q); S.spd = F.spd; S.yaw = F.yaw; S.alt = F.alt; S.ground = F.ground; S.gear = F.gear; S.throttle = F.throttle; S.vel.copy(F.vel);
			mesh.position.copy(S.pos); mesh.quaternion.copy(S.q);
			mesh.userData.pose?.({ surf: F.surf, gear: F.gearT, throttle: F.throttle, ab: F.ab ? 1 : 0, dt });
			const fwd = _v.copy(Z).applyQuaternion(S.q);
			S.fire = Math.max(0, S.fire - dt);
			if (firing && S.fire <= 0) { const from = S.pos.clone().add(_w.copy(fwd).multiplyScalar(6)).add(_w.set(0, 2.2, 0)); gunfire(from, fwd.clone(), 30, 0.012); S.fire = 0.06; }
			if (F.throttle > 0.5 && Math.random() < dt * (F.ab ? 30 : 8)) combat.fx.smokePuff(S.pos.clone().addScaledVector(fwd, -8.5).add(_w.set(0, 2.1, 0)), F.ab ? 0.05 : 0.5, F.ab ? 0.9 : 0.6, 0.6);
			engine.set(F.throttle * (F.ab ? 1 : 0.85), F.throttle, 1, S.spd, { x: S.pos.x, y: S.pos.y + 2, z: S.pos.z, fx: fwd.x, fz: fwd.z, inside: io.seat() });
			placeCamera(dt);
			io.hud(`Jet · ${Math.round(S.spd * 3.6)} km/h · throttle ${Math.round(F.throttle * 100)}%${F.ab ? ' · afterburner' : ''} · ${S.ground ? 'on the ground' : `${Math.round(S.alt)} m`}${F.gearT > 0.98 ? ' · gear down' : F.gearT > 0.02 ? ' · gear moving' : ''}${F.surf.flap > 0.5 ? ' · flaps' : ''}`);
		}

		// ---------- the helicopter ----------
		function heli(dt) {
			const T = io.pedals;
			const I = {
				coll: (k('arrowup') || touch.up ? 1 : 0) - (k('arrowdown') || touch.down ? 1 : 0),
				fwd: (k('w') || T.straight ? 1 : 0) - (k('s') || T.back ? 1 : 0),
				turn: (k('a') || T.left ? 1 : 0) - (k('d') || T.right ? 1 : 0),
				side: (k('arrowleft') ? 1 : 0) - (k('arrowright') ? 1 : 0), fast: k('shift'),
			};
			const ev = heliStep(F, I, dt, floorAt);
			if (ev === 'crash') return crash();
			if (ev === 'down') hint('Set down.', 1200, 1);
			S.pos.copy(F.pos); S.q.copy(F.q); S.spd = F.spd; S.yaw = F.yaw; S.alt = F.alt; S.ground = F.ground; S.spin = F.spin; S.vel.copy(F.vel);
			mesh.position.copy(S.pos); mesh.quaternion.copy(S.q);
			const U = mesh.userData;
			U.pose?.({ spin: F.spin, dt });
			const g0 = S.pos.y - S.alt;
			if (S.alt < 12 && S.spin > 0.6 && Math.random() < dt * 10) { const a = Math.random() * 6.283, r = 3 + Math.random() * 5; combat.fx.dust({ x: S.pos.x + Math.cos(a) * r, y: g0 + 0.3, z: S.pos.z + Math.sin(a) * r }, 2, 0.6, 0.56, 0.5, 1.2, 0.2); }
			S.fire = Math.max(0, S.fire - dt);
			if (firing && S.fire <= 0) { const from = S.pos.clone().add(_w.set(Math.sin(S.yaw) * 2.8, 0.7, Math.cos(S.yaw) * 2.8)); gunfire(from, view(), 24, 0.02); S.fire = 0.08; }
			engine.set(S.spin, 0.5 + I.coll * 0.3, 1, S.spd, { x: S.pos.x, y: S.pos.y + 3, z: S.pos.z, inside: io.seat() });
			placeCamera(dt);
			io.hud(`Helicopter · ${Math.round(S.spd * 3.6)} km/h · ${S.ground ? (S.spin < 1 ? `rotor ${Math.round(S.spin * 100)}%` : 'on the ground') : `${Math.round(S.alt)} m`}`);
		}
		function crash() {
			combat.fx.explosion(S.pos.clone().add(_w.set(0, 1.5, 0)), 6);
			combat.blast(S.pos.clone().add(_w.set(0, 1, 0)), 10, 120, combat.me);
			oneShot('crash', 1);
			hint(`The ${NAMES[kind].toLowerCase()} is wrecked. You scramble clear.`, 3500, 2);
			S.dead = true; S.wrecked = true;
			io.stop?.(true);
			return true;
		}

		// ---------- the camera: behind (the default) or in the seat (C) ----------
		function placeCamera(dt) {
			const seat = io.seat();
			const fwd = _v.copy(Z).applyQuaternion(S.q);
			if (seat) {
				const eye = kind === 'jet' ? [0, 2.75, 3.9] : kind === 'heli' ? [0.4, 2.3, 1.6] : kind === 'tank' ? [0, D.H + 0.6, -0.2] : [0.4, D.H - 0.3, 0.4];
				camera.position.set(...eye).applyMatrix4(mesh.matrixWorld);
				if (camera.near !== 0.05) { camera.near = 0.05; camera.updateProjectionMatrix(); }
				camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
			} else {
				if (camera.near !== 0.25) { camera.near = 0.25; camera.updateProjectionMatrix(); }
				// behind the way you look (the turret's way on a tank), the aircraft along their nose
				const back = kind === 'jet' ? 24 : kind === 'heli' ? 18 : D.L + 5, upk = kind === 'jet' ? 6 : kind === 'heli' ? 5 : D.H + 2.5;
				const dir = air ? fwd.clone() : view();
				if (!air) dir.y = 0;
				dir.normalize();
				const want = S.pos.clone().addScaledVector(dir, -back).add(_w.set(0, upk, 0));
				const gy = W().island.heightAt(want.x, want.z) + 1; if (want.y < gy) want.y = gy;
				S.camPos = S.camPos ? S.camPos.lerp(want, Math.min(1, dt * (air ? 4 : 6))) : want;
				camera.position.copy(S.camPos);
				const look = air ? S.pos.clone().addScaledVector(fwd, 30).add(_w.set(0, 2, 0)) : S.pos.clone().add(_w.set(0, D.H * 0.8, 0)).addScaledVector(view(), 25);
				if (air && io.looked()) look.copy(camera.position).add(view().multiplyScalar(30));
				camera.lookAt(look);
			}
			P.pos.copy(camera.position);
		}

		const ctrl = {
			kind,
			update(dt) {
				if (S.dead) return true;
				if (air) { if (kind === 'jet') jet(dt); else heli(dt); } else ground(dt);
				shells(dt);
				return true;
			},
			speed: () => Math.abs(S.spd),
			canLeave: () => !S.dead && (air ? S.ground && Math.abs(S.spd) < 6 : Math.abs(S.spd) < 4),
			// out of it: the vehicle stays where it stands (a wreck is gone); you beside it
			leave() {
				S.dead = true;
				removeEventListener('pointerdown', down); removeEventListener('pointerup', up); removeEventListener('keydown', keyD); removeEventListener('keyup', keyU);
				for (const b of btns) b.remove();
				engine.stop();
				S.car?.dispose();
				if (camera.near !== 0.25) { camera.near = 0.25; camera.updateProjectionMatrix(); }
				const yaw = S.yaw, out = { x: S.pos.x + Math.cos(yaw) * (D.W / 2 + 1.4), z: S.pos.z - Math.sin(yaw) * (D.W / 2 + 1.4) };
				mesh.removeFromParent(); mesh.userData.dispose?.();
				return { wrecked: !!S.wrecked, kind, x: S.pos.x, y: S.pos.y, z: S.pos.z, yaw, scheme: v.scheme, out };
			},
			info: () => ({ kind, speed: +S.spd.toFixed(1), ground: S.ground, alt: Math.round(S.alt), throttle: +S.throttle.toFixed(2), turret: +S.turret.toFixed(2), gun: +S.gun.toFixed(2), reload: +S.reload.toFixed(1), gear: S.gear, spin: +S.spin.toFixed(2), physics: !!S.car }),
			state: S,
			// for the tests: press and hold a control
			fire: (on = true) => { firing = !!on; },
			touch,
		};
		return ctrl;
	}
	return { board };
}
