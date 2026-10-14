// The ambulances and the fire engines: their bodies (built once, shared by every one), their
// light bars that flash while they answer a call, and the drive along the streets
// (services/routes.js) with their sirens on, giving way to anyone in the road ahead of them,
// a child most of all. services/index.js owns them: where each lives, and what it is sent to.

import * as THREE from 'three';
import { Builder, lin } from '../bay/housekit.js';
import { along, pathLength } from './routes.js';

const geos = {};
// a body drawn in its own frame: x across, z forward (its nose at +z), standing on y = 0
function body(kind) {
	if (geos[kind]) return geos[kind];
	const b = new Builder(), W = lin([0.95, 0.95, 0.93]), R = lin([0.72, 0.08, 0.06]), K = lin([0.05, 0.05, 0.06]), S = lin([0.7, 0.71, 0.73]), Gl = lin([0.12, 0.16, 0.2]), Y = lin([0.95, 0.75, 0.1]);
	const wheel = (x, z, r) => { b.cyl('tyre', x, r, z, r, Math.sign(x) * 0.28, K, 14, 'x'); b.cyl('metal', x + Math.sign(x) * 0.29, r, z, r * 0.55, Math.sign(x) * 0.01, S, 10, 'x'); };
	if (kind === 'ambulance') {
		// a box ambulance: the cab, the patient box behind, its stripe and lamps
		b.box('paint', -1.05, 0.55, -3.1, 1.05, 2.75, 0.9, W);
		b.box('paint', -1.0, 0.55, 0.9, 1.0, 1.55, 2.55, W);
		b.box('glass', -0.95, 1.55, 0.9, 0.95, 2.3, 1.75, Gl);
		b.box('paint', -0.95, 1.55, 0.9, 0.95, 2.35, 1.0, W);
		b.box('paint', -1.0, 2.3, 0.9, 1.0, 2.38, 1.75, W);
		for (const s of [-1, 1]) { b.box('paint', s * 1.051 - 0.001, 1.15, -3.1, s * 1.051 + 0.001, 1.45, 0.9, R); b.box('paint', s * 1.001 - 0.001, 1.0, 0.9, s * 1.001 + 0.001, 1.25, 2.55, R); b.box('glass', s * 1.002 - 0.002, 1.62, 1.0, s * 1.002 + 0.002, 2.2, 1.7, Gl); }
		b.box('paint', -1.0, 0.55, -3.11, 1.0, 2.7, -3.1, lin([0.85, 0.85, 0.83]));
		for (const s of [-1, 1]) b.box('paint', s * 0.5 - 0.02, 0.7, -3.12, s * 0.5 + 0.02, 2.6, -3.11, K);
		b.box('paint', -1.0, 0.35, 2.4, 1.0, 0.75, 2.7, K);
		for (const s of [-1, 1]) b.box('lamp', s * 0.75 - 0.15, 0.95, 2.551, s * 0.75 + 0.15, 1.1, 2.56, lin([1, 0.97, 0.88]));
		for (const s of [-1, 1]) b.box('paint', s * 0.8 - 0.12, 0.9, -3.12, s * 0.8 + 0.12, 1.2, -3.11, R);
		for (const [x, z] of [[-0.95, 1.7], [0.95, 1.7], [-0.95, -2.0], [0.95, -2.0]]) wheel(x, z, 0.4);
		b.box('paint', -1.0, 0.35, -3.1, 1.0, 0.6, 2.4, K);
	} else {
		// a pumper: the crew cab, the body with its lockers and the ladder on top
		b.box('paint', -1.25, 0.6, 1.4, 1.25, 2.9, 4.3, R);
		b.box('glass', -1.2, 1.9, 4.3, 1.2, 2.75, 4.31, Gl);
		for (const s of [-1, 1]) b.box('glass', s * 1.251 - 0.002, 1.9, 2.6, s * 1.251 + 0.002, 2.7, 4.1, Gl);
		b.box('paint', -1.25, 0.6, -4.7, 1.25, 2.6, 1.4, R);
		for (const s of [-1, 1]) {
			for (let z = -4.4; z < 1.1; z += 1.3) { b.box('metal', s * 1.252 - 0.002, 0.8, z, s * 1.252 + 0.002, 2.45, z + 1.15, S); b.box('paint', s * 1.256 - 0.002, 1.55, z + 0.05, s * 1.256 + 0.002, 1.6, z + 1.1, K); }
			b.box('paint', s * 1.26 - 0.002, 0.62, -4.7, s * 1.26 + 0.002, 0.75, 4.3, Y);
		}
		b.box('metal', -0.9, 2.6, -4.6, 0.9, 2.7, 1.2, S);
		for (const s of [-1, 1]) b.box('metal', s * 0.55 - 0.04, 2.7, -4.8, s * 0.55 + 0.04, 2.85, 1.3, S);
		for (let z = -4.6; z < 1.3; z += 0.35) b.box('metal', -0.55, 2.76, z, 0.55, 2.8, z + 0.05, S);
		b.box('metal', -1.25, 0.4, 4.3, 1.25, 0.8, 4.6, S);
		for (const s of [-1, 1]) b.box('lamp', s * 0.9 - 0.15, 1.0, 4.31, s * 0.9 + 0.15, 1.2, 4.32, lin([1, 0.97, 0.88]));
		for (const [x, z] of [[-1.15, 3.2], [1.15, 3.2], [-1.15, -2.6], [1.15, -2.6], [-1.15, -3.7], [1.15, -3.7]]) wheel(x, z, 0.5);
		b.box('paint', -1.2, 0.35, -4.7, 1.2, 0.62, 4.3, K);
	}
	geos[kind] = { b };
	return geos[kind];
}
let MATS = null;
function mats() {
	if (MATS) return MATS;
	const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
	MATS = { paint: std({ roughness: 0.35, metalness: 0.1 }), glass: std({ roughness: 0.08, metalness: 0.4 }), metal: std({ roughness: 0.3, metalness: 0.85 }), tyre: std({ roughness: 0.9 }), lamp: std({ roughness: 0.5, emissive: 0xfff3d6, emissiveIntensity: 0.6 }) };
	return MATS;
}
const shared = {};
function geometryOf(kind) {
	if (shared[kind]) return shared[kind];
	const { b } = body(kind), M = mats(), out = [];
	for (const m of b.meshes(M)) { m.geometry.userData.shared = true; out.push(m); }
	shared[kind] = out;
	return out;
}

// one vehicle: kind 'ambulance' | 'engine'; home { x, z, y, yaw }
export function createResponder(kind, home, scene) {
	const root = new THREE.Group();
	for (const m of geometryOf(kind)) { const c = new THREE.Mesh(m.geometry, m.material); c.castShadow = true; root.add(c); }
	// the light bar: two lamps of their own each, to flash
	const red = new THREE.MeshBasicMaterial({ color: 0x330000, toneMapped: false }), other = new THREE.MeshBasicMaterial({ color: kind === 'ambulance' ? 0x222222 : 0x330000, toneMapped: false });
	const bar = new THREE.Group(), y = kind === 'ambulance' ? 2.78 : 2.92, z = kind === 'ambulance' ? 0.6 : 3.4;
	const lampG = new THREE.BoxGeometry(0.62, 0.14, 0.26);
	for (const [s, mat] of [[-1, red], [1, other]]) { const l = new THREE.Mesh(lampG, mat); l.position.set(s * 0.36, y, z); bar.add(l); }
	if (kind === 'ambulance') for (const [s, mat] of [[-1, red], [1, other]]) { const l = new THREE.Mesh(lampG, mat); l.scale.set(0.5, 1, 0.8); l.position.set(s * 0.8, 2.7, -3.0); bar.add(l); }
	root.add(bar);
	scene.add(root);
	const V = { kind, root, home: { ...home }, x: home.x, z: home.z, y: home.y, yaw: home.yaw, v: 0, state: 'parked', path: null, s: 0, L: 0, siren: false, task: null, t: 0, flash: 0, waited: 0 };
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
	V.s = Math.min(V.L, V.s + V.v * dt);
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
