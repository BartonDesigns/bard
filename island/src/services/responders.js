// The ambulances and the fire engines: their bodies (built once, shared by every one), their
// light bars that flash while they answer a call, and the drive along the streets
// (services/routes.js) with their sirens on, giving way to anyone in the road ahead of them,
// a child most of all. services/index.js owns them: where each lives, and what it is sent to.

import * as THREE from 'three';
import { createServiceVehicle, rollServiceWheels } from './vehicle-model.js';
import { along, pathLength } from './routes.js';

// one vehicle: kind 'ambulance' | 'engine'; home { x, z, y, yaw }
export function createResponder(kind, home, scene) {
	const root = new THREE.Group();
	const model = createServiceVehicle(kind); root.add(model);
	// the light bar: two lamps of their own each, to flash
	const red = new THREE.MeshBasicMaterial({ color: 0x330000, toneMapped: false }), other = new THREE.MeshBasicMaterial({ color: kind === 'ambulance' ? 0x222222 : 0x330000, toneMapped: false });
	const bar = new THREE.Group(), y = kind === 'ambulance' ? 2.4 : 2.92, z = kind === 'ambulance' ? 1.08 : 3.4;
	const lampG = new THREE.BoxGeometry(0.62, 0.14, 0.26);
	for (const [s, mat] of [[-1, red], [1, other]]) { const l = new THREE.Mesh(lampG, mat); l.position.set(s * 0.36, y, z); bar.add(l); }
	if (kind === 'ambulance') for (const [s, mat] of [[-1, red], [1, other]]) { const l = new THREE.Mesh(lampG, mat); l.scale.set(0.5, 1, 0.8); l.position.set(s * 0.8, 2.7, -3.0); bar.add(l); }
	root.add(bar);
	scene.add(root);
	const V = { kind, root, model, home: { ...home }, x: home.x, z: home.z, y: home.y, yaw: home.yaw, v: 0, state: 'parked', path: null, s: 0, L: 0, siren: false, task: null, t: 0, flash: 0, waited: 0 };
	root.position.set(V.x, V.y, V.z); root.rotation.y = V.yaw;
	V.drive = (path, siren) => { V.path = path; V.s = 0; V.L = pathLength(path); V.siren = !!siren; V.state = 'driving'; V.waited = 0; };
	V.lights = (on, dt) => {
		V.flash += dt * 7;
		const a = on && Math.floor(V.flash) % 2 === 0, b2 = on && !a;
		red.color.setHex(a ? 0xff1a10 : 0x330000);
		other.color.setHex(b2 ? (kind === 'ambulance' ? 0xffffff : 0xff1a10) : kind === 'ambulance' ? 0x222222 : 0x330000);
	};
	V.dispose = () => { scene.remove(root); red.dispose(); other.dispose(); lampG.dispose(); };
	return V;
}

// time passing for one: along its way, slowing for the corners and stopping for anyone in
// front of it (blockers: [{ x, z, child }]); ground(x, z) the road's height. Returns true when
// it has come to the end of its way.
export function stepResponder(V, dt, ground, blockers = []) {
	V.lights(V.siren, dt);
	if (V.state !== 'driving' || !V.path) return false;
	const p = along(V.path, V.s), top = V.siren ? 15 : 10;
	// (slow for the turn ahead: the sharper and nearer it is, the slower)
	const turn = p.bend > 0.4 ? Math.max(4, top * (1 - Math.min(1, p.bend / 1.6)) + p.toCorner * 0.6) : top;
	let want = Math.min(top, turn, (V.L - V.s) * 0.8 + 2);
	const fx = Math.sin(V.yaw), fz = Math.cos(V.yaw);
	for (const q of blockers) {
		const dx = q.x - V.x, dz = q.z - V.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
		// a child anywhere near the front: stop dead, and wait
		if (ahead > -1 && ahead < (q.child ? 12 : 8) && side < (q.child ? 3.2 : 2.2)) { want = 0; break; }
	}
	V.v += Math.max(-9 * dt, Math.min(3.5 * dt, want - V.v));
	if (want === 0 && V.v > 0) V.v = Math.max(0, V.v - 12 * dt);
	const previousDistance = V.s;
	V.s = Math.min(V.L, V.s + V.v * dt);
	rollServiceWheels(V.model, V.s - previousDistance);
	const q = along(V.path, V.s);
	let dy = q.yaw - V.yaw;
	dy = Math.atan2(Math.sin(dy), Math.cos(dy));
	V.yaw += dy * Math.min(1, dt * 4);
	V.x = q.x; V.z = q.z;
	const gy = ground(V.x, V.z);
	V.y += (gy - V.y) * Math.min(1, dt * 8);
	V.root.position.set(V.x, V.y, V.z);
	V.root.rotation.y = V.yaw;
	if (V.s >= V.L - 0.3) { V.state = 'arrived'; V.v = 0; return true; }
	return false;
}
export function park(V, at) {
	V.state = 'parked'; V.path = null; V.v = 0; V.siren = false;
	if (at) { V.x = at.x; V.z = at.z; V.y = at.y; V.yaw = at.yaw; }
	V.root.position.set(V.x, V.y, V.z); V.root.rotation.y = V.yaw;
}
