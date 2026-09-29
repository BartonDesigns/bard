// You, seen: P steps the camera back behind your own body (people/avatar.js), which walks
// and runs as you do and, stood still a while, settles into a way of standing (hands in
// pockets, arms folded, a look at the phone). A car in the traffic that runs into you
// knocks you down as it would anyone (people/ragdoll.js): the camera stays on you until you
// are back on your feet. X shoves whoever is in front of you, by your weight and pace.

import * as THREE from 'three';
import { specOf } from '../bay/cars.js';

const EYE = 1.68;
const IDLE = ['pockets', 'crossed', 'phone', 'hip', 'behind'];

export function createSelf({ world, camera, avatar, ragdolls, people, busy, hint }) {
	const S = { third: false, idle: 0, pose: 'rest', down: null };
	const cam = new THREE.Vector3(), look = new THREE.Vector3(), v = new THREE.Vector3();
	let shown = false;

	function toggle() {
		S.third = !S.third;
		if (S.third) avatar.ready();
		hint(S.third ? 'Third person: P to look through your own eyes again.' : 'First person.', 1600);
	}

	// the body kept on you: your place, your heading, your pace
	function follow(dt, t, P) {
		const me = avatar.me;
		if (!me) return false;
		const feet = P.pos.y - EYE;
		if (!shown) { avatar.show(P.pos.x, P.pos.z, Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw))); shown = true; }
		const sp = Math.hypot(P.vel.x, P.vel.z);
		me.M.want.heading = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw));
		me.M.want.speed = sp;
		me.M.want.run = sp > 3 ? 1 : 0;
		// (still for a while: a way of standing; moving again: arms free)
		S.idle = sp < 0.15 ? S.idle + dt : 0;
		const want = S.idle > 5 ? IDLE[Math.floor(t / 23) % IDLE.length] : 'rest';
		if (want !== S.pose) { S.pose = want; me.M.setPose(want); }
		me.M.update(dt, t, null);
		me.M.S.pos.set(P.pos.x, feet, P.pos.z);
		me.P.root.position.copy(me.M.S.pos);
		return true;
	}

	// a car in the traffic running into you
	function struck(P) {
		const St = world()?.street;
		if (!St || S.down) return;
		for (const c of St.cars) {
			if (c.px === undefined || c.v < 2.5) continue;
			const dx = P.pos.x - c.px, dz = P.pos.z - c.pz;
			if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
			// (anywhere in its outline, its front a little ahead: at a low frame rate a car can
			// move most of a metre between looks)
			const Sp = specOf(c.kind), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), lon = dx * fx + dz * fz, lat = dx * fz - dz * fx;
			if (lon < -Sp.L / 2 || lon > Sp.L / 2 + 0.6 || Math.abs(lat) > Sp.W / 2 + 0.2) continue;
			knockDown(P, v.set(fx * c.v, 0, fz * c.v), 1500);
			return;
		}
	}
	function knockDown(P, vel, mass) {
		const me = avatar.me;
		if (!me) return;
		if (!shown) { avatar.show(P.pos.x, P.pos.z, Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw))); shown = true; }
		me.M.S.pos.set(P.pos.x, P.pos.y - EYE, P.pos.z);
		me.P.root.position.copy(me.M.S.pos);
		me.P.root.updateMatrixWorld(true);
		S.down = { t: 0, up: false };
		P.locked = true;
		ragdolls.hit(me.P, { vel: vel.clone(), mass, point: new THREE.Vector3(P.pos.x, P.pos.y - EYE + 0.55, P.pos.z), lift: 0.2 }, (Pd) => {
			// back up, where you fell
			const at = Pd.bones[Pd.map.root].getWorldPosition(new THREE.Vector3());
			setTimeout(() => {
				ragdolls.release(Pd);
				const W = world(), g = W.island.heightAt(at.x, at.z);
				P.pos.set(at.x, g + EYE, at.z); P.vel.set(0, 0, 0);
				me.M.place(at.x, g, at.z, me.M.S.heading);
				P.locked = false;
				S.down = null;
			}, 1600);
		});
	}

	// X: a shove for whoever is in front of you
	function shove() {
		const W = world(), P = W?.player?.state;
		if (!P || P.locked || busy()) return;
		const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
		let best = null, bd = 1.4;
		for (const p of people().pool || []) {
			if (!p.P?.root.visible || p.P.ragdoll) continue;
			const s = p.M.S.pos, dx = s.x - P.pos.x, dz = s.z - P.pos.z, d = Math.hypot(dx, dz);
			if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.5) { bd = d; best = p; }
		}
		if (S.third && avatar.me) avatar.me.M.play('throw', 0.5);
		if (!best) return;
		// (your weight behind your hands, more at a run)
		const pace = Math.hypot(P.vel.x, P.vel.z), push = 3.4 + pace * 0.8, s = best.M.S.pos;
		ragdolls.hit(best.P, { vel: new THREE.Vector3(fx * push, 0.3, fz * push), mass: 80, point: new THREE.Vector3(s.x, s.y + 1.3, s.z), lift: 0 });
	}

	function update(dt, t) {
		const W = world(), P = W?.player?.state;
		if (!P) return;
		// (the car scenes and driving have the body and the camera to themselves)
		if (busy()) { shown = false; return; }
		if (!P.flying && !P.swimming && !S.down) struck(P);
		if (S.down) {
			// on you as you fall and lie
			const me = avatar.me, c = me.P.bones[me.P.map.root].getWorldPosition(v);
			cam.set(c.x + 3.2, c.y + 2.2, c.z + 3.2);
			camera.position.lerp(cam, Math.min(1, dt * 3));
			camera.lookAt(look.copy(c));
			return;
		}
		const on = S.third && !P.flying && !P.swimming && !P.diving;
		if (!on) { if (shown) { avatar.hide(); shown = false; } return; }
		if (!follow(dt, t, P)) return;
		// behind you and a little above, looking past you
		const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), feet = P.pos.y - EYE;
		cam.set(P.pos.x - fx * 3.4, feet + 2.1 - P.pitch * 1.5, P.pos.z - fz * 3.4);
		const g = W.island.heightAt(cam.x, cam.z) + 0.4;
		if (cam.y < g) cam.y = g;
		camera.position.copy(cam);
		camera.lookAt(look.set(P.pos.x + fx * 2, feet + 1.45 + P.pitch * 2, P.pos.z + fz * 2));
	}
	return { update, toggle, shove, state: S };
}
