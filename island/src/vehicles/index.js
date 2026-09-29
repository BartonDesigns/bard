// Vehicles: the cars you walk among and the one you drive.
//
// Solid cars: every car, parked or moving, is a rounded box you walk round, not through;
// its roof is somewhere to stand only if you come down on it from above (a jump), never a
// step you are lifted onto by walking into its side. The traffic slows and stops for you.
// The people in the cars and whose cars they are: life.js. Your own car: drive.js starts it
// here (you take the parked car beside you, or one of your own), physics.js drives it.

import * as THREE from 'three';
import { specOf, seatsOf } from '../bay/cars.js';
import { createLife } from './life.js';
import { STATIC_CARS } from './registry.js';

const R = 0.3;                                   // a person's reach round their middle

export function createVehicles({ scene, world, camera, isPhone, people = () => null }) {
	const life = createLife({ scene, world, camera, isPhone });
	// your car, while you drive it or where you left it: { kind, col, matrix, x, y, z, yaw, spin, steer }
	const mine = { car: null };

	// every car near a point, as { kind, x, y, z, yaw }
	function carsNear(x, z, r) {
		const W = world(), S = W?.street, out = [];
		if (!S) return out;
		for (const c of S.parkedNear(x, z, r)) out.push(c);
		for (const c of S.cars) if (c.px !== undefined && Math.abs(c.px - x) < r && Math.abs(c.pz - z) < r) out.push({ kind: c.kind, x: c.px, y: c.py ?? 0, z: c.pz, yaw: c.yaw, id: c.id });
		for (const c of life.moving()) if (Math.abs(c.x - x) < r && Math.abs(c.z - z) < r) out.push(c);
		const m = mine.car;
		if (m && !mine.driving && Math.abs(m.x - x) < r && Math.abs(m.z - z) < r) out.push({ kind: m.kind, x: m.x, y: m.y, z: m.z, yaw: m.yaw, id: 'mine' });
		for (const c of STATIC_CARS) if (Math.abs(c.x - x) < r && Math.abs(c.z - z) < r) out.push(c);
		return out;
	}

	// a point in a car's frame: along (+ forward) and across (+ its left)
	const local = (c, x, z) => { const s = Math.sin(c.yaw), co = Math.cos(c.yaw), dx = x - c.x, dz = z - c.z; return [dx * s + dz * co, dx * co - dz * s]; };
	const world2 = (c, a, b) => { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); return [c.x + a * s + b * co, c.z + a * co - b * s]; };
	// push a person (p: their eye, footY: their feet) out of every car they are walking into
	function push(p, footY) {
		for (const c of carsNear(p.x, p.z, 8)) {
			const S = specOf(c.kind), top = c.y + (S.box !== undefined ? S.H : S.H);
			// (on the roof, or above it: not pushed; below the car, a bridge's underside: not either)
			if (footY > top - 0.35 || footY + 1.6 < c.y) continue;
			const hl = S.L / 2, hw = S.W / 2, rc = Math.min(0.4, hw * 0.4);
			const [a, b] = local(c, p.x, p.z);
			const qa = Math.max(-(hl - rc), Math.min(hl - rc, a)), qb = Math.max(-(hw - rc), Math.min(hw - rc, b));
			let da = a - qa, db = b - qb;
			const d = Math.hypot(da, db), need = rc + R;
			if (d >= need) continue;
			let na, nb;
			if (d < 1e-4) {
				// right inside: out by the nearest side
				const pen = [hl - a, a + hl, hw - b, b + hw], m = Math.min(...pen), k = pen.indexOf(m);
				na = k === 0 ? hl + R : k === 1 ? -hl - R : a; nb = k === 2 ? hw + R : k === 3 ? -hw - R : b;
			} else { da /= d; db /= d; na = qa + da * need; nb = qb + db * need; }
			[p.x, p.z] = world2(c, na, nb);
		}
	}
	// a car's roof as a floor, only for someone already up there (who jumped onto it)
	function floor(x, z, y) {
		let best = -1e9;
		for (const c of carsNear(x, z, 7)) {
			const S = specOf(c.kind), top = c.y + S.H - 0.03;
			if (y < top - 0.25) continue;
			const [a, b] = local(c, x, z);
			// the roof's own extent (the hood and deck are lower; a person on them stands on the roof line anyway)
			if (Math.abs(a - (S.rf + S.rr) / 2) < (S.rf - S.rr) / 2 + 0.15 && Math.abs(b) < S.W * 0.36) best = Math.max(best, top);
		}
		return best;
	}
	// the parked car beside you, to get into: the nearest within reach of a door
	function carToEnter(x, z) {
		let best = null, bd = 4.5;
		for (const c of carsNear(x, z, 8)) {
			if (!c.id || c.id.startsWith('tr')) continue;
			const S = specOf(c.kind), [a, b] = local(c, x, z), d = Math.hypot(Math.max(0, Math.abs(a) - S.L / 2), Math.max(0, Math.abs(b) - S.W / 2));
			if (d < bd) { bd = d; best = c; }
		}
		return best;
	}
	// where the traffic should stop: you, and the people on foot near the road
	function stops() {
		const W = world(), out = [];
		if (!W) return out;
		const P = W.player.state;
		if (!mine.driving) out.push({ x: P.pos.x, z: P.pos.z });
		else if (mine.car) out.push({ x: mine.car.x, z: mine.car.z });
		for (const p of people()?.pool || []) if (p.active) out.push({ x: p.M.S.pos.x, z: p.M.S.pos.z });
		return out;
	}
	let hooked = null;
	function update(dt, t) {
		const W = world();
		if (!W) return;
		if (W.street && hooked !== W.street) {
			hooked = W.street;
			W.street.setAvoid(stops);
			// your car is drawn with the traffic
			W.street.extra.push((fleet, x, z) => { const m = mine.car; if (m) fleet.add(m.kind, m.matrix, m.color, (m.x - x) ** 2 + (m.z - z) ** 2, { spin: m.spin, steer: m.steer, riders: 0 }); });
		}
		life.update(dt, t);
	}
	// your car: set where it is (while driving, from the physics; parked, where you left it)
	function setMine(kind, color, M, o = {}) {
		if (!kind) { mine.car = null; return; }
		const c = mine.car || (mine.car = { matrix: new THREE.Matrix4(), color: new THREE.Color() });
		c.kind = kind; c.color.copy(color); c.matrix.copy(M);
		const e = M.elements;
		c.x = e[12]; c.y = e[13]; c.z = e[14]; c.yaw = Math.atan2(e[8], e[10]);
		c.spin = o.spin || 0; c.steer = o.steer || 0;
		mine.driving = !!o.driving;
	}
	const info = () => ({ ...life.info(), mine: mine.car ? mine.car.kind + (mine.driving ? ' driving' : ' parked') : null });
	return { update, push, floor, carsNear, carToEnter, setMine, mine, life, info, seatsOf, specOf };
}
