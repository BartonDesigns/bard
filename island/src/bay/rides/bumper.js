// Bumper cars: a steel floor under a ceiling of wire grid, each car on its pole, rubber
// all round. Drive with the stick (or the arrow keys): push to go, pull to back up, left and
// right to turn the wheel. The others drive at you and at each other; every knock is a
// thump and a jolt, and the poles spark on the grid overhead.

import * as THREE from 'three';
import { DECK, merger, signBoard, bulbs, bulbMaterials } from './kit.js';

const HX = 17.5, HZ = 10.5, RAD = 1.02, FLOOR = DECK + 0.3, CEIL = DECK + 4.6, N = 14;
const COLS = [0xd8262e, 0x2a64c8, 0xf2c230, 0x2e9b57, 0xe8742a, 0x8a3cc0, 0x1bb5b5, 0xe85aa0, 0xf4f1ea, 0x222222];

function carGeometry(col) {
	const g = new THREE.Group(), C = merger();
	const rr = (w, d, r) => { const s = new THREE.Shape(), x = w / 2, z = d / 2; s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z); s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z); return s; };
	const body = new THREE.ExtrudeGeometry(rr(1.3, 1.95, 0.4), { depth: 0.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 6 });
	body.rotateX(-Math.PI / 2);
	C.geo(body, 'body', 0, 0.2, 0);
	const ring = rr(2.1, 2.6, 0.7); ring.holes.push(rr(1.34, 2.0, 0.42));
	const bump = new THREE.ExtrudeGeometry(ring, { depth: 0.26, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 8 });
	bump.rotateX(-Math.PI / 2);
	C.geo(bump, 'rubber', 0, 0.1, 0);
	// the seat, the wheel on its column, the pole at the back up to the grid
	C.box(0.95, 0.18, 0.55, 'seat', 0, 0.78, -0.45).box(0.95, 0.55, 0.12, 'seat', 0, 1.05, -0.72);
	C.rod([0, 0.72, 0.62], [0, 1.02, 0.28], 0.035, 'darksteel');
	C.box(1.0, 0.12, 0.3, 'body', 0, 0.76, 0.75);
	C.rod([0, 1.0, -0.95], [0, CEIL - FLOOR - 0.25, -0.95], 0.035, 'steel');
	C.rod([-0.2, CEIL - FLOOR - 0.12, -0.95], [0.2, CEIL - FLOOR - 0.12, -0.95], 0.03, 'chrome');
	const paints = { body: new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.15 }) };
	C.done(g, { shadow: false, paints });
	const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }));
	wheel.position.set(0, 1.04, 0.26); wheel.rotation.x = -0.9;
	g.add(wheel);
	g.userData.wheel = wheel;
	return g;
}
function gridTexture() {
	const cv = document.createElement('canvas'); cv.width = cv.height = 128;
	const g = cv.getContext('2d');
	g.clearRect(0, 0, 128, 128);
	g.strokeStyle = 'rgba(40,40,44,1)'; g.lineWidth = 3;
	for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
	const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(HX * 2 / 1.2, HZ * 2 / 1.2);
	return t;
}
function floorTexture() {
	const cv = document.createElement('canvas'); cv.width = cv.height = 256;
	const g = cv.getContext('2d');
	g.fillStyle = '#6d7177'; g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 1); }
	g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 2;
	for (let i = 0; i <= 256; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
	const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(HX / 2, HZ / 2); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

export function createBumper({ group, sound, isPhone, at: [U, V] }) {
	const root = new THREE.Group();
	root.name = 'bumper-cars';
	root.position.set(U, 0, V);
	group.add(root);
	// ---------- the pavilion ----------
	const Mg = merger(), lights = bulbs();
	const fl = new THREE.Mesh(new THREE.BoxGeometry(HX * 2 + 1.2, 0.3, HZ * 2 + 1.2), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.35, metalness: 0.6 }));
	fl.position.set(0, DECK + 0.15, 0); fl.receiveShadow = true;
	root.add(fl);
	// the padded wall round the floor, with the gate
	for (const [w, d, x, z] of [[HX * 2 + 1.2, 0.3, 0, -HZ - 0.45], [0.3, HZ * 2 + 1.2, -HX - 0.45, 0], [0.3, HZ * 2 + 1.2, HX + 0.45, 0], [HX - 1.6, 0.3, -HX / 2 - 0.8, HZ + 0.45], [HX - 1.6, 0.3, HX / 2 + 0.8, HZ + 0.45]]) {
		Mg.box(w, 0.55, d, 'yellow', x, FLOOR + 0.28, z);
		Mg.box(w + 0.02, 0.14, d + 0.02, 'rubber', x, FLOOR + 0.2, z);
	}
	// posts, the roof, the grid
	for (let i = 0; i <= 6; i++) for (const z of [-HZ - 1.2, HZ + 1.2]) Mg.box(0.3, CEIL - DECK + 0.9, 0.3, 'white', -HX - 1.2 + i * (HX * 2 + 2.4) / 6, DECK + (CEIL - DECK + 0.9) / 2, z);
	for (let i = 1; i < 4; i++) for (const x of [-HX - 1.2, HX + 1.2]) Mg.box(0.3, CEIL - DECK + 0.9, 0.3, 'white', x, DECK + (CEIL - DECK + 0.9) / 2, -HZ - 1.2 + i * (HZ * 2 + 2.4) / 4);
	const top = CEIL + 0.9;
	Mg.box(HX * 2 + 4, 0.3, HZ * 2 + 4, 'white', 0, top + 0.15, 0);
	Mg.box(HX * 2 + 4.2, 1.2, 0.2, 'red', 0, top - 0.3, HZ + 2.1).box(HX * 2 + 4.2, 1.2, 0.2, 'red', 0, top - 0.3, -HZ - 2.1);
	Mg.box(0.2, 1.2, HZ * 2 + 4.2, 'red', -HX - 2.1, top - 0.3, 0).box(0.2, 1.2, HZ * 2 + 4.2, 'red', HX + 2.1, top - 0.3, 0);
	// a low hipped roof over it
	const roof = new THREE.ConeGeometry(Math.hypot(HX + 2.4, HZ + 2.4), 3.2, 4, 1);
	roof.rotateY(Math.PI / 4); roof.scale((HX + 2.4) / Math.hypot(HX + 2.4, HZ + 2.4) * Math.SQRT2, 1, (HZ + 2.4) / Math.hypot(HX + 2.4, HZ + 2.4) * Math.SQRT2);
	Mg.geo(roof, 'tile', 0, top + 1.9, 0);
	Mg.done(root, { shadow: !isPhone });
	const grid = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), new THREE.MeshStandardMaterial({ map: gridTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.4 }));
	grid.rotation.x = Math.PI / 2; grid.position.y = CEIL;
	root.add(grid);
	const sign = signBoard('BUMPER CARS', 12, 1.3, { bg: '#1e3c8c', fg: '#ffe066', border: '#ffffff', glow: 0.3 });
	sign.position.set(0, top + 1.1, HZ + 2.25);
	root.add(sign);
	for (let i = 0; i <= 44; i++) { const x = -HX - 2 + i * (HX * 2 + 4) / 44; lights.add(x, top + 0.35, HZ + 2.25, i % 2 ? [1, 0.4, 0.3] : [1, 0.85, 0.5]); lights.add(x, top - 0.95, HZ + 2.25, i % 2 ? [1, 0.85, 0.5] : [0.5, 0.8, 1]); }
	const lit = lights.done(root, 0.8);

	// ---------- the cars ----------
	const cars = [];
	for (let i = 0; i < N; i++) {
		const g = carGeometry(COLS[i % COLS.length]);
		root.add(g);
		const a = i / N * Math.PI * 2;
		cars.push({ g, x: Math.cos(a) * HX * 0.6, z: Math.sin(a) * HZ * 0.55, vx: 0, vz: 0, h: a + Math.PI / 2, steer: 0, thr: 0, tgt: null, t: Math.random() * 3, stuck: 0, rev: 0, spark: 0 });
	}
	// sparks at the poles' shoes
	const spG = new THREE.BufferGeometry();
	spG.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
	spG.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
	const spM = new THREE.PointsMaterial({ map: bulbMaterials().tex, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, toneMapped: false });
	const sparks = new THREE.Points(spG, spM);
	sparks.frustumCulled = false;
	root.add(sparks);

	const S = { run: true, timer: 50, rider: -1, jolt: 0, joltV: new THREE.Vector3(), done: false };
	function step(dt, ctl) {
		S.timer -= dt;
		if (S.rider < 0 && S.timer <= 0) { S.run = !S.run; S.timer = S.run ? 60 : 18; }
		if (S.rider >= 0 && S.timer <= 0 && S.run) { S.run = false; S.done = true; }
		for (let i = 0; i < N; i++) {
			const c = cars[i];
			if (!S.run) { c.thr = 0; c.steer *= 0.9; }
			else if (i === S.rider) { c.thr = ctl.y; c.steer = ctl.x; }
			else {
				// after someone, or off round the floor; backing out when stuck on the wall
				c.t -= dt;
				if (c.t <= 0 || !c.tgt) { c.t = 2 + Math.random() * 4; c.tgt = Math.random() < (S.rider >= 0 ? 0.45 : 0) ? S.rider : Math.random() < 0.5 ? Math.floor(Math.random() * N) : { x: (Math.random() - 0.5) * HX * 1.6, z: (Math.random() - 0.5) * HZ * 1.6 }; if (c.tgt === i) c.tgt = null; }
				const T = typeof c.tgt === 'number' ? cars[c.tgt] : c.tgt;
				if (T) {
					let d = Math.atan2(T.x - c.x, T.z - c.z) - c.h;
					d = Math.atan2(Math.sin(d), Math.cos(d));
					c.steer = -Math.max(-1, Math.min(1, d * 1.6));
					c.thr = c.rev > 0 ? -0.8 : 0.85;
				}
				const sp = Math.hypot(c.vx, c.vz);
				c.stuck = sp < 0.4 && c.thr > 0 ? c.stuck + dt : 0;
				if (c.stuck > 1.2) { c.rev = 1.0; c.stuck = 0; }
				c.rev -= dt;
			}
			// the car: pushes along its heading, slides little sideways
			const fx = Math.sin(c.h), fz = Math.cos(c.h);
			let vf = c.vx * fx + c.vz * fz, vl = c.vx * fz - c.vz * fx;
			vf += (c.thr * 4.2 - vf * 0.9) * dt;
			vl -= vl * Math.min(1, dt * 5);
			c.h -= c.steer * 2.3 * dt * (0.35 + Math.min(1, Math.abs(vf) / 1.8)) * (vf < -0.1 ? -1 : 1);
			const nx = Math.sin(c.h), nz = Math.cos(c.h);
			c.vx = nx * vf + nz * vl; c.vz = nz * vf - nx * vl;
			c.x += c.vx * dt; c.z += c.vz * dt;
			// the rubber on the wall
			for (const [ax, lim] of [['x', HX - RAD], ['z', HZ - RAD]]) {
				const vk = ax === 'x' ? 'vx' : 'vz';
				if (Math.abs(c[ax]) > lim) { c[ax] = Math.sign(c[ax]) * lim; if (c[vk] * Math.sign(c[ax]) > 0) { const hit = Math.abs(c[vk]); c[vk] *= -0.45; bumped(i, -1, hit, ax === 'x' ? Math.sign(c.x) : 0, ax === 'z' ? Math.sign(c.z) : 0); } }
			}
			c.spark = Math.max(0, c.spark - dt * 4);
			if (Math.random() < dt * (0.3 + Math.hypot(c.vx, c.vz) * 0.6)) c.spark = 0.6 + Math.random() * 0.8;
		}
		// car on car: equal masses, bouncy rubber
		for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
			const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
			if (d >= RAD * 2 || d < 1e-4) continue;
			const nx = dx / d, nz = dz / d, pen = RAD * 2 - d;
			a.x -= nx * pen / 2; a.z -= nz * pen / 2; b.x += nx * pen / 2; b.z += nz * pen / 2;
			const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
			if (vn >= 0) continue;
			const jj = -(1 + 0.6) * vn / 2;
			a.vx -= jj * nx; a.vz -= jj * nz; b.vx += jj * nx; b.vz += jj * nz;
			bumped(i, j, -vn, nx, nz);
		}
	}
	let listener = null;
	function bumped(i, j, hit, nx, nz) {
		if (hit < 0.3) return;
		const me = S.rider, near = me >= 0 && (i === me || j === me);
		const d = listener ? Math.hypot(cars[i].x - listener.x, cars[i].z - listener.z) : 30;
		const k = near ? 1 : Math.max(0, 1 - d / 40);
		if (k > 0.02) sound.thump(Math.min(0.6, hit * 0.2) * k);
		if (near) { S.jolt = Math.min(1, hit * 0.35); S.joltV.set(i === me ? -nx : nx, 0, i === me ? -nz : nz); }
		cars[i].spark = cars[j >= 0 ? j : i].spark = 1.4;
	}
	const pos = spG.attributes.position.array, col = spG.attributes.color.array;
	function place(night) {
		for (let i = 0; i < N; i++) {
			const c = cars[i];
			c.g.position.set(c.x, FLOOR, c.z); c.g.rotation.y = c.h;
			c.g.userData.wheel.rotation.z = -c.steer * 1.4;
			const px = c.x - Math.sin(c.h) * 0.95, pz = c.z - Math.cos(c.h) * 0.95;
			pos[i * 3] = px; pos[i * 3 + 1] = CEIL - 0.05; pos[i * 3 + 2] = pz;
			const k = c.spark * (Math.random() < 0.6 ? 1 : 0.3) * (0.5 + night);
			col[i * 3] = 0.6 * k; col[i * 3 + 1] = 0.75 * k; col[i * 3 + 2] = 1.0 * k;
		}
		spG.attributes.position.needsUpdate = true; spG.attributes.color.needsUpdate = true;
	}
	// ---------- riding ----------
	const eye = new THREE.Vector3(), q = new THREE.Quaternion(), cq = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
	let camInit = false, crackT = 0;
	function pose(dt, t, out, ctl) {
		listener = cars[S.rider];
		step(dt, ctl); place(1);
		const c = cars[S.rider];
		S.jolt *= Math.max(0, 1 - dt * 5);
		const jx = S.joltV.x * S.jolt * 0.25, jz = S.joltV.z * S.jolt * 0.25;
		eye.set(c.x + Math.sin(c.h) * -0.35 + jx, FLOOR + 1.62 + Math.sin(t * 40) * S.jolt * 0.04, c.z + Math.cos(c.h) * -0.35 + jz);
		out.pos.copy(eye).applyMatrix4(root.matrix);
		q.setFromAxisAngle(Y, c.h + Math.PI + root.rotation.y).multiply(new THREE.Quaternion().setFromAxisAngle(X, -0.22));
		if (!camInit) { cq.copy(q); camInit = true; }
		cq.slerp(q, Math.min(1, dt * 10));
		out.quat.copy(cq);
		out.fov = 75;
		crackT -= dt;
		if (crackT < 0 && S.run) { crackT = 0.2 + Math.random() * 0.8; sound.crackle(0.05 + Math.hypot(c.vx, c.vz) * 0.02); }
		return !S.done;
	}
	function begin() {
		// the car nearest the gate is yours; a new session starts
		let best = 0, bd = 1e9;
		for (let i = 0; i < N; i++) { const d = Math.hypot(cars[i].x, cars[i].z - HZ); if (d < bd) { bd = d; best = i; } }
		S.rider = best; S.run = true; S.timer = 75; S.done = false; camInit = false;
		const c = cars[best]; c.x = 0; c.z = HZ - 2; c.h = Math.PI; c.vx = c.vz = 0;
		for (const o of cars) o.tgt = null;
		return true;
	}
	const riders = {
		count: N,
		at(i, m) { if (i === S.rider) return null; const c = cars[i]; return m.makeRotationY(c.h).setPosition(c.x, FLOOR + 0.6, c.z - 0).premultiply(root.matrix).multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.5)); },
		sit: 0.25, pose: 'table',
	};
	return {
		id: 'bumper', name: 'Bumper Cars', icon: 'bumper', root,
		blurb: 'Drive, bump, get bumped',
		board: { u: U, v: V + HZ + 3.2, r: 3.2 }, exit: { u: U + 2.5, v: V + HZ + 4.5, yaw: 0 },
		lights: lit, drive: true,
		solid: [[U - HX - 1.5, V - HZ - 1.5, U - 1.4, V + HZ + 0.8], [U + 1.4, V - HZ - 1.5, U + HX + 1.5, V + HZ + 0.8], [U - 1.4, V - HZ - 1.5, U + 1.4, V + HZ - 0.5]],
		update(dt, t, info) { if (S.rider < 0) { listener = info.local; step(dt, { x: 0, y: 0 }); place(info.night); } },
		begin, pose,
		status() { return S.run ? `${Math.max(0, Math.ceil(S.timer))} s left` : 'The power is off'; },
		riders,
		end() { S.rider = -1; S.done = false; S.timer = 20; S.run = false; },
		dispose() { root.traverse((o) => o.geometry?.dispose()); },
	};
}
