// Driving a car yourself: Rapier's ray-cast vehicle (@dimforge/rapier3d-compat), loaded
// only when you first get in. The car is a rigid body on four sprung wheels, each a ray to
// the ground; the ground is the world's own (island.heightAt and the floors it adds: the
// bridge's deck, the freeway overpasses) as a height field that follows you; the buildings
// near you are solid boxes, the parked cars and the traffic solid too. Each kind of car has
// its own weight, power, suspension, grip, steering and top speed, so a pickup wallows and
// a sports car bites.

import { SPEC } from '../bay/cars.js';

// mass (kg), power (engine force, N), top (m/s), drive (front, rear, all), steer (radians),
// spring (stiffness), travel (m), damp (compression, relaxation), grip (friction slip), side
// (side friction stiffness), brake
export const FEEL = {
	sedan: { mass: 1500, power: 5200, top: 52, drive: 'front', steer: 0.58, spring: 32, travel: 0.18, damp: [3.2, 4.4], grip: 2.6, side: 1, brake: 55 },
	hatch: { mass: 1250, power: 4600, top: 50, drive: 'front', steer: 0.62, spring: 34, travel: 0.17, damp: [3.2, 4.4], grip: 2.6, side: 1, brake: 50 },
	crossover: { mass: 1750, power: 6000, top: 54, drive: 'all', steer: 0.55, spring: 28, travel: 0.22, damp: [3.0, 4.2], grip: 2.5, side: 0.95, brake: 60 },
	suv: { mass: 2100, power: 6800, top: 50, drive: 'all', steer: 0.52, spring: 25, travel: 0.25, damp: [2.8, 4.0], grip: 2.3, side: 0.9, brake: 70 },
	pickup: { mass: 2400, power: 7600, top: 48, drive: 'rear', steer: 0.48, spring: 20, travel: 0.3, damp: [2.3, 3.2], grip: 2.0, side: 0.8, brake: 75 },
	van: { mass: 2000, power: 5400, top: 46, drive: 'front', steer: 0.52, spring: 26, travel: 0.22, damp: [2.8, 4.0], grip: 2.3, side: 0.9, brake: 65 },
	delivery: { mass: 2900, power: 6200, top: 40, drive: 'rear', steer: 0.5, spring: 24, travel: 0.24, damp: [2.6, 3.6], grip: 2.0, side: 0.8, brake: 85 },
	sports: { mass: 1400, power: 11000, top: 80, drive: 'rear', steer: 0.5, spring: 55, travel: 0.1, damp: [4.4, 5.6], grip: 3.4, side: 1.25, brake: 70 },
	truck: { mass: 7500, power: 17000, top: 30, drive: 'rear', steer: 0.55, spring: 40, travel: 0.25, damp: [3.0, 4.0], grip: 1.8, side: 0.8, brake: 220 },
	bus: { mass: 11000, power: 24000, top: 27, drive: 'rear', steer: 0.62, spring: 45, travel: 0.22, damp: [3.2, 4.2], grip: 1.8, side: 0.8, brake: 320 },
};

let rapier = null;
// the engine: dist/rapier.mjs beside the game (build.mjs puts it there), or the CDN if not
export function loadRapier() {
	if (rapier) return rapier;
	const local = new URL('./rapier.mjs', import.meta.url).href, cdn = 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.21.0/rapier.mjs';
	const imp = (u) => import(/* @vite-ignore */ u);
	rapier = imp(local).catch(() => imp(cdn)).then(async (m) => { const R = m.default || m; await R.init(); return R; });
	rapier.catch(() => { rapier = null; });
	return rapier;
}

// the car: kind, where (x, z, yaw), and the world to drive in
// env: { heightAt(x, z), floorAt(x, z, y), boxes(x, z, r) -> [{x, z, w, d, a, h}], cars(x, z, r) -> [{x, y, z, yaw, kind}], push(p, footY) }
export function createCarPhysics(R, kind, start, env) {
	const S = SPEC[kind] || SPEC.sedan, F = FEEL[kind] || FEEL.sedan;
	const world = new R.World({ x: 0, y: -9.81, z: 0 });
	world.timestep = 1 / 60;
	// the body: a box a little inside the car's shape, heavy low down
	const y0 = env.floorAt(start.x, start.z, 1e4) + 0.3;
	const q = { x: 0, y: Math.sin(start.yaw / 2), z: 0, w: Math.cos(start.yaw / 2) };
	const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(start.x, y0 + S.wr + 0.2, start.z).setRotation(q).setCanSleep(false).setLinearDamping(0.05).setAngularDamping(0.6));
	const hh = (S.H - (S.clear ?? 0.3)) / 2 * 0.8, hb = S.wr + 0.05;
	world.createCollider(R.ColliderDesc.cuboid(S.W / 2 * 0.95, hh, S.L / 2 * 0.96).setTranslation(0, hb + hh - S.wr, 0).setMass(F.mass).setFriction(0.4).setRestitution(0.05), body);
	// (the weight a little low and forward, as in a real car)
	body.setAdditionalMassProperties(0, { x: 0, y: -0.25, z: 0.1 }, { x: F.mass * 0.6, y: F.mass * 0.8, z: F.mass * 0.4 }, { x: 0, y: 0, z: 0, w: 1 }, true);
	const V = world.createVehicleController(body);
	V.indexUpAxis = 1; V.setIndexForwardAxis = 2;
	const x = S.W / 2 - 0.15, rest = F.travel + 0.12;
	for (const [wx, wz] of [[x, S.wz], [-x, S.wz], [x, -S.wz], [-x, -S.wz]]) V.addWheel({ x: wx, y: 0.05, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, S.wr);
	for (let i = 0; i < 4; i++) {
		V.setWheelSuspensionStiffness(i, F.spring); V.setWheelMaxSuspensionTravel(i, F.travel);
		V.setWheelSuspensionCompression(i, F.damp[0]); V.setWheelSuspensionRelaxation(i, F.damp[1]);
		V.setWheelFrictionSlip(i, F.grip); V.setWheelSideFrictionStiffness(i, F.side);
		V.setWheelMaxSuspensionForce(i, F.mass * 40);
	}
	// the ground round the car: a height field, moved along as you go
	const N = 48, CELL = 2.5;
	let ground = null, gx = 1e9, gz = 1e9;
	const solids = [];
	function regrid(cx, cz) {
		gx = Math.round(cx / CELL) * CELL; gz = Math.round(cz / CELL) * CELL;
		const H = new Float32Array((N + 1) * (N + 1)), half = N * CELL / 2;
		for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
			const px = gx - half + j * CELL, pz = gz - half + i * CELL;
			H[i + j * (N + 1)] = env.floorAt(px, pz, 1e4);
		}
		if (ground) world.removeCollider(ground, false);
		ground = world.createCollider(R.ColliderDesc.heightfield(N, N, H, { x: N * CELL, y: 1, z: N * CELL }).setTranslation(gx, 0, gz).setFriction(1));
		// the buildings near: fixed boxes
		for (const c of solids) world.removeCollider(c, false);
		solids.length = 0;
		for (const b of env.boxes(cx, cz, 70)) {
			const h = Math.max(3, b.h || 8), a = b.a || 0;
			solids.push(world.createCollider(R.ColliderDesc.cuboid(b.w / 2, h / 2, b.d / 2).setTranslation(b.x, b.y + h / 2, b.z).setRotation({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(-a / 2) }).setFriction(0.3)));
		}
	}
	// the cars about: parked ones fixed, the traffic moved each step (kinematic)
	const carBodies = new Map();
	let carT = 0;
	function cars(cx, cz, dt) {
		carT -= dt;
		const list = env.cars(cx, cz, 45), seen = new Set();
		for (const c of list) {
			const key = c.id;
			seen.add(key);
			let e = carBodies.get(key);
			const Sc = SPEC[c.kind] || SPEC.sedan, h = (Sc.H - (Sc.clear ?? 0.3)) / 2;
			const rot = { x: 0, y: Math.sin(c.yaw / 2), z: 0, w: Math.cos(c.yaw / 2) };
			if (!e) {
				const rb = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(c.x, c.y + (Sc.clear ?? 0.3) + h, c.z).setRotation(rot));
				world.createCollider(R.ColliderDesc.cuboid(Sc.W / 2 * 0.95, h, Sc.L / 2 * 0.95).setFriction(0.4), rb);
				carBodies.set(key, e = rb);
			} else e.setNextKinematicTranslation({ x: c.x, y: c.y + (Sc.clear ?? 0.3) + h, z: c.z }), e.setNextKinematicRotation(rot);
		}
		for (const [key, rb] of carBodies) if (!seen.has(key)) { world.removeRigidBody(rb); carBodies.delete(key); }
	}

	const ctl = { throttle: 0, brake: 0, steer: 0, hand: 0 };
	let steerNow = 0, acc = 0;
	function step(dt) {
		const p = body.translation();
		if (Math.abs(p.x - gx) > 25 || Math.abs(p.z - gz) > 25) regrid(p.x, p.z);
		cars(p.x, p.z, dt);
		acc += Math.min(dt, 0.1);
		let n = 0;
		while (acc >= world.timestep && n < 4) {
			acc -= world.timestep; n++;
			const v = V.currentVehicleSpeed();
			// steering: quicker at a crawl, gentler at speed
			const lim = F.steer / (1 + Math.abs(v) / 22);
			steerNow += (ctl.steer * lim - steerNow) * Math.min(1, world.timestep * 6);
			V.setWheelSteering(0, steerNow); V.setWheelSteering(1, steerNow);
			// the engine: its force falling away toward the top speed; backwards when stopped and braking
			const fwd = ctl.throttle, rev = ctl.brake > 0 && v < 0.8;
			let force = fwd * F.power * Math.max(0, 1 - Math.max(0, v) / F.top);
			if (rev) force = -ctl.brake * F.power * 0.5 * Math.max(0, 1 + v / 8);
			const brake = (!rev && ctl.brake > 0 ? ctl.brake * F.brake : 0) + (fwd === 0 && ctl.brake === 0 ? F.brake * 0.04 : 0);
			for (let i = 0; i < 4; i++) {
				const front = i < 2, driven = F.drive === 'all' || (F.drive === 'front') === front;
				V.setWheelEngineForce(i, driven ? force / (F.drive === 'all' ? 4 : 2) : 0);
				V.setWheelBrake(i, brake + (!front && ctl.hand ? F.brake : 0));
			}
			V.updateVehicle(world.timestep);
			world.step();
			// what the height field and boxes miss (walls, fences, rocks the world knows)
			pushOut();
		}
	}
	const probe = { x: 0, y: 0, z: 0 };
	function pushOut() {
		if (!env.push) return;
		const t = body.translation(), r = body.rotation(), yaw = 2 * Math.atan2(r.y, r.w), c = Math.cos(yaw), s = Math.sin(yaw);
		let mx = 0, mz = 0;
		for (const [lx, lz] of [[S.W / 2, S.L / 2 - 0.3], [-S.W / 2, S.L / 2 - 0.3], [S.W / 2, -S.L / 2 + 0.3], [-S.W / 2, -S.L / 2 + 0.3], [0, S.L / 2], [0, -S.L / 2]]) {
			probe.x = t.x + lx * c + lz * s; probe.z = t.z - lx * s + lz * c; probe.y = t.y + 1.2;
			const ox = probe.x, oz = probe.z;
			env.push(probe, t.y - 0.1);
			if (Math.abs(probe.x - ox) > Math.abs(mx)) mx = probe.x - ox;
			if (Math.abs(probe.z - oz) > Math.abs(mz)) mz = probe.z - oz;
		}
		if (mx || mz) {
			body.setTranslation({ x: t.x + mx, y: t.y, z: t.z + mz }, true);
			const v = body.linvel(), l = Math.hypot(mx, mz), nx = mx / l, nz = mz / l, into = v.x * nx + v.z * nz;
			if (into < 0) body.setLinvel({ x: v.x - into * nx * 1.3, y: v.y, z: v.z - into * nz * 1.3 }, true);
		}
	}
	// the car's pose now, and its wheels
	function pose() {
		const t = body.translation(), r = body.rotation();
		const wheels = [];
		for (let i = 0; i < 4; i++) wheels.push({ spin: V.wheelRotation(i) || 0, steer: V.wheelSteering(i) || 0, compress: (V.wheelSuspensionLength(i) ?? rest) - rest, contact: V.wheelIsInContact(i) });
		return { p: [t.x, t.y - 0.05 + S.wr - S.wr, t.z], q: [r.x, r.y, r.z, r.w], speed: V.currentVehicleSpeed(), wheels };
	}
	// put it back on the ground, the right way up (after a roll, or a teleport)
	function reset(x, z, yaw) {
		const y = env.floorAt(x, z, 1e4) + S.wr + 0.4;
		body.setTranslation({ x, y, z }, true);
		body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
		body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true);
		regrid(x, z);
	}
	regrid(start.x, start.z);
	function dispose() { world.free(); }
	return { step, pose, ctl, reset, dispose, body, kind, spec: S, feel: F };
}
