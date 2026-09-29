// The people in the cars, and whose cars they are.
//
// Every car has someone at the wheel. Close by, it is a real person (the game's MakeHuman
// bodies, people/body.js and motion.js) sitting in the driver's seat, hands on the wheel,
// with a passenger now and then; further off, a dark head and shoulders (fleet.js).
//
// Every parked car belongs to somebody: its space on the street is its id, and its owner
// is a member of the household in the building nearest it (the same ids every visit, from
// where things are, not chance). Whether the car is there depends on its owner's day
// (people/flow.js's idea of a place and an hour): people in the neighbourhoods drive to
// work in the morning and home again in the evening, the cars outside shops and offices
// come and go with the crowd. Far from you, or out of sight, a car simply is or is not in
// its space. Near you it happens: an owner comes out of their door, walks to their car,
// gets in and drives off; later a car turns up, parks, and its driver gets out, walks to
// their door and goes in. Only what is near is simulated; everything else is worked out.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { fadePerson } from '../people/fade.js';
import { zoneOf, crowd } from '../people/flow.js';
import { specOf, seatsOf } from '../bay/cars.js';

const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const frac = (h) => ((Math.imul(h ^ (h >>> 15), 2246822519) ^ (h >>> 13)) >>> 0) / 4294967296;

export function createLife({ scene, world, camera, isPhone }) {
	const group = new THREE.Group();
	group.name = 'car-people';
	scene.add(group);
	let A = null, loading = false;
	const DRIVERS = isPhone ? 2 : 5, WALKERS = isPhone ? 1 : 2;

	// ---------- bodies ----------
	// a small cache of people, by who they are (so a driver seen again is the same person)
	const bodies = new Map();                  // seed -> body
	let buildT = 0;
	function body(seed, now) {
		let b = bodies.get(seed);
		if (b) { b.used = now; return b; }
		if (!A || now - buildT < 0.35) return null;
		buildT = now;
		// (one at a time, and old ones let go)
		if (bodies.size >= DRIVERS + WALKERS + 3) {
			let old = null;
			for (const q of bodies.values()) if (!q.busy && (!old || q.used < old.used)) old = q;
			if (old) { old.wrap.removeFromParent(); old.P.root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); bodies.delete(old.seed); }
		}
		const P = buildPerson(A, personDNA(seed, { age: 19 + frac(seed) * 58 }));
		const wrap = new THREE.Group();
		wrap.matrixAutoUpdate = false;
		wrap.add(P.root);
		group.add(wrap);
		b = { seed, P, wrap, used: now, busy: false, floor: 0, mode: 'car' };
		// the ground under them: the car's floor while in it, the street's when out
		const W = () => world();
		b.M = createMotion(P, (x, z) => b.mode === 'car' ? b.floor : groundAt(W(), x, z, b.M ? b.M.S.pos.y : undefined));
		P.root.visible = false;
		bodies.set(seed, b);
		return b;
	}
	function groundAt(W, x, z, y) {
		const g = W.island.heightAt(x, z), f = W.island.extraFloor?.(x, z, y === undefined ? g + 1.2 : y + 1.0) ?? -1e9;
		return f > g && f < g + 1.5 ? f : g;
	}
	// sat in a car: in the car's own frame, the seat's front edge [x, y, z]
	function seat(b, kind, i) {
		const S = specOf(kind), C = seatsOf(kind), s = C.seats[Math.min(i, C.seats.length - 1)];
		b.mode = 'car'; b.floor = (S.clear ?? 0.3) + 0.1;
		b.M.place(s[0], b.floor, s[2] - 0.22, 0);
		b.M.sit(s[1] - 0.04 - b.floor, true);
		b.M.setPose(i === 0 ? 'drive' : 'lap');
		b.M.want.speed = 0; b.M.want.heading = 0;
		b.P.root.visible = true; fadePerson(b.P, 1);
	}
	// one step of a body: in a car it is posed in the car's frame and carried by it
	const I = new THREE.Matrix4();
	function step(b, dt, t, carMatrix) {
		if (b.mode === 'car') {
			b.wrap.matrix.copy(I); b.wrap.matrixWorld.copy(I);
			b.M.update(dt, t, null);
			b.wrap.matrix.copy(carMatrix);
			b.wrap.matrixWorld.copy(carMatrix);
		} else {
			b.wrap.matrix.copy(I); b.wrap.matrixWorld.copy(I);
			b.M.update(dt, t, camera.position);
		}
	}

	// ---------- drivers in the traffic ----------
	const seated = new Map();                  // car -> [bodies]
	function traffic(dt, t, cam) {
		const S = world().street;
		if (!S) return;
		const near = S.cars.filter((c) => c.matrix && c.tier === 0).map((c) => [Math.hypot(c.px - cam.x, c.pz - cam.z), c]).sort((a, b) => a[0] - b[0]).slice(0, DRIVERS).map((q) => q[1]);
		for (const [c, bs] of seated) if (!near.includes(c) || !S.cars.includes(c)) { for (const b of bs) { b.busy = false; b.P.root.visible = false; } seated.delete(c); c.seated = false; }
		let budget = DRIVERS;
		for (const c of near) {
			const need = Math.min(c.riders || 1, 3);
			let bs = seated.get(c);
			if (!bs) { if (budget < need) continue; seated.set(c, bs = []); }
			// (everyone in the car at once, or the silhouettes stay until they all are)
			while (bs.length < need) { const b = body(hashS(c.id + ':' + bs.length), t); if (!b || b.busy) break; b.busy = true; seat(b, c.kind, bs.length); b.P.root.visible = false; bs.push(b); }
			budget -= need;
			const all = bs.length === need;
			c.seated = all;
			for (const b of bs) { b.P.root.visible = all; if (all) step(b, dt, t, c.matrix); }
			if (budget <= 0) break;
		}
	}

	// ---------- owners ----------
	// a parked space's owner and their day: [household, member, kind of place]
	function ownerOf(car) {
		const W = world(), key = Math.round(car.x) + ':' + Math.round(car.z);
		let home = null;
		if (W.real?.loaded?.()) { let bd = 1e9; for (const bx of W.real.near('boxes', car.x, car.z, 40)) { const d = Math.hypot(bx.x - car.x, bx.z - car.z); if (d < bd) { bd = d; home = bx; } } }
		const U = W.bayArea?.urbanAt?.(car.x, car.z);
		const zone = zoneOf(U);
		const house = home ? hashS(Math.round(home.x) + ',' + Math.round(home.z)) : hashS('b' + Math.round(car.x / 40) + ',' + Math.round(car.z / 40));
		return { key, id: house * 4 + (hashS(key) & 3), house, home, zone };
	}
	// is the owner's car in its space at this hour?
	function present(o, hours) {
		const r = frac(o.id);
		if (o.zone === 'neighbourhood' || o.zone === 'quiet') {
			// a household's car: out at work (most of them) from mid-morning to early evening
			if (r > 0.62) return true;
			const leave = 7 + frac(o.id ^ 77) * 2.2, back = 16.3 + frac(o.id ^ 91) * 3;
			return hours < leave || hours > back;
		}
		// outside shops, offices, restaurants: a visitor's, there for a while when the place is busy
		const slot = Math.floor(hours * 2), k = crowd(o.zone, hours).k;
		return frac(o.id ^ Math.imul(slot, 2654435761)) < 0.25 + k * 0.7;
	}
	// the door they go in and out by: on the face of their building nearest the car
	function doorOf(o, car) {
		const b = o.home;
		if (!b) { const sx = Math.cos(car.yaw), sz = -Math.sin(car.yaw), side = frac(o.id) < 0.5 ? 1 : -1; return [car.x + sx * side * 9, car.z + sz * side * 9]; }
		const ca = Math.cos(b.a), sa = Math.sin(b.a), dx = car.x - b.x, dz = car.z - b.z;
		let lx = ca * dx + sa * dz, lz = -sa * dx + ca * dz;
		const hw = b.w / 2, hd = b.d / 2;
		lx = Math.max(-hw, Math.min(hw, lx)); lz = Math.max(-hd, Math.min(hd, lz));
		if (Math.abs(Math.abs(lx) - hw) < Math.abs(Math.abs(lz) - hd)) lx = Math.sign(lx || 1) * (hw + 0.4); else lz = Math.sign(lz || 1) * (hd + 0.4);
		return [b.x + ca * lx - sa * lz, b.z + sa * lx + ca * lz];
	}

	// ---------- the episodes: someone leaving in their car, or coming home in it ----------
	const episodes = [], shown = new Map();     // space key -> the car is shown in its space
	let scanT = 0, errandT = 0;
	const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere();
	const inView = (x, y, z) => { camera.updateMatrixWorld(); pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv); sph.center.set(x, y + 1, z); sph.radius = 3; return frustum.intersectsSphere(sph); };
	const busySpace = (key) => episodes.some((e) => e.o.key === key);
	function hours() { return world().sky?.state?.hours ?? 12; }
	// start one: 'leave' or 'arrive', for the car in a space (car: from street.parkedNear)
	function begin(kind, car, o) {
		if (episodes.length >= (isPhone ? 1 : 2)) return false;
		const door = doorOf(o, car), S = specOf(car.kind);
		const E = { kind, car, o, door, t: 0, phase: kind === 'leave' ? 'walk-out' : 'drive-in', matrix: new THREE.Matrix4(), spin: 0, steer: 0, pos: [car.x, car.z], yaw: car.yaw, v: 0, len: S.L };
		// the driver's door, a step out from the car's left side
		const C = seatsOf(car.kind), s = C.seats[0], sx = Math.cos(car.yaw), sz = -Math.sin(car.yaw), fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
		E.side = [car.x + sx * (S.W / 2 + 0.45) + fx * (s[2] - 0.25), car.z + sz * (S.W / 2 + 0.45) + fz * (s[2] - 0.25)];
		// (arrivals come up the street from well behind the space, a lane out from the kerb)
		const kerb = pullSide(car);
		E.lane = [sx * kerb * 2.4, sz * kerb * 2.4]; E.kerb = kerb;
		if (kind === 'arrive') { E.pos = [car.x - fx * 110 + E.lane[0], car.z - fz * 110 + E.lane[1]]; world().street.hide(car.id, true); }
		episodes.push(E);
		return true;
	}
	// which way the road is from a car at the kerb (+1: its left)
	function pullSide(car) {
		const W = world(), sx = Math.cos(car.yaw), sz = -Math.sin(car.yaw);
		const roads = W.real?.loaded?.() ? W.real.near('roads', car.x, car.z, 30) : [];
		let best = 0, bd = 1e9;
		for (const r of roads) for (let i = 0; i + 1 < r.pts.length; i += 2) { const d = Math.hypot(r.pts[i] - car.x, r.pts[i + 1] - car.z); if (d < bd) { bd = d; best = (r.pts[i] - car.x) * sx + (r.pts[i + 1] - car.z) * sz; } }
		return best >= 0 ? 1 : -1;
	}
	function walkTo(b, x, z) {
		const S = b.M.S, dx = x - S.pos.x, dz = z - S.pos.z, d = Math.hypot(dx, dz);
		b.M.want.heading = Math.atan2(dx, dz); b.M.want.speed = d > 0.4 ? Math.min(b.P.dna.gait.pace, d * 1.5) : 0;
		return d;
	}
	function carAt(E, x, z, yaw) { E.pos = [x, z]; E.yaw = yaw; world().street.carMatrix(E.matrix, E.car.kind, x, z, yaw); }
	function run(E, dt, t, cam) {
		const W = world(), car = E.car, St = W.street;
		const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
		if (!E.b) { E.b = body(hashS('owner' + E.o.id), t); if (!E.b) return E.wait = (E.wait || 0) + dt, E.wait < 20; if (E.b.busy) { E.b = null; return true; } E.b.busy = true; E.t = 0; }
		E.t += dt;
		const b = E.b;
		switch (E.phase) {
			case 'walk-out': {
				// out of their door (fading in as they come through it), to the car
				if (!E.placed) { E.placed = true; b.mode = 'walk'; b.M.stand(); b.M.S.sitK.v = 0; b.M.setPose('rest'); b.M.place(E.door[0], groundAt(W, E.door[0], E.door[1]), E.door[1], Math.atan2(E.side[0] - E.door[0], E.side[1] - E.door[1])); E.fade = 0; }
				E.fade = Math.min(1, E.fade + dt * 1.4); fadePerson(b.P, E.fade);
				step(b, dt, t, null);
				if (walkTo(b, E.side[0], E.side[1]) < 0.5 || E.t > 60) { E.phase = 'get-in'; E.t = 0; }
				break;
			}
			case 'get-in': {
				// turn to the car, sit down into it; then they are in and the car is theirs to move
				b.M.want.speed = 0; b.M.want.heading = car.yaw - Math.PI / 2 + Math.PI;
				if (E.t > 0.6) b.M.sit(specOf(car.kind).hip - 0.05);
				step(b, dt, t, null);
				if (E.t > 1.6) {
					St.hide(car.id, true); shown.set(E.o.key, false);
					carAt(E, car.x, car.z, car.yaw);
					seat(b, car.kind, 0);
					E.phase = 'pull-out'; E.t = 0; E.s = 0;
				}
				break;
			}
			case 'pull-out': {
				// ease out of the space into the lane and away down the street
				E.v = Math.min(10, E.v + dt * (E.t < 1 ? 0 : 1.8));
				E.s += E.v * dt;
				const k = Math.min(1, E.s / 9), ease = k * k * (3 - 2 * k);
				const x = car.x + fx * E.s + E.lane[0] * ease, z = car.z + fz * E.s + E.lane[1] * ease;
				const yaw = car.yaw + E.kerb * Math.atan(2.4 * 6 * k * (1 - k) / 9);
				E.spin += E.v * dt / (specOf(car.kind).wr || 0.34);
				carAt(E, x, z, yaw);
				step(b, dt, t, E.matrix);
				const d = Math.hypot(x - cam.x, z - cam.z);
				if (d > 110 || (d > 55 && !inView(x, 0, z)) || E.s > 400) return false;
				break;
			}
			case 'drive-in': {
				// up the street, slowing, and into the space
				if (b.mode !== 'car') seat(b, car.kind, 0);
				const tx = car.x, tz = car.z;
				const along = (E.pos[0] - tx) * fx + (E.pos[1] - tz) * fz;                         // negative: still behind the space
				E.v = Math.max(1.2, Math.min(9, -along * 0.35));
				const s2 = Math.min(0, along + E.v * dt);
				const k = Math.max(0, Math.min(1, 1 + s2 / 9)), ease = k * k * (3 - 2 * k);
				const x = tx + fx * s2 + E.lane[0] * (1 - ease), z = tz + fz * s2 + E.lane[1] * (1 - ease);
				E.spin += E.v * dt / (specOf(car.kind).wr || 0.34);
				carAt(E, x, z, car.yaw - E.kerb * Math.atan(2.4 * 6 * k * (1 - k) / 9));
				step(b, dt, t, E.matrix);
				if (s2 >= -0.02) { E.phase = 'park'; E.t = 0; carAt(E, tx, tz, car.yaw); }
				break;
			}
			case 'park': {
				step(b, dt, t, E.matrix);
				if (E.t > 1.2) {
					// out of the car: standing up beside it, the car back in its space
					St.hide(car.id, false); shown.set(E.o.key, true);
					b.mode = 'walk';
					b.M.place(E.side[0], groundAt(W, E.side[0], E.side[1]), E.side[1], car.yaw + Math.PI / 2);
					b.M.sit(specOf(car.kind).hip - 0.05, true); b.M.setPose('rest');
					E.phase = 'walk-in'; E.t = 0; E.fade = 1;
				}
				break;
			}
			case 'walk-in': {
				if (E.t > 0.3) b.M.stand();
				step(b, dt, t, null);
				const d = E.t > 1.1 ? walkTo(b, E.door[0], E.door[1]) : 9;
				// through their door: gone in
				if (d < 0.7 || E.t > 70) { E.fade -= dt * 1.5; fadePerson(b.P, E.fade); if (E.fade <= 0) return false; }
				break;
			}
		}
		return true;
	}
	function endEpisode(E) {
		if (E.b) { E.b.busy = false; E.b.P.root.visible = false; }
		// a car that drove off stays away from its space until its owner is back
		if (E.phase === 'pull-out' || E.phase === 'get-in') { world().street?.hide(E.car.id, true); shown.set(E.o.key, false); }
		if (E.phase === 'drive-in') { world().street?.hide(E.car.id, false); shown.set(E.o.key, true); }
	}

	// every so often: the spaces near you, against their owners' days
	function scan(cam) {
		const W = world(), St = W.street;
		if (!St) return;
		const h = hours();
		for (const car of St.parkedNear(cam.x, cam.z, 130, true)) {
			if (busySpace(Math.round(car.x) + ':' + Math.round(car.z))) continue;
			const o = car.owner || (car.owner = ownerOf(car));
			const want = present(o, h), d = Math.hypot(car.x - cam.x, car.z - cam.z), vis = d < 90 && inView(car.x, car.y, car.z);
			// (a space met for the first time, out of sight or far off: as its owner's day has it)
			if (!shown.has(o.key) && (d > 60 || !vis)) shown.set(o.key, want);
			const now = shown.has(o.key) ? shown.get(o.key) : true;
			if (want === now) { St.hide(car.id, !want); continue; }
			// in sight and near: it happens in front of you; otherwise it simply is so
			if (vis && d > 8 && d < 70 && begin(want ? 'arrive' : 'leave', car, o)) continue;
			if (!vis) { St.hide(car.id, !want); shown.set(o.key, want); }
		}
	}
	// and the errands: now and then, someone near you pops out in their car (and is back later)
	function errand(cam, t) {
		const St = world().street;
		if (!St || episodes.length) return;
		const bucket = Math.floor(t / 20);
		if (frac(bucket * 7919) > 0.55) return;
		const cands = St.parkedNear(cam.x, cam.z, 45).filter((c) => { const d = Math.hypot(c.x - cam.x, c.z - cam.z); return d > 10 && inView(c.x, c.y, c.z); });
		if (!cands.length) return;
		const car = cands[Math.floor(frac(bucket * 104729) * cands.length)];
		const o = car.owner || (car.owner = ownerOf(car));
		begin('leave', car, o);
	}

	let hooked = null, lastErr = null;
	function update(dt, t) {
		const W = world();
		// (a street built anew is sorted at once, before its cars are drawn)
		if (W?.street && hooked !== W.street) { hooked = W.street; W.street.onBuild = () => scan(camera.position); W.street.extra.push(draw); }
		if (!W?.street || !W.bayArea) return;
		const cam = camera.position;
		const high = cam.y - W.island.heightAt(cam.x, cam.z) > 200;
		group.visible = !high;
		if (high) return;
		if (!A && !loading) { loading = true; loadPeopleAssets().then((a) => { A = a; }).catch(() => {}); }
		if (!A) return;
		traffic(dt, t, cam);
		scanT -= dt; errandT -= dt;
		try {
			if (scanT < 0) { scanT = 1.5; scan(cam); }
			if (errandT < 0) { errandT = 5; errand(cam, t); }
		} catch (e) { lastErr = 'scan ' + String(e && e.stack || e).slice(0, 300); }
		for (let i = episodes.length - 1; i >= 0; i--) {
			let go = false;
			try { go = run(episodes[i], dt, t, cam); } catch (e) { lastErr = String(e && e.stack || e).slice(0, 300); }
			if (!go) { endEpisode(episodes[i]); episodes.splice(i, 1); }
		}
	}
	// the owners' cars on the move, for the street to draw with its traffic
	function draw(fleet, x, z) {
		for (const E of episodes) {
			if (E.phase !== 'pull-out' && E.phase !== 'drive-in' && E.phase !== 'park') continue;
			const c = E.car.col;
			const col = new THREE.Color(c[0], c[1], c[2]);
			fleet.add(E.car.kind, E.matrix, col, (E.pos[0] - x) ** 2 + (E.pos[1] - z) ** 2, { spin: E.spin, steer: 0, riders: 0 });
		}
	}
	// what cars there are that are not in the street's own lists (for bumping into)
	const moving = () => episodes.filter((E) => E.phase === 'pull-out' || E.phase === 'drive-in' || E.phase === 'park').map((E) => ({ kind: E.car.kind, x: E.pos[0], z: E.pos[1], y: E.matrix.elements[13], yaw: E.yaw }));
	const info = () => ({ err: lastErr, t: +(buildT || 0).toFixed(1), episodes: episodes.map((E) => E.kind + ':' + E.phase + ':' + E.car.kind), drivers: [...seated.values()].reduce((a, b) => a + b.length, 0), bodies: bodies.size });
	return { update, draw, moving, info, episodes, begin, ownerOf, present, group };
}
