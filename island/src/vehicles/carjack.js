// Taking a car off its driver: beside a car in the traffic with someone at the wheel, E.
// The camera steps back to show it: the car brakes, you go to the driver's door, reach in
// and haul them out (they go limp and fall as a body does, people/ragdoll.js), you get in
// and it is yours to drive (drive.js). The driver picks themselves up and runs.

import * as THREE from 'three';
import { specOf, seatsOf } from '../bay/cars.js';

export function createCarjack({ world, camera, drive, ragdolls, avatar, hint }) {
	let J = null;                                   // the one under way
	const look = new THREE.Vector3(), want = new THREE.Vector3();
	// (a car's own frame: its left, where the driver sits, and its front)
	const sideOf = (c) => [Math.cos(c.yaw), -Math.sin(c.yaw)], fwdOf = (c) => [Math.sin(c.yaw), Math.cos(c.yaw)];
	function at(c, lx, lz) { const [sx, sz] = sideOf(c), [fx, fz] = fwdOf(c); return [c.px + sx * lx + fx * lz, c.pz + sz * lx + fz * lz]; }

	// the car you could take now: in the traffic, someone at the wheel, its driver's door near you
	function candidate() {
		const W = world(), P = W?.player?.state, S = W?.street;
		if (!S || !P || P.flying || P.locked || drive.active() || J) return null;
		let best = null, bd = 3.4;
		for (const c of S.cars) {
			if (c.px === undefined || !c.seated || c.kind === 'bus') continue;
			const Sp = specOf(c.kind), [dx, dz] = at(c, Sp.W / 2 + 0.5, seatsOf(c.kind).seats[0][2]);
			const d = Math.hypot(dx - P.pos.x, dz - P.pos.z);
			if (d < bd) { bd = d; best = c; }
		}
		return best;
	}
	let offerT = 0;
	function offer(dt) {
		offerT -= dt;
		if (offerT > 0) return;
		offerT = 1.5;
		if (candidate()) hint('E: pull the driver out and take the car', 1600);
	}

	function begin() {
		const c = candidate();
		if (!c) return false;
		const W = world(), P = W.player.state;
		J = { c, t: 0, phase: 'wait', b: null };
		c.held = true;
		P.locked = true;
		avatar.ready().then(() => {
			if (!J) return;
			// (you, where you stood, looking at the door)
			const [dx, dz] = door(c);
			avatar.show(P.pos.x, P.pos.z, Math.atan2(dx - P.pos.x, dz - P.pos.z));
			J.phase = 'walk'; J.t = 0;
		}).catch(() => cancel());
		return true;
	}
	function door(c) { return at(c, specOf(c.kind).W / 2 + 0.5, seatsOf(c.kind).seats[0][2] - 0.1); }
	function cancel() {
		if (!J) return;
		J.c.held = false;
		const P = world()?.player?.state;
		if (P) P.locked = false;
		avatar.hide();
		J = null;
	}

	function update(dt, t) {
		if (!J) { offer(dt); return false; }
		const W = world(), P = W.player.state, c = J.c, me = avatar.me;
		J.t += dt;
		const [dx, dz] = door(c), [sx, sz] = sideOf(c), [fx, fz] = fwdOf(c);
		const g = W.island.heightAt(dx, dz);
		if (J.phase === 'walk' && me) {
			// to the door (the car easing to a stop), then turned to it
			const S = me.M.S, ex = dx - S.pos.x, ez = dz - S.pos.z, d = Math.hypot(ex, ez);
			me.M.want.heading = Math.atan2(ex, ez); me.M.want.speed = d > 0.3 ? Math.min(1.8, d * 2) : 0;
			if ((d < 0.35 && c.v < 0.6) || J.t > 4) { J.phase = 'reach'; J.t = 0; me.M.want.speed = 0; me.M.want.heading = Math.atan2(-sx, -sz); }
		} else if (J.phase === 'reach') {
			// (both hands in through the window, at the collar)
			if (J.t < dt * 1.5) me.M.setPose('push');
			if (J.t > 0.5) {
				// out they come: hauled by the collar, away from the car and down
				const b = W.vehicles.life.pull(c);
				J.b = b;
				if (b) {
					const pull = new THREE.Vector3(sx * 4.2 - fx * 0.6, 1.4, sz * 4.2 - fz * 0.6);
					ragdolls.hit(b.P, { vel: pull, mass: 1e5, point: new THREE.Vector3(dx, g + 1.1, dz), lift: 0, ignore: c.id }, (Pd) => {
						// back up when they have stopped, and away from you at a run
						const root = Pd.bones[Pd.map.root].getWorldPosition(new THREE.Vector3());
						setTimeout(() => { ragdolls.release(Pd); W.vehicles.life.flee(b, root.x, root.z, world().player.state.pos); }, 1400);
					});
				}
				me.M.play('throw', 0.8);
				J.phase = 'in'; J.t = 0;
			}
		} else if (J.phase === 'in') {
			// into the seat
			if (J.t > 0.55) { me.M.want.heading = Math.atan2(fx, fz); me.M.sit(0.45, false); }
			if (J.t > 1.3) {
				const St = W.street;
				avatar.hide();
				St.remove(c);
				P.pos.set(dx, g + 1.68, dz);
				P.locked = false;
				J = null;
				drive.start({ kind: c.kind, col: c.col, x: c.px, z: c.pz, yaw: c.yaw, id: 'taken' });
				return false;
			}
		}
		avatar.update(dt, t, camera.position);
		// the camera: stood back off the car's front quarter on the driver's side, on the door
		want.set(dx + sx * 3.8 + fx * 3.4, g + 1.9, dz + sz * 3.8 + fz * 3.4);
		camera.position.lerp(want, Math.min(1, dt * 3));
		look.set(dx - sx * 0.4, g + 1.0, dz - sz * 0.4);
		camera.lookAt(look);
		P.pos.copy(camera.position);
		return true;
	}
	const active = () => !!J;
	return { update, begin, cancel, active, candidate };
}
