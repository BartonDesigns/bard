// The car you drive meeting people: anyone inside its outline while it is moving is struck,
// with the car's own speed and weight (people/ragdoll.js shares the momentum out). Where it
// strikes them depends on the car's front: a low bonnet takes the legs and throws them up
// onto it, a tall flat one hits the hips and chest and throws them ahead.

import * as THREE from 'three';
import { specOf } from '../bay/cars.js';

const TALL = { suv: 1, pickup: 1, van: 1, delivery: 1, truck: 1, bus: 1 };

export function createImpacts({ people, ragdolls }) {
	const vel = new THREE.Vector3(), pt = new THREE.Vector3();
	// car: { kind, x, y, z, yaw, vx, vz, mass }
	function strike(car) {
		const sp = Math.hypot(car.vx, car.vz);
		if (sp < 1.5) return 0;
		const S = specOf(car.kind), fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
		const hx = S.W / 2 + 0.25, hz = S.L / 2 + 0.25;
		let n = 0;
		for (const p of people().pool || []) {
			const P = p.P;
			if (!P || P.ragdoll || !P.root.visible) continue;
			const pos = p.M.S.pos, dx = pos.x - car.x, dz = pos.z - car.z;
			if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
			const lon = dx * fx + dz * fz, lat = dx * fz - dz * fx;
			if (Math.abs(lon) > hz || Math.abs(lat) > hx) continue;
			// (only what the car is moving into: its front going forward, its back reversing)
			const along = car.vx * fx + car.vz * fz;
			if (Math.sign(lon) !== Math.sign(along) && Math.abs(lon) < hz - 0.6) continue;
			const tall = TALL[car.kind];
			vel.set(car.vx, 0, car.vz);
			pt.set(pos.x, pos.y + (tall ? 0.95 : 0.55), pos.z);
			ragdolls.hit(P, { point: pt.clone(), vel: vel.clone(), mass: car.mass, lift: tall ? 0.05 : 0.22 });
			p.hit = true;
			n++;
		}
		return n;
	}
	return { strike };
}
